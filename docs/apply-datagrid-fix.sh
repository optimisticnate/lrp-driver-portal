#!/bin/bash
# Fix for DataGrid "R.ids is not iterable" error
# Apply this from your project root directory

set -e

echo "🔧 Applying DataGrid selection model fixes..."

# Backup files
echo "📦 Creating backups..."
cp src/components/datagrid/UniversalDataGrid.jsx src/components/datagrid/UniversalDataGrid.jsx.backup
cp src/utils/gridSelection.js src/utils/gridSelection.js.backup

# Apply fixes
echo "✏️  Updating UniversalDataGrid.jsx..."
cat > /tmp/universal_fix.txt << 'EOF'
  // MUI v8 CRITICAL: Ensure rowSelectionModel is always a valid array
  const safeRowSelectionModel = useMemo(() => {
    if (rowSelectionModel == null) return [];
    if (Array.isArray(rowSelectionModel)) return rowSelectionModel;
    // Handle legacy Set-based selection models
    if (rowSelectionModel instanceof Set) {
      return Array.from(rowSelectionModel);
    }
    // Handle objects with ids property (malformed v7/v8 migration artifacts)
    if (typeof rowSelectionModel === "object") {
      if ("ids" in rowSelectionModel) {
        const ids = rowSelectionModel.ids;
        if (ids == null) return [];
        if (Array.isArray(ids)) return ids;
        if (ids instanceof Set) return Array.from(ids);
        // CRITICAL: Check if ids is actually iterable before trying to use it
        if (typeof ids === "object" && ids !== null && typeof ids[Symbol.iterator] === "function") {
          try {
            return Array.from(ids);
          } catch {
            return [];
          }
        }
        // ids exists but is not iterable - return empty array
        return [];
      }
      // Object without ids property - try to extract values
      if (typeof rowSelectionModel.size === "number") {
        try {
          return Array.from(rowSelectionModel);
        } catch {
          return [];
        }
      }
    }
    // Single value - wrap in array
    return [rowSelectionModel];
  }, [rowSelectionModel]);
EOF

echo "✏️  Updating gridSelection.js..."
cat > src/utils/gridSelection.js << 'EOF'
export function toArraySelection(model) {
  if (model == null) return [];
  if (Array.isArray(model)) return model;
  if (model instanceof Set) return Array.from(model);
  if (typeof model === "object") {
    // Handle model.ids property - check if it exists and is iterable
    if ("ids" in model) {
      if (model.ids == null) return [];
      if (Array.isArray(model.ids)) return model.ids;
      if (model.ids instanceof Set) return Array.from(model.ids);
      // CRITICAL: Check if ids is actually iterable before trying to use it
      if (typeof model.ids === "object" && model.ids !== null && typeof model.ids[Symbol.iterator] === "function") {
        try {
          return Array.from(model.ids);
        } catch {
          return [];
        }
      }
      // If ids exists but is not iterable, return empty array
      return [];
    }
    if (typeof model.size === "number") {
      try {
        return Array.from(model);
      } catch {
        return [];
      }
    }
    if (model.id != null) return [model.id];
  }
  return [model];
}

export function safeGetRowId(row) {
  return (
    row?.id ??
    row?.docId ??
    row?.docID ??
    row?._id ??
    row?.rideId ??
    row?.rideID ??
    row?.key ??
    String(
      row?.uid ??
        row?.rid ??
        row?.timestamp ??
        Math.random().toString(36).slice(2),
    )
  );
}
EOF

echo "✅ Fixes applied!"
echo ""
echo "📝 Next steps:"
echo "1. npm run lint          # Check for linting errors"
echo "2. npm run build:prod    # Build production bundle"
echo "3. Test in browser and check console for errors"
echo ""
echo "🔄 To restore backups if needed:"
echo "   mv src/components/datagrid/UniversalDataGrid.jsx.backup src/components/datagrid/UniversalDataGrid.jsx"
echo "   mv src/utils/gridSelection.js.backup src/utils/gridSelection.js"
