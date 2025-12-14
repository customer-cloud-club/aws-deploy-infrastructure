/**
 * AWS Secrets Manager Utility
 * Provides cached secret retrieval for Lambda functions
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { retryWithExponentialBackoff } from './retry.js';

const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION ?? 'ap-northeast-1',
});

/**
 * Secret cache to avoid excessive Secrets Manager API calls
 */
const secretCache = new Map<string, { value: string; timestamp: number }>();
const CACHE_TTL_MS = 300000; // 5 minutes

/**
 * Retrieves a secret value from AWS Secrets Manager with caching
 *
 * @param secretArn - ARN or name of the secret
 * @returns Secret value as string
 */
export async function getSecretValue(secretArn: string): Promise<string> {
  // Check cache first
  const cached = secretCache.get(secretArn);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log('[Secrets] Using cached secret');
    return cached.value;
  }

  console.log('[Secrets] Fetching secret from Secrets Manager:', secretArn.substring(0, 50) + '...');

  const command = new GetSecretValueCommand({
    SecretId: secretArn,
  });

  const response = await retryWithExponentialBackoff(
    async () => secretsClient.send(command),
    {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 2000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
    }
  );

  if (!response.SecretString) {
    throw new Error('Secret value is empty');
  }

  // Cache the result
  secretCache.set(secretArn, {
    value: response.SecretString,
    timestamp: Date.now(),
  });

  console.log('[Secrets] Successfully retrieved secret');
  return response.SecretString;
}

/**
 * Retrieves Stripe API key from Secrets Manager
 *
 * @returns Stripe API key
 */
export async function getStripeApiKey(): Promise<string> {
  const secretArn = process.env.STRIPE_API_KEY_ARN;

  if (!secretArn) {
    // Fallback to direct environment variable for local development
    const directKey = process.env.STRIPE_SECRET_KEY;
    if (directKey) {
      console.log('[Secrets] Using STRIPE_SECRET_KEY from environment');
      return directKey;
    }
    throw new Error('Neither STRIPE_API_KEY_ARN nor STRIPE_SECRET_KEY is configured');
  }

  const secretValue = await getSecretValue(secretArn);

  // The secret might be stored as plain string or JSON
  try {
    const parsed = JSON.parse(secretValue);
    // If it's JSON, look for common key names
    return parsed.api_key || parsed.secret_key || parsed.STRIPE_SECRET_KEY || secretValue;
  } catch {
    // Not JSON, return as-is
    return secretValue;
  }
}

/**
 * Retrieves Stripe Webhook Secret from Secrets Manager
 *
 * @returns Stripe Webhook Secret
 */
export async function getStripeWebhookSecret(): Promise<string> {
  const secretArn = process.env.STRIPE_WEBHOOK_SECRET_ARN;

  if (!secretArn) {
    // Fallback to direct environment variable for local development
    const directSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (directSecret) {
      console.log('[Secrets] Using STRIPE_WEBHOOK_SECRET from environment');
      return directSecret;
    }
    throw new Error('Neither STRIPE_WEBHOOK_SECRET_ARN nor STRIPE_WEBHOOK_SECRET is configured');
  }

  const secretValue = await getSecretValue(secretArn);

  // The secret might be stored as plain string or JSON
  try {
    const parsed = JSON.parse(secretValue);
    // If it's JSON, look for common key names
    return parsed.webhook_secret || parsed.signing_secret || parsed.STRIPE_WEBHOOK_SECRET || secretValue;
  } catch {
    // Not JSON, return as-is
    return secretValue;
  }
}

/**
 * Clears the secret cache (useful for testing or forced refresh)
 */
export function clearSecretCache(): void {
  secretCache.clear();
}
