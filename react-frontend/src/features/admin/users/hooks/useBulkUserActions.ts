/**
 * Custom React hook for managing bulk user operations
 *
 * This hook provides comprehensive bulk operation functionality for admin user management,
 * including selection state management and execution of bulk actions like delete, suspend,
 * unsuspend, confirm, message, cohort assignment, and force password change.
 *
 * Based on Moodle's bulk user action system:
 * - Source: public/admin/user/user_bulk.php (SESSION->bulk_users pattern)
 * - Source: public/admin/user/user_bulk_forms.php (bulk action definitions)
 * - Source: public/admin/user/lib.php (helper functions)
 *
 * Features:
 * - Selection state management with Set-based user ID storage
 * - React Query mutations for each bulk action type
 * - Progress tracking for bulk operations
 * - Partial success handling with detailed per-user results
 * - Optimistic updates and cache invalidation
 * - Toast notifications for operation feedback
 *
 * @module features/admin/users/hooks/useBulkUserActions
 */

import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { bulkUserAction } from '../api/userAdminApi';
import { BulkActionType } from '../types/bulk-actions.types';
import type {
  BulkActionResponse,
  MessageBulkActionData,
  CohortBulkActionData,
  BulkUserActionResult,
} from '../types/bulk-actions.types';
import { useToast } from '@/hooks/useToast';
import type { User } from '../types/user.types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Parameters for bulk action operations
 *
 * Provides a type-safe interface for passing parameters to bulk action mutations.
 */
export interface BulkActionParams {
  /**
   * Array of user IDs to perform the action on
   * If not provided, uses the currently selected users
   */
  userIds?: number[];

  /**
   * Whether the action has been confirmed by the user
   * Required for destructive actions like DELETE
   */
  confirmed?: boolean;

  /**
   * Whether to send notifications to affected users
   */
  sendNotifications?: boolean;

  /**
   * Whether to continue processing if some users fail
   * If false, stops at first error
   */
  continueOnError?: boolean;
}

/**
 * Parameters for bulk message operation
 */
export interface BulkMessageParams extends BulkActionParams {
  /**
   * Subject line of the message
   */
  subject: string;

  /**
   * Content of the message to be sent
   */
  message: string;

  /**
   * Format of the message content (0=auto, 1=HTML, 2=plain, 4=markdown)
   */
  messageformat?: number;
}

/**
 * Parameters for bulk cohort add operation
 */
export interface BulkCohortAddParams extends BulkActionParams {
  /**
   * ID of the cohort to add users to
   */
  cohortId: number;

  /**
   * Name of the cohort (for display in notifications)
   */
  cohortName: string;
}

/**
 * Result of a bulk action operation
 *
 * Provides detailed feedback on the outcome of a bulk operation,
 * including counts and per-user results for partial success scenarios.
 */
export interface BulkActionResult {
  /**
   * Whether the overall operation was successful
   */
  success: boolean;

  /**
   * Human-readable message describing the result
   */
  message: string;

  /**
   * Number of users successfully processed
   */
  successCount: number;

  /**
   * Number of users that failed processing
   */
  failureCount: number;

  /**
   * Total number of users in the operation
   */
  totalCount: number;

  /**
   * Detailed results for each user (when partial success)
   */
  userResults?: BulkUserActionResult[];

  /**
   * Error messages if operation failed
   */
  errors?: string[];
}

/**
 * Progress information for ongoing bulk operations
 */
export interface BulkOperationProgress {
  /**
   * Whether an operation is currently in progress
   */
  isLoading: boolean;

  /**
   * Current operation type being executed
   */
  currentAction?: BulkActionType;

  /**
   * Number of users processed so far (for async operations)
   */
  processedCount: number;

  /**
   * Total number of users to process
   */
  totalCount: number;

  /**
   * Percentage complete (0-100)
   */
  percentComplete: number;
}

/**
 * Return type for the useBulkUserActions hook
 */
export interface UseBulkUserActionsReturn {
  // Selection state
  /**
   * Set of currently selected user IDs
   */
  selectedUsers: Set<number>;

  /**
   * Count of currently selected users
   */
  selectedUserCount: number;

