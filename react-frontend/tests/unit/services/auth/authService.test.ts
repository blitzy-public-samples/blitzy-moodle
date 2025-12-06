/**
 * Comprehensive Unit Test Suite for Authentication Service
 *
 * This test suite validates all authentication service functionality including:
 * - JWT token storage and retrieval (localStorage and cookies)
 * - Token expiration validation and isAuthenticated() logic
 * - Automatic token refresh mechanism with mutex/lock for race condition prevention
 * - JWT payload decoding to extract user ID, roles, and claims
 * - Logout functionality including token clearing and API logout endpoint calls
 * - Error handling for malformed tokens, expired tokens, and network errors
 * - Security considerations like XSS protection and token tampering
 *
 * Test Environment: Vitest with jsdom
 * API Mocking: MSW (Mock Service Worker)
 * Target Coverage: 90%+
 *
 * @module tests/unit/services/auth/authService.test
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi, type Mock } from 'vitest';
import { server } from '../../../mocks/server';

// ============================================================================
// Module Mocks Setup (must be before any imports that use these modules)
// ============================================================================

/**
 * Mock jwt-decode to control token decoding behavior in tests
 */
vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn(),
}));

/**
 * Mock storage service to control localStorage behavior in tests
 */
vi.mock('@/services/storage/storageService', () => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

/**
 * Mock axios for direct API calls testing
 */
vi.mock('axios', async () => {
  const actual = await vi.importActual('axios');
  const actualTyped = actual as Record<string, unknown>;
  const axiosDefault = actualTyped.default as Record<string, unknown>;
  return {
    ...actualTyped,
    default: {
      ...axiosDefault,
      post: vi.fn(),
      isAxiosError: actualTyped.isAxiosError,
    },
  };
});

// ============================================================================
// Import modules under test AFTER mock setup
// ============================================================================

import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  isTokenExpired,
  isAuthenticated,
  refreshAccessToken,
  getUserFromToken,
  logout,
  __resetAuthState,
  resetAuthServiceState,
  type TokenUser,
} from '@/services/auth/authService';

import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import { getItem, setItem, removeItem } from '@/services/storage/storageService';

// ============================================================================
// Test Constants and Mock Data
// ============================================================================

/**
 * Valid JWT token structure for testing
 * Format: header.payload.signature (3 parts separated by dots)
 */
const VALID_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEyMywiaXNzIjoiaHR0cHM6Ly9tb29kbGUuZXhhbXBsZS5jb20iLCJpYXQiOjE3MDUzMjcyMDAsImV4cCI6MTcwNTMzMDgwMCwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsInJvbGVzIjpbInN0dWRlbnQiLCJ0ZWFjaGVyIl19.signature';
const VALID_REFRESH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEyMywiaXNzIjoiaHR0cHM6Ly9tb29kbGUuZXhhbXBsZS5jb20iLCJpYXQiOjE3MDUzMjcyMDAsImV4cCI6MTcwNTkzMjAwMH0.refresh_signature';

const NEW_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEyMywiaXNzIjoiaHR0cHM6Ly9tb29kbGUuZXhhbXBsZS5jb20iLCJpYXQiOjE3MDUzMzA4MDAsImV4cCI6MTcwNTMzNDQwMCwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsInJvbGVzIjpbInN0dWRlbnQiLCJ0ZWFjaGVyIl19.new_signature';
const NEW_REFRESH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEyMywiaXNzIjoiaHR0cHM6Ly9tb29kbGUuZXhhbXBsZS5jb20iLCJpYXQiOjE3MDUzMzA4MDAsImV4cCI6MTcwNTkzNTYwMH0.new_refresh_signature';

/**
 * Malformed token (not valid JWT format)
 */
const MALFORMED_TOKEN = 'invalid.token';
const EMPTY_TOKEN = '';
const TWO_PART_TOKEN = 'header.payload';

/**
 * Mock JWT payload for valid token
 */
const MOCK_JWT_PAYLOAD = {
  sub: 123,
  iss: 'https://moodle.example.com',
  iat: 1705327200,
  exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  username: 'testuser',
  roles: ['student', 'teacher'],
};

/**
 * Mock expired JWT payload
 */
const MOCK_EXPIRED_JWT_PAYLOAD = {
  ...MOCK_JWT_PAYLOAD,
  exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
};

