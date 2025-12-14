'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { configureAmplify, getAuthUser, signOutUser, isAuthenticated } from '@/lib/auth';
import type { AuthUser } from 'aws-amplify/auth';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const initialized = useRef(false);

  const checkAuth = useCallback(async () => {
    console.log('[AuthProvider] Starting auth check...');
    try {
      const authenticated = await isAuthenticated();
      console.log('[AuthProvider] isAuthenticated:', authenticated);
      if (authenticated) {
        const currentUser = await getAuthUser();
        console.log('[AuthProvider] Got user:', currentUser?.username);
        setUser(currentUser);
        setIsLoggedIn(true);
      } else {
        setUser(null);
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('[AuthProvider] Auth check failed:', error);
      setUser(null);
      setIsLoggedIn(false);
    } finally {
      console.log('[AuthProvider] Setting isLoading to false');
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOutUser();
      setUser(null);
      setIsLoggedIn(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    console.log('[AuthProvider] Initializing...');

    // Configure Amplify first
    try {
      configureAmplify();
      console.log('[AuthProvider] Amplify configured');
    } catch (error) {
      console.error('[AuthProvider] Failed to configure Amplify:', error);
    }

    // Then check authentication
    checkAuth();

    // Fallback timeout to ensure loading state is cleared
    const timeout = setTimeout(() => {
      console.log('[AuthProvider] Timeout fallback - forcing isLoading to false');
      setIsLoading(false);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ user, isLoading, isLoggedIn, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
