import { loadStripe, Stripe } from '@stripe/stripe-js'
import { getAuthSession } from './auth'

/**
 * Stripe Integration
 *
 * Handles Stripe Checkout Session creation and payment processing.
 */

const STRIPE_PUBLIC_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.aidreams-factory.com'

let stripePromise: Promise<Stripe | null>

/**
 * Get Stripe instance
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLIC_KEY)
  }
  return stripePromise
}

/**
 * Create Stripe Checkout Session
 *
 * Creates a checkout session on the backend and returns the session URL.
 */
export async function createCheckoutSession(planId: string): Promise<{
  sessionId: string
  url: string
}> {
  const session = await getAuthSession()
  const token = session?.tokens?.idToken?.toString()

  const response = await fetch(`${API_URL}/api/v1/checkout/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      plan_id: planId,
      success_url: `${window.location.origin}/account?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${window.location.origin}/plans`,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || 'Failed to create checkout session')
  }

  const data = await response.json()
  return data
}

/**
 * Create Stripe Customer Portal Session
 *
 * Creates a portal session for managing subscription and billing.
 */
export async function createPortalSession(): Promise<{
  url: string
}> {
  const session = await getAuthSession()
  const token = session?.tokens?.idToken?.toString()

  const response = await fetch(`${API_URL}/api/v1/billing/portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      return_url: `${window.location.origin}/account`,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || 'Failed to create portal session')
  }

  const data = await response.json()
  return data
}
