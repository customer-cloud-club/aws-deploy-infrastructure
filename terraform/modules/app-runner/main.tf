# ==============================================================================
# AWS App Runner Module
# ==============================================================================
# シンプルなコンテナアプリを App Runner にデプロイ
# GitHub連携またはECRイメージからの自動デプロイに対応
# ==============================================================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

# ------------------------------------------------------------------------------
# Variables
# ------------------------------------------------------------------------------

variable "project_name" {
  description = "プロジェクト名"
  type        = string
}

variable "environment" {
  description = "環境名 (dev/staging/prod)"
  type        = string
}

variable "source_type" {
  description = "ソースタイプ (ecr/github)"
  type        = string
  default     = "ecr"
  validation {
    condition     = contains(["ecr", "github"], var.source_type)
    error_message = "source_type must be 'ecr' or 'github'"
  }
}

# ECR設定
variable "ecr_repository_url" {
  description = "ECRリポジトリURL"
  type        = string
  default     = ""
}

variable "image_tag" {
  description = "イメージタグ"
  type        = string
  default     = "latest"
}

# GitHub設定
variable "github_repository_url" {
  description = "GitHubリポジトリURL"
  type        = string
  default     = ""
}

variable "github_branch" {
  description = "デプロイするブランチ"
  type        = string
  default     = "main"
}

variable "github_connection_arn" {
  description = "GitHub接続のARN"
  type        = string
  default     = ""
}

# アプリケーション設定
variable "port" {
  description = "アプリケーションポート"
  type        = number
  default     = 8080
}

variable "cpu" {
  description = "vCPU (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 1024
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.cpu)
    error_message = "cpu must be 256, 512, 1024, 2048, or 4096"
  }
}

variable "memory" {
  description = "メモリ (MB: 512, 1024, 2048, 3072, 4096, 6144, 8192, 10240, 12288)"
  type        = number
  default     = 2048
}

variable "environment_variables" {
  description = "環境変数"
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "シークレット (Secrets Manager/SSM Parameter Store)"
  type = map(object({
    name  = string
    value = string
  }))
  default = {}
}

variable "health_check_path" {
  description = "ヘルスチェックパス"
  type        = string
  default     = "/health"
}

variable "health_check_interval" {
  description = "ヘルスチェック間隔（秒）"
  type        = number
  default     = 10
}

variable "health_check_timeout" {
  description = "ヘルスチェックタイムアウト（秒）"
  type        = number
  default     = 5
}

variable "health_check_healthy_threshold" {
  description = "正常判定に必要な連続成功回数"
  type        = number
  default     = 1
}

variable "health_check_unhealthy_threshold" {
  description = "異常判定に必要な連続失敗回数"
  type        = number
  default     = 5
}

# オートスケール設定
variable "min_size" {
  description = "最小インスタンス数"
  type        = number
  default     = 1
}

variable "max_size" {
  description = "最大インスタンス数"
  type        = number
  default     = 10
}

variable "max_concurrency" {
  description = "1インスタンスあたりの最大同時リクエスト数"
  type        = number
  default     = 100
}

# ネットワーク設定
variable "is_publicly_accessible" {
  description = "パブリックアクセスを許可するか"
  type        = bool
  default     = true
}

variable "vpc_connector_arn" {
  description = "VPCコネクタのARN（プライベートリソースアクセス用）"
  type        = string
  default     = ""
}

variable "egress_type" {
  description = "Egress設定 (DEFAULT/VPC)"
  type        = string
  default     = "DEFAULT"
}

# 自動デプロイ設定
variable "auto_deployments_enabled" {
  description = "自動デプロイを有効にするか"
  type        = bool
  default     = true
}

variable "tags" {
  description = "追加タグ"
  type        = map(string)
  default     = {}
}

# ------------------------------------------------------------------------------
# Locals
# ------------------------------------------------------------------------------

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  default_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Module      = "app-runner"
  }

  tags = merge(local.default_tags, var.tags)
}

# ------------------------------------------------------------------------------
# IAM Role for App Runner
# ------------------------------------------------------------------------------

# App Runner インスタンスロール
resource "aws_iam_role" "instance_role" {
  name = "${local.name_prefix}-apprunner-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "tasks.apprunner.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

# Bedrock アクセスポリシー
resource "aws_iam_role_policy" "bedrock_access" {
  name = "${local.name_prefix}-bedrock-access"
  role = aws_iam_role.instance_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = "*"
      }
    ]
  })
}

# Secrets Manager アクセスポリシー
resource "aws_iam_role_policy" "secrets_access" {
  count = length(var.secrets) > 0 ? 1 : 0
  name  = "${local.name_prefix}-secrets-access"
  role  = aws_iam_role.instance_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = "*"
      }
    ]
  })
}

