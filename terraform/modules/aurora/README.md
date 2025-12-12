# Aurora PostgreSQL Serverless v2 Terraform Module

Aurora PostgreSQL Serverless v2クラスターを構築するTerraformモジュールです。

## 機能

- Aurora PostgreSQL 15.x (Serverless v2)
- 自動スケーリング (0.5〜16 ACU)
- マルチAZ構成
- リードレプリカ (デフォルト1台)
- KMS暗号化
- 自動バックアップ (7日間保持)
- Performance Insights有効化
- CloudWatch Logs統合
- IAMデータベース認証対応
- CloudWatchアラーム (CPU、容量、接続数)

## 要件

- Terraform >= 1.0
- AWS Provider >= 5.0
- 事前に作成されたVPCとサブネット
- 事前に作成されたKMSキー

## 使用例

### 基本的な使用

```hcl
module "aurora" {
  source = "../../modules/aurora"

  project_name = "miyabi"
  environment  = "prod"

  # Network Configuration
  vpc_id                 = module.vpc.vpc_id
  subnet_ids             = module.vpc.private_subnet_ids
  app_security_group_id  = module.ecs.security_group_id

  # Database Configuration
  database_name   = "miyabi_auth_billing"
  master_username = "postgres"
  master_password = data.aws_secretsmanager_secret_version.db_password.secret_string

  # Serverless v2 Scaling
  min_capacity = 0.5
  max_capacity = 16

  # Encryption
  kms_key_arn = module.kms.key_arn

  # Backup Configuration
  backup_retention_period = 7
  preferred_backup_window = "03:00-04:00"

  # High Availability
  reader_count = 1

  # Monitoring
  alarm_sns_topic_arn = aws_sns_topic.alerts.arn

  tags = {
    Project     = "miyabi"
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}
```

### 開発環境の例

```hcl
module "aurora_dev" {
  source = "../../modules/aurora"

  project_name = "miyabi"
  environment  = "dev"

  vpc_id                 = module.vpc.vpc_id
  subnet_ids             = module.vpc.private_subnet_ids
  app_security_group_id  = module.ecs.security_group_id

  database_name   = "miyabi_dev"
  master_username = "postgres"
  master_password = var.db_password

  # Dev環境は小規模スケール
  min_capacity = 0.5
  max_capacity = 2

  kms_key_arn = module.kms.key_arn

  # Dev環境はレプリカ不要
  reader_count = 0

  # Dev環境は削除保護を無効化
  deletion_protection = false
  skip_final_snapshot = true

  tags = {
    Project     = "miyabi"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
```

## データベーススキーマ

初期テーブル定義は以下を参照してください：

```sql
-- Tenants: テナント管理
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(63) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Users: ユーザー管理
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  cognito_user_id VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, email)
);

-- Products: 製品マスタ
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  stripe_product_id VARCHAR(255) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Plans: プランマスタ
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  stripe_price_id VARCHAR(255) UNIQUE NOT NULL,
  billing_period VARCHAR(20) NOT NULL,
  price_amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'JPY',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Entitlements: 機能エンタイトルメント
CREATE TABLE entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,
  feature_value VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, feature_key)
);

-- Subscriptions: サブスクリプション
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL,
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Payments: 支払い履歴
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'JPY',
  status VARCHAR(50) NOT NULL,
  paid_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PaymentEvents: Stripe Webhook イベント
CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ProcessedWebhooks: Webhook重複処理防止
CREATE TABLE processed_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX idx_payment_events_event_type ON payment_events(event_type);
CREATE INDEX idx_payment_events_created_at ON payment_events(created_at);
```

## 入力変数