  // Selection functions
  /**
   * Add a user to the selection
   */
  selectUser: (userId: number) => void;

  /**
   * Remove a user from the selection
   */
  deselectUser: (userId: number) => void;

  /**
   * Select all users from a given list
   */
  selectAll: (users: User[] | number[]) => void;

  /**
   * Remove all users from selection
   */
  deselectAll: () => void;

  /**
   * Toggle selection state for a user
   */
  toggleUserSelection: (userId: number) => void;

  /**
   * Clear all selections (alias for deselectAll)
   */
  clearSelection: () => void;

  /**
   * Check if a user is currently selected
   */
  isUserSelected: (userId: number) => boolean;

  // Bulk action mutations
  /**
   * Delete multiple users
   */
  bulkDelete: (params?: BulkActionParams) => Promise<BulkActionResult>;

  /**
   * Suspend multiple users
   */
  bulkSuspend: (params?: BulkActionParams) => Promise<BulkActionResult>;

  /**
   * Unsuspend (reactivate) multiple users
   */
  bulkUnsuspend: (params?: BulkActionParams) => Promise<BulkActionResult>;

  /**
   * Confirm multiple unconfirmed user accounts
   */
  bulkConfirm: (params?: BulkActionParams) => Promise<BulkActionResult>;

  /**
   * Send message to multiple users
   */
  bulkMessage: (params: BulkMessageParams) => Promise<BulkActionResult>;

  /**
   * Add multiple users to a cohort
   */
  bulkCohortAdd: (params: BulkCohortAddParams) => Promise<BulkActionResult>;

  /**
   * Force password change for multiple users
   */
  bulkForcePasswordChange: (params?: BulkActionParams) => Promise<BulkActionResult>;

  // Operation status
  /**
   * Progress information for ongoing operations
   */
  progress: BulkOperationProgress;

  /**
   * Last operation result (for reviewing after completion)
   */
  lastResult?: BulkActionResult;

  /**
   * Whether any bulk operation is currently in progress
   */
  isLoading: boolean;
}

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Query key constants for cache invalidation
 */
