/**
 * Custom React Query hook for fetching and managing H5P activity user attempts data.
 * 
 * This hook provides comprehensive data fetching for H5P activity attempts with support for:
 * - Filtering by user IDs and name initials
 * - Pagination with configurable page size
 * - Sorting by attempt number, timestamp, or score
 * - Automatic caching and background refetching
 * - Both teacher (all attempts) and student (own attempts) views
 * 
 * @module useH5PAttempts
 * @packageDocumentation
 */

import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Represents a single H5P activity attempt with complete metadata.
 */
interface H5PAttempt {
  /** Unique attempt identifier */
  id: number;
  /** H5P activity instance ID */
  h5pactivityid: number;
  /** User ID who made the attempt */
  userid: number;
  /** Unix timestamp when attempt was created */
  timecreated: number;
  /** Unix timestamp when attempt was last modified */
  timemodified: number;
  /** Attempt number (1, 2, 3, etc.) */
  attempt: number;
  /** Raw score achieved */
  rawscore: number;
  /** Maximum possible score */
  maxscore: number;
  /** Duration of attempt in seconds */
  duration: number;
  /** Completion status (0 = incomplete, 1 = complete) - optional */
  completion?: number;
  /** Success status (0 = failed, 1 = passed) - optional */
  success?: number;
  /** Scaled score (0.0 to 1.0) */
  scaled: number;
}

/**
 * Scored attempts information with grading metadata.
 */
interface ScoredAttempts {
  /** Title of the scored attempts section */
  title: string;
  /** Grading method used (e.g., "highest", "average", "first", "last") */
  grademethod: string;
  /** Array of attempts that contributed to the grade */
  attempts: H5PAttempt[];
}

/**
 * User's complete attempts data including all attempts and scored information.
 */
interface UserAttempts {
  /** User ID */
  userid: number;
  /** Array of all attempts made by the user */
  attempts: H5PAttempt[];
  /** Scored attempts information - optional, present when grading is configured */
  scored?: ScoredAttempts;
}

/**
 * Warning information from API response.
 */
interface ApiWarning {
  /** Type of item that caused the warning */
  item: string;
  /** ID of the item that caused the warning */
  itemid: number;
  /** Warning code */
  warningcode: string;
  /** Human-readable warning message */
  message: string;
}

/**
 * Complete API response structure for H5P attempts.
 */
interface H5PAttemptsResponse {
  /** H5P activity ID */
  activityid: number;
  /** Array of user attempts data */
  usersattempts: UserAttempts[];
  /** Total number of attempts across all users - present in get_user_attempts */
  totalattempts?: number;
  /** Array of warnings encountered during data retrieval */
  warnings: ApiWarning[];
}

/**
 * Sort field options for attempts data.
 */
type SortField = 'attempt' | 'timecreated' | 'score' | 'firstname' | 'lastname' | 'id';

/**
 * Sort order options.
 */
type SortOrder = 'asc' | 'desc';

/**
 * Parameters for the useH5PAttempts hook.
 */
