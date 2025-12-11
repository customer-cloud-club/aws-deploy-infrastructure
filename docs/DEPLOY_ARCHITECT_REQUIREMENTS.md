# Deploy Architect エージェント 要件定義書

**バージョン:** 1.0
**最終更新:** 2025-12-11
**ステータス:** ドラフト

---

## 1. 概要

### 1.1 目的

GitHub の AI プロダクトリポジトリを解析し、最適な AWS アーキテクチャを自動選定、IaC（Terraform/CDK）と CI/CD（GitHub Actions）を生成してデプロイまで実行する自律型エージェント。

### 1.2 背景・課題

現在、AI プロダクトの AWS デプロイには以下の課題がある：

| 課題 | 詳細 |
|------|------|
| **アーキテクチャ選定の難しさ** | App Runner / Lambda / ECS Fargate など選択肢が多く、最適解の判断に専門知識が必要 |
| **IaC 作成の工数** | Terraform / CDK の作成に数日〜数週間かかる |
| **CI/CD 構築の複雑さ** | GitHub Actions + AWS 連携の設定が複雑 |
| **運用知識の属人化** | デプロイノウハウが特定メンバーに集中 |

### 1.3 解決策

**Deploy Architect エージェント**が以下を自動化：

1. リポジトリ解析によるプロダクト特性の推定
2. 非機能要件に基づくアーキテクチャ自動選定
3. Terraform / GitHub Actions コードの自動生成
4. ワンクリックでのデプロイ実行

### 1.4 期待効果

| 指標 | Before | After |
|------|--------|-------|
| アーキテクチャ選定 | 数日（専門家相談） | 数分（自動） |
| IaC 作成 | 数日〜数週間 | 数分（自動生成） |
| CI/CD 構築 | 数時間〜数日 | 数分（自動生成） |
| デプロイ実行 | 手動作業 | 自動実行 |

---

## 2. スコープ

### 2.1 対象

- GitHub にホストされた AI プロダクト（Python / Node.js / Go）
- AWS 東京リージョン（ap-northeast-1）へのデプロイ
- コンテナベースのアプリケーション

### 2.2 対象外（Phase 1）

- AWS 以外のクラウド（GCP / Azure）
- Kubernetes（EKS）ベースのデプロイ
- マルチリージョン構成
- GPU インスタンスを必要とするワークロード

---

## 3. 機能要件

### 3.1 入力パラメータ

#### 3.1.1 必須パラメータ

| パラメータ | 型 | 説明 | 例 |
|-----------|-----|------|-----|
| `product_repo_url` | string | GitHub リポジトリ URL | `https://github.com/org/ai-app` |

#### 3.1.2 オプションパラメータ

| パラメータ | 型 | 説明 | デフォルト |
|-----------|-----|------|-----------|
| `product_type_hint` | string | プロダクトタイプのヒント | 自動推定 |
| `max_response_time_sec` | number | 最大レスポンス時間（秒） | 30 |
| `max_job_duration_sec` | number | 最大ジョブ実行時間（秒） | 30 |
| `expected_rps` | number | 想定リクエスト/秒 | 50 |
| `peak_rps` | number | ピーク時リクエスト/秒 | 200 |
| `region` | string | AWS リージョン | ap-northeast-1 |
| `need_private_vpc` | boolean | プライベート VPC 要否 | false |
| `need_websocket` | boolean | WebSocket 対応要否 | false |

#### 3.1.3 プロダクトタイプ

| タイプ | 説明 | 例 |
|--------|------|-----|
| `sync-api` | 通常の同期 Web API / Web アプリ | REST API、管理画面 |
| `rag-api` | RAG を伴うチャット API | LangChain ベースのチャットボット |
| `long-job` | 5分以上かかるバッチ/ジョブ系 | 動画生成、大規模データ処理 |
| `websocket-chat` | WebSocket ベースの常時接続チャット | リアルタイムチャット |

### 3.2 出力

| 出力 | 型 | 説明 |
|------|-----|------|
| `selected_architecture` | string | 選定されたアーキテクチャ |
| `architecture_diagram_markdown` | string | アーキテクチャ図（Mermaid/PlantUML） |
| `infra_templates.terraform` | string | Terraform コード |
| `infra_templates.github_actions` | string | GitHub Actions ワークフロー |
| `deploy_plan` | string | デプロイ手順書 |
| `deployed_endpoints` | array | デプロイ済みエンドポイント一覧 |

### 3.3 リポジトリ解析機能

#### 3.3.1 言語・フレームワーク検出

