/**
 * Admin User API Type Definitions
 *
 * TypeScript type definitions for admin user API requests and responses including
 * standardized API envelope types, error responses, pagination metadata, and specific
 * endpoint request/response types for all admin user management operations.
 *
 * This file defines the complete API contract between the React frontend and the
 * backend API endpoints for user administration. All types follow the standard API
 * response envelope pattern defined in Section 0.3 of the Agent Action Plan.
 *
 * API Endpoints Covered:
 * - GET /api/v1/admin/users - List users with filtering and pagination
 * - GET /api/v1/admin/users/{id} - Get single user details
 * - POST /api/v1/admin/users - Create new user
 * - PUT /api/v1/admin/users/{id} - Update existing user
 * - DELETE /api/v1/admin/users/{id} - Delete user
 * - POST /api/v1/admin/users/bulk - Bulk actions on multiple users
 * - PUT /api/v1/admin/users/{id}/suspend - Suspend/unsuspend user
 * - PUT /api/v1/admin/users/{id}/confirm - Confirm unconfirmed user
 *
 * Source References:
 * - public/admin/user.php - Admin user management operations
 * - public/admin/user/lib.php - User listing and bulk operations
 *
 * @package react-frontend
 * @subpackage features/admin/users/types
 */

import type { User } from './user.types';
import type { UserListQueryParams } from './user-list.types';
import type { UserFormData } from './user-form.types';
import type { BulkActionType } from './bulk-actions.types';
import type { ApiResult } from '@/types/api';
import type { ApiErrorCode } from '@/types/errors';
import type { UserId } from '@/types/common';

// ============================================================================
// Request Interfaces
// ============================================================================

/**
 * Request interface for GET /api/v1/admin/users
 *
 * Retrieves a paginated list of users with optional filtering and sorting.
 * Supports comprehensive user filtering by status, authentication method, role,
 * and text search across multiple fields.
 *
 * @interface GetUsersRequest
 *
 * @example
 * ```typescript
 * const request: GetUsersRequest = {
 *   params: {
 *     page: 1,
 *     perPage: 50,
 *     sortBy: UserSortField.LASTNAME,
 *     sortOrder: SortOrder.ASC,
 *     search: 'john',
 *     status: UserFilterStatus.ACTIVE,
 *     authMethod: 'manual'
 *   }
 * };
 * ```
 */
export interface GetUsersRequest {
  /**
   * Query parameters for filtering, sorting, and pagination
   *
   * All parameters are optional. The API applies sensible defaults:
   * - page: 1
   * - perPage: 50
   * - sortBy: username
   * - sortOrder: ASC
   * - status: all (no status filter)
   */
  params: UserListQueryParams;
}

/**
 * Request interface for GET /api/v1/admin/users/{id}
 *
 * Retrieves detailed information for a single user by their ID.
 *
 * @interface GetUserRequest
 *
 * @example
 * ```typescript
 * const request: GetUserRequest = {
 *   userId: 42
 * };
 * ```
 */
export interface GetUserRequest {
  /**
   * Unique identifier of the user to retrieve
   */
  userId: UserId;
}

/**
 * Request interface for POST /api/v1/admin/users
 *
 * Creates a new user account with the provided data.
 * Requires moodle/user:create capability.
 *
 * @interface CreateUserRequest
 *
 * @example
 * ```typescript
 * const request: CreateUserRequest = {
 *   data: {
 *     username: 'jdoe',
 *     email: 'john.doe@example.com',
 *     firstname: 'John',
 *     lastname: 'Doe',
 *     auth: 'manual',
 *     password: 'SecurePass123!',
 *     city: 'New York',
 *     country: 'US'
 *   }
 * };
 * ```
 */
export interface CreateUserRequest {
  /**
   * User data for the new account
   *
   * Must include all required fields:
   * - username (unique, 3-100 chars)
   * - email (valid email format)
   * - firstname (max 100 chars)
   * - lastname (max 100 chars)
   * - auth (authentication method)
   * - password (min 8 chars, required for create)
   * - city (max 120 chars)
   * - country (ISO 3166-1 alpha-2 code)
   */
  data: UserFormData;
}

