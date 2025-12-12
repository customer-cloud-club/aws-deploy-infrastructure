# Cognito User Pool Terraform Module

This module creates an AWS Cognito User Pool with support for multiple identity providers and advanced authentication features.

## Features

- **Multi-Provider Authentication**
  - Native Cognito authentication
  - Google OAuth integration
  - Microsoft OAuth integration
  - SAML federation (enterprise IdP support)

- **Security Features**
  - Configurable password policy (8+ characters, uppercase, lowercase, numbers, symbols)
  - Optional MFA (TOTP - Time-based One-Time Password)
  - Advanced security mode (adaptive authentication)
  - Deletion protection

- **Custom Attributes**
  - `tenant_id` custom attribute for multi-tenant support

- **Hosted UI**
  - Cognito-managed domain or custom domain support
  - UI customization (CSS and logo)

- **Token Management**
  - Configurable token validity periods
  - Token revocation support

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.0 |
| aws | >= 4.0 |

## Usage

### Basic Configuration

```hcl
module "cognito" {
  source = "./modules/cognito"

  project_name = "myapp"
  environment  = "prod"

  # Callback URLs for OAuth
  callback_urls = [
    "https://myapp.example.com/callback",
    "http://localhost:3000/callback"
  ]

  logout_urls = [
    "https://myapp.example.com/logout",
    "http://localhost:3000/logout"
  ]

  # Hosted UI domain
  user_pool_domain = "myapp-prod"

  tags = {
    Project = "MyApp"
    Owner   = "DevOps Team"
  }
}
```

### With Google OAuth

```hcl
module "cognito" {
  source = "./modules/cognito"

  project_name = "myapp"
  environment  = "prod"

  callback_urls = ["https://myapp.example.com/callback"]
  logout_urls   = ["https://myapp.example.com/logout"]

  user_pool_domain = "myapp-prod"

  # Enable Google Identity Provider
  enable_google_identity_provider = true
  google_client_id                = var.google_client_id
  google_client_secret            = var.google_client_secret
  google_authorize_scopes         = "profile email openid"
}
```

### With Microsoft OAuth

```hcl
module "cognito" {
  source = "./modules/cognito"

  project_name = "myapp"
  environment  = "prod"

  callback_urls = ["https://myapp.example.com/callback"]
  logout_urls   = ["https://myapp.example.com/logout"]

  user_pool_domain = "myapp-prod"

  # Enable Microsoft Identity Provider
  enable_microsoft_identity_provider = true
  microsoft_client_id                = var.microsoft_client_id
  microsoft_client_secret            = var.microsoft_client_secret
  microsoft_tenant_id                = "common" # or specific tenant ID
  microsoft_authorize_scopes         = "openid email profile"
}
```

### With SAML Federation

```hcl
module "cognito" {
  source = "./modules/cognito"

  project_name = "myapp"
  environment  = "prod"

  callback_urls = ["https://myapp.example.com/callback"]
  logout_urls   = ["https://myapp.example.com/logout"]

  user_pool_domain = "myapp-prod"

  # Enable SAML Identity Provider
  enable_saml_identity_provider = true
  saml_provider_name            = "EnterpriseIdP"
  saml_metadata_url             = "https://idp.example.com/metadata.xml"

  saml_attribute_mapping = {
    email    = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
    name     = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
    username = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
  }
}
```

### Complete Configuration with All Features

