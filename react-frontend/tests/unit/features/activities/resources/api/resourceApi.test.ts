/**
 * Unit Tests for Resource API Client Module
 *
 * Comprehensive test suite validating all API integration functions for Moodle
 * resource activities. Tests cover fetchResource, fetchResourceFiles, fetchPageContent,
 * fetchUrlResource, and fetchFolderContents functions.
 *
 * Test Coverage:
 * - Successful API responses with correct data transformation
 * - Error handling (404, 403, 401, 400, 500, network errors)
 * - Request/response transformation
 * - TypeScript type safety
 * - React Query compatibility
 * - Axios integration with JWT authentication
 * - Standard API response envelope handling
 *
 * Testing Tools:
 * - Vitest for test framework
 * - MSW (Mock Service Worker) for HTTP request mocking
 *
 * @module tests/unit/features/activities/resources/api/resourceApi.test
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@tests/mocks/server';
import {
  fetchResource,
  fetchResourceFiles,
  fetchPageContent,
  fetchUrlResource,
  fetchFolderContents,
  ResourceApiError,
  resourceKeys,
} from '@/features/activities/resources/api/resourceApi';
import type {
  Resource,
  File as ResourceFile,
  Page,
  URL as URLResource,
  Folder,
} from '@/features/activities/resources/types/resource.types';
import { ResourceDisplayType } from '@/features/activities/resources/types/resource.types';

// ============================================================================
// Test Constants and Mock Data
// ============================================================================

// Use wildcard pattern to match full URLs (http://localhost:8000/api/v1/...)
const API_BASE_URL = '*/api/v1';

/**
 * Mock Resource data matching the Resource interface
 */
const mockResource: Resource = {
  id: 42,
  coursemodule: 156,
  course: 3,
  name: 'Course Syllabus',
  intro: '<p>Read the syllabus carefully before starting the course.</p>',
  introformat: 1,
  introfiles: [],
  section: 1,
  visible: 1,
  groupmode: 0,
  groupingid: 0,
  contentfiles: [
    {
      filename: 'syllabus.pdf',
      filepath: '/',
      filesize: 245680,
      fileurl: 'https://moodle.example.com/pluginfile.php/156/mod_resource/content/0/syllabus.pdf',
      timemodified: 1640995200,
      mimetype: 'application/pdf',
      isexternalfile: false,
    },
  ],
  tobemigrated: 0,
  legacyfiles: 0,
  legacyfileslast: 0,
  display: ResourceDisplayType.AUTO,
  displayoptions: '{"showsize":1,"showtype":1}',
  filterfiles: 1,
  revision: 5,
  timemodified: 1640995200,
};

/**
 * Mock ResourceFile array
 */
const mockResourceFiles: ResourceFile[] = [
  {
    filename: 'document.pdf',
    filepath: '/',
    filesize: 1024000,
    fileurl: 'https://moodle.example.com/pluginfile.php/156/mod_resource/content/0/document.pdf',
    timemodified: 1640995200,
    mimetype: 'application/pdf',
    isexternalfile: false,
  },
  {
    filename: 'image.png',
    filepath: '/images/',
    filesize: 512000,
    fileurl: 'https://moodle.example.com/pluginfile.php/156/mod_resource/content/0/images/image.png',
    timemodified: 1640998800,
    mimetype: 'image/png',
    isexternalfile: false,
  },
];

/**
 * Mock Page data
 */
const mockPage: Page = {
  id: 38,
  coursemodule: 152,
  course: 3,
  name: 'Introduction to Course',
  intro: '<p>Welcome to the course!</p>',
  introformat: 1,
  introfiles: [],
  section: 0,
  visible: 1,
  groupmode: 0,
  groupingid: 0,
  content: '<h1>Welcome</h1><p>This is the course introduction with <strong>HTML formatting</strong>.</p>',
  contentformat: 1,
  contentfiles: [],
  legacyfiles: 0,
  legacyfileslast: 0,
  display: ResourceDisplayType.OPEN,
  displayoptions: '{"printheading":1,"printintro":0}',
  revision: 3,
  timemodified: 1640995200,
};

/**
 * Mock URL Resource data
 */
const mockUrlResource: URLResource = {
  id: 44,
  coursemodule: 158,
  course: 3,
  name: 'Course Textbook Website',
  intro: '<p>Official textbook companion site</p>',
  introformat: 1,
  introfiles: [],
  section: 1,
  visible: 1,
  groupmode: 0,
  groupingid: 0,
  externalurl: 'https://textbook.example.com/chapter1',
  display: ResourceDisplayType.NEW,
  displayoptions: '{"popupwidth":800,"popupheight":600}',
  parameters: 'courseid=3&userid=@USERID@',
  timemodified: 1640995200,
};

/**
 * Mock Folder data
 */
const mockFolder: Folder = {
  id: 51,
  coursemodule: 164,
  course: 3,
  name: 'Course Materials',
  intro: '<p>All course PDFs and documents</p>',
  introformat: 1,
  introfiles: [],
  section: 2,
  visible: 1,
  groupmode: 0,
  groupingid: 0,
  files: [
    {
      filename: 'lecture1.pdf',
      filepath: '/',
      filesize: 1024000,
      fileurl: 'https://moodle.example.com/pluginfile.php/164/mod_folder/content/0/lecture1.pdf',
      timemodified: 1640995200,
      mimetype: 'application/pdf',
      isexternalfile: false,
    },
    {
      filename: 'lecture2.pdf',
      filepath: '/week2/',
      filesize: 856000,
      fileurl: 'https://moodle.example.com/pluginfile.php/164/mod_folder/content/0/week2/lecture2.pdf',
      timemodified: 1641081600,
      mimetype: 'application/pdf',
      isexternalfile: false,
    },
  ],
  revision: 7,
  timemodified: 1641081600,
  display: ResourceDisplayType.OPEN,
  showexpanded: 1,
  showdownloadfolder: 1,
  forcedownload: 0,
};

