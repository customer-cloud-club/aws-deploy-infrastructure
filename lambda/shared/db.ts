/**
 * Database connection pool for Lambda functions
 * Uses pg.Pool with RDS Proxy for connection management
 */

import { Pool, PoolConfig } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SecretValue } from './types/index.js';

/**
 * Singleton database pool instance
 * Reused across Lambda invocations for connection pooling
 */
let pool: Pool | null = null;

/**
 * Secrets Manager client for retrieving database credentials
 */
const secretsClient = new SecretsManagerClient({
  region: process.env['AWS_REGION'] || 'ap-northeast-1',
});

/**
 * Retrieve database credentials from AWS Secrets Manager
 * @param secretArn - ARN of the secret containing database credentials
 * @returns Database secret value
 */
async function getDatabaseSecret(secretArn: string): Promise<SecretValue> {
  try {
    const command = new GetSecretValueCommand({
      SecretId: secretArn,
    });

    const response = await secretsClient.send(command);

    if (!response.SecretString) {
      throw new Error('Secret string is empty');
    }

    return JSON.parse(response.SecretString) as SecretValue;
  } catch (error) {
    console.error('Failed to retrieve database secret:', error);
    throw new Error('Database configuration error');
  }
}

/**
 * Get or create database connection pool
 * Singleton pattern ensures single pool per Lambda container
 * @returns PostgreSQL connection pool
 */
export async function getPool(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  const dbSecretArn = process.env['DB_SECRET_ARN'];

  if (!dbSecretArn) {
    throw new Error('DB_SECRET_ARN environment variable is required');
  }

  try {
    const secret = await getDatabaseSecret(dbSecretArn);

    const config: PoolConfig = {
      host: secret.host || process.env['DB_HOST'],
      port: secret.port || Number(process.env['DB_PORT']) || 5432,
      database: secret.dbname || process.env['DB_NAME'],
      user: secret.username,
      password: secret.password,
      // Lambda-optimized pool settings
      max: 10, // Maximum connections per Lambda instance
      min: 0, // No minimum to allow Lambda to scale to zero
      idleTimeoutMillis: 30000, // 30 seconds
      connectionTimeoutMillis: 5000, // 5 seconds
      // SSL for RDS connections
      ssl: {
        rejectUnauthorized: false, // RDS Proxy uses AWS-managed certificates
      },
    };

    pool = new Pool(config);

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });

    console.log('Database pool created successfully');
    return pool;
  } catch (error) {
    console.error('Failed to create database pool:', error);
    throw error;
  }
}

/**
 * Export pool instance for backward compatibility
 * Note: This may be null until getPool() is called
 */
export { pool };

/**
 * Close database pool (for cleanup in tests)
 * Not typically needed in Lambda as containers are managed by AWS
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database pool closed');
  }
}

/**
 * Execute a query with automatic connection management
 * @param query - SQL query string
 * @param params - Query parameters
 * @returns Query result
 */
export async function query<T = unknown>(
  query: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const dbPool = await getPool();
  const client = await dbPool.connect();

  try {
    const result = await client.query(query, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount || 0,
    };
  } finally {
    client.release();
  }
}
