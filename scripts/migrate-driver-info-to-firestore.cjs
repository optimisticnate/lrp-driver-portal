#!/usr/bin/env node
/* Proprietary and confidential. See LICENSE. */

/**
 * Migration script: Driver Info to Firestore
 *
 * Migrates:
 * 1. GATE_CODES from src/components/DriverInfoTab.jsx → gateCodes collection
 * 2. LOCATIONS from src/driverLocations.js → dropoffLocations collection
 * 3. Images from public/DropOffPics/ → Firebase Storage (dropoffs/)
 *
 * Prerequisites:
 * - Download serviceAccountKey.json from Firebase Console
 * - Place it in project root
 * - Install: npm install firebase-admin
 *
 * Run: node scripts/migrate-driver-info-to-firestore.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- Constants from current code ---
const GATE_CODES = [
  { name: "Camden", codes: ["1793#", "1313"] },
  { name: "Cypress", codes: ["7469"] },
  { name: "Shooters 21", codes: ["4040"] },
  { name: "Tan-Tar-A", codes: ["4365", "1610", "5746", "1713", "4271", "0509"] },
  { name: "Ledges (Back Gate)", codes: ["2014"] },
  { name: "Ty's Cove", codes: ["5540", "2349"] },
  { name: "Lighthouse Point", codes: ["#7373"] },
  { name: "Southwood Shores", codes: ["60200", "42888", "48675"] },
  { name: "Palisades", codes: ["#4667", "6186", "#5572", "6649", "8708", "2205"] },
  { name: "The Cove (off Bluff Dr)", codes: ["#1172"] },
  { name: "Cobblestone (off Nichols)", codes: ["1776"] },
  { name: "Cape Royal", codes: ["#1114", "#1099"] },
  { name: "Car Wash", codes: ["655054#"] },
  { name: "Bronx", codes: ["9376"] },
  { name: "Mystic Bay", codes: ["0235#"] },
  { name: "RT's Cove", codes: ["8870"] },
  { name: "Magnolia Point", codes: ["#1827"] },
  { name: "Paige", codes: ["9195"] },
  { name: "Del Sol", codes: ["2202"] },
  { name: "Hamptons", codes: ["#3202"] },
  { name: "Stone Ridge", codes: ["1379"] },
  { name: "Lee C. Fine Airport", codes: ["1228"] },
  { name: "Sac Road", codes: ["#6423"] },
];

const LOCATIONS = [
  {
    name: "1932 Reserve",
    mapUrl: "/DropOffPics/1932-Reserve.png",
    notes: "Shuttle - May not fit through the street past 1932 due to on street parking. Follow down the hill towards the Getaway Boat rental turn left and park at the top of the hill, customers may have to walk down the hill to the resturant. All others can go to the top of the stairs for drop-off and pick-up.",
  },
  {
    name: "Backwater Jacks",
    mapUrl: "/DropOffPics/Backwater-Jacks.png",
    notes: "All vehicles - use the upper portion of the lot - it's flat, out of the way and you won't get stuck.",
  },
  {
    name: "Bagnell Dam Strip Behind Tuckers",
    mapUrl: "/DropOffPics/Bagnell-Dam-Strip-Behind-Tuckers.png",
    notes: "Use the alley behind Tuckers to drop off. Watch for tight turns and pedestrian foot traffic.",
  },
  {
    name: "Bagnell Dam Strip Lower",
    mapUrl: "/DropOffPics/Bagnell-Dam-Strip-Lower.png",
    notes: "3 marked zones - at your descretion based on availability. Try not to block driving lanes.",
  },
  {
    name: "Bagnell Dam Strip Mid",
    mapUrl: "/DropOffPics/Bagnell-Dam-Strip-Mid.png",
    notes: "4 marked zones - at your descretion based on availability. Try not to block driving lanes.",
  },
  {
    name: "Baxters and JB Hooks",
    mapUrl: "/DropOffPics/Baxters-and-JB-Hooks.png",
    notes: "Think Skinny - these parking lots are crammed - use descretion and look out for the safety of everyone. You can also use the bank parking lot for Baxters.",
  },
  {
    name: "Camden on the Lake – Shady Gators",
    mapUrl: "/DropOffPics/Camden-on-the-Lake---Shady Gators.png",
    notes: "Camden on the Lake - All large vehicles use parking lot in between H-Toads and Camden's main lobby. Shady Gators - after entering veer down to the right to take the outside lane down, Shuttle crosses over in the middle aisle, all others can proceed as normal.",
  },
  {
    name: "Coconuts",
    mapUrl: "/DropOffPics/Coconuts.png",
    notes: "Tight parking lot - watch the sides of the vehicles use descretion on if you can pull down or not.",
  },
  {
    name: "Cypress Condos",
    mapUrl: "/DropOffPics/Cypress-Condos.png",
    notes: "Shuttle and Rescue Squad should not go through the resident gate. Back down the hill or back out.",
  },
  {
    name: "Dog Days",
    mapUrl: "/DropOffPics/Dog-Days.png",
    notes: "Multiple pick-up/drop-off spots, use descretion.",
  },
  {
    name: "Encore",
    mapUrl: "/DropOffPics/Encore.png",
    notes: "Shuttle - depending on how busy it is, may not make the corner up front by the bar - use descretion.",
  },
  {
    name: "Fish and Co",
    mapUrl: "/DropOffPics/Fish-and-Co.png",
    notes: "Do not drive all of the way down the hill unless you are 100% confident you can turn around.",
  },
  {
    name: "Franky and Louies",
    mapUrl: "/DropOffPics/Franky-and-Louies.png",
    notes: "All vehicles should be able to handle the normal drop off location.",
  },
  {
    name: "LakeHouse 13",
    mapUrl: "/DropOffPics/LakeHouse-13.png",
    notes: "Shuttle - does not go down the hill. All others use descretion based on how busy it is.",
  },
  {
    name: "Old Kinderhook",
    mapUrl: "/DropOffPics/Old-Kinderhook.png",
    notes: "Hotel - proceed to Lobby as normal, stay to one side of lane. Golf Course - Enter main entrance to Trophy Room, but take first left and park on the top side of the lot.",
  },
  {
    name: "Osage National Golf Course",
    mapUrl: "/DropOffPics/Osage-National-Golf-Course.png",
    notes: "Shuttle - drop off at the top by the restaurant, do not go down to bag drop. All others can go down behind the building and drop off at the bag drop area.",
  },
  {
    name: "Ozarks Amphitheater",
    mapUrl: "/DropOffPics/Ozarks-Amphitheater.png",
    notes: "Be Careful - use descretion",
  },
  {
    name: "Redheads High Tide Performance Boat Center",
    mapUrl: "/DropOffPics/Redheads-High-Tide-Performance-Boat-Center.png",
    notes: "Shuttle should stay by garage and entrances - it cannot go in the parking lots.",
  },
  {
    name: "Shorty Pants",
    mapUrl: "/DropOffPics/Shorty-Pants.png",
    notes: "Shuttle take circle in front of condos, all others can go to restaurant unless parking lot is packed.",
  },
  {
    name: "The Cave",
    mapUrl: "/DropOffPics/The-Cave.png",
    notes: "Use descretion.",
  },
  {
    name: "Lodge of the Four Seasons",
    mapUrl: "/DropOffPics/The-Lodge-of-the-Four-Seasons.png",
    notes: "Watch overhead - do not go under canopy.",
  },
  {
    name: "Worldmark Lake of the Ozarks Condos",
    mapUrl: "/DropOffPics/Worldmark-Lake-of-the-Ozarks-Condos.png",
    notes: "Use main entrance - if parking lot is full, you may need to stay up by the club house in the shuttle.",
  },
  {
    name: "Margaritaville",
    mapUrl: "/DropOffPics/Margaritaville.png",
    notes: "Shuttle Drop-Off: Drive past the main entrance and make a right turn to head uphill. Once the shuttle is fully straightened out, begin descending back down the hill. Continue until you're able to safely maneuver around the island, then pull up along the outside of the lobby awning.All Other Vehicles: You may turn around and proceed directly under the awning for drop-off.",
  },
];

// --- Initialize Firebase Admin ---
async function initFirebase() {
  if (admin.apps.length > 0) {
    return;
  }

  const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ ERROR: serviceAccountKey.json not found!');
    console.error('Please download it from Firebase Console:');
    console.error('  Project Settings → Service Accounts → Generate new private key');
    console.error('  Save as: serviceAccountKey.json in project root\n');
    process.exit(1);
  }

  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: serviceAccount.project_id + '.appspot.com'
  });

  console.log('✅ Firebase Admin initialized\n');
}

// --- Upload image to Firebase Storage ---
async function uploadImage(localPath, storagePath) {
  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);

    await bucket.upload(localPath, {
      destination: storagePath,
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000',
      },
    });

    // Make file publicly readable
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    return publicUrl;
  } catch (error) {
    console.error(`  ⚠️  Failed to upload ${localPath}:`, error.message);
    return null;
  }
}

// --- Migrate Gate Codes ---
async function migrateGateCodes() {
  console.log('📋 Migrating Gate Codes...');

  const db = admin.firestore();
  const gateCodesRef = db.collection('gateCodes');

  // Check if collection already has data
  const snapshot = await gateCodesRef.limit(1).get();
  if (!snapshot.empty) {
    console.log('  ℹ️  gateCodes collection already populated, skipping...\n');
    return;
  }

  const batch = db.batch();
  let count = 0;

  for (const [index, gateCode] of GATE_CODES.entries()) {
    const docRef = gateCodesRef.doc();
    const data = {
      name: gateCode.name,
      codes: gateCode.codes,
      category: 'general', // Can be categorized later if needed
      sortOrder: index,
      active: true,
      usageCount: 0,
      lastUsed: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    batch.set(docRef, data);
    count++;
    console.log(`  ✓ ${gateCode.name} (${gateCode.codes.length} codes)`);
  }

  await batch.commit();
  console.log(`\n✅ Migrated ${count} gate codes\n`);
}

// --- Migrate Dropoff Locations ---
async function migrateDropoffLocations() {
  console.log('📍 Migrating Dropoff Locations...');

  const db = admin.firestore();
  const locationsRef = db.collection('dropoffLocations');

  // Check if collection already has data
  const snapshot = await locationsRef.limit(1).get();
  if (!snapshot.empty) {
    console.log('  ℹ️  dropoffLocations collection already populated, skipping...\n');
    return;
  }

  const publicDir = path.join(__dirname, '..', 'public', 'DropOffPics');

  if (!fs.existsSync(publicDir)) {
    console.error(`  ❌ Directory not found: ${publicDir}\n`);
    return;
  }

  const batch = db.batch();
  let uploadCount = 0;
  let docCount = 0;

  for (const [index, location] of LOCATIONS.entries()) {
    console.log(`\n  Processing: ${location.name}`);

    // Extract filename from mapUrl
    const filename = location.mapUrl.replace('/DropOffPics/', '');
    const localPath = path.join(publicDir, filename);

    let imageUrl = null;
    let imagePath = null;

    if (fs.existsSync(localPath)) {
      // Upload to Storage
      const storagePath = `dropoffs/${filename}`;
      console.log(`    → Uploading ${filename}...`);

      imageUrl = await uploadImage(localPath, storagePath);

      if (imageUrl) {
        imagePath = storagePath;
        uploadCount++;
        console.log(`    ✓ Uploaded: ${imageUrl}`);
      }
    } else {
      console.log(`    ⚠️  Image not found: ${filename}`);
    }

    // Create Firestore doc
    const docRef = locationsRef.doc();
    const data = {
      name: location.name,
      notes: location.notes,
      category: 'general', // Can be categorized later
      imageUrl: imageUrl,
      imagePath: imagePath,
      sortOrder: index,
      active: true,
      viewCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    batch.set(docRef, data);
    docCount++;
    console.log(`    ✓ Added to Firestore`);
  }

  await batch.commit();
  console.log(`\n✅ Migrated ${docCount} locations with ${uploadCount} images uploaded\n`);
}

// --- Main execution ---
async function main() {
  console.log('\n🚀 Driver Info → Firestore Migration\n');
  console.log('═'.repeat(50) + '\n');

  try {
    await initFirebase();
    await migrateGateCodes();
    await migrateDropoffLocations();

    console.log('═'.repeat(50));
    console.log('\n✨ Migration complete!\n');
    console.log('Next steps:');
    console.log('  1. Update Firestore rules (firestore.rules)');
    console.log('  2. Update Storage rules (storage.rules)');
    console.log('  3. Deploy rules: firebase deploy --only firestore:rules,storage');
    console.log('  4. Test the new DriverInfoPage\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
