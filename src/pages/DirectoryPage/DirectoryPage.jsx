/* Proprietary and confidential. See LICENSE. */

import { useState, useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  Chip,
  Fab,
  Stack,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import { useRole } from "@/hooks/useRole";
import { useDirectory } from "@/hooks/useDirectory";
import {
  ESCALATION_TIERS,
  getTierColor,
  VEHICLE_TYPES,
} from "@/constants/directory";
import DirectoryDialog from "@/components/directory/DirectoryDialog";
import ContactCard from "@/components/directory/ContactCard";

export default function DirectoryPage() {
  const theme = useTheme();
  const { role } = useRole();
  const isAdmin = role === "admin";

  const { contacts, loading, error, addContact, editContact, removeContact } =
    useDirectory({ activeOnly: false });

  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    contact: null,
  });

  // Filter contacts based on search, tier, and vehicle
  const filteredContacts = useMemo(() => {
    let filtered = contacts;

    // Apply tier filter - support both single tier and multiple tiers
    if (tierFilter !== "all") {
      const tier = parseInt(tierFilter, 10);
      filtered = filtered.filter((c) => {
        // Check if contact has escalationTiers array (new format)
        if (Array.isArray(c.escalationTiers)) {
          return c.escalationTiers.includes(tier);
        }
        // Fall back to old single tier format
        return c.escalationTier === tier;
      });
    }

    // Apply vehicle filter
    if (vehicleFilter !== "all") {
      filtered = filtered.filter((c) => {
        if (!Array.isArray(c.vehicles)) return false;
        return c.vehicles.includes(vehicleFilter);
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name?.toLowerCase().includes(query) ||
          c.role?.toLowerCase().includes(query) ||
          c.phone?.includes(query) ||
          c.email?.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [contacts, searchQuery, tierFilter, vehicleFilter]);

  // Handlers
  const handleAddNew = useCallback(() => {
    setEditingContact(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((contact) => {
    setEditingContact(contact);
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(
    async (contactData) => {
      try {
        if (contactData.id) {
          // Update existing
          await editContact(contactData.id, contactData);
        } else {
          // Create new
          await addContact(contactData);
        }
        setDialogOpen(false);
        setEditingContact(null);
      } catch (error) {
        // Error is handled by the hook with snackbar
        console.error("Failed to save contact:", error);
      }
    },
    [addContact, editContact],
  );

  const handleDeleteClick = useCallback((contact) => {
    setDeleteDialog({
      open: true,
      contact,
    });
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setDeleteDialog({
      open: false,
      contact: null,
    });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteDialog.contact) return;

    try {
      await removeContact(deleteDialog.contact.id);
      handleDeleteCancel();
    } catch (error) {
      // Error is handled by the hook with snackbar
      console.error("Failed to delete contact:", error);
    }
  }, [deleteDialog.contact, removeContact, handleDeleteCancel]);

  if (loading && contacts.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography color="error" align="center">
          Failed to load directory contacts
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Stack spacing={3}>
        {/* Filters */}
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <TextField
            label="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, role, phone, or email..."
            size="small"
            sx={{ minWidth: 300, flex: 1 }}
          />

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Filter:
            </Typography>
            <Chip
              label="All"
              onClick={() => setTierFilter("all")}
              color={tierFilter === "all" ? "primary" : "default"}
              size="small"
            />
            {ESCALATION_TIERS.map((tier) => (
              <Chip
                key={tier.value}
                label={tier.label}
                onClick={() => setTierFilter(String(tier.value))}
                sx={{
                  backgroundColor:
                    tierFilter === String(tier.value)
                      ? getTierColor(tier.value, theme)
                      : "default",
                  color:
                    tierFilter === String(tier.value)
                      ? "common.white"
                      : "text.primary",
                  "&:hover": {
                    backgroundColor: getTierColor(tier.value, theme),
                    opacity: 0.8,
                  },
                }}
                size="small"
              />
            ))}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Vehicles:
            </Typography>
            <Chip
              label="All"
              onClick={() => setVehicleFilter("all")}
              color={vehicleFilter === "all" ? "secondary" : "default"}
              size="small"
            />
            {VEHICLE_TYPES.map((vehicle) => (
              <Chip
                key={vehicle}
                label={vehicle}
                onClick={() => setVehicleFilter(vehicle)}
                color={vehicleFilter === vehicle ? "secondary" : "default"}
                variant={vehicleFilter === vehicle ? "filled" : "outlined"}
                size="small"
              />
            ))}
          </Stack>
        </Stack>

        {/* Contact Cards */}
        {filteredContacts.length === 0 ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No contacts found
            </Typography>
            {searchQuery && (
              <Typography variant="body2" color="text.secondary">
                Try adjusting your search or filters
              </Typography>
            )}
          </Box>
        ) : (
          <Grid container spacing={3}>
            {filteredContacts.map((contact) => (
              <Grid item xs={12} sm={6} md={4} key={contact.id}>
                <ContactCard
                  contact={contact}
                  isAdmin={isAdmin}
                  onEdit={() => handleEdit(contact)}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Stack>

      {/* FAB for adding contact (admin only) */}
      {isAdmin && (
        <Fab
          color="primary"
          aria-label="add contact"
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
          }}
          onClick={handleAddNew}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Edit/Add Dialog */}
      <DirectoryDialog
        key={dialogOpen ? editingContact?.id || "new" : "closed"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        contact={editingContact}
        onSave={handleSave}
        onDelete={handleDeleteClick}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={handleDeleteCancel}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Contact</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete &ldquo;{deleteDialog.contact?.name}
            &rdquo;? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
