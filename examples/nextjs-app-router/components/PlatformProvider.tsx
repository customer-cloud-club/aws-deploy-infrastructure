'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  initializePlatformSDK,
  PlatformSDK,
  AuthUser,
  Entitlement,
  getLoginUrl,
  getLogoutUrl,
} from '@/lib/platform';

interface PlatformContextType {
  user: AuthUser | null;
  entitlement: Entitlement | null;
  loading: boolean;
  error: string | null;
  login: (redirectTo?: string) => void;
  logout: () => void;
  refreshEntitlement: () => Promise<void>;
}

const PlatformContext = createContext<PlatformContextType | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializePlatformSDK();
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      setLoading(true);
      setError(null);

      const authState = PlatformSDK.getAuthState();
      if (authState) {
        setUser(authState);

        // Fetch entitlement
        try {
          const ent = await PlatformSDK.getEntitlement();
          setEntitlement(ent);
        } catch (entError) {
          console.error('Failed to fetch entitlement:', entError);
          // User is authenticated but has no entitlement
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setError('Failed to check authentication');
    } finally {
      setLoading(false);
    }
  }

  function login(redirectTo?: string) {
    const loginUrl = getLoginUrl(redirectTo);
    window.location.href = loginUrl;
  }

  function logout() {
    PlatformSDK.logout();
    setUser(null);
    setEntitlement(null);
    window.location.href = getLogoutUrl();
  }

  async function refreshEntitlement() {
    if (!user) return;

    try {
      PlatformSDK.clearCache();
      const ent = await PlatformSDK.getEntitlement(true);
      setEntitlement(ent);
    } catch (err) {
      console.error('Failed to refresh entitlement:', err);
    }
  }

  return (
    <PlatformContext.Provider
      value={{
        user,
        entitlement,
        loading,
        error,
        login,
        logout,
        refreshEntitlement,
      }}
    >
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
