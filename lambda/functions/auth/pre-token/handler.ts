/**
 * Pre Token Generation Trigger Lambda Handler
 *
 * Cognito Trigger: PreTokenGeneration
 * Executes before JWT tokens are generated (ID token and access token)
 *
 * Responsibilities:
 * - Add custom claims to JWT tokens (tenant_id, plan_id, role)
 * - Fetch user entitlement data from database
 * - Enrich tokens with application-specific context
 * - Enable multi-tenancy and authorization
 *
 * Custom Claims:
 * - custom:tenant_id - User's tenant for multi-tenancy
 * - custom:plan_id - User's subscription plan for entitlement checks
 * - custom:role - User's role for RBAC (optional)
 *
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html
 */

import { PreTokenGenerationTriggerHandler } from 'aws-lambda';
import { getPool } from '../../../shared/db.js';
import { UserEntitlementData, AuthError, AuthErrorCode } from '../types.js';

/**
 * Environment variables
 */
interface PreTokenEnv {
  /** Default plan ID if user has no active entitlement */
  DEFAULT_PLAN_ID?: string;
  /** Whether to include role in claims */
  INCLUDE_ROLE_CLAIM?: string;
  /** Cache TTL for entitlement lookups (seconds) */
  ENTITLEMENT_CACHE_TTL?: string;
}

/**
 * Get default plan ID from environment
 */
function getDefaultPlanId(env: PreTokenEnv): string {
  return env.DEFAULT_PLAN_ID || 'free';
}

/**
 * Fetch user entitlement data from database
 * Joins users and entitlements tables to get tenant_id and plan_id
 *
 * @param userId - Cognito user ID (sub)
 * @param env - Environment configuration
 * @returns User entitlement data with tenant_id and plan_id
 */
async function fetchUserEntitlement(
  userId: string,
  env: PreTokenEnv
): Promise<UserEntitlementData> {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT
        u.tenant_id,
        COALESCE(e.plan_id, $2) as plan_id,
        u.status as user_status,
        e.status as entitlement_status
      FROM users u
      LEFT JOIN entitlements e
        ON u.user_id = e.user_id
        AND e.status = 'active'
        AND (e.end_date IS NULL OR e.end_date > NOW())
      WHERE u.user_id = $1
      ORDER BY e.created_at DESC
      LIMIT 1
    `;

    const defaultPlanId = getDefaultPlanId(env);
    const result = await client.query<{
      tenant_id: string;
      plan_id: string;
      user_status: string;
      entitlement_status?: string;
    }>(query, [userId, defaultPlanId]);

    const row = result.rows[0];
    if (!row) {
      // User not found in database - this shouldn't happen after PostConfirmation
      // Return default values to allow login (user may be created async)
      console.warn('User not found in database, using defaults', { userId });
      return {
        tenant_id: 'default',
        plan_id: defaultPlanId,
      };
    }

    // Check if user is active
    if (row.user_status !== 'active') {
      throw new AuthError(
        AuthErrorCode.DATABASE_ERROR,
        'User account is not active',
        { userId, status: row.user_status }
      );
    }

    return {
      tenant_id: row.tenant_id,
      plan_id: row.plan_id,
    };
  } catch (error) {
    console.error('Failed to fetch user entitlement', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });

    // Re-throw AuthError
    if (error instanceof AuthError) {
      throw error;
    }

    // For database errors, return default values to allow login
    // Log error for monitoring but don't block authentication
    console.error('Database error in pre-token, using defaults', { userId });
    return {
      tenant_id: 'default',
      plan_id: getDefaultPlanId(env),
    };
  } finally {
    client.release();
  }
}

/**
 * Pre Token Generation Lambda Handler
 *
 * Event triggers:
 * - TokenGeneration_HostedAuth: Hosted UI authentication
 * - TokenGeneration_Authentication: SDK/API authentication
 * - TokenGeneration_NewPasswordChallenge: New password required flow
 * - TokenGeneration_AuthenticateDevice: Device authentication
 * - TokenGeneration_RefreshTokens: Token refresh
 */
export const handler: PreTokenGenerationTriggerHandler = async (event) => {
  const env = process.env as PreTokenEnv;
  const userId = event.request.userAttributes['sub'];
  const triggerSource = event.triggerSource;

  if (!userId) {
    throw new Error('Missing required user attribute: sub');
  }

  console.log('PreTokenGeneration trigger invoked', {
    userId,
    triggerSource,
    userPoolId: event.userPoolId,
  });

  try {
    // Fetch user entitlement data from database
    const entitlement = await fetchUserEntitlement(userId, env);

    console.log('User entitlement fetched', {
      userId,
      tenantId: entitlement.tenant_id,
      planId: entitlement.plan_id,
    });

    // Add custom claims to JWT token
    const claimsToAdd: Record<string, string> = {
      'custom:tenant_id': entitlement.tenant_id || '',
      'custom:plan_id': entitlement.plan_id || 'free',
    };

    // Optionally include role claim
    const includeRole = env.INCLUDE_ROLE_CLAIM !== 'false';
    if (includeRole && entitlement.role) {
      claimsToAdd['custom:role'] = entitlement.role;
    }

    // Set claims override details
    event.response.claimsOverrideDetails = {
      claimsToAddOrOverride: claimsToAdd,
    };

    console.log('Custom claims added to token', {
      userId,
      claims: Object.keys(claimsToAdd),
    });

    return event;
  } catch (error) {
    console.error('PreTokenGeneration trigger failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      triggerSource,
    });

    // For token generation, we should not throw errors
    // as it would block user login. Instead, add default claims.
    const defaultClaims: Record<string, string> = {
      'custom:tenant_id': 'default',
      'custom:plan_id': getDefaultPlanId(env),
    };

    event.response.claimsOverrideDetails = {
      claimsToAddOrOverride: defaultClaims,
    };

    console.warn('Using default claims due to error', {
      userId,
      claims: defaultClaims,
    });

    return event;
  }
};
