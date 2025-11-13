/* Proprietary and confidential. See LICENSE. */

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Switch,
  FormControlLabel,
  Autocomplete,
  Alert,
  Chip,
  useTheme,
  Avatar,
  Box,
  Typography,
} from "@mui/material";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import ClearIcon from "@mui/icons-material/Clear";

import { useSnack } from "@/components/feedback/SnackbarProvider";
import {
  ESCALATION_TIERS,
  DEFAULT_CONTACT,
  VEHICLE_TYPES,
  getVehicleColor,
} from "@/constants/directory";
import {
  validatePhone,
  validateEmail,
  parsePhoneToE164,
  formatPhoneDisplay,
  uploadContactImage,
  deleteContactImage,
} from "@/services/directoryService";

export default function DirectoryDialog({
  open,
  onClose,
  contact,
  onSave,
  onDelete,
}) {
  const snack = useSnack();
  const theme = useTheme();

  // Compute initial form values
  const initialFormState = useMemo(
    () => ({
      name: contact?.name || DEFAULT_CONTACT.name,
      phone: contact?.phone
        ? formatPhoneDisplay(contact.phone)
        : DEFAULT_CONTACT.phone,
      email: contact?.email || DEFAULT_CONTACT.email,
      imageUrl: contact?.imageUrl || DEFAULT_CONTACT.imageUrl,
      escalationTiers:
        contact?.escalationTiers && contact.escalationTiers.length > 0
          ? contact.escalationTiers // Use new array format
          : contact?.escalationTier
            ? [contact.escalationTier] // Migrate old single tier to array
            : DEFAULT_CONTACT.escalationTiers,
      vehicles: contact?.vehicles || DEFAULT_CONTACT.vehicles,
      availabilityHours:
        contact?.availabilityHours || DEFAULT_CONTACT.availabilityHours,
      notes: contact?.notes || DEFAULT_CONTACT.notes,
      active: contact?.active ?? DEFAULT_CONTACT.active,
      priority: contact?.priority ?? DEFAULT_CONTACT.priority,
    }),
    [contact],
  );

  const [formData, setFormData] = useState(initialFormState);
  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(contact?.imageUrl || null);
  const [uploading, setUploading] = useState(false);

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear errors when user starts typing
    if (field === "phone" && phoneError) {
      setPhoneError("");
    }
    if (field === "email" && emailError) {
      setEmailError("");
    }
  };

  const handleNumberChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: Number(e.target.value) }));
  };

  const handleTiersChange = (event, newValue) => {
    setFormData((prev) => ({ ...prev, escalationTiers: newValue }));
  };

  const handleVehiclesChange = (event, newValue) => {
    setFormData((prev) => ({ ...prev, vehicles: newValue }));
  };

  const handleSwitchChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.checked }));
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      snack.show("Please select an image file", "error");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      snack.show("Image must be less than 5MB", "error");
      return;
    }

    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleImageRemove = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setFormData((prev) => ({ ...prev, imageUrl: "" }));
  };

  const handleSave = async () => {
    // Validation
    if (!formData.name.trim()) {
      snack.show("Name is required", "error");
      return;
    }

    if (!formData.phone.trim()) {
      snack.show("Phone number is required", "error");
      return;
    }

    // Parse phone to E.164 format
    const phoneE164 = parsePhoneToE164(formData.phone);
    if (!validatePhone(phoneE164)) {
      setPhoneError("Invalid phone number format. Use 10-digit US number.");
      snack.show("Invalid phone number format", "error");
      return;
    }

    // Validate email if provided
    if (formData.email && !validateEmail(formData.email)) {
      setEmailError("Invalid email format");
      snack.show("Invalid email format", "error");
      return;
    }

    try {
      setUploading(true);

      let imageUrl = formData.imageUrl;

      // Handle image upload if a new image was selected
      if (selectedImage) {
        // Delete old image if exists and is changing
        if (contact?.imageUrl) {
          await deleteContactImage(contact.imageUrl);
        }

        // Upload new image
        const contactId = contact?.id || "temp";
        imageUrl = await uploadContactImage(selectedImage, contactId);
      }

      onSave({
        ...contact,
        name: formData.name.trim(),
        phone: phoneE164,
        email: formData.email.trim() || null,
        imageUrl: imageUrl || null,
        escalationTiers: formData.escalationTiers,
        vehicles: formData.vehicles,
        availabilityHours: formData.availabilityHours.trim() || null,
        notes: formData.notes.trim() || null,
        active: formData.active,
        priority: formData.priority,
      });
    } catch (error) {
      snack.show("Failed to upload image", "error");
      console.error("Image upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = () => {
    // Parent component (DirectoryPage) handles confirmation dialog
    onDelete(contact);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{contact?.id ? "Edit Contact" : "Add Contact"}</DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="Name"
            value={formData.name}
            onChange={handleChange("name")}
            fullWidth
            required
            helperText="Full name of the contact person"
          />

          {/* Profile Picture Upload */}
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Profile Picture
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                src={imagePreview}
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: "primary.main",
                  fontSize: "2rem",
                }}
              >
                {!imagePreview && formData.name
                  ? formData.name.charAt(0).toUpperCase()
                  : ""}
              </Avatar>
              <Stack spacing={1}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<PhotoCameraIcon />}
                  size="small"
                >
                  {imagePreview ? "Change Photo" : "Upload Photo"}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleImageSelect}
                  />
                </Button>
                {imagePreview && (
                  <Button
                    onClick={handleImageRemove}
                    startIcon={<ClearIcon />}
                    size="small"
                    color="error"
                  >
                    Remove Photo
                  </Button>
                )}
                <Typography variant="caption" color="text.secondary">
                  Max 5MB • JPG, PNG, GIF
                </Typography>
              </Stack>
            </Stack>
          </Box>

          <TextField
            label="Phone"
            value={formData.phone}
            onChange={handleChange("phone")}
            fullWidth
            required
            error={!!phoneError}
            helperText={
              phoneError ||
              "Enter 10-digit US number (e.g., 5738885555 or (573) 888-5555)"
            }
          />

          <TextField
            label="Email"
            value={formData.email}
            onChange={handleChange("email")}
            fullWidth
            type="email"
            error={!!emailError}
            helperText={emailError || "Optional - Email address for contact"}
          />

          <Autocomplete
            multiple
            value={formData.escalationTiers}
            onChange={handleTiersChange}
            options={ESCALATION_TIERS.map((t) => t.value)}
            getOptionLabel={(option) => {
              const tier = ESCALATION_TIERS.find((t) => t.value === option);
              return tier ? tier.label : String(option);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Roles"
                required={formData.escalationTiers.length === 0}
                helperText="Select one or more roles for this contact"
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const tier = ESCALATION_TIERS.find((t) => t.value === option);
                return (
                  <Chip
                    key={option}
                    label={tier?.label || String(option)}
                    {...getTagProps({ index })}
                    size="small"
                  />
                );
              })
            }
          />

          {formData.escalationTiers.length > 0 && (
            <Alert severity="info">
              <strong>Selected roles:</strong>
              <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
                {formData.escalationTiers.map((tierValue) => {
                  const tier = ESCALATION_TIERS.find(
                    (t) => t.value === tierValue,
                  );
                  return tier ? (
                    <li key={tierValue}>
                      <strong>{tier.label}:</strong> {tier.description}
                    </li>
                  ) : null;
                })}
              </ul>
            </Alert>
          )}

          <Autocomplete
            multiple
            value={formData.vehicles}
            onChange={handleVehiclesChange}
            options={VEHICLE_TYPES}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Vehicles"
                helperText="Select vehicle types this contact operates"
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  key={option}
                  label={option}
                  {...getTagProps({ index })}
                  size="small"
                  sx={{
                    backgroundColor: getVehicleColor(option, theme),
                    color: "common.white",
                    fontWeight: 600,
                  }}
                />
              ))
            }
          />

          <TextField
            label="Availability Hours"
            value={formData.availabilityHours}
            onChange={handleChange("availabilityHours")}
            fullWidth
            helperText='Optional - e.g., "24/7", "M-F 9am-5pm", "Weekends only"'
          />

          <TextField
            label="Notes"
            value={formData.notes}
            onChange={handleChange("notes")}
            fullWidth
            multiline
            rows={3}
            helperText="Optional - Additional information or special instructions"
          />

          <TextField
            label="Priority"
            value={formData.priority}
            onChange={handleNumberChange("priority")}
            fullWidth
            type="number"
            helperText="Lower numbers appear first (default: 999)"
          />

          <FormControlLabel
            control={
              <Switch
                checked={formData.active}
                onChange={handleSwitchChange("active")}
              />
            }
            label="Active"
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {contact?.id && (
          <Button onClick={handleDelete} color="error" sx={{ mr: "auto" }}>
            Delete
          </Button>
        )}
        <Button onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={uploading}>
          {uploading ? "Uploading..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
