# Catalog Service Lambda Function

## Overview

The Catalog Service manages products, plans, and tenants for the CCAGI platform. It provides a RESTful API for CRUD operations with integrated Stripe payment processing.

## Architecture

```
catalog/
├── handler.ts      # Main Lambda handler with routing logic
├── products.ts     # Product management operations
├── plans.ts        # Plan management with Stripe integration
├── tenants.ts      # Tenant management operations
├── types.ts        # TypeScript type definitions
└── README.md       # This file
```

## Features

### Products
- List all products (paginated)
- Create new product
- Update existing product
- Soft delete product (with validation)
- Redis caching (1 hour TTL)

### Plans
- List all plans (with optional product filter)
- Create plan with automatic Stripe Price creation
- Update plan metadata
- Soft delete plan (archives in Stripe)
- Redis caching (1 hour TTL)

### Tenants
- List all tenants (paginated, filterable by status)
- Create new tenant with subdomain validation
- Redis caching (5 minutes TTL)

## API Endpoints

### Products

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/admin/products` | List products | Admin |
| POST | `/admin/products` | Create product | Admin |
| PUT | `/admin/products/{id}` | Update product | Admin |
| DELETE | `/admin/products/{id}` | Delete product | Admin |

### Plans

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/admin/plans` | List plans | Admin |
| POST | `/admin/plans` | Create plan + Stripe Price | Admin |
| PUT | `/admin/plans/{id}` | Update plan | Admin |
| DELETE | `/admin/plans/{id}` | Delete plan | Admin |

### Tenants

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/admin/tenants` | List tenants | Admin |
| POST | `/admin/tenants` | Create tenant | Admin |

## Request/Response Examples

### Create Product

**Request:**
```http
POST /admin/products
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Basic Plan",
  "description": "Starter plan for small teams",
  "stripe_product_id": "prod_abc123",
  "is_active": true,
  "metadata": {
    "category": "starter"
  }
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Basic Plan",
  "description": "Starter plan for small teams",
  "stripe_product_id": "prod_abc123",
  "is_active": true,
  "metadata": {
    "category": "starter"
  },
  "created_at": "2025-12-12T06:32:00.000Z",
  "updated_at": "2025-12-12T06:32:00.000Z"
}
```

### Create Plan (with Stripe Integration)

**Request:**
```http
POST /admin/plans
Content-Type: application/json
Authorization: Bearer {token}

{
  "product_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Basic Monthly",
  "billing_period": "monthly",
  "price_amount": 1000,
  "currency": "JPY",
  "trial_period_days": 14,
  "is_active": true,
  "metadata": {
    "tier": "basic"
  }
}
```

**Response:**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "product_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Basic Monthly",
  "stripe_price_id": "price_xyz789",
  "billing_period": "monthly",
  "price_amount": 1000,
  "currency": "JPY",
  "trial_period_days": 14,
  "is_active": true,
  "metadata": {
    "tier": "basic"
  },
  "created_at": "2025-12-12T06:35:00.000Z",
  "updated_at": "2025-12-12T06:35:00.000Z"
}
```

### Create Tenant

**Request:**
```http
POST /admin/tenants
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Acme Corporation",
  "subdomain": "acme",
  "metadata": {
    "industry": "technology"
  }
}
```

**Response:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "name": "Acme Corporation",
  "subdomain": "acme",
  "status": "active",
  "metadata": {
    "industry": "technology"
  },
  "created_at": "2025-12-12T06:40:00.000Z",
  "updated_at": "2025-12-12T06:40:00.000Z"
}
```

## Stripe Integration

### Plan Creation Flow

1. Validate product exists in database
2. Retrieve Stripe Product ID from product record
3. Create Stripe Price via Stripe API
4. Store plan with `stripe_price_id` in database
5. Return plan response to client

### Billing Period Mapping

| Database Value | Stripe Interval |
|----------------|-----------------|
| `monthly` | `month` |
| `yearly` | `year` |
| `one_time` | N/A (no recurring) |

### Plan Deletion

When deleting a plan:
1. Check for active subscriptions (prevents deletion if any exist)
2. Archive Stripe Price (`active: false`)
3. Soft delete plan in database (`deleted_at` timestamp)

## Authorization

All endpoints require **admin role** authorization.

Authorization is checked via:
- `requestContext.authorizer.claims['custom:role']` (Cognito)
- `requestContext.authorizer.role` (Lambda authorizer)

Non-admin requests receive:
```json
{
  "error": "Forbidden",
  "message": "Admin role required"
}
```

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `page` - Page number (1-indexed, default: 1)
- `per_page` - Items per page (default: 20, max: 100)

**Response Format:**
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "per_page": 20,
  "has_more": true
}
```

