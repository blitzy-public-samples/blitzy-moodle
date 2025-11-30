/**
 * Assignment API Integration Module
 *
 * This module provides React Query hooks and API functions for all assignment-related
 * operations including fetching assignment details, submitting work, grading, feedback,
 * and file management.
 *
 * All hooks use React Query for caching, automatic refetching, optimistic updates,
 * and error handling. API calls target RESTful endpoints at /api/v1/assignments/*
 * and integrate with the shared API client for JWT authentication.
 *
 * Features:
 * - Type-safe data access with TypeScript interfaces
 * - Automatic caching and background refetching
 * - Optimistic updates for immediate UI feedback
 * - Proper error handling with user-friendly messages
 * - File upload support with FormData
 * - Query key management for cache invalidation
 *
 * @module features/activities/assignments/api
 */

import { useQuery, useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { ASSIGNMENT_ENDPOINTS } from '@/services/api/endpoints';
import type {
  Assignment,
  AssignmentFile,
  SubmissionResponse,
  GradeResponse,
  SubmissionListResponse,
} from '../types/assignment.types';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Standard API response envelope from Moodle backend
 * All API responses are wrapped in this structure
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Options for filtering submission queries
 */
interface SubmissionsFilterOptions {
  /** Filter by submission status (new, draft, submitted, reopened) */
  status?: string;
  /** Only return submissions modified since this timestamp */
  since?: number;
  /** Only return submissions modified before this timestamp */
  before?: number;
  /** Page number for pagination (1-based) */
  page?: number;
  /** Number of items per page */
  perPage?: number;
}

/**
 * Data required for submitting an assignment
 */
interface SubmitAssignmentData {
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
 */
interface GradeSubmissionData {
  /** Assignment ID */
  assignmentId: number;
  /** User ID of the student being graded */
  userId: number;
  /** Numeric grade value */
  grade: number;
  /** Attempt number being graded */
  attemptnumber?: number;
  /** Whether to notify the student */
  sendNotifications?: boolean;
  /** Workflow state (if marking workflow enabled) */
  workflowstate?: string;
  /** Grader ID for marking allocation */
  allocatedmarker?: number;
  /** Add to grade override if exists */
  addattempt?: boolean;
}

/**
 * Data required for saving feedback
 */
interface SaveFeedbackData {
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
 * Query result with assignment files data
 */
interface AssignmentFilesData {
  /** Intro attachment files */
  introFiles: AssignmentFile[];
  /** Submission files (all submissions) */
  submissionFiles: AssignmentFile[];
  /** Activity attachment files */
  activityFiles: AssignmentFile[];
}

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Query key factory for assignment-related queries
 *
 * Following React Query best practices for structured query keys.
 * Keys are organized hierarchically to enable fine-grained cache invalidation.
 *
 * Usage:
 * - Invalidate all assignments: queryClient.invalidateQueries({ queryKey: assignmentKeys.all })
 * - Invalidate single assignment: queryClient.invalidateQueries({ queryKey: assignmentKeys.detail(id) })
 * - Invalidate submissions for assignment: queryClient.invalidateQueries({ queryKey: assignmentKeys.submissions(id) })
 */
export const assignmentKeys = {
  /** Root key for all assignment queries */
  all: ['assignments'] as const,
  /** Key for assignment list queries */
  lists: () => [...assignmentKeys.all, 'list'] as const,
  /** Key for filtered assignment list */
  list: (filters: Record<string, unknown>) => [...assignmentKeys.lists(), filters] as const,
  /** Key for single assignment detail queries */
  details: () => [...assignmentKeys.all, 'detail'] as const,
  /** Key for specific assignment detail */
  detail: (id: number) => [...assignmentKeys.details(), id] as const,
  /** Key for submissions list queries */
  submissionsAll: () => [...assignmentKeys.all, 'submissions'] as const,
  /** Key for submissions of specific assignment */
  submissions: (id: number, filters?: SubmissionsFilterOptions) =>
    filters
      ? ([...assignmentKeys.submissionsAll(), id, filters] as const)
      : ([...assignmentKeys.submissionsAll(), id] as const),
  /** Key for assignment files queries */
  filesAll: () => [...assignmentKeys.all, 'files'] as const,
  /** Key for files of specific assignment */
  files: (id: number) => [...assignmentKeys.filesAll(), id] as const,
} as const;

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch assignment details by ID
 *
 * Retrieves complete assignment information including name, description,
 * due dates, grade settings, submission settings, and file attachments.
 *
 * @param assignmentId - The assignment ID to fetch
 * @returns Promise resolving to the assignment object
 * @throws Error if assignment not found or user lacks permission
 *
 * @example
 * ```typescript
 * const assignment = await fetchAssignment(123);
 * console.log(assignment.name, assignment.duedate);
 * ```
 */
export async function fetchAssignment(assignmentId: number): Promise<Assignment> {
  const response = await apiClient.get<ApiResponse<Assignment>>(
    ASSIGNMENT_ENDPOINTS.DETAIL(assignmentId)
  );
  return response.data.data;
}

/**
 * Fetch submissions for an assignment
 *
 * Retrieves all submissions for an assignment with optional filtering.
 * Requires teacher/grader capability to view all submissions.
 *
 * @param assignmentId - The assignment ID to fetch submissions for
 * @param options - Optional filtering parameters
 * @returns Promise resolving to submission list response with pagination info
 * @throws Error if user lacks permission to view submissions
 *
 * @example
 * ```typescript
 * // Get all submissions
 * const response = await fetchSubmissions(123);
 *
 * // Get only submitted work since yesterday
 * const filtered = await fetchSubmissions(123, {
 *   status: 'submitted',
 *   since: Math.floor(Date.now() / 1000) - 86400
 * });
 * ```
 */
export async function fetchSubmissions(
  assignmentId: number,
  options?: SubmissionsFilterOptions
): Promise<SubmissionListResponse> {
  const params = new URLSearchParams();

  if (options?.status) {
    params.append('status', options.status);
  }
  if (options?.since !== undefined) {
    params.append('since', options.since.toString());
  }
  if (options?.before !== undefined) {
    params.append('before', options.before.toString());
  }
  if (options?.page !== undefined) {
    params.append('page', options.page.toString());
  }
  if (options?.perPage !== undefined) {
    params.append('perPage', options.perPage.toString());
  }

  const queryString = params.toString();
  const url = `${ASSIGNMENT_ENDPOINTS.SUBMISSIONS(assignmentId)}${queryString ? `?${queryString}` : ''}`;

  const response = await apiClient.get<ApiResponse<SubmissionListResponse>>(url);
  return response.data.data;
}

/**
 * Submit assignment work
 *
 * Submits student work for an assignment, supporting both text and file submissions.
 * Files are uploaded using multipart/form-data.
 *
 * @param data - Submission data including assignment ID, content, and files
 * @returns Promise resolving to submission response with confirmation
 * @throws Error if submission not allowed or validation fails
 *
 * @example
 * ```typescript
 * // Text submission
 * const result = await submitAssignment({
 *   assignmentId: 123,
 *   onlineText: '<p>My assignment answer...</p>',
 *   acceptSubmissionStatement: true
 * });
 *
 * // File submission
 * const fileResult = await submitAssignment({
 *   assignmentId: 123,
 *   files: [selectedFile],
 *   saveAsDraft: false
 * });
 * ```
 */
export async function submitAssignment(data: SubmitAssignmentData): Promise<SubmissionResponse> {
  const formData = new FormData();

  // Add text content if provided
  if (data.onlineText !== undefined) {
    formData.append('onlinetext', data.onlineText);
    formData.append('onlinetextformat', '1'); // HTML format
  }

  // Add files if provided
  if (data.files && data.files.length > 0) {
    data.files.forEach((file, index) => {
      formData.append(`files[${index}]`, file, file.name);
    });
  }

  // Add submission options
  if (data.acceptSubmissionStatement !== undefined) {
    formData.append('submissionstatement', data.acceptSubmissionStatement ? '1' : '0');
  }

  if (data.saveAsDraft !== undefined) {
    formData.append('saveasdraft', data.saveAsDraft ? '1' : '0');
  }

  const response = await apiClient.post<ApiResponse<SubmissionResponse>>(
    ASSIGNMENT_ENDPOINTS.SUBMIT(data.assignmentId),
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      // Longer timeout for file uploads
      timeout: 120000,
    }
  );

  return response.data.data;
}

/**
 * Grade a student's submission
 *
 * Records a grade for a student's assignment submission.
 * Requires teacher/grader capability.
 *
 * @param data - Grading data including assignment ID, user ID, and grade
 * @returns Promise resolving to grade response with updated grade object
 * @throws Error if grading not allowed or validation fails
 *
 * @example
 * ```typescript
 * const result = await gradeSubmission({
 *   assignmentId: 123,
 *   userId: 456,
 *   grade: 85,
 *   sendNotifications: true,
 *   workflowstate: 'released'
 * });
 * ```
 */
export async function gradeSubmission(data: GradeSubmissionData): Promise<GradeResponse> {
  const payload: Record<string, unknown> = {
    userid: data.userId,
    grade: data.grade,
  };

  if (data.attemptnumber !== undefined) {
    payload.attemptnumber = data.attemptnumber;
  }

  if (data.sendNotifications !== undefined) {
    payload.sendnotifications = data.sendNotifications;
  }

  if (data.workflowstate !== undefined) {
    payload.workflowstate = data.workflowstate;
  }

  if (data.allocatedmarker !== undefined) {
    payload.allocatedmarker = data.allocatedmarker;
  }

  if (data.addattempt !== undefined) {
    payload.addattempt = data.addattempt;
  }

  const response = await apiClient.post<ApiResponse<GradeResponse>>(
    ASSIGNMENT_ENDPOINTS.GRADE(data.assignmentId),
    payload
  );

  return response.data.data;
}

/**
 * Save feedback for a student's submission
 *
 * Records feedback for a student's assignment submission.
 * Supports both text and file feedback.
 *
 * @param data - Feedback data including assignment ID, user ID, and content
 * @returns Promise resolving to submission response
 * @throws Error if saving feedback fails
 *
 * @example
 * ```typescript
 * const result = await saveFeedback({
 *   assignmentId: 123,
 *   userId: 456,
 *   feedbackText: '<p>Great work! Consider adding more examples.</p>',
 *   draft: false
 * });
 * ```
 */
export async function saveFeedback(data: SaveFeedbackData): Promise<SubmissionResponse> {
  const formData = new FormData();

  formData.append('userid', data.userId.toString());

  // Add feedback text if provided
  if (data.feedbackText !== undefined) {
    formData.append('feedbackcomments', data.feedbackText);
    formData.append('feedbackformat', (data.feedbackFormat ?? 1).toString());
  }

  // Add feedback files if provided
  if (data.feedbackFiles && data.feedbackFiles.length > 0) {
    data.feedbackFiles.forEach((file, index) => {
      formData.append(`feedbackfiles[${index}]`, file, file.name);
    });
  }

  // Add draft flag
  if (data.draft !== undefined) {
    formData.append('draft', data.draft ? '1' : '0');
  }

  // Add attempt number if specified
  if (data.attemptnumber !== undefined) {
    formData.append('attemptnumber', data.attemptnumber.toString());
  }

  const response = await apiClient.post<ApiResponse<SubmissionResponse>>(
    ASSIGNMENT_ENDPOINTS.FEEDBACK(data.assignmentId),
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      // Longer timeout for file uploads
      timeout: 60000,
    }
  );

  return response.data.data;
}

/**
 * Fetch assignment files
 *
 * Retrieves all files associated with an assignment including:
 * - Intro/description attachment files
 * - Activity attachment files
 * - Submission files (requires grader capability for all)
 *
 * @param assignmentId - The assignment ID to fetch files for
 * @returns Promise resolving to assignment files data object
 * @throws Error if assignment not found or user lacks permission
 *
 * @example
 * ```typescript
 * const files = await fetchAssignmentFiles(123);
 * console.log('Intro files:', files.introFiles);
 * console.log('Submission files:', files.submissionFiles);
 * ```
 */
export async function fetchAssignmentFiles(assignmentId: number): Promise<AssignmentFilesData> {
  const response = await apiClient.get<ApiResponse<AssignmentFilesData>>(
    ASSIGNMENT_ENDPOINTS.FILES(assignmentId)
  );
  return response.data.data;
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to fetch assignment details
 *
 * Provides cached access to assignment details with automatic background
 * refetching and error handling.
 *
 * @param assignmentId - The assignment ID to fetch
 * @param options - Optional React Query configuration
 * @returns Query result with assignment data, loading, and error states
 *
 * @example
 * ```typescript
 * function AssignmentPage({ assignmentId }: Props) {
 *   const { data: assignment, isLoading, error } = useAssignment(assignmentId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return <AssignmentView assignment={assignment} />;
 * }
 * ```
 */
export function useAssignment(
  assignmentId: number,
  options?: {
    enabled?: boolean;
    refetchOnWindowFocus?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: assignmentKeys.detail(assignmentId),
    queryFn: () => fetchAssignment(assignmentId),
    // Cache data for 5 minutes before considering stale
    staleTime: options?.staleTime ?? 5 * 60 * 1000,
    // Keep cached data for 30 minutes
    gcTime: 30 * 60 * 1000,
    // Refetch when window regains focus for real-time updates
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? true,
    // Only fetch if assignmentId is provided
    enabled: options?.enabled !== false && assignmentId > 0,
    // Retry failed requests up to 3 times
    retry: 3,
    // Exponential backoff: 1s, 2s, 4s
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

/**
 * Hook to fetch submissions for an assignment
 *
 * Provides cached access to submission list with filtering support.
 * Requires teacher/grader capability.
 *
 * @param assignmentId - The assignment ID to fetch submissions for
 * @param options - Optional filtering and React Query configuration
 * @returns Query result with submissions data, loading, and error states
 *
 * @example
 * ```typescript
 * function SubmissionsList({ assignmentId }: Props) {
 *   const { data, isLoading } = useSubmissions(assignmentId, {
 *     status: 'submitted',
 *     page: 1,
 *     perPage: 20
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <DataTable
 *       data={data?.submissions}
 *       total={data?.total}
 *     />
 *   );
 * }
 * ```
 */
export function useSubmissions(
  assignmentId: number,
  options?: SubmissionsFilterOptions & {
    enabled?: boolean;
    refetchOnWindowFocus?: boolean;
    staleTime?: number;
  }
) {
  const filterOptions: SubmissionsFilterOptions | undefined = options
    ? {
        status: options.status,
        since: options.since,
        before: options.before,
        page: options.page,
        perPage: options.perPage,
      }
    : undefined;

  return useQuery({
    queryKey: assignmentKeys.submissions(assignmentId, filterOptions),
    queryFn: () => fetchSubmissions(assignmentId, filterOptions),
    // Cache data for 2 minutes before considering stale (submissions change more frequently)
    staleTime: options?.staleTime ?? 2 * 60 * 1000,
    // Keep cached data for 15 minutes
    gcTime: 15 * 60 * 1000,
    // Refetch on focus to show latest submissions
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? true,
    // Only fetch if assignmentId is provided
    enabled: options?.enabled !== false && assignmentId > 0,
    // Retry failed requests
    retry: 2,
  });
}

/**
 * Hook for submitting assignment work
 *
 * Provides mutation function for submitting student work with
 * optimistic updates and automatic cache invalidation.
 *
 * @param options - Optional mutation configuration callbacks
 * @returns Mutation result with mutate function, loading, and error states
 *
 * @example
 * ```typescript
 * function SubmissionForm({ assignmentId }: Props) {
 *   const { mutate: submit, isPending } = useSubmitAssignment({
 *     onSuccess: () => {
 *       toast.success('Assignment submitted successfully!');
 *     },
 *     onError: (error) => {
 *       toast.error(error.message);
 *     }
 *   });
 *
 *   const handleSubmit = (formData: FormValues) => {
 *     submit({
 *       assignmentId,
 *       onlineText: formData.text,
 *       files: formData.files,
 *       acceptSubmissionStatement: true
 *     });
 *   };
 *
 *   return <Form onSubmit={handleSubmit} disabled={isPending} />;
 * }
 * ```
 */
export function useSubmitAssignment(
  options?: Omit<
    UseMutationOptions<SubmissionResponse, Error, SubmitAssignmentData, undefined>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<SubmissionResponse, Error, SubmitAssignmentData, undefined>({
    mutationFn: submitAssignment,
    onSuccess: (data, variables, context, mutationContext) => {
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

      // Call user-provided onSuccess callback
      if (options?.onSuccess) {
        options.onSuccess(data, variables, context, mutationContext);
      }
    },
    onError: options?.onError,
    onSettled: options?.onSettled,
    // Retry transient network errors once
    retry: 1,
  });
}

/**
 * Hook for grading a student's submission
 *
 * Provides mutation function for recording grades with
 * automatic cache invalidation.
 *
 * @param options - Optional mutation configuration callbacks
 * @returns Mutation result with mutate function, loading, and error states
 *
 * @example
 * ```typescript
 * function GradingForm({ assignmentId, userId }: Props) {
 *   const { mutate: grade, isPending } = useGradeSubmission({
 *     onSuccess: () => {
 *       toast.success('Grade saved successfully!');
 *     }
 *   });
 *
 *   const handleGrade = (gradeValue: number) => {
 *     grade({
 *       assignmentId,
 *       userId,
 *       grade: gradeValue,
 *       sendNotifications: true
 *     });
 *   };
 *
 *   return <GradeInput onSubmit={handleGrade} disabled={isPending} />;
 * }
 * ```
 */
export function useGradeSubmission(
  options?: Omit<
    UseMutationOptions<GradeResponse, Error, GradeSubmissionData, undefined>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<GradeResponse, Error, GradeSubmissionData, undefined>({
    mutationFn: gradeSubmission,
    onSuccess: (data, variables, context, mutationContext) => {
      // Invalidate submissions list to refresh grading status
      void queryClient.invalidateQueries({
        queryKey: assignmentKeys.submissions(variables.assignmentId),
      });

      // Also invalidate the specific assignment for grade statistics
      void queryClient.invalidateQueries({
        queryKey: assignmentKeys.detail(variables.assignmentId),
      });

      // Call user-provided onSuccess callback
      if (options?.onSuccess) {
        options.onSuccess(data, variables, context, mutationContext);
      }
    },
    onError: options?.onError,
    onSettled: options?.onSettled,
  });
}

/**
 * Hook for saving feedback on a submission
 *
 * Provides mutation function for recording teacher feedback
 * with automatic cache invalidation.
 *
 * @param options - Optional mutation configuration callbacks
 * @returns Mutation result with mutate function, loading, and error states
 *
 * @example
 * ```typescript
 * function FeedbackEditor({ assignmentId, userId }: Props) {
 *   const { mutate: save, isPending } = useSaveFeedback({
 *     onSuccess: () => {
 *       toast.success('Feedback saved!');
 *     }
 *   });
 *
 *   const handleSave = (text: string, files?: File[]) => {
 *     save({
 *       assignmentId,
 *       userId,
 *       feedbackText: text,
 *       feedbackFiles: files,
 *       draft: false
 *     });
 *   };
 *
 *   return <FeedbackForm onSubmit={handleSave} disabled={isPending} />;
 * }
 * ```
 */
export function useSaveFeedback(
  options?: Omit<
    UseMutationOptions<SubmissionResponse, Error, SaveFeedbackData, undefined>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<SubmissionResponse, Error, SaveFeedbackData, undefined>({
    mutationFn: saveFeedback,
    onSuccess: (data, variables, context, mutationContext) => {
      // Invalidate submissions list to refresh feedback status
      void queryClient.invalidateQueries({
        queryKey: assignmentKeys.submissions(variables.assignmentId),
      });

      // Invalidate files to show uploaded feedback files
      void queryClient.invalidateQueries({
        queryKey: assignmentKeys.files(variables.assignmentId),
      });

      // Call user-provided onSuccess callback
      if (options?.onSuccess) {
        options.onSuccess(data, variables, context, mutationContext);
      }
    },
    onError: options?.onError,
    onSettled: options?.onSettled,
    // Retry once for file upload failures
    retry: 1,
  });
}

/**
 * Hook to fetch assignment files
 *
 * Provides cached access to assignment file metadata with
 * download URLs for offline access support.
 *
 * @param assignmentId - The assignment ID to fetch files for
 * @param options - Optional React Query configuration
 * @returns Query result with files data, loading, and error states
 *
 * @example
 * ```typescript
 * function AssignmentFiles({ assignmentId }: Props) {
 *   const { data: files, isLoading } = useAssignmentFiles(assignmentId);
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <FileList title="Instructions" files={files?.introFiles} />
 *       <FileList title="Submissions" files={files?.submissionFiles} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useAssignmentFiles(
  assignmentId: number,
  options?: {
    enabled?: boolean;
    refetchOnWindowFocus?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: assignmentKeys.files(assignmentId),
    queryFn: () => fetchAssignmentFiles(assignmentId),
    // Cache file metadata for 10 minutes (files rarely change)
    staleTime: options?.staleTime ?? 10 * 60 * 1000,
    // Keep cached data for 1 hour for offline access
    gcTime: 60 * 60 * 1000,
    // Don't refetch files on focus unless explicitly configured
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    // Only fetch if assignmentId is provided
    enabled: options?.enabled !== false && assignmentId > 0,
    // Retry failed requests
    retry: 2,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Prefetch assignment data for improved UX
 *
 * Use this to prefetch assignment data before navigation,
 * such as on hover over an assignment link.
 *
 * @param queryClient - React Query client instance
 * @param assignmentId - The assignment ID to prefetch
 *
 * @example
 * ```typescript
 * function AssignmentLink({ assignmentId, children }: Props) {
 *   const queryClient = useQueryClient();
 *
 *   const handleMouseEnter = () => {
 *     prefetchAssignment(queryClient, assignmentId);
 *   };
 *
 *   return (
 *     <Link
 *       to={`/assignments/${assignmentId}`}
 *       onMouseEnter={handleMouseEnter}
 *     >
 *       {children}
 *     </Link>
 *   );
 * }
 * ```
 */
export async function prefetchAssignment(
  queryClient: ReturnType<typeof useQueryClient>,
  assignmentId: number
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: assignmentKeys.detail(assignmentId),
    queryFn: () => fetchAssignment(assignmentId),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Convert Moodle timestamp to JavaScript Date
 *
 * Moodle uses Unix timestamps (seconds since epoch).
 * JavaScript Date expects milliseconds.
 *
 * @param timestamp - Moodle timestamp in seconds
 * @returns JavaScript Date object or null if timestamp is 0
 *
 * @example
 * ```typescript
 * const dueDate = moodleDateToJs(assignment.duedate);
 * if (dueDate) {
 *   console.log(dueDate.toLocaleDateString());
 * }
 * ```
 */
export function moodleDateToJs(timestamp: number): Date | null {
  if (timestamp === 0) {
    return null;
  }
  return new Date(timestamp * 1000);
}

/**
 * Convert JavaScript Date to Moodle timestamp
 *
 * @param date - JavaScript Date object
 * @returns Moodle timestamp in seconds, or 0 if date is null
 *
 * @example
 * ```typescript
 * const moodleTimestamp = jsDateToMoodle(new Date('2024-12-31'));
 * ```
 */
export function jsDateToMoodle(date: Date | null): number {
  if (date === null) {
    return 0;
  }
  return Math.floor(date.getTime() / 1000);
}

/**
 * Check if assignment submission is currently allowed
 *
 * Evaluates assignment dates and submission settings to determine
 * if a student can currently submit.
 *
 * @param assignment - The assignment object to check
 * @returns Object indicating if submission is allowed and the reason
 *
 * @example
 * ```typescript
 * const { allowed, reason } = isSubmissionAllowed(assignment);
 * if (!allowed) {
 *   console.log(`Cannot submit: ${reason}`);
 * }
 * ```
 */
export function isSubmissionAllowed(assignment: Assignment): {
  allowed: boolean;
  reason?: string;
} {
  const now = Math.floor(Date.now() / 1000);

  // Check if submissions are disabled
  if (assignment.nosubmissions) {
    return { allowed: false, reason: 'Submissions are not enabled for this assignment.' };
  }

  // Check if submission period has started
  if (assignment.allowsubmissionsfromdate > 0 && now < assignment.allowsubmissionsfromdate) {
    return { allowed: false, reason: 'Submission period has not started yet.' };
  }

  // Check cut-off date (hard deadline)
  if (assignment.cutoffdate > 0 && now > assignment.cutoffdate) {
    return { allowed: false, reason: 'Submission period has ended.' };
  }

  // Submissions are allowed (due date may have passed but still within cutoff)
  return { allowed: true };
}

/**
 * Check if assignment is past due date
 *
 * @param assignment - The assignment object to check
 * @returns True if the assignment is past due
 *
 * @example
 * ```typescript
 * if (isPastDue(assignment)) {
 *   console.log('This assignment is overdue!');
 * }
 * ```
 */
export function isPastDue(assignment: Assignment): boolean {
  if (assignment.duedate === 0) {
    return false; // No due date means not past due
  }
  const now = Math.floor(Date.now() / 1000);
  return now > assignment.duedate;
}

/**
 * Get human-readable submission status label
 *
 * @param status - The submission status string
 * @returns User-friendly status label
 *
 * @example
 * ```typescript
 * const label = getSubmissionStatusLabel(submission.status);
 * // Returns "Submitted" for 'submitted', "Draft" for 'draft', etc.
 * ```
 */
export function getSubmissionStatusLabel(status: string): string {
  const statusLabels: Record<string, string> = {
    new: 'Not Submitted',
    reopened: 'Reopened',
    draft: 'Draft',
    submitted: 'Submitted',
  };
  return statusLabels[status] ?? status;
}

/**
 * Get human-readable grading status label
 *
 * @param status - The grading status string
 * @returns User-friendly grading status label
 *
 * @example
 * ```typescript
 * const label = getGradingStatusLabel(submission.gradingstatus);
 * // Returns "Graded" or "Not Graded"
 * ```
 */
export function getGradingStatusLabel(status: string | undefined): string {
  if (status === 'graded') {
    return 'Graded';
  }
  return 'Not Graded';
}
