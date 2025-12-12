# CloudFront Module with Lambda@Edge Authentication

このモジュールは、Lambda@Edge JWT認証機能を持つAmazon CloudFront Distributionを作成します。

## 機能

- CloudFront Distributionの作成と管理
- Lambda@Edge (us-east-1) によるJWT認証
- 未認証ユーザーのログインページへのリダイレクト
- 認証済みユーザーへのコンテキストヘッダー付与 (X-User-Id, X-Tenant-Id)
- Origin Access Identity (OAI) によるS3アクセス制御
- カスタムエラーページの設定
- WAF統合のサポート
- アクセスログの記録

## Lambda@Edge認証フロー

```
1. ユーザーリクエスト
   ↓
2. CloudFront (Lambda@Edge: ViewerRequest)
   ├─ Cookieからauth_token取得
   ├─ JWT検証 (Cognito公開鍵)
   ├─ 検証成功 → X-User-Id, X-Tenant-Idヘッダー付与
   └─ 検証失敗 → 302リダイレクト (/login)
   ↓
3. オリジン (ALB/S3)
```

## 使用例

### 基本的な使用方法

```hcl
module "cloudfront" {
  source = "./modules/cloudfront"

  name        = "my-app"
  environment = "prod"

  # Origins
  origins = [
    {
      domain_name = "my-alb-123456789.ap-northeast-1.elb.amazonaws.com"
      origin_id   = "alb"
      custom_origin_config = {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  ]

  default_origin_id = "alb"

  # Lambda@Edge Authentication
  enable_auth          = true
  cognito_user_pool_id = "ap-northeast-1_XXXXXXXXX"
  cognito_region       = "ap-northeast-1"
  login_url            = "/login"

  # SSL/TLS
  acm_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/xxxxx"
  aliases             = ["app.example.com"]

  # WAF
  web_acl_id = "arn:aws:wafv2:us-east-1:123456789012:global/webacl/xxxxx"

  # Logging
  enable_logging = true
  log_bucket     = "my-logs-bucket.s3.amazonaws.com"
  log_prefix     = "cloudfront/"

  tags = {
    Project = "MyApp"
    Owner   = "Platform Team"
  }
}

# Lambda@Edge requires us-east-1 provider
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
```

### S3オリジンの例

```hcl
module "cloudfront" {
  source = "./modules/cloudfront"

  name        = "static-site"
  environment = "prod"

  create_oai = true

  origins = [
    {
      domain_name = "my-bucket.s3.amazonaws.com"
      origin_id   = "s3"
      s3_origin_config = {
        origin_access_identity = module.cloudfront.origin_access_identity_path
      }
    }
  ]

  default_origin_id = "s3"

  # Cache settings for static content
  default_min_ttl = 0
  default_ttl     = 86400    # 1 day
  default_max_ttl = 31536000 # 1 year

  compress = true

  enable_auth = false # Static site without auth
}
```

### 複数オリジンとパスベースルーティング

```hcl
module "cloudfront" {
  source = "./modules/cloudfront"

  name        = "multi-origin"
  environment = "prod"

  origins = [
    {
      domain_name = "api.example.com"
      origin_id   = "api"
      custom_origin_config = {
        origin_protocol_policy = "https-only"
      }
    },
    {
      domain_name = "static.s3.amazonaws.com"
      origin_id   = "static"
      s3_origin_config = {
        origin_access_identity = module.cloudfront.origin_access_identity_path
      }
    }
  ]

  default_origin_id = "static"

  ordered_cache_behaviors = [
    {
      path_pattern     = "/api/*"
      target_origin_id = "api"
      allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods   = ["GET", "HEAD"]
      forward_cookies  = "all"
      forward_headers  = ["Authorization", "Host"]
      min_ttl          = 0
      default_ttl      = 0
      max_ttl          = 0
    }
  ]

  enable_auth = true
}
```

## 必須入力変数

| 変数名 | 説明 | 型 |
|--------|------|-----|
| `name` | CloudFront Distributionの名前 | `string` |
| `environment` | 環境名 (dev, staging, prod) | `string` |
| `origins` | オリジン設定のリスト | `list(object)` |
| `default_origin_id` | デフォルトキャッシュ動作のオリジンID | `string` |

## オプション入力変数

詳細は [variables.tf](./variables.tf) を参照してください。

## 出力

| 出力名 | 説明 |
|--------|------|
| `distribution_id` | CloudFront Distribution ID |
| `distribution_domain_name` | CloudFront ドメイン名 |
| `cloudfront_url` | CloudFront URL (https://) |
| `lambda_function_arn` | Lambda@Edge関数のARN |

詳細は [outputs.tf](./outputs.tf) を参照してください。

## Lambda@Edge関数のデプロイ

Lambda@Edge関数は自動的にビルドされパッケージ化されます。手動でビルドする場合:

```bash
cd ../../../lambda/functions/edge/auth-verifier
npm install
npm run build
npm run package
```

## 注意事項

### Lambda@Edge制限

- **リージョン**: Lambda@Edge関数は必ずus-east-1リージョンに作成する必要があります
- **実行時間**: 最大5秒 (ViewerRequestイベント)
- **メモリ**: 128MB - 10,240MB
- **パッケージサイズ**: 最大50MB (解凍後)、1MB (圧縮後)
- **環境変数**: 使用不可 (代わりにSystems Manager Parameter Storeを使用)
- **バージョン**: publishedバージョンのみ使用可能

### CloudFront制約

- **証明書**: ACM証明書はus-east-1リージョンに作成する必要があります
- **デプロイ時間**: CloudFront Distributionの更新には15-20分かかる場合があります
- **削除保護**: Distributionを削除するには、まず無効化する必要があります

### セキュリティ

- JWTトークンは必ずHTTPSで送信してください
- `jwt_secret`変数は開発用のみです。本番環境ではCognito JWKS公開鍵を使用してください
- Origin Access Identity (OAI) を使用してS3バケットへの直接アクセスを制限してください

## トラブルシューティング

### Lambda@Edge関数が実行されない

1. 関数がpublishedバージョンであることを確認
2. 関数がus-east-1リージョンにあることを確認
3. CloudFrontの配信が完了するまで待機 (15-20分)

### JWT検証エラー

1. Cognito User Pool IDが正しいことを確認
2. JWKS URLが正しいことを確認
3. トークンの有効期限を確認
4. CloudWatch Logsでエラー詳細を確認

### パフォーマンス問題

1. TTL設定を確認 (キャッシュ可能なコンテンツは長めに設定)
2. 圧縮を有効化 (`compress = true`)
3. Price Classを最適化 (PriceClass_100はコスト削減)

## 関連ドキュメント

- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [Lambda@Edge Documentation](https://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html)
- [Cognito JWT Token Verification](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html)

## ライセンス

MIT License
