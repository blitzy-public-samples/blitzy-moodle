/**
 * Forum Data and Subscription Management Hooks
 *
 * Comprehensive React Query hook for managing forum data, subscriptions,
 * discussions, and read status. Provides a unified interface for all
 * forum-related operations with optimistic updates and caching.
 *
 * @module features/activities/forums/hooks/useForum
 * @packageDocumentation
 *
 * @example
 * ```tsx
 * // Basic usage for fetching forum data with subscription toggle
 * function ForumHeader({ forumId }: { forumId: number }) {
 *   const { forum, isLoading, toggleSubscription, isSubscribing } = useForum(forumId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *
 *   return (
 *     <div>
 *       <h1>{forum?.name}</h1>
 *       <button onClick={toggleSubscription} disabled={isSubscribing}>
 *         {forum?.subscribed ? 'Unsubscribe' : 'Subscribe'}
 *       </button>
 *     </div>
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

import { useCallback, useRef, useEffect } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type QueryClient,
} from '@tanstack/react-query';
import { AxiosError } from 'axios';

// Internal imports from dependency files
import {
  fetchForum,
  fetchDiscussions,
  subscribeForum,
  markForumRead,
  createDiscussion,
  pinDiscussion,
  unpinDiscussion,
  lockDiscussion,
  unlockDiscussion,
  forumKeys,
  type SubscriptionResponse,
  type MarkReadResponse,
  type PaginatedDiscussionsResponse,
  type DiscussionFetchParams,
  type DiscussionResponse,
  type ModerationResponse,
} from '../api/forumApi';
import type { Forum, DiscussionEnriched, CreateDiscussionData } from '../types/forum.types';

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
 * Re-exports from forumApi for consistency with the API layer.
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
  all: forumKeys.all,

  /** Key for specific forum detail by ID */
  detail: (forumId: number) => forumKeys.detail(forumId),

  /** Key for forum discussions (basic) */
  discussions: (forumId: number) => forumKeys.discussions(forumId),

  /** Key for forum discussions with params */
  discussionList: (forumId: number, params: DiscussionFetchParams) =>
    forumKeys.discussionList(forumId, params),

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
 * Pagination information for discussions
 */
export interface PaginationInfo {
  /** Current page number (1-indexed) */
  page: number;
  /** Items per page */
  perPage: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * Discussion options for optionally loading discussions
 */
export interface DiscussionOptions {
  /** Whether to load discussions */
  enabled?: boolean;
  /** Current page number (1-indexed) */
  page?: number;
  /** Items per page */
  perPage?: number;
  /** Sort field - matches API sortBy options */
  sortBy?: 'date' | 'replies' | 'author';
  /** Sort order ('asc' or 'desc') - maps to API's sortOrder */
  sortOrder?: 'asc' | 'desc';
  /** Filter criteria */
  filter?: 'all' | 'unread' | 'pinned';
  /** Search query string */
  search?: string;
  /** Group ID filter */
  groupid?: number;
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

  /**
   * Options for loading discussions alongside forum data
   */
  discussionOptions?: DiscussionOptions;
}

/**
 * Return type for the useForum hook
 *
 * Provides forum data, loading states, error information,
 * subscription controls, and discussion management.
 */
export interface UseForumResult {
  /** The fetched forum data, undefined while loading */
  forum: Forum | undefined;

  /** True during the initial data fetch (no cached data) */
  isLoading: boolean;

  /** True when fetching in the background (has cached data) */
  isFetching: boolean;

  /** True when refetching data (after initial load) */
  isRefetching: boolean;

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

  // Subscription management

  /**
   * Toggle forum subscription status
   * Subscribes if currently unsubscribed, unsubscribes if subscribed
   */
  toggleSubscription: () => void;

  /** True while subscription toggle is in progress */
  isSubscribing: boolean;

  // Read status management

  /**
   * Mark all posts in the forum as read
   */
  markAllAsRead: () => void;

  /** True while marking all as read is in progress */
  isMarkingRead: boolean;

  // Discussion management (optional - only when discussionOptions provided)

  /** Array of discussions if discussionOptions is provided */
  discussions?: DiscussionEnriched[];

  /** Pagination information for discussions */
  pagination?: PaginationInfo;

  /** Prefetch the next page of discussions */
  prefetchNextPage?: () => void;

  /** True while discussions are loading */
  isLoadingDiscussions?: boolean;

  // Discussion creation

