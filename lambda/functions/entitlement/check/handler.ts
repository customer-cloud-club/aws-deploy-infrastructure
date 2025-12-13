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
import { initializeDatabase } from '../../../shared/db/index.js';
import EntitlementCache from '../cache.js';
import {
  EntitlementResponse,
  EntitlementWithPlan,
  DEFAULT_SOFT_LIMIT_PERCENT,
} from '../types.js';

/**
 * Lambda handler for GET /me/entitlements
 */
export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();

  try {
    // Extract user ID from Cognito authorizer
    const userId = event.requestContext?.authorizer?.['claims']?.['sub'];
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'User ID not found in token',
        }),
      };
    }

    // Get product_id from query parameters
    const productId = event.queryStringParameters?.['product_id'];
    if (!productId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Missing required parameter: product_id',
        }),
      };
    }

    console.log(`Checking entitlement for user: ${userId}, product: ${productId}`);

    // Check cache first
    const cachedEntitlement = await EntitlementCache.getEntitlement(userId, productId);
    if (cachedEntitlement) {
      const duration = Date.now() - startTime;
      console.log(`Cache hit - Response time: ${duration}ms`);
      return {
        statusCode: 200,
        headers: {
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
      // Query entitlement with plan data (JOIN)
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
          p.usage_limit as plan_limit,
          p.feature_flags as plan_features,
          p.soft_limit_percent
        FROM user_entitlements e
        JOIN plans p ON e.plan_id = p.id
        WHERE e.user_id = $1 AND e.product_id = $2 AND e.status = 'active'
        LIMIT 1
        `,
        [userId, productId]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
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
      };

      // Cache the response (60 seconds TTL)
      await EntitlementCache.setEntitlement(userId, productId, response, 60);

      const duration = Date.now() - startTime;
      console.log(`Database query - Response time: ${duration}ms`);

      return {
        statusCode: 200,
        headers: {
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
