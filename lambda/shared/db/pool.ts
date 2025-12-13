/**
 * PostgreSQL connection pool management for Aurora Serverless
 * Uses RDS Proxy for connection pooling and automatic failover
 */

import { Pool, PoolConfig, QueryResult as PgQueryResult, PoolClient } from 'pg';
import { DatabaseConfig, QueryResult } from '../types/index.js';

/**
 * Export PoolClient type for use in transaction callbacks
 */
export type { PoolClient };

/**
 * Global connection pool instance
 * Reused across Lambda invocations for connection reuse
 */
let pool: Pool | null = null;

/**
 * Connection pool statistics
 */
export interface PoolStats {
  /** Total number of clients in pool */
  totalCount: number;
  /** Number of idle clients */
  idleCount: number;
  /** Number of clients waiting for connection */
  waitingCount: number;
}

/**
 * Creates a new PostgreSQL connection pool
 *
 * @param config - Database configuration
 * @returns PostgreSQL connection pool
 *
 * @example
 * ```typescript
 * const config: DatabaseConfig = {
 *   host: process.env.DB_HOST!,
 *   port: parseInt(process.env.DB_PORT || '5432'),
 *   database: process.env.DB_NAME!,
 *   user: process.env.DB_USER!,
 *   password: process.env.DB_PASSWORD!,
 *   max: 5,
 *   min: 1
 * };
 * const dbPool = createPool(config);
 * ```
 */
export function createPool(config: DatabaseConfig): Pool {
  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: config.max ?? 5, // Maximum 5 connections for Lambda
    min: config.min ?? 1, // Minimum 1 connection
    idleTimeoutMillis: config.idleTimeoutMillis ?? 30000, // 30 seconds
    connectionTimeoutMillis: config.connectionTimeoutMillis ?? 5000, // 5 seconds
    ssl: config.ssl ?? {
      rejectUnauthorized: false, // RDS Proxy requires SSL
    },
    // Lambda-specific optimizations
    allowExitOnIdle: true, // Allow pool to close when idle
    statement_timeout: 30000, // 30 seconds query timeout
  };

  const newPool = new Pool(poolConfig);

  // Error handling
  newPool.on('error', (err) => {
    console.error('[DB Pool] Unexpected error on idle client', err);
  });

  newPool.on('connect', () => {
    console.log('[DB Pool] New client connected');
  });

  newPool.on('remove', () => {
    console.log('[DB Pool] Client removed from pool');
  });

  return newPool;
}

/**
 * Gets or creates the global connection pool
 * Implements singleton pattern for Lambda container reuse
 *
 * @param config - Database configuration
 * @returns Global connection pool instance
 */
export function getPool(config: DatabaseConfig): Pool {
  if (!pool) {
    console.log('[DB Pool] Creating new connection pool');
    pool = createPool(config);
  }
  return pool;
}

/**
 * Executes a SQL query with automatic connection management
 *
 * @param query - SQL query string
 * @param params - Query parameters
 * @returns Query result with execution time
 *
 * @example
 * ```typescript
 * const result = await executeQuery<User>(
 *   'SELECT * FROM users WHERE email = $1',
 *   ['user@example.com']
 * );
 * console.log(result.rows);
 * ```
 */
export async function executeQuery<T = unknown>(
  query: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  if (!pool) {
    throw new Error('Database pool not initialized. Call getPool() first.');
  }

  const startTime = Date.now();

  try {
    const result = await pool.query(query, params);
    const executionTime = Date.now() - startTime;

    console.log(`[DB Query] Executed in ${executionTime}ms, returned ${result.rowCount} rows`);

    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
      executionTime,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[DB Query] Failed after ${executionTime}ms:`, error);
    throw error;
  }
}

/**
 * Executes a transaction with automatic rollback on error
 *
 * @param callback - Transaction callback function
 * @returns Transaction result
 *
 * @example
 * ```typescript
 * const result = await executeTransaction(async (client) => {
 *   await client.query('INSERT INTO users (email) VALUES ($1)', ['user@example.com']);
 *   await client.query('INSERT INTO profiles (user_id) VALUES ($1)', [userId]);
 *   return { success: true };
 * });
 * ```
 */
export async function executeTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (!pool) {
    throw new Error('Database pool not initialized. Call getPool() first.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    console.log('[DB Transaction] Committed successfully');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DB Transaction] Rolled back due to error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gets connection pool statistics
 *
 * @returns Pool statistics
 */
export function getPoolStats(): PoolStats | null {
  if (!pool) {
    return null;
  }

  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

/**
 * Closes the connection pool gracefully
 * Should be called during Lambda shutdown (if needed)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    console.log('[DB Pool] Closing connection pool');
    await pool.end();
    pool = null;
  }
}

/**
 * Health check for database connectivity
 *
 * @returns true if database is reachable
 */
export async function healthCheck(): Promise<boolean> {
  if (!pool) {
    return false;
  }

  try {
    const result = await pool.query('SELECT 1 as health');
    return result.rows.length > 0;
  } catch (error) {
    console.error('[DB Health Check] Failed:', error);
    return false;
  }
}
