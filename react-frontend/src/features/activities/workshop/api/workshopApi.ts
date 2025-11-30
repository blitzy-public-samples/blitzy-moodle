/**
 * Workshop Activity API Integration Layer
 *
 * This module provides React Query hooks for interacting with the Moodle workshop
 * activity backend API. It implements the complete workshop workflow including:
 * - Fetching workshop details and user plans
 * - Managing submissions (create, update, delete)
 * - Handling peer assessments
 * - Switching workshop phases
 * - Allocating reviewers to submissions
 * - Managing grades
 *
 * All hooks integrate with React Query for caching, optimistic updates, and
 * automatic refetching. Uses TypeScript for type safety with proper Workshop,
 * Submission, Assessment, and Grade type interfaces.
 *
 * Based on Moodle workshop module from:
 * - public/mod/workshop/view.php (lines 42-54, 63-70, 76-82)
 * - public/mod/workshop/submission.php (lines 54-68, 107-112, 153-160)
 * - public/mod/workshop/assessment.php (lines 40-45, 124-143)
 * - public/mod/workshop/allocation.php (lines 33-57)
 *
 * @module features/activities/workshop/api/workshopApi
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import apiClient from '@/services/api/client';
import { WORKSHOP_ENDPOINTS } from '@/services/api/endpoints';
import type {
  Workshop,
  WorkshopSubmission,
  WorkshopAssessment,
  WorkshopPhase,
  WorkshopUserPlan,
  AllocationResult,
  DimensionGrade,
  WorkshopAssessmentFormData,
} from '@/features/activities/workshop/types';
import type { ApiResponse, ListParams } from '@/types/api';

// ============================================================================
// Query Keys Factory
// ============================================================================

/**
 * Query key factory for workshop-related queries
 *
 * Provides consistent and type-safe query keys for React Query cache management.
 * Using a factory pattern ensures proper cache invalidation across related queries.
 */
const workshopQueryKeys = {
  /** Base key for all workshop queries */
  all: ['workshops'] as const,

  /** Key for a list of workshops */
  lists: () => [...workshopQueryKeys.all, 'list'] as const,

  /** Key for a specific workshop's details */
  detail: (workshopId: number) =>
    [...workshopQueryKeys.all, 'detail', workshopId] as const,

  /** Key for a workshop's user plan */
  userPlan: (workshopId: number) =>
    [...workshopQueryKeys.all, 'userPlan', workshopId] as const,

  /** Key for a workshop's submissions list */
  submissions: (workshopId: number) =>
    [...workshopQueryKeys.all, 'submissions', workshopId] as const,

  /** Key for a workshop's assessments list */
  assessments: (submissionId: number) =>
    [...workshopQueryKeys.all, 'assessments', submissionId] as const,

  /** Key for workshop assessments by workshop ID */
  workshopAssessments: (workshopId: number) =>
    [...workshopQueryKeys.all, 'workshopAssessments', workshopId] as const,

  /** Key for a workshop's grades */
  grades: (workshopId: number) =>
    [...workshopQueryKeys.all, 'grades', workshopId] as const,
} as const;

// ============================================================================
// Type Definitions for API Requests/Responses
// ============================================================================

/**
 * Workshop details with additional computed fields
 */
interface WorkshopDetailResponse {
  workshop: Workshop;
  userPlan?: WorkshopUserPlan;
  currentPhaseTitle?: string;
  canSubmit?: boolean;
  canAssess?: boolean;
  canAllocate?: boolean;
  canSwitchPhase?: boolean;
}

/**
 * Parameters for creating or updating a submission
 */
interface CreateSubmissionParams {
  workshopId: number;
  title: string;
  content: string;
  contentFormat?: number;
  attachmentId?: number;
}

/**
 * Parameters for updating an existing submission
 */
interface UpdateSubmissionParams {
  submissionId: number;
  title?: string;
  content?: string;
  contentFormat?: number;
  attachmentId?: number;
}

/**
 * Parameters for switching workshop phase
 */
interface SwitchPhaseParams {
  workshopId: number;
  targetPhase: WorkshopPhase;
}

/**
 * Parameters for allocating reviewers
 */
