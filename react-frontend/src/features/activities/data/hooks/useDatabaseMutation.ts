/**
 * React Query Mutation Hooks for Database Activity CRUD Operations
 *
 * Provides comprehensive mutation hooks for creating, updating, deleting, and
 * approving Database activity records with optimistic updates, automatic cache
 * invalidation, and rollback on failure.
 *
 * Features:
 * - Optimistic updates: Immediately updates React Query cache before API response
 * - Automatic rollback: Reverts cache to previous state on API failure
 * - Cache invalidation: Invalidates record lists and single record queries on success
 * - File upload support: Handles FormData for file and picture fields
 * - Field validation: Integrates with useFieldValidation hook for form validation
 * - Loading/error/success states: Exposes mutation state for UI feedback
 * - Callbacks: Supports onSuccess/onError callbacks for custom handling
 *
 * Based on Moodle's PHP implementation:
 * - public/mod/data/lib.php
 * - public/mod/data/locallib.php
 * - public/mod/data/edit.php
 *
 * @module features/activities/data/hooks/useDatabaseMutation
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import {
  createRecord,
  updateRecord,
  deleteRecord,
  approveRecord,
  dataQueryKeys,
  uploadFile,
  type CreateRecordParams,
  type UpdateRecordParams,
} from '../api/dataApi';
import type { DatabaseRecord, DatabaseField } from '../types/data.types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Parameters for creating a new record with optional file uploads
 */
export interface CreateRecordInput {
  /** Database instance ID */
  databaseId: number;
  /** Group ID (0 for no group) */
  groupId?: number;
  /** Field content data - map of field ID to content value */
  data: Array<{
    /** Field ID */
    fieldid: number;
    /** Field subfield (e.g., 'content', 'content1') */
    subfield?: string;
    /** Field value */
    value: string;
  }>;
  /** Files to upload after record creation (optional) */
  files?: Array<{
    /** Field ID for file attachment */
    fieldId: number;
    /** File object to upload */
    file: File;
  }>;
}

/**
 * Parameters for updating an existing record with optional file uploads
 */
export interface UpdateRecordInput {
  /** Database instance ID */
  databaseId: number;
  /** Record ID to update */
  recordId: number;
  /** Field content data - map of field ID to content value */
  data: Array<{
    /** Field ID */
    fieldid: number;
    /** Field subfield */
    subfield?: string;
    /** Field value */
    value: string;
  }>;
  /** Files to upload after record update (optional) */
  files?: Array<{
    /** Field ID for file attachment */
    fieldId: number;
    /** File object to upload */
    file: File;
  }>;
}

/**
 * Parameters for deleting a record
 */
export interface DeleteRecordInput {
  /** Database instance ID */
  databaseId: number;
  /** Record ID to delete */
  recordId: number;
}

/**
 * Parameters for approving/unapproving a record
 */
export interface ApproveRecordInput {
  /** Database instance ID */
  databaseId: number;
  /** Record ID to approve/unapprove */
  recordId: number;
  /** Whether to approve (true) or unapprove (false) */
  approved?: boolean;
}

/**
 * Mutation options for customizing mutation behavior
 */
export interface MutationOptions<TData = unknown, TError = Error> {
  /** Callback executed on successful mutation */
  onSuccess?: (data: TData) => void | Promise<void>;
  /** Callback executed on mutation error */
  onError?: (error: TError) => void | Promise<void>;
  /** Callback executed after mutation settles (success or error) */
  onSettled?: () => void | Promise<void>;
}

/**
 * Result of create record mutation hook
 */
export interface CreateRecordMutationResult {
  /** Trigger the mutation with input parameters */
  mutate: (input: CreateRecordInput) => void;
  /** Trigger the mutation and return a promise */
  mutateAsync: (input: CreateRecordInput) => Promise<number>;
  /** Whether the mutation is currently in progress */
  isLoading: boolean;
  /** Whether the mutation is pending (synonym for isLoading) */
  isPending: boolean;
  /** Whether the mutation was successful */
  isSuccess: boolean;
  /** Whether the mutation failed */
  isError: boolean;
  /** Error object if mutation failed */
  error: Error | null;
  /** The created record ID if successful */
  data: number | undefined;
  /** Reset the mutation state */
  reset: () => void;
}

/**
 * Result of update record mutation hook
 */
