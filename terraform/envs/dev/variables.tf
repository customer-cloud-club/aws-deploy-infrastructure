# General Variables
variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-northeast-1"
}

# Aurora Variables
variable "aurora_instance_count" {
  description = "Number of Aurora instances"
  type        = number
  default     = 2
}

variable "aurora_instance_class" {
  description = "Aurora instance class"
  type        = string
  default     = "db.r6g.large"
}

variable "aurora_backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "aurora_preferred_backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

# ElastiCache Redis Variables
variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 2
}

# WAF Variables
variable "waf_rate_limit" {
  description = "WAF rate limit per 5 minutes"
  type        = number
  default     = 2000
}

variable "waf_enable_geo_blocking" {
  description = "Enable geographic restriction"
  type        = bool
  default     = false
}

variable "waf_allowed_countries" {
  description = "List of allowed country codes"
  type        = list(string)
  default     = ["JP", "US"]
}

# Lambda Variables
variable "lambda_runtime" {
  description = "Lambda runtime version"
  type        = string
  default     = "python3.11"
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30
}

variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 512
}

# API Gateway Variables
variable "apigw_throttle_burst_limit" {
  description = "API Gateway throttle burst limit"
  type        = number
  default     = 5000
}

variable "apigw_throttle_rate_limit" {
  description = "API Gateway throttle rate limit"
  type        = number
  default     = 10000
}

# CloudFront Variables
variable "cloudfront_price_class" {
  description = "CloudFront distribution price class"
  type        = string
  default     = "PriceClass_All"
}

variable "cloudfront_enable_ipv6" {
  description = "Enable IPv6 for CloudFront distribution"
  type        = bool
  default     = true
}

# S3 Variables
variable "s3_audit_lifecycle_days" {
  description = "Number of days before archiving audit logs to Glacier"
  type        = number
  default     = 90
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
