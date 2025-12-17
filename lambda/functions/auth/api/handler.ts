/**
 * Auth API Handler
 * Provides password reset and account deletion endpoints
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
    const body = JSON.parse(event.body || '{}');
    const { email } = body;

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
    const body = JSON.parse(event.body || '{}');
    const { email, code, newPassword } = body;

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
