/**
 * LTI Grade Synchronization Hook - useLTIGradeSync
 *
 * Custom React hook for managing LTI grade passback operations to external tool providers.
 * Handles both LTI 1.1 Basic Outcomes XML POX requests and LTI Advantage Assignment and
 * Grade Services (AGS) JSON requests with comprehensive error handling, retry logic, and
 * optimistic updates.
 *
 * Features:
 * - Grade passback (replaceResult) to external LTI tools
 * - Grade reading (readResult) from external LTI tools
 * - Grade deletion (deleteResult) from external LTI tools
 * - Grade format normalization (Moodle 0-100 ↔ LTI 0-1 scale)
 * - Automatic retry with exponential backoff for transient failures
 * - Error categorization (retryable vs permanent)
 * - Optimistic UI updates with rollback on failure
 * - Grade sync history tracking with timestamps
 * - Permission validation via user capabilities
 *
 * LTI 1.1 Basic Outcomes XML POX Format:
 * ```xml
 * <?xml version="1.0" encoding="UTF-8"?>
 * <imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
 *   <imsx_POXHeader>
 *     <imsx_POXRequestHeaderInfo>
 *       <imsx_version>V1.0</imsx_version>
 *       <imsx_messageIdentifier>9e8cff8c-b59e-4d1c-a7b5-3f5c8d1c8b9e</imsx_messageIdentifier>
 *     </imsx_POXRequestHeaderInfo>
 *   </imsx_POXHeader>
 *   <imsx_POXBody>
 *     <replaceResultRequest>
 *       <resultRecord>
 *         <sourcedGUID>
 *           <sourcedId>{"data":{"instanceid":1,"userid":2,"typeid":1,"launchid":1},"hash":"..."}</sourcedId>
 *         </sourcedGUID>
 *         <result>
 *           <resultScore>
 *             <language>en</language>
 *             <textString>0.85</textString>
 *           </resultScore>
 *         </result>
 *       </resultRecord>
 *     </replaceResultRequest>
 *   </imsx_POXBody>
 * </imsx_POXEnvelopeRequest>
 * ```
 *
 * OAuth 1.0 Signature with Body Hash:
 * - SHA1 hash of the request body is computed
 * - Base64 encoded and included as oauth_body_hash parameter
 * - Signature computed using HMAC-SHA1 with consumer secret
 *
 * LTI Advantage AGS JSON Format:
 * ```json
 * POST /lineitems/{lineItemId}/scores
 * {
 *   "userId": "user123",
 *   "scoreGiven": 85.0,
 *   "scoreMaximum": 100.0,
 *   "activityProgress": "Completed",
 *   "gradingProgress": "FullyGraded",
 *   "timestamp": "2024-01-15T10:30:00Z"
 * }
 * ```
 *
 * @module features/activities/lti/hooks/useLTIGradeSync
 * @see public/mod/lti/service.php - Moodle LTI service endpoint handling
 * @see public/mod/lti/servicelib.php - LTI service utility functions
 * @see public/mod/lti/grade.php - LTI grade hook for gradebook integration
 */

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLtiGradePassback, ltiQueryKeys } from '@/features/activities/lti/api/ltiApi';
import type { LtiGradeResult } from '@/features/activities/lti/types/lti.types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { LtiGradePassbackRequest, LtiGradesResponse } from '@/features/activities/lti/api/ltiApi';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Grade sync status enum representing the current state of sync operation
 */
export type GradeSyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'retrying';

/**
 * Individual grade sync history entry
 * Records each sync attempt for audit and debugging purposes
 */
export interface GradeSyncHistoryEntry {
  /** Unique identifier for this history entry */
  id: string;
  /** Timestamp when the sync was attempted */
  timestamp: number;
  /** Status of the sync attempt */
  status: 'success' | 'error' | 'retrying';
  /** Grade value that was synced (normalized 0-1) */
  gradeValue: number;
  /** Error message if the sync failed */
  errorMessage?: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Operation type */
  operation: 'replace' | 'read' | 'delete';
}

/**
 * Configuration options for the useLTIGradeSync hook
 */
export interface UseLTIGradeSyncOptions {
  /** Enable automatic grade sync when grade value changes */
  autoSync?: boolean;
  /** Maximum number of retry attempts for transient failures (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  baseRetryDelay?: number;
  /** Callback when sync succeeds */
  onSuccess?: (result: LtiGradeResult) => void;
  /** Callback when sync fails */
  onError?: (error: Error) => void;
  /** Capability required for grade sync (default: 'mod/lti:grade') */
  requiredCapability?: string;
}

