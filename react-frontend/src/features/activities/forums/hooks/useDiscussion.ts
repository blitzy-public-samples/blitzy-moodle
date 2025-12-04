/**
 * useDiscussion Hook
 *
 * Custom React Query hook for managing discussion thread data and operations.
 * Provides comprehensive functionality for forum discussion management including:
 * - Discussion and posts fetching with automatic caching (3-minute stale time)
 * - Nested post hierarchy reconstruction from flat API responses
 * - Reply creation with optimistic updates
 * - Post editing with conflict detection and rollback
 * - Post deletion with cascade handling
 * - Mark as read functionality with optimistic status updates
 *
 * @module features/activities/forums/hooks/useDiscussion
 *
 * @example
 * ```tsx
 * // Using the main useDiscussion hook
 * const {
 *   discussion,
 *   posts,
 *   isLoading,
 *   createReply,
 *   editPost,
 *   deletePost,
 *   markAsRead
 * } = useDiscussion(discussionId);
 *
 * // Using standalone hooks
 * const { mutate: createPost, isPending } = useCreatePost(discussionId);
 * const { mutate: updatePost } = useUpdatePost(discussionId);
 * const { mutate: removePost } = useDeletePost(discussionId);
 * const { mutate: markRead } = useMarkDiscussionRead(discussionId);
 * ```
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Post,
  PostResponse,
  DiscussionPost,
  CreatePostData,
  UpdatePostData,
  DiscussionDetail,
  Author,
} from '../types/forum.types';
import {
  getDiscussionPosts,
  fetchMorePosts,
  fetchPostReplies,
  createPost,
  updatePost,
  deletePost,
  subscribeDiscussion,
  unsubscribeDiscussion,
  markDiscussionRead,
  pinDiscussion,
  unpinDiscussion,
  lockDiscussion,
  unlockDiscussion,
  moveDiscussion,
  splitDiscussion,
  reportPost,
  transformApiPostsToCanonical,
} from '../api/forumApi';
import type {
  DiscussionWithPosts,
  SubscriptionResponse,
  MarkReadResponse,
  ModerationResponse,
  ReportResponse,
} from '../api/forumApi';

// ============================================================================
// QUERY KEY FACTORY
// ============================================================================

/**
 * Query key factory for discussion-related queries
 * Ensures consistent cache key structure across the application
 *
 * Following the pattern: ['discussions', discussionId, 'posts'] for granular cache management
 */
export const discussionKeys = {
  /** Base key for all discussion queries */
  all: ['discussions'] as const,

  /** Key for discussion list queries */
  lists: () => [...discussionKeys.all, 'list'] as const,

  /** Key for filtered discussion list */
  list: (filters: string) => [...discussionKeys.lists(), { filters }] as const,

  /** Key for all discussion detail queries */
  details: () => [...discussionKeys.all, 'detail'] as const,

  /** Key for specific discussion detail with posts */
  detail: (id: number) => [...discussionKeys.details(), id] as const,

  /** Key for discussion posts - matches ['discussions', discussionId, 'posts'] pattern */
  posts: (discussionId: number) => ['discussions', discussionId, 'posts'] as const,
};

// ============================================================================
// HELPER FUNCTIONS - POST TRANSFORMATION
// ============================================================================

/**
 * Transforms API Post objects to DiscussionPost objects for UI rendering
 * Converts snake_case to camelCase and adds UI-specific properties
 *
 * @param apiPost - Post object from API with snake_case properties
 * @returns Transformed DiscussionPost object with camelCase properties
 */
function transformPost(apiPost: Post): DiscussionPost {
  // API may include additional user fields beyond the Post interface
  const apiPostWithUserData = apiPost as Post & {
    userid?: number;
    username?: string;
    userpictureurl?: string | null;
    userfullname?: string;
  };

  // Prioritize userid if explicitly provided (especially for deleted users),
  // otherwise use authorid
  const userId = apiPostWithUserData.userid ?? apiPost.authorid ?? 0;

  // Use username from API if present, otherwise create placeholder
  // Handle deleted users (userid=0) with special placeholder
  const userName = apiPostWithUserData.username
    ? apiPostWithUserData.username
    : userId === 0
      ? '[deleted user]'
      : `User ${userId}`;

  // Use userpictureurl from API if present
  const userPictureUrl = apiPostWithUserData.userpictureurl ?? '';

  // Build author object for the post
  const author: Author = {
    id: userId,
    username: userName,
    fullName: apiPostWithUserData.userfullname ?? userName,
    pictureUrl: userPictureUrl,
    profileUrl: userId > 0 ? `/user/profile.php?id=${userId}` : undefined,
  };

  return {
    id: apiPost.id,
    discussionId: apiPost.discussionid,
    parentId: apiPost.parentid ?? 0,
    author,
    subject: apiPost.subject ?? '',
    message: apiPost.message,
    messageFormat: apiPost.messageformat ?? 1,
    created: apiPost.timecreated,
    modified: apiPost.timemodified,
    hasAttachments: apiPost.hasattachments ?? false,
    attachments: [],
    deleted: apiPost.deleted ?? false,
    isPrivateReply: (apiPost.privatereplyto ?? 0) > 0,
    privateReplyTo: apiPost.privatereplyto,
    wordCount: apiPost.wordcount ?? 0,
    charCount: apiPost.charcount ?? 0,
    canEdit: false,
    canDelete: false,
    canReply: true,
    children: [],
    depth: 0,
    isRead: false,
    isPending: false,
  };
}

