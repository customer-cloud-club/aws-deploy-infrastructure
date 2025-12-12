# ============================================================
# Aurora PostgreSQL Serverless v2 Module - Usage Examples
# ============================================================
# This file contains example configurations for different environments.
# DO NOT apply this file directly - copy the relevant example to your
# environment-specific configuration.
# ============================================================

# ------------------------------------------------------
# Example 1: Production Environment
# ------------------------------------------------------
/*
module "aurora_prod" {
  source = "../../modules/aurora"

  project_name = "miyabi"
  environment  = "prod"

  # Network Configuration
  vpc_id                = "vpc-0123456789abcdef0"
  subnet_ids            = ["subnet-0123456789abcdef0", "subnet-0123456789abcdef1"]
  app_security_group_id = "sg-0123456789abcdef0"

  # Database Configuration
  database_name   = "miyabi_auth_billing"
  master_username = "postgres"
  master_password = data.aws_secretsmanager_secret_version.db_password_prod.secret_string

  # Aurora PostgreSQL Version
  engine_version = "15.4"

  # Serverless v2 Scaling Configuration
  min_capacity = 0.5  # Minimum 0.5 ACU
  max_capacity = 16   # Maximum 16 ACU

  # Encryption
  kms_key_arn = "arn:aws:kms:ap-northeast-1:123456789012:key/abcd1234-ab12-cd34-ef56-abcdef123456"

  # Backup Configuration
  backup_retention_period      = 7
  preferred_backup_window      = "03:00-04:00"        # JST 12:00-13:00
  preferred_maintenance_window = "sun:04:00-sun:05:00" # JST Sun 13:00-14:00

  # High Availability
  reader_count = 1 # 1 read replica for production

  # Security
  deletion_protection                 = true  # Enable for production
  skip_final_snapshot                 = false # Create final snapshot
  iam_database_authentication_enabled = true

  # Performance Insights
  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  # Monitoring
  alarm_sns_topic_arn = "arn:aws:sns:ap-northeast-1:123456789012:aurora-alerts-prod"
  log_retention_days  = 30

  # Auto Minor Version Upgrade
  auto_minor_version_upgrade = true

  tags = {
    Project     = "miyabi"
    Environment = "prod"
    ManagedBy   = "terraform"
    CostCenter  = "platform"
    Owner       = "platform-team"
  }
}

# Secrets Manager for Database Password
data "aws_secretsmanager_secret_version" "db_password_prod" {
  secret_id = "miyabi/prod/aurora/master-password"
}

# Outputs for use in other modules
output "aurora_prod_endpoint" {
  description = "Aurora production cluster writer endpoint"
  value       = module.aurora_prod.cluster_endpoint
}

output "aurora_prod_reader_endpoint" {
  description = "Aurora production cluster reader endpoint"
  value       = module.aurora_prod.cluster_reader_endpoint
}

output "aurora_prod_security_group_id" {
  description = "Aurora production security group ID"
  value       = module.aurora_prod.security_group_id
}
*/

# ------------------------------------------------------
# Example 2: Staging Environment
# ------------------------------------------------------
/*
module "aurora_stg" {
  source = "../../modules/aurora"

  project_name = "miyabi"
  environment  = "stg"

  # Network Configuration
  vpc_id                = "vpc-0123456789abcdef0"
  subnet_ids            = ["subnet-0123456789abcdef0", "subnet-0123456789abcdef1"]
  app_security_group_id = "sg-0123456789abcdef0"

  # Database Configuration
  database_name   = "miyabi_auth_billing_stg"
  master_username = "postgres"
  master_password = data.aws_secretsmanager_secret_version.db_password_stg.secret_string

  engine_version = "15.4"

  # Staging uses smaller scale
  min_capacity = 0.5
  max_capacity = 8

  kms_key_arn = "arn:aws:kms:ap-northeast-1:123456789012:key/abcd1234-ab12-cd34-ef56-abcdef123456"

  # Backup Configuration (shorter retention for staging)
  backup_retention_period      = 3
  preferred_backup_window      = "03:00-04:00"
  preferred_maintenance_window = "sun:04:00-sun:05:00"

  # Staging typically doesn't need read replica
  reader_count = 0

  # Security (less strict for staging)
  deletion_protection                 = false # Allow deletion in staging
  skip_final_snapshot                 = true  # Skip final snapshot
  iam_database_authentication_enabled = true

  # Performance Insights
  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  # Monitoring
  alarm_sns_topic_arn = "arn:aws:sns:ap-northeast-1:123456789012:aurora-alerts-stg"
  log_retention_days  = 14

  auto_minor_version_upgrade = true

  tags = {
    Project     = "miyabi"
    Environment = "stg"
    ManagedBy   = "terraform"
    CostCenter  = "platform"
  }
}

data "aws_secretsmanager_secret_version" "db_password_stg" {
  secret_id = "miyabi/stg/aurora/master-password"
}
*/

