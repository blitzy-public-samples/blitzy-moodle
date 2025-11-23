/**
 * Comprehensive TypeScript type definitions for the gradebook domain.
 *
 * This file provides complete type safety for all gradebook-related entities,
 * API responses, and UI data structures. Types are derived from Moodle's core
 * grade database schema and external API structures.
 *
 * @module features/gradebook/types
 */

import type { ReactNode } from 'react';

// ============================================================================
// ENUMS - Grade Constants
// ============================================================================

/**
 * Grade type enumeration.
 * Defines the different types of grades that can be assigned.
 * Based on GRADE_TYPE_* constants from public/lib/grade/constants.php
 */
export enum GradeType {
  /** No grade (ungraded item) */
  NONE = 0,
  /** Numeric value grade */
  VALUE = 1,
  /** Scale-based grade (e.g., competency scales) */
  SCALE = 2,
  /** Text feedback only (no numeric grade) */
  TEXT = 3,
}

/**
 * Grade aggregation type enumeration.
 * Defines how grades within a category are combined to produce a final grade.
 * Based on GRADE_AGGREGATE_* constants from public/lib/grade/constants.php
 */
export enum AggregationType {
  /** Simple arithmetic mean of all grades */
  MEAN = 0,
  /** Median value of all grades */
  MEDIAN = 2,
  /** Minimum grade value */
  MIN = 4,
  /** Maximum grade value */
  MAX = 6,
  /** Most frequently occurring grade (mode) */
  MODE = 8,
  /** Weighted mean with manually set weights */
  WEIGHTED_MEAN = 10,
  /** Simple weighted mean */
  WEIGHTED_MEAN2 = 11,
  /** Mean with extra credit support */
  EXTRACREDIT_MEAN = 12,
  /** Natural aggregation (sum of grades) */
  SUM = 13,
}

/**
 * Grade display type enumeration.
 * Defines how grades are displayed to users.
 * Based on GRADE_DISPLAY_TYPE_* constants from public/lib/grade/constants.php
 */
export enum DisplayType {
  /** Use default display type from higher level (item/course/site) */
  DEFAULT = 0,
  /** Display as decimal number (e.g., 85.50) */
  REAL = 1,
  /** Display as percentage (e.g., 85.5%) */
  PERCENTAGE = 2,
  /** Display as letter grade (e.g., A, B, C) */
  LETTER = 3,
  /** Display as decimal and percentage (e.g., 85.50 (85.5%)) */
  REAL_PERCENTAGE = 12,
  /** Display as decimal and letter (e.g., 85.50 (A)) */
  REAL_LETTER = 13,
  /** Display as percentage and decimal (e.g., 85.5% (85.50)) */
  PERCENTAGE_REAL = 21,
  /** Display as percentage and letter (e.g., 85.5% (A)) */
  PERCENTAGE_LETTER = 23,
  /** Display as letter and decimal (e.g., A (85.50)) */
  LETTER_REAL = 31,
  /** Display as letter and percentage (e.g., A (85.5%)) */
  LETTER_PERCENTAGE = 32,
}

/**
 * Aggregation status enumeration.
 * Indicates how a grade was used in category aggregation calculations.
 * Based on aggregationstatus field from grade_grades table and grade_grade.php
 */
export enum AggregationStatus {
  /** Status not yet determined */
  UNKNOWN = 'unknown',
  /** Grade was dropped (e.g., lowest N grades dropped) */
  DROPPED = 'dropped',
  /** No value present (not graded yet) */
  NOVALUE = 'novalue',
  /** Grade was used in aggregation calculation */
  USED = 'used',
  /** Grade is extra credit */
  EXTRA = 'extra',
  /** Grade was excluded from aggregation */
  EXCLUDED = 'excluded',
}

// ============================================================================
// CORE GRADE ENTITIES
// ============================================================================

/**
 * Individual grade record for a user.
 * Represents a single grade entry in the grade_grades table.
 * Based on schema from public/lib/db/install.xml (line 2041-2120)
 */
