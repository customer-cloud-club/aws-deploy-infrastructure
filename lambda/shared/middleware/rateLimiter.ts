/**
 * Rate limiting middleware for Lambda functions
 * Uses Redis for distributed rate limiting across multiple Lambda instances
 */

import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import { checkRateLimit } from '../utils/redis.js';
import { Middleware } from '../types/index.js';

/**
 * Rate limit tier configuration
 */
export interface RateLimitTier {
  /** Tier name */
  name: string;
  /** Maximum requests per window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/**
 * Default rate limit tiers
 */
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitTier> = {
  free: {
    name: 'free',
    limit: 100,
    windowMs: 60000, // 1 minute
  },
  basic: {
    name: 'basic',
    limit: 1000,
    windowMs: 60000, // 1 minute
  },
  premium: {
    name: 'premium',
    limit: 10000,
    windowMs: 60000, // 1 minute
  },
  enterprise: {
    name: 'enterprise',
    limit: 100000,
    windowMs: 60000, // 1 minute
  },
};

/**
 * Rate limiter options
 */
interface RateLimiterOptions {
  /** Rate limit tier or custom configuration */
  tier?: RateLimitTier | keyof typeof DEFAULT_RATE_LIMITS;
  /** Custom limit (overrides tier) */
  limit?: number;
  /** Custom window in milliseconds (overrides tier) */
  windowMs?: number;
  /** Function to extract user identifier from event */
  getUserId?: (event: APIGatewayProxyEvent) => string | null;
  /** Function to extract endpoint identifier from event */
  getEndpoint?: (event: APIGatewayProxyEvent) => string;
  /** Skip rate limiting for certain requests */
  skip?: (event: APIGatewayProxyEvent) => boolean;
  /** Custom error message */
  message?: string;
}

/**
 * Default user ID extractor
 * Extracts user ID from JWT token in Authorization header
 */
function defaultGetUserId(event: APIGatewayProxyEvent): string | null {
  // Try to get from request context (set by authorizer)
  const userId = event.requestContext.authorizer?.userId;
  if (userId) {
    return userId as string;
  }

  // Fallback to IP address for anonymous users
  const sourceIp = event.requestContext.identity?.sourceIp;
  if (sourceIp) {
    return `ip:${sourceIp}`;
  }

  return null;
}

/**
 * Default endpoint extractor
 */
function defaultGetEndpoint(event: APIGatewayProxyEvent): string {
  return `${event.httpMethod}:${event.resource}`;
}

/**
 * Creates rate limit error response
 */
function createRateLimitResponse(
  remaining: number,
  resetAt: number,
  message?: string
): APIGatewayProxyResult {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': '0',
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(resetAt).toISOString(),
      'Retry-After': Math.ceil((resetAt - Date.now()) / 1000).toString(),
    },
    body: JSON.stringify({
      error: message || 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      resetAt: new Date(resetAt).toISOString(),
      retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
    }),
  };
}

/**
 * Creates a rate limiter middleware
 *
 * @param options - Rate limiter options
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * const rateLimiter = createRateLimiter({
 *   tier: 'free',
 *   getUserId: (event) => event.requestContext.authorizer?.userId,
 * });
 *
 * export const handler = async (event, context) => {
 *   await rateLimiter(event, context);
 *   // ... handler logic
 * };
 * ```
 */
