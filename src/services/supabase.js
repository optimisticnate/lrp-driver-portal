/* Proprietary and confidential. See LICENSE. */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * @typedef {Object} GiftCard
 * @property {number} id
 * @property {string} code
 * @property {'digital'|'physical'} type
 * @property {number} initial_amount
 * @property {number} current_balance
 * @property {'active'|'redeemed'|'expired'|'cancelled'} status
 * @property {string} purchaser_name
 * @property {string} purchaser_email
 * @property {string|null} recipient_name
 * @property {string|null} recipient_email
 * @property {string|null} message
 * @property {'immediate'|'scheduled'|'physical'} delivery_method
 * @property {'pending'|'sent'|'delivered'|'failed'} delivery_status
 * @property {string|null} sent_date
 * @property {string|null} stripe_payment_intent_id
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Order
 * @property {number} id
 * @property {string} order_number
 * @property {string} customer_name
 * @property {string} customer_email
 * @property {string|null} customer_phone
 * @property {number} total
 * @property {number|null} subtotal
 * @property {number|null} tax
 * @property {number|null} shipping
 * @property {number|null} discount
 * @property {'pending'|'processing'|'shipped'|'delivered'|'cancelled'|'completed'} status
 * @property {string|null} payment_status
 * @property {string|null} payment_method
 * @property {string|null} stripe_payment_intent_id
 * @property {string|null} tracking_number
 * @property {string|null} shipping_carrier
 * @property {string|null} notes
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string|null} shipped_at
 * @property {string|null} delivered_at
 */

/**
 * @typedef {Object} OrderItem
 * @property {number} id
 * @property {number} order_id
 * @property {number|null} product_id
 * @property {string} product_name
 * @property {string|null} variant_name
 * @property {number} quantity
 * @property {number} price
 * @property {number} total
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} ShippingAddress
 * @property {number} id
 * @property {number} order_id
 * @property {string} line1
 * @property {string|null} line2
 * @property {string} city
 * @property {string} state
 * @property {string} postal_code
 * @property {string} country
 * @property {string} created_at
 * @property {string} updated_at
 */
