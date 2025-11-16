/**
 * Test fixtures and mock data for LTI (Learning Tools Interoperability) unit tests
 *
 * This file provides comprehensive mock data covering:
 * - LTI 1.1 and LTI 1.3 tool configurations
 * - Launch parameters and OAuth/OIDC authentication
 * - User roles and course contexts
 * - Grade passback and AGS (Assignment and Grade Services)
 * - Outcome service XML requests/responses
 * - Custom parameters and tool proxies
 * - Error scenarios and security attributes
 *
 * All fixtures are typed with interfaces from lti.types.ts to ensure type safety
 *
 * @package react-frontend
 * @subpackage tests/unit/features/activities/lti
 */

import type {
  LtiTool,
  LtiToolProxy,
  LtiLaunchData,
  LtiGradeResult} from '@/features/activities/lti/types/lti.types';
import {
  LaunchContainer,
  LtiToolProxyState,
} from '@/features/activities/lti/types/lti.types';
import type { User } from '@/features/admin/users/types/user.types';
import type { Course } from '@/features/admin/courses/types/course.types';
import type { CourseModule } from '@/features/activities/quizzes/types/quiz.types';

/**
 * Mock LTI 1.1 Tool Configuration
 * Represents a typical LTI 1.1 external tool instance with OAuth authentication
 */
export const mockLTI11Tool: LtiTool = {
  id: 1,
  course: 101,
  name: 'Sample LTI 1.1 Tool',
  intro: 'This is a sample LTI 1.1 external tool for testing purposes',
  introformat: 1, // FORMAT_HTML
  timecreated: 1704067200, // 2024-01-01 00:00:00 UTC
  timemodified: 1704067200,
  toolurl: 'https://lti-tool.example.com/lti/launch',
  securetoolurl: 'https://lti-tool.example.com/lti/launch',
  instructorchoicesendname: 1,
  instructorchoicesendemailaddr: 1,
  instructorchoiceallowroster: 1,
  instructorchoiceallowsetting: 1,
  instructorcustomparameters: 'custom_param1=value1\ncustom_param2=value2',
  instructorchoiceacceptgrades: 1,
  typeid: 1,
  toolproxyid: undefined,
  grade: 100,
  launchcontainer: LaunchContainer.EMBED,
  resourcekey: 'test-consumer-key-12345',
  password: 'test-shared-secret-67890',
  debuglaunch: 0,
  showtitlelaunch: 1,
  showdescriptionlaunch: 1,
  servicesalt: 'abc123def456ghi789',
  icon: 'https://example.com/lti/icon.png',
  secureicon: 'https://example.com/lti/icon.png',
};

/**
 * Mock LTI 1.3 Tool Configuration
 * Represents an LTI 1.3 (Advantage) tool with OIDC authentication and improved security
 */
export const mockLTI13Tool: LtiTool = {
  id: 2,
  course: 101,
  name: 'Sample LTI 1.3 Tool',
  intro: 'This is a sample LTI 1.3 Advantage tool with enhanced features',
  introformat: 1, // FORMAT_HTML
  timecreated: 1704067200, // 2024-01-01 00:00:00 UTC
  timemodified: 1704067200,
  toolurl: 'https://lti13-provider.example.com/launch',
  securetoolurl: 'https://lti13-provider.example.com/launch',
  instructorchoicesendname: 1,
  instructorchoicesendemailaddr: 1,
  instructorchoiceallowroster: 1,
  instructorchoiceallowsetting: 1,
  instructorcustomparameters: 'custom_context=$Context.id\ncustom_user_id=$User.id',
  instructorchoiceacceptgrades: 1,
  typeid: 2,
  toolproxyid: undefined,
  grade: 100,
  launchcontainer: LaunchContainer.WINDOW,
  resourcekey: undefined, // LTI 1.3 doesn't use resource key
  password: undefined, // LTI 1.3 doesn't use shared secret
  debuglaunch: 0,
  showtitlelaunch: 1,
  showdescriptionlaunch: 1,
  servicesalt: 'xyz789uvw456rst123',
  icon: 'https://lti13-provider.example.com/icon.png',
  secureicon: 'https://lti13-provider.example.com/icon.png',
  publickeyset: 'https://lti13-provider.example.com/.well-known/jwks.json',
  accesstokenurl: 'https://lti13-provider.example.com/auth/token',
  authurl: 'https://lti13-provider.example.com/oidc/login',
  ltiversion: 'LTI-1p3',
  initiatelogin: 'https://lti13-provider.example.com/oidc/login',
  supportsags: true,
  clientid: 'moodle-client-abc123',
  deploymentid: 'deployment-1',
};

