/* Proprietary and confidential. See LICENSE. */

import { Box, Skeleton, Grid } from "@mui/material";

export default function LoadingState({ count = 6, variant = "card" }) {
  if (variant === "card") {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: count }).map((_, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Box>
              <Skeleton
                variant="rectangular"
                height={200}
                sx={{ borderRadius: 1 }}
              />
              <Skeleton variant="text" sx={{ mt: 1 }} />
              <Skeleton variant="text" width="60%" />
            </Box>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (variant === "list") {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {Array.from({ length: count }).map((_, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <Box key={index}>
            <Skeleton
              variant="rectangular"
              height={80}
              sx={{ borderRadius: 1 }}
            />
          </Box>
        ))}
      </Box>
    );
  }

  return null;
}
