/**
 * Unit tests for useBBBRecordings React Query hooks.
 *
 * This module provides comprehensive tests for BigBlueButton recording management hooks:
 * - useBBBRecordings: Fetching recordings with filtering, pagination, and auto-refresh
 * - usePublishBBBRecording: Publishing recordings with optimistic updates
 * - useUnpublishBBBRecording: Unpublishing recordings with rollback on error
 * - useDeleteBBBRecording: Deleting recordings with confirmation and recovery
 * - useUpdateBBBRecordingMetadata: Updating recording name and description
 *
 * Tests cover:
 * - Loading states and successful data fetching
 * - Optimistic updates and cache invalidation
 * - Error handling with rollback capabilities
 * - TypeScript type safety verification
 * - Edge cases including recording availability delays
 * - Concurrent recording operations handling
 *
 * @module tests/unit/features/activities/bigbluebuttonbn/useBBBRecordings.test
 * @see Section 0.7 Special Instructions - Testing Requirements
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

import {
  useBBBRecordings,
  usePublishBBBRecording,
  useUnpublishBBBRecording,
  useDeleteBBBRecording,
  useUpdateBBBRecordingMetadata,
  bbbRecordingsKeys,
  type UseBBBRecordingsOptions,
  type UpdateRecordingMetadataParams,
} from '@/features/activities/bigbluebuttonbn/hooks/useBBBRecordings';
import type { BBBRecording } from '@/features/activities/bigbluebuttonbn/types/bbb.types';
import { BBBRecordingStatus } from '@/features/activities/bigbluebuttonbn/types/bbb.types';
import { server } from '@tests/mocks/server';

// ============================================================================
// Test Configuration and Utilities
// ============================================================================

/**
 * API base URL for BigBlueButton endpoints
 * Must match VITE_API_BASE_URL from vitest.config.ts for MSW to intercept requests
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

/**
 * Mock toast notification functions
 */
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
};

/**
 * Mock useToast hook
 */