/**
 * Mock LTI 1.1 Launch Parameters
 * Complete set of launch parameters with OAuth signature for LTI 1.1 tool launch
 * Based on IMS LTI 1.1 specification parameters
 */
export const mockLTI11LaunchParams: LtiLaunchData = {
  endpoint: 'https://lti-tool.example.com/lti/launch',
  parameters: [
    { name: 'lti_message_type', value: 'basic-lti-launch-request' },
    { name: 'lti_version', value: 'LTI-1p0' },
    { name: 'resource_link_id', value: 'lti-instance-1' },
    { name: 'resource_link_title', value: 'Sample LTI 1.1 Tool' },
    { name: 'resource_link_description', value: 'This is a sample LTI 1.1 external tool for testing purposes' },
    { name: 'user_id', value: '12345' },
    { name: 'user_image', value: 'https://moodle.example.com/user/pix.php/12345/f1.jpg' },
    { name: 'roles', value: 'Learner' },
    { name: 'lis_person_name_given', value: 'John' },
    { name: 'lis_person_name_family', value: 'Doe' },
    { name: 'lis_person_name_full', value: 'John Doe' },
    { name: 'lis_person_contact_email_primary', value: 'john.doe@example.com' },
    { name: 'context_id', value: 'course-101' },
    { name: 'context_type', value: 'CourseSection' },
    { name: 'context_label', value: 'CS101' },
    { name: 'context_title', value: 'Introduction to Computer Science' },
    { name: 'launch_presentation_locale', value: 'en' },
    { name: 'launch_presentation_document_target', value: 'iframe' },
    { name: 'launch_presentation_return_url', value: 'https://moodle.example.com/mod/lti/return.php?course=101' },
    { name: 'tool_consumer_instance_guid', value: 'moodle.example.com' },
    { name: 'tool_consumer_instance_name', value: 'Example Moodle Site' },
    { name: 'tool_consumer_instance_description', value: 'Example Moodle site for testing' },
    { name: 'tool_consumer_instance_url', value: 'https://moodle.example.com' },
    { name: 'tool_consumer_instance_contact_email', value: 'admin@moodle.example.com' },
    { name: 'tool_consumer_info_product_family_code', value: 'moodle' },
    { name: 'tool_consumer_info_version', value: '4.4' },
    { name: 'lis_result_sourcedid', value: 'course-101:lti-1:user-12345' },
    { name: 'lis_outcome_service_url', value: 'https://moodle.example.com/mod/lti/service.php/outcome' },
    { name: 'custom_param1', value: 'value1' },
    { name: 'custom_param2', value: 'value2' },
    { name: 'oauth_callback', value: 'about:blank' },
    { name: 'oauth_consumer_key', value: 'test-consumer-key-12345' },
    { name: 'oauth_version', value: '1.0' },
    { name: 'oauth_nonce', value: 'a1b2c3d4e5f6g7h8i9j0' },
    { name: 'oauth_timestamp', value: '1704067200' },
    { name: 'oauth_signature_method', value: 'HMAC-SHA1' },
    { name: 'oauth_signature', value: 'dGVzdC1zaWduYXR1cmUtaGFzaA==' },
  ],
  // Direct properties for test access
  lti_message_type: 'basic-lti-launch-request',
  lti_version: 'LTI-1p0',
  resource_link_id: 'lti-instance-1',
  resource_link_title: 'Sample LTI 1.1 Tool',
  resource_link_description: 'This is a sample LTI 1.1 external tool for testing purposes',
  user_id: '12345',
  user_image: 'https://moodle.example.com/user/pix.php/12345/f1.jpg',
  roles: 'Learner',
  lis_person_name_given: 'John',
  lis_person_name_family: 'Doe',
  lis_person_name_full: 'John Doe',
  lis_person_contact_email_primary: 'john.doe@example.com',
  context_id: 'course-101',
  context_type: 'CourseSection',
  context_label: 'CS101',
  context_title: 'Introduction to Computer Science',
  launch_presentation_locale: 'en',
  launch_presentation_document_target: 'iframe',
  launch_presentation_return_url: 'https://moodle.example.com/mod/lti/return.php?course=101',
  tool_consumer_instance_guid: 'moodle.example.com',
  tool_consumer_instance_name: 'Example Moodle Site',
  tool_consumer_instance_description: 'Example Moodle site for testing',
  tool_consumer_instance_url: 'https://moodle.example.com',
  tool_consumer_instance_contact_email: 'admin@moodle.example.com',
  tool_consumer_info_product_family_code: 'moodle',
  tool_consumer_info_version: '4.4',
  lis_result_sourcedid: 'course-101:lti-1:user-12345',
  lis_outcome_service_url: 'https://moodle.example.com/mod/lti/service.php/outcome',
  custom_param1: 'value1',
  custom_param2: 'value2',
  oauth_callback: 'about:blank',
  oauth_consumer_key: 'test-consumer-key-12345',
  oauth_version: '1.0',
  oauth_nonce: 'a1b2c3d4e5f6g7h8i9j0',
  oauth_timestamp: '1704067200',
  oauth_signature_method: 'HMAC-SHA1',
  oauth_signature: 'dGVzdC1zaWduYXR1cmUtaGFzaA==',
};

