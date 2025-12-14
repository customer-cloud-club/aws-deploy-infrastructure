/**
 * Plan Management Functions
 * Handles CRUD operations for plans with Stripe integration
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import Stripe from 'stripe';
import { query, transaction } from '../../shared/db/index.js';
import { setCacheValue, getCacheValue, deleteCachePattern } from '../../shared/utils/redis.js';
import { getStripeApiKey } from '../../shared/utils/secrets.js';
import {
  PlanRow,
  PlanResponse,
  CreatePlanRequest,
  UpdatePlanRequest,
  ListResponse,
  PaginationParams,
  CatalogCacheKeys,
  CatalogCacheTTL,
} from './types.js';

/**
 * Lazily initialized Stripe client
 */
let stripeClient: Stripe | null = null;

/**
 * Get or initialize Stripe client
 */
async function getStripeClient(): Promise<Stripe> {
  if (!stripeClient) {
    const apiKey = await getStripeApiKey();
    stripeClient = new Stripe(apiKey, {
      apiVersion: '2023-10-16',
      typescript: true,
      appInfo: {
        name: 'CCAGI Catalog Service',
        version: '1.0.0',
      },
    });
    console.log('[Plans] Stripe client initialized');
  }
  return stripeClient;
}

/**
 * Converts PlanRow to PlanResponse
 */
