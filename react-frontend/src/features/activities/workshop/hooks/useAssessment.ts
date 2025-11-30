/**
 * Workshop Assessment React Query Hooks
 *
 * This module provides React Query hooks for managing peer assessment operations
 * in workshop activities. Includes hooks for fetching assessment details, creating
 * new peer assessments, updating assessment grades and feedback, and finalizing
 * completed assessments.
 *
 * API Endpoints:
 * - GET /api/v1/workshops/assessments/{id} - Fetch assessment details
 * - POST /api/v1/workshops/{id}/assessments - Create new peer assessment
 * - PUT /api/v1/workshops/assessments/{id} - Update assessment grades and feedback
 * - POST /api/v1/workshops/assessments/{id}/submit - Finalize assessment
 *
 * The hooks wrap the following Moodle PHP methods:
 * - workshop->get_assessment_by_id() from locallib.php line 1399
 * - workshop->add_allocation() from locallib.php line 1537
 * - workshop->edit_assessment() from locallib.php line 3156
 * - Assessment capability checks from assessment.php lines 64-76
 *
 * @module features/activities/workshop/hooks/useAssessment
 * @see public/mod/workshop/assessment.php - Assessment view and update logic
 * @see public/mod/workshop/locallib.php - Workshop class methods
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult, QueryClient } from '@tanstack/react-query';
import apiClient from '@/services/api/client';
import type { AxiosResponse } from 'axios';
import type { WorkshopAssessmentDimension } from '@/types/entities';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Workshop Assessment entity representing a peer assessment record
 *
 * Maps to the workshop_assessments table in Moodle database and includes
 * extended data from joined tables (reviewer user info, submission title).
 *
 * @see public/mod/workshop/locallib.php - get_assessment_by_id() method
 */
export interface Assessment {
  /** Unique assessment identifier */
  id: number;
  /** ID of the submission being assessed */
  submissionid: number;
  /** ID of the user performing the review */
  reviewerid: number;
  /** Grade given to the submission (0-100 raw percentage) */
  grade: number | null;
  /** Grading grade (quality of assessment, 0-100 raw percentage) */
  gradinggrade: number | null;
  /** Grading grade override by teacher (0-100 raw percentage) */
  gradinggradeover: number | null;
  /** User ID who overrode the grading grade */
  gradinggradeoverby: number | null;
  /** Feedback to submission author */
  feedbackauthor: string | null;
  /** Feedback author text format (0=MOODLE, 1=HTML, 2=PLAIN, 4=MARKDOWN) */
  feedbackauthorformat: number;
  /** Whether feedback has attachments (0 or 1) */
  feedbackauthorattachment: number;
  /** Feedback from teacher to reviewer */
  feedbackreviewer: string | null;
  /** Feedback reviewer text format */
  feedbackreviewerformat: number;
  /** Weight of this assessment (0-16) */
  weight: number;
  /** Timestamp when assessment was created */
  timecreated: number;
  /** Timestamp when assessment was last modified */
  timemodified: number | null;
  /** Assessment dimension values from grading strategy */
  dimensions: WorkshopAssessmentDimension[];
  /** Reviewer user information */
  reviewer?: {
    id: number;
    firstname: string;
    lastname: string;
    fullname: string;
    picture: string | null;
    email: string;
  };
  /** Submission title */
  submissiontitle?: string;
  /** Whether the current user can edit this assessment */
  editable?: boolean;
  /** Workshop ID (derived from submission) */
  workshopid?: number;
}

/**
 * Form data for creating a new peer assessment allocation
 *
 * Used with the useCreateAssessment mutation to allocate a submission
 * to a reviewer for assessment.
 *
 * @see public/mod/workshop/locallib.php - add_allocation() method line 1537
 */
export interface CreateAssessmentData {
  /** ID of the submission to be assessed */
  submissionid: number;
  /** ID of the user who will review the submission */
  reviewerid: number;
  /** Weight of the assessment (0-16, default: 1) */
  weight?: number;
}

/**
 * Form data for updating an existing assessment
 *
 * Contains the assessment grades, feedback, and dimension values.
 * Supports both reviewer updates (grades, feedback to author) and
 * teacher overrides (grading grade override, feedback to reviewer).
 *
 * @see public/mod/workshop/locallib.php - edit_assessment() line 3156
 * @see public/mod/workshop/locallib.php - evaluate_assessment() line 3221
 */
