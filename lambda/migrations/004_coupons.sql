-- Migration: 004_coupons
-- Description: Add coupons and promotion_codes tables for Stripe integration
-- Created: 2024-12-16

-- ============================================
-- Coupons Table
-- Stores Stripe coupon information
-- ============================================
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_coupon_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    percent_off DECIMAL(5,2) CHECK (percent_off IS NULL OR (percent_off > 0 AND percent_off <= 100)),
    amount_off INTEGER CHECK (amount_off IS NULL OR amount_off > 0),
    currency VARCHAR(3),
    duration VARCHAR(20) NOT NULL CHECK (duration IN ('once', 'repeating', 'forever')),
    duration_in_months INTEGER CHECK (duration_in_months IS NULL OR duration_in_months > 0),
    max_redemptions INTEGER CHECK (max_redemptions IS NULL OR max_redemptions > 0),
    times_redeemed INTEGER NOT NULL DEFAULT 0,
    redeem_by TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    -- Either percent_off or amount_off must be set, but not both
    CONSTRAINT chk_discount_type CHECK (
        (percent_off IS NOT NULL AND amount_off IS NULL) OR
        (percent_off IS NULL AND amount_off IS NOT NULL)
    ),
    -- Currency is required when amount_off is set
    CONSTRAINT chk_currency_required CHECK (
        amount_off IS NULL OR currency IS NOT NULL
    ),
    -- duration_in_months is required when duration is 'repeating'
    CONSTRAINT chk_duration_in_months CHECK (
        duration != 'repeating' OR duration_in_months IS NOT NULL
    )
);

CREATE INDEX idx_coupons_stripe_coupon_id ON coupons(stripe_coupon_id);
CREATE INDEX idx_coupons_is_active ON coupons(is_active);
CREATE INDEX idx_coupons_deleted_at ON coupons(deleted_at);
CREATE INDEX idx_coupons_redeem_by ON coupons(redeem_by);

-- ============================================
-- Promotion Codes Table
-- Stores Stripe promotion codes linked to coupons
-- ============================================
CREATE TABLE IF NOT EXISTS promotion_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_promotion_code_id VARCHAR(255) UNIQUE NOT NULL,
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    code VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    max_redemptions INTEGER CHECK (max_redemptions IS NULL OR max_redemptions > 0),
    times_redeemed INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    minimum_amount INTEGER CHECK (minimum_amount IS NULL OR minimum_amount >= 0),
    minimum_amount_currency VARCHAR(3),
    first_time_transaction BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    -- Currency is required when minimum_amount is set
    CONSTRAINT chk_min_amount_currency CHECK (
        minimum_amount IS NULL OR minimum_amount_currency IS NOT NULL
    )
);

CREATE INDEX idx_promotion_codes_stripe_id ON promotion_codes(stripe_promotion_code_id);
CREATE INDEX idx_promotion_codes_coupon_id ON promotion_codes(coupon_id);
CREATE INDEX idx_promotion_codes_code ON promotion_codes(code);
CREATE INDEX idx_promotion_codes_is_active ON promotion_codes(is_active);
CREATE INDEX idx_promotion_codes_deleted_at ON promotion_codes(deleted_at);
CREATE INDEX idx_promotion_codes_expires_at ON promotion_codes(expires_at);

-- ============================================
-- Apply updated_at triggers
-- ============================================
CREATE TRIGGER update_coupons_updated_at
    BEFORE UPDATE ON coupons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promotion_codes_updated_at
    BEFORE UPDATE ON promotion_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Migration complete
SELECT 'Migration 004_coupons completed successfully' AS status;
