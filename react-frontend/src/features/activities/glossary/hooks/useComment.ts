/**
 * Glossary Entry Comment Hooks
 *
 * React Query hooks for managing comments on glossary entries. Provides
 * comprehensive comment functionality including fetching, posting, updating,
 * and deleting comments with optimistic UI updates.
 *
 * Features:
 * - Paginated comment fetching with sorting options
 * - Optimistic UI updates for immediate user feedback
 * - Cache invalidation for real-time comment count updates
 * - Permission-aware operations (edit/delete own comments)
 * - Comprehensive error handling
 *
 * @module features/activities/glossary/hooks/useComment
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {
  getEntryComments,
  postComment,
  updateComment,
  deleteComment,
} from '@/features/activities/glossary/api/glossaryApi';

import type {
  GlossaryComment,
  PostCommentInput,
  UpdateCommentInput,
} from '@/features/activities/glossary/types/glossary.types';

import type { Id, PaginationMeta } from '@/types/common';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default number of comments per page
 */
const DEFAULT_COMMENTS_PER_PAGE = 20;

/**
 * Default stale time for comment queries (30 seconds)
 */
const COMMENTS_STALE_TIME = 30 * 1000;

// ============================================================================
// Types
// ============================================================================

/**
 * Options for fetching entry comments
 */
export interface UseEntryCommentsOptions {
  /**
   * Current page number (1-indexed)
   * @default 1
   */
  page?: number;

  /**
   * Number of comments per page
   * @default 20
   */
  perPage?: number;

  /**
   * Sort order for comments
   * @default 'newest'
   */
  sortOrder?: 'newest' | 'oldest';

  /**
   * Whether to enable the query
   * @default true
   */
  enabled?: boolean;
}

/**
 * Response structure for paginated comments
 */
export interface CommentsResponse {
  /**
   * Array of comment objects
   */
  comments: GlossaryComment[];

  /**
   * Pagination metadata
   */
  pagination: PaginationMeta;
}

/**
 * Context for optimistic updates during mutations
 */
interface CommentMutationContext {
  /**
   * Previous comments data before mutation
   */
  previousComments?: GlossaryComment[];

  /**
   * Entry ID for cache invalidation
   */
  entryId?: Id;
}

// ============================================================================
// Query Key Factories
// ============================================================================

/**
 * Factory for generating consistent query keys for comment operations
 */