```hcl
module "cognito" {
  source = "./modules/cognito"

  project_name = "myapp"
  environment  = "prod"

  # OAuth Configuration
  callback_urls = [
    "https://myapp.example.com/callback",
    "https://admin.myapp.example.com/callback"
  ]
  logout_urls = [
    "https://myapp.example.com/logout",
    "https://admin.myapp.example.com/logout"
  ]

  # Hosted UI
  user_pool_domain = "myapp-prod"

  # Or use custom domain
  # custom_domain                  = "auth.myapp.example.com"
  # custom_domain_certificate_arn  = "arn:aws:acm:us-east-1:123456789012:certificate/xxxxx"

  # Security Settings
  mfa_configuration      = "OPTIONAL"
  advanced_security_mode = "ENFORCED"
  deletion_protection    = "ACTIVE"

  # Password Policy
  password_minimum_length          = 12
  temporary_password_validity_days = 3

  # Token Validity
  id_token_validity      = 60
  access_token_validity  = 60
  refresh_token_validity = 30

  token_validity_units_id_token      = "minutes"
  token_validity_units_access_token  = "minutes"
  token_validity_units_refresh_token = "days"

  # Identity Providers
  enable_google_identity_provider = true
  google_client_id                = var.google_client_id
  google_client_secret            = var.google_client_secret

  enable_microsoft_identity_provider = true
  microsoft_client_id                = var.microsoft_client_id
  microsoft_client_secret            = var.microsoft_client_secret
  microsoft_tenant_id                = var.microsoft_tenant_id

  enable_saml_identity_provider = true
  saml_provider_name            = "EnterpriseIdP"
  saml_metadata_url             = var.saml_metadata_url

  # UI Customization
  enable_ui_customization     = true
  ui_customization_css        = file("${path.module}/custom-ui.css")
  ui_customization_logo_file  = "${path.module}/logo.png"

  tags = {
    Project     = "MyApp"
    Environment = "Production"
    ManagedBy   = "Terraform"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| project_name | Project name for resource naming | `string` | n/a | yes |
| environment | Environment name (dev, stg, prod) | `string` | n/a | yes |
| callback_urls | List of allowed callback URLs | `list(string)` | n/a | yes |
| logout_urls | List of allowed logout URLs | `list(string)` | n/a | yes |
| tags | Additional tags | `map(string)` | `{}` | no |
| password_minimum_length | Minimum password length | `number` | `8` | no |
| mfa_configuration | MFA configuration (OFF, ON, OPTIONAL) | `string` | `"OPTIONAL"` | no |
| enable_software_token_mfa | Enable TOTP MFA | `bool` | `true` | no |
| advanced_security_mode | Advanced security mode | `string` | `"ENFORCED"` | no |
| deletion_protection | Enable deletion protection | `string` | `"ACTIVE"` | no |
| user_pool_domain | Cognito domain prefix | `string` | `""` | no |
| custom_domain | Custom domain for Hosted UI | `string` | `""` | no |
| custom_domain_certificate_arn | ACM certificate ARN for custom domain | `string` | `""` | no |
| enable_google_identity_provider | Enable Google OAuth | `bool` | `false` | no |
| google_client_id | Google OAuth client ID | `string` | `""` | no |
| google_client_secret | Google OAuth client secret | `string` | `""` | no |
| enable_microsoft_identity_provider | Enable Microsoft OAuth | `bool` | `false` | no |
| microsoft_client_id | Microsoft OAuth client ID | `string` | `""` | no |
| microsoft_client_secret | Microsoft OAuth client secret | `string` | `""` | no |
| microsoft_tenant_id | Microsoft Azure AD tenant ID | `string` | `"common"` | no |
| enable_saml_identity_provider | Enable SAML federation | `bool` | `false` | no |
| saml_provider_name | SAML provider name | `string` | `""` | no |
| saml_metadata_url | SAML metadata URL | `string` | `""` | no |

## Outputs

| Name | Description |
|------|-------------|
| user_pool_id | ID of the Cognito User Pool |
| user_pool_arn | ARN of the Cognito User Pool |
| user_pool_endpoint | Endpoint of the Cognito User Pool |
| user_pool_client_id | ID of the User Pool Client |
| user_pool_client_secret | Secret of the User Pool Client (sensitive) |
| hosted_ui_url | URL for the Cognito Hosted UI |
| login_url | Login URL for the Hosted UI |
| logout_url | Logout URL for the Hosted UI |
| supported_identity_providers | List of enabled identity providers |

## Custom Attributes

This module automatically creates the following custom attributes:

- `tenant_id` (String): Used for multi-tenant applications to isolate user data

To set the tenant_id when creating a user:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <user_pool_id> \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com Name=custom:tenant_id,Value=tenant123
```

## Security Considerations

1. **Secrets Management**: Store OAuth client secrets and other sensitive data in AWS Secrets Manager or Systems Manager Parameter Store
2. **MFA**: Enable MFA for production environments
3. **Advanced Security**: Use ENFORCED mode for production to enable adaptive authentication
4. **Deletion Protection**: Always enable in production environments
5. **HTTPS Only**: Only use HTTPS callback and logout URLs in production

## Testing Identity Providers

### Google OAuth Setup

1. Create a project in Google Cloud Console
2. Enable Google+ API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URIs:
   - `https://<domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse`
5. Use the client ID and secret in this module

### Microsoft OAuth Setup

1. Register an application in Azure AD
2. Add a redirect URI:
   - `https://<domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse`
3. Create a client secret
4. Use the application (client) ID and secret in this module

### SAML Setup

1. Configure your enterprise IdP to trust Cognito
2. Set the ACS URL to:
   - `https://<domain>.auth.<region>.amazoncognito.com/saml2/idpresponse`
3. Provide the IdP metadata URL to this module

## License

This module is licensed under the MIT License.