export interface UpdateAssessmentData {
  /** Feedback to submission author */
  feedbackauthor?: string;
  /** Feedback author text format */
  feedbackauthorformat?: number;
  /** Assessment weight (only if user has allocate capability) */
  weight?: number;
  /** Grading grade override (only if user has overridegrades capability) */
  gradinggradeover?: number | null;
  /** Feedback from teacher to reviewer */
  feedbackreviewer?: string;
  /** Feedback reviewer text format */
  feedbackreviewerformat?: number;
  /** Assessment dimension values */
  dimensions: WorkshopAssessmentDimension[];
}

/**
 * Form data for submitting/finalizing an assessment
 *
 * Used to mark an assessment as complete and trigger grade calculations.
 */
export interface SubmitAssessmentData {
  /** Whether to save and close (true) or save and continue (false) */
  saveandclose?: boolean;
  /** Whether to proceed to next pending assessment */
  saveandshownext?: boolean;
}

/**
 * API response wrapper for single assessment
 */
interface AssessmentApiResponse {
  success: boolean;
  data: Assessment;
  meta?: {
    editable?: boolean;
    cansetassessmentweight?: boolean;
    canoverridegrades?: boolean;
  };
}

/**
 * API response wrapper for assessment creation
 */
interface CreateAssessmentApiResponse {
  success: boolean;
  data: {
    id: number;
    submissionid: number;
    reviewerid: number;
  };
}

/**
 * API response wrapper for assessment update
 */
interface UpdateAssessmentApiResponse {
  success: boolean;
  data: {
    id: number;
    grade: number | null;
    updated: boolean;
  };
}

/**
 * API response wrapper for assessment submission
 */
interface SubmitAssessmentApiResponse {
  success: boolean;
  data: {
    id: number;
    grade: number | null;
    submitted: boolean;
    nextAssessmentId?: number;
  };
}

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Factory function for generating consistent query keys
 *
 * Query keys follow the pattern: ['workshops', workshopId?, 'assessments', assessmentId?]
 * This enables efficient cache invalidation at different granularity levels.
 */
