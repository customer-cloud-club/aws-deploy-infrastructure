/**
 * Test Utilities for Billing Tests
 *
 * Provides mock data, helpers, and fixtures for billing integration tests.
 *
 * @module tests/billing/test-utils
 */

import Stripe from 'stripe';
import crypto from 'crypto';

/**
 * Test Stripe configuration
 */
export const TEST_CONFIG = {
  STRIPE_TEST_SECRET_KEY: process.env.STRIPE_TEST_SECRET_KEY || 'sk_test_xxx',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_xxx',
  API_ENDPOINT: process.env.API_ENDPOINT || 'https://wqqr3nryw0.execute-api.ap-northeast-1.amazonaws.com/dev',
};

/**
 * Mock user data
 */
export const MOCK_USER = {
  id: 'test-user-001',
  email: 'test@example.com',
  name: 'Test User',
};

/**
 * Mock product and plan data
 */
export const MOCK_PRODUCTS = {
  basic: {
    product_id: 'prod_test_basic',
    price_id: 'price_test_basic_monthly',
    name: 'Basic Plan',
    amount: 1000, // 1000 JPY
    currency: 'jpy',
  },
  pro: {
    product_id: 'prod_test_pro',
    price_id: 'price_test_pro_monthly',
    name: 'Pro Plan',
    amount: 3000, // 3000 JPY
    currency: 'jpy',
  },
};

/**
 * Generate mock Stripe event ID
 */
export function generateEventId(): string {
  return `evt_test_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Generate mock Stripe customer ID
 */
export function generateCustomerId(): string {
  return `cus_test_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generate mock Stripe subscription ID
 */
export function generateSubscriptionId(): string {
  return `sub_test_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generate mock Stripe checkout session ID
 */
export function generateCheckoutSessionId(): string {
  return `cs_test_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Generate mock Stripe invoice ID
 */
export function generateInvoiceId(): string {
  return `in_test_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Create mock Stripe webhook signature
 *
 * @param payload - Raw webhook payload
 * @param secret - Webhook secret
 * @param timestamp - Unix timestamp (optional, defaults to now)
 * @returns Stripe-Signature header value
 */
export function createWebhookSignature(
  payload: string,
  secret: string,
  timestamp?: number
): string {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return `t=${ts},v1=${signature}`;
}

/**
 * Create mock checkout.session.completed event
 */
export function createCheckoutCompletedEvent(options: {
  sessionId?: string;
  customerId?: string;
  subscriptionId?: string;
  userId?: string;
  productId?: string;
  email?: string;
}): Partial<Stripe.Event> {
  const {
    sessionId = generateCheckoutSessionId(),
    customerId = generateCustomerId(),
    subscriptionId = generateSubscriptionId(),
    userId = MOCK_USER.id,
    productId = MOCK_PRODUCTS.basic.product_id,
    email = MOCK_USER.email,
  } = options;

  return {
    id: generateEventId(),
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        customer: customerId,
        subscription: subscriptionId,
        client_reference_id: userId,
        customer_email: email,
        metadata: {
          user_id: userId,
          product_id: productId,
        },
        payment_status: 'paid',
        status: 'complete',
      } as unknown as Stripe.Checkout.Session,
    },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    object: 'event',
  };
}

/**
 * Create mock invoice.paid event
 */
export function createInvoicePaidEvent(options: {
  invoiceId?: string;
  customerId?: string;
  subscriptionId?: string;
  amount?: number;
  currency?: string;
}): Partial<Stripe.Event> {
  const {
    invoiceId = generateInvoiceId(),
    customerId = generateCustomerId(),
    subscriptionId = generateSubscriptionId(),
    amount = 1000,
    currency = 'jpy',
  } = options;

  return {
    id: generateEventId(),
    type: 'invoice.paid',
    data: {
      object: {
        id: invoiceId,
        object: 'invoice',
        customer: customerId,
        subscription: subscriptionId,
        amount_paid: amount,
        currency: currency,
        status: 'paid',
        paid: true,
      } as unknown as Stripe.Invoice,
    },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    object: 'event',
  };
}

/**
 * Create mock customer.subscription.updated event
 */
export function createSubscriptionUpdatedEvent(options: {
  subscriptionId?: string;
  customerId?: string;
  status?: Stripe.Subscription.Status;
  cancelAtPeriodEnd?: boolean;
}): Partial<Stripe.Event> {
  const {
    subscriptionId = generateSubscriptionId(),
    customerId = generateCustomerId(),
    status = 'active',
    cancelAtPeriodEnd = false,
  } = options;

  const now = Math.floor(Date.now() / 1000);

  return {
    id: generateEventId(),
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status: status,
        cancel_at_period_end: cancelAtPeriodEnd,
        current_period_start: now,
        current_period_end: now + 30 * 24 * 60 * 60, // 30 days later
      } as unknown as Stripe.Subscription,
    },
    created: now,
    livemode: false,
    object: 'event',
  };
}

/**
 * Create mock customer.subscription.deleted event
 */
export function createSubscriptionDeletedEvent(options: {
  subscriptionId?: string;
  customerId?: string;
}): Partial<Stripe.Event> {
  const {
    subscriptionId = generateSubscriptionId(),
    customerId = generateCustomerId(),
  } = options;

  return {
    id: generateEventId(),
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status: 'canceled',
        canceled_at: Math.floor(Date.now() / 1000),
      } as unknown as Stripe.Subscription,
    },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    object: 'event',
  };
}

/**
 * Assert response status
 */
export function assertStatus(response: { statusCode: number }, expectedStatus: number): void {
  if (response.statusCode !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${response.statusCode}`);
  }
}

/**
 * Parse JSON response body
 */
export function parseBody<T>(body: string): T {
  return JSON.parse(body) as T;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test result interface
 */
export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

/**
 * Test runner
 */
export async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<TestResult> {
  const start = Date.now();
  try {
    await testFn();
    return {
      name,
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name,
      passed: false,
      error: (error as Error).message,
      duration: Date.now() - start,
    };
  }
}

/**
 * Print test results
 */
export function printResults(results: TestResult[]): void {
  console.log('\n=== Test Results ===\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  for (const result of results) {
    const status = result.passed ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`${status} ${result.name} (${result.duration}ms)`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }

  console.log(`\nTotal: ${results.length}, Passed: ${passed}, Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}
