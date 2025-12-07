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
import type { QueryObserverResult } from '@tanstack/react-query';

// Internal imports from profile API
import {
  getUserProfile,
  updateUserProfile,
} from '../api/profileApi';

// Internal imports from types
import type { UpdateProfilePayload, UpdateProfileData } from '../types/profile.types';
import type { User } from '@/types/entities';
import type { ApiError } from '@/types/errors';

// Internal imports from auth
import { useAuth } from '@/features/auth/hooks/useAuth';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Input type for profile update operations (consumer-friendly)
 * Excludes userid as the hook provides it automatically based on context
 * This allows callers to simply pass the fields they want to update
 */
export type UpdateProfileInput = Omit<UpdateProfilePayload, 'userid'>;

/**
 * Options for the useProfile hook
 */
export interface UseProfileOptions {
  /**
   * User ID to fetch profile for
   * If not provided (undefined), defaults to the current authenticated user
   * If explicitly set to null, the query will be disabled
   */
  userId?: number | null;

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
  profile: User | undefined;

  /**
   * @deprecated Use `profile` instead. Alias for backward compatibility.
   */
  user: User | undefined;

  /**
   * Whether the profile is currently being loaded
   */
  isLoading: boolean;

  /**
   * Whether a background refetch is in progress
   */
  isFetching: boolean;

  /**
   * Whether the query is in idle state (not yet triggered)
   */
  isIdle: boolean;

  /**
   * Whether the query was successful and data is available
   */
  isSuccess: boolean;

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

  /**
   * Whether profile update is in progress (for combined hook usage)
   */
  isUpdating: boolean;

  /**
   * Error from profile update operation, null otherwise
   */
  updateError: ApiError | null;

  /**
   * Function to update the user profile (for combined hook usage)
   * @param data - Profile data to update (partial update supported)
   * userid is added automatically by the hook based on context
   */
  updateProfile: (data: UpdateProfileInput) => Promise<User>;
}

/**
 * Type alias for backward compatibility
 * @deprecated Use UseProfileReturn instead
 */
export type UseProfileResult = UseProfileReturn;

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
   * userid is added automatically by the hook based on context
   */
  updateProfile: (data: UpdateProfileInput) => Promise<User>;

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
 */
