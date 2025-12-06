/**
 * Gradebook API Client Module
 *
 * TypeScript functions for all gradebook-related operations including fetching
 * course grades, user grades, grade items, updating grades, and exporting grade data.
 * Wraps RESTful API calls to /api/v1/gradebook/* endpoints using axios HTTP client.
 *
 * This module implements standard request/response handling with proper error
 * management and type safety. All functions call backend endpoints that wrap
 * existing Moodle grade functions like grade_get_course_grades(), grade_get_course_grade(),
 * grade_update(), and get_grade_tree(), maintaining 100% backward compatibility
 * with existing PHP business logic.
 *
 * Architecture Notes:
 * - This file contains pure API client functions (no React Query hooks)
 * - React Query hooks are implemented in useGrades.ts which imports from this file
 * - All functions return Promise<ApiResult<T>> for consistent typing (ApiResponse<T> on success, ErrorResponse on error)
 * - Error handling transforms HTTP errors into user-friendly ApiError responses
 *
 * Backend Functions Wrapped:
 * - grade_get_course_grades() from public/grade/querylib.php (line 34)
 * - grade_get_course_grade() from public/grade/querylib.php (line 137)
 * - grade_get_grade_items_for_activity() from public/grade/querylib.php (line 250)
 * - grade_update() from public/grade/lib.php
 * - get_grade_tree() from public/grade/classes/external/get_grade_tree.php
 *
 * @module features/gradebook/api/gradebookApi
 */

import apiClient from '@/services/api/client';
import type { ApiResponse, ApiResult } from '@/types/api';
import type { ErrorResponse } from '@/types/errors';
import { ApiErrorCode } from '@/types/errors';
import type {
  Grade,
  GradeItem,
  GradeCategory,
} from '../types/grade.types';

// ============================================================================
// TYPE DEFINITIONS - Interfaces for API requests and responses
// ============================================================================

/**
 * Options for getGradeItems API function
 *
 * Supports filtering grade items by course, course module, or retrieving only
 * main items (itemnumber=0). Maps to query parameters for GET /api/v1/gradebook/items
 */
export interface GetGradeItemsOptions {
  /** Filter by course ID */
  courseId?: number;
  /** Filter by course module ID (activity) */
  cmId?: number;
  /** Only retrieve main items (itemnumber=0) */
  onlyMain?: boolean;
  /** Include hidden items in the response */
  includeHidden?: boolean;
  /** Filter by category ID */
  categoryId?: number;
  /** Filter by item type (mod, category, course, manual) */
  itemType?: string;
}

/**
 * Input data for updating a grade item
 *
 * Partial update of grade item properties. Only specified fields are updated.
 * Triggers grade recalculation if grademax or grademin changed.
 */
export interface UpdateGradeItemInput {
  /** Display name of this grade item */
  itemname?: string;
  /** Maximum grade value */
  grademax?: number;
  /** Minimum grade value */
  grademin?: number;
  /** Grade value required to pass */
  gradepass?: number;
  /** Hidden status: 0=visible, 1=hidden, >1=hidden until timestamp */
  hidden?: number;
  /** Locked status: 0=unlocked, 1=locked, >1=locked until timestamp */
  locked?: number;
  /** Aggregation coefficient for category weights */
  aggregationcoef?: number;
  /** Display type (0=default, 1=real, 2=percentage, 3=letter, etc.) */
  display?: number;
  /** Number of decimal places to display */
  decimals?: number;
}

/**
 * Input data for updating an individual student grade
 *
 * Used to update a single grade in the grade_grades table.
 * Supports setting grade to null to remove/reset grade.
 */
export interface UpdateGradeInput {
  /** Grade record ID */
  gradeId: number;
  /** New grade value (null to remove/reset) */
  grade: number | null;
  /** Optional feedback text */
  feedback?: string;
}

/**
 * Options for grade export
 *
 * Configures the format and content of exported gradebook data.
 * Supports CSV, Excel, OpenDocument, and plain text formats.
 */
export interface ExportOptions {
  /** Include user data (name, email, ID number) in export */
  includeUserData?: boolean;
  /** Include feedback comments in export */
  includeFeedback?: boolean;
  /** Number of decimal places for grade values */
  decimalPoints?: number;
  /** Display type for grades (real, percentage, letter) */
  displayType?: 'real' | 'percentage' | 'letter';
  /** Show real grades or letter grades */
  realOrLetterGrades?: 'real' | 'letter';
}

/**
 * Course grades response structure
 *
 * Contains grade item metadata and user grades keyed by user ID.
 * Wraps response from grade_get_course_grades() function.
 */
