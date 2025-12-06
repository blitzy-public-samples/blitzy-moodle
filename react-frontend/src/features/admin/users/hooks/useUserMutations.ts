/**
 * User Mutations Hook
 *
 * Custom React hook providing mutation operations for user management including
 * create, update, delete, suspend, unsuspend, unlock, confirm, and resend
 * confirmation email using React Query mutations with optimistic updates and
 * cache invalidation.
 *
 * This hook wraps the user admin API functions and provides:
 * - Type-safe mutation interfaces
 * - Automatic cache invalidation on success
 * - Error handling with toast notifications
 * - Optimistic updates where appropriate for better UX
 *
 * Based on operations from public/admin/user.php:
 * - delete: lines 65-98
 * - suspend: lines 127-138
 * - unsuspend: lines 140-149
 * - unlock: lines 151-158
 * - confirmuser: lines 30-46
 * - resendemail: lines 47-64
 *
 * @module features/admin/users/hooks/useUserMutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createUser,
  updateUser,
  deleteUser,
  suspendUser,
  unsuspendUser,
  unlockUser,
  confirmUser,
  resendConfirmationEmail,
} from '../api/userAdminApi';
import { useToast } from '@/hooks/useToast';
import type { User } from '@/types/entities';
import type { UserCreateData, UserUpdateData } from '../types/user.types';
import type { UserFormData } from '../types/user-form.types';

// ============================================================================
// Query Key Constants
// ============================================================================

/**
 * Query keys used for cache invalidation
 * Centralized to ensure consistency across mutations
 */
const USER_QUERY_KEYS = {
  /** Key for user list queries */
  users: ['users'] as const,
  /** Key for single user query */
  user: (id: number) => ['users', id] as const,
  /** Key for admin user list queries */
  adminUsers: ['admin', 'users'] as const,
  /** Key for single admin user query */
  adminUser: (id: number) => ['admin', 'users', id] as const,
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Parameters for the create user mutation
 * Maps UserFormData to the API's UserCreateData format
 */
export interface CreateUserParams {
  /** User form data with all required fields for creation */
  data: UserFormData;
}

/**
 * Parameters for the update user mutation
 */
export interface UpdateUserParams {
  /** User ID to update */
  userId: number;
  /** Partial user data with fields to update */
  data: Partial<UserFormData>;
}

/**
 * Parameters for single user operations (delete, suspend, etc.)
 */
export interface SingleUserParams {
  /** User ID to perform operation on */
  userId: number;
  /** Optional user name for display in notifications */
  userName?: string;
}

/**
 * Result type for mutation status operations
 */
export interface UserStatusResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** User ID the operation was performed on */
  userId: number;
  /** Optional message from the server */
  message?: string;
}

/**
 * Result type for resend email operation
 */
export interface ResendEmailResult {
  /** Whether the email was sent successfully */
  sent: boolean;
  /** User ID the email was sent to */
  userId: number;
  /** Message describing the result */
  message: string;
}

// ============================================================================
// Mutation Context Types (for optimistic updates)
// ============================================================================

/**
 * Context type for update user mutation
 * Contains previous user data for rollback on error
 */
interface UpdateUserContext {
  previousUser?: User;
}

/**
 * Context type for delete user mutation
 * Contains previous user list data for rollback on error
 */
interface DeleteUserContext {
  previousUsers?: unknown;
  userId?: number;
}

/**
 * Context type for single user status mutations (suspend, unsuspend, confirm)
 * Contains previous user data for rollback on error
 */
interface SingleUserContext {
  previousUser?: User;
}

/**
 * Return type for the useUserMutations hook
 * Provides all mutation hooks and their states
 */
export interface UseUserMutationsReturn {
  // Create user mutation
  createUser: ReturnType<typeof useMutation<User, Error, CreateUserParams>>;

  // Update user mutation
  updateUser: ReturnType<typeof useMutation<User, Error, UpdateUserParams>>;

  // Delete user mutation
  deleteUser: ReturnType<typeof useMutation<{ deleted: boolean; userId: number }, Error, SingleUserParams>>;

