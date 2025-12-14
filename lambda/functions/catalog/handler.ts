/**
 * Catalog Service Lambda Handler
 * Manages products, plans, tenants, dashboard, and users
 *
 * Public Endpoints (no auth required):
 * - GET    /catalog/products        - List products (public)
 * - GET    /catalog/plans           - List plans (public)
 *
 * Admin Endpoints (admin auth required):
 * - GET    /admin/products          - List products
 * - POST   /admin/products          - Create product
 * - PUT    /admin/products/{id}     - Update product
 * - DELETE /admin/products/{id}     - Delete product
 * - GET    /admin/plans             - List plans
 * - POST   /admin/plans             - Create plan (with Stripe integration)
 * - PUT    /admin/plans/{id}        - Update plan
 * - DELETE /admin/plans/{id}        - Delete plan
 * - GET    /admin/tenants           - List tenants
 * - POST   /admin/tenants           - Create tenant
 *
 * Dashboard Endpoints (admin auth required):
 * - GET    /admin/dashboard         - Dashboard statistics
 * - GET    /admin/dashboard/revenue - Revenue over time
 * - GET    /admin/dashboard/users   - User growth over time
 * - GET    /admin/dashboard/activity - Recent activity
 *
 * User Management Endpoints (admin auth required):
 * - GET    /admin/users             - List users (Cognito)
 * - GET    /admin/users/{id}        - Get user
 * - GET    /admin/users/{id}/logins - Get user's product login history
 * - POST   /admin/users             - Create user
 * - PUT    /admin/users/{id}        - Update user
 * - DELETE /admin/users/{id}        - Disable user
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult, APIGatewayProxyEventQueryStringParameters } from 'aws-lambda';
import { initializeDatabase } from '../../shared/db/index.js';
import { getProduct, listProducts, createProduct, updateProduct, deleteProduct } from './products.js';
import { getPlan, listPlans, createPlan, updatePlan, deletePlan } from './plans.js';
import { getTenant, listTenants, createTenant } from './tenants.js';
import { getDashboardStats, getRevenueData, getUserGrowthData, getRecentActivity } from '../admin/dashboard.js';
import { listUsers, getUser, createUser, updateUser, deleteUser, getUserLogins } from '../admin/users.js';
import { AdminCheckResult } from './types.js';

/**
 * Check if user has admin role
 * Checks multiple sources: custom:role claim, Cognito groups, or authorizer role
 */
function checkAdminRole(event: Parameters<APIGatewayProxyHandler>[0]): AdminCheckResult {
  const authorizer = event.requestContext?.authorizer;
  const claims = authorizer?.['claims'] || {};

  // Get role from multiple sources
  const customRole = claims['custom:role'];
  const authorizerRole = authorizer?.['role'];

  // Check Cognito groups (added to ID token by Cognito)
  // Groups can be a string (single group) or an array (multiple groups)
  const cognitoGroups = claims['cognito:groups'];
  const groups: string[] = cognitoGroups
    ? (typeof cognitoGroups === 'string' ? [cognitoGroups] : cognitoGroups)
    : [];

  const isInAdminGroup = groups.includes('admin');

  // User is admin if any of these conditions are true:
  // 1. custom:role claim is 'admin'
  // 2. User is in 'admin' Cognito group
  // 3. authorizer role is 'admin'
  const isAdmin = customRole === 'admin' || isInAdminGroup || authorizerRole === 'admin';
  const role = customRole || (isInAdminGroup ? 'admin' : authorizerRole);

  const userId = claims['sub'] || authorizer?.['user_id'];

  console.log('[Auth] Role check:', {
    customRole,
    authorizerRole,
    groups,
    isInAdminGroup,
    isAdmin,
    userId
  });

  return {
    is_admin: isAdmin,
    role,
    user_id: userId,
  };
}

/**
 * Extracts resource ID from path
 * Example: /admin/products/123 -> 123
 */
function extractResourceId(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  // Expected: ['admin', 'products', '{id}']
  if (parts.length >= 3) {
    return parts[2] || null;
  }
  return null;
}

