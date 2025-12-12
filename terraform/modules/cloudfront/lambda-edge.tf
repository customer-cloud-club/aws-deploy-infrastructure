# Lambda@Edge Function for JWT Authentication
# Note: Lambda@Edge functions must be created in us-east-1 region

# IAM Role for Lambda@Edge
resource "aws_iam_role" "lambda_edge" {
  count = var.enable_auth ? 1 : 0

  name               = "${var.name}-lambda-edge-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_edge_assume_role[0].json

  tags = merge(
    var.tags,
    {
      Name        = "${var.name}-lambda-edge-role"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )
}

# Lambda@Edge Assume Role Policy
data "aws_iam_policy_document" "lambda_edge_assume_role" {
  count = var.enable_auth ? 1 : 0

  statement {
    effect = "Allow"

    principals {
      type = "Service"
      identifiers = [
        "lambda.amazonaws.com",
        "edgelambda.amazonaws.com"
      ]
    }

    actions = ["sts:AssumeRole"]
  }
}

# Lambda@Edge Execution Policy
resource "aws_iam_role_policy_attachment" "lambda_edge_basic" {
  count = var.enable_auth ? 1 : 0

  role       = aws_iam_role.lambda_edge[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Additional policy for CloudWatch Logs in all regions
resource "aws_iam_role_policy" "lambda_edge_logs" {
  count = var.enable_auth ? 1 : 0

  name   = "${var.name}-lambda-edge-logs"
  role   = aws_iam_role.lambda_edge[0].id
  policy = data.aws_iam_policy_document.lambda_edge_logs[0].json
}

data "aws_iam_policy_document" "lambda_edge_logs" {
  count = var.enable_auth ? 1 : 0

  statement {
    effect = "Allow"

    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]

    resources = ["arn:aws:logs:*:*:*"]
  }
}

# Policy for Systems Manager Parameter Store (for Cognito configuration)
resource "aws_iam_role_policy" "lambda_edge_ssm" {
  count = var.enable_auth ? 1 : 0

  name   = "${var.name}-lambda-edge-ssm"
  role   = aws_iam_role.lambda_edge[0].id
  policy = data.aws_iam_policy_document.lambda_edge_ssm[0].json
}

data "aws_iam_policy_document" "lambda_edge_ssm" {
  count = var.enable_auth ? 1 : 0

  statement {
    effect = "Allow"

    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters"
    ]

    resources = [
      "arn:aws:ssm:us-east-1:*:parameter/cloudfront/${var.name}/*"
    ]
  }
}

# Archive Lambda function code
data "archive_file" "lambda_edge" {
  count = var.enable_auth ? 1 : 0

  type        = "zip"
  source_dir  = var.lambda_function_source_dir
  output_path = "${path.module}/.terraform/lambda-edge-auth-verifier.zip"
  excludes = [
    "node_modules",
    "dist",
    "*.md",
    ".git",
    ".gitignore"
  ]
}

# Lambda@Edge Function (must be in us-east-1)
resource "aws_lambda_function" "auth_verifier" {
  count = var.enable_auth ? 1 : 0

  # Lambda@Edge requirement: must be in us-east-1
  provider = aws.us_east_1

  function_name = "${var.name}-auth-verifier"
  description   = "JWT authentication for CloudFront"
  role          = aws_iam_role.lambda_edge[0].arn
  handler       = "handler.handler"
  runtime       = "nodejs20.x"
  timeout       = 5
  memory_size   = 128
  publish       = true # Lambda@Edge requires versioned functions

  filename         = data.archive_file.lambda_edge[0].output_path
  source_code_hash = data.archive_file.lambda_edge[0].output_base64sha256

  environment {
    variables = {
      COGNITO_REGION     = var.cognito_region
      COGNITO_USER_POOL_ID = var.cognito_user_pool_id
      COGNITO_JWKS_URL   = "https://cognito-idp.${var.cognito_region}.amazonaws.com/${var.cognito_user_pool_id}/.well-known/jwks.json"
      COGNITO_ISSUER     = "https://cognito-idp.${var.cognito_region}.amazonaws.com/${var.cognito_user_pool_id}"
      LOGIN_URL          = var.login_url
      JWT_SECRET         = var.jwt_secret
    }
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.name}-auth-verifier"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )
}

# CloudWatch Log Group for Lambda@Edge
# Note: Lambda@Edge creates log groups in multiple regions, but we create one in us-east-1
resource "aws_cloudwatch_log_group" "lambda_edge" {
  count = var.enable_auth ? 1 : 0

  provider = aws.us_east_1

  name              = "/aws/lambda/us-east-1.${aws_lambda_function.auth_verifier[0].function_name}"
  retention_in_days = 7

  tags = merge(
    var.tags,
    {
      Name        = "${var.name}-lambda-edge-logs"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )
}

# Systems Manager Parameters for Cognito Configuration
# These can be accessed by Lambda@Edge at runtime
resource "aws_ssm_parameter" "cognito_jwks_url" {
  count = var.enable_auth ? 1 : 0

  provider = aws.us_east_1

  name        = "/cloudfront/${var.name}/cognito-jwks-url"
  description = "Cognito JWKS URL for JWT verification"
  type        = "String"
  value       = "https://cognito-idp.${var.cognito_region}.amazonaws.com/${var.cognito_user_pool_id}/.well-known/jwks.json"

  tags = merge(
    var.tags,
    {
      Name        = "${var.name}-cognito-jwks-url"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )
}

resource "aws_ssm_parameter" "cognito_issuer" {
  count = var.enable_auth ? 1 : 0

  provider = aws.us_east_1

  name        = "/cloudfront/${var.name}/cognito-issuer"
  description = "Cognito Issuer URL for JWT verification"
  type        = "String"
  value       = "https://cognito-idp.${var.cognito_region}.amazonaws.com/${var.cognito_user_pool_id}"

  tags = merge(
    var.tags,
    {
      Name        = "${var.name}-cognito-issuer"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )
}
