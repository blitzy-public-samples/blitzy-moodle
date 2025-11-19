/**
 * Course API
 *
 * React Query hooks and API functions for course operations.
 * Integrates with course management API endpoints that wrap existing
 * Moodle course functions like get_courses(), get_course(), etc.
 *
 * @module features/courses/api/courseApi
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, extractData } from '@/services/api/client';
import { COURSE_ENDPOINTS } from '@/services/api/endpoints';
import type { ApiResponse } from '@/types/api';
import type { Course, Enrollment } from '@/types/entities';

// ============================================================================
// Types
// ============================================================================

/**
 * Course list item (basic course information)
 */
export interface CourseListItem {
  id: number;
  fullname: string;
  shortname: string;
  summary: string;
  summaryformat: number;
  categoryid: number;
  categoryname: string;
  format: string;
  startdate: number;
  enddate: number;
  visible: number;
  enrolledusers: number;
  imageurl?: string;
  progress?: number;
  hasprogress?: boolean;
}

/**
 * Course list query parameters
 */
export interface CourseListParams {
  page?: number;
  perPage?: number;
  search?: string;
  categoryid?: number;
  sort?: 'fullname' | 'shortname' | 'startdate' | 'enrolledusers';
  order?: 'asc' | 'desc';
}

/**
 * Course list response
 */
export interface CourseListResponse {
  data: CourseListItem[];
  meta: {
    pagination: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch paginated list of courses
 *
 * Calls GET /api/v1/courses which wraps existing Moodle get_courses()
 * function with pagination and filtering support.
 *
 * @param params - Query parameters for filtering and pagination
 * @returns Paginated course list with metadata
 */
export async function fetchCourses(params: CourseListParams = {}): Promise<CourseListResponse> {
  const response = await apiClient.get<CourseListResponse>(
    COURSE_ENDPOINTS.LIST,
    { params }
  );

  return response.data;
}

/**
 * Fetch single course details
 *
 * Calls GET /api/v1/courses/{id} which wraps existing Moodle get_course()
 * and get_course_contents() functions.
 *
 * @param id - Course ID
 * @returns Detailed course information
 */
export async function fetchCourseDetail(id: number): Promise<Course> {
  const response = await apiClient.get<ApiResponse<Course>>(
    COURSE_ENDPOINTS.DETAIL(id)
  );

  return extractData(response);
}

/**
 * Enroll in a course
 *
 * Calls POST /api/v1/courses/{id}/enroll which wraps existing Moodle
 * enrol_try_internal_enrol() function.
 *
 * @param courseId - Course ID to enroll in
 * @returns Enrollment result
 */
export async function enrollInCourse(courseId: number): Promise<Enrollment> {
  const response = await apiClient.post<ApiResponse<Enrollment>>(
    COURSE_ENDPOINTS.ENROLL(courseId)
  );

  return extractData(response);
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Query key factory for course queries
 * Provides consistent cache keys for React Query
 */
export const courseKeys = {
  all: ['courses'] as const,
  lists: () => [...courseKeys.all, 'list'] as const,
  list: (params: CourseListParams) => [...courseKeys.lists(), params] as const,
  details: () => [...courseKeys.all, 'detail'] as const,
  detail: (id: number) => [...courseKeys.details(), id] as const,
};

/**
 * React Query hook for fetching course list
 *
 * Usage:
 * ```tsx
 * const { data, isLoading, error } = useCourses({
 *   page: 1,
 *   perPage: 20,
 *   search: 'computer'
 * });
 * ```
 *
 * @param params - Query parameters for filtering and pagination
 * @param options - React Query options
 * @returns Query result with course list and metadata
 */
export function useCourses(params: CourseListParams = {}, options = {}) {
  return useQuery({
    queryKey: courseKeys.list(params),
    queryFn: () => fetchCourses(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * React Query hook for fetching single course details
 *
 * Usage:
 * ```tsx
 * const { data: course, isLoading, error } = useCourse(courseId);
 * ```
 *
 * @param id - Course ID
 * @param options - React Query options
 * @returns Query result with course details
 */
export function useCourse(id: number, options = {}) {
  return useQuery({
    queryKey: courseKeys.detail(id),
    queryFn: () => fetchCourseDetail(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!id,
    ...options,
  });
}

/**
 * React Query mutation hook for course enrollment
 *
 * Usage:
 * ```tsx
 * const { mutate: enroll, isLoading, error } = useEnrollInCourse();
 *
 * enroll(courseId, {
 *   onSuccess: (data) => {
 *     // Handle successful enrollment
 *   },
 *   onError: (error) => {
 *     // Handle enrollment error
 *   }
 * });
 * ```
 *
 * @returns Mutation hook for enrollment
 */
export function useEnrollInCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: enrollInCourse,
    onSuccess: (_, courseId) => {
      // Invalidate course detail to refresh enrollment status
      void queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId) });
      
      // Invalidate course lists to update enrollment counts
      void queryClient.invalidateQueries({ queryKey: courseKeys.lists() });
    },
  });
}
