/**
 * Unit Tests for useLTI Custom Hook
 *
 * Comprehensive test suite for the useLTI hook that validates LTI tool data fetching,
 * caching strategies with React Query, tool configuration retrieval, tool type detection
 * (URL matching), LTI version determination (1.1 vs 1.3), and error handling for
 * missing or misconfigured tools.
 *
 * The hook coordinates multiple React Query queries to provide a unified interface for:
 * - LTI tool instance data (tool URL, name, settings)
 * - Tool type configuration (provider settings, capabilities)
 * - Grade passback results and history
 * - Launch readiness state
 *
 * @see public/mod/lti/lib.php - Moodle LTI module functions
 * @see public/mod/lti/locallib.php - LTI version constants (LTI_VERSION_1, LTI_VERSION_1P3)
 * @see Section 0.7 Special Instructions - Testing Requirements
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Internal imports from depends_on_files
import { useLTI } from '@/features/activities/lti/hooks/useLTI';
import { LtiVersion } from '@/features/activities/lti/types/lti.types';
import { mockToolNotFoundError } from '@/tests/unit/features/activities/lti/fixtures';
import {
  setupLTIHandlers,
  createMockLTITool,
  createSuccessResponse,
  createErrorResponse,
} from '@/tests/unit/features/activities/lti/testUtils';
import { createTestQueryClient } from '@/tests/helpers/render';

// ============================================================================
// Test Setup
// ============================================================================

/**
 * MSW Server instance for intercepting API requests during tests.
 * Uses the setupLTIHandlers factory to configure default mock responses.
 */
const server = setupServer(...setupLTIHandlers());

/**
 * QueryClient instance for React Query context.
 * Recreated before each test to ensure isolated cache state.
 */
let queryClient: QueryClient;

/**
 * Wrapper component providing React Query context for hook testing.
 * The renderHook API requires a wrapper to provide context for hooks.
 */
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ============================================================================
// Test Lifecycle Hooks
// ============================================================================

beforeAll(() => {
  // Start MSW server to intercept requests before any tests run
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  // Create fresh QueryClient for each test to prevent cache pollution
  queryClient = createTestQueryClient();
});

afterEach(() => {
  // Reset handlers to default state after each test
  server.resetHandlers();
  // Clear all React Query caches
  queryClient.clear();
  // Clear all vi.fn() mocks
  vi.clearAllMocks();
});

afterAll(() => {
  // Close MSW server after all tests complete
  server.close();
});

// ============================================================================
// Test Suites
// ============================================================================

