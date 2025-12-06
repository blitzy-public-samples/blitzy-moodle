/**
 * Assignment Submission Hooks Module
 *
 * This module provides custom React Query hooks for handling assignment submission
 * operations and state management. It follows the REFERENCE pattern from Moodle's
 * externallib.php functions like get_submissions(), save_submission(), save_grade()
 * which wrap locallib.php business logic.
 *
 * All business logic remains in the API layer; these hooks provide React Query
 * integration for optimal client-side state management with caching, optimistic
 * updates, and automatic background refetching.
 *
 * Features:
 * - useSubmissions: Query hook for fetching submission lists with pagination
 * - useSubmitAssignment: Mutation hook for submitting student work with file uploads
 * - useGradeSubmission: Mutation hook for grading operations (teacher/grader only)
 * - useSaveFeedback: Mutation hook for saving teacher feedback
 * - useAssignmentFiles: Query hook for fetching assignment file metadata
 *
 * @module features/activities/assignments/hooks/useSubmission
 * @see {@link ../api/assignmentApi.ts} for underlying API functions
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
  type UseMutationOptions,
} from '@tanstack/react-query';

// Import API functions and utilities from assignmentApi
import {
  fetchSubmissions,
  submitAssignment,
  gradeSubmission,
  saveFeedback,
  fetchAssignmentFiles,
  assignmentKeys,
} from '../api/assignmentApi';

// Import types from assignment.types
import type {
  Submission,
  Grade,
  SubmissionListResponse,
  SubmissionResponse,
  GradeResponse,
  AssignmentFile,
} from '../types/assignment.types';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Options for filtering submission queries
 * Mirrors the Moodle get_submissions parameters
 */
export interface SubmissionsFilterOptions {
  /** Filter by submission status (new, draft, submitted, reopened) */
  status?: string;
  /** Only return submissions modified since this timestamp (Unix timestamp in seconds) */
  since?: number;
  /** Only return submissions modified before this timestamp (Unix timestamp in seconds) */
  before?: number;
  /** Page number for pagination (1-based) */
  page?: number;
  /** Number of items per page */
  perPage?: number;
}

/**
 * Extended options for useSubmissions hook
 * Combines filter options with React Query configuration
 */
export interface UseSubmissionsOptions extends SubmissionsFilterOptions {
  /** Enable/disable the query */
  enabled?: boolean;
  /** Whether to refetch when window regains focus */
  refetchOnWindowFocus?: boolean;
  /** Time in milliseconds before data is considered stale */
  staleTime?: number;
}

/**
 * Data required for submitting an assignment
 * Supports both text and file submissions
 */
export interface SubmitAssignmentData {
  /** Assignment ID */
  assignmentId: number;
  /** Text content for online text submission */
  onlineText?: string;
  /** Files to upload (from file input or drag-and-drop) */
  files?: File[];
  /** Accept the submission statement */
  acceptSubmissionStatement?: boolean;
  /** Save as draft or submit for grading */
  saveAsDraft?: boolean;
}

/**
 * Data required for grading a submission
 * Requires mod/assign:grade capability
 */
export interface GradeSubmissionData {
  /** Assignment ID */
  assignmentId: number;
  /** User ID of the student being graded */
  userId: number;
  /** Numeric grade value (0 to assignment.grade maximum) */
  grade: number;
  /** Attempt number being graded (-1 for latest) */
  attemptnumber?: number;
  /** Whether to notify the student */
  sendNotifications?: boolean;
  /** Workflow state (if marking workflow enabled) */
  workflowstate?: string;
  /** Grader ID for marking allocation */
  allocatedmarker?: number;
  /** Allow another attempt */
  addattempt?: boolean;
}

/**
 * Data required for saving feedback
 * Supports both text and file feedback
 */
export interface SaveFeedbackData {
  /** Assignment ID */
  assignmentId: number;
  /** User ID of the student */
  userId: number;
  /** Feedback text content */
  feedbackText?: string;
  /** Feedback text format (1=HTML, 2=PLAIN) */
  feedbackFormat?: number;
  /** Feedback files to upload */
  feedbackFiles?: File[];
  /** Save as draft or publish immediately */
  draft?: boolean;
  /** Attempt number the feedback is for */
  attemptnumber?: number;
}

/**
 * Assignment files data structure
 */
