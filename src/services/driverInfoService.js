/* Proprietary and confidential. See LICENSE. */

/**
 * Driver Info Service
 *
 * Provides real-time subscriptions and tracking for:
 * - Gate codes
 * - Dropoff locations
 * - Airport instructions
 */

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/utils/firebaseInit";
import logError from "@/utils/logError";

/**
 * Subscribe to gate codes (real-time)
 *
 * @param {Object} options
 * @param {Function} options.onData - Callback with array of gate codes
 * @param {Function} options.onError - Error callback
 * @returns {Function} Unsubscribe function
 */
export function subscribeGateCodes({ onData, onError }) {
  try {
    const gateCodesRef = collection(db, "gateCodes");
    const q = query(
      gateCodesRef,
      where("active", "==", true),
      orderBy("sortOrder", "asc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const gateCodes = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        onData(gateCodes);
      },
      (error) => {
        logError(error, {
          where: "driverInfoService",
          action: "subscribeGateCodes",
        });
        if (onError) onError(error);
      },
    );

    return unsubscribe;
  } catch (error) {
    logError(error, {
      where: "driverInfoService",
      action: "subscribeGateCodes",
    });
    if (onError) onError(error);
    return () => {};
  }
}

/**
 * Subscribe to dropoff locations (real-time)
 *
 * @param {Object} options
 * @param {Function} options.onData - Callback with array of locations
 * @param {Function} options.onError - Error callback
 * @returns {Function} Unsubscribe function
 */
export function subscribeDropoffLocations({ onData, onError }) {
  try {
    const locationsRef = collection(db, "dropoffLocations");
    const q = query(
      locationsRef,
      where("active", "==", true),
      orderBy("sortOrder", "asc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const locations = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        onData(locations);
      },
      (error) => {
        logError(error, {
          where: "driverInfoService",
          action: "subscribeDropoffLocations",
        });
        if (onError) onError(error);
      },
    );

    return unsubscribe;
  } catch (error) {
    logError(error, {
      where: "driverInfoService",
      action: "subscribeDropoffLocations",
    });
    if (onError) onError(error);
    return () => {};
  }
}

/**
 * Track gate code usage
 * Increments usageCount and sets lastUsed timestamp
 *
 * @param {string} codeId - Gate code document ID
 * @returns {Promise<void>}
 */
export async function trackGateCodeUsage(codeId) {
  try {
    const codeRef = doc(db, "gateCodes", codeId);
    await updateDoc(codeRef, {
      usageCount: increment(1),
      lastUsed: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    // Log but don't throw - tracking failures shouldn't break UX
    logError(error, {
      where: "driverInfoService",
      action: "trackGateCodeUsage",
      codeId,
    });
  }
}

/**
 * Track location view
 * Increments viewCount when a location is viewed
 *
 * @param {string} locationId - Location document ID
 * @returns {Promise<void>}
 */
export async function trackLocationView(locationId) {
  try {
    const locationRef = doc(db, "dropoffLocations", locationId);
    await updateDoc(locationRef, {
      viewCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    // Log but don't throw - tracking failures shouldn't break UX
    logError(error, {
      where: "driverInfoService",
      action: "trackLocationView",
      locationId,
    });
  }
}

/**
 * Subscribe to airport instructions (real-time)
 *
 * @param {Object} options
 * @param {Function} options.onData - Callback with airport instructions doc
 * @param {Function} options.onError - Error callback
 * @returns {Function} Unsubscribe function
 */
export function subscribeAirportInstructions({ onData, onError }) {
  try {
    const instructionsRef = collection(db, "airportInstructions");

    const unsubscribe = onSnapshot(
      instructionsRef,
      (snapshot) => {
        const instructions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        // Return first doc or null
        onData(instructions.length > 0 ? instructions[0] : null);
      },
      (error) => {
        logError(error, {
          where: "driverInfoService",
          action: "subscribeAirportInstructions",
        });
        if (onError) onError(error);
      },
    );

    return unsubscribe;
  } catch (error) {
    logError(error, {
      where: "driverInfoService",
      action: "subscribeAirportInstructions",
    });
    if (onError) onError(error);
    return () => {};
  }
}
