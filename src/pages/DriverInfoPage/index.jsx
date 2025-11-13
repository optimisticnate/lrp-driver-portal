/* Proprietary and confidential. See LICENSE. */

import { useState, lazy, Suspense } from "react";
import {
  Box,
  Tabs,
  Tab,
  Paper,
  CircularProgress,
  Typography,
} from "@mui/material";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import LockIcon from "@mui/icons-material/Lock";
import FlightIcon from "@mui/icons-material/Flight";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";

// Lazy load tab components for better performance
const LocationsTab = lazy(() => import("./tabs/LocationsTab"));
const GateCodesTab = lazy(() => import("./tabs/GateCodesTab"));
const AirportTab = lazy(() => import("./tabs/AirportTab"));
const PassengerAppTab = lazy(() => import("./tabs/PassengerAppTab"));

function TabPanel({ children, value, index }) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`driver-info-tabpanel-${index}`}
      aria-labelledby={`driver-info-tab-${index}`}
    >
      {value === index && children}
    </Box>
  );
}

function LoadingFallback() {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 400,
      }}
    >
      <CircularProgress />
    </Box>
  );
}

export default function DriverInfoPage() {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: "background.default",
      }}
    >
      {/* Page Header */}
      <Box sx={{ p: { xs: 2, md: 3 }, pb: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          🚗 Driver Drop-Off Info & Instructions
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary", mb: 2 }}>
          These tips are here to help you stay compliant and deliver a seamless
          VIP experience.
        </Typography>
      </Box>

      {/* Sticky Tab Bar */}
      <Paper
        elevation={2}
        sx={{
          position: "sticky",
          top: { xs: 56, sm: 64 }, // Adjust for AppBar height
          zIndex: (theme) => theme.zIndex.appBar - 1,
          borderRadius: 0,
          backgroundColor: "background.paper",
        }}
      >
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Driver info navigation tabs"
          sx={{
            backgroundColor: "background.paper",
            "& .MuiTab-root": {
              minHeight: { xs: 56, sm: 64 },
              fontSize: { xs: "0.875rem", sm: "1rem" },
              fontWeight: 600,
              textTransform: "none",
              px: { xs: 2, sm: 3 },
            },
          }}
        >
          <Tab
            icon={<LocationOnIcon />}
            iconPosition="start"
            label="Locations"
            id="driver-info-tab-0"
            aria-controls="driver-info-tabpanel-0"
          />
          <Tab
            icon={<LockIcon />}
            iconPosition="start"
            label="Gates"
            id="driver-info-tab-1"
            aria-controls="driver-info-tabpanel-1"
          />
          <Tab
            icon={<FlightIcon />}
            iconPosition="start"
            label="Airport"
            id="driver-info-tab-2"
            aria-controls="driver-info-tabpanel-2"
          />
          <Tab
            icon={<PhoneAndroidIcon />}
            iconPosition="start"
            label="App"
            id="driver-info-tab-3"
            aria-controls="driver-info-tabpanel-3"
          />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ flex: 1 }}>
        <TabPanel value={tabValue} index={0}>
          <Suspense fallback={<LoadingFallback />}>
            <LocationsTab />
          </Suspense>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Suspense fallback={<LoadingFallback />}>
            <GateCodesTab />
          </Suspense>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Suspense fallback={<LoadingFallback />}>
            <AirportTab />
          </Suspense>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Suspense fallback={<LoadingFallback />}>
            <PassengerAppTab />
          </Suspense>
        </TabPanel>
      </Box>
    </Box>
  );
}
