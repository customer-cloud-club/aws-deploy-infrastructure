/**
 * Dashboard API
 * Provides aggregated statistics for the admin dashboard
 *
 * GET /admin/dashboard - Dashboard statistics
 * GET /admin/dashboard/revenue - Revenue over time
 * GET /admin/dashboard/users - User growth over time
 * GET /admin/dashboard/activity - Recent activity
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../shared/db/index.js';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

interface DashboardStats {
  totalRevenue: number;
  revenueChange: number;
  activeUsers: number;
  userChange: number;
  totalProducts: number;
  productChange: number;
  totalSubscriptions: number;
  subscriptionChange: number;
}

interface RevenueDataPoint {
  month: string;
  revenue: number;
}

interface UserGrowthDataPoint {
  month: string;
  users: number;
}

interface ActivityItem {
  id: string;
  type: 'subscription' | 'user' | 'product' | 'plan';
  action: string;
  description: string;
  timestamp: string;
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<APIGatewayProxyResult> {
  try {
    // Get current counts
    const [productsResult, plansResult, tenantsResult, subscriptionsResult] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL AND is_active = true'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM plans WHERE deleted_at IS NULL AND is_active = true'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM tenants WHERE deleted_at IS NULL AND status = $1', ['active']),
      query<{ count: string; total_revenue: string }>(`
        SELECT
          COUNT(*) as count,
          COALESCE(SUM(p.price_amount), 0) as total_revenue
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        WHERE s.deleted_at IS NULL AND s.status IN ('active', 'trialing')
      `),
    ]);

    // Get last month's counts for comparison
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString();

    const [lastMonthProducts, lastMonthSubscriptions] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL AND is_active = true AND created_at < $1', [lastMonthStr]),
      query<{ count: string }>(`
        SELECT COUNT(*) as count
        FROM subscriptions
        WHERE deleted_at IS NULL AND status IN ('active', 'trialing') AND created_at < $1
      `, [lastMonthStr]),
    ]);

    const currentProducts = parseInt(productsResult.rows[0]?.count || '0');
    const currentSubscriptions = parseInt(subscriptionsResult.rows[0]?.count || '0');
    const totalRevenue = parseInt(subscriptionsResult.rows[0]?.total_revenue || '0');
    const lastProducts = parseInt(lastMonthProducts.rows[0]?.count || '0');
    const lastSubscriptions = parseInt(lastMonthSubscriptions.rows[0]?.count || '0');

    const stats: DashboardStats = {
      totalRevenue,
      revenueChange: lastSubscriptions > 0 ? Math.round(((currentSubscriptions - lastSubscriptions) / lastSubscriptions) * 100) : 0,
      activeUsers: parseInt(tenantsResult.rows[0]?.count || '0'),
      userChange: 12, // TODO: Calculate from actual user data
      totalProducts: currentProducts,
      productChange: currentProducts - lastProducts,
      totalSubscriptions: currentSubscriptions,
      subscriptionChange: lastSubscriptions > 0 ? Math.round(((currentSubscriptions - lastSubscriptions) / lastSubscriptions) * 100) : 0,
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(stats),
    };
  } catch (error) {
    console.error('[Dashboard] Error getting stats:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get dashboard stats' }),
    };
  }
}

/**
 * Get revenue data over time (last 6 months)
 */
export async function getRevenueData(): Promise<APIGatewayProxyResult> {
  try {
    const result = await query<{ month: string; revenue: string }>(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', s.created_at), 'Mon') as month,
        COALESCE(SUM(p.price_amount), 0) as revenue
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.deleted_at IS NULL
        AND s.created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', s.created_at)
      ORDER BY DATE_TRUNC('month', s.created_at)
    `);

    // If no data, return sample months with 0 revenue
    if (result.rows.length === 0) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      const data: RevenueDataPoint[] = months.map(month => ({
        month,
        revenue: 0,
      }));
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(data),
      };
    }

    const data: RevenueDataPoint[] = result.rows.map(row => ({
      month: row.month,
      revenue: parseInt(row.revenue),
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('[Dashboard] Error getting revenue data:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get revenue data' }),
    };
  }
}

/**
 * Get user growth data over time (last 6 months)
 */
export async function getUserGrowthData(): Promise<APIGatewayProxyResult> {
  try {
    const result = await query<{ month: string; users: string }>(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
        COUNT(*) as users
      FROM tenants
      WHERE deleted_at IS NULL
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at)
    `);

    // If no data, return sample months with 0 users
    if (result.rows.length === 0) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      const data: UserGrowthDataPoint[] = months.map(month => ({
        month,
        users: 0,
      }));
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(data),
      };
    }

    const data: UserGrowthDataPoint[] = result.rows.map(row => ({
      month: row.month,
      users: parseInt(row.users),
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('[Dashboard] Error getting user growth data:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get user growth data' }),
    };
  }
}

/**
 * Get recent activity
 */
export async function getRecentActivity(): Promise<APIGatewayProxyResult> {
  try {
    // Get recent subscriptions
    const subscriptions = await query<{
      id: string;
      user_id: string;
      created_at: Date;
      status: string;
    }>(`
      SELECT id, user_id, created_at, status
      FROM subscriptions
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // Get recent tenants
    const tenants = await query<{
      id: string;
      name: string;
      subdomain: string;
      created_at: Date;
    }>(`
      SELECT id, name, subdomain, created_at
      FROM tenants
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // Get recent products
    const products = await query<{
      id: string;
      name: string;
      created_at: Date;
    }>(`
      SELECT id, name, created_at
      FROM products
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 3
    `);

    // Combine and sort by timestamp
    const activities: ActivityItem[] = [
      ...subscriptions.rows.map(s => ({
        id: s.id,
        type: 'subscription' as const,
        action: s.status === 'active' ? 'New subscription' : `Subscription ${s.status}`,
        description: `User ${s.user_id.substring(0, 8)}...`,
        timestamp: s.created_at.toISOString(),
      })),
      ...tenants.rows.map(t => ({
        id: t.id,
        type: 'user' as const,
        action: 'New tenant registered',
        description: `${t.name} (${t.subdomain})`,
        timestamp: t.created_at.toISOString(),
      })),
      ...products.rows.map(p => ({
        id: p.id,
        type: 'product' as const,
        action: 'Product created',
        description: p.name,
        timestamp: p.created_at.toISOString(),
      })),
    ];

    // Sort by timestamp descending and take top 10
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const recentActivities = activities.slice(0, 10);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(recentActivities),
    };
  } catch (error) {
    console.error('[Dashboard] Error getting recent activity:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get recent activity' }),
    };
  }
}
