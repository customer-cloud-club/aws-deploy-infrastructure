# Lambda@Edge Auth Verifier

JWT認証を行うLambda@Edge関数です。CloudFront ViewerRequestイベントで実行されます。

## 機能

- CookieからJWTトークンを取得
- Cognito JWTトークンの検証
- 認証済みリクエストにユーザーコンテキストヘッダーを付与
- 未認証リクエストをログインページにリダイレクト

## 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `COGNITO_JWKS_URL` | Cognito JWKS URL | Yes |
| `COGNITO_ISSUER` | Cognito Issuer URL | Yes |
| `JWT_SECRET` | JWT検証用シークレット (開発用) | No |
| `LOGIN_URL` | ログインページURL | No (デフォルト: /login) |

## ビルド

```bash
npm install
npm run build
npm run package
```

## デプロイ

Terraformを使用してデプロイします:

```bash
cd ../../../terraform/modules/cloudfront
terraform init
terraform apply
```

## 付与されるヘッダー

認証成功時、以下のヘッダーが付与されます:

- `X-User-Id`: Cognito User ID (sub claim)
- `X-Tenant-Id`: テナントID (custom:tenant_id claim)

## 制限事項

Lambda@Edgeの制限により:
- 実行時間: 最大5秒
- パッケージサイズ: 最大50MB (圧縮後1MB)
- 環境変数: 使用不可 (代わりにSystems Manager Parameter Storeを使用)

## セキュリティ

- JWTトークンは常にHTTPS経由で送信される必要があります
- トークンはHttpOnly Cookieに保存されるべきです
- JWKS公開鍵のキャッシュを推奨 (パフォーマンス向上)
