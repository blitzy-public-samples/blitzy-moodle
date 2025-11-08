/**
 * useUpdateProfile Hook
 *
 * React Query mutation hook for updating user profile information.
 * Provides optimistic updates, automatic cache invalidation, and error handling.
 *
 * @module features/profile/hooks
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import {
  updateUserProfile,
  uploadAvatar,
  deleteAvatar,
  updateUserPreferences,
} from '../api/profileApi';
import type {
  UpdateProfilePayload,
  UpdateProfileData,
  ProfileUpdateResponse,
  AvatarUploadResponse,
  UserPreferences,
  User,
} from '../types/profile.types';
import { profileKeys } from './useProfile';

/**
 * Convert UpdateProfilePayload (internal format with booleans and enums)
 * to UpdateProfileData (API format with numeric literals)
 */
function convertPayloadToApiFormat(payload: Omit<UpdateProfilePayload, 'userid'>): UpdateProfileData {
  const apiData: UpdateProfileData = {};

  // Copy all string/number fields directly
  if (payload.firstname !== undefined) {apiData.firstname = payload.firstname;}
  if (payload.lastname !== undefined) {apiData.lastname = payload.lastname;}
  if (payload.email !== undefined) {apiData.email = payload.email;}
  if (payload.description !== undefined) {apiData.description = payload.description;}
  if (payload.city !== undefined) {apiData.city = payload.city;}
  if (payload.country !== undefined) {apiData.country = payload.country;}
  if (payload.timezone !== undefined) {apiData.timezone = payload.timezone;}
  if (payload.phone1 !== undefined) {apiData.phone1 = payload.phone1;}
  if (payload.phone2 !== undefined) {apiData.phone2 = payload.phone2;}
  if (payload.institution !== undefined) {apiData.institution = payload.institution;}
  if (payload.department !== undefined) {apiData.department = payload.department;}
  if (payload.address !== undefined) {apiData.address = payload.address;}
  if (payload.lang !== undefined) {apiData.lang = payload.lang;}
  if (payload.calendartype !== undefined) {apiData.calendartype = payload.calendartype;}
  if (payload.theme !== undefined) {apiData.theme = payload.theme;}

  // Convert boolean to 0 | 1 for API
  if (payload.autosubscribe !== undefined) {
    apiData.autosubscribe = payload.autosubscribe ? 1 : 0;
  }
  if (payload.trackforums !== undefined) {
    apiData.trackforums = payload.trackforums ? 1 : 0;
  }

  // mailformat is already MailFormat enum (0 or 1), can be used directly
  if (payload.mailformat !== undefined) {
    apiData.mailformat = payload.mailformat as 0 | 1;
  }

  return apiData;
}

/**
 * Options for profile update mutations
 */
export interface UseUpdateProfileOptions<TData = ProfileUpdateResponse> {
  /**
   * Callback on successful update
   */
  onSuccess?: (data: TData) => void;

  /**
   * Callback on error
   */
  onError?: (error: Error) => void;

  /**
   * Whether to show success notification
   * @default true
   */
  showSuccessNotification?: boolean;

  /**
   * Whether to show error notification
   * @default true
   */
  showErrorNotification?: boolean;

  /**
   * Whether to use optimistic updates
   * @default true
   */
  optimisticUpdate?: boolean;
}

