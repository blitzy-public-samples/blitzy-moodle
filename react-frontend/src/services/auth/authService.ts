/**
 * Authentication Service
 * 
 * Manages JWT authentication tokens (access and refresh tokens) for the React frontend.
 * Handles token storage, validation, refresh, and logout operations.
 * 
 * @module services/auth/authService
 */

import { jwtDecode } from 'jwt-decode';
import type { AxiosError } from 'axios';
import axios from 'axios';
import { getItem, setItem, removeItem } from '@/services/storage/storageService';
import { AUTH_ENDPOINTS } from '@/services/api/endpoints';
import type { ApiResponse } from '@/types/api';

// Token storage keys
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

// Token expiration buffer (refresh 1 minute before expiration)
const EXPIRATION_BUFFER = 60;

/**
 * JWT payload structure
 */
interface JWTPayload {
  sub: number; // user ID
  iss: string; // issuer
  iat: number; // issued at
  exp: number; // expiration
  roles?: string[];
  username?: string;
  [key: string]: unknown;
}

/**
 * User information extracted from JWT token
 */
export interface TokenUser {
  id: number;
  username?: string;
  roles?: string[];
}

/**
 * Token refresh response
 */
interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

// Mutex lock to prevent concurrent refresh requests
let refreshPromise: Promise<string> | null = null;

/**
 * Get the current access token from storage
 * 
 * @returns The access token or null if not found
 */
export function getAccessToken(): string | null {
  return getItem<string>(ACCESS_TOKEN_KEY);
}

/**
 * Get the current refresh token from storage
 * 
 * @returns The refresh token or null if not found
 */
export function getRefreshToken(): string | null {
  return getItem<string>(REFRESH_TOKEN_KEY);
}

/**
 * Store authentication tokens securely
 * 
 * @param accessToken - The JWT access token
 * @param refreshToken - The JWT refresh token
 */
export function setTokens(accessToken: string, refreshToken: string): void {
  setItem(ACCESS_TOKEN_KEY, accessToken);
  setItem(REFRESH_TOKEN_KEY, refreshToken);
}

/**
 * Clear all authentication tokens from storage
 */
export function clearTokens(): void {
  removeItem(ACCESS_TOKEN_KEY);
  removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Check if a JWT token is expired
 * 
 * @param token - The JWT token to check
 * @returns True if the token is expired or invalid
 */
export function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwtDecode<JWTPayload>(token);
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Consider token expired if it will expire within the buffer time
    return decoded.exp <= currentTime + EXPIRATION_BUFFER;
  } catch (error) {
    // If token can't be decoded, consider it expired
    return true;
  }
}

/**
 * Check if the user is currently authenticated
 * 
 * @returns True if there's a valid, non-expired access token
 */
export function isAuthenticated(): boolean {
  const token = getAccessToken();
  if (!token) {
    return false;
  }
  return !isTokenExpired(token);
}

/**
 * Refresh the access token using the refresh token
 * 
 * Uses a mutex to prevent concurrent refresh requests.
 * 
 * @returns Promise resolving to the new access token
 * @throws Error if refresh fails or refresh token is expired
 */
export async function refreshToken(): Promise<string> {
  // If there's already a refresh in progress, return that promise
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const currentRefreshToken = getRefreshToken();
      
      if (!currentRefreshToken) {
        throw new Error('No refresh token available');
      }

      if (isTokenExpired(currentRefreshToken)) {
        throw new Error('Refresh token expired');
      }

      // Call the refresh endpoint with the refresh token
      const response = await axios.post<ApiResponse<RefreshTokenResponse>>(
        `${process.env.VITE_API_BASE_URL ?? ''}${AUTH_ENDPOINTS.REFRESH}`,
        { refreshToken: currentRefreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success && response.data.data) {
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        setTokens(accessToken, newRefreshToken);
        return accessToken;
      } 
        throw new Error('Token refresh failed: Invalid response');
      
    } catch (error) {
      // Clear tokens if refresh fails
      clearTokens();
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        throw new Error(
          axiosError.response?.data?.message ?? 'Token refresh failed'
        );
      }
      throw error;
    } finally {
      // Clear the mutex
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Decode JWT token and extract user information
 * 
 * @param token - Optional JWT token to decode (defaults to current access token)
 * @returns User information from the token or null if invalid
 */
export function getUserFromToken(token?: string): TokenUser | null {
  const tokenToUse = token ?? getAccessToken();
  
  if (!tokenToUse) {
    return null;
  }

  try {
    const decoded = jwtDecode<JWTPayload>(tokenToUse);
    
    return {
      id: decoded.sub,
      username: decoded.username,
      roles: decoded.roles,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Logout the current user
 * 
 * Calls the API logout endpoint to blacklist the token on the server,
 * then clears local token storage.
 * 
 * @returns Promise that resolves when logout is complete
 */
export async function logout(): Promise<void> {
  try {
    const token = getAccessToken();
    
    if (token) {
      // Call the API to blacklist the token on the server
      await axios.post(
        `${process.env.VITE_API_BASE_URL ?? ''}${AUTH_ENDPOINTS.LOGOUT}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error) {
    // Log error but don't throw - we still want to clear local tokens
    console.error('Logout API call failed:', error);
  } finally {
    // Always clear tokens locally
    clearTokens();
  }
}

/**
 * Export authService object for compatibility with tests
 */
export const authService = {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  isTokenExpired,
  isAuthenticated,
  refreshToken,
  getUserFromToken,
  logout,
};

// Default export
export default authService;
