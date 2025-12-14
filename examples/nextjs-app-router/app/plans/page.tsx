'use client';

import { useEffect, useState } from 'react';
import { PlatformSDK, Plan, formatPrice } from '@/lib/platform';
import { usePlatform } from '@/components/PlatformProvider';

export default function PlansPage() {
  const { user, entitlement, login } = usePlatform();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const fetchedPlans = await PlatformSDK.getPlans();
        setPlans(fetchedPlans);
      } catch (err) {
        console.error('Failed to fetch plans:', err);
        setError('Failed to load plans');
      } finally {
        setLoading(false);
      }
    }

    fetchPlans();
  }, []);

  async function handleSelectPlan(plan: Plan) {
    if (!user) {
      login('/plans');
      return;
    }

    // In a real app, this would redirect to Stripe Checkout
    // For demo purposes, we'll just show an alert
    alert(`Would redirect to checkout for plan: ${plan.name}`);

    // Example checkout implementation:
    // const token = await PlatformSDK.getAccessToken();
    // const response = await fetch(`${apiUrl}/checkout`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${token}`,
    //   },
    //   body: JSON.stringify({
    //     plan_id: plan.id,
    //     product_id: process.env.NEXT_PUBLIC_PLATFORM_PRODUCT_ID,
    //     success_url: `${window.location.origin}/dashboard?success=true`,
    //     cancel_url: `${window.location.origin}/plans`,
    //   }),
    // });
    // const { url } = await response.json();
    // window.location.href = url;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading plans...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Choose Your Plan
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Select the plan that best fits your needs. All plans include a 14-day free trial.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {plans.map((plan) => {
          const isCurrentPlan = entitlement?.planId === plan.id;

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-lg shadow-lg overflow-hidden ${
                isCurrentPlan ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              {/* Plan Header */}
              <div className="px-6 py-8 bg-gray-50 border-b">
                <h2 className="text-2xl font-bold text-gray-900">{plan.name}</h2>
                {plan.description && (
                  <p className="mt-2 text-gray-600">{plan.description}</p>
                )}
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">
                    {formatPrice(plan.price, plan.billingCycle)}
                  </span>
                </div>
              </div>

              {/* Features */}
              <div className="px-6 py-6">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
                  Features
                </h3>
                <ul className="space-y-3">
                  {Object.entries(plan.features).map(([feature, value]) => (
                    <li key={feature} className="flex items-start">
                      <svg
                        className={`h-5 w-5 mr-2 ${
                          value ? 'text-green-500' : 'text-gray-400'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        {value ? (
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
                      <span className={value ? 'text-gray-900' : 'text-gray-500'}>
                        {feature.replace(/_/g, ' ')}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Limits */}
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mt-6 mb-4">
                  Limits
                </h3>
                <ul className="space-y-2 text-sm">
                  {plan.limits.apiCalls && (
                    <li className="text-gray-600">
                      API Calls: {plan.limits.apiCalls === -1 ? 'Unlimited' : plan.limits.apiCalls.toLocaleString()}/month
                    </li>
                  )}
                  {plan.limits.generations && (
                    <li className="text-gray-600">
                      Generations: {plan.limits.generations === -1 ? 'Unlimited' : plan.limits.generations.toLocaleString()}/month
                    </li>
                  )}
                  {plan.limits.storage && (
                    <li className="text-gray-600">
                      Storage: {plan.limits.storage === -1 ? 'Unlimited' : `${plan.limits.storage} MB`}
                    </li>
                  )}
                </ul>
              </div>

              {/* CTA Button */}
              <div className="px-6 pb-8">
                {isCurrentPlan ? (
                  <button
                    disabled
                    className="w-full bg-gray-200 text-gray-600 py-3 rounded-md cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition"
                  >
                    {user ? 'Select Plan' : 'Sign Up'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ or additional info */}
      <div className="mt-16 text-center text-gray-600">
        <p>
          Questions? Contact us at{' '}
          <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
            support@example.com
          </a>
        </p>
      </div>
    </div>
  );
}
