################################################################################
# Secrets Manager Module - Secret Definitions
################################################################################

# Stripe API Key
resource "aws_secretsmanager_secret" "stripe_api_key" {
  name        = "${var.project_name}/stripe/api-key"
  description = "Stripe API Key for payment processing"

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-stripe-api-key"
      ManagedBy   = "Terraform"
      SecretType  = "StripeAPIKey"
      Environment = var.environment
    }
  )
}

resource "aws_secretsmanager_secret_version" "stripe_api_key" {
  count = var.stripe_api_key != null ? 1 : 0

  secret_id     = aws_secretsmanager_secret.stripe_api_key.id
  secret_string = var.stripe_api_key
}

# Stripe Webhook Secret
resource "aws_secretsmanager_secret" "stripe_webhook_secret" {
  name        = "${var.project_name}/stripe/webhook-secret"
  description = "Stripe Webhook Secret for signature verification"

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-stripe-webhook-secret"
      ManagedBy   = "Terraform"
      SecretType  = "StripeWebhook"
      Environment = var.environment
    }
  )
}

resource "aws_secretsmanager_secret_version" "stripe_webhook_secret" {
  count = var.stripe_webhook_secret != null ? 1 : 0

  secret_id     = aws_secretsmanager_secret.stripe_webhook_secret.id
  secret_string = var.stripe_webhook_secret
}

# Aurora DB Credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${var.project_name}/aurora/credentials"
  description = "Aurora PostgreSQL master credentials"

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-aurora-credentials"
      ManagedBy   = "Terraform"
      SecretType  = "DatabaseCredentials"
      Environment = var.environment
    }
  )
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  count = var.db_username != null && var.db_password != null ? 1 : 0

  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
    engine   = "postgres"
    host     = var.db_host
    port     = var.db_port
    dbname   = var.db_name
  })
}

# Redis AUTH Token
resource "aws_secretsmanager_secret" "redis_auth" {
  name        = "${var.project_name}/redis/auth-token"
  description = "Redis AUTH token for ElastiCache cluster"

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-redis-auth-token"
      ManagedBy   = "Terraform"
      SecretType  = "RedisAuthToken"
      Environment = var.environment
    }
  )
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  count = var.redis_auth_token != null ? 1 : 0

  secret_id     = aws_secretsmanager_secret.redis_auth.id
  secret_string = var.redis_auth_token
}

# Cognito Client Secret
resource "aws_secretsmanager_secret" "cognito_client_secret" {
  name        = "${var.project_name}/cognito/client-secret"
  description = "Cognito User Pool Client Secret"

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-cognito-client-secret"
      ManagedBy   = "Terraform"
      SecretType  = "CognitoClientSecret"
      Environment = var.environment
    }
  )
}

resource "aws_secretsmanager_secret_version" "cognito_client_secret" {
  count = var.cognito_client_secret != null ? 1 : 0

  secret_id     = aws_secretsmanager_secret.cognito_client_secret.id
  secret_string = var.cognito_client_secret
}

################################################################################
# Secret Rotation (Optional)
################################################################################

# Aurora DB Credentials Rotation
resource "aws_secretsmanager_secret_rotation" "db_credentials" {
  count = var.enable_db_rotation ? 1 : 0

  secret_id           = aws_secretsmanager_secret.db_credentials.id
  rotation_lambda_arn = var.rotation_lambda_arn

  rotation_rules {
    automatically_after_days = var.rotation_days
  }
}

################################################################################
# IAM Policy for Secret Access
################################################################################

data "aws_iam_policy_document" "secrets_access" {
  statement {
    sid    = "AllowSecretsAccess"
    effect = "Allow"

    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret"
    ]

    resources = [
      aws_secretsmanager_secret.stripe_api_key.arn,
      aws_secretsmanager_secret.stripe_webhook_secret.arn,
      aws_secretsmanager_secret.db_credentials.arn,
      aws_secretsmanager_secret.redis_auth.arn,
      aws_secretsmanager_secret.cognito_client_secret.arn,
    ]
  }

  statement {
    sid    = "AllowKMSDecrypt"
    effect = "Allow"

    actions = [
      "kms:Decrypt",
      "kms:DescribeKey"
    ]

    resources = var.kms_key_arn != null ? [var.kms_key_arn] : []
  }
}

resource "aws_iam_policy" "secrets_access" {
  name        = "${var.project_name}-secrets-access-policy"
  description = "IAM policy for accessing Secrets Manager secrets"
  policy      = data.aws_iam_policy_document.secrets_access.json

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-secrets-access-policy"
    }
  )
}
