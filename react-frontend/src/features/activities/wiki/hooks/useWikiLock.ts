/**
 * useWikiLock Hook
 *
 * Custom React hook for managing wiki page edit locks to prevent concurrent editing conflicts.
 * Automatically acquires edit lock when component mounts, sends heartbeat pings to maintain lock,
 * handles lock conflicts when another user is editing, and releases lock on unmount or navigation.
 *
 * @package    react-frontend
 * @subpackage features/activities/wiki/hooks
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 *
 * Features:
 * - Automatic lock acquisition on component mount
 * - Periodic heartbeat to maintain active locks
 * - Lock conflict detection and user notification
 * - Lock holder information display
 * - Override capability for privileged users
 * - Automatic cleanup on unmount
 *
 * Usage:
 * ```typescript
 * // Basic usage with auto-acquire
 * const { hasLock, lockHolder, acquireLock, releaseLock } = useWikiLock({
 *   pageId: 123,
 *   autoAcquire: true
 * });
 *
 * // Section-specific lock
 * const { hasLock, lockConflict } = useWikiLock({
 *   pageId: 123,
 *   section: 'Introduction',
 *   autoAcquire: true
 * });
 *
 * // Force acquire with override permissions
 * const { forceAcquire, canOverride } = useWikiLock({ pageId: 123 });
 * if (canOverride && lockConflict) {
 *   await forceAcquire();
 * }
 * ```
 */

