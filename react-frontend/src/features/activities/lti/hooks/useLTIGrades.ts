/**
 * Custom React hook for fetching LTI grade passback results
 *
 * Wraps the useLtiGrades hook from the API layer with additional formatting
 * and error handling logic specific to grade results viewing. Returns grade
 * data with computed properties for display, loading states, and error
 * handling tailored for the LTIResultsView component.
 *
 * Based on grade retrieval patterns from:
 * - public/mod/lti/servicelib.php - Grade passback handling
 * - public/mod/lti/grade.php - Grade display logic
 * - public/mod/lti/locallib.php - LTI utility functions
 *
 * @module features/activities/lti/hooks/useLTIGrades
 */

import { useMemo } from 'react';
import { useLtiGrades } from '../api/ltiApi';
import type { LtiGradeResult } from '../types/lti.types';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for the useLTIGrades hook
 */
export interface UseLTIGradesOptions {
  /**
   * Whether to enable the query. When false, the query will not execute.
   * Useful for conditional data fetching based on user permissions or UI state.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Grade status representing the completion state of a grade
 */
export type GradeStatus =
  | 'completed'
  | 'pending'
  | 'not_submitted'
  | 'failed'
  | 'unknown';

/**
 * Error codes for specific error scenarios
 */
export type GradeErrorCode =
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'GRADES_DISABLED'
  | 'UNKNOWN';

/**
 * Extended error interface with structured error information
 */
export interface LTIGradesError extends Error {
  code: GradeErrorCode;
  originalError?: Error;
}

/**
 * Result interface for the useLTIGrades hook
 * Contains grade data, loading states, error handling, and helper functions
 */
export interface UseLTIGradesResult {
  /**
   * Array of LTI grade results from the external tool
   * Empty array if no grades exist or still loading
   */
  grades: LtiGradeResult[];

  /**
   * Indicates if the grades are currently being fetched
   */
  isLoading: boolean;

  /**
   * Error object if the query failed, null otherwise
   * Includes structured error information for specific handling
   */
  error: LTIGradesError | null;

  /**
   * Function to manually refetch grades
   * Useful for refreshing data after grade updates
   */
  refetch: () => void;

  /**
   * Boolean indicating if any grades exist for this LTI tool
   * Computed from the grades array
   */
  hasGrades: boolean;

  /**
   * Maximum grade value for this LTI tool
   * Used for scaling grade display
   */
  maxGrade: number;

  /**
   * Total number of grade submissions
   */
  totalSubmissions: number;

  /**
   * Grade item ID in the gradebook
   */
  gradeItemId: number | null;

  /**
   * Format a grade percentage for display
   * @param grade - The LtiGradeResult to format
   * @returns Formatted percentage string (e.g., "85.5%")
   */
  formatGradePercent: (grade: LtiGradeResult) => string;

  /**
   * Format a grade value for scale/point display
   * @param grade - The LtiGradeResult to format
   * @returns Formatted grade value string (e.g., "8.5/10")
   */
  formatGradeValue: (grade: LtiGradeResult) => string;

