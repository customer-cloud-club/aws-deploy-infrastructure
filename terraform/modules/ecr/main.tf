# ECR Module - コンテナレジストリ
# サービスごとにリポジトリを自動作成

variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "services" {
  type        = list(string)
  description = "List of service names (e.g., ['web', 'api', 'worker'])"
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ECR Repositories
resource "aws_ecr_repository" "services" {
  for_each = toset(var.services)

  name                 = "${local.name_prefix}/${each.key}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name        = "${local.name_prefix}-${each.key}"
    Service     = each.key
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Lifecycle Policy - 30イメージを保持
resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = toset(var.services)
  repository = aws_ecr_repository.services[each.key].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 30 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 30
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Outputs
output "repository_urls" {
  value = { for k, v in aws_ecr_repository.services : k => v.repository_url }
}

output "repository_arns" {
  value = { for k, v in aws_ecr_repository.services : k => v.arn }
}
