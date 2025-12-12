# Billing Service Lambda Functions

Stripe連携課金サービスの実装。Webhook冪等性保証を含む完全なサブスクリプション管理機能を提供します。

## 概要

このディレクトリには、Stripe決済プラットフォームと連携した課金・サブスクリプション管理機能が実装されています。

**主要機能**:
- Checkout Session作成（サブスクリプション購入）
- Stripe Webhook受信（冪等性保証付き）
- サブスクリプション管理（取得、キャンセル、再開、プラン変更）

## ファイル構成

```
billing/
├── README.md                              # このファイル
├── stripe.ts                              # Stripeクライアント初期化
├── types.ts                               # 型定義
├── checkout/
│   └── handler.ts                         # Checkout Session作成
├── subscription/
│   └── handler.ts                         # サブスク管理（取得/キャンセル/再開/変更）
└── webhook/
    ├── handler.ts                         # Webhook受信（メインハンドラ）
    ├── idempotency.ts                     # 冪等性チェック
    └── events/
        ├── checkoutCompleted.ts           # checkout.session.completed
        ├── invoicePaid.ts                 # invoice.paid
        ├── subscriptionUpdated.ts         # customer.subscription.updated
        └── subscriptionDeleted.ts         # customer.subscription.deleted
```

## 主要モジュール

### 1. stripe.ts - Stripeクライアント

Stripe APIクライアントのシングルトンインスタンスを提供します。

```typescript
import { stripe } from './stripe';

const session = await stripe.checkout.sessions.create({ ... });
```

**環境変数**:
- `STRIPE_SECRET_KEY`: Stripe Secret Key（必須）
- `STRIPE_WEBHOOK_SECRET`: Webhook署名検証用シークレット（必須）

### 2. types.ts - 型定義

すべての型定義を集約しています。

**主要な型**:
- `CheckoutSessionRequest` / `CheckoutSessionResponse`
- `SubscriptionResponse`
- `SubscriptionStatus`
- `ProcessedWebhook`
- `PaymentRecord`

### 3. checkout/handler.ts - Checkout Session作成

**エンドポイント**: `POST /billing/checkout`

**リクエスト**:
```json
{
  "plan_id": "price_xxx",
  "product_id": "prod_xxx",
  "success_url": "https://example.com/success?session_id={CHECKOUT_SESSION_ID}",
  "cancel_url": "https://example.com/cancel"
}
```

**レスポンス**:
```json
{
  "session_id": "cs_xxx",
  "url": "https://checkout.stripe.com/xxx"
}
```

**認証**: Cognito JWT（`sub` claimからuser_idを取得）

### 4. webhook/handler.ts - Webhook受信

**エンドポイント**: `POST /billing/webhook`

**処理フロー**:
1. Stripe署名検証
2. トランザクション開始
3. 冪等性チェック（`processed_webhooks`テーブル）
4. イベントハンドラにルーティング
5. トランザクションコミット

**対応イベント**:
- `checkout.session.completed`: Checkout完了
- `invoice.paid`: 請求書支払い成功
- `customer.subscription.updated`: サブスク更新
- `customer.subscription.deleted`: サブスク削除

**冪等性保証**:
```sql
INSERT INTO processed_webhooks (stripe_event_id, event_type, processed_at)
VALUES ($1, $2, NOW())
ON CONFLICT (stripe_event_id) DO NOTHING
RETURNING stripe_event_id
```

`rowCount === 1`: 新規イベント（処理する）
`rowCount === 0`: 既存イベント（スキップ）

### 5. webhook/idempotency.ts - 冪等性管理

**主要関数**:

```typescript
// 冪等性チェック
const isNew = await checkIdempotency(client, eventId, eventType);

// 古いレコードのクリーンアップ（90日以上）
const deleted = await cleanupOldWebhooks(client, 90);

// Webhook統計取得
const stats = await getWebhookStats(client, 24);
```

**必要なDBテーブル**:
```sql
CREATE TABLE processed_webhooks (
  stripe_event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_processed_webhooks_type ON processed_webhooks(event_type);
CREATE INDEX idx_processed_webhooks_processed_at ON processed_webhooks(processed_at);
```

### 6. webhook/events/ - イベントハンドラ

#### checkoutCompleted.ts
Checkout完了時の処理:
1. Customerレコード作成/更新
2. Subscriptionレコード作成

#### invoicePaid.ts
請求書支払い成功時の処理:
1. Paymentレコード作成
2. Subscription請求期間更新

#### subscriptionUpdated.ts
サブスク更新時の処理:
1. Subscriptionステータス更新
2. プラン変更の記録

#### subscriptionDeleted.ts
サブスク削除時の処理:
1. Subscriptionステータスを`canceled`に更新
2. アクセス権限取り消し

### 7. subscription/handler.ts - サブスク管理

**エンドポイント**:

