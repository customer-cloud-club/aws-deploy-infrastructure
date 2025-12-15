# Platform SDK クイックスタート

このガイドでは、5分で認証・課金基盤をアプリケーションに統合する方法を説明します。

## 前提条件

- Node.js 18以上
- npm または yarn
- GitHub アカウント（パッケージアクセス用）

## Step 1: インストール (1分)

### GitHub Packages 認証設定

プロジェクトルートに `.npmrc` を作成:

```bash
# .npmrc
@customer-cloud-club:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

環境変数に GitHub トークンを設定:

```bash
export GITHUB_TOKEN=your_github_token
```

### パッケージインストール

```bash
npm install @customer-cloud-club/platform-sdk
```

## Step 2: 環境変数設定 (1分)

`.env.local` を作成:

```bash
# 必須
NEXT_PUBLIC_PLATFORM_PRODUCT_ID=your_product_id

# ========================================
# 開発環境（Dev）
# ========================================
NEXT_PUBLIC_PLATFORM_API_URL=https://cc-auth-dev.aidreams-factory.com
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-northeast-1_lSPtvbFS7
NEXT_PUBLIC_COGNITO_CLIENT_ID=5nm9g294deq3r8dl8qkq33eohp

# ========================================
# 本番環境（Prod）の場合は以下を使用
# ========================================
# NEXT_PUBLIC_PLATFORM_API_URL=https://cc-auth.aidreams-factory.com
# NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-northeast-1_z76s7mTve
# NEXT_PUBLIC_COGNITO_CLIENT_ID=6qpglrhtneplr9jvfcq4jpnr7r
```

### 環境別エンドポイント一覧

| 環境 | API URL | Cognito User Pool |
|------|---------|-------------------|
| Dev | `https://cc-auth-dev.aidreams-factory.com` | `ap-northeast-1_lSPtvbFS7` |
| Prod | `https://cc-auth.aidreams-factory.com` | `ap-northeast-1_z76s7mTve` |

## Step 3: SDK初期化 (1分)

### Next.js (App Router)

```typescript
// app/providers.tsx
'use client';

import { useEffect } from 'react';
import { PlatformSDK } from '@customer-cloud-club/platform-sdk';

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    PlatformSDK.init({
      productId: process.env.NEXT_PUBLIC_PLATFORM_PRODUCT_ID!,
      apiUrl: process.env.NEXT_PUBLIC_PLATFORM_API_URL!,
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
      clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
    });
  }, []);

  return <>{children}</>;
}
```

```typescript
// app/layout.tsx
import { PlatformProvider } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <PlatformProvider>{children}</PlatformProvider>
      </body>
    </html>
  );
}
```

## Step 4: 認証チェック (1分)

```typescript
// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { PlatformSDK, AuthUser } from '@customer-cloud-club/platform-sdk';

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        // 認証必須（未ログインなら自動リダイレクト）
        const authUser = await PlatformSDK.requireAuth();
        setUser(authUser);
      } catch (error) {
        console.error('Authentication failed:', error);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not authenticated</div>;

  return (
    <div>
      <h1>Welcome, {user.email}!</h1>
      <p>User ID: {user.userId}</p>
    </div>
  );
}
```

## Step 5: 利用権チェック (1分)

```typescript
// app/dashboard/page.tsx
import { PlatformSDK } from '@customer-cloud-club/platform-sdk';

export default function DashboardPage() {
  const [entitlement, setEntitlement] = useState(null);

  useEffect(() => {
    async function loadEntitlement() {
      const ent = await PlatformSDK.getEntitlement();
      setEntitlement(ent);
    }
    loadEntitlement();
  }, []);

  // 機能フラグチェック
  const hasPro = await PlatformSDK.hasFeature('pro_features');

  // 使用制限チェック
  const { allowed, remaining } = await PlatformSDK.checkLimit('api_calls');

  return (
    <div>
      <p>Plan: {entitlement?.planName}</p>
      <p>Pro Features: {hasPro ? 'Enabled' : 'Disabled'}</p>
      <p>API Calls Remaining: {remaining}</p>
    </div>
  );
}
```

## 完成！

これで基本的な統合が完了しました。

## 次のステップ

- [統合ガイド（詳細）](./integration-guide.md) - より詳しい実装方法
- [API リファレンス](./api-reference.md) - 全メソッドの詳細
- [トラブルシューティング](./troubleshooting.md) - よくある問題と解決方法

## よく使うコード

### ログアウト

```typescript
await PlatformSDK.logout();
window.location.href = '/';
```

### 使用量記録

```typescript
// 1回の使用を記録
await PlatformSDK.recordUsage(1, 'generation');

// インクリメント（+1）
await PlatformSDK.incrementUsage('api_call');

// バッチ記録
await PlatformSDK.recordUsageBatch([
  { amount: 1, type: 'generation' },
  { amount: 100, type: 'tokens' },
]);
```

### プラン一覧取得

```typescript
const plans = await PlatformSDK.getPlans();
plans.forEach(plan => {
  console.log(`${plan.name}: ¥${plan.price}/month`);
});
```

### Stripe Checkout

```typescript
// チェックアウトセッション作成
const response = await fetch(`${apiUrl}/checkout`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${await PlatformSDK.getAccessToken()}`,
  },
  body: JSON.stringify({
    plan_id: 'price_xxx',
    product_id: 'prod_xxx',
    success_url: `${window.location.origin}/success`,
    cancel_url: `${window.location.origin}/cancel`,
  }),
});

const { url } = await response.json();
window.location.href = url; // Stripe Checkout にリダイレクト
```

## サポート

問題が発生した場合は:

1. [トラブルシューティングガイド](./troubleshooting.md)を確認
2. [GitHub Issues](https://github.com/customer-cloud-club/aws-deploy-infrastructure/issues)で質問