export interface Grade {
  /** Unique identifier for this grade record */
  id: number;
  /** ID of the grade item this grade belongs to */
  itemid: number;
  /** ID of the user who received this grade */
  userid: number;
  /** Raw grade value before any adjustments */
  rawgrade: number | null;
  /** Maximum possible raw grade */
  rawgrademax: number;
  /** Minimum possible raw grade */
  rawgrademin: number;
  /** ID of scale if grade uses a scale */
  rawscaleid: number | null;
  /** ID of user who last modified this grade */
  usermodified: number | null;
  /** Final calculated grade after all adjustments */
  finalgrade: number | null;
  /** Hidden status: 0=visible, 1=hidden, >1=hidden until timestamp */
  hidden: number;
  /** Locked status: 0=unlocked, 1=locked, >1=locked until timestamp */
  locked: number;
  /** Timestamp when this grade should be automatically locked */
  locktime: number;
  /** Timestamp when this grade was exported */
  exported: number;
  /** Whether this grade has been manually overridden */
  overridden: number;
  /** Whether this grade is excluded from aggregations */
  excluded: number;
  /** Textual feedback for this grade */
  feedback: string | null;
  /** Format of feedback text (0=moodle, 1=html, 2=plain, 4=markdown) */
  feedbackformat: number;
  /** Additional information about this grade */
  information: string | null;
  /** Format of information text */
  informationformat: number;
  /** Timestamp when this grade was first created */
  timecreated: number;
  /** Timestamp when this grade was last modified */
  timemodified: number;
  /** How this grade was used in aggregation (unknown/dropped/novalue/used/extra/excluded) */
  aggregationstatus: AggregationStatus;
  /** Specific weight used in aggregation calculation for this grade */
  aggregationweight: number | null;
  /** Marks deducted from this grade (e.g., for late submission) */
  deductedmark: number | null;
}

/**
 * Grade item (column) definition.
 * Represents a gradeable column in the gradebook from grade_items table.
 * Based on schema from public/lib/db/install.xml (line 1992-2040)
 */
export interface GradeItem {
  /** Unique identifier for this grade item */
  id: number;
  /** ID of course this item belongs to */
  courseid: number;
  /** ID of category this item belongs to (optional) */
  categoryid: number | null;
  /** Display name of this grade item */
  itemname: string | null;
  /** Type of item: 'mod', 'manual', 'course', 'category' */
  itemtype: string;
  /** Module name if item is from a module (e.g., 'assign', 'quiz') */
  itemmodule: string | null;
  /** ID of module instance if item is from a module */
  iteminstance: number | null;
  /** Item number to distinguish multiple grades for one activity */
  itemnumber: number | null;
  /** Additional information and notes about this item */
  iteminfo: string | null;
  /** Arbitrary ID number for external reference */
  idnumber: string | null;
  /** Formula for calculated grades (e.g., =[[gi20]]+[[gi30]]) */
  calculation: string | null;
  /** Type of grade (0=none, 1=value, 2=scale, 3=text) */
  gradetype: GradeType;
  /** Maximum grade value */
  grademax: number;
  /** Minimum grade value */
  grademin: number;
  /** ID of scale if this item uses a scale */
  scaleid: number | null;
  /** ID of outcome if this item is tied to a learning outcome */
  outcomeid: number | null;
  /** Grade value required to pass */
  gradepass: number;
  /** Multiplication factor for grade adjustments */
  multfactor: number;
  /** Addition factor for grade adjustments */
  plusfactor: number;
  /** Aggregation coefficient for category weights */
  aggregationcoef: number;
  /** Secondary aggregation coefficient for extra credit and weight */
  aggregationcoef2: number;
  /** Sort order for display */
  sortorder: number;
  /** Display type (0=default, 1=real, 2=percentage, 3=letter, etc.) */
  display: DisplayType;
  /** Number of decimal places to display */
  decimals: number | null;
  /** Hidden status: 0=visible, 1=hidden, >1=hidden until timestamp */
  hidden: number;
  /** Locked status: 0=unlocked, 1=locked, >1=locked until timestamp */
  locked: number;
  /** Timestamp to automatically lock final grades */
  locktime: number;
  /** Flag indicating if this column needs recalculation */
  needsupdate: number;
  /** Whether weight is manually overridden */
  weightoverride: number;
  /** Timestamp when this item was created */
  timecreated: number;
  /** Timestamp when this item was last modified */
  timemodified: number;
}