interface AllocateReviewersParams {
  workshopId: number;
  method: 'manual' | 'random' | 'scheduled';
  settings?: {
    numOfReviews?: number;
    numPerAuthor?: number;
    numPerReviewer?: number;
    removeCurrent?: boolean;
    excludeSameGroup?: boolean;
    addselfassessment?: boolean;
  };
}

/**
 * Manual allocation parameters
 */
interface ManualAllocationParams {
  workshopId: number;
  submissionId: number;
  reviewerId: number;
}

/**
 * Parameters for creating an assessment
 */
interface CreateAssessmentParams {
  submissionId: number;
  formData: WorkshopAssessmentFormData;
}

/**
 * Parameters for updating a grade
 */
interface UpdateGradeParams {
  workshopId: number;
  submissionId: number;
  grade?: number | null;
  gradingGrade?: number | null;
  feedbackAuthor?: string;
  feedbackAuthorFormat?: number;
  published?: boolean;
}

/**
 * Workshop grade information
 */
interface WorkshopGrade {
  submissionId: number;
  authorId: number;
  authorName: string;
  submissionGrade: number | null;
  gradingGrade: number | null;
  finalGrade: number | null;
}

// ============================================================================
// API Functions (Private)
// ============================================================================

/**
 * Fetch workshop details from the API
 *
 * @param workshopId - ID of the workshop to fetch
 * @returns Workshop details with user plan and capabilities
 */
async function fetchWorkshopDetail(
  workshopId: number
): Promise<WorkshopDetailResponse> {
  const response = await apiClient.get<ApiResponse<WorkshopDetailResponse>>(
    WORKSHOP_ENDPOINTS.DETAIL(workshopId)
  );
  return response.data.data;
}

/**
 * Fetch workshop user plan
 *
 * @param workshopId - ID of the workshop
 * @returns User's personalized workshop plan with phases and tasks
 */
async function fetchWorkshopUserPlan(
  workshopId: number
): Promise<WorkshopUserPlan> {
  const response = await apiClient.get<ApiResponse<WorkshopUserPlan>>(
    WORKSHOP_ENDPOINTS.USER_PLAN(workshopId)
  );
  return response.data.data;
}

/**
 * Fetch submissions for a workshop
 *
 * @param workshopId - ID of the workshop
 * @param params - Optional pagination and filter parameters
 * @returns List of workshop submissions
 */
async function fetchWorkshopSubmissions(
  workshopId: number,
  params?: ListParams<WorkshopSubmission>
): Promise<WorkshopSubmission[]> {
  const response = await apiClient.get<ApiResponse<WorkshopSubmission[]>>(
    WORKSHOP_ENDPOINTS.SUBMISSIONS(workshopId),
    { params }
  );
  return response.data.data;
}

/**
 * Create a new workshop submission
 *
 * @param params - Submission creation parameters
 * @returns Created submission
 */
async function createSubmission(
  params: CreateSubmissionParams
): Promise<WorkshopSubmission> {
  const response = await apiClient.post<ApiResponse<WorkshopSubmission>>(
    WORKSHOP_ENDPOINTS.CREATE_SUBMISSION(params.workshopId),
    {
      title: params.title,
      content: params.content,
      contentFormat: params.contentFormat ?? 1,
      attachmentId: params.attachmentId,
    }
  );
  return response.data.data;
}

/**
 * Update an existing submission
 *
 * @param params - Submission update parameters
 * @returns Updated submission
 */
async function updateSubmission(
  params: UpdateSubmissionParams
): Promise<WorkshopSubmission> {
  const response = await apiClient.put<ApiResponse<WorkshopSubmission>>(
    WORKSHOP_ENDPOINTS.UPDATE_SUBMISSION(params.submissionId),
    {
      title: params.title,
      content: params.content,
      contentFormat: params.contentFormat,
      attachmentId: params.attachmentId,
    }
  );
  return response.data.data;
}

/**
 * Delete a workshop submission
 *
 * @param submissionId - ID of the submission to delete
 * @returns Void on success
 */
async function deleteSubmission(submissionId: number): Promise<void> {
  await apiClient.delete<ApiResponse<void>>(
    WORKSHOP_ENDPOINTS.DELETE_SUBMISSION(submissionId)
  );
}

/**
 * Fetch assessments for a submission
 *
 * @param submissionId - ID of the submission
 * @returns List of assessments for the submission
 */