  /**
   * Create a new discussion in the forum
   * @param data - Discussion data including subject, message, and optional attachments
   * @returns Promise that resolves when discussion is created
   */
  createDiscussion: (data: CreateDiscussionData) => Promise<DiscussionResponse>;

  /** True while creating a discussion */
  isCreatingDiscussion: boolean;

  // Discussion moderation

  /**
   * Pin a discussion to the top of the forum
   * @param discussionId - ID of the discussion to pin
   * @returns Promise that resolves when discussion is pinned
   */
  pinDiscussion: (discussionId: number) => Promise<ModerationResponse>;

  /** True while pinning a discussion */
  isPinning: boolean;

  /**
   * Unpin a discussion
   * @param discussionId - ID of the discussion to unpin
   * @returns Promise that resolves when discussion is unpinned
   */
  unpinDiscussion: (discussionId: number) => Promise<ModerationResponse>;

  /**
   * Lock a discussion to prevent new replies
   * @param discussionId - ID of the discussion to lock
   * @param reason - Optional reason for locking
   * @returns Promise that resolves when discussion is locked
   */
  lockDiscussion: (discussionId: number, reason?: string) => Promise<ModerationResponse>;

  /** True while locking a discussion */
  isLocking: boolean;

  /**
   * Unlock a previously locked discussion
   * @param discussionId - ID of the discussion to unlock
   * @returns Promise that resolves when discussion is unlocked
   */
  unlockDiscussion: (discussionId: number) => Promise<ModerationResponse>;
}

/**
 * Type alias for UseForumResult for backwards compatibility
 * @deprecated Use UseForumResult instead
 */
export type UseForumReturn = UseForumResult;

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
 * Serializable error type from createSerializableError in interceptors
 * The interceptor converts AxiosError to plain Error with these properties attached
 */
interface SerializableApiError extends Error {
  status?: number;
  statusText?: string;
  code?: string;
  url?: string;
  method?: string;
  customError?: {
    message?: string;
    code?: string;
    status?: number;
    details?: Record<string, unknown>;
  };
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
  // Check for native AxiosError first
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (status && status >= 400 && status < 500 && status !== 429) {
      return false;
    }
  }

