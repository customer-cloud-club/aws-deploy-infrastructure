/**
 * Stripe Client Initialization
 *
 * Provides a singleton Stripe client instance configured with API key from Secrets Manager.
 * Uses lazy initialization pattern to allow async secret retrieval.
 *
 * @module billing/stripe
 */

import Stripe from 'stripe';
import { getStripeApiKey } from '../../shared/utils/secrets.js';

/**
 * Cached Stripe client instance
 */
let stripeClient: Stripe | null = null;

/**
 * Get or create Stripe client instance
 * Uses lazy initialization to fetch API key from Secrets Manager on first use
 *
 * @returns Promise<Stripe> - Initialized Stripe client
 */
export async function getStripeClient(): Promise<Stripe> {
  if (stripeClient) {
    return stripeClient;
  }

  const apiKey = await getStripeApiKey();

  stripeClient = new Stripe(apiKey, {
    apiVersion: '2023-10-16',
    typescript: true,
    appInfo: {
      name: 'CCAGI Billing Service',
      version: '1.0.0',
    },
  });

  return stripeClient;
}

/**
 * Legacy export for backward compatibility
 * WARNING: This will throw if used before initialization
 * Prefer using getStripeClient() instead
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!stripeClient) {
      throw new Error('Stripe client not initialized. Use getStripeClient() first.');
    }
    return (stripeClient as any)[prop];
  },
});

/**
 * Stripe Webhook Secret
 * Used for webhook signature verification to ensure webhook events are authentic
 */
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

if (!STRIPE_WEBHOOK_SECRET) {
  console.warn('STRIPE_WEBHOOK_SECRET not configured - webhook signature verification will fail');
}
