# 共通認証・課金基盤 要件定義書

**バージョン:** 1.2
**最終更新:** 2025-12-11
**ステータス:** ドラフト

---

## 1. 背景・目的

### 1.1 現状の課題

現在、約1,000を超えるAIプロダクトが個別にWebサービスとして展開されており、プロダクトごとに認証・認可・決済（Stripe）まわりを実装・運用している。

- 実装・運用コストが高い
- プラン・課金体系の横断管理が困難
- 将来のマルチテナント / マルチ決済プロバイダ展開を見据えるとスケールしない

### 1.2 目的

共通の認証・認可・決済基盤を構築し、各プロダクトは「ユーザーがそのプロダクトを利用してよいか？」だけを共通APIに問い合わせる構造へ移行する。

**本基盤の目的:**
- 認証・認可・決済の実装をプラットフォーム側に集約し、1,000+プロダクトの開発負荷を大幅に削減
- Stripe BAN / 障害リスクを軽減するためのマルチプロバイダ対応の土台を用意
- 今後、他社（テナント）へこの基盤を提供し、OEM / ホワイトラベル / レベシェア型ビジネスへの拡張を可能にする

### 1.3 対象プロダクト

| プロダクト | ドメイン | 現状 | 統合方法 |
|-----------|---------|------|---------|
| AI Dream Factory | aidreams-factory.com | Cognito + Stripe 実装済み | 環境変数変更のみ |
| MunchCoach | munchcoach.com | 認証なし | CloudFront Function追加 |
| LINE R STEP | fanel-*.aidreams-factory.com | 開発中 | 最初から共通Pool使用 |
| 新規プロダクト | *.aidreams-factory.com | - | Terraformで自動設定 |

---

## 2. スコープ

### 2.1 初期フェーズ（Phase 1）

- **対象サービス:** 自社サービスのみ
- **決済:**
  - テナント（会社）はエンドユーザー課金も含め自社Stripeアカウントを利用
  - 初期対応はStripeのみ（ただしアーキテクチャは他プロバイダ拡張可能な形とする）
- **認証:**
  - 共通 Cognito User Pool + Hosted UI
  - Google / Microsoft OAuth対応
  - SAML連携（B2BのテナントごとのIdP連携）を初期からサポート

### 2.2 将来フェーズ（Phase 2+）― 設計時に拡張性確保のみ

- 他社（テナント）が自社ブランドでエンドユーザー向けにAIプロダクトを販売
- テナントごとにStripeアカウントを紐付け（Stripe Connect OAuth前提）
- Stripe以外の決済プロバイダ（GMO / KOMOJU / PayPal等）の追加

---

## 3. 前提・制約

### 3.1 インフラ

- **クラウド:** AWS
- **リージョン:** ap-northeast-1（東京）
- **アーキテクチャ:** サーバーレス寄せ（API Gateway + Lambda + DynamoDB を基本）
- **IaC:** Terraform必須（構築・変更はTerraform経由で行う）

### 3.2 DR（災害復旧）

- 初期リリースでは明確なDR要件（他リージョン切替）は持たない
- ただしIaC / データモデルの観点で将来マルチリージョン展開できるよう考慮

### 3.3 セキュリティ（PCI DSS）

- **カード情報は一切保持しない**
- Stripe Checkout / Elements を使用し、カード情報は自社システムを通過しない
- PCI DSS準拠レベル: SAQ A（最小限、年次自己評価のみ）

---

## 4. 用語定義

| 用語 | 定義 |
|------|------|
| **テナント（Tenant）** | 請求・設定単位となる「会社」または組織。Phase1では自社のみだが、Phase2以降他社も想定 |
| **ユーザー（User）** | Cognito User Pool上の個人。tenant_idに紐づく |
| **プロダクト（Product）** | 個別のAIプロダクト。短くユニークなproduct_idを持つ |
| **プラン（Plan）** | 各プロダクトに対する料金体系・機能の組み合わせ |
| **利用権（Entitlement）** | 「どのユーザーが、どのテナントの、どのプロダクトを、どのプランで利用できるか」を表すレコード |
| **決済プロバイダ（Payment Provider）** | Stripeなどの外部決済サービス。将来的に複数種をサポート |

---

## 5. 全体アーキテクチャ

### 5.1 システム構成図

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ユーザー                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CloudFront（各プロダクトのドメイン）                       │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                  CloudFront Function / Lambda@Edge                     │ │
│  │         ・JWT検証（Cognito）                                           │ │
│  │         ・未認証 → id.aidreams-factory.com へリダイレクト              │ │
│  │         ・認証済 → Origin へ通過（X-User-Id ヘッダ付与）               │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Product A     │      │   Product B     │      │   Product C     │
│   (既存ALB)     │      │   (既存ALB)     │      │   (新規)        │
│  munchcoach.com │      │ ai-dream.com    │      │ new-ai.com      │
└─────────────────┘      └─────────────────┘      └─────────────────┘
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         共通認証・課金基盤                                   │
│                     (api.aidreams-factory.com)                              │
│                                                                             │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   │
│   │   Cognito   │   │ Entitlement │   │   Billing   │   │   Catalog   │   │
│   │  User Pool  │   │   Service   │   │   Service   │   │   Service   │   │
│   └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘   │
│          │                 │                 │                 │           │
│          └─────────────────┼─────────────────┼─────────────────┘           │
│                            ▼                 ▼                              │
│                     ┌─────────────┐   ┌─────────────┐                      │
│                     │  DynamoDB   │   │   Stripe    │                      │
│                     └─────────────┘   └─────────────┘                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 構成要素

