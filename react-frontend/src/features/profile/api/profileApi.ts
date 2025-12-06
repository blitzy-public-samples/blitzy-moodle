/**
 * Profile API Client Module
 *
 * TypeScript API client providing functions for all profile-related operations including
 * fetching user profiles, updating profile information, uploading profile avatars, and
 * managing user preferences. Wraps RESTful API calls to /api/v1/users/* endpoints using
 * the pre-configured axios HTTP client.
 *
 * This module implements standard request/response handling with proper error management
 * and type safety. All functions call backend endpoints that wrap existing Moodle user
 * management functions like user_get_user_details(), user_update_user(),
 * core_user::update_picture(), and useredit_update_user_preference(), maintaining
 * 100% backward compatibility with existing PHP business logic.
 *
 * Architecture Notes:
 * - Uses shared apiClient from services/api/client with JWT token interceptors
 * - All API responses follow standard envelope pattern: { success: true, data: T, meta?: {...} }
 * - Error responses follow: { success: false, error: { code, message, details? } }
 * - Functions are designed to be used by React Query hooks in the hooks directory
 *
 * Backend API Endpoint Mapping:
 * - GET /api/v1/users/{id} -> wraps user_get_user_details() from public/user/lib.php
 * - PUT /api/v1/users/{id} -> wraps user_update_user() from public/user/lib.php
 * - POST /api/v1/users/{id}/avatar -> wraps core_user::update_picture() from public/user/lib.php
 * - GET /api/v1/users/{id}/preferences -> wraps get_user_preferences() from public/user/externallib.php
 * - PUT /api/v1/users/{id}/preferences -> wraps useredit_update_user_preference()
 * - PUT /api/v1/users/{id}/preferences/bulk -> wraps update_user_preferences() from externallib.php
 * - GET /api/v1/auth/me -> returns current authenticated user from JWT token
 *
 * @see public/user/profile.php - Profile view implementation
 * @see public/user/edit.php - Profile edit implementation
 * @see public/user/preferences.php - Preference management
 * @see public/user/externallib.php - Web service functions
 * @see public/user/lib.php - User library functions
 *
 * @module features/profile/api
 */

import type { AxiosResponse } from 'axios';
import apiClient, { extractData } from '@/services/api/client';
import type { ApiResponse } from '@/types/api';
import type { User } from '@/types/entities';
import type {
  UserPreferences,
  UpdateProfilePayload,
  UpdateProfileData,
  AvatarUploadResponse,
  UserPreference,
} from '../types/profile.types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Profile update request payload interface
 *
 * Defines the shape of data sent to PUT /api/v1/users/{id}
 * Excludes userid which is passed as URL parameter
 */
export interface ProfileUpdateRequest extends UpdateProfileData {
  // Extends UpdateProfileData which contains all updateable fields
}

/**
 * Preference update request payload interface
 *
 * Defines the shape of data sent for individual preference update
 */
export interface PreferenceUpdateRequest {
  /** Preference name/key to update */
  name: string;
  /** New value for the preference */
  value: string | number | boolean;
}

/**
 * Bulk preferences update request payload interface
 *
 * Defines the shape of data sent for bulk preference updates
 */
export interface BulkPreferencesUpdateRequest {
  /** Array of preferences to update */
  preferences: PreferenceUpdateRequest[];
}

/**
 * API Error response interface
 *
 * Standard error response structure from API
 */
export interface ApiError {
  /** Error code for programmatic handling (e.g., 'PERMISSION_DENIED', 'NOT_FOUND') */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Profile API error class
 *
 * Custom error class for profile API operations with additional context
 */
export class ProfileApiError extends Error {
  /** HTTP status code */
  public readonly status: number;
  /** API error code */
  public readonly code: string;
  /** Additional error details */
  public readonly details?: Record<string, unknown>;

  constructor(message: string, status: number, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ProfileApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ProfileApiError.prototype);
  }
}

// ============================================================================
// Retry Utilities
// ============================================================================