# ------------------------------------------------------
# Example 3: Development Environment
# ------------------------------------------------------
/*
module "aurora_dev" {
  source = "../../modules/aurora"

  project_name = "miyabi"
  environment  = "dev"

  # Network Configuration
  vpc_id                = "vpc-0123456789abcdef0"
  subnet_ids            = ["subnet-0123456789abcdef0", "subnet-0123456789abcdef1"]
  app_security_group_id = "sg-0123456789abcdef0"

  # Database Configuration
  database_name   = "miyabi_dev"
  master_username = "postgres"
  master_password = var.db_password_dev # Can use variable for dev

  engine_version = "15.4"

  # Development uses minimal resources
  min_capacity = 0.5
  max_capacity = 2

  kms_key_arn = "arn:aws:kms:ap-northeast-1:123456789012:key/abcd1234-ab12-cd34-ef56-abcdef123456"

  # Minimal backup for dev
  backup_retention_period      = 1
  preferred_backup_window      = "03:00-04:00"
  preferred_maintenance_window = "sun:04:00-sun:05:00"

  # No read replica for dev
  reader_count = 0

  # Security (relaxed for dev)
  deletion_protection                 = false
  skip_final_snapshot                 = true
  iam_database_authentication_enabled = false # Simpler auth for dev

  # Performance Insights (optional for dev)
  performance_insights_enabled          = false
  performance_insights_retention_period = 7

  # Monitoring (optional for dev)
  alarm_sns_topic_arn = null # No alarms in dev
  log_retention_days  = 7

  auto_minor_version_upgrade = true

  tags = {
    Project     = "miyabi"
    Environment = "dev"
    ManagedBy   = "terraform"
    AutoStop    = "true" # Tag for automatic stop/start
  }
}

variable "db_password_dev" {
  description = "Database password for development environment"
  type        = string
  sensitive   = true
}
*/

# ------------------------------------------------------
# Example 4: High-Performance Production with Multiple Readers
# ------------------------------------------------------
/*
module "aurora_prod_high_perf" {
  source = "../../modules/aurora"

  project_name = "miyabi"
  environment  = "prod"

  vpc_id                = "vpc-0123456789abcdef0"
  subnet_ids            = ["subnet-0123456789abcdef0", "subnet-0123456789abcdef1", "subnet-0123456789abcdef2"]
  app_security_group_id = "sg-0123456789abcdef0"

  database_name   = "miyabi_auth_billing"
  master_username = "postgres"
  master_password = data.aws_secretsmanager_secret_version.db_password_prod.secret_string

  engine_version = "15.4"

  # Higher capacity for high-performance workload
  min_capacity = 2
  max_capacity = 64

  kms_key_arn = "arn:aws:kms:ap-northeast-1:123456789012:key/abcd1234-ab12-cd34-ef56-abcdef123456"

  backup_retention_period      = 14 # Longer retention
  preferred_backup_window      = "03:00-04:00"
  preferred_maintenance_window = "sun:04:00-sun:05:00"

  # Multiple read replicas for read-heavy workload
  reader_count = 3

  deletion_protection                 = true
  skip_final_snapshot                 = false
  iam_database_authentication_enabled = true

  # Extended Performance Insights retention
  performance_insights_enabled          = true
  performance_insights_retention_period = 31

  alarm_sns_topic_arn = "arn:aws:sns:ap-northeast-1:123456789012:aurora-alerts-prod"
  log_retention_days  = 90 # Longer log retention

  auto_minor_version_upgrade = true

  tags = {
    Project      = "miyabi"
    Environment  = "prod"
    ManagedBy    = "terraform"
    CostCenter   = "platform"
    Performance  = "high"
    Compliance   = "pci-dss"
    BackupPolicy = "extended"
  }
}
*/

