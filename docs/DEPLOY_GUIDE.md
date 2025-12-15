# デプロイガイド

AWSを知らない開発者でも、このガイドに従えばアプリケーションをデプロイできます。

## 前提条件

- Docker がインストールされていること
- Terraform がインストールされていること
- AWS CLI がインストールされていること

```bash
# 確認コマンド
docker --version
terraform --version
aws --version
```

---

## クイックスタート（5ステップ）

### Step 1: AWS認証設定

```bash
# AWSプロファイル設定（初回のみ）
aws configure --profile dev-shared-infra

# 以下を入力:
# AWS Access Key ID: （管理者から受け取ったキー）
# AWS Secret Access Key: （管理者から受け取ったシークレット）
# Default region name: ap-northeast-1
# Default output format: json

# 環境変数設定
export AWS_PROFILE=dev-shared-infra
```

### Step 2: プロジェクト設定

```bash
# リポジトリをクローン
git clone https://github.com/customer-cloud-club/aws-deploy-infrastructure.git
cd aws-deploy-infrastructure/terraform

# 設定ファイルをコピー
cp terraform.tfvars.example terraform.tfvars

# 設定を編集
# - project_name: あなたのプロジェクト名
# - environment: dev, staging, prod のいずれか
# - services: デプロイするサービス
```

### Step 3: Dockerイメージをビルド＆プッシュ

```bash
# ECRにログイン
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin 805673386383.dkr.ecr.ap-northeast-1.amazonaws.com

# イメージをビルド（あなたのアプリディレクトリで実行）
docker build -t my-app-web ./frontend
docker build -t my-app-api ./backend

# タグ付け
docker tag my-app-web:latest 805673386383.dkr.ecr.ap-northeast-1.amazonaws.com/my-app-dev/web:latest
docker tag my-app-api:latest 805673386383.dkr.ecr.ap-northeast-1.amazonaws.com/my-app-dev/api:latest

# プッシュ
docker push 805673386383.dkr.ecr.ap-northeast-1.amazonaws.com/my-app-dev/web:latest
docker push 805673386383.dkr.ecr.ap-northeast-1.amazonaws.com/my-app-dev/api:latest
```

### Step 4: インフラをデプロイ

```bash
cd terraform

# 初期化
terraform init

# プラン確認（何が作成されるか確認）
terraform plan

# デプロイ実行
terraform apply

# 確認プロンプトで "yes" を入力
```

### Step 5: 動作確認

```bash
# デプロイ完了後、URLが表示されます
# Outputs:
# app_url = "http://my-app-dev-alb-123456789.ap-northeast-1.elb.amazonaws.com"

# ブラウザでアクセスして動作確認
```

---

## 設定ファイルの書き方

### 基本構成（フロントエンドのみ）

```hcl
# terraform.tfvars
project_name = "my-app"
environment  = "dev"

services = {
  web = {
    image         = "805673386383.dkr.ecr.ap-northeast-1.amazonaws.com/my-app-dev/web:latest"
    port          = 3000
    cpu           = 256
    memory        = 512
    desired_count = 1
    health_check  = "/health"
    path_pattern  = ["/*"]
    priority      = 100
    environment   = {
      NODE_ENV = "production"
    }
    command = []
  }
}

database_enabled = false
storage_enabled  = false
```

### API + フロントエンド構成

```hcl
services = {
  web = {
    image         = ".../web:latest"
    port          = 3000
    cpu           = 256
    memory        = 512
    desired_count = 1
    health_check  = "/health"
    path_pattern  = ["/*"]
    priority      = 100
    environment   = { NODE_ENV = "production" }
    command       = []
  }

  api = {
    image         = ".../api:latest"
    port          = 8080
    cpu           = 512
    memory        = 1024
    desired_count = 2
    health_check  = "/api/health"
    path_pattern  = ["/api/*"]
    priority      = 10
    environment   = {
      NODE_ENV     = "production"
      DATABASE_URL = "postgresql://..."
    }
    command       = []
  }
}

database_enabled = true
database_engine  = "postgres"
```

### バックグラウンドワーカー追加

```hcl
services = {
  # ... web, api ...

  worker = {
    image         = ".../worker:latest"
    port          = 0              # ALBに接続しない
    cpu           = 256
    memory        = 512
    desired_count = 1
    health_check  = ""
    path_pattern  = []
    priority      = 0
    environment   = { REDIS_URL = "redis://..." }
    command       = ["celery", "-A", "tasks", "worker"]
  }
}
```

