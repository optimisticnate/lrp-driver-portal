/* Proprietary and confidential. See LICENSE. */
// src/components/AdminUserManager.jsx
import { useEffect, useState, useCallback } from "react";
import {
  Card,
  Paper,
  TextField,
  Button,
  Snackbar,
  Alert,
  Typography,
  Stack,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Box,
  Chip,
  InputAdornment,
  Fab,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import AddIcon from "@mui/icons-material/Add";
import { doc, setDoc } from "firebase/firestore";

import { ROLES, ROLE_LABELS } from "../constants/roles";
import { subscribeUserAccess } from "../hooks/api";
import { useDriver } from "../context/DriverContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { db } from "../utils/firebaseInit";
import {
  createUser,
  updateUser,
  deleteUser,
} from "../utils/firestoreService.js";
import logError from "../utils/logError.js";

// --- helpers: robust parsing for lines and "email,role" ---
function parseUserLines(input) {
  const raw = typeof input === "string" ? input : "";
  return raw
    .split(/\r?\n|\r/g) // CRLF/CR/LF safe
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseCsvLine(line) {
  // Accept comma OR tab: "Name,email,phone,access" OR "Name\temail\tphone\taccess"
  const [nameRaw, emailRaw, phoneRaw, accessRaw] = line
    .split(/[,\t]/)
    .map((s) => (s || "").trim());
  const name = nameRaw || "";
  const email = (emailRaw || "").toLowerCase();
  const phone = phoneRaw || "";
  const access = (accessRaw || "").toLowerCase();
  return { name, email, phone, access };
}

export default function AdminUserManager() {
  const { driver } = useDriver();
  const { user, role: currentRole, authLoading, roleLoading } = useAuth();
  const role = driver?.access || currentRole || "user";
  const isAdmin = role === "admin";
  const [input, setInput] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    phone: "",
    access: "driver",
  });

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    email: "",
    name: "",
  });

  const [editDialog, setEditDialog] = useState({
    open: false,
    user: null,
  });

  const [addUserDialog, setAddUserDialog] = useState(false);

  // 🗑️ Delete user handlers
  const handleDeleteClick = useCallback(
    (row) => {
      if (!isAdmin) {
        setSnackbar({
          open: true,
          message: "Admin access required",
          severity: "error",
        });
        return;
      }
      setDeleteDialog({
        open: true,
        email: row.email,
        name: row.name,
      });
    },
    [isAdmin],
  );

  const handleDeleteCancel = useCallback(() => {
    setDeleteDialog({
      open: false,
      email: "",
      name: "",
    });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!isAdmin) {
      setSnackbar({
        open: true,
        message: "Admin access required",
        severity: "error",
      });
      handleDeleteCancel();
      return;
    }

    const { email, name } = deleteDialog;
    try {
      const result = await deleteUser(email);
      setSnackbar({
        open: true,
        message: result.message || `User ${name} deleted successfully`,
        severity: "success",
      });
    } catch (err) {
      logError(err, "AdminUserManager:deleteUser");
      const errorMessage = err?.message || err?.toString() || "Delete failed";
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: "error",
      });
    } finally {
      handleDeleteCancel();
    }
  }, [isAdmin, deleteDialog, handleDeleteCancel]);

  // ✏️ Edit user handlers
  const handleEditClick = useCallback(
    (row) => {
      if (!isAdmin) {
        setSnackbar({
          open: true,
          message: "Admin access required",
          severity: "error",
        });
        return;
      }
      setEditDialog({
        open: true,
        user: { ...row },
      });
    },
    [isAdmin],
  );

  const handleEditCancel = useCallback(() => {
    setEditDialog({
      open: false,
      user: null,
    });
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!isAdmin) {
      setSnackbar({
        open: true,
        message: "Admin access required",
        severity: "error",
      });
      handleEditCancel();
      return;
    }

    const { user: editedUser } = editDialog;
    try {
      await updateUser({
        email: editedUser.id,
        access: editedUser.access,
        name: editedUser.name,
        phone: editedUser.phone,
      });
      await setDoc(
        doc(db, "users", editedUser.email),
        {
          name: editedUser.name,
          email: editedUser.email,
          phone: editedUser.phone,
          role: editedUser.access,
        },
        { merge: true },
      );
      setSnackbar({
        open: true,
        message: "User updated successfully",
        severity: "success",
      });
    } catch (err) {
      logError(err, "AdminUserManager:handleEditSave");
      const errorMessage = err?.message || err?.toString() || "Update failed";
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: "error",
      });
    } finally {
      handleEditCancel();
    }
  }, [isAdmin, editDialog, handleEditCancel]);

  // ➕ Add User Dialog handlers
  const handleOpenAddUserDialog = useCallback(() => {
    if (!isAdmin) {
      setSnackbar({
        open: true,
        message: "Admin access required",
        severity: "error",
      });
      return;
    }
    setAddUserDialog(true);
  }, [isAdmin]);

  const handleCloseAddUserDialog = useCallback(() => {
    setAddUserDialog(false);
    setNewUser({ name: "", email: "", phone: "", access: "driver" });
  }, []);

  // Filter users based on search query
  const filteredUsers = rows.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.phone?.toLowerCase().includes(query) ||
      user.access?.toLowerCase().includes(query)
    );
  });

  // 🔄 Subscribe to Firestore
  useEffect(() => {
    if (authLoading || !user?.email) return undefined;

    const unsubscribe = subscribeUserAccess(
      (list = []) => {
        const mapped = list.map((r) => ({
          id: r.id || r.email,
          email: (r.email || r.id || "").toLowerCase(),
          name: r.name || "",
          phone: r.phone || "",
          access: (r.access || "").toLowerCase(),
        }));
        setRows(mapped);
        setLoading(false);
      },
      { roles: ROLES },
      () => {
        setSnackbar({
          open: true,
          message: "Permissions issue loading users",
          severity: "error",
        });
        setLoading(false);
      },
    );

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [authLoading, user?.email]);

  if (authLoading || roleLoading || currentRole === "shootout") return null;

  // ➕ Add Users
  const handleAddUsers = async () => {
    if (!isAdmin) {
      setSnackbar({
        open: true,
        message: "Admin access required",
        severity: "error",
      });
      return;
    }

    const lines = parseUserLines(input);

    const invalids = [];
    const validUsers = [];

    lines.forEach((line, idx) => {
      const { name, email, phone, access } = parseCsvLine(line);
      if (!name || !email || !email.includes("@")) {
        invalids.push(`Line ${idx + 1}: Invalid name or email`);
        return;
      }
      if (!phone) {
        invalids.push(`Line ${idx + 1}: Missing phone`);
        return;
      }
      if (!ROLES.includes(access)) {
        invalids.push(
          `Line ${idx + 1}: Access must be one of ${ROLES.join(", ")}`,
        );
        return;
      }
      validUsers.push({
        name: name.trim(),
        email,
        phone: phone.trim(),
        access,
      });
    });

    if (invalids.length) {
      setSnackbar({
        open: true,
        message: invalids.join(" • "),
        severity: "error",
      });
      return;
    }

    const errors = [];
    for (const u of validUsers) {
      try {
        await createUser(u);
        await setDoc(
          doc(db, "users", u.email),
          { name: u.name, email: u.email, phone: u.phone, role: u.access },
          { merge: true },
        );
      } catch (err) {
        logError(err, "AdminUserManager:createUser");
        errors.push(`${u.email}: ${err?.message || JSON.stringify(err)}`);
      }
    }
    setInput("");
    setSnackbar({
      open: true,
      message: errors.length ? errors.join(" • ") : "✅ Users processed",
      severity: errors.length ? "warning" : "success",
    });
  };

  // ➕ Add a single user manually
  const handleManualAdd = async () => {
    if (!isAdmin) {
      setSnackbar({
        open: true,
        message: "Admin access required",
        severity: "error",
      });
      return;
    }

    const name = newUser.name.trim();
    const email = newUser.email.trim().toLowerCase();
    const phone = newUser.phone.trim();
    const access = newUser.access.trim().toLowerCase();

    if (!name || !email || !email.includes("@") || !phone) {
      setSnackbar({
        open: true,
        message: "Invalid name, email, or phone",
        severity: "error",
      });
      return;
    }
    if (!ROLES.includes(access)) {
      setSnackbar({
        open: true,
        message: "Access must be admin, driver, or shootout",
        severity: "error",
      });
      return;
    }

    try {
      await createUser({ name, email, phone, access });
      await setDoc(
        doc(db, "users", email),
        { name, email, phone, role: access },
        { merge: true },
      );
      setNewUser({ name: "", email: "", phone: "", access: "driver" });
      setAddUserDialog(false);
      setSnackbar({
        open: true,
        message: "User added",
        severity: "success",
      });
    } catch (err) {
      logError(err, "AdminUserManager:handleManualAdd");
      setSnackbar({
        open: true,
        message: err?.message || "Add failed",
        severity: "error",
      });
    }
  };

  return (
    <Card sx={{ p: { xs: 2, sm: 3 }, m: "auto", maxWidth: 1200 }}>
      <Stack spacing={3}>
        {/* Page Header */}
        <Stack spacing={1}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 600,
              fontSize: { xs: "1.75rem", sm: "2.125rem" },
            }}
          >
            User Manager
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ fontSize: { xs: "0.875rem", sm: "1rem" } }}
          >
            Manage user accounts and permissions. Add new users, update access
            levels, and remove accounts. All changes sync with Firebase
            Authentication.
          </Typography>
          {!isAdmin && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Admin access required to modify users
            </Alert>
          )}
        </Stack>

        {/* Bulk Add Users Section */}
        <Stack spacing={2}>
          <Typography
            variant="h6"
            sx={{ fontSize: { xs: "1rem", sm: "1.25rem" } }}
          >
            Bulk Add Users (CSV)
          </Typography>
          <TextField
            label="Users CSV"
            placeholder="Name,email,phone,access"
            multiline
            minRows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            helperText="Format: Name,email,phone,access (one user per line)"
            size="small"
          />
          <Button
            variant="contained"
            onClick={handleAddUsers}
            disabled={!isAdmin}
            sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
          >
            Add Users
          </Button>
        </Stack>

        {/* User List Section */}
        <Stack spacing={2}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            gap={2}
          >
            <Typography
              variant="h6"
              sx={{ fontSize: { xs: "1rem", sm: "1.25rem" } }}
            >
              User List ({filteredUsers.length})
            </Typography>
            <TextField
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              sx={{ minWidth: { xs: "100%", sm: 300 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>

          {loading ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography color="text.secondary">Loading users...</Typography>
            </Box>
          ) : filteredUsers.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography color="text.secondary">
                {searchQuery ? "No users match your search" : "No users found"}
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              {filteredUsers.map((user) => (
                <Paper
                  key={user.id}
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: "divider",
                    "&:hover": {
                      borderColor: "primary.main",
                      boxShadow: 1,
                    },
                    transition: "all 0.2s",
                  }}
                >
                  <Stack spacing={2}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      spacing={1}
                    >
                      <Stack spacing={1.5} sx={{ flex: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <PersonIcon color="action" fontSize="small" />
                          <Typography variant="h6" sx={{ fontSize: "1.1rem" }}>
                            {user.name}
                          </Typography>
                          <Chip
                            label={ROLE_LABELS[user.access] || user.access}
                            size="small"
                            color={
                              user.access === "admin"
                                ? "error"
                                : user.access === "driver"
                                  ? "primary"
                                  : "default"
                            }
                          />
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <EmailIcon
                            color="action"
                            fontSize="small"
                            sx={{ fontSize: "1rem" }}
                          />
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ wordBreak: "break-word" }}
                          >
                            {user.email}
                          </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <PhoneIcon
                            color="action"
                            fontSize="small"
                            sx={{ fontSize: "1rem" }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {user.phone}
                          </Typography>
                        </Stack>
                      </Stack>
                      <Stack
                        direction={{ xs: "row", sm: "column" }}
                        spacing={1}
                        sx={{ width: { xs: "100%", sm: "auto" } }}
                      >
                        <Button
                          variant="outlined"
                          startIcon={<EditIcon />}
                          onClick={() => handleEditClick(user)}
                          disabled={!isAdmin}
                          size="small"
                          fullWidth
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleDeleteClick(user)}
                          disabled={!isAdmin}
                          size="small"
                          fullWidth
                        >
                          Delete
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </Stack>

      <Snackbar
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={deleteDialog.open}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">Confirm Delete User</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete user{" "}
            <strong>{deleteDialog.name}</strong> ({deleteDialog.email})?
            <br />
            <br />
            This will permanently remove:
            <ul>
              <li>User data from the database</li>
              <li>Firebase authentication account</li>
              <li>All associated records</li>
            </ul>
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editDialog.open}
        onClose={handleEditCancel}
        aria-labelledby="edit-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="edit-dialog-title">Edit User</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Name"
              value={editDialog.user?.name || ""}
              onChange={(e) =>
                setEditDialog((prev) => ({
                  ...prev,
                  user: { ...prev.user, name: e.target.value },
                }))
              }
              fullWidth
              autoFocus
            />
            <TextField
              label="Email"
              value={editDialog.user?.email || ""}
              disabled
              fullWidth
              helperText="Email cannot be changed"
            />
            <TextField
              label="Phone"
              value={editDialog.user?.phone || ""}
              onChange={(e) =>
                setEditDialog((prev) => ({
                  ...prev,
                  user: { ...prev.user, phone: e.target.value },
                }))
              }
              fullWidth
            />
            <TextField
              label="Access Level"
              select
              value={editDialog.user?.access || "driver"}
              onChange={(e) =>
                setEditDialog((prev) => ({
                  ...prev,
                  user: { ...prev.user, access: e.target.value },
                }))
              }
              fullWidth
              helperText="Shootout = only Shootout Ride & Time Tracker"
            >
              {ROLES.map((role) => (
                <MenuItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditCancel} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleEditSave}
            color="primary"
            variant="contained"
            autoFocus
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add User Modal */}
      <Dialog
        open={addUserDialog}
        onClose={handleCloseAddUserDialog}
        aria-labelledby="add-user-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="add-user-dialog-title">Add New User</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Name"
              value={newUser.name}
              onChange={(e) =>
                setNewUser((u) => ({ ...u, name: e.target.value }))
              }
              fullWidth
              autoFocus
            />
            <TextField
              label="Email"
              value={newUser.email}
              onChange={(e) =>
                setNewUser((u) => ({ ...u, email: e.target.value }))
              }
              fullWidth
              type="email"
            />
            <TextField
              label="Phone"
              value={newUser.phone}
              onChange={(e) =>
                setNewUser((u) => ({ ...u, phone: e.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Access Level"
              select
              value={newUser.access}
              onChange={(e) =>
                setNewUser((u) => ({ ...u, access: e.target.value }))
              }
              fullWidth
              helperText="Shootout = only Shootout Ride & Time Tracker"
            >
              {ROLES.map((role) => (
                <MenuItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddUserDialog} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleManualAdd}
            color="primary"
            variant="contained"
            autoFocus
          >
            Add User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add user"
        onClick={handleOpenAddUserDialog}
        disabled={!isAdmin}
        sx={{
          position: "fixed",
          bottom: { xs: 16, sm: 24 },
          right: { xs: 16, sm: 24 },
        }}
      >
        <AddIcon />
      </Fab>
    </Card>
  );
}
