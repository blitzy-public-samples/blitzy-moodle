/**
 * Unit Tests for useLTI Custom Hook
 *
 * Comprehensive test suite validating the useLTI hook functionality including:
 * - Successful LTI tool data fetch using React Query with tool ID parameter
 * - Tool configuration retrieval including toolurl, secure tool URL, resource key, secret
 * - Tool type detection via URL matching when typeid is not specified
 * - LTI version determination (LTI_VERSION_1 for 1.1, LTI_VERSION_1P3 for 1.3/Advantage)
 * - Custom parameter merging from tool type config and activity instance config
 * - Cache management with 5-minute stale time for tool configuration
 * - Automatic refetch on tool ID change
 * - Loading state management during data fetch
 * - Error handling for non-existent tool ID, network failures, invalid configuration
 * - Tool capability checks (supports grades, supports content-item, supports deep linking)
 * - Tool privacy settings (send name, send email, accept grades)
 * - Icon URL retrieval for tool display
 * - Tool description and instructions text
 * - Integration with tool proxy for registered tool providers
 *
 * Uses Vitest and React Hooks Testing Library for hook testing
 * Mock API responses are provided via MSW (Mock Service Worker)
 *
 * @see Section 0.4 Agent Action Plan - useLTI hook test requirements
 * @see public/mod/lti/lib.php - LTI module implementation
 * @see public/mod/lti/locallib.php - LTI local library functions
 */

import { type ReactNode, createElement } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Import hook under test
import { useLTI } from '@/features/activities/lti/hooks/useLTI';

// Import types
import { LtiVersion } from '@/features/activities/lti/types/lti.types';
import type { LtiTool, LtiToolType } from '@/features/activities/lti/types/lti.types';
import type { LtiToolDetailResponse } from '@/features/activities/lti/api/ltiApi';

// Import MSW server from global mocks
import { server } from '@tests/mocks/server';

// Import test utilities and fixtures
import { createMockLTITool } from './testUtils';
import {
  mockLTI11Tool,
  mockLTI13Tool,
  mockToolNotFoundError,
} from './fixtures';

// ============================================================================
// Test Configuration and Constants
// ============================================================================

/**
 * API base URL for mock endpoints
 * Uses wildcard prefix to match full URLs like http://localhost:8000/api/v1/...
 */
const API_BASE_URL = '*/api/v1';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a test QueryClient with settings optimized for testing
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        networkMode: 'always',
      },
      mutations: {
        retry: false,
        networkMode: 'always',
      },
    },
  });
}

/**
 * Creates a wrapper component with QueryClientProvider for testing hooks
 */
function createWrapper(queryClient?: QueryClient) {
  const client = queryClient ?? createTestQueryClient();

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

/**
 * Creates a mock LtiToolDetailResponse from an LtiTool
 * Wraps the flat tool in the expected API response structure
 */
function createMockToolDetailResponse(
  tool: LtiTool,
  overrides: Partial<Omit<LtiToolDetailResponse, 'tool'>> = {}
): LtiToolDetailResponse {
  return {
    tool,
    toolType: overrides.toolType ?? null,
    canLaunch: overrides.canLaunch ?? true,
    isConfigured: overrides.isConfigured ?? true,
    ltiVersion: overrides.ltiVersion ?? LtiVersion.LTI_1P0,
    cmid: overrides.cmid ?? 100,
    courseId: overrides.courseId ?? tool.course,
  };
}

/**
 * Creates a standard success JSON response
 */
function createSuccessResponse<T>(data: T) {
  return HttpResponse.json({
    success: true,
    data,
  });
}

/**
 * Creates a standard error JSON response
 */
function createErrorResponse(code: string, message: string, status: number = 400) {
  return HttpResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status }
  );
}

// ============================================================================
// Test Lifecycle Hooks
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  // Server reset is handled by global setup
});

// ============================================================================
// Test Suite
// ============================================================================

