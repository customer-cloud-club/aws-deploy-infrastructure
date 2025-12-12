/**
 * Common type definitions for Lambda functions
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  /** Database host (RDS Proxy endpoint) */
  host: string;
  /** Database port */
  port: number;
  /** Database name */
  database: string;
  /** Database user */
  user: string;
  /** Database password */
  password: string;
  /** Maximum number of connections in pool */
  max?: number;
  /** Minimum number of connections in pool */
  min?: number;
  /** Connection idle timeout in milliseconds */
  idleTimeoutMillis?: number;
  /** Connection timeout in milliseconds */
  connectionTimeoutMillis?: number;
  /** SSL configuration */
  ssl?: {
    rejectUnauthorized: boolean;
  };
}

/**
 * Redis connection configuration
 */
export interface RedisConfig {
  /** Redis host */
  host: string;
  /** Redis port */
  port: number;
  /** Redis password */
  password?: string;
  /** Connection timeout in milliseconds */
  connectTimeout?: number;
  /** Command timeout in milliseconds */
  commandTimeout?: number;
  /** Maximum retry attempts */
  maxRetriesPerRequest?: number;
  /** Enable TLS */
  tls?: {
    rejectUnauthorized: boolean;
  };
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Timestamp when the rate limit resets (Unix timestamp in milliseconds) */
  resetAt: number;
  /** Current request count */
  current?: number;
  /** Maximum requests allowed */
  limit?: number;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Identifier (e.g., userId, IP address) */
  identifier: string;
  /** Endpoint or resource name */
  endpoint: string;
}

/**
 * Retry configuration for exponential backoff
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Jitter factor (0-1) to randomize delays */
  jitterFactor?: number;
}

/**
 * Lambda response builder options
 */
export interface ResponseOptions {
  /** HTTP status code */
  statusCode: number;
  /** Response body (will be JSON stringified) */
  body: unknown;
  /** Additional headers */
  headers?: Record<string, string>;
  /** CORS enabled */
  cors?: boolean;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  /** Error message */
  error: string;
  /** Error code */
  code?: string;
  /** Additional error details */
  details?: unknown;
  /** Request ID for tracking */
  requestId?: string;
}

/**
 * Success response structure
 */
export interface SuccessResponse<T = unknown> {
  /** Success flag */
  success: true;
  /** Response data */
  data: T;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Lambda handler type with typed input and output
 */
export type LambdaHandler<TInput = unknown, TOutput = unknown> = (
  event: APIGatewayProxyEvent,
  context: Context,
  input: TInput
) => Promise<APIGatewayProxyResult & { parsedBody?: TOutput }>;

/**
 * Database query result
 */
export interface QueryResult<T = unknown> {
  /** Query result rows */
  rows: T[];
  /** Number of rows affected */
  rowCount: number;
  /** Query execution time in milliseconds */
  executionTime?: number;
}

/**
 * Secrets Manager secret structure
 */
export interface SecretValue {
  /** Database username */
  username?: string;
  /** Database password */
  password?: string;
  /** Database engine */
  engine?: string;
  /** Database host */
  host?: string;
  /** Database port */
  port?: number;
  /** Database name */
  dbname?: string;
  /** Additional secret fields */
  [key: string]: string | number | undefined;
}

/**
 * Middleware function type
 */
export type Middleware = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<void> | void;

/**
 * Lambda environment variables
 */
export interface LambdaEnvironment {
  /** Database host (RDS Proxy) */
  DB_HOST?: string;
  /** Database port */
  DB_PORT?: string;
  /** Database name */
  DB_NAME?: string;
  /** Database secret ARN */
  DB_SECRET_ARN?: string;
  /** Redis host */
  REDIS_HOST?: string;
  /** Redis port */
  REDIS_PORT?: string;
  /** Redis URL */
  REDIS_URL?: string;
  /** AWS region */
  AWS_REGION?: string;
  /** Log level */
  LOG_LEVEL?: string;
  /** Environment name */
  ENVIRONMENT?: 'development' | 'staging' | 'production';
}

/**
 * Type guard to check if error is an Error object
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard to check if value is defined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