/**
 * Configuration for retry behavior
 */
interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay in milliseconds between retries (default: 1000) */
  initialDelayMs: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number;
  /** HTTP status codes that trigger retry (default: [500, 502, 503, 504]) */
  retryableStatusCodes: number[];
}

/**
 * Default retry configuration
 *
 * Follows industry best practices for transient error handling:
 * - 3 retries with exponential backoff
 * - 5xx errors are considered retryable
 * - Initial delay of 100ms
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 100,
  backoffMultiplier: 2,
  retryableStatusCodes: [500, 502, 503, 504],
};

/**
 * Sleep utility for implementing delays
 *
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable based on HTTP status code
 *
 * @param error - Error to check
 * @param config - Retry configuration
 * @returns True if the error is retryable
 */
function isRetryableError(error: unknown, config: RetryConfig): boolean {
  if (error instanceof ProfileApiError) {
    return config.retryableStatusCodes.includes(error.status);
  }
  return false;
}

/**
 * Execute a function with automatic retry on transient errors
 *
 * Implements exponential backoff retry pattern for handling transient
 * server errors (5xx). This improves resilience when backend services
 * experience temporary issues.
 *
 * @typeParam T - Return type of the function
 * @param fn - Async function to execute with retry logic
 * @param config - Optional partial retry configuration
 * @returns Promise resolving to the function result
 * @throws Last error encountered if all retries are exhausted
 *
 * @example
 * ```typescript
 * const profile = await withRetry(
 *   () => apiClient.get('/users/123'),
 *   { maxRetries: 5 }
 * );
 * ```
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;
  let currentDelay = finalConfig.initialDelayMs;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const isLastAttempt = attempt === finalConfig.maxRetries;
      const canRetry = isRetryableError(error, finalConfig);

      if (isLastAttempt || !canRetry) {
        throw error;
      }

      // Wait before retrying with exponential backoff
      await sleep(currentDelay);
      currentDelay *= finalConfig.backoffMultiplier;
    }
  }

  // Should never reach here, but TypeScript requires a throw
  throw lastError;
}

// ============================================================================
// Data Transformation Utilities
// ============================================================================

/**
 * Normalize user data from API response
 *
 * Transforms user data to ensure consistent data types:
 * - Converts interests from comma-separated string to array
 * - Ensures proper field types for frontend consumption
 *
 * The API may return interests as a comma-separated string (Moodle's internal format)
 * but our frontend expects an array of strings. This function handles the conversion.
 *
 * @param userData - Raw user data from API (may have string interests)
 * @returns Normalized User object with interests as array
 */
