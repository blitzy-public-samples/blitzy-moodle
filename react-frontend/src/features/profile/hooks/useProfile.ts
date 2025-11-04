/**
 * useProfile Hook
 * 
 * React Query hook for fetching and managing user profile data.
 * Provides automatic caching, background updates, and error handling.
 * 
 * @module features/profile/hooks
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchUserProfile, fetchCurrentUserProfile } from '../api/profileApi';
import type { User } from '../types/profile.types';

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
 * Hook for fetching user profile data
 * 
 * Uses React Query to manage server state with automatic caching and updates.
 * Delegates to existing Moodle user_get_user_details() function via API.
 * 
 * @param userId - ID of user to fetch (undefined for current user)
 * @param options - Query options
 * @returns Query result with profile data, loading state, and error state
 * 
 * @example
 * ```tsx
 * function ProfileView() {
 *   const { data: user, isLoading, error } = useProfile(123);
 *   
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   
 *   return <div>{user.fullname}</div>;
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // Fetch current user
 * function MyProfile() {
 *   const { data: currentUser } = useProfile();
 *   return <div>Welcome, {currentUser?.firstname}!</div>;
 * }
 * ```
 */
export function useProfile(
  userId?: number,
  options: UseProfileOptions = {}
): UseQueryResult<User, Error> {
  const {
    enabled = true,
    staleTime = 5 * 60 * 1000, // 5 minutes
    cacheTime = 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus = false,
    refetchOnMount = false,
    retry = 1,
  } = options;

  // Determine query key and fetch function based on whether userId is provided
  const queryKey = userId !== undefined ? profileKeys.detail(userId) : profileKeys.current();
  const queryFn = userId !== undefined 
    ? () => fetchUserProfile(userId) 
    : fetchCurrentUserProfile;

  return useQuery<User, Error>({
    queryKey,
    queryFn,
    enabled,
    staleTime,
    gcTime: cacheTime, // Note: 'cacheTime' was renamed to 'gcTime' in React Query v5
    refetchOnWindowFocus,
    refetchOnMount,
    retry,
    // Only throw errors in development for easier debugging
    throwOnError: process.env.NODE_ENV === 'development',
  });
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
 *   const { data: user } = useCurrentUser();
 *   return <div>{user?.fullname}</div>;
 * }
 * ```
 */
export function useCurrentUser(options: UseProfileOptions = {}): UseQueryResult<User, Error> {
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
