/**
 * Course Filtering Types
 *
 * Type definitions for course filtering, searching, and sorting in the admin course
 * management interface. These types support comprehensive course filtering capabilities
 * including text search, category filtering, visibility filtering, date range filtering,
 * sorting, and pagination.
 *
 * @module features/admin/courses/types/filters.types
 */

/**
 * Sort order direction for course listings
 *
 * @type {('asc' | 'desc')}
 * @example
 * const order: SortOrder = 'asc'; // Ascending sort
 * const order: SortOrder = 'desc'; // Descending sort
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Available fields for sorting courses in the admin interface
 *
 * Fields correspond to course properties that administrators can sort by:
 * - fullname: Full course name
 * - shortname: Short course identifier/code
 * - idnumber: Course ID number
 * - timecreated: Course creation timestamp
 * - timemodified: Last modification timestamp
 * - startdate: Course start date
 * - enddate: Course end date
 * - visible: Course visibility status (visible/hidden)
 * - category: Category name/ID
 *
 * @type {('fullname' | 'shortname' | 'idnumber' | 'timecreated' | 'timemodified' | 'startdate' | 'enddate' | 'visible' | 'category')}
 * @example
 * const sortField: CourseSortField = 'fullname';
 * const sortField: CourseSortField = 'startdate';
 */
export type CourseSortField =
  | 'fullname'
  | 'shortname'
  | 'idnumber'
  | 'timecreated'
  | 'timemodified'
  | 'startdate'
  | 'enddate'
  | 'visible'
  | 'category';

/**
 * Comprehensive course filtering parameters for admin course management
 *
 * All fields are optional to support flexible, multi-criteria filtering.
 * Filters can be combined to narrow down course listings based on various criteria.
 *
 * @interface CourseFilters
 * @example
 * // Search for courses with text filter
 * const filters: CourseFilters = {
 *   search: 'mathematics',
 *   page: 1,
 *   perPage: 20
 * };
 *
 * @example
 * // Filter by category and visibility
 * const filters: CourseFilters = {
 *   categoryId: 5,
 *   visible: true,
 *   sortBy: 'fullname',
 *   sortOrder: 'asc'
 * };
 *
 * @example
 * // Filter by date range with pagination
 * const filters: CourseFilters = {
 *   startDateFrom: '2024-01-01',
 *   startDateTo: '2024-12-31',
 *   sortBy: 'startdate',
 *   sortOrder: 'desc',
 *   page: 1,
 *   perPage: 50
 * };
 */
export interface CourseFilters {
  /**
   * Text search query for course names, short names, or descriptions
   * Searches across multiple course fields to find matching courses
   *
   * @type {string}
   * @optional
   * @example 'Introduction to Computer Science'
   * @example 'CS101'
   */
  search?: string;

  /**
   * Filter courses by category ID
   * Limits results to courses within a specific course category
   *
   * @type {number}
   * @optional
   * @example 5 // Category ID
   */
  categoryId?: number;

  /**
   * Filter courses by visibility status
   * - true: Show only visible courses
   * - false: Show only hidden courses
   * - undefined: Show all courses regardless of visibility
   *
   * @type {boolean}
   * @optional
   * @example true // Only visible courses
   * @example false // Only hidden courses
   */
  visible?: boolean;

  /**
   * Filter courses by minimum start date (inclusive)
   * Courses with start date on or after this date will be included
   *
   * @type {string}
   * @optional
   * @format ISO 8601 date string (YYYY-MM-DD) or date-time string
   * @example '2024-01-01'
   * @example '2024-01-01T00:00:00Z'
   */
  startDateFrom?: string;

  /**
   * Filter courses by maximum start date (inclusive)
   * Courses with start date on or before this date will be included
   *
   * @type {string}
   * @optional
   * @format ISO 8601 date string (YYYY-MM-DD) or date-time string
   * @example '2024-12-31'
   * @example '2024-12-31T23:59:59Z'
   */
  startDateTo?: string;

  /**
   * Filter courses by minimum end date (inclusive)
   * Courses with end date on or after this date will be included
   *
   * @type {string}
   * @optional
   * @format ISO 8601 date string (YYYY-MM-DD) or date-time string
   * @example '2024-06-01'
   * @example '2024-06-01T00:00:00Z'
   */
  endDateFrom?: string;

  /**
   * Filter courses by maximum end date (inclusive)
   * Courses with end date on or before this date will be included
   *
   * @type {string}
   * @optional
   * @format ISO 8601 date string (YYYY-MM-DD) or date-time string
   * @example '2024-12-31'
   * @example '2024-12-31T23:59:59Z'
   */
  endDateTo?: string;

  /**
   * Field to sort courses by
   * Determines which course property is used for ordering results
   *
   * @type {CourseSortField}
   * @optional
   * @default 'fullname' (typically)
   * @example 'fullname'
   * @example 'startdate'
   * @example 'timemodified'
   */
  sortBy?: CourseSortField;

  /**
   * Sort direction (ascending or descending)
   * Determines whether results are sorted in ascending or descending order
   *
   * @type {SortOrder}
   * @optional
   * @default 'asc' (typically)
   * @example 'asc' // A-Z, oldest to newest
   * @example 'desc' // Z-A, newest to oldest
   */
  sortOrder?: SortOrder;

  /**
   * Current page number for pagination (1-indexed)
   * Determines which page of results to retrieve
   *
   * @type {number}
   * @optional
   * @default 1
   * @minimum 1
   * @example 1 // First page
   * @example 5 // Fifth page
   */
  page?: number;

  /**
   * Number of courses to display per page
   * Determines the page size for paginated results
   *
   * @type {number}
   * @optional
   * @default 20 (typical default)
   * @minimum 1
   * @maximum 100 (typical maximum)
   * @example 20 // 20 courses per page
   * @example 50 // 50 courses per page
   */
  perPage?: number;
}
