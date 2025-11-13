/* Proprietary and confidential. See LICENSE. */

/**
 * Driver Info Admin Service
 *
 * Admin functions for managing gate codes and dropoff locations
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";

import { db, storage } from "@/utils/firebaseInit";
import logError from "@/utils/logError";

/**
 * Create or update a gate code
 *
 * @param {Object} gateCodeData - Gate code data
 * @returns {Promise<void>}
 */
export async function saveGateCode(gateCodeData) {
  try {
    const gateCodesRef = collection(db, "gateCodes");

    // If editing existing, use existing ID; otherwise create new doc
    const docRef = gateCodeData.id
      ? doc(gateCodesRef, gateCodeData.id)
      : doc(gateCodesRef);

    const data = {
      name: gateCodeData.name,
      codes: gateCodeData.codes,
      category: gateCodeData.category || "general",
      sortOrder: gateCodeData.sortOrder ?? 999,
      active: gateCodeData.active ?? true,
      usageCount: gateCodeData.usageCount ?? 0,
      lastUsed: gateCodeData.lastUsed ?? null,
      updatedAt: serverTimestamp(),
      ...(gateCodeData.id ? {} : { createdAt: serverTimestamp() }),
    };

    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    logError(error, {
      where: "driverInfoAdminService",
      action: "saveGateCode",
    });
    throw error;
  }
}

/**
 * Delete a gate code
 *
 * @param {string} gateCodeId - Gate code document ID
 * @returns {Promise<void>}
 */
export async function deleteGateCode(gateCodeId) {
  try {
    const docRef = doc(db, "gateCodes", gateCodeId);
    await deleteDoc(docRef);
  } catch (error) {
    logError(error, {
      where: "driverInfoAdminService",
      action: "deleteGateCode",
      gateCodeId,
    });
    throw error;
  }
}

/**
 * Create or update a dropoff location
 *
 * @param {Object} locationData - Location data
 * @returns {Promise<void>}
 */
export async function saveDropoffLocation(locationData) {
  try {
    const locationsRef = collection(db, "dropoffLocations");

    // If editing existing, use existing ID; otherwise create new doc
    const docRef = locationData.id
      ? doc(locationsRef, locationData.id)
      : doc(locationsRef);

    const data = {
      name: locationData.name,
      notes: locationData.notes,
      category: locationData.category || "general",
      imageUrl: locationData.imageUrl || null,
      imagePath: locationData.imagePath || null,
      sortOrder: locationData.sortOrder ?? 999,
      active: locationData.active ?? true,
      viewCount: locationData.viewCount ?? 0,
      updatedAt: serverTimestamp(),
      ...(locationData.id ? {} : { createdAt: serverTimestamp() }),
    };

    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    logError(error, {
      where: "driverInfoAdminService",
      action: "saveDropoffLocation",
    });
    throw error;
  }
}

/**
 * Delete a dropoff location
 * Also deletes the associated image from storage if present
 *
 * @param {string} locationId - Location document ID
 * @param {string} imagePath - Storage path to image (optional)
 * @returns {Promise<void>}
 */
export async function deleteDropoffLocation(locationId, imagePath) {
  try {
    // Delete the Firestore document
    const docRef = doc(db, "dropoffLocations", locationId);
    await deleteDoc(docRef);

    // Delete the image from storage if it exists
    if (imagePath) {
      try {
        const imageRef = ref(storage, imagePath);
        await deleteObject(imageRef);
      } catch (imageError) {
        // Log but don't fail the whole operation if image deletion fails
        logError(imageError, {
          where: "driverInfoAdminService",
          action: "deleteDropoffLocation.deleteImage",
          imagePath,
        });
      }
    }
  } catch (error) {
    logError(error, {
      where: "driverInfoAdminService",
      action: "deleteDropoffLocation",
      locationId,
    });
    throw error;
  }
}

/**
 * Update sort orders for gate codes
 *
 * @param {Array} gateCodeIds - Array of gate code IDs in new order
 * @returns {Promise<void>}
 */
export async function updateGateCodeOrder(gateCodeIds) {
  try {
    const promises = gateCodeIds.map((id, index) => {
      const docRef = doc(db, "gateCodes", id);
      return updateDoc(docRef, {
        sortOrder: index,
        updatedAt: serverTimestamp(),
      });
    });

    await Promise.all(promises);
  } catch (error) {
    logError(error, {
      where: "driverInfoAdminService",
      action: "updateGateCodeOrder",
    });
    throw error;
  }
}

/**
 * Update sort orders for dropoff locations
 *
 * @param {Array} locationIds - Array of location IDs in new order
 * @returns {Promise<void>}
 */
export async function updateLocationOrder(locationIds) {
  try {
    const promises = locationIds.map((id, index) => {
      const docRef = doc(db, "dropoffLocations", id);
      return updateDoc(docRef, {
        sortOrder: index,
        updatedAt: serverTimestamp(),
      });
    });

    await Promise.all(promises);
  } catch (error) {
    logError(error, {
      where: "driverInfoAdminService",
      action: "updateLocationOrder",
    });
    throw error;
  }
}