export const commentKeys = {
  /**
   * Base key for all comment queries
   */
  all: ['glossary', 'comments'] as const,

  /**
   * Key for comments on a specific entry
   */
  entry: (entryId: Id) => 
    ['glossary', 'entry', entryId, 'comments'] as const,

  /**
   * Key for paginated comments on an entry
   */
  entryPaginated: (entryId: Id, options: UseEntryCommentsOptions) =>
    ['glossary', 'entry', entryId, 'comments', options] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for fetching paginated comments for a glossary entry
 *
 * Provides comment data with pagination support and automatic caching.
 * Comments are sorted by timestamp with the option for newest or oldest first.
 *
 * @param entryId - The glossary entry ID to fetch comments for
 * @param options - Optional configuration for pagination and sorting
 * @returns Query result with comments array and pagination metadata
 *
 * @example
 * ```typescript
 * // Basic usage - fetch newest comments
 * const { data, isLoading } = useEntryComments(456);
 *
 * // With pagination
 * const { data } = useEntryComments(456, {
 *   page: 2,
 *   perPage: 10,
 *   sortOrder: 'oldest'
 * });
 *
 * // Access comments and pagination
 * if (data) {
 *   console.log(`${data.pagination.total} total comments`);
 *   data.comments.forEach(comment => {
 *     console.log(`${comment.userfullname}: ${comment.content}`);
 *   });
 * }
 * ```
 */
export function useEntryComments(
  entryId: Id,
  options: UseEntryCommentsOptions = {}
) {
  const {
    page = 1,
    perPage = DEFAULT_COMMENTS_PER_PAGE,
    sortOrder = 'newest',
    enabled = true,
  } = options;

  const queryKey = commentKeys.entryPaginated(entryId, { page, perPage, sortOrder });

  return useQuery<CommentsResponse, Error>({
    queryKey,
    queryFn: async () => {
      // Fetch comments from API
      const comments = await getEntryComments(entryId);

      // Sort comments based on sortOrder preference
      const sortedComments = [...comments].sort((a, b) => {
        const timeA = a.timecreated;
        const timeB = b.timecreated;
        return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
      });

      // Calculate pagination
      const total = sortedComments.length;
      const totalPages = Math.ceil(total / perPage);
      const startIndex = (page - 1) * perPage;
      const endIndex = startIndex + perPage;
      const paginatedComments = sortedComments.slice(startIndex, endIndex);

      return {
        comments: paginatedComments,
        pagination: {
          page,
          perPage,
          total,
          totalPages,
        },
      };
    },
    enabled: enabled && entryId > 0,
    staleTime: COMMENTS_STALE_TIME,
  });
}

/**
 * Hook for posting a new comment on a glossary entry
 *
 * Provides a mutation function with optimistic UI updates. The new comment
 * appears immediately in the UI while the server request is in progress.
 * If the request fails, the optimistic update is rolled back.
 *
 * @param options - Optional mutation configuration
 * @returns Mutation object with mutate function and status
 *
 * @example
 * ```typescript
 * const { mutate, isLoading, error } = usePostComment();
 *
 * // Post a new comment
 * mutate({
 *   entryId: 456,
 *   content: 'Great explanation!',
 *   format: TextFormat.PLAIN
 * }, {
 *   onSuccess: (newComment) => {
 *     console.log('Comment posted:', newComment.id);
 *   },
 *   onError: (error) => {
 *     console.error('Failed to post comment:', error.message);
 *   }
 * });
 * ```
 */
export function usePostComment(
  options?: Omit<
    UseMutationOptions<GlossaryComment, Error, PostCommentInput, CommentMutationContext>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<GlossaryComment, Error, PostCommentInput, CommentMutationContext>({
    mutationFn: postComment,

    onMutate: async (newCommentInput) => {
      // Cancel any outgoing refetches to avoid optimistic update being overwritten
      await queryClient.cancelQueries({
        queryKey: commentKeys.entry(newCommentInput.entryId),
      });

      // Snapshot the previous comments for potential rollback
      const previousCommentsData = queryClient.getQueriesData<CommentsResponse>({
        queryKey: commentKeys.entry(newCommentInput.entryId),
      });

      const previousComments: GlossaryComment[] = [];
      previousCommentsData.forEach(([_, data]) => {
        if (data?.comments) {
          previousComments.push(...data.comments);
        }
      });

      // Create an optimistic comment with temporary values
      const optimisticComment: GlossaryComment = {
        id: Date.now(), // Temporary ID
        contextid: 0,
        component: 'mod_glossary',
        commentarea: 'glossary_entry',
        itemid: newCommentInput.entryId,
        content: newCommentInput.content,
        format: newCommentInput.format,
        userid: 0, // Will be updated by server
        userfullname: 'Posting...', // Temporary indicator
        userpictureurl: '',
        timecreated: Math.floor(Date.now() / 1000),
        timemodified: Math.floor(Date.now() / 1000),
      };

      // Optimistically update all relevant queries
      queryClient.setQueriesData<CommentsResponse>(
        { queryKey: commentKeys.entry(newCommentInput.entryId) },
        (old) => {
          if (!old) {
            return {
              comments: [optimisticComment],
              pagination: { page: 1, perPage: DEFAULT_COMMENTS_PER_PAGE, total: 1, totalPages: 1 },
            };
          }
          return {
            ...old,
            comments: [optimisticComment, ...old.comments],
            pagination: {
              ...old.pagination,
              total: old.pagination.total + 1,
              totalPages: Math.ceil((old.pagination.total + 1) / old.pagination.perPage),
            },
          };
        }
      );

      return { previousComments, entryId: newCommentInput.entryId };
    },

    onError: (_error, _variables, context) => {
      // Rollback to previous state on error
      if (context?.previousComments && context?.entryId) {
        queryClient.setQueriesData<CommentsResponse>(
          { queryKey: commentKeys.entry(context.entryId) },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              comments: context.previousComments || [],
              pagination: {
                ...old.pagination,
                total: (context.previousComments || []).length,
                totalPages: Math.ceil((context.previousComments || []).length / old.pagination.perPage),
              },
            };
          }
        );
      }
    },

    onSuccess: (_newComment, variables) => {
      // Invalidate and refetch to get accurate server data
      queryClient.invalidateQueries({
        queryKey: commentKeys.entry(variables.entryId),
      });

      // Also invalidate the entry itself to update comment count
      queryClient.invalidateQueries({
        queryKey: ['glossary', 'entry', variables.entryId],
      });
    },

    onSettled: (_data, _error, variables) => {
      // Ensure data consistency after mutation completes
      queryClient.invalidateQueries({
        queryKey: commentKeys.entry(variables.entryId),
      });
    },

    ...options,
  });
}

