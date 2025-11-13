/* Proprietary and confidential. See LICENSE. */

import { useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Stack,
  IconButton,
  Link as MuiLink,
  useTheme,
  Avatar,
  Dialog,
  DialogContent,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import InfoIcon from "@mui/icons-material/Info";

import { formatPhoneDisplay } from "@/services/directoryService";
import {
  ESCALATION_TIERS,
  getTierColor,
  getVehicleColor,
} from "@/constants/directory";
import { ROLE_LABELS } from "@/constants/roles";

export default function ContactCard({ contact, isAdmin, onEdit }) {
  const theme = useTheme();
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  // Support both old (single) and new (array) tier structure
  const tiers = contact.escalationTiers
    ? contact.escalationTiers
        .map((value) => ESCALATION_TIERS.find((t) => t.value === value))
        .filter(Boolean)
    : contact.escalationTier
      ? [
          ESCALATION_TIERS.find((t) => t.value === contact.escalationTier),
        ].filter(Boolean)
      : [];

  const handleEditClick = (e) => {
    e.stopPropagation();
    onEdit?.();
  };

  const handleImageClick = (e) => {
    e.stopPropagation();
    if (contact.imageUrl) {
      setImageDialogOpen(true);
    }
  };

  // Use the first tier's color for the border
  const primaryTier = tiers[0];

  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.2s",
        position: "relative",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: 6,
        },
        borderTop: primaryTier
          ? `4px solid ${getTierColor(primaryTier.value, theme)}`
          : "none",
      }}
    >
      {/* Admin Edit Button */}
      {isAdmin && (
        <IconButton
          onClick={handleEditClick}
          size="small"
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            backgroundColor: (t) => t.palette.background.paper,
            "&:hover": {
              backgroundColor: (t) => t.palette.action.hover,
            },
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      )}

      <CardContent sx={{ flex: 1, pt: isAdmin ? 5 : 2 }}>
        <Stack spacing={2}>
          {/* Profile Picture and Name */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              src={contact.imageUrl}
              alt={contact.name}
              onClick={handleImageClick}
              sx={{
                width: 56,
                height: 56,
                bgcolor: primaryTier
                  ? getTierColor(primaryTier.value, theme)
                  : "primary.main",
                fontSize: "1.5rem",
                fontWeight: 600,
                cursor: contact.imageUrl ? "pointer" : "default",
                "&:hover": contact.imageUrl
                  ? {
                      opacity: 0.8,
                      transform: "scale(1.05)",
                      transition: "all 0.2s",
                    }
                  : {},
              }}
            >
              {!contact.imageUrl && contact.name
                ? contact.name.charAt(0).toUpperCase()
                : ""}
            </Avatar>
            <Box flex={1}>
              <Typography variant="h6" fontWeight={700}>
                {contact.name}
              </Typography>
            </Box>
          </Stack>

          {/* Tier Badges and User Access */}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {tiers.map((tier) => (
              <Chip
                key={tier.value}
                label={tier.label}
                size="small"
                sx={{
                  backgroundColor: getTierColor(tier.value, theme),
                  color: "common.white",
                  fontWeight: 600,
                }}
              />
            ))}
            {contact.userAccess && (
              <Chip
                label={`Access: ${ROLE_LABELS[contact.userAccess] || contact.userAccess}`}
                size="small"
                variant="outlined"
                color="primary"
                sx={{
                  fontWeight: 600,
                }}
              />
            )}
          </Stack>

          {/* Vehicle Chips */}
          {contact.vehicles && contact.vehicles.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {contact.vehicles.map((vehicle) => (
                <Chip
                  key={vehicle}
                  label={vehicle}
                  size="small"
                  sx={{
                    backgroundColor: getVehicleColor(vehicle, theme),
                    color: "common.white",
                    fontWeight: 600,
                  }}
                />
              ))}
            </Stack>
          )}

          {/* Phone */}
          {contact.phone && (
            <Stack direction="row" spacing={1} alignItems="center">
              <PhoneIcon fontSize="small" color="action" />
              <MuiLink
                href={`tel:${contact.phone}`}
                sx={{
                  textDecoration: "none",
                  fontWeight: 500,
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                {formatPhoneDisplay(contact.phone)}
              </MuiLink>
            </Stack>
          )}

          {/* Email */}
          {contact.email && (
            <Stack direction="row" spacing={1} alignItems="center">
              <EmailIcon fontSize="small" color="action" />
              <MuiLink
                href={`mailto:${contact.email}`}
                sx={{
                  textDecoration: "none",
                  fontSize: "0.875rem",
                  wordBreak: "break-word",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                {contact.email}
              </MuiLink>
            </Stack>
          )}

          {/* Availability Hours */}
          {contact.availabilityHours && (
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <AccessTimeIcon
                fontSize="small"
                color="action"
                sx={{ mt: 0.25 }}
              />
              <Typography variant="body2" color="text.secondary">
                {contact.availabilityHours}
              </Typography>
            </Stack>
          )}

          {/* Notes */}
          {contact.notes && (
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <InfoIcon fontSize="small" color="action" sx={{ mt: 0.25 }} />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {contact.notes}
              </Typography>
            </Stack>
          )}

          {/* Inactive Badge */}
          {!contact.active && (
            <Chip
              label="Inactive"
              size="small"
              color="default"
              sx={{ alignSelf: "flex-start" }}
            />
          )}
        </Stack>
      </CardContent>

      {/* Image View Dialog */}
      <Dialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <IconButton
          onClick={() => setImageDialogOpen(false)}
          sx={{
            position: "absolute",
            right: 8,
            top: 8,
            color: "common.white",
            bgcolor: "action.disabled",
            "&:hover": {
              bgcolor: "action.selected",
            },
            zIndex: 1,
          }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent sx={{ p: 0, bgcolor: "background.default" }}>
          <Box
            component="img"
            src={contact.imageUrl}
            alt={contact.name}
            sx={{
              width: "100%",
              height: "auto",
              display: "block",
            }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
