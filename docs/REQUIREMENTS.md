# 開発者共通基盤 要件定義書

## 1. 概要

### 1.1 目的
AWSを知らないアプリ開発者が、シンプルな設定ファイル（`app.yaml`）を記述するだけでコンテナアプリケーションをデプロイできる共通基盤を提供する。

### 1.2 対象ユーザー
- AWSの知識がないアプリ開発者
- Docker/コンテナの基本的な知識があるエンジニア
- フロントエンド/バックエンド開発者

### 1.3 対象プロダクト例
- avatar: AIアバターサービス
- agents-deploy-aws: AIエージェント基盤
- senegal-bank: 金融系アプリ
- LINE_Marketing: マーケティングツール
- ai-course-gen: AI教育コンテンツ生成

---

## 2. アーキテクチャ

### 2.1 3層コンテナアーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Application Load Balancer                  │
│                    (HTTPS終端, SSL証明書)                    │
└─────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Web Layer     │ │   API Layer     │ │  Worker Layer   │
│   (Frontend)    │ │   (Backend)     │ │  (Background)   │
│   Port: 3000    │ │   Port: 8080    │ │   No Port       │
│   ECS Fargate   │ │   ECS Fargate   │ │   ECS Fargate   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
           │                  │                  │
           └──────────────────┼──────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   RDS       │  │  DynamoDB   │  │    S3       │         │
│  │ (PostgreSQL)│  │  (NoSQL)    │  │  (Storage)  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 レイヤー定義

| レイヤー | 役割 | 技術 | 特徴 |
|---------|------|------|------|
| Web | フロントエンド配信 | ECS Fargate | Next.js, React, Vue |
| API | バックエンドAPI | ECS Fargate | FastAPI, Express, Go |
| Worker | バックグラウンド処理 | ECS Fargate | Celery, Bull, etc |
| Data | データ永続化 | RDS/DynamoDB/S3 | 選択式 |

---

## 3. 開発者が記述するもの

### 3.1 app.yaml（アプリ定義ファイル）

```yaml
# app.yaml - これだけ書けばデプロイできる
name: my-ai-app
environment: dev  # dev | staging | prod

# サービス定義
services:
  # フロントエンド
  web:
    build: ./frontend
    port: 3000
    cpu: 256      # 0.25 vCPU
    memory: 512   # 512 MB
    replicas: 1
    env_file: .env.web
    health_check: /health

  # バックエンドAPI
  api:
    build: ./backend
    port: 8080
    cpu: 512
    memory: 1024
    replicas: 2
    env_file: .env.api
    health_check: /api/health

  # バックグラウンドワーカー（オプション）
  worker:
    build: ./worker
    cpu: 256
    memory: 512
    replicas: 1
    env_file: .env.worker
    command: ["python", "-m", "celery", "worker"]

# データベース（オプション）
database:
  type: postgres  # postgres | mysql | none
  size: small     # small | medium | large

# ストレージ（オプション）
storage:
  enabled: true
  buckets:
    - uploads
    - assets

# ドメイン設定
domain:
  name: my-app.example.com  # カスタムドメイン or 自動生成
```

### 3.2 必要なファイル構成

```
my-app/
├── app.yaml           # アプリ定義（必須）
├── frontend/
│   ├── Dockerfile     # フロントエンドコンテナ
│   └── ...
├── backend/
│   ├── Dockerfile     # バックエンドコンテナ
│   └── ...
├── worker/            # オプション
│   ├── Dockerfile
│   └── ...
├── .env.web           # 環境変数
├── .env.api
└── .env.worker
```

---

## 4. デプロイフロー

### 4.1 開発者の操作（3ステップのみ）

```bash
# 1. CLIインストール
npm install -g @customer-cloud/deploy-cli

# 2. ログイン
cc-deploy login

# 3. デプロイ
cc-deploy up
```

### 4.2 内部処理フロー

```
開発者: cc-deploy up
           │
           ▼
┌─────────────────────────────────────────┐
│  1. app.yaml の読み込み・バリデーション   │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  2. Dockerイメージのビルド               │
│     - frontend -> ECR push              │
│     - backend -> ECR push               │
│     - worker -> ECR push                │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  3. Terraformテンプレート生成            │
│     - tfvars自動生成                     │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  4. terraform apply                      │
│     - VPC/Subnet                        │
│     - ALB                               │
│     - ECS Cluster/Service               │
│     - RDS（必要時）                      │
│     - S3（必要時）                       │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  5. URL出力                              │
│     https://my-app.example.com          │
└─────────────────────────────────────────┘
```

---

## 5. 機能要件

### 5.1 必須機能

| ID | 機能 | 説明 |
|----|------|------|
| F-001 | コンテナデプロイ | Dockerfileからコンテナをデプロイ |
| F-002 | オートスケール | CPU/メモリベースの自動スケーリング |
| F-003 | ヘルスチェック | 自動復旧機能付きヘルスチェック |
| F-004 | HTTPS対応 | 自動SSL証明書取得・更新 |
| F-005 | ログ出力 | CloudWatch Logsへの自動ログ収集 |
| F-006 | 環境変数 | .envファイルからの環境変数注入 |
| F-007 | シークレット管理 | Secrets Managerとの連携 |

### 5.2 オプション機能

| ID | 機能 | 説明 |
|----|------|------|
| F-101 | RDS | PostgreSQL/MySQL自動プロビジョニング |
| F-102 | S3 | オブジェクトストレージ自動作成 |
| F-103 | カスタムドメイン | Route53連携 |
| F-104 | CI/CD | GitHub Actions連携 |
| F-105 | 監視アラート | CloudWatch Alarms |

---

## 6. 非機能要件

### 6.1 可用性
- SLA: 99.9%（月間ダウンタイム43分以内）
- マルチAZ構成
- 自動フェイルオーバー

### 6.2 セキュリティ
- VPC内プライベートサブネットでの実行
- セキュリティグループによるアクセス制御
- IAMロールによる最小権限
- データ暗号化（at rest / in transit）

### 6.3 コスト目安

| 環境 | 構成 | 月額目安 |
|------|------|----------|
| dev | Web+API（最小構成） | $50-100 |
| staging | Web+API+Worker | $100-200 |
| prod | Web+API+Worker+RDS | $300-500 |

### 6.4 スケーラビリティ
- 最大10レプリカまで自動スケール
- CPU 70%超過でスケールアウト
- CPU 30%未満でスケールイン

---

## 7. 制約事項

### 7.1 技術的制約
- コンテナイメージサイズ: 最大10GB
- 単一リージョン: ap-northeast-1（東京）
- Fargateのみ（EC2インスタンス不可）

### 7.2 運用制約
- デプロイ所要時間: 5-15分
- ロールバック: 直前バージョンのみ
- ログ保持期間: 30日

---

## 8. 今後の拡張予定

- [ ] GPU対応（ML/AI推論用）
- [ ] マルチリージョン対応
- [ ] Blue/Greenデプロイ
- [ ] カナリアリリース
- [ ] WAF統合
