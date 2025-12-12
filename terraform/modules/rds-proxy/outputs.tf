/**
 * RDS Proxy Module - Outputs
 *
 * 出力値定義
 */

output "proxy_id" {
  description = "RDS Proxy ID"
  value       = aws_db_proxy.main.id
}

output "proxy_arn" {
  description = "RDS Proxy ARN"
  value       = aws_db_proxy.main.arn
}

output "proxy_endpoint" {
  description = "RDS Proxy接続エンドポイント（アプリケーションから接続する際に使用）"
  value       = aws_db_proxy.main.endpoint
}

output "proxy_name" {
  description = "RDS Proxy名"
  value       = aws_db_proxy.main.name
}

output "security_group_id" {
  description = "RDS ProxyのセキュリティグループID"
  value       = aws_security_group.rds_proxy.id
}

output "target_group_name" {
  description = "RDS Proxyターゲットグループ名"
  value       = aws_db_proxy_default_target_group.main.name
}

output "target_group_arn" {
  description = "RDS ProxyターゲットグループARN"
  value       = aws_db_proxy_default_target_group.main.arn
}

output "iam_role_arn" {
  description = "RDS Proxy用IAMロールARN"
  value       = aws_iam_role.rds_proxy.arn
}
