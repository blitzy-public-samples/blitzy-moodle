/**
 * H5P Activity Results React Query Hooks
 *
 * Provides React Query hooks for fetching and managing H5P activity user attempts
 * and detailed results data. Supports pagination, sorting, filtering, automatic
 * caching with 3-minute stale time, background refetching, and optimistic updates.
 *
 * These hooks wrap the PHP external functions:
 * - mod_h5pactivity\external\get_results - For detailed attempt results
 * - mod_h5pactivity\external\get_user_attempts - For paginated user attempts list
 *
 * @module features/activities/h5pactivity/hooks/useH5PResults
 * @see public/mod/h5pactivity/classes/external/get_results.php
 * @see public/mod/h5pactivity/classes/external/get_user_attempts.php
 *
 * @example
 * ```tsx
 * // Get results for an H5P activity with automatic caching
 * function H5PResultsView({ activityId }: { activityId: number }) {
 *   const {
 *     results,
 *     attempts,
 *     isLoading,
 *     isError,
 *     error,
 *     refetch
 *   } = useH5PResults(activityId, { attemptIds: [1, 2, 3] });
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (isError) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       {attempts.map(attempt => (
 *         <AttemptCard key={attempt.id} attempt={attempt} />
 *       ))}
 *     </div>
 *   );
 * }
 *
 * // Get results for a single attempt
 * function AttemptDetailView({ attemptId }: { attemptId: number }) {
 *   const { data, isLoading } = useH5PAttemptResults(attemptId);
 *   // ...
 * }
 * ```
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import {
  getAttemptResults,
  getResults,
  getUserAttempts,
} from '../api/h5pApi';

import type {
  H5PResult,
  H5PAttemptWithResults,
  H5PUserAttempts,
} from '../types/h5p.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default stale time for H5P results data (3 minutes)
 * Results don't change frequently, so a longer stale time is appropriate
 */
const DEFAULT_STALE_TIME = 3 * 60 * 1000; // 3 minutes

/**
 * Default garbage collection time for cached results (10 minutes)
 */
const DEFAULT_GC_TIME = 10 * 60 * 1000; // 10 minutes

/**
 * Query key factory for H5P results queries
 * Ensures consistent key structure across all results-related queries
 */