async function fetchAssessments(
  submissionId: number
): Promise<WorkshopAssessment[]> {
  const response = await apiClient.get<ApiResponse<WorkshopAssessment[]>>(
    WORKSHOP_ENDPOINTS.ASSESSMENTS(submissionId)
  );
  return response.data.data;
}

/**
 * Create a new peer assessment
 *
 * @param params - Assessment creation parameters
 * @returns Created assessment
 */
async function createAssessment(
  params: CreateAssessmentParams
): Promise<WorkshopAssessment> {
  const response = await apiClient.post<ApiResponse<WorkshopAssessment>>(
    WORKSHOP_ENDPOINTS.CREATE_ASSESSMENT(params.submissionId),
    params.formData
  );
  return response.data.data;
}

/**
 * Update an existing assessment
 *
 * @param assessmentId - ID of the assessment to update
 * @param formData - Assessment form data
 * @returns Updated assessment
 */
async function updateAssessment(
  assessmentId: number,
  formData: WorkshopAssessmentFormData
): Promise<WorkshopAssessment> {
  const response = await apiClient.put<ApiResponse<WorkshopAssessment>>(
    WORKSHOP_ENDPOINTS.UPDATE_ASSESSMENT(assessmentId),
    formData
  );
  return response.data.data;
}

/**
 * Switch workshop to a new phase
 *
 * @param params - Phase switch parameters
 * @returns Updated workshop
 */
async function switchWorkshopPhase(
  params: SwitchPhaseParams
): Promise<Workshop> {
  const response = await apiClient.post<ApiResponse<Workshop>>(
    WORKSHOP_ENDPOINTS.SWITCH_PHASE(params.workshopId),
    { targetPhase: params.targetPhase }
  );
  return response.data.data;
}

/**
 * Allocate reviewers to submissions
 *
 * @param params - Allocation parameters
 * @returns Allocation result with count of created allocations
 */
async function allocateReviewers(
  params: AllocateReviewersParams
): Promise<AllocationResult> {
  const response = await apiClient.post<ApiResponse<AllocationResult>>(
    WORKSHOP_ENDPOINTS.ALLOCATE(params.workshopId),
    {
      method: params.method,
      settings: params.settings,
    }
  );
  return response.data.data;
}

/**
 * Fetch grades for a workshop
 *
 * @param workshopId - ID of the workshop
 * @returns List of workshop grades
 */
async function fetchWorkshopGrades(
  workshopId: number
): Promise<WorkshopGrade[]> {
  const response = await apiClient.get<ApiResponse<WorkshopGrade[]>>(
    WORKSHOP_ENDPOINTS.GRADES(workshopId)
  );
  return response.data.data;
}

/**
 * Update a submission's grade
 *
 * @param params - Grade update parameters
 * @returns Updated submission with new grade
 */
async function updateWorkshopGrade(
  params: UpdateGradeParams
): Promise<WorkshopSubmission> {
  const response = await apiClient.put<ApiResponse<WorkshopSubmission>>(
    WORKSHOP_ENDPOINTS.UPDATE_GRADE(params.workshopId),
    {
      submissionId: params.submissionId,
      grade: params.grade,
      gradingGrade: params.gradingGrade,
      feedbackAuthor: params.feedbackAuthor,
      feedbackAuthorFormat: params.feedbackAuthorFormat,
      published: params.published,
    }
  );
  return response.data.data;
}

// ============================================================================
// React Query Hooks (Exported)
// ============================================================================

/**
 * Hook for fetching workshop details with phases and user plan
 *
 * Retrieves comprehensive workshop information including:
 * - Workshop configuration and settings
 * - Current phase and phase titles
 * - User's personalized plan with tasks
 * - User capabilities (canSubmit, canAssess, etc.)
 *
 * Based on view.php lines 42-54 (workshop loading) and 76-82 (user plan)
 *
 * @param workshopId - ID of the workshop to fetch
 * @param options - Optional query options
 * @returns React Query result with workshop details
 *
 * @example
 * ```tsx
 * const { data: workshop, isLoading, error } = useWorkshop(123);
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 *
 * return (
 *   <WorkshopDetail
 *     workshop={workshop.workshop}
 *     userPlan={workshop.userPlan}
 *     canSubmit={workshop.canSubmit}
 *   />
 * );
 * ```
 */
