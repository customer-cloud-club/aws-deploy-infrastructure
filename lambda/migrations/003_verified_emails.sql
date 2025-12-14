-- Migration: 003_verified_emails
-- Description: Simple table to track verified emails for cross-app auth
-- Created: 2024-12-15

-- ============================================
-- Verified Emails Table
-- ============================================
-- Tracks emails that have been verified in any app
-- Used for cross-app auth: skip email verification for users already verified elsewhere

CREATE TABLE IF NOT EXISTS verified_emails (
    email VARCHAR(255) PRIMARY KEY,
    first_verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    user_id VARCHAR(255),  -- Cognito sub (optional, for reference)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_verified_emails_user_id ON verified_emails(user_id);

-- Migration complete
SELECT 'Migration 003_verified_emails completed successfully' AS status;
