'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInUser } from '@/lib/auth';
import { useAuth } from '@/components/providers/AuthProvider';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function LoginPage() {
  const router = useRouter();
  const { checkAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signInUser(email, password);

      if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        setNeedsNewPassword(true);
        setIsLoading(false);
        return;
      }

      if (result.isSignedIn) {
        await checkAuth();
        router.push('/');
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Login error:', error);
      if (error.name === 'NotAuthorizedException') {
        setError('メールアドレスまたはパスワードが正しくありません');
      } else if (error.name === 'UserNotFoundException') {
        setError('ユーザーが見つかりません');
      } else {
        setError(error.message || 'ログインに失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { confirmSignIn } = await import('aws-amplify/auth');
      const result = await confirmSignIn({
        challengeResponse: newPassword,
      });

      if (result.isSignedIn) {
        await checkAuth();
        router.push('/');
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('New password error:', error);
      setError(error.message || '新しいパスワードの設定に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (needsNewPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
              新しいパスワードを設定
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              初回ログインのため、新しいパスワードを設定してください
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleNewPasswordSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                新しいパスワード
              </label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8文字以上、大文字・小文字・数字を含む"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? '設定中...' : 'パスワードを設定'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            管理コンソール
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            認証基盤管理システムにログイン
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                メールアドレス
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                パスワード
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワード"
              />
            </div>
          </div>
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'ログイン中...' : 'ログイン'}
          </Button>
        </form>
      </div>
    </div>
  );
}
