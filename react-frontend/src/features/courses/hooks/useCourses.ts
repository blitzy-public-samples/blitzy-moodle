/**
 * useCourses Hook
 *
 * React Query hook for fetching paginated course lists with filtering, sorting,
 * and caching capabilities. Wraps courseApi.getCourses() to provide type-safe
 * access to course catalog data with automatic pagination management, search
 * filtering, category filtering, and optimized network requests through
 * intelligent caching strategies.
 *
 * This hook implements the following functionality from the Agent Action Plan:
 * - Calls GET /api/v1/courses endpoint which wraps Moodle's get_courses() function
 * - Supports pagination parameters (page, limit) with default limit of 20 courses
 * - Implements search filtering by course name/shortname with debounced queries
 * - Supports category filtering to show courses from specific categories
 * - Includes sorting options (name, recent, enrolled)
 * - Implements aggressive caching with 10-minute stale time for course lists
 * - Uses keepPreviousData option to prevent layout shift during pagination
 * - Implements prefetching of next page for seamless pagination experience
 * - Uses queryKey pattern ['courses', 'list', filters] for granular cache management
 *
 * Performance Targets (from Agent Action Plan):
 * - Frontend Performance: Initial page load <3 seconds on 3G, subsequent navigation <500ms
 * - Backend API Performance: P50 response time <300ms, P95 response time <1 second
 *
 * @module features/courses/hooks/useCourses
 * @see public/course/index.php - Moodle course catalog functionality
 * @see public/course/lib.php - Moodle course library functions
 * @see public/course/externallib.php - Moodle course external API functions
 */

import { useCallback, useEffect, useMemo } from 'react';
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { getCourses, type CourseListParams } from '@/features/courses/api/courseApi';
import useDebounce from '@/hooks/useDebounce';
import type { Course } from '@/types/entities';
import type { PaginatedResponse } from '@/types/api';
import type { CategoryId } from '@/types/common';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default number of courses per page
 * Optimized for performance while providing good UX
 */
const DEFAULT_PAGE_SIZE = 20;

/**
 * Debounce delay for search queries (milliseconds)
 * Prevents excessive API calls while user is typing
 */
const SEARCH_DEBOUNCE_DELAY = 300;

/**
 * Stale time for course list queries (10 minutes in milliseconds)
 * Aggressive caching to minimize API calls and improve performance
 */
const STALE_TIME = 10 * 60 * 1000;

/**
 * Garbage collection time for unused queries (15 minutes in milliseconds)
 */
const GC_TIME = 15 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

/**
 * Sort field options for course listing
 * - 'fullname': Sort by course full name alphabetically
 * - 'startdate': Sort by course start date (recent first/last)
 * - 'enrolledusers': Sort by number of enrolled users
 */
export type CourseSortField = 'fullname' | 'startdate' | 'enrolledusers';

/**
 * Sort order direction
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Options for configuring the useCourses hook behavior
 *
 * @example
 * ```typescript
 * const options: UseCoursesOptions = {
 *   page: 1,
 *   limit: 20,
 *   search: 'typescript',
 *   categoryId: 5,
 *   sortBy: 'fullname',
 *   sortOrder: 'asc',
 *   enabled: true
 * };
 * ```
 */
export interface UseCoursesOptions {
  /**
   * Current page number (1-indexed)
   * @default 1
   */
  page?: number;

  /**
   * Number of courses to fetch per page
   * @default 20
   */
  limit?: number;

  /**
   * Search query string to filter courses by name/shortname
   * Will be debounced automatically to prevent excessive API calls
   */
  search?: string;

  /**
   * Category ID to filter courses from specific category
   */
  categoryId?: CategoryId;

  /**
   * Field to sort courses by
   * - 'fullname': Alphabetical by course name
   * - 'startdate': By course start date
   * - 'enrolledusers': By enrollment count
   * @default 'fullname'
   */
  sortBy?: CourseSortField;

  /**
   * Sort order direction
   * @default 'asc'
   */
  sortOrder?: SortOrder;

  /**
   * Whether the query should be enabled
   * Useful for conditional fetching
   * @default true
   */
  enabled?: boolean;

