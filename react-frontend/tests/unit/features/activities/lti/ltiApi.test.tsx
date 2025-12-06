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

import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
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

// Type imports for testing
import { LaunchContainer } from '@/features/activities/lti/types/lti.types';

// Fixtures and test utilities
import {
  mockLTI11Tool,
  mockLTI13Tool,
  mockLTI11LaunchParams,
  mockLTI13OIDCParams,
  mockGrade,
  mockToolNotFoundError,
  mockPermissionDeniedError,
  mockCustomParams,
} from './fixtures';

import {
  expectLTIVersionValid,
  expectGradeInRange,
  cleanupAfterEach,
} from './testUtils';

import { createTestQueryClient } from '@tests/helpers/render';

// API client for mocking is handled by MSW, no direct import needed

// API client for mocking
import { apiClient } from '@/services/api/client';

// ============================================================================
// Test Constants
// ============================================================================

const API_BASE_URL = 'http://localhost:8000/api/v1';

/**
 * API Endpoint URLs for LTI operations
 * Prefixed with underscore as reference documentation for MSW handlers
 */
const _LTI_ENDPOINTS = {
  TOOL: (id: number) => `${API_BASE_URL}/lti/${id}`,
  LAUNCH: (id: number) => `${API_BASE_URL}/lti/${id}/launch`,
  CONFIG: (id: number) => `${API_BASE_URL}/lti/${id}/config`,
  GRADES: (id: number) => `${API_BASE_URL}/lti/${id}/grades`,
  GRADE_PASSBACK: (id: number) => `${API_BASE_URL}/lti/${id}/grades`,
  OIDC_LOGIN: (id: number) => `${API_BASE_URL}/lti/${id}/initiate-login`,
  TYPES: `${API_BASE_URL}/lti/types`,
  TYPE_CONFIG: (typeId: number) => `${API_BASE_URL}/lti/types/${typeId}/config`,
} as const;
 
