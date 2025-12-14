/**
 * Subscription Management Handler
 *
 * Provides subscription management operations:
 * - GET  /subscriptions           - List user's subscriptions
 * - GET  /subscriptions/:id       - Get subscription details
 * - POST /subscriptions/cancel    - Cancel subscription (at period end)
 * - POST /subscriptions/resume    - Resume canceled subscription
 * - POST /subscriptions/update    - Update/change subscription plan
 * - GET  /subscriptions/portal    - Get Stripe Customer Portal URL
 *
 * @module billing/subscription/handler
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { initializeDatabase, query } from '../../../shared/db/index.js';
import { getStripeClient } from '../stripe.js';
import type { SubscriptionResponse, SubscriptionStatus } from '../types.js';

/**
 * CORS headers
 */
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Main handler - routes to appropriate function based on path and method
 */
export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // Initialize database
  await initializeDatabase();

  const method = event.httpMethod;
  const path = event.path || '';
  const pathParts = path.split('/').filter(Boolean);

  // Extract action from path: /subscriptions/{action}
  const action = pathParts[1] || '';

  console.log('[SubscriptionHandler] Request:', { method, path, action });

  try {
    // Route based on method and action
    if (method === 'GET') {
      if (action === 'portal') {
        return await getCustomerPortal(event);
      }
      if (action && action !== 'subscriptions') {
        // GET /subscriptions/{id}
        return await getSubscriptionById(event, action);
      }
      // GET /subscriptions
      return await listSubscriptions(event);
    }

    if (method === 'POST') {
      switch (action) {
        case 'cancel':
          return await cancelSubscription(event);
        case 'resume':
          return await resumeSubscription(event);
        case 'update':
          return await updatePlan(event);
        default:
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Not Found', message: `Unknown action: ${action}` }),
          };
      }
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  } catch (error) {
    console.error('[SubscriptionHandler] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Extract user ID from JWT
 */
function getUserId(event: Parameters<APIGatewayProxyHandler>[0]): string | null {
  return event.requestContext?.authorizer?.claims?.sub || null;
}

/**
 * List User Subscriptions
 * GET /subscriptions
 */
async function listSubscriptions(event: Parameters<APIGatewayProxyHandler>[0]): Promise<APIGatewayProxyResult> {
  const userId = getUserId(event);
  console.log('[SubscriptionHandler] listSubscriptions userId:', userId);
  console.log('[SubscriptionHandler] authorizer claims:', JSON.stringify(event.requestContext?.authorizer?.claims));

  if (!userId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const result = await query<{
    id: string;
    stripe_subscription_id: string;
    stripe_customer_id: string;
    plan_id: string;
    status: string;
    current_period_start: Date;
    current_period_end: Date;
    cancel_at_period_end: boolean;
    created_at: Date;
  }>(
    `
    SELECT
      s.id,
      s.stripe_subscription_id,
      s.stripe_customer_id,
      s.plan_id,
      s.status,
      s.current_period_start,
      s.current_period_end,
      s.cancel_at_period_end,
      s.created_at,
      p.name as plan_name,
      pr.name as product_name
    FROM subscriptions s
    LEFT JOIN plans p ON s.plan_id = p.id
    LEFT JOIN products pr ON p.product_id = pr.id
    WHERE s.user_id = $1 AND s.deleted_at IS NULL
    ORDER BY s.created_at DESC
    `,
    [userId]
  );

  console.log('[SubscriptionHandler] Query result rows:', result.rows.length);

  const subscriptions = result.rows.map(row => ({
    id: row.id,
    subscription_id: row.stripe_subscription_id,
    plan_id: row.plan_id,
    status: row.status,
    current_period_start: row.current_period_start?.toISOString() || '',
    current_period_end: row.current_period_end?.toISOString() || '',
    cancel_at_period_end: row.cancel_at_period_end,
    created_at: row.created_at?.toISOString() || '',
  }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ subscriptions, total: subscriptions.length }),
  };
}

/**
 * Get Subscription by ID
 * GET /subscriptions/{id}
 */
async function getSubscriptionById(
  event: Parameters<APIGatewayProxyHandler>[0],
  subscriptionId: string
): Promise<APIGatewayProxyResult> {
  const userId = getUserId(event);
  if (!userId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const result = await query<{
    id: string;
    stripe_subscription_id: string;
    stripe_customer_id: string;
    plan_id: string;
    status: string;
    current_period_start: Date;
    current_period_end: Date;
    cancel_at_period_end: boolean;
    canceled_at: Date | null;
    created_at: Date;
  }>(
    `
    SELECT *
    FROM subscriptions
    WHERE (id = $1 OR stripe_subscription_id = $1)
      AND user_id = $2
      AND deleted_at IS NULL
    `,
    [subscriptionId, userId]
  );

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Subscription not found' }),
    };
  }

  const row = result.rows[0]!;
  const response: SubscriptionResponse = {
    subscription_id: row.stripe_subscription_id,
    status: row.status as SubscriptionStatus,
    current_period_start: row.current_period_start?.toISOString() || '',
    current_period_end: row.current_period_end?.toISOString() || '',
    cancel_at_period_end: row.cancel_at_period_end,
  };

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(response),
  };
}

/**
 * Cancel Subscription
 * POST /subscriptions/cancel
 */
