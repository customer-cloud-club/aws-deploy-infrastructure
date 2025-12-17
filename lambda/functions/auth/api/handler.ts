/**
 * Auth API Handler
 * Provides authentication, password reset and account deletion endpoints
 *
 * Authentication:
 * POST /auth/signup - Sign up with email/password
 * POST /auth/login - Login with email/password
 * POST /auth/callback - OAuth callback (authorization code exchange)
 *
 * Password Reset:
 * POST /auth/reset-password - Request password reset (send code)
 * POST /auth/reset-password/confirm - Confirm password reset with code
 *
 * Account:
 * DELETE /auth/account - Delete authenticated user's account
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AdminDeleteUserCommand,
  GetUserCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Safely parse request body handling base64 encoding and already-parsed objects
 */
function parseBody(event: APIGatewayProxyEvent): Record<string, unknown> {
  if (!event.body) {
    return {};
  }

  // If body is already an object (shouldn't happen with proxy integration, but just in case)
  if (typeof event.body === 'object') {
    return event.body as Record<string, unknown>;
  }

  let bodyString = event.body;

  // Handle base64 encoded body
  if (event.isBase64Encoded) {
    bodyString = Buffer.from(event.body, 'base64').toString('utf-8');
  }

  try {
    return JSON.parse(bodyString);
  } catch (error) {
    console.error('[Auth API] Failed to parse body:', error, 'Body:', bodyString.substring(0, 100));
    return {};
  }
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('[Auth API] Request:', {
    path: event.path,
    method: event.httpMethod,
  });

  // Handle OPTIONS for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  const path = event.path;
  const method = event.httpMethod;

  try {
    // Redirect to Cognito Hosted UI (GET)
    if (path === '/auth/login' && method === 'GET') {
      return await loginRedirect(event);
    }

    // Login with email/password (POST)
    if (path === '/auth/login' && method === 'POST') {
      return await login(event);
    }

    // Sign up with email/password
    if (path === '/auth/signup' && method === 'POST') {
      return await signup(event);
    }

    // Confirm sign up with verification code
    if (path === '/auth/signup/confirm' && method === 'POST') {
      return await confirmSignup(event);
    }

    // OAuth callback (authorization code exchange)
    if (path === '/auth/callback' && method === 'POST') {
      return await callback(event);
    }

    // Password reset request
    if (path === '/auth/reset-password' && method === 'POST') {
      return await requestPasswordReset(event);
    }

    // Password reset confirmation
    if (path === '/auth/reset-password/confirm' && method === 'POST') {
      return await confirmPasswordReset(event);
    }

    // Delete account
    if (path === '/auth/account' && method === 'DELETE') {
      return await deleteAccount(event);
    }

    // Route not found
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Not found', path, method }),
    };
  } catch (error) {
    console.error('[Auth API] Unexpected error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * Request password reset - sends confirmation code to user's email
 */
async function requestPasswordReset(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody(event);
    const email = body.email as string | undefined;

    if (!email) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Email is required' }),
      };
    }

    const command = new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
    });

    const response = await cognitoClient.send(command);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Password reset code sent',
        deliveryMedium: response.CodeDeliveryDetails?.DeliveryMedium || 'EMAIL',
        destination: response.CodeDeliveryDetails?.Destination || '',
      }),
    };
  } catch (error: unknown) {
    const err = error as Error & { name?: string };
    console.error('[Auth API] Password reset request error:', err);

    if (err.name === 'UserNotFoundException') {
      // Don't reveal if user exists
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'If this email is registered, a password reset code will be sent',
          deliveryMedium: 'EMAIL',
          destination: '',
        }),
      };
    }

    if (err.name === 'LimitExceededException') {
      return {
        statusCode: 429,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to request password reset' }),
    };
  }
}

/**
 * Confirm password reset with code and new password
 */
async function confirmPasswordReset(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody(event);
    const email = body.email as string | undefined;
    const code = body.code as string | undefined;
    const newPassword = body.newPassword as string | undefined;

    if (!email || !code || !newPassword) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Email, code, and newPassword are required' }),
      };
    }

    const command = new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    });

    await cognitoClient.send(command);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Password has been reset successfully' }),
    };
  } catch (error: unknown) {
    const err = error as Error & { name?: string };
    console.error('[Auth API] Password reset confirmation error:', err);

    if (err.name === 'CodeMismatchException') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid confirmation code' }),
      };
    }

    if (err.name === 'ExpiredCodeException') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Confirmation code has expired' }),
      };
    }

    if (err.name === 'InvalidPasswordException') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Password does not meet requirements' }),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to reset password' }),
    };
  }
}

/**
 * Delete authenticated user's account
 */
async function deleteAccount(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Get access token from Authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const accessToken = authHeader.substring(7);

    // Get user info from access token
    const getUserCommand = new GetUserCommand({
      AccessToken: accessToken,
    });

    const userResponse = await cognitoClient.send(getUserCommand);
    const username = userResponse.Username;

    if (!username) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unable to identify user' }),
      };
    }

    // Delete user from Cognito
    const deleteCommand = new AdminDeleteUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    });

    await cognitoClient.send(deleteCommand);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Account deleted successfully' }),
    };
  } catch (error: unknown) {
    const err = error as Error & { name?: string };
    console.error('[Auth API] Delete account error:', err);

    if (err.name === 'NotAuthorizedException') {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid or expired token' }),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to delete account' }),
    };
  }
}

