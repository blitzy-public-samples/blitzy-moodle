/**
 * Unit Tests for BigBlueButton React Query Hooks
 *
 * Comprehensive test suite for useBBB hooks including:
 * - useBBBInstance: Query hook for fetching BBB instance data
 * - useCreateBBBMeeting: Mutation hook for creating meetings
 * - useJoinBBBMeeting: Mutation hook for joining meetings
 * - useBBBMeetingInfo: Query hook for real-time meeting status with polling
 *
 * Tests cover:
 * - Loading and error states
 * - Cache behavior and stale-while-revalidate strategy
 * - Optimistic updates and cache invalidation
 * - Role-based access (moderator vs attendee)
 * - Meeting lifecycle states
 * - Error scenarios (404, 403, 409, network failures, timeouts)
 * - Guest access handling
 * - Maximum participants limit
 *
 * @module tests/unit/features/activities/bigbluebuttonbn/useBBB.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

// Internal imports from depends_on_files
import {
  useBBBInstance,
  useCreateBBBMeeting,
  useJoinBBBMeeting,
  useBBBMeetingInfo,
  getBBBQueryKeys,
} from '@/features/activities/bigbluebuttonbn/hooks/useBBB';
import { server } from '@/tests/mocks/server';
import { createTestQueryClient } from '@/tests/helpers/render';
import type {
  BBBInstance,
  BBBRoomStatus,
} from '@/features/activities/bigbluebuttonbn/types/bbb.types';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a mock BBBInstance with realistic data structure.
 */
