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
  Box,
  Typography,
  LinearProgress,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { useSnack } from "@/components/feedback/SnackbarProvider";
import { storage } from "@/utils/firebaseInit";

export default function EditLocationDialog({
  open,
  onClose,
  location,
  onSave,
  onDelete,
}) {
  const snack = useSnack();
  const [name, setName] = useState(location?.name || "");
  const [notes, setNotes] = useState(location?.notes || "");
  const [category, setCategory] = useState(location?.category || "general");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(location?.imageUrl || null);
  const [uploading, setUploading] = useState(false);

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        snack.show("Please select an image file", "error");
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      snack.show("Location name is required", "error");
      return;
    }
    if (!notes.trim()) {
      snack.show("Notes are required", "error");
      return;
    }

    let imageUrl = location?.imageUrl;
    let imagePath = location?.imagePath;

    // Upload new image if selected
    if (imageFile) {
      setUploading(true);
      try {
        const fileName = `${Date.now()}-${imageFile.name}`;
        const storagePath = `dropoffs/${fileName}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
        imagePath = storagePath;

        snack.show("Image uploaded successfully", "success");
      } catch (error) {
        console.error("Image upload error:", error);
        snack.show("Failed to upload image: " + error.message, "error");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onSave({
      ...location,
      name: name.trim(),
      notes: notes.trim(),
      category,
      imageUrl,
      imagePath,
    });
  };

  const handleDelete = () => {
    // eslint-disable-next-line no-alert
    if (window.confirm(`Are you sure you want to delete "${location.name}"?`)) {
      onDelete(location.id);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {location?.id ? "Edit Location" : "Add Location"}
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
            helperText="e.g., general, restaurant, hotel, venue"
          />

          <TextField
            label="Notes / Instructions"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={4}
            fullWidth
            required
            helperText="Driving instructions and important notes for drivers"
          />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Location Image
            </Typography>
            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
              fullWidth
            >
              Upload Image
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={handleImageChange}
              />
            </Button>

            {imagePreview && (
              <Box sx={{ mt: 2 }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    width: "100%",
                    maxHeight: 300,
                    objectFit: "contain",
                    borderRadius: 8,
                  }}
                />
              </Box>
            )}
          </Box>

          {uploading && <LinearProgress />}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {location?.id && (
          <Button onClick={handleDelete} color="error" sx={{ mr: "auto" }}>
            Delete
          </Button>
        )}
        <Button onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={uploading}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
