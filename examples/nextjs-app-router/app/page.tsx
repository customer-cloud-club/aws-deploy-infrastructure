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
          Platform SDK Demo
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          This example demonstrates how to integrate the Platform SDK with Next.js App Router
          for authentication, entitlement checking, and usage tracking.
        </p>

        {user ? (
          <div className="space-x-4">
            <Link
              href="/dashboard"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/plans"
              className="inline-block bg-white text-blue-600 border border-blue-600 px-6 py-3 rounded-md hover:bg-blue-50"
            >
              View Plans
            </Link>
          </div>
        ) : (
          <div className="space-x-4">
            <button
              onClick={() => login()}
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
            >
              Get Started
            </button>
            <Link
              href="/plans"
              className="inline-block bg-white text-blue-600 border border-blue-600 px-6 py-3 rounded-md hover:bg-blue-50"
            >
              View Plans
            </Link>
          </div>
        )}
      </div>

      {/* Features Section */}
      <div className="py-12">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          Features Demonstrated
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Authentication
            </h3>
            <p className="text-gray-600">
              Cognito-based authentication with automatic token management and refresh.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Entitlements
            </h3>
            <p className="text-gray-600">
              Feature flags and usage limits based on user's subscription plan.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Usage Tracking
            </h3>
            <p className="text-gray-600">
              Real-time usage recording and limit checking for metered features.
            </p>
          </div>
        </div>
      </div>

      {/* Code Example */}
      <div className="py-12">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          Quick Code Example
        </h2>
        <div className="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto">
          <pre className="text-sm">
{`import { PlatformSDK } from '@customer-cloud-club/platform-sdk';

// Initialize SDK
PlatformSDK.init({
  productId: process.env.NEXT_PUBLIC_PLATFORM_PRODUCT_ID!,
  apiUrl: process.env.NEXT_PUBLIC_PLATFORM_API_URL!,
});

// Check authentication
const user = await PlatformSDK.requireAuth();

// Check feature flag
if (await PlatformSDK.hasFeature('premium_feature')) {
  // Show premium content
}

// Check usage limit
const { allowed, remaining } = await PlatformSDK.checkLimit('apiCalls');
if (allowed) {
  // Record usage
  await PlatformSDK.incrementUsage('apiCalls');
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
