import { NextRequest, NextResponse } from 'next/server';

/**
 * OAuth Callback Handler
 *
 * This route handles the OAuth callback from Cognito.
 * In a production app, you would:
 * 1. Exchange the authorization code for tokens
 * 2. Store tokens in secure cookies or pass to client
 * 3. Redirect to the appropriate page
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // Contains the redirect URL
  const error = searchParams.get('error');

  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url));
  }

  try {
    // In production, exchange code for tokens here
    // const tokens = await exchangeCodeForTokens(code);

    // For demo, we'll redirect to a client-side page that handles the callback
    const redirectUrl = state ? decodeURIComponent(state) : '/dashboard';

    // Create response with redirect
    const response = NextResponse.redirect(
      new URL(`/auth/callback?code=${code}&redirect=${encodeURIComponent(redirectUrl)}`, request.url)
    );

    return response;
  } catch (err) {
    console.error('Token exchange error:', err);
    return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url));
  }
}
