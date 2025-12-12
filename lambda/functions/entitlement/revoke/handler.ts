/**
 * POST /internal/entitlements/revoke
 * Revoke or suspend user entitlement (Internal API)
 *
 * Requirements:
 * - Internal API only (IAM authentication or API key)
 * - Soft delete (status change, not physical delete)
 * - Audit trail with reason
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { initializeDatabase } from '../../../shared/db/index.js';
import EntitlementCache from '../cache.js';
import {
  RevokeEntitlementRequest,
  RevokeEntitlementResponse,
  EntitlementStatus,
} from '../types.js';

/**
 * Lambda handler for POST /internal/entitlements/revoke
 */
export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();

  try {
    // Parse request body
    let body: RevokeEntitlementRequest;
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

    const { user_id, product_id, reason } = body;

    // Validate required fields
    if (!user_id || !product_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Missing required fields: user_id, product_id',
        }),
      };
    }

    console.log(`Revoking entitlement for user: ${user_id}, product: ${product_id}, reason: ${reason || 'N/A'}`);

    const pool = await initializeDatabase();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update entitlement status to 'suspended'
      const result = await client.query<{
        entitlement_id: string;
        status: EntitlementStatus;
        updated_at: Date;
      }>(
        `
        UPDATE entitlements
        SET
          status = 'suspended',
          updated_at = NOW()
        WHERE user_id = $1 AND product_id = $2 AND status = 'active'
        RETURNING entitlement_id, status, updated_at
        `,
        [user_id, product_id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          statusCode: 404,
          body: JSON.stringify({
            error: 'Not Found',
            message: 'No active entitlement found for this user and product',
          }),
        };
      }

      const row = result.rows[0]!; // Non-null assertion since we checked length above

      // Log revocation event for audit trail
      try {
        await client.query(
          `
          INSERT INTO entitlement_audit_log (
            entitlement_id,
            user_id,
            product_id,
            action,
            reason,
            performed_by,
            created_at
          ) VALUES ($1, $2, $3, 'revoked', $4, $5, NOW())
          `,
          [
            row.entitlement_id,
            user_id,
            product_id,
            reason || 'No reason provided',
            event.requestContext?.authorizer?.['claims']?.['sub'] || 'system',
          ]
        );
      } catch (error) {
        // Log error but don't fail the request
        console.error('Failed to log revocation event:', error);
      }

      await client.query('COMMIT');

      // Invalidate cache
      await EntitlementCache.invalidateAll(user_id, product_id);

      // Build response
      const response: RevokeEntitlementResponse = {
        entitlement_id: row.entitlement_id,
        user_id,
        product_id,
        status: row.status,
        revoked_at: row.updated_at.toISOString(),
      };

      const duration = Date.now() - startTime;
      console.log(`Entitlement revoked - Response time: ${duration}ms`);

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
    console.error('Error revoking entitlement:', error);

    return {
      statusCode: 500,
      headers: {
        'X-Response-Time': `${duration}ms`,
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to revoke entitlement',
        details: process.env['ENVIRONMENT'] === 'development'
          ? (error as Error).message
          : undefined,
      }),
    };
  }
};
