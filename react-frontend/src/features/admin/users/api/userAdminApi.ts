/**
 * User Administration API Client
 *
 * This module provides API client functions for user administration operations
 * in the Moodle React frontend. It wraps the backend REST API endpoints at
 * /api/v1/admin/users/* and provides type-safe functions for:
 *
 * - Fetching user lists with filtering and pagination
 * - Managing individual users (CRUD operations)
 * - Executing bulk user operations (suspend, confirm, delete, etc.)
 *
 * All functions use the pre-configured axios client with JWT authentication
 * and follow React Query integration patterns for cache invalidation.
 *
 * Based on Moodle admin user management:
 * - Source: public/admin/user.php (user listing, suspend/unsuspend, delete, confirm, unlock)
 * - Source: public/admin/user/user_bulk.php (bulk user operations)
 * - Source: public/admin/user/user_bulk_forms.php (bulk action definitions)
 *
 * @module features/admin/users/api/userAdminApi
 */

import { apiClient } from '@/services/api/client';
import { ADMIN_ENDPOINTS } from '@/services/api/endpoints';
import type { ApiResponse } from '@/types/api';
import type { User } from '@/types/entities';
import type {
  UserListResponse,
  UserListQueryParams,
} from '../types/user-list.types';
import type {
  BulkActionType,
  BulkActionRequest,
  BulkActionResponse,
  BulkActionData,
} from '../types/bulk-actions.types';
import type { UserCreateData, UserUpdateData } from '../types/user.types';

// ============================================================================
// Type Definitions for API Responses
// ============================================================================

/**
 * Response type for single user operations
 */
interface UserApiResponse extends ApiResponse<User> {
  success: true;
  data: User;
}

/**
 * Response type for user deletion
 */
interface DeleteUserResponse extends ApiResponse<{ deleted: boolean; userId: number }> {
  success: true;
  data: {
    deleted: boolean;
    userId: number;
  };
}

/**
 * Response type for user status operations (suspend, unsuspend, unlock, confirm)
 */
interface UserStatusResponse extends ApiResponse<{ success: boolean; userId: number; message?: string }> {
  success: true;
  data: {
    success: boolean;
    userId: number;
    message?: string;
  };
}

/**
 * Response type for resending confirmation email
 */
interface ResendEmailResponse extends ApiResponse<{ sent: boolean; userId: number; message: string }> {
  success: true;
  data: {
    sent: boolean;
    userId: number;
    message: string;
  };
}

// ============================================================================
// User List Operations
// ============================================================================

/**
 * Fetches a paginated list of users with optional filtering and sorting
 *
 * Corresponds to the user listing functionality in public/admin/user.php.
 * Supports filtering by status, role, authentication method, and text search.
 *
 * @param params - Query parameters for filtering, pagination, and sorting
 * @returns Promise resolving to paginated user list response
 *
 * @example
 * ```typescript
 * // Basic user list with pagination
 * const response = await getUserList({ page: 1, perPage: 20 });
 *
 * // Search for users by name or email
 * const searchResults = await getUserList({ search: 'john', page: 1, perPage: 50 });
 *
 * // Filter by status and role
 * const filtered = await getUserList({
 *   status: UserFilterStatus.SUSPENDED,
 *   role: 'student',
 *   sortBy: UserSortField.LASTACCESS,
 *   sortOrder: SortOrder.DESC
 * });
 * ```
 */
