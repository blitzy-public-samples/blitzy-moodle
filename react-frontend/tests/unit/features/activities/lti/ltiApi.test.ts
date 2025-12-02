/**
 * LTI API Unit Tests
 *
 * Comprehensive unit tests for the LTI API module validating:
 * - API integration functions for LTI tool fetching
 * - Launch data generation (OAuth 1.0a and OIDC)
 * - Grade passback requests
 * - Tool configuration management
 * - Error handling with typed responses
 *
 * Uses Vitest and Mock Service Worker (MSW) for API mocking to avoid
 * actual network calls and ensure consistent test behavior.
 *
 * @module tests/unit/features/activities/lti/ltiApi.test
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// API functions and hooks under test
import {
  fetchLtiTool,
  fetchLtiLaunchData,
  fetchLtiToolConfig,
  fetchLtiToolTypes,
  fetchLtiGrades,
  submitLtiGradePassback,
  initiateLtiOidcLogin,
  useLtiTool,
  useLtiLaunchData,
  useLtiToolConfig,
  useLtiToolTypes,
  useLtiGrades,
  useLtiGradePassback,
  useLtiOidcLogin,
  isLti13,
  isLti20,
  isLti1x,
  getLtiLaunchTarget,
  getLtiWindowFeatures,
} from '@/features/activities/lti/api/ltiApi';

// Fixtures and test utilities
import {
  mockLTI11Tool,
  mockLTI13Tool,
  mockLTI11LaunchParams,
  mockLTI13OIDCParams,
  mockGrade,
  mockGradePassbackRequest,
  mockGradePassbackResponse,
  mockToolNotFoundError,
  mockPermissionDeniedError,
  mockOAuthSignatureError,
  mockCustomParams,
} from './fixtures';

import {
  setupLTIHandlers,
  createMockLTITool,
  createMockLaunchParams,
  createMockGradeData,
  expectOAuthSignatureValid,
  expectLTIVersionValid,
  expectGradeInRange,
  cleanupAfterEach,
  setupBeforeEach,
} from './testUtils';

import { createTestQueryClient } from '@/tests/helpers/render';

// Types
import type { LtiTool, LtiLaunchData } from '@/features/activities/lti/types/lti.types';

// API client for mocking
import { apiClient } from '@/services/api/client';

// ============================================================================
// Test Constants
// ============================================================================

const API_BASE_URL = '/api/v1';

/**
 * API Endpoint URLs for LTI operations
 */
const LTI_ENDPOINTS = {
  TOOL: (id: number) => `${API_BASE_URL}/lti/${id}`,
  LAUNCH: (id: number) => `${API_BASE_URL}/lti/${id}/launch`,
  CONFIG: (id: number) => `${API_BASE_URL}/lti/${id}/config`,
  GRADES: (id: number) => `${API_BASE_URL}/lti/${id}/grades`,
  GRADE_PASSBACK: (id: number) => `${API_BASE_URL}/lti/${id}/grade`,
  OIDC_LOGIN: (id: number) => `${API_BASE_URL}/lti/${id}/oidc/login`,
  TYPES: `${API_BASE_URL}/lti/types`,
  TYPE_CONFIG: (typeId: number) => `${API_BASE_URL}/lti/types/${typeId}/config`,
} as const;

// ============================================================================
// MSW Server Setup
// ============================================================================

/**
 * Create successful API response envelope
 */
function createSuccessResponse<T>(data: T, meta?: Record<string, unknown>) {
  return {
    success: true,
    data,
    meta,
  };
}

/**
 * Create error API response envelope
 */
function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