---

## よくある操作

### イメージ更新（再デプロイ）

```bash
# 新しいイメージをビルド＆プッシュ
docker build -t my-app-api ./backend
docker tag my-app-api:latest 805673386383.dkr.ecr.ap-northeast-1.amazonaws.com/my-app-dev/api:latest
docker push 805673386383.dkr.ecr.ap-northeast-1.amazonaws.com/my-app-dev/api:latest

# ECSサービスを更新（新しいイメージで起動）
aws ecs update-service \
  --cluster my-app-dev-cluster \
  --service my-app-dev-api \
  --force-new-deployment
```

### ログを確認

```bash
# CloudWatch Logsでログ確認
aws logs tail /ecs/my-app-dev --follow
```

### スケールアウト

```bash
# レプリカ数を増やす
aws ecs update-service \
  --cluster my-app-dev-cluster \
  --service my-app-dev-api \
  --desired-count 4
```

### 環境変数を更新

```bash
# terraform.tfvars の environment を編集
terraform apply
```

### インフラ削除

```bash
# 全リソースを削除
terraform destroy

# 確認プロンプトで "yes" を入力
```

---

## トラブルシューティング

### デプロイが失敗する

1. **ヘルスチェックパスを確認**
   ```hcl
   health_check = "/health"  # アプリがこのパスで 200 を返すか確認
   ```

2. **ログを確認**
   ```bash
   aws logs tail /ecs/my-app-dev --follow
   ```

3. **タスク停止理由を確認**
   ```bash
   aws ecs describe-tasks \
     --cluster my-app-dev-cluster \
     --tasks $(aws ecs list-tasks --cluster my-app-dev-cluster --query 'taskArns[0]' --output text)
   ```

### アプリにアクセスできない

1. **ALB DNS名を確認**
   ```bash
   terraform output app_url
   ```

2. **セキュリティグループを確認**
   - ポート80/443が開いているか

3. **ターゲットグループのヘルスを確認**
   ```bash
   aws elbv2 describe-target-health \
     --target-group-arn $(aws elbv2 describe-target-groups --names my-app-dev-web-tg --query 'TargetGroups[0].TargetGroupArn' --output text)
   ```

### データベースに接続できない

1. **シークレットを確認**
   ```bash
   aws secretsmanager get-secret-value \
     --secret-id my-app-dev/rds-credentials \
     --query 'SecretString' --output text | jq
   ```

2. **セキュリティグループ確認**
   - ECSからRDSへの通信が許可されているか

---

## API Gateway カスタムドメイン設定

API Gatewayにカスタムドメインでアクセスできるようにするためのセットアップ手順です。

### 前提条件

- Route53でホストゾーンが設定されていること
- 対象のAWSアカウントへのアクセス権限があること

### 環境別ドメイン例

| 環境 | ドメイン例 |
|------|-----------|
| Dev | `cc-auth-dev.your-domain.com` |
| Prod | `cc-auth.your-domain.com` |

### Step 1: ACM証明書の作成

API Gatewayアカウントで証明書を作成します。

```bash
# 環境変数設定
export DOMAIN_NAME="cc-auth-dev.your-domain.com"  # 開発用
# export DOMAIN_NAME="cc-auth.your-domain.com"    # 本番用

export API_GW_PROFILE="your-api-gateway-profile"
export ROUTE53_PROFILE="your-route53-profile"
export REGION="ap-northeast-1"

# ACM証明書をリクエスト
aws acm request-certificate \
  --domain-name $DOMAIN_NAME \
  --validation-method DNS \
  --region $REGION \
  --profile $API_GW_PROFILE

# 証明書ARNを取得（出力をメモ）
# 例: arn:aws:acm:ap-northeast-1:123456789012:certificate/xxx-xxx-xxx
```

### Step 2: DNS検証レコードの追加

