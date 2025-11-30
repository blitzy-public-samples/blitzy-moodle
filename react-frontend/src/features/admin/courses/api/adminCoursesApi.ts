/**
 * Admin Course Management API Client
 *
 * This module provides a comprehensive API client for administrative course management
 * operations in the Moodle React frontend. It includes functions for course CRUD operations,
 * category management, bulk actions, and advanced search/filtering capabilities.
 *
 * All functions wrap calls to the backend API endpoints at /api/v1/admin/courses/*,
 * which in turn delegate to existing Moodle PHP functions like get_course(),
 * create_course(), update_course(), and delete_course().
 *
 * Features:
 * - Course CRUD: Create, read, update, and delete individual courses
 * - Category Management: Full CRUD operations for course categories
 * - Bulk Operations: Mass delete, update visibility, and move courses between categories
 * - Search & Filter: Advanced course search with multiple filter criteria
 * - Pagination: Built-in support for paginated course listings
 *
 * Usage with React Query:
 * ```typescript
 * import { useQuery, useMutation } from '@tanstack/react-query';
 * import { getAllCourses, createCourse, deleteCourse } from '@/features/admin/courses/api/adminCoursesApi';
 *
 * // Fetch courses with filters
 * const { data } = useQuery({
 *   queryKey: ['admin', 'courses', filters],
 *   queryFn: () => getAllCourses(filters)
 * });
 *
 * // Create a new course
 * const createMutation = useMutation({
 *   mutationFn: createCourse,
 *   onSuccess: () => queryClient.invalidateQueries(['admin', 'courses'])
 * });
 * ```
 *
 * @module features/admin/courses/api/adminCoursesApi
 * @see public/course/edit.php - Reference for permission patterns (require_capability)
 * @see public/course/lib.php - Moodle course management functions
 */

import { apiClient } from '@/services/api/client';
import type { Course, CourseCategory } from '@/types/entities';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { CourseId, CategoryId } from '@/types/common';
import type { CourseFilters } from '@/features/admin/courses/types/filters.types';
import type {
  BulkCourseAction,
  BulkActionResult,
  BulkActionType,
} from '@/features/admin/courses/types/bulk.types';
import type { CourseFormData, CategoryFormData } from '@/features/admin/courses/types/forms.types';

// ============================================================================
// API Endpoint Constants
// ============================================================================

/**
 * Base path for admin course API endpoints
 */
const ADMIN_COURSES_BASE = '/admin/courses';

/**
 * Base path for admin categories API endpoints
 */
const ADMIN_CATEGORIES_BASE = '/admin/courses/categories';

// ============================================================================
// Type Definitions for API Responses
// ============================================================================

/**
 * Response structure for paginated course listings
 */
interface CoursesListResponse {
  items: Course[];
  total: number;
}

/**
 * Response structure for paginated category listings
 */
interface CategoriesListResponse {
  items: CourseCategory[];
  total: number;
}

/**
 * Parameters for moving a category to a new parent
 */
interface MoveCategoryParams {
  /** The category ID to move */
  categoryId: CategoryId;
  /** The new parent category ID (0 for top-level) */
  newParentId: CategoryId;
}

// ============================================================================
// Course CRUD Functions
// ============================================================================

/**
 * Retrieves a paginated list of all courses with optional filtering.
 *
 * This function calls GET /api/v1/admin/courses with query parameters for
 * filtering, sorting, and pagination. The backend wraps Moodle's get_courses()
 * function and enforces moodle/course:viewhiddencourses capability.
 *
 * @param filters - Optional filter parameters for narrowing results
 * @returns Promise resolving to paginated course list with metadata
 *
 * @example
 * ```typescript
 * // Get first page of all courses
 * const courses = await getAllCourses({ page: 1, perPage: 20 });
 *
 * // Get courses filtered by category and visibility
 * const filteredCourses = await getAllCourses({
 *   categoryId: 5,
 *   visible: true,
 *   sortBy: 'fullname',
 *   sortOrder: 'asc'
 * });
 * ```
 */
export async function getAllCourses(
  filters?: CourseFilters
): Promise<PaginatedResponse<Course>> {
  const params = buildCourseFilterParams(filters);

  const response = await apiClient.get<PaginatedResponse<Course>>(
    ADMIN_COURSES_BASE,
    { params }
  );

  return response.data;
}

/**
 * Retrieves a single course by its ID.
 *
 * Calls GET /api/v1/admin/courses/{id} which wraps Moodle's get_course() function.
 * Requires moodle/course:view capability on the course context.
 *
 * @param id - The unique course identifier
 * @returns Promise resolving to the course data
 *
 * @example
 * ```typescript
 * const course = await getCourse(42);
 * console.log(course.data.fullname); // "Introduction to Computer Science"
 * ```
 */