| # | サービス | 役割 |
|---|----------|------|
| 1 | **認証基盤（Auth Service）** | Cognito User Pool（共通）、Hosted UI、SAML連携 |
| 2 | **Catalog Service** | テナント、プロダクト、プラン定義の管理 |
| 3 | **Entitlement Service** | 利用権管理、認可判定API |
| 4 | **Billing Service** | 決済抽象レイヤー、Stripe連携、Webhook処理 |
| 5 | **End-user Portal** | エンドユーザー向けの契約・利用状況確認UI |
| 6 | **Admin Console** | プラットフォーム管理者向けUI |

---

## 6. ユーザー体験（UX）

### 6.1 設計コンセプト

**Googleモデルを参考に「1アカウントで全サービス」を実現**

- 一度ログインすれば全プロダクトで有効
- プロダクト間でシームレスに移動（再ログイン不要）
- 統一された「マイアカウント」管理画面
- 決済情報（カード）の共有

### 6.2 シナリオ別フロー

#### シナリオ1: 新規ユーザー登録〜初回利用

```
1. munchcoach.com にアクセス
2. CloudFront Function が未認証を検知 → 認証画面を表示
3. 「Googleで続ける」をクリック → Google OAuth
4. 自動でアカウント作成 → プラン選択画面
5. 「無料で始める」→ サービス利用開始
```

#### シナリオ2: 既存ユーザーの別プロダクト利用

```
1. AI Dream Factory でログイン済みのユーザー
2. munchcoach.com にアクセス
3. CloudFront Function がCookieを検知 → 認証済み
4. ログイン画面はスキップ → 直接プラン選択画面へ
5. 保存済みカードで1クリック決済
```

#### シナリオ3: 無料→有料プランへのアップグレード

```
1. Free プランで利用中、上限に接近
2. 警告バナー表示「残り2回」
3. 上限到達 → ソフトリミット（追加3回まで利用可能）
4. 「Proにアップグレード」→ モーダル表示
5. 保存済みカードで1クリック決済
6. 即座にPro機能が有効化
```

### 6.3 Cookie / セッション戦略

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Cookie Domain: .aidreams-factory.com                                       │
│                                                                             │
│  有効範囲:                                                                   │
│  ✓ id.aidreams-factory.com        (認証基盤)                                │
│  ✓ munch.aidreams-factory.com     (MunchCoach)                              │
│  ✓ linestep.aidreams-factory.com  (LINE R STEP)                             │
│  ✓ *.aidreams-factory.com         (全サブドメイン)                          │
│                                                                             │
│  外部ドメイン（munchcoach.com等）:                                           │
│  → トークンリレー方式で対応                                                  │
│  → 認証基盤経由で短期トークンを発行し、リダイレクトで渡す                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. 機能要件

### 7.1 認証機能

| ID | 機能 | 説明 |
|----|------|------|
| AUTH-001 | Cognito Hosted UI | ログイン / ログアウト |
| AUTH-002 | ユーザー登録 | メール / パスワード登録、メール確認 |
| AUTH-003 | パスワードリセット | Cognito標準フロー |
| AUTH-004 | Google OAuth | Googleアカウントでログイン |
| AUTH-005 | Microsoft OAuth | Microsoftアカウントでログイン |
| AUTH-006 | SAML連携 | 企業IdP（Azure AD / Google Workspace / Okta等） |
| AUTH-007 | JWT発行 | ID Token / Access Token / Refresh Token |

### 7.2 プロダクト・プラン管理（Catalog Service）

| ID | 機能 | 説明 |
|----|------|------|
| CAT-001 | プロダクト登録 | 管理画面からプロダクトを登録 |
| CAT-002 | プロダクト編集・削除 | 名称、説明、URL、アイコン等の変更 |
| CAT-003 | プラン登録 | 無料 / 月額 / 年額プランの設定 |
| CAT-004 | プラン編集・削除 | 料金、利用制限、機能フラグの変更 |
| CAT-005 | Stripe Price連携 | 管理画面からStripe Priceを自動作成 or 手動設定 |
| CAT-006 | 機能フラグ設定 | JSON形式で機能ON/OFFを定義 |

### 7.3 利用権・認可（Entitlement Service）

| ID | 機能 | 説明 |
|----|------|------|
| ENT-001 | 利用権チェックAPI | `GET /me/entitlements?product_id={product_id}` |
| ENT-002 | 利用権付与 | 決済完了時に自動付与 |
| ENT-003 | 利用権停止 | 解約時、管理者操作時 |
| ENT-004 | 使用回数カウント | `POST /me/usage` で使用を記録 |
| ENT-005 | ソフトリミット | 上限到達後も一定バッファまで利用可能 |
| ENT-006 | 使用回数リセット | 月次で自動リセット |

**Entitlement APIレスポンス例:**

```json
{
  "product_id": "munchcoach",
  "plan_id": "pro-monthly",
  "status": "active",
  "features": {
    "high_resolution": true,
    "batch_mode": true,
    "priority_support": false
  },
  "usage": {
    "limit": 100,
    "used": 73,
    "remaining": 27,
    "soft_limit": 10,
    "reset_at": "2025-01-01T00:00:00Z"
  },
  "valid_until": "2025-12-31T23:59:59Z"
}
```