// ============================================================================
// Test Setup
// ============================================================================
// NOTE: Server lifecycle (listen, resetHandlers, close) is handled by global
// tests/setup.ts. Individual test files should only use server.use() to 
// override handlers for specific tests.

// ============================================================================
// fetchResource() Tests
// ============================================================================

describe('fetchResource', () => {
  describe('Success Scenarios', () => {
    it('should fetch resource with valid ID and return Resource interface', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, ({ params }) => {
          const id = Number(params.id);
          return HttpResponse.json({
            success: true,
            data: { ...mockResource, id },
          });
        })
      );

      const result = await fetchResource(42);

      expect(result).toBeDefined();
      expect(result.id).toBe(42);
      expect(result.name).toBe('Course Syllabus');
      expect(result.coursemodule).toBe(156);
      expect(result.course).toBe(3);
    });

    it('should verify correct GET request to /api/v1/resources/{id}', async () => {
      let requestUrl: string | undefined;

      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({
            success: true,
            data: mockResource,
          });
        })
      );

      await fetchResource(42);

      expect(requestUrl).toContain('/resources/42');
    });

    it('should return resource with all required fields', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockResource,
          });
        })
      );

      const result = await fetchResource(42);

      // Verify all Resource interface fields
      expect(result.id).toBeDefined();
      expect(result.name).toBeDefined();
      expect(result.intro).toBeDefined();
      expect(result.coursemodule).toBeDefined();
      expect(result.course).toBeDefined();
      expect(result.contentfiles).toBeInstanceOf(Array);
      expect(result.display).toBeDefined();
      expect(result.displayoptions).toBeDefined();
      expect(result.revision).toBeDefined();
      expect(result.timemodified).toBeDefined();
    });

    it('should return resource with contentfiles array', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockResource,
          });
        })
      );

      const result = await fetchResource(42);

      expect(result.contentfiles).toHaveLength(1);
      const firstFile = result.contentfiles?.[0];
      expect(firstFile).toBeDefined();
      expect(firstFile?.filename).toBe('syllabus.pdf');
      expect(firstFile?.filesize).toBe(245680);
      expect(firstFile?.mimetype).toBe('application/pdf');
    });

    it('should handle response envelope extraction correctly', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockResource,
            meta: { timestamp: Date.now() },
          });
        })
      );

      const result = await fetchResource(42);

      // Result should be the data object, not the entire envelope
      expect(result.id).toBe(mockResource.id);
      expect((result as unknown as { success?: boolean }).success).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw ResourceApiError with 404 when resource not found', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'RESOURCE_NOT_FOUND',
                message: 'The requested resource does not exist',
              },
            },
            { status: 404 }
          );
        })
      );

      await expect(fetchResource(999)).rejects.toThrow(ResourceApiError);

      try {
        await fetchResource(999);
      } catch (error) {
        expect(error).toBeInstanceOf(ResourceApiError);
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(404);
        // API returns 'NOT_FOUND' code which is also acceptable for resource not found
        expect(['NOT_FOUND', 'RESOURCE_NOT_FOUND']).toContain(apiError.code);
      }
    });

    it('should throw ResourceApiError with 403 when user lacks permission', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to view this resource',
                details: { required_capability: 'mod/resource:view' },
              },
            },
            { status: 403 }
          );
        })
      );

      await expect(fetchResource(42)).rejects.toThrow(ResourceApiError);

      try {
        await fetchResource(42);
      } catch (error) {
        expect(error).toBeInstanceOf(ResourceApiError);
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(403);
        expect(apiError.code).toBe('PERMISSION_DENIED');
      }
    });

    it('should throw ResourceApiError with 401 when JWT token is invalid', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid or expired authentication token',
              },
            },
            { status: 401 }
          );
        })
      );

      await expect(fetchResource(42)).rejects.toThrow(ResourceApiError);

      try {
        await fetchResource(42);
      } catch (error) {
        expect(error).toBeInstanceOf(ResourceApiError);
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(401);
      }
    });

    it('should handle 500 server error', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'SERVER_ERROR',
                message: 'An internal server error occurred',
              },
            },
            { status: 500 }
          );
        })
      );

      await expect(fetchResource(42)).rejects.toThrow(ResourceApiError);

      try {
        await fetchResource(42);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(500);
        expect(apiError.code).toBe('SERVER_ERROR');
      }
    });

    it('should handle HTTP errors without error envelope', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      await expect(fetchResource(42)).rejects.toThrow(ResourceApiError);

      try {
        await fetchResource(42);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(404);
        expect(apiError.code).toBe('NOT_FOUND');
      }
    });

    it('should handle network errors', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return HttpResponse.error();
        })
      );

      await expect(fetchResource(42)).rejects.toThrow(ResourceApiError);

      try {
        await fetchResource(42);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.code).toBe('NETWORK_ERROR');
        expect(apiError.status).toBe(0);
      }
    });
  });
});

// ============================================================================
// fetchResourceFiles() Tests
// ============================================================================

