/* Proprietary and confidential. See LICENSE. */

/**
 * Directory Service
 *
 * Provides real-time subscriptions and CRUD operations for directory contacts
 */

import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
  deleteField,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import { db, storage } from "@/utils/firebaseInit";
import logError from "@/utils/logError";

/**
 * Get Firestore query for directory contacts
 *
 * @param {boolean} activeOnly - If true, only return active contacts
 * @returns {Query} Firestore query
 */
export function getDirectoryQuery(activeOnly = true) {
  const directoryRef = collection(db, "directory");

  const constraints = [orderBy("priority", "asc"), orderBy("name", "asc")];

  if (activeOnly) {
    constraints.unshift(where("active", "==", true));
  }

  return query(directoryRef, ...constraints);
}

/**
 * Get user data by email from users collection
 *
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User data or null if not found
 */
export async function getUserByEmail(email) {
  if (!email) return null;

  try {
    const userRef = doc(db, "users", email.toLowerCase());
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return {
        email: userSnap.id,
        ...userSnap.data(),
      };
    }
    return null;
  } catch (error) {
    logError(error, {
      where: "directoryService",
      action: "getUserByEmail",
      email,
    });
    return null;
  }
}

/**
 * Subscribe to directory contacts (real-time) with user data enrichment
 *
 * @param {Object} options
 * @param {boolean} options.activeOnly - Only return active contacts
 * @param {Function} options.onData - Callback with array of contacts
 * @param {Function} options.onError - Error callback
 * @returns {Function} Unsubscribe function
 */
export function subscribeDirectory({ activeOnly = true, onData, onError }) {
  try {
    const q = getDirectoryQuery(activeOnly);

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const contacts = await Promise.all(
          snapshot.docs.map(async (contactDoc) => {
            const contactData = {
              id: contactDoc.id,
              ...contactDoc.data(),
            };

            // If contact has an email, try to enrich with user data
            if (contactData.email) {
              const userData = await getUserByEmail(contactData.email);
              if (userData) {
                contactData.userAccess = userData.access || userData.role;
                contactData.userName = userData.name;
                contactData.userPhone = userData.phone;
              }
            }

            return contactData;
          }),
        );
        onData(contacts);
      },
      (error) => {
        logError(error, {
          where: "directoryService",
          action: "subscribeDirectory",
        });
        if (onError) onError(error);
      },
    );

    return unsubscribe;
  } catch (error) {
    logError(error, {
      where: "directoryService",
      action: "subscribeDirectory",
    });
    if (onError) onError(error);
    return () => {};
  }
}

/**
 * Create or update a directory contact
 *
 * @param {Object} contactData - Contact data
 * @param {string} userId - User ID making the change
 * @returns {Promise<void>}
 */
export async function createContact(contactData, userId) {
  try {
    const directoryRef = collection(db, "directory");

    // If editing existing, use existing ID; otherwise create new doc
    const docRef = contactData.id
      ? doc(directoryRef, contactData.id)
      : doc(directoryRef);

    const data = {
      name: contactData.name,
      phone: contactData.phone,
      email: contactData.email || null,
      imageUrl: contactData.imageUrl || null,
      escalationTiers: contactData.escalationTiers || [], // Array of tiers
      escalationTier: deleteField(), // Remove old single tier field
      vehicles: contactData.vehicles || [], // Array of vehicle types
      availabilityHours: contactData.availabilityHours || null,
      notes: contactData.notes || null,
      active: contactData.active ?? true,
      priority: contactData.priority ?? 999,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
      ...(contactData.id
        ? {}
        : {
            createdAt: serverTimestamp(),
            createdBy: userId,
          }),
    };

    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    logError(error, {
      where: "directoryService",
      action: "createContact",
    });
    throw error;
  }
}

/**
 * Update a directory contact
 *
 * @param {string} id - Contact document ID
 * @param {Object} updates - Fields to update
 * @param {string} userId - User ID making the change
 * @returns {Promise<void>}
 */
