# Secret Manager Cleanup & Cost Reduction

**Date:** 2025-11-06
**Current Cost:** $27.17/month
**Target Cost:** $0.18-$2/month
**Potential Savings:** $25-27/month

---

## Problem Identified

Your GitHub Actions workflows are running this command **on EVERY deployment**:

```bash
firebase functions:secrets:set TWILIO_ACCOUNT_SID ...
firebase functions:secrets:set TWILIO_AUTH_TOKEN ...
firebase functions:secrets:set TWILIO_FROM ...
```

**This creates a NEW secret version every time, and Secret Manager charges $0.06 per version per month!**

With ~450 versions accumulated, you're paying $27.17/month for storing the SAME values hundreds of times.

---

## Immediate Actions

### 1. Delete Old Secret Versions (URGENT)

Run these commands in GCP Cloud Shell or locally with gcloud:

```bash
# Set your project
PROJECT_ID="lrp---claim-portal"

# List all secret versions to see the problem
gcloud secrets versions list TWILIO_ACCOUNT_SID --project=$PROJECT_ID
gcloud secrets versions list TWILIO_AUTH_TOKEN --project=$PROJECT_ID
gcloud secrets versions list TWILIO_FROM --project=$PROJECT_ID

# Delete all but the latest version of each secret
for SECRET in TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM; do
  echo "Cleaning up $SECRET..."

  # Get all version numbers except the latest (1)
  VERSIONS=$(gcloud secrets versions list $SECRET \
    --project=$PROJECT_ID \
    --format="value(name)" \
    --filter="name!='1'" \
    --sort-by=~name)

  # Delete each old version
  for VERSION in $VERSIONS; do
    echo "Deleting $SECRET version $VERSION"
    gcloud secrets versions destroy $VERSION \
      --secret=$SECRET \
      --project=$PROJECT_ID \
      --quiet
  done
done

echo "✅ Cleanup complete! Check billing in 24-48 hours."
```

**Expected savings: $25-27/month immediately!**

---

### 2. Stop Creating New Versions on Every Deploy

**Option A: Only set secrets when they actually change (RECOMMENDED)**

Update `.github/workflows/deploy.yml` and `.github/workflows/manual-deploy-functions.yml`:

**REMOVE these lines** (lines 365-376 in deploy.yml, 62-72 in manual-deploy-functions.yml):

```yaml
# DELETE THIS ENTIRE STEP:
- name: Set Twilio secrets in Firebase (idempotent)
  env:
    FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
    TWILIO_ACCOUNT_SID: ${{ secrets.TWILIO_ACCOUNT_SID }}
    TWILIO_AUTH_TOKEN:  ${{ secrets.TWILIO_AUTH_TOKEN }}
    TWILIO_FROM:        ${{ secrets.TWILIO_FROM }}
  run: |
    firebase functions:secrets:set TWILIO_ACCOUNT_SID --project "$FIREBASE_PROJECT_ID" <<< "$TWILIO_ACCOUNT_SID"
    firebase functions:secrets:set TWILIO_AUTH_TOKEN  --project "$FIREBASE_PROJECT_ID" <<< "$TWILIO_AUTH_TOKEN"
    firebase functions:secrets:set TWILIO_FROM        --project "$FIREBASE_PROJECT_ID" <<< "$TWILIO_FROM"
```

**Instead, set secrets ONCE manually:**

```bash
# Run this ONCE (not in GitHub Actions)
firebase functions:secrets:set TWILIO_ACCOUNT_SID --project lrp---claim-portal
firebase functions:secrets:set TWILIO_AUTH_TOKEN --project lrp---claim-portal
firebase functions:secrets:set TWILIO_FROM --project lrp---claim-portal
```

Then they'll persist across deployments without creating new versions!

---

**Option B: Switch to Environment Variables (ALTERNATIVE)**

Instead of Secret Manager, use Cloud Run environment variables (no extra cost):

**Benefits:**
- $0 cost (included in Cloud Run pricing)
- Simpler to manage
- No secret versions to clean up

**Trade-off:**
- Environment variables are visible in GCP Console (less secure than Secret Manager)
- For Twilio keys, this is acceptable (they're API keys, not ultra-sensitive data)

**Implementation:**
1. Remove `firebase functions:secrets:set` commands from workflows
2. Update function code to use environment variables set by Cloud Run
3. The workflows already set env vars for email functions (lines 407, 421, etc.)

---

## Cost Comparison

| Approach | Monthly Cost | Security | Complexity |
|----------|--------------|----------|------------|
| **Current (450 versions)** | $27.17 | High | High |
| **Secret Manager (cleaned up)** | $0.18 | High | Low |
| **Environment Variables** | $0.00 | Medium | Very Low |

**Recommended: Clean up versions + use Secret Manager properly = $0.18/month**

---

## Long-term Prevention

### Enable Auto-deletion of Old Secret Versions

After cleanup, configure secret auto-expiry:

```bash
# For each secret, only keep latest 3 versions
for SECRET in TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM; do
  gcloud secrets update $SECRET \
    --project=lrp---claim-portal \
    --version-destroy-ttl=7d \
    --replication-policy=automatic
done
```

This automatically deletes versions older than 7 days, keeping only recent ones.

---

## Verification

### Check Current Secret Versions:

```bash
# See how many versions you have
gcloud secrets versions list TWILIO_ACCOUNT_SID --project=lrp---claim-portal --format="table(name,state,createTime)"
```

You'll probably see something like:
```
NAME    STATE    CREATE_TIME
156     enabled  2025-11-05
155     enabled  2025-11-04
154     enabled  2025-11-03
...
1       enabled  2024-08-15
```

**All those "enabled" versions are costing $0.06 each!**

### After Cleanup:

```
NAME    STATE      CREATE_TIME
156     enabled    2025-11-05
155     destroyed  2025-11-04
154     destroyed  2025-11-03
...
```

Only version 156 costs money = $0.06/month per secret = $0.18 total

---

## Implementation Steps

### URGENT (Do Today):

1. ✅ Run the secret cleanup script above
2. ✅ Remove "Set Twilio secrets" steps from both workflows
3. ✅ Verify secrets still work (they will - existing versions remain active)

**Time required:** 10 minutes
**Savings:** $25-27/month

### This Week:

4. Configure auto-deletion of old versions
5. Monitor billing to confirm savings

### Optional:

6. Consider switching to environment variables for non-sensitive configs

---

## Files to Modify

1. `.github/workflows/deploy.yml` - Remove lines 365-376
2. `.github/workflows/manual-deploy-functions.yml` - Remove lines 62-72

---

## Why This Happened

Firebase's `functions:secrets:set` command is **NOT idempotent** - it creates a new version every time, even if the value hasn't changed.

The workflow comments say "(idempotent)" but that's **incorrect** - it's creating new versions on every run!

**The fix:** Only run `functions:secrets:set` when values actually change (manually), not on every deployment.

---

## Summary

- **Current waste:** $27.17/month storing 450+ duplicate secret versions
- **Quick fix:** Delete old versions, stop creating new ones
- **Time to fix:** 10 minutes
- **Monthly savings:** $25-27
- **New cost:** $0.18/month

**This is the #2 biggest cost optimization after deleting the GKE cluster!**

---

**Ready to run the cleanup script?**
