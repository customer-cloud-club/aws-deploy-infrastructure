#==============================================================================
# WAF Module Variables
#==============================================================================

variable "project_name" {
  description = "Project name to be used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, stg, prod)"
  type        = string
}

variable "scope" {
  description = "Scope of the WAF - REGIONAL for API Gateway/ALB, CLOUDFRONT for CloudFront"
  type        = string
  default     = "REGIONAL"

  validation {
    condition     = contains(["REGIONAL", "CLOUDFRONT"], var.scope)
    error_message = "Scope must be either REGIONAL or CLOUDFRONT."
  }
}

variable "rules" {
  description = "List of WAF rules to apply"
  type = list(object({
    name            = string
    priority        = number
    action          = optional(string)
    override_action = optional(string)
    managed_rule_group = optional(object({
      name           = string
      vendor_name    = string
      excluded_rules = optional(list(string), [])
    }))
    rate_based = optional(object({
      limit              = number
      aggregate_key_type = string
      scope_down_statement = optional(object({
        byte_match = optional(object({
          search_string         = string
          positional_constraint = string
          field_to_match        = string
          text_transformation   = string
        }))
      }))
    }))
    geo_match = optional(object({
      country_codes = list(string)
    }))
  }))
  default = []
}

variable "cloudwatch_metrics_enabled" {
  description = "Enable CloudWatch metrics for WAF"
  type        = bool
  default     = true
}

variable "sampled_requests_enabled" {
  description = "Enable sampled requests for WAF"
  type        = bool
  default     = true
}

variable "enable_logging" {
  description = "Enable WAF logging to CloudWatch Logs"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Number of days to retain WAF logs"
  type        = number
  default     = 90
}

variable "resource_arn" {
  description = "ARN of the resource to associate with WAF (API Gateway, ALB, etc.). If null, no association is created."
  type        = string
  default     = null
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

#==============================================================================
# Rate Limiting Variables
#==============================================================================

variable "auth_rate_limit" {
  description = "Rate limit for authentication endpoints (requests per 5 minutes per IP)"
  type        = number
  default     = 100 # 10 req/5min as per requirements (100/5min = 20/min ≈ 10/5min with buffer)
}

variable "general_rate_limit" {
  description = "Rate limit for general API endpoints (requests per 5 minutes per IP)"
  type        = number
  default     = 2000 # 2000 req/5min as per requirements
}

variable "auth_path_patterns" {
  description = "List of authentication path patterns to apply rate limiting"
  type        = list(string)
  default     = ["/auth", "/api/auth"]
}

#==============================================================================
# Managed Rule Group Variables
#==============================================================================

variable "enable_common_rule_set" {
  description = "Enable AWS Managed Common Rule Set"
  type        = bool
  default     = true
}

variable "enable_sqli_rule_set" {
  description = "Enable AWS Managed SQLi Rule Set"
  type        = bool
  default     = true
}

variable "enable_known_bad_inputs_rule_set" {
  description = "Enable AWS Managed Known Bad Inputs Rule Set"
  type        = bool
  default     = true
}

variable "common_rule_set_excluded_rules" {
  description = "List of rule names to exclude from Common Rule Set"
  type        = list(string)
  default     = []
}

variable "sqli_rule_set_excluded_rules" {
  description = "List of rule names to exclude from SQLi Rule Set"
  type        = list(string)
  default     = []
}

variable "known_bad_inputs_excluded_rules" {
  description = "List of rule names to exclude from Known Bad Inputs Rule Set"
  type        = list(string)
  default     = []
}