/**
 * Hook for updating an existing comment
 *
 * Provides a mutation function with optimistic UI updates. The comment
 * is immediately updated in the UI while the server request is in progress.
 * Users can only update their own comments unless they have manage capability.
 *
 * @param options - Optional mutation configuration
 * @returns Mutation object with mutate function and status
 *
 * @example
 * ```typescript
 * const { mutate, isLoading } = useUpdateComment();
 *
 * // Update a comment
 * mutate({
 *   commentId: 789,
 *   content: 'Updated comment text',
 *   format: TextFormat.PLAIN
 * }, {
 *   onSuccess: (updatedComment) => {
 *     console.log('Comment updated successfully');
 *   }
 * });
 * ```
 */
export function useUpdateComment(
  options?: Omit<
    UseMutationOptions<
      GlossaryComment,
      Error,
      UpdateCommentInput & { entryId: Id },
      CommentMutationContext
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<
    GlossaryComment,
    Error,
    UpdateCommentInput & { entryId: Id },
    CommentMutationContext
  >({
    mutationFn: async (input) => {
      // Extract only the fields needed for the API call
      const { entryId: _entryId, ...updateInput } = input;
      return updateComment(updateInput);
    },

    onMutate: async (updateInput) => {
      const { entryId, commentId, content, format } = updateInput;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: commentKeys.entry(entryId),
      });

      // Snapshot previous data
      const previousCommentsData = queryClient.getQueriesData<CommentsResponse>({
        queryKey: commentKeys.entry(entryId),
      });

      const previousComments: GlossaryComment[] = [];
      previousCommentsData.forEach(([_, data]) => {
        if (data?.comments) {
          previousComments.push(...data.comments);
        }
      });

      // Optimistically update the comment
      queryClient.setQueriesData<CommentsResponse>(
        { queryKey: commentKeys.entry(entryId) },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            comments: old.comments.map((comment) =>
              comment.id === commentId
                ? {
                    ...comment,
                    content,
                    format,
                    timemodified: Math.floor(Date.now() / 1000),
                  }
                : comment
            ),
          };
        }
      );

      return { previousComments, entryId };
    },

    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousComments && context?.entryId) {
        queryClient.setQueriesData<CommentsResponse>(
          { queryKey: commentKeys.entry(context.entryId) },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              comments: context.previousComments || [],
            };
          }
        );
      }
    },

    onSuccess: (_data, variables) => {
      // Invalidate to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: commentKeys.entry(variables.entryId),
      });
    },

    onSettled: (_data, _error, variables) => {
      // Final cache synchronization
      queryClient.invalidateQueries({
        queryKey: commentKeys.entry(variables.entryId),
      });
    },

    ...options,
  });
}

/**
 * Hook for deleting a comment from a glossary entry
 *
 * Provides a mutation function with optimistic UI updates. The comment
 * is immediately removed from the UI while the server request is in progress.
 * Users can only delete their own comments unless they have manage capability.
 *
 * @param options - Optional mutation configuration
 * @returns Mutation object with mutate function and status
 *
 * @example
 * ```typescript
 * const { mutate, isLoading } = useDeleteComment();
 *
 * // Delete a comment
 * mutate({
 *   commentId: 789,
 *   entryId: 456
 * }, {
 *   onSuccess: () => {
 *     console.log('Comment deleted successfully');
 *   },
 *   onError: (error) => {
 *     // Permission denied or network error
 *     console.error('Failed to delete:', error.message);
 *   }
 * });
 * ```
 */
