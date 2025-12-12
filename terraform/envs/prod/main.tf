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
    key            = "prod/terraform.tfstate"
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
      Environment = "prod"
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
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}

locals {
  project_name = "auth-billing"
  environment  = "prod"

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

# Cognito User Pool
module "cognito" {
  source = "../../modules/cognito"

  project_name = local.project_name
  environment  = local.environment

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

  project_name  = local.project_name
  environment   = local.environment
  vpc_id        = data.aws_vpc.main.id
  subnet_ids    = data.aws_subnets.private.ids
  db_secret_arn = module.secrets.db_credentials_arn

  instance_count = var.aurora_instance_count
  instance_class = var.aurora_instance_class

  backup_retention_period = var.aurora_backup_retention_period
  preferred_backup_window = var.aurora_preferred_backup_window

  tags = local.common_tags
}

# RDS Proxy
module "rds_proxy" {
  source = "../../modules/rds-proxy"

  project_name          = local.project_name
  environment           = local.environment
  vpc_id                = data.aws_vpc.main.id
  subnet_ids            = data.aws_subnets.private.ids
  db_cluster_identifier = module.aurora.cluster_identifier
  db_cluster_endpoint   = module.aurora.cluster_endpoint
  db_secret_arn         = module.secrets.db_credentials_arn

  tags = local.common_tags
}

# ElastiCache Redis
module "elasticache" {
  source = "../../modules/elasticache"

  project_name = local.project_name
  environment  = local.environment
  vpc_id       = data.aws_vpc.main.id
  subnet_ids   = data.aws_subnets.private.ids

  node_type          = var.redis_node_type
  num_cache_nodes    = var.redis_num_cache_nodes
  auth_token_enabled = true

  tags = local.common_tags
}

# WAF Web ACL
module "waf" {
  source = "../../modules/waf"

  project_name = local.project_name
  environment  = local.environment

  rate_limit          = var.waf_rate_limit
  enable_geo_blocking = var.waf_enable_geo_blocking
  allowed_countries   = var.waf_allowed_countries

  tags = local.common_tags
}

# Lambda Functions
module "lambda" {
  source = "../../modules/lambda"

  project_name       = local.project_name
  environment        = local.environment
  vpc_id             = data.aws_vpc.main.id
  private_subnet_ids = data.aws_subnets.private.ids

  rds_proxy_endpoint   = module.rds_proxy.endpoint
  redis_endpoint       = module.elasticache.endpoint
  cognito_user_pool_id = module.cognito.user_pool_id

  runtime     = var.lambda_runtime
  timeout     = var.lambda_timeout
  memory_size = var.lambda_memory_size

  tags = local.common_tags
}

# API Gateway
module "api_gateway" {
  source = "../../modules/api-gateway"

  project_name          = local.project_name
  environment           = local.environment
  cognito_user_pool_arn = module.cognito.user_pool_arn
  waf_web_acl_arn       = module.waf.web_acl_arn
  lambda_functions      = module.lambda.function_arns

  throttle_burst_limit = var.apigw_throttle_burst_limit
  throttle_rate_limit  = var.apigw_throttle_rate_limit

  tags = local.common_tags
}

# CloudFront Distribution with Lambda@Edge
module "cloudfront" {
  source = "../../modules/cloudfront"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  project_name         = local.project_name
  environment          = local.environment
  cognito_user_pool_id = module.cognito.user_pool_id
  waf_web_acl_arn      = module.waf.cloudfront_web_acl_arn
  api_gateway_domain   = module.api_gateway.invoke_url

  price_class = var.cloudfront_price_class
  enable_ipv6 = var.cloudfront_enable_ipv6

  tags = local.common_tags
}

# S3 Audit Log Bucket
module "s3_audit" {
  source = "../../modules/s3"

  project_name = local.project_name
  environment  = local.environment

  bucket_name_prefix = "audit-logs"
  enable_versioning  = true
  enable_encryption  = true
  lifecycle_days     = var.s3_audit_lifecycle_days

  tags = local.common_tags
}
