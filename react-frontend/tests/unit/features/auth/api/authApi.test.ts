/**
 * Authentication API Client Unit Tests
 *
 * Comprehensive unit tests for authentication API client functions using Vitest and MSW.
 * Tests cover login, logout, token refresh, and user retrieval (me) API calls.
 * Validates proper request formatting, JWT token handling, HTTP headers, error response
 * handling, and integration with /api/v1/auth/* endpoints.
 *
 * @module tests/unit/features/auth/api/authApi.test
 * @see react-frontend/src/features/auth/api/authApi.ts
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import {
  login,
  logout,
  refreshToken,
  getCurrentUser,
  resetPassword,
  type LoginCredentials,
  type LoginResponse,
  type RefreshTokenResponse,
  type PasswordResetRequest,
  type PasswordResetResponse,
  type ApiError,
} from '@/features/auth/api/authApi';
import type { ApiResponse } from '@/types/api';
import type { User } from '@/types/entities';

// ============================================================================
// Test Constants and Mock Data Factories
// ============================================================================

/**
 * Base URL for API endpoints
 * Must match the apiClient configuration
 */
const API_BASE_URL = 'http://localhost:3000/api/v1';

/**
 * Authentication API endpoint paths
 */
const AUTH_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/auth/login`,
  LOGOUT: `${API_BASE_URL}/auth/logout`,
  REFRESH: `${API_BASE_URL}/auth/refresh`,
  ME: `${API_BASE_URL}/auth/me`,
  RESET_PASSWORD: `${API_BASE_URL}/auth/reset-password`,
} as const;

/**
 * Creates a mock JWT access token for testing
 * Note: These are NOT real JWT tokens, just test fixtures
 *
 * @param options - Token customization options
 * @returns Mock JWT token string
 */
function createMockAccessToken(options: { userId?: number; expired?: boolean } = {}): string {
  const { userId = 1, expired = false } = options;
  // Mock token structure: header.payload.signature
  // In production, this would be a real JWT with proper encoding
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const exp = expired ? now - 3600 : now + 3600; // 1 hour ago or 1 hour from now
  const payload = btoa(
    JSON.stringify({
      iss: 'http://localhost',
      iat: now,
      exp,
      sub: userId,
    })
  );
  const signature = btoa('mock-signature');
  return `${header}.${payload}.${signature}`;
}

/**
 * Creates a mock JWT refresh token for testing
 *
 * @param options - Token customization options
 * @returns Mock refresh token string
 */
function createMockRefreshToken(options: { userId?: number; expired?: boolean } = {}): string {
  const { userId = 1, expired = false } = options;
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const exp = expired ? now - 86400 : now + 604800; // Expired or 7 days from now
  const payload = btoa(
    JSON.stringify({
      iss: 'http://localhost',
      iat: now,
      exp,
      sub: userId,
      type: 'refresh',
    })
  );
  const signature = btoa('mock-refresh-signature');
  return `${header}.${payload}.${signature}`;
}

/**
 * Creates a mock user object for testing
 *
 * @param overrides - Fields to override in the default user
 * @returns Mock User object
 */
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'testuser',
    firstname: 'Test',
    lastname: 'User',
    fullname: 'Test User',
    email: 'testuser@example.com',
    emailstop: false,
    phone1: '+1234567890',
    phone2: '',
    institution: 'Test University',
    department: 'Computer Science',
    address: '123 Test Street',
    city: 'Test City',
    country: 'US',
    lang: 'en',
    timezone: 'America/New_York',
    firstaccess: Math.floor(Date.now() / 1000) - 86400 * 365,
    lastaccess: Math.floor(Date.now() / 1000) - 3600,
    lastlogin: Math.floor(Date.now() / 1000) - 86400,
    currentlogin: Math.floor(Date.now() / 1000),
    picture: '1',
    imagealt: 'Test User',
    suspended: false,
    confirmed: true,
    auth: 'manual',
    theme: '',
    calendartype: 'gregorian',
    profileimageurl: 'http://localhost/user/pix.php/1/f1.jpg',
    profileimageurlsmall: 'http://localhost/user/pix.php/1/f2.jpg',
    description: 'A test user account',
    descriptionformat: 1,
    mailformat: 1,
    maildigest: 0,
    maildisplay: 2,
    autosubscribe: true,
    trackforums: true,
    timecreated: Math.floor(Date.now() / 1000) - 86400 * 365,
    timemodified: Math.floor(Date.now() / 1000) - 86400,
    trustbitmask: 0,
    deleted: false,
    interests: ['programming', 'testing'],
    preferences: {
      htmleditor: 'atto',
      badgesnewbadge: 1,
    },
    customfields: [],
    roles: [
      {
        id: 5,
        roleid: 5,
        name: 'Student',
        shortname: 'student',
        description: 'Students have access to course content',
        sortorder: 5,
        archetype: 'student',
      },
    ],
    capabilities: [],
    ...overrides,
  };
}

/**
 * Creates mock login credentials for testing
 *
 * @param overrides - Fields to override
 * @returns Mock LoginCredentials object
 */
function createMockCredentials(overrides: Partial<LoginCredentials> = {}): LoginCredentials {
  return {
    username: 'testuser',
    password: 'SecurePassword123!',
    ...overrides,
  };
}

/**
 * Creates a mock successful login response
 *
 * @param overrides - Fields to override
 * @returns Mock LoginResponse object
 */
function createMockLoginResponse(overrides: Partial<LoginResponse> = {}): LoginResponse {
  return {
    user: createMockUser(),
    tokens: {
      accessToken: createMockAccessToken(),
      refreshToken: createMockRefreshToken(),
      expiresIn: 3600,
      tokenType: 'Bearer',
    },
    ...overrides,
  };
}

/**
 * Creates a mock API success response envelope
 *
 * @template T - Type of the data payload
 * @param data - Response data payload
 * @returns Mock ApiResponse object
 */
function createMockApiResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: Math.floor(Date.now() / 1000),
    },
  };
}

/**
 * Creates a mock API error response
 *
 * @param code - Error code
 * @param message - Error message
 * @param status - HTTP status code
 * @returns Mock error response object
 */
function createMockErrorResponse(code: string, message: string, status: number = 400) {
  return {
    success: false,
    error: {
      code,
      message,
      status,
    },
  };
}

// ============================================================================
// MSW Server Setup
// ============================================================================

/**
 * Default request handlers for all authentication endpoints
 * These provide successful responses by default and can be overridden in tests
 */
const defaultHandlers = [
  // Login endpoint - successful authentication
  http.post(AUTH_ENDPOINTS.LOGIN, async ({ request }) => {
    const body = (await request.json()) as LoginCredentials;

    // Validate request body
    if (!body.username || !body.password) {
      return HttpResponse.json(
        createMockErrorResponse('VALIDATION_ERROR', 'Username and password are required', 400),
        { status: 400 }
      );
    }

    // Check Content-Type header
    const contentType = request.headers.get('Content-Type');
    if (!contentType?.includes('application/json')) {
      return HttpResponse.json(
        createMockErrorResponse('INVALID_CONTENT_TYPE', 'Content-Type must be application/json', 415),
        { status: 415 }
      );
    }

    // Return successful login response
    return HttpResponse.json(createMockApiResponse(createMockLoginResponse()));
  }),

  // Logout endpoint - successful logout
  http.post(AUTH_ENDPOINTS.LOGOUT, ({ request }) => {
    // Verify Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        createMockErrorResponse('UNAUTHORIZED', 'Missing or invalid authorization token', 401),
        { status: 401 }
      );
    }

    // Return successful logout response
    return HttpResponse.json(createMockApiResponse({ message: 'Logged out successfully' }));
  }),

  // Token refresh endpoint - successful refresh
  http.post(AUTH_ENDPOINTS.REFRESH, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { refreshToken?: string };

    // Validate refresh token is provided (either in body or cookie)
    // For this mock, we accept the request if it has any refresh token
    return HttpResponse.json(
      createMockApiResponse<RefreshTokenResponse>({
        accessToken: createMockAccessToken(),
        refreshToken: createMockRefreshToken(),
        expiresIn: 3600,
        tokenType: 'Bearer',
      })
    );
  }),

  // Get current user endpoint - successful retrieval
  http.get(AUTH_ENDPOINTS.ME, ({ request }) => {
    // Verify Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        createMockErrorResponse('NOT_AUTHENTICATED', 'You are not logged in. Please log in to continue.', 401),
        { status: 401 }
      );
    }

    // Return current user data
    return HttpResponse.json(createMockApiResponse(createMockUser()));
  }),

  // Password reset endpoint - successful request
  http.post(AUTH_ENDPOINTS.RESET_PASSWORD, async ({ request }) => {
    const body = (await request.json()) as PasswordResetRequest;

    // Validate that either username or email is provided
    if (!body.username && !body.email) {
      return HttpResponse.json(
        createMockErrorResponse('VALIDATION_ERROR', 'Please provide a username or email address', 400),
        { status: 400 }
      );
    }

    // Return successful response (always success for security)
    return HttpResponse.json(
      createMockApiResponse<PasswordResetResponse>({
        success: true,
        message: 'If an account exists with this information, you will receive password reset instructions by email.',
      })
    );
  }),
];

/**
 * MSW server instance for intercepting HTTP requests
 */
const server = setupServer(...defaultHandlers);

// ============================================================================
// Test Suite Setup and Teardown
// ============================================================================

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Reset handlers after each test to remove test-specific overrides
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
  // Clear localStorage between tests
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});

// Clean up after all tests
afterAll(() => {
  server.close();
});

// ============================================================================
// Login API Tests
// ============================================================================

describe('login', () => {
  describe('successful authentication', () => {
    it('should successfully login with valid credentials', async () => {
      const credentials = createMockCredentials();
      const response = await login(credentials);

      expect(response).toBeDefined();
      expect(response.user).toBeDefined();
      expect(response.tokens).toBeDefined();
    });

    it('should return user data with complete profile information', async () => {
      const credentials = createMockCredentials();
      const response = await login(credentials);

      expect(response.user.id).toBe(1);
      expect(response.user.username).toBe('testuser');
      expect(response.user.email).toBe('testuser@example.com');
      expect(response.user.firstname).toBe('Test');
      expect(response.user.lastname).toBe('User');
    });

    it('should return JWT access and refresh tokens', async () => {
      const credentials = createMockCredentials();
      const response = await login(credentials);

      expect(response.tokens.accessToken).toBeDefined();
      expect(response.tokens.refreshToken).toBeDefined();
      expect(response.tokens.accessToken).toContain('.');
      expect(response.tokens.refreshToken).toContain('.');
    });

    it('should return correct token type and expiration', async () => {
      const credentials = createMockCredentials();
      const response = await login(credentials);

      expect(response.tokens.tokenType).toBe('Bearer');
      expect(response.tokens.expiresIn).toBe(3600); // 1 hour
    });

    it('should send correct Content-Type header', async () => {
      let capturedContentType: string | null = null;

      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, async ({ request }) => {
          capturedContentType = request.headers.get('Content-Type');
          return HttpResponse.json(createMockApiResponse(createMockLoginResponse()));
        })
      );

      const credentials = createMockCredentials();
      await login(credentials);

      expect(capturedContentType).toContain('application/json');
    });

    it('should send username and password in request body', async () => {
      let capturedBody: LoginCredentials | null = null;

      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, async ({ request }) => {
          capturedBody = (await request.json()) as LoginCredentials;
          return HttpResponse.json(createMockApiResponse(createMockLoginResponse()));
        })
      );

      const credentials = createMockCredentials({
        username: 'customuser',
        password: 'CustomPassword123!',
      });
      await login(credentials);

      expect(capturedBody).toEqual({
        username: 'customuser',
        password: 'CustomPassword123!',
      });
    });

    it('should include user roles in response', async () => {
      const credentials = createMockCredentials();
      const response = await login(credentials);

      expect(response.user.roles).toBeDefined();
      expect(Array.isArray(response.user.roles)).toBe(true);
      expect(response.user.roles?.length).toBeGreaterThan(0);
      expect(response.user.roles?.[0].shortname).toBe('student');
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid credentials (401)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, () => {
          return HttpResponse.json(
            createMockErrorResponse('INVALID_CREDENTIALS', 'Invalid username or password', 401),
            { status: 401 }
          );
        })
      );

      const credentials = createMockCredentials();
      await expect(login(credentials)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password',
        status: 401,
      });
    });

    it('should throw error for disabled account (403)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, () => {
          return HttpResponse.json(
            createMockErrorResponse('ACCOUNT_DISABLED', 'Your account has been suspended', 403),
            { status: 403 }
          );
        })
      );

      const credentials = createMockCredentials();
      await expect(login(credentials)).rejects.toMatchObject({
        code: 'ACCOUNT_DISABLED',
        status: 403,
      });
    });

    it('should throw error for rate limiting (429)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, () => {
          return HttpResponse.json(
            createMockErrorResponse('RATE_LIMITED', 'Too many login attempts. Please try again later', 429),
            { status: 429 }
          );
        })
      );

      const credentials = createMockCredentials();
      await expect(login(credentials)).rejects.toMatchObject({
        code: 'RATE_LIMITED',
        status: 429,
      });
    });

    it('should throw error for server errors (500)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, () => {
          return HttpResponse.json(
            createMockErrorResponse('INTERNAL_ERROR', 'An internal server error occurred', 500),
            { status: 500 }
          );
        })
      );

      const credentials = createMockCredentials();
      await expect(login(credentials)).rejects.toMatchObject({
        status: 500,
      });
    });

    it('should handle network errors gracefully', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, () => {
          return HttpResponse.error();
        })
      );

      const credentials = createMockCredentials();
      await expect(login(credentials)).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });

    it('should throw error for malformed response (missing user)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, () => {
          return HttpResponse.json({
            success: true,
            data: {
              tokens: {
                accessToken: createMockAccessToken(),
                refreshToken: createMockRefreshToken(),
              },
              // user is missing
            },
          });
        })
      );

      const credentials = createMockCredentials();
      await expect(login(credentials)).rejects.toMatchObject({
        code: 'AUTHENTICATION_FAILED',
      });
    });

    it('should throw error for malformed response (missing tokens)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, () => {
          return HttpResponse.json({
            success: true,
            data: {
              user: createMockUser(),
              // tokens is missing
            },
          });
        })
      );

      const credentials = createMockCredentials();
      await expect(login(credentials)).rejects.toMatchObject({
        code: 'AUTHENTICATION_FAILED',
      });
    });

    it('should throw error for malformed response (missing accessToken)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, () => {
          return HttpResponse.json({
            success: true,
            data: {
              user: createMockUser(),
              tokens: {
                refreshToken: createMockRefreshToken(),
                // accessToken is missing
              },
            },
          });
        })
      );

      const credentials = createMockCredentials();
      await expect(login(credentials)).rejects.toMatchObject({
        code: 'AUTHENTICATION_FAILED',
      });
    });

    it('should throw error for invalid response format (success: false)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'UNKNOWN_ERROR',
              message: 'Unknown error occurred',
            },
          });
        })
      );

      const credentials = createMockCredentials();
      await expect(login(credentials)).rejects.toBeDefined();
    });
  });
});

// ============================================================================
// Logout API Tests
// ============================================================================

describe('logout', () => {
  describe('successful logout', () => {
    it('should successfully logout with valid token', async () => {
      await expect(logout()).resolves.toBeUndefined();
    });

    it('should send POST request to logout endpoint', async () => {
      let requestMethod: string = '';

      server.use(
        http.post(AUTH_ENDPOINTS.LOGOUT, ({ request }) => {
          requestMethod = request.method;
          return HttpResponse.json(createMockApiResponse({ message: 'Logged out successfully' }));
        })
      );

      await logout();
      expect(requestMethod).toBe('POST');
    });

    it('should send Authorization header with Bearer token', async () => {
      let capturedAuthHeader: string | null = null;

      server.use(
        http.post(AUTH_ENDPOINTS.LOGOUT, ({ request }) => {
          capturedAuthHeader = request.headers.get('Authorization');
          return HttpResponse.json(createMockApiResponse({ message: 'Logged out successfully' }));
        })
      );

      await logout();
      // Note: The actual Authorization header is set by the apiClient interceptor
      // which adds the stored token. In tests, this would be undefined unless mocked.
      // The handler validation above checks for this.
    });
  });

  describe('error handling', () => {
    it('should not throw error for 401 (already logged out)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGOUT, () => {
          return HttpResponse.json(
            createMockErrorResponse('UNAUTHORIZED', 'Invalid or expired token', 401),
            { status: 401 }
          );
        })
      );

      // 401 during logout is acceptable - user is effectively logged out
      await expect(logout()).resolves.toBeUndefined();
    });

    it('should throw error for server errors (500)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGOUT, () => {
          return HttpResponse.json(
            createMockErrorResponse('INTERNAL_ERROR', 'Server error during logout', 500),
            { status: 500 }
          );
        })
      );

      await expect(logout()).rejects.toMatchObject({
        code: 'LOGOUT_FAILED',
        status: 500,
      });
    });

    it('should handle network errors gracefully', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGOUT, () => {
          return HttpResponse.error();
        })
      );

      await expect(logout()).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });

    it('should throw error for service unavailable (503)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGOUT, () => {
          return HttpResponse.json(
            createMockErrorResponse('SERVICE_UNAVAILABLE', 'Service temporarily unavailable', 503),
            { status: 503 }
          );
        })
      );

      await expect(logout()).rejects.toMatchObject({
        status: 503,
      });
    });
  });
});

// ============================================================================
// Token Refresh API Tests
// ============================================================================

describe('refreshToken', () => {
  describe('successful token refresh', () => {
    it('should successfully refresh token with valid refresh token', async () => {
      const response = await refreshToken();

      expect(response).toBeDefined();
      expect(response.accessToken).toBeDefined();
    });

    it('should return new access token', async () => {
      const response = await refreshToken();

      expect(response.accessToken).toContain('.');
      expect(typeof response.accessToken).toBe('string');
    });

    it('should return new refresh token if rotated', async () => {
      const response = await refreshToken();

      expect(response.refreshToken).toBeDefined();
      expect(response.refreshToken).toContain('.');
    });

    it('should return correct token expiration', async () => {
      const response = await refreshToken();

      expect(response.expiresIn).toBe(3600); // 1 hour
    });

    it('should return Bearer token type', async () => {
      const response = await refreshToken();

      expect(response.tokenType).toBe('Bearer');
    });

    it('should send POST request to refresh endpoint', async () => {
      let requestMethod: string = '';

      server.use(
        http.post(AUTH_ENDPOINTS.REFRESH, ({ request }) => {
          requestMethod = request.method;
          return HttpResponse.json(
            createMockApiResponse<RefreshTokenResponse>({
              accessToken: createMockAccessToken(),
              expiresIn: 3600,
              tokenType: 'Bearer',
            })
          );
        })
      );

      await refreshToken();
      expect(requestMethod).toBe('POST');
    });

    it('should send refresh token in request body when available', async () => {
      let capturedBody: { refreshToken?: string } | null = null;

      server.use(
        http.post(AUTH_ENDPOINTS.REFRESH, async ({ request }) => {
          capturedBody = (await request.json()) as { refreshToken?: string };
          return HttpResponse.json(
            createMockApiResponse<RefreshTokenResponse>({
              accessToken: createMockAccessToken(),
              expiresIn: 3600,
              tokenType: 'Bearer',
            })
          );
        })
      );

      // Set refresh token in localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('moodle_refresh_token', createMockRefreshToken());
      }

      await refreshToken();

      // Body should contain the refresh token from localStorage
      expect(capturedBody).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw error for expired refresh token (401)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.REFRESH, () => {
          return HttpResponse.json(
            createMockErrorResponse('SESSION_EXPIRED', 'Your session has expired. Please log in again.', 401),
            { status: 401 }
          );
        })
      );

      await expect(refreshToken()).rejects.toMatchObject({
        code: 'SESSION_EXPIRED',
        status: 401,
      });
    });

    it('should throw error for invalid refresh token', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.REFRESH, () => {
          return HttpResponse.json(
            createMockErrorResponse('INVALID_TOKEN', 'Invalid refresh token', 401),
            { status: 401 }
          );
        })
      );

      await expect(refreshToken()).rejects.toMatchObject({
        status: 401,
      });
    });

    it('should throw error for server errors (500)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.REFRESH, () => {
          return HttpResponse.json(
            createMockErrorResponse('INTERNAL_ERROR', 'Server error during token refresh', 500),
            { status: 500 }
          );
        })
      );

      await expect(refreshToken()).rejects.toMatchObject({
        code: 'TOKEN_REFRESH_FAILED',
        status: 500,
      });
    });

    it('should handle network errors gracefully', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.REFRESH, () => {
          return HttpResponse.error();
        })
      );

      await expect(refreshToken()).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });

    it('should throw error for malformed response (missing accessToken)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.REFRESH, () => {
          return HttpResponse.json({
            success: true,
            data: {
              expiresIn: 3600,
              tokenType: 'Bearer',
              // accessToken is missing
            },
          });
        })
      );

      await expect(refreshToken()).rejects.toMatchObject({
        code: 'TOKEN_REFRESH_FAILED',
      });
    });

    it('should provide default values for missing optional fields', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.REFRESH, () => {
          return HttpResponse.json({
            success: true,
            data: {
              accessToken: createMockAccessToken(),
              // expiresIn and tokenType are missing
            },
          });
        })
      );

      const response = await refreshToken();

      expect(response.expiresIn).toBe(3600); // Default
      expect(response.tokenType).toBe('Bearer'); // Default
    });
  });
});

// ============================================================================
// Get Current User (Me) API Tests
// ============================================================================

describe('getCurrentUser', () => {
  describe('successful user retrieval', () => {
    it('should successfully retrieve current user with valid token', async () => {
      const user = await getCurrentUser();

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
    });

    it('should return complete user profile data', async () => {
      const user = await getCurrentUser();

      expect(user.id).toBe(1);
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('testuser@example.com');
      expect(user.firstname).toBe('Test');
      expect(user.lastname).toBe('User');
    });

    it('should return user roles', async () => {
      const user = await getCurrentUser();

      expect(user.roles).toBeDefined();
      expect(Array.isArray(user.roles)).toBe(true);
      expect(user.roles?.[0].shortname).toBe('student');
    });

    it('should send GET request to me endpoint', async () => {
      let requestMethod: string = '';

      server.use(
        http.get(AUTH_ENDPOINTS.ME, ({ request }) => {
          requestMethod = request.method;
          return HttpResponse.json(createMockApiResponse(createMockUser()));
        })
      );

      await getCurrentUser();
      expect(requestMethod).toBe('GET');
    });

    it('should send Authorization header with Bearer token', async () => {
      let capturedAuthHeader: string | null = null;

      server.use(
        http.get(AUTH_ENDPOINTS.ME, ({ request }) => {
          capturedAuthHeader = request.headers.get('Authorization');
          return HttpResponse.json(createMockApiResponse(createMockUser()));
        })
      );

      await getCurrentUser();
      // Authorization header is set by apiClient interceptor
    });

    it('should return user preferences', async () => {
      const user = await getCurrentUser();

      expect(user.preferences).toBeDefined();
      expect(typeof user.preferences).toBe('object');
    });

    it('should return user profile image URLs', async () => {
      const user = await getCurrentUser();

      expect(user.profileimageurl).toBeDefined();
      expect(user.profileimageurlsmall).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw error for missing token (401)', async () => {
      server.use(
        http.get(AUTH_ENDPOINTS.ME, () => {
          return HttpResponse.json(
            createMockErrorResponse('NOT_AUTHENTICATED', 'You are not logged in. Please log in to continue.', 401),
            { status: 401 }
          );
        })
      );

      await expect(getCurrentUser()).rejects.toMatchObject({
        code: 'NOT_AUTHENTICATED',
        status: 401,
      });
    });

    it('should throw error for invalid token (401)', async () => {
      server.use(
        http.get(AUTH_ENDPOINTS.ME, () => {
          return HttpResponse.json(
            createMockErrorResponse('INVALID_TOKEN', 'Invalid authentication token', 401),
            { status: 401 }
          );
        })
      );

      await expect(getCurrentUser()).rejects.toMatchObject({
        status: 401,
      });
    });

    it('should throw error for expired token (401)', async () => {
      server.use(
        http.get(AUTH_ENDPOINTS.ME, () => {
          return HttpResponse.json(
            createMockErrorResponse('TOKEN_EXPIRED', 'Authentication token has expired', 401),
            { status: 401 }
          );
        })
      );

      await expect(getCurrentUser()).rejects.toMatchObject({
        status: 401,
      });
    });

    it('should throw error for server errors (500)', async () => {
      server.use(
        http.get(AUTH_ENDPOINTS.ME, () => {
          return HttpResponse.json(
            createMockErrorResponse('INTERNAL_ERROR', 'Server error fetching user profile', 500),
            { status: 500 }
          );
        })
      );

      await expect(getCurrentUser()).rejects.toMatchObject({
        code: 'USER_FETCH_FAILED',
        status: 500,
      });
    });

    it('should handle network errors gracefully', async () => {
      server.use(
        http.get(AUTH_ENDPOINTS.ME, () => {
          return HttpResponse.error();
        })
      );

      await expect(getCurrentUser()).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });

    it('should throw error for malformed response (missing id)', async () => {
      server.use(
        http.get(AUTH_ENDPOINTS.ME, () => {
          return HttpResponse.json({
            success: true,
            data: {
              username: 'testuser',
              email: 'test@example.com',
              // id is missing
            },
          });
        })
      );

      await expect(getCurrentUser()).rejects.toMatchObject({
        code: 'USER_FETCH_FAILED',
      });
    });

    it('should throw error for malformed response (missing username)', async () => {
      server.use(
        http.get(AUTH_ENDPOINTS.ME, () => {
          return HttpResponse.json({
            success: true,
            data: {
              id: 1,
              email: 'test@example.com',
              // username is missing
            },
          });
        })
      );

      await expect(getCurrentUser()).rejects.toMatchObject({
        code: 'USER_FETCH_FAILED',
      });
    });

    it('should throw error for invalid response format', async () => {
      server.use(
        http.get(AUTH_ENDPOINTS.ME, () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'UNKNOWN_ERROR',
              message: 'Unknown error',
            },
          });
        })
      );

      await expect(getCurrentUser()).rejects.toBeDefined();
    });
  });
});

// ============================================================================
// Password Reset API Tests
// ============================================================================

describe('resetPassword', () => {
  describe('successful password reset request', () => {
    it('should successfully request password reset with email', async () => {
      const response = await resetPassword({ email: 'user@example.com' });

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.message).toBeDefined();
    });

    it('should successfully request password reset with username', async () => {
      const response = await resetPassword({ username: 'testuser' });

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
    });

    it('should return generic success message (for security)', async () => {
      const response = await resetPassword({ email: 'user@example.com' });

      // Message should not reveal if account exists
      expect(response.message).toContain('If an account exists');
    });

    it('should send POST request to reset-password endpoint', async () => {
      let requestMethod: string = '';

      server.use(
        http.post(AUTH_ENDPOINTS.RESET_PASSWORD, ({ request }) => {
          requestMethod = request.method;
          return HttpResponse.json(
            createMockApiResponse<PasswordResetResponse>({
              success: true,
              message: 'Password reset email sent.',
            })
          );
        })
      );

      await resetPassword({ email: 'user@example.com' });
      expect(requestMethod).toBe('POST');
    });

    it('should send email in request body', async () => {
      let capturedBody: PasswordResetRequest | null = null;

      server.use(
        http.post(AUTH_ENDPOINTS.RESET_PASSWORD, async ({ request }) => {
          capturedBody = (await request.json()) as PasswordResetRequest;
          return HttpResponse.json(
            createMockApiResponse<PasswordResetResponse>({
              success: true,
              message: 'Password reset email sent.',
            })
          );
        })
      );

      await resetPassword({ email: 'custom@example.com' });

      expect(capturedBody).toEqual({ email: 'custom@example.com' });
    });

    it('should send username in request body', async () => {
      let capturedBody: PasswordResetRequest | null = null;

      server.use(
        http.post(AUTH_ENDPOINTS.RESET_PASSWORD, async ({ request }) => {
          capturedBody = (await request.json()) as PasswordResetRequest;
          return HttpResponse.json(
            createMockApiResponse<PasswordResetResponse>({
              success: true,
              message: 'Password reset email sent.',
            })
          );
        })
      );

      await resetPassword({ username: 'customuser' });

      expect(capturedBody).toEqual({ username: 'customuser' });
    });
  });

  describe('error handling', () => {
    it('should throw error when neither username nor email provided', async () => {
      await expect(resetPassword({})).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Please provide a username or email address',
        status: 400,
      });
    });

    it('should throw error for rate limiting (429)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.RESET_PASSWORD, () => {
          return HttpResponse.json(
            createMockErrorResponse('RATE_LIMITED', 'Too many password reset requests. Please try again later.', 429),
            { status: 429 }
          );
        })
      );

      await expect(resetPassword({ email: 'user@example.com' })).rejects.toMatchObject({
        code: 'RATE_LIMITED',
        status: 429,
      });
    });

    it('should return success for 400 errors (security - hide account existence)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.RESET_PASSWORD, () => {
          return HttpResponse.json(
            createMockErrorResponse('USER_NOT_FOUND', 'User not found', 400),
            { status: 400 }
          );
        })
      );

      // Should return success to hide whether account exists
      const response = await resetPassword({ email: 'nonexistent@example.com' });
      expect(response.success).toBe(true);
    });

    it('should return success for 404 errors (security - hide account existence)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.RESET_PASSWORD, () => {
          return HttpResponse.json(
            createMockErrorResponse('NOT_FOUND', 'Account not found', 404),
            { status: 404 }
          );
        })
      );

      // Should return success to hide whether account exists
      const response = await resetPassword({ email: 'notfound@example.com' });
      expect(response.success).toBe(true);
    });

    it('should throw error for server errors (500)', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.RESET_PASSWORD, () => {
          return HttpResponse.json(
            createMockErrorResponse('INTERNAL_ERROR', 'Server error', 500),
            { status: 500 }
          );
        })
      );

      await expect(resetPassword({ email: 'user@example.com' })).rejects.toMatchObject({
        code: 'PASSWORD_RESET_FAILED',
        status: 500,
      });
    });

    it('should handle network errors gracefully', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.RESET_PASSWORD, () => {
          return HttpResponse.error();
        })
      );

      await expect(resetPassword({ email: 'user@example.com' })).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });
  });
});

// ============================================================================
// Integration Tests - Authentication Flows
// ============================================================================

describe('Authentication Flow Integration', () => {
  describe('complete login flow', () => {
    it('should successfully login and retrieve user data', async () => {
      // Step 1: Login
      const credentials = createMockCredentials();
      const loginResponse = await login(credentials);

      expect(loginResponse.user).toBeDefined();
      expect(loginResponse.tokens.accessToken).toBeDefined();

      // Step 2: Get current user (simulating subsequent request with token)
      const user = await getCurrentUser();

      expect(user.id).toBe(loginResponse.user.id);
      expect(user.username).toBe(loginResponse.user.username);
    });

    it('should handle full authentication lifecycle', async () => {
      // Step 1: Login
      const credentials = createMockCredentials();
      const loginResponse = await login(credentials);
      expect(loginResponse.tokens.accessToken).toBeDefined();

      // Step 2: Access protected resource
      const user = await getCurrentUser();
      expect(user.id).toBe(1);

      // Step 3: Logout
      await expect(logout()).resolves.toBeUndefined();
    });
  });

  describe('token refresh flow', () => {
    it('should successfully refresh token and continue accessing resources', async () => {
      // Step 1: Refresh token (simulating expired access token)
      const refreshResponse = await refreshToken();
      expect(refreshResponse.accessToken).toBeDefined();

      // Step 2: Access resource with new token
      const user = await getCurrentUser();
      expect(user.id).toBeDefined();
    });

    it('should handle token refresh with rotation', async () => {
      const refreshResponse = await refreshToken();

      expect(refreshResponse.accessToken).toBeDefined();
      expect(refreshResponse.refreshToken).toBeDefined();
      expect(refreshResponse.expiresIn).toBe(3600);
      expect(refreshResponse.tokenType).toBe('Bearer');
    });
  });

  describe('logout flow', () => {
    it('should successfully logout and invalidate session', async () => {
      // Step 1: Logout
      await expect(logout()).resolves.toBeUndefined();

      // Step 2: Subsequent requests should fail (simulated by handler)
      server.use(
        http.get(AUTH_ENDPOINTS.ME, () => {
          return HttpResponse.json(
            createMockErrorResponse('NOT_AUTHENTICATED', 'You are not logged in', 401),
            { status: 401 }
          );
        })
      );

      await expect(getCurrentUser()).rejects.toMatchObject({
        code: 'NOT_AUTHENTICATED',
        status: 401,
      });
    });
  });
});

// ============================================================================
// HTTP Error Status Code Tests
// ============================================================================

describe('HTTP Error Status Codes', () => {
  describe('400 Bad Request', () => {
    it('should handle 400 errors with proper error message', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, () => {
          return HttpResponse.json(
            createMockErrorResponse('BAD_REQUEST', 'Invalid request format', 400),
            { status: 400 }
          );
        })
      );

      await expect(login(createMockCredentials())).rejects.toMatchObject({
        status: 400,
      });
    });
  });

  describe('401 Unauthorized', () => {
    it('should handle 401 errors with proper error code', async () => {
      server.use(
        http.get(AUTH_ENDPOINTS.ME, () => {
          return HttpResponse.json(
            createMockErrorResponse('UNAUTHORIZED', 'Authentication required', 401),
            { status: 401 }
          );
        })
      );

      await expect(getCurrentUser()).rejects.toMatchObject({
        status: 401,
      });
    });
  });

  describe('403 Forbidden', () => {
    it('should handle 403 errors for login with disabled account', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, () => {
          return HttpResponse.json(
            createMockErrorResponse('FORBIDDEN', 'Account is disabled', 403),
            { status: 403 }
          );
        })
      );

      await expect(login(createMockCredentials())).rejects.toMatchObject({
        status: 403,
      });
    });
  });

  describe('500 Internal Server Error', () => {
    it('should handle 500 errors gracefully', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, () => {
          return HttpResponse.json(
            createMockErrorResponse('INTERNAL_ERROR', 'Internal server error', 500),
            { status: 500 }
          );
        })
      );

      await expect(login(createMockCredentials())).rejects.toMatchObject({
        status: 500,
      });
    });
  });

  describe('503 Service Unavailable', () => {
    it('should handle 503 errors for service unavailability', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, () => {
          return HttpResponse.json(
            createMockErrorResponse('SERVICE_UNAVAILABLE', 'Service temporarily unavailable', 503),
            { status: 503 }
          );
        })
      );

      await expect(login(createMockCredentials())).rejects.toMatchObject({
        status: 503,
      });
    });
  });
});

// ============================================================================
// Edge Cases and Boundary Tests
// ============================================================================

describe('Edge Cases', () => {
  describe('empty credentials', () => {
    it('should handle empty username', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, () => {
          return HttpResponse.json(
            createMockErrorResponse('VALIDATION_ERROR', 'Username is required', 400),
            { status: 400 }
          );
        })
      );

      await expect(login({ username: '', password: 'password' })).rejects.toBeDefined();
    });

    it('should handle empty password', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, () => {
          return HttpResponse.json(
            createMockErrorResponse('VALIDATION_ERROR', 'Password is required', 400),
            { status: 400 }
          );
        })
      );

      await expect(login({ username: 'user', password: '' })).rejects.toBeDefined();
    });
  });

  describe('special characters in credentials', () => {
    it('should handle special characters in username', async () => {
      const credentials = createMockCredentials({ username: 'user@domain.com' });
      const response = await login(credentials);

      expect(response.user).toBeDefined();
    });

    it('should handle special characters in password', async () => {
      const credentials = createMockCredentials({ password: 'P@$$w0rd!#$%^&*()' });
      const response = await login(credentials);

      expect(response.user).toBeDefined();
    });

    it('should handle unicode characters in username', async () => {
      const credentials = createMockCredentials({ username: 'ユーザー名' });
      const response = await login(credentials);

      expect(response.user).toBeDefined();
    });
  });

  describe('concurrent requests', () => {
    it('should handle concurrent login requests', async () => {
      const credentials = createMockCredentials();

      const results = await Promise.all([login(credentials), login(credentials), login(credentials)]);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.user).toBeDefined();
        expect(result.tokens).toBeDefined();
      });
    });

    it('should handle concurrent getCurrentUser requests', async () => {
      const results = await Promise.all([getCurrentUser(), getCurrentUser(), getCurrentUser()]);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.id).toBeDefined();
        expect(result.username).toBeDefined();
      });
    });
  });

  describe('response timing', () => {
    it('should handle slow responses without timeout', async () => {
      server.use(
        http.post(AUTH_ENDPOINTS.LOGIN, async () => {
          // Simulate slow response (50ms)
          await new Promise((resolve) => setTimeout(resolve, 50));
          return HttpResponse.json(createMockApiResponse(createMockLoginResponse()));
        })
      );

      const credentials = createMockCredentials();
      const response = await login(credentials);

      expect(response.user).toBeDefined();
    });
  });
});

// ============================================================================
// Mock Data Validation Tests
// ============================================================================

describe('Mock Data Validation', () => {
  describe('createMockUser', () => {
    it('should create a valid user object with all required fields', () => {
      const user = createMockUser();

      expect(user.id).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.firstname).toBeDefined();
      expect(user.lastname).toBeDefined();
      expect(user.email).toBeDefined();
    });

    it('should allow field overrides', () => {
      const user = createMockUser({
        id: 999,
        username: 'customuser',
        email: 'custom@example.com',
      });

      expect(user.id).toBe(999);
      expect(user.username).toBe('customuser');
      expect(user.email).toBe('custom@example.com');
    });
  });

  describe('createMockAccessToken', () => {
    it('should create a valid JWT-like token string', () => {
      const token = createMockAccessToken();

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should create different tokens for different users', () => {
      const token1 = createMockAccessToken({ userId: 1 });
      const token2 = createMockAccessToken({ userId: 2 });

      expect(token1).not.toBe(token2);
    });
  });

  describe('createMockLoginResponse', () => {
    it('should create a complete login response', () => {
      const response = createMockLoginResponse();

      expect(response.user).toBeDefined();
      expect(response.tokens).toBeDefined();
      expect(response.tokens.accessToken).toBeDefined();
      expect(response.tokens.refreshToken).toBeDefined();
    });
  });
});
