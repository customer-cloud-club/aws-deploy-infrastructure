# 認証・課金基盤 Terraform 環境別設定

このディレクトリには、Dev環境とProd環境のTerraform設定ファイルが含まれています。

## ディレクトリ構成

```
envs/
├── dev/                        # 開発環境
│   ├── main.tf                 # メイン構成ファイル
│   ├── variables.tf            # 変数定義
│   ├── outputs.tf              # 出力値定義
│   └── terraform.tfvars        # 環境固有の値
├── prod/                       # 本番環境
│   ├── main.tf                 # メイン構成ファイル
│   ├── variables.tf            # 変数定義
│   ├── outputs.tf              # 出力値定義
│   └── terraform.tfvars        # 環境固有の値
└── README.md                   # このファイル
```

## 統合されているAWSサービス

### 1. 認証基盤
- **Amazon Cognito**: ユーザー認証・管理
- **AWS Lambda**: カスタム認証ロジック
- **API Gateway**: 認証API

### 2. データベース基盤
- **Amazon Aurora PostgreSQL**: メインデータベース
- **RDS Proxy**: 接続プーリング
- **ElastiCache Redis**: セッション・キャッシュ管理

### 3. API基盤
- **API Gateway**: REST API
- **AWS Lambda**: ビジネスロジック
- **CloudFront + Lambda@Edge**: グローバル配信・エッジ処理

### 4. セキュリティ
- **AWS WAF**: アプリケーション保護
- **AWS Secrets Manager**: 認証情報管理
- **Amazon S3**: 監査ログ保存

## 事前準備

### 1. Terraform Stateバックエンドの作成

```bash
# S3バケット作成
aws s3api create-bucket \
  --bucket auth-billing-terraform-state \
  --region ap-northeast-1 \
  --create-bucket-configuration LocationConstraint=ap-northeast-1

# バージョニング有効化
aws s3api put-bucket-versioning \
  --bucket auth-billing-terraform-state \
  --versioning-configuration Status=Enabled

# 暗号化有効化
aws s3api put-bucket-encryption \
  --bucket auth-billing-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# DynamoDBテーブル作成（ロック用）
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-1
```

### 2. VPCの確認

既存のVPC IDを取得し、`terraform.tfvars`に設定してください。

```bash
# VPC一覧取得
aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId,Tags[?Key==`Name`].Value|[0]]' --output table
```

## デプロイ手順

### Dev環境のデプロイ

```bash
cd envs/dev

# 1. terraform.tfvarsを編集
vi terraform.tfvars
# vpc_id を実際のVPC IDに置き換える

# 2. Terraform初期化
terraform init

# 3. プランの確認
terraform plan

# 4. 適用
terraform apply
```

### Prod環境のデプロイ

```bash
cd envs/prod

# 1. terraform.tfvarsを編集
vi terraform.tfvars
# vpc_id を実際のVPC IDに置き換える

# 2. Terraform初期化
terraform init

# 3. プランの確認
terraform plan

# 4. 適用（本番環境は慎重に）
terraform apply
```

## 環境間の違い

| 項目 | Dev環境 | Prod環境 |
|------|---------|----------|
| Auroraインスタンス数 | 2 | 3 |
| Auroraインスタンスクラス | db.r6g.large | db.r6g.xlarge |
| バックアップ保持期間 | 7日 | 30日 |
| Redisノード数 | 2 | 3 |
| Redisノードタイプ | cache.r6g.large | cache.r6g.xlarge |
| WAFレート制限 | 2000/5分 | 10000/5分 |
| WAF地域制限 | なし | あり (日本のみ) |
| Lambdaメモリ | 512 MB | 1024 MB |
| API Gateway制限 | 5000 burst, 10000 rate | 10000 burst, 20000 rate |
| S3監査ログ保持 | 90日 | 365日 |

## 出力値の確認

デプロイ後、重要な出力値を確認できます。

```bash
# すべての出力値を表示
terraform output

# 特定の出力値を表示
terraform output cognito_user_pool_id
terraform output api_gateway_invoke_url
terraform output cloudfront_domain_name

# センシティブな値を表示
terraform output -json cognito_user_pool_client_id
```

## メンテナンス

### リソースの更新

```bash
# 変更内容の確認
terraform plan

# 変更の適用
terraform apply
```

### 状態の確認

```bash
# リソース一覧
terraform state list

# 特定リソースの詳細
terraform state show module.aurora.aws_rds_cluster.main
```

### リソースの削除

```bash
# 削除プランの確認
terraform plan -destroy

# リソースの削除（注意: すべてのリソースが削除されます）
terraform destroy
```

## トラブルシューティング

### 1. VPC Not Found エラー

```bash
# terraform.tfvarsのvpc_idを確認
# 正しいVPC IDに更新してください
```

### 2. State Lock エラー

```bash
# ロックを強制解除（最終手段）
terraform force-unlock <LOCK_ID>
```

### 3. モジュールの依存関係エラー

```bash
# モジュールを再初期化
terraform init -upgrade
```

## セキュリティ考慮事項

1. **terraform.tfvars**: 本番環境の値はGitにコミットしないでください
2. **Secrets**: データベースパスワードなどはSecrets Managerで自動生成されます
3. **IAM**: 最小権限の原則に従ってください
4. **Audit Logs**: S3に保存される監査ログは定期的にレビューしてください

## コスト管理

### 月間推定コスト（参考値）

**Dev環境**: 約 $500-800/月
- Aurora (r6g.large x2): ~$300
- ElastiCache (r6g.large x2): ~$150
- API Gateway + Lambda: ~$50-100
- CloudFront + WAF: ~$50-150
- その他: ~$50

**Prod環境**: 約 $1,200-1,800/月
- Aurora (r6g.xlarge x3): ~$700
- ElastiCache (r6g.xlarge x3): ~$350
- API Gateway + Lambda: ~$100-200
- CloudFront + WAF: ~$100-300
- その他: ~$100

## サポート

問題が発生した場合は、以下を確認してください:

1. [Terraform AWS Provider ドキュメント](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
2. [AWS サービスステータス](https://status.aws.amazon.com/)
3. プロジェクトのIssueトラッカー

## 次のステップ

1. モジュールの詳細設定: `../../modules/` 配下の各モジュールを確認
2. CI/CD統合: GitHub ActionsやAWS CodePipelineとの統合
3. モニタリング: CloudWatch Dashboardsの設定
4. アラート: CloudWatch Alarmsの設定