### 7.4 決済機能（Billing Service）

| ID | 機能 | 説明 |
|----|------|------|
| BILL-001 | Checkout Session作成 | Stripe Checkout への遷移URL生成 |
| BILL-002 | Subscription管理 | サブスクリプションの作成・更新・解約 |
| BILL-003 | Webhook処理 | Stripe Webhook受信 → Entitlement更新 |
| BILL-004 | 決済履歴 | ユーザーごとの決済履歴表示 |
| BILL-005 | 請求書管理 | Stripe Invoiceとの連携 |
| BILL-006 | プラン変更 | アップグレード / ダウングレード |

**カード情報の取り扱い:**

| データ | 保持 | 理由 |
|--------|------|------|
| stripe_customer_id | ✅ | 顧客識別に必要 |
| stripe_subscription_id | ✅ | サブスク管理に必要 |
| 金額・税額 | ✅ | 売上集計に必要 |
| カード下4桁 | ✅ | 表示用（オプション） |
| カード番号全桁 | ❌ | PCI DSS対象になる |
| CVC/CVV | ❌ | 保存禁止 |

### 7.5 管理者ポータル（Admin Console）

| ID | 機能 | 説明 |
|----|------|------|
| ADM-001 | ダッシュボード | 全体売上、プロダクト別売上、ユーザー数表示 |
| ADM-002 | プロダクト別分析 | 売上推移、プラン別内訳、解約率 |
| ADM-003 | ユーザー検索 | メール、product_id、plan_idで絞り込み |
| ADM-004 | ユーザー詳細 | 利用中プロダクト、決済履歴の確認 |
| ADM-005 | Entitlement手動操作 | 付与 / 停止 / 延長 |
| ADM-006 | プロダクト・プラン管理 | 登録・編集・削除 |
| ADM-007 | 監査ログ | 管理者操作履歴の記録・閲覧 |

**ダッシュボード表示項目:**

| 指標 | 説明 |
|------|------|
| 今月売上 | 全プロダクト合計、前月比 |
| 総ユーザー数 | 登録ユーザー数、今月新規 |
| 有料会員数 | 課金中ユーザー数、割合 |
| 解約率（Churn Rate） | 月次解約率 |
| ARPU | 平均顧客単価 |
| プロダクト別売上 | プロダクトごとの売上、ユーザー数 |

### 7.6 エンドユーザーポータル（End-user Portal）

| ID | 機能 | 説明 |
|----|------|------|
| USR-001 | アカウント情報 | メール、登録日、認証方法の表示 |
| USR-002 | 利用中プロダクト | 契約中プロダクト・プラン一覧 |
| USR-003 | 利用状況 | 回数制限に対する使用率 |
| USR-004 | 決済履歴 | 過去の決済一覧 |
| USR-005 | プラン変更 | アップグレード / ダウングレード |
| USR-006 | 解約 | サブスクリプションの解約 |

---

## 8. 開発者向け統合ガイド

### 8.1 新規プロダクト追加時の作業

**管理者の作業:**
1. 管理画面でプロダクト登録
2. プラン設定（Free / Pro / Enterprise等）
3. Stripe Price連携

**開発者の作業（3ステップ）:**

#### Step 1: 環境変数を設定（2行）

```bash
PRODUCT_ID=image-gen-ai
PLATFORM_API_URL=https://api.aidreams-factory.com
```

#### Step 2: SDK導入 or ヘッダ参照

**方法A: SDK を使う場合（推奨）**

```typescript
import { PlatformSDK } from '@aidreams/platform-sdk'

PlatformSDK.init({
  productId: process.env.PRODUCT_ID,
  apiUrl: process.env.PLATFORM_API_URL
})

// 認証チェック
const user = await PlatformSDK.requireAuth()

// 利用権チェック
const entitlement = await PlatformSDK.getEntitlement()

if (entitlement.usage.remaining <= 0) {
  return showUpgradeModal()
}

// 機能フラグで出し分け
if (entitlement.features.high_resolution) {
  // Pro機能を表示
}
```

**方法B: HTTPヘッダを参照する場合（SDK不要）**

```typescript
// CloudFront Function が付与したヘッダを参照
const userId = request.headers.get('x-user-id')
const planId = request.headers.get('x-plan-id')
const usageRemaining = request.headers.get('x-usage-remaining')
```

#### Step 3: 使用回数を記録（従量制の場合）

```typescript
await PlatformSDK.recordUsage(1)
```

### 8.2 作業時間の比較

| 作業 | 従来 | 統合後 |
|------|------|--------|
| 認証実装 | 数日〜1週間 | 不要 |
| 決済実装 | 数日〜1週間 | 不要 |
| プラン管理 | 数日 | 不要 |
| SDK導入 | - | 30分以内 |
| **合計** | **数週間** | **30分以内** |

---

## 9. データモデル

### 9.1 主要テーブル

