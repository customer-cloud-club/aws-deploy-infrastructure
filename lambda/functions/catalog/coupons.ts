/**
 * Coupon Management Functions
 * Handles CRUD operations for coupons with Stripe integration
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import Stripe from 'stripe';
import { query, transaction } from '../../shared/db/index.js';
import { setCacheValue, getCacheValue, deleteCachePattern } from '../../shared/utils/redis.js';
import { getStripeApiKey } from '../../shared/utils/secrets.js';
import {
  CouponRow,
  CouponResponse,
  CreateCouponRequest,
  UpdateCouponRequest,
  PromotionCodeRow,
  PromotionCodeResponse,
  CreatePromotionCodeRequest,
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
    console.log('[Coupons] Stripe client initialized');
  }
  return stripeClient;
}

/**
 * Converts CouponRow to CouponResponse
 */
function toCouponResponse(row: CouponRow): CouponResponse {
  return {
    id: row.id,
    stripe_coupon_id: row.stripe_coupon_id,
    name: row.name,
    percent_off: row.percent_off,
    amount_off: row.amount_off,
    currency: row.currency,
    duration: row.duration,
    duration_in_months: row.duration_in_months,
    max_redemptions: row.max_redemptions,
    times_redeemed: row.times_redeemed,
    redeem_by: row.redeem_by ? row.redeem_by.toISOString() : null,
    is_active: row.is_active,
    metadata: row.metadata || {},
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/**
 * Converts PromotionCodeRow to PromotionCodeResponse
 */
function toPromotionCodeResponse(row: PromotionCodeRow, coupon?: CouponRow): PromotionCodeResponse {
  return {
    id: row.id,
    stripe_promotion_code_id: row.stripe_promotion_code_id,
    coupon_id: row.coupon_id,
    code: row.code,
    is_active: row.is_active,
    max_redemptions: row.max_redemptions,
    times_redeemed: row.times_redeemed,
    expires_at: row.expires_at ? row.expires_at.toISOString() : null,
    minimum_amount: row.minimum_amount,
    minimum_amount_currency: row.minimum_amount_currency,
    first_time_transaction: row.first_time_transaction,
    metadata: row.metadata || {},
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    coupon: coupon ? toCouponResponse(coupon) : undefined,
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
 * Invalidates coupon cache
 */
async function invalidateCouponCache(couponId?: string): Promise<void> {
  try {
    if (couponId) {
      await deleteCachePattern(CatalogCacheKeys.coupon(couponId));
    }
    await deleteCachePattern(CatalogCacheKeys.coupons());
  } catch (error) {
    console.warn('[Coupons] Failed to invalidate cache:', error);
  }
}

/**
 * Invalidates promotion code cache
 */
async function invalidatePromotionCodeCache(codeId?: string): Promise<void> {
  try {
    if (codeId) {
      await deleteCachePattern(CatalogCacheKeys.promotionCode(codeId));
    }
    await deleteCachePattern(CatalogCacheKeys.promotionCodes());
  } catch (error) {
    console.warn('[Coupons] Failed to invalidate promotion code cache:', error);
  }
}

// ============================================
// Coupon CRUD Operations
// ============================================

/**
 * GET /admin/coupons/{id}
 * Get a single coupon by ID
 */
export async function getCoupon(couponId: string): Promise<APIGatewayProxyResult> {
  try {
    // Check cache
    const cacheKey = CatalogCacheKeys.coupon(couponId);
    try {
      const cached = await getCacheValue<CouponResponse>(cacheKey);
      if (cached) {
        console.log('[Coupons] Cache hit for single coupon');
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
          body: JSON.stringify(cached),
        };
      }
    } catch (cacheError) {
      console.warn('[Coupons] Cache read failed:', cacheError);
    }

    const result = await query<CouponRow>(
      'SELECT * FROM coupons WHERE id = $1 AND deleted_at IS NULL',
      [couponId]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Not Found', message: 'Coupon not found' }),
      };
    }

    const response = toCouponResponse(result.rows[0]!);

    // Cache response
    try {
      await setCacheValue(cacheKey, response, CatalogCacheTTL.COUPON);
    } catch (cacheError) {
      console.warn('[Coupons] Cache write failed:', cacheError);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Coupons] Get error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal Server Error', message: 'Failed to get coupon' }),
    };
  }
}

/**
 * GET /admin/coupons
 * List all coupons
 */
export async function listCoupons(
  queryParams: Record<string, string | undefined> | null
): Promise<APIGatewayProxyResult> {
  try {
    const { page, per_page, offset } = parsePaginationParams(queryParams);
    const activeOnly = queryParams?.['active'] === 'true';

    // Build cache key
    const cacheKey = `${CatalogCacheKeys.coupons()}:page:${page}:per_page:${per_page}:active:${activeOnly}`;

    // Check cache
    try {
      const cached = await getCacheValue<ListResponse<CouponResponse>>(cacheKey);
      if (cached) {
        console.log('[Coupons] Cache hit for list');
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
          body: JSON.stringify(cached),
        };
      }
    } catch (cacheError) {
      console.warn('[Coupons] Cache read failed:', cacheError);
    }

    // Build query
    let countQuery = 'SELECT COUNT(*) as count FROM coupons WHERE deleted_at IS NULL';
    let listQuery = 'SELECT * FROM coupons WHERE deleted_at IS NULL';

    if (activeOnly) {
      countQuery += ' AND is_active = true';
      listQuery += ' AND is_active = true';
    }

    // Get total count
    const countResult = await query<{ count: string }>(countQuery, []);
    const total = parseInt(countResult.rows[0]?.count || '0');

    // Get coupons
    listQuery += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
    const result = await query<CouponRow>(listQuery, [per_page, offset]);

    const items = result.rows.map(toCouponResponse);
    const hasMore = offset + items.length < total;

    const response: ListResponse<CouponResponse> = {
      items,
      total,
      page,
      per_page,
      has_more: hasMore,
    };

    // Cache response
    try {
      await setCacheValue(cacheKey, response, CatalogCacheTTL.COUPON);
    } catch (cacheError) {
      console.warn('[Coupons] Cache write failed:', cacheError);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Coupons] List error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', message: 'Failed to list coupons' }),
    };
  }
}