async function cancelSubscription(event: Parameters<APIGatewayProxyHandler>[0]): Promise<APIGatewayProxyResult> {
  const userId = getUserId(event);
  if (!userId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const result = await query<{ stripe_subscription_id: string }>(
    `
    SELECT stripe_subscription_id
    FROM subscriptions
    WHERE user_id = $1
      AND status IN ('active', 'trialing')
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [userId]
  );

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'No active subscription found' }),
    };
  }

  const subscriptionId = result.rows[0]!.stripe_subscription_id;

  // Cancel subscription at period end via Stripe
  const stripe = await getStripeClient();
  const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });

  // Update local database
  await query(
    `UPDATE subscriptions SET cancel_at_period_end = true, updated_at = NOW() WHERE stripe_subscription_id = $1`,
    [subscriptionId]
  );

  console.log('[SubscriptionHandler] Subscription canceled', { userId, subscriptionId });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      message: 'Subscription will be canceled at period end',
      cancel_at: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
    }),
  };
}

/**
 * Resume Subscription
 * POST /subscriptions/resume
 */
async function resumeSubscription(event: Parameters<APIGatewayProxyHandler>[0]): Promise<APIGatewayProxyResult> {
  const userId = getUserId(event);
  if (!userId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const result = await query<{ stripe_subscription_id: string }>(
    `
    SELECT stripe_subscription_id
    FROM subscriptions
    WHERE user_id = $1
      AND cancel_at_period_end = true
      AND status IN ('active', 'trialing')
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [userId]
  );

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'No subscription scheduled for cancellation' }),
    };
  }

  const subscriptionId = result.rows[0]!.stripe_subscription_id;

  // Resume subscription via Stripe
  const stripe = await getStripeClient();
  const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });

  // Update local database
  await query(
    `UPDATE subscriptions SET cancel_at_period_end = false, updated_at = NOW() WHERE stripe_subscription_id = $1`,
    [subscriptionId]
  );

  console.log('[SubscriptionHandler] Subscription resumed', { userId, subscriptionId });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      message: 'Subscription resumed successfully',
      next_billing_date: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
    }),
  };
}

/**
 * Update Subscription Plan (Upgrade/Downgrade)
 * POST /subscriptions/update
 *
 * Request body:
 * - new_plan_id: UUID of the new plan
 * - proration_behavior: 'create_prorations' (default for upgrade) | 'none' (for downgrade)
 */
async function updatePlan(event: Parameters<APIGatewayProxyHandler>[0]): Promise<APIGatewayProxyResult> {
  const userId = getUserId(event);
  if (!userId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing request body' }),
    };
  }

  const { new_plan_id, proration_behavior = 'create_prorations' } = JSON.parse(event.body);
  if (!new_plan_id) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing new_plan_id' }),
    };
  }

  // Get new plan's Stripe price ID
  const planResult = await query<{ stripe_price_id: string; price_amount: number; name: string; product_id: string }>(
    `SELECT stripe_price_id, price_amount, name, product_id FROM plans WHERE id = $1 AND is_active = true AND deleted_at IS NULL`,
    [new_plan_id]
  );

  if (planResult.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Plan not found' }),
    };
  }

  const newPlan = planResult.rows[0]!;

  // Get current subscription
  const subResult = await query<{ id: string; stripe_subscription_id: string; plan_id: string }>(
    `
    SELECT id, stripe_subscription_id, plan_id
    FROM subscriptions
    WHERE user_id = $1
      AND status IN ('active', 'trialing')
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [userId]
  );

  if (subResult.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'No active subscription found' }),
    };
  }

  const currentSub = subResult.rows[0]!;
  const subscriptionId = currentSub.stripe_subscription_id;

  // Retrieve current subscription from Stripe
  const stripe = await getStripeClient();
  const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  const currentItemId = currentSubscription.items.data[0]?.id;

  if (!currentItemId) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to retrieve subscription items' }),
    };
  }

  // Update subscription with new price
  const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: currentItemId, price: newPlan.stripe_price_id }],
    proration_behavior: proration_behavior as 'create_prorations' | 'none' | 'always_invoice',
  });

  // Update local subscriptions table
  await query(
    `UPDATE subscriptions SET plan_id = $1, updated_at = NOW() WHERE id = $2`,
    [new_plan_id, currentSub.id]
  );

  // Update entitlements table
  await query(
    `UPDATE entitlements SET plan_id = $1, updated_at = NOW() WHERE user_id = $2 AND product_id = $3 AND status = 'active'`,
    [new_plan_id, userId, newPlan.product_id]
  );

  console.log('[SubscriptionHandler] Subscription plan updated', {
    userId,
    subscriptionId,
    old_plan_id: currentSub.plan_id,
    new_plan_id,
    new_plan_name: newPlan.name,
    proration_behavior
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      message: 'Subscription plan updated successfully',
      subscription_id: updatedSubscription.id,
      new_plan: {
        id: new_plan_id,
        name: newPlan.name,
        price_amount: newPlan.price_amount,
      },
      effective_date: new Date().toISOString(),
    }),
  };
}

/**
 * Get Stripe Customer Portal URL
 * GET /subscriptions/portal
 */
async function getCustomerPortal(event: Parameters<APIGatewayProxyHandler>[0]): Promise<APIGatewayProxyResult> {
  const userId = getUserId(event);
  if (!userId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  // Get return URL from query params or use default
  const returnUrl = event.queryStringParameters?.return_url || 'https://example.com/account';

  // Get customer ID from database
  const result = await query<{ stripe_customer_id: string }>(
    `
    SELECT stripe_customer_id
    FROM subscriptions
    WHERE user_id = $1
      AND stripe_customer_id IS NOT NULL
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [userId]
  );

  if (result.rows.length === 0 || !result.rows[0]!.stripe_customer_id) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'No customer found' }),
    };
  }

  const customerId = result.rows[0]!.stripe_customer_id;

  // Create Stripe Customer Portal session
  const stripe = await getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  console.log('[SubscriptionHandler] Customer portal session created', { userId, customerId });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      url: session.url,
    }),
  };
}