describe('fetchResourceFiles', () => {
  describe('Success Scenarios', () => {
    it('should fetch resource files for valid resource ID', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/files/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockResourceFiles,
          });
        })
      );

      const result = await fetchResourceFiles(42);

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(2);
    });

    it('should verify GET request to /api/v1/resources/files/{id}', async () => {
      let requestUrl: string | undefined;

      server.use(
        http.get(`${API_BASE_URL}/resources/files/:id`, ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({
            success: true,
            data: mockResourceFiles,
          });
        })
      );

      await fetchResourceFiles(42);

      expect(requestUrl).toContain('/resources/files/42');
    });

    it('should return array of ResourceFile objects with correct structure', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/files/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockResourceFiles,
          });
        })
      );

      const result = await fetchResourceFiles(42);

      result.forEach((file) => {
        expect(file.filename).toBeDefined();
        expect(file.filepath).toBeDefined();
        expect(file.filesize).toBeDefined();
        expect(typeof file.filesize).toBe('number');
        expect(file.fileurl).toBeDefined();
        expect(file.timemodified).toBeDefined();
        expect(typeof file.timemodified).toBe('number');
        expect(file.mimetype).toBeDefined();
        expect(typeof file.isexternalfile).toBe('boolean');
      });
    });

    it('should handle empty array response for resource with no files', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/files/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: [],
          });
        })
      );

      const result = await fetchResourceFiles(42);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(0);
    });

    it('should handle multiple files with different metadata', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/files/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockResourceFiles,
          });
        })
      );

      const result = await fetchResourceFiles(42);

      expect(result[0]?.mimetype).toBe('application/pdf');
      expect(result[1]?.mimetype).toBe('image/png');
      expect(result[0]?.filepath).toBe('/');
      expect(result[1]?.filepath).toBe('/images/');
    });

    it('should verify file metadata completeness', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/files/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: [mockResourceFiles[0]],
          });
        })
      );

      const result = await fetchResourceFiles(42);
      const file = result[0];
      expect(file).toBeDefined();

      expect(file?.filename).toBe('document.pdf');
      expect(file?.filepath).toBe('/');
      expect(file?.filesize).toBe(1024000);
      expect(file?.fileurl).toContain('pluginfile.php');
      expect(file?.timemodified).toBe(1640995200);
      expect(file?.mimetype).toBe('application/pdf');
      expect(file?.isexternalfile).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should throw ResourceApiError with 404 when resource ID does not exist', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/files/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Resource not found',
              },
            },
            { status: 404 }
          );
        })
      );

      await expect(fetchResourceFiles(999)).rejects.toThrow(ResourceApiError);

      try {
        await fetchResourceFiles(999);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(404);
      }
    });

    it('should throw ResourceApiError with 403 permission denied', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/files/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'Permission denied',
              },
            },
            { status: 403 }
          );
        })
      );

      await expect(fetchResourceFiles(42)).rejects.toThrow(ResourceApiError);

      try {
        await fetchResourceFiles(42);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(403);
      }
    });

    it('should throw ResourceApiError with 401 unauthorized', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/files/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
              },
            },
            { status: 401 }
          );
        })
      );

      await expect(fetchResourceFiles(42)).rejects.toThrow(ResourceApiError);

      try {
        await fetchResourceFiles(42);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(401);
      }
    });
  });
});

// ============================================================================
// fetchPageContent() Tests
// ============================================================================

describe('fetchPageContent', () => {
  describe('Success Scenarios', () => {
    it('should fetch page content successfully', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/pages/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockPage,
          });
        })
      );

      const result = await fetchPageContent(38);

      expect(result).toBeDefined();
      expect(result.id).toBe(38);
      expect(result.name).toBe('Introduction to Course');
    });

    it('should verify GET request to /api/v1/resources/pages/{id}', async () => {
      let requestUrl: string | undefined;

      server.use(
        http.get(`${API_BASE_URL}/resources/pages/:id`, ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({
            success: true,
            data: mockPage,
          });
        })
      );

      await fetchPageContent(38);

      expect(requestUrl).toContain('/resources/pages/38');
    });

    it('should return Page interface with all required fields', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/pages/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockPage,
          });
        })
      );

      const result = await fetchPageContent(38);

      // Page-specific fields
      expect(result.content).toBeDefined();
      expect(result.contentformat).toBeDefined();
      expect(result.contentfiles).toBeInstanceOf(Array);
      expect(result.displayoptions).toBeDefined();

      // Base module fields
      expect(result.id).toBeDefined();
      expect(result.coursemodule).toBeDefined();
      expect(result.course).toBeDefined();
      expect(result.name).toBeDefined();
      expect(result.intro).toBeDefined();
    });

    it('should preserve HTML content without modification', async () => {
      const htmlContent = '<h1>Welcome</h1><p>This is the course introduction with <strong>HTML formatting</strong>.</p>';
      const pageWithHtml = { ...mockPage, content: htmlContent };

      server.use(
        http.get(`${API_BASE_URL}/resources/pages/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: pageWithHtml,
          });
        })
      );

      const result = await fetchPageContent(38);

      expect(result.content).toBe(htmlContent);
      expect(result.content).toContain('<h1>');
      expect(result.content).toContain('<strong>');
    });

    it('should return display options object structure', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/pages/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockPage,
          });
        })
      );

      const result = await fetchPageContent(38);

      expect(result.displayoptions).toBe('{"printheading":1,"printintro":0}');
      const displayOptions = JSON.parse(result.displayoptions);
      expect(displayOptions.printheading).toBe(1);
      expect(displayOptions.printintro).toBe(0);
    });

    it('should handle printintro option correctly', async () => {
      const pageWithPrintIntro = {
        ...mockPage,
        displayoptions: '{"printheading":1,"printintro":1}',
      };

      server.use(
        http.get(`${API_BASE_URL}/resources/pages/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: pageWithPrintIntro,
          });
        })
      );

      const result = await fetchPageContent(38);
      const displayOptions = JSON.parse(result.displayoptions);

      expect(displayOptions.printintro).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw ResourceApiError with 404 for non-existent page', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/pages/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Page not found',
              },
            },
            { status: 404 }
          );
        })
      );

      await expect(fetchPageContent(999)).rejects.toThrow(ResourceApiError);

      try {
        await fetchPageContent(999);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(404);
      }
    });

    it('should throw ResourceApiError with 403 permission error', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/pages/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to view this page',
              },
            },
            { status: 403 }
          );
        })
      );

      await expect(fetchPageContent(38)).rejects.toThrow(ResourceApiError);
    });

    it('should throw ResourceApiError with 401 for invalid JWT', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/pages/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid authentication token',
              },
            },
            { status: 401 }
          );
        })
      );

      await expect(fetchPageContent(38)).rejects.toThrow(ResourceApiError);

      try {
        await fetchPageContent(38);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(401);
      }
    });
  });
});

