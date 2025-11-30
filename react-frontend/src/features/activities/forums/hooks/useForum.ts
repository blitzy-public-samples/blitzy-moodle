/**
 * useForum Hook
 *
 * Custom React hook for managing forum data and interactions using React Query.
 * Provides forum details, discussions list with pagination, and mutation handlers
 * for subscription, read tracking, discussion creation, and moderation actions.
 *
 * Features:
 * - Forum details fetching with automatic caching
 * - Discussion list fetching with pagination, sorting, and filtering
 * - Subscription toggle with optimistic updates
 * - Mark all discussions as read
 * - Create new discussions
 * - Moderator actions: pin/unpin, lock/unlock discussions
 * - Background data refresh with configurable staleTime
 * - Automatic cache invalidation after mutations
 * - Next page prefetching for improved UX
 *
 * @module features/activities/forums/hooks/useForum
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getForum,
  getDiscussions,
  subscribeForum,
  unsubscribeForum,
  markForumRead,
  createDiscussion as createDiscussionApi,
  pinDiscussion as pinDiscussionApi,
  unpinDiscussion as unpinDiscussionApi,
  lockDiscussion as lockDiscussionApi,
  unlockDiscussion as unlockDiscussionApi,
} from '../api/forumApi';
import type {
  Forum,
  Discussion,
  DiscussionEnriched,
  DiscussionListOptions,
  CreateDiscussionData,
} from '../types/forum.types';
import type { PaginatedResponse } from '@/types/api';

// ============================================================================
// QUERY KEY FACTORIES
// ============================================================================

/**
 * Query key factory for forum-related queries
 * Provides consistent query key structure for React Query caching
 */