const assessmentKeys = {
  /** Base key for all assessment-related queries */
  all: ['assessments'] as const,

  /** Key for all assessments in a specific workshop */
  workshop: (workshopId: number) =>
    ['workshops', workshopId, 'assessments'] as const,

  /** Key for a specific assessment */
  detail: (assessmentId: number) =>
    ['workshops', 'assessments', assessmentId] as const,

  /** Key for assessments of a specific submission */
  submission: (workshopId: number, submissionId: number) =>
    ['workshops', workshopId, 'submissions', submissionId, 'assessments'] as const,
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetches assessment details by ID
 *
 * Calls GET /api/v1/workshops/assessments/{id} which wraps
 * workshop->get_assessment_by_id() from locallib.php line 1399.
 *
 * Returns extended assessment data including reviewer info, submission title,
 * and assessment dimensions from the grading strategy.
 *
 * @param assessmentId - The unique identifier of the assessment
 * @returns Promise resolving to the assessment data
 * @throws Error if assessment not found or user lacks permission
 */
async function fetchAssessment(assessmentId: number): Promise<Assessment> {
  const response: AxiosResponse<AssessmentApiResponse> = await apiClient.get(
    `/workshops/assessments/${assessmentId}`
  );
  return response.data.data;
}

/**
 * Creates a new peer assessment allocation
 *
 * Calls POST /api/v1/workshops/{workshopId}/assessments which wraps
 * workshop->add_allocation() from locallib.php line 1537.
 *
 * Creates a new assessment record allocating a submission to a reviewer.
 * The assessment starts with no grade - the reviewer must complete the
 * assessment form to provide grades and feedback.
 *
 * @param workshopId - The workshop ID to create the assessment in
 * @param data - Assessment creation data (submissionid, reviewerid, weight)
 * @returns Promise resolving to the created assessment basic data
 * @throws Error if allocation already exists or user lacks allocate capability
 */
async function createAssessment(
  workshopId: number,
  data: CreateAssessmentData
): Promise<CreateAssessmentApiResponse['data']> {
  const response: AxiosResponse<CreateAssessmentApiResponse> = await apiClient.post(
    `/workshops/${workshopId}/assessments`,
    {
      submissionid: data.submissionid,
      reviewerid: data.reviewerid,
      weight: data.weight ?? 1,
    }
  );
  return response.data.data;
}

/**
 * Updates an existing assessment with grades and feedback
 *
 * Calls PUT /api/v1/workshops/assessments/{id} which wraps:
 * - workshop->edit_assessment() from locallib.php line 3156 (reviewer updates)
 * - workshop->evaluate_assessment() from locallib.php line 3221 (teacher overrides)
 *
 * Checks capabilities based on assessment.php lines 64-76:
 * - cansetassessmentweight: has_capability('mod/workshop:allocate')
 * - canoverridegrades: has_capability('mod/workshop:overridegrades')
 * - isreviewer: $USER->id == $assessment->reviewerid
 *
 * @param assessmentId - The assessment ID to update
 * @param data - Update data including dimensions, feedback, and optional overrides
 * @returns Promise resolving to the update result
 * @throws Error if assessment not editable or user lacks required permissions
 */
async function updateAssessment(
  assessmentId: number,
  data: UpdateAssessmentData
): Promise<UpdateAssessmentApiResponse['data']> {
  const response: AxiosResponse<UpdateAssessmentApiResponse> = await apiClient.put(
    `/workshops/assessments/${assessmentId}`,
    {
      feedbackauthor: data.feedbackauthor,
      feedbackauthorformat: data.feedbackauthorformat ?? 1, // HTML format default
      weight: data.weight,
      gradinggradeover: data.gradinggradeover,
      feedbackreviewer: data.feedbackreviewer,
      feedbackreviewerformat: data.feedbackreviewerformat ?? 1,
      dimensions: data.dimensions,
    }
  );
  return response.data.data;
}

/**
 * Submits/finalizes an assessment
 *
 * Calls POST /api/v1/workshops/assessments/{id}/submit to finalize
 * the assessment and trigger grade calculations.
 *
 * After submission:
 * - The assessment grade is calculated from dimension grades
 * - Submission grades may be re-aggregated
 * - Grading grades may be recalculated
 *
 * @param assessmentId - The assessment ID to submit
 * @param data - Submission options (saveandclose, saveandshownext)
 * @returns Promise resolving to the submission result
 * @throws Error if assessment is not editable
 */
async function submitAssessment(
  assessmentId: number,
  data: SubmitAssessmentData
): Promise<SubmitAssessmentApiResponse['data']> {
  const response: AxiosResponse<SubmitAssessmentApiResponse> = await apiClient.post(
    `/workshops/assessments/${assessmentId}/submit`,
    {
      saveandclose: data.saveandclose ?? true,
      saveandshownext: data.saveandshownext ?? false,
    }
  );
  return response.data.data;
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Query hook for fetching assessment details
 *
 * Fetches complete assessment data including reviewer information,
 * submission title, and assessment dimensions from the grading strategy.
 *
 * Uses query key ['workshops', 'assessments', assessmentId] for caching.
 * Data is considered stale after 5 minutes.
 *
 * @param assessmentId - The assessment ID to fetch (null/undefined skips the query)
 * @returns Query result with assessment data, loading state, and error handling
 *
 * @example
 * ```tsx
 * function AssessmentView({ assessmentId }: { assessmentId: number }) {
 *   const { data: assessment, isLoading, error } = useAssessment(assessmentId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <h1>Assessment #{assessment.id}</h1>
 *       <p>Reviewer: {assessment.reviewer?.fullname}</p>
 *       <p>Grade: {assessment.grade}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAssessment(
  assessmentId: number | null | undefined
): UseQueryResult<Assessment, Error> {
  return useQuery({
    queryKey: assessmentKeys.detail(assessmentId ?? 0),
    queryFn: () => fetchAssessment(assessmentId as number),
    enabled: assessmentId != null && assessmentId > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  });
}

/**
 * Default export for useAssessment hook
 */
export default useAssessment;

/**
 * Hook result type for useCreateAssessment mutation
 */
export interface UseCreateAssessmentResult {
  /** Mutation function to create a new assessment */
  createAssessment: (data: CreateAssessmentData) => void;
  /** Async mutation function to create a new assessment */
  createAssessmentAsync: (data: CreateAssessmentData) => Promise<CreateAssessmentApiResponse['data']>;
  /** Whether the mutation is currently in progress */
  isLoading: boolean;
  /** Whether the mutation was successful */
  isSuccess: boolean;
  /** Whether the mutation resulted in an error */
  isError: boolean;
  /** Error object if mutation failed */
  error: Error | null;
  /** Reset mutation state */
  reset: () => void;
}

/**
 * Mutation hook for creating a new peer assessment
 *
 * Creates a new assessment allocation by calling workshop->add_allocation().
 * Implements optimistic updates and cache invalidation.
 *
 * After successful creation:
 * - Invalidates ['workshops', workshopId, 'assessments'] query
 * - Invalidates submission assessments query
 *
 * @param workshopId - The workshop ID to create assessments in
 * @returns Mutation result with createAssessment function and state
 *
 * @example
 * ```tsx
 * function AllocateAssessment({ workshopId, submissionId }: Props) {
 *   const { createAssessment, isLoading } = useCreateAssessment(workshopId);
 *
 *   const handleAllocate = (reviewerId: number) => {
 *     createAssessment({
 *       submissionid: submissionId,
 *       reviewerid: reviewerId,
 *       weight: 1,
 *     });
 *   };
 *
 *   return (
 *     <Button onClick={() => handleAllocate(userId)} disabled={isLoading}>
 *       Allocate Assessment
 *     </Button>
 *   );
 * }
 * ```
 */
export function useCreateAssessment(workshopId: number): UseCreateAssessmentResult {
  const queryClient: QueryClient = useQueryClient();

  const mutation: UseMutationResult<
    CreateAssessmentApiResponse['data'],
    Error,
    CreateAssessmentData
  > = useMutation({
    mutationFn: (data: CreateAssessmentData) => createAssessment(workshopId, data),
    onSuccess: (_result, variables) => {
      // Invalidate workshop assessments list
      void queryClient.invalidateQueries({
        queryKey: assessmentKeys.workshop(workshopId),
      });

      // Invalidate submission-specific assessments
      void queryClient.invalidateQueries({
        queryKey: assessmentKeys.submission(workshopId, variables.submissionid),
      });

      // Invalidate workshop data to refresh submission counts
      void queryClient.invalidateQueries({
        queryKey: ['workshops', workshopId],
      });
    },
  });

  return {
    createAssessment: mutation.mutate,
    createAssessmentAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook result type for useUpdateAssessment mutation
 */
export interface UseUpdateAssessmentResult {
  /** Mutation function to update an assessment */
  updateAssessment: (data: UpdateAssessmentData) => void;
  /** Async mutation function to update an assessment */
  updateAssessmentAsync: (data: UpdateAssessmentData) => Promise<UpdateAssessmentApiResponse['data']>;
  /** Whether the mutation is currently in progress */
  isLoading: boolean;
  /** Whether the mutation was successful */
  isSuccess: boolean;
  /** Whether the mutation resulted in an error */
  isError: boolean;
  /** Error object if mutation failed */
  error: Error | null;
  /** Reset mutation state */
  reset: () => void;
}

/**
 * Mutation hook for updating an existing assessment
 *
 * Updates assessment with grades, feedback, and dimension values.
 * Supports both reviewer updates and teacher overrides based on capabilities.
 *
 * Implements optimistic updates:
 * - Immediately updates cached assessment data
 * - Reverts on error
 *
 * After successful update:
 * - Invalidates the specific assessment query
 * - Invalidates workshop assessments list
 *
 * @param assessmentId - The assessment ID to update
 * @param workshopId - Optional workshop ID for cache invalidation
 * @returns Mutation result with updateAssessment function and state
 *
 * @example
 * ```tsx
 * function AssessmentForm({ assessmentId, workshopId }: Props) {
 *   const { updateAssessment, isLoading } = useUpdateAssessment(assessmentId, workshopId);
 *
 *   const handleSubmit = (formData: UpdateAssessmentData) => {
 *     updateAssessment(formData);
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       // Form fields go here
 *       <Button type="submit" disabled={isLoading}>Save Assessment</Button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useUpdateAssessment(
  assessmentId: number,
  workshopId?: number
): UseUpdateAssessmentResult {
  const queryClient: QueryClient = useQueryClient();

  const mutation: UseMutationResult<
    UpdateAssessmentApiResponse['data'],
    Error,
    UpdateAssessmentData
  > = useMutation({
    mutationFn: (data: UpdateAssessmentData) => updateAssessment(assessmentId, data),

    // Optimistic update
    onMutate: async (newData: UpdateAssessmentData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: assessmentKeys.detail(assessmentId),
      });

      // Snapshot the previous value
      const previousAssessment = queryClient.getQueryData<Assessment>(
        assessmentKeys.detail(assessmentId)
      );

      // Optimistically update to the new value
      if (previousAssessment) {
        queryClient.setQueryData<Assessment>(
          assessmentKeys.detail(assessmentId),
          {
            ...previousAssessment,
            feedbackauthor: newData.feedbackauthor ?? previousAssessment.feedbackauthor,
            feedbackauthorformat: newData.feedbackauthorformat ?? previousAssessment.feedbackauthorformat,
            weight: newData.weight ?? previousAssessment.weight,
            gradinggradeover: newData.gradinggradeover !== undefined
              ? newData.gradinggradeover
              : previousAssessment.gradinggradeover,
            feedbackreviewer: newData.feedbackreviewer ?? previousAssessment.feedbackreviewer,
            feedbackreviewerformat: newData.feedbackreviewerformat ?? previousAssessment.feedbackreviewerformat,
            dimensions: newData.dimensions,
            timemodified: Math.floor(Date.now() / 1000),
          }
        );
      }

      // Return a context object with the snapshotted value
      return { previousAssessment };
    },

    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (_err, _newData, context) => {
      if (context?.previousAssessment) {
        queryClient.setQueryData<Assessment>(
          assessmentKeys.detail(assessmentId),
          context.previousAssessment
        );
      }
    },

    // Always refetch after error or success
    onSettled: () => {
      // Invalidate the specific assessment
      void queryClient.invalidateQueries({
        queryKey: assessmentKeys.detail(assessmentId),
      });

      // Invalidate workshop assessments list if workshopId provided
      if (workshopId) {
        void queryClient.invalidateQueries({
          queryKey: assessmentKeys.workshop(workshopId),
        });

        // Invalidate workshop data for grade recalculation display
        void queryClient.invalidateQueries({
          queryKey: ['workshops', workshopId],
        });
      }
    },
  });

  return {
    updateAssessment: mutation.mutate,
    updateAssessmentAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook result type for useSubmitAssessment mutation
 */
export interface UseSubmitAssessmentResult {
  /** Mutation function to submit an assessment */
  submitAssessment: (data?: SubmitAssessmentData) => void;
  /** Async mutation function to submit an assessment */
  submitAssessmentAsync: (data?: SubmitAssessmentData) => Promise<SubmitAssessmentApiResponse['data']>;
  /** Whether the mutation is currently in progress */
  isLoading: boolean;
  /** Whether the mutation was successful */
  isSuccess: boolean;
  /** Whether the mutation resulted in an error */
  isError: boolean;
  /** Error object if mutation failed */
  error: Error | null;
  /** The ID of the next pending assessment (if saveandshownext was used) */
  nextAssessmentId: number | undefined;
  /** Reset mutation state */
  reset: () => void;
}

/**
 * Mutation hook for submitting/finalizing an assessment
 *
 * Finalizes the assessment and triggers grade calculations.
 * Supports different submission modes:
 * - saveandclose: Submit and return to workshop view
 * - saveandshownext: Submit and proceed to next pending assessment
 *
 * After successful submission:
 * - Assessment grade is calculated from dimension grades
 * - Submission grades may be re-aggregated
 * - Grading grades may be recalculated
 * - All related queries are invalidated
 *
 * @param assessmentId - The assessment ID to submit
 * @param workshopId - Optional workshop ID for cache invalidation
 * @returns Mutation result with submitAssessment function, state, and nextAssessmentId
 *
 * @example
 * ```tsx
 * function AssessmentSubmit({ assessmentId, workshopId }: Props) {
 *   const {
 *     submitAssessment,
 *     isLoading,
 *     isSuccess,
 *     nextAssessmentId
 *   } = useSubmitAssessment(assessmentId, workshopId);
 *
 *   const handleSubmit = () => {
 *     submitAssessment({ saveandclose: true });
 *   };
 *
 *   const handleSubmitAndNext = () => {
 *     submitAssessment({ saveandshownext: true });
 *   };
 *
 *   useEffect(() => {
 *     if (isSuccess && nextAssessmentId) {
 *       navigate(`/workshops/assessments/${nextAssessmentId}`);
 *     }
 *   }, [isSuccess, nextAssessmentId]);
 *
 *   return (
 *     <div>
 *       <Button onClick={handleSubmit} disabled={isLoading}>
 *         Submit and Close
 *       </Button>
 *       <Button onClick={handleSubmitAndNext} disabled={isLoading}>
 *         Submit and Next
 *       </Button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSubmitAssessment(
  assessmentId: number,
  workshopId?: number
): UseSubmitAssessmentResult {
  const queryClient: QueryClient = useQueryClient();

  const mutation: UseMutationResult<
    SubmitAssessmentApiResponse['data'],
    Error,
    SubmitAssessmentData | undefined
  > = useMutation({
    mutationFn: (data?: SubmitAssessmentData) =>
      submitAssessment(assessmentId, data ?? { saveandclose: true }),

    onSuccess: () => {
      // Invalidate the specific assessment
      void queryClient.invalidateQueries({
        queryKey: assessmentKeys.detail(assessmentId),
      });

      // Invalidate workshop assessments list if workshopId provided
      if (workshopId) {
        void queryClient.invalidateQueries({
          queryKey: assessmentKeys.workshop(workshopId),
        });

        // Invalidate workshop data for updated grades display
        void queryClient.invalidateQueries({
          queryKey: ['workshops', workshopId],
        });

        // Invalidate workshop submissions for grade recalculation
        void queryClient.invalidateQueries({
          queryKey: ['workshops', workshopId, 'submissions'],
        });
      }

      // Invalidate all assessments (for grading grade recalculation)
      void queryClient.invalidateQueries({
        queryKey: assessmentKeys.all,
      });
    },
  });

  return {
    submitAssessment: mutation.mutate,
    submitAssessmentAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    nextAssessmentId: mutation.data?.nextAssessmentId,
    reset: mutation.reset,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate the overall assessment grade from dimension grades
 *
 * This is a client-side utility for preview purposes. The actual grade
 * calculation is performed server-side by the grading strategy plugin.
 *
 * @param dimensions - Array of dimension grades
 * @param maxGrade - Maximum possible grade (default: 100)
 * @returns Calculated grade as a percentage, or null if no grades
 */
export function calculateAssessmentGrade(
  dimensions: WorkshopAssessmentDimension[],
  maxGrade: number = 100
): number | null {
  if (!dimensions || dimensions.length === 0) {
    return null;
  }

  const gradedDimensions = dimensions.filter(
    (d): d is WorkshopAssessmentDimension & { grade: number } =>
      d.grade !== null && d.grade !== undefined
  );

  if (gradedDimensions.length === 0) {
    return null;
  }

  // Simple average calculation (actual calculation depends on grading strategy)
  const sum = gradedDimensions.reduce((acc, d) => acc + d.grade, 0);
  const average = sum / gradedDimensions.length;

  // Normalize to percentage
  return Math.min(100, Math.max(0, (average / maxGrade) * 100));
}

/**
 * Check if all required dimensions have been graded
 *
 * @param dimensions - Array of dimension grades
 * @param requiredDimensionIds - Array of dimension IDs that must be graded
 * @returns True if all required dimensions have grades
 */
export function isAssessmentComplete(
  dimensions: WorkshopAssessmentDimension[],
  requiredDimensionIds?: number[]
): boolean {
  if (!dimensions || dimensions.length === 0) {
    return false;
  }

  // If specific dimensions are required, check those
  if (requiredDimensionIds && requiredDimensionIds.length > 0) {
    return requiredDimensionIds.every((requiredId) => {
      const dimension = dimensions.find((d) => d.dimensionid === requiredId);
      return dimension?.grade !== null && dimension?.grade !== undefined;
    });
  }

  // Otherwise, check if all dimensions have grades
  return dimensions.every(
    (d) => d.grade !== null && d.grade !== undefined
  );
}

/**
 * Format assessment dimension grade for display
 *
 * @param grade - The raw grade value
 * @param maxGrade - Maximum possible grade for the dimension
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted grade string or '-' if no grade
 */
export function formatDimensionGrade(
  grade: number | null | undefined,
  maxGrade: number = 100,
  decimals: number = 2
): string {
  if (grade === null || grade === undefined) {
    return '-';
  }

  const realGrade = (maxGrade * grade) / 100;
  return realGrade.toFixed(decimals);
}
