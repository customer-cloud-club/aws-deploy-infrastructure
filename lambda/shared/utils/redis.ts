/**
 * Redis client for caching and rate limiting
 * Uses ElastiCache Redis with connection pooling
 */

import Redis from 'ioredis';
import { RedisConfig, RateLimitResult } from '../types/index.js';
import { retryWithExponentialBackoff } from './retry.js';

/**
 * Global Redis client instance
 * Reused across Lambda invocations
 */
let redisClient: Redis | null = null;

/**
 * Default Redis configuration
 */
const DEFAULT_CONFIG: Partial<RedisConfig> = {
  port: 6379,
  connectTimeout: 5000,
  commandTimeout: 5000,
  maxRetriesPerRequest: 3,
  tls: undefined, // Enable TLS for ElastiCache in production
};

/**
 * Creates a new Redis client
 *
 * @param config - Redis configuration
 * @returns Redis client instance
 */
function createRedisClient(config: RedisConfig): Redis {
  const client = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    connectTimeout: config.connectTimeout ?? DEFAULT_CONFIG.connectTimeout,
    commandTimeout: config.commandTimeout ?? DEFAULT_CONFIG.commandTimeout,
    maxRetriesPerRequest: config.maxRetriesPerRequest ?? DEFAULT_CONFIG.maxRetriesPerRequest,
    tls: config.tls,
    lazyConnect: true, // Don't connect immediately
    enableReadyCheck: true,
    enableOfflineQueue: false, // Fail fast if disconnected
    retryStrategy: (times: number) => {
      if (times > 3) {
        console.error('[Redis] Max retries reached, giving up');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 100, 2000);
      console.warn(`[Redis] Retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
  });

  // Event handlers
  client.on('connect', () => {
    console.log('[Redis] Connected successfully');
  });

  client.on('ready', () => {
    console.log('[Redis] Client ready');
  });

  client.on('error', (err) => {
    console.error('[Redis] Client error:', err);
  });

  client.on('close', () => {
    console.log('[Redis] Connection closed');
  });

  client.on('reconnecting', () => {
    console.log('[Redis] Reconnecting...');
  });

  return client;
}

/**
 * Gets or creates Redis client
 *
 * @returns Redis client instance
 */
export async function getRedisClient(): Promise<Redis> {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;
    let config: RedisConfig;

    if (redisUrl) {
      // Parse Redis URL: redis://[password@]host:port
      const url = new URL(redisUrl);
      config = {
        host: url.hostname,
        port: parseInt(url.port || '6379'),
        password: url.password || undefined,
      };
    } else {
      // Use environment variables
      config = {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379'),
        password: process.env.REDIS_PASSWORD,
      };
    }

    console.log('[Redis] Initializing client:', { host: config.host, port: config.port });
    redisClient = createRedisClient(config);

    // Connect with retry
    await retryWithExponentialBackoff(
      async () => {
        if (redisClient) {
          await redisClient.connect();
        }
      },
      {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
      }
    );
  }

  return redisClient;
}

/**
 * Closes Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    console.log('[Redis] Closing connection');
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Lua script for sliding window rate limiting
 * Implements Redis INCR with expiration for token bucket
 */
const RATE_LIMIT_LUA_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current_time = tonumber(ARGV[3])

-- Get current count
local current = redis.call('GET', key)

if current and tonumber(current) >= limit then
  -- Rate limit exceeded
  local ttl = redis.call('TTL', key)
  return {0, limit - tonumber(current), current_time + (ttl * 1000)}
else
  -- Increment counter
  local new_count = redis.call('INCR', key)
  if new_count == 1 then
    -- Set expiration on first request
    redis.call('PEXPIRE', key, window)
  end
  local ttl = redis.call('PTTL', key)
  return {1, limit - new_count, current_time + ttl}
end
`;

/**
 * Checks rate limit using sliding window algorithm
 *
 * @param userId - User identifier
 * @param endpoint - API endpoint or resource name
 * @param limit - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns Rate limit result
 *
 * @example
 * ```typescript
 * const result = await checkRateLimit('user123', '/api/users', 100, 60000);
 * if (!result.allowed) {
 *   throw new Error('Rate limit exceeded');
 * }
 * ```
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const client = await getRedisClient();
  const key = `ratelimit:${userId}:${endpoint}`;
  const currentTime = Date.now();

  try {
    // Execute Lua script atomically
    const result = await client.eval(
      RATE_LIMIT_LUA_SCRIPT,
      1,
      key,
      limit.toString(),
      windowMs.toString(),
      currentTime.toString()
    ) as [number, number, number];

    const [allowed, remaining, resetAt] = result;

    return {
      allowed: allowed === 1,
      remaining: Math.max(0, remaining),
      resetAt,
      current: limit - remaining,
      limit,
    };
  } catch (error) {
    console.error('[Redis] Rate limit check failed:', error);
    // Fail open - allow request if Redis is unavailable
    return {
      allowed: true,
      remaining: limit,
      resetAt: currentTime + windowMs,
      current: 0,
      limit,
    };
  }
}

/**
 * Sets a cache value with expiration
 *
 * @param key - Cache key
 * @param value - Value to cache (will be JSON stringified)
 * @param ttlSeconds - Time to live in seconds
 *
 * @example
 * ```typescript
 * await setCacheValue('user:123', { name: 'John' }, 3600);
 * ```
 */
export async function setCacheValue(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  const client = await getRedisClient();

  try {
    const serialized = JSON.stringify(value);
    await client.setex(key, ttlSeconds, serialized);
    console.log(`[Redis] Cached key ${key} for ${ttlSeconds}s`);
  } catch (error) {
    console.error('[Redis] Failed to set cache value:', error);
    throw error;
  }
}

/**
 * Gets a cache value
 *
 * @param key - Cache key
 * @returns Cached value or null if not found
 *
 * @example
 * ```typescript
 * const user = await getCacheValue<User>('user:123');
 * if (user) {
 *   console.log(user.name);
 * }
 * ```
 */
export async function getCacheValue<T = unknown>(key: string): Promise<T | null> {
  const client = await getRedisClient();

  try {
    const value = await client.get(key);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as T;
  } catch (error) {
    console.error('[Redis] Failed to get cache value:', error);
    return null;
  }
}

/**
 * Deletes a cache value
 *
 * @param key - Cache key or pattern
 *
 * @example
 * ```typescript
 * await deleteCacheValue('user:123');
 * ```
 */
export async function deleteCacheValue(key: string): Promise<void> {
  const client = await getRedisClient();

  try {
    await client.del(key);
    console.log(`[Redis] Deleted key ${key}`);
  } catch (error) {
    console.error('[Redis] Failed to delete cache value:', error);
    throw error;
  }
}

/**
 * Deletes cache values by pattern
 *
 * @param pattern - Key pattern (e.g., 'user:*')
 *
 * @example
 * ```typescript
 * await deleteCachePattern('user:*');
 * ```
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  const client = await getRedisClient();

  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
      console.log(`[Redis] Deleted ${keys.length} keys matching ${pattern}`);
    }
  } catch (error) {
    console.error('[Redis] Failed to delete cache pattern:', error);
    throw error;
  }
}

/**
 * Increments a counter
 *
 * @param key - Counter key
 * @param increment - Amount to increment (default: 1)
 * @returns New counter value
 *
 * @example
 * ```typescript
 * const count = await incrementCounter('api:requests', 1);
 * ```
 */
export async function incrementCounter(key: string, increment = 1): Promise<number> {
  const client = await getRedisClient();

  try {
    const value = await client.incrby(key, increment);
    return value;
  } catch (error) {
    console.error('[Redis] Failed to increment counter:', error);
    throw error;
  }
}

/**
 * Sets a value in a hash
 *
 * @param key - Hash key
 * @param field - Field name
 * @param value - Field value
 *
 * @example
 * ```typescript
 * await setHashField('session:123', 'userId', 'user456');
 * ```
 */
export async function setHashField(key: string, field: string, value: string): Promise<void> {
  const client = await getRedisClient();

  try {
    await client.hset(key, field, value);
  } catch (error) {
    console.error('[Redis] Failed to set hash field:', error);
    throw error;
  }
}

/**
 * Gets a value from a hash
 *
 * @param key - Hash key
 * @param field - Field name
 * @returns Field value or null
 *
 * @example
 * ```typescript
 * const userId = await getHashField('session:123', 'userId');
 * ```
 */
export async function getHashField(key: string, field: string): Promise<string | null> {
  const client = await getRedisClient();

  try {
    return await client.hget(key, field);
  } catch (error) {
    console.error('[Redis] Failed to get hash field:', error);
    return null;
  }
}

/**
 * Gets all fields from a hash
 *
 * @param key - Hash key
 * @returns Hash object
 *
 * @example
 * ```typescript
 * const session = await getHash('session:123');
 * ```
 */
export async function getHash(key: string): Promise<Record<string, string>> {
  const client = await getRedisClient();

  try {
    return await client.hgetall(key);
  } catch (error) {
    console.error('[Redis] Failed to get hash:', error);
    return {};
  }
}

/**
 * Checks if Redis is healthy
 *
 * @returns true if Redis is reachable
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('[Redis] Health check failed:', error);
    return false;
  }
}

/**
 * Re-export Redis client for advanced usage
 */
export { Redis };
