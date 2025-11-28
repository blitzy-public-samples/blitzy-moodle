/**
 * Course API Client Module
 *
 * TypeScript functions for all course-related operations including listing courses,
 * retrieving course details, creating courses, updating courses, deleting courses,
 * enrolling in courses, and fetching course contents. Wraps RESTful API calls to
 * /api/v1/courses/* endpoints using axios HTTP client.
 *
 * This module implements the API client layer following the architecture defined in
 * Section 0.3 of the Agent Action Plan. All API functions call backend endpoints
 * that wrap existing Moodle functions like get_courses(), get_course(), create_course(),
 * update_course(), delete_course(), and enrol_try_internal_enrol(), maintaining 100%
 * backward compatibility with existing PHP business logic.
 *
 * Features:
 * - Standard request/response handling with proper error management
 * - Pagination support for course listings
 * - Type safety with comprehensive TypeScript interfaces
 * - Integration ready for React Query caching and server state management
 *
 * Usage:
 * ```typescript
 * import { getCourses, getCourse, enrollInCourse, CreateCourseInput } from '@/features/courses/api/courseApi';
 *
 * // Fetch paginated courses
 * const response = await getCourses({ page: 1, perPage: 20, categoryId: 5 });
 *
 * // Get course details
 * const course = await getCourse(42);
 *
 * // Enroll in a course
 * const enrollment = await enrollInCourse(42);
 * ```
 *
 * @module features/courses/api/courseApi
 * @see public/course/externallib.php - Moodle course external functions
 * @see public/course/lib.php - Moodle course library functions
 */

import { apiClient } from '@/services/api/client';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Course, CourseModule } from '@/types/entities';
import type { CategoryId } from '@/types/common';

// ============================================================================
// API Endpoint Constants
// ============================================================================

/**
 * Course API endpoint paths
 * These are relative to the API base URL (/api/v1)
 */
const ENDPOINTS = {
  /** GET - Retrieve paginated list of courses with optional filters */
  LIST: '/courses',
  /** GET/PUT/DELETE - Course detail, update, or delete by ID */
  DETAIL: (id: number): string => `/courses/${id}`,
  /** POST - Create a new course */
  CREATE: '/courses',
  /** POST - Enroll in a course */
  ENROLL: (id: number): string => `/courses/${id}/enroll`,
  /** POST - Unenroll from a course */
  UNENROLL: (id: number): string => `/courses/${id}/unenroll`,
  /** GET - Get course contents (sections, activities, resources) */
  CONTENTS: (id: number): string => `/courses/${id}/contents`,
} as const;

// ============================================================================
// Input/Output Interfaces
// ============================================================================

/**
 * Input data for creating a new course
 *
 * Required fields align with Moodle's create_course() function parameters
 * from public/course/lib.php (line 1903).
 *
 * @example
 * ```typescript
 * const newCourse: CreateCourseInput = {
 *   fullname: 'Introduction to TypeScript',
 *   shortname: 'TS101',
 *   categoryid: 5,
 *   format: 'topics',
 *   summary: '<p>Learn TypeScript fundamentals</p>',
 *   startdate: 1704067200, // January 1, 2024
 *   enddate: 1717200000,   // June 1, 2024
 *   visible: true
 * };
 * ```
 */
export interface CreateCourseInput {
  /** Full course name displayed on course pages */
  fullname: string;
  /** Short course name/code used in navigation and reports */
  shortname: string;
  /** Category ID where the course belongs */
  categoryid: CategoryId;
  /** Course format (topics, weeks, social, singleactivity, etc.) */
  format: string;
  /** Course summary/description (HTML content) */
  summary: string;
  /** Summary content format (1=HTML, 2=PLAIN, etc.) - defaults to 1 */
  summaryformat?: number;
  /** Course start date (Unix timestamp) */
  startdate?: number;
  /** Course end date (Unix timestamp) */
  enddate?: number;
  /** Whether the course is visible to students */
  visible?: boolean;
  /** Custom field values as key-value pairs */
  customfields?: Record<string, string | number | boolean>;
}

