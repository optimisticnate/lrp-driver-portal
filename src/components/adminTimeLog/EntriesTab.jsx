/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useState, useCallback } from "react";
import { Box, Paper, CircularProgress, TextField, Chip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers-pro";
import { useGridApiRef } from "@mui/x-data-grid-pro";
import { writeBatch, doc } from "firebase/firestore";

import useMediaQuery from "@/hooks/useMediaQuery";
import logError from "@/utils/logError.js";
import AppError from "@/utils/AppError.js";
import ConfirmBulkDeleteDialog from "@/components/datagrid/bulkDelete/ConfirmBulkDeleteDialog.jsx";
import useBulkDelete from "@/components/datagrid/bulkDelete/useBulkDelete.jsx";
import { EmptyState, ErrorState } from "@/components/feedback/SectionState.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import {
  formatDateTime,
  formatClockOutOrDash,
  toDayjs,
  durationSafe,
  dayjs,
} from "@/utils/time";
import { timestampSortComparator } from "@/utils/timeUtils.js";
import { deleteTimeLog, subscribeTimeLogs, updateTimeLog } from "@/services/fs";
import UniversalDataGrid from "@/components/datagrid/UniversalDataGrid";

import { db } from "../../utils/firebaseInit";
import { enrichDriverNames } from "../../services/normalizers";
import { buildRowEditActionsColumn } from "../../columns/rowEditActions.jsx";

