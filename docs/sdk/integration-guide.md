# Platform SDK 統合ガイド

このガイドでは、各フレームワークでのPlatform SDK統合方法を詳しく説明します。

## 目次

1. [Next.js App Router](#nextjs-app-router)
2. [Next.js Pages Router](#nextjs-pages-router)
3. [React SPA](#react-spa)
4. [Express/Node.js API](#expressnodejs-api)
5. [認証フロー詳細](#認証フロー詳細)
6. [利用権チェック詳細](#利用権チェック詳細)
7. [使用量記録詳細](#使用量記録詳細)
8. [エラーハンドリング](#エラーハンドリング)
9. [ベストプラクティス](#ベストプラクティス)

---

## Next.js App Router

### プロジェクト構成

```
app/
├── layout.tsx          # ルートレイアウト
├── providers.tsx       # SDK Provider
├── page.tsx            # ホームページ
├── login/
│   └── page.tsx        # ログインページ
├── dashboard/
│   ├── layout.tsx      # 認証必須レイアウト
│   └── page.tsx        # ダッシュボード
└── api/
    └── auth/
        └── callback/
            └── route.ts # 認証コールバック
```

### 1. Provider 設定

```typescript
// app/providers.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { PlatformSDK, AuthUser, Entitlement } from '@customer-cloud-club/platform-sdk';

interface PlatformContextType {
  user: AuthUser | null;
  entitlement: Entitlement | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refreshEntitlement: () => Promise<void>;
}

const PlatformContext = createContext<PlatformContextType | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SDK初期化
    PlatformSDK.init({
      productId: process.env.NEXT_PUBLIC_PLATFORM_PRODUCT_ID!,
      apiUrl: process.env.NEXT_PUBLIC_PLATFORM_API_URL!,
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
      clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
    });

    // 認証状態チェック
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const authState = await PlatformSDK.getAuthState();
      if (authState.isAuthenticated && authState.user) {
        setUser(authState.user);
        const ent = await PlatformSDK.getEntitlement();
        setEntitlement(ent);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  }

  function login() {
    // Cognito Hosted UI にリダイレクト
    const loginUrl = `https://${process.env.NEXT_PUBLIC_COGNITO_DOMAIN}/login?` +
      `client_id=${process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID}&` +
      `response_type=code&` +
      `scope=openid+email+profile&` +
      `redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/callback')}`;
    window.location.href = loginUrl;
  }

  async function logout() {
    await PlatformSDK.logout();
    setUser(null);
    setEntitlement(null);
    window.location.href = '/';
  }

  async function refreshEntitlement() {
    PlatformSDK.clearCache();
    const ent = await PlatformSDK.getEntitlement();
    setEntitlement(ent);
  }

  return (
    <PlatformContext.Provider value={{ user, entitlement, loading, login, logout, refreshEntitlement }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error('usePlatform must be used within PlatformProvider');
  }
  return context;
}
```

### 2. ルートレイアウト

```typescript
// app/layout.tsx
import { PlatformProvider } from './providers';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <PlatformProvider>
          {children}
        </PlatformProvider>
      </body>
    </html>
  );
}
```

### 3. 認証必須ページ

```typescript
// app/dashboard/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePlatform } from '../providers';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = usePlatform();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
```

### 4. ダッシュボードページ

```typescript
// app/dashboard/page.tsx
'use client';

import { useState } from 'react';
import { usePlatform } from '../providers';
import { PlatformSDK } from '@customer-cloud-club/platform-sdk';

export default function DashboardPage() {
  const { user, entitlement, logout, refreshEntitlement } = usePlatform();
  const [usageLoading, setUsageLoading] = useState(false);

  async function handleRecordUsage() {
    setUsageLoading(true);
    try {
      await PlatformSDK.recordUsage(1, 'generation');
      await refreshEntitlement();
      alert('Usage recorded!');
    } catch (error) {
      alert('Failed to record usage');
    } finally {
      setUsageLoading(false);
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

      {/* ユーザー情報 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">User</h2>
        <p>Email: {user?.email}</p>
        <p>User ID: {user?.userId}</p>
        <button
          onClick={logout}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>

      {/* 利用権情報 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Entitlement</h2>
        <p>Plan: {entitlement?.planName}</p>
        <p>Status: {entitlement?.status}</p>

        <h3 className="font-medium mt-4 mb-2">Features</h3>
        <ul>
          {entitlement?.features && Object.entries(entitlement.features).map(([key, value]) => (
            <li key={key}>{key}: {String(value)}</li>
          ))}
        </ul>

        <h3 className="font-medium mt-4 mb-2">Usage</h3>
        <ul>
          {entitlement?.currentUsage && Object.entries(entitlement.currentUsage).map(([key, value]) => (
            <li key={key}>{key}: {value} / {entitlement.limits[key] || '∞'}</li>
          ))}
        </ul>
      </div>

      {/* 使用量記録 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-2">Record Usage</h2>
        <button
          onClick={handleRecordUsage}
          disabled={usageLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {usageLoading ? 'Recording...' : 'Record 1 Generation'}
        </button>
      </div>
    </div>
  );
}
```

### 5. 認証コールバック API Route

```typescript
// app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/login?error=' + error, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url));
  }

  try {
    // トークン交換
    const tokenResponse = await fetch(
      `https://${process.env.NEXT_PUBLIC_COGNITO_DOMAIN}/oauth2/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
        }),
      }
    );

    const tokens = await tokenResponse.json();

    // トークンをクッキーに保存してリダイレクト
    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    response.cookies.set('access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in,
    });
    response.cookies.set('id_token', tokens.id_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in,
    });

    return response;
  } catch (error) {
    console.error('Token exchange failed:', error);
    return NextResponse.redirect(new URL('/login?error=token_exchange_failed', request.url));
  }
}
```

---

## Next.js Pages Router

### 1. _app.tsx

```typescript
// pages/_app.tsx
import type { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import { PlatformSDK } from '@customer-cloud-club/platform-sdk';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    PlatformSDK.init({
      productId: process.env.NEXT_PUBLIC_PLATFORM_PRODUCT_ID!,
      apiUrl: process.env.NEXT_PUBLIC_PLATFORM_API_URL!,
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
      clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
    });
    setInitialized(true);
  }, []);

  if (!initialized) return null;

  return <Component {...pageProps} />;
}
```

### 2. HOC for Protected Pages

```typescript
// lib/withAuth.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { PlatformSDK, AuthUser } from '@customer-cloud-club/platform-sdk';

export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P & { user: AuthUser }>
) {
  return function AuthenticatedComponent(props: P) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
      async function checkAuth() {
        try {
          const authUser = await PlatformSDK.requireAuth();
          setUser(authUser);
        } catch {
          router.push('/login');
        } finally {
          setLoading(false);
        }
      }
      checkAuth();
    }, [router]);

    if (loading) {
      return <div>Loading...</div>;
    }

    if (!user) {
      return null;
    }

    return <WrappedComponent {...props} user={user} />;
  };
}
```

---

## React SPA

### 1. App Setup

```typescript
// src/App.tsx
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PlatformSDK, AuthUser } from '@customer-cloud-club/platform-sdk';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';

function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    PlatformSDK.init({
      productId: import.meta.env.VITE_PLATFORM_PRODUCT_ID,
      apiUrl: import.meta.env.VITE_PLATFORM_API_URL,
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
    });
    setInitialized(true);
  }, []);

  if (!initialized) return null;

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default App;
```

### 2. Auth Context

```typescript
// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { PlatformSDK, AuthUser } from '@customer-cloud-club/platform-sdk';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const state = await PlatformSDK.getAuthState();
      if (state.isAuthenticated && state.user) {
        setUser(state.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  }

  function login() {
    // OAuth login redirect
    window.location.href = '/api/auth/login';
  }

  async function logout() {
    await PlatformSDK.logout();
    setUser(null);
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

---

## Express/Node.js API

### 1. JWT検証ミドルウェア

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid!, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    groups: string[];
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  jwt.verify(
    token,
    getKey,
    {
      issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
      algorithms: ['RS256'],
    },
    (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const payload = decoded as jwt.JwtPayload;
      req.user = {
        userId: payload.sub!,
        email: payload.email,
        groups: payload['cognito:groups'] || [],
      };

      next();
    }
  );
}
```

### 2. 利用権チェックミドルウェア

```typescript
// src/middleware/entitlement.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

const API_URL = process.env.PLATFORM_API_URL;

export function entitlementMiddleware(requiredFeature?: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
      // 利用権を取得
      const response = await fetch(`${API_URL}/me/entitlements`, {
        headers: {
          Authorization: req.headers.authorization!,
        },
      });

      if (!response.ok) {
        return res.status(403).json({ error: 'No valid entitlement' });
      }

      const entitlement = await response.json();

      // ステータスチェック
      if (entitlement.status !== 'active') {
        return res.status(403).json({ error: 'Subscription not active' });
      }

      // 機能フラグチェック
      if (requiredFeature && !entitlement.features[requiredFeature]) {
        return res.status(403).json({ error: `Feature '${requiredFeature}' not available` });
      }

      // リクエストに利用権を追加
      (req as any).entitlement = entitlement;

      next();
    } catch (error) {
      console.error('Entitlement check failed:', error);
      return res.status(500).json({ error: 'Failed to check entitlement' });
    }
  };
}
```

### 3. 使用量記録

```typescript
// src/services/usage.ts
const API_URL = process.env.PLATFORM_API_URL;

export async function recordUsage(
  userId: string,
  accessToken: string,
  amount: number,
  type: string
): Promise<void> {
  const response = await fetch(`${API_URL}/me/usage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ amount, type }),
  });

  if (!response.ok) {
    throw new Error(`Failed to record usage: ${response.status}`);
  }
}
```

### 4. Express App

```typescript
// src/app.ts
import express from 'express';
import { authMiddleware, AuthRequest } from './middleware/auth';
import { entitlementMiddleware } from './middleware/entitlement';
import { recordUsage } from './services/usage';

const app = express();
app.use(express.json());

// 公開エンドポイント
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 認証必須エンドポイント
app.get('/api/profile', authMiddleware, (req: AuthRequest, res) => {
  res.json({
    userId: req.user!.userId,
    email: req.user!.email,
  });
});

// 利用権必須エンドポイント
app.post(
  '/api/generate',
  authMiddleware,
  entitlementMiddleware('ai_generation'),
  async (req: AuthRequest, res) => {
    try {
      // AI生成処理...
      const result = { text: 'Generated content' };

      // 使用量を記録
      await recordUsage(
        req.user!.userId,
        req.headers.authorization!.substring(7),
        1,
        'generation'
      );

      res.json(result);
    } catch (error) {
      console.error('Generation failed:', error);
      res.status(500).json({ error: 'Generation failed' });
    }
  }
);

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

## エラーハンドリング

### SDK エラー種別

```typescript
import { PlatformSDK, PlatformError } from '@customer-cloud-club/platform-sdk';

try {
  await PlatformSDK.requireAuth();
} catch (error) {
  if (error instanceof PlatformError) {
    switch (error.code) {
      case 'NOT_AUTHENTICATED':
        // 未認証 -> ログインページへリダイレクト
        window.location.href = '/login';
        break;
      case 'TOKEN_EXPIRED':
        // トークン期限切れ -> 再ログイン
        await PlatformSDK.logout();
        window.location.href = '/login';
        break;
      case 'NO_ENTITLEMENT':
        // 利用権なし -> プラン選択ページへ
        window.location.href = '/pricing';
        break;
      case 'LIMIT_EXCEEDED':
        // 制限超過
        alert('Usage limit exceeded. Please upgrade your plan.');
        break;
      case 'NETWORK_ERROR':
        // ネットワークエラー
        alert('Network error. Please try again.');
        break;
      default:
        console.error('Unknown error:', error);
    }
  }
}
```

---

## ベストプラクティス

### 1. キャッシュ管理

```typescript
// 利用権はキャッシュされる（デフォルト5分）
// 必要に応じてキャッシュをクリア
await PlatformSDK.clearCache();

// 最新の利用権を取得
const entitlement = await PlatformSDK.getEntitlement();
```

### 2. 使用量記録のバッチ処理

```typescript
// 個別記録（リアルタイム）
await PlatformSDK.recordUsage(1, 'generation');

// バッチ記録（効率的）
const usageRecords = [
  { amount: 10, type: 'generation' },
  { amount: 1500, type: 'tokens' },
];
await PlatformSDK.recordUsageBatch(usageRecords);
```

### 3. 認証状態の監視

```typescript
// ページ読み込み時にチェック
useEffect(() => {
  const checkAuthPeriodically = setInterval(async () => {
    const state = await PlatformSDK.getAuthState();
    if (!state.isAuthenticated) {
      // セッション切れ
      window.location.href = '/login';
    }
  }, 60000); // 1分ごと

  return () => clearInterval(checkAuthPeriodically);
}, []);
```

### 4. セキュリティ

```typescript
// アクセストークンは直接公開しない
// 必要な場合のみ取得
const token = await PlatformSDK.getAccessToken();

// サーバーサイドでのみ機密操作を行う
// クライアントサイドでは読み取り専用の操作のみ
```

---

## 次のステップ

- [API リファレンス](./api-reference.md) - 全メソッドの詳細仕様
- [トラブルシューティング](./troubleshooting.md) - よくある問題と解決方法
- [サンプルアプリケーション](../../examples/) - 実際のコード例
