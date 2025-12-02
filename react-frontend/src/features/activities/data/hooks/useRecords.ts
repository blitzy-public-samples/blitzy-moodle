/**
 * useRecords Hook - Database Activity Records Query Hook
 *
 * React Query hooks for fetching multiple Database activity records with comprehensive
 * filtering, sorting, and pagination support. Implements advanced search capabilities
 * across fields, approval status filtering, user/group filtering, date range filtering,
 * and configurable sorting by any field or standard columns.
 *
 * Features:
 * - Standard paginated query hook (useRecords)
 * - Infinite scroll pagination hook (useRecordsInfinite)
 * - Full-text search across all fields
 * - Approval status filtering (all/approved/pending)
 * - User and group-based filtering
 * - Date range filtering (timeadded, timemodified)
 * - Configurable sorting (field ID or special columns)
 * - Proper cache invalidation via query keys
 * - Loading, error, and success states
 * - Refetch capabilities
 *
 * Based on Moodle's PHP implementation:
 * - public/mod/data/locallib.php
 * - public/mod/data/view.php
 *
 * @module features/activities/data/hooks/useRecords
 */

import {
  useQuery,
  useInfiniteQuery,
  type UseQueryResult,
  type UseInfiniteQueryResult,
  type QueryKey,
} from '@tanstack/react-query';

import { getRecords, dataQueryKeys } from '@/features/activities/data/api/dataApi';
import type {
  SearchCriteria,
  DatabaseRecordsResponse,
  DatabaseRecord,
} from '@/features/activities/data/types/data.types';
import type { ApiResponse } from '@/types/api';
import type { Id } from '@/types/common';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Approval status filter options
 *
 * Defines the possible approval status filter values:
 * - 'all': Show all records regardless of approval status
 * - 'approved': Show only approved records
 * - 'pending': Show only records pending approval
 */
export type ApprovalStatus = 'all' | 'approved' | 'pending';

/**
 * Date range filter configuration
 *
 * Specifies a date range for filtering records by creation or modification time.
 */
export interface DateRangeFilter {
  /**
   * Start timestamp (Unix timestamp, seconds since epoch)
   * Records created/modified on or after this time are included
   */
  from?: number;

  /**
   * End timestamp (Unix timestamp, seconds since epoch)
   * Records created/modified on or before this time are included
   */
  to?: number;
}

/**
 * Sort configuration for records
 *
 * Defines how records should be sorted. Supports both field IDs
 * and special sort columns like 'firstname', 'lastname', etc.
 */
export interface RecordsSortConfig {
  /**
   * Field ID to sort by, or special sort column identifier
   *
   * Special values:
   * - 0: Sort by time added (DATA_TIMEADDED in Moodle)
   * - -1: Sort by time modified (DATA_TIMEMODIFIED in Moodle)
   * - -2: Sort by firstname (DATA_FIRSTNAME in Moodle)
   * - -3: Sort by lastname (DATA_LASTNAME in Moodle)
   * - Positive numbers: Sort by specific field ID
   */
  field: number;

  /**
   * Sort direction
   * - 0: Ascending (A-Z, oldest first, lowest first)
   * - 1: Descending (Z-A, newest first, highest first)
   */
  direction: 0 | 1;
}

/**
 * Parameters for useRecords hook
 *
 * Comprehensive configuration for filtering, sorting, and paginating
 * database activity records.
 */
export interface UseRecordsParams {
  /**
   * Database instance ID (required)
   * The unique identifier of the database activity to fetch records from
   */
  databaseId: Id;

  /**
   * Search query string for full-text search across all fields
   * When provided, searches all field contents for matching text
   */
  search?: string;

  /**
   * Approval status filter
   * - 'all': All records regardless of approval status
   * - 'approved': Only approved records (approved = 1)
   * - 'pending': Only pending records (approved = 0)
   * @default 'all'
   */
  approvalStatus?: ApprovalStatus;

  /**
   * Filter records by user ID
   * When provided, only returns records created by this user
   */
  userId?: Id;

  /**
   * Filter records by group ID
   * When provided, only returns records belonging to this group
   */
  groupId?: Id;

  /**
   * Filter records by date range (based on timecreated)
   * Filters records created within the specified date range
   */
  dateRange?: DateRangeFilter;

  /**
   * Filter records by modification date range (based on timemodified)
   * Filters records last modified within the specified date range
   */
  modifiedDateRange?: DateRangeFilter;