export async function updateContact(id, updates, userId) {
  try {
    const data = {
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };

    await createContact({ ...data, id }, userId);
  } catch (error) {
    logError(error, {
      where: "directoryService",
      action: "updateContact",
      id,
    });
    throw error;
  }
}

/**
 * Delete a directory contact
 *
 * @param {string} id - Contact document ID
 * @returns {Promise<void>}
 */
export async function deleteContact(id) {
  try {
    const docRef = doc(db, "directory", id);
    await deleteDoc(docRef);
  } catch (error) {
    logError(error, {
      where: "directoryService",
      action: "deleteContact",
      id,
    });
    throw error;
  }
}

/**
 * Upload contact image to Firebase Storage
 *
 * @param {File} file - Image file to upload
 * @param {string} contactId - Contact ID (use 'temp' for new contacts)
 * @returns {Promise<string>} Download URL of uploaded image
 */
export async function uploadContactImage(file, contactId = "temp") {
  try {
    if (!file) {
      throw new Error("No file provided");
    }

    // Create a unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.name}`;
    const storagePath = `directory-images/${contactId}/${filename}`;

    // Create a reference to the file location
    const storageRef = ref(storage, storagePath);

    // Upload the file
    await uploadBytes(storageRef, file);

    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    logError(error, {
      where: "directoryService",
      action: "uploadContactImage",
      contactId,
    });
    throw error;
  }
}

/**
 * Delete contact image from Firebase Storage
 *
 * @param {string} imageUrl - Full download URL of the image
 * @returns {Promise<void>}
 */
export async function deleteContactImage(imageUrl) {
  try {
    if (!imageUrl) return;

    // Extract the storage path from the download URL
    // URL format: https://firebasestorage.googleapis.com/v0/b/[bucket]/o/[path]?[params]
    const urlParts = imageUrl.split("/o/");
    if (urlParts.length < 2) return;

    const pathWithParams = urlParts[1];
    const storagePath = decodeURIComponent(pathWithParams.split("?")[0]);

    // Create a reference and delete
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    // Don't throw error if file doesn't exist
    if (error.code !== "storage/object-not-found") {
      logError(error, {
        where: "directoryService",
        action: "deleteContactImage",
        imageUrl,
      });
    }
  }
}

/**
 * Validate phone number (E.164 format)
 *
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid E.164 format
 */
export function validatePhone(phone) {
  if (!phone) return false;

  // E.164 format: +[country code][number]
  // Example: +15738885555
  const e164Regex = /^\+[1-9]\d{1,14}$/;

  return e164Regex.test(phone);
}

/**
 * Format phone for display
 * Converts +15738885555 to (573) 888-5555
 *
 * @param {string} phone - Phone number in E.164 format
 * @returns {string} Formatted phone number
 */
export function formatPhoneDisplay(phone) {
  if (!phone) return "";

  // Remove + and country code (assuming US +1)
  const cleaned = phone.replace(/^\+1/, "");

  // Format as (XXX) XXX-XXXX
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  // If not 10 digits after removing +1, return as-is
  return phone;
}

/**
 * Parse phone input to E.164 format
 * Handles various input formats and converts to +1XXXXXXXXXX
 *
 * @param {string} phone - Phone number in various formats
 * @returns {string} Phone in E.164 format
 */
export function parsePhoneToE164(phone) {
  if (!phone) return "";

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");

  // If it starts with 1 and has 11 digits, assume US number
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }

  // If it has 10 digits, assume US number and add country code
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // If already has country code
  if (cleaned.length > 10) {
    return `+${cleaned}`;
  }

  // Return cleaned version with + if we can't determine format
  return cleaned ? `+${cleaned}` : "";
}

/**
 * Validate email address
 *
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
export function validateEmail(email) {
  if (!email) return true; // Email is optional

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
