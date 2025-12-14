/**
 * Pre Sign-up Trigger Lambda Handler
 *
 * Cognito Trigger: PreSignUp
 * Executes before a user is registered in the user pool
 *
 * Responsibilities:
 * - Validate email domain (block disposable email addresses)
 * - Auto-confirm users from external providers (social login)
 * - Auto-confirm users who already exist in another product (cross-app auth)
 * - Custom validation logic before user creation
 *
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-sign-up.html
 */

import { PreSignUpTriggerHandler } from 'aws-lambda';
import {
  DEFAULT_BLOCKED_DOMAINS,
  AuthError,
  AuthErrorCode,
} from '../types.js';
import { query } from '../../../shared/db/index.js';

/**
 * Environment variables
 */
interface PreSignUpEnv {
  /** Comma-separated list of blocked domains (overrides default) */
  BLOCKED_EMAIL_DOMAINS?: string;
  /** Comma-separated list of allowed domains (whitelist) */
  ALLOWED_EMAIL_DOMAINS?: string;
  /** Enable domain validation (default: true) */
  ENABLE_DOMAIN_VALIDATION?: string;
}

/**
 * Get blocked domains from environment or use defaults
 */
function getBlockedDomains(env: PreSignUpEnv): string[] {
  if (env.BLOCKED_EMAIL_DOMAINS) {
    return env.BLOCKED_EMAIL_DOMAINS.split(',').map(d => d.trim().toLowerCase());
  }
  return DEFAULT_BLOCKED_DOMAINS;
}

/**
 * Get allowed domains from environment (whitelist)
 */
function getAllowedDomains(env: PreSignUpEnv): string[] {
  if (env.ALLOWED_EMAIL_DOMAINS) {
    return env.ALLOWED_EMAIL_DOMAINS.split(',').map(d => d.trim().toLowerCase());
  }
  return [];
}

/**
 * Extract domain from email address
 * @param email - Email address
 * @returns Domain part of email (lowercase)
 */
function extractDomain(email: string): string {
  const parts = email.toLowerCase().split('@');
  if (parts.length !== 2 || !parts[1]) {
    throw new AuthError(
      AuthErrorCode.INVALID_EMAIL_DOMAIN,
      'Invalid email format'
    );
  }
  return parts[1];
}

/**
 * Check if user email exists in user_product_logins table
 * This indicates the user has already verified their email in another product
 * @param email - Email address to check
 * @returns true if user exists in another product
 */
async function checkExistingUserInOtherProducts(email: string): Promise<boolean> {
  try {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM user_product_logins WHERE email = $1`,
      [email.toLowerCase()]
    );
    return parseInt(result.rows[0]?.count || '0', 10) > 0;
  } catch (error) {
    console.error('Failed to check existing user', { error, email });
    return false;
  }
}

/**
 * Validate email domain against blocklist and allowlist
 * @param email - Email address to validate
 * @param env - Environment configuration
 * @throws AuthError if domain is invalid
 */
function validateEmailDomain(email: string, env: PreSignUpEnv): void {
  const domain = extractDomain(email);
  const allowedDomains = getAllowedDomains(env);
  const blockedDomains = getBlockedDomains(env);

  // If allowlist is configured, only allow those domains
  if (allowedDomains.length > 0) {
    if (!allowedDomains.includes(domain)) {
      throw new AuthError(
        AuthErrorCode.INVALID_EMAIL_DOMAIN,
        `Email domain '${domain}' is not in the allowed list`,
        { domain, allowedDomains }
      );
    }
    return;
  }

  // Otherwise, check against blocklist
  if (blockedDomains.includes(domain)) {
    throw new AuthError(
      AuthErrorCode.INVALID_EMAIL_DOMAIN,
      'Disposable email addresses are not allowed',
      { domain }
    );
  }
}

/**
 * Pre Sign-up Lambda Handler
 *
 * Event triggers:
 * - PreSignUp_SignUp: Email/password registration
 * - PreSignUp_ExternalProvider: Social login (Google, Facebook, etc.)
 * - PreSignUp_AdminCreateUser: Admin-created users
 */
export const handler: PreSignUpTriggerHandler = async (event) => {
  const env = process.env as PreSignUpEnv;
  const email = event.request.userAttributes['email'];
  const triggerSource = event.triggerSource;

  console.log('PreSignUp trigger invoked', {
    email,
    triggerSource,
    userPoolId: event.userPoolId,
  });

  try {
    // Validate email domain (unless disabled)
    const validationEnabled = env.ENABLE_DOMAIN_VALIDATION !== 'false';
    if (validationEnabled && email) {
      validateEmailDomain(email, env);
      console.log('Email domain validation passed', { email });
    }

    // Auto-confirm users from external providers (social login)
    if (triggerSource === 'PreSignUp_ExternalProvider') {
      event.response.autoConfirmUser = true;
      event.response.autoVerifyEmail = true;
      console.log('Auto-confirming external provider user', { email });
    }

    // Auto-verify email for admin-created users
    if (triggerSource === 'PreSignUp_AdminCreateUser') {
      event.response.autoVerifyEmail = true;
      console.log('Auto-verifying admin-created user', { email });
    }

    // Auto-confirm users who already exist in another product (cross-app auth)
    // This allows users to skip email verification when signing up for a new app
    // if they've already verified their email in another app
    if (triggerSource === 'PreSignUp_SignUp' && email) {
      const existsInOtherProduct = await checkExistingUserInOtherProducts(email);
      if (existsInOtherProduct) {
        event.response.autoConfirmUser = true;
        event.response.autoVerifyEmail = true;
        console.log('Auto-confirming user from cross-app auth', { email });
      }
    }

    return event;
  } catch (error) {
    console.error('PreSignUp trigger failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email,
      triggerSource,
    });

    // Re-throw AuthError messages for user feedback
    if (error instanceof AuthError) {
      throw new Error(error.message);
    }

    // Generic error for unexpected failures
    throw new Error('User registration validation failed');
  }
};
