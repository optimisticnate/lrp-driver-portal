/* Proprietary and confidential. See LICENSE. */
/**
 * Secure proxy for Supabase operations
 * Uses service_role key on backend (safe!)
 * Validates Firebase auth tokens before allowing access
 */

const { logger } = require("firebase-functions/v2");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { createClient } = require("@supabase/supabase-js");
const { admin } = require("./admin");

// Initialize Supabase client with service_role key (server-side only!)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  logger.warn("Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

/**
 * Check if user has admin access
 */
async function checkAdminAccess(auth) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  // Check admin access via custom claim OR Firestore role
  const hasAdminClaim = auth.token?.admin === true;
  const hasAdminRole = auth.token?.role === "admin";
  let isAdmin = hasAdminClaim || hasAdminRole;

  // If no admin access from token, check Firestore
  if (!isAdmin && auth.token?.email) {
    try {
      const db = admin.firestore();
      const lcEmail = auth.token.email.toLowerCase();

      // Check userAccess collection
      const userAccessDoc = await db
        .collection("userAccess")
        .doc(lcEmail)
        .get();
      if (userAccessDoc.exists && userAccessDoc.data()?.access === "admin") {
        isAdmin = true;
      }

      // If not found in userAccess, check users collection
      if (!isAdmin) {
        const userDoc = await db.collection("users").doc(auth.uid).get();
        if (userDoc.exists && userDoc.data()?.role === "admin") {
          isAdmin = true;
        }
      }
    } catch (error) {
      logger.warn("Error checking Firestore role", {
        uid: auth.uid,
        error: error.message,
      });
    }
  }

  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  return true;
}

/**
 * Gift Cards operations
 */
exports.giftCardsQuery = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true,
    enforceAppCheck: false,
  },
  async (req) => {
    await checkAdminAccess(req.auth);

    if (!supabase) {
      throw new HttpsError("failed-precondition", "Supabase not configured");
    }

    const { operation, params } = req.data;

    try {
      switch (operation) {
        case "getAll": {
          const { status, limit, offset } = params || {};
          let query = supabase
            .from("gift_cards")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false });

          if (status && status !== "all") {
            query = query.eq("status", status);
          }
          if (limit) {
            query = query.limit(limit);
          }
          if (offset) {
            query = query.range(offset, offset + (limit || 50) - 1);
          }

          const { data, error, count } = await query;
          if (error) throw error;

          return { data: data || [], count: count || 0 };
        }

        case "findByCode": {
          const { code } = params;
          const { data, error } = await supabase
            .from("gift_cards")
            .select("*")
            .eq("code", code.toUpperCase())
            .single();

          if (error && error.code !== "PGRST116") throw error;
          return { data: data || null };
        }

        case "getById": {
          const { id } = params;
          const { data, error } = await supabase
            .from("gift_cards")
            .select("*")
            .eq("id", id)
            .single();

          if (error) throw error;
          return { data };
        }

        case "update": {
          const { id, updates } = params;
          const { data, error } = await supabase
            .from("gift_cards")
            .update({
              ...updates,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id)
            .select()
            .single();

          if (error) throw error;
          return { data };
        }

        case "updateStatus": {
          const { id, status } = params;
          const { error } = await supabase
            .from("gift_cards")
            .update({
              status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id);

          if (error) throw error;
          return { success: true };
        }

        case "create": {
          const { cardData } = params;
          const { data, error } = await supabase
            .from("gift_cards")
            .insert([{
              ...cardData,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }])
            .select()
            .single();

          if (error) throw error;
          return { data };
        }

        case "getStats": {
          const { data, error } = await supabase
            .from("gift_cards")
            .select("status, current_balance");

          if (error) throw error;

          const stats = {
            total: data.length,
            active: data.filter((c) => c.status === "active").length,
            redeemed: data.filter((c) => c.status === "redeemed").length,
            totalValue: data.reduce((sum, c) => sum + (c.current_balance || 0), 0),
          };

          return { data: stats };
        }

        default:
          throw new HttpsError("invalid-argument", `Unknown operation: ${operation}`);
      }
    } catch (error) {
      logger.error("giftCardsQuery error", { operation, error: error.message });
      throw new HttpsError("internal", error.message);
    }
  }
);

/**
 * Orders operations
 */
