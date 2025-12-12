# S3 Module - Usage Examples
# このファイルは使用例のサンプルです（実際の環境では使用しません）

# Example 1: 汎用バケットのみ作成
/*
module "s3_general" {
  source = "../../modules/s3"

  project_name = "myproject"
  environment  = "prod"
  enabled      = true

  buckets = ["uploads", "assets", "backups"]

  tags = {
    ManagedBy = "Terraform"
    Project   = "MyProject"
  }
}

output "bucket_info" {
  value = {
    names                 = module.s3_general.bucket_names
    arns                  = module.s3_general.bucket_arns
    regional_domain_names = module.s3_general.bucket_regional_domain_names
  }
}
*/

# Example 2: 監査ログバケットのみ作成（GOVERNANCE モード）
/*
module "s3_audit_governance" {
  source = "../../modules/s3"

  project_name = "myproject"
  environment  = "prod"
  enabled      = false

  enable_audit_log = true
  kms_key_arn     = "arn:aws:kms:ap-northeast-1:123456789012:key/12345678-1234-1234-1234-123456789012"

  # GOVERNANCEモード（推奨）
  audit_log_retention_mode  = "GOVERNANCE"
  audit_log_retention_years = 10

  # ライフサイクル設定
  audit_log_glacier_transition_days      = 90
  audit_log_deep_archive_transition_days = 365

  tags = {
    ManagedBy  = "Terraform"
    Compliance = "commercial-law-10years"
    Purpose    = "audit-log"
  }
}

output "audit_log_info" {
  value = {
    bucket_id  = module.s3_audit_governance.audit_log_bucket_id
    bucket_arn = module.s3_audit_governance.audit_log_bucket_arn
    object_lock = module.s3_audit_governance.audit_log_object_lock_configuration
    lifecycle   = module.s3_audit_governance.lifecycle_configuration
  }
}
*/

# Example 3: 監査ログバケット（COMPLIANCE モード - 厳格）
/*
module "s3_audit_compliance" {
  source = "../../modules/s3"

  project_name = "financial-system"
  environment  = "prod"
  enabled      = false

  enable_audit_log = true
  kms_key_arn     = var.kms_key_arn

  # COMPLIANCEモード（より厳格）
  audit_log_retention_mode  = "COMPLIANCE"
  audit_log_retention_years = 10

  # アクセスログも有効化
  enable_access_logging = true
  access_log_bucket_id  = "financial-system-access-logs-prod"

  tags = {
    ManagedBy       = "Terraform"
    Compliance      = "financial-regulations"
    DataClass       = "confidential"
    RetentionPeriod = "10years"
  }
}
*/

# Example 4: 両方使用（汎用バケット + 監査ログバケット）
/*
module "s3_complete" {
  source = "../../modules/s3"

  project_name = "myproject"
  environment  = "prod"

  # 汎用バケット
  enabled = true
  buckets = ["uploads", "assets"]

  # 監査ログバケット
  enable_audit_log              = true
  kms_key_arn                  = var.kms_key_arn
  audit_log_retention_mode     = "GOVERNANCE"
  audit_log_retention_years    = 10
  audit_log_glacier_transition_days      = 90
  audit_log_deep_archive_transition_days = 365

  # アクセスログ
  enable_access_logging = true
  access_log_bucket_id  = var.access_log_bucket_id

  tags = {
    ManagedBy = "Terraform"
    Project   = "MyProject"
  }
}

output "all_buckets" {
  value = {
    # 汎用バケット
    general_buckets = module.s3_complete.bucket_names

    # 監査ログバケット
    audit_log = {
      id                 = module.s3_complete.audit_log_bucket_id
      arn                = module.s3_complete.audit_log_bucket_arn
      object_lock_config = module.s3_complete.audit_log_object_lock_configuration
      lifecycle_config   = module.s3_complete.lifecycle_configuration
    }
  }
}
*/

# Example 5: Dev環境（監査ログバケットなし）
/*
module "s3_dev" {
  source = "../../modules/s3"

  project_name = "myproject"
  environment  = "dev"
  enabled      = true

  buckets = ["uploads", "assets", "temp"]

  # Dev環境では監査ログバケットは作成しない
  enable_audit_log = false

  tags = {
    ManagedBy   = "Terraform"
    Environment = "development"
  }
}
*/

# Example 6: カスタムライフサイクル設定
/*
module "s3_custom_lifecycle" {
  source = "../../modules/s3"

  project_name = "archive-system"
  environment  = "prod"
  enabled      = false

  enable_audit_log = true
  kms_key_arn     = var.kms_key_arn

  # カスタムライフサイクル（早期アーカイブ）
  audit_log_glacier_transition_days      = 30   # 30日でGLACIER
  audit_log_deep_archive_transition_days = 180  # 180日でDEEP_ARCHIVE
  audit_log_retention_years              = 7    # 7年保存

  tags = {
    ManagedBy      = "Terraform"
    ArchiveProfile = "early-transition"
  }
}
*/

# Example 7: アクセスログバケットの作成例
/*
# 先にアクセスログ保存用バケットを作成
resource "aws_s3_bucket" "access_logs" {
  bucket = "myproject-access-logs-prod"

  tags = {
    Name      = "access-logs"
    ManagedBy = "Terraform"
  }
}

resource "aws_s3_bucket_public_access_block" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 監査ログバケットでアクセスログを有効化
module "s3_with_logging" {
  source = "../../modules/s3"

  project_name = "myproject"
  environment  = "prod"
  enabled      = false

  enable_audit_log      = true
  kms_key_arn          = var.kms_key_arn
  enable_access_logging = true
  access_log_bucket_id  = aws_s3_bucket.access_logs.id

  tags = {
    ManagedBy = "Terraform"
  }
}
*/
