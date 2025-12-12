# S3 Audit Log Bucket - Object Lock (WORM) Configuration
# 監査ログバケット - 改ざん防止・10年保存（商法準拠）

# 監査ログバケット（Object Lock有効）
resource "aws_s3_bucket" "audit_log" {
  count = var.enable_audit_log ? 1 : 0

  bucket = "${var.project_name}-audit-log-${var.environment}-${data.aws_caller_identity.current.account_id}"

  # Object Lock must be enabled at bucket creation
  object_lock_enabled = true

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-audit-log-${var.environment}"
      Environment = var.environment
      Purpose     = "audit-log"
      Compliance  = "commercial-law-10years"
    }
  )
}

# Object Lock設定（WORM: Write Once Read Many）
resource "aws_s3_bucket_object_lock_configuration" "audit_log" {
  count = var.enable_audit_log ? 1 : 0

  bucket = aws_s3_bucket.audit_log[0].id

  rule {
    default_retention {
      # GOVERNANCE: 特権ユーザーが削除可能（監査目的）
      # COMPLIANCE: 誰も削除不可（より厳格）
      mode  = var.audit_log_retention_mode
      years = var.audit_log_retention_years
    }
  }
}

# バージョニング設定（Object Lock使用時は必須）
resource "aws_s3_bucket_versioning" "audit_log" {
  count = var.enable_audit_log ? 1 : 0

  bucket = aws_s3_bucket.audit_log[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

# ライフサイクルルール（コスト最適化）
resource "aws_s3_bucket_lifecycle_configuration" "audit_log" {
  count = var.enable_audit_log ? 1 : 0

  bucket = aws_s3_bucket.audit_log[0].id

  rule {
    id     = "archive-old-logs"
    status = "Enabled"

    filter {
      prefix = ""
    }

    # GLACIER移行
    transition {
      days          = var.audit_log_glacier_transition_days
      storage_class = "GLACIER"
    }

    # DEEP_ARCHIVE移行（長期保存・最低コスト）
    transition {
      days          = var.audit_log_deep_archive_transition_days
      storage_class = "DEEP_ARCHIVE"
    }

    # 保存期間満了後に削除
    expiration {
      days = var.audit_log_retention_years * 365
    }
  }

  rule {
    id     = "cleanup-old-noncurrent-versions"
    status = "Enabled"

    filter {
      prefix = ""
    }

    # 非カレントバージョンの管理
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }

    noncurrent_version_transition {
      noncurrent_days = 180
      storage_class   = "DEEP_ARCHIVE"
    }

    noncurrent_version_expiration {
      noncurrent_days = var.audit_log_retention_years * 365
    }
  }
}

# 暗号化設定（KMS使用）
resource "aws_s3_bucket_server_side_encryption_configuration" "audit_log" {
  count = var.enable_audit_log ? 1 : 0

  bucket = aws_s3_bucket.audit_log[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

# パブリックアクセスブロック（セキュリティ強化）
resource "aws_s3_bucket_public_access_block" "audit_log" {
  count = var.enable_audit_log ? 1 : 0

  bucket = aws_s3_bucket.audit_log[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ログ記録設定（監査ログ自体のアクセスログ）
resource "aws_s3_bucket_logging" "audit_log" {
  count = var.enable_audit_log && var.enable_access_logging ? 1 : 0

  bucket = aws_s3_bucket.audit_log[0].id

  target_bucket = var.access_log_bucket_id
  target_prefix = "audit-log-access/"
}

# バケットポリシー（最小権限の原則）
resource "aws_s3_bucket_policy" "audit_log" {
  count = var.enable_audit_log ? 1 : 0

  bucket = aws_s3_bucket.audit_log[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyUnencryptedObjectUploads"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.audit_log[0].arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      },
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.audit_log[0].arn,
          "${aws_s3_bucket.audit_log[0].arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}
