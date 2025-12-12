/**
 * API Gateway Routes Definition
 *
 * 要件定義書 Section 10.6.2 に基づくルート定義
 */

# ルートリソース
locals {
  lambda_integration_timeout = 29000 # 29秒 (API Gateway最大値)
}

# /auth/* - 認証エンドポイント (認証不要)
resource "aws_api_gateway_resource" "auth" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "auth"
}

resource "aws_api_gateway_method" "auth" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.auth.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.auth.id
  http_method             = aws_api_gateway_method.auth.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${lookup(var.lambda_function_arns, "auth", "")}/invocations"
  timeout_milliseconds    = local.lambda_integration_timeout
}

# /me - ユーザー情報ルート
resource "aws_api_gateway_resource" "me" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "me"
}

# /me/entitlements - エンタイトルメント取得 (Cognito認証)
resource "aws_api_gateway_resource" "me_entitlements" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.me.id
  path_part   = "entitlements"
}

resource "aws_api_gateway_method" "me_entitlements" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.me_entitlements.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_integration" "me_entitlements" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.me_entitlements.id
  http_method             = aws_api_gateway_method.me_entitlements.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${lookup(var.lambda_function_arns, "me_entitlements", "")}/invocations"
  timeout_milliseconds    = local.lambda_integration_timeout
}

# /me/usage - 使用量記録 (Cognito認証)
resource "aws_api_gateway_resource" "me_usage" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.me.id
  path_part   = "usage"
}

resource "aws_api_gateway_method" "me_usage" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.me_usage.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_integration" "me_usage" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.me_usage.id
  http_method             = aws_api_gateway_method.me_usage.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${lookup(var.lambda_function_arns, "me_usage", "")}/invocations"
  timeout_milliseconds    = local.lambda_integration_timeout
}

# /checkout - チェックアウト (Cognito認証)
resource "aws_api_gateway_resource" "checkout" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "checkout"
}

resource "aws_api_gateway_method" "checkout" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.checkout.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_integration" "checkout" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.checkout.id
  http_method             = aws_api_gateway_method.checkout.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${lookup(var.lambda_function_arns, "checkout", "")}/invocations"
  timeout_milliseconds    = local.lambda_integration_timeout
}

# /subscriptions/* - サブスクリプション管理 (Cognito認証)
resource "aws_api_gateway_resource" "subscriptions" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "subscriptions"
}

resource "aws_api_gateway_resource" "subscriptions_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.subscriptions.id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "subscriptions" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.subscriptions_proxy.id
  http_method   = "ANY"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id

  request_parameters = {
    "method.request.path.proxy" = true
  }
}

resource "aws_api_gateway_integration" "subscriptions" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.subscriptions_proxy.id
  http_method             = aws_api_gateway_method.subscriptions.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${lookup(var.lambda_function_arns, "subscriptions", "")}/invocations"
  timeout_milliseconds    = local.lambda_integration_timeout

  request_parameters = {
    "integration.request.path.proxy" = "method.request.path.proxy"
  }
}

# /webhooks - Webhook受信
resource "aws_api_gateway_resource" "webhooks" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "webhooks"
}

# /webhooks/stripe - Stripe Webhook (署名検証はLambda側で実施)
resource "aws_api_gateway_resource" "stripe_webhook" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.webhooks.id
  path_part   = "stripe"
}

resource "aws_api_gateway_method" "stripe_webhook" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.stripe_webhook.id
  http_method   = "POST"
  authorization = "NONE" # Stripe署名検証はLambda側で実施

  request_parameters = {
    "method.request.header.Stripe-Signature" = true
  }
}

resource "aws_api_gateway_integration" "stripe_webhook" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.stripe_webhook.id
  http_method             = aws_api_gateway_method.stripe_webhook.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${lookup(var.lambda_function_arns, "stripe_webhook", "")}/invocations"
  timeout_milliseconds    = local.lambda_integration_timeout

  request_parameters = {
    "integration.request.header.Stripe-Signature" = "method.request.header.Stripe-Signature"
  }
}

# /admin/* - 管理者API (Cognito認証 + Admin権限チェック)
resource "aws_api_gateway_resource" "admin" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "admin"
}

resource "aws_api_gateway_resource" "admin_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.admin.id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "admin" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.admin_proxy.id
  http_method   = "ANY"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id

  request_parameters = {
    "method.request.path.proxy" = true
  }

  # Admin権限チェックはLambda Authorizerまたはアプリケーション層で実施
}

resource "aws_api_gateway_integration" "admin" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.admin_proxy.id
  http_method             = aws_api_gateway_method.admin.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${lookup(var.lambda_function_arns, "admin", "")}/invocations"
  timeout_milliseconds    = local.lambda_integration_timeout

  request_parameters = {
    "integration.request.path.proxy" = "method.request.path.proxy"
  }
}

# /catalog/* - カタログ参照 (認証不要)
resource "aws_api_gateway_resource" "catalog" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "catalog"
}

resource "aws_api_gateway_resource" "catalog_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.catalog.id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "catalog" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.catalog_proxy.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    "method.request.path.proxy" = true
  }
}

resource "aws_api_gateway_integration" "catalog" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.catalog_proxy.id
  http_method             = aws_api_gateway_method.catalog.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${lookup(var.lambda_function_arns, "catalog", "")}/invocations"
  timeout_milliseconds    = local.lambda_integration_timeout

  request_parameters = {
    "integration.request.path.proxy" = "method.request.path.proxy"
  }
}

# データソース
data "aws_region" "current" {}