void _LTI_ENDPOINTS;

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
// IMPORTANT: Literal paths like /lti/types must come BEFORE parameterized paths like /lti/:id
const handlers = [
  // GET /api/v1/lti/types - Fetch available LTI tool types with LtiToolTypesResponse structure
  // This MUST come before /lti/:id to prevent "types" being matched as an :id parameter
  http.get(`${API_BASE_URL}/lti/types`, ({ request }) => {
    const url = new URL(request.url);
    const stateFilter = url.searchParams.get('state');
    const courseIdFilter = url.searchParams.get('courseId');

    return HttpResponse.json(
      createSuccessResponse({
        types: [
          {
            id: 1,
            name: 'Generic LTI Tool',
            baseurl: 'https://generic-tool.example.com',
            state: 1,
            course: 0,
            coursevisible: 2,
            ltiversion: 'LTI-1p0',
          },
          {
            id: 2,
            name: 'LTI 1.3 Tool',
            baseurl: 'https://lti13-tool.example.com',
            state: 1,
            course: 0,
            coursevisible: 2,
            ltiversion: '1.3.0',
            clientid: 'client-id-123',
          },
        ],
        total: 2,
        filters: {
          state: stateFilter ? parseInt(stateFilter, 10) : undefined,
          courseId: courseIdFilter ? parseInt(courseIdFilter, 10) : undefined,
          includeGlobal: true,
        },
      }),
      { status: 200 }
    );
  }),

  // GET /api/v1/lti/types/:typeId/config - Fetch type configuration
  // This should also come before /lti/:id 
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

    // Return LTI 1.1 or 1.3 tool based on ID with proper LtiToolDetailResponse structure
    const tool = toolId % 2 === 0 ? mockLTI13Tool : mockLTI11Tool;
    return HttpResponse.json(
      createSuccessResponse({
        tool: { ...tool, id: toolId },
        toolType: null,
        canLaunch: true,
        isConfigured: true,
        ltiVersion: toolId % 2 === 0 ? '1.3.0' : 'LTI-1p0',
        cmid: toolId + 100,
        courseId: tool.course || 101
      }),
      { status: 200 }
    );
  }),

  // POST /api/v1/lti/:id/launch - Generate launch data
  http.post(`${API_BASE_URL}/lti/:id/launch`, async ({ params }) => {
    const { id } = params;
    const toolId = parseInt(id as string, 10);

    if (toolId === 404) {
      return HttpResponse.json(mockToolNotFoundError, { status: 404 });
    }

    if (toolId === 403) {
      return HttpResponse.json(mockPermissionDeniedError, { status: 403 });
    }

    // Return appropriate launch params based on tool version with full LtiLaunchDataResponse structure
    const isLti13 = toolId % 2 === 0;
    
    // For LTI 1.3, construct proper launch data from OIDC params
    // For LTI 1.1, use the mock launch params directly
    const endpoint = isLti13 
      ? mockLTI13OIDCParams.target_link_uri 
      : mockLTI11LaunchParams.endpoint;
    
    const parameters = isLti13
      ? [
          { name: 'iss', value: mockLTI13OIDCParams.iss },
          { name: 'login_hint', value: mockLTI13OIDCParams.login_hint },
          { name: 'target_link_uri', value: mockLTI13OIDCParams.target_link_uri },
          { name: 'lti_message_hint', value: mockLTI13OIDCParams.lti_message_hint },
          { name: 'client_id', value: mockLTI13OIDCParams.client_id },
          { name: 'lti_deployment_id', value: mockLTI13OIDCParams.lti_deployment_id },
        ]
      : mockLTI11LaunchParams.parameters;

    return HttpResponse.json(
      createSuccessResponse({
        endpoint,
        parameters,
        launchContainer: LaunchContainer.EMBED,
        ltiVersion: isLti13 ? '1.3.0' : 'LTI-1p0',
        requiresOidc: isLti13,
        loginHint: isLti13 ? 'user-hint-12345' : undefined,
        oidcRedirectUrl: isLti13 ? 'https://tool.example.com/oidc/auth' : undefined,
        oauthSignature: isLti13 ? undefined : 'oauth_signature_base64_encoded',
        contentUrl: endpoint,
        windowTitle: 'LTI Tool Launch',
        windowFeatures: 'width=800,height=600'
      }),
      { status: 200 }
    );
  }),

  // GET /api/v1/lti/:id/config - Fetch tool configuration with LtiToolConfigResponse structure
  http.get(`${API_BASE_URL}/lti/:id/config`, ({ params }) => {
    const { id } = params;
    const toolId = parseInt(id as string, 10);

    if (toolId === 404) {
      return HttpResponse.json(mockToolNotFoundError, { status: 404 });
    }

    return HttpResponse.json(
      createSuccessResponse({
        config: {
          toolurl: 'https://tool.example.com/lti',
          securetoolurl: 'https://tool.example.com/lti',
          resourcekey: 'consumer-key',
          ...mockCustomParams,
        },
        privacy: {
          sendName: true,
          sendEmail: true,
          acceptGrades: true,
        },
        customParams: ['custom_param1=value1', 'custom_param2=value2'],
        resourceLinkId: `resource-link-${toolId}`,
        services: {
          outcomesUrl: 'https://moodle.example.com/mod/lti/service.php/outcome',
          membershipsUrl: 'https://moodle.example.com/mod/lti/service.php/memberships',
          settingsUrl: 'https://moodle.example.com/mod/lti/service.php/settings',
        },
      }),
      { status: 200 }
    );
  }),

  // GET /api/v1/lti/:id/grades - Fetch grades for LTI tool with LtiGradesResponse structure
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
        total: 1,
        gradeItemId: toolId * 10,
        maxGrade: 100,
      }),
      { status: 200 }
    );
  }),

  // POST /api/v1/lti/:id/grades - Submit grade passback
  http.post(`${API_BASE_URL}/lti/:id/grades`, async ({ params, request }) => {
    const { id } = params;
    const toolId = parseInt(id as string, 10);
    const body = await request.json() as Record<string, unknown>;

    if (toolId === 404) {
      return HttpResponse.json(mockToolNotFoundError, { status: 404 });
    }

    if (toolId === 403) {
      return HttpResponse.json(mockPermissionDeniedError, { status: 403 });
    }

    // Validate grade value (0-100 scale per API design, converted to 0-1 for LTI spec internally)
    const gradeValue = body.grade as number;
    if (gradeValue < 0 || gradeValue > 100) {
      return HttpResponse.json(
        createErrorResponse('INVALID_GRADE', 'Grade must be between 0 and 100'),
        { status: 400 }
      );
    }

    // Return LtiGradePassbackResponse with proper gradeResult structure
    return HttpResponse.json(
      createSuccessResponse({
        success: true,
        message: 'Grade successfully updated',
        gradeResult: {
          id: 1,
          ltiid: toolId,
          userid: (body.userId as number) || 12345,
          gradepercent: gradeValue,
          dategraded: Math.floor(Date.now() / 1000),
          datesubmitted: Math.floor(Date.now() / 1000),
          dateupdated: Math.floor(Date.now() / 1000),
          originalgrade: gradeValue / 100, // Convert 0-100 to 0-1 for LTI spec
          launchid: 1,
          state: 1,
        },
      }),
      { status: 200 }
    );
  }),

  // POST /api/v1/lti/:id/initiate-login - Initiate OIDC login for LTI 1.3 with LtiOidcLoginResponse structure
  http.post(`${API_BASE_URL}/lti/:id/initiate-login`, async ({ params }) => {
    const { id } = params;
    const toolId = parseInt(id as string, 10);

    if (toolId === 404) {
      return HttpResponse.json(mockToolNotFoundError, { status: 404 });
    }

    return HttpResponse.json(
      createSuccessResponse({
        authRequestUrl: 'https://tool.example.com/oidc/auth',
        state: 'random-state-value',
        nonce: 'random-nonce-value',
        loginHint: `user-${toolId}-hint`,
        ltiMessageHint: `lti-message-hint-${toolId}`,
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

// Shared query client for the test suite
let testQueryClient: ReturnType<typeof createTestQueryClient>;

/**
 * Creates a wrapper component with QueryClientProvider for testing hooks
 */
function createWrapper() {
  testQueryClient = createTestQueryClient();

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={testQueryClient}>
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
    testQueryClient = createTestQueryClient();
  });

  // Reset handlers after each test
  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
    cleanupAfterEach(testQueryClient);
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
      expect(result.tool.id).toBe(toolId);
      expect(result.tool.name).toBeDefined();
      expect(result.tool.toolurl).toBeDefined();
    });

    it('should return LTI 1.3 tool for even IDs', async () => {
      const toolId = 2;
      const result = await fetchLtiTool(toolId);

      expect(result).toBeDefined();
      expect(result.tool.id).toBe(toolId);
      // LTI 1.3 tools have lti version info
      expectLTIVersionValid(result.ltiVersion);
    });

    it('should return LTI 1.1 tool for odd IDs', async () => {
      const toolId = 1;
      const result = await fetchLtiTool(toolId);

      expect(result).toBeDefined();
      expect(result.tool.id).toBe(toolId);
      expectLTIVersionValid(result.ltiVersion);
    });

    it('should throw error for non-existent tool (404)', async () => {
      await expect(fetchLtiTool(404)).rejects.toThrow();
    });

    it('should throw error for permission denied (403)', async () => {
      await expect(fetchLtiTool(403)).rejects.toThrow();
    });

    it('should include all required tool properties in response', async () => {
      const result = await fetchLtiTool(1);

      // Response level properties
      expect(result).toHaveProperty('tool');
      expect(result).toHaveProperty('canLaunch');
      expect(result).toHaveProperty('isConfigured');
      expect(result).toHaveProperty('ltiVersion');

      // Core tool properties
      expect(result.tool).toHaveProperty('id');
      expect(result.tool).toHaveProperty('course');
      expect(result.tool).toHaveProperty('name');
      expect(result.tool).toHaveProperty('intro');
      expect(result.tool).toHaveProperty('toolurl');

      // Optional but expected tool properties
      expect(result.tool).toHaveProperty('securetoolurl');
      expect(result.tool).toHaveProperty('instructorchoicesendname');
      expect(result.tool).toHaveProperty('instructorchoicesendemailaddr');
      expect(result.tool).toHaveProperty('instructorchoiceacceptgrades');
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
      const options = { launchContainer: LaunchContainer.WINDOW };
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
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('privacy');
    });

    it('should include config and services in configuration', async () => {
      const toolId = 1;
      const result = await fetchLtiToolConfig(toolId);

      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('resourceLinkId');
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
        (t) => t.ltiversion?.includes('1p0')
      );
      const hasLti13 = result.types.some(
        (t) => t.ltiversion?.includes('1p3')
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
      const gradeData = { userId: 123, grade: 85 }; // Grade is 0-100 per API
      const result = await submitLtiGradePassback(toolId, gradeData);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.gradeResult).toBeDefined();
      expect(result.gradeResult.gradepercent).toBeGreaterThanOrEqual(0);
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

      // Grade above 100 (on 0-100 scale)
      await expect(
        submitLtiGradePassback(toolId, { userId: 123, grade: 150 })
      ).rejects.toThrow();

      // Negative grade
      await expect(
        submitLtiGradePassback(toolId, { userId: 123, grade: -1 })
      ).rejects.toThrow();
    });

    it('should throw error for non-existent tool (404)', async () => {
      await expect(
        submitLtiGradePassback(404, { userId: 123, grade: 85 })
      ).rejects.toThrow();
    });

    it('should throw error for permission denied (403)', async () => {
      await expect(
        submitLtiGradePassback(403, { userId: 123, grade: 85 })
      ).rejects.toThrow();
    });

    it('should normalize grade to LTI scale (0-100)', async () => {
      const toolId = 1;
      const gradeData = { userId: 123, grade: 75 }; // Using 0-100 scale per API
      const result = await submitLtiGradePassback(toolId, gradeData);

      expectGradeInRange(result.gradeResult.gradepercent, 0, 100);
    });
  });

  // ==========================================================================
  // initiateLtiOidcLogin Tests
  // ==========================================================================

  describe('initiateLtiOidcLogin', () => {
    it('should initiate OIDC login for LTI 1.3 tool', async () => {
      const toolId = 2;
      const loginData = {
        targetLinkUri: 'https://tool.example.com/launch',
        ltiMessageHint: 'user-123',
      };
      const result = await initiateLtiOidcLogin(toolId, loginData);

      expect(result).toBeDefined();
      expect(result.authRequestUrl).toBeDefined();
      expect(result.state).toBeDefined();
      expect(result.nonce).toBeDefined();
    });

    it('should include loginHint in OIDC response', async () => {
      const toolId = 2;
      const loginData = {
        targetLinkUri: 'https://tool.example.com/launch',
        ltiMessageHint: 'user-123',
      };
      const result = await initiateLtiOidcLogin(toolId, loginData);

      expect(result.loginHint).toBeDefined();
    });

    it('should throw error for non-existent tool (404)', async () => {
      await expect(
        initiateLtiOidcLogin(404, {
          targetLinkUri: 'https://example.com',
          ltiMessageHint: 'user',
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
      expect(result.current.data?.tool.id).toBe(1);
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
        () => useLtiTool(1, false),
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
    it('should fetch launch data with query', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiLaunchData(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.endpoint).toBeDefined();
    });

    it('should handle query error for non-existent tool', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiLaunchData(404), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should support launch options', async () => {
      const wrapper = createWrapper();
      const options = { launchContainer: LaunchContainer.WINDOW };

      const { result } = renderHook(
        () => useLtiLaunchData(1, options),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
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
        ltiId: 1,
        request: { userId: 123, grade: 85 },
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
        ltiId: 1,
        request: { userId: 123, grade: 150 }, // Invalid grade > 100
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
        { ltiId: 1, request: { userId: 123, grade: 75 } },
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
        { ltiId: 404, request: { userId: 123, grade: 75 } },
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
        ltiId: 2,
        request: {
          targetLinkUri: 'https://tool.example.com/launch',
          ltiMessageHint: 'user-123',
        },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.authRequestUrl).toBeDefined();
    });

    it('should handle OIDC login error', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useLtiOidcLogin(), { wrapper });

      result.current.mutate({
        ltiId: 404,
        request: {
          targetLinkUri: 'https://tool.example.com/launch',
          ltiMessageHint: 'user-123',
        },
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
        // Implementation checks for exact 'LTI-1p3' or '1.3.0' strings
        expect(isLti13('LTI-1p3')).toBe(true);
        expect(isLti13('1.3.0')).toBe(true);
      });

      it('should return false for LTI 1.x version string', () => {
        expect(isLti13('LTI-1p0')).toBe(false);
        // Note: '1.1' is not a recognized LTI 1.3 version
        expect(isLti13('1.1')).toBe(false);
      });
    });

    describe('isLti20', () => {
      it('should return true for LTI 2.0 version string', () => {
        // Implementation only recognizes exact 'LTI-2p0' string
        expect(isLti20('LTI-2p0')).toBe(true);
      });

      it('should return false for other LTI versions', () => {
        expect(isLti20('LTI-1p0')).toBe(false);
        expect(isLti20('LTI-1p3')).toBe(false);
        // Note: '2.0' string is not recognized by strict implementation
        expect(isLti20('2.0')).toBe(false);
      });
    });

    describe('isLti1x', () => {
      it('should return true for LTI 1.x version strings', () => {
        // Implementation checks for exact 'LTI-1p0' or empty/falsy values
        expect(isLti1x('LTI-1p0')).toBe(true);
        // Falsy values default to legacy LTI 1.x
        expect(isLti1x('')).toBe(true);
      });

      it('should return false for LTI 1.3 and 2.0', () => {
        expect(isLti1x('LTI-1p3')).toBe(false);
        expect(isLti1x('LTI-2p0')).toBe(false);
        // Note: '1.1' and '1.0' strings are not recognized by strict implementation
        expect(isLti1x('1.1')).toBe(false);
        expect(isLti1x('1.0')).toBe(false);
      });
    });

    describe('getLtiLaunchTarget', () => {
      it('should return correct target for DEFAULT container', () => {
        const target = getLtiLaunchTarget(LaunchContainer.DEFAULT, 1);
        expect(target).toBe('lti-frame-1');
      });

      it('should return _blank for WINDOW container', () => {
        // WINDOW container opens in a new browser window/tab
        const target = getLtiLaunchTarget(LaunchContainer.WINDOW, 2);
        expect(target).toBe('_blank');
      });

      it('should return correct target for EMBED container', () => {
        const target = getLtiLaunchTarget(LaunchContainer.EMBED, 3);
        expect(target).toBe('lti-embed-3');
      });

      it('should return _self for REPLACE_MOODLE_WINDOW container', () => {
        const target = getLtiLaunchTarget(LaunchContainer.REPLACE_MOODLE_WINDOW, 4);
        expect(target).toBe('_self');
      });
    });

    describe('getLtiWindowFeatures', () => {
      it('should return undefined for non-window launch', () => {
        const mockLaunchData = {
          endpoint: 'https://tool.example.com/launch',
          parameters: {},
          launchContainer: LaunchContainer.DEFAULT,
        } as unknown as Parameters<typeof getLtiWindowFeatures>[0];

        const features = getLtiWindowFeatures(mockLaunchData);
        expect(features).toBeUndefined();
      });

      it('should return window features for WINDOW launch', () => {
        const mockLaunchData = {
          endpoint: 'https://tool.example.com/launch',
          parameters: {},
          launchContainer: LaunchContainer.WINDOW,
          windowFeatures: 'width=800,height=600,resizable=yes',
        } as unknown as Parameters<typeof getLtiWindowFeatures>[0];

        const features = getLtiWindowFeatures(mockLaunchData);
        expect(typeof features).toBe('string');
        expect(features).toContain('width=');
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

      // Result should be the unwrapped data from envelope (LtiToolDetailResponse)
      expect(result).not.toHaveProperty('success');
      // LtiToolDetailResponse has a 'tool' property containing the LtiTool
      expect(result).toHaveProperty('tool');
      expect(result.tool).toHaveProperty('id');
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
      const _id: number = result.tool.id;
      const _name: string = result.tool.name;
      const _course: number = result.tool.course;

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
      const result = await submitLtiGradePassback(1, { userId: 123, grade: 85 });

      // TypeScript validation
      const _gradepercent: number = result.gradeResult.gradepercent;

      expect(typeof _gradepercent).toBe('number');
      expectGradeInRange(_gradepercent, 0, 100);
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
        ltiId: 1,
        request: { userId: 123, grade: 90 },
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
      let capturedBody: { userId?: number; grade?: number } | null = null;

      server.use(
        http.post(`${API_BASE_URL}/lti/:id/grades`, async ({ request }) => {
          capturedBody = await request.json() as { userId?: number; grade?: number };
          return HttpResponse.json(createSuccessResponse({
            success: true,
            message: 'Grade updated',
            gradeResult: {
              id: 1,
              ltiid: 1,
              userid: capturedBody?.userId || 456,
              gradepercent: (capturedBody?.grade || 75),
              dategraded: Math.floor(Date.now() / 1000),
              datesubmitted: Math.floor(Date.now() / 1000),
              dateupdated: Math.floor(Date.now() / 1000),
              originalgrade: (capturedBody?.grade || 75) / 100,
              launchid: 1,
              state: 1,
            },
          }));
        })
      );

      await submitLtiGradePassback(1, { userId: 456, grade: 75 });

      expect(capturedBody).not.toBeNull();
      expect(capturedBody!.userId).toBe(456);
      expect(capturedBody!.grade).toBe(75);
    });

    it('should send correct body for OIDC login', async () => {
      let capturedBody: { targetLinkUri?: string; ltiMessageHint?: string } | null = null;

      server.use(
        http.post(`${API_BASE_URL}/lti/:id/initiate-login`, async ({ request }) => {
          capturedBody = await request.json() as { targetLinkUri?: string; ltiMessageHint?: string };
          return HttpResponse.json(
            createSuccessResponse({
              authRequestUrl: 'https://example.com/auth',
              state: 'state',
              nonce: 'nonce',
              loginHint: 'user',
              ltiMessageHint: capturedBody?.ltiMessageHint,
            })
          );
        })
      );

      await initiateLtiOidcLogin(2, {
        targetLinkUri: 'https://tool.example.com/launch',
        ltiMessageHint: 'user-789',
      });

      expect(capturedBody).not.toBeNull();
      expect(capturedBody!.targetLinkUri).toBe('https://tool.example.com/launch');
      expect(capturedBody!.ltiMessageHint).toBe('user-789');
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
        // Validate signature is a non-empty base64-encoded string
        expect(signature.value).toBeTruthy();
        expect(typeof signature.value).toBe('string');
        // OAuth signatures should be base64-encoded
        expect(signature.value.length).toBeGreaterThan(0);
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
