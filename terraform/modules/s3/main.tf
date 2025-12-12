# S3 Module - オブジェクトストレージ
# アップロード、アセット保存用

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

data "aws_caller_identity" "current" {}

# S3 Buckets
resource "aws_s3_bucket" "main" {
  for_each = var.enabled ? toset(var.buckets) : []

  bucket = "${local.name_prefix}-${each.key}-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "${local.name_prefix}-${each.key}"
    Environment = var.environment
    Purpose     = each.key
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "main" {
  for_each = var.enabled ? toset(var.buckets) : []

  bucket = aws_s3_bucket.main[each.key].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  for_each = var.enabled ? toset(var.buckets) : []

  bucket = aws_s3_bucket.main[each.key].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Versioning (for uploads bucket)
resource "aws_s3_bucket_versioning" "uploads" {
  for_each = var.enabled && contains(var.buckets, "uploads") ? toset(["uploads"]) : []

  bucket = aws_s3_bucket.main["uploads"].id

  versioning_configuration {
    status = var.environment == "prod" ? "Enabled" : "Suspended"
  }
}

# Lifecycle rules (cleanup old versions)
resource "aws_s3_bucket_lifecycle_configuration" "main" {
  for_each = var.enabled ? toset(var.buckets) : []

  bucket = aws_s3_bucket.main[each.key].id

  rule {
    id     = "cleanup-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# CORS Configuration (for uploads)
resource "aws_s3_bucket_cors_configuration" "uploads" {
  for_each = var.enabled && contains(var.buckets, "uploads") ? toset(["uploads"]) : []

  bucket = aws_s3_bucket.main["uploads"].id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}
