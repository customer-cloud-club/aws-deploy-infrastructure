-- Migration: 001_initial_schema
-- Description: Create initial database tables for auth-billing system
-- Created: 2024-12-14

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Products Table
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    stripe_product_id VARCHAR(255) UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_products_stripe_product_id ON products(stripe_product_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_deleted_at ON products(deleted_at);

-- ============================================
-- Plans Table
-- ============================================
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    stripe_price_id VARCHAR(255) UNIQUE,
    billing_period VARCHAR(50) NOT NULL CHECK (billing_period IN ('monthly', 'yearly', 'one_time')),
    price_amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'JPY',
    trial_period_days INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_plans_product_id ON plans(product_id);
CREATE INDEX idx_plans_stripe_price_id ON plans(stripe_price_id);
CREATE INDEX idx_plans_is_active ON plans(is_active);
CREATE INDEX idx_plans_deleted_at ON plans(deleted_at);

-- ============================================
-- Tenants Table
-- ============================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(63) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_deleted_at ON tenants(deleted_at);

-- ============================================
-- Subscriptions Table
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'unpaid', 'incomplete', 'incomplete_expired')),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    canceled_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_deleted_at ON subscriptions(deleted_at);

-- ============================================
-- Entitlements Table
-- ============================================
CREATE TABLE IF NOT EXISTS entitlements (
    entitlement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended', 'revoked')),
    feature_flags JSONB DEFAULT '{}',
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    soft_limit INTEGER,
    usage_reset_at TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entitlements_user_id ON entitlements(user_id);
CREATE INDEX idx_entitlements_tenant_id ON entitlements(tenant_id);
CREATE INDEX idx_entitlements_product_id ON entitlements(product_id);
CREATE INDEX idx_entitlements_plan_id ON entitlements(plan_id);
CREATE INDEX idx_entitlements_subscription_id ON entitlements(subscription_id);
CREATE INDEX idx_entitlements_status ON entitlements(status);
CREATE INDEX idx_entitlements_valid_until ON entitlements(valid_until);
CREATE UNIQUE INDEX idx_entitlements_user_product ON entitlements(user_id, product_id) WHERE status = 'active';

-- ============================================
-- Audit Log Table (for tracking changes)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    user_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================
-- Updated_at Trigger Function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entitlements_updated_at
    BEFORE UPDATE ON entitlements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Insert sample data for testing
-- ============================================
INSERT INTO products (id, name, description, is_active, metadata) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'Basic Plan', 'Basic features for small teams', true, '{"tier": "basic"}'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Pro Plan', 'Advanced features for growing businesses', true, '{"tier": "pro"}'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Enterprise Plan', 'Full features for large organizations', true, '{"tier": "enterprise"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO plans (id, product_id, name, billing_period, price_amount, currency, trial_period_days, is_active, metadata) VALUES
    ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Basic Monthly', 'monthly', 980, 'JPY', 14, true, '{}'),
    ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Basic Yearly', 'yearly', 9800, 'JPY', 14, true, '{}'),
    ('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'Pro Monthly', 'monthly', 2980, 'JPY', 14, true, '{}'),
    ('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'Pro Yearly', 'yearly', 29800, 'JPY', 14, true, '{}'),
    ('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', 'Enterprise Monthly', 'monthly', 9800, 'JPY', 30, true, '{}'),
    ('660e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', 'Enterprise Yearly', 'yearly', 98000, 'JPY', 30, true, '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tenants (id, name, subdomain, status, metadata) VALUES
    ('770e8400-e29b-41d4-a716-446655440001', 'Demo Company', 'demo', 'active', '{"industry": "technology"}')
ON CONFLICT (id) DO NOTHING;

-- Migration complete
SELECT 'Migration 001_initial_schema completed successfully' AS status;
