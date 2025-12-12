'use client';

import React, { useEffect } from 'react';
import { Inter } from 'next/font/google';
import '@radix-ui/themes/styles.css';
import './globals.css';
import { Theme } from '@radix-ui/themes';
import { useStore } from '@/lib/store';
import { configureAmplify } from '@/lib/auth';
import '@/lib/i18n';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useStore();

  useEffect(() => {
    // Configure AWS Amplify on mount
    configureAmplify();

    // Apply theme class to HTML element
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <html lang="ja" className={theme}>
      <body className={inter.className}>
        <Theme appearance={theme}>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
              <Header />
              <main className="flex-1 overflow-y-auto p-6 bg-background">
                {children}
              </main>
            </div>
          </div>
        </Theme>
      </body>
    </html>
  );
}
