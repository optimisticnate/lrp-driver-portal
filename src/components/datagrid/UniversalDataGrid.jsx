/* Proprietary and confidential. See LICENSE. */
import { useMemo, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import { DataGridPro } from "@mui/x-data-grid-pro";
import { alpha } from "@mui/material/styles";

import logError from "@/utils/logError.js";
import { generateDeterministicId } from "@/utils/gridIdUtils.js";

import LrpGridToolbar from "./LrpGridToolbar.jsx";
import SafeGridFooter from "./SafeGridFooter.jsx";
import { NoRowsOverlay, ErrorOverlay } from "./DefaultGridOverlays.jsx";

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

// CRITICAL: Clean ALL grid localStorage IMMEDIATELY on module load
// This runs before React renders, preventing MUI from loading corrupted state
if (isBrowser()) {
  try {
    const keys = Object.keys(window.localStorage);
    keys.forEach((key) => {
      if (key.startsWith("lrp:grid:")) {
        try {
          const raw = window.localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (
              parsed &&
              typeof parsed === "object" &&
              "rowSelection" in parsed
            ) {
              delete parsed.rowSelection;
              window.localStorage.setItem(key, JSON.stringify(parsed));
            }
          }
        } catch {
          // If corrupted, remove entirely
          window.localStorage.removeItem(key);
        }
      }
    });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Force cleanup of any corrupted grid state in localStorage
 * This fixes "R.ids is not iterable" errors from malformed rowSelection
 */
function forceCleanupCorruptedGridState(storageKey) {
  if (!storageKey || !isBrowser()) return;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;

    // If rowSelection exists, remove it and re-save
    if ("rowSelection" in parsed) {
      delete parsed.rowSelection;
      window.localStorage.setItem(storageKey, JSON.stringify(parsed));
    }
  } catch {
    // If parsing fails, clear the entire storage
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Persist per-grid state (column visibility, density, filters) in localStorage
 */
function useGridStatePersistence(id, defaults = {}) {
  const storageKey = useMemo(() => {
    if (!id) return null;
    return `lrp:grid:${id}`;
  }, [id]);

  const persistedState = useMemo(() => {
    const fallback = {
      density: defaults?.density || "compact",
      columnVisibilityModel: defaults?.columnVisibilityModel || {},
      filterModel: defaults?.filterModel || null,
    };

    if (!storageKey || !isBrowser()) {
      return fallback;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return fallback;
      }
      const parsed = JSON.parse(raw);

      // Validate parsed data - if it has unexpected structure, clear it
      if (typeof parsed !== "object" || parsed === null) {
        window.localStorage.removeItem(storageKey);
        return fallback;
      }

      let savedDensity = parsed?.density;
      if (typeof savedDensity === "object" && savedDensity?.value) {
        savedDensity = savedDensity.value;
      }
      if (typeof savedDensity !== "string") {
        savedDensity = undefined;
      }

      // Validate columnVisibilityModel is a plain object
      const columnVisibilityModel = parsed?.columnVisibilityModel;
      if (
        columnVisibilityModel !== null &&
        columnVisibilityModel !== undefined &&
        (typeof columnVisibilityModel !== "object" ||
          Array.isArray(columnVisibilityModel))
      ) {
        // Invalid structure, clear storage and use fallback
        window.localStorage.removeItem(storageKey);
        return fallback;
      }

      // CRITICAL: Clean up any persisted rowSelection from old versions
      // This prevents "R.ids is not iterable" errors from malformed state
      if ("rowSelection" in parsed) {
        delete parsed.rowSelection;
        // Re-save the cleaned state
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(parsed));
        } catch {
          // Ignore cleanup errors
        }
      }

      return {
        density: savedDensity || fallback.density,
        columnVisibilityModel:
          columnVisibilityModel || defaults?.columnVisibilityModel || {},
        filterModel: parsed?.filterModel || defaults?.filterModel || null,
      };
    } catch (error) {
      logError(error, { where: "UniversalDataGrid.loadPersistedState" });
      // Clear corrupted localStorage
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Ignore cleanup errors
      }
      return fallback;
    }
  }, [defaults, storageKey]);

  const onStateChange = useCallback(
    (state) => {
      if (!storageKey || !isBrowser()) return;
      try {
        let densityValue = state?.density;
        if (typeof densityValue === "object" && densityValue?.value) {
          densityValue = densityValue.value;
        }
        if (typeof densityValue !== "string") {
          densityValue = undefined;
        }
        const payload = {
          density: densityValue || defaults?.density || "compact",
          columnVisibilityModel: state?.columns?.columnVisibilityModel || {},
          filterModel: state?.filter?.filterModel || null,
        };
        // CRITICAL: Explicitly delete rowSelection to prevent persistence
        delete payload.rowSelection;
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch (error) {
        logError(error, { where: "UniversalDataGrid.saveState" });
      }
    },
    [defaults, storageKey],
  );

  return { persistedState, onStateChange };
}