/**
 * Builds a hierarchical post tree from a flat array of posts
 * Creates parent-child relationships based on parentId field
 *
 * @param posts - Flat array of DiscussionPost objects
 * @returns Array of root-level posts with nested children
 */
function buildPostHierarchy(posts: DiscussionPost[]): DiscussionPost[] {
  if (!posts || posts.length === 0) {
    return [];
  }

  // Create a map for quick lookup
  const postMap = new Map<number, DiscussionPost>();

  // First pass: create map with clean children arrays
  posts.forEach((post) => {
    postMap.set(post.id, {
      ...post,
      children: [],
    });
  });

  // Second pass: build hierarchy
  const rootPosts: DiscussionPost[] = [];

  posts.forEach((post) => {
    const currentPost = postMap.get(post.id);
    if (!currentPost) return;

    if (post.parentId === 0 || post.parentId === null || post.parentId === undefined) {
      // Root post (no parent)
      currentPost.depth = 0;
      rootPosts.push(currentPost);
    } else {
      // Child post - find parent and add to children
      const parentPost = postMap.get(post.parentId);
      if (parentPost) {
        currentPost.depth = (parentPost.depth ?? 0) + 1;
        parentPost.children = parentPost.children ?? [];
        parentPost.children.push(currentPost);
      } else {
        // Parent not found - treat as root (orphaned post)
        currentPost.depth = 0;
        rootPosts.push(currentPost);
      }
    }
  });

  // Sort children recursively by creation time
  const sortChildren = (posts: DiscussionPost[]): DiscussionPost[] => {
    return posts
      .sort((a, b) => a.created - b.created)
      .map((post) => ({
        ...post,
        children: post.children ? sortChildren(post.children) : [],
      }));
  };

  return sortChildren(rootPosts);
}

/**
 * Constructs a DiscussionDetail object from API response data
 * Aggregates metadata from discussion and posts
 *
 * @param data - API response containing discussion and posts
 * @returns DiscussionDetail object or undefined if data is invalid
 */
function constructDiscussionDetail(
  data: DiscussionWithPosts | undefined
): DiscussionDetail | undefined {
  if (!data?.discussion) {
    return undefined;
  }

  // Extract unique authors from posts for participant count
  const uniqueAuthors = new Set<number>();
  data.posts.forEach((post) => {
    if (post.authorid > 0) {
      uniqueAuthors.add(post.authorid);
    }
  });

  const disc = data.discussion;

  return {
    id: disc.id,
    forumId: disc.forum,
    courseId: disc.course ?? 0,
    name: disc.name,
    subject: disc.name,
    message: '', // First post message handled separately
    timeCreated: disc.timestart ?? Math.floor(Date.now() / 1000),
    timeModified: disc.timemodified ?? disc.timestart ?? Math.floor(Date.now() / 1000),
    userCreated: disc.userid ?? 0,
    userModified: disc.usermodified ?? disc.userid ?? 0,
    pinned: disc.pinned === 1 || disc.pinned === true,
    locked: disc.locked === 1 || disc.locked === true,
    numPosts: data.totalPosts ?? data.posts.length,
    numParticipants: uniqueAuthors.size,
    numReplies: data.posts.length - 1,
    subscribed: data.subscribed ?? false,
    unreadCount: 0,
  };
}

// ============================================================================
// OPTIONS INTERFACES
// ============================================================================

/**
 * Options for useDiscussion hook callbacks
 * Allows consumers to hook into mutation lifecycle events
 */
export interface UseDiscussionOptions {
  /** Number of retry attempts for failed queries */
  retryCount?: number;

  // Create post callbacks
  onCreateSuccess?: (data: PostResponse) => void;
  onCreateError?: (error: Error) => void;
  onCreateSettled?: () => void;

  // Edit post callbacks
  onEditSuccess?: (data: PostResponse) => void;
  onEditError?: (error: Error) => void;
  onEditSettled?: () => void;
  onEditConflict?: (data: { post: Post; conflictData: Post }) => void;

