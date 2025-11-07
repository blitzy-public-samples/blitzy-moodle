/**
 * Profile API Client
 *
 * API client for profile-related operations including fetching user profiles,
 * updating profile information, and managing avatar uploads.
 * All API calls delegate to existing Moodle PHP backend functions.
 *
 * Implements comprehensive error handling, retry logic with exponential backoff,
 * request timeout management, and JWT authentication integration.
 *
 * @module features/profile/api
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { authService } from '@/services/auth/authService';
import type { 
  User, 
  UpdateProfileData,
  AvatarUploadResponse,
  UserPreferences 
} from '../types/profile.types';

/**
 * API Configuration
 */
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3; // 3 retries after initial attempt = 4 total attempts
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Create axios instance with default configuration
 */
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor to add JWT token
  client.interceptors.request.use(
    (config) => {
      const token = authService.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor to handle token refresh on 401
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

      // Handle 401 Unauthorized - attempt token refresh
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          await authService.refreshToken();
          
          // Retry the original request with new token
          const token = authService.getAccessToken();
          if (token && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          
          return client.request(originalRequest);
        } catch (refreshError) {
          // Token refresh failed, reject the original error
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Retry logic with exponential backoff for 5xx errors
 */
const retryRequest = async <T>(
  requestFn: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error as Error;

      // Only retry on 5xx server errors
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        
        // Don't retry on 4xx client errors
        if (status && status >= 400 && status < 500) {
          throw error;
        }

        // Don't retry if this was the last attempt
        if (attempt === retries) {
          throw error;
        }

        // Calculate exponential backoff delay
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        await sleep(delay);
      } else {
        // Non-axios errors should not be retried
        throw error;
      }
    }
  }

  throw lastError;
};

/**
 * Extract error message from API error response
 * 
 * For 422 validation errors, preserves the full axios error with validation details
 * For other errors, extracts and throws the error message from response
 */
const handleApiError = (error: any): never => {
  if (axios.isAxiosError(error) && error.response) {
    const status = error.response.status;
    const errorData = error.response.data?.error;
    
    // For 422 validation errors, preserve the full axios error with details
    if (status === 422) {
      throw error;
    }
    
    // For other errors, throw a new Error with the message from the API
    if (errorData?.message) {
      throw new Error(errorData.message);
    }
  }
  
  // Re-throw original error if we can't extract a better message
  throw error;
};

/**
 * Transform interests from comma-separated string to array if needed
 */
const transformInterests = (interests: string | string[] | undefined): string[] | undefined => {
  if (!interests) return undefined;
  if (Array.isArray(interests)) return interests;
  if (typeof interests === 'string') {
    return interests.split(',').map((i) => i.trim()).filter((i) => i.length > 0);
  }
  return undefined;
};

/**
 * Transform API response to User type
 */
const transformProfileResponse = (data: any): User => {
  return {
    ...data,
    interests: transformInterests(data.interests),
  };
};

/**
 * Get user profile by ID
 *
 * Makes GET request to /api/v1/users/{userId}
 * Includes JWT token authentication
 * Retries on 5xx errors with exponential backoff
 *
 * @param userId - The ID of the user whose profile to fetch
 * @returns Promise resolving to User object
 * @throws Error with message from API response
 */
export async function fetchUserProfile(userId: number): Promise<User> {
  const client = createApiClient();

  const fetchProfile = async () => {
    const response = await client.get(`/users/${userId}`);
    const profile = transformProfileResponse(response.data.data);
    return profile;
  };

  try {
    return await retryRequest(fetchProfile);
  } catch (error) {
    handleApiError(error);
    throw error; // TypeScript needs this even though handleApiError never returns
  }
}

/**
 * Get current authenticated user profile
 *
 * Makes GET request to /api/v1/auth/me
 * Includes JWT token authentication
 * Retries on 5xx errors with exponential backoff
 *
 * @returns Promise resolving to current User object
 * @throws Error with message from API response
 */