export function useWorkshop(
  workshopId: number,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchOnWindowFocus?: boolean;
  }
): UseQueryResult<WorkshopDetailResponse, Error> {
  return useQuery({
    queryKey: workshopQueryKeys.detail(workshopId),
    queryFn: () => fetchWorkshopDetail(workshopId),
    enabled: workshopId > 0 && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes default
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? true,
  });
}

/**
 * Hook for fetching a workshop's user plan
 *
 * Retrieves the personalized task plan for the current user showing:
 * - All workshop phases with their titles
 * - Tasks assigned to the user in each phase
 * - Completion status of each task
 * - Links to relevant pages for each task
 *
 * Based on view.php lines 76-82 (user plan initialization)
 *
 * @param workshopId - ID of the workshop
 * @param options - Optional query options
 * @returns React Query result with user plan
 *
 * @example
 * ```tsx
 * const { data: userPlan } = useWorkshopUserPlan(workshopId);
 *
 * return (
 *   <UserPlanView phases={userPlan?.phases} />
 * );
 * ```
 */
export function useWorkshopUserPlan(
  workshopId: number,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
): UseQueryResult<WorkshopUserPlan, Error> {
  return useQuery({
    queryKey: workshopQueryKeys.userPlan(workshopId),
    queryFn: () => fetchWorkshopUserPlan(workshopId),
    enabled: workshopId > 0 && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 2 * 60 * 1000, // 2 minutes default
  });
}

/**
 * Hook for fetching workshop submissions
 *
 * Retrieves all submissions for a workshop including:
 * - Author information
 * - Submission content and attachments
 * - Grade information (if available)
 * - Publication status
 *
 * Based on submission.php lines 54-68 (submission loading)
 *
 * @param workshopId - ID of the workshop
 * @param params - Optional pagination and filter parameters
 * @param options - Optional query options
 * @returns React Query result with submissions list
 *
 * @example
 * ```tsx
 * const { data: submissions, isLoading } = useWorkshopSubmissions(workshopId);
 *
 * return (
 *   <SubmissionList
 *     submissions={submissions}
 *     loading={isLoading}
 *   />
 * );
 * ```
 */
export function useWorkshopSubmissions(
  workshopId: number,
  params?: ListParams<WorkshopSubmission>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
): UseQueryResult<WorkshopSubmission[], Error> {
  return useQuery({
    queryKey: [...workshopQueryKeys.submissions(workshopId), params],
    queryFn: () => fetchWorkshopSubmissions(workshopId, params),
    enabled: workshopId > 0 && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 30 * 1000, // 30 seconds default
  });
}

/**
 * Hook for creating a workshop submission
 *
 * Creates or updates a student's work submission including:
 * - Title and content with rich text support
 * - File attachments
 * - Content trust settings
 *
 * Based on submission.php lines 153-160 (submission editing)
 *
 * @returns React Query mutation for creating submissions
 *
 * @example
 * ```tsx
 * const createSubmission = useCreateSubmission();
 *
 * const handleSubmit = async (data: SubmissionFormData) => {
 *   try {
 *     await createSubmission.mutateAsync({
 *       workshopId,
 *       title: data.title,
 *       content: data.content,
 *     });
 *     toast.success('Submission created successfully');
 *   } catch (error) {
 *     toast.error('Failed to create submission');
 *   }
 * };
 * ```
 */
export function useCreateSubmission(): UseMutationResult<
  WorkshopSubmission,
  Error,
  CreateSubmissionParams
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSubmission,
    onSuccess: (data, variables) => {
      // Invalidate related queries to trigger refetch
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.submissions(variables.workshopId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.detail(variables.workshopId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.userPlan(variables.workshopId),
      });
    },
  });
}

/**
 * Hook for deleting a workshop submission
 *
 * Deletes a submission if the user has permission and the submission
 * has not yet been assessed by peers.
 *
 * Based on submission.php lines 107-112 (submission deletion)
 *
 * @returns React Query mutation for deleting submissions
 *
 * @example
 * ```tsx
 * const deleteSubmission = useDeleteSubmission();
 *
 * const handleDelete = async (submissionId: number) => {
 *   if (confirm('Delete this submission?')) {
 *     await deleteSubmission.mutateAsync({
 *       workshopId,
 *       submissionId,
 *     });
 *   }
 * };
 * ```
 */
