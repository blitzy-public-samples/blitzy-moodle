/**
 * Unit Tests for useLTILaunch Hook
 *
 * Comprehensive test suite validating LTI external tool launch workflows including:
 * - OAuth 1.0 signature generation for LTI 1.1 launches
 * - OIDC login initiation for LTI 1.3 launches
 * - Launch parameter construction and assembly
 * - Custom parameter variable substitution ($User.id, $CourseSection.title, etc.)
 * - Launch state management with React Query mutations
 * - Error handling for signature validation failures, missing parameters, etc.
 *
 * Based on:
 * - public/mod/lti/launch.php - Launch request processing
 * - public/mod/lti/OAuth.php - OAuth signature implementation
 * - public/mod/lti/locallib.php - Custom parameter parsing and variable substitution
 *
 * @package react-frontend
 * @subpackage tests/unit/features/activities/lti
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Internal imports - Hook under test
import { useLTILaunch, LtiLaunchErrorCode, LtiLaunchError } from '@/features/activities/lti/hooks/useLTILaunch';

// Test utilities and fixtures
import {
  generateTestOAuthSignature,
  createMockLTITool,
  createMockLaunchParams,
  setupLTIHandlers,
  validateOAuthSignature,
  substituteCustomParams,
  generateNonce,
  generateTimestamp,
  createMockUser,
  createMockCourse,
  createSuccessResponse,
  createErrorResponse,
} from './testUtils';

import {
  mockLTI11Tool,
  mockLTI13Tool,
  mockLTI11LaunchParams,
  mockLTI13OIDCParams,
  mockStudent,
  mockTeacher,
  mockCourse,
  mockOAuthSignatureError,
  mockCustomParams,
} from './fixtures';

// Type imports
import { LaunchContainer } from '@/features/activities/lti/types/lti.types';

// Test helper imports
import { createTestQueryClient } from '@/tests/helpers/render';

// =============================================================================
// Test Setup and Configuration
// =============================================================================

/**
 * Creates a wrapper component with QueryClientProvider for hook testing.
 * Each test gets a fresh QueryClient to ensure isolation.
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * MSW server for mocking API endpoints during tests.
 */
const server = setupServer();

// Start MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Reset handlers and mocks after each test
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// Stop MSW server after all tests
afterAll(() => {
  server.close();
});

// =============================================================================
// OAuth 1.0 Signature Generation Tests (LTI 1.1)
// =============================================================================

