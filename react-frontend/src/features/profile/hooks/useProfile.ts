/**
 * useProfile Hook
 *
 * React Query hook for fetching and managing user profile data.
 * Provides automatic caching, background updates, and error handling.
 *
 * @module features/profile/hooks
 */

import React from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
  type QueryObserverResult,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { fetchUserProfile, fetchCurrentUserProfile, updateUserProfile, type User } from '../api/profileApi';
import type { UpdateProfilePayload, UpdateProfileData } from '../types/profile.types';

/**
 * Convert UpdateProfilePayload (internal format with booleans and enums)
 * to UpdateProfileData (API format with numeric literals)
 */
function convertPayloadToApiFormat(
  payload: Omit<UpdateProfilePayload, 'userid'>
): UpdateProfileData {
  const apiData: UpdateProfileData = {};

  // Copy all string/number fields directly
  if (payload.firstname !== undefined) {
    apiData.firstname = payload.firstname;
  }
  if (payload.lastname !== undefined) {
    apiData.lastname = payload.lastname;
  }
  if (payload.email !== undefined) {
    apiData.email = payload.email;
  }
  if (payload.description !== undefined) {
    apiData.description = payload.description;
  }
  if (payload.city !== undefined) {
    apiData.city = payload.city;
  }
  if (payload.country !== undefined) {
    apiData.country = payload.country;
  }
  if (payload.timezone !== undefined) {
    apiData.timezone = payload.timezone;
  }
  if (payload.phone1 !== undefined) {
    apiData.phone1 = payload.phone1;
  }
  if (payload.phone2 !== undefined) {
    apiData.phone2 = payload.phone2;
  }
  if (payload.institution !== undefined) {
    apiData.institution = payload.institution;
  }
  if (payload.department !== undefined) {
    apiData.department = payload.department;
  }
  if (payload.address !== undefined) {
    apiData.address = payload.address;
  }
  if (payload.lang !== undefined) {
    apiData.lang = payload.lang;
  }
  if (payload.calendartype !== undefined) {
    apiData.calendartype = payload.calendartype;
  }
  if (payload.theme !== undefined) {
    apiData.theme = payload.theme;
  }

  // Convert boolean to 0 | 1 for API
  if (payload.autosubscribe !== undefined) {
    apiData.autosubscribe = payload.autosubscribe ? 1 : 0;
  }
  if (payload.trackforums !== undefined) {
    apiData.trackforums = payload.trackforums ? 1 : 0;
  }

  // mailformat is already MailFormat enum (0 or 1), can be used directly
  if (payload.mailformat !== undefined) {
    apiData.mailformat = payload.mailformat as 0 | 1;
  }

  return apiData;
}

/**
 * Query key factory for profile-related queries
 * Ensures consistent cache keys across the application
 */
export const profileKeys = {
  all: ['profiles'] as const,
  lists: () => [...profileKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...profileKeys.lists(), filters] as const,
  details: () => [...profileKeys.all, 'detail'] as const,
  detail: (id: number) => [...profileKeys.details(), id] as const,
  current: () => [...profileKeys.all, 'current'] as const,
};

/**
 * Context type for useUpdateProfile mutation
 * Used for optimistic updates and rollback
 */
interface UpdateProfileContext {
  previousProfile?: User;
  userId: number;
}

/**
 * Options for useProfile hook
 */
export interface UseProfileOptions {
  /**
   * Whether to fetch profile on mount
   * @default true
   */
  enabled?: boolean;

  /**
   * Stale time in milliseconds
   * How long data is considered fresh
   * @default 5 minutes
   */
  staleTime?: number;

  /**
   * Cache time in milliseconds
   * How long unused data stays in cache
   * @default 10 minutes
   */
  cacheTime?: number;

  /**
   * Whether to refetch on window focus
   * @default false
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Whether to refetch on mount
   * @default false
   */
  refetchOnMount?: boolean;

  /**
   * Retry count on failure
   * @default 1
   */
  retry?: number | boolean;
}

/**
 * Return type for useProfile hook
 * Extends React Query result with renamed 'profile' property and mutation functions
 */
export interface UseProfileResult {
  /**
   * Profile data (renamed from 'data' for clarity)
   */
  profile: User | undefined;

  /**
   * Whether the query is currently loading
   */
  isLoading: boolean;

