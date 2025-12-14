'use client';

import { ReactNode } from 'react';
import { usePlatform } from './PlatformProvider';

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Feature Gate Component
 * Shows children only if user has the specified feature enabled
 */
export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { entitlement, entitlementLoading } = usePlatform();

  if (entitlementLoading) {
    return null;
  }

  // Check if feature exists and is truthy
  const hasFeature = entitlement?.features?.[feature];

  if (!hasFeature) {
    return fallback || null;
  }

  return <>{children}</>;
}

interface UsageLimitGateProps {
  children: ReactNode;
  onLimitExceeded?: () => void;
  fallback?: ReactNode;
}

/**
 * Usage Limit Gate Component
 * Shows children only if user is within their usage limit
 */
export function UsageLimitGate({
  children,
  onLimitExceeded,
  fallback,
}: UsageLimitGateProps) {
  const { entitlement, entitlementLoading } = usePlatform();

  if (entitlementLoading) {
    return null;
  }

  // Check usage limits from entitlement
  const isOverLimit = entitlement?.over_limit ?? false;

  if (isOverLimit) {
    if (onLimitExceeded) {
      onLimitExceeded();
    }
    return fallback || (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-yellow-800">
          利用上限に達しました。プランをアップグレードしてください。
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
