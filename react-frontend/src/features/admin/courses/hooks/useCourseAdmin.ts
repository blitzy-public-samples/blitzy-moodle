/**
 * Admin Course Management Hook
 *
 * Custom React hook for admin course management that provides comprehensive state
 * management, API interactions, and business logic for course listing, filtering,
 * selection, bulk operations, and category management.
 *
 * Features:
 * - Paginated course listing with server-side filtering
 * - Category fetching for dropdown filters
 * - Multi-select course selection for bulk operations
 * - Debounced search to reduce API calls
 * - Bulk actions (delete, hide, show, backup, reset, move)
 * - Integration with Material-UI DataGrid selection model
 * - React 18 concurrent rendering patterns with automatic batching
 *
 * @module features/admin/courses/hooks/useCourseAdmin
 */

import { useState, useCallback, useMemo } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import type { GridRowSelectionModel } from '@mui/x-data-grid';

// Internal imports from dependencies
import type { Course, CourseCategory } from '@/types/entities';
import type { ApiResponse } from '@/types/api';
import useDebounce from '@/hooks/useDebounce';
import apiClient from '@/services/api/client';
import { ADMIN_ENDPOINTS } from '@/services/api/endpoints';
import type { CourseFilters } from '../types/filters.types';
import {
  BulkActionType,
  type BulkCourseAction,
  type BulkActionResult,
  type BulkActionParameters,
} from '../types/bulk.types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * View mode for course administration interface
 * Determines the display format of the course management page
 */
export type CourseAdminViewMode = 'default' | 'combined' | 'courses' | 'categories';

/**
 * Selection state type for tracking all/some/none selections
 */
export type SelectionState = 'all' | 'some' | 'none';

/**
 * API response type for paginated course list
 */
