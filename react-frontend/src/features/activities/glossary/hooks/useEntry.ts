/**
 * Glossary Entry React Query Hooks
 *
 * Custom React Query hooks for CRUD operations on glossary entries. Provides
 * full create, read, update, delete, and approval workflow functionality
 * with optimistic updates and intelligent cache invalidation.
 *
 * These hooks wrap the glossaryApi functions and integrate with React Query
 * for data fetching, caching, and mutation management. Each mutation hook
 * includes proper cache invalidation to ensure UI consistency.
 *
 * Features:
 * - Fetch single entries with caching and automatic refetching
 * - Create new entries with file attachment support
 * - Update entries with optimistic updates for better UX
 * - Delete entries with confirmation and cache cleanup
 * - Approve pending entries (teacher/admin capability)
 * - Comprehensive error handling with detailed messages
 *
 * Usage:
 * ```typescript
 * import { useEntry, useCreateEntry, useUpdateEntry, useDeleteEntry, useApproveEntry } from './useEntry';
 *
 * // Fetch an entry
 * const { data: entry, isLoading, error } = useEntry(entryId);
 *
 * // Create an entry
 * const createMutation = useCreateEntry(glossaryId);
 * createMutation.mutate({ concept: 'Term', definition: 'Definition...' });
 *
 * // Update an entry
 * const updateMutation = useUpdateEntry();
 * updateMutation.mutate({ entryId: 123, concept: 'Updated Term', ... });
 *
 * // Delete an entry
 * const deleteMutation = useDeleteEntry(glossaryId);
 * deleteMutation.mutate(entryId);
 *
 * // Approve an entry
 * const approveMutation = useApproveEntry(glossaryId);
 * approveMutation.mutate(entryId);
 * ```
 *
 * @module features/activities/glossary/hooks/useEntry
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
  type QueryClient,
} from '@tanstack/react-query';

import type { Id } from '@/types/common';
import {
  getEntry,
  createEntry,
  updateEntry,
  deleteEntry,
  approveEntry,
} from '@/features/activities/glossary/api/glossaryApi';
import type {
  GlossaryEntry,
  CreateEntryInput,
  UpdateEntryInput,
} from '@/features/activities/glossary/types/glossary.types';

// ============================================================================
// Query Key Constants
// ============================================================================

/**
 * Query key factory for glossary entries
 * Centralizes query key generation for consistent cache management
 */
export const entryKeys = {
  /** Base key for all entry queries */
  all: ['glossary', 'entries'] as const,

  /** Key for list of entries in a glossary */
  lists: () => [...entryKeys.all, 'list'] as const,

  /** Key for entries in a specific glossary */
  list: (glossaryId: Id) => [...entryKeys.lists(), glossaryId] as const,

  /** Base key for entry detail queries */
  details: () => [...entryKeys.all, 'detail'] as const,

  /** Key for a specific entry detail */
  detail: (entryId: Id) => [...entryKeys.details(), entryId] as const,
} as const;

// ============================================================================
// Type Definitions for Hook Options
// ============================================================================

/**
 * Options for useEntry hook
 */
export interface UseEntryOptions {
  /** Whether the query should be enabled (default: true) */
  enabled?: boolean;
  /** Stale time in milliseconds before refetch (default: 5 minutes) */
  staleTime?: number;
  /** Cache time in milliseconds (default: 30 minutes) */
  gcTime?: number;
}

/**
 * Options for mutation hooks with callbacks
 */
export interface MutationOptions<TData, TVariables> {
  /** Callback executed on successful mutation */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Callback executed on mutation error */
  onError?: (error: Error, variables: TVariables) => void;
  /** Callback executed when mutation completes (success or error) */
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
}

// ============================================================================
// useEntry Hook
// ============================================================================