export async function fetchCurrentUserProfile(): Promise<User> {
  const client = createApiClient();

  const fetchCurrentUser = async () => {
    const response = await client.get(`/auth/me`);
    const profile = transformProfileResponse(response.data.data);
    return profile;
  };

  try {
    return await retryRequest(fetchCurrentUser);
  } catch (error) {
    handleApiError(error);
    throw error; // TypeScript needs this even though handleApiError never returns
  }
}

/**
 * Update user profile information
 *
 * Makes PUT request to /api/v1/users/{userId} with JSON payload
 * Includes JWT token authentication
 * Retries on 5xx errors with exponential backoff
 *
 * @param userId - The ID of the user whose profile to update
 * @param data - Profile update data
 * @returns Promise resolving to updated User object
 * @throws Error with message from API response (or full AxiosError for 422 validation errors)
 */
export async function updateUserProfile(userId: number, data: UpdateProfileData): Promise<User> {
  const client = createApiClient();

  const updateProfileRequest = async () => {
    const response = await client.put(`/users/${userId}`, data);
    const profile = transformProfileResponse(response.data.data);
    return profile;
  };

  try {
    return await retryRequest(updateProfileRequest);
  } catch (error) {
    handleApiError(error);
    throw error; // TypeScript needs this even though handleApiError never returns
  }
}

/**
 * Upload user avatar/profile picture
 *
 * Makes POST request to /api/v1/files/upload with multipart/form-data
 * Includes JWT token authentication
 * Retries on 5xx errors with exponential backoff
 *
 * @param userId - The ID of the user whose avatar to upload
 * @param file - Image file to upload
 * @returns Promise resolving to AvatarUploadResponse object with file metadata
 * @throws Error with message from API response (or full AxiosError for 422 validation errors)
 */
export async function uploadAvatar(userId: number, file: File): Promise<AvatarUploadResponse> {
  const client = createApiClient();

  const uploadAvatarRequest = async () => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId.toString());
    formData.append('contextType', 'user');

    // Let axios automatically set Content-Type with boundary for FormData
    const response = await client.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.data;
  };

  try {
    return await retryRequest(uploadAvatarRequest);
  } catch (error) {
    handleApiError(error);
    throw error; // TypeScript needs this even though handleApiError never returns
  }
}

/**
 * Delete user avatar/profile picture
 *
 * Makes DELETE request to /api/v1/users/{userId}/avatar
 * Includes JWT token authentication
 * Retries on 5xx errors with exponential backoff
 *
 * @param userId - The ID of the user whose avatar to delete
 * @returns Promise resolving when avatar is deleted
 * @throws Error with message from API response
 */
export async function deleteAvatar(userId: number): Promise<void> {
  const client = createApiClient();

  const deleteAvatarRequest = async () => {
    await client.delete(`/users/${userId}/avatar`);
  };

  try {
    return await retryRequest(deleteAvatarRequest);
  } catch (error) {
    handleApiError(error);
    throw error; // TypeScript needs this even though handleApiError never returns
  }
}

/**
 * Update user preferences
 *
 * Makes PUT request to /api/v1/users/{userId}/preferences with JSON payload
 * Includes JWT token authentication
 * Retries on 5xx errors with exponential backoff
 *
 * @param userId - The ID of the user whose preferences to update
 * @param preferences - User preferences key-value map
 * @returns Promise resolving to updated UserPreferences object
 * @throws Error with message from API response (or full AxiosError for 422 validation errors)
 */
export async function updateUserPreferences(userId: number, preferences: UserPreferences): Promise<UserPreferences> {
  const client = createApiClient();

  const updatePreferencesRequest = async () => {
    const response = await client.put(`/users/${userId}/preferences`, preferences);
    return response.data.data;
  };

  try {
    return await retryRequest(updatePreferencesRequest);
  } catch (error) {
    handleApiError(error);
    throw error; // TypeScript needs this even though handleApiError never returns
  }
}
