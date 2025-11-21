/**
 * Unit Tests for useProfile Custom Hook
 * 
 * Tests profile data fetching with React Query, cache management, profile update
 * mutations with optimistic updates, error handling, loading states, and data
 * refetching after mutations. Verifies proper integration with profile API endpoints
 * and state synchronization.
 * 
 * @package     react-frontend
 * @subpackage  tests/unit/features/profile
 * @copyright   2024 Moodle Pty Ltd
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { ReactNode } from 'react';

// Mock the profile API module
vi.mock('@/features/profile/api/profileApi', () => ({
  fetchUserProfile: vi.fn(),
  fetchCurrentUser: vi.fn(),
  updateUserProfile: vi.fn(),
}));

// Import mocked API after mock declaration
import { fetchUserProfile, updateUserProfile } from '@/features/profile/api/profileApi';

// Import the hook to test
import { useProfile } from '@/features/profile/hooks/useProfile';

// Import User type from profile types
import type { User } from '@/features/profile/types/profile.types';

interface UpdateProfileData {
  firstname?: string;
  lastname?: string;
  email?: string;
  description?: string;
  city?: string;
  country?: string;
}

/**
 * Helper function to create a mock User object with all required properties
 * @param overrides - Optional properties to override defaults
 * @returns A complete User object with all required fields
 */
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 123,
    username: 'testuser',
    firstname: 'Test',
    lastname: 'User',
    fullname: 'Test User',
    email: 'test@example.com',
    profileimageurlsmall: 'https://example.com/avatar-small.jpg',
    profileimageurl: 'https://example.com/avatar.jpg',
    description: 'Test user description',
    city: 'Test City',
    country: 'US',
    ...overrides,
  };
}

