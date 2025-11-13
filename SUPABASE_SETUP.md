# Supabase Integration via Secure Cloud Functions

This document describes how LRP Bolt connects to Supabase database through secure Cloud Functions for Gift Cards and Shop Orders management.

## Architecture

```
LRP Bolt (public) → Firebase Auth → Cloud Functions → Supabase (service_role)
                         ↓                                    ↑
                    Admin Check                               |
                                                              |
Payload CMS ───────────────────────────────────────────────────┘
```

**Security Model:**
- LRP Bolt sends authenticated requests to Cloud Functions
- Cloud Functions validate Firebase auth tokens and check admin access
- Only Cloud Functions have the `service_role` key (never exposed to client)
- Supabase service key stays server-side (secure!)

## Setup

### 1. Backend Configuration (Cloud Functions)

Create `functions/.env` file with your Supabase credentials:

```bash
# Copy the example file
cp functions/.env.example functions/.env

# Add your credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get these values from:
1. Go to https://app.supabase.com
2. Select your project
3. Go to Settings → API
4. Copy `Project URL` and `service_role` key (NOT anon key!)

### 2. Configure GitHub Secrets

Add these to your GitHub repository secrets:

1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Add repository secrets:
   - `SUPABASE_URL` = `https://your-project.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = Your service_role key from Supabase

**The GitHub Actions workflow will automatically configure these as environment variables on your Cloud Functions during deployment.**

### 3. Deploy Cloud Functions

**Option A: Via GitHub Actions (Recommended)**

Push to `main` branch or trigger manual workflow - GitHub Actions will automatically:
1. Detect changes in `functions/` directory
2. Deploy the functions
3. Configure Supabase environment variables on Cloud Run services

**Option B: Manual Local Deployment**

```bash
# Deploy the new functions
firebase deploy --only functions:giftCardsQuery,functions:ordersQuery

# Manually set env vars (required if not using GitHub Actions)
gcloud run services update giftcardsquery \
  --region=us-central1 \
  --set-env-vars="SUPABASE_URL=https://your-project.supabase.co,SUPABASE_SERVICE_ROLE_KEY=your-key"

gcloud run services update ordersquery \
  --region=us-central1 \
  --set-env-vars="SUPABASE_URL=https://your-project.supabase.co,SUPABASE_SERVICE_ROLE_KEY=your-key"
```

### 4. Client Configuration

**No client-side env vars needed!** Bolt automatically uses Firebase Auth and calls the Cloud Functions.

The services (`giftCardsService`, `ordersService`) are already configured to use the secure proxy.

## How It Works

### Authentication Flow

1. User logs into LRP Bolt with Firebase Auth
2. Bolt calls Cloud Function with auth token
3. Cloud Function validates token and checks admin access:
   - Checks Firebase custom claims (`admin=true` or `role=admin`)
   - Falls back to Firestore (`userAccess` or `users` collection)
4. If authorized, Cloud Function uses service_role key to query Supabase
5. Returns data to Bolt

### Cloud Functions

#### `giftCardsQuery`
Handles all gift card operations:
- `getAll` - Fetch all gift cards with filters
- `findByCode` - Search by code
- `getById` - Get single card
- `update` - Update card
- `updateStatus` - Change status
- `create` - Create new card
- `getStats` - Get statistics

#### `ordersQuery`
Handles all order operations:
- `getAll` - Fetch all orders with items and shipping
- `getById` - Get single order
- `updateStatus` - Change order status
- `updateTracking` - Add tracking number
- `update` - Update order
- `getStats` - Get statistics
- `search` - Search orders

### Client Services

#### Gift Cards Service (`src/services/giftCardsService.ts`)
```typescript
import { giftCardsService } from './services/giftCardsService'

// Fetch all cards
const { data, count } = await giftCardsService.getAll({ limit: 100 })

// Find by code
const card = await giftCardsService.findByCode('LRP-XXXX-XXXX')

// Update status
await giftCardsService.updateStatus(cardId, 'active')

// Create card
const newCard = await giftCardsService.create({
  code: 'LRP-XXXX-XXXX',
  initial_amount: 100,
  purchaser_name: 'John Doe',
  purchaser_email: 'john@example.com'
})
```

#### Orders Service (`src/services/ordersService.ts`)
```typescript
import { ordersService } from './services/ordersService'

// Fetch all orders
const { data, count } = await ordersService.getAll({ limit: 100 })

// Update order status
await ordersService.updateStatus(orderId, 'shipped')

// Add tracking
await ordersService.updateTracking(orderId, 'USPS123456789', 'USPS')
```