/**
 * POST /admin/coupons
 * Create a new coupon with Stripe integration
 */
export async function createCoupon(body: string): Promise<APIGatewayProxyResult> {
  try {
    const request: CreateCouponRequest = JSON.parse(body);

    // Validate required fields
    if (!request.name || !request.duration) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Missing required fields: name, duration',
        }),
      };
    }

    // Validate discount type
    if (!request.percent_off && !request.amount_off) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Either percent_off or amount_off is required',
        }),
      };
    }

    if (request.percent_off && request.amount_off) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Cannot specify both percent_off and amount_off',
        }),
      };
    }

    // Validate percent_off range
    if (request.percent_off && (request.percent_off < 1 || request.percent_off > 100)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'percent_off must be between 1 and 100',
        }),
      };
    }

    // Validate currency for amount_off
    if (request.amount_off && !request.currency) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'currency is required when using amount_off',
        }),
      };
    }

    // Validate duration
    if (!['once', 'repeating', 'forever'].includes(request.duration)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'duration must be one of: once, repeating, forever',
        }),
      };
    }

    // Validate duration_in_months for repeating
    if (request.duration === 'repeating' && !request.duration_in_months) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'duration_in_months is required for repeating duration',
        }),
      };
    }

    // Create Stripe coupon
    const stripe = await getStripeClient();

    const couponParams: Stripe.CouponCreateParams = {
      name: request.name,
      duration: request.duration,
      metadata: (request.metadata as Record<string, string>) || {},
    };

    if (request.percent_off) {
      couponParams.percent_off = request.percent_off;
    }

    if (request.amount_off) {
      couponParams.amount_off = request.amount_off;
      couponParams.currency = request.currency!.toLowerCase();
    }

    if (request.duration === 'repeating') {
      couponParams.duration_in_months = request.duration_in_months;
    }

    if (request.max_redemptions) {
      couponParams.max_redemptions = request.max_redemptions;
    }

    if (request.redeem_by) {
      couponParams.redeem_by = Math.floor(new Date(request.redeem_by).getTime() / 1000);
    }

    console.log('[Coupons] Creating Stripe coupon:', couponParams);
    const stripeCoupon = await stripe.coupons.create(couponParams);
    console.log('[Coupons] Stripe coupon created:', stripeCoupon.id);

    // Save to database
    const result = await query<CouponRow>(
      `INSERT INTO coupons (
        stripe_coupon_id, name, percent_off, amount_off, currency,
        duration, duration_in_months, max_redemptions, redeem_by, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        stripeCoupon.id,
        request.name,
        request.percent_off || null,
        request.amount_off || null,
        request.currency?.toUpperCase() || null,
        request.duration,
        request.duration_in_months || null,
        request.max_redemptions || null,
        request.redeem_by ? new Date(request.redeem_by) : null,
        JSON.stringify(request.metadata || {}),
      ]
    );

    // Invalidate cache
    await invalidateCouponCache();

    const response = toCouponResponse(result.rows[0]!);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Coupons] Create error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to create coupon',
      }),
    };
  }
}

/**
 * PUT /admin/coupons/{id}
 * Update a coupon (limited - Stripe coupons are mostly immutable)
 */
export async function updateCoupon(couponId: string, body: string): Promise<APIGatewayProxyResult> {
  try {
    const request: UpdateCouponRequest = JSON.parse(body);

    // Get current coupon
    const currentResult = await query<CouponRow>(
      'SELECT * FROM coupons WHERE id = $1 AND deleted_at IS NULL',
      [couponId]
    );

    if (currentResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Not Found', message: 'Coupon not found' }),
      };
    }

    const currentCoupon = currentResult.rows[0]!;

    // Update Stripe coupon name if changed
    if (request.name && request.name !== currentCoupon.name) {
      const stripe = await getStripeClient();
      await stripe.coupons.update(currentCoupon.stripe_coupon_id, {
        name: request.name,
        metadata: (request.metadata || currentCoupon.metadata) as Record<string, string>,
      });
    }

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (request.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(request.name);
    }
    if (request.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(request.metadata));
    }

    if (updates.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Bad Request', message: 'No fields to update' }),
      };
    }

    values.push(couponId);

    const result = await query<CouponRow>(
      `UPDATE coupons SET ${updates.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
      values
    );

    // Invalidate cache
    await invalidateCouponCache(couponId);

    const response = toCouponResponse(result.rows[0]!);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Coupons] Update error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', message: 'Failed to update coupon' }),
    };
  }
}