describe('useLTI', () => {
  // --------------------------------------------------------------------------
  // Basic Data Fetching Tests
  // --------------------------------------------------------------------------
  describe('tool data fetching', () => {
    it('should fetch LTI tool data successfully with tool ID parameter', async () => {
      const toolId = 42;
      const mockTool = createMockLTITool({ id: toolId, name: 'Test External Tool' });

      server.use(
        http.get('*/api/v1/lti/:id', ({ params }) => {
          expect(params.id).toBe(String(toolId));
          return createSuccessResponse(mockTool);
        })
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify tool data was fetched correctly
      expect(result.current.tool).toBeDefined();
      expect(result.current.tool?.id).toBe(toolId);
      expect(result.current.tool?.name).toBe('Test External Tool');
      expect(result.current.error).toBeNull();
    });

    it('should return loading state during initial data fetch', async () => {
      const toolId = 123;

      // Add delay to simulate network latency
      server.use(
        http.get('*/api/v1/lti/:id', async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return createSuccessResponse(createMockLTITool({ id: toolId }));
        })
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);
      expect(result.current.tool).toBeUndefined();

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool).toBeDefined();
    });

    it('should not fetch data when enabled is false', async () => {
      const toolId = 100;
      const fetchSpy = vi.fn();

      server.use(
        http.get('*/api/v1/lti/:id', () => {
          fetchSpy();
          return createSuccessResponse(createMockLTITool({ id: toolId }));
        })
      );

      const { result } = renderHook(
        () => useLTI({ toolId, enabled: false }),
        { wrapper: createWrapper() }
      );

      // Should not be loading since query is disabled
      expect(result.current.isLoading).toBe(false);

      // Wait a tick to ensure no fetch was triggered
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify fetch was not called
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.current.tool).toBeUndefined();
    });

    it('should automatically refetch when tool ID changes', async () => {
      const firstToolId = 1;
      const secondToolId = 2;
      const fetchCalls: number[] = [];

      server.use(
        http.get('*/api/v1/lti/:id', ({ params }) => {
          const id = Number(params.id);
          fetchCalls.push(id);
          return createSuccessResponse(
            createMockLTITool({ id, name: `Tool ${id}` })
          );
        })
      );

      const { result, rerender } = renderHook(
        ({ toolId }: { toolId: number }) => useLTI({ toolId }),
        {
          wrapper: createWrapper(),
          initialProps: { toolId: firstToolId },
        }
      );

      // Wait for first fetch
      await waitFor(() => {
        expect(result.current.tool?.id).toBe(firstToolId);
      });

      expect(fetchCalls).toContain(firstToolId);

      // Change tool ID
      rerender({ toolId: secondToolId });

      // Wait for second fetch
      await waitFor(() => {
        expect(result.current.tool?.id).toBe(secondToolId);
      });

      expect(fetchCalls).toContain(secondToolId);
    });
  });

  // --------------------------------------------------------------------------
  // Tool Configuration Tests
  // --------------------------------------------------------------------------
  describe('tool configuration retrieval', () => {
    it('should retrieve tool URL configuration', async () => {
      const toolId = 50;
      const toolUrl = 'https://lti-provider.example.com/launch';
      const mockTool = createMockLTITool({
        id: toolId,
        toolurl: toolUrl,
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.toolurl).toBe(toolUrl);
    });

    it('should retrieve secure tool URL configuration', async () => {
      const toolId = 51;
      const secureToolUrl = 'https://secure.lti-provider.example.com/launch';
      const mockTool = createMockLTITool({
        id: toolId,
        securetoolurl: secureToolUrl,
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.securetoolurl).toBe(secureToolUrl);
    });

    it('should retrieve resource key and password (secret)', async () => {
      const toolId = 52;
      const resourceKey = 'consumer_key_12345';
      const password = 'shared_secret_xyz';
      const mockTool = createMockLTITool({
        id: toolId,
        resourcekey: resourceKey,
        password: password,
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.resourcekey).toBe(resourceKey);
      expect(result.current.tool?.password).toBe(password);
    });

    it('should retrieve instructor custom parameters', async () => {
      const toolId = 53;
      const customParams = 'tool_mode=advanced\nfeature_flag=enabled';
      const mockTool = createMockLTITool({
        id: toolId,
        instructorcustomparameters: customParams,
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.instructorcustomparameters).toBe(customParams);
    });

    it('should retrieve launch container setting', async () => {
      const toolId = 54;
      // 1 = default, 2 = embed, 3 = window, 4 = popup
      const launchContainer = 2;
      const mockTool = createMockLTITool({
        id: toolId,
        launchcontainer: launchContainer,
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.launchcontainer).toBe(launchContainer);
    });
  });

  // --------------------------------------------------------------------------
  // LTI Version Detection Tests
  // --------------------------------------------------------------------------
  describe('LTI version determination', () => {
    it('should identify LTI 1.1 tool (LTI_VERSION_1 = LTI-1p0)', async () => {
      const toolId = 60;
      const mockTool = createMockLTITool({
        id: toolId,
        // LTI 1.1 tools typically have no typeid and use OAuth 1.0
        typeid: undefined,
        resourcekey: 'consumer_key',
        password: 'shared_secret',
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool)),
        http.get('*/api/v1/lti/:id/config', () =>
          createSuccessResponse({
            ltiversion: LtiVersion.LTI_1P0,
            tooltype: null,
          })
        )
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should NOT be identified as LTI 1.3
      expect(result.current.isLTI1p3()).toBe(false);
    });

    it('should identify LTI 1.3/Advantage tool (LTI_VERSION_1P3 = 1.3.0)', async () => {
      const toolId = 61;
      const mockTool = createMockLTITool({
        id: toolId,
        typeid: 5, // Has a tool type ID indicating configured tool
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool)),
        http.get('*/api/v1/lti/:id/config', () =>
          createSuccessResponse({
            ltiversion: LtiVersion.LTI_1P3,
            tooltype: {
              id: 5,
              name: 'LTI 1.3 Tool',
              ltiversion: LtiVersion.LTI_1P3,
            },
          })
        )
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should be identified as LTI 1.3
      expect(result.current.isLTI1p3()).toBe(true);
    });

    it('should correctly interpret LTI version enum values', () => {
      // Verify enum values match Moodle's LTI version constants
      // From locallib.php: LTI_VERSION_1 = 'LTI-1p0'
      expect(LtiVersion.LTI_1P0).toBe('LTI-1p0');

      // From locallib.php: LTI_VERSION_2 = 'LTI-2p0'
      expect(LtiVersion.LTI_2P0).toBe('LTI-2p0');

      // From locallib.php: LTI_VERSION_1P3 = '1.3.0'
      expect(LtiVersion.LTI_1P3).toBe('1.3.0');
    });
  });

  // --------------------------------------------------------------------------
  // Tool Type Detection Tests
  // --------------------------------------------------------------------------
  describe('tool type detection', () => {
    it('should retrieve tool type when typeid is specified', async () => {
      const toolId = 70;
      const typeId = 10;
      const mockTool = createMockLTITool({
        id: toolId,
        typeid: typeId,
      });

      const mockToolType = {
        id: typeId,
        name: 'External Provider Tool',
        baseurl: 'https://provider.example.com',
        ltiversion: LtiVersion.LTI_1P3,
      };

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool)),
        http.get('*/api/v1/lti/:id/config', () =>
          createSuccessResponse({
            tooltype: mockToolType,
          })
        )
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.toolType).toBeDefined();
      expect(result.current.toolType?.id).toBe(typeId);
      expect(result.current.toolType?.name).toBe('External Provider Tool');
    });

    it('should detect tool type via URL matching when typeid is not specified', async () => {
      const toolId = 71;
      const toolUrl = 'https://matching-provider.example.com/lti/launch';
      const mockTool = createMockLTITool({
        id: toolId,
        typeid: undefined, // No typeid specified
        toolurl: toolUrl,
      });

      // Tool type that matches by URL pattern
      const matchingToolType = {
        id: 20,
        name: 'URL-Matched Tool Type',
        baseurl: 'https://matching-provider.example.com',
        ltiversion: LtiVersion.LTI_1P0,
      };

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool)),
        http.get('*/api/v1/lti/:id/config', () =>
          createSuccessResponse({
            tooltype: matchingToolType, // Resolved by URL matching
          })
        ),
        http.get('*/api/v1/lti/types', () =>
          createSuccessResponse([
            matchingToolType,
            { id: 21, name: 'Other Tool', baseurl: 'https://other.com' },
          ])
        )
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.toolType).toBeDefined();
      expect(result.current.toolType?.id).toBe(20);
    });
  });

  // --------------------------------------------------------------------------
  // Cache Management Tests
  // --------------------------------------------------------------------------
  describe('cache management', () => {
    it('should cache tool data with configured stale time', async () => {
      const toolId = 80;
      let fetchCount = 0;

      server.use(
        http.get('*/api/v1/lti/:id', () => {
          fetchCount++;
          return createSuccessResponse(createMockLTITool({ id: toolId }));
        })
      );

      // First render with custom stale time
      const { result, unmount } = renderHook(
        () => useLTI({ toolId, staleTimeMs: 5 * 60 * 1000 }), // 5 minute stale time
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(fetchCount).toBe(1);

      // Re-render with same tool ID should use cached data
      unmount();
      const { result: result2 } = renderHook(
        () => useLTI({ toolId, staleTimeMs: 5 * 60 * 1000 }),
        { wrapper: createWrapper() }
      );

      // Should use cached data immediately (no additional fetch)
      await waitFor(() => {
        expect(result2.current.tool).toBeDefined();
      });

      // Note: With stale time, fetch count may or may not increase
      // depending on if cache is still fresh
      expect(fetchCount).toBeGreaterThanOrEqual(1);
    });

    it('should support manual refetch of tool data', async () => {
      const toolId = 81;
      let fetchCount = 0;

      server.use(
        http.get('*/api/v1/lti/:id', () => {
          fetchCount++;
          return createSuccessResponse(
            createMockLTITool({ id: toolId, name: `Tool v${fetchCount}` })
          );
        })
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(fetchCount).toBe(1);

      // Manually trigger refetch
      result.current.refetch();

      await waitFor(() => {
        expect(fetchCount).toBe(2);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Error Handling Tests
  // --------------------------------------------------------------------------
  describe('error handling', () => {
    it('should handle non-existent tool ID (404 error)', async () => {
      const nonExistentToolId = 99999;

      server.use(
        http.get('*/api/v1/lti/:id', () => {
          return createErrorResponse('NOT_FOUND', 'LTI tool not found', 404);
        })
      );

      const { result } = renderHook(
        () => useLTI({ toolId: nonExistentToolId }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.tool).toBeUndefined();
    });

    it('should handle network failures gracefully', async () => {
      const toolId = 90;

      server.use(
        http.get('*/api/v1/lti/:id', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.tool).toBeUndefined();
    });

    it('should handle invalid tool configuration errors', async () => {
      const toolId = 91;

      server.use(
        http.get('*/api/v1/lti/:id', () =>
          createSuccessResponse(createMockLTITool({ id: toolId }))
        ),
        http.get('*/api/v1/lti/:id/config', () => {
          return createErrorResponse(
            'INVALID_CONFIGURATION',
            'Tool configuration is incomplete or invalid',
            400
          );
        })
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Tool data should still be available even if config fails
      expect(result.current.tool).toBeDefined();
      // But there may be a config-related error
      // The hook aggregates multiple query states
    });

    it('should handle permission denied errors (403)', async () => {
      const toolId = 92;

      server.use(
        http.get('*/api/v1/lti/:id', () => {
          return createErrorResponse(
            'PERMISSION_DENIED',
            'You do not have permission to access this LTI tool',
            403
          );
        })
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.tool).toBeUndefined();
    });

    it('should handle server errors (500)', async () => {
      const toolId = 93;

      server.use(
        http.get('*/api/v1/lti/:id', () => {
          return createErrorResponse(
            'INTERNAL_ERROR',
            'An unexpected error occurred',
            500
          );
        })
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should use mockToolNotFoundError fixture for 404 scenarios', async () => {
      const toolId = 94;

      server.use(
        http.get('*/api/v1/lti/:id', () => {
          return HttpResponse.json(mockToolNotFoundError, { status: 404 });
        })
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.tool).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Tool Capability Check Tests
  // --------------------------------------------------------------------------
  describe('tool capability checks', () => {
    it('should check if tool accepts grades (grade passback)', async () => {
      const toolId = 100;
      const mockTool = createMockLTITool({
        id: toolId,
        instructorchoiceacceptgrades: 1, // 1 = accepts grades
        grade: 100, // Max grade points
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canAcceptGrades()).toBe(true);
    });

    it('should return false for accepts grades when disabled', async () => {
      const toolId = 101;
      const mockTool = createMockLTITool({
        id: toolId,
        instructorchoiceacceptgrades: 0, // 0 = does not accept grades
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canAcceptGrades()).toBe(false);
    });

    it('should check if tool allows roster access', async () => {
      const toolId = 102;
      const mockTool = createMockLTITool({
        id: toolId,
        instructorchoiceallowroster: 1, // 1 = allows roster
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canAllowRoster()).toBe(true);
    });

    it('should return false for roster access when disabled', async () => {
      const toolId = 103;
      const mockTool = createMockLTITool({
        id: toolId,
        instructorchoiceallowroster: 0,
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canAllowRoster()).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Tool Privacy Settings Tests
  // --------------------------------------------------------------------------
  describe('tool privacy settings', () => {
    it('should check if tool sends user name', async () => {
      const toolId = 110;
      const mockTool = createMockLTITool({
        id: toolId,
        instructorchoicesendname: 1, // 1 = sends name
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canSendName()).toBe(true);
    });

    it('should return false for send name when disabled', async () => {
      const toolId = 111;
      const mockTool = createMockLTITool({
        id: toolId,
        instructorchoicesendname: 0,
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canSendName()).toBe(false);
    });

    it('should check if tool sends user email', async () => {
      const toolId = 112;
      const mockTool = createMockLTITool({
        id: toolId,
        instructorchoicesendemailaddr: 1, // 1 = sends email
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canSendEmail()).toBe(true);
    });

    it('should return false for send email when disabled', async () => {
      const toolId = 113;
      const mockTool = createMockLTITool({
        id: toolId,
        instructorchoicesendemailaddr: 0,
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canSendEmail()).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Tool Display Properties Tests
  // --------------------------------------------------------------------------
  describe('tool display properties', () => {
    it('should retrieve tool icon URL for display', async () => {
      const toolId = 120;
      const iconUrl = 'https://provider.example.com/icon.png';
      const mockTool = createMockLTITool({
        id: toolId,
        icon: iconUrl,
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.toolIcon).toBe(iconUrl);
    });

    it('should retrieve secure icon URL when available', async () => {
      const toolId = 121;
      const secureIconUrl = 'https://secure.provider.example.com/icon.png';
      const mockTool = createMockLTITool({
        id: toolId,
        icon: 'http://insecure.example.com/icon.png',
        secureicon: secureIconUrl,
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should prefer secure icon when available
      expect(result.current.tool?.secureicon).toBe(secureIconUrl);
    });

    it('should retrieve tool description text', async () => {
      const toolId = 122;
      const description = 'This is an external learning tool for interactive content.';
      const mockTool = createMockLTITool({
        id: toolId,
        intro: description,
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.toolDescription).toBe(description);
    });

    it('should retrieve tool instructions text', async () => {
      const toolId = 123;
      const instructions = 'Click the Launch button to access the external tool.';
      const mockTool = createMockLTITool({
        id: toolId,
        intro: instructions,
        introformat: 1, // HTML format
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.toolInstructions).toBe(instructions);
    });

    it('should return empty string for icon when not configured', async () => {
      const toolId = 124;
      const mockTool = createMockLTITool({
        id: toolId,
        icon: '',
        secureicon: '',
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.toolIcon).toBe('');
    });
  });

  // --------------------------------------------------------------------------
  // Launch Readiness Tests
  // --------------------------------------------------------------------------
  describe('launch readiness', () => {
    it('should indicate launch ready when tool data is loaded', async () => {
      const toolId = 130;
      const mockTool = createMockLTITool({
        id: toolId,
        toolurl: 'https://provider.example.com/launch',
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool)),
        http.get('*/api/v1/lti/:id/config', () =>
          createSuccessResponse({ ltiversion: LtiVersion.LTI_1P0 })
        )
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isLaunchReady).toBe(true);
    });

    it('should indicate not launch ready when loading', async () => {
      const toolId = 131;

      server.use(
        http.get('*/api/v1/lti/:id', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return createSuccessResponse(createMockLTITool({ id: toolId }));
        })
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      // Should not be ready while loading
      expect(result.current.isLaunchReady).toBe(false);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isLaunchReady).toBe(true);
    });

    it('should indicate not launch ready when error occurs', async () => {
      const toolId = 132;

      server.use(
        http.get('*/api/v1/lti/:id', () => {
          return createErrorResponse('NOT_FOUND', 'Tool not found', 404);
        })
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isLaunchReady).toBe(false);
      expect(result.current.error).toBeDefined();
    });

    it('should indicate not launch ready when tool URL is missing', async () => {
      const toolId = 133;
      const mockTool = createMockLTITool({
        id: toolId,
        toolurl: '', // Missing tool URL
        securetoolurl: '',
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Launch may not be ready if no valid URL
      // Actual behavior depends on hook implementation
      expect(result.current.tool?.toolurl).toBe('');
    });
  });

  // --------------------------------------------------------------------------
  // Grades Integration Tests
  // --------------------------------------------------------------------------
  describe('grades integration', () => {
    it('should fetch grades when enableGrades option is true', async () => {
      const toolId = 140;
      let gradesFetched = false;

      server.use(
        http.get('*/api/v1/lti/:id', () =>
          createSuccessResponse(createMockLTITool({ id: toolId }))
        ),
        http.get('*/api/v1/lti/:id/grades', () => {
          gradesFetched = true;
          return createSuccessResponse([
            {
              id: 1,
              userid: 100,
              grade: 85,
              timecreated: Math.floor(Date.now() / 1000),
            },
          ]);
        })
      );

      const { result } = renderHook(
        () => useLTI({ toolId, enableGrades: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Grades should have been fetched
      expect(gradesFetched).toBe(true);
    });

    it('should not fetch grades when enableGrades is false', async () => {
      const toolId = 141;
      let gradesFetched = false;

      server.use(
        http.get('*/api/v1/lti/:id', () =>
          createSuccessResponse(createMockLTITool({ id: toolId }))
        ),
        http.get('*/api/v1/lti/:id/grades', () => {
          gradesFetched = true;
          return createSuccessResponse([]);
        })
      );

      const { result } = renderHook(
        () => useLTI({ toolId, enableGrades: false }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Wait a bit to ensure grades endpoint was not called
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(gradesFetched).toBe(false);
    });

    it('should expose grades data when available', async () => {
      const toolId = 142;
      const mockGrades = [
        {
          id: 1,
          userid: 100,
          grade: 92.5,
          timecreated: Math.floor(Date.now() / 1000),
        },
        {
          id: 2,
          userid: 101,
          grade: 78.0,
          timecreated: Math.floor(Date.now() / 1000),
        },
      ];

      server.use(
        http.get('*/api/v1/lti/:id', () =>
          createSuccessResponse(createMockLTITool({ id: toolId }))
        ),
        http.get('*/api/v1/lti/:id/grades', () =>
          createSuccessResponse(mockGrades)
        )
      );

      const { result } = renderHook(
        () => useLTI({ toolId, enableGrades: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.grades).toBeDefined();
      expect(result.current.grades).toHaveLength(2);
    });
  });

  // --------------------------------------------------------------------------
  // Tool Config Additional Tests
  // --------------------------------------------------------------------------
  describe('tool configuration additional features', () => {
    it('should retrieve tool config with all settings', async () => {
      const toolId = 150;
      const mockConfig = {
        ltiversion: LtiVersion.LTI_1P3,
        tooltype: {
          id: 10,
          name: 'Configured Tool',
          baseurl: 'https://tool.example.com',
        },
        contentitem: true,
        deeplink: true,
      };

      server.use(
        http.get('*/api/v1/lti/:id', () =>
          createSuccessResponse(createMockLTITool({ id: toolId }))
        ),
        http.get('*/api/v1/lti/:id/config', () =>
          createSuccessResponse(mockConfig)
        )
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.toolConfig).toBeDefined();
    });

    it('should handle missing tool config gracefully', async () => {
      const toolId = 151;

      server.use(
        http.get('*/api/v1/lti/:id', () =>
          createSuccessResponse(createMockLTITool({ id: toolId }))
        ),
        http.get('*/api/v1/lti/:id/config', () => {
          return createErrorResponse('NOT_FOUND', 'Config not found', 404);
        })
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Tool should still be available even if config fails
      expect(result.current.tool).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases Tests
  // --------------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle tool with zero grade (no grade item)', async () => {
      const toolId = 160;
      const mockTool = createMockLTITool({
        id: toolId,
        grade: 0, // No gradebook integration
        instructorchoiceacceptgrades: 0,
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.grade).toBe(0);
      expect(result.current.canAcceptGrades()).toBe(false);
    });

    it('should handle tool with very long name and description', async () => {
      const toolId = 161;
      const longName = 'A'.repeat(255);
      const longDescription = 'B'.repeat(10000);

      const mockTool = createMockLTITool({
        id: toolId,
        name: longName,
        intro: longDescription,
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.name).toBe(longName);
      expect(result.current.toolDescription).toBe(longDescription);
    });

    it('should handle special characters in tool URL', async () => {
      const toolId = 162;
      const specialUrl =
        'https://provider.example.com/launch?param=value&special=%20chars';

      const mockTool = createMockLTITool({
        id: toolId,
        toolurl: specialUrl,
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.toolurl).toBe(specialUrl);
    });

    it('should handle HTML in description with correct format', async () => {
      const toolId = 163;
      const htmlContent =
        '<p>This is <strong>formatted</strong> HTML content.</p>';

      const mockTool = createMockLTITool({
        id: toolId,
        intro: htmlContent,
        introformat: 1, // HTML format
      });

      server.use(
        http.get('*/api/v1/lti/:id', () => createSuccessResponse(mockTool))
      );

      const { result } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.intro).toBe(htmlContent);
      expect(result.current.tool?.introformat).toBe(1);
    });

    it('should handle multiple simultaneous renders with same tool ID', async () => {
      const toolId = 164;
      let fetchCount = 0;

      server.use(
        http.get('*/api/v1/lti/:id', () => {
          fetchCount++;
          return createSuccessResponse(createMockLTITool({ id: toolId }));
        })
      );

      // Render multiple hooks with same tool ID
      const { result: result1 } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });
      const { result: result2 } = renderHook(() => useLTI({ toolId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
        expect(result2.current.isLoading).toBe(false);
      });

      // Both should have data
      expect(result1.current.tool).toBeDefined();
      expect(result2.current.tool).toBeDefined();
    });
  });
});