/**
 * Grade category definition.
 * Represents a hierarchical grouping of grade items from grade_categories table.
 * Based on schema from public/lib/db/install.xml (line 1969-1991)
 */
export interface GradeCategory {
  /** Unique identifier for this category */
  id: number;
  /** ID of course this category belongs to */
  courseid: number;
  /** ID of parent category (null for root category) */
  parent: number | null;
  /** Depth in category hierarchy (0 for root) */
  depth: number;
  /** Full path to this category (e.g., /1/2/3) */
  path: string | null;
  /** Display name of this category */
  fullname: string;
  /** Aggregation strategy for combining grades in this category */
  aggregation: AggregationType;
  /** Keep only the X highest grades */
  keephigh: number;
  /** Drop the X lowest grades */
  droplow: number;
  /** Only aggregate graded items (ignore empty grades) */
  aggregateonlygraded: number;
  /** Include outcomes in aggregation */
  aggregateoutcomes: number;
  /** Timestamp when this category was created */
  timecreated: number;
  /** Timestamp when this category was last modified */
  timemodified: number;
  /** Hidden status: 0=visible, 1=hidden, >1=hidden until timestamp */
  hidden: number;
}

/**
 * Grade modification history record.
 * Represents a single change to a grade value.
 */
export interface GradeHistoryRecord {
  /** ISO 8601 timestamp or formatted date string */
  date: string;
  /** Grade value at this point in history */
  grade: number | string;
  /** User who modified the grade */
  modifiedBy: string;
  /** Type of modification (e.g., 'Graded', 'Updated', 'Override') */
  action: string;
}

/**
 * Grade summary for display.
 * Combines grade data with item information for UI rendering.
 * Used in grade tables and reports.
 */