/**
 * Mock LTI 1.3 OIDC Initiation Parameters
 * Parameters sent to the tool provider during OIDC authentication flow
 */
export const mockLTI13OIDCParams = {
  iss: 'https://moodle.example.com',
  login_hint: 'user-12345',
  target_link_uri: 'https://lti-tool.example.com/lti13/launch',
  lti_message_hint: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb3Vyc2VfaWQiOjEwMSwibHRpX2lkIjoyLCJ1c2VyX2lkIjoxMjM0NX0.signature',
  client_id: 'moodle-client-abc123',
  lti_deployment_id: 'deployment-1',
  state: 'state-token-xyz789',
};

/**
 * Mock Student User
 * Represents a student user with learner role for testing
 */
export const mockStudent: User = {
  id: 1001,
  username: 'student1',
  firstname: 'John',
  lastname: 'Student',
  email: 'john.student@example.com',
  auth: 'manual',
  confirmed: true,
  suspended: false,
  deleted: false,
  firstaccess: Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days ago
  lastaccess: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  lastlogin: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  currentlogin: Math.floor(Date.now() / 1000),
  lastip: '192.168.1.100',
  timecreated: Math.floor(Date.now() / 1000) - 86400 * 60, // 60 days ago
  timemodified: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
  roles: ['Learner'],
};

/**
 * Mock Teacher User
 * Represents a teacher/instructor user with instructor role for testing
 */
export const mockTeacher: User = {
  id: 2001,
  username: 'teacher1',
  firstname: 'Jane',
  lastname: 'Smith',
  email: 'jane.smith@example.com',
  auth: 'manual',
  confirmed: true,
  suspended: false,
  deleted: false,
  firstaccess: Math.floor(Date.now() / 1000) - 86400 * 90, // 90 days ago
  lastaccess: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
  lastlogin: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
  currentlogin: Math.floor(Date.now() / 1000),
  lastip: '192.168.1.200',
  timecreated: Math.floor(Date.now() / 1000) - 86400 * 180, // 180 days ago
  timemodified: Math.floor(Date.now() / 1000) - 86400 * 7, // 7 days ago
  roles: ['Instructor'],
};

/**
 * Mock Admin User
 * Represents an administrator user with admin role for testing
 */
