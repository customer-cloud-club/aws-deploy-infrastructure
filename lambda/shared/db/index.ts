/**
 * Aurora PostgreSQL database connection with RDS Proxy
 * Integrates with AWS Secrets Manager for credential management
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { DatabaseConfig, SecretValue } from '../types/index.js';
import { getPool, executeQuery, executeTransaction, closePool, healthCheck, getPoolStats, PoolStats } from './pool.js';
export type { PoolStats };
import { retryWithExponentialBackoff } from '../utils/retry.js';

/**
 * Cached database credentials
 * Refreshed periodically or on authentication failure
 */
let cachedCredentials: DatabaseConfig | null = null;
let credentialsCacheTime: number = 0;
const CREDENTIALS_CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * AWS Secrets Manager client
 */
const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION ?? 'ap-northeast-1',
});

/**
 * Retrieves database credentials from AWS Secrets Manager
 *
 * @param secretArn - ARN of the secret in Secrets Manager
 * @returns Database configuration with credentials
 *
 * @throws Error if secret retrieval fails
 *
 * @example
 * ```typescript
 * const config = await getSecretValue('arn:aws:secretsmanager:...');
 * ```
 */
async function getSecretValue(secretArn: string): Promise<DatabaseConfig> {
  console.log('[DB Secret] Retrieving credentials from Secrets Manager');

  const command = new GetSecretValueCommand({
    SecretId: secretArn,
  });

  const response = await retryWithExponentialBackoff(
    async () => secretsClient.send(command),
    {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 2000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
    }
  );

  if (!response.SecretString) {
    throw new Error('Secret value is empty');
  }

  const secret: SecretValue = JSON.parse(response.SecretString);

  // Validate required fields
  if (!secret.host || !secret.username || !secret.password || !secret.dbname) {
    throw new Error('Secret is missing required database connection fields');
  }

  console.log('[DB Secret] Successfully retrieved credentials');

  return {
    host: secret.host,
    port: secret.port ?? 5432,
    database: secret.dbname,
    user: secret.username,
    password: secret.password,
    max: 5, // Lambda-optimized pool size
    min: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: {
      rejectUnauthorized: false,
    },
  };
}

/**
 * Gets database credentials with caching
 * Uses in-memory cache to avoid excessive Secrets Manager API calls
 *
 * @param forceRefresh - Force credential refresh
 * @returns Database configuration
 */
async function getCredentials(forceRefresh = false): Promise<DatabaseConfig> {
  const now = Date.now();
  const cacheExpired = now - credentialsCacheTime > CREDENTIALS_CACHE_TTL;

  if (!forceRefresh && cachedCredentials && !cacheExpired) {
    console.log('[DB Credentials] Using cached credentials');
    return cachedCredentials;
  }

  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) {
    // Fallback to environment variables (for local development)
    console.warn('[DB Credentials] DB_SECRET_ARN not set, using environment variables');
    const config: DatabaseConfig = {
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432'),
      database: process.env.DB_NAME ?? 'postgres',
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      max: 5,
      min: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
    cachedCredentials = config;
    credentialsCacheTime = now;
    return config;
  }

  // Retrieve from Secrets Manager
  const credentials = await getSecretValue(secretArn);
  cachedCredentials = credentials;
  credentialsCacheTime = now;

  return credentials;
}

/**
 * Runs necessary database migrations
 * Ensures required columns exist in all tables
 */
async function runMigrations() {
  console.log('[DB] Running migrations...');

  // PostgreSQL 9.6+ supports ADD COLUMN IF NOT EXISTS
  const migrations = [
    // Add deleted_at column to products
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP',
    'CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at)',
    // Add deleted_at column to plans
    'ALTER TABLE plans ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP',
    'CREATE INDEX IF NOT EXISTS idx_plans_deleted_at ON plans(deleted_at)',
    // Add deleted_at column to tenants
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP',
    'CREATE INDEX IF NOT EXISTS idx_tenants_deleted_at ON tenants(deleted_at)',
    // Add deleted_at column to subscriptions
    'ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP',
    'CREATE INDEX IF NOT EXISTS idx_subscriptions_deleted_at ON subscriptions(deleted_at)',
  ];

  for (const migration of migrations) {
    try {
      await executeQuery(migration);
      console.log('[DB] Migration executed:', migration.substring(0, 50) + '...');
    } catch (error) {
      console.warn('[DB] Migration warning:', migration.substring(0, 30), error);
    }
  }

  console.log('[DB] Migrations completed');
}

/**
 * Initializes database connection pool
 * Should be called once during Lambda cold start
 *
 * @returns Database connection pool
 *
 * @example
 * ```typescript
 * // In Lambda handler
 * const pool = await initializeDatabase();
 * const result = await pool.query('SELECT * FROM users');
 * ```
 */
export async function initializeDatabase() {
  console.log('[DB] Initializing database connection');

  try {
    const config = await getCredentials();
    const pool = getPool(config);

    // Test connection
    const isHealthy = await healthCheck();
    if (!isHealthy) {
      throw new Error('Database health check failed');
    }

    console.log('[DB] Successfully connected to Aurora PostgreSQL');

    // Run migrations to ensure schema is up to date
    await runMigrations();

    return pool;
  } catch (error) {
    console.error('[DB] Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Executes a database query with automatic retry and credential refresh
 *
 * @param query - SQL query string
 * @param params - Query parameters
 * @returns Query result
 *
 * @example
 * ```typescript
 * const users = await query<User>('SELECT * FROM users WHERE id = $1', [userId]);
 * ```
 */
export async function query<T = unknown>(
  query: string,
  params?: unknown[]
) {
  try {
    return await executeQuery<T>(query, params);
  } catch (error) {
    // Check if error is authentication-related
    if (isAuthError(error)) {
      console.warn('[DB] Authentication error detected, refreshing credentials');
      const newConfig = await getCredentials(true);
      getPool(newConfig);
      // Retry query with new credentials
      return await executeQuery<T>(query, params);
    }
    throw error;
  }
}

/**
 * Executes a database transaction
 *
 * @param callback - Transaction callback
 * @returns Transaction result
 */
export async function transaction<T>(
  callback: Parameters<typeof executeTransaction<T>>[0]
) {
  return executeTransaction(callback);
}

/**
 * Checks if error is authentication-related
 *
 * @param error - Error object
 * @returns true if authentication error
 */
function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('authentication') ||
      message.includes('password') ||
      message.includes('permission denied') ||
      message.includes('invalid authorization')
    );
  }
  return false;
}

/**
 * Gets database pool statistics
 */
export function getDatabaseStats() {
  return getPoolStats();
}

/**
 * Closes database connection pool
 */
export async function closeDatabase() {
  await closePool();
}

/**
 * Performs database health check
 */
export async function checkDatabaseHealth() {
  return healthCheck();
}

/**
 * Re-exports pool utilities for advanced usage
 */
export { executeQuery, executeTransaction, getPool } from './pool.js';
export type { PoolClient } from './pool.js';