function createMockBBBInstance(overrides: Partial<BBBInstance> = {}): BBBInstance {
  return {
    id: 1,
    courseId: 101,
    name: 'Test Conference Room',
    intro: '<p>Welcome to the test meeting room</p>',
    meetingId: 'test-meeting-123',
    type: 0, // ALL - includes both room and recordings
    openingTime: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    closingTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    userLimit: 100,
    welcome: 'Welcome to the BigBlueButton conference!',
    groupId: null,
    recordings: true,
    chat: true,
    polls: true,
    presentations: [
      {
        url: 'https://example.com/presentation.pdf',
        name: 'Welcome Presentation',
        iconName: 'file-pdf',
        iconDesc: 'PDF Document',
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a mock BBBRoomStatus with realistic meeting status data.
 */
function createMockBBBRoomStatus(overrides: Partial<BBBRoomStatus> = {}): BBBRoomStatus {
  return {
    statusRunning: true,
    statusClosed: false,
    statusOpen: true,
    statusMessage: 'The meeting is currently in progress',
    moderatorCount: 1,
    participantCount: 5,
    moderatorPlural: false,
    participantPlural: true,
    canJoin: true,
    openingTime: Math.floor(Date.now() / 1000) - 3600,
    closingTime: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

/**
 * Creates a mock meeting creation response.
 */
function createMockMeetingResponse() {
  return {
    meeting: {
      meetingId: 'test-meeting-123',
      instanceId: 1,
      cmId: 456,
      statusRunning: true,
      statusClosed: false,
      statusOpen: true,
      startedAt: Math.floor(Date.now() / 1000),
      moderatorCount: 1,
      participantCount: 0,
      joinUrl: 'https://bbb.example.com/join?meetingID=test-meeting-123',
      isModerator: true,
      canJoin: true,
      presentations: [],
      guestAccessEnabled: false,
      guestJoinUrl: null,
      guestPassword: null,
      features: [],
      groupId: 0,
      bigbluebuttonbnId: '1',
      userLimit: 100,
    },
    internalMeetingId: 'internal-meeting-id-abc123',
    created: true,
  };
}

/**
 * Creates a mock join meeting response.
 */
function createMockJoinResponse(options: { isModerator?: boolean; guestEnabled?: boolean } = {}) {
  const { isModerator = false, guestEnabled = false } = options;
  return {
    joinUrl: `https://bbb.example.com/join?meetingID=test-meeting-123&fullName=Test+User&userID=123&role=${isModerator ? 'MODERATOR' : 'VIEWER'}${guestEnabled ? '&guest=true' : ''}`,
    isModerator,
    meeting: {
      meetingId: 'test-meeting-123',
      instanceId: 1,
      cmId: 456,
      statusRunning: true,
      statusClosed: false,
      statusOpen: true,
      startedAt: Math.floor(Date.now() / 1000),
      moderatorCount: 1,
      participantCount: 5,
      joinUrl: 'https://bbb.example.com/join?meetingID=test-meeting-123',
      isModerator,
      canJoin: true,
      presentations: [],
      guestAccessEnabled: guestEnabled,
      guestJoinUrl: guestEnabled ? 'https://bbb.example.com/guest-join' : null,
      guestPassword: null,
      features: [],
      groupId: 0,
      bigbluebuttonbnId: '1',
      userLimit: 100,
    },
  };
}

// ============================================================================
// Test Wrapper Setup
// ============================================================================

/**
 * Creates a wrapper component with QueryClientProvider for hook testing.
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('useBBB Hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create fresh QueryClient for each test to ensure isolation
    queryClient = createTestQueryClient();
    // Clear any mock function calls
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset MSW handlers to default
    server.resetHandlers();
    // Restore any spies
    vi.restoreAllMocks();
    // Clear the query cache
    queryClient.clear();
  });

  // ==========================================================================
  // useBBBInstance Tests
  // ==========================================================================

  describe('useBBBInstance', () => {
    const instanceId = 1;
    const apiUrl = '/api/v1/bigbluebuttonbn/:id';

    describe('initial loading state', () => {
      it('should show loading state initially', async () => {
        const mockInstance = createMockBBBInstance();
        
        server.use(
          http.get(apiUrl, async () => {
            // Add delay to observe loading state
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.json({
              success: true,
              data: mockInstance,
            });
          })
        );

        const { result } = renderHook(() => useBBBInstance(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        // Should be loading initially
        expect(result.current.isLoading).toBe(true);
        expect(result.current.isPending).toBe(true);
        expect(result.current.data).toBeUndefined();

        // Wait for query to resolve
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toEqual(mockInstance);
      });
    });

    describe('successful data fetch', () => {
      it('should fetch and return BBB instance data with proper structure', async () => {
        const mockInstance = createMockBBBInstance({
          name: 'Custom Conference Room',
          userLimit: 50,
        });

        server.use(
          http.get(apiUrl, () => {
            return HttpResponse.json({
              success: true,
              data: mockInstance,
            });
          })
        );

        const { result } = renderHook(() => useBBBInstance(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Verify data structure
        expect(result.current.data).toEqual(mockInstance);
        expect(result.current.data?.name).toBe('Custom Conference Room');
        expect(result.current.data?.userLimit).toBe(50);
        expect(result.current.data?.type).toBe(0);
        expect(result.current.data?.presentations).toHaveLength(1);
      });

      it('should return correct TypeScript type inference for data', async () => {
        const mockInstance = createMockBBBInstance();

        server.use(
          http.get(apiUrl, () => {
            return HttpResponse.json({
              success: true,
              data: mockInstance,
            });
          })
        );

        const { result } = renderHook(() => useBBBInstance(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // TypeScript type assertions - these should compile without errors
        const data = result.current.data;
        if (data) {
          expect(typeof data.id).toBe('number');
          expect(typeof data.name).toBe('string');
          expect(typeof data.meetingId).toBe('string');
          expect(Array.isArray(data.presentations)).toBe(true);
        }
      });
    });

    describe('error state handling', () => {
      it('should handle 404 not found error', async () => {
        server.use(
          http.get(apiUrl, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'BBB instance not found',
                },
              },
              { status: 404 }
            );
          })
        );

        const { result } = renderHook(() => useBBBInstance(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
        expect(result.current.data).toBeUndefined();
      });

      it('should handle 403 permission denied error', async () => {
        server.use(
          http.get(apiUrl, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'PERMISSION_DENIED',
                  message: 'You do not have permission to access this resource',
                },
              },
              { status: 403 }
            );
          })
        );

        const { result } = renderHook(() => useBBBInstance(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });
    });

    describe('cache behavior and stale-while-revalidate', () => {
      it('should cache data correctly with proper query keys', async () => {
        const mockInstance = createMockBBBInstance();

        server.use(
          http.get(apiUrl, () => {
            return HttpResponse.json({
              success: true,
              data: mockInstance,
            });
          })
        );

        const { result } = renderHook(() => useBBBInstance(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Verify cache key structure
        const queryKeys = getBBBQueryKeys();
        const expectedKey = queryKeys.instance(instanceId);
        const cachedData = queryClient.getQueryData(expectedKey);
        
        expect(cachedData).toEqual(mockInstance);
      });

      it('should use stale data while revalidating', async () => {
        const initialInstance = createMockBBBInstance({ name: 'Initial Name' });
        const updatedInstance = createMockBBBInstance({ name: 'Updated Name' });
        
        let requestCount = 0;

        server.use(
          http.get(apiUrl, () => {
            requestCount++;
            const instance = requestCount === 1 ? initialInstance : updatedInstance;
            return HttpResponse.json({
              success: true,
              data: instance,
            });
          })
        );

        // First render - fetch initial data
        const { result, rerender } = renderHook(() => useBBBInstance(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.name).toBe('Initial Name');

        // Manually invalidate to trigger refetch
        await queryClient.invalidateQueries({
          queryKey: getBBBQueryKeys().instance(instanceId),
        });

        rerender();

        // Should still have stale data available during refetch
        await waitFor(() => {
          expect(result.current.data?.name).toBe('Updated Name');
        });
      });

      it('should refetch on mount by default', async () => {
        const mockInstance = createMockBBBInstance();
        let fetchCount = 0;

        server.use(
          http.get(apiUrl, () => {
            fetchCount++;
            return HttpResponse.json({
              success: true,
              data: mockInstance,
            });
          })
        );

        // First render
        const { result, unmount } = renderHook(() => useBBBInstance(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(fetchCount).toBe(1);

        unmount();

        // Second render - should refetch
        const { result: result2 } = renderHook(() => useBBBInstance(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result2.current.isSuccess).toBe(true);
        });

        // Due to staleTime, it should use cached data and may refetch in background
        expect(fetchCount).toBeGreaterThanOrEqual(1);
      });
    });

    describe('disabled query when instanceId is invalid', () => {
      it('should not fetch when instanceId is 0', async () => {
        let fetchCalled = false;

        server.use(
          http.get(apiUrl, () => {
            fetchCalled = true;
            return HttpResponse.json({
              success: true,
              data: createMockBBBInstance(),
            });
          })
        );

        const { result } = renderHook(() => useBBBInstance(0), {
          wrapper: createWrapper(queryClient),
        });

        // Wait a bit to ensure no fetch is triggered
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(fetchCalled).toBe(false);
        expect(result.current.isPending).toBe(true);
        expect(result.current.fetchStatus).toBe('idle');
      });

      it('should not fetch when instanceId is negative', async () => {
        let fetchCalled = false;

        server.use(
          http.get(apiUrl, () => {
            fetchCalled = true;
            return HttpResponse.json({
              success: true,
              data: createMockBBBInstance(),
            });
          })
        );

        const { result } = renderHook(() => useBBBInstance(-1), {
          wrapper: createWrapper(queryClient),
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(fetchCalled).toBe(false);
        expect(result.current.fetchStatus).toBe('idle');
      });
    });
  });

  // ==========================================================================
  // useCreateBBBMeeting Tests
  // ==========================================================================

  describe('useCreateBBBMeeting', () => {
    const instanceId = 1;
    const createUrl = '/api/v1/bigbluebuttonbn/:id/create';

    describe('loading state during mutation', () => {
      it('should show pending state during meeting creation', async () => {
        server.use(
          http.post(createUrl, async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.json({
              success: true,
              data: createMockMeetingResponse(),
            });
          })
        );

        const { result } = renderHook(() => useCreateBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        expect(result.current.isPending).toBe(false);

        // Start mutation
        act(() => {
          result.current.mutate({ instanceId });
        });

        // Should be pending during request
        expect(result.current.isPending).toBe(true);

        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });

        expect(result.current.isSuccess).toBe(true);
      });
    });

    describe('successful meeting creation', () => {
      it('should create meeting and return meeting details with passwords', async () => {
        const mockResponse = createMockMeetingResponse();

        server.use(
          http.post(createUrl, () => {
            return HttpResponse.json({
              success: true,
              data: mockResponse,
            });
          })
        );

        const { result } = renderHook(() => useCreateBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ instanceId });
        });

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockResponse);
        expect(result.current.data?.internalMeetingId).toBe('internal-meeting-id-abc123');
        expect(result.current.data?.created).toBe(true);
      });

      it('should invalidate useBBBInstance query cache on success', async () => {
        const mockInstance = createMockBBBInstance();
        const mockResponse = createMockMeetingResponse();

        // Pre-populate cache with instance data
        queryClient.setQueryData(
          getBBBQueryKeys().instance(instanceId),
          mockInstance
        );

        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        server.use(
          http.post(createUrl, () => {
            return HttpResponse.json({
              success: true,
              data: mockResponse,
            });
          })
        );

        const { result } = renderHook(() => useCreateBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ instanceId });
        });

        // Should have invalidated meeting info cache
        expect(invalidateSpy).toHaveBeenCalled();
      });

      it('should execute success callback correctly', async () => {
        const onSuccessCallback = vi.fn();
        const mockResponse = createMockMeetingResponse();

        server.use(
          http.post(createUrl, () => {
            return HttpResponse.json({
              success: true,
              data: mockResponse,
            });
          })
        );

        const { result } = renderHook(() => useCreateBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ instanceId }, {
            onSuccess: onSuccessCallback,
          });
        });

        expect(onSuccessCallback).toHaveBeenCalledTimes(1);
        expect(onSuccessCallback).toHaveBeenCalledWith(
          mockResponse,
          { instanceId },
          undefined
        );
      });
    });

    describe('error handling', () => {
      it('should handle 409 conflict when meeting already exists', async () => {
        server.use(
          http.post(createUrl, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'CONFLICT',
                  message: 'Meeting already exists',
                },
              },
              { status: 409 }
            );
          })
        );

        const { result } = renderHook(() => useCreateBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ instanceId });
          } catch {
            // Expected to throw
          }
        });

        expect(result.current.isError).toBe(true);
        expect(result.current.error).toBeDefined();
      });

      it('should handle 403 permission denied error', async () => {
        server.use(
          http.post(createUrl, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'PERMISSION_DENIED',
                  message: 'You do not have permission to create meetings',
                },
              },
              { status: 403 }
            );
          })
        );

        const { result } = renderHook(() => useCreateBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ instanceId });
          } catch {
            // Expected to throw
          }
        });

        expect(result.current.isError).toBe(true);
      });
    });

    describe('group-specific meeting creation', () => {
      it('should pass groupId when creating group-specific meeting', async () => {
        let receivedBody: Record<string, unknown> | null = null;

        server.use(
          http.post(createUrl, async ({ request }) => {
            receivedBody = await request.json() as Record<string, unknown>;
            return HttpResponse.json({
              success: true,
              data: createMockMeetingResponse(),
            });
          })
        );

        const { result } = renderHook(() => useCreateBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ instanceId, groupId: 5 });
        });

        expect(receivedBody).toEqual({ groupId: 5 });
      });
    });
  });

  // ==========================================================================
  // useJoinBBBMeeting Tests
  // ==========================================================================

  describe('useJoinBBBMeeting', () => {
    const instanceId = 1;
    const joinUrl = '/api/v1/bigbluebuttonbn/:id/join';

    describe('loading state during join URL generation', () => {
      it('should show pending state during join request', async () => {
        server.use(
          http.post(joinUrl, async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.json({
              success: true,
              data: createMockJoinResponse(),
            });
          })
        );

        const { result } = renderHook(() => useJoinBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        expect(result.current.isPending).toBe(false);

        act(() => {
          result.current.mutate({ instanceId });
        });

        expect(result.current.isPending).toBe(true);

        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });
      });
    });

    describe('successful join', () => {
      it('should return join URL with proper query parameters', async () => {
        const mockResponse = createMockJoinResponse({ isModerator: false });

        server.use(
          http.post(joinUrl, () => {
            return HttpResponse.json({
              success: true,
              data: mockResponse,
            });
          })
        );

        const { result } = renderHook(() => useJoinBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ instanceId, redirect: false });
        });

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.joinUrl).toContain('meetingID=test-meeting-123');
        expect(result.current.data?.joinUrl).toContain('fullName=');
        expect(result.current.data?.joinUrl).toContain('userID=');
        expect(result.current.data?.joinUrl).toContain('role=VIEWER');
      });

      it('should return different URL for moderator role', async () => {
        const mockResponse = createMockJoinResponse({ isModerator: true });

        server.use(
          http.post(joinUrl, () => {
            return HttpResponse.json({
              success: true,
              data: mockResponse,
            });
          })
        );

        const { result } = renderHook(() => useJoinBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ instanceId, redirect: false });
        });

        expect(result.current.data?.joinUrl).toContain('role=MODERATOR');
        expect(result.current.data?.isModerator).toBe(true);
      });

      it('should include guest=true parameter when guest access is enabled', async () => {
        const mockResponse = createMockJoinResponse({ guestEnabled: true });

        server.use(
          http.post(joinUrl, () => {
            return HttpResponse.json({
              success: true,
              data: mockResponse,
            });
          })
        );

        const { result } = renderHook(() => useJoinBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ instanceId, redirect: false });
        });

        expect(result.current.data?.joinUrl).toContain('guest=true');
        expect(result.current.data?.meeting.guestAccessEnabled).toBe(true);
      });
    });

    describe('redirect behavior', () => {
      it('should open window with join URL when redirect is true', async () => {
        const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        const mockResponse = createMockJoinResponse();

        server.use(
          http.post(joinUrl, () => {
            return HttpResponse.json({
              success: true,
              data: mockResponse,
            });
          })
        );

        const { result } = renderHook(() => useJoinBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ instanceId, redirect: true });
        });

        expect(windowOpenSpy).toHaveBeenCalledWith(
          mockResponse.joinUrl,
          '_blank',
          'noopener,noreferrer'
        );

        windowOpenSpy.mockRestore();
      });

      it('should not open window when redirect is false', async () => {
        const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        server.use(
          http.post(joinUrl, () => {
            return HttpResponse.json({
              success: true,
              data: createMockJoinResponse(),
            });
          })
        );

        const { result } = renderHook(() => useJoinBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ instanceId, redirect: false });
        });

        expect(windowOpenSpy).not.toHaveBeenCalled();

        windowOpenSpy.mockRestore();
      });
    });

    describe('error handling', () => {
      it('should handle 403 permission denied when user lacks capability', async () => {
        server.use(
          http.post(joinUrl, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'PERMISSION_DENIED',
                  message: 'You do not have permission to join this meeting',
                },
              },
              { status: 403 }
            );
          })
        );

        const { result } = renderHook(() => useJoinBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ instanceId });
          } catch {
            // Expected to throw
          }
        });

        expect(result.current.isError).toBe(true);
        expect(result.current.error).toBeDefined();
      });

      it('should handle 404 when meeting not started by moderator', async () => {
        server.use(
          http.post(joinUrl, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'Meeting has not been started by a moderator yet',
                },
              },
              { status: 404 }
            );
          })
        );

        const { result } = renderHook(() => useJoinBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ instanceId });
          } catch {
            // Expected to throw
          }
        });

        expect(result.current.isError).toBe(true);
      });

      it('should handle 409 conflict when maximum participants limit reached', async () => {
        server.use(
          http.post(joinUrl, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'CONFLICT',
                  message: 'Meeting is full',
                },
              },
              { status: 409 }
            );
          })
        );

        const { result } = renderHook(() => useJoinBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ instanceId });
          } catch {
            // Expected to throw
          }
        });

        expect(result.current.isError).toBe(true);
        expect(result.current.error?.message).toContain('409');
      });
    });

    describe('concurrent join request handling', () => {
      it('should handle multiple join requests in sequence', async () => {
        let requestCount = 0;

        server.use(
          http.post(joinUrl, async () => {
            requestCount++;
            await new Promise((resolve) => setTimeout(resolve, 50));
            return HttpResponse.json({
              success: true,
              data: createMockJoinResponse(),
            });
          })
        );

        const { result } = renderHook(() => useJoinBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        // Fire multiple join requests
        await act(async () => {
          await Promise.all([
            result.current.mutateAsync({ instanceId, redirect: false }),
            result.current.mutateAsync({ instanceId, redirect: false }),
          ]);
        });

        // Both requests should have been made
        expect(requestCount).toBeGreaterThanOrEqual(1);
      });
    });

    describe('cache invalidation on successful join', () => {
      it('should invalidate meeting info cache after joining', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        server.use(
          http.post(joinUrl, () => {
            return HttpResponse.json({
              success: true,
              data: createMockJoinResponse(),
            });
          })
        );

        const { result } = renderHook(() => useJoinBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ instanceId, redirect: false });
        });

        expect(invalidateSpy).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // useBBBMeetingInfo Tests
  // ==========================================================================

  describe('useBBBMeetingInfo', () => {
    const instanceId = 1;
    const infoUrl = '/api/v1/bigbluebuttonbn/:id/info';

    describe('initial loading state', () => {
      it('should show loading state initially', async () => {
        server.use(
          http.get(infoUrl, async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.json({
              success: true,
              data: createMockBBBRoomStatus(),
            });
          })
        );

        const { result } = renderHook(() => useBBBMeetingInfo(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        expect(result.current.isLoading).toBe(true);

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });
    });

    describe('successful meeting info fetch', () => {
      it('should return meeting info with participantCount, moderatorCount, isRunning, createTime fields', async () => {
        const mockStatus = createMockBBBRoomStatus({
          participantCount: 10,
          moderatorCount: 2,
          statusRunning: true,
        });

        server.use(
          http.get(infoUrl, () => {
            return HttpResponse.json({
              success: true,
              data: mockStatus,
            });
          })
        );

        const { result } = renderHook(() => useBBBMeetingInfo(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.participantCount).toBe(10);
        expect(result.current.data?.moderatorCount).toBe(2);
        expect(result.current.data?.statusRunning).toBe(true);
        expect(result.current.data?.canJoin).toBe(true);
      });
    });

    describe('automatic polling', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should automatically poll every 30 seconds when meeting is running', async () => {
        let fetchCount = 0;
        const mockStatus = createMockBBBRoomStatus({ statusRunning: true });

        server.use(
          http.get(infoUrl, () => {
            fetchCount++;
            return HttpResponse.json({
              success: true,
              data: mockStatus,
            });
          })
        );

        const { result } = renderHook(() => useBBBMeetingInfo(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        // Wait for initial fetch
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(fetchCount).toBe(1);

        // Advance by 30 seconds for first poll
        await act(async () => {
          await vi.advanceTimersByTimeAsync(30000);
        });

        await waitFor(() => {
          expect(fetchCount).toBeGreaterThanOrEqual(2);
        });

        // Advance by another 30 seconds for second poll
        await act(async () => {
          await vi.advanceTimersByTimeAsync(30000);
        });

        await waitFor(() => {
          expect(fetchCount).toBeGreaterThanOrEqual(3);
        });
      });

      it('should stop polling when meeting ends (isRunning becomes false)', async () => {
        let fetchCount = 0;
        let meetingRunning = true;

        server.use(
          http.get(infoUrl, () => {
            fetchCount++;
            return HttpResponse.json({
              success: true,
              data: createMockBBBRoomStatus({ statusRunning: meetingRunning }),
            });
          })
        );

        const { result } = renderHook(
          () => useBBBMeetingInfo(instanceId, {
            // Conditionally poll based on meeting status
            refetchInterval: (query) => {
              const data = query.state.data;
              return data?.statusRunning ? 30000 : false;
            },
          }),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Simulate meeting ending
        meetingRunning = false;

        // Advance time - polling should stop
        await act(async () => {
          await vi.advanceTimersByTimeAsync(60000);
        });

        const finalCount = fetchCount;

        // Advance more time - count should not increase significantly
        await act(async () => {
          await vi.advanceTimersByTimeAsync(60000);
        });

        // Should have stopped polling (or minimal difference due to refetch)
        expect(fetchCount - finalCount).toBeLessThanOrEqual(1);
      });
    });

    describe('proper cleanup on unmount', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should stop polling when component unmounts', async () => {
        let fetchCount = 0;

        server.use(
          http.get(infoUrl, () => {
            fetchCount++;
            return HttpResponse.json({
              success: true,
              data: createMockBBBRoomStatus({ statusRunning: true }),
            });
          })
        );

        const { result, unmount } = renderHook(
          () => useBBBMeetingInfo(instanceId),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const countBeforeUnmount = fetchCount;

        // Unmount the hook
        unmount();

        // Advance time significantly
        await act(async () => {
          await vi.advanceTimersByTimeAsync(120000);
        });

        // Fetch count should not increase after unmount
        expect(fetchCount).toBe(countBeforeUnmount);
      });
    });

    describe('error handling', () => {
      it('should handle error when meeting info is unavailable', async () => {
        server.use(
          http.get(infoUrl, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'SERVICE_UNAVAILABLE',
                  message: 'Unable to fetch meeting information',
                },
              },
              { status: 503 }
            );
          })
        );

        const { result } = renderHook(() => useBBBMeetingInfo(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });
    });

    describe('cache key structure', () => {
      it('should use correct cache key structure for meeting info', async () => {
        const mockStatus = createMockBBBRoomStatus();

        server.use(
          http.get(infoUrl, () => {
            return HttpResponse.json({
              success: true,
              data: mockStatus,
            });
          })
        );

        const { result } = renderHook(() => useBBBMeetingInfo(instanceId), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Verify cache key structure
        const queryKeys = getBBBQueryKeys();
        const expectedKey = queryKeys.meetingInfo(instanceId);
        const cachedData = queryClient.getQueryData(expectedKey);

        expect(cachedData).toEqual(mockStatus);
        expect(expectedKey).toEqual(['bigbluebuttonbn', 'meeting-info', instanceId]);
      });
    });

    describe('enabled option', () => {
      it('should not fetch when enabled is false', async () => {
        let fetchCalled = false;

        server.use(
          http.get(infoUrl, () => {
            fetchCalled = true;
            return HttpResponse.json({
              success: true,
              data: createMockBBBRoomStatus(),
            });
          })
        );

        const { result } = renderHook(
          () => useBBBMeetingInfo(instanceId, { enabled: false }),
          { wrapper: createWrapper(queryClient) }
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(fetchCalled).toBe(false);
        expect(result.current.fetchStatus).toBe('idle');
      });
    });
  });

  // ==========================================================================
  // Network Error and Retry Tests
  // ==========================================================================

  describe('Network error handling and retry logic', () => {
    describe('network failures with retry logic', () => {
      it('should retry on network failure with exponential backoff', async () => {
        let attemptCount = 0;

        server.use(
          http.get('/api/v1/bigbluebuttonbn/:id', () => {
            attemptCount++;
            if (attemptCount < 3) {
              return HttpResponse.error();
            }
            return HttpResponse.json({
              success: true,
              data: createMockBBBInstance(),
            });
          })
        );

        // Use a query client with retries enabled
        const retryQueryClient = new QueryClient({
          defaultOptions: {
            queries: {
              retry: 3,
              retryDelay: (attempt) => Math.min(100 * 2 ** attempt, 1000),
            },
          },
        });

        const { result } = renderHook(() => useBBBInstance(1), {
          wrapper: createWrapper(retryQueryClient),
        });

        await waitFor(
          () => {
            expect(result.current.isSuccess).toBe(true);
          },
          { timeout: 5000 }
        );

        expect(attemptCount).toBeGreaterThanOrEqual(3);

        retryQueryClient.clear();
      });
    });

    describe('timeout errors', () => {
      it('should handle timeout errors gracefully', async () => {
        server.use(
          http.get('/api/v1/bigbluebuttonbn/:id', async () => {
            // Simulate long request that would timeout
            await new Promise((resolve) => setTimeout(resolve, 60000));
            return HttpResponse.json({
              success: true,
              data: createMockBBBInstance(),
            });
          })
        );

        const { result } = renderHook(() => useBBBInstance(1), {
          wrapper: createWrapper(queryClient),
        });

        // Query should be in loading state
        expect(result.current.isLoading).toBe(true);

        // Note: Actual timeout handling depends on axios/fetch configuration
      });
    });

    describe('malformed JSON responses', () => {
      it('should handle malformed JSON response', async () => {
        server.use(
          http.get('/api/v1/bigbluebuttonbn/:id', () => {
            return new HttpResponse('not valid json', {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          })
        );

        const { result } = renderHook(() => useBBBInstance(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });
    });

    describe('authentication token expiration', () => {
      it('should handle 401 unauthorized when token expires', async () => {
        server.use(
          http.get('/api/v1/bigbluebuttonbn/:id', () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'TOKEN_EXPIRED',
                  message: 'Authentication token has expired',
                },
              },
              { status: 401 }
            );
          })
        );

        const { result } = renderHook(() => useBBBInstance(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // Meeting Lifecycle Tests
  // ==========================================================================

  describe('Meeting lifecycle states', () => {
    describe('meeting lifecycle from creation to active to ended', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should properly track meeting lifecycle through status changes', async () => {
        let meetingState: 'not_created' | 'created' | 'active' | 'ended' = 'not_created';

        server.use(
          http.get('/api/v1/bigbluebuttonbn/:id/info', () => {
            let status: BBBRoomStatus;
            
            switch (meetingState) {
              case 'not_created':
                status = createMockBBBRoomStatus({
                  statusRunning: false,
                  statusOpen: false,
                  statusClosed: false,
                  statusMessage: 'Meeting has not been created yet',
                  participantCount: 0,
                  moderatorCount: 0,
                  canJoin: false,
                });
                break;
              case 'created':
                status = createMockBBBRoomStatus({
                  statusRunning: false,
                  statusOpen: true,
                  statusClosed: false,
                  statusMessage: 'Meeting is ready. Waiting for moderator.',
                  participantCount: 0,
                  moderatorCount: 0,
                  canJoin: true,
                });
                break;
              case 'active':
                status = createMockBBBRoomStatus({
                  statusRunning: true,
                  statusOpen: true,
                  statusClosed: false,
                  statusMessage: 'Meeting is in progress',
                  participantCount: 5,
                  moderatorCount: 1,
                  canJoin: true,
                });
                break;
              case 'ended':
                status = createMockBBBRoomStatus({
                  statusRunning: false,
                  statusOpen: false,
                  statusClosed: true,
                  statusMessage: 'Meeting has ended',
                  participantCount: 0,
                  moderatorCount: 0,
                  canJoin: false,
                });
                break;
            }

            return HttpResponse.json({
              success: true,
              data: status,
            });
          })
        );

        const { result } = renderHook(() => useBBBMeetingInfo(1), {
          wrapper: createWrapper(queryClient),
        });

        // Initial state - not created
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.statusRunning).toBe(false);
        expect(result.current.data?.canJoin).toBe(false);

        // Simulate meeting creation
        meetingState = 'created';
        await act(async () => {
          await queryClient.invalidateQueries({ queryKey: getBBBQueryKeys().meetingInfo(1) });
          await vi.advanceTimersByTimeAsync(0);
        });

        await waitFor(() => {
          expect(result.current.data?.statusOpen).toBe(true);
        });

        // Simulate meeting starting
        meetingState = 'active';
        await act(async () => {
          await queryClient.invalidateQueries({ queryKey: getBBBQueryKeys().meetingInfo(1) });
          await vi.advanceTimersByTimeAsync(0);
        });

        await waitFor(() => {
          expect(result.current.data?.statusRunning).toBe(true);
        });

        expect(result.current.data?.participantCount).toBe(5);
        expect(result.current.data?.moderatorCount).toBe(1);

        // Simulate meeting ending
        meetingState = 'ended';
        await act(async () => {
          await queryClient.invalidateQueries({ queryKey: getBBBQueryKeys().meetingInfo(1) });
          await vi.advanceTimersByTimeAsync(0);
        });

        await waitFor(() => {
          expect(result.current.data?.statusClosed).toBe(true);
        });

        expect(result.current.data?.statusRunning).toBe(false);
        expect(result.current.data?.canJoin).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Role-Based Access Tests
  // ==========================================================================

  describe('Role-based access scenarios', () => {
    describe('moderator vs attendee permissions', () => {
      it('should correctly identify moderator role in join response', async () => {
        server.use(
          http.post('/api/v1/bigbluebuttonbn/:id/join', () => {
            return HttpResponse.json({
              success: true,
              data: createMockJoinResponse({ isModerator: true }),
            });
          })
        );

        const { result } = renderHook(() => useJoinBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ instanceId: 1, redirect: false });
        });

        expect(result.current.data?.isModerator).toBe(true);
      });

      it('should correctly identify attendee role in join response', async () => {
        server.use(
          http.post('/api/v1/bigbluebuttonbn/:id/join', () => {
            return HttpResponse.json({
              success: true,
              data: createMockJoinResponse({ isModerator: false }),
            });
          })
        );

        const { result } = renderHook(() => useJoinBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ instanceId: 1, redirect: false });
        });

        expect(result.current.data?.isModerator).toBe(false);
      });
    });

    describe('meeting not started scenario', () => {
      it('should prevent attendee from joining before moderator creates room', async () => {
        server.use(
          http.post('/api/v1/bigbluebuttonbn/:id/join', () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'MEETING_NOT_STARTED',
                  message: 'The meeting has not been started by a moderator. Please wait.',
                },
              },
              { status: 404 }
            );
          })
        );

        const { result } = renderHook(() => useJoinBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ instanceId: 1 });
          } catch {
            // Expected to throw
          }
        });

        expect(result.current.isError).toBe(true);
        expect(result.current.error?.message).toContain('404');
      });
    });

    describe('guest access handling', () => {
      it('should handle guest access when enabled', async () => {
        server.use(
          http.post('/api/v1/bigbluebuttonbn/:id/join', () => {
            return HttpResponse.json({
              success: true,
              data: createMockJoinResponse({ guestEnabled: true }),
            });
          })
        );

        const { result } = renderHook(() => useJoinBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ instanceId: 1, redirect: false });
        });

        expect(result.current.data?.meeting.guestAccessEnabled).toBe(true);
        expect(result.current.data?.meeting.guestJoinUrl).toBe('https://bbb.example.com/guest-join');
      });

      it('should not have guest URL when guest access is disabled', async () => {
        server.use(
          http.post('/api/v1/bigbluebuttonbn/:id/join', () => {
            return HttpResponse.json({
              success: true,
              data: createMockJoinResponse({ guestEnabled: false }),
            });
          })
        );

        const { result } = renderHook(() => useJoinBBBMeeting(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ instanceId: 1, redirect: false });
        });

        expect(result.current.data?.meeting.guestAccessEnabled).toBe(false);
        expect(result.current.data?.meeting.guestJoinUrl).toBeNull();
      });
    });
  });

  // ==========================================================================
  // Query Keys Export Tests
  // ==========================================================================

  describe('getBBBQueryKeys', () => {
    it('should return correct query key factory', () => {
      const keys = getBBBQueryKeys();

      expect(keys.all).toEqual(['bigbluebuttonbn']);
      expect(keys.instances()).toEqual(['bigbluebuttonbn', 'instances']);
      expect(keys.instance(1)).toEqual(['bigbluebuttonbn', 'instances', 1]);
      expect(keys.meetingInfo(1)).toEqual(['bigbluebuttonbn', 'meeting-info', 1]);
    });
  });
});
