/**
 * User Management Hook
 *
 * Main custom React hook for admin user management providing comprehensive user list
 * fetching with React Query, integrating filters, pagination, sorting, and cache
 * management for the admin user management interface.
 *
 * This hook combines multiple concerns to provide a complete user management solution:
 * - Server state management with React Query (useQuery)
 * - Filter state integration via useUserFilters hook
 * - Pagination state with navigation helpers
 * - Sorting state with column sorting support
 * - Cache management with appropriate staleTime and cacheTime settings
 *
 * Based on Moodle admin user management functionality:
 * - Source: public/admin/user.php (user listing, filtering, pagination)
 * - Source: public/admin/user/lib.php (user filtering helpers and bulk operations)
 *
 * Features:
 * - Paginated user list fetching from GET /api/v1/admin/users
 * - Integration with useUserFilters for search and filter criteria
 * - Customizable pagination (page, perPage) with sensible defaults
 * - Column sorting with sortBy and sortOrder state management
 * - Smooth pagination transitions with keepPreviousData option
 * - Automatic background refetches with stale data handling
 * - Retry logic for failed requests
 * - Type-safe TypeScript interfaces throughout
 *
 * @package react-frontend
 * @subpackage features/admin/users/hooks
 */

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserList } from '../api/userAdminApi';
import { useUserFilters } from './useUserFilters';
import type { User } from '../types/user.types';
import type {
  UserListQueryParams,
  UserListResponse,
  PaginationMeta,
  UserSortField,
} from '../types/user-list.types';
import { SortOrder } from '../types/user-list.types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Pagination state interface
 *
 * Represents the current pagination state including page number and items per page.
 */
interface PaginationState {
  /** Current page number (1-based indexing) */
  page: number;
  /** Number of users per page */
  perPage: number;
}

/**
 * Sort state interface
 *
 * Represents the current sorting configuration including field and order.
 */
interface SortState {
  /** Field to sort by */
  sortBy: UserSortField;
  /** Sort direction (ascending or descending) */
  sortOrder: SortOrder;
}

/**
 * User Management hook configuration options
 *
 * Allows customization of default values and behavior for the hook.
 */
export interface UseUserManagementOptions {
  /** Initial page number (default: 1) */
  initialPage?: number;
  /** Initial items per page (default: 20) */
  initialPerPage?: number;
  /** Initial sort field (default: UserSortField.LASTNAME) */
  initialSortBy?: UserSortField;
  /** Initial sort order (default: SortOrder.ASC) */
  initialSortOrder?: SortOrder;
  /** Whether to enable automatic fetching (default: true) */
  enabled?: boolean;
  /** Custom stale time in milliseconds (default: 30000 - 30 seconds) */
  staleTime?: number;
  /** Custom cache time in milliseconds (default: 300000 - 5 minutes) */
  cacheTime?: number;
}

/**
 * Return type for the useUserManagement hook
 *
 * Provides all state, data, and functions needed for user management functionality.
 */
export interface UseUserManagementReturn {
  // Data
  /** Array of user records from the current page */
  users: User[];
  /** Total number of users matching current filters */
  totalCount: number;
  /** Pagination metadata from the server response */
  pagination: PaginationMeta | null;

  // Loading states
  /** Whether the initial data is loading */
  isLoading: boolean;
  /** Whether data is being fetched (initial or subsequent) */
  isFetching: boolean;
  /** Whether a background refetch is in progress */
  isRefetching: boolean;
  /** Error object if the request failed */
  error: Error | null;
  /** Whether the query has been successfully loaded at least once */
  isSuccess: boolean;

  // Pagination state and helpers
  /** Current page number (1-based) */
  page: number;
  /** Current items per page setting */
  perPage: number;
  /** Whether there is a next page available */
  hasNextPage: boolean;
  /** Whether there is a previous page available */
  hasPreviousPage: boolean;
  /** Navigate to the next page */
  goToNextPage: () => void;
  /** Navigate to the previous page */
  goToPreviousPage: () => void;
  /** Navigate to a specific page number */
  goToPage: (page: number) => void;
  /** Update the items per page setting */
  setPerPage: (perPage: number) => void;