  /**
   * Advanced field-specific search criteria
   * Map of field ID to search value for targeted field searches
   * @example { 1: 'john', 2: 'example.com' } // Search field 1 for 'john', field 2 for 'example.com'
   */
  advancedSearch?: Record<number, string>;

  /**
   * Sort configuration
   * Defines the field and direction for sorting records
   */
  sort?: RecordsSortConfig;

  /**
   * Current page number (1-indexed)
   * @default 1
   */
  page?: number;

  /**
   * Number of records per page
   * @default 20
   */
  perPage?: number;

  /**
   * Whether to enable the query
   * When false, the query will not execute
   * @default true
   */
  enabled?: boolean;

  /**
   * Stale time in milliseconds
   * How long the data is considered fresh before refetching
   * @default 30000 (30 seconds)
   */
  staleTime?: number;
}

/**
 * Return type for useRecords hook
 *
 * Extends React Query's UseQueryResult with convenience properties
 * for accessing pagination metadata and records.
 */
export interface UseRecordsResult {
  /**
   * Array of database records matching the filter criteria
   */
  records: DatabaseRecord[];

  /**
   * Total count of records matching the filter criteria
   * (across all pages, not just current page)
   */
  totalCount: number;

  /**
   * Whether there are more records beyond the current page
   */
  hasMore: boolean;

  /**
   * Current page number (1-indexed)
   */
  currentPage: number;

  /**
   * Number of records per page
   */
  pageSize: number;

  /**
   * Total number of pages available
   */
  totalPages: number;

  /**
   * Whether the query is currently loading (initial load)
   */
  isLoading: boolean;

  /**
   * Whether the query is fetching (includes refetches)
   */
  isFetching: boolean;

  /**
   * Whether an error occurred during the query
   */
  isError: boolean;

  /**
   * Whether the query was successful
   */
  isSuccess: boolean;

  /**
   * Error object if the query failed
   */
  error: Error | null;

  /**
   * Function to manually refetch the records
   */
  refetch: () => Promise<unknown>;

  /**
   * Raw React Query result object for advanced usage
   */
  queryResult: UseQueryResult<DatabaseRecordsResponse, Error>;
}

/**
 * Parameters for useRecordsInfinite hook
 *
 * Similar to UseRecordsParams but excludes page number since
 * infinite queries manage pagination internally.
 */
export interface UseRecordsInfiniteParams extends Omit<UseRecordsParams, 'page'> {
  /**
   * Initial page size for infinite query
   * @default 20
   */
  initialPageSize?: number;
}

/**
 * Return type for useRecordsInfinite hook
 *
 * Provides infinite scroll functionality with accumulated records
 * from all loaded pages.
 */
export interface UseRecordsInfiniteResult {
  /**
   * Accumulated array of all records from all loaded pages
   */
  records: DatabaseRecord[];

  /**
   * Total count of records matching the filter criteria
   */
  totalCount: number;

  /**
   * Whether there are more pages to load
   */
  hasNextPage: boolean;

  /**
   * Whether the next page is currently being fetched
   */
  isFetchingNextPage: boolean;

  /**
   * Function to fetch the next page of records
   */
  fetchNextPage: () => Promise<unknown>;

  /**
   * Whether the query is currently loading (initial load)
   */
  isLoading: boolean;

  /**
   * Whether the query is fetching (includes refetches)
   */
  isFetching: boolean;

  /**
   * Whether an error occurred during the query
   */
  isError: boolean;

  /**
   * Whether the query was successful
   */
  isSuccess: boolean;

  /**
   * Error object if the query failed
   */
  error: Error | null;

  /**
   * Function to manually refetch all pages
   */
  refetch: () => Promise<unknown>;

