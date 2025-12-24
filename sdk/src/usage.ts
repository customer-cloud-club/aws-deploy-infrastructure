import type { PlatformConfig, UsageRecord } from './types';
import { getIdToken } from './auth';
import { clearEntitlementCache } from './entitlement';

let config: PlatformConfig | null = null;

/**
 * SDK初期化
 */
export function initUsage(cfg: PlatformConfig): void {
  config = cfg;
}

/**
 * 使用量を記録
 */
export async function recordUsage(amount: number, type: string = 'api_call', metadata?: Record<string, unknown>): Promise<void> {
  if (!config) {
    throw new Error('PlatformSDK not initialized');
  }

  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const record: UsageRecord = {
    type,
    amount,
    metadata,
  };

  const response = await fetch(`${config.apiUrl}/me/usage`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_id: config.productId,
      count: amount,
      metadata,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to record usage');
  }

  // キャッシュをクリアして次回取得時に最新を取得
  clearEntitlementCache();
}

/**
 * バッチで使用量を記録
 * 内部的には個別のAPIコールを順次実行します
 */
export async function recordUsageBatch(records: UsageRecord[]): Promise<void> {
  if (!config) {
    throw new Error('PlatformSDK not initialized');
  }

  // 各レコードを順次処理
  for (const record of records) {
    await recordUsage(record.amount, record.type, record.metadata);
  }
}

/**
 * 使用量をインクリメント（ショートハンド）
 */
export async function incrementUsage(type: string = 'api_call'): Promise<void> {
  return recordUsage(1, type);
}
