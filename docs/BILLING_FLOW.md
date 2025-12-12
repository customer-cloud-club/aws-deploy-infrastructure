# 課金フロー解説

## 概要

共通課金基盤はStripeを使用したサブスクリプション課金を提供します。

## 課金アーキテクチャ

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Stripe    │────▶│  Webhook    │
│   (User)    │◀────│  Checkout   │     │   Lambda    │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Aurora    │
                                        │ PostgreSQL  │
                                        └─────────────┘
```

## 課金フロー詳細

### 1. サブスクリプション開始フロー

```
User → プラン選択 → Stripe Checkout → 決済 → Webhook → Entitlement更新
```

1. ユーザーがプランを選択
2. アプリがCheckoutセッションを作成
3. Stripeの決済ページへリダイレクト
4. クレジットカード情報を入力
5. 決済成功 → Webhookイベント発火
6. Lambda関数でEntitlementを作成/更新
7. 成功ページへリダイレクト

### 2. 決済成功後の処理

```typescript
// Webhook処理（冪等性保証付き）
async function handleInvoicePaid(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;

  // 冪等性チェック
  const processed = await checkIdempotency(event.id);
  if (processed) return;

  // Entitlement更新
  await updateEntitlement({
    userId: invoice.customer as string,
    planId: invoice.lines.data[0].price?.id,
    status: 'active',
    expiresAt: new Date(invoice.period_end * 1000),
  });

  // 冪等性キー保存
  await saveIdempotencyKey(event.id);
}
```

## Webhookイベント

### 処理するイベント

| イベント | 処理内容 |
|---------|---------|
| `invoice.paid` | Entitlementをactiveに |
| `invoice.payment_failed` | 通知メール送信 |
| `customer.subscription.updated` | プラン変更反映 |
| `customer.subscription.deleted` | Entitlementをcancelledに |

### 冪等性保証

Webhookは重複配信される可能性があるため、冪等性を保証します。

```typescript
// Redis + DynamoDBによる冪等性管理
interface IdempotencyRecord {
  eventId: string;
  processedAt: string;
  result: 'success' | 'error';
  ttl: number; // 7日後に自動削除
}
```

## プラン構成

### プラン例

| プラン | 月額 | 生成数/月 | ストレージ | 機能 |
|-------|------|----------|-----------|------|
| Free | ¥0 | 10回 | 100MB | 基本機能 |
| Pro | ¥1,980 | 1,000回 | 10GB | 全機能 |
| Business | ¥9,800 | 無制限 | 100GB | 全機能+優先サポート |

### Stripeプロダクト設定

```typescript
// Stripe Product構成
{
  product: {
    name: 'AI Dream Factory',
    metadata: {
      platform_product_id: 'ai-dream-factory'
    }
  },
  prices: [
    {
      nickname: 'Free',
      unit_amount: 0,
      recurring: { interval: 'month' },
      metadata: {
        platform_plan_id: 'free',
        features: JSON.stringify({ ai_generation: true }),
        limits: JSON.stringify({ generations: 10 })
      }
    },
    {
      nickname: 'Pro',
      unit_amount: 198000, // ¥1,980 in sen
      recurring: { interval: 'month' },
      metadata: {
        platform_plan_id: 'pro',
        features: JSON.stringify({ ai_generation: true, high_resolution: true }),
        limits: JSON.stringify({ generations: 1000 })
      }
    }
  ]
}
```

## 実装例

### Checkoutセッション作成

```typescript
// app/api/checkout/route.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const { planId, productId } = await request.json();
  const user = await getCurrentUser();

  const session = await stripe.checkout.sessions.create({
    customer_email: user.email,
    mode: 'subscription',
    line_items: [{
      price: planId,
      quantity: 1,
    }],
    success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/plans`,
    metadata: {
      userId: user.id,
      productId,
    },
  });

  return Response.json({ checkoutUrl: session.url });
}
```

### プラン変更

```typescript
// プランアップグレード/ダウングレード
async function changePlan(subscriptionId: string, newPriceId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: subscription.items.data[0].id,
      price: newPriceId,
    }],
    proration_behavior: 'create_prorations', // 日割り計算
  });
}
```

### カスタマーポータル

```typescript
// 支払い方法変更・請求履歴表示
async function createPortalSession(customerId: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.APP_URL}/account`,
  });

  return session.url;
}
```

## 使用量ベース課金（オプション）

従量課金が必要な場合:

```typescript
// 使用量報告
await stripe.subscriptionItems.createUsageRecord(
  subscriptionItemId,
  {
    quantity: 100, // 使用量
    timestamp: Math.floor(Date.now() / 1000),
    action: 'increment',
  }
);
```

## エラーハンドリング

### 決済失敗時

1. `invoice.payment_failed`イベントを受信
2. ユーザーにメール通知
3. 3回失敗後にサブスクリプション停止
4. Entitlementを`suspended`に更新

### リトライ設定

```typescript
// Stripe設定
{
  subscription_billing_cycle_anchor: 'now',
  payment_behavior: 'default_incomplete',
  payment_settings: {
    payment_method_types: ['card'],
    save_default_payment_method: 'on_subscription'
  }
}
```

## テスト

### Stripe CLIでWebhookテスト

```bash
# Stripe CLIインストール
brew install stripe/stripe-cli/stripe

# ログイン
stripe login

# Webhook転送
stripe listen --forward-to localhost:3000/api/webhook

# テストイベント送信
stripe trigger invoice.paid
```

### テストカード

| カード番号 | 結果 |
|-----------|------|
| 4242424242424242 | 成功 |
| 4000000000000002 | 拒否 |
| 4000000000009995 | 資金不足 |
