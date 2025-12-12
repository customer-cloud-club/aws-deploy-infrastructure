#==============================================================================
# WAF Rules Definition
#==============================================================================
# Default WAF rules based on requirements (Section 10.6.2)
# Priority order:
#   1. AWS Managed Common Rule Set - General vulnerabilities
#   2. AWS Managed SQLi Rule Set - SQL injection protection
#   3. AWS Managed Known Bad Inputs Rule Set - Known malicious requests
#   4. IP Rate Limit (Auth) - 10 req/5min/IP for authentication endpoints
#   5. IP Rate Limit (General) - 2000 req/5min/IP for general API endpoints
#==============================================================================

locals {
  # Default rules based on requirements
  default_rules = [
    # Rule 1: AWS Managed Common Rule Set
    var.enable_common_rule_set ? {
      name            = "AWSManagedRulesCommonRuleSet"
      priority        = 1
      action          = null
      override_action = "none"
      managed_rule_group = {
        name           = "AWSManagedRulesCommonRuleSet"
        vendor_name    = "AWS"
        excluded_rules = var.common_rule_set_excluded_rules
      }
      rate_based = null
      geo_match  = null
    } : null,

    # Rule 2: AWS Managed SQLi Rule Set
    var.enable_sqli_rule_set ? {
      name            = "AWSManagedRulesSQLiRuleSet"
      priority        = 2
      action          = null
      override_action = "none"
      managed_rule_group = {
        name           = "AWSManagedRulesSQLiRuleSet"
        vendor_name    = "AWS"
        excluded_rules = var.sqli_rule_set_excluded_rules
      }
      rate_based = null
      geo_match  = null
    } : null,

    # Rule 3: AWS Managed Known Bad Inputs Rule Set
    var.enable_known_bad_inputs_rule_set ? {
      name            = "AWSManagedRulesKnownBadInputsRuleSet"
      priority        = 3
      action          = null
      override_action = "none"
      managed_rule_group = {
        name           = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name    = "AWS"
        excluded_rules = var.known_bad_inputs_excluded_rules
      }
      rate_based = null
      geo_match  = null
    } : null,

    # Rule 4: IP Rate Limit for Authentication Endpoints
    # 10 req/5min/IP = 100 requests per 5 minutes (WAF counts in 5-min intervals)
    {
      name            = "RateLimitAuth"
      priority        = 4
      action          = "block"
      override_action = null
      managed_rule_group = null
      rate_based = {
        limit              = var.auth_rate_limit
        aggregate_key_type = "IP"
        scope_down_statement = {
          byte_match = {
            search_string         = var.auth_path_patterns[0]
            positional_constraint = "STARTS_WITH"
            field_to_match        = "uri_path"
            text_transformation   = "LOWERCASE"
          }
        }
      }
      geo_match = null
    },

    # Rule 5: IP Rate Limit for General API Endpoints
    # 2000 req/5min/IP
    {
      name            = "RateLimitGeneral"
      priority        = 5
      action          = "block"
      override_action = null
      managed_rule_group = null
      rate_based = {
        limit              = var.general_rate_limit
        aggregate_key_type = "IP"
        scope_down_statement = null
      }
      geo_match = null
    }
  ]

  # Filter out null values and merge with custom rules
  rules = [for rule in local.default_rules : rule if rule != null]
}

#==============================================================================
# Rule Configuration Examples
#==============================================================================
#
# Example 1: Custom Rate Limiting Rule
# {
#   name            = "CustomRateLimit"
#   priority        = 10
#   action          = "block"
#   override_action = null
#   managed_rule_group = null
#   rate_based = {
#     limit              = 1000
#     aggregate_key_type = "IP"
#     scope_down_statement = {
#       byte_match = {
#         search_string         = "/api/"
#         positional_constraint = "STARTS_WITH"
#         field_to_match        = "uri_path"
#         text_transformation   = "LOWERCASE"
#       }
#     }
#   }
#   geo_match = null
# }
#
# Example 2: Geo Blocking Rule
# {
#   name            = "GeoBlock"
#   priority        = 20
#   action          = "block"
#   override_action = null
#   managed_rule_group = null
#   rate_based = null
#   geo_match = {
#     country_codes = ["CN", "RU", "KP"]
#   }
# }
#
# Example 3: Custom Managed Rule Group
# {
#   name            = "AWSManagedRulesAmazonIpReputationList"
#   priority        = 30
#   action          = null
#   override_action = "none"
#   managed_rule_group = {
#     name           = "AWSManagedRulesAmazonIpReputationList"
#     vendor_name    = "AWS"
#     excluded_rules = []
#   }
#   rate_based = null
#   geo_match  = null
# }
#
#==============================================================================