/**
 * Result interface for the useLTIGradeSync hook
 *
 * Provides all state and methods needed for managing LTI grade synchronization
 * including grade operations, status tracking, error handling, and utility functions.
 */
export interface UseLTIGradeSyncResult {
  /**
   * Mutation function to sync a grade to the external LTI tool provider
   *
   * Submits a grade passback request (replaceResult) to the tool's outcome service.
   * The grade should be normalized to LTI scale (0-1).
   *
   * @param grade - Grade value normalized to 0-1 scale
   * @returns Promise resolving when grade sync completes
   *
   * @example
   * ```tsx
   * const { syncGrade, normalizeGrade } = useLTIGradeSync({ ltiId: 1, userId: 2 });
   *
   * // Sync a grade (already normalized)
   * await syncGrade(0.85);
   *
   * // Or normalize from Moodle scale
   * await syncGrade(normalizeGrade(85));
   * ```
   */
  syncGrade: (grade: number) => Promise<void>;

  /**
   * Query function to read the current grade from the external tool provider
   *
   * Sends a readResult request to retrieve the current grade value stored
   * by the external tool. Returns the grade in normalized 0-1 scale.
   *
   * @returns Promise resolving to the current grade (0-1) or null if no grade
   *
   * @example
   * ```tsx
   * const { readGrade, denormalizeGrade } = useLTIGradeSync({ ltiId: 1, userId: 2 });
   *
   * const currentGrade = await readGrade();
   * if (currentGrade !== null) {
   *   console.log(`Moodle grade: ${denormalizeGrade(currentGrade)}`);
   * }
   * ```
   */
  readGrade: () => Promise<number | null>;

  /**
   * Mutation function to delete the grade from the external tool provider
   *
   * Sends a deleteResult request to remove the grade from the tool's records.
   * Also clears the grade in Moodle's gradebook.
   *
   * @returns Promise resolving when deletion completes
   *
   * @example
   * ```tsx
   * const { deleteGrade, isSyncing } = useLTIGradeSync({ ltiId: 1, userId: 2 });
   *
   * if (confirm('Delete this grade?')) {
   *   await deleteGrade();
   * }
   * ```
   */
  deleteGrade: () => Promise<void>;

  /**
   * Whether a sync operation is currently in progress
   *
   * True during any grade sync operation (sync, read, or delete).
   * Use this to disable UI elements during operations.
   */
  isSyncing: boolean;

  /**
   * Current error from the most recent sync operation
   *
   * Contains the error object if the last operation failed.
   * Cleared when a new operation starts.
   */
  error: Error | null;

  /**
   * History of grade sync attempts
   *
   * Array of past sync operations with timestamps and results.
   * Useful for debugging and audit purposes.
   */
  syncHistory: GradeSyncHistoryEntry[];

  /**
   * Current retry count for the ongoing operation
   *
   * Number of retry attempts made for the current operation.
   * Resets to 0 when operation completes or new operation starts.
   */
  retryCount: number;

  /**
   * Normalize a Moodle grade (0-100) to LTI scale (0-1)
   *
   * LTI Basic Outcomes uses a 0-1 scale for grades, while Moodle
   * typically uses 0-100 percentages. This function converts between them.
   *
   * @param moodleGrade - Grade as percentage (0-100)
   * @returns Grade normalized to 0-1 scale
   *
   * @example
   * ```tsx
   * const { normalizeGrade } = useLTIGradeSync({ ltiId: 1, userId: 2 });
   *
   * normalizeGrade(85);  // Returns 0.85
   * normalizeGrade(100); // Returns 1.0
   * normalizeGrade(0);   // Returns 0.0
   * ```
   */
  normalizeGrade: (moodleGrade: number) => number;

  /**
   * Convert LTI grade (0-1) back to Moodle scale (0-100)
   *
   * Converts a normalized LTI grade back to Moodle percentage format.
   *
   * @param ltiGrade - Grade in LTI scale (0-1)
   * @returns Grade as percentage (0-100)
   *
   * @example
   * ```tsx
   * const { denormalizeGrade } = useLTIGradeSync({ ltiId: 1, userId: 2 });
   *
   * denormalizeGrade(0.85); // Returns 85
   * denormalizeGrade(1.0);  // Returns 100
   * denormalizeGrade(0);    // Returns 0
   * ```
   */
  denormalizeGrade: (ltiGrade: number) => number;