interface PaginatedCoursesResponse {
  courses: Course[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/**
 * API response type for category list
 */
interface CategoriesResponse {
  categories: CourseCategory[];
}

/**
 * Bulk action request payload
 */
interface BulkActionPayload {
  action: BulkActionType;
  courseIds: number[];
  parameters?: BulkActionParameters;
}

/**
 * Return type of the useCourseAdmin hook
 * Contains all state, computed values, and handler functions
 */
export interface UseCourseAdminReturn {
  /** Array of courses for the current page */
  courses: Course[];
  /** Array of available course categories */
  categories: CourseCategory[];
  /** Whether courses are currently loading */
  isLoading: boolean;
  /** Whether categories are currently loading */
  isCategoriesLoading: boolean;
  /** Error object if course fetch failed */
  error: Error | null;
  /** Set of selected course IDs */
  selectedCourseIds: Set<number>;
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Number of items per page */
  itemsPerPage: number;
  /** Current search query string */
  searchQuery: string;
  /** Active filter settings */
  filters: CourseFilters;
  /** Current view mode */
  viewMode: CourseAdminViewMode;
  /** Selection state indicator */
  selectionState: SelectionState;
  /** Total number of courses matching current filters */
  totalCourses: number;
  /** Whether bulk operation is in progress */
  isBulkActionLoading: boolean;
  /** Handler to toggle selection of a single course */
  handleSelectCourse: (courseId: number) => void;
  /** Handler to select or deselect all courses on current page */
  handleSelectAll: () => void;
  /** Handler to update search query */
  handleSearch: (query: string) => void;
  /** Handler to update a specific filter */
  handleFilterChange: <K extends keyof CourseFilters>(
    filterType: K,
    value: CourseFilters[K]
  ) => void;
  /** Handler to execute a bulk action on selected courses */
  handleBulkAction: (
    action: BulkActionType,
    parameters?: BulkActionParameters
  ) => Promise<BulkActionResult>;
  /** Handler to navigate to a different page */
  handlePageChange: (page: number) => void;
  /** Handler to change items per page */
  handlePerPageChange: (perPage: number) => void;
  /** Handler to change view mode */
  handleViewModeChange: (mode: CourseAdminViewMode) => void;
  /** Handler to clear all selections */
  handleClearSelection: () => void;
  /** Handler to set selection model (for DataGrid integration) */
  handleSelectionModelChange: (selectionModel: GridRowSelectionModel) => void;
  /** Function to refetch courses data */
  refetch: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

/** Default number of items per page */
const DEFAULT_PER_PAGE = 20;

/** Debounce delay for search input (milliseconds) */
const SEARCH_DEBOUNCE_DELAY = 500;

/** Query key for courses list */
const COURSES_QUERY_KEY = 'admin-courses';

/** Query key for categories list */
const CATEGORIES_QUERY_KEY = 'admin-course-categories';

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetches paginated list of courses with filters from the admin API
 *
 * @param filters - Course filter parameters including search, category, pagination
 * @returns Promise resolving to paginated courses response
 */
async function fetchAdminCourses(
  filters: CourseFilters
): Promise<PaginatedCoursesResponse> {
  // Build query parameters from filters
  const params = new URLSearchParams();

  if (filters.search) {
    params.append('search', filters.search);
  }
  if (filters.categoryId !== undefined) {
    params.append('categoryId', String(filters.categoryId));
  }
  if (filters.visible !== undefined) {
    params.append('visible', String(filters.visible));
  }
  if (filters.startDateFrom) {
    params.append('startDateFrom', filters.startDateFrom);
  }
  if (filters.startDateTo) {
    params.append('startDateTo', filters.startDateTo);
  }
  if (filters.endDateFrom) {
    params.append('endDateFrom', filters.endDateFrom);
  }
  if (filters.endDateTo) {
    params.append('endDateTo', filters.endDateTo);
  }
  if (filters.sortBy) {
    params.append('sortBy', filters.sortBy);
  }
  if (filters.sortOrder) {
    params.append('sortOrder', filters.sortOrder);
  }
  if (filters.page !== undefined) {
    params.append('page', String(filters.page));
  }
  if (filters.perPage !== undefined) {
    params.append('perPage', String(filters.perPage));
  }

  const queryString = params.toString();
  const url = queryString
    ? `${ADMIN_ENDPOINTS.COURSES.LIST}?${queryString}`
    : ADMIN_ENDPOINTS.COURSES.LIST;

  const response = await apiClient.get<ApiResponse<PaginatedCoursesResponse>>(url);

  // Extract data from standard API response envelope
  if (response.data.success) {
    return response.data.data;
  }

  throw new Error('Failed to fetch courses');
}

/**
 * Fetches all course categories for filter dropdowns
 *
 * @returns Promise resolving to categories response
 */
async function fetchCourseCategories(): Promise<CategoriesResponse> {
  const response = await apiClient.get<ApiResponse<CategoriesResponse>>(
    ADMIN_ENDPOINTS.COURSES.CATEGORIES
  );

  if (response.data.success) {
    return response.data.data;
  }

  throw new Error('Failed to fetch categories');
}

/**
 * Executes a bulk action on selected courses
 *
 * @param payload - Bulk action payload with action type, course IDs, and parameters
 * @returns Promise resolving to bulk action result
 */
async function executeBulkAction(
  payload: BulkActionPayload
): Promise<BulkActionResult> {
  const response = await apiClient.post<ApiResponse<BulkActionResult>>(
    ADMIN_ENDPOINTS.COURSES.BULK,
    payload
  );

  if (response.data.success) {
    return response.data.data;
  }

  throw new Error('Bulk action failed');
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for admin course management
 *
 * Provides comprehensive state management, API interactions, and business logic
 * for the course administration interface. Integrates with React Query for server
 * state and maintains local state for UI concerns.
 *
 * @returns {UseCourseAdminReturn} Object containing state, computed values, and handlers
 *
 * @example
 * ```tsx
 * function CourseManagementPage() {
 *   const {
 *     courses,
 *     isLoading,
 *     selectedCourseIds,
 *     handleSelectCourse,
 *     handleBulkAction,
 *     handleSearch,
 *   } = useCourseAdmin();
 *
 *   return (
 *     <DataGrid
 *       rows={courses}
 *       loading={isLoading}
 *       checkboxSelection
 *       onRowSelectionModelChange={(model) => handleSelectionModelChange(model)}
 *     />
 *   );
 * }
 * ```
 */
export default function useCourseAdmin(): UseCourseAdminReturn {
  // Get query client for cache invalidation
  const queryClient = useQueryClient();

  // ============================================================================
  // Local State
  // ============================================================================

  /**
   * Set of selected course IDs for bulk operations
   * Using Set for O(1) lookup and toggle performance
   */
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<number>>(
    new Set()
  );

  /**
   * Current page number (1-indexed)
   */
  const [currentPage, setCurrentPage] = useState<number>(1);

  /**
   * Number of items to display per page
   */
  const [itemsPerPage, setItemsPerPage] = useState<number>(DEFAULT_PER_PAGE);

  /**
   * Current search query string (not debounced)
   */
  const [searchQuery, setSearchQuery] = useState<string>('');

  /**
   * Active filter settings
   */
  const [filters, setFilters] = useState<CourseFilters>({
    page: 1,
    perPage: DEFAULT_PER_PAGE,
    sortBy: 'fullname',
    sortOrder: 'asc',
  });

  /**
   * Current view mode for the admin interface
   */
  const [viewMode, setViewMode] = useState<CourseAdminViewMode>('default');

  // ============================================================================
  // Debounced Values
  // ============================================================================

  /**
   * Debounced search query to reduce API calls
   * Only triggers API call after user stops typing for 500ms
   */
  const debouncedSearchQuery = useDebounce(searchQuery, SEARCH_DEBOUNCE_DELAY);

  // ============================================================================
  // Computed Filter Object
  // ============================================================================

  /**
   * Combined filters object including debounced search
   * This is passed to the query to trigger refetch when filters change
   */
  const effectiveFilters = useMemo<CourseFilters>(() => {
    return {
      ...filters,
      search: debouncedSearchQuery || undefined,
      page: currentPage,
      perPage: itemsPerPage,
    };
  }, [filters, debouncedSearchQuery, currentPage, itemsPerPage]);

  // ============================================================================
  // React Query - Courses
  // ============================================================================

  /**
   * Query for fetching paginated course list
   * Automatically refetches when filters change
   */
  const coursesQuery: UseQueryResult<PaginatedCoursesResponse, Error> = useQuery({
    queryKey: [COURSES_QUERY_KEY, effectiveFilters],
    queryFn: () => fetchAdminCourses(effectiveFilters),
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  });

  // ============================================================================
  // React Query - Categories
  // ============================================================================

  /**
   * Query for fetching course categories
   * Categories are relatively static, so longer cache time
   */
  const categoriesQuery: UseQueryResult<CategoriesResponse, Error> = useQuery({
    queryKey: [CATEGORIES_QUERY_KEY],
    queryFn: fetchCourseCategories,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  // ============================================================================
  // React Query - Bulk Action Mutation
  // ============================================================================

  /**
   * Mutation for executing bulk actions on courses
   * Invalidates course cache on success
   */
  const bulkActionMutation: UseMutationResult<
    BulkActionResult,
    Error,
    BulkActionPayload
  > = useMutation({
    mutationFn: executeBulkAction,
    onSuccess: () => {
      // Invalidate courses query to refetch with updated data
      void queryClient.invalidateQueries({ queryKey: [COURSES_QUERY_KEY] });
      // Clear selection after successful bulk action
      setSelectedCourseIds(new Set());
    },
  });

  // ============================================================================
  // Computed Values
  // ============================================================================

  /**
   * Extract courses from query result with fallback to empty array
   */
  const courses = useMemo<Course[]>(() => {
    return coursesQuery.data?.courses ?? [];
  }, [coursesQuery.data]);

  /**
   * Extract categories from query result with fallback to empty array
   */
  const categories = useMemo<CourseCategory[]>(() => {
    return categoriesQuery.data?.categories ?? [];
  }, [categoriesQuery.data]);

  /**
   * Total number of pages based on total courses and items per page
   */
  const totalPages = useMemo<number>(() => {
    return coursesQuery.data?.totalPages ?? 0;
  }, [coursesQuery.data]);

  /**
   * Total number of courses matching current filters
   */
  const totalCourses = useMemo<number>(() => {
    return coursesQuery.data?.total ?? 0;
  }, [coursesQuery.data]);

  /**
   * Compute selection state for UI feedback
   * - 'all': All courses on current page are selected
   * - 'some': Some but not all courses are selected
   * - 'none': No courses are selected
   */
  const selectionState = useMemo<SelectionState>(() => {
    if (selectedCourseIds.size === 0) {
      return 'none';
    }

    // Check if all courses on current page are selected
    const currentPageCourseIds = courses.map((course) => course.id);
    const allSelected = currentPageCourseIds.every((id) =>
      selectedCourseIds.has(id)
    );

    if (allSelected && currentPageCourseIds.length > 0) {
      return 'all';
    }

    return 'some';
  }, [selectedCourseIds, courses]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Toggle selection of a single course
   * Adds course to selection if not selected, removes if already selected
   *
   * @param courseId - ID of the course to toggle
   */
  const handleSelectCourse = useCallback((courseId: number): void => {
    setSelectedCourseIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(courseId)) {
        newSet.delete(courseId);
      } else {
        newSet.add(courseId);
      }
      return newSet;
    });
  }, []);

  /**
   * Select all courses on current page or deselect all if already all selected
   * Uses toggle behavior: if all selected, deselect all; otherwise select all
   */
  const handleSelectAll = useCallback((): void => {
    setSelectedCourseIds((prev) => {
      const currentPageCourseIds = courses.map((course) => course.id);

      // Check if all courses on current page are already selected
      const allSelected = currentPageCourseIds.every((id) => prev.has(id));

      if (allSelected) {
        // Deselect all courses on current page
        const newSet = new Set(prev);
        currentPageCourseIds.forEach((id) => newSet.delete(id));
        return newSet;
      } else {
        // Select all courses on current page (keeping previous selections)
        const newSet = new Set(prev);
        currentPageCourseIds.forEach((id) => newSet.add(id));
        return newSet;
      }
    });
  }, [courses]);

  /**
   * Update search query and reset to first page
   *
   * @param query - New search query string
   */
  const handleSearch = useCallback((query: string): void => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page when search changes
  }, []);

  /**
   * Update a specific filter and reset to first page
   *
   * @param filterType - Key of the filter to update
   * @param value - New value for the filter
   */
  const handleFilterChange = useCallback(
    <K extends keyof CourseFilters>(
      filterType: K,
      value: CourseFilters[K]
    ): void => {
      setFilters((prev) => ({
        ...prev,
        [filterType]: value,
      }));
      setCurrentPage(1); // Reset to first page when filters change
    },
    []
  );

  /**
   * Execute a bulk action on selected courses
   *
   * @param action - Type of bulk action to perform
   * @param parameters - Optional parameters for the action
   * @returns Promise resolving to bulk action result
   * @throws Error if no courses are selected or action fails
   */
  const handleBulkAction = useCallback(
    async (
      action: BulkActionType,
      parameters?: BulkActionParameters
    ): Promise<BulkActionResult> => {
      // Validate that courses are selected
      if (selectedCourseIds.size === 0) {
        throw new Error('No courses selected for bulk action');
      }

      // Convert Set to array for API payload
      const courseIds = Array.from(selectedCourseIds);

      // Execute the bulk action mutation
      const result = await bulkActionMutation.mutateAsync({
        action,
        courseIds,
        parameters,
      });

      return result;
    },
    [selectedCourseIds, bulkActionMutation]
  );

  /**
   * Navigate to a different page
   *
   * @param page - Page number to navigate to (1-indexed)
   */
  const handlePageChange = useCallback((page: number): void => {
    setCurrentPage(Math.max(1, page));
  }, []);

  /**
   * Change the number of items displayed per page
   *
   * @param perPage - New items per page value
   */
  const handlePerPageChange = useCallback((perPage: number): void => {
    setItemsPerPage(Math.max(1, Math.min(100, perPage)));
    setCurrentPage(1); // Reset to first page when page size changes
  }, []);

  /**
   * Change the view mode of the admin interface
   *
   * @param mode - New view mode
   */
  const handleViewModeChange = useCallback(
    (mode: CourseAdminViewMode): void => {
      setViewMode(mode);
    },
    []
  );

  /**
   * Clear all course selections
   */
  const handleClearSelection = useCallback((): void => {
    setSelectedCourseIds(new Set());
  }, []);

  /**
   * Handle DataGrid selection model change
   * Converts GridRowSelectionModel to Set<number> for internal state
   *
   * @param selectionModel - DataGrid selection model (array of row IDs)
   */
  const handleSelectionModelChange = useCallback(
    (selectionModel: GridRowSelectionModel): void => {
      // GridRowSelectionModel is an array of string | number
      // Convert to Set<number> for our internal state
      const newSelection = new Set<number>();
      selectionModel.forEach((id) => {
        if (typeof id === 'number') {
          newSelection.add(id);
        } else if (typeof id === 'string') {
          const numId = parseInt(id, 10);
          if (!isNaN(numId)) {
            newSelection.add(numId);
          }
        }
      });
      setSelectedCourseIds(newSelection);
    },
    []
  );

  /**
   * Refetch courses data
   * Returns a promise that resolves when refetch is complete
   */
  const refetch = useCallback(async (): Promise<void> => {
    await coursesQuery.refetch();
  }, [coursesQuery]);

  // ============================================================================
  // Return Value
  // ============================================================================

  return {
    // Data
    courses,
    categories,

    // Loading states
    isLoading: coursesQuery.isLoading,
    isCategoriesLoading: categoriesQuery.isLoading,
    isBulkActionLoading: bulkActionMutation.isPending,

    // Error state
    error: coursesQuery.error,

    // Selection state
    selectedCourseIds,
    selectionState,

    // Pagination state
    currentPage,
    totalPages,
    itemsPerPage,
    totalCourses,

    // Filter state
    searchQuery,
    filters,

    // View state
    viewMode,

    // Handlers
    handleSelectCourse,
    handleSelectAll,
    handleSearch,
    handleFilterChange,
    handleBulkAction,
    handlePageChange,
    handlePerPageChange,
    handleViewModeChange,
    handleClearSelection,
    handleSelectionModelChange,

    // Utilities
    refetch,
  };
}

// ============================================================================
// Additional Exports for Testing and Extension
// ============================================================================

/**
 * Query keys exported for testing and manual cache invalidation
 */
export const QUERY_KEYS = {
  courses: COURSES_QUERY_KEY,
  categories: CATEGORIES_QUERY_KEY,
} as const;

/**
 * Default configuration values exported for reference
 */
export const DEFAULTS = {
  perPage: DEFAULT_PER_PAGE,
  searchDebounceDelay: SEARCH_DEBOUNCE_DELAY,
} as const;

/**
 * Re-export BulkActionType for convenient access
 */
export { BulkActionType };

/**
 * Re-export types for convenient access
 */
export type {
  CourseFilters,
  BulkCourseAction,
  BulkActionResult,
  BulkActionParameters,
};
