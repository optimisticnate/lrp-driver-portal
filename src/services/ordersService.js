/* Proprietary and confidential. See LICENSE. */
import { getFunctions, httpsCallable } from 'firebase/functions'

/**
 * @typedef {import('./supabase').Order & {items?: import('./supabase').OrderItem[], shippingAddress?: import('./supabase').ShippingAddress}} OrderWithDetails
 */

// Use Firebase Cloud Functions as secure proxy to Supabase
// Service role key stays server-side (secure!)
const functions = getFunctions()
const ordersQuery = httpsCallable(functions, 'ordersQuery')

export class OrdersService {
  /**
   * Get all orders with optional filters
   * @param {Object} [filters]
   * @param {string} [filters.status]
   * @param {number} [filters.limit]
   * @param {number} [filters.offset]
   * @returns {Promise<{data: OrderWithDetails[], count: number}>}
   */
  async getAll(filters) {
    try {
      const result = await ordersQuery({
        operation: 'getAll',
        params: filters || {}
      })

      return result.data
    } catch (error) {
      console.error('Error fetching orders:', error)
      throw error
    }
  }

  /**
   * Get single order by ID
   * @param {number} id
   * @returns {Promise<OrderWithDetails|null>}
   */
  async getById(id) {
    try {
      const result = await ordersQuery({
        operation: 'getById',
        params: { id }
      })

      return result.data.data
    } catch (error) {
      console.error('Error fetching order:', error)
      return null
    }
  }

  /**
   * Update order status
   * @param {number} id
   * @param {string} status
   * @returns {Promise<boolean>}
   */
  async updateStatus(id, status) {
    const result = await ordersQuery({
      operation: 'updateStatus',
      params: { id, status }
    })

    return result.data.success
  }

  /**
   * Update order with tracking number
   * @param {number} id
   * @param {string} trackingNumber
   * @param {string} [carrier]
   * @returns {Promise<boolean>}
   */
  async updateTracking(id, trackingNumber, carrier) {
    const result = await ordersQuery({
      operation: 'updateTracking',
      params: { id, trackingNumber, carrier }
    })

    return result.data.success
  }

  /**
   * Update order
   * @param {number} id
   * @param {Partial<import('./supabase').Order>} updates
   * @returns {Promise<import('./supabase').Order|null>}
   */
  async update(id, updates) {
    try {
      const result = await ordersQuery({
        operation: 'update',
        params: { id, updates }
      })

      return result.data.data
    } catch (error) {
      console.error('Error updating order:', error)
      throw error
    }
  }

  /**
   * Get stats
   * @returns {Promise<{total: number, pending: number, processing: number, shipped: number, delivered: number, completed: number, totalRevenue: number}>}
   */
  async getStats() {
    try {
      const result = await ordersQuery({
        operation: 'getStats',
        params: {}
      })

      return result.data.data
    } catch (error) {
      console.error('Error fetching order stats:', error)
      return {
        total: 0,
        pending: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        completed: 0,
        totalRevenue: 0
      }
    }
  }

  /**
   * Search orders
   * @param {string} searchTerm
   * @returns {Promise<OrderWithDetails[]>}
   */
  async search(searchTerm) {
    try {
      const result = await ordersQuery({
        operation: 'search',
        params: { searchTerm }
      })

      return result.data.data
    } catch (error) {
      console.error('Error searching orders:', error)
      return []
    }
  }
}

export const ordersService = new OrdersService()
