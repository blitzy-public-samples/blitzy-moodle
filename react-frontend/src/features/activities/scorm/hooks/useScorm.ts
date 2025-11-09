/**
 * SCORM Package State Management Hook
 *
 * Custom React Query hook for managing SCORM (Sharable Content Object Reference Model)
 * package state and data fetching. Provides comprehensive access to SCORM package details,
 * SCO structure, user attempts, and tracking data.
 *
 * Features:
 * - Fetches SCORM package configuration and metadata
 * - Retrieves hierarchical SCO (Shareable Content Objects) structure
 * - Manages user attempt history and status
 * - Accesses user tracking data (CMI elements) for attempts
 * - Implements efficient caching with stale-while-revalidate strategy
 * - Supports both SCORM 1.2 and SCORM 2004 standards
 * - Provides unified loading and error states
 * - Enables cache invalidation and refetching
 *
 * Maps to backend API endpoints that wrap existing Moodle SCORM functions:
 * - GET /api/v1/scorm/{id} - scorm_get_scorm() from lib.php
 * - GET /api/v1/scorm/{id}/scos - scorm_get_scoes() from locallib.php
 * - GET /api/v1/scorm/{id}/attempts - scorm_get_all_attempts() from locallib.php
 *
 * @module features/activities/scorm/hooks/useScorm
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ScormAttempt } from '../types/scorm.types';
import {
  fetchScorm,
  fetchScormScos,
  fetchAttempts,
} from '../api/scormApi';
import type { Scorm, ScormSco } from '../types/scorm.types';

// ============================================================================
// QUERY KEY FACTORY
// ============================================================================

/**
 * Query key factory for SCORM-related queries
 *
 * Provides consistent cache key generation for all SCORM queries.
 * Supports hierarchical cache invalidation and granular cache management.
 *
 * Structure:
 * - ['scorm'] - Root key for all SCORM queries
 * - ['scorm', 'detail', id] - Specific SCORM package details
 * - ['scorm', 'scoes', id] - SCO structure for package
 * - ['scorm', 'attempts', id] - User attempts for package
 * - ['scorm', 'userData', id, attemptNumber] - Tracking data for specific attempt
 */
export const scormQueryKeys = {
  /**
   * Root key for all SCORM queries
   * Use for invalidating all SCORM-related cache
   */
  all: ['scorm'] as const,

  /**
   * Key for SCORM package details query
   * @param id - SCORM module ID
   */
  detail: (id: number) => [...scormQueryKeys.all, 'detail', id] as const,

  /**
   * Key for SCOs (Shareable Content Objects) query
   * @param id - SCORM module ID
   */
  scoes: (id: number) => [...scormQueryKeys.all, 'scoes', id] as const,

  /**
   * Key for user attempts query
   * @param id - SCORM module ID
   */
  attempts: (id: number) => [...scormQueryKeys.all, 'attempts', id] as const,

  /**
   * Key for user tracking data query
   * @param id - SCORM module ID
   * @param attemptNumber - Specific attempt number (optional)
   */
  userData: (id: number, attemptNumber?: number) =>
    attemptNumber
      ? ([...scormQueryKeys.all, 'userData', id, attemptNumber] as const)
      : ([...scormQueryKeys.all, 'userData', id] as const),
};

// ============================================================================
// HOOK RETURN TYPE
// ============================================================================

/**
 * Return type for useScorm hook
 */
export interface UseScormReturn {
  /** SCORM package details including configuration and metadata */
  scorm: Scorm | undefined;

  /** Array of SCOs (Shareable Content Objects) with launch URLs and structure */
  scoes: ScormSco[] | undefined;

  /** Array of user attempts with status and timing information */
  attempts: ScormAttempt[] | undefined;

  /** 
   * User tracking data for the latest or specified attempt
   * Contains CMI elements, scores, completion status, and timing
   * Note: Currently derived from attempts data; full tracking data
   * can be fetched separately using fetchAttemptTracking()
   */
  userData: ScormAttempt | undefined;

  /** 
   * Combined loading state - true if any query is loading
   * Useful for showing initial loading states
   */
  isLoading: boolean;

  /**
   * Combined error state - contains first error encountered
   * Allows centralized error handling
   */
  error: Error | null;

  /**
   * Refetch function to refresh all SCORM data
   * Triggers refetch of package details, SCOs, and attempts
   */
  refetch: () => Promise<void>;