/**
 * Input data for updating an existing course
 *
 * All fields are optional except 'id'. Only provided fields will be updated.
 * Aligns with Moodle's update_course() function from public/course/lib.php (line 2054).
 *
 * @example
 * ```typescript
 * const updateData: UpdateCourseInput = {
 *   id: 42,
 *   fullname: 'Advanced TypeScript',
 *   visible: true
 * };
 * ```
 */
export interface UpdateCourseInput {
  /** Course ID to update (required) */
  id: number;
  /** Updated full course name */
  fullname?: string;
  /** Updated short course name/code */
  shortname?: string;
  /** Updated course summary (HTML content) */
  summary?: string;
  /** Updated course format */
  format?: string;
  /** Updated visibility status */
  visible?: boolean;
  /** Updated category ID */
  categoryid?: CategoryId;
  /** Updated start date (Unix timestamp) */
  startdate?: number;
  /** Updated end date (Unix timestamp) */
  enddate?: number;
}

/**
 * Options for filtering course contents retrieval
 *
 * Allows fine-grained control over what course content is returned.
 * Aligns with Moodle's get_course_contents() options from
 * public/course/externallib.php (lines 94-439).
 *
 * @example
 * ```typescript
 * // Get only section 2 contents
 * const options: ContentOptions = {
 *   sectionNumber: 2,
 *   excludeContents: false
 * };
 *
 * // Get specific module by ID
 * const options: ContentOptions = {
 *   cmId: 156
 * };
 * ```
 */
export interface ContentOptions {
  /** Exclude module details from response (only return section info) */
  excludeModules?: boolean;
  /** Exclude file content details from modules */
  excludeContents?: boolean;
  /** Filter by section ID */
  sectionId?: number;
  /** Filter by section number (0 for general section) */
  sectionNumber?: number;
  /** Filter by course module ID */
  cmId?: number;
  /** Filter by module type name (assign, quiz, forum, etc.) */
  modName?: string;
}

/**
 * Course content section with modules
 *
 * Represents a section within a course containing activities and resources.
 * Maps to Moodle's course_sections structure with nested course_modules.
 *
 * @see public/course/externallib.php - get_course_contents() return structure
 */
export interface CourseContent {
  /** Section ID */
  id: number;
  /** Section name/title */
  name: string;
  /** Whether the section is visible to students */
  visible: boolean;
  /** Section summary/description (HTML) */
  summary: string;
  /** Summary content format (1=HTML, 2=PLAIN, etc.) */
  summaryformat: number;
  /** Section number (0 for general section) */
  section: number;
  /** Whether section is hidden due to numsections setting */
  hiddenbynumsections: boolean;
  /** Whether section is visible to the current user */
  uservisible: boolean;
  /** Array of modules/activities in this section */
  modules: CourseModule[];
}

/**
 * Result of an enrollment operation
 *
 * Returned by enrollInCourse() and unenrollFromCourse() functions.
 * Contains status and details of the enrollment action.
 */
export interface EnrollmentResult {
  /** Whether the enrollment operation succeeded */
  success: boolean;
  /** Course ID for the enrollment */
  courseid: number;
  /** User ID who was enrolled/unenrolled */
  userid: number;
  /** Role ID assigned during enrollment (student, teacher, etc.) */
  roleid: number;
  /** Human-readable message about the enrollment result */
  message: string;
}

/**
 * Query parameters for course list requests
 *
 * Supports pagination, filtering, and search functionality.
 */
