/**
 * GET /me
 * Get current user information
 *
 * Returns user profile data from Cognito claims and database
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { initializeDatabase, query } from '../../../shared/db/index.js';

/**
 * User profile response
 */
interface UserProfile {
  /** User ID (Cognito sub) */
  user_id: string;
  /** Email address */
  email: string;
  /** Display name */
  name: string | null;
  /** Whether email is verified */
  email_verified: boolean;
  /** Tenant ID */
  tenant_id: string | null;
  /** Current plan ID */
  plan_id: string | null;
  /** User role */
  role: string | null;
  /** Auth provider (cognito, google, etc.) */
  auth_provider: string;
  /** Stripe customer ID (if exists) */
  stripe_customer_id: string | null;
  /** Account creation date */
  created_at: string | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

/**
 * Determine auth provider from Cognito claims
 */
function getAuthProvider(claims: Record<string, string>): string {
  const identities = claims['identities'];
  if (identities) {
    try {
      const parsed = JSON.parse(identities);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0].providerName || 'external';
      }
    } catch {
      // Ignore parse errors
    }
  }
  return 'cognito';
}

/**
 * Lambda handler for GET /me
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

    // Extract user info from Cognito authorizer claims
    const claims = event.requestContext?.authorizer?.['claims'] as Record<string, string> | undefined;
    if (!claims) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'No claims found in token',
        }),
      };
    }

    const userId = claims['sub'];
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

    // Extract data from claims
    const email = claims['email'] || '';
    const name = claims['name'] || claims['cognito:username'] || null;
    const emailVerified = claims['email_verified'] === 'true';
    const tenantId = claims['custom:tenant_id'] || null;
    const planId = claims['custom:plan_id'] || null;
    const role = claims['custom:role'] || null;
    const authProvider = getAuthProvider(claims);

    // Get additional info from database (optional)
    let stripeCustomerId: string | null = null;
    let createdAt: string | null = null;

    try {
      await initializeDatabase();
      const result = await query<{ stripe_customer_id: string; created_at: Date }>(
        `SELECT stripe_customer_id, created_at FROM customers WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      if (result.rows.length > 0) {
        stripeCustomerId = result.rows[0].stripe_customer_id;
        createdAt = result.rows[0].created_at.toISOString();
      }
    } catch (error) {
      // Log but don't fail - customer record is optional
      console.warn('[GetMe] Failed to fetch customer info:', error);
    }

    const profile: UserProfile = {
      user_id: userId,
      email,
      name,
      email_verified: emailVerified,
      tenant_id: tenantId,
      plan_id: planId,
      role,
      auth_provider: authProvider,
      stripe_customer_id: stripeCustomerId,
      created_at: createdAt,
    };

    const duration = Date.now() - startTime;
    console.log(`[GetMe] User profile retrieved - Response time: ${duration}ms`, { userId });

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Response-Time': `${duration}ms`,
      },
      body: JSON.stringify(profile),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[GetMe] Error:', error);

    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'X-Response-Time': `${duration}ms`,
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to get user profile',
      }),
    };
  }
};
