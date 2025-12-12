/**
 * Redis cache utilities for Entitlement Service
 * Implements caching strategy with 60-second TTL for P95 latency < 200ms
 */

import {
  getCacheValue,
  setCacheValue,
  deleteCacheValue,
  deleteCachePattern,
  getRedisClient,
} from '../../shared/utils/redis.js';
import {
  EntitlementResponse,
  CacheKeys,
  CacheTTL,
} from './types.js';

/**
 * Cache layer for entitlement data
 */
export class EntitlementCache {
  /**
   * Get entitlement from cache
   *
   * @param userId - User ID
   * @param productId - Product ID
   * @returns Cached entitlement response or null if not found
   */
  static async getEntitlement(
    userId: string,
    productId: string
  ): Promise<EntitlementResponse | null> {
    const key = CacheKeys.entitlement(userId, productId);
    try {
      const cached = await getCacheValue<EntitlementResponse>(key);
      if (cached) {
        console.log(`Cache hit for entitlement: ${key}`);
        return cached;
      }
      console.log(`Cache miss for entitlement: ${key}`);
      return null;
    } catch (error) {
      console.error(`Error getting entitlement from cache: ${key}`, error);
      return null;
    }
  }

  /**
   * Set entitlement in cache
   *
   * @param userId - User ID
   * @param productId - Product ID
   * @param entitlement - Entitlement response data
   * @param ttl - Time to live in seconds (default: 60s)
   */
  static async setEntitlement(
    userId: string,
    productId: string,
    entitlement: EntitlementResponse,
    ttl: number = CacheTTL.ENTITLEMENT
  ): Promise<void> {
    const key = CacheKeys.entitlement(userId, productId);
    try {
      await setCacheValue(key, entitlement, ttl);
      console.log(`Cache set for entitlement: ${key}, TTL: ${ttl}s`);
    } catch (error) {
      console.error(`Error setting entitlement in cache: ${key}`, error);
    }
  }

  /**
   * Invalidate entitlement cache
   *
   * @param userId - User ID
   * @param productId - Product ID
   */
  static async invalidateEntitlement(
    userId: string,
    productId: string
  ): Promise<void> {
    const key = CacheKeys.entitlement(userId, productId);
    try {
      await deleteCacheValue(key);
      console.log(`Cache invalidated for entitlement: ${key}`);
    } catch (error) {
      console.error(`Error invalidating entitlement cache: ${key}`, error);
    }
  }

  /**
   * Invalidate all entitlements for a user
   *
   * @param userId - User ID
   */
  static async invalidateUserEntitlements(userId: string): Promise<void> {
    const pattern = CacheKeys.userEntitlements(userId);
    try {
      await deleteCachePattern(pattern);
      console.log(`Cache invalidated for user entitlements: ${pattern}`);
    } catch (error) {
      console.error(`Error invalidating user entitlements cache: ${pattern}`, error);
    }
  }

  /**
   * Get usage counter from cache
   *
   * @param userId - User ID
   * @param productId - Product ID
   * @returns Current usage count or null if not found
   */
  static async getUsageCount(
    userId: string,
    productId: string
  ): Promise<number | null> {
    const key = CacheKeys.usage(userId, productId);
    try {
      const cached = await getCacheValue<number>(key);
      if (cached !== null) {
        console.log(`Cache hit for usage: ${key}`);
        return cached;
      }
      console.log(`Cache miss for usage: ${key}`);
      return null;
    } catch (error) {
      console.error(`Error getting usage from cache: ${key}`, error);
      return null;
    }
  }

  /**
   * Increment usage counter in cache
   *
   * @param userId - User ID
   * @param productId - Product ID
   * @param count - Increment amount (default: 1)
   * @param ttl - Time to live in seconds (default: 300s)
   * @returns New usage count
   */
  static async incrementUsage(
    userId: string,
    productId: string,
    count: number = 1,
    ttl: number = CacheTTL.USAGE
  ): Promise<number> {
    const key = CacheKeys.usage(userId, productId);
    try {
      const redis = await getRedisClient();

      // Increment counter
      const newCount = await redis.incrby(key, count);

      // Set TTL if this is a new key (counter = count)
      if (newCount === count) {
        await redis.expire(key, ttl);
      }

      console.log(`Usage incremented: ${key}, new count: ${newCount}`);
      return newCount;
    } catch (error) {
      console.error(`Error incrementing usage in cache: ${key}`, error);
      throw error;
    }
  }

  /**
   * Set usage counter in cache
   *
   * @param userId - User ID
   * @param productId - Product ID
   * @param count - Usage count
   * @param ttl - Time to live in seconds (default: 300s)
   */
  static async setUsageCount(
    userId: string,
    productId: string,
    count: number,
    ttl: number = CacheTTL.USAGE
  ): Promise<void> {
    const key = CacheKeys.usage(userId, productId);
    try {
      await setCacheValue(key, count, ttl);
      console.log(`Cache set for usage: ${key}, count: ${count}, TTL: ${ttl}s`);
    } catch (error) {
      console.error(`Error setting usage in cache: ${key}`, error);
    }
  }

  /**
   * Invalidate usage counter cache
   *
   * @param userId - User ID
   * @param productId - Product ID
   */
  static async invalidateUsage(
    userId: string,
    productId: string
  ): Promise<void> {
    const key = CacheKeys.usage(userId, productId);
    try {
      await deleteCacheValue(key);
      console.log(`Cache invalidated for usage: ${key}`);
    } catch (error) {
      console.error(`Error invalidating usage cache: ${key}`, error);
    }
  }

  /**
   * Invalidate both entitlement and usage cache
   *
   * @param userId - User ID
   * @param productId - Product ID
   */
  static async invalidateAll(
    userId: string,
    productId: string
  ): Promise<void> {
    await Promise.all([
      this.invalidateEntitlement(userId, productId),
      this.invalidateUsage(userId, productId),
    ]);
  }
}

export default EntitlementCache;
