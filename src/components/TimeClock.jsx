import { useCallback, useEffect, useMemo, useState } from "react";
import { serverTimestamp } from "firebase/firestore";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { keyframes } from "@mui/system";
import {
  PlayArrow,
  Stop,
  InfoOutlined,
  Pause,
  Add,
  Close,
} from "@mui/icons-material";

import UniversalDataGrid from "@/components/datagrid/UniversalDataGrid";
import { useAuth } from "@/context/AuthContext.jsx";
import logError from "@/utils/logError.js";
import { logTime, subscribeTimeLogs, updateTimeLog } from "@/services/fs";
import {
  dayjs,
  toDayjs,
  formatDateTime,
  durationSafe,
  isActiveRow,
} from "@/utils/time";
import { getRowId as pickId } from "@/utils/timeLogMap";
import { timestampSortComparator } from "@/utils/timeUtils.js";
import ErrorBoundary from "@/components/feedback/ErrorBoundary.jsx";
import LoadingButtonLite from "@/components/inputs/LoadingButtonLite.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import { vibrateOk, vibrateWarn } from "@/utils/haptics.js";
import { useSmartTimeclockSuggestions } from "@/hooks/useSmartTimeclockSuggestions.js";

const greenGlow = (theme) => keyframes`
  0% {
    box-shadow: 0 0 5px ${alpha(theme.palette.success.main, 0.3)}, 0 0 10px ${alpha(theme.palette.success.main, 0.2)};
  }
  50% {
    box-shadow: 0 0 15px ${alpha(theme.palette.success.main, 0.6)}, 0 0 25px ${alpha(theme.palette.success.main, 0.4)};
  }
  100% {
    box-shadow: 0 0 5px ${alpha(theme.palette.success.main, 0.3)}, 0 0 10px ${alpha(theme.palette.success.main, 0.2)};
  }
`;

function NoSessionsOverlay() {
  return (
    <Stack
      height="100%"
      alignItems="center"
      justifyContent="center"
      spacing={1}
      sx={{ py: 2 }}
    >
      <Typography variant="body2" color="text.secondary">
        No sessions yet.
      </Typography>
    </Stack>
  );
}

