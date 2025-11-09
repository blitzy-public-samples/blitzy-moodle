/**
 * Redux State Type Definitions for Admin Course Management
 *
 * This file defines comprehensive TypeScript interfaces for managing the global Redux state
 * of the admin course management feature. These types support complex UI interactions including
 * course listings, category trees, multi-criteria filtering, bulk selection, and async operations
 * with separate loading states and error tracking.
 *
 * The state structure is optimized for Redux Toolkit slices with normalized data patterns,
 * efficient updates, and proper separation of concerns between server data, UI state, and
 * transient operation state.
 *
 * @module features/admin/courses/types/state.types
 * @see react-frontend/src/features/admin/courses/store/courseManagementSlice.ts - Redux slice implementation
 * @see public/admin/course/index.php - PHP source reference for admin course management
 */

import type { Course } from './course.types';
import type { CourseCategory } from './category.types';
import type { CourseFilters } from './filters.types';

/**
 * View mode options for course listing display
 *
 * Determines how courses are visually presented in the admin interface:
 * - 'list': Traditional list view with detailed information per row
 * - 'grid': Card-based grid layout for visual browsing
 * - 'compact': Condensed list view showing minimal information
 *
 * @type ViewMode
 * @example
 * const currentView: ViewMode = 'list';
 * const currentView: ViewMode = 'grid';
 */
export type ViewMode = 'list' | 'grid' | 'compact';

/**
 * Pagination metadata for course listings
 *
 * Tracks pagination state for course queries, including total count, current page,
 * and items per page. Used by both the UI for rendering pagination controls and
 * by the API layer for constructing paginated requests.
 *
 * @interface PaginationMetadata
 * @example
 * const pagination: PaginationMetadata = {
 *   total: 150,
 *   page: 3,
 *   perPage: 20
 * };
 */
export interface PaginationMetadata {
  /**
   * Total number of courses matching current filters
   * Used to calculate total pages and display result counts
   * @type {number}
   */
  total: number;

  /**
   * Current page number (1-indexed)
   * First page is 1, not 0
   * @type {number}
   */
  page: number;

  /**
   * Number of items per page
   * Typical values: 10, 20, 50, 100
   * @type {number}
   */
  perPage: number;
}

/**
 * Error tracking structure for different operation types
 *
 * Maintains separate error messages for different async operations to enable
 * granular error handling and user feedback. Each field is optional to allow
 * partial error state (e.g., courses loaded successfully but categories failed).
 *
 * @interface CourseManagementError
 * @example
 * // Error loading courses only
 * const error: CourseManagementError = {
 *   courses: 'Failed to load courses: Network error',
 *   categories: null,
 *   action: null
 * };
 *
 * @example
 * // Error during bulk action
 * const error: CourseManagementError = {
 *   courses: null,
 *   categories: null,
 *   action: 'Failed to delete selected courses: Permission denied'
 * };
 */
export interface CourseManagementError {
  /**
   * Error message from course loading operations
   * Set when fetching or refreshing course list fails
   * Null when no course loading error exists
   * @type {string | null}
   */
  courses: string | null;

  /**
   * Error message from category loading operations
   * Set when fetching or refreshing category tree fails
   * Null when no category loading error exists
   * @type {string | null}
   */
  categories: string | null;

  /**
   * Error message from action operations (create, update, delete, bulk actions)
   * Set when any state-changing operation fails
   * Null when no action error exists
   * @type {string | null}
   */
  action: string | null;
}

/**
 * Complete Redux state for admin course management feature
 *
 * This interface represents the entire Redux state slice for the admin course management
 * feature. It combines:
 * - Server data (courses, categories)
 * - Active filters and search criteria
 * - UI state (view mode, expanded categories, selected items)
 * - Async operation state (multiple loading flags)
 * - Error tracking (granular error messages)
 * - Pagination metadata
 *
 * The state structure follows Redux best practices:
 * - Normalized data where appropriate (flat arrays, not nested objects)
 * - Separation of server state and UI state
 * - Explicit loading and error states for each async operation
 * - Immutable update patterns supported (compatible with Immer in Redux Toolkit)
 *
 * @interface CourseManagementState
 * @example
 * // Initial state
 * const initialState: CourseManagementState = {
 *   courses: [],
 *   categories: [],
 *   filters: {
 *     search: '',
 *     page: 1,
 *     perPage: 20
 *   },
 *   selectedCourseIds: [],
 *   coursesLoading: false,
 *   categoriesLoading: false,
 *   actionLoading: false,
 *   error: {
 *     courses: null,
 *     categories: null,
 *     action: null
 *   },
 *   pagination: {
 *     total: 0,
 *     page: 1,
 *     perPage: 20
 *   },
 *   viewMode: 'list',
 *   expandedCategories: []
 * };
 *
 * @example
 * // State with loaded data and active filters
 * const loadedState: CourseManagementState = {
 *   courses: [
 *     { id: 1, fullname: 'Introduction to Computer Science', ... },
 *     { id: 2, fullname: 'Advanced Mathematics', ... }
 *   ],
 *   categories: [
 *     { id: 1, name: 'Science', parent: 0, ... },
 *     { id: 2, name: 'Computer Science', parent: 1, ... }
 *   ],
 *   filters: {
 *     search: 'computer',
 *     categoryId: 2,
 *     visible: true,
 *     sortBy: 'fullname',
 *     sortOrder: 'asc',
 *     page: 1,
 *     perPage: 20
 *   },
 *   selectedCourseIds: [1, 5, 7],
 *   coursesLoading: false,
 *   categoriesLoading: false,
 *   actionLoading: false,
 *   error: {
 *     courses: null,
 *     categories: null,
 *     action: null
 *   },
 *   pagination: {
 *     total: 42,
 *     page: 1,
 *     perPage: 20
 *   },
 *   viewMode: 'grid',
 *   expandedCategories: [1, 2]
 * };
 */
