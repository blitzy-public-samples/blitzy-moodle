/**
 * useDiscussion Hook
 * 
 * Custom React Query hook for managing discussion thread data and operations.
 * Provides:
 * - Discussion and posts fetching with automatic caching
 * - Nested post hierarchy reconstruction from flat API responses
 * - Reply creation with optimistic updates
 * - Post editing with conflict detection
 * - Post deletion with cascade handling
 * - Discussion subscription management
 * - Mark as read functionality
 * - Moderator actions (pin, lock, move, split)
 * - Post reporting
 * 
 * @module features/activities/forums/hooks/useDiscussion
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { 
  Post,
  DiscussionPost,
  CreatePostData,
  UpdatePostData
} from '../types/forum.types';
import * as forumApi from '../api/forumApi';

/**
 * Query key factory for discussion-related queries
 * Ensures consistent cache key structure across the application
 */
export const discussionKeys = {
  all: ['discussions'] as const,
  lists: () => [...discussionKeys.all, 'list'] as const,
  list: (filters: string) => [...discussionKeys.lists(), { filters }] as const,
  details: () => [...discussionKeys.all, 'detail'] as const,
  detail: (id: number) => [...discussionKeys.details(), id] as const,
};

/**
 * Transforms API Post objects to DiscussionPost objects
 * Converts snake_case to camelCase and adds UI-specific properties
 * 
 * @param apiPost - Post object from API
 * @returns Transformed DiscussionPost object
 */
function transformPost(apiPost: Post): DiscussionPost {
  // API may include additional user fields beyond the Post interface
  const apiPostWithUserData = apiPost as Post & {
    userid?: number;
    username?: string;
    userpictureurl?: string | null;
  };

  // Prioritize userid if explicitly provided (especially for deleted users),
  // otherwise use authorid
  const userId = apiPostWithUserData.userid !== undefined 
    ? apiPostWithUserData.userid 
    : apiPost.authorid ?? 0;
  
  // Use username from API if present, otherwise create placeholder
  // Handle deleted users (userid=0) with special placeholder
  const userName = apiPostWithUserData.username 
    ? apiPostWithUserData.username 
    : userId === 0 
      ? '[deleted user]' 
      : `User ${userId}`;
  
  // Use userpictureurl from API if present
  const userPictureUrl = apiPostWithUserData.userpictureurl || '';

  return {
    id: apiPost.id,
    discussionId: apiPost.discussionid,
    parentId: apiPost.parentid === 0 ? null : apiPost.parentid,
    subject: apiPost.subject,
    message: apiPost.message,
    userId: userId,
    userName: userName,
    userPictureUrl: userPictureUrl,
    created: apiPost.timecreated,
    modified: apiPost.timemodified,
    // Version for concurrent edit detection - use timemodified as proxy
    version: apiPost.timemodified,
    deleted: apiPost.deleted,
    hasAttachments: apiPost.hasattachments,
    // Attachments would come from separate API call or be included in response
    attachments: [],
    // Permission flags - these should come from the API based on user's capabilities
    // For now, we set default values
    canEdit: false,
    canDelete: false,
    canReply: true,
    // Initialize empty replies array - will be populated by buildPostHierarchy
    replies: [],
  };
}

/**
 * Reconstructs nested post hierarchy from flat array
 * Converts flat API response into tree structure with replies
 * 
 * @param flatPosts - Flat array of posts from API
 * @returns Array of root posts with nested replies
 */
function buildPostHierarchy(flatPosts: DiscussionPost[]): DiscussionPost[] {
  // Create a map for quick lookup
  const postMap = new Map<number, DiscussionPost>();
  const rootPosts: DiscussionPost[] = [];

  // First pass: create map and initialize replies arrays
  flatPosts.forEach(post => {
    postMap.set(post.id, { ...post, replies: [] });
  });

  // Second pass: build hierarchy
  flatPosts.forEach(post => {
    const postWithReplies = postMap.get(post.id)!;
    
    if (post.parentId === null || post.parentId === 0) {
      // Root level post
      rootPosts.push(postWithReplies);
    } else {
      // Child post - add to parent's replies
      const parent = postMap.get(post.parentId);
      if (parent) {
        parent.replies.push(postWithReplies);
      } else {
        // Broken parent reference - treat as root
        console.warn(`Post ${post.id} has invalid parent ${post.parentId}, treating as root`);
        rootPosts.push(postWithReplies);
      }
    }
  });

  return rootPosts;
}

/**
 * Options for useDiscussion hook callbacks
 */
