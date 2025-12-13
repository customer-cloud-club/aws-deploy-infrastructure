import pg from 'pg';
import { Signer } from '@aws-sdk/rds-signer';
const { Client } = pg;

const schema = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS tenants (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, subdomain VARCHAR(63) UNIQUE NOT NULL, status VARCHAR(20) DEFAULT 'active', metadata JSONB DEFAULT '{}', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, description TEXT, stripe_product_id VARCHAR(255) UNIQUE NOT NULL, is_active BOOLEAN DEFAULT true, metadata JSONB DEFAULT '{}', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS plans (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), product_id UUID REFERENCES products(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, stripe_price_id VARCHAR(255) UNIQUE NOT NULL, billing_period VARCHAR(20) NOT NULL, price_amount INTEGER NOT NULL, currency VARCHAR(3) DEFAULT 'JPY', usage_limit INTEGER DEFAULT 1000, feature_flags JSONB DEFAULT '{}', soft_limit_percent DECIMAL(3,2) DEFAULT 0.10, is_active BOOLEAN DEFAULT true, metadata JSONB DEFAULT '{}', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS plan_features (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), plan_id UUID REFERENCES plans(id) ON DELETE CASCADE, feature_key VARCHAR(100) NOT NULL, feature_value VARCHAR(255), feature_type VARCHAR(50) DEFAULT 'boolean', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(plan_id, feature_key));
CREATE TABLE IF NOT EXISTS subscriptions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, plan_id UUID REFERENCES plans(id), stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL, stripe_customer_id VARCHAR(255) NOT NULL, status VARCHAR(50) NOT NULL, current_period_start TIMESTAMP NOT NULL, current_period_end TIMESTAMP NOT NULL, metadata JSONB DEFAULT '{}', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, email VARCHAR(255) NOT NULL, cognito_user_id VARCHAR(255) UNIQUE NOT NULL, role VARCHAR(50) DEFAULT 'member', is_active BOOLEAN DEFAULT true, metadata JSONB DEFAULT '{}', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS user_entitlements (entitlement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id VARCHAR(255) NOT NULL, product_id VARCHAR(255) NOT NULL, plan_id UUID REFERENCES plans(id), status VARCHAR(20) DEFAULT 'active', feature_flags JSONB DEFAULT '{}', usage_limit INTEGER, usage_count INTEGER DEFAULT 0, soft_limit INTEGER, usage_reset_at TIMESTAMP, valid_until TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, product_id));
CREATE TABLE IF NOT EXISTS processed_webhooks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), webhook_id VARCHAR(255) UNIQUE NOT NULL, event_type VARCHAR(100) NOT NULL, processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(50) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, description TEXT);
INSERT INTO schema_migrations (version, description) VALUES ('1.0.0', 'Initial') ON CONFLICT DO NOTHING;
INSERT INTO schema_migrations (version, description) VALUES ('1.1.0', 'Add user_entitlements table') ON CONFLICT DO NOTHING;

ALTER TABLE plans ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT 1000;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS soft_limit_percent DECIMAL(3,2) DEFAULT 0.10;
`;

const seedData = `
INSERT INTO products (name, description, stripe_product_id) VALUES ('AI Dream Factory', 'AI画像生成', 'prod_aidreams'), ('MunchCoach', 'AI栄養管理', 'prod_munchcoach') ON CONFLICT DO NOTHING;
INSERT INTO plans (product_id, name, stripe_price_id, billing_period, price_amount, usage_limit) SELECT id, 'Free', 'price_free', 'monthly', 0, 100 FROM products WHERE stripe_product_id = 'prod_aidreams' ON CONFLICT DO NOTHING;
INSERT INTO plans (product_id, name, stripe_price_id, billing_period, price_amount, usage_limit) SELECT id, 'Pro', 'price_pro', 'monthly', 1980, 10000 FROM products WHERE stripe_product_id = 'prod_aidreams' ON CONFLICT DO NOTHING;
INSERT INTO user_entitlements (user_id, product_id, plan_id, status, usage_limit, usage_count, soft_limit) SELECT 'b7b48af8-a0e1-70f9-d7d1-3bacae70707c', 'prod_aidreams', p.id, 'active', 100, 0, 80 FROM plans p WHERE p.stripe_price_id = 'price_free' ON CONFLICT (user_id, product_id) DO NOTHING;
`;

export const handler = async () => {
  const hostname = process.env.DB_HOST;
  const port = parseInt(process.env.DB_PORT || '5432');
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const region = process.env.AWS_REGION || 'ap-northeast-1';
  const useIAM = process.env.USE_IAM_AUTH === 'true';

  let password = process.env.DB_PASSWORD;
  
  if (useIAM) {
    console.log('Generating IAM auth token...');
    const signer = new Signer({ hostname, port, username: user, region });
    password = await signer.getAuthToken();
    console.log('IAM token generated');
  }

  const client = new Client({ host: hostname, port, database, user, password, ssl: { rejectUnauthorized: false } });

  try {
    console.log('Connecting to', hostname);
    await client.connect();
    console.log('Connected');
    await client.query(schema);
    console.log('Schema created');
    await client.query(seedData);
    console.log('Seed data inserted');
    const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    return { statusCode: 200, body: JSON.stringify({ message: 'OK', tables: result.rows.map(r => r.table_name) }) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  } finally {
    await client.end();
  }
};