/**
 * DELETE /admin/coupons/{id}
 * Delete (deactivate) a coupon
 */
export async function deleteCoupon(couponId: string): Promise<APIGatewayProxyResult> {
  try {
    // Get coupon
    const result = await query<CouponRow>(
      'SELECT * FROM coupons WHERE id = $1 AND deleted_at IS NULL',
      [couponId]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Not Found', message: 'Coupon not found' }),
      };
    }

    const coupon = result.rows[0]!;

    // Delete from Stripe
    try {
      const stripe = await getStripeClient();
      await stripe.coupons.del(coupon.stripe_coupon_id);
      console.log('[Coupons] Stripe coupon deleted:', coupon.stripe_coupon_id);
    } catch (stripeError) {
      console.warn('[Coupons] Failed to delete Stripe coupon:', stripeError);
    }

    // Soft delete in database
    await query(
      'UPDATE coupons SET deleted_at = CURRENT_TIMESTAMP, is_active = false WHERE id = $1',
      [couponId]
    );

    // Invalidate cache
    await invalidateCouponCache(couponId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Coupon deleted successfully', id: couponId }),
    };
  } catch (error) {
    console.error('[Coupons] Delete error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', message: 'Failed to delete coupon' }),
    };
  }
}

// ============================================
// Promotion Code CRUD Operations
// ============================================

/**
 * GET /admin/promotion-codes/{id}
 * Get a single promotion code by ID
 */
export async function getPromotionCode(codeId: string): Promise<APIGatewayProxyResult> {
  try {
    const result = await query<PromotionCodeRow & { coupon_data: CouponRow }>(
      `SELECT pc.*, c.* as coupon_data
       FROM promotion_codes pc
       LEFT JOIN coupons c ON pc.coupon_id = c.id
       WHERE pc.id = $1 AND pc.deleted_at IS NULL`,
      [codeId]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Not Found', message: 'Promotion code not found' }),
      };
    }

    const row = result.rows[0]!;

    // Get coupon separately for proper type handling
    const couponResult = await query<CouponRow>(
      'SELECT * FROM coupons WHERE id = $1',
      [row.coupon_id]
    );

    const response = toPromotionCodeResponse(row as PromotionCodeRow, couponResult.rows[0]);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Coupons] Get promotion code error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal Server Error', message: 'Failed to get promotion code' }),
    };
  }
}

/**
 * GET /admin/promotion-codes
 * List all promotion codes
 */
