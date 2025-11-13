/* Proprietary and confidential. See LICENSE. */

import { useState } from "react";
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  Box,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";

import { useSnack } from "@/components/feedback/SnackbarProvider";
import { trackLocationView } from "@/services/driverInfoService";

export default function LocationCard({ location, isAdmin, onEdit }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const snack = useSnack();

  const handleEditClick = (e) => {
    e.stopPropagation(); // Prevent card click from firing
    onEdit?.();
  };

  const handleCardClick = () => {
    setDialogOpen(true);
    // Track view when card is clicked
    trackLocationView(location.id);
  };

  const handleCopyNotes = async () => {
    try {
      await navigator.clipboard.writeText(location.notes);

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([50]);
      }

      snack.show("Notes copied!", "success");
    } catch {
      snack.show("Failed to copy notes", "error");
    }
  };

  return (
    <>
      <Card
        onClick={handleCardClick}
        sx={{
          cursor: "pointer",
          transition: "all 0.2s",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: 6,
          },
        }}
      >
        {/* Image with Gradient Overlay */}
        <Box sx={{ position: "relative" }}>
          {!imageLoaded && <Skeleton variant="rectangular" height={200} />}
          {location.imageUrl && (
            <CardMedia
              component="img"
              height="200"
              image={location.imageUrl}
              alt={location.name}
              onLoad={() => setImageLoaded(true)}
              sx={{
                display: imageLoaded ? "block" : "none",
                objectFit: "cover",
              }}
            />
          )}
          {/* Gradient overlay for text legibility */}
          <Box
            sx={(theme) => ({
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "50%",
              background:
                theme.palette.mode === "dark"
                  ? "linear-gradient(to top, rgba(18, 18, 18, 0.9) 0%, rgba(18, 18, 18, 0) 100%)" // allow-color-literal - gradient overlay for image
                  : "linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0) 100%)", // allow-color-literal - gradient overlay for image
            })}
          />
          {/* Admin Edit Button */}
          {isAdmin && (
            <IconButton
              onClick={handleEditClick}
              sx={{
                position: "absolute",
                top: 8,
                right: 8,
                backgroundColor: "rgba(255, 255, 255, 0.9)", // allow-color-literal - button background on image
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 1)", // allow-color-literal - button hover on image
                },
              }}
            >
              <EditIcon />
            </IconButton>
          )}
          {/* Location name on image */}
          <Typography
            variant="h6"
            sx={{
              position: "absolute",
              bottom: 8,
              left: 8,
              right: 8,
              color: "common.white",
              fontWeight: 700,
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)", // allow-color-literal - text shadow for legibility on images
            }}
          >
            {location.name}
          </Typography>
        </Box>

        {/* Truncated Notes */}
        <CardContent>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {location.notes}
          </Typography>
        </CardContent>
      </Card>

      {/* Full-screen Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: "90vh",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>{location.name}</DialogTitle>

        <DialogContent dividers>
          {/* Full Image */}
          {location.imageUrl && (
            <Box
              component="img"
              src={location.imageUrl}
              alt={location.name}
              sx={{
                width: "100%",
                height: "auto",
                borderRadius: 1,
                mb: 2,
              }}
            />
          )}

          {/* Complete Notes */}
          <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
            {location.notes}
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={handleCopyNotes}
            variant="outlined"
          >
            Copy Notes
          </Button>
          <Button onClick={() => setDialogOpen(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