export interface UseDiscussionOptions {
  retryCount?: number;
  onCreateSuccess?: (data: { post: Post; message?: string }) => void;
  onCreateError?: (error: Error) => void;
  onCreateSettled?: () => void;
  onEditSuccess?: (data: { post: Post; message?: string }) => void;
  onEditError?: (error: Error) => void;
  onEditSettled?: () => void;
  onEditConflict?: (data: { post: Post; conflictData: any }) => void;
  onDeleteSuccess?: (data: { softDeleted?: boolean; hardDeleted?: boolean; message?: string }) => void;
  onDeleteError?: (error: Error) => void;
  onLoadMoreError?: (error: Error) => void;
  onSubscribeSuccess?: (data: any) => void;
  onSubscribeError?: (error: Error) => void;
  onUnsubscribeSuccess?: (data: any) => void;
  onUnsubscribeError?: (error: Error) => void;
  onMarkAsReadSuccess?: (data: any) => void;
  onMarkAsReadError?: (error: Error) => void;
  onPinSuccess?: (data: any) => void;
  onPinError?: (error: Error) => void;
  onUnpinSuccess?: (data: any) => void;
  onUnpinError?: (error: Error) => void;
  onLockSuccess?: (data: any) => void;
  onLockError?: (error: Error) => void;
  onUnlockSuccess?: (data: any) => void;
  onUnlockError?: (error: Error) => void;
  onMoveSuccess?: (data: any) => void;
  onMoveError?: (error: Error) => void;
  onSplitSuccess?: (data: any) => void;
  onSplitError?: (error: Error) => void;
  onReportSuccess?: (data: any) => void;
  onReportError?: (error: Error) => void;
}

/**
 * Custom hook for discussion thread management
 * 
 * @param discussionId - ID of the discussion to manage
 * @param options - Optional callbacks for mutation events
 * @returns Object containing discussion data, posts, loading states, and mutation functions
 * 
 * @example
 * ```tsx
 * const { 
 *   discussion, 
 *   posts, 
 *   isLoading, 
 *   createReply, 
 *   editPost 
 * } = useDiscussion(discussionId, {
 *   onCreateSuccess: (data) => console.log('Post created', data),
 *   onEditConflict: (data) => showConflictDialog(data)
 * });
 * ```
 */