export const mockAdmin: User = {
  id: 3001,
  username: 'admin1',
  firstname: 'Admin',
  lastname: 'User',
  email: 'admin@moodle.example.com',
  auth: 'manual',
  confirmed: true,
  suspended: false,
  deleted: false,
  firstaccess: Math.floor(Date.now() / 1000) - 86400 * 365, // 1 year ago
  lastaccess: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
  lastlogin: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
  currentlogin: Math.floor(Date.now() / 1000),
  lastip: '192.168.1.1',
  timecreated: Math.floor(Date.now() / 1000) - 86400 * 730, // 2 years ago
  timemodified: Math.floor(Date.now() / 1000) - 86400 * 2, // 2 days ago
  roles: ['Administrator'],
};

/**
 * Mock Course
 * Represents a course context for LTI tool launches
 */
export const mockCourse: Course = {
  id: 101,
  fullname: 'Introduction to Computer Science',
  shortname: 'CS101',
  idnumber: 'CS-101-2024',
  category: 1,
  visible: 1,
  format: 'topics',
  startdate: 1704067200, // 2024-01-01
  enddate: 1719792000, // 2024-07-01
  timecreated: 1701475200, // 2023-12-02 00:00:00 UTC
  timemodified: 1701475200, // 2023-12-02 00:00:00 UTC
};

/**
 * Mock Course Module
 * Represents the course module instance containing the LTI activity
 */
export const mockCourseModule: CourseModule = {
  id: 501,
  course: 101,
  module: 20, // LTI module type ID
  instance: 1, // LTI instance ID
  section: 1,
  visible: 1,
  visibleoncoursepage: 1,
  groupmode: 0,
  completion: 0,
  name: 'Sample LTI 1.1 Tool',
};

/**
 * Mock Grade Result
 * Represents a grade submission from an LTI tool
 */
export const mockGrade: LtiGradeResult = {
  id: 1,
  ltiid: 1,
  userid: 1001,
  gradepercent: 85,
  dategraded: 1704153600, // 2024-01-02 00:00:00 UTC
  datesubmitted: 1704067200, // 2024-01-01 00:00:00 UTC
  dateupdated: 1704153600,
  originalgrade: 85,
  launchid: 1,
  state: 1,
  rawgrade: 85,
  rawgrademax: 100,
  rawgrademin: 0,
  timemodified: 1704153600,
};

/**
 * Mock Grade Passback Request
 * Represents the data sent in an LTI outcomes service grade passback request
 */
export const mockGradePassbackRequest = {
  sourcedId: 'course-101:lti-1:user-12345',
  lis_result_sourcedid: 'course-101:lti-1:user-12345',
  lis_outcome_service_url: 'https://moodle.example.com/mod/lti/service.php',
  score: 0.85, // Grade as decimal (0-1)
  comment: 'Well done! Excellent work on this assignment.',
};

/**
 * Mock Grade Passback Response
 * Represents the response from Moodle after successful grade passback
 */
export const mockGradePassbackResponse = {
  success: true,
  messageIdentifier: `msg-${  Date.now()}`,
  message: 'Grade successfully updated',
  grade: 85.5,
  gradepercent: 85.5,
};

/**
 * Mock Replace Result XML
 * XML request body for LTI 1.1 replaceResult operation
 */
export const mockReplaceResultXML = `<?xml version="1.0" encoding="UTF-8"?>
<imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
  <imsx_POXHeader>
    <imsx_POXRequestHeaderInfo>
      <imsx_version>V1.0</imsx_version>
      <imsx_messageIdentifier>999999123</imsx_messageIdentifier>
    </imsx_POXRequestHeaderInfo>
  </imsx_POXHeader>
  <imsx_POXBody>
    <replaceResultRequest>
      <resultRecord>
        <sourcedGUID>
          <sourcedId>course-101:lti-1:user-12345</sourcedId>
        </sourcedGUID>
        <result>
          <resultScore>
            <language>en</language>
            <textString>0.855</textString>
          </resultScore>
        </result>
      </resultRecord>
    </replaceResultRequest>
  </imsx_POXBody>
</imsx_POXEnvelopeRequest>`;

/**
 * Mock Read Result XML
 * XML request body for LTI 1.1 readResult operation
 */
