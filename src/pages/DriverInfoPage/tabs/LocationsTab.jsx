/* Proprietary and confidential. See LICENSE. */

import { useState, useEffect, useMemo } from "react";
import { Box, Grid, Button } from "@mui/material";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import AddIcon from "@mui/icons-material/Add";

import { subscribeDropoffLocations } from "@/services/driverInfoService";
import {
  saveDropoffLocation,
  deleteDropoffLocation,
} from "@/services/driverInfoAdminService";
import { useRole } from "@/hooks/useRole";
import { useSnack } from "@/components/feedback/SnackbarProvider";

import SearchBar from "../components/SearchBar";
import LocationCard from "../components/LocationCard";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import EditLocationDialog from "../components/EditLocationDialog";

export default function LocationsTab() {
  const { role } = useRole();
  const snack = useSnack();
  const isAdmin = role === "admin";

  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Admin edit state
  const [editDialog, setEditDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);

  // Subscribe to Firestore locations
  useEffect(() => {
    const unsubscribe = subscribeDropoffLocations({
      onData: (data) => {
        setLocations(data);
        setLoading(false);
      },
      onError: (err) => {
        setError(err);
        setLoading(false);
      },
    });

    return () => unsubscribe();
  }, []);

  // Filter locations based on search query
  const filteredLocations = useMemo(() => {
    if (!searchQuery.trim()) return locations;

    const query = searchQuery.toLowerCase();
    return locations.filter((location) =>
      location.name.toLowerCase().includes(query),
    );
  }, [locations, searchQuery]);

  // Admin handlers
  const handleAddNew = () => {
    setEditingLocation(null);
    setEditDialog(true);
  };

  const handleEdit = (location) => {
    setEditingLocation(location);
    setEditDialog(true);
  };

  const handleSave = async (locationData) => {
    try {
      await saveDropoffLocation(locationData);
      snack.show(
        locationData.id ? "Location updated" : "Location added",
        "success",
      );
      setEditDialog(false);
      setEditingLocation(null);
    } catch (error) {
      snack.show("Failed to save location: " + error.message, "error");
    }
  };

  const handleDelete = async (locationId) => {
    try {
      const location = locations.find((loc) => loc.id === locationId);
      await deleteDropoffLocation(locationId, location?.imagePath);
      snack.show("Location deleted", "success");
      setEditDialog(false);
      setEditingLocation(null);
    } catch (error) {
      snack.show("Failed to delete location: " + error.message, "error");
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <SearchBar
          value=""
          onChange={() => {}}
          placeholder="Search locations..."
          disabled
        />
        <Box sx={{ mt: 3 }}>
          <LoadingState count={6} variant="card" />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <EmptyState
          message="Failed to load locations. Please try again."
          icon={LocationOnIcon}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Search Bar with Add Button */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search locations..."
          />
        </Box>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddNew}
          >
            Add New
          </Button>
        )}
      </Box>

      {/* Locations Grid */}
      {filteredLocations.length === 0 ? (
        <EmptyState
          message={
            searchQuery
              ? "No locations found matching your search"
              : "No dropoff locations available"
          }
          icon={LocationOnIcon}
        />
      ) : (
        <Grid container spacing={2}>
          {filteredLocations.map((location) => (
            <Grid item xs={12} sm={6} md={4} key={location.id}>
              <LocationCard
                location={location}
                isAdmin={isAdmin}
                onEdit={() => handleEdit(location)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Edit Dialog */}
      {isAdmin && (
        <EditLocationDialog
          key={editDialog ? editingLocation?.id || "new" : "closed"}
          open={editDialog}
          onClose={() => {
            setEditDialog(false);
            setEditingLocation(null);
          }}
          location={editingLocation}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </Box>
  );
}
