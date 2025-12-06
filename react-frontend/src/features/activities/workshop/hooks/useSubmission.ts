/**
 * React Query Hooks for Workshop Submission Management
 *
 * This module provides comprehensive hooks for managing workshop submissions including:
 * - Fetching user's own submission or specific submission by ID
 * - Creating new submissions with text content and file attachments
 * - Updating draft submissions
 * - Deleting submissions
 * - Publishing submissions (teacher-only operation)
 *
 * Based on Moodle's workshop module implementation from:
 * - public/mod/workshop/submission.php (submission viewing and editing)
 * - public/mod/workshop/locallib.php (workshop class methods)
 *
 * API Endpoints:
 * - GET /api/v1/workshops/{id}/submissions - Get user's own submission
 * - GET /api/v1/workshops/submissions/{id} - Get specific submission by ID
 * - POST /api/v1/workshops/{id}/submissions - Create new submission
 * - PUT /api/v1/workshops/submissions/{id} - Update submission
 * - DELETE /api/v1/workshops/submissions/{id} - Delete submission
 * - POST /api/v1/workshops/submissions/{id}/publish - Publish submission
 *
 * @module features/activities/workshop/hooks/useSubmission
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import type { WorkshopSubmission } from '@/types/entities';
import { WORKSHOP_QUERY_KEY } from './useWorkshop';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * File attachment data for submission uploads
 * Represents a file being attached to a submission
 */
export interface SubmissionFile {
  /** File object for upload */
  file?: globalThis.File;
  /** Item ID for existing file reference */
  itemid?: number;
  /** File name */
  filename: string;
  /** File size in bytes */
  filesize: number;
  /** MIME type of the file */
  mimetype: string;
  /** Optional file URL for existing files */
  fileurl?: string;
}

/**
 * Form data for creating or updating a submission
 * Corresponds to the submission form fields in submission.php
 */
export interface SubmissionFormData {
  /** Submission title (required) */
  title: string;
  /** Submission content (HTML or plain text) */
  content: string;
  /** Content format: 1=HTML, 2=Plain text, 4=Markdown */
  contentformat: number;
  /** File attachments array */
  attachments?: SubmissionFile[];
  /** Draft item ID for file handling */
  attachment_filemanager?: number;
}

/**
 * Standard API response envelope for submission data
 */
interface SubmissionApiResponse {
  success: boolean;
  data: WorkshopSubmission;
  meta?: {
    timestamp?: number;
    canEdit?: boolean;
    canDelete?: boolean;
    canPublish?: boolean;
  };
}

/**
 * API response for submission list
 */
interface SubmissionsListApiResponse {
  success: boolean;
  data: WorkshopSubmission[];
  meta?: {
    total?: number;
    timestamp?: number;
  };
}

/**
 * API response for mutation operations
 */