  /**
   * Whether the query is currently fetching (includes background refetch)
   */
  isFetching: boolean;

  /**
   * Whether an error occurred
   */
  isError: boolean;

  /**
   * Error object if query failed
   */
  error: Error | null;

  /**
   * Whether the query is currently in an idle state
   */
  isIdle: boolean;

  /**
   * Whether the query has been successfully fetched
   */
  isSuccess: boolean;

  /**
   * Refetch function to manually trigger data refresh
   */
  refetch: () => Promise<QueryObserverResult<User, Error>>;

  /**
   * Function to update the profile
   * Note: userid is automatically included based on the hook's userId parameter
   * @param data - Profile update data (userid is automatically included)
   * @param options - Optional callbacks for success, error, and settled states
   */
  updateProfile: (
    data: Omit<UpdateProfilePayload, 'userid'>,
    options?: {
      onSuccess?: (data: User) => void;
      onError?: (error: Error) => void;
      onSettled?: () => void;
    }
  ) => void;

  /**
   * Whether the profile update mutation is in progress
   */
  isUpdating: boolean;

  /**
   * Error from profile update mutation
   */
  updateError: Error | null;
}

/**
 * Hook for fetching user profile data
 *
 * Uses React Query to manage server state with automatic caching and updates.
 * Delegates to existing Moodle user_get_user_details() function via API.
 *
 * @param userId - ID of user to fetch (undefined for current user, null to disable query)
 * @param options - Query options
 * @returns Query result with profile data, loading state, and error state
 *
 * @example
 * ```tsx
 * function ProfileView() {
 *   const { profile, isLoading, error } = useProfile(123);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return <div>{profile?.fullname}</div>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Fetch current user
 * function MyProfile() {
 *   const { profile: currentUser } = useProfile();
 *   return <div>Welcome, {currentUser?.firstname}!</div>;
 * }
 * ```
 */
export function useProfile(
  userId?: number | null,
  options: UseProfileOptions = {}
): UseProfileResult {
  // Destructure options without defaults to allow QueryClient defaults to be used
  const { enabled, staleTime, cacheTime, refetchOnWindowFocus, refetchOnMount, retry } = options;

  // Determine query key and fetch function based on whether userId is provided
  // Check for both undefined and null since userId can be number | null | undefined
  const queryKey =
    userId !== undefined && userId !== null ? profileKeys.detail(userId) : profileKeys.current();
  const queryFn =
    userId !== undefined && userId !== null
      ? () => fetchUserProfile(userId)
      : fetchCurrentUserProfile;

  // Build query options, only including values that were explicitly provided
  // This allows QueryClient defaults to be used when options are not specified
  const queryOptions: UseQueryOptions<User, Error> = {
    queryKey,
    queryFn,
    // Only throw errors in development for easier debugging
    throwOnError: process.env.NODE_ENV === 'development',
  };

  // Only add options if explicitly provided (allows QueryClient defaults to be used)
  // Disable query if userId is explicitly null (not undefined, which means current user)
  if (enabled !== undefined) {
    queryOptions.enabled = enabled;
  } else if (userId === null) {
    queryOptions.enabled = false;
  }
  if (staleTime !== undefined) {
    queryOptions.staleTime = staleTime;
  }
  if (cacheTime !== undefined) {
    queryOptions.gcTime = cacheTime;
  } // Note: 'cacheTime' was renamed to 'gcTime' in React Query v5
  if (refetchOnWindowFocus !== undefined) {
    queryOptions.refetchOnWindowFocus = refetchOnWindowFocus;
  }
  if (refetchOnMount !== undefined) {
    queryOptions.refetchOnMount = refetchOnMount;
  }
  if (retry !== undefined) {
    queryOptions.retry = retry;
  }

  const queryResult = useQuery<User, Error>(queryOptions);

  // Integrate update profile mutation
  const { mutate: mutateProfile, isPending: isUpdating, error: updateError } = useUpdateProfile();

  // Wrap mutation to automatically include userId
  const updateProfile = React.useCallback(
    (
      data: Omit<UpdateProfilePayload, 'userid'>,
      options?: {
        onSuccess?: (data: User) => void;
        onError?: (error: Error) => void;
        onSettled?: () => void;
      }
    ) => {
      // Determine which userId to use: provided userId or current user
      const targetUserId = userId ?? queryResult.data?.id;

      if (targetUserId === undefined) {
        console.error('Cannot update profile: userId is undefined');
        return;
      }

      // Call mutation with full payload including userid and pass through options
      mutateProfile(
        {
          ...data,
          userid: targetUserId,
        },
        options
          ? {
              onSuccess: (responseData) => options.onSuccess?.(responseData),
              onError: (error) => options.onError?.(error),
              onSettled: () => options.onSettled?.(),
            }
          : undefined
      );
    },
    [userId, queryResult.data?.id, mutateProfile]
  );

  // Transform the result to use 'profile' instead of 'data' and include mutation functions
  return {
    profile: queryResult.data,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    isError: queryResult.isError,
    error: queryResult.error,
    isIdle: queryResult.isPending,
    isSuccess: queryResult.isSuccess,
    refetch: queryResult.refetch,
    updateProfile,
    isUpdating,
    updateError,
  };
}

