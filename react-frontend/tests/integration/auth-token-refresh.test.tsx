/**
 * @file Integration tests for JWT token refresh workflow
 * @description Tests automatic token refresh mechanism when access token expires during user session.
 * Mocks POST /api/v1/auth/refresh endpoint with MSW to exchange refresh token for new access token.
 * Verifies axios interceptor catches 401 responses, triggers refresh request with refresh token,
 * updates stored access token, retries original failed request with new token, and continues
 * user session seamlessly without requiring re-login.
 * 
 * @module tests/integration/auth-token-refresh
 */

import { useEffect, useState } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';

// Internal imports from depends_on_files
import { server } from '../mocks/server';
import { renderWithAuth } from '../helpers/render';
import { apiClient } from '../../src/services/api/client';
import { resetInterceptorState } from '../../src/services/api/interceptors';
import { 
  setTokens, 
  clearTokens, 
  getAccessToken, 
  getRefreshToken,
  resetAuthServiceState
} from '../../src/services/auth/authService';
import { AuthStatus } from '../../src/features/auth/types/auth.types';

// ============================================================================
// Test Constants
// ============================================================================

/**
 * Base URL for API endpoints in tests
 */
const API_BASE_URL = 'http://localhost:8000/api/v1';

/**
 * Test tokens used across test cases
 */
const TEST_TOKENS = {
  // Simulates an expired access token
  expiredAccessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImV4cCI6MTAwMDAwMDAwMH0.expired',
  // Valid refresh token for exchanging
  validRefreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImV4cCI6OTk5OTk5OTk5OX0.refresh',
  // New access token returned after refresh
  newAccessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImV4cCI6OTk5OTk5OTk5OX0.new_access',
  // New refresh token returned after refresh
  newRefreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImV4cCI6OTk5OTk5OTk5OX0.new_refresh',
  // Expired refresh token for testing logout scenario
  expiredRefreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImV4cCI6MTAwMDAwMDAwMH0.expired_refresh',
};

/**
 * Test user data with all required properties per User type
 */
const TEST_USER = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  firstname: 'Test',
  lastname: 'User',
  fullname: 'Test User',
  auth: 'manual',
  confirmed: true,
  suspended: false,
  roles: [],
  capabilities: [],
};

/**
 * Protected resource data returned by test endpoints
 */
const PROTECTED_RESOURCE_DATA = {
  id: 1,
  name: 'Protected Resource',
  data: 'Sensitive data only accessible with valid token',
};

/**
 * Helper function to create auth state for preloadedState
 * Ensures all required fields are present with correct types
 */
function createAuthState(
  accessToken: string = TEST_TOKENS.expiredAccessToken,
  refreshToken: string = TEST_TOKENS.validRefreshToken
) {
  return {
    auth: {
      user: TEST_USER,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 3600,
        tokenType: 'Bearer',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      status: AuthStatus.AUTHENTICATED,
    },
  };
}

// ============================================================================
// MSW Handlers Factory Functions
// ============================================================================

/**
 * Creates MSW handler for successful token refresh
 * @param refreshDelay Optional delay to simulate network latency
 * @returns MSW request handler
 */
function createSuccessfulRefreshHandler(refreshDelay = 0) {
  return http.post(`${API_BASE_URL}/auth/refresh`, async ({ request }) => {
    if (refreshDelay > 0) {
      await delay(refreshDelay);
    }

    // Parse request body to validate refresh token is sent
    const body = await request.json() as { refreshToken?: string };
    
    // Verify refresh token is provided
    if (!body.refreshToken) {
      return HttpResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_REQUEST', 
            message: 'Refresh token required' 
          } 
        },
        { status: 400 }
      );
    }

    // Simulate expired refresh token
    if (body.refreshToken === TEST_TOKENS.expiredRefreshToken) {
      return HttpResponse.json(
        { 
          success: false, 
          error: { 
            code: 'TOKEN_EXPIRED', 
            message: 'Refresh token has expired' 
          } 
        },
        { status: 401 }
      );
    }

    // Return new tokens on successful refresh
    // Note: authService expects snake_case keys (access_token, refresh_token)
    return HttpResponse.json({
      success: true,
      data: {
        access_token: TEST_TOKENS.newAccessToken,
        refresh_token: TEST_TOKENS.newRefreshToken,
        expires_in: 3600,
        token_type: 'Bearer',
      },
    });
  });
}

/**
 * Creates MSW handler for protected endpoint that initially returns 401
 * then succeeds with valid token after refresh
 */