| メソッド | パス | 機能 |
|---------|------|------|
| GET | `/billing/subscription` | 現在のサブスク取得 |
| POST | `/billing/subscription/cancel` | サブスクキャンセル（期末） |
| POST | `/billing/subscription/resume` | サブスク再開 |
| POST | `/billing/subscription/update-plan` | プラン変更 |

**認証**: Cognito JWT

## データベーススキーマ

### customers テーブル
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### subscriptions テーブル
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

### payments テーブル
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  subscription_id UUID,
  stripe_invoice_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_payment_intent_id VARCHAR(255),
  amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(50) NOT NULL,
  paid_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
```

### access_revocations テーブル
```sql
CREATE TABLE access_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  subscription_id UUID UNIQUE NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  revoked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);
```

## 環境変数

### 必須
- `STRIPE_SECRET_KEY`: Stripe Secret Key
- `STRIPE_WEBHOOK_SECRET`: Webhook署名検証用シークレット
- `DB_HOST`: PostgreSQLホスト
- `DB_PORT`: PostgreSQLポート（デフォルト: 5432）
- `DB_NAME`: データベース名
- `DB_USER`: データベースユーザー
- `DB_PASSWORD`: データベースパスワード

## デプロイ

### Lambda関数定義（例）

```yaml
# checkout function
BillingCheckoutFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: checkout/handler.handler
    Runtime: nodejs18.x
    Environment:
      Variables:
        STRIPE_SECRET_KEY: !Ref StripeSecretKey
        STRIPE_WEBHOOK_SECRET: !Ref StripeWebhookSecret
    Events:
      CheckoutApi:
        Type: Api
        Properties:
          Path: /billing/checkout
          Method: POST
          Auth:
            Authorizer: CognitoAuthorizer

# webhook function
BillingWebhookFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: webhook/handler.handler
    Runtime: nodejs18.x
    Timeout: 30
    Environment:
      Variables:
        STRIPE_SECRET_KEY: !Ref StripeSecretKey
        STRIPE_WEBHOOK_SECRET: !Ref StripeWebhookSecret
        DB_HOST: !Ref DBHost
        DB_PORT: !Ref DBPort
        DB_NAME: !Ref DBName
        DB_USER: !Ref DBUser
        DB_PASSWORD: !Ref DBPassword
    Events:
      WebhookApi:
        Type: Api
        Properties:
          Path: /billing/webhook
          Method: POST
```

## Stripe設定

### Webhook設定

Stripeダッシュボード > Developers > Webhooks で以下のエンドポイントを登録:

**URL**: `https://api.example.com/billing/webhook`

**Listen to Events**:
- `checkout.session.completed`
- `invoice.paid`
- `customer.subscription.updated`
- `customer.subscription.deleted`

**Webhook signing secret** をコピーして `STRIPE_WEBHOOK_SECRET` に設定

## セキュリティ

### Webhook署名検証
すべてのWebhookリクエストはStripe署名で検証されます:
```typescript
const stripeEvent = stripe.webhooks.constructEvent(
  event.body,
  signature,
  STRIPE_WEBHOOK_SECRET
);
```

### トランザクション管理
すべてのWebhook処理はPostgreSQLトランザクション内で実行されます:
- エラー時: ロールバック（冪等性レコードも削除）
- 成功時: コミット（冪等性レコード永続化）

### 冪等性保証
データベースレベルでの冪等性保証により、重複処理を防止:
- UNIQUE制約: `stripe_event_id`
- `INSERT ... ON CONFLICT DO NOTHING` パターン

## テスト

### Stripe CLIでのローカルテスト

```bash
# Stripe CLIインストール
brew install stripe/stripe-cli/stripe

# ログイン
stripe login

# Webhookをローカルにフォワード
stripe listen --forward-to localhost:3000/billing/webhook

# テストイベント送信
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

## モニタリング

### CloudWatch Metrics
- Lambda実行時間
- Lambda エラー率
- Lambda 同時実行数

### CloudWatch Logs
すべてのイベント処理は構造化ログで記録:
```typescript
console.log('[WebhookHandler] Processing event', {
  eventId: stripeEvent.id,
  eventType: stripeEvent.type,
  userId: userId,
});
```

### Webhook統計
```typescript
// 過去24時間のWebhook統計
const stats = await getWebhookStats(client, 24);
// { 'checkout.session.completed': 42, 'invoice.paid': 38, ... }
```

## トラブルシューティング

### Webhook署名検証エラー
**原因**: `STRIPE_WEBHOOK_SECRET` が正しくない
**解決**: Stripeダッシュボードでsigning secretを確認

### 重複処理
**原因**: 冪等性チェック失敗
**解決**: `processed_webhooks` テーブルの制約を確認

### データベース接続エラー
**原因**: DB認証情報が間違っている
**解決**: 環境変数を確認

## 参考資料

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Subscriptions Documentation](https://stripe.com/docs/billing/subscriptions/overview)

---

**実装日**: 2025-12-12
**Issue**: #17 - Billing Service Lambda関数実装（Stripe連携・Webhook冪等性）