export interface UpdateRecordMutationResult {
  /** Trigger the mutation with input parameters */
  mutate: (input: UpdateRecordInput) => void;
  /** Trigger the mutation and return a promise */
  mutateAsync: (input: UpdateRecordInput) => Promise<void>;
  /** Whether the mutation is currently in progress */
  isLoading: boolean;
  /** Whether the mutation is pending (synonym for isLoading) */
  isPending: boolean;
  /** Whether the mutation was successful */
  isSuccess: boolean;
  /** Whether the mutation failed */
  isError: boolean;
  /** Error object if mutation failed */
  error: Error | null;
  /** Reset the mutation state */
  reset: () => void;
}

/**
 * Result of delete record mutation hook
 */
export interface DeleteRecordMutationResult {
  /** Trigger the mutation with input parameters */
  mutate: (input: DeleteRecordInput) => void;
  /** Trigger the mutation and return a promise */
  mutateAsync: (input: DeleteRecordInput) => Promise<void>;
  /** Whether the mutation is currently in progress */
  isLoading: boolean;
  /** Whether the mutation is pending (synonym for isLoading) */
  isPending: boolean;
  /** Whether the mutation was successful */
  isSuccess: boolean;
  /** Whether the mutation failed */
  isError: boolean;
  /** Error object if mutation failed */
  error: Error | null;
  /** Reset the mutation state */
  reset: () => void;
}

/**
 * Result of approve record mutation hook
 */
export interface ApproveRecordMutationResult {
  /** Trigger the mutation with input parameters */
  mutate: (input: ApproveRecordInput) => void;
  /** Trigger the mutation and return a promise */
  mutateAsync: (input: ApproveRecordInput) => Promise<void>;
  /** Whether the mutation is currently in progress */
  isLoading: boolean;
  /** Whether the mutation is pending (synonym for isLoading) */
  isPending: boolean;
  /** Whether the mutation was successful */
  isSuccess: boolean;
  /** Whether the mutation failed */
  isError: boolean;
  /** Error object if mutation failed */
  error: Error | null;
  /** Reset the mutation state */
  reset: () => void;
}

/**
 * Context type for optimistic updates rollback
 */
