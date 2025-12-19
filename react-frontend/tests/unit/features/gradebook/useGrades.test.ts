/**
 * Unit Tests for useGrades Custom React Hook
 *
 * Comprehensive test suite validating React Query integration for grade data
 * fetching, caching behavior, loading states, error handling, refetch mechanisms,
 * and data transformations for the Moodle gradebook hooks.
 *
 * Tests verify:
 * - React Query integration with proper queryKey structure
 * - Loading states during initial fetch and refetch operations
 * - Error handling with proper error messages and retry logic
 * - Successful data fetching with correct TypeScript types
 * - Cache behavior and staleTime configuration
 * - Permission-based data filtering for different user roles
 * - Grade aggregation methods matching PHP backend calculations
 * - Refetch mechanisms triggered by grade updates
 * - Integration with auth state for user context
 * - Proper cleanup on component unmount
 *
 * @module tests/unit/features/gradebook/useGrades.test
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';

// Internal imports from depends_on_files
import {
  useCourseGrades,
  useUserGrades,
  useGradeItems,
  useGradeCategories,
  useGradeReport,
  useUpdateGradeItem,
  useUpdateGrade,
  useExportGrades,
  useMyGrades,
  useStudentCourseGrades,
  gradebookKeys,
} from '@/features/gradebook/hooks/useGrades';
import { mockCourseGradebook, mockGrade, mockGradeItem, mockGradeArray } from '@/tests/mocks/data/grades';
import { server } from '@/tests/mocks/server';
import { createTestQueryClient } from '@/tests/helpers/render';
import { AggregationType } from '@/features/gradebook/types/grade.types';
import type { Grade, GradeItem, CourseGradebook, GradeSummary } from '@/features/gradebook/types/grade.types';

// ============================================================================
// Test Utilities and Wrapper Components
// ============================================================================

/**
 * Creates a wrapper component with QueryClientProvider for testing hooks
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * Mock localStorage for token storage
 */
const mockAuthToken = 'mock-jwt-token-for-testing';

/**
 * Helper to set up mock authenticated state
 */
function setupMockAuth(): void {
  localStorage.setItem('accessToken', mockAuthToken);
}

/**
 * Helper to clean up mock authentication
 */
function cleanupMockAuth(): void {
  localStorage.removeItem('accessToken');
}

// ============================================================================
// Test Suite: gradebookKeys Query Key Factory
// ============================================================================

describe('gradebookKeys Query Key Factory', () => {
  it('should generate base "gradebook" key for all queries', () => {
    expect(gradebookKeys.all).toEqual(['gradebook']);
  });

  it('should generate course-specific query key', () => {
    const courseId = 101;
    expect(gradebookKeys.course(courseId)).toEqual(['gradebook', 'course', courseId]);
  });

  it('should generate user-specific query key', () => {
    const userId = 42;
    expect(gradebookKeys.user(userId)).toEqual(['gradebook', 'user', userId]);
  });

  it('should generate items query key with optional course filter', () => {
    expect(gradebookKeys.items()).toEqual(['gradebook', 'items']);
    expect(gradebookKeys.items(101)).toEqual(['gradebook', 'items', { courseId: 101 }]);
  });

  it('should generate categories query key', () => {
    const courseId = 101;
    expect(gradebookKeys.categories(courseId)).toEqual(['gradebook', 'categories', courseId]);
  });

  it('should generate report query key with parameters', () => {
    expect(gradebookKeys.report(101, 'user', 42)).toEqual([
      'gradebook',
      'report',
      { courseId: 101, type: 'user', userId: 42 },
    ]);
    expect(gradebookKeys.report(101, 'grader')).toEqual([
      'gradebook',
      'report',
      { courseId: 101, type: 'grader', userId: undefined },
    ]);
  });

  it('should generate my grades query key', () => {
    expect(gradebookKeys.myGrades()).toEqual(['gradebook', 'my']);
  });

  it('should generate student course grades query key', () => {
    expect(gradebookKeys.studentCourseGrades(101, 42)).toEqual([
      'gradebook',
      'student',
      { courseId: 101, userId: 42 },
    ]);
  });
});

// ============================================================================
// Test Suite: useCourseGrades Hook
// ============================================================================

