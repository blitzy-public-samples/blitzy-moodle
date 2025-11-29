/**
 * BigBlueButton React Query Hooks
 *
 * Custom React hooks for managing BigBlueButton (BBB) instance data and meeting operations.
 * Provides data fetching, caching, and mutation capabilities for BBB conference rooms.
 *
 * Features:
 * - Fetch BBB instance details with automatic caching
 * - Create new BBB meetings on the BigBlueButton server
 * - Join existing meetings with automatic URL generation
 * - Poll meeting status with configurable refresh intervals
 * - Optimistic updates for better UX
 * - Comprehensive error handling and retry logic
 *
 * These hooks wrap the BigBlueButton API endpoints and delegate to existing Moodle PHP
 * functions without duplicating any business logic. All permission checks and meeting
 * management are handled by the backend.
 *
 * @module features/activities/bigbluebuttonbn/hooks
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
  type QueryKey,
} from '@tanstack/react-query';
import apiClient from '@/services/api/client';
import type {
  BBBInstance,
  BBBMeeting,
  BBBRoomStatus,
} from '@/features/activities/bigbluebuttonbn/types/bbb.types';
import type { ApiResponse } from '@/types/api';
import type { Id } from '@/types/common';

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query key factory for BBB-related queries.
 * Provides consistent query keys for cache management and invalidation.
 *
 * Using a factory pattern ensures:
 * - Type-safe query keys throughout the application
 * - Consistent cache key structure for predictable invalidation
 * - Easy maintenance and refactoring of query keys
 */
const bbbQueryKeys = {
  /** Base key for all BBB queries */
  all: ['bigbluebuttonbn'] as const,

  /** Key for BBB instance list queries */
  instances: () => [...bbbQueryKeys.all, 'instances'] as const,

  /** Key for a specific BBB instance query */
  instance: (instanceId: Id) =>
    [...bbbQueryKeys.instances(), instanceId] as const,

  /** Key for meeting info queries */
  meetingInfo: (instanceId: Id) =>
    [...bbbQueryKeys.all, 'meeting-info', instanceId] as const,
} as const;

// ============================================================================
// API Endpoint Constants
// ============================================================================

/**
 * BBB API endpoint paths.
 * All endpoints follow the RESTful convention from the API layer.
 */
