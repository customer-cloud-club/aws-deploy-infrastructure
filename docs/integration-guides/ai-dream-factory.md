# AI Dream Factory 統合ガイド

## 概要

既存のAI Dream Factoryを共通認証・課金基盤に統合するためのガイドです。

## 現状

- **ドメイン**: aidreams-factory.com
- **認証**: Cognito + Stripe 実装済み
- **フレームワーク**: Next.js

## 統合方法

環境変数の変更のみで統合可能です。

## 手順

### Step 1: 環境変数を変更

#### 開発環境 (`.env.development`)

```bash
# 変更前（既存設定）
COGNITO_USER_POOL_ID=ap-northeast-1_OLD_POOL
COGNITO_CLIENT_ID=old_client_id

# 変更後（共通基盤 - Dev環境）
COGNITO_USER_POOL_ID=ap-northeast-1_lSPtvbFS7
COGNITO_CLIENT_ID=<Dev用Client ID>
PRODUCT_ID=ai-dream-factory
PLATFORM_API_URL=https://cc-auth-dev.aidreams-factory.com
```

#### 本番環境 (`.env.production`)

```bash
# 共通基盤 - Prod環境
COGNITO_USER_POOL_ID=ap-northeast-1_z76s7mTve
COGNITO_CLIENT_ID=<Prod用Client ID>
PRODUCT_ID=ai-dream-factory
PLATFORM_API_URL=https://cc-auth.aidreams-factory.com
```

#### 環境別エンドポイント

| 環境 | API URL | Cognito User Pool |
|------|---------|-------------------|
| Dev | `https://cc-auth-dev.aidreams-factory.com` | `ap-northeast-1_lSPtvbFS7` |
| Prod | `https://cc-auth.aidreams-factory.com` | `ap-northeast-1_z76s7mTve` |

### Step 2: SDKインストール（オプション）

既存のCognito連携コードを使い続けることも可能ですが、
SDKを使用するとEntitlement管理が簡単になります。

```bash
npm install @aidreams/platform-sdk
```

### Step 3: Admin Consoleでプロダクト登録

1. https://admin.aidreams-factory.com にアクセス
2. プロダクト → 新規作成
3. 以下を入力:
   - プロダクトID: `ai-dream-factory`
   - プロダクト名: `AI Dream Factory`
   - ドメイン: `aidreams-factory.com`

### Step 4: プラン移行

既存Stripeプランを共通基盤に登録:

| 既存プラン | 共通基盤プランID | 価格 |
|-----------|-----------------|------|
| Free | ai-dream-factory-free | ¥0 |
| Pro | ai-dream-factory-pro | ¥1,980 |
| Business | ai-dream-factory-business | ¥9,800 |

### Step 5: 既存ユーザー移行

既存ユーザーは以下の方法で移行:

#### オプション1: 自動移行（推奨）

初回ログイン時に自動でアカウントリンク:

```typescript
// pages/api/auth/callback.ts
async function handleCallback(cognitoUser: CognitoUser) {
  // 既存DBでユーザー検索
  const existingUser = await db.user.findByEmail(cognitoUser.email);

  if (existingUser) {
    // 既存ユーザーを共通基盤にリンク
    await linkToCommonPlatform(existingUser, cognitoUser);
  }

  // 通常のログイン処理続行
}
```

#### オプション2: バッチ移行

既存ユーザーを一括でCognito User Poolに移行:

```bash
# AWS CLI で移行
aws cognito-idp admin-create-user \
  --user-pool-id ap-northeast-1_lSPtvbFS7 \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com \
  --message-action SUPPRESS
```

### Step 6: 動作確認

チェックリスト:

- [ ] ログインフロー動作確認
- [ ] プラン表示確認
- [ ] 決済フロー確認
- [ ] 既存ユーザーログイン確認
- [ ] Entitlement取得確認

## コード変更（SDK使用時）

### 認証チェック

```typescript
// Before
import { useAuth } from '@/hooks/useAuth';

// After
import { PlatformSDK } from '@aidreams/platform-sdk';

// 初期化
PlatformSDK.init({
  productId: 'ai-dream-factory',
  apiUrl: process.env.PLATFORM_API_URL!,
});
```

### 利用権チェック

```typescript
// Before
const { user } = useAuth();
const isPro = user?.subscription === 'pro';

// After
const entitlement = await PlatformSDK.getEntitlement();
const isPro = entitlement.planId === 'pro';
```

## トラブルシューティング

### ログインできない

1. Cognito User Pool IDが正しいか確認
2. Cognito App Client IDが正しいか確認
3. コールバックURLがCognitoに登録されているか確認

### Entitlementが取得できない

1. PRODUCT_IDが正しいか確認
2. Admin Consoleでプロダクトが登録されているか確認
3. JWTトークンが正しく送信されているか確認

## ロールバック手順

問題発生時は環境変数を元に戻すだけでロールバック可能:

```bash
COGNITO_USER_POOL_ID=ap-northeast-1_OLD_POOL
COGNITO_CLIENT_ID=old_client_id
```