  // Sorting state and helpers
  /** Current sort field */
  sortBy: UserSortField;
  /** Current sort order */
  sortOrder: SortOrder;
  /** Change the sort order for a specific column */
  changeSortOrder: (field: UserSortField) => void;

  // Filter integration (from useUserFilters)
  /** Current filter parameters */
  filters: Partial<UserListQueryParams>;
  /** Debounced search query value */
  debouncedSearch: string;
  /** Set the search query */
  setSearch: (search: string) => void;
  /** Set the role filter */
  setRole: (role: string | number | undefined) => void;
  /** Set the status filter */
  setStatus: (status: import('../types/user-list.types').UserFilterStatus | undefined) => void;
  /** Set the authentication method filter */
  setAuthMethod: (authMethod: string | undefined) => void;
  /** Set the confirmed status filter */
  setConfirmed: (confirmed: number | undefined) => void;
  /** Set the suspended status filter */
  setSuspended: (suspended: number | undefined) => void;
  /** Set the deleted status filter */
  setDeleted: (deleted: number | undefined) => void;
  /** Reset all filters to default values */
  resetFilters: () => void;

  // Query actions
  /** Manually refetch the user list */
  refetch: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default pagination values
 */
const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;

/**
 * Default sort configuration
 * Sort by last name ascending, matching typical admin user list behavior
 */
const DEFAULT_SORT_BY: UserSortField = 'lastname' as UserSortField;
const DEFAULT_SORT_ORDER = SortOrder.ASC;

/**
 * Cache configuration
 * - staleTime: How long data is considered fresh (30 seconds)
 * - cacheTime: How long to keep cached data in memory (5 minutes)
 */
const DEFAULT_STALE_TIME = 30 * 1000; // 30 seconds
const DEFAULT_CACHE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Query key prefix for user management queries
 * Used for cache invalidation and query identification
 */
const QUERY_KEY_PREFIX = 'admin-users';

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * User Management Hook
 *
 * Comprehensive hook for managing admin user list operations including fetching,
 * pagination, sorting, and filtering. Integrates with React Query for efficient
 * server state management and provides a complete API for user management UI.
 *
 * @param options - Configuration options for the hook behavior
 * @returns {UseUserManagementReturn} Complete state and functions for user management
 *
 * @example
 * // Basic usage
 * function UserManagementPage() {
 *   const {
 *     users,
 *     isLoading,
 *     error,
 *     page,
 *     hasNextPage,
 *     goToNextPage,
 *     setSearch,
 *     filters,
 *   } = useUserManagement();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <SearchInput onChange={(e) => setSearch(e.target.value)} />
 *       <UserTable users={users} />
 *       <Pagination
 *         page={page}
 *         hasNext={hasNextPage}
 *         onNext={goToNextPage}
 *       />
 *     </div>
 *   );
 * }
 *
 * @example
 * // Advanced usage with custom options
 * function CustomUserManagement() {
 *   const {
 *     users,
 *     totalCount,
 *     pagination,
 *     sortBy,
 *     sortOrder,
 *     changeSortOrder,
 *     refetch,
 *     isRefetching,
 *   } = useUserManagement({
 *     initialPerPage: 50,
 *     initialSortBy: UserSortField.LASTACCESS,
 *     initialSortOrder: SortOrder.DESC,
 *     staleTime: 60000, // 1 minute
 *   });
 *
 *   return (
 *     <div>
 *       <header>
 *         <span>Total Users: {totalCount}</span>
 *         <Button onClick={refetch} disabled={isRefetching}>
 *           Refresh
 *         </Button>
 *       </header>
 *       <SortableTable
 *         data={users}
 *         sortBy={sortBy}
 *         sortOrder={sortOrder}
 *         onSort={changeSortOrder}
 *       />
 *     </div>
 *   );
 * }
 */
