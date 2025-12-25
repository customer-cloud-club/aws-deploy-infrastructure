/**
 * User Management API
 * Manages users via AWS Cognito
 *
 * GET /admin/users - List all users
 * GET /admin/users/{id} - Get user details
 * POST /admin/users - Create new user
 * PUT /admin/users/{id} - Update user
 * DELETE /admin/users/{id} - Disable user
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminDeleteUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminListGroupsForUserCommand,
  AdminSetUserPasswordCommand,
  AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';
import { query } from '../../shared/db/index.js';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

interface UserProduct {
  id: string;
  name: string;
  lastLoginAt: string;
}

interface UserResponse {
  id: string;
  sub: string;  // Cognito sub (UUID) for database lookups
  name: string;
  email: string;
  role: 'admin' | 'superAdmin' | 'user';
  status: 'active' | 'inactive';
  lastLogin: string;
  createdAt: string;
  emailVerified: boolean;
  products?: UserProduct[];
}

interface CreateUserRequest {
  email: string;
  name: string;
  role?: 'admin' | 'user';
  temporaryPassword?: string;
}

interface UpdateUserRequest {
  name?: string;
  role?: 'admin' | 'user';
  status?: 'active' | 'inactive';
}

interface UserProductLogin {
  product_id: string;
  product_name: string;
  first_login_at: string;
  last_login_at: string;
  login_count: number;
}

/**
 * Get products for multiple users (batch)
 */
async function getUsersProducts(userIds: string[]): Promise<Map<string, UserProduct[]>> {
  const result = new Map<string, UserProduct[]>();

  if (userIds.length === 0) {
    return result;
  }

  try {
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
    const queryResult = await query<{
      user_id: string;
      product_id: string;
      product_name: string;
      last_login_at: Date;
    }>(
      `SELECT
        upl.user_id,
        upl.product_id::text as product_id,
        COALESCE(p.name, upl.product_id::text) as product_name,
        upl.last_login_at
       FROM user_product_logins upl
       LEFT JOIN products p ON upl.product_id = p.id
       WHERE upl.user_id IN (${placeholders})
       ORDER BY upl.last_login_at DESC`,
      userIds
    );

    for (const row of queryResult.rows) {
      const products = result.get(row.user_id) || [];
      products.push({
        id: row.product_id,
        name: row.product_name || row.product_id,
        lastLoginAt: row.last_login_at?.toISOString() || '',
      });
      result.set(row.user_id, products);
    }
  } catch (error) {
    console.warn('[Users] Failed to get users products:', error);
  }

  return result;
}

/**
 * Extract attribute value from Cognito attributes
 */
function getAttribute(attributes: AttributeType[] | undefined, name: string): string {
  return attributes?.find(attr => attr.Name === name)?.Value || '';
}

/**
 * Determine user role from Cognito groups
 */
async function getUserRole(username: string): Promise<'admin' | 'superAdmin' | 'user'> {
  try {
    const response = await cognitoClient.send(new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    }));

    const groups = response.Groups?.map(g => g.GroupName) || [];

    if (groups.includes('super-admin')) return 'superAdmin';
    if (groups.includes('admin')) return 'admin';
    return 'user';
  } catch (error) {
    console.warn(`[Users] Failed to get groups for user ${username}:`, error);
    return 'user';
  }
}

/**
 * Convert Cognito user to API response
 */
async function toUserResponse(cognitoUser: {
  Username?: string;
  Attributes?: AttributeType[];
  UserStatus?: string;
  Enabled?: boolean;
  UserCreateDate?: Date;
  UserLastModifiedDate?: Date;
}): Promise<UserResponse> {
  const username = cognitoUser.Username || '';
  const role = await getUserRole(username);

  return {
    id: username,
    sub: getAttribute(cognitoUser.Attributes, 'sub'),  // Cognito sub (UUID)
    name: getAttribute(cognitoUser.Attributes, 'name') || getAttribute(cognitoUser.Attributes, 'email')?.split('@')[0] || username,
    email: getAttribute(cognitoUser.Attributes, 'email'),
    role,
    status: cognitoUser.Enabled !== false ? 'active' : 'inactive',
    lastLogin: cognitoUser.UserLastModifiedDate?.toISOString() || '',
    createdAt: cognitoUser.UserCreateDate?.toISOString() || '',
    emailVerified: getAttribute(cognitoUser.Attributes, 'email_verified') === 'true',
  };
}

