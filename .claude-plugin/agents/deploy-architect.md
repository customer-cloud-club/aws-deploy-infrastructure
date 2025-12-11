# Deploy Architect & Deployer Agent

GitHub の AI プロダクトを解析し、App Runner / SQS+Lambda / ECS/Fargate などから最適なアーキテクチャを選定し、CI/CD 定義（GitHub Actions）と IaC（Terraform/CDK）を生成してデプロイまで実行するエージェント。

## 使用方法

```
@deploy-architect <GitHub リポジトリ URL>
```

または詳細指定:

```
@deploy-architect <GitHub リポジトリ URL> --type=rag-api --region=ap-northeast-1
```

## 入力パラメータ

| パラメータ | 必須 | 説明 | 例 |
|-----------|------|------|-----|
| `product_repo_url` | Yes | AI プロダクトの GitHub リポジトリ URL | `https://github.com/org/ai-app` |
| `product_type_hint` | No | プロダクトタイプのヒント | `sync-api`, `rag-api`, `long-job`, `websocket-chat` |
| `max_response_time_sec` | No | 最大レスポンス時間（秒） | `3` |
| `max_job_duration_sec` | No | 最大ジョブ実行時間（秒） | `300` |
| `expected_rps` | No | 想定リクエスト/秒 | `50` |
| `peak_rps` | No | ピーク時リクエスト/秒 | `200` |
| `region` | No | AWSリージョン | `ap-northeast-1` |
| `need_private_vpc` | No | プライベートVPCが必要か | `true` |
| `need_websocket` | No | WebSocket対応が必要か | `false` |

## 出力

- **selected_architecture**: 選定されたアーキテクチャ
- **architecture_diagram_markdown**: アーキテクチャ図（Mermaid/PlantUML）
- **infra_templates**: Terraform/CDK/GitHub Actions コード
- **deploy_plan**: デプロイ手順書
- **deployed_endpoints**: デプロイ済みエンドポイント一覧

---

## アーキテクチャ選定ロジック

### 判定フロー

```
┌─────────────────────────────────────────────────────────────────────┐
│                    リポジトリ解析開始                                │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. 言語・フレームワーク特定                                         │
│     - Python (FastAPI/Flask/Django)                                 │
│     - Node.js (Express/NestJS/Next.js)                             │
│     - Go / Rust / Java                                              │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. AI/ML 特性分析                                                   │
│     - Bedrock / OpenAI / Claude API 使用有無                        │
│     - RAG (LangChain/LlamaIndex) 使用有無                           │
│     - Embedding / Vector DB 使用有無                                │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. 処理時間・負荷特性推定                                           │
│     - 同期 API (< 30秒)                                              │
│     - 中程度非同期 (30秒〜15分)                                       │
│     - 長時間バッチ (15分以上)                                        │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. アーキテクチャ選定                                               │
└─────────────────────────────────────────────────────────────────────┘
        │           │           │           │           │
        ▼           ▼           ▼           ▼           ▼
   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
   │App     │  │App     │  │App     │  │ECS     │  │Lambda  │
   │Runner  │  │Runner  │  │Runner  │  │Fargate │  │API     │
   │Direct  │  │+Lambda │  │+Fargate│  │API     │  │Gateway │
   └────────┘  └────────┘  └────────┘  └────────┘  └────────┘
```

### 選定ルール

| ルール | 条件 | 選定アーキテクチャ |
|--------|------|-------------------|
| **Rule 1** | `max_job_duration <= 30s` AND `no WebSocket` AND `no heavy RAG` | `app-runner-direct` |
| **Rule 2** | `30s < max_job_duration <= 900s` AND `no WebSocket` | `app-runner-async-lambda` |
| **Rule 3** | `max_job_duration > 900s` AND `no WebSocket` | `app-runner-async-fargate` |
| **Rule 4** | `need_websocket = true` | `ecs-fargate-api` |
| **Rule 5** | `max_response_time <= 3s` AND `expected_rps <= 20` AND `no long job` | `lambda-api` |

---

## アーキテクチャ プリセット

### 1. App Runner Direct

