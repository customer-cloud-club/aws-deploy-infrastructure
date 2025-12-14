/**
 * Checkout Session Tests
 *
 * Tests for Stripe Checkout Session creation and validation.
 *
 * Test Scenarios:
 * 1. Valid checkout session creation
 * 2. Missing required fields
 * 3. Invalid URL format
 * 4. Stripe API error handling
 *
 * @module tests/billing/checkout.test
 */

import { handler } from '../../functions/billing/checkout/handler';
import {
  TEST_CONFIG,
  MOCK_USER,
  MOCK_PRODUCTS,
  runTest,
  printResults,
  TestResult,
  assertStatus,
  parseBody,
} from './test-utils';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

/**
 * Create mock API Gateway event
 */
function createMockEvent(body: object | null, userId?: string): APIGatewayProxyEvent {
  return {
    httpMethod: 'POST',
    path: '/checkout',
    body: body ? JSON.stringify(body) : null,
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    isBase64Encoded: false,
    resource: '/checkout',
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: {
        claims: {
          sub: userId || MOCK_USER.id,
        },
      },
      httpMethod: 'POST',
      identity: {} as any,
      path: '/checkout',
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/checkout',
      stage: 'test',
    },
  };
}

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-checkout',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:test-checkout',
  memoryLimitInMB: '256',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test-checkout',
  logStreamName: 'test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

/**
 * Test: Missing user ID (unauthorized)
 */
async function testUnauthorizedRequest(): Promise<void> {
  const event = createMockEvent({
    plan_id: MOCK_PRODUCTS.basic.price_id,
    product_id: MOCK_PRODUCTS.basic.product_id,
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
  });

  // Remove user ID
  event.requestContext.authorizer = {};

  const result = await handler(event, mockContext, () => {});

  if (!result) {
    throw new Error('No response returned');
  }

  assertStatus(result, 401);
  const body = parseBody<{ error: string }>(result.body);
  if (!body.error.includes('Unauthorized')) {
    throw new Error(`Expected unauthorized error, got: ${body.error}`);
  }
}

/**
 * Test: Missing request body
 */
async function testMissingBody(): Promise<void> {
  const event = createMockEvent(null);

  const result = await handler(event, mockContext, () => {});

  if (!result) {
    throw new Error('No response returned');
  }

  assertStatus(result, 400);
  const body = parseBody<{ error: string }>(result.body);
  if (!body.error.includes('Missing request body')) {
    throw new Error(`Expected missing body error, got: ${body.error}`);
  }
}

/**
 * Test: Missing plan_id
 */
async function testMissingPlanId(): Promise<void> {
  const event = createMockEvent({
    product_id: MOCK_PRODUCTS.basic.product_id,
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
  });

  const result = await handler(event, mockContext, () => {});

  if (!result) {
    throw new Error('No response returned');
  }

  assertStatus(result, 400);
  const body = parseBody<{ error: string }>(result.body);
  if (!body.error.includes('plan_id')) {
    throw new Error(`Expected plan_id error, got: ${body.error}`);
  }
}

/**
 * Test: Missing product_id
 */
async function testMissingProductId(): Promise<void> {
  const event = createMockEvent({
    plan_id: MOCK_PRODUCTS.basic.price_id,
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
  });

  const result = await handler(event, mockContext, () => {});

  if (!result) {
    throw new Error('No response returned');
  }

  assertStatus(result, 400);
  const body = parseBody<{ error: string }>(result.body);
  if (!body.error.includes('product_id')) {
    throw new Error(`Expected product_id error, got: ${body.error}`);
  }
}

/**
 * Test: Missing success_url
 */
async function testMissingSuccessUrl(): Promise<void> {
  const event = createMockEvent({
    plan_id: MOCK_PRODUCTS.basic.price_id,
    product_id: MOCK_PRODUCTS.basic.product_id,
    cancel_url: 'https://example.com/cancel',
  });

  const result = await handler(event, mockContext, () => {});

  if (!result) {
    throw new Error('No response returned');
  }

  assertStatus(result, 400);
  const body = parseBody<{ error: string }>(result.body);
  if (!body.error.includes('success_url')) {
    throw new Error(`Expected success_url error, got: ${body.error}`);
  }
}

/**
 * Test: Invalid URL format
 */
async function testInvalidUrlFormat(): Promise<void> {
  const event = createMockEvent({
    plan_id: MOCK_PRODUCTS.basic.price_id,
    product_id: MOCK_PRODUCTS.basic.product_id,
    success_url: 'not-a-valid-url',
    cancel_url: 'https://example.com/cancel',
  });

  const result = await handler(event, mockContext, () => {});

  if (!result) {
    throw new Error('No response returned');
  }

  assertStatus(result, 400);
  const body = parseBody<{ error: string }>(result.body);
  if (!body.error.includes('URL')) {
    throw new Error(`Expected URL format error, got: ${body.error}`);
  }
}

/**
 * Test: Valid checkout session creation (requires Stripe test key)
 * This test requires STRIPE_SECRET_KEY to be configured
 */
async function testValidCheckoutSession(): Promise<void> {
  // Skip if no Stripe key configured
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_xxx')) {
    console.log('  Skipping: STRIPE_SECRET_KEY not configured');
    return;
  }

  const event = createMockEvent({
    plan_id: MOCK_PRODUCTS.basic.price_id,
    product_id: MOCK_PRODUCTS.basic.product_id,
    success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://example.com/cancel',
  });

  const result = await handler(event, mockContext, () => {});

  if (!result) {
    throw new Error('No response returned');
  }

  assertStatus(result, 200);
  const body = parseBody<{ session_id: string; url: string }>(result.body);

  if (!body.session_id || !body.session_id.startsWith('cs_')) {
    throw new Error(`Invalid session_id: ${body.session_id}`);
  }

  if (!body.url || !body.url.includes('checkout.stripe.com')) {
    throw new Error(`Invalid checkout URL: ${body.url}`);
  }
}

/**
 * Run all checkout tests
 */
async function runAllTests(): Promise<void> {
  console.log('=== Checkout Tests ===\n');

  const results: TestResult[] = [];

  results.push(await runTest('Unauthorized request (missing user ID)', testUnauthorizedRequest));
  results.push(await runTest('Missing request body', testMissingBody));
  results.push(await runTest('Missing plan_id', testMissingPlanId));
  results.push(await runTest('Missing product_id', testMissingProductId));
  results.push(await runTest('Missing success_url', testMissingSuccessUrl));
  results.push(await runTest('Invalid URL format', testInvalidUrlFormat));
  results.push(await runTest('Valid checkout session creation', testValidCheckoutSession));

  printResults(results);
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests };
