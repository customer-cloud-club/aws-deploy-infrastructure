# クイックスタートガイド

**30分以内で共通認証・課金基盤に統合**

## 前提条件

- Node.js 18以上
- npm または yarn
- AWSアカウント（オプション）

## 3ステップで統合

### Step 1: SDKインストール（1分）

```bash
npm install @aidreams/platform-sdk
```

### Step 2: 環境変数設定（1分）

`.env.local`に以下を追加:

```bash
PRODUCT_ID=your-product-name
PLATFORM_API_URL=https://p8uhqklb43.execute-api.ap-northeast-1.amazonaws.com/development
```

### Step 3: SDKを初期化（5分）

```typescript
// lib/platform.ts
import { PlatformSDK } from '@aidreams/platform-sdk';

// アプリ起動時に1回だけ呼び出し
PlatformSDK.init({
  productId: process.env.PRODUCT_ID!,
  apiUrl: process.env.PLATFORM_API_URL!,
});

export { PlatformSDK };
```

## 基本的な使い方

### 認証チェック

```typescript
import { PlatformSDK } from '@/lib/platform';

// 認証必須ページで使用
export default async function ProtectedPage() {
  const user = await PlatformSDK.requireAuth();

  return <h1>Welcome, {user.email}</h1>;
}
```

### 利用権チェック

```typescript
const entitlement = await PlatformSDK.getEntitlement();

// Pro機能のアンロック
if (entitlement.features.pro_features) {
  // Pro機能を表示
}

// 使用制限チェック
const { allowed, remaining } = await PlatformSDK.checkLimit('generations');
if (!allowed) {
  return <UpgradeModal remaining={remaining} />;
}
```

### 使用量記録

```typescript
// AI生成後に使用量を記録
await generateImage(prompt);
await PlatformSDK.recordUsage(1, 'generation');
```

## Next.js App Router サンプル

### ミドルウェア（認証保護）

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('platform_token');

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*'],
};
```

### ログインページ

```typescript
// app/login/page.tsx
'use client';

import { PlatformSDK } from '@/lib/platform';

export default function LoginPage() {
  const handleLogin = async () => {
    await PlatformSDK.requireAuth(); // 自動でCognitoへリダイレクト
  };

  return (
    <button onClick={handleLogin}>
      ログイン
    </button>
  );
}
```

## 統合完了チェックリスト

- [ ] SDKインストール完了
- [ ] 環境変数設定完了
- [ ] SDK初期化完了
- [ ] Admin Consoleでプロダクト登録
- [ ] Admin Consoleでプラン作成
- [ ] 認証フロー動作確認
- [ ] 利用権チェック動作確認

## 次のステップ

- [SDK詳細ガイド](./SDK_GUIDE.md)
- [APIリファレンス](./API_REFERENCE.md)
- [認証フロー解説](./AUTH_FLOW.md)
- [課金フロー解説](./BILLING_FLOW.md)

## サポート

問題が発生した場合:
1. [FAQ](./FAQ.md)を確認
2. GitHubでIssueを作成