```sql
-- Tenants: テナント（会社）
CREATE TABLE tenants (
    tenant_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users: ユーザー
CREATE TABLE users (
    user_id VARCHAR(50) PRIMARY KEY,  -- Cognito sub
    tenant_id VARCHAR(50) NOT NULL,
    email VARCHAR(200) NOT NULL,
    stripe_customer_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products: プロダクト
CREATE TABLE products (
    product_id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    icon_url VARCHAR(500),
    service_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plans: プラン
CREATE TABLE plans (
    plan_id VARCHAR(50) PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    billing_type VARCHAR(20),  -- free, monthly, yearly
    amount INT DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'JPY',
    usage_limit INT,
    soft_limit INT DEFAULT 0,
    feature_flags JSON,
    stripe_price_id VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Entitlements: 利用権
CREATE TABLE entitlements (
    entitlement_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    product_id VARCHAR(50) NOT NULL,
    plan_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',  -- active, canceled, expired
    usage_limit INT,
    usage_count INT DEFAULT 0,
    usage_reset_at TIMESTAMP,
    valid_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);

-- Subscriptions: サブスクリプション
CREATE TABLE subscriptions (
    subscription_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    product_id VARCHAR(50) NOT NULL,
    plan_id VARCHAR(50) NOT NULL,
    stripe_subscription_id VARCHAR(50),
    status VARCHAR(20),
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments: 決済履歴
CREATE TABLE payments (
    payment_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    product_id VARCHAR(50) NOT NULL,
    plan_id VARCHAR(50) NOT NULL,
    stripe_payment_intent_id VARCHAR(50),
    stripe_invoice_id VARCHAR(50),
    amount INT NOT NULL,
    currency VARCHAR(3) DEFAULT 'JPY',
    status VARCHAR(20),  -- succeeded, failed, pending, refunded
    card_brand VARCHAR(20),
    card_last4 VARCHAR(4),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PaymentEvents: 決済イベントログ（監査用、10年保存）
CREATE TABLE payment_events (
    event_id VARCHAR(50) PRIMARY KEY,
    stripe_event_id VARCHAR(50),
    event_type VARCHAR(100),
    user_id VARCHAR(50),
    product_id VARCHAR(50),
    payload JSON,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 10. 非機能要件

### 10.1 可用性 / SLO

| 項目 | 要件 |
|------|------|
| SLO | 99.99% |
| 監視 | CloudWatch / 外形監視 |
| アラート | エラー率 / タイムアウト率の閾値設定 |

### 10.2 性能

| 項目 | 要件 |
|------|------|
| EntitlementチェックAPI P95 | 200ms以下 |
| 構成 | DynamoDB + Lambda（高頻度アクセス対応） |

### 10.3 セキュリティ

| 項目 | 要件 |
|------|------|
| カード情報 | 全てStripe管理、システム側で非保持 |
| PCI DSS | SAQ A（最小限） |
| 管理者アクセス | MFA必須 |
| API認証 | Cognito JWT署名検証 |
| シークレット | Secrets Manager、IAM最小権限 |

### 10.4 ログ / 監査

| 項目 | 要件 |
|------|------|
| 監査対象 | ログイン/ログアウト、プラン購入/変更/解約、決済エラー、Entitlement手動変更 |
| 保存期間 | 10年間（商法準拠） |
| 改ざん防止 | S3 Object Lock（WORM）設定 |

### 10.5 運用・保守

| 項目 | 要件 |
|------|------|
| IaC | 全リソースTerraformで定義、Git管理 |
| 環境 | ステージング / 本番（同一構成、スケール調整可） |
| デプロイ | CI/CDパイプラインで自動化 |

### 10.6 多言語対応（i18n / L10n）

#### 10.6.1 対応言語

世界中のユーザーが利用できるよう、以下の主要言語をサポートする。

| # | 言語 | コード | 地域 | 優先度 |
|---|------|--------|------|--------|
| 1 | 日本語 | ja | 日本 | P0（デフォルト） |
| 2 | 英語 | en | グローバル | P0 |
| 3 | 中国語（簡体字） | zh-CN | 中国本土 | P1 |
| 4 | 中国語（繁体字） | zh-TW | 台湾・香港 | P1 |
| 5 | 韓国語 | ko | 韓国 | P1 |
| 6 | スペイン語 | es | スペイン・中南米 | P1 |
| 7 | フランス語 | fr | フランス・アフリカ | P2 |
| 8 | ドイツ語 | de | ドイツ・オーストリア | P2 |
| 9 | ポルトガル語 | pt-BR | ブラジル | P2 |
| 10 | アラビア語 | ar | 中東・北アフリカ | P2 |
| 11 | ヒンディー語 | hi | インド | P3 |
| 12 | インドネシア語 | id | インドネシア | P3 |
| 13 | ベトナム語 | vi | ベトナム | P3 |
| 14 | タイ語 | th | タイ | P3 |
| 15 | ロシア語 | ru | ロシア・東欧 | P3 |

**優先度定義:**
- P0: 初期リリースで必須
- P1: 初期リリース後3ヶ月以内
- P2: 6ヶ月以内
- P3: 1年以内（ユーザー需要に応じて）

#### 10.6.2 言語検出・切り替え

```
┌─────────────────────────────────────────────────────────┐
│                  Language Detection Flow                │
│                                                         │
│  1. URL パラメータ (?lang=en)                           │
│              ↓ なければ                                 │
│  2. Cookie (preferred_language)                         │
│              ↓ なければ                                 │
│  3. ユーザー設定 (DB保存)                               │
│              ↓ なければ                                 │
│  4. Accept-Language ヘッダー                            │
│              ↓ なければ                                 │
│  5. GeoIP による地域推定                                │
│              ↓ なければ                                 │
│  6. デフォルト (en)                                     │
└─────────────────────────────────────────────────────────┘
```

**UI要件:**
- ヘッダーまたはフッターに言語切り替えボタン配置
- 地球アイコン + 現在の言語名を表示
- 切り替え時はページリロードなし（SPA対応）
- 選択した言語は Cookie + DB に保存

#### 10.6.3 翻訳対象

| カテゴリ | 対象 | 管理方法 |
|---------|------|---------|
| **UI テキスト** | ボタン、ラベル、メニュー | JSON ファイル |
| **エラーメッセージ** | バリデーション、API エラー | JSON ファイル |
| **メール** | 通知、パスワードリセット、請求書 | テンプレート |
| **利用規約・プライバシーポリシー** | 法的文書 | Markdown / CMS |
| **ヘルプ・FAQ** | サポートコンテンツ | CMS |
| **プロダクト説明** | 各プロダクトの説明文 | DB + 管理画面 |
| **プラン名・説明** | 料金プランの内容 | DB + 管理画面 |

#### 10.6.4 技術実装

**フロントエンド:**

```typescript
// react-i18next 使用例
import { useTranslation } from 'react-i18next';

