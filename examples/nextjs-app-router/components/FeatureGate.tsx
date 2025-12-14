'use client';

import { ReactNode, useEffect, useState } from 'react';
import { PlatformSDK } from '@/lib/platform';
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
  const { user, entitlement } = usePlatform();
  const [hasFeature, setHasFeature] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkFeature() {
      if (!user || !entitlement) {
        setHasFeature(false);
        setChecking(false);
        return;
      }

      try {
        const result = await PlatformSDK.hasFeature(feature);
        setHasFeature(result);
      } catch (error) {
        setHasFeature(false);
      } finally {
        setChecking(false);
      }
    }

    checkFeature();
  }, [user, entitlement, feature]);

  if (checking) {
    return null;
  }

  if (!hasFeature) {
    return fallback || null;
  }

  return <>{children}</>;
}

interface UsageLimitGateProps {
  limitType: string;
  children: ReactNode;
  onLimitExceeded?: () => void;
  fallback?: ReactNode;
}

/**
 * Usage Limit Gate Component
 * Shows children only if user is within their usage limit
 */
export function UsageLimitGate({
  limitType,
  children,
  onLimitExceeded,
  fallback
}: UsageLimitGateProps) {
  const { user, entitlement } = usePlatform();
  const [allowed, setAllowed] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkLimit() {
      if (!user || !entitlement) {
        setAllowed(false);
        setChecking(false);
        return;
      }

      try {
        const result = await PlatformSDK.checkLimit(limitType as any);
        setAllowed(result.allowed);
        setRemaining(result.remaining);

        if (!result.allowed && onLimitExceeded) {
          onLimitExceeded();
        }
      } catch (error) {
        setAllowed(false);
      } finally {
        setChecking(false);
      }
    }

    checkLimit();
  }, [user, entitlement, limitType, onLimitExceeded]);

  if (checking) {
    return null;
  }

  if (!allowed) {
    return fallback || (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-yellow-800">
          You have reached your {limitType} limit. Please upgrade your plan.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
