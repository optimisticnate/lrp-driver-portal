export const DIRECTORY_ROLES = [
  "Owner",
  "Operations Manager",
  "Dispatcher",
  "Emergency Contact",
  "Maintenance",
  "Customer Service",
  "IT Support",
  "Other",
];

export const VEHICLE_TYPES = [
  "SUV",
  "Sedan",
  "Suburban",
  "Limo Bus",
  "Rescue Squad",
  "Sprinter",
  "Shuttle",
];

// Vehicle color keys for theme palette
export const VEHICLE_COLOR_KEYS = {
  SUV: "info.main",
  Sedan: "success.main",
  Suburban: "warning.main",
  "Limo Bus": "secondary.main",
  "Rescue Squad": "error.main",
  Sprinter: "info.light",
  Shuttle: "warning.dark",
};

// Helper to get vehicle color from theme
export const getVehicleColor = (vehicle, theme) => {
  const colorKey = VEHICLE_COLOR_KEYS[vehicle];
  if (!colorKey) return theme.palette.grey[600];

  const [category, shade] = colorKey.split(".");
  return theme.palette[category]?.[shade] || theme.palette.grey[600];
};

export const ESCALATION_TIERS = [
  {
    value: 1,
    label: "Owner",
    description:
      "Company ownership - for strategic decisions and critical business matters",
    colorKey: "error.main",
  },
  {
    value: 2,
    label: "Driver",
    description:
      "Active drivers - for on-the-road coordination and driver-specific questions",
    colorKey: "info.main",
  },
  {
    value: 3,
    label: "Dispatcher",
    description:
      "Dispatch team - for scheduling, bookings, and operational support",
    colorKey: "warning.main",
  },
  {
    value: 4,
    label: "CDL Trainer",
    description:
      "CDL training coordinators - for training, certification, and compliance matters",
    colorKey: "success.main",
  },
];

// Helper to get tier color from theme
export const getTierColor = (tier, theme) => {
  const tierConfig = ESCALATION_TIERS.find((t) => t.value === tier);
  if (!tierConfig) return theme.palette.primary.main;

  const [category, shade] = tierConfig.colorKey.split(".");
  return theme.palette[category]?.[shade] || theme.palette.primary.main;
};

export const DEFAULT_CONTACT = {
  name: "",
  phone: "",
  email: "",
  imageUrl: "",
  escalationTiers: [], // Array to support multiple roles
  vehicles: [], // Array of vehicle types
  availabilityHours: "",
  notes: "",
  active: true,
  priority: 999,
};
