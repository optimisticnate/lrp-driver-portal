#!/bin/bash
# Manual Secret Update Script
# Run this ONLY when you need to change Twilio credentials
# DO NOT run this automatically in CI/CD!

set -e

PROJECT_ID="lrp---claim-portal"

echo "📝 This script updates Firebase Function secrets in Secret Manager"
echo "⚠️  WARNING: This creates new secret versions which cost $0.06/month each"
echo ""
echo "Current secrets:"
echo "  - TWILIO_ACCOUNT_SID"
echo "  - TWILIO_AUTH_TOKEN"
echo "  - TWILIO_FROM"
echo ""
read -p "Do you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Cancelled"
  exit 0
fi

echo ""
echo "🔐 Setting Twilio secrets..."
echo ""

# Prompt for each secret
echo "Enter TWILIO_ACCOUNT_SID (or press Enter to skip):"
read -r SID
if [ -n "$SID" ]; then
  firebase functions:secrets:set TWILIO_ACCOUNT_SID --project "$PROJECT_ID" <<< "$SID"
  echo "✅ TWILIO_ACCOUNT_SID updated"
fi

echo ""
echo "Enter TWILIO_AUTH_TOKEN (or press Enter to skip):"
read -r TOKEN
if [ -n "$TOKEN" ]; then
  firebase functions:secrets:set TWILIO_AUTH_TOKEN --project "$PROJECT_ID" <<< "$TOKEN"
  echo "✅ TWILIO_AUTH_TOKEN updated"
fi

echo ""
echo "Enter TWILIO_FROM phone number (or press Enter to skip):"
read -r FROM
if [ -n "$FROM" ]; then
  firebase functions:secrets:set TWILIO_FROM --project "$PROJECT_ID" <<< "$FROM"
  echo "✅ TWILIO_FROM updated"
fi

echo ""
echo "✅ Secret update complete!"
echo ""
echo "💡 Next steps:"
echo "   1. Clean up old secret versions (see SECRET_MANAGER_CLEANUP.md)"
echo "   2. Redeploy functions: firebase deploy --only functions --project $PROJECT_ID"
echo ""