/**
 * Determines resource type from path
 * Example: /admin/products -> 'products'
 * Example: /catalog/products -> 'products'
 */
function getResourceType(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  // Expected: ['admin', 'products', ...] or ['catalog', 'products', ...]
  if (parts.length >= 2 && (parts[0] === 'admin' || parts[0] === 'catalog')) {
    return parts[1] || null;
  }
  return null;
}

/**
 * Checks if path is a public catalog path (no auth required)
 */
function isPublicCatalogPath(path: string): boolean {
  const parts = path.split('/').filter(Boolean);
  return parts[0] === 'catalog';
}

/**
 * Main Lambda handler
 */
export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Handle OPTIONS for CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: '',
      };
    }

    // Initialize database connection (reused across invocations)
    await initializeDatabase();

    const method = event.httpMethod;
    const path = event.path || '';
    const isPublic = isPublicCatalogPath(path);

    // Check admin authorization for non-public paths
    if (!isPublic) {
      const authCheck = checkAdminRole(event);
      if (!authCheck.is_admin) {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Forbidden',
            message: 'Admin role required',
          }),
        };
      }
    }

    // Public catalog paths only allow GET requests
    if (isPublic && method !== 'GET') {
      return {
        statusCode: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Method Not Allowed',
          message: 'Only GET requests are allowed for public catalog',
        }),
      };
    }

    const resourceType = getResourceType(path);
    const resourceId = extractResourceId(path);

    console.log('[Catalog] Request:', {
      method,
      path,
      resourceType,
      resourceId,
      isPublic,
    });

    let result: APIGatewayProxyResult;

    // Route to appropriate handler
    switch (resourceType) {
      case 'products':
        result = await handleProductsRoute(method, resourceId, event.body, event.queryStringParameters);
        break;

      case 'plans':
        result = await handlePlansRoute(method, resourceId, event.body, event.queryStringParameters);
        break;

      case 'tenants':
        result = await handleTenantsRoute(method, resourceId, event.body, event.queryStringParameters);
        break;

      case 'dashboard':
        result = await handleDashboardRoute(method, path);
        break;

      case 'users':
        result = await handleUsersRoute(method, resourceId, event.body, event.queryStringParameters, path);
        break;

      default:
        result = {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Not Found',
            message: 'Resource not found',
          }),
        };
    }

    // Add CORS headers to response
    const duration = Date.now() - startTime;
    result.headers = {
      ...corsHeaders,
      ...result.headers,
      'X-Response-Time': `${duration}ms`,
    };

    console.log('[Catalog] Response:', {
      statusCode: result.statusCode,
      duration: `${duration}ms`,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Catalog] Error:', error);

    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Response-Time': `${duration}ms`,
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        details: process.env['ENVIRONMENT'] === 'development'
          ? (error as Error).message
          : undefined,
      }),
    };
  }
};

/**
 * Handles /admin/products routes
 */
async function handleProductsRoute(
  method: string,
  resourceId: string | null,
  body: string | null,
  queryParams: APIGatewayProxyEventQueryStringParameters | null
): Promise<APIGatewayProxyResult> {
  switch (method) {
    case 'GET':
      if (resourceId) {
        // GET /admin/products/{id}
        return getProduct(resourceId);
      }
      // GET /admin/products
      return listProducts(queryParams);

    case 'POST':
      if (!body) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'Request body required',
          }),
        };
      }
      // POST /admin/products
      return createProduct(body);

    case 'PUT':
      if (!resourceId || !body) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'Resource ID and request body required',
          }),
        };
      }
      // PUT /admin/products/{id}
      return updateProduct(resourceId, body);

    case 'DELETE':
      if (!resourceId) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'Resource ID required',
          }),
        };
      }
      // DELETE /admin/products/{id}
      return deleteProduct(resourceId);

    default:
      return {
        statusCode: 405,
        body: JSON.stringify({
          error: 'Method Not Allowed',
          message: `Method ${method} not allowed for products`,
        }),
      };
  }
}

/**
 * Handles /admin/plans routes
 */
