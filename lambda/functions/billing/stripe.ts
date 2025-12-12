/**
 * Stripe Client Initialization
 *
 * Provides a singleton Stripe client instance configured with API key from environment variables.
 * Used across all billing-related Lambda functions for consistent Stripe API access.
 *
 * @module billing/stripe
 */

import Stripe from 'stripe';

/**
 * Validate Stripe API key existence
 * @throws {Error} If STRIPE_SECRET_KEY is not configured
 */
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

/**
 * Singleton Stripe client instance
 *
 * Configuration:
 * - API Version: Latest (auto-updated by Stripe SDK)
 * - TypeScript: Enabled for type-safe operations
 * - App Info: Identifies requests from this application
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
  appInfo: {
    name: 'CCAGI Billing Service',
    version: '1.0.0',
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
