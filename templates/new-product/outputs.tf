# 新規プロダクト統合 - 出力値

output "cloudfront_distribution_id" {
  description = "CloudFront Distribution ID"
  value       = aws_cloudfront_distribution.main.id
}

output "cloudfront_domain_name" {
  description = "CloudFront Distribution domain name"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_url" {
  description = "CloudFront URL"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "custom_domain_url" {
  description = "Custom domain URL (if configured)"
  value       = var.custom_domain != "" ? "https://${var.custom_domain}" : null
}

# アプリケーション設定用の環境変数
output "app_environment_variables" {
  description = "アプリケーションに設定する環境変数"
  value = {
    PRODUCT_ID           = var.product_name
    PLATFORM_API_URL     = var.platform_api_url
    COGNITO_USER_POOL_ID = var.cognito_user_pool_id
  }
}

output "integration_checklist" {
  description = "統合完了チェックリスト"
  value       = <<-EOT

    ╔══════════════════════════════════════════════════════════════╗
    ║              統合完了チェックリスト                          ║
    ╠══════════════════════════════════════════════════════════════╣
    ║ 1. [ ] Admin Consoleでプロダクトを登録                       ║
    ║    URL: https://admin.aidreams-factory.com/products          ║
    ║                                                              ║
    ║ 2. [ ] プランを作成（Free, Pro等）                           ║
    ║    URL: https://admin.aidreams-factory.com/plans             ║
    ║                                                              ║
    ║ 3. [ ] アプリケーションに環境変数を設定:                     ║
    ║    PRODUCT_ID=${var.product_name}                            ║
    ║    PLATFORM_API_URL=${var.platform_api_url}                  ║
    ║                                                              ║
    ║ 4. [ ] SDKをインストール:                                    ║
    ║    npm install @aidreams/platform-sdk                        ║
    ║                                                              ║
    ║ 5. [ ] 動作確認                                              ║
    ╚══════════════════════════════════════════════════════════════╝
  EOT
}
