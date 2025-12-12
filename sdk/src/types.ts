/**
 * SDK設定オプション
 */
export interface PlatformConfig {
  /** プロダクトID */
  productId: string;
  /** Platform API URL */
  apiUrl: string;
  /** Cognito User Pool ID */
  userPoolId?: string;
  /** Cognito Client ID */
  clientId?: string;
}

/**
 * 認証済みユーザー情報
 */
export interface AuthUser {
  /** ユーザーID (sub) */
  userId: string;
  /** メールアドレス */
  email: string;
  /** 表示名 */
  name?: string;
  /** テナントID */
  tenantId?: string;
  /** JWTトークン */
  accessToken: string;
  /** IDトークン */
  idToken: string;
}

/**
 * 利用権情報
 */
export interface Entitlement {
  /** 利用権ID */
  id: string;
  /** ユーザーID */
  userId: string;
  /** プロダクトID */
  productId: string;
  /** プランID */
  planId: string;
  /** プラン名 */
  planName: string;
  /** ステータス */
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  /** 機能フラグ */
  features: Record<string, boolean | number | string>;
  /** 使用制限 */
  limits: UsageLimits;
  /** 現在の使用量 */
  currentUsage: CurrentUsage;
  /** 有効期限 */
  expiresAt?: string;
}

/**
 * 使用制限
 */
export interface UsageLimits {
  /** API呼び出し数/月 */
  apiCalls?: number;
  /** ストレージ容量(MB) */
  storage?: number;
  /** 生成数/月 */
  generations?: number;
  /** カスタム制限 */
  [key: string]: number | undefined;
}

/**
 * 現在の使用量
 */
export interface CurrentUsage {
  /** API呼び出し数 */
  apiCalls: number;
  /** ストレージ使用量(MB) */
  storage: number;
  /** 生成数 */
  generations: number;
  /** リセット日時 */
  resetAt: string;
}

/**
 * 使用記録リクエスト
 */
export interface UsageRecord {
  /** 使用タイプ */
  type: 'api_call' | 'generation' | 'storage' | string;
  /** 使用量 */
  amount: number;
  /** メタデータ */
  metadata?: Record<string, unknown>;
}

/**
 * プラン情報
 */
export interface Plan {
  /** プランID */
  id: string;
  /** プラン名 */
  name: string;
  /** 説明 */
  description?: string;
  /** 価格(円) */
  price: number;
  /** 課金サイクル */
  billingCycle: 'monthly' | 'yearly' | 'one_time';
  /** 機能フラグ */
  features: Record<string, boolean | number | string>;
  /** 使用制限 */
  limits: UsageLimits;
}

/**
 * APIエラー
 */
export class PlatformError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}
