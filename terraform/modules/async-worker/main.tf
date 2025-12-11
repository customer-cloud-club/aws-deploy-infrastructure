# ==============================================================================
# Async Worker Module (SQS + Lambda/Fargate)
# ==============================================================================
# RAG/LLM処理など時間のかかる非同期ジョブを処理するためのモジュール
# - SQS キュー
# - Lambda ワーカー (最大15分) または Fargate ワーカー (時間無制限)
# - DynamoDB ジョブストア
# - デッドレターキュー (DLQ)
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

variable "worker_type" {
  description = "ワーカータイプ (lambda/fargate)"
  type        = string
  default     = "lambda"
  validation {
    condition     = contains(["lambda", "fargate"], var.worker_type)
    error_message = "worker_type must be 'lambda' or 'fargate'"
  }
}

# SQS設定
variable "queue_visibility_timeout" {
  description = "SQSメッセージの可視性タイムアウト（秒）"
  type        = number
  default     = 900 # 15分
}

variable "queue_message_retention" {
  description = "メッセージ保持期間（秒）"
  type        = number
  default     = 1209600 # 14日
}

variable "queue_max_receive_count" {
  description = "DLQに移動するまでの最大受信回数"
  type        = number
  default     = 3
}

# Lambda設定
variable "lambda_runtime" {
  description = "Lambdaランタイム"
  type        = string
  default     = "python3.12"
}

variable "lambda_handler" {
  description = "Lambdaハンドラー"
  type        = string
  default     = "handler.lambda_handler"
}

variable "lambda_timeout" {
  description = "Lambdaタイムアウト（秒、最大900）"
  type        = number
  default     = 900
}

variable "lambda_memory" {
  description = "Lambdaメモリ（MB）"
  type        = number
  default     = 1024
}

variable "lambda_code_path" {
  description = "Lambdaコードのパス（ZIPまたはS3）"
  type        = string
  default     = ""
}

variable "lambda_s3_bucket" {
  description = "Lambda コードの S3 バケット"
  type        = string
  default     = ""
}

variable "lambda_s3_key" {
  description = "Lambda コードの S3 キー"
  type        = string
  default     = ""
}

# Fargate設定
variable "fargate_cpu" {
  description = "Fargate vCPU"
  type        = number
  default     = 1024
}

variable "fargate_memory" {
  description = "Fargate メモリ (MB)"
  type        = number
  default     = 2048
}

variable "fargate_image" {
  description = "Fargate コンテナイメージ"
  type        = string
  default     = ""
}

variable "fargate_desired_count" {
  description = "Fargate タスク数"
  type        = number
  default     = 1
}

# VPC設定（Fargate用）
variable "vpc_id" {
  description = "VPC ID"
  type        = string
  default     = ""
}

variable "subnet_ids" {
  description = "サブネットID一覧"
  type        = list(string)
  default     = []
}

variable "security_group_ids" {
  description = "セキュリティグループID一覧"
  type        = list(string)
  default     = []
}

# 環境変数
variable "environment_variables" {
  description = "環境変数"
  type        = map(string)
  default     = {}
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
    Module      = "async-worker"
  }

  tags = merge(local.default_tags, var.tags)

  # Lambda用の環境変数にDynamoDBテーブル名を追加
  lambda_env_vars = merge(var.environment_variables, {
    JOB_TABLE_NAME = aws_dynamodb_table.jobs.name
    QUEUE_URL      = aws_sqs_queue.main.url
  })
}

# ------------------------------------------------------------------------------
# SQS Queues
# ------------------------------------------------------------------------------

# メインキュー
resource "aws_sqs_queue" "main" {
  name                       = "${local.name_prefix}-job-queue"
  visibility_timeout_seconds = var.queue_visibility_timeout
  message_retention_seconds  = var.queue_message_retention

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = var.queue_max_receive_count
  })

  tags = local.tags
}

# デッドレターキュー
resource "aws_sqs_queue" "dlq" {
  name                      = "${local.name_prefix}-job-dlq"
  message_retention_seconds = 1209600 # 14日

  tags = local.tags
}

# SQS キューポリシー
resource "aws_sqs_queue_policy" "main" {
  queue_url = aws_sqs_queue.main.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = "*"
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.main.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = "*"
          }
        }
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# DynamoDB Job Store
# ------------------------------------------------------------------------------

resource "aws_dynamodb_table" "jobs" {
  name         = "${local.name_prefix}-jobs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "job_id"

  attribute {
    name = "job_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  # ユーザーごとのジョブ検索用GSI
  global_secondary_index {
    name            = "user-jobs-index"
    hash_key        = "user_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  # ステータスごとのジョブ検索用GSI
  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  # TTL設定（完了後30日で自動削除）
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = local.tags
}

# ------------------------------------------------------------------------------
# Lambda Worker
# ------------------------------------------------------------------------------

# Lambda 実行ロール
resource "aws_iam_role" "lambda" {
  count = var.worker_type == "lambda" ? 1 : 0
  name  = "${local.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

# Lambda 基本ポリシー
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  count      = var.worker_type == "lambda" ? 1 : 0
  role       = aws_iam_role.lambda[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda カスタムポリシー
resource "aws_iam_role_policy" "lambda_custom" {
  count = var.worker_type == "lambda" ? 1 : 0
  name  = "${local.name_prefix}-lambda-policy"
  role  = aws_iam_role.lambda[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # SQS アクセス
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.main.arn
      },
      # DynamoDB アクセス
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.jobs.arn,
          "${aws_dynamodb_table.jobs.arn}/index/*"
        ]
      },
      # Bedrock アクセス
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = "*"
      },
      # S3 アクセス
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "*"
      },
      # Secrets Manager アクセス
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "*"
      }
    ]
  })
}

