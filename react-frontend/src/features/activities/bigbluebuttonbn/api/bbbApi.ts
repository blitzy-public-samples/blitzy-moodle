/**
 * BigBlueButton API Integration Module
 *
 * This module provides React Query hooks and API client functions for BigBlueButton
 * conferencing operations. It handles all communication with the Moodle backend
 * for BBB-related functionality including meeting management, recording operations,
 * and real-time status polling.
 *
 * Features:
 * - Fetching BBB instance data and configuration
 * - Creating, joining, and ending meetings
 * - Real-time meeting status polling during active sessions
 * - Recording management (publish, delete, import)
 * - Automatic cache invalidation on mutations
 * - Optimistic updates for improved UX
 * - Comprehensive error handling for BBB-specific scenarios
 *
 * API Endpoints Wrapped:
 * - GET /api/v1/bigbluebuttonbn/{id} - Instance data
 * - GET /api/v1/bigbluebuttonbn/{id}/status - Meeting status
 * - GET /api/v1/bigbluebuttonbn/{id}/recordings - Recordings list
 * - POST /api/v1/bigbluebuttonbn/{id}/join - Join meeting
 * - POST /api/v1/bigbluebuttonbn/{id}/create - Create meeting
 * - POST /api/v1/bigbluebuttonbn/{id}/end - End meeting
 * - POST /api/v1/bigbluebuttonbn/recordings/{id}/publish - Publish recording
 * - DELETE /api/v1/bigbluebuttonbn/recordings/{id} - Delete recording
 * - POST /api/v1/bigbluebuttonbn/recordings/import - Import recording
 *
 * @packageDocumentation
 * @module features/activities/bigbluebuttonbn/api
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import type { ApiResponse } from '@/types/api';
import type {
  BBBInstance,
  BBBRecording,
  BBBRoomStatus,
  BBBJoinOptions,
} from '../types/bbb.types';

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Query key factory for BigBlueButton-related queries.
 *
 * Following React Query v5 best practices for hierarchical query keys.
 * This allows for granular cache invalidation and prefetching.
 *
 * @example
 * ```typescript
 * // All BBB queries
 * queryClient.invalidateQueries({ queryKey: bbbQueryKeys.all });
 *
 * // All queries for a specific instance
 * queryClient.invalidateQueries({ queryKey: bbbQueryKeys.instance(123) });
 *
 * // Just the meeting status for an instance
 * queryClient.invalidateQueries({ queryKey: bbbQueryKeys.status(123) });
 * ```
 */
export const bbbQueryKeys = {
  /** Root key for all BBB queries */
  all: ['bigbluebuttonbn'] as const,

  /** Key for instance-related queries */
  instances: () => [...bbbQueryKeys.all, 'instances'] as const,

  /** Key for a specific instance */
  instance: (id: number) => [...bbbQueryKeys.all, id, 'instance'] as const,

  /** Key for meeting status queries */
  statuses: () => [...bbbQueryKeys.all, 'statuses'] as const,

  /** Key for a specific instance's meeting status */
  status: (id: number) => [...bbbQueryKeys.all, id, 'status'] as const,

  /** Key for recordings queries */
  recordings: () => [...bbbQueryKeys.all, 'recordings'] as const,

  /** Key for a specific instance's recordings */
  instanceRecordings: (id: number) =>
    [...bbbQueryKeys.all, id, 'recordings'] as const,

  /** Key for a specific recording */
  recording: (recordingId: number) =>
    [...bbbQueryKeys.all, 'recording', recordingId] as const,
} as const;

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response structure for join meeting operation.
 * Contains the URL to redirect users to the BBB server.
 */
interface JoinMeetingResponse {
  /** URL to join the meeting on BBB server */
  joinUrl: string;
  /** Whether the user joined as moderator */
  isModerator: boolean;
  /** Meeting ID on BBB server */
  meetingId: string;
}

/**
 * Response structure for create meeting operation.
 * Contains the meeting details after successful creation.
 */
interface CreateMeetingResponse {
  /** Whether the meeting was successfully created */
  created: boolean;
  /** Internal meeting ID on BBB server */
  internalMeetingId: string;
  /** Meeting ID used for joining */
  meetingId: string;
  /** URL to join the newly created meeting */
  joinUrl: string;
}

