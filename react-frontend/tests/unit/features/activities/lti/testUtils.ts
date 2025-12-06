/**
 * Test Utility Functions for LTI Unit Tests
 * 
 * Provides comprehensive test utilities for LTI (Learning Tools Interoperability) testing:
 * - Mock data factories for tools, launch parameters, grades, users, and courses
 * - Custom render function with all required providers (QueryClient, Redux, Router, Theme)
 * - OAuth signature validation helpers that mimic PHP OAuth 1.0 signing
 * - LTI parameter helpers for substitution, normalization, and form building
 * - MSW request handlers for API endpoint mocking
 * - Test setup/teardown utilities for consistent test isolation
 * - Custom assertion helpers for LTI-specific validations
 * 
 * These utilities reduce test boilerplate, ensure consistent test patterns, and enable
 * comprehensive testing of LTI tool launches, grade passback, OAuth signatures, and
 * custom parameter substitution.
 * 
 * @see Section 0.4 Transformation Mapping - Test utilities for activity modules
 * @see public/mod/lti/lib.php - LTI module implementation reference
 */

import type { ReactElement } from 'react';
import { HttpResponse, http } from 'msw';
import { expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createHmac } from 'crypto';

// Internal imports
import type { RenderOptions } from '../../../../helpers/render';
import { render as baseRenderWithProviders } from '../../../../helpers/render';
import { createMockCourse as baseMockCourse } from '../../../../helpers/mockData';
import { LtiVersion } from '@/features/activities/lti/types/lti.types';
import type { LtiTool } from '@/features/activities/lti/types/lti.types';
import type { User } from '@/features/auth/types/auth.types';
import type { Course } from '@/types/entities';

// Additional type definitions for LTI test utilities
export interface LtiLaunchParams {
  oauth_consumer_key?: string;
  oauth_signature_method?: string;
  oauth_timestamp?: string;
  oauth_nonce?: string;
  oauth_version?: string;
  oauth_signature?: string;
  oauth_callback?: string;
  resource_link_id?: string;
  resource_link_title?: string;
  resource_link_description?: string;
  user_id?: string;
  roles?: string;
  context_id?: string;
  context_type?: string;
  context_label?: string;
  context_title?: string;
  lis_person_name_given?: string;
  lis_person_name_family?: string;
  lis_person_name_full?: string;
  lis_person_contact_email_primary?: string;
  launch_presentation_locale?: string;
  launch_presentation_document_target?: string;
  launch_presentation_width?: string;
  launch_presentation_height?: string;
  launch_presentation_return_url?: string;
  tool_consumer_instance_guid?: string;
  tool_consumer_instance_name?: string;
  tool_consumer_instance_description?: string;
  tool_consumer_info_product_family_code?: string;
  tool_consumer_info_version?: string;
  lti_version?: string;
  lti_message_type?: string;
  lis_outcome_service_url?: string;
  lis_result_sourcedid?: string;
  // LTI 1.3 OIDC params
  login_hint?: string;
  lti_message_hint?: string;
  iss?: string;
  target_link_uri?: string;
  client_id?: string;
  lti_deployment_id?: string;
  [key: string]: string | undefined;
}

/**
 * Configuration options for factory-style launch parameter generation.
 * Provides a more ergonomic API for test authors to specify launch scenarios.
 */
export interface LaunchParamsConfig {
  /** LTI version string (e.g., 'LTI-1p0', '1.3.0') */
  version?: string;
  /** Whether to include OAuth 1.0 parameters */
  oauth?: boolean;
  /** Whether to include OIDC parameters (LTI 1.3) */
  oidc?: boolean;
  /** User ID (will be converted to string for user_id param) */
  userId?: number | string;
  /** User roles as an array (will be joined into comma-separated string) */
  roles?: string[];
  /** Platform issuer URL for OIDC */
  issuer?: string;
  /** Target link URI for OIDC */
  targetLinkUri?: string;
  /** Client ID for OIDC */
  clientId?: string;
  /** Deployment ID for LTI 1.3 */
  deploymentId?: string;
  /** Course/context ID */
  courseId?: number | string;
  /** Course title */
  courseTitle?: string;
  /** Course label/shortname */
  courseLabel?: string;
  /** Resource link ID */
  resourceLinkId?: string;
  /** Consumer key for OAuth */
  consumerKey?: string;
  /** Consumer secret for OAuth signature generation */
  consumerSecret?: string;
  /** Launch URL for OAuth signature generation */
  launchUrl?: string;
  /** User object for populating PII fields */
  user?: Partial<User>;
  /** Course object for populating context fields */
  course?: Partial<Course>;
  /** Whether to include user's name in launch params */
  sendName?: boolean;
  /** Whether to include user's email in launch params */
  sendEmail?: boolean;
}

