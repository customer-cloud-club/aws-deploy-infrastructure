/**
 * Type definitions for Catalog Service
 * Manages products, plans, and tenants
 */

/**
 * Database row structure for products table
 */
export interface ProductRow {
  /** Unique product ID */
  id: string;
  /** Product name */
  name: string;
  /** Product description */
  description: string | null;
  /** Stripe Product ID */
  stripe_product_id: string;
  /** Whether the product is active */
  is_active: boolean;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Creation timestamp */
  created_at: Date;
  /** Last update timestamp */
  updated_at: Date;
  /** Soft delete timestamp */
  deleted_at: Date | null;
}

/**
 * Database row structure for plans table
 */
export interface PlanRow {
  /** Unique plan ID */
  id: string;
  /** Product ID (foreign key) */
  product_id: string;
  /** Plan name */
  name: string;
  /** Stripe Price ID */
  stripe_price_id: string;
  /** Billing period */
  billing_period: 'monthly' | 'yearly' | 'one_time';
  /** Price amount in smallest currency unit */
  price_amount: number;
  /** Currency code (ISO 4217) */
  currency: string;
  /** Trial period in days */
  trial_period_days: number | null;
  /** Whether the plan is active */
  is_active: boolean;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Creation timestamp */
  created_at: Date;
  /** Last update timestamp */
  updated_at: Date;
  /** Soft delete timestamp */
  deleted_at: Date | null;
}

/**
 * Database row structure for tenants table
 */
export interface TenantRow {
  /** Unique tenant ID */
  id: string;
  /** Tenant name */
  name: string;
  /** Unique subdomain */
  subdomain: string;
  /** Tenant status */
  status: 'active' | 'suspended' | 'cancelled';
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Creation timestamp */
  created_at: Date;
  /** Last update timestamp */
  updated_at: Date;
  /** Soft delete timestamp */
  deleted_at: Date | null;
}

/**
 * Request body for POST /admin/products
 */
