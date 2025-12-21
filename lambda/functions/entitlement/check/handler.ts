/**
 * GET /me/entitlements
 * Check user entitlements for a specific product
 *
 * Requirements:
 * - Redis cache with 60-second TTL
 * - P95 latency < 200ms
 * - Soft limit support
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { initializeDatabase, query } from '../../../shared/db/index.js';
import EntitlementCache from '../cache.js';
import {
  EntitlementResponse,
  EntitlementWithPlan,
  DEFAULT_SOFT_LIMIT_PERCENT,
} from '../types.js';

/**
 * Record verified email (for cross-app auth)
 * This runs asynchronously and doesn't block the main response
 */
async function recordVerifiedEmail(userId: string, email?: string): Promise<void> {
  if (!email) return;

  try {
    // Ensure database is initialized before querying
    await initializeDatabase();
    await query(
      `INSERT INTO verified_emails (email, user_id, first_verified_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (email) DO NOTHING`,
      [email.toLowerCase(), userId]
    );
    console.log('Recorded verified email', { email });
  } catch (error) {
    // Log but don't fail the request - this is non-critical
    console.error('Failed to record verified email', { error, email });
  }
}

/**
 * Record user login for a product (upsert to user_product_logins)
 * This runs asynchronously and doesn't block the main response
 */
async function recordUserProductLogin(userId: string, productId: string, email?: string): Promise<void> {
  try {
    // Ensure database is initialized before querying
    await initializeDatabase();
    await query(
      `INSERT INTO user_product_logins (user_id, product_id, email, first_login_at, last_login_at, login_count)
       VALUES ($1, $2, $3, NOW(), NOW(), 1)
       ON CONFLICT (user_id, product_id) DO UPDATE SET
         last_login_at = NOW(),
         login_count = user_product_logins.login_count + 1,
         email = COALESCE(EXCLUDED.email, user_product_logins.email),
         updated_at = NOW()`,
      [userId, productId, email || null]
    );
    console.log('Recorded user product login', { userId, productId });
  } catch (error) {
    // Log but don't fail the request - this is non-critical
    console.error('Failed to record user product login', { error, userId, productId });
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

/**
 * Lambda handler for GET /me/entitlements
 */
export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: '',
      };
    }

    // Extract user ID and email from Cognito authorizer
    const claims = event.requestContext?.authorizer?.['claims'];
    const userId = claims?.['sub'];
    const email = claims?.['email'];
    if (!userId) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'User ID not found in token',
        }),
      };
    }

    // Get product_id from query parameters (support both productId and product_id for SDK compatibility)
    const productId = event.queryStringParameters?.['productId'] ?? event.queryStringParameters?.['product_id'];
    if (!productId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Missing required parameter: productId or product_id',
        }),
      };
    }

    console.log(`Checking entitlement for user: ${userId}, product: ${productId}`);

    // Record verified email and product login (fire-and-forget, non-blocking)
    recordVerifiedEmail(userId, email).catch(() => {});
    recordUserProductLogin(userId, productId, email).catch(() => {});

    // Check cache first
    const cachedEntitlement = await EntitlementCache.getEntitlement(userId, productId);
    if (cachedEntitlement) {
      const duration = Date.now() - startTime;
      console.log(`Cache hit - Response time: ${duration}ms`);
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'X-Response-Time': `${duration}ms`,
        },
        body: JSON.stringify(cachedEntitlement),
      };
    }

    // Cache miss - query database
    const pool = await initializeDatabase();
    const client = await pool.connect();

    try {
      // Query entitlement with plan and subscription data (JOIN)
      const result = await client.query<EntitlementWithPlan>(
        `
        SELECT
          e.entitlement_id,
          e.user_id,
          e.product_id,
          e.plan_id,
          e.status,
          e.feature_flags,
          e.usage_limit,
          e.usage_count,
          e.soft_limit,
          e.usage_reset_at,
          e.valid_until,
          e.created_at,
          e.updated_at,
          p.name as plan_name,
          p.price_amount,
          p.billing_period,
          p.metadata->>'usage_limit' as plan_limit,
          p.metadata->>'features' as plan_features,
          p.metadata->>'soft_limit_percent' as soft_limit_percent,
          s.cancel_at_period_end,
          s.current_period_end
        FROM entitlements e
        LEFT JOIN plans p ON e.plan_id = p.id
        LEFT JOIN subscriptions s ON e.subscription_id = s.id
        WHERE e.user_id = $1 AND e.product_id = $2 AND e.status = 'active'
        LIMIT 1
        `,
        [userId, productId]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Not Found',
            message: 'No active entitlement found for this product',
          }),
        };
      }

      const row = result.rows[0]!; // Non-null assertion since we checked length above

      // Calculate usage limits
      const usageLimit = row.usage_limit ?? row.plan_limit;
      const usageCount = row.usage_count ?? 0;
      const remaining = Math.max(0, usageLimit - usageCount);

      // Calculate soft limit (allows overages)
      let softLimit = row.soft_limit;
      if (!softLimit || softLimit === 0) {
        // Calculate from plan's soft limit percent (e.g., 10% overage)
        const softLimitPercent = row.soft_limit_percent ?? DEFAULT_SOFT_LIMIT_PERCENT;
        softLimit = Math.floor(usageLimit * (1 + softLimitPercent));
      }

      // Merge feature flags (entitlement overrides plan)
      const features = {
        ...(row.plan_features || {}),
        ...(row.feature_flags || {}),
      };

      // Build response
      const response: EntitlementResponse = {
        product_id: row.product_id,
        plan_id: row.plan_id,
        plan_name: row.plan_name || '',
        price_amount: row.price_amount || 0,
        billing_period: row.billing_period || '',
        status: row.status,
        features,
        usage: {
          limit: usageLimit,
          used: usageCount,
          remaining,
          soft_limit: softLimit,
          reset_at: row.usage_reset_at?.toISOString() || '',
        },
        valid_until: row.valid_until?.toISOString() || '',
        over_limit: usageCount > usageLimit,
        over_soft_limit: usageCount > softLimit,
        // Include cancel_at only if subscription is scheduled to cancel
        ...(row.cancel_at_period_end && row.current_period_end
          ? { cancel_at: row.current_period_end.toISOString() }
          : {}),
      };

      // Cache the response (60 seconds TTL)
      await EntitlementCache.setEntitlement(userId, productId, response, 60);

      const duration = Date.now() - startTime;
      console.log(`Database query - Response time: ${duration}ms`);

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Cache': 'MISS',
          'X-Response-Time': `${duration}ms`,
        },
        body: JSON.stringify(response),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error checking entitlement:', error);

    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'X-Response-Time': `${duration}ms`,
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to check entitlement',
        details: process.env['ENVIRONMENT'] === 'development'
          ? (error as Error).message
          : undefined,
      }),
    };
  }
};
