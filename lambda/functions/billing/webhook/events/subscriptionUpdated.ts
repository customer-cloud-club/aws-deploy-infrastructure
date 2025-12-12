/**
 * Subscription Updated Event Handler
 *
 * Handles the customer.subscription.updated webhook event from Stripe.
 * Updates subscription details including status, billing period, and plan changes.
 *
 * Workflow:
 * 1. Extract updated subscription info from Stripe event
 * 2. Update subscription record in database
 * 3. Handle plan changes (upgrades/downgrades)
 * 4. Update cancellation status if changed
 *
 * @module billing/webhook/events/subscriptionUpdated
 */

import { PoolClient } from 'pg';
import type Stripe from 'stripe';
import type { SubscriptionStatus } from '../../types';

/**
 * Handle customer.subscription.updated webhook event
 *
 * This event is triggered when:
 * - Subscription status changes (active, past_due, canceled, etc.)
 * - Billing period renews
 * - Plan is changed (upgrade/downgrade)
 * - Subscription is scheduled for cancellation
 * - Trial period starts or ends
 *
 * @param client - PostgreSQL client (in active transaction)
 * @param subscription - Stripe Subscription object
 *
 * @throws {Error} If database operations fail
 */
export async function handleSubscriptionUpdated(
  client: PoolClient,
  subscription: Stripe.Subscription
): Promise<void> {
  console.log('[SubscriptionUpdated] Processing customer.subscription.updated event', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  try {
    const customerId = subscription.customer as string;

    // Get user_id from customer record
    const userResult = await client.query(
      `SELECT user_id FROM customers WHERE stripe_customer_id = $1`,
      [customerId]
    );

    if (!userResult.rows.length) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    const userId = userResult.rows[0].user_id;

    // Update subscription record
    await updateSubscription(client, userId, subscription);

    console.log('[SubscriptionUpdated] Successfully updated subscription', {
      userId,
      subscriptionId: subscription.id,
      status: subscription.status,
    });
  } catch (error) {
    console.error('[SubscriptionUpdated] Error processing subscription updated event:', error);
    throw new Error(`Subscription updated handler failed: ${(error as Error).message}`);
  }
}

/**
 * Update subscription record in database
 */
async function updateSubscription(
  client: PoolClient,
  userId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const status = subscription.status as SubscriptionStatus;
  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000)
    : null;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;

  // Extract product_id from subscription items
  // Assuming single-item subscriptions for simplicity
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price.id;
  const productId = firstItem?.price.product as string;

  // Check if subscription exists
  const existing = await client.query(
    `SELECT id FROM subscriptions WHERE stripe_subscription_id = $1`,
    [subscription.id]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    // Update existing subscription
    await client.query(
      `
      UPDATE subscriptions
      SET
        product_id = COALESCE($1, product_id),
        status = $2,
        current_period_start = $3,
        current_period_end = $4,
        cancel_at_period_end = $5,
        updated_at = NOW()
      WHERE stripe_subscription_id = $6
      `,
      [
        productId,
        status,
        periodStart,
        periodEnd,
        cancelAtPeriodEnd,
        subscription.id,
      ]
    );

    console.log('[SubscriptionUpdated] Subscription record updated', {
      subscriptionId: subscription.id,
      status,
      priceId,
    });
  } else {
    // Create new subscription (in case checkout.session.completed was missed)
    await client.query(
      `
      INSERT INTO subscriptions (
        user_id,
        product_id,
        stripe_subscription_id,
        stripe_customer_id,
        status,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      `,
      [
        userId,
        productId || 'default',
        subscription.id,
        subscription.customer as string,
        status,
        periodStart,
        periodEnd,
        cancelAtPeriodEnd,
      ]
    );

    console.log('[SubscriptionUpdated] Subscription record created', {
      subscriptionId: subscription.id,
      userId,
      status,
    });
  }

  // Log plan change if applicable
  if (firstItem && priceId) {
    logPlanChange(subscription.id, priceId, status);
  }
}

/**
 * Log plan changes for analytics and debugging
 */
function logPlanChange(
  subscriptionId: string,
  newPriceId: string,
  status: SubscriptionStatus
): void {
  console.log('[SubscriptionUpdated] Plan change detected', {
    subscriptionId,
    newPriceId,
    status,
    timestamp: new Date().toISOString(),
  });

  // TODO: Store plan change history in separate table for analytics
  // This could include:
  // - Previous plan/price
  // - New plan/price
  // - Change type (upgrade/downgrade/same)
  // - Effective date
  // - Prorated amount
}
