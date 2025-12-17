/**
 * @aidreams/platform-sdk
 * Platform SDK for AI Dreams Factory authentication and billing integration
 */

import type { PlatformConfig, AuthUser, Entitlement, Plan, UsageRecord } from './types';
import { initAuth, requireAuth, logout, getAuthState, setAuthTokens, handleAuthCallback, getAccessToken, requestPasswordReset, confirmPasswordReset, deleteAccount, login, signup, confirmSignup, type LoginResponse, type SignupResponse } from './auth';
import { initEntitlement, getEntitlement, hasFeature, checkLimit, getPlans, clearEntitlementCache } from './entitlement';
import { initUsage, recordUsage, recordUsageBatch, incrementUsage } from './usage';

export * from './types';
export type { LoginResponse, SignupResponse } from './auth';

/**
 * Platform SDK メインクラス
 */
export class PlatformSDK {
  private static config: PlatformConfig | null = null;
  private static initialized = false;

  /**
   * SDKを初期化
   * @example
   * ```typescript
   * PlatformSDK.init({
   *   productId: process.env.PRODUCT_ID!,
   *   apiUrl: process.env.PLATFORM_API_URL!,
   * });
   * ```
   */
  static init(config: PlatformConfig): void {
    if (!config.productId || !config.apiUrl) {
      throw new Error('productId and apiUrl are required');
    }

    this.config = config;
    initAuth(config);
    initEntitlement(config);
    initUsage(config);
    this.initialized = true;
  }

  /**
   * 初期化状態を確認
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 認証必須チェック - 未認証ならログインページへリダイレクト
   * @example
   * ```typescript
   * const user = await PlatformSDK.requireAuth();
   * console.log(`Hello, ${user.email}`);
   * ```
   */
  static requireAuth = requireAuth;

  /**
   * 現在の認証状態を取得（リダイレクトなし）
   */
  static getAuthState = getAuthState;

  /**
   * アクセストークンを取得
   */
  static getAccessToken = getAccessToken;

  /**
   * 認証トークンを設定（サーバーサイド用）
   */
  static setAuthTokens = setAuthTokens;

  /**
   * OAuth認証コールバック処理
   */
  static handleAuthCallback = handleAuthCallback;

  /**
   * ログアウト
   */
  static logout = logout;

  /**
   * パスワードリセットをリクエスト
   * @example
   * ```typescript
   * await PlatformSDK.requestPasswordReset('user@example.com');
   * // メールで確認コードが送信される
   * ```
   */
  static requestPasswordReset = requestPasswordReset;

  /**
   * パスワードリセットを確認（新しいパスワードを設定）
   * @example
   * ```typescript
   * await PlatformSDK.confirmPasswordReset('user@example.com', '123456', 'newPassword');
   * ```
   */
  static confirmPasswordReset = confirmPasswordReset;

  /**
   * アカウントを削除
   * @example
   * ```typescript
   * await PlatformSDK.deleteAccount();
   * ```
   */
  static deleteAccount = deleteAccount;

  /**
   * メールアドレスとパスワードでログイン
   * @example
   * ```typescript
   * const result = await PlatformSDK.login('user@example.com', 'password123');
   * if (result.challengeName) {
   *   // MFAチャレンジが必要
   * } else {
   *   // ログイン成功
   * }
   * ```
   */
  static login = login;

  /**
   * メールアドレスとパスワードで新規登録
   * @example
   * ```typescript
   * const result = await PlatformSDK.signup('user@example.com', 'SecurePassword1-', 'User Name');
   * // メールで確認コードが送信される
   * ```
   */
  static signup = signup;

  /**
   * サインアップ確認（メール確認コードの検証）
   * @example
   * ```typescript
   * await PlatformSDK.confirmSignup('user@example.com', '123456');
   * // 確認完了後、ログイン可能
   * ```
   */
  static confirmSignup = confirmSignup;

  /**
   * 利用権を取得
   * @example
   * ```typescript
   * const entitlement = await PlatformSDK.getEntitlement();
   * if (entitlement.features.high_resolution) {
   *   // Pro機能を有効化
   * }
   * ```
   */
  static getEntitlement = getEntitlement;

  /**
   * 機能が有効かチェック
   * @example
   * ```typescript
   * if (await PlatformSDK.hasFeature('ai_generation')) {
   *   // AI生成機能を表示
   * }
   * ```
   */
  static hasFeature = hasFeature;

  /**
   * 使用制限をチェック
   * @example
   * ```typescript
   * const { allowed, remaining } = await PlatformSDK.checkLimit('generations');
   * if (!allowed) {
   *   showUpgradeModal();
   * }
   * ```
   */
  static checkLimit = checkLimit;

  /**
   * プラン一覧を取得
   */
  static getPlans = getPlans;

  /**
   * キャッシュをクリア
   */
  static clearCache = clearEntitlementCache;

  /**
   * 使用量を記録
   * @example
   * ```typescript
   * await PlatformSDK.recordUsage(1, 'generation');
   * ```
   */
  static recordUsage = recordUsage;

  /**
   * バッチで使用量を記録
   */
  static recordUsageBatch = recordUsageBatch;

  /**
   * 使用量をインクリメント（1を記録）
   * @example
   * ```typescript
   * await PlatformSDK.incrementUsage('api_call');
   * ```
   */
  static incrementUsage = incrementUsage;
}

// デフォルトエクスポート
export default PlatformSDK;