  // Check for serialized errors (createSerializableError converts AxiosError to plain Error)
  // The interceptors attach status as a property on the Error object
  if (error instanceof Error) {
    const serializableError = error as SerializableApiError;
    
    // Check status property (attached by createSerializableError)
    const status = serializableError.status ?? serializableError.customError?.status;
    if (status && status >= 400 && status < 500 && status !== 429) {
      return false;
    }
    
    // Also check for specific error messages as a fallback
    const message = error.message.toLowerCase();
    if (
      message.includes('not found') ||
      message.includes('not have permission') ||
      message.includes('must be logged in') ||
      message.includes('invalid data') ||
      message.includes('access denied') ||
      message.includes('forbidden') ||
      message.includes('unauthorized') ||
      message.includes('permission denied')
    ) {
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

/**
 * Apply optimistic update for mark all as read
 *
 * @param queryClient - React Query client instance
 * @param forumId - ID of the forum
 * @returns Previous forum data for rollback
 */
function applyOptimisticMarkReadUpdate(
  queryClient: QueryClient,
  forumId: number
): OptimisticUpdateContext {
  // Cancel any outgoing refetches
  queryClient.cancelQueries({ queryKey: forumQueryKeys.detail(forumId) });

  // Snapshot previous value for rollback
  const previousForum = queryClient.getQueryData<Forum>(
    forumQueryKeys.detail(forumId)
  );

  // Optimistically update unread count to 0
  if (previousForum) {
    queryClient.setQueryData<Forum>(forumQueryKeys.detail(forumId), {
      ...previousForum,
      unreadCount: 0,
    });
  }

  return { previousForum };
}

// ============================================================================
// HOOKS
// ============================================================================

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
 * Custom React Query hook for fetching and managing forum data
 *
 * Provides forum metadata including name, description, type, subscription status,
 * discussion count, and user permissions. Includes subscription toggle,
 * mark all as read functionality, and optional discussion loading.
 *
 * @param forumId - The ID of the forum to fetch
 * @param options - Optional configuration for query behavior
 * @returns Object containing forum data, loading states, error info, and utility functions
 *
 * @example
 * ```tsx
 * // Basic usage
 * function ForumPage({ forumId }: { forumId: number }) {
 *   const {
 *     forum,
 *     isLoading,
 *     isError,
 *     error,
 *     toggleSubscription,
 *     isSubscribing,
 *     refetch
 *   } = useForum(forumId);
 *
 *   if (isLoading) return <Skeleton variant="rectangular" height={200} />;
 *   if (isError) return <Alert severity="error">{error?.message}</Alert>;
 *
 *   return (
 *     <Paper>
 *       <Typography variant="h4">{forum?.name}</Typography>
 *       <Button
 *         onClick={toggleSubscription}
 *         disabled={isSubscribing}
 *       >
 *         {forum?.subscribed ? 'Unsubscribe' : 'Subscribe'}
 *       </Button>
 *     </Paper>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With discussions
 * const { forum, discussions, pagination, prefetchNextPage } = useForum(forumId, {
 *   discussionOptions: {
 *     enabled: true,
 *     page: 1,
 *     perPage: 20,
 *     sortBy: 'date'
 *   }
 * });
 * ```
 */
export function useForum(
  forumId: number,
  options: UseForumOptions = {}
): UseForumResult {
  const queryClient = useQueryClient();

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
    discussionOptions,
  } = options;

  // ========================================================================
  // FORUM DATA QUERY
  // ========================================================================

  // Build query options - queryKey matches forumKeys.detail() return type
  const queryOptions: UseQueryOptions<Forum, Error, Forum, readonly ['forums', 'detail', number]> = {
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
    // Handle retry configuration:
    // - false: Never retry
    // - true: Use default retry count with shouldRetry logic
    // - number: Use that count with shouldRetry logic
    retry: retry === false
      ? false
      : typeof retry === 'number' || retry === true
        ? (failureCount: number, error: Error) => shouldRetry(failureCount, error)
        : retry,
    retryDelay: getRetryDelay,
    refetchOnWindowFocus,
    refetchOnMount,
    select,
  };

  // Execute the forum query
  const forumQuery = useQuery(queryOptions);

  // Track previous states to detect changes for callbacks
  const { data: forum, isSuccess, isError, error } = forumQuery;
  const prevIsSuccess = usePreviousValue(isSuccess);
  const prevIsError = usePreviousValue(isError);

  // Trigger onSuccess callback when data becomes available
  if (isSuccess && !prevIsSuccess && forum && onSuccess) {
    onSuccess(forum);
  }

  // Trigger onError callback when error occurs
  if (isError && !prevIsError && error && onError) {
    onError(error);
  }

  // ========================================================================
  // SUBSCRIPTION MUTATION
  // ========================================================================

  const subscriptionMutation = useMutation<
    SubscriptionResponse,
    Error,
    boolean,
    OptimisticUpdateContext
  >({
    mutationFn: async (subscribe: boolean) => {
      try {
        // subscribeForum(forumId, subscribe) handles both subscribe and unsubscribe
        return await subscribeForum(forumId, subscribe);
      } catch (error) {
        throw toError(error);
      }
    },

    // Apply optimistic update before mutation
    onMutate: async (subscribe: boolean) => {
      return applyOptimisticSubscriptionUpdate(queryClient, forumId, subscribe);
    },

    // Handle successful mutation
    onSuccess: (data: SubscriptionResponse) => {
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
    },

    // Handle failed mutation - rollback optimistic update
    onError: (_error: Error, _variables: boolean, context) => {
      rollbackOptimisticUpdate(queryClient, forumId, context);
    },

    // Always called after mutation completes
    onSettled: () => {
      // Invalidate to ensure cache is in sync with server
      queryClient.invalidateQueries({
        queryKey: forumQueryKeys.detail(forumId),
      });
    },
  });

  // Toggle subscription based on current state
  const toggleSubscription = useCallback(() => {
    if (forum) {
      subscriptionMutation.mutate(!forum.subscribed);
    }
  }, [forum, subscriptionMutation]);

  // ========================================================================
  // MARK ALL AS READ MUTATION
  // ========================================================================

  const markReadMutation = useMutation<
    MarkReadResponse,
    Error,
    void,
    OptimisticUpdateContext
  >({
    mutationFn: async () => {
      try {
        return await markForumRead(forumId);
      } catch (error) {
        throw toError(error);
      }
    },

    // Apply optimistic update
    onMutate: async () => {
      return applyOptimisticMarkReadUpdate(queryClient, forumId);
    },

    // Handle success - update cache with actual count
    onSuccess: (data: MarkReadResponse) => {
      const currentForum = queryClient.getQueryData<Forum>(
        forumQueryKeys.detail(forumId)
      );

      if (currentForum) {
        queryClient.setQueryData<Forum>(forumQueryKeys.detail(forumId), {
          ...currentForum,
          unreadCount: data.unreadCount,
        });
      }

      // Also invalidate discussion queries to update their unread counts
      queryClient.invalidateQueries({
        queryKey: ['forums', forumId, 'discussions'],
      });
    },

    // Rollback on error
    onError: (_error: Error, _variables: void, context) => {
      rollbackOptimisticUpdate(queryClient, forumId, context);
    },

    // Always invalidate after settlement
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: forumQueryKeys.detail(forumId),
      });
    },
  });

  const markAllAsRead = useCallback(() => {
    markReadMutation.mutate();
  }, [markReadMutation]);

  // ========================================================================
  // DISCUSSIONS QUERY (Optional)
  // ========================================================================

  // Load discussions if discussionOptions is provided (unless explicitly disabled)
  // This allows tests and consumers to pass { sortBy: 'date' } without needing enabled: true
  const shouldLoadDiscussions = discussionOptions !== undefined && 
    (discussionOptions.enabled !== false);

  // Build discussion fetch params (excluding forumId which is passed separately)
  const discussionParams: DiscussionFetchParams = {
    page: discussionOptions?.page ?? 1,
    perPage: discussionOptions?.perPage ?? 20,
    sortBy: discussionOptions?.sortBy ?? 'date',
    sortOrder: discussionOptions?.sortOrder ?? 'desc',
    filter: discussionOptions?.filter ?? 'all',
    search: discussionOptions?.search,
    groupid: discussionOptions?.groupid,
  };

  const discussionsQuery = useQuery<PaginatedDiscussionsResponse, Error>({
    queryKey: forumQueryKeys.discussionList(forumId, discussionParams),
    queryFn: async () => {
      try {
        return await fetchDiscussions(forumId, discussionParams);
      } catch (error) {
        throw toError(error);
      }
    },
    enabled: enabled && forumId > 0 && shouldLoadDiscussions,
    staleTime,
    gcTime,
  });

  // Prefetch next page of discussions
  const prefetchNextPage = useCallback(() => {
    // Access pagination from meta (primary) or legacy root properties
    const meta = discussionsQuery.data?.meta;
    if (!meta) return;

    const currentPage = meta.page ?? discussionParams.page ?? 1;
    const totalPages = meta.totalPages ?? 1;

    if (currentPage < totalPages) {
      const nextParams: DiscussionFetchParams = {
        ...discussionParams,
        page: currentPage + 1,
      };
      queryClient.prefetchQuery({
        queryKey: forumQueryKeys.discussionList(forumId, nextParams),
        queryFn: () => fetchDiscussions(forumId, nextParams),
      });
    }
  }, [discussionsQuery.data, discussionParams, forumId, queryClient]);

  // ========================================================================
  // CREATE DISCUSSION MUTATION
  // ========================================================================

  const createDiscussionMutation = useMutation<
    DiscussionResponse,
    Error,
    CreateDiscussionData
  >({
    mutationFn: async (data: CreateDiscussionData) => {
      try {
        return await createDiscussion(forumId, data);
      } catch (error) {
        throw toError(error);
      }
    },
    onSuccess: () => {
      // Invalidate discussions list to refetch with new discussion
      queryClient.invalidateQueries({
        queryKey: forumQueryKeys.discussions(forumId),
      });
      // Invalidate forum data to update discussion count
      queryClient.invalidateQueries({
        queryKey: forumQueryKeys.detail(forumId),
      });
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  // ========================================================================
  // PIN/UNPIN DISCUSSION MUTATION
  // ========================================================================

  const pinMutation = useMutation<ModerationResponse, Error, number>({
    mutationFn: async (discussionId: number) => {
      try {
        return await pinDiscussion(discussionId);
      } catch (error) {
        throw toError(error);
      }
    },
    onSuccess: () => {
      // Invalidate discussions list to reflect pin status change
      queryClient.invalidateQueries({
        queryKey: forumQueryKeys.discussions(forumId),
      });
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  const unpinMutationFn = useCallback(async (discussionId: number) => {
    try {
      return await unpinDiscussion(discussionId);
    } catch (error) {
      throw toError(error);
    }
  }, []);

  const unpinMutation = useMutation<ModerationResponse, Error, number>({
    mutationFn: unpinMutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: forumQueryKeys.discussions(forumId),
      });
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  // ========================================================================
  // LOCK/UNLOCK DISCUSSION MUTATION
  // ========================================================================

  interface LockMutationParams {
    discussionId: number;
    reason?: string;
  }

  const lockMutation = useMutation<ModerationResponse, Error, LockMutationParams>({
    mutationFn: async ({ discussionId, reason }: LockMutationParams) => {
      try {
        return await lockDiscussion(discussionId, reason);
      } catch (error) {
        throw toError(error);
      }
    },
    onSuccess: () => {
      // Invalidate discussions list to reflect lock status change
      queryClient.invalidateQueries({
        queryKey: forumQueryKeys.discussions(forumId),
      });
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  const unlockMutationFn = useCallback(async (discussionId: number) => {
    try {
      return await unlockDiscussion(discussionId);
    } catch (error) {
      throw toError(error);
    }
  }, []);

  const unlockMutation = useMutation<ModerationResponse, Error, number>({
    mutationFn: unlockMutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: forumQueryKeys.discussions(forumId),
      });
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  // ========================================================================
  // RETURN VALUE
  // ========================================================================

  // Build the base result
  const result: UseForumResult = {
    // Forum data
    forum: forumQuery.data,
    isLoading: forumQuery.isLoading,
    isFetching: forumQuery.isFetching,
    isRefetching: forumQuery.isFetching && !forumQuery.isLoading,
    isPending: forumQuery.isPending,
    isError: forumQuery.isError,
    isSuccess: forumQuery.isSuccess,
    error: forumQuery.error,
    refetch: forumQuery.refetch,
    status: forumQuery.status,
    dataUpdatedAt: forumQuery.dataUpdatedAt,
    errorUpdatedAt: forumQuery.errorUpdatedAt,
    failureCount: forumQuery.failureCount,
    failureReason: forumQuery.failureReason,

    // Subscription management
    toggleSubscription,
    isSubscribing: subscriptionMutation.isPending,

    // Mark as read management
    markAllAsRead,
    isMarkingRead: markReadMutation.isPending,

    // Discussion creation
    createDiscussion: (data: CreateDiscussionData) =>
      createDiscussionMutation.mutateAsync(data),
    isCreatingDiscussion: createDiscussionMutation.isPending,

    // Discussion moderation - pin/unpin
    pinDiscussion: (discussionId: number) =>
      pinMutation.mutateAsync(discussionId),
    isPinning: pinMutation.isPending,
    unpinDiscussion: (discussionId: number) =>
      unpinMutation.mutateAsync(discussionId),

    // Discussion moderation - lock/unlock
    lockDiscussion: (discussionId: number, reason?: string) =>
      lockMutation.mutateAsync({ discussionId, reason }),
    isLocking: lockMutation.isPending,
    unlockDiscussion: (discussionId: number) =>
      unlockMutation.mutateAsync(discussionId),
  };

  // Add discussion data if enabled
  if (shouldLoadDiscussions) {
    // Use discussions from data (legacy) or data.items (new structure)
    result.discussions = discussionsQuery.data?.discussions ?? discussionsQuery.data?.data?.items;
    // Map meta to our PaginationInfo interface
    const meta = discussionsQuery.data?.meta;
    if (meta) {
      result.pagination = {
        page: meta.page,
        perPage: meta.perPage,
        total: discussionsQuery.data?.total ?? discussionsQuery.data?.data?.total ?? 0,
        totalPages: meta.totalPages,
      };
    }
    result.prefetchNextPage = prefetchNextPage;
    result.isLoadingDiscussions = discussionsQuery.isLoading;
  }

  return result;
}

// ============================================================================
// ADDITIONAL HOOKS FOR BACKWARD COMPATIBILITY
// ============================================================================

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
 *   const { forum } = useForum(forumId);
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
 */
export function useSubscribeToForum(
  forumId: number,
  options: UseSubscribeToForumOptions = {}
): UseSubscribeToForumResult {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onMutate, onSettled } = options;

  // Execute the mutation hook
  const mutation = useMutation<
    SubscriptionResponse,
    Error,
    boolean,
    OptimisticUpdateContext
  >({
    mutationFn: async (subscribe: boolean) => {
      try {
        // subscribeForum(forumId, subscribe) handles both subscribe and unsubscribe
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
  });

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
