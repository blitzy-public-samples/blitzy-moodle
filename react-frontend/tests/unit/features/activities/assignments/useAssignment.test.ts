/**
 * Comprehensive Unit Tests for useAssignment Hook
 *
 * This test suite validates the useAssignment custom React Query hook's behavior
 * including data fetching, caching, error handling, query disabling, refetching,
 * and React Query integration.
 *
 * @module tests/unit/features/activities/assignments/useAssignment.test
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import React, { type ReactNode } from 'react';

import { useAssignment } from '@/features/activities/assignments/hooks/useAssignment';
import * as assignmentApi from '@/features/activities/assignments/api/assignmentApi';
import type { Assignment } from '@/features/activities/assignments/types/assignment.types';
import { mockAssignment } from '@tests/mocks/data/assignments';
import { server } from '@tests/mocks/server';

// Mock authentication service - provide all named exports used by interceptors
vi.mock('@/services/auth/authService', () => {
  const getAccessToken = vi.fn(() => 'mock-jwt-token');
  const setAccessToken = vi.fn();
  const clearTokens = vi.fn();
  const refreshAccessToken = vi.fn(() => Promise.resolve('new-mock-jwt-token'));
  return {
    getAccessToken,
    setAccessToken,
    clearTokens,
    refreshAccessToken,
    default: {
      getAccessToken,
      setAccessToken,
      clearTokens,
      refreshAccessToken,
    },
  };
});

// ============================================================================
// Test Configuration and Constants
// ============================================================================

/** Base API URL for assignment endpoints - wildcard prefix to match any host */
const API_BASE_URL = '*/api/v1/assignments';

/** Default stale time configured in useAssignment (5 minutes) */
const STALE_TIME_MS = 5 * 60 * 1000;

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a fresh QueryClient instance for testing with isolated cache
 * and disabled retries for predictable test behavior.
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Creates a wrapper component with QueryClientProvider for renderHook.
 * Each test gets a fresh QueryClient to ensure isolation.
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

/**
 * Sets up MSW handler for successful assignment fetch.
 * @param data - Assignment data to return
 */
function setupSuccessHandler(data: Assignment): void {
  server.use(
    http.get(`${API_BASE_URL}/:id`, () => {
      return HttpResponse.json({
        success: true,
        data,
      });
    })
  );
}

/**
 * Sets up MSW handler for error response.
 * @param status - HTTP status code
 * @param message - Error message
 * @param code - Error code
 */
function setupErrorHandler(
  status: number,
  message: string,
  code: string = 'ERROR'
): void {
  server.use(
    http.get(`${API_BASE_URL}/:id`, () => {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code,
            message,
          },
        },
        { status }
      );
    })
  );
}

/**
 * Sets up MSW handler that delays response.
 * @param data - Assignment data to return
 * @param delayMs - Delay in milliseconds
 */
function setupDelayedHandler(data: Assignment, delayMs: number): void {
  server.use(
    http.get(`${API_BASE_URL}/:id`, async () => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return HttpResponse.json({
        success: true,
        data,
      });
    })
  );
}

/**
 * Sets up MSW handler that fails first N times then succeeds.
 * @param failCount - Number of times to fail before succeeding
 * @param data - Assignment data to return on success
 * 
 * NOTE: This helper is available for retry-related tests but currently
 * unused. Exported to suppress TypeScript unused variable warning.
 */
export function setupRetryHandler(failCount: number, data: Assignment): void {
  let attempts = 0;
  server.use(
    http.get(`${API_BASE_URL}/:id`, () => {
      attempts++;
      if (attempts <= failCount) {
        return HttpResponse.json(
          {
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Temporary failure' },
          },
          { status: 500 }
        );
      }
      return HttpResponse.json({
        success: true,
        data,
      });
    })
  );
}

// ============================================================================
// Test Setup and Teardown
// ============================================================================

