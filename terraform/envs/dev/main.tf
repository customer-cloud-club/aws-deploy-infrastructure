terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "auth-billing-terraform-state"
    key            = "dev/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "auth-billing"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}

# us-east-1 provider for Lambda@Edge
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "auth-billing"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}

locals {
  project_name = "auth-billing"
  environment  = "dev"

  common_tags = {
    Project     = local.project_name
    Environment = local.environment
    ManagedBy   = "terraform"
    CreatedAt   = timestamp()
  }
}

# VPC (新規作成)
module "vpc" {
  source = "../../modules/vpc"

  project_name = local.project_name
  environment  = local.environment
}

# Lambda Security Group (created first for RDS Proxy dependency)
resource "aws_security_group" "lambda_app" {
  name        = "${local.project_name}-${local.environment}-lambda-app-sg"
  description = "Security group for Lambda functions"
  vpc_id      = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.project_name}-${local.environment}-lambda-app-sg"
  })
}

# KMS Key for encryption
resource "aws_kms_key" "main" {
  description             = "${local.project_name}-${local.environment} encryption key"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${local.project_name}-${local.environment}-kms-key"
  })
}

resource "aws_kms_alias" "main" {
  name          = "alias/${local.project_name}-${local.environment}"
  target_key_id = aws_kms_key.main.key_id
}

# Generate master password for Aurora
resource "random_password" "aurora_master" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Cognito User Pool
module "cognito" {
  source = "../../modules/cognito"

  project_name = local.project_name
  environment  = local.environment

  # Cognito Hosted UI domain (required for OAuth login)
  user_pool_domain = "auth-billing-dev"

  # Callback URLs for various apps
  callback_urls = [
    "http://localhost:3000/callback",           # Admin portal
    "http://localhost:3000/api/auth/callback",  # Admin portal API route
    "http://localhost:3000/auth/callback",      # Admin portal client callback
    "http://localhost:3001/callback",           # Sample app
    "http://localhost:3001/api/auth/callback",  # Sample app API route
    "http://localhost:3001/auth/callback",      # Sample app client callback
    "https://d1l1triqc0qles.cloudfront.net/callback"  # CloudFront
  ]

  logout_urls = [
    "http://localhost:3000",                    # Admin portal
    "http://localhost:3000/logout",             # Admin portal logout
    "http://localhost:3001",                    # Sample app
    "http://localhost:3001/logout",             # Sample app logout
    "https://d1l1triqc0qles.cloudfront.net"     # CloudFront
  ]

  # Dev environment settings
  deletion_protection = "INACTIVE"

  tags = local.common_tags
}

# Secrets Manager
module "secrets" {
  source = "../../modules/secrets-manager"

  project_name = local.project_name
  environment  = local.environment

  tags = local.common_tags
}

# Aurora PostgreSQL
module "aurora" {
  source = "../../modules/aurora"

  project_name          = local.project_name
  environment           = local.environment
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.database_subnet_ids
  app_security_group_id = aws_security_group.lambda_app.id
  kms_key_arn           = aws_kms_key.main.arn
  master_password       = random_password.aurora_master.result

  backup_retention_period = var.aurora_backup_retention_period
  preferred_backup_window = var.aurora_preferred_backup_window

  # Dev environment settings
  deletion_protection = false
  skip_final_snapshot = true

  tags = local.common_tags
}

# RDS Proxy
module "rds_proxy" {
  source = "../../modules/rds-proxy"

  project_name          = local.project_name
  environment           = local.environment
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.private_subnet_ids
  db_cluster_identifier = module.aurora.cluster_id
  db_secret_arn         = module.secrets.db_credentials_secret_arn
  app_security_group_id = aws_security_group.lambda_app.id
  rds_security_group_id = module.aurora.security_group_id

  tags = local.common_tags
}

# ElastiCache Redis
module "elasticache" {
  source = "../../modules/elasticache"

  project_name = local.project_name
  environment  = local.environment
  vpc_id       = module.vpc.vpc_id
  subnet_ids   = module.vpc.private_subnet_ids

  allowed_security_group_ids = [aws_security_group.lambda_app.id]

  node_type          = var.redis_node_type
  num_cache_clusters = var.redis_num_cache_nodes

  tags = local.common_tags
}

# WAF Web ACL
module "waf" {
  source = "../../modules/waf"

  project_name = local.project_name
  environment  = local.environment

  general_rate_limit = var.waf_rate_limit
  auth_rate_limit    = 100

  tags = local.common_tags
}

# Data source for AWS account ID
data "aws_caller_identity" "current" {}

# ============================================================
# NOTE: Lambda functions and API Gateway are managed by
# Serverless Framework (see /lambda directory)
#
# Deploy with: cd lambda && npx serverless deploy --stage dev
#
# The following resources are managed by Terraform:
# - VPC, Subnets, Security Groups
# - Aurora PostgreSQL, RDS Proxy
# - ElastiCache Redis
# - Cognito User Pool
# - Secrets Manager
# - CloudFront Distribution
# - WAF, KMS, S3 Audit Logs
# ============================================================

# Data source for Serverless Framework deployed API Gateway
data "aws_api_gateway_rest_api" "serverless" {
  name = "dev-auth-billing"  # Serverless creates: {stage}-{service}
}

# Stage name is fixed by Serverless Framework
locals {
  api_gateway_stage_name = "dev"
}

# CloudFront Distribution with Lambda@Edge
module "cloudfront" {
  source = "../../modules/cloudfront"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name        = "${local.project_name}-${local.environment}"
  environment = local.environment

  origins = [
    {
      # Reference Serverless Framework deployed API Gateway
      domain_name = "${data.aws_api_gateway_rest_api.serverless.id}.execute-api.${var.aws_region}.amazonaws.com"
      origin_id   = "api-gateway"
      origin_path = "/${local.api_gateway_stage_name}"
      custom_origin_config = {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  ]
  default_origin_id = "api-gateway"

  cognito_user_pool_id = module.cognito.user_pool_id

  # WAF for CloudFront requires CLOUDFRONT scope (not REGIONAL)
  # Disable WAF for dev CloudFront - API Gateway still protected by regional WAF
  web_acl_id = null

  # Disable Lambda@Edge auth in dev (requires SSM-based config for production)
  enable_auth = false

  price_class = var.cloudfront_price_class
  enable_ipv6 = var.cloudfront_enable_ipv6

  tags = local.common_tags
}

# S3 Audit Log Bucket
module "s3_audit" {
  source = "../../modules/s3"

  project_name = local.project_name
  environment  = local.environment

  enable_audit_log                       = true
  kms_key_arn                            = aws_kms_key.main.arn
  audit_log_glacier_transition_days      = var.s3_audit_lifecycle_days
  audit_log_deep_archive_transition_days = 365

  tags = local.common_tags
}