export function useDeleteSubmission(): UseMutationResult<
  void,
  Error,
  { workshopId: number; submissionId: number }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ submissionId }) => deleteSubmission(submissionId),
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.submissions(variables.workshopId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.detail(variables.workshopId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.userPlan(variables.workshopId),
      });
    },
  });
}

/**
 * Hook for fetching assessments for a workshop
 *
 * Retrieves all peer assessments including:
 * - Reviewer information
 * - Assessment grades and feedback
 * - Assessment weight and status
 *
 * Based on assessment.php lines 40-45 (assessment loading)
 *
 * @param workshopId - ID of the workshop
 * @param options - Optional query options
 * @returns React Query result with assessments list
 *
 * @example
 * ```tsx
 * const { data: assessments } = useWorkshopAssessments(workshopId);
 *
 * return (
 *   <AssessmentList assessments={assessments} />
 * );
 * ```
 */
export function useWorkshopAssessments(
  workshopId: number,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
): UseQueryResult<WorkshopAssessment[], Error> {
  return useQuery({
    queryKey: workshopQueryKeys.workshopAssessments(workshopId),
    queryFn: async () => {
      // First fetch submissions, then fetch all assessments
      const submissions = await fetchWorkshopSubmissions(workshopId);
      const assessmentsPromises = submissions.map((submission) =>
        fetchAssessments(submission.id)
      );
      const assessmentsArrays = await Promise.all(assessmentsPromises);
      return assessmentsArrays.flat();
    },
    enabled: workshopId > 0 && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 30 * 1000, // 30 seconds default
  });
}

/**
 * Hook for creating a peer assessment
 *
 * Submits a peer assessment including:
 * - Dimension grades based on grading strategy
 * - Overall feedback to the author
 * - Optional file attachments for feedback
 *
 * Based on assessment.php lines 124-143 (assessment submission)
 *
 * @returns React Query mutation for creating assessments
 *
 * @example
 * ```tsx
 * const createAssessment = useCreateAssessment();
 *
 * const handleAssess = async (formData: WorkshopAssessmentFormData) => {
 *   try {
 *     await createAssessment.mutateAsync({
 *       submissionId,
 *       formData,
 *     });
 *     toast.success('Assessment submitted successfully');
 *   } catch (error) {
 *     toast.error('Failed to submit assessment');
 *   }
 * };
 * ```
 */
export function useCreateAssessment(): UseMutationResult<
  WorkshopAssessment,
  Error,
  CreateAssessmentParams & { workshopId: number }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ submissionId, formData }) =>
      createAssessment({ submissionId, formData }),
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.assessments(variables.submissionId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.workshopAssessments(variables.workshopId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.submissions(variables.workshopId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.userPlan(variables.workshopId),
      });
    },
  });
}

/**
 * Hook for switching workshop phase
 *
 * Allows teachers/admins to transition the workshop to a new phase:
 * - SETUP → SUBMISSION: Opens submission period
 * - SUBMISSION → ASSESSMENT: Closes submissions, opens peer review
 * - ASSESSMENT → EVALUATION: Closes assessment, starts grade calculation
 * - EVALUATION → CLOSED: Finalizes workshop and publishes grades
 *
 * Based on view.php lines 63-70 (phase switching)
 *
 * @returns React Query mutation for switching phases
 *
 * @example
 * ```tsx
 * const switchPhase = useSwitchWorkshopPhase();
 *
 * const handleSwitchToAssessment = async () => {
 *   await switchPhase.mutateAsync({
 *     workshopId,
 *     targetPhase: WorkshopPhase.ASSESSMENT,
 *   });
 * };
 * ```
 */
export function useSwitchWorkshopPhase(): UseMutationResult<
  Workshop,
  Error,
  SwitchPhaseParams
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: switchWorkshopPhase,
    onSuccess: (_, variables) => {
      // Invalidate all workshop-related queries
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.detail(variables.workshopId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.userPlan(variables.workshopId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.submissions(variables.workshopId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.workshopAssessments(variables.workshopId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.grades(variables.workshopId),
      });
    },
  });
}