function normalizeUserData(userData: User): User {
  // Create a copy to avoid mutating the original
  const normalized = { ...userData };
  
  // Handle interests conversion from API format (string) to frontend format (array)
  // The API may return interests as a comma-separated string from Moodle
  // Cast to unknown first to handle the type mismatch between API and frontend types
  const rawInterests = normalized.interests as unknown;
  
  if (rawInterests !== undefined && rawInterests !== null) {
    if (typeof rawInterests === 'string') {
      // Convert comma-separated string to array
      normalized.interests = rawInterests
        .split(',')
        .map((interest: string) => interest.trim())
        .filter((interest: string) => interest.length > 0);
    } else if (Array.isArray(rawInterests)) {
      // Already an array, ensure it's clean
      normalized.interests = rawInterests;
    } else {
      // Unknown format, default to empty array
      normalized.interests = [];
    }
  }
  
  return normalized;
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Extract and format error from API response
 *
 * Handles different error scenarios:
 * - 400: Validation errors with field-level details
 * - 401: Unauthorized (expired token, not logged in)
 * - 403: Permission denied (lacking capability)
 * - 404: User not found
 * - 5xx: Server errors
 *
 * @param error - The caught error from axios
 * @throws ProfileApiError with formatted error information
 */
function handleApiError(error: unknown): never {
  // Handle axios errors with response (original AxiosError structure)
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as {
      response?: {
        status: number;
        data?: {
          success: false;
          error?: ApiError;
        };
      };
      message?: string;
    };

    if (axiosError.response) {
      const { status, data } = axiosError.response;
      const apiError = data?.error;

      // Extract error details from API response
      const errorMessage = apiError?.message ?? getDefaultErrorMessage(status);
      const errorCode = apiError?.code ?? getDefaultErrorCode(status);
      const errorDetails = apiError?.details;

      throw new ProfileApiError(errorMessage, status, errorCode, errorDetails);
    }
  }

  // Handle interceptor-processed errors (serializable errors with status directly on error)
  // The interceptor transforms AxiosErrors into plain Error objects with status, code, data
  // attached directly to the error object (not in .response)
  if (error && typeof error === 'object' && 'status' in error) {
    const interceptorError = error as {
      status: number;
      code?: string;
      data?: {
        success: false;
        error?: ApiError;
      };
      customError?: {
        message: string;
        code: string;
        status: number;
        details?: Record<string, unknown>;
      };
      message?: string;
    };

    const {status} = interceptorError;
    
    // First, try to extract error details from API response data
    // This preserves specific error codes from the backend (e.g., 'SERVICE_UNAVAILABLE')
    // rather than using generic interceptor codes (e.g., 'SERVER_ERROR')
    const apiError = interceptorError.data?.error;
    
    if (apiError) {
      // Use API error details if available - these are more specific
      throw new ProfileApiError(
        apiError.message ?? getDefaultErrorMessage(status),
        status,
        apiError.code ?? getDefaultErrorCode(status),
        apiError.details
      );
    }
    
    // Fall back to interceptor's customError if no API error data
    if (interceptorError.customError) {
      throw new ProfileApiError(
        interceptorError.customError.message,
        interceptorError.customError.status,
        interceptorError.customError.code,
        interceptorError.customError.details
      );
    }
    
    // Last fallback - use defaults based on status
    throw new ProfileApiError(
      getDefaultErrorMessage(status),
      status,
      getDefaultErrorCode(status)
    );
  }

  // Handle network errors (no status, just message)
  if (error && typeof error === 'object' && 'message' in error) {
    const networkError = error as { message: string };
    throw new ProfileApiError(
      networkError.message || 'Network error occurred',
      0,
      'NETWORK_ERROR'
    );
  }

  // Handle unknown errors
  throw new ProfileApiError('An unexpected error occurred', 0, 'UNKNOWN_ERROR');
}

/**
 * Get default error message based on HTTP status code
 *
 * @param status - HTTP status code
 * @returns Default error message for the status
 */
function getDefaultErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid request data';
    case 401:
      return 'Authentication required';
    case 403:
      return 'You do not have permission to perform this action';
    case 404:
      return 'User not found';
    case 422:
      return 'Validation failed';
    case 429:
      return 'Too many requests. Please try again later';
    case 500:
      return 'Internal server error';
    case 502:
      return 'Service temporarily unavailable';
    case 503:
      return 'Service unavailable';
    default:
      return `Request failed with status ${status}`;
  }
}

/**
 * Get default error code based on HTTP status code
 *
 * @param status - HTTP status code
 * @returns Default error code for the status
 */
function getDefaultErrorCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'PERMISSION_DENIED';
    case 404:
      return 'NOT_FOUND';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMITED';
    case 500:
      return 'INTERNAL_ERROR';
    default:
      return 'REQUEST_FAILED';
  }
}

// ============================================================================
// Profile API Functions
// ============================================================================

