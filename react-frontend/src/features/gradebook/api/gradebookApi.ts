/**
 * Gradebook API
 *
 * React Query hooks and API functions for gradebook operations.
 * Integrates with gradebook API endpoints that wrap existing
 * Moodle grade functions like grade_get_grades(), grade_update(), etc.
 *
 * @module features/gradebook/api/gradebookApi
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, extractData } from '@/services/api/client';
import { GRADEBOOK_ENDPOINTS } from '@/services/api/endpoints';
import type { ApiResponse } from '@/types/api';
import type {
  GradeItem,
  GradeCategory,
  GradeSummary,
} from '../types/grade.types';

// ============================================================================
// Types
// ============================================================================

/**
 * Course grade data with individual grade items for a user
 */
export interface CourseGradeData {
  courseId: number;
  courseName: string;
  grades: GradeSummary[];
  courseTotal: number | null;
  letterGrade: string | null;
  percentage: number | null;
}

/**
 * User gradebook response (all grades for a specific user)
 */
export interface UserGradebookResponse {
  userId: number;
  courses: CourseGradeData[];
}

/**
 * Course gradebook response (all grades for a specific course)
 */
export interface CourseGradebookResponse {
  courseId: number;
  courseName: string;
  items: GradeItem[];
  categories: GradeCategory[];
  userGrades: GradeSummary[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch all grades for a specific user
 *
 * Calls GET /api/v1/gradebook/user/{userId} which wraps existing Moodle
 * grade_get_grades() function to retrieve all grades across all courses.
 *
 * @param userId - User ID
 * @returns User's grades across all courses
 */
export async function fetchUserGrades(userId: number): Promise<UserGradebookResponse> {
  const response = await apiClient.get<ApiResponse<UserGradebookResponse>>(
    GRADEBOOK_ENDPOINTS.USER(userId)
  );

  return extractData(response);
}

/**
 * Fetch all grades for a specific course
 *
 * Calls GET /api/v1/gradebook/course/{courseId} which wraps existing Moodle
 * grade_get_grades() function to retrieve course gradebook.
 *
 * @param courseId - Course ID
 * @returns Course gradebook with all items and user grades
 */
export async function fetchCourseGrades(courseId: number): Promise<CourseGradebookResponse> {
  const response = await apiClient.get<ApiResponse<CourseGradebookResponse>>(
    GRADEBOOK_ENDPOINTS.COURSE(courseId)
  );

  return extractData(response);
}

/**
 * Fetch grade items
 *
 * Calls GET /api/v1/gradebook/items which wraps existing Moodle
 * grade_get_grade_items() function.
 *
 * @returns List of grade items
 */
export async function fetchGradeItems(): Promise<GradeItem[]> {
  const response = await apiClient.get<ApiResponse<{ items: GradeItem[] }>>(
    GRADEBOOK_ENDPOINTS.ITEMS
  );

  return extractData(response).items;
}

/**
 * Fetch grade categories
 *
 * Calls GET /api/v1/gradebook/categories which wraps existing Moodle
 * grade category functions.
 *
 * @returns List of grade categories
 */
export async function fetchGradeCategories(): Promise<GradeCategory[]> {
  const response = await apiClient.get<ApiResponse<{ categories: GradeCategory[] }>>(
    GRADEBOOK_ENDPOINTS.CATEGORIES
  );

  return extractData(response).categories;
}

/**
 * Update a grade item
 *
 * Calls PUT /api/v1/gradebook/items/{itemId} which wraps existing Moodle
 * grade_update() function.
 *
 * @param itemId - Grade item ID
 * @param data - Updated grade data
 * @returns Updated grade item
 */
export async function updateGradeItem(
  itemId: number,
  data: Partial<GradeItem>
): Promise<GradeItem> {
  const response = await apiClient.put<ApiResponse<GradeItem>>(
    GRADEBOOK_ENDPOINTS.UPDATE_GRADE(itemId),
    data
  );

  return extractData(response);
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to fetch user grades
 *
 * @param userId - User ID
 * @returns Query result with user grades
 */
export function useUserGrades(userId: number) {
  return useQuery({
    queryKey: ['gradebook', 'user', userId],
    queryFn: () => fetchUserGrades(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch course grades
 *
 * @param courseId - Course ID
 * @returns Query result with course gradebook
 */
export function useCourseGrades(courseId: number) {
  return useQuery({
    queryKey: ['gradebook', 'course', courseId],
    queryFn: () => fetchCourseGrades(courseId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch grade items
 *
 * @returns Query result with grade items
 */
export function useGradeItems() {
  return useQuery({
    queryKey: ['gradebook', 'items'],
    queryFn: fetchGradeItems,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch grade categories
 *
 * @returns Query result with grade categories
 */
export function useGradeCategories() {
  return useQuery({
    queryKey: ['gradebook', 'categories'],
    queryFn: fetchGradeCategories,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to update grade item
 *
 * @returns Mutation to update grade item
 */
export function useUpdateGradeItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: Partial<GradeItem> }) =>
      updateGradeItem(itemId, data),
    onSuccess: () => {
      // Invalidate related queries
      void queryClient.invalidateQueries({ queryKey: ['gradebook', 'items'] });
      void queryClient.invalidateQueries({ queryKey: ['gradebook', 'course'] });
      void queryClient.invalidateQueries({ queryKey: ['gradebook', 'user'] });
    },
  });
}
