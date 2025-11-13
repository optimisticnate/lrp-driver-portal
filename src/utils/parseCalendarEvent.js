/**
 * Calendar Event Parser
 *
 * Extracts structured data from Google Calendar event descriptions.
 *
 * Expected format in event.description:
 * ```
 * Driver: Jeremy Imler
 * Passenger: Erika Harden
 * Vehicle: LRPBus - Limo Bus
 * Conf No: T9XX-DV
 * Pick Up Location: ...
 * Drop Off Location: ...
 * ```
 */

/**
 * Parses a Google Calendar event and extracts trip metadata
 *
 * @param {Object} event - Calendar event object
 * @param {string} event.description - Event description with trip details
 * @param {Object} event.start - Event start time
 * @param {Object} event.end - Event end time
 * @param {string} event.summary - Event summary/title
 * @returns {Object} Parsed trip metadata
 */
export function parseCalendarEvent(event) {
  if (!event) {
    return null;
  }

  const description =
    typeof event.description === "string" ? event.description : "";
  const summary = typeof event.summary === "string" ? event.summary : "";

  // Extract Driver: [Name]
  const driverMatch = description.match(/Driver:\s*([^\n]+)/i);
  const driverName = driverMatch?.[1]?.trim() || null;

  // Extract Conf No: [Trip ID] (this is the key field!)
  const confMatch = description.match(/Conf\s+No:\s*([^\n]+)/i);
  const tripId = confMatch?.[1]?.trim() || null;

  // Extract Passenger: [Name]
  const passengerMatch = description.match(/Passenger:\s*([^\n]+)/i);
  const passengerName = passengerMatch?.[1]?.trim() || null;

  // Extract Vehicle: [Name]
  const vehicleMatch = description.match(/Vehicle:\s*([^\n]+)/i);
  const vehicle = vehicleMatch?.[1]?.trim() || null;

  // Extract Pick Up Location
  const pickupMatch = description.match(/Pick\s+Up\s+Location:\s*([^\n]+)/i);
  const pickupLocation = pickupMatch?.[1]?.trim() || null;

  // Extract Drop Off Location
  const dropoffMatch = description.match(/Drop\s+Off\s+Location:\s*([^\n]+)/i);
  const dropoffLocation = dropoffMatch?.[1]?.trim() || null;

  // Extract times from event start/end
  const startTime = event.start?.dateTime || event.start?.date || null;
  const endTime = event.end?.dateTime || event.end?.date || null;

  return {
    // Core fields
    tripId,
    driverName,
    passengerName,
    vehicle,

    // Location fields
    pickupLocation,
    dropoffLocation,

    // Time fields
    startTime,
    endTime,

    // Original event data
    summary,
    description,
    eventId: event.id || null,
  };
}

/**
 * Filters events for a specific driver by name matching
 *
 * @param {Array} events - Array of calendar events
 * @param {string} driverName - Driver name to filter by (case-insensitive)
 * @returns {Array} Parsed events assigned to the driver
 */
export function filterEventsByDriver(events, driverName) {
  if (!Array.isArray(events) || !driverName) {
    return [];
  }

  const normalizedDriverName = driverName.toLowerCase().trim();

  return events
    .map((event) => parseCalendarEvent(event))
    .filter((parsed) => {
      if (!parsed || !parsed.driverName) {
        return false;
      }
      return parsed.driverName.toLowerCase().includes(normalizedDriverName);
    });
}

/**
 * Extracts all unique trip IDs from events
 *
 * @param {Array} events - Array of calendar events
 * @returns {Array} Array of unique trip IDs
 */
export function extractTripIds(events) {
  if (!Array.isArray(events)) {
    return [];
  }

  const tripIds = events
    .map((event) => parseCalendarEvent(event)?.tripId)
    .filter(Boolean)
    .map((id) => id.toUpperCase());

  // Remove duplicates
  return [...new Set(tripIds)];
}

/**
 * Finds a calendar event by trip ID
 *
 * @param {Array} events - Array of calendar events
 * @param {string} tripId - Trip ID to search for
 * @returns {Object|null} Parsed event or null
 */
export function findEventByTripId(events, tripId) {
  if (!Array.isArray(events) || !tripId) {
    return null;
  }

  const normalizedTripId = tripId.trim().toUpperCase();

  const event = events.find((event) => {
    const parsed = parseCalendarEvent(event);
    return parsed?.tripId?.toUpperCase() === normalizedTripId;
  });

  return event ? parseCalendarEvent(event) : null;
}

/**
 * Checks if a trip ID exists in today's calendar
 *
 * @param {Array} events - Array of calendar events
 * @param {string} tripId - Trip ID to check
 * @returns {boolean} True if trip ID found
 */
export function isTripScheduled(events, tripId) {
  return findEventByTripId(events, tripId) !== null;
}
