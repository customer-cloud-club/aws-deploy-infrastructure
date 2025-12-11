# RDS Module - PostgreSQL/MySQL
# オプション: 必要な場合のみ有効化

variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "database_subnet_ids" {
  type = list(string)
}

variable "ecs_security_group_id" {
  type = string
}

variable "enabled" {
  type    = bool
  default = false
}

variable "engine" {
  type        = string
  default     = "postgres"
  description = "Database engine: postgres or mysql"
}

variable "engine_version" {
  type    = string
  default = "15.4"
}

variable "instance_class" {
  type    = string
  default = "db.t3.micro"
}

variable "allocated_storage" {
  type    = number
  default = 20
}

variable "database_name" {
  type    = string
  default = "app"
}

variable "master_username" {
  type    = string
  default = "admin"
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# Security Group for RDS
resource "aws_security_group" "rds" {
  count       = var.enabled ? 1 : 0
  name        = "${local.name_prefix}-rds-sg"
  description = "Security group for RDS"
  vpc_id      = var.vpc_id

  ingress {
    description     = "From ECS"
    from_port       = var.engine == "postgres" ? 5432 : 3306
    to_port         = var.engine == "postgres" ? 5432 : 3306
    protocol        = "tcp"
    security_groups = [var.ecs_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-rds-sg"
  }
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  count      = var.enabled ? 1 : 0
  name       = "${local.name_prefix}-db-subnet"
  subnet_ids = var.database_subnet_ids

  tags = {
    Name = "${local.name_prefix}-db-subnet"
  }
}

# Random password for RDS
resource "random_password" "rds" {
  count   = var.enabled ? 1 : 0
  length  = 32
  special = false
}

# Secrets Manager for RDS credentials
resource "aws_secretsmanager_secret" "rds" {
  count                   = var.enabled ? 1 : 0
  name                    = "${local.name_prefix}/rds-credentials"
  recovery_window_in_days = var.environment == "prod" ? 7 : 0

  tags = {
    Name = "${local.name_prefix}-rds-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "rds" {
  count     = var.enabled ? 1 : 0
  secret_id = aws_secretsmanager_secret.rds[0].id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.rds[0].result
    engine   = var.engine
    host     = aws_db_instance.main[0].endpoint
    port     = var.engine == "postgres" ? 5432 : 3306
    dbname   = var.database_name
  })
}

# RDS Instance
resource "aws_db_instance" "main" {
  count = var.enabled ? 1 : 0

  identifier = "${local.name_prefix}-db"

  engine            = var.engine
  engine_version    = var.engine_version
  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.database_name
  username = var.master_username
  password = random_password.rds[0].result

  db_subnet_group_name   = aws_db_subnet_group.main[0].name
  vpc_security_group_ids = [aws_security_group.rds[0].id]

  multi_az               = var.environment == "prod" ? true : false
  publicly_accessible    = false
  deletion_protection    = var.environment == "prod" ? true : false
  skip_final_snapshot    = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${local.name_prefix}-final-snapshot" : null

  backup_retention_period = var.environment == "prod" ? 7 : 1
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  performance_insights_enabled = var.environment == "prod" ? true : false

  tags = {
    Name        = "${local.name_prefix}-db"
    Environment = var.environment
  }
}

# Outputs
output "endpoint" {
  value = var.enabled ? aws_db_instance.main[0].endpoint : ""
}

output "database_name" {
  value = var.enabled ? aws_db_instance.main[0].db_name : ""
}

output "secret_arn" {
  value = var.enabled ? aws_secretsmanager_secret.rds[0].arn : ""
}

output "security_group_id" {
  value = var.enabled ? aws_security_group.rds[0].id : ""
}