export interface CreateProductRequest {
  /** Product name */
  name: string;
  /** Product description */
  description?: string;
  /** Stripe Product ID */
  stripe_product_id: string;
  /** Whether the product is active */
  is_active?: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Request body for PUT /admin/products/{id}
 */
export interface UpdateProductRequest {
  /** Product name */
  name?: string;
  /** Product description */
  description?: string;
  /** Whether the product is active */
  is_active?: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Product API response
 */
export interface ProductResponse {
  /** Product ID */
  id: string;
  /** Product name */
  name: string;
  /** Product description */
  description: string | null;
  /** Stripe Product ID */
  stripe_product_id: string;
  /** Whether the product is active */
  is_active: boolean;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

/**
 * Request body for POST /admin/plans
 */
export interface CreatePlanRequest {
  /** Product ID */
  product_id: string;
  /** Plan name */
  name: string;
  /** Billing period */
  billing_period: 'monthly' | 'yearly' | 'one_time';
  /** Price amount in smallest currency unit */
  price_amount: number;
  /** Currency code (default: JPY) */
  currency?: string;
  /** Trial period in days */
  trial_period_days?: number;
  /** Whether the plan is active */
  is_active?: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Request body for PUT /admin/plans/{id}
 */
export interface UpdatePlanRequest {
  /** Plan name */
  name?: string;
  /** Whether the plan is active */
  is_active?: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Plan API response
 */
export interface PlanResponse {
  /** Plan ID */
  id: string;
  /** Product ID */
  product_id: string;
  /** Plan name */
  name: string;
  /** Stripe Price ID */
  stripe_price_id: string;
  /** Billing period */
  billing_period: string;
  /** Price amount in smallest currency unit */
  price_amount: number;
  /** Currency code */
  currency: string;
  /** Trial period in days */
  trial_period_days: number | null;
  /** Whether the plan is active */
  is_active: boolean;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

/**
 * Request body for POST /admin/tenants
 */
export interface CreateTenantRequest {
  /** Tenant name */
  name: string;
  /** Unique subdomain */
  subdomain: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tenant API response
 */
export interface TenantResponse {
  /** Tenant ID */
  id: string;
  /** Tenant name */
  name: string;
  /** Unique subdomain */
  subdomain: string;
  /** Tenant status */
  status: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

/**
 * List response with pagination
 */
export interface ListResponse<T> {
  /** List of items */
  items: T[];
  /** Total count */
  total: number;
  /** Current page */
  page: number;
  /** Items per page */
  per_page: number;
  /** Whether there are more pages */
  has_more: boolean;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page: number;
  /** Items per page */
  per_page: number;
  /** Offset for SQL query */
  offset: number;
}

/**
 * Admin role check result
 */
export interface AdminCheckResult {
  /** Whether the user is an admin */
  is_admin: boolean;
  /** User role */
  role?: string;
  /** User ID */
  user_id?: string;
}

// ============================================
// Coupon Types
// ============================================

/**
 * Coupon duration type
 */
export type CouponDuration = 'once' | 'repeating' | 'forever';

/**
 * Database row structure for coupons table
 */
export interface CouponRow {
  /** Unique coupon ID */
  id: string;
  /** Stripe Coupon ID */
  stripe_coupon_id: string;
  /** Coupon name */
  name: string;
  /** Percentage discount (mutually exclusive with amount_off) */
  percent_off: number | null;
  /** Fixed amount discount (mutually exclusive with percent_off) */
  amount_off: number | null;
  /** Currency for amount_off */
  currency: string | null;
  /** Duration type */
  duration: CouponDuration;
  /** Number of months (for repeating duration) */
  duration_in_months: number | null;
  /** Maximum redemptions */
  max_redemptions: number | null;
  /** Number of times redeemed */
  times_redeemed: number;
  /** Expiration timestamp */
  redeem_by: Date | null;
  /** Whether the coupon is active */
  is_active: boolean;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Creation timestamp */
  created_at: Date;
  /** Last update timestamp */
  updated_at: Date;
  /** Soft delete timestamp */
  deleted_at: Date | null;
}

/**
 * Request body for POST /admin/coupons
 */
export interface CreateCouponRequest {
  /** Coupon name (displayed to customers) */
  name: string;
  /** Percentage discount (1-100) */
  percent_off?: number;
  /** Fixed amount discount */
  amount_off?: number;
  /** Currency for amount_off (required if amount_off is set) */
  currency?: string;
  /** Duration type */
  duration: CouponDuration;
  /** Number of months for repeating duration */
  duration_in_months?: number;
  /** Maximum redemptions */
  max_redemptions?: number;
  /** Expiration date (ISO string) */
  redeem_by?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Request body for PUT /admin/coupons/{id}
 */
export interface UpdateCouponRequest {
  /** Coupon name */
  name?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Coupon API response
 */
export interface CouponResponse {
  /** Coupon ID */
  id: string;
  /** Stripe Coupon ID */
  stripe_coupon_id: string;
  /** Coupon name */
  name: string;
  /** Percentage discount */
  percent_off: number | null;
  /** Fixed amount discount */
  amount_off: number | null;
  /** Currency */
  currency: string | null;
  /** Duration type */
  duration: CouponDuration;
  /** Duration in months */
  duration_in_months: number | null;
  /** Maximum redemptions */
  max_redemptions: number | null;
  /** Times redeemed */
  times_redeemed: number;
  /** Expiration timestamp */
  redeem_by: string | null;
  /** Whether the coupon is active */
  is_active: boolean;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

/**
 * Database row structure for promotion codes table
 */
export interface PromotionCodeRow {
  /** Unique promotion code ID */
  id: string;
  /** Stripe Promotion Code ID */
  stripe_promotion_code_id: string;
  /** Coupon ID (foreign key) */
  coupon_id: string;
  /** The actual code customers enter */
  code: string;
  /** Whether the code is active */
  is_active: boolean;
  /** Maximum redemptions */
  max_redemptions: number | null;
  /** Number of times redeemed */
  times_redeemed: number;
  /** Expiration timestamp */
  expires_at: Date | null;
  /** Minimum amount required for order */
  minimum_amount: number | null;
  /** Currency for minimum_amount */
  minimum_amount_currency: string | null;
  /** Restrict to first-time customers only */
  first_time_transaction: boolean;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Creation timestamp */
  created_at: Date;
  /** Last update timestamp */
  updated_at: Date;
  /** Soft delete timestamp */
  deleted_at: Date | null;
}

/**
 * Request body for POST /admin/promotion-codes
 */
export interface CreatePromotionCodeRequest {
  /** Coupon ID to reference */
  coupon_id: string;
  /** The code customers enter (auto-generated if not provided) */
  code?: string;
  /** Maximum redemptions */
  max_redemptions?: number;
  /** Expiration date (ISO string) */
  expires_at?: string;
  /** Minimum order amount */
  minimum_amount?: number;
  /** Currency for minimum_amount */
  minimum_amount_currency?: string;
  /** First-time customers only */
  first_time_transaction?: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Promotion Code API response
 */
export interface PromotionCodeResponse {
  /** Promotion Code ID */
  id: string;
  /** Stripe Promotion Code ID */
  stripe_promotion_code_id: string;
  /** Coupon ID */
  coupon_id: string;
  /** The actual code */
  code: string;
  /** Whether the code is active */
  is_active: boolean;
  /** Maximum redemptions */
  max_redemptions: number | null;
  /** Times redeemed */
  times_redeemed: number;
  /** Expiration timestamp */
  expires_at: string | null;
  /** Minimum amount */
  minimum_amount: number | null;
  /** Minimum amount currency */
  minimum_amount_currency: string | null;
  /** First-time transaction only */
  first_time_transaction: boolean;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
  /** Associated coupon details */
  coupon?: CouponResponse;
}

/**
 * Cache keys for catalog service
 */
export const CatalogCacheKeys = {
  /** Product cache key */
  product: (id: string): string => `catalog:product:${id}`,
  /** All products cache key */
  products: (): string => 'catalog:products:all',
  /** Plan cache key */
  plan: (id: string): string => `catalog:plan:${id}`,
  /** Product's plans cache key */
  productPlans: (productId: string): string => `catalog:plans:product:${productId}`,
  /** Tenant cache key */
  tenant: (id: string): string => `catalog:tenant:${id}`,
  /** All tenants cache key */
  tenants: (): string => 'catalog:tenants:all',
  /** Coupon cache key */
  coupon: (id: string): string => `catalog:coupon:${id}`,
  /** All coupons cache key */
  coupons: (): string => 'catalog:coupons:all',
  /** Promotion code cache key */
  promotionCode: (id: string): string => `catalog:promotion-code:${id}`,
  /** All promotion codes cache key */
  promotionCodes: (): string => 'catalog:promotion-codes:all',
} as const;

/**
 * Cache TTL values for catalog service (in seconds)
 */
export const CatalogCacheTTL = {
  /** Product data TTL: 1 hour */
  PRODUCT: 3600,
  /** Plan data TTL: 1 hour */
  PLAN: 3600,
  /** Tenant data TTL: 5 minutes */
  TENANT: 300,
  /** Coupon data TTL: 30 minutes */
  COUPON: 1800,
  /** Promotion code data TTL: 30 minutes */
  PROMOTION_CODE: 1800,
} as const;