  // Suspend user mutation
  suspendUser: ReturnType<typeof useMutation<UserStatusResult, Error, SingleUserParams>>;

  // Unsuspend user mutation
  unsuspendUser: ReturnType<typeof useMutation<UserStatusResult, Error, SingleUserParams>>;

  // Unlock user mutation
  unlockUser: ReturnType<typeof useMutation<UserStatusResult, Error, SingleUserParams>>;

  // Confirm user mutation
  confirmUser: ReturnType<typeof useMutation<UserStatusResult, Error, SingleUserParams>>;

  // Resend confirmation email mutation
  resendConfirmationEmail: ReturnType<typeof useMutation<ResendEmailResult, Error, SingleUserParams>>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts UserFormData to UserCreateData for the API
 *
 * Ensures all required fields are present and properly typed
 * for the user creation API endpoint.
 *
 * @param formData - The form data to convert
 * @returns UserCreateData compatible with the API
 */
function mapFormDataToCreateData(formData: UserFormData): UserCreateData {
  return {
    // Required fields
    auth: formData.auth,
    username: formData.username,
    firstname: formData.firstname,
    lastname: formData.lastname,
    email: formData.email,
    password: formData.password || '',
    city: formData.city,
    country: formData.country,
    // Optional fields
    ...(formData.idnumber && { idnumber: formData.idnumber }),
    ...(formData.phone1 && { phone1: formData.phone1 }),
    ...(formData.phone2 && { phone2: formData.phone2 }),
    ...(formData.institution && { institution: formData.institution }),
    ...(formData.department && { department: formData.department }),
    ...(formData.address && { address: formData.address }),
    ...(formData.lang && { lang: formData.lang }),
    ...(formData.calendartype && { calendartype: formData.calendartype }),
    ...(formData.theme && { theme: formData.theme }),
    ...(formData.timezone && { timezone: formData.timezone }),
    ...(formData.description && { description: formData.description }),
    ...(formData.descriptionformat !== undefined && { descriptionformat: formData.descriptionformat }),
    ...(formData.mailformat !== undefined && { mailformat: formData.mailformat }),
    ...(formData.maildigest !== undefined && { maildigest: formData.maildigest }),
    ...(formData.maildisplay !== undefined && { maildisplay: formData.maildisplay }),
  };
}

/**
 * Converts partial UserFormData to UserUpdateData for the API
 *
 * Only includes fields that are present in the form data
 * to support partial updates.
 *
 * @param userId - The user ID to update
 * @param formData - The partial form data with fields to update
 * @returns UserUpdateData compatible with the API
 */
function mapFormDataToUpdateData(userId: number, formData: Partial<UserFormData>): UserUpdateData {
  const updateData: UserUpdateData = { id: userId };

  // Map only provided fields
  if (formData.auth !== undefined) updateData.auth = formData.auth;
  if (formData.firstname !== undefined) updateData.firstname = formData.firstname;
  if (formData.lastname !== undefined) updateData.lastname = formData.lastname;
  if (formData.email !== undefined) updateData.email = formData.email;
  if (formData.city !== undefined) updateData.city = formData.city;
  if (formData.country !== undefined) updateData.country = formData.country;
  if (formData.idnumber !== undefined) updateData.idnumber = formData.idnumber;
  if (formData.phone1 !== undefined) updateData.phone1 = formData.phone1;
  if (formData.phone2 !== undefined) updateData.phone2 = formData.phone2;
  if (formData.institution !== undefined) updateData.institution = formData.institution;
  if (formData.department !== undefined) updateData.department = formData.department;
  if (formData.address !== undefined) updateData.address = formData.address;
  if (formData.lang !== undefined) updateData.lang = formData.lang;
  if (formData.calendartype !== undefined) updateData.calendartype = formData.calendartype;
  if (formData.theme !== undefined) updateData.theme = formData.theme;
  if (formData.timezone !== undefined) updateData.timezone = formData.timezone;
  if (formData.description !== undefined) updateData.description = formData.description;
  if (formData.descriptionformat !== undefined) updateData.descriptionformat = formData.descriptionformat;
  if (formData.mailformat !== undefined) updateData.mailformat = formData.mailformat;
  if (formData.maildigest !== undefined) updateData.maildigest = formData.maildigest;
  if (formData.maildisplay !== undefined) updateData.maildisplay = formData.maildisplay;

  return updateData;
}

/**
 * Extracts a user-friendly error message from an error object
 *
 * @param error - The error to extract message from
 * @param defaultMessage - Default message if extraction fails
 * @returns User-friendly error message
 */
function getErrorMessage(error: unknown, defaultMessage: string): string {
  if (error instanceof Error) {
    return error.message || defaultMessage;
  }
  if (typeof error === 'string') {
    return error;
  }
  return defaultMessage;
}

// ============================================================================
// Main Hook Implementation
// ============================================================================

/**
 * Custom React hook providing mutation operations for user management
 *
 * Provides a comprehensive set of mutations for user administration:
 * - Create new users
 * - Update existing users
 * - Delete users (soft delete)
 * - Suspend/unsuspend user accounts
 * - Unlock locked accounts
 * - Confirm unconfirmed users
 * - Resend confirmation emails
 *
 * Each mutation includes:
 * - Automatic cache invalidation on success
 * - Toast notifications for success and error states
 * - TypeScript type safety for parameters and responses
 * - Loading and error states through React Query
 *
 * @returns {UseUserMutationsReturn} Object containing all user mutation hooks
 *
 * @example
 * ```tsx
 * function UserManagementPage() {
 *   const {
 *     createUser,
 *     updateUser,
 *     deleteUser,
 *     suspendUser,
 *   } = useUserMutations();
 *
 *   const handleCreateUser = async (formData: UserFormData) => {
 *     try {
 *       await createUser.mutateAsync({ data: formData });
 *       // User created successfully, cache invalidated automatically
 *     } catch (error) {
 *       // Error handled by mutation's onError callback
 *     }
 *   };
 *
 *   const handleSuspend = (userId: number) => {
 *     suspendUser.mutate({ userId, userName: 'John Doe' });
 *   };
 *
 *   return (
 *     <div>
 *       {createUser.isPending && <LoadingSpinner />}
 *       <UserForm onSubmit={handleCreateUser} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useUserMutations(): UseUserMutationsReturn {
  const queryClient = useQueryClient();
  const toast = useToast();

  // ---------------------------------------------------------------------------
  // Create User Mutation
  // ---------------------------------------------------------------------------

  /**
   * Mutation for creating a new user account
   *
   * Calls POST /api/v1/admin/users endpoint.
   * On success, invalidates user list queries to refresh the UI.
   */
  const createUserMutation = useMutation<User, Error, CreateUserParams>({
    mutationFn: async ({ data }: CreateUserParams): Promise<User> => {
      const createData = mapFormDataToCreateData(data);
      return createUser(createData);
    },
    onSuccess: (newUser) => {
      // Invalidate user list queries to include new user
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.users });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.adminUsers });

      // Show success notification
      toast.success(
        `User "${newUser.firstname} ${newUser.lastname}" created successfully.`
      );
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Failed to create user. Please try again.');
      toast.error(message);
    },
  });

  // ---------------------------------------------------------------------------
  // Update User Mutation
  // ---------------------------------------------------------------------------

  /**
   * Mutation for updating an existing user account
   *
   * Calls PUT /api/v1/admin/users/{id} endpoint.
   * On success, invalidates both the user list and specific user queries.
   */
  const updateUserMutation = useMutation<User, Error, UpdateUserParams, UpdateUserContext>({
    mutationFn: async ({ userId, data }: UpdateUserParams): Promise<User> => {
      const updateData = mapFormDataToUpdateData(userId, data);
      return updateUser(updateData);
    },
    onMutate: async ({ userId, data }): Promise<UpdateUserContext> => {
      // Cancel any outgoing refetches to prevent them from overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: USER_QUERY_KEYS.adminUser(userId) });

      // Snapshot the previous value
      const previousUser = queryClient.getQueryData<User>(USER_QUERY_KEYS.adminUser(userId));

      // Optimistically update the cache with new data
      // Only update properties that exist on the User type
      if (previousUser) {
        const optimisticUser: User = {
          ...previousUser,
          // Map form fields to user properties (only include fields that are present)
          ...(data.firstname !== undefined && { firstname: data.firstname }),
          ...(data.lastname !== undefined && { lastname: data.lastname }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.username !== undefined && { username: data.username }),
          ...(data.city !== undefined && { city: data.city }),
          ...(data.country !== undefined && { country: data.country }),
          ...(data.phone1 !== undefined && { phone1: data.phone1 }),
          ...(data.phone2 !== undefined && { phone2: data.phone2 }),
          ...(data.institution !== undefined && { institution: data.institution }),
          ...(data.department !== undefined && { department: data.department }),
          ...(data.address !== undefined && { address: data.address }),
          ...(data.lang !== undefined && { lang: data.lang }),
          ...(data.timezone !== undefined && { timezone: data.timezone }),
          ...(data.theme !== undefined && { theme: data.theme }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.descriptionformat !== undefined && { descriptionformat: data.descriptionformat }),
          ...(data.mailformat !== undefined && { mailformat: data.mailformat }),
          ...(data.maildigest !== undefined && { maildigest: data.maildigest }),
          ...(data.maildisplay !== undefined && { maildisplay: data.maildisplay }),
        };
        queryClient.setQueryData<User>(USER_QUERY_KEYS.adminUser(userId), optimisticUser);
      }

      // Return context with previous value for rollback
      return { previousUser };
    },
    onSuccess: (updatedUser) => {
      // Invalidate user list queries to reflect updates
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.users });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.adminUsers });

      // Update the specific user cache with server response
      queryClient.setQueryData<User>(USER_QUERY_KEYS.adminUser(updatedUser.id), updatedUser);

      // Show success notification
      toast.success(
        `User "${updatedUser.firstname} ${updatedUser.lastname}" updated successfully.`
      );
    },
    onError: (error, { userId }, context) => {
      // Rollback optimistic update on error
      if (context?.previousUser) {
        queryClient.setQueryData<User>(USER_QUERY_KEYS.adminUser(userId), context.previousUser);
      }

      const message = getErrorMessage(error, 'Failed to update user. Please try again.');
      toast.error(message);
    },
  });

  // ---------------------------------------------------------------------------
  // Delete User Mutation
  // ---------------------------------------------------------------------------

  /**
   * Mutation for deleting (soft delete) a user account
   *
   * Calls DELETE /api/v1/admin/users/{id} endpoint.
   * Moodle uses soft deletes - user record is marked deleted but not removed.
   */
  const deleteUserMutation = useMutation<{ deleted: boolean; userId: number }, Error, SingleUserParams, DeleteUserContext>({
    mutationFn: async ({ userId }: SingleUserParams): Promise<{ deleted: boolean; userId: number }> => {
      return deleteUser(userId);
    },
    onMutate: async ({ userId }): Promise<DeleteUserContext> => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: USER_QUERY_KEYS.adminUsers });

      // Snapshot the previous list for potential rollback
      const previousUsers = queryClient.getQueryData(USER_QUERY_KEYS.adminUsers);

      // Return context with snapshot
      return { previousUsers, userId };
    },
    onSuccess: (result, { userName }) => {
      // Invalidate user list queries to remove deleted user
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.users });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.adminUsers });

      // Remove the specific user from cache
      queryClient.removeQueries({ queryKey: USER_QUERY_KEYS.adminUser(result.userId) });

      // Show success notification
      const displayName = userName || `User #${result.userId}`;
      toast.success(`${displayName} has been deleted successfully.`);
    },
    onError: (error, { userName, userId }, context) => {
      // Rollback if we have previous data
      if (context?.previousUsers) {
        queryClient.setQueryData(USER_QUERY_KEYS.adminUsers, context.previousUsers);
      }

      const displayName = userName || `User #${userId}`;
      const message = getErrorMessage(error, `Failed to delete ${displayName}. Please try again.`);
      toast.error(message);
    },
  });

  // ---------------------------------------------------------------------------
  // Suspend User Mutation
  // ---------------------------------------------------------------------------

  /**
   * Mutation for suspending a user account
   *
   * Calls POST /api/v1/admin/users/bulk with action='suspend'.
   * Suspended users are immediately logged out and cannot log in.
   */
  const suspendUserMutation = useMutation<UserStatusResult, Error, SingleUserParams, SingleUserContext>({
    mutationFn: async ({ userId }: SingleUserParams): Promise<UserStatusResult> => {
      return suspendUser(userId);
    },
    onMutate: async ({ userId }): Promise<SingleUserContext> => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: USER_QUERY_KEYS.adminUser(userId) });

      // Snapshot previous value
      const previousUser = queryClient.getQueryData<User>(USER_QUERY_KEYS.adminUser(userId));

      // Optimistically update the suspended status
      if (previousUser) {
        queryClient.setQueryData<User>(USER_QUERY_KEYS.adminUser(userId), {
          ...previousUser,
          suspended: true,
        });
      }

      return { previousUser };
    },
    onSuccess: (result, { userName }) => {
      // Invalidate queries to refresh user lists
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.users });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.adminUsers });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.adminUser(result.userId) });

      const displayName = userName || `User #${result.userId}`;
      toast.success(`${displayName} has been suspended.`);
    },
    onError: (error, { userId, userName }, context) => {
      // Rollback optimistic update
      if (context?.previousUser) {
        queryClient.setQueryData<User>(USER_QUERY_KEYS.adminUser(userId), context.previousUser);
      }

      const displayName = userName || `User #${userId}`;
      const message = getErrorMessage(error, `Failed to suspend ${displayName}. Please try again.`);
      toast.error(message);
    },
  });

  // ---------------------------------------------------------------------------
  // Unsuspend User Mutation
  // ---------------------------------------------------------------------------

  /**
   * Mutation for unsuspending (reactivating) a user account
   *
   * Calls POST /api/v1/admin/users/bulk with action='unsuspend'.
   * Allows the user to log in again after being suspended.
   */
  const unsuspendUserMutation = useMutation<UserStatusResult, Error, SingleUserParams, SingleUserContext>({
    mutationFn: async ({ userId }: SingleUserParams): Promise<UserStatusResult> => {
      return unsuspendUser(userId);
    },
    onMutate: async ({ userId }): Promise<SingleUserContext> => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: USER_QUERY_KEYS.adminUser(userId) });

      // Snapshot previous value
      const previousUser = queryClient.getQueryData<User>(USER_QUERY_KEYS.adminUser(userId));

      // Optimistically update the suspended status
      if (previousUser) {
        queryClient.setQueryData<User>(USER_QUERY_KEYS.adminUser(userId), {
          ...previousUser,
          suspended: false,
        });
      }

      return { previousUser };
    },
    onSuccess: (result, { userName }) => {
      // Invalidate queries to refresh user lists
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.users });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.adminUsers });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.adminUser(result.userId) });

      const displayName = userName || `User #${result.userId}`;
      toast.success(`${displayName} has been reactivated.`);
    },
    onError: (error, { userId, userName }, context) => {
      // Rollback optimistic update
      if (context?.previousUser) {
        queryClient.setQueryData<User>(USER_QUERY_KEYS.adminUser(userId), context.previousUser);
      }

      const displayName = userName || `User #${userId}`;
      const message = getErrorMessage(error, `Failed to unsuspend ${displayName}. Please try again.`);
      toast.error(message);
    },
  });

  // ---------------------------------------------------------------------------
  // Unlock User Mutation
  // ---------------------------------------------------------------------------

  /**
   * Mutation for unlocking a locked user account
   *
   * Calls POST /api/v1/admin/users/bulk with action='unlock'.
   * Resets failed login count for accounts locked due to too many failed attempts.
   */
  const unlockUserMutation = useMutation<UserStatusResult, Error, SingleUserParams>({
    mutationFn: async ({ userId }: SingleUserParams): Promise<UserStatusResult> => {
      return unlockUser(userId);
    },
    onSuccess: (result, { userName }) => {
      // Invalidate queries to refresh user data
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.users });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.adminUsers });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.adminUser(result.userId) });

      const displayName = userName || `User #${result.userId}`;
      toast.success(`${displayName}'s account has been unlocked.`);
    },
    onError: (error, { userId, userName }) => {
      const displayName = userName || `User #${userId}`;
      const message = getErrorMessage(error, `Failed to unlock ${displayName}'s account. Please try again.`);
      toast.error(message);
    },
  });

  // ---------------------------------------------------------------------------
  // Confirm User Mutation
  // ---------------------------------------------------------------------------

  /**
   * Mutation for confirming an unconfirmed user account
   *
   * Calls POST /api/v1/admin/users/bulk with action='confirm'.
   * Manually confirms a user that hasn't completed email verification.
   */
  const confirmUserMutation = useMutation<UserStatusResult, Error, SingleUserParams, SingleUserContext>({
    mutationFn: async ({ userId }: SingleUserParams): Promise<UserStatusResult> => {
      return confirmUser(userId);
    },
    onMutate: async ({ userId }): Promise<SingleUserContext> => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: USER_QUERY_KEYS.adminUser(userId) });

      // Snapshot previous value
      const previousUser = queryClient.getQueryData<User>(USER_QUERY_KEYS.adminUser(userId));

      // Optimistically update the confirmed status
      if (previousUser) {
        queryClient.setQueryData<User>(USER_QUERY_KEYS.adminUser(userId), {
          ...previousUser,
          confirmed: true,
        });
      }

      return { previousUser };
    },
    onSuccess: (result, { userName }) => {
      // Invalidate queries to refresh user lists
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.users });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.adminUsers });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.adminUser(result.userId) });

      const displayName = userName || `User #${result.userId}`;
      toast.success(`${displayName}'s account has been confirmed.`);
    },
    onError: (error, { userId, userName }, context) => {
      // Rollback optimistic update
      if (context?.previousUser) {
        queryClient.setQueryData<User>(USER_QUERY_KEYS.adminUser(userId), context.previousUser);
      }

      const displayName = userName || `User #${userId}`;
      const message = getErrorMessage(error, `Failed to confirm ${displayName}'s account. Please try again.`);
      toast.error(message);
    },
  });

  // ---------------------------------------------------------------------------
  // Resend Confirmation Email Mutation
  // ---------------------------------------------------------------------------

  /**
   * Mutation for resending confirmation email to an unconfirmed user
   *
   * Calls POST /api/v1/admin/users/bulk with action='resendemail'.
   * Sends a new confirmation email to users who haven't verified their account.
   */
  const resendConfirmationEmailMutation = useMutation<ResendEmailResult, Error, SingleUserParams>({
    mutationFn: async ({ userId }: SingleUserParams): Promise<ResendEmailResult> => {
      return resendConfirmationEmail(userId);
    },
    onSuccess: (result, { userName }) => {
      const displayName = userName || `User #${result.userId}`;

      if (result.sent) {
        toast.success(`Confirmation email sent to ${displayName}.`);
      } else {
        // Email not sent but no error - show warning
        toast.warning(result.message || `Could not send confirmation email to ${displayName}.`);
      }
    },
    onError: (error, { userId, userName }) => {
      const displayName = userName || `User #${userId}`;
      const message = getErrorMessage(
        error,
        `Failed to send confirmation email to ${displayName}. Please try again.`
      );
      toast.error(message);
    },
  });

  // ---------------------------------------------------------------------------
  // Return All Mutations
  // ---------------------------------------------------------------------------

  return {
    createUser: createUserMutation,
    updateUser: updateUserMutation,
    deleteUser: deleteUserMutation,
    suspendUser: suspendUserMutation,
    unsuspendUser: unsuspendUserMutation,
    unlockUser: unlockUserMutation,
    confirmUser: confirmUserMutation,
    resendConfirmationEmail: resendConfirmationEmailMutation,
  };
}
