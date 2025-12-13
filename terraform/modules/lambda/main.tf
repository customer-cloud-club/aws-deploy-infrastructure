# ============================================================
# Lambda Functions Module - Main Configuration
# ============================================================

# ---------------------------------------------------------
# Security Group for Lambda (VPC enabled functions)
# ---------------------------------------------------------
resource "aws_security_group" "lambda" {
  name_prefix = "${var.project_name}-lambda-"
  description = "Security group for Lambda functions"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name = "${var.project_name}-lambda-sg"
  }
}

# ---------------------------------------------------------
# CloudWatch Log Groups
# ---------------------------------------------------------
resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each = toset([
    "auth-pre-signup",
    "auth-post-confirmation",
    "auth-pre-token",
    "entitlement-check",
    "usage-recorder",
    "webhook-processor",
    "checkout-handler",
    "admin-api"
  ])

  name              = "/aws/lambda/${var.project_name}-${each.key}"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-${each.key}-logs"
  }
}

# ---------------------------------------------------------
# Lambda Function: auth-pre-signup
# Cognito Pre-Signup Trigger (No VPC)
# ---------------------------------------------------------
resource "aws_lambda_function" "auth_pre_signup" {
  function_name = "${var.project_name}-auth-pre-signup"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "dist/functions/auth/pre-signup/handler.handler"
  runtime       = "nodejs20.x"
  timeout       = 10
  memory_size   = 256

  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)

  environment {
    variables = {
      ENVIRONMENT = var.environment
      LOG_LEVEL   = var.log_level
    }
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs,
    aws_iam_role_policy_attachment.lambda_basic_execution
  ]

  tags = {
    Name = "${var.project_name}-auth-pre-signup"
  }
}

resource "aws_lambda_alias" "auth_pre_signup_live" {
  name             = "live"
  description      = "Live alias for auth-pre-signup"
  function_name    = aws_lambda_function.auth_pre_signup.function_name
  function_version = "$LATEST"
}

# ---------------------------------------------------------
# Lambda Function: auth-post-confirmation
# Cognito Post-Confirmation Trigger (VPC enabled)
# ---------------------------------------------------------
resource "aws_lambda_function" "auth_post_confirmation" {
  function_name = "${var.project_name}-auth-post-confirmation"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "dist/functions/auth/post-confirmation/handler.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      RDS_PROXY_ENDPOINT = var.rds_proxy_endpoint
      DB_NAME            = var.db_name
      ENVIRONMENT        = var.environment
      LOG_LEVEL          = var.log_level
    }
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs,
    aws_iam_role_policy_attachment.lambda_vpc_execution,
    aws_iam_role_policy_attachment.lambda_rds_access
  ]

  tags = {
    Name = "${var.project_name}-auth-post-confirmation"
  }
}

resource "aws_lambda_alias" "auth_post_confirmation_live" {
  name             = "live"
  description      = "Live alias for auth-post-confirmation"
  function_name    = aws_lambda_function.auth_post_confirmation.function_name
  function_version = "$LATEST"
}

# ---------------------------------------------------------
# Lambda Function: auth-pre-token
# Cognito Pre-Token Generation (VPC enabled, High concurrency)
# ---------------------------------------------------------
resource "aws_lambda_function" "auth_pre_token" {
  function_name = "${var.project_name}-auth-pre-token"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "dist/functions/auth/pre-token/handler.handler"
  runtime       = "nodejs20.x"
  timeout       = 10
  memory_size   = 512

  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      RDS_PROXY_ENDPOINT = var.rds_proxy_endpoint
      REDIS_URL          = var.redis_endpoint
      DB_NAME            = var.db_name
      ENVIRONMENT        = var.environment
      LOG_LEVEL          = var.log_level
    }
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs,
    aws_iam_role_policy_attachment.lambda_vpc_execution,
    aws_iam_role_policy_attachment.lambda_rds_access,
    aws_iam_role_policy_attachment.lambda_elasticache_access
  ]

  tags = {
    Name = "${var.project_name}-auth-pre-token"
  }
}

resource "aws_lambda_alias" "auth_pre_token_live" {
  name             = "live"
  description      = "Live alias for auth-pre-token"
  function_name    = aws_lambda_function.auth_pre_token.function_name
  function_version = "$LATEST"
}

# ---------------------------------------------------------
# Lambda Function: entitlement-check
# High-traffic entitlement validation (VPC, Provisioned Concurrency)
# ---------------------------------------------------------
resource "aws_lambda_function" "entitlement_check" {
  function_name = "${var.project_name}-entitlement-check"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "dist/functions/entitlement/check/handler.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      RDS_PROXY_ENDPOINT = var.rds_proxy_endpoint
      REDIS_URL          = var.redis_endpoint
      DB_NAME            = var.db_name
      ENVIRONMENT        = var.environment
      LOG_LEVEL          = var.log_level
    }
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs,
    aws_iam_role_policy_attachment.lambda_vpc_execution,
    aws_iam_role_policy_attachment.lambda_rds_access,
    aws_iam_role_policy_attachment.lambda_elasticache_access
  ]

  tags = {
    Name = "${var.project_name}-entitlement-check"
  }
}

resource "aws_lambda_alias" "entitlement_check_live" {
  name             = "live"
  description      = "Live alias for entitlement-check"
  function_name    = aws_lambda_function.entitlement_check.function_name
  function_version = "$LATEST"
}

