/**
 * POST /internal/entitlements/grant
 * Grant entitlement to a user (Internal API)
 *
 * Requirements:
 * - Internal API only (IAM authentication or API key)
 * - Idempotent operation (upsert)
 * - Initialize usage counter and reset date
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { initializeDatabase } from '../../../shared/db/index.js';
import EntitlementCache from '../cache.js';
import {
  GrantEntitlementRequest,
  GrantEntitlementResponse,
  DEFAULT_RESET_PERIOD_DAYS,
} from '../types.js';
import { randomUUID } from 'crypto';

/**
 * Lambda handler for POST /internal/entitlements/grant
 */
export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();

  try {
    // Parse request body
    let body: GrantEntitlementRequest;
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

    const {
      user_id,
      product_id,
      plan_id,
      usage_limit,
      soft_limit,
      valid_until,
      feature_flags,
    } = body;

    // Validate required fields
    if (!user_id || !product_id || !plan_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Missing required fields: user_id, product_id, plan_id',
        }),
      };
    }

    console.log(`Granting entitlement to user: ${user_id}, product: ${product_id}, plan: ${plan_id}`);

    const pool = await initializeDatabase();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verify that the plan exists
      const planResult = await client.query(
        `
        SELECT plan_id, usage_limit, soft_limit_percent, feature_flags
        FROM plans
        WHERE plan_id = $1 AND product_id = $2 AND status = 'active'
        `,
        [plan_id, product_id]
      );

      if (planResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          statusCode: 404,
          body: JSON.stringify({
            error: 'Not Found',
            message: `Plan not found: ${plan_id}`,
          }),
        };
      }

      const plan = planResult.rows[0]!; // Non-null assertion since we checked length above

      // Calculate default values
      const finalUsageLimit = usage_limit ?? plan.usage_limit;
      const finalSoftLimit = soft_limit ?? Math.floor(finalUsageLimit * (1 + (plan.soft_limit_percent || 0.1)));
      const finalFeatureFlags = feature_flags ?? plan.feature_flags ?? {};

      // Calculate usage reset date (30 days from now by default)
      const usageResetAt = new Date();
      usageResetAt.setDate(usageResetAt.getDate() + DEFAULT_RESET_PERIOD_DAYS);

      // Parse valid_until if provided
      const validUntil = valid_until ? new Date(valid_until) : null;

      // Upsert entitlement (idempotent)
      const entitlementId = randomUUID();
      const result = await client.query<{
        entitlement_id: string;
        created_at: Date;
      }>(
        `
        INSERT INTO entitlements (
          entitlement_id,
          user_id,
          product_id,
          plan_id,
          status,
          feature_flags,
          usage_limit,
          usage_count,
          soft_limit,
          usage_reset_at,
          valid_until,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, 'active', $5, $6, 0, $7, $8, $9, NOW(), NOW()
        )
        ON CONFLICT (user_id, product_id)
        DO UPDATE SET
          plan_id = EXCLUDED.plan_id,
          status = 'active',
          feature_flags = EXCLUDED.feature_flags,
          usage_limit = EXCLUDED.usage_limit,
          soft_limit = EXCLUDED.soft_limit,
          usage_reset_at = EXCLUDED.usage_reset_at,
          valid_until = EXCLUDED.valid_until,
          updated_at = NOW()
        RETURNING entitlement_id, created_at
        `,
        [
          entitlementId,
          user_id,
          product_id,
          plan_id,
          JSON.stringify(finalFeatureFlags),
          finalUsageLimit,
          finalSoftLimit,
          usageResetAt,
          validUntil,
        ]
      );

      const row = result.rows[0]!; // Non-null assertion - INSERT always returns a row

      await client.query('COMMIT');

      // Invalidate cache
      await EntitlementCache.invalidateAll(user_id, product_id);

      // Build response
      const response: GrantEntitlementResponse = {
        entitlement_id: row.entitlement_id,
        user_id,
        product_id,
        plan_id,
        status: 'active',
        granted_at: row.created_at.toISOString(),
      };

      const duration = Date.now() - startTime;
      console.log(`Entitlement granted - Response time: ${duration}ms`);

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
    console.error('Error granting entitlement:', error);

    return {
      statusCode: 500,
      headers: {
        'X-Response-Time': `${duration}ms`,
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to grant entitlement',
        details: process.env['ENVIRONMENT'] === 'development'
          ? (error as Error).message
          : undefined,
      }),
    };
  }
};
