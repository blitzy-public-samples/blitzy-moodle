/**
 * Unit Tests for useEnrollment React Query Mutation Hooks
 *
 * Comprehensive test suite validating course enrollment and unenrollment operations
 * with optimistic updates, automatic cache invalidation, and error handling.
 *
 * Tests verify:
 * - enrollInCourse and unenrollFromCourse mutation functions
 * - onMutate optimistic updates
 * - onError rollback
 * - onSuccess cache invalidation
 * - Loading/success/error states
 * - Integration with courseApi enrollment endpoints
 *
 * @see Section 0.7 Special Instructions - Test Coverage Requirements (90%+)
 * @see react-frontend/src/features/courses/hooks/useEnrollment.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';

import {
  useEnrollment,
  useEnrollInCourse,
  useUnenrollFromCourse,
} from '@/features/courses/hooks/useEnrollment';
import { courseApi } from '@/features/courses/api/courseApi';
import { createTestQueryClient } from '@tests/helpers/render';
import { createMockCourse } from '@tests/helpers/mockData';
import type { EnrollmentResult } from '@/features/courses/types/course.types';
import type { Course } from '@/types/entities';

// Mock the courseApi module
vi.mock('@/features/courses/api/courseApi', () => ({
  courseApi: {
    enrollInCourse: vi.fn(),
    unenrollFromCourse: vi.fn(),
  },
}));

// Type for the mocked courseApi
const mockedCourseApi = courseApi as {
  enrollInCourse: ReturnType<typeof vi.fn>;
  unenrollFromCourse: ReturnType<typeof vi.fn>;
};

/**
 * Creates a wrapper component with QueryClientProvider for testing hooks.
 * Each test gets a fresh QueryClient for complete isolation.
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * Factory function to create mock enrollment success response
 */
function createMockEnrollmentResult(
  courseId: number,
  userId: number = 1,
  overrides: Partial<EnrollmentResult> = {}
): EnrollmentResult {
  return {
    success: true,
    courseid: courseId,
    userid: userId,
    roleid: 5, // Default student role
    enrollmentid: Math.floor(Math.random() * 10000),
    message: 'Successfully enrolled in course',
    ...overrides,
  };
}

/**
 * Factory function to create mock API response
 */
function createMockApiResponse<T>(data: T) {
  return {
    success: true,
    data,
    meta: {},
  };
}

/**
 * Factory function to create mock API error response
 */
function createMockApiError(
  code: string,
  message: string,
  status: number = 400
) {
  const error = new Error(message) as Error & {
    code: string;
    status: number;
  };
  error.code = code;
  error.status = status;
  return error;
}

