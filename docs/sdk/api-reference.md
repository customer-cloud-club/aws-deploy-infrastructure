# Platform SDK API リファレンス

このドキュメントでは、Platform SDKの全APIを詳しく説明します。

## 目次

1. [初期化](#初期化)
2. [認証 API](#認証-api)
3. [利用権 API](#利用権-api)
4. [使用量 API](#使用量-api)
5. [型定義](#型定義)
6. [エラー処理](#エラー処理)

---

## 初期化

### `PlatformSDK.init(config)`

SDKを初期化します。他のメソッドを使用する前に必ず呼び出してください。

**パラメータ:**

| 名前 | 型 | 必須 | 説明 |
|------|-----|------|------|
| `config.productId` | `string` | ✅ | プロダクトID |
| `config.apiUrl` | `string` | ✅ | Platform API URL |
| `config.userPoolId` | `string` | - | Cognito User Pool ID |
| `config.clientId` | `string` | - | Cognito Client ID |

**例:**

```typescript
import { PlatformSDK } from '@customer-cloud-club/platform-sdk';

PlatformSDK.init({
  productId: 'prod_abc123',
  apiUrl: 'https://api.example.com',
  userPoolId: 'ap-northeast-1_XXXXXXX',
  clientId: 'xxxxxxxxxxxxxxxxxx',
});
```

**例外:**

- `Error` - `productId` または `apiUrl` が未指定の場合

---

### `PlatformSDK.isInitialized()`

SDKが初期化済みかどうかを返します。

**戻り値:** `boolean`

```typescript
if (!PlatformSDK.isInitialized()) {
  PlatformSDK.init({ ... });
}
```

---

## 認証 API

### `PlatformSDK.requireAuth()`

認証を必須とし、未認証の場合はログインページにリダイレクトします。

**戻り値:** `Promise<AuthUser>`

**例:**

```typescript
try {
  const user = await PlatformSDK.requireAuth();
  console.log(`ようこそ、${user.email}さん`);
  console.log(`User ID: ${user.userId}`);
} catch (error) {
  // リダイレクト中、またはサーバーサイドエラー
}
```

**動作:**

- **ブラウザ環境**: localStorageからトークンを取得。未認証の場合はログインページへリダイレクト
- **サーバー環境**: `setAuthTokens()` が事前に呼ばれていない場合はエラー

---

### `PlatformSDK.getAuthState()`

現在の認証状態を取得します（リダイレクトなし）。

**戻り値:** `AuthUser | null`

```typescript
const user = PlatformSDK.getAuthState();
if (user) {
  console.log('ログイン済み:', user.email);
} else {
  console.log('未ログイン');
}
```

---

### `PlatformSDK.getAccessToken()`

現在のアクセストークンを取得します。

**戻り値:** `Promise<string | null>`

```typescript
const token = await PlatformSDK.getAccessToken();
if (token) {
  const response = await fetch('/api/protected', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}
```

---

### `PlatformSDK.setAuthTokens(accessToken, idToken, user)`

認証トークンを手動で設定します。サーバーサイドでの使用を想定。

**パラメータ:**

| 名前 | 型 | 説明 |
|------|-----|------|
| `accessToken` | `string` | アクセストークン |
| `idToken` | `string` | IDトークン |
| `user` | `Omit<AuthUser, 'accessToken' \| 'idToken'>` | ユーザー情報 |

```typescript
// サーバーサイド (API Route など)
PlatformSDK.setAuthTokens(
  req.headers.authorization?.replace('Bearer ', '') || '',
  req.headers['x-id-token'] || '',
  { userId: 'user_123', email: 'user@example.com' }
);
```

---

### `PlatformSDK.handleAuthCallback(code)`

OAuth認証コールバックを処理します。

**パラメータ:**

| 名前 | 型 | 説明 |
|------|-----|------|
| `code` | `string` | 認証コード |

**戻り値:** `Promise<AuthUser>`

```typescript
// /api/auth/callback
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const user = await PlatformSDK.handleAuthCallback(code);
    return redirect('/dashboard');
  }
  return redirect('/login?error=no_code');
}
```

---

### `PlatformSDK.logout()`

ログアウト処理を行います。

**戻り値:** `Promise<void>`

```typescript
async function handleLogout() {
  await PlatformSDK.logout();
  window.location.href = '/';
}
```

---

## 利用権 API

### `PlatformSDK.getEntitlement(forceRefresh?)`

ユーザーの利用権情報を取得します。

**パラメータ:**

| 名前 | 型 | デフォルト | 説明 |
|------|-----|---------|------|
| `forceRefresh` | `boolean` | `false` | キャッシュを無視して最新を取得 |

**戻り値:** `Promise<Entitlement>`

**キャッシュ:** 60秒間キャッシュされます

```typescript
const entitlement = await PlatformSDK.getEntitlement();

console.log('プラン:', entitlement.planName);
console.log('ステータス:', entitlement.status);
console.log('機能:', entitlement.features);
console.log('使用制限:', entitlement.limits);
console.log('現在の使用量:', entitlement.currentUsage);

// 最新情報を強制取得
const freshEntitlement = await PlatformSDK.getEntitlement(true);
```

---

### `PlatformSDK.hasFeature(featureName)`

特定の機能が有効かどうかを確認します。

**パラメータ:**

| 名前 | 型 | 説明 |
|------|-----|------|
| `featureName` | `string` | 機能名 |

**戻り値:** `Promise<boolean>`

```typescript
// 機能の有効/無効をチェック
if (await PlatformSDK.hasFeature('high_resolution')) {
  showHighResOption();
}

if (await PlatformSDK.hasFeature('ai_generation')) {
  enableAIFeatures();
}

if (await PlatformSDK.hasFeature('priority_support')) {
  showSupportChat();
}
```

---

### `PlatformSDK.checkLimit(limitType)`

使用制限内かどうかを確認します。

**パラメータ:**

| 名前 | 型 | 説明 |
|------|-----|------|
| `limitType` | `string` | 制限タイプ (`apiCalls`, `generations`, `storage` など) |

**戻り値:** `Promise<{ allowed: boolean; remaining: number }>`

```typescript
// API呼び出し制限をチェック
const { allowed, remaining } = await PlatformSDK.checkLimit('apiCalls');

if (!allowed) {
  showUpgradeModal('API呼び出し制限に達しました');
  return;
}

console.log(`残り ${remaining} 回`);

// 生成数制限をチェック
const genLimit = await PlatformSDK.checkLimit('generations');
if (genLimit.remaining < 5) {
  showWarning('生成可能回数が残りわずかです');
}
```

**特殊な戻り値:**

- `remaining: Infinity` - 制限なし（unlimited）の場合

---

### `PlatformSDK.getPlans()`

利用可能なプラン一覧を取得します。

**戻り値:** `Promise<Plan[]>`

```typescript
const plans = await PlatformSDK.getPlans();

plans.forEach(plan => {
  console.log(`${plan.name}: ¥${plan.price.toLocaleString()}/${plan.billingCycle}`);
  console.log('  機能:', Object.keys(plan.features).join(', '));
  console.log('  制限:', plan.limits);
});
```

---

### `PlatformSDK.clearCache()`

利用権のキャッシュをクリアします。

**戻り値:** `void`

```typescript
// プラン変更後などにキャッシュをクリア
await handlePlanUpgrade();
PlatformSDK.clearCache();

// 最新の利用権を取得
const entitlement = await PlatformSDK.getEntitlement();
```

---

## 使用量 API

### `PlatformSDK.recordUsage(amount, type, metadata?)`

使用量を記録します。

**パラメータ:**

| 名前 | 型 | デフォルト | 説明 |
|------|-----|---------|------|
| `amount` | `number` | - | 使用量 |
| `type` | `string` | `'api_call'` | 使用タイプ |
| `metadata` | `Record<string, unknown>` | - | 追加メタデータ |

**戻り値:** `Promise<void>`

```typescript
// 基本的な使用量記録
await PlatformSDK.recordUsage(1, 'generation');

// メタデータ付き
await PlatformSDK.recordUsage(100, 'tokens', {
  model: 'gpt-4',
  requestId: 'req_abc123',
});

// ストレージ使用量
await PlatformSDK.recordUsage(5.5, 'storage', {
  fileId: 'file_xyz',
  fileType: 'image',
});
```

**副作用:** 記録後、利用権キャッシュが自動的にクリアされます

---

### `PlatformSDK.recordUsageBatch(records)`

複数の使用量を一括で記録します。

**パラメータ:**

| 名前 | 型 | 説明 |
|------|-----|------|
| `records` | `UsageRecord[]` | 使用記録の配列 |

**戻り値:** `Promise<void>`

```typescript
await PlatformSDK.recordUsageBatch([
  { type: 'generation', amount: 1 },
  { type: 'tokens', amount: 1500, metadata: { model: 'gpt-4' } },
  { type: 'api_call', amount: 3 },
]);
```

---

### `PlatformSDK.incrementUsage(type?)`

使用量を1増加させます。`recordUsage(1, type)` のショートハンドです。

**パラメータ:**

| 名前 | 型 | デフォルト | 説明 |
|------|-----|---------|------|
| `type` | `string` | `'api_call'` | 使用タイプ |

**戻り値:** `Promise<void>`

```typescript
// API呼び出しをカウント
await PlatformSDK.incrementUsage('api_call');

// 生成をカウント
await PlatformSDK.incrementUsage('generation');
```

---

## 型定義

### `PlatformConfig`

```typescript
interface PlatformConfig {
  /** プロダクトID */
  productId: string;
  /** Platform API URL */
  apiUrl: string;
  /** Cognito User Pool ID (オプション) */
  userPoolId?: string;
  /** Cognito Client ID (オプション) */
  clientId?: string;
}
```

### `AuthUser`

```typescript
interface AuthUser {
  /** ユーザーID (Cognito sub) */
  userId: string;
  /** メールアドレス */
  email: string;
  /** 表示名 */
  name?: string;
  /** テナントID */
  tenantId?: string;
  /** アクセストークン (JWT) */
  accessToken: string;
  /** IDトークン (JWT) */
  idToken: string;
}
```

### `Entitlement`

```typescript
interface Entitlement {
  /** 利用権ID */
  id: string;
  /** ユーザーID */
  userId: string;
  /** プロダクトID */
  productId: string;
  /** プランID */
  planId: string;
  /** プラン名 */
  planName: string;
  /** ステータス */
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  /** 機能フラグ */
  features: Record<string, boolean | number | string>;
  /** 使用制限 */
  limits: UsageLimits;
  /** 現在の使用量 */
  currentUsage: CurrentUsage;
  /** 有効期限 */
  expiresAt?: string;
}
```

### `UsageLimits`

```typescript
interface UsageLimits {
  /** API呼び出し数/月 */
  apiCalls?: number;
  /** ストレージ容量(MB) */
  storage?: number;
  /** 生成数/月 */
  generations?: number;
  /** カスタム制限 */
  [key: string]: number | undefined;
}
```

### `CurrentUsage`

```typescript
interface CurrentUsage {
  /** API呼び出し数 */
  apiCalls: number;
  /** ストレージ使用量(MB) */
  storage: number;
  /** 生成数 */
  generations: number;
  /** リセット日時 (ISO 8601) */
  resetAt: string;
}
```

### `UsageRecord`

```typescript
interface UsageRecord {
  /** 使用タイプ */
  type: 'api_call' | 'generation' | 'storage' | string;
  /** 使用量 */
  amount: number;
  /** メタデータ */
  metadata?: Record<string, unknown>;
}
```

### `Plan`

```typescript
interface Plan {
  /** プランID */
  id: string;
  /** プラン名 */
  name: string;
  /** 説明 */
  description?: string;
  /** 価格(円) */
  price: number;
  /** 課金サイクル */
  billingCycle: 'monthly' | 'yearly' | 'one_time';
  /** 機能フラグ */
  features: Record<string, boolean | number | string>;
  /** 使用制限 */
  limits: UsageLimits;
}
```

### `PlatformError`

```typescript
class PlatformError extends Error {
  /** エラーコード */
  code: string;
  /** HTTPステータスコード */
  statusCode: number;
  /** 追加詳細 */
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: Record<string, unknown>
  );
}
```

---

## エラー処理

### エラーコード一覧

| コード | ステータス | 説明 |
|--------|----------|------|
| `NOT_INITIALIZED` | - | SDKが初期化されていない |
| `NOT_AUTHENTICATED` | 401 | 認証されていない |
| `UNAUTHORIZED` | 403 | アクセス権限がない |
| `ENTITLEMENT_NOT_FOUND` | 404 | 利用権が見つからない |
| `LIMIT_EXCEEDED` | 429 | 使用制限を超過 |
| `NETWORK_ERROR` | - | ネットワークエラー |
| `API_ERROR` | 500 | APIエラー |

### エラーハンドリング例

```typescript
import { PlatformSDK, PlatformError } from '@customer-cloud-club/platform-sdk';

try {
  const entitlement = await PlatformSDK.getEntitlement();
} catch (error) {
  if (error instanceof PlatformError) {
    switch (error.code) {
      case 'NOT_AUTHENTICATED':
        redirectToLogin();
        break;
      case 'ENTITLEMENT_NOT_FOUND':
        showNoPlanMessage();
        break;
      case 'LIMIT_EXCEEDED':
        showUpgradeModal();
        break;
      default:
        showGenericError(error.message);
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### React用エラーバウンダリ

```typescript
import { Component, ReactNode } from 'react';
import { PlatformError } from '@customer-cloud-club/platform-sdk';

interface Props {
  children: ReactNode;
  fallback: (error: Error) => ReactNode;
}

interface State {
  error: Error | null;
}

class PlatformErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}

// 使用例
<PlatformErrorBoundary
  fallback={(error) => (
    <div>
      <h2>エラーが発生しました</h2>
      <p>{error.message}</p>
    </div>
  )}
>
  <Dashboard />
</PlatformErrorBoundary>
```

---

## 関連ドキュメント

- [クイックスタート](./quick-start.md) - 5分で始める
- [統合ガイド](./integration-guide.md) - フレームワーク別の詳細な統合方法
- [トラブルシューティング](./troubleshooting.md) - よくある問題と解決方法
