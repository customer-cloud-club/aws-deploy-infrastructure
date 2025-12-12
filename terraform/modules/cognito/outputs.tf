/**
 * Outputs for Cognito User Pool Module
 */

# User Pool
output "user_pool_id" {
  description = "ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.arn
}

output "user_pool_endpoint" {
  description = "Endpoint name of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.endpoint
}

output "user_pool_name" {
  description = "Name of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.name
}

# User Pool Client
output "user_pool_client_id" {
  description = "ID of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.main.id
}

output "user_pool_client_secret" {
  description = "Secret of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.main.client_secret
  sensitive   = true
}

# User Pool Domain
output "user_pool_domain" {
  description = "Domain name of the Cognito User Pool (Hosted UI)"
  value       = var.user_pool_domain != "" ? aws_cognito_user_pool_domain.main[0].domain : null
}

output "user_pool_domain_aws_account_id" {
  description = "AWS account ID for the Cognito domain"
  value       = var.user_pool_domain != "" ? aws_cognito_user_pool_domain.main[0].aws_account_id : null
}

output "user_pool_domain_cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN for the Cognito domain"
  value       = var.user_pool_domain != "" ? aws_cognito_user_pool_domain.main[0].cloudfront_distribution_arn : null
}

output "custom_domain" {
  description = "Custom domain name for the Cognito User Pool"
  value       = var.custom_domain != "" ? aws_cognito_user_pool_domain.custom[0].domain : null
}

output "custom_domain_cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN for the custom domain"
  value       = var.custom_domain != "" ? aws_cognito_user_pool_domain.custom[0].cloudfront_distribution_arn : null
}

# Hosted UI URLs
output "hosted_ui_url" {
  description = "URL for the Cognito Hosted UI"
  value = var.user_pool_domain != "" ? "https://${aws_cognito_user_pool_domain.main[0].domain}.auth.${data.aws_region.current.name}.amazoncognito.com" : (
    var.custom_domain != "" ? "https://${aws_cognito_user_pool_domain.custom[0].domain}" : null
  )
}

output "login_url" {
  description = "Login URL for the Cognito Hosted UI"
  value = var.user_pool_domain != "" || var.custom_domain != "" ? format(
    "%s/login?client_id=%s&response_type=code&redirect_uri=%s",
    var.user_pool_domain != "" ? "https://${aws_cognito_user_pool_domain.main[0].domain}.auth.${data.aws_region.current.name}.amazoncognito.com" : "https://${aws_cognito_user_pool_domain.custom[0].domain}",
    aws_cognito_user_pool_client.main.id,
    length(var.callback_urls) > 0 ? var.callback_urls[0] : ""
  ) : null
}

output "logout_url" {
  description = "Logout URL for the Cognito Hosted UI"
  value = var.user_pool_domain != "" || var.custom_domain != "" ? format(
    "%s/logout?client_id=%s&logout_uri=%s",
    var.user_pool_domain != "" ? "https://${aws_cognito_user_pool_domain.main[0].domain}.auth.${data.aws_region.current.name}.amazoncognito.com" : "https://${aws_cognito_user_pool_domain.custom[0].domain}",
    aws_cognito_user_pool_client.main.id,
    length(var.logout_urls) > 0 ? var.logout_urls[0] : ""
  ) : null
}

# Identity Providers
output "google_identity_provider_name" {
  description = "Name of the Google identity provider"
  value       = var.enable_google_identity_provider ? aws_cognito_identity_provider.google[0].provider_name : null
}

output "microsoft_identity_provider_name" {
  description = "Name of the Microsoft identity provider"
  value       = var.enable_microsoft_identity_provider ? aws_cognito_identity_provider.microsoft[0].provider_name : null
}

output "saml_identity_provider_name" {
  description = "Name of the SAML identity provider"
  value       = var.enable_saml_identity_provider ? aws_cognito_identity_provider.saml[0].provider_name : null
}

# Configuration Information
output "supported_identity_providers" {
  description = "List of supported identity providers"
  value = concat(
    ["COGNITO"],
    var.enable_google_identity_provider ? ["Google"] : [],
    var.enable_microsoft_identity_provider ? ["Microsoft"] : [],
    var.enable_saml_identity_provider ? [var.saml_provider_name] : []
  )
}

output "callback_urls" {
  description = "List of allowed callback URLs"
  value       = var.callback_urls
}

output "logout_urls" {
  description = "List of allowed logout URLs"
  value       = var.logout_urls
}

# Data source for current AWS region
data "aws_region" "current" {}