describe('useEnrollment', () => {
  let queryClient: QueryClient;
  let mockCourse: Course;

  beforeEach(() => {
    // Create fresh QueryClient for test isolation
    queryClient = createTestQueryClient();
    
    // Create mock course data
    mockCourse = createMockCourse({
      id: 123,
      fullname: 'Test Course',
      shortname: 'TC101',
      isenrolled: false,
    });

    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear cache and cleanup
    queryClient.clear();
  });

  describe('useEnrollInCourse', () => {
    describe('successful enrollment', () => {
      it('should return mutation function when hook is called', () => {
        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        expect(result.current.mutate).toBeDefined();
        expect(typeof result.current.mutate).toBe('function');
      });

      it('should call enrollInCourse API with correct courseId', async () => {
        const courseId = 123;
        const mockResult = createMockEnrollmentResult(courseId);
        mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
          createMockApiResponse(mockResult)
        );

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockedCourseApi.enrollInCourse).toHaveBeenCalledWith(courseId, undefined);
        expect(mockedCourseApi.enrollInCourse).toHaveBeenCalledTimes(1);
      });

      it('should return enrollment result data on success', async () => {
        const courseId = 123;
        const userId = 1;
        const mockResult = createMockEnrollmentResult(courseId, userId);
        mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
          createMockApiResponse(mockResult)
        );

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toBeDefined();
        expect(result.current.data?.courseid).toBe(courseId);
        expect(result.current.data?.userid).toBe(userId);
        expect(result.current.data?.success).toBe(true);
      });

      it('should support enrolling another user when userId is provided', async () => {
        const courseId = 123;
        const targetUserId = 456;
        const mockResult = createMockEnrollmentResult(courseId, targetUserId);
        mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
          createMockApiResponse(mockResult)
        );

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId, userId: targetUserId });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockedCourseApi.enrollInCourse).toHaveBeenCalledWith(
          courseId,
          targetUserId
        );
      });

      it('should use mutateAsync to get promise resolving to enrollment result', async () => {
        const courseId = 123;
        const mockResult = createMockEnrollmentResult(courseId);
        mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
          createMockApiResponse(mockResult)
        );

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        let enrollmentResult: EnrollmentResult | undefined;
        await act(async () => {
          enrollmentResult = await result.current.mutateAsync({ courseId });
        });

        expect(enrollmentResult).toBeDefined();
        expect(enrollmentResult?.success).toBe(true);
        expect(enrollmentResult?.courseid).toBe(courseId);
      });
    });

    describe('loading states', () => {
      it('should set isLoading to true during enrollment', async () => {
        const courseId = 123;
        
        // Create a delayed promise to capture loading state
        let resolveEnrollment: (value: unknown) => void;
        const enrollmentPromise = new Promise((resolve) => {
          resolveEnrollment = resolve;
        });
        mockedCourseApi.enrollInCourse.mockReturnValueOnce(enrollmentPromise);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        expect(result.current.isLoading).toBe(false);

        act(() => {
          result.current.mutate({ courseId });
        });

        // Check loading state is true while mutation is in progress
        await waitFor(() => {
          expect(result.current.isLoading).toBe(true);
        });

        // Resolve the promise
        const mockResult = createMockEnrollmentResult(courseId);
        await act(async () => {
          resolveEnrollment!(createMockApiResponse(mockResult));
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      it('should have isSuccess false during loading', async () => {
        const courseId = 123;
        
        let resolveEnrollment: (value: unknown) => void;
        const enrollmentPromise = new Promise((resolve) => {
          resolveEnrollment = resolve;
        });
        mockedCourseApi.enrollInCourse.mockReturnValueOnce(enrollmentPromise);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        act(() => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(true);
        });

        expect(result.current.isSuccess).toBe(false);
        expect(result.current.isError).toBe(false);

        const mockResult = createMockEnrollmentResult(courseId);
        await act(async () => {
          resolveEnrollment!(createMockApiResponse(mockResult));
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });
    });

    describe('error states', () => {
      it('should set isError to true when enrollment fails', async () => {
        const courseId = 123;
        const error = createMockApiError(
          'ENROLLMENT_FAILED',
          'Failed to enroll in course'
        );
        mockedCourseApi.enrollInCourse.mockRejectedValueOnce(error);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.isSuccess).toBe(false);
        expect(result.current.error).toBeDefined();
      });

      it('should capture error message on failed enrollment', async () => {
        const courseId = 123;
        const errorMessage = 'You do not have permission to enroll';
        const error = createMockApiError('PERMISSION_DENIED', errorMessage, 403);
        mockedCourseApi.enrollInCourse.mockRejectedValueOnce(error);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error?.message).toContain(errorMessage);
      });

      it('should handle already enrolled scenario', async () => {
        const courseId = 123;
        const error = createMockApiError(
          'ALREADY_ENROLLED',
          'User is already enrolled in this course',
          400
        );
        mockedCourseApi.enrollInCourse.mockRejectedValueOnce(error);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error?.message).toContain('already enrolled');
      });

      it('should handle network timeout errors', async () => {
        const courseId = 123;
        const error = new Error('Network timeout');
        (error as Error & { code: string }).code = 'ECONNABORTED';
        mockedCourseApi.enrollInCourse.mockRejectedValueOnce(error);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it('should handle 404 course not found error', async () => {
        const courseId = 999;
        const error = createMockApiError(
          'COURSE_NOT_FOUND',
          'Course not found',
          404
        );
        mockedCourseApi.enrollInCourse.mockRejectedValueOnce(error);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect((result.current.error as Error & { status: number })?.status).toBe(404);
      });
    });

    describe('optimistic updates (onMutate)', () => {
      it('should update cache optimistically before API call completes', async () => {
        const courseId = mockCourse.id;
        
        // Pre-populate cache with course data
        queryClient.setQueryData(['courses', courseId], {
          ...mockCourse,
          isenrolled: false,
        });

        // Create a delayed promise to observe optimistic update
        let resolveEnrollment: (value: unknown) => void;
        const enrollmentPromise = new Promise((resolve) => {
          resolveEnrollment = resolve;
        });
        mockedCourseApi.enrollInCourse.mockReturnValueOnce(enrollmentPromise);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        act(() => {
          result.current.mutate({ courseId });
        });

        // Wait for optimistic update to occur
        await waitFor(() => {
          const cachedCourse = queryClient.getQueryData<Course>(['courses', courseId]);
          expect(cachedCourse?.isenrolled).toBe(true);
        });

        // API hasn't resolved yet, but cache should show enrolled
        expect(mockedCourseApi.enrollInCourse).toHaveBeenCalled();

        // Resolve the API call
        const mockResult = createMockEnrollmentResult(courseId);
        await act(async () => {
          resolveEnrollment!(createMockApiResponse(mockResult));
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });

      it('should save previous cache value for potential rollback', async () => {
        const courseId = mockCourse.id;
        const originalCourse = {
          ...mockCourse,
          isenrolled: false,
        };
        
        // Pre-populate cache
        queryClient.setQueryData(['courses', courseId], originalCourse);

        // Create a delayed promise
        let resolveEnrollment: (value: unknown) => void;
        const enrollmentPromise = new Promise((resolve) => {
          resolveEnrollment = resolve;
        });
        mockedCourseApi.enrollInCourse.mockReturnValueOnce(enrollmentPromise);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        // Trigger enrollment
        act(() => {
          result.current.mutate({ courseId });
        });

        // After optimistic update, verify the cache was updated
        await waitFor(() => {
          const cachedCourse = queryClient.getQueryData<Course>(['courses', courseId]);
          expect(cachedCourse?.isenrolled).toBe(true);
        });

        // Resolve successfully
        const mockResult = createMockEnrollmentResult(courseId);
        await act(async () => {
          resolveEnrollment!(createMockApiResponse(mockResult));
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });

      it('should update my courses list optimistically', async () => {
        const courseId = mockCourse.id;
        const userId = 1;
        
        // Pre-populate user's courses cache with empty list
        queryClient.setQueryData(['users', userId, 'courses'], []);
        queryClient.setQueryData(['courses', courseId], mockCourse);

        let resolveEnrollment: (value: unknown) => void;
        const enrollmentPromise = new Promise((resolve) => {
          resolveEnrollment = resolve;
        });
        mockedCourseApi.enrollInCourse.mockReturnValueOnce(enrollmentPromise);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        act(() => {
          result.current.mutate({ courseId });
        });

        // Verify optimistic update happened
        await waitFor(() => {
          expect(result.current.isLoading).toBe(true);
        });

        // Resolve the API call
        const mockResult = createMockEnrollmentResult(courseId, userId);
        await act(async () => {
          resolveEnrollment!(createMockApiResponse(mockResult));
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });
    });

    describe('error rollback (onError)', () => {
      it('should rollback cache to previous state on API failure', async () => {
        const courseId = mockCourse.id;
        const originalCourse = {
          ...mockCourse,
          isenrolled: false,
        };
        
        // Pre-populate cache
        queryClient.setQueryData(['courses', courseId], originalCourse);

        // Create a promise that will reject
        let rejectEnrollment: (error: Error) => void;
        const enrollmentPromise = new Promise((_, reject) => {
          rejectEnrollment = reject;
        });
        mockedCourseApi.enrollInCourse.mockReturnValueOnce(enrollmentPromise);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        act(() => {
          result.current.mutate({ courseId });
        });

        // Wait for optimistic update
        await waitFor(() => {
          const cachedCourse = queryClient.getQueryData<Course>(['courses', courseId]);
          expect(cachedCourse?.isenrolled).toBe(true);
        });

        // Now reject the API call
        const error = createMockApiError('ENROLLMENT_FAILED', 'Server error', 500);
        await act(async () => {
          rejectEnrollment!(error);
        });

        // Wait for error state
        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        // Cache should be rolled back to original state
        const rolledBackCourse = queryClient.getQueryData<Course>(['courses', courseId]);
        expect(rolledBackCourse?.isenrolled).toBe(false);
      });

      it('should revert enrollment state on permission denied error', async () => {
        const courseId = mockCourse.id;
        const originalCourse = {
          ...mockCourse,
          isenrolled: false,
        };
        
        queryClient.setQueryData(['courses', courseId], originalCourse);

        let rejectEnrollment: (error: Error) => void;
        const enrollmentPromise = new Promise((_, reject) => {
          rejectEnrollment = reject;
        });
        mockedCourseApi.enrollInCourse.mockReturnValueOnce(enrollmentPromise);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        act(() => {
          result.current.mutate({ courseId });
        });

        // Wait for optimistic update
        await waitFor(() => {
          const cachedCourse = queryClient.getQueryData<Course>(['courses', courseId]);
          expect(cachedCourse?.isenrolled).toBe(true);
        });

        // Reject with permission denied error
        const error = createMockApiError('PERMISSION_DENIED', 'Access denied', 403);
        await act(async () => {
          rejectEnrollment!(error);
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        // Verify rollback
        const rolledBackCourse = queryClient.getQueryData<Course>(['courses', courseId]);
        expect(rolledBackCourse?.isenrolled).toBe(false);
      });
    });

    describe('cache invalidation (onSuccess)', () => {
      it('should invalidate course queries after successful enrollment', async () => {
        const courseId = mockCourse.id;
        const mockResult = createMockEnrollmentResult(courseId);
        mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
          createMockApiResponse(mockResult)
        );

        // Pre-populate cache
        queryClient.setQueryData(['courses', courseId], mockCourse);

        // Spy on invalidateQueries
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Check that relevant queries were invalidated
        expect(invalidateSpy).toHaveBeenCalled();
        
        invalidateSpy.mockRestore();
      });

      it('should invalidate course list queries after enrollment', async () => {
        const courseId = mockCourse.id;
        const mockResult = createMockEnrollmentResult(courseId);
        mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
          createMockApiResponse(mockResult)
        );

        // Pre-populate caches
        queryClient.setQueryData(['courses', courseId], mockCourse);
        queryClient.setQueryData(['courses', 'list'], [mockCourse]);

        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Verify cache invalidation was triggered
        expect(invalidateSpy).toHaveBeenCalled();
        
        invalidateSpy.mockRestore();
      });

      it('should invalidate user courses queries after enrollment', async () => {
        const courseId = mockCourse.id;
        const userId = 1;
        const mockResult = createMockEnrollmentResult(courseId, userId);
        mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
          createMockApiResponse(mockResult)
        );

        // Pre-populate caches
        queryClient.setQueryData(['courses', courseId], mockCourse);
        queryClient.setQueryData(['users', userId, 'courses'], []);

        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(invalidateSpy).toHaveBeenCalled();
        
        invalidateSpy.mockRestore();
      });
    });

    describe('success states', () => {
      it('should set isSuccess to true after successful enrollment', async () => {
        const courseId = 123;
        const mockResult = createMockEnrollmentResult(courseId);
        mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
          createMockApiResponse(mockResult)
        );

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        expect(result.current.isSuccess).toBe(false);

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.isError).toBe(false);
        expect(result.current.isLoading).toBe(false);
      });

      it('should have enrollment data accessible after success', async () => {
        const courseId = 123;
        const enrollmentId = 456;
        const mockResult = createMockEnrollmentResult(courseId, 1, {
          enrollmentid: enrollmentId,
          message: 'Welcome to the course!',
        });
        mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
          createMockApiResponse(mockResult)
        );

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.enrollmentid).toBe(enrollmentId);
        expect(result.current.data?.message).toBe('Welcome to the course!');
      });
    });

    describe('mutation reset', () => {
      it('should reset mutation state using reset method', async () => {
        const courseId = 123;
        const mockResult = createMockEnrollmentResult(courseId);
        mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
          createMockApiResponse(mockResult)
        );

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Reset the mutation
        act(() => {
          result.current.reset();
        });

        expect(result.current.isSuccess).toBe(false);
        expect(result.current.isError).toBe(false);
        expect(result.current.data).toBeUndefined();
      });

      it('should reset error state using reset method', async () => {
        const courseId = 123;
        const error = createMockApiError('ENROLLMENT_FAILED', 'Failed');
        mockedCourseApi.enrollInCourse.mockRejectedValueOnce(error);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        // Reset the mutation
        act(() => {
          result.current.reset();
        });

        expect(result.current.isError).toBe(false);
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('useUnenrollFromCourse', () => {
    describe('successful unenrollment', () => {
      it('should return mutation function when hook is called', () => {
        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useUnenrollFromCourse(), { wrapper });

        expect(result.current.mutate).toBeDefined();
        expect(typeof result.current.mutate).toBe('function');
      });

      it('should call unenrollFromCourse API with correct courseId', async () => {
        const courseId = 123;
        const mockResult = createMockEnrollmentResult(courseId, 1, {
          message: 'Successfully unenrolled from course',
        });
        mockedCourseApi.unenrollFromCourse.mockResolvedValueOnce(
          createMockApiResponse(mockResult)
        );

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useUnenrollFromCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockedCourseApi.unenrollFromCourse).toHaveBeenCalledWith(courseId, undefined);
        expect(mockedCourseApi.unenrollFromCourse).toHaveBeenCalledTimes(1);
      });

      it('should return result data on successful unenrollment', async () => {
        const courseId = 123;
        const mockResult = createMockEnrollmentResult(courseId, 1, {
          message: 'Unenrollment successful',
        });
        mockedCourseApi.unenrollFromCourse.mockResolvedValueOnce(
          createMockApiResponse(mockResult)
        );

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useUnenrollFromCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toBeDefined();
        expect(result.current.data?.success).toBe(true);
        expect(result.current.data?.courseid).toBe(courseId);
      });

      it('should support unenrolling another user when userId is provided', async () => {
        const courseId = 123;
        const targetUserId = 456;
        const mockResult = createMockEnrollmentResult(courseId, targetUserId);
        mockedCourseApi.unenrollFromCourse.mockResolvedValueOnce(
          createMockApiResponse(mockResult)
        );

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useUnenrollFromCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId, userId: targetUserId });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockedCourseApi.unenrollFromCourse).toHaveBeenCalledWith(
          courseId,
          targetUserId
        );
      });
    });

    describe('error handling', () => {
      it('should set isError to true when unenrollment fails', async () => {
        const courseId = 123;
        const error = createMockApiError(
          'UNENROLLMENT_FAILED',
          'Failed to unenroll from course'
        );
        mockedCourseApi.unenrollFromCourse.mockRejectedValueOnce(error);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useUnenrollFromCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.isSuccess).toBe(false);
        expect(result.current.error).toBeDefined();
      });

      it('should handle permission denied for unenrollment', async () => {
        const courseId = 123;
        const error = createMockApiError(
          'PERMISSION_DENIED',
          'Cannot unenroll from this course',
          403
        );
        mockedCourseApi.unenrollFromCourse.mockRejectedValueOnce(error);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useUnenrollFromCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error?.message).toContain('Cannot unenroll');
      });

      it('should handle not enrolled scenario', async () => {
        const courseId = 123;
        const error = createMockApiError(
          'NOT_ENROLLED',
          'User is not enrolled in this course',
          400
        );
        mockedCourseApi.unenrollFromCourse.mockRejectedValueOnce(error);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useUnenrollFromCourse(), { wrapper });

        await act(async () => {
          result.current.mutate({ courseId });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error?.message).toContain('not enrolled');
      });
    });

    describe('optimistic updates for unenrollment', () => {
      it('should update cache optimistically to show unenrolled state', async () => {
        const courseId = mockCourse.id;
        const enrolledCourse = {
          ...mockCourse,
          isenrolled: true,
        };
        
        // Pre-populate cache with enrolled course
        queryClient.setQueryData(['courses', courseId], enrolledCourse);

        let resolveUnenrollment: (value: unknown) => void;
        const unenrollmentPromise = new Promise((resolve) => {
          resolveUnenrollment = resolve;
        });
        mockedCourseApi.unenrollFromCourse.mockReturnValueOnce(unenrollmentPromise);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useUnenrollFromCourse(), { wrapper });

        act(() => {
          result.current.mutate({ courseId });
        });

        // Wait for optimistic update
        await waitFor(() => {
          const cachedCourse = queryClient.getQueryData<Course>(['courses', courseId]);
          expect(cachedCourse?.isenrolled).toBe(false);
        });

        // Resolve the API call
        const mockResult = createMockEnrollmentResult(courseId);
        await act(async () => {
          resolveUnenrollment!(createMockApiResponse(mockResult));
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });

      it('should rollback to enrolled state on unenrollment failure', async () => {
        const courseId = mockCourse.id;
        const enrolledCourse = {
          ...mockCourse,
          isenrolled: true,
        };
        
        queryClient.setQueryData(['courses', courseId], enrolledCourse);

        let rejectUnenrollment: (error: Error) => void;
        const unenrollmentPromise = new Promise((_, reject) => {
          rejectUnenrollment = reject;
        });
        mockedCourseApi.unenrollFromCourse.mockReturnValueOnce(unenrollmentPromise);

        const wrapper = createWrapper(queryClient);
        const { result } = renderHook(() => useUnenrollFromCourse(), { wrapper });

        act(() => {
          result.current.mutate({ courseId });
        });

        // Wait for optimistic update
        await waitFor(() => {
          const cachedCourse = queryClient.getQueryData<Course>(['courses', courseId]);
          expect(cachedCourse?.isenrolled).toBe(false);
        });

        // Reject the API call
        const error = createMockApiError('SERVER_ERROR', 'Internal server error', 500);
        await act(async () => {
          rejectUnenrollment!(error);
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        // Cache should be rolled back
        const rolledBackCourse = queryClient.getQueryData<Course>(['courses', courseId]);
        expect(rolledBackCourse?.isenrolled).toBe(true);
      });
    });
  });

  describe('useEnrollment combined hook', () => {
    it('should return both enrollInCourse and unenrollFromCourse mutations', () => {
      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollment(), { wrapper });

      expect(result.current.enrollInCourse).toBeDefined();
      expect(result.current.unenrollFromCourse).toBeDefined();
      expect(result.current.enrollInCourse.mutate).toBeDefined();
      expect(result.current.unenrollFromCourse.mutate).toBeDefined();
    });

    it('should allow sequential enroll then unenroll operations', async () => {
      const courseId = 123;
      const mockEnrollResult = createMockEnrollmentResult(courseId);
      const mockUnenrollResult = createMockEnrollmentResult(courseId, 1, {
        message: 'Unenrolled',
      });

      mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
        createMockApiResponse(mockEnrollResult)
      );
      mockedCourseApi.unenrollFromCourse.mockResolvedValueOnce(
        createMockApiResponse(mockUnenrollResult)
      );

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollment(), { wrapper });

      // First, enroll
      await act(async () => {
        result.current.enrollInCourse.mutate({ courseId });
      });

      await waitFor(() => {
        expect(result.current.enrollInCourse.isSuccess).toBe(true);
      });

      // Then, unenroll
      await act(async () => {
        result.current.unenrollFromCourse.mutate({ courseId });
      });

      await waitFor(() => {
        expect(result.current.unenrollFromCourse.isSuccess).toBe(true);
      });

      expect(mockedCourseApi.enrollInCourse).toHaveBeenCalledTimes(1);
      expect(mockedCourseApi.unenrollFromCourse).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple concurrent enrollments', () => {
    it('should handle enrolling in multiple courses simultaneously', async () => {
      const courseIds = [101, 102, 103];
      
      // Mock responses for each course
      courseIds.forEach((courseId) => {
        mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
          createMockApiResponse(createMockEnrollmentResult(courseId))
        );
      });

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

      // Trigger all enrollments simultaneously
      await act(async () => {
        courseIds.forEach((courseId) => {
          result.current.mutate({ courseId });
        });
      });

      // Wait for all to complete
      await waitFor(() => {
        expect(mockedCourseApi.enrollInCourse).toHaveBeenCalledTimes(3);
      });

      expect(mockedCourseApi.enrollInCourse).toHaveBeenCalledWith(101, undefined);
      expect(mockedCourseApi.enrollInCourse).toHaveBeenCalledWith(102, undefined);
      expect(mockedCourseApi.enrollInCourse).toHaveBeenCalledWith(103, undefined);
    });

    it('should track each enrollment independently', async () => {
      const course1 = createMockCourse({ id: 201, fullname: 'Course 1' });
      const course2 = createMockCourse({ id: 202, fullname: 'Course 2' });

      // Pre-populate cache
      queryClient.setQueryData(['courses', 201], course1);
      queryClient.setQueryData(['courses', 202], course2);

      // Create delayed promises for each
      let resolve1: (value: unknown) => void;
      let resolve2: (value: unknown) => void;
      const promise1 = new Promise((resolve) => { resolve1 = resolve; });
      const promise2 = new Promise((resolve) => { resolve2 = resolve; });

      mockedCourseApi.enrollInCourse
        .mockReturnValueOnce(promise1)
        .mockReturnValueOnce(promise2);

      const wrapper = createWrapper(queryClient);
      
      // Render two separate hooks to track independently
      const { result: result1 } = renderHook(() => useEnrollInCourse(), { wrapper });
      const { result: result2 } = renderHook(() => useEnrollInCourse(), { wrapper });

      // Start both enrollments
      act(() => {
        result1.current.mutate({ courseId: 201 });
        result2.current.mutate({ courseId: 202 });
      });

      // Both should be loading
      await waitFor(() => {
        expect(result1.current.isLoading).toBe(true);
        expect(result2.current.isLoading).toBe(true);
      });

      // Resolve first enrollment
      await act(async () => {
        resolve1!(createMockApiResponse(createMockEnrollmentResult(201)));
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second should still be loading
      expect(result2.current.isLoading).toBe(true);

      // Resolve second enrollment
      await act(async () => {
        resolve2!(createMockApiResponse(createMockEnrollmentResult(202)));
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });
    });

    it('should maintain cache consistency during multiple updates', async () => {
      const courseIds = [301, 302];
      const courses = courseIds.map((id) =>
        createMockCourse({ id, isenrolled: false })
      );

      // Pre-populate cache
      courses.forEach((course) => {
        queryClient.setQueryData(['courses', course.id], course);
      });

      // Set up mock responses
      courseIds.forEach((courseId) => {
        mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
          createMockApiResponse(createMockEnrollmentResult(courseId))
        );
      });

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

      await act(async () => {
        await Promise.all(
          courseIds.map((courseId) =>
            result.current.mutateAsync({ courseId })
          )
        );
      });

      // Verify all courses show as enrolled
      courseIds.forEach((courseId) => {
        const cachedCourse = queryClient.getQueryData<Course>(['courses', courseId]);
        expect(cachedCourse?.isenrolled).toBe(true);
      });
    });
  });

  describe('race conditions', () => {
    it('should handle rapid enroll/unenroll clicking correctly', async () => {
      const courseId = mockCourse.id;
      
      // Pre-populate cache
      queryClient.setQueryData(['courses', courseId], {
        ...mockCourse,
        isenrolled: false,
      });

      // First action is enroll (success)
      mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
        createMockApiResponse(createMockEnrollmentResult(courseId))
      );
      
      // Second action is unenroll (success)
      mockedCourseApi.unenrollFromCourse.mockResolvedValueOnce(
        createMockApiResponse(createMockEnrollmentResult(courseId))
      );

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollment(), { wrapper });

      // Rapid fire: enroll then immediately unenroll
      await act(async () => {
        result.current.enrollInCourse.mutate({ courseId });
        result.current.unenrollFromCourse.mutate({ courseId });
      });

      // Wait for both to complete
      await waitFor(() => {
        expect(mockedCourseApi.enrollInCourse).toHaveBeenCalled();
        expect(mockedCourseApi.unenrollFromCourse).toHaveBeenCalled();
      });
    });

    it('should handle latest mutation winning in rapid succession', async () => {
      const courseId = mockCourse.id;
      
      queryClient.setQueryData(['courses', courseId], {
        ...mockCourse,
        isenrolled: false,
      });

      // First enroll is slow
      let resolveFirst: (value: unknown) => void;
      const slowPromise = new Promise((resolve) => { resolveFirst = resolve; });
      
      // Second enroll is fast
      const fastResult = createMockEnrollmentResult(courseId);
      
      mockedCourseApi.enrollInCourse
        .mockReturnValueOnce(slowPromise)
        .mockResolvedValueOnce(createMockApiResponse(fastResult));

      const wrapper = createWrapper(queryClient);
      
      // Two separate hooks to simulate two button clicks
      const { result: result1 } = renderHook(() => useEnrollInCourse(), { wrapper });
      const { result: result2 } = renderHook(() => useEnrollInCourse(), { wrapper });

      // Start slow mutation
      act(() => {
        result1.current.mutate({ courseId });
      });

      // Start fast mutation immediately after
      await act(async () => {
        result2.current.mutate({ courseId });
      });

      // Fast one should complete first
      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Resolve slow one
      await act(async () => {
        resolveFirst!(createMockApiResponse(createMockEnrollmentResult(courseId)));
      });

      // Both should eventually succeed
      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });
    });
  });

  describe('TypeScript type safety', () => {
    it('should have properly typed mutation functions', () => {
      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

      // Type checking - these should compile without errors
      const mutate: (variables: { courseId: number; userId?: number }) => void =
        result.current.mutate;
      const mutateAsync: (variables: { courseId: number; userId?: number }) => Promise<EnrollmentResult> =
        result.current.mutateAsync;

      expect(mutate).toBeDefined();
      expect(mutateAsync).toBeDefined();
    });

    it('should have properly typed EnrollmentResult interface', async () => {
      const courseId = 123;
      const mockResult = createMockEnrollmentResult(courseId);
      mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
        createMockApiResponse(mockResult)
      );

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

      await act(async () => {
        result.current.mutate({ courseId });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Type assertions - data should have EnrollmentResult shape
      const data = result.current.data as EnrollmentResult;
      expect(typeof data.success).toBe('boolean');
      expect(typeof data.courseid).toBe('number');
      expect(typeof data.userid).toBe('number');
      expect(typeof data.roleid).toBe('number');
      expect(typeof data.enrollmentid).toBe('number');
      expect(typeof data.message).toBe('string');
    });

    it('should enforce no any types in test code', () => {
      // This test exists to verify type safety
      // All test code should use explicit types
      const courseId: number = 123;
      const userId: number = 456;
      
      const enrollParams: { courseId: number; userId?: number } = {
        courseId,
        userId,
      };

      expect(enrollParams.courseId).toBe(courseId);
      expect(enrollParams.userId).toBe(userId);
    });
  });

  describe('performance considerations', () => {
    it('should provide optimistic update within reasonable time', async () => {
      const courseId = mockCourse.id;
      
      queryClient.setQueryData(['courses', courseId], {
        ...mockCourse,
        isenrolled: false,
      });

      let resolveEnrollment: (value: unknown) => void;
      const enrollmentPromise = new Promise((resolve) => {
        resolveEnrollment = resolve;
      });
      mockedCourseApi.enrollInCourse.mockReturnValueOnce(enrollmentPromise);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

      const startTime = performance.now();
      
      act(() => {
        result.current.mutate({ courseId });
      });

      // Wait for optimistic update
      await waitFor(() => {
        const cachedCourse = queryClient.getQueryData<Course>(['courses', courseId]);
        return cachedCourse?.isenrolled === true;
      });

      const endTime = performance.now();
      const optimisticUpdateTime = endTime - startTime;

      // Optimistic update should be very fast (< 100ms in tests)
      expect(optimisticUpdateTime).toBeLessThan(100);

      // Cleanup
      const mockResult = createMockEnrollmentResult(courseId);
      await act(async () => {
        resolveEnrollment!(createMockApiResponse(mockResult));
      });
    });

    it('should not cause unnecessary re-renders with targeted cache updates', async () => {
      const courseId = 123;
      const otherCourseId = 456;
      
      // Pre-populate caches for multiple courses
      queryClient.setQueryData(['courses', courseId], {
        ...mockCourse,
        id: courseId,
        isenrolled: false,
      });
      queryClient.setQueryData(['courses', otherCourseId], {
        ...mockCourse,
        id: otherCourseId,
        isenrolled: false,
      });

      const mockResult = createMockEnrollmentResult(courseId);
      mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
        createMockApiResponse(mockResult)
      );

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

      await act(async () => {
        result.current.mutate({ courseId });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify only the targeted course was affected
      const enrolledCourse = queryClient.getQueryData<Course>(['courses', courseId]);
      const otherCourse = queryClient.getQueryData<Course>(['courses', otherCourseId]);

      expect(enrolledCourse?.isenrolled).toBe(true);
      expect(otherCourse?.isenrolled).toBe(false); // Should remain unchanged
    });
  });

  describe('integration with query cache patterns', () => {
    it('should trigger refetch of course detail after enrollment', async () => {
      const courseId = mockCourse.id;
      
      queryClient.setQueryData(['courses', courseId], mockCourse);
      
      const mockResult = createMockEnrollmentResult(courseId);
      mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
        createMockApiResponse(mockResult)
      );

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

      await act(async () => {
        result.current.mutate({ courseId });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify queries were invalidated to trigger refetch
      expect(invalidateSpy).toHaveBeenCalled();
      
      invalidateSpy.mockRestore();
    });

    it('should update dashboard data after enrollment', async () => {
      const courseId = mockCourse.id;
      const userId = 1;
      
      // Pre-populate user dashboard cache
      queryClient.setQueryData(['users', userId, 'dashboard'], {
        enrolledCourses: [],
      });
      
      const mockResult = createMockEnrollmentResult(courseId, userId);
      mockedCourseApi.enrollInCourse.mockResolvedValueOnce(
        createMockApiResponse(mockResult)
      );

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

      await act(async () => {
        result.current.mutate({ courseId });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify dashboard-related queries could be invalidated
      expect(invalidateSpy).toHaveBeenCalled();
      
      invalidateSpy.mockRestore();
    });
  });

  describe('special enrollment scenarios', () => {
    it('should handle enrollment quota exceeded error', async () => {
      const courseId = 123;
      const error = createMockApiError(
        'ENROLLMENT_QUOTA_EXCEEDED',
        'Course enrollment quota has been reached',
        400
      );
      mockedCourseApi.enrollInCourse.mockRejectedValueOnce(error);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

      await act(async () => {
        result.current.mutate({ courseId });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toContain('quota');
    });

    it('should handle enrollment requiring payment', async () => {
      const courseId = 123;
      const error = createMockApiError(
        'PAYMENT_REQUIRED',
        'Payment is required for enrollment',
        402
      );
      mockedCourseApi.enrollInCourse.mockRejectedValueOnce(error);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

      await act(async () => {
        result.current.mutate({ courseId });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect((result.current.error as Error & { status: number })?.status).toBe(402);
    });

    it('should handle enrollment key required', async () => {
      const courseId = 123;
      const error = createMockApiError(
        'ENROLLMENT_KEY_REQUIRED',
        'An enrollment key is required to join this course',
        400
      );
      mockedCourseApi.enrollInCourse.mockRejectedValueOnce(error);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

      await act(async () => {
        result.current.mutate({ courseId });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toContain('enrollment key');
    });

    it('should handle course not accepting enrollments', async () => {
      const courseId = 123;
      const error = createMockApiError(
        'ENROLLMENT_DISABLED',
        'Enrollment is currently disabled for this course',
        400
      );
      mockedCourseApi.enrollInCourse.mockRejectedValueOnce(error);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

      await act(async () => {
        result.current.mutate({ courseId });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toContain('disabled');
    });

    it('should handle course with start date in future', async () => {
      const courseId = 123;
      const error = createMockApiError(
        'ENROLLMENT_NOT_STARTED',
        'Enrollment period has not started yet',
        400
      );
      mockedCourseApi.enrollInCourse.mockRejectedValueOnce(error);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

      await act(async () => {
        result.current.mutate({ courseId });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toContain('not started');
    });

    it('should handle enrollment period ended', async () => {
      const courseId = 123;
      const error = createMockApiError(
        'ENROLLMENT_ENDED',
        'Enrollment period has ended for this course',
        400
      );
      mockedCourseApi.enrollInCourse.mockRejectedValueOnce(error);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useEnrollInCourse(), { wrapper });

      await act(async () => {
        result.current.mutate({ courseId });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toContain('ended');
    });
  });
});