/**
 * Type guard to check if input is a configuration object vs raw params.
 */
function isLaunchParamsConfig(input: unknown): input is LaunchParamsConfig {
  if (!input || typeof input !== 'object') {return false;}
  const obj = input as Record<string, unknown>;
  // Check for config-specific properties that don't exist on LtiLaunchParams
  return (
    'version' in obj ||
    'oauth' in obj ||
    'oidc' in obj ||
    'userId' in obj ||
    ('roles' in obj && Array.isArray(obj.roles)) ||
    'issuer' in obj ||
    'targetLinkUri' in obj ||
    'clientId' in obj ||
    'deploymentId' in obj ||
    'courseId' in obj ||
    'user' in obj ||
    'course' in obj ||
    'sendName' in obj ||
    'sendEmail' in obj
  );
}

export interface LtiGradeData {
  id?: number;
  ltiid: number;
  userid: number;
  gradepercent: number;
  dategraded?: number;
  datesubmitted: number;
  dateupdated?: number;
  originalgrade: number;
  launchid?: number;
  state?: number;
}

export interface LtiCustomParam {
  name: string;
  value: string;
}

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Generates a random mock ID for test entities.
 * 
 * @returns {number} Random integer between 1 and 1,000,000
 */
function generateMockId(): number {
  return Math.floor(Math.random() * 1000000) + 1;
}

/**
 * Generates a mock timestamp relative to the current time.
 * 
 * @param {number} daysOffset - Days offset from now (negative for past, positive for future)
 * @returns {number} Unix timestamp in seconds
 */
function generateMockDate(daysOffset: number = 0): number {
  const now = Date.now();
  const offsetMs = daysOffset * 24 * 60 * 60 * 1000;
  return Math.floor((now + offsetMs) / 1000);
}

/**
 * Creates a mock LTI tool configuration with realistic default values.
 * Generates a complete LTI tool object with all required properties for testing
 * tool launches, grade passback, and configuration management.
 * 
 * @param {Partial<LtiTool>} overrides - Properties to override in the default tool
 * @returns {LtiTool} Complete LTI tool configuration
 * 
 * @example
 * ```typescript
 * const tool = createMockLTITool();
 * const customTool = createMockLTITool({ 
 *   name: 'Custom Tool', 
 *   launchurl: 'https://example.com/lti/launch' 
 * });
 * ```
 */
export function createMockLTITool(overrides: Partial<LtiTool> = {}): LtiTool {
  const id = overrides.id ?? generateMockId();
  const course = overrides.course ?? generateMockId();

  return {
    id,
    course,
    name: overrides.name ?? `Test LTI Tool ${id}`,
    intro: overrides.intro ?? 'This is a test LTI tool for automated testing purposes.',
    introformat: overrides.introformat ?? 1,
    timecreated: overrides.timecreated ?? generateMockDate(-30),
    timemodified: overrides.timemodified ?? generateMockDate(-1),
    typeid: overrides.typeid ?? undefined,
    toolurl: overrides.toolurl ?? 'https://example.com/lti/launch',
    securetoolurl: overrides.securetoolurl ?? '',
    instructorchoicesendname: overrides.instructorchoicesendname ?? 1,
    instructorchoicesendemailaddr: overrides.instructorchoicesendemailaddr ?? 1,
    instructorchoiceallowroster: overrides.instructorchoiceallowroster ?? 0,
    instructorchoiceallowsetting: overrides.instructorchoiceallowsetting ?? 0,
    instructorcustomparameters: overrides.instructorcustomparameters ?? '',
    instructorchoiceacceptgrades: overrides.instructorchoiceacceptgrades ?? 1,
    grade: overrides.grade ?? 100,
    launchcontainer: overrides.launchcontainer ?? 1,
    resourcekey: overrides.resourcekey ?? '',
    password: overrides.password ?? '',
    debuglaunch: overrides.debuglaunch ?? 0,
    showtitlelaunch: overrides.showtitlelaunch ?? 1,
    showdescriptionlaunch: overrides.showdescriptionlaunch ?? 1,
    servicesalt: overrides.servicesalt ?? `salt_${id}_${Date.now()}`,
    icon: overrides.icon ?? '',
    secureicon: overrides.secureicon ?? '',
  };
}

/**
 * Creates mock LTI launch parameters for OAuth 1.0 or OIDC launches.
 * Supports two calling patterns:
 * 1. Direct overrides: `createMockLaunchParams({ lti_version: 'LTI-1p0' })`
 * 2. Config object: `createMockLaunchParams({ version: 'LTI-1p0', oauth: true })`
 * 
 * @param {Partial<LtiLaunchParams> | LaunchParamsConfig} input - Overrides or config
 * @returns {LtiLaunchParams} Complete launch parameter object
 * 
 * @example
 * ```typescript
 * // Direct override pattern
 * const oauthParams = createMockLaunchParams({ lti_version: LtiVersion.LTI_1P0 });
 * 
 * // Config pattern (more ergonomic)
 * const oidcParams = createMockLaunchParams({ version: '1.3.0', oidc: true, userId: 123 });
 * ```
 */
