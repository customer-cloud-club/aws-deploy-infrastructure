/**
 * API Gateway Module Variables
 */

variable "project_name" {
  description = "プロジェクト名"
  type        = string
  default     = "miyabi-auth-billing"
}

variable "environment" {
  description = "環境名 (production, staging, development)"
  type        = string

  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "Environment must be production, staging, or development."
  }
}

variable "tags" {
  description = "共通タグ"
  type        = map(string)
  default     = {}
}

# Cognito設定
variable "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  type        = string
}

# Lambda統合
variable "lambda_function_arns" {
  description = "Lambda関数ARNマップ (キー: auth, me_entitlements, me_usage, checkout, subscriptions, stripe_webhook, admin, catalog)"
  type        = map(string)
  default     = {}
}

variable "lambda_function_names" {
  description = "Lambda関数名マップ (キー: auth, me_entitlements, me_usage, checkout, subscriptions, stripe_webhook, admin, catalog)"
  type        = map(string)
  default     = {}
}

# ログ設定
variable "log_retention_days" {
  description = "CloudWatch Logsの保持期間 (日)"
  type        = number
  default     = 30
}

variable "api_logging_level" {
  description = "API Gatewayログレベル (OFF, ERROR, INFO)"
  type        = string
  default     = "INFO"

  validation {
    condition     = contains(["OFF", "ERROR", "INFO"], var.api_logging_level)
    error_message = "Logging level must be OFF, ERROR, or INFO."
  }
}

variable "enable_xray_tracing" {
  description = "X-Rayトレーシングを有効化"
  type        = bool
  default     = true
}

# スロットリング設定
variable "default_throttle_burst_limit" {
  description = "デフォルトバーストリミット (リクエスト数)"
  type        = number
  default     = 5000
}

variable "default_throttle_rate_limit" {
  description = "デフォルトレートリミット (リクエスト/秒)"
  type        = number
  default     = 10000
}

# Usage Plan設定
variable "usage_plans" {
  description = "Usage Plan設定"
  type = map(object({
    description      = string
    throttle_burst   = number
    throttle_rate    = number
    quota_limit      = number
    quota_period     = string
    api_stages       = list(string)
  }))

  default = {
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
}

# CORS設定
variable "cors_allow_origins" {
  description = "CORSで許可するオリジン"
  type        = list(string)
  default     = ["*"]
}

variable "cors_allow_methods" {
  description = "CORSで許可するHTTPメソッド"
  type        = list(string)
  default     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}

variable "cors_allow_headers" {
  description = "CORSで許可するヘッダー"
  type        = list(string)
  default = [
    "Content-Type",
    "X-Amz-Date",
    "Authorization",
    "X-Api-Key",
    "X-Amz-Security-Token"
  ]
}

# Stripe Webhook設定
variable "stripe_webhook_secret" {
  description = "Stripe Webhook署名検証シークレット (SSM Parameter Storeパス)"
  type        = string
  default     = ""
  sensitive   = true
}

# Admin認証設定
variable "admin_cognito_group" {
  description = "管理者用Cognitoグループ名"
  type        = string
  default     = "Admins"
}

# カスタムドメイン設定
variable "custom_domain_name" {
  description = "カスタムドメイン名 (例: api.example.com)"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ACM証明書ARN (カスタムドメイン用)"
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route 53ホストゾーンID (カスタムドメイン用)"
  type        = string
  default     = ""
}

# WAF設定
variable "enable_waf" {
  description = "AWS WAFを有効化"
  type        = bool
  default     = false
}

variable "waf_web_acl_arn" {
  description = "WAF Web ACL ARN"
  type        = string
  default     = ""
}