export const h5pResultsQueryKeys = {
  /** Base key for all H5P results queries */
  all: ['h5pResults'] as const,
  
  /** Key for activity-level results */
  activity: (activityId: number) => [...h5pResultsQueryKeys.all, 'activity', activityId] as const,
  
  /** Key for results with specific attempt IDs */
  results: (activityId: number, attemptIds?: number[]) =>
    [...h5pResultsQueryKeys.activity(activityId), 'results', { attemptIds }] as const,
  
  /** Key for paginated user attempts */
  userAttempts: (activityId: number, options?: UseH5PUserAttemptsOptions) =>
    [...h5pResultsQueryKeys.activity(activityId), 'userAttempts', options] as const,
  
  /** Key for single attempt results */
  attemptResults: (attemptId: number) =>
    [...h5pResultsQueryKeys.all, 'attempt', attemptId, 'results'] as const,
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Options for the useH5PResults hook
 */
export interface UseH5PResultsOptions {
  /**
   * Specific attempt IDs to fetch results for
   * If omitted, fetches all accessible attempts for the current user
   */
  attemptIds?: number[];

  /**
   * Whether the query should be enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Custom stale time in milliseconds
   * @default 180000 (3 minutes)
   */
  staleTime?: number;

  /**
   * Whether to refetch when window regains focus
   * @default true
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Whether to refetch when network reconnects
   * @default true
   */
  refetchOnReconnect?: boolean;
}

/**
 * Options for the useH5PUserAttempts hook
 */
export interface UseH5PUserAttemptsOptions {
  /**
   * Sort order for results
   * @default 'id'
   */
  sortorder?: 'firstname' | 'lastname' | 'id' | 'attempts' | 'timecreated';

  /**
   * Page number (0-based)
   * @default 0
   */
  page?: number;

  /**
   * Number of results per page
   * @default 20
   */
  perPage?: number;

  /**
   * Filter by first name starting letter
   */
  firstInitial?: string;

  /**
   * Filter by last name starting letter
   */
  lastInitial?: string;

  /**
   * Whether the query should be enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Custom stale time in milliseconds
   * @default 180000 (3 minutes)
   */
  staleTime?: number;
}

/**
 * Options for the useH5PAttemptResults hook
 */
export interface UseH5PAttemptResultsOptions {
  /**
   * Whether the query should be enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Custom stale time in milliseconds
   * @default 180000 (3 minutes)
   */
  staleTime?: number;

  /**
   * Whether to refetch when window regains focus
   * @default true
   */
  refetchOnWindowFocus?: boolean;
}

/**
 * Return type for useH5PResults hook with additional helper methods
 */
export interface UseH5PResultsReturn {
  /**
   * Raw API response data with activity ID, attempts, and warnings
   */
  data: H5PResultsData | undefined;

  /**
   * Array of attempts with their detailed results (convenience accessor)
   */
  attempts: H5PAttemptWithResults[];

  /**
   * Total number of attempts retrieved
   */
  totalAttempts: number;

  /**
   * Activity ID the results belong to
   */
  activityId: number | undefined;

  /**
   * Any warnings returned by the API
   */
  warnings: H5PResultWarning[];

  /**
   * Whether the query is currently loading
   */
  isLoading: boolean;

  /**
   * Whether the query encountered an error
   */
  isError: boolean;

  /**
   * Error object if query failed
   */
  error: Error | null;

  /**
   * Whether data has been fetched successfully at least once
   */
  isSuccess: boolean;

  /**
   * Whether data is being fetched in the background
   */
  isFetching: boolean;

  /**
   * Whether the data is stale and will be refetched on next trigger
   */
  isStale: boolean;

  /**
   * Function to manually refetch the results
   */
  refetch: () => Promise<void>;

  /**
   * Function to invalidate the cache and force a refetch
   */
  invalidate: () => Promise<void>;

  /**
   * Helper to get results for a specific attempt by ID
   */
  getAttemptById: (attemptId: number) => H5PAttemptWithResults | undefined;

  /**
   * Helper to calculate average score across all attempts
   */
  getAverageScore: () => number | null;

  /**
   * Helper to get the highest scoring attempt
   */
  getHighestScoringAttempt: () => H5PAttemptWithResults | undefined;

  /**
   * Helper to get the most recent attempt
   */
  getMostRecentAttempt: () => H5PAttemptWithResults | undefined;
}

/**
 * Return type for useH5PUserAttempts hook
 */
export interface UseH5PUserAttemptsReturn {
  /**
   * Raw API response data
   */
  data: H5PUserAttemptsData | undefined;

  /**
   * Array of user attempts with user info (convenience accessor)
   */
  usersAttempts: H5PUserAttempts[];

  /**
   * Total number of attempts across all users
   */
  totalAttempts: number;

  /**
   * Activity ID the attempts belong to
   */
  activityId: number | undefined;

  /**
   * Any warnings returned by the API
   */
  warnings: H5PResultWarning[];

  /**
   * Whether the query is currently loading
   */
  isLoading: boolean;

  /**
   * Whether the query encountered an error
   */
  isError: boolean;

  /**
   * Error object if query failed
   */
  error: Error | null;

  /**
   * Whether data has been fetched successfully at least once
   */
  isSuccess: boolean;

  /**
   * Whether data is being fetched in the background
   */
  isFetching: boolean;

  /**
   * Function to manually refetch the attempts
   */
  refetch: () => Promise<void>;

  /**
   * Function to invalidate the cache and force a refetch
   */
  invalidate: () => Promise<void>;
}

/**
 * Return type for useH5PAttemptResults hook
 */
export interface UseH5PAttemptResultsReturn {
  /**
   * Attempt data with detailed results
   */
  data: H5PAttemptWithResults | undefined;

  /**
   * Array of individual interaction results
   */
  results: H5PResult[];

  /**
   * Attempt score information
   */
  score: {
    raw: number;
    max: number;
    scaled: number;
    percentage: number;
  } | null;

  /**
   * Whether the attempt was successful (passed)
   */
  success: boolean | null;

  /**
   * Whether the attempt is complete
   */
  completion: boolean | null;

  /**
   * Duration of the attempt in seconds
   */
  duration: number | null;

  /**
   * Whether the query is currently loading
   */
  isLoading: boolean;

  /**
   * Whether the query encountered an error
   */
  isError: boolean;

  /**
   * Error object if query failed
   */
  error: Error | null;

  /**
   * Whether data has been fetched successfully at least once
   */
  isSuccess: boolean;

  /**
   * Whether data is being fetched in the background
   */
  isFetching: boolean;

  /**
   * Function to manually refetch the results
   */
  refetch: () => Promise<void>;

  /**
   * Function to invalidate the cache and force a refetch
   */
  invalidate: () => Promise<void>;
}

/**
 * Internal data structure for H5P results response
 */
interface H5PResultsData {
  activityid: number;
  attempts: H5PAttemptWithResults[];
  warnings?: H5PResultWarning[];
}

/**
 * Internal data structure for H5P user attempts response
 */
interface H5PUserAttemptsData {
  activityid: number;
  usersattempts: H5PUserAttempts[];
  totalattempts?: number;
  warnings?: H5PResultWarning[];
}

/**
 * Warning structure from API responses
 */
interface H5PResultWarning {
  item?: string;
  itemid?: number;
  warningcode: string;
  message: string;
}

// ============================================================================
// MAIN HOOKS
// ============================================================================

/**
 * Hook for fetching H5P activity results with attempts and detailed xAPI data
 *
 * Provides comprehensive data fetching for H5P activity results including:
 * - Automatic caching with 3-minute stale time
 * - Background refetching when window regains focus
 * - Optimistic updates support through query client
 * - Helper methods for common result calculations
 *
 * @param activityId - H5P activity ID to fetch results for
 * @param options - Configuration options for the query
 * @returns Object containing results data, loading states, and helper methods
 *
 * @example
 * ```tsx
 * const {
 *   attempts,
 *   isLoading,
 *   getHighestScoringAttempt,
 *   getAverageScore
 * } = useH5PResults(123, { attemptIds: [1, 2, 3] });
 *
 * if (!isLoading) {
 *   console.log('Highest score:', getHighestScoringAttempt()?.rawscore);
 *   console.log('Average score:', getAverageScore());
 * }
 * ```
 */
export function useH5PResults(
  activityId: number,
  options: UseH5PResultsOptions = {}
): UseH5PResultsReturn {
  const queryClient = useQueryClient();

  const {
    attemptIds,
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    refetchOnWindowFocus = true,
    refetchOnReconnect = true,
  } = options;

  // Validate activity ID
  const isValidActivityId = Number.isInteger(activityId) && activityId > 0;

  const queryResult = useQuery<H5PResultsData, Error>({
    queryKey: h5pResultsQueryKeys.results(activityId, attemptIds),
    queryFn: async (): Promise<H5PResultsData> => {
      if (!isValidActivityId) {
        throw new Error(`Invalid activity ID: ${activityId}`);
      }

      const response = await getResults(activityId, attemptIds);

      // Transform the API response to match our internal structure
      return {
        activityid: response.activityid,
        attempts: response.attempts.map(attempt => ({
          ...attempt,
          results: attempt.results || [],
        })) as H5PAttemptWithResults[],
        warnings: response.warnings,
      };
    },
    enabled: enabled && isValidActivityId,
    staleTime,
    gcTime: DEFAULT_GC_TIME,
    refetchOnWindowFocus,
    refetchOnReconnect,
  });

  // Extract attempts from data with fallback to empty array
  const attempts: H5PAttemptWithResults[] = queryResult.data?.attempts ?? [];
  const warnings: H5PResultWarning[] = queryResult.data?.warnings ?? [];

  // Helper functions
  const getAttemptById = (attemptId: number): H5PAttemptWithResults | undefined => {
    return attempts.find(attempt => attempt.id === attemptId);
  };

  const getAverageScore = (): number | null => {
    if (attempts.length === 0) return null;

    const validAttempts = attempts.filter(a => a.maxscore > 0);
    if (validAttempts.length === 0) return null;

    const totalScaled = validAttempts.reduce((sum, a) => sum + (a.scaled || 0), 0);
    return totalScaled / validAttempts.length;
  };

  const getHighestScoringAttempt = (): H5PAttemptWithResults | undefined => {
    if (attempts.length === 0) return undefined;

    // Use first attempt as initial value (safe since we checked length > 0)
    const firstAttempt = attempts[0]!;
    return attempts.reduce((highest, current) => {
      const highestScaled = highest.scaled || 0;
      const currentScaled = current.scaled || 0;
      return currentScaled > highestScaled ? current : highest;
    }, firstAttempt);
  };

  const getMostRecentAttempt = (): H5PAttemptWithResults | undefined => {
    if (attempts.length === 0) return undefined;

    // Use first attempt as initial value (safe since we checked length > 0)
    const firstAttempt = attempts[0]!;
    return attempts.reduce((mostRecent, current) => {
      return current.timemodified > mostRecent.timemodified ? current : mostRecent;
    }, firstAttempt);
  };

  const refetch = async (): Promise<void> => {
    await queryResult.refetch();
  };

  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: h5pResultsQueryKeys.activity(activityId),
    });
  };

  return {
    data: queryResult.data,
    attempts,
    totalAttempts: attempts.length,
    activityId: queryResult.data?.activityid,
    warnings,
    isLoading: queryResult.isLoading,
    isError: queryResult.isError,
    error: queryResult.error,
    isSuccess: queryResult.isSuccess,
    isFetching: queryResult.isFetching,
    isStale: queryResult.isStale,
    refetch,
    invalidate,
    getAttemptById,
    getAverageScore,
    getHighestScoringAttempt,
    getMostRecentAttempt,
  };
}