export interface CourseGrades {
  /** Grade item metadata (scaleid, name, grademin, grademax, gradepass, locked, hidden) */
  item: {
    /** ID of scale if grade uses a scale */
    scaleid: number | null;
    /** Display name of the grade item */
    name: string;
    /** Minimum grade value */
    grademin: number;
    /** Maximum grade value */
    grademax: number;
    /** Grade required to pass */
    gradepass: number;
    /** Whether the grade item is locked */
    locked: boolean;
    /** Whether the grade item is hidden */
    hidden: boolean;
  };
  /** User grades mapped by user ID */
  grades: Record<number, UserCourseGrade>;
}

/**
 * Individual user's grade data within a course
 *
 * Contains finalgrade and associated metadata including feedback and timestamps.
 */
export interface UserCourseGrade {
  /** Final calculated grade */
  finalgrade: number | null;
  /** Whether the grade is locked */
  locked: boolean;
  /** Whether the grade is hidden */
  hidden: boolean;
  /** Whether the grade has been manually overridden */
  overridden: boolean;
  /** Feedback text */
  feedback: string | null;
  /** Format of feedback text (0=moodle, 1=html, 2=plain, 4=markdown) */
  feedbackformat: number;
  /** Timestamp when this grade was graded */
  dategraded: number | null;
  /** Timestamp when this grade was submitted */
  datesubmitted: number | null;
  /** Text representation of grade (e.g., "85.5" or "B+") */
  str_grade?: string;
  /** Long text representation (e.g., "85.5 out of 100") */
  str_long_grade?: string;
  /** HTML representation of feedback */
  str_feedback?: string;
}

/**
 * User grades response structure
 *
 * Contains user's grades across one or more courses.
 * Wraps response from grade_get_course_grade() function.
 */
export interface UserGrades {
  /** User ID */
  userId: number;
  /** Array of course grades */
  grades: UserCourseGradeItem[];
}

/**
 * Individual course grade for a user
 */
export interface UserCourseGradeItem {
  /** Course ID */
  courseId: number;
  /** Course full name */
  courseName: string;
  /** Grade data */
  grade: {
    /** Final grade value */
    finalgrade: number | null;
    /** Text representation of grade */
    str_grade: string;
    /** Long text representation */
    str_long_grade: string;
    /** User's rank/position */
    rank?: number | null;
    /** Percentage value */
    percentage?: number | null;
  };
  /** Grade item metadata */
  item: {
    /** Scale ID if applicable */
    scaleid: number | null;
    /** Item name */
    name: string;
    /** Minimum grade */
    grademin: number;
    /** Maximum grade */
    grademax: number;
    /** Grade to pass */
    gradepass: number;
    /** Locked status */
    locked: boolean;
    /** Hidden status */
    hidden: boolean;
  };
}

/**
 * Grade report response structure
 *
 * Flexible structure supporting different report types (user, grader, overview)
 * with columns and rows for tabular display.
 */
export interface GradeReport {
  /** Type of report generated */
  reportType: 'user' | 'grader' | 'overview';
  /** Column definitions for the report table */
  columns: GradeReportColumn[];
  /** Row data for the report table */
  rows: GradeReportRow[];
  /** Summary statistics */
  summary?: GradeReportSummary;
}

/**
 * Column definition for grade report table
 */
export interface GradeReportColumn {
  /** Unique column identifier */
  id: string;
  /** Display header */
  header: string;
  /** Data field name */
  field: string;
  /** Column type for formatting */
  type: 'text' | 'grade' | 'percentage' | 'date' | 'action';
  /** Column width (optional) */
  width?: number;
  /** Whether column is sortable */
  sortable?: boolean;
}

/**
 * Row data for grade report table
 */
export interface GradeReportRow {
  /** Row identifier */
  id: string | number;
  /** Row data mapped by column field */
  [field: string]: unknown;
}

/**
 * Summary statistics for grade report
 */
export interface GradeReportSummary {
  /** Total number of students */
  totalStudents?: number;
  /** Average grade */
  averageGrade?: number | null;
  /** Highest grade */
  highestGrade?: number | null;
  /** Lowest grade */
  lowestGrade?: number | null;
  /** Number of passing students */
  passingCount?: number;
  /** Number of failing students */
  failingCount?: number;
  /** Course total grade */
  courseTotal?: number | null;
  /** Course name (available in user reports) */
  courseName?: string;
  /** User's final letter grade for the course */
  letterGrade?: string | null;
}

/**
 * Export response structure
 */
export interface ExportResponse {
  /** Download URL if file is served from backend */
  url?: string;
  /** Base64 encoded file data for direct download */
  data?: string;
  /** Filename for the export file */
  filename: string;
}

