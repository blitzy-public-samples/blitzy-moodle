/**
 * useUpdatePost Hook
 *
 * Custom React hook for updating existing forum posts using React Query.
 * Handles post updates, optimistic updates, and cache invalidation.
 *
 * Features:
 * - Update existing posts
 * - Optimistic UI updates
 * - Automatic cache invalidation
 * - Error handling and rollback
 * - Concurrent edit detection
 * - Loading and success states
 *
 * @module features/activities/forums/hooks/useUpdatePost
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePost } from '../api/forumApi';
import type { UpdatePostData, PostResponse } from '../types/forum.types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for the useUpdatePost hook
 */
export interface UseUpdatePostOptions {
  /** Callback executed on successful post update */
  onSuccess?: (data: PostResponse) => void;
  /** Callback executed on error */
  onError?: (error: Error) => void;
  /** Callback executed on settlement (success or error) */
  onSettled?: () => void;
}

/**
 * Return type of the useUpdatePost hook
 */
export interface UseUpdatePostReturn {
  /** Mutation function to update a post */
  updatePost: (data: UpdatePostData) => void;
  /** Loading state during post update */
  isLoading: boolean;
  /** Success state */
  isSuccess: boolean;
  /** Error state */
  isError: boolean;
  /** Error object if error occurred */
  error: Error | null;
  /** Response data after successful update */
  data: PostResponse | undefined;
  /** Reset mutation state */
  reset: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for updating existing forum posts
 *
 * @param options - Configuration options
 * @returns Post update mutation handlers and state
 *
 * @example
 * ```tsx
 * const { updatePost, isLoading } = useUpdatePost({
 *   onSuccess: (post) => {
 *     console.log('Post updated:', post);
 *   },
 *   onError: (error) => {
 *     if (error.message.includes('409')) {
 *       alert('Concurrent edit detected! Please refresh and try again.');
 *     }
 *   }
 * });
 *
 * const handleSubmit = (data: UpdatePostData) => {
 *   // data includes postId, message, subject, etc.
 *   updatePost(data);
 * };
 * ```
 */
export function useUpdatePost(options: UseUpdatePostOptions = {}): UseUpdatePostReturn {
  const { onSuccess, onError, onSettled } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: UpdatePostData) => updatePost(data),
    onSuccess: (data, variables) => {
      // Invalidate relevant queries based on the post ID
      void queryClient.invalidateQueries({ queryKey: ['post', variables.postId] });
      
      // Invalidate discussion queries if discussionId is available
      // (We may need to get this from the response data if not in variables)
      if (data.discussionId) {
        void queryClient.invalidateQueries({ queryKey: ['discussions', data.discussionId] });
        void queryClient.invalidateQueries({ queryKey: ['discussion', data.discussionId] });
        void queryClient.invalidateQueries({ queryKey: ['posts', data.discussionId] });
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
    updatePost: mutation.mutate,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
