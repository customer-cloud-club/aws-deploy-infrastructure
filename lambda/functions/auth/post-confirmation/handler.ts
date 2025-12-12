/**
 * Post Confirmation Trigger Lambda Handler
 *
 * Cognito Trigger: PostConfirmation
 * Executes after a user confirms their account (email verification or auto-confirm)
 *
 * Responsibilities:
 * - Create user record in application database (Aurora/RDS)
 * - Assign default tenant for new users
 * - Create initial entitlement record (free plan)
 * - Set up user profile and metadata
 *
 * Database Tables:
 * - users: User account records
 * - tenants: Multi-tenant organization records
 * - entitlements: User plan/subscription records
 *
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-confirmation.html
 */

import { PostConfirmationTriggerHandler } from 'aws-lambda';
import { getPool } from '../../../shared/db.js';
import { AuthError, AuthErrorCode, User, Entitlement } from '../types.js';
import { PoolClient } from 'pg';

/**
 * Environment variables
 */
interface PostConfirmationEnv {
  /** Default tenant ID for new users (typically 'default' or organization ID) */
  DEFAULT_TENANT_ID?: string;
  /** Default plan ID for new users */
  DEFAULT_PLAN_ID?: string;
  /** Whether to create default entitlement */
  CREATE_DEFAULT_ENTITLEMENT?: string;
}

/**
 * Get default tenant ID from environment or use fallback
 */
function getDefaultTenantId(env: PostConfirmationEnv): string {
  return env.DEFAULT_TENANT_ID || 'default';
}

/**
 * Get default plan ID from environment or use fallback
 */
function getDefaultPlanId(env: PostConfirmationEnv): string {
  return env.DEFAULT_PLAN_ID || 'free';
}

/**
 * Create user record in database
 * @param client - Database client
 * @param userId - Cognito user ID (sub)
 * @param email - User email address
 * @param tenantId - Tenant ID to assign
 * @returns Created user record
 */
async function createUser(
  client: PoolClient,
  userId: string,
  email: string,
  tenantId: string
): Promise<User> {
  const query = `
    INSERT INTO users (user_id, tenant_id, email, status, created_at, updated_at)
    VALUES ($1, $2, $3, 'active', NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET updated_at = NOW()
    RETURNING user_id, tenant_id, email, status, created_at, updated_at
  `;

  const result = await client.query<User>(query, [userId, tenantId, email]);

  const user = result.rows[0];
  if (!user) {
    throw new AuthError(
      AuthErrorCode.USER_CREATION_FAILED,
      'Failed to create user record',
      { userId, email, tenantId }
    );
  }

  return user;
}

/**
 * Ensure tenant exists or create default tenant
 * @param client - Database client
 * @param tenantId - Tenant ID
 */
async function ensureTenantExists(
  client: PoolClient,
  tenantId: string
): Promise<void> {
  const query = `
    INSERT INTO tenants (tenant_id, name, type, status, created_at, updated_at)
    VALUES ($1, $2, 'individual', 'active', NOW(), NOW())
    ON CONFLICT (tenant_id) DO NOTHING
  `;

  await client.query(query, [tenantId, `Tenant ${tenantId}`]);
}

/**
 * Create default entitlement for new user
 * @param client - Database client
 * @param userId - User ID
 * @param tenantId - Tenant ID
 * @param planId - Plan ID
 * @returns Created entitlement record
 */
async function createDefaultEntitlement(
  client: PoolClient,
  userId: string,
  tenantId: string,
  planId: string
): Promise<Entitlement> {
  const query = `
    INSERT INTO entitlements (
      entitlement_id,
      user_id,
      tenant_id,
      plan_id,
      status,
      start_date,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      'active',
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id, plan_id) DO UPDATE
    SET updated_at = NOW()
    RETURNING entitlement_id, user_id, tenant_id, plan_id, status, start_date, created_at, updated_at
  `;

  const result = await client.query<Entitlement>(query, [userId, tenantId, planId]);

  const entitlement = result.rows[0];
  if (!entitlement) {
    throw new AuthError(
      AuthErrorCode.USER_CREATION_FAILED,
      'Failed to create default entitlement',
      { userId, tenantId, planId }
    );
  }

  return entitlement;
}

/**
 * Post Confirmation Lambda Handler
 *
 * Event triggers:
 * - PostConfirmation_ConfirmSignUp: Email verification confirmed
 * - PostConfirmation_ConfirmForgotPassword: Password reset confirmed
 */
export const handler: PostConfirmationTriggerHandler = async (event) => {
  const env = process.env as PostConfirmationEnv;
  const userId = event.request.userAttributes['sub'];
  const email = event.request.userAttributes['email'];
  const triggerSource = event.triggerSource;

  if (!userId || !email) {
    throw new Error('Missing required user attributes: sub or email');
  }

  console.log('PostConfirmation trigger invoked', {
    userId,
    email,
    triggerSource,
    userPoolId: event.userPoolId,
  });

  // Only create user records for new sign-ups, not password resets
  if (triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    console.log('Skipping user creation for non-signup trigger', { triggerSource });
    return event;
  }

  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tenantId = getDefaultTenantId(env);
    const planId = getDefaultPlanId(env);

    // Ensure default tenant exists
    await ensureTenantExists(client, tenantId);
    console.log('Tenant verified/created', { tenantId });

    // Create user record
    const user = await createUser(client, userId, email, tenantId);
    console.log('User created', {
      userId: user.user_id,
      email: user.email,
      tenantId: user.tenant_id,
    });

    // Create default entitlement if enabled
    const shouldCreateEntitlement = env.CREATE_DEFAULT_ENTITLEMENT !== 'false';
    if (shouldCreateEntitlement) {
      const entitlement = await createDefaultEntitlement(client, userId, tenantId, planId);
      console.log('Default entitlement created', {
        entitlementId: entitlement.entitlement_id,
        planId: entitlement.plan_id,
      });
    }

    await client.query('COMMIT');

    console.log('PostConfirmation completed successfully', { userId, email });
    return event;
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('PostConfirmation trigger failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      email,
      triggerSource,
    });

    // Re-throw AuthError messages for user feedback
    if (error instanceof AuthError) {
      throw new Error(error.message);
    }

    // Generic error for unexpected failures
    throw new Error('User account setup failed');
  } finally {
    client.release();
  }
};
