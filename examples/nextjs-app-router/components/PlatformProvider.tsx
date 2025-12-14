'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  AuthUser,
  AuthTokens,
  getStoredTokens,
  saveTokens,
  clearTokens,
  getLoginUrl,
  getLogoutUrl,
  getValidAccessToken,
} from '@/lib/auth';
import { Entitlement, getEntitlement } from '@/lib/api';

interface PlatformContextType {
  // Auth state
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Entitlement state
  entitlement: Entitlement | null;
  entitlementLoading: boolean;

  // Actions
  login: (redirectTo?: string) => void;
  logout: () => void;
  refreshEntitlement: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;

  // Token management (for auth callback)
  handleAuthCallback: (tokens: AuthTokens) => void;
}

const PlatformContext = createContext<PlatformContextType | null>(null);

const PRODUCT_ID = process.env.NEXT_PUBLIC_PRODUCT_ID || '';

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(false);

  // Initialize auth state from storage
  useEffect(() => {
    async function initAuth() {
      try {
        const { tokens, user: storedUser } = getStoredTokens();

        if (tokens && storedUser) {
          // Try to get valid access token (will refresh if needed)
          const validToken = await getValidAccessToken();

          if (validToken) {
            setUser(storedUser);
            setAccessToken(validToken);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        clearTokens();
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  // Fetch entitlement when authenticated
  useEffect(() => {
    async function fetchEntitlement() {
      if (!accessToken || !PRODUCT_ID) {
        setEntitlement(null);
        return;
      }

      setEntitlementLoading(true);
      try {
        const ent = await getEntitlement(PRODUCT_ID, accessToken);
        setEntitlement(ent);
      } catch (error) {
        console.error('Failed to fetch entitlement:', error);
        setEntitlement(null);
      } finally {
        setEntitlementLoading(false);
      }
    }

    fetchEntitlement();
  }, [accessToken]);

  // Login - redirect to Cognito Hosted UI
  const login = useCallback((redirectTo?: string) => {
    if (typeof window === 'undefined') return;

    const callbackUrl = `${window.location.origin}/auth/callback`;
    const state = redirectTo || window.location.pathname;
    const loginUrl = getLoginUrl(callbackUrl, state);

    window.location.href = loginUrl;
  }, []);

  // Logout - clear tokens and redirect to Cognito logout
  const logout = useCallback(() => {
    if (typeof window === 'undefined') return;

    clearTokens();
    setUser(null);
    setAccessToken(null);
    setEntitlement(null);

    const logoutUrl = getLogoutUrl(window.location.origin);
    window.location.href = logoutUrl;
  }, []);

  // Handle auth callback - save tokens from OAuth callback
  const handleAuthCallback = useCallback((tokens: AuthTokens) => {
    saveTokens(tokens);
    const { user: newUser } = getStoredTokens();
    setUser(newUser);
    setAccessToken(tokens.accessToken);
  }, []);

  // Get valid access token
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const token = await getValidAccessToken();
    if (token !== accessToken) {
      setAccessToken(token);
    }
    return token;
  }, [accessToken]);

  // Refresh entitlement
  const refreshEntitlement = useCallback(async () => {
    if (!accessToken || !PRODUCT_ID) return;

    setEntitlementLoading(true);
    try {
      const token = await getValidAccessToken();
      if (token) {
        const ent = await getEntitlement(PRODUCT_ID, token);
        setEntitlement(ent);
      }
    } catch (error) {
      console.error('Failed to refresh entitlement:', error);
    } finally {
      setEntitlementLoading(false);
    }
  }, [accessToken]);

  const value: PlatformContextType = {
    user,
    accessToken,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    entitlement,
    entitlementLoading,
    login,
    logout,
    refreshEntitlement,
    getAccessToken,
    handleAuthCallback,
  };

  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error('usePlatform must be used within a PlatformProvider');
  }
  return context;
}