## Database Tables

The Cloud Functions query these tables:

### gift_cards
- `id` (bigint, primary key)
- `code` (text) - Unique gift card code
- `type` (text) - 'digital' | 'physical'
- `initial_amount` (numeric)
- `current_balance` (numeric)
- `status` (text) - 'active' | 'redeemed' | 'expired' | 'cancelled'
- `purchaser_name`, `purchaser_email` (text)
- `recipient_name`, `recipient_email` (text)
- `message` (text)
- `delivery_method` (text) - 'immediate' | 'scheduled' | 'physical'
- `delivery_status` (text) - 'pending' | 'sent' | 'delivered' | 'failed'
- `sent_date` (timestamp)
- `stripe_payment_intent_id` (text)
- `created_at`, `updated_at` (timestamp)

### orders
- `id` (bigint, primary key)
- `order_number` (text)
- `customer_name`, `customer_email`, `customer_phone` (text)
- `total`, `subtotal`, `tax`, `shipping`, `discount` (numeric)
- `status` (text) - 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'completed'
- `payment_status`, `payment_method` (text)
- `stripe_payment_intent_id` (text)
- `tracking_number`, `shipping_carrier` (text)
- `notes` (text)
- `created_at`, `updated_at`, `shipped_at`, `delivered_at` (timestamp)

### order_items
- `id` (bigint, primary key)
- `order_id` (bigint, foreign key to orders)
- `product_id` (bigint)
- `product_name`, `variant_name` (text)
- `quantity` (integer)
- `price`, `total` (numeric)
- `created_at`, `updated_at` (timestamp)

### shipping_addresses
- `id` (bigint, primary key)
- `order_id` (bigint, foreign key to orders)
- `line1`, `line2`, `city`, `state`, `postal_code`, `country` (text)
- `created_at`, `updated_at` (timestamp)

## Row Level Security (RLS)

**No RLS policies needed!** The Cloud Functions use the `service_role` key which bypasses RLS.

Security is handled by:
1. Firebase Auth token validation
2. Admin access checks in Cloud Functions
3. Network security (Cloud Functions are the only ones with service_role key)

## Security Benefits

✅ **Service Role Key Never Exposed** - Stays server-side only
✅ **Firebase Auth Integration** - Validates every request
✅ **Admin Access Control** - Checks custom claims and Firestore roles
✅ **Audit Trail** - All requests logged in Cloud Functions
✅ **Bypass RLS** - No complex RLS policies needed
✅ **Public Internet Safe** - No database credentials in client code

## Troubleshooting

### "Authentication required"
- User must be logged in with Firebase Auth
- Check that auth token is being sent correctly

### "Admin access required"
- User needs `admin=true` custom claim OR `role=admin`
- Check Firestore `userAccess` collection or `users` collection
- Verify with: `firebase auth:export users.json`

### "Supabase not configured"
- Check `functions/.env` has correct credentials
- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
- Redeploy functions: `firebase deploy --only functions`

### "Function not found"
- Ensure functions are deployed: `firebase deploy --only functions:giftCardsQuery,functions:ordersQuery`
- Check Firebase Console → Functions for deployment status

### Connection errors
- Verify Supabase project is active
- Check Cloud Functions can reach Supabase (network/firewall)
- Test with `curl` from Cloud Function environment

## Testing

```bash
# Test gift cards query (requires Firebase Auth token)
curl -X POST https://us-central1-YOUR_PROJECT.cloudfunctions.net/giftCardsQuery \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operation":"getAll","params":{"limit":10}}'

# Test orders query
curl -X POST https://us-central1-YOUR_PROJECT.cloudfunctions.net/ordersQuery \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operation":"getAll","params":{"limit":10}}'
```

## Components

### Gift Card Manager (`src/pages/GiftCardManager.jsx`)
- Displays all gift cards in a table
- Search by code, recipient, or purchaser
- Filter by status
- View details and update status
- Create new gift cards
- Shows statistics dashboard

### Shop Manager (`src/pages/ShopManager.jsx`)
- Displays all orders in a table
- Search by order number, customer name, or email
- Filter by status
- View order details with items and shipping
- Update order status
- Add tracking numbers (for manual fulfillment)
- Shows statistics dashboard

## Future Enhancements

- Add rate limiting to Cloud Functions
- Implement caching with Redis
- Add webhook endpoints for Stripe/Printify integration
- Real-time updates with Supabase subscriptions
- Audit log for all admin actions
- Export functionality for reporting
