'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { requestPasswordReset, confirmPasswordReset } from '@/lib/auth';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type Step = 'request' | 'confirm' | 'success';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await requestPasswordReset(email);
      setStep('confirm');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Password reset request error:', error);
      if (error.name === 'UserNotFoundException') {
        setError('このメールアドレスは登録されていません');
      } else if (error.name === 'LimitExceededException') {
        setError('リクエスト回数の上限に達しました。しばらく待ってから再試行してください');
      } else {
        setError(error.message || 'パスワードリセットのリクエストに失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (newPassword.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }

    setIsLoading(true);

    try {
      await confirmPasswordReset(email, confirmationCode, newPassword);
      setStep('success');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Password reset confirmation error:', error);
      if (error.name === 'CodeMismatchException') {
        setError('確認コードが正しくありません');
      } else if (error.name === 'ExpiredCodeException') {
        setError('確認コードの有効期限が切れています。再度リクエストしてください');
      } else if (error.name === 'InvalidPasswordException') {
        setError('パスワードの要件を満たしていません（8文字以上、大文字・小文字・数字を含む）');
      } else {
        setError(error.message || 'パスワードのリセットに失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setIsLoading(true);

    try {
      await requestPasswordReset(email);
      setError('');
      alert('確認コードを再送信しました');
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || '確認コードの再送信に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
              <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
              パスワードをリセットしました
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              新しいパスワードでログインできます
            </p>
          </div>
          <div className="mt-6">
            <Button
              variant="primary"
              className="w-full"
              onClick={() => router.push('/login')}
            >
              ログイン画面へ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
              新しいパスワードを設定
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              {email} に送信された確認コードと新しいパスワードを入力してください
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleConfirmReset}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label htmlFor="confirmationCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  確認コード
                </label>
                <Input
                  id="confirmationCode"
                  name="confirmationCode"
                  type="text"
                  required
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value)}
                  placeholder="123456"
                  autoComplete="one-time-code"
                />
              </div>
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
                  placeholder="8文字以上"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  パスワード（確認）
                </label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="パスワードを再入力"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'リセット中...' : 'パスワードをリセット'}
              </Button>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading}
                className="w-full text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 disabled:opacity-50"
              >
                確認コードを再送信
              </button>
            </div>
          </form>
          <div className="text-center">
            <button
              onClick={() => setStep('request')}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-500"
            >
              メールアドレスを変更
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            パスワードをリセット
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            登録済みのメールアドレスに確認コードを送信します
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleRequestReset}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
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
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? '送信中...' : '確認コードを送信'}
          </Button>
        </form>
        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
          >
            ログイン画面に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