/**
 * Response structure for end meeting operation.
 */
interface EndMeetingResponse {
  /** Whether the meeting was successfully ended */
  ended: boolean;
  /** Message describing the result */
  message: string;
}

/**
 * Response structure for recording management operations.
 */
interface RecordingOperationResponse {
  /** Whether the operation was successful */
  success: boolean;
  /** Updated recording data (if applicable) */
  recording: BBBRecording | null;
  /** Message describing the result */
  message: string;
}

// ============================================================================
// API Client Functions
// ============================================================================

/**
 * Fetch BigBlueButton instance data.
 *
 * Retrieves the configuration and settings for a BBB activity instance
 * including room settings, presentations, and user limits.
 *
 * Wraps: GET /api/v1/bigbluebuttonbn/{id}
 * PHP Backend: instance::get_from_instanceid()
 *
 * @param id - BBB instance ID
 * @returns Promise resolving to BBB instance data
 *
 * @example
 * ```typescript
 * const instance = await fetchBBBInstance(123);
 * console.log(instance.name); // "Weekly Team Meeting"
 * ```
 */
export async function fetchBBBInstance(id: number): Promise<BBBInstance> {
  const response = await apiClient.get<ApiResponse<BBBInstance>>(
    `/bigbluebuttonbn/${id}`
  );
  return response.data.data;
}

/**
 * Fetch current meeting status for a BBB instance.
 *
 * Retrieves real-time information about the meeting including whether
 * it's running, participant counts, and join availability.
 *
 * Wraps: GET /api/v1/bigbluebuttonbn/{id}/status
 * PHP Backend: meeting::get_meeting_info()
 *
 * @param id - BBB instance ID
 * @returns Promise resolving to meeting status information
 *
 * @example
 * ```typescript
 * const status = await fetchBBBMeetingStatus(123);
 * if (status.statusRunning) {
 *   console.log(`${status.participantCount} participants in meeting`);
 * }
 * ```
 */
export async function fetchBBBMeetingStatus(id: number): Promise<BBBRoomStatus> {
  const response = await apiClient.get<ApiResponse<BBBRoomStatus>>(
    `/bigbluebuttonbn/${id}/status`
  );
  return response.data.data;
}

/**
 * Fetch recordings for a BBB instance.
 *
 * Retrieves all available recordings associated with the instance,
 * including published and unpublished recordings based on user permissions.
 *
 * Wraps: GET /api/v1/bigbluebuttonbn/{id}/recordings
 * PHP Backend: recording::get_recordings_for_instance()
 *
 * @param id - BBB instance ID
 * @returns Promise resolving to array of recording data
 *
 * @example
 * ```typescript
 * const recordings = await fetchBBBRecordings(123);
 * recordings.forEach(rec => {
 *   console.log(`${rec.name}: ${rec.status}`);
 * });
 * ```
 */
export async function fetchBBBRecordings(id: number): Promise<BBBRecording[]> {
  const response = await apiClient.get<ApiResponse<BBBRecording[]>>(
    `/bigbluebuttonbn/${id}/recordings`
  );
  return response.data.data;
}

/**
 * Join a BigBlueButton meeting.
 *
 * Creates or joins an existing meeting and returns the join URL.
 * The meeting is automatically created if it doesn't exist yet.
 *
 * Wraps: POST /api/v1/bigbluebuttonbn/{id}/join
 * PHP Backend: meeting::join_meeting()
 *
 * @param id - BBB instance ID
 * @param options - Optional join configuration (redirect, HTML5 client, etc.)
 * @returns Promise resolving to join URL and meeting info
 * @throws Error if user cannot join (meeting full, requires moderator, etc.)
 *
 * @example
 * ```typescript
 * try {
 *   const result = await joinBBBMeeting(123);
 *   window.open(result.joinUrl, '_blank');
 * } catch (error) {
 *   // Handle "meeting full" or "wait for moderator" errors
 * }
 * ```
 */
export async function joinBBBMeeting(
  id: number,
  options?: Partial<BBBJoinOptions>
): Promise<JoinMeetingResponse> {
  const response = await apiClient.post<ApiResponse<JoinMeetingResponse>>(
    `/bigbluebuttonbn/${id}/join`,
    options ?? {}
  );
  return response.data.data;
}