/**
 * Hook for fetching paginated user attempts for an H5P activity
 *
 * Designed for teacher/grader views showing all user attempts with:
 * - Pagination support
 * - Sorting by various fields
 * - Filtering by user name initials
 * - Automatic caching and background updates
 *
 * @param activityId - H5P activity ID to fetch attempts for
 * @param options - Pagination, sorting, and filtering options
 * @returns Object containing user attempts data and loading states
 *
 * @example
 * ```tsx
 * const {
 *   usersAttempts,
 *   totalAttempts,
 *   isLoading,
 *   refetch
 * } = useH5PUserAttempts(123, {
 *   sortorder: 'lastname',
 *   page: 0,
 *   perPage: 25,
 *   firstInitial: 'A'
 * });
 *
 * console.log(`Showing ${usersAttempts.length} of ${totalAttempts} users`);
 * ```
 */
export function useH5PUserAttempts(
  activityId: number,
  options: UseH5PUserAttemptsOptions = {}
): UseH5PUserAttemptsReturn {
  const queryClient = useQueryClient();

  const {
    sortorder,
    page,
    perPage,
    firstInitial,
    lastInitial,
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
  } = options;

  // Validate activity ID
  const isValidActivityId = Number.isInteger(activityId) && activityId > 0;

  // Build options object for API call
  const apiOptions = {
    sortorder,
    page,
    perPage,
    firstInitial,
    lastInitial,
  };

  const queryResult = useQuery<H5PUserAttemptsData, Error>({
    queryKey: h5pResultsQueryKeys.userAttempts(activityId, options),
    queryFn: async (): Promise<H5PUserAttemptsData> => {
      if (!isValidActivityId) {
        throw new Error(`Invalid activity ID: ${activityId}`);
      }

      const response = await getUserAttempts(activityId, apiOptions);

      return {
        activityid: response.activityid,
        usersattempts: response.usersattempts,
        totalattempts: response.totalattempts,
        warnings: response.warnings,
      };
    },
    enabled: enabled && isValidActivityId,
    staleTime,
    gcTime: DEFAULT_GC_TIME,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const usersAttempts: H5PUserAttempts[] = queryResult.data?.usersattempts ?? [];
  const warnings: H5PResultWarning[] = queryResult.data?.warnings ?? [];

  const refetch = async (): Promise<void> => {
    await queryResult.refetch();
  };

  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: h5pResultsQueryKeys.activity(activityId),
    });
  };

  return {
    data: queryResult.data,
    usersAttempts,
    totalAttempts: queryResult.data?.totalattempts ?? usersAttempts.length,
    activityId: queryResult.data?.activityid,
    warnings,
    isLoading: queryResult.isLoading,
    isError: queryResult.isError,
    error: queryResult.error,
    isSuccess: queryResult.isSuccess,
    isFetching: queryResult.isFetching,
    refetch,
    invalidate,
  };
}