export async function getCourse(id: CourseId): Promise<ApiResponse<Course>> {
  const response = await apiClient.get<ApiResponse<Course>>(
    `${ADMIN_COURSES_BASE}/${id}`
  );

  return response.data;
}

/**
 * Creates a new course with the provided data.
 *
 * Calls POST /api/v1/admin/courses which wraps Moodle's create_course() function.
 * Requires moodle/course:create capability on the target category context.
 *
 * @param data - Course creation data including required fields (fullname, shortname, category)
 * @returns Promise resolving to the newly created course
 *
 * @example
 * ```typescript
 * const newCourse = await createCourse({
 *   fullname: 'Advanced TypeScript',
 *   shortname: 'TS201',
 *   category: 5,
 *   format: 'topics',
 *   startdate: Math.floor(Date.now() / 1000)
 * });
 * ```
 */
export async function createCourse(
  data: CourseFormData
): Promise<ApiResponse<Course>> {
  const response = await apiClient.post<ApiResponse<Course>>(
    ADMIN_COURSES_BASE,
    data
  );

  return response.data;
}

/**
 * Updates an existing course with partial data.
 *
 * Calls PUT /api/v1/admin/courses/{id} which wraps Moodle's update_course() function.
 * Requires moodle/course:update capability on the course context.
 *
 * @param id - The unique course identifier to update
 * @param data - Partial course data with fields to update
 * @returns Promise resolving to the updated course
 *
 * @example
 * ```typescript
 * const updatedCourse = await updateCourse(42, {
 *   fullname: 'Advanced TypeScript - Updated',
 *   visible: 1
 * });
 * ```
 */
export async function updateCourse(
  id: CourseId,
  data: Partial<CourseFormData>
): Promise<ApiResponse<Course>> {
  const response = await apiClient.put<ApiResponse<Course>>(
    `${ADMIN_COURSES_BASE}/${id}`,
    data
  );

  return response.data;
}

/**
 * Deletes a course by its ID.
 *
 * Calls DELETE /api/v1/admin/courses/{id} which wraps Moodle's delete_course() function.
 * Requires moodle/course:delete capability on the course context.
 * This operation is permanent and cannot be undone.
 *
 * @param id - The unique course identifier to delete
 * @returns Promise resolving to success confirmation
 *
 * @example
 * ```typescript
 * await deleteCourse(42);
 * // Course has been permanently deleted
 * ```
 */
export async function deleteCourse(
  id: CourseId
): Promise<ApiResponse<{ deleted: boolean }>> {
  const response = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
    `${ADMIN_COURSES_BASE}/${id}`
  );

  return response.data;
}

/**
 * Searches courses with comprehensive filtering options.
 *
 * This is a specialized search function that provides full-text search across
 * course names, short names, and descriptions, combined with filter criteria.
 * Calls GET /api/v1/admin/courses with search-specific query parameters.
 *
 * @param filters - Search and filter parameters
 * @returns Promise resolving to paginated search results
 *
 * @example
 * ```typescript
 * // Search for courses containing "computer science"
 * const results = await searchCourses({
 *   search: 'computer science',
 *   visible: true,
 *   page: 1,
 *   perPage: 20
 * });
 *
 * // Search within a specific date range
 * const dateFilteredResults = await searchCourses({
 *   startDateFrom: '2024-01-01',
 *   startDateTo: '2024-06-30',
 *   sortBy: 'startdate',
 *   sortOrder: 'asc'
 * });
 * ```
 */
export async function searchCourses(
  filters: CourseFilters
): Promise<PaginatedResponse<Course>> {
  const params = buildCourseFilterParams(filters);

  const response = await apiClient.get<PaginatedResponse<Course>>(
    ADMIN_COURSES_BASE,
    { params }
  );

  return response.data;
}

// ============================================================================
// Category Management Functions
// ============================================================================

/**
 * Retrieves all course categories with optional filtering.
 *
 * Calls GET /api/v1/admin/courses/categories which wraps Moodle's
 * core_course_category::get_all() function. Returns categories in
 * hierarchical order by default.
 *
 * @param params - Optional parameters for filtering and pagination
 * @returns Promise resolving to paginated category list
 *
 * @example
 * ```typescript
 * // Get all categories
 * const categories = await getAllCategories();
 *
 * // Get categories with pagination
 * const pagedCategories = await getAllCategories({
 *   page: 1,
 *   perPage: 50
 * });
 * ```
 */
export async function getAllCategories(params?: {
  page?: number;
  perPage?: number;
  parent?: CategoryId;
}): Promise<PaginatedResponse<CourseCategory>> {
  const response = await apiClient.get<PaginatedResponse<CourseCategory>>(
    ADMIN_CATEGORIES_BASE,
    { params }
  );

  return response.data;
}

