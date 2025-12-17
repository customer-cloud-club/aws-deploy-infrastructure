'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { deleteUserAccount, signInUser } from '@/lib/auth';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [userEmail, setUserEmail] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'password' | 'deleting'>('confirm');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadUserAttributes() {
      try {
        const attributes = await fetchUserAttributes();
        setUserEmail(attributes.email || '');
      } catch (err) {
        console.error('Failed to fetch user attributes:', err);
      }
    }
    if (user) {
      loadUserAttributes();
    }
  }, [user]);

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
    setDeleteStep('confirm');
    setError('');
    setPassword('');
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteStep('confirm');
    setError('');
    setPassword('');
  };

  const handleConfirmDelete = () => {
    setDeleteStep('password');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsDeleting(true);

    try {
      // Verify password by attempting to sign in
      if (!userEmail) {
        throw new Error('ユーザー情報が取得できません');
      }

      await signInUser(userEmail, password);

      // If sign in succeeds, proceed with deletion
      setDeleteStep('deleting');
      await deleteUserAccount();

      // Logout and redirect to login page
      await logout();
      router.push('/login');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Account deletion error:', error);
      if (error.name === 'NotAuthorizedException') {
        setError('パスワードが正しくありません');
      } else {
        setError(error.message || 'アカウントの削除に失敗しました');
      }
      setDeleteStep('password');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">設定</h1>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>アカウント情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                メールアドレス
              </label>
              <p className="mt-1 text-gray-900 dark:text-white">
                {userEmail || '-'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                ユーザーID
              </label>
              <p className="mt-1 text-gray-900 dark:text-white font-mono text-sm">
                {user?.userId || '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400">危険な操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  アカウントを削除
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  アカウントを削除すると、すべてのデータが完全に削除されます。この操作は取り消せません。
                </p>
              </div>
              <Button
                variant="danger"
                onClick={handleDeleteClick}
                disabled={showDeleteConfirm}
              >
                アカウントを削除
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            {deleteStep === 'confirm' && (
              <>
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 mx-auto mb-4">
                  <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white text-center mb-2">
                  本当にアカウントを削除しますか？
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
                  この操作は取り消すことができません。アカウントに関連するすべてのデータが完全に削除されます。
                </p>
                <div className="flex space-x-3">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={handleCancelDelete}
                  >
                    キャンセル
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={handleConfirmDelete}
                  >
                    削除を続ける
                  </Button>
                </div>
              </>
            )}

            {deleteStep === 'password' && (
              <>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white text-center mb-2">
                  パスワードを入力
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
                  本人確認のため、パスワードを入力してください
                </p>
                <form onSubmit={handlePasswordSubmit}>
                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 p-3 rounded-md text-sm mb-4">
                      {error}
                    </div>
                  )}
                  <div className="mb-4">
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="パスワード"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="flex space-x-3">
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1"
                      onClick={handleCancelDelete}
                      disabled={isDeleting}
                    >
                      キャンセル
                    </Button>
                    <Button
                      type="submit"
                      variant="danger"
                      className="flex-1"
                      disabled={isDeleting || !password}
                    >
                      {isDeleting ? '削除中...' : 'アカウントを削除'}
                    </Button>
                  </div>
                </form>
              </>
            )}

            {deleteStep === 'deleting' && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">
                  アカウントを削除しています...
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