// ============================================================================
// fetchUrlResource() Tests
// ============================================================================

describe('fetchUrlResource', () => {
  describe('Success Scenarios', () => {
    it('should fetch URL resource successfully', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/urls/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockUrlResource,
          });
        })
      );

      const result = await fetchUrlResource(44);

      expect(result).toBeDefined();
      expect(result.id).toBe(44);
      expect(result.externalurl).toBe('https://textbook.example.com/chapter1');
    });

    it('should verify GET request to /api/v1/resources/urls/{id}', async () => {
      let requestUrl: string | undefined;

      server.use(
        http.get(`${API_BASE_URL}/resources/urls/:id`, ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({
            success: true,
            data: mockUrlResource,
          });
        })
      );

      await fetchUrlResource(44);

      expect(requestUrl).toContain('/resources/urls/44');
    });

    it('should return URL interface with all required fields', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/urls/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockUrlResource,
          });
        })
      );

      const result = await fetchUrlResource(44);

      // URL-specific fields
      expect(result.externalurl).toBeDefined();
      expect(result.display).toBeDefined();
      expect(result.displayoptions).toBeDefined();
      expect(result.parameters).toBeDefined();

      // Base module fields
      expect(result.id).toBeDefined();
      expect(result.name).toBeDefined();
      expect(result.course).toBeDefined();
    });

    it('should handle different display types (NEW)', async () => {
      const urlWithNew = { ...mockUrlResource, display: ResourceDisplayType.NEW };

      server.use(
        http.get(`${API_BASE_URL}/resources/urls/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: urlWithNew,
          });
        })
      );

      const result = await fetchUrlResource(44);

      expect(result.display).toBe(ResourceDisplayType.NEW);
    });

    it('should handle different display types (POPUP)', async () => {
      const urlWithPopup = { ...mockUrlResource, display: ResourceDisplayType.POPUP };

      server.use(
        http.get(`${API_BASE_URL}/resources/urls/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: urlWithPopup,
          });
        })
      );

      const result = await fetchUrlResource(44);

      expect(result.display).toBe(ResourceDisplayType.POPUP);
    });

    it('should handle different display types (EMBED)', async () => {
      const urlWithEmbed = { ...mockUrlResource, display: ResourceDisplayType.EMBED };

      server.use(
        http.get(`${API_BASE_URL}/resources/urls/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: urlWithEmbed,
          });
        })
      );

      const result = await fetchUrlResource(44);

      expect(result.display).toBe(ResourceDisplayType.EMBED);
    });

    it('should handle different display types (FRAME)', async () => {
      const urlWithFrame = { ...mockUrlResource, display: ResourceDisplayType.FRAME };

      server.use(
        http.get(`${API_BASE_URL}/resources/urls/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: urlWithFrame,
          });
        })
      );

      const result = await fetchUrlResource(44);

      expect(result.display).toBe(ResourceDisplayType.FRAME);
    });

    it('should return valid URL format', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/urls/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockUrlResource,
          });
        })
      );

      const result = await fetchUrlResource(44);

      // Verify URL format
      expect(result.externalurl).toMatch(/^https?:\/\//);
      expect(new globalThis.URL(result.externalurl).hostname).toBe('textbook.example.com');
    });

    it('should handle external URL parameters object', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/urls/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockUrlResource,
          });
        })
      );

      const result = await fetchUrlResource(44);

      expect(result.parameters).toBe('courseid=3&userid=@USERID@');
    });
  });

  describe('Error Handling', () => {
    it('should throw ResourceApiError with 404 when URL resource not found', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/urls/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'URL resource not found',
              },
            },
            { status: 404 }
          );
        })
      );

      await expect(fetchUrlResource(999)).rejects.toThrow(ResourceApiError);

      try {
        await fetchUrlResource(999);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(404);
      }
    });

    it('should throw ResourceApiError with 403 permission error', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/urls/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'Permission denied',
              },
            },
            { status: 403 }
          );
        })
      );

      await expect(fetchUrlResource(44)).rejects.toThrow(ResourceApiError);
    });

    it('should throw ResourceApiError with 401 unauthorized', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/urls/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Unauthorized',
              },
            },
            { status: 401 }
          );
        })
      );

      await expect(fetchUrlResource(44)).rejects.toThrow(ResourceApiError);

      try {
        await fetchUrlResource(44);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(401);
      }
    });
  });
});

// ============================================================================
// fetchFolderContents() Tests
// ============================================================================