/**
 * Get user profile by ID
 *
 * Retrieves complete user profile data including id, username, firstname, lastname,
 * email, profileimageurl, description, country, city, timezone, and all other
 * profile fields.
 *
 * Backend Implementation:
 * Calls GET /api/v1/users/{id} which wraps existing user_get_user_details() PHP
 * function from public/user/lib.php (line 391). The backend performs user_can_view_profile()
 * permission check (see public/user/profile.php lines 65-76 and 81-96).
 *
 * @param userId - The unique identifier of the user whose profile to retrieve
 * @returns Promise resolving to User object with all profile fields
 *
 * @throws ProfileApiError with code 'UNAUTHORIZED' (401) - Not authenticated
 * @throws ProfileApiError with code 'PERMISSION_DENIED' (403) - Cannot view this profile
 * @throws ProfileApiError with code 'NOT_FOUND' (404) - User does not exist
 *
 * @example
 * ```typescript
 * try {
 *   const user = await getUserProfile(123);
 *   console.log(user.fullname, user.email);
 * } catch (error) {
 *   if (error instanceof ProfileApiError && error.code === 'NOT_FOUND') {
 *     console.log('User not found');
 *   }
 * }
 * ```
 */
export async function getUserProfile(userId: number): Promise<User> {
  return withRetry(async () => {
    try {
      const response: AxiosResponse<ApiResponse<User>> = await apiClient.get(`/users/${userId}`);
      const userData = extractData(response);
      return normalizeUserData(userData);
    } catch (error) {
      handleApiError(error);
    }
  });
}

/**
 * Get current authenticated user profile
 *
 * Retrieves the profile of the currently authenticated user based on the JWT token.
 * This is more efficient than getUserProfile for fetching the current user's data
 * as it reuses authentication context.
 *
 * Backend Implementation:
 * Calls GET /api/v1/auth/me which extracts user ID from JWT token and returns
 * user profile data without requiring explicit user ID parameter.
 *
 * @returns Promise resolving to User object for the authenticated user
 *
 * @throws ProfileApiError with code 'UNAUTHORIZED' (401) - Not authenticated or token expired
 *
 * @example
 * ```typescript
 * const currentUser = await getCurrentUserProfile();
 * console.log(`Welcome, ${currentUser.firstname}!`);
 * ```
 */
export async function getCurrentUserProfile(): Promise<User> {
  return withRetry(async () => {
    try {
      const response: AxiosResponse<ApiResponse<User>> = await apiClient.get('/auth/me');
      const userData = extractData(response);
      return normalizeUserData(userData);
    } catch (error) {
      handleApiError(error);
    }
  });
}

/**
 * Update user profile information
 *
 * Updates the profile information for a user. Only provided fields are updated;
 * omitted fields retain their current values. The backend validates permissions
 * using moodle/user:editownprofile (for own profile) or moodle/user:editprofile
 * (for other users' profiles) capabilities.
 *
 * Backend Implementation:
 * Calls PUT /api/v1/users/{id} which wraps existing user_update_user() PHP function
 * from public/user/editlib.php. See public/user/edit.php lines 60-62 and 104-121
 * for capability checks.
 *
 * Supports two calling patterns for flexibility:
 * 1. updateUserProfile(payload) - Payload object containing userid and fields
 * 2. updateUserProfile(userId, data) - Separate userId and data arguments
 *
 * @param payloadOrUserId - Update payload with userid OR user ID as number
 * @param data - Optional update data when first arg is userId (for 2-arg pattern)
 * @returns Promise resolving to updated User object with all profile fields
 *
 * @throws ProfileApiError with code 'UNAUTHORIZED' (401) - Not authenticated
 * @throws ProfileApiError with code 'PERMISSION_DENIED' (403) - Cannot edit this profile
 * @throws ProfileApiError with code 'NOT_FOUND' (404) - User does not exist
 * @throws ProfileApiError with code 'VALIDATION_ERROR' (422) - Invalid field values
 *
 * @example
 * ```typescript
 * // Pattern 1: Payload object
 * const updatedUser = await updateUserProfile({
 *   userid: 123,
 *   firstname: 'John',
 *   lastname: 'Doe',
 *   city: 'New York',
 *   country: 'US',
 *   description: 'Software developer'
 * });
 *
 * // Pattern 2: Separate arguments
 * const updatedUser = await updateUserProfile(123, {
 *   firstname: 'John',
 *   lastname: 'Doe',
 *   city: 'New York',
 *   country: 'US'
 * });
 * ```
 */
