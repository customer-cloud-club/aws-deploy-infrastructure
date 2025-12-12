/**
 * Webhook Idempotency Management
 *
 * Ensures Stripe webhook events are processed exactly once using database-level
 * deduplication with INSERT ... ON CONFLICT DO NOTHING pattern.
 *
 * Key Features:
 * - Atomic idempotency check using PostgreSQL UNIQUE constraint
 * - Race condition safe (concurrent webhook deliveries handled correctly)
 * - Transaction-aware (rollback removes idempotency record)
 *
 * Reference: Section 7.4.1 - Webhook冪等性保証
 *
 * @module billing/webhook/idempotency
 */

import { PoolClient } from 'pg';

/**
 * Check webhook event idempotency
 *
 * Attempts to insert a webhook event record. If the event ID already exists,
 * the insert is skipped (ON CONFLICT DO NOTHING) and returns false.
 *
 * Database Schema Required:
 * ```sql
 * CREATE TABLE processed_webhooks (
 *   stripe_event_id VARCHAR(255) PRIMARY KEY,
 *   event_type VARCHAR(100) NOT NULL,
 *   processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
 *   created_at TIMESTAMP NOT NULL DEFAULT NOW()
 * );
 *
 * CREATE INDEX idx_processed_webhooks_type ON processed_webhooks(event_type);
 * CREATE INDEX idx_processed_webhooks_processed_at ON processed_webhooks(processed_at);
 * ```
 *
 * @param client - PostgreSQL client (must be in an active transaction)
 * @param eventId - Stripe Event ID (e.g., evt_xxx)
 * @param eventType - Stripe Event type (e.g., checkout.session.completed)
 * @returns true if this is a new event (should be processed), false if already processed
 *
 * @example
 * ```typescript
 * const client = await pool.connect();
 * try {
 *   await client.query('BEGIN');
 *
 *   const isNew = await checkIdempotency(client, 'evt_123', 'checkout.session.completed');
 *   if (!isNew) {
 *     await client.query('ROLLBACK');
 *     return { statusCode: 200, body: 'Already processed' };
 *   }
 *
 *   // Process webhook event...
 *
 *   await client.query('COMMIT');
 * } catch (error) {
 *   await client.query('ROLLBACK');
 *   throw error;
 * } finally {
 *   client.release();
 * }
 * ```
 */
export async function checkIdempotency(
  client: PoolClient,
  eventId: string,
  eventType: string
): Promise<boolean> {
  try {
    // Attempt to insert webhook event record
    // ON CONFLICT DO NOTHING ensures atomic idempotency check
    const result = await client.query(
      `
      INSERT INTO processed_webhooks (stripe_event_id, event_type, processed_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (stripe_event_id) DO NOTHING
      RETURNING stripe_event_id
      `,
      [eventId, eventType]
    );

    // rowCount === 1: New event inserted successfully (should process)
    // rowCount === 0: Event already exists (duplicate, skip processing)
    const isNewEvent = result.rowCount === 1;

    if (!isNewEvent) {
      console.log(`[Idempotency] Duplicate webhook event detected: ${eventId} (${eventType})`);
    } else {
      console.log(`[Idempotency] New webhook event registered: ${eventId} (${eventType})`);
    }

    return isNewEvent;
  } catch (error) {
    console.error('[Idempotency] Error checking webhook idempotency:', error);
    throw new Error(`Idempotency check failed: ${(error as Error).message}`);
  }
}

/**
 * Clean up old processed webhook records
 *
 * Removes webhook records older than specified retention period.
 * Recommended to run this periodically (e.g., daily via scheduled Lambda)
 * to prevent unbounded table growth.
 *
 * @param client - PostgreSQL client
 * @param retentionDays - Number of days to retain webhook records (default: 90)
 * @returns Number of records deleted
 *
 * @example
 * ```typescript
 * const client = await pool.connect();
 * try {
 *   const deleted = await cleanupOldWebhooks(client, 90);
 *   console.log(`Cleaned up ${deleted} old webhook records`);
 * } finally {
 *   client.release();
 * }
 * ```
 */
export async function cleanupOldWebhooks(
  client: PoolClient,
  retentionDays: number = 90
): Promise<number> {
  try {
    const result = await client.query(
      `
      DELETE FROM processed_webhooks
      WHERE processed_at < NOW() - INTERVAL '${retentionDays} days'
      `
    );

    const deletedCount = result.rowCount || 0;
    console.log(`[Idempotency] Cleaned up ${deletedCount} webhook records older than ${retentionDays} days`);

    return deletedCount;
  } catch (error) {
    console.error('[Idempotency] Error cleaning up old webhooks:', error);
    throw new Error(`Webhook cleanup failed: ${(error as Error).message}`);
  }
}

/**
 * Get webhook processing statistics
 *
 * Returns statistics about processed webhooks for monitoring and debugging.
 *
 * @param client - PostgreSQL client
 * @param hours - Number of hours to look back (default: 24)
 * @returns Statistics object with event counts by type
 */
export async function getWebhookStats(
  client: PoolClient,
  hours: number = 24
): Promise<Record<string, number>> {
  try {
    const result = await client.query(
      `
      SELECT event_type, COUNT(*) as count
      FROM processed_webhooks
      WHERE processed_at > NOW() - INTERVAL '${hours} hours'
      GROUP BY event_type
      ORDER BY count DESC
      `
    );

    const stats: Record<string, number> = {};
    for (const row of result.rows) {
      stats[row.event_type] = parseInt(row.count, 10);
    }

    return stats;
  } catch (error) {
    console.error('[Idempotency] Error getting webhook stats:', error);
    throw new Error(`Webhook stats query failed: ${(error as Error).message}`);
  }
}
