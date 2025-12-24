# Google OAuth 認証統合 仕様書

## 1. 概要

### 1.1 目的
既存のCognito認証基盤にGoogle OAuth認証を追加し、ユーザーがGoogleアカウントでログインできるようにする。

### 1.2 スコープ
- Google OAuth 2.0 によるソーシャルログイン機能の追加
- 既存のメール/パスワード認証との共存
- 管理画面（Admin Console）への適用

### 1.3 対象環境
- 開発環境（dev）
- 本番環境（prod）

---

## 2. アーキテクチャ

### 2.1 認証フロー

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   ユーザー   │────▶│  フロント   │────▶│  Cognito    │────▶│   Google    │
│             │     │  エンド     │     │  Hosted UI  │     │   OAuth     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                   │                   │
                           │                   │◀──────────────────┘
                           │                   │   認可コード
                           │◀──────────────────┘
                           │   トークン（ID/Access/Refresh）
                           ▼
                    ┌─────────────┐
                    │  Lambda     │
                    │  Triggers   │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Database   │
                    │  (users)    │
                    └─────────────┘
```

### 2.2 コンポーネント

| コンポーネント | 役割 | 変更の有無 |
|--------------|------|----------|
| Cognito User Pool | IdP管理、トークン発行 | 設定変更のみ |
| Cognito Identity Provider | Google連携 | 新規追加 |
| Pre-Signup Trigger | ユーザー検証 | 変更不要（自動確認済み） |
| Post-Confirmation Trigger | DB登録 | 変更不要 |
| Pre-Token Generation | カスタムクレーム追加 | 変更不要 |
| Frontend (Next.js) | ログインUI | Google ボタン追加 |

---

## 3. 技術仕様

### 3.1 Google Cloud Console 設定

#### OAuth 2.0 クライアント設定
- **アプリケーションタイプ**: ウェブアプリケーション
- **承認済みリダイレクトURI**:
  - Dev: `https://auth-billing-dev.auth.ap-northeast-1.amazoncognito.com/oauth2/idpresponse`
  - Prod: `https://auth-billing-prod.auth.ap-northeast-1.amazoncognito.com/oauth2/idpresponse`

#### 要求するスコープ
```
profile email openid
```

### 3.2 Cognito 設定

#### Identity Provider 設定
```hcl
# Terraform設定
enable_google_identity_provider = true
google_client_id               = "xxx.apps.googleusercontent.com"
google_client_secret           = "GOCSPX-xxx"
google_authorize_scopes        = "profile email openid"
google_attribute_mapping = {
  email    = "email"
  name     = "name"
  username = "sub"
}
```

#### App Client 設定
- **サポートするIDプロバイダー**: COGNITO, Google
- **許可されたOAuthフロー**: Authorization code grant
- **許可されたOAuthスコープ**: email, openid, profile

### 3.3 フロントエンド設定

#### Amplify OAuth 設定
```typescript
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
      loginWith: {
        oauth: {
          domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: [process.env.NEXT_PUBLIC_CALLBACK_URL],
          redirectSignOut: [process.env.NEXT_PUBLIC_LOGOUT_URL],
          responseType: 'code',
          providers: ['Google'],
        },
      },
    },
  },
});
```

#### 環境変数
```bash
# 追加が必要な環境変数
NEXT_PUBLIC_COGNITO_DOMAIN=auth-billing-{stage}.auth.ap-northeast-1.amazoncognito.com
NEXT_PUBLIC_CALLBACK_URL=https://{app-domain}/
NEXT_PUBLIC_LOGOUT_URL=https://{app-domain}/login
```

---

## 4. データフロー

### 4.1 新規ユーザー（Google初回ログイン）

1. ユーザーが「Googleでログイン」ボタンをクリック
2. Cognito Hosted UI にリダイレクト
3. Google認証画面にリダイレクト
4. ユーザーがGoogleで認証
5. Cognito に認可コードが返却
6. **Pre-Signup Trigger** が発火
   - `triggerSource: "PreSignUp_ExternalProvider"` で判定
   - 自動確認（autoConfirmUser: true）
7. Cognitoがユーザーを作成
8. **Post-Confirmation Trigger** が発火
   - `users` テーブルにレコード作成
   - デフォルトテナント割り当て
   - 無料プランのentitlement付与
9. **Pre-Token Generation Trigger** が発火
   - カスタムクレーム追加（tenant_id, plan_id）
10. トークンがフロントエンドに返却
11. ログイン完了

### 4.2 既存ユーザー（Googleログイン）

1. ユーザーが「Googleでログイン」ボタンをクリック
2. Cognito Hosted UI にリダイレクト
3. Google認証
4. Cognitoが既存ユーザーを検索（メールアドレスで照合）
5. **Pre-Token Generation Trigger** が発火
6. トークン返却
7. ログイン完了

---

## 5. セキュリティ考慮事項

### 5.1 アカウントリンク
- 同一メールアドレスの場合、既存Cognitoアカウントとリンク
- リンク方法: Cognito Admin API による手動リンク（将来実装）

### 5.2 認証情報の保護
- Google Client Secret は Terraform tfvars で管理
- Secret は git にコミットしない
- AWS Secrets Manager での管理を推奨

### 5.3 スコープ制限
- 必要最小限のスコープのみ要求（profile, email, openid）
- Googleドライブ等へのアクセスは不要

---

## 6. 実装手順

### Phase 1: インフラストラクチャ
1. Google Cloud Console でOAuthクライアント作成
2. Terraform変数にクレデンシャル追加
3. Terraform apply でCognito設定更新

### Phase 2: フロントエンド
1. 環境変数追加
2. Amplify OAuth設定追加
3. ログインページにGoogleボタン追加
4. OAuthコールバック処理確認

### Phase 3: テスト
1. 開発環境でE2Eテスト
2. 新規ユーザー登録フロー確認
3. 既存ユーザーログインフロー確認
4. 本番環境デプロイ

---

## 7. 影響範囲

### 7.1 変更が必要なファイル

| ファイル | 変更内容 |
|---------|---------|
| `terraform/envs/dev/main.tf` | Google OAuth有効化 |
| `terraform/envs/prod/main.tf` | Google OAuth有効化 |
| `terraform/envs/*/terraform.tfvars` | クレデンシャル追加 |
| `frontend/admin/src/lib/auth.ts` | OAuth設定追加 |
| `frontend/admin/src/app/login/page.tsx` | Googleボタン追加 |
| `frontend/admin/.env.local` | 環境変数追加 |

### 7.2 変更不要なファイル

- Lambda関数（全て対応済み）
- SDK（Cognito Hosted UI経由で動作）
- データベーススキーマ

---

## 8. ロールバック計画

Google OAuth を無効にする場合:

1. Terraform で `enable_google_identity_provider = false` に設定
2. `terraform apply` 実行
3. フロントエンドからGoogleボタンを削除（オプション）

既存のメール/パスワード認証には影響なし。

---

## 9. 運用考慮事項

### 9.1 モニタリング
- CloudWatch で認証エラーを監視
- Google OAuth 固有のエラーコードを確認

### 9.2 サポート
- 「Googleでログインできない」問い合わせへの対応手順を準備
- よくあるエラー（ポップアップブロック等）のFAQ作成

---

## 10. 参考リンク

- [AWS Cognito Identity Providers](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-provider.html)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [AWS Amplify Auth](https://docs.amplify.aws/lib/auth/social/q/platform/js/)
