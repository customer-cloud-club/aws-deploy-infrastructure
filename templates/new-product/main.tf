# 新規プロダクト統合 Terraformテンプレート
# 共通認証・課金基盤と連携するための最小構成

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ローカル変数
locals {
  name_prefix = "${var.product_name}-${var.environment}"
  common_tags = {
    Product     = var.product_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Platform    = "aidreams"
  }
}

# CloudFront Function for JWT認証
resource "aws_cloudfront_function" "auth_check" {
  name    = "${local.name_prefix}-auth-check"
  runtime = "cloudfront-js-2.0"
  comment = "JWT token validation for ${var.product_name}"
  publish = true
  code    = file("${path.module}/auth-function.js")
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.product_name} distribution"
  default_root_object = "index.html"
  price_class         = "PriceClass_200"

  aliases = var.custom_domain != "" ? [var.custom_domain] : []

  origin {
    domain_name = var.origin_domain
    origin_id   = "main"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "main"

    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
      headers = ["Authorization", "Origin", "Accept"]
    }

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.auth_check.arn
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  # 静的アセットのキャッシュ
  ordered_cache_behavior {
    path_pattern     = "/static/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "main"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.custom_domain == "" ? true : false
    acm_certificate_arn            = var.acm_certificate_arn
    ssl_support_method             = var.custom_domain != "" ? "sni-only" : null
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  tags = local.common_tags
}

# Route53レコード（カスタムドメイン使用時）
resource "aws_route53_record" "main" {
  count   = var.custom_domain != "" && var.route53_zone_id != "" ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.custom_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}
