/**
 * MSW Request Handlers for Resource Activity API Endpoints
 * 
 * This file provides Mock Service Worker (MSW) handlers for resource activity
 * API endpoints, enabling isolated frontend testing without backend dependencies.
 * 
 * Handlers include:
 * - GET /api/v1/resources/:id - Get resource details
 * 
 * @package    react-frontend
 * @subpackage tests/mocks/handlers
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { http, HttpResponse } from 'msw';
import { ResourceDisplayType } from '@/features/activities/resources/types/resource.types';
import { createMockResourceFile } from '@tests/helpers/mockData';

// ============================================================================
// Mock Data
// ============================================================================

/**
 * Default mock resource data for testing
 * Uses createMockResourceFile factory for consistent data structure matching ResourceFile interface
 */
const mockResourceData: Record<number, any> = {
  1: createMockResourceFile({
    id: 1,
    name: 'Course Syllabus PDF',
    intro: '<p>This is the <strong>course syllabus</strong>. Please read it carefully.</p>',
    files: [
      {
        filename: 'syllabus.pdf',
        filepath: '/',
        filesize: 245680,
        url: 'https://moodle.example.com/pluginfile.php/123/mod_resource/content/1/syllabus.pdf',
        timemodified: 1700000000,
        mimetype: 'application/pdf',
      },
    ],
  }),
  2: createMockResourceFile({
    id: 2,
    name: 'Lecture Slides',
    intro: '<p>PowerPoint presentation from Week 1 lecture</p>',
    display: ResourceDisplayType.DOWNLOAD,
    files: [
      {
        filename: 'week1-lecture.pptx',
        filepath: '/',
        filesize: 3456789,
        url: 'https://moodle.example.com/pluginfile.php/124/mod_resource/content/1/week1-lecture.pptx',
        timemodified: 1700000000,
        mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
    ],
  }),
  3: createMockResourceFile({
    id: 3,
    name: 'Empty Resource (No Files)',
    intro: '<p>This resource has no content files attached</p>',
    files: [],
  }),
  4: createMockResourceFile({
    id: 4,
    name: 'To Be Migrated Resource',
    intro: '<p>Legacy resource requiring migration</p>',
    tobemigrated: 1,
    legacyfiles: 1,
    legacyfileslast: 1600000000,
    files: [],
    timemodified: 1600000000,
  }),
  5: createMockResourceFile({
    id: 5,
    name: 'Embedded Video Resource',
    intro: '<p>Video to be embedded in the page</p>',
    display: ResourceDisplayType.EMBED,
    displayoptions: '{"width":800,"height":600,"printintro":1}',
    files: [
      {
        filename: 'lecture-video.mp4',
        filepath: '/',
        filesize: 52428800, // 50 MB
        url: 'https://moodle.example.com/pluginfile.php/125/mod_resource/content/1/lecture-video.mp4',
        timemodified: 1700000000,
        mimetype: 'video/mp4',
      },
    ],
  }),
  6: createMockResourceFile({
    id: 6,
    name: 'Open in New Tab Resource',
    intro: '<p>Document that opens in a new tab</p>',
    display: ResourceDisplayType.NEW,
    files: [
      {
        filename: 'guidelines.docx',
        filepath: '/',
        filesize: 123456,
        url: 'https://moodle.example.com/pluginfile.php/126/mod_resource/content/1/guidelines.docx',
        timemodified: 1700000000,
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    ],
  }),
  
  // Test resources for union type validation (IDs 61-67)
  // Each resource tests a different display mode (0-6)
  61: createMockResourceFile({
    id: 61,
    name: 'Display Mode AUTO (0)',
    intro: '<p>Test resource for AUTO display mode</p>',
    display: 0, // ResourceDisplayType.AUTO
    files: [
      {
        filename: 'auto-display.pdf',
        filepath: '/',
        filesize: 50000,
        url: 'https://moodle.example.com/pluginfile.php/161/mod_resource/content/1/auto-display.pdf',
        timemodified: 1700000000,
        mimetype: 'application/pdf',
      },
    ],
  }),
  62: createMockResourceFile({
    id: 62,
    name: 'Display Mode EMBED (1)',
    intro: '<p>Test resource for EMBED display mode</p>',
    display: 1, // ResourceDisplayType.EMBED
    files: [
      {
        filename: 'embed-display.pdf',
        filepath: '/',
        filesize: 50000,
        url: 'https://moodle.example.com/pluginfile.php/162/mod_resource/content/1/embed-display.pdf',
        timemodified: 1700000000,
        mimetype: 'application/pdf',
      },
    ],
  }),
  63: createMockResourceFile({
    id: 63,
    name: 'Display Mode FRAME (2)',
    intro: '<p>Test resource for FRAME display mode</p>',
    display: 2, // ResourceDisplayType.FRAME
    files: [
      {
        filename: 'frame-display.pdf',
        filepath: '/',
        filesize: 50000,
        url: 'https://moodle.example.com/pluginfile.php/163/mod_resource/content/1/frame-display.pdf',
        timemodified: 1700000000,
        mimetype: 'application/pdf',
      },
    ],
  }),
  64: createMockResourceFile({
    id: 64,
    name: 'Display Mode NEW (3)',
    intro: '<p>Test resource for NEW display mode</p>',
    display: 3, // ResourceDisplayType.NEW
    files: [
      {
        filename: 'new-display.docx',
        filepath: '/',
        filesize: 50000,
        url: 'https://moodle.example.com/pluginfile.php/164/mod_resource/content/1/new-display.docx',
        timemodified: 1700000000,
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    ],
  }),
  65: createMockResourceFile({
    id: 65,
    name: 'Display Mode DOWNLOAD (4)',
    intro: '<p>Test resource for DOWNLOAD display mode</p>',
    display: 4, // ResourceDisplayType.DOWNLOAD
    files: [
      {
        filename: 'download-display.zip',
        filepath: '/',
        filesize: 50000,
        url: 'https://moodle.example.com/pluginfile.php/165/mod_resource/content/1/download-display.zip',
        timemodified: 1700000000,
        mimetype: 'application/zip',
      },
    ],
  }),
  66: createMockResourceFile({
    id: 66,
    name: 'Display Mode OPEN (5)',
    intro: '<p>Test resource for OPEN display mode</p>',
    display: 5, // ResourceDisplayType.OPEN
    files: [
      {
        filename: 'open-display.pdf',
        filepath: '/',
        filesize: 50000,
        url: 'https://moodle.example.com/pluginfile.php/166/mod_resource/content/1/open-display.pdf',
        timemodified: 1700000000,
        mimetype: 'application/pdf',
      },
    ],
  }),
  67: createMockResourceFile({
    id: 67,
    name: 'Display Mode POPUP (6)',
    intro: '<p>Test resource for POPUP display mode</p>',
    display: 6, // ResourceDisplayType.POPUP
    files: [
      {
        filename: 'popup-display.pdf',
        filepath: '/',
        filesize: 50000,
        url: 'https://moodle.example.com/pluginfile.php/167/mod_resource/content/1/popup-display.pdf',
        timemodified: 1700000000,
        mimetype: 'application/pdf',
      },
    ],
  }),
  
  // Test resource for very large file size (ID 75)
  75: createMockResourceFile({
    id: 75,
    name: 'Large File Resource',
    intro: '<p>Test resource with file >1GB</p>',
    display: 0,
    files: [
      {
        filename: 'largefile.iso',
        filepath: '/',
        filesize: 2147483648, // 2 GB
        mimetype: 'application/octet-stream',
        timemodified: 1700000000,
        url: 'https://moodle.example.com/pluginfile.php/175/mod_resource/content/1/largefile.iso',
      },
    ],
  }),
  
  // Test resources for concurrent resourceId prop changes (IDs 80-81)
  80: createMockResourceFile({
    id: 80,
    name: 'Resource 1',
    intro: '<p>First resource for concurrent test</p>',
    display: 0,
    files: [
      {
        filename: 'resource1.pdf',
        filepath: '/',
        filesize: 50000,
        mimetype: 'application/pdf',
        timemodified: 1700000000,
        url: 'https://moodle.example.com/pluginfile.php/180/mod_resource/content/1/resource1.pdf',
      },
    ],
  }),
  81: createMockResourceFile({
    id: 81,
    name: 'Resource 2',
    intro: '<p>Second resource for concurrent test</p>',
    display: 0,
    files: [
      {
        filename: 'resource2.pdf',
        filepath: '/',
        filesize: 50000,
        mimetype: 'application/pdf',
        timemodified: 1700000000,
        url: 'https://moodle.example.com/pluginfile.php/181/mod_resource/content/1/resource2.pdf',
      },
    ],
  }),
};

// ============================================================================
// Request Handlers
// ============================================================================

/**
 * GET /api/v1/resources/:id
 * 
 * Retrieves details for a specific resource activity.
 * 
 * URL Parameters:
 * - id: Resource ID
 * 
 * Response:
 * - 200: Resource data with success envelope
 * - 404: Resource not found
 * - 403: Permission denied (for resource ID 999)
 */
const getResource = http.get('*/api/v1/resources/:id', ({ params, request }) => {
  console.log('[MSW Resources] Handler called with URL:', request.url);
  console.log('[MSW Resources] Params:', params);
  const resourceId = Number(params.id);
  console.log('[MSW Resources] Parsed resourceId:', resourceId);

  // Simulate permission denied for testing
  if (resourceId === 999) {
    console.log('[MSW Resources] Returning 403 permission denied');
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to view this resource',
          details: {
            required_capability: 'mod/resource:view',
            context: 'course',
          },
        },
      },
      { status: 403 }
    );
  }

  // Check if resource exists
  const resource = mockResourceData[resourceId];
  console.log('[MSW Resources] Resource found:', !!resource);
  if (!resource) {
    console.log('[MSW Resources] Returning 404 not found');
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Resource not found',
          details: {
            resourceId,
          },
        },
      },
      { status: 404 }
    );
  }

  // Return successful response
  console.log('[MSW Resources] Returning 200 success with resource:', resource.name);
  return HttpResponse.json({
    success: true,
    data: resource,
  });
});

// ============================================================================
// Handler Array Export
// ============================================================================

/**
 * Array of all resource-related MSW request handlers
 * 
 * These handlers can be added to the MSW server individually or as a group:
 * 
 * @example
 * ```typescript
 * import { resourcesHandlers } from './resources';
 * import { setupServer } from 'msw/node';
 * 
 * const server = setupServer(...resourcesHandlers);
 * ```
 */
export const resourcesHandlers = [getResource];

export default resourcesHandlers;
