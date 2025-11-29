/**
 * React Query hooks for managing BigBlueButton conference recordings.
 *
 * This module provides comprehensive hooks for fetching, publishing, unpublishing,
 * deleting, and updating metadata of BigBlueButton recordings. All hooks implement
 * optimistic updates for immediate UI feedback and proper cache invalidation.
 *
 * Features:
 * - Fetching recording lists with filtering and pagination
 * - Publishing/unpublishing recordings with optimistic updates
 * - Deleting recordings with confirmation and rollback support
 * - Updating recording metadata (name, description)
 * - Auto-refresh every 5 minutes when component is mounted
 * - Proper error handling with user-friendly toast notifications
 *
 * @example
 * ```tsx
 * function RecordingsManager({ instanceId }: { instanceId: number }) {
 *   const { data: recordings, isLoading, error } = useBBBRecordings(instanceId);
 *   const { mutate: publishRecording } = usePublishBBBRecording(instanceId);
 *   const { mutate: deleteRecording } = useDeleteBBBRecording(instanceId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <RecordingsList
 *       recordings={recordings}
 *       onPublish={(recordingId) => publishRecording({ recordingId })}
 *       onDelete={(recordingId) => deleteRecording({ recordingId })}
 *     />
 *   );
 * }
 * ```
 *
 * @module features/activities/bigbluebuttonbn/hooks/useBBBRecordings
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { apiClient } from '@/services/api/client';
import type { BBBRecording } from '@/features/activities/bigbluebuttonbn/types/bbb.types';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Options for fetching BBB recordings
 */
export interface UseBBBRecordingsOptions {
  /** Group ID to filter recordings by (optional) */
  groupId?: number;
  /** Whether to include imported recordings from other instances */
  includeImported?: boolean;
  /** Page number for pagination (1-indexed) */
  page?: number;
  /** Number of recordings per page */
  perPage?: number;
  /** Whether to enable automatic refetching */
  enabled?: boolean;
  /** Custom stale time in milliseconds (default: 5 minutes) */
  staleTime?: number;
  /** Custom refetch interval in milliseconds (default: 5 minutes) */
  refetchInterval?: number | false;
}

/**
 * API response structure for recordings list
 */