export function useDiscussion(discussionId: number, options?: UseDiscussionOptions) {
  const queryClient = useQueryClient();

  // Fetch discussion and posts
  const {
    data,
    isLoading,
    isSuccess,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: discussionKeys.detail(discussionId),
    queryFn: () => forumApi.getDiscussionPosts(discussionId),
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
    retry: options?.retryCount ?? 3, // Default to 3 retries, configurable via options
  });

  // Transform API Post objects to DiscussionPost objects and reconstruct hierarchy
  const posts = data?.posts 
    ? buildPostHierarchy(data.posts.map(transformPost)) 
    : undefined;
  const discussion = data?.discussion;

  // Extract pagination info
  const hasMore = data?.hasMore ?? false;
  const nextCursor = data?.nextCursor;

  /**
   * Load more posts for pagination
   */
  const loadMoreMutation = useMutation({
    mutationFn: async () => {
      if (!nextCursor) {
        throw new Error('No more posts to load');
      }
      return forumApi.fetchMorePosts(discussionId, nextCursor);
    },
    onSuccess: (newData) => {
      // Append new posts to existing data
      queryClient.setQueryData(discussionKeys.detail(discussionId), (old: any) => {
        if (!old) return old;

        return {
          ...old,
          posts: [...old.posts, ...newData.posts],
          hasMore: newData.hasMore,
          nextCursor: newData.nextCursor,
        };
      });
    },
    onError: (err) => {
      options?.onLoadMoreError?.(err as Error);
    },
  });

  /**
   * Load replies for a specific post (incremental loading)
   */
  const loadRepliesMutation = useMutation({
    mutationFn: async (parentPostId: number) => {
      return forumApi.fetchPostReplies(parentPostId);
    },
    onSuccess: (newData, _parentPostId) => {
      // Append new replies to the flat posts array in the cache
      // The hierarchy will be automatically rebuilt on next render
      queryClient.setQueryData(discussionKeys.detail(discussionId), (old: any) => {
        if (!old) return old;

        return {
          ...old,
          posts: [...old.posts, ...newData.replies],
        };
      });
    },
    onError: (err) => {
      // Error loading more posts - could notify user via toast
      console.error('Failed to load more posts:', err);
    },
  });

  /**
   * Create a reply to a post with optimistic update
   */
  const createReplyMutation = useMutation({
    mutationFn: async ({ 
      postData, 
      parentId 
    }: { 
      postData: CreatePostData; 
      parentId?: number;
    }) => {
      return forumApi.createPost(discussionId, { ...postData, parentId });
    },
    onMutate: async ({ postData, parentId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: discussionKeys.detail(discussionId) });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(discussionKeys.detail(discussionId));

      // Generate unique temporary ID for this optimistic post
      const optimisticId = Date.now() + Math.random();

      // Optimistically update cache
      queryClient.setQueryData(discussionKeys.detail(discussionId), (old: any) => {
        if (!old) return old;

        // Create optimistic Post object matching API structure
        const optimisticPost: Post = {
          id: optimisticId, // Unique temporary ID
          discussionid: discussionId,
          parentid: parentId || 0,
          authorid: 0, // Will be replaced by server
          timecreated: Math.floor(Date.now() / 1000),
          timemodified: Math.floor(Date.now() / 1000),
          mailed: false,
          subject: 'Re: ' + (old.discussion?.name || ''),
          message: postData.message,
          messageformat: 1, // HTML format
          messagetrust: false,
          hasattachments: postData.attachments ? postData.attachments.length > 0 : false,
          totalscore: 0,
          mailnow: false,
          deleted: false,
          privatereplyto: 0,
          wordcount: postData.message.split(/\s+/).length,
          charcount: postData.message.length,
        };

        const newPosts = [...old.posts, optimisticPost];

        return {
          ...old,
          posts: newPosts,
        };
      });

      return { previousData, optimisticId };
    },
    onError: (err, _variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousData) {
        queryClient.setQueryData(discussionKeys.detail(discussionId), context.previousData);
      }
      // Call user-provided error callback
      options?.onCreateError?.(err as Error);
    },
    onSuccess: (data) => {
      // Invalidate the lists query to refresh forum/discussion lists
      queryClient.invalidateQueries({ queryKey: discussionKeys.lists() });
      
      // Invalidate the detail query to trigger a refetch and ensure data consistency
      // The refetch will replace ALL optimistic posts with real data from server
      queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
      
      // Call user-provided success callback
      options?.onCreateSuccess?.(data);
    },
    onSettled: () => {
      // Call user-provided settled callback
      options?.onCreateSettled?.();
    },
  });

  /**
   * Edit a post with conflict detection
   */
  const editPostMutation = useMutation({
    mutationFn: async ({
      postId,
      postData,
    }: {
      postId: number;
      postData: UpdatePostData;
    }) => {
      return forumApi.updatePost(postId, postData);
    },
    onMutate: async ({ postId, postData }) => {
      await queryClient.cancelQueries({ queryKey: discussionKeys.detail(discussionId) });
      const previousData = queryClient.getQueryData(discussionKeys.detail(discussionId));

      // Optimistically update the post in flat array
      queryClient.setQueryData(discussionKeys.detail(discussionId), (old: any) => {
        if (!old) return old;

        return {
          ...old,
          posts: old.posts.map((post: Post) => 
            post.id === postId
              ? {
                  ...post,
                  message: postData.message,
                  timemodified: Math.floor(Date.now() / 1000),
                }
              : post
          ),
        };
      });

      return { previousData };
    },
    onError: (err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(discussionKeys.detail(discussionId), context.previousData);
      }
      
      // Check for conflict (409 status code)
      const error = err as any;
      if (error?.response?.status === 409) {
        // Call conflict callback with conflict data
        options?.onEditConflict?.({
          post: error.response.data?.post,
          conflictData: error.response.data,
        });
      }
      
      // Call user-provided error callback
      options?.onEditError?.(err as Error);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
      // Call user-provided success callback
      options?.onEditSuccess?.(data);
    },
    onSettled: () => {
      // Call user-provided settled callback
      options?.onEditSettled?.();
    },
  });

  /**
   * Delete a post with cascade handling
   */
  const deletePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      return forumApi.deletePost(postId);
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: discussionKeys.detail(discussionId) });
      const previousData = queryClient.getQueryData(discussionKeys.detail(discussionId));

      // Optimistically mark as deleted in flat array
      queryClient.setQueryData(discussionKeys.detail(discussionId), (old: any) => {
        if (!old) return old;

        return {
          ...old,
          posts: old.posts.map((post: Post) =>
            post.id === postId
              ? {
                  ...post,
                  deleted: true,
                  message: '[deleted]',
                }
              : post
          ),
        };
      });

      return { previousData, postId };
    },
    onError: (err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(discussionKeys.detail(discussionId), context.previousData);
      }
      // Call user-provided error callback
      options?.onDeleteError?.(err as Error);
    },
    onSuccess: (data, _variables, context) => {
      // Update cache based on delete type
      if (data.softDeleted) {
        // Keep the post in cache but mark as deleted (flat array)
        queryClient.setQueryData(discussionKeys.detail(discussionId), (old: any) => {
          if (!old) return old;

          return {
            ...old,
            posts: old.posts.map((post: Post) =>
              post.id === context?.postId
                ? {
                    ...post,
                    deleted: true,
                    message: '[deleted]',
                  }
                : post
            ),
          };
        });
      } else if (data.hardDeleted) {
        // Remove the post from cache (flat array)
        queryClient.setQueryData(discussionKeys.detail(discussionId), (old: any) => {
          if (!old) return old;

          return {
            ...old,
            posts: old.posts.filter((post: Post) => post.id !== context?.postId),
          };
        });
      }
      
      queryClient.invalidateQueries({ queryKey: discussionKeys.lists() });
      // Call user-provided success callback
      options?.onDeleteSuccess?.(data);
    },
  });

  /**
   * Subscribe to discussion with optimistic update
   */
  const subscribeMutation = useMutation({
    mutationFn: () => forumApi.subscribeDiscussion(discussionId),
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: discussionKeys.detail(discussionId) });
      const previousData = queryClient.getQueryData(discussionKeys.detail(discussionId));

      // Optimistically update subscription status
      queryClient.setQueryData(discussionKeys.detail(discussionId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          discussion: {
            ...old.discussion,
            subscribed: true,
          },
        };
      });

      return { previousData };
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(discussionKeys.detail(discussionId), context.previousData);
      }
      options?.onSubscribeError?.(err as Error);
    },
    onSuccess: (data) => {
      options?.onSubscribeSuccess?.(data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
    },
  });

  /**
   * Unsubscribe from discussion with optimistic update
   */
  const unsubscribeMutation = useMutation({
    mutationFn: () => forumApi.unsubscribeDiscussion(discussionId),
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: discussionKeys.detail(discussionId) });
      const previousData = queryClient.getQueryData(discussionKeys.detail(discussionId));

      // Optimistically update subscription status
      queryClient.setQueryData(discussionKeys.detail(discussionId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          discussion: {
            ...old.discussion,
            subscribed: false,
          },
        };
      });

      return { previousData };
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(discussionKeys.detail(discussionId), context.previousData);
      }
      options?.onUnsubscribeError?.(err as Error);
    },
    onSuccess: (data) => {
      options?.onUnsubscribeSuccess?.(data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
    },
  });

  /**
   * Mark discussion as read
   */
  const markAsReadMutation = useMutation({
    mutationFn: () => forumApi.markDiscussionRead(discussionId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: discussionKeys.detail(discussionId) });
      const previousData = queryClient.getQueryData(discussionKeys.detail(discussionId));

      // Optimistically update unread count
      queryClient.setQueryData(discussionKeys.detail(discussionId), (old: any) => {
        if (!old || !old.discussion) return old;
        return {
          ...old,
          discussion: {
            ...old.discussion,
            numUnread: 0,
          },
        };
      });

      return { previousData };
    },
    onSuccess: (data) => {
      options?.onMarkAsReadSuccess?.(data);
    },
    onError: (err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(discussionKeys.detail(discussionId), context.previousData);
      }
      options?.onMarkAsReadError?.(err as Error);
    },
  });

  /**
   * Pin discussion (moderator action)
   */
  const pinDiscussionMutation = useMutation({
    mutationFn: () => forumApi.pinDiscussion(discussionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
      queryClient.invalidateQueries({ queryKey: discussionKeys.lists() });
      options?.onPinSuccess?.(data);
    },
    onError: (err) => {
      options?.onPinError?.(err as Error);
    },
  });

  /**
   * Unpin discussion (moderator action)
   */
  const unpinDiscussionMutation = useMutation({
    mutationFn: () => forumApi.unpinDiscussion(discussionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
      queryClient.invalidateQueries({ queryKey: discussionKeys.lists() });
      options?.onUnpinSuccess?.(data);
    },
    onError: (err) => {
      options?.onUnpinError?.(err as Error);
    },
  });

  /**
   * Lock discussion (moderator action)
   */
  const lockDiscussionMutation = useMutation({
    mutationFn: () => forumApi.lockDiscussion(discussionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
      queryClient.invalidateQueries({ queryKey: discussionKeys.lists() });
      options?.onLockSuccess?.(data);
    },
    onError: (err) => {
      options?.onLockError?.(err as Error);
    },
  });

  /**
   * Unlock discussion (moderator action)
   */
  const unlockDiscussionMutation = useMutation({
    mutationFn: () => forumApi.unlockDiscussion(discussionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
      queryClient.invalidateQueries({ queryKey: discussionKeys.lists() });
      options?.onUnlockSuccess?.(data);
    },
    onError: (err) => {
      options?.onUnlockError?.(err as Error);
    },
  });

  /**
   * Move discussion to another forum (moderator action)
   */
  const moveDiscussionMutation = useMutation({
    mutationFn: (targetForumId: number) => forumApi.moveDiscussion(discussionId, targetForumId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: discussionKeys.all });
      options?.onMoveSuccess?.(data);
    },
    onError: (err) => {
      options?.onMoveError?.(err as Error);
    },
  });

  /**
   * Split discussion into separate thread (moderator action)
   */
  const splitDiscussionMutation = useMutation({
    mutationFn: (postId: number) => forumApi.splitDiscussion(discussionId, postId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: discussionKeys.all });
      options?.onSplitSuccess?.(data);
    },
    onError: (err) => {
      options?.onSplitError?.(err as Error);
    },
  });

  /**
   * Report a post for moderation
   */
  const reportPostMutation = useMutation({
    mutationFn: ({ postId, reason }: { postId: number; reason: string }) =>
      forumApi.reportPost(postId, reason),
    onSuccess: (data) => {
      options?.onReportSuccess?.(data);
    },
    onError: (err) => {
      options?.onReportError?.(err as Error);
    },
  });

  return {
    // Query state
    discussion,
    posts,
    isLoading,
    isSuccess,
    isError,
    error,
    refetch,

    // Mutation functions
    createReply: createReplyMutation.mutate,
    createReplyAsync: createReplyMutation.mutateAsync,
    isCreatingReply: createReplyMutation.isPending,

    editPost: editPostMutation.mutate,
    editPostAsync: editPostMutation.mutateAsync,
    isEditingPost: editPostMutation.isPending,

    deletePost: deletePostMutation.mutate,
    deletePostAsync: deletePostMutation.mutateAsync,
    isDeletingPost: deletePostMutation.isPending,

    subscribe: subscribeMutation.mutate,
    subscribeAsync: subscribeMutation.mutateAsync,
    isSubscribing: subscribeMutation.isPending,

    unsubscribe: unsubscribeMutation.mutate,
    unsubscribeAsync: unsubscribeMutation.mutateAsync,
    isUnsubscribing: unsubscribeMutation.isPending,

    markAsRead: markAsReadMutation.mutate,
    markAsReadAsync: markAsReadMutation.mutateAsync,
    isMarkingAsRead: markAsReadMutation.isPending,

    pinDiscussion: pinDiscussionMutation.mutate,
    pinDiscussionAsync: pinDiscussionMutation.mutateAsync,
    isPinning: pinDiscussionMutation.isPending,

    unpinDiscussion: unpinDiscussionMutation.mutate,
    unpinDiscussionAsync: unpinDiscussionMutation.mutateAsync,
    isUnpinning: unpinDiscussionMutation.isPending,

    lockDiscussion: lockDiscussionMutation.mutate,
    lockDiscussionAsync: lockDiscussionMutation.mutateAsync,
    isLocking: lockDiscussionMutation.isPending,

    unlockDiscussion: unlockDiscussionMutation.mutate,
    unlockDiscussionAsync: unlockDiscussionMutation.mutateAsync,
    isUnlocking: unlockDiscussionMutation.isPending,

    moveDiscussion: moveDiscussionMutation.mutate,
    moveDiscussionAsync: moveDiscussionMutation.mutateAsync,
    isMoving: moveDiscussionMutation.isPending,

    splitDiscussion: splitDiscussionMutation.mutate,
    splitDiscussionAsync: splitDiscussionMutation.mutateAsync,
    isSplitting: splitDiscussionMutation.isPending,

    reportPost: reportPostMutation.mutate,
    reportPostAsync: reportPostMutation.mutateAsync,
    isReportingPost: reportPostMutation.isPending,

    // Pagination
    hasMore,
    loadMore: loadMoreMutation.mutate,
    loadMoreAsync: loadMoreMutation.mutateAsync,
    isLoadingMore: loadMoreMutation.isPending,

    // Incremental reply loading
    loadReplies: loadRepliesMutation.mutate,
    loadRepliesAsync: loadRepliesMutation.mutateAsync,
    isLoadingReplies: loadRepliesMutation.isPending,
  };
}
