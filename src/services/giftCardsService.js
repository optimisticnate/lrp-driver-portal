/* Proprietary and confidential. See LICENSE. */
import { getFunctions, httpsCallable } from 'firebase/functions'

// Use Firebase Cloud Functions as secure proxy to Supabase
// Service role key stays server-side (secure!)
const functions = getFunctions()
const giftCardsQuery = httpsCallable(functions, 'giftCardsQuery')

export class GiftCardsService {
  /**
   * Get all gift cards with optional filters
   * @param {Object} [filters]
   * @param {string} [filters.status]
   * @param {number} [filters.limit]
   * @param {number} [filters.offset]
   * @returns {Promise<{data: import('./supabase').GiftCard[], count: number}>}
   */
  async getAll(filters) {
    try {
      const result = await giftCardsQuery({
        operation: 'getAll',
        params: filters || {}
      })

      return result.data
    } catch (error) {
      console.error('Error fetching gift cards:', error)
      throw error
    }
  }

  /**
   * Search by code
   * @param {string} code
   * @returns {Promise<import('./supabase').GiftCard|null>}
   */
  async findByCode(code) {
    try {
      const result = await giftCardsQuery({
        operation: 'findByCode',
        params: { code }
      })

      return result.data.data
    } catch (error) {
      console.error('Error finding gift card:', error)
      return null
    }
  }

  /**
   * Get single gift card by ID
   * @param {number} id
   * @returns {Promise<import('./supabase').GiftCard|null>}
   */
  async getById(id) {
    try {
      const result = await giftCardsQuery({
        operation: 'getById',
        params: { id }
      })

      return result.data.data
    } catch (error) {
      console.error('Error fetching gift card:', error)
      return null
    }
  }

  /**
   * Update gift card
   * @param {number} id
   * @param {Partial<import('./supabase').GiftCard>} updates
   * @returns {Promise<import('./supabase').GiftCard|null>}
   */
  async update(id, updates) {
    try {
      const result = await giftCardsQuery({
        operation: 'update',
        params: { id, updates }
      })

      return result.data.data
    } catch (error) {
      console.error('Error updating gift card:', error)
      throw error
    }
  }

  /**
   * Update status
   * @param {number} id
   * @param {string} status
   * @returns {Promise<boolean>}
   */
  async updateStatus(id, status) {
    const result = await giftCardsQuery({
      operation: 'updateStatus',
      params: { id, status }
    })

    return result.data.success
  }

  /**
   * Update delivery status
   * @param {number} id
   * @param {string} deliveryStatus
   * @returns {Promise<boolean>}
   */
  async updateDeliveryStatus(id, deliveryStatus) {
    try {
      const updates = {
        delivery_status: deliveryStatus,
        ...(deliveryStatus === 'sent' || deliveryStatus === 'delivered' ? { sent_date: new Date().toISOString() } : {})
      }

      await giftCardsQuery({
        operation: 'update',
        params: { id, updates }
      })

      return true
    } catch (error) {
      console.error('Error updating delivery status:', error)
      return false
    }
  }

  /**
   * Redeem gift card (reduce balance)
   * @param {number} id
   * @param {number} amount
   * @returns {Promise<boolean>}
   */
  async redeem(id, amount) {
    try {
      // Get current card
      const card = await this.getById(id)
      if (!card) return false

      const newBalance = card.current_balance - amount

      if (newBalance < 0) {
        throw new Error('Insufficient balance')
      }

      const updates = {
        current_balance: newBalance
      }

      // If fully redeemed, mark as redeemed
      if (newBalance === 0) {
        updates.status = 'redeemed'
      }

      await this.update(id, updates)
      return true
    } catch (error) {
      console.error('Error redeeming gift card:', error)
      return false
    }
  }

  /**
   * Create new gift card
   * @param {Object} cardData
   * @param {string} cardData.code
   * @param {number} cardData.initial_amount
   * @param {'digital'|'physical'} [cardData.type]
   * @param {string} [cardData.purchaser_name]
   * @param {string} [cardData.purchaser_email]
   * @param {string} [cardData.recipient_name]
   * @param {string} [cardData.recipient_email]
   * @param {string} [cardData.message]
   * @param {'immediate'|'scheduled'|'physical'} [cardData.delivery_method]
   * @returns {Promise<import('./supabase').GiftCard|null>}
   */
  async create(cardData) {
    try {
      const newCard = {
        code: cardData.code.toUpperCase(),
        type: cardData.type || 'digital',
        initial_amount: cardData.initial_amount,
        current_balance: cardData.initial_amount,
        status: 'active',
        purchaser_name: cardData.purchaser_name || '',
        purchaser_email: cardData.purchaser_email || '',
        recipient_name: cardData.recipient_name || null,
        recipient_email: cardData.recipient_email || null,
        message: cardData.message || null,
        delivery_method: cardData.delivery_method || 'immediate',
        delivery_status: 'pending',
        sent_date: null,
        stripe_payment_intent_id: null
      }

      const result = await giftCardsQuery({
        operation: 'create',
        params: { cardData: newCard }
      })

      return result.data.data
    } catch (error) {
      console.error('Error creating gift card:', error)
      throw error
    }
  }

  /**
   * Get stats
   * @returns {Promise<{total: number, active: number, redeemed: number, totalValue: number}>}
   */
  async getStats() {
    try {
      const result = await giftCardsQuery({
        operation: 'getStats',
        params: {}
      })

      return result.data.data
    } catch (error) {
      console.error('Error fetching stats:', error)
      return { total: 0, active: 0, redeemed: 0, totalValue: 0 }
    }
  }
}

export const giftCardsService = new GiftCardsService()
