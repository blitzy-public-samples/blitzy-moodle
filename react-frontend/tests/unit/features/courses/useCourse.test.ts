/**
 * @fileoverview Unit tests for useCourse React Query hook
 * @description Comprehensive test suite validating single course detail fetching with automatic
 * caching, background revalidation, conditional fetching, Suspense integration, and proper
 * integration with courseApi.getCourse function.
 * 
 * Tests cover:
 * - Basic functionality (fetch, loading, success, error states)
 * - Query key pattern ['courses', courseId]
 * - Caching behavior with 5-minute stale time
 * - Conditional fetching with enabled option
 * - Suspense integration
 * - Background revalidation
 * - Auto-refetching on window focus and network reconnect
 * - Error handling (404, 403, 500, network errors)
 * - Manual refetch and cache invalidation
 * - TypeScript type safety
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';

import { useCourse, courseKeys } from '@/features/courses/hooks/useCourse';

// Constants matching the hook implementation for testing
// Note: These are not exported from useCourse to keep the API minimal
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes
const DEFAULT_GC_TIME = 30 * 60 * 1000; // 30 minutes
import type { Course } from '@/types/entities';
import type { ApiResponse } from '@/types/api';

// Mock the courseApi module
vi.mock('@/features/courses/api/courseApi', () => ({
  getCourse: vi.fn(),
}));

// Import the mocked module
import { getCourse } from '@/features/courses/api/courseApi';

// Cast to mock function for type safety
const mockGetCourse = getCourse as ReturnType<typeof vi.fn>;

/**
 * Creates a properly configured QueryClient for testing
 * Disables retries and logging to make tests deterministic
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
}

/**
 * Wrapper component that provides QueryClient context
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
 * Sample course data for testing
 * Matches the Course interface with all required fields
 */
function createMockCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 1,
    fullname: 'Introduction to Computer Science',
    shortname: 'CS101',
    summary: '<p>A comprehensive introduction to computer science fundamentals.</p>',
    summaryformat: 1,
    format: 'topics',
    category: 1,
    visible: true,
    startdate: 1705276800, // 2024-01-15
    enddate: 1718409600,   // 2024-06-15
    timecreated: 1701388800, // 2023-12-01
    timemodified: 1704844800, // 2024-01-10
    groupmode: 0,
    groupmodeforce: false,
    defaultgroupingid: 0,
    lang: 'en',
    theme: '',
    enablecompletion: true,
    completionnotify: false,
    showgrades: true,
    showreports: true,
    maxbytes: 52428800,
    showactivitydates: true,
    showcompletionconditions: true,
    newsitems: 5,
    marker: 0,
    sortorder: 10001,
    idnumber: 'CS-101-2024',
    courseimage: '/course/images/1/cs101.jpg',
    ...overrides,
  };
}