/**
 * Hook for updating user profile information
 *
 * Uses React Query mutations to handle profile updates with automatic
 * cache invalidation and optimistic UI updates for better UX.
 * Delegates to existing Moodle user_update_user() function via API.
 *
 * @param options - Mutation options
 * @returns Mutation result with mutate function and status
 *
 * @example
 * ```tsx
 * function ProfileEditForm() {
 *   const { mutate: updateProfile, isPending } = useUpdateProfile({
 *     onSuccess: () => toast.success('Profile updated!'),
 *     onError: (error) => toast.error(error.message),
 *   });
 *
 *   const handleSubmit = (data: UpdateProfilePayload) => {
 *     updateProfile(data);
 *   };
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useUpdateProfile(
  options: UseUpdateProfileOptions<User> = {}
): UseMutationResult<
  User,
  Error,
  UpdateProfilePayload,
  { previousProfile?: User; queryKey: readonly unknown[] } | undefined
> {
  const queryClient = useQueryClient();
  const { onSuccess, onError, optimisticUpdate = true } = options;

  return useMutation<
    User,
    Error,
    UpdateProfilePayload,
    { previousProfile?: User; queryKey: readonly unknown[] } | undefined
  >({
    mutationFn: async (payload: UpdateProfilePayload) => {
      // Extract userid and convert payload to API format
      const { userid, ...internalData } = payload;
      const apiData = convertPayloadToApiFormat(internalData);
      const result = await updateUserProfile(userid, apiData);
      return result;
    },

    // Optimistic update - immediately update cache before API call
    onMutate: async (updatedProfile) => {
      if (!optimisticUpdate) {
        return undefined;
      }

      const userId = updatedProfile.userid;
      const queryKey = profileKeys.detail(userId);

      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousProfile = queryClient.getQueryData<User>(queryKey);

      // Optimistically update cache
      if (previousProfile) {
        // Exclude customfields from the optimistic update to avoid type mismatch
        const { customfields: _customfields, ...profileUpdates } = updatedProfile;

        queryClient.setQueryData<User>(queryKey, {
          ...previousProfile,
          ...profileUpdates,
          fullname:
            updatedProfile.firstname && updatedProfile.lastname
              ? `${updatedProfile.firstname} ${updatedProfile.lastname}`
              : previousProfile.fullname,
        });
      }

      // Return context with previous value for rollback
      return { previousProfile, queryKey };
    },

    // On error, rollback to previous value
    onError: (error, _variables, context) => {
      if (context?.previousProfile && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousProfile);
      }
      onError?.(error);
    },

    // On success, invalidate and refetch to get server truth
    onSuccess: (data, variables) => {
      const userId = variables.userid;

      // Invalidate profile cache to trigger refetch
      void queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) });

      // Also invalidate current user cache if updating own profile
      void queryClient.invalidateQueries({ queryKey: profileKeys.current() });

      onSuccess?.(data);
    },
  });
}

/**
 * Hook for uploading user avatar
 *
 * Handles avatar file upload with validation and progress tracking.
 * Calls Moodle's file upload and user picture update functions via API.
 *
 * @param userId - ID of user whose avatar to update
 * @param options - Mutation options
 * @returns Mutation result for avatar upload
 *
 * @example
 * ```tsx
 * function AvatarUpload({ userId }: { userId: number }) {
 *   const { mutate: uploadAvatar, isPending } = useUploadAvatar(userId, {
 *     onSuccess: () => toast.success('Avatar updated!'),
 *   });
 *
 *   const handleFileChange = (file: File) => {
 *     uploadAvatar(file);
 *   };
 *
 *   return <FileInput onChange={handleFileChange} disabled={isPending} />;
 * }
 * ```
 */
export function useUploadAvatar(
  userId: number,
  options: Omit<UseUpdateProfileOptions<AvatarUploadResponse>, 'optimisticUpdate'> = {}
): UseMutationResult<AvatarUploadResponse, Error, File, unknown> {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  return useMutation<AvatarUploadResponse, Error, File>({
    mutationFn: (file: File) => uploadAvatar(userId, file),

    onSuccess: (data) => {
      if (data.success) {
        // Update profile cache with new avatar URLs
        const queryKey = profileKeys.detail(userId);
        const previousProfile = queryClient.getQueryData<User>(queryKey);

        if (previousProfile) {
          queryClient.setQueryData<User>(queryKey, {
            ...previousProfile,
            profileimageurl: data.profileimageurl,
            profileimageurlsmall: data.profileimageurlsmall,
          });
        }

        // Invalidate to ensure fresh data
        void queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) });
        void queryClient.invalidateQueries({ queryKey: profileKeys.current() });
      }

      onSuccess?.(data);
    },

    onError,
  });
}

/**
 * Hook for deleting user avatar
 *
 * Reverts user avatar to default system avatar.
 *
 * @param userId - ID of user whose avatar to delete
 * @param options - Mutation options
 * @returns Mutation result for avatar deletion
 *
 * @example
 * ```tsx
 * function AvatarActions({ userId }: { userId: number }) {
 *   const { mutate: deleteAvatar } = useDeleteAvatar(userId);
 *
 *   return (
 *     <Button onClick={() => deleteAvatar()}>
 *       Remove Avatar
 *     </Button>
 *   );
 * }
 * ```
 */
