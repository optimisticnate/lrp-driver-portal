import { memo } from "react";
import { Box, Button, Chip, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import PersonIcon from "@mui/icons-material/Person";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { motion } from "framer-motion";

import { formatDateTime } from "@/utils/time.js";

const PRIORITY_EMOJI = {
  high: "🔴",
  urgent: "🔴",
  normal: "🟡",
  medium: "🟡",
  low: "🟢",
};

function getStatusColor(status, theme) {
  const statusMap = {
    open: theme.palette.primary.main,
    in_progress: theme.palette.warning.main,
    resolved: theme.palette.success.main,
    closed: theme.palette.grey[500],
  };
  return statusMap[status] || statusMap.open;
}

function TicketCard({
  ticket,
  onSelect,
  isActive = false,
  isDragging = false,
}) {
  const theme = useTheme();

  if (!ticket) return null;

  const status = String(ticket.status || "open").toLowerCase();
  const priority = String(ticket.priority || "normal").toLowerCase();
  const statusColor = getStatusColor(status, theme);
  const priorityEmoji = PRIORITY_EMOJI[priority] || PRIORITY_EMOJI.normal;

  const assigneeName =
    ticket.assigneeName ||
    ticket.assignee?.displayName ||
    ticket.assignee?.name ||
    "Unassigned";

  const updatedAt = ticket.updatedAt || ticket.createdAt;
  const formattedTime = formatDateTime(updatedAt, "MMM D, h:mm A");

  const handleClick = () => {
    if (typeof onSelect === "function") {
      onSelect(ticket);
    }
  };

  const statusLabel = status
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
    .join(" ");

  const categoryLabel =
    ticket.category && ticket.category !== "n/a"
      ? String(ticket.category).charAt(0).toUpperCase() +
        String(ticket.category).slice(1)
      : "General";

  const showSLA = ticket.sla?.breachAt || ticket.sla?.minutes;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      style={{ width: "100%" }}
    >
      <Box
        onClick={handleClick}
        sx={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          p: 2,
          borderRadius: 2,
          borderLeft: `4px solid ${statusColor}`,
          bgcolor: (t) =>
            isActive
              ? alpha(t.palette.primary.main, 0.08)
              : t.palette.background.paper,
          boxShadow: (t) =>
            isDragging ? t.shadows[8] : isActive ? t.shadows[6] : t.shadows[1],
          cursor: "pointer",
          transition: "all 0.2s ease-in-out",
          minHeight: 140,
          opacity: isDragging ? 0.6 : 1,
          transform: isDragging ? "rotate(2deg)" : "none",
          "&:hover": {
            boxShadow: (t) => t.shadows[6],
            bgcolor: (t) =>
              isActive
                ? alpha(t.palette.primary.main, 0.12)
                : alpha(t.palette.action.hover, 0.08),
          },
        }}
      >
        {/* Header: Priority + Incident Number */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              fontWeight: 600,
              color: "text.secondary",
            }}
          >
            <span>{priorityEmoji}</span>
            <span>{ticket.incidentNumber || "N/A"}</span>
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            <Chip
              label={categoryLabel}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.7rem",
                bgcolor: (t) => alpha(t.palette.info.main, 0.15),
                color: (t) => t.palette.info.main,
              }}
            />
            <Chip
              label={statusLabel}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.7rem",
                bgcolor: alpha(statusColor, 0.15),
                color: statusColor,
                fontWeight: 600,
              }}
            />
          </Box>
        </Box>

        {/* Title */}
        <Typography
          variant="body1"
          sx={{
            fontWeight: 700,
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minHeight: "2.6em",
          }}
        >
          {ticket.title || "Untitled Ticket"}
        </Typography>

        {/* SLA Info */}
        {showSLA && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              p: 0.75,
              borderRadius: 1,
              bgcolor: (t) => alpha(t.palette.warning.main, 0.1),
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: (t) => t.palette.warning.main,
                fontWeight: 600,
              }}
            >
              ⏰ SLA:{" "}
              {ticket.sla.minutes
                ? `${ticket.sla.minutes}m`
                : formatDateTime(ticket.sla.breachAt, "MMM D, h:mm A")}
            </Typography>
          </Box>
        )}

        {/* Footer: Assignee + Updated Time */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            mt: "auto",
            pt: 1,
            borderTop: (t) => `1px solid ${alpha(t.palette.divider, 0.1)}`,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              minWidth: 0,
              flex: 1,
            }}
          >
            <PersonIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {assigneeName}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <AccessTimeIcon sx={{ fontSize: 14, color: "text.secondary" }} />
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                whiteSpace: "nowrap",
              }}
            >
              {formattedTime}
            </Typography>
          </Box>
        </Box>

        {/* View Details Button */}
        <Button
          size="small"
          sx={{
            mt: 0.5,
            justifyContent: "flex-end",
            textTransform: "none",
            fontWeight: 600,
            color: (t) => t.palette.primary.main,
            "&:hover": {
              bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
            },
          }}
        >
          View Details →
        </Button>
      </Box>
    </motion.div>
  );
}

export default memo(TicketCard);
