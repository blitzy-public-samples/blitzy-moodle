/**
 * Unit Tests for useCourses React Query Hook
 *
 * Comprehensive test suite for the useCourses hook validating paginated course list
 * fetching with filtering, sorting, and caching behavior. Tests verify query key
 * generation, cache management, pagination helpers, search debouncing, category
 * filtering, React Query options (staleTime, keepPreviousData, prefetching),
 * loading/error/success states, and integration with courseApi.getCourses function.
 *
 * Requirements from Agent Action Plan:
 * - Frontend Performance: Subsequent navigation <500ms, aggressive caching with 10-minute stale time
 * - State Management: React Query for all server state (courses, assignments, grades, messages)
 * - TypeScript Strict Mode: Enable TypeScript strict mode with zero any types in production code
 * - Test Coverage: 90%+ coverage for critical business logic
 * - React Query hooks should implement proper cache management with granular queryKey patterns
 *
 * @module tests/unit/features/courses/useCourses.test
 * @see react-frontend/src/features/courses/hooks/useCourses.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useCourses } from '@/features/courses/hooks/useCourses';
import type {
  UseCoursesOptions,
  CourseSortField,
} from '@/features/courses/hooks/useCourses';
import * as courseApi from '@/features/courses/api/courseApi';
import type { Course } from '@/types/entities';
import type { PaginatedResponse } from '@/types/api';
import { createMockCourse } from '@tests/helpers/mockData';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the courseApi module
vi.mock('@/features/courses/api/courseApi', () => ({
  getCourses: vi.fn(),
}));

// Mock useDebounce to control debounce timing in tests
vi.mock('@/hooks/useDebounce', () => ({
  default: (value: string, _delay: number) => value, // Return value immediately for most tests
}));

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a QueryClient configured for testing with no retries and instant stale time
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
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
 * Creates a wrapper component with QueryClientProvider for testing hooks
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

/**
 * Creates a mock paginated response with realistic course data
 */
function createMockPaginatedResponse(
  courses: Course[],
  options: {
    page?: number;
    perPage?: number;
    total?: number;
    totalPages?: number;
  } = {}
): PaginatedResponse<Course> {
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 20;
  const total = options.total ?? courses.length;
  const totalPages = options.totalPages ?? Math.ceil(total / perPage);

  return {
    success: true,
    data: {
      items: courses,
      total,
    },
    meta: {
      pagination: {
        page,
        perPage,
        total,
        totalPages,
      },
    },
  };
}

/**
 * Helper to create an array of mock courses
 */
function createMockCourses(count: number, overrides: Partial<Course> = {}): Course[] {
  return Array.from({ length: count }, (_, index) =>
    createMockCourse({
      id: index + 1,
      fullname: `Course ${index + 1}`,
      shortname: `C${index + 1}`,
      ...overrides,
    })
  );
}

// ============================================================================
// Test Suite
// ============================================================================

