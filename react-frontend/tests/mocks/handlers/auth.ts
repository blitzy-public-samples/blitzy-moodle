/**
 * MSW Request Handlers for Authentication API Endpoints
 * 
 * This file provides Mock Service Worker (MSW) handlers for authentication-related
 * API endpoints, enabling isolated frontend testing without backend dependencies.
 * 
 * Handlers include:
 * - POST /api/v1/auth/login - User authentication with JWT token generation
 * - POST /api/v1/auth/logout - Token invalidation and session termination
 * - POST /api/v1/auth/refresh - Access token refresh using refresh token
 * - GET /api/v1/auth/me - Current authenticated user retrieval
 * 
 * All handlers return responses matching the standard Moodle API format:
 * - Success: { success: true, data: {...}, meta: {...} }
 * - Error: { success: false, error: { code: string, message: string, details: {...} } }
 * 
 * @package    react-frontend
 * @subpackage tests/mocks/handlers
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { http, HttpResponse } from 'msw';

// ============================================================================
// Token Blacklist for Logout Simulation
// ============================================================================

/**
 * Set of blacklisted JWT tokens
 * 
 * When a user logs out, their tokens (both access and refresh) are added to this
 * blacklist. Subsequent requests using these tokens will be rejected with 401 status.
 * 
 * This simulates the server-side token blacklist that would exist in production
 * (typically implemented with Redis or a similar cache).
 * 
 * NOTE: This is an in-memory store that persists across test runs within the same
 * process. For isolated tests, use MSW's resetHandlers() or clear the blacklist
 * manually in test setup/teardown.
 */
const tokenBlacklist = new Set<string>();

/**
 * Map of user IDs to their active token pairs (access + refresh)
 * 
 * This allows us to blacklist both access and refresh tokens when a user logs out,
 * simulating the server-side session management that would exist in production.
 */
const userTokens = new Map<number, { accessToken: string; refreshToken: string }>();

/**
 * Clear all blacklisted tokens and user token mappings
 * 
 * This function is exported for test setup/teardown to ensure clean state
 * between test suites.
 */
export function clearTokenBlacklist(): void {
  tokenBlacklist.clear();
  userTokens.clear();
}

/**
 * Check if a token is blacklisted
 * 
 * @param token - JWT token to check
 * @returns true if token is blacklisted, false otherwise
 */
export function isTokenBlacklisted(token: string): boolean {
  return tokenBlacklist.has(token);
}

/**
 * Add a token to the blacklist
 * 
 * @param token - JWT token to blacklist
 */
function blacklistToken(token: string): void {
  tokenBlacklist.add(token);
}

/**
 * Validation result for token authentication
 */
export interface TokenValidationResult {
  valid: boolean;
  userId?: number;
  token?: string;
  error?: {
    code: string;
    message: string;
    status: number;
  };
}

/**
 * Validate authentication token from request header
 * 
 * This function performs comprehensive token validation including:
 * - Checking for Authorization header presence
 * - Extracting Bearer token
 * - Verifying token is not blacklisted
 * - Extracting user ID from token
 * 
 * @param request - The HTTP request object
 * @returns Validation result with userId if valid, or error details if invalid
 * 
 * @example
 * ```typescript
 * const validation = validateAuthToken(request);
 * if (!validation.valid) {
 *   return HttpResponse.json(
 *     { success: false, error: validation.error },
 *     { status: validation.error.status }
 *   );
 * }
 * const userId = validation.userId!;
 * ```
 */