export async function updateUserProfile(
  payloadOrUserId: UpdateProfilePayload | number,
  data?: UpdateProfileData
): Promise<User> {
  // Support both calling patterns:
  // 1. updateUserProfile(payload) - payload object with userid
  // 2. updateUserProfile(userId, data) - separate userId and data
  let userid: number;
  let updateData: Partial<UpdateProfileData>;

  if (typeof payloadOrUserId === 'number') {
    // Pattern 2: Separate arguments (data is already converted UpdateProfileData)
    userid = payloadOrUserId;
    updateData = data ?? {};
  } else {
    // Pattern 1: Payload object - convert boolean/enum fields to numeric for API
    const { 
      userid: payloadUserId, 
      autosubscribe, 
      trackforums,
      mailformat,
      maildisplay: _maildisplay,  // Exclude from spread - handled separately if needed
      maildigest: _maildigest,    // Exclude from spread - handled separately if needed
      customfields: _customfields,  // Exclude customfields from API request body
      ...restPayload 
    } = payloadOrUserId;
    userid = payloadUserId;
    
    // Convert payload to API format (boolean -> 0|1, enums -> numbers)
    const convertedData: Partial<UpdateProfileData> = { ...restPayload };
    
    // Convert boolean fields to 0|1
    if (typeof autosubscribe === 'boolean') {
      convertedData.autosubscribe = autosubscribe ? 1 : 0;
    }
    if (typeof trackforums === 'boolean') {
      convertedData.trackforums = trackforums ? 1 : 0;
    }
    // mailformat enum is already numeric (MailFormat.PLAIN_TEXT = 0, MailFormat.HTML = 1)
    if (mailformat !== undefined) {
      convertedData.mailformat = mailformat as 0 | 1;
    }
    
    updateData = convertedData;
  }

  return withRetry(async () => {
    try {
      const response: AxiosResponse<ApiResponse<User>> = await apiClient.put(
        `/users/${userid}`,
        updateData
      );
      return extractData(response);
    } catch (error) {
      handleApiError(error);
    }
  });
}

/**
 * Upload user profile avatar/picture
 *
 * Uploads a new profile picture for a user. The image file is sent as multipart/form-data.
 * The backend validates file type (jpg, png, gif) and size restrictions, then processes
 * the image and generates appropriate thumbnail sizes.
 *
 * Backend Implementation:
 * Calls POST /api/v1/users/{id}/avatar which wraps existing core_user::update_picture()
 * PHP function from public/user/lib.php (lines 441-450). The backend handles image
 * validation, resizing, and storage.
 *
 * @param userId - The unique identifier of the user whose avatar to update
 * @param file - The image file to upload (File object from file input or drag-drop)
 * @returns Promise resolving to AvatarUploadResponse with new profileimageurl
 *
 * @throws ProfileApiError with code 'UNAUTHORIZED' (401) - Not authenticated
 * @throws ProfileApiError with code 'PERMISSION_DENIED' (403) - Cannot edit this profile
 * @throws ProfileApiError with code 'NOT_FOUND' (404) - User does not exist
 * @throws ProfileApiError with code 'VALIDATION_ERROR' (422) - Invalid file type or size
 *
 * @example
 * ```typescript
 * const fileInput = document.getElementById('avatar') as HTMLInputElement;
 * if (fileInput.files?.[0]) {
 *   const result = await uploadAvatar(123, fileInput.files[0]);
 *   console.log('New avatar URL:', result.profileimageurl);
 * }
 * ```
 */
export async function uploadAvatar(userId: number, file: File): Promise<AvatarUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return withRetry(async () => {
    try {
      const response: AxiosResponse<ApiResponse<AvatarUploadResponse>> = await apiClient.post(
        `/users/${userId}/avatar`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          // Extended timeout for file uploads
          timeout: 60000,
        }
      );
      return extractData(response);
    } catch (error) {
      handleApiError(error);
    }
  });
}

