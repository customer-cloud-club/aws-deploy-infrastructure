# 新規プロダクト統合 - 変数定義

variable "product_name" {
  description = "プロダクト名（英数字とハイフンのみ）"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.product_name))
    error_message = "product_name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  description = "環境名（dev, staging, prod）"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "origin_domain" {
  description = "オリジンサーバーのドメイン（Vercel, App Runner等）"
  type        = string
}

variable "custom_domain" {
  description = "カスタムドメイン（オプション）"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ACM証明書ARN（カスタムドメイン使用時、us-east-1リージョン）"
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route53ホストゾーンID（カスタムドメイン使用時）"
  type        = string
  default     = ""
}

# 共通基盤との連携設定
variable "platform_api_url" {
  description = "Platform API URL"
  type        = string
  default     = "https://p8uhqklb43.execute-api.ap-northeast-1.amazonaws.com/development"
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
  default     = "ap-northeast-1_lSPtvbFS7"
}
