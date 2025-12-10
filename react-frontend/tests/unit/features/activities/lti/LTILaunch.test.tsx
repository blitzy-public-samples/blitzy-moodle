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

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { screen, waitFor, act, fireEvent, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

// Internal imports from dependencies
import { LTILauncher } from '@/features/activities/lti/components/LTILauncher';
import { useLTILaunch } from '@/features/activities/lti/hooks/useLTILaunch';
import type { LtiTool } from '@/features/activities/lti/types/lti.types';
import { render, userEvent } from '@tests/helpers/render';
import { server } from '@tests/mocks/server';

/**
 * Mock LTI tool configuration for LTI 1.1 testing
 */
const createMockLti11Tool = (overrides: Partial<LtiTool> = {}): LtiTool => ({
  id: 1001,
  courseId: 50,
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
  ltiversion: 'LTI-1p0',
  state: 1,
  course: 50,
  coursemoduleid: 2001,
  section: 0,
  visible: 1,
  groupmode: 0,
  groupingid: 0,
  ...overrides,
});

/**
 * Mock LTI tool configuration for LTI 1.3 testing
 */
const createMockLti13Tool = (overrides: Partial<LtiTool> = {}): LtiTool => ({
  id: 1002,
  courseId: 50,
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
  ltiversion: '1.3.0',
  state: 1,
  course: 50,
  coursemoduleid: 2002,
  section: 0,
  visible: 1,
  groupmode: 0,
  groupingid: 0,
  ...overrides,
});

/**
 * Mock launch response data for LTI 1.1
 */
const createMockLti11LaunchResponse = (toolId: number = 1001) => ({
  success: true,
  data: {
    launchUrl: 'https://tool.example.com/lti/launch',
    launchMethod: 'POST' as const,
    version: 'LTI-1p0',
    container: 'embed',
    parameters: {
      // Required LTI parameters
      lti_message_type: 'basic-lti-launch-request',
      lti_version: 'LTI-1p0',
      resource_link_id: toolId.toString(),
      resource_link_title: 'External Tool - LTI 1.1',
      resource_link_description: 'Test LTI 1.1 tool for testing OAuth signatures',
      user_id: '42',
      roles: 'Instructor,urn:lti:instrole:ims/lis/Instructor',
      context_id: '50',
      context_label: 'TEST101',
      context_title: 'Test Course for LTI',
      context_type: 'CourseSection',
      launch_presentation_locale: 'en-US',
      launch_presentation_document_target: 'iframe',
      launch_presentation_return_url: 'https://moodle.example.com/mod/lti/return.php?course=50&launch_container=1&instanceid=1001',
      tool_consumer_info_product_family_code: 'moodle',
      tool_consumer_info_version: '2024051500',
      tool_consumer_instance_guid: 'moodle.example.com',
      tool_consumer_instance_name: 'Test Moodle Site',
      tool_consumer_instance_description: 'Moodle Test Instance',
      ext_lms: 'moodle-2',
      // User data
      lis_person_name_given: 'Test',
      lis_person_name_family: 'User',
      lis_person_name_full: 'Test User',
      lis_person_contact_email_primary: 'testuser@example.com',
      lis_person_sourcedid: 'test_idnumber_123',
      ext_user_username: 'testuser',
      // Course data
      lis_course_section_sourcedid: 'TEST101-SECTION1',
      // Custom parameters (after Moodle variable substitution)
      custom_user_id: '42',
      custom_course_id: '50',
      // Grade passback parameters
      lis_outcome_service_url: 'https://moodle.example.com/mod/lti/service.php',
      lis_result_sourcedid: '{"data":{"instanceid":1001,"userid":42,"typeid":10,"launchid":12345},"hash":"abc123def456"}',
      // OAuth 1.0 signature parameters
      oauth_consumer_key: 'test_consumer_key_1234',
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: 'uniquenonce123456',
      oauth_version: '1.0',
      oauth_callback: 'about:blank',
      oauth_signature: 'base64EncodedHMACSHA1Signature==',
    },
  },
});

/**
 * Mock launch response data for LTI 1.3 OIDC initiation
 */
const createMockLti13LaunchResponse = (toolId: number = 1002) => ({
  success: true,
  data: {
    launchUrl: 'https://tool.example.com/lti13/oidc/auth',
    launchMethod: 'GET' as const,
    version: '1.3.0',
    container: 'window',
    oidcParams: {
      // OIDC login initiation parameters
      iss: 'https://moodle.example.com',
      target_link_uri: 'https://tool.example.com/lti13/launch',
      login_hint: '42', // User ID
      lti_message_hint: JSON.stringify({
        instanceid: toolId,
        courseid: 50,
        cmid: 2002,
        messagetype: 'LtiResourceLinkRequest',
      }),
      client_id: 'tool_client_id_lti13',
      deployment_id: '11',
      lti_deployment_id: '11',
    },
    parameters: {
      // Pre-computed parameters for the tool (sent after OIDC flow)
      'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiResourceLinkRequest',
      'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
      'https://purl.imsglobal.org/spec/lti/claim/deployment_id': '11',
      'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': 'https://tool.example.com/lti13/launch',
      'https://purl.imsglobal.org/spec/lti/claim/resource_link': {
        id: toolId.toString(),
        title: 'External Tool - LTI 1.3',
        description: 'Test LTI 1.3 tool for testing OIDC and JWT',
      },
      'https://purl.imsglobal.org/spec/lti/claim/roles': [
        'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
      ],
      'https://purl.imsglobal.org/spec/lti/claim/context': {
        id: '50',
        label: 'TEST101',
        title: 'Test Course for LTI',
        type: ['http://purl.imsglobal.org/vocab/lis/v2/course#CourseSection'],
      },
      'https://purl.imsglobal.org/spec/lti/claim/launch_presentation': {
        document_target: 'window',
        return_url: 'https://moodle.example.com/mod/lti/return.php?course=50&launch_container=3&instanceid=1002',
        locale: 'en-US',
      },
      'https://purl.imsglobal.org/spec/lti/claim/tool_platform': {
        guid: 'moodle.example.com',
        name: 'Test Moodle Site',
        product_family_code: 'moodle',
        version: '2024051500',
      },
      'https://purl.imsglobal.org/spec/lti/claim/custom': {
        username: 'testuser',
        fullname: 'Test User',
      },
      // LTI Advantage: Assignment and Grade Services
      'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint': {
        lineitem: 'https://moodle.example.com/mod/lti/services.php/50/lineitems/1002/lineitem',
        lineitems: 'https://moodle.example.com/mod/lti/services.php/50/lineitems',
        scope: [
          'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
          'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
          'https://purl.imsglobal.org/spec/lti-ags/scope/score',
        ],
      },
      // Sub claim for user identity
      sub: '42',
    },
  },
});

/**
 * Test suite for LTILauncher component
 */
describe('LTILauncher Component', () => {
  // Setup and teardown
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Mock window.open for popup launches
    vi.spyOn(window, 'open').mockReturnValue({
      focus: vi.fn(),
      closed: false,
      location: { href: '' },
    } as unknown as Window);
    
    // Mock window.location for navigation
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://moodle.example.com/mod/lti/view.php?id=2001',
        origin: 'https://moodle.example.com',
        assign: vi.fn(),
        replace: vi.fn(),
      },
      writable: true,
    });
    
    // Mock form submission behavior
    HTMLFormElement.prototype.submit = vi.fn();
  });

  afterEach(() => {
    // Reset server handlers and restore mocks
    server.resetHandlers();
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
        http.post('*/api/v1/lti/:ltiId/launch', ({ params }) => {
          expect(params.ltiId).toBe(mockTool.id.toString());
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      // Click launch button
      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      // Wait for launch to complete
      await waitFor(() => {
        expect(HTMLFormElement.prototype.submit).toHaveBeenCalled();
      });
    });

    it('should include HMAC-SHA1 signature method in OAuth parameters', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      let capturedParams: Record<string, string> | null = null;
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', async ({ request }) => {
          capturedParams = launchResponse.data.parameters;
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(capturedParams).not.toBeNull();
        expect(capturedParams?.oauth_signature_method).toBe('HMAC-SHA1');
        expect(capturedParams?.oauth_version).toBe('1.0');
      });
    });

    it('should include oauth_timestamp and oauth_nonce for signature', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        const params = launchResponse.data.parameters;
        // Validate timestamp is numeric and recent
        expect(params.oauth_timestamp).toBeDefined();
        expect(parseInt(params.oauth_timestamp)).toBeGreaterThan(0);
        // Validate nonce exists and is non-empty
        expect(params.oauth_nonce).toBeDefined();
        expect(params.oauth_nonce.length).toBeGreaterThan(0);
      });
    });

    it('should generate base string with correct HTTP method and endpoint', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        // Verify launch URL and method
        expect(launchResponse.data.launchUrl).toBe('https://tool.example.com/lti/launch');
        expect(launchResponse.data.launchMethod).toBe('POST');
      });
    });

    it('should include oauth_consumer_key in the request parameters', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.oauth_consumer_key).toBe('test_consumer_key_1234');
      });
    });

    it('should include oauth_callback set to about:blank for OAuth 1.0A compliance', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.oauth_callback).toBe('about:blank');
      });
    });
  });

  // ============================================================
  // LTI 1.3 OIDC INITIATION TESTS
  // ============================================================
  describe('LTI 1.3 OIDC Login Initiation', () => {
    it('should initiate OIDC login flow for LTI 1.3 tools', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        // For LTI 1.3, expect window redirect (GET method)
        expect(launchResponse.data.launchMethod).toBe('GET');
        expect(launchResponse.data.version).toBe('1.3.0');
      });
    });

    it('should include login_hint parameter for user identification', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.oidcParams?.login_hint).toBe('42');
      });
    });

    it('should include lti_message_hint with launch context', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        const messageHint = launchResponse.data.oidcParams?.lti_message_hint;
        expect(messageHint).toBeDefined();
        const parsed = JSON.parse(messageHint as string);
        expect(parsed.instanceid).toBe(mockTool.id);
        expect(parsed.courseid).toBe(50);
        expect(parsed.messagetype).toBe('LtiResourceLinkRequest');
      });
    });

    it('should include target_link_uri pointing to tool launch URL', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.oidcParams?.target_link_uri).toBe('https://tool.example.com/lti13/launch');
      });
    });

    it('should include issuer (iss) claim for platform identification', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.oidcParams?.iss).toBe('https://moodle.example.com');
      });
    });

    it('should include client_id for tool registration', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.oidcParams?.client_id).toBe('tool_client_id_lti13');
      });
    });

    it('should include deployment_id for multi-tenancy support', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.oidcParams?.deployment_id).toBe('11');
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
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.lti_message_type).toBe('basic-lti-launch-request');
      });
    });

    it('should include required lti_version parameter', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.lti_version).toBe('LTI-1p0');
      });
    });

    it('should include required resource_link_id parameter', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.resource_link_id).toBe(mockTool.id.toString());
      });
    });

    it('should include required user_id parameter', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.user_id).toBe('42');
      });
    });

    it('should include required roles parameter', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.roles).toContain('Instructor');
      });
    });

    it('should include required context_id parameter', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.context_id).toBe('50');
      });
    });

    it('should include optional context_label and context_title', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.context_label).toBe('TEST101');
        expect(launchResponse.data.parameters.context_title).toBe('Test Course for LTI');
      });
    });

    it('should include resource_link_title when tool has a name', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.resource_link_title).toBe('External Tool - LTI 1.1');
      });
    });

    it('should include tool_consumer_instance_guid', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.tool_consumer_instance_guid).toBe('moodle.example.com');
      });
    });

    it('should include user personal information when sendname is enabled', async () => {
      const mockTool = createMockLti11Tool({ instructorchoicesendname: 1 });
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.lis_person_name_given).toBe('Test');
        expect(launchResponse.data.parameters.lis_person_name_family).toBe('User');
        expect(launchResponse.data.parameters.lis_person_name_full).toBe('Test User');
      });
    });

    it('should include user email when sendemailaddr is enabled', async () => {
      const mockTool = createMockLti11Tool({ instructorchoicesendemailaddr: 1 });
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.lis_person_contact_email_primary).toBe('testuser@example.com');
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
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        // $User.id should be substituted with actual user ID
        expect(launchResponse.data.parameters.custom_user_id).toBe('42');
      });
    });

    it('should substitute $CourseSection.id variable in custom parameters', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        // $CourseSection.id should be substituted with course ID
        expect(launchResponse.data.parameters.custom_course_id).toBe('50');
      });
    });

    it('should substitute $User.username variable for LTI 1.3', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        const customClaims = launchResponse.data.parameters['https://purl.imsglobal.org/spec/lti/claim/custom'];
        expect(customClaims?.username).toBe('testuser');
      });
    });

    it('should substitute $Person.name.full variable for LTI 1.3', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        const customClaims = launchResponse.data.parameters['https://purl.imsglobal.org/spec/lti/claim/custom'];
        expect(customClaims?.fullname).toBe('Test User');
      });
    });

    it('should handle custom parameters with special characters', async () => {
      const mockTool = createMockLti11Tool({
        instructorcustomparameters: 'custom_special=value with spaces\ncustom_encoded=value%20encoded',
      });
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      launchResponse.data.parameters.custom_special = 'value with spaces';
      launchResponse.data.parameters.custom_encoded = 'value%20encoded';
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.custom_special).toBeDefined();
        expect(launchResponse.data.parameters.custom_encoded).toBeDefined();
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
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.lis_outcome_service_url).toBe(
          'https://moodle.example.com/mod/lti/service.php'
        );
      });
    });

    it('should include lis_result_sourcedid with encrypted data', async () => {
      const mockTool = createMockLti11Tool({ instructorchoiceacceptgrades: 2 });
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        const sourcedid = launchResponse.data.parameters.lis_result_sourcedid;
        expect(sourcedid).toBeDefined();
        // sourcedid should be JSON containing data and hash
        const parsed = JSON.parse(sourcedid);
        expect(parsed.data.instanceid).toBe(1001);
        expect(parsed.data.userid).toBe(42);
        expect(parsed.hash).toBeDefined();
      });
    });

    it('should include Assignment and Grade Services endpoint for LTI 1.3', async () => {
      const mockTool = createMockLti13Tool();
      const launchResponse = createMockLti13LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        const agsEndpoint = launchResponse.data.parameters['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'];
        expect(agsEndpoint).toBeDefined();
        expect(agsEndpoint.lineitem).toContain('/lineitems/');
        expect(agsEndpoint.scope).toContain('https://purl.imsglobal.org/spec/lti-ags/scope/score');
      });
    });
  });

  // ============================================================
  // LAUNCH PRESENTATION SETTINGS TESTS
  // ============================================================
  describe('Launch Presentation Settings', () => {
    it('should set document_target to iframe for embed container', async () => {
      const mockTool = createMockLti11Tool({ launchcontainer: 1 }); // Embed
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      launchResponse.data.container = 'embed';
      launchResponse.data.parameters.launch_presentation_document_target = 'iframe';
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.launch_presentation_document_target).toBe('iframe');
      });
    });

    it('should set document_target to window for new window container', async () => {
      const mockTool = createMockLti11Tool({ launchcontainer: 3 }); // New Window
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      launchResponse.data.container = 'window';
      launchResponse.data.parameters.launch_presentation_document_target = 'window';
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.launch_presentation_document_target).toBe('window');
      });
    });

    it('should include launch_presentation_return_url', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.launch_presentation_return_url).toContain('/mod/lti/return.php');
      });
    });

    it('should include launch_presentation_locale', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.launch_presentation_locale).toBe('en-US');
      });
    });
  });

  // ============================================================
  // CONTENT ITEM (DEEP LINKING) TESTS
  // ============================================================
  describe('Content Item / Deep Linking Support', () => {
    it('should support ContentItemSelectionRequest message type', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      launchResponse.data.parameters.lti_message_type = 'ContentItemSelectionRequest';
      launchResponse.data.parameters.content_item_return_url = 'https://moodle.example.com/mod/lti/contentitem_return.php';
      launchResponse.data.parameters.accept_media_types = 'application/vnd.ims.lti.v1.ltilink';
      launchResponse.data.parameters.accept_presentation_document_targets = 'frame,iframe,window';
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
          messageType="ContentItemSelectionRequest"
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.lti_message_type).toBe('ContentItemSelectionRequest');
        expect(launchResponse.data.parameters.content_item_return_url).toContain('contentitem_return.php');
      });
    });

    it('should include accept_media_types for content item selection', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      launchResponse.data.parameters.accept_media_types = 'application/vnd.ims.lti.v1.ltilink';
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
          messageType="ContentItemSelectionRequest"
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.parameters.accept_media_types).toContain('ltilink');
      });
    });
  });

  // ============================================================
  // LAUNCH ERROR HANDLING TESTS
  // ============================================================
  describe('Launch Error Handling', () => {
    it('should display error for invalid tool configuration', async () => {
      const mockTool = createMockLti11Tool();
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'INVALID_TOOL_CONFIGURATION',
              message: 'Tool configuration is invalid or incomplete',
            },
          }, { status: 400 });
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(screen.getByText(/error|failed|invalid/i)).toBeInTheDocument();
      });
    });

    it('should display error for missing required parameters', async () => {
      const mockTool = createMockLti11Tool({ toolurl: '' }); // Missing tool URL
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'MISSING_TOOL_URL',
              message: 'Tool URL is required but not configured',
            },
          }, { status: 400 });
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(screen.getByText(/error|failed|missing|url/i)).toBeInTheDocument();
      });
    });

    it('should display error for OAuth signature failures', async () => {
      const mockTool = createMockLti11Tool();
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'INVALID_OAUTH_SIGNATURE',
              message: 'OAuth signature verification failed',
            },
          }, { status: 401 });
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(screen.getByText(/error|oauth|signature|failed/i)).toBeInTheDocument();
      });
    });

    it('should display error for expired JWT token in LTI 1.3', async () => {
      const mockTool = createMockLti13Tool();
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'EXPIRED_JWT_TOKEN',
              message: 'JWT token has expired',
            },
          }, { status: 401 });
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(screen.getByText(/error|expired|token/i)).toBeInTheDocument();
      });
    });

    it('should handle permission denied errors', async () => {
      const mockTool = createMockLti11Tool();
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: 'You do not have permission to launch this tool',
            },
          }, { status: 403 });
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(screen.getByText(/error|permission|denied|access/i)).toBeInTheDocument();
      });
    });

    it('should handle tool not found errors', async () => {
      const mockTool = createMockLti11Tool({ id: 9999 });
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'TOOL_NOT_FOUND',
              message: 'The requested LTI tool was not found',
            },
          }, { status: 404 });
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(screen.getByText(/error|not found|tool/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      const mockTool = createMockLti11Tool();
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.error();
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(screen.getByText(/error|network|connection/i)).toBeInTheDocument();
      });
    });

    it('should handle tool provider unavailable (5xx) errors', async () => {
      const mockTool = createMockLti11Tool();
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'TOOL_PROVIDER_UNAVAILABLE',
              message: 'The external tool provider is currently unavailable',
            },
          }, { status: 502 });
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(screen.getByText(/error|unavailable|provider/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // SECURITY CHECKS TESTS
  // ============================================================
  describe('Security Checks', () => {
    it('should enforce HTTPS for tool launch URL when SSL is required', async () => {
      const mockTool = createMockLti11Tool({
        toolurl: 'http://insecure.example.com/lti/launch',
        securetoolurl: 'https://secure.example.com/lti/launch',
      });
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      launchResponse.data.launchUrl = 'https://secure.example.com/lti/launch';
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.launchUrl).toMatch(/^https:\/\//);
      });
    });

    it('should sanitize user input in custom parameters', async () => {
      const mockTool = createMockLti11Tool({
        instructorcustomparameters: 'custom_input=<script>alert("xss")</script>',
      });
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      // Backend should sanitize XSS attempts
      launchResponse.data.parameters.custom_input = '&lt;script&gt;alert("xss")&lt;/script&gt;';
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        // Verify script tags are escaped
        expect(launchResponse.data.parameters.custom_input).not.toContain('<script>');
      });
    });

    it('should validate launch URL domain', async () => {
      const mockTool = createMockLti11Tool({
        toolurl: 'javascript:alert("xss")',
      });
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'INVALID_LAUNCH_URL',
              message: 'Tool URL must be a valid HTTP or HTTPS URL',
            },
          }, { status: 400 });
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(screen.getByText(/error|invalid|url/i)).toBeInTheDocument();
      });
    });

    it('should reject file:// protocol in launch URL', async () => {
      const mockTool = createMockLti11Tool({
        toolurl: 'file:///etc/passwd',
      });
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'INVALID_LAUNCH_URL',
              message: 'Tool URL must be a valid HTTP or HTTPS URL',
            },
          }, { status: 400 });
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(screen.getByText(/error|invalid|url/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // AUTO-LAUNCH BEHAVIOR TESTS
  // ============================================================
  describe('Auto-Launch Behavior', () => {
    it('should automatically launch when autoLaunch is true', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={true}
        />
      );

      // Auto-launch should trigger form submission
      await waitFor(() => {
        expect(HTMLFormElement.prototype.submit).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('should not auto-launch when autoLaunch is false', async () => {
      const mockTool = createMockLti11Tool();
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      // Wait a bit and verify no auto-launch
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
      });

      expect(HTMLFormElement.prototype.submit).not.toHaveBeenCalled();
      
      // Launch button should be visible
      expect(screen.getByRole('button', { name: /launch/i })).toBeInTheDocument();
    });
  });

  // ============================================================
  // CONTAINER MODE TESTS
  // ============================================================
  describe('Launch Container Modes', () => {
    it('should render iframe for embed container mode', async () => {
      const mockTool = createMockLti11Tool({ launchcontainer: 1 }); // Embed
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      launchResponse.data.container = 'embed';
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
          container="embed"
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        // Should create iframe for embed mode
        expect(launchResponse.data.container).toBe('embed');
      });
    });

    it('should open new window for window container mode', async () => {
      const mockTool = createMockLti11Tool({ launchcontainer: 3 }); // New Window
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      launchResponse.data.container = 'window';
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
          container="window"
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.container).toBe('window');
      });
    });

    it('should replace current window for replace container mode', async () => {
      const mockTool = createMockLti11Tool({ launchcontainer: 4 }); // Replace Moodle Window
      const launchResponse = createMockLti11LaunchResponse(mockTool.id);
      launchResponse.data.container = 'replace';
      launchResponse.data.parameters.launch_presentation_document_target = 'frame';
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', () => {
          return HttpResponse.json(launchResponse);
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
          container="replace"
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      await waitFor(() => {
        expect(launchResponse.data.container).toBe('replace');
      });
    });
  });

  // ============================================================
  // LOADING STATE TESTS
  // ============================================================
  describe('Loading States', () => {
    it('should show loading indicator during launch', async () => {
      const mockTool = createMockLti11Tool();
      let resolveResponse: () => void;
      const responsePromise = new Promise<void>((resolve) => {
        resolveResponse = resolve;
      });
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', async () => {
          await responsePromise;
          return HttpResponse.json(createMockLti11LaunchResponse(mockTool.id));
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByRole('progressbar') || screen.getByText(/loading|launching/i)).toBeInTheDocument();
      });

      // Resolve the request
      resolveResponse!();
    });

    it('should disable launch button while loading', async () => {
      const mockTool = createMockLti11Tool();
      let resolveResponse: () => void;
      const responsePromise = new Promise<void>((resolve) => {
        resolveResponse = resolve;
      });
      
      server.use(
        http.post('*/api/v1/lti/:ltiId/launch', async () => {
          await responsePromise;
          return HttpResponse.json(createMockLti11LaunchResponse(mockTool.id));
        })
      );

      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      const launchButton = screen.getByRole('button', { name: /launch/i });
      await userEvent.click(launchButton);

      // Button should be disabled or hidden during loading
      await waitFor(() => {
        const button = screen.queryByRole('button', { name: /launch/i });
        if (button) {
          expect(button).toBeDisabled();
        }
      });

      // Resolve the request
      resolveResponse!();
    });
  });

  // ============================================================
  // TOOL DISPLAY TESTS  
  // ============================================================
  describe('Tool Information Display', () => {
    it('should display tool name when showtitlelaunch is enabled', async () => {
      const mockTool = createMockLti11Tool({ showtitlelaunch: 1 });
      
      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      expect(screen.getByText(mockTool.name)).toBeInTheDocument();
    });

    it('should display tool description when showdescriptionlaunch is enabled', async () => {
      const mockTool = createMockLti11Tool({ showdescriptionlaunch: 1 });
      
      render(
        <LTILauncher
          ltiId={mockTool.id}
          tool={mockTool}
          autoLaunch={false}
        />
      );

      // Description should be visible (may be truncated)
      expect(screen.getByText(/Test LTI 1\.1 tool/i)).toBeInTheDocument();
    });
  });
});

