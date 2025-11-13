import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  CircularProgress,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import SearchIcon from "@mui/icons-material/Search";

import { subscribeTickets } from "@/services/tickets.js";
import TicketCard from "@/tickets/TicketCard.jsx";
import logError from "@/utils/logError.js";

function TicketListView({ onSelect, activeTicketId, optimisticTicket }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Setting loading state for subscription
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeTickets({}, (result) => {
      if (result?.error) {
        setError(result.error);
        setTickets([]);
        setLoading(false);
        return;
      }

      const incoming = Array.isArray(result?.rows) ? result.rows : [];
      setTickets(incoming);
      setError(null);
      setLoading(false);
    });

    return () => {
      try {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      } catch (err) {
        logError(err, { where: "TicketListView.cleanup" });
      }
    };
  }, []);

  // Merge optimistic ticket updates
  const displayTickets = useMemo(() => {
    if (!optimisticTicket) return tickets;

    const optimisticId =
      optimisticTicket.id ||
      optimisticTicket.ticketId ||
      optimisticTicket.docId ||
      optimisticTicket._id;

    if (!optimisticId) return tickets;

    const existingIndex = tickets.findIndex((t) => {
      const tId = t.id || t.ticketId || t.docId || t._id;
      return tId === optimisticId;
    });

    if (existingIndex >= 0) {
      // Update existing ticket
      const updated = [...tickets];
      updated[existingIndex] = {
        ...updated[existingIndex],
        ...optimisticTicket,
      };
      return updated;
    }

    // Add new ticket at the top
    return [optimisticTicket, ...tickets];
  }, [tickets, optimisticTicket]);

  // Filter tickets by status
  const statusFilteredTickets = useMemo(() => {
    if (!statusFilter || statusFilter === "all") {
      return displayTickets;
    }

    return displayTickets.filter((ticket) => {
      const ticketStatus = String(ticket.status || "open")
        .toLowerCase()
        .trim();
      return ticketStatus === statusFilter;
    });
  }, [displayTickets, statusFilter]);

  // Filter tickets by search query
  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) {
      return statusFilteredTickets;
    }

    const query = searchQuery.toLowerCase().trim();

    return statusFilteredTickets.filter((ticket) => {
      const title = String(ticket.title || "").toLowerCase();
      const incidentNumber = String(ticket.incidentNumber || "").toLowerCase();
      const description = String(ticket.description || "").toLowerCase();

      return (
        title.includes(query) ||
        incidentNumber.includes(query) ||
        description.includes(query)
      );
    });
  }, [statusFilteredTickets, searchQuery]);

  const handleSearchChange = useCallback((event) => {
    setSearchQuery(event.target.value);
  }, []);

  const handleStatusFilterChange = useCallback((event) => {
    setStatusFilter(event.target.value);
  }, []);

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          p: 4,
          textAlign: "center",
          color: (t) => t.palette.error.main,
        }}
      >
        <Typography variant="h6">Error loading tickets</Typography>
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.7 }}>
          {error?.message || String(error)}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      {/* Filter Bar */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          mb: 3,
        }}
      >
        <TextField
          placeholder="Search tickets..."
          value={searchQuery}
          onChange={handleSearchChange}
          size="small"
          fullWidth
          InputProps={{
            startAdornment: (
              <SearchIcon
                sx={{ mr: 1, color: "text.secondary", fontSize: 20 }}
              />
            ),
          }}
          sx={{
            flex: 1,
            "& .MuiOutlinedInput-root": {
              bgcolor: (t) => t.palette.background.paper,
            },
          }}
        />
        <Select
          value={statusFilter}
          onChange={handleStatusFilterChange}
          size="small"
          sx={{
            minWidth: { xs: "100%", sm: 180 },
            bgcolor: (t) => t.palette.background.paper,
          }}
        >
          <MenuItem value="all">All Statuses</MenuItem>
          <MenuItem value="open">Open</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="resolved">Resolved</MenuItem>
          <MenuItem value="closed">Closed</MenuItem>
        </Select>
      </Box>

      {/* Tickets Grid */}
      {filteredTickets.length === 0 ? (
        <Box
          sx={{
            p: 4,
            textAlign: "center",
            opacity: 0.6,
          }}
        >
          <Typography variant="h6">No tickets found 🚀</Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              lg: "repeat(3, 1fr)",
            },
            gap: 2,
          }}
        >
          <AnimatePresence mode="popLayout">
            {filteredTickets.map((ticket, index) => (
              <motion.div
                key={ticket.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
              >
                <TicketCard
                  ticket={ticket}
                  onSelect={onSelect}
                  isActive={ticket.id === activeTicketId}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </Box>
      )}
    </Box>
  );
}

export default memo(TicketListView);
