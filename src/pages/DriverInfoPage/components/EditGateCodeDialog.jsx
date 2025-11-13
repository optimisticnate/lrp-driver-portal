/* Proprietary and confidential. See LICENSE. */

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Chip,
  Box,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";

import { useSnack } from "@/components/feedback/SnackbarProvider";

export default function EditGateCodeDialog({
  open,
  onClose,
  gateCode,
  onSave,
  onDelete,
}) {
  const snack = useSnack();
  const [name, setName] = useState(gateCode?.name || "");
  const [codes, setCodes] = useState(gateCode?.codes || []);
  const [newCode, setNewCode] = useState("");
  const [category, setCategory] = useState(gateCode?.category || "general");

  const handleAddCode = () => {
    if (!newCode.trim()) return;
    setCodes([...codes, newCode.trim()]);
    setNewCode("");
  };

  const handleDeleteCode = (index) => {
    setCodes(codes.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!name.trim()) {
      snack.show("Location name is required", "error");
      return;
    }
    if (codes.length === 0) {
      snack.show("At least one code is required", "error");
      return;
    }

    onSave({
      ...gateCode,
      name: name.trim(),
      codes,
      category,
    });
  };

  const handleDelete = () => {
    // eslint-disable-next-line no-alert
    if (window.confirm(`Are you sure you want to delete "${gateCode.name}"?`)) {
      onDelete(gateCode.id);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {gateCode?.id ? "Edit Gate Code" : "Add Gate Code"}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="Location Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
          />

          <TextField
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            fullWidth
            helperText="e.g., general, residential, commercial"
          />

          <Box>
            <TextField
              label="Add Code"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddCode()}
              fullWidth
              InputProps={{
                endAdornment: (
                  <IconButton onClick={handleAddCode} edge="end">
                    <AddIcon />
                  </IconButton>
                ),
              }}
              helperText="Press Enter or click + to add"
            />

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
              {/* eslint-disable react/no-array-index-key */}
              {codes.map((code, index) => (
                <Chip
                  key={`${code}-${index}`}
                  label={code}
                  onDelete={() => handleDeleteCode(index)}
                  deleteIcon={<DeleteIcon />}
                />
              ))}
              {/* eslint-enable react/no-array-index-key */}
            </Box>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {gateCode?.id && (
          <Button onClick={handleDelete} color="error" sx={{ mr: "auto" }}>
            Delete
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
