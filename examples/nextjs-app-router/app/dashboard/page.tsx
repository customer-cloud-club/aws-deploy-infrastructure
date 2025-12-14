'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePlatform } from '@/components/PlatformProvider';
import { FeatureGate, UsageLimitGate } from '@/components/FeatureGate';
import { recordUsage } from '@/lib/api';
import Link from 'next/link';

const PRODUCT_ID = process.env.NEXT_PUBLIC_PRODUCT_ID || '';

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, isAuthenticated, entitlement, entitlementLoading, refreshEntitlement, getAccessToken } = usePlatform();
  const [recording, setRecording] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  // Check for checkout result
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      setCheckoutMessage('サブスクリプションが正常に完了しました！');
      // Refresh entitlement to get updated plan
      refreshEntitlement();
    } else if (checkout === 'cancelled') {
      setCheckoutMessage('チェックアウトがキャンセルされました。');
    }
  }, [searchParams, refreshEntitlement]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  // Record usage example
  async function handleRecordUsage() {
    setRecording(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        alert('認証が必要です');
        return;
      }

      await recordUsage(
        PRODUCT_ID,
        { type: 'api_call', amount: 1 },
        token
      );
      await refreshEntitlement();
      alert('使用量を記録しました！');
    } catch (error) {
      console.error('Failed to record usage:', error);
      alert('使用量の記録に失敗しました');
    } finally {
      setRecording(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="px-4 py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ダッシュボード</h1>

      {/* Checkout Result Message */}
      {checkoutMessage && (
        <div className={`mb-6 p-4 rounded-lg ${
          searchParams.get('checkout') === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
        }`}>
          <p>{checkoutMessage}</p>
          <button
            onClick={() => setCheckoutMessage(null)}
            className="text-sm underline mt-2"
          >
            閉じる
          </button>
        </div>
      )}

      {/* User Info */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">ユーザー情報</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">メールアドレス</dt>
            <dd className="text-sm font-medium text-gray-900">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">ユーザーID</dt>
            <dd className="text-sm font-medium text-gray-900 font-mono text-xs">{user?.sub}</dd>
          </div>
        </dl>
      </div>

      {/* Entitlement Info */}
      {entitlementLoading ? (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      ) : entitlement ? (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">現在のプラン</h2>
            <Link
              href="/plans"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              プラン変更
            </Link>
          </div>
          <div className="mb-4">
            <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {entitlement.plan_name || entitlement.plan_id}
            </span>
            {entitlement.price_amount !== undefined && (
              <span className="ml-2 inline-block text-sm text-gray-600">
                ¥{entitlement.price_amount.toLocaleString()}/{entitlement.billing_period === 'monthly' ? '月' : entitlement.billing_period === 'yearly' ? '年' : '回'}
              </span>
            )}
            <span className={`ml-2 inline-block px-3 py-1 rounded-full text-sm font-medium ${
              entitlement.status === 'active'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {entitlement.status === 'active' ? 'アクティブ' : entitlement.status}
            </span>
          </div>

          {/* Usage Stats */}
          <h3 className="text-md font-medium text-gray-700 mb-3">利用状況</h3>
          <div className="bg-gray-50 p-4 rounded mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">
                使用量: {(entitlement.usage?.used ?? 0).toLocaleString()} / {(entitlement.usage?.limit ?? 0).toLocaleString()}
              </span>
              <span className="text-sm text-gray-500">
                残り: {(entitlement.usage?.remaining ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  entitlement.over_limit
                    ? 'bg-red-500'
                    : entitlement.over_soft_limit
                    ? 'bg-yellow-500'
                    : 'bg-blue-500'
                }`}
                style={{
                  width: `${Math.min(100, entitlement.usage?.limit ? ((entitlement.usage?.used ?? 0) / entitlement.usage.limit) * 100 : 0)}%`,
                }}
              ></div>
            </div>
            {entitlement.over_soft_limit && !entitlement.over_limit && (
              <p className="text-sm text-yellow-600 mt-2">
                ソフトリミットに近づいています
              </p>
            )}
            {entitlement.over_limit && (
              <p className="text-sm text-red-600 mt-2">
                使用量が上限に達しました
              </p>
            )}
          </div>

          {/* Features */}
          {Object.keys(entitlement.features).length > 0 && (
            <>
              <h3 className="text-md font-medium text-gray-700 mt-6 mb-3">機能</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(entitlement.features).map(([feature, value]) => (
                  <span
                    key={feature}
                    className={`px-3 py-1 rounded-full text-sm ${
                      value
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {feature.replace(/_/g, ' ')}: {String(value)}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Valid Until */}
          {entitlement.valid_until && (
            <div className="mt-4 text-sm text-gray-500">
              有効期限: {new Date(entitlement.valid_until).toLocaleDateString('ja-JP')}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">プラン未登録</h2>
          <p className="text-yellow-700 mb-4">
            現在アクティブなサブスクリプションがありません。プランを選択して開始してください。
          </p>
          <Link
            href="/plans"
            className="inline-block bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
          >
            プランを見る
          </Link>
        </div>
      )}

      {/* Feature Gate Examples */}
      {entitlement && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">機能ゲートの例</h2>

          {/* Premium Feature */}
          <FeatureGate
            feature="premium_feature"
            fallback={
              <div className="p-4 bg-gray-100 rounded mb-4">
                <p className="text-gray-600">
                  プレミアム機能はこのプランでは利用できません。
                  <Link href="/plans" className="text-blue-600 ml-1">アップグレード</Link>
                </p>
              </div>
            }
          >
            <div className="p-4 bg-green-100 rounded mb-4">
              <p className="text-green-800">
                プレミアム機能が利用可能です！
              </p>
            </div>
          </FeatureGate>

          {/* Usage Limit Gate */}
          <UsageLimitGate
            fallback={
              <div className="p-4 bg-red-100 rounded">
                <p className="text-red-800">
                  API利用上限に達しました。
                  <Link href="/plans" className="text-blue-600 ml-1">アップグレード</Link>
                </p>
              </div>
            }
          >
            <div className="p-4 bg-blue-50 rounded">
              <p className="text-blue-800 mb-3">
                APIコールが可能です！
              </p>
              <button
                onClick={handleRecordUsage}
                disabled={recording}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {recording ? '記録中...' : '使用量を記録 (+1 APIコール)'}
              </button>
            </div>
          </UsageLimitGate>
        </div>
      )}
    </div>
  );
}
