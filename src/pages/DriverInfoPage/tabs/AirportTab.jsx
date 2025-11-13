/* Proprietary and confidential. See LICENSE. */

import { useRef } from "react";
import {
  Box,
  Typography,
  Stack,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Link as MUILink,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DownloadIcon from "@mui/icons-material/Download";
import QRCode from "react-qr-code";

const FLW_URL = "https://pass.aie.army.mil/steps/installation_selection";

export default function AirportTab() {
  const qrRef = useRef(null);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(FLW_URL);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);

    const canvas = document.createElement("canvas");
    const scale = 4; // increase for higher DPI
    const size = parseInt(svg.getAttribute("width") || "256", 10) * scale;
    canvas.width = size;
    canvas.height = size;

    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, size, size);
      const pngFile = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngFile;
      a.download = "FLW_PreReg_QR.png";
      a.click();
    };
    img.src =
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Title */}
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        ✈️ Airport Pickup: Waynesville–St. Robert (Fort Leonard Wood)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Pre-register at least 24 hours before pickup
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Passengers should complete pre-registration at least{" "}
        <strong>24 hours before pickup</strong>. If under 24 hours, they must
        complete it on site at the security checkpoint.
      </Alert>

      {/* QR Code and Portal Info */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={3}
        alignItems="flex-start"
        sx={{ mb: 3 }}
      >
        {/* QR Code */}
        <Box
          ref={qrRef}
          sx={{
            p: 2,
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 2,
            backgroundColor: "background.paper",
          }}
        >
          <QRCode value={FLW_URL} size={196} />
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} useFlexGap>
            <Button
              size="small"
              variant="outlined"
              startIcon={<OpenInNewIcon />}
              href={FLW_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Portal
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopyLink}
            >
              Copy Link
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadQR}
            >
              Download QR
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
            Portal:{" "}
            <MUILink href={FLW_URL} target="_blank" rel="noopener noreferrer">
              pass.aie.army.mil/steps/installation_selection
            </MUILink>
          </Typography>
        </Box>

        {/* Summary - Always Visible */}
        <Box sx={{ flex: 1, minWidth: 280 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Quick Summary
          </Typography>
          <Box component="ul" sx={{ pl: 3, lineHeight: 1.8, m: 0 }}>
            <li>Pre-register 24+ hours in advance</li>
            <li>Scan QR code or visit portal</li>
            <li>Select Army → Fort Leonard Wood</li>
            <li>Choose reason: Airport, Hotel, Museum, or Visit</li>
            <li>Bring REAL ID or Passport</li>
            <li>Bring vehicle registration & insurance (paper copies)</li>
          </Box>
        </Box>
      </Stack>

      {/* Detailed Instructions - Collapsible */}
      <Accordion defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">
            📋 Step-by-Step Instructions
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box component="ol" sx={{ pl: 3, lineHeight: 1.7, m: 0 }}>
            <li>
              Scan the QR code above (or open the portal link) and follow the
              prompts.
            </li>
            <li>
              If shown, choose <strong>Army</strong> →{" "}
              <strong>Fort Leonard Wood</strong>.
            </li>
            <li>
              Complete the security check (<em>I&apos;m not a robot</em>) and
              accept terms if prompted.
            </li>
            <li>
              Select <strong>Visitor Pass</strong> (not Special Event Pass).
            </li>
            <li>
              Enter Driver&apos;s License #, select issuing state, and
              expiration date (mm/dd/yyyy).
            </li>
            <li>
              Choose your <strong>Reason for Visit</strong>:
              <Box component="ul" sx={{ pl: 3, mt: 0.5, mb: 0 }}>
                <li>
                  <strong>Visit service member</strong> — validated by guard at
                  the Visitor Center.
                </li>
                <li>
                  <strong>Airport</strong> — have your flight itinerary to show
                  the guard.
                </li>
                <li>
                  <strong>Hotel stay</strong> — bring proof of reservation.
                </li>
                <li>
                  <strong>Museum</strong> — hours: Mon–Fri 8am–4pm; Sat 9am–3pm;
                  Sun closed.
                </li>
              </Box>
            </li>
            <li>
              Enter personal info:{" "}
              <strong>DOB, Name, Address, SSN, Mobile Phone</strong> (must
              accept SMS).
            </li>
            <li>
              Review and click <strong>Register</strong> to submit for NCIC
              background screening.
            </li>
            <li>
              You&apos;ll see status as <em>pending review</em>. Allow up to{" "}
              <strong>24 hours</strong>. Updates arrive via SMS.
            </li>
            <li>
              When approved, proceed to the <strong>Visitor Center</strong> at
              the main gate with your approval text and proof for your selected
              reason.
            </li>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* What to Bring - Collapsible */}
      <Accordion defaultExpanded={false} sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">
            🎒 What to Bring (Physical Copies)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box component="ul" sx={{ pl: 3, m: 0, lineHeight: 1.7 }}>
            <li>
              <strong>REAL ID or Passport</strong> (REAL ID will be scanned at
              checkpoint).
            </li>
            <li>
              <strong>Current vehicle registration</strong> paperwork.
            </li>
            <li>
              <strong>Current vehicle insurance</strong> paperwork.{" "}
              <em>Digital copies are not accepted</em>; bring printed/paper
              copies.
            </li>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
