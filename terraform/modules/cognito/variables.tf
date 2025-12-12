/**
 * Variables for Cognito User Pool Module
 */

# Basic Configuration
variable "project_name" {
  description = "Project name to be used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, stg, prod)"
  type        = string
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Password Policy
variable "password_minimum_length" {
  description = "Minimum password length"
  type        = number
  default     = 8
}

variable "temporary_password_validity_days" {
  description = "Number of days a temporary password is valid"
  type        = number
  default     = 7
}

# MFA Configuration
variable "mfa_configuration" {
  description = "MFA configuration (OFF, ON, OPTIONAL)"
  type        = string
  default     = "OPTIONAL"

  validation {
    condition     = contains(["OFF", "ON", "OPTIONAL"], var.mfa_configuration)
    error_message = "MFA configuration must be OFF, ON, or OPTIONAL."
  }
}

variable "enable_software_token_mfa" {
  description = "Enable software token MFA (TOTP)"
  type        = bool
  default     = true
}

# Security
variable "advanced_security_mode" {
  description = "Advanced security mode (OFF, AUDIT, ENFORCED)"
  type        = string
  default     = "ENFORCED"

  validation {
    condition     = contains(["OFF", "AUDIT", "ENFORCED"], var.advanced_security_mode)
    error_message = "Advanced security mode must be OFF, AUDIT, or ENFORCED."
  }
}

variable "deletion_protection" {
  description = "Enable deletion protection for the user pool"
  type        = string
  default     = "ACTIVE"

  validation {
    condition     = contains(["ACTIVE", "INACTIVE"], var.deletion_protection)
    error_message = "Deletion protection must be ACTIVE or INACTIVE."
  }
}

# Email Configuration
variable "email_sending_account" {
  description = "Email sending account (COGNITO_DEFAULT or DEVELOPER)"
  type        = string
  default     = "COGNITO_DEFAULT"

  validation {
    condition     = contains(["COGNITO_DEFAULT", "DEVELOPER"], var.email_sending_account)
    error_message = "Email sending account must be COGNITO_DEFAULT or DEVELOPER."
  }
}

variable "ses_email_identity_arn" {
  description = "ARN of the SES email identity (required if email_sending_account is DEVELOPER)"
  type        = string
  default     = ""
}

# Admin User Creation
variable "allow_admin_create_user_only" {
  description = "Allow only admin to create users"
  type        = bool
  default     = false
}

variable "invite_email_subject" {
  description = "Subject for invitation email"
  type        = string
  default     = "Your temporary password"
}

variable "invite_email_message" {
  description = "Message for invitation email"
  type        = string
  default     = "Your username is {username} and temporary password is {####}."
}

variable "invite_sms_message" {
  description = "Message for invitation SMS"
  type        = string
  default     = "Your username is {username} and temporary password is {####}."
}

# User Pool Client - OAuth Configuration
variable "allowed_oauth_flows" {
  description = "List of allowed OAuth flows"
  type        = list(string)
  default     = ["code", "implicit"]
}

variable "allowed_oauth_scopes" {
  description = "List of allowed OAuth scopes"
  type        = list(string)
  default     = ["email", "openid", "profile", "aws.cognito.signin.user.admin"]
}

variable "callback_urls" {
  description = "List of allowed callback URLs"
  type        = list(string)
}

variable "logout_urls" {
  description = "List of allowed logout URLs"
  type        = list(string)
}

# Token Validity
variable "id_token_validity" {
  description = "ID token validity period"
  type        = number
  default     = 60
}

variable "access_token_validity" {
  description = "Access token validity period"
  type        = number
  default     = 60
}

variable "refresh_token_validity" {
  description = "Refresh token validity period"
  type        = number
  default     = 30
}

variable "token_validity_units_id_token" {
  description = "Time unit for ID token validity (minutes, hours, days)"
  type        = string
  default     = "minutes"

  validation {
    condition     = contains(["minutes", "hours", "days"], var.token_validity_units_id_token)
    error_message = "Token validity unit must be minutes, hours, or days."
  }
}

variable "token_validity_units_access_token" {
  description = "Time unit for access token validity (minutes, hours, days)"
  type        = string
  default     = "minutes"

  validation {
    condition     = contains(["minutes", "hours", "days"], var.token_validity_units_access_token)
    error_message = "Token validity unit must be minutes, hours, or days."
  }
}

variable "token_validity_units_refresh_token" {
  description = "Time unit for refresh token validity (minutes, hours, days)"
  type        = string
  default     = "days"

  validation {
    condition     = contains(["minutes", "hours", "days"], var.token_validity_units_refresh_token)
    error_message = "Token validity unit must be minutes, hours, or days."
  }
}

# User Attributes
variable "read_attributes" {
  description = "List of user pool attributes the app client can read"
  type        = list(string)
  default = [
    "email",
    "email_verified",
    "name",
    "custom:tenant_id"
  ]
}

variable "write_attributes" {
  description = "List of user pool attributes the app client can write"
  type        = list(string)
  default = [
    "email",
    "name",
    "custom:tenant_id"
  ]
}

variable "prevent_user_existence_errors" {
  description = "Prevent user existence errors"
  type        = string
  default     = "ENABLED"

  validation {
    condition     = contains(["ENABLED", "LEGACY"], var.prevent_user_existence_errors)
    error_message = "Prevent user existence errors must be ENABLED or LEGACY."
  }
}

variable "explicit_auth_flows" {
  description = "List of authentication flows"
  type        = list(string)
  default = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]
}

