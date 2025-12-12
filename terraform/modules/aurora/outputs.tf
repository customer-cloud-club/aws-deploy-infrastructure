# ============================================================
# Aurora PostgreSQL Serverless v2 Outputs
# ============================================================

# Cluster Information
output "cluster_id" {
  description = "Aurora cluster identifier"
  value       = aws_rds_cluster.main.cluster_identifier
}

output "cluster_arn" {
  description = "Aurora cluster ARN"
  value       = aws_rds_cluster.main.arn
}

output "cluster_endpoint" {
  description = "Writer endpoint for Aurora cluster"
  value       = aws_rds_cluster.main.endpoint
}

output "cluster_reader_endpoint" {
  description = "Reader endpoint for Aurora cluster"
  value       = aws_rds_cluster.main.reader_endpoint
}

output "cluster_port" {
  description = "Aurora cluster port"
  value       = aws_rds_cluster.main.port
}

output "cluster_database_name" {
  description = "Name of the default database"
  value       = aws_rds_cluster.main.database_name
}

output "cluster_master_username" {
  description = "Master username for Aurora cluster"
  value       = aws_rds_cluster.main.master_username
  sensitive   = true
}

output "cluster_resource_id" {
  description = "Aurora cluster resource ID"
  value       = aws_rds_cluster.main.cluster_resource_id
}

output "cluster_hosted_zone_id" {
  description = "Route53 hosted zone ID of the cluster endpoint"
  value       = aws_rds_cluster.main.hosted_zone_id
}

# Instance Information
output "writer_instance_id" {
  description = "Writer instance identifier"
  value       = aws_rds_cluster_instance.writer.identifier
}

output "writer_instance_arn" {
  description = "Writer instance ARN"
  value       = aws_rds_cluster_instance.writer.arn
}

output "writer_instance_endpoint" {
  description = "Writer instance endpoint"
  value       = aws_rds_cluster_instance.writer.endpoint
}

output "reader_instance_ids" {
  description = "Reader instance identifiers"
  value       = [for instance in aws_rds_cluster_instance.reader : instance.identifier]
}

output "reader_instance_arns" {
  description = "Reader instance ARNs"
  value       = [for instance in aws_rds_cluster_instance.reader : instance.arn]
}

output "reader_instance_endpoints" {
  description = "Reader instance endpoints"
  value       = [for instance in aws_rds_cluster_instance.reader : instance.endpoint]
}

# Security Group
output "security_group_id" {
  description = "Security group ID for Aurora cluster"
  value       = aws_security_group.aurora.id
}

output "security_group_arn" {
  description = "Security group ARN for Aurora cluster"
  value       = aws_security_group.aurora.arn
}

# Subnet Group
output "db_subnet_group_name" {
  description = "DB subnet group name"
  value       = aws_db_subnet_group.main.name
}

output "db_subnet_group_arn" {
  description = "DB subnet group ARN"
  value       = aws_db_subnet_group.main.arn
}

# Parameter Groups
output "cluster_parameter_group_name" {
  description = "Cluster parameter group name"
  value       = aws_rds_cluster_parameter_group.main.name
}

output "cluster_parameter_group_arn" {
  description = "Cluster parameter group ARN"
  value       = aws_rds_cluster_parameter_group.main.arn
}

output "db_parameter_group_name" {
  description = "DB parameter group name"
  value       = aws_db_parameter_group.main.name
}

output "db_parameter_group_arn" {
  description = "DB parameter group ARN"
  value       = aws_db_parameter_group.main.arn
}

# CloudWatch Log Group
output "cloudwatch_log_group_name" {
  description = "CloudWatch Log Group name for PostgreSQL logs"
  value       = aws_cloudwatch_log_group.postgresql.name
}

output "cloudwatch_log_group_arn" {
  description = "CloudWatch Log Group ARN for PostgreSQL logs"
  value       = aws_cloudwatch_log_group.postgresql.arn
}

# Connection String Helper
output "connection_string" {
  description = "PostgreSQL connection string (without password)"
  value       = "postgresql://${aws_rds_cluster.main.master_username}@${aws_rds_cluster.main.endpoint}:${aws_rds_cluster.main.port}/${aws_rds_cluster.main.database_name}"
  sensitive   = true
}

# Monitoring
output "cloudwatch_alarm_cpu_id" {
  description = "CloudWatch alarm ID for high CPU"
  value       = aws_cloudwatch_metric_alarm.aurora_cpu.id
}

output "cloudwatch_alarm_capacity_id" {
  description = "CloudWatch alarm ID for high capacity"
  value       = aws_cloudwatch_metric_alarm.aurora_capacity.id
}

output "cloudwatch_alarm_connections_id" {
  description = "CloudWatch alarm ID for high connections"
  value       = aws_cloudwatch_metric_alarm.aurora_connections.id
}

# Encryption
output "kms_key_id" {
  description = "KMS key ID used for encryption"
  value       = aws_rds_cluster.main.kms_key_id
}

# Configuration Details
output "engine_version" {
  description = "Aurora PostgreSQL engine version"
  value       = aws_rds_cluster.main.engine_version
}

output "serverless_min_capacity" {
  description = "Serverless v2 minimum capacity (ACU)"
  value       = aws_rds_cluster.main.serverlessv2_scaling_configuration[0].min_capacity
}

output "serverless_max_capacity" {
  description = "Serverless v2 maximum capacity (ACU)"
  value       = aws_rds_cluster.main.serverlessv2_scaling_configuration[0].max_capacity
}

output "backup_retention_period" {
  description = "Backup retention period in days"
  value       = aws_rds_cluster.main.backup_retention_period
}

output "iam_database_authentication_enabled" {
  description = "Whether IAM database authentication is enabled"
  value       = aws_rds_cluster.main.iam_database_authentication_enabled
}
