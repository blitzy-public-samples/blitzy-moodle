/**
 * React Query Hook for Workshop Data Fetching
 *
 * This hook provides a complete interface for fetching workshop instance data
 * including workshop details, user plan with phase-specific tasks, current phase
 * information, and submissions list. It wraps API calls to the
 * GET /api/v1/workshops/{id} endpoint and provides cached, automatically-refetched
 * workshop data with loading and error states.
 *
 * Based on Moodle's workshop module implementation from:
 * - public/mod/workshop/view.php (lines 54-76 for workshop instantiation and user plan)
 * - public/mod/workshop/locallib.php (lines 3732-3804 for workshop_user_plan class)
 * - public/mod/workshop/lib.php for workshop data structures
 *
 * @module features/activities/workshop/hooks/useWorkshop
 */

import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import type {
  Workshop,
  WorkshopUserPlan,
  WorkshopSubmission,
  WorkshopPhase,
} from '@/features/activities/workshop/types/workshop.types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Complete workshop data returned from the API
 *
 * This interface represents the combined data structure returned from
 * GET /api/v1/workshops/{id} which aggregates:
 * - Workshop instance properties (from workshop class instantiation)
 * - User plan with phases and tasks (from workshop_user_plan class)
 * - List of submissions (from workshop->get_submissions())
 */
export interface WorkshopData {
  /**
   * Workshop instance containing configuration and settings
   * Includes properties: id, name, phase, useexamples, usepeerassessment,
   * useselfassessment, grade, gradinggrade, strategy, submissionstart,
   * submissionend, assessmentstart, assessmentend
   */
  workshop: Workshop;

  /**
   * User plan data structure containing phases array with tasks per phase
   * Based on workshop_user_plan class from locallib.php (lines 3732-3804)
   * Each phase contains title, tasks array, and active flag
   */
  userPlan: WorkshopUserPlan;

  /**
   * List of submissions in this workshop
   * Retrieved using workshop->get_submissions() method
   */
  submissions: WorkshopSubmission[];

  /**
   * Current active phase of the workshop
   * Values: PHASE_SETUP=10, PHASE_SUBMISSION=20, PHASE_ASSESSMENT=30,
   * PHASE_EVALUATION=40, PHASE_CLOSED=50
   */
  currentPhase: WorkshopPhase;

  /**
   * Title of the current active phase
   * Derived from userPlan.phases where active=true
   */
  currentPhaseTitle: string;
}

/**
 * Standard API response envelope for workshop data
 * Follows Moodle API response format with success flag and data payload
 */
interface WorkshopApiResponse {
  success: boolean;
  data: WorkshopData;
  meta?: {
    timestamp?: number;
  };
}

/**
 * Configuration options for the useWorkshop hook
 * Extends React Query options with workshop-specific settings
 */
export interface UseWorkshopOptions {
  /**
   * Whether the query should execute automatically
   * Set to false to defer fetching until explicitly triggered
   * @default true
   */
  enabled?: boolean;

  /**
   * Time in milliseconds that data is considered fresh
   * During this time, refetches won't occur automatically
   * @default 300000 (5 minutes)
   */
  staleTime?: number;

  /**
   * Time in milliseconds that unused/inactive cache data remains in memory
   * @default 600000 (10 minutes)
   */
  gcTime?: number;

  /**
   * Whether to refetch when the component mounts
   * @default true
   */
  refetchOnMount?: boolean | 'always';

  /**
   * Whether to refetch when the window regains focus
   * @default true
   */
  refetchOnWindowFocus?: boolean | 'always';

  /**
   * Callback function when data fetch is successful
   */
  onSuccess?: (data: WorkshopData) => void;

  /**
   * Callback function when data fetch fails
   */
  onError?: (error: Error) => void;
}

/**
 * Return type for the useWorkshop hook
 * Extends React Query result with workshop-specific helpers
 */
export interface UseWorkshopResult {
  /**
   * The fetched workshop data (undefined while loading)
   */
  data: WorkshopData | undefined;

  /**
   * Whether the query is currently fetching for the first time
   */
  isLoading: boolean;

  /**
   * Whether there was an error fetching the data
   */
  isError: boolean;

  /**
   * The error object if an error occurred
   */
  error: Error | null;

  /**
   * Whether the query has successfully fetched data at least once
   */
  isSuccess: boolean;

  /**
   * Whether the query is currently fetching (including background refetches)
   */
  isFetching: boolean;

  /**
   * Function to manually trigger a refetch of the data
   */
  refetch: () => Promise<UseQueryResult<WorkshopData, Error>>;

  /**
   * Convenient accessor for workshop instance data
   */
  workshop: Workshop | undefined;

  /**
   * Convenient accessor for user plan data
   */
  userPlan: WorkshopUserPlan | undefined;

  /**
   * Convenient accessor for submissions list
   */
  submissions: WorkshopSubmission[] | undefined;

  /**
   * Convenient accessor for current phase
   */
  currentPhase: WorkshopPhase | undefined;

