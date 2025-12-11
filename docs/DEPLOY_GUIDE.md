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

## サポート

問題が解決しない場合は、以下の情報と共にSlackで相談してください：

- プロジェクト名
- 環境（dev/staging/prod）
- エラーメッセージ
- `terraform plan` の出力
- CloudWatch Logsのエラーログ