const PricingPage = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('pricing.title')}</h1>
      <p>{t('pricing.description')}</p>
      <button>{t('common.getStarted')}</button>
    </div>
  );
};
```

**翻訳ファイル構造:**

```
locales/
├── en/
│   ├── common.json      # 共通UI
│   ├── auth.json        # 認証関連
│   ├── billing.json     # 課金関連
│   ├── errors.json      # エラーメッセージ
│   └── emails.json      # メールテンプレート
├── ja/
│   ├── common.json
│   ├── auth.json
│   └── ...
├── zh-CN/
│   └── ...
└── ...
```

**翻訳キー命名規則:**

```json
{
  "namespace.category.element": "Translation",

  // 例
  "auth.login.title": "Sign in to your account",
  "auth.login.emailLabel": "Email address",
  "auth.login.passwordLabel": "Password",
  "auth.login.submitButton": "Sign in",
  "auth.login.forgotPassword": "Forgot your password?",

  "billing.plan.free": "Free",
  "billing.plan.pro": "Pro",
  "billing.plan.enterprise": "Enterprise",

  "error.required": "This field is required",
  "error.invalidEmail": "Please enter a valid email address",
  "error.paymentFailed": "Payment failed. Please try again."
}
```

#### 10.6.5 ローカライゼーション（L10n）

言語だけでなく、地域ごとの形式にも対応する。

| 項目 | 対応内容 |
|------|---------|
| **日付形式** | YYYY/MM/DD (ja) vs MM/DD/YYYY (en-US) vs DD/MM/YYYY (eu) |
| **時刻形式** | 24時間 vs 12時間（AM/PM） |
| **数値形式** | 1,234.56 (en) vs 1.234,56 (de) vs 1 234,56 (fr) |
| **通貨形式** | ¥1,234 / $1,234.56 / €1.234,56 |
| **タイムゾーン** | ユーザー設定 or ブラウザ自動検出 |

**実装例:**

```typescript
// Intl API 使用
const formatCurrency = (amount: number, currency: string, locale: string) => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

// 例: formatCurrency(1234, 'JPY', 'ja-JP') → "¥1,234"
// 例: formatCurrency(1234.56, 'USD', 'en-US') → "$1,234.56"
```

#### 10.6.6 RTL（右から左）対応

アラビア語など RTL 言語への対応。

```css
/* RTL 対応 CSS */
[dir="rtl"] {
  /* レイアウト反転 */
  .sidebar { right: 0; left: auto; }
  .icon-arrow { transform: scaleX(-1); }

  /* テキスト配置 */
  text-align: right;
}

