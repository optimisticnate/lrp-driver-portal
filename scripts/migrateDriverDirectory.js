/* Proprietary and confidential. See LICENSE. */

/**
 * Migration Script: Driver Directory to Firestore
 *
 * This script migrates the static driver directory data to Firestore.
 * Run once to populate the directory collection with existing driver data.
 *
 * Usage:
 *   node scripts/migrateDriverDirectory.js
 *
 * Prerequisites:
 *   - Firebase Admin SDK initialized
 *   - serviceAccountKey.json in repo root
 */

import { readFile } from 'fs/promises';

import admin from 'firebase-admin';

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';

try {
  const serviceAccount = JSON.parse(
    await readFile(serviceAccountPath, 'utf8')
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  console.log('\nPlease ensure serviceAccountKey.json exists in repo root');
  process.exit(1);
}

const db = admin.firestore();

// Static driver list data from src/data/driverDirectory.js
const DRIVER_LIST = [
  {
    name: "Jim Brentlinger",
    lrp: "LRP1",
    phone: "573.353.2849",
    email: "Jim@lakeridepros.com",
    vehicles: ["Suburban", "Limo Bus", "Rescue Squad", "Sprinter"],
  },
  {
    name: "Nate Bullock",
    lrp: "LRP2",
    phone: "417.380.9953",
    email: "Nate@lakeridepros.com",
    vehicles: ["Suburban", "Limo Bus", "Rescue Squad", "Sprinter"],
  },
  {
    name: "Michael Brandt",
    lrp: "LRP3",
    phone: "573.286.9110",
    email: "Michael@lakeridepros.com",
    vehicles: ["Suburban", "Limo Bus", "Rescue Squad", "Sprinter"],
  },
  {
    name: "Jasey Brandt",
    lrp: "LRP4",
    phone: "573.286.9740",
    email: "jasey.brandt@gmail.com",
    vehicles: ["SUV", "Limo Bus", "Rescue Squad", "Sprinter"],
  },
  {
    name: "Miguel Rodriguez",
    lrp: "LRP5",
    phone: "573.692.2386",
    email: "mrod65026@gmail.com",
    vehicles: ["SUV", "Limo Bus", "Rescue Squad", "Sprinter"],
  },
  {
    name: "Dawson Brandt",
    lrp: "LRP8",
    phone: "573.286.7170",
    email: "dbrandt0025@gmail.com",
    vehicles: ["SUV", "Limo Bus", "Rescue Squad", "Sprinter"],
  },
  {
    name: "Paige Blankenship",
    lrp: "LRP10",
    phone: "573.286.5149",
    email: "p.blankenship@842@gmail.com",
    vehicles: ["Limo Bus", "Rescue Squad", "Sprinter"],
    roles: ["Dispatcher"],
  },
  {
    name: "Tom Morrow",
    lrp: "LRP11",
    phone: "573.723.0244",
    email: "mosportsmantravel@gmail.com",
    vehicles: ["SUV", "Limo Bus", "Rescue Squad", "Sprinter"],
  },
  {
    name: "Jeremy Imler",
    lrp: "LRP13",
    phone: "573.280.6546",
    email: "Jeremy.imler19@gmail.com",
    vehicles: ["CDL Trainer", "Limo Bus", "Rescue Squad", "Sprinter", "Shuttle"],
  },
  {
    name: "Jacob Brentlinger",
    lrp: "LRP14",
    phone: "573.691.7610",
    email: "brentlingerjacob@gmail.com",
    vehicles: ["Limo Bus", "Rescue Squad", "Sprinter"],
  },
  {
    name: "Kierstin Brandt",
    lrp: "LRP15",
    phone: "573.832.1788",
    email: "kierstinbrandt@gmail.com",
    vehicles: ["Limo Bus", "Rescue Squad", "Sprinter"],
  },
  {
    name: "Katie Rodriguez",
    lrp: "LRP16",
    phone: "573.552.6570",
    email: "kd.rod65026@gmail.com",
    vehicles: ["Limo Bus", "Rescue Squad", "Sprinter"],
  },
  {
    name: "Phil Rutledge",
    lrp: "LRP17",
    phone: "573.619.8620",
    email: "phil.m.Rutledge@gmail.com",
    vehicles: ["Limo Bus", "Rescue Squad", "Sprinter", "Shuttle"],
  },
  {
    name: "Brandon Scrivner",
    lrp: "LRP18",
    phone: "573.286.4983",
    email: "scrivdaddywoowoo@yahoo.com",
    vehicles: ["Limo Bus", "Rescue Squad", "Sprinter", "Shuttle"],
  },
  {
    name: "Jack Lake",
    lrp: "LRP19",
    phone: "573.694.8770",
    email: "jack.lake07@hotmail.com",
    vehicles: ["Limo Bus", "Rescue Squad", "Sprinter"],
  },
  {
    name: "Tony Addington",
    lrp: "LRP20",
    phone: "573.434.3420",
    email: "tonyaddington58@gmail.com",
    vehicles: ["Limo Bus", "Rescue Squad", "Sprinter"],
  },
  {
    name: "Elijah Rivera",
    lrp: "LRP21",
    phone: "573.832.1960",
    email: "elishifty35@gmail.com",
    vehicles: ["Limo Bus", "Rescue Squad", "Sprinter"],
  },
];

/**
 * Parse phone number to E.164 format
 */
function parsePhoneToE164(phone) {
  if (!phone || phone === '—') return null;

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // If it has 10 digits, assume US number and add country code
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // If it has 11 digits and starts with 1, it's already a US number
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // If we can't determine format, return null
  return null;
}

/**
 * Migrate driver data to Firestore directory collection
 */
async function migrateDriverDirectory() {
  console.log('🚀 Starting driver directory migration...\n');

  const batch = db.batch();
  let migratedCount = 0;
  let skippedCount = 0;
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  for (const driver of DRIVER_LIST) {
    // Skip "OPEN" positions
    if (driver.name === 'OPEN') {
      console.log(`⏭️  Skipping: ${driver.lrp} (OPEN position)`);
      skippedCount++;
      continue;
    }

    // Parse phone number
    const phone = parsePhoneToE164(driver.phone);
    if (!phone) {
      console.log(`⚠️  Skipping: ${driver.name} (invalid phone: ${driver.phone})`);
      skippedCount++;
      continue;
    }

    // Determine role - owners get Tier 3, dispatcher gets Tier 2, drivers get Tier 1
    let escalationTier = 1; // Default: Driver
    let role = 'Driver';
    let priority = 100;

    if (['LRP1', 'LRP2', 'LRP3'].includes(driver.lrp)) {
      escalationTier = 3; // Owner
      role = 'Owner';
      priority = parseInt(driver.lrp.replace('LRP', ''), 10);
    } else if (driver.roles?.includes('Dispatcher')) {
      escalationTier = 2; // Dispatcher
      role = 'Dispatcher';
      priority = 50;
    } else {
      priority = parseInt(driver.lrp.replace('LRP', ''), 10);
    }

    // Build notes from vehicles
    const notes = driver.vehicles?.length
      ? `Vehicles: ${driver.vehicles.join(', ')}`
      : null;

    // Create document
    const docRef = db.collection('directory').doc();
    const contactData = {
      name: driver.name,
      role,
      phone,
      email: driver.email || null,
      escalationTier,
      availabilityHours: null,
      notes,
      active: true,
      priority,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: 'migration-script',
      updatedBy: 'migration-script',
    };

    batch.set(docRef, contactData);
    console.log(`✅ Migrating: ${driver.name} (${driver.lrp}) → Tier ${escalationTier}`);
    migratedCount++;
  }

  // Commit the batch
  try {
    await batch.commit();
    console.log(`\n✨ Migration complete!`);
    console.log(`   📊 Migrated: ${migratedCount} contacts`);
    console.log(`   ⏭️  Skipped: ${skippedCount} entries`);
    console.log(`\n🎉 Driver directory successfully migrated to Firestore!`);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateDriverDirectory()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
