# MunchCoach 統合ガイド

## 概要

既存のMunchCoachを共通認証・課金基盤に統合するためのガイドです。

## 現状

- **ドメイン**: munchcoach.com
- **認証**: Firebase Auth
- **課金**: Stripe
- **フレームワーク**: Next.js + React Native

## 統合方法

Firebase AuthからCognitoへの移行が必要です。

## 手順

### Step 1: 環境変数を追加

#### 開発環境 (`.env.development`)

```bash
# 共通基盤設定（Dev環境）
COGNITO_USER_POOL_ID=ap-northeast-1_lSPtvbFS7
COGNITO_CLIENT_ID=<Dev用Client ID>
PRODUCT_ID=munchcoach
PLATFORM_API_URL=https://cc-auth-dev.aidreams-factory.com

# Firebase設定は移行期間中維持
FIREBASE_API_KEY=xxx
```

#### 本番環境 (`.env.production`)

```bash
# 共通基盤設定（Prod環境）
COGNITO_USER_POOL_ID=ap-northeast-1_z76s7mTve
COGNITO_CLIENT_ID=<Prod用Client ID>
PRODUCT_ID=munchcoach
PLATFORM_API_URL=https://cc-auth.aidreams-factory.com

# Firebase設定は移行期間中維持
FIREBASE_API_KEY=xxx
```

#### 環境別エンドポイント

| 環境 | API URL | Cognito User Pool |
|------|---------|-------------------|
| Dev | `https://cc-auth-dev.aidreams-factory.com` | `ap-northeast-1_lSPtvbFS7` |
| Prod | `https://cc-auth.aidreams-factory.com` | `ap-northeast-1_z76s7mTve` |

### Step 2: SDKインストール

```bash
npm install @aidreams/platform-sdk amazon-cognito-identity-js
```

### Step 3: Admin Consoleでプロダクト登録

1. https://admin.aidreams-factory.com にアクセス
2. プロダクト → 新規作成
3. 以下を入力:
   - プロダクトID: `munchcoach`
   - プロダクト名: `MunchCoach`
   - ドメイン: `munchcoach.com`

### Step 4: 認証コード移行

#### Before (Firebase)

```typescript
import { signInWithEmailAndPassword } from 'firebase/auth';

async function login(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}
```

#### After (Cognito + Platform SDK)

```typescript
import { PlatformSDK } from '@aidreams/platform-sdk';

// 初期化
PlatformSDK.init({
  productId: 'munchcoach',
  apiUrl: process.env.PLATFORM_API_URL!,
});

async function login() {
  // Cognito Hosted UIへリダイレクト
  const user = await PlatformSDK.requireAuth();
  return user;
}
```

### Step 5: React Native対応

React Native用の認証フロー:

```typescript
// App.tsx
import { Linking } from 'react-native';
import { PlatformSDK } from '@aidreams/platform-sdk';

// 開発環境
PlatformSDK.init({
  productId: 'munchcoach',
  apiUrl: 'https://cc-auth-dev.aidreams-factory.com',
});

// 本番環境の場合
// PlatformSDK.init({
//   productId: 'munchcoach',
//   apiUrl: 'https://cc-auth.aidreams-factory.com',
// });

// ディープリンクハンドラー
Linking.addEventListener('url', async (event) => {
  if (event.url.includes('callback')) {
    const code = extractCodeFromUrl(event.url);
    await PlatformSDK.handleAuthCallback(code);
  }
});
```

### Step 6: ユーザー移行

Firebase → Cognito へのユーザー移行:

#### 移行スクリプト

```typescript
// scripts/migrate-users.ts
import admin from 'firebase-admin';
import AWS from 'aws-sdk';

const cognito = new AWS.CognitoIdentityServiceProvider();

async function migrateUsers() {
  // Firebaseからユーザー取得
  const users = await admin.auth().listUsers();

  for (const user of users.users) {
    // Cognitoにユーザー作成
    await cognito.adminCreateUser({
      UserPoolId: 'ap-northeast-1_lSPtvbFS7',
      Username: user.email!,
      UserAttributes: [
        { Name: 'email', Value: user.email! },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'custom:firebase_uid', Value: user.uid },
      ],
      MessageAction: 'SUPPRESS', // ウェルカムメールを抑制
    }).promise();

    console.log(`Migrated: ${user.email}`);
  }
}

migrateUsers();
```

### Step 7: プラン移行

既存Stripeサブスクリプションを共通基盤に登録:

| 既存プラン | 共通基盤プランID | 価格 |
|-----------|-----------------|------|
| Free | munchcoach-free | ¥0 |
| Premium | munchcoach-premium | ¥980 |

### Step 8: 段階的移行（推奨）

1. **Week 1**: 新規ユーザーのみ共通基盤で登録
2. **Week 2**: 既存ユーザーにパスワードリセットメール送信
3. **Week 3**: Firebase認証を完全無効化

## 動作確認チェックリスト

- [ ] Web: ログインフロー確認
- [ ] Web: プラン表示確認
- [ ] Web: 決済フロー確認
- [ ] Mobile: ログインフロー確認
- [ ] Mobile: ディープリンク確認
- [ ] 既存ユーザー移行確認
- [ ] Entitlement取得確認

## トラブルシューティング

### Firebase UIDとの紐付け

移行後も既存データとの紐付けが必要な場合:

```typescript
// カスタム属性でFirebase UIDを保持
const user = await PlatformSDK.requireAuth();
const firebaseUid = user.customAttributes?.['custom:firebase_uid'];

// 既存DBからデータ取得
const userData = await db.findByFirebaseUid(firebaseUid);
```

### React Nativeでのトークン保存

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// トークン保存
await AsyncStorage.setItem('platform_access_token', token);

// トークン取得
const token = await AsyncStorage.getItem('platform_access_token');
```

## ロールバック手順

1. 環境変数からCognito設定を削除
2. Firebase Auth設定を復元
3. アプリを再デプロイ

```bash
# Firebase設定のみに戻す
FIREBASE_API_KEY=xxx
# COGNITO_USER_POOL_ID=...  # コメントアウト
```
