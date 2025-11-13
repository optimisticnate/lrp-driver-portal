/**
 * Smart Timeclock Suggestions Hook
 *
 * Integrates calendar events with TimeClock to provide intelligent suggestions:
 * - Auto-suggests trip IDs from today's scheduled rides
 * - Shows driver's upcoming rides
 * - Validates trip IDs against calendar
 * - Provides quick-start buttons for scheduled trips
 */

import { useMemo } from "react";

import dayjs from "@/utils/dayjsSetup.js";
import { useCalendarEvents } from "@/hooks/useCalendarEvents.js";
import {
  parseCalendarEvent,
  filterEventsByDriver,
  findEventByTripId,
  isTripScheduled,
} from "@/utils/parseCalendarEvent.js";

/**
 * Hook for fetching calendar-based TimeClock suggestions
 *
 * @param {Object} options - Configuration options
 * @param {string} options.driverName - Current driver's name (from user.displayName)
 * @param {string} options.driverEmail - Current driver's email (from user.email)
 * @param {string} [options.timezone="America/Chicago"] - Timezone
 * @param {Array} [options.vehicles=["ALL"]] - Vehicle filter (default: all)
 * @returns {Object} Smart suggestions for TimeClock
 */
export function useSmartTimeclockSuggestions({
  driverName,
  driverEmail,
  timezone = "America/Chicago",
  vehicles = ["ALL"],
}) {
  // Fetch today's calendar events
  const dateISO = dayjs().tz(timezone).format("YYYY-MM-DD");
  const { events, loading, error, refetch } = useCalendarEvents(
    dateISO,
    { vehicles },
    timezone,
  );

  // Parse and filter events for current driver
  const driverEvents = useMemo(() => {
    if (!driverName || !Array.isArray(events)) {
      return [];
    }

    // Try matching by displayName first (returns parsed events)
    let filtered = filterEventsByDriver(events, driverName);

    // If no matches and we have email, try matching by email in description
    if (filtered.length === 0 && driverEmail) {
      const rawFiltered = events.filter((event) => {
        const description = event?.description || "";
        return description.toLowerCase().includes(driverEmail.toLowerCase());
      });
      // Parse the raw events from email filter
      filtered = rawFiltered
        .map((event) => parseCalendarEvent(event))
        .filter(Boolean);
    }

    return filtered;
  }, [events, driverName, driverEmail]);

  // Extract trip IDs from driver's events
  const suggestedTripIds = useMemo(() => {
    return driverEvents
      .map((event) => event.tripId)
      .filter(Boolean)
      .map((tripId) => tripId.trim().toUpperCase());
  }, [driverEvents]);

  // Get upcoming rides (future start times)
  const upcomingRides = useMemo(() => {
    const now = dayjs();
    return driverEvents
      .filter((event) => {
        if (!event.startTime) return false;
        const startTime = dayjs(event.startTime);
        return startTime.isAfter(now);
      })
      .sort((a, b) => {
        const aTime = dayjs(a.startTime);
        const bTime = dayjs(b.startTime);
        return aTime.diff(bTime);
      });
  }, [driverEvents]);

  // Get current/active ride (started but not ended)
  const currentRide = useMemo(() => {
    const now = dayjs();
    return driverEvents.find((event) => {
      if (!event.startTime || !event.endTime) return false;
      const startTime = dayjs(event.startTime);
      const endTime = dayjs(event.endTime);
      return now.isAfter(startTime) && now.isBefore(endTime);
    });
  }, [driverEvents]);

  // Check if a trip ID is scheduled
  const checkTripScheduled = useMemo(() => {
    return (tripId) => {
      if (!tripId) return false;
      return isTripScheduled(events, tripId);
    };
  }, [events]);

  // Find event by trip ID
  const getEventByTripId = useMemo(() => {
    return (tripId) => {
      return findEventByTripId(events, tripId);
    };
  }, [events]);

  // Summary stats
  const stats = useMemo(() => {
    const total = driverEvents.length;
    const completed = driverEvents.filter((event) => {
      if (!event.endTime) return false;
      return dayjs(event.endTime).isBefore(dayjs());
    }).length;
    const upcoming = upcomingRides.length;
    const active = currentRide ? 1 : 0;

    return {
      total,
      completed,
      upcoming,
      active,
    };
  }, [driverEvents, upcomingRides, currentRide]);

  // Generate smart message for UI
  const message = useMemo(() => {
    if (loading) return "Loading calendar...";
    if (error) return null;
    if (driverEvents.length === 0) {
      return "No rides scheduled for today";
    }

    const { total, completed, upcoming, active } = stats;

    if (active) {
      return `You have 1 active ride and ${upcoming} upcoming ${upcoming === 1 ? "ride" : "rides"}`;
    }

    if (upcoming > 0) {
      return `You have ${upcoming} upcoming ${upcoming === 1 ? "ride" : "rides"} today`;
    }

    if (completed > 0) {
      return `You completed ${completed} ${completed === 1 ? "ride" : "rides"} today`;
    }

    return `You have ${total} ${total === 1 ? "ride" : "rides"} scheduled today`;
  }, [loading, error, driverEvents.length, stats]);

  return {
    // Data
    events: driverEvents,
    suggestedTripIds,
    upcomingRides,
    currentRide,
    stats,

    // Functions
    checkTripScheduled,
    getEventByTripId,

    // UI helpers
    message,
    loading,
    error,
    refetch,

    // Raw data (for debugging)
    allEvents: events,
  };
}
