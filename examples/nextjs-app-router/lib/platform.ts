/**
 * Platform SDK Helper Functions
 */

import { PlatformSDK, AuthUser, Entitlement, Plan } from '@customer-cloud-club/platform-sdk';

// SDK initialization (called once in provider)
export function initializePlatformSDK() {
  if (typeof window === 'undefined') return;

  if (!PlatformSDK.isInitialized()) {
    PlatformSDK.init({
      productId: process.env.NEXT_PUBLIC_PLATFORM_PRODUCT_ID!,
      apiUrl: process.env.NEXT_PUBLIC_PLATFORM_API_URL!,
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
      clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
    });
  }
}

// Build Cognito login URL
export function getLoginUrl(redirectTo?: string): string {
  const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/auth/callback`
    : '';

  const state = redirectTo ? encodeURIComponent(redirectTo) : '';

  return `https://${domain}/login?` +
    `client_id=${clientId}&` +
    `response_type=code&` +
    `scope=openid+email+profile&` +
    `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
    `state=${state}`;
}

// Build Cognito logout URL
export function getLogoutUrl(): string {
  const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  const logoutUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/`
    : '';

  return `https://${domain}/logout?` +
    `client_id=${clientId}&` +
    `logout_uri=${encodeURIComponent(logoutUrl)}`;
}

// Format price for display
export function formatPrice(price: number, cycle: string): string {
  const formattedPrice = price.toLocaleString('ja-JP');
  const cycleLabel = cycle === 'monthly' ? '/月' : cycle === 'yearly' ? '/年' : '';
  return `¥${formattedPrice}${cycleLabel}`;
}

// Format usage remaining
export function formatRemaining(remaining: number): string {
  if (remaining === Infinity) return '無制限';
  return remaining.toLocaleString();
}

export { PlatformSDK };
export type { AuthUser, Entitlement, Plan };
