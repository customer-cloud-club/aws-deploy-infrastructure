import type { PlatformConfig, UserProfile } from './types';
import { getIdToken } from './auth';

let config: PlatformConfig | null = null;

/**
 * SDK初期化
 */
export function initProfile(cfg: PlatformConfig): void {
  config = cfg;
}

/**
 * 現在のユーザープロフィールを取得
 * @returns ユーザープロフィール
 * @example
 * ```typescript
 * const profile = await PlatformSDK.getMe();
 * console.log(profile.email);
 * console.log(profile.auth_provider); // 'cognito' or 'google'
 * ```
 */
export async function getMe(): Promise<UserProfile> {
  if (!config) {
    throw new Error('PlatformSDK not initialized');
  }

  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${config.apiUrl}/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get user profile');
  }

  return response.json();
}