/**
 * Fetches a single glossary entry by ID
 *
 * Retrieves the complete entry data including concept, definition,
 * attachments, author information, and metadata. Uses React Query
 * for caching and automatic background refetching.
 *
 * @param entryId - The unique identifier of the entry to fetch
 * @param options - Optional configuration for the query
 * @returns React Query result object with entry data, loading state, and error
 *
 * @example
 * ```typescript
 * // Basic usage
 * const { data: entry, isLoading, error } = useEntry(456);
 *
 * // With options
 * const { data: entry } = useEntry(456, {
 *   enabled: isEntryIdValid,
 *   staleTime: 10000
 * });
 *
 * // Conditional rendering
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error.message} />;
 * return <EntryDetail entry={entry} />;
 * ```
 */
export function useEntry(
  entryId: Id,
  options?: UseEntryOptions
): UseQueryResult<GlossaryEntry, Error> {
  const {
    enabled = true,
    staleTime = 5 * 60 * 1000, // 5 minutes
    gcTime = 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  } = options ?? {};

  return useQuery<GlossaryEntry, Error>({
    queryKey: entryKeys.detail(entryId),
    queryFn: async () => {
      try {
        return await getEntry(entryId);
      } catch (error) {
        // Re-throw with more descriptive message
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new Error(`Failed to fetch glossary entry ${entryId}: ${message}`);
      }
    },
    enabled: enabled && entryId > 0,
    staleTime,
    gcTime,
    retry: (failureCount, error) => {
      // Don't retry on 404 (entry not found) or 403 (no permission)
      const errorMessage = error?.message?.toLowerCase() ?? '';
      if (
        errorMessage.includes('not found') ||
        errorMessage.includes('permission') ||
        errorMessage.includes('403') ||
        errorMessage.includes('404')
      ) {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
  });
}

// ============================================================================
// useCreateEntry Hook
// ============================================================================

/**
 * Creates a new glossary entry with full support for file attachments
 *
 * Mutation hook for creating new entries in a glossary. Automatically
 * invalidates the entries list cache on success to reflect the new entry.
 * Supports file attachments through FormData upload.
 *
 * @param glossaryId - The ID of the glossary to create the entry in
 * @param options - Optional callbacks for mutation lifecycle events
 * @returns React Query mutation result with mutate function and state
 *
 * @example
 * ```typescript
 * const createMutation = useCreateEntry(123);
 *
 * // Create entry without attachments
 * createMutation.mutate({
 *   glossaryId: 123,
 *   concept: 'React',
 *   definition: '<p>A JavaScript library for building UIs</p>',
 *   definitionformat: TextFormat.HTML,
 *   usedynalink: true,
 *   casesensitive: false,
 *   fullmatch: true
 * });
 *
 * // Create entry with attachments
 * createMutation.mutate({
 *   glossaryId: 123,
 *   concept: 'React',
 *   definition: 'A JavaScript library...',
 *   definitionformat: TextFormat.HTML,
 *   usedynalink: true,
 *   casesensitive: false,
 *   fullmatch: true,
 *   categoryId: 5,
 *   attachments: [file1, file2]
 * });
 *
 * // Handle mutation states
 * if (createMutation.isPending) return <LoadingOverlay />;
 * if (createMutation.isError) return <ErrorAlert error={createMutation.error} />;
 * ```
 */
export function useCreateEntry(
  glossaryId: Id,
  options?: MutationOptions<GlossaryEntry, CreateEntryInput>
): UseMutationResult<GlossaryEntry, Error, CreateEntryInput> {
  const queryClient = useQueryClient();

  return useMutation<GlossaryEntry, Error, CreateEntryInput>({
    mutationFn: async (input: CreateEntryInput) => {
      try {
        // Ensure glossaryId is set
        const createInput: CreateEntryInput = {
          ...input,
          glossaryId: input.glossaryId ?? glossaryId,
        };
        return await createEntry(createInput);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new Error(`Failed to create glossary entry: ${message}`);
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate entries list to show new entry
      void queryClient.invalidateQueries({
        queryKey: entryKeys.list(glossaryId),
      });
      // Also invalidate the general entries list
      void queryClient.invalidateQueries({
        queryKey: entryKeys.lists(),
      });
      // Add the new entry to the cache
      queryClient.setQueryData(entryKeys.detail(data.id), data);
      // Call user's onSuccess callback if provided
      options?.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      options?.onError?.(error, variables);
    },
    onSettled: (data, error, variables) => {
      options?.onSettled?.(data, error, variables);
    },
  });
}

// ============================================================================
// useUpdateEntry Hook
// ============================================================================

/**
 * Updates an existing glossary entry with optimistic updates
 *
 * Mutation hook for updating entries. Implements optimistic updates
 * for better perceived performance - the UI updates immediately while
 * the server request is in progress. On failure, the optimistic update
 * is rolled back to the previous state.
 *
 * @param options - Optional callbacks for mutation lifecycle events
 * @returns React Query mutation result with mutate function and state
 *
 * @example
 * ```typescript
 * const updateMutation = useUpdateEntry();
 *
 * // Update entry
 * updateMutation.mutate({
 *   entryId: 456,
 *   concept: 'React.js',
 *   definition: '<p>Updated definition...</p>',
 *   definitionformat: TextFormat.HTML,
 *   usedynalink: true,
 *   casesensitive: false,
 *   fullmatch: true
 * });
 *
 * // With custom callbacks
 * const updateMutation = useUpdateEntry({
 *   onSuccess: (entry) => toast.success(`Entry "${entry.concept}" updated`),
 *   onError: (error) => toast.error(error.message)
 * });
 * ```
 */
export function useUpdateEntry(
  options?: MutationOptions<GlossaryEntry, UpdateEntryInput>
): UseMutationResult<GlossaryEntry, Error, UpdateEntryInput> {
  const queryClient = useQueryClient();

  return useMutation<GlossaryEntry, Error, UpdateEntryInput, { previousEntry: GlossaryEntry | undefined; glossaryId: Id | undefined }>({
    mutationFn: async (input: UpdateEntryInput) => {
      try {
        return await updateEntry(input);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new Error(`Failed to update glossary entry ${input.entryId}: ${message}`);
      }
    },
    onMutate: async (input) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: entryKeys.detail(input.entryId),
      });

      // Snapshot the previous value
      const previousEntry = queryClient.getQueryData<GlossaryEntry>(
        entryKeys.detail(input.entryId)
      );

      // Optimistically update the cache with new values
      if (previousEntry) {
        const optimisticEntry: GlossaryEntry = {
          ...previousEntry,
          concept: input.concept,
          definition: input.definition,
          definitionformat: input.definitionformat,
          usedynalink: input.usedynalink,
          casesensitive: input.casesensitive,
          fullmatch: input.fullmatch,
          categoryid: input.categoryId,
          timemodified: Math.floor(Date.now() / 1000), // Unix timestamp
        };

        queryClient.setQueryData(
          entryKeys.detail(input.entryId),
          optimisticEntry
        );
      }

      // Return context with previous value for rollback
      return {
        previousEntry,
        glossaryId: previousEntry?.glossaryid,
      };
    },
    onError: (error, input, context) => {
      // Rollback to previous value on error
      if (context?.previousEntry) {
        queryClient.setQueryData(
          entryKeys.detail(input.entryId),
          context.previousEntry
        );
      }
      options?.onError?.(error, input);
    },
    onSuccess: (data, variables, context) => {
      // Update cache with server response (authoritative data)
      queryClient.setQueryData(entryKeys.detail(data.id), data);

      // Invalidate entries list to reflect potential changes
      if (context?.glossaryId) {
        void queryClient.invalidateQueries({
          queryKey: entryKeys.list(context.glossaryId),
        });
      }
      // Also invalidate general entries list
      void queryClient.invalidateQueries({
        queryKey: entryKeys.lists(),
      });

      options?.onSuccess?.(data, variables);
    },
    onSettled: (data, error, variables) => {
      // Always refetch after mutation to ensure cache consistency
      void queryClient.invalidateQueries({
        queryKey: entryKeys.detail(variables.entryId),
      });
      options?.onSettled?.(data, error, variables);
    },
  });
}

