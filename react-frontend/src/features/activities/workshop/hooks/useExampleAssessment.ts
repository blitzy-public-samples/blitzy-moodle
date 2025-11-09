/**
 * React Query hooks for managing example submission assessments in workshop activities
 * 
 * This module provides hooks for:
 * - Fetching example submissions and assessments
 * - Creating, updating, and submitting example assessments
 * - Comparing user assessments with reference assessments
 * 
 * Example assessments are used for training users on the grading strategy
 * before they assess actual peer submissions.
 * 
 * @module features/activities/workshop/hooks/useExampleAssessment
 */

import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';

/**
 * Interface for example submission data
 * Extends WorkshopSubmission with example=true flag
 */
interface ExampleSubmission {
  id: number;
  workshopid: number;
  example: boolean;
  authorid: number;
  timecreated: number;
  timemodified: number;
  title: string;
  content: string;
  contentformat: number;
  contenttrust: number;
  attachment: number;
  grade: number | null;
  gradeover: number | null;
  gradeoverby: number | null;
  feedbackauthor: string | null;
  feedbackauthorformat: number;
  feedbackauthorattachment: number;
  timegraded: number | null;
  published: boolean;
  late: boolean;
}

/**
 * Interface for assessment dimension data
 */
interface AssessmentDimension {
  id: number;
  assessmentid: number;
  strategy: string;
  dimensionid: number;
  grade: number;
  peercomment: string | null;
  peercommentformat: number;
}

/**
 * Interface for example assessment data
 */
interface ExampleAssessment {
  id: number;
  submissionid: number;
  reviewerid: number;
  weight: number;
  timecreated: number;
  timemodified: number;
  grade: number | null;
  gradinggrade: number | null;
  gradinggradeover: number | null;
  gradinggradeoverby: number | null;
  feedbackauthor: string | null;
  feedbackauthorformat: number;
  feedbackauthorattachment: number;
  feedbackreviewer: string | null;
  feedbackreviewerformat: number;
  dimensions: AssessmentDimension[];
}

/**
 * Interface for dimension score difference
 */
interface DimensionDifference {
  dimensionid: number;
  dimensionname: string;
  usergrade: number;
  referencegrade: number;
  difference: number;
  percentdifference: number;
}

/**
 * Interface for assessment comparison data
 */
