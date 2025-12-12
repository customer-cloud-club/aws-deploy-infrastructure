'use client'

import { useEffect } from 'react'
import i18n from 'i18next'
import { initReactI18next, I18nextProvider } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

/**
 * Internationalization Provider
 *
 * Configures i18next for multi-language support.
 */

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'ja', 'zh', 'ko', 'es', 'fr', 'de', 'pt', 'ar'],
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: {
        translation: {
          common: {
            signIn: 'Sign In',
            signUp: 'Sign Up',
            signOut: 'Sign Out',
            cancel: 'Cancel',
            save: 'Save',
            loading: 'Loading...',
          },
        },
      },
      ja: {
        translation: {
          common: {
            signIn: 'ログイン',
            signUp: '新規登録',
            signOut: 'ログアウト',
            cancel: 'キャンセル',
            save: '保存',
            loading: '読み込み中...',
          },
        },
      },
    },
  })

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
