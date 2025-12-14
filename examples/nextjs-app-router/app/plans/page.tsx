'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/components/PlatformProvider';
import { Plan, getPlans, createCheckoutSession, updateSubscription } from '@/lib/api';

const PRODUCT_ID = process.env.NEXT_PUBLIC_PRODUCT_ID || '';

/**
 * Format price for display
 */
function formatPrice(amount: number, currency: string, period: string): string {
  const formatted = new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount);

  const periodLabel = period === 'monthly' ? '/月' : period === 'yearly' ? '/年' : '';
  return `${formatted}${periodLabel}`;
}

export default function PlansPage() {
  const router = useRouter();
  const { user, accessToken, entitlement, login, getAccessToken, refreshEntitlement } = usePlatform();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);

  // Fetch plans on mount
  useEffect(() => {
    async function fetchPlans() {
      if (!PRODUCT_ID) {
        setError('Product ID is not configured');
        setLoading(false);
        return;
      }

      try {
        const fetchedPlans = await getPlans(PRODUCT_ID);
        // Filter to only active plans
        setPlans(fetchedPlans.filter((p) => p.is_active));
      } catch (err) {
        console.error('Failed to fetch plans:', err);
        setError('プランの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    }

    fetchPlans();
  }, []);

  /**
   * Get the current plan's price amount
   */
  function getCurrentPlanPrice(): number {
    if (!entitlement?.plan_id) return 0;
    const currentPlan = plans.find(p => p.id === entitlement.plan_id);
    return currentPlan?.price_amount ?? 0;
  }

  /**
   * Determine if this is an upgrade, downgrade, or new subscription
   */
  function getPlanAction(plan: Plan): 'upgrade' | 'downgrade' | 'subscribe' {
    if (!entitlement?.plan_id) return 'subscribe';
    const currentPrice = getCurrentPlanPrice();
    if (plan.price_amount > currentPrice) return 'upgrade';
    if (plan.price_amount < currentPrice) return 'downgrade';
    return 'subscribe';
  }

  /**
   * Handle plan selection - create Stripe Checkout or update subscription
   */
  async function handleSelectPlan(plan: Plan) {
    // If not logged in, redirect to login
    if (!user) {
      login('/plans');
      return;
    }

    setProcessingPlanId(plan.id);
    setError(null);
    setSuccessMessage(null);

    try {
      // Get fresh access token
      const token = await getAccessToken();
      if (!token) {
        login('/plans');
        return;
      }

      const action = getPlanAction(plan);

      if (action === 'subscribe') {
        // New subscription - use Stripe Checkout
        const response = await createCheckoutSession(
          {
            plan_id: plan.stripe_price_id,
            product_id: PRODUCT_ID,
            success_url: `${window.location.origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${window.location.origin}/plans?checkout=cancelled`,
          },
          token
        );
        window.location.href = response.url;
      } else {
        // Upgrade or downgrade - use subscription update API
        const prorationBehavior = action === 'upgrade' ? 'create_prorations' : 'none';

        const response = await updateSubscription(
          {
            new_plan_id: plan.id,
            proration_behavior: prorationBehavior,
          },
          token
        );

        // Refresh entitlement to reflect new plan
        await refreshEntitlement();

        setSuccessMessage(
          action === 'upgrade'
            ? `${response.new_plan.name}プランにアップグレードしました！差額は日割りで請求されます。`
            : `${response.new_plan.name}プランにダウングレードしました。次回請求から新料金が適用されます。`
        );

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard?plan_updated=true');
        }, 2000);
      }
    } catch (err) {
      console.error('Plan change error:', err);
      setError(err instanceof Error ? err.message : 'プラン変更に失敗しました');
    } finally {
      setProcessingPlanId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">プランを読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          プランを選択
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          あなたのニーズに合ったプランをお選びください。
          いつでもアップグレード・ダウングレードが可能です。
        </p>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="max-w-md mx-auto mb-8 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 text-sm">{successMessage}</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="max-w-md mx-auto mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Plans grid */}
      {plans.length === 0 ? (
        <div className="text-center text-gray-500">
          利用可能なプランがありません
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => {
            const isCurrentPlan = entitlement?.plan_id === plan.id;
            const isProcessing = processingPlanId === plan.id;

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-lg shadow-lg overflow-hidden ${
                  isCurrentPlan ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                {/* Current plan badge */}
                {isCurrentPlan && (
                  <div className="bg-blue-500 text-white text-center text-sm py-1">
                    現在のプラン
                  </div>
                )}

                {/* Plan header */}
                <div className="px-6 py-8 bg-gray-50 border-b">
                  <h2 className="text-2xl font-bold text-gray-900">{plan.name}</h2>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900">
                      {formatPrice(plan.price_amount, plan.currency, plan.billing_period)}
                    </span>
                  </div>
                  {plan.trial_period_days && plan.trial_period_days > 0 && (
                    <p className="mt-2 text-sm text-green-600">
                      {plan.trial_period_days}日間無料トライアル
                    </p>
                  )}
                </div>

                {/* Features */}
                <div className="px-6 py-6">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
                    機能
                  </h3>
                  <ul className="space-y-3">
                    {Object.entries((plan.metadata.features || {}) as Record<string, boolean>).map(([feature, enabled]) => (
                      <li key={feature} className="flex items-start">
                        <svg
                          className={`h-5 w-5 mr-2 flex-shrink-0 ${
                            enabled ? 'text-green-500' : 'text-gray-400'
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          {enabled ? (
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          ) : (
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          )}
                        </svg>
                        <span className={enabled ? 'text-gray-900' : 'text-gray-500'}>
                          {feature.replace(/_/g, ' ')}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Usage limits */}
                  {typeof plan.metadata.usage_limit === 'number' && (
                    <>
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mt-6 mb-4">
                        利用制限
                      </h3>
                      <p className="text-sm text-gray-600">
                        月間 {plan.metadata.usage_limit.toLocaleString()} 回まで
                      </p>
                    </>
                  )}
                </div>

                {/* CTA Button */}
                <div className="px-6 pb-8">
                  {isCurrentPlan ? (
                    <button
                      disabled
                      className="w-full bg-gray-200 text-gray-600 py-3 rounded-md cursor-not-allowed"
                    >
                      現在のプラン
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isProcessing}
                      className={`w-full py-3 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed ${
                        getPlanAction(plan) === 'upgrade'
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : getPlanAction(plan) === 'downgrade'
                          ? 'bg-orange-500 text-white hover:bg-orange-600'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isProcessing ? (
                        <span className="flex items-center justify-center">
                          <svg
                            className="animate-spin h-5 w-5 mr-2"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          処理中...
                        </span>
                      ) : !user ? (
                        'サインアップして選択'
                      ) : getPlanAction(plan) === 'upgrade' ? (
                        'アップグレード'
                      ) : getPlanAction(plan) === 'downgrade' ? (
                        'ダウングレード'
                      ) : (
                        'このプランを選択'
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAQ */}
      <div className="mt-16 text-center text-gray-600">
        <p>
          ご質問がありますか？{' '}
          <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
            support@example.com
          </a>{' '}
          までお問い合わせください。
        </p>
      </div>
    </div>
  );
}