export function useUserManagement(
  options: UseUserManagementOptions = {}
): UseUserManagementReturn {
  // Extract options with defaults
  const {
    initialPage = DEFAULT_PAGE,
    initialPerPage = DEFAULT_PER_PAGE,
    initialSortBy = DEFAULT_SORT_BY,
    initialSortOrder = DEFAULT_SORT_ORDER,
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
  } = options;

  // ========================================
  // Pagination State
  // ========================================

  const [paginationState, setPaginationState] = useState<PaginationState>({
    page: initialPage,
    perPage: initialPerPage,
  });

  // ========================================
  // Sorting State
  // ========================================

  const [sortState, setSortState] = useState<SortState>({
    sortBy: initialSortBy,
    sortOrder: initialSortOrder,
  });

  // ========================================
  // Filter Integration
  // ========================================

  const {
    filters,
    debouncedSearch,
    setSearch,
    setRole,
    setStatus,
    setAuthMethod,
    setConfirmed,
    setSuspended,
    setDeleted,
    resetFilters: resetFilterState,
  } = useUserFilters();

  // ========================================
  // Query Parameters Construction
  // ========================================

  /**
   * Construct complete query parameters from all state sources
   * Combines filters, pagination, and sorting into a single params object
   */
  const queryParams: UserListQueryParams = {
    ...filters,
    page: paginationState.page,
    perPage: paginationState.perPage,
    sortBy: sortState.sortBy,
    sortOrder: sortState.sortOrder,
  };

  // ========================================
  // React Query Configuration
  // ========================================

  /**
   * Query key includes all parameters to ensure proper cache management
   * Changes to any parameter will trigger a new query
   */
  const queryKey = [
    QUERY_KEY_PREFIX,
    'list',
    {
      ...queryParams,
      // Include debounced search separately for clarity
      search: debouncedSearch || undefined,
    },
  ];

  /**
   * Main query for fetching user list
   *
   * Configuration:
   * - enabled: Controlled by options prop to allow conditional fetching
   * - staleTime: Data is fresh for 30 seconds, reducing unnecessary refetches
   * - cacheTime: Keep data in cache for 5 minutes after becoming inactive
   * - keepPreviousData: Show previous data while loading new pages for smooth UX
   * - retry: Retry failed requests up to 3 times with exponential backoff
   * - refetchOnWindowFocus: Automatically refresh when user returns to tab
   */
  const {
    data,
    isLoading,
    isFetching,
    isRefetching,
    error,
    isSuccess,
    refetch: queryRefetch,
  } = useQuery<UserListResponse, Error>({
    queryKey,
    queryFn: () => getUserList(queryParams),
    enabled,
    staleTime,
    gcTime: cacheTime,
    placeholderData: (previousData) => previousData,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: true,
  });

  // ========================================
  // Derived State
  // ========================================

  /**
   * Extract users array from response data
   * Returns empty array if no data available
   */
  const users: User[] = data?.data ?? [];

  /**
   * Extract total count from pagination metadata
   * Returns 0 if no data available
   */
  const totalCount: number = data?.pagination?.total ?? 0;

  /**
   * Pagination metadata from server response
   */
  const pagination: PaginationMeta | null = data?.pagination ?? null;

  /**
   * Calculate if there is a next page available
   * Based on current page and total pages from server
   */
  const hasNextPage: boolean =
    pagination !== null && paginationState.page < pagination.totalPages;

  /**
   * Calculate if there is a previous page available
   * Based on current page number (1-based indexing)
   */
  const hasPreviousPage: boolean = paginationState.page > 1;

  // ========================================
  // Pagination Helper Functions
  // ========================================

  /**
   * Navigate to the next page
   * Only advances if there is a next page available
   */
  const goToNextPage = useCallback((): void => {
    if (hasNextPage) {
      setPaginationState((prev) => ({
        ...prev,
        page: prev.page + 1,
      }));
    }
  }, [hasNextPage]);

  /**
   * Navigate to the previous page
   * Only goes back if not on the first page
   */
  const goToPreviousPage = useCallback((): void => {
    if (hasPreviousPage) {
      setPaginationState((prev) => ({
        ...prev,
        page: prev.page - 1,
      }));
    }
  }, [hasPreviousPage]);

  /**
   * Navigate to a specific page number
   * Validates page number is within valid range
   *
   * @param targetPage - The page number to navigate to (1-based)
   */
  const goToPage = useCallback(
    (targetPage: number): void => {
      const totalPages = pagination?.totalPages ?? 1;
      const validPage = Math.max(1, Math.min(targetPage, totalPages));

      setPaginationState((prev) => ({
        ...prev,
        page: validPage,
      }));
    },
    [pagination?.totalPages]
  );

  /**
   * Update the items per page setting
   * Resets to page 1 when changing page size to avoid invalid page states
   *
   * @param newPerPage - New items per page value
   */
  const setPerPage = useCallback((newPerPage: number): void => {
    setPaginationState({
      page: 1, // Reset to first page when changing page size
      perPage: Math.max(1, Math.min(newPerPage, 200)), // Clamp between 1 and 200
    });
  }, []);

  // ========================================
  // Sorting Helper Functions
  // ========================================

  /**
   * Change the sort order for a column
   *
   * Behavior:
   * - If clicking the same column: Toggle between ASC and DESC
   * - If clicking a different column: Switch to that column with ASC order
   *
   * @param field - The field to sort by
   */
  const changeSortOrder = useCallback(
    (field: UserSortField): void => {
      setSortState((prev) => {
        if (prev.sortBy === field) {
          // Same column: toggle order
          return {
            ...prev,
            sortOrder: prev.sortOrder === SortOrder.ASC ? SortOrder.DESC : SortOrder.ASC,
          };
        }
        // Different column: switch to new column with ascending order
        return {
          sortBy: field,
          sortOrder: SortOrder.ASC,
        };
      });
    },
    []
  );

  // ========================================
  // Filter Reset with Pagination Reset
  // ========================================

  /**
   * Reset all filters and return to first page
   *
   * Combines the filter reset from useUserFilters with a pagination reset
   * to ensure consistent state after clearing filters.
   */
  const resetFilters = useCallback((): void => {
    resetFilterState();
    setPaginationState({
      page: DEFAULT_PAGE,
      perPage: paginationState.perPage, // Preserve current page size
    });
  }, [resetFilterState, paginationState.perPage]);

  // ========================================
  // Refetch Wrapper
  // ========================================

  /**
   * Manually trigger a refetch of the user list
   * Useful for refresh buttons and after bulk operations
   */
  const refetch = useCallback((): void => {
    queryRefetch();
  }, [queryRefetch]);

  // ========================================
  // Return Value
  // ========================================

  return {
    // Data
    users,
    totalCount,
    pagination,

    // Loading states
    isLoading,
    isFetching,
    isRefetching,
    error: error ?? null,
    isSuccess,

    // Pagination state and helpers
    page: paginationState.page,
    perPage: paginationState.perPage,
    hasNextPage,
    hasPreviousPage,
    goToNextPage,
    goToPreviousPage,
    goToPage,
    setPerPage,

    // Sorting state and helpers
    sortBy: sortState.sortBy,
    sortOrder: sortState.sortOrder,
    changeSortOrder,

    // Filter integration
    filters,
    debouncedSearch,
    setSearch,
    setRole,
    setStatus,
    setAuthMethod,
    setConfirmed,
    setSuspended,
    setDeleted,
    resetFilters,

    // Query actions
    refetch,
  };
}

/**
 * Default export for convenient importing
 */
export default useUserManagement;