export async function getUserList(
  params: UserListQueryParams = {}
): Promise<UserListResponse> {
  try {
    // Build query parameters object for the API request
    const queryParams: Record<string, string | number | undefined> = {};

    // Pagination parameters
    if (params.page !== undefined) {
      queryParams.page = params.page;
    }
    if (params.perPage !== undefined) {
      queryParams.perPage = params.perPage;
    }

    // Sorting parameters
    if (params.sortBy !== undefined) {
      queryParams.sortBy = params.sortBy;
    }
    if (params.sortOrder !== undefined) {
      queryParams.sortOrder = params.sortOrder;
    }

    // Search and filter parameters
    if (params.search !== undefined && params.search.trim() !== '') {
      queryParams.search = params.search.trim();
    }
    if (params.status !== undefined) {
      queryParams.status = params.status;
    }
    if (params.authMethod !== undefined) {
      queryParams.authMethod = params.authMethod;
    }
    if (params.role !== undefined) {
      queryParams.role = params.role;
    }

    // Individual status filters (when not using predefined status filter)
    if (params.confirmed !== undefined) {
      queryParams.confirmed = params.confirmed;
    }
    if (params.suspended !== undefined) {
      queryParams.suspended = params.suspended;
    }
    if (params.deleted !== undefined) {
      queryParams.deleted = params.deleted;
    }

    const response = await apiClient.get<ApiResponse<UserListResponse>>(
      ADMIN_ENDPOINTS.USERS.LIST,
      { params: queryParams }
    );

    // Extract and return the user list response from the API envelope
    return response.data.data;
  } catch (error) {
    // Re-throw error for handling by React Query or calling code
    throw error;
  }
}

// ============================================================================
// Individual User Operations
// ============================================================================

/**
 * Fetches detailed information for a single user by ID
 *
 * Retrieves the complete user record including all profile fields,
 * preferences, and system metadata.
 *
 * @param userId - The unique identifier of the user to retrieve
 * @returns Promise resolving to the user entity
 *
 * @example
 * ```typescript
 * const user = await getUserById(123);
 * console.log(`User: ${user.firstname} ${user.lastname}`);
 * ```
 */
