/**
 * useCreatePost Hook
 *
 * Custom React hook for creating new forum posts (replies) using React Query.
 * Handles post creation, optimistic updates, and cache invalidation.
 *
 * Features:
 * - Create new posts in discussions
 * - Optimistic UI updates
 * - Automatic cache invalidation
 * - Error handling and rollback
 * - Loading and success states
 *
 * @module features/activities/forums/hooks/useCreatePost
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPost } from '../api/forumApi';
import type { CreatePostData, PostResponse } from '../types/forum.types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for the useCreatePost hook
 */
export interface UseCreatePostOptions {
  /** Callback executed on successful post creation */
  onSuccess?: (data: PostResponse) => void;
  /** Callback executed on error */
  onError?: (error: Error) => void;
  /** Callback executed on settlement (success or error) */
  onSettled?: () => void;
}

/**
 * Return type of the useCreatePost hook
 */
export interface UseCreatePostReturn {
  /** Mutation function to create a post */
  createPost: (data: CreatePostData) => void;
  /** Loading state during post creation */
  isLoading: boolean;
  /** Success state */
  isSuccess: boolean;
  /** Error state */
  isError: boolean;
  /** Error object if error occurred */
  error: Error | null;
  /** Response data after successful creation */
  data: PostResponse | undefined;
  /** Reset mutation state */
  reset: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for creating new forum posts (replies) or discussions
 *
 * @param options - Configuration options
 * @returns Post creation mutation handlers and state
 *
 * @example
 * ```tsx
 * const { createPost, isLoading } = useCreatePost({
 *   onSuccess: (post) => {
 *     console.log('Post created:', post);
 *   }
 * });
 *
 * const handleSubmit = (data: CreatePostData) => {
 *   createPost(data);
 * };
 * ```
 */
export function useCreatePost(options: UseCreatePostOptions = {}): UseCreatePostReturn {
  const { onSuccess, onError, onSettled } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreatePostData) => createPost(data),
    onSuccess: (data, variables) => {
      // Invalidate relevant queries based on the discussion ID
      if (variables.discussionId) {
        void queryClient.invalidateQueries({ queryKey: ['discussions', variables.discussionId] });
        void queryClient.invalidateQueries({ queryKey: ['discussion', variables.discussionId] });
        void queryClient.invalidateQueries({ queryKey: ['posts', variables.discussionId] });
      }
      
      // Invalidate forum queries to refetch discussion list
      if (variables.forumId) {
        void queryClient.invalidateQueries({ queryKey: ['forum', variables.forumId] });
        void queryClient.invalidateQueries({ queryKey: ['discussions'] });
      }
      
      // Call success callback if provided
      onSuccess?.(data);
    },
    onError: (error: Error) => {
      // Call error callback if provided
      onError?.(error);
    },
    onSettled: () => {
      // Call settled callback if provided
      onSettled?.();
    },
  });

  return {
    createPost: mutation.mutate,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
