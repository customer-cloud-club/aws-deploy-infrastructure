/**
 * Subscription Deleted Event Handler
 *
 * Handles the customer.subscription.deleted webhook event from Stripe.
 * Marks subscription as canceled and revokes access to product/service.
 *
 * Workflow:
 * 1. Extract subscription info from Stripe event
 * 2. Update subscription status to 'canceled'
 * 3. Record cancellation timestamp
 * 4. Revoke access to product/service (via entitlement service)
 *
 * @module billing/webhook/events/subscriptionDeleted
 */

import { PoolClient } from 'pg';
import type Stripe from 'stripe';

/**
 * Handle customer.subscription.deleted webhook event
 *
 * This event is triggered when:
 * - Subscription is canceled and period ends
 * - Subscription is deleted immediately (rare)
 * - Free trial expires without payment method
 * - Maximum payment retry attempts exceeded
 *
 * @param client - PostgreSQL client (in active transaction)
 * @param subscription - Stripe Subscription object
 *
 * @throws {Error} If database operations fail
 */
export async function handleSubscriptionDeleted(
  client: PoolClient,
  subscription: Stripe.Subscription
): Promise<void> {
  console.log('[SubscriptionDeleted] Processing customer.subscription.deleted event', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    endedAt: subscription.ended_at,
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

    // Update subscription to canceled status
    await cancelSubscription(client, subscription);

    // Revoke access to product/service
    await revokeAccess(client, userId, subscription.id);

    console.log('[SubscriptionDeleted] Successfully processed subscription deletion', {
      userId,
      subscriptionId: subscription.id,
    });
  } catch (error) {
    console.error('[SubscriptionDeleted] Error processing subscription deleted event:', error);
    throw new Error(`Subscription deleted handler failed: ${(error as Error).message}`);
  }
}

/**
 * Update subscription record to canceled status
 */
async function cancelSubscription(
  client: PoolClient,
  subscription: Stripe.Subscription
): Promise<void> {
  const endedAt = subscription.ended_at
    ? new Date(subscription.ended_at * 1000)
    : new Date();

  const result = await client.query(
    `
    UPDATE subscriptions
    SET
      status = 'canceled',
      cancel_at_period_end = false,
      canceled_at = $1,
      updated_at = NOW()
    WHERE stripe_subscription_id = $2
    RETURNING id, user_id, product_id
    `,
    [endedAt, subscription.id]
  );

  if (!result.rowCount || result.rowCount === 0) {
    console.warn('[SubscriptionDeleted] Subscription not found in database', {
      subscriptionId: subscription.id,
    });
    return;
  }

  const subscriptionRecord = result.rows[0];

  console.log('[SubscriptionDeleted] Subscription marked as canceled', {
    subscriptionId: subscription.id,
    userId: subscriptionRecord.user_id,
    productId: subscriptionRecord.product_id,
    canceledAt: endedAt.toISOString(),
  });
}

/**
 * Revoke user access to product/service
 *
 * This integrates with the entitlement service to remove access grants.
 * In a full implementation, this would call the entitlement service API
 * or publish an event to a message queue.
 */
async function revokeAccess(
  client: PoolClient,
  userId: string,
  subscriptionId: string
): Promise<void> {
  try {
    // Get subscription details for access revocation
    const result = await client.query(
      `
      SELECT id, product_id
      FROM subscriptions
      WHERE stripe_subscription_id = $1
      `,
      [subscriptionId]
    );

    if (!result.rows.length) {
      console.warn('[SubscriptionDeleted] Cannot revoke access - subscription not found');
      return;
    }

    const { id: internalSubId, product_id: productId } = result.rows[0];

    // TODO: Integrate with entitlement service
    // Option 1: Direct API call to entitlement service
    // await entitlementService.revokeAccess(userId, productId);

    // Option 2: Publish event to message queue/SNS
    // await publishEvent('subscription.access.revoked', { userId, productId, subscriptionId });

    // For now, log the access revocation
    console.log('[SubscriptionDeleted] Access revocation required', {
      userId,
      productId,
      subscriptionId: internalSubId,
      stripeSubscriptionId: subscriptionId,
      action: 'REVOKE_ACCESS',
    });

    // Optional: Create access revocation record
    await client.query(
      `
      INSERT INTO access_revocations (
        user_id,
        subscription_id,
        product_id,
        revoked_at,
        created_at
      )
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (subscription_id) DO NOTHING
      `,
      [userId, internalSubId, productId]
    );

  } catch (error) {
    console.error('[SubscriptionDeleted] Error revoking access:', error);
    // Don't throw - we still want to mark subscription as canceled
    // Log error for manual intervention if needed
    console.error('[SubscriptionDeleted] Manual access revocation may be required', {
      userId,
      subscriptionId,
      error: (error as Error).message,
    });
  }
}
