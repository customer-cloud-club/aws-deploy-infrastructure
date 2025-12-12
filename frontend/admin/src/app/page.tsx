'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import RevenueChart from '@/components/charts/RevenueChart';
import UserGrowthChart from '@/components/charts/UserGrowthChart';

// Mock data for demonstration
const mockRevenueData = [
  { month: 'Jan', revenue: 45000 },
  { month: 'Feb', revenue: 52000 },
  { month: 'Mar', revenue: 48000 },
  { month: 'Apr', revenue: 61000 },
  { month: 'May', revenue: 55000 },
  { month: 'Jun', revenue: 67000 },
];

const mockUserGrowthData = [
  { month: 'Jan', users: 120 },
  { month: 'Feb', users: 145 },
  { month: 'Mar', users: 167 },
  { month: 'Apr', users: 198 },
  { month: 'May', users: 223 },
  { month: 'Jun', users: 251 },
];

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, change, isPositive }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold">{value}</div>
      <p className={`text-sm mt-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {change}
      </p>
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  const { t } = useTranslation('common');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('app.description')}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title={t('dashboard.kpi.totalRevenue')}
          value="¥67,000"
          change="+12.5% from last month"
          isPositive={true}
        />
        <KPICard
          title={t('dashboard.kpi.activeUsers')}
          value="251"
          change="+12.5% from last month"
          isPositive={true}
        />
        <KPICard
          title={t('dashboard.kpi.totalProducts')}
          value="12"
          change="+2 new this month"
          isPositive={true}
        />
        <KPICard
          title={t('dashboard.kpi.conversionRate')}
          value="3.24%"
          change="-0.5% from last month"
          isPositive={false}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.charts.revenueOverTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={mockRevenueData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.charts.userGrowth')}</CardTitle>
          </CardHeader>
          <CardContent>
            <UserGrowthChart data={mockUserGrowthData} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                <div>
                  <p className="font-medium">User registered</p>
                  <p className="text-sm text-muted-foreground">user{i}@example.com</p>
                </div>
                <span className="text-sm text-muted-foreground">2h ago</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