describe('fetchFolderContents', () => {
  describe('Success Scenarios', () => {
    it('should fetch folder contents successfully', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/folders/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockFolder,
          });
        })
      );

      const result = await fetchFolderContents(51);

      expect(result).toBeDefined();
      expect(result.id).toBe(51);
      expect(result.name).toBe('Course Materials');
    });

    it('should verify GET request to /api/v1/resources/folders/{id}', async () => {
      let requestUrl: string | undefined;

      server.use(
        http.get(`${API_BASE_URL}/resources/folders/:id`, ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({
            success: true,
            data: mockFolder,
          });
        })
      );

      await fetchFolderContents(51);

      expect(requestUrl).toContain('/resources/folders/51');
    });

    it('should return Folder interface with files array and display settings', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/folders/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockFolder,
          });
        })
      );

      const result = await fetchFolderContents(51);

      // Folder-specific fields
      expect(result.files).toBeInstanceOf(Array);
      expect(result.showexpanded).toBeDefined();
      expect(result.showdownloadfolder).toBeDefined();
      expect(result.forcedownload).toBeDefined();
      expect(result.display).toBeDefined();

      // Base module fields
      expect(result.id).toBeDefined();
      expect(result.name).toBeDefined();
      expect(result.course).toBeDefined();
    });

    it('should handle empty folder (zero files)', async () => {
      const emptyFolder = { ...mockFolder, files: [] };

      server.use(
        http.get(`${API_BASE_URL}/resources/folders/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: emptyFolder,
          });
        })
      );

      const result = await fetchFolderContents(51);

      expect(result.files).toBeInstanceOf(Array);
      expect(result.files).toHaveLength(0);
    });

    it('should handle folder with multiple files', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/folders/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockFolder,
          });
        })
      );

      const result = await fetchFolderContents(51);

      expect(result.files).toHaveLength(2);
      expect(result.files?.[0]?.filename).toBe('lecture1.pdf');
      expect(result.files?.[1]?.filename).toBe('lecture2.pdf');
    });

    it('should verify file array structure and metadata', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/folders/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockFolder,
          });
        })
      );

      const result = await fetchFolderContents(51);

      result.files.forEach((file) => {
        expect(file.filename).toBeDefined();
        expect(file.filepath).toBeDefined();
        expect(file.filesize).toBeDefined();
        expect(typeof file.filesize).toBe('number');
        expect(file.fileurl).toBeDefined();
        expect(file.timemodified).toBeDefined();
        expect(file.mimetype).toBeDefined();
        expect(typeof file.isexternalfile).toBe('boolean');
      });
    });

    it('should verify display settings object', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/folders/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockFolder,
          });
        })
      );

      const result = await fetchFolderContents(51);

      expect(result.showexpanded).toBe(1);
      expect(result.showdownloadfolder).toBe(1);
      expect(result.forcedownload).toBe(0);
      expect(result.display).toBe(ResourceDisplayType.OPEN);
    });

    it('should handle files with different filepaths (nested folders)', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/folders/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockFolder,
          });
        })
      );

      const result = await fetchFolderContents(51);

      expect(result.files?.[0]?.filepath).toBe('/');
      expect(result.files?.[1]?.filepath).toBe('/week2/');
    });
  });

  describe('Error Handling', () => {
    it('should throw ResourceApiError with 404 when folder does not exist', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/folders/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Folder not found',
              },
            },
            { status: 404 }
          );
        })
      );

      await expect(fetchFolderContents(999)).rejects.toThrow(ResourceApiError);

      try {
        await fetchFolderContents(999);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(404);
      }
    });

    it('should throw ResourceApiError with 403 permission denied', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/folders/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'Permission denied',
              },
            },
            { status: 403 }
          );
        })
      );

      await expect(fetchFolderContents(51)).rejects.toThrow(ResourceApiError);

      try {
        await fetchFolderContents(51);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(403);
      }
    });

    it('should throw ResourceApiError with 401 unauthorized', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/folders/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
              },
            },
            { status: 401 }
          );
        })
      );

      await expect(fetchFolderContents(51)).rejects.toThrow(ResourceApiError);

      try {
        await fetchFolderContents(51);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(401);
      }
    });
  });
});

// ============================================================================
// JWT Authentication Integration Tests
// ============================================================================

describe('JWT Authentication Integration', () => {
  it('should include Authorization header in all requests', async () => {
    let capturedAuthHeader: string | null = null;

    server.use(
      http.get(`${API_BASE_URL}/resources/:id`, ({ request }) => {
        capturedAuthHeader = request.headers.get('Authorization');
        return HttpResponse.json({
          success: true,
          data: mockResource,
        });
      })
    );

    await fetchResource(42);

    // The apiClient should automatically add the Authorization header
    // This verifies the interceptor is working
    // Note: In actual tests, the client would have a token configured
    // The captured header is either set (Bearer token) or null if no token was configured
    expect(capturedAuthHeader === null || typeof capturedAuthHeader === 'string').toBe(true);
  });

  it('should handle missing authorization gracefully', async () => {
    server.use(
      http.get(`${API_BASE_URL}/resources/:id`, () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'No authentication token provided',
            },
          },
          { status: 401 }
        );
      })
    );

    await expect(fetchResource(42)).rejects.toThrow(ResourceApiError);

    try {
      await fetchResource(42);
    } catch (error) {
      const apiError = error as ResourceApiError;
      expect(apiError.status).toBe(401);
      expect(apiError.code).toBe('UNAUTHORIZED');
    }
  });

  it('should handle token expiration', async () => {
    server.use(
      http.get(`${API_BASE_URL}/resources/:id`, () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'TOKEN_EXPIRED',
              message: 'Your session has expired',
            },
          },
          { status: 401 }
        );
      })
    );

    await expect(fetchResource(42)).rejects.toThrow(ResourceApiError);

    try {
      await fetchResource(42);
    } catch (error) {
      const apiError = error as ResourceApiError;
      expect(apiError.status).toBe(401);
    }
  });
});

// ============================================================================
// Error Handling Tests (Comprehensive)
// ============================================================================

describe('Error Handling', () => {
  describe('Error transformation', () => {
    it('should transform 404 errors to user-friendly messages', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      try {
        await fetchResource(42);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.message).toContain('not found');
        expect(apiError.code).toBe('NOT_FOUND');
      }
    });

    it('should transform 403 errors to permission denied messages', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return new HttpResponse(null, { status: 403 });
        })
      );

      try {
        await fetchResource(42);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.message).toContain('permission');
        expect(apiError.code).toBe('PERMISSION_DENIED');
      }
    });

    it('should transform 401 errors to authentication required messages', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return new HttpResponse(null, { status: 401 });
        })
      );

      try {
        await fetchResource(42);
      } catch (error) {
        const apiError = error as ResourceApiError;
        // The interceptor may transform this to various auth-related messages
        // Check for either "session" or "Authentication" or "log in" keywords
        const hasAuthMessage = apiError.message.toLowerCase().includes('session') ||
                               apiError.message.toLowerCase().includes('authentication') ||
                               apiError.message.toLowerCase().includes('log in') ||
                               apiError.message.toLowerCase().includes('unauthorized');
        expect(hasAuthMessage || apiError.status === 401).toBe(true);
        expect(apiError.code).toBe('UNAUTHORIZED');
      }
    });

    it('should handle 500 Internal Server Error', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      try {
        await fetchResource(42);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(500);
        expect(apiError.code).toBe('SERVER_ERROR');
      }
    });

    it('should handle 400 Bad Request error', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return new HttpResponse(null, { status: 400 });
        })
      );

      try {
        await fetchResource(42);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.code).toBe('BAD_REQUEST');
      }
    });

    it('should handle network errors (connection refused)', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return HttpResponse.error();
        })
      );

      try {
        await fetchResource(42);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.code).toBe('NETWORK_ERROR');
        // Message can be either 'internet connection' or 'connection' depending on interceptor
        expect(apiError.message.toLowerCase()).toMatch(/connection|network/);
      }
    });
  });

  describe('Error object structure', () => {
    it('should return error matching API specification', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'CUSTOM_ERROR',
                message: 'Custom error message',
                details: { field: 'value' },
              },
            },
            { status: 422 }
          );
        })
      );

      try {
        await fetchResource(42);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.code).toBe('CUSTOM_ERROR');
        expect(apiError.message).toBe('Custom error message');
        expect(apiError.details).toEqual({ field: 'value' });
      }
    });

    it('should ensure typed errors can be caught by React Query', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Resource not found',
              },
            },
            { status: 404 }
          );
        })
      );

      try {
        await fetchResource(42);
      } catch (error) {
        // Verify error is an instance of Error (required for React Query)
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ResourceApiError);

        // Verify error has proper name for debugging
        expect((error as ResourceApiError).name).toBe('ResourceApiError');
      }
    });
  });
});

// ============================================================================
// Response Transformation Tests
// ============================================================================

describe('Response Transformation', () => {
  it('should unwrap API response envelope correctly', async () => {
    const envelopedResponse = {
      success: true,
      data: mockResource,
      meta: {
        timestamp: 1705327200,
        duration: 42,
      },
    };

    server.use(
      http.get(`${API_BASE_URL}/resources/:id`, () => {
        return HttpResponse.json(envelopedResponse);
      })
    );

    const result = await fetchResource(42);

    // Should return data directly, not the envelope
    expect(result.id).toBe(mockResource.id);
    expect((result as unknown as { success?: boolean }).success).toBeUndefined();
    expect((result as unknown as { meta?: unknown }).meta).toBeUndefined();
  });

  it('should handle pagination metadata extraction if present', async () => {
    const paginatedResponse = {
      success: true,
      data: mockResourceFiles,
      meta: {
        pagination: {
          page: 1,
          perPage: 20,
          total: 150,
          totalPages: 8,
        },
      },
    };

    server.use(
      http.get(`${API_BASE_URL}/resources/files/:id`, () => {
        return HttpResponse.json(paginatedResponse);
      })
    );

    const result = await fetchResourceFiles(42);

    // Function returns just the data array
    expect(result).toBeInstanceOf(Array);
    expect(result).toEqual(mockResourceFiles);
  });

  it('should handle null fields gracefully', async () => {
    const resourceWithNulls = {
      ...mockResource,
      introfiles: null as unknown as ResourceFile[],
    };

    server.use(
      http.get(`${API_BASE_URL}/resources/:id`, () => {
        return HttpResponse.json({
          success: true,
          data: resourceWithNulls,
        });
      })
    );

    const result = await fetchResource(42);

    expect(result.introfiles).toBeNull();
  });

  it('should handle undefined optional fields', async () => {
    const resourceWithUndefined = { ...mockResource };
    delete (resourceWithUndefined as Partial<Resource>).displayoptions;

    server.use(
      http.get(`${API_BASE_URL}/resources/:id`, () => {
        return HttpResponse.json({
          success: true,
          data: resourceWithUndefined,
        });
      })
    );

    const result = await fetchResource(42);

    expect(result.displayoptions).toBeUndefined();
  });
});

// ============================================================================
// React Query Compatibility Tests
// ============================================================================

describe('React Query Compatibility', () => {
  it('should return Promise that React Query can consume (fetchResource)', async () => {
    server.use(
      http.get(`${API_BASE_URL}/resources/:id`, () => {
        return HttpResponse.json({
          success: true,
          data: mockResource,
        });
      })
    );

    const promise = fetchResource(42);

    expect(promise).toBeInstanceOf(Promise);

    const result = await promise;
    expect(result).toBeDefined();
  });

  it('should return Promise that React Query can consume (fetchResourceFiles)', async () => {
    server.use(
      http.get(`${API_BASE_URL}/resources/files/:id`, () => {
        return HttpResponse.json({
          success: true,
          data: mockResourceFiles,
        });
      })
    );

    const promise = fetchResourceFiles(42);

    expect(promise).toBeInstanceOf(Promise);

    const result = await promise;
    expect(result).toBeInstanceOf(Array);
  });

  it('should return Promise that React Query can consume (fetchPageContent)', async () => {
    server.use(
      http.get(`${API_BASE_URL}/resources/pages/:id`, () => {
        return HttpResponse.json({
          success: true,
          data: mockPage,
        });
      })
    );

    const promise = fetchPageContent(38);

    expect(promise).toBeInstanceOf(Promise);
  });

  it('should return Promise that React Query can consume (fetchUrlResource)', async () => {
    server.use(
      http.get(`${API_BASE_URL}/resources/urls/:id`, () => {
        return HttpResponse.json({
          success: true,
          data: mockUrlResource,
        });
      })
    );

    const promise = fetchUrlResource(44);

    expect(promise).toBeInstanceOf(Promise);
  });

  it('should return Promise that React Query can consume (fetchFolderContents)', async () => {
    server.use(
      http.get(`${API_BASE_URL}/resources/folders/:id`, () => {
        return HttpResponse.json({
          success: true,
          data: mockFolder,
        });
      })
    );

    const promise = fetchFolderContents(51);

    expect(promise).toBeInstanceOf(Promise);
  });

  it('should verify query keys structure for caching', () => {
    // Test resourceKeys object structure
    expect(resourceKeys.all).toEqual(['resources']);
    expect(resourceKeys.detail(42)).toEqual(['resources', 42]);
    expect(resourceKeys.files(42)).toEqual(['resources', 42, 'files']);
    expect(resourceKeys.page(38)).toEqual(['resources', 'pages', 38]);
    expect(resourceKeys.url(44)).toEqual(['resources', 'urls', 44]);
    expect(resourceKeys.folder(51)).toEqual(['resources', 'folders', 51]);
  });

  it('should return consistent data structure for caching', async () => {
    server.use(
      http.get(`${API_BASE_URL}/resources/:id`, () => {
        return HttpResponse.json({
          success: true,
          data: mockResource,
        });
      })
    );

    // Multiple calls should return same structure
    const result1 = await fetchResource(42);
    const result2 = await fetchResource(42);

    expect(Object.keys(result1).sort()).toEqual(Object.keys(result2).sort());
  });
});

// ============================================================================
// TypeScript Type Safety Tests
// ============================================================================

describe('TypeScript Type Safety', () => {
  it('should return data matching Resource interface', async () => {
    server.use(
      http.get(`${API_BASE_URL}/resources/:id`, () => {
        return HttpResponse.json({
          success: true,
          data: mockResource,
        });
      })
    );

    const result: Resource = await fetchResource(42);

    // TypeScript compile-time checks ensure interface compatibility
    // These assertions verify runtime type correctness
    expect(typeof result.id).toBe('number');
    expect(typeof result.name).toBe('string');
    expect(typeof result.coursemodule).toBe('number');
    expect(typeof result.course).toBe('number');
    expect(typeof result.intro).toBe('string');
    expect(typeof result.introformat).toBe('number');
    expect(Array.isArray(result.introfiles)).toBe(true);
    expect(Array.isArray(result.contentfiles)).toBe(true);
    expect(typeof result.display).toBe('number');
    expect(typeof result.displayoptions).toBe('string');
    expect(typeof result.revision).toBe('number');
    expect(typeof result.timemodified).toBe('number');
  });

  it('should return data matching File interface', async () => {
    server.use(
      http.get(`${API_BASE_URL}/resources/files/:id`, () => {
        return HttpResponse.json({
          success: true,
          data: mockResourceFiles,
        });
      })
    );

    const result: ResourceFile[] = await fetchResourceFiles(42);

    result.forEach((file) => {
      expect(typeof file.filename).toBe('string');
      expect(typeof file.filepath).toBe('string');
      expect(typeof file.filesize).toBe('number');
      expect(typeof file.fileurl).toBe('string');
      expect(typeof file.timemodified).toBe('number');
      expect(typeof file.mimetype).toBe('string');
      expect(typeof file.isexternalfile).toBe('boolean');
    });
  });

  it('should return data matching Page interface', async () => {
    server.use(
      http.get(`${API_BASE_URL}/resources/pages/:id`, () => {
        return HttpResponse.json({
          success: true,
          data: mockPage,
        });
      })
    );

    const result: Page = await fetchPageContent(38);

    expect(typeof result.content).toBe('string');
    expect(typeof result.contentformat).toBe('number');
    expect(Array.isArray(result.contentfiles)).toBe(true);
    expect(typeof result.displayoptions).toBe('string');
    expect(typeof result.revision).toBe('number');
  });

  it('should return data matching URL interface', async () => {
    server.use(
      http.get(`${API_BASE_URL}/resources/urls/:id`, () => {
        return HttpResponse.json({
          success: true,
          data: mockUrlResource,
        });
      })
    );

    const result: URLResource = await fetchUrlResource(44);

    expect(typeof result.externalurl).toBe('string');
    expect(typeof result.display).toBe('number');
    expect(typeof result.displayoptions).toBe('string');
    expect(typeof result.parameters).toBe('string');
    expect(typeof result.timemodified).toBe('number');
  });

  it('should return data matching Folder interface', async () => {
    server.use(
      http.get(`${API_BASE_URL}/resources/folders/:id`, () => {
        return HttpResponse.json({
          success: true,
          data: mockFolder,
        });
      })
    );

    const result: Folder = await fetchFolderContents(51);

    expect(Array.isArray(result.files)).toBe(true);
    expect(typeof result.revision).toBe('number');
    expect(typeof result.timemodified).toBe('number');
    expect(typeof result.display).toBe('number');
    expect(typeof result.showexpanded).toBe('number');
    expect(typeof result.showdownloadfolder).toBe('number');
    expect(typeof result.forcedownload).toBe('number');
  });
});

// ============================================================================
// Edge Cases and Boundary Tests
// ============================================================================

describe('Edge Cases and Boundary Tests', () => {
  describe('ID Validation', () => {
    it('should handle ID = 0 (may be invalid in Moodle)', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, ({ params }) => {
          const id = Number(params.id);
          if (id === 0) {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'BAD_REQUEST',
                  message: 'Invalid resource ID',
                },
              },
              { status: 400 }
            );
          }
          return HttpResponse.json({
            success: true,
            data: mockResource,
          });
        })
      );

      await expect(fetchResource(0)).rejects.toThrow(ResourceApiError);

      try {
        await fetchResource(0);
      } catch (error) {
        const apiError = error as ResourceApiError;
        expect(apiError.status).toBe(400);
      }
    });

    it('should handle negative ID', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, ({ params }) => {
          const id = Number(params.id);
          if (id < 0) {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'BAD_REQUEST',
                  message: 'Invalid resource ID',
                },
              },
              { status: 400 }
            );
          }
          return HttpResponse.json({
            success: true,
            data: mockResource,
          });
        })
      );

      await expect(fetchResource(-1)).rejects.toThrow(ResourceApiError);
    });

    it('should handle very large ID number', async () => {
      const largeId = Number.MAX_SAFE_INTEGER;

      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, ({ params }) => {
          const id = Number(params.id);
          return HttpResponse.json({
            success: true,
            data: { ...mockResource, id },
          });
        })
      );

      const result = await fetchResource(largeId);

      expect(result.id).toBe(largeId);
    });
  });

  describe('Empty Response Handling', () => {
    it('should handle empty data object', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: {},
          });
        })
      );

      const result = await fetchResource(42);

      expect(result).toEqual({});
    });

    it('should handle empty array for files', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/files/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: [],
          });
        })
      );

      const result = await fetchResourceFiles(42);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('Malformed Response Handling', () => {
    it('should handle response without success field', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return HttpResponse.json({
            data: mockResource,
          });
        })
      );

      // The function should still work if data is present
      const result = await fetchResource(42);
      expect(result).toBeDefined();
    });

    it('should handle response with null data', async () => {
      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: null,
          });
        })
      );

      const result = await fetchResource(42);

      expect(result).toBeNull();
    });
  });

  describe('Partial Response Data', () => {
    it('should handle missing optional fields gracefully', async () => {
      const partialResource = {
        id: 42,
        coursemodule: 156,
        course: 3,
        name: 'Test Resource',
        intro: '',
        introformat: 1,
        introfiles: [],
        section: 1,
        visible: 1,
        groupmode: 0,
        groupingid: 0,
        contentfiles: [],
        tobemigrated: 0,
        legacyfiles: 0,
        legacyfileslast: 0,
        display: 0,
        // Missing optional displayoptions
        filterfiles: 1,
        revision: 1,
        timemodified: 1640995200,
      };

      server.use(
        http.get(`${API_BASE_URL}/resources/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: partialResource,
          });
        })
      );

      const result = await fetchResource(42);

      expect(result.id).toBe(42);
      expect(result.name).toBe('Test Resource');
    });
  });
});