// ============================================================================
// API FUNCTIONS - Gradebook Operations
// ============================================================================

/**
 * Fetch course grades for one or more users
 *
 * Makes GET request to /api/v1/gradebook/course/{courseId} with optional user IDs.
 * Wraps existing Moodle grade_get_course_grades() function from public/grade/querylib.php (line 34).
 *
 * Returns aggregated course grades for specified users including grade item metadata
 * (scaleid, name, grademin, grademax, gradepass, locked, hidden) and user grades
 * mapped by user ID containing finalgrade, locked, hidden, overridden, feedback,
 * feedbackformat, dategraded, datesubmitted.
 *
 * Permission: Validates course ID and checks user permission via existing
 * require_capability('moodle/grade:view') on the backend.
 *
 * @param courseId - The ID of the course to fetch grades for
 * @param options - Optional configuration options
 * @param options.userIds - Optional array of user IDs to filter grades (if omitted, returns all users)
 * @param options.page - Page number for pagination (1-based)
 * @param options.perPage - Number of items per page
 * @returns Promise resolving to ApiResponse containing CourseGrades data
 *
 * @example
 * ```typescript
 * // Fetch all grades for course 5
 * const response = await getCourseGrades(5);
 * if (response.success) {
 *   console.log('Course grades:', response.data);
 * }
 *
 * // Fetch grades for specific users
 * const response = await getCourseGrades(5, { userIds: [101, 102, 103] });
 *
 * // Fetch grades with pagination
 * const response = await getCourseGrades(5, { page: 1, perPage: 20 });
 * ```
 */
export async function getCourseGrades(
  courseId: number,
  options?: {
    userIds?: number[];
    page?: number;
    perPage?: number;
  }
): Promise<ApiResult<CourseGrades>> {
  try {
    // Build query parameters
    const params: Record<string, string | number> = {};
    if (options?.userIds && options.userIds.length > 0) {
      params.userIds = options.userIds.join(',');
    }
    if (options?.page !== undefined) {
      params.page = options.page;
    }
    if (options?.perPage !== undefined) {
      params.perPage = options.perPage;
    }

    const response = await apiClient.get<ApiResponse<CourseGrades>>(
      `/gradebook/course/${courseId}`,
      { params }
    );

    return response.data;
  } catch (error) {
    return handleGradebookError(error, 'Failed to fetch course grades');
  }
}

/**
 * Fetch user grades across one or more courses
 *
 * Makes GET request to /api/v1/gradebook/user/{userId} with optional course IDs.
 * Wraps existing Moodle grade_get_course_grade() function from public/grade/querylib.php (line 137).
 *
 * Returns user's grades across one or more courses with course names and grade values.
 * Includes grade metadata like finalgrade, str_grade (text representation), rank, percentage.
 *
 * Permission: Validates via existing require_capability('moodle/grade:viewall')
 * or ownership check on the backend.
 *
 * @param userId - The ID of the user to fetch grades for
 * @param options - Optional configuration options
 * @param options.courseId - Optional single course ID to filter grades
 * @param options.courseIds - Optional array of course IDs to filter (if omitted, returns all enrolled courses)
 * @returns Promise resolving to ApiResponse containing UserGrades data
 *
 * @example
 * ```typescript
 * // Fetch all grades for user 42
 * const response = await getUserGrades(42);
 *
 * // Fetch grades for a specific course
 * const response = await getUserGrades(42, { courseId: 5 });
 *
 * // Fetch grades for multiple courses
 * const response = await getUserGrades(42, { courseIds: [5, 6, 7] });
 * ```
 */
export async function getUserGrades(
  userId: number,
  options?: {
    courseId?: number;
    courseIds?: number[];
  }
): Promise<ApiResult<UserGrades>> {
  try {
    // Build query parameters
    const params: Record<string, string | number> = {};
    if (options?.courseId !== undefined) {
      params.courseId = options.courseId;
    }
    if (options?.courseIds && options.courseIds.length > 0) {
      params.courseIds = options.courseIds.join(',');
    }

    const response = await apiClient.get<ApiResponse<UserGrades>>(
      `/gradebook/user/${userId}`,
      { params }
    );

    return response.data;
  } catch (error) {
    return handleGradebookError(error, 'Failed to fetch user grades');
  }
}