| 検出対象 | 判定方法 |
|---------|---------|
| Python | `requirements.txt`, `pyproject.toml`, `setup.py` |
| Node.js | `package.json` |
| Go | `go.mod` |
| Rust | `Cargo.toml` |

#### 3.3.2 フレームワーク検出

| フレームワーク | 検出キーワード |
|---------------|---------------|
| FastAPI | `fastapi`, `uvicorn` |
| Flask | `flask` |
| Django | `django` |
| Express | `express` |
| NestJS | `@nestjs/core` |
| Next.js | `next` |

#### 3.3.3 AI/ML ライブラリ検出

| ライブラリ | 用途 | 影響 |
|-----------|------|------|
| `langchain` | RAG フレームワーク | 処理時間増加 |
| `llama-index` | RAG フレームワーク | 処理時間増加 |
| `openai` | OpenAI API | 外部 API 依存 |
| `anthropic` | Claude API | 外部 API 依存 |
| `boto3` + `bedrock` | Bedrock | AWS サービス依存 |
| `chromadb` | Vector DB | 追加インフラ必要 |
| `pinecone` | Vector DB | 外部サービス依存 |

#### 3.3.4 その他の検出項目

- Dockerfile / docker-compose の有無
- 既存の IaC（Terraform / CDK）の有無
- 既存の CI/CD ワークフローの有無
- 環境変数の定義（`.env.example`）

### 3.4 アーキテクチャ選定機能

#### 3.4.1 選定ルール

```
┌─────────────────────────────────────────────────────────────────────┐
│                      アーキテクチャ選定フロー                        │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ WebSocket が必要？     │
                    └───────────────────────┘
                         │YES         │NO
                         ▼            ▼
              ┌──────────────┐  ┌───────────────────────┐
              │ECS Fargate   │  │ max_job_duration は？  │
              │API           │  └───────────────────────┘
              └──────────────┘       │
                              ┌──────┼──────┬──────────┐
                              ▼      ▼      ▼          ▼
                          ≤30秒  30〜900秒  >900秒   ≤3秒 & ≤20RPS
                              │      │      │          │
                              ▼      ▼      ▼          ▼
                        ┌────────┐┌────────┐┌────────┐┌────────┐
                        │App     ││App     ││App     ││Lambda  │
                        │Runner  ││Runner  ││Runner  ││API     │
                        │Direct  ││+Lambda ││+Fargate││Gateway │
                        └────────┘└────────┘└────────┘└────────┘
```

#### 3.4.2 選定ルール詳細

| ルールID | 条件 | 選定アーキテクチャ |
|----------|------|-------------------|
| `rule-app-runner-direct` | `max_job_duration <= 30` AND `no WebSocket` AND `no heavy RAG` | `app-runner-direct` |
| `rule-app-runner-async-lambda` | `30 < max_job_duration <= 900` AND `no WebSocket` | `app-runner-async-lambda` |
| `rule-app-runner-async-fargate` | `max_job_duration > 900` AND `no WebSocket` | `app-runner-async-fargate` |
| `rule-ecs-fargate-api` | `need_websocket = true` | `ecs-fargate-api` |
| `rule-lambda-api` | `max_response_time <= 3` AND `expected_rps <= 20` AND `no long job` | `lambda-api` |

### 3.5 IaC 生成機能

#### 3.5.1 Terraform モジュール

| モジュール | 用途 | 対応アーキテクチャ |
|-----------|------|-------------------|
| `app-runner` | App Runner サービス | app-runner-* |
| `async-worker` | SQS + Lambda/Fargate | app-runner-async-* |
| `ecs` | ECS Fargate サービス | ecs-fargate-api |
| `lambda` | Lambda 関数 | lambda-api |
| `api-gateway` | API Gateway | lambda-api |
| `vpc` | VPC / サブネット | 全アーキテクチャ |
| `ecr` | コンテナレジストリ | 全アーキテクチャ |

#### 3.5.2 生成される Terraform 構成

```hcl
# 生成されるファイル構成
terraform/
├── main.tf              # メインリソース定義
├── variables.tf         # 変数定義
├── outputs.tf           # 出力定義
├── terraform.tfvars     # 変数値（環境別）
└── modules/
    ├── app-runner/      # App Runner モジュール
    ├── async-worker/    # 非同期ワーカーモジュール
    └── ...
```

### 3.6 CI/CD 生成機能

#### 3.6.1 GitHub Actions ワークフロー

| ワークフロー | 用途 |
|-------------|------|
| `deploy-app-runner.yml` | App Runner へのデプロイ |
| `deploy-ecs-fargate.yml` | ECS Fargate へのデプロイ |
| `deploy-lambda.yml` | Lambda へのデプロイ |

