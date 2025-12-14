/**
 * Product Management Functions
 * Handles CRUD operations for products
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { query, transaction } from '../../shared/db/index.js';
import { setCacheValue, getCacheValue, deleteCachePattern } from '../../shared/utils/redis.js';
import {
  ProductRow,
  ProductResponse,
  CreateProductRequest,
  UpdateProductRequest,
  ListResponse,
  PaginationParams,
  CatalogCacheKeys,
  CatalogCacheTTL,
} from './types.js';

/**
 * Converts ProductRow to ProductResponse
 */
function toProductResponse(row: ProductRow): ProductResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    stripe_product_id: row.stripe_product_id,
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
 * Invalidates product cache
 */
async function invalidateProductCache(productId?: string): Promise<void> {
  try {
    if (productId) {
      await deleteCachePattern(CatalogCacheKeys.product(productId));
    }
    await deleteCachePattern(CatalogCacheKeys.products());
  } catch (error) {
    console.warn('[Products] Failed to invalidate cache:', error);
  }
}

/**
 * GET /admin/products
 * List all products with pagination
 */
export async function listProducts(
  queryParams: Record<string, string | undefined> | null
): Promise<APIGatewayProxyResult> {
  try {
    const { page, per_page, offset } = parsePaginationParams(queryParams);

    // Check cache (graceful - don't fail if Redis is unavailable)
    const cacheKey = `${CatalogCacheKeys.products()}:page:${page}:per_page:${per_page}`;
    let cached: ListResponse<ProductResponse> | null = null;
    try {
      cached = await getCacheValue<ListResponse<ProductResponse>>(cacheKey);
      if (cached) {
        console.log('[Products] Cache hit for list');
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
          body: JSON.stringify(cached),
        };
      }
    } catch (cacheError) {
      console.warn('[Products] Cache read failed, continuing without cache:', cacheError);
    }

    // Get total count
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL'
    );
    const total = parseInt(countResult.rows[0]?.count || '0');

    // Get products
    const result = await query<ProductRow>(
      `SELECT * FROM products
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [per_page, offset]
    );

    const items = result.rows.map(toProductResponse);
    const hasMore = offset + items.length < total;

    const response: ListResponse<ProductResponse> = {
      items,
      total,
      page,
      per_page,
      has_more: hasMore,
    };

    // Cache response (graceful - don't fail if Redis is unavailable)
    try {
      await setCacheValue(cacheKey, response, CatalogCacheTTL.PRODUCT);
    } catch (cacheError) {
      console.warn('[Products] Cache write failed, continuing without cache:', cacheError);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Products] List error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to list products',
      }),
    };
  }
}

/**
 * POST /admin/products
 * Create a new product
 */
export async function createProduct(body: string): Promise<APIGatewayProxyResult> {
  try {
    const request: CreateProductRequest = JSON.parse(body);

    // Validate required fields
    if (!request.name || !request.stripe_product_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Missing required fields: name, stripe_product_id',
        }),
      };
    }

    // Check if stripe_product_id already exists
    const existingResult = await query<ProductRow>(
      'SELECT id FROM products WHERE stripe_product_id = $1 AND deleted_at IS NULL',
      [request.stripe_product_id]
    );

    if (existingResult.rows.length > 0) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          error: 'Conflict',
          message: 'Product with this Stripe Product ID already exists',
        }),
      };
    }

    // Create product
    const result = await query<ProductRow>(
      `INSERT INTO products (name, description, stripe_product_id, is_active, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        request.name,
        request.description || null,
        request.stripe_product_id,
        request.is_active ?? true,
        JSON.stringify(request.metadata || {}),
      ]
    );

    const product = result.rows[0];
    if (!product) {
      throw new Error('Failed to create product');
    }

    // Invalidate cache
    await invalidateProductCache();

    const response = toProductResponse(product);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Products] Create error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to create product',
      }),
    };
  }
}

/**
 * PUT /admin/products/{id}
 * Update an existing product
 */
export async function updateProduct(
  productId: string,
  body: string
): Promise<APIGatewayProxyResult> {
  try {
    const request: UpdateProductRequest = JSON.parse(body);

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (request.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(request.name);
    }
    if (request.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(request.description);
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

    // Add product ID to values
    values.push(productId);

    const result = await query<ProductRow>(
      `UPDATE products
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
          message: 'Product not found',
        }),
      };
    }

    const product = result.rows[0]!;

    // Invalidate cache
    await invalidateProductCache(productId);

    const response = toProductResponse(product);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Products] Update error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to update product',
      }),
    };
  }
}

/**
 * DELETE /admin/products/{id}
 * Soft delete a product
 */
export async function deleteProduct(productId: string): Promise<APIGatewayProxyResult> {
  try {
    // Use transaction to soft delete product and associated plans
    const result = await transaction(async (client) => {
      // Check if product has active plans
      const planCheck = await client.query(
        `SELECT COUNT(*) as count FROM plans
         WHERE product_id = $1 AND is_active = true AND deleted_at IS NULL`,
        [productId]
      );

      const activePlansCount = parseInt(planCheck.rows[0]?.count || '0');
      if (activePlansCount > 0) {
        throw new Error(
          `Cannot delete product with ${activePlansCount} active plan(s). Deactivate plans first.`
        );
      }

      // Soft delete product
      const deleteResult = await client.query<ProductRow>(
        `UPDATE products
         SET deleted_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [productId]
      );

      return deleteResult.rows[0];
    });

    if (!result) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Not Found',
          message: 'Product not found',
        }),
      };
    }

    // Invalidate cache
    await invalidateProductCache(productId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Product deleted successfully',
        id: productId,
      }),
    };
  } catch (error) {
    console.error('[Products] Delete error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to delete product';
    const statusCode = errorMessage.includes('Cannot delete product') ? 409 : 500;

    return {
      statusCode,
      body: JSON.stringify({
        error: statusCode === 409 ? 'Conflict' : 'Internal Server Error',
        message: errorMessage,
      }),
    };
  }
}
