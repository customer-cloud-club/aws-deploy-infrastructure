/**
 * API Gateway Module Outputs
 */

output "api_id" {
  description = "REST API ID"
  value       = aws_api_gateway_rest_api.main.id
}

output "api_arn" {
  description = "REST API ARN"
  value       = aws_api_gateway_rest_api.main.arn
}

output "api_execution_arn" {
  description = "REST API実行ARN (Lambda権限用)"
  value       = aws_api_gateway_rest_api.main.execution_arn
}

output "api_endpoint" {
  description = "API Gateway エンドポイントURL"
  value       = aws_api_gateway_stage.main.invoke_url
}

output "stage_name" {
  description = "デプロイステージ名"
  value       = aws_api_gateway_stage.main.stage_name
}

output "stage_arn" {
  description = "ステージARN"
  value       = aws_api_gateway_stage.main.arn
}

output "deployment_id" {
  description = "デプロイメントID"
  value       = aws_api_gateway_deployment.main.id
}

# Authorizer
output "cognito_authorizer_id" {
  description = "Cognito AuthorizerのID"
  value       = aws_api_gateway_authorizer.cognito.id
}

# Resources
output "resource_ids" {
  description = "API Gatewayリソースのマップ"
  value = {
    root                = aws_api_gateway_rest_api.main.root_resource_id
    auth                = aws_api_gateway_resource.auth.id
    me                  = aws_api_gateway_resource.me.id
    me_entitlements     = aws_api_gateway_resource.me_entitlements.id
    me_usage            = aws_api_gateway_resource.me_usage.id
    checkout            = aws_api_gateway_resource.checkout.id
    subscriptions       = aws_api_gateway_resource.subscriptions.id
    subscriptions_proxy = aws_api_gateway_resource.subscriptions_proxy.id
    webhooks            = aws_api_gateway_resource.webhooks.id
    stripe_webhook      = aws_api_gateway_resource.stripe_webhook.id
    admin               = aws_api_gateway_resource.admin.id
    admin_proxy         = aws_api_gateway_resource.admin_proxy.id
    catalog             = aws_api_gateway_resource.catalog.id
    catalog_proxy       = aws_api_gateway_resource.catalog_proxy.id
  }
}

# Usage Plans
output "usage_plan_ids" {
  description = "Usage Plan IDマップ"
  value = {
    for k, v in aws_api_gateway_usage_plan.plans : k => v.id
  }
}

output "usage_plan_arns" {
  description = "Usage Plan ARNマップ"
  value = {
    for k, v in aws_api_gateway_usage_plan.plans : k => v.arn
  }
}

# API Keys
output "api_key_ids" {
  description = "API Key IDマップ"
  value = {
    for k, v in aws_api_gateway_api_key.keys : k => v.id
  }
}

output "api_key_values" {
  description = "API Key値マップ (機密情報)"
  value = {
    for k, v in aws_api_gateway_api_key.keys : k => v.value
  }
  sensitive = true
}

# CloudWatch Logs
output "log_group_name" {
  description = "CloudWatch Logs グループ名"
  value       = aws_cloudwatch_log_group.api_gateway.name
}

output "log_group_arn" {
  description = "CloudWatch Logs グループARN"
  value       = aws_cloudwatch_log_group.api_gateway.arn
}

# カスタムドメイン
output "custom_domain_name" {
  description = "カスタムドメイン名"
  value       = var.custom_domain_name != "" ? aws_api_gateway_domain_name.custom[0].domain_name : null
}

output "custom_domain_cloudfront_domain_name" {
  description = "カスタムドメインのCloudFront配信ドメイン名"
  value       = var.custom_domain_name != "" ? aws_api_gateway_domain_name.custom[0].cloudfront_domain_name : null
}

output "custom_domain_cloudfront_zone_id" {
  description = "カスタムドメインのCloudFront Zone ID"
  value       = var.custom_domain_name != "" ? aws_api_gateway_domain_name.custom[0].cloudfront_zone_id : null
}

# エンドポイント情報
output "endpoints" {
  description = "APIエンドポイント一覧"
  value = {
    base_url = aws_api_gateway_stage.main.invoke_url
    paths = {
      auth                = "${aws_api_gateway_stage.main.invoke_url}/auth"
      me_entitlements     = "${aws_api_gateway_stage.main.invoke_url}/me/entitlements"
      me_usage            = "${aws_api_gateway_stage.main.invoke_url}/me/usage"
      checkout            = "${aws_api_gateway_stage.main.invoke_url}/checkout"
      subscriptions       = "${aws_api_gateway_stage.main.invoke_url}/subscriptions"
      stripe_webhook      = "${aws_api_gateway_stage.main.invoke_url}/webhooks/stripe"
      admin               = "${aws_api_gateway_stage.main.invoke_url}/admin"
      catalog             = "${aws_api_gateway_stage.main.invoke_url}/catalog"
    }
  }
}

# メトリクス
output "metrics" {
  description = "CloudWatchメトリクス情報"
  value = {
    namespace = "AWS/ApiGateway"
    dimensions = {
      ApiName = aws_api_gateway_rest_api.main.name
      Stage   = aws_api_gateway_stage.main.stage_name
    }
  }
}