#### 3.6.2 ワークフロー機能

- ECR へのイメージプッシュ
- 環境別デプロイ（dev / staging / prod）
- ヘルスチェック
- Slack 通知
- ロールバック機能

### 3.7 デプロイ実行機能

#### 3.7.1 デプロイフロー

```
1. terraform plan 実行
   ↓
2. 差分表示・ユーザー確認
   ↓
3. terraform apply 実行（承認後）
   ↓
4. エンドポイント URL 取得
   ↓
5. ヘルスチェック実行
   ↓
6. 結果レポート出力
```

#### 3.7.2 ロールバック

- 自動ロールバック条件：ヘルスチェック失敗
- 手動ロールバック：`terraform apply -target=previous_version`

---

## 4. アーキテクチャプリセット

### 4.1 App Runner Direct

**用途**: シンプルな同期 API / Web アプリ（処理時間 ≤ 30秒）

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────┐
│   GitHub    │────▶│   AWS App Runner    │────▶│   Bedrock   │
│   Actions   │     │   (Auto Deploy)     │     │   / RDS     │
└─────────────┘     └─────────────────────┘     └─────────────┘
```

**コンポーネント:**
- AWS App Runner
- Amazon ECR
- GitHub Actions
- (オプション) RDS / DynamoDB / S3 / Bedrock

**コスト目安:** $30〜100/月

**メリット:**
- 最もシンプル、運用負荷最小
- オートスケール標準搭載
- GitHub 連携で自動デプロイ

**デメリット:**
- 最大リクエストタイムアウト 120秒
- VPC 内リソースへのアクセスに制限あり

---

### 4.2 App Runner + Async Lambda

**用途**: RAG / LLM で 30秒〜15分かかる処理

```
┌──────────┐     ┌─────────────┐     ┌─────────┐     ┌─────────────┐
│  Client  │────▶│ App Runner  │────▶│   SQS   │────▶│   Lambda    │
│          │     │ (REST API)  │     │  Queue  │     │  (Worker)   │
└──────────┘     └─────────────┘     └─────────┘     └─────────────┘
                        │                                   │
                        │           ┌─────────────┐         │
                        └──────────▶│  DynamoDB   │◀────────┘
                                    │ (Job Store) │
                                    └─────────────┘
```

**コンポーネント:**
- AWS App Runner (REST API)
- Amazon SQS (ジョブキュー)
- AWS Lambda (RAG / LLM ワーカー、最大15分)
- DynamoDB (ジョブストア)
- (オプション) Bedrock / OpenSearch

**コスト目安:** $50〜200/月

**API フロー:**
1. `POST /jobs` → ジョブ作成、SQS にキュー投入、`job_id` 返却
2. Lambda がキューから取り出して処理
3. `GET /jobs/{id}` → ステータス・結果取得

**メリット:**
- 非同期処理で長時間タスクに対応
- Lambda のスケーラビリティ
- コスト効率（実行時間課金）

**デメリット:**
- Lambda 最大15分の制限
- ポーリングまたは Webhook による結果取得が必要

---

### 4.3 App Runner + Async Fargate

**用途**: 15分以上かかる重い処理（動画生成、大規模データ処理）

```
┌──────────┐     ┌─────────────┐     ┌─────────┐     ┌─────────────┐
│  Client  │────▶│ App Runner  │────▶│   SQS   │────▶│   Fargate   │
│          │     │ (REST API)  │     │  Queue  │     │  (Worker)   │
└──────────┘     └─────────────┘     └─────────┘     └─────────────┘
                        │                                   │
                        │           ┌─────────────┐         │
                        └──────────▶│     S3      │◀────────┘
                                    │ (Results)   │
                                    └─────────────┘
```

**コンポーネント:**
- AWS App Runner
- Amazon SQS
- Amazon ECS on Fargate (worker service、時間無制限)
- S3 / DynamoDB

**コスト目安:** $100〜500/月

**メリット:**
- 処理時間無制限
- Fargate の柔軟なリソース設定

**デメリット:**
- Fargate は常時起動コストがかかる
- スケールアップに時間がかかる

---

### 4.4 ECS Fargate API

**用途**: WebSocket / 高度なネットワーク要件

```
┌──────────┐     ┌─────────────┐     ┌─────────────────────┐
│  Client  │────▶│     ALB     │────▶│   ECS Fargate       │
│          │◀───│  (HTTP/WS)  │◀────│   (API Service)     │
└──────────┘     └─────────────┘     └─────────────────────┘
                                              │
                        ┌─────────────────────┼─────────────────────┐
                        ▼                     ▼                     ▼
                   ┌─────────┐          ┌─────────┐          ┌─────────┐
                   │   RDS   │          │ Bedrock │          │   S3    │
                   └─────────┘          └─────────┘          └─────────┘
