-- Migration: 002_user_product_logins
-- Description: Track user logins per product/app for cross-app authentication
-- Created: 2024-12-15

-- ============================================
-- User Product Logins Table
-- ============================================
-- Tracks which products/apps each user has logged into
-- Used for:
-- 1. Admin dashboard to show user's app login history
-- 2. Cross-app auth: skip email verification for users already verified in another app

CREATE TABLE IF NOT EXISTS user_product_logins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,  -- Cognito sub
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    email VARCHAR(255),  -- Store email for reference
    first_login_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    login_count INTEGER NOT NULL DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- Indexes for common queries
CREATE INDEX idx_user_product_logins_user_id ON user_product_logins(user_id);
CREATE INDEX idx_user_product_logins_product_id ON user_product_logins(product_id);
CREATE INDEX idx_user_product_logins_email ON user_product_logins(email);
CREATE INDEX idx_user_product_logins_first_login_at ON user_product_logins(first_login_at);
CREATE INDEX idx_user_product_logins_last_login_at ON user_product_logins(last_login_at);

-- Apply updated_at trigger
CREATE TRIGGER update_user_product_logins_updated_at
    BEFORE UPDATE ON user_product_logins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Migration complete
SELECT 'Migration 002_user_product_logins completed successfully' AS status;
