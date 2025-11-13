# TimeClock Firestore Document Structure

## Collection: `timeLogs`

### Document Schema (After Enhancement)

```javascript
{
  // Identity Fields
  "id": "auto-generated-doc-id",           // Firestore document ID
  "driverKey": "user@example.com",         // Primary lookup key
  "driverId": "firebase-uid-123",          // Firebase Auth UID
  "userId": "firebase-uid-123",            // Alias for driverId
  "driverName": "John Doe",                // Display name
  "driverEmail": "user@example.com",       // Normalized email (lowercase)
  "userEmail": "user@example.com",         // Alias for driverEmail

  // Session Type Fields
  "rideId": "RIDE-001",                    // Ride identifier or "N/A"
  "mode": "RIDE",                          // Legacy: "RIDE" | "N/A" | "MULTI"
  "isNonRideTask": false,                  // ✨ NEW: Explicit boolean
  "isMultipleRides": false,                // ✨ NEW: Explicit boolean

  // Timestamps
  "startTs": Timestamp,                    // Firestore Timestamp (clock-in)
  "startTime": Timestamp,                  // Alias for startTs
  "endTs": null,                           // Firestore Timestamp (clock-out) or null
  "endTime": null,                         // Alias for endTs
  "loggedAt": Timestamp,                   // Initial creation time
  "createdAt": Timestamp,                  // Document creation time
  "updatedAt": Timestamp,                  // Last update time

  // Duration & Status
  "duration": null,                        // Minutes (calculated on clock-out)
  "durationMin": null,                     // Alias for duration
  "status": "open",                        // "open" | "closed"

  // Optional Fields
  "note": null,                            // Optional note/comment
  "source": null,                          // Source system identifier

  // Internal Fields
  "_searchText": "john doe user@example.com ride-001"  // Search index
}
```

---

## Example Documents

### 1. Regular Ride Session (New Format)
```json
{
  "id": "log-001",
  "driverKey": "driver@lrpbolt.com",
  "driverId": "uid-abc123",
  "driverName": "Sarah Driver",
  "driverEmail": "driver@lrpbolt.com",
  "rideId": "RIDE-12345",
  "mode": "RIDE",
  "isNonRideTask": false,        // ← Explicit: This IS a ride
  "isMultipleRides": false,      // ← Explicit: Single ride
  "startTs": "2025-11-02T10:00:00Z",
  "endTs": null,
  "status": "open",
  "duration": null
}
```

**UI Display:**
- ✅ Ride ID field: enabled, shows "RIDE-12345"
- ❌ "Non-Ride Task" checkbox: unchecked
- ❌ "Multiple Rides" checkbox: unchecked
- ✅ Timer: "00:15:32" (green glow animation active)

---

### 2. Non-Ride Task Session (New Format)
```json
{
  "id": "log-002",
  "driverKey": "driver@lrpbolt.com",
  "driverId": "uid-abc123",
  "driverName": "Sarah Driver",
  "driverEmail": "driver@lrpbolt.com",
  "rideId": "N/A",
  "mode": "N/A",
  "isNonRideTask": true,         // ← Explicit: NOT a ride
  "isMultipleRides": false,
  "note": "Office paperwork",
  "startTs": "2025-11-02T11:00:00Z",
  "endTs": null,
  "status": "open",
  "duration": null
}
```

**UI Display:**
- ❌ Ride ID field: disabled
- ✅ "Non-Ride Task" checkbox: checked
- ❌ "Multiple Rides" checkbox: unchecked
- ✅ Timer: "01:23:45" (green glow animation active)

---

### 3. Multiple Rides Session (New Format)
```json
{
  "id": "log-003",
  "driverKey": "driver@lrpbolt.com",
  "driverId": "uid-abc123",
  "driverName": "Sarah Driver",
  "driverEmail": "driver@lrpbolt.com",
  "rideId": "N/A",
  "mode": "MULTI",
  "isNonRideTask": false,
  "isMultipleRides": true,       // ← Explicit: Multiple rides in one session
  "startTs": "2025-11-02T12:00:00Z",
  "endTs": null,
  "status": "open",
  "duration": null
}
```

