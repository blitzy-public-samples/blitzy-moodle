/**
 * Forum Data and Subscription Management Hooks
 *
 * Custom React Query hooks for managing forum data and subscription state.
 * Provides optimized data fetching with caching, optimistic updates, and
 * comprehensive error handling.
 *
 * @module features/activities/forums/hooks/useForum
 * @packageDocumentation
 *
 * @example
 * ```tsx
 * // Basic usage for fetching forum data
 * function ForumHeader({ forumId }: { forumId: number }) {
 *   const { data: forum, isLoading, error } = useForum(forumId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <h1>{forum?.name}</h1>
 *       <p>{forum?.intro}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Usage with subscription mutation
 * function SubscribeButton({ forumId }: { forumId: number }) {
 *   const { data: forum } = useForum(forumId);
 *   const { mutate: toggleSubscription, isPending } = useSubscribeToForum(forumId);
 *
 *   const handleClick = () => {
 *     toggleSubscription(!forum?.subscribed);
 *   };
 *
 *   return (
 *     <Button onClick={handleClick} disabled={isPending || !forum?.canSubscribe}>
 *       {forum?.subscribed ? 'Unsubscribe' : 'Subscribe'}
 *     </Button>
 *   );
 * }
 * ```
 *
 * Backend References:
 * - public/mod/forum/view.php - Forum viewing and subscription status
 * - public/mod/forum/subscribe.php - Subscription management
 * - public/mod/forum/lib.php - Core forum functions
 * - public/mod/forum/externallib.php - External API definitions
 */

import { useRef, useEffect } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryClient,
} from '@tanstack/react-query';
import { AxiosError } from 'axios';

// Internal imports from dependency files
import {
  fetchForum,
  subscribeForum,
  type SubscriptionResponse,
} from '../api/forumApi';
import type { Forum } from '../types/forum.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default stale time for forum data (5 minutes)
 * Forum metadata doesn't change frequently, so a longer stale time is appropriate
 */
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Default garbage collection time for forum data (10 minutes)
 * Keeps data in cache longer for back-navigation scenarios
 */
const DEFAULT_GC_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds

/**
 * Default retry count for failed requests
 * Uses exponential backoff with 3 retries
 */
const DEFAULT_RETRY_COUNT = 3;

// ============================================================================
// QUERY KEY FACTORY
// ============================================================================

/**
 * Query key factory for forum-related queries
 *
 * Provides consistent, type-safe query keys for React Query cache management.
 * Follows the array-based key structure recommended by TanStack Query.
 *
 * @example
 * ```typescript
 * // Use in queries
 * useQuery({
 *   queryKey: forumQueryKeys.detail(forumId),
 *   queryFn: () => fetchForum(forumId)
 * });
 *
 * // Invalidate all forum data
 * queryClient.invalidateQueries({ queryKey: forumQueryKeys.all });
 *
 * // Invalidate specific forum
 * queryClient.invalidateQueries({ queryKey: forumQueryKeys.detail(123) });
 * ```
 */
