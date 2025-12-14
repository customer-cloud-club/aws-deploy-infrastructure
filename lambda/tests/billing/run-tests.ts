/**
 * Billing Test Runner
 *
 * Runs all billing integration tests.
 *
 * Usage:
 *   npx ts-node tests/billing/run-tests.ts
 *   npx ts-node tests/billing/run-tests.ts --checkout
 *   npx ts-node tests/billing/run-tests.ts --webhook
 *   npx ts-node tests/billing/run-tests.ts --subscription
 *
 * Environment Variables:
 *   STRIPE_SECRET_KEY     - Stripe test mode API key
 *   STRIPE_WEBHOOK_SECRET - Stripe webhook signing secret
 *   API_ENDPOINT          - API Gateway endpoint URL
 *
 * @module tests/billing/run-tests
 */

import { runAllTests as runCheckoutTests } from './checkout.test.js';
import { runAllTests as runWebhookTests } from './webhook.test.js';
import { runAllTests as runSubscriptionTests } from './subscription.test.js';

type TestSuite = 'checkout' | 'webhook' | 'subscription' | 'all';

/**
 * Parse command line arguments
 */
function parseArgs(): TestSuite[] {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return ['all'];
  }

  const suites: TestSuite[] = [];

  for (const arg of args) {
    switch (arg) {
      case '--checkout':
      case '-c':
        suites.push('checkout');
        break;
      case '--webhook':
      case '-w':
        suites.push('webhook');
        break;
      case '--subscription':
      case '-s':
        suites.push('subscription');
        break;
      case '--all':
      case '-a':
        suites.push('all');
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  return suites.length > 0 ? suites : ['all'];
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Billing Test Runner

Usage:
  npx ts-node tests/billing/run-tests.ts [options]

Options:
  --checkout, -c       Run checkout tests only
  --webhook, -w        Run webhook tests only
  --subscription, -s   Run subscription tests only
  --all, -a            Run all tests (default)
  --help, -h           Show this help message

Environment Variables:
  STRIPE_SECRET_KEY     Stripe test mode API key (sk_test_xxx)
  STRIPE_WEBHOOK_SECRET Stripe webhook signing secret (whsec_xxx)
  API_ENDPOINT          API Gateway endpoint URL

Examples:
  # Run all tests
  npx ts-node tests/billing/run-tests.ts

  # Run only webhook tests
  npx ts-node tests/billing/run-tests.ts --webhook

  # Run checkout and subscription tests
  npx ts-node tests/billing/run-tests.ts --checkout --subscription
`);
}

/**
 * Check environment configuration
 */
function checkEnvironment(): void {
  console.log('=== Environment Check ===\n');

  const checks = [
    {
      name: 'STRIPE_SECRET_KEY',
      value: process.env.STRIPE_SECRET_KEY,
      required: true,
      mask: true,
    },
    {
      name: 'STRIPE_WEBHOOK_SECRET',
      value: process.env.STRIPE_WEBHOOK_SECRET,
      required: true,
      mask: true,
    },
    {
      name: 'API_ENDPOINT',
      value: process.env.API_ENDPOINT,
      required: false,
      mask: false,
    },
    {
      name: 'DB_HOST',
      value: process.env.DB_HOST,
      required: false,
      mask: false,
    },
  ];

  let allPassed = true;

  for (const check of checks) {
    const status = check.value ? '\x1b[32m✓\x1b[0m' : (check.required ? '\x1b[31m✗\x1b[0m' : '\x1b[33m-\x1b[0m');
    const value = check.value
      ? (check.mask ? `${check.value.substring(0, 10)}...` : check.value)
      : '(not set)';

    console.log(`${status} ${check.name}: ${value}`);

    if (check.required && !check.value) {
      allPassed = false;
    }
  }

  console.log('');

  if (!allPassed) {
    console.warn('\x1b[33mWarning: Some required environment variables are not set.\x1b[0m');
    console.warn('Some tests may be skipped or fail.\n');
  }
}

/**
 * Main test runner
 */
async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║    Stripe Billing Integration Tests   ║');
  console.log('╚══════════════════════════════════════╝\n');

  checkEnvironment();

  const suites = parseArgs();
  const runAll = suites.includes('all');

  const startTime = Date.now();

  try {
    if (runAll || suites.includes('checkout')) {
      console.log('\n');
      await runCheckoutTests();
    }

    if (runAll || suites.includes('webhook')) {
      console.log('\n');
      await runWebhookTests();
    }

    if (runAll || suites.includes('subscription')) {
      console.log('\n');
      await runSubscriptionTests();
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n=== All tests completed in ${duration}s ===\n`);
  } catch (error) {
    console.error('\nTest runner failed:', error);
    process.exit(1);
  }
}

// Run main
main().catch(console.error);
