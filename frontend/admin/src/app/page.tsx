'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import RevenueChart from '@/components/charts/RevenueChart';
import UserGrowthChart from '@/components/charts/UserGrowthChart';
import apiClient from '@/lib/api';

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

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  loading?: boolean;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, change, isPositive, loading }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      {loading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
        </div>
      ) : (
        <>
          <div className="text-3xl font-bold">{value}</div>
          <p className={`text-sm mt-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {change}
          </p>
        </>
      )}
    </CardContent>
  </Card>
);

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount);
}

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
}

export default function DashboardPage() {
  const { t } = useTranslation('common');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [userGrowthData, setUserGrowthData] = useState<UserGrowthDataPoint[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all dashboard data in parallel
        const [statsRes, revenueRes, userGrowthRes, activityRes] = await Promise.all([
          apiClient.get<DashboardStats>('/admin/dashboard'),
          apiClient.get<RevenueDataPoint[]>('/admin/dashboard/revenue'),
          apiClient.get<UserGrowthDataPoint[]>('/admin/dashboard/users'),
          apiClient.get<ActivityItem[]>('/admin/dashboard/activity'),
        ]);

        setStats(statsRes);
        setRevenueData(revenueRes);
        setUserGrowthData(userGrowthRes);
        setActivities(activityRes);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('app.description')}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title={t('dashboard.kpi.totalRevenue')}
          value={stats ? formatCurrency(stats.totalRevenue) : '-'}
          change={stats ? `${stats.revenueChange >= 0 ? '+' : ''}${stats.revenueChange}% from last month` : '-'}
          isPositive={stats ? stats.revenueChange >= 0 : true}
          loading={loading}
        />
        <KPICard
          title={t('dashboard.kpi.activeUsers')}
          value={stats ? stats.activeUsers.toString() : '-'}
          change={stats ? `${stats.userChange >= 0 ? '+' : ''}${stats.userChange}% from last month` : '-'}
          isPositive={stats ? stats.userChange >= 0 : true}
          loading={loading}
        />
        <KPICard
          title={t('dashboard.kpi.totalProducts')}
          value={stats ? stats.totalProducts.toString() : '-'}
          change={stats ? `${stats.productChange >= 0 ? '+' : ''}${stats.productChange} new this month` : '-'}
          isPositive={stats ? stats.productChange >= 0 : true}
          loading={loading}
        />
        <KPICard
          title="Total Subscriptions"
          value={stats ? stats.totalSubscriptions.toString() : '-'}
          change={stats ? `${stats.subscriptionChange >= 0 ? '+' : ''}${stats.subscriptionChange}% from last month` : '-'}
          isPositive={stats ? stats.subscriptionChange >= 0 : true}
          loading={loading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.charts.revenueOverTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <RevenueChart data={revenueData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.charts.userGrowth')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <UserGrowthChart data={userGrowthData} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="animate-pulse flex-1">
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-48"></div>
                  </div>
                  <div className="animate-pulse">
                    <div className="h-3 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div>
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{formatTimeAgo(activity.timestamp)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No recent activity
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