```bash
# 証明書ARNを設定
export CERT_ARN="arn:aws:acm:ap-northeast-1:123456789012:certificate/xxx-xxx-xxx"

# DNS検証レコード情報を取得
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region $REGION \
  --profile $API_GW_PROFILE \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'

# 出力例:
# {
#     "Name": "_abc123.cc-auth-dev.your-domain.com.",
#     "Type": "CNAME",
#     "Value": "_xyz789.acm-validations.aws."
# }

# Route53ホストゾーンIDを取得
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name your-domain.com \
  --profile $ROUTE53_PROFILE \
  --query 'HostedZones[0].Id' \
  --output text | sed 's|/hostedzone/||')

echo "Hosted Zone ID: $HOSTED_ZONE_ID"

# DNS検証レコードを追加（上記で取得した値を使用）
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --profile $ROUTE53_PROFILE \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "_abc123.cc-auth-dev.your-domain.com.",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "_xyz789.acm-validations.aws."}]
      }
    }]
  }'
```

### Step 3: 証明書発行を待機

```bash
# 証明書ステータスを確認（ISSUED になるまで待機）
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region $REGION \
  --profile $API_GW_PROFILE \
  --query 'Certificate.Status'

# 通常1-5分で ISSUED になります
```

### Step 4: API Gatewayカスタムドメイン作成

```bash
# API Gateway IDを取得
API_ID=$(aws apigateway get-rest-apis \
  --region $REGION \
  --profile $API_GW_PROFILE \
  --query "items[?name=='dev-auth-billing'].id" \
  --output text)

# 本番の場合: items[?name=='prod-auth-billing'].id

echo "API Gateway ID: $API_ID"

# カスタムドメインを作成
aws apigateway create-domain-name \
  --domain-name $DOMAIN_NAME \
  --regional-certificate-arn $CERT_ARN \
  --endpoint-configuration types=REGIONAL \
  --security-policy TLS_1_2 \
  --region $REGION \
  --profile $API_GW_PROFILE

# 出力から regionalDomainName と regionalHostedZoneId をメモ
# 例:
# "regionalDomainName": "d-abc123.execute-api.ap-northeast-1.amazonaws.com"
# "regionalHostedZoneId": "Z1YSHQZHG15GKL"
```

### Step 5: ベースパスマッピング作成

```bash
# ステージ名を設定（dev または prod）
STAGE="dev"

# ベースパスマッピングを作成
aws apigateway create-base-path-mapping \
  --domain-name $DOMAIN_NAME \
  --rest-api-id $API_ID \
  --stage $STAGE \
  --region $REGION \
  --profile $API_GW_PROFILE
```

### Step 6: Route53 Aliasレコード作成

```bash
# Step 4で取得した値を設定
REGIONAL_DOMAIN="d-abc123.execute-api.ap-northeast-1.amazonaws.com"
REGIONAL_HOSTED_ZONE_ID="Z1YSHQZHG15GKL"

# Route53にAliasレコードを作成
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --profile $ROUTE53_PROFILE \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "'$DOMAIN_NAME'",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "'$REGIONAL_HOSTED_ZONE_ID'",
          "DNSName": "'$REGIONAL_DOMAIN'",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

### Step 7: 動作確認

```bash
# DNS伝播を待機（通常数秒〜数分）
sleep 15

# エンドポイントをテスト
curl https://$DOMAIN_NAME/catalog/products

# 期待される応答:
# {"items":[...],"total":3,"page":1,"per_page":20,"has_more":false}
```

### クロスアカウント設定時の注意

Route53とAPI Gatewayが異なるAWSアカウントにある場合：

1. **Route53アカウント**でDNSレコードを管理
2. **API Gatewayアカウント**でACM証明書とカスタムドメインを作成
3. 両方のアカウントの認証情報が必要

```bash
# 例: 2つのアカウントを使用
export ROUTE53_PROFILE="route53-account-profile"      # Route53があるアカウント
export API_GW_PROFILE="api-gateway-account-profile"   # API Gatewayがあるアカウント
```

### 設定済み環境

| 環境 | ドメイン | API Gateway ID |
|------|----------|----------------|
| Dev | `cc-auth-dev.aidreams-factory.com` | `mq1rpmutq0` |
| Prod | `cc-auth.aidreams-factory.com` | `9sdlempnx9` |

---

## サポート

問題が解決しない場合は、以下の情報と共にSlackで相談してください：

- プロジェクト名
- 環境（dev/staging/prod）
- エラーメッセージ
- `terraform plan` の出力
- CloudWatch Logsのエラーログ