interface RecordingsResponse {
  success: boolean;
  data: {
    recordings: BBBRecording[];
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

/**
 * API response for single recording operations
 */
interface RecordingOperationResponse {
  success: boolean;
  data: {
    recording: BBBRecording;
  };
  error?: string;
}

/**
 * Parameters for publish/unpublish mutation
 */
export interface PublishRecordingParams {
  /** The recording ID to publish/unpublish */
  recordingId: string;
}

/**
 * Parameters for delete recording mutation
 */
export interface DeleteRecordingParams {
  /** The recording ID to delete */
  recordingId: string;
}

/**
 * Parameters for updating recording metadata
 */
export interface UpdateRecordingMetadataParams {
  /** The recording ID to update */
  recordingId: string;
  /** New name for the recording (optional) */
  name?: string;
  /** New description for the recording (optional) */
  description?: string;
}

// ============================================================================
// Query Key Factories
// ============================================================================

/**
 * Query key factory for BBB recordings
 * Provides consistent query key generation for cache management
 */
export const bbbRecordingsKeys = {
  /** Base key for all BBB recordings queries */
  all: ['bigbluebuttonbn', 'recordings'] as const,
  /** Key for recordings list by instance ID */
  list: (instanceId: number) =>
    [...bbbRecordingsKeys.all, 'list', instanceId] as const,
  /** Key for recordings list with filters */
  listFiltered: (instanceId: number, filters: UseBBBRecordingsOptions) =>
    [...bbbRecordingsKeys.list(instanceId), filters] as const,
  /** Key for a specific recording */
  detail: (recordingId: string) =>
    [...bbbRecordingsKeys.all, 'detail', recordingId] as const,
};

// ============================================================================
// Constants
// ============================================================================

/** Default stale time for recordings (5 minutes) */
const DEFAULT_STALE_TIME = 5 * 60 * 1000;

/** Default refetch interval for recordings (5 minutes) */
const DEFAULT_REFETCH_INTERVAL = 5 * 60 * 1000;

// ============================================================================
// Mutation Context Types
// ============================================================================

/**
 * Context type for publish/unpublish/update mutation rollbacks
 */
interface RecordingMutationContext {
  previousRecordings: BBBRecording[] | undefined;
}

/**
 * Context type for delete mutation rollback (includes all queries data)
 */
interface DeleteRecordingMutationContext {
  previousRecordings: BBBRecording[] | undefined;
  allQueriesData: [readonly unknown[], BBBRecording[] | undefined][];
}

/**
 * Context type for bulk delete mutation rollback
 */
interface BulkDeleteMutationContext {
  previousRecordings: BBBRecording[] | undefined;
  deletedCount: number;
}

// ============================================================================
// useBBBRecordings Hook
// ============================================================================

/**
 * React Query hook for fetching BigBlueButton recordings.
 *
 * Fetches the list of recordings for a BBB instance with support for
 * filtering, pagination, and automatic background refreshing.
 *
 * @param instanceId - The BigBlueButton instance ID
 * @param options - Configuration options for the query
 * @returns Query result with recordings array, loading state, and error state
 *
 * @example
 * ```tsx
 * const { data, isLoading, isError, error, refetch } = useBBBRecordings(instanceId, {
 *   includeImported: true,
 *   groupId: 5,
 *   page: 1,
 *   perPage: 20,
 * });
 * ```
 */
export function useBBBRecordings(
  instanceId: number,
  options: UseBBBRecordingsOptions = {}
) {
  const {
    groupId,
    includeImported = false,
    page,
    perPage,
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    refetchInterval = DEFAULT_REFETCH_INTERVAL,
  } = options;

  // Build query parameters
  const queryParams = new URLSearchParams();
  if (groupId !== undefined) {
    queryParams.append('groupId', String(groupId));
  }
  if (includeImported) {
    queryParams.append('includeImported', 'true');
  }
  if (page !== undefined) {
    queryParams.append('page', String(page));
  }
  if (perPage !== undefined) {
    queryParams.append('perPage', String(perPage));
  }

  const queryString = queryParams.toString();
  const endpoint = `/bigbluebuttonbn/${instanceId}/recordings${queryString ? `?${queryString}` : ''}`;

  return useQuery<BBBRecording[], Error>({
    queryKey: bbbRecordingsKeys.listFiltered(instanceId, options),
    queryFn: async (): Promise<BBBRecording[]> => {
      const response = await apiClient.get<RecordingsResponse>(endpoint);

      if (!response.data.success) {
        throw new Error(response.data.error ?? 'Failed to fetch recordings');
      }

      return response.data.data.recordings;
    },
    enabled: enabled && instanceId > 0,
    staleTime,
    refetchInterval,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

// ============================================================================
// usePublishBBBRecording Hook
// ============================================================================

/**
 * React Query mutation hook for publishing a BigBlueButton recording.
 *
 * Makes a recording visible to students by setting its published status to true.
 * Implements optimistic updates for immediate UI feedback and automatic
 * cache invalidation on success.
 *
 * @param instanceId - The BigBlueButton instance ID for cache invalidation
 * @returns Mutation result with mutate function, loading state, and error state
 *
 * @example
 * ```tsx
 * const { mutate, isLoading, isError } = usePublishBBBRecording(instanceId);
 *
 * const handlePublish = (recordingId: string) => {
 *   mutate(
 *     { recordingId },
 *     {
 *       onSuccess: () => console.log('Recording published!'),
 *       onError: (error) => console.error('Failed to publish:', error),
 *     }
 *   );
 * };
 * ```
 */
export function usePublishBBBRecording(instanceId: number) {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();

  return useMutation<BBBRecording, Error, PublishRecordingParams, RecordingMutationContext>({
    mutationFn: async ({ recordingId }): Promise<BBBRecording> => {
      const response = await apiClient.post<RecordingOperationResponse>(
        `/bigbluebuttonbn/recordings/${recordingId}/publish`
      );

      if (!response.data.success) {
        throw new Error(response.data.error ?? 'Failed to publish recording');
      }

      return response.data.data.recording;
    },

    // Optimistic update: immediately show published state in UI
    onMutate: async ({ recordingId }) => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });

      // Snapshot the previous value for rollback
      const previousRecordings = queryClient.getQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId)
      );

      // Optimistically update the cache
      queryClient.setQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId),
        (old) =>
          old?.map((recording) =>
            recording.recordingId === recordingId
              ? { ...recording, published: true }
              : recording
          )
      );

      // Return context with previous data for rollback
      return { previousRecordings };
    },

    // Rollback on error
    onError: (err, _variables, context) => {
      if (context?.previousRecordings) {
        queryClient.setQueryData(
          bbbRecordingsKeys.list(instanceId),
          context.previousRecordings
        );
      }
      showError(`Failed to publish recording: ${err.message}`);
    },

    // Invalidate and refetch on success
    onSuccess: () => {
      success('Recording published successfully');
    },

    // Always refetch after mutation settles
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });
    },
  });
}