/**
 * Fetch grade items for a course or activity
 *
 * Makes GET request to /api/v1/gradebook/items with query parameters.
 * Wraps existing Moodle grade_get_grade_items_for_activity() function from
 * public/grade/querylib.php (line 250).
 *
 * Returns grade items for a course or specific activity module. Includes item
 * properties: id, courseid, categoryid, itemname, itemtype, itemmodule,
 * iteminstance, gradetype, grademin, grademax, gradepass, multfactor, plusfactor,
 * aggregationcoef, sortorder, display, decimals, hidden, locked, locktime,
 * needsupdate, weightoverride, aggregationcoef2.
 *
 * Supports filtering by course ID, course module ID, or retrieving only main items.
 *
 * @param options - Filter options for grade items
 * @returns Promise resolving to ApiResponse containing array of GradeItem
 *
 * @example
 * ```typescript
 * // Get all grade items for a course
 * const response = await getGradeItems({ courseId: 5 });
 *
 * // Get grade items for a specific activity
 * const response = await getGradeItems({ cmId: 123 });
 *
 * // Get only main grade items
 * const response = await getGradeItems({ courseId: 5, onlyMain: true });
 * ```
 */
export async function getGradeItems(
  options: GetGradeItemsOptions = {}
): Promise<ApiResult<GradeItem[]>> {
  try {
    // Build query parameters from options
    const params: Record<string, string | number | boolean> = {};
    if (options.courseId !== undefined) {
      params.courseId = options.courseId;
    }
    if (options.cmId !== undefined) {
      params.cmId = options.cmId;
    }
    if (options.onlyMain !== undefined) {
      params.onlyMain = options.onlyMain;
    }
    if (options.includeHidden !== undefined) {
      params.includeHidden = options.includeHidden;
    }
    if (options.categoryId !== undefined) {
      params.categoryId = options.categoryId;
    }
    if (options.itemType !== undefined) {
      params.itemType = options.itemType;
    }

    const response = await apiClient.get<ApiResponse<GradeItem[]>>(
      '/gradebook/items',
      { params }
    );

    return response.data;
  } catch (error) {
    return handleGradebookError(error, 'Failed to fetch grade items');
  }
}

/**
 * Update a grade item's properties
 *
 * Makes PUT request to /api/v1/gradebook/items/{itemId} with grade item update data.
 * Wraps existing Moodle grade_update() function which updates grade_items table.
 *
 * Sends fields to update: itemname, grademax, grademin, gradepass, hidden, locked,
 * aggregationcoef, display, decimals, etc. Triggers grade recalculation if grademax
 * or grademin changed.
 *
 * Permission: Validates via existing require_capability('moodle/grade:manage')
 * on the backend.
 *
 * @param itemId - The ID of the grade item to update
 * @param data - Partial grade item data to update
 * @returns Promise resolving to ApiResponse containing updated GradeItem
 *
 * @example
 * ```typescript
 * // Update grade item properties
 * const response = await updateGradeItem(123, {
 *   itemname: 'Updated Assignment Name',
 *   grademax: 100,
 *   gradepass: 60
 * });
 * ```
 */
export async function updateGradeItem(
  itemId: number,
  data: UpdateGradeItemInput
): Promise<ApiResult<GradeItem>> {
  try {
    const response = await apiClient.put<ApiResponse<GradeItem>>(
      `/gradebook/items/${itemId}`,
      data
    );

    return response.data;
  } catch (error) {
    return handleGradebookError(error, 'Failed to update grade item');
  }
}

/**
 * Fetch grade categories for a course
 *
 * Makes GET request to /api/v1/gradebook/categories with courseId query parameter.
 * Wraps existing Moodle get_grade_tree() function from
 * public/grade/classes/external/get_grade_tree.php.
 *
 * Returns hierarchical structure of grade categories and items for a course.
 * Includes category properties: id, fullname, aggregation, aggregationcoef,
 * aggregationcoef2, weight, weightoverride, parent, depth.
 *
 * Returns tree structure with nested categories and items showing parent-child
 * relationships.
 *
 * @param courseId - The ID of the course to fetch categories for
 * @param options - Optional configuration options
 * @param options.includeItems - Whether to include nested grade items in each category
 * @param options.includeHidden - Whether to include hidden categories
 * @returns Promise resolving to ApiResponse containing array of GradeCategory
 *
 * @example
 * ```typescript
 * // Get all grade categories for course 5
 * const response = await getGradeCategories(5);
 * if (response.success) {
 *   response.data.forEach(category => {
 *     console.log(`Category: ${category.fullname}, Depth: ${category.depth}`);
 *   });
 * }
 *
 * // Get categories with nested items
 * const response = await getGradeCategories(5, { includeItems: true });
 * ```
 */
