# Platform SDK トラブルシューティング

よくある問題とその解決方法をまとめています。

## 目次

1. [インストール問題](#インストール問題)
2. [初期化エラー](#初期化エラー)
3. [認証問題](#認証問題)
4. [利用権取得エラー](#利用権取得エラー)
5. [使用量記録エラー](#使用量記録エラー)
6. [CORSエラー](#corsエラー)
7. [TypeScriptエラー](#typescriptエラー)
8. [Next.js特有の問題](#nextjs特有の問題)
9. [デバッグ方法](#デバッグ方法)

---

## インストール問題

### npm install が 401 エラーで失敗する

**症状:**
```
npm ERR! 401 Unauthorized
npm ERR! Unable to authenticate, need: Basic
```

**原因:** GitHub Packages の認証が設定されていない

**解決方法:**

1. `.npmrc` ファイルを作成:
```bash
# プロジェクトルートに .npmrc を作成
echo "@customer-cloud-club:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=\${GITHUB_TOKEN}" >> .npmrc
```

2. GitHub Personal Access Token を設定:
```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

3. トークンの権限を確認:
   - `read:packages` スコープが必要

---

### パッケージが見つからない

**症状:**
```
npm ERR! 404 Not Found - GET https://npm.pkg.github.com/@customer-cloud-club%2fplatform-sdk
```

**解決方法:**

1. パッケージ名が正しいか確認:
```bash
npm install @customer-cloud-club/platform-sdk
```

2. レジストリ設定を確認:
```bash
npm config get @customer-cloud-club:registry
# 期待値: https://npm.pkg.github.com
```

---

## 初期化エラー

### "productId and apiUrl are required"

**症状:**
```
Error: productId and apiUrl are required
```

**原因:** 必須パラメータが未設定

**解決方法:**

```typescript
// 環境変数を確認
console.log('productId:', process.env.NEXT_PUBLIC_PLATFORM_PRODUCT_ID);
console.log('apiUrl:', process.env.NEXT_PUBLIC_PLATFORM_API_URL);

// 正しく初期化
PlatformSDK.init({
  productId: process.env.NEXT_PUBLIC_PLATFORM_PRODUCT_ID!,  // 'prod_xxx'
  apiUrl: process.env.NEXT_PUBLIC_PLATFORM_API_URL!,        // 'https://api.example.com'
});
```

### "PlatformSDK not initialized"

**症状:** SDKメソッドを呼ぶと "PlatformSDK not initialized" エラー

**原因:** `init()` が呼ばれる前に他のメソッドを使用

**解決方法:**

```typescript
// Next.js App Router の場合
// app/providers.tsx
'use client';

import { useEffect } from 'react';
import { PlatformSDK } from '@customer-cloud-club/platform-sdk';

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // クライアントサイドでのみ初期化
    PlatformSDK.init({
      productId: process.env.NEXT_PUBLIC_PLATFORM_PRODUCT_ID!,
      apiUrl: process.env.NEXT_PUBLIC_PLATFORM_API_URL!,
    });
  }, []);

  return <>{children}</>;
}
```

---

## 認証問題

### ログインページにリダイレクトされない

**症状:** `requireAuth()` を呼んでも何も起こらない

**原因:** サーバーサイドで実行されている

**解決方法:**

```typescript
// クライアントコンポーネントで使用
'use client';

import { useEffect, useState } from 'react';

export default function ProtectedPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // useEffect内でrequireAuthを呼ぶ
    PlatformSDK.requireAuth()
      .then(setUser)
      .catch(console.error);
  }, []);

  if (!user) return <div>Loading...</div>;
  return <div>Welcome, {user.email}</div>;
}
```

---

### トークンが localStorage に保存されない

**症状:** リロードすると認証状態がリセットされる

**原因:** SSR環境で `localStorage` にアクセスしている

**解決方法:**

```typescript
// ブラウザ環境かチェック
if (typeof window !== 'undefined') {
  const user = await PlatformSDK.requireAuth();
}
```

---

### "Redirecting to login..." エラーがコンソールに出る

**症状:** 意図せずログインページにリダイレクトされる

**原因:** トークンの有効期限切れ、または localStorage が空

**解決方法:**

```typescript
// getAuthState で先にチェック
const authState = PlatformSDK.getAuthState();
if (!authState) {
  // 未認証状態を適切にハンドリング
  router.push('/login');
} else {
  // 認証済み
}
```

---

## 利用権取得エラー

### "Not authenticated" エラー

**症状:**
```
Error: Not authenticated
```

**原因:** 認証前に `getEntitlement()` を呼んでいる

**解決方法:**

```typescript
// 認証を先に行う
try {
  const user = await PlatformSDK.requireAuth();
  const entitlement = await PlatformSDK.getEntitlement();
} catch (error) {
  console.error('Error:', error);
}
```

---

### 利用権が見つからない (404)

**症状:**
```
PlatformError: Entitlement not found
code: 'ENTITLEMENT_NOT_FOUND'
statusCode: 404
```

**原因:**
- ユーザーにプランが割り当てられていない
- productId が間違っている

**解決方法:**

1. productId を確認:
```typescript
console.log('Using productId:', process.env.NEXT_PUBLIC_PLATFORM_PRODUCT_ID);
```

2. フリープランの自動割り当てを確認:
```typescript
try {
  const entitlement = await PlatformSDK.getEntitlement();
} catch (error) {
  if (error.code === 'ENTITLEMENT_NOT_FOUND') {
    // フリープランページへ誘導
    router.push('/plans');
  }
}
```

---

### キャッシュが古い

**症状:** プラン変更後も古い利用権が表示される

**解決方法:**

```typescript
// キャッシュをクリア
PlatformSDK.clearCache();

// または強制リフレッシュ
const entitlement = await PlatformSDK.getEntitlement(true);
```

---

## 使用量記録エラー

### "Failed to record usage" エラー

**症状:** 使用量記録が失敗する

**原因:**
- ネットワークエラー
- 認証切れ
- サーバーエラー

**解決方法:**

```typescript
async function safeRecordUsage(amount: number, type: string) {
  try {
    await PlatformSDK.recordUsage(amount, type);
  } catch (error) {
    // エラーをログに記録
    console.error('Usage recording failed:', error);

    // リトライロジック
    setTimeout(() => {
      PlatformSDK.recordUsage(amount, type).catch(console.error);
    }, 5000);
  }
}
```

---

### 使用量が反映されない

**症状:** `recordUsage()` 後に `getEntitlement()` で使用量が増えていない

**原因:** キャッシュされた利用権を参照している

**解決方法:**

```typescript
await PlatformSDK.recordUsage(1, 'generation');

// キャッシュは自動クリアされるが、念のため強制リフレッシュ
const entitlement = await PlatformSDK.getEntitlement(true);
console.log('Current usage:', entitlement.currentUsage);
```

---

## CORSエラー

### "Access-Control-Allow-Origin" エラー

**症状:**
```
Access to fetch at 'https://api.example.com' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**原因:** APIサーバーでCORSが正しく設定されていない

**解決方法:**

1. 開発環境では Next.js のリライト機能を使用:

```javascript
// next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/platform/:path*',
        destination: 'https://api.example.com/:path*',
      },
    ];
  },
};
```

2. SDK設定を変更:
```typescript
PlatformSDK.init({
  productId: 'prod_xxx',
  apiUrl: '/api/platform',  // リライトされたパス
});
```

---

## TypeScriptエラー

### 型定義が見つからない

**症状:**
```
Cannot find module '@customer-cloud-club/platform-sdk' or its corresponding type declarations
```

**解決方法:**

1. パッケージを再インストール:
```bash
rm -rf node_modules package-lock.json
npm install
```

2. TypeScript設定を確認:
```json
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "node"
  }
}
```

---

### 型推論エラー

**症状:**
```typescript
const entitlement = await PlatformSDK.getEntitlement();
// entitlement の型が any になる
```

**解決方法:**

```typescript
import { PlatformSDK, Entitlement } from '@customer-cloud-club/platform-sdk';

const entitlement: Entitlement = await PlatformSDK.getEntitlement();
```

---

## Next.js特有の問題

### Hydration エラー

**症状:**
```
Error: Hydration failed because the initial UI does not match what was rendered on the server
```

**原因:** サーバーとクライアントで認証状態が異なる

**解決方法:**

```typescript
'use client';

import { useEffect, useState } from 'react';

export function AuthStatus() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    setMounted(true);
    const authUser = PlatformSDK.getAuthState();
    setUser(authUser);
  }, []);

  // マウント前はローディング表示
  if (!mounted) return <div>Loading...</div>;

  return <div>{user ? `Hello, ${user.email}` : 'Not logged in'}</div>;
}
```

---

### App Router で window is not defined

**症状:**
```
ReferenceError: window is not defined
```

**原因:** サーバーコンポーネントで SDK を使用している

**解決方法:**

```typescript
// 1. 'use client' を追加
'use client';

// 2. dynamic import を使用
import dynamic from 'next/dynamic';

const ProtectedContent = dynamic(
  () => import('./ProtectedContent'),
  { ssr: false }
);
```

---

## デバッグ方法

### SDK の状態を確認

```typescript
// 初期化状態
console.log('Initialized:', PlatformSDK.isInitialized());

// 認証状態
const user = PlatformSDK.getAuthState();
console.log('User:', user);

// アクセストークン
const token = await PlatformSDK.getAccessToken();
console.log('Token:', token ? 'exists' : 'null');
```

### ネットワークリクエストの確認

ブラウザの開発者ツールでNetwork タブを開き:

1. リクエストURLが正しいか確認
2. Authorization ヘッダーが付いているか確認
3. レスポンスのステータスコードとボディを確認

### ローカルストレージの確認

```javascript
// ブラウザコンソールで実行
console.log('Access Token:', localStorage.getItem('platform_access_token'));
console.log('ID Token:', localStorage.getItem('platform_id_token'));
console.log('User:', localStorage.getItem('platform_user'));
```

### API直接呼び出しでテスト

```bash
# 利用権取得
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.example.com/entitlements?productId=prod_xxx"

# プラン一覧
curl "https://api.example.com/catalog/plans?productId=prod_xxx"
```

---

## サポート

問題が解決しない場合:

1. [GitHub Issues](https://github.com/customer-cloud-club/aws-deploy-infrastructure/issues) で検索
2. 新しいIssueを作成（再現手順、エラーメッセージ、環境情報を含める）

## 関連ドキュメント

- [クイックスタート](./quick-start.md)
- [統合ガイド](./integration-guide.md)
- [APIリファレンス](./api-reference.md)
