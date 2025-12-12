/**
 * RDS Proxy Module - Main Configuration
 *
 * RDS Proxyリソース定義
 * - PostgreSQL接続プーリング
 * - IAM認証 + Secrets Manager認証
 * - TLS必須接続
 */

# RDS Proxy本体
resource "aws_db_proxy" "main" {
  name                   = "${var.project_name}-${var.environment}-rds-proxy"
  debug_logging          = var.environment == "dev"
  engine_family          = "POSTGRESQL"
  idle_client_timeout    = 1800 # 30分
  require_tls            = true
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_security_group_ids = [aws_security_group.rds_proxy.id]
  vpc_subnet_ids         = var.subnet_ids

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "REQUIRED"
    secret_arn  = var.db_secret_arn
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-rds-proxy"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )
}

# デフォルトターゲットグループ（接続プール設定）
resource "aws_db_proxy_default_target_group" "main" {
  db_proxy_name = aws_db_proxy.main.name

  connection_pool_config {
    connection_borrow_timeout    = 120 # 2分
    max_connections_percent      = 100
    max_idle_connections_percent = 50
  }
}

# RDS Clusterをターゲットとして登録
resource "aws_db_proxy_target" "main" {
  db_proxy_name         = aws_db_proxy.main.name
  target_group_name     = aws_db_proxy_default_target_group.main.name
  db_cluster_identifier = var.db_cluster_identifier
}

# RDS Proxy用セキュリティグループ
resource "aws_security_group" "rds_proxy" {
  name        = "${var.project_name}-${var.environment}-rds-proxy-sg"
  description = "Security group for RDS Proxy"
  vpc_id      = var.vpc_id

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-rds-proxy-sg"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )
}

# アプリケーションからのPostgreSQL接続を許可
resource "aws_security_group_rule" "rds_proxy_ingress" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds_proxy.id
  source_security_group_id = var.app_security_group_id
  description              = "Allow PostgreSQL from application"
}

# RDS Proxyから実際のRDSへの接続を許可
resource "aws_security_group_rule" "rds_proxy_egress" {
  type                     = "egress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds_proxy.id
  source_security_group_id = var.rds_security_group_id
  description              = "Allow PostgreSQL to RDS"
}

# Secrets Managerへのアクセス（HTTPS）
resource "aws_security_group_rule" "rds_proxy_secrets_egress" {
  type              = "egress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  security_group_id = aws_security_group.rds_proxy.id
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow HTTPS to Secrets Manager"
}
