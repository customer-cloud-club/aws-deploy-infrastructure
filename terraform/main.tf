# =============================================================================
# AI Platform - 3層コンテナアーキテクチャ Terraform テンプレート
# =============================================================================
#
# 使い方:
# 1. terraform.tfvars を編集してアプリ設定を記述
# 2. terraform init
# 3. terraform plan
# 4. terraform apply
#
# =============================================================================

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # リモートステート（本番運用時は有効化推奨）
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "your-app/terraform.tfstate"
  #   region         = "ap-northeast-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# =============================================================================
# Variables - 開発者が設定する項目
# =============================================================================

variable "aws_region" {
  type        = string
  default     = "ap-northeast-1"
  description = "AWSリージョン"
}

variable "project_name" {
  type        = string
  description = "プロジェクト名（英数字、ハイフンのみ）"
}

variable "environment" {
  type        = string
  description = "環境名: dev, staging, prod"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod"
  }
}

variable "services" {
  type = map(object({
    image         = string
    port          = number
    cpu           = number
    memory        = number
    desired_count = number
    health_check  = string
    path_pattern  = list(string)
    priority      = number
    environment   = map(string)
    command       = list(string)
  }))
  description = "サービス定義"
}

variable "database_enabled" {
  type        = bool
  default     = false
  description = "RDSを有効化するか"
}

variable "database_engine" {
  type        = string
  default     = "postgres"
  description = "Database engine: postgres or mysql"
}

variable "database_instance_class" {
  type        = string
  default     = "db.t3.micro"
  description = "RDSインスタンスクラス"
}

variable "storage_enabled" {
  type        = bool
  default     = false
  description = "S3を有効化するか"
}

variable "storage_buckets" {
  type        = list(string)
  default     = ["uploads", "assets"]
  description = "作成するS3バケットのリスト"
}

variable "certificate_arn" {
  type        = string
  default     = ""
  description = "ACM証明書ARN（HTTPS用、オプション）"
}

# =============================================================================
# Modules
# =============================================================================

# VPC - ネットワーク基盤
module "vpc" {
  source = "./modules/vpc"

  project_name = var.project_name
  environment  = var.environment
}

# ECR - コンテナレジストリ
module "ecr" {
  source = "./modules/ecr"

  project_name = var.project_name
  environment  = var.environment
  services     = keys(var.services)
}

# ALB - ロードバランサー
module "alb" {
  source = "./modules/alb"

  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  certificate_arn   = var.certificate_arn
}

# ECS - コンテナオーケストレーション
module "ecs" {
  source = "./modules/ecs"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  alb_security_group_id = module.alb.alb_security_group_id
  alb_listener_arn      = var.certificate_arn != "" ? module.alb.https_listener_arn : module.alb.http_listener_arn
  services              = var.services
}

# RDS - データベース（オプション）
module "rds" {
  source = "./modules/rds"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  database_subnet_ids   = module.vpc.database_subnet_ids
  ecs_security_group_id = module.ecs.ecs_security_group_id
  enabled               = var.database_enabled
  engine                = var.database_engine
  instance_class        = var.database_instance_class
}

# S3 - オブジェクトストレージ（オプション）
module "s3" {
  source = "./modules/s3"

  project_name = var.project_name
  environment  = var.environment
  enabled      = var.storage_enabled
  buckets      = var.storage_buckets
}

# =============================================================================
# Outputs - デプロイ後に表示される情報
# =============================================================================

output "app_url" {
  value       = "http://${module.alb.alb_dns_name}"
  description = "アプリケーションURL"
}

output "ecr_repositories" {
  value       = module.ecr.repository_urls
  description = "ECRリポジトリURL"
}

output "ecs_cluster_name" {
  value       = module.ecs.cluster_name
  description = "ECSクラスター名"
}

output "database_endpoint" {
  value       = module.rds.endpoint
  description = "データベースエンドポイント"
  sensitive   = true
}

output "database_secret_arn" {
  value       = module.rds.secret_arn
  description = "データベース認証情報のSecret ARN"
}

output "s3_buckets" {
  value       = module.s3.bucket_names
  description = "S3バケット名"
}