export function createMockLaunchParams(
  input: LaunchParamsConfig | Partial<LtiLaunchParams> = {}
): LtiLaunchParams {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = generateNonce();

  // Determine if input is config object or direct overrides
  if (isLaunchParamsConfig(input)) {
    return createMockLaunchParamsFromConfig(input, timestamp, nonce);
  }

  // Direct override pattern - input is Partial<LtiLaunchParams>
  const overrides = input;

  return {
    lti_message_type: overrides.lti_message_type ?? 'basic-lti-launch-request',
    lti_version: overrides.lti_version ?? LtiVersion.LTI_1P0,
    resource_link_id: overrides.resource_link_id ?? `${generateMockId()}`,
    resource_link_title: overrides.resource_link_title ?? 'Test Resource',
    resource_link_description: overrides.resource_link_description ?? 'Test LTI resource',
    user_id: overrides.user_id ?? `${generateMockId()}`,
    roles: overrides.roles ?? 'Learner',
    lis_person_name_given: overrides.lis_person_name_given ?? 'Test',
    lis_person_name_family: overrides.lis_person_name_family ?? 'Student',
    lis_person_name_full: overrides.lis_person_name_full ?? 'Test Student',
    lis_person_contact_email_primary: overrides.lis_person_contact_email_primary ?? 'test@example.com',
    context_id: overrides.context_id ?? `${generateMockId()}`,
    context_type: overrides.context_type ?? 'CourseSection',
    context_title: overrides.context_title ?? 'Test Course',
    context_label: overrides.context_label ?? 'TEST101',
    launch_presentation_locale: overrides.launch_presentation_locale ?? 'en',
    launch_presentation_document_target: overrides.launch_presentation_document_target ?? 'iframe',
    launch_presentation_width: overrides.launch_presentation_width ?? '100%',
    launch_presentation_height: overrides.launch_presentation_height ?? '600',
    launch_presentation_return_url: overrides.launch_presentation_return_url ?? 'https://moodle.example.com/mod/lti/return.php',
    tool_consumer_instance_guid: overrides.tool_consumer_instance_guid ?? 'example.moodle.com',
    tool_consumer_instance_name: overrides.tool_consumer_instance_name ?? 'Example Moodle',
    tool_consumer_instance_description: overrides.tool_consumer_instance_description ?? 'Example Moodle Site',
    tool_consumer_info_product_family_code: overrides.tool_consumer_info_product_family_code ?? 'moodle',
    tool_consumer_info_version: overrides.tool_consumer_info_version ?? '4.4',
    oauth_version: overrides.oauth_version ?? '1.0',
    oauth_nonce: overrides.oauth_nonce ?? nonce,
    oauth_timestamp: overrides.oauth_timestamp ?? `${timestamp}`,
    oauth_consumer_key: overrides.oauth_consumer_key ?? 'test_consumer_key',
    oauth_signature_method: overrides.oauth_signature_method ?? 'HMAC-SHA1',
    oauth_signature: overrides.oauth_signature ?? '',
    oauth_callback: overrides.oauth_callback ?? 'about:blank',
    lis_outcome_service_url: overrides.lis_outcome_service_url,
    lis_result_sourcedid: overrides.lis_result_sourcedid,
    // OIDC params
    login_hint: overrides.login_hint,
    lti_message_hint: overrides.lti_message_hint,
    iss: overrides.iss,
    target_link_uri: overrides.target_link_uri,
    client_id: overrides.client_id,
    lti_deployment_id: overrides.lti_deployment_id,
  };
}

/**
 * Internal helper to create launch params from a configuration object.
 * This pattern is more ergonomic for test authors.
 */