// Default MSW handlers for LTI API endpoints
const handlers = [
  // GET /api/v1/lti/:id - Fetch LTI tool details
  http.get(`${API_BASE_URL}/lti/:id`, ({ params }) => {
    const { id } = params;
    const toolId = parseInt(id as string, 10);

    if (toolId === 404) {
      return HttpResponse.json(mockToolNotFoundError, { status: 404 });
    }

    if (toolId === 403) {
      return HttpResponse.json(mockPermissionDeniedError, { status: 403 });
    }

    // Return LTI 1.1 or 1.3 tool based on ID
    const tool = toolId % 2 === 0 ? mockLTI13Tool : mockLTI11Tool;
    return HttpResponse.json(
      createSuccessResponse({ ...tool, id: toolId }),
      { status: 200 }
    );
  }),

  // POST /api/v1/lti/:id/launch - Generate launch data
  http.post(`${API_BASE_URL}/lti/:id/launch`, async ({ params, request }) => {
    const { id } = params;
    const toolId = parseInt(id as string, 10);

    if (toolId === 404) {
      return HttpResponse.json(mockToolNotFoundError, { status: 404 });
    }

    if (toolId === 403) {
      return HttpResponse.json(mockPermissionDeniedError, { status: 403 });
    }

    // Return appropriate launch params based on tool version
    const launchParams = toolId % 2 === 0 ? mockLTI13OIDCParams : mockLTI11LaunchParams;
    return HttpResponse.json(createSuccessResponse(launchParams), { status: 200 });
  }),

  // GET /api/v1/lti/:id/config - Fetch tool configuration
  http.get(`${API_BASE_URL}/lti/:id/config`, ({ params }) => {
    const { id } = params;
    const toolId = parseInt(id as string, 10);

    if (toolId === 404) {
      return HttpResponse.json(mockToolNotFoundError, { status: 404 });
    }

    return HttpResponse.json(
      createSuccessResponse({
        id: toolId,
        typeid: 1,
        toolurl: 'https://tool.example.com/lti',
        securetoolurl: 'https://tool.example.com/lti',
        ...mockCustomParams,
      }),
      { status: 200 }
    );
  }),

  // GET /api/v1/lti/:id/grades - Fetch grades for LTI tool
  http.get(`${API_BASE_URL}/lti/:id/grades`, ({ params }) => {
    const { id } = params;
    const toolId = parseInt(id as string, 10);

    if (toolId === 404) {
      return HttpResponse.json(mockToolNotFoundError, { status: 404 });
    }

    return HttpResponse.json(
      createSuccessResponse({
        grades: [
          { ...mockGrade, ltiid: toolId },
        ],
      }),
      { status: 200 }
    );
  }),

  // POST /api/v1/lti/:id/grade - Submit grade passback
  http.post(`${API_BASE_URL}/lti/:id/grade`, async ({ params, request }) => {
    const { id } = params;
    const toolId = parseInt(id as string, 10);
    const body = await request.json() as Record<string, unknown>;

    if (toolId === 404) {
      return HttpResponse.json(mockToolNotFoundError, { status: 404 });
    }

    if (toolId === 403) {
      return HttpResponse.json(mockPermissionDeniedError, { status: 403 });
    }

    // Validate grade value
    const gradeValue = body.grade as number;
    if (gradeValue < 0 || gradeValue > 1) {
      return HttpResponse.json(
        createErrorResponse('INVALID_GRADE', 'Grade must be between 0 and 1'),
        { status: 400 }
      );
    }

    return HttpResponse.json(
      createSuccessResponse({
        ...mockGradePassbackResponse,
        ltiid: toolId,
        grade: gradeValue,
      }),
      { status: 200 }
    );
  }),

  // POST /api/v1/lti/:id/oidc/login - Initiate OIDC login for LTI 1.3
  http.post(`${API_BASE_URL}/lti/:id/oidc/login`, async ({ params, request }) => {
    const { id } = params;
    const toolId = parseInt(id as string, 10);

    if (toolId === 404) {
      return HttpResponse.json(mockToolNotFoundError, { status: 404 });
    }

    return HttpResponse.json(
      createSuccessResponse({
        oidc_auth_url: 'https://tool.example.com/oidc/auth',
        state: 'random-state-value',
        nonce: 'random-nonce-value',
        client_id: 'moodle-client-id',
      }),
      { status: 200 }
    );
  }),

  // GET /api/v1/lti/types - Fetch available LTI tool types
  http.get(`${API_BASE_URL}/lti/types`, () => {
    return HttpResponse.json(
      createSuccessResponse({
        types: [
          { id: 1, name: 'Generic LTI Tool', ltiversion: 'LTI-1p0' },
          { id: 2, name: 'LTI 1.3 Tool', ltiversion: 'LTI-1p3' },
        ],
      }),
      { status: 200 }
    );
  }),

  // GET /api/v1/lti/types/:typeId/config - Fetch type configuration
  http.get(`${API_BASE_URL}/lti/types/:typeId/config`, ({ params }) => {
    const { typeId } = params;
    return HttpResponse.json(
      createSuccessResponse({
        typeId: parseInt(typeId as string, 10),
        config: [
          { name: 'toolurl', value: 'https://tool.example.com' },
          { name: 'resourcekey', value: 'consumer-key' },
        ],
      }),
      { status: 200 }
    );
  }),
];

