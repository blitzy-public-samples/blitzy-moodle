/**
 * @fileoverview Custom React hooks for user profile data management
 * 
 * Provides useProfile for fetching profile data via React Query and useUpdateProfile
 * for profile mutation operations. Integrates with the profile API to fetch user details,
 * update profile information including username, email, description, interests, and avatar.
 * 
 * Features:
 * - React Query integration for efficient server state management
 * - Automatic caching with configurable stale time
 * - Background refetching for fresh data
 * - Optimistic updates for better UX
 * - Cache invalidation after mutations
 * - Permission-aware profile editing (enforced by backend)
 * - Comprehensive error handling with typed errors
 * 
 * Backend Integration:
 * - All API calls use existing Moodle functions:
 *   - user_get_user_details() for fetching profiles
 *   - user_update_user() for updating profiles
 *   - user_can_view_profile() for permission checks
 * - Backend enforces all permission checks via require_capability()
 * - No business logic duplicated in React hooks
 * 
 * @module features/profile/hooks/useProfile
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryObserverResult, UseMutationResult } from '@tanstack/react-query';

// Internal imports from profile API
import {
  getUserProfile,
  updateUserProfile,
} from '../api/profileApi';

// Internal imports from types
import type { UpdateProfilePayload } from '../types/profile.types';
import type { User } from '@/types/entities';
import type { ApiError } from '@/types/errors';

// Internal imports from auth
import { useAuth } from '@/features/auth/hooks/useAuth';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Options for the useProfile hook
 */
export interface UseProfileOptions {
  /**
   * User ID to fetch profile for
   * If not provided, defaults to the current authenticated user
   */
  userId?: number;

  /**
   * Whether the query should be enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Auto-refetch interval in milliseconds
   * Set to false to disable auto-refetching
   */
  refetchInterval?: number | false;

  /**
   * Time in milliseconds after which data is considered stale
   * @default 300000 (5 minutes)
   */
  staleTime?: number;

  /**
   * Time in milliseconds that unused/inactive cache data remains in memory
   * @default 1800000 (30 minutes)
   */
  gcTime?: number;
}

/**
 * Return type for the useProfile hook
 * Provides profile data and query state
 */
export interface UseProfileReturn {
  /**
   * User profile data, undefined while loading or if not found
   */
  user: User | undefined;

  /**
   * Whether the profile is currently being loaded
   */
  isLoading: boolean;

  /**
   * Whether an error occurred while fetching the profile
   */
  isError: boolean;

  /**
   * Error object if an error occurred, null otherwise
   */
  error: ApiError | null;

  /**
   * Function to manually refetch the profile data
   */
  refetch: () => Promise<QueryObserverResult<User, ApiError>>;
}

/**
 * Options for the useUpdateProfile mutation hook
 */
export interface UseUpdateProfileOptions {
  /**
   * User ID to update profile for
   * If not provided, defaults to the current authenticated user
   */
  userId?: number;

  /**
   * Callback executed when mutation succeeds
   * @param data - Updated user profile data
   */
  onSuccess?: (data: User) => void;

  /**
   * Callback executed when mutation fails
   * @param error - Error that occurred
   */
  onError?: (error: ApiError) => void;

  /**
   * Callback executed when mutation settles (success or error)
   */
  onSettled?: () => void;
}

/**
 * Return type for the useUpdateProfile hook
 * Provides mutation function and state
 */
export interface UseUpdateProfileReturn {
  /**
   * Function to update the user profile
   * @param data - Profile data to update (partial update supported)
   */
  updateProfile: (data: UpdateProfilePayload) => Promise<User>;

  /**
   * Whether the profile update is in progress
   */
  isUpdating: boolean;

  /**
   * Whether the last update was successful
   */
  isSuccess: boolean;

  /**
   * Whether an error occurred during the last update
   */
  isError: boolean;

  /**
   * Error object if an error occurred, null otherwise
   */
  error: ApiError | null;

  /**
   * Function to reset the mutation state
   */
  reset: () => void;
}

/**
 * Context for optimistic update rollback
 * @internal
 */
interface UpdateProfileContext {
  previousProfile: User | undefined;
  userId: number;
}

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query key factory for profile-related queries
 * Provides consistent cache key generation for React Query
 * @internal
 */
const profileKeys = {
  /**
   * Base key for all profile queries
   */
  all: ['users'] as const,

  /**
   * Key for a specific user's profile
   * @param userId - User ID
   */
  detail: (userId: number) => [...profileKeys.all, userId, 'profile'] as const,

  /**
   * Key for user preferences
   * @param userId - User ID
   */
  preferences: (userId: number) => [...profileKeys.all, userId, 'preferences'] as const,
} as const;

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default stale time for profile data (5 minutes)
 * Profile data doesn't change frequently, so we can cache it longer
 */
