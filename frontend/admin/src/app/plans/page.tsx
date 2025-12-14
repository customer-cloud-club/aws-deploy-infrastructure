'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import apiClient from '@/lib/api';

interface Product {
  id: string;
  name: string;
  stripe_product_id: string;
}

interface Plan {
  id: string;
  product_id: string;
  name: string;
  stripe_price_id: string;
  billing_period: 'monthly' | 'yearly' | 'one_time';
  price_amount: number;
  currency: string;
  trial_period_days: number | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface PlanListResponse {
  items: Plan[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

interface ProductListResponse {
  items: Product[];
  total: number;
}

interface PlanForm {
  product_id: string;
  name: string;
  billing_period: 'monthly' | 'yearly' | 'one_time';
  price_amount: number;
  currency: string;
  trial_period_days: number | null;
  is_active: boolean;
}

const BILLING_PERIODS = [
  { value: 'monthly', label: '月額' },
  { value: 'yearly', label: '年額' },
  { value: 'one_time', label: '買い切り' },
];

const CURRENCIES = [
  { value: 'JPY', label: '日本円 (JPY)' },
  { value: 'USD', label: '米ドル (USD)' },
];

export default function PlansPage() {
  const { t } = useTranslation('common');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>({
    product_id: '',
    name: '',
    billing_period: 'monthly',
    price_amount: 0,
    currency: 'JPY',
    trial_period_days: null,
    is_active: true,
  });

  const fetchPlans = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<PlanListResponse>('/admin/plans');
      setPlans(response.items);
    } catch (err) {
      console.error('Failed to fetch plans:', err);
      setError('プランの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await apiClient.get<ProductListResponse>('/admin/products');
      setProducts(response.items);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchProducts();
  }, [fetchPlans, fetchProducts]);

  const resetForm = () => {
    setForm({
      product_id: '',
      name: '',
      billing_period: 'monthly',
      price_amount: 0,
      currency: 'JPY',
      trial_period_days: null,
      is_active: true,
    });
    setEditingPlan(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      product_id: plan.product_id,
      name: plan.name,
      billing_period: plan.billing_period,
      price_amount: plan.price_amount,
      currency: plan.currency,
      trial_period_days: plan.trial_period_days,
      is_active: plan.is_active,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id || !form.name) {
      alert('プロダクトとプラン名は必須です');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingPlan) {
        await apiClient.put(`/admin/plans/${editingPlan.id}`, {
          name: form.name,
          is_active: form.is_active,
        });
      } else {
        await apiClient.post('/admin/plans', {
          product_id: form.product_id,
          name: form.name,
          billing_period: form.billing_period,
          price_amount: form.price_amount,
          currency: form.currency,
          trial_period_days: form.trial_period_days || null,
          is_active: form.is_active,
        });
      }
      closeModal();
      await fetchPlans();
    } catch (err) {
      console.error('Failed to save plan:', err);
      alert(editingPlan ? 'プランの更新に失敗しました' : 'プランの作成に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlan = async (planId: string, planName: string) => {
    if (!confirm(`「${planName}」を削除してもよろしいですか？`)) {
      return;
    }

    try {
      await apiClient.delete(`/admin/plans/${planId}`);
      await fetchPlans();
    } catch (err) {
      console.error('Failed to delete plan:', err);
      alert('プランの削除に失敗しました');
    }
  };

  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product?.name || productId;
  };

  const formatPrice = (amount: number, currency: string) => {
    if (currency === 'JPY') {
      return `¥${amount.toLocaleString()}`;
    }
    return `$${(amount / 100).toFixed(2)}`;
  };

  const getBillingPeriodLabel = (period: string) => {
    const found = BILLING_PERIODS.find(p => p.value === period);
    return found?.label || period;
  };

  const filteredPlans = plans.filter(plan =>
    plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getProductName(plan.product_id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">プラン管理</h1>
          <p className="text-muted-foreground mt-2">
            プランの登録・管理（Stripe Price連携）
          </p>
        </div>
        <Button variant="primary" onClick={openCreateModal}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          プランを追加
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 p-4 rounded-md">
          {error}
          <button
            onClick={fetchPlans}
            className="ml-4 underline hover:no-underline"
          >
            再試行
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Plans ({plans.length})</CardTitle>
            <Input
              type="search"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">読み込み中...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">プラン名</th>
                    <th className="text-left py-3 px-4 font-medium">プロダクト</th>
                    <th className="text-left py-3 px-4 font-medium">料金</th>
                    <th className="text-left py-3 px-4 font-medium">課金周期</th>
                    <th className="text-left py-3 px-4 font-medium">トライアル</th>
                    <th className="text-left py-3 px-4 font-medium">ステータス</th>
                    <th className="text-left py-3 px-4 font-medium">Stripe Price ID</th>
                    <th className="text-left py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.map((plan) => (
                    <tr key={plan.id} className="border-b hover:bg-accent/50 transition-colors">
                      <td className="py-3 px-4 font-medium">{plan.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{getProductName(plan.product_id)}</td>
                      <td className="py-3 px-4 font-medium">{formatPrice(plan.price_amount, plan.currency)}</td>
                      <td className="py-3 px-4">{getBillingPeriodLabel(plan.billing_period)}</td>
                      <td className="py-3 px-4">
                        {plan.trial_period_days ? `${plan.trial_period_days}日` : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            plan.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {plan.is_active ? 'アクティブ' : '非アクティブ'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">{plan.stripe_price_id}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(plan)}>
                            {t('common.edit')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePlan(plan.id, plan.name)}
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPlans.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  {plans.length === 0 ? 'プランがありません' : t('common.noData')}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingPlan ? 'プランを編集' : '新しいプランを作成'}
              </h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    プロダクト <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.product_id}
                    onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    required
                    disabled={!!editingPlan}
                  >
                    <option value="">選択してください</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  {editingPlan && (
                    <p className="text-xs text-muted-foreground mt-1">
                      プロダクトは変更できません
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    プラン名 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="例: Proプラン（月額）"
                    required
                  />
                </div>
                {!editingPlan && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          課金周期 <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={form.billing_period}
                          onChange={(e) => setForm({ ...form, billing_period: e.target.value as 'monthly' | 'yearly' | 'one_time' })}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background"
                          required
                        >
                          {BILLING_PERIODS.map((period) => (
                            <option key={period.value} value={period.value}>
                              {period.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          通貨
                        </label>
                        <select
                          value={form.currency}
                          onChange={(e) => setForm({ ...form, currency: e.target.value })}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background"
                        >
                          {CURRENCIES.map((currency) => (
                            <option key={currency.value} value={currency.value}>
                              {currency.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          料金 <span className="text-red-500">*</span>
                        </label>
                        <Input
                          type="number"
                          value={form.price_amount}
                          onChange={(e) => setForm({ ...form, price_amount: parseInt(e.target.value) || 0 })}
                          placeholder={form.currency === 'JPY' ? '例: 980' : '例: 999 (セント単位)'}
                          required
                          min="0"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {form.currency === 'JPY' ? '円単位で入力' : 'セント単位で入力（$9.99 = 999）'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          トライアル期間（日）
                        </label>
                        <Input
                          type="number"
                          value={form.trial_period_days || ''}
                          onChange={(e) => setForm({ ...form, trial_period_days: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="例: 14"
                          min="0"
                        />
                      </div>
                    </div>
                  </>
                )}
                {editingPlan && (
                  <div className="bg-muted/50 p-4 rounded-md text-sm text-muted-foreground">
                    <p className="font-medium mb-2">変更不可の項目:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>課金周期: {getBillingPeriodLabel(editingPlan.billing_period)}</li>
                      <li>料金: {formatPrice(editingPlan.price_amount, editingPlan.currency)}</li>
                      <li>Stripe Price ID: {editingPlan.stripe_price_id}</li>
                    </ul>
                    <p className="mt-2 text-xs">
                      ※ Stripe Priceは作成後に変更できません。料金を変更する場合は新しいプランを作成してください。
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="rounded border-input"
                  />
                  <label htmlFor="is_active" className="text-sm">
                    アクティブにする
                  </label>
                </div>
              </div>
              <div className="p-6 border-t flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  キャンセル
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? '保存中...' : (editingPlan ? '更新' : '作成')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