**UI Display:**
- ❌ Ride ID field: disabled
- ❌ "Non-Ride Task" checkbox: unchecked
- ✅ "Multiple Rides" checkbox: checked
- ✅ Timer: "00:45:12" (green glow animation active)

---

### 4. Completed Session
```json
{
  "id": "log-004",
  "driverKey": "driver@lrpbolt.com",
  "driverId": "uid-abc123",
  "driverName": "Sarah Driver",
  "driverEmail": "driver@lrpbolt.com",
  "rideId": "RIDE-12345",
  "mode": "RIDE",
  "isNonRideTask": false,
  "isMultipleRides": false,
  "startTs": "2025-11-02T08:00:00Z",
  "endTs": "2025-11-02T09:30:00Z",    // ← Clocked out
  "status": "closed",
  "duration": 90,                      // ← 90 minutes
  "loggedAt": "2025-11-02T08:00:00Z",
  "updatedAt": "2025-11-02T09:30:15Z"
}
```

**UI Display (in DataGrid):**
- Status: "Completed" chip (gray)
- Duration: "1h 30m"
- Clock Out: "09:30 AM"

---

### 5. Legacy Session (Before Enhancement)
```json
{
  "id": "legacy-log-001",
  "driverKey": "olddriver@lrpbolt.com",
  "driverName": "Old Driver",
  "rideId": "N/A",
  "mode": "N/A",
  // ❌ NO isNonRideTask field
  // ❌ NO isMultipleRides field
  "startTs": "2025-10-15T14:00:00Z",
  "endTs": "2025-10-15T16:00:00Z",
  "status": "closed",
  "duration": 120
}
```

**After Reading (normalizeTimeLog):**
```javascript
{
  id: "legacy-log-001",
  driverKey: "olddriver@lrpbolt.com",
  driverName: "Old Driver",
  rideId: "N/A",
  mode: "N/A",
  isNonRideTask: false,          // ← Added by normalizer (defaults to false)
  isMultipleRides: false,        // ← Added by normalizer (defaults to false)
  startTs: Timestamp,
  endTs: Timestamp,
  status: "closed",
  duration: 120
}
```

**UI Display (if active):**
- ✅ "Non-Ride Task" checkbox: checked (derived from `mode === "N/A"`)
- UI state comes from `mode` field, not boolean fields
- Legacy session displays correctly! ✅

---

## Field Mapping Table

| Field Name | Type | Required | Default | Purpose |
|------------|------|----------|---------|---------|
| `id` | string | ✅ Yes | auto | Firestore document ID |
| `driverKey` | string | ✅ Yes | - | Primary lookup key |
| `driverId` | string | ❌ No | null | Firebase Auth UID |
| `driverName` | string | ❌ No | null | Display name |
| `driverEmail` | string | ❌ No | null | Normalized email |
| `rideId` | string | ✅ Yes | "N/A" | Ride identifier |
| `mode` | string | ✅ Yes | "RIDE" | Legacy type: RIDE/N/A/MULTI |
| `isNonRideTask` | boolean | ✅ Yes | false | ✨ Explicit non-ride flag |
| `isMultipleRides` | boolean | ✅ Yes | false | ✨ Explicit multi-ride flag |
| `startTs` | Timestamp | ✅ Yes | serverTimestamp() | Clock-in time |
| `endTs` | Timestamp | ❌ No | null | Clock-out time |
| `status` | string | ✅ Yes | "open" | open/closed |
| `duration` | number | ❌ No | null | Duration in minutes |
| `note` | string | ❌ No | null | Optional note |

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Clicks "Start"                      │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  TimeClock.jsx: handleStart()                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ const mode = nonRideTask ? "N/A"                      │  │
│  │            : multiRide ? "MULTI"                      │  │
│  │            : "RIDE";                                  │  │
│  │                                                       │  │
│  │ await logTime({                                       │  │
│  │   mode,                    // ← Legacy string         │  │
│  │   isNonRideTask,           // ← New boolean ✨        │  │
│  │   isMultipleRides,         // ← New boolean ✨        │  │
│  │   ...                                                 │  │
│  │ });                                                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  fs/index.js: logTime(entry)                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ const payload = {                                     │  │
│  │   mode: entry.mode || "RIDE",                        │  │
│  │   isNonRideTask: typeof entry.isNonRideTask ===      │  │
│  │                  "boolean" ? entry.isNonRideTask     │  │
│  │                             : false,                 │  │
│  │   isMultipleRides: typeof entry.isMultipleRides ===  │  │
│  │                    "boolean" ? entry.isMultipleRides │  │
│  │                               : false,               │  │
│  │   ...                                                │  │
│  │ };                                                   │  │
│  │                                                      │  │
│  │ await addDoc(collection(db, "timeLogs"), payload);   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Firestore Collection                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  timeLogs/auto-generated-id                          │  │
│  │  {                                                   │  │
│  │    mode: "RIDE",           // ← Legacy compat       │  │
│  │    isNonRideTask: false,   // ← Explicit boolean ✨ │  │
│  │    isMultipleRides: false, // ← Explicit boolean ✨ │  │
│  │    startTs: Timestamp,                              │  │
│  │    status: "open"                                   │  │
│  │  }                                                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  subscribeTimeLogs() - Real-time Listener                   │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  fs/index.js: normalizeTimeLog(docSnap)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ // Reads both legacy and new fields                  │  │
│  │ const isNonRideTask = typeof data?.isNonRideTask === │  │
│  │                       "boolean"                      │  │
│  │                       ? data.isNonRideTask           │  │
│  │                       : false;  // ← Default for old │  │
│  │                                                      │  │
│  │ return { ...data, isNonRideTask, isMultipleRides };  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  TimeClock.jsx: UI Updates                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ // State derived from MODE (not booleans!)           │  │
│  │ const mode = activeRow?.mode || "RIDE";              │  │
│  │ setNonRideTask(mode === "N/A");                      │  │
│  │ setMultiRide(mode === "MULTI");                      │  │
│  │                                                      │  │
│  │ // Timer updates every 1 second                      │  │
│  │ setInterval(updateLiveTime, 1000);                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Backward Compatibility Strategy

