# CloudFront Module Usage Examples
# This file contains example configurations for different use cases

# Example 1: Basic CloudFront with ALB Origin and Lambda@Edge Auth
/*
module "cloudfront_basic" {
  source = "./modules/cloudfront"

  name        = "my-app"
  environment = "prod"

  origins = [
    {
      domain_name = aws_lb.main.dns_name
      origin_id   = "alb"
      custom_origin_config = {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  ]

  default_origin_id = "alb"

  # Lambda@Edge Authentication
  enable_auth          = true
  cognito_user_pool_id = aws_cognito_user_pool.main.id
  cognito_region       = "ap-northeast-1"
  login_url            = "/login"

  # SSL/TLS
  acm_certificate_arn      = aws_acm_certificate.main.arn
  aliases                  = ["app.example.com"]
  minimum_protocol_version = "TLSv1.2_2021"

  # Cache settings
  forward_cookies  = "all"
  forward_headers  = ["Authorization", "Host", "CloudFront-Viewer-Country"]
  default_min_ttl  = 0
  default_ttl      = 3600
  default_max_ttl  = 86400

  tags = {
    Project = "MyApp"
    Owner   = "Platform Team"
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
*/

# Example 2: Static Website with S3 Origin (No Auth)
/*
module "cloudfront_static" {
  source = "./modules/cloudfront"

  name        = "static-website"
  environment = "prod"

  create_oai = true

  origins = [
    {
      domain_name = aws_s3_bucket.static.bucket_regional_domain_name
      origin_id   = "s3"
      s3_origin_config = {
        origin_access_identity = module.cloudfront_static.origin_access_identity_path
      }
    }
  ]

  default_origin_id   = "s3"
  default_root_object = "index.html"

  # No authentication for static site
  enable_auth = false

  # Aggressive caching for static content
  forward_query_string = false
  forward_cookies      = "none"
  default_min_ttl      = 0
  default_ttl          = 86400    # 1 day
  default_max_ttl      = 31536000 # 1 year

  compress = true

  # Custom error pages
  custom_error_responses = [
    {
      error_code         = 404
      response_code      = 200
      response_page_path = "/index.html"
      error_caching_min_ttl = 300
    },
    {
      error_code         = 403
      response_code      = 200
      response_page_path = "/index.html"
      error_caching_min_ttl = 300
    }
  ]

  # SSL
  acm_certificate_arn = aws_acm_certificate.static.arn
  aliases             = ["www.example.com"]

  tags = {
    Project = "StaticSite"
    Type    = "Website"
  }
}
*/

# Example 3: Multi-Origin with Path-Based Routing
/*
module "cloudfront_multi_origin" {
  source = "./modules/cloudfront"

  name        = "multi-origin-app"
  environment = "prod"

  create_oai = true

  # Multiple origins
  origins = [
    # API Origin (ALB)
    {
      domain_name = aws_lb.api.dns_name
      origin_id   = "api"
      custom_origin_config = {
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    },
    # Static Assets (S3)
    {
      domain_name = aws_s3_bucket.static.bucket_regional_domain_name
      origin_id   = "static"
      s3_origin_config = {
        origin_access_identity = module.cloudfront_multi_origin.origin_access_identity_path
      }
    },
    # Admin Dashboard (ALB)
    {
      domain_name = aws_lb.admin.dns_name
      origin_id   = "admin"
      custom_origin_config = {
        origin_protocol_policy = "https-only"
      }
    }
  ]

  default_origin_id = "static"

  # Path-based routing
  ordered_cache_behaviors = [
    # API endpoints - no caching
    {
      path_pattern     = "/api/*"
      target_origin_id = "api"
      allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods   = ["GET", "HEAD"]
      forward_cookies  = "all"
      forward_headers  = ["Authorization", "Host", "X-Tenant-Id"]
      min_ttl          = 0
      default_ttl      = 0
      max_ttl          = 0
    },
    # Admin dashboard - with auth
    {
      path_pattern     = "/admin/*"
      target_origin_id = "admin"
      allowed_methods  = ["GET", "HEAD", "OPTIONS"]
      cached_methods   = ["GET", "HEAD"]
      forward_cookies  = "all"
      min_ttl          = 0
      default_ttl      = 3600
      max_ttl          = 86400
    },
    # Static assets - aggressive caching
    {
      path_pattern     = "/assets/*"
      target_origin_id = "static"
      allowed_methods  = ["GET", "HEAD"]
      cached_methods   = ["GET", "HEAD"]
      min_ttl          = 0
      default_ttl      = 86400
      max_ttl          = 31536000
    }
  ]

  enable_auth          = true
  cognito_user_pool_id = aws_cognito_user_pool.main.id
  cognito_region       = "ap-northeast-1"

  # WAF protection
  web_acl_id = aws_wafv2_web_acl.main.arn

  # Logging
  enable_logging = true
  log_bucket     = "${aws_s3_bucket.logs.id}.s3.amazonaws.com"
  log_prefix     = "cloudfront/multi-origin/"

  tags = {
    Project = "MultiOriginApp"
  }
}
*/