export interface CourseManagementState {
  /**
   * Array of courses currently loaded in the admin interface
   *
   * Contains the full Course entity objects for all courses matching the current
   * filters and pagination. Updated when filters change or data is refreshed.
   * Empty array when no courses match filters or when not yet loaded.
   *
   * @type {Course[]}
   */
  courses: Course[];

  /**
   * Array of course categories for the hierarchical category tree
   *
   * Contains all course categories available in the system, used to build the
   * category tree navigation and category filter dropdown. Includes parent references
   * and depth information for rendering tree structure.
   * Empty array when categories not yet loaded.
   *
   * @type {CourseCategory[]}
   */
  categories: CourseCategory[];

  /**
   * Active filter criteria applied to course listings
   *
   * Contains all current filter, sort, search, and pagination parameters.
   * Changes to this object trigger new course list queries.
   * Includes search query, category filter, visibility filter, date ranges,
   * sorting parameters, and pagination settings.
   *
   * @type {CourseFilters}
   */
  filters: CourseFilters;

  /**
   * Set of course IDs currently selected for bulk operations
   *
   * Tracks which courses are selected via checkboxes in the course list.
   * Used for bulk actions like delete, hide/show, move to category, etc.
   * Array of course IDs for easy serialization and Redux compatibility.
   * Empty array when no courses selected.
   *
   * @type {number[]}
   * @example [1, 5, 7, 12, 15]
   */
  selectedCourseIds: number[];

  /**
   * Loading state for course list fetch operations
   *
   * True when actively fetching courses from the API (initial load or refresh).
   * Used to display loading spinners and disable UI interactions during fetch.
   * False when courses loaded successfully or fetch failed.
   *
   * @type {boolean}
   */
  coursesLoading: boolean;

  /**
   * Loading state for category list fetch operations
   *
   * True when actively fetching categories from the API (initial load or refresh).
   * Separate from coursesLoading to allow independent loading indicators.
   * False when categories loaded successfully or fetch failed.
   *
   * @type {boolean}
   */
  categoriesLoading: boolean;

  /**
   * Loading state for state-changing action operations
   *
   * True when actively performing create, update, delete, or bulk operations.
   * Used to display loading indicators on action buttons and prevent double-submission.
   * False when action completes successfully or fails.
   * Separate from fetch loading states for granular UI control.
   *
   * @type {boolean}
   */
  actionLoading: boolean;

  /**
   * Error messages for different operation types
   *
   * Tracks errors separately for courses fetch, categories fetch, and actions.
   * Enables specific error messaging and recovery options based on failure type.
   * All fields null when no errors exist.
   *
   * @type {CourseManagementError}
   */
  error: CourseManagementError;

  /**
   * Pagination metadata for current course query
   *
   * Contains total result count, current page number, and items per page.
   * Updated whenever course list is fetched with new pagination parameters.
   * Used to render pagination controls and result count displays.
   *
   * @type {PaginationMetadata}
   */
  pagination: PaginationMetadata;

  /**
   * Current view mode for course display
   *
   * Controls visual presentation of course list (list, grid, or compact).
   * User preference persisted in local storage or user preferences.
   * Default is 'list' for detailed information display.
   *
   * @type {ViewMode}
   */
  viewMode: ViewMode;

  /**
   * Set of category IDs with expanded children in category tree
   *
   * Tracks which category nodes are expanded in the category tree navigation.
   * Used to maintain tree expansion state across renders and page navigation.
   * Array of category IDs for easy serialization and Redux compatibility.
   * Empty array when all categories collapsed.
   *
   * @type {number[]}
   * @example [1, 5, 12] // Categories 1, 5, and 12 are expanded
   */
  expandedCategories: number[];
}