exports.ordersQuery = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true,
    enforceAppCheck: false,
  },
  async (req) => {
    await checkAdminAccess(req.auth);

    if (!supabase) {
      throw new HttpsError("failed-precondition", "Supabase not configured");
    }

    const { operation, params } = req.data;

    try {
      switch (operation) {
        case "getAll": {
          const { status, limit, offset } = params || {};
          let query = supabase
            .from("orders")
            .select(
              `
              *,
              items:order_items(*),
              shippingAddress:shipping_addresses(*)
            `,
              { count: "exact" }
            )
            .order("created_at", { ascending: false });

          if (status && status !== "all") {
            query = query.eq("status", status);
          }
          if (limit) {
            query = query.limit(limit);
          }
          if (offset) {
            query = query.range(offset, offset + (limit || 50) - 1);
          }

          const { data, error, count } = await query;
          if (error) throw error;

          // Transform shipping address from array to object
          const orders = (data || []).map((order) => ({
            ...order,
            items: order.items || [],
            shippingAddress: Array.isArray(order.shippingAddress)
              ? order.shippingAddress[0]
              : order.shippingAddress,
          }));

          return { data: orders, count: count || 0 };
        }

        case "getById": {
          const { id } = params;
          const { data, error } = await supabase
            .from("orders")
            .select(
              `
              *,
              items:order_items(*),
              shippingAddress:shipping_addresses(*)
            `
            )
            .eq("id", id)
            .single();

          if (error) throw error;

          const order = {
            ...data,
            items: data.items || [],
            shippingAddress: Array.isArray(data.shippingAddress)
              ? data.shippingAddress[0]
              : data.shippingAddress,
          };

          return { data: order };
        }

        case "updateStatus": {
          const { id, status } = params;
          const updates = {
            status,
            updated_at: new Date().toISOString(),
          };

          // Set timestamps based on status
          if (status === "shipped") {
            updates.shipped_at = new Date().toISOString();
          } else if (status === "delivered") {
            updates.delivered_at = new Date().toISOString();
          }

          const { error } = await supabase
            .from("orders")
            .update(updates)
            .eq("id", id);

          if (error) throw error;
          return { success: true };
        }

        case "updateTracking": {
          const { id, trackingNumber, carrier } = params;
          const updates = {
            tracking_number: trackingNumber,
            status: "shipped",
            shipped_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          if (carrier) {
            updates.shipping_carrier = carrier;
          }

          const { error } = await supabase
            .from("orders")
            .update(updates)
            .eq("id", id);

          if (error) throw error;
          return { success: true };
        }

        case "update": {
          const { id, updates } = params;
          const { data, error } = await supabase
            .from("orders")
            .update({
              ...updates,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id)
            .select()
            .single();

          if (error) throw error;
          return { data };
        }

        case "getStats": {
          const { data, error } = await supabase
            .from("orders")
            .select("status, total");

          if (error) throw error;

          const stats = {
            total: data.length,
            pending: data.filter((o) => o.status === "pending").length,
            processing: data.filter((o) => o.status === "processing").length,
            shipped: data.filter((o) => o.status === "shipped").length,
            delivered: data.filter((o) => o.status === "delivered").length,
            completed: data.filter((o) => o.status === "completed").length,
            totalRevenue: data.reduce((sum, o) => sum + (o.total || 0), 0),
          };

          return { data: stats };
        }

        case "search": {
          const { searchTerm } = params;
          const { data, error } = await supabase
            .from("orders")
            .select(
              `
              *,
              items:order_items(*),
              shippingAddress:shipping_addresses(*)
            `
            )
            .or(
              `order_number.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%,customer_email.ilike.%${searchTerm}%`
            )
            .order("created_at", { ascending: false })
            .limit(50);

          if (error) throw error;

          const orders = (data || []).map((order) => ({
            ...order,
            items: order.items || [],
            shippingAddress: Array.isArray(order.shippingAddress)
              ? order.shippingAddress[0]
              : order.shippingAddress,
          }));

          return { data: orders };
        }

        default:
          throw new HttpsError("invalid-argument", `Unknown operation: ${operation}`);
      }
    } catch (error) {
      logger.error("ordersQuery error", { operation, error: error.message });
      throw new HttpsError("internal", error.message);
    }
  }
);