export async function getGradeCategories(
  courseId: number,
  options?: {
    includeItems?: boolean;
    includeHidden?: boolean;
  }
): Promise<ApiResult<GradeCategory[]>> {
  try {
    const params: Record<string, number | boolean> = { courseId };

    if (options?.includeItems !== undefined) {
      params.includeItems = options.includeItems;
    }
    if (options?.includeHidden !== undefined) {
      params.includeHidden = options.includeHidden;
    }

    const response = await apiClient.get<ApiResponse<GradeCategory[]>>(
      '/gradebook/categories',
      { params }
    );

    return response.data;
  } catch (error) {
    return handleGradebookError(error, 'Failed to fetch grade categories');
  }
}

/**
 * Update an individual student grade
 *
 * Makes PUT request to /api/v1/gradebook/grades/{gradeId} with grade value and
 * optional feedback. Updates individual student grade (grade_grades table) for
 * a grade item.
 *
 * Wraps grade update logic that calls grade_update() or direct grade_grade object
 * update. Supports setting grade to null to remove/reset grade.
 *
 * Permission: Validates via existing require_capability('moodle/grade:edit')
 * on the backend.
 *
 * @param gradeId - The ID of the grade record to update
 * @param grade - New grade value (null to remove/reset)
 * @param feedback - Optional feedback text
 * @returns Promise resolving to ApiResponse containing updated Grade
 *
 * @example
 * ```typescript
 * // Update a grade with feedback
 * const response = await updateGrade(456, { finalgrade: 85.5, feedback: 'Good work!' });
 *
 * // Reset a grade to null
 * const response = await updateGrade(456, { finalgrade: null });
 *
 * // Update only feedback
 * const response = await updateGrade(456, { feedback: 'Updated feedback text' });
 *
 * // Override a grade with reason
 * const response = await updateGrade(456, {
 *   finalgrade: 95,
 *   overridden: true,
 *   overrideReason: 'Late submission policy exception'
 * });
 * ```
 */
export async function updateGrade(
  gradeId: number,
  updateData: {
    finalgrade?: number | null;
    grade?: number | null;
    feedback?: string;
    overridden?: boolean;
    overrideReason?: string;
  }
): Promise<ApiResult<Grade>> {
  try {
    // Build request data, handling both 'grade' and 'finalgrade' fields
    const requestData: Record<string, unknown> = {};

    // Support both 'finalgrade' and 'grade' field names
    if (updateData.finalgrade !== undefined) {
      requestData.finalgrade = updateData.finalgrade;
    }
    if (updateData.grade !== undefined) {
      requestData.grade = updateData.grade;
    }
    if (updateData.feedback !== undefined) {
      requestData.feedback = updateData.feedback;
    }
    if (updateData.overridden !== undefined) {
      requestData.overridden = updateData.overridden;
    }
    if (updateData.overrideReason !== undefined) {
      requestData.overrideReason = updateData.overrideReason;
    }

    const response = await apiClient.put<ApiResponse<Grade>>(
      `/gradebook/grades/${gradeId}`,
      requestData
    );

    return response.data;
  } catch (error) {
    return handleGradebookError(error, 'Failed to update grade');
  }
}

/**
 * Export gradebook data to file
 *
 * Makes GET request to /api/v1/gradebook/export with courseId, format, and options.
 * Wraps existing grade export functionality from public/grade/export/.
 *
 * Supports multiple export formats: CSV, Excel (XLSX), OpenDocument Spreadsheet (ODS),
 * plain text. Options include: includeUserData, includeFeedback, decimalPoints,
 * displayType, realOrLetterGrades.
 *
 * Returns download URL or base64 encoded file data.
 *
 * @param options - Export options object
 * @param options.courseId - The ID of the course to export grades for (required)
 * @param options.format - Export format: 'csv', 'xlsx', 'ods', or 'txt' (required)
 * @param options.userIds - Optional array of user IDs to filter by
 * @param options.itemIds - Optional array of grade item IDs to export
 * @param options.dateFrom - Optional start date for filtering grades (YYYY-MM-DD format)
 * @param options.dateTo - Optional end date for filtering grades (YYYY-MM-DD format)
 * @param options.includeUserData - Whether to include user data in export
 * @param options.includeFeedback - Whether to include feedback in export
 * @param options.decimalPoints - Number of decimal points for grades
 * @param options.displayType - Display type: 'real', 'percentage', or 'letter'
 * @param options.realOrLetterGrades - Whether to use real or letter grades
 * @returns Promise resolving to ApiResponse containing ExportResponse with URL or data
 *
 * @example
 * ```typescript
 * // Export as CSV with default options
 * const response = await exportGrades({ courseId: 5, format: 'csv' });
 * if (response.success && response.data.url) {
 *   window.open(response.data.url, '_blank');
 * }
 *
 * // Export as Excel with custom options
 * const response = await exportGrades({
 *   courseId: 5,
 *   format: 'xlsx',
 *   includeUserData: true,
 *   includeFeedback: true,
 *   decimalPoints: 2,
 *   displayType: 'percentage'
 * });
 *
 * // Export with date range filter
 * const response = await exportGrades({
 *   courseId: 5,
 *   format: 'csv',
 *   dateFrom: '2024-01-01',
 *   dateTo: '2024-12-31'
 * });
 *
 * // Export specific grade items
 * const response = await exportGrades({
 *   courseId: 5,
 *   format: 'csv',
 *   itemIds: [10, 20, 30]
 * });
 *
 * // Export grades for specific users
 * const response = await exportGrades({
 *   courseId: 5,
 *   format: 'csv',
 *   userIds: [1, 2, 3]
 * });
 * ```
 */