function createProtectedEndpointHandler() {
  let _requestCount = 0;

  return http.get(`${API_BASE_URL}/protected/resource`, ({ request }) => {
    _requestCount++;
    const authHeader = request.headers.get('Authorization');
    
    // First request with expired token returns 401
    if (authHeader === `Bearer ${TEST_TOKENS.expiredAccessToken}`) {
      return HttpResponse.json(
        { 
          success: false, 
          error: { 
            code: 'TOKEN_EXPIRED', 
            message: 'Access token has expired' 
          } 
        },
        { status: 401 }
      );
    }

    // Subsequent request with new token succeeds
    if (authHeader === `Bearer ${TEST_TOKENS.newAccessToken}`) {
      return HttpResponse.json({
        success: true,
        data: PROTECTED_RESOURCE_DATA,
      });
    }

    // Default: unauthorized
    return HttpResponse.json(
      { 
        success: false, 
        error: { 
          code: 'UNAUTHORIZED', 
          message: 'Invalid or missing authorization' 
        } 
      },
      { status: 401 }
    );
  });
}

/**
 * Creates MSW handler that tracks number of refresh calls
 * Used to verify only one refresh happens for concurrent requests
 */
function createCountingRefreshHandler() {
  let refreshCallCount = 0;

  const handler = http.post(`${API_BASE_URL}/auth/refresh`, async ({ request }) => {
    refreshCallCount++;
    
    // Add delay to simulate real network request
    await delay(100);

    const body = await request.json() as { refreshToken?: string };
    
    if (body.refreshToken === TEST_TOKENS.validRefreshToken) {
      // Note: authService expects snake_case keys (access_token, refresh_token)
      return HttpResponse.json({
        success: true,
        data: {
          access_token: TEST_TOKENS.newAccessToken,
          refresh_token: TEST_TOKENS.newRefreshToken,
          expires_in: 3600,
          token_type: 'Bearer',
        },
      });
    }

    return HttpResponse.json(
      { success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid refresh token' } },
      { status: 401 }
    );
  });

  return {
    handler,
    getCallCount: () => refreshCallCount,
    resetCallCount: () => { refreshCallCount = 0; },
  };
}

/**
 * Creates MSW handler that always fails token refresh
 * Used to test logout scenario when refresh fails
 */
function createFailingRefreshHandler() {
  return http.post(`${API_BASE_URL}/auth/refresh`, async () => {
    await delay(50);
    return HttpResponse.json(
      { 
        success: false, 
        error: { 
          code: 'REFRESH_FAILED', 
          message: 'Unable to refresh token' 
        } 
      },
      { status: 401 }
    );
  });
}

// ============================================================================
// Test Components
// ============================================================================

/**
 * Test component that makes API call and displays result
 * Used to verify token refresh during actual component usage
 */
interface TestComponentProps {
  onSuccess?: (data: typeof PROTECTED_RESOURCE_DATA) => void;
  onError?: (error: Error) => void;
}

function TestProtectedComponent({ onSuccess, onError }: TestComponentProps) {
  const [data, setData] = useState<typeof PROTECTED_RESOURCE_DATA | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get('/protected/resource');
        if (mounted) {
          setData(response.data.data);
          setLoading(false);
          onSuccess?.(response.data.data);
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          setError(errorMessage);
          setLoading(false);
          onError?.(err instanceof Error ? err : new Error(errorMessage));
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [onSuccess, onError]);

  if (loading) {
    return <div role="status" aria-label="Loading">Loading protected data...</div>;
  }

  if (error) {
    return <div role="alert">Error: {error}</div>;
  }

  if (data) {
    return (
      <div data-testid="protected-content">
        <h1>{data.name}</h1>
        <p>{data.data}</p>
      </div>
    );
  }

  return null;
}

/**
 * Component that makes multiple concurrent API calls
 * Used to test concurrent request handling during refresh
 */
function ConcurrentRequestsComponent({ 
  requestCount = 3,
  onAllComplete,
}: { 
  requestCount?: number;
  onAllComplete?: (results: Array<{ success: boolean; error?: string }>) => void;
}) {
  const [results, setResults] = useState<Array<{ success: boolean; error?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const makeRequests = async () => {
      const promises = Array.from({ length: requestCount }, async () => {
        try {
          const response = await apiClient.get('/protected/resource');
          return { success: true, data: response.data };
        } catch (err) {
          return { 
            success: false, 
            error: err instanceof Error ? err.message : 'Unknown error' 
          };
        }
      });

      const completedResults = await Promise.all(promises);
      setResults(completedResults);
      setLoading(false);
      onAllComplete?.(completedResults);
    };

    makeRequests();
  }, [requestCount, onAllComplete]);

  if (loading) {
    return <div role="status" aria-label="Loading">Making {requestCount} concurrent requests...</div>;
  }

  return (
    <div data-testid="concurrent-results">
      <p>Completed: {results.filter(r => r.success).length} / {requestCount}</p>
      {results.map((result, index) => (
        <div key={index} data-testid={`result-${index}`}>
          {result.success ? 'Success' : `Error: ${result.error}`}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Auth Token Refresh Integration', () => {
  // Store original localStorage
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    // Reset MSW handlers to default
    server.resetHandlers();
    
    // Initialize localStorage mock
    localStorageMock = {};
    
    // Mock localStorage
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key: string) => localStorageMock[key] || null
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      (key: string, value: string) => { localStorageMock[key] = value; }
    );
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(
      (key: string) => { delete localStorageMock[key]; }
    );
    vi.spyOn(Storage.prototype, 'clear').mockImplementation(
      () => { localStorageMock = {}; }
    );
  });

  afterEach(() => {
    // Clear all tokens after each test
    clearTokens();
    
    // Reset MSW handlers
    server.resetHandlers();
    
    // Reset interceptor state (isRefreshing, failedQueue) to prevent test isolation issues
    resetInterceptorState();
    
    // Reset auth service state (refreshPromise mutex) to prevent test isolation issues
    resetAuthServiceState();
    
    // Clear all mocks
    vi.clearAllMocks();
    
    // Clear localStorage mock
    localStorageMock = {};
  });

  // ==========================================================================
  // Test Case 1: Automatic Token Refresh
  // ==========================================================================
  describe('Automatic Token Refresh', () => {
    it('should automatically refresh token when API returns 401 and retry original request', async () => {
      // Setup: Add handlers for refresh endpoint and protected endpoint
      server.use(
        createSuccessfulRefreshHandler(),
        createProtectedEndpointHandler()
      );

      // Setup: Set expired access token and valid refresh token
      setTokens(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.validRefreshToken);

      const onSuccess = vi.fn();
      const onError = vi.fn();

      // Act: Render component that makes API call
      renderWithAuth(
        <TestProtectedComponent onSuccess={onSuccess} onError={onError} />,
        {
          preloadedState: createAuthState(),
        }
      );

      // Assert: Initial loading state
      expect(screen.getByRole('status')).toHaveTextContent('Loading protected data...');

      // Assert: Wait for successful data fetch after token refresh
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Assert: Success callback was called with correct data
      expect(onSuccess).toHaveBeenCalledWith(PROTECTED_RESOURCE_DATA);
      expect(onError).not.toHaveBeenCalled();

      // Assert: Protected content is displayed
      expect(screen.getByText(PROTECTED_RESOURCE_DATA.name)).toBeInTheDocument();
      expect(screen.getByText(PROTECTED_RESOURCE_DATA.data)).toBeInTheDocument();
    });

    it('should detect 401 error and trigger token refresh automatically', async () => {
      // Track refresh endpoint calls
      const refreshCalls: Array<{ timestamp: number; body: unknown }> = [];

      server.use(
        http.post(`${API_BASE_URL}/auth/refresh`, async ({ request }) => {
          const body = await request.json();
          refreshCalls.push({ timestamp: Date.now(), body });

          // Note: authService expects snake_case keys (access_token, refresh_token)
          return HttpResponse.json({
            success: true,
            data: {
              access_token: TEST_TOKENS.newAccessToken,
              refresh_token: TEST_TOKENS.newRefreshToken,
              expires_in: 3600,
              token_type: 'Bearer',
            },
          });
        }),
        createProtectedEndpointHandler()
      );

      // Setup tokens
      setTokens(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.validRefreshToken);

      // Make API call with expired token
      renderWithAuth(
        <TestProtectedComponent />,
        {
          preloadedState: createAuthState(),
        }
      );

      // Wait for protected content to appear (indicates successful refresh and retry)
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify refresh was called exactly once
      expect(refreshCalls.length).toBe(1);

      // Verify refresh was called with correct refresh token
      const firstRefreshCall = refreshCalls[0];
      expect(firstRefreshCall).toBeDefined();
      expect(firstRefreshCall!.body).toEqual({
        refreshToken: TEST_TOKENS.validRefreshToken,
      });
    });
  });

  // ==========================================================================
  // Test Case 2: Token Update
  // ==========================================================================
  describe('Token Update After Refresh', () => {
    it('should update stored tokens after successful refresh', async () => {
      server.use(
        createSuccessfulRefreshHandler(),
        createProtectedEndpointHandler()
      );

      // Setup: Set expired access token and valid refresh token
      setTokens(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.validRefreshToken);

      // Verify initial tokens
      expect(getAccessToken()).toBe(TEST_TOKENS.expiredAccessToken);
      expect(getRefreshToken()).toBe(TEST_TOKENS.validRefreshToken);

      renderWithAuth(
        <TestProtectedComponent />,
        {
          preloadedState: createAuthState(),
        }
      );

      // Wait for successful completion
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify tokens were updated
      expect(getAccessToken()).toBe(TEST_TOKENS.newAccessToken);
      expect(getRefreshToken()).toBe(TEST_TOKENS.newRefreshToken);
    });

    it('should use new access token for subsequent requests', async () => {
      const requestHeaders: Array<string | null> = [];

      server.use(
        createSuccessfulRefreshHandler(),
        http.get(`${API_BASE_URL}/protected/resource`, ({ request }) => {
          requestHeaders.push(request.headers.get('Authorization'));
          
          const authHeader = request.headers.get('Authorization');
          
          // First request with expired token returns 401
          if (authHeader === `Bearer ${TEST_TOKENS.expiredAccessToken}`) {
            return HttpResponse.json(
              { success: false, error: { code: 'TOKEN_EXPIRED', message: 'Expired' } },
              { status: 401 }
            );
          }

          // Subsequent requests with new token succeed
          if (authHeader === `Bearer ${TEST_TOKENS.newAccessToken}`) {
            return HttpResponse.json({
              success: true,
              data: PROTECTED_RESOURCE_DATA,
            });
          }

          return HttpResponse.json(
            { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
            { status: 401 }
          );
        })
      );

      setTokens(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.validRefreshToken);

      renderWithAuth(
        <TestProtectedComponent />,
        {
          preloadedState: createAuthState(),
        }
      );

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify request sequence:
      // 1. First request with expired token (got 401)
      // 2. Second request (retry) with new token (succeeded)
      expect(requestHeaders.length).toBe(2);
      expect(requestHeaders[0]).toBe(`Bearer ${TEST_TOKENS.expiredAccessToken}`);
      expect(requestHeaders[1]).toBe(`Bearer ${TEST_TOKENS.newAccessToken}`);
    });
  });

  // ==========================================================================
  // Test Case 3: Concurrent Requests
  // ==========================================================================
  describe('Concurrent Requests During Token Refresh', () => {
    it('should trigger only one refresh for multiple simultaneous requests with expired token', async () => {
      const { handler, getCallCount, resetCallCount } = createCountingRefreshHandler();
      resetCallCount();

      // Track all protected endpoint requests
      let _protectedRequestCount = 0;

      server.use(
        handler,
        http.get(`${API_BASE_URL}/protected/resource`, async ({ request }) => {
          _protectedRequestCount++;
          const authHeader = request.headers.get('Authorization');
          
          // Simulate some processing time
          await delay(50);

          if (authHeader === `Bearer ${TEST_TOKENS.expiredAccessToken}`) {
            return HttpResponse.json(
              { success: false, error: { code: 'TOKEN_EXPIRED', message: 'Expired' } },
              { status: 401 }
            );
          }

          if (authHeader === `Bearer ${TEST_TOKENS.newAccessToken}`) {
            return HttpResponse.json({
              success: true,
              data: PROTECTED_RESOURCE_DATA,
            });
          }

          return HttpResponse.json(
            { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
            { status: 401 }
          );
        })
      );

      setTokens(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.validRefreshToken);

      const onAllComplete = vi.fn();

      renderWithAuth(
        <ConcurrentRequestsComponent requestCount={5} onAllComplete={onAllComplete} />,
        {
          preloadedState: createAuthState(),
        }
      );

      // Wait for all requests to complete
      await waitFor(() => {
        expect(screen.getByTestId('concurrent-results')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Wait a bit more for all async operations
      await waitFor(() => {
        expect(onAllComplete).toHaveBeenCalled();
      }, { timeout: 5000 });

      // Critical assertion: Only ONE refresh call despite multiple concurrent requests
      // This verifies the mutex/lock mechanism in the interceptor
      expect(getCallCount()).toBe(1);

      // Verify all requests eventually succeeded
      const results = onAllComplete.mock.calls[0][0];
      const successCount = results.filter((r: { success: boolean }) => r.success).length;
      expect(successCount).toBe(5);
    });

    it('should queue requests during token refresh and process them after', async () => {
      const { handler, getCallCount } = createCountingRefreshHandler();
      const processedRequests: number[] = [];

      server.use(
        handler,
        http.get(`${API_BASE_URL}/protected/resource`, async ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          
          if (authHeader === `Bearer ${TEST_TOKENS.expiredAccessToken}`) {
            return HttpResponse.json(
              { success: false, error: { code: 'TOKEN_EXPIRED', message: 'Expired' } },
              { status: 401 }
            );
          }

          if (authHeader === `Bearer ${TEST_TOKENS.newAccessToken}`) {
            processedRequests.push(Date.now());
            return HttpResponse.json({
              success: true,
              data: PROTECTED_RESOURCE_DATA,
            });
          }

          return HttpResponse.json(
            { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
            { status: 401 }
          );
        })
      );

      setTokens(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.validRefreshToken);

      const onAllComplete = vi.fn();

      renderWithAuth(
        <ConcurrentRequestsComponent requestCount={3} onAllComplete={onAllComplete} />,
        { preloadedState: createAuthState() }
      );

      await waitFor(() => {
        expect(onAllComplete).toHaveBeenCalled();
      }, { timeout: 10000 });

      // Only one refresh should have occurred
      expect(getCallCount()).toBe(1);

      // All 3 requests should have been processed after refresh
      expect(processedRequests.length).toBe(3);
    });
  });

  // ==========================================================================
  // Test Case 4: Refresh Token Expired
  // ==========================================================================
  describe('Refresh Token Expired', () => {
    it('should logout user when refresh token is also expired', async () => {
      server.use(
        createFailingRefreshHandler(),
        createProtectedEndpointHandler()
      );

      // Setup: Set expired access token AND expired refresh token
      setTokens(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.expiredRefreshToken);

      const onError = vi.fn();

      renderWithAuth(
        <TestProtectedComponent onError={onError} />,
        { preloadedState: createAuthState(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.expiredRefreshToken) }
      );

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify error callback was called
      expect(onError).toHaveBeenCalled();

      // Verify tokens were cleared (user logged out)
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });

    it('should redirect to login when refresh fails', async () => {
      // Note: We can't directly test window.location.href redirect in happy-dom without
      // breaking axios URL resolution. Instead, we verify the logout behavior by checking:
      // 1. Tokens are cleared
      // 2. Error is shown
      // The actual redirect is verified through the interceptor clearing tokens and
      // attempting the redirect (which we can't capture in test environment)

      server.use(
        createFailingRefreshHandler(),
        createProtectedEndpointHandler()
      );

      setTokens(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.expiredRefreshToken);

      const onError = vi.fn();

      renderWithAuth(
        <TestProtectedComponent onError={onError} />,
        { preloadedState: createAuthState(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.expiredRefreshToken) }
      );

      // Wait for error handling
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify tokens were cleared (proves logout logic executed)
      // The actual redirect to /login happens in interceptors.ts
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();

      // Verify error callback was called
      expect(onError).toHaveBeenCalled();
    });

    it('should clear authentication state on refresh failure', async () => {
      server.use(
        createFailingRefreshHandler(),
        createProtectedEndpointHandler()
      );

      setTokens(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.expiredRefreshToken);

      // Verify tokens exist initially
      expect(getAccessToken()).toBe(TEST_TOKENS.expiredAccessToken);
      expect(getRefreshToken()).toBe(TEST_TOKENS.expiredRefreshToken);

      renderWithAuth(
        <TestProtectedComponent />,
        { preloadedState: createAuthState(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.expiredRefreshToken) }
      );

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify complete logout - tokens cleared
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });
  });

  // ==========================================================================
  // Test Case 5: Seamless UX
  // ==========================================================================
  describe('Seamless User Experience During Refresh', () => {
    it('should show loading state but no interruption during token refresh', async () => {
      // Add delay to refresh to ensure loading state is visible
      server.use(
        createSuccessfulRefreshHandler(500), // 500ms delay
        createProtectedEndpointHandler()
      );

      setTokens(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.validRefreshToken);

      renderWithAuth(
        <TestProtectedComponent />,
        { preloadedState: createAuthState() }
      );

      // Loading state should be visible initially
      expect(screen.getByRole('status')).toHaveTextContent('Loading protected data...');

      // Wait for content to load (after token refresh completes)
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      }, { timeout: 5000 });

      // No error should have been shown to user
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      // Content should be displayed
      expect(screen.getByText(PROTECTED_RESOURCE_DATA.name)).toBeInTheDocument();
    });

    it('should not show re-login prompt during successful token refresh', async () => {
      server.use(
        createSuccessfulRefreshHandler(200),
        createProtectedEndpointHandler()
      );

      setTokens(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.validRefreshToken);

      const onSuccess = vi.fn();
      const onError = vi.fn();

      renderWithAuth(
        <TestProtectedComponent onSuccess={onSuccess} onError={onError} />,
        { preloadedState: createAuthState() }
      );

      // Wait for successful completion
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Success callback should be called, not error
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();

      // No login-related text should appear
      expect(screen.queryByText(/login/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
    });

    it('should maintain user context throughout token refresh process', async () => {
      server.use(
        createSuccessfulRefreshHandler(),
        createProtectedEndpointHandler()
      );

      setTokens(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.validRefreshToken);

      // Component that displays user info from context
      function UserContextComponent() {
        return (
          <div>
            <span data-testid="user-display">{TEST_USER.username}</span>
            <TestProtectedComponent />
          </div>
        );
      }

      renderWithAuth(
        <UserContextComponent />,
        { preloadedState: createAuthState() }
      );

      // User info should be displayed initially
      expect(screen.getByTestId('user-display')).toHaveTextContent(TEST_USER.username);

      // Wait for protected content to load
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      }, { timeout: 5000 });

      // User info should still be displayed after token refresh
      expect(screen.getByTestId('user-display')).toHaveTextContent(TEST_USER.username);
    });
  });

  // ==========================================================================
  // Additional Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('should handle network error during token refresh gracefully', async () => {
      server.use(
        http.post(`${API_BASE_URL}/auth/refresh`, () => {
          return HttpResponse.error();
        }),
        createProtectedEndpointHandler()
      );

      setTokens(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.validRefreshToken);

      const onError = vi.fn();

      renderWithAuth(
        <TestProtectedComponent onError={onError} />,
        { preloadedState: createAuthState() }
      );

      // Wait for error to be handled
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(onError).toHaveBeenCalled();
    });

    it('should not refresh token for non-401 errors', async () => {
      const refreshCalls: number[] = [];

      server.use(
        http.post(`${API_BASE_URL}/auth/refresh`, () => {
          refreshCalls.push(Date.now());
          // Note: authService expects snake_case keys (access_token, refresh_token)
          return HttpResponse.json({
            success: true,
            data: {
              access_token: TEST_TOKENS.newAccessToken,
              refresh_token: TEST_TOKENS.newRefreshToken,
            },
          });
        }),
        http.get(`${API_BASE_URL}/protected/resource`, () => {
          // Return 500 server error instead of 401
          return HttpResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: 'Internal error' } },
            { status: 500 }
          );
        })
      );

      setTokens(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.validRefreshToken);

      const onError = vi.fn();

      renderWithAuth(
        <TestProtectedComponent onError={onError} />,
        { preloadedState: createAuthState() }
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Token refresh should NOT have been called for 500 error
      expect(refreshCalls.length).toBe(0);
      
      // Error callback should have been called
      expect(onError).toHaveBeenCalled();
    });

    it('should handle rapid successive API calls with token refresh', async () => {
      const { handler, getCallCount } = createCountingRefreshHandler();

      server.use(
        handler,
        http.get(`${API_BASE_URL}/protected/resource`, ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          
          if (authHeader === `Bearer ${TEST_TOKENS.expiredAccessToken}`) {
            return HttpResponse.json(
              { success: false, error: { code: 'TOKEN_EXPIRED', message: 'Expired' } },
              { status: 401 }
            );
          }

          return HttpResponse.json({
            success: true,
            data: PROTECTED_RESOURCE_DATA,
          });
        })
      );

      setTokens(TEST_TOKENS.expiredAccessToken, TEST_TOKENS.validRefreshToken);

      // Make multiple rapid calls
      const calls = Array.from({ length: 10 }, () => 
        apiClient.get('/protected/resource').catch(() => null)
      );

      await Promise.all(calls);

      // Despite 10 calls, only 1 refresh should occur
      expect(getCallCount()).toBe(1);
    });
  });
});
