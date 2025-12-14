/**
 * Checkout Session Completed Event Handler
 *
 * Handles the checkout.session.completed webhook event from Stripe.
 * Creates subscription and customer records when a customer completes checkout.
 *
 * Workflow:
 * 1. Extract customer and subscription info from Stripe event
 * 2. Create or update customer record in database
 * 3. Create subscription record
 * 4. Update user's subscription status
 *
 * @module billing/webhook/events/checkoutCompleted
 */

import { PoolClient } from 'pg';
import type Stripe from 'stripe';

/**
 * Handle checkout.session.completed webhook event
 *
 * This event is triggered when:
 * - Customer completes payment for a subscription
 * - Free trial starts (if configured)
 * - Setup mode checkout completes (payment method saved)
 *
 * @param client - PostgreSQL client (in active transaction)
 * @param session - Stripe Checkout Session object
 *
 * @throws {Error} If database operations fail
 */
export async function handleCheckoutCompleted(
  client: PoolClient,
  session: Stripe.Checkout.Session
): Promise<void> {
  console.log('[CheckoutCompleted] Processing checkout.session.completed event', {
    sessionId: session.id,
    customerId: session.customer,
    subscriptionId: session.subscription,
  });

  try {
    // Extract user_id from session metadata or client_reference_id
    const userId = session.metadata?.user_id || session.client_reference_id;
    if (!userId) {
      throw new Error('Missing user_id in checkout session metadata');
    }

    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;
    const planId = session.metadata?.plan_id;

    if (!customerId) {
      throw new Error('Missing customer_id in checkout session');
    }

    // 1. Create or update customer record
    await upsertCustomer(client, userId, customerId, session);

    // 2. If subscription exists, create subscription record
    if (subscriptionId) {
      await createSubscription(client, userId, customerId, subscriptionId, planId);
    }

    console.log('[CheckoutCompleted] Successfully processed checkout completion', {
      userId,
      customerId,
      subscriptionId,
    });
  } catch (error) {
    console.error('[CheckoutCompleted] Error processing checkout completed event:', error);
    throw new Error(`Checkout completed handler failed: ${(error as Error).message}`);
  }
}

/**
 * Create or update customer record
 */
async function upsertCustomer(
  client: PoolClient,
  userId: string,
  customerId: string,
  session: Stripe.Checkout.Session
): Promise<void> {
  const email = session.customer_details?.email || session.customer_email;

  await client.query(
    `
    INSERT INTO customers (user_id, stripe_customer_id, email, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      email = EXCLUDED.email,
      updated_at = NOW()
    `,
    [userId, customerId, email]
  );

  console.log('[CheckoutCompleted] Customer record upserted', { userId, customerId, email });
}

/**
 * Create subscription record
 *
 * Note: Initial subscription details (period, status) will be populated
 * by the customer.subscription.created or customer.subscription.updated webhook
 */
async function createSubscription(
  client: PoolClient,
  userId: string,
  customerId: string,
  subscriptionId: string,
  planId: string | undefined
): Promise<void> {
  // Check if subscription already exists
  const existing = await client.query(
    `SELECT id FROM subscriptions WHERE stripe_subscription_id = $1`,
    [subscriptionId]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    console.log('[CheckoutCompleted] Subscription already exists, skipping creation', {
      subscriptionId,
    });
    return;
  }

  // Get or create a default tenant for this user
  let tenantId: string;
  const tenantResult = await client.query(
    `SELECT id FROM tenants WHERE subdomain = $1`,
    [userId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 63).toLowerCase() || 'default']
  );

  if (tenantResult.rows.length > 0) {
    tenantId = tenantResult.rows[0].id;
  } else {
    // Create a default tenant for this user
    const newTenant = await client.query(
      `INSERT INTO tenants (name, subdomain, status)
       VALUES ($1, $2, 'active')
       RETURNING id`,
      [`User ${userId}`, userId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 63).toLowerCase() || `user-${Date.now()}`]
    );
    tenantId = newTenant.rows[0].id;
  }

  // If no plan_id provided, try to find a default plan
  let finalPlanId = planId;
  if (!finalPlanId) {
    const defaultPlan = await client.query(
      `SELECT id FROM plans WHERE is_active = true LIMIT 1`
    );
    if (defaultPlan.rows.length > 0) {
      finalPlanId = defaultPlan.rows[0].id;
    } else {
      throw new Error('No active plan found and no plan_id provided');
    }
  }

  // Create initial subscription record
  // Status will be updated by subscription.updated webhook with full details
  await client.query(
    `
    INSERT INTO subscriptions (
      tenant_id,
      user_id,
      plan_id,
      stripe_subscription_id,
      stripe_customer_id,
      status,
      cancel_at_period_end,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, 'incomplete', false, NOW(), NOW())
    `,
    [tenantId, userId, finalPlanId, subscriptionId, customerId]
  );

  console.log('[CheckoutCompleted] Subscription record created', {
    userId,
    subscriptionId,
    tenantId,
    planId: finalPlanId,
  });
}