# NOTE: Provisioned Concurrency requires a published version, not $LATEST
# To enable provisioned concurrency:
# 1. Publish a version: aws_lambda_function.entitlement_check with publish = true
# 2. Update the alias to use the published version
# 3. Uncomment the provisioned concurrency config below
#
# resource "aws_lambda_provisioned_concurrency_config" "entitlement" {
#   function_name                     = aws_lambda_function.entitlement_check.function_name
#   qualifier                         = aws_lambda_alias.entitlement_check_live.name
#   provisioned_concurrent_executions = var.entitlement_provisioned_concurrency
#
#   depends_on = [aws_lambda_alias.entitlement_check_live]
# }

# ---------------------------------------------------------
# Lambda Function: usage-recorder
# Usage event recording (VPC enabled)
# ---------------------------------------------------------
resource "aws_lambda_function" "usage_recorder" {
  function_name = "${var.project_name}-usage-recorder"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "dist/functions/entitlement/usage/handler.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory_size   = 512

  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      RDS_PROXY_ENDPOINT = var.rds_proxy_endpoint
      REDIS_URL          = var.redis_endpoint
      DB_NAME            = var.db_name
      ENVIRONMENT        = var.environment
      LOG_LEVEL          = var.log_level
    }
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs,
    aws_iam_role_policy_attachment.lambda_vpc_execution,
    aws_iam_role_policy_attachment.lambda_rds_access,
    aws_iam_role_policy_attachment.lambda_elasticache_access
  ]

  tags = {
    Name = "${var.project_name}-usage-recorder"
  }
}

resource "aws_lambda_alias" "usage_recorder_live" {
  name             = "live"
  description      = "Live alias for usage-recorder"
  function_name    = aws_lambda_function.usage_recorder.function_name
  function_version = "$LATEST"
}

# ---------------------------------------------------------
# Lambda Function: webhook-processor
# Webhook event processing (VPC enabled)
# ---------------------------------------------------------
resource "aws_lambda_function" "webhook_processor" {
  function_name = "${var.project_name}-webhook-processor"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "dist/functions/billing/webhook/handler.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory_size   = 512

  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      RDS_PROXY_ENDPOINT = var.rds_proxy_endpoint
      DB_NAME            = var.db_name
      STRIPE_WEBHOOK_SECRET_ARN = var.stripe_webhook_secret_arn
      ENVIRONMENT        = var.environment
      LOG_LEVEL          = var.log_level
    }
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs,
    aws_iam_role_policy_attachment.lambda_vpc_execution,
    aws_iam_role_policy_attachment.lambda_rds_access,
    aws_iam_role_policy_attachment.lambda_secrets_access
  ]

  tags = {
    Name = "${var.project_name}-webhook-processor"
  }
}

resource "aws_lambda_alias" "webhook_processor_live" {
  name             = "live"
  description      = "Live alias for webhook-processor"
  function_name    = aws_lambda_function.webhook_processor.function_name
  function_version = "$LATEST"
}

# ---------------------------------------------------------
# Lambda Function: checkout-handler
# Stripe checkout session handling (VPC enabled)
# ---------------------------------------------------------
resource "aws_lambda_function" "checkout_handler" {
  function_name = "${var.project_name}-checkout-handler"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "dist/functions/billing/checkout/handler.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      RDS_PROXY_ENDPOINT = var.rds_proxy_endpoint
      DB_NAME            = var.db_name
      STRIPE_API_KEY_ARN = var.stripe_api_key_arn
      ENVIRONMENT        = var.environment
      LOG_LEVEL          = var.log_level
    }
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs,
    aws_iam_role_policy_attachment.lambda_vpc_execution,
    aws_iam_role_policy_attachment.lambda_rds_access,
    aws_iam_role_policy_attachment.lambda_secrets_access
  ]

  tags = {
    Name = "${var.project_name}-checkout-handler"
  }
}

resource "aws_lambda_alias" "checkout_handler_live" {
  name             = "live"
  description      = "Live alias for checkout-handler"
  function_name    = aws_lambda_function.checkout_handler.function_name
  function_version = "$LATEST"
}

# ---------------------------------------------------------
# Lambda Function: admin-api
# Admin API backend (VPC enabled)
# ---------------------------------------------------------
resource "aws_lambda_function" "admin_api" {
  function_name = "${var.project_name}-admin-api"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "dist/functions/admin/api/handler.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 512

  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      RDS_PROXY_ENDPOINT = var.rds_proxy_endpoint
      REDIS_URL          = var.redis_endpoint
      DB_NAME            = var.db_name
      ENVIRONMENT        = var.environment
      LOG_LEVEL          = var.log_level
    }
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs,
    aws_iam_role_policy_attachment.lambda_vpc_execution,
    aws_iam_role_policy_attachment.lambda_rds_access,
    aws_iam_role_policy_attachment.lambda_elasticache_access
  ]

  tags = {
    Name = "${var.project_name}-admin-api"
  }
}

resource "aws_lambda_alias" "admin_api_live" {
  name             = "live"
  description      = "Live alias for admin-api"
  function_name    = aws_lambda_function.admin_api.function_name
  function_version = "$LATEST"
}

# ---------------------------------------------------------
# Lambda Permissions for Cognito Triggers
# ---------------------------------------------------------
resource "aws_lambda_permission" "cognito_pre_signup" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_pre_signup.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = var.cognito_user_pool_arn
}

resource "aws_lambda_permission" "cognito_post_confirmation" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_post_confirmation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = var.cognito_user_pool_arn
}

resource "aws_lambda_permission" "cognito_pre_token" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_pre_token.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = var.cognito_user_pool_arn
}