```

**コンポーネント:**
- Amazon ECS on Fargate
- Application Load Balancer (HTTP/WebSocket)
- VPC 内各種リソース

**コスト目安:** $150〜600/月

**メリット:**
- WebSocket 対応
- VPC 内リソースへのフルアクセス
- 高度なネットワーク設定が可能

**デメリット:**
- 構成が複雑
- ALB の固定コストがかかる

---

### 4.5 Lambda API Gateway

**用途**: 軽量 API、低 RPS

```
┌──────────┐     ┌─────────────┐     ┌─────────────┐
│  Client  │────▶│ API Gateway │────▶│   Lambda    │
│          │◀────│  (HTTP API) │◀────│  (Handler)  │
└──────────┘     └─────────────┘     └─────────────┘
```

**コンポーネント:**
- Amazon API Gateway (HTTP API)
- AWS Lambda
- DynamoDB / S3

**コスト目安:** $5〜50/月

**メリット:**
- 最低コスト（リクエスト課金）
- サーバーレス、運用不要
- 自動スケール

**デメリット:**
- コールドスタート
- 最大15分の処理時間制限
- ペイロードサイズ制限（6MB）

---

## 5. ワークフロー

### 5.1 全体フロー

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Deploy Architect ワークフロー                 │
└─────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐
  │   START     │
  └──────┬──────┘
         │
         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 1: リポジトリ解析                                           │
  │ - 言語・フレームワーク特定                                        │
  │ - AI/ML ライブラリ検出                                           │
  │ - Dockerfile / IaC 有無確認                                      │
  └──────────────────────────────┬──────────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 2: 非機能要件推定                                           │
  │ - 処理時間推定                                                   │
  │ - RPS 推定                                                       │
  │ - ユーザー入力とマージ                                            │
  └──────────────────────────────┬──────────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 3: アーキテクチャ選定                                        │
  │ - decision_rules 評価                                            │
  │ - 最適アーキテクチャ選択                                          │
  │ - 選定理由ドキュメント化                                          │
  └──────────────────────────────┬──────────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 4: IaC / CI/CD 生成                                         │
  │ - Terraform コード生成                                           │
  │ - GitHub Actions ワークフロー生成                                 │
  │ - IAM ロール / ポリシー生成                                       │
  └──────────────────────────────┬──────────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 5: デプロイ実行                                             │
  │ - terraform plan 実行                                            │
  │ - ユーザー承認                                                   │
  │ - terraform apply 実行                                           │
  │ - エンドポイント URL 取得                                         │
  └──────────────────────────────┬──────────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 6: 結果レポート                                             │
  │ - アーキテクチャ図生成                                            │
  │ - エンドポイント一覧                                              │
  │ - 将来の拡張パス記述                                              │
  └──────────────────────────────┬──────────────────────────────────┘
                                 │
                                 ▼
                          ┌─────────────┐
                          │    END      │
                          └─────────────┘
```

### 5.2 各ステップの詳細

#### Step 1: リポジトリ解析

| アクション | 詳細 |
|-----------|------|
| 言語特定 | `requirements.txt`, `package.json`, `go.mod` などから判定 |
| フレームワーク特定 | 依存関係から FastAPI / Express / NestJS などを判定 |
| エントリポイント特定 | `main.py`, `server.ts`, `Dockerfile` の `CMD` / `ENTRYPOINT` |
| AI/ML ライブラリ検出 | `langchain`, `openai`, `anthropic`, `boto3` などの有無 |
| Dockerfile 確認 | コンテナ化済みかどうか |
| 既存 IaC 確認 | `terraform/`, `cdk/` の有無 |

#### Step 2: 非機能要件推定

| 推定項目 | 推定方法 |
|---------|---------|
| `max_response_time_sec` | API エンドポイントの処理内容から推定 |
| `max_job_duration_sec` | RAG / LLM 呼び出し回数から推定 |
| `expected_rps` | ユーザー入力 or デフォルト値 |
| `peak_rps` | ユーザー入力 or デフォルト値 |

#### Step 3: アーキテクチャ選定

1. `decision_rules` を上から順に評価
2. 最初にマッチしたルールのアーキテクチャを選択
3. 選定理由をテキスト化
4. トレードオフ（将来の拡張パス）を説明

#### Step 4: IaC / CI/CD 生成

