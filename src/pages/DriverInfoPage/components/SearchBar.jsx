/* Proprietary and confidential. See LICENSE. */

import { TextField, InputAdornment, IconButton } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
}) {
  const handleClear = () => {
    onChange("");
  };

  return (
    <TextField
      fullWidth
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      variant="outlined"
      size="small"
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon color="action" />
          </InputAdornment>
        ),
        endAdornment: value ? (
          <InputAdornment position="end">
            <IconButton
              aria-label="Clear search"
              onClick={handleClear}
              edge="end"
              size="small"
            >
              <ClearIcon />
            </IconButton>
          </InputAdornment>
        ) : null,
      }}
      sx={{
        "& .MuiOutlinedInput-root": {
          backgroundColor: "background.paper",
        },
      }}
    />
  );
}
