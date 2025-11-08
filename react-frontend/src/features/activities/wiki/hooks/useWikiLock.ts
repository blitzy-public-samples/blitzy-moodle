/**
 * useWikiLock Hook
 *
 * Custom React hook for managing wiki page edit locks to prevent concurrent editing.
 * Provides functions to acquire, release, and check lock status with automatic cleanup.
 *
 * @package    react-frontend
 * @subpackage features/activities/wiki/hooks
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 *
 * Features:
 * - Acquire exclusive page edit lock
 * - Release lock on unmount or explicit call
 * - Track lock ownership status
 * - Handle lock expiration and renewal
 * - Support section-specific locks
 *
 * Usage:
 * ```typescript
 * const { acquireLock, releaseLock, hasLock, lockStatus } = useWikiLock({ pageId: 123 });
 *
 * // Acquire lock before editing
 * await acquireLock();
 *
 * // Release lock when done
 * await releaseLock();
 * ```
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acquirePageLock,
  releasePageLock,
  checkPageLockStatus,
} from '../api/wikiApi';
import type { WikiPageLock } from '../types/wiki.types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Parameters for useWikiLock hook
 */
export interface UseWikiLockParams {
  /** Wiki page ID to manage lock for */
  pageId: number;
  /** Optional section name for section-specific locks */
  section?: string;
  /** Whether to automatically acquire lock on mount (default: false) */
  autoAcquire?: boolean;
  /** Lock renewal interval in milliseconds (default: 5 minutes) */
  renewalInterval?: number;
  /** Whether to automatically release lock on unmount (default: true) */
  autoRelease?: boolean;
}

/**
 * Return value from useWikiLock hook
 */
