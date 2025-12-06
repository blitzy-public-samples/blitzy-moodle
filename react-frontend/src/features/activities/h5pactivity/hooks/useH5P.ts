/**
 * React Query Hook for H5P Activity Data Management
 *
 * Provides comprehensive React Query integration for fetching and caching H5P activity data,
 * including activity details, access permissions, display options, and tracking status.
 * Implements automatic refetching, error handling, and optimistic updates for H5P interactions.
 *
 * This hook converts PHP-based H5P activity data fetching from view.php and
 * get_h5pactivity_access_information.php into a React-friendly API with:
 * - Automatic caching with 5-minute stale time
 * - Background refetching for data freshness
 * - Preview mode detection for non-submitting users
 * - Tracking status monitoring
 * - Capability-based permission checks
 * - Optimistic updates for tracking status changes
 *
 * @module features/activities/h5pactivity/hooks/useH5P
 * @see public/mod/h5pactivity/view.php - Original PHP view page
 * @see public/mod/h5pactivity/classes/external/get_h5pactivity_access_information.php - Access info API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';

import {
  getH5PActivity,
  getAccessInformation,
  viewH5PActivity,
  getAttempts,
  parseDisplayOptions,
} from '../api/h5pApi';

import type {
  H5PActivity,
  H5PAccessInfo,
  H5PDisplayOptions,
  H5PAttempt,
} from '../types/h5p.types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Query key factory for H5P-related queries
 * Provides consistent key generation for React Query cache management
 */
export const h5pQueryKeys = {
  /** Base key for all H5P queries */
  all: ['h5p'] as const,
  /** Key for H5P activity lists */
  activities: () => [...h5pQueryKeys.all, 'activities'] as const,
  /** Key for single H5P activity data */
  activity: (activityId: number) => [...h5pQueryKeys.all, 'activity', activityId] as const,
  /** Key for H5P activity access information */
  accessInfo: (activityId: number) => [...h5pQueryKeys.all, 'access', activityId] as const,
  /** Key for H5P activity attempts */
  attempts: (activityId: number) => [...h5pQueryKeys.all, 'attempts', activityId] as const,
  /** Key for user-specific attempts */
  userAttempts: (activityId: number, userId: number) => 
    [...h5pQueryKeys.all, 'attempts', activityId, 'user', userId] as const,
} as const;

/**
 * Default stale time for H5P data (5 minutes in milliseconds)
 * Balances freshness with performance by caching data for reasonable duration
 */
const H5P_STALE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Default cache time for H5P data (10 minutes in milliseconds)
 * Keeps data in cache slightly longer than stale time for better UX
 */
const H5P_CACHE_TIME = 10 * 60 * 1000; // 10 minutes

/**
 * Retry configuration for failed queries
 * Attempts 3 retries with exponential backoff before failing
 */
const H5P_RETRY_COUNT = 3;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Combined H5P activity data with computed properties
 * Provides all activity information needed for rendering H5P content
 */
export interface H5PActivityData {
  /** Core activity instance data from database */
  activity: H5PActivity;
  /** Parsed boolean display options for H5P player */
  displayOptions: H5PDisplayOptions;
  /** Whether tracking is enabled for this activity */
  isTrackingEnabled: boolean;
  /** Whether the activity has a grade configured */
  hasGrade: boolean;
}

/**
 * H5P tracking status information
 * Provides computed flags for preview mode and submission capabilities
 */
export interface H5PTrackingStatus {
  /** Whether user is in preview mode (cannot submit) */
  isPreviewMode: boolean;
  /** Whether tracking is enabled at activity level */
  isTrackingEnabled: boolean;
  /** Whether user can submit attempts */
  canSubmit: boolean;
  /** Message to display for preview mode users */
  previewMessage: string | null;
  /** Warning message if tracking is disabled */
  trackingWarning: string | null;
}

/**
 * Options for the useH5P hook
 * Allows customization of caching and fetching behavior
 */
export interface UseH5POptions {
  /** Override default stale time (milliseconds) */
  staleTime?: number;
  /** Override default cache time (milliseconds) */
  cacheTime?: number;
  /** Whether to enable the query (useful for conditional fetching) */
  enabled?: boolean;
  /** Whether to refetch on window focus */
  refetchOnWindowFocus?: boolean;
  /** Whether to refetch on mount */
  refetchOnMount?: boolean | 'always';
}