// ============================================================================
// useDeleteEntry Hook
// ============================================================================

/**
 * Result type for delete operation
 */
interface DeleteEntryResult {
  /** Whether the deletion was successful */
  deleted: boolean;
  /** The ID of the deleted entry */
  entryId: Id;
}

/**
 * Deletes a glossary entry with cache cleanup
 *
 * Mutation hook for permanently deleting entries. Removes the entry
 * from the cache and invalidates the entries list on success.
 * Implements optimistic removal for better UX.
 *
 * @param glossaryId - The ID of the glossary containing the entry
 * @param options - Optional callbacks for mutation lifecycle events
 * @returns React Query mutation result with mutate function and state
 *
 * @example
 * ```typescript
 * const deleteMutation = useDeleteEntry(123);
 *
 * // Delete entry
 * const handleDelete = async (entryId: number) => {
 *   if (confirm('Are you sure you want to delete this entry?')) {
 *     deleteMutation.mutate(entryId);
 *   }
 * };
 *
 * // With callbacks
 * const deleteMutation = useDeleteEntry(123, {
 *   onSuccess: () => {
 *     toast.success('Entry deleted successfully');
 *     navigate('/glossary/123');
 *   },
 *   onError: (error) => toast.error(`Failed to delete: ${error.message}`)
 * });
 * ```
 */
