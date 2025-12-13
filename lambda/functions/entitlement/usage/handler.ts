/**
 * POST /me/usage
 * Track usage and increment usage counter
 *
 * Requirements:
 * - Atomic increment with database transaction
 * - Cache invalidation on update
 * - Soft limit enforcement
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { initializeDatabase } from '../../../shared/db/index.js';
import EntitlementCache from '../cache.js';
import {
  UsageRequest,
  UsageResponse,
} from '../types.js';

/**
 * Lambda handler for POST /me/usage
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

    // Parse request body
    let body: UsageRequest;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid JSON body',
        }),
      };
    }

    const { product_id, count = 1, metadata } = body;

    // Validate input
    if (!product_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Missing required field: product_id',
        }),
      };
    }

    if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid count: must be a non-negative integer',
        }),
      };
    }

    console.log(`Recording usage for user: ${userId}, product: ${product_id}, count: ${count}`);

    // Database transaction for atomic increment
    const pool = await initializeDatabase();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update usage count atomically
      const result = await client.query<{
        usage_count: number;
        usage_limit: number;
        soft_limit: number;
        plan_limit: number;
      }>(
        `
        UPDATE user_entitlements e
        SET
          usage_count = usage_count + $3,
          updated_at = NOW()
        FROM plans p
        WHERE e.user_id = $1
          AND e.product_id = $2
          AND e.status = 'active'
          AND e.plan_id = p.id
        RETURNING
          e.usage_count,
          COALESCE(e.usage_limit, p.usage_limit) as usage_limit,
          e.soft_limit,
          p.usage_limit as plan_limit
        `,
        [userId, product_id, count]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          statusCode: 404,
          body: JSON.stringify({
            error: 'Not Found',
            message: 'No active entitlement found for this product',
          }),
        };
      }

      const row = result.rows[0]!; // Non-null assertion since we checked length above
      const usageCount = row.usage_count;
      const usageLimit = row.usage_limit;
      const softLimit = row.soft_limit || row.usage_limit;

      // Calculate remaining
      const remaining = usageLimit - usageCount;
      const overLimit = remaining < 0;
      const softLimitRemaining = softLimit - usageCount;
      const overSoftLimit = softLimitRemaining < 0;

      // Optional: Log usage event with metadata
      if (metadata) {
        try {
          await client.query(
            `
            INSERT INTO usage_events (user_id, product_id, count, metadata, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            `,
            [userId, product_id, count, JSON.stringify(metadata)]
          );
        } catch (error) {
          // Log error but don't fail the request
          console.error('Failed to log usage event:', error);
        }
      }

      await client.query('COMMIT');

      // Invalidate cache after successful update
      await EntitlementCache.invalidateAll(userId, product_id);

      // Build response
      const response: UsageResponse = {
        used: usageCount,
        remaining: Math.max(0, remaining),
        over_limit: overLimit,
        soft_limit_remaining: Math.max(0, softLimitRemaining),
        over_soft_limit: overSoftLimit && !overLimit,
      };

      const duration = Date.now() - startTime;
      console.log(`Usage recorded - Response time: ${duration}ms`);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Response-Time': `${duration}ms`,
        },
        body: JSON.stringify(response),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error recording usage:', error);

    return {
      statusCode: 500,
      headers: {
        'X-Response-Time': `${duration}ms`,
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to record usage',
        details: process.env['ENVIRONMENT'] === 'development'
          ? (error as Error).message
          : undefined,
      }),
    };
  }
};