/**
 * UniversalDataGrid - Single source of truth for all DataGrid usage
 *
 * MUI v8 compatible, handles all your Firebase data grids:
 * - Time Logs (Admin Logs, Time Clock)
 * - Tickets (Support, Shuttle)
 * - Users, Shootout Stats, etc.
 *
 * Features:
 * - Editable rows with inline editing
 * - Checkbox selection & bulk operations
 * - Auto row IDs from Firebase docs
 * - Persistent column visibility
 * - Quick filter search
 * - Safe error handling
 */
export default function UniversalDataGrid({
  // Persistence (required for state persistence)
  id,

  // Data
  rows = [],
  columns = [],

  // Row identification
  getRowId,

  // State management
  apiRef,
  loading = false,
  error = null,

  // Editing
  processRowUpdate,
  onProcessRowUpdateError,
  rowModesModel,
  onRowModesModelChange,
  onRowEditStart,
  onRowEditStop,

  // Selection
  checkboxSelection = false,
  rowSelectionModel,
  onRowSelectionModelChange,
  disableRowSelectionOnClick = true,

  // Slots (MUI v8 API)
  slots: slotsProp,
  slotProps: slotsPropsProp,

  // Layout
  density = "compact",
  autoHeight = false,
  pageSizeOptions = [25, 50, 100],
  initialState,
  columnVisibilityModel,
  onColumnVisibilityModelChange,

  // Styling
  sx,

  // Everything else
  ...rest
}) {
  // Persistence: Load/save grid state (density, columns, filters) to localStorage
  const { persistedState, onStateChange } = useGridStatePersistence(id, {
    density,
    columnVisibilityModel,
    filterModel: initialState?.filter?.filterModel,
  });

  // CRITICAL: Force cleanup corrupted state on mount
  // This ensures any existing users with malformed rowSelection get fixed
  useEffect(() => {
    if (id) {
      const storageKey = `lrp:grid:${id}`;
      forceCleanupCorruptedGridState(storageKey);
    }
  }, [id]);

  // Default row ID getter (works with Firebase docs)
  // CRITICAL: Use deterministic IDs to maintain stable row identity
  const defaultGetRowId = useCallback((row) => {
    return (
      row?.id ??
      row?.docId ??
      row?._id ??
      row?.ticketId ??
      row?.rideId ??
      row?.uid ??
      generateDeterministicId(row)
    );
  }, []);

  // v8 CRITICAL: Wrap custom getRowId to ensure it never returns null/undefined
  const finalGetRowId = useCallback(
    (row) => {
      if (typeof getRowId === "function") {
        const customId = getRowId(row);
        if (customId != null) return customId;
      }
      // Fall back to default if custom getRowId returns null/undefined
      return defaultGetRowId(row);
    },
    [getRowId, defaultGetRowId],
  );

  // Safe rows (always array)
  const safeRows = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    return rows;
  }, [rows]);

  // MUI v8 CRITICAL: Ensure rowSelectionModel is always a valid array
  const safeRowSelectionModel = useMemo(() => {
    // Don't process if selection is disabled
    if (!checkboxSelection) return [];

    if (rowSelectionModel == null) return [];

    if (Array.isArray(rowSelectionModel)) {
      return rowSelectionModel.filter((id) => id != null);
    }

    if (rowSelectionModel instanceof Set) {
      return Array.from(rowSelectionModel);
    }

    // Handle malformed object with ids property (MUI v8.16.0 bug)
    if (typeof rowSelectionModel === "object" && "ids" in rowSelectionModel) {
      const ids = rowSelectionModel.ids;
      if (ids == null) return [];
      if (Array.isArray(ids)) return ids.filter((id) => id != null);
      if (ids instanceof Set) return Array.from(ids);
      return [];
    }

    console.warn(
      "[UniversalDataGrid] Unknown selection format:",
      typeof rowSelectionModel,
    );
    return [];
  }, [rowSelectionModel, checkboxSelection]);

  // MUI v8 slots API (no legacy components/componentsProps)
  const mergedSlots = useMemo(
    () => ({
      toolbar: LrpGridToolbar,
      footer: SafeGridFooter,
      noRowsOverlay: NoRowsOverlay,
      errorOverlay: ErrorOverlay,
      ...slotsProp,
    }),
    [slotsProp],
  );

  const mergedSlotProps = useMemo(
    () => ({
      toolbar: {
        showQuickFilter: true,
        quickFilterProps: { debounceMs: 300 },
        ...slotsPropsProp?.toolbar,
      },
      ...slotsPropsProp,
    }),
    [slotsPropsProp],
  );

  // Merge persisted state with initial state
  const finalInitialState = useMemo(() => {
    // Build base state with safe defaults
    const baseState = {
      pagination: {
        paginationModel: { pageSize: pageSizeOptions[0] || 25, page: 0 },
      },
      columns: {
        columnVisibilityModel: persistedState.columnVisibilityModel || {},
      },
      filter: {
        filterModel: persistedState.filterModel || { items: [] },
      },
    };

    // Safely merge with initialState if provided
    if (!initialState) return baseState;

    // CRITICAL: Create a clean copy of initialState without rowSelection
    // to prevent "R.ids is not iterable" errors from malformed state
    const cleanInitialState = { ...initialState };
    delete cleanInitialState.rowSelection;

    return {
      ...baseState,
      ...cleanInitialState,
      // Ensure nested objects are properly merged, not replaced
      pagination: {
        ...baseState.pagination,
        ...cleanInitialState.pagination,
      },
      columns: {
        ...baseState.columns,
        ...cleanInitialState.columns,
      },
      filter: {
        ...baseState.filter,
        ...cleanInitialState.filter,
      },
    };
  }, [persistedState, initialState, pageSizeOptions]);

  // Theme-aware styling
  const mergedSx = useMemo(
    () => [
      (theme) => ({
        // Cell styling (remove focus outlines + borders)
        [`& .MuiDataGrid-cell`]: {
          outline: "none",
          borderColor: theme.palette.divider,
        },
        [`& .MuiDataGrid-columnHeader:focus`]: { outline: "none" },

        // Toolbar styling
        [`& .MuiDataGrid-toolbarContainer`]: {
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderBottom: `1px solid ${theme.palette.divider}`,
          padding: theme.spacing(0.5, 1),
          gap: theme.spacing(1),
        },

        // Column headers
        [`& .MuiDataGrid-columnHeaders`]: {
          backgroundColor: alpha(
            theme.palette.primary.main,
            theme.palette.mode === "dark" ? 1 : 0.12,
          ),
          color:
            theme.palette.mode === "dark"
              ? theme.palette.common.white
              : theme.palette.text.primary,
          borderBottom: `1px solid ${theme.palette.divider}`,
        },

        // Overall background
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,

        // Full width
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
      }),
      ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
    ],
    [sx],
  );

  // Apply persisted density (persisted value takes precedence over prop)
  const resolvedDensity = persistedState?.density || density;

  return (
    <DataGridPro
      // Data
      rows={safeRows}
      columns={columns}
      getRowId={finalGetRowId}
      // State
      apiRef={apiRef}
      loading={loading}
      error={error}
      // Editing (MUI v8 API)
      processRowUpdate={processRowUpdate}
      onProcessRowUpdateError={onProcessRowUpdateError}
      rowModesModel={rowModesModel}
      onRowModesModelChange={onRowModesModelChange}
      onRowEditStart={onRowEditStart}
      onRowEditStop={onRowEditStop}
      editMode={processRowUpdate ? "row" : undefined}
      // Selection (MUI v8 API) - HARDENED
      // Only pass selection props when actually enabled
      {...(checkboxSelection
        ? {
            checkboxSelection: true,
            rowSelectionModel: safeRowSelectionModel,
            onRowSelectionModelChange: onRowSelectionModelChange,
            disableRowSelectionOnClick: disableRowSelectionOnClick ?? true,
          }
        : {})}
      // Slots (MUI v8 API - NO legacy components/componentsProps)
      slots={mergedSlots}
      slotProps={mergedSlotProps}
      // Layout
      density={resolvedDensity}
      autoHeight={autoHeight}
      pagination
      pageSizeOptions={pageSizeOptions}
      initialState={finalInitialState}
      columnVisibilityModel={columnVisibilityModel}
      onColumnVisibilityModelChange={onColumnVisibilityModelChange}
      // Persistence: Save state changes to localStorage
      onStateChange={onStateChange}
      // Styling
      sx={mergedSx}
      // Pass through everything else
      {...rest}
    />
  );
}

UniversalDataGrid.propTypes = {
  id: PropTypes.string, // Grid ID for state persistence
  rows: PropTypes.array,
  columns: PropTypes.array.isRequired,
  getRowId: PropTypes.func,
  apiRef: PropTypes.object,
  loading: PropTypes.bool,
  error: PropTypes.any,
  processRowUpdate: PropTypes.func,
  onProcessRowUpdateError: PropTypes.func,
  rowModesModel: PropTypes.object,
  onRowModesModelChange: PropTypes.func,
  onRowEditStart: PropTypes.func,
  onRowEditStop: PropTypes.func,
  checkboxSelection: PropTypes.bool,
  rowSelectionModel: PropTypes.array,
  onRowSelectionModelChange: PropTypes.func,
  disableRowSelectionOnClick: PropTypes.bool,
  slots: PropTypes.object,
  slotProps: PropTypes.object,
  density: PropTypes.oneOf(["compact", "standard", "comfortable"]),
  autoHeight: PropTypes.bool,
  pageSizeOptions: PropTypes.array,
  initialState: PropTypes.object,
  columnVisibilityModel: PropTypes.object,
  onColumnVisibilityModelChange: PropTypes.func,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.func]),
};