export const mockReadResultXML = `<?xml version="1.0" encoding="UTF-8"?>
<imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
  <imsx_POXHeader>
    <imsx_POXRequestHeaderInfo>
      <imsx_version>V1.0</imsx_version>
      <imsx_messageIdentifier>999999124</imsx_messageIdentifier>
    </imsx_POXRequestHeaderInfo>
  </imsx_POXHeader>
  <imsx_POXBody>
    <readResultRequest>
      <resultRecord>
        <sourcedGUID>
          <sourcedId>course-101:lti-1:user-12345</sourcedId>
        </sourcedGUID>
      </resultRecord>
    </readResultRequest>
  </imsx_POXBody>
</imsx_POXEnvelopeRequest>`;

/**
 * Mock Delete Result XML
 * XML request body for LTI 1.1 deleteResult operation
 */
export const mockDeleteResultXML = `<?xml version="1.0" encoding="UTF-8"?>
<imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
  <imsx_POXHeader>
    <imsx_POXRequestHeaderInfo>
      <imsx_version>V1.0</imsx_version>
      <imsx_messageIdentifier>999999125</imsx_messageIdentifier>
    </imsx_POXRequestHeaderInfo>
  </imsx_POXHeader>
  <imsx_POXBody>
    <deleteResultRequest>
      <resultRecord>
        <sourcedGUID>
          <sourcedId>course-101:lti-1:user-12345</sourcedId>
        </sourcedGUID>
      </resultRecord>
    </deleteResultRequest>
  </imsx_POXBody>
</imsx_POXEnvelopeRequest>`;

/**
 * Mock AGS Line Item
 * Assignment and Grade Services (LTI 1.3 Advantage) line item for gradebook column
 */
export const mockAGSLineItem = {
  id: 'https://moodle.example.com/api/lti/courses/101/line_items/1',
  scoreMaximum: 100,
  label: 'Sample LTI 1.3 Tool Assignment',
  resourceId: 'lti-tool-2',
  resourceLinkId: 'lti-instance-2',
  tag: 'assignment',
  startDateTime: '2024-01-01T00:00:00Z',
  endDateTime: '2024-01-31T23:59:59Z',
};

/**
 * Mock AGS Score
 * Assignment and Grade Services (LTI 1.3 Advantage) score submission
 */
export const mockAGSScore = {
  userId: '12345',
  scoreGiven: 85,
  scoreMaximum: 100,
  comment: 'Excellent work on this assignment!',
  timestamp: '2024-01-02T00:00:00Z',
  activityProgress: 'Completed',
  gradingProgress: 'FullyGraded',
};

/**
 * Mock Custom Parameters
 * Various types of custom parameters with variable substitutions
 */
export const mockCustomParams = {
  custom_context_id: '$Context.id',
  custom_context_title: '$Context.title',
  custom_user_id: '$User.id',
  custom_user_username: '$User.username',
  custom_user_email: '$User.email',
  custom_course_id: '$CourseSection.sourcedId',
  custom_resource_link_id: '$ResourceLink.id',
  custom_lis_person_sourcedid: '$Person.sourcedId',
  custom_static_param: 'static_value_123',
  custom_another_param: 'another_static_value',
  custom_string_param: 'test_string_value',
};

/**
 * Mock Tool Proxy
 * LTI 2.0 tool proxy registration data
 */
export const mockToolProxy: LtiToolProxy = {
  id: 100,
  name: 'Sample LTI 2.0 Tool Provider',
  regurl: 'https://lti2-provider.example.com/registration',
  state: LtiToolProxyState.ACCEPTED,
  guid: 'tool-proxy-guid-abc123',
  secret: 'tool-proxy-shared-secret-xyz789',
  vendorcode: 'example-vendor',
  capabilityoffered: 'basic-lti-launch-request\nContentItemSelectionRequest\nToolProxyReregistrationRequest',
  serviceoffered: 'ToolProxy.collection\nToolProxy.item\nResult.item\nSetting.item',
  toolproxy: JSON.stringify({
    '@context': 'http://purl.imsglobal.org/ctx/lti/v2/ToolProxy',
    '@type': 'ToolProxy',
    '@id': 'https://lti2-provider.example.com/tool_proxy/1',
    lti_version: 'LTI-2p0',
    tool_consumer_profile: 'https://moodle.example.com/mod/lti/consumer_profile.php',
    tool_profile: {
      product_instance: {
        guid: 'tool-proxy-guid-abc123',
        product_info: {
          product_name: { default_value: 'Sample LTI 2.0 Tool' },
          product_version: '1.0',
        },
      },
    },
  }),
  createdby: 1,
  timecreated: 1704067200,
  timemodified: 1704067200,
};