variable "enable_token_revocation" {
  description = "Enable token revocation"
  type        = bool
  default     = true
}

# User Pool Domain
variable "user_pool_domain" {
  description = "Cognito domain prefix for Hosted UI"
  type        = string
  default     = ""
}

variable "custom_domain" {
  description = "Custom domain for Hosted UI"
  type        = string
  default     = ""
}

variable "custom_domain_certificate_arn" {
  description = "ACM certificate ARN for custom domain"
  type        = string
  default     = ""
}

# Google Identity Provider
variable "enable_google_identity_provider" {
  description = "Enable Google identity provider"
  type        = bool
  default     = false
}

variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_authorize_scopes" {
  description = "Google OAuth authorize scopes"
  type        = string
  default     = "profile email openid"
}

variable "google_attribute_mapping" {
  description = "Google attribute mapping"
  type        = map(string)
  default = {
    email    = "email"
    name     = "name"
    username = "sub"
  }
}

# Microsoft Identity Provider
variable "enable_microsoft_identity_provider" {
  description = "Enable Microsoft identity provider"
  type        = bool
  default     = false
}

variable "microsoft_client_id" {
  description = "Microsoft OAuth client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "microsoft_client_secret" {
  description = "Microsoft OAuth client secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "microsoft_tenant_id" {
  description = "Microsoft Azure AD tenant ID"
  type        = string
  default     = "common"
}

variable "microsoft_authorize_scopes" {
  description = "Microsoft OAuth authorize scopes"
  type        = string
  default     = "openid email profile"
}

variable "microsoft_attribute_mapping" {
  description = "Microsoft attribute mapping"
  type        = map(string)
  default = {
    email    = "email"
    name     = "name"
    username = "sub"
  }
}

# SAML Identity Provider
variable "enable_saml_identity_provider" {
  description = "Enable SAML identity provider"
  type        = bool
  default     = false
}

variable "saml_provider_name" {
  description = "SAML provider name"
  type        = string
  default     = ""
}

variable "saml_metadata_url" {
  description = "SAML metadata URL"
  type        = string
  default     = ""
}

variable "saml_attribute_mapping" {
  description = "SAML attribute mapping"
  type        = map(string)
  default = {
    email    = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
    name     = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
    username = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
  }
}

variable "saml_idp_identifiers" {
  description = "List of SAML IdP identifiers"
  type        = list(string)
  default     = []
}

# UI Customization
variable "enable_ui_customization" {
  description = "Enable UI customization for Hosted UI"
  type        = bool
  default     = false
}

variable "ui_customization_css" {
  description = "CSS for UI customization"
  type        = string
  default     = ""
}

variable "ui_customization_logo_file" {
  description = "Path to logo file for UI customization"
  type        = string
  default     = ""
}