export interface GradeSummary {
  /** Unique identifier for this grade */
  id: number;
  /** Name of the grade item */
  itemname: string;
  /** Category this item belongs to */
  category: string | null;
  /** User's grade value */
  grade: number | null;
  /** Letter grade representation (e.g., A, B+, C) */
  lettergrade: string | null;
  /** Percentage value of grade */
  percentage: number | null;
  /** Grade range (e.g., "0-100") */
  range: string;
  /** Maximum grade value */
  grademax: number;
  /** Minimum grade value */
  grademin: number;
  /** Feedback text for this grade */
  feedback: string | null;
  /** Unix timestamp (milliseconds) when grade was last modified */
  timemodified?: number;
  /** Weight of this item in course total */
  weight: number | null;
  /** Contribution to course total percentage */
  contributiontocoursetotal: number | null;
  /** User's rank/position for this item (if rankings enabled) */
  rank: number | null;
  /** Average grade for all users on this item */
  average: number | null;
  /** Array of parent category names */
  parentcategories: string[];
  /** Whether this grade is hidden */
  hidden: boolean;
  /** Whether this grade is locked */
  locked: boolean;
  /** Whether this grade is overridden */
  overridden: boolean;
  /** Whether this grade is excluded from aggregation */
  excluded: boolean;
  /** Aggregation status of this grade */
  aggregationstatus: AggregationStatus;
  /** History of modifications to this grade */
  modificationHistory?: GradeHistoryRecord[];
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Standard API success response wrapper.
 * All successful API responses follow this structure.
 */
export interface ApiSuccessResponse<T> {
  /** Success status flag */
  success: true;
  /** Response payload data */
  data: T;
  /** Optional metadata (pagination, etc.) */
  meta?: {
    pagination?: PaginationMeta;
    [key: string]: unknown;
  };
}

/**
 * Standard API error response wrapper.
 * All error API responses follow this structure.
 */
export interface ApiErrorResponse {
  /** Success status flag (always false for errors) */
  success: false;
  /** Error details */
  error: {
    /** Error code identifier */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Additional error details */
    details?: Record<string, unknown>;
  };
}

/**
 * Union type for all API responses.
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Response from GET /api/v1/gradebook/course/{id} endpoint.
 * Returns grade table data for a course.
 * Based on get_grades_table from public/grade/report/user/classes/external/user.php
 */
export interface GradeTableResponse {
  /** Array of grade items (columns) */
  items: GradeItem[];
  /** Array of grade records for the user */
  grades: Grade[];
  /** Summary data combining items and grades */
  summary: GradeSummary[];
  /** Course-level aggregation */
  coursetotal: {
    /** Final course grade */
    grade: number | null;
    /** Letter representation */
    lettergrade: string | null;
    /** Percentage representation */
    percentage: number | null;
    /** Grade range */
    range: string;
  };
  /** Available display options */
  displayoptions: {
    /** Available display types */
    types: DisplayType[];
    /** Current display type */
    current: DisplayType;
  };
}

/**
 * Response from GET /api/v1/gradebook/items endpoint.
 * Returns list of grade items for a course.
 * Based on get_gradeitems from public/grade/classes/external/get_gradeitems.php
 */
export interface GradeItemsResponse {
  /** Array of grade items */
  items: GradeItem[];
  /** Total count of items */
  total: number;
}

/**
 * Response from GET /api/v1/gradebook/course/{id}/tree endpoint.
 * Returns hierarchical grade tree structure.
 * Based on get_grade_tree from public/grade/classes/external/get_grade_tree.php
 */
export interface GradeTreeResponse {
  /** Root category */
  root: GradeCategoryNode;
}

/**
 * Node in the grade tree structure.
 * Represents either a category or an item in the hierarchy.
 */
export interface GradeCategoryNode {
  /** Category information */
  category: GradeCategory;
  /** Child items in this category */
  items: GradeItem[];
  /** Child categories (subcategories) */
  children: GradeCategoryNode[];
  /** Aggregated grade for this category */
  aggregatedgrade: number | null;
}

/**
 * Response from GET /api/v1/gradebook/user/{userid} endpoint.
 * Returns grades for a specific user across all courses.
 */
export interface UserGradesResponse {
  /** User ID */
  userid: number;
  /** Array of course grades */
  courses: CourseGradeInfo[];
}

/**
 * Grade information for a single course.
 */
export interface CourseGradeInfo {
  /** Course ID */
  courseid: number;
  /** Course full name */
  coursename: string;
  /** Final course grade */
  finalgrade: number | null;
  /** Letter grade */
  lettergrade: string | null;
  /** Percentage */
  percentage: number | null;
  /** Grade range */
  range: string;
  /** Last modified timestamp */
  timemodified: number;
}

// ============================================================================
// UI HELPER TYPES
// ============================================================================

/**
 * Column definition for grade table display.
 * Used by data grid components (e.g., MUI DataGrid).
 */
export interface GradeTableColumn {
  /** Unique column identifier */
  id: string;
  /** Column header label */
  label: string;
  /** Field name in data object */
  field: string;
  /** Column width in pixels */
  width: number;
  /** Whether column is sortable */
  sortable: boolean;
  /** Alignment of column content */
  align: 'left' | 'center' | 'right';
  /** Data type for proper formatting */
  type: 'string' | 'number' | 'date' | 'boolean';
  /** Custom render function for cell content */
  renderCell?: (value: unknown, row: GradeTableRow) => ReactNode;
}

/**
 * Row data for grade table display.
 * Represents a single row in the gradebook table.
 */
export interface GradeTableRow {
  /** Unique row identifier */
  id: string;
  /** Item name */
  itemname: string;
  /** Grade value */
  grade: number | null;
  /** Letter grade */
  lettergrade: string | null;
  /** Percentage */
  percentage: number | null;
  /** Feedback text */
  feedback: string | null;
  /** Category name */
  category: string | null;
  /** Hidden flag */
  hidden: boolean;
  /** Locked flag */
  locked: boolean;
  /** Additional properties for specific columns */
  [key: string]: unknown;
}

/**
 * Filter options for gradebook views.
 * Used for filtering and searching grade data.
 */
export interface GradebookFilters {
  /** Filter by course ID */
  courseid?: number;
  /** Filter by user ID */
  userid?: number;
  /** Filter by category ID */
  categoryid?: number;
  /** Filter by grade item type */
  itemtype?: string;
  /** Filter by module name */
  itemmodule?: string;
  /** Include hidden items */
  includehidden?: boolean;
  /** Search query for item names */
  search?: string;
  /** Date range filter (start) */
  dateFrom?: number;
  /** Date range filter (end) */
  dateTo?: number;
}

/**
 * Sorting options for grade lists.
 */
export interface GradeSortOptions {
  /** Field to sort by */
  field: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Pagination metadata.
 */
export interface PaginationMeta {
  /** Current page number (1-indexed) */
  page: number;
  /** Items per page */
  perPage: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNext: boolean;
  /** Whether there is a previous page */
  hasPrevious: boolean;
}

/**
 * Pagination parameters for API requests.
 */
export interface PaginationParams {
  /** Page number to fetch (1-indexed) */
  page: number;
  /** Number of items per page */
  perPage: number;
}

/**
 * Complete request parameters for fetching grades.
 */
export interface GradeQueryParams extends PaginationParams {
  /** Filters to apply */
  filters?: GradebookFilters;
  /** Sorting options */
  sort?: GradeSortOptions;
}

// ============================================================================
// FORM AND MUTATION TYPES
// ============================================================================

/**
 * Input data for updating a grade.
 */
export interface GradeUpdateInput {
  /** Grade item ID */
  itemid: number;
  /** User ID */
  userid: number;
  /** New grade value */
  grade: number | null;
  /** Feedback text */
  feedback?: string;
  /** Whether to override existing grade */
  override?: boolean;
}

/**
 * Input data for creating/updating a grade item.
 */
export interface GradeItemInput {
  /** Course ID */
  courseid: number;
  /** Item name */
  itemname: string;
  /** Grade type */
  gradetype: GradeType;
  /** Maximum grade */
  grademax: number;
  /** Minimum grade */
  grademin: number;
  /** Category ID */
  categoryid?: number;
  /** ID number for external reference */
  idnumber?: string;
  /** Grade to pass */
  gradepass?: number;
  /** Display type */
  display?: DisplayType;
}

/**
 * Input data for creating/updating a grade category.
 */
export interface GradeCategoryInput {
  /** Course ID */
  courseid: number;
  /** Category name */
  fullname: string;
  /** Aggregation type */
  aggregation: AggregationType;
  /** Parent category ID */
  parent?: number;
  /** Keep high count */
  keephigh?: number;
  /** Drop low count */
  droplow?: number;
  /** Aggregate only graded flag */
  aggregateonlygraded?: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Type guard to check if a response is an error.
 */
export function isApiError(response: ApiResponse<unknown>): response is ApiErrorResponse {
  return response.success === false;
}

/**
 * Type guard to check if a response is successful.
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Extract data type from ApiResponse.
 */
export type ExtractData<T> = T extends ApiSuccessResponse<infer U> ? U : never;

/**
 * Partial grade for optimistic updates.
 * Allows updating subset of grade properties.
 */
export type PartialGrade = Partial<Grade> & Pick<Grade, 'id'>;

/**
 * Partial grade item for updates.
 */
export type PartialGradeItem = Partial<GradeItem> & Pick<GradeItem, 'id'>;

/**
 * Partial grade category for updates.
 */
export type PartialGradeCategory = Partial<GradeCategory> & Pick<GradeCategory, 'id'>;