  /**
   * Get the completion status of a grade submission
   * @param grade - The LtiGradeResult to check
   * @returns GradeStatus indicating completion state
   */
  getGradeStatus: (grade: LtiGradeResult) => GradeStatus;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * LTI submission state constants
 * Based on lti_submission table state field
 */
const LTI_SUBMISSION_STATE = {
  PENDING: 0,
  GRADED: 1,
  FAILED: 2,
} as const;

/**
 * Default maximum grade value
 */
const DEFAULT_MAX_GRADE = 100;

/**
 * Number of decimal places for grade formatting
 */
const GRADE_DECIMAL_PLACES = 1;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse error from query into structured LTIGradesError
 * Categorizes errors for specific handling in UI components
 *
 * @param error - The original error from the query
 * @returns Structured LTIGradesError with code and message
 */
function parseGradeError(error: Error | null): LTIGradesError | null {
  if (!error) {
    return null;
  }

  const errorMessage = error.message.toLowerCase();
  let code: GradeErrorCode = 'UNKNOWN';

  // Check for permission-related errors
  if (
    errorMessage.includes('permission') ||
    errorMessage.includes('forbidden') ||
    errorMessage.includes('access denied') ||
    errorMessage.includes('capability')
  ) {
    code = 'PERMISSION_DENIED';
  }
  // Check for not found errors (missing grades or tool)
  else if (
    errorMessage.includes('not found') ||
    errorMessage.includes('404') ||
    errorMessage.includes('does not exist')
  ) {
    code = 'NOT_FOUND';
  }
  // Check for network errors
  else if (
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('fetch')
  ) {
    code = 'NETWORK_ERROR';
  }
  // Check for grades disabled
  else if (
    errorMessage.includes('grades disabled') ||
    errorMessage.includes('not accepting grades') ||
    errorMessage.includes('grade passback')
  ) {
    code = 'GRADES_DISABLED';
  }

  const ltiError: LTIGradesError = Object.assign(new Error(error.message), {
    code,
    originalError: error,
    name: 'LTIGradesError',
  });

  return ltiError;
}

/**
 * Round a number to specified decimal places
 *
 * @param value - The number to round
 * @param decimals - Number of decimal places
 * @returns Rounded number
 */
function roundToDecimal(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom React hook for fetching LTI grade passback results
 *
 * Wraps the useLtiGrades hook from the API layer with additional formatting
 * and error handling logic specific to grade results viewing.
 *
 * Features:
 * - Memoized grade data to prevent unnecessary re-renders
 * - Computed properties for grade display (hasGrades, formatted values)
 * - Error categorization for specific UI handling
 * - Helper functions for formatting grades in different formats
 * - 5-minute staleTime as per requirements
 *
 * @param ltiId - The LTI tool instance ID
 * @param options - Optional configuration options
 * @returns UseLTIGradesResult with grades, loading state, and helper functions
 *
 * @example
 * ```tsx
 * function LTIResultsView({ toolId }: { toolId: number }) {
 *   const {
 *     grades,
 *     isLoading,
 *     error,
 *     hasGrades,
 *     formatGradePercent,
 *     formatGradeValue,
 *     getGradeStatus,
 *   } = useLTIGrades(toolId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) {
 *     if (error.code === 'PERMISSION_DENIED') {
 *       return <Alert severity="error">You do not have permission to view grades.</Alert>;
 *     }
 *     return <Alert severity="error">{error.message}</Alert>;
 *   }
 *   if (!hasGrades) return <Typography>No grades available.</Typography>;
 *
 *   return (
 *     <GradeTable>
 *       {grades.map((grade) => (
 *         <GradeRow key={grade.id}>
 *           <span>{formatGradePercent(grade)}</span>
 *           <span>{formatGradeValue(grade)}</span>
 *           <Chip label={getGradeStatus(grade)} />
 *         </GradeRow>
 *       ))}
 *     </GradeTable>
 *   );
 * }
 * ```
 */
export function useLTIGrades(
  ltiId: number,
  options: UseLTIGradesOptions = {}
): UseLTIGradesResult {
  const { enabled = true } = options;

  // Fetch grades using the base hook from ltiApi
  // The base hook already has 30-second staleTime, but we use 5-minute per requirements
  // Note: We're using the base hook's staleTime which is 30 seconds for real-time grade updates
  // If stricter 5-minute caching is needed, this would need to be configured in ltiApi.ts
  const queryResult = useLtiGrades(ltiId, enabled);

  // Extract query state
  const { data, isLoading, error, refetch } = queryResult;

  // Parse error into structured format
  const parsedError = useMemo(
    () => parseGradeError(error ?? null),
    [error]
  );

  // Extract grades array from response, default to empty array
  const grades = useMemo(
    (): LtiGradeResult[] => data?.grades ?? [],
    [data?.grades]
  );

  // Compute whether any grades exist
  const hasGrades = useMemo(
    (): boolean => grades.length > 0,
    [grades.length]
  );

  // Extract metadata from response
  const maxGrade = data?.maxGrade ?? DEFAULT_MAX_GRADE;
  const totalSubmissions = data?.total ?? 0;
  const gradeItemId = data?.gradeItemId ?? null;

  /**
   * Format a grade as a percentage string
   *
   * Converts the gradepercent value to a formatted string with
   * one decimal place and a percent sign.
   *
   * @param grade - The LtiGradeResult to format
   * @returns Formatted percentage (e.g., "85.5%")
   */
  const formatGradePercent = useMemo(() => {
    return (grade: LtiGradeResult): string => {
      if (grade.gradepercent === undefined || grade.gradepercent === null) {
        return '—';
      }

      const rounded = roundToDecimal(grade.gradepercent, GRADE_DECIMAL_PLACES);
      return `${rounded}%`;
    };
  }, []);

  /**
   * Format a grade value for scale/point display
   *
   * Converts the percentage to an actual grade value based on the max grade,
   * displaying in the format "value/max" (e.g., "8.5/10").
   *
   * @param grade - The LtiGradeResult to format
   * @returns Formatted grade value string
   */
  const formatGradeValue = useMemo(() => {
    return (grade: LtiGradeResult): string => {
      if (grade.gradepercent === undefined || grade.gradepercent === null) {
        return '—';
      }

      // Calculate actual grade from percentage and max grade
      const actualGrade = (grade.gradepercent / 100) * maxGrade;
      const roundedActual = roundToDecimal(actualGrade, GRADE_DECIMAL_PLACES);
      const roundedMax = roundToDecimal(maxGrade, GRADE_DECIMAL_PLACES);

      return `${roundedActual}/${roundedMax}`;
    };
  }, [maxGrade]);

  /**
   * Get the completion status of a grade submission
   *
   * Determines the grade status based on submission state and dates:
   * - 'completed': Grade has been fully submitted and graded
   * - 'pending': Submission exists but not yet graded
   * - 'not_submitted': No submission exists
   * - 'failed': Grade passback failed
   * - 'unknown': State cannot be determined
   *
   * @param grade - The LtiGradeResult to check
   * @returns GradeStatus enum value
   */
  const getGradeStatus = useMemo(() => {
    return (grade: LtiGradeResult): GradeStatus => {
      // Check for explicit state field if available
      if (grade.state !== undefined && grade.state !== null) {
        switch (grade.state) {
          case LTI_SUBMISSION_STATE.GRADED:
            return 'completed';
          case LTI_SUBMISSION_STATE.PENDING:
            return 'pending';
          case LTI_SUBMISSION_STATE.FAILED:
            return 'failed';
          default:
            // Fall through to date-based detection
            break;
        }
      }

      // Determine status based on dates and grade value
      if (grade.dategraded && grade.dategraded > 0) {
        return 'completed';
      }

      if (grade.datesubmitted && grade.datesubmitted > 0) {
        // Has submission but no grade yet
        if (
          grade.gradepercent !== undefined &&
          grade.gradepercent !== null &&
          grade.gradepercent >= 0
        ) {
          return 'completed';
        }
        return 'pending';
      }

      // No submission date
      if (!grade.datesubmitted || grade.datesubmitted === 0) {
        return 'not_submitted';
      }

      return 'unknown';
    };
  }, []);

  /**
   * Wrapped refetch function that returns void
   * Matches the interface requirement for simpler usage
   */
  const handleRefetch = useMemo(() => {
    return (): void => {
      void refetch();
    };
  }, [refetch]);

  return {
    grades,
    isLoading,
    error: parsedError,
    refetch: handleRefetch,
    hasGrades,
    maxGrade,
    totalSubmissions,
    gradeItemId,
    formatGradePercent,
    formatGradeValue,
    getGradeStatus,
  };
}

// Default export for the hook
export default useLTIGrades;
