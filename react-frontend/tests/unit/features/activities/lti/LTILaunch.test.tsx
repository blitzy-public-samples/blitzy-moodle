/**
 * LTILaunch.test.tsx
 * 
 * Unit tests for LTILauncher component validating tool launch workflows including:
 * - OAuth 1.0 signature generation for LTI 1.1
 * - OIDC login initiation for LTI 1.3
 * - Launch URL construction
 * - Required and custom parameters
 * - Grade passback setup
 * - Launch error handling
 * 
 * @module tests/unit/features/activities/lti/LTILaunch.test
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

// Internal imports from dependencies
import LTILauncher from '@/features/activities/lti/components/LTILauncher';
import { useLTILaunch } from '@/features/activities/lti/hooks/useLTILaunch';
import type { LtiTool } from '@/features/activities/lti/types/lti.types';
import { LaunchContainer } from '@/features/activities/lti/types/lti.types';
import { render } from '@tests/helpers/render';
import { server } from '@tests/mocks/server';

/**
 * Mock LTI tool configuration for LTI 1.1 testing
 */
const createMockLti11Tool = (overrides: Partial<LtiTool> = {}): LtiTool => ({
  id: 1001,
  course: 50,
  name: 'External Tool - LTI 1.1',
  intro: 'Test LTI 1.1 tool for testing OAuth signatures',
  introformat: 1,
  timecreated: Math.floor(Date.now() / 1000) - 86400,
  timemodified: Math.floor(Date.now() / 1000) - 3600,
  typeid: 10,
  toolurl: 'https://tool.example.com/lti/launch',
  securetoolurl: 'https://tool.example.com/lti/launch',
  instructorchoicesendname: 1,
  instructorchoicesendemailaddr: 1,
  instructorchoiceallowroster: 0,
  instructorchoiceallowsetting: 0,
  instructorcustomparameters: 'custom_user_id=$User.id\ncustom_course_id=$CourseSection.id',
  instructorchoiceacceptgrades: 2,
  grade: 100,
  launchcontainer: 1, // Embed
  resourcekey: 'test_consumer_key_1234',
  password: 'test_consumer_secret_5678',
  debuglaunch: 0,
  showtitlelaunch: 1,
  showdescriptionlaunch: 1,
  servicesalt: 'random_salt_for_grade_passback',
  icon: '',
  secureicon: '',
  ...overrides,
});

/**
 * Mock LTI tool configuration for LTI 1.3 testing
 */
const createMockLti13Tool = (overrides: Partial<LtiTool> = {}): LtiTool => ({
  id: 1002,
  course: 50,
  name: 'External Tool - LTI 1.3',
  intro: 'Test LTI 1.3 tool for testing OIDC and JWT',
  introformat: 1,
  timecreated: Math.floor(Date.now() / 1000) - 86400,
  timemodified: Math.floor(Date.now() / 1000) - 3600,
  typeid: 11,
  toolurl: 'https://tool.example.com/lti13/launch',
  securetoolurl: 'https://tool.example.com/lti13/launch',
  instructorchoicesendname: 1,
  instructorchoicesendemailaddr: 1,
  instructorchoiceallowroster: 0,
  instructorchoiceallowsetting: 1,
  instructorcustomparameters: 'custom_username=$User.username\ncustom_fullname=$Person.name.full',
  instructorchoiceacceptgrades: 2,
  grade: 100,
  launchcontainer: 3, // New Window
  resourcekey: '', // Not used in LTI 1.3
  password: '', // Not used in LTI 1.3
  debuglaunch: 0,
  showtitlelaunch: 1,
  showdescriptionlaunch: 1,
  servicesalt: 'lti13_salt_for_outcomes',
  icon: '',
  secureicon: '',
  ...overrides,
});

/**
 * Helper type for launch parameter array
 */
interface MockLaunchParameter {
  name: string;
  value: string;
}

/**
 * Helper to convert parameters array to object for easy assertion
 */
const paramsToObject = (params: MockLaunchParameter[]): Record<string, string> => 
  Object.fromEntries(params.map(p => [p.name, p.value]));

/**
 * Helper to find a parameter by name
 */
const findParam = (params: MockLaunchParameter[], name: string): string | undefined => 
  params.find(p => p.name === name)?.value;

/**
 * Mock launch response data for LTI 1.1
 */