# S3 アクセスポリシー
resource "aws_iam_role_policy" "s3_access" {
  name = "${local.name_prefix}-s3-access"
  role = aws_iam_role.instance_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = "*"
      }
    ]
  })
}

# DynamoDB アクセスポリシー
resource "aws_iam_role_policy" "dynamodb_access" {
  name = "${local.name_prefix}-dynamodb-access"
  role = aws_iam_role.instance_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = "*"
      }
    ]
  })
}

# SQS アクセスポリシー
resource "aws_iam_role_policy" "sqs_access" {
  name = "${local.name_prefix}-sqs-access"
  role = aws_iam_role.instance_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = "*"
      }
    ]
  })
}

# ECR アクセスロール
resource "aws_iam_role" "access_role" {
  count = var.source_type == "ecr" ? 1 : 0
  name  = "${local.name_prefix}-apprunner-access-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "build.apprunner.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "access_role_ecr" {
  count      = var.source_type == "ecr" ? 1 : 0
  role       = aws_iam_role.access_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# ------------------------------------------------------------------------------
# App Runner Service
# ------------------------------------------------------------------------------

resource "aws_apprunner_service" "main" {
  service_name = "${local.name_prefix}-service"

  # ソース設定
  source_configuration {
    auto_deployments_enabled = var.auto_deployments_enabled

    # ECR イメージソース
    dynamic "image_repository" {
      for_each = var.source_type == "ecr" ? [1] : []
      content {
        image_identifier      = "${var.ecr_repository_url}:${var.image_tag}"
        image_repository_type = "ECR"
        image_configuration {
          port                          = tostring(var.port)
          runtime_environment_variables = var.environment_variables

          dynamic "runtime_environment_secrets" {
            for_each = var.secrets
            content {
              name  = runtime_environment_secrets.value.name
              value = runtime_environment_secrets.value.value
            }
          }
        }
      }
    }

    # GitHub ソース
    dynamic "code_repository" {
      for_each = var.source_type == "github" ? [1] : []
      content {
        repository_url = var.github_repository_url
        source_code_version {
          type  = "BRANCH"
          value = var.github_branch
        }
        code_configuration {
          configuration_source = "API"
          code_configuration_values {
            runtime                       = "PYTHON_3"
            port                          = tostring(var.port)
            runtime_environment_variables = var.environment_variables
            build_command                 = "pip install -r requirements.txt"
            start_command                 = "python main.py"
          }
        }
      }
    }

    # 認証設定
    dynamic "authentication_configuration" {
      for_each = var.source_type == "ecr" ? [1] : []
      content {
        access_role_arn = aws_iam_role.access_role[0].arn
      }
    }

    dynamic "authentication_configuration" {
      for_each = var.source_type == "github" ? [1] : []
      content {
        connection_arn = var.github_connection_arn
      }
    }
  }

  # インスタンス設定
  instance_configuration {
    cpu               = tostring(var.cpu)
    memory            = tostring(var.memory)
    instance_role_arn = aws_iam_role.instance_role.arn
  }

  # ヘルスチェック設定
  health_check_configuration {
    protocol            = "HTTP"
    path                = var.health_check_path
    interval            = var.health_check_interval
    timeout             = var.health_check_timeout
    healthy_threshold   = var.health_check_healthy_threshold
    unhealthy_threshold = var.health_check_unhealthy_threshold
  }

  # オートスケール設定
  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.main.arn

  # ネットワーク設定
  network_configuration {
    egress_configuration {
      egress_type       = var.egress_type
      vpc_connector_arn = var.vpc_connector_arn != "" ? var.vpc_connector_arn : null
    }
    ingress_configuration {
      is_publicly_accessible = var.is_publicly_accessible
    }
  }

  tags = local.tags
}

# オートスケール設定
resource "aws_apprunner_auto_scaling_configuration_version" "main" {
  auto_scaling_configuration_name = "${local.name_prefix}-autoscaling"

  min_size        = var.min_size
  max_size        = var.max_size
  max_concurrency = var.max_concurrency

  tags = local.tags
}

# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------

output "service_id" {
  description = "App Runner サービスID"
  value       = aws_apprunner_service.main.id
}

output "service_arn" {
  description = "App Runner サービスARN"
  value       = aws_apprunner_service.main.arn
}

output "service_url" {
  description = "App Runner サービスURL"
  value       = "https://${aws_apprunner_service.main.service_url}"
}

output "service_status" {
  description = "App Runner サービスステータス"
  value       = aws_apprunner_service.main.status
}

output "instance_role_arn" {
  description = "インスタンスロールARN"
  value       = aws_iam_role.instance_role.arn
}
