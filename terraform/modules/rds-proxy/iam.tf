/**
 * RDS Proxy Module - IAM Resources
 *
 * RDS Proxy用IAMロールとポリシー定義
 * - Secrets Managerからの認証情報取得権限
 * - KMS復号化権限
 */

# RDS Proxy用IAMロール
resource "aws_iam_role" "rds_proxy" {
  name               = "${var.project_name}-${var.environment}-rds-proxy-role"
  assume_role_policy = data.aws_iam_policy_document.rds_proxy_assume_role.json

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-rds-proxy-role"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )
}

# RDS Proxyサービスによる引き受け許可
data "aws_iam_policy_document" "rds_proxy_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

# RDS Proxy用IAMポリシー
resource "aws_iam_role_policy" "rds_proxy" {
  name   = "${var.project_name}-${var.environment}-rds-proxy-policy"
  role   = aws_iam_role.rds_proxy.id
  policy = data.aws_iam_policy_document.rds_proxy_policy.json
}

# RDS Proxyに必要な権限
data "aws_iam_policy_document" "rds_proxy_policy" {
  # Secrets Managerからのシークレット取得
  statement {
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret"
    ]
    resources = [var.db_secret_arn]
  }

  # KMS復号化（Secrets Managerが暗号化されている場合）
  statement {
    effect = "Allow"
    actions = [
      "kms:Decrypt",
      "kms:DescribeKey"
    ]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["secretsmanager.${data.aws_region.current.name}.amazonaws.com"]
    }
  }
}

# 現在のAWSアカウント情報取得
data "aws_caller_identity" "current" {}

# 現在のAWSリージョン情報取得
data "aws_region" "current" {}
