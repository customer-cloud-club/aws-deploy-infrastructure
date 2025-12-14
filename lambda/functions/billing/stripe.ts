/**
 * Stripe Client Initialization
 *
 * Provides a singleton Stripe client instance configured with API key from Secrets Manager.
 * Uses lazy initialization pattern to allow async secret retrieval.
 *
 * @module billing/stripe
 */

import Stripe from 'stripe';
import { getStripeApiKey, getStripeWebhookSecret } from '../../shared/utils/secrets.js';

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
 * Cached webhook secret
 */
let cachedWebhookSecret: string | null = null;

/**
 * Get Stripe Webhook Secret from Secrets Manager
 * Uses caching to avoid repeated API calls
 *
 * @returns Promise<string> - Webhook secret
 */
export async function getWebhookSecret(): Promise<string> {
  if (cachedWebhookSecret) {
    return cachedWebhookSecret;
  }

  cachedWebhookSecret = await getStripeWebhookSecret();
  return cachedWebhookSecret;
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use getWebhookSecret() instead
 */
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