export const forumKeys = {
  /** All forum queries */
  all: ['forums'] as const,
  /** All forum list queries */
  lists: () => [...forumKeys.all, 'list'] as const,
  /** Single forum by ID */
  detail: (id: number) => [...forumKeys.all, id] as const,
  /** Forum discussions */
  discussions: (id: number, options?: DiscussionListOptions) =>
    [...forumKeys.detail(id), 'discussions', options] as const,
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for configuring the useForum hook behavior
 */
export interface UseForumOptions {
  /** Whether to enable the query (default: true) */
  enabled?: boolean;
  /** Stale time in milliseconds (default: 5 minutes) */
  staleTime?: number;
  /** Whether to refetch on window focus (default: true) */
  refetchOnWindowFocus?: boolean;
  /** Data transformation function */
  select?: (data: Forum) => Forum;
  /** Callback executed on successful forum fetch */
  onSuccess?: (data: Forum) => void;
  /** Callback executed on forum fetch error */
  onError?: (error: Error) => void;
  /** Initial discussion list options */
  discussionOptions?: DiscussionListOptions;
}

/**
 * Return type of the useForum hook
 */
export interface UseForumReturn {
  // Forum data
  /** Forum details */
  forum: Forum | undefined;
  /** Loading state during initial fetch */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Success state */
  isSuccess: boolean;
  /** Fetching state (includes background refetch) */
  isFetching: boolean;
  /** Refetching state (background refetch only) */
  isRefetching: boolean;
  /** Error object if any */
  error: Error | null;

  // Discussions data
  /** Array of discussions in the forum (enriched with user info and reply counts) */
  discussions: DiscussionEnriched[] | undefined;
  /** Pagination metadata */
  pagination:
    | {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
      }
    | undefined;

  // Mutation states
  /** Subscription toggle mutation loading state */
  isSubscribing: boolean;
  /** Mark read mutation loading state */
  isMarkingRead: boolean;
  /** Create discussion mutation loading state */
  isCreatingDiscussion: boolean;
  /** Pin discussion mutation loading state */
  isPinning: boolean;
  /** Lock discussion mutation loading state */
  isLocking: boolean;

  // Actions
  /** Toggle forum subscription */
  toggleSubscription: () => void;
  /** Mark all discussions as read */
  markAllAsRead: () => void;
  /** Create a new discussion */
  createDiscussion: (data: CreateDiscussionData) => Promise<void>;
  /** Pin a discussion (moderator only) */
  pinDiscussion: (discussionId: number) => Promise<void>;
  /** Unpin a discussion (moderator only) */
  unpinDiscussion: (discussionId: number) => Promise<void>;
  /** Lock a discussion (moderator only) */
  lockDiscussion: (discussionId: number) => Promise<void>;
  /** Unlock a discussion (moderator only) */
  unlockDiscussion: (discussionId: number) => Promise<void>;
  /** Prefetch next page of discussions */
  prefetchNextPage: (() => void) | undefined;
  /** Refetch forum data */
  refetch: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Custom hook for managing forum data and interactions
 *
 * @param forumId - Forum module ID
 * @param options - Configuration options
 * @returns Forum data, discussions, and mutation handlers
 *
 * @example
 * ```tsx
 * function ForumPage({ forumId }: { forumId: number }) {
 *   const {
 *     forum,
 *     discussions,
 *     isLoading,
 *     toggleSubscription,
 *     createDiscussion,
 *   } = useForum(forumId);
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <h1>{forum?.name}</h1>
 *       <Button onClick={toggleSubscription}>
 *         {forum?.subscribed ? 'Unsubscribe' : 'Subscribe'}
 *       </Button>
 *       <DiscussionList discussions={discussions} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useForum(forumId: number, options: UseForumOptions = {}): UseForumReturn {
  const queryClient = useQueryClient();
  const {
    enabled = true,
    staleTime = 5 * 60 * 1000, // 5 minutes default
    refetchOnWindowFocus = true,
    select,
    onSuccess,
    onError,
    discussionOptions: initialDiscussionOptions,
  } = options;

  // Local state for discussion options
  const [discussionOptions] = useState<DiscussionListOptions | undefined>(initialDiscussionOptions);

  // ============================================================================
  // QUERIES
  // ============================================================================

  /**
   * Fetch forum details
   */
  const forumQuery = useQuery<Forum>({
    queryKey: forumKeys.detail(forumId),
    queryFn: () => getForum(forumId),
    enabled,
    staleTime,
    refetchOnWindowFocus,
    select,
  });

  // Handle onSuccess callback using useEffect (React Query v5 removed query callbacks)
  const prevDataRef = useRef<Forum | undefined>();
  useEffect(() => {
    const { data } = forumQuery;
    if (forumQuery.isSuccess && data && data !== prevDataRef.current) {
      prevDataRef.current = data;
      onSuccess?.(data);
    }
  }, [forumQuery, onSuccess]);

  // Handle onError callback using useEffect
  const prevErrorRef = useRef<Error | null>(null);
  useEffect(() => {
    if (forumQuery.isError && forumQuery.error && forumQuery.error !== prevErrorRef.current) {
      prevErrorRef.current = forumQuery.error;
      onError?.(forumQuery.error);
    }
  }, [forumQuery.isError, forumQuery.error, onError]);

  /**
   * Fetch forum discussions with pagination
   */
  const discussionsQuery = useQuery({
    queryKey: forumKeys.discussions(forumId, discussionOptions),
    queryFn: () => getDiscussions(forumId, discussionOptions),
    enabled: enabled && !!forumQuery.data,
    staleTime,
    // Keep previous data while fetching new page
    placeholderData: (previousData) => previousData,
  });

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  /**
   * Toggle forum subscription mutation with optimistic updates
   */
  const subscriptionMutation = useMutation({
    mutationFn: async (subscribed: boolean) => {
      if (subscribed) {
        return await unsubscribeForum(forumId);
      }
      // subscribeForum requires (forumId, subscribe: boolean)
      return await subscribeForum(forumId, true);
    },
    // Optimistic update: immediately update subscription state
    onMutate: async (subscribed) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: forumKeys.detail(forumId) });

      // Snapshot previous value
      const previousForum = queryClient.getQueryData<Forum>(forumKeys.detail(forumId));

      // Optimistically update to new value
      if (previousForum) {
        queryClient.setQueryData<Forum>(forumKeys.detail(forumId), {
          ...previousForum,
          subscribed: !subscribed,
        });
      }

      // Return context with previous value for rollback
      return { previousForum };
    },
    // Rollback on error
    onError: (_error, _subscribed, context) => {
      if (context?.previousForum) {
        queryClient.setQueryData<Forum>(forumKeys.detail(forumId), context.previousForum);
      }
    },
    // Always refetch after error or success
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: forumKeys.detail(forumId) });
    },
  });

  /**
   * Mark all discussions as read mutation
   */
  const markReadMutation = useMutation({
    mutationFn: () => markForumRead(forumId),
    onSuccess: (response) => {
      // Update forum unread count in cache
      const previousForum = queryClient.getQueryData<Forum>(forumKeys.detail(forumId));
      if (previousForum) {
        queryClient.setQueryData<Forum>(forumKeys.detail(forumId), {
          ...previousForum,
          unreadCount: response.unreadCount,
        });
      }
      // Invalidate discussions to refresh read status
      void queryClient.invalidateQueries({
        queryKey: forumKeys.discussions(forumId),
      });
    },
  });

  /**
   * Create new discussion mutation
   */
  const createDiscussionMutation = useMutation({
    mutationFn: (data: CreateDiscussionData) => createDiscussionApi(forumId, data),
    onSuccess: () => {
      // Invalidate discussions list to show new discussion
      void queryClient.invalidateQueries({
        queryKey: forumKeys.discussions(forumId),
      });
      // Invalidate forum to update discussion count
      void queryClient.invalidateQueries({
        queryKey: forumKeys.detail(forumId),
      });
    },
  });

  /**
   * Pin discussion mutation (moderator only)
   */
  const pinDiscussionMutation = useMutation({
    mutationFn: (discussionId: number) => pinDiscussionApi(discussionId),
    onSuccess: (response) => {
      // Update discussion in cache if discussion is returned
      if (!response.discussion) return;
      const updatedDiscussion = response.discussion;
      
      const discussionsData = queryClient.getQueryData<PaginatedResponse<Discussion>>(
        forumKeys.discussions(forumId, discussionOptions)
      );
      if (discussionsData?.data && Array.isArray(discussionsData.data.items)) {
        const updatedData = {
          ...discussionsData,
          data: {
            ...discussionsData.data,
            items: discussionsData.data.items.map((d) =>
              d.id === updatedDiscussion.id ? updatedDiscussion : d
            ),
          },
        };
        queryClient.setQueryData(forumKeys.discussions(forumId, discussionOptions), updatedData);
      }
    },
  });

  /**
   * Unpin discussion mutation (moderator only)
   */
  const unpinDiscussionMutation = useMutation({
    mutationFn: (discussionId: number) => unpinDiscussionApi(discussionId),
    onSuccess: (response) => {
      // Update discussion in cache if discussion is returned
      if (!response.discussion) return;
      const updatedDiscussion = response.discussion;
      
      const discussionsData = queryClient.getQueryData<PaginatedResponse<Discussion>>(
        forumKeys.discussions(forumId, discussionOptions)
      );
      if (discussionsData?.data && Array.isArray(discussionsData.data.items)) {
        const updatedData = {
          ...discussionsData,
          data: {
            ...discussionsData.data,
            items: discussionsData.data.items.map((d) =>
              d.id === updatedDiscussion.id ? updatedDiscussion : d
            ),
          },
        };
        queryClient.setQueryData(forumKeys.discussions(forumId, discussionOptions), updatedData);
      }
    },
  });

  /**
   * Lock discussion mutation (moderator only)
   */
  const lockDiscussionMutation = useMutation({
    mutationFn: (discussionId: number) => lockDiscussionApi(discussionId),
    onSuccess: (response) => {
      // Update discussion in cache if discussion is returned
      if (!response.discussion) return;
      const updatedDiscussion = response.discussion;
      
      const discussionsData = queryClient.getQueryData<PaginatedResponse<Discussion>>(
        forumKeys.discussions(forumId, discussionOptions)
      );
      if (discussionsData?.data && Array.isArray(discussionsData.data.items)) {
        const updatedData = {
          ...discussionsData,
          data: {
            ...discussionsData.data,
            items: discussionsData.data.items.map((d) =>
              d.id === updatedDiscussion.id ? updatedDiscussion : d
            ),
          },
        };
        queryClient.setQueryData(forumKeys.discussions(forumId, discussionOptions), updatedData);
      }
    },
  });

  /**
   * Unlock discussion mutation (moderator only)
   */
  const unlockDiscussionMutation = useMutation({
    mutationFn: (discussionId: number) => unlockDiscussionApi(discussionId),
    onSuccess: (response) => {
      // Update discussion in cache if discussion is returned
      if (!response.discussion) return;
      const updatedDiscussion = response.discussion;
      
      const discussionsData = queryClient.getQueryData<PaginatedResponse<Discussion>>(
        forumKeys.discussions(forumId, discussionOptions)
      );
      if (discussionsData?.data && Array.isArray(discussionsData.data.items)) {
        const updatedData = {
          ...discussionsData,
          data: {
            ...discussionsData.data,
            items: discussionsData.data.items.map((d) =>
              d.id === updatedDiscussion.id ? updatedDiscussion : d
            ),
          },
        };
        queryClient.setQueryData(forumKeys.discussions(forumId, discussionOptions), updatedData);
      }
    },
  });

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  /**
   * Toggle subscription to the forum
   */
  const toggleSubscription = useCallback(() => {
    const { data } = forumQuery;
    const currentSubscribed = data?.subscribed ?? false;
    subscriptionMutation.mutate(currentSubscribed);
  }, [forumQuery, subscriptionMutation]);

  /**
   * Mark all discussions as read
   */
  const markAllAsRead = useCallback(() => {
    markReadMutation.mutate();
  }, [markReadMutation]);

  /**
   * Create a new discussion
   */
  const createDiscussion = useCallback(
    async (data: CreateDiscussionData) => {
      await createDiscussionMutation.mutateAsync(data);
    },
    [createDiscussionMutation]
  );

  /**
   * Pin a discussion (moderator only)
   */
  const pinDiscussion = useCallback(
    async (discussionId: number) => {
      await pinDiscussionMutation.mutateAsync(discussionId);
    },
    [pinDiscussionMutation]
  );

  /**
   * Unpin a discussion (moderator only)
   */
  const unpinDiscussion = useCallback(
    async (discussionId: number) => {
      await unpinDiscussionMutation.mutateAsync(discussionId);
    },
    [unpinDiscussionMutation]
  );

  /**
   * Lock a discussion (moderator only)
   */
  const lockDiscussion = useCallback(
    async (discussionId: number) => {
      await lockDiscussionMutation.mutateAsync(discussionId);
    },
    [lockDiscussionMutation]
  );

  /**
   * Unlock a discussion (moderator only)
   */
  const unlockDiscussion = useCallback(
    async (discussionId: number) => {
      await unlockDiscussionMutation.mutateAsync(discussionId);
    },
    [unlockDiscussionMutation]
  );

  /**
   * Prefetch next page of discussions for improved UX
   */
  const prefetchNextPage = useCallback(() => {
    // Pagination properties are directly on meta, not nested under meta.pagination
    if (discussionsQuery.data?.meta) {
      const { page, totalPages } = discussionsQuery.data.meta;
      if (page < totalPages) {
        const nextPageOptions = {
          ...discussionOptions,
          page: page + 1,
        };
        void queryClient.prefetchQuery({
          queryKey: forumKeys.discussions(forumId, nextPageOptions),
          queryFn: () => getDiscussions(forumId, nextPageOptions),
        });
      }
    }
  }, [discussionsQuery.data?.meta, discussionOptions, forumId, queryClient]);

  /**
   * Refetch forum data
   */
  const refetch = useCallback(() => {
    void forumQuery.refetch();
    void discussionsQuery.refetch();
  }, [forumQuery, discussionsQuery]);

  // ============================================================================
  // RETURN VALUE
  // ============================================================================

  return {
    // Forum data
    forum: forumQuery.data,
    isLoading: forumQuery.isLoading,
    isError: forumQuery.isError,
    isSuccess: forumQuery.isSuccess,
    isFetching: forumQuery.isFetching,
    isRefetching: forumQuery.isRefetching,
    error: forumQuery.error,

    // Discussions data
    discussions: discussionsQuery.data?.data.items,
    // Pagination properties: page/perPage/totalPages from meta, total from data
    pagination: discussionsQuery.data?.meta
      ? {
          page: discussionsQuery.data.meta.page,
          perPage: discussionsQuery.data.meta.perPage,
          total: discussionsQuery.data.data.total,
          totalPages: discussionsQuery.data.meta.totalPages,
        }
      : undefined,

    // Mutation states
    isSubscribing: subscriptionMutation.isPending,
    isMarkingRead: markReadMutation.isPending,
    isCreatingDiscussion: createDiscussionMutation.isPending,
    isPinning: pinDiscussionMutation.isPending,
    isLocking: lockDiscussionMutation.isPending,

    // Actions
    toggleSubscription,
    markAllAsRead,
    createDiscussion,
    pinDiscussion,
    unpinDiscussion,
    lockDiscussion,
    unlockDiscussion,
    prefetchNextPage: discussionsQuery.data?.meta ? prefetchNextPage : undefined,
    refetch,
  };
}

export default useForum;