const DEFAULT_STALE_TIME = 5 * 60 * 1000;

/**
 * Default garbage collection time for profile cache (30 minutes)
 */
const DEFAULT_GC_TIME = 30 * 60 * 1000;

/**
 * Default retry count for failed queries
 */
const DEFAULT_RETRY_COUNT = 3;

// ============================================================================
// useProfile Hook
// ============================================================================

/**
 * Hook for fetching user profile data
 * 
 * Uses React Query for efficient server state management with automatic caching,
 * background refetching, and cache invalidation. Wraps the existing Moodle
 * user_get_user_details() function via the API layer.
 * 
 * Features:
 * - Automatic caching with configurable stale time
 * - Background refetching for fresh data
 * - Retry logic with exponential backoff for network errors
 * - Deduplication of simultaneous requests
 * - Query cancellation to prevent memory leaks
 * - Permission checks handled by backend
 * 
 * @param options - Configuration options for the hook
 * @returns Profile data and query state
 * 
 * @example
 * ```tsx
 * // Fetch current user's profile
 * function MyProfile() {
 *   const { user, isLoading, isError, error, refetch } = useProfile();
 * 
 *   if (isLoading) return <LoadingSpinner />;
 *   if (isError) return <ErrorMessage error={error} />;
 *   if (!user) return <NotFound />;
 * 
 *   return (
 *     <div>
 *       <h1>{user.fullname}</h1>
 *       <p>{user.email}</p>
 *       <button onClick={() => refetch()}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // Fetch a specific user's profile
 * function UserProfile({ userId }: { userId: number }) {
 *   const { user, isLoading, isError, error } = useProfile({ userId });
 * 
 *   if (isLoading) return <LoadingSpinner />;
 *   if (isError) return <ErrorMessage error={error} />;
 * 
 *   return <ProfileCard user={user} />;
 * }
 * ```
 */
