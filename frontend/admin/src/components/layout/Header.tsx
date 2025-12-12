'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/lib/store';
import { signOutUser } from '@/lib/auth';
import Button from '@/components/ui/Button';

const Header: React.FC = () => {
  const { t } = useTranslation('common');
  const { user, theme, setTheme } = useStore();

  const handleSignOut = async () => {
    try {
      await signOutUser();
      window.location.href = '/login';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <header className="sticky top-0 z-10 h-16 bg-background border-b">
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center gap-4">
          <input
            type="search"
            placeholder={t('common.search')}
            className="w-64 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-accent"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>

          <div className="flex items-center gap-3">
            <div className="text-sm text-right">
              <p className="font-medium">{user?.name || 'Admin User'}</p>
              <p className="text-muted-foreground">{user?.email || 'admin@example.com'}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              {t('auth.signOut')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