export default function TimeClock({ setIsTracking }) {
  const { user, roleLoading } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rideId, setRideId] = useState("");
  const [nonRideTask, setNonRideTask] = useState(false);
  const [multiRide, setMultiRide] = useState(false);
  const [startBusy, setStartBusy] = useState(false);
  const [endBusy, setEndBusy] = useState(false);
  const [savingIds, setSavingIds] = useState([]);
  const [liveTime, setLiveTime] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [pausedAt, setPausedAt] = useState(null);
  const [totalPausedMs, setTotalPausedMs] = useState(0);
  const [tripIds, setTripIds] = useState([]);
  const [currentTripId, setCurrentTripId] = useState("");
  const [sessionNote, setSessionNote] = useState("");
  const { show: showSnack } = useSnack();

  // Calendar-smart suggestions
  const calendarSuggestions = useSmartTimeclockSuggestions({
    driverName: user?.displayName || "",
    driverEmail: user?.email || "",
    timezone: "America/Chicago",
  });

  const announce = useCallback((message) => {
    if (typeof window === "undefined") return;
    window.__LRP_LIVE_MSG__ = message || "";
    try {
      window.dispatchEvent(
        new CustomEvent("lrp:live-region", { detail: message || "" }),
      );
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[TimeClock] live region dispatch failed", error);
      }
    }
  }, []);

  const showSuccessSnack = useCallback(
    (message, options = {}) => {
      if (!message) return;
      vibrateOk();
      announce(message);
      showSnack(message, "success", options);
    },
    [announce, showSnack],
  );

  const showWarnOrErrorSnack = useCallback(
    (message, severity = "warning", options = {}) => {
      if (!message) return;
      vibrateWarn();
      announce(message);
      showSnack(message, severity, options);
    },
    [announce, showSnack],
  );

  const showInfoSnack = useCallback(
    (message, options = {}) => {
      if (!message) return;
      announce(message);
      showSnack(message, "info", options);
    },
    [announce, showSnack],
  );

  const driverQueryValues = useMemo(() => {
    if (!user) return [];
    const values = [];
    const seen = new Set();
    const push = (value) => {
      if (value == null) return;
      const str = String(value).trim();
      if (!str) return;
      if (seen.has(str)) return;
      seen.add(str);
      values.push(str);
    };

    push(user.uid);
    push(user.displayName);
    push(user.email);
    if (typeof user?.email === "string") {
      push(user.email.toLowerCase());
    }
    return values;
  }, [user]);

  const identityLookup = useMemo(() => {
    const set = new Set();
    driverQueryValues.forEach((value) => {
      const str = String(value).trim();
      if (!str) return;
      set.add(str.toLowerCase());
    });
    if (user?.uid) set.add(String(user.uid).toLowerCase());
    if (user?.email) set.add(String(user.email).toLowerCase());
    if (user?.displayName) set.add(String(user.displayName).toLowerCase());
    return set;
  }, [driverQueryValues, user]);

  useEffect(() => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeTimeLogs({
      key: driverQueryValues.length ? driverQueryValues : null,
      limit: 200,
      onData: (data) => {
        const baseRows = Array.isArray(data) ? data : [];
        const filtered = baseRows.filter((row) => {
          if (!row) return false;
          const candidates = [
            row.driverKey,
            row.driverId,
            row.userId,
            row.driver,
            row.driverName,
            row.driverEmail,
            row.userEmail,
          ];
          return candidates.some((candidate) => {
            if (candidate == null) return false;
            const str = String(candidate).trim().toLowerCase();
            return identityLookup.has(str);
          });
        });
        setRows(filtered);
        setLoading(false);
      },
      onError: (err) => {
        logError(err, { where: "TimeClock.subscribeTimeLogs" });
        setError("Failed to load time logs.");
        setLoading(false);
      },
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [driverQueryValues, identityLookup, user]);

  const activeRow = useMemo(
    () => rows.find((row) => isActiveRow(row)) || null,
    [rows],
  );

  useEffect(() => {
    if (typeof setIsTracking === "function") {
      setIsTracking(Boolean(activeRow));
    }
  }, [activeRow, setIsTracking]);

  useEffect(() => {
    const activeSession = rows.find((row) => isActiveRow(row));
    if (!activeSession) {
      setLiveTime("");
      return undefined;
    }

    const activeSince =
      activeSession.startTs ||
      activeSession.startTime ||
      activeSession.clockIn ||
      activeSession.loggedAt ||
      null;

    if (!activeSince) {
      setLiveTime("");
      return undefined;
    }

    // Inline formatLiveTime to avoid dependency
    const updateLiveTime = () => {
      const start = toDayjs(activeSince);
      const now = dayjs();
      if (!start || now.isBefore(start)) {
        setLiveTime("00:00:00");
        return;
      }

      let totalSeconds = now.diff(start, "second");

      // Account for paused time
      if (activeSession.isPaused && activeSession.pausedAt) {
        const pausedTime = toDayjs(activeSession.pausedAt);
        if (pausedTime) {
          totalSeconds = pausedTime.diff(start, "second");
        }
      }

      // Subtract previously accumulated paused time
      if (activeSession.totalPausedMs) {
        totalSeconds -= Math.floor(activeSession.totalPausedMs / 1000);
      }

      if (totalSeconds < 0) totalSeconds = 0;

      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setLiveTime(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      );
    };

    updateLiveTime();
    const t = setInterval(updateLiveTime, 1000);
    return () => clearInterval(t);
  }, [rows]);

  useEffect(() => {
    if (!activeRow) {
      setNonRideTask(false);
      setMultiRide(false);
      setRideId("");
      setIsPaused(false);
      setPausedAt(null);
      setTotalPausedMs(0);
      setTripIds([]);
      setCurrentTripId("");
      setSessionNote("");
      return;
    }
    const mode = activeRow?.mode || "RIDE";
    setNonRideTask(mode === "N/A");
    setMultiRide(mode === "MULTI");
    if (mode === "RIDE") {
      setRideId(activeRow?.rideId || "");
    } else {
      setRideId("");
    }

    // Load pause state
    setIsPaused(activeRow?.isPaused ?? false);
    setPausedAt(activeRow?.pausedAt ?? null);
    setTotalPausedMs(activeRow?.totalPausedMs ?? 0);

    // Load trip IDs for multi-ride
    setTripIds(activeRow?.tripIds ?? []);

    // Load session note
    setSessionNote(activeRow?.sessionNote ?? "");
  }, [activeRow]);

  const parseEditDate = useCallback((value) => {
    if (value == null) return null;
    if (value instanceof Date) {
      return Number.isFinite(value.getTime()) ? value : null;
    }
    if (dayjs.isDayjs?.(value)) {
      const asDate = value.toDate();
      return Number.isFinite(asDate?.getTime?.()) ? asDate : null;
    }
    const parsed = toDayjs(value);
    if (!parsed) return null;
    const asDate = parsed.toDate();
    return Number.isFinite(asDate?.getTime?.()) ? asDate : null;
  }, []);

  const hasDateChanged = useCallback((next, prev) => {
    if (!next && !prev) return false;
    if (!next || !prev) return true;
    return next.getTime() !== prev.getTime();
  }, []);

  const markSaving = useCallback((id, saving) => {
    if (!id) return;
    setSavingIds((prev) => {
      const exists = prev.includes(id);
      if (saving) {
        return exists ? prev : [...prev, id];
      }
      return exists ? prev.filter((item) => item !== id) : prev;
    });
  }, []);

  // Helper functions for inline column definitions
  const val = useCallback((obj, keys) => {
    const r = obj || {};
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return null;
  }, []);

  const isActive = useCallback(
    (row) => {
      const r = row || {};
      const start = val(r, ["startTime", "clockIn", "loggedAt"]);
      const end = val(r, ["endTime", "clockOut"]);
      return !!start && !end;
    },
    [val],
  );

  const duration = useCallback((startTs, endTs) => {
    const start = toDayjs(startTs);
    const end = endTs ? toDayjs(endTs) : dayjs();
    if (!start || !end || end.isBefore(start)) return "N/A";
    const mins = end.diff(start, "minute");
    if (mins < 1) return "<1 min";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
  }, []);

  // MUI DataGrid Pro v7 API: valueGetter/valueFormatter signature is (value, row, column, apiRef)
  const columns = useMemo(() => {
    // Inline column definitions - explicit for timeLogs collection
    const base = [
      {
        field: "driverName",
        headerName: "Driver",
        minWidth: 140,
        flex: 0.8,
        renderCell: (params) =>
          val(params?.row, ["driverName", "driverId", "driver"]) ?? "N/A",
        valueGetter: (value, row) =>
          val(row, ["driverName", "driverId", "driver"]) ?? "N/A",
      },
      {
        field: "driverEmail",
        headerName: "Driver Email",
        minWidth: 200,
        flex: 1,
        renderCell: (params) =>
          val(params?.row, ["driverEmail", "userEmail", "email"]) ?? "N/A",
        valueGetter: (value, row) =>
          val(row, ["driverEmail", "userEmail", "email"]) ?? "N/A",
      },
      {
        field: "rideId",
        headerName: "Ride ID",
        minWidth: 120,
        renderCell: (params) =>
          val(params?.row, ["rideId", "rideID", "ride"]) ?? "N/A",
        valueGetter: (value, row) =>
          val(row, ["rideId", "rideID", "ride"]) ?? "N/A",
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 110,
        sortable: false,
        renderCell: (params) =>
          isActive(params?.row) ? (
            <Chip
              size="small"
              label="Active"
              sx={{
                bgcolor: (t) => alpha(t.palette.primary.main, 0.18),
                color: (t) => t.palette.primary.main,
                border: (t) =>
                  `1px solid ${alpha(t.palette.primary.main, 0.35)}`,
              }}
            />
          ) : (
            <Chip
              size="small"
              label="Completed"
              sx={{ bgcolor: "action.selected", color: "text.primary" }}
            />
          ),
        valueGetter: (value, row) => (isActive(row) ? "Active" : "Completed"),
      },
      {
        field: "clockIn",
        headerName: "Clock In",
        minWidth: 180,
        renderCell: (params) => {
          const source = val(params?.row, ["startTime", "clockIn", "loggedAt"]);
          return source ? formatDateTime(source) : "N/A";
        },
        valueGetter: (value, row) =>
          val(row, ["startTime", "clockIn", "loggedAt"]) ?? null,
      },
      {
        field: "clockOut",
        headerName: "Clock Out",
        minWidth: 180,
        renderCell: (params) => {
          const source = val(params?.row, ["endTime", "clockOut"]);
          return source ? formatDateTime(source) : "—";
        },
        valueGetter: (value, row) => val(row, ["endTime", "clockOut"]) ?? null,
      },
      {
        field: "duration",
        headerName: "Duration",
        minWidth: 120,
        renderCell: (params) => {
          const r = params?.row;
          return duration(
            val(r, ["startTime", "clockIn", "loggedAt"]),
            val(r, ["endTime", "clockOut"]),
          );
        },
        valueGetter: (value, row) => {
          // Calculate raw duration in minutes for sorting
          const start = toDayjs(val(row, ["startTime", "clockIn", "loggedAt"]));
          const end = val(row, ["endTime", "clockOut"])
            ? toDayjs(val(row, ["endTime", "clockOut"]))
            : dayjs();
          if (!start || !end || end.isBefore(start)) return null;
          return end.diff(start, "minute"); // Return raw minutes for sorting
        },
      },
    ];

    return base.map((col) => {
      if (col.field === "clockIn") {
        return {
          ...col,
          type: "dateTime",
          editable: true,
          valueGetter: (value, row) => {
            const source =
              row?.startTime ?? row?.clockIn ?? row?.loggedAt ?? null;
            return parseEditDate(source);
          },
          valueFormatter: (value) => (value ? formatDateTime(value) : "N/A"),
          valueSetter: (params) => {
            const baseRow =
              params?.row && typeof params.row === "object" ? params.row : {};
            const next = { ...baseRow };
            const parsed = parseEditDate(params?.value ?? null);
            next.startTime = parsed;
            next.clockIn = parsed;
            return next;
          },
          sortComparator: (v1, v2, cellParams1, cellParams2) =>
            timestampSortComparator(
              cellParams1?.row?.startTime ??
                cellParams1?.row?.clockIn ??
                cellParams1?.row?.loggedAt ??
                null,
              cellParams2?.row?.startTime ??
                cellParams2?.row?.clockIn ??
                cellParams2?.row?.loggedAt ??
                null,
            ),
        };
      }
      if (col.field === "clockOut") {
        return {
          ...col,
          type: "dateTime",
          editable: true,
          valueGetter: (value, row) => {
            const source = row?.endTime ?? row?.clockOut ?? null;
            return parseEditDate(source);
          },
          valueFormatter: (value) => (value ? formatDateTime(value) : "—"),
          valueSetter: (params) => {
            const baseRow =
              params?.row && typeof params.row === "object" ? params.row : {};
            const next = { ...baseRow };
            const parsed = parseEditDate(params?.value ?? null);
            next.endTime = parsed;
            next.clockOut = parsed;
            return next;
          },
          sortComparator: (v1, v2, cellParams1, cellParams2) =>
            timestampSortComparator(
              cellParams1?.row?.endTime ?? cellParams1?.row?.clockOut ?? null,
              cellParams2?.row?.endTime ?? cellParams2?.row?.clockOut ?? null,
            ),
        };
      }
      return col;
    });
  }, [parseEditDate, val, isActive, duration]);
  const baseRowId = useCallback(
    (row) => row?.id || row?.docId || row?._id || null,
    [],
  );

  const resolveRowId = useCallback(
    (row) => {
      const candidate = baseRowId(row) || pickId(row);
      if (candidate) return candidate;
      const email = row?.driverEmail || row?.userEmail || "driver";
      const startKey = row?.startTime?.seconds ?? row?.startTime ?? "start";
      return `${email}-${startKey}`;
    },
    [baseRowId],
  );

  const isCellEditable = useCallback(
    (params) => {
      if (!params?.row) return false;
      if (loading) return false;
      if (params.field !== "clockIn" && params.field !== "clockOut") {
        return false;
      }
      const id = resolveRowId(params.row);
      if (!id) return false;
      return !savingIds.includes(id);
    },
    [loading, resolveRowId, savingIds],
  );

  const applyLocalUpdate = useCallback(
    (id, updater) => {
      setRows((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        let changed = false;
        const next = prev.map((row) => {
          const rowId = resolveRowId(row);
          if (rowId !== id) return row;
          changed = true;
          return typeof updater === "function" ? updater(row) : updater;
        });
        return changed ? next : prev;
      });
    },
    [resolveRowId],
  );

  const handleProcessRowUpdate = useCallback(
    async (newRow, oldRow) => {
      const id = resolveRowId(newRow) || resolveRowId(oldRow);
      if (!id) return oldRow;

      const newStart = parseEditDate(
        newRow?.startTime ?? newRow?.clockIn ?? newRow?.loggedAt ?? null,
      );
      const prevStart = parseEditDate(
        oldRow?.startTime ?? oldRow?.clockIn ?? oldRow?.loggedAt ?? null,
      );
      const newEnd = parseEditDate(newRow?.endTime ?? newRow?.clockOut ?? null);
      const prevEnd = parseEditDate(
        oldRow?.endTime ?? oldRow?.clockOut ?? null,
      );

      const startChanged = hasDateChanged(newStart, prevStart);
      const endChanged = hasDateChanged(newEnd, prevEnd);

      if (!startChanged && !endChanged) {
        return oldRow;
      }

      markSaving(id, true);

      const updates = {};
      if (startChanged) updates.startTime = newStart;
      if (endChanged) updates.endTime = newEnd;

      try {
        await updateTimeLog(id, updates);

        const nextRow = {
          ...oldRow,
          ...newRow,
          startTime: startChanged ? newStart : (oldRow.startTime ?? null),
          clockIn: startChanged ? newStart : (oldRow.clockIn ?? null),
          endTime: endChanged ? newEnd : (oldRow.endTime ?? null),
          clockOut: endChanged ? newEnd : (oldRow.clockOut ?? null),
        };

        nextRow.id = resolveRowId(oldRow) || id;
        if (oldRow?.docId) nextRow.docId = oldRow.docId;
        if (oldRow?.originalId) nextRow.originalId = oldRow.originalId;

        const durationMs = durationSafe(newStart, newEnd);
        nextRow.duration =
          durationMs > 0 ? Math.floor(durationMs / 60000) : null;

        applyLocalUpdate(id, nextRow);

        showInfoSnack("Time log updated.");

        return nextRow;
      } catch (err) {
        logError(err, { where: "TimeClock.processRowUpdate", id });
        showWarnOrErrorSnack("Failed to update time log.", "error");
        return oldRow;
      } finally {
        markSaving(id, false);
      }
    },
    [
      applyLocalUpdate,
      hasDateChanged,
      markSaving,
      parseEditDate,
      resolveRowId,
      showInfoSnack,
      showWarnOrErrorSnack,
    ],
  );

  const active = activeRow || null;
  const activeSince = active
    ? active.startTs ||
      active.startTime ||
      active.clockIn ||
      active.loggedAt ||
      null
    : null;

  // Pause/Resume handlers
  const handlePauseResume = useCallback(async () => {
    if (!activeRow) return;
    const id = pickId(activeRow);
    if (!id) return;

    try {
      if (isPaused) {
        // Resume
        const pauseDuration = pausedAt
          ? dayjs().diff(toDayjs(pausedAt), "millisecond")
          : 0;
        const newTotalPausedMs = (totalPausedMs || 0) + pauseDuration;

        await updateTimeLog(id, {
          isPaused: false,
          pausedAt: null,
          totalPausedMs: newTotalPausedMs,
        });

        setIsPaused(false);
        setPausedAt(null);
        setTotalPausedMs(newTotalPausedMs);
        showSuccessSnack("Timer resumed");
      } else {
        // Pause
        await updateTimeLog(id, {
          isPaused: true,
          pausedAt: serverTimestamp(),
        });

        setIsPaused(true);
        setPausedAt(new Date());
        showInfoSnack("Timer paused");
      }
    } catch (err) {
      logError(err, { where: "TimeClock.handlePauseResume", id });
      showWarnOrErrorSnack("Failed to pause/resume timer", "error");
    }
  }, [
    activeRow,
    isPaused,
    pausedAt,
    totalPausedMs,
    showSuccessSnack,
    showInfoSnack,
    showWarnOrErrorSnack,
  ]);

  // Multi-ride trip management
  const handleAddTrip = useCallback(async () => {
    if (!currentTripId.trim() || !activeRow) return;

    const id = pickId(activeRow);
    if (!id) return;

    const newTrip = {
      id: currentTripId.trim().toUpperCase(),
      addedAt: new Date().toISOString(),
    };

    const updatedTripIds = [...tripIds, newTrip];

    try {
      await updateTimeLog(id, {
        tripIds: updatedTripIds,
      });

      setTripIds(updatedTripIds);
      setCurrentTripId("");
      showSuccessSnack(`Added trip ${newTrip.id}`);
    } catch (err) {
      logError(err, { where: "TimeClock.handleAddTrip", id });
      showWarnOrErrorSnack("Failed to add trip", "error");
    }
  }, [
    currentTripId,
    tripIds,
    activeRow,
    showSuccessSnack,
    showWarnOrErrorSnack,
  ]);

  const handleRemoveTrip = useCallback(
    async (tripId) => {
      if (!activeRow) return;

      const id = pickId(activeRow);
      if (!id) return;

      const updatedTripIds = tripIds.filter((t) => t.id !== tripId);

      try {
        await updateTimeLog(id, {
          tripIds: updatedTripIds,
        });

        setTripIds(updatedTripIds);
        showSuccessSnack(`Removed trip ${tripId}`);
      } catch (err) {
        logError(err, { where: "TimeClock.handleRemoveTrip", id });
        showWarnOrErrorSnack("Failed to remove trip", "error");
      }
    },
    [tripIds, activeRow, showSuccessSnack, showWarnOrErrorSnack],
  );

  const handleStart = useCallback(async () => {
    if (!user) {
      showWarnOrErrorSnack(
        "You must be signed in to start a session.",
        "warning",
      );
      return;
    }
    if (!nonRideTask && !multiRide && !rideId.trim()) {
      showWarnOrErrorSnack("Enter a Ride ID or choose a task type.", "warning");
      return;
    }
    if (startBusy || endBusy || activeRow) return;

    const trimmed = rideId.trim().toUpperCase();
    const mode = nonRideTask ? "N/A" : multiRide ? "MULTI" : "RIDE";

    setStartBusy(true);
    try {
      const uid = user?.uid ? String(user.uid).trim() : "";
      const emailRaw =
        typeof user?.email === "string" ? String(user.email).trim() : "";
      const emailNormalized = emailRaw ? emailRaw.toLowerCase() : null;
      const driverKey =
        uid ||
        emailNormalized ||
        (emailRaw ? emailRaw : "") ||
        (user?.displayName ? String(user.displayName).trim() : "") ||
        "unknown";
      const rideValue = mode === "RIDE" ? trimmed || "N/A" : "N/A";
      const driverName =
        user?.displayName ||
        emailRaw ||
        (emailNormalized ? emailNormalized.split("@")[0] : "Unknown");

      await logTime({
        driverKey,
        driverId: uid || null,
        userId: uid || driverKey || null,
        driverName,
        driverEmail: emailNormalized,
        userEmail: emailNormalized,
        rideId: rideValue,
        mode,
        isNonRideTask: nonRideTask,
        isMultipleRides: multiRide,
        sessionNote: sessionNote || null,
        tripIds: [],
        isPaused: false,
        pausedAt: null,
        totalPausedMs: 0,
        startTs: serverTimestamp(),
        status: "open",
      });
      setRideId("");
      showSuccessSnack("Clocked in");
    } catch (err) {
      logError(err, { where: "TimeClock.startTimeLog" });
      showWarnOrErrorSnack("Failed to start session.", "error");
    } finally {
      setStartBusy(false);
    }
  }, [
    activeRow,
    endBusy,
    multiRide,
    nonRideTask,
    rideId,
    sessionNote,
    showSuccessSnack,
    showWarnOrErrorSnack,
    startBusy,
    user,
  ]);

  const handleClockOutSafe = useCallback(async () => {
    if (!activeRow || endBusy) return;
    const id = resolveRowId(activeRow);
    if (!id) {
      showWarnOrErrorSnack("Missing time log identifier.", "error");
      return;
    }
    setEndBusy(true);
    try {
      const startReference =
        activeRow.startTs ||
        activeRow.startTime ||
        activeRow.clockIn ||
        activeRow.loggedAt ||
        null;
      const driverKey =
        (activeRow.driverKey && String(activeRow.driverKey).trim()) ||
        (activeRow.driverId && String(activeRow.driverId).trim()) ||
        (activeRow.userId && String(activeRow.userId).trim()) ||
        (user?.uid && String(user.uid).trim()) ||
        (user?.email && String(user.email).trim().toLowerCase()) ||
        null;
      await logTime({
        id,
        driverKey: driverKey || undefined,
        driverId: activeRow.driverId ?? activeRow.userId ?? user?.uid ?? null,
        userId: activeRow.userId ?? activeRow.driverId ?? user?.uid ?? null,
        driverName: activeRow.driverName ?? user?.displayName ?? null,
        driverEmail:
          activeRow.driverEmail ??
          activeRow.userEmail ??
          (typeof user?.email === "string" ? user.email.toLowerCase() : null),
        userEmail:
          activeRow.userEmail ??
          activeRow.driverEmail ??
          (typeof user?.email === "string" ? user.email.toLowerCase() : null),
        rideId: activeRow.rideId ?? "N/A",
        mode: activeRow.mode ?? (activeRow.rideId ? "RIDE" : "N/A"),
        isNonRideTask: activeRow.isNonRideTask ?? nonRideTask ?? false,
        isMultipleRides: activeRow.isMultipleRides ?? multiRide ?? false,
        sessionNote: activeRow.sessionNote ?? sessionNote ?? null,
        tripIds: activeRow.tripIds ?? tripIds ?? [],
        isPaused: false,
        pausedAt: null,
        totalPausedMs: activeRow.totalPausedMs ?? totalPausedMs ?? 0,
        startTs: startReference ?? serverTimestamp(),
        endTs: serverTimestamp(),
        status: "closed",
      });
      showSuccessSnack("Clocked out");
    } catch (err) {
      logError(err, { where: "TimeClock.endTimeLog", id });
      showWarnOrErrorSnack("Failed to end session.", "error");
    } finally {
      setEndBusy(false);
    }
  }, [
    activeRow,
    endBusy,
    multiRide,
    nonRideTask,
    resolveRowId,
    sessionNote,
    showSuccessSnack,
    showWarnOrErrorSnack,
    totalPausedMs,
    tripIds,
    user?.displayName,
    user?.email,
    user?.uid,
  ]);

  if (roleLoading) {
    return (
      <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <ErrorBoundary>
      <Stack spacing={2} sx={{ width: "100%" }}>
        <Card>
          <CardContent
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <Stack spacing={0.5}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                ⏰ Time Clock
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start a session to begin tracking your time.
              </Typography>
            </Stack>

            <Box
              sx={(theme) => ({
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                alignItems: { xs: "stretch", sm: "center" },
                justifyContent: "space-between",
                bgcolor: active
                  ? alpha(theme.palette.success.main, 0.08)
                  : alpha(theme.palette.primary.main, 0.08),
                border: active
                  ? `2px solid ${alpha(theme.palette.success.main, 0.5)}`
                  : `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                borderRadius: 2,
                px: 2,
                py: 1.5,
                mb: 2,
                animation: active ? `${greenGlow(theme)} 2s infinite` : "none",
              })}
            >
              {active ? (
                <>
                  <Stack spacing={0.5} sx={{ flex: 1 }}>
                    <Typography
                      variant="body2"
                      sx={(theme) => ({
                        color: theme.palette.success.main,
                        fontWeight: 500,
                        fontSize: "0.875rem",
                      })}
                    >
                      Active Session
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary", fontSize: "0.75rem" }}
                    >
                      Started {formatDateTime(activeSince)}
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: { xs: "center", sm: "flex-end" },
                      mt: { xs: 1, sm: 0 },
                    }}
                  >
                    <Typography
                      variant="h4"
                      sx={(theme) => ({
                        color: theme.palette.success.main,
                        fontWeight: 700,
                        fontFamily: "monospace",
                        letterSpacing: "0.1em",
                      })}
                      aria-live="polite"
                      aria-atomic="true"
                      role="timer"
                    >
                      {liveTime || "00:00:00"}
                    </Typography>
                  </Box>
                </>
              ) : (
                <Typography variant="body1" sx={{ color: "text.secondary" }}>
                  No active session
                </Typography>
              )}
            </Box>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <TextField
                label="Ride ID"
                value={rideId}
                onChange={(event) => setRideId(event.target.value)}
                disabled={Boolean(activeRow) || nonRideTask || multiRide}
                size="small"
              />

              {/* Calendar-Smart Suggestions for Single Ride */}
              {!activeRow &&
                !nonRideTask &&
                !multiRide &&
                calendarSuggestions.message && (
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: (theme) => alpha(theme.palette.info.main, 0.08),
                      border: (theme) =>
                        `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                    }}
                  >
                    <Stack spacing={1}>
                      <Typography
                        variant="caption"
                        color="info.main"
                        sx={{ fontWeight: 600 }}
                      >
                        📅 Today&apos;s Schedule
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {calendarSuggestions.message}
                      </Typography>

                      {/* Show current ride suggestion */}
                      {calendarSuggestions.currentRide && (
                        <Box
                          sx={{
                            p: 1,
                            borderRadius: 1,
                            bgcolor: (theme) =>
                              alpha(theme.palette.success.main, 0.1),
                            border: (theme) =>
                              `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="success.main"
                            sx={{ fontWeight: 600 }}
                          >
                            🚗 Active Now
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{ mt: 0.5 }}
                          >
                            <Chip
                              label={calendarSuggestions.currentRide.tripId}
                              size="small"
                              color="success"
                              sx={{ fontWeight: 600 }}
                            />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {calendarSuggestions.currentRide.passengerName}
                            </Typography>
                          </Stack>
                          <LoadingButtonLite
                            variant="contained"
                            color="success"
                            size="small"
                            onClick={() =>
                              setRideId(calendarSuggestions.currentRide.tripId)
                            }
                            sx={{ mt: 1, width: "100%" }}
                          >
                            Start This Ride
                          </LoadingButtonLite>
                        </Box>
                      )}

                      {/* Show upcoming rides */}
                      {!calendarSuggestions.currentRide &&
                        calendarSuggestions.upcomingRides.length > 0 && (
                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ mb: 0.5, display: "block" }}
                            >
                              Upcoming Rides
                            </Typography>
                            <Stack spacing={0.5}>
                              {calendarSuggestions.upcomingRides
                                .slice(0, 3)
                                .map((ride) => (
                                  <Box
                                    key={ride.tripId}
                                    sx={{
                                      p: 1,
                                      borderRadius: 1,
                                      bgcolor: (theme) =>
                                        alpha(
                                          theme.palette.background.paper,
                                          0.5,
                                        ),
                                      border: (theme) =>
                                        `1px solid ${theme.palette.divider}`,
                                      cursor: "pointer",
                                      "&:hover": {
                                        bgcolor: (theme) =>
                                          alpha(
                                            theme.palette.primary.main,
                                            0.08,
                                          ),
                                      },
                                    }}
                                    onClick={() => setRideId(ride.tripId)}
                                  >
                                    <Stack
                                      direction="row"
                                      spacing={1}
                                      alignItems="center"
                                      justifyContent="space-between"
                                    >
                                      <Stack spacing={0.25} sx={{ flex: 1 }}>
                                        <Stack
                                          direction="row"
                                          spacing={1}
                                          alignItems="center"
                                        >
                                          <Chip
                                            label={ride.tripId}
                                            size="small"
                                            sx={{ fontWeight: 600 }}
                                          />
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                          >
                                            {dayjs(ride.startTime).format(
                                              "h:mm A",
                                            )}
                                          </Typography>
                                        </Stack>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          {ride.passengerName}
                                        </Typography>
                                      </Stack>
                                    </Stack>
                                  </Box>
                                ))}
                            </Stack>
                          </Box>
                        )}
                    </Stack>
                  </Box>
                )}

              {/* Calendar-Smart Suggestions for Multiple Rides */}
              {multiRide &&
                activeRow &&
                calendarSuggestions.suggestedTripIds.length > 0 && (
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: (theme) =>
                        alpha(theme.palette.warning.main, 0.08),
                      border: (theme) =>
                        `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                    }}
                  >
                    <Stack spacing={1}>
                      <Typography
                        variant="caption"
                        color="warning.main"
                        sx={{ fontWeight: 600 }}
                      >
                        📅 Today&apos;s Scheduled Trips
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Click to add trip IDs from your calendar
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ flexWrap: "wrap", gap: 0.5 }}
                      >
                        {calendarSuggestions.suggestedTripIds.map((tripId) => {
                          const alreadyAdded = tripIds.some(
                            (t) => t.id === tripId,
                          );
                          return (
                            <Chip
                              key={tripId}
                              label={tripId}
                              size="small"
                              onClick={async () => {
                                if (!alreadyAdded && activeRow) {
                                  const id = pickId(activeRow);
                                  if (!id) return;

                                  const newTrip = {
                                    id: tripId.trim().toUpperCase(),
                                    addedAt: new Date().toISOString(),
                                  };

                                  const updatedTripIds = [...tripIds, newTrip];

                                  try {
                                    await updateTimeLog(id, {
                                      tripIds: updatedTripIds,
                                    });

                                    setTripIds(updatedTripIds);
                                    showSuccessSnack(
                                      `Added trip ${newTrip.id}`,
                                    );
                                  } catch (err) {
                                    logError(err, {
                                      where: "TimeClock.quickAddTrip",
                                      id,
                                    });
                                    showWarnOrErrorSnack(
                                      "Failed to add trip",
                                      "error",
                                    );
                                  }
                                }
                              }}
                              disabled={alreadyAdded}
                              sx={{
                                cursor: alreadyAdded ? "default" : "pointer",
                                bgcolor: (theme) =>
                                  alreadyAdded
                                    ? alpha(theme.palette.success.main, 0.12)
                                    : alpha(theme.palette.warning.main, 0.12),
                                color: (theme) =>
                                  alreadyAdded
                                    ? theme.palette.success.main
                                    : theme.palette.warning.main,
                                "&:hover": alreadyAdded
                                  ? {}
                                  : {
                                      bgcolor: (theme) =>
                                        alpha(theme.palette.warning.main, 0.2),
                                    },
                              }}
                            />
                          );
                        })}
                      </Stack>
                    </Stack>
                  </Box>
                )}

              {/* Warning if tracking unscheduled trip */}
              {!activeRow &&
                rideId.trim() &&
                !nonRideTask &&
                !multiRide &&
                !calendarSuggestions.loading &&
                !calendarSuggestions.checkTripScheduled(rideId) && (
                  <Alert severity="warning" sx={{ fontSize: "0.875rem" }}>
                    Trip ID <strong>{rideId.trim().toUpperCase()}</strong> is
                    not on today&apos;s calendar
                  </Alert>
                )}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  sx={{
                    bgcolor: (t) => alpha(t.palette.info.main, 0.05),
                    borderRadius: 1,
                    px: 1,
                    py: 0.5,
                  }}
                >
                  <Checkbox
                    checked={nonRideTask}
                    onChange={(event) => {
                      setNonRideTask(event.target.checked);
                      if (event.target.checked) {
                        setMultiRide(false);
                        setRideId("");
                      }
                    }}
                    disabled={Boolean(activeRow)}
                    size="small"
                    inputProps={{ "aria-label": "Non-ride task" }}
                  />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    Non-Ride Task
                  </Typography>
                  <Tooltip
                    title="Check this for administrative work, meetings, or other non-ride activities"
                    arrow
                    placement="top"
                  >
                    <IconButton
                      size="small"
                      aria-label="Non-ride task information"
                    >
                      <InfoOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  sx={{
                    bgcolor: (t) => alpha(t.palette.info.main, 0.05),
                    borderRadius: 1,
                    px: 1,
                    py: 0.5,
                  }}
                >
                  <Checkbox
                    checked={multiRide}
                    onChange={(event) => {
                      setMultiRide(event.target.checked);
                      if (event.target.checked) {
                        setNonRideTask(false);
                        setRideId("");
                      }
                    }}
                    disabled={Boolean(activeRow)}
                    size="small"
                    inputProps={{ "aria-label": "Multiple rides" }}
                  />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    Multiple Rides
                  </Typography>
                  <Tooltip
                    title="Check this when handling multiple rides in a single session"
                    arrow
                    placement="top"
                  >
                    <IconButton
                      size="small"
                      aria-label="Multiple rides information"
                    >
                      <InfoOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>

              {/* Session Notes */}
              <TextField
                label="Session Notes (optional)"
                value={sessionNote}
                onChange={(event) => setSessionNote(event.target.value)}
                multiline
                rows={2}
                size="small"
                placeholder="Add notes about this session..."
                sx={{ mt: 1 }}
              />

              {/* Multi-Ride Trip Management */}
              {multiRide && activeRow && (
                <Box sx={{ mt: 1 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 0.5, display: "block" }}
                  >
                    Trip IDs ({tripIds.length})
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <TextField
                      size="small"
                      value={currentTripId}
                      onChange={(e) => setCurrentTripId(e.target.value)}
                      placeholder="Enter Trip ID"
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTrip();
                        }
                      }}
                      sx={{ flex: 1 }}
                    />
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={handleAddTrip}
                      disabled={!currentTripId.trim()}
                      aria-label="Add trip"
                    >
                      <Add />
                    </IconButton>
                  </Stack>
                  {tripIds.length > 0 && (
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ flexWrap: "wrap", gap: 0.5 }}
                    >
                      {tripIds.map((trip) => (
                        <Chip
                          key={trip.id}
                          label={trip.id}
                          size="small"
                          onDelete={() => handleRemoveTrip(trip.id)}
                          deleteIcon={<Close />}
                        />
                      ))}
                    </Stack>
                  )}
                </Box>
              )}

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ mt: 1 }}
              >
                <LoadingButtonLite
                  variant="contained"
                  color="primary"
                  startIcon={<PlayArrow />}
                  onClick={handleStart}
                  disabled={Boolean(activeRow)}
                  loading={startBusy}
                  loadingText="Starting…"
                >
                  Start
                </LoadingButtonLite>
                <LoadingButtonLite
                  variant="outlined"
                  color="warning"
                  startIcon={isPaused ? <PlayArrow /> : <Pause />}
                  onClick={handlePauseResume}
                  disabled={!activeRow}
                >
                  {isPaused ? "Resume" : "Pause"}
                </LoadingButtonLite>
                <LoadingButtonLite
                  variant="outlined"
                  color="inherit"
                  startIcon={<Stop />}
                  onClick={handleClockOutSafe}
                  disabled={!activeRow}
                  loading={endBusy}
                  loadingText="Stopping…"
                >
                  Stop
                </LoadingButtonLite>
              </Stack>
            </Box>
          </CardContent>
        </Card>

        <Box sx={{ width: "100%" }}>
          <UniversalDataGrid
            id="time-clock-grid"
            autoHeight
            rows={Array.isArray(rows) ? rows : []}
            columns={columns}
            getRowId={resolveRowId}
            loading={loading}
            density="compact"
            disableRowSelectionOnClick
            isCellEditable={isCellEditable}
            processRowUpdate={handleProcessRowUpdate}
            editMode="row"
            slots={{ noRowsOverlay: NoSessionsOverlay }}
            slotProps={{
              toolbar: {
                quickFilterPlaceholder: "Search sessions",
              },
            }}
            sx={{
              borderRadius: 2,
              backgroundColor: (theme) => theme.palette.background.paper,
              "& .MuiDataGrid-columnHeaders": {
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              },
            }}
          />
        </Box>
      </Stack>
    </ErrorBoundary>
  );
}