function createMockLaunchParamsFromConfig(
  config: LaunchParamsConfig,
  timestamp: number,
  nonce: string
): LtiLaunchParams {
  const isOidc = config.oidc || config.version === '1.3.0' || config.version === LtiVersion.LTI_1P3;
  const ltiVersion = config.version ?? (isOidc ? LtiVersion.LTI_1P3 : LtiVersion.LTI_1P0);
  const consumerSecret = config.consumerSecret ?? 'test_consumer_secret';
  const launchUrl = config.launchUrl ?? 'https://example.com/lti/launch';

  // Extract user info from config.user if provided
  const user = config.user;
  const course = config.course;

  // Build base params
  const params: LtiLaunchParams = {
    lti_message_type: 'basic-lti-launch-request',
    lti_version: ltiVersion,
    resource_link_id: config.resourceLinkId ?? `${generateMockId()}`,
    resource_link_title: 'Test Resource',
    resource_link_description: 'Test LTI resource',
    user_id: config.userId !== undefined ? String(config.userId) : (user?.id !== undefined ? String(user.id) : `${generateMockId()}`),
    roles: config.roles ? config.roles.join(',') : 'Learner',
    // Only include PII if sendName is true
    ...(config.sendName && user ? {
      lis_person_name_given: user.firstname,
      lis_person_name_family: user.lastname,
      lis_person_name_full: `${user.firstname} ${user.lastname}`,
    } : (config.sendName !== false ? {
      lis_person_name_given: 'Test',
      lis_person_name_family: 'Student',
      lis_person_name_full: 'Test Student',
    } : {})),
    // Only include email if sendEmail is true
    ...(config.sendEmail && user ? {
      lis_person_contact_email_primary: user.email,
    } : (config.sendEmail !== false ? {
      lis_person_contact_email_primary: 'test@example.com',
    } : {})),
    context_id: config.courseId !== undefined ? String(config.courseId) : (course?.id !== undefined ? String(course.id) : `${generateMockId()}`),
    context_type: 'CourseSection',
    context_title: config.courseTitle ?? (course?.fullname ?? 'Test Course'),
    context_label: config.courseLabel ?? (course?.shortname ?? 'TEST101'),
    launch_presentation_locale: 'en',
    launch_presentation_document_target: 'iframe',
    launch_presentation_width: '100%',
    launch_presentation_height: '600',
    launch_presentation_return_url: 'https://moodle.example.com/mod/lti/return.php',
    tool_consumer_instance_guid: 'example.moodle.com',
    tool_consumer_instance_name: 'Example Moodle',
    tool_consumer_instance_description: 'Example Moodle Site',
    tool_consumer_info_product_family_code: 'moodle',
    tool_consumer_info_version: '4.4',
  };

  // Add OAuth 1.0 params if requested or if LTI 1.0/1.1
  if (config.oauth || (!isOidc && config.oauth !== false)) {
    params.oauth_version = '1.0';
    params.oauth_nonce = nonce;
    params.oauth_timestamp = `${timestamp}`;
    params.oauth_consumer_key = config.consumerKey ?? 'test_consumer_key';
    params.oauth_signature_method = 'HMAC-SHA1';
    params.oauth_callback = 'about:blank';

    // Generate OAuth signature
    const signature = generateTestOAuthSignature(params, consumerSecret, launchUrl);
    params.oauth_signature = signature;
  }

  // Add OIDC params if requested or if LTI 1.3
  if (isOidc || config.oidc) {
    params.login_hint = config.userId !== undefined ? String(config.userId) : `${generateMockId()}`;
    params.lti_message_hint = `encrypted_state_${generateNonce().substring(0, 16)}`;
    params.iss = config.issuer ?? 'https://moodle.example.com';
    params.target_link_uri = config.targetLinkUri ?? 'https://tool.example.com/lti/launch';
    params.client_id = config.clientId ?? 'tool_client_id';
    params.lti_deployment_id = config.deploymentId ?? `deployment_${generateMockId()}`;
  }

  return params;
}

/**
 * Creates mock grade data for LTI grade passback testing.
 * Generates complete grade object with score, result data, and submission timestamps.
 * 
 * @param {Partial<LtiGradeData>} overrides - Properties to override
 * @returns {LtiGradeData} Complete grade data object
 * 
 * @example
 * ```typescript
 * const grade = createMockGradeData({ gradepercent: 85 });
 * const failingGrade = createMockGradeData({ gradepercent: 45 });
 * ```
 */
export function createMockGradeData(overrides: Partial<LtiGradeData> = {}): LtiGradeData {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: overrides.id ?? generateMockId(),
    ltiid: overrides.ltiid ?? generateMockId(),
    userid: overrides.userid ?? generateMockId(),
    gradepercent: overrides.gradepercent ?? 0.75,
    dategraded: overrides.dategraded ?? now,
    datesubmitted: overrides.datesubmitted ?? now - 3600,
    dateupdated: overrides.dateupdated ?? now,
    originalgrade: overrides.originalgrade ?? 75,
    launchid: overrides.launchid ?? generateMockId(),
    state: overrides.state ?? 0,
  };
}