### Reading Legacy Documents
```javascript
// Legacy document in Firestore (no boolean fields)
{
  "mode": "N/A",
  "rideId": "N/A"
  // NO isNonRideTask or isMultipleRides
}

// After normalizeTimeLog()
{
  mode: "N/A",
  rideId: "N/A",
  isNonRideTask: false,    // ← Added (defaults to false)
  isMultipleRides: false   // ← Added (defaults to false)
}

// UI derives state from mode field
const mode = activeRow?.mode || "RIDE";
setNonRideTask(mode === "N/A");  // ← Checkbox becomes checked!
```

**Result**: Legacy sessions display correctly in UI ✅

### Upgrading Legacy Documents
When a legacy session is clocked out:
```javascript
await logTime({
  id: "legacy-session-id",
  mode: "N/A",                                    // ← Preserved
  isNonRideTask: activeRow.isNonRideTask ?? true, // ← NOW written!
  isMultipleRides: false,                         // ← NOW written!
  endTs: serverTimestamp()
});
```

**Result**: Legacy document gets upgraded with boolean fields ✅

---

## Index Recommendations

### Composite Indexes (for queries)
```
Collection: timeLogs
Fields: driverKey (ASC), startTime (DESC)
Fields: driverEmail (ASC), startTime (DESC)
Fields: rideId (ASC), startTime (DESC)
Fields: status (ASC), startTime (DESC)
```

### Single Field Indexes
```
- driverKey
- driverId
- userId
- driverEmail
- userEmail
- status
- startTime
```

**Note**: Firestore auto-creates indexes for simple queries. Composite indexes needed for complex queries.

---

## Storage Size Estimate

### Per Document
```
Approximate size per active session:
- Identity fields: ~150 bytes
- Session type fields: ~50 bytes
- Timestamps: ~80 bytes
- Boolean fields: ~10 bytes
- Status/duration: ~30 bytes
- Search text: ~100 bytes
────────────────────────────────
Total: ~420 bytes per document
```

### Collection Growth
```
100 drivers × 2 sessions/day × 30 days = 6,000 documents/month
6,000 × 420 bytes = ~2.52 MB/month
~30 MB/year (uncompressed)
```

**Firestore Limits:**
- Max document size: 1 MB (we use ~0.42 KB ✅)
- Max collection size: No limit
- Max writes/second: 10,000 (we're well under ✅)

---

**Last Updated**: 2025-11-02