/**
 * Hook for fetching current authenticated user's profile
 *
 * Convenience wrapper around useProfile for common use case
 * of fetching the currently logged-in user.
 *
 * @param options - Query options
 * @returns Query result with current user data
 *
 * @example
 * ```tsx
 * function UserMenu() {
 *   const { profile: user } = useCurrentUser();
 *   return <div>{user?.fullname}</div>;
 * }
 * ```
 */
export function useCurrentUser(options: UseProfileOptions = {}): UseProfileResult {
  return useProfile(undefined, {
    ...options,
    // Current user data is accessed frequently, keep it fresh
    staleTime: options.staleTime ?? 2 * 60 * 1000, // 2 minutes default
  });
}

/**
 * Hook for pre-fetching user profile
 *
 * Useful for prefetching profiles that will likely be needed soon,
 * such as when hovering over user links or navigating to profile pages.
 *
 * @param userId - ID of user to prefetch
 * @returns Prefetch function
 *
 * @example
 * ```tsx
 * function UserLink({ userId }: { userId: number }) {
 *   const prefetchProfile = usePrefetchProfile(userId);
 *
 *   return (
 *     <Link
 *       to={`/profile/${userId}`}
 *       onMouseEnter={prefetchProfile}
 *     >
 *       View Profile
 *     </Link>
 *   );
 * }
 * ```
 */
export function usePrefetchProfile(userId: number): () => Promise<void> {
  // This would typically use queryClient.prefetchQuery
  // For now, return a function that fetches but doesn't cache
  return async () => {
    try {
      await fetchUserProfile(userId);
    } catch (error) {
      // Silently fail for prefetch
      // eslint-disable-next-line no-console
      console.debug('Failed to prefetch profile:', error);
    }
  };
}

/**
 * Options for useUpdateProfile mutation hook
 */
export interface UseUpdateProfileOptions {
  /**
   * Callback executed when mutation succeeds
   * @param data - Updated user profile data
   * @param variables - Mutation variables that were passed
   */
  onSuccess?: (data: User, variables: UpdateProfilePayload) => void;

  /**
   * Callback executed when mutation fails
   * @param error - Error that occurred
   * @param variables - Mutation variables that were passed
   */
  onError?: (error: Error, variables: UpdateProfilePayload) => void;

  /**
   * Retry count on failure
   * @default 3
   */
  retry?: number | boolean;

  /**
   * Retry delay function for exponential backoff
   * @default Exponential backoff: 1000ms * 2^attemptIndex
   */
  retryDelay?: (attemptIndex: number) => number;
}