  /**
   * Convenient accessor for current phase title
   */
  currentPhaseTitle: string | undefined;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default stale time for workshop data: 5 minutes
 * Workshop data changes infrequently within a session, so a longer stale time
 * reduces unnecessary refetches while still ensuring data freshness
 */
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Default garbage collection time: 10 minutes
 * Keeps inactive data in cache longer than stale time to support
 * quick navigation back to previously viewed workshops
 */
const DEFAULT_GC_TIME = 10 * 60 * 1000; // 10 minutes

/**
 * Query key prefix for workshop queries
 * Used for cache management and invalidation
 */
const WORKSHOP_QUERY_KEY = 'workshops';

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch workshop data from the API
 *
 * Makes a GET request to /api/v1/workshops/{workshopId} which wraps:
 * - Workshop class instantiation (view.php line 54)
 * - User plan generation (view.php line 76)
 * - Submissions list retrieval
 *
 * The API endpoint calls existing PHP functions and returns JSON-formatted
 * response without duplicating any business logic.
 *
 * @param workshopId - The workshop instance ID to fetch
 * @returns Promise resolving to the complete workshop data
 * @throws Error if the API request fails or returns an error response
 */
async function fetchWorkshop(workshopId: number): Promise<WorkshopData> {
  const response = await apiClient.get<WorkshopApiResponse>(
    `/workshops/${workshopId}`
  );

  // The apiClient interceptors handle authentication and error formatting
  // We just need to extract the data from the standard response envelope
  if (!response.data.success) {
    throw new Error('Failed to fetch workshop data');
  }

  return response.data.data;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React Query hook for fetching and managing workshop data
 *
 * Provides a complete interface for fetching workshop instance data including:
 * - Workshop configuration and settings (id, name, phase, grades, etc.)
 * - User plan with phase-specific tasks (from workshop_user_plan class)
 * - Current phase information and title
 * - List of submissions
 *
 * Features:
 * - Automatic caching with 5-minute stale time
 * - Background refetching on window focus
 * - Loading and error state management
 * - Manual refetch capability
 * - Convenient data accessors
 *
 * @param workshopId - The workshop instance ID to fetch
 * @param options - Optional configuration for the query behavior
 * @returns Object containing workshop data, loading/error states, and helpers
 *
 * @example
 * ```typescript
 * // Basic usage
 * const { workshop, userPlan, isLoading, error } = useWorkshop(workshopId);
 *
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return (
 *   <WorkshopView
 *     workshop={workshop}
 *     userPlan={userPlan}
 *     currentPhase={currentPhase}
 *   />
 * );
 * ```
 *
 * @example
 * ```typescript
 * // With custom options
 * const { data, refetch } = useWorkshop(workshopId, {
 *   staleTime: 60000, // 1 minute
 *   refetchOnWindowFocus: false,
 *   onSuccess: (data) => console.log('Workshop loaded:', data.workshop.name),
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Conditional fetching
 * const { data, isLoading } = useWorkshop(workshopId, {
 *   enabled: !!workshopId && isAuthenticated,
 * });
 * ```
 */
function useWorkshop(
  workshopId: number,
  options: UseWorkshopOptions = {}
): UseWorkshopResult {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_GC_TIME,
    refetchOnMount = true,
    refetchOnWindowFocus = true,
    onSuccess,
    onError,
  } = options;

  // Build query options with proper typing
  const queryOptions: UseQueryOptions<WorkshopData, Error> = {
    queryKey: [WORKSHOP_QUERY_KEY, workshopId],
    queryFn: () => fetchWorkshop(workshopId),
    enabled: enabled && workshopId > 0,
    staleTime,
    gcTime,
    refetchOnMount,
    refetchOnWindowFocus,
  };

  // Execute the query
  const queryResult = useQuery<WorkshopData, Error>(queryOptions);

  // Handle success callback
  if (queryResult.isSuccess && queryResult.data && onSuccess) {
    // Note: This is called on every render when data is available
    // For side effects, prefer using the query's meta or a useEffect
  }

  // Handle error callback
  if (queryResult.isError && queryResult.error && onError) {
    // Note: This is called on every render when error is present
    // For side effects, prefer using a useEffect
  }

  // Extract convenient accessors from the data
  const workshop = queryResult.data?.workshop;
  const userPlan = queryResult.data?.userPlan;
  const submissions = queryResult.data?.submissions;
  const currentPhase = queryResult.data?.currentPhase;
  const currentPhaseTitle = queryResult.data?.currentPhaseTitle;

  return {
    // Core query result fields
    data: queryResult.data,
    isLoading: queryResult.isLoading,
    isError: queryResult.isError,
    error: queryResult.error,
    isSuccess: queryResult.isSuccess,
    isFetching: queryResult.isFetching,
    refetch: queryResult.refetch,

    // Convenient data accessors
    workshop,
    userPlan,
    submissions,
    currentPhase,
    currentPhaseTitle,
  };
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Default export for the useWorkshop hook
 *
 * Usage:
 * ```typescript
 * import useWorkshop from '@/features/activities/workshop/hooks/useWorkshop';
 * ```
 */
export default useWorkshop;

/**
 * Named export for explicit imports
 *
 * Usage:
 * ```typescript
 * import { useWorkshop } from '@/features/activities/workshop/hooks/useWorkshop';
 * ```
 */
export { useWorkshop };

/**
 * Export query key for external cache management
 *
 * Usage with React Query client:
 * ```typescript
 * import { WORKSHOP_QUERY_KEY } from '@/features/activities/workshop/hooks/useWorkshop';
 *
 * // Invalidate all workshop queries
 * queryClient.invalidateQueries({ queryKey: [WORKSHOP_QUERY_KEY] });
 *
 * // Invalidate specific workshop
 * queryClient.invalidateQueries({ queryKey: [WORKSHOP_QUERY_KEY, workshopId] });
 * ```
 */
export { WORKSHOP_QUERY_KEY };