/**
 * Create a new BigBlueButton meeting.
 *
 * Creates a new meeting room on the BBB server without joining it.
 * Typically used by moderators to set up a room before participants arrive.
 *
 * Wraps: POST /api/v1/bigbluebuttonbn/{id}/create
 * PHP Backend: meeting::create_meeting()
 *
 * @param id - BBB instance ID
 * @returns Promise resolving to created meeting information
 * @throws Error if user doesn't have permission to create meetings
 *
 * @example
 * ```typescript
 * const result = await createBBBMeeting(123);
 * console.log(`Meeting created: ${result.meetingId}`);
 * ```
 */
export async function createBBBMeeting(id: number): Promise<CreateMeetingResponse> {
  const response = await apiClient.post<ApiResponse<CreateMeetingResponse>>(
    `/bigbluebuttonbn/${id}/create`
  );
  return response.data.data;
}

/**
 * End a BigBlueButton meeting.
 *
 * Forces all participants to leave and ends the active meeting session.
 * Only available to moderators.
 *
 * Wraps: POST /api/v1/bigbluebuttonbn/{id}/end
 * PHP Backend: meeting::end_meeting()
 *
 * @param id - BBB instance ID
 * @returns Promise resolving to operation result
 * @throws Error if user doesn't have moderator permissions
 *
 * @example
 * ```typescript
 * const result = await endBBBMeeting(123);
 * if (result.ended) {
 *   console.log('Meeting ended successfully');
 * }
 * ```
 */
export async function endBBBMeeting(id: number): Promise<EndMeetingResponse> {
  const response = await apiClient.post<ApiResponse<EndMeetingResponse>>(
    `/bigbluebuttonbn/${id}/end`
  );
  return response.data.data;
}

/**
 * Publish or unpublish a recording.
 *
 * Changes the publication status of a recording, making it visible
 * or hidden from students.
 *
 * Wraps: POST /api/v1/bigbluebuttonbn/recordings/{id}/publish
 * PHP Backend: recording::set_published()
 *
 * @param recordingId - Recording ID to update
 * @param published - Whether to publish (true) or unpublish (false)
 * @returns Promise resolving to operation result
 * @throws Error if user doesn't have permission to manage recordings
 *
 * @example
 * ```typescript
 * // Publish a recording
 * await publishBBBRecording(456, true);
 *
 * // Unpublish a recording
 * await publishBBBRecording(456, false);
 * ```
 */
export async function publishBBBRecording(
  recordingId: number,
  published: boolean
): Promise<RecordingOperationResponse> {
  const response = await apiClient.post<ApiResponse<RecordingOperationResponse>>(
    `/bigbluebuttonbn/recordings/${recordingId}/publish`,
    { published }
  );
  return response.data.data;
}

/**
 * Delete a recording.
 *
 * Permanently removes a recording from both the Moodle database
 * and the BBB server (for non-imported recordings).
 *
 * Wraps: DELETE /api/v1/bigbluebuttonbn/recordings/{id}
 * PHP Backend: recording::delete()
 *
 * @param recordingId - Recording ID to delete
 * @returns Promise resolving to operation result
 * @throws Error if user doesn't have permission to delete recordings
 *
 * @example
 * ```typescript
 * const result = await deleteBBBRecording(456);
 * if (result.success) {
 *   console.log('Recording deleted');
 * }
 * ```
 */
export async function deleteBBBRecording(
  recordingId: number
): Promise<RecordingOperationResponse> {
  const response = await apiClient.delete<ApiResponse<RecordingOperationResponse>>(
    `/bigbluebuttonbn/recordings/${recordingId}`
  );
  return response.data.data;
}

/**
 * Import a recording from another BBB instance.
 *
 * Creates a copy of an existing recording in a different BBB instance,
 * allowing recordings to be shared across multiple activities.
 *
 * Wraps: POST /api/v1/bigbluebuttonbn/recordings/import
 * PHP Backend: recording::create_imported_recording()
 *
 * @param sourceRecordingId - ID of the recording to import
 * @param targetInstanceId - ID of the BBB instance to import into
 * @returns Promise resolving to the newly created imported recording
 * @throws Error if user doesn't have permission to import recordings
 *
 * @example
 * ```typescript
 * const result = await importBBBRecording(456, 789);
 * console.log(`Imported as recording ID: ${result.recording?.id}`);
 * ```
 */
