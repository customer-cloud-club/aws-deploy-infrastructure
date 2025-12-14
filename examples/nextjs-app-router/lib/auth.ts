/**
 * Authentication Library
 * Handles Cognito OAuth flow without AWS Amplify
 */

// Environment variables
const COGNITO_DOMAIN = process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '';
const COGNITO_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
const COGNITO_REGION = process.env.NEXT_PUBLIC_COGNITO_REGION || 'ap-northeast-1';

// Token storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  ID_TOKEN: 'auth_id_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  TOKEN_EXPIRY: 'auth_token_expiry',
  USER: 'auth_user',
} as const;

export interface AuthUser {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  'custom:tenant_id'?: string;
}

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  idToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Get the Cognito Hosted UI domain URL
 */
function getCognitoUrl(): string {
  return `https://${COGNITO_DOMAIN}.auth.${COGNITO_REGION}.amazoncognito.com`;
}

/**
 * Build login URL for Cognito Hosted UI
 */
export function getLoginUrl(redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: COGNITO_CLIENT_ID,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: redirectUri,
  });

  if (state) {
    params.set('state', state);
  }

  return `${getCognitoUrl()}/login?${params.toString()}`;
}

/**
 * Build logout URL for Cognito
 */
export function getLogoutUrl(logoutUri: string): string {
  const params = new URLSearchParams({
    client_id: COGNITO_CLIENT_ID,
    logout_uri: logoutUri,
  });

  return `${getCognitoUrl()}/logout?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<AuthTokens> {
  const tokenEndpoint = `${getCognitoUrl()}/oauth2/token`;

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: COGNITO_CLIENT_ID,
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('Token exchange failed:', error);
    throw new Error(error.error_description || error.error || 'Token exchange failed');
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  const tokenEndpoint = `${getCognitoUrl()}/oauth2/token`;

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: COGNITO_CLIENT_ID,
    refresh_token: refreshToken,
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: refreshToken, // Cognito doesn't return new refresh token
    expiresIn: data.expires_in,
  };
}

/**
 * Decode JWT token (without verification - for client-side use only)
 */
export function decodeJwt(token: string): Record<string, unknown> {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) throw new Error('Invalid token');

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    throw new Error('Failed to decode token');
  }
}

/**
 * Extract user info from ID token
 */
export function getUserFromIdToken(idToken: string): AuthUser {
  const payload = decodeJwt(idToken);
  return {
    sub: payload.sub as string,
    email: payload.email as string,
    email_verified: payload.email_verified as boolean,
    name: payload.name as string | undefined,
    'custom:tenant_id': payload['custom:tenant_id'] as string | undefined,
  };
}

/**
 * Check if token is expired
 */
export function isTokenExpired(expiryTime: number): boolean {
  // Add 5 minute buffer
  return Date.now() >= (expiryTime - 5 * 60 * 1000);
}

// ============================================
// Browser Storage Functions
// ============================================

/**
 * Save tokens to localStorage
 */
export function saveTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
  localStorage.setItem(STORAGE_KEYS.ID_TOKEN, tokens.idToken);
  if (tokens.refreshToken) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
  }

  const expiryTime = Date.now() + tokens.expiresIn * 1000;
  localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());

  // Save user info
  try {
    const user = getUserFromIdToken(tokens.idToken);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  } catch (e) {
    console.error('Failed to save user info:', e);
  }
}

/**
 * Get tokens from localStorage
 */
export function getStoredTokens(): { tokens: AuthTokens | null; user: AuthUser | null } {
  if (typeof window === 'undefined') {
    return { tokens: null, user: null };
  }

  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const idToken = localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  const expiryStr = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
  const userStr = localStorage.getItem(STORAGE_KEYS.USER);

  if (!accessToken || !idToken) {
    return { tokens: null, user: null };
  }

  const tokens: AuthTokens = {
    accessToken,
    idToken,
    refreshToken: refreshToken || undefined,
    expiresIn: expiryStr ? Math.floor((parseInt(expiryStr) - Date.now()) / 1000) : 0,
  };

  let user: AuthUser | null = null;
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch {
      // Ignore parse error
    }
  }

  return { tokens, user };
}

/**
 * Clear all stored tokens
 */
export function clearTokens(): void {
  if (typeof window === 'undefined') return;

  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
}

/**
 * Get current access token, refreshing if needed
 */
export async function getValidAccessToken(): Promise<string | null> {
  const { tokens } = getStoredTokens();

  if (!tokens) {
    return null;
  }

  const expiryStr = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
  const expiryTime = expiryStr ? parseInt(expiryStr) : 0;

  // If token is not expired, return it
  if (!isTokenExpired(expiryTime)) {
    return tokens.accessToken;
  }

  // Try to refresh
  if (tokens.refreshToken) {
    try {
      const newTokens = await refreshAccessToken(tokens.refreshToken);
      saveTokens(newTokens);
      return newTokens.accessToken;
    } catch {
      // Refresh failed, clear tokens
      clearTokens();
      return null;
    }
  }

  // No refresh token available
  clearTokens();
  return null;
}
