'use client';

import React, { useEffect } from 'react';
import { Inter } from 'next/font/google';
import { usePathname, useRouter } from 'next/navigation';
import '@radix-ui/themes/styles.css';
import './globals.css';
import { Theme } from '@radix-ui/themes';
import { useStore } from '@/lib/store';
import '@/lib/i18n';
import { AuthProvider, useAuth } from '@/components/providers/AuthProvider';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

function AppContent({ children }: { children: React.ReactNode }) {
  const { isLoading, isLoggedIn } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login' || pathname === '/login/';

  useEffect(() => {
    if (!isLoading && !isLoggedIn && !isLoginPage) {
      router.push('/login');
    }
  }, [isLoading, isLoggedIn, isLoginPage, router]);

  useEffect(() => {
    if (!isLoading && isLoggedIn && isLoginPage) {
      router.push('/');
    }
  }, [isLoading, isLoggedIn, isLoginPage, router]);

  // Login page should always be shown immediately
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-64">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <html lang="ja" className={theme}>
      <body className={inter.className}>
        <Theme appearance={theme}>
          <AuthProvider>
            <AppContent>{children}</AppContent>
          </AuthProvider>
        </Theme>
      </body>
    </html>
  );
}
