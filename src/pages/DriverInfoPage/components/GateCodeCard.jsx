/* Proprietary and confidential. See LICENSE. */

import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

export default function GateCodeCard({ gateCode, isAdmin, onEdit }) {
  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderLeft: 3,
        borderLeftColor: "primary.main",
      }}
    >
      <CardContent
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          py: 2,
        }}
      >
        {/* Location Name with Edit Button */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {gateCode.name}
          </Typography>
          {isAdmin && (
            <IconButton
              onClick={onEdit}
              size="small"
              sx={{
                color: "primary.main",
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {/* Codes - Compact display */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {/* eslint-disable react/no-array-index-key */}
          {gateCode.codes.map((code, index) => (
            <Chip
              key={`${code}-${index}`}
              label={
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {code}
                </Typography>
              }
              sx={{
                minHeight: 36,
                px: 1.5,
                backgroundColor: "primary.light",
                color: "primary.contrastText",
              }}
            />
          ))}
          {/* eslint-enable react/no-array-index-key */}
        </Box>
      </CardContent>
    </Card>
  );
}
