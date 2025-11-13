import { describe, it, expect, beforeEach, vi } from "vitest";
import { Timestamp } from "firebase/firestore";

import { logTime, normalizeTimeLog, updateTimeLog } from "../fs";

// Mock Firestore
vi.mock("../firestoreCore", () => ({
  getDb: () => ({}),
  collection: vi.fn(() => ({ _type: "CollectionReference" })),
  doc: vi.fn(() => ({ _type: "DocumentReference" })),
  getDoc: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: "new-log-123" }),
  setDoc: vi.fn().mockResolvedValue({}),
  updateDoc: vi.fn().mockResolvedValue({}),
  serverTimestamp: () => ({ _methodName: "serverTimestamp" }),
}));

vi.mock("../retry", () => ({
  withExponentialBackoff: (fn) => fn(),
}));

describe("Firestore TimeLogs Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("logTime - Boolean Fields Storage", () => {
    it("stores both mode and boolean fields for new sessions", async () => {
      const { addDoc } = await import("../firestoreCore");

      const result = await logTime({
        driverKey: "test@example.com",
        driverId: "uid-123",
        driverName: "Test Driver",
        driverEmail: "test@example.com",
        rideId: "RIDE-001",
        mode: "RIDE",
        isNonRideTask: false,
        isMultipleRides: false,
      });

      expect(result.id).toBeDefined();
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          mode: "RIDE",
          isNonRideTask: false,
          isMultipleRides: false,
          rideId: "RIDE-001",
        }),
      );
    });

    it("stores isNonRideTask=true for non-ride tasks", async () => {
      const { addDoc } = await import("../firestoreCore");

      await logTime({
        driverKey: "test@example.com",
        driverId: "uid-123",
        driverName: "Test Driver",
        mode: "N/A",
        isNonRideTask: true,
        isMultipleRides: false,
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          mode: "N/A",
          isNonRideTask: true,
          isMultipleRides: false,
          rideId: "N/A",
        }),
      );
    });

    it("stores isMultipleRides=true for multi-ride sessions", async () => {
      const { addDoc } = await import("../firestoreCore");

      await logTime({
        driverKey: "test@example.com",
        mode: "MULTI",
        isNonRideTask: false,
        isMultipleRides: true,
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          mode: "MULTI",
          isNonRideTask: false,
          isMultipleRides: true,
        }),
      );
    });

    it("defaults booleans to false when not provided", async () => {
      const { addDoc } = await import("../firestoreCore");

      await logTime({
        driverKey: "test@example.com",
        mode: "RIDE",
        // NO isNonRideTask or isMultipleRides
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isNonRideTask: false,
          isMultipleRides: false,
        }),
      );
    });

    it("validates boolean types and defaults non-booleans to false", async () => {
      const { addDoc } = await import("../firestoreCore");

      await logTime({
        driverKey: "test@example.com",
        mode: "RIDE",
        isNonRideTask: "yes", // Invalid type
        isMultipleRides: 1, // Invalid type
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isNonRideTask: false,
          isMultipleRides: false,
        }),
      );
    });
  });

  describe("normalizeTimeLog - Backward Compatibility", () => {
    it("defaults booleans to false for legacy documents", () => {
      const legacyDoc = {
        id: () => "legacy-1",
        data: () => ({
          driverKey: "old@example.com",
          mode: "N/A",
          rideId: "N/A",
          startTs: Timestamp.now(),
          status: "closed",
          // NO isNonRideTask or isMultipleRides
        }),
      };

      const normalized = normalizeTimeLog(legacyDoc);

      expect(normalized.isNonRideTask).toBe(false);
      expect(normalized.isMultipleRides).toBe(false);
      expect(normalized.mode).toBe("N/A"); // Preserved
    });

    it("preserves boolean fields when present", () => {
      const newDoc = {
        id: () => "new-1",
        data: () => ({
          driverKey: "new@example.com",
          mode: "N/A",
          isNonRideTask: true,
          isMultipleRides: false,
          startTs: Timestamp.now(),
          status: "open",
        }),
      };

      const normalized = normalizeTimeLog(newDoc);

      expect(normalized.isNonRideTask).toBe(true);
      expect(normalized.isMultipleRides).toBe(false);
    });

    it("treats non-boolean values as false", () => {
      const invalidDoc = {
        id: () => "invalid-1",
        data: () => ({
          driverKey: "test@example.com",
          mode: "RIDE",
          isNonRideTask: "true", // String, not boolean
          isMultipleRides: 1, // Number, not boolean
        }),
      };

      const normalized = normalizeTimeLog(invalidDoc);

      expect(normalized.isNonRideTask).toBe(false);
      expect(normalized.isMultipleRides).toBe(false);
    });

    it("preserves all other fields during normalization", () => {
      const doc = {
        id: () => "doc-1",
        data: () => ({
          driverKey: "driver@example.com",
          driverId: "uid-123",
          driverName: "Driver Name",
          driverEmail: "driver@example.com",
          rideId: "RIDE-001",
          mode: "RIDE",
          isNonRideTask: false,
          isMultipleRides: false,
          startTs: Timestamp.now(),
          note: "Test note",
          duration: 60,
        }),
      };

      const normalized = normalizeTimeLog(doc);

      expect(normalized.driverKey).toBe("driver@example.com");
      expect(normalized.driverId).toBe("uid-123");
      expect(normalized.driverName).toBe("Driver Name");
      expect(normalized.note).toBe("Test note");
      expect(normalized.duration).toBe(60);
    });
  });

  describe("updateTimeLog - Boolean Fields Updates", () => {
    it("updates boolean fields when provided", async () => {
      const { updateDoc, getDoc } = await import("../firestoreCore");

      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          startTs: Timestamp.now(),
          endTs: null,
        }),
      });

      await updateTimeLog("log-123", {
        isNonRideTask: true,
        isMultipleRides: false,
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isNonRideTask: true,
          isMultipleRides: false,
        }),
      );
    });

    it("validates boolean types on update", async () => {
      const { updateDoc, getDoc } = await import("../firestoreCore");

      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          startTs: Timestamp.now(),
          endTs: null,
        }),
      });

      await updateTimeLog("log-123", {
        isNonRideTask: "yes", // Invalid type
        isMultipleRides: null, // Invalid type
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isNonRideTask: false,
          isMultipleRides: false,
        }),
      );
    });

    it("does not update booleans if not provided", async () => {
      const { updateDoc, getDoc } = await import("../firestoreCore");

      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          startTs: Timestamp.now(),
          endTs: null,
        }),
      });

      await updateTimeLog("log-123", {
        note: "Updated note",
        // NO isNonRideTask or isMultipleRides
      });

      const updatePayload = updateDoc.mock.calls[0][1];
      expect(updatePayload).toHaveProperty("note", "Updated note");
      expect(updatePayload).not.toHaveProperty("isNonRideTask");
      expect(updatePayload).not.toHaveProperty("isMultipleRides");
    });

    it("updates both mode and boolean fields together", async () => {
      const { updateDoc, getDoc } = await import("../firestoreCore");

      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          startTs: Timestamp.now(),
          endTs: null,
        }),
      });

      await updateTimeLog("log-123", {
        mode: "N/A",
        isNonRideTask: true,
        isMultipleRides: false,
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          mode: "N/A",
          isNonRideTask: true,
          isMultipleRides: false,
        }),
      );
    });
  });

  describe("Data Model Consistency", () => {
    it("ensures mode matches boolean fields for non-ride tasks", async () => {
      const { addDoc } = await import("../firestoreCore");

      await logTime({
        driverKey: "test@example.com",
        mode: "N/A",
        isNonRideTask: true,
        isMultipleRides: false,
      });

      const payload = addDoc.mock.calls[0][1];
      expect(payload.mode).toBe("N/A");
      expect(payload.isNonRideTask).toBe(true);
      expect(payload.isMultipleRides).toBe(false);
    });

    it("ensures mode matches boolean fields for multi-ride", async () => {
      const { addDoc } = await import("../firestoreCore");

      await logTime({
        driverKey: "test@example.com",
        mode: "MULTI",
        isNonRideTask: false,
        isMultipleRides: true,
      });

      const payload = addDoc.mock.calls[0][1];
      expect(payload.mode).toBe("MULTI");
      expect(payload.isNonRideTask).toBe(false);
      expect(payload.isMultipleRides).toBe(true);
    });

    it("ensures mode matches boolean fields for regular ride", async () => {
      const { addDoc } = await import("../firestoreCore");

      await logTime({
        driverKey: "test@example.com",
        mode: "RIDE",
        rideId: "RIDE-001",
        isNonRideTask: false,
        isMultipleRides: false,
      });

      const payload = addDoc.mock.calls[0][1];
      expect(payload.mode).toBe("RIDE");
      expect(payload.isNonRideTask).toBe(false);
      expect(payload.isMultipleRides).toBe(false);
      expect(payload.rideId).toBe("RIDE-001");
    });
  });

  describe("Edge Cases", () => {
    it("handles undefined boolean fields gracefully", async () => {
      const { addDoc } = await import("../firestoreCore");

      await logTime({
        driverKey: "test@example.com",
        mode: "RIDE",
        isNonRideTask: undefined,
        isMultipleRides: undefined,
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isNonRideTask: false,
          isMultipleRides: false,
        }),
      );
    });

    it("handles null boolean fields gracefully", async () => {
      const { addDoc } = await import("../firestoreCore");

      await logTime({
        driverKey: "test@example.com",
        mode: "RIDE",
        isNonRideTask: null,
        isMultipleRides: null,
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isNonRideTask: false,
          isMultipleRides: false,
        }),
      );
    });

    it("normalizes legacy document with missing mode field", () => {
      const legacyDoc = {
        id: () => "legacy-2",
        data: () => ({
          driverKey: "old@example.com",
          // NO mode field
          rideId: "RIDE-001",
          startTs: Timestamp.now(),
        }),
      };

      const normalized = normalizeTimeLog(legacyDoc);

      expect(normalized.mode).toBeDefined(); // Should have default
      expect(normalized.isNonRideTask).toBe(false);
      expect(normalized.isMultipleRides).toBe(false);
    });
  });
});
