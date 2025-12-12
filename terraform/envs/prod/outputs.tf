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
  value       = module.aurora.cluster_identifier
}

output "aurora_database_name" {
  description = "Aurora database name"
  value       = module.aurora.database_name
}

# RDS Proxy Outputs
output "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint"
  value       = module.rds_proxy.endpoint
}

output "rds_proxy_arn" {
  description = "RDS Proxy ARN"
  value       = module.rds_proxy.proxy_arn
}

# ElastiCache Outputs
output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = module.elasticache.endpoint
}

output "redis_reader_endpoint" {
  description = "ElastiCache Redis reader endpoint"
  value       = module.elasticache.reader_endpoint
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

output "waf_cloudfront_web_acl_arn" {
  description = "WAF Web ACL ARN for CloudFront"
  value       = module.waf.cloudfront_web_acl_arn
}

# Lambda Outputs
output "lambda_function_arns" {
  description = "Lambda function ARNs"
  value       = module.lambda.function_arns
}

output "lambda_function_names" {
  description = "Lambda function names"
  value       = module.lambda.function_names
}

# API Gateway Outputs
output "api_gateway_id" {
  description = "API Gateway REST API ID"
  value       = module.api_gateway.api_id
}

output "api_gateway_invoke_url" {
  description = "API Gateway invoke URL"
  value       = module.api_gateway.invoke_url
}

output "api_gateway_stage_name" {
  description = "API Gateway stage name"
  value       = module.api_gateway.stage_name
}

# CloudFront Outputs
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.cloudfront.domain_name
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = module.cloudfront.distribution_arn
}

# S3 Outputs
output "s3_audit_bucket_name" {
  description = "S3 audit log bucket name"
  value       = module.s3_audit.bucket_name
}

output "s3_audit_bucket_arn" {
  description = "S3 audit log bucket ARN"
  value       = module.s3_audit.bucket_arn
}

# Secrets Manager Outputs
output "db_credentials_secret_arn" {
  description = "Database credentials secret ARN"
  value       = module.secrets.db_credentials_arn
  sensitive   = true
}

output "redis_auth_token_secret_arn" {
  description = "Redis auth token secret ARN"
  value       = module.secrets.redis_auth_token_arn
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