describe('useLTILaunch - OAuth 1.0 Signature Generation', () => {
  /**
   * Tests for OAuth 1.0a signature generation as per RFC 5849.
   * LTI 1.1 uses OAuth 1.0a with HMAC-SHA1 for request signing.
   *
   * Based on:
   * - public/mod/lti/OAuth.php::OAuthSignatureMethod_HMAC_SHA1
   * - public/mod/lti/OAuth.php::build_signature
   */

  describe('Nonce Generation', () => {
    it('should generate a random 32-character hexadecimal nonce', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      // Verify nonce format: 32-character hex string
      expect(nonce1).toMatch(/^[a-f0-9]{32}$/);
      expect(nonce1.length).toBe(32);

      // Verify each nonce is unique
      expect(nonce1).not.toBe(nonce2);
    });

    it('should generate cryptographically random nonces', () => {
      const nonces = new Set<string>();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        nonces.add(generateNonce());
      }

      // All nonces should be unique
      expect(nonces.size).toBe(iterations);
    });
  });

  describe('Timestamp Generation', () => {
    it('should generate Unix epoch timestamp in seconds', () => {
      // Freeze time for deterministic testing
      const mockTime = 1704067200000; // 2024-01-01T00:00:00.000Z
      vi.useFakeTimers();
      vi.setSystemTime(mockTime);

      const timestamp = generateTimestamp();

      // Timestamp should be in seconds (Unix epoch)
      expect(timestamp).toBe(Math.floor(mockTime / 1000));
      expect(timestamp).toBe(1704067200);
    });

    it('should increment timestamp with real time passage', () => {
      vi.useFakeTimers();
      vi.setSystemTime(1704067200000);

      const timestamp1 = generateTimestamp();

      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);

      const timestamp2 = generateTimestamp();

      expect(timestamp2 - timestamp1).toBe(5);
    });
  });

  describe('Signature Base String Construction', () => {
    it('should construct signature base string with HTTP method, URL, and encoded parameters', () => {
      const httpMethod = 'POST';
      const url = 'https://example.com/lti/launch';
      const params = {
        oauth_consumer_key: 'key123',
        oauth_nonce: 'abc123def456',
        oauth_timestamp: '1704067200',
        oauth_signature_method: 'HMAC-SHA1',
        oauth_version: '1.0',
        lti_message_type: 'basic-lti-launch-request',
        lti_version: 'LTI-1p0',
      };

      // Generate signature using test utility
      const consumerSecret = 'secret456';
      const signature = generateTestOAuthSignature(httpMethod, url, params, consumerSecret);

      // Signature should be a non-empty base64-encoded string
      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      // Base64 encoded HMAC-SHA1 produces specific character set
      expect(signature).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('should percent-encode URL correctly per RFC 3986', () => {
      const httpMethod = 'POST';
      // URL with special characters that need encoding
      const url = 'https://example.com/lti/launch?test=value&special=hello world';
      const params = {
        oauth_consumer_key: 'key123',
        oauth_timestamp: '1704067200',
        oauth_nonce: 'testnonce123456789012345678901234',
        oauth_signature_method: 'HMAC-SHA1',
        oauth_version: '1.0',
      };

      const consumerSecret = 'secret';
      const signature = generateTestOAuthSignature(httpMethod, url, params, consumerSecret);

      // Should not throw and should produce valid signature
      expect(signature).toBeTruthy();
    });

    it('should sort parameters lexicographically by key', () => {
      const httpMethod = 'POST';
      const url = 'https://example.com/lti/launch';
      const consumerSecret = 'testsecret';

      // Parameters in random order
      const params1 = {
        zebra: 'z',
        apple: 'a',
        middle: 'm',
        oauth_consumer_key: 'key',
        oauth_timestamp: '123',
        oauth_nonce: 'nonce12345678901234567890123456',
        oauth_signature_method: 'HMAC-SHA1',
        oauth_version: '1.0',
      };

      // Same parameters in different order should produce same signature
      const params2 = {
        oauth_version: '1.0',
        middle: 'm',
        oauth_timestamp: '123',
        zebra: 'z',
        oauth_consumer_key: 'key',
        apple: 'a',
        oauth_nonce: 'nonce12345678901234567890123456',
        oauth_signature_method: 'HMAC-SHA1',
      };

      const sig1 = generateTestOAuthSignature(httpMethod, url, params1, consumerSecret);
      const sig2 = generateTestOAuthSignature(httpMethod, url, params2, consumerSecret);

      expect(sig1).toBe(sig2);
    });
  });

  describe('HMAC-SHA1 Signing', () => {
    it('should sign with consumer secret using HMAC-SHA1', () => {
      const httpMethod = 'POST';
      const url = 'https://example.com/lti/launch';
      const params = {
        oauth_consumer_key: 'mykey',
        oauth_timestamp: '1704067200',
        oauth_nonce: 'randomnonce1234567890123456789012',
        oauth_signature_method: 'HMAC-SHA1',
        oauth_version: '1.0',
      };

      const consumerSecret = 'mysecret';
      const signature = generateTestOAuthSignature(httpMethod, url, params, consumerSecret);

      // Validate the signature using the validation utility
      const isValid = validateOAuthSignature(httpMethod, url, params, consumerSecret, signature);
      expect(isValid).toBe(true);
    });

    it('should produce different signatures with different secrets', () => {
      const httpMethod = 'POST';
      const url = 'https://example.com/lti/launch';
      const params = {
        oauth_consumer_key: 'key',
        oauth_timestamp: '1704067200',
        oauth_nonce: 'nonce12345678901234567890123456',
        oauth_signature_method: 'HMAC-SHA1',
        oauth_version: '1.0',
      };

      const sig1 = generateTestOAuthSignature(httpMethod, url, params, 'secret1');
      const sig2 = generateTestOAuthSignature(httpMethod, url, params, 'secret2');

      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signatures with different nonces', () => {
      const httpMethod = 'POST';
      const url = 'https://example.com/lti/launch';
      const consumerSecret = 'secret';

      const params1 = {
        oauth_consumer_key: 'key',
        oauth_timestamp: '1704067200',
        oauth_nonce: 'nonce12345678901234567890123456',
        oauth_signature_method: 'HMAC-SHA1',
        oauth_version: '1.0',
      };

      const params2 = {
        ...params1,
        oauth_nonce: 'different789012345678901234567890',
      };

      const sig1 = generateTestOAuthSignature(httpMethod, url, params1, consumerSecret);
      const sig2 = generateTestOAuthSignature(httpMethod, url, params2, consumerSecret);

      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signatures with different timestamps', () => {
      const httpMethod = 'POST';
      const url = 'https://example.com/lti/launch';
      const consumerSecret = 'secret';

      const params1 = {
        oauth_consumer_key: 'key',
        oauth_timestamp: '1704067200',
        oauth_nonce: 'nonce12345678901234567890123456',
        oauth_signature_method: 'HMAC-SHA1',
        oauth_version: '1.0',
      };

      const params2 = {
        ...params1,
        oauth_timestamp: '1704067300',
      };

      const sig1 = generateTestOAuthSignature(httpMethod, url, params1, consumerSecret);
      const sig2 = generateTestOAuthSignature(httpMethod, url, params2, consumerSecret);

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('OAuth Parameter Assembly', () => {
    it('should include all required OAuth parameters', () => {
      const launchParams = createMockLaunchParams({
        version: 'LTI-1p0',
        oauth: true,
      });

      // Verify all required OAuth 1.0a parameters are present
      expect(launchParams.oauth_consumer_key).toBeDefined();
      expect(launchParams.oauth_signature_method).toBe('HMAC-SHA1');
      expect(launchParams.oauth_timestamp).toBeDefined();
      expect(launchParams.oauth_nonce).toBeDefined();
      expect(launchParams.oauth_version).toBe('1.0');
      expect(launchParams.oauth_signature).toBeDefined();
    });

    it('should set oauth_signature_method to HMAC-SHA1', () => {
      const launchParams = createMockLaunchParams({
        version: 'LTI-1p0',
        oauth: true,
      });

      expect(launchParams.oauth_signature_method).toBe('HMAC-SHA1');
    });

    it('should set oauth_version to 1.0', () => {
      const launchParams = createMockLaunchParams({
        version: 'LTI-1p0',
        oauth: true,
      });

      expect(launchParams.oauth_version).toBe('1.0');
    });
  });
});

// =============================================================================
// LTI 1.3 OIDC Initiation Tests
// =============================================================================

describe('useLTILaunch - LTI 1.3 OIDC Initiation', () => {
  /**
   * Tests for LTI 1.3 OpenID Connect (OIDC) login initiation flow.
   * LTI 1.3 uses OIDC for secure authentication with JWT tokens.
   *
   * Based on:
   * - public/mod/lti/launch.php (LTI 1.3 branch)
   * - IMS LTI 1.3 Specification
   */

  describe('OIDC Login Initiation Parameters', () => {
    it('should include login_hint with user ID', () => {
      const oidcParams = createMockLaunchParams({
        version: '1.3.0',
        oidc: true,
        userId: 123,
      });

      expect(oidcParams.login_hint).toBe('123');
    });

    it('should include lti_message_hint with encrypted state', () => {
      const oidcParams = createMockLaunchParams({
        version: '1.3.0',
        oidc: true,
      });

      // lti_message_hint should contain encrypted launch state
      expect(oidcParams.lti_message_hint).toBeDefined();
      expect(typeof oidcParams.lti_message_hint).toBe('string');
      expect(oidcParams.lti_message_hint.length).toBeGreaterThan(0);
    });

    it('should include iss (issuer) with platform identifier', () => {
      const oidcParams = createMockLaunchParams({
        version: '1.3.0',
        oidc: true,
        issuer: 'https://moodle.example.com',
      });

      expect(oidcParams.iss).toBe('https://moodle.example.com');
    });

    it('should include target_link_uri with tool launch URL', () => {
      const toolUrl = 'https://tool.example.com/lti/launch';
      const oidcParams = createMockLaunchParams({
        version: '1.3.0',
        oidc: true,
        targetLinkUri: toolUrl,
      });

      expect(oidcParams.target_link_uri).toBe(toolUrl);
    });

    it('should include client_id for tool identification', () => {
      const oidcParams = createMockLaunchParams({
        version: '1.3.0',
        oidc: true,
        clientId: 'tool-client-abc123',
      });

      expect(oidcParams.client_id).toBe('tool-client-abc123');
    });

    it('should include lti_deployment_id for deployment context', () => {
      const oidcParams = createMockLaunchParams({
        version: '1.3.0',
        oidc: true,
        deploymentId: 'deployment-xyz789',
      });

      expect(oidcParams.lti_deployment_id).toBe('deployment-xyz789');
    });
  });

  describe('JWT Token Generation', () => {
    it('should generate valid JWT for LTI 1.3 launch', async () => {
      const queryClient = createTestQueryClient();

      // Mock API to return LTI 1.3 launch data with JWT
      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: mockLTI13OIDCParams,
            launchContainer: LaunchContainer.WINDOW,
            version: '1.3.0',
            jwt: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL21vb2RsZS5leGFtcGxlLmNvbSJ9.signature',
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      // Trigger launch
      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI13Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify JWT is present in launch data
      expect(result.current.launchData?.jwt).toBeDefined();
      // JWT should have three parts separated by dots
      expect(result.current.launchData?.jwt?.split('.').length).toBe(3);
    });
  });
});

// =============================================================================
// Launch Parameter Construction Tests
// =============================================================================

describe('useLTILaunch - Launch Parameter Construction', () => {
  /**
   * Tests for required LTI launch parameters as defined by IMS specification.
   *
   * Based on:
   * - public/mod/lti/locallib.php::lti_build_request
   * - IMS LTI 1.0/1.1/1.3 Basic Launch Parameters
   */

  describe('Required Launch Parameters', () => {
    it('should include lti_message_type as basic-lti-launch-request', () => {
      const params = mockLTI11LaunchParams;
      expect(params.lti_message_type).toBe('basic-lti-launch-request');
    });

    it('should include lti_version for LTI 1.0/1.1', () => {
      const params = mockLTI11LaunchParams;
      expect(params.lti_version).toBe('LTI-1p0');
    });

    it('should include resource_link_id for unique link identification', () => {
      const params = mockLTI11LaunchParams;
      expect(params.resource_link_id).toBeDefined();
      expect(typeof params.resource_link_id).toBe('string');
      expect(params.resource_link_id.length).toBeGreaterThan(0);
    });

    it('should include user_id for learner/instructor identification', () => {
      const params = mockLTI11LaunchParams;
      expect(params.user_id).toBeDefined();
      expect(typeof params.user_id).toBe('string');
    });

    it('should include roles with Instructor or Learner', () => {
      // Test student role
      const studentParams = createMockLaunchParams({
        version: 'LTI-1p0',
        roles: ['Learner'],
      });
      expect(studentParams.roles).toContain('Learner');

      // Test instructor role
      const instructorParams = createMockLaunchParams({
        version: 'LTI-1p0',
        roles: ['Instructor'],
      });
      expect(instructorParams.roles).toContain('Instructor');

      // Test multiple roles
      const multiRoleParams = createMockLaunchParams({
        version: 'LTI-1p0',
        roles: ['Instructor', 'Administrator'],
      });
      expect(multiRoleParams.roles).toContain('Instructor');
      expect(multiRoleParams.roles).toContain('Administrator');
    });

    it('should include context_id for course identification', () => {
      const params = mockLTI11LaunchParams;
      expect(params.context_id).toBeDefined();
      expect(typeof params.context_id).toBe('string');
    });
  });

  describe('Optional User Parameters', () => {
    it('should include lis_person_name_given when configured', () => {
      const params = createMockLaunchParams({
        version: 'LTI-1p0',
        sendName: true,
        user: mockStudent,
      });

      expect(params.lis_person_name_given).toBe(mockStudent.firstname);
    });

    it('should include lis_person_name_family when configured', () => {
      const params = createMockLaunchParams({
        version: 'LTI-1p0',
        sendName: true,
        user: mockStudent,
      });

      expect(params.lis_person_name_family).toBe(mockStudent.lastname);
    });

    it('should include lis_person_name_full when configured', () => {
      const params = createMockLaunchParams({
        version: 'LTI-1p0',
        sendName: true,
        user: mockStudent,
      });

      expect(params.lis_person_name_full).toBe(`${mockStudent.firstname} ${mockStudent.lastname}`);
    });

    it('should include lis_person_contact_email_primary when configured', () => {
      const params = createMockLaunchParams({
        version: 'LTI-1p0',
        sendEmail: true,
        user: mockStudent,
      });

      expect(params.lis_person_contact_email_primary).toBe(mockStudent.email);
    });

    it('should not include user PII when not configured', () => {
      const params = createMockLaunchParams({
        version: 'LTI-1p0',
        sendName: false,
        sendEmail: false,
        user: mockStudent,
      });

      expect(params.lis_person_name_given).toBeUndefined();
      expect(params.lis_person_name_family).toBeUndefined();
      expect(params.lis_person_name_full).toBeUndefined();
      expect(params.lis_person_contact_email_primary).toBeUndefined();
    });
  });

  describe('Context Parameters', () => {
    it('should include context_label for course shortname', () => {
      const params = createMockLaunchParams({
        version: 'LTI-1p0',
        course: mockCourse,
      });

      expect(params.context_label).toBe(mockCourse.shortname);
    });

    it('should include context_title for course fullname', () => {
      const params = createMockLaunchParams({
        version: 'LTI-1p0',
        course: mockCourse,
      });

      expect(params.context_title).toBe(mockCourse.fullname);
    });

    it('should include context_type as CourseSection', () => {
      const params = createMockLaunchParams({
        version: 'LTI-1p0',
        course: mockCourse,
      });

      expect(params.context_type).toBe('CourseSection');
    });
  });
});

// =============================================================================
// Custom Parameter Substitution Tests
// =============================================================================

describe('useLTILaunch - Custom Parameter Substitution', () => {
  /**
   * Tests for custom parameter variable substitution.
   * Moodle supports substituting placeholders with actual values.
   *
   * Based on:
   * - public/mod/lti/locallib.php::lti_parse_custom_parameter
   * - public/mod/lti/locallib.php::lti_get_custom_parameters
   */

  const mockContext = {
    user: mockStudent,
    course: mockCourse,
    resourceLinkId: 'link-123',
    resourceLinkTitle: 'Test Assignment',
  };

  describe('User Variable Substitution', () => {
    it('should substitute $User.id with actual user ID', () => {
      const customParams = 'user_id=$User.id';
      const result = substituteCustomParams(customParams, mockContext);

      expect(result).toContain(`user_id=${mockStudent.id}`);
    });

    it('should substitute $User.username with actual username', () => {
      const customParams = 'username=$User.username';
      const result = substituteCustomParams(customParams, mockContext);

      expect(result).toContain(`username=${mockStudent.username}`);
    });

    it('should substitute $Person.name.full with full name', () => {
      const customParams = 'fullname=$Person.name.full';
      const result = substituteCustomParams(customParams, mockContext);

      expect(result).toContain(`fullname=${mockStudent.firstname} ${mockStudent.lastname}`);
    });

    it('should substitute $Person.email.primary with email', () => {
      const customParams = 'email=$Person.email.primary';
      const result = substituteCustomParams(customParams, mockContext);

      expect(result).toContain(`email=${mockStudent.email}`);
    });

    it('should substitute $Person.name.given with firstname', () => {
      const customParams = 'firstname=$Person.name.given';
      const result = substituteCustomParams(customParams, mockContext);

      expect(result).toContain(`firstname=${mockStudent.firstname}`);
    });

    it('should substitute $Person.name.family with lastname', () => {
      const customParams = 'lastname=$Person.name.family';
      const result = substituteCustomParams(customParams, mockContext);

      expect(result).toContain(`lastname=${mockStudent.lastname}`);
    });
  });

  describe('Course Variable Substitution', () => {
    it('should substitute $CourseSection.title with course fullname', () => {
      const customParams = 'course_title=$CourseSection.title';
      const result = substituteCustomParams(customParams, mockContext);

      expect(result).toContain(`course_title=${mockCourse.fullname}`);
    });

    it('should substitute $CourseSection.label with course shortname', () => {
      const customParams = 'course_code=$CourseSection.label';
      const result = substituteCustomParams(customParams, mockContext);

      expect(result).toContain(`course_code=${mockCourse.shortname}`);
    });

    it('should substitute $Context.id with course ID', () => {
      const customParams = 'context_id=$Context.id';
      const result = substituteCustomParams(customParams, mockContext);

      expect(result).toContain(`context_id=${mockCourse.id}`);
    });
  });

  describe('Resource Link Variable Substitution', () => {
    it('should substitute $ResourceLink.id with resource link ID', () => {
      const customParams = 'link_id=$ResourceLink.id';
      const result = substituteCustomParams(customParams, mockContext);

      expect(result).toContain(`link_id=${mockContext.resourceLinkId}`);
    });

    it('should substitute $ResourceLink.title with resource title', () => {
      const customParams = 'link_title=$ResourceLink.title';
      const result = substituteCustomParams(customParams, mockContext);

      expect(result).toContain(`link_title=${mockContext.resourceLinkTitle}`);
    });
  });

  describe('Multiple Variable Substitution', () => {
    it('should substitute multiple variables in single parameter string', () => {
      const customParams = 'user=$User.id&course=$Context.id&name=$Person.name.full';
      const result = substituteCustomParams(customParams, mockContext);

      expect(result).toContain(`user=${mockStudent.id}`);
      expect(result).toContain(`course=${mockCourse.id}`);
      expect(result).toContain(`name=${mockStudent.firstname} ${mockStudent.lastname}`);
    });

    it('should handle mixed variables and literal values', () => {
      const customParams = 'user_id=$User.id&api_version=v2&course=$Context.id';
      const result = substituteCustomParams(customParams, mockContext);

      expect(result).toContain(`user_id=${mockStudent.id}`);
      expect(result).toContain('api_version=v2');
      expect(result).toContain(`course=${mockCourse.id}`);
    });

    it('should leave unrecognized variables unchanged', () => {
      const customParams = 'custom=$Unknown.variable';
      const result = substituteCustomParams(customParams, mockContext);

      // Unrecognized variables should remain as-is
      expect(result).toContain('custom=$Unknown.variable');
    });
  });
});

// =============================================================================
// Launch Mutation State Management Tests
// =============================================================================

describe('useLTILaunch - Launch State Management', () => {
  /**
   * Tests for React Query mutation state management.
   * The hook uses useMutation for handling launch requests.
   */

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  describe('Idle State', () => {
    it('should initialize in idle state', () => {
      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isIdle).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.launchData).toBeUndefined();
      expect(result.current.error).toBeNull();
    });
  });

  describe('Loading State', () => {
    it('should transition to loading state when launchTool is called', async () => {
      // Mock slow API response
      server.use(
        http.post('/api/v1/lti/:id/launch', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: mockLTI11LaunchParams,
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      // Trigger launch
      act(() => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      // Should transition to loading immediately
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isIdle).toBe(false);
    });
  });

  describe('Success State', () => {
    it('should transition to success state on successful launch', async () => {
      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: mockLTI11LaunchParams,
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.launchData).toBeDefined();
      expect(result.current.launchData?.endpoint).toBe('https://tool.example.com/lti/launch');
    });

    it('should include launch parameters in success state', async () => {
      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: mockLTI11LaunchParams,
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.parameters).toBeDefined();
    });
  });

  describe('Error State', () => {
    it('should transition to error state on API failure', async () => {
      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createErrorResponse('Server Error'), { status: 500 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.error).toBeDefined();
    });

    it('should handle OAuth signature validation error', async () => {
      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(mockOAuthSignatureError, { status: 400 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Should recognize OAuth signature error
      expect(result.current.error).toBeInstanceOf(LtiLaunchError);
      expect((result.current.error as LtiLaunchError).code).toBe(LtiLaunchErrorCode.INVALID_OAUTH_SIGNATURE);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset state to idle when reset is called', async () => {
      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: mockLTI11LaunchParams,
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      // Complete a launch
      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Reset state
      act(() => {
        result.current.reset();
      });

      expect(result.current.isIdle).toBe(true);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.launchData).toBeUndefined();
    });
  });
});

// =============================================================================
// Form POST Data Construction Tests
// =============================================================================

describe('useLTILaunch - Form POST Data Construction', () => {
  /**
   * Tests for automatic form submission data construction.
   * LTI launches are typically performed via hidden form POST.
   *
   * Based on:
   * - public/mod/lti/launch.php form submission logic
   */

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  describe('Form Data Assembly', () => {
    it('should construct form data with all launch parameters', async () => {
      const mockParams = {
        ...mockLTI11LaunchParams,
        custom_param1: 'value1',
        custom_param2: 'value2',
      };

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: mockParams,
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // All parameters should be available for form construction
      const launchParams = result.current.launchData?.parameters;
      expect(launchParams).toBeDefined();
      expect(launchParams?.lti_message_type).toBe('basic-lti-launch-request');
      expect(launchParams?.custom_param1).toBe('value1');
      expect(launchParams?.custom_param2).toBe('value2');
    });

    it('should include OAuth signature in form data for LTI 1.1', async () => {
      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: mockLTI11LaunchParams,
            launchContainer: LaunchContainer.EMBED,
            version: 'LTI-1p0',
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // OAuth signature should be included for LTI 1.1
      expect(result.current.launchData?.parameters?.oauth_signature).toBeDefined();
    });

    it('should set form action to tool endpoint URL', async () => {
      const toolEndpoint = 'https://external-tool.example.com/lti/receive';

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: toolEndpoint,
            parameters: mockLTI11LaunchParams,
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.endpoint).toBe(toolEndpoint);
    });
  });

  describe('Secure Launch URL', () => {
    it('should use secure (HTTPS) URL when available', async () => {
      const secureEndpoint = 'https://tool.example.com/lti/launch';

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: secureEndpoint,
            parameters: mockLTI11LaunchParams,
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.endpoint).toMatch(/^https:\/\//);
    });
  });
});

// =============================================================================
// Grade Passback Setup Tests
// =============================================================================

describe('useLTILaunch - Grade Passback Setup', () => {
  /**
   * Tests for LTI Outcomes service (grade passback) setup.
   * Enables tools to send grades back to Moodle.
   *
   * Based on:
   * - public/mod/lti/locallib.php::lti_add_outcomes_service_support
   * - IMS LTI 1.1 Basic Outcomes Service
   */

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  describe('LIS Outcomes Service Parameters', () => {
    it('should include lis_outcome_service_url when grades are enabled', async () => {
      const outcomeServiceUrl = 'https://moodle.example.com/mod/lti/service.php';
      const paramsWithOutcomes = {
        ...mockLTI11LaunchParams,
        lis_outcome_service_url: outcomeServiceUrl,
      };

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: paramsWithOutcomes,
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.parameters?.lis_outcome_service_url).toBe(outcomeServiceUrl);
    });

    it('should include lis_result_sourcedid for grade identification', async () => {
      const sourcedid = 'a1b2c3d4e5f6g7h8i9j0';
      const paramsWithSourcedid = {
        ...mockLTI11LaunchParams,
        lis_result_sourcedid: sourcedid,
      };

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: paramsWithSourcedid,
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.parameters?.lis_result_sourcedid).toBe(sourcedid);
    });

    it('should not include outcomes parameters when grades are disabled', async () => {
      const paramsWithoutOutcomes = { ...mockLTI11LaunchParams };
      delete paramsWithoutOutcomes.lis_outcome_service_url;
      delete paramsWithoutOutcomes.lis_result_sourcedid;

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: paramsWithoutOutcomes,
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
          acceptGrades: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.parameters?.lis_outcome_service_url).toBeUndefined();
      expect(result.current.launchData?.parameters?.lis_result_sourcedid).toBeUndefined();
    });
  });

  describe('Assignment and Grade Services (AGS) for LTI 1.3', () => {
    it('should include lineitem URL for LTI 1.3 grade passback', async () => {
      const lineitemUrl = 'https://moodle.example.com/api/lti/ags/123/lineitems/456';
      const lti13ParamsWithAGS = {
        ...mockLTI13OIDCParams,
        'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint': {
          lineitem: lineitemUrl,
          scope: [
            'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
            'https://purl.imsglobal.org/spec/lti-ags/scope/score',
          ],
        },
      };

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: lti13ParamsWithAGS,
            launchContainer: LaunchContainer.WINDOW,
            version: '1.3.0',
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI13Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const agsEndpoint = result.current.launchData?.parameters?.['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'];
      expect(agsEndpoint?.lineitem).toBe(lineitemUrl);
    });
  });
});

