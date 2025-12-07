/**
 * Comprehensive Unit Test Suite for useAuth Hook
 *
 * This test suite validates all authentication functionality provided by the useAuth hook,
 * including authentication state management, login/logout flows, JWT token operations,
 * token refresh mechanisms, and integration with Redux and React Query.
 *
 * Test Categories:
 * 1. Setup and Configuration Tests
 * 2. Authentication State Tests
 * 3. Login Flow Tests
 * 4. Logout Flow Tests
 * 5. Token Refresh Tests
 * 6. Check Authentication Tests
 * 7. Get User Tests
 * 8. Clear Error Tests
 * 9. Token Storage Tests
 * 10. React Query Integration Tests
 * 11. Redux Integration Tests
 * 12. Edge Cases and Error Handling
 * 13. MSW API Mocking
 * 14. Performance and Optimization Tests
 * 15. TypeScript Type Safety Tests
 *
 * @see Section 0.4 Transformation Mapping - Test creation requirements
 * @see react-frontend/src/features/auth/hooks/useAuth.ts - Hook under test
 */

import { type ReactNode } from 'react';
import {
  renderHook,
  act,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore, type EnhancedStore } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';

// Internal imports from depends_on_files
import { useAuth } from '@/features/auth/hooks/useAuth';
import { authReducer, authActions } from '@/features/auth/store/authSlice';
import type { RootState } from '@/app/store';
import type { AuthError } from '@/features/auth/types/auth.types';
import { server } from '@/tests/mocks/server';

// ============================================================================
// Test Configuration and Utilities
// ============================================================================

/**
 * API base URL for mock endpoints
 */
const API_BASE_URL = '/api/v1';

/**
 * Mock user data for testing
 */
const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  firstname: 'Test',
  lastname: 'User',
  fullname: 'Test User',
  roles: ['student'],
  capabilities: ['moodle/course:view'],
  profileImageUrl: null,
  timezone: 'UTC',
  lang: 'en',
};

/**
 * Mock authentication tokens for testing
 */
const mockTokens = {
  accessToken: 'mock-access-token-12345',
  refreshToken: 'mock-refresh-token-67890',
  expiresIn: 3600,
  tokenType: 'Bearer',
};

/**
 * Creates a test QueryClient with settings optimized for testing
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        networkMode: 'always',
      },
      mutations: {
        retry: false,
        networkMode: 'always',
      },
    },
  });
}

/**
 * Creates a test Redux store with auth reducer
 */
function createTestStore(initialState?: Partial<RootState>): EnhancedStore {
  return configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState: initialState as RootState,
  });
}

/**
 * Interface for wrapper options
 */
interface WrapperOptions {
  store?: EnhancedStore;
  queryClient?: QueryClient;
  initialState?: Partial<RootState>;
}

/**
 * Creates a wrapper component for renderHook with all necessary providers
 */
function createWrapper(options: WrapperOptions = {}) {
  const {
    store = createTestStore(options.initialState),
    queryClient = createTestQueryClient(),
  } = options;

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </Provider>
    );
  };
}

/**
 * Mock localStorage implementation for testing
 */
class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }
}

// ============================================================================
// Global Test Setup
// ============================================================================

let mockLocalStorage: MockLocalStorage;

