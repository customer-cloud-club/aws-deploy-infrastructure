# CloudFront Module Variables

variable "name" {
  description = "Name of the CloudFront distribution"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "enabled" {
  description = "Whether the CloudFront distribution is enabled"
  type        = bool
  default     = true
}

variable "enable_ipv6" {
  description = "Whether IPv6 is enabled for the distribution"
  type        = bool
  default     = true
}

variable "comment" {
  description = "Comment for the CloudFront distribution"
  type        = string
  default     = ""
}

variable "default_root_object" {
  description = "The object that you want CloudFront to return when a user requests the root URL"
  type        = string
  default     = "index.html"
}

variable "price_class" {
  description = "The price class for this distribution (PriceClass_All, PriceClass_200, PriceClass_100)"
  type        = string
  default     = "PriceClass_100"
}

variable "web_acl_id" {
  description = "AWS WAF Web ACL ID to associate with the distribution"
  type        = string
  default     = null
}

# Origins Configuration
variable "origins" {
  description = "List of origin configurations"
  type = list(object({
    domain_name = string
    origin_id   = string
    origin_path = optional(string)
    custom_origin_config = optional(object({
      http_port                = optional(number)
      https_port               = optional(number)
      origin_protocol_policy   = optional(string)
      origin_ssl_protocols     = optional(list(string))
      origin_keepalive_timeout = optional(number)
      origin_read_timeout      = optional(number)
    }))
    s3_origin_config = optional(object({
      origin_access_identity = string
    }))
    custom_headers = optional(list(object({
      name  = string
      value = string
    })))
  }))
}

variable "default_origin_id" {
  description = "The origin ID for the default cache behavior"
  type        = string
}

# Cache Behavior Configuration
variable "viewer_protocol_policy" {
  description = "The protocol that viewers can use to access files (allow-all, redirect-to-https, https-only)"
  type        = string
  default     = "redirect-to-https"
}

variable "default_allowed_methods" {
  description = "Controls which HTTP methods CloudFront processes and forwards"
  type        = list(string)
  default     = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
}

variable "default_cached_methods" {
  description = "Controls whether CloudFront caches the response to requests using the specified HTTP methods"
  type        = list(string)
  default     = ["GET", "HEAD"]
}

variable "compress" {
  description = "Whether CloudFront automatically compresses content"
  type        = bool
  default     = true
}

variable "forward_query_string" {
  description = "Indicates whether you want CloudFront to forward query strings"
  type        = bool
  default     = false
}

variable "forward_headers" {
  description = "Headers to forward to the origin"
  type        = list(string)
  default     = []
}

variable "forward_cookies" {
  description = "Whether you want CloudFront to forward cookies (none, whitelist, all)"
  type        = string
  default     = "none"
}

variable "forward_cookies_whitelisted_names" {
  description = "List of cookie names to forward"
  type        = list(string)
  default     = []
}

variable "default_min_ttl" {
  description = "The minimum amount of time (in seconds) that you want objects to stay in CloudFront caches"
  type        = number
  default     = 0
}

variable "default_ttl" {
  description = "The default amount of time (in seconds) that an object is in a CloudFront cache"
  type        = number
  default     = 3600
}

variable "default_max_ttl" {
  description = "The maximum amount of time (in seconds) that an object is in a CloudFront cache"
  type        = number
  default     = 86400
}

# Ordered Cache Behaviors
variable "ordered_cache_behaviors" {
  description = "List of ordered cache behaviors"
  type = list(object({
    path_pattern           = string
    target_origin_id       = string
    viewer_protocol_policy = optional(string)
    allowed_methods        = optional(list(string))
    cached_methods         = optional(list(string))
    compress               = optional(bool)
    forward_query_string   = optional(bool)
    forward_headers        = optional(list(string))
    forward_cookies        = optional(string)
    min_ttl                = optional(number)
    default_ttl            = optional(number)
    max_ttl                = optional(number)
    lambda_associations = optional(list(object({
      event_type   = string
      lambda_arn   = string
      include_body = optional(bool)
    })))
  }))
  default = []
}

# Custom Error Responses
variable "custom_error_responses" {
  description = "List of custom error responses"
  type = list(object({
    error_code            = number
    response_code         = optional(number)
    response_page_path    = optional(string)
    error_caching_min_ttl = optional(number)
  }))
  default = []
}

# SSL/TLS Configuration
variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate to use (must be in us-east-1)"
  type        = string
  default     = null
}

variable "minimum_protocol_version" {
  description = "The minimum version of the SSL protocol for HTTPS connections"
  type        = string
  default     = "TLSv1.2_2021"
}

# Restrictions
variable "geo_restriction_type" {
  description = "The method that you want to use to restrict distribution (none, whitelist, blacklist)"
  type        = string
  default     = "none"
}

variable "geo_restriction_locations" {
  description = "ISO 3166-1-alpha-2 country codes for geo restriction"
  type        = list(string)
  default     = []
}

# Logging
variable "enable_logging" {
  description = "Whether to enable access logging"
  type        = bool
  default     = false
}

variable "log_bucket" {
  description = "S3 bucket for access logs (must include .s3.amazonaws.com suffix)"
  type        = string
  default     = ""
}

variable "log_prefix" {
  description = "Prefix for log files in S3 bucket"
  type        = string
  default     = "cloudfront/"
}

variable "log_include_cookies" {
  description = "Whether to include cookies in access logs"
  type        = bool
  default     = false
}

# Aliases
variable "aliases" {
  description = "Extra CNAMEs (alternate domain names) for this distribution"
  type        = list(string)
  default     = []
}

# Origin Access Identity
variable "create_oai" {
  description = "Whether to create an Origin Access Identity for S3"
  type        = bool
  default     = false
}

# Lambda@Edge Authentication
variable "enable_auth" {
  description = "Whether to enable Lambda@Edge authentication"
  type        = bool
  default     = true
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID for JWT verification"
  type        = string
  default     = ""
}

variable "cognito_region" {
  description = "AWS region where Cognito User Pool is located"
  type        = string
  default     = "ap-northeast-1"
}

variable "login_url" {
  description = "URL to redirect unauthenticated users"
  type        = string
  default     = "/login"
}

variable "jwt_secret" {
  description = "JWT secret for token verification (for development only)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "lambda_function_source_dir" {
  description = "Path to Lambda@Edge function source directory"
  type        = string
  default     = "../../../lambda/functions/edge/auth-verifier"
}

# Tags
variable "tags" {
  description = "A map of tags to add to all resources"
  type        = map(string)
  default     = {}
}