// =============================================================================
// Content-Item Return URL Tests (Deep Linking)
// =============================================================================

describe('useLTILaunch - Content-Item Selection (Deep Linking)', () => {
  /**
   * Tests for content-item selection message (deep linking).
   * Allows tools to return content items back to Moodle.
   *
   * Based on:
   * - public/mod/lti/contentitem.php
   * - IMS Deep Linking specification
   */

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  describe('Content-Item Return Parameters', () => {
    it('should include content_item_return_url for deep linking requests', async () => {
      const returnUrl = 'https://moodle.example.com/mod/lti/contentitem_return.php';
      const deepLinkingParams = {
        ...mockLTI11LaunchParams,
        lti_message_type: 'ContentItemSelectionRequest',
        content_item_return_url: returnUrl,
      };

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/select',
            parameters: deepLinkingParams,
            launchContainer: LaunchContainer.WINDOW,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
          messageType: 'ContentItemSelectionRequest',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.parameters?.content_item_return_url).toBe(returnUrl);
    });

    it('should include accept_media_types for content selection', async () => {
      const deepLinkingParams = {
        ...mockLTI11LaunchParams,
        lti_message_type: 'ContentItemSelectionRequest',
        content_item_return_url: 'https://moodle.example.com/mod/lti/contentitem_return.php',
        accept_media_types: 'application/vnd.ims.lti.v1.ltilink,*/*',
      };

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/select',
            parameters: deepLinkingParams,
            launchContainer: LaunchContainer.WINDOW,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
          messageType: 'ContentItemSelectionRequest',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.parameters?.accept_media_types).toContain('application/vnd.ims.lti.v1.ltilink');
    });

    it('should include accept_presentation_document_targets', async () => {
      const deepLinkingParams = {
        ...mockLTI11LaunchParams,
        lti_message_type: 'ContentItemSelectionRequest',
        accept_presentation_document_targets: 'frame,iframe,window',
      };

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/select',
            parameters: deepLinkingParams,
            launchContainer: LaunchContainer.WINDOW,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
          messageType: 'ContentItemSelectionRequest',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.parameters?.accept_presentation_document_targets).toContain('frame');
    });
  });
});

