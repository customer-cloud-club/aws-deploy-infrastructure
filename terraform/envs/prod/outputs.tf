# Cognito Outputs
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = module.cognito.user_pool_arn
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = module.cognito.user_pool_client_id
  sensitive   = true
}

output "cognito_user_pool_domain" {
  description = "Cognito User Pool Domain"
  value       = module.cognito.user_pool_domain
}

# Aurora Outputs
output "aurora_cluster_endpoint" {
  description = "Aurora cluster writer endpoint"
  value       = module.aurora.cluster_endpoint
}

output "aurora_cluster_reader_endpoint" {
  description = "Aurora cluster reader endpoint"
  value       = module.aurora.cluster_reader_endpoint
}

output "aurora_cluster_identifier" {
  description = "Aurora cluster identifier"
  value       = module.aurora.cluster_id
}

output "aurora_database_name" {
  description = "Aurora database name"
  value       = module.aurora.cluster_database_name
}

# RDS Proxy Outputs
output "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint"
  value       = module.rds_proxy.proxy_endpoint
}

output "rds_proxy_arn" {
  description = "RDS Proxy ARN"
  value       = module.rds_proxy.proxy_arn
}

# ElastiCache Outputs
output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = module.elasticache.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "ElastiCache Redis reader endpoint"
  value       = module.elasticache.reader_endpoint_address
}

output "redis_port" {
  description = "ElastiCache Redis port"
  value       = module.elasticache.port
}

# WAF Outputs
output "waf_web_acl_id" {
  description = "WAF Web ACL ID for API Gateway"
  value       = module.waf.web_acl_id
}

output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN for API Gateway"
  value       = module.waf.web_acl_arn
}

# Lambda Security Group (used by Serverless Framework)
output "lambda_security_group_id" {
  description = "Lambda security group ID (for Serverless Framework)"
  value       = aws_security_group.lambda_app.id
}

# API Gateway Outputs (Serverless Framework managed)
output "api_gateway_id" {
  description = "API Gateway REST API ID (Serverless managed)"
  value       = data.aws_api_gateway_rest_api.serverless.id
}

output "api_gateway_invoke_url" {
  description = "API Gateway invoke URL (Serverless managed)"
  value       = "https://${data.aws_api_gateway_rest_api.serverless.id}.execute-api.ap-northeast-1.amazonaws.com/${data.aws_api_gateway_stage.serverless.stage_name}"
}

# CloudFront Outputs
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.cloudfront.distribution_domain_name
}

# S3 Outputs
output "s3_audit_bucket_name" {
  description = "S3 audit log bucket name"
  value       = module.s3_audit.audit_log_bucket_id
}

output "s3_audit_bucket_arn" {
  description = "S3 audit log bucket ARN"
  value       = module.s3_audit.audit_log_bucket_arn
}

# Secrets Manager Outputs
output "db_credentials_secret_arn" {
  description = "Database credentials secret ARN"
  value       = module.secrets.db_credentials_secret_arn
  sensitive   = true
}

output "redis_auth_token_secret_arn" {
  description = "Redis auth token secret ARN"
  value       = module.secrets.redis_auth_secret_arn
  sensitive   = true
}

# Network Information
output "vpc_id" {
  description = "VPC ID"
  value       = data.aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = data.aws_subnets.private.ids
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = data.aws_subnets.public.ids
}
