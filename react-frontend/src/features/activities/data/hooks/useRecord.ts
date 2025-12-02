/**
 * useRecord Hook
 *
 * React Query hook for fetching a single Database activity record with all
 * field values and metadata. Retrieves complete record data including field
 * contents, user info, timestamps, approval status, ratings, comments, and tags.
 *
 * This hook provides:
 * - Complete record data with strongly-typed field values
 * - User permissions for the record (edit, delete, approve)
 * - Automatic background refetching on window focus
 * - Optimistic updates support for seamless UX
 * - Loading, error, and success state management
 *
 * Based on Moodle's PHP implementation:
 * - public/mod/data/locallib.php
 * - public/mod/data/view.php
 *
 * @module features/activities/data/hooks/useRecord
 */

import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { getRecord, dataQueryKeys, RecordWithContents } from '@/features/activities/data/api/dataApi';
import type { DatabaseRecord } from '@/features/activities/data/types/data.types';
import type { Id } from '@/types/common';

// ============================================================================
// Types
// ============================================================================

/**
 * Extended record data with user permissions and helper information.
 *
 * Includes all record data from the API plus computed permission flags
 * and convenience methods for record operations.
 */
export interface RecordData extends RecordWithContents {
  /**
   * User who created the record
   */
  user: {
    /** User ID */
    id: number;
    /** User's first name */
    firstname?: string;
    /** User's last name */
    lastname?: string;
    /** User's full name (computed server-side) */
    fullname?: string;
    /** URL to user's profile picture */
    picture?: string;
  };

  /**
   * Permissions for the current user regarding this record
   */
  permissions: {
    /** Whether the current user can edit this record */
    canEdit: boolean;
    /** Whether the current user can delete this record */
    canDelete: boolean;
    /** Whether the current user can approve this record */
    canApprove: boolean;
  };
}

/**
 * Parameters for the useRecord hook.
 */
export interface UseRecordParams {
  /**
   * Database activity instance ID
   */
  dataId: Id;

  /**
   * Record ID to fetch
   */
  recordId: Id;

  /**
   * Optional configuration to override default query options
   */
  options?: Omit<
    UseQueryOptions<RecordWithContents, Error, RecordData>,
    'queryKey' | 'queryFn'
  >;
}

/**
 * Return type for the useRecord hook.
 *
 * Combines React Query's UseQueryResult with additional helper properties
 * for common record operations. Uses type intersection instead of interface
 * extension because UseQueryResult is a complex mapped type.
 */
export type UseRecordResult = UseQueryResult<RecordData, Error> & {
  /**
   * The fetched record data (alias for data property)
   */
  record: RecordData | undefined;

  /**
   * Helper function to check if current user can edit the record
   */
  canEdit: boolean;

  /**
   * Helper function to check if current user can delete the record
   */
  canDelete: boolean;

  /**
   * Helper function to check if record is approved
   */
  isApproved: boolean;

  /**
   * Helper function to check if record is pending approval
   */
  isPending: boolean;
};

// ============================================================================
// Constants
// ============================================================================

/**
 * Default stale time for record queries (5 minutes).
 *
 * Records are considered stale after this duration and will be
 * refetched in the background on the next access.
 */
const DEFAULT_STALE_TIME = 5 * 60 * 1000;

/**
 * Default cache time for record queries (30 minutes).
 *
 * Records are kept in cache for this duration after becoming unused.
 * This allows quick re-access if the user navigates back.
 */
const DEFAULT_CACHE_TIME = 30 * 60 * 1000;

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Transforms raw API response to enhanced RecordData with computed fields.
 *
 * This function:
 * - Extracts user information into a structured user object
 * - Normalizes permission flags into a permissions object
 * - Preserves all original record data and field contents
 *
 * @param record - Raw record data from API
 * @returns Enhanced record data with computed fields
 */