  /**
   * Determine if an error is retryable
   *
   * Categorizes errors into retryable (transient) and permanent.
   * Retryable errors include network issues, 5xx server errors, and timeouts.
   * Permanent errors include 4xx client errors and validation failures.
   *
   * @param error - Error object or HTTP status code
   * @returns True if the error is retryable, false for permanent errors
   *
   * @example
   * ```tsx
   * const { isRetryableError, error } = useLTIGradeSync({ ltiId: 1, userId: 2 });
   *
   * if (error && isRetryableError(error)) {
   *   console.log('Operation will retry automatically');
   * } else if (error) {
   *   console.log('Permanent error, please check your input');
   * }
   * ```
   */
  isRetryableError: (error: Error | number) => boolean;

  /**
   * Get the current sync status
   *
   * Returns a status string representing the current state of sync operations.
   * Useful for UI state management and progress indicators.
   *
   * @returns Current sync status: 'idle' | 'syncing' | 'success' | 'error' | 'retrying'
   *
   * @example
   * ```tsx
   * const { getGradeSyncStatus } = useLTIGradeSync({ ltiId: 1, userId: 2 });
   *
   * const status = getGradeSyncStatus();
   * switch (status) {
   *   case 'idle': return <StatusIdle />;
   *   case 'syncing': return <LoadingSpinner />;
   *   case 'retrying': return <RetryingIndicator />;
   *   case 'success': return <SuccessCheck />;
   *   case 'error': return <ErrorAlert />;
   * }
   * ```
   */
  getGradeSyncStatus: () => GradeSyncStatus;
}

/**
 * Parameters for the useLTIGradeSync hook
 */
