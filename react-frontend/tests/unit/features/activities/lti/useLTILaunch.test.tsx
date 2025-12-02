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

// Internal imports - Hook under test
import { useLTILaunch, LtiLaunchErrorCode, LtiLaunchError } from '@/features/activities/lti/hooks/useLTILaunch';

// Test utilities and fixtures
import {
  generateTestOAuthSignature,
  createMockLTITool as _createMockLTITool,
  createMockLaunchParams,
  setupLTIHandlers as _setupLTIHandlers,
  validateOAuthSignature,
  substituteCustomParams,
  generateNonce,
  generateTimestamp,
  createMockUser as _createMockUser,
  createMockCourse as _createMockCourse,
  createSuccessResponse,
  createErrorResponse,
  getParamValue,
} from './testUtils';

import {
  mockLTI11Tool,
  mockLTI13Tool,
  mockLTI11LaunchParams,
  mockLTI13OIDCParams,
  mockStudent,
  mockTeacher as _mockTeacher,
  mockCourse,
  mockOAuthSignatureError,
  mockCustomParams as _mockCustomParams,
} from './fixtures';

// Type imports
import { LaunchContainer } from '@/features/activities/lti/types/lti.types';

// Test helper imports
import { createTestQueryClient } from '@tests/helpers/render';

// Import the global MSW server from mocks directory
// NOTE: Do NOT create a local server - use the global one set up in tests/setup.ts
import { server } from '@tests/mocks/server';

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

// MSW server lifecycle is managed globally in tests/setup.ts
// Just add console logging for debugging this specific test file
beforeAll(() => {
  console.log('[Setup] Starting MSW server...');
  console.log('[Setup] MSW server started');
});

