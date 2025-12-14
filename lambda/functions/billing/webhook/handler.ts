/**
 * Stripe Webhook Handler
 *
 * Main webhook endpoint for receiving and processing Stripe events.
 * Implements signature verification, idempotency guarantees, and event routing.
 *
 * Key Features:
 * - Stripe signature verification for security
 * - Database-level idempotency using processed_webhooks table
 * - Transaction-based processing (all-or-nothing)
 * - Event routing to specialized handlers
 * - Comprehensive error handling and logging
 *
 * Reference: Section 7.4.1 - Webhook冪等性保証
 *
 * @module billing/webhook/handler
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { getStripeClient, STRIPE_WEBHOOK_SECRET } from '../stripe.js';
import { checkIdempotency } from './idempotency.js';
import { handleCheckoutCompleted } from './events/checkoutCompleted.js';
import { handleInvoicePaid } from './events/invoicePaid.js';
import { handleSubscriptionUpdated } from './events/subscriptionUpdated.js';
import { handleSubscriptionDeleted } from './events/subscriptionDeleted.js';

/**
 * PostgreSQL connection pool
 * Configured via environment variables:
 * - DB_HOST
 * - DB_PORT
 * - DB_NAME
 * - DB_USER
 * - DB_PASSWORD
 */
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Stripe Webhook Handler
 *
 * Processes incoming webhook events from Stripe with the following guarantees:
 * 1. Authenticity: Verifies Stripe signature
 * 2. Idempotency: Processes each event exactly once
 * 3. Atomicity: Uses database transactions
 * 4. Error handling: Returns appropriate HTTP status codes
 *
 * @param event - API Gateway proxy event containing Stripe webhook
 * @returns HTTP response (200 OK, 400 Bad Request, or 500 Internal Error)
 */
export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  console.log('[WebhookHandler] Received webhook event');

  // Extract Stripe signature from headers
  const signature = event.headers['Stripe-Signature'] || event.headers['stripe-signature'];
  if (!signature) {
    console.error('[WebhookHandler] Missing Stripe-Signature header');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing Stripe-Signature header' }),
    };
  }

  // Verify webhook secret is configured
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('[WebhookHandler] STRIPE_WEBHOOK_SECRET not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook secret not configured' }),
    };
  }

  // Construct and verify Stripe event
  let stripeEvent;
  try {
    const stripe = await getStripeClient();
    stripeEvent = stripe.webhooks.constructEvent(
      event.body || '',
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[WebhookHandler] Signature verification failed:', err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid signature' }),
    };
  }

  console.log('[WebhookHandler] Verified webhook event', {
    eventId: stripeEvent.id,
    eventType: stripeEvent.type,
  });

  // Process webhook event with transaction and idempotency
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Idempotency check - skip if already processed
    const isNew = await checkIdempotency(client, stripeEvent.id, stripeEvent.type);
    if (!isNew) {
      await client.query('ROLLBACK');
      console.log('[WebhookHandler] Event already processed (idempotent skip)', {
        eventId: stripeEvent.id,
      });
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Already processed' }),
      };
    }

    // Route event to appropriate handler
    await routeEvent(client, stripeEvent);

    // Commit transaction
    await client.query('COMMIT');

    console.log('[WebhookHandler] Successfully processed webhook event', {
      eventId: stripeEvent.id,
      eventType: stripeEvent.type,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'OK' }),
    };
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');

    console.error('[WebhookHandler] Error processing webhook event:', {
      eventId: stripeEvent.id,
      eventType: stripeEvent.type,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  } finally {
    client.release();
  }
};

/**
 * Route Stripe event to appropriate handler
 *
 * Supported event types:
 * - checkout.session.completed: Customer completes checkout
 * - invoice.paid: Subscription payment succeeds
 * - customer.subscription.updated: Subscription details change
 * - customer.subscription.deleted: Subscription is canceled
 *
 * @param client - PostgreSQL client (in active transaction)
 * @param stripeEvent - Verified Stripe event
 */
async function routeEvent(client: any, stripeEvent: any): Promise<void> {
  switch (stripeEvent.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(client, stripeEvent.data.object);
      break;

    case 'invoice.paid':
      await handleInvoicePaid(client, stripeEvent.data.object);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(client, stripeEvent.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(client, stripeEvent.data.object);
      break;

    default:
      console.log('[WebhookHandler] Unhandled event type (skipping)', {
        eventType: stripeEvent.type,
        eventId: stripeEvent.id,
      });
      // Don't throw error - we still mark as processed to avoid retries
      break;
  }
}

/**
 * Graceful shutdown handler
 * Closes database pool when Lambda container is terminated
 */
process.on('SIGTERM', async () => {
  console.log('[WebhookHandler] SIGTERM received, closing database pool');
  await pool.end();
});