export function useDeleteComment(
  options?: Omit<
    UseMutationOptions<
      boolean,
      Error,
      { commentId: Id; entryId: Id },
      CommentMutationContext
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, { commentId: Id; entryId: Id }, CommentMutationContext>({
    mutationFn: async ({ commentId }) => {
      return deleteComment(commentId);
    },

    onMutate: async ({ commentId, entryId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: commentKeys.entry(entryId),
      });

      // Snapshot previous data
      const previousCommentsData = queryClient.getQueriesData<CommentsResponse>({
        queryKey: commentKeys.entry(entryId),
      });

      const previousComments: GlossaryComment[] = [];
      previousCommentsData.forEach(([_, data]) => {
        if (data?.comments) {
          previousComments.push(...data.comments);
        }
      });

      // Optimistically remove the comment
      queryClient.setQueriesData<CommentsResponse>(
        { queryKey: commentKeys.entry(entryId) },
        (old) => {
          if (!old) return old;
          const filteredComments = old.comments.filter(
            (comment) => comment.id !== commentId
          );
          return {
            ...old,
            comments: filteredComments,
            pagination: {
              ...old.pagination,
              total: Math.max(0, old.pagination.total - 1),
              totalPages: Math.max(
                1,
                Math.ceil((old.pagination.total - 1) / old.pagination.perPage)
              ),
            },
          };
        }
      );

      return { previousComments, entryId };
    },

    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousComments && context?.entryId) {
        queryClient.setQueriesData<CommentsResponse>(
          { queryKey: commentKeys.entry(context.entryId) },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              comments: context.previousComments || [],
              pagination: {
                ...old.pagination,
                total: (context.previousComments || []).length,
                totalPages: Math.ceil(
                  (context.previousComments || []).length / old.pagination.perPage
                ),
              },
            };
          }
        );
      }
    },

    onSuccess: (_data, variables) => {
      // Invalidate to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: commentKeys.entry(variables.entryId),
      });

      // Also invalidate the entry itself to update comment count
      queryClient.invalidateQueries({
        queryKey: ['glossary', 'entry', variables.entryId],
      });
    },

    onSettled: (_data, _error, variables) => {
      // Final cache synchronization
      queryClient.invalidateQueries({
        queryKey: commentKeys.entry(variables.entryId),
      });
    },

    ...options,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Prefetches comments for an entry
 *
 * Useful for preloading comment data before a user navigates to view comments.
 *
 * @param queryClient - The React Query client instance
 * @param entryId - The entry ID to prefetch comments for
 * @param options - Optional pagination options
 *
 * @example
 * ```typescript
 * const queryClient = useQueryClient();
 *
 * // Prefetch on hover
 * const handleMouseEnter = () => {
 *   prefetchEntryComments(queryClient, entryId);
 * };
 * ```
 */
export async function prefetchEntryComments(
  queryClient: ReturnType<typeof useQueryClient>,
  entryId: Id,
  options: UseEntryCommentsOptions = {}
): Promise<void> {
  const {
    page = 1,
    perPage = DEFAULT_COMMENTS_PER_PAGE,
    sortOrder = 'newest',
  } = options;

  const queryKey = commentKeys.entryPaginated(entryId, { page, perPage, sortOrder });

  await queryClient.prefetchQuery({
    queryKey,
    queryFn: async () => {
      const comments = await getEntryComments(entryId);

      const sortedComments = [...comments].sort((a, b) => {
        const timeA = a.timecreated;
        const timeB = b.timecreated;
        return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
      });

      const total = sortedComments.length;
      const totalPages = Math.ceil(total / perPage);
      const startIndex = (page - 1) * perPage;
      const endIndex = startIndex + perPage;
      const paginatedComments = sortedComments.slice(startIndex, endIndex);

      return {
        comments: paginatedComments,
        pagination: {
          page,
          perPage,
          total,
          totalPages,
        },
      };
    },
    staleTime: COMMENTS_STALE_TIME,
  });
}

/**
 * Invalidates all comment caches for an entry
 *
 * Useful when external operations affect comments and the cache needs refreshing.
 *
 * @param queryClient - The React Query client instance
 * @param entryId - The entry ID to invalidate comments for
 *
 * @example
 * ```typescript
 * const queryClient = useQueryClient();
 *
 * // Invalidate after external update
 * invalidateEntryComments(queryClient, entryId);
 * ```
 */
export function invalidateEntryComments(
  queryClient: ReturnType<typeof useQueryClient>,
  entryId: Id
): void {
  queryClient.invalidateQueries({
    queryKey: commentKeys.entry(entryId),
  });
}
