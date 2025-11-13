#!/usr/bin/env node
/* Deploy storage rules using Firebase Admin SDK */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'lrp---claim-portal.firebasestorage.app'
});

async function deployStorageRules() {
  try {
    // Read the storage rules file
    const rulesPath = path.join(__dirname, '..', 'storage.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    console.log('📝 Reading storage rules from:', rulesPath);
    console.log('🔐 Deploying to project:', serviceAccount.project_id);

    // Get access token from service account
    const accessToken = await admin.credential.cert(serviceAccount).getAccessToken();

    const projectId = serviceAccount.project_id;
    const bucketName = 'lrp---claim-portal.firebasestorage.app';

    // Deploy using Firebase Security Rules API
    const postData = JSON.stringify({
      source: {
        files: [
          {
            name: 'storage.rules',
            content: rulesContent
          }
        ]
      }
    });

    const options = {
      hostname: 'firebaserules.googleapis.com',
      port: 443,
      path: `/v1/projects/${projectId}/releases?name=firebase.storage/${bucketName}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.access_token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('✅ Storage rules deployed successfully!');
          console.log('Response:', data);
        } else {
          console.error('❌ Failed to deploy storage rules');
          console.error('Status:', res.statusCode);
          console.error('Response:', data);
          process.exit(1);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Error deploying storage rules:', error);
      process.exit(1);
    });

    req.write(postData);
    req.end();

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deployStorageRules();