/**
 * Mock Tool Not Found Error
 * Error scenario when requested LTI tool doesn't exist
 */
export const mockToolNotFoundError = {
  success: false,
  code: 'TOOL_NOT_FOUND',
  message: 'The requested LTI tool was not found',
  status: 404,
  details: {
    toolId: 999,
  },
};

/**
 * Mock Permission Denied Error
 * Error scenario when user lacks permission to access LTI tool
 */
export const mockPermissionDeniedError = {
  success: false,
  code: 'PERMISSION_DENIED',
  message: 'You do not have permission to access this LTI tool',
  status: 403,
  details: {
    required_capability: 'mod/lti:view',
    context: 'course',
  },
};

/**
 * Mock OAuth Signature Error
 * Error scenario when OAuth signature validation fails for LTI 1.1
 */
export const mockOAuthSignatureError = {
  success: false,
  code: 'OAUTH_SIGNATURE_INVALID',
  message: 'OAuth signature verification failed',
  status: 401,
  details: {
    oauth_signature_method: 'HMAC-SHA1',
    timestamp: '1704067200',
    nonce: 'a1b2c3d4e5f6g7h8i9j0',
  },
};

/**
 * Mock Grade Passback Error
 * Error scenario when grade passback fails
 */
export const mockGradePassbackError = {
  success: false,
  code: 'GRADE_PASSBACK_FAILED',
  message: 'Failed to update grade from LTI tool',
  status: 500,
  details: {
    sourcedid: 'course-101:lti-1:user-12345',
    score: 0.855,
    reason: 'Invalid sourcedid format',
  },
};

/**
 * Mock IFrame Security Attributes
 * Security-related attributes for embedding LTI tools in iframes
 */
export const mockIFrameSecurityAttributes = {
  sandbox: 'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox',
  allow: 'camera; microphone; display-capture',
  referrerpolicy: 'no-referrer-when-downgrade',
  credentialless: false,
};

/**
 * Mock Deep Linking Configuration
 * LTI 1.3 Deep Linking (Content-Item) configuration
 */
export const mockDeepLinkingConfig = {
  deep_link_return_url: 'https://moodle.example.com/mod/lti/contentitem_return.php?course=101',
  accept_types: ['link', 'file', 'html', 'ltiResourceLink', 'image'],
  accept_media_types: 'image/*,text/html,application/vnd.ims.lti.v1.ltilink',
  accept_presentation_document_targets: ['iframe', 'window', 'embed'],
  accept_multiple: true,
  accept_unsigned: false,
  auto_create: true,
  title: 'Select content to add to course',
  text: 'Please select one or more items to add to your course',
};

/**
 * Mock Content Item Response
 * LTI Deep Linking content item response from tool provider
 */
export const mockContentItemResponse = {
  '@context': 'http://purl.imsglobal.org/ctx/lti/v1/ContentItem',
  '@type': 'ContentItemSelection',
  '@graph': [
    {
      '@type': 'LtiLinkItem',
      '@id': 'https://lti13-provider.example.com/content/123',
      mediaType: 'application/vnd.ims.lti.v1.ltilink',
      title: 'Interactive Quiz Module',
      text: 'A comprehensive quiz covering chapters 1-5',
      url: 'https://lti13-provider.example.com/launch/quiz/123',
      placementAdvice: {
        presentationDocumentTarget: 'iframe',
        displayWidth: 800,
        displayHeight: 600,
      },
      custom: {
        quiz_id: '123',
        quiz_type: 'formative',
      },
    },
    {
      '@type': 'FileItem',
      '@id': 'https://lti13-provider.example.com/files/456',
      mediaType: 'application/pdf',
      title: 'Study Guide.pdf',
      text: 'Comprehensive study guide for the final exam',
      url: 'https://lti13-provider.example.com/files/456/download',
      expiresAt: '2024-12-31T23:59:59Z',
    },
  ],
};
