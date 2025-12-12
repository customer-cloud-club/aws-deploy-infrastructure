# CloudFront Module Outputs

output "distribution_id" {
  description = "The identifier for the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.id
}

output "distribution_arn" {
  description = "The ARN of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.arn
}

output "distribution_domain_name" {
  description = "The domain name corresponding to the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "distribution_hosted_zone_id" {
  description = "The CloudFront Route 53 zone ID"
  value       = aws_cloudfront_distribution.main.hosted_zone_id
}

output "distribution_status" {
  description = "The current status of the distribution"
  value       = aws_cloudfront_distribution.main.status
}

output "distribution_etag" {
  description = "The current version of the distribution's information"
  value       = aws_cloudfront_distribution.main.etag
}

output "origin_access_identity_id" {
  description = "The CloudFront origin access identity ID (if created)"
  value       = try(aws_cloudfront_origin_access_identity.main[0].id, null)
}

output "origin_access_identity_iam_arn" {
  description = "The IAM ARN of the CloudFront origin access identity (if created)"
  value       = try(aws_cloudfront_origin_access_identity.main[0].iam_arn, null)
}

output "origin_access_identity_path" {
  description = "The CloudFront origin access identity path (if created)"
  value       = try(aws_cloudfront_origin_access_identity.main[0].cloudfront_access_identity_path, null)
}

# Lambda@Edge Outputs
output "lambda_function_arn" {
  description = "ARN of the Lambda@Edge authentication function"
  value       = try(aws_lambda_function.auth_verifier[0].arn, null)
}

output "lambda_function_qualified_arn" {
  description = "Qualified ARN of the Lambda@Edge authentication function"
  value       = try(aws_lambda_function.auth_verifier[0].qualified_arn, null)
}

output "lambda_function_name" {
  description = "Name of the Lambda@Edge authentication function"
  value       = try(aws_lambda_function.auth_verifier[0].function_name, null)
}

output "lambda_function_version" {
  description = "Version of the Lambda@Edge authentication function"
  value       = try(aws_lambda_function.auth_verifier[0].version, null)
}

output "lambda_role_arn" {
  description = "ARN of the Lambda@Edge execution role"
  value       = try(aws_iam_role.lambda_edge[0].arn, null)
}

output "lambda_role_name" {
  description = "Name of the Lambda@Edge execution role"
  value       = try(aws_iam_role.lambda_edge[0].name, null)
}

# CloudFront URLs
output "cloudfront_url" {
  description = "The full URL of the CloudFront distribution (https://)"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "custom_domain_urls" {
  description = "List of custom domain URLs (if aliases are configured)"
  value       = [for alias in var.aliases : "https://${alias}"]
}
