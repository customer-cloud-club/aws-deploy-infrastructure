# API リファレンス

## 概要

Platform APIは共通認証・課金基盤の全機能にアクセスするためのREST APIです。

**Base URL**: `https://p8uhqklb43.execute-api.ap-northeast-1.amazonaws.com/development`

## 認証

すべてのAPI（認証系を除く）は`Authorization`ヘッダーにJWTトークンが必要です。

```
Authorization: Bearer <access_token>
```

---

## Auth API

### GET /auth/me

現在のユーザー情報を取得

**Response**
```json
{
  "userId": "abc123",
  "email": "user@example.com",
  "name": "山田 太郎",
  "tenantId": "tenant-001",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### POST /auth/callback

OAuth認証コールバック処理

**Request**
```json
{
  "code": "authorization_code",
  "productId": "your-product"
}
```

**Response**
```json
{
  "accessToken": "eyJhbG...",
  "idToken": "eyJhbG...",
  "expiresIn": 3600,
  "user": {
    "userId": "abc123",
    "email": "user@example.com"
  }
}
```

---

## Entitlements API

### GET /entitlements

利用権を取得

**Query Parameters**
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| productId | string | Yes | プロダクトID |

**Response**
```json
{
  "id": "ent-123",
  "userId": "user-123",
  "productId": "ai-dream-factory",
  "planId": "pro",
  "planName": "Pro Plan",
  "status": "active",
  "features": {
    "high_resolution": true,
    "ai_generation": true,
    "max_projects": 100
  },
  "limits": {
    "apiCalls": 10000,
    "generations": 1000,
    "storage": 10240
  },
  "currentUsage": {
    "apiCalls": 1234,
    "generations": 56,
    "storage": 512,
    "resetAt": "2024-02-01T00:00:00Z"
  },
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

### POST /entitlements/usage

使用量を記録

**Request**
```json
{
  "productId": "ai-dream-factory",
  "type": "generation",
  "amount": 1,
  "metadata": {
    "model": "stable-diffusion-xl",
    "resolution": "1024x1024"
  }
}
```

**Response**
```json
{
  "success": true,
  "currentUsage": {
    "generations": 57
  }
}
```

---

## Catalog API

### GET /catalog/products

プロダクト一覧を取得

**Response**
```json
{
  "products": [
    {
      "id": "ai-dream-factory",
      "name": "AI Dream Factory",
      "description": "AI画像生成サービス",
      "status": "active"
    }
  ]
}
```

### GET /catalog/plans

プラン一覧を取得

**Query Parameters**
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| productId | string | Yes | プロダクトID |

**Response**
```json
{
  "plans": [
    {
      "id": "free",
      "name": "Free",
      "description": "無料プラン",
      "price": 0,
      "billingCycle": "monthly",
      "features": {
        "ai_generation": true,
        "high_resolution": false
      },
      "limits": {
        "generations": 10,
        "storage": 100
      }
    },
    {
      "id": "pro",
      "name": "Pro",
      "description": "プロフェッショナル向け",
      "price": 1980,
      "billingCycle": "monthly",
      "features": {
        "ai_generation": true,
        "high_resolution": true
      },
      "limits": {
        "generations": 1000,
        "storage": 10240
      }
    }
  ]
}
```

---

## Billing API

### POST /billing/checkout

Stripe Checkoutセッションを作成

**Request**
```json
{
  "productId": "ai-dream-factory",
  "planId": "pro",
  "successUrl": "https://example.com/success",
  "cancelUrl": "https://example.com/cancel"
}
```

**Response**
```json
{
  "checkoutUrl": "https://checkout.stripe.com/...",
  "sessionId": "cs_xxx"
}
```

### POST /billing/portal

Stripeカスタマーポータルへのリンクを取得

**Request**
```json
{
  "returnUrl": "https://example.com/account"
}
```

**Response**
```json
{
  "portalUrl": "https://billing.stripe.com/..."
}
```

---

## エラーレスポンス

すべてのAPIは統一されたエラーフォーマットを返します。

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "The access token is invalid or expired",
    "details": {}
  }
}
```

### エラーコード一覧

| コード | HTTPステータス | 説明 |
|--------|---------------|------|
| INVALID_TOKEN | 401 | トークンが無効または期限切れ |
| UNAUTHORIZED | 403 | 権限なし |
| NOT_FOUND | 404 | リソースが見つからない |
| LIMIT_EXCEEDED | 429 | レート制限超過 |
| USAGE_LIMIT_EXCEEDED | 403 | 使用制限超過 |
| INTERNAL_ERROR | 500 | サーバーエラー |

---

## レート制限

| エンドポイント | 制限 |
|---------------|------|
| 認証系 | 10 req/sec |
| 参照系 | 100 req/sec |
| 更新系 | 50 req/sec |

制限超過時は`429 Too Many Requests`を返します。

レスポンスヘッダー:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```
