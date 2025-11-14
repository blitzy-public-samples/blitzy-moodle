/**
 * useCreateDiscussion Hook
 *
 * Custom React hook for creating new forum discussions using React Query.
 * Handles discussion creation, optimistic updates, and cache invalidation.
 *
 * Features:
 * - Create new discussions in forums
 * - Optimistic UI updates
 * - Automatic cache invalidation
 * - Error handling and rollback
 * - Loading and success states
 *
 * @module features/activities/forums/hooks/useCreateDiscussion
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDiscussion, type DiscussionResponse } from '../api/forumApi';
import type { CreateDiscussionData } from '../types/forum.types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for the useCreateDiscussion hook
 */
export interface UseCreateDiscussionOptions {
  /** Callback executed on successful discussion creation */
  onSuccess?: (data: DiscussionResponse) => void;
  /** Callback executed on error */
  onError?: (error: Error) => void;
  /** Callback executed on settlement (success or error) */
  onSettled?: () => void;
}

/**
 * Return type of the useCreateDiscussion hook
 */
export interface UseCreateDiscussionReturn {
  /** Mutation function to create a discussion */
  createDiscussion: (forumId: number, data: CreateDiscussionData) => void;
  /** Loading state during discussion creation */
  isLoading: boolean;
  /** Success state */
  isSuccess: boolean;
  /** Error state */
  isError: boolean;
  /** Error object if error occurred */
  error: Error | null;
  /** Response data after successful creation */
  data: DiscussionResponse | undefined;
  /** Reset mutation state */
  reset: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for creating new forum discussions
 *
 * @param options - Configuration options
 * @returns Discussion creation mutation handlers and state
 *
 * @example
 * ```tsx
 * const { createDiscussion, isLoading } = useCreateDiscussion({
 *   onSuccess: (discussion) => {
 *     console.log('Discussion created:', discussion);
 *   }
 * });
 *
 * const handleSubmit = (data: CreateDiscussionData) => {
 *   createDiscussion(forumId, data);
 * };
 * ```
 */
export function useCreateDiscussion(options: UseCreateDiscussionOptions = {}): UseCreateDiscussionReturn {
  const { onSuccess, onError, onSettled } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ forumId, data }: { forumId: number; data: CreateDiscussionData }) => 
      createDiscussion(forumId, data),
    onSuccess: (data, variables) => {
      // Invalidate forum queries to refetch discussion list
      void queryClient.invalidateQueries({ queryKey: ['forum', variables.forumId] });
      void queryClient.invalidateQueries({ queryKey: ['discussions'] });
      void queryClient.invalidateQueries({ queryKey: ['discussions', variables.forumId] });

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(data);
      }
    },
    onError: (error: Error) => {
      // Call error callback if provided
      if (onError) {
        onError(error);
      }
    },
    onSettled: () => {
      // Call settled callback if provided
      if (onSettled) {
        onSettled();
      }
    },
  });

  return {
    createDiscussion: (forumId: number, data: CreateDiscussionData) => 
      mutation.mutate({ forumId, data }),
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