# ------------------------------------------------------
# Example 5: Cost-Optimized Development Environment
# ------------------------------------------------------
/*
module "aurora_dev_cost_optimized" {
  source = "../../modules/aurora"

  project_name = "miyabi"
  environment  = "dev"

  vpc_id                = "vpc-0123456789abcdef0"
  subnet_ids            = ["subnet-0123456789abcdef0", "subnet-0123456789abcdef1"]
  app_security_group_id = "sg-0123456789abcdef0"

  database_name   = "miyabi_dev"
  master_username = "postgres"
  master_password = "ChangeMe123!" # Use proper secret management

  engine_version = "15.4"

  # Minimal capacity for cost optimization
  min_capacity = 0.5
  max_capacity = 1

  kms_key_arn = "arn:aws:kms:ap-northeast-1:123456789012:key/abcd1234-ab12-cd34-ef56-abcdef123456"

  # Minimal backup
  backup_retention_period      = 1
  preferred_backup_window      = "03:00-04:00"
  preferred_maintenance_window = "sun:04:00-sun:05:00"

  # No read replica
  reader_count = 0

  deletion_protection                 = false
  skip_final_snapshot                 = true
  iam_database_authentication_enabled = false

  # Disable expensive features
  performance_insights_enabled = false

  alarm_sns_topic_arn = null
  log_retention_days  = 3 # Minimum retention

  auto_minor_version_upgrade = true

  tags = {
    Project         = "miyabi"
    Environment     = "dev"
    ManagedBy       = "terraform"
    CostOptimized   = "true"
    AutoShutdown    = "enabled"
    ShutdownSchedule = "weekends"
  }
}
*/

# ------------------------------------------------------
# Helper: Creating Database Password in Secrets Manager
# ------------------------------------------------------
/*
# First, create a random password
resource "random_password" "aurora_master" {
  length  = 32
  special = true
  # Exclude characters that might cause issues
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Store in Secrets Manager
resource "aws_secretsmanager_secret" "aurora_master_password" {
  name                    = "miyabi/${var.environment}/aurora/master-password"
  description             = "Aurora PostgreSQL master password for ${var.environment}"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = {
    Project     = "miyabi"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_secretsmanager_secret_version" "aurora_master_password" {
  secret_id     = aws_secretsmanager_secret.aurora_master_password.id
  secret_string = random_password.aurora_master.result
}

# Use the secret in Aurora module
module "aurora" {
  source = "../../modules/aurora"

  # ... other configuration ...

  master_password = aws_secretsmanager_secret_version.aurora_master_password.secret_string
}
*/

# ------------------------------------------------------
# Helper: Connection String Construction
# ------------------------------------------------------
/*
# Application configuration with Aurora connection details
locals {
  aurora_connection_config = {
    host     = module.aurora_prod.cluster_endpoint
    port     = module.aurora_prod.cluster_port
    database = module.aurora_prod.cluster_database_name
    username = module.aurora_prod.cluster_master_username
    # Password should be retrieved from Secrets Manager at runtime

    # Read-only connection
    read_host = module.aurora_prod.cluster_reader_endpoint

    # Connection pool settings (recommended)
    max_connections     = 100
    min_connections     = 10
    connection_timeout  = 30
    idle_timeout        = 300
    max_lifetime        = 1800

    # SSL configuration
    ssl_mode            = "require"
    ssl_root_cert       = "/etc/ssl/certs/amazon-rds-ca-cert.pem"
  }
}

# Export as SSM parameters for application use
resource "aws_ssm_parameter" "aurora_endpoint" {
  name        = "/miyabi/prod/aurora/endpoint"
  description = "Aurora cluster writer endpoint"
  type        = "String"
  value       = module.aurora_prod.cluster_endpoint

  tags = {
    Project     = "miyabi"
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}

resource "aws_ssm_parameter" "aurora_reader_endpoint" {
  name        = "/miyabi/prod/aurora/reader-endpoint"
  description = "Aurora cluster reader endpoint"
  type        = "String"
  value       = module.aurora_prod.cluster_reader_endpoint

  tags = {
    Project     = "miyabi"
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}
*/