| 生成物 | 内容 |
|--------|------|
| `main.tf` | メインリソース定義 |
| `variables.tf` | 変数定義 |
| `outputs.tf` | 出力定義 |
| `terraform.tfvars` | 環境別変数値 |
| `.github/workflows/deploy.yml` | デプロイワークフロー |

#### Step 5: デプロイ実行

1. `terraform init` - プロバイダ初期化
2. `terraform plan` - 差分確認
3. ユーザー承認待ち
4. `terraform apply` - リソース作成
5. エンドポイント URL 取得
6. ヘルスチェック実行

#### Step 6: 結果レポート

| 出力項目 | 内容 |
|---------|------|
| アーキテクチャ図 | Mermaid / PlantUML 形式 |
| エンドポイント一覧 | URL、用途、ステータス |
| 将来の拡張パス | スケールアップ時の移行先 |

---

## 6. 使用ツール

### 6.1 エージェントツール

| ツールID | タイプ | 説明 |
|---------|--------|------|
| `github-reader` | http-api | GitHub REST/GraphQL API でソースコード取得 |
| `aws-cli-wrapper` | cli | AWS CLI ラッパー（App Runner/Lambda/ECS 等） |
| `terraform-generator` | codegen | Terraform コード生成 |
| `github-actions-generator` | codegen | GitHub Actions ワークフロー生成 |
| `architecture-linter` | analysis | アーキテクチャ要件チェック |

### 6.2 外部サービス連携

| サービス | 用途 |
|---------|------|
| GitHub API | リポジトリ解析、ワークフロー作成 |
| AWS CLI | リソース作成、デプロイ |
| Terraform Cloud | (オプション) State 管理 |

---

## 7. 非機能要件

### 7.1 性能要件

| 項目 | 要件 |
|------|------|
| リポジトリ解析時間 | 30秒以内 |
| IaC 生成時間 | 1分以内 |
| デプロイ実行時間 | 10分以内（App Runner）、20分以内（ECS） |

### 7.2 セキュリティ要件

| 項目 | 要件 |
|------|------|
| IAM ロール | 最小権限の原則 |
| シークレット | Secrets Manager / SSM Parameter Store で管理 |
| ネットワーク | プライベートサブネット推奨 |
| 監査ログ | CloudTrail で全操作を記録 |

### 7.3 可用性要件

| 項目 | 要件 |
|------|------|
| エージェント稼働率 | 99.9% |
| デプロイ成功率 | 95%以上 |
| ロールバック | 自動ロールバック対応 |

---

## 8. 実装ステップ

### Phase 1: 基本機能

1. リポジトリ解析機能
2. アーキテクチャ選定ロジック
3. App Runner Direct テンプレート
4. GitHub Actions テンプレート

### Phase 2: 非同期アーキテクチャ

1. SQS + Lambda モジュール
2. SQS + Fargate モジュール
3. DynamoDB ジョブストア

### Phase 3: 高度な機能

1. ECS Fargate API モジュール
2. Lambda API Gateway モジュール
3. VPC 構成オプション

### Phase 4: 運用機能

1. デプロイ履歴管理
2. ロールバック機能
3. コスト見積もり機能

---

## 9. 参照ドキュメント

### AWS 公式

| ドキュメント | URL |
|-------------|-----|
| App Runner 概要 | https://docs.aws.amazon.com/ja_jp/apprunner/latest/dg/what-is-apprunner.html |
| Lambda イベント駆動 | https://docs.aws.amazon.com/lambda/latest/dg/concepts-event-driven-architectures.html |
| API Gateway + Lambda 非同期 | https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/process-events-asynchronously-with-amazon-api-gateway-and-aws-lambda.html |
| API Gateway + SQS + Fargate | https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/process-events-asynchronously-with-amazon-api-gateway-amazon-sqs-and-aws-fargate.html |

### GitHub Actions

| ドキュメント | URL |
|-------------|-----|
| App Runner Deploy Action | https://github.com/awslabs/amazon-app-runner-deploy |
| AWS Blog: App Runner + GitHub Actions | https://aws.amazon.com/blogs/containers/deploy-applications-in-aws-app-runner-with-github-actions/ |

---

## 10. 承認

| 役割 | 氏名 | 日付 | 署名 |
|-----|------|------|------|
| プロジェクトマネージャー | | | |
| テックリード | | | |
| セキュリティ担当 | | | |

---

## 変更履歴

| バージョン | 日付 | 変更者 | 変更内容 |
|-----------|------|-------|---------|
| 1.0 | 2025-12-11 | Claude | 初版作成 |
