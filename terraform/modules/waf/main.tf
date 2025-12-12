#==============================================================================
# WAF Web ACL
#==============================================================================
# WAF v2 Web ACL for API Gateway and CloudFront protection
# Implements AWS managed rules and custom rate limiting rules
# Reference: Section 10.6.2 - WAF Rules Configuration
#==============================================================================

resource "aws_wafv2_web_acl" "main" {
  name        = "${var.project_name}-${var.environment}-waf"
  scope       = var.scope
  description = "WAF for ${var.project_name} ${var.environment} - API Gateway and CloudFront protection"

  default_action {
    allow {}
  }

  # Dynamic rule creation from rules.tf
  dynamic "rule" {
    for_each = var.rules
    content {
      name     = rule.value.name
      priority = rule.value.priority

      # Override action for managed rule groups
      dynamic "override_action" {
        for_each = rule.value.override_action != null ? [rule.value.override_action] : []
        content {
          dynamic "none" {
            for_each = override_action.value == "none" ? [1] : []
            content {}
          }
          dynamic "count" {
            for_each = override_action.value == "count" ? [1] : []
            content {}
          }
        }
      }

      # Action for custom rules
      dynamic "action" {
        for_each = rule.value.action != null ? [rule.value.action] : []
        content {
          dynamic "allow" {
            for_each = action.value == "allow" ? [1] : []
            content {}
          }
          dynamic "block" {
            for_each = action.value == "block" ? [1] : []
            content {}
          }
          dynamic "count" {
            for_each = action.value == "count" ? [1] : []
            content {}
          }
        }
      }

      statement {
        # Managed rule group statement
        dynamic "managed_rule_group_statement" {
          for_each = rule.value.managed_rule_group != null ? [rule.value.managed_rule_group] : []
          content {
            name        = managed_rule_group_statement.value.name
            vendor_name = managed_rule_group_statement.value.vendor_name

            dynamic "rule_action_override" {
              for_each = lookup(managed_rule_group_statement.value, "excluded_rules", [])
              content {
                name = rule_action_override.value
                action_to_use {
                  count {}
                }
              }
            }
          }
        }

        # Rate-based statement
        dynamic "rate_based_statement" {
          for_each = rule.value.rate_based != null ? [rule.value.rate_based] : []
          content {
            limit              = rate_based_statement.value.limit
            aggregate_key_type = rate_based_statement.value.aggregate_key_type

            dynamic "scope_down_statement" {
              for_each = lookup(rate_based_statement.value, "scope_down_statement", null) != null ? [rate_based_statement.value.scope_down_statement] : []
              content {
                dynamic "byte_match_statement" {
                  for_each = lookup(scope_down_statement.value, "byte_match", null) != null ? [scope_down_statement.value.byte_match] : []
                  content {
                    search_string         = byte_match_statement.value.search_string
                    positional_constraint = byte_match_statement.value.positional_constraint

                    field_to_match {
                      dynamic "uri_path" {
                        for_each = byte_match_statement.value.field_to_match == "uri_path" ? [1] : []
                        content {}
                      }
                    }

                    text_transformation {
                      priority = 0
                      type     = byte_match_statement.value.text_transformation
                    }
                  }
                }
              }
            }
          }
        }

        # Geo match statement
        dynamic "geo_match_statement" {
          for_each = rule.value.geo_match != null ? [rule.value.geo_match] : []
          content {
            country_codes = geo_match_statement.value.country_codes
          }
          }
      }

      visibility_config {
        cloudwatch_metrics_enabled = var.cloudwatch_metrics_enabled
        metric_name                = "${rule.value.name}Metric"
        sampled_requests_enabled   = var.sampled_requests_enabled
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = var.cloudwatch_metrics_enabled
    metric_name                = "${var.project_name}-${var.environment}-waf-metric"
    sampled_requests_enabled   = var.sampled_requests_enabled
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-waf"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Module      = "waf"
    }
  )
}

#==============================================================================
# CloudWatch Log Group for WAF Logs
#==============================================================================

resource "aws_cloudwatch_log_group" "waf_logs" {
  count             = var.enable_logging ? 1 : 0
  name              = "aws-waf-logs-${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-waf-logs"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )
}

#==============================================================================
# WAF Logging Configuration
#==============================================================================

resource "aws_wafv2_web_acl_logging_configuration" "main" {
  count                   = var.enable_logging ? 1 : 0
  resource_arn            = aws_wafv2_web_acl.main.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf_logs[0].arn]

  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }
}

#==============================================================================
# WAF Web ACL Association (Optional)
#==============================================================================

resource "aws_wafv2_web_acl_association" "main" {
  count        = var.resource_arn != null ? 1 : 0
  resource_arn = var.resource_arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}