/**
 * Creates a mock user with LTI-specific roles and capabilities.
 * 
 * @param {Partial<User>} overrides - Properties to override
 * @returns {User} User entity with LTI-compatible configuration
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  const id = overrides.id ?? generateMockId();

  return {
    id,
    username: overrides.username ?? `user${id}`,
    firstname: overrides.firstname ?? 'Test',
    lastname: overrides.lastname ?? 'User',
    fullname: overrides.fullname ?? 'Test User',
    email: overrides.email ?? `user${id}@example.com`,
    auth: overrides.auth ?? 'manual',
    confirmed: overrides.confirmed ?? true,
    suspended: overrides.suspended ?? false,
    roles: overrides.roles ?? [],
    capabilities: overrides.capabilities ?? [],
    profileimageurl: overrides.profileimageurl ?? '',
    profileimageurlsmall: overrides.profileimageurlsmall ?? '',
  };
}

/**
 * Re-export createMockCourse from mockData helpers for convenience.
 * 
 * @param {Partial<Course>} overrides - Properties to override
 * @returns {Course} Complete course entity
 */
export function createMockCourse(overrides: Partial<Course> = {}): Course {
  return baseMockCourse(overrides);
}

// ============================================================================
// Custom Render Function with Providers
// ============================================================================

/**
 * Custom render function wrapping React Testing Library render with all providers.
 * Provides QueryClient, Redux store, React Router, and MUI Theme for comprehensive testing.
 * 
 * @param {ReactElement} ui - React component to render
 * @param {RenderOptions} options - Render configuration options
 * @returns {ReturnType<typeof baseRenderWithProviders>} Enhanced render result with utilities
 * 
 * @example
 * ```typescript
 * const { getByRole, store } = renderWithProviders(<LTIView toolId={1} />);
 * expect(getByRole('button', { name: /launch/i })).toBeInTheDocument();
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions = {}
): ReturnType<typeof baseRenderWithProviders> {
  return baseRenderWithProviders(ui, options);
}

// ============================================================================
// OAuth Signature Validation Helpers
// ============================================================================

/**
 * Generates a test OAuth 1.0 signature mimicking PHP OAuth signing process.
 * Implements the OAuth 1.0 signature base string generation and HMAC-SHA1 signing
 * to match Moodle's LTI OAuth implementation.
 * 
 * @param {LtiLaunchParams} params - Launch parameters to sign
 * @param {string} secret - OAuth consumer secret
 * @param {string} url - Launch URL
 * @param {string} method - HTTP method (default: 'POST')
 * @returns {string} Base64-encoded OAuth signature
 * 
 * @example
 * ```typescript
 * const params = createMockLaunchParams();
 * const signature = generateTestOAuthSignature(params, 'secret123', 'https://tool.com/launch');
 * params.oauth_signature = signature;
 * ```
 */
export function generateTestOAuthSignature(
  params: LtiLaunchParams,
  secret: string,
  url: string,
  method: string = 'POST'
): string {
  // Extract OAuth parameters (exclude oauth_signature)
  const oauthParams: Record<string, string> = {};
  Object.keys(params).forEach(key => {
    if (key !== 'oauth_signature') {
      const value = params[key as keyof LtiLaunchParams];
      if (value !== undefined && value !== null) {
        oauthParams[key] = String(value);
      }
    }
  });

  // Sort parameters alphabetically
  const sortedKeys = Object.keys(oauthParams).sort();
  
  // Build parameter string
  const paramString = sortedKeys
    .map(key => {
      const value = oauthParams[key];
      return `${encodeURIComponent(key)}=${encodeURIComponent(value ?? '')}`;
    })
    .join('&');

  // Build signature base string
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(paramString),
  ].join('&');

  // Generate signature using HMAC-SHA1
  const signingKey = `${encodeURIComponent(secret)}&`;
  const hmac = createHmac('sha1', signingKey);
  hmac.update(signatureBaseString);
  
  return hmac.digest('base64');
}

/**
 * Validates that an OAuth signature is correctly formatted and matches expected signature.
 * Used in tests to verify OAuth signature generation and validation logic.
 * 
 * @param {LtiLaunchParams} params - Launch parameters with signature
 * @param {string} secret - OAuth consumer secret
 * @param {string} url - Launch URL
 * @returns {boolean} True if signature is valid
 * 
 * @example
 * ```typescript
 * const isValid = validateOAuthSignature(launchParams, 'secret123', toolUrl);
 * expect(isValid).toBe(true);
 * ```
 */
export function validateOAuthSignature(
  params: LtiLaunchParams,
  secret: string,
  url: string
): boolean {
  if (!params.oauth_signature) {
    return false;
  }

  const expectedSignature = generateTestOAuthSignature(params, secret, url);
  return params.oauth_signature === expectedSignature;
}

/**
 * Generates a unique nonce for OAuth requests.
 * Creates a random alphanumeric string suitable for OAuth nonce parameter.
 * 
 * @returns {string} Random nonce string (32 characters)
 * 
 * @example
 * ```typescript
 * const nonce = generateNonce(); // e.g., "a7f3d9e2b8c4f1a6d5e9f3b7c2a8d4e1"
 * ```
 */
