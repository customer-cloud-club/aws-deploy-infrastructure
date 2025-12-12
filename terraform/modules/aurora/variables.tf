# ============================================================
# Aurora PostgreSQL Serverless v2 Variables
# ============================================================

variable "project_name" {
  description = "Project name to be used in resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, stg, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "stg", "prod"], var.environment)
    error_message = "Environment must be one of: dev, stg, prod"
  }
}

variable "vpc_id" {
  description = "VPC ID where Aurora cluster will be deployed"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for Aurora cluster (must be in different AZs)"
  type        = list(string)
  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least 2 subnets in different AZs are required for Aurora cluster"
  }
}

variable "app_security_group_id" {
  description = "Security group ID of the application that will access Aurora"
  type        = string
}

# Database Configuration
variable "database_name" {
  description = "Name of the default database to create"
  type        = string
  default     = "miyabi_auth_billing"
}

variable "master_username" {
  description = "Master username for Aurora cluster"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "master_password" {
  description = "Master password for Aurora cluster (should be stored in AWS Secrets Manager)"
  type        = string
  sensitive   = true
}

variable "engine_version" {
  description = "Aurora PostgreSQL engine version"
  type        = string
  default     = "15.8"
}

# Serverless v2 Scaling Configuration
variable "min_capacity" {
  description = "Minimum Aurora Capacity Units (ACU)"
  type        = number
  default     = 0.5
  validation {
    condition     = var.min_capacity >= 0.5 && var.min_capacity <= 128
    error_message = "min_capacity must be between 0.5 and 128 ACU"
  }
}

variable "max_capacity" {
  description = "Maximum Aurora Capacity Units (ACU)"
  type        = number
  default     = 16
  validation {
    condition     = var.max_capacity >= 0.5 && var.max_capacity <= 128
    error_message = "max_capacity must be between 0.5 and 128 ACU"
  }
}

# Encryption
variable "kms_key_arn" {
  description = "ARN of KMS key for encryption"
  type        = string
}

# Backup Configuration
variable "backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
  validation {
    condition     = var.backup_retention_period >= 1 && var.backup_retention_period <= 35
    error_message = "backup_retention_period must be between 1 and 35 days"
  }
}

variable "preferred_backup_window" {
  description = "Preferred backup window (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "preferred_maintenance_window" {
  description = "Preferred maintenance window (UTC)"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

# High Availability
variable "reader_count" {
  description = "Number of read replica instances"
  type        = number
  default     = 1
  validation {
    condition     = var.reader_count >= 0 && var.reader_count <= 15
    error_message = "reader_count must be between 0 and 15"
  }
}

variable "deletion_protection" {
  description = "Enable deletion protection for Aurora cluster"
  type        = bool
  default     = true
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot when destroying cluster (should be false for prod)"
  type        = bool
  default     = false
}

# Performance Insights
variable "performance_insights_enabled" {
  description = "Enable Performance Insights"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "Performance Insights retention period (days)"
  type        = number
  default     = 7
  validation {
    condition     = contains([7, 31, 62, 93, 124, 155, 186, 217, 248, 279, 310, 341, 372, 403, 434, 465, 496, 527, 558, 589, 620, 651, 682, 713, 731], var.performance_insights_retention_period)
    error_message = "performance_insights_retention_period must be 7 or a multiple of 31 up to 731 days"
  }
}

# IAM Database Authentication
variable "iam_database_authentication_enabled" {
  description = "Enable IAM database authentication"
  type        = bool
  default     = true
}

# Auto Minor Version Upgrade
variable "auto_minor_version_upgrade" {
  description = "Enable automatic minor version upgrades"
  type        = bool
  default     = true
}

# Logging
variable "log_retention_days" {
  description = "CloudWatch Logs retention period (days)"
  type        = number
  default     = 30
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "log_retention_days must be one of the valid CloudWatch Logs retention periods"
  }
}

# Monitoring
variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms (optional)"
  type        = string
  default     = null
}

# Tags
variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
