/**
 * Tenant Management Functions
 * Handles tenant creation and listing
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../shared/db/index.js';
import { setCacheValue, getCacheValue, deleteCachePattern } from '../../shared/utils/redis.js';
import {
  TenantRow,
  TenantResponse,
  CreateTenantRequest,
  ListResponse,
  PaginationParams,
  CatalogCacheKeys,
  CatalogCacheTTL,
} from './types.js';

/**
 * Converts TenantRow to TenantResponse
 */
function toTenantResponse(row: TenantRow): TenantResponse {
  return {
    id: row.id,
    name: row.name,
    subdomain: row.subdomain,
    status: row.status,
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
 * Invalidates tenant cache
 */
async function invalidateTenantCache(tenantId?: string): Promise<void> {
  try {
    if (tenantId) {
      await deleteCachePattern(CatalogCacheKeys.tenant(tenantId));
    }
    await deleteCachePattern(CatalogCacheKeys.tenants());
  } catch (error) {
    console.warn('[Tenants] Failed to invalidate cache:', error);
  }
}

/**
 * Validates subdomain format
 * Must be lowercase alphanumeric with hyphens, 3-63 characters
 */
function validateSubdomain(subdomain: string): boolean {
  const regex = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;
  return regex.test(subdomain);
}

/**
 * GET /admin/tenants/{id}
 * Get a single tenant by ID
 */
export async function getTenant(tenantId: string): Promise<APIGatewayProxyResult> {
  try {
    // Check cache
    const cacheKey = CatalogCacheKeys.tenant(tenantId);
    try {
      const cached = await getCacheValue<TenantResponse>(cacheKey);
      if (cached) {
        console.log('[Tenants] Cache hit for single tenant');
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
          body: JSON.stringify(cached),
        };
      }
    } catch (cacheError) {
      console.warn('[Tenants] Cache read failed, continuing without cache:', cacheError);
    }

    const result = await query<TenantRow>(
      'SELECT * FROM tenants WHERE id = $1 AND deleted_at IS NULL',
      [tenantId]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Not Found',
          message: 'Tenant not found',
        }),
      };
    }

    const response = toTenantResponse(result.rows[0]!);

    // Cache response
    try {
      await setCacheValue(cacheKey, response, CatalogCacheTTL.TENANT);
    } catch (cacheError) {
      console.warn('[Tenants] Cache write failed, continuing without cache:', cacheError);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Tenants] Get error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to get tenant',
      }),
    };
  }
}

/**
 * GET /admin/tenants
 * List all tenants with pagination
 */
export async function listTenants(
  queryParams: Record<string, string | undefined> | null
): Promise<APIGatewayProxyResult> {
  try {
    const { page, per_page, offset } = parsePaginationParams(queryParams);
    const status = queryParams?.['status'];

    // Build cache key
    const cacheKey = status
      ? `${CatalogCacheKeys.tenants()}:status:${status}:page:${page}:per_page:${per_page}`
      : `${CatalogCacheKeys.tenants()}:page:${page}:per_page:${per_page}`;

    // Check cache
    const cached = await getCacheValue<ListResponse<TenantResponse>>(cacheKey);
    if (cached) {
      console.log('[Tenants] Cache hit for list');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
        body: JSON.stringify(cached),
      };
    }

    // Build query
    let countQuery = 'SELECT COUNT(*) as count FROM tenants WHERE deleted_at IS NULL';
    let listQuery = 'SELECT * FROM tenants WHERE deleted_at IS NULL';
    const values: unknown[] = [];

    if (status) {
      countQuery += ' AND status = $1';
      listQuery += ' AND status = $1';
      values.push(status);
    }

    // Get total count
    const countResult = await query<{ count: string }>(countQuery, values);
    const total = parseInt(countResult.rows[0]?.count || '0');

    // Get tenants
    listQuery += ' ORDER BY created_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    const result = await query<TenantRow>(listQuery, [...values, per_page, offset]);

    const items = result.rows.map(toTenantResponse);
    const hasMore = offset + items.length < total;

    const response: ListResponse<TenantResponse> = {
      items,
      total,
      page,
      per_page,
      has_more: hasMore,
    };

    // Cache response
    await setCacheValue(cacheKey, response, CatalogCacheTTL.TENANT);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Tenants] List error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to list tenants',
      }),
    };
  }
}

/**
 * POST /admin/tenants
 * Create a new tenant
 */
export async function createTenant(body: string): Promise<APIGatewayProxyResult> {
  try {
    const request: CreateTenantRequest = JSON.parse(body);

    // Validate required fields
    if (!request.name || !request.subdomain) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Missing required fields: name, subdomain',
        }),
      };
    }

    // Validate subdomain format
    if (!validateSubdomain(request.subdomain)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid subdomain format. Must be lowercase alphanumeric with hyphens, 3-63 characters',
        }),
      };
    }

    // Check if subdomain already exists
    const existingResult = await query<TenantRow>(
      'SELECT id FROM tenants WHERE subdomain = $1 AND deleted_at IS NULL',
      [request.subdomain]
    );

    if (existingResult.rows.length > 0) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          error: 'Conflict',
          message: 'Tenant with this subdomain already exists',
        }),
      };
    }

    // Create tenant
    const result = await query<TenantRow>(
      `INSERT INTO tenants (name, subdomain, status, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        request.name,
        request.subdomain.toLowerCase(),
        'active',
        JSON.stringify(request.metadata || {}),
      ]
    );

    const tenant = result.rows[0];
    if (!tenant) {
      throw new Error('Failed to create tenant');
    }

    // Invalidate cache
    await invalidateTenantCache();

    const response = toTenantResponse(tenant);

    console.log('[Tenants] Created tenant:', {
      id: response.id,
      subdomain: response.subdomain,
    });

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[Tenants] Create error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to create tenant',
      }),
    };
  }
}
