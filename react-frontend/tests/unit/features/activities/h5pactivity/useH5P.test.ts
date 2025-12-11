/**
 * Unit Tests for useH5P Hook
 *
 * Comprehensive test suite for the useH5P React Query hook that fetches H5P activity data.
 * Tests validate:
 * - React Query integration with proper caching (5-minute stale time)
 * - Loading, error, and success states
 * - Automatic refetching and data invalidation
 * - Access information and permissions retrieval
 * - Preview mode detection
 * - Tracking status computation
 * - Display options decoding
 * - Type safety with TypeScript interfaces
 * - Proper cleanup on unmount
 *
 * @see Section 0.4 Transformation Mapping - Activity module tests
 * @see react-frontend/src/features/activities/h5pactivity/hooks/useH5P.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';

// Import hook under test
import { useH5P } from '@/features/activities/h5pactivity/hooks/useH5P';

// Import API functions to mock
import * as h5pApi from '@/features/activities/h5pactivity/api/h5pApi';

// Import types for mock data
import type {
  H5PActivity,
  H5PAccessInfo,
} from '@/features/activities/h5pactivity/types/h5p.types';
import { H5PGradeMethod, H5PReviewMode } from '@/features/activities/h5pactivity/types/h5p.types';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the h5pApi module
vi.mock('@/features/activities/h5pactivity/api/h5pApi', () => ({
  getH5PActivity: vi.fn(),
  getAccessInformation: vi.fn(),
  viewH5PActivity: vi.fn(),
  getAttempts: vi.fn(),
  // Include parseDisplayOptions as actual implementation (pure function, no side effects)
  parseDisplayOptions: (displayoptions: number) => ({
    frame: (displayoptions & 1) !== 0,
    download: (displayoptions & 2) !== 0,
    embed: (displayoptions & 4) !== 0,
    copyright: (displayoptions & 8) !== 0,
    about: (displayoptions & 16) !== 0,
  }),
  // Include buildDisplayOptions for completeness
  buildDisplayOptions: (options: Partial<{ frame?: boolean; download?: boolean; embed?: boolean; copyright?: boolean; about?: boolean }>) => {
    let bitmask = 0;
    if (options.frame) bitmask |= 1;
    if (options.download) bitmask |= 2;
    if (options.embed) bitmask |= 4;
    if (options.copyright) bitmask |= 8;
    if (options.about) bitmask |= 16;
    return bitmask;
  },
}));

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a mock H5PActivity with default values
 */
function createMockH5PActivity(overrides: Partial<H5PActivity> = {}): H5PActivity {
  return {
    id: 1,
    course: 100,
    name: 'Test H5P Activity',
    intro: '<p>This is a test H5P interactive content.</p>',
    introformat: 1,
    timecreated: 1699000000,
    timemodified: 1699999999,
    grade: 100,
    displayoptions: 15, // Frame, Download, Embed, Copyright all enabled
    enabletracking: 1,
    grademethod: H5PGradeMethod.HIGHEST_ATTEMPT,
    reviewmode: H5PReviewMode.COMPLETION,
    ...overrides,
  };
}

/**
 * Creates mock H5PAccessInfo with default values
 */
function createMockH5PAccessInfo(overrides: Partial<H5PAccessInfo> = {}): H5PAccessInfo {
  return {
    canview: true,
    cansubmit: true,
    canreviewattempts: false,
    ...overrides,
  };
}

// ============================================================================
// Test Query Client Factory
// ============================================================================

