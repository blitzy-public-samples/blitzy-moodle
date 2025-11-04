/**
 * Profile API Client
 * 
 * API client for profile-related operations including fetching user profiles,
 * updating profile information, and managing avatar uploads.
 * All API calls delegate to existing Moodle PHP backend functions.
 * 
 * @module features/profile/api
 */

import type {
  User,
  UpdateProfilePayload,
  ProfileUpdateResponse,
  AvatarUploadResponse,
  UserPreferences,
} from '../types/profile.types';

/**
 * API response type definitions
 * These interfaces define the structure of raw API responses
 */
interface APIErrorResponse {
  message?: string;
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
  code?: string;
  details?: Record<string, unknown>;
}

interface APIDataResponse<T> {
  data?: T;
  user?: User;
  preferences?: UserPreferences;
  profileimageurl?: string;
  profileimageurlsmall?: string;
  message?: string;
  valid?: boolean;
}

/**
 * Base API configuration
 * In a real implementation, these would come from environment config
 */
const API_BASE_URL = '/api/v1';

/**
 * Fetch user profile by ID
 * 
 * @param userId - The ID of the user whose profile to fetch
 * @returns Promise resolving to User object
 * @throws Error if API request fails or user not found
 */
export async function fetchUserProfile(userId: number): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // JWT token would be added by interceptor in real implementation
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch profile' })) as APIErrorResponse;
    throw new Error(error.message ?? `HTTP ${response.status}: Failed to fetch user profile`);
  }

  const data = await response.json() as APIDataResponse<User>;
  return (data.data ?? data) as User;
}

/**
 * Fetch current authenticated user's profile
 * 
 * @returns Promise resolving to current User object
 * @throws Error if not authenticated or API request fails
 */
export async function fetchCurrentUserProfile(): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Not authenticated' })) as APIErrorResponse;
    throw new Error(error.message ?? 'Failed to fetch current user profile');
  }

  const data = await response.json() as APIDataResponse<User>;
  return (data.data ?? data) as User;
}

/**
 * Update user profile information
 * 
 * Calls Moodle's user_update_user() function via API endpoint.
 * Validates and sanitizes input on the backend.
 * 
 * @param payload - Profile update data
 * @returns Promise resolving to updated profile and status
 * @throws Error if validation fails or update not permitted
 */
export async function updateUserProfile(
  payload: UpdateProfilePayload
): Promise<ProfileUpdateResponse> {
  const response = await fetch(`${API_BASE_URL}/users/${payload.userid}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = await response.json() as APIDataResponse<User> & APIErrorResponse;

  if (!response.ok) {
    return {
      success: false,
      error: {
        code: data.error?.code ?? data.code ?? 'UPDATE_FAILED',
        message: data.error?.message ?? data.message ?? 'Update failed',
        details: data.error?.details ?? data.details,
      },
    };
  }

  return {
    success: true,
    data: (data.data ?? data.user) as User,
  };
}

/**
 * Upload user avatar/profile picture
 * 
 * Handles file upload with validation on both client and server.
 * Calls Moodle's file upload and user picture update functions.
 * 
 * @param userId - User ID whose avatar to update
 * @param file - Image file to upload
 * @returns Promise resolving to new avatar URLs
 * @throws Error if file validation fails or upload not permitted
 */
export async function uploadAvatar(
  userId: number,
  file: File
): Promise<AvatarUploadResponse> {
  // Client-side validation
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  if (file.size > maxSize) {
    return {
      success: false,
      profileimageurl: '',
      profileimageurlsmall: '',
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds 5MB limit',
        details: { fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB` },
      },
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      success: false,
      profileimageurl: '',
      profileimageurlsmall: '',
      error: {
        code: 'INVALID_FILE_TYPE',
        message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed',
        details: { receivedType: file.type },
      },
    };
  }

  // Prepare multipart form data
  const formData = new FormData();
  formData.append('avatar', file);
  formData.append('userid', userId.toString());

  const response = await fetch(`${API_BASE_URL}/users/${userId}/avatar`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
    // Don't set Content-Type header - browser will set it with boundary
  });

  const data = await response.json() as APIDataResponse<{ profileimageurl: string; profileimageurlsmall: string }> & APIErrorResponse;

  if (!response.ok) {
    return {
      success: false,
      profileimageurl: '',
      profileimageurlsmall: '',
      error: {
        code: data.code ?? 'UPLOAD_FAILED',
        message: data.message ?? 'Failed to upload avatar',
        details: data.details,
      },
    };
  }

  return {
    success: true,
    profileimageurl: data.profileimageurl ?? data.data?.profileimageurl ?? '',
    profileimageurlsmall: data.profileimageurlsmall ?? data.data?.profileimageurlsmall ?? '',
  };
}

/**
 * Delete user avatar (revert to default)
 * 
 * @param userId - User ID whose avatar to delete
 * @returns Promise resolving to success status
 * @throws Error if deletion not permitted
 */
export async function deleteAvatar(userId: number): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/avatar`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to delete avatar' })) as APIErrorResponse;
    throw new Error(error.message ?? 'Failed to delete avatar');
  }

  const data = await response.json() as APIDataResponse<never>;
  return {
    success: true,
    message: data.message ?? 'Avatar deleted successfully',
  };
}

/**
 * Update user preferences
 * 
 * @param userId - User ID whose preferences to update
 * @param preferences - Preferences to update (partial)
 * @returns Promise resolving to updated preferences
 * @throws Error if update fails
 */
export async function updateUserPreferences(
  userId: number,
  preferences: Partial<UserPreferences>
): Promise<UserPreferences> {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(preferences),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to update preferences' })) as APIErrorResponse;
    throw new Error(error.message ?? 'Failed to update preferences');
  }

  const data = await response.json() as APIDataResponse<UserPreferences>;
  return data.data ?? data.preferences ?? preferences;
}

/**
 * Fetch user preferences
 * 
 * @param userId - User ID whose preferences to fetch
 * @returns Promise resolving to user preferences
 * @throws Error if fetch fails
 */
export async function fetchUserPreferences(userId: number): Promise<UserPreferences> {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/preferences`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch preferences' })) as APIErrorResponse;
    throw new Error(error.message ?? 'Failed to fetch preferences');
  }

  const data = await response.json() as APIDataResponse<UserPreferences>;
  return data.data ?? data.preferences ?? {} as UserPreferences;
}

/**
 * Validate profile field value
 * 
 * Performs server-side validation for a specific field before form submission
 * Useful for real-time validation feedback
 * 
 * @param field - Field name to validate
 * @param value - Field value to validate
 * @returns Promise resolving to validation result
 */
export async function validateProfileField(
  field: string,
  value: unknown
): Promise<{ valid: boolean; message?: string }> {
  const response = await fetch(`${API_BASE_URL}/users/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ field, value }),
  });

  if (!response.ok) {
    return {
      valid: false,
      message: 'Validation service unavailable',
    };
  }

  const data = await response.json() as APIDataResponse<never>;
  return {
    valid: data.valid !== false,
    message: data.message,
  };
}
