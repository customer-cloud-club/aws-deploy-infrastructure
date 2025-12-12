# ============================================================
# Lambda Module - Variables
# ============================================================

# ---------------------------------------------------------
# General Configuration
# ---------------------------------------------------------
variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
}

# ---------------------------------------------------------
# Network Configuration
# ---------------------------------------------------------
variable "vpc_id" {
  description = "VPC ID for Lambda security group"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for VPC-enabled Lambda functions"
  type        = list(string)
}

# ---------------------------------------------------------
# Lambda Configuration
# ---------------------------------------------------------
variable "lambda_zip_path" {
  description = "Path to Lambda deployment package (ZIP file)"
  type        = string
  default     = "../lambda-functions/dist/lambda.zip"
}

variable "log_level" {
  description = "Log level for Lambda functions (DEBUG, INFO, WARN, ERROR)"
  type        = string
  default     = "INFO"
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention period in days"
  type        = number
  default     = 30
}

# ---------------------------------------------------------
# Concurrency Configuration
# ---------------------------------------------------------
variable "entitlement_provisioned_concurrency" {
  description = "Provisioned concurrency for entitlement-check function"
  type        = number
  default     = 10
}

# ---------------------------------------------------------
# Database Configuration
# ---------------------------------------------------------
variable "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint URL"
  type        = string
}

variable "db_name" {
  description = "Database name"
  type        = string
}

variable "db_credentials_secret_arn" {
  description = "ARN of Secrets Manager secret containing DB credentials"
  type        = string
}

# ---------------------------------------------------------
# Cache Configuration
# ---------------------------------------------------------
variable "redis_endpoint" {
  description = "ElastiCache Redis endpoint URL"
  type        = string
}

# ---------------------------------------------------------
# Cognito Configuration
# ---------------------------------------------------------
variable "cognito_user_pool_arn" {
  description = "ARN of Cognito User Pool for Lambda trigger permissions"
  type        = string
}

# ---------------------------------------------------------
# Secrets Manager Configuration
# ---------------------------------------------------------
variable "stripe_api_key_arn" {
  description = "ARN of Stripe API key in Secrets Manager"
  type        = string
}

variable "stripe_webhook_secret_arn" {
  description = "ARN of Stripe webhook secret in Secrets Manager"
  type        = string
}

variable "kms_key_arn" {
  description = "ARN of KMS key for decrypting secrets"
  type        = string
}

# ---------------------------------------------------------
# Integration Flags
# ---------------------------------------------------------
variable "enable_sqs_integration" {
  description = "Enable SQS integration for Lambda functions"
  type        = bool
  default     = false
}

variable "enable_sns_integration" {
  description = "Enable SNS integration for Lambda functions"
  type        = bool
  default     = false
}

# ---------------------------------------------------------
# Tags
# ---------------------------------------------------------
variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
