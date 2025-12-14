/**
 * Invoice Paid Event Handler
 *
 * Handles the invoice.paid webhook event from Stripe.
 * Records successful payment and updates subscription billing period.
 *
 * Workflow:
 * 1. Extract payment and subscription info from invoice
 * 2. Create payment record in database
 * 3. Update subscription billing period (if applicable)
 * 4. Grant/extend access to product/service
 *
 * @module billing/webhook/events/invoicePaid
 */

import { PoolClient } from 'pg';
import type Stripe from 'stripe';

/**
 * Handle invoice.paid webhook event
 *
 * This event is triggered when:
 * - Customer's payment succeeds for a subscription renewal
 * - Initial subscription payment succeeds
 * - One-time invoice is paid
 *
 * @param client - PostgreSQL client (in active transaction)
 * @param invoice - Stripe Invoice object
 *
 * @throws {Error} If database operations fail
 */
export async function handleInvoicePaid(
  client: PoolClient,
  invoice: Stripe.Invoice
): Promise<void> {
  console.log('[InvoicePaid] Processing invoice.paid event', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    subscriptionId: invoice.subscription,
    amountPaid: invoice.amount_paid,
  });

  try {
    const customerId = invoice.customer as string;
    const subscriptionId = invoice.subscription as string | null;
    const paymentIntentId = invoice.payment_intent as string | null;

    // Try to get user_id from customer record first
    let userId: string | null = null;
    const userResult = await client.query(
      `SELECT user_id FROM customers WHERE stripe_customer_id = $1`,
      [customerId]
    );

    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].user_id;
    } else if (subscriptionId) {
      // Fallback: try to get user_id from subscription record
      const subResult = await client.query(
        `SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1`,
        [subscriptionId]
      );
      if (subResult.rows.length > 0) {
        userId = subResult.rows[0].user_id;
        console.log('[InvoicePaid] Got user_id from subscription record', { userId, subscriptionId });
      }
    }

    // 1. Update subscription billing period first (this is more important)
    if (subscriptionId) {
      await updateSubscriptionPeriod(client, subscriptionId, invoice);
    }

    // 2. Create payment record if we have user_id
    if (userId) {
      await createPaymentRecord(client, userId, invoice, subscriptionId, paymentIntentId);
    } else {
      console.warn('[InvoicePaid] Could not find user_id for payment record, skipping', {
        customerId,
        subscriptionId,
        invoiceId: invoice.id,
      });
    }

    console.log('[InvoicePaid] Successfully processed invoice payment', {
      userId: userId || 'unknown',
      invoiceId: invoice.id,
      subscriptionId,
    });
  } catch (error) {
    console.error('[InvoicePaid] Error processing invoice paid event:', error);
    throw new Error(`Invoice paid handler failed: ${(error as Error).message}`);
  }
}

/**
 * Create payment record in database
 */
async function createPaymentRecord(
  client: PoolClient,
  userId: string,
  invoice: Stripe.Invoice,
  subscriptionId: string | null,
  paymentIntentId: string | null
): Promise<void> {
  // Get subscription internal ID if exists
  let internalSubscriptionId: string | null = null;
  if (subscriptionId) {
    const subResult = await client.query(
      `SELECT id FROM subscriptions WHERE stripe_subscription_id = $1`,
      [subscriptionId]
    );
    if (subResult.rows.length) {
      internalSubscriptionId = subResult.rows[0].id;
    }
  }

  // Insert payment record
  await client.query(
    `
    INSERT INTO payments (
      user_id,
      subscription_id,
      stripe_invoice_id,
      stripe_payment_intent_id,
      amount,
      currency,
      status,
      paid_at,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (stripe_invoice_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      paid_at = EXCLUDED.paid_at
    `,
    [
      userId,
      internalSubscriptionId,
      invoice.id,
      paymentIntentId,
      invoice.amount_paid,
      invoice.currency,
      'succeeded',
      invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : new Date(),
    ]
  );

  console.log('[InvoicePaid] Payment record created', {
    userId,
    invoiceId: invoice.id,
    amount: invoice.amount_paid,
    currency: invoice.currency,
  });
}

/**
 * Update subscription billing period from invoice
 */
async function updateSubscriptionPeriod(
  client: PoolClient,
  subscriptionId: string,
  invoice: Stripe.Invoice
): Promise<void> {
  // Extract billing period from invoice
  const periodStart = invoice.period_start
    ? new Date(invoice.period_start * 1000)
    : null;
  const periodEnd = invoice.period_end
    ? new Date(invoice.period_end * 1000)
    : null;

  if (!periodStart || !periodEnd) {
    console.warn('[InvoicePaid] Missing billing period in invoice', {
      invoiceId: invoice.id,
    });
    return;
  }

  // Update subscription record with new billing period
  const result = await client.query(
    `
    UPDATE subscriptions
    SET
      current_period_start = $1,
      current_period_end = $2,
      status = 'active',
      updated_at = NOW()
    WHERE stripe_subscription_id = $3
    RETURNING id
    `,
    [periodStart, periodEnd, subscriptionId]
  );

  if (result.rowCount === 0) {
    console.warn('[InvoicePaid] Subscription not found for period update (will be created by subscription.updated event)', {
      subscriptionId,
      invoiceId: invoice.id,
    });
    return;
  }

  console.log('[InvoicePaid] Subscription billing period updated', {
    subscriptionId,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  });
}