const BBB_ENDPOINTS = {
  /** Get BBB instance details */
  instance: (id: Id) => `/bigbluebuttonbn/${id}`,

  /** Get meeting info/status */
  meetingInfo: (id: Id) => `/bigbluebuttonbn/${id}/info`,

  /** Create a new meeting */
  createMeeting: (id: Id) => `/bigbluebuttonbn/${id}/create`,

  /** Join an existing meeting */
  joinMeeting: (id: Id) => `/bigbluebuttonbn/${id}/join`,
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Response type for creating a BBB meeting.
 * Contains the meeting details after successful creation.
 */
interface CreateMeetingResponse {
  /** The created meeting details */
  meeting: BBBMeeting;

  /** Internal meeting ID from BBB server */
  internalMeetingId: string;

  /** Whether the meeting was newly created or already existed */
  created: boolean;
}

/**
 * Response type for joining a BBB meeting.
 * Contains the URL to redirect the user to the meeting.
 */
interface JoinMeetingResponse {
  /** URL to join the meeting */
  joinUrl: string;

  /** Whether the user is joining as moderator */
  isModerator: boolean;

  /** Meeting information */
  meeting: BBBMeeting;
}

/**
 * Input parameters for creating a meeting.
 */
interface CreateMeetingParams {
  /** The BBB instance ID */
  instanceId: Id;

  /** Optional group ID for group-specific meetings */
  groupId?: number;
}

/**
 * Input parameters for joining a meeting.
 */
interface JoinMeetingParams {
  /** The BBB instance ID */
  instanceId: Id;

  /** Optional group ID for group-specific meetings */
  groupId?: number;

  /** Whether to redirect immediately (default: true) */
  redirect?: boolean;
}

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Default cache time for BBB instance data (5 minutes).
 * Instance configuration doesn't change frequently.
 */
const INSTANCE_STALE_TIME = 5 * 60 * 1000;

/**
 * Default cache time for meeting info (30 seconds when active).
 * Meeting status needs frequent updates during active meetings.
 */
const MEETING_INFO_STALE_TIME = 30 * 1000;

/**
 * Refresh interval for meeting info when meeting is active.
 * Polls every 30 seconds to keep participant counts updated.
 */
const MEETING_INFO_REFETCH_INTERVAL = 30 * 1000;

/**
 * Number of retries for failed API requests.
 */
const MAX_RETRIES = 3;

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetches BBB instance data for a specific instance ID.
 *
 * This hook retrieves the BigBlueButton instance configuration including:
 * - Instance name and description
 * - Opening/closing times
 * - User limits
 * - Recording settings
 * - Presentation files
 *
 * The data is cached with a stale-while-revalidate strategy for optimal
 * performance and user experience.
 *
 * @param instanceId - The unique identifier for the BBB instance
 * @returns React Query result with BBB instance data, loading states, and error handling
 *
 * @example
 * ```tsx
 * function BBBView({ instanceId }) {
 *   const { data: instance, isLoading, isError, error } = useBBBInstance(instanceId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (isError) return <ErrorMessage error={error} />;
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
  instanceId: Id
): UseQueryResult<BBBInstance, Error> {
  return useQuery({
    queryKey: bbbQueryKeys.instance(instanceId),

    queryFn: async (): Promise<BBBInstance> => {
      const response = await apiClient.get<ApiResponse<BBBInstance>>(
        BBB_ENDPOINTS.instance(instanceId)
      );
      return response.data.data;
    },

    // Enable query only when instanceId is valid
    enabled: instanceId > 0,

    // Cache configuration: stale after 5 minutes
    staleTime: INSTANCE_STALE_TIME,

    // Retry failed requests up to 3 times
    retry: MAX_RETRIES,

    // Retry with exponential backoff
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Refetch on window focus for data freshness
    refetchOnWindowFocus: true,

    // Keep previous data while refetching for smoother UX
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetches real-time meeting status information for a BBB instance.
 *
 * This hook retrieves the current meeting state including:
 * - Whether the meeting is running
 * - Participant and moderator counts
 * - Whether the current user can join
 * - Status messages for display
 *
 * When the meeting is active, the hook automatically refetches every 30 seconds
 * to keep the UI updated with current participant counts.
 *
 * @param instanceId - The unique identifier for the BBB instance
 * @param options - Optional configuration for the query
 * @param options.enabled - Whether the query should run (default: true)
 * @param options.refetchInterval - Custom refetch interval in ms (default: 30000 when active)
 * @returns React Query result with meeting status, loading states, and error handling
 *
 * @example
 * ```tsx
 * function MeetingStatus({ instanceId }) {
 *   const { data: status, isLoading } = useBBBMeetingInfo(instanceId);
 *
 *   if (isLoading) return <Skeleton />;
 *
 *   return (
 *     <div>
 *       <StatusBadge running={status.statusRunning} />
 *       {status.statusRunning && (
 *         <span>
 *           {status.participantCount} participants,
 *           {status.moderatorCount} moderators
 *         </span>
 *       )}
 *       <p>{status.statusMessage}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useBBBMeetingInfo(
  instanceId: Id,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
): UseQueryResult<BBBRoomStatus, Error> {
  return useQuery({
    queryKey: bbbQueryKeys.meetingInfo(instanceId),

    queryFn: async (): Promise<BBBRoomStatus> => {
      const response = await apiClient.get<ApiResponse<BBBRoomStatus>>(
        BBB_ENDPOINTS.meetingInfo(instanceId)
      );
      return response.data.data;
    },

    // Enable query only when instanceId is valid and not explicitly disabled
    enabled: instanceId > 0 && (options?.enabled !== false),

    // Cache configuration: stale after 30 seconds for real-time data
    staleTime: MEETING_INFO_STALE_TIME,

    // Auto-refresh meeting info when meeting might be active
    // Uses provided interval or defaults to 30 seconds
    refetchInterval: options?.refetchInterval ?? MEETING_INFO_REFETCH_INTERVAL,

    // Only refetch when the component/window is active
    refetchIntervalInBackground: false,

    // Retry failed requests up to 3 times
    retry: MAX_RETRIES,

    // Retry with exponential backoff
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Refetch on window focus for immediate status update
    refetchOnWindowFocus: true,

    // Keep previous data while refetching for smoother UX
    placeholderData: (previousData) => previousData,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Creates a new BigBlueButton meeting.
 *
 * This mutation hook handles the creation of a new meeting room on the
 * BigBlueButton server. It wraps the existing Moodle `create_meeting()`
 * function without duplicating any business logic.
 *
 * Features:
 * - Creates meeting room on BBB server
 * - Sets up recording if enabled
 * - Configures presentation files
 * - Invalidates relevant caches on success
 *
 * @returns Mutation result with functions to trigger meeting creation
 *
 * @example
 * ```tsx
 * function CreateMeetingButton({ instanceId }) {
 *   const createMeeting = useCreateBBBMeeting();
 *
 *   const handleCreate = async () => {
 *     try {
 *       const result = await createMeeting.mutateAsync({ instanceId });
 *       console.log('Meeting created:', result.internalMeetingId);
 *     } catch (error) {
 *       console.error('Failed to create meeting:', error);
 *     }
 *   };
 *
 *   return (
 *     <Button
 *       onClick={handleCreate}
 *       disabled={createMeeting.isPending}
 *       loading={createMeeting.isPending}
 *     >
 *       {createMeeting.isPending ? 'Creating...' : 'Create Meeting'}
 *     </Button>
 *   );
 * }
 * ```
 */
export function useCreateBBBMeeting(): UseMutationResult<
  CreateMeetingResponse,
  Error,
  CreateMeetingParams
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      params: CreateMeetingParams
    ): Promise<CreateMeetingResponse> => {
      const response = await apiClient.post<ApiResponse<CreateMeetingResponse>>(
        BBB_ENDPOINTS.createMeeting(params.instanceId),
        {
          groupId: params.groupId,
        }
      );
      return response.data.data;
    },

    // Invalidate caches on successful meeting creation
    onSuccess: (_data, variables) => {
      // Invalidate the meeting info cache to reflect new meeting state
      void queryClient.invalidateQueries({
        queryKey: bbbQueryKeys.meetingInfo(variables.instanceId),
      });

      // Also invalidate the instance cache in case any settings changed
      void queryClient.invalidateQueries({
        queryKey: bbbQueryKeys.instance(variables.instanceId),
      });
    },

    // Log errors for debugging
    onError: (error, variables) => {
      console.error(
        `Failed to create BBB meeting for instance ${variables.instanceId}:`,
        error.message
      );
    },

    // Retry on network failures
    retry: (failureCount, error) => {
      // Don't retry on client errors (4xx)
      if (error.message.includes('400') || error.message.includes('403')) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Joins an existing BigBlueButton meeting.
 *
 * This mutation hook handles joining a BBB meeting by:
 * 1. Generating the join URL from the backend
 * 2. Logging the join event for activity tracking
 * 3. Redirecting the user to the meeting (optional)
 *
 * The backend validates permissions and generates a secure join URL with
 * the appropriate role (moderator or viewer) based on user capabilities.
 *
 * @returns Mutation result with functions to trigger meeting join
 *
 * @example
 * ```tsx
 * function JoinMeetingButton({ instanceId, canJoin }) {
 *   const joinMeeting = useJoinBBBMeeting();
 *
 *   const handleJoin = async () => {
 *     try {
 *       const result = await joinMeeting.mutateAsync({
 *         instanceId,
 *         redirect: true // Opens meeting in new window
 *       });
 *
 *       // If redirect is false, manually handle the join URL
 *       if (!result.joinUrl) {
 *         window.open(result.joinUrl, '_blank');
 *       }
 *     } catch (error) {
 *       toast.error('Failed to join meeting. Please try again.');
 *     }
 *   };
 *
 *   return (
 *     <Button
 *       onClick={handleJoin}
 *       disabled={!canJoin || joinMeeting.isPending}
 *       variant="contained"
 *       color="primary"
 *     >
 *       {joinMeeting.isPending ? 'Joining...' : 'Join Meeting'}
 *     </Button>
 *   );
 * }
 * ```
 */
export function useJoinBBBMeeting(): UseMutationResult<
  JoinMeetingResponse,
  Error,
  JoinMeetingParams
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      params: JoinMeetingParams
    ): Promise<JoinMeetingResponse> => {
      const response = await apiClient.post<ApiResponse<JoinMeetingResponse>>(
        BBB_ENDPOINTS.joinMeeting(params.instanceId),
        {
          groupId: params.groupId,
          redirect: params.redirect ?? true,
        }
      );
      return response.data.data;
    },

    // Handle successful join
    onSuccess: (data, variables) => {
      // Refresh meeting info to update participant count
      void queryClient.invalidateQueries({
        queryKey: bbbQueryKeys.meetingInfo(variables.instanceId),
      });

      // If redirect is enabled, open the meeting in a new window
      if (variables.redirect !== false && data.joinUrl) {
        window.open(data.joinUrl, '_blank', 'noopener,noreferrer');
      }
    },

    // Log errors for debugging
    onError: (error, variables) => {
      console.error(
        `Failed to join BBB meeting for instance ${variables.instanceId}:`,
        error.message
      );
    },

    // Don't retry join attempts to avoid duplicate join logs
    retry: false,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Prefetches BBB instance data for a given instance ID.
 *
 * Useful for prefetching data before navigation to improve perceived
 * performance. The data will be available in cache when the component
 * using useBBBInstance mounts.
 *
 * @param queryClient - The React Query client instance
 * @param instanceId - The BBB instance ID to prefetch
 *
 * @example
 * ```tsx
 * function BBBActivityLink({ instanceId }) {
 *   const queryClient = useQueryClient();
 *
 *   const handleMouseEnter = () => {
 *     // Prefetch on hover for instant loading on click
 *     prefetchBBBInstance(queryClient, instanceId);
 *   };
 *
 *   return (
 *     <Link
 *       to={`/activities/bigbluebuttonbn/${instanceId}`}
 *       onMouseEnter={handleMouseEnter}
 *     >
 *       View Meeting Room
 *     </Link>
 *   );
 * }
 * ```
 */
export async function prefetchBBBInstance(
  queryClient: ReturnType<typeof useQueryClient>,
  instanceId: Id
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: bbbQueryKeys.instance(instanceId),
    queryFn: async (): Promise<BBBInstance> => {
      const response = await apiClient.get<ApiResponse<BBBInstance>>(
        BBB_ENDPOINTS.instance(instanceId)
      );
      return response.data.data;
    },
    staleTime: INSTANCE_STALE_TIME,
  });
}

/**
 * Invalidates all BBB-related caches for a specific instance.
 *
 * Useful when external changes require refreshing all BBB data,
 * such as after admin modifications or external meeting state changes.
 *
 * @param queryClient - The React Query client instance
 * @param instanceId - The BBB instance ID to invalidate caches for
 *
 * @example
 * ```tsx
 * function AdminBBBControls({ instanceId }) {
 *   const queryClient = useQueryClient();
 *
 *   const handleForceRefresh = () => {
 *     invalidateBBBCaches(queryClient, instanceId);
 *     toast.info('Meeting data refreshed');
 *   };
 *
 *   return (
 *     <Button onClick={handleForceRefresh}>
 *       Refresh Meeting Data
 *     </Button>
 *   );
 * }
 * ```
 */
export function invalidateBBBCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  instanceId: Id
): void {
  void queryClient.invalidateQueries({
    queryKey: bbbQueryKeys.instance(instanceId),
  });
  void queryClient.invalidateQueries({
    queryKey: bbbQueryKeys.meetingInfo(instanceId),
  });
}

/**
 * Returns the query keys used for BBB queries.
 *
 * Useful for external cache management or testing purposes.
 *
 * @returns The query key factory object
 */
export function getBBBQueryKeys(): typeof bbbQueryKeys {
  return bbbQueryKeys;
}