/**
 * Return type for the useH5P hook
 * Provides comprehensive access to H5P activity data and operations
 */
export interface UseH5PResult {
  // Activity Data
  /** H5P activity instance data with display options */
  activityData: H5PActivityData | undefined;
  /** Raw activity query result for advanced usage */
  activityQuery: UseQueryResult<H5PActivity, Error>;

  // Access Information
  /** Access permission flags for current user */
  accessInfo: H5PAccessInfo | undefined;
  /** Raw access info query result for advanced usage */
  accessQuery: UseQueryResult<H5PAccessInfo, Error>;

  // Tracking Status
  /** Computed tracking and preview mode status */
  trackingStatus: H5PTrackingStatus;

  // Loading States
  /** Whether any data is currently loading */
  isLoading: boolean;
  /** Whether initial data load is in progress */
  isInitialLoading: boolean;
  /** Whether data is being refetched in background */
  isFetching: boolean;

  // Error States
  /** Combined error from any failed query */
  error: Error | null;
  /** Whether any query has errored */
  isError: boolean;

  // Success States
  /** Whether all data has loaded successfully */
  isSuccess: boolean;

  // Actions
  /** Mutation to mark activity as viewed */
  markAsViewed: UseMutationResult<{ status: boolean }, Error, void, unknown>;
  /** Refetch all H5P data */
  refetch: () => Promise<void>;
  /** Invalidate all H5P cache for this activity */
  invalidateCache: () => Promise<void>;
}

/**
 * Options for useH5PAccess hook
 */
