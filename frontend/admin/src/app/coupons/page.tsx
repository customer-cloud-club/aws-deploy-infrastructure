'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import apiClient from '@/lib/api';

type CouponDuration = 'once' | 'repeating' | 'forever';

interface Coupon {
  id: string;
  stripe_coupon_id: string;
  name: string;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: CouponDuration;
  duration_in_months: number | null;
  max_redemptions: number | null;
  times_redeemed: number;
  redeem_by: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface PromotionCode {
  id: string;
  stripe_promotion_code_id: string;
  coupon_id: string;
  code: string;
  is_active: boolean;
  max_redemptions: number | null;
  times_redeemed: number;
  expires_at: string | null;
  minimum_amount: number | null;
  minimum_amount_currency: string | null;
  first_time_transaction: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  coupon?: Coupon;
}

interface CouponListResponse {
  items: Coupon[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

interface PromotionCodeListResponse {
  items: PromotionCode[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

interface CouponForm {
  name: string;
  percent_off: number | null;
  amount_off: number | null;
  currency: string;
  duration: CouponDuration;
  duration_in_months: number | null;
  max_redemptions: number | null;
  redeem_by: string;
}

interface PromotionCodeForm {
  coupon_id: string;
  code: string;
  max_redemptions: number | null;
  expires_at: string;
  minimum_amount: number | null;
  minimum_amount_currency: string;
  first_time_transaction: boolean;
}

const DURATION_OPTIONS = [
  { value: 'once', label: '初回のみ' },
  { value: 'repeating', label: '繰り返し（月数指定）' },
  { value: 'forever', label: '永続' },
];

const CURRENCIES = [
  { value: 'JPY', label: '日本円 (JPY)' },
  { value: 'USD', label: '米ドル (USD)' },
];

export default function CouponsPage() {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<'coupons' | 'promotionCodes'>('coupons');

  // Coupon state
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoadingCoupons, setIsLoadingCoupons] = useState(true);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [couponForm, setCouponForm] = useState<CouponForm>({
    name: '',
    percent_off: null,
    amount_off: null,
    currency: 'JPY',
    duration: 'once',
    duration_in_months: null,
    max_redemptions: null,
    redeem_by: '',
  });

  // Promotion code state
  const [promotionCodes, setPromotionCodes] = useState<PromotionCode[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(true);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeForm, setCodeForm] = useState<PromotionCodeForm>({
    coupon_id: '',
    code: '',
    max_redemptions: null,
    expires_at: '',
    minimum_amount: null,
    minimum_amount_currency: 'JPY',
    first_time_transaction: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCoupons = useCallback(async () => {
    try {
      setIsLoadingCoupons(true);
      setCouponError(null);
      const response = await apiClient.get<CouponListResponse>('/admin/coupons');
      setCoupons(response.items);
    } catch (err) {
      console.error('Failed to fetch coupons:', err);
      setCouponError('クーポンの取得に失敗しました');
    } finally {
      setIsLoadingCoupons(false);
    }
  }, []);

  const fetchPromotionCodes = useCallback(async () => {
    try {
      setIsLoadingCodes(true);
      setCodeError(null);
      const response = await apiClient.get<PromotionCodeListResponse>('/admin/promotion-codes');
      setPromotionCodes(response.items);
    } catch (err) {
      console.error('Failed to fetch promotion codes:', err);
      setCodeError('プロモーションコードの取得に失敗しました');
    } finally {
      setIsLoadingCodes(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
    fetchPromotionCodes();
  }, [fetchCoupons, fetchPromotionCodes]);

  const resetCouponForm = () => {
    setCouponForm({
      name: '',
      percent_off: null,
      amount_off: null,
      currency: 'JPY',
      duration: 'once',
      duration_in_months: null,
      max_redemptions: null,
      redeem_by: '',
    });
    setDiscountType('percent');
    setEditingCoupon(null);
  };

  const resetCodeForm = () => {
    setCodeForm({
      coupon_id: '',
      code: '',
      max_redemptions: null,
      expires_at: '',
      minimum_amount: null,
      minimum_amount_currency: 'JPY',
      first_time_transaction: false,
    });
  };

  const openCreateCouponModal = () => {
    resetCouponForm();
    setShowCouponModal(true);
  };

  const openEditCouponModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCouponForm({
      name: coupon.name,
      percent_off: coupon.percent_off,
      amount_off: coupon.amount_off,
      currency: coupon.currency || 'JPY',
      duration: coupon.duration,
      duration_in_months: coupon.duration_in_months,
      max_redemptions: coupon.max_redemptions,
      redeem_by: coupon.redeem_by ? coupon.redeem_by.split('T')[0] : '',
    });
    setDiscountType(coupon.percent_off ? 'percent' : 'amount');
    setShowCouponModal(true);
  };

  const openCreateCodeModal = () => {
    resetCodeForm();
    setShowCodeModal(true);
  };

  const handleCouponSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponForm.name) {
      alert('クーポン名は必須です');
      return;
    }
    if (discountType === 'percent' && !couponForm.percent_off) {
      alert('割引率を入力してください');
      return;
    }
    if (discountType === 'amount' && !couponForm.amount_off) {
      alert('割引額を入力してください');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingCoupon) {
        await apiClient.put(`/admin/coupons/${editingCoupon.id}`, {
          name: couponForm.name,
        });
      } else {
        const requestBody: Record<string, unknown> = {
          name: couponForm.name,
          duration: couponForm.duration,
        };

        if (discountType === 'percent') {
          requestBody.percent_off = couponForm.percent_off;
        } else {
          requestBody.amount_off = couponForm.amount_off;
          requestBody.currency = couponForm.currency;
        }

        if (couponForm.duration === 'repeating' && couponForm.duration_in_months) {
          requestBody.duration_in_months = couponForm.duration_in_months;
        }
        if (couponForm.max_redemptions) {
          requestBody.max_redemptions = couponForm.max_redemptions;
        }
        if (couponForm.redeem_by) {
          requestBody.redeem_by = new Date(couponForm.redeem_by).toISOString();
        }

        await apiClient.post('/admin/coupons', requestBody);
      }
      setShowCouponModal(false);
      resetCouponForm();
      await fetchCoupons();
    } catch (err) {
      console.error('Failed to save coupon:', err);
      alert(editingCoupon ? 'クーポンの更新に失敗しました' : 'クーポンの作成に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeForm.coupon_id) {
      alert('クーポンを選択してください');
      return;
    }

    try {
      setIsSubmitting(true);
      const requestBody: Record<string, unknown> = {
        coupon_id: codeForm.coupon_id,
        first_time_transaction: codeForm.first_time_transaction,
      };

      if (codeForm.code) {
        requestBody.code = codeForm.code;
      }
      if (codeForm.max_redemptions) {
        requestBody.max_redemptions = codeForm.max_redemptions;
      }
      if (codeForm.expires_at) {
        requestBody.expires_at = new Date(codeForm.expires_at).toISOString();
      }
      if (codeForm.minimum_amount) {
        requestBody.minimum_amount = codeForm.minimum_amount;
        requestBody.minimum_amount_currency = codeForm.minimum_amount_currency;
      }

      await apiClient.post('/admin/promotion-codes', requestBody);
      setShowCodeModal(false);
      resetCodeForm();
      await fetchPromotionCodes();
    } catch (err) {
      console.error('Failed to create promotion code:', err);
      alert('プロモーションコードの作成に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCoupon = async (couponId: string, couponName: string) => {
    if (!confirm(`「${couponName}」を削除してもよろしいですか？\n関連するプロモーションコードも無効になります。`)) {
      return;
    }

    try {
      await apiClient.delete(`/admin/coupons/${couponId}`);
      await fetchCoupons();
      await fetchPromotionCodes();
    } catch (err) {
      console.error('Failed to delete coupon:', err);
      alert('クーポンの削除に失敗しました');
    }
  };

  const handleDeleteCode = async (codeId: string, code: string) => {
    if (!confirm(`「${code}」を無効化してもよろしいですか？`)) {
      return;
    }

    try {
      await apiClient.delete(`/admin/promotion-codes/${codeId}`);
      await fetchPromotionCodes();
    } catch (err) {
      console.error('Failed to delete promotion code:', err);
      alert('プロモーションコードの削除に失敗しました');
    }
  };

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.percent_off) {
      return `${coupon.percent_off}% OFF`;
    }
    if (coupon.amount_off) {
      if (coupon.currency === 'JPY') {
        return `¥${coupon.amount_off.toLocaleString()} OFF`;
      }
      return `$${(coupon.amount_off / 100).toFixed(2)} OFF`;
    }
    return '-';
  };

  const getDurationLabel = (coupon: Coupon) => {
    switch (coupon.duration) {
      case 'once':
        return '初回のみ';
      case 'repeating':
        return `${coupon.duration_in_months}ヶ月間`;
      case 'forever':
        return '永続';
      default:
        return coupon.duration;
    }
  };

  const getCouponName = (couponId: string) => {
    const coupon = coupons.find(c => c.id === couponId);
    return coupon?.name || couponId;
  };

  const filteredCoupons = coupons.filter(coupon =>
    coupon.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCodes = promotionCodes.filter(code =>
    code.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getCouponName(code.coupon_id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">クーポン管理</h1>
          <p className="text-muted-foreground mt-2">
            Stripeクーポン・プロモーションコードの管理
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'coupons' ? (
            <Button variant="primary" onClick={openCreateCouponModal}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              クーポンを作成
            </Button>
          ) : (
            <Button variant="primary" onClick={openCreateCodeModal}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              コードを作成
            </Button>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('coupons')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'coupons'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            }`}
          >
            クーポン ({coupons.length})
          </button>
          <button
            onClick={() => setActiveTab('promotionCodes')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'promotionCodes'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            }`}
          >
            プロモーションコード ({promotionCodes.length})
          </button>
        </nav>
      </div>

      {/* Coupons Tab */}
      {activeTab === 'coupons' && (
        <>
          {couponError && (
            <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 p-4 rounded-md">
              {couponError}
              <button onClick={fetchCoupons} className="ml-4 underline hover:no-underline">
                再試行
              </button>
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All Coupons ({coupons.length})</CardTitle>
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
              {isLoadingCoupons ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">読み込み中...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">クーポン名</th>
                        <th className="text-left py-3 px-4 font-medium">割引</th>
                        <th className="text-left py-3 px-4 font-medium">適用期間</th>
                        <th className="text-left py-3 px-4 font-medium">利用回数</th>
                        <th className="text-left py-3 px-4 font-medium">有効期限</th>
                        <th className="text-left py-3 px-4 font-medium">ステータス</th>
                        <th className="text-left py-3 px-4 font-medium">Stripe ID</th>
                        <th className="text-left py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCoupons.map((coupon) => (
                        <tr key={coupon.id} className="border-b hover:bg-accent/50 transition-colors">
                          <td className="py-3 px-4 font-medium">{coupon.name}</td>
                          <td className="py-3 px-4 font-medium text-green-600">{formatDiscount(coupon)}</td>
                          <td className="py-3 px-4">{getDurationLabel(coupon)}</td>
                          <td className="py-3 px-4">
                            {coupon.times_redeemed}
                            {coupon.max_redemptions && ` / ${coupon.max_redemptions}`}
                          </td>
                          <td className="py-3 px-4">
                            {coupon.redeem_by
                              ? new Date(coupon.redeem_by).toLocaleDateString('ja-JP')
                              : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                coupon.is_active
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                              }`}
                            >
                              {coupon.is_active ? 'アクティブ' : '非アクティブ'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">{coupon.stripe_coupon_id}</td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEditCouponModal(coupon)}>
                                {t('common.edit')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteCoupon(coupon.id, coupon.name)}
                              >
                                {t('common.delete')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredCoupons.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      {coupons.length === 0 ? 'クーポンがありません' : t('common.noData')}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Promotion Codes Tab */}
      {activeTab === 'promotionCodes' && (
        <>
          {codeError && (
            <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 p-4 rounded-md">
              {codeError}
              <button onClick={fetchPromotionCodes} className="ml-4 underline hover:no-underline">
                再試行
              </button>
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All Promotion Codes ({promotionCodes.length})</CardTitle>
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
              {isLoadingCodes ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">読み込み中...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">コード</th>
                        <th className="text-left py-3 px-4 font-medium">クーポン</th>
                        <th className="text-left py-3 px-4 font-medium">利用回数</th>
                        <th className="text-left py-3 px-4 font-medium">有効期限</th>
                        <th className="text-left py-3 px-4 font-medium">最小購入額</th>
                        <th className="text-left py-3 px-4 font-medium">初回のみ</th>
                        <th className="text-left py-3 px-4 font-medium">ステータス</th>
                        <th className="text-left py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCodes.map((code) => (
                        <tr key={code.id} className="border-b hover:bg-accent/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium">{code.code}</td>
                          <td className="py-3 px-4">{getCouponName(code.coupon_id)}</td>
                          <td className="py-3 px-4">
                            {code.times_redeemed}
                            {code.max_redemptions && ` / ${code.max_redemptions}`}
                          </td>
                          <td className="py-3 px-4">
                            {code.expires_at
                              ? new Date(code.expires_at).toLocaleDateString('ja-JP')
                              : '-'}
                          </td>
                          <td className="py-3 px-4">
                            {code.minimum_amount
                              ? code.minimum_amount_currency === 'JPY'
                                ? `¥${code.minimum_amount.toLocaleString()}`
                                : `$${(code.minimum_amount / 100).toFixed(2)}`
                              : '-'}
                          </td>
                          <td className="py-3 px-4">
                            {code.first_time_transaction ? 'はい' : 'いいえ'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                code.is_active
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                              }`}
                            >
                              {code.is_active ? 'アクティブ' : '非アクティブ'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCode(code.id, code.code)}
                            >
                              無効化
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredCodes.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      {promotionCodes.length === 0 ? 'プロモーションコードがありません' : t('common.noData')}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Create/Edit Coupon Modal */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingCoupon ? 'クーポンを編集' : '新しいクーポンを作成'}
              </h2>
            </div>
            <form onSubmit={handleCouponSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    クーポン名 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={couponForm.name}
                    onChange={(e) => setCouponForm({ ...couponForm, name: e.target.value })}
                    placeholder="例: 新規登録20%OFF"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    顧客に表示される名前
                  </p>
                </div>

                {!editingCoupon && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        割引タイプ <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="discountType"
                            checked={discountType === 'percent'}
                            onChange={() => {
                              setDiscountType('percent');
                              setCouponForm({ ...couponForm, amount_off: null });
                            }}
                            className="mr-2"
                          />
                          割引率（%）
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="discountType"
                            checked={discountType === 'amount'}
                            onChange={() => {
                              setDiscountType('amount');
                              setCouponForm({ ...couponForm, percent_off: null });
                            }}
                            className="mr-2"
                          />
                          固定額
                        </label>
                      </div>
                    </div>

                    {discountType === 'percent' ? (
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          割引率 <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={couponForm.percent_off || ''}
                            onChange={(e) => setCouponForm({ ...couponForm, percent_off: parseInt(e.target.value) || null })}
                            placeholder="例: 20"
                            min="1"
                            max="100"
                            required
                            className="w-32"
                          />
                          <span>%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            割引額 <span className="text-red-500">*</span>
                          </label>
                          <Input
                            type="number"
                            value={couponForm.amount_off || ''}
                            onChange={(e) => setCouponForm({ ...couponForm, amount_off: parseInt(e.target.value) || null })}
                            placeholder={couponForm.currency === 'JPY' ? '例: 500' : '例: 500'}
                            min="1"
                            required
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {couponForm.currency === 'JPY' ? '円単位' : 'セント単位'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">通貨</label>
                          <select
                            value={couponForm.currency}
                            onChange={(e) => setCouponForm({ ...couponForm, currency: e.target.value })}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background"
                          >
                            {CURRENCIES.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        適用期間 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={couponForm.duration}
                        onChange={(e) => setCouponForm({ ...couponForm, duration: e.target.value as CouponDuration })}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background"
                        required
                      >
                        {DURATION_OPTIONS.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        サブスクリプションにおける割引の適用期間
                      </p>
                    </div>

                    {couponForm.duration === 'repeating' && (
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          適用月数 <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={couponForm.duration_in_months || ''}
                            onChange={(e) => setCouponForm({ ...couponForm, duration_in_months: parseInt(e.target.value) || null })}
                            placeholder="例: 3"
                            min="1"
                            required
                            className="w-32"
                          />
                          <span>ヶ月</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">最大利用回数</label>
                        <Input
                          type="number"
                          value={couponForm.max_redemptions || ''}
                          onChange={(e) => setCouponForm({ ...couponForm, max_redemptions: parseInt(e.target.value) || null })}
                          placeholder="無制限"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">有効期限</label>
                        <Input
                          type="date"
                          value={couponForm.redeem_by}
                          onChange={(e) => setCouponForm({ ...couponForm, redeem_by: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {editingCoupon && (
                  <div className="bg-muted/50 p-4 rounded-md text-sm text-muted-foreground">
                    <p className="font-medium mb-2">変更不可の項目:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>割引: {formatDiscount(editingCoupon)}</li>
                      <li>適用期間: {getDurationLabel(editingCoupon)}</li>
                      <li>Stripe Coupon ID: {editingCoupon.stripe_coupon_id}</li>
                    </ul>
                    <p className="mt-2 text-xs">
                      ※ Stripe Couponは作成後に変更できません。設定を変更する場合は新しいクーポンを作成してください。
                    </p>
                  </div>
                )}
              </div>
              <div className="p-6 border-t flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowCouponModal(false);
                    resetCouponForm();
                  }}
                  disabled={isSubmitting}
                >
                  キャンセル
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? '保存中...' : (editingCoupon ? '更新' : '作成')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Promotion Code Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">新しいプロモーションコードを作成</h2>
            </div>
            <form onSubmit={handleCodeSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    クーポン <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={codeForm.coupon_id}
                    onChange={(e) => setCodeForm({ ...codeForm, coupon_id: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    required
                  >
                    <option value="">選択してください</option>
                    {coupons.filter(c => c.is_active).map((coupon) => (
                      <option key={coupon.id} value={coupon.id}>
                        {coupon.name} ({formatDiscount(coupon)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">コード</label>
                  <Input
                    type="text"
                    value={codeForm.code}
                    onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value.toUpperCase() })}
                    placeholder="例: SUMMER2024（空欄で自動生成）"
                    pattern="[A-Z0-9]+"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    顧客が入力するコード（英数字大文字のみ）
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">最大利用回数</label>
                    <Input
                      type="number"
                      value={codeForm.max_redemptions || ''}
                      onChange={(e) => setCodeForm({ ...codeForm, max_redemptions: parseInt(e.target.value) || null })}
                      placeholder="無制限"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">有効期限</label>
                    <Input
                      type="date"
                      value={codeForm.expires_at}
                      onChange={(e) => setCodeForm({ ...codeForm, expires_at: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">最小購入額</label>
                    <Input
                      type="number"
                      value={codeForm.minimum_amount || ''}
                      onChange={(e) => setCodeForm({ ...codeForm, minimum_amount: parseInt(e.target.value) || null })}
                      placeholder="なし"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">通貨</label>
                    <select
                      value={codeForm.minimum_amount_currency}
                      onChange={(e) => setCodeForm({ ...codeForm, minimum_amount_currency: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      disabled={!codeForm.minimum_amount}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="first_time_transaction"
                    checked={codeForm.first_time_transaction}
                    onChange={(e) => setCodeForm({ ...codeForm, first_time_transaction: e.target.checked })}
                    className="rounded border-input"
                  />
                  <label htmlFor="first_time_transaction" className="text-sm">
                    初回購入者のみ利用可能
                  </label>
                </div>
              </div>
              <div className="p-6 border-t flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowCodeModal(false);
                    resetCodeForm();
                  }}
                  disabled={isSubmitting}
                >
                  キャンセル
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? '作成中...' : '作成'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
