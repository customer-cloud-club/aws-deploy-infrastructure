/**
 * Billing module - Stripe Checkout integration
 */
import type { PlatformConfig, PlatformError, CheckoutRequest, CheckoutSession } from './types';
import { getIdToken } from './auth';

let config: PlatformConfig | null = null;

/**
 * SDK初期化
 */
export function initBilling(cfg: PlatformConfig): void {
  config = cfg;
}

/**
 * Stripeチェックアウトセッションを作成
 *
 * @example
 * ```typescript
 * const { url } = await PlatformSDK.createCheckout({
 *   planId: 'price_xxx',
 *   successUrl: 'https://myapp.com/success?session_id={CHECKOUT_SESSION_ID}',
 *   cancelUrl: 'https://myapp.com/pricing',
 * });
 * window.location.href = url;
 * ```
 */
export async function createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
  if (!config) {
    throw new Error('PlatformSDK not initialized');
  }

  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${config.apiUrl}/checkout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plan_id: request.planId,
      product_id: config.productId,
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      metadata: request.metadata,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw {
      name: 'PlatformError',
      message: error.message || 'Failed to create checkout session',
      code: error.code || 'CHECKOUT_ERROR',
      statusCode: response.status,
      details: error.details,
    } as PlatformError;
  }

  const data = await response.json();
  return {
    sessionId: data.session_id,
    url: data.url,
  };
}

/**
 * チェックアウトページにリダイレクト
 *
 * @example
 * ```typescript
 * await PlatformSDK.redirectToCheckout({
 *   planId: 'price_xxx',
 *   successUrl: 'https://myapp.com/success',
 *   cancelUrl: 'https://myapp.com/pricing',
 * });
 * // ブラウザがStripeチェックアウトページにリダイレクト
 * ```
 */
export async function redirectToCheckout(request: CheckoutRequest): Promise<void> {
  const { url } = await createCheckout(request);
  if (typeof window !== 'undefined') {
    window.location.href = url;
  }
}