// ============================================================================
// useUnpublishBBBRecording Hook
// ============================================================================

/**
 * React Query mutation hook for unpublishing a BigBlueButton recording.
 *
 * Hides a recording from students while keeping it on the server.
 * Implements optimistic updates for immediate UI feedback and automatic
 * cache invalidation on success.
 *
 * @param instanceId - The BigBlueButton instance ID for cache invalidation
 * @returns Mutation result with mutate function, loading state, and error state
 *
 * @example
 * ```tsx
 * const { mutate, isLoading } = useUnpublishBBBRecording(instanceId);
 *
 * const handleUnpublish = (recordingId: string) => {
 *   mutate({ recordingId });
 * };
 * ```
 */
export function useUnpublishBBBRecording(instanceId: number) {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();

  return useMutation<BBBRecording, Error, PublishRecordingParams, RecordingMutationContext>({
    mutationFn: async ({ recordingId }): Promise<BBBRecording> => {
      const response = await apiClient.post<RecordingOperationResponse>(
        `/bigbluebuttonbn/recordings/${recordingId}/unpublish`
      );

      if (!response.data.success) {
        throw new Error(response.data.error ?? 'Failed to unpublish recording');
      }

      return response.data.data.recording;
    },

    // Optimistic update: immediately show unpublished state in UI
    onMutate: async ({ recordingId }) => {
      await queryClient.cancelQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });

      const previousRecordings = queryClient.getQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId)
      );

      queryClient.setQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId),
        (old) =>
          old?.map((recording) =>
            recording.recordingId === recordingId
              ? { ...recording, published: false }
              : recording
          )
      );

      return { previousRecordings };
    },

    // Rollback on error
    onError: (err, _variables, context) => {
      if (context?.previousRecordings) {
        queryClient.setQueryData(
          bbbRecordingsKeys.list(instanceId),
          context.previousRecordings
        );
      }
      showError(`Failed to unpublish recording: ${err.message}`);
    },

    // Show success message
    onSuccess: () => {
      success('Recording unpublished successfully');
    },

    // Always refetch after mutation settles
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });
    },
  });
}

// ============================================================================
// useDeleteBBBRecording Hook
// ============================================================================

/**
 * React Query mutation hook for deleting a BigBlueButton recording.
 *
 * Permanently removes a recording from the BigBlueButton server.
 * Implements optimistic updates with proper rollback on error and
 * user notification via toast messages.
 *
 * IMPORTANT: This action is irreversible. The recording will be permanently
 * deleted from the BigBlueButton server.
 *
 * @param instanceId - The BigBlueButton instance ID for cache invalidation
 * @returns Mutation result with mutate function, loading state, and error state
 *
 * @example
 * ```tsx
 * const { mutate: deleteRecording, isLoading } = useDeleteBBBRecording(instanceId);
 *
 * const handleDelete = (recordingId: string) => {
 *   // Confirm before deletion
 *   if (confirm('Are you sure you want to permanently delete this recording?')) {
 *     deleteRecording(
 *       { recordingId },
 *       {
 *         onSuccess: () => console.log('Recording deleted!'),
 *         onError: (error) => console.error('Delete failed:', error),
 *       }
 *     );
 *   }
 * };
 * ```
 */
export function useDeleteBBBRecording(instanceId: number) {
  const queryClient = useQueryClient();
  const { success, error: showError, warning } = useToast();

  return useMutation<void, Error, DeleteRecordingParams, DeleteRecordingMutationContext>({
    mutationFn: async ({ recordingId }): Promise<void> => {
      const response = await apiClient.delete<{ success: boolean; error?: string }>(
        `/bigbluebuttonbn/recordings/${recordingId}`
      );

      if (!response.data.success) {
        throw new Error(response.data.error ?? 'Failed to delete recording');
      }
    },

    // Optimistic update: immediately remove from UI
    onMutate: async ({ recordingId }) => {
      await queryClient.cancelQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });

      // Store all query data that might contain this recording for rollback
      const previousRecordings = queryClient.getQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId)
      );

      // Also try to get from filtered queries
      const allQueriesData = queryClient.getQueriesData<BBBRecording[]>({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });

      // Optimistically remove the recording from all cached lists
      queryClient.setQueriesData<BBBRecording[]>(
        { queryKey: bbbRecordingsKeys.list(instanceId) },
        (old) => old?.filter((recording) => recording.recordingId !== recordingId)
      );

      return { previousRecordings, allQueriesData };
    },

    // Rollback on error with user notification
    onError: (err, _variables, context) => {
      // Restore previous data
      if (context?.previousRecordings) {
        queryClient.setQueryData(
          bbbRecordingsKeys.list(instanceId),
          context.previousRecordings
        );
      }

      // Restore all filtered queries if available
      if (context?.allQueriesData) {
        context.allQueriesData.forEach(([queryKey, data]) => {
          if (data) {
            queryClient.setQueryData(queryKey, data);
          }
        });
      }

      showError(`Failed to delete recording: ${err.message}`);
      warning('The recording has been restored in the list');
    },

    // Show success message
    onSuccess: () => {
      success('Recording deleted permanently');
    },

    // Always refetch after mutation settles
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });
    },
  });
}

