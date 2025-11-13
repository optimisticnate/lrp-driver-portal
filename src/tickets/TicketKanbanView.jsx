import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";

import { subscribeTickets, updateTicket } from "@/services/tickets.js";
import TicketCard from "@/tickets/TicketCard.jsx";
import logError from "@/utils/logError.js";

function getColumns(theme) {
  return [
    { id: "open", label: "Open", color: theme.palette.primary.main },
    {
      id: "in_progress",
      label: "In Progress",
      color: theme.palette.warning.main,
    },
    { id: "resolved", label: "Resolved", color: theme.palette.success.main },
    { id: "closed", label: "Closed", color: theme.palette.grey[500] },
  ];
}

function SortableTicket({ ticket, onSelect, isActive }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: ticket.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TicketCard
        ticket={ticket}
        onSelect={onSelect}
        isActive={isActive}
        isDragging={isDragging}
      />
    </div>
  );
}

const SortableTicketMemo = memo(SortableTicket);

function KanbanColumn({ column, tickets, onSelect, activeTicketId }) {
  const ticketIds = useMemo(
    () => tickets.map((ticket) => ticket.id),
    [tickets],
  );

  return (
    <Paper
      elevation={0}
      sx={(t) => ({
        minWidth: 280,
        maxWidth: 320,
        display: "flex",
        flexDirection: "column",
        bgcolor:
          t.palette.mode === "dark"
            ? alpha(t.palette.background.paper, 0.4)
            : alpha(t.palette.grey[50], 0.8),
        borderRadius: 2,
        overflow: "hidden",
        height: "100%",
      })}
    >
      {/* Column Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: `2px solid ${column.color}`,
          bgcolor: alpha(column.color, 0.1),
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            color: column.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{column.label}</span>
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 24,
              height: 24,
              borderRadius: "50%",
              bgcolor: alpha(column.color, 0.2),
              color: column.color,
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            {tickets.length}
          </Box>
        </Typography>
      </Box>

      {/* Column Content */}
      <Box
        sx={{
          flex: 1,
          p: 1.5,
          overflowY: "auto",
          minHeight: 200,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        <SortableContext
          items={ticketIds}
          strategy={verticalListSortingStrategy}
        >
          <AnimatePresence mode="popLayout">
            {tickets.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Box
                  sx={{
                    p: 3,
                    textAlign: "center",
                    color: "text.secondary",
                    opacity: 0.5,
                  }}
                >
                  <Typography variant="caption">No tickets</Typography>
                </Box>
              </motion.div>
            ) : (
              tickets.map((ticket) => (
                <motion.div
                  key={ticket.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <SortableTicketMemo
                    ticket={ticket}
                    onSelect={onSelect}
                    isActive={ticket.id === activeTicketId}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </SortableContext>
      </Box>
    </Paper>
  );
}

const KanbanColumnMemo = memo(KanbanColumn);

function TicketKanbanView({ onSelect, activeTicketId, optimisticTicket }) {
  const theme = useTheme();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);

  const columns = useMemo(() => getColumns(theme), [theme]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

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
        logError(err, { where: "TicketKanbanView.cleanup" });
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

  // Group tickets by status
  const ticketsByStatus = useMemo(() => {
    const groups = {
      open: [],
      in_progress: [],
      resolved: [],
      closed: [],
    };

    displayTickets.forEach((ticket) => {
      const status = String(ticket.status || "open")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_");

      if (groups[status]) {
        groups[status].push(ticket);
      } else {
        groups.open.push(ticket);
      }
    });

    return groups;
  }, [displayTickets]);

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      // Extract status from the droppable container
      // Use containerId to get the column, not the ticket ID when dropping over a ticket
      const newStatus = over.data?.current?.sortable?.containerId || over.id;

      // Validate that newStatus is one of the valid column IDs
      const validStatuses = ["open", "in_progress", "resolved", "closed"];
      if (!validStatuses.includes(newStatus)) {
        logError(new Error(`Invalid status from drag: ${newStatus}`), {
          where: "TicketKanbanView.handleDragEnd.validation",
        });
        return;
      }

      // Find the ticket being dragged
      const ticket = displayTickets.find((t) => t.id === active.id);

      if (!ticket) return;

      const currentStatus = String(ticket.status || "open").toLowerCase();

      // Only update if status changed
      if (currentStatus === newStatus) return;

      try {
        await updateTicket(ticket.id, { status: newStatus });
      } catch (err) {
        logError(err, {
          where: "TicketKanbanView.handleDragEnd",
          ticketId: ticket.id,
          newStatus,
        });
      }
    },
    [displayTickets],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const activeTicket = useMemo(
    () => displayTickets.find((t) => t.id === activeId),
    [displayTickets, activeId],
  );

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

  if (displayTickets.length === 0) {
    return (
      <Box
        sx={{
          p: 4,
          textAlign: "center",
          opacity: 0.6,
        }}
      >
        <Typography variant="h6">No tickets found 🚀</Typography>
      </Box>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <Box
        sx={{
          display: "flex",
          gap: 2,
          overflowX: "auto",
          pb: 2,
          minHeight: 500,
          "@media (max-width: 600px)": {
            scrollSnapType: "x mandatory",
            "& > *": {
              scrollSnapAlign: "start",
            },
          },
        }}
      >
        {columns.map((column) => (
          <SortableContext
            key={column.id}
            id={column.id}
            items={ticketsByStatus[column.id].map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <KanbanColumnMemo
              column={column}
              tickets={ticketsByStatus[column.id]}
              onSelect={onSelect}
              activeTicketId={activeTicketId}
            />
          </SortableContext>
        ))}
      </Box>

      <DragOverlay>
        {activeTicket ? (
          <Box sx={{ opacity: 0.9, cursor: "grabbing" }}>
            <TicketCard ticket={activeTicket} isDragging />
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default memo(TicketKanbanView);