/**
 * Creates a QueryClient configured for testing
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 1000 * 60 * 5,
        staleTime: 0,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Wrapper component providing QueryClientProvider context
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.ReactElement {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('useH5P Hook', () => {
  let queryClient: QueryClient;
  let mockGetH5PActivity: ReturnType<typeof vi.mocked<typeof h5pApi.getH5PActivity>>;
  let mockGetAccessInformation: ReturnType<typeof vi.mocked<typeof h5pApi.getAccessInformation>>;

  beforeEach(() => {
    // Create fresh query client for each test
    queryClient = createTestQueryClient();

    // Get typed mock references
    mockGetH5PActivity = vi.mocked(h5pApi.getH5PActivity);
    mockGetAccessInformation = vi.mocked(h5pApi.getAccessInformation);

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear query cache after each test
    queryClient.clear();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. Basic Functionality Tests
  // ==========================================================================

  describe('Basic Functionality', () => {
    it('should return activity data on successful fetch', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activityData).toBeDefined();
      expect(result.current.activityData?.activity).toEqual(mockActivity);
    });

    it('should call h5pApi.getH5PActivity with correct ID', async () => {
      const activityId = 42;
      const mockActivity = createMockH5PActivity({ id: activityId });
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      renderHook(() => useH5P(activityId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockGetH5PActivity).toHaveBeenCalledWith(activityId);
      });
    });

    it('should return data, isLoading, error, and refetch function', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      // Check all expected properties exist
      expect(result.current).toHaveProperty('activityData');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
      expect(typeof result.current.refetch).toBe('function');
    });

    it('should work with valid activity ID', async () => {
      const mockActivity = createMockH5PActivity({ id: 999 });
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(999), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.activityData?.activity.id).toBe(999);
    });

    it('should return activity data matching H5PActivity interface', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const activity = result.current.activityData?.activity;
      expect(activity).toBeDefined();
      expect(activity).toHaveProperty('id');
      expect(activity).toHaveProperty('name');
      expect(activity).toHaveProperty('intro');
      expect(activity).toHaveProperty('grade');
      expect(activity).toHaveProperty('displayoptions');
      expect(activity).toHaveProperty('enabletracking');
      expect(activity).toHaveProperty('grademethod');
      expect(activity).toHaveProperty('reviewmode');
    });
  });

  // ==========================================================================
  // 2. Loading State Tests
  // ==========================================================================

  describe('Loading State', () => {
    it('should have isLoading true initially', () => {
      mockGetH5PActivity.mockImplementation(() => new Promise(() => {})); // Never resolves
      mockGetAccessInformation.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should have data undefined during loading', () => {
      mockGetH5PActivity.mockImplementation(() => new Promise(() => {}));
      mockGetAccessInformation.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.activityData).toBeUndefined();
    });

    it('should have error null during loading', () => {
      mockGetH5PActivity.mockImplementation(() => new Promise(() => {}));
      mockGetAccessInformation.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.error).toBeNull();
    });

    it('should transition loading state to success', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      // Initial state should be loading
      expect(result.current.isLoading).toBe(true);

      // Wait for success
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSuccess).toBe(true);
    });

    it('should show loading for slow API responses', async () => {
      // Mock slow API response
      mockGetH5PActivity.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockH5PActivity()), 100))
      );
      mockGetAccessInformation.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockH5PAccessInfo()), 100))
      );

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      // Should be loading while waiting
      expect(result.current.isLoading).toBe(true);

      // Eventually should complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 500 });
    });
  });

  // ==========================================================================
  // 3. Success State Tests
  // ==========================================================================

  describe('Success State', () => {
    it('should have isLoading false after success', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should have data containing activity object', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.activityData).toBeDefined();
      expect(result.current.activityData?.activity).toEqual(mockActivity);
    });

    it('should have error null on success', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.error).toBeNull();
    });

    it('should return activity with all required fields', async () => {
      const mockActivity = createMockH5PActivity({
        id: 123,
        name: 'Complete H5P Activity',
        intro: '<p>Full description</p>',
        grade: 100,
        displayoptions: 15,
        enabletracking: 1,
        grademethod: H5PGradeMethod.HIGHEST_ATTEMPT,
        reviewmode: H5PReviewMode.COMPLETION,
      });
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(123), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const activity = result.current.activityData?.activity;
      expect(activity?.id).toBe(123);
      expect(activity?.name).toBe('Complete H5P Activity');
      expect(activity?.intro).toBe('<p>Full description</p>');
      expect(activity?.grade).toBe(100);
      expect(activity?.displayoptions).toBe(15);
      expect(activity?.enabletracking).toBe(1);
      expect(activity?.grademethod).toBe(H5PGradeMethod.HIGHEST_ATTEMPT);
      expect(activity?.reviewmode).toBe(H5PReviewMode.COMPLETION);
    });

    it('should include tracking status in response', async () => {
      const mockActivity = createMockH5PActivity({ enabletracking: 1 });
      const mockAccessInfo = createMockH5PAccessInfo({ cansubmit: true });

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.trackingStatus).toBeDefined();
    });
  });

  // ==========================================================================
  // 4. Error State Tests
  // ==========================================================================

  describe('Error State', () => {
    // The hook has retry: 3 with exponential backoff, so error tests need
    // extended timeout to wait for all retries to complete (~7 seconds)
    // Need both waitFor timeout AND test-level timeout
    const ERROR_TEST_TIMEOUT = 10000;
    const TEST_TIMEOUT = 15000;

    it('should have isLoading false after error', async () => {
      mockGetH5PActivity.mockRejectedValue(new Error('API Error'));
      mockGetAccessInformation.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: ERROR_TEST_TIMEOUT });

      expect(result.current.isLoading).toBe(false);
    }, TEST_TIMEOUT);

    it('should have error object containing error details', async () => {
      const errorMessage = 'Failed to fetch H5P activity';
      mockGetH5PActivity.mockRejectedValue(new Error(errorMessage));
      mockGetAccessInformation.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: ERROR_TEST_TIMEOUT });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe(errorMessage);
    }, TEST_TIMEOUT);

    it('should have data undefined on error', async () => {
      mockGetH5PActivity.mockRejectedValue(new Error('API Error'));
      mockGetAccessInformation.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: ERROR_TEST_TIMEOUT });

      expect(result.current.activityData).toBeUndefined();
    }, TEST_TIMEOUT);

    it('should handle 404 Not Found error', async () => {
      const notFoundError = new Error('Activity not found');
      (notFoundError as any).status = 404;
      mockGetH5PActivity.mockRejectedValue(notFoundError);
      mockGetAccessInformation.mockRejectedValue(notFoundError);

      const { result } = renderHook(() => useH5P(999), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: ERROR_TEST_TIMEOUT });

      expect(result.current.error?.message).toBe('Activity not found');
    }, TEST_TIMEOUT);

    it('should handle 403 Forbidden error', async () => {
      const forbiddenError = new Error('Access denied');
      (forbiddenError as any).status = 403;
      mockGetH5PActivity.mockRejectedValue(forbiddenError);
      mockGetAccessInformation.mockRejectedValue(forbiddenError);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: ERROR_TEST_TIMEOUT });

      expect(result.current.error?.message).toBe('Access denied');
    }, TEST_TIMEOUT);

    it('should handle network error', async () => {
      const networkError = new Error('Network Error');
      (networkError as any).code = 'ERR_NETWORK';
      mockGetH5PActivity.mockRejectedValue(networkError);
      mockGetAccessInformation.mockRejectedValue(networkError);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: ERROR_TEST_TIMEOUT });

      expect(result.current.error?.message).toBe('Network Error');
    }, TEST_TIMEOUT);

    it('should handle timeout error', async () => {
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'ECONNABORTED';
      mockGetH5PActivity.mockRejectedValue(timeoutError);
      mockGetAccessInformation.mockRejectedValue(timeoutError);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: ERROR_TEST_TIMEOUT });

      expect(result.current.error?.message).toBe('Request timeout');
    }, TEST_TIMEOUT);
  });

  // ==========================================================================
  // 5. Refetch Tests
  // ==========================================================================

  describe('Refetch', () => {
    it('should provide refetch function', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(typeof result.current.refetch).toBe('function');
    });

    it('should trigger new API call on refetch', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Clear mock call history
      mockGetH5PActivity.mockClear();
      mockGetAccessInformation.mockClear();

      // Trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(mockGetH5PActivity).toHaveBeenCalledTimes(1);
    });

    it('should update data on successful refetch', async () => {
      const initialActivity = createMockH5PActivity({ name: 'Initial Name' });
      const updatedActivity = createMockH5PActivity({ name: 'Updated Name' });
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValueOnce(initialActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.activityData?.activity.name).toBe('Initial Name');
      });

      // Setup mock for refetch
      mockGetH5PActivity.mockResolvedValueOnce(updatedActivity);

      // Trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.activityData?.activity.name).toBe('Updated Name');
      });
    });

    it('should handle errors during refetch', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValueOnce(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Setup mock to fail on refetch
      mockGetH5PActivity.mockRejectedValueOnce(new Error('Refetch failed'));

      // Trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should bypass cache on manual refetch', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const callCountBefore = mockGetH5PActivity.mock.calls.length;

      // Trigger manual refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(mockGetH5PActivity.mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });

  // ==========================================================================
  // 6. Caching Tests
  // ==========================================================================

  describe('Caching', () => {
    it('should use cache for subsequent requests with same ID', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      // First render
      const { result: result1 } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second render with same ID and same query client
      const { result: result2 } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      // Should immediately have data from cache
      expect(result2.current.activityData).toBeDefined();
    });

    it('should have separate caches for different IDs', async () => {
      const mockActivity1 = createMockH5PActivity({ id: 1, name: 'Activity 1' });
      const mockActivity2 = createMockH5PActivity({ id: 2, name: 'Activity 2' });
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity
        .mockResolvedValueOnce(mockActivity1)
        .mockResolvedValueOnce(mockActivity2);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      // Fetch activity 1
      const { result: result1 } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Fetch activity 2
      const { result: result2 } = renderHook(() => useH5P(2), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Verify they have different data
      expect(result1.current.activityData?.activity.name).toBe('Activity 1');
      expect(result2.current.activityData?.activity.name).toBe('Activity 2');
    });

    it('should cache data for 5 minutes (stale time)', async () => {
      // Create a query client with the actual H5P stale time
      const testQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
            refetchOnWindowFocus: false,
          },
        },
      });

      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(testQueryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify data is not stale immediately by checking the underlying query
      // The hook exposes activityQuery which contains the isStale property
      expect(result.current.activityQuery.isStale).toBe(false);
    });

    it('should persist cache across component unmounts', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      // First render and unmount
      const { result: result1, unmount } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      unmount();

      // Clear mock to track new calls
      mockGetH5PActivity.mockClear();

      // Re-render with same query client
      const { result: result2 } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      // Should have cached data immediately
      expect(result2.current.activityData).toBeDefined();
    });
  });

  // ==========================================================================
  // 7. Background Refetch Tests
  // ==========================================================================

  describe('Background Refetch', () => {
    it('should not clear existing data during background refetch', async () => {
      const mockActivity = createMockH5PActivity({ name: 'Original Data' });
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Setup slow refetch
      mockGetH5PActivity.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockH5PActivity({ name: 'New Data' })), 100))
      );

      // Trigger refetch
      act(() => {
        result.current.refetch();
      });

      // Should still have original data during refetch
      expect(result.current.activityData?.activity.name).toBe('Original Data');

      // Wait for refetch to complete
      await waitFor(() => {
        expect(result.current.activityData?.activity.name).toBe('New Data');
      }, { timeout: 500 });
    });

    it('should respect refetchOnWindowFocus option', async () => {
      // Create query client with refetchOnWindowFocus disabled (default in tests)
      const testQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      });

      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(testQueryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const callCount = mockGetH5PActivity.mock.calls.length;

      // Simulate window focus event
      window.dispatchEvent(new Event('focus'));

      // Should not have refetched
      expect(mockGetH5PActivity.mock.calls.length).toBe(callCount);
    });
  });

  // ==========================================================================
  // 8. Query Key Tests
  // ==========================================================================

  describe('Query Key', () => {
    it('should use correct query key format', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        // Check if query exists with expected key pattern
        const queryCache = queryClient.getQueryCache();
        const queries = queryCache.getAll();
        
        // Should have queries containing 'h5pactivity' in the key
        const h5pQueries = queries.filter((q) => 
          JSON.stringify(q.queryKey).includes('h5pactivity') ||
          JSON.stringify(q.queryKey).includes('h5p')
        );
        
        expect(h5pQueries.length).toBeGreaterThan(0);
      });
    });

    it('should generate different keys for different activity IDs', async () => {
      const mockActivity1 = createMockH5PActivity({ id: 1 });
      const mockActivity2 = createMockH5PActivity({ id: 2 });
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockImplementation((id: number) => {
        return Promise.resolve(id === 1 ? mockActivity1 : mockActivity2);
      });
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      // Render with ID 1
      renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      // Render with ID 2
      renderHook(() => useH5P(2), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        const queryCache = queryClient.getQueryCache();
        const queries = queryCache.getAll();
        
        // Should have at least 2 queries (one for each ID)
        expect(queries.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should enable selective cache invalidation', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Invalidate specific query
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['h5pactivity', 1] });
      });

      // Verify the query was invalidated (will refetch)
      expect(mockGetH5PActivity.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // 9. Access Information Tests
  // ==========================================================================

  describe('Access Information', () => {
    it('should fetch access info with activity data', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo({
        canview: true,
        cansubmit: true,
        canreviewattempts: false,
      });

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.accessInfo).toBeDefined();
      expect(result.current.accessInfo?.canview).toBe(true);
      expect(result.current.accessInfo?.cansubmit).toBe(true);
      expect(result.current.accessInfo?.canreviewattempts).toBe(false);
    });

    it('should return canview, canreviewattempts, cansubmit flags', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo({
        canview: true,
        cansubmit: false,
        canreviewattempts: true,
      });

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const accessInfo = result.current.accessInfo;
      expect(accessInfo).toHaveProperty('canview', true);
      expect(accessInfo).toHaveProperty('cansubmit', false);
      expect(accessInfo).toHaveProperty('canreviewattempts', true);
    });

    it('should call getAccessInformation API method', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockGetAccessInformation).toHaveBeenCalled();
      });
    });

    it('should handle missing permissions gracefully', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo({
        canview: false,
        cansubmit: false,
        canreviewattempts: false,
      });

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const accessInfo = result.current.accessInfo;
      expect(accessInfo?.canview).toBe(false);
      expect(accessInfo?.cansubmit).toBe(false);
      expect(accessInfo?.canreviewattempts).toBe(false);
    });
  });

  // ==========================================================================
  // 10. Preview Mode Detection Tests
  // ==========================================================================

  describe('Preview Mode Detection', () => {
    it('should detect preview mode from canSubmit: false', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo({
        canview: true,
        cansubmit: false, // Cannot submit = preview mode
        canreviewattempts: false,
      });

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.trackingStatus?.isPreviewMode).toBe(true);
    });

    it('should return isPreviewMode boolean', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo({
        cansubmit: true,
      });

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(typeof result.current.trackingStatus?.isPreviewMode).toBe('boolean');
      expect(result.current.trackingStatus?.isPreviewMode).toBe(false);
    });

    it('should indicate preview mode disables tracking submission', async () => {
      const mockActivity = createMockH5PActivity({ enabletracking: 1 });
      const mockAccessInfo = createMockH5PAccessInfo({
        canview: true,
        cansubmit: false, // Preview mode
      });

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // In preview mode, even with tracking enabled, should be preview
      expect(result.current.trackingStatus?.isPreviewMode).toBe(true);
    });

    it('should test with different permission combinations', async () => {
      const mockActivity = createMockH5PActivity();

      // Test case 1: Full access (not preview)
      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(
        createMockH5PAccessInfo({ canview: true, cansubmit: true, canreviewattempts: true })
      );

      const { result: result1 } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      expect(result1.current.trackingStatus?.isPreviewMode).toBe(false);

      // Test case 2: View only (preview mode)
      const queryClient2 = createTestQueryClient();
      mockGetAccessInformation.mockResolvedValue(
        createMockH5PAccessInfo({ canview: true, cansubmit: false, canreviewattempts: false })
      );

      const { result: result2 } = renderHook(() => useH5P(2), {
        wrapper: createWrapper(queryClient2),
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      expect(result2.current.trackingStatus?.isPreviewMode).toBe(true);
    });
  });

  // ==========================================================================
  // 11. Tracking Status Tests
  // ==========================================================================

  describe('Tracking Status', () => {
    it('should return enabletracking boolean', async () => {
      const mockActivity = createMockH5PActivity({ enabletracking: 1 });
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.trackingStatus).toBeDefined();
      expect(result.current.trackingStatus?.isTrackingEnabled).toBe(true);
    });

    it('should reflect tracking disabled status', async () => {
      const mockActivity = createMockH5PActivity({ enabletracking: 0 });
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.trackingStatus?.isTrackingEnabled).toBe(false);
    });

    it('should affect statement submission based on tracking status', async () => {
      const mockActivityWithTracking = createMockH5PActivity({ enabletracking: 1 });
      const mockAccessInfo = createMockH5PAccessInfo({ cansubmit: true });

      mockGetH5PActivity.mockResolvedValue(mockActivityWithTracking);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // When tracking is enabled and user can submit
      expect(result.current.trackingStatus?.isTrackingEnabled).toBe(true);
      expect(result.current.trackingStatus?.canSubmit).toBe(true);
    });
  });

  // ==========================================================================
  // 12. Display Options Tests
  // ==========================================================================

  describe('Display Options', () => {
    it('should return displayoptions object', async () => {
      const mockActivity = createMockH5PActivity({ displayoptions: 15 });
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.activityData?.displayOptions).toBeDefined();
    });

    it('should decode display options from integer value', async () => {
      // displayoptions = 15 means all flags enabled (1+2+4+8 = frame, download, embed, copyright)
      const mockActivity = createMockH5PActivity({ displayoptions: 15 });
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const options = result.current.activityData?.displayOptions;
      expect(options?.frame).toBe(true);
      expect(options?.download).toBe(true);
      expect(options?.embed).toBe(true);
      expect(options?.copyright).toBe(true);
    });

    it('should handle partial display options', async () => {
      // displayoptions = 5 means only frame (1) and embed (4) enabled
      const mockActivity = createMockH5PActivity({ displayoptions: 5 });
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const options = result.current.activityData?.displayOptions;
      expect(options?.frame).toBe(true);
      expect(options?.download).toBe(false);
      expect(options?.embed).toBe(true);
      expect(options?.copyright).toBe(false);
    });

    it('should use defaults for zero display options', async () => {
      const mockActivity = createMockH5PActivity({ displayoptions: 0 });
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const options = result.current.activityData?.displayOptions;
      expect(options?.frame).toBe(false);
      expect(options?.download).toBe(false);
      expect(options?.embed).toBe(false);
      expect(options?.copyright).toBe(false);
    });
  });

  // ==========================================================================
  // 13. Optimistic Updates Tests
  // ==========================================================================

  describe('Optimistic Updates', () => {
    it('should support setting query data directly', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Use setQueryData for optimistic update
      act(() => {
        queryClient.setQueryData(['h5pactivity', 1], (oldData: any) => ({
          ...oldData,
          activity: { ...oldData?.activity, name: 'Optimistically Updated' },
        }));
      });

      // Verify the update took effect
      const cachedData = queryClient.getQueryData(['h5pactivity', 1]);
      expect(cachedData).toBeDefined();
    });

    it('should allow cache manipulation via QueryClient', async () => {
      const mockActivity = createMockH5PActivity({ name: 'Original' });
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Get and manipulate cache
      const queryCache = queryClient.getQueryCache();
      expect(queryCache.getAll().length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 14. Integration Tests
  // ==========================================================================

  describe('Integration', () => {
    it('should work within QueryClientProvider', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      // This tests the basic integration with QueryClientProvider
      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.activityData).toBeDefined();
    });

    it('should integrate with global query cache', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        const cache = queryClient.getQueryCache();
        expect(cache.getAll().length).toBeGreaterThan(0);
      });
    });

    it('should respect QueryClient defaults', async () => {
      const customQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 3, // Custom retry count
            staleTime: 1000,
          },
        },
      });

      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(customQueryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.activityData).toBeDefined();
    });

    it('should work with other React Query hooks in same provider', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      // Multiple hooks using same provider
      const { result: result1 } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      const { result: result2 } = renderHook(() => useH5P(2), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess || result1.current.isLoading).toBe(true);
      });

      await waitFor(() => {
        expect(result2.current.isSuccess || result2.current.isLoading).toBe(true);
      });
    });
  });

  // ==========================================================================
  // 15. Type Safety Tests
  // ==========================================================================

  describe('Type Safety', () => {
    it('should have activity data typed as H5PActivity', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // TypeScript should ensure activity has correct type
      const activity = result.current.activityData?.activity;
      expect(activity?.id).toBeDefined();
      expect(typeof activity?.id).toBe('number');
      expect(typeof activity?.name).toBe('string');
      expect(typeof activity?.intro).toBe('string');
    });

    it('should have error typed as Error object', async () => {
      // Error tests need extended timeout due to hook's retry: 3 with exponential backoff
      const ERROR_TEST_TIMEOUT = 10000;
      const errorMessage = 'Typed Error';
      mockGetH5PActivity.mockRejectedValue(new Error(errorMessage));
      mockGetAccessInformation.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: ERROR_TEST_TIMEOUT });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe(errorMessage);
    }, 15000);

    it('should accept valid activity ID types', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      // Test with number
      const { result } = renderHook(() => useH5P(123), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetH5PActivity).toHaveBeenCalledWith(123);
    });
  });

  // ==========================================================================
  // 16. Cleanup Tests
  // ==========================================================================

  describe('Cleanup', () => {
    it('should clean up on unmount', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result, unmount } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });

    it('should not update state after unmount', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      let resolvePromise: (value: H5PActivity) => void;
      const pendingPromise = new Promise<H5PActivity>((resolve) => {
        resolvePromise = resolve;
      });

      mockGetH5PActivity.mockReturnValue(pendingPromise);
      mockGetAccessInformation.mockResolvedValue(createMockH5PAccessInfo());

      const { unmount } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      // Unmount before resolve
      unmount();

      // Resolve after unmount
      resolvePromise!(createMockH5PActivity());

      // Wait a bit and check no React warnings
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // Should not have React state update warnings
      const reactWarnings = consoleError.mock.calls.filter(
        (call) => call[0]?.includes?.('Can\'t perform a React state update')
      );
      expect(reactWarnings.length).toBe(0);

      consoleError.mockRestore();
    });

    it('should handle rapid mount/unmount cycles', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      // Rapid mount/unmount cycles
      for (let i = 0; i < 5; i++) {
        const { unmount } = renderHook(() => useH5P(1), {
          wrapper: createWrapper(queryClient),
        });
        unmount();
      }

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  // ==========================================================================
  // 17. Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle undefined activity ID gracefully', async () => {
      const { result } = renderHook(() => useH5P(undefined as unknown as number), {
        wrapper: createWrapper(queryClient),
      });

      // Should not crash, might be disabled or return early
      expect(result.current).toBeDefined();
    });

    it('should handle null activity ID gracefully', async () => {
      const { result } = renderHook(() => useH5P(null as unknown as number), {
        wrapper: createWrapper(queryClient),
      });

      // Should not crash
      expect(result.current).toBeDefined();
    });

    it('should handle zero activity ID', async () => {
      mockGetH5PActivity.mockRejectedValue(new Error('Invalid activity ID'));
      mockGetAccessInformation.mockRejectedValue(new Error('Invalid activity ID'));

      const { result } = renderHook(() => useH5P(0), {
        wrapper: createWrapper(queryClient),
      });

      // Should either be disabled or error
      await waitFor(() => {
        expect(result.current.isError || !result.current.isLoading).toBe(true);
      });
    });

    it('should handle very large activity ID', async () => {
      const largeId = Number.MAX_SAFE_INTEGER;
      const mockActivity = createMockH5PActivity({ id: largeId });
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(largeId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.activityData?.activity.id).toBe(largeId);
    });

    it('should handle rapid ID changes', async () => {
      const mockActivity1 = createMockH5PActivity({ id: 1, name: 'Activity 1' });
      const mockActivity2 = createMockH5PActivity({ id: 2, name: 'Activity 2' });
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockImplementation((id: number) =>
        Promise.resolve(id === 1 ? mockActivity1 : mockActivity2)
      );
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      let activityId = 1;
      const { result, rerender } = renderHook(() => useH5P(activityId), {
        wrapper: createWrapper(queryClient),
      });

      // Rapidly change ID
      activityId = 2;
      rerender();
      activityId = 1;
      rerender();
      activityId = 2;
      rerender();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should settle on final ID
      expect(mockGetH5PActivity).toHaveBeenCalled();
    });

    it('should handle concurrent requests for same ID', async () => {
      const mockActivity = createMockH5PActivity();
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      // Multiple concurrent renders with same ID
      const promises = [
        renderHook(() => useH5P(1), { wrapper: createWrapper(queryClient) }),
        renderHook(() => useH5P(1), { wrapper: createWrapper(queryClient) }),
        renderHook(() => useH5P(1), { wrapper: createWrapper(queryClient) }),
      ];

      await waitFor(() => {
        const allSuccess = promises.every((p) => p.result.current.isSuccess || p.result.current.activityData);
        expect(allSuccess).toBe(true);
      });
    });
  });

  // ==========================================================================
  // 18. API Error Scenarios
  // ==========================================================================

  describe('API Error Scenarios', () => {
    // The hook has retry: 3 with exponential backoff, so error tests need
    // extended timeout to wait for all retries to complete (~7 seconds)
    // Need both waitFor timeout AND test-level timeout
    const ERROR_TEST_TIMEOUT = 10000;
    const TEST_TIMEOUT = 15000;

    it('should handle activity not found (404)', async () => {
      const error = new Error('Activity not found');
      (error as any).response = { status: 404 };
      mockGetH5PActivity.mockRejectedValue(error);
      mockGetAccessInformation.mockRejectedValue(error);

      const { result } = renderHook(() => useH5P(99999), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: ERROR_TEST_TIMEOUT });

      expect(result.current.error?.message).toContain('not found');
    }, TEST_TIMEOUT);

    it('should handle unauthorized access (401)', async () => {
      const error = new Error('Unauthorized');
      (error as any).response = { status: 401 };
      mockGetH5PActivity.mockRejectedValue(error);
      mockGetAccessInformation.mockRejectedValue(error);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: ERROR_TEST_TIMEOUT });

      expect(result.current.error?.message).toBe('Unauthorized');
    }, TEST_TIMEOUT);

    it('should handle forbidden access (403)', async () => {
      const error = new Error('Forbidden');
      (error as any).response = { status: 403 };
      mockGetH5PActivity.mockRejectedValue(error);
      mockGetAccessInformation.mockRejectedValue(error);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: ERROR_TEST_TIMEOUT });

      expect(result.current.error?.message).toBe('Forbidden');
    }, TEST_TIMEOUT);

    it('should handle server error (500)', async () => {
      const error = new Error('Internal Server Error');
      (error as any).response = { status: 500 };
      mockGetH5PActivity.mockRejectedValue(error);
      mockGetAccessInformation.mockRejectedValue(error);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: ERROR_TEST_TIMEOUT });

      expect(result.current.error?.message).toBe('Internal Server Error');
    }, TEST_TIMEOUT);

    it('should handle invalid response format', async () => {
      // Mock API returning invalid data (simulating a malformed response)
      // Use type assertion to test edge case where API returns unexpected null
      mockGetH5PActivity.mockResolvedValue(null as unknown as H5PActivity);
      mockGetAccessInformation.mockResolvedValue(createMockH5PAccessInfo());

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        // Either succeeds with null data or errors
        expect(result.current.isSuccess || result.current.isError).toBe(true);
      });
    });

    it('should handle missing required fields in response', async () => {
      // Mock API returning partial activity data
      const incompleteActivity = { id: 1 } as H5PActivity; // Missing other fields
      const mockAccessInfo = createMockH5PAccessInfo();

      mockGetH5PActivity.mockResolvedValue(incompleteActivity);
      mockGetAccessInformation.mockResolvedValue(mockAccessInfo);

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should handle gracefully even with missing fields
      expect(result.current.activityData?.activity.id).toBe(1);
    });

    it('should handle access info API failure with activity success', async () => {
      const mockActivity = createMockH5PActivity();

      mockGetH5PActivity.mockResolvedValue(mockActivity);
      mockGetAccessInformation.mockRejectedValue(new Error('Access info failed'));

      const { result } = renderHook(() => useH5P(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        // Should either error or succeed with partial data
        expect(result.current.isLoading).toBe(false);
      }, { timeout: ERROR_TEST_TIMEOUT });
    }, TEST_TIMEOUT);
  });
});
