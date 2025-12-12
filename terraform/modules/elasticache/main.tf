# ElastiCache (Redis) Module
# Redis cluster for rate limiting, entitlement cache, and session cache

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# Security Group for ElastiCache Redis
resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-redis-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from application"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.name_prefix}-redis-sg"
    Environment = var.environment
  }
}

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis-subnet"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "${local.name_prefix}-redis-subnet"
    Environment = var.environment
  }
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "main" {
  name   = "${local.name_prefix}-redis-params"
  family = var.parameter_group_family

  # Optimize for rate limiting and caching
  parameter {
    name  = "maxmemory-policy"
    value = var.maxmemory_policy
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  tags = {
    Name        = "${local.name_prefix}-redis-params"
    Environment = var.environment
  }
}

# Random AUTH token for Redis
resource "random_password" "redis_auth_token" {
  length  = 32
  special = false # AUTH token cannot contain special characters
}

# Secrets Manager for Redis AUTH token
resource "aws_secretsmanager_secret" "redis_auth_token" {
  name                    = "${local.name_prefix}/redis-auth-token"
  recovery_window_in_days = var.environment == "prod" ? 7 : 0

  tags = {
    Name        = "${local.name_prefix}-redis-auth-token"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id = aws_secretsmanager_secret.redis_auth_token.id
  secret_string = jsonencode({
    auth_token = var.auth_token != "" ? var.auth_token : random_password.redis_auth_token.result
    endpoint   = aws_elasticache_replication_group.main.configuration_endpoint_address
    port       = 6379
  })
}

# ElastiCache Replication Group (Redis Cluster)
resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "${local.name_prefix}-redis"
  description                = "Redis for rate limiting, entitlement cache, and session cache"
  node_type                  = var.node_type
  port                       = 6379

  # Engine configuration
  engine                     = "redis"
  engine_version             = var.engine_version
  parameter_group_name       = aws_elasticache_parameter_group.main.name

  # Cluster configuration
  num_cache_clusters         = var.num_cache_clusters
  automatic_failover_enabled = var.num_cache_clusters > 1 ? true : false
  multi_az_enabled           = var.multi_az_enabled

  # Network configuration
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis.id]

  # Security configuration
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.auth_token != "" ? var.auth_token : random_password.redis_auth_token.result
  auth_token_update_strategy = "ROTATE"

  # Backup configuration
  snapshot_retention_limit   = var.snapshot_retention_limit
  snapshot_window            = var.snapshot_window
  maintenance_window         = var.maintenance_window

  # Auto-upgrade
  auto_minor_version_upgrade = var.auto_minor_version_upgrade

  # CloudWatch logs
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_engine_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
  }

  tags = {
    Name        = "${local.name_prefix}-redis"
    Environment = var.environment
    Purpose     = "Rate-limiting/entitlement-cache/session-cache"
  }

  lifecycle {
    prevent_destroy = false # Set to true in production
  }
}

# CloudWatch Log Groups for Redis logs
resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/${local.name_prefix}-redis/slow-log"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${local.name_prefix}-redis-slow-log"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "redis_engine_log" {
  name              = "/aws/elasticache/${local.name_prefix}-redis/engine-log"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${local.name_prefix}-redis-engine-log"
    Environment = var.environment
  }
}

# CloudWatch Alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "cpu_utilization" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${local.name_prefix}-redis-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = var.cpu_utilization_threshold
  alarm_description   = "Redis CPU utilization is too high"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main.id
  }

  tags = {
    Name        = "${local.name_prefix}-redis-cpu-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "database_memory_usage" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${local.name_prefix}-redis-memory-usage"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = var.memory_usage_threshold
  alarm_description   = "Redis memory usage is too high"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main.id
  }

  tags = {
    Name        = "${local.name_prefix}-redis-memory-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "evictions" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${local.name_prefix}-redis-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = 1000
  alarm_description   = "Redis evictions are occurring"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main.id
  }

  tags = {
    Name        = "${local.name_prefix}-redis-evictions-alarm"
    Environment = var.environment
  }
}