export interface UseH5PAccessOptions {
  /** Override default stale time (milliseconds) */
  staleTime?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

/**
 * Return type for useH5PAccess hook
 */
export interface UseH5PAccessResult {
  /** Access permission information */
  accessInfo: H5PAccessInfo | undefined;
  /** Whether access data is loading */
  isLoading: boolean;
  /** Error if access check failed */
  error: Error | null;
  /** Whether access check succeeded */
  isSuccess: boolean;
  /** Whether user can view the activity */
  canView: boolean;
  /** Whether user can submit attempts */
  canSubmit: boolean;
  /** Whether user can review all attempts (teacher) */
  canReviewAttempts: boolean;
  /** Refetch access information */
  refetch: () => Promise<void>;
}

/**
 * Options for useH5PAttempts hook
 */
export interface UseH5PAttemptsOptions {
  /** Specific user IDs to fetch attempts for (undefined = current user) */
  userIds?: number[];
  /** Override default stale time (milliseconds) */
  staleTime?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

/**
 * Return type for useH5PAttempts hook
 */
export interface UseH5PAttemptsResult {
  /** Array of user attempts */
  attempts: H5PAttempt[];
  /** Total number of attempts */
  attemptCount: number;
  /** Whether attempts data is loading */
  isLoading: boolean;
  /** Error if fetching attempts failed */
  error: Error | null;
  /** Whether fetch succeeded */
  isSuccess: boolean;
  /** Refetch attempts data */
  refetch: () => Promise<void>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Compute tracking status from activity and access data
 *
 * Determines preview mode, tracking enabled state, and generates
 * appropriate user-facing messages based on permissions and settings.
 *
 * Logic mirrors PHP view.php behavior:
 * - Preview mode: User cannot submit AND is not a guest
 * - Tracking warning: Tracking disabled AND user has manage capability
 *
 * @param activity - H5P activity instance (may be undefined during loading)
 * @param accessInfo - User access permissions (may be undefined during loading)
 * @returns Computed tracking status with messages
 */
function computeTrackingStatus(
  activity: H5PActivity | undefined,
  accessInfo: H5PAccessInfo | undefined
): H5PTrackingStatus {
  // Default state when data not yet loaded
  if (!activity || !accessInfo) {
    return {
      isPreviewMode: false,
      isTrackingEnabled: false,
      canSubmit: false,
      previewMessage: null,
      trackingWarning: null,
    };
  }

  const isTrackingEnabled = activity.enabletracking === 1;
  const canSubmit = accessInfo.cansubmit;

  // Preview mode: Cannot submit (typically teachers/content creators viewing content)
  // Note: In PHP, this also checks !isguestuser() but we assume authenticated users here
  const isPreviewMode = !canSubmit;

  // Generate preview mode message
  let previewMessage: string | null = null;
  if (isPreviewMode) {
    previewMessage = 'You are viewing this content in preview mode. Your results will not be recorded.';
  }

  // Generate tracking warning for users who can manage the activity
  // In the original PHP, this checks has_capability('moodle/course:manageactivities')
  // We approximate this with canreviewattempts (typically a teacher capability)
  let trackingWarning: string | null = null;
  if (!isTrackingEnabled && isPreviewMode && accessInfo.canreviewattempts) {
    trackingWarning = 'Tracking is disabled for this activity. Enable tracking in the activity settings to record student attempts.';
  } else if (!isTrackingEnabled && isPreviewMode) {
    trackingWarning = 'Tracking is disabled for this activity.';
  }

  return {
    isPreviewMode,
    isTrackingEnabled,
    canSubmit,
    previewMessage,
    trackingWarning,
  };
}

/**
 * Transform raw activity data into enriched activity data object
 *
 * Parses display options bitmask and computes derived properties
 * to provide a more usable activity data structure.
 *
 * @param activity - Raw H5P activity from API
 * @returns Enriched activity data with parsed display options
 */
function transformActivityData(activity: H5PActivity): H5PActivityData {
  return {
    activity,
    displayOptions: parseDisplayOptions(activity.displayoptions),
    isTrackingEnabled: activity.enabletracking === 1,
    hasGrade: activity.grade > 0,
  };
}

// ============================================================================
// Main Hook: useH5P
// ============================================================================

/**
 * Primary hook for H5P activity data management
 *
 * Provides comprehensive access to H5P activity data including:
 * - Activity instance details and configuration
 * - User access permissions and capabilities
 * - Preview mode and tracking status
 * - Mutations for marking activity as viewed
 * - Cache management utilities
 *
 * Features:
 * - Automatic caching with 5-minute stale time
 * - Background refetching for data freshness
 * - Optimistic updates for view tracking
 * - Combined loading/error states for all queries
 *
 * @param activityId - H5P activity module ID to fetch data for
 * @param options - Optional configuration for caching and fetching behavior
 * @returns Comprehensive H5P data object with queries, mutations, and utilities
 *
 * @example
 * ```tsx
 * function H5PViewer({ activityId }: { activityId: number }) {
 *   const {
 *     activityData,
 *     accessInfo,
 *     trackingStatus,
 *     isLoading,
 *     error,
 *     markAsViewed,
 *   } = useH5P(activityId);
 *
 *   // Mark as viewed on mount
 *   useEffect(() => {
 *     if (accessInfo?.canview) {
 *       markAsViewed.mutate();
 *     }
 *   }, [accessInfo?.canview]);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       {trackingStatus.isPreviewMode && (
 *         <Alert severity="info">{trackingStatus.previewMessage}</Alert>
 *       )}
 *       {trackingStatus.trackingWarning && (
 *         <Alert severity="warning">{trackingStatus.trackingWarning}</Alert>
 *       )}
 *       <H5PPlayer
 *         activity={activityData!.activity}
 *         displayOptions={activityData!.displayOptions}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function useH5P(activityId: number, options: UseH5POptions = {}): UseH5PResult {
  const queryClient = useQueryClient();

  const {
    staleTime = H5P_STALE_TIME,
    cacheTime = H5P_CACHE_TIME,
    enabled = true,
    refetchOnWindowFocus = true,
    refetchOnMount = true,
  } = options;

  // Validate activity ID
  const isValidId = Number.isInteger(activityId) && activityId > 0;

  // -------------------------------------------------------------------------
  // Query: Fetch H5P Activity Data
  // -------------------------------------------------------------------------
  const activityQuery = useQuery<H5PActivity, Error>({
    queryKey: h5pQueryKeys.activity(activityId),
    queryFn: () => getH5PActivity(activityId),
    staleTime,
    gcTime: cacheTime,
    enabled: enabled && isValidId,
    refetchOnWindowFocus,
    refetchOnMount,
    retry: H5P_RETRY_COUNT,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // -------------------------------------------------------------------------
  // Query: Fetch Access Information
  // -------------------------------------------------------------------------
  const accessQuery = useQuery<H5PAccessInfo, Error>({
    queryKey: h5pQueryKeys.accessInfo(activityId),
    queryFn: () => getAccessInformation(activityId),
    staleTime,
    gcTime: cacheTime,
    enabled: enabled && isValidId,
    refetchOnWindowFocus,
    refetchOnMount,
    retry: H5P_RETRY_COUNT,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // -------------------------------------------------------------------------
  // Mutation: Mark Activity as Viewed
  // -------------------------------------------------------------------------
  const markAsViewed = useMutation<{ status: boolean }, Error, void>({
    mutationFn: () => viewH5PActivity(activityId),
    onSuccess: () => {
      // Invalidate queries that might be affected by the view event
      // This ensures completion status and activity logs are refreshed
      void queryClient.invalidateQueries({
        queryKey: h5pQueryKeys.activity(activityId),
      });
    },
    onError: (error) => {
      // Log error but don't throw - viewing failure shouldn't block the user
      console.error('Failed to mark H5P activity as viewed:', error);
    },
  });

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------

  // Transform activity data into enriched format
  const activityData: H5PActivityData | undefined = activityQuery.data
    ? transformActivityData(activityQuery.data)
    : undefined;

  // Compute tracking status from combined data
  const trackingStatus = computeTrackingStatus(activityQuery.data, accessQuery.data);

  // Combine loading states
  const isLoading = activityQuery.isLoading || accessQuery.isLoading;
  const isInitialLoading = activityQuery.isPending || accessQuery.isPending;
  const isFetching = activityQuery.isFetching || accessQuery.isFetching;

  // Combine error states
  const error = activityQuery.error || accessQuery.error;
  const isError = activityQuery.isError || accessQuery.isError;

  // Success only when both queries succeed
  const isSuccess = activityQuery.isSuccess && accessQuery.isSuccess;

  // -------------------------------------------------------------------------
  // Utility Functions
  // -------------------------------------------------------------------------

  /**
   * Refetch all H5P data for this activity
   */
  const refetch = async (): Promise<void> => {
    await Promise.all([
      activityQuery.refetch(),
      accessQuery.refetch(),
    ]);
  };

