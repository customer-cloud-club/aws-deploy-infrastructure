'use client'

import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider } from '@/lib/auth-provider'
import { I18nProvider } from '@/lib/i18n-provider'

/**
 * Root Providers Component
 *
 * Wraps the application with necessary context providers:
 * - Theme (dark mode)
 * - Authentication (Cognito)
 * - Internationalization (i18next)
 * - Toast notifications
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <I18nProvider>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}