export async function exportGrades(options: {
  courseId: number;
  format: 'csv' | 'xlsx' | 'ods' | 'txt';
  userIds?: number[];
  itemIds?: number[];
  dateFrom?: string;
  dateTo?: string;
  includeUserData?: boolean;
  includeFeedback?: boolean;
  decimalPoints?: number;
  displayType?: 'real' | 'percentage' | 'letter';
  realOrLetterGrades?: 'real' | 'letter';
}): Promise<ApiResult<ExportResponse>> {
  try {
    const {
      courseId,
      format,
      userIds,
      itemIds,
      dateFrom,
      dateTo,
      includeUserData,
      includeFeedback,
      decimalPoints,
      displayType,
      realOrLetterGrades,
    } = options;

    // Build query parameters
    const params: Record<string, string | number | boolean> = {
      courseId,
      format,
    };

    if (userIds !== undefined && userIds.length > 0) {
      params.userIds = userIds.join(',');
    }

    if (itemIds !== undefined && itemIds.length > 0) {
      params.itemIds = itemIds.join(',');
    }

    if (dateFrom !== undefined) {
      params.dateFrom = dateFrom;
    }

    if (dateTo !== undefined) {
      params.dateTo = dateTo;
    }

    if (includeUserData !== undefined) {
      params.includeUserData = includeUserData;
    }

    if (includeFeedback !== undefined) {
      params.includeFeedback = includeFeedback;
    }

    if (decimalPoints !== undefined) {
      params.decimalPoints = decimalPoints;
    }

    if (displayType !== undefined) {
      params.displayType = displayType;
    }

    if (realOrLetterGrades !== undefined) {
      params.realOrLetterGrades = realOrLetterGrades;
    }

    const response = await apiClient.get<ApiResponse<ExportResponse>>(
      '/gradebook/export',
      { params }
    );

    return response.data;
  } catch (error) {
    return handleGradebookError(error, 'Failed to export grades');
  }
}

/**
 * Generate grade report
 *
 * Makes GET request to /api/v1/gradebook/report with courseId, userId, and reportType.
 * Wraps grade report generation from public/grade/report/user/ or public/grade/report/grader/.
 *
 * Returns formatted grade report data suitable for display in React components.
 * - For 'user' report: returns single user's grades in a course (from grade_report_user)
 * - For 'grader' report: returns all students' grades for teacher grading interface (from grade_report_grader)
 * - For 'overview' report: returns grade summary across multiple courses
 *
 * Permission: Validates based on report type (view own vs view all) on the backend.
 *
 * @param courseId - The ID of the course for the report
 * @param options - Report options object
 * @param options.courseId - Course ID to generate report for (required)
 * @param options.userId - Optional user ID for user-specific reports
 * @param options.groupId - Optional group ID to filter by group
 * @param options.reportType - Type of report: 'user', 'grader', or 'overview' (default: 'user')
 * @param options.page - Page number for pagination (1-based)
 * @param options.perPage - Number of items per page
 * @param options.includeGradeLetters - Whether to include letter grades
 * @param options.includePercentages - Whether to include percentage calculations
 * @returns Promise resolving to ApiResponse containing GradeReport data
 *
 * @example
 * ```typescript
 * // Get user report for a specific student
 * const response = await getGradeReport({ courseId: 5, userId: 42, reportType: 'user' });
 *
 * // Get grader report for all students (teacher view)
 * const response = await getGradeReport({ courseId: 5, reportType: 'grader' });
 *
 * // Get overview report with pagination
 * const response = await getGradeReport({ courseId: 5, reportType: 'overview', page: 2, perPage: 25 });
 *
 * // Get report filtered by group
 * const response = await getGradeReport({ courseId: 5, groupId: 10, reportType: 'grader' });
 * ```
 */
