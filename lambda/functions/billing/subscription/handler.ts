/**
 * Subscription Management Handler
 *
 * Provides subscription management operations:
 * - Get current subscription details
 * - Cancel subscription (at period end)
 * - Update/change subscription plan
 * - Resume canceled subscription
 *
 * @module billing/subscription/handler
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { stripe } from '../stripe';
import type { SubscriptionResponse, SubscriptionStatus } from '../types';

/**
 * PostgreSQL connection pool
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
 * Get User Subscription
 *
 * API Endpoint: GET /billing/subscription
 *
 * Returns current subscription details for authenticated user
 */
export const getSubscription: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  console.log('[SubscriptionHandler] Getting user subscription');

  try {
    // Extract user ID from JWT
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Query subscription from database
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT
          stripe_subscription_id,
          status,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          product_id
        FROM subscriptions
        WHERE user_id = $1
        AND status IN ('active', 'trialing', 'past_due')
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [userId]
      );

      if (!result.rows.length) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'No active subscription found' }),
        };
      }

      const subscription = result.rows[0];
      const response: SubscriptionResponse = {
        subscription_id: subscription.stripe_subscription_id,
        status: subscription.status as SubscriptionStatus,
        current_period_start: subscription.current_period_start?.toISOString() || '',
        current_period_end: subscription.current_period_end?.toISOString() || '',
        cancel_at_period_end: subscription.cancel_at_period_end,
      };

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[SubscriptionHandler] Error getting subscription:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Cancel Subscription
 *
 * API Endpoint: POST /billing/subscription/cancel
 *
 * Cancels subscription at the end of current billing period
 */
export const cancelSubscription: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  console.log('[SubscriptionHandler] Canceling subscription');

  try {
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Get active subscription
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT stripe_subscription_id, status
        FROM subscriptions
        WHERE user_id = $1
        AND status IN ('active', 'trialing')
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [userId]
      );

      if (!result.rows.length) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'No active subscription found' }),
        };
      }

      const subscriptionId = result.rows[0].stripe_subscription_id;

      // Cancel subscription at period end via Stripe
      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });

      console.log('[SubscriptionHandler] Subscription canceled successfully', {
        userId,
        subscriptionId,
        cancelAt: updatedSubscription.current_period_end,
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Subscription will be canceled at period end',
          cancel_at: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[SubscriptionHandler] Error canceling subscription:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Resume Subscription
 *
 * API Endpoint: POST /billing/subscription/resume
 *
 * Resumes a subscription that was scheduled for cancellation
 */
export const resumeSubscription: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  console.log('[SubscriptionHandler] Resuming subscription');

  try {
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Get subscription scheduled for cancellation
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT stripe_subscription_id
        FROM subscriptions
        WHERE user_id = $1
        AND cancel_at_period_end = true
        AND status IN ('active', 'trialing')
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [userId]
      );

      if (!result.rows.length) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'No subscription scheduled for cancellation' }),
        };
      }

      const subscriptionId = result.rows[0].stripe_subscription_id;

      // Resume subscription via Stripe
      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });

      console.log('[SubscriptionHandler] Subscription resumed successfully', {
        userId,
        subscriptionId,
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Subscription resumed successfully',
          next_billing_date: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[SubscriptionHandler] Error resuming subscription:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Update Subscription Plan
 *
 * API Endpoint: POST /billing/subscription/update-plan
 *
 * Request Body:
 * ```json
 * {
 *   "new_plan_id": "price_xxx"
 * }
 * ```
 *
 * Changes subscription to a new plan (upgrade or downgrade)
 */
export const updatePlan: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  console.log('[SubscriptionHandler] Updating subscription plan');

  try {
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const { new_plan_id } = JSON.parse(event.body);
    if (!new_plan_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing new_plan_id' }),
      };
    }

    // Get active subscription
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT stripe_subscription_id, status
        FROM subscriptions
        WHERE user_id = $1
        AND status IN ('active', 'trialing')
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [userId]
      );

      if (!result.rows.length) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'No active subscription found' }),
        };
      }

      const subscriptionId = result.rows[0].stripe_subscription_id;

      // Retrieve current subscription from Stripe
      const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      const currentItemId = currentSubscription.items.data[0].id;

      // Update subscription with new price
      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: currentItemId,
            price: new_plan_id,
          },
        ],
        proration_behavior: 'create_prorations', // Prorate the difference
      });

      console.log('[SubscriptionHandler] Subscription plan updated successfully', {
        userId,
        subscriptionId,
        newPlanId: new_plan_id,
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Subscription plan updated successfully',
          subscription_id: updatedSubscription.id,
          effective_date: new Date().toISOString(),
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[SubscriptionHandler] Error updating subscription plan:', error);

    if ((error as any).type === 'StripeInvalidRequestError') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid plan',
          details: (error as Error).message,
        }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
  console.log('[SubscriptionHandler] SIGTERM received, closing database pool');
  await pool.end();
});
