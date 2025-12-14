/**
 * Type definitions for Entitlement Service
 * Based on requirements specification Section 7.3
 */

/**
 * Entitlement status enum
 */
export type EntitlementStatus = 'active' | 'suspended' | 'expired' | 'cancelled';

/**
 * Database row structure for entitlements table
 */
export interface EntitlementRow {
  /** Unique entitlement ID */
  entitlement_id: string;
  /** User ID */
  user_id: string;
  /** Product ID */
  product_id: string;
  /** Plan ID */
  plan_id: string;
  /** Entitlement status */
  status: EntitlementStatus;
  /** Feature flags enabled for this plan */
  feature_flags: Record<string, boolean>;
  /** Custom usage limit (overrides plan default) */
  usage_limit: number | null;
  /** Current usage count */
  usage_count: number;
  /** Soft limit (allows overages with warning) */
  soft_limit: number;
  /** When the usage counter resets */
  usage_reset_at: Date | null;
  /** When the entitlement expires */
  valid_until: Date | null;
  /** Creation timestamp */
  created_at: Date;
  /** Last update timestamp */
  updated_at: Date;
}

/**
 * Database row structure for plans table
 */
export interface PlanRow {
  /** Unique plan ID */
  plan_id: string;
  /** Product ID */
  product_id: string;
  /** Plan name */
  plan_name: string;
  /** Feature flags included in plan */
  feature_flags: Record<string, boolean>;
  /** Default usage limit per period */
  usage_limit: number;
  /** Soft limit percentage (e.g., 0.1 = 10% overage allowed) */
  soft_limit_percent: number;
  /** Plan status */
  status: string;
  /** Creation timestamp */
  created_at: Date;
  /** Last update timestamp */
  updated_at: Date;
}

/**
 * Combined entitlement and plan data from JOIN query
 */
export interface EntitlementWithPlan extends EntitlementRow {
  /** Plan name (from plans table) */
  plan_name?: string;
  /** Price amount (from plans table) */
  price_amount?: number;
  /** Billing period (from plans table) */
  billing_period?: string;
  /** Default plan limit (from plans table) */
  plan_limit: number;
  /** Plan feature flags (from plans table) */
  plan_features?: Record<string, boolean>;
  /** Plan soft limit percentage (from plans table) */
  soft_limit_percent?: number;
}

/**
 * Usage information
 */
export interface UsageInfo {
  /** Usage limit (hard limit) */
  limit: number;
  /** Current usage count */
  used: number;
  /** Remaining usage quota */
  remaining: number;
  /** Soft limit (hard limit + allowed overage) */
  soft_limit: number;
  /** When the usage counter resets */
  reset_at: string;
}

/**
 * Entitlement API response
 */
export interface EntitlementResponse {
  /** Product ID */
  product_id: string;
  /** Plan ID */
  plan_id: string;
  /** Plan name */
  plan_name?: string;
  /** Price amount */
  price_amount?: number;
  /** Billing period */
  billing_period?: string;
  /** Entitlement status */
  status: EntitlementStatus;
  /** Feature flags */
  features: Record<string, boolean>;
  /** Usage information */
  usage: UsageInfo;
  /** Entitlement expiration date */
  valid_until: string;
  /** Whether usage is over hard limit */
  over_limit?: boolean;
  /** Whether usage is over soft limit */
  over_soft_limit?: boolean;
}

/**
 * Request body for POST /me/usage
 */
export interface UsageRequest {
  /** Product ID */
  product_id: string;
  /** Usage count to increment (default: 1) */
  count?: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Response for POST /me/usage
 */
export interface UsageResponse {
  /** Current usage count */
  used: number;
  /** Remaining usage quota */
  remaining: number;
  /** Whether usage exceeds hard limit */
  over_limit: boolean;
  /** Remaining usage including soft limit */
  soft_limit_remaining: number;
  /** Whether usage exceeds soft limit but within hard limit */
  over_soft_limit?: boolean;
}

/**
 * Request body for POST /internal/entitlements/grant (internal API)
 */
export interface GrantEntitlementRequest {
  /** User ID */
  user_id: string;
  /** Product ID */
  product_id: string;
  /** Plan ID */
  plan_id: string;
  /** Custom usage limit (optional override) */
  usage_limit?: number;
  /** Custom soft limit (optional override) */
  soft_limit?: number;
  /** Entitlement expiration date (ISO 8601 format) */
  valid_until?: string;
  /** Custom feature flags (optional override) */
  feature_flags?: Record<string, boolean>;
}

/**
 * Response for POST /internal/entitlements/grant
 */
export interface GrantEntitlementResponse {
  /** Created entitlement ID */
  entitlement_id: string;
  /** User ID */
  user_id: string;
  /** Product ID */
  product_id: string;
  /** Plan ID */
  plan_id: string;
  /** Entitlement status */
  status: EntitlementStatus;
  /** Granted timestamp */
  granted_at: string;
}

/**
 * Request body for POST /internal/entitlements/revoke
 */
export interface RevokeEntitlementRequest {
  /** User ID */
  user_id: string;
  /** Product ID */
  product_id: string;
  /** Reason for revocation */
  reason?: string;
}

/**
 * Response for POST /internal/entitlements/revoke
 */
export interface RevokeEntitlementResponse {
  /** Revoked entitlement ID */
  entitlement_id: string;
  /** User ID */
  user_id: string;
  /** Product ID */
  product_id: string;
  /** New status */
  status: EntitlementStatus;
  /** Revoked timestamp */
  revoked_at: string;
}

/**
 * Cache key builder for consistent naming
 */
export const CacheKeys = {
  /**
   * Entitlement cache key
   */
  entitlement: (userId: string, productId: string): string =>
    `entitlement:${userId}:${productId}`,

  /**
   * Usage counter cache key
   */
  usage: (userId: string, productId: string): string =>
    `usage:${userId}:${productId}`,

  /**
   * User's all entitlements pattern
   */
  userEntitlements: (userId: string): string =>
    `entitlement:${userId}:*`,
} as const;

/**
 * Default cache TTL values (in seconds)
 */
export const CacheTTL = {
  /** Entitlement data TTL: 60 seconds */
  ENTITLEMENT: 60,
  /** Usage counter TTL: 300 seconds (5 minutes) */
  USAGE: 300,
  /** Plan data TTL: 3600 seconds (1 hour) */
  PLAN: 3600,
} as const;

/**
 * Default usage reset period
 */
export const DEFAULT_RESET_PERIOD_DAYS = 30;

/**
 * Soft limit default percentage (10% overage)
 */
export const DEFAULT_SOFT_LIMIT_PERCENT = 0.1;
