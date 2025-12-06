/**
 * useAssignment Hook
 *
 * Custom React Query hook for fetching and managing assignment data from Moodle.
 * This hook wraps the assignmentApi.fetchAssignment() function with React Query
 * for optimal client-side state management, caching, and automatic refetching.
 *
 * Features:
 * - Automatic caching with 5-minute stale time
 * - Background refetching on window focus for real-time updates
 * - Query invalidation support for assignment updates
 * - Proper TypeScript typing with Assignment interface
 * - Conditional query execution based on assignmentId validity
 * - Integration with React Query devtools for debugging
 *
 * The hook follows the REFERENCE pattern from Moodle's view.php which loads
 * assignments via the assign class and requires mod/assign:view capability.
 * All business logic remains in the API layer (assignmentApi.ts) which wraps
 * existing Moodle functions.
 *
 * @module features/activities/assignments/hooks/useAssignment
 * @see {@link file://public/mod/assign/view.php} - Original Moodle implementation
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Assignment } from '../types/assignment.types';
import { fetchAssignment, assignmentKeys } from '../api/assignmentApi';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Error response structure from the API
 * Provides structured error information for handling in the UI
 */
interface AssignmentApiError extends Error {
  /** HTTP status code */
  status?: number;
  /** Error code from the API (e.g., 'PERMISSION_DENIED', 'NOT_FOUND') */
  code?: string;
  /** Additional error details for debugging */
  details?: Record<string, unknown>;
}

/**
 * Hook configuration options
 * Allows customizing the React Query behavior
 */
interface UseAssignmentOptions {
  /** Whether to enable background refetch on window focus. Default: true */
  refetchOnWindowFocus?: boolean;
  /** Stale time in milliseconds. Default: 300000 (5 minutes) */
  staleTime?: number;
  /** Whether the query is enabled. Default: true when assignmentId is valid */
  enabled?: boolean;
}

/**
 * Return type for the useAssignment hook
 * Extends React Query's UseQueryResult with specific Assignment typing
 */
export type UseAssignmentResult = UseQueryResult<Assignment, AssignmentApiError>;

// ============================================================================
// Constants
// ============================================================================

/**
 * Default stale time for assignment data (5 minutes)
 * Assignment data doesn't change frequently, so we can cache it longer
 * to reduce API calls while still keeping data reasonably fresh.
 */
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Default cache time (garbage collection time) for assignment queries
 * After this time, unused queries are removed from the cache
 */
const DEFAULT_GC_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates if an assignment ID is valid for querying
 *
 * @param assignmentId - The assignment ID to validate
 * @returns true if the ID is a positive integer, false otherwise
 */
function isValidAssignmentId(assignmentId: number | null | undefined): assignmentId is number {
  return (
    assignmentId !== null &&
    assignmentId !== undefined &&
    typeof assignmentId === 'number' &&
    Number.isInteger(assignmentId) &&
    assignmentId > 0
  );
}

/**
 * Creates a user-friendly error message based on the API error
 *
 * @param error - The error from the API call
 * @returns A user-friendly error message string
 */