  // Delete post callbacks
  onDeleteSuccess?: (data: { softDeleted?: boolean; hardDeleted?: boolean; message?: string }) => void;
  onDeleteError?: (error: Error) => void;

  // Load more callbacks
  onLoadMoreError?: (error: Error) => void;

  // Subscription callbacks
  onSubscribeSuccess?: (data: SubscriptionResponse) => void;
  onSubscribeError?: (error: Error) => void;
  onUnsubscribeSuccess?: (data: SubscriptionResponse) => void;
  onUnsubscribeError?: (error: Error) => void;

  // Mark as read callbacks
  onMarkAsReadSuccess?: (data: MarkReadResponse) => void;
  onMarkAsReadError?: (error: Error) => void;

  // Moderation callbacks
  onPinSuccess?: (data: ModerationResponse) => void;
  onPinError?: (error: Error) => void;
  onUnpinSuccess?: (data: ModerationResponse) => void;
  onUnpinError?: (error: Error) => void;
  onLockSuccess?: (data: ModerationResponse) => void;
  onLockError?: (error: Error) => void;
  onUnlockSuccess?: (data: ModerationResponse) => void;
  onUnlockError?: (error: Error) => void;
  onMoveSuccess?: (data: ModerationResponse) => void;
  onMoveError?: (error: Error) => void;
  onSplitSuccess?: (data: ModerationResponse) => void;
  onSplitError?: (error: Error) => void;

  // Report callbacks
  onReportSuccess?: (data: ReportResponse) => void;
  onReportError?: (error: Error) => void;
}

/**
 * Options for standalone useCreatePost hook
 */
export interface UseCreatePostOptions {
  onSuccess?: (data: PostResponse) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}

/**
 * Options for standalone useUpdatePost hook
 */
export interface UseUpdatePostOptions {
  onSuccess?: (data: PostResponse) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
  onConflict?: (data: { post: Post; conflictData: Post }) => void;
}

/**
 * Options for standalone useDeletePost hook
 */
export interface UseDeletePostOptions {
  onSuccess?: (data: { softDeleted?: boolean; hardDeleted?: boolean; message?: string }) => void;
  onError?: (error: Error) => void;
}

/**
 * Options for standalone useMarkDiscussionRead hook
 */
export interface UseMarkDiscussionReadOptions {
  onSuccess?: (data: MarkReadResponse) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// STANDALONE HOOKS
// ============================================================================

/**
 * Standalone hook for creating a post/reply in a discussion
 *
 * Creates a new post or reply with optimistic updates and automatic
 * cache invalidation. Supports both root posts and nested replies.
 *
 * @param discussionId - ID of the discussion to post in
 * @param options - Optional callbacks for mutation events
 * @returns Mutation object with mutate function and state
 *
 * @example
 * ```tsx
 * const { mutate: createPost, isPending } = useCreatePost(discussionId, {
 *   onSuccess: (data) => toast.success('Post created!'),
 * });
 *
 * // Create a reply
 * createPost({ message: 'My reply', parentPostId: parentId });
 * ```
 */
export function useCreatePost(discussionId: number, options?: UseCreatePostOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postData,
      parentPostId,
    }: {
      postData: CreatePostData;
      parentPostId?: number;
    }) => {
      return createPost({ ...postData, discussionId, parentPostId });
    },
    onMutate: async ({ postData, parentPostId }) => {
      // Cancel outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: discussionKeys.detail(discussionId) });

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueryData<DiscussionWithPosts>(
        discussionKeys.detail(discussionId)
      );

      // Generate temporary ID for optimistic post
      const optimisticId = Date.now() + Math.random();

      // Optimistically add post to cache
      queryClient.setQueryData<DiscussionWithPosts>(
        discussionKeys.detail(discussionId),
        (old) => {
          if (!old) return old;

          const optimisticPost: Post = {
            id: optimisticId,
            discussionid: discussionId,
            parentid: parentPostId ?? 0,
            authorid: 0, // Will be replaced by server
            timecreated: Math.floor(Date.now() / 1000),
            timemodified: Math.floor(Date.now() / 1000),
            mailed: false,
            subject: postData.subject ?? `Re: ${old.discussion?.name ?? ''}`,
            message: postData.message,
            messageformat: 1,
            messagetrust: false,
            hasattachments: postData.attachments ? postData.attachments.length > 0 : false,
            totalscore: 0,
            mailnow: false,
            deleted: false,
            privatereplyto: 0,
            wordcount: postData.message.split(/\s+/).length,
            charcount: postData.message.length,
          };

          return {
            ...old,
            posts: [...old.posts, optimisticPost],
          };
        }
      );

      return { previousData, optimisticId };
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(discussionKeys.detail(discussionId), context.previousData);
      }
      options?.onError?.(err);
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh with real data
      void queryClient.invalidateQueries({ queryKey: discussionKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
      options?.onSuccess?.(data);
    },
    onSettled: () => {
      options?.onSettled?.();
    },
  });
}