  /**
   * Whether to refetch when window regains focus
   * @default true
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Whether to refetch when the component mounts
   * @default true
   */
  refetchOnMount?: boolean | 'always';
}

/**
 * Pagination metadata returned by the hook
 */
export interface PaginationInfo {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  perPage: number;
  /** Total number of items across all pages */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Whether there is a previous page */
  hasPreviousPage: boolean;
}

/**
 * Return type of the useCourses hook
 *
 * Extends React Query's UseQueryResult with additional pagination helpers
 * and properly typed data structure.
 */
export interface UseCoursesReturn {
  /**
   * Array of courses for the current page
   * Will be undefined while loading or on error
   */
  data: Course[] | undefined;

  /**
   * Whether the query is currently loading (initial fetch)
   */
  isLoading: boolean;

  /**
   * Whether there was an error fetching courses
   */
  isError: boolean;

  /**
   * Error object if the query failed
   */
  error: Error | null;

  /**
   * Pagination metadata including page info and totals
   */
  pagination: PaginationInfo | undefined;

  /**
   * Whether the query is currently fetching (including background refetch)
   */
  isFetching: boolean;

  /**
   * Whether data exists and is stale
   */
  isStale: boolean;

  /**
   * Function to manually refetch the current page
   */
  refetch: () => Promise<void>;

  /**
   * Navigate to a specific page number
   * @param pageNumber - The page number to navigate to (1-indexed)
   */
  goToPage: (pageNumber: number) => void;

  /**
   * Navigate to the next page if available
   * Does nothing if already on the last page
   */
  nextPage: () => void;

  /**
   * Navigate to the previous page if available
   * Does nothing if already on the first page
   */
  prevPage: () => void;
}

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query key factory for course list queries
 * Enables granular cache management based on filter parameters
 *
 * @param filters - Current filter/pagination parameters
 * @returns Tuple query key for React Query
 */