/**
 * Hook for fetching detailed results for a single H5P attempt
 *
 * Provides detailed xAPI interaction data for reviewing a specific attempt:
 * - Individual question/interaction results
 * - Score breakdowns
 * - Completion and success status
 * - Duration tracking
 *
 * @param attemptId - H5P attempt ID to fetch results for
 * @param options - Configuration options for the query
 * @returns Object containing attempt results and computed score data
 *
 * @example
 * ```tsx
 * const {
 *   results,
 *   score,
 *   success,
 *   isLoading
 * } = useH5PAttemptResults(456);
 *
 * if (!isLoading && score) {
 *   console.log(`Score: ${score.raw}/${score.max} (${score.percentage}%)`);
 *   console.log(`Passed: ${success ? 'Yes' : 'No'}`);
 * }
 * ```
 */
export function useH5PAttemptResults(
  attemptId: number,
  options: UseH5PAttemptResultsOptions = {}
): UseH5PAttemptResultsReturn {
  const queryClient = useQueryClient();

  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    refetchOnWindowFocus = true,
  } = options;

  // Validate attempt ID
  const isValidAttemptId = Number.isInteger(attemptId) && attemptId > 0;

  const queryResult = useQuery<H5PAttemptWithResults, Error>({
    queryKey: h5pResultsQueryKeys.attemptResults(attemptId),
    queryFn: async (): Promise<H5PAttemptWithResults> => {
      if (!isValidAttemptId) {
        throw new Error(`Invalid attempt ID: ${attemptId}`);
      }

      const response = await getAttemptResults(attemptId);

      // Transform to include results array
      return {
        ...response,
        results: response.results || [],
      } as H5PAttemptWithResults;
    },
    enabled: enabled && isValidAttemptId,
    staleTime,
    gcTime: DEFAULT_GC_TIME,
    refetchOnWindowFocus,
    refetchOnReconnect: true,
  });

  // Extract data with fallbacks
  const data = queryResult.data;
  const results: H5PResult[] = data?.results ?? [];

  // Compute score object
  const score = data ? {
    raw: data.rawscore,
    max: data.maxscore,
    scaled: data.scaled,
    percentage: data.maxscore > 0 ? Math.round((data.rawscore / data.maxscore) * 100) : 0,
  } : null;

  // Compute success/completion as booleans (Moodle uses 1/0/null)
  const success = data?.success !== undefined && data?.success !== null
    ? data.success === 1
    : null;

  const completion = data?.completion !== undefined && data?.completion !== null
    ? data.completion === 1
    : null;

  const duration = data?.duration ?? null;

  const refetch = async (): Promise<void> => {
    await queryResult.refetch();
  };

  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: h5pResultsQueryKeys.attemptResults(attemptId),
    });
  };

  return {
    data,
    results,
    score,
    success,
    completion,
    duration,
    isLoading: queryResult.isLoading,
    isError: queryResult.isError,
    error: queryResult.error,
    isSuccess: queryResult.isSuccess,
    isFetching: queryResult.isFetching,
    refetch,
    invalidate,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Invalidate all H5P results caches for an activity
 *
 * Use this after submitting a new attempt or when data needs to be refreshed.
 * Triggers a refetch of all results-related queries for the activity.
 *
 * @param queryClient - React Query client instance
 * @param activityId - H5P activity ID to invalidate caches for
 *
 * @example
 * ```tsx
 * const queryClient = useQueryClient();
 *
 * // After a new attempt is submitted
 * await submitAttempt(activityId, attemptData);
 * await invalidateH5PResultsCache(queryClient, activityId);
 * ```
 */
export async function invalidateH5PResultsCache(
  queryClient: QueryClient,
  activityId: number
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: h5pResultsQueryKeys.activity(activityId),
  });
}

