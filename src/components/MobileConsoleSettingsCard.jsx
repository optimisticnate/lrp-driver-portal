/* Proprietary and confidential. See LICENSE. */
import { useCallback, useState } from "react";
import {
  Paper,
  Stack,
  Typography,
  Switch,
  FormControlLabel,
  Alert,
} from "@mui/material";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";

// Detect if we're on mobile
function isMobileDevice() {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

const STORAGE_KEY = "lrp:mobileConsole:enabled";

/** Mobile console visibility toggle for Settings page */
export default function MobileConsoleSettingsCard() {
  const [enabled, setEnabled] = useState(() => {
    // Load initial state from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored !== null ? stored === "true" : false;
    } catch (err) {
      console.error("Failed to read mobile console setting:", err);
      return false;
    }
  });
  const isMobile = isMobileDevice();

  const handleToggle = useCallback((event) => {
    const newValue = event.target.checked;
    setEnabled(newValue);
    try {
      localStorage.setItem(STORAGE_KEY, String(newValue));
      // Dispatch custom event so MobileConsole can react immediately
      window.dispatchEvent(
        new CustomEvent("lrp:mobileConsole:toggle", {
          detail: { enabled: newValue },
        }),
      );
    } catch (err) {
      console.error("Failed to save mobile console setting:", err);
    }
  }, []);

  if (!isMobile) {
    return (
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <PhoneAndroidIcon color="disabled" />
          <Typography variant="h6" fontWeight={700}>
            Mobile Console
          </Typography>
        </Stack>
        <Alert severity="info" sx={{ mt: 2 }}>
          Mobile console is only available on mobile devices.
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, borderRadius: 2 }}>
      <Stack spacing={2}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <PhoneAndroidIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Mobile Console
            </Typography>
          </Stack>
        </Stack>

        <FormControlLabel
          control={<Switch checked={enabled} onChange={handleToggle} />}
          label={
            <Stack>
              <Typography variant="body2">
                {enabled ? "Enabled" : "Disabled"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Show diagnostic console overlay on mobile
              </Typography>
            </Stack>
          }
        />

        {enabled && (
          <Alert severity="info">
            The mobile console will appear at the bottom of your screen. You can
            close it anytime by tapping the X button.
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