export async function importBBBRecording(
  sourceRecordingId: number,
  targetInstanceId: number
): Promise<RecordingOperationResponse> {
  const response = await apiClient.post<ApiResponse<RecordingOperationResponse>>(
    '/bigbluebuttonbn/recordings/import',
    { sourceRecordingId, targetInstanceId }
  );
  return response.data.data;
}

// ============================================================================
// React Query Hooks - Queries
// ============================================================================

/**
 * React Query hook for fetching BBB instance data.
 *
 * Fetches and caches the configuration and settings for a BBB activity.
 * Data is cached for 5 minutes by default (staleTime).
 *
 * @param id - BBB instance ID
 * @param options - Additional React Query options
 * @returns Query result with BBB instance data
 *
 * @example
 * ```typescript
 * function BBBInstanceInfo({ instanceId }: { instanceId: number }) {
 *   const { data: instance, isLoading, error } = useBBBInstance(instanceId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <h1>{instance.name}</h1>
 *       <p>{instance.intro}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useBBBInstance(
  id: number,
  options?: Omit<
    UseQueryOptions<BBBInstance, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<BBBInstance, Error>({
    queryKey: bbbQueryKeys.instance(id),
    queryFn: () => fetchBBBInstance(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    enabled: id > 0,
    ...options,
  });
}

/**
 * React Query hook for fetching real-time meeting status.
 *
 * Fetches the current meeting status with automatic polling when
 * the meeting is active. Polling is disabled when the meeting is closed.
 *
 * @param id - BBB instance ID
 * @param options - Additional React Query options
 * @returns Query result with meeting status
 *
 * @example
 * ```typescript
 * function MeetingStatus({ instanceId }: { instanceId: number }) {
 *   const { data: status, isLoading } = useBBBMeetingStatus(instanceId, {
 *     // Refresh every 5 seconds when meeting is running
 *     refetchInterval: (query) =>
 *       query.state.data?.statusRunning ? 5000 : false,
 *   });
 *
 *   if (isLoading) return <LoadingSpinner />;
 *
 *   return (
 *     <StatusIndicator
 *       running={status.statusRunning}
 *       participants={status.participantCount}
 *       message={status.statusMessage}
 *     />
 *   );
 * }
 * ```
 */
export function useBBBMeetingStatus(
  id: number,
  options?: Omit<
    UseQueryOptions<BBBRoomStatus, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<BBBRoomStatus, Error>({
    queryKey: bbbQueryKeys.status(id),
    queryFn: () => fetchBBBMeetingStatus(id),
    // Short stale time for real-time status
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 30 * 1000, // 30 seconds
    enabled: id > 0,
    // Enable polling when meeting is running
    refetchInterval: (query) => {
      const data = query.state.data;
      // Poll every 5 seconds when meeting is running
      if (data?.statusRunning) {
        return 5000;
      }
      // Poll every 30 seconds when meeting is open but not running
      if (data?.statusOpen && !data?.statusClosed) {
        return 30000;
      }
      // No polling when meeting is closed
      return false;
    },
    refetchIntervalInBackground: false,
    ...options,
  });
}