export const profileKeys = {
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

  /**
   * Key for current user's profile (used when user ID is not yet known)
   * Returns a general key pattern for current user queries
   */
  current: () => ['users', 'current', 'profile'] as const,
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
 * @param userIdOrOptions - User ID (number/null) or configuration options for the hook
 * @returns Profile data, query state, and update mutation
 * 
 * @example
 * ```tsx
 * // Fetch current user's profile
 * function MyProfile() {
 *   const { profile, isLoading, isError, error, refetch } = useProfile();
 * 
 *   if (isLoading) return <LoadingSpinner />;
 *   if (isError) return <ErrorMessage error={error} />;
 *   if (!profile) return <NotFound />;
 * 
 *   return (
 *     <div>
 *       <h1>{profile.fullname}</h1>
 *       <p>{profile.email}</p>
 *       <button onClick={() => refetch()}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // Fetch a specific user's profile by ID
 * function UserProfile({ userId }: { userId: number }) {
 *   const { profile, isLoading, isError, error, updateProfile, isUpdating } = useProfile(userId);
 * 
 *   if (isLoading) return <LoadingSpinner />;
 *   if (isError) return <ErrorMessage error={error} />;
 * 
 *   return <ProfileCard profile={profile} onSave={updateProfile} saving={isUpdating} />;
 * }
 * ```
 */
export function useProfile(userIdOrOptions?: number | null | UseProfileOptions): UseProfileReturn {
  // Get current authenticated user from auth context
  const { user: currentUser } = useAuth();

  // Get query client for cache management (used by update mutation)
  const queryClient = useQueryClient();

  // Normalize argument: support both useProfile(123) and useProfile({ userId: 123 })
  // Note: null means "explicitly no user" (disable query), undefined means "use current user"
  // When called as useProfile(null), we need to preserve null as explicit "no user"
  const isOptionsObject = typeof userIdOrOptions === 'object' && userIdOrOptions !== null;
  const hasExplicitNullArg = userIdOrOptions === null;
  
  const options: UseProfileOptions = isOptionsObject
    ? userIdOrOptions
    : { userId: hasExplicitNullArg ? null : userIdOrOptions };

  // Determine target user ID (from options or current user)
  // If userId is explicitly null, don't fall back to currentUser (query will be disabled)
  // If userId is undefined, fall back to currentUser
  const hasExplicitUserId = hasExplicitNullArg || ('userId' in options && options.userId !== undefined);
  const targetUserId = hasExplicitUserId
    ? options.userId // Use explicitly provided userId (may be null)
    : currentUser?.id; // Fall back to current user only when userId not provided

  // Destructure options with defaults
  const {
    enabled = true,
    refetchInterval = false,
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_GC_TIME,
  } = options;

  // Determine if query should be enabled
  const isQueryEnabled = enabled && targetUserId !== undefined && targetUserId !== null && targetUserId > 0;

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
    enabled: isQueryEnabled,

    // Cache configuration
    staleTime,
    gcTime,

    // Refetch configuration
    refetchOnWindowFocus: true,
    refetchInterval,

    // Note: Retry configuration uses QueryClient defaults (typically retry: 3)
    // This allows tests and consumers to customize retry behavior
    // If specific retry behavior is needed, pass it via QueryClient options
  });

  // Update mutation for integrated profile editing
  const updateMutation = useMutation<User, ApiError, UpdateProfileInput, UpdateProfileContext>({
    // Mutation function: calls API which wraps user_update_user()
    mutationFn: async (data: UpdateProfileInput) => {
      if (!targetUserId) {
        throw new Error('User ID is required to update profile') as unknown as ApiError;
      }
      // Convert UpdateProfileInput (with booleans) to UpdateProfileData (with 0/1)
      // Note: userid is added by the hook, not provided by caller
      const apiData = convertPayloadToApiData({ ...data, userid: targetUserId });
      return updateUserProfile(targetUserId, apiData);
    },

    // Optimistic update: immediately update cache with new data
    onMutate: async (variables: UpdateProfileInput) => {
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
            firstname: variables.firstname ?? old.firstname,
            lastname: variables.lastname ?? old.lastname,
            email: variables.email ?? old.email,
            description: variables.description ?? old.description,
            city: variables.city ?? old.city,
            country: variables.country ?? old.country,
            timezone: variables.timezone ?? old.timezone,
            // Handle interests array
            interests: variables.interests !== undefined
              ? Array.isArray(variables.interests)
                ? variables.interests
                : variables.interests.split(',').map((s: string) => s.trim()).filter(Boolean)
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
    onError: (_error: ApiError, _variables: UpdateProfileInput, context?: UpdateProfileContext) => {
      // Rollback to previous profile data
      if (context?.previousProfile && context?.userId) {
        const queryKey = profileKeys.detail(context.userId);
        queryClient.setQueryData(queryKey, context.previousProfile);
      }
    },

    // Update cache and invalidate on success
    onSuccess: (data: User) => {
      if (targetUserId) {
        // Update cache with the server response (replaces optimistic data with real data)
        queryClient.setQueryData(profileKeys.detail(targetUserId), data);

        // Invalidate the specific user profile query to trigger background refetch
        // This ensures data stays fresh and consistent with server state
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
    },

    // onSettled: Called after success or error
    // Note: We don't invalidate here since onSuccess already handles it
    // This prevents duplicate refetches
    onSettled: () => {
      // Intentionally empty - cache management handled in onSuccess/onError
    },

    // Note: Retry configuration uses QueryClient defaults
    // This allows tests and consumers to customize retry behavior
  });

  // Return structured result matching UseProfileReturn interface
  return {
    profile: query.data,
    user: query.data, // Alias for backward compatibility
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isIdle: !query.isFetching && !query.isLoading && !query.data,
    isSuccess: query.isSuccess,
    isError: query.isError,
    error: query.error ?? null,
    refetch: query.refetch,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error ?? null,
    updateProfile: updateMutation.mutateAsync,
  };
}

/**
 * Helper function to convert UpdateProfilePayload (with boolean values) to 
 * UpdateProfileData format (with 0/1 numeric literals) for the API
 * 
 * @param payload - The profile update payload from the component
 * @returns The converted data in API format
 */
function convertPayloadToApiData(payload: UpdateProfilePayload): UpdateProfileData {
  const apiData: UpdateProfileData = {};

  // Copy string fields directly
  if (payload.firstname !== undefined) apiData.firstname = payload.firstname;
  if (payload.lastname !== undefined) apiData.lastname = payload.lastname;
  if (payload.email !== undefined) apiData.email = payload.email;
  if (payload.description !== undefined) apiData.description = payload.description;
  if (payload.city !== undefined) apiData.city = payload.city;
  if (payload.country !== undefined) apiData.country = payload.country;
  if (payload.timezone !== undefined) apiData.timezone = payload.timezone;
  if (payload.phone1 !== undefined) apiData.phone1 = payload.phone1;
  if (payload.phone2 !== undefined) apiData.phone2 = payload.phone2;
  if (payload.institution !== undefined) apiData.institution = payload.institution;
  if (payload.department !== undefined) apiData.department = payload.department;
  if (payload.address !== undefined) apiData.address = payload.address;
  if (payload.lang !== undefined) apiData.lang = payload.lang;
  if (payload.calendartype !== undefined) apiData.calendartype = payload.calendartype;
  if (payload.theme !== undefined) apiData.theme = payload.theme;

  // Convert boolean to 0 | 1 for API
  if (payload.autosubscribe !== undefined) {
    apiData.autosubscribe = payload.autosubscribe ? 1 : 0;
  }
  if (payload.trackforums !== undefined) {
    apiData.trackforums = payload.trackforums ? 1 : 0;
  }

  // mailformat is already numeric, can be used directly
  if (payload.mailformat !== undefined) {
    apiData.mailformat = payload.mailformat as 0 | 1;
  }

  return apiData;
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
  const mutation = useMutation<User, ApiError, UpdateProfileInput, UpdateProfileContext>({
    // Mutation function: calls API which wraps user_update_user()
    mutationFn: async (data: UpdateProfileInput) => {
      if (!targetUserId) {
        throw new Error('User ID is required to update profile') as unknown as ApiError;
      }
      // Convert UpdateProfileInput (with booleans) to UpdateProfileData (with 0/1)
      // Note: userid is added by the hook, not provided by caller
      const apiData = convertPayloadToApiData({ ...data, userid: targetUserId });
      return updateUserProfile(targetUserId, apiData);
    },

    // Optimistic update: immediately update cache with new data
    onMutate: async (variables: UpdateProfileInput) => {
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
    onError: (error: ApiError, _variables: UpdateProfileInput, context?: UpdateProfileContext) => {
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

// ============================================================================
// useCurrentUser Hook
// ============================================================================

/**
 * Convenience hook for fetching the current authenticated user's profile
 * 
 * This is a shorthand for useProfile() without any arguments, which defaults
 * to fetching the current user's profile from the auth context.
 * 
 * @returns Profile data and query state for the current authenticated user
 * 
 * @example
 * ```tsx
 * function CurrentUserProfile() {
 *   const { profile, isLoading, isError, error } = useCurrentUser();
 * 
 *   if (isLoading) return <LoadingSpinner />;
 *   if (isError) return <ErrorMessage error={error} />;
 *   if (!profile) return <p>Not logged in</p>;
 * 
 *   return (
 *     <div>
 *       <h1>Welcome, {profile.fullname}</h1>
 *       <Avatar src={profile.profileimageurl} alt={profile.fullname} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useCurrentUser(): UseProfileReturn {
  // Delegate to useProfile with no userId, which will use current user from auth context
  return useProfile();
}
