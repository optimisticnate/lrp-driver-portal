# Secrets Management Guide

**Project:** lrp---claim-portal

---

## Quick Reference

### ✅ Current Approach (Cost-Optimized)

Secrets are set **ONCE manually** and persist across deployments.

**Cost:** $0.18/month (3 secrets × $0.06/month)

---

## Available Secrets

| Secret Name | Purpose | Used By |
|-------------|---------|---------|
| `TWILIO_ACCOUNT_SID` | Twilio Account ID | SMS functions |
| `TWILIO_AUTH_TOKEN` | Twilio API Key | SMS functions |
| `TWILIO_FROM` | Twilio Phone Number | SMS functions |

---

## How to Update Secrets

### Option 1: Manual Command (Recommended)

```bash
# Update individual secrets
firebase functions:secrets:set TWILIO_ACCOUNT_SID --project lrp---claim-portal
firebase functions:secrets:set TWILIO_AUTH_TOKEN --project lrp---claim-portal
firebase functions:secrets:set TWILIO_FROM --project lrp---claim-portal
```

### Option 2: Use Helper Script

```bash
# Interactive script that prompts for each secret
./scripts/update-secrets.sh
```

---

## Important Notes

### ⚠️ Do NOT Run on Every Deployment

The workflows **no longer** set secrets automatically. This is intentional!

**Why?**
- Each `functions:secrets:set` creates a new version
- New versions cost $0.06/month EACH
- We were creating 450+ versions ($27/month waste!)

### ✅ Current State

- Secrets are already set and working
- They persist across all deployments
- Only update when Twilio credentials actually change

---

## When to Update Secrets

Update secrets only when:
1. Twilio credentials change (e.g., new account)
2. Phone number changes
3. Security rotation required

**Typical frequency:** Once per year or less

---

## Cleanup Old Versions

After updating secrets, clean up old versions:

```bash
# See all versions
gcloud secrets versions list TWILIO_ACCOUNT_SID --project=lrp---claim-portal

# Delete old versions (keep only latest)
PROJECT_ID="lrp---claim-portal"
for SECRET in TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM; do
  VERSIONS=$(gcloud secrets versions list $SECRET \
    --project=$PROJECT_ID \
    --format="value(name)" \
    --filter="name!='1'" \
    --sort-by=~name)

  for VERSION in $VERSIONS; do
    gcloud secrets versions destroy $VERSION \
      --secret=$SECRET \
      --project=$PROJECT_ID \
      --quiet
  done
done
```

---

## Verification

### Check Current Secrets:

```bash
# List all secrets
gcloud secrets list --project=lrp---claim-portal

# See secret versions (should only have version "1" enabled)
gcloud secrets versions list TWILIO_ACCOUNT_SID --project=lrp---claim-portal
```

### Test in Functions:

```bash
# Deploy and test
firebase deploy --only functions --project=lrp---claim-portal

# Check logs
gcloud logging read "resource.type=cloud_function" --limit=20 --project=lrp---claim-portal
```

---

## Troubleshooting

### "Secret not found" error

If functions can't access secrets:

```bash
# Ensure secrets are bound to functions
firebase deploy --only functions --project=lrp---claim-portal --force
```

### "Permission denied" error

Ensure service account has access:

```bash
# Grant Secret Manager access to Cloud Functions service account
gcloud projects add-iam-policy-binding lrp---claim-portal \
  --member="serviceAccount:lrp---claim-portal@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Cost Monitoring

Track Secret Manager costs:

```bash
# View billing for Secret Manager
gcloud billing accounts list
```

In GCP Console:
1. Go to Billing → Reports
2. Filter by Service: "Secret Manager"
3. Should see **$0.18/month** (3 secrets × $0.06)

If cost is higher, check for extra versions:

```bash
# Count enabled versions (should be 3 total - one per secret)
gcloud secrets versions list TWILIO_ACCOUNT_SID --filter="state:ENABLED" --format="value(name)" | wc -l
gcloud secrets versions list TWILIO_AUTH_TOKEN --filter="state:ENABLED" --format="value(name)" | wc -l
gcloud secrets versions list TWILIO_FROM --filter="state:ENABLED" --format="value(name)" | wc -l
```

---

## Migration Notes

### What Changed (2025-11-06)

**Before:**
- Workflows ran `firebase functions:secrets:set` on EVERY deployment
- Created new versions constantly
- Cost: $27/month (450 versions!)

**After:**
- Secrets set once manually
- Persist across deployments
- Cost: $0.18/month (3 versions)

**Savings:** $26.82/month 💰

---

## Future Improvements

### Option 1: Auto-expire Old Versions

Configure automatic cleanup:

```bash
for SECRET in TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM; do
  gcloud secrets update $SECRET \
    --project=lrp---claim-portal \
    --version-destroy-ttl=7d
done
```

This automatically destroys versions older than 7 days.

### Option 2: Switch to Environment Variables

For non-sensitive configs, consider environment variables (no extra cost):

**Pros:**
- $0 cost
- Simpler management
- Already used for email configs

**Cons:**
- Visible in GCP Console
- Less secure than Secret Manager

---

## Quick Commands Cheat Sheet

```bash
# List secrets
firebase functions:secrets:access TWILIO_ACCOUNT_SID --project lrp---claim-portal

# Update secret
firebase functions:secrets:set TWILIO_ACCOUNT_SID --project lrp---claim-portal

# Delete secret
firebase functions:secrets:destroy TWILIO_ACCOUNT_SID --project lrp---claim-portal

# View secret versions
gcloud secrets versions list TWILIO_ACCOUNT_SID --project=lrp---claim-portal

# Destroy specific version
gcloud secrets versions destroy VERSION_NUMBER \
  --secret=TWILIO_ACCOUNT_SID \
  --project=lrp---claim-portal
```

---

**Questions? See:**
- `SECRET_MANAGER_CLEANUP.md` - Cleanup instructions
- `GCP_OPTIMIZATION_SUMMARY.md` - Full optimization details
- `scripts/update-secrets.sh` - Helper script