/**
 * React Query hook for fetching recordings for a BBB instance.
 *
 * Fetches and caches all recordings associated with the instance.
 * Results are cached for 2 minutes by default.
 *
 * @param id - BBB instance ID
 * @param options - Additional React Query options
 * @returns Query result with recordings array
 *
 * @example
 * ```typescript
 * function RecordingsList({ instanceId }: { instanceId: number }) {
 *   const { data: recordings, isLoading } = useBBBRecordings(instanceId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *
 *   return (
 *     <ul>
 *       {recordings.map(recording => (
 *         <RecordingItem key={recording.id} recording={recording} />
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useBBBRecordings(
  id: number,
  options?: Omit<
    UseQueryOptions<BBBRecording[], Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<BBBRecording[], Error>({
    queryKey: bbbQueryKeys.instanceRecordings(id),
    queryFn: () => fetchBBBRecordings(id),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: id > 0,
    ...options,
  });
}

// ============================================================================
// React Query Hooks - Mutations
// ============================================================================

/**
 * React Query mutation hook for joining a BBB meeting.
 *
 * Handles the join meeting flow with optimistic updates and
 * automatic cache invalidation on success.
 *
 * @param instanceId - BBB instance ID
 * @param options - Additional mutation options
 * @returns Mutation object with mutate function and state
 *
 * @example
 * ```typescript
 * function JoinMeetingButton({ instanceId }: { instanceId: number }) {
 *   const joinMutation = useJoinBBBMeeting(instanceId, {
 *     onSuccess: (data) => {
 *       // Open meeting in new window
 *       window.open(data.joinUrl, '_blank');
 *     },
 *     onError: (error) => {
 *       // Handle specific errors
 *       if (error.message.includes('user_limit_reached')) {
 *         showToast('Meeting is full. Please try again later.');
 *       }
 *     },
 *   });
 *
 *   return (
 *     <Button
 *       onClick={() => joinMutation.mutate({})}
 *       disabled={joinMutation.isPending}
 *     >
 *       {joinMutation.isPending ? 'Joining...' : 'Join Meeting'}
 *     </Button>
 *   );
 * }
 * ```
 */
export function useJoinBBBMeeting(
  instanceId: number,
  options?: Omit<
    UseMutationOptions<JoinMeetingResponse, Error, Partial<BBBJoinOptions>, undefined>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<JoinMeetingResponse, Error, Partial<BBBJoinOptions>, undefined>({
    mutationFn: (joinOptions) => joinBBBMeeting(instanceId, joinOptions),
    onSuccess: (data, variables, onMutateResult, mutationContext) => {
      // Invalidate status query to reflect new participant
      void queryClient.invalidateQueries({
        queryKey: bbbQueryKeys.status(instanceId),
      });

      // Call user's onSuccess if provided
      if (options?.onSuccess) {
        options.onSuccess(data, variables, onMutateResult, mutationContext);
      }
    },
    onError: options?.onError,
    onSettled: options?.onSettled,
    retry: options?.retry,
    retryDelay: options?.retryDelay,
    meta: options?.meta,
  });
}

/**
 * React Query mutation hook for creating a BBB meeting.
 *
 * Creates a new meeting on the BBB server without joining it.
 * Typically used by moderators to prepare the room.
 *
 * @param instanceId - BBB instance ID
 * @param options - Additional mutation options
 * @returns Mutation object with mutate function and state
 *
 * @example
 * ```typescript
 * function CreateMeetingButton({ instanceId }: { instanceId: number }) {
 *   const createMutation = useCreateBBBMeeting(instanceId, {
 *     onSuccess: () => {
 *       showToast('Meeting room is ready');
 *     },
 *   });
 *
 *   return (
 *     <Button
 *       onClick={() => createMutation.mutate()}
 *       disabled={createMutation.isPending}
 *     >
 *       Create Meeting
 *     </Button>
 *   );
 * }
 * ```
 */
export function useCreateBBBMeeting(
  instanceId: number,
  options?: Omit<
    UseMutationOptions<CreateMeetingResponse, Error, void, undefined>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<CreateMeetingResponse, Error, void, undefined>({
    mutationFn: () => createBBBMeeting(instanceId),
    onSuccess: (data, variables, onMutateResult, mutationContext) => {
      // Invalidate status query to show meeting is now running
      void queryClient.invalidateQueries({
        queryKey: bbbQueryKeys.status(instanceId),
      });

      // Call user's onSuccess if provided
      if (options?.onSuccess) {
        options.onSuccess(data, variables, onMutateResult, mutationContext);
      }
    },
    onError: options?.onError,
    onSettled: options?.onSettled,
    retry: options?.retry,
    retryDelay: options?.retryDelay,
    meta: options?.meta,
  });
}

