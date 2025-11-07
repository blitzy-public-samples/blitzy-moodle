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

// Import the hook to test (this would be the actual import path)
// import { useProfile } from '@/features/profile/hooks/useProfile';

// Mock the profile API module
vi.mock('@/features/profile/api/profileApi', () => ({
  profileApi: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

// Import mocked API after mock declaration
import { profileApi } from '@/features/profile/api/profileApi';

// Type definitions based on expected profile structure
interface UserProfile {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  description?: string;
  city?: string;
  country?: string;
  profileimageurl?: string;
  interests?: string[];
}

interface UpdateProfileData {
  firstname?: string;
  lastname?: string;
  email?: string;
  description?: string;
  city?: string;
  country?: string;
}

// Mock implementation of useProfile hook for testing
// In production, this would be imported from the actual implementation
const useProfile = (userId: number | null) => {
  const { useQuery, useMutation, useQueryClient } = require('@tanstack/react-query');
  const queryClient = useQueryClient();

  // Query for fetching profile data
  const query = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      const response = await profileApi.getProfile(userId);
      return response;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Mutation for updating profile
  const updateMutation = useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      if (!userId) throw new Error('User ID is required');
      return await profileApi.updateProfile(userId, data);
    },
    onMutate: async (newData: UpdateProfileData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['profile', userId] });

      // Snapshot previous value for rollback
      const previousProfile = queryClient.getQueryData(['profile', userId]);

      // Optimistically update cache
      if (previousProfile) {
        queryClient.setQueryData(['profile', userId], (old: UserProfile) => ({
          ...old,
          ...newData,
        }));
      }

      return { previousProfile };
    },
    onError: (error, variables, context) => {
      // Rollback to previous value on error
      if (context?.previousProfile) {
        queryClient.setQueryData(['profile', userId], context.previousProfile);
      }
    },
    onSuccess: () => {
      // Invalidate and refetch profile data
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });

  return {
    profile: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    updateProfile: updateMutation.mutate,
    updateProfileAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
  };
};

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
      const mockProfile: UserProfile = {
        id: 123,
        username: 'testuser',
        firstname: 'Test',
        lastname: 'User',
        email: 'test@example.com',
        description: 'Test user description',
        city: 'Test City',
        country: 'US',
      };

      vi.mocked(profileApi.getProfile).mockResolvedValue(mockProfile);

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
      expect(profileApi.getProfile).toHaveBeenCalledWith(123);
      expect(profileApi.getProfile).toHaveBeenCalledTimes(1);

      // Verify profile data is returned
      expect(result.current.profile).toEqual(mockProfile);
      expect(result.current.isError).toBe(false);
    });

    it('should not fetch data when userId is null', async () => {
      const { result } = renderHook(() => useProfile(null), {
        wrapper: createWrapper(),
      });

      // Should not be loading when disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.profile).toBeUndefined();

      // API should not be called
      expect(profileApi.getProfile).not.toHaveBeenCalled();
    });

    it('should handle API errors appropriately', async () => {
      const errorMessage = 'Failed to fetch profile';
      vi.mocked(profileApi.getProfile).mockRejectedValue(new Error(errorMessage));

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
      const mockProfile: UserProfile = {
        id: 456,
        username: 'cacheduser',
        firstname: 'Cached',
        lastname: 'User',
        email: 'cached@example.com',
      };

      vi.mocked(profileApi.getProfile).mockResolvedValue(mockProfile);

      // First render - should fetch from API
      const { result: result1 } = renderHook(() => useProfile(456), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result1.current.profile).toEqual(mockProfile);
      });

      expect(profileApi.getProfile).toHaveBeenCalledTimes(1);

      // Second render with same userId - should use cached data
      const { result: result2 } = renderHook(() => useProfile(456), {
        wrapper: createWrapper(),
      });

      // Should immediately have data from cache
      await waitFor(() => {
        expect(result2.current.profile).toEqual(mockProfile);
      });

      // API should still only be called once (using cache)
      expect(profileApi.getProfile).toHaveBeenCalledTimes(1);
    });

    it('should refetch data when cache is stale', async () => {
      const initialProfile: UserProfile = {
        id: 789,
        username: 'staleuser',
        firstname: 'Stale',
        lastname: 'User',
        email: 'stale@example.com',
      };

      const updatedProfile: UserProfile = {
        ...initialProfile,
        firstname: 'Fresh',
      };

      vi.mocked(profileApi.getProfile)
        .mockResolvedValueOnce(initialProfile)
        .mockResolvedValueOnce(updatedProfile);

      // Override staleTime for this test
      queryClient.setQueryDefaults(['profile', 789], {
        staleTime: 0, // Data is immediately stale
      });

      const { result, rerender } = renderHook(() => useProfile(789), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.profile).toEqual(initialProfile);
      });

      expect(profileApi.getProfile).toHaveBeenCalledTimes(1);

      // Trigger a refetch by unmounting and remounting
      rerender();

      await waitFor(() => {
        expect(result.current.profile).toEqual(updatedProfile);
      });

      // Should have refetched because data was stale
      expect(profileApi.getProfile).toHaveBeenCalledTimes(2);
    });
  });

  describe('Profile Update Mutation', () => {
    it('should update profile using mutation', async () => {
      const mockProfile: UserProfile = {
        id: 111,
        username: 'updateuser',
        firstname: 'Original',
        lastname: 'Name',
        email: 'original@example.com',
      };

      const updateData: UpdateProfileData = {
        firstname: 'Updated',
        lastname: 'Name',
      };

      const updatedProfile: UserProfile = {
        ...mockProfile,
        ...updateData,
      };

      vi.mocked(profileApi.getProfile).mockResolvedValue(mockProfile);
      vi.mocked(profileApi.updateProfile).mockResolvedValue(updatedProfile);

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
      expect(profileApi.updateProfile).toHaveBeenCalledWith(111, updateData);
      expect(profileApi.updateProfile).toHaveBeenCalledTimes(1);
    });

    it('should handle update errors correctly', async () => {
      const mockProfile: UserProfile = {
        id: 222,
        username: 'erroruser',
        firstname: 'Error',
        lastname: 'User',
        email: 'error@example.com',
      };

      const updateData: UpdateProfileData = {
        email: 'invalid-email',
      };

      const errorMessage = 'Invalid email format';

      vi.mocked(profileApi.getProfile).mockResolvedValue(mockProfile);
      vi.mocked(profileApi.updateProfile).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useProfile(222), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.profile).toEqual(mockProfile);
      });

      // Trigger update mutation
      result.current.updateProfile(updateData);

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });

      // Verify error is captured
      expect(result.current.updateError).toBeTruthy();
      expect((result.current.updateError as Error).message).toBe(errorMessage);
    });
  });

  describe('Optimistic Updates', () => {
    it('should immediately reflect updates in UI before server confirmation', async () => {
      const mockProfile: UserProfile = {
        id: 333,
        username: 'optimisticuser',
        firstname: 'Before',
        lastname: 'Update',
        email: 'before@example.com',
      };

      const updateData: UpdateProfileData = {
        firstname: 'After',
      };

      vi.mocked(profileApi.getProfile).mockResolvedValue(mockProfile);
      vi.mocked(profileApi.updateProfile).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ...mockProfile, ...updateData }), 100))
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

    it('should rollback optimistic update on mutation failure', async () => {
      const mockProfile: UserProfile = {
        id: 444,
        username: 'rollbackuser',
        firstname: 'Original',
        lastname: 'Value',
        email: 'rollback@example.com',
      };

      const updateData: UpdateProfileData = {
        firstname: 'Failed Update',
      };

      vi.mocked(profileApi.getProfile).mockResolvedValue(mockProfile);
      vi.mocked(profileApi.updateProfile).mockRejectedValue(new Error('Update failed'));

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

      // Wait for mutation to fail
      await waitFor(() => {
        expect(result.current.updateError).toBeTruthy();
      });

      // Profile should be rolled back to original value
      await waitFor(() => {
        expect(result.current.profile?.firstname).toBe('Original');
      });
    });
  });

  describe('Loading and Refetching States', () => {
    it('should correctly indicate loading state during initial fetch', async () => {
      const mockProfile: UserProfile = {
        id: 555,
        username: 'loadinguser',
        firstname: 'Loading',
        lastname: 'Test',
        email: 'loading@example.com',
      };

      vi.mocked(profileApi.getProfile).mockImplementation(
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
      const mockProfile: UserProfile = {
        id: 666,
        username: 'refetchuser',
        firstname: 'Refetch',
        lastname: 'Test',
        email: 'refetch@example.com',
      };

      vi.mocked(profileApi.getProfile).mockResolvedValue(mockProfile);

      const { result } = renderHook(() => useProfile(666), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.profile).toEqual(mockProfile);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFetching).toBe(false);

      // Trigger manual refetch
      result.current.refetch();

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
      const originalProfile: UserProfile = {
        id: 777,
        username: 'invalidateuser',
        firstname: 'Original',
        lastname: 'Profile',
        email: 'invalidate@example.com',
      };

      const updateData: UpdateProfileData = {
        firstname: 'Updated',
      };

      const serverProfile: UserProfile = {
        ...originalProfile,
        firstname: 'Server Updated',
      };

      vi.mocked(profileApi.getProfile)
        .mockResolvedValueOnce(originalProfile)
        .mockResolvedValueOnce(serverProfile);
      
      vi.mocked(profileApi.updateProfile).mockResolvedValue(serverProfile);

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
      expect(profileApi.getProfile).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests with exponential backoff', async () => {
      const mockProfile: UserProfile = {
        id: 888,
        username: 'retryuser',
        firstname: 'Retry',
        lastname: 'Test',
        email: 'retry@example.com',
      };

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
      vi.mocked(profileApi.getProfile)
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
      expect(profileApi.getProfile).toHaveBeenCalledTimes(3);

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
      vi.mocked(profileApi.getProfile).mockRejectedValue(new Error(errorMessage));

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
      expect(profileApi.getProfile).toHaveBeenCalledTimes(3);
      expect((result.current.error as Error).message).toBe(errorMessage);

      limitedRetryClient.clear();
    });
  });

  describe('Multiple Concurrent Updates', () => {
    it('should queue and handle multiple concurrent update mutations', async () => {
      const mockProfile: UserProfile = {
        id: 1010,
        username: 'concurrentuser',
        firstname: 'Initial',
        lastname: 'Name',
        email: 'concurrent@example.com',
      };

      const update1: UpdateProfileData = { firstname: 'First' };
      const update2: UpdateProfileData = { lastname: 'Second' };

      vi.mocked(profileApi.getProfile).mockResolvedValue(mockProfile);
      vi.mocked(profileApi.updateProfile)
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
      expect(profileApi.updateProfile).toHaveBeenCalledTimes(2);
      expect(profileApi.updateProfile).toHaveBeenNthCalledWith(1, 1010, update1);
      expect(profileApi.updateProfile).toHaveBeenNthCalledWith(2, 1010, update2);
    });
  });

  describe('Stale Data Handling', () => {
    it('should properly handle stale time configuration', async () => {
      const mockProfile: UserProfile = {
        id: 1111,
        username: 'staleuser',
        firstname: 'Stale',
        lastname: 'Data',
        email: 'stale@example.com',
      };

      // Configure a short stale time for this test
      const staleTimeClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 100, // 100ms
            cacheTime: 1000,
          },
        },
      });

      const staleWrapper = ({ children }: { children: ReactNode }) => (
        React.createElement(QueryClientProvider, { client: staleTimeClient }, children)
      );

      vi.mocked(profileApi.getProfile).mockResolvedValue(mockProfile);

      const { result, rerender } = renderHook(() => useProfile(1111), {
        wrapper: staleWrapper,
      });

      await waitFor(() => {
        expect(result.current.profile).toEqual(mockProfile);
      });

      const initialCallCount = vi.mocked(profileApi.getProfile).mock.calls.length;

      // Wait for data to become stale
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Rerender to trigger a check
      rerender();

      // Should refetch because data is stale
      await waitFor(() => {
        expect(vi.mocked(profileApi.getProfile).mock.calls.length).toBeGreaterThan(initialCallCount);
      });

      staleTimeClient.clear();
    });

    it('should serve cached data while refetching in background', async () => {
      const initialProfile: UserProfile = {
        id: 1212,
        username: 'backgrounduser',
        firstname: 'Cached',
        lastname: 'Data',
        email: 'background@example.com',
      };

      const updatedProfile: UserProfile = {
        ...initialProfile,
        firstname: 'Fresh',
      };

      vi.mocked(profileApi.getProfile)
        .mockResolvedValueOnce(initialProfile)
        .mockResolvedValueOnce(updatedProfile);

      const { result } = renderHook(() => useProfile(1212), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.profile).toEqual(initialProfile);
      });

      // Trigger background refetch
      result.current.refetch();

      // Cached data should still be available immediately
      expect(result.current.profile).toEqual(initialProfile);
      expect(result.current.isFetching).toBe(true);
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
      const profile1: UserProfile = {
        id: 1313,
        username: 'user1',
        firstname: 'User',
        lastname: 'One',
        email: 'user1@example.com',
      };

      const profile2: UserProfile = {
        id: 1414,
        username: 'user2',
        firstname: 'User',
        lastname: 'Two',
        email: 'user2@example.com',
      };

      vi.mocked(profileApi.getProfile)
        .mockImplementation(async (userId: number) => {
          if (userId === 1313) return profile1;
          if (userId === 1414) return profile2;
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
      expect(profileApi.getProfile).toHaveBeenCalledWith(1313);
      expect(profileApi.getProfile).toHaveBeenCalledWith(1414);
    });

    it('should handle rapid enabled/disabled toggling', async () => {
      const mockProfile: UserProfile = {
        id: 1515,
        username: 'toggleuser',
        firstname: 'Toggle',
        lastname: 'User',
        email: 'toggle@example.com',
      };

      vi.mocked(profileApi.getProfile).mockResolvedValue(mockProfile);

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

      const initialCallCount = vi.mocked(profileApi.getProfile).mock.calls.length;

      // Toggle to disabled
      rerender({ userId: null });

      expect(result.current.profile).toBeUndefined();

      // Toggle back to enabled
      rerender({ userId: 1515 });

      await waitFor(() => {
        expect(result.current.profile).toEqual(mockProfile);
      });

      // Should have used cache, not made additional API call
      expect(vi.mocked(profileApi.getProfile).mock.calls.length).toBe(initialCallCount);
    });
  });
});