export interface UseWikiLockResult {
  /** Function to acquire page lock */
  acquireLock: () => Promise<void>;
  /** Function to release page lock */
  releaseLock: () => Promise<void>;
  /** Whether current user has the lock */
  hasLock: boolean;
  /** Whether page is locked by anyone */
  isLocked: boolean;
  /** Current lock details if page is locked */
  lock: WikiPageLock | null;
  /** Whether lock is owned by current user */
  isOwnedByCurrentUser: boolean;
  /** Whether lock acquisition is in progress */
  isAcquiring: boolean;
  /** Whether lock release is in progress */
  isReleasing: boolean;
  /** Error from last lock operation */
  error: Error | null;
  /** Manually refresh lock status */
  refreshLockStatus: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default lock renewal interval (5 minutes) */
const DEFAULT_RENEWAL_INTERVAL = 5 * 60 * 1000;

/** Query key for lock status */
const LOCK_STATUS_QUERY_KEY = 'wiki-page-lock';

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Custom hook for managing wiki page edit locks
 *
 * Provides comprehensive lock management including acquisition, release,
 * automatic renewal, and cleanup on unmount. Ensures only one user can
 * edit a page at a time.
 *
 * @param params - Hook configuration parameters
 * @returns Object with lock management functions and state
 *
 * @example
 * ```typescript
 * // Basic usage
 * const { acquireLock, releaseLock, hasLock } = useWikiLock({ pageId: 123 });
 *
 * // With auto-acquire on mount
 * const { hasLock } = useWikiLock({
 *   pageId: 123,
 *   autoAcquire: true,
 *   autoRelease: true
 * });
 *
 * // Section-specific lock
 * const { acquireLock } = useWikiLock({
 *   pageId: 123,
 *   section: 'Introduction'
 * });
 * ```
 */
export function useWikiLock({
  pageId,
  section,
  autoAcquire = false,
  renewalInterval = DEFAULT_RENEWAL_INTERVAL,
  autoRelease = true,
}: UseWikiLockParams): UseWikiLockResult {
  const queryClient = useQueryClient();
  const renewalIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [hasLock, setHasLock] = useState(false);

  // ============================================================================
  // QUERY: Lock Status
  // ============================================================================

  /**
   * Query to check current lock status of the page.
   * Polls periodically to detect if lock is lost.
   */
  const {
    data: lockStatus,
    error: statusError,
    refetch: refreshLockStatus,
  } = useQuery({
    queryKey: [LOCK_STATUS_QUERY_KEY, pageId],
    queryFn: () => checkPageLockStatus(pageId),
    // Refetch every 30 seconds to monitor lock status
    refetchInterval: 30000,
    // Keep data fresh for 20 seconds
    staleTime: 20000,
    // Don't retry on error (likely auth or permission issue)
    retry: false,
  });

  // ============================================================================
  // MUTATION: Acquire Lock
  // ============================================================================

  /**
   * Mutation to acquire page edit lock.
   * Sets up automatic renewal interval on success.
   */
  const acquireLockMutation = useMutation({
    mutationFn: () => acquirePageLock(pageId, section),
    onSuccess: (response) => {
      if (response.success) {
        setHasLock(true);

        // Update lock status in cache
        queryClient.setQueryData([LOCK_STATUS_QUERY_KEY, pageId], {
          locked: true,
          lock: response.lock,
          ownedByCurrentUser: true,
        });

        // Set up automatic lock renewal
        if (renewalInterval > 0) {
          renewalIntervalRef.current = setInterval(() => {
            // Renew lock by acquiring again
            acquirePageLock(pageId, section).catch((error) => {
              console.error('Failed to renew lock:', error);
              setHasLock(false);
              if (renewalIntervalRef.current) {
                clearInterval(renewalIntervalRef.current);
              }
            });
          }, renewalInterval);
        }
      }
    },
    onError: (error) => {
      console.error('Failed to acquire lock:', error);
      setHasLock(false);
    },
  });

  // ============================================================================
  // MUTATION: Release Lock
  // ============================================================================

  /**
   * Mutation to release page edit lock.
   * Clears renewal interval and updates cache.
   */
  const releaseLockMutation = useMutation({
    mutationFn: () => releasePageLock(pageId),
    onSuccess: (response) => {
      if (response.success) {
        setHasLock(false);

        // Clear renewal interval
        if (renewalIntervalRef.current) {
          clearInterval(renewalIntervalRef.current);
          renewalIntervalRef.current = null;
        }

        // Update lock status in cache
        queryClient.setQueryData([LOCK_STATUS_QUERY_KEY, pageId], {
          locked: false,
          lock: null,
          ownedByCurrentUser: false,
        });
      }
    },
    onError: (error) => {
      console.error('Failed to release lock:', error);
    },
  });

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Effect: Auto-acquire lock on mount if requested
   */
  useEffect(() => {
    if (autoAcquire && !hasLock) {
      acquireLockMutation.mutate();
    }
  }, [autoAcquire]); // Only run on mount

  /**
   * Effect: Auto-release lock on unmount
   */
  useEffect(() => {
    return () => {
      // Clear renewal interval
      if (renewalIntervalRef.current) {
        clearInterval(renewalIntervalRef.current);
      }

      // Release lock if we have it and auto-release is enabled
      if (hasLock && autoRelease) {
        releasePageLock(pageId).catch((error) => {
          console.error('Failed to release lock on unmount:', error);
        });
      }
    };
  }, [pageId, hasLock, autoRelease]);

  // ============================================================================
  // PUBLIC API FUNCTIONS
  // ============================================================================

  /**
   * Acquire page edit lock
   *
   * Attempts to obtain exclusive edit lock for the page.
   * Throws error if page is already locked by another user.
   *
   * @throws Error if lock acquisition fails
   */
  const acquireLock = async (): Promise<void> => {
    await acquireLockMutation.mutateAsync();
  };

  /**
   * Release page edit lock
   *
   * Releases the current user's lock on the page, allowing others to edit.
   * Should be called when canceling edit or after successful save.
   *
   * @throws Error if lock release fails
   */
  const releaseLock = async (): Promise<void> => {
    await releaseLockMutation.mutateAsync();
  };

  // ============================================================================
  // COMPUTED STATE
  // ============================================================================

  const isLocked = lockStatus?.locked ?? false;
  const lock = lockStatus?.lock ?? null;
  const isOwnedByCurrentUser = lockStatus?.ownedByCurrentUser ?? false;
  const isAcquiring = acquireLockMutation.isPending;
  const isReleasing = releaseLockMutation.isPending;
  const error =
    (acquireLockMutation.error as Error | null) ||
    (releaseLockMutation.error as Error | null) ||
    (statusError as Error | null);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    acquireLock,
    releaseLock,
    hasLock,
    isLocked,
    lock,
    isOwnedByCurrentUser,
    isAcquiring,
    isReleasing,
    error,
    refreshLockStatus,
  };
}
