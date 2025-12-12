#==============================================================================
# WAF Module Outputs
#==============================================================================

output "web_acl_id" {
  description = "The ID of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.id
}

output "web_acl_arn" {
  description = "The ARN of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.arn
}

output "web_acl_name" {
  description = "The name of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.name
}

output "web_acl_capacity" {
  description = "The capacity of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.capacity
}

output "log_group_name" {
  description = "The name of the CloudWatch Log Group for WAF logs"
  value       = var.enable_logging ? aws_cloudwatch_log_group.waf_logs[0].name : null
}

output "log_group_arn" {
  description = "The ARN of the CloudWatch Log Group for WAF logs"
  value       = var.enable_logging ? aws_cloudwatch_log_group.waf_logs[0].arn : null
}

output "rules_summary" {
  description = "Summary of applied WAF rules"
  value = {
    total_rules = length(var.rules)
    rule_names  = [for rule in var.rules : rule.name]
    priorities  = [for rule in var.rules : rule.priority]
  }
}

output "cloudwatch_metric_name" {
  description = "The CloudWatch metric name for the WAF Web ACL"
  value       = "${var.project_name}-${var.environment}-waf-metric"
}

output "scope" {
  description = "The scope of the WAF Web ACL (REGIONAL or CLOUDFRONT)"
  value       = var.scope
}

output "logging_enabled" {
  description = "Whether WAF logging is enabled"
  value       = var.enable_logging
}

output "association_resource_arn" {
  description = "The ARN of the associated resource (if any)"
  value       = var.resource_arn
}