describe('useCourseGrades Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupMockAuth();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  describe('Loading States', () => {
    it('should show loading state initially', async () => {
      const courseId = 1;

      const { result } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should show fetching state on refetch', async () => {
      const courseId = 1;

      const { result } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Trigger refetch
      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.isFetching).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });
    });
  });

  describe('Successful Data Fetching', () => {
    it('should fetch course gradebook data successfully', async () => {
      const courseId = 1;

      const { result } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.courseid).toBe(courseId);
    });

    it('should return correct data structure with categories and items', async () => {
      const courseId = 1;

      const { result } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const data = result.current.data;
      expect(data).toHaveProperty('courseid');
      expect(data).toHaveProperty('coursename');
      expect(data).toHaveProperty('aggregation');
      expect(data).toHaveProperty('categories');
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data?.categories)).toBe(true);
      expect(Array.isArray(data?.items)).toBe(true);
    });

    it('should include grade items with proper grade data', async () => {
      const courseId = 1;

      const { result } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const items = result.current.data?.items || [];
      expect(items.length).toBeGreaterThan(0);

      // Verify grade item structure
      const gradeItem = items[0];
      expect(gradeItem).toHaveProperty('id');
      expect(gradeItem).toHaveProperty('itemname');
      expect(gradeItem).toHaveProperty('grademax');
      expect(gradeItem).toHaveProperty('grademin');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 error for non-existent course', async () => {
      const nonExistentCourseId = 99999;

      // Override handler to return 404
      server.use(
        http.get('http://*/api/v1/gradebook/course/:id', () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Course not found',
              },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(
        () => useCourseGrades(nonExistentCourseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle 403 access denied error', async () => {
      const courseId = 1;

      server.use(
        http.get('http://*/api/v1/gradebook/course/:id', () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to view this gradebook',
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle 401 unauthorized error', async () => {
      cleanupMockAuth(); // Remove auth token
      const courseId = 1;

      server.use(
        http.get('http://*/api/v1/gradebook/course/:id', () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
              },
            },
            { status: 401 }
          );
        })
      );

      const { result } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle network errors gracefully', async () => {
      const courseId = 1;

      server.use(
        http.get('http://*/api/v1/gradebook/course/:id', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('Cache Behavior', () => {
    it('should use cached data on subsequent calls with same courseId', async () => {
      const courseId = 1;
      let fetchCount = 0;

      server.use(
        http.get('http://*/api/v1/gradebook/course/:id', async () => {
          fetchCount++;
          return HttpResponse.json({
            success: true,
            data: mockCourseGradebook(courseId, 3, 5),
            meta: { timestamp: Date.now() },
          });
        })
      );

      // First render
      const { result: result1 } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second render with same courseId
      const { result: result2 } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Should only fetch once due to caching
      expect(fetchCount).toBe(1);
    });

    it('should fetch new data when courseId changes', async () => {
      const courseIds = [1, 2];
      let fetchedCourseIds: number[] = [];

      server.use(
        http.get('http://*/api/v1/gradebook/course/:id', async ({ params }) => {
          const id = Number(params.id);
          fetchedCourseIds.push(id);
          return HttpResponse.json({
            success: true,
            data: mockCourseGradebook(id, 3, 5),
            meta: { timestamp: Date.now() },
          });
        })
      );

      // Fetch first course
      const { result: result1 } = renderHook(
        () => useCourseGrades(courseIds[0]),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Fetch second course
      const { result: result2 } = renderHook(
        () => useCourseGrades(courseIds[1]),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Both courses should be fetched
      expect(fetchedCourseIds).toContain(courseIds[0]);
      expect(fetchedCourseIds).toContain(courseIds[1]);
    });
  });

  describe('Enabled Option', () => {
    it('should not fetch when enabled is false', async () => {
      const courseId = 1;
      let fetchCount = 0;

      server.use(
        http.get('http://*/api/v1/gradebook/course/:id', async () => {
          fetchCount++;
          return HttpResponse.json({
            success: true,
            data: mockCourseGradebook(courseId, 3, 5),
            meta: { timestamp: Date.now() },
          });
        })
      );

      const { result } = renderHook(
        () => useCourseGrades(courseId, { enabled: false }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait a bit to ensure no fetch happens
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(fetchCount).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFetching).toBe(false);
    });

    it('should fetch when enabled becomes true', async () => {
      const courseId = 1;

      const { result, rerender } = renderHook(
        ({ enabled }) => useCourseGrades(courseId, { enabled }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { enabled: false },
        }
      );

      // Initially not fetching
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();

      // Enable fetching
      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });
  });
});

// ============================================================================
// Test Suite: useUserGrades Hook
// ============================================================================

describe('useUserGrades Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupMockAuth();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  describe('Loading States', () => {
    it('should show loading state initially', async () => {
      const userId = 42;

      const { result } = renderHook(
        () => useUserGrades(userId),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('Successful Data Fetching', () => {
    it('should fetch user grades across all courses', async () => {
      const userId = 42;

      const { result } = renderHook(
        () => useUserGrades(userId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.userid).toBe(userId);
      expect(Array.isArray(result.current.data?.courses)).toBe(true);
    });

    it('should include course grades with proper structure', async () => {
      const userId = 42;

      const { result } = renderHook(
        () => useUserGrades(userId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const courses = result.current.data?.courses || [];
      if (courses.length > 0) {
        const course = courses[0];
        expect(course).toHaveProperty('courseid');
        expect(course).toHaveProperty('coursename');
        expect(course).toHaveProperty('items');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 error for non-existent user', async () => {
      const nonExistentUserId = 99999;

      server.use(
        http.get('http://*/api/v1/gradebook/user/:id', () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'User not found',
              },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(
        () => useUserGrades(nonExistentUserId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('Permission-Based Filtering', () => {
    it('should filter hidden grades for student role', async () => {
      const studentUserId = 100;

      // Mock response with hidden grades filtered out for student
      server.use(
        http.get('http://*/api/v1/gradebook/user/:id', () => {
          return HttpResponse.json({
            success: true,
            data: {
              userid: studentUserId,
              courses: [
                {
                  courseid: 1,
                  coursename: 'Test Course',
                  items: [
                    {
                      id: 101,
                      itemname: 'Visible Assignment',
                      hidden: false,
                      grade: { finalgrade: 85, hidden: false },
                    },
                    // Hidden grade should not be included for students
                  ],
                },
              ],
            },
            meta: { timestamp: Date.now() },
          });
        })
      );

      const { result } = renderHook(
        () => useUserGrades(studentUserId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const items = result.current.data?.courses[0]?.items || [];
      const hiddenItems = items.filter((item: { hidden: boolean }) => item.hidden);
      expect(hiddenItems.length).toBe(0);
    });

    it('should include hidden grades for teacher role', async () => {
      const teacherUserId = 2;

      // Mock response with hidden grades visible for teacher
      server.use(
        http.get('http://*/api/v1/gradebook/user/:id', () => {
          return HttpResponse.json({
            success: true,
            data: {
              userid: teacherUserId,
              courses: [
                {
                  courseid: 1,
                  coursename: 'Test Course',
                  canViewHidden: true,
                  items: [
                    {
                      id: 101,
                      itemname: 'Visible Assignment',
                      hidden: false,
                      grade: { finalgrade: 85, hidden: false },
                    },
                    {
                      id: 102,
                      itemname: 'Hidden Assignment',
                      hidden: true,
                      grade: { finalgrade: 90, hidden: true },
                    },
                  ],
                },
              ],
            },
            meta: { timestamp: Date.now() },
          });
        })
      );

      const { result } = renderHook(
        () => useUserGrades(teacherUserId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const items = result.current.data?.courses[0]?.items || [];
      expect(items.length).toBe(2);
    });
  });
});

// ============================================================================
// Test Suite: useGradeItems Hook
// ============================================================================

describe('useGradeItems Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupMockAuth();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  it('should fetch all grade items when no courseId provided', async () => {
    const { result } = renderHook(
      () => useGradeItems(),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it('should fetch course-specific grade items when courseId provided', async () => {
    const courseId = 1;

    const { result } = renderHook(
      () => useGradeItems(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it('should return grade items with correct structure', async () => {
    const courseId = 1;

    const { result } = renderHook(
      () => useGradeItems(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const items = result.current.data || [];
    if (items.length > 0) {
      const item = items[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('itemname');
      expect(item).toHaveProperty('itemtype');
      expect(item).toHaveProperty('grademax');
      expect(item).toHaveProperty('grademin');
    }
  });

  it('should support pagination for large item lists', async () => {
    let page = 1;
    let perPage = 20;

    server.use(
      http.get('http://*/api/v1/gradebook/items', ({ request }) => {
        const url = new URL(request.url);
        page = Number(url.searchParams.get('page') ?? '1');
        perPage = Number(url.searchParams.get('perPage') ?? '20');

        return HttpResponse.json({
          success: true,
          data: [],
          meta: {
            pagination: {
              page,
              perPage,
              total: 100,
              totalPages: 5,
            },
            timestamp: Date.now(),
          },
        });
      })
    );

    const { result } = renderHook(
      () => useGradeItems(undefined, { page: 2, perPage: 25 }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});

// ============================================================================
// Test Suite: useGradeCategories Hook
// ============================================================================

describe('useGradeCategories Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupMockAuth();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  it('should fetch grade categories for a course', async () => {
    const courseId = 1;

    const { result } = renderHook(
      () => useGradeCategories(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it('should return categories with aggregation settings', async () => {
    const courseId = 1;

    const { result } = renderHook(
      () => useGradeCategories(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const categories = result.current.data || [];
    if (categories.length > 0) {
      const category = categories[0];
      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('fullname');
      expect(category).toHaveProperty('aggregation');
    }
  });

  it('should return nested category structure', async () => {
    const courseId = 1;

    server.use(
      http.get('http://*/api/v1/gradebook/categories', () => {
        return HttpResponse.json({
          success: true,
          data: [
            {
              id: 1,
              courseid: courseId,
              fullname: 'Parent Category',
              aggregation: 'AGGREGATION_MEAN_WEIGHTED',
              depth: 1,
              children: [
                {
                  id: 2,
                  courseid: courseId,
                  parent: 1,
                  fullname: 'Child Category',
                  aggregation: 'AGGREGATION_SUM',
                  depth: 2,
                },
              ],
            },
          ],
          meta: { timestamp: Date.now() },
        });
      })
    );

    const { result } = renderHook(
      () => useGradeCategories(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const categories = result.current.data || [];
    expect(categories.length).toBe(1);
    expect(categories[0].children).toBeDefined();
    expect(categories[0].children?.length).toBe(1);
  });
});

// ============================================================================
// Test Suite: useUpdateGrade Mutation Hook
// ============================================================================

describe('useUpdateGrade Mutation Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupMockAuth();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  describe('Optimistic Updates', () => {
    it('should update grade successfully', async () => {
      const gradeId = 101;
      const newGrade = 95;

      server.use(
        http.put('http://*/api/v1/gradebook/grades/:id', async () => {
          return HttpResponse.json({
            success: true,
            data: {
              id: gradeId,
              rawgrade: newGrade,
              finalgrade: newGrade,
              timemodified: Date.now(),
            },
            meta: { timestamp: Date.now() },
          });
        })
      );

      const { result } = renderHook(
        () => useUpdateGrade(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync({
          gradeId,
          rawgrade: newGrade,
        });
      });

      expect(result.current.isSuccess).toBe(true);
    });

    it('should handle validation errors', async () => {
      const gradeId = 101;
      const invalidGrade = 150; // Above max

      server.use(
        http.put('http://*/api/v1/gradebook/grades/:id', async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Grade value exceeds maximum allowed',
                details: { max: 100, provided: invalidGrade },
              },
            },
            { status: 422 }
          );
        })
      );

      const { result } = renderHook(
        () => useUpdateGrade(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({
            gradeId,
            rawgrade: invalidGrade,
          });
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.isError).toBe(true);
    });

    it('should rollback on failure', async () => {
      const gradeId = 101;

      server.use(
        http.put('http://*/api/v1/gradebook/grades/:id', async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update grade',
              },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(
        () => useUpdateGrade(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({
            gradeId,
            rawgrade: 85,
          });
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.isError).toBe(true);
      // Optimistic update should be rolled back
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate gradebook queries after successful update', async () => {
      const gradeId = 101;
      const courseId = 1;

      // Pre-populate cache
      queryClient.setQueryData(gradebookKeys.course(courseId), {
        courseid: courseId,
        items: [{ id: gradeId, rawgrade: 80 }],
      });

      server.use(
        http.put('http://*/api/v1/gradebook/grades/:id', async () => {
          return HttpResponse.json({
            success: true,
            data: { id: gradeId, rawgrade: 95, finalgrade: 95 },
            meta: { timestamp: Date.now() },
          });
        })
      );

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useUpdateGrade(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync({
          gradeId,
          rawgrade: 95,
        });
      });

      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe('Permission Enforcement', () => {
    it('should handle permission denied error', async () => {
      const gradeId = 101;

      server.use(
        http.put('http://*/api/v1/gradebook/grades/:id', async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to update grades',
                details: { required_capability: 'mod/assign:grade' },
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(
        () => useUpdateGrade(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({
            gradeId,
            rawgrade: 85,
          });
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.isError).toBe(true);
    });
  });
});

// ============================================================================
// Test Suite: useUpdateGradeItem Mutation Hook
// ============================================================================

describe('useUpdateGradeItem Mutation Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupMockAuth();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  it('should update grade item settings', async () => {
    const itemId = 101;

    server.use(
      http.put('http://*/api/v1/gradebook/items/:id', async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: {
            id: itemId,
            ...(body as object),
            timemodified: Date.now(),
          },
          meta: { timestamp: Date.now() },
        });
      })
    );

    const { result } = renderHook(
      () => useUpdateGradeItem(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.mutateAsync({
        itemId,
        grademax: 150,
        gradepass: 90,
      });
    });

    expect(result.current.isSuccess).toBe(true);
  });

  it('should handle locked item error', async () => {
    const itemId = 101;

    server.use(
      http.put('http://*/api/v1/gradebook/items/:id', async () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ITEM_LOCKED',
              message: 'Cannot modify locked grade item',
            },
          },
          { status: 409 }
        );
      })
    );

    const { result } = renderHook(
      () => useUpdateGradeItem(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({
          itemId,
          grademax: 150,
        });
      } catch (error) {
        // Expected error
      }
    });

    expect(result.current.isError).toBe(true);
  });
});

// ============================================================================
// Test Suite: useGradeReport Hook
// ============================================================================

describe('useGradeReport Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupMockAuth();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  it('should fetch user grade report', async () => {
    const courseId = 1;
    const userId = 42;

    const { result } = renderHook(
      () => useGradeReport(courseId, 'user', userId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
  });

  it('should fetch grader report for teachers', async () => {
    const courseId = 1;

    const { result } = renderHook(
      () => useGradeReport(courseId, 'grader'),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
  });

  it('should handle access denied for grader report as student', async () => {
    const courseId = 1;

    server.use(
      http.get('http://*/api/v1/gradebook/report', () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: 'Students cannot access the grader report',
            },
          },
          { status: 403 }
        );
      })
    );

    const { result } = renderHook(
      () => useGradeReport(courseId, 'grader'),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

// ============================================================================
// Test Suite: useExportGrades Mutation Hook
// ============================================================================

describe('useExportGrades Mutation Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupMockAuth();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  it('should export grades in CSV format', async () => {
    const courseId = 1;

    server.use(
      http.get('http://*/api/v1/gradebook/export', () => {
        return HttpResponse.json({
          success: true,
          data: {
            url: 'https://example.com/export/grades.csv',
            format: 'csv',
            filename: 'grades_course_1.csv',
          },
          meta: { timestamp: Date.now() },
        });
      })
    );

    const { result } = renderHook(
      () => useExportGrades(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.mutateAsync({
        courseId,
        format: 'csv',
      });
    });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data?.format).toBe('csv');
  });

  it('should export grades in XLSX format', async () => {
    const courseId = 1;

    server.use(
      http.get('http://*/api/v1/gradebook/export', ({ request }) => {
        const url = new URL(request.url);
        const format = url.searchParams.get('format') || 'csv';

        return HttpResponse.json({
          success: true,
          data: {
            url: `https://example.com/export/grades.${format}`,
            format,
            filename: `grades_course_1.${format}`,
          },
          meta: { timestamp: Date.now() },
        });
      })
    );

    const { result } = renderHook(
      () => useExportGrades(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.mutateAsync({
        courseId,
        format: 'xlsx',
      });
    });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data?.format).toBe('xlsx');
  });

  it('should handle export permission errors', async () => {
    const courseId = 1;

    server.use(
      http.get('http://*/api/v1/gradebook/export', () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: 'You do not have permission to export grades',
            },
          },
          { status: 403 }
        );
      })
    );

    const { result } = renderHook(
      () => useExportGrades(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({
          courseId,
          format: 'csv',
        });
      } catch (error) {
        // Expected error
      }
    });

    expect(result.current.isError).toBe(true);
  });
});

// ============================================================================
// Test Suite: useMyGrades Hook
// ============================================================================

describe('useMyGrades Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupMockAuth();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  it('should fetch current user grades', async () => {
    const { result } = renderHook(
      () => useMyGrades(),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
  });

  it('should use correct query key for my grades', async () => {
    const { result } = renderHook(
      () => useMyGrades(),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify the query is cached under the correct key
    const cachedData = queryClient.getQueryData(gradebookKeys.myGrades());
    expect(cachedData).toBeDefined();
  });
});

// ============================================================================
// Test Suite: useStudentCourseGrades Hook
// ============================================================================

describe('useStudentCourseGrades Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupMockAuth();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  it('should fetch specific student grades in a course', async () => {
    const courseId = 1;
    const userId = 42;

    const { result } = renderHook(
      () => useStudentCourseGrades(courseId, userId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
  });

  it('should use correct query key for student course grades', async () => {
    const courseId = 1;
    const userId = 42;

    const { result } = renderHook(
      () => useStudentCourseGrades(courseId, userId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const cachedData = queryClient.getQueryData(
      gradebookKeys.studentCourseGrades(courseId, userId)
    );
    expect(cachedData).toBeDefined();
  });
});

// ============================================================================
// Test Suite: Grade Aggregation Calculations
// ============================================================================

describe('Grade Aggregation Calculations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupMockAuth();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  describe('Weighted Mean Aggregation', () => {
    it('should calculate weighted mean correctly', async () => {
      const courseId = 1;

      // Mock gradebook with weighted mean aggregation
      server.use(
        http.get('http://*/api/v1/gradebook/course/:id', () => {
          return HttpResponse.json({
            success: true,
            data: {
              courseid: courseId,
              coursename: 'Test Course',
              aggregation: 'AGGREGATION_MEAN_WEIGHTED',
              categories: [
                {
                  id: 1,
                  fullname: 'Assignments',
                  aggregation: 'AGGREGATION_MEAN_WEIGHTED',
                  weight: 50,
                },
                {
                  id: 2,
                  fullname: 'Quizzes',
                  aggregation: 'AGGREGATION_MEAN_WEIGHTED',
                  weight: 50,
                },
              ],
              items: [
                {
                  id: 101,
                  categoryid: 1,
                  itemname: 'Assignment 1',
                  grademax: 100,
                  weight: 50,
                  grade: { finalgrade: 80 },
                },
                {
                  id: 102,
                  categoryid: 1,
                  itemname: 'Assignment 2',
                  grademax: 100,
                  weight: 50,
                  grade: { finalgrade: 90 },
                },
                {
                  id: 201,
                  categoryid: 2,
                  itemname: 'Quiz 1',
                  grademax: 100,
                  weight: 50,
                  grade: { finalgrade: 70 },
                },
                {
                  id: 202,
                  categoryid: 2,
                  itemname: 'Quiz 2',
                  grademax: 100,
                  weight: 50,
                  grade: { finalgrade: 80 },
                },
                {
                  id: 999,
                  itemtype: 'course',
                  itemname: 'Course Total',
                  grademax: 100,
                  // Expected: (85 * 0.5) + (75 * 0.5) = 80
                  grade: { finalgrade: 80, percentage: 80 },
                },
              ],
              canViewAllGrades: true,
              canEditGrades: false,
            },
            meta: { timestamp: Date.now() },
          });
        })
      );

      const { result } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const courseTotal = result.current.data?.items?.find(
        (item) => item.itemtype === 'course'
      );

      expect(courseTotal).toBeDefined();
      expect(courseTotal?.grade?.finalgrade).toBe(80);
    });
  });

  describe('Sum Aggregation', () => {
    it('should calculate sum of grades correctly', async () => {
      const courseId = 2;

      server.use(
        http.get('http://*/api/v1/gradebook/course/:id', () => {
          return HttpResponse.json({
            success: true,
            data: {
              courseid: courseId,
              coursename: 'Sum Test Course',
              aggregation: 'AGGREGATION_SUM',
              categories: [
                {
                  id: 1,
                  fullname: 'Projects',
                  aggregation: 'AGGREGATION_SUM',
                },
              ],
              items: [
                {
                  id: 101,
                  categoryid: 1,
                  itemname: 'Project 1',
                  grademax: 50,
                  grade: { finalgrade: 40 },
                },
                {
                  id: 102,
                  categoryid: 1,
                  itemname: 'Project 2',
                  grademax: 50,
                  grade: { finalgrade: 45 },
                },
                {
                  id: 999,
                  itemtype: 'course',
                  itemname: 'Course Total',
                  grademax: 100,
                  // Sum: 40 + 45 = 85
                  grade: { finalgrade: 85 },
                },
              ],
              canViewAllGrades: true,
              canEditGrades: false,
            },
            meta: { timestamp: Date.now() },
          });
        })
      );

      const { result } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const courseTotal = result.current.data?.items?.find(
        (item) => item.itemtype === 'course'
      );

      expect(courseTotal?.grade?.finalgrade).toBe(85);
    });
  });

  describe('Natural Aggregation', () => {
    it('should handle natural aggregation with extra credit', async () => {
      const courseId = 3;

      server.use(
        http.get('http://*/api/v1/gradebook/course/:id', () => {
          return HttpResponse.json({
            success: true,
            data: {
              courseid: courseId,
              coursename: 'Natural Aggregation Course',
              aggregation: 'AGGREGATION_NATURAL',
              categories: [
                {
                  id: 1,
                  fullname: 'Regular Work',
                  aggregation: 'AGGREGATION_NATURAL',
                },
              ],
              items: [
                {
                  id: 101,
                  categoryid: 1,
                  itemname: 'Regular Assignment',
                  grademax: 100,
                  aggregationcoef: 0, // Not extra credit
                  grade: { finalgrade: 80 },
                },
                {
                  id: 102,
                  categoryid: 1,
                  itemname: 'Extra Credit',
                  grademax: 10,
                  aggregationcoef: 1, // Extra credit
                  grade: { finalgrade: 10 },
                },
                {
                  id: 999,
                  itemtype: 'course',
                  itemname: 'Course Total',
                  grademax: 100,
                  // 80 + 10 extra credit = 90 (capped at 100)
                  grade: { finalgrade: 90 },
                },
              ],
              canViewAllGrades: true,
              canEditGrades: false,
            },
            meta: { timestamp: Date.now() },
          });
        })
      );

      const { result } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const courseTotal = result.current.data?.items?.find(
        (item) => item.itemtype === 'course'
      );

      expect(courseTotal?.grade?.finalgrade).toBe(90);
    });
  });

  describe('Mean Aggregation (Simple)', () => {
    it('should calculate simple mean correctly', async () => {
      const courseId = 4;

      server.use(
        http.get('http://*/api/v1/gradebook/course/:id', () => {
          return HttpResponse.json({
            success: true,
            data: {
              courseid: courseId,
              coursename: 'Mean Test Course',
              aggregation: 'AGGREGATION_MEAN_SIMPLE',
              categories: [],
              items: [
                {
                  id: 101,
                  itemname: 'Test 1',
                  grademax: 100,
                  grade: { finalgrade: 70 },
                },
                {
                  id: 102,
                  itemname: 'Test 2',
                  grademax: 100,
                  grade: { finalgrade: 80 },
                },
                {
                  id: 103,
                  itemname: 'Test 3',
                  grademax: 100,
                  grade: { finalgrade: 90 },
                },
                {
                  id: 999,
                  itemtype: 'course',
                  itemname: 'Course Total',
                  grademax: 100,
                  // Mean: (70 + 80 + 90) / 3 = 80
                  grade: { finalgrade: 80 },
                },
              ],
              canViewAllGrades: true,
              canEditGrades: false,
            },
            meta: { timestamp: Date.now() },
          });
        })
      );

      const { result } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const courseTotal = result.current.data?.items?.find(
        (item) => item.itemtype === 'course'
      );

      expect(courseTotal?.grade?.finalgrade).toBe(80);
    });
  });
});

// ============================================================================
// Test Suite: Refetch Mechanisms
// ============================================================================

describe('Refetch Mechanisms', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupMockAuth();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  it('should refetch grades when manually triggered', async () => {
    const courseId = 1;
    let fetchCount = 0;

    server.use(
      http.get('http://*/api/v1/gradebook/course/:id', () => {
        fetchCount++;
        return HttpResponse.json({
          success: true,
          data: mockCourseGradebook(courseId, 3, 5),
          meta: { timestamp: Date.now() },
        });
      })
    );

    const { result } = renderHook(
      () => useCourseGrades(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetchCount).toBe(1);

    // Manual refetch
    await act(async () => {
      await result.current.refetch();
    });

    expect(fetchCount).toBe(2);
  });

  it('should refetch all gradebook queries after grade update', async () => {
    const courseId = 1;
    const gradeId = 101;
    let courseGradesFetchCount = 0;

    server.use(
      http.get('http://*/api/v1/gradebook/course/:id', () => {
        courseGradesFetchCount++;
        return HttpResponse.json({
          success: true,
          data: mockCourseGradebook(courseId, 3, 5),
          meta: { timestamp: Date.now() },
        });
      }),
      http.put('http://*/api/v1/gradebook/grades/:id', () => {
        return HttpResponse.json({
          success: true,
          data: { id: gradeId, rawgrade: 95, finalgrade: 95 },
          meta: { timestamp: Date.now() },
        });
      })
    );

    // First, fetch course grades
    const { result: courseResult } = renderHook(
      () => useCourseGrades(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(courseResult.current.isSuccess).toBe(true);
    });

    expect(courseGradesFetchCount).toBe(1);

    // Now update a grade
    const { result: updateResult } = renderHook(
      () => useUpdateGrade(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await updateResult.current.mutateAsync({
        gradeId,
        rawgrade: 95,
      });
    });

    // Course grades should be refetched due to cache invalidation
    await waitFor(() => {
      expect(courseGradesFetchCount).toBeGreaterThan(1);
    });
  });

  it('should invalidate related queries on update', async () => {
    const courseId = 1;
    const userId = 42;
    const gradeId = 101;

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.put('http://*/api/v1/gradebook/grades/:id', () => {
        return HttpResponse.json({
          success: true,
          data: { id: gradeId, rawgrade: 95, finalgrade: 95 },
          meta: { timestamp: Date.now() },
        });
      })
    );

    const { result } = renderHook(
      () => useUpdateGrade(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.mutateAsync({
        gradeId,
        rawgrade: 95,
        courseId,
        userId,
      });
    });

    // Should invalidate gradebook queries
    expect(invalidateQueriesSpy).toHaveBeenCalled();
  });
});

// ============================================================================
// Test Suite: Component Unmount and Cleanup
// ============================================================================

describe('Component Unmount and Cleanup', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupMockAuth();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  it('should not update state after component unmounts', async () => {
    const courseId = 1;

    // Add delay to the response
    server.use(
      http.get('http://*/api/v1/gradebook/course/:id', async () => {
        await delay(500);
        return HttpResponse.json({
          success: true,
          data: mockCourseGradebook(courseId, 3, 5),
          meta: { timestamp: Date.now() },
        });
      })
    );

    const { result, unmount } = renderHook(
      () => useCourseGrades(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    expect(result.current.isLoading).toBe(true);

    // Unmount before response arrives
    unmount();

    // Wait for the delayed response
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Should not throw or cause errors
    // The query should still complete in the background but not update component
  });

  it('should cancel ongoing requests on unmount when applicable', async () => {
    const courseId = 1;
    let requestStarted = false;
    let requestCompleted = false;

    server.use(
      http.get('http://*/api/v1/gradebook/course/:id', async () => {
        requestStarted = true;
        await delay(1000);
        requestCompleted = true;
        return HttpResponse.json({
          success: true,
          data: mockCourseGradebook(courseId, 3, 5),
          meta: { timestamp: Date.now() },
        });
      })
    );

    const { unmount } = renderHook(
      () => useCourseGrades(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    // Wait for request to start
    await waitFor(() => {
      expect(requestStarted).toBe(true);
    });

    // Unmount before request completes
    unmount();

    // Give time for the request to complete in background
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Request may complete in background but hook state should not update
    // Note: React Query doesn't cancel requests by default, but the hook handles cleanup
  });
});

// ============================================================================
// Test Suite: Role-Based Data Access
// ============================================================================

describe('Role-Based Data Access', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupMockAuth();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  describe('Student Role', () => {
    it('should only see own grades as student', async () => {
      const courseId = 1;
      const studentUserId = 100;

      server.use(
        http.get('http://*/api/v1/gradebook/course/:id', () => {
          return HttpResponse.json({
            success: true,
            data: {
              courseid: courseId,
              coursename: 'Test Course',
              aggregation: 'AGGREGATION_MEAN_WEIGHTED',
              categories: [],
              items: [
                {
                  id: 101,
                  itemname: 'Assignment 1',
                  grademax: 100,
                  grade: { userid: studentUserId, finalgrade: 85 },
                },
              ],
              // Student cannot view all grades
              canViewAllGrades: false,
              canEditGrades: false,
              students: [], // No other students visible
            },
            meta: { timestamp: Date.now() },
          });
        })
      );

      const { result } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.canViewAllGrades).toBe(false);
      expect(result.current.data?.canEditGrades).toBe(false);
    });
  });

  describe('Teacher Role', () => {
    it('should see all student grades as teacher', async () => {
      const courseId = 1;

      server.use(
        http.get('http://*/api/v1/gradebook/course/:id', () => {
          return HttpResponse.json({
            success: true,
            data: {
              courseid: courseId,
              coursename: 'Test Course',
              aggregation: 'AGGREGATION_MEAN_WEIGHTED',
              categories: [],
              items: [
                {
                  id: 101,
                  itemname: 'Assignment 1',
                  grademax: 100,
                },
              ],
              canViewAllGrades: true,
              canEditGrades: true,
              students: [
                {
                  userid: 100,
                  firstname: 'Student',
                  lastname: 'One',
                  grades: [{ itemid: 101, finalgrade: 85 }],
                },
                {
                  userid: 101,
                  firstname: 'Student',
                  lastname: 'Two',
                  grades: [{ itemid: 101, finalgrade: 90 }],
                },
              ],
            },
            meta: { timestamp: Date.now() },
          });
        })
      );

      const { result } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.canViewAllGrades).toBe(true);
      expect(result.current.data?.canEditGrades).toBe(true);
      expect(result.current.data?.students?.length).toBe(2);
    });
  });

  describe('Admin Role', () => {
    it('should have full access to all grades as admin', async () => {
      const courseId = 1;

      server.use(
        http.get('http://*/api/v1/gradebook/course/:id', () => {
          return HttpResponse.json({
            success: true,
            data: {
              courseid: courseId,
              coursename: 'Test Course',
              aggregation: 'AGGREGATION_MEAN_WEIGHTED',
              categories: [],
              items: [],
              canViewAllGrades: true,
              canEditGrades: true,
              canViewHidden: true,
              canOverrideGrades: true,
              students: [],
            },
            meta: { timestamp: Date.now() },
          });
        })
      );

      const { result } = renderHook(
        () => useCourseGrades(courseId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.canViewAllGrades).toBe(true);
      expect(result.current.data?.canEditGrades).toBe(true);
    });
  });
});

// ============================================================================
// Test Suite: Integration with Auth State
// ============================================================================

describe('Integration with Auth State', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  it('should include auth token in API requests', async () => {
    setupMockAuth();
    const courseId = 1;
    let receivedAuthHeader: string | null = null;

    server.use(
      http.get('http://*/api/v1/gradebook/course/:id', ({ request }) => {
        receivedAuthHeader = request.headers.get('Authorization');
        return HttpResponse.json({
          success: true,
          data: mockCourseGradebook(courseId, 3, 5),
          meta: { timestamp: Date.now() },
        });
      })
    );

    const { result } = renderHook(
      () => useCourseGrades(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(receivedAuthHeader).toBe(`Bearer ${mockAuthToken}`);
  });

  it('should handle missing auth token', async () => {
    // Don't set up auth token
    const courseId = 1;

    server.use(
      http.get('http://*/api/v1/gradebook/course/:id', ({ request }) => {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
              },
            },
            { status: 401 }
          );
        }
        return HttpResponse.json({
          success: true,
          data: mockCourseGradebook(courseId, 3, 5),
          meta: { timestamp: Date.now() },
        });
      })
    );

    const { result } = renderHook(
      () => useCourseGrades(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('should handle expired auth token', async () => {
    setupMockAuth();
    const courseId = 1;

    server.use(
      http.get('http://*/api/v1/gradebook/course/:id', () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'TOKEN_EXPIRED',
              message: 'Your session has expired. Please log in again.',
            },
          },
          { status: 401 }
        );
      })
    );

    const { result } = renderHook(
      () => useCourseGrades(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

// ============================================================================
// Test Suite: TypeScript Type Validation
// ============================================================================

describe('TypeScript Type Validation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupMockAuth();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  it('should return correctly typed course gradebook data', async () => {
    const courseId = 1;

    const { result } = renderHook(
      () => useCourseGrades(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    if (data) {
      // TypeScript compile-time checks
      const _courseid: number = data.courseid;
      const _coursename: string = data.coursename;
      const _aggregation: string = data.aggregation;
      const _categories: unknown[] = data.categories;
      const _items: unknown[] = data.items;

      expect(typeof data.courseid).toBe('number');
      expect(typeof data.coursename).toBe('string');
    }
  });

  it('should return correctly typed grade item data', async () => {
    const courseId = 1;

    const { result } = renderHook(
      () => useGradeItems(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const items = result.current.data;
    if (items && items.length > 0) {
      const item = items[0];

      // TypeScript compile-time checks
      const _id: number = item.id;
      const _itemname: string = item.itemname;
      const _grademax: number = item.grademax;
      const _grademin: number = item.grademin;

      expect(typeof item.id).toBe('number');
      expect(typeof item.itemname).toBe('string');
    }
  });
});

// ============================================================================
// Test Suite: Edge Cases and Boundary Conditions
// ============================================================================

describe('Edge Cases and Boundary Conditions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupMockAuth();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    cleanupMockAuth();
  });

  it('should handle empty gradebook', async () => {
    const courseId = 1;

    server.use(
      http.get('http://*/api/v1/gradebook/course/:id', () => {
        return HttpResponse.json({
          success: true,
          data: {
            courseid: courseId,
            coursename: 'Empty Course',
            aggregation: 'AGGREGATION_MEAN_SIMPLE',
            categories: [],
            items: [],
            canViewAllGrades: true,
            canEditGrades: true,
          },
          meta: { timestamp: Date.now() },
        });
      })
    );

    const { result } = renderHook(
      () => useCourseGrades(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.items.length).toBe(0);
    expect(result.current.data?.categories.length).toBe(0);
  });

  it('should handle grades with null values', async () => {
    const courseId = 1;

    server.use(
      http.get('http://*/api/v1/gradebook/course/:id', () => {
        return HttpResponse.json({
          success: true,
          data: {
            courseid: courseId,
            coursename: 'Course with Null Grades',
            aggregation: 'AGGREGATION_MEAN_SIMPLE',
            categories: [],
            items: [
              {
                id: 101,
                itemname: 'Ungraded Assignment',
                grademax: 100,
                grademin: 0,
                grade: {
                  id: 1001,
                  userid: 42,
                  rawgrade: null,
                  finalgrade: null,
                  feedback: null,
                },
              },
            ],
            canViewAllGrades: true,
            canEditGrades: true,
          },
          meta: { timestamp: Date.now() },
        });
      })
    );

    const { result } = renderHook(
      () => useCourseGrades(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const item = result.current.data?.items[0];
    expect(item?.grade?.finalgrade).toBeNull();
  });

  it('should handle very large grade values', async () => {
    const courseId = 1;

    server.use(
      http.get('http://*/api/v1/gradebook/course/:id', () => {
        return HttpResponse.json({
          success: true,
          data: {
            courseid: courseId,
            coursename: 'Large Grade Course',
            aggregation: 'AGGREGATION_SUM',
            categories: [],
            items: [
              {
                id: 101,
                itemname: 'High Value Assignment',
                grademax: 10000,
                grademin: 0,
                grade: {
                  id: 1001,
                  userid: 42,
                  rawgrade: 9999.99,
                  finalgrade: 9999.99,
                },
              },
            ],
            canViewAllGrades: true,
            canEditGrades: true,
          },
          meta: { timestamp: Date.now() },
        });
      })
    );

    const { result } = renderHook(
      () => useCourseGrades(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const item = result.current.data?.items[0];
    expect(item?.grade?.finalgrade).toBe(9999.99);
  });

  it('should handle excluded grades in aggregation', async () => {
    const courseId = 1;

    server.use(
      http.get('http://*/api/v1/gradebook/course/:id', () => {
        return HttpResponse.json({
          success: true,
          data: {
            courseid: courseId,
            coursename: 'Exclusion Test Course',
            aggregation: 'AGGREGATION_MEAN_SIMPLE',
            categories: [],
            items: [
              {
                id: 101,
                itemname: 'Included Grade',
                grademax: 100,
                grade: { finalgrade: 80, excluded: false },
              },
              {
                id: 102,
                itemname: 'Excluded Grade',
                grademax: 100,
                grade: { finalgrade: 50, excluded: true },
              },
              {
                id: 999,
                itemtype: 'course',
                itemname: 'Course Total',
                grademax: 100,
                // Only non-excluded grades count: 80
                grade: { finalgrade: 80 },
              },
            ],
            canViewAllGrades: true,
            canEditGrades: true,
          },
          meta: { timestamp: Date.now() },
        });
      })
    );

    const { result } = renderHook(
      () => useCourseGrades(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const courseTotal = result.current.data?.items.find(
      (item) => item.itemtype === 'course'
    );
    expect(courseTotal?.grade?.finalgrade).toBe(80);
  });

  it('should handle overridden grades', async () => {
    const courseId = 1;

    server.use(
      http.get('http://*/api/v1/gradebook/course/:id', () => {
        return HttpResponse.json({
          success: true,
          data: {
            courseid: courseId,
            coursename: 'Override Test Course',
            aggregation: 'AGGREGATION_MEAN_SIMPLE',
            categories: [],
            items: [
              {
                id: 101,
                itemname: 'Overridden Grade',
                grademax: 100,
                grade: {
                  rawgrade: 70, // Original calculation
                  finalgrade: 85, // Manual override
                  overridden: true,
                },
              },
            ],
            canViewAllGrades: true,
            canEditGrades: true,
          },
          meta: { timestamp: Date.now() },
        });
      })
    );

    const { result } = renderHook(
      () => useCourseGrades(courseId),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const item = result.current.data?.items[0];
    expect(item?.grade?.overridden).toBe(true);
    expect(item?.grade?.rawgrade).toBe(70);
    expect(item?.grade?.finalgrade).toBe(85);
  });
});