/**
 * Hook for allocating reviewers to submissions
 *
 * Allocates peer reviewers to submissions using various methods:
 * - Manual: Teacher manually assigns reviewers
 * - Random: System randomly distributes submissions to reviewers
 * - Scheduled: Automatic allocation at a specified time
 *
 * Based on allocation.php lines 33-57 (allocation methods)
 *
 * @returns React Query mutation for allocating reviewers
 *
 * @example
 * ```tsx
 * const allocateReviewers = useAllocateReviewers();
 *
 * const handleRandomAllocate = async () => {
 *   const result = await allocateReviewers.mutateAsync({
 *     workshopId,
 *     method: 'random',
 *     settings: {
 *       numOfReviews: 3,
 *       excludeSameGroup: true,
 *     },
 *   });
 *   toast.success(`Allocated ${result.allocated} reviews`);
 * };
 * ```
 */
export function useAllocateReviewers(): UseMutationResult<
  AllocationResult,
  Error,
  AllocateReviewersParams
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: allocateReviewers,
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.submissions(variables.workshopId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.workshopAssessments(variables.workshopId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.userPlan(variables.workshopId),
      });
    },
  });
}

/**
 * Hook for fetching workshop grades
 *
 * Retrieves all grades for a workshop including:
 * - Submission grades (grade for submitted work)
 * - Grading grades (grade for quality of assessments given)
 * - Final calculated grades
 *
 * @param workshopId - ID of the workshop
 * @param options - Optional query options
 * @returns React Query result with grades list
 *
 * @example
 * ```tsx
 * const { data: grades } = useWorkshopGrades(workshopId);
 *
 * return (
 *   <GradeTable grades={grades} />
 * );
 * ```
 */
export function useWorkshopGrades(
  workshopId: number,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
): UseQueryResult<WorkshopGrade[], Error> {
  return useQuery({
    queryKey: workshopQueryKeys.grades(workshopId),
    queryFn: () => fetchWorkshopGrades(workshopId),
    enabled: workshopId > 0 && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 60 * 1000, // 1 minute default
  });
}

/**
 * Hook for updating a workshop grade
 *
 * Allows teachers to override or adjust grades including:
 * - Submission grade override
 * - Grading grade override
 * - Feedback to the author
 * - Publication status
 *
 * @returns React Query mutation for updating grades
 *
 * @example
 * ```tsx
 * const updateGrade = useUpdateWorkshopGrade();
 *
 * const handleGradeOverride = async (submissionId: number, grade: number) => {
 *   await updateGrade.mutateAsync({
 *     workshopId,
 *     submissionId,
 *     grade,
 *     feedbackAuthor: 'Good work on your submission!',
 *   });
 * };
 * ```
 */
export function useUpdateWorkshopGrade(): UseMutationResult<
  WorkshopSubmission,
  Error,
  UpdateGradeParams
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateWorkshopGrade,
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.grades(variables.workshopId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.submissions(variables.workshopId),
      });
    },
  });
}

// ============================================================================
// Additional Utility Hooks
// ============================================================================

/**
 * Hook for updating an existing submission
 *
 * @returns React Query mutation for updating submissions
 */
export function useUpdateSubmission(): UseMutationResult<
  WorkshopSubmission,
  Error,
  UpdateSubmissionParams & { workshopId: number }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ submissionId, ...data }) =>
      updateSubmission({ submissionId, ...data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.submissions(variables.workshopId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.detail(variables.workshopId),
      });
    },
  });
}

/**
 * Hook for updating an existing assessment
 *
 * @returns React Query mutation for updating assessments
 */
export function useUpdateAssessment(): UseMutationResult<
  WorkshopAssessment,
  Error,
  { workshopId: number; submissionId: number; assessmentId: number; formData: WorkshopAssessmentFormData }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assessmentId, formData }) =>
      updateAssessment(assessmentId, formData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.assessments(variables.submissionId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.workshopAssessments(variables.workshopId),
      });
      queryClient.invalidateQueries({
        queryKey: workshopQueryKeys.userPlan(variables.workshopId),
      });
    },
  });
}

/**
 * Hook for fetching assessments for a specific submission
 *
 * @param submissionId - ID of the submission
 * @param options - Optional query options
 * @returns React Query result with assessments list
 */
export function useSubmissionAssessments(
  submissionId: number,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
): UseQueryResult<WorkshopAssessment[], Error> {
  return useQuery({
    queryKey: workshopQueryKeys.assessments(submissionId),
    queryFn: () => fetchAssessments(submissionId),
    enabled: submissionId > 0 && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 30 * 1000,
  });
}