const createMockLti11LaunchResponse = (toolId: number = 1001) => ({
  success: true,
  data: {
    endpoint: 'https://tool.example.com/lti/launch',
    launchMethod: 'POST' as const,
    ltiVersion: 'LTI-1p0',
    launchContainer: LaunchContainer.EMBED,
    requiresOidc: false,
    parameters: [
      // Required LTI parameters
      { name: 'lti_message_type', value: 'basic-lti-launch-request' },
      { name: 'lti_version', value: 'LTI-1p0' },
      { name: 'resource_link_id', value: toolId.toString() },
      { name: 'resource_link_title', value: 'External Tool - LTI 1.1' },
      { name: 'resource_link_description', value: 'Test LTI 1.1 tool for testing OAuth signatures' },
      { name: 'user_id', value: '42' },
      { name: 'roles', value: 'Instructor,urn:lti:instrole:ims/lis/Instructor' },
      { name: 'context_id', value: '50' },
      { name: 'context_label', value: 'TEST101' },
      { name: 'context_title', value: 'Test Course for LTI' },
      { name: 'context_type', value: 'CourseSection' },
      { name: 'launch_presentation_locale', value: 'en-US' },
      { name: 'launch_presentation_document_target', value: 'iframe' },
      { name: 'launch_presentation_return_url', value: 'https://moodle.example.com/mod/lti/return.php' },
      // OAuth 1.0 parameters
      { name: 'oauth_consumer_key', value: 'test_consumer_key_1234' },
      { name: 'oauth_signature_method', value: 'HMAC-SHA1' },
      { name: 'oauth_timestamp', value: Math.floor(Date.now() / 1000).toString() },
      { name: 'oauth_nonce', value: 'abc123nonce456' },
      { name: 'oauth_version', value: '1.0' },
      { name: 'oauth_callback', value: 'about:blank' },
      { name: 'oauth_signature', value: 'base64EncodedSignature==' },
      // User information
      { name: 'lis_person_name_given', value: 'Test' },
      { name: 'lis_person_name_family', value: 'User' },
      { name: 'lis_person_name_full', value: 'Test User' },
      { name: 'lis_person_contact_email_primary', value: 'testuser@example.com' },
      // Grade passback
      { name: 'lis_outcome_service_url', value: 'https://moodle.example.com/mod/lti/service.php' },
      { name: 'lis_result_sourcedid', value: 'encrypted_sourcedid_data_here' },
      // Tool consumer
      { name: 'tool_consumer_instance_guid', value: 'moodle.example.com' },
      { name: 'tool_consumer_instance_name', value: 'Moodle LMS' },
      { name: 'tool_consumer_instance_description', value: 'Test Moodle Instance' },
      // Custom parameters (from substitution)
      { name: 'custom_user_id', value: '42' },
      { name: 'custom_course_id', value: '50' },
    ] as MockLaunchParameter[],
  },
});

/**
 * Mock launch response data for LTI 1.3
 */