export function createRateLimiter(options: RateLimiterOptions = {}): Middleware {
  const {
    getUserId = defaultGetUserId,
    getEndpoint = defaultGetEndpoint,
    skip,
    message,
  } = options;

  // Resolve rate limit configuration
  let limit: number;
  let windowMs: number;

  if (options.limit && options.windowMs) {
    // Custom limit and window
    limit = options.limit;
    windowMs = options.windowMs;
  } else if (options.tier) {
    // Use tier configuration
    const tier = typeof options.tier === 'string'
      ? DEFAULT_RATE_LIMITS[options.tier]
      : options.tier;

    if (!tier) {
      throw new Error(`Invalid rate limit tier: ${options.tier}`);
    }

    limit = tier.limit;
    windowMs = tier.windowMs;
  } else {
    // Default to free tier
    limit = DEFAULT_RATE_LIMITS.free.limit;
    windowMs = DEFAULT_RATE_LIMITS.free.windowMs;
  }

  return async (event: APIGatewayProxyEvent, context: Context): Promise<void> => {
    // Skip rate limiting if skip function returns true
    if (skip && skip(event)) {
      return;
    }

    // Extract user identifier
    const userId = getUserId(event);
    if (!userId) {
      console.warn('[RateLimiter] Unable to identify user, skipping rate limit');
      return;
    }

    // Extract endpoint
    const endpoint = getEndpoint(event);

    console.log(`[RateLimiter] Checking rate limit for ${userId} on ${endpoint}`);

    try {
      // Check rate limit
      const result = await checkRateLimit(userId, endpoint, limit, windowMs);

      // Add rate limit headers to response (will be added by wrapper)
      // Store in event for later use
      (event as unknown as Record<string, unknown>).rateLimitResult = result;

      if (!result.allowed) {
        console.warn(
          `[RateLimiter] Rate limit exceeded for ${userId} on ${endpoint}`,
          {
            current: result.current,
            limit: result.limit,
            resetAt: new Date(result.resetAt).toISOString(),
          }
        );

        // Throw error with rate limit response
        const error = new Error('Rate limit exceeded') as Error & {
          response?: APIGatewayProxyResult
        };
        error.response = createRateLimitResponse(result.remaining, result.resetAt, message);
        throw error;
      }

      console.log(`[RateLimiter] Rate limit check passed: ${result.remaining} requests remaining`);
    } catch (error) {
      // If error already has response, rethrow
      if ((error as Error & { response?: APIGatewayProxyResult }).response) {
        throw error;
      }

      // For Redis errors, log and allow request (fail open)
      console.error('[RateLimiter] Rate limit check failed, allowing request:', error);
    }
  };
}

/**
 * Wraps a Lambda handler with rate limiting
 *
 * @param handler - Original Lambda handler
 * @param options - Rate limiter options
 * @returns Wrapped handler with rate limiting
 *
 * @example
 * ```typescript
 * const originalHandler = async (event, context) => {
 *   return {
 *     statusCode: 200,
 *     body: JSON.stringify({ message: 'Success' })
 *   };
 * };
 *
 * export const handler = withRateLimit(originalHandler, { tier: 'free' });
 * ```
 */
export function withRateLimit(
  handler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>,
  options: RateLimiterOptions = {}
): (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult> {
  const rateLimiter = createRateLimiter(options);

  return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    try {
      // Apply rate limiting middleware
      await rateLimiter(event, context);

      // Call original handler
      const response = await handler(event, context);

      // Add rate limit headers to response
      const rateLimitResult = (event as unknown as Record<string, unknown>).rateLimitResult;
      if (rateLimitResult && typeof rateLimitResult === 'object' && 'limit' in rateLimitResult) {
        const result = rateLimitResult as { limit: number; remaining: number; resetAt: number };
        response.headers = {
          ...response.headers,
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
        };
      }

      return response;
    } catch (error) {
      // If error has response property, return it
      const errorWithResponse = error as Error & { response?: APIGatewayProxyResult };
      if (errorWithResponse.response) {
        return errorWithResponse.response;
      }

      // Otherwise, rethrow
      throw error;
    }
  };
}

/**
 * Rate limit by IP address only
 */
export function createIpRateLimiter(options: Omit<RateLimiterOptions, 'getUserId'> = {}): Middleware {
  return createRateLimiter({
    ...options,
    getUserId: (event) => {
      const sourceIp = event.requestContext.identity?.sourceIp;
      return sourceIp ? `ip:${sourceIp}` : null;
    },
  });
}

/**
 * Rate limit by API key
 */
export function createApiKeyRateLimiter(options: Omit<RateLimiterOptions, 'getUserId'> = {}): Middleware {
  return createRateLimiter({
    ...options,
    getUserId: (event) => {
      const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
      return apiKey || null;
    },
  });
}