/**
 * Get all user preferences
 *
 * Retrieves all user preferences as key-value pairs including settings for email display,
 * forum auto-subscribe, editor preferences, notification settings, and other user-specific
 * configurations.
 *
 * Backend Implementation:
 * Calls GET /api/v1/users/{id}/preferences which wraps existing get_user_preferences()
 * PHP function from public/user/externallib.php (line 1618). See public/user/preferences.php
 * lines 32-60 for preference management implementation.
 *
 * @param userId - The unique identifier of the user whose preferences to retrieve
 * @returns Promise resolving to UserPreferences object with key-value pairs
 *
 * @throws ProfileApiError with code 'UNAUTHORIZED' (401) - Not authenticated
 * @throws ProfileApiError with code 'PERMISSION_DENIED' (403) - Cannot view preferences
 * @throws ProfileApiError with code 'NOT_FOUND' (404) - User does not exist
 *
 * @example
 * ```typescript
 * const prefs = await getUserPreferences(123);
 * console.log('Email format:', prefs.mailformat);
 * console.log('Auto-subscribe:', prefs.autosubscribe);
 * ```
 */
export async function getUserPreferences(userId: number): Promise<UserPreferences> {
  return withRetry(async () => {
    try {
      const response: AxiosResponse<ApiResponse<UserPreferences>> = await apiClient.get(
        `/users/${userId}/preferences`
      );
      return extractData(response);
    } catch (error) {
      handleApiError(error);
    }
  });
}

/**
 * Update a single user preference
 *
 * Updates an individual user preference by name. The backend validates the preference
 * key to ensure it's a valid preference name before updating.
 *
 * Backend Implementation:
 * Calls PUT /api/v1/users/{id}/preferences which wraps existing useredit_update_user_preference()
 * PHP function from public/user/editlib.php. The endpoint accepts a single preference
 * update in the format { name: string, value: string }.
 *
 * @param userId - The unique identifier of the user whose preference to update
 * @param name - The preference name/key (e.g., 'maildisplay', 'autosubscribe')
 * @param value - The new value for the preference
 * @returns Promise resolving to updated UserPreferences object
 *
 * @throws ProfileApiError with code 'UNAUTHORIZED' (401) - Not authenticated
 * @throws ProfileApiError with code 'PERMISSION_DENIED' (403) - Cannot edit preferences
 * @throws ProfileApiError with code 'NOT_FOUND' (404) - User does not exist
 * @throws ProfileApiError with code 'VALIDATION_ERROR' (422) - Invalid preference key
 *
 * @example
 * ```typescript
 * await updateUserPreference(123, 'maildisplay', '2');
 * await updateUserPreference(123, 'autosubscribe', '1');
 * ```
 */
export async function updateUserPreference(
  userId: number,
  name: string,
  value: string | number | boolean
): Promise<UserPreferences> {
  return withRetry(async () => {
    try {
      const response: AxiosResponse<ApiResponse<UserPreferences>> = await apiClient.put(
        `/users/${userId}/preferences`,
        { name, value: String(value) }
      );
      return extractData(response);
    } catch (error) {
      handleApiError(error);
    }
  });
}

/**
 * Update multiple user preferences in bulk
 *
 * Updates multiple user preferences in a single request. This is more efficient
 * than calling updateUserPreference multiple times when updating several preferences.
 *
 * Backend Implementation:
 * Calls PUT /api/v1/users/{id}/preferences/bulk which wraps existing update_user_preferences()
 * PHP function from public/user/externallib.php (line 396). The endpoint accepts an array
 * of preference objects with name/value pairs.
 *
 * @param userId - The unique identifier of the user whose preferences to update
 * @param preferences - Partial UserPreferences object with preferences to update
 * @returns Promise resolving to updated UserPreferences object
 *
 * @throws ProfileApiError with code 'UNAUTHORIZED' (401) - Not authenticated
 * @throws ProfileApiError with code 'PERMISSION_DENIED' (403) - Cannot edit preferences
 * @throws ProfileApiError with code 'NOT_FOUND' (404) - User does not exist
 * @throws ProfileApiError with code 'VALIDATION_ERROR' (422) - Invalid preference keys/values
 *
 * @example
 * ```typescript
 * await updateUserPreferences(123, {
 *   maildisplay: MailDisplay.COURSE_MEMBERS,
 *   mailformat: MailFormat.HTML,
 *   autosubscribe: true,
 *   lang: 'en'
 * });
 * ```
 */