/**
 * Request interface for PUT /api/v1/admin/users/{id}
 *
 * Updates an existing user account with the provided data.
 * Requires moodle/user:update capability.
 *
 * @interface UpdateUserRequest
 *
 * @example
 * ```typescript
 * const request: UpdateUserRequest = {
 *   userId: 42,
 *   data: {
 *     email: 'newemail@example.com',
 *     firstname: 'Jane',
 *     city: 'San Francisco'
 *   }
 * };
 * ```
 */
export interface UpdateUserRequest {
  /**
   * Unique identifier of the user to update
   */
  userId: UserId;

  /**
   * User data to update
   *
   * Can include any subset of editable user fields.
   * Password field is optional; if provided, updates the user's password.
   */
  data: Partial<UserFormData>;
}

/**
 * Request interface for DELETE /api/v1/admin/users/{id}
 *
 * Marks a user account as deleted (soft delete).
 * Requires moodle/user:delete capability.
 *
 * Note: This performs a soft delete by setting the deleted flag.
 * The user record remains in the database for audit purposes.
 *
 * @interface DeleteUserRequest
 *
 * @example
 * ```typescript
 * const request: DeleteUserRequest = {
 *   userId: 42
 * };
 * ```
 */
export interface DeleteUserRequest {
  /**
   * Unique identifier of the user to delete
   */
  userId: UserId;
}

/**
 * Request interface for POST /api/v1/admin/users/bulk
 *
 * Performs a bulk action on multiple users simultaneously.
 * Requires appropriate capabilities based on the action type.
 *
 * @interface BulkActionRequest
 *
 * @example
 * ```typescript
 * const request: BulkActionRequest = {
 *   action: BulkActionType.SUSPEND,
 *   userIds: [10, 20, 30, 40],
 *   data: {
 *     reason: 'Account verification required'
 *   }
 * };
 * ```
 */
export interface BulkActionRequest {
  /**
   * Type of bulk action to perform
   *
   * Available actions:
   * - CONFIRM: Confirm unconfirmed user accounts
   * - MESSAGE: Send message to selected users
   * - DELETE: Delete selected user accounts
   * - SUSPEND: Suspend selected user accounts
   * - UNSUSPEND: Unsuspend selected user accounts
   * - FORCE_PASSWORD_CHANGE: Force password change
   * - ADD_TO_COHORT: Add users to a cohort
   * - DOWNLOAD: Download user data
   * - DISPLAY: Display selected users
   */
  action: BulkActionType;

  /**
   * Array of user IDs to perform the action on
   *
   * Maximum recommended: 2000 users per bulk operation (MAX_BULK_USERS)
   */
  userIds: UserId[];

  /**
   * Optional additional data specific to the action
   *
   * For example:
   * - MESSAGE action: { subject: string, message: string }
   * - ADD_TO_COHORT action: { cohortId: number }
   * - DOWNLOAD action: { format: 'csv' | 'excel' | 'ods' }
   */
  data?: Record<string, unknown>;
}

/**
 * Request interface for PUT /api/v1/admin/users/{id}/suspend
 *
 * Suspends or unsuspends a user account.
 * Requires moodle/user:update capability.
 *
 * @interface SuspendUserRequest
 *
 * @example
 * ```typescript
 * // Suspend user
 * const suspendRequest: SuspendUserRequest = {
 *   userId: 42,
 *   suspended: true
 * };
 *
 * // Unsuspend user
 * const unsuspendRequest: SuspendUserRequest = {
 *   userId: 42,
 *   suspended: false
 * };
 * ```
 */
export interface SuspendUserRequest {
  /**
   * Unique identifier of the user to suspend/unsuspend
   */
  userId: UserId;

  /**
   * Suspension status
   *
   * - true: Suspend the user account
   * - false: Unsuspend (reactivate) the user account
   */
  suspended: boolean;
}