# Lambda 関数（コードがある場合のみ作成）
resource "aws_lambda_function" "worker" {
  count         = var.worker_type == "lambda" && var.lambda_s3_bucket != "" ? 1 : 0
  function_name = "${local.name_prefix}-worker"
  role          = aws_iam_role.lambda[0].arn

  s3_bucket = var.lambda_s3_bucket
  s3_key    = var.lambda_s3_key

  runtime = var.lambda_runtime
  handler = var.lambda_handler
  timeout = var.lambda_timeout
  memory_size = var.lambda_memory

  environment {
    variables = local.lambda_env_vars
  }

  tags = local.tags
}

# Lambda SQS トリガー
resource "aws_lambda_event_source_mapping" "sqs" {
  count            = var.worker_type == "lambda" && var.lambda_s3_bucket != "" ? 1 : 0
  event_source_arn = aws_sqs_queue.main.arn
  function_name    = aws_lambda_function.worker[0].arn
  batch_size       = 1
}

# ------------------------------------------------------------------------------
# Fargate Worker (ECS)
# ------------------------------------------------------------------------------

# ECS クラスター
resource "aws_ecs_cluster" "worker" {
  count = var.worker_type == "fargate" ? 1 : 0
  name  = "${local.name_prefix}-worker-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.tags
}

# ECS タスク実行ロール
resource "aws_iam_role" "ecs_execution" {
  count = var.worker_type == "fargate" ? 1 : 0
  name  = "${local.name_prefix}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  count      = var.worker_type == "fargate" ? 1 : 0
  role       = aws_iam_role.ecs_execution[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECS タスクロール
resource "aws_iam_role" "ecs_task" {
  count = var.worker_type == "fargate" ? 1 : 0
  name  = "${local.name_prefix}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "ecs_task" {
  count = var.worker_type == "fargate" ? 1 : 0
  name  = "${local.name_prefix}-ecs-task-policy"
  role  = aws_iam_role.ecs_task[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # SQS アクセス
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.main.arn
      },
      # DynamoDB アクセス
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.jobs.arn,
          "${aws_dynamodb_table.jobs.arn}/index/*"
        ]
      },
      # Bedrock アクセス
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = "*"
      },
      # S3 アクセス
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "*"
      }
    ]
  })
}

# ECS タスク定義
resource "aws_ecs_task_definition" "worker" {
  count                    = var.worker_type == "fargate" && var.fargate_image != "" ? 1 : 0
  family                   = "${local.name_prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_memory
  execution_role_arn       = aws_iam_role.ecs_execution[0].arn
  task_role_arn            = aws_iam_role.ecs_task[0].arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = var.fargate_image
      essential = true
      environment = [
        for k, v in local.lambda_env_vars : {
          name  = k
          value = v
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${local.name_prefix}-worker"
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "worker"
        }
      }
    }
  ])

  tags = local.tags
}

# CloudWatch Logs
resource "aws_cloudwatch_log_group" "worker" {
  count             = var.worker_type == "fargate" ? 1 : 0
  name              = "/ecs/${local.name_prefix}-worker"
  retention_in_days = 30

  tags = local.tags
}

# ECS サービス
resource "aws_ecs_service" "worker" {
  count           = var.worker_type == "fargate" && var.fargate_image != "" ? 1 : 0
  name            = "${local.name_prefix}-worker"
  cluster         = aws_ecs_cluster.worker[0].id
  task_definition = aws_ecs_task_definition.worker[0].arn
  desired_count   = var.fargate_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = false
  }

  tags = local.tags
}

# 現在のリージョン取得
data "aws_region" "current" {}

# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------

output "queue_url" {
  description = "SQS キューURL"
  value       = aws_sqs_queue.main.url
}

output "queue_arn" {
  description = "SQS キューARN"
  value       = aws_sqs_queue.main.arn
}

output "dlq_url" {
  description = "DLQ URL"
  value       = aws_sqs_queue.dlq.url
}

output "dlq_arn" {
  description = "DLQ ARN"
  value       = aws_sqs_queue.dlq.arn
}

output "job_table_name" {
  description = "DynamoDB ジョブテーブル名"
  value       = aws_dynamodb_table.jobs.name
}

output "job_table_arn" {
  description = "DynamoDB ジョブテーブルARN"
  value       = aws_dynamodb_table.jobs.arn
}

output "lambda_function_name" {
  description = "Lambda 関数名"
  value       = var.worker_type == "lambda" && var.lambda_s3_bucket != "" ? aws_lambda_function.worker[0].function_name : ""
}

output "lambda_function_arn" {
  description = "Lambda 関数ARN"
  value       = var.worker_type == "lambda" && var.lambda_s3_bucket != "" ? aws_lambda_function.worker[0].arn : ""
}

output "ecs_cluster_name" {
  description = "ECS クラスター名"
  value       = var.worker_type == "fargate" ? aws_ecs_cluster.worker[0].name : ""
}

output "ecs_service_name" {
  description = "ECS サービス名"
  value       = var.worker_type == "fargate" && var.fargate_image != "" ? aws_ecs_service.worker[0].name : ""
}
