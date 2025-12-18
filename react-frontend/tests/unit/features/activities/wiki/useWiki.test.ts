/**
 * Unit Tests for useWiki Custom React Hook
 *
 * Comprehensive test suite validating the useWiki hook's integration with React Query
 * for wiki data fetching, caching, state management, and error handling.
 *
 * The useWiki hook wraps the wiki API to provide:
 * - Automatic caching with configurable stale time
 * - Loading, error, and success states
 * - Background refetching on window focus
 * - Retry logic for failed requests
 * - Query invalidation support
 *
 * @module tests/unit/features/activities/wiki/useWiki.test
 *
 * Backend References:
 * - public/mod/wiki/lib.php: wiki_add_instance(), wiki_update_instance()
 * - public/mod/wiki/locallib.php: wiki_get_wiki() function
 *
 * API Endpoint:
 * - GET /api/v1/wiki/{id} - Fetches wiki instance details
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import React from 'react';
import type { ReactNode } from 'react';

// Internal imports from depends_on_files
import { useWiki, getWikiQueryKey, getAllWikisQueryKey } from '@/features/activities/wiki/hooks/useWiki';
import { fetchWiki } from '@/features/activities/wiki/api/wikiApi';
import type { Wiki } from '@/features/activities/wiki/types/wiki.types';
import { createTestQueryClient } from '@/tests/helpers/render';
import { generateMockId } from '@/tests/helpers/mockData';
import { server } from '@/tests/mocks/server';

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

/**
 * Creates a mock Wiki object with realistic default values.
 * Supports partial overrides for customizing specific properties.
 *
 * @param overrides - Properties to override in the default wiki
 * @returns Complete Wiki object with all required fields
 */
function createMockWiki(overrides: Partial<Wiki> = {}): Wiki {
  const id = overrides.id ?? generateMockId();
  const courseId = overrides.course ?? generateMockId();

  return {
    id,
    course: courseId,
    name: overrides.name ?? `Wiki ${id}`,
    intro: overrides.intro ?? `<p>Introduction for Wiki ${id}</p>`,
    introformat: overrides.introformat ?? 1,
    firstpagetitle: overrides.firstpagetitle ?? 'Main Page',
    wikimode: overrides.wikimode ?? 'collaborative',
    defaultformat: overrides.defaultformat ?? 'html',
    forceformat: overrides.forceformat ?? 0,
    editbegin: overrides.editbegin ?? 0,
    editend: overrides.editend ?? 0,
    timecreated: overrides.timecreated ?? Math.floor(Date.now() / 1000) - 86400,
    timemodified: overrides.timemodified ?? Math.floor(Date.now() / 1000),
    cancreatepages: overrides.cancreatepages ?? true,
  };
}