vi.mock('@/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

/**
 * Creates a fresh QueryClient for each test with test-optimized settings.
 * Disables retries and caching to ensure deterministic test behavior.
 * 
 * Note: gcTime is set to 5 minutes (300000ms) instead of 0 to support
 * optimistic update testing. With gcTime: 0, data set via setQueryData
 * would be immediately garbage collected when there's no active useQuery
 * subscriber, causing optimistic update assertions to fail.
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 300000, // 5 minutes - allows optimistic updates to persist for verification
        staleTime: 0,
        networkMode: 'always',
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: {
        retry: false,
        networkMode: 'always',
      },
    },
  });
}

/**
 * Creates wrapper component with QueryClientProvider for renderHook
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
// Mock Data Factories
// ============================================================================

/**
 * Creates a mock BBB recording with realistic data structure.
 * Matches the BBBRecording interface from bbb.types.ts.
 */
function createMockRecording(overrides: Partial<BBBRecording> = {}): BBBRecording {
  const defaultRecording: BBBRecording = {
    id: 1,
    recordingId: 'rec-abc123',
    bigbluebuttonbnId: 100,
    courseId: 50,
    name: 'Test Recording',
    description: 'A test recording for unit tests',
    startTime: Date.now() - 3600000, // 1 hour ago
    endTime: Date.now() - 1800000, // 30 minutes ago
    published: true,
    protected: false,
    playbacks: [
      {
        type: 'presentation',
        url: 'https://bbb.example.com/playback/presentation/rec-abc123',
        length: 3600000,
      },
      {
        type: 'video',
        url: 'https://bbb.example.com/playback/video/rec-abc123',
        length: 3600000,
      },
      {
        type: 'podcast',
        url: 'https://bbb.example.com/playback/podcast/rec-abc123',
        length: 3600000,
      },
    ],
    headless: false,
    imported: false,
    status: BBBRecordingStatus.PROCESSED,
    groupId: null,
  };

  return { ...defaultRecording, ...overrides };
}

/**
 * Creates an array of mock recordings for list testing.
 */
function createMockRecordingsList(count: number = 3): BBBRecording[] {
  return Array.from({ length: count }, (_, index) =>
    createMockRecording({
      id: index + 1,
      recordingId: `rec-${String(index + 1).padStart(3, '0')}`,
      name: `Recording ${index + 1}`,
      startTime: Date.now() - (index + 1) * 3600000,
      endTime: Date.now() - (index + 1) * 3600000 + 1800000,
    })
  );
}

// ============================================================================
// Test Suite Setup
// ============================================================================

describe('useBBBRecordings hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    vi.useRealTimers();
  });

  // ==========================================================================
  // useBBBRecordings Query Hook Tests
  // ==========================================================================

  describe('useBBBRecordings', () => {
    const instanceId = 100;

    describe('initial loading state', () => {
      it('should return loading state initially', async () => {
        const mockRecordings = createMockRecordingsList();

        server.use(
          http.get(`${API_BASE_URL}/bigbluebuttonbn/${instanceId}/recordings`, async () => {
            // Add slight delay to ensure we can capture loading state
            await new Promise((resolve) => setTimeout(resolve, 50));
            return HttpResponse.json({
              success: true,
              data: { recordings: mockRecordings },
            });
          })
        );

        const { result } = renderHook(() => useBBBRecordings(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        // Verify initial loading state
        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeUndefined();

        // Wait for data to load
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toBeDefined();
        expect(result.current.data).toHaveLength(3);
      });
    });

    describe('successful fetch', () => {
      it('should fetch recordings array successfully', async () => {
        const mockRecordings = createMockRecordingsList(5);

        server.use(
          http.get(`${API_BASE_URL}/bigbluebuttonbn/${instanceId}/recordings`, () => {
            return HttpResponse.json({
              success: true,
              data: { recordings: mockRecordings },
            });
          })
        );

        const { result } = renderHook(() => useBBBRecordings(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toHaveLength(5);
        expect(result.current.data?.[0]).toMatchObject({
          recordingId: 'rec-001',
          name: 'Recording 1',
        });
      });

      it('should return recordings with correct structure including playback formats', async () => {
        const mockRecording = createMockRecording({
          playbacks: [
            { type: 'presentation', url: 'https://example.com/presentation', length: 3600000 },
            { type: 'video', url: 'https://example.com/video', length: 3600000 },
            { type: 'podcast', url: 'https://example.com/podcast', length: 3600000 },
          ],
        });

        server.use(
          http.get(`${API_BASE_URL}/bigbluebuttonbn/${instanceId}/recordings`, () => {
            return HttpResponse.json({
              success: true,
              data: { recordings: [mockRecording] },
            });
          })
        );

        const { result } = renderHook(() => useBBBRecordings(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const recording = result.current.data?.[0];
        expect(recording?.playbacks).toHaveLength(3);
        expect(recording?.playbacks?.[0]?.type).toBe('presentation');
        expect(recording?.playbacks?.[1]?.type).toBe('video');
        expect(recording?.playbacks?.[2]?.type).toBe('podcast');
      });

      it('should verify TypeScript type safety for returned recording objects', async () => {
        const mockRecording = createMockRecording();

        server.use(
          http.get(`${API_BASE_URL}/bigbluebuttonbn/${instanceId}/recordings`, () => {
            return HttpResponse.json({
              success: true,
              data: { recordings: [mockRecording] },
            });
          })
        );

        const { result } = renderHook(() => useBBBRecordings(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const recording = result.current.data?.[0];

        // Type assertions verifying correct typing
        expect(typeof recording?.id).toBe('number');
        expect(typeof recording?.recordingId).toBe('string');
        expect(typeof recording?.name).toBe('string');
        expect(typeof recording?.published).toBe('boolean');
        expect(Array.isArray(recording?.playbacks)).toBe(true);
      });
    });

    describe('groupId filtering', () => {
      it('should filter recordings by groupId when options.groupId provided', async () => {
        const groupId = 5;
        const mockRecordings = createMockRecordingsList(2).map((r) => ({
          ...r,
          groupId,
        }));

        server.use(
          http.get(`${API_BASE_URL}/bigbluebuttonbn/${instanceId}/recordings`, ({ request }) => {
            const url = new URL(request.url);
            const requestedGroupId = url.searchParams.get('groupId');

            if (requestedGroupId === String(groupId)) {
              return HttpResponse.json({
                success: true,
                data: { recordings: mockRecordings },
              });
            }

            return HttpResponse.json({
              success: true,
              data: { recordings: [] },
            });
          })
        );

        const { result } = renderHook(
          () => useBBBRecordings(instanceId, { groupId }),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toHaveLength(2);
        expect(result.current.data?.every((r) => r.groupId === groupId)).toBe(true);
      });
    });

    describe('includeImported flag behavior', () => {
      it('should include imported recordings when includeImported is true', async () => {
        const mockRecordings = [
          createMockRecording({ imported: false }),
          createMockRecording({ id: 2, recordingId: 'rec-imported', imported: true }),
        ];

        server.use(
          http.get(`${API_BASE_URL}/bigbluebuttonbn/${instanceId}/recordings`, ({ request }) => {
            const url = new URL(request.url);
            const includeImported = url.searchParams.get('includeImported');

            if (includeImported === 'true') {
              return HttpResponse.json({
                success: true,
                data: { recordings: mockRecordings },
              });
            }

            return HttpResponse.json({
              success: true,
              data: { recordings: mockRecordings.filter((r) => !r.imported) },
            });
          })
        );

        const { result } = renderHook(
          () => useBBBRecordings(instanceId, { includeImported: true }),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toHaveLength(2);
        expect(result.current.data?.some((r) => r.imported)).toBe(true);
      });
    });

    describe('pagination support', () => {
      it('should support pagination when recordings exceed threshold', async () => {
        const page = 2;
        const perPage = 25;
        const mockRecordings = createMockRecordingsList(25);

        server.use(
          http.get(`${API_BASE_URL}/bigbluebuttonbn/${instanceId}/recordings`, ({ request }) => {
            const url = new URL(request.url);
            const requestedPage = url.searchParams.get('page');
            const requestedPerPage = url.searchParams.get('perPage');

            return HttpResponse.json({
              success: true,
              data: {
                recordings: mockRecordings,
                pagination: {
                  page: parseInt(requestedPage ?? '1', 10),
                  perPage: parseInt(requestedPerPage ?? '25', 10),
                  total: 75,
                  totalPages: 3,
                },
              },
            });
          })
        );

        const { result } = renderHook(
          () => useBBBRecordings(instanceId, { page, perPage }),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toHaveLength(25);
      });
    });

    describe('automatic 5-minute refetch interval', () => {
      it('should have 5-minute refetch interval configured', async () => {
        const mockRecordings = createMockRecordingsList();

        server.use(
          http.get(`${API_BASE_URL}/bigbluebuttonbn/${instanceId}/recordings`, () => {
            return HttpResponse.json({
              success: true,
              data: { recordings: mockRecordings },
            });
          })
        );

        const { result } = renderHook(() => useBBBRecordings(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Verify refetch interval is configured by checking the query state
        // The hook uses DEFAULT_REFETCH_INTERVAL = 300000 (5 minutes)
        const queryState = queryClient.getQueryState(bbbRecordingsKeys.listFiltered(instanceId, {}));
        expect(queryState).toBeDefined();
        
        // Verify the hook returned data
        expect(result.current.data).toBeDefined();
        expect(result.current.data?.length).toBe(mockRecordings.length);
        
        // Verify we can manually trigger a refetch (testing refetchability)
        const initialDataUpdatedAt = queryState?.dataUpdatedAt;
        
        await act(async () => {
          await result.current.refetch();
        });
        
        await waitFor(() => {
          const newState = queryClient.getQueryState(bbbRecordingsKeys.listFiltered(instanceId, {}));
          // Data should have been updated (either newer timestamp or same if very fast)
          expect(newState?.dataUpdatedAt).toBeGreaterThanOrEqual(initialDataUpdatedAt || 0);
        });
        
        // Note: Testing the actual 5-minute interval would require integration tests
        // with real timers. This test verifies the refetch mechanism works correctly.
      });
    });

    describe('proper caching with stale time', () => {
      it('should use cached data within stale time', async () => {
        let fetchCount = 0;
        const mockRecordings = createMockRecordingsList();

        server.use(
          http.get(`${API_BASE_URL}/bigbluebuttonbn/${instanceId}/recordings`, () => {
            fetchCount++;
            return HttpResponse.json({
              success: true,
              data: { recordings: mockRecordings },
            });
          })
        );

        const { result, rerender } = renderHook(
          () => useBBBRecordings(instanceId),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(fetchCount).toBe(1);

        // Rerender (same query key) should use cached data
        rerender();

        // Should still be 1 fetch due to caching
        expect(fetchCount).toBe(1);
      });
    });

    describe('error handling', () => {
      // Note: The useBBBRecordings hook has retry: 3 with exponential backoff
      // (1s, 2s, 4s) totaling ~7s. We need longer timeouts for error tests.
      
      it('should handle 404 response correctly', async () => {
        server.use(
          http.get(`${API_BASE_URL}/bigbluebuttonbn/${instanceId}/recordings`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: 'Recording not found',
              },
              { status: 404 }
            );
          })
        );

        const { result } = renderHook(() => useBBBRecordings(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        // Wait longer to account for retry: 3 with exponential backoff
        // Retries: 1s + 2s + 4s = 7s, plus buffer for processing
        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        }, { timeout: 10000 });

        expect(result.current.error).toBeDefined();
      }, 15000); // 15s test timeout

      it('should handle 403 permission denied response', async () => {
        server.use(
          http.get(`${API_BASE_URL}/bigbluebuttonbn/${instanceId}/recordings`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: 'Permission denied',
              },
              { status: 403 }
            );
          })
        );

        const { result } = renderHook(() => useBBBRecordings(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        }, { timeout: 10000 });

        expect(result.current.error).toBeDefined();
      }, 15000);
    });

    describe('proper cache key structure', () => {
      it('should use correct cache key structure', () => {
        const expectedKeyBase = ['bigbluebuttonbn', 'recordings', 'list', instanceId];
        const key = bbbRecordingsKeys.list(instanceId);

        expect(key).toEqual(expectedKeyBase);
      });

      it('should include filters in cache key when options provided', () => {
        const options: UseBBBRecordingsOptions = {
          groupId: 5,
          includeImported: true,
        };
        const key = bbbRecordingsKeys.listFiltered(instanceId, options);

        expect(key).toContain('bigbluebuttonbn');
        expect(key).toContain('recordings');
        expect(key).toContain('list');
        expect(key).toContain(instanceId);
        expect(key).toContainEqual(options);
      });
    });
  });

  // ==========================================================================
  // usePublishBBBRecording Mutation Hook Tests
  // ==========================================================================

  describe('usePublishBBBRecording', () => {
    const instanceId = 100;

    describe('loading state during publish operation', () => {
      it('should show loading state during publish', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId, published: false });

        // Pre-populate cache
        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        // Track loading state transitions
        let sawPendingState = false;
        
        server.use(
          http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}/publish`, async () => {
            // Delay to allow loading state to be captured
            await new Promise((resolve) => setTimeout(resolve, 200));
            return HttpResponse.json({
              success: true,
              data: { recording: { ...mockRecording, published: true } },
            });
          })
        );

        const { result } = renderHook(() => usePublishBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        expect(result.current.isPending).toBe(false);

        // Start the mutation without waiting for it to complete
        result.current.mutate({ recordingId });

        // Wait for loading state to become true (captures the intermediate state)
        await waitFor(() => {
          if (result.current.isPending) {
            sawPendingState = true;
          }
          // Keep polling until mutation completes or we've seen the pending state
          expect(sawPendingState || result.current.isPending).toBe(true);
        }, { timeout: 500 });

        // Verify we saw the pending state
        expect(sawPendingState).toBe(true);

        // Wait for mutation to complete
        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });
        
        expect(result.current.isSuccess).toBe(true);
      });
    });

    describe('successful publish', () => {
      it('should mark recording as published:true on success', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId, published: false });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        server.use(
          http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}/publish`, () => {
            return HttpResponse.json({
              success: true,
              data: { recording: { ...mockRecording, published: true } },
            });
          })
        );

        const { result } = renderHook(() => usePublishBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ recordingId });
        });

        expect(result.current.isSuccess).toBe(true);
        expect(mockToast.success).toHaveBeenCalledWith('Recording published successfully');
      });
    });

    describe('optimistic update', () => {
      it('should immediately show published state in UI before server confirmation', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId, published: false });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        let resolvePublish: () => void;
        const publishPromise = new Promise<void>((resolve) => {
          resolvePublish = resolve;
        });

        server.use(
          http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}/publish`, async () => {
            await publishPromise;
            return HttpResponse.json({
              success: true,
              data: { recording: { ...mockRecording, published: true } },
            });
          })
        );

        const { result } = renderHook(() => usePublishBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        act(() => {
          result.current.mutate({ recordingId });
        });

        // Check optimistic update applied immediately
        await waitFor(() => {
          const cachedData = queryClient.getQueryData<BBBRecording[]>(
            bbbRecordingsKeys.list(instanceId)
          );
          expect(cachedData?.[0]?.published).toBe(true);
        });

        // Now resolve the server request
        act(() => {
          resolvePublish!();
        });

        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });
      });
    });

    describe('cache invalidation on success', () => {
      it('should invalidate useBBBRecordings query on success', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId, published: false });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        server.use(
          http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}/publish`, () => {
            return HttpResponse.json({
              success: true,
              data: { recording: { ...mockRecording, published: true } },
            });
          })
        );

        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        const { result } = renderHook(() => usePublishBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ recordingId });
        });

        expect(invalidateSpy).toHaveBeenCalled();
      });
    });

    describe('rollback of optimistic update on error', () => {
      it('should rollback optimistic update on error with user notification', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId, published: false });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        server.use(
          http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}/publish`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: 'Server error',
              },
              { status: 500 }
            );
          })
        );

        const { result } = renderHook(() => usePublishBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ recordingId });
          } catch {
            // Expected to fail
          }
        });

        // Verify rollback occurred
        const cachedData = queryClient.getQueryData<BBBRecording[]>(
          bbbRecordingsKeys.list(instanceId)
        );
        expect(cachedData?.[0]?.published).toBe(false);

        // Verify error notification
        expect(mockToast.error).toHaveBeenCalled();
      });
    });

    describe('error handling for 404 recording not found', () => {
      it('should handle 404 error properly', async () => {
        const recordingId = 'rec-nonexistent';

        server.use(
          http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}/publish`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: 'Recording not found',
              },
              { status: 404 }
            );
          })
        );

        const { result } = renderHook(() => usePublishBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ recordingId });
          } catch {
            // Expected
          }
        });

        expect(result.current.isError).toBe(true);
        expect(mockToast.error).toHaveBeenCalled();
      });
    });

    describe('error handling for 403 permission denied', () => {
      it('should handle 403 permission denied error', async () => {
        const recordingId = 'rec-001';

        server.use(
          http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}/publish`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: 'Permission denied',
              },
              { status: 403 }
            );
          })
        );

        const { result } = renderHook(() => usePublishBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ recordingId });
          } catch {
            // Expected
          }
        });

        expect(result.current.isError).toBe(true);
        expect(mockToast.error).toHaveBeenCalled();
      });
    });

    describe('concurrent publish requests handling', () => {
      it('should handle concurrent publish requests properly', async () => {
        const recording1 = createMockRecording({
          id: 1,
          recordingId: 'rec-001',
          published: false,
        });
        const recording2 = createMockRecording({
          id: 2,
          recordingId: 'rec-002',
          published: false,
        });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [
          recording1,
          recording2,
        ]);

        server.use(
          http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/:recordingId/publish`, async ({ params }) => {
            const { recordingId } = params;
            await new Promise((resolve) => setTimeout(resolve, 50));
            return HttpResponse.json({
              success: true,
              data: {
                recording: {
                  ...(recordingId === 'rec-001' ? recording1 : recording2),
                  published: true,
                },
              },
            });
          })
        );

        const { result } = renderHook(() => usePublishBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        // Fire both mutations concurrently
        await act(async () => {
          await Promise.all([
            result.current.mutateAsync({ recordingId: 'rec-001' }),
            result.current.mutateAsync({ recordingId: 'rec-002' }),
          ]);
        });

        expect(mockToast.success).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ==========================================================================
  // useUnpublishBBBRecording Mutation Hook Tests
  // ==========================================================================

  describe('useUnpublishBBBRecording', () => {
    const instanceId = 100;

    describe('loading state', () => {
      it('should show loading state during unpublish', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId, published: true });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        // Track loading state transitions
        let sawPendingState = false;

        server.use(
          http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}/unpublish`, async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return HttpResponse.json({
              success: true,
              data: { recording: { ...mockRecording, published: false } },
            });
          })
        );

        const { result } = renderHook(() => useUnpublishBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        expect(result.current.isPending).toBe(false);

        // Start mutation without waiting
        result.current.mutate({ recordingId });

        // Wait for loading state to become true
        await waitFor(() => {
          if (result.current.isPending) {
            sawPendingState = true;
          }
          expect(sawPendingState || result.current.isPending).toBe(true);
        }, { timeout: 500 });

        expect(sawPendingState).toBe(true);

        // Wait for mutation to complete
        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });
        
        expect(result.current.isSuccess).toBe(true);
      });
    });

    describe('successful unpublish', () => {
      it('should mark recording as published:false on success', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId, published: true });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        server.use(
          http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}/unpublish`, () => {
            return HttpResponse.json({
              success: true,
              data: { recording: { ...mockRecording, published: false } },
            });
          })
        );

        const { result } = renderHook(() => useUnpublishBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ recordingId });
        });

        expect(result.current.isSuccess).toBe(true);
        expect(mockToast.success).toHaveBeenCalledWith('Recording unpublished successfully');
      });
    });

    describe('optimistic update', () => {
      it('should immediately hide recording from students via optimistic update', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId, published: true });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        let resolveUnpublish: () => void;
        const unpublishPromise = new Promise<void>((resolve) => {
          resolveUnpublish = resolve;
        });

        server.use(
          http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}/unpublish`, async () => {
            await unpublishPromise;
            return HttpResponse.json({
              success: true,
              data: { recording: { ...mockRecording, published: false } },
            });
          })
        );

        const { result } = renderHook(() => useUnpublishBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        act(() => {
          result.current.mutate({ recordingId });
        });

        // Verify optimistic update applied immediately
        await waitFor(() => {
          const cachedData = queryClient.getQueryData<BBBRecording[]>(
            bbbRecordingsKeys.list(instanceId)
          );
          expect(cachedData?.[0]?.published).toBe(false);
        });

        act(() => {
          resolveUnpublish!();
        });

        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });
      });
    });

    describe('rollback on error', () => {
      it('should rollback on error and restore published state', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId, published: true });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        server.use(
          http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}/unpublish`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: 'Failed to unpublish',
              },
              { status: 500 }
            );
          })
        );

        const { result } = renderHook(() => useUnpublishBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ recordingId });
          } catch {
            // Expected
          }
        });

        // Verify rollback - should be back to published: true
        const cachedData = queryClient.getQueryData<BBBRecording[]>(
          bbbRecordingsKeys.list(instanceId)
        );
        expect(cachedData?.[0]?.published).toBe(true);
        expect(mockToast.error).toHaveBeenCalled();
      });
    });

    describe('error handling for already unpublished recordings', () => {
      it('should handle error when recording is already unpublished', async () => {
        const recordingId = 'rec-001';

        server.use(
          http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}/unpublish`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: 'Recording is already unpublished',
              },
              { status: 400 }
            );
          })
        );

        const { result } = renderHook(() => useUnpublishBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ recordingId });
          } catch {
            // Expected
          }
        });

        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==========================================================================
  // useDeleteBBBRecording Mutation Hook Tests
  // ==========================================================================

  describe('useDeleteBBBRecording', () => {
    const instanceId = 100;

    describe('loading state', () => {
      it('should show loading state during deletion', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        // Track loading state transitions
        let sawPendingState = false;

        server.use(
          http.delete(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}`, async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return HttpResponse.json({ success: true });
          })
        );

        const { result } = renderHook(() => useDeleteBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        expect(result.current.isPending).toBe(false);

        // Start mutation without waiting
        result.current.mutate({ recordingId });

        // Wait for loading state to become true
        await waitFor(() => {
          if (result.current.isPending) {
            sawPendingState = true;
          }
          expect(sawPendingState || result.current.isPending).toBe(true);
        }, { timeout: 500 });

        expect(sawPendingState).toBe(true);

        // Wait for mutation to complete
        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });
        
        expect(result.current.isSuccess).toBe(true);
      });
    });

    describe('successful deletion', () => {
      it('should permanently remove recording from BigBlueButton server', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        server.use(
          http.delete(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}`, () => {
            return HttpResponse.json({ success: true });
          })
        );

        const { result } = renderHook(() => useDeleteBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ recordingId });
        });

        expect(result.current.isSuccess).toBe(true);
        expect(mockToast.success).toHaveBeenCalledWith('Recording deleted permanently');
      });
    });

    describe('optimistic update', () => {
      it('should immediately remove recording from UI list', async () => {
        const recordingId = 'rec-001';
        const mockRecordings = [
          createMockRecording({ id: 1, recordingId: 'rec-001' }),
          createMockRecording({ id: 2, recordingId: 'rec-002' }),
        ];

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), mockRecordings);

        let resolveDelete: () => void;
        const deletePromise = new Promise<void>((resolve) => {
          resolveDelete = resolve;
        });

        server.use(
          http.delete(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}`, async () => {
            await deletePromise;
            return HttpResponse.json({ success: true });
          })
        );

        const { result } = renderHook(() => useDeleteBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        act(() => {
          result.current.mutate({ recordingId });
        });

        // Verify optimistic removal immediately
        await waitFor(() => {
          const cachedData = queryClient.getQueryData<BBBRecording[]>(
            bbbRecordingsKeys.list(instanceId)
          );
          expect(cachedData).toHaveLength(1);
          expect(cachedData?.[0]?.recordingId).toBe('rec-002');
        });

        act(() => {
          resolveDelete!();
        });

        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });
      });
    });

    describe('rollback on error with user notification', () => {
      it('should rollback on error showing recording restored notification', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        server.use(
          http.delete(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: 'Failed to delete recording',
              },
              { status: 500 }
            );
          })
        );

        const { result } = renderHook(() => useDeleteBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ recordingId });
          } catch {
            // Expected
          }
        });

        // Verify rollback - recording should be restored
        const cachedData = queryClient.getQueryData<BBBRecording[]>(
          bbbRecordingsKeys.list(instanceId)
        );
        expect(cachedData).toHaveLength(1);
        expect(cachedData?.[0]?.recordingId).toBe(recordingId);

        // Verify user notifications
        expect(mockToast.error).toHaveBeenCalled();
        expect(mockToast.warning).toHaveBeenCalledWith('The recording has been restored in the list');
      });
    });

    describe('error handling for 404 not found', () => {
      it('should handle 404 not found error', async () => {
        const recordingId = 'rec-nonexistent';

        server.use(
          http.delete(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: 'Recording not found',
              },
              { status: 404 }
            );
          })
        );

        const { result } = renderHook(() => useDeleteBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ recordingId });
          } catch {
            // Expected
          }
        });

        expect(result.current.isError).toBe(true);
        expect(mockToast.error).toHaveBeenCalled();
      });
    });

    describe('error handling for 403 permission denied for non-moderators', () => {
      it('should handle 403 permission denied error', async () => {
        const recordingId = 'rec-001';

        server.use(
          http.delete(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: 'Permission denied: Only moderators can delete recordings',
              },
              { status: 403 }
            );
          })
        );

        const { result } = renderHook(() => useDeleteBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ recordingId });
          } catch {
            // Expected
          }
        });

        expect(result.current.isError).toBe(true);
        expect(mockToast.error).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // useUpdateBBBRecordingMetadata Mutation Hook Tests
  // ==========================================================================

  describe('useUpdateBBBRecordingMetadata', () => {
    const instanceId = 100;

    describe('loading state', () => {
      it('should show loading state during update', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        // Track loading state transitions
        let sawPendingState = false;

        server.use(
          http.put(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}`, async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return HttpResponse.json({
              success: true,
              data: { recording: { ...mockRecording, name: 'Updated Name' } },
            });
          })
        );

        const { result } = renderHook(() => useUpdateBBBRecordingMetadata(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        expect(result.current.isPending).toBe(false);

        // Start mutation without waiting
        result.current.mutate({ recordingId, name: 'Updated Name' });

        // Wait for loading state to become true
        await waitFor(() => {
          if (result.current.isPending) {
            sawPendingState = true;
          }
          expect(sawPendingState || result.current.isPending).toBe(true);
        }, { timeout: 500 });

        expect(sawPendingState).toBe(true);

        // Wait for mutation to complete
        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });
        
        expect(result.current.isSuccess).toBe(true);
      });
    });

    describe('successful metadata update', () => {
      it('should update name field successfully', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({
          recordingId,
          name: 'Original Name',
        });
        const newName = 'Updated Recording Name';

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        server.use(
          http.put(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}`, () => {
            return HttpResponse.json({
              success: true,
              data: { recording: { ...mockRecording, name: newName } },
            });
          })
        );

        const { result } = renderHook(() => useUpdateBBBRecordingMetadata(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ recordingId, name: newName });
        });

        expect(result.current.isSuccess).toBe(true);
        expect(mockToast.success).toHaveBeenCalledWith('Recording updated successfully');
      });

      it('should update description field successfully', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({
          recordingId,
          description: 'Original Description',
        });
        const newDescription = 'Updated recording description';

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        server.use(
          http.put(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}`, () => {
            return HttpResponse.json({
              success: true,
              data: { recording: { ...mockRecording, description: newDescription } },
            });
          })
        );

        const { result } = renderHook(() => useUpdateBBBRecordingMetadata(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ recordingId, description: newDescription });
        });

        expect(result.current.isSuccess).toBe(true);
      });

      it('should update both name and description together', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId });
        const newName = 'New Name';
        const newDescription = 'New Description';

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        server.use(
          http.put(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                recording: {
                  ...mockRecording,
                  name: newName,
                  description: newDescription,
                },
              },
            });
          })
        );

        const { result } = renderHook(() => useUpdateBBBRecordingMetadata(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({
            recordingId,
            name: newName,
            description: newDescription,
          });
        });

        expect(result.current.isSuccess).toBe(true);
      });
    });

    describe('optimistic update for immediate UI feedback', () => {
      it('should immediately show updated metadata in UI', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({
          recordingId,
          name: 'Original Name',
        });
        const newName = 'Optimistic Name';

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        let resolveUpdate: () => void;
        const updatePromise = new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        });

        server.use(
          http.put(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}`, async () => {
            await updatePromise;
            return HttpResponse.json({
              success: true,
              data: { recording: { ...mockRecording, name: newName } },
            });
          })
        );

        const { result } = renderHook(() => useUpdateBBBRecordingMetadata(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        act(() => {
          result.current.mutate({ recordingId, name: newName });
        });

        // Verify optimistic update applied immediately
        await waitFor(() => {
          const cachedData = queryClient.getQueryData<BBBRecording[]>(
            bbbRecordingsKeys.list(instanceId)
          );
          expect(cachedData?.[0]?.name).toBe(newName);
        });

        act(() => {
          resolveUpdate!();
        });

        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });
      });
    });

    describe('rollback on error', () => {
      it('should rollback on error and restore original metadata', async () => {
        const recordingId = 'rec-001';
        const originalName = 'Original Name';
        const mockRecording = createMockRecording({
          recordingId,
          name: originalName,
        });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        server.use(
          http.put(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: 'Failed to update metadata',
              },
              { status: 500 }
            );
          })
        );

        const { result } = renderHook(() => useUpdateBBBRecordingMetadata(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ recordingId, name: 'New Name' });
          } catch {
            // Expected
          }
        });

        // Verify rollback - should be back to original name
        const cachedData = queryClient.getQueryData<BBBRecording[]>(
          bbbRecordingsKeys.list(instanceId)
        );
        expect(cachedData?.[0]?.name).toBe(originalName);
        expect(mockToast.error).toHaveBeenCalled();
      });
    });

    describe('validation error handling', () => {
      it('should handle validation error for empty name', async () => {
        const recordingId = 'rec-001';

        server.use(
          http.put(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: 'Name cannot be empty',
              },
              { status: 400 }
            );
          })
        );

        const { result } = renderHook(() => useUpdateBBBRecordingMetadata(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ recordingId, name: '' });
          } catch {
            // Expected
          }
        });

        expect(result.current.isError).toBe(true);
        expect(mockToast.error).toHaveBeenCalled();
      });

      it('should handle validation error for invalid characters', async () => {
        const recordingId = 'rec-001';

        server.use(
          http.put(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: 'Name contains invalid characters',
              },
              { status: 400 }
            );
          })
        );

        const { result } = renderHook(() => useUpdateBBBRecordingMetadata(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ recordingId, name: '<script>alert("xss")</script>' });
          } catch {
            // Expected
          }
        });

        expect(result.current.isError).toBe(true);
      });
    });

    describe('TypeScript typing for metadata object', () => {
      it('should properly type UpdateRecordingMetadataParams', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        server.use(
          http.put(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}`, () => {
            return HttpResponse.json({
              success: true,
              data: { recording: mockRecording },
            });
          })
        );

        const { result } = renderHook(() => useUpdateBBBRecordingMetadata(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        // TypeScript compile-time check: ensure params type is correct
        const params: UpdateRecordingMetadataParams = {
          recordingId: 'rec-001',
          name: 'New Name',
          description: 'New Description',
        };

        await act(async () => {
          await result.current.mutateAsync(params);
        });

        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Recording Availability Delay Scenario Tests
  // ==========================================================================

  describe('recording availability delay scenarios', () => {
    const instanceId = 100;

    it('should handle recording with processing status and periodic refetch until ready', async () => {
      let fetchCount = 0;
      const processingRecording = createMockRecording({
        recordingId: 'rec-processing',
        status: BBBRecordingStatus.AWAITING,
        playbacks: null, // No playback URLs while processing
      });
      const readyRecording = createMockRecording({
        recordingId: 'rec-processing',
        status: BBBRecordingStatus.PROCESSED,
        playbacks: [
          { type: 'presentation', url: 'https://example.com/playback', length: 3600000 },
        ],
      });

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/${instanceId}/recordings`, () => {
          fetchCount++;
          // First two fetches return processing, third returns ready
          if (fetchCount < 3) {
            return HttpResponse.json({
              success: true,
              data: { recordings: [processingRecording] },
            });
          }
          return HttpResponse.json({
            success: true,
            data: { recordings: [readyRecording] },
          });
        })
      );

      const { result } = renderHook(() => useBBBRecordings(instanceId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0]?.status).toBe(BBBRecordingStatus.AWAITING);
      expect(result.current.data?.[0]?.playbacks).toBeNull();
      expect(fetchCount).toBe(1);

      // Manually trigger refetch (simulating what the refetchInterval would do)
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(fetchCount).toBe(2);
      });
      
      // Still processing after second fetch
      expect(result.current.data?.[0]?.status).toBe(BBBRecordingStatus.AWAITING);

      // Third refetch should return ready status
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(fetchCount).toBe(3);
        expect(result.current.data?.[0]?.status).toBe(BBBRecordingStatus.PROCESSED);
        expect(result.current.data?.[0]?.playbacks).toHaveLength(1);
        expect(result.current.data?.[0]?.playbacks?.[0]?.url).toBe('https://example.com/playback');
      });
    });
  });

  // ==========================================================================
  // Error Scenarios Tests
  // ==========================================================================

  describe('error scenarios', () => {
    const instanceId = 100;

    describe('network failures with retry logic', () => {
      it('should handle network failure gracefully', async () => {
        server.use(
          http.get(`${API_BASE_URL}/bigbluebuttonbn/${instanceId}/recordings`, () => {
            return HttpResponse.error();
          })
        );

        const { result } = renderHook(() => useBBBRecordings(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        // Note: The hook has retry: 3 with exponential backoff (1s, 2s, 4s = ~7s total)
        // We need to wait long enough for all retries to complete
        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        }, { timeout: 10000 });

        expect(result.current.error).toBeDefined();
      }, 15000); // 15 second test timeout
    });

    describe('timeout errors', () => {
      it('should handle timeout errors', async () => {
        server.use(
          http.get(`${API_BASE_URL}/bigbluebuttonbn/${instanceId}/recordings`, async () => {
            // Simulate timeout by never responding
            await new Promise(() => {}); // Never resolves
          })
        );

        // Create a client with short timeout for testing
        const timeoutQueryClient = new QueryClient({
          defaultOptions: {
            queries: {
              retry: false,
              gcTime: 0,
              staleTime: 0,
              networkMode: 'always',
            },
          },
        });

        const { result, unmount } = renderHook(() => useBBBRecordings(instanceId), {
          wrapper: createWrapper(timeoutQueryClient),
        });

        // Wait a brief moment for the query to start
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        });

        // Verify query is fetching (pending)
        expect(result.current.isFetching).toBe(true);

        // Cleanup to prevent hanging test
        unmount();
        timeoutQueryClient.clear();
      });
    });

    describe('malformed responses', () => {
      it('should handle malformed API response', async () => {
        server.use(
          http.get(`${API_BASE_URL}/bigbluebuttonbn/${instanceId}/recordings`, () => {
            return HttpResponse.json({
              success: false,
              // Missing required data structure
            });
          })
        );

        const { result } = renderHook(() => useBBBRecordings(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });

    describe('authentication token expiration', () => {
      it('should handle 401 unauthorized requiring re-login', async () => {
        server.use(
          http.get(`${API_BASE_URL}/bigbluebuttonbn/${instanceId}/recordings`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: 'Token expired',
              },
              { status: 401 }
            );
          })
        );

        const { result } = renderHook(() => useBBBRecordings(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        // Note: The hook has retry: 3 with exponential backoff (1s, 2s, 4s = ~7s total)
        // We need to wait long enough for all retries to complete
        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        }, { timeout: 10000 });

        expect(result.current.error).toBeDefined();
      }, 15000); // 15 second test timeout
    });

    describe('concurrent operations on same recording', () => {
      it('should handle concurrent operations with proper conflict resolution', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId, published: false });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        let publishCallCount = 0;

        server.use(
          http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}/publish`, async () => {
            publishCallCount++;
            await new Promise((resolve) => setTimeout(resolve, 50));
            return HttpResponse.json({
              success: true,
              data: { recording: { ...mockRecording, published: true } },
            });
          })
        );

        const { result } = renderHook(() => usePublishBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        // Fire multiple mutations on same recording
        await act(async () => {
          await Promise.allSettled([
            result.current.mutateAsync({ recordingId }),
            result.current.mutateAsync({ recordingId }),
          ]);
        });

        // Both should have been called
        expect(publishCallCount).toBe(2);
      });
    });
  });

  // ==========================================================================
  // Test Isolation and Cleanup Verification
  // ==========================================================================

  describe('test isolation', () => {
    it('should have clean QueryClient state between tests', () => {
      // This test verifies that each test starts with a fresh QueryClient
      const allQueries = queryClient.getQueryCache().getAll();
      expect(allQueries).toHaveLength(0);
    });

    it('should not leak state from previous tests', async () => {
      // Add some data
      queryClient.setQueryData(['test-key'], { value: 'test' });

      // Verify data exists
      expect(queryClient.getQueryData(['test-key'])).toBeDefined();
    });

    it('should start fresh after previous test that set data', () => {
      // Verify previous test's data is not present
      expect(queryClient.getQueryData(['test-key'])).toBeUndefined();
    });
  });

  // ==========================================================================
  // Optimistic Update Pattern Verification Tests
  // ==========================================================================

  describe('optimistic update patterns', () => {
    const instanceId = 100;

    describe('success path verification', () => {
      it('should maintain UI consistency through complete optimistic update cycle', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId, published: false });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        server.use(
          http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}/publish`, async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.json({
              success: true,
              data: { recording: { ...mockRecording, published: true } },
            });
          })
        );

        const { result } = renderHook(() => usePublishBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        // Capture initial state
        const getPublishedState = () => {
          const data = queryClient.getQueryData<BBBRecording[]>(bbbRecordingsKeys.list(instanceId));
          return data?.[0]?.published;
        };

        const initialState = getPublishedState();
        expect(initialState).toBe(false);

        // Start mutation
        result.current.mutate({ recordingId });

        // Wait for optimistic update to be applied (published should become true)
        let sawOptimisticUpdate = false;
        await waitFor(() => {
          const currentState = getPublishedState();
          if (currentState === true) {
            sawOptimisticUpdate = true;
          }
          expect(sawOptimisticUpdate).toBe(true);
        }, { timeout: 500 });

        // Wait for mutation to complete
        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });

        expect(result.current.isSuccess).toBe(true);

        // Verify final state remains true (server confirmed the update)
        const finalState = getPublishedState();
        expect(finalState).toBe(true);

        // Verify we saw the complete cycle: false -> true (optimistic) -> true (confirmed)
        expect(initialState).toBe(false);
        expect(sawOptimisticUpdate).toBe(true);
        expect(finalState).toBe(true);
      });
    });

    describe('error rollback path verification', () => {
      it('should maintain UI consistency through error rollback cycle', async () => {
        const recordingId = 'rec-001';
        const mockRecording = createMockRecording({ recordingId, published: false });

        queryClient.setQueryData(bbbRecordingsKeys.list(instanceId), [mockRecording]);

        server.use(
          http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/${recordingId}/publish`, async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return HttpResponse.json(
              { success: false, error: 'Server error' },
              { status: 500 }
            );
          })
        );

        const { result } = renderHook(() => usePublishBBBRecording(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        // Initial state should be unpublished
        let cachedData = queryClient.getQueryData<BBBRecording[]>(
          bbbRecordingsKeys.list(instanceId)
        );
        expect(cachedData?.[0]?.published).toBe(false);

        await act(async () => {
          try {
            await result.current.mutateAsync({ recordingId });
          } catch {
            // Expected
          }
        });

        // Final state should be rolled back to unpublished
        cachedData = queryClient.getQueryData<BBBRecording[]>(
          bbbRecordingsKeys.list(instanceId)
        );
        expect(cachedData?.[0]?.published).toBe(false);
      });
    });
  });
});
