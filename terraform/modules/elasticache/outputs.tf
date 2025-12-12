# ElastiCache (Redis) Module Outputs

output "replication_group_id" {
  description = "ID of the ElastiCache replication group"
  value       = aws_elasticache_replication_group.main.id
}

output "replication_group_arn" {
  description = "ARN of the ElastiCache replication group"
  value       = aws_elasticache_replication_group.main.arn
}

output "configuration_endpoint_address" {
  description = "Configuration endpoint address for Redis cluster (use this for cluster-mode)"
  value       = aws_elasticache_replication_group.main.configuration_endpoint_address
}

output "primary_endpoint_address" {
  description = "Primary endpoint address for Redis"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "reader_endpoint_address" {
  description = "Reader endpoint address for Redis (read replicas)"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "port" {
  description = "Redis port number"
  value       = 6379
}

output "security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}

output "auth_token_secret_arn" {
  description = "ARN of the Secrets Manager secret containing Redis AUTH token"
  value       = aws_secretsmanager_secret.redis_auth_token.arn
}

output "auth_token_secret_name" {
  description = "Name of the Secrets Manager secret containing Redis AUTH token"
  value       = aws_secretsmanager_secret.redis_auth_token.name
}

output "subnet_group_name" {
  description = "Name of the ElastiCache subnet group"
  value       = aws_elasticache_subnet_group.main.name
}

output "parameter_group_name" {
  description = "Name of the ElastiCache parameter group"
  value       = aws_elasticache_parameter_group.main.name
}

# CloudWatch Log Groups
output "slow_log_group_name" {
  description = "Name of the CloudWatch log group for Redis slow logs"
  value       = aws_cloudwatch_log_group.redis_slow_log.name
}

output "engine_log_group_name" {
  description = "Name of the CloudWatch log group for Redis engine logs"
  value       = aws_cloudwatch_log_group.redis_engine_log.name
}

# Connection information (for application configuration)
output "connection_config" {
  description = "Redis connection configuration (use in application)"
  value = {
    endpoint   = aws_elasticache_replication_group.main.configuration_endpoint_address
    port       = 6379
    secret_arn = aws_secretsmanager_secret.redis_auth_token.arn
  }
  sensitive = true
}

# Example usage keys for different purposes
output "usage_examples" {
  description = "Example Redis key patterns for different use cases"
  value = {
    rate_limit      = "ratelimit:{endpoint}:{userId}"
    entitlement     = "entitlement:{userId}:{productId}"
    session_cache   = "session:{sessionId}"
    api_response    = "api:response:{endpoint}:{params_hash}"
    feature_flag    = "feature:{feature_name}:{environment}"
  }
}