interface OptimisticContext {
  /** Previous records list cache */
  previousRecords?: unknown;
  /** Previous single record cache */
  previousRecord?: unknown;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Invalidates all related record caches for a database.
 *
 * Called after successful mutations to ensure UI displays fresh data.
 *
 * @param queryClient - React Query client instance
 * @param databaseId - Database instance ID to invalidate caches for
 * @param recordId - Optional specific record ID to also invalidate
 */
async function invalidateRecordCaches(
  queryClient: QueryClient,
  databaseId: number,
  recordId?: number
): Promise<void> {
  // Invalidate records list cache
  await queryClient.invalidateQueries({
    queryKey: dataQueryKeys.recordsByDatabase(databaseId),
  });

  // Invalidate search results cache
  await queryClient.invalidateQueries({
    queryKey: ['data', 'search', databaseId],
  });

  // Invalidate specific record cache if provided
  if (recordId) {
    await queryClient.invalidateQueries({
      queryKey: dataQueryKeys.record(databaseId, recordId),
    });
  }

  // Invalidate files cache if record ID is provided
  if (recordId) {
    await queryClient.invalidateQueries({
      queryKey: dataQueryKeys.files(databaseId, recordId),
    });
  }
}

/**
 * Uploads files associated with a record.
 *
 * Called after successful record creation/update to attach files.
 *
 * @param databaseId - Database instance ID
 * @param recordId - Record ID to attach files to
 * @param files - Array of files with field IDs to upload
 */
async function uploadRecordFiles(
  databaseId: number,
  recordId: number,
  files: Array<{ fieldId: number; file: File }>
): Promise<void> {
  if (!files || files.length === 0) {
    return;
  }

  // Upload files sequentially to avoid race conditions
  for (const fileData of files) {
    await uploadFile({
      databaseId,
      recordId,
      fieldId: fileData.fieldId,
      file: fileData.file,
    });
  }
}

// ============================================================================
// useCreateRecord Hook
// ============================================================================

/**
 * React Query mutation hook for creating new database records.
 *
 * Features:
 * - Optimistic updates to record list cache
 * - Automatic file uploads after record creation
 * - Cache invalidation on success
 * - Rollback on failure
 * - Field validation integration
 *
 * @param options - Optional mutation callbacks
 * @returns Mutation result with mutate function and state
 *
 * @example
 * ```typescript
 * const { mutate, isLoading, error } = useCreateRecord({
 *   onSuccess: (recordId) => {
 *     console.log('Created record:', recordId);
 *   },
 *   onError: (error) => {
 *     console.error('Failed to create record:', error);
 *   }
 * });
 *
 * // Create a record
 * mutate({
 *   databaseId: 123,
 *   data: [
 *     { fieldid: 1, value: 'John Doe' },
 *     { fieldid: 2, value: 'john@example.com' }
 *   ],
 *   files: [
 *     { fieldId: 3, file: avatarFile }
 *   ]
 * });
 * ```
 */
export function useCreateRecord(
  options?: MutationOptions<number, Error>
): CreateRecordMutationResult {
  const queryClient = useQueryClient();

  const mutation = useMutation<number, Error, CreateRecordInput, OptimisticContext>({
    mutationFn: async (input: CreateRecordInput): Promise<number> => {
      const { databaseId, groupId, data, files } = input;

      // Create the record first
      const createParams: CreateRecordParams = {
        databaseId,
        groupId,
        data,
      };

      const recordId = await createRecord(createParams);

      // Upload any associated files after record creation
      if (files && files.length > 0) {
        await uploadRecordFiles(databaseId, recordId, files);
      }

      return recordId;
    },

    onMutate: async (input: CreateRecordInput): Promise<OptimisticContext> => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: dataQueryKeys.recordsByDatabase(input.databaseId),
      });

      // Snapshot previous value for rollback
      const previousRecords = queryClient.getQueryData(
        dataQueryKeys.recordsByDatabase(input.databaseId)
      );

      // Optimistic update: Add placeholder record to the list
      // Note: We use a temporary negative ID that will be replaced on success
      const optimisticRecord: Partial<DatabaseRecord> = {
        id: -Date.now(), // Temporary negative ID
        dataid: input.databaseId,
        groupid: input.groupId ?? 0,
        userid: 0, // Will be set by server
        timecreated: Math.floor(Date.now() / 1000),
        timemodified: Math.floor(Date.now() / 1000),
        approved: false,
      };

      queryClient.setQueryData(
        dataQueryKeys.recordsByDatabase(input.databaseId),
        (old: unknown) => {
          if (!old || typeof old !== 'object') {
            return { records: [optimisticRecord], pagination: { total: 1 } };
          }
          const oldData = old as { records?: DatabaseRecord[]; pagination?: { total: number } };
          return {
            ...oldData,
            records: [optimisticRecord as DatabaseRecord, ...(oldData.records ?? [])],
            pagination: {
              ...oldData.pagination,
              total: (oldData.pagination?.total ?? 0) + 1,
            },
          };
        }
      );

      return { previousRecords };
    },

    onError: (error: Error, input: CreateRecordInput, context?: OptimisticContext): void => {
      // Rollback to previous state on error
      if (context?.previousRecords !== undefined) {
        queryClient.setQueryData(
          dataQueryKeys.recordsByDatabase(input.databaseId),
          context.previousRecords
        );
      }

      // Call user-provided error handler
      if (options?.onError) {
        void options.onError(error);
      }
    },

    onSuccess: async (recordId: number, input: CreateRecordInput): Promise<void> => {
      // Invalidate caches to get fresh data from server
      await invalidateRecordCaches(queryClient, input.databaseId, recordId);

      // Call user-provided success handler
      if (options?.onSuccess) {
        await options.onSuccess(recordId);
      }
    },

