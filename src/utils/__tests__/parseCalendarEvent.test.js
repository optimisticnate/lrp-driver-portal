/**
 * Unit tests for Calendar Event Parser
 */

import { describe, it, expect } from "vitest";

import {
  parseCalendarEvent,
  filterEventsByDriver,
  extractTripIds,
  findEventByTripId,
  isTripScheduled,
} from "../parseCalendarEvent.js";

describe("parseCalendarEvent", () => {
  it("parses complete event with all fields", () => {
    const event = {
      id: "event-123",
      summary: "Trip for Erika H with LRPBus",
      description: `Driver: Jeremy Imler
Passenger: Erika Harden
Vehicle: LRPBus - Limo Bus
Conf No: T9XX-DV
Pick Up Location: 123 Main St
Drop Off Location: 456 Oak Ave`,
      start: { dateTime: "2025-11-02T10:00:00Z" },
      end: { dateTime: "2025-11-02T11:00:00Z" },
    };

    const result = parseCalendarEvent(event);

    expect(result).toEqual({
      tripId: "T9XX-DV",
      driverName: "Jeremy Imler",
      passengerName: "Erika Harden",
      vehicle: "LRPBus - Limo Bus",
      pickupLocation: "123 Main St",
      dropoffLocation: "456 Oak Ave",
      startTime: "2025-11-02T10:00:00Z",
      endTime: "2025-11-02T11:00:00Z",
      summary: "Trip for Erika H with LRPBus",
      description: event.description,
      eventId: "event-123",
    });
  });

  it("handles missing fields gracefully", () => {
    const event = {
      id: "event-456",
      summary: "Trip",
      description: "Driver: John Doe",
      start: { dateTime: "2025-11-02T10:00:00Z" },
      end: { dateTime: "2025-11-02T11:00:00Z" },
    };

    const result = parseCalendarEvent(event);

    expect(result.driverName).toBe("John Doe");
    expect(result.tripId).toBeNull();
    expect(result.passengerName).toBeNull();
    expect(result.vehicle).toBeNull();
  });

  it("handles null event", () => {
    const result = parseCalendarEvent(null);
    expect(result).toBeNull();
  });

  it("handles event with no description", () => {
    const event = {
      id: "event-789",
      summary: "Trip",
      start: { dateTime: "2025-11-02T10:00:00Z" },
      end: { dateTime: "2025-11-02T11:00:00Z" },
    };

    const result = parseCalendarEvent(event);

    expect(result).not.toBeNull();
    expect(result.driverName).toBeNull();
    expect(result.tripId).toBeNull();
  });

  it("matches case-insensitive field names", () => {
    const event = {
      description: `driver: john doe
conf no: ABC-123
passenger: jane smith`,
      start: { dateTime: "2025-11-02T10:00:00Z" },
      end: { dateTime: "2025-11-02T11:00:00Z" },
    };

    const result = parseCalendarEvent(event);

    expect(result.driverName).toBe("john doe");
    expect(result.tripId).toBe("ABC-123");
    expect(result.passengerName).toBe("jane smith");
  });
});

describe("filterEventsByDriver", () => {
  const events = [
    {
      description: "Driver: Jeremy Imler\nConf No: T1",
      start: { dateTime: "2025-11-02T10:00:00Z" },
      end: { dateTime: "2025-11-02T11:00:00Z" },
    },
    {
      description: "Driver: Sarah Driver\nConf No: T2",
      start: { dateTime: "2025-11-02T12:00:00Z" },
      end: { dateTime: "2025-11-02T13:00:00Z" },
    },
    {
      description: "Driver: Jeremy Imler\nConf No: T3",
      start: { dateTime: "2025-11-02T14:00:00Z" },
      end: { dateTime: "2025-11-02T15:00:00Z" },
    },
  ];

  it("filters events by driver name", () => {
    const result = filterEventsByDriver(events, "Jeremy Imler");
    expect(result).toHaveLength(2);
    expect(result[0].tripId).toBe("T1");
    expect(result[1].tripId).toBe("T3");
  });

  it("matches partial driver name", () => {
    const result = filterEventsByDriver(events, "Jeremy");
    expect(result).toHaveLength(2);
  });

  it("is case-insensitive", () => {
    const result = filterEventsByDriver(events, "jeremy imler");
    expect(result).toHaveLength(2);
  });

  it("returns empty array for no matches", () => {
    const result = filterEventsByDriver(events, "Unknown Driver");
    expect(result).toEqual([]);
  });

  it("handles null events array", () => {
    const result = filterEventsByDriver(null, "Jeremy");
    expect(result).toEqual([]);
  });

  it("handles empty driver name", () => {
    const result = filterEventsByDriver(events, "");
    expect(result).toEqual([]);
  });
});