export function useProfile(options: UseProfileOptions = {}): UseProfileReturn {
  // Get current authenticated user from auth context
  const { user: currentUser } = useAuth();

  // Determine target user ID (from options or current user)
  const targetUserId = options.userId ?? currentUser?.id;

  // Destructure options with defaults
  const {
    enabled = true,
    refetchInterval = false,
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_GC_TIME,
  } = options;

  // Execute profile query
  const query = useQuery<User, ApiError>({
    // Query key for cache management
    queryKey: profileKeys.detail(targetUserId ?? 0),

    // Query function: calls API which wraps user_get_user_details()
    queryFn: async () => {
      if (!targetUserId) {
        throw new Error('User ID is required to fetch profile') as unknown as ApiError;
      }
      return getUserProfile(targetUserId);
    },

    // Enable query only when userId exists and enabled option is true
    enabled: enabled && targetUserId !== undefined && targetUserId > 0,

    // Cache configuration
    staleTime,
    gcTime,

    // Refetch configuration
    refetchOnWindowFocus: true,
    refetchInterval,

    // Retry configuration with exponential backoff
    retry: DEFAULT_RETRY_COUNT,
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000),
  });

  // Return structured result matching UseProfileReturn interface
  return {
    user: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

// ============================================================================
// useUpdateProfile Hook
// ============================================================================

/**
 * Hook for updating user profile data
 * 
 * Uses React Query mutation with optimistic updates and automatic cache invalidation.
 * Provides robust error handling with rollback on failure and retry with exponential
 * backoff. Wraps the existing Moodle user_update_user() function via the API layer.
 * 
 * Features:
 * - Optimistic updates: UI reflects changes immediately before server confirmation
 * - Automatic rollback: Restores previous cached data if mutation fails
 * - Cache invalidation: Refetches affected queries after successful update
 * - Support for partial updates (only changed fields sent to API)
 * - Permission checks handled by backend via require_capability()
 * 
 * Supported Profile Fields:
 * - firstname, lastname (name fields)
 * - email, maildisplay (email settings)
 * - description, descriptionformat (about me)
 * - city, country, timezone (location)
 * - interests (tags/interests)
 * - department, institution (organization)
 * - phone1, phone2 (contact numbers)
 * - url (website)
 * - imagealt, picture (avatar settings)
 * 
 * @param options - Configuration options for the mutation
 * @returns Mutation function and state
 * 
 * @example
 * ```tsx
 * function ProfileEditForm({ userId }: { userId: number }) {
 *   const { updateProfile, isUpdating, isError, error, reset } = useUpdateProfile({
 *     userId,
 *     onSuccess: (data) => {
 *       toast.success('Profile updated successfully');
 *     },
 *     onError: (error) => {
 *       toast.error(`Failed to update: ${error.message}`);
 *     },
 *   });
 * 
 *   const handleSubmit = async (formData: UpdateProfilePayload) => {
 *     try {
 *       await updateProfile(formData);
 *     } catch (err) {
 *       // Error handled by onError callback
 *     }
 *   };
 * 
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input name="firstname" />
 *       <input name="lastname" />
 *       <textarea name="description" />
 *       <button type="submit" disabled={isUpdating}>
 *         {isUpdating ? 'Saving...' : 'Save Changes'}
 *       </button>
 *       {isError && <p className="error">{error?.message}</p>}
 *     </form>
 *   );
 * }
 * ```
 */
export function useUpdateProfile(
  options: UseUpdateProfileOptions = {}
): UseUpdateProfileReturn {
  // Get current authenticated user from auth context
  const { user: currentUser } = useAuth();

  // Get query client for cache management
  const queryClient = useQueryClient();

  // Determine target user ID (from options or current user)
  const targetUserId = options.userId ?? currentUser?.id;

  // Destructure options
  const { onSuccess, onError, onSettled } = options;

  // Create mutation using React Query
  const mutation = useMutation<User, ApiError, UpdateProfilePayload, UpdateProfileContext>({
    // Mutation function: calls API which wraps user_update_user()
    mutationFn: async (data: UpdateProfilePayload) => {
      if (!targetUserId) {
        throw new Error('User ID is required to update profile') as unknown as ApiError;
      }
      return updateUserProfile(targetUserId, data);
    },

    // Optimistic update: immediately update cache with new data
    onMutate: async (variables: UpdateProfilePayload) => {
      if (!targetUserId) {
        return { previousProfile: undefined, userId: 0 };
      }

      const queryKey = profileKeys.detail(targetUserId);

      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value for rollback
      const previousProfile = queryClient.getQueryData<User>(queryKey);

      // Optimistically update to new value
      if (previousProfile) {
        queryClient.setQueryData<User>(queryKey, (old) => {
          if (!old) return old;

          // Merge update payload with existing data
          const updatedProfile: User = {
            ...old,
            ...variables,
            // Handle interests array
            interests: variables.interests !== undefined
              ? Array.isArray(variables.interests)
                ? variables.interests
                : variables.interests.split(',').map((s) => s.trim()).filter(Boolean)
              : old.interests,
            // Update computed fullname if name fields changed
            fullname: (variables.firstname ?? old.firstname) + ' ' + (variables.lastname ?? old.lastname),
            // Optimistically update modification time
            timemodified: Math.floor(Date.now() / 1000),
          };

          return updatedProfile;
        });
      }

      // Return context for rollback
      return { previousProfile, userId: targetUserId };
    },

    // Rollback optimistic update on error
    onError: (error: ApiError, _variables: UpdateProfilePayload, context?: UpdateProfileContext) => {
      // Rollback to previous profile data
      if (context?.previousProfile && context?.userId) {
        const queryKey = profileKeys.detail(context.userId);
        queryClient.setQueryData(queryKey, context.previousProfile);
      }

      // Call user-provided error handler
      if (onError) {
        onError(error);
      }
    },

    // Invalidate and refetch affected queries on success
    onSuccess: (data: User) => {
      if (targetUserId) {
        // Invalidate the specific user profile query to trigger refetch
        void queryClient.invalidateQueries({
          queryKey: profileKeys.detail(targetUserId),
          exact: true,
        });

        // If updating current user, also invalidate preferences
        if (currentUser?.id === targetUserId) {
          void queryClient.invalidateQueries({
            queryKey: profileKeys.preferences(targetUserId),
            exact: true,
          });
        }
      }

      // Call user-provided success handler
      if (onSuccess) {
        onSuccess(data);
      }
    },

    // Always refetch on settled to ensure consistency
    onSettled: () => {
      if (targetUserId) {
        // Refetch profile query to ensure consistency
        void queryClient.invalidateQueries({
          queryKey: profileKeys.detail(targetUserId),
        });
      }

      // Call user-provided settled handler
      if (onSettled) {
        onSettled();
      }
    },

    // Retry configuration for transient failures
    retry: DEFAULT_RETRY_COUNT,
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000),
  });

  // Return structured result matching UseUpdateProfileReturn interface
  return {
    updateProfile: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error ?? null,
    reset: mutation.reset,
  };
}