function transformRecordData(record: RecordWithContents): RecordData {
  // Extract user name parts from fullname if available
  const nameParts = record.userfullname?.split(' ') || [];
  const firstname = nameParts[0] || undefined;
  const lastname = nameParts.slice(1).join(' ') || undefined;

  return {
    ...record,
    user: {
      id: record.userid,
      firstname,
      lastname,
      fullname: record.userfullname,
      // Picture URL is not directly provided in RecordWithContents,
      // but may be included in extended API responses
      picture: undefined,
    },
    permissions: {
      canEdit: record.canEdit ?? false,
      canDelete: record.canDelete ?? false,
      // canApprove is determined by database-level permissions,
      // not record-level, so we derive it from canEdit for now
      canApprove: record.canEdit ?? false,
    },
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React Query hook for fetching a single database activity record.
 *
 * Fetches complete record data including:
 * - All field values properly typed
 * - Record metadata (userid, timecreated, timemodified, approved, groupid)
 * - User info (firstname, lastname, picture)
 * - Ratings (aggregate, count, user's rating)
 * - Comments (if enabled on the database)
 * - Tags (if any assigned)
 * - User permissions (canEdit, canDelete, canApprove)
 *
 * Features:
 * - Automatic caching with configurable stale time
 * - Background refetching on window focus
 * - Optimistic updates support for mutations
 * - Strongly-typed field values
 * - Loading, error, and success state management
 *
 * @param params - Hook parameters including dataId and recordId
 * @returns Query result with record data and helper methods
 *
 * @example
 * ```typescript
 * // Basic usage
 * function RecordView({ dataId, recordId }: Props) {
 *   const { record, isLoading, error } = useRecord({
 *     dataId,
 *     recordId,
 *   });
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <h2>Record by {record.user.fullname}</h2>
 *       <p>Created: {new Date(record.timecreated * 1000).toLocaleString()}</p>
 *       {record.contents.map(content => (
 *         <FieldDisplay key={content.id} content={content} />
 *       ))}
 *       {record.canEdit && <EditButton recordId={record.id} />}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With custom options
 * const { record, refetch } = useRecord({
 *   dataId: 123,
 *   recordId: 456,
 *   options: {
 *     staleTime: 10 * 60 * 1000, // 10 minutes
 *     enabled: isUserAuthenticated,
 *     onSuccess: (data) => {
 *       console.log('Record loaded:', data.id);
 *     },
 *   },
 * });
 * ```
 */
function useRecord({
  dataId,
  recordId,
  options = {},
}: UseRecordParams): UseRecordResult {
  // Input validation
  const isValidParams = Boolean(
    dataId && dataId > 0 && recordId && recordId > 0
  );

  // Build query using React Query
  const queryResult = useQuery<RecordWithContents, Error, RecordData>({
    // Generate unique cache key for this specific record
    queryKey: dataQueryKeys.record(dataId, recordId),

    // Fetch function that calls the API
    queryFn: async () => {
      if (!isValidParams) {
        throw new Error('Invalid database ID or record ID provided');
      }
      return getRecord(dataId, recordId);
    },

    // Transform raw API data to enhanced RecordData
    select: transformRecordData,

    // Only enable query if we have valid parameters
    enabled: isValidParams && (options.enabled !== false),

    // Configure stale time - data is fresh for this duration
    staleTime: options.staleTime ?? DEFAULT_STALE_TIME,

    // Configure cache time - data stays in cache this long after unmount
    gcTime: DEFAULT_CACHE_TIME,

    // Refetch on window focus for up-to-date data
    refetchOnWindowFocus: true,

    // Refetch when reconnecting to network
    refetchOnReconnect: true,

    // Keep previous data while refetching for smooth UX
    placeholderData: (previousData) => previousData,

    // Retry failed requests up to 3 times
    retry: 3,

    // Exponential backoff for retries
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Merge in any user-provided options
    ...options,
  });

  // Compute helper flags from the record data
  const recordData = queryResult.data;
  const canEdit = recordData?.permissions.canEdit ?? false;
  const canDelete = recordData?.permissions.canDelete ?? false;
  // Access approved from the underlying DatabaseRecord properties via RecordWithContents
  const isApproved = (recordData as RecordWithContents | undefined)?.approved ?? false;
  const isPending = !isApproved && recordData !== undefined;

  // Return enhanced result object combining query result with custom properties
  return {
    ...queryResult,
    record: recordData,
    canEdit,
    canDelete,
    isApproved,
    isPending,
  } as UseRecordResult;
}

// ============================================================================
// Exports
// ============================================================================

export default useRecord;

// Re-export types for convenience
export type { RecordWithContents, DatabaseRecord };
