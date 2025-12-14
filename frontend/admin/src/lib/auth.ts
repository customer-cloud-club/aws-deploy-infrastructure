import { Amplify } from 'aws-amplify';
import { signIn, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

/**
 * Configure AWS Amplify with Cognito settings
 * These values should be set via environment variables
 */
export function configureAmplify() {
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || process.env.NEXT_PUBLIC_USER_POOL_ID || '';
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || '';
  const region = process.env.NEXT_PUBLIC_COGNITO_REGION || 'ap-northeast-1';

  if (!userPoolId || !clientId) {
    console.warn('Cognito configuration missing. Please set NEXT_PUBLIC_COGNITO_USER_POOL_ID and NEXT_PUBLIC_COGNITO_CLIENT_ID');
    return;
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId: clientId,
        loginWith: {
          email: true,
        },
      },
    },
  });
}

/**
 * Sign in user with email and password
 */
export async function signInUser(email: string, password: string) {
  try {
    const { isSignedIn, nextStep } = await signIn({
      username: email,
      password,
    });

    return { isSignedIn, nextStep };
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
}

/**
 * Sign out current user
 */
export async function signOutUser() {
  try {
    await signOut();
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

/**
 * Get current authenticated user
 */
export async function getAuthUser() {
  try {
    const user = await getCurrentUser();
    return user;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}

/**
 * Get current auth session and tokens
 */
export async function getAuthToken() {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString();
  } catch (error) {
    console.error('Get token error:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
}