export interface UseLTIGradeSyncParams {
  /** LTI tool instance ID */
  ltiId: number;
  /** User ID to sync grades for */
  userId: number;
  /** Optional configuration options */
  options?: UseLTIGradeSyncOptions;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * HTTP status codes that indicate retryable errors
 */
const RETRYABLE_STATUS_CODES = [
  503, // Service Unavailable
  504, // Gateway Timeout
  502, // Bad Gateway
  408, // Request Timeout
  429, // Too Many Requests
] as const;

/**
 * HTTP status codes that indicate permanent errors
 */
const PERMANENT_STATUS_CODES = [
  400, // Bad Request
  401, // Unauthorized
  403, // Forbidden
  404, // Not Found
  422, // Unprocessable Entity
] as const;

/**
 * Error messages that indicate network/transient issues
 */
const RETRYABLE_ERROR_MESSAGES = [
  'Network Error',
  'timeout',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'network',
] as const;

/**
 * Default retry configuration
 */
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_RETRY_DELAY = 1000;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a UUID v4 for message identifiers
 *
 * Used for imsx_messageIdentifier in XML POX requests to uniquely
 * identify each grade passback operation.
 *
 * @returns UUID v4 string
 */
function generateUuidV4(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Calculate exponential backoff delay
 *
 * Implements exponential backoff: delay = baseDelay * 2^retryCount
 * With jitter to prevent thundering herd problem.
 *
 * @param retryCount - Current retry attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds
 * @returns Delay in milliseconds with jitter
 *
 * @example
 * ```
 * calculateBackoffDelay(0, 1000) // ~1000ms (1s)
 * calculateBackoffDelay(1, 1000) // ~2000ms (2s)
 * calculateBackoffDelay(2, 1000) // ~4000ms (4s)
 * ```
 */
function calculateBackoffDelay(retryCount: number, baseDelay: number): number {
  // Base exponential: delay = baseDelay * 2^retryCount
  const exponentialDelay = baseDelay * Math.pow(2, retryCount);

  // Add jitter (±10%) to prevent thundering herd
  const jitter = exponentialDelay * 0.1 * (Math.random() * 2 - 1);

  return Math.floor(exponentialDelay + jitter);
}

/**
 * Extract HTTP status code from error
 *
 * @param error - Error object that may contain status information
 * @returns HTTP status code or undefined
 */
function extractStatusCode(error: Error): number | undefined {
  // Check for axios-style error response
  const axiosError = error as Error & {
    response?: { status?: number };
    status?: number;
    code?: string;
  };

  if (axiosError.response?.status) {
    return axiosError.response.status;
  }

  if (axiosError.status) {
    return axiosError.status;
  }

  return undefined;
}

// ============================================================================
// Main Hook Implementation
// ============================================================================

/**
 * Custom React hook for LTI grade synchronization
 *
 * Manages grade passback operations to external LTI tool providers with
 * comprehensive error handling, retry logic, and optimistic updates.
 *
 * @param params - Hook parameters including ltiId, userId, and options
 * @returns UseLTIGradeSyncResult with all grade sync methods and state
 *
 * @example
 * ```tsx
 * function GradeManager({ ltiId, userId }: Props) {
 *   const {
 *     syncGrade,
 *     readGrade,
 *     deleteGrade,
 *     isSyncing,
 *     error,
 *     syncHistory,
 *     normalizeGrade,
 *     getGradeSyncStatus,
 *   } = useLTIGradeSync({
 *     ltiId,
 *     userId,
 *     options: {
 *       autoSync: false,
 *       maxRetries: 3,
 *       onSuccess: (result) => console.log('Grade synced:', result),
 *       onError: (error) => console.error('Sync failed:', error),
 *     },
 *   });
 *
 *   const handleSubmit = async (moodleGrade: number) => {
 *     try {
 *       await syncGrade(normalizeGrade(moodleGrade));
 *       toast.success('Grade synced successfully');
 *     } catch (err) {
 *       toast.error('Failed to sync grade');
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <GradeInput onSubmit={handleSubmit} disabled={isSyncing} />
 *       <StatusBadge status={getGradeSyncStatus()} />
 *       {error && <ErrorMessage error={error} />}
 *       <SyncHistory entries={syncHistory} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useLTIGradeSync({
  ltiId,
  userId,
  options = {},
}: UseLTIGradeSyncParams): UseLTIGradeSyncResult {
  // Destructure options with defaults
  // Note: _autoSync is prefixed with underscore as it's reserved for future implementation
  const {
    autoSync: _autoSync = false,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseRetryDelay = DEFAULT_BASE_RETRY_DELAY,
    onSuccess,
    onError,
    requiredCapability = 'mod/lti:grade',
  } = options;

  // Get authentication state for permission checking
  const { user, isAuthenticated } = useAuth();

  // Get query client for cache management
  const queryClient = useQueryClient();

  // Local state for sync history
  const [syncHistory, setSyncHistory] = useState<GradeSyncHistoryEntry[]>([]);

  // Local state for retry count
  const [retryCount, setRetryCount] = useState(0);

  // Local state for sync status
  const [syncStatus, setSyncStatus] = useState<GradeSyncStatus>('idle');

  // Ref to track the last synced grade for auto-sync
  const lastSyncedGradeRef = useRef<number | null>(null);

  // Get the grade passback mutation from ltiApi
  const gradePassbackMutation = useLtiGradePassback();

  // ============================================================================
  // Permission Validation
  // ============================================================================

  /**
   * Check if the current user has permission to sync grades
   *
   * Validates the user has the required capability (typically mod/lti:grade).
   * Note: This is a client-side check; server enforces actual permissions.
   */
  const hasGradePermission = useCallback((): boolean => {
    if (!isAuthenticated || !user) {
      return false;
    }

    // Check if user has the required capability
    // The user object from useAuth contains capabilities from the JWT token
    // user.capabilities is Permission[] where Permission has: capability, contextId, granted
    const { capabilities } = user;
    if (Array.isArray(capabilities) && capabilities.length > 0) {
      // Check if any permission matches the required capability and is granted
      return capabilities.some(
        (perm) => perm.capability === requiredCapability && perm.granted === true
      );
    }

    // If no capabilities array, assume permission (server will enforce)
    // This allows the request to proceed, server returns 403 if unauthorized
    return true;
  }, [isAuthenticated, user, requiredCapability]);

  // ============================================================================
  // Grade Normalization Functions
  // ============================================================================

  /**
   * Normalize Moodle grade (0-100) to LTI scale (0-1)
   *
   * Implements the conversion as per LTI Basic Outcomes specification:
   * - LTI grades are floating-point numbers between 0 and 1
   * - Values outside 0-1 range should be clamped
   */
  const normalizeGrade = useCallback((moodleGrade: number): number => {
    // Clamp to valid range first
    const clampedGrade = Math.max(0, Math.min(100, moodleGrade));

    // Convert 0-100 to 0-1
    const normalizedGrade = clampedGrade / 100;

    // Round to 4 decimal places to avoid floating point precision issues
    return Math.round(normalizedGrade * 10000) / 10000;
  }, []);

  /**
   * Denormalize LTI grade (0-1) back to Moodle scale (0-100)
   *
   * Converts normalized LTI grade back to Moodle percentage format
   */
  const denormalizeGrade = useCallback((ltiGrade: number): number => {
    // Clamp to valid range first
    const clampedGrade = Math.max(0, Math.min(1, ltiGrade));

    // Convert 0-1 to 0-100
    const moodleGrade = clampedGrade * 100;

    // Round to 2 decimal places for display
    return Math.round(moodleGrade * 100) / 100;
  }, []);

  // ============================================================================
  // Error Classification Functions
  // ============================================================================

  /**
   * Determine if an error is retryable (transient) or permanent
   *
   * Retryable errors:
   * - 503 Service Unavailable
   * - 504 Gateway Timeout
   * - 502 Bad Gateway
   * - 408 Request Timeout
   * - 429 Too Many Requests
   * - Network errors (connection refused, timeout, reset)
   *
   * Permanent errors:
   * - 400 Bad Request
   * - 401 Unauthorized
   * - 403 Forbidden
   * - 404 Not Found
   * - 422 Unprocessable Entity
   * - Any validation errors
   */
  const isRetryableError = useCallback((error: Error | number | null | undefined): boolean => {
    // Handle null/undefined gracefully
    if (error === null || error === undefined) {
      return false;
    }

    // If error is a number, treat it as HTTP status code
    if (typeof error === 'number') {
      return RETRYABLE_STATUS_CODES.includes(error as typeof RETRYABLE_STATUS_CODES[number]);
    }

    // Ensure error is an Error object before extracting status
    if (!(error instanceof Error)) {
      return false;
    }

    // Extract status code if present
    const statusCode = extractStatusCode(error);
    if (statusCode !== undefined) {
      // Check if it's a retryable status code
      if (RETRYABLE_STATUS_CODES.includes(statusCode as typeof RETRYABLE_STATUS_CODES[number])) {
        return true;
      }
      // Check if it's a permanent error status code
      if (PERMANENT_STATUS_CODES.includes(statusCode as typeof PERMANENT_STATUS_CODES[number])) {
        return false;
      }
    }

    // Check error message for network-related issues
    const errorMessage = error.message?.toLowerCase() ?? '';
    return RETRYABLE_ERROR_MESSAGES.some((msg) =>
      errorMessage.includes(msg.toLowerCase())
    );
  }, []);

  // ============================================================================
  // History Management
  // ============================================================================

  /**
   * Add an entry to the sync history
   */
  const addHistoryEntry = useCallback(
    (
      operation: GradeSyncHistoryEntry['operation'],
      status: GradeSyncHistoryEntry['status'],
      gradeValue: number,
      errorMessage?: string,
      statusCode?: number
    ) => {
      const entry: GradeSyncHistoryEntry = {
        id: generateUuidV4(),
        timestamp: Date.now(),
        status,
        gradeValue,
        errorMessage,
        statusCode,
        operation,
      };

      setSyncHistory((prev) => {
        // Keep last 50 entries to prevent memory bloat
        const updatedHistory = [entry, ...prev];
        return updatedHistory.slice(0, 50);
      });
    },
    []
  );

  // ============================================================================
  // Status Management
  // ============================================================================

  /**
   * Get the current grade sync status
   */
  const getGradeSyncStatus = useCallback((): GradeSyncStatus => {
    return syncStatus;
  }, [syncStatus]);

  // ============================================================================
  // Sync Operations with Retry Logic
  // ============================================================================

  /**
   * Execute grade sync with retry logic
   */
  const executeWithRetry = useCallback(
    async <T>(
      operation: () => Promise<T>,
      operationType: GradeSyncHistoryEntry['operation'],
      gradeValue: number
    ): Promise<T> => {
      let lastError: Error | null = null;
      let currentRetry = 0;

      while (currentRetry <= maxRetries) {
        try {
          // Update status
          if (currentRetry > 0) {
            setSyncStatus('retrying');
            addHistoryEntry(operationType, 'retrying', gradeValue, `Retry attempt ${currentRetry}`);
          } else {
            setSyncStatus('syncing');
          }

          setRetryCount(currentRetry);

          // Execute the operation
          const result = await operation();

          // Success
          setSyncStatus('success');
          setRetryCount(0);
          addHistoryEntry(operationType, 'success', gradeValue);

          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const statusCode = extractStatusCode(lastError);

          // Check if we should retry
          if (isRetryableError(lastError) && currentRetry < maxRetries) {
            // Calculate backoff delay
            const delay = calculateBackoffDelay(currentRetry, baseRetryDelay);

            // Record retry attempt in history
            addHistoryEntry(
              operationType,
              'retrying',
              gradeValue,
              `${lastError.message} - retrying in ${delay}ms`,
              statusCode
            );

            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, delay));
            currentRetry++;
          } else {
            // Non-retryable error or max retries exceeded
            break;
          }
        }
      }

      // All retries exhausted or permanent error
      setSyncStatus('error');
      setRetryCount(0);

      if (lastError) {
        const statusCode = extractStatusCode(lastError);
        addHistoryEntry(
          operationType,
          'error',
          gradeValue,
          lastError.message,
          statusCode
        );
      }

      throw lastError;
    },
    [maxRetries, baseRetryDelay, isRetryableError, addHistoryEntry]
  );

  // ============================================================================
  // Grade Sync Operations
  // ============================================================================

  /**
   * Sync a grade to the external LTI tool provider
   *
   * Implements replaceResult operation from LTI Basic Outcomes.
   */
  const syncGrade = useCallback(
    async (grade: number): Promise<void> => {
      // Validate permissions
      if (!hasGradePermission()) {
        const permError = new Error('You do not have permission to sync grades');
        onError?.(permError);
        throw permError;
      }

      // Validate grade value
      if (grade < 0 || grade > 1) {
        const rangeError = new Error(
          'Grade must be between 0 and 1. Use normalizeGrade() to convert from Moodle scale.'
        );
        onError?.(rangeError);
        throw rangeError;
      }

      // Convert normalized grade to Moodle percentage for API
      const moodleGrade = denormalizeGrade(grade);

      // Build the grade passback request
      const request: LtiGradePassbackRequest = {
        userId,
        grade: moodleGrade,
        gradingProgress: 'FullyGraded',
        activityProgress: 'Completed',
        timestamp: Math.floor(Date.now() / 1000),
      };

      try {
        await executeWithRetry(
          async () => {
            // Cancel any outgoing refetches to prevent overwriting optimistic update
            await queryClient.cancelQueries({ queryKey: ltiQueryKeys.toolGrades(ltiId) });

            // Snapshot the previous value for rollback
            const previousGrades = queryClient.getQueryData<LtiGradesResponse>(
              ltiQueryKeys.toolGrades(ltiId)
            );

            // Optimistically update the cache
            if (previousGrades) {
              const now = Math.floor(Date.now() / 1000);
              const updatedGrades = previousGrades.grades.map((gradeResult) => {
                if (gradeResult.userid === userId) {
                  return {
                    ...gradeResult,
                    gradepercent: moodleGrade,
                    dateupdated: now,
                  };
                }
                return gradeResult;
              });

              queryClient.setQueryData<LtiGradesResponse>(ltiQueryKeys.toolGrades(ltiId), {
                ...previousGrades,
                grades: updatedGrades,
              });
            }

            // Execute the mutation
            const result = await gradePassbackMutation.mutateAsync({
              ltiId,
              request,
            });

            // Update last synced grade ref
            lastSyncedGradeRef.current = grade;

            // Callback on success
            if (result.gradeResult) {
              onSuccess?.(result.gradeResult);
            }

            // Invalidate queries to ensure consistency
            await queryClient.invalidateQueries({ queryKey: ltiQueryKeys.toolGrades(ltiId) });
            await queryClient.invalidateQueries({ queryKey: ['gradebook'] });

            return result;
          },
          'replace',
          grade
        );
      } catch (error) {
        // Rollback optimistic update on error
        await queryClient.invalidateQueries({ queryKey: ltiQueryKeys.toolGrades(ltiId) });

        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err);
        throw err;
      }
    },
    [
      hasGradePermission,
      denormalizeGrade,
      userId,
      ltiId,
      executeWithRetry,
      queryClient,
      gradePassbackMutation,
      onSuccess,
      onError,
    ]
  );

  /**
   * Read the current grade from the external LTI tool provider
   *
   * Implements readResult operation from LTI Basic Outcomes.
   */
  const readGrade = useCallback(async (): Promise<number | null> => {
    // Validate permissions
    if (!hasGradePermission()) {
      const permError = new Error('You do not have permission to read grades');
      onError?.(permError);
      throw permError;
    }

    try {
      const result = await executeWithRetry(
        async () => {
          // Fetch the grades from the API
          const gradesData = await queryClient.fetchQuery({
            queryKey: ltiQueryKeys.toolGrades(ltiId),
            queryFn: async () => {
              // Import the fetch function dynamically to avoid circular dependencies
              const { fetchLtiGrades } = await import('@/features/activities/lti/api/ltiApi');
              return fetchLtiGrades(ltiId);
            },
            staleTime: 0, // Always fetch fresh data
          });

          // Find the grade for the specified user
          const userGrade = gradesData.grades.find((g) => g.userid === userId);

          if (userGrade) {
            // Convert Moodle percentage to LTI scale
            return normalizeGrade(userGrade.gradepercent);
          }

          return null;
        },
        'read',
        0
      );

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    }
  }, [hasGradePermission, executeWithRetry, queryClient, ltiId, userId, normalizeGrade, onError]);

  /**
   * Delete the grade from the external LTI tool provider
   *
   * Implements deleteResult operation from LTI Basic Outcomes.
   */
  const deleteGrade = useCallback(async (): Promise<void> => {
    // Validate permissions
    if (!hasGradePermission()) {
      const permError = new Error('You do not have permission to delete grades');
      onError?.(permError);
      throw permError;
    }

    try {
      await executeWithRetry(
        async () => {
          // Build the grade passback request with null grade to delete
          const request: LtiGradePassbackRequest = {
            userId,
            grade: -1, // Negative grade indicates deletion
            gradingProgress: 'NotReady',
            activityProgress: 'Initialized',
            timestamp: Math.floor(Date.now() / 1000),
          };

          // Cancel any outgoing refetches
          await queryClient.cancelQueries({ queryKey: ltiQueryKeys.toolGrades(ltiId) });

          // Optimistically remove from cache
          const previousGrades = queryClient.getQueryData<LtiGradesResponse>(
            ltiQueryKeys.toolGrades(ltiId)
          );

          if (previousGrades) {
            const updatedGrades = previousGrades.grades.filter(
              (g) => g.userid !== userId
            );

            queryClient.setQueryData<LtiGradesResponse>(ltiQueryKeys.toolGrades(ltiId), {
              ...previousGrades,
              grades: updatedGrades,
            });
          }

          // Execute the mutation
          await gradePassbackMutation.mutateAsync({
            ltiId,
            request,
          });

          // Clear last synced grade ref
          lastSyncedGradeRef.current = null;

          // Invalidate queries
          await queryClient.invalidateQueries({ queryKey: ltiQueryKeys.toolGrades(ltiId) });
          await queryClient.invalidateQueries({ queryKey: ['gradebook'] });
        },
        'delete',
        0
      );
    } catch (error) {
      // Rollback optimistic update on error
      await queryClient.invalidateQueries({ queryKey: ltiQueryKeys.toolGrades(ltiId) });

      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    }
  }, [hasGradePermission, userId, executeWithRetry, queryClient, ltiId, gradePassbackMutation, onError]);

  // ============================================================================
  // Auto-Sync Effect (Optional)
  // ============================================================================

  // Note: Auto-sync is intentionally not implemented with useEffect watching grade
  // changes because grades typically come from user input that should be explicitly
  // submitted. The autoSync option is reserved for future implementation if needed.
  // Instead, components should call syncGrade() explicitly after grade changes.

  // ============================================================================
  // Computed State
  // ============================================================================

  // Determine if any sync operation is in progress
  const isSyncing =
    gradePassbackMutation.isPending ||
    syncStatus === 'syncing' ||
    syncStatus === 'retrying';

  // Get the current error
  const error = gradePassbackMutation.error ?? null;

  // ============================================================================
  // Return Hook Result
  // ============================================================================

  return {
    syncGrade,
    readGrade,
    deleteGrade,
    isSyncing,
    error,
    syncHistory,
    retryCount,
    normalizeGrade,
    denormalizeGrade,
    isRetryableError,
    getGradeSyncStatus,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default useLTIGradeSync;
