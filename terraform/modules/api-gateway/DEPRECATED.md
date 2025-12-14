# DEPRECATED

This module is **deprecated** and no longer used.

## Reason

API Gateway is now managed by **Serverless Framework** instead of Terraform.

Serverless Framework automatically creates and manages API Gateway when Lambda functions with HTTP events are deployed.

## Migration

See `/lambda/serverless.yml` for the API Gateway configuration:

```yaml
functions:
  catalog:
    handler: dist/functions/catalog/handler.handler
    events:
      - http:
          path: catalog/{proxy+}
          method: any
          cors: true
```

## What This Module Contained

- API Gateway REST API
- Routes and integrations with Lambda functions
- Cognito Authorizer
- Usage plans and API keys
- WAF association

## Current Status

- API Gateway: Managed by Serverless Framework
- Routes: Defined in `serverless.yml` events
- Cognito Authorizer: Configured in Serverless resources section
- WAF: Still managed by Terraform (regional WAF)

## Referencing Serverless API Gateway from Terraform

If CloudFront or other Terraform resources need to reference the Serverless-created API Gateway:

```hcl
data "aws_api_gateway_rest_api" "serverless" {
  name = "${stage}-auth-billing"
}

data "aws_api_gateway_stage" "serverless" {
  rest_api_id = data.aws_api_gateway_rest_api.serverless.id
  stage_name  = "${stage}"
}
```

## Last Updated

2024-12-14
