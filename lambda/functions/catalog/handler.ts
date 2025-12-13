/**
 * Catalog Service Lambda Handler
 * Manages products, plans, and tenants
 *
 * Endpoints:
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
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult, APIGatewayProxyEventQueryStringParameters } from 'aws-lambda';
import { initializeDatabase } from '../../shared/db/index.js';
import { listProducts, createProduct, updateProduct, deleteProduct } from './products.js';
import { listPlans, createPlan, updatePlan, deletePlan } from './plans.js';
import { listTenants, createTenant } from './tenants.js';
import { AdminCheckResult } from './types.js';

/**
 * Check if user has admin role
 */
function checkAdminRole(event: Parameters<APIGatewayProxyHandler>[0]): AdminCheckResult {
  const authorizer = event.requestContext?.authorizer;

  // Get role from authorizer (Cognito custom claims or Lambda authorizer)
  const role = authorizer?.['claims']?.['custom:role'] || authorizer?.['role'];
  const userId = authorizer?.['claims']?.['sub'] || authorizer?.['user_id'];

  console.log('[Auth] Role check:', { role, userId });

  return {
    is_admin: role === 'admin',
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
 */
function getResourceType(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  // Expected: ['admin', 'products', ...]
  if (parts.length >= 2 && parts[0] === 'admin') {
    return parts[1] || null;
  }
  return null;
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

    // Check admin authorization
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

    const method = event.httpMethod;
    const path = event.path || '';
    const resourceType = getResourceType(path);
    const resourceId = extractResourceId(path);

    console.log('[Catalog] Request:', {
      method,
      path,
      resourceType,
      resourceId,
      userId: authCheck.user_id,
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
        // GET /admin/products/{id} - Not implemented yet
        return {
          statusCode: 501,
          body: JSON.stringify({
            error: 'Not Implemented',
            message: 'Get single product not implemented',
          }),
        };
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
        // GET /admin/plans/{id} - Not implemented yet
        return {
          statusCode: 501,
          body: JSON.stringify({
            error: 'Not Implemented',
            message: 'Get single plan not implemented',
          }),
        };
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
        // GET /admin/tenants/{id} - Not implemented yet
        return {
          statusCode: 501,
          body: JSON.stringify({
            error: 'Not Implemented',
            message: 'Get single tenant not implemented',
          }),
        };
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