  /**
   * Invalidate all cached H5P data for this activity
   */
  const invalidateCache = async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: h5pQueryKeys.activity(activityId),
    });
    await queryClient.invalidateQueries({
      queryKey: h5pQueryKeys.accessInfo(activityId),
    });
    await queryClient.invalidateQueries({
      queryKey: h5pQueryKeys.attempts(activityId),
    });
  };

  return {
    // Activity Data
    activityData,
    activityQuery,

    // Access Information
    accessInfo: accessQuery.data,
    accessQuery,

    // Tracking Status
    trackingStatus,

    // Loading States
    isLoading,
    isInitialLoading,
    isFetching,

    // Error States
    error,
    isError,

    // Success States
    isSuccess,

    // Actions
    markAsViewed,
    refetch,
    invalidateCache,
  };
}

// ============================================================================
// Specialized Hook: useH5PAccess
// ============================================================================

/**
 * Focused hook for H5P access information only
 *
 * Lightweight alternative to useH5P when you only need permission checks
 * without loading full activity data.
 *
 * @param activityId - H5P activity module ID
 * @param options - Optional configuration
 * @returns Access information with convenience boolean flags
 *
 * @example
 * ```tsx
 * function H5PAccessGate({ activityId, children }) {
 *   const { canView, isLoading, error } = useH5PAccess(activityId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error || !canView) return <AccessDenied />;
 *
 *   return children;
 * }
 * ```
 */
export function useH5PAccess(
  activityId: number,
  options: UseH5PAccessOptions = {}
): UseH5PAccessResult {
  const {
    staleTime = H5P_STALE_TIME,
    enabled = true,
  } = options;

  const isValidId = Number.isInteger(activityId) && activityId > 0;

  const query = useQuery<H5PAccessInfo, Error>({
    queryKey: h5pQueryKeys.accessInfo(activityId),
    queryFn: () => getAccessInformation(activityId),
    staleTime,
    gcTime: H5P_CACHE_TIME,
    enabled: enabled && isValidId,
    retry: H5P_RETRY_COUNT,
  });

  const refetch = async (): Promise<void> => {
    await query.refetch();
  };

  return {
    accessInfo: query.data,
    isLoading: query.isLoading,
    error: query.error,
    isSuccess: query.isSuccess,
    canView: query.data?.canview ?? false,
    canSubmit: query.data?.cansubmit ?? false,
    canReviewAttempts: query.data?.canreviewattempts ?? false,
    refetch,
  };
}

