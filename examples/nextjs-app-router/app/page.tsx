'use client';

import Link from 'next/link';
import { usePlatform } from '@/components/PlatformProvider';

export default function HomePage() {
  const { user, login } = usePlatform();

  return (
    <div className="px-4">
      {/* Hero Section */}
      <div className="text-center py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          認証・課金プラットフォーム デモ
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Next.js App Router と Cognito 認証、Stripe 課金、
          エンタイトルメント管理の統合デモアプリケーションです。
        </p>

        {user ? (
          <div className="space-x-4">
            <Link
              href="/dashboard"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
            >
              ダッシュボードへ
            </Link>
            <Link
              href="/plans"
              className="inline-block bg-white text-blue-600 border border-blue-600 px-6 py-3 rounded-md hover:bg-blue-50"
            >
              プランを見る
            </Link>
          </div>
        ) : (
          <div className="space-x-4">
            <button
              onClick={() => login()}
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
            >
              はじめる
            </button>
            <Link
              href="/plans"
              className="inline-block bg-white text-blue-600 border border-blue-600 px-6 py-3 rounded-md hover:bg-blue-50"
            >
              プランを見る
            </Link>
          </div>
        )}
      </div>

      {/* Features Section */}
      <div className="py-12">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          主な機能
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              認証
            </h3>
            <p className="text-gray-600">
              Cognito Hosted UI によるOAuth認証。自動トークン管理とリフレッシュ。
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              エンタイトルメント
            </h3>
            <p className="text-gray-600">
              サブスクリプションプランに基づく機能フラグと使用量制限。
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              使用量トラッキング
            </h3>
            <p className="text-gray-600">
              従量課金機能のリアルタイム使用量記録とリミットチェック。
            </p>
          </div>
        </div>
      </div>

      {/* Code Example */}
      <div className="py-12">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          クイックコード例
        </h2>
        <div className="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto">
          <pre className="text-sm">
{`// PlatformProvider でラップして認証状態を管理
import { usePlatform } from '@/components/PlatformProvider';
import { FeatureGate, UsageLimitGate } from '@/components/FeatureGate';
import { recordUsage, getEntitlement } from '@/lib/api';

function MyComponent() {
  const { user, isAuthenticated, entitlement, getAccessToken } = usePlatform();

  // 認証チェック
  if (!isAuthenticated) {
    return <LoginButton />;
  }

  // 機能ゲート - プレミアム機能のアクセス制御
  return (
    <FeatureGate feature="premium_feature" fallback={<UpgradePrompt />}>
      <PremiumContent />
    </FeatureGate>
  );
}

// 使用量を記録
async function trackApiCall() {
  const token = await getAccessToken();
  await recordUsage(PRODUCT_ID, { type: 'api_call', amount: 1 }, token);
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
