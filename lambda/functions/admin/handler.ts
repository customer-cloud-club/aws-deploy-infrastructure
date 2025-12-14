/**
 * Admin API Handler
 * Routes admin requests to appropriate handlers
 *
 * Dashboard:
 * GET /admin/dashboard - Dashboard statistics
 * GET /admin/dashboard/revenue - Revenue over time
 * GET /admin/dashboard/users - User growth over time
 * GET /admin/dashboard/activity - Recent activity
 *
 * Users:
 * GET /admin/users - List all users
 * GET /admin/users/{id} - Get user details
 * POST /admin/users - Create new user
 * PUT /admin/users/{id} - Update user
 * DELETE /admin/users/{id} - Disable user
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDashboardStats, getRevenueData, getUserGrowthData, getRecentActivity } from './dashboard.js';
import { listUsers, getUser, createUser, updateUser, deleteUser } from './users.js';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('[Admin] Request:', {
    path: event.path,
    method: event.httpMethod,
    pathParameters: event.pathParameters,
  });

  // Handle OPTIONS for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  const path = event.path;
  const method = event.httpMethod;

  try {
    // Dashboard routes
    if (path === '/admin/dashboard' && method === 'GET') {
      return await getDashboardStats();
    }

    if (path === '/admin/dashboard/revenue' && method === 'GET') {
      return await getRevenueData();
    }

    if (path === '/admin/dashboard/users' && method === 'GET') {
      return await getUserGrowthData();
    }

    if (path === '/admin/dashboard/activity' && method === 'GET') {
      return await getRecentActivity();
    }

    // Users routes
    if (path === '/admin/users' && method === 'GET') {
      return await listUsers(event.queryStringParameters);
    }

    if (path === '/admin/users' && method === 'POST') {
      return await createUser(event.body || '{}');
    }

    // Single user routes with ID
    const userMatch = path.match(/^\/admin\/users\/([^/]+)$/);
    if (userMatch) {
      const userId = decodeURIComponent(userMatch[1]);

      if (method === 'GET') {
        return await getUser(userId);
      }

      if (method === 'PUT') {
        return await updateUser(userId, event.body || '{}');
      }

      if (method === 'DELETE') {
        return await deleteUser(userId);
      }
    }

    // Route not found
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Not found', path, method }),
    };
  } catch (error) {
    console.error('[Admin] Unexpected error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
