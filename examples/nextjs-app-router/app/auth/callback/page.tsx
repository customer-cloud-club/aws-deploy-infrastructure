'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { exchangeCodeForTokens } from '@/lib/auth';
import { usePlatform } from '@/components/PlatformProvider';

type CallbackStatus = 'processing' | 'success' | 'error';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handleAuthCallback } = usePlatform();

  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function processCallback() {
      // Get code and state from URL
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Check for OAuth errors
      if (error) {
        setStatus('error');
        setErrorMessage(errorDescription || error);
        return;
      }

      // Check for authorization code
      if (!code) {
        setStatus('error');
        setErrorMessage('No authorization code received');
        return;
      }

      try {
        // Build redirect URI (must match what was sent to Cognito)
        const redirectUri = `${window.location.origin}/auth/callback`;

        // Exchange code for tokens
        console.log('Exchanging code for tokens...');
        const tokens = await exchangeCodeForTokens(code, redirectUri);

        // Save tokens via provider
        handleAuthCallback(tokens);

        setStatus('success');

        // Redirect to original destination or dashboard
        const redirectTo = state || '/dashboard';
        setTimeout(() => {
          router.push(redirectTo);
        }, 1000);
      } catch (err) {
        console.error('Token exchange error:', err);
        setStatus('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to exchange authorization code'
        );
      }
    }

    processCallback();
  }, [searchParams, router, handleAuthCallback]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md p-8">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              ログイン処理中...
            </h2>
            <p className="text-gray-600">
              認証情報を確認しています
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-green-500 mb-4">
              <svg
                className="h-12 w-12 mx-auto"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              ログイン成功
            </h2>
            <p className="text-gray-600">
              リダイレクトしています...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-red-500 mb-4">
              <svg
                className="h-12 w-12 mx-auto"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              ログインに失敗しました
            </h2>
            <p className="text-red-600 text-sm mb-4">
              {errorMessage}
            </p>
            <button
              onClick={() => router.push('/')}
              className="text-blue-600 hover:underline"
            >
              ホームに戻る
            </button>
          </>
        )}
      </div>
    </div>
  );
}
