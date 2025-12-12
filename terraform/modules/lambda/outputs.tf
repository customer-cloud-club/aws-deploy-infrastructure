# ============================================================
# Lambda Module - Outputs
# ============================================================

# ---------------------------------------------------------
# Lambda Functions - ARNs
# ---------------------------------------------------------
output "auth_pre_signup_arn" {
  description = "ARN of auth-pre-signup Lambda function"
  value       = aws_lambda_function.auth_pre_signup.arn
}

output "auth_post_confirmation_arn" {
  description = "ARN of auth-post-confirmation Lambda function"
  value       = aws_lambda_function.auth_post_confirmation.arn
}

output "auth_pre_token_arn" {
  description = "ARN of auth-pre-token Lambda function"
  value       = aws_lambda_function.auth_pre_token.arn
}

output "entitlement_check_arn" {
  description = "ARN of entitlement-check Lambda function"
  value       = aws_lambda_function.entitlement_check.arn
}

output "usage_recorder_arn" {
  description = "ARN of usage-recorder Lambda function"
  value       = aws_lambda_function.usage_recorder.arn
}

output "webhook_processor_arn" {
  description = "ARN of webhook-processor Lambda function"
  value       = aws_lambda_function.webhook_processor.arn
}

output "checkout_handler_arn" {
  description = "ARN of checkout-handler Lambda function"
  value       = aws_lambda_function.checkout_handler.arn
}

output "admin_api_arn" {
  description = "ARN of admin-api Lambda function"
  value       = aws_lambda_function.admin_api.arn
}

# ---------------------------------------------------------
# Lambda Functions - Function Names
# ---------------------------------------------------------
output "auth_pre_signup_name" {
  description = "Name of auth-pre-signup Lambda function"
  value       = aws_lambda_function.auth_pre_signup.function_name
}

output "auth_post_confirmation_name" {
  description = "Name of auth-post-confirmation Lambda function"
  value       = aws_lambda_function.auth_post_confirmation.function_name
}

output "auth_pre_token_name" {
  description = "Name of auth-pre-token Lambda function"
  value       = aws_lambda_function.auth_pre_token.function_name
}

output "entitlement_check_name" {
  description = "Name of entitlement-check Lambda function"
  value       = aws_lambda_function.entitlement_check.function_name
}

output "usage_recorder_name" {
  description = "Name of usage-recorder Lambda function"
  value       = aws_lambda_function.usage_recorder.function_name
}

output "webhook_processor_name" {
  description = "Name of webhook-processor Lambda function"
  value       = aws_lambda_function.webhook_processor.function_name
}

output "checkout_handler_name" {
  description = "Name of checkout-handler Lambda function"
  value       = aws_lambda_function.checkout_handler.function_name
}

output "admin_api_name" {
  description = "Name of admin-api Lambda function"
  value       = aws_lambda_function.admin_api.function_name
}

# ---------------------------------------------------------
# Lambda Functions - Invoke ARNs (for API Gateway)
# ---------------------------------------------------------
output "entitlement_check_invoke_arn" {
  description = "Invoke ARN of entitlement-check Lambda function for API Gateway"
  value       = aws_lambda_function.entitlement_check.invoke_arn
}

output "usage_recorder_invoke_arn" {
  description = "Invoke ARN of usage-recorder Lambda function for API Gateway"
  value       = aws_lambda_function.usage_recorder.invoke_arn
}

output "webhook_processor_invoke_arn" {
  description = "Invoke ARN of webhook-processor Lambda function for API Gateway"
  value       = aws_lambda_function.webhook_processor.invoke_arn
}

output "checkout_handler_invoke_arn" {
  description = "Invoke ARN of checkout-handler Lambda function for API Gateway"
  value       = aws_lambda_function.checkout_handler.invoke_arn
}

output "admin_api_invoke_arn" {
  description = "Invoke ARN of admin-api Lambda function for API Gateway"
  value       = aws_lambda_function.admin_api.invoke_arn
}

# ---------------------------------------------------------
# Lambda Aliases
# ---------------------------------------------------------
output "auth_pre_signup_alias_arn" {
  description = "ARN of auth-pre-signup Lambda alias"
  value       = aws_lambda_alias.auth_pre_signup_live.arn
}

output "auth_post_confirmation_alias_arn" {
  description = "ARN of auth-post-confirmation Lambda alias"
  value       = aws_lambda_alias.auth_post_confirmation_live.arn
}

output "auth_pre_token_alias_arn" {
  description = "ARN of auth-pre-token Lambda alias"
  value       = aws_lambda_alias.auth_pre_token_live.arn
}

output "entitlement_check_alias_arn" {
  description = "ARN of entitlement-check Lambda alias"
  value       = aws_lambda_alias.entitlement_check_live.arn
}

output "usage_recorder_alias_arn" {
  description = "ARN of usage-recorder Lambda alias"
  value       = aws_lambda_alias.usage_recorder_live.arn
}

output "webhook_processor_alias_arn" {
  description = "ARN of webhook-processor Lambda alias"
  value       = aws_lambda_alias.webhook_processor_live.arn
}