/**
 * Request interface for PUT /api/v1/admin/users/{id}/confirm
 *
 * Confirms an unconfirmed user account.
 * Requires moodle/user:update capability.
 *
 * Unconfirmed users are those who have not yet clicked the confirmation
 * link in their registration email.
 *
 * @interface ConfirmUserRequest
 *
 * @example
 * ```typescript
 * const request: ConfirmUserRequest = {
 *   userId: 42
 * };
 * ```
 */
export interface ConfirmUserRequest {
  /**
   * Unique identifier of the user to confirm
   */
  userId: UserId;
}

// ============================================================================
// Response Data Interfaces
// ============================================================================

/**
 * Data interface for user list responses
 *
 * Contains the array of users and total count for pagination.
 *
 * @interface UserListData
 */
export interface UserListData {
  /**
   * Array of user records for the current page
   */
  users: User[];

  /**
   * Total number of users matching the query filters
   *
   * Used for calculating pagination information and displaying
   * "Showing X of Y users" messages.
   */
  total: number;
}

/**
 * Data interface for bulk action results
 *
 * Provides detailed feedback on the outcome of a bulk operation,
 * including success/failure counts and individual user results.
 *
 * @interface BulkActionResultData
 */
export interface BulkActionResultData {
  /**
   * Number of users successfully processed
   */
  successCount: number;

  /**
   * Number of users that failed to process
   */
  failureCount: number;

  /**
   * Detailed results for each user
   *
   * Array of objects containing:
   * - userId: User ID
   * - success: Whether the operation succeeded for this user
   * - message: Success or error message for this user
   * - error: Error code if the operation failed (optional)
   */
  results: Array<{
    userId: UserId;
    success: boolean;
    message: string;
    error?: ApiErrorCode;
  }>;
}

// ============================================================================
// Response Type Aliases
// ============================================================================

/**
 * Response type for GET /api/v1/admin/users
 *
 * Returns a paginated list of users with metadata.
 *
 * @example
 * ```typescript
 * const response: GetUsersResponse = {
 *   success: true,
 *   data: {
 *     users: [
 *       { id: 1, username: 'user1', email: 'user1@example.com', ... },
 *       { id: 2, username: 'user2', email: 'user2@example.com', ... }
 *     ],
 *     total: 150
 *   },
 *   meta: {
 *     pagination: {
 *       page: 1,
 *       perPage: 50,
 *       total: 150,
 *       totalPages: 3
 *     }
 *   }
 * };
 * ```
 */
