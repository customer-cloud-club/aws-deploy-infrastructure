# Platform SDK 統合ガイド

共通認証・課金基盤を他のプロジェクトに統合するための完全ガイドです。

---

## 目次

1. [前提条件](#1-前提条件)
2. [インストール](#2-インストール)
3. [基本設定](#3-基本設定)
4. [認証の統合](#4-認証の統合)
5. [エンタイトルメント（利用権）](#5-エンタイトルメント利用権)
6. [使用量トラッキング](#6-使用量トラッキング)
7. [Stripe決済連携](#7-stripe決済連携)
8. [サーバーサイド統合](#8-サーバーサイド統合)
9. [React/Next.js完全統合例](#9-reactnextjs完全統合例)
10. [新規プロダクト登録](#10-新規プロダクト登録)
11. [トラブルシューティング](#11-トラブルシューティング)
12. [APIリファレンス](#12-apiリファレンス)

---

## 1. 前提条件

### 必要なもの

- Node.js 18.x 以上
- npm または yarn
- GitHub アカウント（GitHub Packages アクセス用）

### 対応フレームワーク

- Next.js 13+ (App Router / Pages Router)
- React 18+
- Node.js (Lambda, Express, etc.)

---

## 2. インストール

### 2.1 GitHub Packages 認証設定

プロジェクトのルートに `.npmrc` ファイルを作成します：

```
@customer-cloud-club:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

**GITHUB_TOKEN の取得方法：**

1. GitHub → Settings → Developer settings → Personal access tokens
2. "Generate new token (classic)" をクリック
3. `read:packages` スコープを選択
4. 生成されたトークンを環境変数に設定

```bash
# ~/.bashrc または ~/.zshrc に追加
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

### 2.2 パッケージインストール

```bash
npm install @customer-cloud-club/platform-sdk amazon-cognito-identity-js
```

---

## 3. 基本設定

### 3.1 環境変数

プロジェクトに以下の環境変数を設定します：

```env
# .env.local (Next.js) または .env

# 必須
NEXT_PUBLIC_PLATFORM_API_URL=https://wqqr3nryw0.execute-api.ap-northeast-1.amazonaws.com/dev
NEXT_PUBLIC_PRODUCT_ID=your_product_id

# オプション（Cognito直接認証を使う場合）
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-northeast-1_lSPtvbFS7
NEXT_PUBLIC_COGNITO_CLIENT_ID=5nm9g294deq3r8dl8qkq33eohp
NEXT_PUBLIC_COGNITO_REGION=ap-northeast-1
```

### 3.2 SDK 初期化

```typescript
// lib/platform.ts
import { PlatformSDK } from '@customer-cloud-club/platform-sdk';

let initialized = false;

export function initPlatform() {
  if (initialized) return;

  PlatformSDK.init({
    productId: process.env.NEXT_PUBLIC_PRODUCT_ID!,
    apiUrl: process.env.NEXT_PUBLIC_PLATFORM_API_URL!,
  });

  initialized = true;
}

// アプリ起動時に呼び出し
initPlatform();
```

---

## 4. 認証の統合

### 4.1 認証必須ページ

```typescript
// app/dashboard/page.tsx
import { PlatformSDK } from '@customer-cloud-club/platform-sdk';
import { initPlatform } from '@/lib/platform';

export default async function DashboardPage() {
  initPlatform();

  // 未認証の場合、自動的にログインページへリダイレクト
  const user = await PlatformSDK.requireAuth();

  return (
    <div>
      <h1>ダッシュボード</h1>
      <p>ようこそ、{user.email} さん</p>
      <p>ユーザーID: {user.userId}</p>
    </div>
  );
}
```

### 4.2 認証状態の取得（リダイレクトなし）

```typescript
import { PlatformSDK } from '@customer-cloud-club/platform-sdk';

async function checkAuthStatus() {
  const user = PlatformSDK.getAuthState();

  if (user) {
    console.log('ログイン中:', user.email);
  } else {
    console.log('未ログイン');
  }

  return user;
}
```

### 4.3 ログアウト

```typescript
import { PlatformSDK } from '@customer-cloud-club/platform-sdk';

async function handleLogout() {
  await PlatformSDK.logout();
  window.location.href = '/'; // トップページへリダイレクト
}
```

### 4.4 アクセストークンの取得

API呼び出し時にトークンが必要な場合：

```typescript
const token = await PlatformSDK.getAccessToken();

const response = await fetch('/api/data', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

---

## 5. エンタイトルメント（利用権）

### 5.1 利用権の取得

```typescript
import { PlatformSDK } from '@customer-cloud-club/platform-sdk';

async function checkEntitlement() {
  const entitlement = await PlatformSDK.getEntitlement();

  console.log('プラン:', entitlement.planName);
  console.log('ステータス:', entitlement.status);
  console.log('機能:', entitlement.features);
  console.log('使用量:', entitlement.currentUsage);
  console.log('制限:', entitlement.limits);

  return entitlement;
}
```

**レスポンス例：**

```json
{
  "id": "ent_123",
  "userId": "user_456",
  "productId": "prod_aidreams",
  "planId": "plan_pro",
  "planName": "Pro",
  "status": "active",
  "features": {
    "high_resolution": true,
    "api_access": true,
    "priority_support": false
  },
  "limits": {
    "generations": 1000,
    "apiCalls": 10000,
    "storage": 5000
  },
  "currentUsage": {
    "generations": 150,
    "apiCalls": 2340,
    "storage": 1200,
    "resetAt": "2025-01-01T00:00:00Z"
  }
}
```

### 5.2 機能フラグのチェック

```typescript
// 特定機能が有効かチェック
const hasHighRes = await PlatformSDK.hasFeature('high_resolution');

if (hasHighRes) {
  // Pro機能を表示
  showHighResolutionOption();
} else {
  // アップグレードを促す
  showUpgradePrompt();
}
```

### 5.3 使用制限のチェック

```typescript
async function handleGenerate() {
  // 生成前に制限をチェック
  const { allowed, remaining } = await PlatformSDK.checkLimit('generations');

  if (!allowed) {
    alert(`今月の生成上限に達しました。残り: ${remaining}`);
    return;
  }

  if (remaining < 10) {
    console.warn(`残り生成回数が少なくなっています: ${remaining}`);
  }

  // 生成処理を実行
  await generateContent();
}
```

---

## 6. 使用量トラッキング

### 6.1 使用量の記録

```typescript
import { PlatformSDK } from '@customer-cloud-club/platform-sdk';

// 単一の使用を記録
await PlatformSDK.recordUsage(1, 'generation');

// 複数回の使用を記録
await PlatformSDK.recordUsage(5, 'api_call');

// 簡易メソッド（1を記録）
await PlatformSDK.incrementUsage('generation');
```

### 6.2 バッチで記録

```typescript
// 複数タイプの使用を一度に記録
await PlatformSDK.recordUsageBatch([
  { type: 'generation', amount: 3 },
  { type: 'api_call', amount: 10 },
  { type: 'storage', amount: 50 }, // MB
]);
```

### 6.3 使用量トラッキングのベストプラクティス

```typescript
// 推奨パターン: try-catch で処理を囲む
async function generateImage(prompt: string) {
  // 1. 事前に制限をチェック
  const { allowed } = await PlatformSDK.checkLimit('generations');
  if (!allowed) {
    throw new Error('使用制限に達しました');
  }

  try {
    // 2. メイン処理を実行
    const result = await callAIService(prompt);

    // 3. 成功時のみ使用量を記録
    await PlatformSDK.recordUsage(1, 'generation');

    return result;
  } catch (error) {
    // 失敗時は記録しない
    console.error('生成に失敗:', error);
    throw error;
  }
}
```

---

## 7. Stripe決済連携

### 7.1 チェックアウトセッション作成

```typescript
async function upgradeToPlan(priceId: string) {
  const token = await PlatformSDK.getAccessToken();

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_PLATFORM_API_URL}/checkout`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        price_id: priceId,
        success_url: `${window.location.origin}/checkout/success`,
        cancel_url: `${window.location.origin}/pricing`,
      }),
    }
  );

  if (!response.ok) {
    throw new Error('チェックアウトセッションの作成に失敗しました');
  }

  const { checkout_url } = await response.json();

  // Stripe Checkoutページへリダイレクト
  window.location.href = checkout_url;
}
```

### 7.2 プラン一覧の取得

```typescript
async function getPricingPlans() {
  const plans = await PlatformSDK.getPlans();

  return plans.map(plan => ({
    id: plan.id,
    name: plan.name,
    price: plan.price,
    cycle: plan.billingCycle,
    features: plan.features,
  }));
}
```

### 7.3 プラン選択UI例

```typescript
// components/PricingCard.tsx
import { Plan } from '@customer-cloud-club/platform-sdk';

interface PricingCardProps {
  plan: Plan;
  currentPlanId?: string;
  onSelect: (planId: string) => void;
}

export function PricingCard({ plan, currentPlanId, onSelect }: PricingCardProps) {
  const isCurrent = plan.id === currentPlanId;

  return (
    <div className="border rounded-lg p-6">
      <h3 className="text-xl font-bold">{plan.name}</h3>
      <p className="text-3xl mt-2">
        ¥{plan.price.toLocaleString()}
        <span className="text-sm">/{plan.billingCycle === 'monthly' ? '月' : '年'}</span>
      </p>

      <ul className="mt-4 space-y-2">
        {Object.entries(plan.features).map(([key, value]) => (
          <li key={key}>
            {value === true ? '✓' : value} {key}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(plan.id)}
        disabled={isCurrent}
        className="mt-4 w-full py-2 bg-blue-600 text-white rounded"
      >
        {isCurrent ? '現在のプラン' : 'このプランを選択'}
      </button>
    </div>
  );
}
```

---

## 8. サーバーサイド統合

### 8.1 Next.js API Routes

```typescript
// pages/api/generate.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Authorization ヘッダーからトークンを取得
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);

  // Platform API でエンタイトルメントをチェック
  const entitlementRes = await fetch(
    `${process.env.PLATFORM_API_URL}/me/entitlements?product_id=${process.env.PRODUCT_ID}`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!entitlementRes.ok) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const entitlement = await entitlementRes.json();

  // 使用制限チェック
  if (entitlement.usage.remaining <= 0) {
    return res.status(429).json({ error: 'Usage limit exceeded' });
  }

  // メイン処理
  const result = await processRequest(req.body);

  // 使用量を記録
  await fetch(`${process.env.PLATFORM_API_URL}/me/usage`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_id: process.env.PRODUCT_ID,
      count: 1,
    }),
  });

  return res.status(200).json(result);
}
```

### 8.2 AWS Lambda

```typescript
// handler.ts
import { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = event.headers.Authorization?.replace('Bearer ', '');

  if (!token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  // エンタイトルメントチェック
  const entitlementRes = await fetch(
    `${process.env.PLATFORM_API_URL}/me/entitlements?product_id=${process.env.PRODUCT_ID}`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!entitlementRes.ok) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Access denied' }),
    };
  }

  // 処理を実行...

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true }),
  };
};
```

### 8.3 Express.js ミドルウェア

```typescript
// middleware/platform.ts
import { Request, Response, NextFunction } from 'express';

interface PlatformRequest extends Request {
  entitlement?: any;
  userId?: string;
}

export async function platformAuth(req: PlatformRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const response = await fetch(
      `${process.env.PLATFORM_API_URL}/me/entitlements?product_id=${process.env.PRODUCT_ID}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const entitlement = await response.json();
    req.entitlement = entitlement;
    req.userId = entitlement.user_id;

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 使用例
app.post('/api/generate', platformAuth, async (req, res) => {
  const { entitlement } = req as PlatformRequest;

  if (entitlement.usage.remaining <= 0) {
    return res.status(429).json({ error: 'Limit exceeded' });
  }

  // 処理...
});
```

---

## 9. React/Next.js完全統合例

### 9.1 Context Provider

```typescript
// contexts/PlatformContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { PlatformSDK, AuthUser, Entitlement } from '@customer-cloud-club/platform-sdk';

interface PlatformContextValue {
  user: AuthUser | null;
  entitlement: Entitlement | null;
  loading: boolean;
  error: Error | null;
  logout: () => Promise<void>;
  refreshEntitlement: () => Promise<void>;
  recordUsage: (amount: number, type?: string) => Promise<void>;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    PlatformSDK.init({
      productId: process.env.NEXT_PUBLIC_PRODUCT_ID!,
      apiUrl: process.env.NEXT_PUBLIC_PLATFORM_API_URL!,
    });

    async function initialize() {
      try {
        const authUser = await PlatformSDK.requireAuth();
        setUser(authUser);

        const ent = await PlatformSDK.getEntitlement();
        setEntitlement(ent);
      } catch (err) {
        if (err instanceof Error && !err.message.includes('Redirecting')) {
          setError(err);
        }
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, []);

  const logout = useCallback(async () => {
    await PlatformSDK.logout();
    setUser(null);
    setEntitlement(null);
    window.location.href = '/';
  }, []);

  const refreshEntitlement = useCallback(async () => {
    PlatformSDK.clearCache();
    const ent = await PlatformSDK.getEntitlement();
    setEntitlement(ent);
  }, []);

  const recordUsage = useCallback(async (amount: number, type = 'generation') => {
    await PlatformSDK.recordUsage(amount, type);
    await refreshEntitlement();
  }, [refreshEntitlement]);

  return (
    <PlatformContext.Provider
      value={{
        user,
        entitlement,
        loading,
        error,
        logout,
        refreshEntitlement,
        recordUsage,
      }}
    >
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

// 便利なフック
export function useEntitlement() {
  const { entitlement, loading } = usePlatform();
  return { entitlement, loading };
}

export function useUser() {
  const { user, loading } = usePlatform();
  return { user, loading };
}
```

### 9.2 レイアウトへの適用

```typescript
// app/layout.tsx
import { PlatformProvider } from '@/contexts/PlatformContext';

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

### 9.3 使用量表示コンポーネント

```typescript
// components/UsageDisplay.tsx
'use client';

import { useEntitlement } from '@/contexts/PlatformContext';

export function UsageDisplay() {
  const { entitlement, loading } = useEntitlement();

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-20 rounded" />;
  }

  if (!entitlement) {
    return null;
  }

  const { currentUsage, limits } = entitlement;
  const percentage = limits.generations
    ? (currentUsage.generations / limits.generations) * 100
    : 0;

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-2">使用状況</h3>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>生成回数</span>
            <span>{currentUsage.generations} / {limits.generations || '∞'}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>

        <div className="text-xs text-gray-500">
          リセット: {new Date(currentUsage.resetAt).toLocaleDateString('ja-JP')}
        </div>
      </div>
    </div>
  );
}
```

### 9.4 機能ゲートコンポーネント

```typescript
// components/FeatureGate.tsx
'use client';

import { useEntitlement } from '@/contexts/PlatformContext';
import { ReactNode } from 'react';

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { entitlement, loading } = useEntitlement();

  if (loading) {
    return null;
  }

  const hasFeature = entitlement?.features[feature];

  if (!hasFeature) {
    return fallback || <UpgradePrompt feature={feature} />;
  }

  return <>{children}</>;
}

function UpgradePrompt({ feature }: { feature: string }) {
  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <p className="text-yellow-800">
        この機能（{feature}）を使用するにはプランのアップグレードが必要です。
      </p>
      <a href="/pricing" className="text-blue-600 underline mt-2 inline-block">
        プランを確認する →
      </a>
    </div>
  );
}
```

使用例：

```typescript
// app/editor/page.tsx
import { FeatureGate } from '@/components/FeatureGate';

export default function EditorPage() {
  return (
    <div>
      <h1>エディター</h1>

      {/* 基本機能 - 全員に表示 */}
      <BasicEditor />

      {/* Pro機能 - high_resolution が有効な場合のみ表示 */}
      <FeatureGate feature="high_resolution">
        <HighResolutionOptions />
      </FeatureGate>

      {/* API機能 - カスタムフォールバック付き */}
      <FeatureGate
        feature="api_access"
        fallback={<div>APIアクセスはProプラン以上で利用可能です</div>}
      >
        <ApiKeyManager />
      </FeatureGate>
    </div>
  );
}
```

---

## 10. 新規プロダクト登録

新しいプロダクトを認証基盤に登録する手順です。

### 10.1 Admin権限の取得

```bash
# Cognitoユーザーにadminグループを追加
aws cognito-idp admin-add-user-to-group \
  --user-pool-id ap-northeast-1_lSPtvbFS7 \
  --username your-admin@example.com \
  --group-name admin
```

### 10.2 プロダクト作成

```bash
# Admin APIでプロダクトを作成
curl -X POST https://wqqr3nryw0.execute-api.ap-northeast-1.amazonaws.com/dev/admin/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My New App",
    "description": "新しいアプリケーション",
    "stripe_product_id": "prod_xxxxxxxx"
  }'
```

**レスポンス例：**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My New App",
  "stripe_product_id": "prod_xxxxxxxx",
  "created_at": "2025-01-01T00:00:00Z"
}
```

### 10.3 プラン作成

```bash
# Freeプラン
curl -X POST https://wqqr3nryw0.execute-api.ap-northeast-1.amazonaws.com/dev/admin/plans \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Free",
    "billing_period": "monthly",
    "price_amount": 0,
    "currency": "JPY",
    "metadata": {
      "features": {
        "basic_access": true
      },
      "limits": {
        "generations": 10,
        "api_calls": 100
      }
    }
  }'

# Proプラン
curl -X POST https://wqqr3nryw0.execute-api.ap-northeast-1.amazonaws.com/dev/admin/plans \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Pro",
    "billing_period": "monthly",
    "price_amount": 1980,
    "currency": "JPY",
    "metadata": {
      "features": {
        "basic_access": true,
        "high_resolution": true,
        "api_access": true
      },
      "limits": {
        "generations": 1000,
        "api_calls": 10000
      }
    }
  }'
```

### 10.4 プロジェクトへの適用

```env
# .env.local
NEXT_PUBLIC_PRODUCT_ID=prod_xxxxxxxx
```

---

## 11. トラブルシューティング

### 11.1 認証エラー

**症状:** `Unauthorized` エラーが発生する

**解決策:**
1. トークンの有効期限を確認
2. Cognito User Pool IDとClient IDが正しいか確認
3. API URLが正しいか確認

```typescript
// トークンのデバッグ
const token = await PlatformSDK.getAccessToken();
console.log('Token exists:', !!token);

// JWTをデコードして確認
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Token expires:', new Date(payload.exp * 1000));
```

### 11.2 CORS エラー

**症状:** `Access-Control-Allow-Origin` エラー

**解決策:**
API Gateway のCORS設定を確認。開発環境では以下を許可：

- `http://localhost:3000`
- `http://localhost:5173`

### 11.3 使用量が更新されない

**症状:** `recordUsage` 後もカウントが変わらない

**解決策:**
```typescript
// キャッシュをクリアして再取得
PlatformSDK.clearCache();
const entitlement = await PlatformSDK.getEntitlement();
```

### 11.4 GitHub Packages インストールエラー

**症状:** `npm install` で 401/403 エラー

**解決策:**
1. GITHUB_TOKEN が設定されているか確認
2. トークンに `read:packages` スコープがあるか確認
3. `.npmrc` が正しく設定されているか確認

```bash
# トークンの確認
echo $GITHUB_TOKEN

# npm設定の確認
npm config list
```

---

## 12. APIリファレンス

### エンドポイント一覧

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|---------|------|------|
| `/me/entitlements` | GET | 必須 | エンタイトルメント取得 |
| `/me/usage` | POST | 必須 | 使用量記録 |
| `/checkout` | POST | 必須 | Stripeチェックアウト作成 |
| `/billing/webhook` | POST | なし | Stripe Webhook |
| `/admin/products` | GET/POST | Admin | プロダクト管理 |
| `/admin/plans` | GET/POST/PUT/DELETE | Admin | プラン管理 |
| `/admin/tenants` | GET/POST | Admin | テナント管理 |

### SDK メソッド一覧

| メソッド | 説明 |
|---------|------|
| `PlatformSDK.init(config)` | SDK初期化 |
| `PlatformSDK.requireAuth()` | 認証必須（リダイレクトあり） |
| `PlatformSDK.getAuthState()` | 認証状態取得 |
| `PlatformSDK.getAccessToken()` | アクセストークン取得 |
| `PlatformSDK.logout()` | ログアウト |
| `PlatformSDK.getEntitlement()` | エンタイトルメント取得 |
| `PlatformSDK.hasFeature(key)` | 機能フラグチェック |
| `PlatformSDK.checkLimit(type)` | 使用制限チェック |
| `PlatformSDK.getPlans()` | プラン一覧取得 |
| `PlatformSDK.recordUsage(amount, type)` | 使用量記録 |
| `PlatformSDK.incrementUsage(type)` | 使用量+1 |
| `PlatformSDK.clearCache()` | キャッシュクリア |

---

## サポート

問題が解決しない場合は、以下にお問い合わせください：

- GitHub Issues: https://github.com/customer-cloud-club/aws-deploy-infrastructure/issues
- Email: support@example.com
