/**
 * Exponential backoff retry utility
 * Implements retry logic with jitter for API calls and database operations
 */

import { RetryConfig } from '../types/index.js';

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/**
 * Calculates delay for next retry attempt with exponential backoff and jitter
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 *
 * @example
 * ```typescript
 * const delay = calculateDelay(0, config); // 100ms + jitter
 * const delay = calculateDelay(1, config); // 200ms + jitter
 * const delay = calculateDelay(2, config); // 400ms + jitter
 * ```
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const clampedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter to prevent thundering herd
  const jitterFactor = config.jitterFactor ?? 0.1;
  const jitter = clampedDelay * jitterFactor * (Math.random() * 2 - 1);

  return Math.max(0, Math.floor(clampedDelay + jitter));
}

/**
 * Sleeps for specified milliseconds
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determines if an error is retryable
 *
 * @param error - Error object
 * @returns true if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('network') ||
      message.includes('timeout')
    ) {
      return true;
    }

    // Database errors
    if (
      message.includes('connection') ||
      message.includes('too many clients') ||
      message.includes('deadlock')
    ) {
      return true;
    }

    // AWS errors
    if (
      message.includes('throttling') ||
      message.includes('rate exceeded') ||
      message.includes('service unavailable') ||
      message.includes('internal server error')
    ) {
      return true;
    }
  }

  // Check for HTTP status codes (if error has statusCode property)
  const errorWithStatus = error as { statusCode?: number };
  if (errorWithStatus.statusCode) {
    // Retry on 429 (Too Many Requests), 500, 502, 503, 504
    return [429, 500, 502, 503, 504].includes(errorWithStatus.statusCode);
  }

  return false;
}

/**
 * Retries an async function with exponential backoff
 *
 * @param fn - Async function to retry
 * @param config - Retry configuration (optional)
 * @returns Result of the function
 *
 * @throws Last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await retryWithExponentialBackoff(
 *   async () => {
 *     return await fetch('https://api.example.com/data');
 *   },
 *   {
 *     maxRetries: 5,
 *     initialDelayMs: 200,
 *     maxDelayMs: 5000,
 *     backoffMultiplier: 2,
 *     jitterFactor: 0.2
 *   }
 * );
 * ```
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  let lastError: unknown;
  let attempt = 0;

  while (attempt <= finalConfig.maxRetries) {
    try {
      const result = await fn();
      if (attempt > 0) {
        console.log(`[Retry] Succeeded on attempt ${attempt + 1}`);
      }
      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= finalConfig.maxRetries || !isRetryableError(error)) {
        break;
      }

      const delay = calculateDelay(attempt, finalConfig);
      console.warn(
        `[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
        error instanceof Error ? error.message : error
      );

      await sleep(delay);
      attempt++;
    }
  }

  console.error(
    `[Retry] All ${finalConfig.maxRetries + 1} attempts failed:`,
    lastError instanceof Error ? lastError.message : lastError
  );
  throw lastError;
}

/**
 * Retries an async function with custom retry condition
 *
 * @param fn - Async function to retry
 * @param shouldRetry - Function to determine if retry should happen
 * @param config - Retry configuration (optional)
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const result = await retryWithCondition(
 *   async () => {
 *     const res = await fetch('https://api.example.com/data');
 *     return res.json();
 *   },
 *   (error, result) => {
 *     // Retry if specific error or if result is null
 *     return error !== null || result === null;
 *   },
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function retryWithCondition<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: unknown, result: T | null, attempt: number) => boolean,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  let lastError: unknown = null;
  let lastResult: T | null = null;
  let attempt = 0;

  while (attempt <= finalConfig.maxRetries) {
    try {
      const result = await fn();
      lastResult = result;
      lastError = null;

      if (!shouldRetry(null, result, attempt)) {
        return result;
      }
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error, null, attempt)) {
        throw error;
      }
    }

    if (attempt >= finalConfig.maxRetries) {
      break;
    }

    const delay = calculateDelay(attempt, finalConfig);
    console.warn(`[Retry] Retrying in ${delay}ms (attempt ${attempt + 1})`);
    await sleep(delay);
    attempt++;
  }

  if (lastError) {
    throw lastError;
  }

  return lastResult as T;
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenRetries: number;
}

const circuitBreakerStates = new Map<string, CircuitBreakerState>();

/**
 * Executes a function with circuit breaker pattern
 *
 * @param key - Unique key for the circuit breaker
 * @param fn - Function to execute
 * @param config - Circuit breaker configuration
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const result = await withCircuitBreaker(
 *   'external-api',
 *   async () => fetch('https://api.example.com/data'),
 *   {
 *     failureThreshold: 5,
 *     resetTimeoutMs: 60000,
 *     halfOpenRetries: 1
 *   }
 * );
 * ```
 */
export async function withCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>,
  config: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    halfOpenRetries: 1,
  }
): Promise<T> {
  const state = circuitBreakerStates.get(key) ?? {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed' as const,
  };

  const now = Date.now();

  // Check if circuit should transition from open to half-open
  if (state.state === 'open' && now - state.lastFailureTime >= config.resetTimeoutMs) {
    state.state = 'half-open';
    console.log(`[Circuit Breaker] ${key} transitioning to half-open`);
  }

  // Reject if circuit is open
  if (state.state === 'open') {
    throw new Error(`Circuit breaker is open for ${key}`);
  }

  try {
    const result = await fn();

    // Success - reset circuit breaker
    if (state.state === 'half-open') {
      state.state = 'closed';
      state.failures = 0;
      console.log(`[Circuit Breaker] ${key} closed`);
    }

    circuitBreakerStates.set(key, state);
    return result;
  } catch (error) {
    state.failures++;
    state.lastFailureTime = now;

    if (state.failures >= config.failureThreshold) {
      state.state = 'open';
      console.error(`[Circuit Breaker] ${key} opened after ${state.failures} failures`);
    }

    circuitBreakerStates.set(key, state);
    throw error;
  }
}
