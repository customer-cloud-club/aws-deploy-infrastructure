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
  description: string | null;
  stripe_product_id: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

interface ProductForm {
  name: string;
  description: string;
  stripe_product_id: string;
  is_active: boolean;
}

export default function ProductsPage() {
  const { t } = useTranslation('common');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>({
    name: '',
    description: '',
    stripe_product_id: '',
    is_active: true,
  });

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<ProductListResponse>('/admin/products');
      setProducts(response.items);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setError('プロダクトの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      stripe_product_id: '',
      is_active: true,
    });
    setEditingProduct(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || '',
      stripe_product_id: product.stripe_product_id,
      is_active: product.is_active,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.stripe_product_id) {
      alert('プロダクト名とStripe Product IDは必須です');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingProduct) {
        // Update existing product
        await apiClient.put(`/admin/products/${editingProduct.id}`, {
          name: form.name,
          description: form.description || null,
          is_active: form.is_active,
        });
      } else {
        // Create new product
        await apiClient.post('/admin/products', {
          name: form.name,
          description: form.description || null,
          stripe_product_id: form.stripe_product_id,
          is_active: form.is_active,
        });
      }
      closeModal();
      await fetchProducts();
    } catch (err) {
      console.error('Failed to save product:', err);
      alert(editingProduct ? 'プロダクトの更新に失敗しました' : 'プロダクトの作成に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`「${productName}」を削除してもよろしいですか？`)) {
      return;
    }

    try {
      await apiClient.delete(`/admin/products/${productId}`);
      await fetchProducts();
    } catch (err) {
      console.error('Failed to delete product:', err);
      alert('プロダクトの削除に失敗しました');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('products.title')}</h1>
          <p className="text-muted-foreground mt-2">
            プロダクトの登録・管理
          </p>
        </div>
        <Button variant="primary" onClick={openCreateModal}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {t('products.addProduct')}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 p-4 rounded-md">
          {error}
          <button
            onClick={fetchProducts}
            className="ml-4 underline hover:no-underline"
          >
            再試行
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Products ({products.length})</CardTitle>
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
                    <th className="text-left py-3 px-4 font-medium">{t('products.fields.name')}</th>
                    <th className="text-left py-3 px-4 font-medium">{t('products.fields.description')}</th>
                    <th className="text-left py-3 px-4 font-medium">Stripe Product ID</th>
                    <th className="text-left py-3 px-4 font-medium">{t('products.fields.status')}</th>
                    <th className="text-left py-3 px-4 font-medium">{t('products.fields.createdAt')}</th>
                    <th className="text-left py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="border-b hover:bg-accent/50 transition-colors">
                      <td className="py-3 px-4 font-medium">{product.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{product.description || '-'}</td>
                      <td className="py-3 px-4 font-mono text-sm">{product.stripe_product_id}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            product.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {product.is_active ? t('products.status.active') : t('products.status.inactive')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(product.created_at).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(product)}>
                            {t('common.edit')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id, product.name)}
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProducts.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  {products.length === 0 ? 'プロダクトがありません' : t('common.noData')}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingProduct ? 'プロダクトを編集' : '新しいプロダクトを作成'}
              </h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    プロダクト名 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="例: MyApp Pro"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    説明
                  </label>
                  <Input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="例: プレミアム機能が使えるプラン"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Stripe Product ID <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={form.stripe_product_id}
                    onChange={(e) => setForm({ ...form, stripe_product_id: e.target.value })}
                    placeholder="例: prod_xxxxxxxxxxxxx"
                    required
                    disabled={!!editingProduct}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {editingProduct
                      ? 'Stripe Product IDは変更できません'
                      : 'Stripeダッシュボードで作成したProduct ID'}
                  </p>
                </div>
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
                  {isSubmitting ? '保存中...' : (editingProduct ? '更新' : '作成')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
