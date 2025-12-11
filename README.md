# AWS Deploy Infrastructure

AWSを知らないアプリ開発者が、シンプルな設定ファイルでコンテナアプリケーションをデプロイできる共通基盤。
**共通認証・課金基盤**により、1,000+のAIプロダクトに統一された認証・決済機能を提供。

## 特徴

- **シンプル**: `terraform.tfvars` を編集するだけ
- **3層アーキテクチャ**: Web + API + Worker
- **コスト最適化**: Fargate Spot、NAT Gateway 1台
- **セキュリティ**: プライベートサブネット、暗号化、IAM最小権限
- **統一認証**: 全プロダクト共通のCognito User Pool（Google/Microsoft OAuth対応）
- **統一課金**: Stripe連携による共通決済基盤

---

## 共通認証・課金基盤

### 概要

1,000+のAIプロダクトに対して、**Googleアカウントのような「1アカウントで全サービス」**体験を提供する共通基盤。

```
┌─────────────────────────────────────────────────────────────────┐
│                         ユーザー                                 │
│            「1つのアカウントで全AIプロダクトを利用」              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CloudFront + CloudFront Function               │
│                    JWT検証 → 認証済みならOriginへ                │
└─────────────────────────────────────────────────────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   ┌─────────┐            ┌─────────┐            ┌─────────┐
   │Product A│            │Product B│            │Product C│
   │MunchCoach│           │AI Dream │            │LINE STEP│
   └─────────┘            └─────────┘            └─────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    共通認証・課金基盤 API                        │
│         Cognito │ Entitlement │ Billing │ Catalog               │
└─────────────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
         ┌─────────┐       ┌─────────┐       ┌─────────┐
         │DynamoDB │       │ Stripe  │       │ Cognito │
         └─────────┘       └─────────┘       └─────────┘
```

### 主要機能

| 機能 | 説明 |
|------|------|
| **統一認証** | Cognito User Pool + Google/Microsoft OAuth + SAML |
| **シングルサインオン** | 一度ログインすれば全プロダクトで有効 |
| **Entitlement API** | 「このユーザーはこのプロダクトを使えるか？」を判定 |
| **統一課金** | Stripe Checkout/Elements（PCI DSS SAQ A準拠） |
| **プラン管理** | 無料/Pro/Enterprise プランの共通管理 |
| **管理者コンソール** | プロダクト別売上、ユーザー数、解約率の可視化 |
| **多言語対応** | 15言語対応（日/英/中/韓/西/仏/独/葡/アラビア語等） |

### 開発者向け統合（3ステップ）

**Step 1: 環境変数を設定**
```bash
PRODUCT_ID=your-product-id
PLATFORM_API_URL=https://api.aidreams-factory.com
```

**Step 2: SDK導入**
```typescript
import { PlatformSDK } from '@aidreams/platform-sdk'

// 認証チェック
const user = await PlatformSDK.requireAuth()

// 利用権チェック
const entitlement = await PlatformSDK.getEntitlement()
if (entitlement.features.premium) {
  // Pro機能を表示
}
```

**Step 3: 使用回数を記録（従量制の場合）**
```typescript
await PlatformSDK.recordUsage(1)
```

### Entitlement APIレスポンス例

```json
{
  "product_id": "munchcoach",
  "plan_id": "pro-monthly",
  "status": "active",
  "features": {
    "high_resolution": true,
    "batch_mode": true
  },
  "usage": {
    "limit": 100,
    "used": 73,
    "remaining": 27
  }
}
```

### デザイン原則

**Steve Jobs / Jony Ive 基準**でUI/UXを設計:

- 説明書なしで直感的に操作できること
- 主要タスクは3クリック以内で完了
- 60fps必須のスムーズなアニメーション
- モノクロベース + 1アクセントカラー（#0071E3）

### 対応言語（15言語）