interface AssessmentComparison {
  exampleid: number;
  userAssessment: ExampleAssessment;
  referenceAssessment: ExampleAssessment;
  dimensionDifferences: DimensionDifference[];
  overallDifference: number;
  overallPercentDifference: number;
  feedback: string;
  assessmentQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Interface for creating a new example assessment
 */
interface CreateExampleAssessmentInput {
  exampleId: number;
  dimensions: {
    dimensionid: number;
    grade: number;
    peercomment?: string;
  }[];
  feedbackauthor?: string;
  feedbackauthorformat?: number;
}

/**
 * Interface for updating an example assessment
 */
interface UpdateExampleAssessmentInput {
  assessmentId: number;
  dimensions?: {
    dimensionid: number;
    grade: number;
    peercomment?: string;
  }[];
  feedbackauthor?: string;
  feedbackauthorformat?: number;
}

/**
 * Interface for submitting an example assessment
 */
interface SubmitExampleAssessmentInput {
  assessmentId: number;
}

/**
 * Hook to fetch example submission details
 * 
 * Retrieves an example submission by ID, which includes all submission
 * data with the example flag set to true.
 * 
 * @param exampleId - The ID of the example submission
 * @returns Query result containing the example submission data
 * 
 * @example
 * ```tsx
 * const { data: example, isLoading, error } = useExampleSubmission(123);
 * 
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 * 
 * return <ExampleSubmissionView submission={example} />;
 * ```
 */
export function useExampleSubmission(
  exampleId: number
): UseQueryResult<ExampleSubmission, Error> {
  return useQuery<ExampleSubmission, Error>({
    queryKey: ['workshop', 'examples', exampleId],
    queryFn: async () => {
      const response = await apiClient.get<{
        success: boolean;
        data: ExampleSubmission;
      }>(`/api/v1/workshop/examples/${exampleId}`);
      
      if (!response.data.success) {
        throw new Error('Failed to fetch example submission');
      }
      
      return response.data.data;
    },
    enabled: !!exampleId && exampleId > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

/**
 * Hook to fetch an existing example assessment
 * 
 * Retrieves the user's assessment of an example submission, including
 * all dimension grades and feedback.
 * 
 * @param assessmentId - The ID of the assessment to fetch
 * @returns Query result containing the assessment data
 * 
 * @example
 * ```tsx
 * const { data: assessment, isLoading } = useExampleAssessment(456);
 * 
 * if (isLoading) return <LoadingSpinner />;
 * 
 * return <AssessmentForm assessment={assessment} />;
 * ```
 */
export function useExampleAssessment(
  assessmentId: number
): UseQueryResult<ExampleAssessment, Error> {
  return useQuery<ExampleAssessment, Error>({
    queryKey: ['workshop', 'examples', 'assessments', assessmentId],
    queryFn: async () => {
      const response = await apiClient.get<{
        success: boolean;
        data: ExampleAssessment;
      }>(`/api/v1/workshop/examples/assessments/${assessmentId}`);
      
      if (!response.data.success) {
        throw new Error('Failed to fetch example assessment');
      }
      
      return response.data.data;
    },
    enabled: !!assessmentId && assessmentId > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
  });
}

/**
 * Hook to create a new example assessment
 * 
 * Creates a new assessment for an example submission. This is used when
 * a user first starts assessing an example for training purposes.
 * 
 * The mutation automatically invalidates related queries on success to
 * ensure the UI reflects the new assessment.
 * 
 * @returns Mutation object for creating example assessments
 * 
 * @example
 * ```tsx
 * const createAssessment = useCreateExampleAssessment();
 * 
 * const handleCreate = async () => {
 *   try {
 *     const assessment = await createAssessment.mutateAsync({
 *       exampleId: 123,
 *       dimensions: [
 *         { dimensionid: 1, grade: 85, peercomment: 'Good work' },
 *         { dimensionid: 2, grade: 90 }
 *       ],
 *       feedbackauthor: 'Overall excellent submission'
 *     });
 *     console.log('Created assessment:', assessment);
 *   } catch (error) {
 *     console.error('Failed to create assessment:', error);
 *   }
 * };
 * ```
 */
export function useCreateExampleAssessment(): UseMutationResult<
  ExampleAssessment,
  Error,
  CreateExampleAssessmentInput
> {
  const queryClient = useQueryClient();
  
  return useMutation<ExampleAssessment, Error, CreateExampleAssessmentInput>({
    mutationFn: async (input: CreateExampleAssessmentInput) => {
      const response = await apiClient.post<{
        success: boolean;
        data: ExampleAssessment;
      }>(`/api/v1/workshop/examples/${input.exampleId}/assessments`, {
        dimensions: input.dimensions,
        feedbackauthor: input.feedbackauthor,
        feedbackauthorformat: input.feedbackauthorformat ?? 1,
      });
      
      if (!response.data.success) {
        throw new Error('Failed to create example assessment');
      }
      
      return response.data.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate example submission query to reflect new assessment
      void queryClient.invalidateQueries({
        queryKey: ['workshop', 'examples', variables.exampleId],
      });
      
      // Invalidate workshop examples list
      void queryClient.invalidateQueries({
        queryKey: ['workshops', 'examples'],
      });
      
      // Set the new assessment data in cache
      queryClient.setQueryData(
        ['workshop', 'examples', 'assessments', data.id],
        data
      );
    },
    onError: (error) => {
      console.error('Error creating example assessment:', error);
    },
  });
}

/**
 * Hook to update an existing example assessment
 * 
 * Updates assessment dimensions, grades, and feedback. Supports partial
 * updates - only provided fields will be modified.
 * 
 * Implements optimistic updates for better UX - the UI updates immediately
 * before the server confirms the change.
 * 
 * @returns Mutation object for updating example assessments
 * 
 * @example
 * ```tsx
 * const updateAssessment = useUpdateExampleAssessment();
 * 
 * const handleUpdate = async () => {
 *   try {
 *     await updateAssessment.mutateAsync({
 *       assessmentId: 456,
 *       dimensions: [
 *         { dimensionid: 1, grade: 95, peercomment: 'Revised comment' }
 *       ],
 *       feedbackauthor: 'Updated feedback'
 *     });
 *   } catch (error) {
 *     console.error('Failed to update assessment:', error);
 *   }
 * };
 * ```
 */
export function useUpdateExampleAssessment(): UseMutationResult<
  ExampleAssessment,
  Error,
  UpdateExampleAssessmentInput,
  { previousAssessment: ExampleAssessment | undefined }
> {
  const queryClient = useQueryClient();
  
  return useMutation<
    ExampleAssessment,
    Error,
    UpdateExampleAssessmentInput,
    { previousAssessment: ExampleAssessment | undefined }
  >({
    mutationFn: async (input: UpdateExampleAssessmentInput) => {
      const response = await apiClient.put<{
        success: boolean;
        data: ExampleAssessment;
      }>(`/api/v1/workshop/examples/assessments/${input.assessmentId}`, {
        dimensions: input.dimensions,
        feedbackauthor: input.feedbackauthor,
        feedbackauthorformat: input.feedbackauthorformat,
      });
      
      if (!response.data.success) {
        throw new Error('Failed to update example assessment');
      }
      
      return response.data.data;
    },
    onMutate: async (variables) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ['workshop', 'examples', 'assessments', variables.assessmentId],
      });
      
      // Snapshot the previous value for rollback
      const previousAssessment = queryClient.getQueryData<ExampleAssessment>([
        'workshop',
        'examples',
        'assessments',
        variables.assessmentId,
      ]);
      
      // Optimistically update the assessment
      if (previousAssessment) {
        queryClient.setQueryData<ExampleAssessment>(
          ['workshop', 'examples', 'assessments', variables.assessmentId],
          {
            ...previousAssessment,
            timemodified: Math.floor(Date.now() / 1000),
            feedbackauthor: variables.feedbackauthor ?? previousAssessment.feedbackauthor,
            feedbackauthorformat: variables.feedbackauthorformat ?? previousAssessment.feedbackauthorformat,
            dimensions: variables.dimensions
              ? previousAssessment.dimensions.map(dim => {
                  const update = variables.dimensions?.find(d => d.dimensionid === dim.dimensionid);
                  return update ? { ...dim, ...update } : dim;
                })
              : previousAssessment.dimensions,
          }
        );
      }
      
      return { previousAssessment };
    },
    onError: (error, variables, context) => {
      // Rollback to previous value on error
      if (context?.previousAssessment) {
        queryClient.setQueryData(
          ['workshop', 'examples', 'assessments', variables.assessmentId],
          context.previousAssessment
        );
      }
      console.error('Error updating example assessment:', error);
    },
    onSuccess: (data, variables) => {
      // Update the assessment in cache with server response
      queryClient.setQueryData(
        ['workshop', 'examples', 'assessments', variables.assessmentId],
        data
      );
      
      // Invalidate example submission to reflect updated assessment
      if (data.submissionid) {
        void queryClient.invalidateQueries({
          queryKey: ['workshop', 'examples', data.submissionid],
        });
      }
    },
  });
}

/**
 * Hook to submit (finalize) an example assessment
 * 
 * Marks an example assessment as complete and submits it for comparison
 * with the reference assessment. Once submitted, the assessment typically
 * cannot be edited further.
 * 
 * @returns Mutation object for submitting example assessments
 * 
 * @example
 * ```tsx
 * const submitAssessment = useSubmitExampleAssessment();
 * 
 * const handleSubmit = async () => {
 *   if (window.confirm('Submit this assessment? You cannot edit it after submission.')) {
 *     try {
 *       await submitAssessment.mutateAsync({ assessmentId: 456 });
 *       navigate(`/workshop/compare/${exampleId}/${assessmentId}`);
 *     } catch (error) {
 *       console.error('Failed to submit assessment:', error);
 *     }
 *   }
 * };
 * ```
 */
export function useSubmitExampleAssessment(): UseMutationResult<
  ExampleAssessment,
  Error,
  SubmitExampleAssessmentInput
> {
  const queryClient = useQueryClient();
  
  return useMutation<ExampleAssessment, Error, SubmitExampleAssessmentInput>({
    mutationFn: async (input: SubmitExampleAssessmentInput) => {
      const response = await apiClient.post<{
        success: boolean;
        data: ExampleAssessment;
      }>(`/api/v1/workshop/examples/assessments/${input.assessmentId}/submit`, {});
      
      if (!response.data.success) {
        throw new Error('Failed to submit example assessment');
      }
      
      return response.data.data;
    },
    onSuccess: (data, variables) => {
      // Update the assessment in cache
      queryClient.setQueryData(
        ['workshop', 'examples', 'assessments', variables.assessmentId],
        data
      );
      
      // Invalidate example submission
      if (data.submissionid) {
        void queryClient.invalidateQueries({
          queryKey: ['workshop', 'examples', data.submissionid],
        });
      }
      
      // Invalidate workshop examples list to update completion status
      void queryClient.invalidateQueries({
        queryKey: ['workshops', 'examples'],
      });
      
      // Invalidate comparison query as it may now be available
      void queryClient.invalidateQueries({
        queryKey: ['workshop', 'examples', data.submissionid, 'compare', variables.assessmentId],
      });
    },
    onError: (error) => {
      console.error('Error submitting example assessment:', error);
    },
  });
}

/**
 * Hook to fetch assessment comparison data
 * 
 * Retrieves a comparison between the user's assessment and the reference
 * assessment for an example submission. This shows dimension-by-dimension
 * differences and provides feedback on assessment quality.
 * 
 * This query is typically used after an example assessment has been submitted
 * to help users learn the grading strategy.
 * 
 * @param exampleId - The ID of the example submission
 * @param assessmentId - The ID of the user's assessment
 * @returns Query result containing comparison data
 * 
 * @example
 * ```tsx
 * const { data: comparison, isLoading } = useExampleAssessmentComparison(123, 456);
 * 
 * if (isLoading) return <LoadingSpinner />;
 * 
 * return (
 *   <ComparisonView
 *     userAssessment={comparison.userAssessment}
 *     referenceAssessment={comparison.referenceAssessment}
 *     differences={comparison.dimensionDifferences}
 *     quality={comparison.assessmentQuality}
 *     feedback={comparison.feedback}
 *   />
 * );
 * ```
 */
export function useExampleAssessmentComparison(
  exampleId: number,
  assessmentId: number
): UseQueryResult<AssessmentComparison, Error> {
  return useQuery<AssessmentComparison, Error>({
    queryKey: ['workshop', 'examples', exampleId, 'compare', assessmentId],
    queryFn: async () => {
      const response = await apiClient.get<{
        success: boolean;
        data: AssessmentComparison;
      }>(`/api/v1/workshop/examples/${exampleId}/compare/${assessmentId}`);
      
      if (!response.data.success) {
        throw new Error('Failed to fetch assessment comparison');
      }
      
      return response.data.data;
    },
    enabled: !!exampleId && exampleId > 0 && !!assessmentId && assessmentId > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes - comparison data is relatively stable
    retry: 2,
  });
}
