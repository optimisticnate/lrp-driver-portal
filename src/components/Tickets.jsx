/* Proprietary and confidential. See LICENSE. */
// Tickets.jsx — Ticket grid with search, filters, preview, bulk ops

import {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  memo,
  Suspense,
  lazy,
} from "react";
import ReactDOM from "react-dom/client";
import QRCode from "react-qr-code";
import * as htmlToImage from "html-to-image";
import {
  AppBar,
  Box,
  Typography,
  Divider,
  Button,
  Modal,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  FormControlLabel,
  Switch,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
  InputAdornment,
  OutlinedInput,
  Toolbar,
  useTheme,
  CircularProgress,
  Chip,
  Fab,
  IconButton,
  Stack,
  Card,
  CardContent,
  CardActions,
  Checkbox,
  Pagination,
} from "@mui/material";
import { alpha, ThemeProvider } from "@mui/material/styles";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EmailIcon from "@mui/icons-material/Email";
import EditIcon from "@mui/icons-material/Edit";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import CloseIcon from "@mui/icons-material/Close";
import { motion } from "framer-motion";

import { formatDateTime, dayjs, toDayjs } from "@/utils/time";
import { getScanStatus, getScanMeta } from "@/utils/ticketMap";
import {
  subscribeTickets,
  deleteTicketsBatch,
  restoreTicketsBatch,
  getTicketById,
} from "@/services/fs";
import { exportTicketNodesAsZip } from "@/utils/exportTickets";
import { sendTicketsEmail } from "@/services/emailTickets";
import ErrorBoundary from "@/components/feedback/ErrorBoundary.jsx";
import LoadingButtonLite from "@/components/inputs/LoadingButtonLite.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import { vibrateOk, vibrateWarn } from "@/utils/haptics.js";
import { playBeep } from "@/utils/sound.js";

import logError from "../utils/logError.js";
import { useAuth } from "../context/AuthContext.jsx";
import { updateTicketScan } from "../hooks/api";
import useMediaQuery from "../hooks/useMediaQuery";

import PageContainer from "./PageContainer.jsx";
import EditTicketDialog from "./EditTicketDialog.jsx";

const TicketGenerator = lazy(() => import("./TicketGenerator.jsx"));
const TicketScanner = lazy(() => import("./TicketScanner.jsx"));

function TabPanel({ children, value, tabKey }) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== tabKey}
      id={`tickets-tabpanel-${tabKey}`}
      aria-labelledby={`tickets-tab-${tabKey}`}
      sx={{ p: { xs: 1.5, sm: 2 } }}
    >
      {value === tabKey ? children : null}
    </Box>
  );
}

const getTabProps = (key) => ({
  id: `tickets-tab-${key}`,
  "aria-controls": `tickets-tabpanel-${key}`,
});

// null-safe Timestamp → dayjs
function toDayjsTs(v, dayjsLib) {
  if (!v) return null;
  try {
    const d = typeof v.toDate === "function" ? v.toDate() : v;
    const dj = dayjsLib(d);
    return dj.isValid() ? dj : null;
  } catch {
    return null;
  }
}
function formatDate(dj) {
  return dj ? dj.format("MM-DD-YYYY") : "N/A";
}
function formatTime(dj) {
  return dj ? dj.format("h:mm A") : "N/A";
}
function normalizeTicket(raw = {}, dayjsLib) {
  const pickupTime = toDayjsTs(
    raw.pickupTime ||
      raw.createdAt ||
      raw.created ||
      (typeof raw.date === "string" && raw.time
        ? `${raw.date} ${raw.time}`
        : raw.date) ||
      null,
    dayjsLib,
  );
  const pickup =
    raw.pickup ??
    raw.pickupLocation ??
    raw.pickup_location ??
    raw.pickupAddress ??
    raw.pickup_address ??
    "N/A";
  const dropoff =
    raw.dropoff ??
    raw.dropoffLocation ??
    raw.dropoff_location ??
    raw.dropoffAddress ??
    raw.dropoff_address ??
    "N/A";
  const docId = raw.id || raw.docId || raw._id || raw.ticketId || null;
  const ticketId = raw.ticketId || docId || "N/A";
  return {
    id: docId,
    ticketId,
    passenger: raw.passenger || raw.passengerName || "N/A",
    passengerCount:
      Number(raw.passengercount ?? raw.passengers ?? raw.passengerCount ?? 0) ||
      0,
    pickup,
    dropoff,
    notes: raw.notes || "",
    pickupTime,
    pickupDateStr: pickupTime ? pickupTime.format("MM-DD-YYYY") : "Unknown",
    pickupTimeStr: pickupTime ? pickupTime.format("h:mm A") : "—",
    scannedOutbound: !!raw.scannedOutbound,
    scannedOutboundAt: toDayjsTs(raw.scannedOutboundAt, dayjsLib),
    scannedOutboundBy: raw.scannedOutboundBy || "",
    scannedReturn: !!raw.scannedReturn,
    scannedReturnAt: toDayjsTs(raw.scannedReturnAt, dayjsLib),
    scannedReturnBy: raw.scannedReturnBy || "",
    linkUrl: raw.ticketId ? `/ticket/${raw.ticketId}` : null,
  };
}

function buildCsv(rows = []) {
  const esc = (s = "") => `"${String(s).replace(/"/g, '""')}"`;
  const header = [
    "Ticket ID",
    "Passenger",
    "Count",
    "Date",
    "Time",
    "Pickup",
    "Dropoff",
    "Scan Status",
  ];
  const body = rows.map((r) => {
    const scan = r.scannedReturn
      ? "Return"
      : r.scannedOutbound
        ? "Outbound"
        : "Not Scanned";
    return [
      r.ticketId,
      r.passenger,
      r.passengerCount,
      formatDate(r.pickupTime),
      formatTime(r.pickupTime),
      r.pickup,
      r.dropoff,
      scan,
    ]
      .map(esc)
      .join(",");
  });
  return [header.join(","), ...body].join("\n");
}
function download(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const scanChipSx = {
  Both: {
    bgcolor: (t) => alpha(t.palette.primary.main, 0.18),
    color: (t) => t.palette.primary.main,
    border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.35)}`,
  },
  Outbound: {
    bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
    color: (t) => t.palette.primary.main,
    border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.25)}`,
  },
  Return: {
    bgcolor: "action.selected",
    color: "text.primary",
  },
  Unscanned: {
    bgcolor: (t) => alpha(t.palette.common.white, 0.08),
    color: "text.secondary",
    border: (t) => `1px solid ${t.palette.divider}`,
  },
};