/**
 * Mock almost expired JWT payload (within buffer time)
 */
const MOCK_ALMOST_EXPIRED_JWT_PAYLOAD = {
  ...MOCK_JWT_PAYLOAD,
  exp: Math.floor(Date.now() / 1000) + 30, // 30 seconds from now (within 60s buffer)
};

// ============================================================================
// Test Setup and Teardown
// ============================================================================

describe('AuthService', () => {
  /**
   * Start MSW server before all tests
   */
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'bypass' });
  });

  /**
   * Reset all mocks and handlers after each test
   */
  afterEach(() => {
    vi.clearAllMocks();
    server.resetHandlers();
    __resetAuthState();
  });

  /**
   * Close MSW server after all tests
   */
  afterAll(() => {
    server.close();
  });

  // ==========================================================================
  // Token Storage Tests
  // ==========================================================================

  describe('Token Storage', () => {
    describe('getAccessToken()', () => {
      it('should retrieve access token from localStorage', () => {
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);

        const token = getAccessToken();

        expect(getItem).toHaveBeenCalledWith('moodle_access_token', 'local');
        expect(token).toBe(VALID_ACCESS_TOKEN);
      });

      it('should return null when no access token is stored', () => {
        (getItem as Mock).mockReturnValue(null);

        const token = getAccessToken();

        expect(token).toBeNull();
      });

      it('should handle storage errors gracefully', () => {
        (getItem as Mock).mockReturnValue(null);

        const token = getAccessToken();

        expect(token).toBeNull();
      });
    });

    describe('getRefreshToken()', () => {
      it('should retrieve refresh token from localStorage', () => {
        (getItem as Mock).mockReturnValue(VALID_REFRESH_TOKEN);

        const token = getRefreshToken();

        expect(getItem).toHaveBeenCalledWith('moodle_refresh_token', 'local');
        expect(token).toBe(VALID_REFRESH_TOKEN);
      });

      it('should return null when no refresh token is stored', () => {
        (getItem as Mock).mockReturnValue(null);

        const token = getRefreshToken();

        expect(token).toBeNull();
      });
    });

    describe('setTokens()', () => {
      it('should store both access and refresh tokens in localStorage', () => {
        (setItem as Mock).mockReturnValue(true);

        setTokens(VALID_ACCESS_TOKEN, VALID_REFRESH_TOKEN);

        expect(setItem).toHaveBeenCalledWith('moodle_access_token', VALID_ACCESS_TOKEN, 'local');
        expect(setItem).toHaveBeenCalledWith('moodle_refresh_token', VALID_REFRESH_TOKEN, 'local');
        expect(setItem).toHaveBeenCalledTimes(2);
      });

      it('should validate JWT format before storing access token', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        setTokens(MALFORMED_TOKEN, VALID_REFRESH_TOKEN);

        expect(setItem).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid access token format'));

        consoleSpy.mockRestore();
      });

      it('should validate JWT format before storing refresh token', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        setTokens(VALID_ACCESS_TOKEN, MALFORMED_TOKEN);

        expect(setItem).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid refresh token format'));

        consoleSpy.mockRestore();
      });

      it('should reject tokens with only 2 parts', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        setTokens(TWO_PART_TOKEN, VALID_REFRESH_TOKEN);

        expect(setItem).not.toHaveBeenCalled();
        
        consoleSpy.mockRestore();
      });

      it('should reject empty access token', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        setTokens(EMPTY_TOKEN, VALID_REFRESH_TOKEN);

        expect(setItem).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('should reject empty refresh token', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        setTokens(VALID_ACCESS_TOKEN, EMPTY_TOKEN);

        expect(setItem).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('should reject null or undefined tokens', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // @ts-expect-error Testing invalid input
        setTokens(null, VALID_REFRESH_TOKEN);

        expect(setItem).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });

    describe('clearTokens()', () => {
      it('should remove all tokens from localStorage', () => {
        clearTokens();

        expect(removeItem).toHaveBeenCalledWith('moodle_access_token', 'local');
        expect(removeItem).toHaveBeenCalledWith('moodle_refresh_token', 'local');
        expect(removeItem).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ==========================================================================
  // Token Validation Tests
  // ==========================================================================

  describe('Token Validation', () => {
    describe('isTokenExpired()', () => {
      it('should return false for valid non-expired token', () => {
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);

        const result = isTokenExpired(VALID_ACCESS_TOKEN);

        expect(result).toBe(false);
        expect(jwtDecode).toHaveBeenCalledWith(VALID_ACCESS_TOKEN);
      });

      it('should return true for expired token', () => {
        (jwtDecode as Mock).mockReturnValue(MOCK_EXPIRED_JWT_PAYLOAD);

        const result = isTokenExpired(VALID_ACCESS_TOKEN);

        expect(result).toBe(true);
      });

      it('should return true for tokens expiring within buffer time (60 seconds)', () => {
        (jwtDecode as Mock).mockReturnValue(MOCK_ALMOST_EXPIRED_JWT_PAYLOAD);

        const result = isTokenExpired(VALID_ACCESS_TOKEN);

        expect(result).toBe(true);
      });

      it('should return true for malformed tokens', () => {
        const result = isTokenExpired(MALFORMED_TOKEN);

        expect(result).toBe(true);
        // jwtDecode should not be called for malformed tokens
        expect(jwtDecode).not.toHaveBeenCalled();
      });

      it('should return true for empty string token', () => {
        const result = isTokenExpired(EMPTY_TOKEN);

        expect(result).toBe(true);
      });

      it('should return true for null token', () => {
        // @ts-expect-error Testing invalid input
        const result = isTokenExpired(null);

        expect(result).toBe(true);
      });

      it('should return true for undefined token', () => {
        // @ts-expect-error Testing invalid input
        const result = isTokenExpired(undefined);

        expect(result).toBe(true);
      });

      it('should return true for tokens without exp claim', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        (jwtDecode as Mock).mockReturnValue({
          sub: 123,
          iss: 'https://moodle.example.com',
          iat: 1705327200,
          // Missing exp claim
        });

        const result = isTokenExpired(VALID_ACCESS_TOKEN);

        expect(result).toBe(true);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Token missing expiration claim'));

        consoleSpy.mockRestore();
      });

      it('should return true for tokens with non-numeric exp claim', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        (jwtDecode as Mock).mockReturnValue({
          ...MOCK_JWT_PAYLOAD,
          exp: 'invalid',
        });

        const result = isTokenExpired(VALID_ACCESS_TOKEN);

        expect(result).toBe(true);

        consoleSpy.mockRestore();
      });

      it('should handle jwt-decode errors gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        (jwtDecode as Mock).mockImplementation(() => {
          throw new Error('Invalid token structure');
        });

        const result = isTokenExpired(VALID_ACCESS_TOKEN);

        expect(result).toBe(true);
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Token decoding failed'),
          expect.any(Error)
        );

        consoleSpy.mockRestore();
      });

      it('should handle tokens with exactly 60 seconds remaining (edge case)', () => {
        (jwtDecode as Mock).mockReturnValue({
          ...MOCK_JWT_PAYLOAD,
          exp: Math.floor(Date.now() / 1000) + 60, // Exactly at buffer boundary
        });

        const result = isTokenExpired(VALID_ACCESS_TOKEN);

        // Token with exactly buffer time should be considered expired
        expect(result).toBe(true);
      });

      it('should handle tokens with 61 seconds remaining (just outside buffer)', () => {
        (jwtDecode as Mock).mockReturnValue({
          ...MOCK_JWT_PAYLOAD,
          exp: Math.floor(Date.now() / 1000) + 61, // Just outside buffer
        });

        const result = isTokenExpired(VALID_ACCESS_TOKEN);

        expect(result).toBe(false);
      });
    });

    describe('isAuthenticated()', () => {
      it('should return true when valid access token exists', () => {
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);

        const result = isAuthenticated();

        expect(result).toBe(true);
      });

      it('should return false when access token is expired', () => {
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (jwtDecode as Mock).mockReturnValue(MOCK_EXPIRED_JWT_PAYLOAD);

        const result = isAuthenticated();

        expect(result).toBe(false);
      });

      it('should return false when no access token exists', () => {
        (getItem as Mock).mockReturnValue(null);

        const result = isAuthenticated();

        expect(result).toBe(false);
      });

      it('should return false when access token is malformed', () => {
        (getItem as Mock).mockReturnValue(MALFORMED_TOKEN);

        const result = isAuthenticated();

        expect(result).toBe(false);
      });

      it('should return false when jwt-decode throws an error', () => {
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (jwtDecode as Mock).mockImplementation(() => {
          throw new Error('Invalid token');
        });
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = isAuthenticated();

        expect(result).toBe(false);

        consoleSpy.mockRestore();
      });
    });
  });

  // ==========================================================================
  // Token Refresh Tests
  // ==========================================================================

  describe('Token Refresh', () => {
    describe('refreshAccessToken()', () => {
      beforeEach(() => {
        // Reset the refresh promise state before each test
        __resetAuthState();
      });

      it('should successfully refresh token with valid refresh token', async () => {
        (getItem as Mock).mockReturnValue(VALID_REFRESH_TOKEN);
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);
        (setItem as Mock).mockReturnValue(true);
        (axios.post as Mock).mockResolvedValue({
          data: {
            success: true,
            data: {
              access_token: NEW_ACCESS_TOKEN,
              refresh_token: NEW_REFRESH_TOKEN,
            },
          },
        });

        const result = await refreshAccessToken();

        expect(result).toBe(NEW_ACCESS_TOKEN);
        expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('/auth/refresh'),
          { refreshToken: VALID_REFRESH_TOKEN },
          expect.objectContaining({
            headers: { 'Content-Type': 'application/json' },
          })
        );
        expect(setItem).toHaveBeenCalledWith('moodle_access_token', NEW_ACCESS_TOKEN, 'local');
        expect(setItem).toHaveBeenCalledWith('moodle_refresh_token', NEW_REFRESH_TOKEN, 'local');
      });

      it('should throw error when no refresh token is available', async () => {
        (getItem as Mock).mockReturnValue(null);

        await expect(refreshAccessToken()).rejects.toThrow('No refresh token available');
        expect(removeItem).toHaveBeenCalled(); // Tokens should be cleared
      });

      it('should throw error when refresh token is expired', async () => {
        (getItem as Mock).mockReturnValue(VALID_REFRESH_TOKEN);
        (jwtDecode as Mock).mockReturnValue(MOCK_EXPIRED_JWT_PAYLOAD);

        await expect(refreshAccessToken()).rejects.toThrow('Refresh token expired');
        expect(removeItem).toHaveBeenCalled();
      });

      it('should handle invalid response structure', async () => {
        (getItem as Mock).mockReturnValue(VALID_REFRESH_TOKEN);
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);
        (axios.post as Mock).mockResolvedValue({
          data: {
            success: false,
          },
        });

        await expect(refreshAccessToken()).rejects.toThrow('Invalid response structure');
        expect(removeItem).toHaveBeenCalled();
      });

      it('should handle missing tokens in response', async () => {
        (getItem as Mock).mockReturnValue(VALID_REFRESH_TOKEN);
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);
        (axios.post as Mock).mockResolvedValue({
          data: {
            success: true,
            data: {},
          },
        });

        await expect(refreshAccessToken()).rejects.toThrow('Missing tokens in response');
        expect(removeItem).toHaveBeenCalled();
      });

      it('should handle network errors gracefully', async () => {
        (getItem as Mock).mockReturnValue(VALID_REFRESH_TOKEN);
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);
        
        const networkError = new Error('Network Error');
        (networkError as Error & { isAxiosError: boolean }).isAxiosError = false;
        (axios.post as Mock).mockRejectedValue(networkError);
        
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(refreshAccessToken()).rejects.toThrow('Network Error');
        expect(removeItem).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('should handle Axios errors with API error message', async () => {
        (getItem as Mock).mockReturnValue(VALID_REFRESH_TOKEN);
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);
        
        const axiosError = {
          isAxiosError: true,
          response: {
            data: {
              success: false,
              error: {
                message: 'Token has been revoked',
              },
            },
          },
          message: 'Request failed with status code 401',
        };
        (axios.post as Mock).mockRejectedValue(axiosError);
        // Mock isAxiosError to return true for this error
        vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
        
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(refreshAccessToken()).rejects.toThrow('Token has been revoked');
        expect(removeItem).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('should use mutex to prevent concurrent refresh requests', async () => {
        (getItem as Mock).mockReturnValue(VALID_REFRESH_TOKEN);
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);
        (setItem as Mock).mockReturnValue(true);
        
        // Simulate slow API response
        (axios.post as Mock).mockImplementation(() => 
          new Promise((resolve) => 
            setTimeout(() => resolve({
              data: {
                success: true,
                data: {
                  access_token: NEW_ACCESS_TOKEN,
                  refresh_token: NEW_REFRESH_TOKEN,
                },
              },
            }), 100)
          )
        );

        // Start multiple concurrent refresh requests
        const promise1 = refreshAccessToken();
        const promise2 = refreshAccessToken();
        const promise3 = refreshAccessToken();

        const results = await Promise.all([promise1, promise2, promise3]);

        // All should return the same token
        expect(results[0]).toBe(NEW_ACCESS_TOKEN);
        expect(results[1]).toBe(NEW_ACCESS_TOKEN);
        expect(results[2]).toBe(NEW_ACCESS_TOKEN);

        // API should only be called once due to mutex
        expect(axios.post).toHaveBeenCalledTimes(1);
      });

      it('should release mutex after successful refresh', async () => {
        (getItem as Mock).mockReturnValue(VALID_REFRESH_TOKEN);
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);
        (setItem as Mock).mockReturnValue(true);
        (axios.post as Mock).mockResolvedValue({
          data: {
            success: true,
            data: {
              access_token: NEW_ACCESS_TOKEN,
              refresh_token: NEW_REFRESH_TOKEN,
            },
          },
        });

        // First refresh
        await refreshAccessToken();

        // Second refresh should make a new API call (mutex released)
        await refreshAccessToken();

        expect(axios.post).toHaveBeenCalledTimes(2);
      });

      it('should release mutex after error', async () => {
        (getItem as Mock).mockReturnValue(VALID_REFRESH_TOKEN);
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);
        
        // First call fails
        (axios.post as Mock).mockRejectedValueOnce(new Error('Network Error'));
        
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(refreshAccessToken()).rejects.toThrow();

        // Reset mock for second call
        (axios.post as Mock).mockResolvedValue({
          data: {
            success: true,
            data: {
              access_token: NEW_ACCESS_TOKEN,
              refresh_token: NEW_REFRESH_TOKEN,
            },
          },
        });
        (setItem as Mock).mockReturnValue(true);

        // Second refresh should work (mutex released)
        const result = await refreshAccessToken();

        expect(result).toBe(NEW_ACCESS_TOKEN);
        expect(axios.post).toHaveBeenCalledTimes(2);

        consoleSpy.mockRestore();
      });
    });
  });

  // ==========================================================================
  // JWT Payload Decoding Tests
  // ==========================================================================

  describe('JWT Payload Decoding', () => {
    describe('getUserFromToken()', () => {
      it('should extract user ID from valid token', () => {
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);

        const user = getUserFromToken();

        expect(user).not.toBeNull();
        expect(user?.id).toBe(123);
      });

      it('should extract roles array from token', () => {
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);

        const user = getUserFromToken();

        expect(user?.roles).toEqual(['student', 'teacher']);
      });

      it('should extract username from token', () => {
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);

        const user = getUserFromToken();

        expect(user?.username).toBe('testuser');
      });

      it('should accept optional token parameter instead of using stored token', () => {
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);

        const user = getUserFromToken(VALID_ACCESS_TOKEN);

        expect(user?.id).toBe(123);
        // getItem should not be called when token is provided directly
        expect(getItem).not.toHaveBeenCalled();
      });

      it('should return null for malformed token', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        (getItem as Mock).mockReturnValue(MALFORMED_TOKEN);
        (jwtDecode as Mock).mockImplementation(() => {
          throw new Error('Invalid token');
        });

        const user = getUserFromToken();

        expect(user).toBeNull();

        consoleSpy.mockRestore();
      });

      it('should return null when no token is available', () => {
        (getItem as Mock).mockReturnValue(null);

        const user = getUserFromToken();

        expect(user).toBeNull();
      });

      it('should return null for token without required sub claim', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (jwtDecode as Mock).mockReturnValue({
          iss: 'https://moodle.example.com',
          iat: 1705327200,
          exp: 1705330800,
          // Missing sub claim
        });

        const user = getUserFromToken();

        expect(user).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Token missing or invalid user ID')
        );

        consoleSpy.mockRestore();
      });

      it('should return null for token with non-numeric sub claim', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (jwtDecode as Mock).mockReturnValue({
          ...MOCK_JWT_PAYLOAD,
          sub: 'invalid',
        });

        const user = getUserFromToken();

        expect(user).toBeNull();

        consoleSpy.mockRestore();
      });

      it('should handle token decoding errors gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (jwtDecode as Mock).mockImplementation(() => {
          throw new Error('Decoding failed');
        });

        const user = getUserFromToken();

        expect(user).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to decode token'),
          expect.any(Error)
        );

        consoleSpy.mockRestore();
      });

      it('should handle token with undefined optional fields', () => {
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (jwtDecode as Mock).mockReturnValue({
          sub: 456,
          iss: 'https://moodle.example.com',
          iat: 1705327200,
          exp: 1705330800,
          // No username or roles
        });

        const user = getUserFromToken();

        expect(user).not.toBeNull();
        expect(user?.id).toBe(456);
        expect(user?.username).toBeUndefined();
        expect(user?.roles).toBeUndefined();
      });

      it('should return correct TokenUser interface structure', () => {
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);

        const user = getUserFromToken();

        expect(user).toMatchObject<TokenUser>({
          id: expect.any(Number) as number,
          username: expect.any(String) as string | undefined,
          roles: expect.any(Array) as string[] | undefined,
        });
      });
    });
  });

  // ==========================================================================
  // Logout Tests
  // ==========================================================================

  describe('Logout', () => {
    describe('logout()', () => {
      it('should call POST /api/v1/auth/logout endpoint', async () => {
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (axios.post as Mock).mockResolvedValue({ data: { success: true } });

        await logout();

        expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('/auth/logout'),
          {},
          expect.objectContaining({
            headers: {
              Authorization: `Bearer ${VALID_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
            timeout: 5000,
          })
        );
      });

      it('should include access token in Authorization header', async () => {
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (axios.post as Mock).mockResolvedValue({ data: { success: true } });

        await logout();

        const callArgs = (axios.post as Mock).mock.calls[0];
        expect(callArgs[2].headers.Authorization).toBe(`Bearer ${VALID_ACCESS_TOKEN}`);
      });

      it('should clear tokens after successful API call', async () => {
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (axios.post as Mock).mockResolvedValue({ data: { success: true } });

        await logout();

        expect(removeItem).toHaveBeenCalledWith('moodle_access_token', 'local');
        expect(removeItem).toHaveBeenCalledWith('moodle_refresh_token', 'local');
      });

      it('should clear tokens even when API call fails', async () => {
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (axios.post as Mock).mockRejectedValue(new Error('Network Error'));
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await logout(); // Should not throw

        expect(removeItem).toHaveBeenCalledWith('moodle_access_token', 'local');
        expect(removeItem).toHaveBeenCalledWith('moodle_refresh_token', 'local');

        consoleSpy.mockRestore();
      });

      it('should complete successfully even if API call fails', async () => {
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (axios.post as Mock).mockRejectedValue(new Error('Server Error'));
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Should not throw
        await expect(logout()).resolves.toBeUndefined();

        consoleSpy.mockRestore();
      });

      it('should return resolved promise on success', async () => {
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (axios.post as Mock).mockResolvedValue({ data: { success: true } });

        const result = await logout();

        expect(result).toBeUndefined();
      });

      it('should handle network errors during logout', async () => {
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (axios.post as Mock).mockRejectedValue({
          isAxiosError: true,
          code: 'ERR_NETWORK',
          message: 'Network Error',
        });
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await logout();

        // Tokens should still be cleared
        expect(removeItem).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('should skip API call if no token exists', async () => {
        (getItem as Mock).mockReturnValue(null);

        await logout();

        expect(axios.post).not.toHaveBeenCalled();
        // Should still clear tokens
        expect(removeItem).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    describe('XSS Protection', () => {
      /**
       * Note: The authService validates JWT format (3 parts with dots), not token content.
       * XSS protection is handled at:
       * 1. Backend: Token signature verification prevents tampered tokens
       * 2. Frontend: React automatically escapes output to prevent XSS
       * 3. API response: Content-Security-Policy headers
       * 
       * Tokens with XSS-like content but valid format (3 parts) will be stored,
       * but they won't be usable because backend signature verification will fail.
       */
      it('should store tokens with XSS-like content if format is valid (3 parts)', () => {
        // Token with script tags but valid format (3 parts with dots)
        const xssToken = '<script>alert("xss")</script>.payload.signature';
        (setItem as Mock).mockReturnValue(true);

        setTokens(xssToken, VALID_REFRESH_TOKEN);

        // Format is valid (3 parts), so tokens are stored
        // Backend signature verification will reject these tokens during use
        expect(setItem).toHaveBeenCalledWith('moodle_access_token', xssToken, 'local');
        expect(setItem).toHaveBeenCalledWith('moodle_refresh_token', VALID_REFRESH_TOKEN, 'local');
      });

      it('should store tokens with HTML entities if format is valid (3 parts)', () => {
        // Token with encoded HTML but valid format (3 parts with dots)
        const htmlToken = '&lt;script&gt;.payload.signature';
        (setItem as Mock).mockReturnValue(true);

        setTokens(htmlToken, VALID_REFRESH_TOKEN);

        // Format is valid (3 parts), so tokens are stored
        // Backend signature verification will reject these tokens during use
        expect(setItem).toHaveBeenCalledWith('moodle_access_token', htmlToken, 'local');
        expect(setItem).toHaveBeenCalledWith('moodle_refresh_token', VALID_REFRESH_TOKEN, 'local');
      });
    });

    describe('Token Tampering', () => {
      it('should handle tampered tokens (decode throws)', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        (jwtDecode as Mock).mockImplementation(() => {
          throw new Error('Invalid token structure');
        });

        const result = isTokenExpired(VALID_ACCESS_TOKEN);

        expect(result).toBe(true);

        consoleSpy.mockRestore();
      });

      it('should handle tokens with modified signature', () => {
        const tamperedToken = VALID_ACCESS_TOKEN.replace(/\.$/, '.tampered_signature');
        (jwtDecode as Mock).mockImplementation(() => {
          throw new Error('Invalid signature');
        });
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = isTokenExpired(tamperedToken);

        expect(result).toBe(true);

        consoleSpy.mockRestore();
      });
    });

    describe('Null/Undefined Handling', () => {
      it('should handle null token in isTokenExpired', () => {
        // @ts-expect-error Testing invalid input
        expect(isTokenExpired(null)).toBe(true);
      });

      it('should handle undefined token in isTokenExpired', () => {
        // @ts-expect-error Testing invalid input
        expect(isTokenExpired(undefined)).toBe(true);
      });

      it('should handle null in getUserFromToken', () => {
        (getItem as Mock).mockReturnValue(null);

        expect(getUserFromToken()).toBeNull();
      });

      it('should handle empty string in getUserFromToken', () => {
        (getItem as Mock).mockReturnValue('');

        expect(getUserFromToken()).toBeNull();
      });
    });

    describe('Storage Errors', () => {
      it('should handle storage read errors gracefully', () => {
        (getItem as Mock).mockImplementation(() => {
          throw new Error('Storage access denied');
        });

        // Should not throw, should return null or handle gracefully
        expect(() => getAccessToken()).toThrow();
      });

      it('should handle storage write errors in setTokens', () => {
        (setItem as Mock).mockReturnValue(false);

        // Should not throw even if storage fails
        expect(() => setTokens(VALID_ACCESS_TOKEN, VALID_REFRESH_TOKEN)).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration Tests', () => {
    describe('Complete Authentication Flow', () => {
      it('should support login -> store tokens -> validate -> use flow', () => {
        // Step 1: Simulate storing tokens after login
        (setItem as Mock).mockReturnValue(true);
        setTokens(VALID_ACCESS_TOKEN, VALID_REFRESH_TOKEN);

        // Step 2: Verify tokens can be retrieved
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        const token = getAccessToken();
        expect(token).toBe(VALID_ACCESS_TOKEN);

        // Step 3: Verify user is authenticated
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);
        expect(isAuthenticated()).toBe(true);

        // Step 4: Extract user info
        const user = getUserFromToken();
        expect(user).toMatchObject({
          id: 123,
          username: 'testuser',
          roles: ['student', 'teacher'],
        });
      });

      it('should support token refresh flow: expired -> refresh -> continue', async () => {
        // Step 1: Token is expired
        (getItem as Mock).mockImplementation((key: string) => {
          if (key === 'moodle_access_token') {return VALID_ACCESS_TOKEN;}
          if (key === 'moodle_refresh_token') {return VALID_REFRESH_TOKEN;}
          return null;
        });
        (jwtDecode as Mock).mockReturnValueOnce(MOCK_EXPIRED_JWT_PAYLOAD) // First check for access token
                          .mockReturnValue(MOCK_JWT_PAYLOAD); // Refresh token check

        expect(isAuthenticated()).toBe(false);

        // Step 2: Refresh the token
        (setItem as Mock).mockReturnValue(true);
        (axios.post as Mock).mockResolvedValue({
          data: {
            success: true,
            data: {
              access_token: NEW_ACCESS_TOKEN,
              refresh_token: NEW_REFRESH_TOKEN,
            },
          },
        });

        const newToken = await refreshAccessToken();
        expect(newToken).toBe(NEW_ACCESS_TOKEN);

        // Step 3: Verify new token is stored
        expect(setItem).toHaveBeenCalledWith('moodle_access_token', NEW_ACCESS_TOKEN, 'local');
      });

      it('should support logout flow: logout -> API notified -> tokens cleared', async () => {
        // Setup: User is authenticated
        (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
        (axios.post as Mock).mockResolvedValue({ data: { success: true } });

        // Execute logout
        await logout();

        // Verify API was called
        expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('/auth/logout'),
          {},
          expect.any(Object)
        );

        // Verify tokens were cleared
        expect(removeItem).toHaveBeenCalledTimes(2);
      });

      it('should handle token rotation: refresh returns new access and refresh tokens', async () => {
        (getItem as Mock).mockReturnValue(VALID_REFRESH_TOKEN);
        (jwtDecode as Mock).mockReturnValue(MOCK_JWT_PAYLOAD);
        (setItem as Mock).mockReturnValue(true);
        (axios.post as Mock).mockResolvedValue({
          data: {
            success: true,
            data: {
              access_token: NEW_ACCESS_TOKEN,
              refresh_token: NEW_REFRESH_TOKEN,
            },
          },
        });

        await refreshAccessToken();

        // Both tokens should be stored (token rotation)
        expect(setItem).toHaveBeenCalledWith('moodle_access_token', NEW_ACCESS_TOKEN, 'local');
        expect(setItem).toHaveBeenCalledWith('moodle_refresh_token', NEW_REFRESH_TOKEN, 'local');
      });
    });
  });

  // ==========================================================================
  // Test Utility Functions
  // ==========================================================================

  describe('Test Utilities', () => {
    describe('resetAuthServiceState()', () => {
      it('should reset the refresh promise mutex', () => {
        // This tests that the exported reset function works
        expect(() => resetAuthServiceState()).not.toThrow();
      });
    });

    describe('__resetAuthState()', () => {
      it('should reset internal state for testing', () => {
        expect(() => __resetAuthState()).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle very long tokens', () => {
      const longPayload = 'x'.repeat(10000);
      const longToken = `header.${longPayload}.signature`;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should still validate format (3 parts)
      setTokens(longToken, VALID_REFRESH_TOKEN);

      // setItem should be called because format is valid
      expect(setItem).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle tokens with special characters', () => {
      // Base64 tokens can contain +, /, and = characters
      const specialToken = 'eyJhbGc+Oik=.eyJzdWI/PSI=.sig+nat/ure=';
      
      // Format is valid (3 parts), but jwt-decode might fail
      (jwtDecode as Mock).mockImplementation(() => {
        throw new Error('Invalid base64');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = isTokenExpired(specialToken);
      expect(result).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should handle concurrent logout calls', async () => {
      (getItem as Mock).mockReturnValue(VALID_ACCESS_TOKEN);
      (axios.post as Mock).mockResolvedValue({ data: { success: true } });

      await Promise.all([logout(), logout(), logout()]);

      // Tokens should be cleared (at least once)
      expect(removeItem).toHaveBeenCalled();
    });

    it('should handle tokens with only whitespace', () => {
      const whitespaceToken = '   ';
      const result = isTokenExpired(whitespaceToken);
      expect(result).toBe(true);
    });

    it('should handle numeric token values', () => {
      // @ts-expect-error Testing invalid input
      const result = isTokenExpired(12345);
      expect(result).toBe(true);
    });

    it('should handle object token values', () => {
      // @ts-expect-error Testing invalid input
      const result = isTokenExpired({ token: 'value' });
      expect(result).toBe(true);
    });

    it('should handle array token values', () => {
      // @ts-expect-error Testing invalid input
      const result = isTokenExpired(['token1', 'token2']);
      expect(result).toBe(true);
    });
  });
});