/**
 * Prefetch H5P results for an activity
 *
 * Use this to preload results data before navigating to results view.
 * Improves perceived performance by having data ready when needed.
 *
 * @param queryClient - React Query client instance
 * @param activityId - H5P activity ID to prefetch results for
 * @param attemptIds - Optional specific attempt IDs to prefetch
 *
 * @example
 * ```tsx
 * const queryClient = useQueryClient();
 *
 * // Prefetch on hover
 * const handleHover = () => {
 *   prefetchH5PResults(queryClient, activityId);
 * };
 * ```
 */
export async function prefetchH5PResults(
  queryClient: QueryClient,
  activityId: number,
  attemptIds?: number[]
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: h5pResultsQueryKeys.results(activityId, attemptIds),
    queryFn: async () => {
      const response = await getResults(activityId, attemptIds);
      return {
        activityid: response.activityid,
        attempts: response.attempts.map(attempt => ({
          ...attempt,
          results: attempt.results || [],
        })),
        warnings: response.warnings,
      };
    },
    staleTime: DEFAULT_STALE_TIME,
  });
}

/**
 * Prefetch single attempt results
 *
 * Use this to preload attempt details before viewing them.
 *
 * @param queryClient - React Query client instance
 * @param attemptId - Attempt ID to prefetch results for
 *
 * @example
 * ```tsx
 * const queryClient = useQueryClient();
 *
 * // Prefetch on row hover in attempts list
 * const handleRowHover = (attemptId: number) => {
 *   prefetchAttemptResults(queryClient, attemptId);
 * };
 * ```
 */
