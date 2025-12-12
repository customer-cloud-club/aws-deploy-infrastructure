################################################################################
# Secrets Manager Module - Variables
################################################################################

# General Configuration
variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Secret Recovery Configuration
variable "recovery_window_in_days" {
  description = "Number of days to retain secret after deletion (0 to delete immediately, 7-30 for recovery)"
  type        = number
  default     = 30
  validation {
    condition     = var.recovery_window_in_days == 0 || (var.recovery_window_in_days >= 7 && var.recovery_window_in_days <= 30)
    error_message = "Recovery window must be 0 or between 7 and 30 days."
  }
}

# KMS Encryption
variable "kms_key_arn" {
  description = "ARN of KMS key for encrypting secrets (optional, uses default aws/secretsmanager key if not provided)"
  type        = string
  default     = null
}

################################################################################
# Stripe Secrets
################################################################################

variable "stripe_api_key" {
  description = "Stripe API Key (sk_live_xxx or sk_test_xxx)"
  type        = string
  sensitive   = true
  default     = null
  validation {
    condition     = var.stripe_api_key == null || can(regex("^sk_(live|test)_[a-zA-Z0-9]+$", var.stripe_api_key))
    error_message = "Stripe API key must start with sk_live_ or sk_test_."
  }
}

variable "stripe_webhook_secret" {
  description = "Stripe Webhook Secret (whsec_xxx)"
  type        = string
  sensitive   = true
  default     = null
  validation {
    condition     = var.stripe_webhook_secret == null || can(regex("^whsec_[a-zA-Z0-9]+$", var.stripe_webhook_secret))
    error_message = "Stripe webhook secret must start with whsec_."
  }
}

################################################################################
# Aurora Database Credentials
################################################################################

variable "db_username" {
  description = "Aurora PostgreSQL master username"
  type        = string
  sensitive   = true
  default     = null
  validation {
    condition     = var.db_username == null || can(regex("^[a-zA-Z][a-zA-Z0-9_]{0,62}$", var.db_username))
    error_message = "Database username must start with a letter and contain only alphanumeric characters and underscores (max 63 chars)."
  }
}

variable "db_password" {
  description = "Aurora PostgreSQL master password"
  type        = string
  sensitive   = true
  default     = null
  validation {
    condition     = var.db_password == null || can(length(var.db_password) >= 8 && length(var.db_password) <= 128)
    error_message = "Database password must be between 8 and 128 characters."
  }
}

variable "db_host" {
  description = "Aurora PostgreSQL endpoint hostname"
  type        = string
  default     = null
}

variable "db_port" {
  description = "Aurora PostgreSQL port"
  type        = number
  default     = 5432
  validation {
    condition     = var.db_port > 0 && var.db_port <= 65535
    error_message = "Database port must be between 1 and 65535."
  }
}

variable "db_name" {
  description = "Aurora PostgreSQL database name"
  type        = string
  default     = "ccagi"
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]{0,62}$", var.db_name))
    error_message = "Database name must start with a letter and contain only alphanumeric characters and underscores (max 63 chars)."
  }
}

################################################################################
# Redis/ElastiCache Configuration
################################################################################

variable "redis_auth_token" {
  description = "Redis AUTH token for ElastiCache cluster"
  type        = string
  sensitive   = true
  default     = null
  validation {
    condition     = var.redis_auth_token == null || can(length(var.redis_auth_token) >= 16 && length(var.redis_auth_token) <= 128)
    error_message = "Redis AUTH token must be between 16 and 128 characters."
  }
}

################################################################################
# Cognito Configuration
################################################################################

variable "cognito_client_secret" {
  description = "Cognito User Pool Client Secret"
  type        = string
  sensitive   = true
  default     = null
}

################################################################################
# Secret Rotation Configuration
################################################################################

variable "enable_db_rotation" {
  description = "Enable automatic rotation for database credentials"
  type        = bool
  default     = false
}

variable "rotation_lambda_arn" {
  description = "ARN of Lambda function for secret rotation"
  type        = string
  default     = null
}

variable "rotation_days" {
  description = "Number of days between automatic secret rotations"
  type        = number
  default     = 30
  validation {
    condition     = var.rotation_days >= 1 && var.rotation_days <= 365
    error_message = "Rotation days must be between 1 and 365."
  }
}