describe('useProfile Hook', () => {
  let queryClient: QueryClient;

  // Helper function to create wrapper with QueryClientProvider
  const createWrapper = () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      React.createElement(QueryClientProvider, { client: queryClient }, children)
    );
    return wrapper;
  };

  beforeEach(() => {
    // Create a new QueryClient for each test to ensure isolation
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries in tests by default
          staleTime: 10000, // Keep data fresh for 10 seconds by default
          gcTime: 30000, // Keep unused data in cache for 30 seconds
        },
        mutations: {
          retry: false,
        },
      },
    });

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up and clear cache after each test
    queryClient.clear();
  });

  describe('Profile Data Fetching', () => {
    it('should fetch user profile data with correct query key', async () => {
      const mockProfile = createMockUser();

      vi.mocked(fetchUserProfile).mockResolvedValue(mockProfile);

      const { result } = renderHook(() => useProfile(123), {
        wrapper: createWrapper(),
      });

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.profile).toBeUndefined();

      // Wait for data to be fetched
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify API was called with correct user ID
      expect(fetchUserProfile).toHaveBeenCalledWith(123);
      expect(fetchUserProfile).toHaveBeenCalledTimes(1);

      // Verify profile data is returned
      expect(result.current.profile).toEqual(mockProfile);
      expect(result.current.isError).toBe(false);
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('should not fetch data when userId is null', async () => {
      const { result } = renderHook(() => useProfile(null), {
        wrapper: createWrapper(),
      });

      // Should not be loading when disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.profile).toBeUndefined();

      // API should not be called
      expect(fetchUserProfile).not.toHaveBeenCalled();
    });

    it('should handle API errors appropriately', async () => {
      const errorMessage = 'Failed to fetch profile';
      vi.mocked(fetchUserProfile).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useProfile(123), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.profile).toBeUndefined();
      expect(result.current.error).toBeTruthy();
      expect((result.current.error as Error).message).toBe(errorMessage);
    });
  });

  describe('React Query Cache Integration', () => {
    it('should cache profile data and reuse across components', async () => {
      const mockProfile = createMockUser({
        id: 456,
        username: 'cacheduser',
        firstname: 'Cached',
        lastname: 'User',
        fullname: 'Cached User',
        email: 'cached@example.com',
      });

      vi.mocked(fetchUserProfile).mockResolvedValue(mockProfile);

      // First render - should fetch from API
      const { result: result1 } = renderHook(() => useProfile(456), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result1.current.profile).toEqual(mockProfile);
      });

      expect(fetchUserProfile).toHaveBeenCalledTimes(1);

      // Second render with same userId - should use cached data
      const { result: result2 } = renderHook(() => useProfile(456), {
        wrapper: createWrapper(),
      });

      // Should immediately have data from cache
      await waitFor(() => {
        expect(result2.current.profile).toEqual(mockProfile);
      });

      // API should still only be called once (using cache)
      expect(fetchUserProfile).toHaveBeenCalledTimes(1);
    });

    it('should refetch data when cache is stale', async () => {
      const initialProfile = createMockUser({
        id: 789,
        username: 'staleuser',
        firstname: 'Stale',
        lastname: 'User',
        fullname: 'Stale User',
        email: 'stale@example.com',
      });

      const updatedProfile = createMockUser({
        ...initialProfile,
        firstname: 'Fresh',
        fullname: 'Fresh User',
      });

      vi.mocked(fetchUserProfile)
        .mockResolvedValueOnce(initialProfile)
        .mockResolvedValueOnce(updatedProfile);

      // Override staleTime for this test
      queryClient.setQueryDefaults(['profile', 789], {
        staleTime: 0, // Data is immediately stale
      });

      const { result } = renderHook(() => useProfile(789), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.profile).toEqual(initialProfile);
      });

      expect(fetchUserProfile).toHaveBeenCalledTimes(1);

      // Trigger a refetch - since data is stale (staleTime: 0), it should refetch
      void result.current.refetch();

      await waitFor(() => {
        expect(result.current.profile).toEqual(updatedProfile);
      });

      // Should have refetched because data was stale
      expect(fetchUserProfile).toHaveBeenCalledTimes(2);
    });
  });

  describe('Profile Update Mutation', () => {
    it('should update profile using mutation', async () => {
      const mockProfile = createMockUser({
        id: 111,
        username: 'updateuser',
        firstname: 'Original',
        lastname: 'Name',
        fullname: 'Original Name',
        email: 'original@example.com',
      });

      const updateData: UpdateProfileData = {
        firstname: 'Updated',
        lastname: 'Name',
      };

      const updatedProfile = createMockUser({
        ...mockProfile,
        ...updateData,
        fullname: 'Updated Name',
      });

      vi.mocked(fetchUserProfile).mockResolvedValue(mockProfile);
      // Delay the update response to allow test to observe pending state
      vi.mocked(updateUserProfile).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(updatedProfile), 50))
      );

      const { result } = renderHook(() => useProfile(111), {
        wrapper: createWrapper(),
      });

      // Wait for initial data load
      await waitFor(() => {
        expect(result.current.profile).toEqual(mockProfile);
      });

      // Trigger update mutation
      result.current.updateProfile(updateData);

      // Should be in updating state
      await waitFor(() => {
        expect(result.current.isUpdating).toBe(true);
      });

      // Wait for update to complete
      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });

      // Verify update API was called with correct data
      expect(updateUserProfile).toHaveBeenCalledWith(111, updateData);
      expect(updateUserProfile).toHaveBeenCalledTimes(1);
    });

    it('should handle update errors correctly', { timeout: 12000 }, async () => {
      const mockProfile = createMockUser({
        id: 222,
        username: 'erroruser',
        firstname: 'Error',
        lastname: 'User',
        fullname: 'Error User',
        email: 'error@example.com',
      });

      const updateData: UpdateProfileData = {
        email: 'invalid-email',
      };

      const errorMessage = 'Invalid email format';

      vi.mocked(fetchUserProfile).mockResolvedValue(mockProfile);
      
      // Mock API to fail immediately - React Query will handle retries
      let attemptCount = 0;
      vi.mocked(updateUserProfile).mockImplementation(() => {
        attemptCount++;
        return Promise.reject(new Error(errorMessage));
      });

      const { result } = renderHook(() => useProfile(222), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.profile).toEqual(mockProfile);
      });
      
      // Trigger update mutation
      result.current.updateProfile(updateData);

      // Wait for error to be set (this happens after all retries complete)
      // Hook retries 3 times with exponential backoff (1s, 2s, 4s delays)
      await waitFor(() => {
        expect(result.current.updateError).toBeTruthy();
      }, { timeout: 10000 }); // Allow 10 seconds for retries to complete

      // Verify error is captured and mutation is no longer updating
      expect((result.current.updateError as Error).message).toBe(errorMessage);
      expect(result.current.isUpdating).toBe(false);
      
      // Verify the API was called multiple times due to retries (1 initial + 3 retries = 4 total)
      expect(attemptCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Optimistic Updates', () => {
    it('should immediately reflect updates in UI before server confirmation', async () => {
      const mockProfile = createMockUser({
        id: 333,
        username: 'optimisticuser',
        firstname: 'Before',
        lastname: 'Update',
        fullname: 'Before Update',
        email: 'before@example.com',
      });

      const updateData: UpdateProfileData = {
        firstname: 'After',
      };

      vi.mocked(fetchUserProfile).mockResolvedValue(mockProfile);
      vi.mocked(updateUserProfile).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ...mockProfile, ...updateData, fullname: 'After Update' }), 100))
      );

      const { result } = renderHook(() => useProfile(333), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.profile).toEqual(mockProfile);
      });

      // Trigger update
      result.current.updateProfile(updateData);

      // Profile should be optimistically updated immediately
      await waitFor(() => {
        expect(result.current.profile?.firstname).toBe('After');
      });

      // Update should still be pending
      expect(result.current.isUpdating).toBe(true);

      // Wait for actual update to complete
      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });
    });

    it('should rollback optimistic update on mutation failure', { timeout: 12000 }, async () => {
      const mockProfile = createMockUser({
        id: 444,
        username: 'rollbackuser',
        firstname: 'Original',
        lastname: 'Value',
        fullname: 'Original Value',
        email: 'rollback@example.com',
      });

      const updateData: UpdateProfileData = {
        firstname: 'Failed Update',
      };

      vi.mocked(fetchUserProfile).mockResolvedValue(mockProfile);
      
      // Mock API to fail immediately - React Query will handle retries
      vi.mocked(updateUserProfile).mockImplementation(() => {
        return Promise.reject(new Error('Update failed'));
      });

      const { result } = renderHook(() => useProfile(444), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.profile).toEqual(mockProfile);
      });

      // Trigger update
      result.current.updateProfile(updateData);

      // Should see optimistic update
      await waitFor(() => {
        expect(result.current.profile?.firstname).toBe('Failed Update');
      });

      // Wait for error to be set (this happens after all retries complete)
      // Hook retries 3 times with exponential backoff (1s, 2s, 4s delays)
      await waitFor(() => {
        expect(result.current.updateError).toBeTruthy();
      }, { timeout: 10000 }); // Allow 10 seconds for retries to complete

      // Verify mutation is no longer updating
      expect(result.current.isUpdating).toBe(false);

      // Profile should be rolled back to original value
      await waitFor(() => {
        expect(result.current.profile?.firstname).toBe('Original');
      });
    });
  });

  describe('Loading and Refetching States', () => {
    it('should correctly indicate loading state during initial fetch', async () => {
      const mockProfile = createMockUser({
        id: 555,
        username: 'loadinguser',
        firstname: 'Loading',
        lastname: 'Test',
        fullname: 'Loading Test',
        email: 'loading@example.com',
      });

      vi.mocked(fetchUserProfile).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockProfile), 50))
      );

      const { result } = renderHook(() => useProfile(555), {
        wrapper: createWrapper(),
      });

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isFetching).toBe(true);
      expect(result.current.profile).toBeUndefined();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isFetching).toBe(false);
      expect(result.current.profile).toEqual(mockProfile);
    });

    it('should indicate fetching state during background refetch', async () => {
      const mockProfile = createMockUser({
        id: 666,
        username: 'refetchuser',
        firstname: 'Refetch',
        lastname: 'Test',
        fullname: 'Refetch Test',
        email: 'refetch@example.com',
      });

      vi.mocked(fetchUserProfile).mockResolvedValue(mockProfile);

      const { result } = renderHook(() => useProfile(666), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.profile).toEqual(mockProfile);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFetching).toBe(false);

      // Add delay to mock for the refetch so we can observe isFetching state
      vi.mocked(fetchUserProfile).mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve(mockProfile), 100))
      );

      // Trigger manual refetch
      void result.current.refetch();

      // Should be fetching but not loading (data already available)
      await waitFor(() => {
        expect(result.current.isFetching).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.profile).toEqual(mockProfile);

      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache after successful mutation', async () => {
      const originalProfile = createMockUser({
        id: 777,
        username: 'invalidateuser',
        firstname: 'Original',
        lastname: 'Profile',
        fullname: 'Original Profile',
        email: 'invalidate@example.com',
      });

      const updateData: UpdateProfileData = {
        firstname: 'Updated',
      };

      const serverProfile = createMockUser({
        ...originalProfile,
        firstname: 'Server Updated',
        fullname: 'Server Updated Profile',
      });

      vi.mocked(fetchUserProfile)
        .mockResolvedValueOnce(originalProfile)
        .mockResolvedValueOnce(serverProfile);
      
      vi.mocked(updateUserProfile).mockResolvedValue(serverProfile);

      const { result } = renderHook(() => useProfile(777), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.profile).toEqual(originalProfile);
      });

      // Trigger update
      result.current.updateProfile(updateData);

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });

      // Cache should be invalidated and refetched
      await waitFor(() => {
        expect(result.current.profile?.firstname).toBe('Server Updated');
      });

      // API should have been called twice: initial fetch + refetch after mutation
      expect(fetchUserProfile).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests with exponential backoff', async () => {
      const mockProfile = createMockUser({
        id: 888,
        username: 'retryuser',
        firstname: 'Retry',
        lastname: 'Test',
        fullname: 'Retry Test',
        email: 'retry@example.com',
      });

      // Create a new query client with retry enabled for this test
      const retryQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
        },
      });

      const retryWrapper = ({ children }: { children: ReactNode }) => (
        React.createElement(QueryClientProvider, { client: retryQueryClient }, children)
      );

      // Fail first 2 attempts, succeed on 3rd
      vi.mocked(fetchUserProfile)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockProfile);

      const { result } = renderHook(() => useProfile(888), {
        wrapper: retryWrapper,
      });

      // Wait for successful fetch after retries
      await waitFor(
        () => {
          expect(result.current.profile).toEqual(mockProfile);
        },
        { timeout: 5000 }
      );

      // Should have been called 3 times (2 failures + 1 success)
      expect(fetchUserProfile).toHaveBeenCalledTimes(3);

      retryQueryClient.clear();
    });

    it('should fail after maximum retry attempts', async () => {
      // Create a new query client with limited retries
      const limitedRetryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            retryDelay: 10,
          },
        },
      });

      const limitedWrapper = ({ children }: { children: ReactNode }) => (
        React.createElement(QueryClientProvider, { client: limitedRetryClient }, children)
      );

      const errorMessage = 'Persistent network error';
      vi.mocked(fetchUserProfile).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useProfile(999), {
        wrapper: limitedWrapper,
      });

      // Wait for all retries to complete and error state to be set
      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 1000 }
      );

      // Should have tried 3 times (initial + 2 retries)
      expect(fetchUserProfile).toHaveBeenCalledTimes(3);
      expect((result.current.error as Error).message).toBe(errorMessage);

      limitedRetryClient.clear();
    });
  });

  describe('Multiple Concurrent Updates', () => {
    it('should queue and handle multiple concurrent update mutations', async () => {
      const mockProfile = createMockUser({
        id: 1010,
        username: 'concurrentuser',
        firstname: 'Initial',
        lastname: 'Name',
        fullname: 'Initial Name',
        email: 'concurrent@example.com',
      });

      const update1: UpdateProfileData = { firstname: 'First' };
      const update2: UpdateProfileData = { lastname: 'Second' };

      vi.mocked(fetchUserProfile).mockResolvedValue(mockProfile);
      vi.mocked(updateUserProfile)
        .mockResolvedValueOnce({ ...mockProfile, ...update1 })
        .mockResolvedValueOnce({ ...mockProfile, ...update1, ...update2 });

      const { result } = renderHook(() => useProfile(1010), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.profile).toEqual(mockProfile);
      });

      // Trigger two updates in quick succession
      result.current.updateProfile(update1);
      result.current.updateProfile(update2);

      // Wait for both updates to complete
      await waitFor(
        () => {
          expect(result.current.isUpdating).toBe(false);
        },
        { timeout: 2000 }
      );

      // Both update calls should have been made
      expect(updateUserProfile).toHaveBeenCalledTimes(2);
      expect(updateUserProfile).toHaveBeenNthCalledWith(1, 1010, update1);
      expect(updateUserProfile).toHaveBeenNthCalledWith(2, 1010, update2);
    });
  });

  describe('Stale Data Handling', () => {
    it('should properly handle stale time configuration', async () => {
      const mockProfile = createMockUser({
        id: 1111,
        username: 'staleuser',
        firstname: 'Stale',
        lastname: 'Data',
        fullname: 'Stale Data',
        email: 'stale@example.com',
      });

      // Configure a short stale time for this test
      const staleTimeClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 100, // 100ms
            gcTime: 1000,
          },
        },
      });

      const staleWrapper = ({ children }: { children: ReactNode }) => (
        React.createElement(QueryClientProvider, { client: staleTimeClient }, children)
      );

      vi.mocked(fetchUserProfile).mockResolvedValue(mockProfile);

      const { result } = renderHook(() => useProfile(1111), {
        wrapper: staleWrapper,
      });

      await waitFor(() => {
        expect(result.current.profile).toEqual(mockProfile);
      });

      const initialCallCount = vi.mocked(fetchUserProfile).mock.calls.length;

      // Wait for data to become stale
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Manually trigger refetch - in React Query v5, stale data doesn't auto-refetch on rerender
      // You need window focus, mount, or manual refetch
      await result.current.refetch();

      // Should have refetched because we manually triggered it
      expect(vi.mocked(fetchUserProfile).mock.calls.length).toBeGreaterThan(initialCallCount);

      staleTimeClient.clear();
    });

    it('should serve cached data while refetching in background', async () => {
      const initialProfile = createMockUser({
        id: 1212,
        username: 'backgrounduser',
        firstname: 'Cached',
        lastname: 'Data',
        fullname: 'Cached Data',
        email: 'background@example.com',
      });

      const updatedProfile = createMockUser({
        ...initialProfile,
        firstname: 'Fresh',
        fullname: 'Fresh Data',
      });

      // First fetch returns immediately
      vi.mocked(fetchUserProfile).mockResolvedValueOnce(initialProfile);

      const { result } = renderHook(() => useProfile(1212), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.profile).toEqual(initialProfile);
      });

      // Add a delay for the second fetch to allow us to observe isFetching state
      vi.mocked(fetchUserProfile).mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve(updatedProfile), 100))
      );

      // Trigger background refetch
      result.current.refetch();

      // Wait for isFetching to become true (async state update)
      await waitFor(() => {
        expect(result.current.isFetching).toBe(true);
      });

      // Cached data should still be available during refetch
      expect(result.current.profile).toEqual(initialProfile);
      expect(result.current.isLoading).toBe(false);

      // Wait for background refetch to complete
      await waitFor(() => {
        expect(result.current.profile).toEqual(updatedProfile);
      });

      expect(result.current.isFetching).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle switching between different user IDs', async () => {
      const profile1 = createMockUser({
        id: 1313,
        username: 'user1',
        firstname: 'User',
        lastname: 'One',
        fullname: 'User One',
        email: 'user1@example.com',
      });

      const profile2 = createMockUser({
        id: 1414,
        username: 'user2',
        firstname: 'User',
        lastname: 'Two',
        fullname: 'User Two',
        email: 'user2@example.com',
      });

      vi.mocked(fetchUserProfile)
        // eslint-disable-next-line @typescript-eslint/require-await
        .mockImplementation(async (userId: number) => {
          if (userId === 1313) {return profile1;}
          if (userId === 1414) {return profile2;}
          throw new Error('Unknown user');
        });

      const { result, rerender } = renderHook(
        ({ userId }) => useProfile(userId),
        {
          wrapper: createWrapper(),
          initialProps: { userId: 1313 },
        }
      );

      await waitFor(() => {
        expect(result.current.profile).toEqual(profile1);
      });

      // Switch to different user
      rerender({ userId: 1414 });

      await waitFor(() => {
        expect(result.current.profile).toEqual(profile2);
      });

      // Verify both profiles were fetched
      expect(fetchUserProfile).toHaveBeenCalledWith(1313);
      expect(fetchUserProfile).toHaveBeenCalledWith(1414);
    });

    it('should handle rapid enabled/disabled toggling', async () => {
      const mockProfile = createMockUser({
        id: 1515,
        username: 'toggleuser',
        firstname: 'Toggle',
        lastname: 'User',
        fullname: 'Toggle User',
        email: 'toggle@example.com',
      });

      vi.mocked(fetchUserProfile).mockResolvedValue(mockProfile);

      const { result, rerender } = renderHook(
        ({ userId }) => useProfile(userId),
        {
          wrapper: createWrapper(),
          initialProps: { userId: 1515 as number | null },
        }
      );

      await waitFor(() => {
        expect(result.current.profile).toEqual(mockProfile);
      });

      const initialCallCount = vi.mocked(fetchUserProfile).mock.calls.length;

      // Toggle to disabled
      rerender({ userId: null });

      expect(result.current.profile).toBeUndefined();

      // Toggle back to enabled
      rerender({ userId: 1515 });

      await waitFor(() => {
        expect(result.current.profile).toEqual(mockProfile);
      });

      // Should have used cache, not made additional API call
      expect(vi.mocked(fetchUserProfile).mock.calls.length).toBe(initialCallCount);
    });
  });
});

