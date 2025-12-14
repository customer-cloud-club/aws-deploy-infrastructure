/**
 * API Gateway REST API Module
 *
 * 共通認証・課金基盤のAPI Gatewayを構成します。
 * - Cognito認証統合
 * - Stripe Webhook署名検証
 * - Lambda統合
 * - Usage Plan (レート制限)
 */

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# REST API Gateway
resource "aws_api_gateway_rest_api" "main" {
  name        = "${var.project_name}-${var.environment}-api"
  description = "共通認証・課金基盤 REST API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-api"
      Environment = var.environment
    }
  )
}

# Cognito Authorizer
resource "aws_api_gateway_authorizer" "cognito" {
  name          = "cognito-authorizer"
  type          = "COGNITO_USER_POOLS"
  rest_api_id   = aws_api_gateway_rest_api.main.id
  provider_arns = [var.cognito_user_pool_arn]

  identity_source = "method.request.header.Authorization"
}

# API Gateway Account設定 (CloudWatch Logs用)
resource "aws_api_gateway_account" "main" {
  cloudwatch_role_arn = aws_iam_role.api_gateway_cloudwatch.arn
}

# CloudWatch Logs用IAMロール
resource "aws_iam_role" "api_gateway_cloudwatch" {
  name = "${var.project_name}-${var.environment}-api-gateway-cloudwatch"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# CloudWatch Logs書き込み権限
resource "aws_iam_role_policy_attachment" "api_gateway_cloudwatch" {
  role       = aws_iam_role.api_gateway_cloudwatch.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

# デプロイメント
resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  # ルート変更時に再デプロイ
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_rest_api.main.body,
      filesha1("${path.module}/routes.tf"),
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.auth,
    aws_api_gateway_integration.me_entitlements,
    aws_api_gateway_integration.me_usage,
    aws_api_gateway_integration.checkout,
    aws_api_gateway_integration.subscriptions,
    aws_api_gateway_integration.stripe_webhook,
    aws_api_gateway_integration.admin,
    aws_api_gateway_integration.catalog,
  ]
}

# ステージ (Production/Staging)
resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.environment

  # アクセスログ
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      caller         = "$context.identity.caller"
      user           = "$context.identity.user"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      resourcePath   = "$context.resourcePath"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
    })
  }

  # X-Rayトレーシング
  xray_tracing_enabled = var.enable_xray_tracing

  # 詳細メトリクス
  variables = {
    environment = var.environment
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-api-stage"
      Environment = var.environment
    }
  )
}

# CloudWatch Logs Group
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# メソッド設定 (全メソッドでログ有効化)
resource "aws_api_gateway_method_settings" "all" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = aws_api_gateway_stage.main.stage_name
  method_path = "*/*"

  settings {
    metrics_enabled    = true
    logging_level      = var.api_logging_level
    data_trace_enabled = var.environment != "production"

    # スロットリング設定
    throttling_burst_limit = var.default_throttle_burst_limit
    throttling_rate_limit  = var.default_throttle_rate_limit
  }
}

# Lambda実行権限 (API Gateway → Lambda)
resource "aws_lambda_permission" "api_gateway" {
  for_each = var.lambda_function_arns

  statement_id  = "AllowAPIGatewayInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# CORS設定 (OPTIONS メソッド)
locals {
  cors_resources = {
    auth              = aws_api_gateway_resource.auth.id
    me_entitlements   = aws_api_gateway_resource.me_entitlements.id
    me_usage          = aws_api_gateway_resource.me_usage.id
    checkout          = aws_api_gateway_resource.checkout.id
    subscriptions     = aws_api_gateway_resource.subscriptions.id
    catalog           = aws_api_gateway_resource.catalog.id
    admin             = aws_api_gateway_resource.admin.id
    admin_proxy       = aws_api_gateway_resource.admin_proxy.id
    catalog_proxy     = aws_api_gateway_resource.catalog_proxy.id
  }
}

resource "aws_api_gateway_method" "cors_options" {
  for_each = local.cors_resources

  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = each.value
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_options" {
  for_each = aws_api_gateway_method.cors_options

  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = each.value.resource_id
  http_method = each.value.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "cors_options" {
  for_each = aws_api_gateway_method.cors_options

  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = each.value.resource_id
  http_method = each.value.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "cors_options" {
  for_each = aws_api_gateway_method.cors_options

  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = each.value.resource_id
  http_method = each.value.http_method
  status_code = aws_api_gateway_method_response.cors_options[each.key].status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# =============================================================================
# Gateway Responses for CORS on Error Responses
# =============================================================================

# CORS headers on 4XX errors (e.g., 401 Unauthorized, 403 Forbidden)
resource "aws_api_gateway_gateway_response" "default_4xx" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  response_type = "DEFAULT_4XX"

  response_parameters = {
    "gatewayresponse.header.Access-Control-Allow-Origin"  = "'*'"
    "gatewayresponse.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "gatewayresponse.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
  }
}

# CORS headers on 5XX errors (e.g., 500 Internal Server Error)
resource "aws_api_gateway_gateway_response" "default_5xx" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  response_type = "DEFAULT_5XX"

  response_parameters = {
    "gatewayresponse.header.Access-Control-Allow-Origin"  = "'*'"
    "gatewayresponse.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "gatewayresponse.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
  }
}