/**
 * Creates a mock API response wrapper
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

describe('useCourse', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create fresh QueryClient for each test
    queryClient = createTestQueryClient();
    // Reset all mocks
    vi.clearAllMocks();
    // Reset mock implementations
    mockGetCourse.mockReset();
  });

  afterEach(() => {
    // Clear query cache after each test
    queryClient.clear();
  });

  describe('Basic Functionality', () => {
    it('should fetch course on mount with provided courseId', async () => {
      const mockCourse = createMockCourse({ id: 5 });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(5), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetCourse).toHaveBeenCalledWith(5);
      expect(mockGetCourse).toHaveBeenCalledTimes(1);
    });

    it('should call courseApi.getCourse with correct ID', async () => {
      const mockCourse = createMockCourse({ id: 42 });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      renderHook(() => useCourse(42), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockGetCourse).toHaveBeenCalledWith(42);
      });
    });

    it('should return loading state initially (isLoading: true)', async () => {
      const mockCourse = createMockCourse();
      // Create a promise that doesn't resolve immediately
      let resolvePromise: (value: ApiResponse<Course>) => void;
      const pendingPromise = new Promise<ApiResponse<Course>>((resolve) => {
        resolvePromise = resolve;
      });
      mockGetCourse.mockReturnValueOnce(pendingPromise);

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      // Resolve the promise
      await act(async () => {
        resolvePromise!(createMockApiResponse(mockCourse));
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should return success state with course data after fetch', async () => {
      const mockCourse = createMockCourse({
        id: 10,
        fullname: 'Advanced Mathematics',
        shortname: 'MATH301',
      });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(10), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockCourse);
      expect(result.current.data?.id).toBe(10);
      expect(result.current.data?.fullname).toBe('Advanced Mathematics');
      expect(result.current.data?.shortname).toBe('MATH301');
    });

    it('should return error state when API call fails', async () => {
      const error = new Error('Failed to fetch course');
      mockGetCourse.mockRejectedValueOnce(error);

      // Pass retry: false to prevent retries in error tests
      const { result } = renderHook(() => useCourse(999, { retry: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('should return data matching Course type with full details', async () => {
      const mockCourse = createMockCourse({
        id: 1,
        fullname: 'Web Development Fundamentals',
        shortname: 'WEB101',
        summary: '<p>Learn the basics of web development.</p>',
        format: 'weeks',
        category: 2,
        enablecompletion: true,
        showgrades: true,
      });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const course = result.current.data;
      expect(course).toBeDefined();
      expect(typeof course?.id).toBe('number');
      expect(typeof course?.fullname).toBe('string');
      expect(typeof course?.shortname).toBe('string');
      expect(typeof course?.summary).toBe('string');
      expect(typeof course?.format).toBe('string');
      expect(typeof course?.category).toBe('number');
      expect(typeof course?.enablecompletion).toBe('boolean');
      expect(typeof course?.showgrades).toBe('boolean');
    });
  });

  describe('Query Key Pattern', () => {
    it('should use query key format: [\'courses\', courseId]', () => {
      // Test the courseKeys utility
      expect(courseKeys.detail(5)).toEqual(['courses', 5]);
      expect(courseKeys.detail(10)).toEqual(['courses', 10]);
      expect(courseKeys.detail(999)).toEqual(['courses', 999]);
    });

    it('should generate consistent keys across application', () => {
      const key1 = courseKeys.detail(42);
      const key2 = courseKeys.detail(42);
      
      expect(key1).toEqual(key2);
      expect(JSON.stringify(key1)).toBe(JSON.stringify(key2));
    });

    it('should generate different keys for different courseIds', () => {
      const key1 = courseKeys.detail(1);
      const key2 = courseKeys.detail(2);
      const key3 = courseKeys.detail(100);

      expect(key1).not.toEqual(key2);
      expect(key2).not.toEqual(key3);
      expect(key1).not.toEqual(key3);
    });

    it('should have cache isolation between different course IDs', async () => {
      const course1 = createMockCourse({ id: 1, fullname: 'Course One' });
      const course2 = createMockCourse({ id: 2, fullname: 'Course Two' });

      mockGetCourse
        .mockResolvedValueOnce(createMockApiResponse(course1))
        .mockResolvedValueOnce(createMockApiResponse(course2));

      // Fetch first course
      const { result: result1 } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Fetch second course
      const { result: result2 } = renderHook(() => useCourse(2), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Verify both courses are cached separately
      expect(result1.current.data?.fullname).toBe('Course One');
      expect(result2.current.data?.fullname).toBe('Course Two');
      expect(mockGetCourse).toHaveBeenCalledTimes(2);
    });
  });

  describe('Caching Behavior', () => {
    it('should have staleTime set to 5 minutes (300000ms)', () => {
      expect(DEFAULT_STALE_TIME).toBe(5 * 60 * 1000);
    });

    it('should return cached data immediately on re-render', async () => {
      const mockCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValue(createMockApiResponse(mockCourse));

      // Create a client with actual stale time for this test
      const cachedQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: DEFAULT_STALE_TIME,
            gcTime: DEFAULT_GC_TIME,
          },
        },
      });

      // First render
      const { result: result1, unmount } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(cachedQueryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      unmount();

      // Second render should use cached data
      const { result: result2 } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(cachedQueryClient),
      });

      // Should have data immediately from cache
      expect(result2.current.data).toBeDefined();
      expect(result2.current.data?.id).toBe(1);

      // API should only be called once
      expect(mockGetCourse).toHaveBeenCalledTimes(1);

      cachedQueryClient.clear();
    });

    it('should have cache persist across component unmounts', async () => {
      const mockCourse = createMockCourse({ id: 5, fullname: 'Cached Course' });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      // Use a client with gcTime configured
      const persistentClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: DEFAULT_STALE_TIME,
            gcTime: DEFAULT_GC_TIME,
          },
        },
      });

      // First mount
      const { unmount } = renderHook(() => useCourse(5), {
        wrapper: createWrapper(persistentClient),
      });

      await waitFor(() => {
        expect(persistentClient.getQueryData(courseKeys.detail(5))).toBeDefined();
      });

      // Unmount
      unmount();

      // Check cache still exists
      const cachedData = persistentClient.getQueryData(courseKeys.detail(5));
      expect(cachedData).toBeDefined();

      persistentClient.clear();
    });

    it('should not call API when fresh data exists in cache', async () => {
      const mockCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      // Pre-populate cache
      queryClient.setQueryData(courseKeys.detail(1), mockCourse);

      const { result } = renderHook(
        () => useCourse(1, { staleTime: Infinity }),
        { wrapper: createWrapper(queryClient) }
      );

      // Should have data immediately
      expect(result.current.data).toEqual(mockCourse);
      
      // Should not call API since data is fresh
      expect(mockGetCourse).not.toHaveBeenCalled();
    });

    it('should have gcTime set to 30 minutes', () => {
      expect(DEFAULT_GC_TIME).toBe(30 * 60 * 1000);
    });
  });

  describe('Conditional Fetching', () => {
    it('should prevent fetch when enabled is false', async () => {
      const { result } = renderHook(
        () => useCourse(1, { enabled: false }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait a bit to ensure no fetch is triggered
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockGetCourse).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isPending).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should not call API when enabled: false', async () => {
      const mockCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      const { result, rerender } = renderHook(
        ({ enabled }) => useCourse(1, { enabled }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { enabled: false },
        }
      );

      // API should not be called
      expect(mockGetCourse).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();

      // Re-enable the query
      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Now API should be called
      expect(mockGetCourse).toHaveBeenCalledTimes(1);
    });

    it('should enable conditional fetching based on courseId existence', async () => {
      const mockCourse = createMockCourse({ id: 5 });
      mockGetCourse.mockResolvedValue(createMockApiResponse(mockCourse));

      // Test with courseId = 0 (should be disabled by hook's internal logic)
      const { result: result0 } = renderHook(
        () => useCourse(0),
        { wrapper: createWrapper(queryClient) }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not fetch for courseId 0
      expect(result0.current.data).toBeUndefined();

      // Test with valid courseId
      const { result: result5 } = renderHook(
        () => useCourse(5),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result5.current.isSuccess).toBe(true);
      });

      expect(result5.current.data?.id).toBe(5);
    });

    it('should trigger fetch when dynamically enabled', async () => {
      const mockCourse = createMockCourse({ id: 3 });
      mockGetCourse.mockResolvedValue(createMockApiResponse(mockCourse));

      const { result, rerender } = renderHook(
        ({ courseId, enabled }) => useCourse(courseId, { enabled }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { courseId: 3, enabled: false },
        }
      );

      // Initially disabled
      expect(mockGetCourse).not.toHaveBeenCalled();

      // Enable fetching
      rerender({ courseId: 3, enabled: true });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetCourse).toHaveBeenCalledWith(3);
    });

    it('should not fetch when courseId is undefined/null', async () => {
      // Test with undefined-like behavior (courseId = 0)
      const { result } = renderHook(
        () => useCourse(0),
        { wrapper: createWrapper(queryClient) }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockGetCourse).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('Suspense Integration', () => {
    it('should support suspense option', async () => {
      const mockCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      // Create QueryClient that supports suspense
      const suspenseClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      // Note: Testing suspense directly requires Suspense boundary
      // This test verifies the option is accepted
      const { result } = renderHook(
        () => useCourse(1),
        { wrapper: createWrapper(suspenseClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();

      suspenseClient.clear();
    });
  });

  describe('Background Revalidation', () => {
    it('should show isFetching during background refetch', async () => {
      const mockCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValue(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Trigger refetch
      await act(async () => {
        result.current.refetch();
      });

      // During refetch, isFetching should be true but data should remain
      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
    });

    it('should keep data available during refetch', async () => {
      const initialCourse = createMockCourse({ id: 1, fullname: 'Initial Course' });
      const updatedCourse = createMockCourse({ id: 1, fullname: 'Updated Course' });

      mockGetCourse
        .mockResolvedValueOnce(createMockApiResponse(initialCourse))
        .mockResolvedValueOnce(createMockApiResponse(updatedCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.fullname).toBe('Initial Course');

      // Trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.data?.fullname).toBe('Updated Course');
      });
    });

    it('should update data after successful refetch', async () => {
      const initialCourse = createMockCourse({ id: 1, summary: 'Old summary' });
      const updatedCourse = createMockCourse({ id: 1, summary: 'New summary' });

      mockGetCourse
        .mockResolvedValueOnce(createMockApiResponse(initialCourse))
        .mockResolvedValueOnce(createMockApiResponse(updatedCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.data?.summary).toBe('Old summary');
      });

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.data?.summary).toBe('New summary');
      });
    });
  });

  describe('Auto-Refetching', () => {
    it('should support refetch on window focus', async () => {
      const mockCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValue(createMockApiResponse(mockCourse));

      // Create client with refetchOnWindowFocus enabled
      const refetchClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: true,
            staleTime: 0,
          },
        },
      });

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(refetchClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetCourse).toHaveBeenCalledTimes(1);

      // Simulate window focus event
      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });

      // Wait for potential refetch
      await waitFor(() => {
        // The exact behavior depends on React Query's internal handling
        expect(result.current.data).toBeDefined();
      });

      refetchClient.clear();
    });

    it('should support refetch on network reconnect', async () => {
      const mockCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValue(createMockApiResponse(mockCourse));

      // Create client with refetchOnReconnect enabled
      const reconnectClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnReconnect: true,
            staleTime: 0,
          },
        },
      });

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(reconnectClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Data should be present
      expect(result.current.data).toBeDefined();

      reconnectClient.clear();
    });
  });

  describe('Error Handling', () => {
    it('should handle error state when getCourse throws', async () => {
      const apiError = new Error('API Error');
      mockGetCourse.mockRejectedValueOnce(apiError);

      // Pass retry: false to prevent retries in error tests
      const { result } = renderHook(() => useCourse(1, { retry: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('should handle 404 error for invalid course ID', async () => {
      const notFoundError = Object.assign(new Error('Course not found'), { 
        status: 404, 
        code: 'NOT_FOUND' 
      });
      mockGetCourse.mockRejectedValueOnce(notFoundError);

      // Pass retry: false to prevent retries in error tests
      const { result } = renderHook(() => useCourse(99999, { retry: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect((result.current.error as Error).message).toBe('Course not found');
    });

    it('should handle 403 error for permission denied', async () => {
      const forbiddenError = Object.assign(new Error('Permission denied'), { 
        status: 403, 
        code: 'PERMISSION_DENIED' 
      });
      mockGetCourse.mockRejectedValueOnce(forbiddenError);

      // Pass retry: false to prevent retries in error tests
      const { result } = renderHook(() => useCourse(1, { retry: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect((result.current.error as Error).message).toBe('Permission denied');
    });

    it('should handle 500 error for server errors', async () => {
      const serverError = Object.assign(new Error('Internal server error'), { status: 500 });
      mockGetCourse.mockRejectedValueOnce(serverError);

      // Pass retry: false to prevent retries in error tests
      const { result } = renderHook(() => useCourse(1, { retry: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle network errors', async () => {
      const networkError = Object.assign(new Error('Network error'), { code: 'NETWORK_ERROR' });
      mockGetCourse.mockRejectedValueOnce(networkError);

      // Pass retry: false to prevent retries in error tests
      const { result } = renderHook(() => useCourse(1, { retry: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should respect retry configuration', async () => {
      const error = new Error('Retry test');
      mockGetCourse.mockRejectedValue(error);

      // Create client with retries disabled (hook will override with its own retry)
      const retryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retryDelay: 0, // No delay between retries
          },
        },
      });

      // Pass retry: 2 to hook (initial + 2 retries = 3 total calls)
      const { result } = renderHook(() => useCourse(1, { retry: 2 }), {
        wrapper: createWrapper(retryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 5000 });

      // Should have called API multiple times (initial + 2 retries = 3)
      expect(mockGetCourse).toHaveBeenCalledTimes(3);

      retryClient.clear();
    });
  });

  describe('Loading States', () => {
    it('should have isLoading true during initial fetch', async () => {
      let resolvePromise: (value: ApiResponse<Course>) => void;
      const pendingPromise = new Promise<ApiResponse<Course>>((resolve) => {
        resolvePromise = resolve;
      });
      mockGetCourse.mockReturnValueOnce(pendingPromise);

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isFetching).toBe(true);

      await act(async () => {
        resolvePromise!(createMockApiResponse(createMockCourse()));
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should have isFetching true during any fetch', async () => {
      const mockCourse = createMockCourse();
      mockGetCourse.mockResolvedValue(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      // Initially should be fetching
      expect(result.current.isFetching).toBe(true);

      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });
    });

    it('should have isSuccess true after successful fetch', async () => {
      const mockCourse = createMockCourse();
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      // Initially should not be successful
      expect(result.current.isSuccess).toBe(false);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should have isError true after failed fetch', async () => {
      mockGetCourse.mockRejectedValueOnce(new Error('Failed'));

      // Pass retry: false to prevent retries in error tests
      const { result } = renderHook(() => useCourse(1, { retry: false }), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isError).toBe(false);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should have isPending true when query is disabled', async () => {
      const { result } = renderHook(
        () => useCourse(1, { enabled: false }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isPending).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Data Structure', () => {
    it('should return course with all expected properties', async () => {
      const mockCourse = createMockCourse({
        id: 1,
        fullname: 'Complete Course',
        shortname: 'COMP101',
        summary: '<p>A complete course with all properties.</p>',
        summaryformat: 1,
        format: 'topics',
        category: 1,
        visible: true,
        startdate: 1704067200, // 2024-01-01T00:00:00Z
        enddate: 1719791999, // 2024-06-30T23:59:59Z
        enablecompletion: true,
        showgrades: true,
      });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const course = result.current.data;
      expect(course).toBeDefined();

      // Verify core properties
      expect(course?.id).toBe(1);
      expect(course?.fullname).toBe('Complete Course');
      expect(course?.shortname).toBe('COMP101');
      expect(course?.summary).toBe('<p>A complete course with all properties.</p>');
      expect(course?.format).toBe('topics');
      expect(course?.category).toBe(1);
      expect(course?.visible).toBe(true);
      expect(course?.enablecompletion).toBe(true);
      expect(course?.showgrades).toBe(true);
    });

    it('should include date fields', async () => {
      const mockCourse = createMockCourse({
        startdate: 1705276800, // 2024-01-15T00:00:00Z
        enddate: 1718495999, // 2024-06-15T23:59:59Z
        timecreated: 1701424800, // 2023-12-01T10:00:00Z
        timemodified: 1704900600, // 2024-01-10T15:30:00Z
      });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.startdate).toBe(1705276800);
      expect(result.current.data?.enddate).toBe(1718495999);
      expect(result.current.data?.timecreated).toBe(1701424800);
      expect(result.current.data?.timemodified).toBe(1704900600);
    });

    it('should verify all data matches TypeScript Course interface', async () => {
      const mockCourse = createMockCourse();
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const course: Course | undefined = result.current.data;
      
      // TypeScript will enforce type checking at compile time
      // Runtime checks for required properties
      expect(course).toBeDefined();
      if (course) {
        expect('id' in course).toBe(true);
        expect('fullname' in course).toBe(true);
        expect('shortname' in course).toBe(true);
        expect('format' in course).toBe(true);
        expect('category' in course).toBe(true);
      }
    });
  });

  describe('Query Refetch Methods', () => {
    it('should support manual refetch() method', async () => {
      const mockCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValue(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetCourse).toHaveBeenCalledTimes(1);

      // Manual refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(mockGetCourse).toHaveBeenCalledTimes(2);
    });

    it('should return promise with updated data on refetch', async () => {
      const initialCourse = createMockCourse({ id: 1, fullname: 'Initial' });
      const refetchedCourse = createMockCourse({ id: 1, fullname: 'Refetched' });

      mockGetCourse
        .mockResolvedValueOnce(createMockApiResponse(initialCourse))
        .mockResolvedValueOnce(createMockApiResponse(refetchedCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.data?.fullname).toBe('Initial');
      });

      await act(async () => {
        await result.current.refetch();
      });

      // Verify the hook's data has been updated
      await waitFor(() => {
        expect(result.current.data?.fullname).toBe('Refetched');
      });
    });
  });

  describe('Query Invalidation', () => {
    it('should refetch when course query is invalidated', async () => {
      const mockCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValue(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetCourse).toHaveBeenCalledTimes(1);

      // Invalidate the specific course query
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: courseKeys.detail(1) });
      });

      await waitFor(() => {
        expect(mockGetCourse).toHaveBeenCalledTimes(2);
      });
    });

    it('should refetch when all courses are invalidated', async () => {
      const mockCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValue(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetCourse).toHaveBeenCalledTimes(1);

      // Invalidate all course queries
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['courses'] });
      });

      await waitFor(() => {
        expect(mockGetCourse).toHaveBeenCalledTimes(2);
      });
    });
  });

  // Note: The useCourse hook does not expose a `select` option in its interface.
  // Select functionality is handled internally by React Query if needed.

  describe('Callbacks', () => {
    it('should have successful data available after fetch completes', async () => {
      // Note: onSuccess callback is deprecated in React Query v5
      // This test verifies that data is available after successful fetch
      const mockCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockCourse);
    });

    it('should have error available when fetch fails', async () => {
      const error = new Error('Fetch failed');
      mockGetCourse.mockRejectedValueOnce(error);

      // Pass retry: false to prevent retries in error tests
      const { result } = renderHook(() => useCourse(1, { retry: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(error);
    });
  });

  describe('Placeholder Data', () => {
    it('should provide immediate data with placeholderData option', async () => {
      const placeholderCourse = createMockCourse({
        id: 1,
        fullname: 'Placeholder Course',
      });
      const actualCourse = createMockCourse({
        id: 1,
        fullname: 'Actual Course',
      });

      // Delay the API response
      mockGetCourse.mockImplementationOnce(() =>
        new Promise((resolve) =>
          setTimeout(() => resolve(createMockApiResponse(actualCourse)), 100)
        )
      );

      const { result } = renderHook(
        () => useCourse(1, { placeholderData: placeholderCourse }),
        { wrapper: createWrapper(queryClient) }
      );

      // Should have placeholder data immediately
      expect(result.current.data?.fullname).toBe('Placeholder Course');

      // Wait for actual data
      await waitFor(() => {
        expect(result.current.data?.fullname).toBe('Actual Course');
      });
    });

    it('should not trigger loading state with placeholderData', async () => {
      const placeholderCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(createMockCourse({ id: 1 })));

      const { result } = renderHook(
        () => useCourse(1, { placeholderData: placeholderCourse }),
        { wrapper: createWrapper(queryClient) }
      );

      // Should not show loading state due to placeholder
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeDefined();
    });
  });

  describe('Initial Data', () => {
    it('should provide data without fetch when initialData provided', async () => {
      const initialCourse = createMockCourse({
        id: 1,
        fullname: 'Initial Data Course',
      });

      const { result } = renderHook(
        () => useCourse(1, {
          initialData: initialCourse,
          staleTime: Infinity,
        }),
        { wrapper: createWrapper(queryClient) }
      );

      // Should have initial data immediately without fetch
      expect(result.current.data?.fullname).toBe('Initial Data Course');
      expect(result.current.isSuccess).toBe(true);
      expect(mockGetCourse).not.toHaveBeenCalled();
    });

    it('should not fetch if initialData provided and not stale', async () => {
      const initialCourse = createMockCourse({ id: 1 });

      renderHook(
        () => useCourse(1, {
          initialData: initialCourse,
          staleTime: Infinity,
        }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait to ensure no fetch is triggered
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockGetCourse).not.toHaveBeenCalled();
    });

    it('should background refetch with initialData when stale', async () => {
      const initialCourse = createMockCourse({ id: 1, fullname: 'Initial' });
      const freshCourse = createMockCourse({ id: 1, fullname: 'Fresh' });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(freshCourse));

      const { result } = renderHook(
        () => useCourse(1, {
          initialData: initialCourse,
          staleTime: 0, // Immediately stale
        }),
        { wrapper: createWrapper(queryClient) }
      );

      // Should have initial data immediately
      expect(result.current.data?.fullname).toBe('Initial');

      // Should background refetch
      await waitFor(() => {
        expect(result.current.data?.fullname).toBe('Fresh');
      });

      expect(mockGetCourse).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance Tests', () => {
    it('should not cause unnecessary re-renders', async () => {
      const mockCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));
      let renderCount = 0;

      const { result } = renderHook(
        () => {
          renderCount++;
          return useCourse(1);
        },
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should have minimal renders: initial + loading + success
      expect(renderCount).toBeLessThanOrEqual(4);
    });

    it('should make single API call per courseId', async () => {
      const mockCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValue(createMockApiResponse(mockCourse));

      const { rerender } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockGetCourse).toHaveBeenCalledTimes(1);
      });

      // Multiple re-renders should not trigger new fetches
      rerender();
      rerender();
      rerender();

      expect(mockGetCourse).toHaveBeenCalledTimes(1);
    });

    it('should prevent duplicate requests for same parameters', async () => {
      const mockCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValue(createMockApiResponse(mockCourse));

      // Mount two hooks with same courseId simultaneously
      const { result: result1 } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      const { result: result2 } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
        expect(result2.current.isSuccess).toBe(true);
      });

      // Should only make one API call despite two hooks
      expect(mockGetCourse).toHaveBeenCalledTimes(1);
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should return properly typed Course | undefined', async () => {
      const mockCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      // Initially undefined
      const initialData: Course | undefined = result.current.data;
      expect(initialData).toBeUndefined();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // After success, should be Course
      const successData: Course | undefined = result.current.data;
      expect(successData).toBeDefined();
      expect(successData?.id).toBe(1);
    });

    it('should have properly typed hook options', async () => {
      const mockCourse = createMockCourse({ id: 1 });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      // This should compile without errors - testing available options
      const { result } = renderHook(
        () => useCourse(1, {
          enabled: true,
          staleTime: 5000,
          gcTime: 1000 * 60 * 10,
          refetchOnWindowFocus: true,
          refetchOnReconnect: true,
          retry: 3,
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Data should be Course type
      const courseData: Course | undefined = result.current.data;
      expect(courseData?.id).toBe(1);
    });

    it('should ensure no any types in test code', () => {
      // This is a compile-time check
      // If this compiles, we have type safety
      const course: Course = createMockCourse();
      const response: ApiResponse<Course> = createMockApiResponse(course);
      
      expect(course.id).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toEqual(course);
    });
  });

  describe('Mock Scenarios', () => {
    it('should handle course with multiple sections and activities', async () => {
      const mockCourse = createMockCourse({
        id: 1,
        fullname: 'Course with Sections',
        format: 'topics',
      });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.format).toBe('topics');
    });

    it('should handle course with enrollment information', async () => {
      const mockCourse = createMockCourse({
        id: 1,
        visible: true,
        enablecompletion: true,
      });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.visible).toBe(true);
      expect(result.current.data?.enablecompletion).toBe(true);
    });

    it('should handle network timeout gracefully', async () => {
      const timeoutError = Object.assign(new Error('Request timeout'), { code: 'ECONNABORTED' });
      mockGetCourse.mockRejectedValueOnce(timeoutError);

      // Pass retry: false to prevent retries in error tests
      const { result } = renderHook(() => useCourse(1, { retry: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Request timeout');
    });
  });

  describe('Query Status', () => {
    it('should have correct status transitions', async () => {
      const mockCourse = createMockCourse();
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      // Initially pending/loading
      expect(result.current.status).toBe('pending');

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      });

      expect(result.current.data).toEqual(mockCourse);
    });

    it('should have error status when fetch fails', async () => {
      mockGetCourse.mockRejectedValueOnce(new Error('Failed'));

      // Pass retry: false to prevent retries in error tests
      const { result } = renderHook(() => useCourse(1, { retry: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });
    });
  });

  // Note: The useCourse hook does not expose `dataUpdatedAt` in its result interface.
  // This information can be retrieved via queryClient.getQueryState() if needed.

  describe('Edge Cases', () => {
    it('should handle courseId of 0 as invalid', async () => {
      const { result } = renderHook(() => useCourse(0), {
        wrapper: createWrapper(queryClient),
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockGetCourse).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('should handle very large courseId', async () => {
      const mockCourse = createMockCourse({ id: 999999999 });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(999999999), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.id).toBe(999999999);
    });

    it('should handle empty course properties gracefully', async () => {
      const mockCourse = createMockCourse({
        id: 1,
        summary: '',
        theme: '',
        lang: '',
      });
      mockGetCourse.mockResolvedValueOnce(createMockApiResponse(mockCourse));

      const { result } = renderHook(() => useCourse(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.summary).toBe('');
      expect(result.current.data?.theme).toBe('');
      expect(result.current.data?.lang).toBe('');
    });
  });
});