function toPlanResponse(row: PlanRow): PlanResponse {
  return {
    id: row.id,
    product_id: row.product_id,
    name: row.name,
    stripe_price_id: row.stripe_price_id,
    billing_period: row.billing_period,
    price_amount: row.price_amount,
    currency: row.currency,
    trial_period_days: row.trial_period_days,
    is_active: row.is_active,
    metadata: row.metadata || {},
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/**
 * Parses pagination parameters from query string
 */
function parsePaginationParams(queryParams: Record<string, string | undefined> | null): PaginationParams {
  const page = Math.max(1, parseInt(queryParams?.['page'] || '1'));
  const perPage = Math.min(100, Math.max(1, parseInt(queryParams?.['per_page'] || '20')));
  const offset = (page - 1) * perPage;

  return { page, per_page: perPage, offset };
}

/**
 * Invalidates plan cache
 */
async function invalidatePlanCache(planId?: string, productId?: string): Promise<void> {
  try {
    if (planId) {
      await deleteCachePattern(CatalogCacheKeys.plan(planId));
    }
    if (productId) {
      await deleteCachePattern(CatalogCacheKeys.productPlans(productId));
    }
  } catch (error) {
    console.warn('[Plans] Failed to invalidate cache:', error);
  }
}

/**
 * Creates a Stripe Price for a plan
 */
async function createStripePrice(
  stripeProductId: string,
  request: CreatePlanRequest
): Promise<Stripe.Price> {
  try {
    console.log('[Plans] Creating Stripe Price:', {
      product: stripeProductId,
      amount: request.price_amount,
      currency: request.currency,
    });

    // Get Stripe client
    const stripe = await getStripeClient();

    // Determine recurring interval for Stripe
    let recurring: Stripe.PriceCreateParams.Recurring | undefined;
    if (request.billing_period === 'monthly') {
      recurring = { interval: 'month' };
    } else if (request.billing_period === 'yearly') {
      recurring = { interval: 'year' };
    }

    const priceParams: Stripe.PriceCreateParams = {
      product: stripeProductId,
      unit_amount: request.price_amount,
      currency: request.currency || 'jpy',
      nickname: request.name,
      metadata: {
        plan_name: request.name,
        billing_period: request.billing_period,
        ...(request.metadata || {}),
      },
    };

    // Add recurring interval if applicable
    if (recurring) {
      priceParams.recurring = recurring;
    }

    const price = await stripe.prices.create(priceParams);

    console.log('[Plans] Stripe Price created:', price.id);
    return price;
  } catch (error) {
    console.error('[Plans] Stripe Price creation failed:', error);
    throw new Error(
      `Failed to create Stripe Price: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * GET /admin/plans/{id}
 * Get a single plan by ID
 */
export async function getPlan(planId: string): Promise<APIGatewayProxyResult> {
  try {
    // Check cache
    const cacheKey = CatalogCacheKeys.plan(planId);
    let cached: PlanResponse | null = null;
    try {
      cached = await getCacheValue<PlanResponse>(cacheKey);
      if (cached) {
        console.log('[Plans] Cache hit for single plan');
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
          body: JSON.stringify(cached),
        };
      }
    } catch (cacheError) {
      console.warn('[Plans] Cache read failed, continuing without cache:', cacheError);
    }

    const result = await query<PlanRow>(
      'SELECT * FROM plans WHERE id = $1 AND deleted_at IS NULL',
      [planId]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Not Found',
          message: 'Plan not found',
        }),
      };
    }

    const response = toPlanResponse(result.rows[0]!);

    // Cache response
    try {
      await setCacheValue(cacheKey, response, CatalogCacheTTL.PLAN);
    } catch (cacheError) {
      console.warn('[Plans] Cache write failed, continuing without cache:', cacheError);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Plans] Get error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to get plan',
      }),
    };
  }
}

/**
 * GET /admin/plans
 * List all plans with optional product_id filter
 */
export async function listPlans(
  queryParams: Record<string, string | undefined> | null
): Promise<APIGatewayProxyResult> {
  try {
    const { page, per_page, offset } = parsePaginationParams(queryParams);
    const productId = queryParams?.['product_id'];

    // Build cache key
    const cacheKey = productId
      ? `${CatalogCacheKeys.productPlans(productId)}:page:${page}:per_page:${per_page}`
      : `catalog:plans:all:page:${page}:per_page:${per_page}`;

    // Check cache (graceful - don't fail if Redis is unavailable)
    try {
      const cached = await getCacheValue<ListResponse<PlanResponse>>(cacheKey);
      if (cached) {
        console.log('[Plans] Cache hit for list');
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
          body: JSON.stringify(cached),
        };
      }
    } catch (cacheError) {
      console.warn('[Plans] Cache read failed, continuing without cache:', cacheError);
    }

    // Build query
    let countQuery = 'SELECT COUNT(*) as count FROM plans WHERE deleted_at IS NULL';
    let listQuery = `SELECT * FROM plans WHERE deleted_at IS NULL`;
    const values: unknown[] = [];

    if (productId) {
      countQuery += ' AND product_id = $1';
      listQuery += ' AND product_id = $1';
      values.push(productId);
    }

    // Get total count
    const countResult = await query<{ count: string }>(countQuery, productId ? [productId] : []);
    const total = parseInt(countResult.rows[0]?.count || '0');

    // Get plans
    listQuery += ' ORDER BY created_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    const result = await query<PlanRow>(listQuery, [...values, per_page, offset]);

    const items = result.rows.map(toPlanResponse);
    const hasMore = offset + items.length < total;

    const response: ListResponse<PlanResponse> = {
      items,
      total,
      page,
      per_page,
      has_more: hasMore,
    };

    // Cache response (graceful - don't fail if Redis is unavailable)
    try {
      await setCacheValue(cacheKey, response, CatalogCacheTTL.PLAN);
    } catch (cacheError) {
      console.warn('[Plans] Cache write failed, continuing without cache:', cacheError);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Plans] List error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to list plans',
      }),
    };
  }
}

/**
 * POST /admin/plans
 * Create a new plan with Stripe Price integration
 */
export async function createPlan(body: string): Promise<APIGatewayProxyResult> {
  try {
    const request: CreatePlanRequest = JSON.parse(body);

    // Validate required fields
    if (!request.product_id || !request.name || !request.billing_period || request.price_amount === undefined) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Missing required fields: product_id, name, billing_period, price_amount',
        }),
      };
    }

    // Validate billing_period
    if (!['monthly', 'yearly', 'one_time'].includes(request.billing_period)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'billing_period must be one of: monthly, yearly, one_time',
        }),
      };
    }

    // Use transaction to ensure atomicity
    const result = await transaction(async (client) => {
      // Verify product exists and get Stripe Product ID
      const productResult = await client.query(
        'SELECT stripe_product_id FROM products WHERE id = $1 AND deleted_at IS NULL',
        [request.product_id]
      );

      if (productResult.rows.length === 0) {
        throw new Error('Product not found');
      }

      const stripeProductId = productResult.rows[0].stripe_product_id as string;

      // Create Stripe Price
      const stripePrice = await createStripePrice(stripeProductId, request);

      // Create plan in database
      const planResult = await client.query<PlanRow>(
        `INSERT INTO plans (
          product_id, name, stripe_price_id, billing_period,
          price_amount, currency, trial_period_days, is_active, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          request.product_id,
          request.name,
          stripePrice.id,
          request.billing_period,
          request.price_amount,
          request.currency || 'JPY',
          request.trial_period_days || null,
          request.is_active ?? true,
          JSON.stringify(request.metadata || {}),
        ]
      );

      return planResult.rows[0];
    });

    if (!result) {
      throw new Error('Failed to create plan');
    }

    // Invalidate cache
    await invalidatePlanCache(undefined, request.product_id);

    const response = toPlanResponse(result);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Plans] Create error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to create plan';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;

    return {
      statusCode,
      body: JSON.stringify({
        error: statusCode === 404 ? 'Not Found' : 'Internal Server Error',
        message: errorMessage,
      }),
    };
  }
}

