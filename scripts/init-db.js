/**
 * Database Schema Initialization Script
 * Run this via Lambda to initialize the Aurora PostgreSQL database
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const config = {
  host: process.env.DB_HOST || 'auth-billing-dev-rds-proxy.proxy-c9yyeaq0wwjd.ap-northeast-1.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'miyabi_auth_billing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

async function initializeDatabase() {
  const client = new Client(config);

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully');

    // Check if schema already exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'tenants'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log('Schema already initialized. Checking version...');
      const version = await client.query('SELECT version FROM schema_migrations ORDER BY applied_at DESC LIMIT 1');
      console.log('Current schema version:', version.rows[0]?.version || 'unknown');
      return { status: 'already_initialized', version: version.rows[0]?.version };
    }

    console.log('Initializing schema...');

    // Read and execute schema.sql
    const schemaPath = path.join(__dirname, '../terraform/modules/aurora/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await client.query(schema);
    console.log('Schema initialized successfully');

    // Insert initial data
    console.log('Inserting initial data...');

    // Create default products
    await client.query(`
      INSERT INTO products (name, description, stripe_product_id, is_active) VALUES
        ('AI Dream Factory', 'AI画像生成サービス', 'prod_aidreams_001', true),
        ('MunchCoach', 'AI栄養管理アプリ', 'prod_munchcoach_001', true),
        ('Platform Portal', '共通認証基盤ポータル', 'prod_portal_001', true)
      ON CONFLICT (stripe_product_id) DO NOTHING;
    `);

    // Create default plans
    await client.query(`
      INSERT INTO plans (product_id, name, stripe_price_id, billing_period, price_amount, currency, is_active)
      SELECT p.id, 'Free', 'price_aidreams_free', 'monthly', 0, 'JPY', true
      FROM products p WHERE p.stripe_product_id = 'prod_aidreams_001'
      ON CONFLICT (stripe_price_id) DO NOTHING;

      INSERT INTO plans (product_id, name, stripe_price_id, billing_period, price_amount, currency, is_active)
      SELECT p.id, 'Pro Monthly', 'price_aidreams_pro_monthly', 'monthly', 1980, 'JPY', true
      FROM products p WHERE p.stripe_product_id = 'prod_aidreams_001'
      ON CONFLICT (stripe_price_id) DO NOTHING;

      INSERT INTO plans (product_id, name, stripe_price_id, billing_period, price_amount, currency, is_active)
      SELECT p.id, 'Pro Yearly', 'price_aidreams_pro_yearly', 'yearly', 19800, 'JPY', true
      FROM products p WHERE p.stripe_product_id = 'prod_aidreams_001'
      ON CONFLICT (stripe_price_id) DO NOTHING;
    `);

    // Create default entitlements
    await client.query(`
      INSERT INTO entitlements (plan_id, feature_key, feature_value, feature_type)
      SELECT p.id, 'generations_per_month', '10', 'numeric'
      FROM plans p WHERE p.stripe_price_id = 'price_aidreams_free'
      ON CONFLICT (plan_id, feature_key) DO NOTHING;

      INSERT INTO entitlements (plan_id, feature_key, feature_value, feature_type)
      SELECT p.id, 'generations_per_month', '1000', 'numeric'
      FROM plans p WHERE p.stripe_price_id = 'price_aidreams_pro_monthly'
      ON CONFLICT (plan_id, feature_key) DO NOTHING;

      INSERT INTO entitlements (plan_id, feature_key, feature_value, feature_type)
      SELECT p.id, 'high_resolution', 'true', 'boolean'
      FROM plans p WHERE p.stripe_price_id = 'price_aidreams_pro_monthly'
      ON CONFLICT (plan_id, feature_key) DO NOTHING;
    `);

    console.log('Initial data inserted');

    return { status: 'initialized', message: 'Database schema and initial data created successfully' };

  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Lambda handler
exports.handler = async (event) => {
  try {
    const result = await initializeDatabase();
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// CLI execution
if (require.main === module) {
  initializeDatabase()
    .then(result => {
      console.log('Result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}