export async function updateUserPreferences(
  userId: number,
  preferences: Partial<UserPreferences>
): Promise<UserPreferences> {
  // Convert preferences object to array of { name, value } for API
  const preferencesArray: UserPreference[] = Object.entries(preferences)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => ({
      name,
      value: String(value),
    }));

  return withRetry(async () => {
    try {
      const response: AxiosResponse<ApiResponse<UserPreferences>> = await apiClient.put(
        `/users/${userId}/preferences/bulk`,
        { preferences: preferencesArray }
      );
      return extractData(response);
    } catch (error) {
      handleApiError(error);
    }
  });
}

// ============================================================================
// Additional Utility Functions
// ============================================================================

/**
 * Delete user profile avatar
 *
 * Removes the profile picture for a user, reverting to the default avatar.
 *
 * Backend Implementation:
 * Calls DELETE /api/v1/users/{id}/avatar which removes the stored profile image
 * and updates the user record to use the default avatar.
 *
 * @param userId - The unique identifier of the user whose avatar to delete
 * @returns Promise resolving when avatar is deleted
 *
 * @throws ProfileApiError with code 'UNAUTHORIZED' (401) - Not authenticated
 * @throws ProfileApiError with code 'PERMISSION_DENIED' (403) - Cannot edit this profile
 * @throws ProfileApiError with code 'NOT_FOUND' (404) - User does not exist
 *
 * @example
 * ```typescript
 * await deleteAvatar(123);
 * console.log('Avatar removed');
 * ```
 */
export async function deleteAvatar(userId: number): Promise<void> {
  return withRetry(async () => {
    try {
      await apiClient.delete(`/users/${userId}/avatar`);
    } catch (error) {
      handleApiError(error);
    }
  });
}

/**
 * Check if user can edit their own profile
 *
 * Utility function to check if the current user has permission to edit
 * their own profile settings. This is useful for UI conditional rendering.
 *
 * @returns Promise resolving to boolean indicating edit permission
 *
 * @example
 * ```typescript
 * const canEdit = await canEditOwnProfile();
 * if (canEdit) {
 *   showEditButton();
 * }
 * ```
 */
export async function canEditOwnProfile(): Promise<boolean> {
  return withRetry(async () => {
    try {
      const response: AxiosResponse<ApiResponse<{ canEdit: boolean }>> = await apiClient.get(
        '/users/me/capabilities/edit'
      );
      return extractData(response).canEdit;
    } catch {
      // If the capability check fails, assume no permission
      return false;
    }
  });
}

// ============================================================================
// Re-exports for Convenience
// ============================================================================

// Re-export types that consumers of this module may need
// User is exported from entities to maintain type consistency across the application
export type { User } from '@/types/entities';

export type {
  UserPreferences,
  UpdateProfilePayload,
  UpdateProfileData,
  AvatarUploadResponse,
  UserPreference,
} from '../types/profile.types';

export type { ApiResponse } from '@/types/api';

// ============================================================================
// Function Aliases for Backward Compatibility
// ============================================================================

/**
 * Alias for getUserProfile for backward compatibility with existing hooks
 * @deprecated Use getUserProfile instead
 */
export const fetchUserProfile = getUserProfile;

/**
 * Alias for getCurrentUserProfile for backward compatibility with existing hooks
 * @deprecated Use getCurrentUserProfile instead
 */
export const fetchCurrentUserProfile = getCurrentUserProfile;