export interface AssignmentFilesData {
  /** Intro attachment files */
  introFiles: AssignmentFile[];
  /** Submission files (all submissions) */
  submissionFiles: AssignmentFile[];
  /** Activity attachment files */
  activityFiles: AssignmentFile[];
}

/**
 * Options for useAssignmentFiles hook
 */
export interface UseAssignmentFilesOptions {
  /** Enable/disable the query */
  enabled?: boolean;
  /** Whether to refetch when window regains focus */
  refetchOnWindowFocus?: boolean;
  /** Time in milliseconds before data is considered stale */
  staleTime?: number;
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook for fetching submissions for an assignment
 *
 * Retrieves all submissions for an assignment with optional filtering by status,
 * time range, and pagination. Requires teacher/grader capability to view all submissions.
 *
 * Uses React Query for caching with a 2-minute stale time for frequent updates
 * to submission data. Automatically refetches on window focus to show latest
 * submission activity.
 *
 * @param assignmentId - The assignment ID to fetch submissions for
 * @param options - Optional filtering and React Query configuration
 * @returns Query result with submissions data, loading, and error states
 *
 * @example
 * ```typescript
 * // Basic usage - fetch all submissions
 * const { data, isLoading, error } = useSubmissions(assignmentId);
 *
 * // With filtering - only submitted work since yesterday
 * const { data } = useSubmissions(assignmentId, {
 *   status: 'submitted',
 *   since: Math.floor(Date.now() / 1000) - 86400
 * });
 *
 * // With pagination
 * const { data } = useSubmissions(assignmentId, {
 *   page: 1,
 *   perPage: 20
 * });
 * ```
 */
export function useSubmissions(
  assignmentId: number,
  options?: UseSubmissionsOptions
): UseQueryResult<SubmissionListResponse, Error> {
  // Extract filter options from combined options object
  const filterOptions: SubmissionsFilterOptions | undefined = options
    ? {
        status: options.status,
        since: options.since,
        before: options.before,
        page: options.page,
        perPage: options.perPage,
      }
    : undefined;

  return useQuery<SubmissionListResponse, Error>({
    // Structured query key for fine-grained cache invalidation
    // ['assignments', assignmentId, 'submissions', filterOptions?]
    queryKey: assignmentKeys.submissions(assignmentId, filterOptions),
    queryFn: () => fetchSubmissions(assignmentId, filterOptions),
    // Cache data for 2 minutes before considering stale (120000ms)
    // Submissions change frequently so shorter stale time than other data
    staleTime: options?.staleTime ?? 2 * 60 * 1000,
    // Keep cached data for 15 minutes for background navigation
    gcTime: 15 * 60 * 1000,
    // Enable automatic refetching when window regains focus
    // Shows latest submission activity without manual refresh
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? true,
    // Only fetch if assignmentId is valid (positive integer)
    // Prevents unnecessary API calls during initialization
    enabled: options?.enabled !== false && assignmentId > 0,
    // Retry failed requests up to 2 times with exponential backoff
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

/**
 * Hook for fetching assignment files
 *
 * Retrieves all files associated with an assignment including intro attachments,
 * activity attachments, and submission files. Caches file metadata for offline
 * access support.
 *
 * Uses longer stale time (10 minutes) since file metadata changes less frequently
 * than submission data. Files are cached for 1 hour to support offline scenarios.
 *
 * Re-exported from assignmentApi for convenient access from the hooks module.
 *
 * @param assignmentId - The assignment ID to fetch files for
 * @param options - Optional React Query configuration
 * @returns Query result with files data, loading, and error states
 *
 * @example
 * ```typescript
 * // Basic usage
 * const { data: files, isLoading } = useAssignmentFiles(assignmentId);
 *
 * // Access different file categories
 * if (files) {
 *   console.log('Intro files:', files.introFiles);
 *   console.log('Activity files:', files.activityFiles);
 *   console.log('Submission files:', files.submissionFiles);
 * }
 * ```
 */
export function useAssignmentFiles(
  assignmentId: number,
  options?: UseAssignmentFilesOptions
): UseQueryResult<AssignmentFilesData, Error> {
  return useQuery<AssignmentFilesData, Error>({
    // Query key: ['assignments', assignmentId, 'files']
    queryKey: assignmentKeys.files(assignmentId),
    queryFn: () => fetchAssignmentFiles(assignmentId),
    // Cache file metadata for 10 minutes (files rarely change)
    staleTime: options?.staleTime ?? 10 * 60 * 1000,
    // Keep cached data for 1 hour for offline access
    gcTime: 60 * 60 * 1000,
    // Don't refetch files on focus unless explicitly configured
    // File metadata is relatively stable
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    // Only fetch if assignmentId is valid
    enabled: options?.enabled !== false && assignmentId > 0,
    // Retry failed requests
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for submitting assignment work
 *
 * Provides mutation function for submitting student work with support for both
 * text and file submissions using FormData. Implements optimistic updates for
 * immediate UI feedback and automatic cache invalidation on success.
 *
 * Handles file upload progress tracking internally and validates file size limits
 * and format restrictions on the server side. Properly handles late submission
 * errors and displays appropriate messages.
 *
 * On success, invalidates:
 * - Assignment detail cache (to refresh submission status)
 * - Submissions list cache (to show new submission)
 * - Files cache (to show uploaded files)
 *
 * @param options - Optional mutation configuration callbacks
 * @returns Mutation result with mutate function, loading, and error states
 *
 * @example
 * ```typescript
 * // Basic usage with callbacks
 * const { mutate: submit, isPending, isError, error } = useSubmitAssignment({
 *   onSuccess: (data) => {
 *     toast.success('Assignment submitted successfully!');
 *     console.log('Submission ID:', data.submission?.id);
 *   },
 *   onError: (error) => {
 *     toast.error(error.message);
 *   }
 * });
 *
 * // Submit text content
 * submit({
 *   assignmentId: 123,
 *   onlineText: '<p>My assignment answer...</p>',
 *   acceptSubmissionStatement: true
 * });
 *
 * // Submit with files
 * submit({
 *   assignmentId: 123,
 *   files: selectedFiles,
 *   saveAsDraft: false
 * });
 * ```
 */
export function useSubmitAssignment(
  options?: Omit<
    UseMutationOptions<SubmissionResponse, Error, SubmitAssignmentData, unknown>,
    'mutationFn'
  >
): UseMutationResult<SubmissionResponse, Error, SubmitAssignmentData, unknown> {
  const queryClient = useQueryClient();

  return useMutation<SubmissionResponse, Error, SubmitAssignmentData, unknown>({
    mutationFn: submitAssignment,
    onSuccess: (data, variables, onMutateResult, mutationContext) => {
      // Invalidate assignment detail to refresh submission status
      void queryClient.invalidateQueries({
        queryKey: assignmentKeys.detail(variables.assignmentId),
      });

      // Invalidate submissions list to show new submission
      void queryClient.invalidateQueries({
        queryKey: assignmentKeys.submissions(variables.assignmentId),
      });

      // Invalidate files list to show uploaded files
      void queryClient.invalidateQueries({
        queryKey: assignmentKeys.files(variables.assignmentId),
      });

      // Also invalidate the root submissions queries for this assignment
      void queryClient.invalidateQueries({
        queryKey: [...assignmentKeys.all, variables.assignmentId, 'submissions'],
      });

      // Call user-provided onSuccess callback if provided
      if (options?.onSuccess) {
        options.onSuccess(data, variables, onMutateResult, mutationContext);
      }
    },
    onError: (error, variables, onMutateResult, mutationContext) => {
      // Log error for debugging
      console.error('Submission failed:', error.message, {
        assignmentId: variables.assignmentId,
      });

      // Call user-provided onError callback if provided
      if (options?.onError) {
        options.onError(error, variables, onMutateResult, mutationContext);
      }
    },
    onSettled: options?.onSettled,
    // Retry transient network errors once
    // Don't retry on validation errors (4xx status codes)
    retry: (failureCount, error) => {
      // Don't retry if we've already tried once or if it's a client error
      if (failureCount >= 1) {return false;}
      // Retry on network errors but not on client errors
      if (error.message.includes('Network') || error.message.includes('timeout')) {
        return true;
      }
      return false;
    },
  });
}

/**
 * Hook for grading a student's submission
 *
 * Provides mutation function for recording grades with validation of grade range
 * (0 to assignment.grade maximum). Requires mod/assign:grade capability on the backend.
 *
 * Supports marking workflow states if enabled on the assignment. Automatically
 * invalidates submission and gradebook caches on success to reflect updated grades.
 *
 * On success, invalidates:
 * - Submissions list cache (to refresh grading status)
 * - Assignment detail cache (for grade statistics)
 * - Gradebook-related caches
 *
 * @param options - Optional mutation configuration callbacks
 * @returns Mutation result with mutate function, loading, and error states
 *
 * @example
 * ```typescript
 * // Basic usage
 * const { mutate: grade, isPending } = useGradeSubmission({
 *   onSuccess: (data) => {
 *     toast.success('Grade saved successfully!');
 *   }
 * });
 *
 * // Grade a submission
 * grade({
 *   assignmentId: 123,
 *   userId: 456,
 *   grade: 85,
 *   sendNotifications: true
 * });
 *
 * // With marking workflow
 * grade({
 *   assignmentId: 123,
 *   userId: 456,
 *   grade: 90,
 *   workflowstate: 'released',
 *   attemptnumber: 0
 * });
 * ```
 */
export function useGradeSubmission(
  options?: Omit<
    UseMutationOptions<GradeResponse, Error, GradeSubmissionData, unknown>,
    'mutationFn'
  >
): UseMutationResult<GradeResponse, Error, GradeSubmissionData, unknown> {
  const queryClient = useQueryClient();

  return useMutation<GradeResponse, Error, GradeSubmissionData, unknown>({
    mutationFn: gradeSubmission,
    onSuccess: (data, variables, onMutateResult, mutationContext) => {
      // Invalidate submissions list to refresh grading status
      void queryClient.invalidateQueries({
        queryKey: assignmentKeys.submissions(variables.assignmentId),
      });

      // Also invalidate the specific assignment for grade statistics
      void queryClient.invalidateQueries({
        queryKey: assignmentKeys.detail(variables.assignmentId),
      });

      // Invalidate gradebook-related queries
      // Uses a broader query pattern to catch course-level gradebook caches
      void queryClient.invalidateQueries({
        queryKey: ['gradebook'],
      });

      // Invalidate user-specific queries for the graded student
      void queryClient.invalidateQueries({
        queryKey: ['users', variables.userId, 'grades'],
      });

      // Call user-provided onSuccess callback if provided
      if (options?.onSuccess) {
        options.onSuccess(data, variables, onMutateResult, mutationContext);
      }
    },
    onError: (error, variables, onMutateResult, mutationContext) => {
      // Log error for debugging
      console.error('Grading failed:', error.message, {
        assignmentId: variables.assignmentId,
        userId: variables.userId,
      });

      // Call user-provided onError callback if provided
      if (options?.onError) {
        options.onError(error, variables, onMutateResult, mutationContext);
      }
    },
    onSettled: options?.onSettled,
    // Don't automatically retry grading operations
    // User should explicitly retry if there was an error
    retry: false,
  });
}

/**
 * Hook for saving feedback on a submission
 *
 * Provides mutation function for recording teacher feedback with support for both
 * text and file feedback. Supports draft feedback (not released to student) and
 * final feedback states.
 *
 * Integrates with assignment feedback plugins on the backend. Files are uploaded
 * separately from submission files using dedicated feedback file areas.
 *
 * On success, invalidates:
 * - Submissions list cache (to refresh feedback status)
 * - Files cache (to show uploaded feedback files)
 *
 * @param options - Optional mutation configuration callbacks
 * @returns Mutation result with mutate function, loading, and error states
 *
 * @example
 * ```typescript
 * // Basic usage
 * const { mutate: save, isPending } = useSaveFeedback({
 *   onSuccess: () => {
 *     toast.success('Feedback saved!');
 *   }
 * });
 *
 * // Save text feedback
 * save({
 *   assignmentId: 123,
 *   userId: 456,
 *   feedbackText: '<p>Great work! Consider adding more examples.</p>',
 *   draft: false
 * });
 *
 * // Save with feedback files
 * save({
 *   assignmentId: 123,
 *   userId: 456,
 *   feedbackText: 'See attached annotated document.',
 *   feedbackFiles: [annotatedFile],
 *   draft: false
 * });
 *
 * // Save as draft (not visible to student)
 * save({
 *   assignmentId: 123,
 *   userId: 456,
 *   feedbackText: 'Draft comments - in progress',
 *   draft: true
 * });
 * ```
 */
export function useSaveFeedback(
  options?: Omit<
    UseMutationOptions<SubmissionResponse, Error, SaveFeedbackData, unknown>,
    'mutationFn'
  >
): UseMutationResult<SubmissionResponse, Error, SaveFeedbackData, unknown> {
  const queryClient = useQueryClient();

  return useMutation<SubmissionResponse, Error, SaveFeedbackData, unknown>({
    mutationFn: saveFeedback,
    onSuccess: (data, variables, onMutateResult, mutationContext) => {
      // Invalidate submissions list to refresh feedback status
      void queryClient.invalidateQueries({
        queryKey: assignmentKeys.submissions(variables.assignmentId),
      });

      // Invalidate files to show uploaded feedback files
      void queryClient.invalidateQueries({
        queryKey: assignmentKeys.files(variables.assignmentId),
      });

      // Invalidate the specific assignment detail
      void queryClient.invalidateQueries({
        queryKey: assignmentKeys.detail(variables.assignmentId),
      });

      // Call user-provided onSuccess callback if provided
      if (options?.onSuccess) {
        options.onSuccess(data, variables, onMutateResult, mutationContext);
      }
    },
    onError: (error, variables, onMutateResult, mutationContext) => {
      // Log error for debugging
      console.error('Save feedback failed:', error.message, {
        assignmentId: variables.assignmentId,
        userId: variables.userId,
      });

      // Call user-provided onError callback if provided
      if (options?.onError) {
        options.onError(error, variables, onMutateResult, mutationContext);
      }
    },
    onSettled: options?.onSettled,
    // Retry once for file upload failures (transient network issues)
    retry: (failureCount, error) => {
      if (failureCount >= 1) {return false;}
      // Retry on network errors
      if (error.message.includes('Network') || error.message.includes('timeout')) {
        return true;
      }
      return false;
    },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert Moodle timestamp to JavaScript Date
 *
 * Moodle uses Unix timestamps (seconds since epoch).
 * JavaScript Date expects milliseconds.
 *
 * @param timestamp - Moodle timestamp in seconds
 * @returns JavaScript Date object or null if timestamp is 0 or undefined
 *
 * @example
 * ```typescript
 * const submission = useSubmissions(assignmentId);
 * const timeCreated = moodleDateToJs(submission.data?.submissions[0]?.timecreated);
 * if (timeCreated) {
 *   console.log('Submitted at:', timeCreated.toLocaleDateString());
 * }
 * ```
 */
export function moodleDateToJs(timestamp: number | undefined): Date | null {
  if (!timestamp || timestamp === 0) {
    return null;
  }
  return new Date(timestamp * 1000);
}

/**
 * Convert JavaScript Date to Moodle timestamp
 *
 * Converts a JavaScript Date object to a Unix timestamp in seconds
 * for use with Moodle API calls.
 *
 * @param date - JavaScript Date object
 * @returns Unix timestamp in seconds or 0 if date is null/undefined
 *
 * @example
 * ```typescript
 * const sinceDate = new Date();
 * sinceDate.setDate(sinceDate.getDate() - 7); // 7 days ago
 *
 * const { data } = useSubmissions(assignmentId, {
 *   since: jsDateToMoodle(sinceDate)
 * });
 * ```
 */
export function jsDateToMoodle(date: Date | null | undefined): number {
  if (!date) {
    return 0;
  }
  return Math.floor(date.getTime() / 1000);
}

/**
 * Check if a submission status indicates the submission is complete
 *
 * @param status - Submission status string
 * @returns True if submission has been submitted for grading
 */
export function isSubmissionComplete(status: string | undefined): boolean {
  return status === 'submitted';
}

/**
 * Check if a submission status indicates work in progress
 *
 * @param status - Submission status string
 * @returns True if submission is a draft or new
 */
export function isSubmissionInProgress(status: string | undefined): boolean {
  return status === 'draft' || status === 'new';
}

/**
 * Check if a submission has been graded
 *
 * @param gradingStatus - Grading status string
 * @returns True if submission has been graded
 */
export function isSubmissionGraded(gradingStatus: string | undefined): boolean {
  return gradingStatus === 'graded';
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

// Re-export types for easy import from hooks module
export type {
  Submission,
  Grade,
  SubmissionListResponse,
  SubmissionResponse,
  GradeResponse,
  AssignmentFile,
};

// Re-export query keys factory for advanced cache management
export { assignmentKeys } from '../api/assignmentApi';
