'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/components/PlatformProvider';
import { FeatureGate, UsageLimitGate } from '@/components/FeatureGate';
import { PlatformSDK, formatRemaining } from '@/lib/platform';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const { user, entitlement, loading, refreshEntitlement } = usePlatform();
  const [recording, setRecording] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [loading, user, router]);

  // Record usage example
  async function handleRecordUsage() {
    setRecording(true);
    try {
      await PlatformSDK.incrementUsage('api_call');
      await refreshEntitlement();
      alert('Usage recorded successfully!');
    } catch (error) {
      console.error('Failed to record usage:', error);
      alert('Failed to record usage');
    } finally {
      setRecording(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* User Info */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">User Information</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Email</dt>
            <dd className="text-sm font-medium text-gray-900">{user.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">User ID</dt>
            <dd className="text-sm font-medium text-gray-900 font-mono">{user.userId}</dd>
          </div>
        </dl>
      </div>

      {/* Entitlement Info */}
      {entitlement ? (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>
            <Link
              href="/plans"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Change Plan
            </Link>
          </div>
          <div className="mb-4">
            <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {entitlement.planName}
            </span>
            <span className={`ml-2 inline-block px-3 py-1 rounded-full text-sm font-medium ${
              entitlement.status === 'active'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {entitlement.status}
            </span>
          </div>

          {/* Usage Stats */}
          <h3 className="text-md font-medium text-gray-700 mb-3">Usage</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-sm text-gray-500">API Calls</div>
              <div className="text-xl font-bold text-gray-900">
                {entitlement.currentUsage.apiCalls} / {formatRemaining(entitlement.limits.apiCalls || Infinity)}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-sm text-gray-500">Generations</div>
              <div className="text-xl font-bold text-gray-900">
                {entitlement.currentUsage.generations} / {formatRemaining(entitlement.limits.generations || Infinity)}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-sm text-gray-500">Storage (MB)</div>
              <div className="text-xl font-bold text-gray-900">
                {entitlement.currentUsage.storage} / {formatRemaining(entitlement.limits.storage || Infinity)}
              </div>
            </div>
          </div>

          {/* Features */}
          <h3 className="text-md font-medium text-gray-700 mt-6 mb-3">Features</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(entitlement.features).map(([feature, enabled]) => (
              <span
                key={feature}
                className={`px-3 py-1 rounded-full text-sm ${
                  enabled
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {feature}: {enabled ? 'Enabled' : 'Disabled'}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">No Active Plan</h2>
          <p className="text-yellow-700 mb-4">
            You don't have an active subscription. Choose a plan to get started.
          </p>
          <Link
            href="/plans"
            className="inline-block bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
          >
            View Plans
          </Link>
        </div>
      )}

      {/* Feature Gate Examples */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Feature Gate Examples</h2>

        {/* Premium Feature */}
        <FeatureGate
          feature="premium_feature"
          fallback={
            <div className="p-4 bg-gray-100 rounded mb-4">
              <p className="text-gray-600">
                Premium feature is not available on your plan.
                <Link href="/plans" className="text-blue-600 ml-1">Upgrade</Link>
              </p>
            </div>
          }
        >
          <div className="p-4 bg-green-100 rounded mb-4">
            <p className="text-green-800">
              You have access to premium features!
            </p>
          </div>
        </FeatureGate>

        {/* Usage Limit Gate */}
        <UsageLimitGate
          limitType="apiCalls"
          fallback={
            <div className="p-4 bg-red-100 rounded">
              <p className="text-red-800">
                API call limit exceeded.
                <Link href="/plans" className="text-blue-600 ml-1">Upgrade</Link>
              </p>
            </div>
          }
        >
          <div className="p-4 bg-blue-50 rounded">
            <p className="text-blue-800 mb-3">
              You can make more API calls!
            </p>
            <button
              onClick={handleRecordUsage}
              disabled={recording}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {recording ? 'Recording...' : 'Record Usage (+1 API Call)'}
            </button>
          </div>
        </UsageLimitGate>
      </div>
    </div>
  );
}
