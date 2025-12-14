# DEPRECATED

This module is **deprecated** and no longer used.

## Reason

Lambda functions and API Gateway are now managed by **Serverless Framework** instead of Terraform.

## Migration

See `/lambda` directory for the Serverless Framework configuration:

```bash
cd lambda
npx serverless deploy --stage dev   # Deploy to dev
npx serverless deploy --stage prod  # Deploy to prod
```

## What This Module Contained

- Lambda function definitions (auth, entitlement, billing, catalog)
- IAM roles and policies for Lambda execution
- Security Groups for VPC-enabled Lambda functions
- CloudWatch Log Groups
- Lambda permissions for Cognito triggers

## Current Status

- Lambda functions: Managed by Serverless Framework
- Security Groups: Defined in `envs/dev/main.tf` and `envs/prod/main.tf`
- IAM roles: Created automatically by Serverless Framework

## Last Updated

2024-12-14