export const forumQueryKeys = {
  /** Base key for all forum queries */
  all: ['forums'] as const,

  /** Key for specific forum detail by ID */
  detail: (forumId: number) => ['forums', forumId] as const,

  /** Key for forum subscription status */
  subscription: (forumId: number) => ['forums', forumId, 'subscription'] as const,
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * API error response structure
 * Matches the standard error envelope from the Moodle API
 */
interface ApiErrorResponse {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Configuration options for the useForum hook
 *
 * Extends React Query options with forum-specific settings for
 * fine-grained control over caching, refetching, and callbacks.
 */
export interface UseForumOptions {
  /**
   * Whether the query is enabled
   * Set to false to disable automatic fetching
   * @default true when forumId is provided and valid (> 0)
   */
  enabled?: boolean;

  /**
   * Time in milliseconds after which data is considered stale
   * Stale data will be refetched in the background on next access
   * @default 300000 (5 minutes)
   */
  staleTime?: number;

  /**
   * Time in milliseconds that unused data remains in cache
   * After this time, inactive data is garbage collected
   * @default 600000 (10 minutes)
   */
  gcTime?: number;

  /**
   * Number of times to retry failed requests
   * Uses exponential backoff between retries
   * @default 3
   */
  retry?: number | boolean;

  /**
   * Whether to refetch when the window regains focus
   * Useful for keeping data fresh when user returns to tab
   * @default true
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Whether to refetch when component remounts
   * @default false
   */
  refetchOnMount?: boolean | 'always';

  /**
   * Transform function to modify forum data before returning
   * Useful for selecting specific fields or computing derived values
   *
   * @param data - The raw forum data from the API
   * @returns Transformed forum data
   *
   * @example
   * ```typescript
   * // Only return essential fields
   * select: (forum) => ({
   *   id: forum.id,
   *   name: forum.name,
   *   subscribed: forum.subscribed
   * })
   * ```
   */
  select?: (data: Forum) => Forum;

  /**
   * Callback executed when forum data is successfully fetched
   * @param data - The fetched forum data
   */
  onSuccess?: (data: Forum) => void;

  /**
   * Callback executed when forum fetch fails
   * @param error - The error that occurred
   */
  onError?: (error: Error) => void;
}

/**
 * Return type for the useForum hook
 *
 * Provides forum data, loading states, error information,
 * and utility functions for data management.
 */
export interface UseForumResult {
  /** The fetched forum data, undefined while loading */
  data: Forum | undefined;

  /** True during the initial data fetch (no cached data) */
  isLoading: boolean;

  /** True when fetching in the background (has cached data) */
  isFetching: boolean;

  /** True if the query is currently fetching for the first time */
  isPending: boolean;

  /** True if the last fetch resulted in an error */
  isError: boolean;

  /** True if data has been fetched successfully at least once */
  isSuccess: boolean;

  /** Error object if the fetch failed, null otherwise */
  error: Error | null;

  /**
   * Manually trigger a data refetch
   * Useful for pull-to-refresh or explicit refresh buttons
   * @returns Promise that resolves when refetch completes
   */
  refetch: () => Promise<unknown>;

  /** Current status of the query: 'pending' | 'error' | 'success' */
  status: 'pending' | 'error' | 'success';

  /** Timestamp of when data was last fetched */
  dataUpdatedAt: number;

  /** Timestamp of when an error last occurred */
  errorUpdatedAt: number;

  /** Number of times this query has failed */
  failureCount: number;

  /** The reason for the last failure */
  failureReason: Error | null;
}

/**
 * Configuration options for the useSubscribeToForum mutation hook
 */
export interface UseSubscribeToForumOptions {
  /**
   * Callback executed when subscription is successfully toggled
   * @param data - The subscription response from the API
   * @param variables - The subscription state that was requested
   */
  onSuccess?: (data: SubscriptionResponse, variables: boolean) => void;

  /**
   * Callback executed when subscription toggle fails
   * @param error - The error that occurred
   * @param variables - The subscription state that was requested
   */
  onError?: (error: Error, variables: boolean) => void;

  /**
   * Callback executed when mutation starts (before API call)
   * @param variables - The subscription state being requested
   */
  onMutate?: (variables: boolean) => void;

  /**
   * Callback executed after mutation completes (success or error)
   */
  onSettled?: () => void;
}

/**
 * Return type for the useSubscribeToForum hook
 */
export interface UseSubscribeToForumResult {
  /**
   * Function to toggle forum subscription
   * @param subscribe - True to subscribe, false to unsubscribe
   */
  mutate: (subscribe: boolean) => void;

  /**
   * Async version of mutate that returns a promise
   * @param subscribe - True to subscribe, false to unsubscribe
   * @returns Promise resolving to subscription response
   */
  mutateAsync: (subscribe: boolean) => Promise<SubscriptionResponse>;

  /** True while the subscription request is in progress */
  isPending: boolean;

  /** True if the last subscription request succeeded */
  isSuccess: boolean;

  /** True if the last subscription request failed */
  isError: boolean;

  /** True if mutation is idle (not pending, not success, not error) */
  isIdle: boolean;

  /** Error object if the mutation failed */
  error: Error | null;

  /** The response data from the last successful mutation */
  data: SubscriptionResponse | undefined;

  /** Reset the mutation state to initial values */
  reset: () => void;

  /** Current status of the mutation */
  status: 'idle' | 'pending' | 'error' | 'success';

  /** The variables passed to the last mutation call */
  variables: boolean | undefined;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract user-friendly error message from AxiosError
 *
 * Handles various error scenarios including network errors,
 * API errors with custom messages, and HTTP status codes.
 *
 * @param error - The error to process
 * @returns User-friendly error message
 */
function getErrorMessage(error: unknown): string {
  // Handle Axios errors with response data
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const apiError = error.response?.data?.error as ApiErrorResponse | undefined;

    // Return API-provided message if available
    if (apiError?.message) {
      return apiError.message;
    }

    // Map common HTTP status codes to user-friendly messages
    switch (status) {
      case 401:
        return 'You must be logged in to view this forum.';
      case 403:
        return 'You do not have permission to access this forum.';
      case 404:
        return 'The requested forum could not be found.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
      case 502:
      case 503:
        return 'A server error occurred. Please try again later.';
      default:
        // Network error (no response)
        if (!error.response) {
          return 'Unable to connect to the server. Please check your internet connection.';
        }
        return error.message || 'An unexpected error occurred.';
    }
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // Fallback for unknown error types
  return 'An unexpected error occurred while loading forum data.';
}

/**
 * Create a typed Error from unknown error input
 *
 * @param error - The error to convert
 * @returns Error object with appropriate message
 */
function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(getErrorMessage(error));
}

/**
 * Calculate retry delay with exponential backoff
 *
 * @param attemptIndex - The current retry attempt (0-indexed)
 * @returns Delay in milliseconds before next retry
 */
function getRetryDelay(attemptIndex: number): number {
  // Exponential backoff: 1s, 2s, 4s, etc.
  const baseDelay = 1000;
  const maxDelay = 30000;
  const delay = Math.min(baseDelay * Math.pow(2, attemptIndex), maxDelay);
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
}

/**
 * Determine if an error should trigger a retry
 *
 * @param failureCount - Number of failures so far
 * @param error - The error that occurred
 * @returns Whether to retry the request
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  // Don't retry after max attempts
  if (failureCount >= DEFAULT_RETRY_COUNT) {
    return false;
  }

  // Don't retry client errors (4xx) except rate limiting (429)
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (status && status >= 400 && status < 500 && status !== 429) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// OPTIMISTIC UPDATE HELPERS
// ============================================================================

/**
 * Context type for optimistic updates
 * Stores previous data for rollback on mutation failure
 */
interface OptimisticUpdateContext {
  previousForum: Forum | undefined;
}

/**
 * Apply optimistic update to forum subscription status
 *
 * @param queryClient - React Query client instance
 * @param forumId - ID of the forum being updated
 * @param subscribe - New subscription state
 * @returns Previous forum data for rollback
 */
function applyOptimisticSubscriptionUpdate(
  queryClient: QueryClient,
  forumId: number,
  subscribe: boolean
): OptimisticUpdateContext {
  // Cancel any outgoing refetches to avoid overwriting optimistic update
  queryClient.cancelQueries({ queryKey: forumQueryKeys.detail(forumId) });

  // Snapshot previous value for rollback
  const previousForum = queryClient.getQueryData<Forum>(
    forumQueryKeys.detail(forumId)
  );

  // Optimistically update the cache
  if (previousForum) {
    queryClient.setQueryData<Forum>(forumQueryKeys.detail(forumId), {
      ...previousForum,
      subscribed: subscribe,
    });
  }

  return { previousForum };
}

/**
 * Rollback optimistic update on mutation failure
 *
 * @param queryClient - React Query client instance
 * @param forumId - ID of the forum to rollback
 * @param context - Context containing previous forum data
 */
function rollbackOptimisticUpdate(
  queryClient: QueryClient,
  forumId: number,
  context: OptimisticUpdateContext | undefined
): void {
  if (context?.previousForum) {
    queryClient.setQueryData<Forum>(
      forumQueryKeys.detail(forumId),
      context.previousForum
    );
  }
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Custom React Query hook for fetching and managing forum data
 *
 * Provides forum metadata including name, description, type, subscription status,
 * discussion count, and user permissions. Implements automatic caching with
 * stale-while-revalidate pattern for optimal performance.
 *
 * @param forumId - The ID of the forum to fetch
 * @param options - Optional configuration for query behavior
 * @returns Object containing forum data, loading states, error info, and refetch function
 *
 * @example
 * ```tsx
 * // Basic usage
 * function ForumPage({ forumId }: { forumId: number }) {
 *   const {
 *     data: forum,
 *     isLoading,
 *     isError,
 *     error,
 *     refetch
 *   } = useForum(forumId);
 *
 *   if (isLoading) return <Skeleton variant="rectangular" height={200} />;
 *   if (isError) return <Alert severity="error">{error?.message}</Alert>;
 *
 *   return (
 *     <Paper>
 *       <Typography variant="h4">{forum?.name}</Typography>
 *       <div dangerouslySetInnerHTML={{ __html: forum?.intro ?? '' }} />
 *       <Chip label={`${forum?.discussionCount} discussions`} />
 *       <IconButton onClick={() => refetch()}>
 *         <RefreshIcon />
 *       </IconButton>
 *     </Paper>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Conditional fetching
 * const { data } = useForum(forumId, {
 *   enabled: Boolean(forumId) && hasPermission,
 *   staleTime: 10 * 60 * 1000, // 10 minutes
 * });
 * ```
 *
 * @example
 * ```tsx
 * // With data transformation
 * const { data } = useForum(forumId, {
 *   select: (forum) => ({
 *     ...forum,
 *     formattedDate: new Date(forum.timemodified * 1000).toLocaleDateString()
 *   })
 * });
 * ```
 */
function useForum(
  forumId: number,
  options: UseForumOptions = {}
): UseForumResult {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_GC_TIME,
    retry = DEFAULT_RETRY_COUNT,
    refetchOnWindowFocus = true,
    refetchOnMount = false,
    select,
    onSuccess,
    onError,
  } = options;

  // Build query options
  const queryOptions: UseQueryOptions<Forum, Error, Forum, readonly ['forums', number]> = {
    queryKey: forumQueryKeys.detail(forumId),
    queryFn: async () => {
      try {
        return await fetchForum(forumId);
      } catch (error) {
        throw toError(error);
      }
    },
    enabled: enabled && forumId > 0,
    staleTime,
    gcTime,
    retry: typeof retry === 'number'
      ? (failureCount, error) => shouldRetry(failureCount, error)
      : retry,
    retryDelay: getRetryDelay,
    refetchOnWindowFocus,
    refetchOnMount,
    select,
  };

  // Execute the query
  const query = useQuery(queryOptions);

  // Handle success callback (React Query v5 doesn't have onSuccess in options)
  // We use an effect to trigger callbacks based on query state changes
  const { data, isSuccess, isError, error } = query;

  // Track previous states to detect changes
  const prevIsSuccess = usePreviousValue(isSuccess);
  const prevIsError = usePreviousValue(isError);

  // Trigger onSuccess callback when data becomes available
  if (isSuccess && !prevIsSuccess && data && onSuccess) {
    onSuccess(data);
  }

  // Trigger onError callback when error occurs
  if (isError && !prevIsError && error && onError) {
    onError(error);
  }

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isPending: query.isPending,
    isError: query.isError,
    isSuccess: query.isSuccess,
    error: query.error,
    refetch: query.refetch,
    status: query.status,
    dataUpdatedAt: query.dataUpdatedAt,
    errorUpdatedAt: query.errorUpdatedAt,
    failureCount: query.failureCount,
    failureReason: query.failureReason,
  };
}

/**
 * Custom hook to track previous value (for callback detection)
 *
 * Uses useRef to persist the previous value across renders.
 * Updates the ref after each render via useEffect to ensure
 * the previous value is always one render behind the current value.
 *
 * @param value - Current value to track
 * @returns Previous value from the last render
 */
function usePreviousValue<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

/**
 * Custom React Query mutation hook for toggling forum subscription
 *
 * Manages subscription state with optimistic updates for immediate UI feedback.
 * Automatically invalidates forum cache on success and rolls back on failure.
 *
 * @param forumId - The ID of the forum to subscribe/unsubscribe from
 * @param options - Optional configuration for mutation behavior
 * @returns Object containing mutate function, loading states, and mutation result
 *
 * @example
 * ```tsx
 * // Basic usage
 * function SubscriptionToggle({ forumId }: { forumId: number }) {
 *   const { data: forum } = useForum(forumId);
 *   const { mutate, isPending } = useSubscribeToForum(forumId);
 *
 *   return (
 *     <Switch
 *       checked={forum?.subscribed ?? false}
 *       onChange={(e) => mutate(e.target.checked)}
 *       disabled={isPending || !forum?.canSubscribe}
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With callbacks
 * const { mutate } = useSubscribeToForum(forumId, {
 *   onSuccess: (data) => {
 *     toast.success(data.message);
 *   },
 *   onError: (error) => {
 *     toast.error(`Failed to update subscription: ${error.message}`);
 *   }
 * });
 * ```
 *
 * @example
 * ```tsx
 * // Using async mutation
 * const { mutateAsync } = useSubscribeToForum(forumId);
 *
 * async function handleSubscribe() {
 *   try {
 *     const result = await mutateAsync(true);
 *     console.log('Subscribed:', result.subscribed);
 *   } catch (error) {
 *     console.error('Subscription failed:', error);
 *   }
 * }
 * ```
 */
export function useSubscribeToForum(
  forumId: number,
  options: UseSubscribeToForumOptions = {}
): UseSubscribeToForumResult {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onMutate, onSettled } = options;

  // Build mutation options
  const mutationOptions: UseMutationOptions<
    SubscriptionResponse,
    Error,
    boolean,
    OptimisticUpdateContext
  > = {
    mutationFn: async (subscribe: boolean) => {
      try {
        return await subscribeForum(forumId, subscribe);
      } catch (error) {
        throw toError(error);
      }
    },

    // Apply optimistic update before mutation
    onMutate: async (subscribe: boolean) => {
      // Call user's onMutate if provided
      onMutate?.(subscribe);

      // Apply optimistic update and return context for rollback
      return applyOptimisticSubscriptionUpdate(queryClient, forumId, subscribe);
    },

    // Handle successful mutation
    onSuccess: (data: SubscriptionResponse, variables: boolean) => {
      // Ensure cache reflects server state
      const currentForum = queryClient.getQueryData<Forum>(
        forumQueryKeys.detail(forumId)
      );

      if (currentForum) {
        queryClient.setQueryData<Forum>(forumQueryKeys.detail(forumId), {
          ...currentForum,
          subscribed: data.subscribed,
        });
      }

      // Invalidate to ensure fresh data on next access
      queryClient.invalidateQueries({
        queryKey: forumQueryKeys.detail(forumId),
      });

      // Call user's onSuccess if provided
      onSuccess?.(data, variables);
    },

    // Handle failed mutation - rollback optimistic update
    onError: (error: Error, variables: boolean, context) => {
      // Rollback to previous state
      rollbackOptimisticUpdate(queryClient, forumId, context);

      // Call user's onError if provided
      onError?.(error, variables);
    },

    // Always called after mutation completes (success or error)
    onSettled: () => {
      // Refetch to ensure cache is in sync with server
      queryClient.invalidateQueries({
        queryKey: forumQueryKeys.detail(forumId),
      });

      // Call user's onSettled if provided
      onSettled?.();
    },
  };

  // Execute the mutation hook
  const mutation = useMutation(mutationOptions);

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    isIdle: mutation.isIdle,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
    status: mutation.status,
    variables: mutation.variables,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Default export: useForum hook
 *
 * Primary hook for fetching and managing forum data.
 * Use this hook in components that need to display forum information.
 */
export default useForum;

/**
 * Named exports for additional utilities:
 * - useSubscribeToForum: Mutation hook for subscription management
 * - forumQueryKeys: Query key factory for cache management
 * - UseForumOptions: Type for hook configuration
 * - UseForumResult: Type for hook return value
 * - UseSubscribeToForumOptions: Type for mutation configuration
 * - UseSubscribeToForumResult: Type for mutation return value
 */
