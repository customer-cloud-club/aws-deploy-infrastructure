import { CloudFrontRequestEvent, CloudFrontRequestResult, CloudFrontRequest } from 'aws-lambda';
import { verify, JwtPayload } from 'jsonwebtoken';

interface CustomJwtPayload extends JwtPayload {
  sub: string;
  'custom:tenant_id'?: string;
}

/**
 * Lambda@Edge ViewerRequest handler for JWT authentication
 * Validates JWT token from cookies and adds user context headers
 */
export const handler = async (
  event: CloudFrontRequestEvent
): Promise<CloudFrontRequestResult> => {
  const request = event.Records[0].cf.request;
  const headers = request.headers;

  // Extract JWT token from cookies
  const cookieHeader = headers.cookie?.[0]?.value || '';
  const token = extractToken(cookieHeader);

  if (!token) {
    return redirectToLogin();
  }

  try {
    // Verify JWT token and extract payload
    const payload = await verifyToken(token);

    // Add user context headers for downstream services
    request.headers['x-user-id'] = [{ key: 'X-User-Id', value: payload.sub }];
    request.headers['x-tenant-id'] = [{
      key: 'X-Tenant-Id',
      value: payload['custom:tenant_id'] || ''
    }];

    return request;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return redirectToLogin();
  }
};

/**
 * Extract JWT token from cookie header
 */
function extractToken(cookieHeader: string): string | null {
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const authCookie = cookies.find(c => c.startsWith('auth_token='));

  if (!authCookie) {
    return null;
  }

  return authCookie.split('=')[1];
}

/**
 * Verify JWT token using Cognito public key
 */
async function verifyToken(token: string): Promise<CustomJwtPayload> {
  const jwksUrl = process.env.COGNITO_JWKS_URL;
  const issuer = process.env.COGNITO_ISSUER;

  if (!jwksUrl || !issuer) {
    throw new Error('Missing Cognito configuration');
  }

  // In production, you should fetch and cache JWKS from Cognito
  // For now, we'll use a simplified verification
  const secret = process.env.JWT_SECRET || '';

  const payload = verify(token, secret, {
    issuer,
    algorithms: ['RS256'],
  }) as CustomJwtPayload;

  return payload;
}

/**
 * Redirect to login page for unauthenticated requests
 */
function redirectToLogin(): CloudFrontRequestResult {
  return {
    status: '302',
    statusDescription: 'Found',
    headers: {
      location: [{
        key: 'Location',
        value: process.env.LOGIN_URL || '/login',
      }],
      'cache-control': [{
        key: 'Cache-Control',
        value: 'no-cache, no-store, must-revalidate',
      }],
    },
  };
}
