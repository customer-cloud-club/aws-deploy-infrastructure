/**
 * Pre Sign-up Trigger Lambda Handler
 *
 * Cognito Trigger: PreSignUp
 * Executes before a user is registered in the user pool
 *
 * Responsibilities:
 * - Validate email domain (block disposable email addresses)
 * - Auto-confirm users from external providers (social login)
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