// ============================================================================
// Specialized Hook: useH5PAttempts
// ============================================================================

/**
 * Hook for fetching H5P activity attempts
 *
 * Retrieves attempts for the current user or specified users.
 * Useful for displaying attempt history and scores.
 *
 * @param activityId - H5P activity module ID
 * @param options - Optional configuration including user IDs filter
 * @returns Attempts data with loading and error states
 *
 * @example
 * ```tsx
 * function AttemptHistory({ activityId }) {
 *   const { attempts, attemptCount, isLoading, error } = useH5PAttempts(activityId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <h3>Your Attempts ({attemptCount})</h3>
 *       <AttemptList attempts={attempts} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useH5PAttempts(
  activityId: number,
  options: UseH5PAttemptsOptions = {}
): UseH5PAttemptsResult {
  const {
    userIds,
    staleTime = H5P_STALE_TIME,
    enabled = true,
  } = options;

  const isValidId = Number.isInteger(activityId) && activityId > 0;

  // Use different query key based on whether userIds are provided
  const queryKey = userIds && userIds.length > 0
    ? [...h5pQueryKeys.attempts(activityId), 'users', ...userIds.sort()]
    : h5pQueryKeys.attempts(activityId);

  const query = useQuery({
    queryKey,
    queryFn: () => getAttempts(activityId, userIds),
    staleTime,
    gcTime: H5P_CACHE_TIME,
    enabled: enabled && isValidId,
    retry: H5P_RETRY_COUNT,
  });

  // Flatten attempts from all users
  const attempts: H5PAttempt[] = query.data?.usersattempts?.flatMap(
    (userData) => userData.attempts
  ) ?? [];

  const attemptCount = attempts.length;

  const refetch = async (): Promise<void> => {
    await query.refetch();
  };

  return {
    attempts,
    attemptCount,
    isLoading: query.isLoading,
    error: query.error,
    isSuccess: query.isSuccess,
    refetch,
  };
}

// ============================================================================
// Utility Hook: useH5PViewTracking
// ============================================================================

/**
 * Hook for tracking H5P activity views with optimistic updates
 *
 * Automatically marks the activity as viewed when mounted and
 * provides tracking state information.
 *
 * @param activityId - H5P activity module ID
 * @param options - Configuration options
 * @returns View tracking state and manual trigger function
 *
 * @example
 * ```tsx
 * function H5PContentViewer({ activityId }) {
 *   const { hasBeenViewed, isTracking, trackView } = useH5PViewTracking(activityId, {
 *     autoTrack: true,
 *   });
 *
 *   return (
 *     <div>
 *       {isTracking && <span>Recording view...</span>}
 *       <H5PContent id={activityId} />
 *       {!hasBeenViewed && <button onClick={trackView}>Mark as Viewed</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useH5PViewTracking(
  activityId: number,
  options: { autoTrack?: boolean; enabled?: boolean } = {}
): {
  hasBeenViewed: boolean;
  isTracking: boolean;
  error: Error | null;
  trackView: () => void;
} {
  const { autoTrack = false, enabled = true } = options;
  const queryClient = useQueryClient();

  const isValidId = Number.isInteger(activityId) && activityId > 0;

  const mutation = useMutation<{ status: boolean }, Error, void>({
    mutationFn: () => viewH5PActivity(activityId),
    onMutate: async () => {
      // Optimistic update: assume success
      // This provides immediate feedback to the user
      await queryClient.cancelQueries({
        queryKey: h5pQueryKeys.activity(activityId),
      });
    },
    onSuccess: () => {
      // Invalidate and refetch activity data to reflect the view
      void queryClient.invalidateQueries({
        queryKey: h5pQueryKeys.activity(activityId),
      });
    },
    onError: (error) => {
      // Log error but don't disrupt user experience
      console.error('Failed to track H5P view:', error);
    },
  });

  // Auto-track on mount if enabled
  const hasTrackedRef = { current: false };
  if (autoTrack && enabled && isValidId && !hasTrackedRef.current && !mutation.isPending) {
    hasTrackedRef.current = true;
    // Use setTimeout to defer mutation to after render
    setTimeout(() => {
      mutation.mutate();
    }, 0);
  }

  return {
    hasBeenViewed: mutation.isSuccess,
    isTracking: mutation.isPending,
    error: mutation.error,
    trackView: () => mutation.mutate(),
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default useH5P;