    onSettled: (): void => {
      // Call user-provided settled handler
      if (options?.onSettled) {
        void options.onSettled();
      }
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}

// ============================================================================
// useUpdateRecord Hook
// ============================================================================

/**
 * React Query mutation hook for updating existing database records.
 *
 * Features:
 * - Optimistic updates to both record list and single record cache
 * - Automatic file uploads after record update
 * - Cache invalidation on success
 * - Rollback on failure
 * - Field validation integration
 *
 * @param options - Optional mutation callbacks
 * @returns Mutation result with mutate function and state
 *
 * @example
 * ```typescript
 * const { mutate, isLoading, error } = useUpdateRecord({
 *   onSuccess: () => {
 *     toast.success('Record updated successfully');
 *   },
 *   onError: (error) => {
 *     toast.error(`Update failed: ${error.message}`);
 *   }
 * });
 *
 * // Update a record
 * mutate({
 *   databaseId: 123,
 *   recordId: 456,
 *   data: [
 *     { fieldid: 1, value: 'Jane Doe' }
 *   ]
 * });
 * ```
 */
export function useUpdateRecord(
  options?: MutationOptions<void, Error>
): UpdateRecordMutationResult {
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, UpdateRecordInput, OptimisticContext>({
    mutationFn: async (input: UpdateRecordInput): Promise<void> => {
      const { databaseId, recordId, data, files } = input;

      // Update the record
      const updateParams: UpdateRecordParams = {
        databaseId,
        recordId,
        data,
      };

      await updateRecord(updateParams);

      // Upload any associated files after record update
      if (files && files.length > 0) {
        await uploadRecordFiles(databaseId, recordId, files);
      }
    },

    onMutate: async (input: UpdateRecordInput): Promise<OptimisticContext> => {
      const { databaseId, recordId, data } = input;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: dataQueryKeys.recordsByDatabase(databaseId),
      });
      await queryClient.cancelQueries({
        queryKey: dataQueryKeys.record(databaseId, recordId),
      });

      // Snapshot previous values for rollback
      const previousRecords = queryClient.getQueryData(
        dataQueryKeys.recordsByDatabase(databaseId)
      );
      const previousRecord = queryClient.getQueryData(
        dataQueryKeys.record(databaseId, recordId)
      );

      // Optimistic update for records list
      queryClient.setQueryData(
        dataQueryKeys.recordsByDatabase(databaseId),
        (old: unknown) => {
          if (!old || typeof old !== 'object') {
            return old;
          }
          const oldData = old as { records?: DatabaseRecord[] };
          if (!oldData.records) {
            return old;
          }

          const updatedRecords = oldData.records.map((record: DatabaseRecord) => {
            if (record.id === recordId) {
              return {
                ...record,
                timemodified: Math.floor(Date.now() / 1000),
              };
            }
            return record;
          });

          return { ...oldData, records: updatedRecords };
        }
      );

      // Optimistic update for single record
      queryClient.setQueryData(
        dataQueryKeys.record(databaseId, recordId),
        (old: unknown) => {
          if (!old) {
            return old;
          }
          const oldRecord = old as DatabaseRecord & { contents?: Array<{ fieldid: number; content?: string }> };

          // Update contents with new data
          const updatedContents = oldRecord.contents?.map((content) => {
            const newData = data.find((d) => d.fieldid === content.fieldid);
            if (newData) {
              return { ...content, content: newData.value };
            }
            return content;
          });

          return {
            ...oldRecord,
            contents: updatedContents,
            timemodified: Math.floor(Date.now() / 1000),
          };
        }
      );

      return { previousRecords, previousRecord };
    },

    onError: (error: Error, input: UpdateRecordInput, context?: OptimisticContext): void => {
      const { databaseId, recordId } = input;

      // Rollback records list
      if (context?.previousRecords !== undefined) {
        queryClient.setQueryData(
          dataQueryKeys.recordsByDatabase(databaseId),
          context.previousRecords
        );
      }

      // Rollback single record
      if (context?.previousRecord !== undefined) {
        queryClient.setQueryData(
          dataQueryKeys.record(databaseId, recordId),
          context.previousRecord
        );
      }

      // Call user-provided error handler
      if (options?.onError) {
        void options.onError(error);
      }
    },

    onSuccess: async (_: void, input: UpdateRecordInput): Promise<void> => {
      const { databaseId, recordId } = input;

      // Invalidate caches to get fresh data from server
      await invalidateRecordCaches(queryClient, databaseId, recordId);

      // Call user-provided success handler
      if (options?.onSuccess) {
        await options.onSuccess();
      }
    },

    onSettled: (): void => {
      // Call user-provided settled handler
      if (options?.onSettled) {
        void options.onSettled();
      }
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}

// ============================================================================
// useDeleteRecord Hook
// ============================================================================

/**
 * React Query mutation hook for deleting database records.
 *
 * Features:
 * - Optimistic removal from record list cache
 * - Cache invalidation on success
 * - Rollback on failure (restores deleted record to cache)
 *
 * @param options - Optional mutation callbacks
 * @returns Mutation result with mutate function and state
 *
 * @example
 * ```typescript
 * const { mutate, isLoading, error } = useDeleteRecord({
 *   onSuccess: () => {
 *     toast.success('Record deleted successfully');
 *   },
 *   onError: (error) => {
 *     toast.error(`Delete failed: ${error.message}`);
 *   }
 * });
 *
 * // Delete a record
 * mutate({
 *   databaseId: 123,
 *   recordId: 456
 * });
 * ```
 */
export function useDeleteRecord(
  options?: MutationOptions<void, Error>
): DeleteRecordMutationResult {
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, DeleteRecordInput, OptimisticContext>({
    mutationFn: async (input: DeleteRecordInput): Promise<void> => {
      const { databaseId, recordId } = input;
      await deleteRecord(databaseId, recordId);
    },

    onMutate: async (input: DeleteRecordInput): Promise<OptimisticContext> => {
      const { databaseId, recordId } = input;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: dataQueryKeys.recordsByDatabase(databaseId),
      });
      await queryClient.cancelQueries({
        queryKey: dataQueryKeys.record(databaseId, recordId),
      });

      // Snapshot previous values for rollback
      const previousRecords = queryClient.getQueryData(
        dataQueryKeys.recordsByDatabase(databaseId)
      );
      const previousRecord = queryClient.getQueryData(
        dataQueryKeys.record(databaseId, recordId)
      );

      // Optimistic update: Remove record from list
      queryClient.setQueryData(
        dataQueryKeys.recordsByDatabase(databaseId),
        (old: unknown) => {
          if (!old || typeof old !== 'object') {
            return old;
          }
          const oldData = old as { records?: DatabaseRecord[]; pagination?: { total: number } };
          if (!oldData.records) {
            return old;
          }

          const filteredRecords = oldData.records.filter(
            (record: DatabaseRecord) => record.id !== recordId
          );

          return {
            ...oldData,
            records: filteredRecords,
            pagination: {
              ...oldData.pagination,
              total: Math.max(0, (oldData.pagination?.total ?? 0) - 1),
            },
          };
        }
      );

      // Remove single record from cache
      queryClient.removeQueries({
        queryKey: dataQueryKeys.record(databaseId, recordId),
      });

      return { previousRecords, previousRecord };
    },

    onError: (error: Error, input: DeleteRecordInput, context?: OptimisticContext): void => {
      const { databaseId, recordId } = input;

      // Rollback records list
      if (context?.previousRecords !== undefined) {
        queryClient.setQueryData(
          dataQueryKeys.recordsByDatabase(databaseId),
          context.previousRecords
        );
      }

      // Rollback single record
      if (context?.previousRecord !== undefined) {
        queryClient.setQueryData(
          dataQueryKeys.record(databaseId, recordId),
          context.previousRecord
        );
      }

      // Call user-provided error handler
      if (options?.onError) {
        void options.onError(error);
      }
    },

    onSuccess: async (_: void, input: DeleteRecordInput): Promise<void> => {
      const { databaseId, recordId } = input;

      // Invalidate caches
      await invalidateRecordCaches(queryClient, databaseId, recordId);

      // Also invalidate files cache for the deleted record
      queryClient.removeQueries({
        queryKey: dataQueryKeys.files(databaseId, recordId),
      });

      // Call user-provided success handler
      if (options?.onSuccess) {
        await options.onSuccess();
      }
    },

    onSettled: (): void => {
      // Call user-provided settled handler
      if (options?.onSettled) {
        void options.onSettled();
      }
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}

// ============================================================================
// useApproveRecord Hook
// ============================================================================

/**
 * React Query mutation hook for approving or unapproving database records.
 *
 * Features:
 * - Optimistic update of approval status in cache
 * - Cache invalidation on success
 * - Rollback on failure
 *
 * @param options - Optional mutation callbacks
 * @returns Mutation result with mutate function and state
 *
 * @example
 * ```typescript
 * const { mutate, isLoading, error } = useApproveRecord({
 *   onSuccess: () => {
 *     toast.success('Record approval status updated');
 *   },
 *   onError: (error) => {
 *     toast.error(`Approval failed: ${error.message}`);
 *   }
 * });
 *
 * // Approve a record
 * mutate({
 *   databaseId: 123,
 *   recordId: 456,
 *   approved: true
 * });
 *
 * // Unapprove a record
 * mutate({
 *   databaseId: 123,
 *   recordId: 456,
 *   approved: false
 * });
 * ```
 */
export function useApproveRecord(
  options?: MutationOptions<void, Error>
): ApproveRecordMutationResult {
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, ApproveRecordInput, OptimisticContext>({
    mutationFn: async (input: ApproveRecordInput): Promise<void> => {
      const { databaseId, recordId, approved = true } = input;
      await approveRecord(databaseId, recordId, approved);
    },

    onMutate: async (input: ApproveRecordInput): Promise<OptimisticContext> => {
      const { databaseId, recordId, approved = true } = input;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: dataQueryKeys.recordsByDatabase(databaseId),
      });
      await queryClient.cancelQueries({
        queryKey: dataQueryKeys.record(databaseId, recordId),
      });

      // Snapshot previous values for rollback
      const previousRecords = queryClient.getQueryData(
        dataQueryKeys.recordsByDatabase(databaseId)
      );
      const previousRecord = queryClient.getQueryData(
        dataQueryKeys.record(databaseId, recordId)
      );

      // Optimistic update for records list
      queryClient.setQueryData(
        dataQueryKeys.recordsByDatabase(databaseId),
        (old: unknown) => {
          if (!old || typeof old !== 'object') {
            return old;
          }
          const oldData = old as { records?: DatabaseRecord[] };
          if (!oldData.records) {
            return old;
          }

          const updatedRecords = oldData.records.map((record: DatabaseRecord) => {
            if (record.id === recordId) {
              return {
                ...record,
                approved,
                timemodified: Math.floor(Date.now() / 1000),
              };
            }
            return record;
          });

          return { ...oldData, records: updatedRecords };
        }
      );

      // Optimistic update for single record
      queryClient.setQueryData(
        dataQueryKeys.record(databaseId, recordId),
        (old: unknown) => {
          if (!old) {
            return old;
          }
          return {
            ...(old as DatabaseRecord),
            approved,
            timemodified: Math.floor(Date.now() / 1000),
          };
        }
      );

      return { previousRecords, previousRecord };
    },

    onError: (error: Error, input: ApproveRecordInput, context?: OptimisticContext): void => {
      const { databaseId, recordId } = input;

      // Rollback records list
      if (context?.previousRecords !== undefined) {
        queryClient.setQueryData(
          dataQueryKeys.recordsByDatabase(databaseId),
          context.previousRecords
        );
      }

      // Rollback single record
      if (context?.previousRecord !== undefined) {
        queryClient.setQueryData(
          dataQueryKeys.record(databaseId, recordId),
          context.previousRecord
        );
      }

      // Call user-provided error handler
      if (options?.onError) {
        void options.onError(error);
      }
    },

    onSuccess: async (_: void, input: ApproveRecordInput): Promise<void> => {
      const { databaseId, recordId } = input;

      // Invalidate caches to get fresh data from server
      await invalidateRecordCaches(queryClient, databaseId, recordId);

      // Call user-provided success handler
      if (options?.onSuccess) {
        await options.onSuccess();
      }
    },

    onSettled: (): void => {
      // Call user-provided settled handler
      if (options?.onSettled) {
        void options.onSettled();
      }
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}

// ============================================================================
// Validation Integration Helper
// ============================================================================

/**
 * Validates form data against field definitions before submission.
 *
 * Integrates with useFieldValidation hook to validate all field values
 * according to their field type constraints.
 *
 * @param fields - Array of field definitions from the database
 * @param data - Array of field values to validate
 * @param validateFn - Validation function from useFieldValidation hook
 * @returns Object containing validation result and any errors
 *
 * @example
 * ```typescript
 * const { validate } = useFieldValidation();
 * const fields = await getFields(databaseId);
 *
 * const { isValid, errors } = validateRecordData(fields, formData, validate);
 * if (!isValid) {
 *   console.error('Validation errors:', errors);
 *   return;
 * }
 *
 * // Proceed with mutation
 * createRecordMutation.mutate({ databaseId, data: formData });
 * ```
 */
export function validateRecordData(
  fields: DatabaseField[],
  data: Array<{ fieldid: number; value: unknown }>,
  validateFn: (field: DatabaseField, value: unknown) => boolean
): { isValid: boolean; errors: Array<{ fieldId: number; message: string }> } {
  const errors: Array<{ fieldId: number; message: string }> = [];

  for (const field of fields) {
    const fieldData = data.find((d) => d.fieldid === field.id);
    const value = fieldData?.value ?? '';

    const isFieldValid = validateFn(field, value);
    if (!isFieldValid) {
      errors.push({
        fieldId: field.id,
        message: `Validation failed for field: ${field.name}`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
