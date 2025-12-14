/**
 * API Client for Platform Backend
 * Direct API calls without SDK dependency
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface ApiError {
  error: string;
  message: string;
  details?: string;
}

/**
 * Base API fetch with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  accessToken?: string
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: 'Unknown Error',
      message: response.statusText,
    }));
    throw new Error(errorData.message || errorData.error || 'API request failed');
  }

  return response.json();
}

// ============================================
// Catalog API (Public - No Auth Required)
// ============================================

export interface Plan {
  id: string;
  product_id: string;
  name: string;
  stripe_price_id: string;
  billing_period: 'monthly' | 'yearly' | 'one_time';
  price_amount: number;
  currency: string;
  trial_period_days: number | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PlansResponse {
  items: Plan[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

/**
 * Get list of plans for a product
 */
export async function getPlans(productId: string): Promise<Plan[]> {
  const response = await apiFetch<PlansResponse>(
    `/catalog/plans?product_id=${encodeURIComponent(productId)}`
  );
  return response.items;
}

// ============================================
// Entitlement API (Auth Required)
// ============================================

export interface EntitlementUsage {
  limit: number;
  used: number;
  remaining: number;
  soft_limit: number;
  reset_at: string;
}

export interface Entitlement {
  product_id: string;
  plan_id: string;
  plan_name?: string;
  price_amount?: number;
  billing_period?: string;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  features: Record<string, boolean | number | string>;
  usage: EntitlementUsage;
  valid_until: string;
  over_limit: boolean;
  over_soft_limit: boolean;
}

/**
 * Get user's entitlement for a product
 */
export async function getEntitlement(
  productId: string,
  accessToken: string
): Promise<Entitlement> {
  return apiFetch<Entitlement>(
    `/me/entitlements?product_id=${encodeURIComponent(productId)}`,
    {},
    accessToken
  );
}

// ============================================
// Billing API (Auth Required)
// ============================================

export interface CheckoutRequest {
  plan_id: string;
  product_id: string;
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
}

export interface CheckoutResponse {
  session_id: string;
  url: string;
}

/**
 * Create Stripe Checkout session
 */
export async function createCheckoutSession(
  request: CheckoutRequest,
  accessToken: string
): Promise<CheckoutResponse> {
  return apiFetch<CheckoutResponse>(
    '/checkout',
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
    accessToken
  );
}

// ============================================
// Usage API (Auth Required)
// ============================================

export interface UsageRecord {
  type: string;
  amount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Record usage
 */
export async function recordUsage(
  productId: string,
  record: UsageRecord,
  accessToken: string
): Promise<void> {
  await apiFetch<{ success: boolean }>(
    '/me/usage',
    {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        ...record,
      }),
    },
    accessToken
  );
}