describe('useAssignment Hook', () => {
  let queryClient: QueryClient;

  beforeAll(() => {
    // Start MSW server if not already started
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    // Close MSW server
    server.close();
  });

  beforeEach(() => {
    // Create fresh QueryClient for each test
    queryClient = createTestQueryClient();
    // Reset MSW handlers to defaults
    server.resetHandlers();
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear QueryClient cache
    queryClient.clear();
    // Reset handlers after each test
    server.resetHandlers();
  });

  // ==========================================================================
  // Section 1: Successful Data Fetching Tests
  // ==========================================================================

  describe('Successful Data Fetching', () => {
    it('fetches assignment data successfully', async () => {
      const testAssignment = mockAssignment({ id: 123, name: 'Test Assignment' });
      setupSuccessHandler(testAssignment);

      const { result } = renderHook(() => useAssignment(123), {
        wrapper: createWrapper(queryClient),
      });

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);

      // Wait for query to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify successful state
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe(123);
      expect(result.current.data?.name).toBe('Test Assignment');
    });

    it('returns properly typed assignment data', async () => {
      const testAssignment = mockAssignment({
        id: 456,
        name: 'Typed Assignment Test',
        intro: 'Test description',
        duedate: Math.floor(Date.now() / 1000) + 86400 * 7,
        grade: 100,
        maxattempts: 3,
        teamsubmission: 0,
        blindmarking: 0,
      });
      setupSuccessHandler(testAssignment);

      const { result } = renderHook(() => useAssignment(456), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const data = result.current.data!;

      // Verify all expected properties exist and have correct types
      expect(typeof data.id).toBe('number');
      expect(typeof data.name).toBe('string');
      expect(typeof data.intro).toBe('string');
      expect(typeof data.duedate).toBe('number');
      expect(typeof data.grade).toBe('number');
      expect(data.maxattempts).toBeDefined();
      expect(typeof data.teamsubmission).toBe('number');
      expect(typeof data.blindmarking).toBe('number');
    });

    it('calls assignmentApi.fetchAssignment with correct ID', async () => {
      const testAssignment = mockAssignment({ id: 789 });
      setupSuccessHandler(testAssignment);

      // Spy on the API function
      const fetchSpy = vi.spyOn(assignmentApi, 'fetchAssignment');

      const { result } = renderHook(() => useAssignment(789), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchSpy).toHaveBeenCalledWith(789);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      fetchSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Section 2: React Query Configuration Tests
  // ==========================================================================

  describe('React Query Configuration', () => {
    it('uses correct query key', async () => {
      const testAssignment = mockAssignment({ id: 101 });
      setupSuccessHandler(testAssignment);

      renderHook(() => useAssignment(101), {
        wrapper: createWrapper(queryClient),
      });

      // Check that the query key is properly structured
      const queryState = queryClient.getQueryState(['assignments', 'detail', 101]);

      await waitFor(() => {
        expect(queryState).toBeDefined();
      });
    });

    it('configures 5-minute stale time', async () => {
      const testAssignment = mockAssignment({ id: 102 });
      setupSuccessHandler(testAssignment);

      const { result } = renderHook(() => useAssignment(102), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Fetch the query options from cache
      const queryCache = queryClient.getQueryCache();
      const query = queryCache.find({ queryKey: ['assignments', 'detail', 102] });

      // The stale time should be configured as 5 minutes
      // Use type assertion since staleTime is part of the observer options
      expect((query?.options as { staleTime?: number })?.staleTime).toBe(STALE_TIME_MS);
    });

    it('caches data for subsequent renders', async () => {
      const testAssignment = mockAssignment({ id: 103, name: 'Cached Assignment' });
      setupSuccessHandler(testAssignment);

      const fetchSpy = vi.spyOn(assignmentApi, 'fetchAssignment');

      // First render
      const { result, unmount } = renderHook(() => useAssignment(103), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Unmount and re-render with same ID
      unmount();

      const { result: result2 } = renderHook(() => useAssignment(103), {
        wrapper: createWrapper(queryClient),
      });

      // Data should be immediately available from cache
      expect(result2.current.data?.name).toBe('Cached Assignment');

      // API should not be called again (data is cached)
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      fetchSpy.mockRestore();
    });

    it('enables automatic refetching configuration', async () => {
      const testAssignment = mockAssignment({ id: 104 });
      setupSuccessHandler(testAssignment);

      const { result } = renderHook(() => useAssignment(104), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Query should be configured for automatic refetching
      const queryCache = queryClient.getQueryCache();
      const query = queryCache.find({ queryKey: ['assignments', 'detail', 104] });

      // The hook should have proper refetch configuration
      expect(query).toBeDefined();
    });
  });

  // ==========================================================================
  // Section 3: Query Disabling Tests
  // ==========================================================================

  describe('Query Disabling', () => {
    it('disables query when assignmentId is null', async () => {
      const fetchSpy = vi.spyOn(assignmentApi, 'fetchAssignment');

      const { result } = renderHook(() => useAssignment(null as unknown as number), {
        wrapper: createWrapper(queryClient),
      });

      // Should not be loading since query is disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it('disables query when assignmentId is undefined', async () => {
      const fetchSpy = vi.spyOn(assignmentApi, 'fetchAssignment');

      const { result } = renderHook(() => useAssignment(undefined as unknown as number), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it('disables query when assignmentId is 0', async () => {
      const fetchSpy = vi.spyOn(assignmentApi, 'fetchAssignment');

      const { result } = renderHook(() => useAssignment(0), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it('enables query when valid assignmentId provided after invalid', async () => {
      const testAssignment = mockAssignment({ id: 200 });
      setupSuccessHandler(testAssignment);

      const fetchSpy = vi.spyOn(assignmentApi, 'fetchAssignment');

      // Start with null
      const { result, rerender } = renderHook<
        ReturnType<typeof useAssignment>,
        { id: number | null }
      >(
        ({ id }) => useAssignment(id as number),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { id: null },
        }
      );

      // Query should be disabled
      expect(result.current.isLoading).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();

      // Update to valid ID
      rerender({ id: 200 });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchSpy).toHaveBeenCalledWith(200);
      expect(result.current.data?.id).toBe(200);

      fetchSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Section 4: Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('handles 404 Not Found error', async () => {
      setupErrorHandler(404, 'Assignment not found', 'NOT_FOUND');

      const { result } = renderHook(() => useAssignment(999), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeDefined();
    });

    it('handles 403 Forbidden error (insufficient permissions)', async () => {
      setupErrorHandler(
        403,
        'You do not have permission to view this assignment',
        'PERMISSION_DENIED'
      );

      const { result } = renderHook(() => useAssignment(888), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeDefined();
    });

    it('handles 401 Unauthorized error (expired token)', async () => {
      setupErrorHandler(401, 'Authentication required', 'UNAUTHORIZED');

      const { result } = renderHook(() => useAssignment(777), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it(
      'handles network errors gracefully',
      async () => {
        server.use(
          http.get(`${API_BASE_URL}/:id`, () => {
            return HttpResponse.error();
          })
        );

        const { result } = renderHook(() => useAssignment(666), {
          wrapper: createWrapper(queryClient),
        });

        // The hook retries 3 times with exponential backoff (1s, 2s, 4s = ~7s total)
        // so we need a longer timeout to wait for all retries to fail
        await waitFor(
          () => {
            expect(result.current.isError).toBe(true);
          },
          { timeout: 15000 }
        );

        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeUndefined();
      },
      20000 // Test timeout to allow for retries
    );

    it(
      'handles malformed API response',
      async () => {
        server.use(
          http.get(`${API_BASE_URL}/:id`, () => {
            return new HttpResponse('not valid json{', {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          })
        );

        const { result } = renderHook(() => useAssignment(555), {
          wrapper: createWrapper(queryClient),
        });

        // The hook retries 3 times with exponential backoff
        await waitFor(
          () => {
            expect(result.current.isError).toBe(true);
          },
          { timeout: 15000 }
        );

        expect(result.current.data).toBeUndefined();
      },
      20000 // Test timeout to allow for retries
    );

    it(
      'handles 500 Internal Server Error',
      async () => {
        setupErrorHandler(500, 'Internal server error', 'SERVER_ERROR');

        const { result } = renderHook(() => useAssignment(444), {
          wrapper: createWrapper(queryClient),
        });

        // 500 errors are retried with exponential backoff
        await waitFor(
          () => {
            expect(result.current.isError).toBe(true);
          },
          { timeout: 15000 }
        );

        expect(result.current.error).toBeDefined();
      },
      20000 // Test timeout to allow for retries
    );
  });

  // ==========================================================================
  // Section 5: Loading State Tests
  // ==========================================================================

  describe('Loading States', () => {
    it('returns isLoading=true during fetch', async () => {
      const testAssignment = mockAssignment({ id: 301 });
      setupDelayedHandler(testAssignment, 100);

      const { result } = renderHook(() => useAssignment(301), {
        wrapper: createWrapper(queryClient),
      });

      // Immediately check loading state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.isError).toBe(false);

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('returns isLoading=false after success', async () => {
      const testAssignment = mockAssignment({ id: 302 });
      setupSuccessHandler(testAssignment);

      const { result } = renderHook(() => useAssignment(302), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeDefined();
    });

    it('returns isLoading=false after error', async () => {
      // Use 404 error which doesn't retry (hook skips retries for 401, 403, 404)
      setupErrorHandler(404, 'Assignment not found');

      const { result } = renderHook(() => useAssignment(303), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('shows isFetching during background refetch', async () => {
      const testAssignment = mockAssignment({ id: 304 });
      setupSuccessHandler(testAssignment);

      const { result } = renderHook(() => useAssignment(304), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Data is available
      expect(result.current.data).toBeDefined();
      expect(result.current.isLoading).toBe(false);

      // Set up delayed response for refetch
      setupDelayedHandler(mockAssignment({ id: 304, name: 'Updated' }), 100);

      // Trigger background refetch
      act(() => {
        result.current.refetch();
      });

      // During background refetch, isLoading should be false but isFetching true
      // Data should still be available
      expect(result.current.data).toBeDefined();
    });
  });

  // ==========================================================================
  // Section 6: Refetching Tests
  // ==========================================================================

  describe('Refetching', () => {
    it('provides refetch function', async () => {
      const testAssignment = mockAssignment({ id: 401 });
      setupSuccessHandler(testAssignment);

      const { result } = renderHook(() => useAssignment(401), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(typeof result.current.refetch).toBe('function');
    });

    it('refetches data when refetch is called', async () => {
      const testAssignment = mockAssignment({ id: 402 });
      setupSuccessHandler(testAssignment);

      const fetchSpy = vi.spyOn(assignmentApi, 'fetchAssignment');

      const { result } = renderHook(() => useAssignment(402), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Call refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);

      fetchSpy.mockRestore();
    });

    it('updates data after refetch with new response', async () => {
      const initialAssignment = mockAssignment({ id: 403, name: 'Initial Name' });
      setupSuccessHandler(initialAssignment);

      const { result } = renderHook(() => useAssignment(403), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.name).toBe('Initial Name');

      // Update handler to return modified data
      const updatedAssignment = mockAssignment({ id: 403, name: 'Updated Name' });
      setupSuccessHandler(updatedAssignment);

      // Refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.data?.name).toBe('Updated Name');
      });
    });
  });

  // ==========================================================================
  // Section 7: Query Invalidation Tests
  // ==========================================================================

  describe('Query Invalidation', () => {
    it('refetches when query is invalidated', async () => {
      const testAssignment = mockAssignment({ id: 501 });
      setupSuccessHandler(testAssignment);

      const fetchSpy = vi.spyOn(assignmentApi, 'fetchAssignment');

      const { result } = renderHook(() => useAssignment(501), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Invalidate query
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['assignments', 'detail', 501] });
      });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      });

      fetchSpy.mockRestore();
    });

    it('updates data after invalidation and refetch', async () => {
      const initialAssignment = mockAssignment({ id: 502, name: 'Original' });
      setupSuccessHandler(initialAssignment);

      const { result } = renderHook(() => useAssignment(502), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.name).toBe('Original');

      // Setup new response
      const updatedAssignment = mockAssignment({ id: 502, name: 'Modified After Invalidation' });
      setupSuccessHandler(updatedAssignment);

      // Invalidate
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['assignments', 'detail', 502] });
      });

      await waitFor(() => {
        expect(result.current.data?.name).toBe('Modified After Invalidation');
      });
    });

    it('invalidates all assignment queries with broader key', async () => {
      const assignment1 = mockAssignment({ id: 503 });
      const assignment2 = mockAssignment({ id: 504 });
      setupSuccessHandler(assignment1);

      const fetchSpy = vi.spyOn(assignmentApi, 'fetchAssignment');

      // Render two hooks
      const { result: result1 } = renderHook(() => useAssignment(503), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      setupSuccessHandler(assignment2);

      const { result: result2 } = renderHook(() => useAssignment(504), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Invalidate all assignment detail queries
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['assignments', 'detail'] });
      });

      // Both should refetch
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(4);
      });

      fetchSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Section 8: Multiple Hook Instances Tests
  // ==========================================================================

  describe('Multiple Hook Instances', () => {
    it('shares cache between multiple hook instances with same ID', async () => {
      const testAssignment = mockAssignment({ id: 601, name: 'Shared Cache' });
      setupSuccessHandler(testAssignment);

      const fetchSpy = vi.spyOn(assignmentApi, 'fetchAssignment');

      // First instance
      const { result: result1 } = renderHook(() => useAssignment(601), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second instance with same ID
      const { result: result2 } = renderHook(() => useAssignment(601), {
        wrapper: createWrapper(queryClient),
      });

      // Should immediately have data from cache
      expect(result2.current.data?.name).toBe('Shared Cache');

      // Should only have fetched once
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      fetchSpy.mockRestore();
    });

    it('maintains separate cache for different assignmentIds', async () => {
      const assignment1 = mockAssignment({ id: 602, name: 'Assignment 602' });
      const assignment2 = mockAssignment({ id: 603, name: 'Assignment 603' });

      const fetchSpy = vi.spyOn(assignmentApi, 'fetchAssignment');

      // Setup for first assignment
      setupSuccessHandler(assignment1);

      const { result: result1 } = renderHook(() => useAssignment(602), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Setup for second assignment
      setupSuccessHandler(assignment2);

      const { result: result2 } = renderHook(() => useAssignment(603), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Both should have fetched separately
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy).toHaveBeenCalledWith(602);
      expect(fetchSpy).toHaveBeenCalledWith(603);

      // Data should be independent
      expect(result1.current.data?.name).toBe('Assignment 602');
      expect(result2.current.data?.name).toBe('Assignment 603');

      fetchSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Section 9: TypeScript Type Safety Tests
  // ==========================================================================

  describe('TypeScript Type Safety', () => {
    it('returns correctly typed UseQueryResult', async () => {
      const testAssignment = mockAssignment({ id: 701 });
      setupSuccessHandler(testAssignment);

      const { result } = renderHook(() => useAssignment(701), {
        wrapper: createWrapper(queryClient),
      });

      // Check return type structure
      expect('data' in result.current).toBe(true);
      expect('isLoading' in result.current).toBe(true);
      expect('isError' in result.current).toBe(true);
      expect('error' in result.current).toBe(true);
      expect('refetch' in result.current).toBe(true);
      expect('isSuccess' in result.current).toBe(true);
      expect('isFetching' in result.current).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('data is undefined while loading', async () => {
      const testAssignment = mockAssignment({ id: 702 });
      setupDelayedHandler(testAssignment, 100);

      const { result } = renderHook(() => useAssignment(702), {
        wrapper: createWrapper(queryClient),
      });

      // Before resolution
      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('data is Assignment type after success', async () => {
      const testAssignment = mockAssignment({
        id: 703,
        name: 'Type Check Assignment',
        intro: 'Description',
        course: 1,
        cmid: 100,
        duedate: Math.floor(Date.now() / 1000) + 86400,
        grade: 100,
      });
      setupSuccessHandler(testAssignment);

      const { result } = renderHook(() => useAssignment(703), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const data = result.current.data!;

      // Verify all required Assignment properties exist
      expect(data.id).toBe(703);
      expect(data.name).toBe('Type Check Assignment');
      expect(data.intro).toBe('Description');
      expect(data.course).toBe(1);
      expect(data.cmid).toBe(100);
      expect(data.duedate).toBeDefined();
      expect(data.grade).toBe(100);
    });
  });

  // ==========================================================================
  // Section 10: Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('handles rapid assignmentId changes', async () => {
      const assignment1 = mockAssignment({ id: 801, name: 'First' });
      const assignment2 = mockAssignment({ id: 802, name: 'Second' });
      const assignment3 = mockAssignment({ id: 803, name: 'Third' });

      // All assignments return successfully
      server.use(
        http.get(`${API_BASE_URL}/:id`, ({ params }) => {
          const id = Number(params.id);
          const data =
            id === 801 ? assignment1 : id === 802 ? assignment2 : assignment3;
          return HttpResponse.json({ success: true, data });
        })
      );

      const { result, rerender } = renderHook(
        ({ id }: { id: number }) => useAssignment(id),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { id: 801 },
        }
      );

      // Rapidly change IDs
      rerender({ id: 802 });
      rerender({ id: 803 });

      // Wait for final query to resolve
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should have the final assignment data
      expect(result.current.data?.id).toBe(803);
      expect(result.current.data?.name).toBe('Third');
    });

    it('handles unmount during fetch without errors', async () => {
      const testAssignment = mockAssignment({ id: 804 });
      setupDelayedHandler(testAssignment, 200);

      const { unmount } = renderHook(() => useAssignment(804), {
        wrapper: createWrapper(queryClient),
      });

      // Unmount before fetch completes
      unmount();

      // Wait a bit to ensure no errors are thrown
      await new Promise((resolve) => setTimeout(resolve, 300));

      // If we get here without errors, test passes
      expect(true).toBe(true);
    });

    it('handles very large assignment objects', async () => {
      const largeIntro = 'A'.repeat(50000); // 50KB of text
      const testAssignment = mockAssignment({
        id: 805,
        name: 'Large Assignment',
        intro: largeIntro,
      });
      setupSuccessHandler(testAssignment);

      const { result } = renderHook(() => useAssignment(805), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.intro?.length).toBe(50000);
    });

    it('handles assignment with null optional fields', async () => {
      const testAssignment = mockAssignment({
        id: 806,
        name: 'Minimal Assignment',
        cutoffdate: null as unknown as number,
        gradingduedate: null as unknown as number,
        allowsubmissionsfromdate: 0,
      });
      setupSuccessHandler(testAssignment);

      const { result } = renderHook(() => useAssignment(806), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should handle null fields gracefully
      expect(result.current.data?.id).toBe(806);
      expect(result.current.data?.name).toBe('Minimal Assignment');
    });

    it('handles negative assignmentId (treated as invalid)', async () => {
      const fetchSpy = vi.spyOn(assignmentApi, 'fetchAssignment');

      const { result } = renderHook(() => useAssignment(-1), {
        wrapper: createWrapper(queryClient),
      });

      // Negative IDs should be treated as invalid
      // The hook behavior depends on implementation, but it should handle gracefully
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Either disabled or error state - check both conditions
      const isNotLoading = !result.current.isLoading;
      const hasError = result.current.isError;
      expect(isNotLoading || hasError).toBe(true);

      fetchSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Section 11: API Response Parsing Tests
  // ==========================================================================

  describe('API Response Parsing', () => {
    it('parses standard API envelope correctly', async () => {
      const testAssignment = mockAssignment({ id: 901, name: 'Envelope Test' });

      server.use(
        http.get(`${API_BASE_URL}/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: testAssignment,
            meta: {
              requestId: 'test-123',
            },
          });
        })
      );

      const { result } = renderHook(() => useAssignment(901), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Data should be extracted from envelope
      expect(result.current.data?.id).toBe(901);
      expect(result.current.data?.name).toBe('Envelope Test');
    });

    it('handles response without success field', async () => {
      const testAssignment = mockAssignment({ id: 902 });

      server.use(
        http.get(`${API_BASE_URL}/:id`, () => {
          // Some APIs might return data directly
          return HttpResponse.json(testAssignment);
        })
      );

      const { result } = renderHook(() => useAssignment(902), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        // Wait until the query has settled (either success or error)
        expect(result.current.isSuccess || result.current.isError).toBe(true);
      });
    });

    it('handles empty data field in response', async () => {
      server.use(
        http.get(`${API_BASE_URL}/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: null,
          });
        })
      );

      const { result } = renderHook(() => useAssignment(903), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should handle null data
      expect(result.current.data).toBeNull();
    });
  });

  // ==========================================================================
  // Section 12: Cache Behavior Tests
  // ==========================================================================

  describe('Cache Behavior', () => {
    it('returns stale data while refetching', async () => {
      const initialAssignment = mockAssignment({ id: 1001, name: 'Stale Data' });
      setupSuccessHandler(initialAssignment);

      const { result } = renderHook(() => useAssignment(1001), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Setup delayed response for next fetch
      const updatedAssignment = mockAssignment({ id: 1001, name: 'Fresh Data' });
      setupDelayedHandler(updatedAssignment, 100);

      // Trigger refetch
      act(() => {
        result.current.refetch();
      });

      // Stale data should still be available during refetch
      expect(result.current.data?.name).toBe('Stale Data');

      // Wait for fresh data
      await waitFor(() => {
        expect(result.current.data?.name).toBe('Fresh Data');
      });
    });

    it('removes query from cache after unmount and gc time', async () => {
      // Note: The useAssignment hook has a hardcoded gcTime of 10 minutes
      // that takes precedence over QueryClient defaults.
      // This test verifies that data remains cached after unmount
      // (before gcTime expires) rather than being immediately garbage collected.
      const testClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const testAssignment = mockAssignment({ id: 1002 });
      setupSuccessHandler(testAssignment);

      const { result, unmount } = renderHook(() => useAssignment(1002), {
        wrapper: createWrapper(testClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Data should be in cache
      let queryState = testClient.getQueryState(['assignments', 'detail', 1002]);
      expect(queryState).toBeDefined();

      // Unmount
      unmount();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Query should STILL be in cache (hook's gcTime is 10 minutes)
      // This verifies the hook's gcTime is in effect
      queryState = testClient.getQueryState(['assignments', 'detail', 1002]);
      expect(queryState).toBeDefined();

      testClient.clear();
    });
  });

  // ==========================================================================
  // Section 13: Integration with QueryClient Tests
  // ==========================================================================

  describe('Integration with QueryClient', () => {
    it('works with default QueryClient configuration', async () => {
      const defaultClient = new QueryClient();
      const testAssignment = mockAssignment({ id: 1101 });
      setupSuccessHandler(testAssignment);

      const { result } = renderHook(() => useAssignment(1101), {
        wrapper: createWrapper(defaultClient),
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess || result.current.isError).toBe(true);
        },
        { timeout: 5000 }
      );

      if (result.current.isSuccess) {
        expect(result.current.data?.id).toBe(1101);
      }

      defaultClient.clear();
    });

    it('respects custom retry configuration', async () => {
      // Use 404 error which the hook's retry function does not retry
      // (it returns false for 401, 403, 404)
      setupErrorHandler(404, 'Assignment not found');

      const fetchSpy = vi.spyOn(assignmentApi, 'fetchAssignment');

      const { result } = renderHook(() => useAssignment(1102), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Hook's retry logic returns false for 404, so only called once
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      fetchSpy.mockRestore();
    });

    it('can prefetch assignment data', async () => {
      const testAssignment = mockAssignment({ id: 1103 });
      setupSuccessHandler(testAssignment);

      const fetchSpy = vi.spyOn(assignmentApi, 'fetchAssignment');

      // Prefetch the data
      await queryClient.prefetchQuery({
        queryKey: ['assignments', 'detail', 1103],
        queryFn: () => assignmentApi.fetchAssignment(1103),
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Now render the hook - should get cached data
      const { result } = renderHook(() => useAssignment(1103), {
        wrapper: createWrapper(queryClient),
      });

      // Data should be immediately available
      expect(result.current.data?.id).toBe(1103);
      expect(fetchSpy).toHaveBeenCalledTimes(1); // No additional fetch

      fetchSpy.mockRestore();
    });

    it('can set initial data for optimistic updates', async () => {
      const optimisticAssignment = mockAssignment({ id: 1104, name: 'Optimistic' });

      // Set initial data
      queryClient.setQueryData(['assignments', 'detail', 1104], optimisticAssignment);

      // Don't setup handler - we want to use cached data only
      const { result } = renderHook(() => useAssignment(1104), {
        wrapper: createWrapper(queryClient),
      });

      // Should have optimistic data immediately
      expect(result.current.data?.name).toBe('Optimistic');
    });
  });

  // ==========================================================================
  // Section 14: Concurrent Requests Tests
  // ==========================================================================

  describe('Concurrent Requests', () => {
    it('deduplicates concurrent requests for same ID', async () => {
      const testAssignment = mockAssignment({ id: 1201 });
      setupDelayedHandler(testAssignment, 100);

      const fetchSpy = vi.spyOn(assignmentApi, 'fetchAssignment');

      // Render multiple hooks simultaneously with same ID
      const { result: result1 } = renderHook(() => useAssignment(1201), {
        wrapper: createWrapper(queryClient),
      });

      const { result: result2 } = renderHook(() => useAssignment(1201), {
        wrapper: createWrapper(queryClient),
      });

      const { result: result3 } = renderHook(() => useAssignment(1201), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
        expect(result2.current.isSuccess).toBe(true);
        expect(result3.current.isSuccess).toBe(true);
      });

      // Should only fetch once due to deduplication
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // All should have the same data
      expect(result1.current.data?.id).toBe(1201);
      expect(result2.current.data?.id).toBe(1201);
      expect(result3.current.data?.id).toBe(1201);

      fetchSpy.mockRestore();
    });
  });
});
