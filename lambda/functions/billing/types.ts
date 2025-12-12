/**
 * Type Definitions for Billing Service
 *
 * Provides TypeScript type definitions for billing-related operations,
 * including Stripe integration, subscription management, and webhook handling.
 *
 * @module billing/types
 */

import type Stripe from 'stripe';

/**
 * Checkout Session creation request
 */
export interface CheckoutSessionRequest {
  /** Stripe Price ID (e.g., price_xxx) */
  plan_id: string;
  /** Product/Service ID in our system */
  product_id: string;
  /** URL to redirect on successful checkout */
  success_url: string;
  /** URL to redirect on cancelled checkout */
  cancel_url: string;
  /** Optional metadata */
  metadata?: Record<string, string>;
}

/**
 * Checkout Session creation response
 */
export interface CheckoutSessionResponse {
  /** Stripe Checkout Session ID */
  session_id: string;
  /** Stripe Checkout URL for customer redirect */
  url: string;
}

/**
 * Subscription management request
 */
export interface SubscriptionRequest {
  /** User ID */
  user_id: string;
  /** Stripe Subscription ID (for cancel/update) */
  subscription_id?: string;
  /** New Stripe Price ID (for plan change) */
  new_plan_id?: string;
}

/**
 * Subscription management response
 */
export interface SubscriptionResponse {
  /** Stripe Subscription ID */
  subscription_id: string;
  /** Current subscription status */
  status: SubscriptionStatus;
  /** Current period start */
  current_period_start: string;
  /** Current period end */
  current_period_end: string;
  /** Subscription cancel at period end flag */
  cancel_at_period_end: boolean;
}

/**
 * Subscription status enum
 * Maps to Stripe subscription statuses
 */
export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'paused';

/**
 * Processed webhook record
 * Stored in database to ensure idempotency
 */
export interface ProcessedWebhook {
  /** Stripe Event ID (unique) */
  stripe_event_id: string;
  /** Event type (e.g., checkout.session.completed) */
  event_type: string;
  /** Timestamp when processed */
  processed_at: Date;
}

/**
 * Database subscription record
 */
export interface SubscriptionRecord {
  /** Internal subscription ID */
  id: string;
  /** User ID */
  user_id: string;
  /** Product ID */
  product_id: string;
  /** Stripe Subscription ID */
  stripe_subscription_id: string;
  /** Stripe Customer ID */
  stripe_customer_id: string;
  /** Subscription status */
  status: SubscriptionStatus;
  /** Current period start */
  current_period_start: Date;
  /** Current period end */
  current_period_end: Date;
  /** Cancel at period end flag */
  cancel_at_period_end: boolean;
  /** Created timestamp */
  created_at: Date;
  /** Updated timestamp */
  updated_at: Date;
}

/**
 * Database payment record
 */
export interface PaymentRecord {
  /** Internal payment ID */
  id: string;
  /** User ID */
  user_id: string;
  /** Subscription ID (if applicable) */
  subscription_id: string | null;
  /** Stripe Invoice ID */
  stripe_invoice_id: string;
  /** Stripe Payment Intent ID */
  stripe_payment_intent_id: string | null;
  /** Payment amount in cents */
  amount: number;
  /** Currency code (e.g., 'usd', 'jpy') */
  currency: string;
  /** Payment status */
  status: PaymentStatus;
  /** Payment timestamp */
  paid_at: Date | null;
  /** Created timestamp */
  created_at: Date;
}

/**
 * Payment status enum
 */
export type PaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded';

/**
 * Stripe webhook event types handled by the system
 */
export type SupportedWebhookEvent =
  | 'checkout.session.completed'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.subscription.created';

/**
 * Webhook event handler function signature
 */
export type WebhookEventHandler<T = Stripe.Event.Data.Object> = (
  client: any, // PoolClient from pg
  data: T
) => Promise<void>;

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Success response structure
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * API Response type
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;