export function useDeleteEntry(
  glossaryId: Id,
  options?: MutationOptions<DeleteEntryResult, Id>
): UseMutationResult<DeleteEntryResult, Error, Id> {
  const queryClient = useQueryClient();

  return useMutation<DeleteEntryResult, Error, Id, { previousEntry: GlossaryEntry | undefined }>({
    mutationFn: async (entryId: Id) => {
      try {
        const deleted = await deleteEntry(entryId);
        return { deleted, entryId };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new Error(`Failed to delete glossary entry ${entryId}: ${message}`);
      }
    },
    onMutate: async (entryId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: entryKeys.detail(entryId),
      });

      // Snapshot the entry for rollback
      const previousEntry = queryClient.getQueryData<GlossaryEntry>(
        entryKeys.detail(entryId)
      );

      // Optimistically remove from cache
      queryClient.removeQueries({
        queryKey: entryKeys.detail(entryId),
      });

      return { previousEntry };
    },
    onError: (error, entryId, context) => {
      // Rollback: restore the entry to cache
      if (context?.previousEntry) {
        queryClient.setQueryData(
          entryKeys.detail(entryId),
          context.previousEntry
        );
      }
      options?.onError?.(error, entryId);
    },
    onSuccess: (data, entryId) => {
      // Invalidate entries list to remove deleted entry
      void queryClient.invalidateQueries({
        queryKey: entryKeys.list(glossaryId),
      });
      // Also invalidate general entries list
      void queryClient.invalidateQueries({
        queryKey: entryKeys.lists(),
      });

      options?.onSuccess?.(data, entryId);
    },
    onSettled: (data, error, entryId) => {
      options?.onSettled?.(data, error, entryId);
    },
  });
}

// ============================================================================
// useApproveEntry Hook
// ============================================================================

/**
 * Approves a pending glossary entry (teacher/admin capability)
 *
 * Mutation hook for approving entries that require moderation.
 * Only users with the 'mod/glossary:approve' capability can use this.
 * Automatically updates the entry's approved status in the cache.
 *
 * @param glossaryId - The ID of the glossary containing the entry
 * @param options - Optional callbacks for mutation lifecycle events
 * @returns React Query mutation result with mutate function and state
 *
 * @example
 * ```typescript
 * const approveMutation = useApproveEntry(123);
 *
 * // Approve entry
 * const handleApprove = (entryId: number) => {
 *   approveMutation.mutate(entryId);
 * };
 *
 * // In moderation list
 * pendingEntries.map(entry => (
 *   <EntryCard key={entry.id}>
 *     <Button
 *       onClick={() => approveMutation.mutate(entry.id)}
 *       disabled={approveMutation.isPending}
 *     >
 *       {approveMutation.isPending ? 'Approving...' : 'Approve'}
 *     </Button>
 *   </EntryCard>
 * ));
 *
 * // With callbacks
 * const approveMutation = useApproveEntry(123, {
 *   onSuccess: (entry) => toast.success(`"${entry.concept}" approved`),
 *   onError: (error) => toast.error(error.message)
 * });
 * ```
 */