async function handlePlansRoute(
  method: string,
  resourceId: string | null,
  body: string | null,
  queryParams: APIGatewayProxyEventQueryStringParameters | null
): Promise<APIGatewayProxyResult> {
  switch (method) {
    case 'GET':
      if (resourceId) {
        // GET /admin/plans/{id}
        return getPlan(resourceId);
      }
      // GET /admin/plans
      return listPlans(queryParams);

    case 'POST':
      if (!body) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'Request body required',
          }),
        };
      }
      // POST /admin/plans
      return createPlan(body);

    case 'PUT':
      if (!resourceId || !body) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'Resource ID and request body required',
          }),
        };
      }
      // PUT /admin/plans/{id}
      return updatePlan(resourceId, body);

    case 'DELETE':
      if (!resourceId) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'Resource ID required',
          }),
        };
      }
      // DELETE /admin/plans/{id}
      return deletePlan(resourceId);

    default:
      return {
        statusCode: 405,
        body: JSON.stringify({
          error: 'Method Not Allowed',
          message: `Method ${method} not allowed for plans`,
        }),
      };
  }
}

/**
 * Handles /admin/tenants routes
 */
async function handleTenantsRoute(
  method: string,
  resourceId: string | null,
  body: string | null,
  queryParams: APIGatewayProxyEventQueryStringParameters | null
): Promise<APIGatewayProxyResult> {
  switch (method) {
    case 'GET':
      if (resourceId) {
        // GET /admin/tenants/{id}
        return getTenant(resourceId);
      }
      // GET /admin/tenants
      return listTenants(queryParams);

    case 'POST':
      if (!body) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'Request body required',
          }),
        };
      }
      // POST /admin/tenants
      return createTenant(body);

    default:
      return {
        statusCode: 405,
        body: JSON.stringify({
          error: 'Method Not Allowed',
          message: `Method ${method} not allowed for tenants`,
        }),
      };
  }
}

/**
 * Handles /admin/dashboard routes
 */
async function handleDashboardRoute(
  method: string,
  path: string
): Promise<APIGatewayProxyResult> {
  if (method !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({
        error: 'Method Not Allowed',
        message: `Method ${method} not allowed for dashboard`,
      }),
    };
  }

  // Route based on sub-path
  if (path === '/admin/dashboard' || path === '/admin/dashboard/') {
    return getDashboardStats();
  }
  if (path === '/admin/dashboard/revenue') {
    return getRevenueData();
  }
  if (path === '/admin/dashboard/users') {
    return getUserGrowthData();
  }
  if (path === '/admin/dashboard/activity') {
    return getRecentActivity();
  }

  return {
    statusCode: 404,
    body: JSON.stringify({
      error: 'Not Found',
      message: 'Dashboard endpoint not found',
    }),
  };
}

/**
 * Handles /admin/users routes
 */
async function handleUsersRoute(
  method: string,
  resourceId: string | null,
  body: string | null,
  queryParams: APIGatewayProxyEventQueryStringParameters | null,
  path: string
): Promise<APIGatewayProxyResult> {
  // Check for sub-routes like /admin/users/{id}/logins
  const pathParts = path.split('/').filter(Boolean);
  const subRoute = pathParts.length >= 4 ? pathParts[3] : null;

  switch (method) {
    case 'GET':
      if (resourceId && subRoute === 'logins') {
        // GET /admin/users/{id}/logins
        return getUserLogins(resourceId);
      }
      if (resourceId) {
        // GET /admin/users/{id}
        return getUser(resourceId);
      }
      // GET /admin/users
      return listUsers(queryParams);

    case 'POST':
      if (!body) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'Request body required',
          }),
        };
      }
      // POST /admin/users
      return createUser(body);

    case 'PUT':
      if (!resourceId || !body) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'Resource ID and request body required',
          }),
        };
      }
      // PUT /admin/users/{id}
      return updateUser(resourceId, body);

    case 'DELETE':
      if (!resourceId) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'Resource ID required',
          }),
        };
      }
      // DELETE /admin/users/{id}
      return deleteUser(resourceId);

    default:
      return {
        statusCode: 405,
        body: JSON.stringify({
          error: 'Method Not Allowed',
          message: `Method ${method} not allowed for users`,
        }),
      };
  }
}