export function useDeleteAvatar(
  userId: number,
  options: Omit<
    UseUpdateProfileOptions<void>,
    'optimisticUpdate'
  > = {}
): UseMutationResult<void, Error, void, unknown> {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  return useMutation<void, Error, void>({
    mutationFn: () => deleteAvatar(userId),

    onSuccess: (data) => {
      // Invalidate profile cache to refetch with default avatar
      void queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.current() });

      onSuccess?.(data);
    },

    onError,
  });
}

/**
 * Hook for updating user preferences
 *
 * Updates user preferences such as theme, notifications, accessibility settings, etc.
 * Calls Moodle's set_user_preference() function via API.
 *
 * @param userId - ID of user whose preferences to update
 * @param options - Mutation options
 * @returns Mutation result for preference updates
 *
 * @example
 * ```tsx
 * function PreferencesForm({ userId }: { userId: number }) {
 *   const { mutate: updatePreferences } = useUpdatePreferences(userId);
 *
 *   const handleThemeChange = (theme: string) => {
 *     updatePreferences({ theme });
 *   };
 *
 *   return <ThemeSelector onChange={handleThemeChange} />;
 * }
 * ```
 */
export function useUpdatePreferences(
  userId: number,
  options: UseUpdateProfileOptions<UserPreferences> = {}
): UseMutationResult<
  UserPreferences,
  Error,
  Partial<UserPreferences>,
  { previousProfile?: User; queryKey: readonly unknown[] } | undefined
> {
  const queryClient = useQueryClient();
  const { onSuccess, onError, optimisticUpdate = true } = options;

  return useMutation<
    UserPreferences,
    Error,
    Partial<UserPreferences>,
    { previousProfile?: User; queryKey: readonly unknown[] } | undefined
  >({
    mutationFn: (preferences) => updateUserPreferences(userId, preferences),

    onMutate: async (updatedPreferences) => {
      if (!optimisticUpdate) {
        return undefined;
      }

      const queryKey = profileKeys.detail(userId);
      await queryClient.cancelQueries({ queryKey });

      const previousProfile = queryClient.getQueryData<User>(queryKey);

      if (previousProfile?.preferences) {
        queryClient.setQueryData<User>(queryKey, {
          ...previousProfile,
          preferences: {
            ...previousProfile.preferences,
            ...updatedPreferences,
          },
        });
      }

      return { previousProfile, queryKey };
    },

    onError: (error, _variables, context) => {
      if (context?.previousProfile && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousProfile);
      }
      onError?.(error);
    },

    onSuccess: (data, _variables) => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.current() });

      onSuccess?.(data);
    },
  });
}

/**
 * Helper type for batch profile updates
 * Useful when updating multiple aspects of profile at once
 */
export interface BatchProfileUpdate {
  profile?: UpdateProfilePayload;
  avatar?: File;
  preferences?: Partial<UserPreferences>;
}

/**
 * Hook for batch updating profile (profile + avatar + preferences)
 *
 * Efficiently handles updating multiple profile aspects in sequence
 * with proper error handling and rollback.
 *
 * @param userId - ID of user to update
 * @param options - Mutation options
 * @returns Mutation result for batch update
 */
export function useBatchUpdateProfile(
  userId: number,
  options: UseUpdateProfileOptions<{
    profile?: User;
    avatar?: AvatarUploadResponse;
    preferences?: UserPreferences;
  }> = {}
): UseMutationResult<
  {
    profile?: User;
    avatar?: AvatarUploadResponse;
    preferences?: UserPreferences;
  },
  Error,
  BatchProfileUpdate,
  unknown
> {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  return useMutation({
    mutationFn: async (updates: BatchProfileUpdate) => {
      const results: {
        profile?: User;
        avatar?: AvatarUploadResponse;
        preferences?: UserPreferences;
      } = {};

      // Execute updates in sequence
      if (updates.profile) {
        const { userid, ...internalData } = updates.profile;
        const apiData = convertPayloadToApiFormat(internalData);
        results.profile = await updateUserProfile(userid, apiData);
      }

      if (updates.avatar) {
        results.avatar = await uploadAvatar(userId, updates.avatar);
      }

      if (updates.preferences) {
        results.preferences = await updateUserPreferences(userId, updates.preferences);
      }

      return results;
    },

    onSuccess: (data) => {
      // Invalidate all profile-related queries
      void queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.current() });

      onSuccess?.(data);
    },

    onError,
  });
}