/* 論理プロパティ使用（推奨） */
.card {
  margin-inline-start: 16px;  /* margin-left in LTR, margin-right in RTL */
  padding-inline-end: 24px;   /* padding-right in LTR, padding-left in RTL */
}
```

**HTML設定:**

```html
<!-- 言語に応じて自動設定 -->
<html lang="ar" dir="rtl">
```

#### 10.6.7 翻訳ワークフロー

```
┌─────────────────────────────────────────────────────────┐
│                Translation Workflow                      │
│                                                         │
│  1. 開発者 → 英語で UI テキスト作成                     │
│              ↓                                          │
│  2. 翻訳キー抽出 → i18n-scanner 自動抽出               │
│              ↓                                          │
│  3. 翻訳管理 → Crowdin / Lokalise / Phrase              │
│              ↓                                          │
│  4. 翻訳者 → 各言語に翻訳                               │
│              ↓                                          │
│  5. レビュー → ネイティブチェック                       │
│              ↓                                          │
│  6. エクスポート → JSON 自動生成                        │
│              ↓                                          │
│  7. CI/CD → 翻訳ファイルをデプロイ                      │
└─────────────────────────────────────────────────────────┘
```

**翻訳管理ツール:**

| ツール | 特徴 |
|--------|------|
| **Crowdin** | GitHub連携、機械翻訳、用語集 |
| **Lokalise** | リアルタイムプレビュー、SDK |
| **Phrase** | 大規模プロジェクト向け |

#### 10.6.8 品質基準

| 項目 | 基準 |
|------|------|
| **翻訳カバレッジ** | P0/P1言語: 100%、P2言語: 95%以上 |
| **ネイティブチェック** | 全言語でネイティブスピーカーによるレビュー必須 |
| **コンテキスト提供** | 翻訳者にスクリーンショット + 説明を提供 |
| **文字数制限** | ボタン等はUI崩れ防止のため文字数ガイドライン設定 |
| **禁止事項** | 機械翻訳のみでの本番リリース禁止 |

#### 10.6.9 フォント対応

| 言語 | フォント |
|------|---------|
| 英語・欧州言語 | Inter, SF Pro |
| 日本語 | Noto Sans JP, Hiragino Sans |
| 中国語（簡体字） | Noto Sans SC |
| 中国語（繁体字） | Noto Sans TC |
| 韓国語 | Noto Sans KR |
| アラビア語 | Noto Sans Arabic |
| タイ語 | Noto Sans Thai |
| ヒンディー語 | Noto Sans Devanagari |

**フォント読み込み最適化:**

```css
/* 言語別フォント遅延読み込み */
@font-face {
  font-family: 'Noto Sans JP';
  src: url('/fonts/NotoSansJP-Regular.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+3000-9FFF; /* 日本語のみ */
}
```

---

## 11. デザイン要件

### 11.1 デザイン哲学

本プラットフォームのUI/UXは、**Steve Jobs**のプロダクト哲学と**Jony Ive**のデザイン原則に基づき、世界最先端のスタイリッシュなインターフェースを実現する。

> "Design is not just what it looks like and feels like. Design is how it works."
> — Steve Jobs

> "True simplicity is derived from so much more than just the absence of clutter and ornamentation. It's about bringing order to complexity."
> — Jony Ive

### 11.2 Steve Jobs レビュー基準

すべてのUI/UX設計は、以下のSteve Jobs視点でのレビューを通過すること。

| # | レビュー項目 | 基準 |
|---|-------------|------|
| 1 | **一目で理解できるか** | 説明書なしで直感的に操作できること。ユーザーに「考えさせない」 |
| 2 | **無駄な機能はないか** | 「これは本当に必要か？」を問い、NOなら削除。機能の足し算ではなく引き算 |
| 3 | **感動を与えるか** | 単なる「便利」ではなく「素晴らしい」と思わせる体験 |
| 4 | **細部まで美しいか** | ユーザーが見ない部分も手を抜かない。裏側のコードも美しく |
| 5 | **3クリック以内か** | 主要タスクは3クリック以内で完了すること |
| 6 | **待たせていないか** | 体感速度を最優先。遅延は絶対悪 |
| 7 | **一貫性があるか** | 全画面で同じ操作体系、同じ言葉、同じ動き |

**Steve Jobs レビューチェックリスト（リリース前必須）:**

```
□ 祖母に見せても使えるか？
□ この機能を削除したらどうなる？（削除しても問題ないなら削除）
□ 画面を見た瞬間に「何をすべきか」わかるか？
□ エラーメッセージは人間の言葉か？（技術用語禁止）
□ ローディング中も美しいか？
□ 競合製品より10倍良いか？
```

### 11.3 Jony Ive デザイン原則

#### 11.3.1 ビジュアルデザイン

| 原則 | 適用 |
|------|------|
| **極限のシンプリシティ** | 要素は最小限に。余白を恐れない。1画面1目的 |
| **純粋なカラーパレット** | モノクロベース + 1アクセントカラー。グラデーション控えめ |
| **タイポグラフィの美学** | San Francisco / Inter / Noto Sans JP。フォントウェイトで階層表現 |
| **物理を感じる質感** | 微細なシャドウ、ガラス質の透明感、触れたくなる質感 |
| **アニメーションの必然性** | 動きには意味を。装飾的アニメーション禁止。60fps必須 |

#### 11.3.2 カラーシステム

```
Primary Colors:
┌─────────────────────────────────────────────────────────┐
│  Background    #FFFFFF (Light) / #000000 (Dark)        │
│  Surface       #F5F5F7 (Light) / #1D1D1F (Dark)        │
│  Text Primary  #1D1D1F (Light) / #F5F5F7 (Dark)        │
│  Text Secondary #86868B                                 │
│  Accent        #0071E3 (Blue - 信頼・テクノロジー)      │
│  Success       #34C759                                  │
│  Warning       #FF9F0A                                  │
│  Error         #FF3B30                                  │
└─────────────────────────────────────────────────────────┘
```

#### 11.3.3 タイポグラフィ

```
Font Family:
- 英語: SF Pro Display / Inter
- 日本語: Hiragino Sans / Noto Sans JP

Type Scale:
┌─────────────────────────────────────────────────────────┐
│  Display       48px / 700 / -0.02em                    │
│  Headline      32px / 600 / -0.01em                    │
│  Title         24px / 600 / 0                          │
│  Body          16px / 400 / 0                          │
│  Caption       14px / 400 / 0.01em                     │
│  Micro         12px / 500 / 0.02em                     │
└─────────────────────────────────────────────────────────┘
```

#### 11.3.4 スペーシングシステム

```
Spacing Scale (8px base):
┌─────────────────────────────────────────────────────────┐
│  xs     4px   (0.5 unit)                               │
│  sm     8px   (1 unit)                                 │
│  md    16px   (2 units)                                │
│  lg    24px   (3 units)                                │
│  xl    32px   (4 units)                                │
│  2xl   48px   (6 units)                                │
│  3xl   64px   (8 units)                                │
└─────────────────────────────────────────────────────────┘
```

#### 11.3.5 コンポーネント設計

| コンポーネント | Jony Ive スタイル |
|---------------|------------------|
| **ボタン** | 角丸12px、十分なパディング、ホバーで微細な拡大（1.02x） |
| **カード** | 角丸16px、微細シャドウ、背景ブラー（glassmorphism控えめ） |
| **入力フィールド** | ボーダーレス、下線のみ、フォーカスでアクセントカラー |
| **モーダル** | 中央配置、背景ブラー、角丸24px |
| **トースト** | 画面下部、控えめなアニメーション、自動消去 |

### 11.4 インタラクションデザイン

#### 11.4.1 マイクロインタラクション

```
Hover Effects:
- ボタン: scale(1.02) + shadow増加, 150ms ease-out
- カード: translateY(-2px) + shadow増加, 200ms ease-out
- リンク: opacity 0.7, 100ms

Click Effects:
- ボタン: scale(0.98), 50ms
- 触覚フィードバック（モバイル）

Transitions:
- ページ遷移: fade + slide, 300ms cubic-bezier(0.4, 0, 0.2, 1)
- モーダル: scale(0.95→1) + fade, 200ms
- ドロップダウン: height auto + fade, 150ms
```

#### 11.4.2 ローディング状態

```
┌─────────────────────────────────────────────────────────┐
│  Skeleton Loading:                                      │
│  - コンテンツ形状を維持したシマー効果                    │
│  - 背景: linear-gradient アニメーション                 │
│  - 200ms後に表示（瞬間的なローディング表示を防ぐ）       │
│                                                         │
│  Progress Indicators:                                   │
│  - 決済処理: 段階的プログレスバー + メッセージ          │
│  - ファイルアップロード: パーセンテージ表示             │
│  - API呼び出し: 控えめなスピナー（中央配置しない）       │
└─────────────────────────────────────────────────────────┘
```

### 11.5 レスポンシブデザイン

```
Breakpoints:
┌─────────────────────────────────────────────────────────┐
│  Mobile      < 640px   (1カラム、タッチ最適化)          │
│  Tablet      640-1024px (2カラム、タッチ対応)           │
│  Desktop     > 1024px  (マルチカラム、マウス最適化)      │
│  Wide        > 1440px  (コンテンツ幅制限: max-w-7xl)    │
└─────────────────────────────────────────────────────────┘

Touch Targets:
- 最小タッチターゲット: 44x44px
- ボタン間の最小間隔: 8px
```

### 11.6 アクセシビリティ（A11y）

| 項目 | 要件 |
|------|------|
| WCAG | 2.1 AA準拠 |
| コントラスト比 | テキスト 4.5:1以上、大文字 3:1以上 |
| キーボード操作 | 全機能がキーボードで操作可能 |
| スクリーンリーダー | ARIA属性の適切な使用 |
| フォーカス表示 | 明確なフォーカスリング |
| 色覚多様性 | 色のみに依存しない情報伝達 |

### 11.7 ダークモード

```
Design Tokens (Dark Mode):
┌─────────────────────────────────────────────────────────┐
│  --color-bg-primary:     #000000                       │
│  --color-bg-secondary:   #1D1D1F                       │
│  --color-bg-elevated:    #2C2C2E                       │
│  --color-text-primary:   #F5F5F7                       │
│  --color-text-secondary: #A1A1A6                       │
│  --color-border:         #38383A                       │
│  --color-accent:         #0A84FF (調整済みブルー)       │
└─────────────────────────────────────────────────────────┘

Implementation:
- システム設定に自動追従
- 手動切り替えオプション
- 切り替えアニメーション: 200ms fade
```

### 11.8 画面別デザイン要件

#### ログイン画面

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                      [Logo]                             │
│                                                         │
│              Welcome back                               │
│                                                         │
│         ┌─────────────────────────┐                    │
│         │  Continue with Google   │  ← 主要CTA         │
│         └─────────────────────────┘                    │
│                                                         │
│         ┌─────────────────────────┐                    │
│         │  Continue with Microsoft│                    │
│         └─────────────────────────┘                    │
│                                                         │
│              ─────── or ───────                        │
│                                                         │
│         Email                                           │
│         ─────────────────────────                       │
│                                                         │
│         Password                                        │
│         ─────────────────────────                       │
│                                                         │
│         ┌─────────────────────────┐                    │
│         │       Sign in           │                    │
│         └─────────────────────────┘                    │
│                                                         │
│         Don't have an account? Sign up                  │
│                                                         │
└─────────────────────────────────────────────────────────┘

Design Notes:
- ロゴ以外の装飾なし
- フォーム要素は中央寄せ、最大幅400px
- ソーシャルログインを最上部に配置（推奨）
- パスワード入力はマスク + 表示切り替え
```

#### 料金プラン選択画面

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│           Choose your plan                              │
│    Simple pricing. No hidden fees.                      │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │    Free     │  │    Pro      │  │ Enterprise  │     │
│  │             │  │  POPULAR    │  │             │     │
│  │    ¥0      │  │  ¥2,980    │  │   Custom    │     │
│  │   /month   │  │   /month    │  │             │     │
│  │             │  │             │  │             │     │
│  │  ✓ 10回/月  │  │  ✓ 無制限   │  │  ✓ 無制限   │     │
│  │  ✓ 基本機能 │  │  ✓ 全機能   │  │  ✓ 専用環境 │     │
│  │             │  │  ✓ 優先対応 │  │  ✓ SLA保証  │     │
│  │             │  │             │  │  ✓ 専任担当 │     │
│  │             │  │             │  │             │     │
│  │ [始める]    │  │ [始める]    │  │ [相談する]  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘

Design Notes:
- 推奨プランにバッジ + 微細なシャドウで強調
- 価格は大きく、期間は小さく
- 機能リストはアイコン + 簡潔なテキスト
- CTAボタンは各カードの同じ位置に配置
```

#### 管理者ダッシュボード

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]                              [User] [Settings]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Good morning, Admin                                    │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ ¥2.4M    │ │ 1,234    │ │ 456      │ │ 2.3%     │  │
│  │ Revenue  │ │ Users    │ │ Paid     │ │ Churn    │  │
│  │ +12%     │ │ +89      │ │ +23      │ │ -0.5%    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                         │
│  Revenue by Product                    [This Month ▼]  │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                  │   │
│  │     ████████████████████████████████           │   │
│  │     ████████████████████                        │   │
│  │     ████████████                                │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘

Design Notes:
- KPIカードは等幅、数値を大きく表示
- 増減は緑/赤 + 矢印アイコンで視覚化
- グラフは最小限の装飾、データに集中
- フィルターはコンテキストに応じて配置
```

### 11.9 デザインレビュープロセス

```
┌─────────────────────────────────────────────────────────┐
│                  Design Review Flow                     │
│                                                         │
│  1. Designer → Figma/Sketch でデザイン作成              │
│                    ↓                                    │
│  2. Self-Review → Jony Ive原則チェックリスト            │
│                    ↓                                    │
│  3. Peer Review → デザインチーム内レビュー              │
│                    ↓                                    │
│  4. Jobs Review → Steve Jobsレビュー基準で最終チェック  │
│                    ↓                                    │
│  5. User Test → プロトタイプでユーザーテスト            │
│                    ↓                                    │
│  6. Implementation → 開発チームへ引き渡し               │
│                    ↓                                    │
│  7. QA → 実装がデザインと一致しているか確認             │
└─────────────────────────────────────────────────────────┘
```

### 11.10 デザインシステム成果物

| 成果物 | 説明 |
|--------|------|
| **Design Tokens** | カラー、タイポグラフィ、スペーシングのJSON/CSS変数 |
| **Component Library** | React + Tailwind CSS コンポーネント集 |
| **Figma Library** | 再利用可能なFigmaコンポーネント |
| **Storybook** | インタラクティブなコンポーネントカタログ |
| **Animation Guide** | Framer Motion / CSS アニメーション定義 |

---

## 12. 将来拡張要件（設計時に考慮）

| 項目 | 説明 |
|------|------|
| マルチカレンシー | 初期JPYのみ、将来USD/EUR等に拡張可能な構造 |
| 税制対応 | 初期は税込固定、将来Stripe Tax / 各国VAT対応可能 |
| 従量課金 | EventBridge経由で集計 → Stripe metered billing |
| 他決済プロバイダ | プロバイダ種別ごとにハンドラ差し替え可能な設計 |
| マルチテナントOEM | テナントごとにプロダクト / プラン / 決済プロバイダ設定を上書き可能 |

---

## 13. 実装ステップ

### Phase 1: 基盤構築

1. 共通Cognito User Pool作成
2. DynamoDBテーブル作成
3. API Gateway + Lambda構築
4. CloudFront Function実装

### Phase 2: 管理機能

1. Admin Console UI構築
2. プロダクト / プラン管理機能
3. ダッシュボード / 分析機能

### Phase 3: 決済連携

1. Stripe連携実装
2. Webhook処理
3. Entitlement自動更新

### Phase 4: 既存プロダクト統合

1. AI Dream Factory環境変数変更
2. MunchCoach CloudFront Function追加
3. LINE R STEP 最初から共通Pool使用

### Phase 5: SDK / ドキュメント

1. Platform SDK開発
2. 開発者向けドキュメント
3. サンプルコード

---

## 14. 付録

### 14.1 AWSサービス一覧

| カテゴリ | サービス | 用途 |
|---------|---------|------|
| 認証 | Cognito User Pool | ユーザー認証 |
| API | API Gateway | REST API |
| コンピュート | Lambda | ビジネスロジック |
| データベース | DynamoDB | Entitlement等 |
| CDN | CloudFront | 認証ゲートウェイ |
| シークレット | Secrets Manager | Stripeキー等 |
| ストレージ | S3 | 監査ログ保存 |
| 監視 | CloudWatch | ログ / メトリクス |

### 14.2 Terraform ディレクトリ構成

```
terraform/
├── modules/
│   ├── cognito/          # 認証基盤
│   ├── api-gateway/      # API Gateway
│   ├── lambda/           # Lambda関数
│   ├── dynamodb/         # DynamoDB
│   ├── cloudfront/       # CloudFront + Function
│   └── s3/               # 監査ログ保存
├── envs/
│   ├── dev/
│   └── prod/
└── main.tf
```

---

## 15. 承認

| 役割 | 氏名 | 日付 | 署名 |
|-----|------|------|------|
| プロジェクトマネージャー | | | |
| テックリード | | | |
| セキュリティ担当 | | | |

---

## 変更履歴

| バージョン | 日付 | 変更者 | 変更内容 |
|-----------|------|-------|---------|
| 1.0 | 2025-12-11 | Claude | 初版作成（議論内容を反映） |
| 1.1 | 2025-12-11 | Claude | デザイン要件追加（Steve Jobs / Jony Ive原則） |
| 1.2 | 2025-12-11 | Claude | 多言語対応（i18n）要件追加（15言語対応） |
