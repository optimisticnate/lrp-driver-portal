/* Proprietary and confidential. See LICENSE. */

import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Grid,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Button,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import AddIcon from "@mui/icons-material/Add";

import { subscribeGateCodes } from "@/services/driverInfoService";
import {
  saveGateCode,
  deleteGateCode,
} from "@/services/driverInfoAdminService";
import { useRole } from "@/hooks/useRole";
import { useSnack } from "@/components/feedback/SnackbarProvider";

import SearchBar from "../components/SearchBar";
import GateCodeCard from "../components/GateCodeCard";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import EditGateCodeDialog from "../components/EditGateCodeDialog";

export default function GateCodesTab() {
  const { role } = useRole();
  const snack = useSnack();
  const isAdmin = role === "admin";

  const [gateCodes, setGateCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("alphabetical");

  // Admin edit state
  const [editDialog, setEditDialog] = useState(false);
  const [editingCode, setEditingCode] = useState(null);

  // Subscribe to Firestore gate codes
  useEffect(() => {
    const unsubscribe = subscribeGateCodes({
      onData: (data) => {
        setGateCodes(data);
        setLoading(false);
      },
      onError: (err) => {
        setError(err);
        setLoading(false);
      },
    });

    return () => unsubscribe();
  }, []);

  // Filter and sort gate codes
  const filteredAndSortedCodes = useMemo(() => {
    let filtered = gateCodes;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((code) =>
        code.name.toLowerCase().includes(query),
      );
    }

    // Sort
    const sorted = [...filtered];
    if (sortBy === "alphabetical") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "mostUsed") {
      sorted.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    }

    return sorted;
  }, [gateCodes, searchQuery, sortBy]);

  // Admin handlers
  const handleAddNew = () => {
    setEditingCode(null);
    setEditDialog(true);
  };

  const handleEdit = (gateCode) => {
    setEditingCode(gateCode);
    setEditDialog(true);
  };

  const handleSave = async (gateCodeData) => {
    try {
      await saveGateCode(gateCodeData);
      snack.show(
        gateCodeData.id ? "Gate code updated" : "Gate code added",
        "success",
      );
      setEditDialog(false);
      setEditingCode(null);
    } catch (error) {
      snack.show("Failed to save gate code: " + error.message, "error");
    }
  };

  const handleDelete = async (gateCodeId) => {
    try {
      await deleteGateCode(gateCodeId);
      snack.show("Gate code deleted", "success");
      setEditDialog(false);
      setEditingCode(null);
    } catch (error) {
      snack.show("Failed to delete gate code: " + error.message, "error");
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <SearchBar
              value=""
              onChange={() => {}}
              placeholder="Search gate codes..."
            />
          </Box>
          <FormControl size="small" sx={{ minWidth: 160 }} disabled>
            <InputLabel>Sort By</InputLabel>
            <Select value="alphabetical" label="Sort By">
              <MenuItem value="alphabetical">Alphabetical</MenuItem>
              <MenuItem value="mostUsed">Most Used</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <LoadingState count={6} variant="card" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <EmptyState
          message="Failed to load gate codes. Please try again."
          icon={LockIcon}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Search and Sort Controls */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search gate codes..."
          />
        </Box>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Sort By</InputLabel>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            label="Sort By"
          >
            <MenuItem value="alphabetical">Alphabetical</MenuItem>
            <MenuItem value="mostUsed">Most Used</MenuItem>
          </Select>
        </FormControl>
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

      {/* Gate Codes Grid */}
      {filteredAndSortedCodes.length === 0 ? (
        <EmptyState
          message={
            searchQuery
              ? "No gate codes found matching your search"
              : "No gate codes available"
          }
          icon={LockIcon}
        />
      ) : (
        <Grid container spacing={2}>
          {filteredAndSortedCodes.map((gateCode) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={gateCode.id}>
              <GateCodeCard
                gateCode={gateCode}
                isAdmin={isAdmin}
                onEdit={() => handleEdit(gateCode)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Edit Dialog */}
      {isAdmin && (
        <EditGateCodeDialog
          key={editDialog ? editingCode?.id || "new" : "closed"}
          open={editDialog}
          onClose={() => {
            setEditDialog(false);
            setEditingCode(null);
          }}
          gateCode={editingCode}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </Box>
  );
}
