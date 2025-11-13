import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import ViewListIcon from "@mui/icons-material/ViewList";

import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import { useAuth } from "@/context/AuthContext.jsx";
import TicketFormDialog from "@/tickets/TicketFormDialog.jsx";
import TicketKanbanView from "@/tickets/TicketKanbanView.jsx";
import TicketListView from "@/tickets/TicketListView.jsx";
import TicketDetailDrawer from "@/tickets/TicketDetailDrawer.jsx";
import logError from "@/utils/logError.js";

const VIEW_STORAGE_KEY = "lrp:tickets:view";

export default function TicketsPage() {
  const { user, role } = useAuth();
  const { show } = useSnack();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [optimisticTicket, setOptimisticTicket] = useState(null);
  const [view, setView] = useState(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      return stored === "list" ? "list" : "kanban";
    } catch {
      return "kanban";
    }
  });

  const handleOpen = useCallback(() => {
    if (!user) {
      show("Please sign in to create a support ticket.", "warning");
      return;
    }
    setDialogOpen(true);
  }, [show, user]);

  const handleClose = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleSelect = useCallback((ticket) => {
    if (!ticket) return;
    setSelectedTicket(ticket);
    setDrawerOpen(true);
  }, []);

  const handleTicketUpdated = useCallback((patched) => {
    if (!patched) return;
    const patchId =
      patched.id || patched.ticketId || patched.docId || patched._id || null;
    if (!patchId) return;
    setSelectedTicket((prev) => {
      if (!prev) return prev;
      const prevIds = [prev.id, prev.ticketId, prev.docId, prev._id].filter(
        Boolean,
      );
      if (!prevIds.includes(patchId)) {
        return prev;
      }
      return { ...prev, ...patched };
    });
    setOptimisticTicket({ ...patched, _optimisticAt: Date.now() });
  }, []);

  const handleTicketCreated = useCallback((created) => {
    if (!created) return;
    const createdId =
      created.id || created.ticketId || created.docId || created._id || null;
    if (!createdId) return;
    setOptimisticTicket({ ...created, _optimisticAt: Date.now() });
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    if (!selectedTicket) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Closing drawer when ticket is deselected
      setDrawerOpen(false);
    }
  }, [drawerOpen, selectedTicket]);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelectedTicket(null);
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        // Clear query parameters that trigger auto-open
        url.searchParams.delete("id");
        url.searchParams.delete("ticketId");
        // Clear hash-based query if present
        if (url.hash.includes("?")) {
          url.hash = url.hash.split("?")[0];
        } else if (url.hash.startsWith("#/tickets")) {
          url.hash = "#/tickets";
        }
        window.history.replaceState(null, "", url.toString());
      } catch (err) {
        logError(err, { where: "TicketsPage.clearHash" });
      }
    }
  }, []);

  const handleViewChange = useCallback((event, newView) => {
    if (newView && (newView === "kanban" || newView === "list")) {
      setView(newView);
      try {
        localStorage.setItem(VIEW_STORAGE_KEY, newView);
      } catch (err) {
        logError(err, { where: "TicketsPage.saveViewPreference" });
      }
    }
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        p: { xs: 2, md: 3 },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          🎫 Support Tickets
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          <ToggleButtonGroup
            value={view}
            exclusive
            onChange={handleViewChange}
            size="small"
            sx={{
              bgcolor: (t) => t.palette.background.paper,
              "& .MuiToggleButton-root": {
                border: (t) => `1px solid ${t.palette.divider}`,
                "&.Mui-selected": {
                  bgcolor: (t) => t.palette.primary.main,
                  color: (t) => t.palette.primary.contrastText,
                  "&:hover": {
                    bgcolor: (t) => t.palette.primary.dark,
                  },
                },
              },
            }}
          >
            <ToggleButton value="kanban" aria-label="Kanban view">
              <Tooltip title="Kanban View">
                <ViewKanbanIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="list" aria-label="List view">
              <Tooltip title="List View">
                <ViewListIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            onClick={handleOpen}
            sx={{
              bgcolor: (t) => t.palette.primary.main,
              "&:hover": { bgcolor: (t) => t.palette.primary.dark },
            }}
          >
            New Support Ticket
          </Button>
        </Box>
      </Box>

      {view === "kanban" ? (
        <TicketKanbanView
          onSelect={handleSelect}
          activeTicketId={selectedTicket?.id}
          optimisticTicket={optimisticTicket}
        />
      ) : (
        <TicketListView
          onSelect={handleSelect}
          activeTicketId={selectedTicket?.id}
          optimisticTicket={optimisticTicket}
        />
      )}

      <TicketFormDialog
        open={dialogOpen}
        onClose={handleClose}
        currentUser={user}
        onSaved={handleTicketCreated}
      />

      <TicketDetailDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        ticket={selectedTicket}
        currentUser={user}
        isAdmin={role === "admin"}
        onTicketUpdated={handleTicketUpdated}
      />
    </Box>
  );
}