/**
 * List all users
 * GET /admin/users
 */
export async function listUsers(queryParams: Record<string, string | undefined> | null): Promise<APIGatewayProxyResult> {
  try {
    const limit = Math.min(60, parseInt(queryParams?.['limit'] || '20'));
    const paginationToken = queryParams?.['next_token'];
    const includeProducts = queryParams?.['include_products'] !== 'false';

    const response = await cognitoClient.send(new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: limit,
      PaginationToken: paginationToken || undefined,
    }));

    const users = await Promise.all(
      (response.Users || []).map(user => toUserResponse(user))
    );

    // Fetch products for all users if requested
    // Use Cognito sub (UUID) for database lookup, as user_product_logins stores sub
    if (includeProducts && users.length > 0) {
      const userSubs = users.map(u => u.sub).filter(sub => sub);  // Filter out empty subs
      const usersProducts = await getUsersProducts(userSubs);

      for (const user of users) {
        user.products = usersProducts.get(user.sub) || [];
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        users,
        total: users.length,
        nextToken: response.PaginationToken || null,
      }),
    };
  } catch (error) {
    console.error('[Users] Error listing users:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to list users' }),
    };
  }
}

/**
 * Get user by ID
 * GET /admin/users/{id}
 */
export async function getUser(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const response = await cognitoClient.send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: userId,
    }));

    const user = await toUserResponse({
      Username: response.Username,
      Attributes: response.UserAttributes,
      UserStatus: response.UserStatus,
      Enabled: response.Enabled,
      UserCreateDate: response.UserCreateDate,
      UserLastModifiedDate: response.UserLastModifiedDate,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(user),
    };
  } catch (error: any) {
    if (error.name === 'UserNotFoundException') {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }
    console.error('[Users] Error getting user:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get user' }),
    };
  }
}

/**
 * Create new user
 * POST /admin/users
 */
export async function createUser(body: string): Promise<APIGatewayProxyResult> {
  try {
    const request: CreateUserRequest = JSON.parse(body);

    if (!request.email) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Email is required' }),
      };
    }

    // Create user in Cognito
    const createResponse = await cognitoClient.send(new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: request.email,
      UserAttributes: [
        { Name: 'email', Value: request.email },
        { Name: 'email_verified', Value: 'true' },
        ...(request.name ? [{ Name: 'name', Value: request.name }] : []),
      ],
      TemporaryPassword: request.temporaryPassword,
      MessageAction: request.temporaryPassword ? 'SUPPRESS' : undefined,
    }));

    // Add to group if role specified
    if (request.role === 'admin') {
      await cognitoClient.send(new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: request.email,
        GroupName: 'admin',
      }));
    }

    const user = await toUserResponse({
      Username: createResponse.User?.Username,
      Attributes: createResponse.User?.Attributes,
      UserStatus: createResponse.User?.UserStatus,
      Enabled: createResponse.User?.Enabled,
      UserCreateDate: createResponse.User?.UserCreateDate,
      UserLastModifiedDate: createResponse.User?.UserLastModifiedDate,
    });

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify(user),
    };
  } catch (error: any) {
    if (error.name === 'UsernameExistsException') {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User with this email already exists' }),
      };
    }
    console.error('[Users] Error creating user:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to create user' }),
    };
  }
}

/**
 * Update user
 * PUT /admin/users/{id}
 */
