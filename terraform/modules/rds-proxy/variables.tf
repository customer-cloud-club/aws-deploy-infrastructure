/**
 * RDS Proxy Module - Variables
 *
 * 入力変数定義
 */

variable "project_name" {
  description = "プロジェクト名"
  type        = string
}

variable "environment" {
  description = "環境名 (dev/stg/prod)"
  type        = string

  validation {
    condition     = contains(["dev", "stg", "prod"], var.environment)
    error_message = "Environment must be dev, stg, or prod."
  }
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_ids" {
  description = "RDS Proxyを配置するプライベートサブネットIDリスト"
  type        = list(string)

  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least 2 subnets are required for high availability."
  }
}

variable "db_cluster_identifier" {
  description = "接続先RDS ClusterのID"
  type        = string
}

variable "db_secret_arn" {
  description = "RDS認証情報が格納されたSecrets ManagerシークレットのARN"
  type        = string
}

variable "app_security_group_id" {
  description = "アプリケーションのセキュリティグループID（RDS Proxyへの接続元）"
  type        = string
}

variable "rds_security_group_id" {
  description = "RDSのセキュリティグループID（RDS Proxyの接続先）"
  type        = string
}

variable "tags" {
  description = "リソースに付与する共通タグ"
  type        = map(string)
  default     = {}
}
