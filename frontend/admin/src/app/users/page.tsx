'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import apiClient from '@/lib/api';

interface UserProduct {
  id: string;
  name: string;
  lastLoginAt: string;
}

interface User {
  id: string;
  sub: string;  // Cognito sub (UUID) for database lookups
  name: string;
  email: string;
  role: 'admin' | 'superAdmin' | 'user';
  status: 'active' | 'inactive';
  lastLogin: string;
  createdAt: string;
  emailVerified: boolean;
  products?: UserProduct[];
}

interface UserLoginHistory {
  product_id: string;
  product_name: string;
  first_login_at: string;
  last_login_at: string;
  login_count: number;
}

interface UsersResponse {
  users: User[];
  total: number;
  nextToken: string | null;
}

interface CreateUserRequest {
  email: string;
  name: string;
  role?: 'admin' | 'user';
  temporaryPassword?: string;
}

export default function UsersPage() {
  const { t } = useTranslation('common');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserRequest>({ email: '', name: '', role: 'user', temporaryPassword: '' });
  const [creating, setCreating] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userLogins, setUserLogins] = useState<UserLoginHistory[]>([]);
  const [loadingLogins, setLoadingLogins] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [settingPassword, setSettingPassword] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<UsersResponse>('/admin/users');
      setUsers(response.users || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superAdmin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const handleCreateUser = async () => {
    if (!createForm.email) return;

    try {
      setCreating(true);
      // Build request - only include temporaryPassword if provided
      const requestBody: CreateUserRequest = {
        email: createForm.email,
        name: createForm.name,
        role: createForm.role,
      };
      if (createForm.temporaryPassword) {
        requestBody.temporaryPassword = createForm.temporaryPassword;
      }
      await apiClient.post<User>('/admin/users', requestBody);
      setShowCreateModal(false);
      setCreateForm({ email: '', name: '', role: 'user', temporaryPassword: '' });
      await fetchUsers();
    } catch (err) {
      console.error('Failed to create user:', err);
      alert(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      await apiClient.put(`/admin/users/${encodeURIComponent(user.id)}`, { status: newStatus });
      await fetchUsers();
    } catch (err) {
      console.error('Failed to update user status:', err);
      alert(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to disable ${user.email}?`)) return;

    try {
      await apiClient.delete(`/admin/users/${encodeURIComponent(user.id)}`);
      await fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleOpenUserDetail = async (user: User) => {
    setSelectedUser(user);
    setUserLogins([]);
    setLoadingLogins(true);

    try {
      const response = await apiClient.get<{ logins: UserLoginHistory[] }>(
        `/admin/users/${encodeURIComponent(user.id)}/logins`
      );
      setUserLogins(response.logins || []);
    } catch (err) {
      console.error('Failed to fetch user logins:', err);
    } finally {
      setLoadingLogins(false);
    }
  };

  const handleOpenPasswordModal = (user: User) => {
    setSelectedUser(user);
    setPasswordForm({ password: '', confirmPassword: '' });
    setShowPasswordModal(true);
  };

  const handleSetPassword = async () => {
    if (!selectedUser) return;

    if (passwordForm.password !== passwordForm.confirmPassword) {
      alert('パスワードが一致しません');
      return;
    }

    if (passwordForm.password.length < 8) {
      alert('パスワードは8文字以上必要です');
      return;
    }

    try {
      setSettingPassword(true);
      await apiClient.post(`/admin/users/${encodeURIComponent(selectedUser.id)}/password`, {
        password: passwordForm.password,
      });
      alert('パスワードを更新しました');
      setShowPasswordModal(false);
      setPasswordForm({ password: '', confirmPassword: '' });
    } catch (err) {
      console.error('Failed to set password:', err);
      alert(err instanceof Error ? err.message : 'パスワードの更新に失敗しました');
    } finally {
      setSettingPassword(false);
    }
  };

  const getProductBadgeColor = (productId: string | undefined) => {
    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
    ];
    if (!productId) return colors[0];
    const hash = productId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('users.title')}</h1>
          <p className="text-muted-foreground mt-2">
            Manage user accounts and permissions
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {t('users.addUser')}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>All Users</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Input
                type="search"
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64"
              />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Roles</option>
                <option value="superAdmin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">{t('users.fields.name')}</th>
                    <th className="text-left py-3 px-4 font-medium">{t('users.fields.email')}</th>
                    <th className="text-left py-3 px-4 font-medium">Services</th>
                    <th className="text-left py-3 px-4 font-medium">{t('users.fields.role')}</th>
                    <th className="text-left py-3 px-4 font-medium">{t('users.fields.status')}</th>
                    <th className="text-left py-3 px-4 font-medium">{t('users.fields.lastLogin')}</th>
                    <th className="text-left py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => handleOpenUserDetail(user)}
                    >
                      <td className="py-3 px-4 font-medium">{user.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {Array.isArray(user.products) && user.products.length > 0 ? (
                            <>
                              {user.products.slice(0, 3).map((product, idx) => (
                                <span
                                  key={product?.id || idx}
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getProductBadgeColor(product?.id)}`}
                                  title={product?.lastLoginAt ? `Last: ${formatDate(product.lastLoginAt)}` : ''}
                                >
                                  {product?.name || 'Unknown'}
                                </span>
                              ))}
                              {user.products.length > 3 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                  +{user.products.length - 3}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                            user.role
                          )}`}
                        >
                          {t(`users.roles.${user.role}`)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.status === 'active'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{formatDate(user.lastLogin)}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenPasswordModal(user)}>
                            PW変更
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(user)}>
                            {user.status === 'active' ? 'Disable' : 'Enable'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user)}>
                            {t('common.delete')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  {t('common.noData')}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? '-' : users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {loading ? '-' : users.filter((u) => u.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {loading ? '-' : users.filter((u) => u.role === 'admin' || u.role === 'superAdmin').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New User</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'admin' | 'user' })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">パスワード</label>
                <Input
                  type="password"
                  value={createForm.temporaryPassword || ''}
                  onChange={(e) => setCreateForm({ ...createForm, temporaryPassword: e.target.value })}
                  placeholder="空欄の場合は自動生成してメール送信"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  入力すると指定したパスワードで作成（メール通知なし）
                </p>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleCreateUser} disabled={creating || !createForm.email}>
                  {creating ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedUser(null)}>
          <div className="bg-background rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">User Details</h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* User Info */}
            <div className="bg-accent/30 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedUser.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(selectedUser.role)}`}>
                    {t(`users.roles.${selectedUser.role}`)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedUser.status === 'active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                    {selectedUser.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDate(selectedUser.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Login</p>
                  <p className="font-medium">{formatDate(selectedUser.lastLogin)}</p>
                </div>
              </div>
            </div>

            {/* Service Usage */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Service Usage History</h3>
              {loadingLogins ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : userLogins.length > 0 ? (
                <div className="space-y-3">
                  {userLogins.map((login) => (
                    <div
                      key={login.product_id}
                      className="border rounded-lg p-4 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded text-sm font-medium ${getProductBadgeColor(login.product_id)}`}>
                          {login.product_name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {login.login_count} logins
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">First Login: </span>
                          <span>{formatDate(login.first_login_at)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last Login: </span>
                          <span>{formatDate(login.last_login_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No service usage history
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <Button variant="secondary" onClick={() => setSelectedUser(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">パスワード変更</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {selectedUser.email} のパスワードを変更
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">新しいパスワード *</label>
                <Input
                  type="password"
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                  placeholder="8文字以上"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">パスワード確認 *</label>
                <Input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="もう一度入力"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                大文字・小文字・数字・記号を含む8文字以上
              </p>
              <div className="flex gap-3 justify-end mt-6">
                <Button variant="secondary" onClick={() => setShowPasswordModal(false)}>
                  キャンセル
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSetPassword}
                  disabled={settingPassword || !passwordForm.password || !passwordForm.confirmPassword}
                >
                  {settingPassword ? '更新中...' : '更新'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