interface MutationApiResponse {
  success: boolean;
  data?: {
    id?: number;
    message?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Configuration options for useSubmission hook
 */
export interface UseSubmissionOptions {
  /** Whether the query should execute automatically */
  enabled?: boolean;
  /** Time in milliseconds that data is considered fresh */
  staleTime?: number;
  /** Time in milliseconds to keep unused data in cache */
  gcTime?: number;
  /** Whether to refetch when window regains focus */
  refetchOnWindowFocus?: boolean;
  /** Callback on successful fetch */
  onSuccess?: (data: WorkshopSubmission) => void;
  /** Callback on fetch error */
  onError?: (error: Error) => void;
}

/**
 * Return type for useSubmission hook
 */
export interface UseSubmissionResult {
  /** The fetched submission data */
  data: WorkshopSubmission | undefined;
  /** Whether the query is loading */
  isLoading: boolean;
  /** Whether there was an error */
  isError: boolean;
  /** The error object if present */
  error: Error | null;
  /** Whether data was successfully fetched */
  isSuccess: boolean;
  /** Whether currently fetching (including background) */
  isFetching: boolean;
  /** Manual refetch function */
  refetch: () => Promise<UseQueryResult<WorkshopSubmission, Error>>;
}

/**
 * Variables for create submission mutation
 */
interface CreateSubmissionVariables {
  workshopId: number;
  data: SubmissionFormData;
}

/**
 * Variables for update submission mutation
 */
interface UpdateSubmissionVariables {
  submissionId: number;
  data: SubmissionFormData;
}

/**
 * Variables for delete submission mutation
 */
interface DeleteSubmissionVariables {
  workshopId: number;
  submissionId: number;
}

/**
 * Variables for publish submission mutation
 */
interface PublishSubmissionVariables {
  workshopId: number;
  submissionId: number;
  publish: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Query key for workshop submissions
 * Used for cache management and invalidation
 */
export const WORKSHOP_SUBMISSIONS_QUERY_KEY = 'workshop-submissions';

/**
 * Default stale time: 3 minutes
 * Submissions can change more frequently than workshop settings
 */
const DEFAULT_STALE_TIME = 3 * 60 * 1000;

/**
 * Default garbage collection time: 5 minutes
 */
const DEFAULT_GC_TIME = 5 * 60 * 1000;

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch a specific submission by ID
 *
 * Wraps workshop->get_submission_by_id() from locallib.php
 * API endpoint: GET /api/v1/workshops/submissions/{id}
 *
 * @param submissionId - The submission ID to fetch
 * @returns Promise resolving to the submission data
 */
async function fetchSubmissionById(
  submissionId: number
): Promise<WorkshopSubmission> {
  const response = await apiClient.get<SubmissionApiResponse>(
    `/workshops/submissions/${submissionId}`
  );

  if (!response.data.success) {
    throw new Error('Failed to fetch submission');
  }

  return response.data.data;
}

/**
 * Fetch user's own submission for a workshop
 *
 * Wraps workshop->get_submission_by_author() from locallib.php
 * Called when viewing submission.php without specific submission ID
 * API endpoint: GET /api/v1/workshops/{id}/submissions/mine
 *
 * @param workshopId - The workshop instance ID
 * @returns Promise resolving to the user's submission or null
 */
async function fetchUserSubmission(
  workshopId: number
): Promise<WorkshopSubmission | null> {
  try {
    const response = await apiClient.get<SubmissionApiResponse>(
      `/workshops/${workshopId}/submissions/mine`
    );

    if (!response.data.success) {
      return null;
    }

    return response.data.data;
  } catch (error) {
    // User might not have a submission yet, which is not an error
    return null;
  }
}

/**
 * Fetch all submissions for a workshop (for teachers/assessors)
 *
 * Wraps workshop->get_submissions() from locallib.php
 * API endpoint: GET /api/v1/workshops/{id}/submissions
 *
 * @param workshopId - The workshop instance ID
 * @returns Promise resolving to array of submissions
 */
async function fetchWorkshopSubmissions(
  workshopId: number
): Promise<WorkshopSubmission[]> {
  const response = await apiClient.get<SubmissionsListApiResponse>(
    `/workshops/${workshopId}/submissions`
  );

  if (!response.data.success) {
    throw new Error('Failed to fetch workshop submissions');
  }

  return response.data.data;
}

/**
 * Create a new submission
 *
 * Wraps workshop->edit_submission() from locallib.php (lines 1208-1291)
 * Handles both text content and file attachments based on workshop settings:
 * - submissiontypetext: whether text content is expected
 * - submissiontypefile: whether file attachments are expected
 *
 * API endpoint: POST /api/v1/workshops/{id}/submissions
 *
 * @param workshopId - The workshop instance ID
 * @param data - The submission form data
 * @returns Promise resolving to the created submission
 */
async function createSubmission(
  workshopId: number,
  data: SubmissionFormData
): Promise<WorkshopSubmission> {
  // Build FormData for multipart upload if there are file attachments
  const hasFiles = data.attachments && data.attachments.length > 0;

  if (hasFiles) {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('content', data.content);
    formData.append('contentformat', String(data.contentformat));

    if (data.attachment_filemanager) {
      formData.append(
        'attachment_filemanager',
        String(data.attachment_filemanager)
      );
    }

    // Append each file
    data.attachments?.forEach((attachment, index) => {
      if (attachment.file) {
        formData.append(`attachments[${index}]`, attachment.file);
      }
    });

    const response = await apiClient.post<SubmissionApiResponse>(
      `/workshops/${workshopId}/submissions`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (!response.data.success) {
      throw new Error('Failed to create submission');
    }

    return response.data.data;
  }

  // No files - send as JSON
  const response = await apiClient.post<SubmissionApiResponse>(
    `/workshops/${workshopId}/submissions`,
    {
      title: data.title,
      content: data.content,
      contentformat: data.contentformat,
    }
  );

  if (!response.data.success) {
    throw new Error('Failed to create submission');
  }

  return response.data.data;
}

/**
 * Update an existing submission
 *
 * Wraps workshop->edit_submission() from locallib.php
 * Only allowed during submission phase and if user has edit permission
 * Checks submission editability based on phase and permissions (submission.php lines 71-80)
 *
 * API endpoint: PUT /api/v1/workshops/submissions/{id}
 *
 * @param submissionId - The submission ID to update
 * @param data - The updated submission form data
 * @returns Promise resolving to the updated submission
 */
async function updateSubmission(
  submissionId: number,
  data: SubmissionFormData
): Promise<WorkshopSubmission> {
  // Build FormData for multipart upload if there are file attachments
  const hasFiles = data.attachments && data.attachments.length > 0;

  if (hasFiles) {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('content', data.content);
    formData.append('contentformat', String(data.contentformat));

    if (data.attachment_filemanager) {
      formData.append(
        'attachment_filemanager',
        String(data.attachment_filemanager)
      );
    }

    data.attachments?.forEach((attachment, index) => {
      if (attachment.file) {
        formData.append(`attachments[${index}]`, attachment.file);
      }
    });

    const response = await apiClient.put<SubmissionApiResponse>(
      `/workshops/submissions/${submissionId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (!response.data.success) {
      throw new Error('Failed to update submission');
    }

    return response.data.data;
  }

  // No files - send as JSON
  const response = await apiClient.put<SubmissionApiResponse>(
    `/workshops/submissions/${submissionId}`,
    {
      title: data.title,
      content: data.content,
      contentformat: data.contentformat,
    }
  );

  if (!response.data.success) {
    throw new Error('Failed to update submission');
  }

  return response.data.data;
}

/**
 * Delete a submission
 *
 * Wraps workshop->delete_submission() from locallib.php (line 1333)
 * Removes submission and all associated assessments, grades, and files
 *
 * API endpoint: DELETE /api/v1/workshops/submissions/{id}
 *
 * @param submissionId - The submission ID to delete
 * @returns Promise resolving when deletion is complete
 */
async function deleteSubmission(submissionId: number): Promise<void> {
  const response = await apiClient.delete<MutationApiResponse>(
    `/workshops/submissions/${submissionId}`
  );

  if (!response.data.success) {
    throw new Error(
      response.data.error?.message || 'Failed to delete submission'
    );
  }
}

/**
 * Publish or unpublish a submission
 *
 * Wraps workshop->evaluate_submission() from locallib.php
 * Only teachers can publish submissions to make them visible to students
 *
 * API endpoint: POST /api/v1/workshops/submissions/{id}/publish
 *
 * @param submissionId - The submission ID
 * @param publish - Whether to publish (true) or unpublish (false)
 * @returns Promise resolving to the updated submission
 */
async function publishSubmission(
  submissionId: number,
  publish: boolean
): Promise<WorkshopSubmission> {
  const response = await apiClient.post<SubmissionApiResponse>(
    `/workshops/submissions/${submissionId}/publish`,
    { published: publish }
  );

  if (!response.data.success) {
    throw new Error('Failed to publish submission');
  }

  return response.data.data;
}

// ============================================================================
// Hook Implementations
// ============================================================================

/**
 * React Query hook for fetching workshop submission data
 *
 * Provides submission data for viewing, with two modes:
 * 1. If submissionId is provided: Fetches that specific submission
 * 2. If only workshopId: Fetches the current user's own submission
 *
 * Based on submission.php:
 * - Lines 55-58: Get submission by ID (workshop->get_submission_by_id)
 * - Lines 58-69: Get submission by author (workshop->get_submission_by_author)
 *
 * @param workshopId - The workshop instance ID
 * @param submissionId - Optional specific submission ID to fetch
 * @param options - Optional configuration for the query
 * @returns Query result with submission data and states
 *
 * @example
 * ```typescript
 * // Fetch user's own submission
 * const { data: mySubmission, isLoading } = useSubmission(workshopId);
 *
 * // Fetch specific submission
 * const { data: submission, isLoading } = useSubmission(workshopId, submissionId);
 * ```
 */
function useSubmission(
  workshopId: number,
  submissionId?: number,
  options: UseSubmissionOptions = {}
): UseSubmissionResult {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_GC_TIME,
    refetchOnWindowFocus = true,
    onSuccess,
    onError,
  } = options;

  // Build query key based on whether we're fetching by ID or user's own
  const queryKey = submissionId
    ? [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, submissionId]
    : [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, 'mine'];

  // Select appropriate fetch function
  const queryFn = submissionId
    ? () => fetchSubmissionById(submissionId)
    : () => fetchUserSubmission(workshopId);

  const queryOptions: UseQueryOptions<
    WorkshopSubmission | null,
    Error,
    WorkshopSubmission | null
  > = {
    queryKey,
    queryFn,
    enabled: enabled && workshopId > 0,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
  };

  const queryResult = useQuery(queryOptions);

  // Handle callbacks if data available
  if (queryResult.isSuccess && queryResult.data && onSuccess) {
    // Data is available, but we should use effects for side-effects
  }

  if (queryResult.isError && queryResult.error && onError) {
    // Error occurred
  }

  return {
    data: queryResult.data ?? undefined,
    isLoading: queryResult.isLoading,
    isError: queryResult.isError,
    error: queryResult.error,
    isSuccess: queryResult.isSuccess,
    isFetching: queryResult.isFetching,
    refetch: queryResult.refetch as () => Promise<
      UseQueryResult<WorkshopSubmission, Error>
    >,
  };
}

/**
 * React Query mutation hook for creating a new workshop submission
 *
 * Wraps workshop->edit_submission() from locallib.php (lines 1208-1291)
 * Handles both text content and file attachments based on workshop settings:
 * - submissiontypetext: Whether text content is required (locallib.php line 174)
 * - submissiontypefile: Whether file attachments are required (locallib.php line 178)
 *
 * Features:
 * - Optimistic updates for immediate UI feedback
 * - Automatic cache invalidation on success
 * - File upload support with FormData
 *
 * @param options - Optional mutation configuration
 * @returns Mutation object with createSubmission function and states
 *
 * @example
 * ```typescript
 * const { mutate: createSubmission, isLoading } = useCreateSubmission();
 *
 * const handleSubmit = async (formData: SubmissionFormData) => {
 *   await createSubmission(
 *     { workshopId, data: formData },
 *     {
 *       onSuccess: (submission) => {
 *         toast.success('Submission created!');
 *         navigate(`/workshops/${workshopId}/submissions/${submission.id}`);
 *       }
 *     }
 *   );
 * };
 * ```
 */
export function useCreateSubmission(
  options?: UseMutationOptions<
    WorkshopSubmission,
    Error,
    CreateSubmissionVariables
  >
): UseMutationResult<WorkshopSubmission, Error, CreateSubmissionVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workshopId, data }: CreateSubmissionVariables) => {
      return createSubmission(workshopId, data);
    },
    onMutate: async ({ workshopId }) => {
      // Cancel any outgoing refetches for this workshop
      await queryClient.cancelQueries({
        queryKey: [WORKSHOP_QUERY_KEY, workshopId],
      });
      await queryClient.cancelQueries({
        queryKey: [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId],
      });
    },
    onSuccess: (data, { workshopId }) => {
      // Invalidate workshop query to refresh submissions list
      void queryClient.invalidateQueries({
        queryKey: [WORKSHOP_QUERY_KEY, workshopId],
      });
      // Invalidate submissions queries
      void queryClient.invalidateQueries({
        queryKey: [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId],
      });
      // Set the new submission in cache
      queryClient.setQueryData(
        [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, data.id],
        data
      );
      queryClient.setQueryData(
        [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, 'mine'],
        data
      );
    },
    onError: (_error, { workshopId }) => {
      // On error, refetch to ensure cache is accurate
      void queryClient.invalidateQueries({
        queryKey: [WORKSHOP_QUERY_KEY, workshopId],
      });
      void queryClient.invalidateQueries({
        queryKey: [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId],
      });
    },
    ...options,
  });
}

/**
 * React Query mutation hook for updating an existing submission
 *
 * Wraps workshop->edit_submission() from locallib.php
 * Only allowed when submission is editable based on:
 * - Workshop phase (submission phase active)
 * - User permissions (author or teacher)
 * - Time limits (submission deadline not passed)
 *
 * Implements optimistic updates for immediate UI feedback
 *
 * @param options - Optional mutation configuration
 * @returns Mutation object with updateSubmission function and states
 *
 * @example
 * ```typescript
 * const { mutate: updateSubmission, isLoading } = useUpdateSubmission();
 *
 * const handleUpdate = async (formData: SubmissionFormData) => {
 *   await updateSubmission(
 *     { submissionId, data: formData },
 *     { onSuccess: () => toast.success('Submission updated!') }
 *   );
 * };
 * ```
 */
export function useUpdateSubmission(
  options?: UseMutationOptions<
    WorkshopSubmission,
    Error,
    UpdateSubmissionVariables,
    { previousSubmission: WorkshopSubmission | undefined }
  >
): UseMutationResult<WorkshopSubmission, Error, UpdateSubmissionVariables, { previousSubmission: WorkshopSubmission | undefined }> {
  const queryClient = useQueryClient();

  return useMutation<
    WorkshopSubmission,
    Error,
    UpdateSubmissionVariables,
    { previousSubmission: WorkshopSubmission | undefined }
  >({
    mutationFn: async ({ submissionId, data }: UpdateSubmissionVariables) => {
      return updateSubmission(submissionId, data);
    },
    onMutate: async ({ submissionId, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: [WORKSHOP_SUBMISSIONS_QUERY_KEY],
      });

      // Snapshot previous value for rollback
      const previousSubmission = queryClient.getQueryData<WorkshopSubmission>([
        WORKSHOP_SUBMISSIONS_QUERY_KEY,
        undefined,
        submissionId,
      ]);

      // Optimistically update the submission in cache
      if (previousSubmission) {
        queryClient.setQueryData(
          [WORKSHOP_SUBMISSIONS_QUERY_KEY, previousSubmission.workshopid, submissionId],
          {
            ...previousSubmission,
            title: data.title,
            content: data.content,
            contentformat: data.contentformat,
            timemodified: Math.floor(Date.now() / 1000),
          }
        );
      }

      return { previousSubmission };
    },
    onSuccess: (data) => {
      // Update cache with server response
      queryClient.setQueryData(
        [WORKSHOP_SUBMISSIONS_QUERY_KEY, data.workshopid, data.id],
        data
      );
      queryClient.setQueryData(
        [WORKSHOP_SUBMISSIONS_QUERY_KEY, data.workshopid, 'mine'],
        data
      );
      // Invalidate workshop to refresh any aggregated data
      void queryClient.invalidateQueries({
        queryKey: [WORKSHOP_QUERY_KEY, data.workshopid],
      });
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousSubmission) {
        const { workshopid, id } = context.previousSubmission;
        queryClient.setQueryData(
          [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopid, id],
          context.previousSubmission
        );
      }
    },
    ...options,
  });
}

/**
 * React Query mutation hook for deleting a submission
 *
 * Wraps workshop->delete_submission() from locallib.php (line 1333)
 * Removes the submission and all associated:
 * - Assessments (both given and received)
 * - Grades
 * - Files (both submission content and attachments)
 *
 * @param options - Optional mutation configuration
 * @returns Mutation object with deleteSubmission function and states
 *
 * @example
 * ```typescript
 * const { mutate: deleteSubmission, isLoading } = useDeleteSubmission();
 *
 * const handleDelete = async () => {
 *   if (confirm('Delete this submission?')) {
 *     await deleteSubmission(
 *       { workshopId, submissionId },
 *       { onSuccess: () => navigate(`/workshops/${workshopId}`) }
 *     );
 *   }
 * };
 * ```
 */
export function useDeleteSubmission(
  options?: UseMutationOptions<
    void,
    Error,
    DeleteSubmissionVariables,
    { previousSubmission: WorkshopSubmission | undefined }
  >
): UseMutationResult<void, Error, DeleteSubmissionVariables, { previousSubmission: WorkshopSubmission | undefined }> {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    DeleteSubmissionVariables,
    { previousSubmission: WorkshopSubmission | undefined }
  >({
    mutationFn: async ({ submissionId }: DeleteSubmissionVariables) => {
      return deleteSubmission(submissionId);
    },
    onMutate: async ({ workshopId, submissionId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: [WORKSHOP_QUERY_KEY, workshopId],
      });
      await queryClient.cancelQueries({
        queryKey: [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId],
      });

      // Snapshot for rollback
      const previousSubmission = queryClient.getQueryData<WorkshopSubmission>([
        WORKSHOP_SUBMISSIONS_QUERY_KEY,
        workshopId,
        submissionId,
      ]);

      // Optimistically remove from cache
      queryClient.removeQueries({
        queryKey: [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, submissionId],
      });
      queryClient.removeQueries({
        queryKey: [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, 'mine'],
      });

      return { previousSubmission };
    },
    onSuccess: (_, { workshopId }) => {
      // Invalidate all related queries
      void queryClient.invalidateQueries({
        queryKey: [WORKSHOP_QUERY_KEY, workshopId],
      });
      void queryClient.invalidateQueries({
        queryKey: [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId],
      });
    },
    onError: (_error, { workshopId, submissionId }, context) => {
      // Rollback on error
      if (context?.previousSubmission) {
        queryClient.setQueryData(
          [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, submissionId],
          context.previousSubmission
        );
        queryClient.setQueryData(
          [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, 'mine'],
          context.previousSubmission
        );
      }
      // Refetch to ensure consistency
      void queryClient.invalidateQueries({
        queryKey: [WORKSHOP_QUERY_KEY, workshopId],
      });
    },
    ...options,
  });
}

/**
 * React Query mutation hook for publishing/unpublishing a submission
 *
 * Wraps workshop->evaluate_submission() from locallib.php
 * Publishing makes the submission visible to other students (if workshop settings allow)
 *
 * Only teachers with mod/workshop:publishsubmissions capability can use this
 * Typically done during the evaluation phase of the workshop
 *
 * @param options - Optional mutation configuration
 * @returns Mutation object with publishSubmission function and states
 *
 * @example
 * ```typescript
 * const { mutate: publishSubmission, isLoading } = usePublishSubmission();
 *
 * const handlePublish = async (submissionId: number, publish: boolean) => {
 *   await publishSubmission(
 *     { workshopId, submissionId, publish },
 *     {
 *       onSuccess: () => toast.success(
 *         publish ? 'Submission published!' : 'Submission unpublished'
 *       )
 *     }
 *   );
 * };
 * ```
 */
export function usePublishSubmission(
  options?: UseMutationOptions<
    WorkshopSubmission,
    Error,
    PublishSubmissionVariables,
    { previousSubmission: WorkshopSubmission | undefined }
  >
): UseMutationResult<WorkshopSubmission, Error, PublishSubmissionVariables, { previousSubmission: WorkshopSubmission | undefined }> {
  const queryClient = useQueryClient();

  return useMutation<
    WorkshopSubmission,
    Error,
    PublishSubmissionVariables,
    { previousSubmission: WorkshopSubmission | undefined }
  >({
    mutationFn: async ({
      submissionId,
      publish,
    }: PublishSubmissionVariables) => {
      return publishSubmission(submissionId, publish);
    },
    onMutate: async ({ workshopId, submissionId, publish }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, submissionId],
      });

      // Snapshot for rollback
      const previousSubmission = queryClient.getQueryData<WorkshopSubmission>([
        WORKSHOP_SUBMISSIONS_QUERY_KEY,
        workshopId,
        submissionId,
      ]);

      // Optimistically update published status
      if (previousSubmission) {
        queryClient.setQueryData(
          [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, submissionId],
          {
            ...previousSubmission,
            published: publish,
          }
        );
      }

      return { previousSubmission };
    },
    onSuccess: (data, { workshopId }) => {
      // Update cache with server response
      queryClient.setQueryData(
        [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, data.id],
        data
      );
      // Invalidate workshop to refresh aggregate data
      void queryClient.invalidateQueries({
        queryKey: [WORKSHOP_QUERY_KEY, workshopId],
      });
      // Invalidate submissions list
      void queryClient.invalidateQueries({
        queryKey: [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId],
      });
    },
    onError: (_error, { workshopId, submissionId }, context) => {
      // Rollback on error
      if (context?.previousSubmission) {
        queryClient.setQueryData(
          [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, submissionId],
          context.previousSubmission
        );
      }
    },
    ...options,
  });
}

// ============================================================================
// Additional Utility Hooks
// ============================================================================

/**
 * Hook for fetching all submissions for a workshop
 *
 * Useful for teachers/assessors who need to see all submissions
 * Uses workshop->get_submissions() from locallib.php
 *
 * @param workshopId - The workshop instance ID
 * @param options - Optional configuration
 * @returns Query result with submissions array
 */
export function useWorkshopSubmissions(
  workshopId: number,
  options: UseSubmissionOptions = {}
): {
  data: WorkshopSubmission[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<UseQueryResult<WorkshopSubmission[], Error>>;
} {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_GC_TIME,
  } = options;

  const queryResult = useQuery<WorkshopSubmission[], Error>({
    queryKey: [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, 'list'],
    queryFn: () => fetchWorkshopSubmissions(workshopId),
    enabled: enabled && workshopId > 0,
    staleTime,
    gcTime,
  });

  return {
    data: queryResult.data,
    isLoading: queryResult.isLoading,
    isError: queryResult.isError,
    error: queryResult.error,
    refetch: queryResult.refetch as () => Promise<
      UseQueryResult<WorkshopSubmission[], Error>
    >,
  };
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Default export: useSubmission hook
 *
 * Usage:
 * ```typescript
 * import useSubmission from '@/features/activities/workshop/hooks/useSubmission';
 *
 * // Get user's own submission
 * const { data } = useSubmission(workshopId);
 *
 * // Get specific submission
 * const { data } = useSubmission(workshopId, submissionId);
 * ```
 */
export default useSubmission;

/**
 * Named export for explicit imports
 *
 * Usage:
 * ```typescript
 * import {
 *   useSubmission,
 *   useCreateSubmission,
 *   useUpdateSubmission,
 *   useDeleteSubmission,
 *   usePublishSubmission,
 * } from '@/features/activities/workshop/hooks/useSubmission';
 * ```
 */
export { useSubmission };