export async function getGradeReport(options: {
  courseId: number;
  userId?: number;
  groupId?: number;
  reportType?: 'user' | 'grader' | 'overview';
  page?: number;
  perPage?: number;
  includeGradeLetters?: boolean;
  includePercentages?: boolean;
  includeStatistics?: boolean;
}): Promise<ApiResult<GradeReport>> {
  try {
    const {
      courseId,
      userId,
      groupId,
      reportType = 'user',
      page,
      perPage,
      includeGradeLetters,
      includePercentages,
      includeStatistics,
    } = options;

    // Build query parameters
    const params: Record<string, string | number | boolean> = {
      courseId,
      reportType,
    };

    if (userId !== undefined) {
      params.userId = userId;
    }

    if (groupId !== undefined) {
      params.groupId = groupId;
    }

    if (page !== undefined) {
      params.page = page;
    }

    if (perPage !== undefined) {
      params.perPage = perPage;
    }

    if (includeGradeLetters !== undefined) {
      params.includeGradeLetters = includeGradeLetters;
    }

    if (includePercentages !== undefined) {
      params.includePercentages = includePercentages;
    }

    if (includeStatistics !== undefined) {
      params.includeStatistics = includeStatistics;
    }

    const response = await apiClient.get<ApiResponse<GradeReport>>(
      '/gradebook/report',
      { params }
    );

    return response.data;
  } catch (error) {
    return handleGradebookError(error, 'Failed to generate grade report');
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Error response structure for gradebook operations
 */
interface GradebookErrorDetails {
  /** Original error message */
  originalMessage?: string;
  /** HTTP status code */
  status?: number;
  /** API error code */
  apiCode?: string;
  /** Field-specific validation errors */
  fieldErrors?: Record<string, string>;
  /** Index signature for compatibility with Record<string, unknown> */
  [key: string]: unknown;
}

/**
 * Handle gradebook API errors
 *
 * Transforms HTTP errors into standardized ApiResponse error format with
 * user-friendly messages. Maps common HTTP error codes to appropriate messages:
 * - 400: Validation errors with field-specific details
 * - 403: Permission denied for grade viewing/editing restrictions
 * - 404: Invalid course, user, or grade item IDs
 * - 500+: Server errors with grade calculation failure messages
 *
 * @param error - The caught error object
 * @param fallbackMessage - Default message if error cannot be categorized
 * @returns ErrorResponse with success: false and error details
 */
function handleGradebookError(
  error: unknown,
  fallbackMessage: string
): ErrorResponse {
  // Type guard for axios-like error structure (original Axios error)
  const isAxiosError = (err: unknown): err is {
    response?: {
      status?: number;
      data?: {
        success?: boolean;
        error?: {
          code?: string;
          message?: string;
          details?: Record<string, unknown>;
        };
      };
    };
    message?: string;
  } => {
    return typeof err === 'object' && err !== null && 'response' in err;
  };

  // Type guard for serialized error structure (after interceptor processing)
  // The interceptor's createSerializableError creates an Error with direct properties
  const isSerializedError = (err: unknown): err is {
    status?: number;
    data?: {
      success?: boolean;
      error?: {
        code?: string;
        message?: string;
        details?: Record<string, unknown>;
      };
    };
    customError?: {
      code?: string;
      message?: string;
      status?: number;
      details?: unknown;
    };
    message?: string;
  } => {
    return typeof err === 'object' && err !== null && ('data' in err || 'customError' in err);
  };

  // If the error is already an ErrorResponse, return it
  if (
    typeof error === 'object' &&
    error !== null &&
    'success' in error &&
    (error as { success: boolean }).success === false
  ) {
    return error as ErrorResponse;
  }

  // Handle serialized errors from interceptor (prioritize this check)
  if (isSerializedError(error)) {
    // First check customError (set by interceptor for specific status codes)
    if (error.customError?.code) {
      const errorCode = Object.values(ApiErrorCode).includes(error.customError.code as ApiErrorCode)
        ? (error.customError.code as ApiErrorCode)
        : getErrorCodeFromStatus(error.customError.status);

      return {
        success: false,
        error: {
          code: errorCode,
          message: error.customError.message ? error.customError.message : getErrorMessageFromStatus(error.customError.status, fallbackMessage),
          details: error.customError.details as Record<string, unknown> | undefined,
        },
      };
    }

    // Check data.error (API error response)
    const apiError = error.data?.error;
    if (apiError?.message) {
      const errorCode = apiError.code
        ? (Object.values(ApiErrorCode).includes(apiError.code as ApiErrorCode)
            ? (apiError.code as ApiErrorCode)
            : getErrorCodeFromStatus(error.status))
        : getErrorCodeFromStatus(error.status);

      return {
        success: false,
        error: {
          code: errorCode,
          message: apiError.message,
          details: apiError.details,
        },
      };
    }

    // Fall back to status-based error
    if (error.status) {
      const message = getErrorMessageFromStatus(error.status, fallbackMessage);
      const code = getErrorCodeFromStatus(error.status);

      return {
        success: false,
        error: {
          code,
          message,
          details: { status: error.status },
        },
      };
    }
  }

  // Handle axios errors (original structure before interceptor serialization)
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const apiError = error.response?.data?.error;

    // Use API error message if available
    if (apiError?.message) {
      // Convert API error code to ApiErrorCode enum, falling back to status-based code
      const errorCode = apiError.code
        ? (Object.values(ApiErrorCode).includes(apiError.code as ApiErrorCode)
            ? (apiError.code as ApiErrorCode)
            : getErrorCodeFromStatus(status))
        : getErrorCodeFromStatus(status);

      return {
        success: false,
        error: {
          code: errorCode,
          message: apiError.message,
          details: apiError.details,
        },
      };
    }

    // Map HTTP status codes to user-friendly messages
    const message = getErrorMessageFromStatus(status, fallbackMessage);
    const code = getErrorCodeFromStatus(status);
    const details: GradebookErrorDetails = {};

    if (status) {
      details.status = status;
    }
    if (error.message) {
      details.originalMessage = error.message;
    }

    return {
      success: false,
      error: {
        code,
        message,
        details: Object.keys(details).length > 0 ? details : undefined,
      },
    };
  }

  // Handle generic errors
  const message = error instanceof Error ? error.message : fallbackMessage;

  return {
    success: false,
    error: {
      code: ApiErrorCode.SERVER_ERROR,
      message,
    },
  };
}

/**
 * Get user-friendly error message from HTTP status code
 *
 * @param status - HTTP status code
 * @param fallback - Fallback message if status not recognized
 * @returns User-friendly error message
 */
function getErrorMessageFromStatus(
  status: number | undefined,
  fallback: string
): string {
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'You must be logged in to view grades.';
    case 403:
      return 'You do not have permission to view or edit these grades.';
    case 404:
      return 'The requested grade information could not be found.';
    case 409:
      return 'Grade conflict detected. Please refresh and try again.';
    case 422:
      return 'The grade value is invalid. Please check the allowed range.';
    case 500:
      return 'A server error occurred while processing grades. Please try again later.';
    case 502:
    case 503:
    case 504:
      return 'The grade service is temporarily unavailable. Please try again later.';
    default:
      return fallback;
  }
}