| 変数名 | 説明 | 型 | デフォルト | 必須 |
|--------|------|-----|-----------|------|
| project_name | プロジェクト名 | string | - | Yes |
| environment | 環境名 (dev/stg/prod) | string | - | Yes |
| vpc_id | VPC ID | string | - | Yes |
| subnet_ids | サブネットIDリスト (2つ以上) | list(string) | - | Yes |
| app_security_group_id | アプリケーションSG ID | string | - | Yes |
| database_name | データベース名 | string | miyabi_auth_billing | No |
| master_username | マスターユーザー名 | string | postgres | No |
| master_password | マスターパスワード | string | - | Yes |
| engine_version | PostgreSQLバージョン | string | 15.4 | No |
| min_capacity | 最小ACU | number | 0.5 | No |
| max_capacity | 最大ACU | number | 16 | No |
| kms_key_arn | KMSキーARN | string | - | Yes |
| backup_retention_period | バックアップ保持期間(日) | number | 7 | No |
| reader_count | リードレプリカ数 | number | 1 | No |
| deletion_protection | 削除保護 | bool | true | No |
| skip_final_snapshot | 最終スナップショットスキップ | bool | false | No |
| performance_insights_enabled | Performance Insights有効化 | bool | true | No |
| alarm_sns_topic_arn | アラーム通知先SNSトピックARN | string | null | No |
| tags | タグ | map(string) | {} | No |

## 出力

| 出力名 | 説明 |
|--------|------|
| cluster_id | クラスターID |
| cluster_endpoint | ライターエンドポイント |
| cluster_reader_endpoint | リーダーエンドポイント |
| cluster_port | ポート番号 |
| cluster_database_name | データベース名 |
| security_group_id | セキュリティグループID |
| connection_string | 接続文字列 (パスワード除く) |
| writer_instance_id | ライターインスタンスID |
| reader_instance_ids | リーダーインスタンスID一覧 |

## 接続方法

### psqlコマンドでの接続

```bash
psql -h <cluster_endpoint> \
     -p 5432 \
     -U postgres \
     -d miyabi_auth_billing
```

### アプリケーションからの接続（Node.js）

```javascript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: 'miyabi_auth_billing',
  user: 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: true
  }
});
```

## セキュリティ考慮事項

1. **パスワード管理**: マスターパスワードはAWS Secrets Managerに保存してください
2. **ネットワーク**: Aurora クラスターはプライベートサブネットに配置されます
3. **暗号化**: KMS暗号化が有効化されています
4. **IAM認証**: IAMデータベース認証を推奨します
5. **接続制限**: アプリケーションSGからのアクセスのみ許可されます

## モニタリング

以下のCloudWatchアラームが自動作成されます：

- **高CPU使用率**: 平均CPU使用率が80%を超えた場合
- **高容量使用**: ACUが最大容量の80%を超えた場合
- **高接続数**: データベース接続数が800を超えた場合

## Performance Insights

Performance Insightsが有効化されており、以下を監視できます：

- データベース負荷のリアルタイム分析
- 上位SQLクエリの特定
- 待機イベントの分析
- 保持期間: 7日間（デフォルト）

## バックアップとリストア

- **自動バックアップ**: 毎日3:00-4:00 (UTC)に実行
- **保持期間**: 7日間（カスタマイズ可能）
- **ポイントインタイムリカバリ**: 有効

### リストア例

```bash
aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier miyabi-prod-aurora-cluster \
  --db-cluster-identifier miyabi-prod-aurora-restored \
  --restore-to-time 2025-12-12T12:00:00Z
```

## コスト最適化

- Serverless v2による自動スケーリング
- 開発環境では `reader_count = 0` を推奨
- 非本番環境では `max_capacity` を低く設定

### コスト見積もり（参考）

| 環境 | ACU範囲 | 月間コスト（目安） |
|------|---------|-------------------|
| Dev | 0.5-2 ACU | $50-100 |
| Stg | 0.5-8 ACU | $100-300 |
| Prod | 0.5-16 ACU | $200-600 |

## トラブルシューティング

### 接続できない

1. セキュリティグループの確認
2. サブネットルーティングの確認
3. CloudWatch Logsでエラー確認

### パフォーマンスが遅い

1. Performance Insightsで上位クエリを確認
2. ACUスケーリングの確認
3. インデックスの最適化

## ライセンス

このモジュールはMITライセンスの下で公開されています。

## 更新履歴

- 2025-12-12: 初版作成