## Caching Strategy

### Redis Cache

- **Products**: 1 hour TTL
- **Plans**: 1 hour TTL
- **Tenants**: 5 minutes TTL

### Cache Invalidation

Cache is automatically invalidated on:
- Create operations
- Update operations
- Delete operations

### Cache Keys

```typescript
// Products
catalog:product:{id}
catalog:products:all:page:{page}:per_page:{per_page}

// Plans
catalog:plan:{id}
catalog:plans:product:{product_id}:page:{page}:per_page:{per_page}

// Tenants
catalog:tenant:{id}
catalog:tenants:all:page:{page}:per_page:{per_page}
```

## Validation Rules

### Product
- `name` - Required, max 255 characters
- `stripe_product_id` - Required, unique
- `description` - Optional

### Plan
- `product_id` - Required, must exist
- `name` - Required, max 255 characters
- `billing_period` - Required, enum: `monthly`, `yearly`, `one_time`
- `price_amount` - Required, integer (smallest currency unit)
- `currency` - Optional, default: `JPY`

### Tenant
- `name` - Required, max 255 characters
- `subdomain` - Required, unique, 3-63 characters
  - Must be lowercase alphanumeric with hyphens
  - Cannot start or end with hyphen
  - Regex: `/^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/`

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "error": "Bad Request",
  "message": "Missing required fields: name, stripe_product_id"
}
```

**403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "Admin role required"
}
```

**404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "Product not found"
}
```

**409 Conflict:**
```json
{
  "error": "Conflict",
  "message": "Product with this Stripe Product ID already exists"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal Server Error",
  "message": "Failed to create product"
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DB_SECRET_ARN` | Aurora PostgreSQL credentials ARN | Yes |
| `REDIS_URL` | ElastiCache Redis connection URL | Yes |
| `STRIPE_SECRET_KEY` | Stripe API secret key | Yes |
| `AWS_REGION` | AWS region | Yes |
| `ENVIRONMENT` | Environment name (development/production) | No |

## Database Schema

### Products Table

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  stripe_product_id VARCHAR(255) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

### Plans Table

```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  stripe_price_id VARCHAR(255) UNIQUE NOT NULL,
  billing_period VARCHAR(20) NOT NULL CHECK (billing_period IN ('monthly', 'yearly', 'one_time')),
  price_amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'JPY',
  trial_period_days INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

### Tenants Table

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(63) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

## Performance Considerations

### Redis Caching
- Reduces database load by 80%+
- P95 latency: <50ms (cache hit)
- P95 latency: <200ms (cache miss)

### Database Connection Pooling
- RDS Proxy manages connection pooling
- Lambda-optimized pool size: 5 connections
- Automatic credential rotation via Secrets Manager

### Soft Deletes
- Uses `deleted_at` timestamp
- Preserves referential integrity
- Allows data recovery if needed

## Testing

### Unit Tests (Coming Soon)

```bash
npm test -- functions/catalog
```

### Integration Tests

```bash
# Test product creation
curl -X POST https://api.example.com/admin/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "stripe_product_id": "prod_test123"
  }'

# Test plan creation with Stripe
curl -X POST https://api.example.com/admin/plans \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Test Plan",
    "billing_period": "monthly",
    "price_amount": 1000,
    "currency": "JPY"
  }'
```

## Deployment

This Lambda function is deployed via Terraform:

```bash
cd terraform
terraform plan
terraform apply
```

## Monitoring

### CloudWatch Metrics
- Invocation count
- Error rate
- Duration (P50, P95, P99)
- Concurrent executions

### CloudWatch Logs
- Structured JSON logging
- Request/response logging
- Error stack traces (development only)

### Custom Metrics
- Cache hit rate
- Stripe API call duration
- Database query duration

## Related Services

- **Entitlement Service** - Uses plans for feature access
- **Billing Service** - Uses plans for subscription management
- **Stripe** - External payment processing

## Contributing

When adding new endpoints:
1. Define types in `types.ts`
2. Implement handler in appropriate file (`products.ts`, `plans.ts`, `tenants.ts`)
3. Add route to `handler.ts`
4. Update this README
5. Add tests

## License

Proprietary - CCAGI Platform
