# Stripe 決済連携ガイド

このドキュメントでは、Stripe決済連携の実装詳細、テスト方法、本番環境へのデプロイ手順を説明します。

## 目次

1. [アーキテクチャ概要](#アーキテクチャ概要)
2. [エンドポイント一覧](#エンドポイント一覧)
3. [Checkout フロー](#checkout-フロー)
4. [Webhook 処理](#webhook-処理)
5. [Subscription 管理](#subscription-管理)
6. [テスト手順](#テスト手順)
7. [本番環境デプロイ](#本番環境デプロイ)
8. [トラブルシューティング](#トラブルシューティング)

## アーキテクチャ概要

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│  API Gateway    │───▶│  Lambda         │
│   (Next.js)     │    │  + Cognito Auth │    │  Functions      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
                              ┌─────────────────────────────────────┐
                              │            Stripe API               │
                              │  - Checkout Sessions                │
                              │  - Subscriptions                    │
                              │  - Customer Portal                  │
                              └─────────────────────────────────────┘
                                               │
                                               ▼ Webhooks
                              ┌─────────────────────────────────────┐
                              │         Webhook Handler             │
                              │  - 署名検証                          │
                              │  - 冪等性保証                        │
                              │  - イベントルーティング              │
                              └─────────────────────────────────────┘
                                               │
                                               ▼
                              ┌─────────────────────────────────────┐
                              │           PostgreSQL                │
                              │  - subscriptions                    │
                              │  - entitlements                     │
                              │  - processed_webhooks               │
                              └─────────────────────────────────────┘
```

## エンドポイント一覧

### Checkout
| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| POST | `/checkout` | 必要 | Checkout Session作成 |

### Subscription Management
| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| GET | `/subscriptions` | 必要 | サブスクリプション一覧 |
| GET | `/subscriptions/{id}` | 必要 | サブスクリプション詳細 |
| POST | `/subscriptions/cancel` | 必要 | キャンセル（期末終了） |
| POST | `/subscriptions/resume` | 必要 | キャンセル取消 |
| POST | `/subscriptions/update` | 必要 | プラン変更 |
| GET | `/subscriptions/portal` | 必要 | Customer Portal URL取得 |

### Webhook
| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| POST | `/webhooks/stripe` | 署名検証 | Stripeイベント受信 |

## Checkout フロー

### 1. Checkout Session 作成

```typescript
// リクエスト
POST /checkout
Authorization: Bearer {cognito_token}

{
  "plan_id": "price_xxx",           // Stripe Price ID
  "product_id": "prod_xxx",         // Product ID
  "success_url": "https://app.example.com/success?session_id={CHECKOUT_SESSION_ID}",
  "cancel_url": "https://app.example.com/cancel"
}

// レスポンス
{
  "session_id": "cs_xxx",
  "url": "https://checkout.stripe.com/c/pay/cs_xxx..."
}
```

### 2. 決済完了後のフロー

1. ユーザーがStripe Checkout で決済完了
2. `checkout.session.completed` Webhook が発火
3. Webhook Handler が以下を実行:
   - サブスクリプションレコード作成
   - エンタイトルメント付与
   - 監査ログ記録

## Webhook 処理

### 対応イベント

| イベント | 処理内容 |
|----------|----------|
| `checkout.session.completed` | サブスクリプション作成、エンタイトルメント付与 |
| `invoice.paid` | 支払い成功記録 |
| `customer.subscription.updated` | サブスクリプション状態更新 |
| `customer.subscription.deleted` | サブスクリプション終了処理 |

### 署名検証

```typescript
// Stripe-Signature ヘッダーを検証
const signature = event.headers['Stripe-Signature'];
const stripeEvent = stripe.webhooks.constructEvent(
  event.body,
  signature,
  STRIPE_WEBHOOK_SECRET
);
```

### 冪等性保証

`processed_webhooks` テーブルを使用して、同一イベントの重複処理を防止:

```sql
INSERT INTO processed_webhooks (stripe_event_id, event_type, processed_at)
VALUES ($1, $2, NOW())
ON CONFLICT (stripe_event_id) DO NOTHING
RETURNING stripe_event_id
```

- `rowCount === 1`: 新規イベント（処理実行）
- `rowCount === 0`: 重複イベント（スキップ）

## Subscription 管理

### キャンセル

```typescript
// リクエスト
POST /subscriptions/cancel

// レスポンス
{
  "message": "Subscription will be canceled at period end",
  "cancel_at": "2024-04-01T00:00:00.000Z"
}
```

### プラン変更

```typescript
// リクエスト
POST /subscriptions/update
{
  "new_plan_id": "price_new_xxx"
}

// レスポンス
{
  "message": "Subscription plan updated successfully",
  "subscription_id": "sub_xxx",
  "effective_date": "2024-03-15T10:30:00.000Z"
}
```

### Customer Portal

```typescript
// リクエスト
GET /subscriptions/portal?return_url=https://app.example.com/account

// レスポンス
{
  "url": "https://billing.stripe.com/session/xxx"
}
```

## テスト手順

### 環境準備

1. Stripe Test Mode API Key を取得
2. 環境変数を設定:

```bash
export STRIPE_SECRET_KEY=sk_test_xxx
export STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### ユニットテスト実行

```bash
cd lambda
npm install

# 全テスト実行
npx ts-node tests/billing/run-tests.ts

# 個別テスト実行
npx ts-node tests/billing/run-tests.ts --checkout
npx ts-node tests/billing/run-tests.ts --webhook
npx ts-node tests/billing/run-tests.ts --subscription
```

### Stripe CLI でローカルテスト

```bash
# Stripe CLI インストール
brew install stripe/stripe-cli/stripe

# Stripe にログイン
stripe login

# Webhook転送開始
stripe listen --forward-to localhost:3000/dev/webhooks/stripe

# テストイベント送信
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

### 統合テスト（API Gateway経由）

```bash
# Checkout Session 作成
curl -X POST https://wqqr3nryw0.execute-api.ap-northeast-1.amazonaws.com/dev/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${COGNITO_TOKEN}" \
  -d '{
    "plan_id": "price_xxx",
    "product_id": "prod_xxx",
    "success_url": "https://example.com/success",
    "cancel_url": "https://example.com/cancel"
  }'

# サブスクリプション一覧取得
curl https://wqqr3nryw0.execute-api.ap-northeast-1.amazonaws.com/dev/subscriptions \
  -H "Authorization: Bearer ${COGNITO_TOKEN}"
```

## 本番環境デプロイ

### 1. Stripe 本番モード設定

1. [Stripe Dashboard](https://dashboard.stripe.com) にアクセス
2. Live Mode に切り替え
3. Products/Prices を作成
4. API Keys を取得（`sk_live_xxx`）

### 2. Webhook エンドポイント登録

1. Stripe Dashboard → Developers → Webhooks
2. 「Add endpoint」をクリック
3. 設定:
   - URL: `https://your-api-gateway/prod/webhooks/stripe`
   - Events:
     - `checkout.session.completed`
     - `invoice.paid`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
4. Signing secret をコピー（`whsec_xxx`）

### 3. Secrets Manager 更新

```bash
# Stripe API Key
aws secretsmanager update-secret \
  --secret-id auth-billing/prod/stripe-api-key \
  --secret-string '{"apiKey":"sk_live_xxx"}'

# Webhook Secret
aws secretsmanager update-secret \
  --secret-id auth-billing/prod/stripe-webhook-secret \
  --secret-string '{"webhookSecret":"whsec_xxx"}'
```

### 4. デプロイ

```bash
cd lambda
npm run build
npx serverless deploy --stage prod
```

### 5. 動作確認

1. テスト決済を実行
2. CloudWatch Logs で Webhook 受信を確認
3. データベースでレコード作成を確認

## トラブルシューティング

### Webhook 署名検証エラー

**症状**: `Invalid signature` エラー

**原因と対処**:
1. Webhook Secret が正しくない
   - Stripe Dashboard で Secret を再確認
   - Secrets Manager の値を更新
2. リクエストボディが改変されている
   - API Gateway の body mapping を確認
   - Lambda Proxy Integration を使用しているか確認

### 冪等性エラー

**症状**: `Idempotency check failed` エラー

**原因と対処**:
1. `processed_webhooks` テーブルが存在しない
   ```sql
   CREATE TABLE processed_webhooks (
     stripe_event_id VARCHAR(255) PRIMARY KEY,
     event_type VARCHAR(100) NOT NULL,
     processed_at TIMESTAMP NOT NULL DEFAULT NOW()
   );
   ```
2. データベース接続エラー
   - RDS Proxy 接続を確認
   - VPC セキュリティグループを確認

### Checkout Session 作成エラー

**症状**: `StripeInvalidRequestError`

**原因と対処**:
1. Price ID が無効
   - Stripe Dashboard で Price ID を確認
   - Test/Live モードの混同に注意
2. Customer Email が未設定
   - `customer_email` または `customer` パラメータを確認

### サブスクリプション操作エラー

**症状**: `No active subscription found`

**原因と対処**:
1. ユーザーにアクティブなサブスクリプションがない
   - `subscriptions` テーブルを確認
   - Stripe Dashboard でサブスクリプション状態を確認
2. User ID のマッピングエラー
   - Cognito `sub` claim の取得を確認
   - Webhook metadata の `user_id` を確認

## セキュリティチェックリスト

- [ ] Stripe API Key は Secrets Manager に保存
- [ ] Webhook Secret は Secrets Manager に保存
- [ ] API Gateway に Cognito Authorizer を設定
- [ ] Webhook エンドポイントは署名検証を実施
- [ ] 冪等性保証を実装
- [ ] エラー時のロールバック処理を実装
- [ ] 監査ログを記録
- [ ] PCI DSS 準拠を確認（カード情報は Stripe でのみ処理）

## 参考リンク

- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Webhooks Best Practices](https://stripe.com/docs/webhooks/best-practices)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)
- [Stripe Billing](https://stripe.com/docs/billing)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