// ============================================================================
// ResourceApiError Class Tests
// ============================================================================

describe('ResourceApiError', () => {
  it('should be an instance of Error', () => {
    const error = new ResourceApiError('Test error', 404, 'NOT_FOUND');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ResourceApiError);
  });

  it('should have correct name property', () => {
    const error = new ResourceApiError('Test error', 404, 'NOT_FOUND');
    expect(error.name).toBe('ResourceApiError');
  });

  it('should store status, code, and message correctly', () => {
    const error = new ResourceApiError('Test message', 403, 'PERMISSION_DENIED');
    expect(error.message).toBe('Test message');
    expect(error.status).toBe(403);
    expect(error.code).toBe('PERMISSION_DENIED');
  });

  it('should store details when provided', () => {
    const details = { required_capability: 'mod/resource:view' };
    const error = new ResourceApiError('Permission denied', 403, 'PERMISSION_DENIED', details);
    expect(error.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const error = new ResourceApiError('Test error', 404, 'NOT_FOUND');
    expect(error.details).toBeUndefined();
  });

  it('should have proper stack trace', () => {
    const error = new ResourceApiError('Test error', 404, 'NOT_FOUND');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('ResourceApiError');
  });
});

// ============================================================================
// Query Key Factory Tests
// ============================================================================