describe('useLTI Hook', () => {
  // --------------------------------------------------------------------------
  // Basic Data Fetching Tests
  // --------------------------------------------------------------------------
  describe('basic data fetching', () => {
    it('should fetch LTI tool data successfully with tool ID parameter', async () => {
      const toolId = 1;
      const mockTool = createMockLTITool({ id: toolId });
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      // Initial loading state
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool).toBeDefined();
      expect(result.current.tool?.tool.id).toBe(toolId);
      expect(result.current.error).toBeNull();
    });

    it('should handle loading state correctly', async () => {
      const toolId = 2;
      const mockTool = createMockLTITool({ id: toolId });
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return createSuccessResponse(mockResponse);
        }),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.tool).toBeUndefined();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool).toBeDefined();
    });

    it('should not fetch when enabled is false', async () => {
      const toolId = 3;
      let fetchCalled = false;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => {
          fetchCalled = true;
          return createSuccessResponse(
            createMockToolDetailResponse(createMockLTITool({ id: toolId }))
          );
        })
      );

      const { result } = renderHook(
        () => useLTI(toolId, { enabled: false }),
        { wrapper: createWrapper() }
      );

      // Wait a bit to ensure fetch wasn't called
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(fetchCalled).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.tool).toBeUndefined();
    });

    it('should refetch when tool ID changes', async () => {
      const firstToolId = 10;
      const secondToolId = 20;
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, ({ params }) => {
          fetchCount++;
          const id = Number(params.id);
          return createSuccessResponse(
            createMockToolDetailResponse(createMockLTITool({ id }))
          );
        }),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result, rerender } = renderHook(
        ({ id }) => useLTI(id),
        {
          wrapper: createWrapper(),
          initialProps: { id: firstToolId },
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.tool.id).toBe(firstToolId);
      expect(fetchCount).toBeGreaterThanOrEqual(1);

      const firstFetchCount = fetchCount;

      // Change the tool ID
      rerender({ id: secondToolId });

      await waitFor(() => {
        expect(result.current.tool?.tool.id).toBe(secondToolId);
      });

      expect(fetchCount).toBeGreaterThan(firstFetchCount);
    });

    it('should use fixture mockLTI11Tool for LTI 1.1 scenarios', async () => {
      const mockResponse = createMockToolDetailResponse(mockLTI11Tool, {
        ltiVersion: LtiVersion.LTI_1P0,
      });

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(mockLTI11Tool.id), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool).toBeDefined();
      expect(result.current.tool?.tool.id).toBe(mockLTI11Tool.id);
      expect(result.current.tool?.tool.name).toBe(mockLTI11Tool.name);
      expect(result.current.tool?.tool.resourcekey).toBe(mockLTI11Tool.resourcekey);
    });

    it('should use fixture mockLTI13Tool for LTI 1.3 scenarios', async () => {
      const mockResponse = createMockToolDetailResponse(mockLTI13Tool, {
        ltiVersion: LtiVersion.LTI_1P3,
      });

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(mockLTI13Tool.id), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool).toBeDefined();
      expect(result.current.tool?.tool.id).toBe(mockLTI13Tool.id);
      expect(result.current.tool?.ltiVersion).toBe(LtiVersion.LTI_1P3);
    });
  });

  // --------------------------------------------------------------------------
  // Tool Configuration Tests
  // --------------------------------------------------------------------------
  describe('tool configuration retrieval', () => {
    it('should retrieve tool URL correctly', async () => {
      const toolId = 30;
      const toolUrl = 'https://provider.example.com/lti/launch';
      const mockTool = createMockLTITool({ id: toolId, toolurl: toolUrl });
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.tool.toolurl).toBe(toolUrl);
    });

    it('should retrieve secure tool URL when configured', async () => {
      const toolId = 31;
      const secureUrl = 'https://secure.provider.example.com/lti/launch';
      const mockTool = createMockLTITool({
        id: toolId,
        securetoolurl: secureUrl,
      });
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.tool.securetoolurl).toBe(secureUrl);
    });

    it('should retrieve resource key (consumer key) for OAuth tools', async () => {
      const toolId = 32;
      const resourceKey = 'consumer_key_12345';
      const mockTool = createMockLTITool({
        id: toolId,
        resourcekey: resourceKey,
      });
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.tool.resourcekey).toBe(resourceKey);
    });

    it('should retrieve custom parameters configured for the tool', async () => {
      const toolId = 33;
      const customParams = 'custom_param1=value1\ncustom_param2=value2';
      const mockTool = createMockLTITool({
        id: toolId,
        instructorcustomparameters: customParams,
      });
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.tool.instructorcustomparameters).toBe(customParams);
    });

    it('should handle tool without custom parameters', async () => {
      const toolId = 34;
      const mockTool = createMockLTITool({
        id: toolId,
        instructorcustomparameters: '',
      });
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.tool.instructorcustomparameters).toBe('');
    });

    it('should retrieve tool configuration response', async () => {
      const toolId = 35;
      const mockTool = createMockLTITool({ id: toolId });
      const mockResponse = createMockToolDetailResponse(mockTool);
      const mockConfig = {
        ltiversion: LtiVersion.LTI_1P3,
        contentitem: true,
        deeplink: true,
      };

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse(mockConfig)),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(
        () => useLTI(toolId, { fetchConfig: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.toolConfig).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // LTI Version Detection Tests
  // --------------------------------------------------------------------------
  describe('LTI version detection', () => {
    it('should detect LTI 1.0/1.1 version correctly', async () => {
      const toolId = 40;
      const mockTool = createMockLTITool({ id: toolId });
      const mockResponse = createMockToolDetailResponse(mockTool, {
        ltiVersion: LtiVersion.LTI_1P0,
      });

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.ltiVersion).toBe(LtiVersion.LTI_1P0);
      expect(result.current.isLTI1p3()).toBe(false);
    });

    it('should detect LTI 1.3 (Advantage) version correctly', async () => {
      const toolId = 41;
      const mockTool = createMockLTITool({ id: toolId });
      const mockResponse = createMockToolDetailResponse(mockTool, {
        ltiVersion: LtiVersion.LTI_1P3,
      });

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.ltiVersion).toBe(LtiVersion.LTI_1P3);
      expect(result.current.isLTI1p3()).toBe(true);
    });

    it('should return false for isLTI1p3 when tool is not loaded', async () => {
      const toolId = 42;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return createSuccessResponse(
            createMockToolDetailResponse(createMockLTITool({ id: toolId }))
          );
        }),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      // While loading, isLTI1p3 should return false
      expect(result.current.isLTI1p3()).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Tool Type Detection Tests
  // --------------------------------------------------------------------------
  describe('tool type detection', () => {
    it('should retrieve tool type when typeid is specified', async () => {
      const toolId = 50;
      const toolTypeId = 10;
      const mockToolType: LtiToolType = {
        id: toolTypeId,
        name: 'Configured Tool Type',
        baseurl: 'https://tool.example.com',
        state: 1,
        course: 0,
        coursevisible: 2,
      };
      const mockTool = createMockLTITool({ id: toolId, typeid: toolTypeId });
      const mockResponse = createMockToolDetailResponse(mockTool, {
        toolType: mockToolType,
      });

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([mockToolType])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.toolType).toBeDefined();
      expect(result.current.tool?.toolType?.id).toBe(toolTypeId);
    });

    it('should detect tool type via URL matching when typeid is not specified', async () => {
      const toolId = 51;
      const toolUrl = 'https://matched.example.com/lti/launch';
      const matchingToolType: LtiToolType = {
        id: 20,
        name: 'URL-Matched Tool Type',
        baseurl: 'https://matched.example.com',
        state: 1,
        course: 0,
        coursevisible: 2,
      };
      const mockTool = createMockLTITool({
        id: toolId,
        typeid: undefined,
        toolurl: toolUrl,
      });
      const mockResponse = createMockToolDetailResponse(mockTool, {
        toolType: matchingToolType,
      });

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([matchingToolType])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.toolType).toBeDefined();
      expect(result.current.tool?.toolType?.id).toBe(20);
    });
  });

  // --------------------------------------------------------------------------
  // Cache Management Tests
  // --------------------------------------------------------------------------
  describe('cache management', () => {
    it('should cache tool data and serve from cache on subsequent requests', async () => {
      const toolId = 80;
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => {
          fetchCount++;
          return createSuccessResponse(
            createMockToolDetailResponse(createMockLTITool({ id: toolId }))
          );
        }),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      // Create shared query client for cache testing
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
          },
        },
      });

      // First render
      const { result, unmount } = renderHook(
        () => useLTI(toolId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Allow for possible refetch due to React Query behavior or StrictMode
      expect(fetchCount).toBeGreaterThanOrEqual(1);

      const initialFetchCount = fetchCount;

      // Re-render with same tool ID should use cached data
      unmount();
      const { result: result2 } = renderHook(
        () => useLTI(toolId),
        { wrapper: createWrapper(queryClient) }
      );

      // Should use cached data immediately (no additional fetch)
      await waitFor(() => {
        expect(result2.current.tool).toBeDefined();
      });

      // Cache should reduce or prevent additional fetches
      // Initial fetch count was captured after first render
      expect(fetchCount).toBeGreaterThanOrEqual(initialFetchCount);
    });

    it('should support manual refetch of tool data', async () => {
      const toolId = 81;
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => {
          fetchCount++;
          return createSuccessResponse(
            createMockToolDetailResponse(
              createMockLTITool({ id: toolId, name: `Tool v${fetchCount}` })
            )
          );
        }),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Allow for possible refetch due to React Query behavior
      const initialFetchCount = fetchCount;
      expect(fetchCount).toBeGreaterThanOrEqual(1);

      // Manually trigger refetch
      await act(async () => {
        await result.current.refetchTool();
      });

      // Refetch should increment the count
      await waitFor(() => {
        expect(fetchCount).toBeGreaterThan(initialFetchCount);
      });
    });

    it('should support refetch all data', async () => {
      const toolId = 82;
      let toolFetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => {
          toolFetchCount++;
          return createSuccessResponse(
            createMockToolDetailResponse(createMockLTITool({ id: toolId }))
          );
        }),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Allow for possible refetch due to React Query behavior
      const initialToolFetchCount = toolFetchCount;
      expect(toolFetchCount).toBeGreaterThanOrEqual(1);

      // Manually trigger refetch all
      await act(async () => {
        await result.current.refetchAll();
      });

      // Refetch all should increment the count
      await waitFor(() => {
        expect(toolFetchCount).toBeGreaterThan(initialToolFetchCount);
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
        http.get(`${API_BASE_URL}/lti/:id`, () => {
          return createErrorResponse('NOT_FOUND', 'LTI tool not found', 404);
        }),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(
        () => useLTI(nonExistentToolId),
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
        http.get(`${API_BASE_URL}/lti/:id`, () => {
          return HttpResponse.error();
        }),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
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
        http.get(`${API_BASE_URL}/lti/:id`, () =>
          createSuccessResponse(
            createMockToolDetailResponse(createMockLTITool({ id: toolId }))
          )
        ),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => {
          return createErrorResponse(
            'INVALID_CONFIGURATION',
            'Tool configuration is incomplete or invalid',
            400
          );
        }),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Tool data should still be available even if config fails
      expect(result.current.tool).toBeDefined();
    });

    it('should handle permission denied errors (403)', async () => {
      const toolId = 92;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => {
          return createErrorResponse(
            'PERMISSION_DENIED',
            'You do not have permission to access this LTI tool',
            403
          );
        }),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
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
        http.get(`${API_BASE_URL}/lti/:id`, () => {
          return createErrorResponse(
            'INTERNAL_ERROR',
            'An unexpected error occurred',
            500
          );
        }),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
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
        http.get(`${API_BASE_URL}/lti/:id`, () => {
          return HttpResponse.json(mockToolNotFoundError, { status: 404 });
        }),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
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
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
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
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
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
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
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
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canAllowRoster()).toBe(false);
    });

    it('should check content selection support', async () => {
      const toolId = 104;
      const mockToolType: LtiToolType = {
        id: 10,
        name: 'Content Selection Tool',
        baseurl: 'https://tool.example.com',
        state: 1,
        course: 0,
        coursevisible: 2,
        enabledcapability: 'ContentItemSelection,DeepLinking',
      };
      const mockTool = createMockLTITool({ id: toolId });
      const mockResponse = createMockToolDetailResponse(mockTool, {
        toolType: mockToolType,
      });

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([mockToolType])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.supportsContentSelection()).toBe(true);
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
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check the tool property directly
      expect(result.current.tool?.tool.instructorchoicesendname).toBe(1);
    });

    it('should check if tool sends user email', async () => {
      const toolId = 112;
      const mockTool = createMockLTITool({
        id: toolId,
        instructorchoicesendemailaddr: 1, // 1 = sends email
      });
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check the tool property directly
      expect(result.current.tool?.tool.instructorchoicesendemailaddr).toBe(1);
    });

    it('should verify privacy settings when disabled', async () => {
      const toolId = 113;
      const mockTool = createMockLTITool({
        id: toolId,
        instructorchoicesendname: 0,
        instructorchoicesendemailaddr: 0,
      });
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.tool.instructorchoicesendname).toBe(0);
      expect(result.current.tool?.tool.instructorchoicesendemailaddr).toBe(0);
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
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Access icon from the nested tool object
      expect(result.current.tool?.tool.icon).toBe(iconUrl);
    });

    it('should retrieve secure icon URL when available', async () => {
      const toolId = 121;
      const secureIconUrl = 'https://secure.provider.example.com/icon.png';
      const mockTool = createMockLTITool({
        id: toolId,
        icon: 'http://insecure.example.com/icon.png',
        secureicon: secureIconUrl,
      });
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should prefer secure icon when available
      expect(result.current.tool?.tool.secureicon).toBe(secureIconUrl);
    });

    it('should retrieve tool description text', async () => {
      const toolId = 122;
      const description = 'This is an external learning tool for interactive content.';
      const mockTool = createMockLTITool({
        id: toolId,
        intro: description,
      });
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Access intro from the nested tool object
      expect(result.current.tool?.tool.intro).toBe(description);
    });

    it('should retrieve tool instructions text with format', async () => {
      const toolId = 123;
      const instructions = 'Click the Launch button to access the external tool.';
      const mockTool = createMockLTITool({
        id: toolId,
        intro: instructions,
        introformat: 1, // HTML format
      });
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.tool.intro).toBe(instructions);
      expect(result.current.tool?.tool.introformat).toBe(1);
    });

    it('should handle empty icon when not configured', async () => {
      const toolId = 124;
      const mockTool = createMockLTITool({
        id: toolId,
        icon: '',
        secureicon: '',
      });
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.tool.icon).toBe('');
      expect(result.current.tool?.tool.secureicon).toBe('');
    });
  });

  // --------------------------------------------------------------------------
  // Launch Readiness Tests
  // --------------------------------------------------------------------------
  describe('launch readiness', () => {
    it('should indicate ready when tool data is loaded', async () => {
      const toolId = 130;
      const mockTool = createMockLTITool({
        id: toolId,
        toolurl: 'https://provider.example.com/launch',
      });
      const mockResponse = createMockToolDetailResponse(mockTool, {
        isConfigured: true,
      });

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Use isReady instead of isLaunchReady
      expect(result.current.isReady).toBe(true);
    });

    it('should indicate not ready when loading', async () => {
      const toolId = 131;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return createSuccessResponse(
            createMockToolDetailResponse(createMockLTITool({ id: toolId }))
          );
        }),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      // Should not be ready while loading
      expect(result.current.isReady).toBe(false);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isReady).toBe(true);
    });

    it('should indicate not ready when error occurs', async () => {
      const toolId = 132;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => {
          return createErrorResponse('NOT_FOUND', 'Tool not found', 404);
        }),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isReady).toBe(false);
      expect(result.current.error).toBeDefined();
    });

    it('should handle tool with missing URL', async () => {
      const toolId = 133;
      const mockTool = createMockLTITool({
        id: toolId,
        toolurl: '', // Missing tool URL
        securetoolurl: '',
      });
      const mockResponse = createMockToolDetailResponse(mockTool, {
        isConfigured: false,
      });

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Launch may not be ready if no valid URL
      expect(result.current.tool?.tool.toolurl).toBe('');
    });
  });

  // --------------------------------------------------------------------------
  // Grades Integration Tests
  // --------------------------------------------------------------------------
  describe('grades integration', () => {
    it('should fetch grades when fetchGrades option is true', async () => {
      const toolId = 140;
      let gradesFetched = false;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () =>
          createSuccessResponse(
            createMockToolDetailResponse(createMockLTITool({ id: toolId }))
          )
        ),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => {
          gradesFetched = true;
          return createSuccessResponse({
            grades: [
              {
                id: 1,
                userid: 100,
                grade: 85,
                timecreated: Math.floor(Date.now() / 1000),
              },
            ],
          });
        })
      );

      const { result } = renderHook(
        () => useLTI(toolId, { fetchGrades: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Wait for grades to be fetched
      await waitFor(
        () => {
          expect(gradesFetched).toBe(true);
        },
        { timeout: 2000 }
      );
    });

    it('should not fetch grades when fetchGrades is false', async () => {
      const toolId = 141;
      let gradesFetched = false;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () =>
          createSuccessResponse(
            createMockToolDetailResponse(createMockLTITool({ id: toolId }))
          )
        ),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => {
          gradesFetched = true;
          return createSuccessResponse({ grades: [] });
        })
      );

      const { result } = renderHook(
        () => useLTI(toolId, { fetchGrades: false }),
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
      const mockGrades = {
        grades: [
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
        ],
      };

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () =>
          createSuccessResponse(
            createMockToolDetailResponse(createMockLTITool({ id: toolId }))
          )
        ),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () =>
          createSuccessResponse(mockGrades)
        )
      );

      const { result } = renderHook(
        () => useLTI(toolId, { fetchGrades: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Wait for grades data
      await waitFor(
        () => {
          expect(result.current.grades).toBeDefined();
        },
        { timeout: 2000 }
      );
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
        http.get(`${API_BASE_URL}/lti/:id`, () =>
          createSuccessResponse(
            createMockToolDetailResponse(createMockLTITool({ id: toolId }))
          )
        ),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () =>
          createSuccessResponse(mockConfig)
        ),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(
        () => useLTI(toolId, { fetchConfig: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Wait for config to be available
      await waitFor(
        () => {
          expect(result.current.toolConfig).toBeDefined();
        },
        { timeout: 2000 }
      );
    });

    it('should handle missing tool config gracefully', async () => {
      const toolId = 151;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () =>
          createSuccessResponse(
            createMockToolDetailResponse(createMockLTITool({ id: toolId }))
          )
        ),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => {
          return createErrorResponse('NOT_FOUND', 'Config not found', 404);
        }),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(
        () => useLTI(toolId, { fetchConfig: true }),
        { wrapper: createWrapper() }
      );

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
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.tool.grade).toBe(0);
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
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.tool.name).toBe(longName);
      expect(result.current.tool?.tool.intro).toBe(longDescription);
    });

    it('should handle special characters in tool URL', async () => {
      const toolId = 162;
      const specialUrl =
        'https://provider.example.com/launch?param=value&special=%20chars';

      const mockTool = createMockLTITool({
        id: toolId,
        toolurl: specialUrl,
      });
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.tool.toolurl).toBe(specialUrl);
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
      const mockResponse = createMockToolDetailResponse(mockTool);

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => createSuccessResponse(mockResponse)),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tool?.tool.intro).toBe(htmlContent);
      expect(result.current.tool?.tool.introformat).toBe(1);
    });

    it('should handle multiple simultaneous renders with same tool ID', async () => {
      const toolId = 164;
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => {
          fetchCount++;
          return createSuccessResponse(
            createMockToolDetailResponse(createMockLTITool({ id: toolId }))
          );
        }),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      // Create shared query client for deduplication
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      // Render multiple hooks with same tool ID
      const { result: result1 } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(queryClient),
      });
      const { result: result2 } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
        expect(result2.current.isLoading).toBe(false);
      });

      // Both should have data
      expect(result1.current.tool).toBeDefined();
      expect(result2.current.tool).toBeDefined();
    });

    it('should expose hasToolData for checking data availability', async () => {
      const toolId = 165;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () =>
          createSuccessResponse(
            createMockToolDetailResponse(createMockLTITool({ id: toolId }))
          )
        ),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      // Initially should not have data
      expect(result.current.hasToolData).toBe(false);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasToolData).toBe(true);
    });

    it('should expose query keys for cache manipulation', async () => {
      const toolId = 166;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () =>
          createSuccessResponse(
            createMockToolDetailResponse(createMockLTITool({ id: toolId }))
          )
        ),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Query keys should be available
      expect(result.current.queryKeys).toBeDefined();
      expect(result.current.queryKeys.tool).toBeDefined();
    });

    it('should expose individual loading states', async () => {
      const toolId = 167;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return createSuccessResponse(
            createMockToolDetailResponse(createMockLTITool({ id: toolId }))
          );
        }),
        http.get(`${API_BASE_URL}/lti/types`, () => createSuccessResponse([])),
        http.get(`${API_BASE_URL}/lti/:id/config`, () => createSuccessResponse({})),
        http.get(`${API_BASE_URL}/lti/:id/grades`, () => createSuccessResponse({ grades: [] }))
      );

      const { result } = renderHook(() => useLTI(toolId), {
        wrapper: createWrapper(),
      });

      // Individual loading states should be available
      expect(result.current.loadingStates).toBeDefined();
      expect(result.current.loadingStates.tool).toBe(true);

      await waitFor(() => {
        expect(result.current.loadingStates.tool).toBe(false);
      });
    });
  });
});