  /** Individual query states for granular control */
  queries: {
    scorm: UseQueryResult<Scorm, Error>;
    scoes: UseQueryResult<ScormSco[], Error>;
    attempts: UseQueryResult<ScormAttempt[], Error>;
  };
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Custom hook for managing SCORM package state
 *
 * Fetches and manages all SCORM-related data including package configuration,
 * SCO structure, user attempts, and tracking data. Implements efficient caching
 * with React Query's stale-while-revalidate strategy.
 *
 * Caching Strategy:
 * - Package details: 10 minute stale time (rarely changes)
 * - SCO structure: 10 minute stale time (static within package)
 * - Attempts: 1 minute stale time (updated frequently during learning)
 *
 * Example usage:
 * ```typescript
 * function ScormPlayer({ scormId }: { scormId: number }) {
 *   const { scorm, scoes, attempts, userData, isLoading, error } = useScorm(scormId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!scorm) return <NotFound />;
 *
 *   return (
 *     <div>
 *       <h1>{scorm.name}</h1>
 *       <ScormPlayer scorm={scorm} scoes={scoes} currentAttempt={attempts?.[0]} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @param scormId - SCORM module ID
 * @returns Object containing SCORM data, loading states, errors, and refetch function
 */
export function useScorm(scormId: number): UseScormReturn {
  // ============================================================================
  // SCORM PACKAGE DETAILS QUERY
  // ============================================================================

  /**
   * Fetch SCORM package details
   *
   * Retrieves comprehensive package information including:
   * - Basic metadata (name, intro, course)
   * - Version and type (SCORM 1.2, SCORM 2004, AICC)
   * - Grading configuration (method, whatgrade, maxgrade)
   * - Attempt settings (maxattempt, forcenewattempt)
   * - Display settings (popup, width, height, TOC, navigation)
   * - Completion requirements
   *
   * Stale time: 10 minutes (package configuration rarely changes during session)
   */
  const scormQuery = useQuery<Scorm, Error>({
    queryKey: scormQueryKeys.detail(scormId),
    queryFn: () => fetchScorm(scormId),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes garbage collection time
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // ============================================================================
  // SCORM SCO STRUCTURE QUERY
  // ============================================================================

  /**
   * Fetch SCO (Shareable Content Object) structure
   *
   * Retrieves hierarchical SCO structure including:
   * - SCO identifiers from manifest
   * - Launch URLs and parameters
   * - Organization and parent relationships
   * - SCO types (asset vs sco)
   * - Titles and sort order
   *
   * Used for:
   * - Building table of contents
   * - Navigation between content objects
   * - Launching specific SCOs
   * - Prerequisite evaluation
   *
   * Stale time: 10 minutes (SCO structure is static within package)
   */
  const scoesQuery = useQuery<ScormSco[], Error>({
    queryKey: scormQueryKeys.scoes(scormId),
    queryFn: () => fetchScormScos(scormId),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // ============================================================================
  // USER ATTEMPTS QUERY
  // ============================================================================

  /**
   * Fetch user attempt history
   *
   * Retrieves all attempts for the current user including:
   * - Attempt numbers (1-based sequence)
   * - Completion status (not attempted, incomplete, completed, passed, failed)
   * - Timing information (timemodified)
   * - User ID and SCORM ID associations
   *
   * Used for:
   * - Displaying attempt history
   * - Determining current/latest attempt
   * - Checking attempt limits
   * - Resume vs new attempt logic
   * - Grade calculation based on whatgrade setting
   *
   * Stale time: 1 minute (attempts updated frequently during learning)
   */
  const attemptsQuery = useQuery<ScormAttempt[], Error>({
    queryKey: scormQueryKeys.attempts(scormId),
    queryFn: () => fetchAttempts(scormId),
    staleTime: 1 * 60 * 1000, // 1 minute - shorter stale time for frequently updated data
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // ============================================================================
  // DERIVED USER DATA
  // ============================================================================

  /**
   * Extract user tracking data from attempts
   *
   * Currently provides the most recent attempt as userData.
   * For detailed CMI tracking data (scores, interactions, objectives),
   * use fetchAttemptTracking() separately with the specific attempt ID.
   *
   * The most recent attempt typically represents:
   * - Current progress in SCORM 1.2 cmi.core.lesson_status
   * - Current progress in SCORM 2004 cmi.completion_status
   * - Last known score (cmi.core.score.raw or cmi.score.raw)
   * - Session time and total time
   *
   * Note: For complete tracking data including all CMI elements,
   * interactions, and objectives, use the fetchAttemptTracking()
   * function from the API with the specific attempt ID.
   */
  const userData = attemptsQuery.data?.[attemptsQuery.data.length - 1];

  // ============================================================================
  // COMBINED LOADING AND ERROR STATES
  // ============================================================================

  /**
   * Combined loading state
   *
   * Returns true if ANY of the core queries (scorm, scoes, attempts) is loading.
   * Useful for displaying a unified loading state while initial data is fetched.
   *
   * Individual loading states are still available via queries.scorm.isLoading, etc.
   */
  const isLoading = scormQuery.isLoading || scoesQuery.isLoading || attemptsQuery.isLoading;

  /**
   * Combined error state
   *
   * Returns the first error encountered across all queries.
   * Priority order: scorm error → scoes error → attempts error
   *
   * Rationale:
   * - If SCORM package can't be loaded, nothing else matters
   * - If SCOs can't be loaded, can't display content
   * - Attempts errors are least critical (can still show package info)
   */
  const error = scormQuery.error || scoesQuery.error || attemptsQuery.error || null;

  // ============================================================================
  // REFETCH FUNCTION
  // ============================================================================

  /**
   * Refetch all SCORM data
   *
   * Triggers a fresh fetch of package details, SCO structure, and attempts.
   * Useful for:
   * - Manual refresh after external changes
   * - Retry after error
   * - Ensuring latest data before critical operations
   *
   * Returns: Promise that resolves when all refetches complete
   */
  const refetch = async (): Promise<void> => {
    await Promise.all([scormQuery.refetch(), scoesQuery.refetch(), attemptsQuery.refetch()]);
  };

  // ============================================================================
  // RETURN COMBINED STATE
  // ============================================================================

  return {
    // Core data
    scorm: scormQuery.data,
    scoes: scoesQuery.data,
    attempts: attemptsQuery.data,
    userData,

    // Combined states
    isLoading,
    error,

    // Control functions
    refetch,

    // Individual query states for granular control
    queries: {
      scorm: scormQuery,
      scoes: scoesQuery,
      attempts: attemptsQuery,
    },
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

/**
 * Default export for convenience
 */
export default useScorm;