/**
 * PUT /admin/plans/{id}
 * Update an existing plan (Stripe Price is immutable, only DB fields updated)
 */
export async function updatePlan(planId: string, body: string): Promise<APIGatewayProxyResult> {
  try {
    const request: UpdatePlanRequest = JSON.parse(body);

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (request.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(request.name);
    }
    if (request.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(request.is_active);
    }
    if (request.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(request.metadata));
    }

    if (updates.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'No fields to update',
        }),
      };
    }

    // Add plan ID to values
    values.push(planId);

    const result = await query<PlanRow>(
      `UPDATE plans
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Not Found',
          message: 'Plan not found',
        }),
      };
    }

    const plan = result.rows[0]!;

    // Invalidate cache
    await invalidatePlanCache(planId, plan.product_id);

    const response = toPlanResponse(plan);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Plans] Update error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to update plan',
      }),
    };
  }
}

/**
 * DELETE /admin/plans/{id}
 * Soft delete a plan (archives in Stripe)
 */
export async function deletePlan(planId: string): Promise<APIGatewayProxyResult> {
  try {
    // Use transaction to soft delete plan and archive Stripe Price
    const result = await transaction(async (client) => {
      // Check if plan has active subscriptions
      const subCheck = await client.query(
        `SELECT COUNT(*) as count FROM subscriptions
         WHERE plan_id = $1 AND status IN ('active', 'trialing') AND deleted_at IS NULL`,
        [planId]
      );

      const activeSubsCount = parseInt(subCheck.rows[0]?.count || '0');
      if (activeSubsCount > 0) {
        throw new Error(
          `Cannot delete plan with ${activeSubsCount} active subscription(s). Cancel subscriptions first.`
        );
      }

      // Get plan details
      const planResult = await client.query<PlanRow>(
        'SELECT * FROM plans WHERE id = $1 AND deleted_at IS NULL',
        [planId]
      );

      if (planResult.rows.length === 0) {
        return null;
      }

      const plan = planResult.rows[0]!;

      // Archive Stripe Price
      try {
        const stripe = await getStripeClient();
        await stripe.prices.update(plan.stripe_price_id, {
          active: false,
        });
        console.log('[Plans] Stripe Price archived:', plan.stripe_price_id);
      } catch (stripeError) {
        console.warn('[Plans] Failed to archive Stripe Price:', stripeError);
        // Continue with soft delete even if Stripe update fails
      }

      // Soft delete plan
      await client.query(
        `UPDATE plans
         SET deleted_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [planId]
      );

      return plan;
    });

    if (!result) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Not Found',
          message: 'Plan not found',
        }),
      };
    }

    // Invalidate cache
    await invalidatePlanCache(planId, result.product_id);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Plan deleted successfully',
        id: planId,
      }),
    };
  } catch (error) {
    console.error('[Plans] Delete error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to delete plan';
    const statusCode = errorMessage.includes('Cannot delete plan') ? 409 : 500;

    return {
      statusCode,
      body: JSON.stringify({
        error: statusCode === 409 ? 'Conflict' : 'Internal Server Error',
        message: errorMessage,
      }),
    };
  }
}