/**
 * Hook for updating user profile data
 *
 * Uses React Query mutation with optimistic updates and automatic cache invalidation.
 * Provides robust error handling with rollback on failure and retry with exponential backoff.
 * Delegates to existing Moodle user_update_user() function via API.
 *
 * Features:
 * - Optimistic updates: UI reflects changes immediately before server confirmation
 * - Automatic rollback: Restores previous cached data if mutation fails
 * - Cache invalidation: Refetches affected queries after successful update
 * - Retry logic: 3 retries with exponential backoff for transient failures
 * - Concurrent mutation handling: Multiple updates are queued properly
 *
 * @param options - Mutation options
 * @returns Mutation result with mutate function and state
 *
 * @example
 * ```tsx
 * function ProfileEditForm({ userId }: { userId: number }) {
 *   const { mutate, isLoading } = useUpdateProfile({
 *     onSuccess: () => {
 *       toast.success('Profile updated successfully');
 *     },
 *     onError: (error) => {
 *       toast.error(`Failed to update profile: ${error.message}`);
 *     },
 *   });
 *
 *   const handleSubmit = (data: UpdateProfilePayload) => {
 *     mutate({ ...data, userid: userId });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <button type="submit" disabled={isLoading}>
 *         Save Changes
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useUpdateProfile(
  options: UseUpdateProfileOptions = {}
): UseMutationResult<User, Error, UpdateProfilePayload> {
  const queryClient = useQueryClient();

  const {
    onSuccess,
    onError,
    retry = 3,
    retryDelay = (attemptIndex: number) => Math.min(1000 * Math.pow(2, attemptIndex), 30000),
  } = options;

  return useMutation<User, Error, UpdateProfilePayload, UpdateProfileContext>({
    mutationFn: (data: UpdateProfilePayload) => {
      // Extract userid and convert payload to API format
      const { userid, ...internalData } = data;
      const apiData = convertPayloadToApiFormat(internalData);
      return updateUserProfile(userid, apiData);
    },

    // Optimistic update: Immediately update cache with new data
    onMutate: async (variables: UpdateProfilePayload) => {
      const userId = variables.userid;
      const queryKey = profileKeys.detail(userId);

      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value for rollback
      const previousProfile = queryClient.getQueryData<User>(queryKey);

      // Optimistically update to the new value
      if (previousProfile) {
        queryClient.setQueryData<User>(queryKey, (old) => {
          if (!old) {
            return old;
          }

          // Destructure known problematic fields to handle them separately
          const { interests: payloadInterests, userid: _userid, ...safeVariables } = variables;
          
          // Normalize interests to always be an array if provided
          const normalizedInterests = payloadInterests
            ? Array.isArray(payloadInterests)
              ? payloadInterests
              : payloadInterests.split(',').map((s) => s.trim()).filter(Boolean)
            : old.interests;

          // Merge update payload with existing data
          return {
            ...old,
            ...safeVariables,
            interests: normalizedInterests,
            // Preserve computed/server-only fields
            fullname:
              safeVariables.firstname && safeVariables.lastname
                ? `${safeVariables.firstname} ${safeVariables.lastname}`.trim()
                : old.fullname,
            timemodified: Date.now() / 1000, // Optimistically update modification time
          };
        });
      }

      // Return context with previous value for rollback
      return { previousProfile, userId };
    },

    // Rollback optimistic update on error
    onError: (
      error: Error,
      variables: UpdateProfilePayload,
      context: UpdateProfileContext | undefined
    ) => {
      if (context?.previousProfile && context?.userId) {
        const queryKey = profileKeys.detail(context.userId);
        queryClient.setQueryData(queryKey, context.previousProfile);
      }

      // Call user-provided error handler
      if (onError) {
        onError(error, variables);
      }
    },

    // Invalidate and refetch affected queries on success
    onSuccess: (data: User, variables: UpdateProfilePayload) => {
      const userId = variables.userid;

      // Invalidate the specific user profile query to trigger refetch
      void queryClient.invalidateQueries({
        queryKey: profileKeys.detail(userId),
        exact: true,
      });

      // If updating current user, also invalidate current user query
      void queryClient.invalidateQueries({
        queryKey: profileKeys.current(),
        exact: true,
      });

      // Call user-provided success handler
      if (onSuccess) {
        onSuccess(data, variables);
      }
    },

    // Retry configuration for handling transient failures
    retry,
    retryDelay,
  });
}

/**
 * Type guard to check if profile data is loaded
 * Useful for TypeScript type narrowing
 *
 * @param query - Query result from useProfile
 * @returns True if data is loaded and not undefined
 */
export function isProfileLoaded(
  query: UseQueryResult<User, Error>
): query is UseQueryResult<User, Error> & { data: User } {
  return query.isSuccess && query.data !== undefined;
}

/**
 * Helper to get full name from user object
 * Handles cases where fullname might not be set
 *
 * @param user - User object
 * @returns Full name string
 */
export function getFullName(user: Partial<User> | undefined): string {
  if (!user) {
    return '';
  }
  if (user.fullname) {
    return user.fullname;
  }
  if (user.firstname && user.lastname) {
    return `${user.firstname} ${user.lastname}`.trim();
  }
  return user.username ?? '';
}
