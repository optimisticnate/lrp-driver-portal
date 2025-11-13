/* Proprietary and confidential. See LICENSE. */

import { Box, Typography } from "@mui/material";
import SearchOffIcon from "@mui/icons-material/SearchOff";

export default function EmptyState({
  message = "No results found",
  icon: Icon = SearchOffIcon,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 8,
        px: 2,
        textAlign: "center",
      }}
    >
      <Icon
        sx={{
          fontSize: 64,
          color: "text.disabled",
          mb: 2,
        }}
      />
      <Typography variant="h6" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}
