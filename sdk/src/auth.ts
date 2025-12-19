import type { AuthUser, PlatformConfig, PlatformError } from './types';

let currentUser: AuthUser | null = null;
let config: PlatformConfig | null = null;

/**
 * SDK初期化
 */
export function initAuth(cfg: PlatformConfig): void {
  config = cfg;
}

/**
 * 認証状態を取得
 */
export function getAuthState(): AuthUser | null {
  return currentUser;
}

/**
 * アクセストークンを取得
 */
export async function getAccessToken(): Promise<string | null> {
  if (!currentUser) return null;
  return currentUser.accessToken;
}

/**
 * IDトークンを取得（Cognito Authorizer用）
 */
export async function getIdToken(): Promise<string | null> {
  if (!currentUser) return null;
  return currentUser.idToken;
}

/**
 * 認証必須チェック - 未認証なら例外
 */
export async function requireAuth(): Promise<AuthUser> {
  if (!config) {
    throw new Error('PlatformSDK not initialized. Call PlatformSDK.init() first.');
  }

  // ブラウザ環境: localStorageからトークン取得
  if (typeof window !== 'undefined') {
    const accessToken = localStorage.getItem('platform_access_token');
    const idToken = localStorage.getItem('platform_id_token');
    const userJson = localStorage.getItem('platform_user');

    if (accessToken && idToken && userJson) {
      try {
        const user = JSON.parse(userJson);
        const authUser: AuthUser = { ...user, accessToken, idToken };
        currentUser = authUser;
        return authUser;
      } catch {
        // パース失敗時は再認証
      }
    }

    // 未認証 - ログインページへリダイレクト
    const loginUrl = `${config.apiUrl}/auth/login?redirect=${encodeURIComponent(window.location.href)}`;
    window.location.href = loginUrl;
    throw new Error('Redirecting to login...');
  }

  // サーバー環境: リクエストヘッダーから取得
  throw new Error('Server-side authentication requires passing tokens via setAuthTokens()');
}

/**
 * 認証トークンを設定（サーバーサイド用）
 */
export function setAuthTokens(accessToken: string, idToken: string, user: Omit<AuthUser, 'accessToken' | 'idToken'>): void {
  currentUser = { ...user, accessToken, idToken };
}

/**
 * ログインレスポンス型
 */
export interface LoginResponse {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  challengeName?: string;
  session?: string;
  challengeParameters?: Record<string, string>;
}

/**
 * メールアドレスとパスワードでログイン
 * @param email ユーザーのメールアドレス
 * @param password パスワード
 * @returns 認証トークンまたはMFAチャレンジ情報
 * @example
 * ```typescript
 * const result = await PlatformSDK.login('user@example.com', 'password123');
 * if (result.challengeName) {
 *   // MFAチャレンジが必要
 *   console.log('MFA required:', result.challengeName);
 * } else {
 *   // ログイン成功
 *   console.log('Logged in!');
 * }
 * ```
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  if (!config) {
    throw new Error('PlatformSDK not initialized');
  }

  const response = await fetch(`${config.apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.message || 'Login failed');
  }

  const data: LoginResponse = await response.json();

  // MFAチャレンジがない場合はトークンを保存
  if (!data.challengeName && data.accessToken) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('platform_access_token', data.accessToken);
      localStorage.setItem('platform_id_token', data.idToken);
      if (data.refreshToken) {
        localStorage.setItem('platform_refresh_token', data.refreshToken);
      }
    }

    // currentUserを設定（IDトークンからユーザー情報をデコード）
    try {
      const payload = JSON.parse(atob(data.idToken.split('.')[1]));
      currentUser = {
        userId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email,
        accessToken: data.accessToken,
        idToken: data.idToken,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('platform_user', JSON.stringify({
          userId: payload.sub,
          email: payload.email,
          name: payload.name || payload.email,
        }));
      }
    } catch {
      // トークンのデコードに失敗しても続行
    }
  }

  return data;
}

/**
 * ログアウト
 */
export async function logout(): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('platform_access_token');
    localStorage.removeItem('platform_id_token');
    localStorage.removeItem('platform_user');
  }
  currentUser = null;
}