describe("extractTripIds", () => {
  const events = [
    {
      description: "Conf No: T1",
      start: { dateTime: "2025-11-02T10:00:00Z" },
      end: { dateTime: "2025-11-02T11:00:00Z" },
    },
    {
      description: "Conf No: T2",
      start: { dateTime: "2025-11-02T12:00:00Z" },
      end: { dateTime: "2025-11-02T13:00:00Z" },
    },
    {
      description: "No trip ID here",
      start: { dateTime: "2025-11-02T14:00:00Z" },
      end: { dateTime: "2025-11-02T15:00:00Z" },
    },
    {
      description: "Conf No: T1", // Duplicate
      start: { dateTime: "2025-11-02T16:00:00Z" },
      end: { dateTime: "2025-11-02T17:00:00Z" },
    },
  ];

  it("extracts unique trip IDs", () => {
    const result = extractTripIds(events);
    expect(result).toEqual(["T1", "T2"]);
  });

  it("normalizes trip IDs to uppercase", () => {
    const eventsLowerCase = [
      {
        description: "Conf No: t1",
        start: { dateTime: "2025-11-02T10:00:00Z" },
        end: { dateTime: "2025-11-02T11:00:00Z" },
      },
    ];
    const result = extractTripIds(eventsLowerCase);
    expect(result).toEqual(["T1"]);
  });

  it("handles null events array", () => {
    const result = extractTripIds(null);
    expect(result).toEqual([]);
  });

  it("handles empty events array", () => {
    const result = extractTripIds([]);
    expect(result).toEqual([]);
  });
});

describe("findEventByTripId", () => {
  const events = [
    {
      description: "Conf No: T1\nDriver: Jeremy",
      start: { dateTime: "2025-11-02T10:00:00Z" },
      end: { dateTime: "2025-11-02T11:00:00Z" },
    },
    {
      description: "Conf No: T2\nDriver: Sarah",
      start: { dateTime: "2025-11-02T12:00:00Z" },
      end: { dateTime: "2025-11-02T13:00:00Z" },
    },
  ];

  it("finds event by trip ID", () => {
    const result = findEventByTripId(events, "T1");
    expect(result).not.toBeNull();
    expect(result.tripId).toBe("T1");
    expect(result.driverName).toBe("Jeremy");
  });

  it("is case-insensitive", () => {
    const result = findEventByTripId(events, "t1");
    expect(result).not.toBeNull();
    expect(result.tripId).toBe("T1");
  });

  it("returns null for non-existent trip ID", () => {
    const result = findEventByTripId(events, "T999");
    expect(result).toBeNull();
  });

  it("handles null events array", () => {
    const result = findEventByTripId(null, "T1");
    expect(result).toBeNull();
  });

  it("handles empty trip ID", () => {
    const result = findEventByTripId(events, "");
    expect(result).toBeNull();
  });
});

describe("isTripScheduled", () => {
  const events = [
    {
      description: "Conf No: T1",
      start: { dateTime: "2025-11-02T10:00:00Z" },
      end: { dateTime: "2025-11-02T11:00:00Z" },
    },
    {
      description: "Conf No: T2",
      start: { dateTime: "2025-11-02T12:00:00Z" },
      end: { dateTime: "2025-11-02T13:00:00Z" },
    },
  ];

  it("returns true for scheduled trip", () => {
    expect(isTripScheduled(events, "T1")).toBe(true);
    expect(isTripScheduled(events, "T2")).toBe(true);
  });

  it("returns false for non-scheduled trip", () => {
    expect(isTripScheduled(events, "T999")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isTripScheduled(events, "t1")).toBe(true);
  });

  it("handles empty trip ID", () => {
    expect(isTripScheduled(events, "")).toBe(false);
  });
});