/**
 * Redirect to Cognito Hosted UI for OAuth login
 */
async function loginRedirect(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const cognitoDomain = process.env.COGNITO_DOMAIN || '';
  const redirectUri = event.queryStringParameters?.redirect || '';
  const callbackUrl = process.env.COGNITO_CALLBACK_URL || '';

  if (!cognitoDomain) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Cognito domain not configured' }),
    };
  }

  // Store the original redirect URL in state parameter for later use
  const state = redirectUri ? Buffer.from(redirectUri).toString('base64url') : '';

  // Build Cognito Hosted UI authorization URL
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: callbackUrl,
    ...(state && { state }),
  });

  const authUrl = `https://${cognitoDomain}/oauth2/authorize?${params.toString()}`;

  return {
    statusCode: 302,
    headers: {
      ...corsHeaders,
      'Location': authUrl,
    },
    body: '',
  };
}

/**
 * Login with email and password
 */
async function login(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody(event);
    const email = body.email as string | undefined;
    const password = body.password as string | undefined;

    if (!email || !password) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Email and password are required' }),
      };
    }

    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    const response = await cognitoClient.send(command);

    // Check if MFA or other challenge is required
    if (response.ChallengeName) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          challengeName: response.ChallengeName,
          session: response.Session,
          challengeParameters: response.ChallengeParameters,
        }),
      };
    }

    // Successful authentication
    if (response.AuthenticationResult) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          accessToken: response.AuthenticationResult.AccessToken,
          idToken: response.AuthenticationResult.IdToken,
          refreshToken: response.AuthenticationResult.RefreshToken,
          expiresIn: response.AuthenticationResult.ExpiresIn,
          tokenType: response.AuthenticationResult.TokenType || 'Bearer',
        }),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unexpected authentication response' }),
    };
  } catch (error: unknown) {
    const err = error as Error & { name?: string };
    console.error('[Auth API] Login error:', err);

    if (err.name === 'NotAuthorizedException') {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid email or password' }),
      };
    }

    if (err.name === 'UserNotConfirmedException') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User is not confirmed. Please verify your email.' }),
      };
    }

    if (err.name === 'UserNotFoundException') {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid email or password' }),
      };
    }

    if (err.name === 'PasswordResetRequiredException') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Password reset required' }),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Login failed' }),
    };
  }
}

/**
 * Sign up with email and password
 */
async function signup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody(event);
    const email = body.email as string | undefined;
    const password = body.password as string | undefined;
    const name = body.name as string | undefined;

    if (!email || !password) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Email and password are required' }),
      };
    }

    const userAttributes: { Name: string; Value: string }[] = [
      { Name: 'email', Value: email },
    ];

    if (name) {
      userAttributes.push({ Name: 'name', Value: name });
    }

    const command = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: userAttributes,
    });

    const response = await cognitoClient.send(command);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Sign up successful. Please check your email for verification code.',
        userSub: response.UserSub,
        userConfirmed: response.UserConfirmed,
        codeDeliveryDetails: response.CodeDeliveryDetails ? {
          destination: response.CodeDeliveryDetails.Destination,
          deliveryMedium: response.CodeDeliveryDetails.DeliveryMedium,
          attributeName: response.CodeDeliveryDetails.AttributeName,
        } : undefined,
      }),
    };
  } catch (error: unknown) {
    const err = error as Error & { name?: string };
    console.error('[Auth API] Sign up error:', err);

    if (err.name === 'UsernameExistsException') {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'An account with this email already exists' }),
      };
    }

    if (err.name === 'InvalidPasswordException') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Password does not meet requirements' }),
      };
    }

    if (err.name === 'InvalidParameterException') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: err.message || 'Invalid parameters' }),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Sign up failed' }),
    };
  }
}

/**
 * Confirm sign up with verification code
 */
async function confirmSignup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody(event);
    const email = body.email as string | undefined;
    const code = body.code as string | undefined;

    if (!email || !code) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Email and code are required' }),
      };
    }

    const command = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
    });

    await cognitoClient.send(command);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Email verified successfully. You can now log in.' }),
    };
  } catch (error: unknown) {
    const err = error as Error & { name?: string };
    console.error('[Auth API] Confirm sign up error:', err);

    if (err.name === 'CodeMismatchException') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid verification code' }),
      };
    }

    if (err.name === 'ExpiredCodeException') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Verification code has expired' }),
      };
    }

    if (err.name === 'NotAuthorizedException') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User is already confirmed' }),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Verification failed' }),
    };
  }
}

/**
 * OAuth callback - exchange authorization code for tokens
 */
async function callback(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody(event);
    const code = body.code as string | undefined;
    const redirectUri = body.redirectUri as string | undefined;

    if (!code) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Authorization code is required' }),
      };
    }

    // Exchange authorization code for tokens using Cognito token endpoint
    const cognitoDomain = process.env.COGNITO_DOMAIN || '';
    const tokenEndpoint = `https://${cognitoDomain}/oauth2/token`;

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      redirect_uri: redirectUri || '',
    });

    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('[Auth API] Token exchange failed:', errorData);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to exchange authorization code' }),
      };
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      id_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        tokenType: tokens.token_type || 'Bearer',
      }),
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Auth API] Callback error:', err);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to process callback' }),
    };
  }
}