export async function prefetchAttemptResults(
  queryClient: QueryClient,
  attemptId: number
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: h5pResultsQueryKeys.attemptResults(attemptId),
    queryFn: async () => {
      const response = await getAttemptResults(attemptId);
      return {
        ...response,
        results: response.results || [],
      };
    },
    staleTime: DEFAULT_STALE_TIME,
  });
}

/**
 * Set optimistic results data in cache
 *
 * Use this for optimistic updates when submitting new attempts.
 * The cache will be updated immediately, then replaced with actual
 * data when the refetch completes.
 *
 * @param queryClient - React Query client instance
 * @param activityId - H5P activity ID
 * @param newAttempt - New attempt data to add optimistically
 *
 * @example
 * ```tsx
 * const queryClient = useQueryClient();
 *
 * // Optimistically add new attempt to results
 * const submitMutation = useMutation({
 *   mutationFn: submitH5PAttempt,
 *   onMutate: async (newAttempt) => {
 *     await setOptimisticResult(queryClient, activityId, newAttempt);
 *   },
 *   onSettled: () => {
 *     invalidateH5PResultsCache(queryClient, activityId);
 *   }
 * });
 * ```
 */
export async function setOptimisticResult(
  queryClient: QueryClient,
  activityId: number,
  newAttempt: Partial<H5PAttemptWithResults>
): Promise<H5PResultsData | undefined> {
  // Cancel any outgoing refetches to avoid overwriting optimistic update
  await queryClient.cancelQueries({
    queryKey: h5pResultsQueryKeys.activity(activityId),
  });

  // Get previous data for rollback
  const previousData = queryClient.getQueryData<H5PResultsData>(
    h5pResultsQueryKeys.results(activityId, undefined)
  );

  // Optimistically update the cache
  if (previousData) {
    const optimisticAttempt: H5PAttemptWithResults = {
      id: newAttempt.id ?? -Date.now(), // Temporary ID
      h5pactivityid: activityId,
      userid: newAttempt.userid ?? 0,
      timecreated: newAttempt.timecreated ?? Math.floor(Date.now() / 1000),
      timemodified: newAttempt.timemodified ?? Math.floor(Date.now() / 1000),
      attempt: newAttempt.attempt ?? previousData.attempts.length + 1,
      rawscore: newAttempt.rawscore ?? 0,
      maxscore: newAttempt.maxscore ?? 0,
      scaled: newAttempt.scaled ?? 0,
      duration: newAttempt.duration ?? 0,
      completion: newAttempt.completion ?? null,
      success: newAttempt.success ?? null,
      results: newAttempt.results ?? [],
    };

    queryClient.setQueryData<H5PResultsData>(
      h5pResultsQueryKeys.results(activityId, undefined),
      {
        ...previousData,
        attempts: [...previousData.attempts, optimisticAttempt],
      }
    );
  }

  return previousData;
}

/**
 * Rollback optimistic update on error
 *
 * Use this to restore previous data if an optimistic update fails.
 *
 * @param queryClient - React Query client instance
 * @param activityId - H5P activity ID
 * @param previousData - Previous data to restore
 */
export function rollbackOptimisticResult(
  queryClient: QueryClient,
  activityId: number,
  previousData: H5PResultsData | undefined
): void {
  if (previousData) {
    queryClient.setQueryData<H5PResultsData>(
      h5pResultsQueryKeys.results(activityId, undefined),
      previousData
    );
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default useH5PResults;
