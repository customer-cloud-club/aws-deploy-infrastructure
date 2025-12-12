-- ============================================================
-- Aurora PostgreSQL Initial Schema
-- Database: miyabi_auth_billing
-- Version: 1.0.0
-- Created: 2025-12-12
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================
-- Table: tenants
-- Description: Multi-tenant organization management
-- ============================================================
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

-- Indexes for tenants
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_created_at ON tenants(created_at);

-- ============================================================
-- Table: users
-- Description: User accounts (linked to Cognito)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  cognito_user_id VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'readonly')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  UNIQUE(tenant_id, email)
);

-- Indexes for users
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_cognito_user_id ON users(cognito_user_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- ============================================================
-- Table: products
-- Description: Product catalog (synced with Stripe)
-- ============================================================
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

-- Indexes for products
CREATE INDEX idx_products_stripe_product_id ON products(stripe_product_id);
CREATE INDEX idx_products_is_active ON products(is_active) WHERE deleted_at IS NULL;

-- ============================================================
-- Table: plans
-- Description: Pricing plans (synced with Stripe Prices)
-- ============================================================
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  stripe_price_id VARCHAR(255) UNIQUE NOT NULL,
  billing_period VARCHAR(20) NOT NULL CHECK (billing_period IN ('monthly', 'yearly', 'one_time')),
  price_amount INTEGER NOT NULL, -- Amount in smallest currency unit (cents for USD, yen for JPY)
  currency VARCHAR(3) NOT NULL DEFAULT 'JPY',
  trial_period_days INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Indexes for plans
CREATE INDEX idx_plans_product_id ON plans(product_id);
CREATE INDEX idx_plans_stripe_price_id ON plans(stripe_price_id);
CREATE INDEX idx_plans_billing_period ON plans(billing_period);
CREATE INDEX idx_plans_is_active ON plans(is_active) WHERE deleted_at IS NULL;

-- ============================================================
-- Table: entitlements
-- Description: Feature entitlements per plan
-- ============================================================
CREATE TABLE entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,
  feature_value VARCHAR(255),
  feature_type VARCHAR(50) NOT NULL DEFAULT 'boolean' CHECK (feature_type IN ('boolean', 'numeric', 'string')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, feature_key)
);

-- Indexes for entitlements
CREATE INDEX idx_entitlements_plan_id ON entitlements(plan_id);
CREATE INDEX idx_entitlements_feature_key ON entitlements(feature_key);

-- ============================================================
-- Table: subscriptions
-- Description: Active subscriptions (synced with Stripe)
-- ============================================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN (
    'incomplete', 'incomplete_expired', 'trialing', 'active',
    'past_due', 'canceled', 'unpaid', 'paused'
  )),
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  cancel_at TIMESTAMP,
  canceled_at TIMESTAMP,
  trial_start TIMESTAMP,
  trial_end TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Indexes for subscriptions
CREATE INDEX idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_current_period_end ON subscriptions(current_period_end);

-- ============================================================
-- Table: payments
-- Description: Payment transaction history
-- ============================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_charge_id VARCHAR(255),
  amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'JPY',
  status VARCHAR(50) NOT NULL CHECK (status IN (
    'requires_payment_method', 'requires_confirmation', 'requires_action',
    'processing', 'requires_capture', 'canceled', 'succeeded', 'failed'
  )),
  failure_code VARCHAR(100),
  failure_message TEXT,
  paid_at TIMESTAMP,
  receipt_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for payments
CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_paid_at ON payments(paid_at);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- ============================================================
-- Table: payment_events
-- Description: Stripe webhook event log
-- ============================================================
CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for payment_events
CREATE INDEX idx_payment_events_event_type ON payment_events(event_type);
CREATE INDEX idx_payment_events_stripe_event_id ON payment_events(stripe_event_id);
CREATE INDEX idx_payment_events_processed_at ON payment_events(processed_at);
CREATE INDEX idx_payment_events_created_at ON payment_events(created_at);
CREATE INDEX idx_payment_events_unprocessed ON payment_events(processed_at) WHERE processed_at IS NULL;

-- ============================================================
-- Table: processed_webhooks
-- Description: Webhook idempotency tracking
-- ============================================================
CREATE TABLE processed_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for processed_webhooks
CREATE INDEX idx_processed_webhooks_webhook_id ON processed_webhooks(webhook_id);
CREATE INDEX idx_processed_webhooks_event_type ON processed_webhooks(event_type);
CREATE INDEX idx_processed_webhooks_created_at ON processed_webhooks(created_at);

-- ============================================================
-- Table: audit_logs
-- Description: Audit trail for important operations
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit_logs
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================
-- Triggers for updated_at timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entitlements_updated_at BEFORE UPDATE ON entitlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Views for common queries
-- ============================================================