export function validateAuthToken(request: Request): TokenValidationResult {
  // Check for Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return {
      valid: false,
      error: {
        code: 'MISSING_AUTH_HEADER',
        message: 'Authorization header is required',
        status: 401,
      },
    };
  }

  // Check Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    return {
      valid: false,
      error: {
        code: 'INVALID_AUTH_FORMAT',
        message: 'Authorization header must use Bearer token format',
        status: 401,
      },
    };
  }

  // Extract token
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  if (!token) {
    return {
      valid: false,
      error: {
        code: 'MISSING_TOKEN',
        message: 'Bearer token is missing',
        status: 401,
      },
    };
  }

  // Check if token is blacklisted (user has logged out)
  console.log('[MSW VALIDATE] Checking token:', token);
  console.log('[MSW VALIDATE] Blacklist size:', tokenBlacklist.size);
  console.log('[MSW VALIDATE] Blacklist contains:', Array.from(tokenBlacklist));
  const isBlacklisted = isTokenBlacklisted(token);
  console.log('[MSW VALIDATE] Token is blacklisted:', isBlacklisted);
  
  if (isBlacklisted) {
    console.log('[MSW VALIDATE] Rejecting blacklisted token with 401');
    return {
      valid: false,
      error: {
        code: 'TOKEN_REVOKED',
        message: 'This token has been revoked. Please log in again.',
        status: 401,
      },
    };
  }

  // Extract user ID from token
  const userId = extractUserIdFromToken(token);
  if (userId === null) {
    return {
      valid: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token is malformed or invalid',
        status: 401,
      },
    };
  }

  // Token is valid
  return {
    valid: true,
    userId,
    token,
  };
}

// ============================================================================
// TypeScript Type Definitions
// ============================================================================

/**
 * User role types in Moodle system
 */
type UserRole = 'student' | 'teacher' | 'editingteacher' | 'manager' | 'admin' | 'guest';

/**
 * User data structure returned by authentication endpoints
 */
interface User {
  id: number;
  username: string;
  email: string;
  firstname: string;
  lastname: string;
  fullname: string;
  roles: UserRole[];
  preferences?: {
    theme?: string;
    lang?: string;
    timezone?: string;
  };
  capabilities?: string[];
  enrolledCoursesCount?: number;
  profileimageurl?: string;
}

/**
 * JWT tokens returned on successful authentication
 */
interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

/**
 * Login request payload
 */
interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Token refresh request payload
 */
interface RefreshRequest {
  refreshToken: string;
}

// ============================================================================
// Mock User Data
// ============================================================================

/**
 * Mock test users with different roles for comprehensive testing scenarios
 * NOTE: Passwords must match TEST_PASSWORD from tests/e2e/fixtures/users.ts
 */