# Example 4: High-Performance Global Distribution
/*
module "cloudfront_global" {
  source = "./modules/cloudfront"

  name        = "global-app"
  environment = "prod"

  # Use all edge locations
  price_class = "PriceClass_All"

  origins = [
    {
      domain_name = aws_lb.global.dns_name
      origin_id   = "global-alb"
      custom_origin_config = {
        origin_protocol_policy   = "https-only"
        origin_ssl_protocols     = ["TLSv1.2"]
        origin_keepalive_timeout = 60
        origin_read_timeout      = 60
      }
      custom_headers = [
        {
          name  = "X-Custom-Header"
          value = "CloudFront-Request"
        }
      ]
    }
  ]

  default_origin_id = "global-alb"

  # Optimized cache settings
  viewer_protocol_policy = "https-only"
  compress               = true

  forward_query_string = true
  forward_headers      = [
    "Authorization",
    "CloudFront-Viewer-Country",
    "CloudFront-Viewer-Country-Region",
    "CloudFront-Is-Mobile-Viewer",
    "CloudFront-Is-Desktop-Viewer"
  ]

  default_min_ttl = 0
  default_ttl     = 3600
  default_max_ttl = 86400

  # Geo-restriction (example: only allow Japan and US)
  geo_restriction_type      = "whitelist"
  geo_restriction_locations = ["JP", "US"]

  # Custom error pages
  custom_error_responses = [
    {
      error_code            = 500
      response_code         = 503
      response_page_path    = "/errors/503.html"
      error_caching_min_ttl = 5
    },
    {
      error_code            = 502
      response_code         = 503
      response_page_path    = "/errors/503.html"
      error_caching_min_ttl = 5
    }
  ]

  enable_auth = true

  # Enhanced logging
  enable_logging      = true
  log_bucket          = "${aws_s3_bucket.logs.id}.s3.amazonaws.com"
  log_prefix          = "cloudfront/global/"
  log_include_cookies = true

  tags = {
    Project     = "GlobalApp"
    Performance = "High"
  }
}
*/

# Example 5: Development/Staging Environment (Cost-Optimized)
/*
module "cloudfront_dev" {
  source = "./modules/cloudfront"

  name        = "dev-app"
  environment = "dev"

  # Use only US and Europe edge locations
  price_class = "PriceClass_100"

  origins = [
    {
      domain_name = aws_lb.dev.dns_name
      origin_id   = "dev-alb"
      custom_origin_config = {
        origin_protocol_policy = "https-only"
      }
    }
  ]

  default_origin_id = "dev-alb"

  # Minimal caching for development
  default_min_ttl = 0
  default_ttl     = 0
  default_max_ttl = 0

  forward_cookies      = "all"
  forward_headers      = ["*"]
  forward_query_string = true

  # Disable auth for development
  enable_auth = false

  # No custom domain in dev
  acm_certificate_arn = null
  aliases             = []

  # No logging in dev
  enable_logging = false

  tags = {
    Project     = "DevApp"
    Environment = "Development"
    CostCenter  = "Engineering"
  }
}
*/