/**
 * Get error code from HTTP status code
 *
 * @param status - HTTP status code
 * @returns Error code string
 */
function getErrorCodeFromStatus(status: number | undefined): ApiErrorCode {
  switch (status) {
    case 400:
      return ApiErrorCode.VALIDATION_ERROR;
    case 401:
      return ApiErrorCode.AUTHENTICATION_FAILED;
    case 403:
      return ApiErrorCode.PERMISSION_DENIED;
    case 404:
      return ApiErrorCode.NOT_FOUND;
    case 409:
      return ApiErrorCode.CONFLICT;
    case 422:
      return ApiErrorCode.VALIDATION_ERROR;
    case 500:
      return ApiErrorCode.SERVER_ERROR;
    case 502:
    case 503:
    case 504:
      return ApiErrorCode.NETWORK_ERROR;
    default:
      return ApiErrorCode.SERVER_ERROR;
  }
}

// ============================================================================
// UTILITY TYPES AND FUNCTIONS
// ============================================================================

/**
 * Type guard to check if ApiResult is a successful ApiResponse
 *
 * @param response - API result to check
 * @returns True if response is successful, false otherwise
 */
export function isSuccessResponse<T>(
  response: ApiResult<T>
): response is ApiResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if ApiResult is an ErrorResponse
 *
 * @param response - API result to check
 * @returns True if response is an error, false otherwise
 */
export function isErrorResponse<T>(
  response: ApiResult<T>
): response is ErrorResponse {
  return response.success === false;
}

/**
 * Extract data from successful response or throw error
 *
 * Utility function to unwrap successful responses and throw on errors.
 * Useful for React Query where errors should be thrown.
 *
 * @param response - API result (success or error)
 * @returns Data from successful response
 * @throws Error if response is not successful
 */
export function unwrapResponse<T>(response: ApiResult<T>): T {
  if (isSuccessResponse(response)) {
    return response.data;
  }
  throw new Error(response.error.message);
}
