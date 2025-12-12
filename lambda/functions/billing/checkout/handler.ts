/**
 * Checkout Session Creation Handler
 *
 * Creates Stripe Checkout Sessions for subscription purchases.
 * Redirects customers to Stripe-hosted checkout page.
 *
 * Workflow:
 * 1. Extract user ID from JWT (Cognito authorizer)
 * 2. Validate request parameters (plan_id, product_id, URLs)
 * 3. Create Stripe Checkout Session with metadata
 * 4. Return checkout URL for customer redirect
 *
 * @module billing/checkout/handler
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { stripe } from '../stripe';
import type { CheckoutSessionRequest, CheckoutSessionResponse } from '../types';

/**
 * Create Stripe Checkout Session
 *
 * API Endpoint: POST /billing/checkout
 *
 * Request Body:
 * ```json
 * {
 *   "plan_id": "price_xxx",
 *   "product_id": "prod_xxx",
 *   "success_url": "https://example.com/success?session_id={CHECKOUT_SESSION_ID}",
 *   "cancel_url": "https://example.com/cancel"
 * }
 * ```
 *
 * Response:
 * ```json
 * {
 *   "session_id": "cs_xxx",
 *   "url": "https://checkout.stripe.com/xxx"
 * }
 * ```
 *
 * @param event - API Gateway proxy event
 * @returns Checkout session with redirect URL
 */
export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  console.log('[CheckoutHandler] Processing checkout session creation');

  try {
    // Extract user ID from Cognito JWT
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized - missing user ID' }),
      };
    }

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const request: CheckoutSessionRequest = JSON.parse(event.body);

    // Validate required fields
    const validationError = validateRequest(request);
    if (validationError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: validationError }),
      };
    }

    // Create Stripe Checkout Session
    const session = await createCheckoutSession(userId, request);

    // Return checkout URL
    const response: CheckoutSessionResponse = {
      session_id: session.id,
      url: session.url || '',
    };

    console.log('[CheckoutHandler] Checkout session created successfully', {
      userId,
      sessionId: session.id,
      planId: request.plan_id,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Configure CORS as needed
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[CheckoutHandler] Error creating checkout session:', error);

    // Handle Stripe API errors
    if ((error as any).type === 'StripeInvalidRequestError') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid request',
          details: (error as Error).message,
        }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Validate checkout request parameters
 */
function validateRequest(request: CheckoutSessionRequest): string | null {
  if (!request.plan_id || typeof request.plan_id !== 'string') {
    return 'Missing or invalid plan_id';
  }

  if (!request.product_id || typeof request.product_id !== 'string') {
    return 'Missing or invalid product_id';
  }

  if (!request.success_url || typeof request.success_url !== 'string') {
    return 'Missing or invalid success_url';
  }

  if (!request.cancel_url || typeof request.cancel_url !== 'string') {
    return 'Missing or invalid cancel_url';
  }

  // Validate URLs are well-formed
  try {
    new URL(request.success_url);
    new URL(request.cancel_url);
  } catch (err) {
    return 'Invalid URL format in success_url or cancel_url';
  }

  return null;
}

/**
 * Create Stripe Checkout Session
 *
 * Configuration:
 * - Mode: subscription (recurring payment)
 * - Payment method types: card (can be extended to include other methods)
 * - Customer creation: automatic
 * - Metadata: Stores user_id and product_id for webhook processing
 */
async function createCheckoutSession(
  userId: string,
  request: CheckoutSessionRequest
): Promise<any> {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: request.plan_id,
        quantity: 1,
      },
    ],
    success_url: request.success_url,
    cancel_url: request.cancel_url,
    client_reference_id: userId,
    metadata: {
      user_id: userId,
      product_id: request.product_id,
      ...(request.metadata || {}),
    },
    // Allow promotion codes
    allow_promotion_codes: true,
    // Billing address collection
    billing_address_collection: 'auto',
    // Automatically assign customer email from session
    customer_email: undefined, // Will be collected during checkout
    // Set subscription data
    subscription_data: {
      metadata: {
        user_id: userId,
        product_id: request.product_id,
      },
    },
    // Consent collection (if required for terms of service)
    consent_collection: {
      terms_of_service: 'none', // Change to 'required' if needed
    },
  });

  return session;
}

/**
 * CORS Preflight handler
 * Handles OPTIONS requests for CORS
 */
export const optionsHandler: APIGatewayProxyHandler = async (): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: '',
  };
};
