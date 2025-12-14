'use client';

import Link from 'next/link';
import { usePlatform } from './PlatformProvider';

export function Header() {
  const { user, entitlement, isLoading, login, logout, isAuthenticated } = usePlatform();

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-gray-900">
              Platform Demo
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex items-center space-x-4">
            <Link href="/plans" className="text-gray-600 hover:text-gray-900">
              プラン
            </Link>

            {isAuthenticated ? (
              <>
                <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                  ダッシュボード
                </Link>

                {/* User Info */}
                <div className="flex items-center space-x-3">
                  {entitlement && (
                    <span className="text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      {entitlement.plan_id}
                    </span>
                  )}
                  <span className="text-sm text-gray-700">
                    {user?.email}
                  </span>
                  <button
                    onClick={logout}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    ログアウト
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => login()}
                disabled={isLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? '読み込み中...' : 'ログイン'}
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