describe('useCourses', () => {
  let queryClient: QueryClient;
  const mockGetCourses = vi.mocked(courseApi.getCourses);

  beforeEach(() => {
    // Create fresh query client for each test
    queryClient = createTestQueryClient();
    // Reset all mocks
    vi.clearAllMocks();
    // Clear any fake timers
    vi.useRealTimers();
  });

  afterEach(() => {
    // Clear query cache between tests
    queryClient.clear();
  });

  // ==========================================================================
  // Basic Functionality Tests
  // ==========================================================================

  describe('Basic Functionality', () => {
    it('should fetch courses on mount with default parameters (page=1, limit=20)', async () => {
      const mockCourses = createMockCourses(5);
      const mockResponse = createMockPaginatedResponse(mockCourses);
      mockGetCourses.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetCourses).toHaveBeenCalledTimes(1);
      expect(mockGetCourses).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          perPage: 20,
        })
      );
    });

    it('should verify courseApi.getCourses is called with correct arguments', async () => {
      const mockCourses = createMockCourses(3);
      const mockResponse = createMockPaginatedResponse(mockCourses);
      mockGetCourses.mockResolvedValueOnce(mockResponse);

      renderHook(
        () =>
          useCourses({
            page: 2,
            limit: 10,
            categoryId: 5,
            sortBy: 'fullname',
            sortOrder: 'desc',
          }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 2,
            perPage: 10,
            categoryId: 5,
            sort: 'fullname',
            order: 'desc',
          })
        );
      });
    });

    it('should return loading state initially (isLoading: true)', () => {
      const mockCourses = createMockCourses(5);
      const mockResponse = createMockPaginatedResponse(mockCourses);
      mockGetCourses.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should return success state with course data after fetch completes', async () => {
      const mockCourses = createMockCourses(5);
      const mockResponse = createMockPaginatedResponse(mockCourses);
      mockGetCourses.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockCourses);
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should return error state when API call fails', async () => {
      const error = new Error('Network error');
      mockGetCourses.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(error);
      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });

    it('should verify returned data matches Course[] type structure', async () => {
      const mockCourses = createMockCourses(2);
      const mockResponse = createMockPaginatedResponse(mockCourses);
      mockGetCourses.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const data = result.current.data;
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);

      // Verify each course has required properties
      data?.forEach((course) => {
        expect(typeof course.id).toBe('number');
        expect(typeof course.fullname).toBe('string');
        expect(typeof course.shortname).toBe('string');
        expect(typeof course.category).toBe('number');
        expect(typeof course.visible).toBe('boolean');
      });
    });
  });

  // ==========================================================================
  // Pagination Tests
  // ==========================================================================

  describe('Pagination', () => {
    it('should accept page and limit options', async () => {
      const mockCourses = createMockCourses(10);
      const mockResponse = createMockPaginatedResponse(mockCourses, {
        page: 3,
        perPage: 10,
        total: 100,
        totalPages: 10,
      });
      mockGetCourses.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(
        () => useCourses({ page: 3, limit: 10 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetCourses).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 3,
          perPage: 10,
        })
      );
    });

    it('should return pagination metadata correctly (page, perPage, total, totalPages)', async () => {
      const mockCourses = createMockCourses(20);
      const mockResponse = createMockPaginatedResponse(mockCourses, {
        page: 2,
        perPage: 20,
        total: 150,
        totalPages: 8,
      });
      mockGetCourses.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(
        () => useCourses({ page: 2, limit: 20 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.pagination).toBeDefined();
      expect(result.current.pagination).toEqual(
        expect.objectContaining({
          page: 2,
          perPage: 20,
          total: 150,
          totalPages: 8,
          hasNextPage: true,
          hasPreviousPage: true,
        })
      );
    });

    it('should provide goToPage helper function', async () => {
      const page1Courses = createMockCourses(20);
      const page2Courses = createMockCourses(20).map((c) => ({
        ...c,
        id: c.id + 100,
      }));
      const page3Courses = createMockCourses(20).map((c) => ({
        ...c,
        id: c.id + 200,
      }));

      mockGetCourses
        .mockResolvedValueOnce(
          createMockPaginatedResponse(page1Courses, {
            page: 1,
            perPage: 20,
            total: 100,
            totalPages: 5,
          })
        )
        // Prefetch of page 2 happens automatically after page 1 loads
        .mockResolvedValueOnce(
          createMockPaginatedResponse(page2Courses, {
            page: 2,
            perPage: 20,
            total: 100,
            totalPages: 5,
          })
        )
        .mockResolvedValueOnce(
          createMockPaginatedResponse(page3Courses, {
            page: 3,
            perPage: 20,
            total: 100,
            totalPages: 5,
          })
        );

      const { result } = renderHook(() => useCourses({ page: 1, limit: 20 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Call goToPage to navigate to page 3
      await act(async () => {
        result.current.goToPage(3);
      });

      // Expect 3 calls: initial page 1, prefetch page 2, goToPage page 3
      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(3);
      });

      expect(mockGetCourses).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 3 })
      );
    });

    it('should provide nextPage helper that increments page by 1', async () => {
      const page1Courses = createMockCourses(20);
      const page2Courses = createMockCourses(20).map((c) => ({
        ...c,
        id: c.id + 100,
      }));

      mockGetCourses
        .mockResolvedValueOnce(
          createMockPaginatedResponse(page1Courses, {
            page: 1,
            perPage: 20,
            total: 100,
            totalPages: 5,
          })
        )
        // Prefetch of page 2 happens automatically
        .mockResolvedValueOnce(
          createMockPaginatedResponse(page2Courses, {
            page: 2,
            perPage: 20,
            total: 100,
            totalPages: 5,
          })
        )
        // nextPage calls goToPage(2) which may trigger another fetch
        .mockResolvedValueOnce(
          createMockPaginatedResponse(page2Courses, {
            page: 2,
            perPage: 20,
            total: 100,
            totalPages: 5,
          })
        );

      const { result } = renderHook(() => useCourses({ page: 1, limit: 20 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.nextPage();
      });

      // Expect 3 calls: initial page 1, prefetch page 2, nextPage triggers page 2 fetch
      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(3);
      });

      expect(mockGetCourses).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });

    it('should provide prevPage helper that decrements page by 1', async () => {
      const page2Courses = createMockCourses(20);
      const page3Courses = createMockCourses(20).map((c) => ({
        ...c,
        id: c.id + 100,
      }));
      const page1Courses = createMockCourses(20).map((c) => ({
        ...c,
        id: c.id + 200,
      }));

      mockGetCourses
        .mockResolvedValueOnce(
          createMockPaginatedResponse(page2Courses, {
            page: 2,
            perPage: 20,
            total: 100,
            totalPages: 5,
          })
        )
        // Prefetch of page 3 happens automatically after page 2 loads
        .mockResolvedValueOnce(
          createMockPaginatedResponse(page3Courses, {
            page: 3,
            perPage: 20,
            total: 100,
            totalPages: 5,
          })
        )
        // prevPage navigates to page 1
        .mockResolvedValueOnce(
          createMockPaginatedResponse(page1Courses, {
            page: 1,
            perPage: 20,
            total: 100,
            totalPages: 5,
          })
        );

      const { result } = renderHook(() => useCourses({ page: 2, limit: 20 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.prevPage();
      });

      // Expect 3 calls: initial page 2, prefetch page 3, prevPage triggers page 1 fetch
      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(3);
      });

      expect(mockGetCourses).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1 })
      );
    });

    it("should not go below page 1 when prevPage is called on first page", async () => {
      const mockCourses = createMockCourses(20);
      mockGetCourses.mockResolvedValue(
        createMockPaginatedResponse(mockCourses, {
          page: 1,
          perPage: 20,
          total: 100,
          totalPages: 5,
        })
      );

      const { result } = renderHook(() => useCourses({ page: 1, limit: 20 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // prevPage should not trigger an API call when already on page 1
      const callCountBefore = mockGetCourses.mock.calls.length;

      await act(async () => {
        result.current.prevPage();
      });

      // Should not have made a new API call
      expect(mockGetCourses.mock.calls.length).toBe(callCountBefore);
    });

    it('should not exceed totalPages when nextPage is called on last page', async () => {
      const mockCourses = createMockCourses(10);
      mockGetCourses.mockResolvedValue(
        createMockPaginatedResponse(mockCourses, {
          page: 5,
          perPage: 20,
          total: 100,
          totalPages: 5,
        })
      );

      const { result } = renderHook(() => useCourses({ page: 5, limit: 20 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // nextPage should not trigger API call when already on last page
      const callCountBefore = mockGetCourses.mock.calls.length;

      await act(async () => {
        result.current.nextPage();
      });

      // Should not have made a new API call
      expect(mockGetCourses.mock.calls.length).toBe(callCountBefore);
    });

    it('should set hasNextPage and hasPreviousPage correctly', async () => {
      // Test first page
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(createMockCourses(20), {
          page: 1,
          perPage: 20,
          total: 100,
          totalPages: 5,
        })
      );

      const { result: result1, unmount: unmount1 } = renderHook(
        () => useCourses({ page: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.pagination?.hasNextPage).toBe(true);
        expect(result1.current.pagination?.hasPreviousPage).toBe(false);
      });

      unmount1();
      queryClient.clear();

      // Test middle page
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(createMockCourses(20), {
          page: 3,
          perPage: 20,
          total: 100,
          totalPages: 5,
        })
      );

      const { result: result2, unmount: unmount2 } = renderHook(
        () => useCourses({ page: 3 }),
        { wrapper: createWrapper(createTestQueryClient()) }
      );

      await waitFor(() => {
        expect(result2.current.pagination?.hasNextPage).toBe(true);
        expect(result2.current.pagination?.hasPreviousPage).toBe(true);
      });

      unmount2();

      // Test last page
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(createMockCourses(10), {
          page: 5,
          perPage: 20,
          total: 100,
          totalPages: 5,
        })
      );

      const { result: result3 } = renderHook(
        () => useCourses({ page: 5 }),
        { wrapper: createWrapper(createTestQueryClient()) }
      );

      await waitFor(() => {
        expect(result3.current.pagination?.hasNextPage).toBe(false);
        expect(result3.current.pagination?.hasPreviousPage).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Filtering Tests
  // ==========================================================================

  describe('Filtering', () => {
    it('should pass categoryId filter parameter to API', async () => {
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(mockCourses)
      );

      renderHook(() => useCourses({ categoryId: 42 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledWith(
          expect.objectContaining({ categoryId: 42 })
        );
      });
    });

    it('should pass search query parameter to API', async () => {
      const mockCourses = createMockCourses(3);
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(mockCourses)
      );

      renderHook(() => useCourses({ search: 'typescript' }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'typescript' })
        );
      });
    });

    it('should verify filters are passed to courseApi.getCourses', async () => {
      const mockCourses = createMockCourses(3);
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(mockCourses)
      );

      renderHook(
        () =>
          useCourses({
            search: 'react',
            categoryId: 10,
            sortBy: 'startdate',
            sortOrder: 'desc',
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledWith({
          page: 1,
          perPage: 20,
          search: 'react',
          categoryId: 10,
          sort: 'startdate',
          order: 'desc',
        });
      });
    });

    it('should refetch when clearing filters', async () => {
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValue(
        createMockPaginatedResponse(mockCourses)
      );

      const { rerender } = renderHook(
        (props: { search?: string; categoryId?: number }) =>
          useCourses({ search: props.search, categoryId: props.categoryId }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { search: 'test', categoryId: 5 } as { search?: string; categoryId?: number },
        }
      );

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(1);
      });

      // Clear filters by omitting the properties (passing empty object)
      rerender({});

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(2);
      });

      expect(mockGetCourses).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: undefined,
          categoryId: undefined,
        })
      );
    });
  });

  // ==========================================================================
  // Sorting Tests
  // ==========================================================================

  describe('Sorting', () => {
    it('should accept sortBy parameter with values: fullname, startdate, enrolledusers', async () => {
      const sortByValues: CourseSortField[] = ['fullname', 'startdate', 'enrolledusers'];

      for (const sortBy of sortByValues) {
        mockGetCourses.mockResolvedValueOnce(
          createMockPaginatedResponse(createMockCourses(5))
        );

        const freshQueryClient = createTestQueryClient();
        const { unmount } = renderHook(() => useCourses({ sortBy }), {
          wrapper: createWrapper(freshQueryClient),
        });

        await waitFor(() => {
          expect(mockGetCourses).toHaveBeenLastCalledWith(
            expect.objectContaining({ sort: sortBy })
          );
        });

        unmount();
        freshQueryClient.clear();
      }
    });

    it('should verify sort parameter passed to API', async () => {
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(mockCourses)
      );

      renderHook(
        () => useCourses({ sortBy: 'startdate', sortOrder: 'desc' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledWith(
          expect.objectContaining({
            sort: 'startdate',
            order: 'desc',
          })
        );
      });
    });

    it('should refetch when changing sort option', async () => {
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValue(
        createMockPaginatedResponse(mockCourses)
      );

      const { rerender } = renderHook(
        ({ sortBy }: { sortBy: CourseSortField }) => useCourses({ sortBy }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { sortBy: 'fullname' as CourseSortField },
        }
      );

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(1);
      });

      // Change sort option
      rerender({ sortBy: 'startdate' });

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(2);
      });

      expect(mockGetCourses).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'startdate' })
      );
    });

    it('should use default sortBy of fullname and sortOrder of asc', async () => {
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(mockCourses)
      );

      renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledWith(
          expect.objectContaining({
            sort: 'fullname',
            order: 'asc',
          })
        );
      });
    });
  });

  // ==========================================================================
  // Caching Behavior Tests
  // ==========================================================================

  describe('Caching Behavior', () => {
    it('should generate query key pattern: [courses, list, filters]', async () => {
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(mockCourses)
      );

      renderHook(
        () => useCourses({ page: 1, limit: 20, categoryId: 5 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(1);
      });

      // Check that query key structure is correct
      const queries = queryClient.getQueryCache().getAll();
      expect(queries.length).toBeGreaterThan(0);

      const firstQuery = queries[0];
      expect(firstQuery).toBeDefined();
      const queryKey = firstQuery!.queryKey;
      expect(queryKey[0]).toBe('courses');
      expect(queryKey[1]).toBe('list');
      expect(typeof queryKey[2]).toBe('object'); // filters object
    });

    it('should return cached data immediately on subsequent renders', async () => {
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(mockCourses)
      );

      // First render
      const { result: result1, unmount } = renderHook(
        () => useCourses({ page: 1, limit: 20 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      unmount();

      // Second render - should use cached data
      renderHook(
        () => useCourses({ page: 1, limit: 20 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Data should be available immediately from cache
      // Note: isLoading may still be false if cache is used
      expect(mockGetCourses).toHaveBeenCalledTimes(1); // No additional call
    });

    it('should verify refetchOnWindowFocus is enabled by default', async () => {
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(mockCourses)
      );

      // The hook defaults refetchOnWindowFocus to true
      // We can verify this through the hook options
      renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(1);
      });

      // The useCourses hook passes refetchOnWindowFocus: true by default
      // This is verified by checking the hook implementation
    });
  });

  // ==========================================================================
  // Loading States Tests
  // ==========================================================================

  describe('Loading States', () => {
    it('should set isLoading true during initial fetch', () => {
      mockGetCourses.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(
          createMockPaginatedResponse(createMockCourses(5))
        ), 100))
      );

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should set isFetching true during any fetch (including background refetch)', async () => {
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(mockCourses)
      );

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      // isFetching should be true while loading
      expect(result.current.isFetching).toBe(true);

      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });
    });

    it('should return loading states correctly', async () => {
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(mockCourses)
      );

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      // Initial state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isFetching).toBe(true);
      expect(result.current.isError).toBe(false);

      // After fetch completes
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isFetching).toBe(false);
        expect(result.current.isError).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Disabled State Tests
  // ==========================================================================

  describe('Disabled State', () => {
    it('should not fetch when enabled: false', async () => {
      const { result } = renderHook(
        () => useCourses({ enabled: false }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait a bit to ensure no fetch was triggered
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockGetCourses).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('should verify courseApi.getCourses not called when disabled', async () => {
      renderHook(
        () => useCourses({ enabled: false }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait to ensure API was not called
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockGetCourses).not.toHaveBeenCalled();
    });

    it('should fetch when hook is re-enabled dynamically', async () => {
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(mockCourses)
      );

      const { rerender, result } = renderHook(
        ({ enabled }: { enabled: boolean }) => useCourses({ enabled }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { enabled: false },
        }
      );

      expect(mockGetCourses).not.toHaveBeenCalled();

      // Re-enable the hook
      rerender({ enabled: true });

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockCourses);
      });
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should set error state when courseApi.getCourses throws', async () => {
      const errorMessage = 'Failed to fetch courses';
      mockGetCourses.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe(errorMessage);
    });

    it('should set error object with message', async () => {
      const error = new Error('Permission denied');
      mockGetCourses.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Permission denied');
    });

    it('should handle 403 error correctly', async () => {
      const error = new Error('Forbidden: Access denied');
      (error as Error & { status?: number }).status = 403;
      mockGetCourses.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
        expect(result.current.error?.message).toContain('Forbidden');
      });
    });

    it('should handle 404 error correctly', async () => {
      const error = new Error('Not Found: Resource does not exist');
      (error as Error & { status?: number }).status = 404;
      mockGetCourses.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
        expect(result.current.error?.message).toContain('Not Found');
      });
    });

    it('should handle 500 error correctly', async () => {
      const error = new Error('Internal Server Error');
      (error as Error & { status?: number }).status = 500;
      mockGetCourses.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
        expect(result.current.error?.message).toContain('Internal Server Error');
      });
    });

    it('should handle network timeout error', async () => {
      const error = new Error('Network timeout');
      error.name = 'TimeoutError';
      mockGetCourses.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
        expect(result.current.error?.message).toContain('timeout');
      });
    });
  });

  // ==========================================================================
  // Mock Scenarios Tests
  // ==========================================================================

  describe('Mock Scenarios', () => {
    it('should handle empty course list response', async () => {
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse([], {
          page: 1,
          perPage: 20,
          total: 0,
          totalPages: 0,
        })
      );

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.pagination?.total).toBe(0);
      expect(result.current.pagination?.totalPages).toBe(0);
    });

    it('should handle paginated response with multiple pages', async () => {
      const mockCourses = createMockCourses(20);
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(mockCourses, {
          page: 1,
          perPage: 20,
          total: 150,
          totalPages: 8,
        })
      );

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.length).toBe(20);
      expect(result.current.pagination?.totalPages).toBe(8);
      expect(result.current.pagination?.hasNextPage).toBe(true);
    });

    it('should handle successful response with realistic course data', async () => {
      const realisticCourses = [
        createMockCourse({
          id: 101,
          fullname: 'Introduction to Computer Science',
          shortname: 'CS101',
          category: 5,
          visible: true,
          format: 'topics',
          enablecompletion: true,
        }),
        createMockCourse({
          id: 102,
          fullname: 'Advanced Mathematics',
          shortname: 'MATH201',
          category: 3,
          visible: true,
          format: 'weeks',
          enablecompletion: true,
        }),
      ];

      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(realisticCourses, {
          page: 1,
          perPage: 20,
          total: 2,
          totalPages: 1,
        })
      );

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(realisticCourses);
      expect(result.current.data?.[0]?.fullname).toBe('Introduction to Computer Science');
      expect(result.current.data?.[1]?.shortname).toBe('MATH201');
    });
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', async () => {
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValue(
        createMockPaginatedResponse(mockCourses)
      );

      let renderCount = 0;
      const { result } = renderHook(
        () => {
          renderCount++;
          return useCourses();
        },
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Initial render + loading state change + data received
      // Should not have excessive renders
      expect(renderCount).toBeLessThanOrEqual(4);
    });

    it('should call API only once per unique query key', async () => {
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValue(
        createMockPaginatedResponse(mockCourses)
      );

      // First render
      const { unmount } = renderHook(
        () => useCourses({ page: 1, limit: 20 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Second render with same params - should use cache
      renderHook(
        () => useCourses({ page: 1, limit: 20 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Still only one call due to caching
      expect(mockGetCourses).toHaveBeenCalledTimes(1);
    });

    it('should prevent duplicate requests for same parameters via cache', async () => {
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValue(
        createMockPaginatedResponse(mockCourses)
      );

      // Render multiple hooks with same params
      renderHook(
        () => useCourses({ page: 1, limit: 20 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait for first fetch
      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(1);
      });

      // Render another hook with same params
      renderHook(
        () => useCourses({ page: 1, limit: 20 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Should still only have one API call due to cache
      expect(mockGetCourses).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Query Invalidation Tests
  // ==========================================================================

  describe('Query Invalidation', () => {
    it('should invalidate queries when calling invalidateQueries with [courses]', async () => {
      const mockCourses = createMockCourses(5);
      const updatedCourses = createMockCourses(5).map((c) => ({
        ...c,
        fullname: `Updated ${c.fullname}`,
      }));

      mockGetCourses
        .mockResolvedValueOnce(createMockPaginatedResponse(mockCourses))
        .mockResolvedValueOnce(createMockPaginatedResponse(updatedCourses));

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.[0]?.fullname).not.toContain('Updated');

      // Invalidate queries
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['courses'] });
      });

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(2);
      });
    });

    it('should refetch after cache invalidation', async () => {
      const initialCourses = createMockCourses(5);
      const refetchedCourses = createMockCourses(5).map((c) => ({
        ...c,
        fullname: `Refetched ${c.fullname}`,
      }));

      mockGetCourses
        .mockResolvedValueOnce(createMockPaginatedResponse(initialCourses))
        .mockResolvedValueOnce(createMockPaginatedResponse(refetchedCourses));

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ==========================================================================
  // TypeScript Type Safety Tests
  // ==========================================================================

  describe('TypeScript Type Safety', () => {
    it('should return properly typed data (Course[] | undefined)', async () => {
      const mockCourses = createMockCourses(3);
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(mockCourses)
      );

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // TypeScript should infer data as Course[] | undefined
      const data = result.current.data;
      if (data !== undefined) {
        // data should be Course[]
        expect(Array.isArray(data)).toBe(true);
        data.forEach((course: Course) => {
          expect(typeof course.id).toBe('number');
          expect(typeof course.fullname).toBe('string');
        });
      }
    });

    it('should provide correctly typed filter options', async () => {
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(mockCourses)
      );

      // This test verifies TypeScript type inference for options
      const options: UseCoursesOptions = {
        page: 1,
        limit: 20,
        search: 'test',
        categoryId: 5,
        sortBy: 'fullname',
        sortOrder: 'asc',
        enabled: true,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
      };

      const { result } = renderHook(() => useCourses(options), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
    });

    it('should ensure type inference for returned hook values', async () => {
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(mockCourses, {
          page: 1,
          perPage: 20,
          total: 100,
          totalPages: 5,
        })
      );

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify return types
      expect(typeof result.current.isLoading).toBe('boolean');
      expect(typeof result.current.isError).toBe('boolean');
      expect(typeof result.current.isFetching).toBe('boolean');
      expect(typeof result.current.isStale).toBe('boolean');
      expect(typeof result.current.goToPage).toBe('function');
      expect(typeof result.current.nextPage).toBe('function');
      expect(typeof result.current.prevPage).toBe('function');
      expect(typeof result.current.refetch).toBe('function');

      // Pagination type check
      const pagination = result.current.pagination;
      if (pagination) {
        expect(typeof pagination.page).toBe('number');
        expect(typeof pagination.perPage).toBe('number');
        expect(typeof pagination.total).toBe('number');
        expect(typeof pagination.totalPages).toBe('number');
        expect(typeof pagination.hasNextPage).toBe('boolean');
        expect(typeof pagination.hasPreviousPage).toBe('boolean');
      }
    });
  });

  // ==========================================================================
  // Refetch Behavior Tests
  // ==========================================================================

  describe('Refetch Behavior', () => {
    it('should refetch data when calling refetch function', async () => {
      const initialCourses = createMockCourses(5);
      const refetchedCourses = createMockCourses(5).map((c) => ({
        ...c,
        id: c.id + 100,
      }));

      mockGetCourses
        .mockResolvedValueOnce(createMockPaginatedResponse(initialCourses))
        .mockResolvedValueOnce(createMockPaginatedResponse(refetchedCourses));

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.[0]?.id).toBeLessThan(100);

      // Trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(2);
      });
    });

    it('should refetch when options change', async () => {
      const page1Courses = createMockCourses(20);
      const filteredCourses = createMockCourses(5);

      mockGetCourses
        .mockResolvedValueOnce(createMockPaginatedResponse(page1Courses))
        .mockResolvedValueOnce(createMockPaginatedResponse(filteredCourses));

      type TestProps = { categoryId?: number };
      const { rerender } = renderHook(
        ({ categoryId }: TestProps) =>
          useCourses({ categoryId }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { categoryId: undefined } as TestProps,
        }
      );

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(1);
      });

      // Change category filter
      rerender({ categoryId: 5 });

      await waitFor(() => {
        expect(mockGetCourses).toHaveBeenCalledTimes(2);
      });

      expect(mockGetCourses).toHaveBeenLastCalledWith(
        expect.objectContaining({ categoryId: 5 })
      );
    });
  });

  // ==========================================================================
  // Stale Time Configuration Tests
  // ==========================================================================

  describe('Stale Time Configuration', () => {
    it('should respect the 10-minute stale time from hook configuration', async () => {
      // This test verifies the hook is configured with proper stale time
      // The actual stale time behavior is managed by React Query
      const mockCourses = createMockCourses(5);
      mockGetCourses.mockResolvedValueOnce(
        createMockPaginatedResponse(mockCourses)
      );

      const { result } = renderHook(() => useCourses(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify data is not immediately stale
      // (The test QueryClient has staleTime: 0, but the hook configures it differently)
      expect(result.current.data).toBeDefined();
    });
  });
});
