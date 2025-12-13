# @customer-cloud-club/platform-sdk

共通認証・課金基盤の統合SDK

## インストール

### 1. GitHub Packages 認証

`.npmrc` をプロジェクトルートに作成:

```
@customer-cloud-club:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### 2. パッケージインストール

```bash
npm install @customer-cloud-club/platform-sdk amazon-cognito-identity-js
```

## クイックスタート

```typescript
import { PlatformSDK } from '@customer-cloud-club/platform-sdk';

// 初期化
PlatformSDK.init({
  productId: 'your_product_id',
  apiUrl: 'https://api.example.com',
});

// 認証必須（未ログインなら自動リダイレクト）
const user = await PlatformSDK.requireAuth();
console.log('Welcome,', user.email);

// エンタイトルメント取得
const entitlement = await PlatformSDK.getEntitlement();
console.log('Plan:', entitlement.planName);

// 機能フラグチェック
if (await PlatformSDK.hasFeature('pro_feature')) {
  // Pro機能を有効化
}

// 使用制限チェック
const { allowed, remaining } = await PlatformSDK.checkLimit('generations');
if (!allowed) {
  console.log('制限に達しました');
}

// 使用量を記録
await PlatformSDK.recordUsage(1, 'generation');

// ログアウト
await PlatformSDK.logout();
```

## API リファレンス

### 初期化

```typescript
PlatformSDK.init(config: PlatformConfig): void
```

### 認証

| メソッド | 説明 |
|---------|------|
| `requireAuth()` | 認証必須。未認証ならリダイレクト |
| `getAuthState()` | 現在の認証状態を取得 |
| `getAccessToken()` | アクセストークンを取得 |
| `setAuthTokens(...)` | トークンを設定（サーバーサイド用） |
| `logout()` | ログアウト |

### エンタイトルメント

| メソッド | 説明 |
|---------|------|
| `getEntitlement()` | 利用権情報を取得 |
| `hasFeature(key)` | 機能フラグをチェック |
| `checkLimit(type)` | 使用制限をチェック |
| `getPlans()` | プラン一覧を取得 |
| `clearCache()` | キャッシュをクリア |

### 使用量

| メソッド | 説明 |
|---------|------|
| `recordUsage(amount, type)` | 使用量を記録 |
| `incrementUsage(type)` | 使用量を+1 |
| `recordUsageBatch(records)` | バッチで記録 |

## 型定義

```typescript
interface PlatformConfig {
  productId: string;
  apiUrl: string;
  userPoolId?: string;
  clientId?: string;
}

interface AuthUser {
  userId: string;
  email: string;
  name?: string;
  tenantId?: string;
  accessToken: string;
  idToken: string;
}

interface Entitlement {
  id: string;
  userId: string;
  productId: string;
  planId: string;
  planName: string;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  features: Record<string, boolean | number | string>;
  limits: UsageLimits;
  currentUsage: CurrentUsage;
  expiresAt?: string;
}
```

## ドキュメント

- [統合ガイド（詳細）](../docs/integration-guide.md)
- [クイックスタート](../docs/QUICKSTART.md)
- [APIリファレンス](../docs/API_REFERENCE.md)

## ライセンス

MIT