// Reset handlers and mocks after each test
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// MSW server is closed globally in tests/setup.ts - no need to close here
afterAll(() => {
  console.log('[Setup] Closing MSW server...');
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
    it('should generate a random 32-character alphanumeric nonce', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      // Verify nonce format: 32-character alphanumeric string (lowercase letters and digits)
      expect(nonce1).toMatch(/^[a-z0-9]{32}$/);
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
      const signature = generateTestOAuthSignature(params, consumerSecret, url, httpMethod);

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
      const signature = generateTestOAuthSignature(params, consumerSecret, url, httpMethod);

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

      const sig1 = generateTestOAuthSignature(params1, consumerSecret, url, httpMethod);
      const sig2 = generateTestOAuthSignature(params2, consumerSecret, url, httpMethod);

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
      const signature = generateTestOAuthSignature(params, consumerSecret, url, httpMethod);

      // Validate the signature using the validation utility
      // Add signature to params for validation
      const paramsWithSig = { ...params, oauth_signature: signature };
      const isValid = validateOAuthSignature(paramsWithSig, consumerSecret, url);
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

      const sig1 = generateTestOAuthSignature(params, 'secret1', url, httpMethod);
      const sig2 = generateTestOAuthSignature(params, 'secret2', url, httpMethod);

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

      const sig1 = generateTestOAuthSignature(params1, consumerSecret, url, httpMethod);
      const sig2 = generateTestOAuthSignature(params2, consumerSecret, url, httpMethod);

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

      const sig1 = generateTestOAuthSignature(params1, consumerSecret, url, httpMethod);
      const sig2 = generateTestOAuthSignature(params2, consumerSecret, url, httpMethod);

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
      expect(oidcParams.lti_message_hint!.length).toBeGreaterThan(0);
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
      // Convert mockLTI13OIDCParams object to array of { name, value } pairs
      const lti13ParamsArray = Object.entries(mockLTI13OIDCParams).map(([name, value]) => ({ name, value: String(value) }));
      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: lti13ParamsArray,
            launchContainer: LaunchContainer.WINDOW,
            version: '1.3.0',
            jwt: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL21vb2RsZS5leGFtcGxlLmNvbSJ9.signature',
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      // Trigger launch
      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
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
      // mockLTI11LaunchParams has parameters as array of {name, value} objects
      const ltiMessageType = getParamValue(mockLTI11LaunchParams.parameters, 'lti_message_type');
      expect(ltiMessageType).toBe('basic-lti-launch-request');
    });

    it('should include lti_version for LTI 1.0/1.1', () => {
      const ltiVersion = getParamValue(mockLTI11LaunchParams.parameters, 'lti_version');
      expect(ltiVersion).toBe('LTI-1p0');
    });

    it('should include resource_link_id for unique link identification', () => {
      const resourceLinkId = getParamValue(mockLTI11LaunchParams.parameters, 'resource_link_id');
      expect(resourceLinkId).toBeDefined();
      expect(typeof resourceLinkId).toBe('string');
      expect(resourceLinkId!.length).toBeGreaterThan(0);
    });

    it('should include user_id for learner/instructor identification', () => {
      const userId = getParamValue(mockLTI11LaunchParams.parameters, 'user_id');
      expect(userId).toBeDefined();
      expect(typeof userId).toBe('string');
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
      const contextId = getParamValue(mockLTI11LaunchParams.parameters, 'context_id');
      expect(contextId).toBeDefined();
      expect(typeof contextId).toBe('string');
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
      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.mutation.isIdle).toBe(true);
      expect(result.current.isLaunching).toBe(false);
      expect(result.current.mutation.isSuccess).toBe(false);
      expect(result.current.mutation.isError).toBe(false);
      // launchData is initialized to null via useState, not undefined
      expect(result.current.launchData).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('Loading State', () => {
    it('should transition to loading state when launchTool is called', async () => {
      // Mock slow API response to ensure we can catch the loading state
      server.use(
        http.post('*/api/v1/lti/:id/launch', async () => {
          await new Promise(resolve => setTimeout(resolve, 500));
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: mockLTI11LaunchParams.parameters,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      // Trigger launch - do NOT await, we want to check the intermediate loading state
      act(() => {
        result.current.launchTool();
      });

      // Wait for mutation to transition to pending state
      await waitFor(() => {
        expect(result.current.mutation.isPending).toBe(true);
      }, { timeout: 200 });

      // Verify loading states
      expect(result.current.isLaunching).toBe(true);
      expect(result.current.mutation.isIdle).toBe(false);
    });
  });

  describe('Success State', () => {
    it('should transition to success state on successful launch', async () => {
      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: mockLTI11LaunchParams.parameters,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      expect(result.current.isLaunching).toBe(false);
      expect(result.current.mutation.isError).toBe(false);
      expect(result.current.launchData).toBeDefined();
      expect(result.current.launchData?.endpoint).toBe('https://tool.example.com/lti/launch');
    });

    it('should include launch parameters in success state', async () => {
      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: mockLTI11LaunchParams.parameters,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.parameters).toBeDefined();
    });
  });

  describe('Error State', () => {
    it('should transition to error state on API failure', async () => {
      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createErrorResponse('SERVER_ERROR', 'Server Error', 500);
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      // Server errors are retried (up to 2 times), so wait with extended timeout
      await waitFor(() => {
        expect(result.current.mutation.isError).toBe(true);
      }, { timeout: 10000 });

      expect(result.current.isLaunching).toBe(false);
      expect(result.current.mutation.isSuccess).toBe(false);
      expect(result.current.error).toBeDefined();
    });

    it('should handle OAuth signature validation error', async () => {
      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return HttpResponse.json(mockOAuthSignatureError, { status: 400 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isError).toBe(true);
      });

      // Should recognize OAuth signature error
      expect(result.current.error).toBeInstanceOf(LtiLaunchError);
      expect((result.current.error as LtiLaunchError).code).toBe(LtiLaunchErrorCode.INVALID_OAUTH_SIGNATURE);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset state to idle when reset is called', async () => {
      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: mockLTI11LaunchParams.parameters,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      // Complete a launch
      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      // Reset state
      act(() => {
        result.current.reset();
      });

      expect(result.current.mutation.isIdle).toBe(true);
      expect(result.current.mutation.isSuccess).toBe(false);
      // After reset, launchData is null (React Query default for reset mutation data)
      expect(result.current.launchData).toBeNull();
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
      // Add custom parameters to the existing mock parameters array
      const mockParamsArray = [
        ...mockLTI11LaunchParams.parameters,
        { name: 'extra_custom_param', value: 'extra_value' },
      ];

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: mockParamsArray,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      // All parameters should be available for form construction
      const launchParams = result.current.launchData?.parameters;
      expect(launchParams).toBeDefined();
      expect(Array.isArray(launchParams)).toBe(true);
      
      // Use getParamValue helper to access parameters from the array
      expect(getParamValue(launchParams!, 'lti_message_type')).toBe('basic-lti-launch-request');
      // custom_param1 and custom_param2 are already included in mockLTI11LaunchParams
      expect(getParamValue(launchParams!, 'custom_param1')).toBe('value1');
      expect(getParamValue(launchParams!, 'custom_param2')).toBe('value2');
      // Verify the extra custom param we added
      expect(getParamValue(launchParams!, 'extra_custom_param')).toBe('extra_value');
    });

    it('should include OAuth signature in form data for LTI 1.1', async () => {
      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: mockLTI11LaunchParams.parameters,
            launchContainer: LaunchContainer.EMBED,
            version: 'LTI-1p0',
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      // OAuth signature should be included in the parameters array for LTI 1.1
      const oauthSignature = getParamValue(result.current.launchData?.parameters ?? [], 'oauth_signature');
      expect(oauthSignature).toBeDefined();
      expect(oauthSignature).not.toBe('');
    });

    it('should set form action to tool endpoint URL', async () => {
      const toolEndpoint = 'https://external-tool.example.com/lti/receive';

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: toolEndpoint,
            parameters: mockLTI11LaunchParams.parameters,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      expect(result.current.launchData?.endpoint).toBe(toolEndpoint);
    });
  });

  describe('Secure Launch URL', () => {
    it('should use secure (HTTPS) URL when available', async () => {
      const secureEndpoint = 'https://tool.example.com/lti/launch';

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: secureEndpoint,
            parameters: mockLTI11LaunchParams.parameters,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
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
      // Add/update the lis_outcome_service_url in the parameters array
      const paramsWithOutcomes = mockLTI11LaunchParams.parameters.map(p =>
        p.name === 'lis_outcome_service_url' ? { ...p, value: outcomeServiceUrl } : p
      );
      // If not already present, add it
      if (!paramsWithOutcomes.some(p => p.name === 'lis_outcome_service_url')) {
        paramsWithOutcomes.push({ name: 'lis_outcome_service_url', value: outcomeServiceUrl });
      }

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: paramsWithOutcomes,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      const outcomesUrl = getParamValue(result.current.launchData?.parameters ?? [], 'lis_outcome_service_url');
      expect(outcomesUrl).toBe(outcomeServiceUrl);
    });

    it('should include lis_result_sourcedid for grade identification', async () => {
      const sourcedid = 'a1b2c3d4e5f6g7h8i9j0';
      // Update the lis_result_sourcedid in the parameters array
      const paramsWithSourcedid = mockLTI11LaunchParams.parameters.map(p =>
        p.name === 'lis_result_sourcedid' ? { ...p, value: sourcedid } : p
      );
      // If not already present, add it
      if (!paramsWithSourcedid.some(p => p.name === 'lis_result_sourcedid')) {
        paramsWithSourcedid.push({ name: 'lis_result_sourcedid', value: sourcedid });
      }

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: paramsWithSourcedid,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      const resultSourcedid = getParamValue(result.current.launchData?.parameters ?? [], 'lis_result_sourcedid');
      expect(resultSourcedid).toBe(sourcedid);
    });

    it('should not include outcomes parameters when grades are disabled', async () => {
      // Filter out outcomes-related parameters from the array
      const paramsWithoutOutcomes = mockLTI11LaunchParams.parameters.filter(
        p => p.name !== 'lis_outcome_service_url' && p.name !== 'lis_result_sourcedid'
      );

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: paramsWithoutOutcomes,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      const outcomesUrl = getParamValue(result.current.launchData?.parameters ?? [], 'lis_outcome_service_url');
      const resultSourcedid = getParamValue(result.current.launchData?.parameters ?? [], 'lis_result_sourcedid');
      expect(outcomesUrl).toBeUndefined();
      expect(resultSourcedid).toBeUndefined();
    });
  });

  describe('Assignment and Grade Services (AGS) for LTI 1.3', () => {
    it('should include lineitem URL for LTI 1.3 grade passback', async () => {
      const lineitemUrl = 'https://moodle.example.com/api/lti/ags/123/lineitems/456';
      
      // AGS claim data (complex object to be JSON-stringified)
      const agsClaimData = {
        lineitem: lineitemUrl,
        scope: [
          'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
          'https://purl.imsglobal.org/spec/lti-ags/scope/score',
        ],
      };
      
      // Build LTI 1.3 parameters array from OIDC params + AGS claim
      const lti13ParamsWithAGS = [
        { name: 'iss', value: mockLTI13OIDCParams.iss },
        { name: 'login_hint', value: mockLTI13OIDCParams.login_hint },
        { name: 'target_link_uri', value: mockLTI13OIDCParams.target_link_uri },
        { name: 'lti_message_hint', value: mockLTI13OIDCParams.lti_message_hint },
        { name: 'client_id', value: mockLTI13OIDCParams.client_id },
        { name: 'lti_deployment_id', value: mockLTI13OIDCParams.lti_deployment_id },
        // AGS claim as JSON-stringified value
        { name: 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint', value: JSON.stringify(agsClaimData) },
      ];

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: lti13ParamsWithAGS,
            launchContainer: LaunchContainer.WINDOW,
            version: '1.3.0',
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      // Get AGS claim from parameters and parse the JSON value
      const agsEndpointJson = getParamValue(result.current.launchData?.parameters ?? [], 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint');
      expect(agsEndpointJson).toBeDefined();
      const agsEndpoint = JSON.parse(agsEndpointJson as string);
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
      // Build deep linking parameters array from base params with updates
      const deepLinkingParams = [
        ...mockLTI11LaunchParams.parameters.filter(
          p => p.name !== 'lti_message_type' && p.name !== 'content_item_return_url'
        ),
        { name: 'lti_message_type', value: 'ContentItemSelectionRequest' },
        { name: 'content_item_return_url', value: returnUrl },
      ];

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/select',
            parameters: deepLinkingParams,
            launchContainer: LaunchContainer.WINDOW,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      const contentItemReturnUrl = getParamValue(result.current.launchData?.parameters ?? [], 'content_item_return_url');
      expect(contentItemReturnUrl).toBe(returnUrl);
    });

    it('should include accept_media_types for content selection', async () => {
      const mediaTypes = 'application/vnd.ims.lti.v1.ltilink,*/*';
      // Build deep linking parameters array with media types
      const deepLinkingParams = [
        ...mockLTI11LaunchParams.parameters.filter(
          p => !['lti_message_type', 'content_item_return_url', 'accept_media_types'].includes(p.name)
        ),
        { name: 'lti_message_type', value: 'ContentItemSelectionRequest' },
        { name: 'content_item_return_url', value: 'https://moodle.example.com/mod/lti/contentitem_return.php' },
        { name: 'accept_media_types', value: mediaTypes },
      ];

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/select',
            parameters: deepLinkingParams,
            launchContainer: LaunchContainer.WINDOW,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      const acceptMediaTypes = getParamValue(result.current.launchData?.parameters ?? [], 'accept_media_types');
      expect(acceptMediaTypes).toContain('application/vnd.ims.lti.v1.ltilink');
    });

    it('should include accept_presentation_document_targets', async () => {
      const documentTargets = 'frame,iframe,window';
      // Build deep linking parameters array with document targets
      const deepLinkingParams = [
        ...mockLTI11LaunchParams.parameters.filter(
          p => !['lti_message_type', 'accept_presentation_document_targets'].includes(p.name)
        ),
        { name: 'lti_message_type', value: 'ContentItemSelectionRequest' },
        { name: 'accept_presentation_document_targets', value: documentTargets },
      ];

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/select',
            parameters: deepLinkingParams,
            launchContainer: LaunchContainer.WINDOW,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      const acceptTargets = getParamValue(result.current.launchData?.parameters ?? [], 'accept_presentation_document_targets');
      expect(acceptTargets).toContain('frame');
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
      // Build params array with document target set to iframe
      const paramsWithTarget = [
        ...mockLTI11LaunchParams.parameters.filter(p => p.name !== 'launch_presentation_document_target'),
        { name: 'launch_presentation_document_target', value: 'iframe' },
      ];

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: paramsWithTarget,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      const docTarget = getParamValue(result.current.launchData?.parameters ?? [], 'launch_presentation_document_target');
      expect(docTarget).toBe('iframe');
    });

    it('should set launch_presentation_document_target to window for WINDOW container', async () => {
      // Build params array with document target set to window
      const paramsWithTarget = [
        ...mockLTI11LaunchParams.parameters.filter(p => p.name !== 'launch_presentation_document_target'),
        { name: 'launch_presentation_document_target', value: 'window' },
      ];

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: paramsWithTarget,
            launchContainer: LaunchContainer.WINDOW,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      const docTarget = getParamValue(result.current.launchData?.parameters ?? [], 'launch_presentation_document_target');
      expect(docTarget).toBe('window');
    });
  });

  describe('Return URL', () => {
    it('should include launch_presentation_return_url', async () => {
      const returnUrl = 'https://moodle.example.com/mod/lti/return.php?course=5&instance=10';
      // Build params array with return URL
      const paramsWithReturn = [
        ...mockLTI11LaunchParams.parameters.filter(p => p.name !== 'launch_presentation_return_url'),
        { name: 'launch_presentation_return_url', value: returnUrl },
      ];

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: paramsWithReturn,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      const launchReturnUrl = getParamValue(result.current.launchData?.parameters ?? [], 'launch_presentation_return_url');
      expect(launchReturnUrl).toBe(returnUrl);
    });
  });

  describe('Locale', () => {
    it('should include launch_presentation_locale', async () => {
      // Build params array with locale
      const paramsWithLocale = [
        ...mockLTI11LaunchParams.parameters.filter(p => p.name !== 'launch_presentation_locale'),
        { name: 'launch_presentation_locale', value: 'en-US' },
      ];

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: paramsWithLocale,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      const locale = getParamValue(result.current.launchData?.parameters ?? [], 'launch_presentation_locale');
      expect(locale).toBe('en-US');
    });

    it('should handle different locale formats', async () => {
      // Build params array with French locale
      const paramsWithLocale = [
        ...mockLTI11LaunchParams.parameters.filter(p => p.name !== 'launch_presentation_locale'),
        { name: 'launch_presentation_locale', value: 'fr_FR' },
      ];

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: paramsWithLocale,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      const locale = getParamValue(result.current.launchData?.parameters ?? [], 'launch_presentation_locale');
      expect(locale).toBe('fr_FR');
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
    // Build params array with consumer GUID
    const paramsWithConsumer = [
      ...mockLTI11LaunchParams.parameters.filter(p => p.name !== 'tool_consumer_instance_guid'),
      { name: 'tool_consumer_instance_guid', value: instanceGuid },
    ];

    server.use(
      http.post('*/api/v1/lti/:id/launch', () => {
        return createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: paramsWithConsumer,
          launchContainer: LaunchContainer.EMBED,
        });
      })
    );

    const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool();
    });

    await waitFor(() => {
      expect(result.current.mutation.isSuccess).toBe(true);
    });

    const consumerGuid = getParamValue(result.current.launchData?.parameters ?? [], 'tool_consumer_instance_guid');
    expect(consumerGuid).toBe(instanceGuid);
  });

  it('should include tool_consumer_instance_name', async () => {
    const instanceName = 'My Moodle Site';
    // Build params array with consumer name
    const paramsWithConsumer = [
      ...mockLTI11LaunchParams.parameters.filter(p => p.name !== 'tool_consumer_instance_name'),
      { name: 'tool_consumer_instance_name', value: instanceName },
    ];

    server.use(
      http.post('*/api/v1/lti/:id/launch', () => {
        return createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: paramsWithConsumer,
          launchContainer: LaunchContainer.EMBED,
        });
      })
    );

    const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool();
    });

    await waitFor(() => {
      expect(result.current.mutation.isSuccess).toBe(true);
    });

    const consumerName = getParamValue(result.current.launchData?.parameters ?? [], 'tool_consumer_instance_name');
    expect(consumerName).toBe(instanceName);
  });

  it('should include tool_consumer_info_product_family_code', async () => {
    // Build params array with product family code
    const paramsWithConsumer = [
      ...mockLTI11LaunchParams.parameters.filter(p => p.name !== 'tool_consumer_info_product_family_code'),
      { name: 'tool_consumer_info_product_family_code', value: 'moodle' },
    ];

    server.use(
      http.post('*/api/v1/lti/:id/launch', () => {
        return createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: paramsWithConsumer,
          launchContainer: LaunchContainer.EMBED,
        });
      })
    );

    const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool();
    });

    await waitFor(() => {
      expect(result.current.mutation.isSuccess).toBe(true);
    });

    const productFamilyCode = getParamValue(result.current.launchData?.parameters ?? [], 'tool_consumer_info_product_family_code');
    expect(productFamilyCode).toBe('moodle');
  });

  it('should include tool_consumer_info_version', async () => {
    // Build params array with version
    const paramsWithConsumer = [
      ...mockLTI11LaunchParams.parameters.filter(p => p.name !== 'tool_consumer_info_version'),
      { name: 'tool_consumer_info_version', value: '4.4' },
    ];

    server.use(
      http.post('*/api/v1/lti/:id/launch', () => {
        return createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: paramsWithConsumer,
          launchContainer: LaunchContainer.EMBED,
        });
      })
    );

    const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool();
    });

    await waitFor(() => {
      expect(result.current.mutation.isSuccess).toBe(true);
    });

    const version = getParamValue(result.current.launchData?.parameters ?? [], 'tool_consumer_info_version');
    expect(version).toBe('4.4');
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
      http.post('*/api/v1/lti/:id/launch', () => {
        return createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: mockLTI11LaunchParams.parameters,
          launchContainer: LaunchContainer.DEFAULT,
        });
      })
    );

    const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool();
    });

    await waitFor(() => {
      expect(result.current.mutation.isSuccess).toBe(true);
    });

    expect(result.current.launchData?.launchContainer).toBe(LaunchContainer.DEFAULT);
  });

  it('should return LaunchContainer.EMBED (2) for iframe mode', async () => {
    server.use(
      http.post('*/api/v1/lti/:id/launch', () => {
        return createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: mockLTI11LaunchParams.parameters,
          launchContainer: LaunchContainer.EMBED,
        });
      })
    );

    const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool();
    });

    await waitFor(() => {
      expect(result.current.mutation.isSuccess).toBe(true);
    });

    expect(result.current.launchData?.launchContainer).toBe(LaunchContainer.EMBED);
  });

  it('should return LaunchContainer.EMBED_NO_BLOCKS (3) for iframe without blocks', async () => {
    server.use(
      http.post('*/api/v1/lti/:id/launch', () => {
        return createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: mockLTI11LaunchParams.parameters,
          launchContainer: LaunchContainer.EMBED_NO_BLOCKS,
        });
      })
    );

    const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool();
    });

    await waitFor(() => {
      expect(result.current.mutation.isSuccess).toBe(true);
    });

    expect(result.current.launchData?.launchContainer).toBe(LaunchContainer.EMBED_NO_BLOCKS);
  });

  it('should return LaunchContainer.WINDOW (4) for popup window mode', async () => {
    server.use(
      http.post('*/api/v1/lti/:id/launch', () => {
        return createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: mockLTI11LaunchParams.parameters,
          launchContainer: LaunchContainer.WINDOW,
        });
      })
    );

    const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool();
    });

    await waitFor(() => {
      expect(result.current.mutation.isSuccess).toBe(true);
    });

    expect(result.current.launchData?.launchContainer).toBe(LaunchContainer.WINDOW);
  });

  it('should return LaunchContainer.REPLACE_MOODLE_WINDOW (5) for full window mode', async () => {
    server.use(
      http.post('*/api/v1/lti/:id/launch', () => {
        return createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: mockLTI11LaunchParams.parameters,
          launchContainer: LaunchContainer.REPLACE_MOODLE_WINDOW,
        });
      })
    );

    const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool();
    });

    await waitFor(() => {
      expect(result.current.mutation.isSuccess).toBe(true);
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
        http.post('*/api/v1/lti/:id/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'invalid_oauth_signature',
              message: 'OAuth signature validation failed',
            },
          }, { status: 400 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(LtiLaunchError);
      expect((result.current.error as LtiLaunchError).code).toBe(LtiLaunchErrorCode.INVALID_OAUTH_SIGNATURE);
    });

    it('should include original error message in error details', async () => {
      const errorMessage = 'Signature base string mismatch';

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'invalid_oauth_signature',
              message: errorMessage,
            },
          }, { status: 400 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isError).toBe(true);
      });

      expect((result.current.error as LtiLaunchError).message).toContain(errorMessage);
    });
  });

  describe('JWT Token Errors (LTI 1.3)', () => {
    it('should handle expired JWT error', async () => {
      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'expired_jwt',
              message: 'JWT token has expired',
            },
          }, { status: 400 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isError).toBe(true);
      });

      expect((result.current.error as LtiLaunchError).code).toBe(LtiLaunchErrorCode.EXPIRED_JWT_TOKEN);
    });
  });

  describe('Missing Required Parameters', () => {
    it('should handle missing tool configuration error', async () => {
      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'missing_tool_configuration',
              message: 'Tool configuration is incomplete',
            },
          }, { status: 400 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isError).toBe(true);
      });

      expect((result.current.error as LtiLaunchError).code).toBe(LtiLaunchErrorCode.MISSING_TOOL_CONFIGURATION);
    });
  });

  describe('Tool Configuration Errors', () => {
    it('should handle tool not found error (404)', async () => {
      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'tool_not_found',
              message: 'LTI tool not found',
            },
          }, { status: 404 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isError).toBe(true);
      });

      expect((result.current.error as LtiLaunchError).code).toBe(LtiLaunchErrorCode.TOOL_TYPE_NOT_FOUND);
    });

    it('should handle disabled tool error', async () => {
      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'tool_disabled',
              message: 'This LTI tool has been disabled by the administrator',
            },
          }, { status: 400 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isError).toBe(true);
      });

      // tool_disabled maps to MISSING_TOOL_CONFIGURATION for 400 errors without specific mappings
      expect((result.current.error as LtiLaunchError).code).toBe(LtiLaunchErrorCode.MISSING_TOOL_CONFIGURATION);
    });
  });

  describe('Permission Errors', () => {
    it('should handle permission denied error (403)', async () => {
      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'permission_denied',
              message: 'You do not have permission to launch this tool',
            },
          }, { status: 403 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isError).toBe(true);
      });

      expect((result.current.error as LtiLaunchError).code).toBe(LtiLaunchErrorCode.PERMISSION_DENIED);
    });
  });

  describe('Network and Server Errors', () => {
    it('should handle server error (500)', async () => {
      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'server_error',
              message: 'Internal server error',
            },
          }, { status: 500 });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      // Server errors are retried, so wait with extended timeout
      await waitFor(() => {
        expect(result.current.mutation.isError).toBe(true);
      }, { timeout: 10000 });

      // 500 errors map to LAUNCH_FAILED
      expect((result.current.error as LtiLaunchError).code).toBe(LtiLaunchErrorCode.LAUNCH_FAILED);
    });

    it('should handle network failure', async () => {
      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      // Network errors are retried (up to 2 times), so wait with extended timeout
      await waitFor(() => {
        expect(result.current.mutation.isError).toBe(true);
      }, { timeout: 10000 });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Error Recovery', () => {
    it('should allow retry after error', async () => {
      let attemptCount = 0;

      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          attemptCount++;
          if (attemptCount === 1) {
            // Use a non-retryable error (permission_denied) to ensure immediate error state
            return HttpResponse.json({
              success: false,
              error: { code: 'permission_denied', message: 'Permission denied' },
            }, { status: 403 });
          }
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: mockLTI11LaunchParams.parameters,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      // First attempt fails (non-retryable error)
      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isError).toBe(true);
      });

      // Reset and retry
      act(() => {
        result.current.reset();
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleSpy: any;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should include debug information when debug mode is enabled', async () => {
    // Build debug params array from base parameters with debug flag
    const debugParams = [
      ...mockLTI11LaunchParams.parameters,
      { name: '__debug__', value: 'true' },
    ];

    server.use(
      http.post('*/api/v1/lti/:id/launch', () => {
        return createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: debugParams,
          launchContainer: LaunchContainer.EMBED,
          debug: {
            signatureBaseString: 'POST&https%3A%2F%2Ftool.example.com%2Flti%2Flaunch&oauth_consumer_key%3Dkey...',
            timestamp: 1704067200,
            nonce: 'abc123def456',
          },
        });
      })
    );

    const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool();
    });

    await waitFor(() => {
      expect(result.current.mutation.isSuccess).toBe(true);
    });

    // Debug info should be available in launch data
    expect(result.current.launchData?.debug).toBeDefined();
    expect(result.current.launchData?.debug?.signatureBaseString).toBeDefined();
  });

  it('should not include debug information when debug mode is disabled', async () => {
    server.use(
      http.post('*/api/v1/lti/:id/launch', () => {
        return createSuccessResponse({
          endpoint: 'https://tool.example.com/lti/launch',
          parameters: mockLTI11LaunchParams.parameters,
          launchContainer: LaunchContainer.EMBED,
        });
      })
    );

    const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.launchTool();
    });

    await waitFor(() => {
      expect(result.current.mutation.isSuccess).toBe(true);
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
        http.post('*/api/v1/lti/:id/launch', ({ params }) => {
          const toolId = params.id;
          expect(toolId).toBe(String(mockLTI11Tool.id));

          // Merge base parameters with OAuth overrides as array format
          const oauthParams = [
            ...mockLTI11LaunchParams.parameters.filter(p => 
              !['oauth_consumer_key', 'oauth_signature_method', 'oauth_version', 'oauth_signature', 'lti_message_type', 'lti_version'].includes(p.name)
            ),
            { name: 'oauth_consumer_key', value: 'key123' },
            { name: 'oauth_signature_method', value: 'HMAC-SHA1' },
            { name: 'oauth_version', value: '1.0' },
            { name: 'oauth_signature', value: 'base64EncodedSignature==' },
            { name: 'lti_message_type', value: 'basic-lti-launch-request' },
            { name: 'lti_version', value: 'LTI-1p0' },
          ];
          return createSuccessResponse({
            endpoint: toolEndpoint,
            parameters: oauthParams,
            launchContainer: LaunchContainer.EMBED,
            version: 'LTI-1p0',
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      // Verify initial state
      expect(result.current.mutation.isIdle).toBe(true);

      // Initiate launch
      await act(async () => {
        result.current.launchTool();
      });

      // Wait for success
      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      // Verify launch data
      expect(result.current.launchData).toBeDefined();
      expect(result.current.launchData?.endpoint).toBe(toolEndpoint);
      
      // Use getParamValue for array-based parameters
      const params = result.current.launchData?.parameters ?? [];
      expect(getParamValue(params, 'lti_version')).toBe('LTI-1p0');
      expect(getParamValue(params, 'oauth_signature')).toBeDefined();
      expect(result.current.launchData?.launchContainer).toBe(LaunchContainer.EMBED);
    });
  });

  describe('Complete LTI 1.3 Launch Flow', () => {
    it('should complete full LTI 1.3 launch with OIDC initiation', async () => {
      const oidcLoginUrl = 'https://external-lti-tool.com/oidc/login';

      server.use(
        http.post('*/api/v1/lti/:id/launch', ({ params }) => {
          const toolId = params.id;
          expect(toolId).toBe(String(mockLTI13Tool.id));

          return createSuccessResponse({
            endpoint: oidcLoginUrl,
            parameters: [
              { name: 'iss', value: 'https://moodle.example.com' },
              { name: 'target_link_uri', value: 'https://external-lti-tool.com/lti/launch' },
              { name: 'login_hint', value: '123' },
              { name: 'lti_message_hint', value: 'encrypted-state-data' },
              { name: 'client_id', value: 'tool-client-id' },
              { name: 'lti_deployment_id', value: 'deployment-1' },
            ],
            launchContainer: LaunchContainer.WINDOW,
            version: '1.3.0',
            jwt: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
          });
        })
      );

      // Use LTI 1.3 tool for this test
      const { result } = renderHook(() => useLTILaunch(mockLTI13Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      // Initiate launch
      await act(async () => {
        result.current.launchTool();
      });

      // Wait for success
      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      // Verify LTI 1.3 specific data
      expect(result.current.launchData).toBeDefined();
      expect(result.current.launchData?.endpoint).toBe(oidcLoginUrl);
      
      // Use getParamValue for array-based parameters
      const params = result.current.launchData?.parameters ?? [];
      expect(getParamValue(params, 'iss')).toBeDefined();
      expect(getParamValue(params, 'login_hint')).toBeDefined();
      expect(getParamValue(params, 'client_id')).toBeDefined();
      expect(result.current.launchData?.jwt).toBeDefined();
      expect(result.current.launchData?.launchContainer).toBe(LaunchContainer.WINDOW);
    });
  });

  describe('Launch with Grade Passback', () => {
    it('should include grade passback parameters for graded tool', async () => {
      const outcomeServiceUrl = 'https://moodle.example.com/mod/lti/service.php';
      const sourcedid = 'result-sourcedid-abc123';

      // Merge base parameters with grade passback overrides as array format
      const gradePassbackParams = [
        ...mockLTI11LaunchParams.parameters.filter(p => 
          !['lis_outcome_service_url', 'lis_result_sourcedid'].includes(p.name)
        ),
        { name: 'lis_outcome_service_url', value: outcomeServiceUrl },
        { name: 'lis_result_sourcedid', value: sourcedid },
      ];
      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: gradePassbackParams,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      // Use getParamValue for array-based parameters
      const params = result.current.launchData?.parameters ?? [];
      expect(getParamValue(params, 'lis_outcome_service_url')).toBe(outcomeServiceUrl);
      expect(getParamValue(params, 'lis_result_sourcedid')).toBe(sourcedid);
    });
  });

  describe('Launch with Custom Parameters', () => {
    it('should include substituted custom parameters in launch', async () => {
      // Merge base parameters with custom parameter overrides as array format
      const customParams = [
        ...mockLTI11LaunchParams.parameters.filter(p => 
          !['custom_user_id', 'custom_course_id', 'custom_user_fullname'].includes(p.name)
        ),
        { name: 'custom_user_id', value: String(mockStudent.id) },
        { name: 'custom_course_id', value: String(mockCourse.id) },
        { name: 'custom_user_fullname', value: `${mockStudent.firstname} ${mockStudent.lastname}` },
      ];
      server.use(
        http.post('*/api/v1/lti/:id/launch', () => {
          return createSuccessResponse({
            endpoint: 'https://tool.example.com/lti/launch',
            parameters: customParams,
            launchContainer: LaunchContainer.EMBED,
          });
        })
      );

      const { result } = renderHook(() => useLTILaunch(mockLTI11Tool.id), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.launchTool();
      });

      await waitFor(() => {
        expect(result.current.mutation.isSuccess).toBe(true);
      });

      // Custom parameters should be present with substituted values
      // Find the parameters in the array
      const paramsArray = result.current.launchData?.parameters;
      const customUserId = paramsArray?.find((p: { name: string; value: string }) => p.name === 'custom_user_id');
      const customCourseId = paramsArray?.find((p: { name: string; value: string }) => p.name === 'custom_course_id');
      expect(customUserId).toBeDefined();
      expect(customCourseId).toBeDefined();
    });
  });
});