const USER_QUERY_KEYS = {
  LIST: ['admin', 'users', 'list'],
  DETAIL: (userId: number) => ['admin', 'users', 'detail', userId],
  ALL: ['admin', 'users'],
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom React hook for managing bulk user operations
 *
 * Provides complete state management for bulk operations including:
 * - User selection with Set-based storage (similar to Moodle's SESSION->bulk_users)
 * - React Query mutations for all bulk action types
 * - Progress tracking and partial success handling
 * - Automatic cache invalidation after successful operations
 * - Toast notifications for user feedback
 *
 * @returns {UseBulkUserActionsReturn} Object containing selection state, mutation functions, and progress info
 *
 * @example
 * ```tsx
 * function UserManagement() {
 *   const {
 *     selectedUsers,
 *     selectedUserCount,
 *     selectUser,
 *     deselectUser,
 *     selectAll,
 *     clearSelection,
 *     toggleUserSelection,
 *     bulkDelete,
 *     bulkSuspend,
 *     isLoading,
 *     progress
 *   } = useBulkUserActions();
 *
 *   const handleDeleteSelected = async () => {
 *     if (window.confirm(`Delete ${selectedUserCount} users?`)) {
 *       const result = await bulkDelete({ confirmed: true });
 *       if (result.success) {
 *         clearSelection();
 *       }
 *     }
 *   };
 *
 *   return (
 *     <UserList
 *       onRowSelect={toggleUserSelection}
 *       selectedIds={selectedUsers}
 *       onDeleteSelected={handleDeleteSelected}
 *       isProcessing={isLoading}
 *     />
 *   );
 * }
 * ```
 */
export function useBulkUserActions(): UseBulkUserActionsReturn {
  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Set of selected user IDs
   * Uses Set for O(1) lookup, add, and delete operations
   * Mirrors Moodle's SESSION->bulk_users pattern
   */
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());

  /**
   * Last bulk operation result
   */
  const [lastResult, setLastResult] = useState<BulkActionResult | undefined>();

  /**
   * Progress tracking state for async operations
   */
  const [progress, setProgress] = useState<BulkOperationProgress>({
    isLoading: false,
    processedCount: 0,
    totalCount: 0,
    percentComplete: 0,
  });

  // Hooks
  const queryClient = useQueryClient();
  const toast = useToast();

  // ============================================================================
  // Computed Values
  // ============================================================================

  /**
   * Computed count of selected users
   * Optimized with useMemo to avoid recalculation on every render
   */
  const selectedUserCount = useMemo(() => selectedUsers.size, [selectedUsers]);

  // ============================================================================
  // Selection Functions
  // ============================================================================

  /**
   * Add a single user to the selection
   *
   * @param userId - ID of the user to select
   */
  const selectUser = useCallback((userId: number): void => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      next.add(userId);
      return next;
    });
  }, []);

  /**
   * Remove a single user from the selection
   *
   * @param userId - ID of the user to deselect
   */
  const deselectUser = useCallback((userId: number): void => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  /**
   * Select all users from a given list
   *
   * Supports both User objects and raw user IDs.
   * Mirrors add_selection_all() from public/admin/user/lib.php
   *
   * @param users - Array of User objects or user IDs
   */
  const selectAll = useCallback((users: User[] | number[]): void => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      for (const user of users) {
        const userId = typeof user === 'number' ? user : user.id;
        next.add(userId);
      }
      return next;
    });
  }, []);

  /**
   * Clear all selections
   *
   * Removes all users from the selection set.
   * Mirrors SESSION->bulk_users = array() from user_bulk.php
   */
  const deselectAll = useCallback((): void => {
    setSelectedUsers(new Set());
  }, []);

  /**
   * Clear selection (alias for deselectAll)
   */
  const clearSelection = useCallback((): void => {
    deselectAll();
  }, [deselectAll]);

  /**
   * Toggle the selection state of a user
   *
   * If user is selected, deselects them. If not selected, selects them.
   *
   * @param userId - ID of the user to toggle
   */
  const toggleUserSelection = useCallback((userId: number): void => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  /**
   * Check if a user is currently selected
   *
   * @param userId - ID of the user to check
   * @returns True if user is in the selection set
   */
  const isUserSelected = useCallback(
    (userId: number): boolean => {
      return selectedUsers.has(userId);
    },
    [selectedUsers]
  );

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Get user IDs for bulk operation
   *
   * Returns the provided IDs or falls back to selected users.
   *
   * @param userIds - Optional array of user IDs
   * @returns Array of user IDs to process
   */
  const getUserIdsForOperation = useCallback(
    (userIds?: number[]): number[] => {
      if (userIds && userIds.length > 0) {
        return userIds;
      }
      return Array.from(selectedUsers);
    },
    [selectedUsers]
  );

  /**
   * Convert API response to BulkActionResult
   *
   * Transforms the raw API response into our standardized result format.
   *
   * @param response - Raw API response
   * @param action - The action that was performed
   * @returns Standardized bulk action result
   */
  const transformResponse = useCallback(
    (response: BulkActionResponse, action: string): BulkActionResult => {
      return {
        success: response.success,
        message: response.message || `${action} operation completed`,
        successCount: response.successCount,
        failureCount: response.failureCount,
        totalCount: response.totalCount,
        userResults: response.results,
        errors: response.errors,
      };
    },
    []
  );

  /**
   * Handle successful bulk operation
   *
   * Updates state, invalidates caches, and shows toast notification.
   *
   * @param result - The operation result
   * @param actionName - Human-readable action name for notifications
   */
  const handleSuccess = useCallback(
    (result: BulkActionResult, actionName: string): void => {
      setLastResult(result);

      // Invalidate user queries to refresh the list
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.ALL });

      // Show appropriate toast notification
      if (result.success) {
        if (result.failureCount > 0) {
          // Partial success
          toast.warning(
            `${actionName}: ${result.successCount} succeeded, ${result.failureCount} failed`
          );
        } else {
          // Complete success
          toast.success(`${actionName}: ${result.successCount} users processed successfully`);
        }
      } else {
        // Complete failure
        toast.error(result.message || `${actionName} operation failed`);
      }
    },
    [queryClient, toast]
  );

  /**
   * Handle bulk operation error
   *
   * Creates error result and shows toast notification.
   *
   * @param error - The caught error
   * @param actionName - Human-readable action name for notifications
   * @param userCount - Number of users that were being processed
   * @returns Error result object
   */
  const handleError = useCallback(
    (error: unknown, actionName: string, userCount: number): BulkActionResult => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      const result: BulkActionResult = {
        success: false,
        message: `${actionName} failed: ${errorMessage}`,
        successCount: 0,
        failureCount: userCount,
        totalCount: userCount,
        errors: [errorMessage],
      };

      setLastResult(result);
      toast.error(result.message);

      return result;
    },
    [toast]
  );

  /**
   * Update progress state
   *
   * @param isLoading - Whether operation is in progress
   * @param action - Current action type
   * @param processed - Number of users processed
   * @param total - Total number of users
   */
  const updateProgress = useCallback(
    (
      isLoading: boolean,
      action?: BulkActionType,
      processed: number = 0,
      total: number = 0
    ): void => {
      setProgress({
        isLoading,
        currentAction: action,
        processedCount: processed,
        totalCount: total,
        percentComplete: total > 0 ? Math.round((processed / total) * 100) : 0,
      });
    },
    []
  );

  // ============================================================================
  // Bulk Operation Mutations
  // ============================================================================

  /**
   * Bulk delete mutation
   *
   * Deletes multiple user accounts (soft delete).
   * Requires moodle/user:delete capability and confirmation.
   */
  const bulkDeleteMutation = useMutation({
    mutationFn: async (params: BulkActionParams): Promise<BulkActionResponse> => {
      const userIds = getUserIdsForOperation(params?.userIds);
      updateProgress(true, BulkActionType.DELETE, 0, userIds.length);

      return bulkUserAction(BulkActionType.DELETE, userIds, undefined, {
        confirmed: params?.confirmed ?? false,
        continueOnError: params?.continueOnError ?? true,
      });
    },
    onSuccess: (response) => {
      updateProgress(false);
      handleSuccess(transformResponse(response, 'Delete'), 'Bulk delete');
    },
    onError: (error) => {
      updateProgress(false);
      handleError(error, 'Bulk delete', selectedUserCount);
    },
  });

  /**
   * Bulk suspend mutation
   *
   * Suspends multiple user accounts.
   * Requires moodle/user:update capability.
   */
  const bulkSuspendMutation = useMutation({
    mutationFn: async (params: BulkActionParams): Promise<BulkActionResponse> => {
      const userIds = getUserIdsForOperation(params?.userIds);
      updateProgress(true, BulkActionType.SUSPEND, 0, userIds.length);

      return bulkUserAction(BulkActionType.SUSPEND, userIds, undefined, {
        continueOnError: params?.continueOnError ?? true,
        sendNotifications: params?.sendNotifications,
      });
    },
    onSuccess: (response) => {
      updateProgress(false);
      handleSuccess(transformResponse(response, 'Suspend'), 'Bulk suspend');
    },
    onError: (error) => {
      updateProgress(false);
      handleError(error, 'Bulk suspend', selectedUserCount);
    },
  });

  /**
   * Bulk unsuspend mutation
   *
   * Reactivates multiple suspended user accounts.
   * Requires moodle/user:update capability.
   */
  const bulkUnsuspendMutation = useMutation({
    mutationFn: async (params: BulkActionParams): Promise<BulkActionResponse> => {
      const userIds = getUserIdsForOperation(params?.userIds);
      updateProgress(true, BulkActionType.UNSUSPEND, 0, userIds.length);

      return bulkUserAction(BulkActionType.UNSUSPEND, userIds, undefined, {
        continueOnError: params?.continueOnError ?? true,
        sendNotifications: params?.sendNotifications,
      });
    },
    onSuccess: (response) => {
      updateProgress(false);
      handleSuccess(transformResponse(response, 'Unsuspend'), 'Bulk unsuspend');
    },
    onError: (error) => {
      updateProgress(false);
      handleError(error, 'Bulk unsuspend', selectedUserCount);
    },
  });

  /**
   * Bulk confirm mutation
   *
   * Confirms multiple unconfirmed user accounts.
   * Requires moodle/user:update capability.
   */
  const bulkConfirmMutation = useMutation({
    mutationFn: async (params: BulkActionParams): Promise<BulkActionResponse> => {
      const userIds = getUserIdsForOperation(params?.userIds);
      updateProgress(true, BulkActionType.CONFIRM, 0, userIds.length);

      return bulkUserAction(BulkActionType.CONFIRM, userIds, undefined, {
        continueOnError: params?.continueOnError ?? true,
      });
    },
    onSuccess: (response) => {
      updateProgress(false);
      handleSuccess(transformResponse(response, 'Confirm'), 'Bulk confirm');
    },
    onError: (error) => {
      updateProgress(false);
      handleError(error, 'Bulk confirm', selectedUserCount);
    },
  });

  /**
   * Bulk message mutation
   *
   * Sends a message to multiple users.
   * Requires moodle/site:readallmessages capability.
   */
  const bulkMessageMutation = useMutation({
    mutationFn: async (params: BulkMessageParams): Promise<BulkActionResponse> => {
      const userIds = getUserIdsForOperation(params?.userIds);
      updateProgress(true, BulkActionType.MESSAGE, 0, userIds.length);

      const messageData: MessageBulkActionData = {
        subject: params.subject,
        message: params.message,
        messageformat: params.messageformat ?? 1, // Default to HTML format
      };

      return bulkUserAction(BulkActionType.MESSAGE, userIds, messageData, {
        continueOnError: params?.continueOnError ?? true,
      });
    },
    onSuccess: (response) => {
      updateProgress(false);
      handleSuccess(transformResponse(response, 'Message'), 'Bulk message');
    },
    onError: (error) => {
      updateProgress(false);
      handleError(error, 'Bulk message', selectedUserCount);
    },
  });

  /**
   * Bulk cohort add mutation
   *
   * Adds multiple users to a cohort.
   * Requires moodle/cohort:assign capability.
   */
  const bulkCohortAddMutation = useMutation({
    mutationFn: async (params: BulkCohortAddParams): Promise<BulkActionResponse> => {
      const userIds = getUserIdsForOperation(params?.userIds);
      updateProgress(true, BulkActionType.ADD_TO_COHORT, 0, userIds.length);

      const cohortData: CohortBulkActionData = {
        cohortId: params.cohortId,
        cohortName: params.cohortName,
      };

      return bulkUserAction(BulkActionType.ADD_TO_COHORT, userIds, cohortData, {
        continueOnError: params?.continueOnError ?? true,
      });
    },
    onSuccess: (response) => {
      updateProgress(false);
      handleSuccess(transformResponse(response, 'Add to cohort'), 'Bulk cohort add');
    },
    onError: (error) => {
      updateProgress(false);
      handleError(error, 'Bulk cohort add', selectedUserCount);
    },
  });

  /**
   * Bulk force password change mutation
   *
   * Forces password change on next login for multiple users.
   * Requires moodle/user:update capability.
   */
  const bulkForcePasswordChangeMutation = useMutation({
    mutationFn: async (params: BulkActionParams): Promise<BulkActionResponse> => {
      const userIds = getUserIdsForOperation(params?.userIds);
      updateProgress(true, BulkActionType.FORCE_PASSWORD_CHANGE, 0, userIds.length);

      return bulkUserAction(BulkActionType.FORCE_PASSWORD_CHANGE, userIds, undefined, {
        continueOnError: params?.continueOnError ?? true,
        sendNotifications: params?.sendNotifications,
      });
    },
    onSuccess: (response) => {
      updateProgress(false);
      handleSuccess(transformResponse(response, 'Force password change'), 'Bulk force password change');
    },
    onError: (error) => {
      updateProgress(false);
      handleError(error, 'Bulk force password change', selectedUserCount);
    },
  });

  // ============================================================================
  // Exposed Mutation Functions
  // ============================================================================

  /**
   * Execute bulk delete operation
   *
   * @param params - Optional parameters for the operation
   * @returns Promise resolving to the operation result
   */
  const bulkDelete = useCallback(
    async (params?: BulkActionParams): Promise<BulkActionResult> => {
      const userIds = getUserIdsForOperation(params?.userIds);

      if (userIds.length === 0) {
        const emptyResult: BulkActionResult = {
          success: false,
          message: 'No users selected for deletion',
          successCount: 0,
          failureCount: 0,
          totalCount: 0,
        };
        toast.warning(emptyResult.message);
        return emptyResult;
      }

      try {
        const response = await bulkDeleteMutation.mutateAsync(params ?? {});
        return transformResponse(response, 'Delete');
      } catch (error) {
        return handleError(error, 'Bulk delete', userIds.length);
      }
    },
    [bulkDeleteMutation, getUserIdsForOperation, transformResponse, handleError, toast]
  );

  /**
   * Execute bulk suspend operation
   *
   * @param params - Optional parameters for the operation
   * @returns Promise resolving to the operation result
   */
  const bulkSuspend = useCallback(
    async (params?: BulkActionParams): Promise<BulkActionResult> => {
      const userIds = getUserIdsForOperation(params?.userIds);

      if (userIds.length === 0) {
        const emptyResult: BulkActionResult = {
          success: false,
          message: 'No users selected for suspension',
          successCount: 0,
          failureCount: 0,
          totalCount: 0,
        };
        toast.warning(emptyResult.message);
        return emptyResult;
      }

      try {
        const response = await bulkSuspendMutation.mutateAsync(params ?? {});
        return transformResponse(response, 'Suspend');
      } catch (error) {
        return handleError(error, 'Bulk suspend', userIds.length);
      }
    },
    [bulkSuspendMutation, getUserIdsForOperation, transformResponse, handleError, toast]
  );

  /**
   * Execute bulk unsuspend operation
   *
   * @param params - Optional parameters for the operation
   * @returns Promise resolving to the operation result
   */
  const bulkUnsuspend = useCallback(
    async (params?: BulkActionParams): Promise<BulkActionResult> => {
      const userIds = getUserIdsForOperation(params?.userIds);

      if (userIds.length === 0) {
        const emptyResult: BulkActionResult = {
          success: false,
          message: 'No users selected for reactivation',
          successCount: 0,
          failureCount: 0,
          totalCount: 0,
        };
        toast.warning(emptyResult.message);
        return emptyResult;
      }

      try {
        const response = await bulkUnsuspendMutation.mutateAsync(params ?? {});
        return transformResponse(response, 'Unsuspend');
      } catch (error) {
        return handleError(error, 'Bulk unsuspend', userIds.length);
      }
    },
    [bulkUnsuspendMutation, getUserIdsForOperation, transformResponse, handleError, toast]
  );

  /**
   * Execute bulk confirm operation
   *
   * @param params - Optional parameters for the operation
   * @returns Promise resolving to the operation result
   */
  const bulkConfirm = useCallback(
    async (params?: BulkActionParams): Promise<BulkActionResult> => {
      const userIds = getUserIdsForOperation(params?.userIds);

      if (userIds.length === 0) {
        const emptyResult: BulkActionResult = {
          success: false,
          message: 'No users selected for confirmation',
          successCount: 0,
          failureCount: 0,
          totalCount: 0,
        };
        toast.warning(emptyResult.message);
        return emptyResult;
      }

      try {
        const response = await bulkConfirmMutation.mutateAsync(params ?? {});
        return transformResponse(response, 'Confirm');
      } catch (error) {
        return handleError(error, 'Bulk confirm', userIds.length);
      }
    },
    [bulkConfirmMutation, getUserIdsForOperation, transformResponse, handleError, toast]
  );

  /**
   * Execute bulk message operation
   *
   * @param params - Message parameters including subject and content
   * @returns Promise resolving to the operation result
   */
  const bulkMessage = useCallback(
    async (params: BulkMessageParams): Promise<BulkActionResult> => {
      const userIds = getUserIdsForOperation(params?.userIds);

      if (userIds.length === 0) {
        const emptyResult: BulkActionResult = {
          success: false,
          message: 'No users selected to message',
          successCount: 0,
          failureCount: 0,
          totalCount: 0,
        };
        toast.warning(emptyResult.message);
        return emptyResult;
      }

      if (!params.subject || !params.message) {
        const invalidResult: BulkActionResult = {
          success: false,
          message: 'Subject and message content are required',
          successCount: 0,
          failureCount: userIds.length,
          totalCount: userIds.length,
        };
        toast.error(invalidResult.message);
        return invalidResult;
      }

      try {
        const response = await bulkMessageMutation.mutateAsync(params);
        return transformResponse(response, 'Message');
      } catch (error) {
        return handleError(error, 'Bulk message', userIds.length);
      }
    },
    [bulkMessageMutation, getUserIdsForOperation, transformResponse, handleError, toast]
  );

  /**
   * Execute bulk cohort add operation
   *
   * @param params - Cohort parameters including cohort ID and name
   * @returns Promise resolving to the operation result
   */
  const bulkCohortAdd = useCallback(
    async (params: BulkCohortAddParams): Promise<BulkActionResult> => {
      const userIds = getUserIdsForOperation(params?.userIds);

      if (userIds.length === 0) {
        const emptyResult: BulkActionResult = {
          success: false,
          message: 'No users selected to add to cohort',
          successCount: 0,
          failureCount: 0,
          totalCount: 0,
        };
        toast.warning(emptyResult.message);
        return emptyResult;
      }

      if (!params.cohortId) {
        const invalidResult: BulkActionResult = {
          success: false,
          message: 'Cohort ID is required',
          successCount: 0,
          failureCount: userIds.length,
          totalCount: userIds.length,
        };
        toast.error(invalidResult.message);
        return invalidResult;
      }

      try {
        const response = await bulkCohortAddMutation.mutateAsync(params);
        return transformResponse(response, 'Add to cohort');
      } catch (error) {
        return handleError(error, 'Bulk cohort add', userIds.length);
      }
    },
    [bulkCohortAddMutation, getUserIdsForOperation, transformResponse, handleError, toast]
  );

  /**
   * Execute bulk force password change operation
   *
   * @param params - Optional parameters for the operation
   * @returns Promise resolving to the operation result
   */
  const bulkForcePasswordChange = useCallback(
    async (params?: BulkActionParams): Promise<BulkActionResult> => {
      const userIds = getUserIdsForOperation(params?.userIds);

      if (userIds.length === 0) {
        const emptyResult: BulkActionResult = {
          success: false,
          message: 'No users selected for password change',
          successCount: 0,
          failureCount: 0,
          totalCount: 0,
        };
        toast.warning(emptyResult.message);
        return emptyResult;
      }

      try {
        const response = await bulkForcePasswordChangeMutation.mutateAsync(params ?? {});
        return transformResponse(response, 'Force password change');
      } catch (error) {
        return handleError(error, 'Bulk force password change', userIds.length);
      }
    },
    [bulkForcePasswordChangeMutation, getUserIdsForOperation, transformResponse, handleError, toast]
  );

  // ============================================================================
  // Computed Loading State
  // ============================================================================

  /**
   * Combined loading state from all mutations
   */
  const isLoading = useMemo(
    () =>
      bulkDeleteMutation.isPending ||
      bulkSuspendMutation.isPending ||
      bulkUnsuspendMutation.isPending ||
      bulkConfirmMutation.isPending ||
      bulkMessageMutation.isPending ||
      bulkCohortAddMutation.isPending ||
      bulkForcePasswordChangeMutation.isPending,
    [
      bulkDeleteMutation.isPending,
      bulkSuspendMutation.isPending,
      bulkUnsuspendMutation.isPending,
      bulkConfirmMutation.isPending,
      bulkMessageMutation.isPending,
      bulkCohortAddMutation.isPending,
      bulkForcePasswordChangeMutation.isPending,
    ]
  );

  // ============================================================================
  // Return Value
  // ============================================================================

  return {
    // Selection state
    selectedUsers,
    selectedUserCount,

    // Selection functions
    selectUser,
    deselectUser,
    selectAll,
    deselectAll,
    toggleUserSelection,
    clearSelection,
    isUserSelected,

    // Bulk action functions
    bulkDelete,
    bulkSuspend,
    bulkUnsuspend,
    bulkConfirm,
    bulkMessage,
    bulkCohortAdd,
    bulkForcePasswordChange,

    // Status
    progress,
    lastResult,
    isLoading,
  };
}
