/* Proprietary and confidential. See LICENSE. */
// src/columns/timeLogColumns.js
import { vfTime, vfDurationHM } from "../utils/vf";

import { buildNativeActionsColumn } from "./nativeActions.jsx";

const FALLBACK_TEXT = "N/A";

const objectTextKeys = [
  "displayName",
  "name",
  "label",
  "text",
  "value",
  "email",
  "title",
  "note",
  "message",
  "body",
];

function pickRowValue(row, keys = []) {
  if (!row || typeof row !== "object") return undefined;
  for (const key of keys) {
    if (!key) continue;
    const value = row[key];
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function coerceText(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(value) : null;
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => coerceText(item)).filter(Boolean);
    return items.length > 0 ? items.join(", ") : null;
  }
  if (typeof value === "object") {
    for (const key of objectTextKeys) {
      const nested = coerceText(value[key]);
      if (nested) return nested;
    }
  }
  return null;
}

function pickText(row, keys = []) {
  const direct = pickRowValue(row, keys);
  const text = coerceText(direct);
  return text ?? FALLBACK_TEXT;
}

function isTimestampLike(value) {
  if (!value) return false;
  if (value instanceof Date) return true;
  if (typeof value === "number" && Number.isFinite(value)) return true;
  if (typeof value === "object") {
    if (
      typeof value.toDate === "function" ||
      typeof value.toMillis === "function"
    ) {
      return true;
    }
    const seconds = Number(value.seconds);
    const nanoseconds = Number(value.nanoseconds);
    if (Number.isFinite(seconds) || Number.isFinite(nanoseconds)) {
      return true;
    }
    if (typeof value.isValid === "function") {
      try {
        if (value.isValid()) return true;
      } catch (error) {
        void error;
      }
    }
  }
  return false;
}

function pickTimestamp(row, keys = []) {
  const candidate = pickRowValue(row, keys);
  return isTimestampLike(candidate) ? candidate : null;
}

function pickNumber(row, keys = []) {
  const candidate = pickRowValue(row, keys);
  if (candidate === null || candidate === undefined) return null;
  const numeric = Number(candidate);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * timeLogs doc shape:
 * driverName, driverEmail, rideId, clockIn, clockOut, durationMins, loggedAt, note?
 */
export function timeLogColumns(opts = {}) {
  const { withActions = false, onEdit, onDelete } = opts;

  const columns = [
    {
      field: "driverName",
      headerName: "Driver",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (_value, row) =>
        pickText(row, [
          "driverName",
          "driverDisplay",
          "driver",
          "name",
          "displayName",
        ]),
    },
    {
      field: "driverEmail",
      headerName: "Driver Email",
      minWidth: 220,
      flex: 1,
      valueGetter: (_value, row) =>
        pickText(row, ["driverEmail", "email", "userEmail", "driver"]),
    },
    {
      field: "rideId",
      headerName: "Ride ID",
      minWidth: 120,
      flex: 0.5,
      valueGetter: (_value, row) =>
        pickText(row, ["rideId", "rideID", "tripId", "TripID", "id"]),
    },
    {
      field: "clockIn",
      headerName: "Clock In",
      minWidth: 170,
      flex: 0.8,
      valueGetter: (_value, row) =>
        pickTimestamp(row, [
          "clockIn",
          "clockInAt",
          "startTime",
          "start",
          "startedAt",
        ]),
      valueFormatter: vfTime,
      sortComparator: (v1, v2, p1, p2) =>
        (p1?.row?.clockIn?.seconds ?? -1) - (p2?.row?.clockIn?.seconds ?? -1),
    },
    {
      field: "clockOut",
      headerName: "Clock Out",
      minWidth: 170,
      flex: 0.8,
      valueGetter: (_value, row) =>
        pickTimestamp(row, [
          "clockOut",
          "clockOutAt",
          "endTime",
          "end",
          "endedAt",
        ]),
      valueFormatter: vfTime,
      sortComparator: (v1, v2, p1, p2) =>
        (p1?.row?.clockOut?.seconds ?? -1) - (p2?.row?.clockOut?.seconds ?? -1),
    },
    {
      field: "durationMins",
      headerName: "Duration",
      minWidth: 130,
      flex: 0.6,
      valueGetter: (_value, row) =>
        pickNumber(row, [
          "durationMins",
          "durationMin",
          "duration",
          "durationMinutes",
        ]),
      valueFormatter: vfDurationHM,
    },
    {
      field: "loggedAt",
      headerName: "Logged At",
      minWidth: 170,
      flex: 0.8,
      valueGetter: (_value, row) =>
        pickTimestamp(row, ["loggedAt", "createdAt", "clockIn", "startTime"]),
      valueFormatter: vfTime,
    },
    {
      field: "note",
      headerName: "Note",
      minWidth: 240,
      flex: 1.2,
      valueGetter: (_value, row) =>
        pickText(row, ["note", "notes", "logNote", "message", "body"]),
    },
  ];

  if (withActions) columns.push(buildNativeActionsColumn({ onEdit, onDelete }));

  return columns;
}