/**
 * Standalone hook for updating an existing post
 *
 * Updates post content with optimistic updates and conflict detection.
 * Automatically rolls back on error and handles 409 conflict responses.
 *
 * @param discussionId - ID of the discussion containing the post
 * @param options - Optional callbacks for mutation events
 * @returns Mutation object with mutate function and state
 *
 * @example
 * ```tsx
 * const { mutate: editPost, isPending } = useUpdatePost(discussionId, {
 *   onConflict: (data) => showConflictDialog(data),
 * });
 *
 * editPost({ postId: 123, message: 'Updated content' });
 * ```
 */
export function useUpdatePost(discussionId: number, options?: UseUpdatePostOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      postData,
    }: {
      postId: number;
      postData: UpdatePostData;
    }) => {
      return updatePost({ ...postData, postId });
    },
    onMutate: async ({ postId, postData }) => {
      await queryClient.cancelQueries({ queryKey: discussionKeys.detail(discussionId) });
      const previousData = queryClient.getQueryData<DiscussionWithPosts>(
        discussionKeys.detail(discussionId)
      );

      // Optimistically update the post
      queryClient.setQueryData<DiscussionWithPosts>(
        discussionKeys.detail(discussionId),
        (old) => {
          if (!old) return old;

          return {
            ...old,
            posts: old.posts.map((post: Post) =>
              post.id === postId
                ? {
                    ...post,
                    message: postData.message,
                    subject: postData.subject ?? post.subject,
                    timemodified: Math.floor(Date.now() / 1000),
                  }
                : post
            ),
          };
        }
      );

      return { previousData };
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(discussionKeys.detail(discussionId), context.previousData);
      }

      // Check for conflict (409 status code)
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof err.response === 'object' &&
        err.response !== null &&
        'status' in err.response &&
        err.response.status === 409
      ) {
        const responseData = 'data' in err.response ? err.response.data : undefined;
        const conflictPost =
          typeof responseData === 'object' && responseData !== null
            ? 'post' in responseData
              ? (responseData.post as Post)
              : 'currentPost' in responseData
                ? (responseData.currentPost as Post)
                : undefined
            : undefined;

        if (conflictPost && typeof responseData === 'object' && responseData !== null) {
          options?.onConflict?.({
            post: conflictPost,
            conflictData: responseData as Post,
          });
        }
      }

      options?.onError?.(err);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
      options?.onSuccess?.(data);
    },
    onSettled: () => {
      options?.onSettled?.();
    },
  });
}

/**
 * Standalone hook for deleting a post
 *
 * Deletes a post with optimistic removal from cache. Handles both
 * soft delete (marks as deleted) and hard delete (removes completely).
 *
 * @param discussionId - ID of the discussion containing the post
 * @param options - Optional callbacks for mutation events
 * @returns Mutation object with mutate function and state
 *
 * @example
 * ```tsx
 * const { mutate: removePost, isPending } = useDeletePost(discussionId, {
 *   onSuccess: (data) => {
 *     if (data.softDeleted) toast.info('Post marked as deleted');
 *     else toast.success('Post removed');
 *   },
 * });
 *
 * removePost(postId);
 * ```
 */
export function useDeletePost(discussionId: number, options?: UseDeletePostOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: number) => {
      return deletePost(postId);
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: discussionKeys.detail(discussionId) });
      const previousData = queryClient.getQueryData<DiscussionWithPosts>(
        discussionKeys.detail(discussionId)
      );

      // Optimistically mark as deleted
      queryClient.setQueryData<DiscussionWithPosts>(
        discussionKeys.detail(discussionId),
        (old) => {
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
        }
      );

      return { previousData, postId };
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(discussionKeys.detail(discussionId), context.previousData);
      }
      options?.onError?.(err);
    },
    onSuccess: (data, _variables, context) => {
      // Update cache based on delete type
      if (data.softDeleted) {
        // Keep post but marked as deleted
        queryClient.setQueryData<DiscussionWithPosts>(
          discussionKeys.detail(discussionId),
          (old) => {
            if (!old) return old;

            return {
              ...old,
              posts: old.posts.map((post: Post) =>
                post.id === context?.postId
                  ? { ...post, deleted: true, message: '[deleted]' }
                  : post
              ),
            };
          }
        );
      } else if (data.hardDeleted) {
        // Remove post completely
        queryClient.setQueryData<DiscussionWithPosts>(
          discussionKeys.detail(discussionId),
          (old) => {
            if (!old) return old;

            return {
              ...old,
              posts: old.posts.filter((post: Post) => post.id !== context?.postId),
            };
          }
        );
      }

      void queryClient.invalidateQueries({ queryKey: discussionKeys.lists() });
      options?.onSuccess?.(data);
    },
  });
}

