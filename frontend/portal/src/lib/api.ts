import { getAuthSession } from './auth'

/**
 * Platform API Client
 *
 * Client for communicating with the shared authentication and billing API.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.aidreams-factory.com'
const PRODUCT_ID = process.env.NEXT_PUBLIC_PRODUCT_ID || 'portal'

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const session = await getAuthSession()
  const token = session?.tokens?.idToken?.toString()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `API Error: ${response.status}`)
  }

  return response.json()
}

/**
 * Get user's subscription information
 */
export async function getSubscription() {
  return apiRequest<{
    plan_id: string
    plan_name: string
    status: string
    price: number
    billing_period: string
    next_billing_date: string
    usage: {
      used: number
      limit: number
    }
  }>('/api/v1/subscription')
}

/**
 * Get user's entitlement (access permissions)
 */
export async function getEntitlement() {
  return apiRequest<{
    product_id: string
    plan_id: string
    status: string
    features: Record<string, boolean>
    usage: {
      limit: number
      used: number
      remaining: number
    }
  }>(`/api/v1/entitlement/${PRODUCT_ID}`)
}

/**
 * Record usage event (for metered billing)
 */
export async function recordUsage(quantity: number = 1) {
  return apiRequest<{
    success: boolean
    usage: {
      used: number
      limit: number
      remaining: number
    }
  }>('/api/v1/usage', {
    method: 'POST',
    body: JSON.stringify({
      product_id: PRODUCT_ID,
      quantity,
    }),
  })
}

/**
 * Get billing history
 */
export async function getBillingHistory() {
  return apiRequest<{
    invoices: Array<{
      id: string
      date: string
      amount: number
      status: string
      pdf_url: string
    }>
  }>('/api/v1/billing/history')
}

/**
 * Cancel subscription
 */
export async function cancelSubscription() {
  return apiRequest<{
    success: boolean
    cancellation_date: string
  }>('/api/v1/subscription/cancel', {
    method: 'POST',
  })
}

/**
 * Update payment method
 */
export async function updatePaymentMethod(paymentMethodId: string) {
  return apiRequest<{
    success: boolean
  }>('/api/v1/billing/payment-method', {
    method: 'PUT',
    body: JSON.stringify({
      payment_method_id: paymentMethodId,
    }),
  })
}