export type GetUsersResponse = {
  success: true;
  data: UserListData;
  meta?: {
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
};

/**
 * Response type for GET /api/v1/admin/users/{id}
 *
 * Returns detailed information for a single user.
 */
export type GetUserResponse = {
  success: true;
  data: User;
  meta?: Record<string, unknown>;
};

/**
 * Response type for POST /api/v1/admin/users
 *
 * Returns the newly created user record.
 */
export type CreateUserResponse = {
  success: true;
  data: User;
  meta?: Record<string, unknown>;
};

/**
 * Response type for PUT /api/v1/admin/users/{id}
 *
 * Returns the updated user record.
 */
export type UpdateUserResponse = {
  success: true;
  data: User;
  meta?: Record<string, unknown>;
};

/**
 * Response type for DELETE /api/v1/admin/users/{id}
 *
 * Returns confirmation of deletion with the deleted user's ID.
 */
export type DeleteUserResponse = {
  success: true;
  data: {
    userId: UserId;
  };
  meta?: Record<string, unknown>;
};

/**
 * Response type for POST /api/v1/admin/users/bulk
 *
 * Returns detailed results of the bulk operation including
 * success/failure counts and per-user outcomes.
 */
export type BulkActionResponse = {
  success: true;
  data: BulkActionResultData;
  meta?: Record<string, unknown>;
};

/**
 * Response type for PUT /api/v1/admin/users/{id}/suspend
 *
 * Returns the updated user record with new suspension status.
 */
export type SuspendUserResponse = {
  success: true;
  data: User;
  meta?: Record<string, unknown>;
};

/**
 * Response type for PUT /api/v1/admin/users/{id}/confirm
 *
 * Returns the confirmed user record.
 */
export type ConfirmUserResponse = {
  success: true;
  data: User;
  meta?: Record<string, unknown>;
};

// ============================================================================
// Result Type Aliases (Union of Success and Error)
// ============================================================================

/**
 * Result type for GET /api/v1/admin/users
 *
 * Union type representing either a successful response or an error.
 * Use this type when handling API results in components or hooks.
 *
 * @example
 * ```typescript
 * const handleGetUsers = async (params: UserListQueryParams): Promise<GetUsersResult> => {
 *   try {
 *     const response = await apiClient.get('/admin/users', { params });
 *     return response.data;
 *   } catch (error) {
 *     return {
 *       success: false,
 *       error: {
 *         code: ApiErrorCode.SERVER_ERROR,
 *         message: 'Failed to fetch users'
 *       }
 *     };
 *   }
 * };
 * ```
 */
export type GetUsersResult = ApiResult<UserListData>;

/**
 * Result type for GET /api/v1/admin/users/{id}
 *
 * Union type representing either a successful user retrieval or an error.
 */
export type GetUserResult = ApiResult<User>;

/**
 * Result type for POST /api/v1/admin/users
 *
 * Union type representing either a successful user creation or an error.
 */
export type CreateUserResult = ApiResult<User>;

/**
 * Result type for PUT /api/v1/admin/users/{id}
 *
 * Union type representing either a successful user update or an error.
 */
export type UpdateUserResult = ApiResult<User>;

/**
 * Result type for DELETE /api/v1/admin/users/{id}
 *
 * Union type representing either a successful user deletion or an error.
 */
export type DeleteUserResult = ApiResult<{ userId: UserId }>;

/**
 * Result type for POST /api/v1/admin/users/bulk
 *
 * Union type representing either a successful bulk operation or an error.
 */
export type BulkActionResult = ApiResult<BulkActionResultData>;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an API result is a successful GetUsersResponse
 *
 * @param result - The API result to check
 * @returns True if the result is a successful response, false if it's an error
 *
 * @example
 * ```typescript
 * const result = await getUsersApi(params);
 * if (isGetUsersSuccess(result)) {
 *   console.log('Users:', result.data.users);
 *   console.log('Total:', result.data.total);
 * } else {
 *   console.error('Error:', result.error.message);
 * }
 * ```
 */
export function isGetUsersSuccess(
  result: GetUsersResult
): result is GetUsersResponse {
  return result.success === true;
}

/**
 * Type guard to check if an API result is a successful GetUserResponse
 *
 * @param result - The API result to check
 * @returns True if the result is a successful response, false if it's an error
 */
export function isGetUserSuccess(result: GetUserResult): result is GetUserResponse {
  return result.success === true;
}

/**
 * Type guard to check if an API result is a successful CreateUserResponse
 *
 * @param result - The API result to check
 * @returns True if the result is a successful response, false if it's an error
 */
export function isCreateUserSuccess(
  result: CreateUserResult
): result is CreateUserResponse {
  return result.success === true;
}

/**
 * Type guard to check if an API result is a successful UpdateUserResponse
 *
 * @param result - The API result to check
 * @returns True if the result is a successful response, false if it's an error
 */
export function isUpdateUserSuccess(
  result: UpdateUserResult
): result is UpdateUserResponse {
  return result.success === true;
}

/**
 * Type guard to check if an API result is a successful DeleteUserResponse
 *
 * @param result - The API result to check
 * @returns True if the result is a successful response, false if it's an error
 */
export function isDeleteUserSuccess(
  result: DeleteUserResult
): result is DeleteUserResponse {
  return result.success === true;
}

/**
 * Type guard to check if an API result is a successful BulkActionResponse
 *
 * @param result - The API result to check
 * @returns True if the result is a successful response, false if it's an error
 */
export function isBulkActionSuccess(
  result: BulkActionResult
): result is BulkActionResponse {
  return result.success === true;
}
