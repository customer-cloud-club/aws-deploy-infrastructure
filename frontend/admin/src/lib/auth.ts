import { Amplify } from 'aws-amplify';
import {
  signIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  resetPassword,
  confirmResetPassword,
  deleteUser,
  type ResetPasswordOutput,
  type ConfirmResetPasswordInput
} from 'aws-amplify/auth';

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
    await signOut({ global: true });
    // Clear all local storage related to Cognito
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('CognitoIdentityServiceProvider') || key.startsWith('amplify'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  } catch (error) {
    console.error('Sign out error:', error);
    // Even if sign out fails, clear local storage
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('CognitoIdentityServiceProvider') || key.startsWith('amplify'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
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

/**
 * Request password reset - sends confirmation code to user's email
 */
export async function requestPasswordReset(email: string): Promise<ResetPasswordOutput> {
  try {
    const output = await resetPassword({ username: email });
    return output;
  } catch (error) {
    console.error('Password reset request error:', error);
    throw error;
  }
}

/**
 * Confirm password reset with code and new password
 */
export async function confirmPasswordReset(
  email: string,
  confirmationCode: string,
  newPassword: string
): Promise<void> {
  try {
    await confirmResetPassword({
      username: email,
      confirmationCode,
      newPassword,
    } as ConfirmResetPasswordInput);
  } catch (error) {
    console.error('Password reset confirmation error:', error);
    throw error;
  }
}

/**
 * Delete current user's account
 */
export async function deleteUserAccount(): Promise<void> {
  try {
    await deleteUser();
    // Clear all local storage related to Cognito
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('CognitoIdentityServiceProvider') || key.startsWith('amplify'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  } catch (error) {
    console.error('Delete user error:', error);
    throw error;
  }
}