import { useEffect, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Information about a user holding a lock
 */
export interface LockHolder {
  /** User ID */
  id: number;
  /** Full name of the user */
  fullname: string;
  /** User email */
  email?: string;
  /** URL to user profile picture */
  profileImageUrl?: string;
  /** Timestamp when lock was acquired (ISO 8601) */
  lockedAt: string;
}

/**
 * Lock conflict information when another user holds the lock
 */
export interface LockConflict {
  /** Whether a lock conflict exists */
  exists: boolean;
  /** Information about the user holding the lock */
  holder: LockHolder | null;
  /** Message describing the conflict */
  message: string;
  /** Timestamp when the conflict was detected */
  detectedAt: string;
}

/**
 * Parameters for useWikiLock hook
 */
export interface UseWikiLockParams {
  /** Wiki page ID to manage lock for */
  pageId: number;
  /** Optional section name for section-specific locks */
  section?: string;
  /** Whether to automatically acquire lock on mount (default: true) */
  autoAcquire?: boolean;
}

/**
 * Return value from useWikiLock hook
 */
export interface UseWikiLockResult {
  /** Whether current user has the lock */
  hasLock: boolean;
  /** Information about the user currently holding the lock (null if no lock or current user has it) */
  lockHolder: LockHolder | null;
  /** Whether lock acquisition is in progress */
  isAcquiring: boolean;
  /** Whether lock release is in progress */
  isReleasing: boolean;
  /** Function to acquire page lock */
  acquireLock: () => Promise<void>;
  /** Function to release page lock */
  releaseLock: () => Promise<void>;
  /** Function to force acquire lock (override) - requires permissions */
  forceAcquire: () => Promise<void>;
  /** Whether current user can override locks */
  canOverride: boolean;
  /** Lock conflict details if another user is editing */
  lockConflict: LockConflict | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Heartbeat interval in milliseconds (30 seconds) */
const HEARTBEAT_INTERVAL = 30 * 1000;

/** Query key prefix for lock status */
const LOCK_STATUS_QUERY_KEY = 'wiki-page-lock';

// ============================================================================
// API CLIENT FUNCTIONS
// ============================================================================

/**
 * Check existing lock status for a wiki page
 */
const checkLockStatus = async (
  pageId: number
): Promise<{
  success: boolean;
  data: {
    hasLock: boolean;
    lockHolder: LockHolder | null;
    canOverride: boolean;
  };
}> => {
  const response = await apiClient.get<{
    success: boolean;
    data: {
      hasLock: boolean;
      lockHolder: LockHolder | null;
      canOverride: boolean;
    };
  }>(`/api/v1/wiki/${pageId}/lock`);
  return response.data;
};

/**
 * Acquire edit lock for a wiki page
 */
const acquireLock = async (
  pageId: number,
  section?: string,
  force: boolean = false
): Promise<{
  success: boolean;
  data?: {
    lockAcquired: boolean;
    lockHolder: LockHolder | null;
  };
  error?: {
    code: string;
    message: string;
    details?: {
      lockHolder: LockHolder;
    };
  };
}> => {
  const response = await apiClient.post<{
    success: boolean;
    data?: {
      lockAcquired: boolean;
      lockHolder: LockHolder | null;
    };
    error?: {
      code: string;
      message: string;
      details?: {
        lockHolder: LockHolder;
      };
    };
  }>(`/api/v1/wiki/${pageId}/lock`, {
    pageId,
    section: section ?? null,
    force,
  });
  return response.data;
};

/**
 * Send heartbeat to maintain active lock
 */
const sendHeartbeat = async (
  pageId: number
): Promise<{
  success: boolean;
  data?: {
    lockMaintained: boolean;
  };
}> => {
  const response = await apiClient.put<{
    success: boolean;
    data?: {
      lockMaintained: boolean;
    };
  }>(`/api/v1/wiki/${pageId}/lock/heartbeat`);
  return response.data;
};

/**
 * Release edit lock for a wiki page
 */
const releaseLock = async (
  pageId: number
): Promise<{
  success: boolean;
  data?: {
    lockReleased: boolean;
  };
}> => {
  const response = await apiClient.delete<{
    success: boolean;
    data?: {
      lockReleased: boolean;
    };
  }>(`/api/v1/wiki/${pageId}/lock`);
  return response.data;
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Custom hook for managing wiki page edit locks
 *
 * Provides comprehensive lock management including acquisition, release,
 * automatic heartbeat maintenance, lock conflict detection, and cleanup on unmount.
 * Ensures only one user can edit a page at a time while providing clear feedback
 * about lock status and conflicts.
 *
 * @param params - Hook configuration parameters
 * @returns Object with lock management functions and state
 *
 * @example
 * ```typescript
 * // Basic usage with auto-acquire
 * const { hasLock, lockHolder, acquireLock, releaseLock } = useWikiLock({
 *   pageId: 123,
 *   autoAcquire: true
 * });
 *
 * // Section-specific lock
 * const { hasLock, lockConflict } = useWikiLock({
 *   pageId: 123,
 *   section: 'Introduction',
 *   autoAcquire: true
 * });
 *
 * // With override capability
 * const { forceAcquire, canOverride, lockConflict } = useWikiLock({ pageId: 123 });
 * if (canOverride && lockConflict?.exists) {
 *   await forceAcquire();
 * }
 * ```
 */
export function useWikiLock({
  pageId,
  section,
  autoAcquire = true,
}: UseWikiLockParams): UseWikiLockResult {
  const queryClient = useQueryClient();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // ============================================================================
  // QUERY: Lock Status
  // ============================================================================

  /**
   * Query to check current lock status of the page.
   * Fetches lock information including holder details and override permissions.
   */
  const { data: lockStatusData, isLoading: isCheckingLock } = useQuery({
    queryKey: [LOCK_STATUS_QUERY_KEY, pageId],
    queryFn: () => checkLockStatus(pageId),
    staleTime: 10000, // Consider data fresh for 10 seconds
    refetchInterval: 15000, // Refetch every 15 seconds for real-time updates
    retry: 1, // Retry once on failure
    refetchOnWindowFocus: true, // Recheck when user returns to tab
  });

  // Extract lock status information
  const hasLock = lockStatusData?.data?.hasLock ?? false;
  const lockHolder = lockStatusData?.data?.lockHolder ?? null;
  const canOverride = lockStatusData?.data?.canOverride ?? false;

  // ============================================================================
  // MUTATION: Acquire Lock
  // ============================================================================

  /**
   * Mutation to acquire page edit lock.
   * Sets up automatic heartbeat on success.
   */
  const acquireLockMutation = useMutation({
    mutationFn: ({ force = false }: { force?: boolean } = {}) =>
      acquireLock(pageId, section, force),
    onSuccess: (response) => {
      if (response.success && response.data?.lockAcquired) {
        // Update lock status in cache
        queryClient.setQueryData([LOCK_STATUS_QUERY_KEY, pageId], {
          success: true,
          data: {
            hasLock: true,
            lockHolder: null, // Current user has lock, so no holder to display
            canOverride,
          },
        });

        // Start heartbeat interval to maintain lock
        startHeartbeat();

        // Invalidate queries to refresh UI
        void queryClient.invalidateQueries({ queryKey: [LOCK_STATUS_QUERY_KEY, pageId] });
      }
    },
    onError: (error: unknown) => {
      // Lock conflict - another user has the lock
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as {
          response?: {
            data?: { error?: { code?: string; details?: { lockHolder?: LockHolder } } };
          };
        };
        if (axiosError.response?.data?.error?.code === 'LOCK_CONFLICT') {
          const conflictHolder: LockHolder | undefined =
            axiosError.response.data.error.details?.lockHolder;
          if (conflictHolder) {
            // Update cache with conflict information
            queryClient.setQueryData([LOCK_STATUS_QUERY_KEY, pageId], {
              success: true,
              data: {
                hasLock: false,
                lockHolder: conflictHolder,
                canOverride,
              },
            });
          }
        }
      }
      console.error('Failed to acquire lock:', error);
    },
  });

  // ============================================================================
  // MUTATION: Release Lock
  // ============================================================================

  /**
   * Mutation to release page edit lock.
   * Clears heartbeat interval and updates cache.
   */
  const releaseLockMutation = useMutation({
    mutationFn: () => releaseLock(pageId),
    onSuccess: (response) => {
      if (response.success && response.data?.lockReleased) {
        // Stop heartbeat
        stopHeartbeat();

        // Update lock status in cache
        queryClient.setQueryData([LOCK_STATUS_QUERY_KEY, pageId], {
          success: true,
          data: {
            hasLock: false,
            lockHolder: null,
            canOverride,
          },
        });

        // Invalidate queries to refresh UI
        void queryClient.invalidateQueries({ queryKey: [LOCK_STATUS_QUERY_KEY, pageId] });
      }
    },
    onError: (error) => {
      console.error('Failed to release lock:', error);
      // Still try to stop heartbeat even on error
      stopHeartbeat();
    },
  });

  // ============================================================================
  // HEARTBEAT MANAGEMENT
  // ============================================================================

  /**
   * Stop heartbeat interval
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  /**
   * Start periodic heartbeat to maintain lock
   */
  const startHeartbeat = useCallback(() => {
    // Clear any existing interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    // Set up new heartbeat interval (every 30 seconds)
    heartbeatIntervalRef.current = setInterval(() => {
      void (async () => {
        try {
          const response = await sendHeartbeat(pageId);
          if (!response.success || !response.data?.lockMaintained) {
            // Lock was lost, stop heartbeat
            stopHeartbeat();

            // Update cache to reflect lost lock
            queryClient.setQueryData([LOCK_STATUS_QUERY_KEY, pageId], {
              success: true,
              data: {
                hasLock: false,
                lockHolder: null,
                canOverride,
              },
            });

            // Invalidate queries
            void queryClient.invalidateQueries({ queryKey: [LOCK_STATUS_QUERY_KEY, pageId] });

            console.warn('Lock heartbeat failed - lock may have been lost');
          }
        } catch (error) {
          console.error('Heartbeat error:', error);
          // On network error, let the interval continue but log the issue
          // The lock status query will detect if lock is actually lost
        }
      })();
    }, HEARTBEAT_INTERVAL);
  }, [pageId, queryClient, canOverride, stopHeartbeat]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Effect: Track component mount status
   */
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Effect: Auto-acquire lock on mount if requested and no conflict exists
   */
  useEffect(() => {
    if (autoAcquire && !hasLock && !lockHolder && !isCheckingLock) {
      // Only auto-acquire if no one else has the lock
      acquireLockMutation.mutate({ force: false });
    }
  }, [autoAcquire, hasLock, lockHolder, isCheckingLock, acquireLockMutation]);

  /**
   * Effect: Cleanup - release lock and stop heartbeat on unmount
   */
  useEffect(() => {
    return () => {
      // Stop heartbeat interval
      stopHeartbeat();

      // Release lock if we have it
      // Use the raw API call to avoid React Query issues during unmount
      if (hasLock) {
        releaseLock(pageId).catch((error) => {
          console.error('Failed to release lock on unmount:', error);
        });
      }
    };
  }, [pageId, hasLock, stopHeartbeat]);

  // ============================================================================
  // PUBLIC API FUNCTIONS
  // ============================================================================

  /**
   * Acquire page edit lock
   *
   * Attempts to obtain exclusive edit lock for the page.
   * If another user has the lock, this will fail and return lock conflict information.
   *
   * @throws Error if lock acquisition fails for reasons other than conflict
   */
  const handleAcquireLock = useCallback(async (): Promise<void> => {
    try {
      await acquireLockMutation.mutateAsync({ force: false });
    } catch (error: unknown) {
      // If it's a lock conflict, the error is already handled in onError
      // Re-throw other errors
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { error?: { code?: string } } } };
        if (axiosError.response?.data?.error?.code !== 'LOCK_CONFLICT') {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }, [acquireLockMutation]);

  /**
   * Release page edit lock
   *
   * Releases the current user's lock on the page, allowing others to edit.
   * Should be called when canceling edit or after successful save.
   * Automatically stops the heartbeat interval.
   *
   * @throws Error if lock release fails
   */
  const handleReleaseLock = useCallback(async (): Promise<void> => {
    await releaseLockMutation.mutateAsync();
  }, [releaseLockMutation]);

  /**
   * Force acquire lock (override existing lock)
   *
   * Forcefully acquires the lock even if another user has it.
   * Requires mod/wiki:overridelock capability.
   * Use with caution as it will interrupt another user's editing session.
   *
   * @throws Error if force acquire fails or user lacks permissions
   */
  const handleForceAcquire = useCallback(async (): Promise<void> => {
    if (!canOverride) {
      throw new Error('User does not have permission to override locks');
    }
    await acquireLockMutation.mutateAsync({ force: true });
  }, [acquireLockMutation, canOverride]);

  // ============================================================================
  // COMPUTED STATE
  // ============================================================================

  /**
   * Determine if there is a lock conflict
   */
  const lockConflict: LockConflict | null = lockHolder
    ? {
        exists: true,
        holder: lockHolder,
        message: `This page is currently being edited by ${lockHolder.fullname}`,
        detectedAt: new Date().toISOString(),
      }
    : null;

  const isAcquiring = acquireLockMutation.isPending;
  const isReleasing = releaseLockMutation.isPending;

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    hasLock,
    lockHolder,
    isAcquiring,
    isReleasing,
    acquireLock: handleAcquireLock,
    releaseLock: handleReleaseLock,
    forceAcquire: handleForceAcquire,
    canOverride,
    lockConflict,
  };
}