function ScanStatusCell(params) {
  const row = params?.row || {};
  const status = getScanStatus(row);
  const { outAt, outBy, retAt, retBy } = getScanMeta(row);
  const tip =
    status === "Unscanned"
      ? "Not scanned"
      : status === "Outbound"
        ? `Outbound by ${outBy || "N/A"} @ ${formatDateTime(outAt)}`
        : status === "Return"
          ? `Return by ${retBy || "N/A"} @ ${formatDateTime(retAt)}`
          : `Outbound by ${outBy || "N/A"} @ ${formatDateTime(outAt)} • Return by ${retBy || "N/A"} @ ${formatDateTime(retAt)}`;

  return (
    <Tooltip title={tip}>
      <Chip size="small" label={status} sx={scanChipSx[status]} />
    </Tooltip>
  );
}

function TicketPreviewCard({ ticket }) {
  if (!ticket) return null;
  const status = getScanStatus(ticket);
  const meta = getScanMeta(ticket);
  return (
    <Box
      sx={{
        p: 2,
        width: 360,
        bgcolor: (theme) => theme.palette.background.paper,
        borderRadius: 2,
        color: (theme) => theme.palette.text.primary,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        boxShadow: (t) => `0 0 0 1px ${alpha(t.palette.primary.main, 0.28)}`,
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <Box
          component="img"
          src="/android-chrome-512x512.png"
          alt="Lake Ride Pros"
          sx={{ height: 48, width: 48, objectFit: "contain" }}
        />
      </Box>
      <Typography variant="h6" align="center" fontWeight={600}>
        🎟️ Shuttle Ticket
      </Typography>
      <Divider
        sx={{ borderColor: (t) => alpha(t.palette.common.white, 0.12) }}
      />
      <Stack spacing={0.5}>
        <Typography>
          <strong>Passenger:</strong> {ticket.passenger || "N/A"}
        </Typography>
        <Typography>
          <strong>Passenger Count:</strong> {ticket.passengerCount ?? "N/A"}
        </Typography>
        <Typography>
          <strong>Date:</strong> {formatDate(ticket.pickupTime)}
        </Typography>
        <Typography>
          <strong>Time:</strong> {formatTime(ticket.pickupTime)}
        </Typography>
        <Typography>
          <strong>Pickup:</strong> {ticket.pickup || "N/A"}
        </Typography>
        <Typography>
          <strong>Dropoff:</strong> {ticket.dropoff || "N/A"}
        </Typography>
        {ticket.notes ? (
          <Typography>
            <strong>Notes:</strong> {ticket.notes}
          </Typography>
        ) : null}
        <Typography>
          <strong>Ticket ID:</strong> {ticket.ticketId || ticket.id || "N/A"}
        </Typography>
      </Stack>
      <Stack spacing={0.5}>
        <Typography display="flex" alignItems="center" gap={1}>
          <strong>Status:</strong>
          <ScanStatusCell row={ticket} />
        </Typography>
        {status !== "Unscanned" && meta ? (
          <>
            {meta.outAt ? (
              <Typography>
                <strong>Outbound:</strong> {formatDateTime(meta.outAt) || "N/A"}
                {meta.outBy ? ` by ${meta.outBy}` : ""}
              </Typography>
            ) : null}
            {meta.retAt ? (
              <Typography>
                <strong>Return:</strong> {formatDateTime(meta.retAt) || "N/A"}
                {meta.retBy ? ` by ${meta.retBy}` : ""}
              </Typography>
            ) : null}
          </>
        ) : null}
      </Stack>
      <Box sx={{ mt: 1.5, display: "flex", justifyContent: "center" }}>
        <QRCode
          value={`https://lakeridepros.xyz/ticket/${ticket.ticketId || ""}`}
          size={160}
        />
      </Box>
    </Box>
  );
}

function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [filteredDate, setFilteredDate] = useState("All Dates");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewTicket, setPreviewTicket] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState(
    "Your Tickets from Lake Ride Pros",
  );
  const [emailMessage, setEmailMessage] = useState(
    "Attached are your tickets. It’s more than a ride, it’s memories made.",
  );
  const [editingTicket, setEditingTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [previewTicketsForEmail, setPreviewTicketsForEmail] = useState([]);
  const previewRefsMap = useRef(new Map());
  const undoTimerRef = useRef(null);
  const previewRef = useRef(null);
  const ticketPreviewContainerRef = useRef(null);
  const rawTicketsRef = useRef(new Map());
  const deletedRowsRef = useRef([]);
  const [noAccessAlertOpen, setNoAccessAlertOpen] = useState(false);
  const { user, authLoading, role } = useAuth();
  const theme = useTheme();
  const scannerFullScreen = useMediaQuery(theme.breakpoints.down("md"));
  const isAdmin = role === "admin";
  const canGenerate = role === "admin";
  const canScanTickets = role === "admin" || role === "driver";
  const [scannerOpen, setScannerOpen] = useState(false);
  const [sequentialScan, setSequentialScan] = useState(true);
  const [pendingScanTicket, setPendingScanTicket] = useState(null);
  const [savingScan, setSavingScan] = useState(false);
  const [savingScanType, setSavingScanType] = useState(null);
  const [subscriptionKey, setSubscriptionKey] = useState(0);
  const [scannerInstanceKey, setScannerInstanceKey] = useState(0);
  const [scannerResumeSignal, setScannerResumeSignal] = useState(0);
  const [scanLookupLoading, setScanLookupLoading] = useState(false);
  const { show: showSnack } = useSnack();

  const announce = useCallback((message) => {
    if (typeof window === "undefined") return;
    window.__LRP_LIVE_MSG__ = message || "";
    try {
      window.dispatchEvent(
        new CustomEvent("lrp:live-region", { detail: message || "" }),
      );
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[Tickets] live region dispatch failed", error);
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

  const resumeScanner = useCallback(
    () => setScannerResumeSignal((value) => value + 1),
    [],
  );

  const openScanner = useCallback(() => {
    setScannerOpen(true);
    setPendingScanTicket(null);
    setScanLookupLoading(false);
    setTimeout(resumeScanner, 0);
  }, [resumeScanner]);

  const closeScanner = useCallback(() => {
    setScannerOpen(false);
    setPendingScanTicket(null);
    setSavingScan(false);
    setSavingScanType(null);
    setScanLookupLoading(false);
    setScannerInstanceKey((k) => k + 1);
    resumeScanner();
  }, [resumeScanner]);

  const handleSequentialToggle = useCallback((event) => {
    setSequentialScan(event.target.checked);
  }, []);

  useEffect(() => {
    // Scanner open - selection disabled
  }, [scannerOpen]);

  const handleScanResult = useCallback(
    async ({ text }) => {
      const trimmed = String(text || "").trim();
      if (!trimmed) return;
      const withoutQuery = trimmed.split("?")[0];
      const segments = withoutQuery.split("/").filter(Boolean);
      const candidate = segments.length
        ? segments[segments.length - 1]
        : trimmed;
      const ticketId = String(candidate || "").trim();
      if (!ticketId) {
        showWarnOrErrorSnack("Invalid ticket code", "error");
        setPendingScanTicket(null);
        resumeScanner();
        return;
      }
      setScanLookupLoading(true);
      setPendingScanTicket({ ticketId, loading: true });
      setPreviewTicket(null);
      try {
        const match = await getTicketById(ticketId);
        if (!match) {
          showWarnOrErrorSnack(`Ticket ${ticketId} not found`, "error");
          setPendingScanTicket(null);
          resumeScanner();
          return;
        }
        const normalized = normalizeTicket(match, dayjs);
        setPreviewTicket(normalized);
        setPendingScanTicket(normalized);
        showSuccessSnack(
          `Ticket ${normalized.ticketId} ready — confirm scan direction`,
        );
      } catch (err) {
        logError(err, {
          area: "Shuttle Tickets",
          action: "scanLookup",
          ticketId,
        });
        showWarnOrErrorSnack("Failed to load ticket", "error");
        setPendingScanTicket(null);
        resumeScanner();
      } finally {
        setScanLookupLoading(false);
      }
    },
    [
      setPreviewTicket,
      setPendingScanTicket,
      showSuccessSnack,
      showWarnOrErrorSnack,
      resumeScanner,
    ],
  );

  const handleScanDialogClose = useCallback(() => {
    if (savingScan) return;
    setPendingScanTicket(null);
    setSavingScanType(null);
    setScanLookupLoading(false);
    resumeScanner();
  }, [resumeScanner, savingScan, setPendingScanTicket, setSavingScanType]);

  const handleScanConfirm = useCallback(
    async (scanType) => {
      if (!pendingScanTicket || savingScan) return;
      if (scanType !== "outbound" && scanType !== "return") return;
      const docId = pendingScanTicket.id || pendingScanTicket.ticketId;
      if (!docId) {
        showWarnOrErrorSnack("Ticket is missing an identifier", "error");
        return;
      }
      const label = pendingScanTicket.ticketId || String(docId);
      if (scanType === "outbound" && pendingScanTicket.scannedOutbound) {
        showInfoSnack(`Ticket ${label} already marked Outbound`);
        return;
      }
      if (scanType === "return" && pendingScanTicket.scannedReturn) {
        showInfoSnack(`Ticket ${label} already marked Return`);
        return;
      }
      const driver = user?.displayName || user?.email || user?.uid || "N/A";
      setSavingScan(true);
      setSavingScanType(scanType);
      try {
        const result = await updateTicketScan(docId, scanType, driver);
        if (!result?.success) {
          throw new Error("Scan update failed");
        }
        const now = dayjs();
        const updates =
          scanType === "outbound"
            ? {
                scannedOutbound: true,
                scannedOutboundAt: now,
                scannedOutboundBy: driver,
              }
            : {
                scannedReturn: true,
                scannedReturnAt: now,
                scannedReturnBy: driver,
              };
        const key = String(docId);
        setTickets((prev) =>
          Array.isArray(prev)
            ? prev.map((item) => {
                const matchId = String(item?.id ?? item?.ticketId ?? "");
                if (matchId !== key) return item;
                return { ...item, ...updates };
              })
            : prev,
        );
        setPreviewTicket((prev) => {
          if (!prev) return prev;
          const matchId = String(prev?.id ?? prev?.ticketId ?? "");
          if (matchId !== key) return prev;
          return { ...prev, ...updates };
        });
        const successMessage = `Ticket ${label} marked ${
          scanType === "outbound" ? "Outbound" : "Return"
        }`;
        showSuccessSnack(successMessage);
        try {
          playBeep();
        } catch (soundError) {
          logError(soundError, {
            area: "Shuttle Tickets",
            action: "scanConfirmSound",
            ticketId: docId,
          });
        }
        setPendingScanTicket(null);
        resumeScanner();
      } catch (err) {
        logError(err, {
          area: "Shuttle Tickets",
          action: "recordScan",
          scanType,
          ticketId: docId,
        });
        showWarnOrErrorSnack("Failed to record scan", "error");
      } finally {
        setSavingScan(false);
        setSavingScanType(null);
      }
    },
    [
      pendingScanTicket,
      savingScan,
      setTickets,
      setPreviewTicket,
      setPendingScanTicket,
      setSavingScanType,
      showInfoSnack,
      showSuccessSnack,
      showWarnOrErrorSnack,
      resumeScanner,
      user?.displayName,
      user?.email,
      user?.uid,
    ],
  );

  const pendingScanStatus = useMemo(
    () => (pendingScanTicket ? getScanStatus(pendingScanTicket) : "Unscanned"),
    [pendingScanTicket],
  );

  const pendingScanMeta = useMemo(
    () => (pendingScanTicket ? getScanMeta(pendingScanTicket) : null),
    [pendingScanTicket],
  );

  useEffect(() => {
    if (tab === 1 && !canGenerate) {
      setTab(0);
      setNoAccessAlertOpen(true);
    }
  }, [tab, canGenerate]);

  const handleTabChange = useCallback(
    (_, value) => {
      if (value === 1 && !canGenerate) {
        setNoAccessAlertOpen(true);
        return;
      }
      setTab(value);
    },
    [canGenerate],
  );

  const closeNoAccessAlert = useCallback(() => setNoAccessAlertOpen(false), []);

  useEffect(() => {
    if (canGenerate && noAccessAlertOpen) {
      setNoAccessAlertOpen(false);
    }
  }, [canGenerate, noAccessAlertOpen]);

  useEffect(() => {
    const id = setTimeout(
      () => setSearchQuery(searchInput.trim().toLowerCase()),
      300,
    );
    return () => clearTimeout(id);
  }, [searchInput]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filteredDate]);

  useEffect(() => {
    if (authLoading || !user?.email) return;
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeTickets({
      onData: (data) => {
        try {
          const incoming = Array.isArray(data) ? data : [];
          const map = new Map();
          incoming.forEach((item) => {
            if (!item) return;
            const id = item.id != null ? String(item.id) : null;
            if (!id) return;
            map.set(id, { ...item });
          });
          rawTicketsRef.current = map;
          const rows = incoming.map((d) => normalizeTicket(d, dayjs));
          setTickets(rows);
        } catch (e) {
          logError(e);
        }
        setLoading(false);
      },
      onError: (err) => {
        setError(err);
        showWarnOrErrorSnack("Permissions issue loading tickets", "error");
        setLoading(false);
      },
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [authLoading, user?.email, subscriptionKey, showWarnOrErrorSnack]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
    };
  }, []);

  const dateOptions = useMemo(() => {
    const dates = Array.from(new Set(tickets.map((t) => t.pickupDateStr)))
      .filter(Boolean)
      .sort();
    return dates;
  }, [tickets]);

  const filteredTickets = useMemo(
    () =>
      tickets.filter((t) => {
        const matchDate =
          filteredDate === "All Dates" || t.pickupDateStr === filteredDate;
        const q = searchQuery;
        const matchSearch =
          !q ||
          [t.ticketId, t.passenger, t.pickup, t.dropoff, t.notes]
            .map((s) => (s || "").toString().toLowerCase())
            .some((s) => s.includes(q));
        return matchDate && matchSearch;
      }),
    [tickets, filteredDate, searchQuery],
  );

  const rows = useMemo(
    () => (Array.isArray(filteredTickets) ? filteredTickets : []),
    [filteredTickets],
  );

  // Pagination
  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return rows.slice(start, end);
  }, [rows, page, pageSize]);

  const handlePageChange = useCallback((_, value) => {
    setPage(value);
  }, []);

  // Clamp page when data set shrinks (filter, search, delete)
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  const [tzGuess] = useState(() => {
    try {
      return dayjs?.tz?.guess?.() || undefined;
    } catch (e) {
      logError(e);
      return undefined;
    }
  });

  const fmtPickup = useCallback(
    (row) => {
      const d = toDayjs(row?.pickupTime);
      if (d) {
        return tzGuess
          ? d.tz(tzGuess).format("MMM D, YYYY h:mm A")
          : d.format("MMM D, YYYY h:mm A");
      }
      if (row?.pickupDateStr || row?.pickupTimeStr) {
        return [row?.pickupDateStr, row?.pickupTimeStr]
          .filter(Boolean)
          .join(" ");
      }
      return "N/A";
    },
    [tzGuess],
  );

  const openLink = useCallback((href) => {
    if (!href) return;
    try {
      window.open(href, "_blank", "noopener,noreferrer");
    } catch (e) {
      logError(e);
    }
  }, []);

  const handleSelectTicket = useCallback((ticketId) => {
    setSelectedIds((prev) => {
      if (prev.includes(ticketId)) {
        return prev.filter((id) => id !== ticketId);
      }
      return [...prev, ticketId];
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === paginatedRows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(
        paginatedRows.map((r) => r.id || r.ticketId).filter(Boolean),
      );
    }
  }, [paginatedRows, selectedIds]);

  const selectedRows = useMemo(() => {
    if (!selectedIds.length) return [];
    const map = new Map();
    rows.forEach((row) => {
      const key = row?.id || row?.ticketId;
      if (key != null) {
        map.set(String(key), row);
      }
    });
    return selectedIds
      .map((id) => map.get(String(id)))
      .filter((row) => Boolean(row));
  }, [rows, selectedIds]);

  const renderTicketPreviewNode = useCallback(
    (ticket) => {
      if (!ticket || !ticketPreviewContainerRef.current) return null;
      const wrapper = document.createElement("div");
      ticketPreviewContainerRef.current.appendChild(wrapper);
      const root = ReactDOM.createRoot(wrapper);
      root.render(
        <ThemeProvider theme={theme}>
          <TicketPreviewCard ticket={ticket} />
        </ThemeProvider>,
      );
      wrapper.__lrpRoot = root;
      return wrapper;
    },
    [theme],
  );

  const handleEditClick = useCallback((row) => setEditingTicket(row), []);
  const handleEditClose = useCallback(() => setEditingTicket(null), []);

  const closeUndoSnackbar = useCallback((options = {}) => {
    const { clearDocs = false } = options;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    if (clearDocs) {
      deletedRowsRef.current = [];
    }
  }, []);

  const handleUndoDelete = useCallback(async () => {
    const cached = deletedRowsRef.current;
    if (!cached?.length) {
      closeUndoSnackbar({ clearDocs: true });
      return;
    }

    closeUndoSnackbar();
    try {
      await restoreTicketsBatch(cached);
      const count = cached.length;
      const successMessage = `Restored ${count} ticket${count === 1 ? "" : "s"}.`;
      showSuccessSnack(successMessage);
    } catch (err) {
      logError(err, {
        area: "tickets",
        action: "handleUndoDelete",
        count: cached.length,
      });
      showWarnOrErrorSnack(
        "Undo failed. Please refresh and try again.",
        "error",
      );
      setSubscriptionKey((key) => key + 1);
    } finally {
      deletedRowsRef.current = [];
    }
  }, [
    closeUndoSnackbar,
    showSuccessSnack,
    showWarnOrErrorSnack,
    setSubscriptionKey,
  ]);

  const handleDeleteRows = useCallback(
    async (idsInput) => {
      const ids = Array.isArray(idsInput)
        ? Array.from(new Set(idsInput.filter((id) => id != null).map(String)))
        : [];
      if (!ids.length || deleting) return;

      closeUndoSnackbar({ clearDocs: true });
      setDeleting(true);
      try {
        const captured = ids
          .map((id) => {
            const raw = rawTicketsRef.current.get(id);
            if (!raw) return null;
            const { id: rawId, ...data } = raw;
            return { id: rawId || id, ...data };
          })
          .filter(Boolean);
        deletedRowsRef.current = captured;
        if (captured.length < ids.length) {
          logError(new Error("Incomplete ticket snapshot before delete"), {
            area: "tickets",
            action: "captureDelete",
            ids,
            captured: captured.length,
          });
        }

        await deleteTicketsBatch(ids);

        if (deletedRowsRef.current.length) {
          const count = deletedRowsRef.current.length;
          if (undoTimerRef.current) {
            clearTimeout(undoTimerRef.current);
          }
          const undoMessage = `Deleted ${count} ticket${count === 1 ? "" : "s"}.`;
          showInfoSnack(undoMessage, {
            autoHideDuration: 6000,
            action: (
              <Button
                onClick={handleUndoDelete}
                size="small"
                sx={{ color: (t) => t.palette.primary.main }}
                aria-label="Undo delete"
              >
                Undo
              </Button>
            ),
          });
          undoTimerRef.current = setTimeout(() => {
            closeUndoSnackbar({ clearDocs: true });
          }, 6000);
        }
      } catch (err) {
        logError(err, {
          area: "tickets",
          action: "handleDeleteRows",
          ids,
        });
        deletedRowsRef.current = [];
        showWarnOrErrorSnack(
          err?.code === "permission-denied"
            ? "You don't have permission to delete tickets."
            : "Delete failed.",
          "error",
        );
      } finally {
        setDeleting(false);
        // Selection model removed - bulk selection disabled
      }
    },
    [
      deleting,
      closeUndoSnackbar,
      handleUndoDelete,
      showInfoSnack,
      showWarnOrErrorSnack,
    ],
  );

  const handleDeleteClick = useCallback(
    (row) => {
      const docId = row?.id != null ? String(row.id) : null;
      if (!docId) {
        showWarnOrErrorSnack("Missing document id for delete.", "warning");
        return;
      }
      handleDeleteRows([docId]);
    },
    [handleDeleteRows, showWarnOrErrorSnack],
  );

  const downloadTicket = useCallback(async () => {
    const node = previewRef.current;
    const t = previewTicket;
    if (!node || !t) return;
    try {
      const dataUrl = await htmlToImage.toPng(node, {
        pixelRatio: 2,
        backgroundColor: theme.palette.common.white,
      });
      const link = document.createElement("a");
      link.download = `${t.ticketId}.png`;
      link.href = dataUrl;
      link.click();
      showSuccessSnack("Ticket saved as image");
    } catch (err) {
      logError(err, { area: "tickets", action: "downloadTicket" });
      showWarnOrErrorSnack("Failed to generate image", "error");
    }
  }, [
    previewTicket,
    showSuccessSnack,
    showWarnOrErrorSnack,
    theme.palette.common.white,
  ]);

  // Set preview tickets when email dialog opens
  useEffect(() => {
    if (emailOpen && selectedRows.length > 0) {
      setPreviewTicketsForEmail(selectedRows);
      previewRefsMap.current.clear();
    } else if (!emailOpen) {
      setPreviewTicketsForEmail([]);
      previewRefsMap.current.clear();
    }
  }, [emailOpen, selectedRows]);

  const handleEmailSelected = useCallback(async () => {
    if (!previewTicketsForEmail.length) return;
    const trimmedEmail = (emailTo || "").trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      showWarnOrErrorSnack("Valid email address required", "warning");
      return;
    }
    setEmailSending(true);
    try {
      // Use requestAnimationFrame like TicketGenerator to ensure elements are painted
      const raf =
        typeof window !== "undefined" &&
        typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame
          : (cb) => setTimeout(cb, 16);

      await new Promise((resolve) => raf(() => raf(resolve)));

      const files = [];
      for (const ticket of previewTicketsForEmail) {
        const ticketId = ticket?.ticketId || ticket?.id;
        if (!ticketId) continue;

        const ref = previewRefsMap.current.get(ticketId);
        if (!ref) {
          console.error(`No ref found for ticket ${ticketId}`);
          continue;
        }

        try {
          const dataUrl = await htmlToImage.toPng(ref, {
            backgroundColor: theme.palette.background.paper,
            pixelRatio: 2,
            cacheBust: true,
          });

          const filename = `${ticketId}.png`;
          files.push({ filename, dataUrl });
        } catch (err) {
          console.error(`Failed to generate image for ${ticketId}:`, err);
          logError(err, { area: "tickets", action: "captureTicket", ticketId });
        }
      }

      if (!files.length) {
        showWarnOrErrorSnack("Failed to generate ticket images", "error");
        return;
      }

      try {
        await sendTicketsEmail({
          to: trimmedEmail,
          subject: emailSubject,
          message: emailMessage,
          attachments: files,
        });
        showSuccessSnack(
          `${files.length} ticket${files.length > 1 ? "s" : ""} emailed to ${trimmedEmail}`,
        );
        setEmailOpen(false);
      } catch (err) {
        logError(err, { area: "tickets", action: "emailSelected" });

        // Graceful fallback: download ZIP when email fails
        const zipFiles = files.map((file) => ({
          name: file.filename.replace(/\.png$/i, ""),
          dataUrl: file.dataUrl,
        }));
        const { downloadZipFromPngs } = await import("@/utils/exportTickets");
        await downloadZipFromPngs(zipFiles, `tickets-${Date.now()}.zip`);

        const errorMsg = err?.message || "Email service unavailable";
        showWarnOrErrorSnack(
          `${errorMsg}. Tickets downloaded as ZIP instead.`,
          "warning",
        );
      }
    } catch (err) {
      logError(err, { area: "tickets", action: "emailSelected:generate" });
      showWarnOrErrorSnack("Failed to prepare tickets", "error");
    } finally {
      setEmailSending(false);
    }
  }, [
    emailMessage,
    emailSubject,
    emailTo,
    previewTicketsForEmail,
    showSuccessSnack,
    showWarnOrErrorSnack,
    theme.palette.background.paper,
  ]);

  const handleExportSelected = useCallback(async () => {
    if (!selectedRows.length) return;
    if (!ticketPreviewContainerRef.current) return;
    setExporting(true);
    const nodes = [];
    try {
      selectedRows.forEach((ticket, index) => {
        const node = renderTicketPreviewNode(ticket);
        if (!node) return;
        const name = ticket?.ticketId || ticket?.id || `ticket-${index + 1}`;
        node.dataset.ticketName = String(name);
        nodes.push(node);
      });
      if (!nodes.length) return;

      // Wait for React to finish rendering all nodes
      await new Promise((resolve) => setTimeout(resolve, 500));

      await exportTicketNodesAsZip(nodes, {
        zipName: `tickets-${Date.now()}.zip`,
      });
      showSuccessSnack("Tickets exported");
    } catch (err) {
      logError(err, { area: "tickets", action: "exportSelected" });
      showWarnOrErrorSnack("Failed to export tickets", "error");
    } finally {
      nodes.forEach((node) => {
        if (node?.__lrpRoot) {
          try {
            node.__lrpRoot.unmount();
          } catch (error) {
            logError(error, { area: "tickets", action: "exportCleanup" });
          }
        }
      });
      if (ticketPreviewContainerRef.current) {
        ticketPreviewContainerRef.current.innerHTML = "";
      }
      setExporting(false);
    }
  }, [
    renderTicketPreviewNode,
    selectedRows,
    showSuccessSnack,
    showWarnOrErrorSnack,
  ]);

  return (
    <ErrorBoundary>
      <PageContainer maxWidth={960}>
        <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
          🎟️ Shuttle Ticket Overview
        </Typography>

        <Box
          display="flex"
          gap={2}
          mb={2}
          flexDirection={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Date Filter</InputLabel>
            <Select
              label="Date Filter"
              value={filteredDate}
              onChange={(e) => setFilteredDate(e.target.value)}
              input={
                <OutlinedInput
                  label="Date Filter"
                  startAdornment={
                    <InputAdornment position="start">
                      <CalendarMonthIcon fontSize="small" />
                    </InputAdornment>
                  }
                />
              }
            >
              <MenuItem value="All Dates">All Dates</MenuItem>
              {dateOptions.map((date) => (
                <MenuItem key={date} value={date}>
                  {date}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            placeholder="Search tickets"
            variant="outlined"
            size="small"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, minWidth: 200 }}
          />
        </Box>

        {noAccessAlertOpen && (
          <Alert severity="warning" onClose={closeNoAccessAlert} sx={{ mb: 2 }}>
            You don’t have access to Generate Ticket.
          </Alert>
        )}

        <Tabs
          value={tab}
          onChange={handleTabChange}
          sx={{
            mb: 2,
            "& .MuiTabs-indicator": {
              backgroundColor: (t) => t.palette.primary.main,
            },
          }}
        >
          <Tab label="Manage" {...getTabProps(0)} />
          <Tab label="Generate" disabled={!canGenerate} {...getTabProps(1)} />
        </Tabs>

        <TabPanel value={tab} tabKey={0}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ mb: 2, flexWrap: "wrap", alignItems: "center" }}
          >
            <Tooltip
              title={
                selectedRows.length
                  ? "Export selected as PNG (ZIP)"
                  : "Select tickets to enable"
              }
            >
              <span>
                <LoadingButtonLite
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportSelected}
                  disabled={!selectedRows.length}
                  loading={exporting}
                  loadingText="Exporting…"
                >
                  Export
                </LoadingButtonLite>
              </span>
            </Tooltip>
            <Tooltip
              title={
                selectedRows.length
                  ? "Email selected tickets"
                  : "Select tickets to enable"
              }
            >
              <span>
                <LoadingButtonLite
                  variant="outlined"
                  startIcon={<EmailIcon />}
                  onClick={() => setEmailOpen(true)}
                  disabled={!selectedRows.length || emailSending}
                  loading={emailSending}
                  loadingText="Sending…"
                >
                  Email
                </LoadingButtonLite>
              </span>
            </Tooltip>
            <Tooltip
              title={
                !isAdmin
                  ? "Only admins can delete tickets"
                  : selectedIds.length
                    ? "Delete selected tickets"
                    : "Select tickets to enable"
              }
            >
              <span>
                <LoadingButtonLite
                  variant="contained"
                  color="error"
                  startIcon={<DeleteIcon />}
                  disabled={!isAdmin || !selectedIds.length}
                  loading={deleting}
                  loadingText="Deleting…"
                  onClick={() => handleDeleteRows(selectedIds)}
                >
                  Delete
                </LoadingButtonLite>
              </span>
            </Tooltip>
            <Button
              variant="outlined"
              onClick={() =>
                download(
                  `tickets-${dayjs().format("YYYYMMDD-HHmmss")}.csv`,
                  buildCsv(rows),
                  "text/csv",
                )
              }
            >
              Export CSV
            </Button>
          </Stack>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              Error loading tickets. Please refresh the page.
            </Alert>
          ) : rows.length === 0 ? (
            <Alert severity="info">No tickets found.</Alert>
          ) : (
            <>
              <Stack spacing={2}>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
                >
                  <Checkbox
                    checked={
                      selectedIds.length === paginatedRows.length &&
                      paginatedRows.length > 0
                    }
                    indeterminate={
                      selectedIds.length > 0 &&
                      selectedIds.length < paginatedRows.length
                    }
                    onChange={handleSelectAll}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {selectedIds.length > 0
                      ? `${selectedIds.length} selected`
                      : "Select all"}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: "auto" }}
                  >
                    Showing {paginatedRows.length} of {rows.length} tickets
                  </Typography>
                </Box>

                {paginatedRows.map((ticket) => {
                  const ticketId = ticket?.id || ticket?.ticketId;
                  const isSelected = selectedIds.includes(ticketId);

                  return (
                    <Card
                      key={ticketId}
                      sx={{
                        bgcolor: (t) =>
                          isSelected
                            ? alpha(t.palette.primary.main, 0.15)
                            : t.palette.background.paper,
                        borderLeft: (t) =>
                          isSelected
                            ? `4px solid ${t.palette.primary.main}`
                            : `4px solid transparent`,
                        transition: "all 0.2s ease",
                        "&:hover": {
                          bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                        },
                      }}
                    >
                      <CardContent>
                        <Stack spacing={1.5}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 1,
                            }}
                          >
                            <Checkbox
                              checked={isSelected}
                              onChange={() => handleSelectTicket(ticketId)}
                              sx={{ mt: -1 }}
                            />
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="h6" fontWeight={600}>
                                {ticket.passenger || "N/A"}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ fontFamily: "monospace" }}
                              >
                                {ticket.ticketId || "N/A"}
                              </Typography>
                            </Box>
                            <ScanStatusCell row={ticket} />
                          </Box>

                          <Divider />

                          <Stack spacing={0.5}>
                            <Box sx={{ display: "flex", gap: 1 }}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ minWidth: 100 }}
                              >
                                Pickup:
                              </Typography>
                              <Typography variant="body2">
                                {ticket.pickup || "N/A"}
                              </Typography>
                            </Box>
                            <Box sx={{ display: "flex", gap: 1 }}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ minWidth: 100 }}
                              >
                                Dropoff:
                              </Typography>
                              <Typography variant="body2">
                                {ticket.dropoff || "N/A"}
                              </Typography>
                            </Box>
                            <Box sx={{ display: "flex", gap: 1 }}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ minWidth: 100 }}
                              >
                                Time:
                              </Typography>
                              <Typography variant="body2">
                                {fmtPickup(ticket)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: "flex", gap: 1 }}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ minWidth: 100 }}
                              >
                                Passengers:
                              </Typography>
                              <Typography variant="body2">
                                {ticket.passengerCount ??
                                  ticket.passengercount ??
                                  "N/A"}
                              </Typography>
                            </Box>
                            {ticket.notes && (
                              <Box sx={{ display: "flex", gap: 1 }}>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ minWidth: 100 }}
                                >
                                  Notes:
                                </Typography>
                                <Typography variant="body2">
                                  {ticket.notes}
                                </Typography>
                              </Box>
                            )}
                          </Stack>
                        </Stack>
                      </CardContent>
                      <CardActions
                        sx={{
                          justifyContent: "flex-end",
                          flexWrap: "wrap",
                          gap: 1,
                        }}
                      >
                        {ticket.linkUrl && (
                          <Button
                            size="small"
                            onClick={() => openLink(ticket.linkUrl)}
                          >
                            View
                          </Button>
                        )}
                        <Button
                          size="small"
                          startIcon={<DownloadIcon />}
                          onClick={() => setPreviewTicket(ticket)}
                        >
                          Preview
                        </Button>
                        <Button
                          size="small"
                          startIcon={<EmailIcon />}
                          onClick={() => {
                            setEmailTo(ticket?.email || emailTo);
                            setEmailOpen(true);
                          }}
                        >
                          Email
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              size="small"
                              startIcon={<EditIcon />}
                              onClick={() => handleEditClick(ticket)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="small"
                              startIcon={<DeleteIcon />}
                              color="error"
                              disabled={deleting}
                              onClick={() => handleDeleteClick(ticket)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </CardActions>
                    </Card>
                  );
                })}
              </Stack>

              {totalPages > 1 && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={handlePageChange}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </TabPanel>

        <TabPanel value={tab} tabKey={1}>
          {canGenerate ? (
            <Suspense
              fallback={
                <Box p={2}>
                  <CircularProgress size={20} />
                </Box>
              }
            >
              <TicketGenerator />
            </Suspense>
          ) : (
            <Alert severity="info">Ticket generation restricted.</Alert>
          )}
        </TabPanel>

        <Box
          ref={ticketPreviewContainerRef}
          sx={{
            position: "fixed",
            left: -9999,
            top: -9999,
            opacity: 0,
            pointerEvents: "none",
            visibility: "hidden",
          }}
        />

        {editingTicket && (
          <EditTicketDialog
            open={Boolean(editingTicket)}
            ticket={editingTicket}
            onClose={handleEditClose}
          />
        )}

        <Modal open={!!previewTicket} onClose={() => setPreviewTicket(null)}>
          <Box
            component={motion.div}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            sx={{
              backgroundColor: "transparent",
              borderRadius: 2,
              width: "fit-content",
              maxWidth: "90vw",
              mx: "auto",
              mt: 1,
              outline: "none",
              overflow: "visible",
            }}
          >
            {previewTicket && (
              <>
                <Box ref={previewRef}>
                  <TicketPreviewCard ticket={previewTicket} />
                </Box>

                <Box
                  mt={2}
                  px={2}
                  display="flex"
                  justifyContent="space-between"
                >
                  <Button
                    variant="outlined"
                    color="info"
                    startIcon={<EmailIcon />}
                    onClick={() => {
                      // Selection disabled - email requires manual selection
                      setEmailOpen(true);
                      setEmailTo(previewTicket?.email || emailTo);
                    }}
                  >
                    Email
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={downloadTicket}
                    sx={(t) => ({
                      boxShadow: `0 0 8px 2px ${t.palette.primary.main}`,
                      fontWeight: 700,
                    })}
                  >
                    Download
                  </Button>
                  <Button variant="text" onClick={() => setPreviewTicket(null)}>
                    Close
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </Modal>

        <Dialog
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Email Selected Tickets</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <TextField
                label="To"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="customer@example.com"
              />
              <TextField
                label="Subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
              <TextField
                label="Message"
                multiline
                minRows={3}
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
              />

              {previewTicketsForEmail.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Ticket Previews ({previewTicketsForEmail.length}):
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      maxHeight: 400,
                      overflowY: "auto",
                      p: 1,
                      bgcolor: "background.default",
                      borderRadius: 1,
                    }}
                  >
                    {previewTicketsForEmail.map((ticket, idx) => {
                      const ticketId = ticket?.ticketId || ticket?.id;
                      return (
                        <Box
                          key={ticketId || idx}
                          ref={(el) => {
                            if (el && ticketId) {
                              previewRefsMap.current.set(ticketId, el);
                            }
                          }}
                        >
                          <TicketPreviewCard ticket={ticket} />
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEmailOpen(false)}>Cancel</Button>
            <LoadingButtonLite
              variant="contained"
              onClick={handleEmailSelected}
              disabled={!selectedRows.length}
              loading={emailSending}
              loadingText="Sending…"
            >
              Send
            </LoadingButtonLite>
          </DialogActions>
        </Dialog>

        {canScanTickets && (
          <>
            <Dialog
              open={scannerOpen}
              onClose={closeScanner}
              fullScreen={scannerFullScreen}
              maxWidth="md"
              fullWidth
              aria-labelledby="ticket-scanner-title"
              PaperProps={{
                sx: {
                  bgcolor: (t) => t.palette.background.paper,
                  color: (t) => t.palette.text.primary,
                  ...(scannerFullScreen
                    ? {}
                    : {
                        borderRadius: 2,
                        maxWidth: "min(760px, 96vw)",
                        width: "min(760px, 96vw)",
                      }),
                },
              }}
            >
              <AppBar
                position="relative"
                sx={{
                  bgcolor: (t) => t.palette.background.paper,
                  color: (t) => t.palette.text.primary,
                  boxShadow: "none",
                  borderBottom: (t) => `1px solid ${t.palette.divider}`,
                }}
              >
                <Toolbar sx={{ gap: 2 }}>
                  <Typography
                    id="ticket-scanner-title"
                    variant="h6"
                    component="div"
                    sx={{ flexGrow: 1, fontWeight: 600 }}
                  >
                    Scan Tickets
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={sequentialScan}
                        onChange={handleSequentialToggle}
                        color="success"
                        inputProps={{
                          "aria-label": "Toggle sequential scanning",
                        }}
                      />
                    }
                    label="Sequential mode"
                    sx={{
                      color: (t) => alpha(t.palette.common.white, 0.8),
                      "& .MuiFormControlLabel-label": {
                        fontSize: 14,
                      },
                    }}
                  />
                  <IconButton
                    edge="end"
                    onClick={closeScanner}
                    aria-label="Close ticket scanner"
                    sx={{ color: (t) => t.palette.text.primary }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Toolbar>
              </AppBar>
              <Box
                sx={{
                  p: { xs: 2, sm: 3 },
                  bgcolor: (t) => t.palette.background.paper,
                }}
              >
                <Suspense
                  fallback={
                    <Box
                      sx={{ py: 6, display: "flex", justifyContent: "center" }}
                    >
                      <CircularProgress
                        size={24}
                        sx={{ color: (t) => t.palette.primary.main }}
                      />
                    </Box>
                  }
                >
                  {scannerOpen && (
                    <TicketScanner
                      key={scannerInstanceKey}
                      onScan={handleScanResult}
                      onClose={closeScanner}
                      sequential={sequentialScan}
                      resumeSignal={scannerResumeSignal}
                    />
                  )}
                </Suspense>
              </Box>
            </Dialog>

            <Tooltip title="Scan Ticket">
              <Fab
                color="primary"
                aria-label="Scan Ticket"
                onClick={openScanner}
                sx={{
                  position: "fixed",
                  right: 16,
                  bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
                  bgcolor: (t) => t.palette.primary.main,
                  color: (t) => t.palette.primary.contrastText,
                  display: scannerOpen ? "none" : "inline-flex",
                  "&:hover": { bgcolor: (t) => t.palette.primary.dark },
                  zIndex: (t) => t.zIndex.modal + 1,
                }}
              >
                <QrCodeScannerIcon />
              </Fab>
            </Tooltip>
          </>
        )}

        <Dialog
          open={Boolean(pendingScanTicket)}
          onClose={handleScanDialogClose}
          aria-labelledby="tickets-scan-confirm"
          PaperProps={{
            sx: {
              bgcolor: (t) => t.palette.background.paper,
              color: (t) => t.palette.text.primary,
              borderRadius: 2,
              width: "min(420px, 90vw)",
            },
          }}
        >
          <DialogTitle
            id="tickets-scan-confirm"
            sx={{
              fontWeight: 600,
              pb: 1,
              borderBottom: (t) => `1px solid ${t.palette.divider}`,
            }}
          >
            Record ticket scan
          </DialogTitle>
          <DialogContent
            sx={{ bgcolor: (t) => t.palette.background.paper, pt: 3 }}
          >
            {scanLookupLoading ? (
              <Stack
                spacing={2}
                alignItems="center"
                justifyContent="center"
                sx={{ py: 4 }}
              >
                <CircularProgress
                  size={28}
                  sx={{ color: (t) => t.palette.primary.main }}
                />
                <Typography
                  variant="body2"
                  sx={{ color: (t) => alpha(t.palette.common.white, 0.72) }}
                >
                  Fetching the latest ticket details…
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Ticket {pendingScanTicket?.ticketId || "—"}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: (t) => alpha(t.palette.common.white, 0.72) }}
                >
                  Passenger: {pendingScanTicket?.passenger || "Unknown"}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: (t) => alpha(t.palette.common.white, 0.72) }}
                >
                  Pickup: {pendingScanTicket?.pickup || "N/A"}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: (t) => alpha(t.palette.common.white, 0.72) }}
                >
                  Date: {formatDate(pendingScanTicket?.pickupTime)} at{" "}
                  {formatTime(pendingScanTicket?.pickupTime)}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: (t) => alpha(t.palette.common.white, 0.72) }}
                >
                  Current status: {pendingScanStatus}
                </Typography>
                {pendingScanMeta?.outAt && (
                  <Typography
                    variant="body2"
                    sx={{ color: (t) => alpha(t.palette.common.white, 0.6) }}
                  >
                    Outbound recorded by {pendingScanMeta.outBy || "Unknown"} at{" "}
                    {formatDateTime(pendingScanMeta.outAt)}
                  </Typography>
                )}
                {pendingScanMeta?.retAt && (
                  <Typography
                    variant="body2"
                    sx={{ color: (t) => alpha(t.palette.common.white, 0.6) }}
                  >
                    Return recorded by {pendingScanMeta.retBy || "Unknown"} at{" "}
                    {formatDateTime(pendingScanMeta.retAt)}
                  </Typography>
                )}
                <Typography
                  variant="body2"
                  sx={{
                    color: (t) => alpha(t.palette.common.white, 0.72),
                    pt: 0.5,
                  }}
                >
                  Select a direction to log this scan.
                </Typography>
              </Stack>
            )}
          </DialogContent>
          <DialogActions
            sx={{
              bgcolor: (t) => t.palette.background.paper,
              px: 3,
              pb: 3,
              gap: 1,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <Button
              onClick={handleScanDialogClose}
              disabled={savingScan || scanLookupLoading}
              sx={{
                color: (t) => t.palette.text.primary,
                "&.Mui-disabled": {
                  color: (t) => alpha(t.palette.common.white, 0.4),
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleScanConfirm("outbound")}
              variant="outlined"
              color="info"
              disabled={savingScan || scanLookupLoading}
              startIcon={
                savingScan && savingScanType === "outbound" ? (
                  <CircularProgress size={16} sx={{ color: "inherit" }} />
                ) : null
              }
              sx={{
                fontWeight: 600,
                borderColor: (t) => alpha(t.palette.primary.main, 0.6),
                color: (t) => t.palette.text.primary,
                "&:hover": { borderColor: (t) => t.palette.primary.main },
                "&.Mui-disabled": {
                  borderColor: (t) => alpha(t.palette.common.white, 0.24),
                  color: (t) => alpha(t.palette.common.white, 0.4),
                },
              }}
            >
              {savingScan && savingScanType === "outbound"
                ? "Saving…"
                : "Mark Outbound"}
            </Button>
            <Button
              onClick={() => handleScanConfirm("return")}
              variant="contained"
              color="success"
              disabled={savingScan || scanLookupLoading}
              startIcon={
                savingScan && savingScanType === "return" ? (
                  <CircularProgress size={16} sx={{ color: "inherit" }} />
                ) : null
              }
              sx={(t) => ({
                fontWeight: 700,
                boxShadow:
                  savingScan && savingScanType === "return"
                    ? `0 0 6px ${t.palette.primary.main}`
                    : `0 0 10px ${alpha(t.palette.primary.main, 0.55)}`,
                "&:hover": {
                  boxShadow: `0 0 12px ${alpha(t.palette.primary.main, 0.75)}`,
                },
                "&.Mui-disabled": {
                  boxShadow: "none",
                  color: (t) => alpha(t.palette.common.white, 0.4),
                },
              })}
            >
              {savingScan && savingScanType === "return"
                ? "Saving…"
                : "Mark Return"}
            </Button>
          </DialogActions>
        </Dialog>
      </PageContainer>
    </ErrorBoundary>
  );
}

export default memo(Tickets);