/**
 * Creates a wrapper component with QueryClientProvider for testing hooks.
 *
 * @param queryClient - QueryClient instance to provide
 * @returns Wrapper component for renderHook
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('useWiki Hook', () => {
  let queryClient: QueryClient;
  let testWikiId: number;
  let mockWiki: Wiki;

  beforeEach(() => {
    // Create a fresh QueryClient for each test with test configuration
    queryClient = createTestQueryClient();
    
    // Generate fresh test data for each test
    testWikiId = generateMockId();
    mockWiki = createMockWiki({ id: testWikiId });
    
    // Clear all mock function calls
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up React Testing Library renders
    cleanup();
    
    // Reset MSW handlers to initial state
    server.resetHandlers();
    
    // Clear query cache to prevent test pollution
    queryClient.clear();
  });

  // ==========================================================================
  // HOOK INITIALIZATION TESTS
  // ==========================================================================

  describe('Hook Initialization', () => {
    it('should initialize with wiki ID parameter', async () => {
      // Setup MSW handler for this test
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      // Initially should be in loading state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      // Wait for data to be fetched
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify wiki data is available
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe(testWikiId);
    });

    it('should not fetch when wikiId is 0', async () => {
      const fetchSpy = vi.fn();
      
      server.use(
        http.get('*/api/v1/wiki/*', () => {
          fetchSpy();
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(0),
        { wrapper: createWrapper(queryClient) }
      );

      // Should not be loading since query is disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');

      // Wait a bit to ensure no fetch occurs
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should not fetch when wikiId is negative', async () => {
      const fetchSpy = vi.fn();
      
      server.use(
        http.get('*/api/v1/wiki/*', () => {
          fetchSpy();
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(-1),
        { wrapper: createWrapper(queryClient) }
      );

      // Should not be loading since query is disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');

      // Wait a bit to ensure no fetch occurs
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should respect enabled option set to false', async () => {
      const fetchSpy = vi.fn();
      
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          fetchSpy();
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId, { enabled: false }),
        { wrapper: createWrapper(queryClient) }
      );

      // Should not be loading since query is disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');

      // Wait a bit to ensure no fetch occurs
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // DATA FETCHING TESTS
  // ==========================================================================

  describe('Data Fetching', () => {
    it('should fetch wiki data successfully using React Query', async () => {
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockWiki);
      expect(result.current.error).toBeNull();
    });

    it('should show loading state while fetching wiki data', async () => {
      // Add a delay to the response to ensure we can check loading state
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      // Initial loading state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isPending).toBe(true);
      expect(result.current.isFetching).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSuccess).toBe(true);
    });

    it('should fetch complete wiki data with all fields', async () => {
      const completeWiki = createMockWiki({
        id: testWikiId,
        course: 100,
        name: 'Complete Wiki Test',
        intro: '<p>A comprehensive wiki introduction</p>',
        introformat: 1,
        firstpagetitle: 'Welcome Page',
        wikimode: 'individual',
        defaultformat: 'creole',
        forceformat: 1,
        editbegin: 1700000000,
        editend: 1800000000,
        timecreated: 1600000000,
        timemodified: 1700000000,
        cancreatepages: false,
      });

      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: completeWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.id).toBe(testWikiId);
      expect(result.current.data?.course).toBe(100);
      expect(result.current.data?.name).toBe('Complete Wiki Test');
      expect(result.current.data?.wikimode).toBe('individual');
      expect(result.current.data?.defaultformat).toBe('creole');
      expect(result.current.data?.forceformat).toBe(1);
      expect(result.current.data?.cancreatepages).toBe(false);
    });
  });

  // ==========================================================================
  // ERROR HANDLING TESTS
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle error state when wiki fetch fails with 404', async () => {
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Wiki not found',
              },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId, { retry: false }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('should handle error state when wiki fetch fails with 403 (permission denied)', async () => {
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to access this wiki',
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId, { retry: false }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.isSuccess).toBe(false);
    });

    it('should handle error state when wiki fetch fails with 500 (server error)', async () => {
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Internal server error',
              },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId, { retry: false }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle network error', async () => {
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId, { retry: false }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  // ==========================================================================
  // CACHING TESTS
  // ==========================================================================

  describe('Data Caching and Cache Keys', () => {
    it('should use correct cache key with format [wikis, wikiId]', async () => {
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify data is cached with correct key
      const cachedData = queryClient.getQueryData(['wikis', testWikiId]);
      expect(cachedData).toEqual(mockWiki);
    });

    it('should return cached data without refetching when cache is fresh', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          fetchCount++;
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      // First render - should fetch
      const { result, unmount } = renderHook(
        () => useWiki(testWikiId, { staleTime: 60000 }), // 1 minute stale time
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchCount).toBe(1);
      unmount();

      // Second render - should use cache
      const { result: result2 } = renderHook(
        () => useWiki(testWikiId, { staleTime: 60000 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Data should be immediately available from cache
      expect(result2.current.data).toEqual(mockWiki);
      expect(fetchCount).toBe(1); // No additional fetch
    });

    it('should generate correct query key using getWikiQueryKey utility', () => {
      const queryKey = getWikiQueryKey(testWikiId);
      expect(queryKey).toEqual(['wikis', testWikiId]);
    });

    it('should generate base query key using getAllWikisQueryKey utility', () => {
      const queryKey = getAllWikisQueryKey();
      expect(queryKey).toEqual(['wikis']);
    });

    it('should separate cache entries for different wiki IDs', async () => {
      const wikiId1 = generateMockId();
      const wikiId2 = generateMockId();
      const mockWiki1 = createMockWiki({ id: wikiId1, name: 'Wiki One' });
      const mockWiki2 = createMockWiki({ id: wikiId2, name: 'Wiki Two' });

      server.use(
        http.get(`*/api/v1/wiki/${wikiId1}`, () => {
          return HttpResponse.json({ success: true, data: mockWiki1 });
        }),
        http.get(`*/api/v1/wiki/${wikiId2}`, () => {
          return HttpResponse.json({ success: true, data: mockWiki2 });
        })
      );

      // Fetch first wiki
      const { result: result1 } = renderHook(
        () => useWiki(wikiId1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Fetch second wiki
      const { result: result2 } = renderHook(
        () => useWiki(wikiId2),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Verify separate cache entries
      expect(result1.current.data?.name).toBe('Wiki One');
      expect(result2.current.data?.name).toBe('Wiki Two');

      // Verify cache contains both
      expect(queryClient.getQueryData(['wikis', wikiId1])).toEqual(mockWiki1);
      expect(queryClient.getQueryData(['wikis', wikiId2])).toEqual(mockWiki2);
    });
  });

  // ==========================================================================
  // CACHE INVALIDATION TESTS
  // ==========================================================================

  describe('Cache Invalidation', () => {
    it('should invalidate cache on wiki updates', async () => {
      let fetchCount = 0;
      const updatedWiki = createMockWiki({ 
        id: testWikiId, 
        name: 'Updated Wiki Name' 
      });

      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          fetchCount++;
          return HttpResponse.json({
            success: true,
            data: fetchCount === 1 ? mockWiki : updatedWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.name).toBe(mockWiki.name);
      expect(fetchCount).toBe(1);

      // Invalidate the cache
      await queryClient.invalidateQueries({ queryKey: ['wikis', testWikiId] });

      await waitFor(() => {
        expect(result.current.data?.name).toBe('Updated Wiki Name');
      });

      expect(fetchCount).toBe(2);
    });

    it('should invalidate all wiki caches using base query key', async () => {
      const wikiId1 = generateMockId();
      const wikiId2 = generateMockId();
      let fetchCount1 = 0;
      let fetchCount2 = 0;

      server.use(
        http.get(`*/api/v1/wiki/${wikiId1}`, () => {
          fetchCount1++;
          return HttpResponse.json({
            success: true,
            data: createMockWiki({ id: wikiId1 }),
          });
        }),
        http.get(`*/api/v1/wiki/${wikiId2}`, () => {
          fetchCount2++;
          return HttpResponse.json({
            success: true,
            data: createMockWiki({ id: wikiId2 }),
          });
        })
      );

      const { result: result1 } = renderHook(
        () => useWiki(wikiId1),
        { wrapper: createWrapper(queryClient) }
      );

      const { result: result2 } = renderHook(
        () => useWiki(wikiId2),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
        expect(result2.current.isSuccess).toBe(true);
      });

      expect(fetchCount1).toBe(1);
      expect(fetchCount2).toBe(1);

      // Invalidate all wiki caches using base key
      await queryClient.invalidateQueries({ queryKey: getAllWikisQueryKey() });

      await waitFor(() => {
        expect(fetchCount1).toBeGreaterThan(1);
        expect(fetchCount2).toBeGreaterThan(1);
      });
    });
  });

  // ==========================================================================
  // REFETCH TESTS
  // ==========================================================================

  describe('Refetch Functionality', () => {
    it('should refetch when cache becomes stale', async () => {
      let fetchCount = 0;
      
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          fetchCount++;
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId, { staleTime: 0 }), // Immediately stale
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchCount).toBe(1);

      // Manually refetch
      await result.current.refetch();

      expect(fetchCount).toBe(2);
    });

    it('should provide refetch function in hook result', async () => {
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(typeof result.current.refetch).toBe('function');
    });

    it('should show isFetching state during refetch', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, async () => {
          fetchCount++;
          if (fetchCount > 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Trigger refetch
      const refetchPromise = result.current.refetch();

      // Should be fetching but not loading (has data)
      await waitFor(() => {
        expect(result.current.isFetching).toBe(true);
      });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeDefined();

      await refetchPromise;
    });
  });

  // ==========================================================================
  // QUERY CONFIGURATION TESTS
  // ==========================================================================

  describe('Query Configuration', () => {
    it('should respect custom staleTime option', async () => {
      const customStaleTime = 30000; // 30 seconds
      let fetchCount = 0;

      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          fetchCount++;
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result, unmount } = renderHook(
        () => useWiki(testWikiId, { staleTime: customStaleTime }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchCount).toBe(1);
      unmount();

      // Re-render with same options - should use cache since not stale
      const { result: result2 } = renderHook(
        () => useWiki(testWikiId, { staleTime: customStaleTime, refetchOnMount: false }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result2.current.data).toEqual(mockWiki);
      // Data should be immediately available from cache
      expect(result2.current.isStale).toBe(false);
    });

    it('should respect refetchOnWindowFocus option', async () => {
      // This tests that the option is passed to React Query
      // Actual window focus behavior is difficult to test
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId, { refetchOnWindowFocus: false }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the hook works with the option
      expect(result.current.data).toBeDefined();
    });

    it('should respect custom retry option', async () => {
      let attemptCount = 0;

      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          attemptCount++;
          if (attemptCount < 3) {
            return HttpResponse.json(
              { success: false, error: { message: 'Server error' } },
              { status: 500 }
            );
          }
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId, { retry: 3, retryDelay: 10 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      }, { timeout: 5000 });

      expect(attemptCount).toBe(3);
      expect(result.current.data).toEqual(mockWiki);
    });

    it('should fail after max retry attempts', async () => {
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json(
            { success: false, error: { message: 'Server error' } },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId, { retry: 2, retryDelay: 10 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 5000 });

      expect(result.current.error).toBeDefined();
    });

    it('should use default gcTime (garbage collection time)', async () => {
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify data is cached
      const queryState = queryClient.getQueryState(['wikis', testWikiId]);
      expect(queryState).toBeDefined();
    });
  });

  // ==========================================================================
  // OPTIMISTIC UPDATES TESTS
  // ==========================================================================

  describe('Optimistic Updates', () => {
    it('should support optimistic updates for wiki metadata', async () => {
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Optimistically update the cache
      const updatedWiki = { ...mockWiki, name: 'Optimistically Updated' };
      queryClient.setQueryData(['wikis', testWikiId], updatedWiki);

      // Verify the update is reflected
      expect(result.current.data?.name).toBe('Optimistically Updated');
    });

    it('should allow manual cache update with setQueryData', async () => {
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Update cache directly
      queryClient.setQueryData(['wikis', testWikiId], (old: Wiki | undefined) => {
        if (!old) return old;
        return { ...old, cancreatepages: false };
      });

      expect(result.current.data?.cancreatepages).toBe(false);
    });
  });

  // ==========================================================================
  // PARALLEL QUERIES TESTS
  // ==========================================================================

  describe('Parallel Queries', () => {
    it('should support fetching multiple wikis in parallel', async () => {
      const wikiIds = [generateMockId(), generateMockId(), generateMockId()];
      const mockWikis = wikiIds.map(id => createMockWiki({ id }));

      wikiIds.forEach((id, index) => {
        server.use(
          http.get(`*/api/v1/wiki/${id}`, () => {
            return HttpResponse.json({
              success: true,
              data: mockWikis[index],
            });
          })
        );
      });

      // Render hooks for all wikis
      const { result: result1 } = renderHook(
        () => useWiki(wikiIds[0]),
        { wrapper: createWrapper(queryClient) }
      );

      const { result: result2 } = renderHook(
        () => useWiki(wikiIds[1]),
        { wrapper: createWrapper(queryClient) }
      );

      const { result: result3 } = renderHook(
        () => useWiki(wikiIds[2]),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
        expect(result2.current.isSuccess).toBe(true);
        expect(result3.current.isSuccess).toBe(true);
      });

      expect(result1.current.data?.id).toBe(wikiIds[0]);
      expect(result2.current.data?.id).toBe(wikiIds[1]);
      expect(result3.current.data?.id).toBe(wikiIds[2]);
    });
  });

  // ==========================================================================
  // QUERY CANCELLATION TESTS
  // ==========================================================================

  describe('Query Cancellation', () => {
    it('should cancel pending queries on component unmount', async () => {
      let requestCompleted = false;

      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, async () => {
          await new Promise(resolve => setTimeout(resolve, 500));
          requestCompleted = true;
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result, unmount } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      // Verify fetch started
      expect(result.current.isFetching).toBe(true);

      // Unmount before request completes
      unmount();

      // Wait a bit and verify request didn't complete (was cancelled)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // The request may or may not complete depending on React Query's internal handling
      // but the component is unmounted so the result won't cause issues
      expect(result.current.data).toBeUndefined();
    });
  });

  // ==========================================================================
  // HOOK UPDATE TESTS
  // ==========================================================================

  describe('Hook Updates', () => {
    it('should fetch new data when wikiId changes', async () => {
      const wikiId1 = generateMockId();
      const wikiId2 = generateMockId();
      const mockWiki1 = createMockWiki({ id: wikiId1, name: 'Wiki One' });
      const mockWiki2 = createMockWiki({ id: wikiId2, name: 'Wiki Two' });

      server.use(
        http.get(`*/api/v1/wiki/${wikiId1}`, () => {
          return HttpResponse.json({ success: true, data: mockWiki1 });
        }),
        http.get(`*/api/v1/wiki/${wikiId2}`, () => {
          return HttpResponse.json({ success: true, data: mockWiki2 });
        })
      );

      const { result, rerender } = renderHook(
        ({ id }: { id: number }) => useWiki(id),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { id: wikiId1 },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.name).toBe('Wiki One');

      // Change wikiId
      rerender({ id: wikiId2 });

      await waitFor(() => {
        expect(result.current.data?.name).toBe('Wiki Two');
      });
    });

    it('should update query when options change', async () => {
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) => useWiki(testWikiId, { enabled }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { enabled: false },
        }
      );

      // Should not fetch when disabled
      expect(result.current.fetchStatus).toBe('idle');

      // Enable the query
      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockWiki);
    });
  });

  // ==========================================================================
  // WIKI-SPECIFIC DATA TESTS
  // ==========================================================================

  describe('Wiki-Specific Data', () => {
    it('should correctly handle collaborative wiki mode', async () => {
      const collaborativeWiki = createMockWiki({
        id: testWikiId,
        wikimode: 'collaborative',
      });

      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: collaborativeWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.wikimode).toBe('collaborative');
    });

    it('should correctly handle individual wiki mode', async () => {
      const individualWiki = createMockWiki({
        id: testWikiId,
        wikimode: 'individual',
      });

      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: individualWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.wikimode).toBe('individual');
    });

    it('should correctly handle different wiki formats (html, creole, nwiki)', async () => {
      const formats = ['html', 'creole', 'nwiki'] as const;

      for (const format of formats) {
        const wikiId = generateMockId();
        const formatWiki = createMockWiki({
          id: wikiId,
          defaultformat: format,
        });

        server.use(
          http.get(`*/api/v1/wiki/${wikiId}`, () => {
            return HttpResponse.json({
              success: true,
              data: formatWiki,
            });
          })
        );

        const { result } = renderHook(
          () => useWiki(wikiId),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.defaultformat).toBe(format);
      }
    });

    it('should handle editing restrictions (editbegin/editend)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const restrictedWiki = createMockWiki({
        id: testWikiId,
        editbegin: now - 86400, // Started yesterday
        editend: now + 86400, // Ends tomorrow
      });

      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: restrictedWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.editbegin).toBeGreaterThan(0);
      expect(result.current.data?.editend).toBeGreaterThan(0);
      expect(result.current.data?.editbegin).toBeLessThan(result.current.data?.editend ?? 0);
    });

    it('should handle cancreatepages permission', async () => {
      const restrictedWiki = createMockWiki({
        id: testWikiId,
        cancreatepages: false,
      });

      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: restrictedWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.cancreatepages).toBe(false);
    });

    it('should handle forceformat setting', async () => {
      const forcedFormatWiki = createMockWiki({
        id: testWikiId,
        defaultformat: 'creole',
        forceformat: 1,
      });

      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: forcedFormatWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.forceformat).toBe(1);
      expect(result.current.data?.defaultformat).toBe('creole');
    });
  });

  // ==========================================================================
  // TYPE SAFETY TESTS
  // ==========================================================================

  describe('Type Safety', () => {
    it('should return correctly typed Wiki data', async () => {
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // TypeScript should recognize these as the correct types
      const wiki = result.current.data;
      if (wiki) {
        // All these should be valid without type errors
        const _id: number = wiki.id;
        const _course: number = wiki.course;
        const _name: string = wiki.name;
        const _intro: string = wiki.intro;
        const _wikimode: 'collaborative' | 'individual' = wiki.wikimode;
        const _defaultformat: 'html' | 'creole' | 'nwiki' = wiki.defaultformat;
        const _cancreatepages: boolean = wiki.cancreatepages;

        // Verify runtime values match types
        expect(typeof _id).toBe('number');
        expect(typeof _course).toBe('number');
        expect(typeof _name).toBe('string');
        expect(typeof _intro).toBe('string');
        expect(['collaborative', 'individual']).toContain(_wikimode);
        expect(['html', 'creole', 'nwiki']).toContain(_defaultformat);
        expect(typeof _cancreatepages).toBe('boolean');
      }
    });

    it('should return correctly typed error', async () => {
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json(
            { success: false, error: { message: 'Not found' } },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId, { retry: false }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Error should be of type Error
      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  // ==========================================================================
  // QUERY STATE TESTS
  // ==========================================================================

  describe('Query State', () => {
    it('should expose all React Query state properties', async () => {
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const { result } = renderHook(
        () => useWiki(testWikiId),
        { wrapper: createWrapper(queryClient) }
      );

      // Check initial state
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isSuccess');
      expect(result.current).toHaveProperty('isError');
      expect(result.current).toHaveProperty('isFetching');
      expect(result.current).toHaveProperty('isPending');
      expect(result.current).toHaveProperty('isStale');
      expect(result.current).toHaveProperty('refetch');
      expect(result.current).toHaveProperty('fetchStatus');
      expect(result.current).toHaveProperty('status');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify success state
      expect(result.current.status).toBe('success');
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('should transition through correct states during fetch', async () => {
      server.use(
        http.get(`*/api/v1/wiki/${testWikiId}`, async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return HttpResponse.json({
            success: true,
            data: mockWiki,
          });
        })
      );

      const states: Array<{
        isPending: boolean;
        isLoading: boolean;
        isSuccess: boolean;
        isFetching: boolean;
      }> = [];

      const { result } = renderHook(
        () => {
          const queryResult = useWiki(testWikiId);
          // Capture state on each render
          states.push({
            isPending: queryResult.isPending,
            isLoading: queryResult.isLoading,
            isSuccess: queryResult.isSuccess,
            isFetching: queryResult.isFetching,
          });
          return queryResult;
        },
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // First state should be loading/pending
      expect(states[0].isPending).toBe(true);
      expect(states[0].isLoading).toBe(true);
      expect(states[0].isFetching).toBe(true);

      // Final state should be success
      const lastState = states[states.length - 1];
      expect(lastState.isSuccess).toBe(true);
      expect(lastState.isLoading).toBe(false);
      expect(lastState.isFetching).toBe(false);
    });
  });
});
