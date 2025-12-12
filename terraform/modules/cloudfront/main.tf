# CloudFront Distribution for Application
# Provides global CDN with Lambda@Edge authentication

resource "aws_cloudfront_distribution" "main" {
  enabled             = var.enabled
  is_ipv6_enabled     = var.enable_ipv6
  comment             = var.comment
  default_root_object = var.default_root_object
  price_class         = var.price_class
  web_acl_id          = var.web_acl_id

  # Origin - ALB or S3
  dynamic "origin" {
    for_each = var.origins
    content {
      domain_name = origin.value.domain_name
      origin_id   = origin.value.origin_id
      origin_path = lookup(origin.value, "origin_path", "")

      dynamic "custom_origin_config" {
        for_each = lookup(origin.value, "custom_origin_config", null) != null ? [origin.value.custom_origin_config] : []
        content {
          http_port                = lookup(custom_origin_config.value, "http_port", 80)
          https_port               = lookup(custom_origin_config.value, "https_port", 443)
          origin_protocol_policy   = lookup(custom_origin_config.value, "origin_protocol_policy", "https-only")
          origin_ssl_protocols     = lookup(custom_origin_config.value, "origin_ssl_protocols", ["TLSv1.2"])
          origin_keepalive_timeout = lookup(custom_origin_config.value, "origin_keepalive_timeout", 5)
          origin_read_timeout      = lookup(custom_origin_config.value, "origin_read_timeout", 30)
        }
      }

      dynamic "s3_origin_config" {
        for_each = lookup(origin.value, "s3_origin_config", null) != null ? [origin.value.s3_origin_config] : []
        content {
          origin_access_identity = s3_origin_config.value.origin_access_identity
        }
      }

      dynamic "custom_header" {
        for_each = coalesce(lookup(origin.value, "custom_headers", null), [])
        content {
          name  = custom_header.value.name
          value = custom_header.value.value
        }
      }
    }
  }

  # Default Cache Behavior with Lambda@Edge
  default_cache_behavior {
    target_origin_id       = var.default_origin_id
    viewer_protocol_policy = var.viewer_protocol_policy
    allowed_methods        = var.default_allowed_methods
    cached_methods         = var.default_cached_methods
    compress               = var.compress

    forwarded_values {
      query_string = var.forward_query_string
      headers      = var.forward_headers

      cookies {
        forward           = var.forward_cookies
        whitelisted_names = var.forward_cookies_whitelisted_names
      }
    }

    min_ttl     = var.default_min_ttl
    default_ttl = var.default_ttl
    max_ttl     = var.default_max_ttl

    # Lambda@Edge Association for Authentication
    dynamic "lambda_function_association" {
      for_each = var.enable_auth ? [1] : []
      content {
        event_type   = "viewer-request"
        lambda_arn   = aws_lambda_function.auth_verifier[0].qualified_arn
        include_body = false
      }
    }
  }

  # Ordered Cache Behaviors
  dynamic "ordered_cache_behavior" {
    for_each = var.ordered_cache_behaviors
    content {
      path_pattern           = ordered_cache_behavior.value.path_pattern
      target_origin_id       = ordered_cache_behavior.value.target_origin_id
      viewer_protocol_policy = lookup(ordered_cache_behavior.value, "viewer_protocol_policy", "redirect-to-https")
      allowed_methods        = lookup(ordered_cache_behavior.value, "allowed_methods", ["GET", "HEAD", "OPTIONS"])
      cached_methods         = lookup(ordered_cache_behavior.value, "cached_methods", ["GET", "HEAD"])
      compress               = lookup(ordered_cache_behavior.value, "compress", true)

      forwarded_values {
        query_string = lookup(ordered_cache_behavior.value, "forward_query_string", false)
        headers      = lookup(ordered_cache_behavior.value, "forward_headers", [])

        cookies {
          forward = lookup(ordered_cache_behavior.value, "forward_cookies", "none")
        }
      }

      min_ttl     = lookup(ordered_cache_behavior.value, "min_ttl", 0)
      default_ttl = lookup(ordered_cache_behavior.value, "default_ttl", 86400)
      max_ttl     = lookup(ordered_cache_behavior.value, "max_ttl", 31536000)

      # Lambda@Edge Association for specific paths
      dynamic "lambda_function_association" {
        for_each = lookup(ordered_cache_behavior.value, "lambda_associations", [])
        content {
          event_type   = lambda_function_association.value.event_type
          lambda_arn   = lambda_function_association.value.lambda_arn
          include_body = lookup(lambda_function_association.value, "include_body", false)
        }
      }
    }
  }

  # Custom Error Response
  dynamic "custom_error_response" {
    for_each = var.custom_error_responses
    content {
      error_code            = custom_error_response.value.error_code
      response_code         = lookup(custom_error_response.value, "response_code", null)
      response_page_path    = lookup(custom_error_response.value, "response_page_path", null)
      error_caching_min_ttl = lookup(custom_error_response.value, "error_caching_min_ttl", 10)
    }
  }

  # SSL/TLS Configuration
  viewer_certificate {
    acm_certificate_arn            = var.acm_certificate_arn
    ssl_support_method             = var.acm_certificate_arn != null ? "sni-only" : null
    minimum_protocol_version       = var.minimum_protocol_version
    cloudfront_default_certificate = var.acm_certificate_arn == null
  }

  # Restrictions
  restrictions {
    geo_restriction {
      restriction_type = var.geo_restriction_type
      locations        = var.geo_restriction_locations
    }
  }

  # Logging
  dynamic "logging_config" {
    for_each = var.enable_logging ? [1] : []
    content {
      include_cookies = var.log_include_cookies
      bucket          = var.log_bucket
      prefix          = var.log_prefix
    }
  }

  # Aliases (Custom Domains)
  aliases = var.aliases

  tags = merge(
    var.tags,
    {
      Name        = var.name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )
}

# CloudFront Origin Access Identity for S3
resource "aws_cloudfront_origin_access_identity" "main" {
  count   = var.create_oai ? 1 : 0
  comment = "OAI for ${var.name}"
}