export interface CourseListParams {
  /** Page number (1-indexed, defaults to 1) */
  page?: number;
  /** Number of courses per page (defaults to 20) */
  perPage?: number;
  /** Filter by category ID */
  categoryId?: CategoryId;
  /** Search query string to filter courses */
  search?: string;
  /** Sort field */
  sort?: 'fullname' | 'shortname' | 'startdate' | 'timecreated';
  /** Sort order */
  order?: 'asc' | 'desc';
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch paginated list of courses
 *
 * Makes GET request to /api/v1/courses with optional query parameters.
 * Wraps existing Moodle get_courses() function from public/course/externallib.php
 * (lines 641-758) with pagination and filtering support.
 *
 * @param params - Optional query parameters for filtering and pagination
 * @returns Promise resolving to paginated course list with metadata
 *
 * @example
 * ```typescript
 * // Get first page of courses
 * const response = await getCourses();
 *
 * // Get courses in category 5 with pagination
 * const response = await getCourses({
 *   page: 1,
 *   perPage: 20,
 *   categoryId: 5
 * });
 *
 * // Search for courses
 * const response = await getCourses({
 *   search: 'typescript',
 *   sort: 'fullname',
 *   order: 'asc'
 * });
 *
 * // Access the data
 * console.log(response.data.items);       // Course[]
 * console.log(response.data.total);       // Total count
 * console.log(response.meta.pagination);  // Pagination metadata
 * ```
 *
 * @throws {ApiError} When the request fails or user lacks permission
 */
export async function getCourses(
  params: CourseListParams = {}
): Promise<PaginatedResponse<Course>> {
  const queryParams: Record<string, string | number | undefined> = {};

  if (params.page !== undefined) {
    queryParams.page = params.page;
  }
  if (params.perPage !== undefined) {
    queryParams.perPage = params.perPage;
  }
  if (params.categoryId !== undefined) {
    queryParams.categoryid = params.categoryId;
  }
  if (params.search !== undefined && params.search.trim() !== '') {
    queryParams.search = params.search.trim();
  }
  if (params.sort !== undefined) {
    queryParams.sort = params.sort;
  }
  if (params.order !== undefined) {
    queryParams.order = params.order;
  }

  const response = await apiClient.get<PaginatedResponse<Course>>(
    ENDPOINTS.LIST,
    { params: queryParams }
  );

  return response.data;
}

/**
 * Fetch single course details
 *
 * Makes GET request to /api/v1/courses/{id}.
 * Wraps existing Moodle get_course() function and optionally includes
 * course contents from get_course_contents().
 *
 * @param id - Course ID to retrieve
 * @returns Promise resolving to course details
 *
 * @example
 * ```typescript
 * const response = await getCourse(42);
 *
 * // Access course data
 * console.log(response.data.fullname);     // Course name
 * console.log(response.data.sections);     // Course sections
 * console.log(response.data.isenrolled);   // Enrollment status
 * ```
 *
 * @throws {ApiError} When course not found (404) or user lacks permission (403)
 */
export async function getCourse(id: number): Promise<ApiResponse<Course>> {
  if (!id || id <= 0) {
    throw new Error('Invalid course ID: must be a positive number');
  }

  const response = await apiClient.get<ApiResponse<Course>>(
    ENDPOINTS.DETAIL(id)
  );

  return response.data;
}

/**
 * Create a new course
 *
 * Makes POST request to /api/v1/courses with course data.
 * Wraps existing Moodle create_course() function from public/course/lib.php (line 1903).
 *
 * Requires 'moodle/course:create' capability in the target category context.
 *
 * @param data - Course creation data with required and optional fields
 * @returns Promise resolving to the newly created course
 *
 * @example
 * ```typescript
 * const newCourse = await createCourse({
 *   fullname: 'Introduction to TypeScript',
 *   shortname: 'TS101',
 *   categoryid: 5,
 *   format: 'topics',
 *   summary: '<p>Learn TypeScript fundamentals</p>',
 *   visible: true
 * });
 *
 * console.log(newCourse.data.id);  // New course ID
 * ```
 *
 * @throws {ApiError} When validation fails (400) or user lacks permission (403)
 */
export async function createCourse(
  data: CreateCourseInput
): Promise<ApiResponse<Course>> {
  // Validate required fields
  if (!data.fullname || data.fullname.trim() === '') {
    throw new Error('Course fullname is required');
  }
  if (!data.shortname || data.shortname.trim() === '') {
    throw new Error('Course shortname is required');
  }
  if (!data.categoryid || data.categoryid <= 0) {
    throw new Error('Valid category ID is required');
  }
  if (!data.format || data.format.trim() === '') {
    throw new Error('Course format is required');
  }

  // Prepare request payload
  const payload: Record<string, unknown> = {
    fullname: data.fullname.trim(),
    shortname: data.shortname.trim(),
    categoryid: data.categoryid,
    format: data.format.trim(),
    summary: data.summary || '',
    summaryformat: data.summaryformat ?? 1, // Default to HTML format
    visible: data.visible ?? true,
  };

  if (data.startdate !== undefined) {
    payload.startdate = data.startdate;
  }
  if (data.enddate !== undefined) {
    payload.enddate = data.enddate;
  }
  if (data.customfields !== undefined) {
    payload.customfields = data.customfields;
  }

  const response = await apiClient.post<ApiResponse<Course>>(
    ENDPOINTS.CREATE,
    payload
  );

  return response.data;
}

/**
 * Update an existing course
 *
 * Makes PUT request to /api/v1/courses/{id} with updated course data.
 * Wraps existing Moodle update_course() function from public/course/lib.php (line 2054).
 *
 * Only provided fields are updated; omitted fields remain unchanged.
 * Requires 'moodle/course:update' capability in the course context.
 *
 * @param id - Course ID to update
 * @param data - Partial course data with fields to update
 * @returns Promise resolving to the updated course
 *
 * @example
 * ```typescript
 * const updatedCourse = await updateCourse(42, {
 *   id: 42,
 *   fullname: 'Advanced TypeScript Programming',
 *   visible: true
 * });
 *
 * console.log(updatedCourse.data.fullname);  // Updated name
 * ```
 *
 * @throws {ApiError} When course not found (404), validation fails (400), or user lacks permission (403)
 */
export async function updateCourse(
  id: number,
  data: UpdateCourseInput
): Promise<ApiResponse<Course>> {
  if (!id || id <= 0) {
    throw new Error('Invalid course ID: must be a positive number');
  }

  // Prepare payload with only defined fields
  const payload: Record<string, unknown> = { id };

  if (data.fullname !== undefined) {
    payload.fullname = data.fullname.trim();
  }
  if (data.shortname !== undefined) {
    payload.shortname = data.shortname.trim();
  }
  if (data.summary !== undefined) {
    payload.summary = data.summary;
  }
  if (data.format !== undefined) {
    payload.format = data.format.trim();
  }
  if (data.visible !== undefined) {
    payload.visible = data.visible;
  }
  if (data.categoryid !== undefined) {
    payload.categoryid = data.categoryid;
  }
  if (data.startdate !== undefined) {
    payload.startdate = data.startdate;
  }
  if (data.enddate !== undefined) {
    payload.enddate = data.enddate;
  }

  const response = await apiClient.put<ApiResponse<Course>>(
    ENDPOINTS.DETAIL(id),
    payload
  );

  return response.data;
}

/**
 * Delete a course
 *
 * Makes DELETE request to /api/v1/courses/{id}.
 * Wraps existing Moodle delete_course() function.
 *
 * This is a destructive operation that permanently removes the course
 * and all associated data (activities, grades, enrollments, etc.).
 * Requires 'moodle/course:delete' capability.
 *
 * @param id - Course ID to delete
 * @returns Promise resolving to success confirmation
 *
 * @example
 * ```typescript
 * const result = await deleteCourse(42);
 * console.log(result.success);  // true
 * ```
 *
 * @throws {ApiError} When course not found (404) or user lacks permission (403)
 */
export async function deleteCourse(id: number): Promise<ApiResponse<void>> {
  if (!id || id <= 0) {
    throw new Error('Invalid course ID: must be a positive number');
  }

  const response = await apiClient.delete<ApiResponse<void>>(
    ENDPOINTS.DETAIL(id)
  );

  return response.data;
}

/**
 * Enroll in a course
 *
 * Makes POST request to /api/v1/courses/{courseId}/enroll.
 * Wraps existing Moodle enrol_try_internal_enrol() function from public/lib/enrollib.php.
 *
 * Enrolls the current user (or specified user if admin) in the course
 * with the default student role. The enrollment method and role depend
 * on course settings and user capabilities.
 *
 * @param courseId - Course ID to enroll in
 * @param userId - Optional user ID (admin can enroll other users)
 * @returns Promise resolving to enrollment result with status and details
 *
 * @example
 * ```typescript
 * // Enroll current user
 * const result = await enrollInCourse(42);
 * if (result.data.success) {
 *   console.log('Enrolled successfully!');
 * }
 *
 * // Admin enrolling another user
 * const result = await enrollInCourse(42, 15);
 * ```
 *
 * @throws {ApiError} When enrollment fails due to restrictions or permissions
 */
export async function enrollInCourse(
  courseId: number,
  userId?: number
): Promise<ApiResponse<EnrollmentResult>> {
  if (!courseId || courseId <= 0) {
    throw new Error('Invalid course ID: must be a positive number');
  }

  const payload: Record<string, number> = {};
  if (userId !== undefined && userId > 0) {
    payload.userid = userId;
  }

  const response = await apiClient.post<ApiResponse<EnrollmentResult>>(
    ENDPOINTS.ENROLL(courseId),
    payload
  );

  return response.data;
}

/**
 * Unenroll from a course
 *
 * Makes POST request to /api/v1/courses/{courseId}/unenroll.
 * Wraps existing Moodle unenrol_user() function.
 *
 * Removes the current user (or specified user if admin) from the course.
 * Depending on settings, enrollment data may be retained for a grace period.
 *
 * @param courseId - Course ID to unenroll from
 * @param userId - Optional user ID (admin can unenroll other users)
 * @returns Promise resolving to unenrollment result
 *
 * @example
 * ```typescript
 * // Unenroll current user
 * const result = await unenrollFromCourse(42);
 *
 * // Admin unenrolling a user
 * const result = await unenrollFromCourse(42, 15);
 * ```
 *
 * @throws {ApiError} When unenrollment fails due to restrictions or permissions
 */
export async function unenrollFromCourse(
  courseId: number,
  userId?: number
): Promise<ApiResponse<EnrollmentResult>> {
  if (!courseId || courseId <= 0) {
    throw new Error('Invalid course ID: must be a positive number');
  }

  const payload: Record<string, number> = {};
  if (userId !== undefined && userId > 0) {
    payload.userid = userId;
  }

  const response = await apiClient.post<ApiResponse<EnrollmentResult>>(
    ENDPOINTS.UNENROLL(courseId),
    payload
  );

  return response.data;
}

/**
 * Fetch course contents (sections, modules, activities)
 *
 * Makes GET request to /api/v1/courses/{courseId}/contents with optional filters.
 * Wraps existing Moodle get_course_contents() function from public/course/externallib.php
 * (lines 94-439).
 *
 * Returns the course structure including sections, activities, resources,
 * completion status, and visibility information based on user permissions.
 *
 * @param courseId - Course ID to get contents for
 * @param options - Optional filters for content retrieval
 * @returns Promise resolving to course sections with their modules
 *
 * @example
 * ```typescript
 * // Get all course contents
 * const result = await getCourseContents(42);
 *
 * // Get contents for specific section
 * const result = await getCourseContents(42, { sectionNumber: 2 });
 *
 * // Get only assignments
 * const result = await getCourseContents(42, { modName: 'assign' });
 *
 * // Access the content tree
 * result.data.forEach(section => {
 *   console.log(section.name, section.modules.length);
 * });
 * ```
 *
 * @throws {ApiError} When course not found (404) or user lacks permission (403)
 */
export async function getCourseContents(
  courseId: number,
  options: ContentOptions = {}
): Promise<ApiResponse<CourseContent[]>> {
  if (!courseId || courseId <= 0) {
    throw new Error('Invalid course ID: must be a positive number');
  }

  const queryParams: Record<string, string | number | boolean> = {};

  if (options.excludeModules !== undefined) {
    queryParams.excludemodules = options.excludeModules;
  }
  if (options.excludeContents !== undefined) {
    queryParams.excludecontents = options.excludeContents;
  }
  if (options.sectionId !== undefined) {
    queryParams.sectionid = options.sectionId;
  }
  if (options.sectionNumber !== undefined) {
    queryParams.sectionnumber = options.sectionNumber;
  }
  if (options.cmId !== undefined) {
    queryParams.cmid = options.cmId;
  }
  if (options.modName !== undefined && options.modName.trim() !== '') {
    queryParams.modname = options.modName.trim();
  }

  const response = await apiClient.get<ApiResponse<CourseContent[]>>(
    ENDPOINTS.CONTENTS(courseId),
    { params: queryParams }
  );

  return response.data;
}