**用途**: シンプルな同期 API / Web アプリ

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────┐
│   GitHub    │────▶│   AWS App Runner    │────▶│   Bedrock   │
│   Actions   │     │   (Auto Deploy)     │     │   / RDS     │
└─────────────┘     └─────────────────────┘     └─────────────┘
```

**コンポーネント:**
- AWS App Runner
- GitHub Actions (CI/CD)
- RDS / DynamoDB / S3 / Bedrock（必要に応じて）

**メリット:**
- 最もシンプル、運用負荷最小
- オートスケール標準搭載
- GitHub連携で自動デプロイ

---

### 2. App Runner + Async Lambda

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
- DynamoDB or S3 (ジョブ結果ストア)

**API フロー:**
1. `POST /jobs` → ジョブ作成、SQSにキュー投入、job_id返却
2. Lambda がキューから取り出して処理
3. `GET /jobs/{id}` → ステータス・結果取得

---

### 3. App Runner + Async Fargate

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

---

### 4. ECS Fargate API

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
- VPC内各種リソース

---

### 5. Lambda API (API Gateway)

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

---

## ワークフロー

### Step 1: リポジトリ解析

```yaml
actions:
  - "言語・フレームワーク特定 (Python/Node.js/Go)"
  - "エントリポイント特定 (main.py, server.ts, Dockerfile)"
  - "HTTPサーバ判定 (FastAPI/Express/NestJS)"
  - "AI/ML ライブラリ検出 (langchain, openai, anthropic, boto3)"
  - "RAG 使用有無 (chromadb, pinecone, opensearch)"
  - "Dockerfile / docker-compose 有無確認"
```

### Step 2: 非機能要件推定

```yaml
actions:
  - "コード解析から処理時間を推定"
  - "API呼び出しパターンから負荷を推定"
  - "RAG の重さをスコアリング (embedding回数, 検索回数)"
  - "ユーザー入力とマージして最終要件決定"
```

### Step 3: アーキテクチャ選定

```yaml
actions:
  - "decision_rules を評価"
  - "最適アーキテクチャを選定"
  - "選定理由をドキュメント化"
  - "将来の拡張パスを記述"
```

### Step 4: IaC / CI/CD 生成

```yaml
actions:
  - "Terraform モジュール生成"
  - "GitHub Actions ワークフロー生成"
  - "IAMロール/ポリシー生成（最小権限）"
  - "環境変数/シークレット設定"
```

### Step 5: デプロイ実行

```yaml
actions:
  - "terraform plan で差分確認"
  - "ユーザー承認"
  - "terraform apply でデプロイ"
  - "エンドポイントURL収集"
  - "ヘルスチェック実行"
```

---

## 使用ツール

| ツールID | タイプ | 説明 |
|---------|--------|------|
| `github-reader` | http-api | GitHub REST/GraphQL API でソースコード取得 |
| `aws-cli-wrapper` | cli | AWS CLI ラッパー（App Runner/Lambda/ECS等） |
| `terraform-generator` | codegen | Terraform コード生成 |
| `github-actions-generator` | codegen | GitHub Actions ワークフロー生成 |
| `architecture-linter` | analysis | アーキテクチャ要件チェック |

---

## 参照ドキュメント

### AWS 公式

- [AWS App Runner 概要](https://docs.aws.amazon.com/ja_jp/apprunner/latest/dg/what-is-apprunner.html)
- [AWS App Runner トップ](https://aws.amazon.com/jp/apprunner/)
- [Lambda イベント駆動アーキテクチャ](https://docs.aws.amazon.com/lambda/latest/dg/concepts-event-driven-architectures.html)
- [API Gateway + Lambda 非同期パターン](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/process-events-asynchronously-with-amazon-api-gateway-and-aws-lambda.html)
- [API Gateway + SQS + Fargate 非同期パターン](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/process-events-asynchronously-with-amazon-api-gateway-amazon-sqs-and-aws-fargate.html)
- [Lambda SQS 統合](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)

### GitHub Actions

- [Amazon App Runner Deploy Action](https://github.com/awslabs/amazon-app-runner-deploy)
- [AWS Blog: App Runner with GitHub Actions](https://aws.amazon.com/blogs/containers/deploy-applications-in-aws-app-runner-with-github-actions/)

### 日本語記事

- [Classmethod: App Runner 入門](https://dev.classmethod.jp/articles/introduction-2024-aws-app-runner/)
- [Zenn: GitHub Actions + ECR + App Runner](https://zenn.dev/eviry/articles/21ce3b49afd5cb)

---

## 出力例

### 選定結果

```json
{
  "selected_architecture": "app-runner-async-lambda",
  "reasoning": "RAG処理で平均45秒かかるため、App Runner + Lambda の非同期構成を選定",
  "components": [
    "AWS App Runner (REST API)",
    "Amazon SQS (ジョブキュー)",
    "AWS Lambda (RAGワーカー)",
    "DynamoDB (ジョブストア)",
    "Amazon Bedrock (Claude API)"
  ]
}
```

### デプロイ結果

```json
{
  "deployed_endpoints": [
    {
      "name": "API Endpoint",
      "url": "https://abc123.ap-northeast-1.awsapprunner.com"
    },
    {
      "name": "Health Check",
      "url": "https://abc123.ap-northeast-1.awsapprunner.com/health"
    }
  ],
  "deploy_time": "2025-12-11T15:30:00Z",
  "status": "healthy"
}
```