const MOCK_USERS: Record<string, User & { password: string; status: 'active' | 'suspended' | 'locked' }> = {
  student1: {
    id: 1001,
    username: 'student1',
    password: 'TestPassword123!',
    email: 'student1@example.com',
    firstname: 'John',
    lastname: 'Student',
    fullname: 'John Student',
    roles: ['student'],
    status: 'active',
    preferences: {
      theme: 'boost',
      lang: 'en',
      timezone: 'UTC',
    },
    capabilities: [
      'moodle/course:view',
      'mod/assign:submit',
      'mod/quiz:attempt',
      'mod/forum:createattachment',
    ],
    enrolledCoursesCount: 5,
    profileimageurl: 'https://via.placeholder.com/150',
  },
  teacher1: {
    id: 2001,
    username: 'teacher1',
    password: 'TestPassword123!',
    email: 'teacher1@example.com',
    firstname: 'Jane',
    lastname: 'Teacher',
    fullname: 'Jane Teacher',
    roles: ['teacher', 'editingteacher'],
    status: 'active',
    preferences: {
      theme: 'boost',
      lang: 'en',
      timezone: 'America/New_York',
    },
    capabilities: [
      'moodle/course:view',
      'moodle/course:update',
      'mod/assign:grade',
      'mod/quiz:manage',
      'moodle/grade:viewall',
      'moodle/role:assign',
    ],
    enrolledCoursesCount: 8,
    profileimageurl: 'https://via.placeholder.com/150',
  },
  admin1: {
    id: 5001,
    username: 'admin',
    password: 'TestPassword123!',
    email: 'admin@example.com',
    firstname: 'Admin',
    lastname: 'Administrator',
    fullname: 'Admin Administrator',
    roles: ['admin', 'manager'],
    status: 'active',
    preferences: {
      theme: 'boost',
      lang: 'en',
      timezone: 'UTC',
    },
    capabilities: [
      'moodle/site:config',
      'moodle/user:create',
      'moodle/user:delete',
      'moodle/course:create',
      'moodle/course:delete',
      'moodle/role:manage',
    ],
    enrolledCoursesCount: 12,
    profileimageurl: 'https://via.placeholder.com/150',
  },
  suspended1: {
    id: 401,
    username: 'suspended1',
    password: 'TestPassword123!',
    email: 'suspended1@example.com',
    firstname: 'Suspended',
    lastname: 'User',
    fullname: 'Suspended User',
    roles: ['student'],
    status: 'suspended',
    preferences: {
      theme: 'boost',
      lang: 'en',
      timezone: 'UTC',
    },
    capabilities: [],
    enrolledCoursesCount: 0,
  },
  locked1: {
    id: 501,
    username: 'locked1',
    password: 'TestPassword123!',
    email: 'locked1@example.com',
    firstname: 'Locked',
    lastname: 'Account',
    fullname: 'Locked Account',
    roles: ['student'],
    status: 'locked',
    preferences: {
      theme: 'boost',
      lang: 'en',
      timezone: 'UTC',
    },
    capabilities: [],
    enrolledCoursesCount: 0,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a mock JWT token (not a real JWT, just for testing)
 * 
 * @param userId - User ID to encode in token
 * @param type - Token type ('access' or 'refresh')
 * @returns Mock JWT token string
 */
function generateMockToken(userId: number, type: 'access' | 'refresh'): string {
  const user = findUserById(userId);
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  const expiresIn = type === 'access' ? 3600 : 604800; // 1 hour for access, 7 days for refresh
  
  // Create JWT-compliant payload
  const payload = {
    sub: userId,
    roles: user?.roles || [],
    iat: now,
    exp: now + expiresIn,
    iss: 'http://localhost:5173',
    type,
  };
  
  // Create a simple mock JWT (header.payload.signature)
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signature = Math.random().toString(36).substring(2, 15);
  
  return `${header}.${encodedPayload}.${signature}`;
}

/**
 * Extract user ID from mock JWT token
 * 
 * @param token - JWT token string
 * @returns User ID or null if invalid
 */
export function extractUserIdFromToken(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || null; // Changed from payload.userId to payload.sub to match token generation
  } catch {
    return null;
  }
}

/**
 * Simulate network latency for realistic testing
 * 
 * @param min - Minimum delay in milliseconds (default: 100)
 * @param max - Maximum delay in milliseconds (default: 300)
 * @returns Promise that resolves after random delay
 */
async function simulateNetworkDelay(min = 100, max = 300): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Find user by username
 * 
 * @param username - Username to search for
 * @returns User object or undefined
 */
function findUserByUsername(username: string): (User & { password: string; status: 'active' | 'suspended' | 'locked' }) | undefined {
  return Object.values(MOCK_USERS).find(
    (user) => user.username.toLowerCase() === username.toLowerCase()
  );
}

/**
 * Find user by ID
 * 
 * @param userId - User ID to search for
 * @returns User object or undefined
 */
function findUserById(userId: number): (User & { password: string; status: 'active' | 'suspended' | 'locked' }) | undefined {
  return Object.values(MOCK_USERS).find((user) => user.id === userId);
}

/**
 * Strip password and status from user object for API response
 * 
 * @param user - User object with password and status
 * @returns User object without sensitive fields
 */
function sanitizeUser(user: User & { password: string; status: string }): User {
  const { password, status, ...sanitized } = user;
  return sanitized as User;
}

// ============================================================================
// MSW Request Handlers
// ============================================================================

/**
 * POST /api/v1/auth/login
 * 
 * Authenticates user with username and password, returns JWT tokens and user data.
 * 
 * Success Response (200):
 * {
 *   success: true,
 *   data: {
 *     tokens: { accessToken, refreshToken, tokenType, expiresIn },
 *     user: { id, username, email, firstname, lastname, roles, ... }
 *   }
 * }
 * 
 * Error Responses:
 * - 400: Missing username or password
 * - 401: Invalid credentials
 * - 403: Account suspended or locked
 */
const loginHandler = http.post('*/api/v1/auth/login', async ({ request }) => {
  console.log('[MSW Handler] Login handler called for:', request.url);
  await simulateNetworkDelay();

  try {
    const body = await request.json() as LoginRequest;
    const { username, password } = body;
    console.log('[MSW Handler] Login attempt for user:', username);

    // Validate required fields
    if (!username || !password) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_CREDENTIALS',
            message: 'Username and password are required',
            details: {
              missing_fields: [
                !username ? 'username' : null,
                !password ? 'password' : null,
              ].filter(Boolean),
            },
          },
        },
        { status: 400 }
      );
    }

    // Find user
    const user = findUserByUsername(username);

    // Check if user exists and password matches
    if (!user || user.password !== password) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid username or password',
            details: {
              error_code: 2, // Matches Moodle error code convention
            },
          },
        },
        { status: 401 }
      );
    }

    // Check account status
    if (user.status === 'suspended') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ACCOUNT_SUSPENDED',
            message: 'Your account has been suspended. Please contact the site administrator.',
            details: {
              username: user.username,
              email: user.email,
            },
          },
        },
        { status: 403 }
      );
    }

    if (user.status === 'locked') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'Your account has been locked due to multiple failed login attempts. Please reset your password.',
            details: {
              username: user.username,
              reset_url: '/login/forgot_password.php',
            },
          },
        },
        { status: 403 }
      );
    }

    // Generate tokens
    const tokens: AuthTokens = {
      accessToken: generateMockToken(user.id, 'access'),
      refreshToken: generateMockToken(user.id, 'refresh'),
      tokenType: 'Bearer',
      expiresIn: 3600, // 1 hour
    };

    // Store tokens for this user (for logout blacklisting)
    userTokens.set(user.id, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });

    // Return success response
    return HttpResponse.json(
      {
        success: true,
        data: {
          tokens,
          user: sanitizeUser(user),
        },
        meta: {
          timestamp: new Date().toISOString(),
          server_time: Date.now(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during login',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/v1/auth/logout
 * 
 * Invalidates JWT token and terminates user session.
 * 
 * Success Response (200):
 * {
 *   success: true,
 *   data: {
 *     message: 'Successfully logged out',
 *     redirect_url: '/'
 *   }
 * }
 * 
 * Error Responses:
 * - 401: Invalid or missing token
 */
const logoutHandler = http.post('*/api/v1/auth/logout', async ({ request }) => {
  await simulateNetworkDelay();

  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Authorization token is required',
            details: {
              header: 'Authorization',
              format: 'Bearer <token>',
            },
          },
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate token format
    const userId = extractUserIdFromToken(token);
    
    if (!userId) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or malformed token',
            details: {
              reason: 'Token could not be parsed',
            },
          },
        },
        { status: 401 }
      );
    }

    // Add access token to blacklist
    console.log('[MSW LOGOUT] Blacklisting access token:', token);
    blacklistToken(token);
    
    // Also blacklist the refresh token for this user
    const userTokenPair = userTokens.get(userId);
    if (userTokenPair && userTokenPair.refreshToken) {
      console.log('[MSW LOGOUT] Also blacklisting refresh token for user:', userId);
      blacklistToken(userTokenPair.refreshToken);
    }
    
    // Remove user's tokens from active sessions
    userTokens.delete(userId);
    
    console.log('[MSW LOGOUT] Tokens blacklisted. Blacklist size:', tokenBlacklist.size);
    console.log('[MSW LOGOUT] Blacklist contains:', Array.from(tokenBlacklist))

    return HttpResponse.json(
      {
        success: true,
        data: {
          message: 'Successfully logged out',
          redirect_url: '/',
        },
        meta: {
          timestamp: new Date().toISOString(),
          token_invalidated: true,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during logout',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/v1/auth/refresh
 * 
 * Refreshes expired access token using a valid refresh token.
 * 
 * Success Response (200):
 * {
 *   success: true,
 *   data: {
 *     accessToken: string,
 *     refreshToken: string,
 *     tokenType: 'Bearer',
 *     expiresIn: 3600
 *   }
 * }
 * 
 * Error Responses:
 * - 400: Missing refresh token
 * - 401: Invalid or expired refresh token
 */
const refreshHandler = http.post('*/api/v1/auth/refresh', async ({ request }) => {
  await simulateNetworkDelay();

  try {
    const body = await request.json() as RefreshRequest;
    const { refreshToken } = body;

    // Validate required field
    if (!refreshToken) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_REFRESH_TOKEN',
            message: 'Refresh token is required',
            details: {
              field: 'refreshToken',
            },
          },
        },
        { status: 400 }
      );
    }

    // Validate token format and extract user ID
    const userId = extractUserIdFromToken(refreshToken);
    
    if (!userId) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid or malformed refresh token',
            details: {
              reason: 'Token could not be parsed',
            },
          },
        },
        { status: 401 }
      );
    }

    // Check if refresh token is blacklisted (user has logged out)
    if (isTokenBlacklisted(refreshToken)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'TOKEN_REVOKED',
            message: 'This token has been revoked. Please log in again.',
            details: {
              reason: 'Token was invalidated during logout',
            },
          },
        },
        { status: 401 }
      );
    }

    // Check if user still exists
    const user = findUserById(userId);
    
    if (!user) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User associated with this token no longer exists',
            details: {
              user_id: userId,
            },
          },
        },
        { status: 401 }
      );
    }

    // Check if account is still active
    if (user.status !== 'active') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ACCOUNT_INACTIVE',
            message: 'Cannot refresh token for inactive account',
            details: {
              status: user.status,
            },
          },
        },
        { status: 401 }
      );
    }

    // Generate new tokens
    const tokens: AuthTokens = {
      accessToken: generateMockToken(userId, 'access'),
      refreshToken: generateMockToken(userId, 'refresh'),
      tokenType: 'Bearer',
      expiresIn: 3600, // 1 hour
    };

    // Store new tokens for this user (for logout blacklisting)
    userTokens.set(userId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });

    return HttpResponse.json(
      {
        success: true,
        data: tokens,
        meta: {
          timestamp: new Date().toISOString(),
          refreshed_at: Date.now(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during token refresh',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/v1/auth/me
 * 
 * Retrieves current authenticated user information from JWT token.
 * 
 * Success Response (200):
 * {
 *   success: true,
 *   data: {
 *     id, username, email, firstname, lastname, roles, preferences, capabilities, ...
 *   }
 * }
 * 
 * Error Responses:
 * - 401: Unauthenticated (missing or invalid token)
 */
const meHandler = http.get('*/api/v1/auth/me', async ({ request }) => {
  await simulateNetworkDelay();

  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    
    // Debug logging
    console.log('[meHandler] Called with URL:', request.url);
    console.log('[meHandler] Authorization header:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required. Please provide a valid token.',
            details: {
              header: 'Authorization',
              format: 'Bearer <token>',
            },
          },
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    console.log('[meHandler] Token extracted:', token);
    console.log('[meHandler] Blacklist size:', tokenBlacklist.size);
    console.log('[meHandler] Blacklist contents:', Array.from(tokenBlacklist));

    // Validate token and extract user ID
    const userId = extractUserIdFromToken(token);
    
    if (!userId) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or malformed authentication token',
            details: {
              reason: 'Token could not be parsed',
            },
          },
        },
        { status: 401 }
      );
    }

    // Check if token is blacklisted (user has logged out)
    console.log('[meHandler] Checking if token is blacklisted:', token);
    console.log('[meHandler] Is blacklisted?', isTokenBlacklisted(token));
    if (isTokenBlacklisted(token)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'TOKEN_REVOKED',
            message: 'This token has been revoked. Please log in again.',
            details: {
              reason: 'Token was invalidated during logout',
            },
          },
        },
        { status: 401 }
      );
    }

    // Find user by ID
    const user = findUserById(userId);
    
    if (!user) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User associated with this token not found',
            details: {
              user_id: userId,
              reason: 'User may have been deleted',
            },
          },
        },
        { status: 401 }
      );
    }

    // Check account status
    if (user.status !== 'active') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ACCOUNT_INACTIVE',
            message: 'Account is not active',
            details: {
              status: user.status,
              username: user.username,
            },
          },
        },
        { status: 401 }
      );
    }

    // Return user data
    return HttpResponse.json(
      {
        success: true,
        data: sanitizeUser(user),
        meta: {
          timestamp: new Date().toISOString(),
          authenticated: true,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while retrieving user information',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/v1/auth/password-policy
 * 
 * Returns the password policy configuration for the Moodle instance.
 * 
 * Success Response (200):
 * {
 *   success: true,
 *   data: {
 *     minLength: 8,
 *     minDigits: 1,
 *     minLower: 1,
 *     minUpper: 1,
 *     minNonAlphanumeric: 1,
 *     reuseLimit: 3,
 *     maxLength: 128
 *   }
 * }
 */
const passwordPolicyHandler = http.get('*/api/v1/auth/password-policy', async () => {
  await simulateNetworkDelay(50, 150); // Faster for policy retrieval

  return HttpResponse.json(
    {
      success: true,
      data: {
        minLength: 8,
        minDigits: 1,
        minLower: 1,
        minUpper: 1,
        minNonAlphanumeric: 1,
        reuseLimit: 3,
        maxLength: 128,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status: 200 }
  );
});

/**
 * POST /api/v1/auth/password-reset/set
 * 
 * Sets a new password using a password reset token.
 * 
 * Success Response (200):
 * {
 *   success: true,
 *   data: {
 *     message: 'Password has been set successfully',
 *     redirectUrl: '/login'
 *   }
 * }
 * 
 * Error Responses:
 * - 400: Missing required fields or invalid password
 * - 401: Invalid or expired token
 * - 403: Password reuse policy violation
 * - 429: Rate limit exceeded
 */
const passwordResetSetHandler = http.post('*/api/v1/auth/password-reset/set', async ({ request }) => {
  await simulateNetworkDelay();

  try {
    const body = await request.json() as {
      token?: string;
      password?: string;
      logoutOtherSessions?: boolean;
    };

    const { token, password, logoutOtherSessions } = body;

    // Validate required fields
    if (!token || !password) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Token and password are required',
            details: {
              missing_fields: [
                !token ? 'token' : null,
                !password ? 'password' : null,
              ].filter(Boolean),
            },
          },
        },
        { status: 400 }
      );
    }

    // Mock token validation - check for specific test tokens
    if (token === 'invalid-token') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'The password reset token is invalid',
            details: {
              token_status: 'invalid',
            },
          },
        },
        { status: 401 }
      );
    }

    if (token === 'expired-token') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'The password reset token has expired',
            details: {
              token_status: 'expired',
              expiry_time: new Date(Date.now() - 3600000).toISOString(),
            },
          },
        },
        { status: 401 }
      );
    }

    // Mock password validation against policy
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: 'Password does not meet policy requirements',
            details: {
              policy: {
                minLength: 8,
                minDigits: 1,
                minLower: 1,
                minUpper: 1,
                minNonAlphanumeric: 1,
              },
            },
          },
        },
        { status: 400 }
      );
    }

    // Mock password reuse check - reject specific test password
    if (password === 'UsedPassword1!') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PASSWORD_REUSED',
            message: 'This password has been used recently. Please choose a different password.',
            details: {
              reuseLimit: 3,
            },
          },
        },
        { status: 403 }
      );
    }

    // Success response
    return HttpResponse.json(
      {
        success: true,
        data: {
          message: 'Password has been successfully updated! Redirecting...',
          redirectUrl: '/login',
          sessionsRevoked: logoutOtherSessions === true,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while setting password',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      },
      { status: 500 }
    );
  }
});

// ============================================================================
// Exported Handlers
// ============================================================================

/**
 * Array of MSW request handlers for authentication endpoints
 * 
 * These handlers can be used with MSW's setupWorker() or setupServer()
 * to mock authentication API calls in tests and development.
 * 
 * @example
 * ```typescript
 * import { setupServer } from 'msw/node';
 * import { authHandlers } from './mocks/handlers/auth';
 * 
 * const server = setupServer(...authHandlers);
 * 
 * beforeAll(() => server.listen());
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 */
export const authHandlers = [
  loginHandler,
  logoutHandler,
  refreshHandler,
  meHandler,
  passwordPolicyHandler,
  passwordResetSetHandler,
];
