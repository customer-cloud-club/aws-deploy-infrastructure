/**
 * Type definitions for Auth Service Lambda functions
 * AWS Cognito Trigger event types and custom interfaces
 */

/**
 * Re-export AWS Lambda Cognito trigger types
 */
export type {
  PreSignUpTriggerEvent,
  PreSignUpTriggerHandler,
  PostConfirmationTriggerEvent,
  PostConfirmationTriggerHandler,
  PreTokenGenerationTriggerEvent,
  PreTokenGenerationTriggerHandler,
} from 'aws-lambda';

/**
 * User database record
 */
export interface User {
  /** Cognito user ID (sub) */
  user_id: string;
  /** Tenant ID */
  tenant_id: string;
  /** User email address */
  email: string;
  /** User status */
  status: 'active' | 'inactive' | 'suspended';
  /** Account creation timestamp */
  created_at: Date;
  /** Last update timestamp */
  updated_at?: Date;
}

/**
 * Tenant database record
 */
export interface Tenant {
  /** Unique tenant ID */
  tenant_id: string;
  /** Tenant name */
  name: string;
  /** Tenant type */
  type: 'individual' | 'organization' | 'internal';
  /** Tenant status */
  status: 'active' | 'inactive' | 'suspended';
  /** Account creation timestamp */
  created_at: Date;
  /** Last update timestamp */
  updated_at?: Date;
}

/**
 * Entitlement database record
 */
export interface Entitlement {
  /** Entitlement ID */
  entitlement_id: string;
  /** User ID */
  user_id: string;
  /** Tenant ID */
  tenant_id: string;
  /** Plan ID */
  plan_id: string;
  /** Entitlement status */
  status: 'active' | 'expired' | 'cancelled';
  /** Start date */
  start_date: Date;
  /** Expiration date */
  end_date?: Date;
  /** Creation timestamp */
  created_at: Date;
  /** Last update timestamp */
  updated_at?: Date;
}

/**
 * Email domain validation configuration
 */
export interface DomainValidationConfig {
  /** List of blocked email domains (disposable/temporary email services) */
  blockedDomains: string[];
  /** List of allowed email domains (for enterprise whitelisting) */
  allowedDomains?: string[];
  /** Whether to enforce domain validation */
  enabled: boolean;
}

/**
 * Default domain validation configuration
 * Blocks common disposable email services
 */
export const DEFAULT_BLOCKED_DOMAINS: string[] = [
  'tempmail.com',
  'guerrillamail.com',
  'mailinator.com',
  '10minutemail.com',
  'throwaway.email',
  'temp-mail.org',
  'getnada.com',
  'maildrop.cc',
  'yopmail.com',
  'trashmail.com',
];

/**
 * Custom claims to add to JWT token
 */
export interface CustomClaims {
  /** Tenant ID for multi-tenancy */
  'custom:tenant_id': string;
  /** Plan ID for entitlement checking */
  'custom:plan_id': string;
  /** User role (optional) */
  'custom:role'?: string;
}

/**
 * Pre Token Generation response with custom claims
 */
export interface PreTokenGenerationResponse {
  claimsToAddOrOverride: Record<string, string>;
  claimsToSuppress?: string[];
  groupOverrideDetails?: {
    groupsToOverride: string[];
    iamRolesToOverride: string[];
    preferredRole: string;
  };
}

/**
 * User entitlement data for token generation
 */
export interface UserEntitlementData {
  /** Tenant ID */
  tenant_id: string;
  /** Plan ID (defaults to 'free' if none exists) */
  plan_id: string;
  /** User role */
  role?: string;
}

/**
 * Error codes for Auth Service
 */
export enum AuthErrorCode {
  INVALID_EMAIL_DOMAIN = 'INVALID_EMAIL_DOMAIN',
  USER_CREATION_FAILED = 'USER_CREATION_FAILED',
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  ENTITLEMENT_LOOKUP_FAILED = 'ENTITLEMENT_LOOKUP_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

/**
 * Auth Service error with code and details
 */
export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
