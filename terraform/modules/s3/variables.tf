# S3 Module - Variable Definitions

# 基本設定
variable "project_name" {
  type        = string
  description = "プロジェクト名（バケット名のプレフィックスとして使用）"
}

variable "environment" {
  type        = string
  description = "環境名（dev, stg, prod）"
  validation {
    condition     = contains(["dev", "stg", "prod"], var.environment)
    error_message = "environment must be one of: dev, stg, prod"
  }
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "すべてのリソースに適用される共通タグ"
}

# 汎用バケット設定
variable "enabled" {
  type        = bool
  default     = false
  description = "汎用S3バケット（uploads, assets）を作成するかどうか"
}

variable "buckets" {
  type        = list(string)
  default     = ["uploads", "assets"]
  description = "作成するバケットのサフィックスリスト"
}

# 監査ログバケット設定
variable "enable_audit_log" {
  type        = bool
  default     = false
  description = "監査ログバケット（Object Lock有効）を作成するかどうか"
}

variable "kms_key_arn" {
  type        = string
  default     = ""
  description = "S3暗号化に使用するKMS CMKのARN（監査ログバケット用）"
}

# アクセスログ設定
variable "enable_access_logging" {
  type        = bool
  default     = false
  description = "S3アクセスログを有効化するかどうか"
}

variable "access_log_bucket_id" {
  type        = string
  default     = ""
  description = "S3アクセスログを保存するバケットID"
}

# Object Lock詳細設定（オプション）
variable "audit_log_retention_mode" {
  type        = string
  default     = "GOVERNANCE"
  description = "Object Lockの保持モード（GOVERNANCE または COMPLIANCE）"
  validation {
    condition     = contains(["GOVERNANCE", "COMPLIANCE"], var.audit_log_retention_mode)
    error_message = "audit_log_retention_mode must be either GOVERNANCE or COMPLIANCE"
  }
}

variable "audit_log_retention_years" {
  type        = number
  default     = 10
  description = "監査ログの保持期間（年数）"
  validation {
    condition     = var.audit_log_retention_years >= 1 && var.audit_log_retention_years <= 100
    error_message = "audit_log_retention_years must be between 1 and 100"
  }
}

# ライフサイクル設定（オプション）
variable "audit_log_glacier_transition_days" {
  type        = number
  default     = 90
  description = "GLACIER移行までの日数"
  validation {
    condition     = var.audit_log_glacier_transition_days >= 0 && var.audit_log_glacier_transition_days <= 365
    error_message = "audit_log_glacier_transition_days must be between 0 and 365"
  }
}

variable "audit_log_deep_archive_transition_days" {
  type        = number
  default     = 365
  description = "DEEP_ARCHIVE移行までの日数"
  validation {
    condition     = var.audit_log_deep_archive_transition_days >= 90 && var.audit_log_deep_archive_transition_days <= 3650
    error_message = "audit_log_deep_archive_transition_days must be between 90 and 3650"
  }
}