-- Active subscriptions with plan details
CREATE VIEW active_subscriptions AS
SELECT
  s.id,
  s.tenant_id,
  t.name AS tenant_name,
  t.subdomain,
  s.plan_id,
  p.name AS plan_name,
  pr.name AS product_name,
  s.stripe_subscription_id,
  s.status,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end,
  p.price_amount,
  p.currency,
  p.billing_period
FROM subscriptions s
JOIN tenants t ON s.tenant_id = t.id
JOIN plans p ON s.plan_id = p.id
JOIN products pr ON p.product_id = pr.id
WHERE s.status IN ('active', 'trialing')
  AND s.deleted_at IS NULL
  AND t.deleted_at IS NULL;

-- Subscription payment summary
CREATE VIEW subscription_payment_summary AS
SELECT
  s.id AS subscription_id,
  s.tenant_id,
  t.name AS tenant_name,
  COUNT(pm.id) AS total_payments,
  SUM(CASE WHEN pm.status = 'succeeded' THEN pm.amount ELSE 0 END) AS total_paid,
  SUM(CASE WHEN pm.status = 'failed' THEN pm.amount ELSE 0 END) AS total_failed,
  MAX(pm.paid_at) AS last_payment_date
FROM subscriptions s
JOIN tenants t ON s.tenant_id = t.id
LEFT JOIN payments pm ON s.id = pm.subscription_id
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.tenant_id, t.name;

-- ============================================================
-- Initial Data (Optional)
-- ============================================================

-- Example: Insert default product and plans
-- Uncomment and modify as needed

/*
INSERT INTO products (name, description, stripe_product_id, is_active) VALUES
  ('Starter Plan', 'Basic features for small teams', 'prod_starter_001', true),
  ('Professional Plan', 'Advanced features for growing teams', 'prod_professional_001', true),
  ('Enterprise Plan', 'Full features for large organizations', 'prod_enterprise_001', true);

INSERT INTO plans (product_id, name, stripe_price_id, billing_period, price_amount, currency, is_active)
SELECT id, 'Starter Monthly', 'price_starter_monthly', 'monthly', 1000, 'JPY', true
FROM products WHERE stripe_product_id = 'prod_starter_001'
UNION ALL
SELECT id, 'Professional Monthly', 'price_professional_monthly', 'monthly', 5000, 'JPY', true
FROM products WHERE stripe_product_id = 'prod_professional_001'
UNION ALL
SELECT id, 'Enterprise Monthly', 'price_enterprise_monthly', 'monthly', 20000, 'JPY', true
FROM products WHERE stripe_product_id = 'prod_enterprise_001';
*/

-- ============================================================
-- Grants (Run as superuser or RDS master user)
-- ============================================================

-- Grant permissions to application user
-- Replace 'app_user' with your actual application database user
/*
GRANT CONNECT ON DATABASE miyabi_auth_billing TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- Ensure future tables/sequences also get permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO app_user;
*/

-- ============================================================
-- Analytics Helper Functions
-- ============================================================

-- Function to get subscription status distribution
CREATE OR REPLACE FUNCTION get_subscription_status_distribution()
RETURNS TABLE (
  status VARCHAR(50),
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.status, COUNT(*)
  FROM subscriptions s
  WHERE s.deleted_at IS NULL
  GROUP BY s.status
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate Monthly Recurring Revenue (MRR)
CREATE OR REPLACE FUNCTION calculate_mrr()
RETURNS TABLE (
  currency VARCHAR(3),
  mrr NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.currency,
    SUM(
      CASE
        WHEN p.billing_period = 'monthly' THEN p.price_amount
        WHEN p.billing_period = 'yearly' THEN p.price_amount / 12.0
        ELSE 0
      END
    ) AS mrr
  FROM subscriptions s
  JOIN plans p ON s.plan_id = p.id
  WHERE s.status IN ('active', 'trialing')
    AND s.deleted_at IS NULL
  GROUP BY p.currency;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Maintenance Queries
-- ============================================================

-- Cleanup old audit logs (older than 1 year)
-- Run periodically via cron or AWS Lambda
/*
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '1 year';
*/

-- Cleanup old processed_webhooks (older than 90 days)
/*
DELETE FROM processed_webhooks
WHERE created_at < NOW() - INTERVAL '90 days';
*/

-- Cleanup old payment_events (older than 90 days, only if processed)
/*
DELETE FROM payment_events
WHERE created_at < NOW() - INTERVAL '90 days'
  AND processed_at IS NOT NULL;
*/

-- ============================================================
-- Schema Version Tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
  ('1.0.0', 'Initial schema creation with tenants, users, products, plans, subscriptions, payments, and audit logs');

-- End of schema.sql