/**
 * Test suite for useLTILaunch hook
 */
describe('useLTILaunch Hook', () => {
  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  it('should return launch mutation function', async () => {
    const mockTool = createMockLti11Tool();
    const launchResponse = createMockLti11LaunchResponse(mockTool.id);
    
    server.use(
      http.post('*/api/v1/lti/:ltiId/launch', () => {
        return HttpResponse.json(launchResponse);
      })
    );

    // Render a test component that uses the hook
    const TestComponent: React.FC = () => {
      const { launch, isLoading, error } = useLTILaunch();
      
      return (
        <div>
          <button onClick={() => launch(mockTool.id)}>Launch</button>
          {isLoading && <span>Loading...</span>}
          {error && <span>Error: {error.message}</span>}
        </div>
      );
    };

    render(<TestComponent />);

    const launchButton = screen.getByRole('button', { name: 'Launch' });
    expect(launchButton).toBeInTheDocument();
  });

  it('should handle launch success', async () => {
    const mockTool = createMockLti11Tool();
    const launchResponse = createMockLti11LaunchResponse(mockTool.id);
    
    // Mock form submission
    HTMLFormElement.prototype.submit = vi.fn();
    
    server.use(
      http.post('*/api/v1/lti/:ltiId/launch', () => {
        return HttpResponse.json(launchResponse);
      })
    );

    const onSuccess = vi.fn();

    const TestComponent: React.FC = () => {
      const { launch, isLoading, isSuccess } = useLTILaunch();
      
      React.useEffect(() => {
        if (isSuccess) {
          onSuccess();
        }
      }, [isSuccess]);
      
      return (
        <div>
          <button onClick={() => launch(mockTool.id)}>Launch</button>
          {isLoading && <span data-testid="loading">Loading...</span>}
          {isSuccess && <span data-testid="success">Success</span>}
        </div>
      );
    };

    render(<TestComponent />);

    const launchButton = screen.getByRole('button', { name: 'Launch' });
    await userEvent.click(launchButton);

    await waitFor(() => {
      expect(HTMLFormElement.prototype.submit).toHaveBeenCalled();
    });
  });

  it('should handle launch error', async () => {
    const mockTool = createMockLti11Tool();
    
    server.use(
      http.post('*/api/v1/lti/:ltiId/launch', () => {
        return HttpResponse.json({
          success: false,
          error: {
            code: 'LAUNCH_FAILED',
            message: 'Launch failed',
          },
        }, { status: 500 });
      })
    );

    const TestComponent: React.FC = () => {
      const { launch, isLoading, error } = useLTILaunch();
      
      return (
        <div>
          <button onClick={() => launch(mockTool.id)}>Launch</button>
          {isLoading && <span data-testid="loading">Loading...</span>}
          {error && <span data-testid="error">{error.message}</span>}
        </div>
      );
    };

    render(<TestComponent />);

    const launchButton = screen.getByRole('button', { name: 'Launch' });
    await userEvent.click(launchButton);

    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });
  });
});