// =============================================================================
// Launch Presentation Parameters Tests
// =============================================================================

describe('useLTILaunch - Launch Presentation Parameters', () => {
  /**
   * Tests for launch presentation configuration.
   * Controls how the tool is displayed and where to return after launch.
   *
   * Based on:
   * - public/mod/lti/locallib.php::lti_add_presentation_params
   */

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  describe('Document Target', () => {
    it('should set launch_presentation_document_target to iframe for EMBED container', async () => {
      const paramsWithTarget = {
        ...mockLTI11LaunchParams,
        launch_presentation_document_target: 'iframe',
      };

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: paramsWithTarget,
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
          launchContainer: LaunchContainer.EMBED,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.parameters?.launch_presentation_document_target).toBe('iframe');
    });

    it('should set launch_presentation_document_target to window for WINDOW container', async () => {
      const paramsWithTarget = {
        ...mockLTI11LaunchParams,
        launch_presentation_document_target: 'window',
      };

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: paramsWithTarget,
            launchContainer: LaunchContainer.WINDOW,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
          launchContainer: LaunchContainer.WINDOW,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.parameters?.launch_presentation_document_target).toBe('window');
    });
  });

  describe('Return URL', () => {
    it('should include launch_presentation_return_url', async () => {
      const returnUrl = 'https://moodle.example.com/mod/lti/return.php?course=5&instance=10';
      const paramsWithReturn = {
        ...mockLTI11LaunchParams,
        launch_presentation_return_url: returnUrl,
      };

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: paramsWithReturn,
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.parameters?.launch_presentation_return_url).toBe(returnUrl);
    });
  });

  describe('Locale', () => {
    it('should include launch_presentation_locale', async () => {
      const paramsWithLocale = {
        ...mockLTI11LaunchParams,
        launch_presentation_locale: 'en-US',
      };

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: paramsWithLocale,
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.parameters?.launch_presentation_locale).toBe('en-US');
    });

    it('should handle different locale formats', async () => {
      const paramsWithLocale = {
        ...mockLTI11LaunchParams,
        launch_presentation_locale: 'fr_FR',
      };

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: paramsWithLocale,
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.parameters?.launch_presentation_locale).toBe('fr_FR');
    });
  });
});

