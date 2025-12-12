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

# VPC (既存を参照または新規作成)
data "aws_vpc" "main" {
  id = var.vpc_id
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }
  filter {
    name   = "tag:Tier"
    values = ["private"]
  }
}

data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }
  filter {
    name   = "tag:Tier"
    values = ["public"]
  }
}

# Lambda Security Group (created first for RDS Proxy dependency)
resource "aws_security_group" "lambda_app" {
  name        = "${local.project_name}-${local.environment}-lambda-app-sg"
  description = "Security group for Lambda functions"
  vpc_id      = data.aws_vpc.main.id

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

  callback_urls = ["http://localhost:3000/callback"]
  logout_urls   = ["http://localhost:3000/logout"]

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
  vpc_id                = data.aws_vpc.main.id
  subnet_ids            = data.aws_subnets.private.ids
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
  vpc_id                = data.aws_vpc.main.id
  subnet_ids            = data.aws_subnets.private.ids
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
  vpc_id       = data.aws_vpc.main.id
  subnet_ids   = data.aws_subnets.private.ids

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

# Lambda Functions
module "lambda" {
  source = "../../modules/lambda"

  project_name       = local.project_name
  environment        = local.environment
  aws_region         = var.aws_region
  aws_account_id     = data.aws_caller_identity.current.account_id
  vpc_id             = data.aws_vpc.main.id
  private_subnet_ids = data.aws_subnets.private.ids
  lambda_zip_path    = "../../../lambda-functions/dist/lambda.zip"

  rds_proxy_endpoint        = module.rds_proxy.proxy_endpoint
  redis_endpoint            = module.elasticache.primary_endpoint_address
  db_name                   = module.aurora.cluster_database_name
  db_credentials_secret_arn = module.secrets.db_credentials_secret_arn
  cognito_user_pool_arn     = module.cognito.user_pool_arn

  stripe_api_key_arn        = module.secrets.stripe_api_key_secret_arn
  stripe_webhook_secret_arn = module.secrets.stripe_webhook_secret_arn
  kms_key_arn               = aws_kms_key.main.arn

  tags = local.common_tags
}

# API Gateway
module "api_gateway" {
  source = "../../modules/api-gateway"

  project_name          = local.project_name
  environment           = "development"
  cognito_user_pool_arn = module.cognito.user_pool_arn
  waf_web_acl_arn       = module.waf.web_acl_arn
  enable_waf            = true

  lambda_function_arns = {
    me_entitlements  = module.lambda.entitlement_check_arn
    me_usage         = module.lambda.usage_recorder_arn
    checkout         = module.lambda.checkout_handler_arn
    stripe_webhook   = module.lambda.webhook_processor_arn
    admin            = module.lambda.admin_api_arn
  }

  lambda_function_names = {
    me_entitlements  = module.lambda.entitlement_check_name
    me_usage         = module.lambda.usage_recorder_name
    checkout         = module.lambda.checkout_handler_name
    stripe_webhook   = module.lambda.webhook_processor_name
    admin            = module.lambda.admin_api_name
  }

  default_throttle_burst_limit = var.apigw_throttle_burst_limit
  default_throttle_rate_limit  = var.apigw_throttle_rate_limit

  tags = local.common_tags
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
      domain_name = replace(module.api_gateway.api_endpoint, "https://", "")
      origin_id   = "api-gateway"
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
  web_acl_id           = module.waf.web_acl_arn

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