/**
 * React Query mutation hook for ending a BBB meeting.
 *
 * Forces all participants to leave and ends the active session.
 * Only available to moderators.
 *
 * @param instanceId - BBB instance ID
 * @param options - Additional mutation options
 * @returns Mutation object with mutate function and state
 *
 * @example
 * ```typescript
 * function EndMeetingButton({ instanceId }: { instanceId: number }) {
 *   const endMutation = useEndBBBMeeting(instanceId, {
 *     onSuccess: () => {
 *       showToast('Meeting has been ended');
 *     },
 *   });
 *
 *   return (
 *     <Button
 *       color="error"
 *       onClick={() => {
 *         if (confirm('Are you sure you want to end this meeting?')) {
 *           endMutation.mutate();
 *         }
 *       }}
 *       disabled={endMutation.isPending}
 *     >
 *       End Meeting
 *     </Button>
 *   );
 * }
 * ```
 */
export function useEndBBBMeeting(
  instanceId: number,
  options?: Omit<
    UseMutationOptions<EndMeetingResponse, Error, void, undefined>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<EndMeetingResponse, Error, void, undefined>({
    mutationFn: () => endBBBMeeting(instanceId),
    onSuccess: (data, variables, onMutateResult, mutationContext) => {
      // Invalidate status query to show meeting has ended
      void queryClient.invalidateQueries({
        queryKey: bbbQueryKeys.status(instanceId),
      });

      // Invalidate recordings query as new recording may be available
      void queryClient.invalidateQueries({
        queryKey: bbbQueryKeys.instanceRecordings(instanceId),
      });

      // Call user's onSuccess if provided
      if (options?.onSuccess) {
        options.onSuccess(data, variables, onMutateResult, mutationContext);
      }
    },
    onError: options?.onError,
    onSettled: options?.onSettled,
    retry: options?.retry,
    retryDelay: options?.retryDelay,
    meta: options?.meta,
  });
}

/**
 * Recording management action types for the useManageRecording hook.
 */
export type RecordingAction =
  | { type: 'publish'; recordingId: number; published: boolean }
  | { type: 'delete'; recordingId: number }
  | { type: 'import'; sourceRecordingId: number; targetInstanceId: number };

/**
 * React Query mutation hook for managing recordings.
 *
 * Unified hook for recording operations including publish, delete,
 * and import. Provides optimistic updates and automatic cache
 * invalidation.
 *
 * @param instanceId - BBB instance ID (for cache invalidation)
 * @param options - Additional mutation options
 * @returns Mutation object with mutate function and state
 *
 * @example
 * ```typescript
 * function RecordingActions({ instanceId, recording }: Props) {
 *   const manageMutation = useManageRecording(instanceId);
 *
 *   const handlePublishToggle = () => {
 *     manageMutation.mutate({
 *       type: 'publish',
 *       recordingId: recording.id,
 *       published: !recording.published,
 *     });
 *   };
 *
 *   const handleDelete = () => {
 *     if (confirm('Delete this recording?')) {
 *       manageMutation.mutate({
 *         type: 'delete',
 *         recordingId: recording.id,
 *       });
 *     }
 *   };
 *
 *   const handleImport = (targetId: number) => {
 *     manageMutation.mutate({
 *       type: 'import',
 *       sourceRecordingId: recording.id,
 *       targetInstanceId: targetId,
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <Button onClick={handlePublishToggle}>
 *         {recording.published ? 'Unpublish' : 'Publish'}
 *       </Button>
 *       <Button onClick={handleDelete}>Delete</Button>
 *     </div>
 *   );
 * }
 * ```
 */
/**
 * Context type for recording management mutation.
 * Used for optimistic updates and rollback on error.
 */
interface ManageRecordingContext {
  previousRecordings: BBBRecording[] | undefined;
}

