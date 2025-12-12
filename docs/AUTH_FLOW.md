# 認証フロー解説

## 概要

共通認証基盤はAmazon Cognitoを使用したOAuth 2.0 + OpenID Connect認証を提供します。

## 認証アーキテクチャ

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  CloudFront │────▶│   Lambda    │
│   (User)    │◀────│  + Function │◀────│   (API)     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   │ JWT検証
       ▼                   │
┌─────────────┐            │
│   Cognito   │◀───────────┘
│  User Pool  │
└─────────────┘
```

## 認証フロー詳細

### 1. ログインフロー

```
User → App → Cognito Hosted UI → 認証 → Callback → JWT発行 → App
```

1. ユーザーがログインボタンをクリック
2. Cognito Hosted UIへリダイレクト
3. メール/パスワードまたはソーシャルログインで認証
4. 認証成功後、Callbackエンドポイントへリダイレクト
5. 認可コードをトークンに交換
6. JWTトークン（Access Token, ID Token）を取得
7. トークンをCookieまたはlocalStorageに保存

### 2. API呼び出しフロー

```
App → CloudFront Function（JWT検証）→ API Gateway → Lambda
```

1. リクエストにAuthorizationヘッダーを付与
2. CloudFront FunctionでJWT形式を検証
3. 有効期限チェック
4. ユーザー情報をヘッダーに追加してオリジンへ転送
5. Lambdaで詳細な認可処理

## トークン構成

### Access Token

API呼び出しに使用するトークン

```json
{
  "sub": "user-123",
  "iss": "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xxx",
  "client_id": "xxx",
  "token_use": "access",
  "scope": "openid email profile",
  "exp": 1704153600,
  "iat": 1704150000
}
```

### ID Token

ユーザー情報を含むトークン

```json
{
  "sub": "user-123",
  "email": "user@example.com",
  "email_verified": true,
  "name": "山田 太郎",
  "custom:tenant_id": "tenant-001",
  "iss": "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xxx",
  "aud": "xxx",
  "exp": 1704153600,
  "iat": 1704150000
}
```

## CloudFront Function認証

CloudFront Functionは高速（1ms以下）でJWT検証を行います。

### 検証内容

1. **トークン形式チェック**: `header.payload.signature`の3パート構成
2. **有効期限チェック**: `exp`クレームが現在時刻より未来か
3. **ユーザー情報抽出**: `sub`, `email`をリクエストヘッダーに追加

### 認証不要パス

以下のパスは認証をスキップします:

- `/login`, `/register` - 認証ページ
- `/callback` - OAuthコールバック
- `/static/*` - 静的アセット
- `/_next/*` - Next.js内部
- `/api/public/*` - 公開API

## セキュリティ対策

### CSRF対策

- SameSite=Strict Cookieを使用
- カスタムヘッダー（`X-Requested-With`）チェック

### XSS対策

- httpOnly Cookieでトークンを保護
- Content Security Policyヘッダー

### トークン更新

- Access Token: 1時間で有効期限切れ
- Refresh Token: 30日間有効
- 自動更新ロジックをSDKが提供

## 実装例

### Next.js ミドルウェア

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('platform_access_token');

  // 保護対象パス
  const protectedPaths = ['/dashboard', '/settings', '/account'];
  const isProtected = protectedPaths.some(p =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (isProtected && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
```

### サーバーサイド認証

```typescript
// app/api/protected/route.ts
import { headers } from 'next/headers';
import { PlatformSDK } from '@/lib/platform';

export async function GET() {
  const headersList = headers();
  const token = headersList.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // トークン検証とユーザー情報取得
  PlatformSDK.setAuthTokens(token, token, { userId: '', email: '' });
  const entitlement = await PlatformSDK.getEntitlement();

  return Response.json({ entitlement });
}
```

## トラブルシューティング

### トークンが無効

1. 有効期限切れ → 再ログイン
2. 署名不正 → Cognito設定確認
3. クライアントID不一致 → 環境変数確認

### CORS エラー

CloudFrontのレスポンスヘッダーポリシーを確認:

```
Access-Control-Allow-Origin: https://your-domain.com
Access-Control-Allow-Credentials: true
```
