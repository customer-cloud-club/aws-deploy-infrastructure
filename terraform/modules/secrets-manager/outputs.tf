################################################################################
# Secrets Manager Module - Outputs
################################################################################

# Stripe API Key Outputs
output "stripe_api_key_secret_arn" {
  description = "ARN of the Stripe API Key secret"
  value       = aws_secretsmanager_secret.stripe_api_key.arn
}

output "stripe_api_key_secret_id" {
  description = "ID of the Stripe API Key secret"
  value       = aws_secretsmanager_secret.stripe_api_key.id
}

output "stripe_api_key_secret_name" {
  description = "Name of the Stripe API Key secret"
  value       = aws_secretsmanager_secret.stripe_api_key.name
}

# Stripe Webhook Secret Outputs
output "stripe_webhook_secret_arn" {
  description = "ARN of the Stripe Webhook Secret"
  value       = aws_secretsmanager_secret.stripe_webhook_secret.arn
}

output "stripe_webhook_secret_id" {
  description = "ID of the Stripe Webhook Secret"
  value       = aws_secretsmanager_secret.stripe_webhook_secret.id
}

output "stripe_webhook_secret_name" {
  description = "Name of the Stripe Webhook Secret"
  value       = aws_secretsmanager_secret.stripe_webhook_secret.name
}

# Aurora DB Credentials Outputs
output "db_credentials_secret_arn" {
  description = "ARN of the Aurora database credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "db_credentials_secret_id" {
  description = "ID of the Aurora database credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.id
}

output "db_credentials_secret_name" {
  description = "Name of the Aurora database credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.name
}

# Redis AUTH Token Outputs
output "redis_auth_secret_arn" {
  description = "ARN of the Redis AUTH token secret"
  value       = aws_secretsmanager_secret.redis_auth.arn
}

output "redis_auth_secret_id" {
  description = "ID of the Redis AUTH token secret"
  value       = aws_secretsmanager_secret.redis_auth.id
}

output "redis_auth_secret_name" {
  description = "Name of the Redis AUTH token secret"
  value       = aws_secretsmanager_secret.redis_auth.name
}

# Cognito Client Secret Outputs
output "cognito_client_secret_arn" {
  description = "ARN of the Cognito Client Secret"
  value       = aws_secretsmanager_secret.cognito_client_secret.arn
}

output "cognito_client_secret_id" {
  description = "ID of the Cognito Client Secret"
  value       = aws_secretsmanager_secret.cognito_client_secret.id
}

output "cognito_client_secret_name" {
  description = "Name of the Cognito Client Secret"
  value       = aws_secretsmanager_secret.cognito_client_secret.name
}

################################################################################
# IAM Policy Outputs
################################################################################

output "secrets_access_policy_arn" {
  description = "ARN of the IAM policy for accessing secrets"
  value       = aws_iam_policy.secrets_access.arn
}

output "secrets_access_policy_id" {
  description = "ID of the IAM policy for accessing secrets"
  value       = aws_iam_policy.secrets_access.id
}

output "secrets_access_policy_name" {
  description = "Name of the IAM policy for accessing secrets"
  value       = aws_iam_policy.secrets_access.name
}

################################################################################
# All Secret ARNs (for convenience)
################################################################################

output "all_secret_arns" {
  description = "Map of all secret ARNs"
  value = {
    stripe_api_key         = aws_secretsmanager_secret.stripe_api_key.arn
    stripe_webhook_secret  = aws_secretsmanager_secret.stripe_webhook_secret.arn
    db_credentials         = aws_secretsmanager_secret.db_credentials.arn
    redis_auth             = aws_secretsmanager_secret.redis_auth.arn
    cognito_client_secret  = aws_secretsmanager_secret.cognito_client_secret.arn
  }
}

output "all_secret_names" {
  description = "Map of all secret names"
  value = {
    stripe_api_key         = aws_secretsmanager_secret.stripe_api_key.name
    stripe_webhook_secret  = aws_secretsmanager_secret.stripe_webhook_secret.name
    db_credentials         = aws_secretsmanager_secret.db_credentials.name
    redis_auth             = aws_secretsmanager_secret.redis_auth.name
    cognito_client_secret  = aws_secretsmanager_secret.cognito_client_secret.name
  }
}