/**
 * Retrieves a single category by its ID.
 *
 * Calls GET /api/v1/admin/courses/categories/{id} which wraps Moodle's
 * core_course_category::get() function. Includes category details
 * such as course count and child categories.
 *
 * @param id - The unique category identifier
 * @returns Promise resolving to the category data
 *
 * @example
 * ```typescript
 * const category = await getCategory(5);
 * console.log(category.data.name); // "Computer Science"
 * console.log(category.data.coursecount); // 15
 * ```
 */
export async function getCategory(
  id: CategoryId
): Promise<ApiResponse<CourseCategory>> {
  const response = await apiClient.get<ApiResponse<CourseCategory>>(
    `${ADMIN_CATEGORIES_BASE}/${id}`
  );

  return response.data;
}

/**
 * Creates a new course category.
 *
 * Calls POST /api/v1/admin/courses/categories which wraps Moodle's
 * core_course_category::create() function. Requires moodle/category:manage
 * capability on the parent category context.
 *
 * @param data - Category creation data including name and parent
 * @returns Promise resolving to the newly created category
 *
 * @example
 * ```typescript
 * const newCategory = await createCategory({
 *   name: 'Data Science',
 *   parent: 0, // Top-level category
 *   description: 'Courses related to data science and analytics'
 * });
 * ```
 */
export async function createCategory(
  data: CategoryFormData
): Promise<ApiResponse<CourseCategory>> {
  const response = await apiClient.post<ApiResponse<CourseCategory>>(
    ADMIN_CATEGORIES_BASE,
    data
  );

  return response.data;
}

/**
 * Updates an existing course category.
 *
 * Calls PUT /api/v1/admin/courses/categories/{id} which wraps Moodle's
 * core_course_category::update() function. Requires moodle/category:manage
 * capability on the category context.
 *
 * @param id - The unique category identifier to update
 * @param data - Partial category data with fields to update
 * @returns Promise resolving to the updated category
 *
 * @example
 * ```typescript
 * const updatedCategory = await updateCategory(5, {
 *   name: 'Computer Science - Updated',
 *   description: 'Updated description for CS courses'
 * });
 * ```
 */
export async function updateCategory(
  id: CategoryId,
  data: Partial<CategoryFormData>
): Promise<ApiResponse<CourseCategory>> {
  const response = await apiClient.put<ApiResponse<CourseCategory>>(
    `${ADMIN_CATEGORIES_BASE}/${id}`,
    data
  );

  return response.data;
}

/**
 * Deletes a course category.
 *
 * Calls DELETE /api/v1/admin/courses/categories/{id} which wraps Moodle's
 * core_course_category::delete_full() function. Requires moodle/category:manage
 * capability on the category context.
 *
 * Warning: This will also delete or move all courses within the category
 * depending on backend configuration.
 *
 * @param id - The unique category identifier to delete
 * @param moveTo - Optional category ID to move courses to before deletion
 * @returns Promise resolving to success confirmation
 *
 * @example
 * ```typescript
 * // Delete category and move courses to another category
 * await deleteCategory(5, 10);
 *
 * // Delete empty category
 * await deleteCategory(5);
 * ```
 */
export async function deleteCategory(
  id: CategoryId,
  moveTo?: CategoryId
): Promise<ApiResponse<{ deleted: boolean }>> {
  const params = moveTo !== undefined ? { moveTo } : undefined;

  const response = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
    `${ADMIN_CATEGORIES_BASE}/${id}`,
    { params }
  );

  return response.data;
}

/**
 * Moves a category to a new parent category.
 *
 * Calls PUT /api/v1/admin/courses/categories/{id}/move which wraps Moodle's
 * core_course_category::change_parent() function. Requires moodle/category:manage
 * capability on both source and target category contexts.
 *
 * @param categoryId - The category ID to move
 * @param newParentId - The new parent category ID (0 for top-level)
 * @returns Promise resolving to the updated category
 *
 * @example
 * ```typescript
 * // Move category to be a child of another category
 * await moveCategory(5, 10);
 *
 * // Move category to top level
 * await moveCategory(5, 0);
 * ```
 */
export async function moveCategory(
  categoryId: CategoryId,
  newParentId: CategoryId
): Promise<ApiResponse<CourseCategory>> {
  const response = await apiClient.put<ApiResponse<CourseCategory>>(
    `${ADMIN_CATEGORIES_BASE}/${categoryId}/move`,
    { parent: newParentId }
  );

  return response.data;
}

// ============================================================================
// Bulk Operations Functions
// ============================================================================

/**
 * Performs bulk deletion of multiple courses.
 *
 * Calls POST /api/v1/admin/courses/bulk with action type 'delete'.
 * Requires moodle/course:delete capability on each course's context.
 * This operation is permanent and cannot be undone.
 *
 * @param courseIds - Array of course IDs to delete
 * @returns Promise resolving to bulk operation result with success/failure counts
 *
 * @example
 * ```typescript
 * const result = await bulkDeleteCourses([42, 43, 44]);
 * console.log(`Deleted ${result.data.successCount} of ${result.data.totalCount} courses`);
 * if (result.data.errors.length > 0) {
 *   console.error('Failed courses:', result.data.errors);
 * }
 * ```
 */