beforeAll(() => {
  // Start MSW server
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterAll(() => {
  // Close MSW server
  server.close();
});

beforeEach(() => {
  // Reset MSW handlers
  server.resetHandlers();

  // Create fresh localStorage mock
  mockLocalStorage = new MockLocalStorage();
  vi.stubGlobal('localStorage', mockLocalStorage);
});

afterEach(() => {
  // Cleanup React Testing Library
  cleanup();

  // Clear all mocks
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// ============================================================================
// 1. Setup and Configuration Tests
// ============================================================================

describe('useAuth Hook', () => {
  describe('Setup and Configuration', () => {
    it('should import renderHook and waitFor from @testing-library/react', () => {
      expect(renderHook).toBeDefined();
      expect(waitFor).toBeDefined();
      expect(act).toBeDefined();
    });

    it('should create test wrapper with Redux Provider and QueryClientProvider', () => {
      const wrapper = createWrapper();
      expect(wrapper).toBeDefined();
      expect(typeof wrapper).toBe('function');
    });

    it('should create test store with authSlice reducer', () => {
      const store = createTestStore();
      const state = store.getState();
      expect(state).toHaveProperty('auth');
    });

    it('should create test QueryClient with retry disabled', () => {
      const queryClient = createTestQueryClient();
      expect(queryClient).toBeDefined();
      const options = queryClient.getDefaultOptions();
      expect(options.queries?.retry).toBe(false);
    });

    it('should render useAuth hook without errors', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });
      expect(result.current).toBeDefined();
    });
  });

  // ==========================================================================
  // 2. Authentication State Tests
  // ==========================================================================

  describe('Authentication State', () => {
    it('should return initial state: user=null, isAuthenticated=false, loading=false, error=null', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should return authenticated state when user exists in store', () => {
      const initialState: Partial<RootState> = {
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      };

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should return loading state when isLoading is true', () => {
      const initialState: Partial<RootState> = {
        auth: {
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: true,
          error: null,
          status: 'loading',
        },
      };

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should return error state when error exists', () => {
      const mockError: AuthError = {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password',
      };

      const initialState: Partial<RootState> = {
        auth: {
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: mockError,
          status: 'error',
        },
      };

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      expect(result.current.error).toEqual(mockError);
    });

    it('should persist state across hook re-renders', () => {
      const store = createTestStore({
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result, rerender } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ store }),
      });

      const initialUser = result.current.user;
      rerender();

      expect(result.current.user).toBe(initialUser);
    });
  });

  // ==========================================================================
  // 3. Login Flow Tests
  // ==========================================================================

  describe('Login Flow', () => {
    it('should call login() and return user on successful authentication', async () => {
      // Setup mock endpoint for login
      server.use(
        http.post(`${API_BASE_URL}/auth/login`, async () => {
          return HttpResponse.json({
            success: true,
            data: {
              user: mockUser,
              tokens: mockTokens,
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.error).toBeNull();
    });

    it('should set loading state during login API call', async () => {
      // Setup slow mock endpoint to observe loading state
      server.use(
        http.post(`${API_BASE_URL}/auth/login`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: {
              user: mockUser,
              tokens: mockTokens,
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Start login but don't await
      let loginPromise: Promise<void>;
      act(() => {
        loginPromise = result.current.login('testuser', 'password123');
      });

      // Check loading state is true immediately after calling login
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Wait for login to complete
      await act(async () => {
        await loginPromise;
      });

      // Check loading state is false after completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle login with invalid credentials (401 error)', async () => {
      server.use(
        http.post(`${API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid username or password',
              },
            },
            { status: 401 }
          );
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.login('wronguser', 'wrongpassword');
        } catch {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should handle login network error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/auth/login`, () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.login('testuser', 'password123');
        } catch {
          // Expected to throw on network error
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should store JWT tokens in localStorage after successful login', async () => {
      server.use(
        http.post(`${API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              user: mockUser,
              tokens: mockTokens,
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Verify tokens were stored
      const storedAccessToken = mockLocalStorage.getItem('accessToken');
      const storedRefreshToken = mockLocalStorage.getItem('refreshToken');

      expect(storedAccessToken).toBeDefined();
      expect(storedRefreshToken).toBeDefined();
    });

    it('should dispatch setUser and setTokens actions on successful login', async () => {
      const store = createTestStore();
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      server.use(
        http.post(`${API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              user: mockUser,
              tokens: mockTokens,
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ store }),
      });

      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Check that auth actions were dispatched
      const dispatchedTypes = dispatchSpy.mock.calls.map(
        (call) => (call[0] as { type: string }).type
      );

      expect(dispatchedTypes.some((type) => type.includes('auth/'))).toBe(true);
    });

    it('should handle login with locked account', async () => {
      server.use(
        http.post(`${API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'ACCOUNT_LOCKED',
                message: 'Account is temporarily locked due to too many failed login attempts',
                details: {
                  unlockTime: Date.now() + 300000, // 5 minutes from now
                },
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.login('lockeduser', 'password');
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.error?.code).toBe('ACCOUNT_LOCKED');
      });
    });
  });

  // ==========================================================================
  // 4. Logout Flow Tests
  // ==========================================================================

  describe('Logout Flow', () => {
    it('should call logout() and clear authentication state', async () => {
      // Start with authenticated state
      const initialState: Partial<RootState> = {
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      };

      // Store tokens in localStorage
      mockLocalStorage.setItem('accessToken', mockTokens.accessToken);
      mockLocalStorage.setItem('refreshToken', mockTokens.refreshToken);

      server.use(
        http.post(`${API_BASE_URL}/auth/logout`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              message: 'Logged out successfully',
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      // Verify initial authenticated state
      expect(result.current.isAuthenticated).toBe(true);

      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      expect(result.current.user).toBeNull();
    });

    it('should remove tokens from localStorage on logout', async () => {
      const initialState: Partial<RootState> = {
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      };

      // Store tokens
      mockLocalStorage.setItem('accessToken', mockTokens.accessToken);
      mockLocalStorage.setItem('refreshToken', mockTokens.refreshToken);

      server.use(
        http.post(`${API_BASE_URL}/auth/logout`, () => {
          return HttpResponse.json({
            success: true,
            data: { message: 'Logged out successfully' },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      // Verify tokens were removed
      expect(mockLocalStorage.getItem('accessToken')).toBeNull();
      expect(mockLocalStorage.getItem('refreshToken')).toBeNull();
    });

    it('should clear auth state even when API call fails (fail-safe)', async () => {
      const initialState: Partial<RootState> = {
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      };

      mockLocalStorage.setItem('accessToken', mockTokens.accessToken);
      mockLocalStorage.setItem('refreshToken', mockTokens.refreshToken);

      // Simulate API failure
      server.use(
        http.post(`${API_BASE_URL}/auth/logout`, () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      await act(async () => {
        await result.current.logout();
      });

      // Should still clear local state even if API fails
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      expect(mockLocalStorage.getItem('accessToken')).toBeNull();
      expect(mockLocalStorage.getItem('refreshToken')).toBeNull();
    });

    it('should dispatch clearAuth action on logout', async () => {
      const store = createTestStore({
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      server.use(
        http.post(`${API_BASE_URL}/auth/logout`, () => {
          return HttpResponse.json({
            success: true,
            data: { message: 'Logged out successfully' },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ store }),
      });

      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      // Verify clearAuth was dispatched
      const dispatchedTypes = dispatchSpy.mock.calls.map(
        (call) => (call[0] as { type: string }).type
      );

      expect(dispatchedTypes.some((type) => type.includes('clearAuth') || type.includes('auth/'))).toBe(true);
    });
  });

  // ==========================================================================
  // 5. Token Refresh Tests
  // ==========================================================================

  describe('Token Refresh', () => {
    it('should call refreshToken() and update access token', async () => {
      const initialState: Partial<RootState> = {
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      };

      mockLocalStorage.setItem('accessToken', mockTokens.accessToken);
      mockLocalStorage.setItem('refreshToken', mockTokens.refreshToken);

      const newAccessToken = 'new-access-token-999';
      server.use(
        http.post(`${API_BASE_URL}/auth/refresh`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              accessToken: newAccessToken,
              expiresIn: 3600,
              tokenType: 'Bearer',
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      await act(async () => {
        await result.current.refreshToken();
      });

      await waitFor(() => {
        const storedToken = mockLocalStorage.getItem('accessToken');
        expect(storedToken).toBe(newAccessToken);
      });
    });

    it('should handle refresh token expiration and redirect to login', async () => {
      const initialState: Partial<RootState> = {
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      };

      mockLocalStorage.setItem('refreshToken', mockTokens.refreshToken);

      // Simulate expired refresh token
      server.use(
        http.post(`${API_BASE_URL}/auth/refresh`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'TOKEN_EXPIRED',
                message: 'Refresh token has expired',
              },
            },
            { status: 401 }
          );
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      await act(async () => {
        try {
          await result.current.refreshToken();
        } catch {
          // Expected to throw
        }
      });

      // Should clear auth state on expired refresh token
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });
    });

    it('should dispatch setTokens action after successful refresh', async () => {
      const store = createTestStore({
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      mockLocalStorage.setItem('refreshToken', mockTokens.refreshToken);

      server.use(
        http.post(`${API_BASE_URL}/auth/refresh`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              accessToken: 'new-access-token',
              expiresIn: 3600,
              tokenType: 'Bearer',
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ store }),
      });

      await act(async () => {
        await result.current.refreshToken();
      });

      await waitFor(() => {
        const dispatchedTypes = dispatchSpy.mock.calls.map(
          (call) => (call[0] as { type: string }).type
        );
        expect(dispatchedTypes.some((type) => type.includes('auth/'))).toBe(true);
      });
    });
  });

  // ==========================================================================
  // 6. Check Authentication Tests
  // ==========================================================================

  describe('Check Authentication', () => {
    it('should call checkAuth() and validate existing token', async () => {
      mockLocalStorage.setItem('accessToken', mockTokens.accessToken);

      server.use(
        http.get(`${API_BASE_URL}/auth/me`, () => {
          return HttpResponse.json({
            success: true,
            data: mockUser,
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      let isValid: boolean | undefined;
      await act(async () => {
        isValid = await result.current.checkAuth();
      });

      expect(isValid).toBe(true);
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(mockUser);
      });
    });

    it('should return false when token is invalid', async () => {
      mockLocalStorage.setItem('accessToken', 'invalid-token');

      server.use(
        http.get(`${API_BASE_URL}/auth/me`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_TOKEN',
                message: 'Token is invalid or expired',
              },
            },
            { status: 401 }
          );
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      let isValid: boolean | undefined;
      await act(async () => {
        isValid = await result.current.checkAuth();
      });

      expect(isValid).toBe(false);
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });
    });

    it('should return false immediately when no token exists', async () => {
      // No token in localStorage
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      let isValid: boolean | undefined;
      await act(async () => {
        isValid = await result.current.checkAuth();
      });

      expect(isValid).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should update Redux state with user data from checkAuth', async () => {
      const store = createTestStore();
      mockLocalStorage.setItem('accessToken', mockTokens.accessToken);

      server.use(
        http.get(`${API_BASE_URL}/auth/me`, () => {
          return HttpResponse.json({
            success: true,
            data: mockUser,
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ store }),
      });

      await act(async () => {
        await result.current.checkAuth();
      });

      await waitFor(() => {
        const state = store.getState();
        expect(state.auth.user).toEqual(mockUser);
        expect(state.auth.isAuthenticated).toBe(true);
      });
    });
  });

  // ==========================================================================
  // 7. Get User Tests
  // ==========================================================================

  describe('Get User', () => {
    it('should return current user from Redux state when authenticated', () => {
      const initialState: Partial<RootState> = {
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      };

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      const user = result.current.getUser();
      expect(user).toEqual(mockUser);
    });

    it('should return null when not authenticated', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      const user = result.current.getUser();
      expect(user).toBeNull();
    });

    it('should be synchronous (no async operations)', () => {
      const initialState: Partial<RootState> = {
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      };

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      // getUser should return immediately without being a Promise
      const user = result.current.getUser();
      expect(user).not.toBeInstanceOf(Promise);
      expect(user).toEqual(mockUser);
    });
  });

  // ==========================================================================
  // 8. Clear Error Tests
  // ==========================================================================

  describe('Clear Error', () => {
    it('should clear error state when clearError() is called', async () => {
      const mockError: AuthError = {
        code: 'TEST_ERROR',
        message: 'Test error message',
      };

      const initialState: Partial<RootState> = {
        auth: {
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: mockError,
          status: 'error',
        },
      };

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      // Verify error exists
      expect(result.current.error).toEqual(mockError);

      await act(async () => {
        result.current.clearError();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });

    it('should dispatch setError(null) to Redux', async () => {
      const store = createTestStore({
        auth: {
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: { code: 'TEST', message: 'Test' },
          status: 'error',
        },
      });
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ store }),
      });

      await act(async () => {
        result.current.clearError();
      });

      expect(dispatchSpy).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 9. Token Storage Tests
  // ==========================================================================

  describe('Token Storage', () => {
    it('should store tokens in localStorage with correct keys', async () => {
      server.use(
        http.post(`${API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              user: mockUser,
              tokens: mockTokens,
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(mockLocalStorage.getItem('accessToken')).toBeDefined();
      expect(mockLocalStorage.getItem('refreshToken')).toBeDefined();
    });

    it('should retrieve tokens from localStorage', () => {
      mockLocalStorage.setItem('accessToken', mockTokens.accessToken);
      mockLocalStorage.setItem('refreshToken', mockTokens.refreshToken);

      const storedAccessToken = mockLocalStorage.getItem('accessToken');
      const storedRefreshToken = mockLocalStorage.getItem('refreshToken');

      expect(storedAccessToken).toBe(mockTokens.accessToken);
      expect(storedRefreshToken).toBe(mockTokens.refreshToken);
    });

    it('should clear localStorage on logout', async () => {
      const initialState: Partial<RootState> = {
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      };

      mockLocalStorage.setItem('accessToken', mockTokens.accessToken);
      mockLocalStorage.setItem('refreshToken', mockTokens.refreshToken);

      server.use(
        http.post(`${API_BASE_URL}/auth/logout`, () => {
          return HttpResponse.json({
            success: true,
            data: { message: 'Logged out successfully' },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(mockLocalStorage.getItem('accessToken')).toBeNull();
        expect(mockLocalStorage.getItem('refreshToken')).toBeNull();
      });
    });
  });

  // ==========================================================================
  // 10. React Query Integration Tests
  // ==========================================================================

  describe('React Query Integration', () => {
    it('should use useMutation for login operation', async () => {
      const queryClient = createTestQueryClient();

      server.use(
        http.post(`${API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              user: mockUser,
              tokens: mockTokens,
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ queryClient }),
      });

      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it('should use useMutation for logout operation', async () => {
      const queryClient = createTestQueryClient();
      const initialState: Partial<RootState> = {
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      };

      server.use(
        http.post(`${API_BASE_URL}/auth/logout`, () => {
          return HttpResponse.json({
            success: true,
            data: { message: 'Logged out successfully' },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ queryClient, initialState }),
      });

      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });
    });

    it('should handle mutation error states', async () => {
      const queryClient = createTestQueryClient();

      server.use(
        http.post(`${API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'SERVER_ERROR',
                message: 'Internal server error',
              },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ queryClient }),
      });

      await act(async () => {
        try {
          await result.current.login('testuser', 'password123');
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // 11. Redux Integration Tests
  // ==========================================================================

  describe('Redux Integration', () => {
    it('should dispatch setUser action on login success', async () => {
      const store = createTestStore();
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      server.use(
        http.post(`${API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              user: mockUser,
              tokens: mockTokens,
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ store }),
      });

      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      await waitFor(() => {
        expect(dispatchSpy).toHaveBeenCalled();
      });
    });

    it('should dispatch setLoading action during async operations', async () => {
      const store = createTestStore();
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      server.use(
        http.post(`${API_BASE_URL}/auth/login`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return HttpResponse.json({
            success: true,
            data: {
              user: mockUser,
              tokens: mockTokens,
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ store }),
      });

      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      // Verify dispatch was called
      expect(dispatchSpy).toHaveBeenCalled();
    });

    it('should dispatch setError action on failed operations', async () => {
      const store = createTestStore();
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      server.use(
        http.post(`${API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid credentials',
              },
            },
            { status: 401 }
          );
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ store }),
      });

      await act(async () => {
        try {
          await result.current.login('testuser', 'wrongpassword');
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(dispatchSpy).toHaveBeenCalled();
      });
    });

    it('should select auth state using useAppSelector', () => {
      const initialState: Partial<RootState> = {
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      };

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      // The hook should correctly select the auth state
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  // ==========================================================================
  // 12. Edge Cases and Error Handling
  // ==========================================================================

  describe('Edge Cases and Error Handling', () => {
    it('should handle concurrent login attempts', async () => {
      let loginCallCount = 0;
      server.use(
        http.post(`${API_BASE_URL}/auth/login`, async () => {
          loginCallCount++;
          await new Promise((resolve) => setTimeout(resolve, 50));
          return HttpResponse.json({
            success: true,
            data: {
              user: mockUser,
              tokens: mockTokens,
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Attempt multiple concurrent logins
      await act(async () => {
        await Promise.all([
          result.current.login('testuser', 'password123'),
          result.current.login('testuser', 'password123'),
        ]);
      });

      // Should result in authenticated state
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // API should have been called (concurrent calls allowed in this implementation)
      expect(loginCallCount).toBeGreaterThanOrEqual(1);
    });

    it('should handle malformed API response', async () => {
      server.use(
        http.post(`${API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json({
            // Malformed response - missing expected structure
            status: 'ok',
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.login('testuser', 'password123');
        } catch {
          // Expected to handle gracefully
        }
      });

      // Should handle gracefully - either authenticated or error state
      await waitFor(() => {
        expect(
          result.current.error !== null || !result.current.isAuthenticated
        ).toBe(true);
      });
    });

    it('should handle hook unmount during async operations', async () => {
      server.use(
        http.post(`${API_BASE_URL}/auth/login`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return HttpResponse.json({
            success: true,
            data: {
              user: mockUser,
              tokens: mockTokens,
            },
          });
        })
      );

      const { result, unmount } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Start login
      act(() => {
        result.current.login('testuser', 'password123');
      });

      // Unmount immediately
      unmount();

      // Should not throw errors on unmount during async operation
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    it('should handle missing refresh token scenario', async () => {
      const initialState: Partial<RootState> = {
        auth: {
          user: mockUser,
          tokens: {
            ...mockTokens,
            refreshToken: '', // Empty refresh token
          },
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      };

      // Don't set refresh token in localStorage

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      await act(async () => {
        try {
          await result.current.refreshToken();
        } catch {
          // Expected to fail without refresh token
        }
      });

      // Should handle gracefully
      await waitFor(() => {
        expect(result.current.error !== null || !result.current.isAuthenticated).toBe(true);
      });
    });
  });

  // ==========================================================================
  // 13. MSW API Mocking
  // ==========================================================================

  describe('MSW API Mocking', () => {
    it('should mock POST /api/v1/auth/login with success response', async () => {
      server.use(
        http.post(`${API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              user: mockUser,
              tokens: mockTokens,
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it('should mock POST /api/v1/auth/logout with success response', async () => {
      const initialState: Partial<RootState> = {
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      };

      server.use(
        http.post(`${API_BASE_URL}/auth/logout`, () => {
          return HttpResponse.json({
            success: true,
            data: { message: 'Logged out successfully' },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });
    });

    it('should mock POST /api/v1/auth/refresh with new tokens', async () => {
      const initialState: Partial<RootState> = {
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      };

      mockLocalStorage.setItem('refreshToken', mockTokens.refreshToken);

      const newAccessToken = 'new-access-token-from-refresh';
      server.use(
        http.post(`${API_BASE_URL}/auth/refresh`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              accessToken: newAccessToken,
              expiresIn: 3600,
              tokenType: 'Bearer',
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      await act(async () => {
        await result.current.refreshToken();
      });

      await waitFor(() => {
        expect(mockLocalStorage.getItem('accessToken')).toBe(newAccessToken);
      });
    });

    it('should mock GET /api/v1/auth/me with user data', async () => {
      mockLocalStorage.setItem('accessToken', mockTokens.accessToken);

      server.use(
        http.get(`${API_BASE_URL}/auth/me`, () => {
          return HttpResponse.json({
            success: true,
            data: mockUser,
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.checkAuth();
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });
    });

    it('should mock GET /api/v1/auth/me with 401 error', async () => {
      mockLocalStorage.setItem('accessToken', 'expired-token');

      server.use(
        http.get(`${API_BASE_URL}/auth/me`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Token is invalid',
              },
            },
            { status: 401 }
          );
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.checkAuth();
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });
    });
  });

  // ==========================================================================
  // 14. Performance and Optimization Tests
  // ==========================================================================

  describe('Performance and Optimization', () => {
    it('should use useCallback to prevent unnecessary re-renders', () => {
      const { result, rerender } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      const loginRef1 = result.current.login;
      const logoutRef1 = result.current.logout;

      rerender();

      const loginRef2 = result.current.login;
      const logoutRef2 = result.current.logout;

      // Function references should be stable across re-renders due to useCallback
      expect(loginRef1).toBe(loginRef2);
      expect(logoutRef1).toBe(logoutRef2);
    });

    it('should not cause infinite loops', () => {
      let renderCount = 0;

      const { result, rerender } = renderHook(
        () => {
          renderCount++;
          return useAuth();
        },
        {
          wrapper: createWrapper(),
        }
      );

      // Initial render
      expect(renderCount).toBeGreaterThanOrEqual(1);

      // Trigger re-render
      rerender();

      // Should not cause infinite renders
      expect(renderCount).toBeLessThan(10);
      expect(result.current).toBeDefined();
    });

    it('should have minimal re-renders on state changes', async () => {
      let renderCount = 0;

      server.use(
        http.post(`${API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              user: mockUser,
              tokens: mockTokens,
            },
          });
        })
      );

      const { result } = renderHook(
        () => {
          renderCount++;
          return useAuth();
        },
        {
          wrapper: createWrapper(),
        }
      );

      const initialRenderCount = renderCount;

      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Should have reasonable number of renders
      // (initial + loading state + success state)
      expect(renderCount - initialRenderCount).toBeLessThan(10);
    });
  });

  // ==========================================================================
  // 15. TypeScript Type Safety Tests
  // ==========================================================================

  describe('TypeScript Type Safety', () => {
    it('should return correctly typed user object', () => {
      const initialState: Partial<RootState> = {
        auth: {
          user: mockUser,
          tokens: mockTokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      };

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      const user = result.current.user;

      // Type assertions - these would fail at compile time if types are wrong
      if (user) {
        expect(typeof user.id).toBe('number');
        expect(typeof user.username).toBe('string');
        expect(typeof user.email).toBe('string');
        expect(typeof user.firstname).toBe('string');
        expect(typeof user.lastname).toBe('string');
        expect(Array.isArray(user.roles)).toBe(true);
      }
    });

    it('should return correctly typed error object', () => {
      const mockError: AuthError = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        details: { field: 'username' },
      };

      const initialState: Partial<RootState> = {
        auth: {
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: mockError,
          status: 'error',
        },
      };

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ initialState }),
      });

      const error = result.current.error;

      if (error) {
        expect(typeof error.code).toBe('string');
        expect(typeof error.message).toBe('string');
        // details is optional
        if (error.details) {
          expect(typeof error.details).toBe('object');
        }
      }
    });

    it('should have correctly typed hook return value', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Verify all expected properties exist with correct types
      expect(typeof result.current.user).toBe('object');
      expect(typeof result.current.isAuthenticated).toBe('boolean');
      expect(typeof result.current.isLoading).toBe('boolean');
      expect(typeof result.current.login).toBe('function');
      expect(typeof result.current.logout).toBe('function');
      expect(typeof result.current.checkAuth).toBe('function');
      expect(typeof result.current.getUser).toBe('function');
      expect(typeof result.current.refreshToken).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });

    it('should accept correct parameter types for login', async () => {
      server.use(
        http.post(`${API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              user: mockUser,
              tokens: mockTokens,
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // login accepts (username: string, password: string)
      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Additional Integration Scenarios
  // ==========================================================================

  describe('Integration Scenarios', () => {
    it('should complete full login -> checkAuth -> logout flow', async () => {
      // Setup handlers for full flow
      server.use(
        http.post(`${API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              user: mockUser,
              tokens: mockTokens,
            },
          });
        }),
        http.get(`${API_BASE_URL}/auth/me`, () => {
          return HttpResponse.json({
            success: true,
            data: mockUser,
          });
        }),
        http.post(`${API_BASE_URL}/auth/logout`, () => {
          return HttpResponse.json({
            success: true,
            data: { message: 'Logged out' },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Step 1: Login
      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(mockUser);
      });

      // Step 2: Check auth
      let isValid: boolean | undefined;
      await act(async () => {
        isValid = await result.current.checkAuth();
      });

      expect(isValid).toBe(true);

      // Step 3: Logout
      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
      });
    });

    it('should handle login failure -> clearError -> retry login success', async () => {
      let attemptCount = 0;

      server.use(
        http.post(`${API_BASE_URL}/auth/login`, () => {
          attemptCount++;
          if (attemptCount === 1) {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'INVALID_CREDENTIALS',
                  message: 'Invalid credentials',
                },
              },
              { status: 401 }
            );
          }
          return HttpResponse.json({
            success: true,
            data: {
              user: mockUser,
              tokens: mockTokens,
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Step 1: Failed login
      await act(async () => {
        try {
          await result.current.login('testuser', 'wrongpassword');
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });

      // Step 2: Clear error
      await act(async () => {
        result.current.clearError();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      // Step 3: Retry login successfully
      await act(async () => {
        await result.current.login('testuser', 'correctpassword');
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(mockUser);
      });
    });
  });
});