export default function EntriesTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [driverFilter, setDriverFilter] = useState("");
  const [startFilter, setStartFilter] = useState(null); // dayjs | null
  const [endFilter, setEndFilter] = useState(null); // dayjs | null
  const [search, setSearch] = useState("");
  const apiRef = useGridApiRef();
  const [rowModesModel, setRowModesModel] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const { show: showSnack } = useSnack();

  const getRowId = useCallback((row) => {
    const id = row?.id || row?.docId || row?._id;
    if (id) return id;
    // Fallback: create unique ID from row data to prevent null
    const email = row?.driverEmail || row?.userEmail || "unknown";
    const startKey = row?.startTime?.seconds ?? row?.startTime ?? Date.now();
    return `${email}-${startKey}`;
  }, []);

  const toDateSafe = useCallback((value) => {
    if (value == null) return null;
    if (value instanceof Date) {
      return Number.isFinite(value.getTime()) ? value : null;
    }
    const parsed = toDayjs(value);
    if (!parsed) return null;
    const asDate = parsed.toDate();
    return Number.isFinite(asDate?.getTime?.()) ? asDate : null;
  }, []);

  const handleDelete = useCallback(
    async (row) => {
      const id = getRowId(row);
      if (!id) return;
      try {
        await deleteTimeLog(id);
        showSnack("Time log deleted", "success");
      } catch (e) {
        logError(e, `EntriesTab.delete:${id}`);
        showSnack("Failed to delete time log", "error");
      }
    },
    [getRowId, showSnack],
  );

  const handleProcessRowUpdate = useCallback(
    async (newRow, oldRow) => {
      const id = getRowId(newRow);
      if (!id) return oldRow;

      // Build update payload (let the service convert Dates->Timestamp)
      const driverName =
        typeof newRow.driverName === "string" && newRow.driverName.trim() !== ""
          ? newRow.driverName
          : (newRow.driver ?? null);

      // Parse timestamps - always include both for proper duration calculation
      const parsedStart = toDateSafe(newRow.startTime ?? oldRow.startTime);
      const parsedEnd = toDateSafe(newRow.endTime ?? oldRow.endTime);

      const updates = {
        driver: driverName ?? null,
        driverName: driverName ?? null,
        rideId: newRow.rideId ?? null,
        startTime: parsedStart ?? null,
        endTime: parsedEnd ?? null,
      };

      try {
        await updateTimeLog(id, updates);

        // Calculate duration from the parsed timestamps
        const durationMs = durationSafe(parsedStart, parsedEnd);
        const duration = durationMs > 0 ? Math.floor(durationMs / 60000) : 0;

        return {
          ...newRow,
          startTime: parsedStart,
          endTime: parsedEnd,
          duration,
          driverName: driverName ?? newRow.driverName,
        };
      } catch (e) {
        logError(e, `EntriesTab.processRowUpdate:${id}`);
        showSnack("Failed to update time log", "error");
        return oldRow;
      }
    },
    [getRowId, showSnack, toDateSafe],
  );

  const actionsColumn = useMemo(
    () =>
      buildRowEditActionsColumn({
        apiRef,
        rowModesModel,
        setRowModesModel,
        onDelete: async (_id, row) => handleDelete(row),
      }),
    [apiRef, rowModesModel, handleDelete],
  );

  // Helper functions
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

  // Inline column definitions - explicit for timeLogs collection
  const baseColumns = useMemo(() => {
    return [
      {
        field: "driverName",
        headerName: "Driver",
        minWidth: 140,
        flex: 0.8,
        editable: true,
        renderCell: (params) =>
          val(params?.row, ["driverName", "driverId", "driver"]) ?? "N/A",
        valueGetter: (value, row) =>
          val(row, ["driverName", "driverId", "driver"]) ?? "N/A",
        valueSetter: (params) => {
          if (!params?.row) return params?.row || {};
          const next = { ...params.row };
          next.driverName = params.value ?? "";
          next.driver = params.value ?? null;
          return next;
        },
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
        editable: true,
        renderCell: (params) =>
          val(params?.row, ["rideId", "rideID", "ride"]) ?? "N/A",
        valueGetter: (value, row) =>
          val(row, ["rideId", "rideID", "ride"]) ?? "N/A",
        valueSetter: (params) => {
          if (!params?.row) return params?.row || {};
          const next = { ...params.row };
          next.rideId = params.value ?? null;
          return next;
        },
      },
      {
        field: "taskType",
        headerName: "Task Type",
        minWidth: 140,
        renderCell: (params) => {
          const row = params?.row;
          if (row?.isNonRideTask) {
            return (
              <Chip
                size="small"
                label="Non-Ride Task"
                sx={{
                  bgcolor: (t) => alpha(t.palette.info.main, 0.12),
                  color: (t) => t.palette.info.main,
                }}
              />
            );
          }
          if (row?.isMultipleRides) {
            return (
              <Chip
                size="small"
                label="Multiple Rides"
                sx={{
                  bgcolor: (t) => alpha(t.palette.warning.main, 0.12),
                  color: (t) => t.palette.warning.main,
                }}
              />
            );
          }
          return (
            <Chip
              size="small"
              label="Single Ride"
              sx={{ bgcolor: "action.selected", color: "text.secondary" }}
            />
          );
        },
        valueGetter: (value, row) => {
          if (row?.isNonRideTask) return "Non-Ride Task";
          if (row?.isMultipleRides) return "Multiple Rides";
          return "Single Ride";
        },
      },
      {
        field: "tripIds",
        headerName: "Trip IDs",
        minWidth: 140,
        renderCell: (params) => {
          const tripIds = params?.row?.tripIds;
          if (!Array.isArray(tripIds) || tripIds.length === 0) return "—";
          return (
            <Box
              sx={{
                display: "flex",
                gap: 0.5,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {tripIds.slice(0, 3).map((trip) => (
                <Chip
                  key={trip.id}
                  label={trip.id}
                  size="small"
                  sx={{ fontSize: "0.7rem", height: "20px" }}
                />
              ))}
              {tripIds.length > 3 && (
                <Chip
                  label={`+${tripIds.length - 3}`}
                  size="small"
                  sx={{ fontSize: "0.7rem", height: "20px" }}
                />
              )}
            </Box>
          );
        },
        valueGetter: (value, row) => {
          const tripIds = row?.tripIds;
          if (!Array.isArray(tripIds) || tripIds.length === 0) return "";
          return tripIds.map((t) => t.id).join(", ");
        },
      },
      {
        field: "sessionNote",
        headerName: "Session Notes",
        minWidth: 180,
        flex: 0.8,
        renderCell: (params) => {
          const note = params?.row?.sessionNote;
          if (!note) return "—";
          return (
            <Box
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={note}
            >
              {note}
            </Box>
          );
        },
        valueGetter: (value, row) => row?.sessionNote || "",
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
        type: "dateTime",
        editable: true,
        renderCell: (params) => {
          const source = val(params?.row, ["startTime", "clockIn", "loggedAt"]);
          return source ? formatDateTime(source) : "N/A";
        },
        valueGetter: (value, row) =>
          toDateSafe(val(row, ["startTime", "clockIn", "loggedAt"])),
        valueFormatter: (value) => (value ? formatDateTime(value) : "N/A"),
        valueSetter: (params) => {
          if (!params?.row) return params?.row || {};
          const next = { ...params.row };
          next.startTime = toDateSafe(params.value) ?? null;
          return next;
        },
        sortComparator: (v1, v2, cellParams1, cellParams2) =>
          timestampSortComparator(
            cellParams1?.row?.startTime,
            cellParams2?.row?.startTime,
          ),
      },
      {
        field: "clockOut",
        headerName: "Clock Out",
        minWidth: 180,
        type: "dateTime",
        editable: true,
        renderCell: (params) => {
          const source = val(params?.row, ["endTime", "clockOut"]);
          return source ? formatDateTime(source) : "—";
        },
        valueGetter: (value, row) =>
          toDateSafe(val(row, ["endTime", "clockOut"])),
        valueFormatter: (value) => (value ? formatClockOutOrDash(value) : "—"),
        valueSetter: (params) => {
          if (!params?.row) return params?.row || {};
          const next = { ...params.row };
          next.endTime = toDateSafe(params.value) ?? null;
          return next;
        },
        sortComparator: (v1, v2, cellParams1, cellParams2) =>
          timestampSortComparator(
            cellParams1?.row?.endTime,
            cellParams2?.row?.endTime,
          ),
      },
      {
        field: "pausedTime",
        headerName: "Paused Time",
        minWidth: 120,
        renderCell: (params) => {
          const pausedMs = params?.row?.totalPausedMs;
          if (!pausedMs || pausedMs === 0) return "—";
          const mins = Math.floor(pausedMs / 60000);
          if (mins < 1) return "<1 min";
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          return h ? `${h}h ${m}m` : `${m}m`;
        },
        valueGetter: (value, row) => {
          const pausedMs = row?.totalPausedMs;
          if (!pausedMs || pausedMs === 0) return 0;
          return Math.floor(pausedMs / 60000); // Return minutes for sorting
        },
      },
      {
        field: "duration",
        headerName: "Duration",
        minWidth: 120,
        renderCell: (params) => {
          const r = params?.row;
          const start = toDayjs(val(r, ["startTime", "clockIn", "loggedAt"]));
          const end = val(r, ["endTime", "clockOut"])
            ? toDayjs(val(r, ["endTime", "clockOut"]))
            : dayjs();
          if (!start || !end || end.isBefore(start)) return "N/A";

          // Calculate total duration and subtract paused time
          let mins = end.diff(start, "minute");
          const pausedMs = r?.totalPausedMs || 0;
          const pausedMins = Math.floor(pausedMs / 60000);
          mins = Math.max(0, mins - pausedMins);

          if (mins < 1) return "<1 min";
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          return h ? `${h}h ${m}m` : `${m}m`;
        },
        valueGetter: (value, row) => {
          // Calculate raw duration in minutes for sorting
          const start = toDayjs(val(row, ["startTime", "clockIn", "loggedAt"]));
          const end = val(row, ["endTime", "clockOut"])
            ? toDayjs(val(row, ["endTime", "clockOut"]))
            : dayjs();
          if (!start || !end || end.isBefore(start)) return null;

          // Subtract paused time from total duration
          const mins = end.diff(start, "minute");
          const pausedMs = row?.totalPausedMs || 0;
          const pausedMins = Math.floor(pausedMs / 60000);
          return Math.max(0, mins - pausedMins); // Return raw minutes for sorting
        },
      },
    ];
  }, [val, isActive, toDateSafe]);

  // All column logic is inline above - use baseColumns directly
  const columns = baseColumns;

  const gridColumns = useMemo(
    () => [...columns, actionsColumn],
    [actionsColumn, columns],
  );

  const handleRowEditStart = useCallback((params, event) => {
    event.defaultMuiPrevented = true;
  }, []);
  const handleRowEditStop = useCallback((params, event) => {
    event.defaultMuiPrevented = true;
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsub = subscribeTimeLogs({
      limit: 500,
      onData: async (logs) => {
        try {
          const mapped = (logs || []).map((d) => ({
            id: d.id ?? d.docId ?? d._id ?? Math.random().toString(36).slice(2),
            ...d,
          }));
          const withNames = await enrichDriverNames(mapped);
          const withDates = withNames.map((r) => ({
            ...r,
            startTime: toDateSafe(r.startTime),
            endTime: toDateSafe(r.endTime),
            loggedAt: toDateSafe(r.loggedAt),
          }));
          setRows(withDates);
          setError(null);
        } catch (e) {
          logError(e, "EntriesTab.subscribeTimeLogs.enrich");
          setError("Failed to enrich driver names.");
        } finally {
          setLoading(false);
        }
      },
      onError: (err) => {
        setError(err?.message || "Failed to load time logs.");
        setLoading(false);
      },
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [refreshKey, toDateSafe]);

  const filteredRows = useMemo(() => {
    const startBound = startFilter?.toDate?.() ?? null;
    const endBound = endFilter?.toDate?.() ?? null;

    return (rows || []).filter((r) => {
      const driverNeedle = driverFilter
        ? driverFilter.toLowerCase().trim()
        : "";

      const driverHaystack = [];
      if (typeof r?._searchText === "string" && r._searchText) {
        driverHaystack.push(r._searchText.toLowerCase());
      }
      [r.driverName, r.driver, r.driverId, r.driverEmail, r.userEmail, r.rideId]
        .filter((value) => value != null && value !== "")
        .forEach((value) => driverHaystack.push(String(value).toLowerCase()));

      const driverMatch = driverNeedle
        ? driverHaystack.some((segment) => segment.includes(driverNeedle))
        : true;

      const s = toDateSafe(r.startTime);
      const e = toDateSafe(r.endTime) ?? s;

      const startMatch = startBound
        ? s && s.getTime() >= startBound.getTime()
        : true;
      const endMatch = endBound ? e && e.getTime() <= endBound.getTime() : true;

      const tokens = [
        r._searchText,
        r.driverName ?? r.driver ?? r.driverId ?? r.driverEmail,
        r.rideId,
        formatDateTime(s),
        formatDateTime(e),
        r.duration ?? r.minutes ?? Math.round((r.durationMs || 0) / 60000),
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());

      const searchMatch = search
        ? tokens.some((t) => t.includes(search.toLowerCase()))
        : true;

      return driverMatch && startMatch && endMatch && searchMatch;
    });
  }, [rows, driverFilter, startFilter, endFilter, search, toDateSafe]);

  const safeRows = useMemo(
    () =>
      (filteredRows || []).filter(Boolean).map((r) => {
        const s = toDateSafe(r.startTime);
        const e = toDateSafe(r.endTime);
        let duration =
          r.duration ?? r.minutes ?? Math.round((r.durationMs || 0) / 60000);
        if ((duration == null || Number.isNaN(duration)) && s && e) {
          const diffMs = durationSafe(s, e);
          duration = diffMs > 0 ? Math.floor(diffMs / 60000) : 0;
        }
        // Subtract paused time from duration
        const pausedMs = r.totalPausedMs || 0;
        const pausedMins = Math.floor(pausedMs / 60000);
        duration = Math.max(0, duration - pausedMins);

        if (!Number.isFinite(duration) || duration < 0) {
          duration = 0;
        }
        return { ...r, duration };
      }),
    [filteredRows, toDateSafe],
  );

  const gridInitialState = useMemo(
    () => ({
      pagination: { paginationModel: { pageSize: 15, page: 0 } },
      columns: {
        columnVisibilityModel: isMobile
          ? {
              // Hide extra columns on mobile to save space
              driverEmail: false,
              taskType: false,
              tripIds: false,
              sessionNote: false,
              pausedTime: false,
            }
          : {
              // Show all columns on desktop by default
              driverEmail: true,
              taskType: true,
              tripIds: true,
              sessionNote: true,
              pausedTime: true,
            },
      },
    }),
    [isMobile],
  );

  const performDelete = useCallback(async (ids) => {
    const backoff = (a) => new Promise((res) => setTimeout(res, 2 ** a * 100));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => batch.delete(doc(db, "timeLogs", id)));
        await batch.commit();
        return;
      } catch (err) {
        if (attempt === 2) {
          logError(err, { where: "EntriesTab", action: "bulkDelete" });
          throw new AppError(
            err.message || "Bulk delete failed",
            "FIRESTORE_DELETE",
            { collection: "timeLogs" },
          );
        }
        await backoff(attempt);
      }
    }
  }, []);

  const performRestore = useCallback(async (rowsToRestore) => {
    const backoff = (a) => new Promise((res) => setTimeout(res, 2 ** a * 100));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const batch = writeBatch(db);
        rowsToRestore.forEach((r) => {
          if (!r) return;
          const { id, ...rest } = r;
          batch.set(doc(db, "timeLogs", id), rest);
        });
        await batch.commit();
        return;
      } catch (err) {
        if (attempt === 2) {
          logError(err, { where: "EntriesTab", action: "bulkRestore" });
        } else {
          await backoff(attempt);
        }
      }
    }
  }, []);

  const {
    dialogOpen,
    deleting,
    openDialog: _openDialog,
    closeDialog,
    onConfirm,
  } = useBulkDelete({ performDelete, performRestore });

  // Bulk delete disabled - checkbox selection removed
  // const handleBulkDelete = useCallback(
  //   async (ids) => {
  //     const rows = ids
  //       .map((id) => apiRef.current?.getRow?.(id))
  //       .filter(Boolean);
  //     openDialog(ids, rows);
  //   },
  //   [apiRef, openDialog],
  // );

  const sampleRows = useMemo(() => {
    // Checkbox selection removed - no sample rows
    return [];
  }, []);

  if (loading) {
    return (
      <Paper
        sx={{
          width: "100%",
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <CircularProgress size={24} />
      </Paper>
    );
  }
  if (error) {
    return (
      <Paper
        sx={{
          width: "100%",
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <ErrorState
          description={error}
          onAction={() => {
            setError(null);
            setLoading(true);
            setRefreshKey((key) => key + 1);
          }}
        />
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        width: "100%",
        p: 1,
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        gap: 1,
      }}
    >
      <Box
        sx={{
          display: "flex",
          gap: { xs: 1, sm: 2 },
          flexWrap: "wrap",
          "& > *": {
            flex: { xs: "1 1 calc(50% - 4px)", sm: "0 1 auto" },
            minWidth: { xs: "calc(50% - 4px)", sm: "140px" },
          },
        }}
      >
        <TextField
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
        />
        <TextField
          label="Driver"
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          size="small"
        />
        <DatePicker
          label="Start after"
          value={startFilter}
          onChange={(v) => setStartFilter(v)}
          slotProps={{ textField: { size: "small" } }}
        />
        <DatePicker
          label="End before"
          value={endFilter}
          onChange={(v) => setEndFilter(v)}
          slotProps={{ textField: { size: "small" } }}
        />
      </Box>
      <Paper
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
        }}
      >
        {safeRows.length === 0 ? (
          <EmptyState
            title="No time logs"
            description="Time logs will appear here after drivers clock in."
          />
        ) : (
          <UniversalDataGrid
            id="admin-timelog-entries"
            rows={safeRows}
            columns={gridColumns}
            loading={loading}
            rowModesModel={rowModesModel}
            onRowModesModelChange={(m) => setRowModesModel(m)}
            processRowUpdate={handleProcessRowUpdate}
            onProcessRowUpdateError={(e) =>
              logError(e, "EntriesTab.processRowUpdateError")
            }
            onRowEditStart={handleRowEditStart}
            onRowEditStop={handleRowEditStop}
            apiRef={apiRef}
            initialState={gridInitialState}
            pageSizeOptions={[15, 30, 60, 100]}
            slotProps={{
              toolbar: {
                quickFilterPlaceholder: "Search logs",
              },
            }}
            density="compact"
            autoHeight={false}
            sx={{ flex: 1, minHeight: 0 }}
            getRowId={getRowId}
          />
        )}
        <ConfirmBulkDeleteDialog
          open={dialogOpen}
          total={0}
          deleting={deleting}
          onClose={closeDialog}
          onConfirm={onConfirm}
          sampleRows={sampleRows}
        />
      </Paper>
    </Paper>
  );
}