// ============================================================================
// useUpdateBBBRecordingMetadata Hook
// ============================================================================

/**
 * React Query mutation hook for updating BigBlueButton recording metadata.
 *
 * Updates recording metadata such as name and description. Implements
 * optimistic updates for immediate UI feedback and proper rollback on error.
 *
 * @param instanceId - The BigBlueButton instance ID for cache invalidation
 * @returns Mutation result with mutate function, loading state, and error state
 *
 * @example
 * ```tsx
 * const { mutate: updateMetadata, isLoading } = useUpdateBBBRecordingMetadata(instanceId);
 *
 * const handleUpdate = (recordingId: string, name: string, description: string) => {
 *   updateMetadata({
 *     recordingId,
 *     name,
 *     description,
 *   });
 * };
 * ```
 */
export function useUpdateBBBRecordingMetadata(instanceId: number) {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();

  return useMutation<BBBRecording, Error, UpdateRecordingMetadataParams, RecordingMutationContext>({
    mutationFn: async ({
      recordingId,
      name,
      description,
    }): Promise<BBBRecording> => {
      const updateData: Record<string, string> = {};
      if (name !== undefined) {
        updateData.name = name;
      }
      if (description !== undefined) {
        updateData.description = description;
      }

      const response = await apiClient.put<RecordingOperationResponse>(
        `/bigbluebuttonbn/recordings/${recordingId}`,
        updateData
      );

      if (!response.data.success) {
        throw new Error(
          response.data.error ?? 'Failed to update recording metadata'
        );
      }

      return response.data.data.recording;
    },

    // Optimistic update: immediately show updated metadata in UI
    onMutate: async ({ recordingId, name, description }) => {
      await queryClient.cancelQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });

      const previousRecordings = queryClient.getQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId)
      );

      queryClient.setQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId),
        (old) =>
          old?.map((recording) =>
            recording.recordingId === recordingId
              ? {
                  ...recording,
                  ...(name !== undefined && { name }),
                  ...(description !== undefined && { description }),
                }
              : recording
          )
      );

      return { previousRecordings };
    },

    // Rollback on error
    onError: (err, _variables, context) => {
      if (context?.previousRecordings) {
        queryClient.setQueryData(
          bbbRecordingsKeys.list(instanceId),
          context.previousRecordings
        );
      }
      showError(`Failed to update recording: ${err.message}`);
    },

    // Show success message
    onSuccess: () => {
      success('Recording updated successfully');
    },

    // Always refetch after mutation settles
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });
    },
  });
}

// ============================================================================
// Bulk Operations Support
// ============================================================================

/**
 * Parameters for bulk publish/unpublish operations
 */
export interface BulkPublishParams {
  /** Array of recording IDs to publish/unpublish */
  recordingIds: string[];
}

/**
 * React Query mutation hook for bulk publishing BigBlueButton recordings.
 *
 * Publishes multiple recordings at once with optimistic updates for all.
 * Useful for batch operations in the recordings management interface.
 *
 * @param instanceId - The BigBlueButton instance ID for cache invalidation
 * @returns Mutation result with mutate function, loading state, and error state
 *
 * @example
 * ```tsx
 * const { mutate: bulkPublish, isLoading } = useBulkPublishBBBRecordings(instanceId);
 *
 * const handleBulkPublish = (selectedIds: string[]) => {
 *   bulkPublish({ recordingIds: selectedIds });
 * };
 * ```
 */
