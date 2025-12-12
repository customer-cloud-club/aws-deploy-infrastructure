import { Amplify } from 'aws-amplify'
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  signOut as amplifySignOut,
  getCurrentUser,
  fetchAuthSession,
  signInWithRedirect,
} from 'aws-amplify/auth'

/**
 * Authentication Library
 *
 * Custom Cognito authentication using AWS Amplify v6.
 * Provides email/password and social authentication (Google, Microsoft).
 */

// Configure Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
      loginWith: {
        oauth: {
          domain: `${process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID}.auth.${process.env.NEXT_PUBLIC_COGNITO_REGION}.amazoncognito.com`,
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [
            typeof window !== 'undefined' ? window.location.origin : '',
          ],
          redirectSignOut: [
            typeof window !== 'undefined' ? window.location.origin : '',
          ],
          responseType: 'code',
        },
      },
    },
  },
})

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  try {
    const result = await amplifySignIn({
      username: email,
      password,
    })
    return result
  } catch (error) {
    console.error('Sign in error:', error)
    throw error
  }
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string) {
  try {
    const result = await amplifySignUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
        },
      },
    })
    return result
  } catch (error) {
    console.error('Sign up error:', error)
    throw error
  }
}

/**
 * Confirm sign up with verification code
 */
export async function confirmSignUp(email: string, code: string) {
  try {
    const result = await amplifyConfirmSignUp({
      username: email,
      confirmationCode: code,
    })
    return result
  } catch (error) {
    console.error('Confirm sign up error:', error)
    throw error
  }
}

/**
 * Sign out current user
 */
export async function signOut() {
  try {
    await amplifySignOut()
  } catch (error) {
    console.error('Sign out error:', error)
    throw error
  }
}

/**
 * Get current authenticated user
 */
export async function getUser() {
  try {
    const user = await getCurrentUser()
    return user
  } catch (error) {
    return null
  }
}

/**
 * Get current auth session and JWT token
 */
export async function getAuthSession() {
  try {
    const session = await fetchAuthSession()
    return session
  } catch (error) {
    console.error('Get auth session error:', error)
    return null
  }
}

/**
 * Require authentication (redirect to login if not authenticated)
 */
export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    return null
  }
  return user
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle() {
  try {
    await signInWithRedirect({
      provider: 'Google',
    })
  } catch (error) {
    console.error('Google sign in error:', error)
    throw error
  }
}

/**
 * Sign in with Microsoft OAuth
 */
export async function signInWithMicrosoft() {
  try {
    await signInWithRedirect({
      provider: {
        custom: 'Microsoft',
      },
    })
  } catch (error) {
    console.error('Microsoft sign in error:', error)
    throw error
  }
}
