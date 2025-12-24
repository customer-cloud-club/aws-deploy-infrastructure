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
  /** 解約予定日 (ISO 8601) - cancel_at_period_end=trueの場合のみ */
  cancelAt?: string;
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
  /** プロダクトID */
  product_id: string;
  /** プラン名 */
  name: string;
  /** Stripe Price ID */
  stripe_price_id: string;
  /** 課金サイクル */
  billing_period: 'monthly' | 'yearly' | 'one_time';
  /** 価格(円) */
  price_amount: number;
  /** 通貨 */
  currency: string;
  /** トライアル期間(日) */
  trial_period_days?: number | null;
  /** 有効フラグ */
  is_active: boolean;
  /** メタデータ */
  metadata: Record<string, unknown>;
  /** 作成日時 */
  created_at: string;
  /** 更新日時 */
  updated_at: string;
}

/**
 * チェックアウトセッションリクエスト
 */
export interface CheckoutRequest {
  /** Stripe Price ID */
  planId: string;
  /** 成功時リダイレクトURL */
  successUrl: string;
  /** キャンセル時リダイレクトURL */
  cancelUrl: string;
  /** 追加メタデータ */
  metadata?: Record<string, string>;
}

/**
 * チェックアウトセッションレスポンス
 */
export interface CheckoutSession {
  /** セッションID */
  sessionId: string;
  /** チェックアウトURL */
  url: string;
}

/**
 * ユーザープロフィール
 */
export interface UserProfile {
  /** ユーザーID (Cognito sub) */
  user_id: string;
  /** メールアドレス */
  email: string;
  /** 表示名 */
  name: string | null;
  /** メール確認済みフラグ */
  email_verified: boolean;
  /** テナントID */
  tenant_id: string | null;
  /** プランID */
  plan_id: string | null;
  /** ユーザーロール */
  role: string | null;
  /** 認証プロバイダー (cognito, google等) */
  auth_provider: string;
  /** Stripe顧客ID */
  stripe_customer_id: string | null;
  /** アカウント作成日時 */
  created_at: string | null;
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
