# Migration Scripts

This directory contains one-time migration scripts for data migration tasks.

## Driver Directory Migration

**Script:** `migrateDriverDirectory.js`

**Purpose:** Migrates the static driver directory data from `src/data/driverDirectory.js` to the new Firestore `directory` collection.

### Prerequisites

1. **Firebase Admin SDK:** Install if not already installed:
   ```bash
   npm install firebase-admin
   ```

2. **Service Account Key:** Download your Firebase service account key:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file securely

3. **Environment Variable:** Set the path to your service account key:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
   ```

### Running the Migration

From the project root directory:

```bash
node scripts/migrateDriverDirectory.js
```

### What It Does

The script will:

1. ✅ Read the static driver list from `src/data/driverDirectory.js`
2. ✅ Parse phone numbers to E.164 format (+1XXXXXXXXXX)
3. ✅ Assign escalation tiers based on role:
   - **Tier 3** (Emergency): Owners (LRP1, LRP2, LRP3)
   - **Tier 2** (Escalated): Dispatchers
   - **Tier 1** (First Contact): Regular drivers
4. ✅ Skip "OPEN" positions and invalid entries
5. ✅ Create Firestore documents in the `directory` collection
6. ✅ Add metadata: createdAt, updatedAt, createdBy, updatedBy

### Output Example

```
🚀 Starting driver directory migration...

✅ Migrating: Jim Brentlinger (LRP1) → Tier 3
✅ Migrating: Nate Bullock (LRP2) → Tier 3
✅ Migrating: Michael Brandt (LRP3) → Tier 3
⏭️  Skipping: LRP6 (OPEN position)
✅ Migrating: Paige Blankenship (LRP10) → Tier 2

✨ Migration complete!
   📊 Migrated: 17 contacts
   ⏭️  Skipped: 4 entries

🎉 Driver directory successfully migrated to Firestore!
```

### Firestore Security Rules

The migration script uses Firebase Admin SDK, which bypasses security rules. After migration, the directory collection is protected by these rules:

- **Read:** All authenticated users
- **Create/Update/Delete:** Admin only

### Post-Migration

After running the migration:

1. ✅ Verify the data in Firebase Console → Firestore Database → `directory` collection
2. ✅ Test the Directory page in the app to ensure contacts are displayed correctly
3. ✅ Test admin CRUD operations (add, edit, delete)
4. ✅ Consider archiving or removing the old static data file `src/data/driverDirectory.js`

### Troubleshooting

**Error: "Failed to initialize Firebase Admin"**
- Make sure `GOOGLE_APPLICATION_CREDENTIALS` is set correctly
- Verify the service account key file exists and is valid

**Error: "Permission denied"**
- Check that your service account has Firestore write permissions
- Verify you're using the correct Firebase project

**Warning: "Skipping invalid phone"**
- The script skips entries with invalid phone formats
- Review the skipped entries and update manually if needed

### Running Again

⚠️ **Warning:** This script creates new documents each time it runs. Running it multiple times will create duplicate entries.

If you need to re-run the migration:
1. Delete all documents in the `directory` collection first
2. Then run the script again

### Cleanup

After successful migration, you can optionally:

```bash
# Archive the old static data file
mv src/data/driverDirectory.js src/data/driverDirectory.js.bak
```