export function generateNonce(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

/**
 * Generates a current timestamp for OAuth requests.
 * Returns Unix timestamp in seconds as required by OAuth 1.0 specification.
 * 
 * @returns {number} Current Unix timestamp in seconds
 * 
 * @example
 * ```typescript
 * const timestamp = generateTimestamp(); // e.g., 1704067200
 * ```
 */
export function generateTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

// ============================================================================
// LTI Parameter Helpers
// ============================================================================

/**
 * Context object for custom parameter substitution.
 * Provides all the context needed for variable substitution in LTI custom parameters.
 */
export interface SubstitutionContext {
  user: Partial<User>;
  course: Partial<Course>;
  resourceLinkId?: string;
  resourceLinkTitle?: string;
}

/**
 * Substitutes custom parameter variables with actual values.
 * Implements LTI variable substitution for custom parameters like $User.id, $CourseSection.title.
 * 
 * This function supports two call signatures:
 * 1. Context-based (preferred): substituteCustomParams(paramValue, context)
 * 2. Legacy 3-arg: substituteCustomParams(paramValue, user, course)
 * 
 * @param {string} paramValue - Parameter value with variables (e.g., "$User.id")
 * @param {SubstitutionContext | Partial<User>} contextOrUser - Either a context object or user
 * @param {Partial<Course>} [course] - Course context (only for legacy 3-arg signature)
 * @returns {string} Substituted parameter value
 * 
 * @example
 * ```typescript
 * // Context-based signature (preferred)
 * const result = substituteCustomParams('$User.id', { user: mockUser, course: mockCourse });
 * 
 * // Legacy 3-arg signature
 * const result = substituteCustomParams('$User.id', mockUser, mockCourse);
 * ```
 */
export function substituteCustomParams(
  paramValue: string,
  contextOrUser: SubstitutionContext | Partial<User>,
  course?: Partial<Course>
): string {
  // Determine if we're using context-based or legacy signature
  let user: Partial<User>;
  let courseData: Partial<Course>;
  let resourceLinkId: string | undefined;
  let resourceLinkTitle: string | undefined;

  if ('user' in contextOrUser && 'course' in contextOrUser) {
    // Context-based signature
    const context = contextOrUser;
    user = context.user;
    courseData = context.course;
    resourceLinkId = context.resourceLinkId;
    resourceLinkTitle = context.resourceLinkTitle;
  } else {
    // Legacy 3-arg signature
    user = contextOrUser;
    courseData = course ?? {};
  }

  let result = paramValue;

  // User substitutions
  if (user.id !== undefined) {
    result = result.replace(/\$User\.id/g, String(user.id));
  }
  if (user.username) {
    result = result.replace(/\$User\.username/g, user.username);
  }
  if (user.firstname) {
    result = result.replace(/\$Person\.name\.given/g, user.firstname);
  }
  if (user.lastname) {
    result = result.replace(/\$Person\.name\.family/g, user.lastname);
  }
  // Full name - construct from first + last if not available
  const fullname = (user as { fullname?: string }).fullname ?? 
                   (user.firstname && user.lastname ? `${user.firstname} ${user.lastname}` : '');
  if (fullname) {
    result = result.replace(/\$Person\.name\.full/g, fullname);
  }
  if (user.email) {
    result = result.replace(/\$Person\.email\.primary/g, user.email);
  }

  // Course substitutions
  if (courseData.id !== undefined) {
    result = result.replace(/\$CourseSection\.sourcedId/g, String(courseData.id));
    result = result.replace(/\$Context\.id/g, String(courseData.id));
  }
  if (courseData.fullname) {
    result = result.replace(/\$CourseSection\.title/g, courseData.fullname);
  }
  if (courseData.shortname) {
    result = result.replace(/\$CourseSection\.label/g, courseData.shortname);
  }

  // Resource link substitutions
  if (resourceLinkId) {
    result = result.replace(/\$ResourceLink\.id/g, resourceLinkId);
  }
  if (resourceLinkTitle) {
    result = result.replace(/\$ResourceLink\.title/g, resourceLinkTitle);
  }

  return result;
}

/**
 * Normalizes grade values to a standard scale (0.0 to 1.0).
 * Converts grade values from various scales to the normalized 0-1 range required by LTI.
 * 
 * @param {number} score - Raw score value
 * @param {number} maximum - Maximum possible score
 * @returns {number} Normalized score (0.0 to 1.0)
 * 
 * @example
 * ```typescript
 * const normalized = normalizeGradeScale(85, 100); // Returns 0.85
 * const normalized2 = normalizeGradeScale(17, 20); // Returns 0.85
 * ```
 */
export function normalizeGradeScale(score: number, maximum: number): number {
  if (maximum === 0) {
    return 0;
  }
  const normalized = score / maximum;
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Builds an HTML form data structure for LTI tool launch.
 * Creates a FormData object with all launch parameters for POST submission.
 * 
 * @param {LtiLaunchParams} params - Launch parameters
 * @returns {Record<string, string>} Form data key-value pairs
 * 
 * @example
 * ```typescript
 * const formData = buildLaunchForm(launchParams);
 * expect(formData['lti_message_type']).toBe('basic-lti-launch-request');
 * ```
 */
export function buildLaunchForm(params: LtiLaunchParams): Record<string, string> {
  const formData: Record<string, string> = {};

  Object.entries(params).forEach(([key, value]) => {
    if (key === 'custom_params' && typeof value === 'object') {
      // Flatten custom params with custom_ prefix
      Object.entries(value).forEach(([customKey, customValue]) => {
        formData[`custom_${customKey}`] = String(customValue);
      });
    } else if (value !== undefined && value !== null) {
      formData[key] = String(value);
    }
  });

  return formData;
}

// ============================================================================
// MSW Request Handlers Setup
// ============================================================================

/**
 * Sets up MSW request handlers for all LTI API endpoints.
 * Configures mock responses for tool retrieval, launch, and grade passback endpoints.
 * 
 * @returns {typeof http} MSW http handlers configuration
 * 
 * @example
 * ```typescript
 * const handlers = setupLTIHandlers();
 * const server = setupServer(...handlers);
 * ```
 */
/**
 * Converts a flat LtiLaunchParams object into an array of {name, value} pairs.
 * This is needed because the hook's LtiLaunchData.parameters expects an array format.
 * 
 * @param {LtiLaunchParams} params - Flat params object
 * @returns {Array<{name: string, value: string}>} Array of parameter objects
 */
export function flatParamsToArray(params: LtiLaunchParams): Array<{ name: string; value: string }> {
  return Object.entries(params).map(([name, value]) => ({
    name,
    value: String(value ?? ''),
  }));
}

export function setupLTIHandlers() {
  const baseUrl = '*/api/v1';  // Use wildcard to match any host (e.g., http://localhost:8000)

  return [
    // GET /api/v1/lti/:id - Get LTI tool details
    http.get(`${baseUrl}/lti/:id`, ({ params }) => {
      const tool = createMockLTITool({ id: Number(params.id) });
      return createSuccessResponse(tool);
    }),

    // POST /api/v1/lti/:id/launch - Launch LTI tool
    http.post(`${baseUrl}/lti/:id/launch`, async ({ params, request }) => {
      const body = await request.json() as { 
        userId?: number; 
        courseId?: number;
        message_type?: string;
        trigger_view?: boolean;
      };
      const flatParams = createMockLaunchParams({
        resource_link_id: String(params.id),
        user_id: body.userId !== undefined ? String(body.userId) : undefined,
        context_id: body.courseId !== undefined ? String(body.courseId) : undefined,
      });
      
      // Convert flat params to array format expected by hook's LtiLaunchData
      const parametersArray = flatParamsToArray(flatParams);
      
      return createSuccessResponse({
        endpoint: 'https://tool.example.com/lti/launch',
        parameters: parametersArray,
        launchContainer: 2, // LTI_LAUNCH_CONTAINER_EMBED (typical default)
        version: '1.1.0',
      });
    }),

    // POST /api/v1/lti/:id/grade - Submit grade via LTI
    http.post(`${baseUrl}/lti/:id/grade`, async ({ request }) => {
      const body = await request.json() as Partial<LtiGradeData>;
      const grade = createMockGradeData(body);
      return createSuccessResponse({
        success: true,
        grade,
      });
    }),

    // GET /api/v1/lti/types - Get available LTI tool types
    http.get(`${baseUrl}/lti/types`, () => {
      const types = [
        { id: 1, name: 'Test Tool Type', baseurl: 'https://example.com' },
        { id: 2, name: 'Another Tool', baseurl: 'https://another.com' },
      ];
      return createSuccessResponse(types);
    }),
  ];
}

/**
 * Creates a standardized success response for MSW handlers.
 * Matches the Moodle API envelope format: { success: true, data: {...} }
 * 
 * @param {T} data - Response data payload
 * @returns {HttpResponse} MSW HttpResponse with JSON body
 * 
 * @example
 * ```typescript
 * return createSuccessResponse({ tool: mockTool });
 * ```
 */
export function createSuccessResponse<T>(data: T): ReturnType<typeof HttpResponse.json> {
  return HttpResponse.json({
    success: true,
    data,
  });
}

/**
 * Creates a standardized error response for MSW handlers.
 * Matches the Moodle API error envelope format.
 * 
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {number} status - HTTP status code (default: 400)
 * @returns {HttpResponse} MSW HttpResponse with JSON error body
 * 
 * @example
 * ```typescript
 * return createErrorResponse('INVALID_TOOL', 'Tool not found', 404);
 * ```
 */
export function createErrorResponse(
  code: string,
  message: string,
  status: number = 400
): ReturnType<typeof HttpResponse.json> {
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
// Test Setup/Teardown Utilities
// ============================================================================

/**
 * Cleanup function to run after each test.
 * Resets all mocks, clears query cache, and restores initial state.
 * 
 * @param {QueryClient} queryClient - React Query client instance
 * 
 * @example
 * ```typescript
 * afterEach(() => {
 *   cleanupAfterEach(queryClient);
 * });
 * ```
 */
export function cleanupAfterEach(queryClient: QueryClient): void {
  // Clear all React Query caches
  queryClient.clear();
  
  // Reset all vi.fn() mocks
  vi.clearAllMocks();
  
  // Reset all module mocks
  vi.resetModules();
}

/**
 * Setup function to run before each test.
 * Initializes test state with fresh QueryClient and default configuration.
 * 
 * @returns {QueryClient} Fresh QueryClient instance for test
 * 
 * @example
 * ```typescript
 * beforeEach(() => {
 *   queryClient = setupBeforeEach();
 * });
 * ```
 */
export function setupBeforeEach(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// ============================================================================
// Custom Assertion Helpers
// ============================================================================

/**
 * Custom assertion to validate OAuth signature correctness.
 * Throws descriptive error if signature validation fails.
 * 
 * @param {LtiLaunchParams} params - Launch parameters with signature
 * @param {string} secret - OAuth consumer secret
 * @param {string} url - Launch URL
 * 
 * @example
 * ```typescript
 * expectOAuthSignatureValid(launchParams, 'secret123', toolUrl);
 * ```
 */
export function expectOAuthSignatureValid(
  params: LtiLaunchParams,
  secret: string,
  url: string
): void {
  const isValid = validateOAuthSignature(params, secret, url);
  
  if (!isValid) {
    const expectedSignature = generateTestOAuthSignature(params, secret, url);
    throw new Error(
      `OAuth signature validation failed.\n` +
      `Expected: ${expectedSignature}\n` +
      `Received: ${params.oauth_signature}\n` +
      `URL: ${url}`
    );
  }
  
  expect(isValid).toBe(true);
}

/**
 * Custom assertion to validate LTI version format.
 * Verifies that LTI version matches one of the supported versions.
 * 
 * @param {string} version - LTI version string to validate
 * 
 * @example
 * ```typescript
 * expectLTIVersionValid(launchParams.lti_version);
 * ```
 */
export function expectLTIVersionValid(version: string): void {
  const validVersions = Object.values(LtiVersion);
  
  if (!validVersions.includes(version as LtiVersion)) {
    throw new Error(
      `Invalid LTI version: ${version}\n` +
      `Valid versions: ${validVersions.join(', ')}`
    );
  }
  
  expect(validVersions).toContain(version);
}

/**
 * Custom assertion to validate grade is within valid range (0.0 to 1.0).
 * Throws descriptive error if grade is outside acceptable bounds.
 * 
 * @param {number} grade - Grade value to validate
 * @param {number} min - Minimum acceptable value (default: 0)
 * @param {number} max - Maximum acceptable value (default: 1)
 * 
 * @example
 * ```typescript
 * expectGradeInRange(normalizedGrade);
 * expectGradeInRange(rawScore, 0, 100);
 * ```
 */
export function expectGradeInRange(
  grade: number,
  min: number = 0,
  max: number = 1
): void {
  if (grade < min || grade > max) {
    throw new Error(
      `Grade value out of range.\n` +
      `Expected: ${min} <= grade <= ${max}\n` +
      `Received: ${grade}`
    );
  }
  
  expect(grade).toBeGreaterThanOrEqual(min);
  expect(grade).toBeLessThanOrEqual(max);
}

/**
 * Helper function to look up a parameter value by name from a parameters array.
 * Used for accessing LtiLaunchData.parameters which is an array of {name, value} objects.
 * 
 * @param {Array<{name: string, value: string}>} parameters - Array of parameter objects
 * @param {string} name - The parameter name to look up
 * @returns {string | undefined} The value of the parameter if found, undefined otherwise
 * 
 * @example
 * ```typescript
 * const ltiMessageType = getParamValue(launchData.parameters, 'lti_message_type');
 * expect(ltiMessageType).toBe('basic-lti-launch-request');
 * ```
 */
export function getParamValue(
  parameters: Array<{ name: string; value: string }> | undefined | null,
  name: string
): string | undefined {
  if (!parameters || !Array.isArray(parameters)) {
    return undefined;
  }
  return parameters.find(p => p.name === name)?.value;
}
