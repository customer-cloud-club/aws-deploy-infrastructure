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
} as const;