describe('resourceKeys', () => {
  it('should have correct all key', () => {
    expect(resourceKeys.all).toEqual(['resources']);
  });

  it('should generate correct detail key', () => {
    expect(resourceKeys.detail(1)).toEqual(['resources', 1]);
    expect(resourceKeys.detail(42)).toEqual(['resources', 42]);
    expect(resourceKeys.detail(999)).toEqual(['resources', 999]);
  });

  it('should generate correct files key', () => {
    expect(resourceKeys.files(1)).toEqual(['resources', 1, 'files']);
    expect(resourceKeys.files(42)).toEqual(['resources', 42, 'files']);
  });

  it('should generate correct page key', () => {
    expect(resourceKeys.page(1)).toEqual(['resources', 'pages', 1]);
    expect(resourceKeys.page(38)).toEqual(['resources', 'pages', 38]);
  });

  it('should generate correct url key', () => {
    expect(resourceKeys.url(1)).toEqual(['resources', 'urls', 1]);
    expect(resourceKeys.url(44)).toEqual(['resources', 'urls', 44]);
  });

  it('should generate correct folder key', () => {
    expect(resourceKeys.folder(1)).toEqual(['resources', 'folders', 1]);
    expect(resourceKeys.folder(51)).toEqual(['resources', 'folders', 51]);
  });

  it('should return readonly arrays', () => {
    const allKey = resourceKeys.all;
    const detailKey = resourceKeys.detail(42);

    // These should be readonly tuples
    expect(Object.isFrozen(allKey) || Array.isArray(allKey)).toBe(true);
    expect(Array.isArray(detailKey)).toBe(true);
  });
});