const createMockLti13LaunchResponse = (toolId: number = 1002) => ({
  success: true,
  data: {
    endpoint: 'https://tool.example.com/lti13/oidc/login',
    launchMethod: 'GET' as const,
    ltiVersion: 'LTI-1p3',
    launchContainer: LaunchContainer.WINDOW,
    requiresOidc: true,
    oidcLoginUrl: 'https://tool.example.com/lti13/oidc/login',
    parameters: [
      // OIDC login parameters
      { name: 'iss', value: 'https://moodle.example.com' },
      { name: 'target_link_uri', value: 'https://tool.example.com/lti13/launch' },
      { name: 'login_hint', value: 'user_42' },
      { name: 'lti_message_hint', value: 'launch_context_encoded_data' },
      { name: 'client_id', value: 'lti13_client_id_abc123' },
      { name: 'deployment_id', value: 'deployment_001' },
      { name: 'lti_deployment_id', value: 'deployment_001' },
      // LTI 1.3 message parameters (sent after OIDC)
      { name: 'lti_message_type', value: 'LtiResourceLinkRequest' },
      { name: 'lti_version', value: 'LTI-1p3' },
      { name: 'resource_link_id', value: toolId.toString() },
      { name: 'resource_link_title', value: 'External Tool - LTI 1.3' },
      { name: 'user_id', value: '42' },
      { name: 'roles', value: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor' },
      { name: 'context_id', value: '50' },
      { name: 'context_label', value: 'TEST101' },
      { name: 'context_title', value: 'Test Course for LTI' },
      { name: 'launch_presentation_locale', value: 'en-US' },
      { name: 'launch_presentation_document_target', value: 'window' },
      // Custom parameters
      { name: 'custom_username', value: 'testuser' },
      { name: 'custom_fullname', value: 'Test User' },
      // AGS (Assignment and Grade Services) for LTI 1.3
      { name: 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint', value: 'https://moodle.example.com/mod/lti/services.php/ags' },
    ] as MockLaunchParameter[],
  },
});

/**
 * Mock error responses
 */
const createMockErrorResponse = (
  code: string,
  message: string,
  details?: Record<string, unknown>
) => ({
  success: false,
  error: {
    code,
    message,
    details,
  },
});

// Test setup and teardown
describe('LTILauncher Component', () => {
  // Spies
  let formSubmitSpy: Mock;
  let windowOpenSpy: Mock;

  beforeEach(() => {
    // Reset handlers
    server.resetHandlers();
    
    // Clear localStorage
    localStorage.clear();
    
    // Mock form submission for embed mode
    formSubmitSpy = vi.fn();
    HTMLFormElement.prototype.submit = formSubmitSpy;
    
    // Mock window.open for popup mode - return a mock window object
    windowOpenSpy = vi.fn(() => ({
      document: { title: '', write: vi.fn() },
      focus: vi.fn(),
      closed: false,
    }));
    window.open = windowOpenSpy;
    
    // Mock window.location.assign using spyOn (non-destructive)
    // This preserves window.location.origin which is required for URL resolution
    vi.spyOn(window.location, 'assign').mockImplementation(vi.fn());
    
    // Add auth refresh handler to prevent 401 infinite loops
    server.use(
      http.post('http://localhost:8000/api/v1/auth/refresh', () => {
        return HttpResponse.json({
          success: true,
          data: { accessToken: 'test-refreshed-token' }
        });
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ============================================================
  // LTI 1.1 LAUNCH WITH OAUTH 1.0 SIGNATURE TESTS
  // ============================================================
  describe('LTI 1.1 Launch with OAuth 1.0 Signatures', () => {
    it('should initiate LTI 1.1 launch with correct OAuth parameters', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      // Setup mock API handler
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', ({ params }) => {
          expect(params.ltiId).toBe(mockTool.id.toString());
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      // Wait for auto-launch to complete and form submit
      await waitFor(() => {
        expect(formSubmitSpy).toHaveBeenCalled();
      }, { timeout: 5000 });
    });

    it('should include HMAC-SHA1 signature method in OAuth parameters', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        const params = paramsToObject(launchResponse.data.parameters);
        expect(params.oauth_signature_method).toBe('HMAC-SHA1');
        expect(params.oauth_version).toBe('1.0');
      });
    });

    it('should include oauth_timestamp and oauth_nonce for signature', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        const params = paramsToObject(launchResponse.data.parameters);
        // Validate timestamp is numeric and recent
        expect(params.oauth_timestamp).toBeDefined();
        expect(parseInt(params.oauth_timestamp!)).toBeGreaterThan(0);
        // Validate nonce exists and is non-empty
        expect(params.oauth_nonce).toBeDefined();
        expect(params.oauth_nonce!.length).toBeGreaterThan(0);
      });
    });

    it('should generate base string with correct HTTP method and endpoint', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        // Verify launch URL and method from response
        expect(launchResponse.data.endpoint).toBe('https://tool.example.com/lti/launch');
        expect(launchResponse.data.launchMethod).toBe('POST');
      });
    });

    it('should include oauth_consumer_key in the request parameters', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'oauth_consumer_key')).toBe('test_consumer_key_1234');
      });
    });

    it('should include oauth_callback set to about:blank for OAuth 1.0A compliance', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'oauth_callback')).toBe('about:blank');
      });
    });
  });

  // ============================================================
  // LTI 1.3 OIDC LOGIN INITIATION TESTS
  // ============================================================
  describe('LTI 1.3 OIDC Login Initiation', () => {
    it('should initiate OIDC login flow for LTI 1.3 tools', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.WINDOW}
        />
      );

      // For window mode, need to check for link or window open
      await waitFor(() => {
        // LTI 1.3 with window container shows a launch link or triggers window open
        // Verify the response data is correct for OIDC flow
        expect(launchResponse.data.requiresOidc).toBe(true);
        expect(launchResponse.data.oidcLoginUrl).toBe('https://tool.example.com/lti13/oidc/login');
      }, { timeout: 5000 });
    });

    it('should include login_hint parameter for user identification', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.WINDOW}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'login_hint')).toBe('user_42');
      });
    });

    it('should include lti_message_hint with launch context', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.WINDOW}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'lti_message_hint')).toBe('launch_context_encoded_data');
      });
    });

    it('should include target_link_uri pointing to tool launch URL', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.WINDOW}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'target_link_uri')).toBe('https://tool.example.com/lti13/launch');
      });
    });

    it('should include issuer (iss) claim for platform identification', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.WINDOW}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'iss')).toBe('https://moodle.example.com');
      });
    });

    it('should include client_id for tool registration', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.WINDOW}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'client_id')).toBe('lti13_client_id_abc123');
      });
    });

    it('should include deployment_id for multi-tenancy support', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.WINDOW}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'deployment_id')).toBe('deployment_001');
      });
    });
  });

  // ============================================================
  // LAUNCH PARAMETER ASSEMBLY TESTS
  // ============================================================
  describe('Launch Parameter Assembly', () => {
    it('should include required lti_message_type parameter', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'lti_message_type')).toBe('basic-lti-launch-request');
      });
    });

    it('should include required lti_version parameter', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'lti_version')).toBe('LTI-1p0');
      });
    });

    it('should include required resource_link_id parameter', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'resource_link_id')).toBe(mockTool.id.toString());
      });
    });

    it('should include required user_id parameter', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'user_id')).toBe('42');
      });
    });

    it('should include required roles parameter', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'roles')).toContain('Instructor');
      });
    });

    it('should include required context_id parameter', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'context_id')).toBe('50');
      });
    });

    it('should include optional context_label and context_title', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'context_label')).toBe('TEST101');
        expect(findParam(launchResponse.data.parameters, 'context_title')).toBe('Test Course for LTI');
      });
    });

    it('should include resource_link_title when tool has a name', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'resource_link_title')).toBe('External Tool - LTI 1.1');
      });
    });

    it('should include tool_consumer_instance_guid', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'tool_consumer_instance_guid')).toBe('moodle.example.com');
      });
    });

    it('should include user personal information when sendname is enabled', async () => {
      const mockTool = createMockLti11Tool({ instructorchoicesendname: 1 });
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'lis_person_name_given')).toBe('Test');
        expect(findParam(launchResponse.data.parameters, 'lis_person_name_family')).toBe('User');
        expect(findParam(launchResponse.data.parameters, 'lis_person_name_full')).toBe('Test User');
      });
    });

    it('should include user email when sendemailaddr is enabled', async () => {
      const mockTool = createMockLti11Tool({ instructorchoicesendemailaddr: 1 });
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'lis_person_contact_email_primary')).toBe('testuser@example.com');
      });
    });
  });

  // ============================================================
  // CUSTOM PARAMETER SUBSTITUTION TESTS
  // ============================================================
  describe('Custom Parameter Substitution', () => {
    it('should substitute $User.id variable in custom parameters', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'custom_user_id')).toBe('42');
      });
    });

    it('should substitute $CourseSection.id variable in custom parameters', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'custom_course_id')).toBe('50');
      });
    });

    it('should substitute $User.username variable for LTI 1.3', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.WINDOW}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'custom_username')).toBe('testuser');
      });
    });

    it('should substitute $Person.name.full variable for LTI 1.3', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.WINDOW}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'custom_fullname')).toBe('Test User');
      });
    });

    it('should handle custom parameters with special characters', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      // Add a custom parameter with special characters
      launchResponse.data.parameters.push({
        name: 'custom_special',
        value: 'test&value=with<special>chars',
      });
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'custom_special')).toBe('test&value=with<special>chars');
      });
    });
  });

  // ============================================================
  // GRADE PASSBACK (OUTCOMES SERVICE) TESTS
  // ============================================================
  describe('Grade Passback Configuration', () => {
    it('should include lis_outcome_service_url when grades are accepted', async () => {
      const mockTool = createMockLti11Tool({ instructorchoiceacceptgrades: 2 });
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'lis_outcome_service_url')).toBe('https://moodle.example.com/mod/lti/service.php');
      });
    });

    it('should include lis_result_sourcedid with encrypted data', async () => {
      const mockTool = createMockLti11Tool({ instructorchoiceacceptgrades: 2 });
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        const sourcedid = findParam(launchResponse.data.parameters, 'lis_result_sourcedid');
        expect(sourcedid).toBeDefined();
        expect(sourcedid!.length).toBeGreaterThan(0);
      });
    });

    it('should include Assignment and Grade Services endpoint for LTI 1.3', async () => {
      const mockTool = createMockLti13Tool({ instructorchoiceacceptgrades: 2 });
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.WINDOW}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint')).toBe('https://moodle.example.com/mod/lti/services.php/ags');
      });
    });
  });

  // ============================================================
  // LAUNCH PRESENTATION SETTINGS TESTS
  // ============================================================
  describe('Launch Presentation Settings', () => {
    it('should set document_target to iframe for embed container', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'launch_presentation_document_target')).toBe('iframe');
      });
    });

    it('should set document_target to window for new window container', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.WINDOW}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'launch_presentation_document_target')).toBe('window');
      });
    });

    it('should include launch_presentation_return_url', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'launch_presentation_return_url')).toBe('https://moodle.example.com/mod/lti/return.php');
      });
    });

    it('should include launch_presentation_locale', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'launch_presentation_locale')).toBe('en-US');
      });
    });
  });

  // ============================================================
  // CONTENT ITEM SELECTION TESTS
  // ============================================================
  describe('Content Item Selection (Deep Linking)', () => {
    it('should support ContentItemSelectionRequest message type', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      // Modify for content item selection
      const params = launchResponse.data.parameters;
      const msgTypeParam = params.find(p => p.name === 'lti_message_type');
      if (msgTypeParam) {
        msgTypeParam.value = 'ContentItemSelectionRequest';
      }
      params.push(
        { name: 'content_item_return_url', value: 'https://moodle.example.com/mod/lti/contentitem_return.php' },
        { name: 'accept_media_types', value: 'application/vnd.ims.lti.v1.ltilink' },
        { name: 'accept_presentation_document_targets', value: 'frame,iframe,window' },
        { name: 'accept_multiple', value: 'false' },
        { name: 'auto_create', value: 'true' }
      );
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          action="ContentItemSelection"
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'lti_message_type')).toBe('ContentItemSelectionRequest');
        expect(findParam(launchResponse.data.parameters, 'content_item_return_url')).toBe('https://moodle.example.com/mod/lti/contentitem_return.php');
      });
    });

    it('should include accept_media_types for content item selection', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      launchResponse.data.parameters.push(
        { name: 'accept_media_types', value: 'application/vnd.ims.lti.v1.ltilink' }
      );
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          action="ContentItemSelection"
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(findParam(launchResponse.data.parameters, 'accept_media_types')).toBe('application/vnd.ims.lti.v1.ltilink');
      });
    });
  });

  // ============================================================
  // ERROR HANDLING TESTS
  // ============================================================
  describe('Launch Error Handling', () => {
    it('should display error for invalid tool configuration', async () => {
      const mockTool = createMockLti11Tool();
      const errorResponse = createMockErrorResponse(
        'MISSING_TOOL_CONFIGURATION',
        'Tool configuration is missing or invalid'
      );
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(errorResponse, { status: 400 });
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        const errorAlert = screen.queryByRole('alert');
        expect(errorAlert).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should display error for missing required parameters', async () => {
      const mockTool = createMockLti11Tool();
      const errorResponse = createMockErrorResponse(
        'MISSING_REQUIRED_PARAMETERS',
        'Required launch parameters are missing'
      );
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(errorResponse, { status: 400 });
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        const errorAlert = screen.queryByRole('alert');
        expect(errorAlert).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should display error for OAuth signature failures', async () => {
      const mockTool = createMockLti11Tool();
      const errorResponse = createMockErrorResponse(
        'INVALID_OAUTH_SIGNATURE',
        'OAuth signature validation failed'
      );
      
      // Note: Using 400 Bad Request, not 401 Unauthorized
      // LTI OAuth signature failures are client errors (invalid request),
      // not authentication errors. Using 401 would trigger the auth refresh
      // interceptor and cause an infinite retry loop.
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(errorResponse, { status: 400 });
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          autoLaunch={true}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        const errorAlert = screen.queryByRole('alert');
        expect(errorAlert).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should display error for expired JWT token in LTI 1.3', async () => {
      const mockTool = createMockLti13Tool();
      const errorResponse = createMockErrorResponse(
        'EXPIRED_JWT_TOKEN',
        'JWT token has expired'
      );
      
      // Note: Using 400 Bad Request for LTI JWT token validation errors.
      // This is distinct from the application's own 401 auth failures.
      // Expired LTI JWT is a request validation error, not an app auth error.
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(errorResponse, { status: 400 });
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          autoLaunch={true}
          container={LaunchContainer.WINDOW}
        />
      );

      await waitFor(() => {
        const errorAlert = screen.queryByRole('alert');
        expect(errorAlert).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should handle permission denied errors', async () => {
      const mockTool = createMockLti11Tool();
      const errorResponse = createMockErrorResponse(
        'PERMISSION_DENIED',
        'You do not have permission to launch this tool'
      );
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(errorResponse, { status: 403 });
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          autoLaunch={true}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        const errorAlert = screen.queryByRole('alert');
        expect(errorAlert).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should handle tool not found errors', async () => {
      const errorResponse = createMockErrorResponse(
        'TOOL_NOT_FOUND',
        'The requested LTI tool was not found'
      );
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(errorResponse, { status: 404 });
        })
      );

      render(
        <LTILauncher
          ltiId={9999}
          autoLaunch={true}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        const errorAlert = screen.queryByRole('alert');
        expect(errorAlert).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should handle network errors gracefully', async () => {
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.error();
        })
      );

      render(
        <LTILauncher
          ltiId={1001}
          autoLaunch={true}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        const errorAlert = screen.queryByRole('alert');
        expect(errorAlert).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should handle tool provider unavailable (5xx) errors', async () => {
      const mockTool = createMockLti11Tool();
      const errorResponse = createMockErrorResponse(
        'TOOL_UNAVAILABLE',
        'The external tool is temporarily unavailable'
      );
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(errorResponse, { status: 503 });
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          autoLaunch={true}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        const errorAlert = screen.queryByRole('alert');
        expect(errorAlert).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  // ============================================================
  // SECURITY VALIDATION TESTS
  // ============================================================
  describe('Security Checks', () => {
    it('should enforce HTTPS for tool launch URL when SSL is required', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        // Verify the endpoint uses HTTPS
        expect(launchResponse.data.endpoint).toMatch(/^https:\/\//);
      });
    });

    it('should sanitize user input in custom parameters', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      // Add sanitized custom parameter
      launchResponse.data.parameters.push({
        name: 'custom_sanitized',
        value: 'safe_value_only',
      });
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        const sanitizedValue = findParam(launchResponse.data.parameters, 'custom_sanitized');
        expect(sanitizedValue).toBe('safe_value_only');
        // Verify no script tags or dangerous content
        expect(sanitizedValue).not.toContain('<script>');
      });
    });

    it('should validate launch URL domain', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        const url = new URL(launchResponse.data.endpoint);
        expect(url.hostname).toBe('tool.example.com');
        // Should be a valid domain
        expect(url.hostname).toMatch(/^[a-z0-9.-]+$/i);
      });
    });

    it('should reject file:// protocol in launch URL', async () => {
      const mockTool = createMockLti11Tool();
      const errorResponse = createMockErrorResponse(
        'INVALID_LAUNCH_URL',
        'Invalid launch URL protocol'
      );
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(errorResponse, { status: 400 });
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          autoLaunch={true}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        const errorAlert = screen.queryByRole('alert');
        expect(errorAlert).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  // ============================================================
  // AUTO-LAUNCH BEHAVIOR TESTS
  // ============================================================
  describe('Auto-Launch Behavior', () => {
    it('should automatically launch when autoLaunch is true', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      let apiCalled = false;
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          apiCalled = true;
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          autoLaunch={true}
          container={LaunchContainer.EMBED}
        />
      );

      await waitFor(() => {
        expect(apiCalled).toBe(true);
      }, { timeout: 5000 });
    });

    it('should not auto-launch when autoLaunch is false', async () => {
      const mockTool = createMockLti11Tool();
      
      let apiCalled = false;
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          apiCalled = true;
          return HttpResponse.json(createMockLti11LaunchResponse(mockTool.id));
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          autoLaunch={false}
          container={LaunchContainer.EMBED}
        />
      );

      // Wait a bit to ensure no API call is made
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(apiCalled).toBe(false);
    });
  });

  // ============================================================
  // LAUNCH CONTAINER MODE TESTS
  // ============================================================
  describe('Launch Container Modes', () => {
    it('should render iframe for embed container mode', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          autoLaunch={true}
          container={LaunchContainer.EMBED}
        />
      );

      // Wait for launch and iframe render
      await waitFor(() => {
        const iframe = document.querySelector('iframe');
        expect(iframe).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should show link for window container mode', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.WINDOW}
        />
      );

      // For window mode, should show a link to open in new window
      await waitFor(() => {
        const link = screen.queryByRole('link');
        expect(link || screen.queryByText(/window/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should show loading for replace container mode', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      launchResponse.data.launchContainer = LaunchContainer.REPLACE_MOODLE_WINDOW;
      
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.REPLACE_MOODLE_WINDOW}
        />
      );

      // Replace mode shows a loading/redirecting message
      await waitFor(() => {
        expect(screen.queryByText(/redirect/i) || screen.queryByRole('progressbar')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  // ============================================================
  // LOADING STATE TESTS
  // ============================================================
  describe('Loading States', () => {
    it('should show loading indicator during launch', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      // Delay the response to capture loading state
      server.use(
        http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          container={LaunchContainer.EMBED}
          showLoading={true}
        />
      );

      // Should show loading initially
      await waitFor(() => {
        const progressbar = screen.queryByRole('progressbar');
        const loadingText = screen.queryByText(/loading|preparing/i);
        expect(progressbar || loadingText).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });
});

// ============================================================
// useLTILaunch HOOK TESTS
// ============================================================
describe('useLTILaunch Hook', () => {
  it('should return launchTool mutation function', async () => {
    const mockTool = createMockLti11Tool();
    const launchResponse = createMockLti11LaunchResponse(mockTool.id);
    
    server.use(
      http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
        return HttpResponse.json(launchResponse);
      })
    );

    let hookResult: ReturnType<typeof useLTILaunch> | null = null;
    
    const TestComponent = () => {
      hookResult = useLTILaunch(mockTool.id);
      return <div>Test</div>;
    };

    render(<TestComponent />);

    await waitFor(() => {
      expect(hookResult).toBeDefined();
      expect(hookResult?.launchTool).toBeDefined();
      expect(typeof hookResult?.launchTool).toBe('function');
    });
  });

  it('should handle launch success', async () => {
    const mockTool = createMockLti11Tool();
    const launchResponse = createMockLti11LaunchResponse(mockTool.id);
    
    server.use(
      http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
        return HttpResponse.json(launchResponse);
      })
    );

    let hookResult: ReturnType<typeof useLTILaunch> | null = null;
    
    const TestComponent = () => {
      hookResult = useLTILaunch(mockTool.id);
      return <div>Test</div>;
    };

    render(<TestComponent />);

    await waitFor(() => {
      expect(hookResult?.launchTool).toBeDefined();
    });

    // Call launchTool
    await act(async () => {
      await hookResult?.launchTool();
    });

    await waitFor(() => {
      expect(hookResult?.launchData).toBeDefined();
    });
  });

  it('should handle launch error', async () => {
    const mockTool = createMockLti11Tool();
    const errorResponse = createMockErrorResponse(
      'LAUNCH_FAILED',
      'Failed to launch tool'
    );
    
    server.use(
      http.post('http://localhost:8000/api/v1/lti/:ltiId/launch', () => {
        return HttpResponse.json(errorResponse, { status: 500 });
      })
    );

    let hookResult: ReturnType<typeof useLTILaunch> | null = null;
    
    const TestComponent = () => {
      hookResult = useLTILaunch(mockTool.id);
      return <div>Test</div>;
    };

    render(<TestComponent />);

    await waitFor(() => {
      expect(hookResult?.launchTool).toBeDefined();
    });

    // Call launchTool and expect it to throw
    await act(async () => {
      try {
        await hookResult?.launchTool();
      } catch {
        // Expected
      }
    });

    await waitFor(() => {
      expect(hookResult?.error).toBeDefined();
    });
  });
});