/**
 * 認証コールバック処理（OAuth後）
 * @param code 認可コード
 * @param redirectUri コールバックURL（OAuth認可時に指定したものと同じ）
 * @example
 * ```typescript
 * // URLからcodeを取得
 * const urlParams = new URLSearchParams(window.location.search);
 * const code = urlParams.get('code');
 * if (code) {
 *   const user = await PlatformSDK.handleAuthCallback(code, window.location.origin + '/callback');
 * }
 * ```
 */
export async function handleAuthCallback(code: string, redirectUri?: string): Promise<AuthUser> {
  if (!config) {
    throw new Error('PlatformSDK not initialized');
  }

  const response = await fetch(`${config.apiUrl}/auth/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri, productId: config.productId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Authentication failed');
  }

  const data = await response.json();

  if (typeof window !== 'undefined') {
    localStorage.setItem('platform_access_token', data.accessToken);
    localStorage.setItem('platform_id_token', data.idToken);
    localStorage.setItem('platform_user', JSON.stringify(data.user));
  }

  const authUser: AuthUser = {
    ...data.user,
    accessToken: data.accessToken,
    idToken: data.idToken,
  };
  currentUser = authUser;

  return authUser;
}

/**
 * パスワードリセットをリクエスト
 * @param email ユーザーのメールアドレス
 * @returns 確認コードの送信先情報
 * @example
 * ```typescript
 * await PlatformSDK.requestPasswordReset('user@example.com');
 * // メールで確認コードが送信される
 * ```
 */
export async function requestPasswordReset(email: string): Promise<{ deliveryMedium: string; destination: string }> {
  if (!config) {
    throw new Error('PlatformSDK not initialized');
  }

  const response = await fetch(`${config.apiUrl}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to request password reset');
  }

  return response.json();
}

/**
 * パスワードリセットを確認（新しいパスワードを設定）
 * @param email ユーザーのメールアドレス
 * @param code 確認コード
 * @param newPassword 新しいパスワード
 * @example
 * ```typescript
 * await PlatformSDK.confirmPasswordReset('user@example.com', '123456', 'newSecurePassword');
 * ```
 */
export async function confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
  if (!config) {
    throw new Error('PlatformSDK not initialized');
  }

  const response = await fetch(`${config.apiUrl}/auth/reset-password/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, newPassword }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to reset password');
  }
}

/**
 * アカウントを削除
 * @example
 * ```typescript
 * await PlatformSDK.deleteAccount();
 * // アカウントが削除され、ログアウトされる
 * ```
 */
export async function deleteAccount(): Promise<void> {
  if (!config) {
    throw new Error('PlatformSDK not initialized');
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${config.apiUrl}/auth/account`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete account');
  }

  // ログアウト処理
  await logout();
}

/**
 * サインアップレスポンス型
 */
export interface SignupResponse {
  message: string;
  userSub: string;
  userConfirmed: boolean;
  codeDeliveryDetails?: {
    destination: string;
    deliveryMedium: string;
    attributeName?: string;
  };
}

/**
 * メールアドレスとパスワードで新規登録
 * @param email ユーザーのメールアドレス
 * @param password パスワード
 * @param name 表示名（オプション）
 * @returns サインアップ結果
 * @example
 * ```typescript
 * const result = await PlatformSDK.signup('user@example.com', 'SecurePassword1-', 'User Name');
 * // メールで確認コードが送信される
 * console.log(result.userSub);
 * ```
 */
export async function signup(email: string, password: string, name?: string): Promise<SignupResponse> {
  if (!config) {
    throw new Error('PlatformSDK not initialized');
  }

  const response = await fetch(`${config.apiUrl}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.message || 'Signup failed');
  }

  return response.json();
}

/**
 * サインアップ確認（メール確認コードの検証）
 * @param email ユーザーのメールアドレス
 * @param code 確認コード
 * @example
 * ```typescript
 * await PlatformSDK.confirmSignup('user@example.com', '123456');
 * // 確認完了後、ログイン可能
 * ```
 */
export async function confirmSignup(email: string, code: string): Promise<void> {
  if (!config) {
    throw new Error('PlatformSDK not initialized');
  }

  const response = await fetch(`${config.apiUrl}/auth/signup/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.message || 'Confirmation failed');
  }
}