/**
 * Standalone hook for marking a discussion as read
 *
 * Marks all posts in a discussion as read with optimistic UI update.
 * Updates unread count immediately for responsive UX.
 *
 * @param discussionId - ID of the discussion to mark as read
 * @param options - Optional callbacks for mutation events
 * @returns Mutation object with mutate function and state
 *
 * @example
 * ```tsx
 * const { mutate: markRead, isPending } = useMarkDiscussionRead(discussionId, {
 *   onSuccess: () => toast.success('Marked as read'),
 * });
 *
 * // Call when user views discussion
 * useEffect(() => {
 *   markRead();
 * }, [markRead]);
 * ```
 */
export function useMarkDiscussionRead(
  discussionId: number,
  options?: UseMarkDiscussionReadOptions
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markDiscussionRead(discussionId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: discussionKeys.detail(discussionId) });
      const previousData = queryClient.getQueryData<DiscussionWithPosts>(
        discussionKeys.detail(discussionId)
      );

      // Optimistically update unread count to 0
      queryClient.setQueryData<DiscussionWithPosts>(
        discussionKeys.detail(discussionId),
        (old) => {
          if (!old?.discussion) return old;

          return {
            ...old,
            discussion: {
              ...old.discussion,
              unreadCount: 0,
            },
          };
        }
      );

      return { previousData };
    },
    onSuccess: (data) => {
      options?.onSuccess?.(data);
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(discussionKeys.detail(discussionId), context.previousData);
      }
      options?.onError?.(err);
    },
  });
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Custom hook for comprehensive discussion thread management
 *
 * Provides complete functionality for viewing and interacting with
 * a forum discussion, including:
 * - Fetching discussion data and posts with automatic caching
 * - Transforming flat post arrays into nested tree structure
 * - Creating replies with optimistic updates
 * - Editing posts with conflict detection
 * - Deleting posts with cascade handling
 * - Managing discussion subscriptions
 * - Marking discussions as read
 * - Moderator actions (pin, lock, move, split)
 * - Post reporting
 *
 * Uses 3-minute stale time for discussion content freshness.
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
 *   isError,
 *   error,
 *   refetch,
 *   createReply,
 *   isCreatingReply,
 *   editPost,
 *   deletePost,
 *   markAsRead,
 *   subscribe,
 *   unsubscribe,
 *   hasMore,
 *   loadMore,
 * } = useDiscussion(discussionId, {
 *   onCreateSuccess: (data) => console.log('Post created', data),
 *   onEditConflict: (data) => showConflictDialog(data),
 * });
 *
 * if (isLoading) return <Spinner />;
 * if (isError) return <ErrorMessage error={error} />;
 *
 * return (
 *   <DiscussionView
 *     discussion={discussion}
 *     posts={posts}
 *     onReply={(parentId, content) => createReply({ postData: { message: content }, parentId })}
 *   />
 * );
 * ```
 */
export function useDiscussion(discussionId: number, options?: UseDiscussionOptions) {
  const queryClient = useQueryClient();

  // ========== MAIN QUERY ==========
  // Fetch discussion and posts with 3-minute stale time
  const {
    data,
    isLoading,
    isFetching,
    isSuccess,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: discussionKeys.detail(discussionId),
    queryFn: () => getDiscussionPosts(discussionId),
    staleTime: 3 * 60 * 1000, // 3 minutes
    refetchOnWindowFocus: true,
    retry: options?.retryCount ?? 3,
  });

  // Transform posts to hierarchical structure
  const posts = data?.posts ? buildPostHierarchy(data.posts.map(transformPost)) : undefined;
  const discussion = constructDiscussionDetail(data);

  // Pagination info
  const hasMore = data?.hasMore ?? false;
  const nextCursor = data?.nextCursor;

  // ========== LOAD MORE MUTATION ==========
  const loadMoreMutation = useMutation({
    mutationFn: async () => {
      if (!nextCursor) {
        throw new Error('No more posts to load');
      }
      return fetchMorePosts(discussionId, nextCursor);
    },
    onSuccess: (newData) => {
      queryClient.setQueryData<DiscussionWithPosts>(
        discussionKeys.detail(discussionId),
        (old) => {
          if (!old) return old;

          return {
            ...old,
            posts: [...old.posts, ...newData.posts],
            hasMore: newData.hasMore,
            nextCursor: newData.nextCursor,
          };
        }
      );
    },
    onError: (err) => {
      options?.onLoadMoreError?.(err);
    },
  });

  // ========== LOAD REPLIES MUTATION ==========
  const loadRepliesMutation = useMutation({
    mutationFn: async (parentPostId: number) => {
      return fetchPostReplies(parentPostId);
    },
    onSuccess: (newData) => {
      const canonicalPosts = transformApiPostsToCanonical(newData);
      queryClient.setQueryData<DiscussionWithPosts>(
        discussionKeys.detail(discussionId),
        (old) => {
          if (!old) return old;

          return {
            ...old,
            posts: [...old.posts, ...canonicalPosts],
          };
        }
      );
    },
    onError: (err) => {
      console.error('Failed to load replies:', err);
    },
  });

  // ========== CREATE REPLY MUTATION ==========
  const createReplyMutation = useMutation({
    mutationFn: async ({
      postData,
      parentId,
    }: {
      postData: CreatePostData;
      parentId?: number;
    }) => {
      return createPost({ ...postData, discussionId, parentPostId: parentId });
    },
    onMutate: async ({ postData, parentId }) => {
      await queryClient.cancelQueries({ queryKey: discussionKeys.detail(discussionId) });
      const previousData = queryClient.getQueryData(discussionKeys.detail(discussionId));
      const optimisticId = Date.now() + Math.random();

      queryClient.setQueryData<DiscussionWithPosts>(
        discussionKeys.detail(discussionId),
        (old) => {
          if (!old) return old;

          const optimisticPost: Post = {
            id: optimisticId,
            discussionid: discussionId,
            parentid: parentId ?? 0,
            authorid: 0,
            timecreated: Math.floor(Date.now() / 1000),
            timemodified: Math.floor(Date.now() / 1000),
            mailed: false,
            subject: postData.subject ?? `Re: ${old.discussion?.name ?? ''}`,
            message: postData.message,
            messageformat: 1,
            messagetrust: false,
            hasattachments: postData.attachments ? postData.attachments.length > 0 : false,
            totalscore: 0,
            mailnow: false,
            deleted: false,
            privatereplyto: 0,
            wordcount: postData.message.split(/\s+/).length,
            charcount: postData.message.length,
          };

          return {
            ...old,
            posts: [...old.posts, optimisticPost],
          };
        }
      );

      return { previousData, optimisticId };
    },
    onError: (err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(discussionKeys.detail(discussionId), context.previousData);
      }
      options?.onCreateError?.(err);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: discussionKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
      options?.onCreateSuccess?.(data);
    },
    onSettled: () => {
      options?.onCreateSettled?.();
    },
  });

  // ========== EDIT POST MUTATION ==========
  const editPostMutation = useMutation({
    mutationFn: async ({
      postId,
      postData,
    }: {
      postId: number;
      postData: UpdatePostData;
    }) => {
      return updatePost({ ...postData, postId });
    },
    onMutate: async ({ postId, postData }) => {
      await queryClient.cancelQueries({ queryKey: discussionKeys.detail(discussionId) });
      const previousData = queryClient.getQueryData(discussionKeys.detail(discussionId));

      queryClient.setQueryData<DiscussionWithPosts>(
        discussionKeys.detail(discussionId),
        (old) => {
          if (!old) return old;

          return {
            ...old,
            posts: old.posts.map((post: Post) =>
              post.id === postId
                ? {
                    ...post,
                    message: postData.message,
                    subject: postData.subject ?? post.subject,
                    timemodified: Math.floor(Date.now() / 1000),
                  }
                : post
            ),
          };
        }
      );

      return { previousData };
    },
    onError: (err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(discussionKeys.detail(discussionId), context.previousData);
      }

      // Check for conflict (409 status code)
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof err.response === 'object' &&
        err.response !== null &&
        'status' in err.response &&
        err.response.status === 409
      ) {
        const responseData = 'data' in err.response ? err.response.data : undefined;
        const conflictPost =
          typeof responseData === 'object' && responseData !== null
            ? 'post' in responseData
              ? (responseData.post as Post)
              : 'currentPost' in responseData
                ? (responseData.currentPost as Post)
                : undefined
            : undefined;

        if (conflictPost && typeof responseData === 'object' && responseData !== null) {
          options?.onEditConflict?.({
            post: conflictPost,
            conflictData: responseData as Post,
          });
        }
      }

      options?.onEditError?.(err);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
      options?.onEditSuccess?.(data);
    },
    onSettled: () => {
      options?.onEditSettled?.();
    },
  });

  // ========== DELETE POST MUTATION ==========
  const deletePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      return deletePost(postId);
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: discussionKeys.detail(discussionId) });
      const previousData = queryClient.getQueryData(discussionKeys.detail(discussionId));

      queryClient.setQueryData<DiscussionWithPosts>(
        discussionKeys.detail(discussionId),
        (old) => {
          if (!old) return old;

          return {
            ...old,
            posts: old.posts.map((post: Post) =>
              post.id === postId
                ? { ...post, deleted: true, message: '[deleted]' }
                : post
            ),
          };
        }
      );

      return { previousData, postId };
    },
    onError: (err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(discussionKeys.detail(discussionId), context.previousData);
      }
      options?.onDeleteError?.(err);
    },
    onSuccess: (data, _variables, context) => {
      if (data.softDeleted) {
        queryClient.setQueryData<DiscussionWithPosts>(
          discussionKeys.detail(discussionId),
          (old) => {
            if (!old) return old;

            return {
              ...old,
              posts: old.posts.map((post: Post) =>
                post.id === context?.postId
                  ? { ...post, deleted: true, message: '[deleted]' }
                  : post
              ),
            };
          }
        );
      } else if (data.hardDeleted) {
        queryClient.setQueryData<DiscussionWithPosts>(
          discussionKeys.detail(discussionId),
          (old) => {
            if (!old) return old;

            return {
              ...old,
              posts: old.posts.filter((post: Post) => post.id !== context?.postId),
            };
          }
        );
      }

      void queryClient.invalidateQueries({ queryKey: discussionKeys.lists() });
      options?.onDeleteSuccess?.(data);
    },
  });

  // ========== SUBSCRIBE MUTATION ==========
  const subscribeMutation = useMutation({
    mutationFn: () => subscribeDiscussion(discussionId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: discussionKeys.detail(discussionId) });
      const previousData = queryClient.getQueryData(discussionKeys.detail(discussionId));

      queryClient.setQueryData<DiscussionWithPosts>(
        discussionKeys.detail(discussionId),
        (old) => {
          if (!old) return old;
          return { ...old, subscribed: true };
        }
      );

      return { previousData };
    },
    onError: (err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(discussionKeys.detail(discussionId), context.previousData);
      }
      options?.onSubscribeError?.(err);
    },
    onSuccess: (data) => {
      options?.onSubscribeSuccess?.(data);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
    },
  });

  // ========== UNSUBSCRIBE MUTATION ==========
  const unsubscribeMutation = useMutation({
    mutationFn: () => unsubscribeDiscussion(discussionId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: discussionKeys.detail(discussionId) });
      const previousData = queryClient.getQueryData(discussionKeys.detail(discussionId));

      queryClient.setQueryData<DiscussionWithPosts>(
        discussionKeys.detail(discussionId),
        (old) => {
          if (!old) return old;
          return { ...old, subscribed: false };
        }
      );

      return { previousData };
    },
    onError: (err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(discussionKeys.detail(discussionId), context.previousData);
      }
      options?.onUnsubscribeError?.(err);
    },
    onSuccess: (data) => {
      options?.onUnsubscribeSuccess?.(data);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
    },
  });

  // ========== MARK AS READ MUTATION ==========
  const markAsReadMutation = useMutation({
    mutationFn: () => markDiscussionRead(discussionId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: discussionKeys.detail(discussionId) });
      const previousData = queryClient.getQueryData(discussionKeys.detail(discussionId));

      queryClient.setQueryData<DiscussionWithPosts>(
        discussionKeys.detail(discussionId),
        (old) => {
          if (!old?.discussion) return old;

          return {
            ...old,
            discussion: {
              ...old.discussion,
              unreadCount: 0,
            },
          };
        }
      );

      return { previousData };
    },
    onSuccess: (data) => {
      options?.onMarkAsReadSuccess?.(data);
    },
    onError: (err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(discussionKeys.detail(discussionId), context.previousData);
      }
      options?.onMarkAsReadError?.(err);
    },
  });

  // ========== PIN DISCUSSION MUTATION ==========
  const pinDiscussionMutation = useMutation({
    mutationFn: () => pinDiscussion(discussionId),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
      void queryClient.invalidateQueries({ queryKey: discussionKeys.lists() });
      options?.onPinSuccess?.(data);
    },
    onError: (err) => {
      options?.onPinError?.(err);
    },
  });

  // ========== UNPIN DISCUSSION MUTATION ==========
  const unpinDiscussionMutation = useMutation({
    mutationFn: () => unpinDiscussion(discussionId),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
      void queryClient.invalidateQueries({ queryKey: discussionKeys.lists() });
      options?.onUnpinSuccess?.(data);
    },
    onError: (err) => {
      options?.onUnpinError?.(err);
    },
  });

  // ========== LOCK DISCUSSION MUTATION ==========
  const lockDiscussionMutation = useMutation({
    mutationFn: () => lockDiscussion(discussionId),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
      void queryClient.invalidateQueries({ queryKey: discussionKeys.lists() });
      options?.onLockSuccess?.(data);
    },
    onError: (err) => {
      options?.onLockError?.(err);
    },
  });

  // ========== UNLOCK DISCUSSION MUTATION ==========
  const unlockDiscussionMutation = useMutation({
    mutationFn: () => unlockDiscussion(discussionId),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: discussionKeys.detail(discussionId) });
      void queryClient.invalidateQueries({ queryKey: discussionKeys.lists() });
      options?.onUnlockSuccess?.(data);
    },
    onError: (err) => {
      options?.onUnlockError?.(err);
    },
  });

  // ========== MOVE DISCUSSION MUTATION ==========
  const moveDiscussionMutation = useMutation({
    mutationFn: (targetForumId: number) => moveDiscussion(discussionId, targetForumId),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: discussionKeys.all });
      options?.onMoveSuccess?.(data);
    },
    onError: (err) => {
      options?.onMoveError?.(err);
    },
  });

  // ========== SPLIT DISCUSSION MUTATION ==========
  const splitDiscussionMutation = useMutation({
    mutationFn: ({ postId, newSubject }: { postId: number; newSubject: string }) =>
      splitDiscussion(discussionId, postId, newSubject),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: discussionKeys.all });
      options?.onSplitSuccess?.(data);
    },
    onError: (err) => {
      options?.onSplitError?.(err);
    },
  });

  // ========== REPORT POST MUTATION ==========
  const reportPostMutation = useMutation({
    mutationFn: ({ postId, reason }: { postId: number; reason: string }) =>
      reportPost(postId, reason),
    onSuccess: (data) => {
      options?.onReportSuccess?.(data);
    },
    onError: (err) => {
      options?.onReportError?.(err);
    },
  });

  // ========== RETURN VALUE ==========
  return {
    // Query state
    discussion,
    posts,
    isLoading,
    isFetching,
    isSuccess,
    isError,
    error,
    refetch,

    // Create reply
    createReply: createReplyMutation.mutate,
    createReplyAsync: createReplyMutation.mutateAsync,
    isCreatingReply: createReplyMutation.isPending,
    isPosting: createReplyMutation.isPending,

    // Edit post
    editPost: editPostMutation.mutate,
    editPostAsync: editPostMutation.mutateAsync,
    isEditingPost: editPostMutation.isPending,
    isUpdating: editPostMutation.isPending,

    // Delete post
    deletePost: deletePostMutation.mutate,
    deletePostAsync: deletePostMutation.mutateAsync,
    isDeletingPost: deletePostMutation.isPending,
    isDeleting: deletePostMutation.isPending,

    // Subscribe
    subscribe: subscribeMutation.mutate,
    subscribeAsync: subscribeMutation.mutateAsync,
    isSubscribing: subscribeMutation.isPending,

    // Unsubscribe
    unsubscribe: unsubscribeMutation.mutate,
    unsubscribeAsync: unsubscribeMutation.mutateAsync,
    isUnsubscribing: unsubscribeMutation.isPending,

    // Mark as read
    markAsRead: markAsReadMutation.mutate,
    markAsReadAsync: markAsReadMutation.mutateAsync,
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingRead: markAsReadMutation.isPending,

    // Pin discussion
    pinDiscussion: pinDiscussionMutation.mutate,
    pinDiscussionAsync: pinDiscussionMutation.mutateAsync,
    isPinning: pinDiscussionMutation.isPending,

    // Unpin discussion
    unpinDiscussion: unpinDiscussionMutation.mutate,
    unpinDiscussionAsync: unpinDiscussionMutation.mutateAsync,
    isUnpinning: unpinDiscussionMutation.isPending,

    // Lock discussion
    lockDiscussion: lockDiscussionMutation.mutate,
    lockDiscussionAsync: lockDiscussionMutation.mutateAsync,
    isLocking: lockDiscussionMutation.isPending,

    // Unlock discussion
    unlockDiscussion: unlockDiscussionMutation.mutate,
    unlockDiscussionAsync: unlockDiscussionMutation.mutateAsync,
    isUnlocking: unlockDiscussionMutation.isPending,

    // Move discussion
    moveDiscussion: moveDiscussionMutation.mutate,
    moveDiscussionAsync: moveDiscussionMutation.mutateAsync,
    isMoving: moveDiscussionMutation.isPending,

    // Split discussion
    splitDiscussion: splitDiscussionMutation.mutate,
    splitDiscussionAsync: splitDiscussionMutation.mutateAsync,
    isSplitting: splitDiscussionMutation.isPending,

    // Report post
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

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default useDiscussion;
