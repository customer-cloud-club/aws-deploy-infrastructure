/**
 * Cognito User Pool Module
 *
 * This module creates a Cognito User Pool with the following features:
 * - Google OAuth integration
 * - Microsoft OAuth integration
 * - SAML federation support
 * - Hosted UI
 * - Custom attribute: tenant_id
 * - Password policy: 8+ characters, uppercase, lowercase, numbers, symbols
 * - Optional MFA (TOTP)
 */

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-${var.environment}-user-pool"

  # Username configuration
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length                   = var.password_minimum_length
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = var.temporary_password_validity_days
  }

  # MFA configuration
  mfa_configuration = var.mfa_configuration

  software_token_mfa_configuration {
    enabled = var.enable_software_token_mfa
  }

  # Custom attribute: tenant_id
  schema {
    name                     = "tenant_id"
    attribute_data_type      = "String"
    developer_only_attribute = false
    mutable                  = true
    required                 = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  # User pool add-ons
  user_pool_add_ons {
    advanced_security_mode = var.advanced_security_mode
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email configuration
  email_configuration {
    email_sending_account = var.email_sending_account
    source_arn            = var.ses_email_identity_arn != "" ? var.ses_email_identity_arn : null
  }

  # Admin create user config
  admin_create_user_config {
    allow_admin_create_user_only = var.allow_admin_create_user_only

    invite_message_template {
      email_subject = var.invite_email_subject
      email_message = var.invite_email_message
      sms_message   = var.invite_sms_message
    }
  }

  # User attribute update settings
  user_attribute_update_settings {
    attributes_require_verification_before_update = ["email"]
  }

  # Deletion protection
  deletion_protection = var.deletion_protection

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-user-pool"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )
}

# User Pool Client
resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.project_name}-${var.environment}-app-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # OAuth configuration
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = var.allowed_oauth_flows
  allowed_oauth_scopes                 = var.allowed_oauth_scopes
  callback_urls                        = var.callback_urls
  logout_urls                          = var.logout_urls
  supported_identity_providers         = concat(
    ["COGNITO"],
    var.enable_google_identity_provider ? ["Google"] : [],
    var.enable_microsoft_identity_provider ? ["Microsoft"] : [],
    var.saml_provider_name != "" ? [var.saml_provider_name] : []
  )

  # Token validity
  id_token_validity      = var.id_token_validity
  access_token_validity  = var.access_token_validity
  refresh_token_validity = var.refresh_token_validity

  token_validity_units {
    id_token      = var.token_validity_units_id_token
    access_token  = var.token_validity_units_access_token
    refresh_token = var.token_validity_units_refresh_token
  }

  # Read/Write attributes
  read_attributes  = var.read_attributes
  write_attributes = var.write_attributes

  # Prevent user existence errors
  prevent_user_existence_errors = var.prevent_user_existence_errors

  # Explicit auth flows
  explicit_auth_flows = var.explicit_auth_flows

  # Enable token revocation
  enable_token_revocation = var.enable_token_revocation
}

# User Pool Domain (for Hosted UI)
resource "aws_cognito_user_pool_domain" "main" {
  count = var.user_pool_domain != "" ? 1 : 0

  domain       = var.user_pool_domain
  user_pool_id = aws_cognito_user_pool.main.id
}

# Custom Domain (optional)
resource "aws_cognito_user_pool_domain" "custom" {
  count = var.custom_domain != "" ? 1 : 0

  domain          = var.custom_domain
  certificate_arn = var.custom_domain_certificate_arn
  user_pool_id    = aws_cognito_user_pool.main.id
}

# Google Identity Provider
resource "aws_cognito_identity_provider" "google" {
  count = var.enable_google_identity_provider ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    authorize_scopes = var.google_authorize_scopes
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
  }

  attribute_mapping = var.google_attribute_mapping
}

# Microsoft Identity Provider
resource "aws_cognito_identity_provider" "microsoft" {
  count = var.enable_microsoft_identity_provider ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Microsoft"
  provider_type = "OIDC"

  provider_details = {
    authorize_scopes              = var.microsoft_authorize_scopes
    client_id                     = var.microsoft_client_id
    client_secret                 = var.microsoft_client_secret
    oidc_issuer                   = "https://login.microsoftonline.com/${var.microsoft_tenant_id}/v2.0"
    attributes_request_method     = "GET"
    authorize_url                 = "https://login.microsoftonline.com/${var.microsoft_tenant_id}/oauth2/v2.0/authorize"
    token_url                     = "https://login.microsoftonline.com/${var.microsoft_tenant_id}/oauth2/v2.0/token"
    attributes_url                = "https://graph.microsoft.com/oidc/userinfo"
    jwks_uri                      = "https://login.microsoftonline.com/${var.microsoft_tenant_id}/discovery/v2.0/keys"
  }

  attribute_mapping = var.microsoft_attribute_mapping
}

# SAML Identity Provider
resource "aws_cognito_identity_provider" "saml" {
  count = var.enable_saml_identity_provider ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = var.saml_provider_name
  provider_type = "SAML"

  provider_details = {
    MetadataURL = var.saml_metadata_url
  }

  attribute_mapping = var.saml_attribute_mapping

  idp_identifiers = var.saml_idp_identifiers
}

# User Pool UI Customization
resource "aws_cognito_user_pool_ui_customization" "main" {
  count = var.enable_ui_customization ? 1 : 0

  client_id = aws_cognito_user_pool_client.main.id
  css       = var.ui_customization_css
  image_file = var.ui_customization_logo_file != "" ? filebase64(var.ui_customization_logo_file) : null

  user_pool_id = aws_cognito_user_pool.main.id

  depends_on = [
    aws_cognito_user_pool_domain.main,
    aws_cognito_user_pool_domain.custom
  ]
}