| 優先度 | 言語 |
|--------|------|
| P0 | 日本語、英語 |
| P1 | 中国語（簡体/繁体）、韓国語、スペイン語 |
| P2 | フランス語、ドイツ語、ポルトガル語、アラビア語 |
| P3 | ヒンディー語、インドネシア語、ベトナム語、タイ語、ロシア語 |

### 非機能要件

| 項目 | 要件 |
|------|------|
| SLO | 99.99% |
| Entitlement API P95 | 200ms以下 |
| PCI DSS | SAQ A（カード情報非保持） |
| 監査ログ保存 | 10年間 |

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              Application Load Balancer (ALB)                 │
│                    HTTPS終端, パスルーティング                │
└──────────────────────────┬──────────────────────────────────┘
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
     ┌─────────┐      ┌─────────┐      ┌─────────┐
     │   Web   │      │   API   │      │ Worker  │
     │ :3000   │      │ :8080   │      │ (no LB) │
     │ Fargate │      │ Fargate │      │ Fargate │
     └─────────┘      └─────────┘      └─────────┘
          │                │                │
          └────────────────┼────────────────┘
                           ▼
     ┌─────────────────────────────────────────────────────────┐
     │                    Data Layer                           │
     │  ┌─────────┐   ┌─────────┐   ┌─────────┐               │
     │  │   RDS   │   │   S3    │   │ Secrets │               │
     │  │ (opt)   │   │ (opt)   │   │ Manager │               │
     │  └─────────┘   └─────────┘   └─────────┘               │
     └─────────────────────────────────────────────────────────┘
```

## クイックスタート

```bash
# 1. クローン
git clone https://github.com/customer-cloud-club/aws-deploy-infrastructure.git
cd aws-deploy-infrastructure/terraform

# 2. 設定
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars を編集

# 3. デプロイ
terraform init
terraform apply
```

## 設定例

### 最小構成（フロントエンドのみ）

```hcl
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
    environment   = { NODE_ENV = "production" }
    command       = []
  }
}
```

### フル構成（Web + API + Worker + DB + S3）

```hcl
project_name = "my-app"
environment  = "prod"

services = {
  web    = { ... }
  api    = { ... }
  worker = { ... }
}

database_enabled        = true
database_engine         = "postgres"
database_instance_class = "db.t3.small"

storage_enabled = true
storage_buckets = ["uploads", "assets"]
```

## ディレクトリ構成

```
aws-deploy-infrastructure/
├── README.md
├── docs/
│   ├── REQUIREMENTS.md      # 要件定義書
│   └── DEPLOY_GUIDE.md      # デプロイガイド
└── terraform/
    ├── main.tf              # メインTerraform設定
    ├── terraform.tfvars.example
    ├── modules/
    │   ├── vpc/             # ネットワーク
    │   ├── ecr/             # コンテナレジストリ
    │   ├── alb/             # ロードバランサー
    │   ├── ecs/             # コンテナオーケストレーション
    │   ├── rds/             # データベース
    │   └── s3/              # ストレージ
    └── examples/
        ├── avatar.tfvars
        ├── line-marketing.tfvars
        └── agents-deploy.tfvars
```

## コスト目安

| 環境 | 構成 | 月額 |
|------|------|------|
| dev | Web + API（最小） | $50-100 |
| staging | Web + API + Worker | $100-200 |
| prod | フル構成 + RDS | $300-500 |

## ドキュメント

- [共通認証・課金基盤 要件定義書](docs/AUTH_BILLING_REQUIREMENTS.md) - 認証・決済基盤の詳細仕様
- [インフラ要件定義書](docs/REQUIREMENTS.md)
- [デプロイガイド](docs/DEPLOY_GUIDE.md)

## 対象アカウント

- Account ID: `805673386383`
- Account Name: `dev-shared-infrastructure`
- Region: `ap-northeast-1`

## サポート

Customer Cloud Club 内部向け基盤です。
問題がある場合はSlackで相談してください。