export async function updateUser(userId: string, body: string): Promise<APIGatewayProxyResult> {
  try {
    const request: UpdateUserRequest = JSON.parse(body);

    // Update attributes if name provided
    if (request.name) {
      await cognitoClient.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: userId,
        UserAttributes: [
          { Name: 'name', Value: request.name },
        ],
      }));
    }

    // Update status if provided
    if (request.status === 'inactive') {
      await cognitoClient.send(new AdminDisableUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: userId,
      }));
    } else if (request.status === 'active') {
      await cognitoClient.send(new AdminEnableUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: userId,
      }));
    }

    // Update role if provided
    if (request.role) {
      const currentRole = await getUserRole(userId);

      // Remove from current group if different
      if (currentRole === 'admin' && request.role !== 'admin') {
        await cognitoClient.send(new AdminRemoveUserFromGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: userId,
          GroupName: 'admin',
        }));
      }

      // Add to new group
      if (request.role === 'admin' && currentRole !== 'admin' && currentRole !== 'superAdmin') {
        await cognitoClient.send(new AdminAddUserToGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: userId,
          GroupName: 'admin',
        }));
      }
    }

    // Get updated user
    return getUser(userId);
  } catch (error: any) {
    if (error.name === 'UserNotFoundException') {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }
    console.error('[Users] Error updating user:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update user' }),
    };
  }
}

/**
 * Delete user permanently from Cognito
 * DELETE /admin/users/{id}
 */
export async function deleteUser(userId: string): Promise<APIGatewayProxyResult> {
  try {
    await cognitoClient.send(new AdminDeleteUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: userId,
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, message: 'User deleted successfully' }),
    };
  } catch (error: any) {
    if (error.name === 'UserNotFoundException') {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }
    console.error('[Users] Error deleting user:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to delete user' }),
    };
  }
}

/**
 * Get user's product login history
 * GET /admin/users/{id}/logins
 */
export async function getUserLogins(userId: string): Promise<APIGatewayProxyResult> {
  try {
    // Get user's sub (UUID) from Cognito - user_product_logins stores sub, not username
    let userSub = userId;
    try {
      const cognitoUser = await cognitoClient.send(new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: userId,
      }));
      userSub = getAttribute(cognitoUser.UserAttributes, 'sub') || userId;
    } catch (error) {
      console.warn('[Users] Could not get user sub, using userId as-is:', error);
    }

    const result = await query<{
      product_id: string;
      product_name: string;
      first_login_at: Date;
      last_login_at: Date;
      login_count: number;
    }>(
      `SELECT
        upl.product_id,
        COALESCE(p.name, upl.product_id::text) as product_name,
        upl.first_login_at,
        upl.last_login_at,
        upl.login_count
       FROM user_product_logins upl
       LEFT JOIN products p ON upl.product_id = p.id
       WHERE upl.user_id = $1
       ORDER BY upl.last_login_at DESC`,
      [userSub]
    );

    const logins: UserProductLogin[] = result.rows.map(row => ({
      product_id: row.product_id,
      product_name: row.product_name || 'Unknown',
      first_login_at: row.first_login_at?.toISOString() || '',
      last_login_at: row.last_login_at?.toISOString() || '',
      login_count: row.login_count || 0,
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        user_id: userId,
        logins,
        total: logins.length,
      }),
    };
  } catch (error) {
    console.error('[Users] Error getting user logins:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get user logins' }),
    };
  }
}

/**
 * Set user password
 * POST /admin/users/{id}/password
 */
export async function setUserPassword(userId: string, body: string): Promise<APIGatewayProxyResult> {
  try {
    const { password, permanent = true } = JSON.parse(body);

    if (!password) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Password is required' }),
      };
    }

    if (password.length < 8) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Password must be at least 8 characters' }),
      };
    }

    await cognitoClient.send(new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: userId,
      Password: password,
      Permanent: permanent,
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, message: 'Password updated successfully' }),
    };
  } catch (error: any) {
    if (error.name === 'UserNotFoundException') {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }
    if (error.name === 'InvalidPasswordException') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Password does not meet requirements. Must include uppercase, lowercase, number, and special character.' }),
      };
    }
    console.error('[Users] Error setting user password:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to set user password' }),
    };
  }
}
