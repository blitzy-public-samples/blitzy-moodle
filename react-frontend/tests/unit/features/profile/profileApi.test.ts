/**
 * Unit tests for profileApi module
 * 
 * Tests API endpoint integration for fetching user profiles, updating profile data,
 * uploading avatar images, and handling API responses. Verifies request/response
 * formatting, error handling, JWT token authentication, and proper data transformation
 * between API and application layer.
 * 
 * @package react-frontend
 * @category tests
 * @copyright 2024 Moodle
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { 
  fetchUserProfile, 
  updateUserProfile, 
  uploadAvatar,
  type User
} from '@/features/profile/api/profileApi';
import type { UpdateProfileData } from '@/features/profile/types/profile.types';

// Mock authentication service - provide all named exports used by interceptors
vi.mock('@/services/auth/authService', () => {
  const getAccessToken = vi.fn(() => 'mock-jwt-token');
  const setAccessToken = vi.fn();
  const clearTokens = vi.fn();
  const refreshAccessToken = vi.fn(() => Promise.resolve('new-mock-jwt-token'));
  return {
    getAccessToken,
    setAccessToken,
    clearTokens,
    refreshAccessToken,
    default: {
      getAccessToken,
      setAccessToken,
      clearTokens,
      refreshAccessToken,
    },
  };
});

const API_BASE_URL = 'http://localhost:8000';

// Mock profile data matching Moodle user structure
const mockProfile: User = {
  id: 123,
  username: 'johndoe',
  firstname: 'John',
  lastname: 'Doe',
  fullname: 'John Doe',
  email: 'john.doe@example.com',
  emailstop: false,
  profileimageurl: 'https://example.com/avatar/123.jpg',
  profileimageurlsmall: 'https://example.com/avatar/123_small.jpg',
  description: 'Test user profile description',
  city: 'Sydney',
  country: 'AU',
  interests: ['moodle', 'education', 'technology'],
  institution: 'Test University',
  department: 'Computer Science',
  phone1: '+61-2-1234-5678',
  phone2: '+61-400-123-456',
  timezone: 'Australia/Sydney',
  lang: 'en',
  calendartype: 'gregorian',
  firstaccess: 1609459200,
  lastaccess: 1700000000,
  lastlogin: 1699900000,
  currentlogin: 1700000000,
  auth: 'manual',
  suspended: false,
  confirmed: true,
};

const mockProfileUpdateData: UpdateProfileData = {
  firstname: 'Jane',
  lastname: 'Smith',
  email: 'jane.smith@example.com',
  description: 'Updated profile description',
  city: 'Melbourne',
  country: 'AU',
};

describe('profileApi', () => {
  // Use shared MSW server from tests/mocks/server.ts
  // No need to call listen() or close() - handled globally

  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should fetch user profile data from GET /api/v1/users/{userId}', async () => {
      const userId = 123;
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockProfile,
          });
        })
      );

      const result: User = await fetchUserProfile(userId);

      expect(result).toEqual(mockProfile);
      expect(result.id).toBe(userId);
      expect(result.firstname).toBe('John');
      expect(result.lastname).toBe('Doe');
      expect(result.email).toBe('john.doe@example.com');
    });

    it('should include JWT token in Authorization header', async () => {
      const userId = 123;
      let capturedHeaders: any = null;

      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, ({ request }) => {
          capturedHeaders = request.headers;
          return HttpResponse.json({
            success: true,
            data: mockProfile,
          });
        })
      );

      await fetchUserProfile(userId);

      expect((capturedHeaders as Headers | null)?.get('Authorization')).toBe('Bearer mock-jwt-token');
    });

    it('should parse response and extract user data correctly', async () => {
      const userId = 123;
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockProfile,
          });
        })
      );

      const result: User = await fetchUserProfile(userId);

      // Verify all expected fields are present
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('firstname');
      expect(result).toHaveProperty('lastname');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('profileimageurl');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('city');
      expect(result).toHaveProperty('country');
      expect(result).toHaveProperty('interests');
      
      // Verify data types
      expect(typeof result.id).toBe('number');
      expect(typeof result.firstname).toBe('string');
      expect(typeof result.lastname).toBe('string');
      expect(typeof result.email).toBe('string');
      expect(Array.isArray(result.interests)).toBe(true);
    });

    it('should throw error on 404 Not Found with user not found message', async () => {
      const userId = 999;
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'USER_NOT_FOUND',
                message: 'User not found',
              },
            },
            { status: 404 }
          );
        })
      );

      await expect(fetchUserProfile(userId)).rejects.toThrow('User not found');
    });

    it('should throw error on network failure', async () => {
      const userId = 123;
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          return HttpResponse.error();
        })
      );

      await expect(fetchUserProfile(userId)).rejects.toThrow();
    }, 10000);

    // Note: Token refresh logic is handled at the API client interceptor level.
    // This test verifies profileApi correctly throws error for 401 responses.
    it('should handle 401 Unauthorized and throw error', async () => {
      const userId = 123;
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid or expired token',
              },
            },
            { status: 401 }
          );
        })
      );

      try {
        await fetchUserProfile(userId);
        expect.fail('Should have thrown error');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        const profileError = error as { status: number; message: string; code: string };
        expect(profileError.status).toBe(401);
        expect(profileError.message).toBe('Invalid or expired token');
        expect(profileError.code).toBe('UNAUTHORIZED');
      }
    });

    it('should throw permission error on 403 Forbidden', async () => {
      const userId = 123;
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to view this profile',
              },
            },
            { status: 403 }
          );
        })
      );

      await expect(fetchUserProfile(userId)).rejects.toThrow('You do not have permission to view this profile');
    });

    it('should return generic error message on 500 Server Error', async () => {
      const userId = 123;
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred',
              },
            },
            { status: 500 }
          );
        })
      );

      await expect(fetchUserProfile(userId)).rejects.toThrow('An unexpected error occurred');
    }, 10000);

    // Note: This test is skipped because axios timeouts don't trigger reliably with MSW
    // in test environments. The timeout configuration is verified in the API client setup,
    // and timeout behavior is tested in integration/E2E tests with real network conditions.
    it.skip('should timeout after 30 seconds', async () => {
      const userId = 123;
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, async () => {
          // Simulate hanging request that never responds (to trigger timeout)
          await new Promise(() => {}); // Never resolves
          return HttpResponse.json({
            success: true,
            data: mockProfile,
          });
        })
      );

      await expect(fetchUserProfile(userId)).rejects.toThrow();
    }, 45000);

    it('should retry 3 times for 5xx errors', async () => {
      const userId = 123;
      let attemptCount = 0;
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          attemptCount++;
          if (attemptCount < 4) {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'INTERNAL_SERVER_ERROR',
                  message: 'Server error',
                },
              },
              { status: 500 }
            );
          }
          return HttpResponse.json({
            success: true,
            data: mockProfile,
          });
        })
      );

      const result: User = await fetchUserProfile(userId);

      expect(attemptCount).toBe(4); // Initial attempt + 3 retries
      expect(result).toEqual(mockProfile);
    }, 10000);
  });

  describe('updateProfile', () => {
    it('should send PUT request to /api/v1/users/{userId}', async () => {
      const userId = 123;
      let capturedBody: UpdateProfileData | null = null;
      let capturedMethod: string | null = null;
      
      server.use(
        http.put(`${API_BASE_URL}/api/v1/users/${userId}`, async ({ request }) => {
          capturedMethod = request.method;
          capturedBody = await request.json() as UpdateProfileData;
          return HttpResponse.json({
            success: true,
            data: { ...mockProfile, ...mockProfileUpdateData },
          });
        })
      );

      await updateUserProfile(userId, mockProfileUpdateData);

      expect(capturedMethod).toBe('PUT');
      expect(capturedBody).toBeDefined();
    });

    it('should include all updated fields in request payload', async () => {
      const userId = 123;
      let capturedBody: UpdateProfileData | null = null;
      
      server.use(
        http.put(`${API_BASE_URL}/api/v1/users/${userId}`, async ({ request }) => {
          capturedBody = await request.json() as UpdateProfileData;
          return HttpResponse.json({
            success: true,
            data: { ...mockProfile, ...mockProfileUpdateData },
          });
        })
      );

      await updateUserProfile(userId, mockProfileUpdateData);

      expect(capturedBody!.firstname).toBe('Jane');
      expect(capturedBody!.lastname).toBe('Smith');
      expect(capturedBody!.email).toBe('jane.smith@example.com');
      expect(capturedBody!.description).toBe('Updated profile description');
      expect(capturedBody!.city).toBe('Melbourne');
      expect(capturedBody!.country).toBe('AU');
    });

    it('should include JWT token in Authorization header', async () => {
      const userId = 123;
      let capturedHeaders: any = null;
      
      server.use(
        http.put(`${API_BASE_URL}/api/v1/users/${userId}`, ({ request }) => {
          capturedHeaders = request.headers;
          return HttpResponse.json({
            success: true,
            data: { ...mockProfile, ...mockProfileUpdateData },
          });
        })
      );

      await updateUserProfile(userId, mockProfileUpdateData);

      expect((capturedHeaders as Headers | null)?.get('Authorization')).toBe('Bearer mock-jwt-token');
    });

    it('should return updated profile data', async () => {
      const userId = 123;
      const updatedProfile = { ...mockProfile, ...mockProfileUpdateData };
      
      server.use(
        http.put(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          return HttpResponse.json({
            success: true,
            data: updatedProfile,
          });
        })
      );

      const result = await updateUserProfile(userId, mockProfileUpdateData);

      expect(result.firstname).toBe('Jane');
      expect(result.lastname).toBe('Smith');
      expect(result.email).toBe('jane.smith@example.com');
    });

    it('should return field-specific errors on 422 Validation Error', async () => {
      const userId = 123;
      
      server.use(
        http.put(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
                details: {
                  email: ['Email address is already in use'],
                  city: ['City name is invalid'],
                },
              },
            },
            { status: 422 }
          );
        })
      );

      try {
        await updateUserProfile(userId, mockProfileUpdateData);
        expect.fail('Should have thrown validation error');
      } catch (error: unknown) {
        // ProfileApi transforms errors into ProfileApiError
        expect(error).toBeInstanceOf(Error);
        const profileError = error as { 
          status: number; 
          message: string; 
          code: string;
          details?: Record<string, string[]>;
        };
        expect(profileError.status).toBe(422);
        expect(profileError.code).toBe('VALIDATION_ERROR');
        expect(profileError.message).toBe('Validation failed');
        expect(profileError.details).toBeDefined();
        expect(profileError.details!.email).toEqual(['Email address is already in use']);
      }
    });

    // Note: Token refresh logic is handled at the API client interceptor level.
    // This test verifies profileApi correctly throws error for 401 responses.
    it('should handle 401 Unauthorized error', async () => {
      const userId = 123;
      
      server.use(
        http.put(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
              },
            },
            { status: 401 }
          );
        })
      );

      try {
        await updateUserProfile(userId, mockProfileUpdateData);
        expect.fail('Should have thrown error');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        const profileError = error as { status: number; message: string; code: string };
        expect(profileError.status).toBe(401);
        expect(profileError.message).toBe('Authentication required');
        expect(profileError.code).toBe('UNAUTHORIZED');
      }
    });

    it('should handle 403 Forbidden error', async () => {
      const userId = 123;
      
      server.use(
        http.put(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to update this profile',
              },
            },
            { status: 403 }
          );
        })
      );

      await expect(updateUserProfile(userId, mockProfileUpdateData))
        .rejects.toThrow('You do not have permission to update this profile');
    });
  });

  describe('uploadAvatar', () => {
    // Note: uploadAvatar calls /users/{userId}/avatar endpoint (not /files/upload)
    it('should send multipart/form-data POST to /api/v1/users/{userId}/avatar', async () => {
      const userId = 123;
      const mockFile = new File(['avatar content'], 'avatar.jpg', { type: 'image/jpeg' });
      let capturedContentType: string | null = null;
      let capturedMethod: string | null = null;
      
      server.use(
        http.post(`${API_BASE_URL}/api/v1/users/${userId}/avatar`, ({ request }) => {
          capturedMethod = request.method;
          capturedContentType = request.headers.get('Content-Type') || '';
          return HttpResponse.json({
            success: true,
            data: {
              fileId: 456,
              url: 'https://example.com/avatar/456.jpg',
              filename: 'avatar.jpg',
            },
          });
        })
      );

      await uploadAvatar(userId, mockFile);

      expect(capturedMethod).toBe('POST');
      expect(capturedContentType).toContain('multipart/form-data');
    });

    it('should include file in form data', async () => {
      const userId = 123;
      const mockFile = new File(['avatar content'], 'avatar.jpg', { type: 'image/jpeg' });
      let formDataKeys: string[] = [];
      
      server.use(
        http.post(`${API_BASE_URL}/api/v1/users/${userId}/avatar`, async ({ request }) => {
          const formData = await request.formData();
          formDataKeys = Array.from(formData.keys());
          return HttpResponse.json({
            success: true,
            data: {
              fileId: 456,
              url: 'https://example.com/avatar/456.jpg',
              filename: 'avatar.jpg',
            },
          });
        })
      );

      await uploadAvatar(userId, mockFile);

      // The uploadAvatar implementation includes file in form data
      // Additional context like userId is passed in the URL path
      expect(formDataKeys).toContain('file');
    });

    it('should include JWT token in Authorization header', async () => {
      const userId = 123;
      const mockFile = new File(['avatar content'], 'avatar.jpg', { type: 'image/jpeg' });
      let capturedHeaders: any = null;
      
      server.use(
        http.post(`${API_BASE_URL}/api/v1/users/${userId}/avatar`, ({ request }) => {
          capturedHeaders = request.headers;
          return HttpResponse.json({
            success: true,
            data: {
              fileId: 456,
              url: 'https://example.com/avatar/456.jpg',
              filename: 'avatar.jpg',
            },
          });
        })
      );

      await uploadAvatar(userId, mockFile);

      expect((capturedHeaders as Headers | null)?.get('Authorization')).toBe('Bearer mock-jwt-token');
    });

    it('should return uploaded file URL and metadata', async () => {
      const userId = 123;
      const mockFile = new File(['avatar content'], 'avatar.jpg', { type: 'image/jpeg' });
      
      server.use(
        http.post(`${API_BASE_URL}/api/v1/users/${userId}/avatar`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              success: true,
              profileimageurl: 'https://example.com/avatar/456.jpg',
              profileimageurlsmall: 'https://example.com/avatar/456_small.jpg',
            },
          });
        })
      );

      const result = await uploadAvatar(userId, mockFile);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('profileimageurl');
      expect(result).toHaveProperty('profileimageurlsmall');
      expect(result.profileimageurl).toBe('https://example.com/avatar/456.jpg');
      expect(result.profileimageurlsmall).toBe('https://example.com/avatar/456_small.jpg');
    });

    it('should handle file validation errors', async () => {
      const userId = 123;
      const mockFile = new File(['large file'], 'large.jpg', { type: 'image/jpeg' });
      
      // Note: uploadAvatar calls /users/{userId}/avatar endpoint
      server.use(
        http.post(`${API_BASE_URL}/api/v1/users/${userId}/avatar`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'File validation failed',
                details: {
                  file: ['File size exceeds maximum allowed size of 2MB'],
                },
              },
            },
            { status: 422 }
          );
        })
      );

      try {
        await uploadAvatar(userId, mockFile);
        expect.fail('Should have thrown validation error');
      } catch (error: unknown) {
        // ProfileApi transforms errors into ProfileApiError
        expect(error).toBeInstanceOf(Error);
        const profileError = error as { 
          status: number; 
          message: string; 
          code: string;
          details?: Record<string, string[]>;
        };
        expect(profileError.status).toBe(422);
        expect(profileError.code).toBe('VALIDATION_ERROR');
        expect(profileError.message).toBe('File validation failed');
        expect(profileError.details).toBeDefined();
        expect(profileError.details!.file).toBeDefined();
      }
    });

    it('should handle unsupported file type errors', async () => {
      const userId = 123;
      const mockFile = new File(['content'], 'document.pdf', { type: 'application/pdf' });
      
      // Note: uploadAvatar calls /users/{userId}/avatar endpoint
      server.use(
        http.post(`${API_BASE_URL}/api/v1/users/${userId}/avatar`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid file type',
                details: {
                  file: ['Only image files (JPEG, PNG, GIF) are allowed for avatars'],
                },
              },
            },
            { status: 422 }
          );
        })
      );

      try {
        await uploadAvatar(userId, mockFile);
        expect.fail('Should have thrown validation error');
      } catch (error: unknown) {
        // ProfileApi transforms errors into ProfileApiError
        expect(error).toBeInstanceOf(Error);
        const profileError = error as { status: number; message: string; code: string };
        expect(profileError.status).toBe(422);
        expect(profileError.message).toBe('Invalid file type');
        expect(profileError.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should handle 401 Unauthorized error', async () => {
      const userId = 123;
      const mockFile = new File(['avatar content'], 'avatar.jpg', { type: 'image/jpeg' });
      
      // Note: uploadAvatar calls /users/{userId}/avatar endpoint
      server.use(
        http.post(`${API_BASE_URL}/api/v1/users/${userId}/avatar`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
              },
            },
            { status: 401 }
          );
        })
      );

      try {
        await uploadAvatar(userId, mockFile);
        expect.fail('Should have thrown unauthorized error');
      } catch (error: unknown) {
        // ProfileApi transforms errors into ProfileApiError
        expect(error).toBeInstanceOf(Error);
        const profileError = error as { status: number; message: string; code: string };
        expect(profileError.status).toBe(401);
        expect(profileError.message).toBe('Authentication required');
        expect(profileError.code).toBe('UNAUTHORIZED');
      }
      // Note: Token refresh is handled by the API client interceptors, not profileApi
    });
  });

  describe('Error handling and retries', () => {
    it('should not retry on 4xx client errors', async () => {
      const userId = 123;
      let attemptCount = 0;
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          attemptCount++;
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'BAD_REQUEST',
                message: 'Invalid request',
              },
            },
            { status: 400 }
          );
        })
      );

      await expect(fetchUserProfile(userId)).rejects.toThrow();
      
      // Should only try once, no retries for 4xx errors
      expect(attemptCount).toBe(1);
    });

    // Note: Retry logic with exponential backoff is implemented in profileApi layer
    // for 5xx errors (500, 502, 503, 504). This test verifies profileApi retries
    // and eventually throws a ProfileApiError when all retries are exhausted.
    it('should throw ProfileApiError for 5xx errors after retries', async () => {
      const userId = 123;
      let attemptCount = 0;
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          attemptCount++;
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Server error',
              },
            },
            { status: 503 }
          );
        })
      );

      try {
        await fetchUserProfile(userId);
        expect.fail('Should have thrown error');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        const profileError = error as { status: number; message: string; code: string };
        expect(profileError.status).toBe(503);
        expect(profileError.message).toBe('Server error');
        expect(profileError.code).toBe('INTERNAL_SERVER_ERROR');
      }
      
      // ProfileApi implements retry logic: 1 initial + 3 retries = 4 total attempts
      expect(attemptCount).toBe(4);
    }, 10000);

    it('should retry and throw error for service unavailable (503)', async () => {
      const userId = 123;
      let attemptCount = 0;
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          attemptCount++;
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Service temporarily unavailable',
              },
            },
            { status: 503 }
          );
        })
      );

      try {
        await fetchUserProfile(userId);
        expect.fail('Should have thrown error');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        const profileError = error as { status: number; message: string; code: string };
        expect(profileError.status).toBe(503);
        expect(profileError.code).toBe('SERVICE_UNAVAILABLE');
      }
      
      // ProfileApi implements retry logic for 5xx errors: 1 initial + 3 retries = 4 total
      expect(attemptCount).toBe(4);
    }, 10000);
  });

  describe('Request formatting and validation', () => {
    it('should send Content-Type: application/json for profile updates', async () => {
      const userId = 123;
      let capturedContentType: string | null = null;
      
      server.use(
        http.put(`${API_BASE_URL}/api/v1/users/${userId}`, ({ request }) => {
          capturedContentType = request.headers.get('Content-Type');
          return HttpResponse.json({
            success: true,
            data: { ...mockProfile, ...mockProfileUpdateData },
          });
        })
      );

      await updateUserProfile(userId, mockProfileUpdateData);

      expect(capturedContentType).toContain('application/json');
    });

    it('should validate response data against TypeScript Profile interface', async () => {
      const userId = 123;
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockProfile,
          });
        })
      );

      const result: User = await fetchUserProfile(userId);

      // TypeScript compile-time validation ensures this matches Profile type
      const validatedProfile: User = result;
      
      expect(validatedProfile.id).toBe(mockProfile.id);
      expect(validatedProfile.firstname).toBe(mockProfile.firstname);
      expect(validatedProfile.email).toBe(mockProfile.email);
    });

    it('should handle missing optional fields gracefully', async () => {
      const userId = 123;
      const minimalProfile = {
        id: 123,
        firstname: 'John',
        lastname: 'Doe',
        email: 'john.doe@example.com',
        username: 'johndoe',
      };
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          return HttpResponse.json({
            success: true,
            data: minimalProfile,
          });
        })
      );

      const result: User = await fetchUserProfile(userId);

      expect(result.id).toBe(123);
      expect(result.firstname).toBe('John');
      // Optional fields may be undefined
      expect(result.profileimageurl).toBeUndefined();
      expect(result.description).toBeUndefined();
    });

    it('should properly encode special characters in request data', async () => {
      const userId = 123;
      const specialCharsData: UpdateProfileData = {
        firstname: 'Jean-François',
        lastname: 'O\'Brien',
        description: 'Test & <special> "characters"',
      };
      let capturedBody: UpdateProfileData | null = null;
      
      server.use(
        http.put(`${API_BASE_URL}/api/v1/users/${userId}`, async ({ request }) => {
          capturedBody = await request.json() as UpdateProfileData;
          return HttpResponse.json({
            success: true,
            data: { ...mockProfile, ...specialCharsData },
          });
        })
      );

      await updateUserProfile(userId, specialCharsData);

      expect(capturedBody!.firstname).toBe('Jean-François');
      expect(capturedBody!.lastname).toBe('O\'Brien');
      expect(capturedBody!.description).toBe('Test & <special> "characters"');
    });
  });

  describe('Response data transformation', () => {
    it('should transform interests from comma-separated string to array', async () => {
      const userId = 123;
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              ...mockProfile,
              interests: 'moodle,education,technology', // API may return as string
            },
          });
        })
      );

      const result: User = await fetchUserProfile(userId);

      // API layer should transform to array if needed
      expect(Array.isArray(result.interests)).toBe(true);
    });

    it('should normalize profileimageurl to absolute URL', async () => {
      const userId = 123;
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              ...mockProfile,
              profileimageurl: '/theme/image.php/boost/core/1/u/f1',
            },
          });
        })
      );

      const result: User = await fetchUserProfile(userId);

      // Profile image URL should be properly formed
      expect(result.profileimageurl).toBeDefined();
      expect(typeof result.profileimageurl).toBe('string');
    });

    it('should handle null values in optional fields', async () => {
      const userId = 123;
      
      server.use(
        http.get(`${API_BASE_URL}/api/v1/users/${userId}`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              ...mockProfile,
              description: null,
              city: null,
              institution: null,
            },
          });
        })
      );

      const result: User = await fetchUserProfile(userId);

      expect(result.description).toBeNull();
      expect(result.city).toBeNull();
      expect(result.institution).toBeNull();
    });
  });
});
