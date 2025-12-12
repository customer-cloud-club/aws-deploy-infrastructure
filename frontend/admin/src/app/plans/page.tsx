'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface Plan {
  id: string;
  name: string;
  price: number;
  billing: 'monthly' | 'yearly';
  features: string[];
  status: 'active' | 'inactive';
}

// Mock data
const mockPlans: Plan[] = [
  {
    id: '1',
    name: 'Starter',
    price: 2980,
    billing: 'monthly',
    features: ['Basic features', 'Up to 10 users', 'Email support'],
    status: 'active',
  },
  {
    id: '2',
    name: 'Professional',
    price: 9800,
    billing: 'monthly',
    features: ['Advanced features', 'Up to 50 users', 'Priority support', 'Custom integrations'],
    status: 'active',
  },
  {
    id: '3',
    name: 'Enterprise',
    price: 98000,
    billing: 'yearly',
    features: ['All features', 'Unlimited users', '24/7 support', 'Dedicated account manager'],
    status: 'active',
  },
];

export default function PlansPage() {
  const { t } = useTranslation('common');
  const [plans] = useState<Plan[]>(mockPlans);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPlans = plans.filter(plan =>
    plan.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('plans.title')}</h1>
          <p className="text-muted-foreground mt-2">
            Manage subscription plans and pricing
          </p>
        </div>
        <Button variant="primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {t('plans.addPlan')}
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Input
          type="search"
          placeholder={t('common.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    plan.status === 'active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {plan.status}
                </span>
              </div>
              <div className="mt-4">
                <span className="text-4xl font-bold">¥{plan.price.toLocaleString()}</span>
                <span className="text-muted-foreground ml-2">
                  / {t(`plans.billing.${plan.billing}`)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">{t('plans.fields.features')}</h4>
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2 pt-4 border-t">
                  <Button variant="outline" size="sm" className="flex-1">
                    {t('common.edit')}
                  </Button>
                  <Button variant="ghost" size="sm">
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPlans.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              {t('common.noData')}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