export function useApproveEntry(
  glossaryId: Id,
  options?: MutationOptions<GlossaryEntry, Id>
): UseMutationResult<GlossaryEntry, Error, Id> {
  const queryClient = useQueryClient();

  return useMutation<GlossaryEntry, Error, Id, { previousEntry: GlossaryEntry | undefined }>({
    mutationFn: async (entryId: Id) => {
      try {
        return await approveEntry(entryId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new Error(`Failed to approve glossary entry ${entryId}: ${message}`);
      }
    },
    onMutate: async (entryId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: entryKeys.detail(entryId),
      });

      // Snapshot for rollback
      const previousEntry = queryClient.getQueryData<GlossaryEntry>(
        entryKeys.detail(entryId)
      );

      // Optimistically update approved status
      if (previousEntry) {
        const optimisticEntry: GlossaryEntry = {
          ...previousEntry,
          approved: true,
          timemodified: Math.floor(Date.now() / 1000),
        };
        queryClient.setQueryData(
          entryKeys.detail(entryId),
          optimisticEntry
        );
      }

      return { previousEntry };
    },
    onError: (error, entryId, context) => {
      // Rollback to previous state
      if (context?.previousEntry) {
        queryClient.setQueryData(
          entryKeys.detail(entryId),
          context.previousEntry
        );
      }
      options?.onError?.(error, entryId);
    },
    onSuccess: (data, entryId) => {
      // Update cache with server response
      queryClient.setQueryData(entryKeys.detail(data.id), data);

      // Invalidate entries list (may affect filtering by approval status)
      void queryClient.invalidateQueries({
        queryKey: entryKeys.list(glossaryId),
      });
      // Also invalidate general entries list
      void queryClient.invalidateQueries({
        queryKey: entryKeys.lists(),
      });

      options?.onSuccess?.(data, entryId);
    },
    onSettled: (data, error, entryId) => {
      // Refetch to ensure consistency
      void queryClient.invalidateQueries({
        queryKey: entryKeys.detail(entryId),
      });
      options?.onSettled?.(data, error, entryId);
    },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Prefetches an entry into the cache
 *
 * Useful for preloading entry data before navigation or on hover.
 *
 * @param queryClient - The React Query client instance
 * @param entryId - The ID of the entry to prefetch
 *
 * @example
 * ```typescript
 * const queryClient = useQueryClient();
 *
 * // Prefetch on hover
 * const handleHover = (entryId: number) => {
 *   prefetchEntry(queryClient, entryId);
 * };
 * ```
 */
export async function prefetchEntry(
  queryClient: QueryClient,
  entryId: Id
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: entryKeys.detail(entryId),
    queryFn: () => getEntry(entryId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Invalidates all entry caches for a glossary
 *
 * Useful when external changes may have affected entry data.
 *
 * @param queryClient - The React Query client instance
 * @param glossaryId - The ID of the glossary to invalidate entries for
 *
 * @example
 * ```typescript
 * const queryClient = useQueryClient();
 *
 * // Invalidate after import
 * const handleImportComplete = (glossaryId: number) => {
 *   invalidateEntryCache(queryClient, glossaryId);
 * };
 * ```
 */
export function invalidateEntryCache(
  queryClient: QueryClient,
  glossaryId: Id
): void {
  void queryClient.invalidateQueries({
    queryKey: entryKeys.list(glossaryId),
  });
  void queryClient.invalidateQueries({
    queryKey: entryKeys.details(),
  });
}