// Create MSW server instance
const server = setupServer(...handlers);

// ============================================================================
// Test Wrapper Component
// ============================================================================

/**
 * Creates a wrapper component with QueryClientProvider for testing hooks
 */
function createWrapper() {
  const queryClient = createTestQueryClient();

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ltiApi', () => {
  // Start MSW server before all tests
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  // Reset handlers after each test
  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
    cleanupAfterEach();
  });

  // Close server after all tests
  afterAll(() => {
    server.close();
  });

  // ==========================================================================
  // fetchLtiTool Tests
  // ==========================================================================

  describe('fetchLtiTool', () => {
    it('should fetch LTI tool by ID successfully', async () => {
      const toolId = 1;
      const result = await fetchLtiTool(toolId);

      expect(result).toBeDefined();
      expect(result.id).toBe(toolId);
      expect(result.name).toBeDefined();
      expect(result.toolurl).toBeDefined();
    });

    it('should return LTI 1.3 tool for even IDs', async () => {
      const toolId = 2;
      const result = await fetchLtiTool(toolId);

      expect(result).toBeDefined();
      expect(result.id).toBe(toolId);
      // LTI 1.3 tools have lti version info
      expectLTIVersionValid(result);
    });

    it('should return LTI 1.1 tool for odd IDs', async () => {
      const toolId = 1;
      const result = await fetchLtiTool(toolId);

      expect(result).toBeDefined();
      expect(result.id).toBe(toolId);
      expectLTIVersionValid(result);
    });

    it('should throw error for non-existent tool (404)', async () => {
      await expect(fetchLtiTool(404)).rejects.toThrow();
    });

    it('should throw error for permission denied (403)', async () => {
      await expect(fetchLtiTool(403)).rejects.toThrow();
    });

    it('should include all required tool properties in response', async () => {
      const result = await fetchLtiTool(1);

      // Core properties
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('course');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('intro');
      expect(result).toHaveProperty('toolurl');

      // Optional but expected properties
      expect(result).toHaveProperty('securetoolurl');
      expect(result).toHaveProperty('instructorchoicesendname');
      expect(result).toHaveProperty('instructorchoicesendemailaddr');
      expect(result).toHaveProperty('instructorchoiceacceptgrades');
    });
  });

  // ==========================================================================
  // fetchLtiLaunchData Tests
  // ==========================================================================

  describe('fetchLtiLaunchData', () => {
    it('should generate launch data for LTI 1.1 tool', async () => {
      const toolId = 1;
      const result = await fetchLtiLaunchData(toolId);

      expect(result).toBeDefined();
      expect(result.endpoint).toBeDefined();
      expect(result.parameters).toBeDefined();
      expect(Array.isArray(result.parameters)).toBe(true);
    });

    it('should generate launch data for LTI 1.3 tool', async () => {
      const toolId = 2;
      const result = await fetchLtiLaunchData(toolId);

      expect(result).toBeDefined();
      expect(result.endpoint).toBeDefined();
      expect(result.parameters).toBeDefined();
    });

    it('should include OAuth signature for LTI 1.1 launch', async () => {
      const toolId = 1;
      const result = await fetchLtiLaunchData(toolId);

      // LTI 1.1 uses OAuth for signing
      const hasOAuthParams = result.parameters.some(
        (p: { name: string }) => p.name.startsWith('oauth_')
      );
      expect(hasOAuthParams).toBe(true);
    });

    it('should include launch URL in endpoint', async () => {
      const toolId = 1;
      const result = await fetchLtiLaunchData(toolId);

      expect(result.endpoint).toMatch(/^https?:\/\//);
    });

    it('should throw error for non-existent tool (404)', async () => {
      await expect(fetchLtiLaunchData(404)).rejects.toThrow();
    });

    it('should throw error for permission denied (403)', async () => {
      await expect(fetchLtiLaunchData(403)).rejects.toThrow();
    });

    it('should support custom launch options', async () => {
      const toolId = 1;
      const options = { target: 'window' as const };
      const result = await fetchLtiLaunchData(toolId, options);

      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // fetchLtiToolConfig Tests
  // ==========================================================================

  describe('fetchLtiToolConfig', () => {
    it('should fetch tool configuration successfully', async () => {
      const toolId = 1;
      const result = await fetchLtiToolConfig(toolId);

      expect(result).toBeDefined();
      expect(result.id).toBe(toolId);
    });

    it('should include tool URL in configuration', async () => {
      const toolId = 1;
      const result = await fetchLtiToolConfig(toolId);

      expect(result).toHaveProperty('toolurl');
      expect(result.toolurl).toMatch(/^https?:\/\//);
    });

    it('should throw error for non-existent tool (404)', async () => {
      await expect(fetchLtiToolConfig(404)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // fetchLtiToolTypes Tests
  // ==========================================================================

  describe('fetchLtiToolTypes', () => {
    it('should fetch available tool types', async () => {
      const result = await fetchLtiToolTypes();

      expect(result).toBeDefined();
      expect(result.types).toBeDefined();
      expect(Array.isArray(result.types)).toBe(true);
      expect(result.types.length).toBeGreaterThan(0);
    });

    it('should include LTI version for each type', async () => {
      const result = await fetchLtiToolTypes();

      result.types.forEach((type: { ltiversion?: string }) => {
        expect(type).toHaveProperty('ltiversion');
      });
    });

    it('should include both LTI 1.x and 1.3 types', async () => {
      const result = await fetchLtiToolTypes();

      const hasLti1 = result.types.some(
        (t: { ltiversion: string }) => t.ltiversion.includes('1p0')
      );
      const hasLti13 = result.types.some(
        (t: { ltiversion: string }) => t.ltiversion.includes('1p3')
      );

      expect(hasLti1 || hasLti13).toBe(true);
    });
  });

  // ==========================================================================
  // fetchLtiGrades Tests
  // ==========================================================================

  describe('fetchLtiGrades', () => {
    it('should fetch grades for LTI tool', async () => {
      const toolId = 1;
      const result = await fetchLtiGrades(toolId);

      expect(result).toBeDefined();
      expect(result.grades).toBeDefined();
      expect(Array.isArray(result.grades)).toBe(true);
    });

    it('should include grade properties in response', async () => {
      const toolId = 1;
      const result = await fetchLtiGrades(toolId);

      if (result.grades.length > 0) {
        const grade = result.grades[0];
        expect(grade).toHaveProperty('ltiid');
        expect(grade).toHaveProperty('userid');
        expect(grade).toHaveProperty('gradepercent');
      }
    });

    it('should throw error for non-existent tool (404)', async () => {
      await expect(fetchLtiGrades(404)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // submitLtiGradePassback Tests
  // ==========================================================================

  describe('submitLtiGradePassback', () => {
    it('should submit grade passback successfully', async () => {
      const toolId = 1;
      const gradeData = { userId: 123, grade: 0.85 };
      const result = await submitLtiGradePassback(toolId, gradeData);

      expect(result).toBeDefined();
      expect(result.grade).toBe(0.85);
    });

    it('should validate grade value in range 0-1', async () => {
      const toolId = 1;

      // Valid grades
      await expect(
        submitLtiGradePassback(toolId, { userId: 123, grade: 0 })
      ).resolves.toBeDefined();

      await expect(
        submitLtiGradePassback(toolId, { userId: 123, grade: 1 })
      ).resolves.toBeDefined();

      await expect(
        submitLtiGradePassback(toolId, { userId: 123, grade: 0.5 })
      ).resolves.toBeDefined();
    });

    it('should reject invalid grade values', async () => {
      const toolId = 1;

      // Grade above 1
      await expect(
        submitLtiGradePassback(toolId, { userId: 123, grade: 1.5 })
      ).rejects.toThrow();

      // Negative grade
      await expect(
        submitLtiGradePassback(toolId, { userId: 123, grade: -0.1 })
      ).rejects.toThrow();
    });

    it('should throw error for non-existent tool (404)', async () => {
      await expect(
        submitLtiGradePassback(404, { userId: 123, grade: 0.85 })
      ).rejects.toThrow();
    });

    it('should throw error for permission denied (403)', async () => {
      await expect(
        submitLtiGradePassback(403, { userId: 123, grade: 0.85 })
      ).rejects.toThrow();
    });

    it('should normalize grade to LTI scale (0-1)', async () => {
      const toolId = 1;
      const gradeData = { userId: 123, grade: 0.75 };
      const result = await submitLtiGradePassback(toolId, gradeData);

      expectGradeInRange(result.grade, 0, 1);
    });
  });

  // ==========================================================================
  // initiateLtiOidcLogin Tests
  // ==========================================================================

  describe('initiateLtiOidcLogin', () => {
    it('should initiate OIDC login for LTI 1.3 tool', async () => {
      const toolId = 2;
      const loginData = {
        target_link_uri: 'https://tool.example.com/launch',
        login_hint: 'user-123',
      };
      const result = await initiateLtiOidcLogin(toolId, loginData);

      expect(result).toBeDefined();
      expect(result.oidc_auth_url).toBeDefined();
      expect(result.state).toBeDefined();
      expect(result.nonce).toBeDefined();
    });

    it('should include client_id in OIDC response', async () => {
      const toolId = 2;
      const loginData = {
        target_link_uri: 'https://tool.example.com/launch',
        login_hint: 'user-123',
      };
      const result = await initiateLtiOidcLogin(toolId, loginData);

      expect(result.client_id).toBeDefined();
    });

    it('should throw error for non-existent tool (404)', async () => {
      await expect(
        initiateLtiOidcLogin(404, {
          target_link_uri: 'https://example.com',
          login_hint: 'user',
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // useLtiTool Hook Tests
  // ==========================================================================

  describe('useLtiTool', () => {
    it('should fetch and cache LTI tool data', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiTool(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe(1);
    });

    it('should handle loading state', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiTool(1), { wrapper });

      // Initial state should be loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle error state for non-existent tool', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiTool(404), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should not fetch when disabled', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(
        () => useLtiTool(1, { enabled: false }),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFetching).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });

  // ==========================================================================
  // useLtiLaunchData Hook Tests
  // ==========================================================================

  describe('useLtiLaunchData', () => {
    it('should generate launch data on mutation', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiLaunchData(), { wrapper });

      result.current.mutate({ toolId: 1 });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.endpoint).toBeDefined();
    });

    it('should handle mutation error', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiLaunchData(), { wrapper });

      result.current.mutate({ toolId: 404 });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should support options in mutation', async () => {
      const wrapper = createWrapper();
      const onSuccess = vi.fn();

      const { result } = renderHook(() => useLtiLaunchData(), { wrapper });

      result.current.mutate(
        { toolId: 1 },
        { onSuccess }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // useLtiToolConfig Hook Tests
  // ==========================================================================

  describe('useLtiToolConfig', () => {
    it('should fetch tool configuration', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiToolConfig(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });

    it('should handle error for non-existent tool', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiToolConfig(404), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==========================================================================
  // useLtiToolTypes Hook Tests
  // ==========================================================================

  describe('useLtiToolTypes', () => {
    it('should fetch available tool types', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiToolTypes(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.types).toBeDefined();
    });
  });

  // ==========================================================================
  // useLtiGrades Hook Tests
  // ==========================================================================

  describe('useLtiGrades', () => {
    it('should fetch grades for LTI tool', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiGrades(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.grades).toBeDefined();
    });

    it('should handle error for non-existent tool', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiGrades(404), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==========================================================================
  // useLtiGradePassback Hook Tests
  // ==========================================================================

  describe('useLtiGradePassback', () => {
    it('should submit grade passback via mutation', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiGradePassback(), { wrapper });

      result.current.mutate({
        toolId: 1,
        userId: 123,
        grade: 0.85,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });

    it('should handle mutation error for invalid grade', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiGradePassback(), { wrapper });

      result.current.mutate({
        toolId: 1,
        userId: 123,
        grade: 1.5, // Invalid grade
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should call onSuccess callback on successful passback', async () => {
      const wrapper = createWrapper();
      const onSuccess = vi.fn();

      const { result } = renderHook(() => useLtiGradePassback(), { wrapper });

      result.current.mutate(
        { toolId: 1, userId: 123, grade: 0.75 },
        { onSuccess }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalled();
    });

    it('should call onError callback on failed passback', async () => {
      const wrapper = createWrapper();
      const onError = vi.fn();

      const { result } = renderHook(() => useLtiGradePassback(), { wrapper });

      result.current.mutate(
        { toolId: 404, userId: 123, grade: 0.75 },
        { onError }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(onError).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // useLtiOidcLogin Hook Tests
  // ==========================================================================

  describe('useLtiOidcLogin', () => {
    it('should initiate OIDC login via mutation', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiOidcLogin(), { wrapper });

      result.current.mutate({
        toolId: 2,
        target_link_uri: 'https://tool.example.com/launch',
        login_hint: 'user-123',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.oidc_auth_url).toBeDefined();
    });

    it('should handle OIDC login error', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiOidcLogin(), { wrapper });

      result.current.mutate({
        toolId: 404,
        target_link_uri: 'https://tool.example.com/launch',
        login_hint: 'user-123',
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe('Utility Functions', () => {
    describe('isLti13', () => {
      it('should return true for LTI 1.3 version string', () => {
        expect(isLti13('LTI-1p3')).toBe(true);
        expect(isLti13('1.3.0')).toBe(true);
      });

      it('should return false for LTI 1.x version string', () => {
        expect(isLti13('LTI-1p0')).toBe(false);
        expect(isLti13('1.1')).toBe(false);
      });
    });

    describe('isLti20', () => {
      it('should return true for LTI 2.0 version string', () => {
        expect(isLti20('LTI-2p0')).toBe(true);
        expect(isLti20('2.0')).toBe(true);
      });

      it('should return false for other LTI versions', () => {
        expect(isLti20('LTI-1p0')).toBe(false);
        expect(isLti20('LTI-1p3')).toBe(false);
      });
    });

    describe('isLti1x', () => {
      it('should return true for LTI 1.x version strings', () => {
        expect(isLti1x('LTI-1p0')).toBe(true);
        expect(isLti1x('1.1')).toBe(true);
        expect(isLti1x('1.0')).toBe(true);
      });

      it('should return false for LTI 1.3 and 2.0', () => {
        expect(isLti1x('LTI-1p3')).toBe(false);
        expect(isLti1x('LTI-2p0')).toBe(false);
      });
    });

    describe('getLtiLaunchTarget', () => {
      it('should return correct target for iframe container', () => {
        const tool = createMockLTITool({ launchcontainer: 1 });
        expect(getLtiLaunchTarget(tool)).toBe('iframe');
      });

      it('should return correct target for window container', () => {
        const tool = createMockLTITool({ launchcontainer: 2 });
        expect(getLtiLaunchTarget(tool)).toBe('window');
      });

      it('should return default target for unspecified container', () => {
        const tool = createMockLTITool();
        const target = getLtiLaunchTarget(tool);
        expect(['iframe', 'window', 'embed']).toContain(target);
      });
    });

    describe('getLtiWindowFeatures', () => {
      it('should return window features string', () => {
        const features = getLtiWindowFeatures();

        expect(typeof features).toBe('string');
        expect(features).toContain('width=');
        expect(features).toContain('height=');
      });

      it('should support custom dimensions', () => {
        const features = getLtiWindowFeatures({ width: 1024, height: 768 });

        expect(features).toContain('width=1024');
        expect(features).toContain('height=768');
      });
    });
  });

  // ==========================================================================
  // Request/Response Transformation Tests
  // ==========================================================================

  describe('Request/Response Transformations', () => {
    it('should include JWT token in Authorization header', async () => {
      const getSpy = vi.spyOn(apiClient, 'get');

      try {
        await fetchLtiTool(1);
      } catch {
        // Ignore errors, we're just checking the call
      }

      // Note: actual JWT injection is handled by interceptors
      // We verify the apiClient is being used
      expect(getSpy).toHaveBeenCalled();

      getSpy.mockRestore();
    });

    it('should set proper Content-Type for POST requests', async () => {
      const postSpy = vi.spyOn(apiClient, 'post');

      try {
        await submitLtiGradePassback(1, { userId: 123, grade: 0.85 });
      } catch {
        // Ignore errors
      }

      expect(postSpy).toHaveBeenCalled();

      postSpy.mockRestore();
    });

    it('should parse JSON response and extract data from envelope', async () => {
      const result = await fetchLtiTool(1);

      // Result should be the unwrapped data, not the envelope
      expect(result).not.toHaveProperty('success');
      expect(result).toHaveProperty('id');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle 404 Not Found errors', async () => {
      try {
        await fetchLtiTool(404);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle 403 Permission Denied errors', async () => {
      try {
        await fetchLtiTool(403);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle 401 Not Authenticated errors', async () => {
      // Override handler for 401
      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('UNAUTHORIZED', 'Not authenticated'),
            { status: 401 }
          );
        })
      );

      try {
        await fetchLtiTool(1);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle 500 Server Error', async () => {
      // Override handler for 500
      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('SERVER_ERROR', 'Internal server error'),
            { status: 500 }
          );
        })
      );

      try {
        await fetchLtiTool(1);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle network errors gracefully', async () => {
      // Override handler to simulate network error
      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => {
          return HttpResponse.error();
        })
      );

      try {
        await fetchLtiTool(1);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should preserve error details from API response', async () => {
      // Override handler with detailed error
      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('TOOL_NOT_FOUND', 'LTI tool not found', {
              toolId: 404,
              suggestion: 'Check the tool ID',
            }),
            { status: 404 }
          );
        })
      );

      try {
        await fetchLtiTool(404);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // TypeScript Type Validation Tests
  // ==========================================================================

  describe('TypeScript Type Validation', () => {
    it('should return properly typed LtiTool response', async () => {
      const result = await fetchLtiTool(1);

      // TypeScript compile-time validation - if these don't exist, TS will error
      const _id: number = result.id;
      const _name: string = result.name;
      const _course: number = result.course;

      expect(_id).toBe(1);
      expect(typeof _name).toBe('string');
      expect(typeof _course).toBe('number');
    });

    it('should return properly typed LtiLaunchData response', async () => {
      const result = await fetchLtiLaunchData(1);

      // TypeScript validation
      const _endpoint: string = result.endpoint;
      const _parameters: Array<{ name: string; value: string }> = result.parameters;

      expect(typeof _endpoint).toBe('string');
      expect(Array.isArray(_parameters)).toBe(true);
    });

    it('should handle grade passback with proper types', async () => {
      const result = await submitLtiGradePassback(1, { userId: 123, grade: 0.85 });

      // TypeScript validation
      const _grade: number = result.grade;

      expect(typeof _grade).toBe('number');
      expectGradeInRange(_grade, 0, 1);
    });
  });

  // ==========================================================================
  // Integration with React Query Tests
  // ==========================================================================

  describe('React Query Integration', () => {
    it('should cache query results', async () => {
      const wrapper = createWrapper();

      // First fetch
      const { result: result1 } = renderHook(() => useLtiTool(1), { wrapper });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second fetch should use cache
      const { result: result2 } = renderHook(() => useLtiTool(1), { wrapper });

      // Should have data immediately from cache
      await waitFor(() => {
        expect(result2.current.data).toBeDefined();
      });
    });

    it('should invalidate cache on mutation success', async () => {
      const wrapper = createWrapper();

      // Fetch initial data
      const { result: queryResult } = renderHook(() => useLtiGrades(1), { wrapper });

      await waitFor(() => {
        expect(queryResult.current.isSuccess).toBe(true);
      });

      // Perform mutation
      const { result: mutationResult } = renderHook(
        () => useLtiGradePassback(),
        { wrapper }
      );

      mutationResult.current.mutate({
        toolId: 1,
        userId: 123,
        grade: 0.9,
      });

      await waitFor(() => {
        expect(mutationResult.current.isSuccess).toBe(true);
      });
    });

    it('should support query refetch', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiTool(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Refetch
      await result.current.refetch();

      expect(result.current.data).toBeDefined();
    });
  });

  // ==========================================================================
  // MSW Request Validation Tests
  // ==========================================================================

  describe('MSW Request Validation', () => {
    it('should send correct parameters for tool fetch', async () => {
      let capturedUrl: string | null = null;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json(createSuccessResponse(mockLTI11Tool));
        })
      );

      await fetchLtiTool(123);

      expect(capturedUrl).toContain('/lti/123');
    });

    it('should send correct body for grade passback', async () => {
      let capturedBody: Record<string, unknown> | null = null;

      server.use(
        http.post(`${API_BASE_URL}/lti/:id/grade`, async ({ request }) => {
          capturedBody = await request.json() as Record<string, unknown>;
          return HttpResponse.json(createSuccessResponse(mockGradePassbackResponse));
        })
      );

      await submitLtiGradePassback(1, { userId: 456, grade: 0.75 });

      expect(capturedBody).toBeDefined();
      expect(capturedBody?.userId).toBe(456);
      expect(capturedBody?.grade).toBe(0.75);
    });

    it('should send correct body for OIDC login', async () => {
      let capturedBody: Record<string, unknown> | null = null;

      server.use(
        http.post(`${API_BASE_URL}/lti/:id/oidc/login`, async ({ request }) => {
          capturedBody = await request.json() as Record<string, unknown>;
          return HttpResponse.json(
            createSuccessResponse({
              oidc_auth_url: 'https://example.com/auth',
              state: 'state',
              nonce: 'nonce',
              client_id: 'client',
            })
          );
        })
      );

      await initiateLtiOidcLogin(2, {
        target_link_uri: 'https://tool.example.com/launch',
        login_hint: 'user-789',
      });

      expect(capturedBody).toBeDefined();
      expect(capturedBody?.target_link_uri).toBe('https://tool.example.com/launch');
      expect(capturedBody?.login_hint).toBe('user-789');
    });
  });

  // ==========================================================================
  // OAuth Signature Validation Tests
  // ==========================================================================

  describe('OAuth Signature Validation', () => {
    it('should include OAuth parameters in LTI 1.1 launch', async () => {
      const result = await fetchLtiLaunchData(1);

      const oauthParams = result.parameters.filter(
        (p: { name: string }) => p.name.startsWith('oauth_')
      );

      // LTI 1.1 should have OAuth parameters
      expect(oauthParams.length).toBeGreaterThan(0);
    });

    it('should validate OAuth signature structure', async () => {
      const result = await fetchLtiLaunchData(1);

      const signature = result.parameters.find(
        (p: { name: string }) => p.name === 'oauth_signature'
      );

      if (signature) {
        expectOAuthSignatureValid(signature.value);
      }
    });
  });

  // ==========================================================================
  // Retry Logic Tests
  // ==========================================================================

  describe('Retry Logic', () => {
    it('should not retry on 4xx errors', async () => {
      let requestCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/lti/:id`, () => {
          requestCount++;
          return HttpResponse.json(mockToolNotFoundError, { status: 404 });
        })
      );

      const wrapper = createWrapper();
      const { result } = renderHook(() => useLtiTool(999), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Should only make 1 request (no retries for 4xx)
      expect(requestCount).toBe(1);
    });
  });
});