function createQueryKey(filters: {
  page: number;
  limit: number;
  search: string;
  categoryId: CategoryId | undefined;
  sortBy: CourseSortField;
  sortOrder: SortOrder;
}): readonly ['courses', 'list', typeof filters] {
  return ['courses', 'list', filters] as const;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React Query hook for fetching paginated course lists
 *
 * Provides comprehensive course catalog functionality including:
 * - Pagination with page navigation helpers
 * - Search filtering with automatic debouncing
 * - Category filtering
 * - Sorting by name, date, or enrollment count
 * - Aggressive caching for optimal performance
 * - Prefetching of next page for seamless navigation
 * - Loading, error, and success state management
 *
 * @param options - Configuration options for the hook
 * @returns Object containing course data, loading states, pagination info, and navigation helpers
 *
 * @example
 * ```typescript
 * // Basic usage
 * const { data: courses, isLoading, pagination, nextPage, prevPage } = useCourses();
 *
 * // With search and filtering
 * const { data: courses, isLoading, pagination } = useCourses({
 *   search: searchTerm,
 *   categoryId: 5,
 *   sortBy: 'fullname',
 *   sortOrder: 'asc',
 *   page: currentPage,
 *   limit: 20
 * });
 *
 * // With pagination controls
 * return (
 *   <div>
 *     {isLoading ? (
 *       <LoadingSpinner />
 *     ) : (
 *       <>
 *         <CourseList courses={courses} />
 *         <Pagination
 *           page={pagination?.page ?? 1}
 *           totalPages={pagination?.totalPages ?? 1}
 *           onPageChange={goToPage}
 *         />
 *       </>
 *     )}
 *   </div>
 * );
 * ```
 */
function useCourses(options: UseCoursesOptions = {}): UseCoursesReturn {
  // Extract options with defaults
  const {
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    search = '',
    categoryId,
    sortBy = 'fullname',
    sortOrder = 'asc',
    enabled = true,
    refetchOnWindowFocus = true,
    refetchOnMount = true,
  } = options;

  // Get query client for prefetching
  const queryClient = useQueryClient();

  // Debounce search input to prevent excessive API calls
  // Uses 300ms delay to wait for user to stop typing
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_DELAY);

  // Memoize filter parameters to ensure stable query key
  const filters = useMemo(
    () => ({
      page,
      limit,
      search: debouncedSearch.trim(),
      categoryId,
      sortBy,
      sortOrder,
    }),
    [page, limit, debouncedSearch, categoryId, sortBy, sortOrder]
  );

  // Create stable query key
  const queryKey = useMemo(() => createQueryKey(filters), [filters]);

  // Map sortBy to API parameter
  const apiSortField = useMemo(() => {
    const sortFieldMap: Record<CourseSortField, CourseListParams['sort']> = {
      fullname: 'fullname',
      startdate: 'startdate',
      enrolledusers: 'enrolledusers',
    };
    return sortFieldMap[sortBy];
  }, [sortBy]);

  // Construct API parameters
  const apiParams: CourseListParams = useMemo(
    () => ({
      page,
      perPage: limit,
      search: debouncedSearch.trim() || undefined,
      categoryId,
      sort: apiSortField,
      order: sortOrder,
    }),
    [page, limit, debouncedSearch, categoryId, apiSortField, sortOrder]
  );

  // Main query for fetching courses
  const query = useQuery<PaginatedResponse<Course>, Error>({
    queryKey,
    queryFn: () => getCourses(apiParams),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    enabled,
    refetchOnWindowFocus,
    refetchOnMount,
    // Keep previous data visible while fetching new page
    // Prevents layout shift during pagination
    placeholderData: keepPreviousData,
  });

  // Extract pagination metadata from response
  const pagination: PaginationInfo | undefined = useMemo(() => {
    if (!query.data?.meta?.pagination) {
      return undefined;
    }

    const { page: currentPage, perPage, total, totalPages } = query.data.meta.pagination;

    return {
      page: currentPage,
      perPage,
      total,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    };
  }, [query.data?.meta?.pagination]);

  // Prefetch next page for seamless pagination experience
  useEffect(() => {
    if (
      enabled &&
      pagination?.hasNextPage &&
      !query.isFetching
    ) {
      const nextPageFilters = {
        ...filters,
        page: filters.page + 1,
      };

      const nextPageParams: CourseListParams = {
        ...apiParams,
        page: apiParams.page !== undefined ? apiParams.page + 1 : 2,
      };

      // Prefetch the next page in the background
      queryClient.prefetchQuery({
        queryKey: createQueryKey(nextPageFilters),
        queryFn: () => getCourses(nextPageParams),
        staleTime: STALE_TIME,
      });
    }
  }, [
    enabled,
    pagination?.hasNextPage,
    query.isFetching,
    filters,
    apiParams,
    queryClient,
  ]);

  // Navigation helpers
  const goToPage = useCallback(
    (pageNumber: number) => {
      if (pageNumber < 1) {
        console.warn('useCourses: Invalid page number. Page must be >= 1');
        return;
      }

      if (pagination && pageNumber > pagination.totalPages) {
        console.warn(
          `useCourses: Page ${pageNumber} exceeds total pages (${pagination.totalPages})`
        );
        return;
      }

      // Update the page in the parent component's state
      // This is typically done by the parent passing a new page prop
      // The hook will automatically refetch with the new page
      const newFilters = { ...filters, page: pageNumber };
      const newParams: CourseListParams = { ...apiParams, page: pageNumber };

      // Manually trigger query with new page if needed
      queryClient.fetchQuery({
        queryKey: createQueryKey(newFilters),
        queryFn: () => getCourses(newParams),
        staleTime: STALE_TIME,
      });
    },
    [filters, apiParams, pagination, queryClient]
  );

  const nextPage = useCallback(() => {
    if (pagination?.hasNextPage) {
      goToPage(pagination.page + 1);
    }
  }, [pagination, goToPage]);

  const prevPage = useCallback(() => {
    if (pagination?.hasPreviousPage) {
      goToPage(pagination.page - 1);
    }
  }, [pagination, goToPage]);

  // Refetch helper
  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  // Return hook result with properly typed data
  return {
    data: query.data?.data?.items,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    pagination,
    isFetching: query.isFetching,
    isStale: query.isStale,
    refetch,
    goToPage,
    nextPage,
    prevPage,
  };
}

// Default export for the hook
export default useCourses;

// Named export for explicit imports
export { useCourses };
