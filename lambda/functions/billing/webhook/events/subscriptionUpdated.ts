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

  // Extract price_id from subscription items
  // Assuming single-item subscriptions for simplicity
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price.id;

  // Look up plan_id from stripe_price_id
  let planId: string | null = null;
  if (priceId) {
    const planResult = await client.query(
      `SELECT id FROM plans WHERE stripe_price_id = $1`,
      [priceId]
    );
    if (planResult.rows.length > 0) {
      planId = planResult.rows[0].id;
    }
  }

  // Check if subscription exists
  const existing = await client.query(
    `SELECT id, plan_id FROM subscriptions WHERE stripe_subscription_id = $1`,
    [subscription.id]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    // Update existing subscription
    await client.query(
      `
      UPDATE subscriptions
      SET
        plan_id = COALESCE($1, plan_id),
        status = $2,
        current_period_start = $3,
        current_period_end = $4,
        cancel_at_period_end = $5,
        updated_at = NOW()
      WHERE stripe_subscription_id = $6
      `,
      [
        planId,
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
      planId,
    });

    // Create or update entitlement if subscription is active or trialing
    if (status === 'active' || status === 'trialing') {
      const internalSubId = existing.rows[0].id;
      await createOrUpdateEntitlement(client, userId, existing.rows[0].plan_id || planId, internalSubId);
    }
  } else {
    // Create new subscription (in case checkout.session.completed was missed)
    // First, get or create tenant
    let tenantId: string;
    const tenantResult = await client.query(
      `SELECT id FROM tenants WHERE subdomain = $1`,
      [userId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 63).toLowerCase() || 'default']
    );

    if (tenantResult.rows.length > 0) {
      tenantId = tenantResult.rows[0].id;
    } else {
      const newTenant = await client.query(
        `INSERT INTO tenants (name, subdomain, status)
         VALUES ($1, $2, 'active')
         RETURNING id`,
        [`User ${userId}`, userId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 63).toLowerCase() || `user-${Date.now()}`]
      );
      tenantId = newTenant.rows[0].id;
    }

    // If no plan_id, get default plan
    let finalPlanId = planId;
    if (!finalPlanId) {
      const defaultPlan = await client.query(
        `SELECT id FROM plans WHERE is_active = true LIMIT 1`
      );
      if (defaultPlan.rows.length > 0) {
        finalPlanId = defaultPlan.rows[0].id;
      } else {
        throw new Error('No active plan found and no plan_id resolved from Stripe');
      }
    }

    const result = await client.query(
      `
      INSERT INTO subscriptions (
        tenant_id,
        user_id,
        plan_id,
        stripe_subscription_id,
        stripe_customer_id,
        status,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING id
      `,
      [
        tenantId,
        userId,
        finalPlanId,
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
      tenantId,
      planId: finalPlanId,
    });

    // Create entitlement if subscription is active or trialing
    if (status === 'active' || status === 'trialing') {
      await createOrUpdateEntitlement(client, userId, finalPlanId, result.rows[0].id);
    }
  }

  // Log plan change if applicable
  if (firstItem && priceId) {
    logPlanChange(subscription.id, priceId, status);
  }
}

/**
 * Create or update entitlement for the user
 */
async function createOrUpdateEntitlement(
  client: PoolClient,
  userId: string,
  planId: string | null,
  subscriptionId: string
): Promise<void> {
  if (!planId) {
    console.warn('[SubscriptionUpdated] No plan_id for entitlement creation');
    return;
  }

  // Get product_id from plan
  const planResult = await client.query(
    `SELECT product_id FROM plans WHERE id = $1`,
    [planId]
  );

  if (planResult.rows.length === 0) {
    console.warn('[SubscriptionUpdated] Plan not found for entitlement:', planId);
    return;
  }

  const productId = planResult.rows[0].product_id;

  // Upsert entitlement
  await client.query(
    `
    INSERT INTO entitlements (user_id, product_id, plan_id, subscription_id, status)
    VALUES ($1, $2, $3, $4, 'active')
    ON CONFLICT (user_id, product_id) WHERE status = 'active'
    DO UPDATE SET
      plan_id = $3,
      subscription_id = $4,
      status = 'active',
      updated_at = NOW()
    `,
    [userId, productId, planId, subscriptionId]
  );

  console.log('[SubscriptionUpdated] Entitlement created/updated', {
    userId,
    productId,
    planId,
    subscriptionId,
  });
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
