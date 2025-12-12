/**
 * API Gateway Usage Plans
 *
 * レート制限とクォータ管理
 * - Standard Plan: 1000 req/sec, 100000 req/month
 * - Premium Plan: 5000 req/sec, 1000000 req/month
 */

# Usage Plans
resource "aws_api_gateway_usage_plan" "plans" {
  for_each = var.usage_plans

  name        = "${var.project_name}-${var.environment}-${each.key}"
  description = each.value.description

  # API Stage関連付け
  api_stages {
    api_id = aws_api_gateway_rest_api.main.id
    stage  = aws_api_gateway_stage.main.stage_name
  }

  # スロットリング設定
  throttle_settings {
    burst_limit = each.value.throttle_burst
    rate_limit  = each.value.throttle_rate
  }

  # クォータ設定
  quota_settings {
    limit  = each.value.quota_limit
    period = each.value.quota_period
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-${each.key}"
      Environment = var.environment
      Plan        = each.key
    }
  )
}

# Usage PlanとAPI Stageの関連付け
resource "aws_api_gateway_usage_plan_key" "plans" {
  for_each = var.usage_plans

  key_id        = aws_api_gateway_api_key.keys[each.key].id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.plans[each.key].id
}

# API Stage関連付けは aws_api_gateway_usage_plan の api_stages ブロックで定義

# API Keys (各プランごと)
resource "aws_api_gateway_api_key" "keys" {
  for_each = var.usage_plans

  name        = "${var.project_name}-${var.environment}-${each.key}-key"
  description = "API Key for ${each.value.description}"
  enabled     = true

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-${each.key}-key"
      Environment = var.environment
      Plan        = each.key
    }
  )
}

# CloudWatch Alarms (クォータ監視)
resource "aws_cloudwatch_metric_alarm" "quota_exceeded" {
  for_each = var.usage_plans

  alarm_name          = "${var.project_name}-${var.environment}-${each.key}-quota-exceeded"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Count"
  namespace           = "AWS/ApiGateway"
  period              = 3600 # 1時間
  statistic           = "Sum"
  threshold           = each.value.quota_limit * 0.9 # 90%で警告
  alarm_description   = "API Usage Plan ${each.key} is approaching quota limit"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName    = aws_api_gateway_rest_api.main.name
    Stage      = aws_api_gateway_stage.main.stage_name
    UsagePlan  = aws_api_gateway_usage_plan.plans[each.key].name
  }

  tags = var.tags
}

# 4XX Errors監視
resource "aws_cloudwatch_metric_alarm" "client_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300 # 5分
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "High rate of 4XX errors detected"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = aws_api_gateway_rest_api.main.name
    Stage   = aws_api_gateway_stage.main.stage_name
  }

  tags = var.tags
}

# 5XX Errors監視
resource "aws_cloudwatch_metric_alarm" "server_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 60 # 1分
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "High rate of 5XX errors detected"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = aws_api_gateway_rest_api.main.name
    Stage   = aws_api_gateway_stage.main.stage_name
  }

  tags = var.tags
}

# レイテンシ監視
resource "aws_cloudwatch_metric_alarm" "latency" {
  alarm_name          = "${var.project_name}-${var.environment}-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = 300 # 5分
  statistic           = "Average"
  threshold           = 3000 # 3秒
  alarm_description   = "API Gateway latency is too high"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = aws_api_gateway_rest_api.main.name
    Stage   = aws_api_gateway_stage.main.stage_name
  }

  tags = var.tags
}

# カスタムドメイン (オプション)
resource "aws_api_gateway_domain_name" "custom" {
  count = var.custom_domain_name != "" ? 1 : 0

  domain_name              = var.custom_domain_name
  regional_certificate_arn = var.certificate_arn

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = merge(
    var.tags,
    {
      Name        = var.custom_domain_name
      Environment = var.environment
    }
  )
}

# カスタムドメインとAPI Stageのマッピング
resource "aws_api_gateway_base_path_mapping" "custom" {
  count = var.custom_domain_name != "" ? 1 : 0

  api_id      = aws_api_gateway_rest_api.main.id
  stage_name  = aws_api_gateway_stage.main.stage_name
  domain_name = aws_api_gateway_domain_name.custom[0].domain_name
}

# Route 53レコード (カスタムドメイン)
resource "aws_route53_record" "custom" {
  count = var.custom_domain_name != "" && var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.custom_domain_name
  type    = "A"

  alias {
    name                   = aws_api_gateway_domain_name.custom[0].regional_domain_name
    zone_id                = aws_api_gateway_domain_name.custom[0].regional_zone_id
    evaluate_target_health = true
  }
}

# WAF関連付け (オプション)
resource "aws_wafv2_web_acl_association" "api_gateway" {
  count = var.enable_waf ? 1 : 0

  resource_arn = aws_api_gateway_stage.main.arn
  web_acl_arn  = var.waf_web_acl_arn
}