// =============================================================================
// Tool Consumer Instance Tests
// =============================================================================

describe('useLTILaunch - Tool Consumer Instance Parameters', () => {
  /**
   * Tests for tool consumer instance identification.
   * Identifies the Moodle installation to the tool.
   *
   * Based on:
   * - public/mod/lti/locallib.php::lti_add_tool_consumer_info
   */

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('should include tool_consumer_instance_guid', async () => {
    const instanceGuid = 'moodle.example.com';
    const paramsWithConsumer = {
      ...mockLTI11LaunchParams,
      tool_consumer_instance_guid: instanceGuid,
    };

    server.use(
      http.post('/api/v1/lti/:id/launch', () => {
        return HttpResponse.json(createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: paramsWithConsumer,
          launchContainer: LaunchContainer.EMBED,
        }));
      })
    );

    const { result } = renderHook(() => useLTILaunch(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool({
        toolId: mockLTI11Tool.id,
        courseId: mockCourse.id,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.launchData?.parameters?.tool_consumer_instance_guid).toBe(instanceGuid);
  });

  it('should include tool_consumer_instance_name', async () => {
    const instanceName = 'My Moodle Site';
    const paramsWithConsumer = {
      ...mockLTI11LaunchParams,
      tool_consumer_instance_name: instanceName,
    };

    server.use(
      http.post('/api/v1/lti/:id/launch', () => {
        return HttpResponse.json(createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: paramsWithConsumer,
          launchContainer: LaunchContainer.EMBED,
        }));
      })
    );

    const { result } = renderHook(() => useLTILaunch(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool({
        toolId: mockLTI11Tool.id,
        courseId: mockCourse.id,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.launchData?.parameters?.tool_consumer_instance_name).toBe(instanceName);
  });

  it('should include tool_consumer_info_product_family_code', async () => {
    const paramsWithConsumer = {
      ...mockLTI11LaunchParams,
      tool_consumer_info_product_family_code: 'moodle',
    };

    server.use(
      http.post('/api/v1/lti/:id/launch', () => {
        return HttpResponse.json(createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: paramsWithConsumer,
          launchContainer: LaunchContainer.EMBED,
        }));
      })
    );

    const { result } = renderHook(() => useLTILaunch(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool({
        toolId: mockLTI11Tool.id,
        courseId: mockCourse.id,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.launchData?.parameters?.tool_consumer_info_product_family_code).toBe('moodle');
  });

  it('should include tool_consumer_info_version', async () => {
    const paramsWithConsumer = {
      ...mockLTI11LaunchParams,
      tool_consumer_info_version: '4.4',
    };

    server.use(
      http.post('/api/v1/lti/:id/launch', () => {
        return HttpResponse.json(createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: paramsWithConsumer,
          launchContainer: LaunchContainer.EMBED,
        }));
      })
    );

    const { result } = renderHook(() => useLTILaunch(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool({
        toolId: mockLTI11Tool.id,
        courseId: mockCourse.id,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.launchData?.parameters?.tool_consumer_info_version).toBe('4.4');
  });
});

// =============================================================================
// Launch Container Tests
// =============================================================================

describe('useLTILaunch - Launch Container Handling', () => {
  /**
   * Tests for different launch container modes.
   * Controls how the tool is displayed (iframe, window, etc.).
   *
   * Based on:
   * - public/mod/lti/locallib.php LaunchContainer constants
   */

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('should return LaunchContainer.DEFAULT (1) for default mode', async () => {
    server.use(
      http.post('/api/v1/lti/:id/launch', () => {
        return HttpResponse.json(createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: mockLTI11LaunchParams,
          launchContainer: LaunchContainer.DEFAULT,
        }));
      })
    );

    const { result } = renderHook(() => useLTILaunch(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool({
        toolId: mockLTI11Tool.id,
        courseId: mockCourse.id,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.launchData?.launchContainer).toBe(LaunchContainer.DEFAULT);
  });

  it('should return LaunchContainer.EMBED (2) for iframe mode', async () => {
    server.use(
      http.post('/api/v1/lti/:id/launch', () => {
        return HttpResponse.json(createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: mockLTI11LaunchParams,
          launchContainer: LaunchContainer.EMBED,
        }));
      })
    );

    const { result } = renderHook(() => useLTILaunch(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool({
        toolId: mockLTI11Tool.id,
        courseId: mockCourse.id,
        launchContainer: LaunchContainer.EMBED,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.launchData?.launchContainer).toBe(LaunchContainer.EMBED);
  });

  it('should return LaunchContainer.EMBED_NO_BLOCKS (3) for iframe without blocks', async () => {
    server.use(
      http.post('/api/v1/lti/:id/launch', () => {
        return HttpResponse.json(createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: mockLTI11LaunchParams,
          launchContainer: LaunchContainer.EMBED_NO_BLOCKS,
        }));
      })
    );

    const { result } = renderHook(() => useLTILaunch(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool({
        toolId: mockLTI11Tool.id,
        courseId: mockCourse.id,
        launchContainer: LaunchContainer.EMBED_NO_BLOCKS,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.launchData?.launchContainer).toBe(LaunchContainer.EMBED_NO_BLOCKS);
  });

  it('should return LaunchContainer.WINDOW (4) for popup window mode', async () => {
    server.use(
      http.post('/api/v1/lti/:id/launch', () => {
        return HttpResponse.json(createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: mockLTI11LaunchParams,
          launchContainer: LaunchContainer.WINDOW,
        }));
      })
    );

    const { result } = renderHook(() => useLTILaunch(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool({
        toolId: mockLTI11Tool.id,
        courseId: mockCourse.id,
        launchContainer: LaunchContainer.WINDOW,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.launchData?.launchContainer).toBe(LaunchContainer.WINDOW);
  });

  it('should return LaunchContainer.REPLACE_MOODLE_WINDOW (5) for full window mode', async () => {
    server.use(
      http.post('/api/v1/lti/:id/launch', () => {
        return HttpResponse.json(createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: mockLTI11LaunchParams,
          launchContainer: LaunchContainer.REPLACE_MOODLE_WINDOW,
        }));
      })
    );

    const { result } = renderHook(() => useLTILaunch(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool({
        toolId: mockLTI11Tool.id,
        courseId: mockCourse.id,
        launchContainer: LaunchContainer.REPLACE_MOODLE_WINDOW,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.launchData?.launchContainer).toBe(LaunchContainer.REPLACE_MOODLE_WINDOW);
  });
});

// =============================================================================
// Error Handling Tests
// =============================================================================

describe('useLTILaunch - Error Handling', () => {
  /**
   * Tests for error scenarios during LTI launch.
   * Validates proper error handling and error code mapping.
   */

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  describe('OAuth Signature Validation Errors', () => {
    it('should handle invalid signature error with INVALID_OAUTH_SIGNATURE code', async () => {
      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'invalid_oauth_signature',
              message: 'OAuth signature validation failed',
            },
          }, { status: 400 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(LtiLaunchError);
      expect((result.current.error as LtiLaunchError).code).toBe(LtiLaunchErrorCode.INVALID_OAUTH_SIGNATURE);
    });

    it('should include original error message in error details', async () => {
      const errorMessage = 'Signature base string mismatch';

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'invalid_oauth_signature',
              message: errorMessage,
            },
          }, { status: 400 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect((result.current.error as LtiLaunchError).message).toContain(errorMessage);
    });
  });

  describe('JWT Token Errors (LTI 1.3)', () => {
    it('should handle expired JWT error', async () => {
      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'expired_jwt',
              message: 'JWT token has expired',
            },
          }, { status: 400 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI13Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect((result.current.error as LtiLaunchError).code).toBe(LtiLaunchErrorCode.EXPIRED_JWT);
    });
  });

  describe('Missing Required Parameters', () => {
    it('should handle missing tool configuration error', async () => {
      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'missing_tool_configuration',
              message: 'Tool configuration is incomplete',
            },
          }, { status: 400 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: 999,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect((result.current.error as LtiLaunchError).code).toBe(LtiLaunchErrorCode.MISSING_TOOL_CONFIGURATION);
    });
  });

  describe('Tool Configuration Errors', () => {
    it('should handle tool not found error (404)', async () => {
      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'tool_not_found',
              message: 'LTI tool not found',
            },
          }, { status: 404 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: 999,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect((result.current.error as LtiLaunchError).code).toBe(LtiLaunchErrorCode.TOOL_NOT_FOUND);
    });

    it('should handle disabled tool error', async () => {
      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'tool_disabled',
              message: 'This LTI tool has been disabled by the administrator',
            },
          }, { status: 400 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect((result.current.error as LtiLaunchError).code).toBe(LtiLaunchErrorCode.TOOL_DISABLED);
    });
  });

  describe('Permission Errors', () => {
    it('should handle permission denied error (403)', async () => {
      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'permission_denied',
              message: 'You do not have permission to launch this tool',
            },
          }, { status: 403 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect((result.current.error as LtiLaunchError).code).toBe(LtiLaunchErrorCode.PERMISSION_DENIED);
    });
  });

  describe('Network and Server Errors', () => {
    it('should handle server error (500)', async () => {
      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'server_error',
              message: 'Internal server error',
            },
          }, { status: 500 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect((result.current.error as LtiLaunchError).code).toBe(LtiLaunchErrorCode.SERVER_ERROR);
    });

    it('should handle network failure', async () => {
      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Error Recovery', () => {
    it('should allow retry after error', async () => {
      let attemptCount = 0;

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          attemptCount++;
          if (attemptCount === 1) {
            return HttpResponse.json({
              success: false,
              error: { code: 'server_error', message: 'Temporary failure' },
            }, { status: 500 });
          }
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: mockLTI11LaunchParams,
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      // First attempt fails
      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Reset and retry
      act(() => {
        result.current.reset();
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(attemptCount).toBe(2);
    });
  });
});

// =============================================================================
// Debug Mode Tests
// =============================================================================

describe('useLTILaunch - Debug Mode', () => {
  /**
   * Tests for debug mode functionality.
   * When enabled, logs launch parameters and signatures for troubleshooting.
   *
   * Based on:
   * - public/mod/lti/locallib.php debug launch configuration
   */

  let queryClient: QueryClient;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should include debug information when debug mode is enabled', async () => {
    const debugParams = {
      ...mockLTI11LaunchParams,
      __debug__: true,
    };

    server.use(
      http.post('/api/v1/lti/:id/launch', () => {
        return HttpResponse.json(createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: debugParams,
          launchContainer: LaunchContainer.EMBED,
          debug: {
            signatureBaseString: 'POST&https%3A%2F%2Ftool.example.com%2Flti%2Flaunch&oauth_consumer_key%3Dkey...',
            timestamp: 1704067200,
            nonce: 'abc123def456',
          },
        }));
      })
    );

    const { result } = renderHook(() => useLTILaunch(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool({
        toolId: mockLTI11Tool.id,
        courseId: mockCourse.id,
        debug: true,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Debug info should be available in launch data
    expect(result.current.launchData?.debug).toBeDefined();
    expect(result.current.launchData?.debug?.signatureBaseString).toBeDefined();
  });

  it('should not include debug information when debug mode is disabled', async () => {
    server.use(
      http.post('/api/v1/lti/:id/launch', () => {
        return HttpResponse.json(createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: mockLTI11LaunchParams,
          launchContainer: LaunchContainer.EMBED,
        }));
      })
    );

    const { result } = renderHook(() => useLTILaunch(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool({
        toolId: mockLTI11Tool.id,
        courseId: mockCourse.id,
        debug: false,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Debug info should not be present
    expect(result.current.launchData?.debug).toBeUndefined();
  });
});

// =============================================================================
// Integration Tests - End-to-End Launch Flows
// =============================================================================

describe('useLTILaunch - Integration Tests', () => {
  /**
   * End-to-end tests for complete LTI launch workflows.
   * Tests realistic usage scenarios combining multiple features.
   */

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  describe('Complete LTI 1.1 Launch Flow', () => {
    it('should complete full LTI 1.1 launch with OAuth signature', async () => {
      const toolEndpoint = 'https://external-lti-tool.com/launch';

      server.use(
        http.post('/api/v1/lti/:id/launch', ({ params }) => {
          const toolId = params.id;
          expect(toolId).toBe(String(mockLTI11Tool.id));

          return HttpResponse.json(createSuccessResponse({
            endpoint: toolEndpoint,
            parameters: {
              ...mockLTI11LaunchParams,
              oauth_consumer_key: 'key123',
              oauth_signature_method: 'HMAC-SHA1',
              oauth_version: '1.0',
              oauth_signature: 'base64EncodedSignature==',
              lti_message_type: 'basic-lti-launch-request',
              lti_version: 'LTI-1p0',
            },
            launchContainer: LaunchContainer.EMBED,
            version: 'LTI-1p0',
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      // Verify initial state
      expect(result.current.isIdle).toBe(true);

      // Initiate launch
      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
          launchContainer: LaunchContainer.EMBED,
        });
      });

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify launch data
      expect(result.current.launchData).toBeDefined();
      expect(result.current.launchData?.endpoint).toBe(toolEndpoint);
      expect(result.current.launchData?.parameters?.lti_version).toBe('LTI-1p0');
      expect(result.current.launchData?.parameters?.oauth_signature).toBeDefined();
      expect(result.current.launchData?.launchContainer).toBe(LaunchContainer.EMBED);
    });
  });

  describe('Complete LTI 1.3 Launch Flow', () => {
    it('should complete full LTI 1.3 launch with OIDC initiation', async () => {
      const oidcLoginUrl = 'https://external-lti-tool.com/oidc/login';

      server.use(
        http.post('/api/v1/lti/:id/launch', ({ params }) => {
          const toolId = params.id;
          expect(toolId).toBe(String(mockLTI13Tool.id));

          return HttpResponse.json(createSuccessResponse({
            endpoint: oidcLoginUrl,
            parameters: {
              iss: 'https://moodle.example.com',
              target_link_uri: 'https://external-lti-tool.com/lti/launch',
              login_hint: '123',
              lti_message_hint: 'encrypted-state-data',
              client_id: 'tool-client-id',
              lti_deployment_id: 'deployment-1',
            },
            launchContainer: LaunchContainer.WINDOW,
            version: '1.3.0',
            jwt: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      // Initiate launch
      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI13Tool.id,
          courseId: mockCourse.id,
          launchContainer: LaunchContainer.WINDOW,
        });
      });

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify LTI 1.3 specific data
      expect(result.current.launchData).toBeDefined();
      expect(result.current.launchData?.endpoint).toBe(oidcLoginUrl);
      expect(result.current.launchData?.parameters?.iss).toBeDefined();
      expect(result.current.launchData?.parameters?.login_hint).toBeDefined();
      expect(result.current.launchData?.parameters?.client_id).toBeDefined();
      expect(result.current.launchData?.jwt).toBeDefined();
      expect(result.current.launchData?.launchContainer).toBe(LaunchContainer.WINDOW);
    });
  });

  describe('Launch with Grade Passback', () => {
    it('should include grade passback parameters for graded tool', async () => {
      const outcomeServiceUrl = 'https://moodle.example.com/mod/lti/service.php';
      const sourcedid = 'result-sourcedid-abc123';

      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: {
              ...mockLTI11LaunchParams,
              lis_outcome_service_url: outcomeServiceUrl,
              lis_result_sourcedid: sourcedid,
            },
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
          acceptGrades: true,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.parameters?.lis_outcome_service_url).toBe(outcomeServiceUrl);
      expect(result.current.launchData?.parameters?.lis_result_sourcedid).toBe(sourcedid);
    });
  });

  describe('Launch with Custom Parameters', () => {
    it('should include substituted custom parameters in launch', async () => {
      server.use(
        http.post('/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: {
              ...mockLTI11LaunchParams,
              custom_user_id: String(mockStudent.id),
              custom_course_id: String(mockCourse.id),
              custom_user_fullname: `${mockStudent.firstname} ${mockStudent.lastname}`,
            },
            launchContainer: LaunchContainer.EMBED,
          }));
        })
      );

      const { result } = renderHook(() => useLTILaunch(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool({
          toolId: mockLTI11Tool.id,
          courseId: mockCourse.id,
          customParams: 'user_id=$User.id&course_id=$Context.id&user_fullname=$Person.name.full',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Custom parameters should be present with substituted values
      expect(result.current.launchData?.parameters?.custom_user_id).toBeDefined();
      expect(result.current.launchData?.parameters?.custom_course_id).toBeDefined();
    });
  });
});