export async function listPromotionCodes(
  queryParams: Record<string, string | undefined> | null
): Promise<APIGatewayProxyResult> {
  try {
    const { page, per_page, offset } = parsePaginationParams(queryParams);
    const couponId = queryParams?.['coupon_id'];

    // Build query
    let countQuery = 'SELECT COUNT(*) as count FROM promotion_codes WHERE deleted_at IS NULL';
    let listQuery = `
      SELECT pc.*, c.name as coupon_name, c.percent_off, c.amount_off, c.currency as coupon_currency
      FROM promotion_codes pc
      LEFT JOIN coupons c ON pc.coupon_id = c.id
      WHERE pc.deleted_at IS NULL
    `;
    const values: unknown[] = [];

    if (couponId) {
      countQuery += ' AND coupon_id = $1';
      listQuery += ' AND pc.coupon_id = $1';
      values.push(couponId);
    }

    // Get total count
    const countResult = await query<{ count: string }>(countQuery, couponId ? [couponId] : []);
    const total = parseInt(countResult.rows[0]?.count || '0');

    // Get promotion codes
    listQuery += ` ORDER BY pc.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    const result = await query<PromotionCodeRow>(listQuery, [...values, per_page, offset]);

    const items = result.rows.map((row) => toPromotionCodeResponse(row));
    const hasMore = offset + items.length < total;

    const response: ListResponse<PromotionCodeResponse> = {
      items,
      total,
      page,
      per_page,
      has_more: hasMore,
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Coupons] List promotion codes error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', message: 'Failed to list promotion codes' }),
    };
  }
}

/**
 * POST /admin/promotion-codes
 * Create a new promotion code
 */
export async function createPromotionCode(body: string): Promise<APIGatewayProxyResult> {
  try {
    const request: CreatePromotionCodeRequest = JSON.parse(body);

    // Validate required fields
    if (!request.coupon_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Bad Request', message: 'coupon_id is required' }),
      };
    }

    // Get coupon
    const couponResult = await query<CouponRow>(
      'SELECT * FROM coupons WHERE id = $1 AND deleted_at IS NULL',
      [request.coupon_id]
    );

    if (couponResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Not Found', message: 'Coupon not found' }),
      };
    }

    const coupon = couponResult.rows[0]!;

    // Create Stripe promotion code
    const stripe = await getStripeClient();

    const promoParams: Stripe.PromotionCodeCreateParams = {
      coupon: coupon.stripe_coupon_id,
      metadata: (request.metadata as Record<string, string>) || {},
    };

    if (request.code) {
      promoParams.code = request.code;
    }

    if (request.max_redemptions) {
      promoParams.max_redemptions = request.max_redemptions;
    }

    if (request.expires_at) {
      promoParams.expires_at = Math.floor(new Date(request.expires_at).getTime() / 1000);
    }

    if (request.minimum_amount || request.first_time_transaction) {
      promoParams.restrictions = {};
      if (request.minimum_amount) {
        promoParams.restrictions.minimum_amount = request.minimum_amount;
        promoParams.restrictions.minimum_amount_currency = request.minimum_amount_currency?.toLowerCase() || 'jpy';
      }
      if (request.first_time_transaction) {
        promoParams.restrictions.first_time_transaction = true;
      }
    }

    console.log('[Coupons] Creating Stripe promotion code:', promoParams);
    const stripePromoCode = await stripe.promotionCodes.create(promoParams);
    console.log('[Coupons] Stripe promotion code created:', stripePromoCode.id);

    // Save to database
    const result = await query<PromotionCodeRow>(
      `INSERT INTO promotion_codes (
        stripe_promotion_code_id, coupon_id, code, max_redemptions,
        expires_at, minimum_amount, minimum_amount_currency, first_time_transaction, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        stripePromoCode.id,
        request.coupon_id,
        stripePromoCode.code,
        request.max_redemptions || null,
        request.expires_at ? new Date(request.expires_at) : null,
        request.minimum_amount || null,
        request.minimum_amount_currency?.toUpperCase() || null,
        request.first_time_transaction || false,
        JSON.stringify(request.metadata || {}),
      ]
    );

    // Invalidate cache
    await invalidatePromotionCodeCache();

    const response = toPromotionCodeResponse(result.rows[0]!, coupon);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Coupons] Create promotion code error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to create promotion code',
      }),
    };
  }
}

/**
 * DELETE /admin/promotion-codes/{id}
 * Deactivate a promotion code
 */
export async function deletePromotionCode(codeId: string): Promise<APIGatewayProxyResult> {
  try {
    // Get promotion code
    const result = await query<PromotionCodeRow>(
      'SELECT * FROM promotion_codes WHERE id = $1 AND deleted_at IS NULL',
      [codeId]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Not Found', message: 'Promotion code not found' }),
      };
    }

    const promoCode = result.rows[0]!;

    // Deactivate in Stripe
    try {
      const stripe = await getStripeClient();
      await stripe.promotionCodes.update(promoCode.stripe_promotion_code_id, {
        active: false,
      });
      console.log('[Coupons] Stripe promotion code deactivated:', promoCode.stripe_promotion_code_id);
    } catch (stripeError) {
      console.warn('[Coupons] Failed to deactivate Stripe promotion code:', stripeError);
    }

    // Soft delete in database
    await query(
      'UPDATE promotion_codes SET deleted_at = CURRENT_TIMESTAMP, is_active = false WHERE id = $1',
      [codeId]
    );

    // Invalidate cache
    await invalidatePromotionCodeCache(codeId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Promotion code deleted successfully', id: codeId }),
    };
  } catch (error) {
    console.error('[Coupons] Delete promotion code error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', message: 'Failed to delete promotion code' }),
    };
  }
}