export async function bulkDeleteCourses(
  courseIds: CourseId[]
): Promise<ApiResponse<BulkActionResult>> {
  const bulkAction: BulkCourseAction = {
    action: 'delete' as BulkActionType,
    courseIds,
  };

  const response = await apiClient.post<ApiResponse<BulkActionResult>>(
    `${ADMIN_COURSES_BASE}/bulk`,
    bulkAction
  );

  return response.data;
}

/**
 * Performs bulk update operations on multiple courses.
 *
 * Calls POST /api/v1/admin/courses/bulk with action type 'change_visibility'.
 * Can update visibility or other common course properties.
 * Requires moodle/course:visibility capability on each course's context.
 *
 * @param courseIds - Array of course IDs to update
 * @param visible - New visibility state for the courses
 * @returns Promise resolving to bulk operation result with success/failure counts
 *
 * @example
 * ```typescript
 * // Hide multiple courses
 * const result = await bulkUpdateCourses([42, 43, 44], false);
 *
 * // Show multiple courses
 * const result = await bulkUpdateCourses([42, 43, 44], true);
 * ```
 */
export async function bulkUpdateCourses(
  courseIds: CourseId[],
  visible: boolean
): Promise<ApiResponse<BulkActionResult>> {
  const bulkAction: BulkCourseAction = {
    action: 'change_visibility' as BulkActionType,
    courseIds,
    parameters: {
      visible,
    },
  };

  const response = await apiClient.post<ApiResponse<BulkActionResult>>(
    `${ADMIN_COURSES_BASE}/bulk`,
    bulkAction
  );

  return response.data;
}

/**
 * Moves multiple courses to a different category.
 *
 * Calls POST /api/v1/admin/courses/bulk with action type 'move_to_category'.
 * Requires moodle/course:changecategory capability on each course's context
 * and moodle/category:manage on the target category.
 *
 * @param courseIds - Array of course IDs to move
 * @param targetCategoryId - Destination category ID
 * @returns Promise resolving to bulk operation result with success/failure counts
 *
 * @example
 * ```typescript
 * // Move courses to a new category
 * const result = await bulkMoveCourses([42, 43, 44], 10);
 * console.log(`Moved ${result.data.successCount} courses to category 10`);
 * ```
 */
export async function bulkMoveCourses(
  courseIds: CourseId[],
  targetCategoryId: CategoryId
): Promise<ApiResponse<BulkActionResult>> {
  const bulkAction: BulkCourseAction = {
    action: 'move_to_category' as BulkActionType,
    courseIds,
    parameters: {
      categoryId: targetCategoryId,
    },
  };

  const response = await apiClient.post<ApiResponse<BulkActionResult>>(
    `${ADMIN_COURSES_BASE}/bulk`,
    bulkAction
  );

  return response.data;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Builds query parameters object from CourseFilters.
 *
 * Converts the CourseFilters interface into a flat object suitable for
 * URL query parameters. Handles undefined values by omitting them from
 * the resulting object.
 *
 * @param filters - The course filter parameters
 * @returns Record of query parameters
 *
 * @internal
 */
function buildCourseFilterParams(
  filters?: CourseFilters
): Record<string, string | number | boolean | undefined> {
  if (!filters) {
    return {};
  }

  const params: Record<string, string | number | boolean | undefined> = {};

  // Text search
  if (filters.search !== undefined && filters.search.trim() !== '') {
    params.search = filters.search.trim();
  }

  // Category filter
  if (filters.categoryId !== undefined) {
    params.categoryId = filters.categoryId;
  }

  // Visibility filter
  if (filters.visible !== undefined) {
    params.visible = filters.visible;
  }

  // Date range filters
  if (filters.startDateFrom !== undefined) {
    params.startDateFrom = filters.startDateFrom;
  }
  if (filters.startDateTo !== undefined) {
    params.startDateTo = filters.startDateTo;
  }
  if (filters.endDateFrom !== undefined) {
    params.endDateFrom = filters.endDateFrom;
  }
  if (filters.endDateTo !== undefined) {
    params.endDateTo = filters.endDateTo;
  }

  // Sorting
  if (filters.sortBy !== undefined) {
    params.sortBy = filters.sortBy;
  }
  if (filters.sortOrder !== undefined) {
    params.sortOrder = filters.sortOrder;
  }

  // Pagination
  if (filters.page !== undefined) {
    params.page = filters.page;
  }
  if (filters.perPage !== undefined) {
    params.perPage = filters.perPage;
  }

  return params;
}