  /**
   * Raw React Query infinite query result for advanced usage
   */
  queryResult: UseInfiniteQueryResult<DatabaseRecordsResponse, Error>;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Special sort field values (from Moodle's mod/data/lib.php)
 */
export const SORT_FIELDS = {
  /** Sort by time added (timecreated) */
  TIME_ADDED: 0,
  /** Sort by time modified */
  TIME_MODIFIED: -1,
  /** Sort by user's first name */
  FIRSTNAME: -2,
  /** Sort by user's last name */
  LASTNAME: -3,
} as const;

/**
 * Default values for pagination
 */
const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const DEFAULT_STALE_TIME = 30000; // 30 seconds

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Builds the search criteria object from hook parameters
 *
 * Converts UseRecordsParams into the SearchCriteria format expected
 * by the getRecords API function.
 *
 * @param params - Hook parameters
 * @param pageOverride - Optional page number override (for infinite queries)
 * @returns SearchCriteria object for API call
 */
function buildSearchCriteria(
  params: UseRecordsParams,
  pageOverride?: number
): SearchCriteria {
  const criteria: SearchCriteria = {
    page: pageOverride ?? params.page ?? DEFAULT_PAGE,
    perPage: params.perPage ?? DEFAULT_PER_PAGE,
  };

  // Add search query if provided
  if (params.search && params.search.trim().length > 0) {
    criteria.search = params.search.trim();
  }

  // Add sort configuration if provided
  if (params.sort) {
    criteria.sort = {
      field: params.sort.field,
      direction: params.sort.direction,
    };
  }

  // Build advanced search criteria
  const advancedFilters: Record<number, string> = {};

  // Add field-specific advanced search
  if (params.advancedSearch) {
    Object.entries(params.advancedSearch).forEach(([fieldId, value]) => {
      if (value && value.trim().length > 0) {
        advancedFilters[parseInt(fieldId, 10)] = value.trim();
      }
    });
  }

  // Note: Approval status, user/group filters, and date ranges are typically
  // handled by the API as query parameters. If the API supports these as
  // advanced search fields, they would be added here.
  // The current implementation passes them as part of the search criteria
  // structure, and the API layer handles the actual filtering.

  if (Object.keys(advancedFilters).length > 0) {
    criteria.advanced = advancedFilters;
  }

  return criteria;
}

/**
 * Generates a unique query key for the records query
 *
 * Creates a cache key that includes all filter parameters to ensure
 * proper cache invalidation when filters change.
 *
 * @param params - Hook parameters
 * @returns Query key array
 */
function buildQueryKey(params: UseRecordsParams): QueryKey {
  const criteria = buildSearchCriteria(params);

  // Build a comprehensive key that includes all filter parameters
  const filterKey = {
    search: params.search ?? null,
    approvalStatus: params.approvalStatus ?? 'all',
    userId: params.userId ?? null,
    groupId: params.groupId ?? null,
    dateRange: params.dateRange ?? null,
    modifiedDateRange: params.modifiedDateRange ?? null,
    advancedSearch: params.advancedSearch ?? null,
    sort: params.sort ?? null,
    page: params.page ?? DEFAULT_PAGE,
    perPage: params.perPage ?? DEFAULT_PER_PAGE,
  };

  return dataQueryKeys.recordsByDatabase(params.databaseId, {
    ...criteria,
    ...filterKey,
  } as SearchCriteria);
}

/**
 * Filters records by approval status on the client side
 *
 * While the API should handle this filtering, this provides
 * a fallback for client-side filtering if needed.
 *
 * @param records - Array of database records
 * @param approvalStatus - Approval status filter
 * @returns Filtered records array
 */
function filterByApprovalStatus(
  records: DatabaseRecord[],
  approvalStatus: ApprovalStatus
): DatabaseRecord[] {
  if (approvalStatus === 'all') {
    return records;
  }

  return records.filter((record) => {
    if (approvalStatus === 'approved') {
      return record.approved === true;
    }
    if (approvalStatus === 'pending') {
      return record.approved === false;
    }
    return true;
  });
}

/**
 * Filters records by user ID
 *
 * @param records - Array of database records
 * @param userId - User ID to filter by
 * @returns Filtered records array
 */
function filterByUserId(
  records: DatabaseRecord[],
  userId: Id | undefined
): DatabaseRecord[] {
  if (!userId) {
    return records;
  }
  return records.filter((record) => record.userid === userId);
}

/**
 * Filters records by group ID
 *
 * @param records - Array of database records
 * @param groupId - Group ID to filter by
 * @returns Filtered records array
 */
function filterByGroupId(
  records: DatabaseRecord[],
  groupId: Id | undefined
): DatabaseRecord[] {
  if (!groupId) {
    return records;
  }
  return records.filter((record) => record.groupid === groupId);
}

/**
 * Filters records by date range (timecreated)
 *
 * @param records - Array of database records
 * @param dateRange - Date range filter
 * @returns Filtered records array
 */
function filterByDateRange(
  records: DatabaseRecord[],
  dateRange: DateRangeFilter | undefined
): DatabaseRecord[] {
  if (!dateRange) {
    return records;
  }

  return records.filter((record) => {
    const timestamp = record.timecreated;

    if (dateRange.from && timestamp < dateRange.from) {
      return false;
    }
    if (dateRange.to && timestamp > dateRange.to) {
      return false;
    }

    return true;
  });
}

/**
 * Filters records by modification date range (timemodified)
 *
 * @param records - Array of database records
 * @param dateRange - Date range filter
 * @returns Filtered records array
 */
function filterByModifiedDateRange(
  records: DatabaseRecord[],
  dateRange: DateRangeFilter | undefined
): DatabaseRecord[] {
  if (!dateRange) {
    return records;
  }

  return records.filter((record) => {
    const timestamp = record.timemodified;

    if (dateRange.from && timestamp < dateRange.from) {
      return false;
    }
    if (dateRange.to && timestamp > dateRange.to) {
      return false;
    }

    return true;
  });
}

/**
 * Applies all client-side filters to records
 *
 * This function applies filters that may not be supported by the API
 * directly, providing a fallback for comprehensive filtering.
 *
 * @param response - API response with records
 * @param params - Filter parameters
 * @returns Filtered response
 */
function applyClientSideFilters(
  response: DatabaseRecordsResponse,
  params: UseRecordsParams
): DatabaseRecordsResponse {
  let filteredRecords = response.records;

  // Apply approval status filter
  if (params.approvalStatus && params.approvalStatus !== 'all') {
    filteredRecords = filterByApprovalStatus(filteredRecords, params.approvalStatus);
  }

  // Apply user filter
  if (params.userId) {
    filteredRecords = filterByUserId(filteredRecords, params.userId);
  }

  // Apply group filter
  if (params.groupId) {
    filteredRecords = filterByGroupId(filteredRecords, params.groupId);
  }

  // Apply date range filters
  if (params.dateRange) {
    filteredRecords = filterByDateRange(filteredRecords, params.dateRange);
  }

  if (params.modifiedDateRange) {
    filteredRecords = filterByModifiedDateRange(filteredRecords, params.modifiedDateRange);
  }

  // If filters were applied client-side, update the total count
  // Note: This is a simplified approach - ideally the API handles all filtering
  const hasClientFilters =
    (params.approvalStatus && params.approvalStatus !== 'all') ||
    params.userId ||
    params.groupId ||
    params.dateRange ||
    params.modifiedDateRange;

  if (hasClientFilters) {
    return {
      records: filteredRecords,
      pagination: {
        ...response.pagination,
        total: filteredRecords.length,
        totalPages: Math.ceil(
          filteredRecords.length / response.pagination.perPage
        ),
      },
    };
  }

  return response;
}

// ============================================================================
// Main Hooks
// ============================================================================

/**
 * useRecords - React Query hook for fetching database records with pagination
 *
 * Fetches records from a database activity with comprehensive filtering,
 * sorting, and pagination support. Returns paginated results with metadata
 * and React Query states.
 *
 * @param params - Configuration parameters for the query
 * @returns UseRecordsResult with records, pagination info, and query states
 *
 * @example
 * ```typescript
 * // Basic usage - fetch all records
 * const { records, isLoading } = useRecords({ databaseId: 123 });
 *
 * // With search
 * const { records } = useRecords({
 *   databaseId: 123,
 *   search: 'john doe',
 * });
 *
 * // With approval filter
 * const { records } = useRecords({
 *   databaseId: 123,
 *   approvalStatus: 'pending',
 * });
 *
 * // With sorting
 * const { records } = useRecords({
 *   databaseId: 123,
 *   sort: { field: SORT_FIELDS.TIME_ADDED, direction: 1 }, // Newest first
 * });
 *
 * // With pagination
 * const { records, totalPages, hasMore } = useRecords({
 *   databaseId: 123,
 *   page: 2,
 *   perPage: 10,
 * });
 *
 * // With date range filter
 * const { records } = useRecords({
 *   databaseId: 123,
 *   dateRange: {
 *     from: Date.now() / 1000 - 86400 * 7, // Last 7 days
 *     to: Date.now() / 1000,
 *   },
 * });
 * ```
 */
function useRecords(params: UseRecordsParams): UseRecordsResult {
  const {
    databaseId,
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
  } = params;

  // Validate required parameters
  if (!databaseId || databaseId <= 0) {
    throw new Error('useRecords: Invalid database ID provided');
  }

  // Build search criteria for API call
  const searchCriteria = buildSearchCriteria(params);

  // Execute the query
  const queryResult = useQuery<DatabaseRecordsResponse, Error>({
    queryKey: buildQueryKey(params),
    queryFn: async (): Promise<DatabaseRecordsResponse> => {
      const response = await getRecords(databaseId, searchCriteria);

      // Apply any client-side filters if needed
      return applyClientSideFilters(response, params);
    },
    enabled: enabled && databaseId > 0,
    staleTime,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Extract data with defaults for loading/error states
  const records = queryResult.data?.records ?? [];
  const pagination = queryResult.data?.pagination ?? {
    page: params.page ?? DEFAULT_PAGE,
    perPage: params.perPage ?? DEFAULT_PER_PAGE,
    total: 0,
    totalPages: 0,
  };

  return {
    records,
    totalCount: pagination.total,
    hasMore: pagination.page < pagination.totalPages,
    currentPage: pagination.page,
    pageSize: pagination.perPage,
    totalPages: pagination.totalPages,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    isError: queryResult.isError,
    isSuccess: queryResult.isSuccess,
    error: queryResult.error,
    refetch: queryResult.refetch,
    queryResult,
  };
}

/**
 * useRecordsInfinite - React Query hook for infinite scroll pagination
 *
 * Fetches records using an infinite query pattern suitable for infinite
 * scroll implementations. Automatically manages page accumulation and
 * provides next page fetching capabilities.
 *
 * @param params - Configuration parameters for the infinite query
 * @returns UseRecordsInfiniteResult with accumulated records and pagination controls
 *
 * @example
 * ```typescript
 * // Basic infinite scroll
 * const {
 *   records,
 *   hasNextPage,
 *   fetchNextPage,
 *   isFetchingNextPage,
 * } = useRecordsInfinite({ databaseId: 123 });
 *
 * // Handle scroll to load more
 * const handleScroll = () => {
 *   if (hasNextPage && !isFetchingNextPage) {
 *     fetchNextPage();
 *   }
 * };
 *
 * // With filters
 * const { records, fetchNextPage } = useRecordsInfinite({
 *   databaseId: 123,
 *   search: 'keyword',
 *   approvalStatus: 'approved',
 *   perPage: 10,
 * });
 * ```
 */
export function useRecordsInfinite(
  params: UseRecordsInfiniteParams
): UseRecordsInfiniteResult {
  const {
    databaseId,
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    initialPageSize,
    perPage = initialPageSize ?? DEFAULT_PER_PAGE,
  } = params;

  // Validate required parameters
  if (!databaseId || databaseId <= 0) {
    throw new Error('useRecordsInfinite: Invalid database ID provided');
  }

  // Build base query key for infinite query
  const baseParams: UseRecordsParams = {
    ...params,
    page: 1, // Initial page for key generation
    perPage,
  };

  // Execute the infinite query
  const queryResult = useInfiniteQuery<DatabaseRecordsResponse, Error>({
    queryKey: [
      ...dataQueryKeys.recordsByDatabase(databaseId, buildSearchCriteria(baseParams)),
      'infinite',
    ],
    queryFn: async ({ pageParam = 1 }): Promise<DatabaseRecordsResponse> => {
      const searchCriteria = buildSearchCriteria({
        ...params,
        page: pageParam as number,
        perPage,
      });

      const response = await getRecords(databaseId, searchCriteria);

      // Apply any client-side filters if needed
      return applyClientSideFilters(response, params);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage): number | undefined => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    getPreviousPageParam: (firstPage): number | undefined => {
      const { page } = firstPage.pagination;
      return page > 1 ? page - 1 : undefined;
    },
    enabled: enabled && databaseId > 0,
    staleTime,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Accumulate records from all pages
  const records: DatabaseRecord[] = [];
  let totalCount = 0;

  if (queryResult.data?.pages) {
    queryResult.data.pages.forEach((page) => {
      records.push(...page.records);
      totalCount = page.pagination.total; // Total is consistent across pages
    });
  }

  return {
    records,
    totalCount,
    hasNextPage: queryResult.hasNextPage ?? false,
    isFetchingNextPage: queryResult.isFetchingNextPage,
    fetchNextPage: queryResult.fetchNextPage,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    isError: queryResult.isError,
    isSuccess: queryResult.isSuccess,
    error: queryResult.error,
    refetch: queryResult.refetch,
    queryResult,
  };
}

// ============================================================================
// Export
// ============================================================================

export default useRecords;
