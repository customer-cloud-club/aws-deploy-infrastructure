# S3 Module - Output Definitions

# 汎用バケット出力
output "bucket_names" {
  value       = var.enabled ? { for k, v in aws_s3_bucket.main : k => v.id } : {}
  description = "作成された汎用S3バケットの名前マップ"
}

output "bucket_arns" {
  value       = var.enabled ? { for k, v in aws_s3_bucket.main : k => v.arn } : {}
  description = "作成された汎用S3バケットのARNマップ"
}

output "bucket_regional_domain_names" {
  value       = var.enabled ? { for k, v in aws_s3_bucket.main : k => v.bucket_regional_domain_name } : {}
  description = "S3バケットのリージョナルドメイン名マップ"
}

# 監査ログバケット出力
output "audit_log_bucket_id" {
  value       = var.enable_audit_log ? aws_s3_bucket.audit_log[0].id : null
  description = "監査ログバケットのID"
}

output "audit_log_bucket_arn" {
  value       = var.enable_audit_log ? aws_s3_bucket.audit_log[0].arn : null
  description = "監査ログバケットのARN"
}

output "audit_log_bucket_domain_name" {
  value       = var.enable_audit_log ? aws_s3_bucket.audit_log[0].bucket_domain_name : null
  description = "監査ログバケットのドメイン名"
}

output "audit_log_bucket_regional_domain_name" {
  value       = var.enable_audit_log ? aws_s3_bucket.audit_log[0].bucket_regional_domain_name : null
  description = "監査ログバケットのリージョナルドメイン名"
}

output "audit_log_object_lock_configuration" {
  value = var.enable_audit_log ? {
    enabled         = true
    mode            = var.audit_log_retention_mode
    retention_years = var.audit_log_retention_years
  } : null
  description = "監査ログバケットのObject Lock設定情報"
}

# セキュリティ設定情報
output "security_configuration" {
  value = var.enable_audit_log ? {
    encryption_enabled    = true
    encryption_type       = "aws:kms"
    kms_key_arn           = var.kms_key_arn
    public_access_blocked = true
    versioning_enabled    = true
    object_lock_enabled   = true
    secure_transport_only = true
  } : null
  description = "監査ログバケットのセキュリティ設定情報"
  sensitive   = true
}

# ライフサイクル設定情報
output "lifecycle_configuration" {
  value = var.enable_audit_log ? {
    glacier_transition_days      = var.audit_log_glacier_transition_days
    deep_archive_transition_days = var.audit_log_deep_archive_transition_days
    expiration_days              = var.audit_log_retention_years * 365
  } : null
  description = "監査ログバケットのライフサイクル設定情報"
}

# アクセスログ設定情報
output "access_logging_enabled" {
  value       = var.enable_audit_log && var.enable_access_logging
  description = "監査ログバケットのアクセスログが有効かどうか"
}