interface AttemptsQueryParams {
  /** H5P activity instance ID (required) */
  activityId: number | null | undefined;
  /** 
   * Array of user IDs to filter attempts by.
   * If empty or undefined, returns current user's attempts only.
   * Used in teacher view to fetch specific users' attempts.
   */
  userIds?: number[];
  /** 
   * Current page number for pagination (1-based).
   * @default 1
   */
  page?: number;
  /** 
   * Number of items per page.
   * @default 20
   */
  perPage?: number;
  /** 
   * Field to sort by.
   * @default 'timecreated'
   */
  sortBy?: SortField;
  /** 
   * Sort order direction.
   * @default 'desc'
   */
  sortOrder?: SortOrder;
  /** 
   * Filter users by first name initial (single letter).
   * Used for alphabetical filtering in large participant lists.
   */
  firstInitial?: string;
  /** 
   * Filter users by last name initial (single letter).
   * Used for alphabetical filtering in large participant lists.
   */
  lastInitial?: string;
  /**
   * Whether to automatically fetch data when the hook is mounted.
   * Set to false to prevent fetching until manually triggered.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Return value from the useH5PAttempts hook.
 */
interface AttemptsQueryReturn {
  /** Array of user attempts data */
  attempts: UserAttempts[];
  /** Total number of attempts across all users */
  totalAttempts: number;
  /** H5P activity ID from the response */
  activityId: number | null;
  /** Array of warnings from the API */
  warnings: ApiWarning[];
  /** Whether initial data is being loaded */
  isLoading: boolean;
  /** Whether there was an error fetching data */
  isError: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Whether data is being fetched (including background refetch) */
  isFetching: boolean;
  /** Function to manually refetch data */
  refetch: () => Promise<UseQueryResult<H5PAttemptsResponse, Error>>;
  /** Whether the query is enabled */
  isEnabled: boolean;
}

/**
 * API error response structure.
 */
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * API success response structure.
 */
interface ApiSuccessResponse {
  success: true;
  data: H5PAttemptsResponse;
}

type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

// ============================================================================
// API Client Function
// ============================================================================

/**
 * Fetches H5P attempts data from the API.
 * 
 * This function makes HTTP requests to either:
 * - GET /api/v1/h5p/attempts - for fetching specific user(s) attempts
 * - GET /api/v1/h5p/user-attempts - for fetching all enrolled users' attempts with pagination
 * 
 * @param activityId - The H5P activity instance ID
 * @param options - Query options including filters, pagination, and sorting
 * @returns Promise resolving to the attempts data
 * @throws {Error} When the API request fails or returns an error response
 */
async function fetchH5PAttempts(
  activityId: number,
  options: Omit<AttemptsQueryParams, 'activityId' | 'enabled'>
): Promise<H5PAttemptsResponse> {
  const {
    userIds = [],
    page = 1,
    perPage = 20,
    sortBy = 'timecreated',
    sortOrder = 'desc',
    firstInitial = '',
    lastInitial = '',
  } = options;

  // Determine which endpoint to use based on whether we're fetching specific users or all users
  const useUserAttemptsEndpoint = !userIds || userIds.length === 0 || 
    firstInitial || lastInitial || page > 1;

  let url: string;
  let body: Record<string, unknown>;

  if (useUserAttemptsEndpoint) {
    // Use get_user_attempts endpoint for paginated list of all enrolled users
    url = '/api/v1/h5p/user-attempts';
    
    // Convert sortBy to SQL-style sort order (e.g., "firstname ASC")
    const sortField = sortBy === 'score' ? 'id' : sortBy; // score sorting not directly supported in SQL
    const sortOrderParam = `${sortField} ${sortOrder.toUpperCase()}`;
    
    body = {
      h5pactivityid: activityId,
      sortorder: sortOrderParam,
      page: page - 1, // API uses 0-based page numbering
      perpage: perPage,
      firstinitial: firstInitial,
      lastinitial: lastInitial,
    };
  } else {
    // Use get_attempts endpoint for specific user IDs
    url = '/api/v1/h5p/attempts';
    body = {
      h5pactivityid: activityId,
      userids: userIds,
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // JWT token will be automatically included by API client interceptors
      },
      credentials: 'include', // Include cookies for authentication
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Handle HTTP error responses
      if (response.status === 403) {
        throw new Error('Permission denied: You do not have access to view these attempts');
      }
      if (response.status === 404) {
        throw new Error('H5P activity not found');
      }
      if (response.status === 401) {
        throw new Error('Authentication required: Please log in to view attempts');
      }
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const apiResponse: ApiResponse = await response.json();

    if (!apiResponse.success) {
      // Handle API error responses
      const errorMessage = apiResponse.error.message || 'Failed to fetch H5P attempts';
      throw new Error(errorMessage);
    }

    // Apply client-side sorting if needed (for score sorting)
    if (sortBy === 'score' && apiResponse.data.usersattempts) {
      apiResponse.data.usersattempts.forEach((userAttempt) => {
        userAttempt.attempts.sort((a, b) => {
          const scoreA = a.scaled;
          const scoreB = b.scaled;
          return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
        });
      });
    }

    return apiResponse.data;
  } catch (error) {
    // Handle network errors and other exceptions
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred while fetching H5P attempts');
  }
}

// ============================================================================
// Custom Hook
// ============================================================================

/**
 * Custom React Query hook for fetching and managing H5P activity attempts data.
 * 
 * This hook provides a complete solution for displaying H5P activity attempts with:
 * - Automatic caching with 3-minute stale time
 * - Background refetching on window focus
 * - Support for both teacher and student views
 * - Comprehensive filtering and sorting options
 * - Pagination support for large datasets
 * - Error handling and loading states
 * 
 * @example
 * // Teacher view - fetch all attempts for an activity
 * const {
 *   attempts,
 *   totalAttempts,
 *   isLoading,
 *   isError,
 *   error
 * } = useH5PAttempts({
 *   activityId: 123,
 *   page: 1,
 *   perPage: 20,
 *   sortBy: 'timecreated',
 *   sortOrder: 'desc'
 * });
 * 
 * @example
 * // Student view - fetch only current user's attempts
 * const {
 *   attempts,
 *   isLoading
 * } = useH5PAttempts({
 *   activityId: 123,
 *   userIds: [currentUserId]
 * });
 * 
 * @example
 * // Filter by name initials (teacher view)
 * const {
 *   attempts,
 *   totalAttempts
 * } = useH5PAttempts({
 *   activityId: 123,
 *   firstInitial: 'J',
 *   lastInitial: 'D'
 * });
 * 
 * @param params - Query parameters including activityId and optional filters
 * @returns Object containing attempts data, loading states, and refetch function
 */
export default function useH5PAttempts(params: AttemptsQueryParams): AttemptsQueryReturn {
  const {
    activityId,
    userIds = [],
    page = 1,
    perPage = 20,
    sortBy = 'timecreated',
    sortOrder = 'desc',
    firstInitial = '',
    lastInitial = '',
    enabled = true,
  } = params;

  const queryClient = useQueryClient();

  // Construct query key with all parameters for proper cache isolation
  const queryKey = [
    'h5pAttempts',
    activityId,
    userIds.sort().join(','), // Sort user IDs for consistent cache key
    page,
    perPage,
    sortBy,
    sortOrder,
    firstInitial,
    lastInitial,
  ];

  // Configure and execute the query
  const query = useQuery<H5PAttemptsResponse, Error>({
    queryKey,
    queryFn: async () => {
      if (!activityId) {
        throw new Error('Activity ID is required to fetch attempts');
      }
      return fetchH5PAttempts(activityId, {
        userIds,
        page,
        perPage,
        sortBy,
        sortOrder,
        firstInitial,
        lastInitial,
      });
    },
    // Only enable query if activityId is provided and enabled flag is true
    enabled: enabled && !!activityId,
    // Cache data for 3 minutes (180 seconds)
    // Attempts data doesn't change frequently, so moderate caching is appropriate
    staleTime: 3 * 60 * 1000, // 3 minutes in milliseconds
    // Refetch when user returns to the tab to ensure data freshness
    refetchOnWindowFocus: true,
    // Retry failed requests twice with exponential backoff
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Keep previous data while fetching new data to prevent UI flickering
    placeholderData: (previousData) => previousData,
  });

  // Helper function to invalidate attempts cache
  // This can be called after mutations that affect attempts (e.g., new attempt submission)
  const invalidateAttemptsCache = () => {
    queryClient.invalidateQueries({
      queryKey: ['h5pAttempts', activityId],
    });
  };

  // Extract and transform data from query result
  const attempts = query.data?.usersattempts || [];
  const totalAttempts = query.data?.totalattempts || 0;
  const activityIdFromResponse = query.data?.activityid || null;
  const warnings = query.data?.warnings || [];

  return {
    attempts,
    totalAttempts,
    activityId: activityIdFromResponse,
    warnings,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch as () => Promise<UseQueryResult<H5PAttemptsResponse, Error>>,
    isEnabled: enabled && !!activityId,
  };
}

/**
 * Hook for invalidating H5P attempts cache.
 * 
 * Use this hook when you need to manually invalidate the attempts cache,
 * for example after a new attempt is submitted or an attempt is deleted.
 * 
 * @example
 * const invalidateAttempts = useInvalidateH5PAttempts();
 * 
 * // After submitting a new attempt
 * await submitAttempt(data);
 * invalidateAttempts(activityId);
 * 
 * @returns Function to invalidate attempts cache for a given activity
 */
export function useInvalidateH5PAttempts() {
  const queryClient = useQueryClient();

  return (activityId: number | null | undefined) => {
    if (activityId) {
      queryClient.invalidateQueries({
        queryKey: ['h5pAttempts', activityId],
      });
    }
  };
}

/**
 * Hook for prefetching H5P attempts data.
 * 
 * Use this hook to prefetch attempts data before it's needed,
 * for example when hovering over a link or button that will show attempts.
 * 
 * @example
 * const prefetchAttempts = usePrefetchH5PAttempts();
 * 
 * <button
 *   onMouseEnter={() => prefetchAttempts({ activityId: 123 })}
 *   onClick={() => navigate('/h5p/123/attempts')}
 * >
 *   View Attempts
 * </button>
 * 
 * @returns Function to prefetch attempts data
 */
export function usePrefetchH5PAttempts() {
  const queryClient = useQueryClient();

  return async (params: AttemptsQueryParams) => {
    const {
      activityId,
      userIds = [],
      page = 1,
      perPage = 20,
      sortBy = 'timecreated',
      sortOrder = 'desc',
      firstInitial = '',
      lastInitial = '',
    } = params;

    if (!activityId) {
      return;
    }

    const queryKey = [
      'h5pAttempts',
      activityId,
      userIds.sort().join(','),
      page,
      perPage,
      sortBy,
      sortOrder,
      firstInitial,
      lastInitial,
    ];

    await queryClient.prefetchQuery({
      queryKey,
      queryFn: () => fetchH5PAttempts(activityId, {
        userIds,
        page,
        perPage,
        sortBy,
        sortOrder,
        firstInitial,
        lastInitial,
      }),
      staleTime: 3 * 60 * 1000,
    });
  };
}