export function useBulkPublishBBBRecordings(instanceId: number) {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();

  return useMutation<BBBRecording[], Error, BulkPublishParams, RecordingMutationContext>({
    mutationFn: async ({ recordingIds }): Promise<BBBRecording[]> => {
      const response = await apiClient.post<{
        success: boolean;
        data: { recordings: BBBRecording[] };
        error?: string;
      }>(`/bigbluebuttonbn/${instanceId}/recordings/bulk-publish`, {
        recordingIds,
      });

      if (!response.data.success) {
        throw new Error(response.data.error ?? 'Failed to publish recordings');
      }

      return response.data.data.recordings;
    },

    // Optimistic update: immediately show published state for all recordings
    onMutate: async ({ recordingIds }) => {
      await queryClient.cancelQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });

      const previousRecordings = queryClient.getQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId)
      );

      queryClient.setQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId),
        (old) =>
          old?.map((recording) =>
            recordingIds.includes(recording.recordingId)
              ? { ...recording, published: true }
              : recording
          )
      );

      return { previousRecordings };
    },

    onError: (err, _variables, context) => {
      if (context?.previousRecordings) {
        queryClient.setQueryData(
          bbbRecordingsKeys.list(instanceId),
          context.previousRecordings
        );
      }
      showError(`Failed to publish recordings: ${err.message}`);
    },

    onSuccess: (data) => {
      success(`Successfully published ${data.length} recording(s)`);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });
    },
  });
}

/**
 * React Query mutation hook for bulk unpublishing BigBlueButton recordings.
 *
 * Unpublishes multiple recordings at once with optimistic updates for all.
 *
 * @param instanceId - The BigBlueButton instance ID for cache invalidation
 * @returns Mutation result with mutate function, loading state, and error state
 */
export function useBulkUnpublishBBBRecordings(instanceId: number) {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();

  return useMutation<BBBRecording[], Error, BulkPublishParams, RecordingMutationContext>({
    mutationFn: async ({ recordingIds }): Promise<BBBRecording[]> => {
      const response = await apiClient.post<{
        success: boolean;
        data: { recordings: BBBRecording[] };
        error?: string;
      }>(`/bigbluebuttonbn/${instanceId}/recordings/bulk-unpublish`, {
        recordingIds,
      });

      if (!response.data.success) {
        throw new Error(response.data.error ?? 'Failed to unpublish recordings');
      }

      return response.data.data.recordings;
    },

    onMutate: async ({ recordingIds }) => {
      await queryClient.cancelQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });

      const previousRecordings = queryClient.getQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId)
      );

      queryClient.setQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId),
        (old) =>
          old?.map((recording) =>
            recordingIds.includes(recording.recordingId)
              ? { ...recording, published: false }
              : recording
          )
      );

      return { previousRecordings };
    },

    onError: (err, _variables, context) => {
      if (context?.previousRecordings) {
        queryClient.setQueryData(
          bbbRecordingsKeys.list(instanceId),
          context.previousRecordings
        );
      }
      showError(`Failed to unpublish recordings: ${err.message}`);
    },

    onSuccess: (data) => {
      success(`Successfully unpublished ${data.length} recording(s)`);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });
    },
  });
}

/**
 * Parameters for bulk delete operation
 */
export interface BulkDeleteParams {
  /** Array of recording IDs to delete */
  recordingIds: string[];
}

/**
 * React Query mutation hook for bulk deleting BigBlueButton recordings.
 *
 * Permanently deletes multiple recordings at once.
 * IMPORTANT: This action is irreversible.
 *
 * @param instanceId - The BigBlueButton instance ID for cache invalidation
 * @returns Mutation result with mutate function, loading state, and error state
 */
export function useBulkDeleteBBBRecordings(instanceId: number) {
  const queryClient = useQueryClient();
  const { success, error: showError, warning } = useToast();

  return useMutation<void, Error, BulkDeleteParams, BulkDeleteMutationContext>({
    mutationFn: async ({ recordingIds }): Promise<void> => {
      const response = await apiClient.post<{
        success: boolean;
        error?: string;
      }>(`/bigbluebuttonbn/${instanceId}/recordings/bulk-delete`, {
        recordingIds,
      });

      if (!response.data.success) {
        throw new Error(response.data.error ?? 'Failed to delete recordings');
      }
    },

    onMutate: async ({ recordingIds }) => {
      await queryClient.cancelQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });

      const previousRecordings = queryClient.getQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId)
      );

      queryClient.setQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId),
        (old) =>
          old?.filter(
            (recording) => !recordingIds.includes(recording.recordingId)
          )
      );

      return { previousRecordings, deletedCount: recordingIds.length };
    },

    onError: (err, _variables, context) => {
      if (context?.previousRecordings) {
        queryClient.setQueryData(
          bbbRecordingsKeys.list(instanceId),
          context.previousRecordings
        );
      }
      showError(`Failed to delete recordings: ${err.message}`);
      warning('Recordings have been restored in the list');
    },

    onSuccess: (_data, { recordingIds }) => {
      success(`Successfully deleted ${recordingIds.length} recording(s)`);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });
    },
  });
}
