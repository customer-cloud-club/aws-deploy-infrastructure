# API Gateway Terraform Module

共通認証・課金基盤のAPI Gateway REST APIを構成するTerraformモジュールです。

## 機能

- REST API Gateway (HTTP APIではなくREST API)
- Cognito User Pools認証統合
- Stripe Webhook署名検証サポート
- Lambda統合 (AWS_PROXY)
- Usage Plan (レート制限・クォータ管理)
- CORS設定
- CloudWatch Logs統合
- X-Rayトレーシング
- カスタムドメイン対応
- WAF統合対応

## API構成

| パス | メソッド | 認証 | 説明 |
|------|---------|------|------|
| `/auth/*` | POST | なし | 認証エンドポイント |
| `/me/entitlements` | GET | Cognito | エンタイトルメント取得 |
| `/me/usage` | POST | Cognito | 使用量記録 |
| `/checkout` | POST | Cognito | チェックアウト |
| `/subscriptions/*` | ANY | Cognito | サブスクリプション管理 |
| `/webhooks/stripe` | POST | Stripe署名 | Stripe Webhook受信 |
| `/admin/*` | ANY | Cognito+Admin | 管理者API |
| `/catalog/*` | GET | なし | カタログ参照 |

## Usage Plan

| プラン | レート制限 | バーストリミット | 月間クォータ |
|--------|-----------|----------------|-------------|
| Standard | 1000 req/sec | 2000 req | 100,000 req/month |
| Premium | 5000 req/sec | 10,000 req | 1,000,000 req/month |

## 使用方法

```hcl
module "api_gateway" {
  source = "./modules/api-gateway"

  project_name = "miyabi-auth-billing"
  environment  = "production"

  # Cognito設定
  cognito_user_pool_arn = module.cognito.user_pool_arn

  # Lambda統合
  lambda_function_arns = {
    auth            = module.lambda.function_arns["auth"]
    me_entitlements = module.lambda.function_arns["me_entitlements"]
    me_usage        = module.lambda.function_arns["me_usage"]
    checkout        = module.lambda.function_arns["checkout"]
    subscriptions   = module.lambda.function_arns["subscriptions"]
    stripe_webhook  = module.lambda.function_arns["stripe_webhook"]
    admin           = module.lambda.function_arns["admin"]
    catalog         = module.lambda.function_arns["catalog"]
  }

  lambda_function_names = {
    auth            = module.lambda.function_names["auth"]
    me_entitlements = module.lambda.function_names["me_entitlements"]
    me_usage        = module.lambda.function_names["me_usage"]
    checkout        = module.lambda.function_names["checkout"]
    subscriptions   = module.lambda.function_names["subscriptions"]
    stripe_webhook  = module.lambda.function_names["stripe_webhook"]
    admin           = module.lambda.function_names["admin"]
    catalog         = module.lambda.function_names["catalog"]
  }

  # ログ設定
  log_retention_days = 30
  api_logging_level  = "INFO"
  enable_xray_tracing = true

  # Usage Plan設定
  usage_plans = {
    standard = {
      description      = "Standard Plan - 1000 req/sec, 100000 req/month"
      throttle_burst   = 2000
      throttle_rate    = 1000
      quota_limit      = 100000
      quota_period     = "MONTH"
      api_stages       = []
    }
    premium = {
      description      = "Premium Plan - 5000 req/sec, 1000000 req/month"
      throttle_burst   = 10000
      throttle_rate    = 5000
      quota_limit      = 1000000
      quota_period     = "MONTH"
      api_stages       = []
    }
  }

  # カスタムドメイン (オプション)
  custom_domain_name = "api.example.com"
  certificate_arn    = aws_acm_certificate.api.arn
  route53_zone_id    = aws_route53_zone.main.zone_id

  # WAF (オプション)
  enable_waf      = true
  waf_web_acl_arn = module.waf.web_acl_arn

  tags = {
    Project     = "miyabi-auth-billing"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
```

## Outputs

- `api_id` - REST API ID
- `api_endpoint` - API Gateway エンドポイントURL
- `stage_name` - デプロイステージ名
- `cognito_authorizer_id` - Cognito AuthorizerのID
- `usage_plan_ids` - Usage Plan IDマップ
- `api_key_values` - API Key値マップ (機密情報)
- `endpoints` - APIエンドポイント一覧

## 監視

以下のCloudWatchアラームが自動作成されます:

- **quota_exceeded** - Usage Planクォータ90%超過
- **client_errors** - 4XXエラー高頻度検出 (100件/5分)
- **server_errors** - 5XXエラー高頻度検出 (10件/1分)
- **latency** - レイテンシ高遅延検出 (平均3秒超過)

## セキュリティ

### 認証方式

1. **Cognito User Pools** - `/me/*`, `/checkout`, `/subscriptions/*`, `/admin/*`
2. **Stripe署名検証** - `/webhooks/stripe` (Lambda側で検証)
3. **認証不要** - `/auth/*`, `/catalog/*`

### Admin権限

`/admin/*` エンドポイントは、Cognito認証に加えてAdmin権限チェックが必要です。
権限チェックはLambda関数内で実装してください。

```typescript
// Lambda側でのAdmin権限チェック例
const claims = event.requestContext.authorizer.claims;
const groups = claims['cognito:groups'] || [];

if (!groups.includes('Admins')) {
  return {
    statusCode: 403,
    body: JSON.stringify({ error: 'Forbidden: Admin access required' }),
  };
}
```

## CORS設定

全エンドポイントでCORSが有効化されています。

- **Allow-Origin**: `*` (本番環境では制限推奨)
- **Allow-Methods**: `GET, POST, PUT, DELETE, OPTIONS`
- **Allow-Headers**: `Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token`

## カスタムドメイン

カスタムドメインを使用する場合:

1. ACM証明書を作成 (同一リージョン)
2. Route 53でドメイン管理
3. 変数 `custom_domain_name`, `certificate_arn`, `route53_zone_id` を設定

```hcl
custom_domain_name = "api.example.com"
certificate_arn    = "arn:aws:acm:ap-northeast-1:123456789012:certificate/xxx"
route53_zone_id    = "Z1234567890ABC"
```

## コスト最適化

- **ログ保持期間**: デフォルト30日 (`log_retention_days`)
- **X-Rayトレーシング**: 本番環境のみ有効化推奨
- **詳細メトリクス**: 非本番環境では無効化可能

## Terraform要件

- Terraform >= 1.0
- AWS Provider ~> 5.0

## 関連モジュール

- [cognito](../cognito/) - Cognito User Pools
- [lambda](../lambda/) - Lambda関数
- [waf](../waf/) - WAF Web ACL

## 参照

- [AWS API Gateway REST API](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-rest-api.html)
- [Cognito User Pool Authorizer](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html)
- [Usage Plans](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-usage-plans.html)