export function useManageRecording(
  instanceId: number,
  options?: Omit<
    UseMutationOptions<RecordingOperationResponse, Error, RecordingAction, ManageRecordingContext>,
    'mutationFn' | 'onMutate'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<RecordingOperationResponse, Error, RecordingAction, ManageRecordingContext>({
    mutationFn: async (action) => {
      switch (action.type) {
        case 'publish':
          return publishBBBRecording(action.recordingId, action.published);
        case 'delete':
          return deleteBBBRecording(action.recordingId);
        case 'import':
          return importBBBRecording(
            action.sourceRecordingId,
            action.targetInstanceId
          );
        default:
          throw new Error('Unknown recording action');
      }
    },
    onMutate: async (action): Promise<ManageRecordingContext> => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: bbbQueryKeys.instanceRecordings(instanceId),
      });

      // Snapshot previous value for potential rollback
      const previousRecordings = queryClient.getQueryData<BBBRecording[]>(
        bbbQueryKeys.instanceRecordings(instanceId)
      );

      // Optimistic update for publish action
      if (action.type === 'publish' && previousRecordings) {
        queryClient.setQueryData<BBBRecording[]>(
          bbbQueryKeys.instanceRecordings(instanceId),
          previousRecordings.map((recording) =>
            recording.id === action.recordingId
              ? { ...recording, published: action.published }
              : recording
          )
        );
      }

      // Optimistic update for delete action
      if (action.type === 'delete' && previousRecordings) {
        queryClient.setQueryData<BBBRecording[]>(
          bbbQueryKeys.instanceRecordings(instanceId),
          previousRecordings.filter(
            (recording) => recording.id !== action.recordingId
          )
        );
      }

      return { previousRecordings };
    },
    onError: (error, action, onMutateResult, mutationContext) => {
      // Rollback on error (onMutateResult contains previousRecordings from onMutate)
      if (onMutateResult?.previousRecordings) {
        queryClient.setQueryData(
          bbbQueryKeys.instanceRecordings(instanceId),
          onMutateResult.previousRecordings
        );
      }

      // Call user's onError if provided
      if (options?.onError) {
        options.onError(error, action, onMutateResult, mutationContext);
      }
    },
    onSuccess: (data, action, onMutateResult, mutationContext) => {
      // Invalidate recordings cache to ensure fresh data
      void queryClient.invalidateQueries({
        queryKey: bbbQueryKeys.instanceRecordings(instanceId),
      });

      // For import action, also invalidate target instance's recordings
      if (action.type === 'import') {
        void queryClient.invalidateQueries({
          queryKey: bbbQueryKeys.instanceRecordings(action.targetInstanceId),
        });
      }

      // Call user's onSuccess if provided
      if (options?.onSuccess) {
        options.onSuccess(data, action, onMutateResult, mutationContext);
      }
    },
    onSettled: () => {
      // Always refetch after mutation settles
      void queryClient.invalidateQueries({
        queryKey: bbbQueryKeys.instanceRecordings(instanceId),
      });
    },
    retry: options?.retry,
    retryDelay: options?.retryDelay,
    meta: options?.meta,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Prefetch BBB instance data for improved navigation performance.
 *
 * Call this function to preload instance data before the user navigates
 * to a BBB activity page.
 *
 * @param queryClient - React Query client instance
 * @param id - BBB instance ID to prefetch
 *
 * @example
 * ```typescript
 * // In a course content list component
 * function CourseActivity({ activity, queryClient }) {
 *   const handleMouseEnter = () => {
 *     if (activity.type === 'bigbluebuttonbn') {
 *       prefetchBBBInstance(queryClient, activity.instanceId);
 *     }
 *   };
 *
 *   return (
 *     <Link
 *       to={activity.url}
 *       onMouseEnter={handleMouseEnter}
 *     >
 *       {activity.name}
 *     </Link>
 *   );
 * }
 * ```
 */
export async function prefetchBBBInstance(
  queryClient: ReturnType<typeof useQueryClient>,
  id: number
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: bbbQueryKeys.instance(id),
    queryFn: () => fetchBBBInstance(id),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Prefetch meeting status for improved UX when entering a BBB activity.
 *
 * @param queryClient - React Query client instance
 * @param id - BBB instance ID to prefetch status for
 */
export async function prefetchBBBMeetingStatus(
  queryClient: ReturnType<typeof useQueryClient>,
  id: number
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: bbbQueryKeys.status(id),
    queryFn: () => fetchBBBMeetingStatus(id),
    staleTime: 10 * 1000,
  });
}

/**
 * Prefetch recordings for a BBB instance.
 *
 * @param queryClient - React Query client instance
 * @param id - BBB instance ID to prefetch recordings for
 */
export async function prefetchBBBRecordings(
  queryClient: ReturnType<typeof useQueryClient>,
  id: number
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: bbbQueryKeys.instanceRecordings(id),
    queryFn: () => fetchBBBRecordings(id),
    staleTime: 2 * 60 * 1000,
  });
}
