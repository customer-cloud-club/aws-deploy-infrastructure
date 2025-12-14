'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import apiClient from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'superAdmin' | 'user';
  status: 'active' | 'inactive';
  lastLogin: string;
  createdAt: string;
  emailVerified: boolean;
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
  const [createForm, setCreateForm] = useState<CreateUserRequest>({ email: '', name: '', role: 'user' });
  const [creating, setCreating] = useState(false);

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
      await apiClient.post<User>('/admin/users', createForm);
      setShowCreateModal(false);
      setCreateForm({ email: '', name: '', role: 'user' });
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
                    <th className="text-left py-3 px-4 font-medium">{t('users.fields.role')}</th>
                    <th className="text-left py-3 px-4 font-medium">{t('users.fields.status')}</th>
                    <th className="text-left py-3 px-4 font-medium">{t('users.fields.lastLogin')}</th>
                    <th className="text-left py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-accent/50 transition-colors">
                      <td className="py-3 px-4 font-medium">{user.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
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
                        <div className="flex gap-2">
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
    </div>
  );
}
