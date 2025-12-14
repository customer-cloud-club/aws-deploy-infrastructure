# ============================================================
# Lambda IAM Roles and Policies
# ============================================================

# ---------------------------------------------------------
# Lambda Execution Role
# ---------------------------------------------------------
resource "aws_iam_role" "lambda_exec" {
  name_prefix = "${var.project_name}-${var.environment}-lambda-exec-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-exec-role"
  }
}

# ---------------------------------------------------------
# Basic Lambda Execution Policy
# ---------------------------------------------------------
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ---------------------------------------------------------
# VPC Execution Policy (for VPC-enabled functions)
# ---------------------------------------------------------
resource "aws_iam_role_policy_attachment" "lambda_vpc_execution" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# ---------------------------------------------------------
# X-Ray Tracing Policy
# ---------------------------------------------------------
resource "aws_iam_role_policy_attachment" "lambda_xray" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# ---------------------------------------------------------
# RDS Access Policy
# ---------------------------------------------------------
resource "aws_iam_policy" "lambda_rds_access" {
  name_prefix = "${var.project_name}-${var.environment}-lambda-rds-"
  description = "Allow Lambda functions to access RDS via RDS Proxy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "rds-db:connect"
        ]
        Resource = [
          "arn:aws:rds-db:${var.aws_region}:${var.aws_account_id}:dbuser:*/*"
        ]
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-rds-policy"
  }
}

resource "aws_iam_role_policy_attachment" "lambda_rds_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_rds_access.arn
}

# ---------------------------------------------------------
# ElastiCache (Redis) Access Policy
# ---------------------------------------------------------
resource "aws_iam_policy" "lambda_elasticache_access" {
  name_prefix = "${var.project_name}-${var.environment}-lambda-elasticache-"
  description = "Allow Lambda functions to access ElastiCache"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "elasticache:DescribeCacheClusters",
          "elasticache:DescribeReplicationGroups"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-elasticache-policy"
  }
}

resource "aws_iam_role_policy_attachment" "lambda_elasticache_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_elasticache_access.arn
}

# ---------------------------------------------------------
# Secrets Manager Access Policy
# ---------------------------------------------------------
resource "aws_iam_policy" "lambda_secrets_access" {
  name_prefix = "${var.project_name}-${var.environment}-lambda-secrets-"
  description = "Allow Lambda functions to access Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          var.stripe_api_key_arn,
          var.stripe_webhook_secret_arn,
          "${var.db_credentials_secret_arn}*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = var.kms_key_arn
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-secrets-policy"
  }
}

resource "aws_iam_role_policy_attachment" "lambda_secrets_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_secrets_access.arn
}

# ---------------------------------------------------------
# CloudWatch Logs Policy (Custom - more restrictive)
# ---------------------------------------------------------
resource "aws_iam_policy" "lambda_logs" {
  name_prefix = "${var.project_name}-${var.environment}-lambda-logs-"
  description = "Allow Lambda functions to write logs to CloudWatch"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/${var.project_name}-*:*"
        ]
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-logs-policy"
  }
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_logs.arn
}

# ---------------------------------------------------------
# Network Interface Management (for VPC Lambda)
# ---------------------------------------------------------
resource "aws_iam_policy" "lambda_eni_management" {
  name_prefix = "${var.project_name}-${var.environment}-lambda-eni-"
  description = "Allow Lambda to manage ENIs in VPC"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "ec2:AssignPrivateIpAddresses",
          "ec2:UnassignPrivateIpAddresses"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-eni-policy"
  }
}

resource "aws_iam_role_policy_attachment" "lambda_eni_management" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_eni_management.arn
}

# ---------------------------------------------------------
# SQS Access Policy (for async processing if needed)
# ---------------------------------------------------------
resource "aws_iam_policy" "lambda_sqs_access" {
  count = var.enable_sqs_integration ? 1 : 0

  name_prefix = "${var.project_name}-${var.environment}-lambda-sqs-"
  description = "Allow Lambda functions to interact with SQS"

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
        Resource = "arn:aws:sqs:${var.aws_region}:${var.aws_account_id}:${var.project_name}-*"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-sqs-policy"
  }
}

resource "aws_iam_role_policy_attachment" "lambda_sqs_access" {
  count = var.enable_sqs_integration ? 1 : 0

  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_sqs_access[0].arn
}

# ---------------------------------------------------------
# SNS Publish Policy (for notifications)
# ---------------------------------------------------------
resource "aws_iam_policy" "lambda_sns_publish" {
  count = var.enable_sns_integration ? 1 : 0

  name_prefix = "${var.project_name}-${var.environment}-lambda-sns-"
  description = "Allow Lambda functions to publish to SNS topics"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = "arn:aws:sns:${var.aws_region}:${var.aws_account_id}:${var.project_name}-*"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-sns-policy"
  }
}

resource "aws_iam_role_policy_attachment" "lambda_sns_publish" {
  count = var.enable_sns_integration ? 1 : 0

  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_sns_publish[0].arn
}