output "checkout_handler_alias_arn" {
  description = "ARN of checkout-handler Lambda alias"
  value       = aws_lambda_alias.checkout_handler_live.arn
}

output "admin_api_alias_arn" {
  description = "ARN of admin-api Lambda alias"
  value       = aws_lambda_alias.admin_api_live.arn
}

# ---------------------------------------------------------
# IAM Role
# ---------------------------------------------------------
output "lambda_exec_role_arn" {
  description = "ARN of Lambda execution IAM role"
  value       = aws_iam_role.lambda_exec.arn
}

output "lambda_exec_role_name" {
  description = "Name of Lambda execution IAM role"
  value       = aws_iam_role.lambda_exec.name
}

# ---------------------------------------------------------
# Security Group
# ---------------------------------------------------------
output "lambda_security_group_id" {
  description = "ID of Lambda security group"
  value       = aws_security_group.lambda.id
}

# ---------------------------------------------------------
# CloudWatch Log Groups
# ---------------------------------------------------------
output "log_groups" {
  description = "Map of Lambda function names to their CloudWatch Log Group names"
  value = {
    auth_pre_signup         = aws_cloudwatch_log_group.lambda_logs["auth-pre-signup"].name
    auth_post_confirmation  = aws_cloudwatch_log_group.lambda_logs["auth-post-confirmation"].name
    auth_pre_token          = aws_cloudwatch_log_group.lambda_logs["auth-pre-token"].name
    entitlement_check       = aws_cloudwatch_log_group.lambda_logs["entitlement-check"].name
    usage_recorder          = aws_cloudwatch_log_group.lambda_logs["usage-recorder"].name
    webhook_processor       = aws_cloudwatch_log_group.lambda_logs["webhook-processor"].name
    checkout_handler        = aws_cloudwatch_log_group.lambda_logs["checkout-handler"].name
    admin_api               = aws_cloudwatch_log_group.lambda_logs["admin-api"].name
  }
}

# ---------------------------------------------------------
# Provisioned Concurrency Configuration
# ---------------------------------------------------------
output "entitlement_provisioned_concurrency" {
  description = "Provisioned concurrency configuration for entitlement-check function"
  value = {
    function_name = aws_lambda_provisioned_concurrency_config.entitlement.function_name
    qualifier     = aws_lambda_provisioned_concurrency_config.entitlement.qualifier
    executions    = aws_lambda_provisioned_concurrency_config.entitlement.provisioned_concurrent_executions
  }
}

# ---------------------------------------------------------
# All Functions Summary (for convenience)
# ---------------------------------------------------------
output "lambda_functions" {
  description = "Summary of all Lambda functions"
  value = {
    auth_pre_signup = {
      arn          = aws_lambda_function.auth_pre_signup.arn
      name         = aws_lambda_function.auth_pre_signup.function_name
      invoke_arn   = aws_lambda_function.auth_pre_signup.invoke_arn
      vpc_enabled  = false
      concurrency  = 50
    }
    auth_post_confirmation = {
      arn          = aws_lambda_function.auth_post_confirmation.arn
      name         = aws_lambda_function.auth_post_confirmation.function_name
      invoke_arn   = aws_lambda_function.auth_post_confirmation.invoke_arn
      vpc_enabled  = true
      concurrency  = 50
    }
    auth_pre_token = {
      arn          = aws_lambda_function.auth_pre_token.arn
      name         = aws_lambda_function.auth_pre_token.function_name
      invoke_arn   = aws_lambda_function.auth_pre_token.invoke_arn
      vpc_enabled  = true
      concurrency  = 100
    }
    entitlement_check = {
      arn                      = aws_lambda_function.entitlement_check.arn
      name                     = aws_lambda_function.entitlement_check.function_name
      invoke_arn               = aws_lambda_function.entitlement_check.invoke_arn
      vpc_enabled              = true
      concurrency              = 500
      provisioned_concurrency  = var.entitlement_provisioned_concurrency
    }
    usage_recorder = {
      arn          = aws_lambda_function.usage_recorder.arn
      name         = aws_lambda_function.usage_recorder.function_name
      invoke_arn   = aws_lambda_function.usage_recorder.invoke_arn
      vpc_enabled  = true
      concurrency  = 100
    }
    webhook_processor = {
      arn          = aws_lambda_function.webhook_processor.arn
      name         = aws_lambda_function.webhook_processor.function_name
      invoke_arn   = aws_lambda_function.webhook_processor.invoke_arn
      vpc_enabled  = true
      concurrency  = 100
    }
    checkout_handler = {
      arn          = aws_lambda_function.checkout_handler.arn
      name         = aws_lambda_function.checkout_handler.function_name
      invoke_arn   = aws_lambda_function.checkout_handler.invoke_arn
      vpc_enabled  = true
      concurrency  = 50
    }
    admin_api = {
      arn          = aws_lambda_function.admin_api.arn
      name         = aws_lambda_function.admin_api.function_name
      invoke_arn   = aws_lambda_function.admin_api.invoke_arn
      vpc_enabled  = true
      concurrency  = 50
    }
  }
}