export async function getUserById(userId: number): Promise<User> {
  try {
    const response = await apiClient.get<UserApiResponse>(
      ADMIN_ENDPOINTS.USERS.UPDATE(userId)
    );

    return response.data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Creates a new user account
 *
 * Corresponds to the user creation functionality accessible via /user/editadvanced.php.
 * The backend wraps the existing user_create_user() Moodle function.
 *
 * Required fields: auth, username, firstname, lastname, email, password, city, country
 *
 * @param userData - The user data for creating the new account
 * @returns Promise resolving to the newly created user entity
 *
 * @example
 * ```typescript
 * const newUser = await createUser({
 *   auth: 'manual',
 *   username: 'jsmith',
 *   firstname: 'John',
 *   lastname: 'Smith',
 *   email: 'john.smith@example.com',
 *   password: 'SecurePassword123!',
 *   city: 'New York',
 *   country: 'US'
 * });
 * ```
 */
export async function createUser(userData: UserCreateData): Promise<User> {
  try {
    const response = await apiClient.post<UserApiResponse>(
      ADMIN_ENDPOINTS.USERS.CREATE,
      userData
    );

    return response.data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Updates an existing user account
 *
 * Corresponds to the user update functionality in public/admin/user.php.
 * The backend wraps the existing user_update_user() Moodle function.
 *
 * Only provided fields will be updated; omitted fields remain unchanged.
 *
 * @param userData - The user data containing id and fields to update
 * @returns Promise resolving to the updated user entity
 *
 * @example
 * ```typescript
 * const updatedUser = await updateUser({
 *   id: 123,
 *   firstname: 'Jonathan',
 *   city: 'Boston'
 * });
 * ```
 */
export async function updateUser(userData: UserUpdateData): Promise<User> {
  try {
    const { id, ...updateFields } = userData;

    const response = await apiClient.put<UserApiResponse>(
      ADMIN_ENDPOINTS.USERS.UPDATE(id),
      updateFields
    );

    return response.data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Deletes a user account (soft delete)
 *
 * Corresponds to the delete functionality in public/admin/user.php.
 * The backend wraps the existing delete_user() Moodle function.
 *
 * Moodle uses soft deletes - the user record is marked as deleted
 * but not removed from the database. This allows for potential recovery
 * and maintains referential integrity.
 *
 * Note: Site administrators cannot be deleted.
 *
 * @param userId - The unique identifier of the user to delete
 * @returns Promise resolving to deletion confirmation
 *
 * @example
 * ```typescript
 * const result = await deleteUser(123);
 * if (result.deleted) {
 *   console.log('User successfully deleted');
 * }
 * ```
 */
export async function deleteUser(
  userId: number
): Promise<{ deleted: boolean; userId: number }> {
  try {
    const response = await apiClient.delete<DeleteUserResponse>(
      ADMIN_ENDPOINTS.USERS.DELETE(userId)
    );

    return response.data.data;
  } catch (error) {
    throw error;
  }
}

// ============================================================================
// User Status Operations
// ============================================================================

/**
 * Suspends a user account
 *
 * Corresponds to the suspend functionality in public/admin/user.php (lines 127-138).
 * Suspended users are immediately logged out and cannot log in until unsuspended.
 *
 * Requirements:
 * - User must not be a site administrator
 * - User cannot suspend themselves
 * - User must not already be suspended
 *
 * @param userId - The unique identifier of the user to suspend
 * @returns Promise resolving to operation result
 *
 * @example
 * ```typescript
 * const result = await suspendUser(123);
 * if (result.success) {
 *   console.log('User suspended successfully');
 * }
 * ```
 */
export async function suspendUser(
  userId: number
): Promise<{ success: boolean; userId: number; message?: string }> {
  try {
    const response = await apiClient.post<UserStatusResponse>(
      ADMIN_ENDPOINTS.USERS.BULK,
      {
        action: 'suspend',
        userIds: [userId],
      }
    );

    return response.data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Unsuspends (reactivates) a user account
 *
 * Corresponds to the unsuspend functionality in public/admin/user.php (lines 140-149).
 * Allows the user to log in again after being suspended.
 *
 * @param userId - The unique identifier of the user to unsuspend
 * @returns Promise resolving to operation result
 *
 * @example
 * ```typescript
 * const result = await unsuspendUser(123);
 * if (result.success) {
 *   console.log('User reactivated successfully');
 * }
 * ```
 */
export async function unsuspendUser(
  userId: number
): Promise<{ success: boolean; userId: number; message?: string }> {
  try {
    const response = await apiClient.post<UserStatusResponse>(
      ADMIN_ENDPOINTS.USERS.BULK,
      {
        action: 'unsuspend',
        userIds: [userId],
      }
    );

    return response.data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Unlocks a user account that has been locked due to failed login attempts
 *
 * Corresponds to the unlock functionality in public/admin/user.php (lines 151-158).
 * The backend calls login_unlock_account() to reset the failed login count.
 *
 * @param userId - The unique identifier of the user to unlock
 * @returns Promise resolving to operation result
 *
 * @example
 * ```typescript
 * const result = await unlockUser(123);
 * if (result.success) {
 *   console.log('User account unlocked');
 * }
 * ```
 */
export async function unlockUser(
  userId: number
): Promise<{ success: boolean; userId: number; message?: string }> {
  try {
    const response = await apiClient.post<UserStatusResponse>(
      ADMIN_ENDPOINTS.USERS.BULK,
      {
        action: 'unlock',
        userIds: [userId],
      }
    );

    return response.data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Confirms an unconfirmed user account
 *
 * Corresponds to the confirm functionality in public/admin/user.php (lines 30-46).
 * Manually confirms a user account that hasn't completed email verification.
 * The backend calls the auth plugin's user_confirm() method.
 *
 * @param userId - The unique identifier of the user to confirm
 * @returns Promise resolving to operation result
 *
 * @example
 * ```typescript
 * const result = await confirmUser(123);
 * if (result.success) {
 *   console.log('User account confirmed');
 * }
 * ```
 */
export async function confirmUser(
  userId: number
): Promise<{ success: boolean; userId: number; message?: string }> {
  try {
    const response = await apiClient.post<UserStatusResponse>(
      ADMIN_ENDPOINTS.USERS.BULK,
      {
        action: 'confirm',
        userIds: [userId],
      }
    );

    return response.data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Resends the confirmation email to an unconfirmed user
 *
 * Corresponds to the resendemail functionality in public/admin/user.php (lines 47-64).
 * The backend calls send_confirmation_email() to resend the verification email.
 *
 * Prerequisites:
 * - User must not be already confirmed
 * - User must have a valid email address
 *
 * @param userId - The unique identifier of the user to send confirmation email to
 * @returns Promise resolving to operation result
 *
 * @example
 * ```typescript
 * const result = await resendConfirmationEmail(123);
 * if (result.sent) {
 *   console.log(result.message); // 'Confirmation email sent successfully'
 * }
 * ```
 */
export async function resendConfirmationEmail(
  userId: number
): Promise<{ sent: boolean; userId: number; message: string }> {
  try {
    const response = await apiClient.post<ResendEmailResponse>(
      ADMIN_ENDPOINTS.USERS.BULK,
      {
        action: 'resendemail',
        userIds: [userId],
      }
    );

    return response.data.data;
  } catch (error) {
    throw error;
  }
}

// ============================================================================
// Bulk User Operations
// ============================================================================

/**
 * Executes a bulk action on multiple users
 *
 * Maps bulk operations from user_bulk_forms.php to modern REST API calls.
 * Supports all standard Moodle bulk user actions:
 *
 * - CONFIRM: Confirm unconfirmed user accounts (requires moodle/user:update)
 * - MESSAGE: Send message to selected users (requires moodle/site:readallmessages)
 * - DELETE: Delete selected user accounts (requires moodle/user:delete)
 * - DISPLAY: Display selected users on page
 * - DOWNLOAD: Download user data in various formats
 * - FORCE_PASSWORD_CHANGE: Force password change on next login
 * - ADD_TO_COHORT: Add selected users to a cohort (requires moodle/cohort:assign)
 * - SUSPEND: Suspend selected user accounts
 * - UNSUSPEND: Unsuspend selected user accounts
 *
 * @param action - The type of bulk action to perform
 * @param userIds - Array of user IDs to apply the action to
 * @param data - Optional action-specific data (message content, cohort ID, etc.)
 * @param options - Optional configuration for the bulk operation
 * @returns Promise resolving to bulk action response with success/failure details
 *
 * @example
 * ```typescript
 * // Suspend multiple users
 * const result = await bulkUserAction(
 *   BulkActionType.SUSPEND,
 *   [123, 456, 789]
 * );
 *
 * // Force password change with notification
 * const result = await bulkUserAction(
 *   BulkActionType.FORCE_PASSWORD_CHANGE,
 *   [123, 456],
 *   undefined,
 *   { sendNotifications: true }
 * );
 *
 * // Add users to a cohort
 * const result = await bulkUserAction(
 *   BulkActionType.ADD_TO_COHORT,
 *   [123, 456, 789],
 *   { cohortId: 42, cohortName: 'Class of 2024' }
 * );
 *
 * // Delete users (requires confirmation)
 * const result = await bulkUserAction(
 *   BulkActionType.DELETE,
 *   [123, 456],
 *   undefined,
 *   { confirmed: true }
 * );
 * ```
 */
export async function bulkUserAction(
  action: BulkActionType,
  userIds: number[],
  data?: BulkActionData,
  options?: {
    confirmed?: boolean;
    returnUrl?: string;
    sendNotifications?: boolean;
    continueOnError?: boolean;
    batchSize?: number;
    async?: boolean;
  }
): Promise<BulkActionResponse> {
  try {
    // Validate input
    if (!userIds || userIds.length === 0) {
      return {
        success: false,
        message: 'No users selected for bulk operation',
        successCount: 0,
        failureCount: 0,
        totalCount: 0,
        errors: ['No user IDs provided'],
      };
    }

    // Build the request payload
    const requestPayload: BulkActionRequest = {
      action,
      userIds,
      data,
      confirmed: options?.confirmed,
      returnUrl: options?.returnUrl,
    };

    // Add optional configuration to the request
    const requestConfig: Record<string, unknown> = {};
    if (options?.sendNotifications !== undefined) {
      requestConfig.sendNotifications = options.sendNotifications;
    }
    if (options?.continueOnError !== undefined) {
      requestConfig.continueOnError = options.continueOnError;
    }
    if (options?.batchSize !== undefined) {
      requestConfig.batchSize = options.batchSize;
    }
    if (options?.async !== undefined) {
      requestConfig.async = options.async;
    }

    // Merge config into payload if there are options
    const finalPayload = {
      ...requestPayload,
      ...(Object.keys(requestConfig).length > 0 && { options: requestConfig }),
    };

    const response = await apiClient.post<ApiResponse<BulkActionResponse>>(
      ADMIN_ENDPOINTS.USERS.BULK,
      finalPayload
    );

    return response.data.data;
  } catch (error) {
    // Return a structured error response for consistency
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      success: false,
      message: 'Bulk operation failed',
      successCount: 0,
      failureCount: userIds.length,
      totalCount: userIds.length,
      errors: [errorMessage],
    };
  }
}

// ============================================================================
// Convenience Functions for Common Bulk Operations
// ============================================================================

/**
 * Bulk suspend multiple users
 *
 * Convenience wrapper for bulkUserAction with SUSPEND action type.
 *
 * @param userIds - Array of user IDs to suspend
 * @returns Promise resolving to bulk action response
 */
export async function bulkSuspendUsers(
  userIds: number[]
): Promise<BulkActionResponse> {
  return bulkUserAction('suspend' as BulkActionType, userIds);
}

/**
 * Bulk unsuspend multiple users
 *
 * Convenience wrapper for bulkUserAction with UNSUSPEND action type.
 *
 * @param userIds - Array of user IDs to unsuspend
 * @returns Promise resolving to bulk action response
 */
export async function bulkUnsuspendUsers(
  userIds: number[]
): Promise<BulkActionResponse> {
  return bulkUserAction('unsuspend' as BulkActionType, userIds);
}

/**
 * Bulk confirm multiple users
 *
 * Convenience wrapper for bulkUserAction with CONFIRM action type.
 *
 * @param userIds - Array of user IDs to confirm
 * @returns Promise resolving to bulk action response
 */
export async function bulkConfirmUsers(
  userIds: number[]
): Promise<BulkActionResponse> {
  return bulkUserAction('confirm' as BulkActionType, userIds);
}

/**
 * Bulk delete multiple users
 *
 * Convenience wrapper for bulkUserAction with DELETE action type.
 * Requires explicit confirmation to prevent accidental deletions.
 *
 * @param userIds - Array of user IDs to delete
 * @param confirmed - Must be true to confirm deletion
 * @returns Promise resolving to bulk action response
 */
export async function bulkDeleteUsers(
  userIds: number[],
  confirmed: boolean = false
): Promise<BulkActionResponse> {
  return bulkUserAction('delete' as BulkActionType, userIds, undefined, {
    confirmed,
  });
}

/**
 * Bulk force password change for multiple users
 *
 * Convenience wrapper for bulkUserAction with FORCE_PASSWORD_CHANGE action type.
 *
 * @param userIds - Array of user IDs to force password change
 * @param sendNotifications - Whether to notify users via email
 * @returns Promise resolving to bulk action response
 */
export async function bulkForcePasswordChange(
  userIds: number[],
  sendNotifications: boolean = true
): Promise<BulkActionResponse> {
  return bulkUserAction(
    'forcepasswordchange' as BulkActionType,
    userIds,
    undefined,
    { sendNotifications }
  );
}

/**
 * Bulk add users to a cohort
 *
 * Convenience wrapper for bulkUserAction with ADD_TO_COHORT action type.
 *
 * @param userIds - Array of user IDs to add to cohort
 * @param cohortId - The cohort ID to add users to
 * @param cohortName - The cohort name (for confirmation/display)
 * @returns Promise resolving to bulk action response
 */
export async function bulkAddToCohort(
  userIds: number[],
  cohortId: number,
  cohortName: string
): Promise<BulkActionResponse> {
  return bulkUserAction('addtocohort' as BulkActionType, userIds, {
    cohortId,
    cohortName,
  });
}