function getErrorMessage(error: AssignmentApiError): string {
  // Handle HTTP status-based errors
  if (error.status) {
    switch (error.status) {
      case 401:
        return 'Your session has expired. Please log in again to view this assignment.';
      case 403:
        return 'You do not have permission to view this assignment. Please contact your instructor if you believe this is an error.';
      case 404:
        return 'This assignment could not be found. It may have been deleted or you may not have access to it.';
      case 500:
        return 'A server error occurred while loading the assignment. Please try again later.';
      default:
        break;
    }
  }

  // Handle API error codes
  if (error.code) {
    switch (error.code) {
      case 'PERMISSION_DENIED':
        return 'You do not have permission to view this assignment.';
      case 'NOT_FOUND':
        return 'This assignment does not exist.';
      case 'TOKEN_EXPIRED':
        return 'Your session has expired. Please log in again.';
      case 'INVALID_TOKEN':
        return 'Your authentication token is invalid. Please log in again.';
      default:
        break;
    }
  }

  // Fallback to the error message or a generic message
  return error.message || 'An unexpected error occurred while loading the assignment.';
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Custom React Query hook for fetching and managing assignment data
 *
 * This hook provides a convenient way to fetch assignment details from the
 * Moodle API with automatic caching, background refetching, and error handling.
 *
 * The hook uses React Query for server state management with the following defaults:
 * - 5-minute stale time for optimal caching
 * - Automatic refetching on window focus for real-time updates
 * - Query disabled when assignmentId is invalid (null, undefined, or 0)
 *
 * @param assignmentId - The ID of the assignment to fetch
 * @param options - Optional configuration for the query behavior
 * @returns React Query result object with assignment data, loading, and error states
 *
 * @example
 * ```typescript
 * // Basic usage
 * function AssignmentView({ assignmentId }: { assignmentId: number }) {
 *   const { data: assignment, isLoading, isError, error, refetch } = useAssignment(assignmentId);
 *
 *   if (isLoading) {
 *     return <LoadingSpinner />;
 *   }
 *
 *   if (isError) {
 *     return <ErrorMessage message={error?.message} />;
 *   }
 *
 *   return (
 *     <div>
 *       <h1>{assignment?.name}</h1>
 *       <p>Due: {assignment?.duedate ? formatDate(assignment.duedate) : 'No due date'}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With custom options
 * const { data } = useAssignment(assignmentId, {
 *   staleTime: 60000, // 1 minute
 *   refetchOnWindowFocus: false,
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Conditional fetching (e.g., in a form that may not have an ID yet)
 * const { data } = useAssignment(assignmentId, {
 *   enabled: !!assignmentId && isFormReady,
 * });
 * ```
 */
export function useAssignment(
  assignmentId: number | null | undefined,
  options?: UseAssignmentOptions
): UseAssignmentResult {
  // Determine if the query should be enabled
  // Default to enabled if assignmentId is valid, but allow override via options
  const isEnabled = options?.enabled !== undefined
    ? options.enabled && isValidAssignmentId(assignmentId)
    : isValidAssignmentId(assignmentId);

  // Create the query using React Query
  return useQuery<Assignment, AssignmentApiError>({
    // Use the assignment keys factory for consistent cache key management
    // This enables fine-grained cache invalidation when assignments are updated
    queryKey: assignmentKeys.detail(assignmentId as number),

    // The query function calls the API layer
    // All business logic (permission checks, data formatting) is handled by the API
    queryFn: () => {
      if (!isValidAssignmentId(assignmentId)) {
        return Promise.reject(new Error('Invalid assignment ID'));
      }
      return fetchAssignment(assignmentId);
    },

    // Stale time determines how long data is considered "fresh"
    // During this time, React Query returns cached data without refetching
    // 5 minutes is a good balance between freshness and reducing API calls
    staleTime: options?.staleTime ?? DEFAULT_STALE_TIME,

    // Garbage collection time - how long to keep unused data in cache
    // After this time, queries with no active observers are removed
    gcTime: DEFAULT_GC_TIME,

    // Refetch on window focus provides real-time updates when users return to the tab
    // This is especially useful for assignments that may be updated by instructors
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? true,

    // Enable/disable the query based on assignmentId validity
    // When disabled, no requests are made and the query is in 'pending' state
    enabled: isEnabled,

    // Retry configuration for failed requests
    // We retry a few times with exponential backoff, but not for auth errors
    retry: (failureCount, error) => {
      // Don't retry authentication or permission errors
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },

    // Exponential backoff for retries
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Transform network errors to have consistent structure
    // This ensures error handling is uniform across the application
    meta: {
      errorMessage: 'Failed to load assignment',
    },
  });
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Re-export the assignment query keys for cache invalidation
 * This allows components to invalidate the assignment cache when needed
 *
 * @example
 * ```typescript
 * import { useQueryClient } from '@tanstack/react-query';
 * import { assignmentQueryKeys } from './useAssignment';
 *
 * function AssignmentEditForm() {
 *   const queryClient = useQueryClient();
 *
 *   const handleSave = async () => {
 *     await saveAssignment(data);
 *     // Invalidate the cache to refetch fresh data
 *     queryClient.invalidateQueries({ queryKey: assignmentQueryKeys.detail(assignmentId) });
 *   };
 * }
 * ```
 */
export { assignmentKeys as assignmentQueryKeys };

/**
 * Export the error message helper for use in components
 * Allows consistent error message formatting across the assignment feature
 */
export { getErrorMessage as getAssignmentErrorMessage };

/**
 * Export the ID validation helper for use in components
 * Allows components to validate IDs before calling the hook
 */
export { isValidAssignmentId };
