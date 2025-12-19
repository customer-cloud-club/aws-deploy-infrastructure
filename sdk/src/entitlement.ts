import type { Entitlement, PlatformConfig, PlatformError, Plan } from './types';
import { getIdToken } from './auth';

let config: PlatformConfig | null = null;
let cachedEntitlement: Entitlement | null = null;
let cacheExpiry: number = 0;

const CACHE_TTL = 60 * 1000; // 1分

/**
 * SDK初期化
 */
export function initEntitlement(cfg: PlatformConfig): void {
  config = cfg;
}

/**
 * 利用権を取得
 */
export async function getEntitlement(forceRefresh = false): Promise<Entitlement> {
  if (!config) {
    throw new Error('PlatformSDK not initialized');
  }

  // キャッシュチェック
  if (!forceRefresh && cachedEntitlement && Date.now() < cacheExpiry) {
    return cachedEntitlement;
  }

  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${config.apiUrl}/me/entitlements?productId=${config.productId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw {
      name: 'PlatformError',
      message: error.message || 'Failed to get entitlement',
      code: error.code || 'ENTITLEMENT_ERROR',
      statusCode: response.status,
    } as PlatformError;
  }

  const entitlement = await response.json();
  cachedEntitlement = entitlement;
  cacheExpiry = Date.now() + CACHE_TTL;

  return entitlement;
}

/**
 * 機能が有効かチェック
 */
export async function hasFeature(featureName: string): Promise<boolean> {
  const entitlement = await getEntitlement();
  return !!entitlement.features[featureName];
}

/**
 * 使用制限内かチェック
 */
export async function checkLimit(limitType: keyof Entitlement['limits']): Promise<{ allowed: boolean; remaining: number }> {
  const entitlement = await getEntitlement();
  const limit = entitlement.limits[limitType];
  const current = entitlement.currentUsage[limitType as keyof typeof entitlement.currentUsage] || 0;

  if (limit === undefined || limit === -1) {
    return { allowed: true, remaining: Infinity };
  }

  const remaining = limit - (current as number);
  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
  };
}

/**
 * プラン一覧を取得
 */
export async function getPlans(): Promise<Plan[]> {
  if (!config) {
    throw new Error('PlatformSDK not initialized');
  }

  const response = await fetch(`${config.apiUrl}/catalog/plans?productId=${config.productId}`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch plans');
  }

  return response.json();
}

/**
 * キャッシュをクリア
 */
export function clearEntitlementCache(): void {
  cachedEntitlement = null;
  cacheExpiry = 0;
}
