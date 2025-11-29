/**
 * Unit tests for dataApi module
 *
 * Tests all Database activity-related API endpoint integrations including:
 * - Database CRUD operations
 * - Record CRUD with approval workflow
 * - Field management
 * - Advanced search with pagination, sorting, and filtering
 * - Template management
 * - File attachments
 * - Export/Import functionality
 * - Rating and comments
 * - Comprehensive error handling
 *
 * Uses MSW (Mock Service Worker) for API mocking
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../../mocks/server';

// Import the dataApi module
import * as dataApi from '@/features/activities/data/api/dataApi';
import type {
  Database,
  DatabaseField,
  FieldContent,
  SearchCriteria,
  DatabasePermissions,
} from '@/features/activities/data/types/data.types';
import { FieldType, TemplateType } from '@/features/activities/data/types/data.types';
import type {
  CreateRecordParams,
  UpdateRecordParams,
  CreateFieldParams,
  UpdateFieldParams,
  UpdateTemplateParams,
  UploadFileParams,
  ExportRecordsParams,
  ImportRecordsParams,
  RateRecordParams,
  AddCommentParams,
  DatabaseAccessInfo,
  TemplateData,
  FileAttachment,
  RecordComment,
  RecordWithContents,
} from '@/features/activities/data/api/dataApi';

/* eslint-disable @typescript-eslint/unbound-method */

// Mock API base URL
const API_BASE_URL = 'http://localhost:8000/api/v1';

// Mock JWT token for authentication
const MOCK_JWT_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

// ============================================================================
// Mock Data
// ============================================================================

const mockDatabase: Database = {
  id: 1,
  course: 10,
  name: 'Student Projects Database',
  intro: 'A database for tracking student projects',
  introformat: 1,
  comments: true,
  timeavailablefrom: 0,
  timeavailableto: 0,
  timeviewfrom: 0,
  timeviewto: 0,
  requiredentries: 1,
  requiredentriestoview: 0,
  maxentries: 5,
  rssarticles: 0,
  singletemplate: '<div>[[Title]]</div>',
  listtemplate: '<ul>##entries##</ul>',
  listtemplateheader: '<h2>All Entries</h2>',
  listtemplatefooter: '<hr/>',
  addtemplate: '<form>[[Title]]</form>',
  rsstemplate: '',
  rsstitletemplate: '',
  csstemplate: '.entry { margin: 10px; }',
  jstemplate: '',
  asearchtemplate: '',
  approval: false,
  manageapproved: true,
  scale: 0,
  assessed: 0,
  assesstimestart: 0,
  assesstimefinish: 0,
  defaultsort: 0,
  defaultsortdir: 0,
  editany: false,
  notification: 0,
  timemodified: 1640000000,
  config: '{}',
  completionentries: 1,
};

const mockDatabases: Database[] = [
  mockDatabase,
  {
    ...mockDatabase,
    id: 2,
    name: 'Research Resources Database',
    intro: 'A collection of research resources',
    approval: true,
    requiredentries: 2,
  },
];

const mockPermissions: DatabasePermissions = {
  canView: true,
  canViewEntry: true,
  canWriteEntry: true,
  canManageEntries: false,
  canManageTemplates: false,
  canRate: true,
  canViewRating: true,
  canViewAnyRating: false,
  canApprove: false,
  canExport: true,
};

const mockAccessInfo: DatabaseAccessInfo = {
  permissions: mockPermissions,
  canAdd: true,
  userEntriesCount: 2,
  entriesRequiredToView: 0,
  canView: true,
  timeavailablefrom: 0,
  timeavailableto: 0,
  isAvailable: true,
  groups: [
    { id: 1, name: 'Group A' },
    { id: 2, name: 'Group B' },
  ],
};

const mockFieldContent: FieldContent = {
  id: 100,
  fieldid: 1,
  recordid: 1,
  content: 'Test Project Title',
  content1: '',
  content2: '',
  content3: '',
  content4: '',
};

const mockRecord: RecordWithContents = {
  id: 1,
  userid: 5,
  groupid: 0,
  dataid: 1,
  timecreated: 1640000000,
  timemodified: 1640000000,
  approved: true,
  contents: [mockFieldContent],
  userfullname: 'John Doe',
  canEdit: true,
  canDelete: false,
  tags: [{ id: 1, name: 'important' }],
  rating: { aggregate: 4.5, count: 10, userRating: 5 },
  comments: [
    {
      id: 1,
      userid: 6,
      userfullname: 'Jane Smith',
      content: 'Great project!',
      format: 1,
      timecreated: 1640001000,
    },
  ],
};

const mockRecords: RecordWithContents[] = [
  mockRecord,
  {
    ...mockRecord,
    id: 2,
    userid: 6,
    userfullname: 'Jane Smith',
    approved: false,
    contents: [{ ...mockFieldContent, id: 101, recordid: 2, content: 'Second Project' }],
  },
];

const mockTextField: DatabaseField = {
  id: 1,
  dataid: 1,
  type: FieldType.Text,
  name: 'Title',
  description: 'Enter the project title',
  required: true,
  param1: '255',
};

const mockTextAreaField: DatabaseField = {
  id: 2,
  dataid: 1,
  type: FieldType.Textarea,
  name: 'Description',
  description: 'Enter a description',
  required: false,
  param1: '60',
  param2: '5',
};

const mockFields: DatabaseField[] = [
  mockTextField as DatabaseField,
  mockTextAreaField as DatabaseField,
  {
    id: 3,
    dataid: 1,
    type: FieldType.Number,
    name: 'Budget',
    description: 'Project budget',
    required: false,
    param1: '2',
  } as DatabaseField,
];

const mockTemplates: TemplateData[] = [
  { type: TemplateType.Single, content: '<div>[[Title]]</div>', isDefault: false },
  { type: TemplateType.List, content: '<ul>##entries##</ul>', isDefault: false },
  { type: TemplateType.Add, content: '<form>[[Title]]</form>', isDefault: true },
  { type: TemplateType.Search, content: '<div class="search"></div>', isDefault: true },
  { type: TemplateType.CSS, content: '.entry { margin: 10px; }', isDefault: false },
];

const mockFileAttachment: FileAttachment = {
  id: 1,
  filename: 'project_doc.pdf',
  mimetype: 'application/pdf',
  filesize: 102400,
  fileurl: '/pluginfile.php/123/mod_data/content/1/project_doc.pdf',
  timemodified: 1640000000,
};

const mockComment: RecordComment = {
  id: 1,
  userid: 6,
  userfullname: 'Jane Smith',
  content: 'Great work!',
  format: 1,
  timecreated: 1640001000,
};

// ============================================================================
// MSW Request Handlers
// ============================================================================

const handlers = [
  // GET database by ID
  http.get(`*${API_BASE_URL}/data/databases/:id`, ({ params }) => {
    const { id } = params;

    if (id === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Database not found',
          },
        },
        { status: 404 }
      );
    }

    if (id === '403') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to view this database',
          },
        },
        { status: 403 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: mockDatabase,
    });
  }),

  // POST get databases by course IDs
  http.post(`*${API_BASE_URL}/data/databases/by-courses`, async ({ request }) => {
    const body = (await request.json()) as { courseids: number[] };

    if (!body.courseids || body.courseids.length === 0) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'At least one course ID must be provided',
          },
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        databases: mockDatabases,
      },
    });
  }),

  // GET database access info
  http.get(`*${API_BASE_URL}/data/databases/:id/access`, ({ params }) => {
    const { id } = params;

    if (id === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Database not found',
          },
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: mockAccessInfo,
    });
  }),

  // GET records (entries)
  http.get(`*${API_BASE_URL}/data/databases/:id/entries`, ({ request, params }) => {
    const { id } = params;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const perpage = parseInt(url.searchParams.get('perpage') ?? '20');

    if (id === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Database not found',
          },
        },
        { status: 404 }
      );
    }

    const total = mockRecords.length;
    const start = (page - 1) * perpage;
    const end = start + perpage;
    const paginatedRecords = mockRecords.slice(start, end);

    return HttpResponse.json({
      success: true,
      data: {
        entries: paginatedRecords,
        totalcount: total,
      },
    });
  }),

  // GET single record
  http.get(`*${API_BASE_URL}/data/databases/:dbId/entries/:recordId`, ({ params }) => {
    const { recordId } = params;

    if (recordId === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Record not found',
          },
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        entry: mockRecord,
      },
    });
  }),

  // POST create record
  http.post(`*${API_BASE_URL}/data/databases/:id/entries`, async ({ request, params }) => {
    const { id: _id } = params;
    const body = (await request.json()) as { groupid: number; data: unknown[] };

    if (!body.data || body.data.length === 0) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'At least one field value must be provided',
          },
        },
        { status: 400 }
      );
    }

    return HttpResponse.json(
      {
        success: true,
        data: {
          newentryid: 999,
        },
      },
      { status: 201 }
    );
  }),

  // PUT update record
  http.put(
    `*${API_BASE_URL}/data/databases/:dbId/entries/:recordId`,
    async ({ params, request }) => {
      const { recordId } = params;

      if (recordId === '404') {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Record not found',
            },
          },
          { status: 404 }
        );
      }

      const body = (await request.json()) as { data: unknown[] };
      if (!body.data || body.data.length === 0) {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'At least one field value must be provided',
            },
          },
          { status: 400 }
        );
      }

      return HttpResponse.json({
        success: true,
        data: {
          updated: true,
        },
      });
    }
  ),

  // DELETE record
  http.delete(`*${API_BASE_URL}/data/databases/:dbId/entries/:recordId`, ({ params }) => {
    const { recordId } = params;

    if (recordId === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Record not found',
          },
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        deleted: true,
      },
    });
  }),

  // POST approve record
  http.post(`*${API_BASE_URL}/data/databases/:dbId/entries/:recordId/approve`, ({ params }) => {
    const { recordId } = params;

    if (recordId === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Record not found',
          },
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        approved: true,
      },
    });
  }),

  // GET fields
  http.get(`*${API_BASE_URL}/data/databases/:id/fields`, ({ params }) => {
    const { id } = params;

    if (id === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Database not found',
          },
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        fields: mockFields,
      },
    });
  }),

  // POST create field
  http.post(`*${API_BASE_URL}/data/databases/:id/fields`, async ({ request, params: _params }) => {
    const body = (await request.json()) as { name: string; type: string };

    if (!body.name || body.name.trim() === '') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Field name is required',
          },
        },
        { status: 400 }
      );
    }

    if (!body.type) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Field type is required',
          },
        },
        { status: 400 }
      );
    }

    return HttpResponse.json(
      {
        success: true,
        data: {
          fieldid: 999,
        },
      },
      { status: 201 }
    );
  }),

  // PUT update field
  http.put(`*${API_BASE_URL}/data/databases/:dbId/fields/:fieldId`, async ({ params, request: _request }) => {
    const { fieldId } = params;

    if (fieldId === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Field not found',
          },
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        updated: true,
      },
    });
  }),

  // DELETE field
  http.delete(`*${API_BASE_URL}/data/databases/:dbId/fields/:fieldId`, ({ params }) => {
    const { fieldId } = params;

    if (fieldId === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Field not found',
          },
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        deleted: true,
      },
    });
  }),

  // POST search records
  http.post(`*${API_BASE_URL}/data/databases/:id/search`, async ({ request, params }) => {
    const { id } = params;
    const body = (await request.json()) as {
      search?: string;
      page?: number;
      perpage?: number;
    };

    if (id === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Database not found',
          },
        },
        { status: 404 }
      );
    }

    // Filter records based on search string if provided
    let filteredRecords = [...mockRecords];
    if (body.search) {
      const searchLower = body.search.toLowerCase();
      filteredRecords = filteredRecords.filter(
        (r) =>
          r.userfullname?.toLowerCase().includes(searchLower) ||
          r.contents.some((c) => c.content?.toLowerCase().includes(searchLower))
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        entries: filteredRecords,
        totalcount: filteredRecords.length,
        maxcount: 100,
      },
    });
  }),

  // GET templates
  http.get(`*${API_BASE_URL}/data/databases/:id/templates`, ({ params }) => {
    const { id } = params;

    if (id === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Database not found',
          },
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        templates: mockTemplates,
      },
    });
  }),

  // PUT update template
  http.put(`*${API_BASE_URL}/data/databases/:id/templates/:type`, async ({ params, request }) => {
    const { type: _type } = params;
    const body = (await request.json()) as { content: string };

    if (!body.content) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Template content is required',
          },
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        updated: true,
      },
    });
  }),

  // POST reset template
  http.post(`*${API_BASE_URL}/data/databases/:id/templates/:type/reset`, ({ params: _params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        reset: true,
        content: '<div>Default [[Title]]</div>',
      },
    });
  }),

  // POST upload file
  http.post(
    `*${API_BASE_URL}/data/databases/:dbId/entries/:recordId/files`,
    async ({ request: _request, params }) => {
      const { recordId } = params;

      if (recordId === '404') {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Record not found',
            },
          },
          { status: 404 }
        );
      }

      return HttpResponse.json(
        {
          success: true,
          data: {
            file: mockFileAttachment,
          },
        },
        { status: 201 }
      );
    }
  ),

  // GET files
  http.get(`*${API_BASE_URL}/data/databases/:dbId/entries/:recordId/files`, ({ params }) => {
    const { recordId } = params;

    if (recordId === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Record not found',
          },
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        files: [mockFileAttachment],
      },
    });
  }),

  // DELETE file
  http.delete(
    `*${API_BASE_URL}/data/databases/:dbId/entries/:recordId/files/:fileId`,
    ({ params }) => {
      const { fileId } = params;

      if (fileId === '404') {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'File not found',
            },
          },
          { status: 404 }
        );
      }

      return HttpResponse.json({
        success: true,
        data: {
          deleted: true,
        },
      });
    }
  ),

  // POST export records
  http.post(`*${API_BASE_URL}/data/databases/:id/export`, async ({ request, params }) => {
    const { id } = params;
    const body = (await request.json()) as { format: string };

    if (!body.format || !['csv', 'ods', 'xml'].includes(body.format)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid export format',
          },
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        downloadurl: `/pluginfile.php/export/${id}.${body.format}`,
      },
    });
  }),

  // POST import records
  http.post(`*${API_BASE_URL}/data/databases/:id/import`, async ({ request: _request, params }) => {
    const { id: _id } = params;

    return HttpResponse.json({
      success: true,
      data: {
        count: 5,
        warnings: ['Row 3: Field "Email" value is invalid format'],
      },
    });
  }),

  // POST rate record
  http.post(`*${API_BASE_URL}/data/databases/:dbId/entries/:recordId/rate`, async ({ params }) => {
    const { recordId } = params;

    if (recordId === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Record not found',
          },
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        aggregate: 4.5,
        count: 11,
      },
    });
  }),

  // POST add comment
  http.post(
    `*${API_BASE_URL}/data/databases/:dbId/entries/:recordId/comments`,
    async ({ params, request }) => {
      const { recordId } = params;
      const body = (await request.json()) as { content: string };

      if (!body.content || body.content.trim() === '') {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Comment content is required',
            },
          },
          { status: 400 }
        );
      }

      if (recordId === '404') {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Record not found',
            },
          },
          { status: 404 }
        );
      }

      return HttpResponse.json(
        {
          success: true,
          data: {
            comment: {
              ...mockComment,
              content: body.content,
            },
          },
        },
        { status: 201 }
      );
    }
  ),
];

// ============================================================================
// Test Suite
// ============================================================================

describe('dataApi', () => {
  beforeAll(() => {
    // Set up mock JWT token in localStorage for apiClient interceptor
    localStorage.setItem('moodle_access_token', MOCK_JWT_TOKEN);
  });

  afterAll(() => {
    // Clean up localStorage
    localStorage.clear();
  });

  beforeEach(() => {
    // Add test-specific handlers before each test
    server.use(...handlers);
  });

  afterEach(() => {
    // Reset handlers to remove test-specific overrides
    server.resetHandlers();
  });

  // ==========================================================================
  // Database Operations Tests
  // ==========================================================================

  describe('getDatabase', () => {
    it('should fetch database successfully with valid ID', async () => {
      const result = await dataApi.getDatabase(1);

      expect(result).toEqual(mockDatabase);
      expect(result.id).toBe(1);
      expect(result.name).toBe('Student Projects Database');
    });

    it('should include JWT token in Authorization header', async () => {
      let capturedHeaders: Headers | undefined;

      server.use(
        http.get(`*${API_BASE_URL}/data/databases/:id`, ({ request }) => {
          capturedHeaders = request.headers;
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
          });
        })
      );

      await dataApi.getDatabase(1);

      expect(capturedHeaders?.get('Authorization')).toBe(`Bearer ${MOCK_JWT_TOKEN}`);
    });

    it('should throw 404 error for non-existent database', async () => {
      await expect(dataApi.getDatabase(404)).rejects.toThrow();
    });

    it('should throw 403 error for permission denied', async () => {
      await expect(dataApi.getDatabase(403)).rejects.toThrow();
    });

    it('should throw error for invalid database ID', async () => {
      await expect(dataApi.getDatabase(0)).rejects.toThrow('Invalid database ID provided');
      await expect(dataApi.getDatabase(-1)).rejects.toThrow('Invalid database ID provided');
    });

    it('should verify response data structure matches Database type', async () => {
      const result = await dataApi.getDatabase(1);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('course');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('intro');
      expect(result).toHaveProperty('comments');
      expect(result).toHaveProperty('approval');
      expect(result).toHaveProperty('timemodified');
    });
  });

  describe('getDatabases', () => {
    it('should fetch databases for given course IDs', async () => {
      const result = await dataApi.getDatabases([10, 20]);

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe(1);
      expect(result[1]!.id).toBe(2);
    });

    it('should throw error for empty course IDs array', async () => {
      await expect(dataApi.getDatabases([])).rejects.toThrow(
        'At least one course ID must be provided'
      );
    });

    it('should throw error for invalid course IDs', async () => {
      await expect(dataApi.getDatabases([-1, 0])).rejects.toThrow('No valid course IDs provided');
    });

    it('should filter out invalid course IDs and proceed with valid ones', async () => {
      const result = await dataApi.getDatabases([10, -1, 0, 20]);

      expect(result).toHaveLength(2);
    });
  });

  describe('getDatabaseAccessInfo', () => {
    it('should fetch access info successfully', async () => {
      const result = await dataApi.getDatabaseAccessInfo(1);

      expect(result).toEqual(mockAccessInfo);
      expect(result.canAdd).toBe(true);
      expect(result.permissions.canView).toBe(true);
    });

    it('should throw error for invalid database ID', async () => {
      await expect(dataApi.getDatabaseAccessInfo(0)).rejects.toThrow(
        'Invalid database ID provided'
      );
    });

    it('should throw 404 error for non-existent database', async () => {
      await expect(dataApi.getDatabaseAccessInfo(404)).rejects.toThrow();
    });

    it('should return all permission flags', async () => {
      const result = await dataApi.getDatabaseAccessInfo(1);

      expect(result.permissions).toHaveProperty('canView');
      expect(result.permissions).toHaveProperty('canViewEntry');
      expect(result.permissions).toHaveProperty('canWriteEntry');
      expect(result.permissions).toHaveProperty('canManageEntries');
      expect(result.permissions).toHaveProperty('canRate');
      expect(result.permissions).toHaveProperty('canApprove');
    });
  });

  // ==========================================================================
  // Record Operations Tests
  // ==========================================================================

  describe('getRecords', () => {
    it('should fetch paginated records successfully', async () => {
      const result = await dataApi.getRecords(1);

      expect(result).toHaveProperty('records');
      expect(result).toHaveProperty('pagination');
      expect(result.records).toHaveLength(2);
    });

    it('should apply pagination parameters', async () => {
      const result = await dataApi.getRecords(1, { page: 1, perPage: 10 });

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.perPage).toBe(10);
    });

    it('should throw error for invalid database ID', async () => {
      await expect(dataApi.getRecords(0)).rejects.toThrow('Invalid database ID provided');
    });

    it('should return proper pagination metadata', async () => {
      const result = await dataApi.getRecords(1);

      expect(result.pagination).toHaveProperty('page');
      expect(result.pagination).toHaveProperty('perPage');
      expect(result.pagination).toHaveProperty('total');
      expect(result.pagination).toHaveProperty('totalPages');
    });
  });

  describe('getRecord', () => {
    it('should fetch single record with contents', async () => {
      const result = await dataApi.getRecord(1, 1);

      expect(result.id).toBe(1);
      expect(result.contents).toHaveLength(1);
      expect(result.userfullname).toBe('John Doe');
    });

    it('should throw error for invalid database ID', async () => {
      await expect(dataApi.getRecord(0, 1)).rejects.toThrow('Invalid database ID provided');
    });

    it('should throw error for invalid record ID', async () => {
      await expect(dataApi.getRecord(1, 0)).rejects.toThrow('Invalid record ID provided');
    });

    it('should throw 404 error for non-existent record', async () => {
      await expect(dataApi.getRecord(1, 404)).rejects.toThrow();
    });
  });

  describe('createRecord', () => {
    it('should create record successfully', async () => {
      const params: CreateRecordParams = {
        databaseId: 1,
        data: [{ fieldid: 1, value: 'Test Project' }],
      };

      const result = await dataApi.createRecord(params);

      expect(result).toBe(999);
    });

    it('should throw error for invalid database ID', async () => {
      const params: CreateRecordParams = {
        databaseId: 0,
        data: [{ fieldid: 1, value: 'Test' }],
      };

      await expect(dataApi.createRecord(params)).rejects.toThrow('Invalid database ID provided');
    });

    it('should throw error for empty field data', async () => {
      const params: CreateRecordParams = {
        databaseId: 1,
        data: [],
      };

      await expect(dataApi.createRecord(params)).rejects.toThrow(
        'At least one field value must be provided'
      );
    });

    it('should support optional group ID', async () => {
      let capturedBody: unknown;

      server.use(
        http.post(`*${API_BASE_URL}/data/databases/:id/entries`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            success: true,
            data: { newentryid: 999 },
          });
        })
      );

      const params: CreateRecordParams = {
        databaseId: 1,
        groupId: 5,
        data: [{ fieldid: 1, value: 'Test' }],
      };

      await dataApi.createRecord(params);

      expect((capturedBody as { groupid: number }).groupid).toBe(5);
    });
  });

  describe('updateRecord', () => {
    it('should update record successfully', async () => {
      const params: UpdateRecordParams = {
        databaseId: 1,
        recordId: 1,
        data: [{ fieldid: 1, value: 'Updated Title' }],
      };

      await expect(dataApi.updateRecord(params)).resolves.not.toThrow();
    });

    it('should throw error for invalid database ID', async () => {
      const params: UpdateRecordParams = {
        databaseId: 0,
        recordId: 1,
        data: [{ fieldid: 1, value: 'Test' }],
      };

      await expect(dataApi.updateRecord(params)).rejects.toThrow('Invalid database ID provided');
    });

    it('should throw error for invalid record ID', async () => {
      const params: UpdateRecordParams = {
        databaseId: 1,
        recordId: 0,
        data: [{ fieldid: 1, value: 'Test' }],
      };

      await expect(dataApi.updateRecord(params)).rejects.toThrow('Invalid record ID provided');
    });

    it('should throw error for empty field data', async () => {
      const params: UpdateRecordParams = {
        databaseId: 1,
        recordId: 1,
        data: [],
      };

      await expect(dataApi.updateRecord(params)).rejects.toThrow(
        'At least one field value must be provided'
      );
    });
  });

  describe('deleteRecord', () => {
    it('should delete record successfully', async () => {
      await expect(dataApi.deleteRecord(1, 1)).resolves.not.toThrow();
    });

    it('should throw error for invalid database ID', async () => {
      await expect(dataApi.deleteRecord(0, 1)).rejects.toThrow('Invalid database ID provided');
    });

    it('should throw error for invalid record ID', async () => {
      await expect(dataApi.deleteRecord(1, 0)).rejects.toThrow('Invalid record ID provided');
    });

    it('should throw 404 error for non-existent record', async () => {
      await expect(dataApi.deleteRecord(1, 404)).rejects.toThrow();
    });
  });

  describe('approveRecord', () => {
    it('should approve record successfully', async () => {
      await expect(dataApi.approveRecord(1, 1, true)).resolves.not.toThrow();
    });

    it('should unapprove record successfully', async () => {
      await expect(dataApi.approveRecord(1, 1, false)).resolves.not.toThrow();
    });

    it('should throw error for invalid database ID', async () => {
      await expect(dataApi.approveRecord(0, 1, true)).rejects.toThrow(
        'Invalid database ID provided'
      );
    });

    it('should throw error for invalid record ID', async () => {
      await expect(dataApi.approveRecord(1, 0, true)).rejects.toThrow('Invalid record ID provided');
    });
  });

  // ==========================================================================
  // Field Operations Tests
  // ==========================================================================

  describe('getFields', () => {
    it('should fetch fields successfully', async () => {
      const result = await dataApi.getFields(1);

      expect(result).toHaveLength(3);
      expect(result[0]!.name).toBe('Title');
      expect(result[0]!.type).toBe(FieldType.Text);
    });

    it('should throw error for invalid database ID', async () => {
      await expect(dataApi.getFields(0)).rejects.toThrow('Invalid database ID provided');
    });

    it('should throw 404 error for non-existent database', async () => {
      await expect(dataApi.getFields(404)).rejects.toThrow();
    });

    it('should return fields with all properties', async () => {
      const result = await dataApi.getFields(1);
      const field = result[0];

      expect(field).toHaveProperty('id');
      expect(field).toHaveProperty('dataid');
      expect(field).toHaveProperty('type');
      expect(field).toHaveProperty('name');
      expect(field).toHaveProperty('description');
      expect(field).toHaveProperty('required');
    });
  });

  describe('createField', () => {
    it('should create field successfully', async () => {
      const params: CreateFieldParams = {
        databaseId: 1,
        type: FieldType.Text,
        name: 'New Field',
        description: 'A new text field',
        required: true,
        param1: '100',
      };

      const result = await dataApi.createField(params);

      expect(result).toBe(999);
    });

    it('should throw error for invalid database ID', async () => {
      const params: CreateFieldParams = {
        databaseId: 0,
        type: FieldType.Text,
        name: 'New Field',
        description: 'Test',
      };

      await expect(dataApi.createField(params)).rejects.toThrow('Invalid database ID provided');
    });

    it('should throw error for missing field name', async () => {
      const params: CreateFieldParams = {
        databaseId: 1,
        type: FieldType.Text,
        name: '',
        description: 'Test',
      };

      await expect(dataApi.createField(params)).rejects.toThrow('Field name is required');
    });
  });

  describe('updateField', () => {
    it('should update field successfully', async () => {
      const params: UpdateFieldParams = {
        databaseId: 1,
        fieldId: 1,
        name: 'Updated Field Name',
        description: 'Updated description',
      };

      await expect(dataApi.updateField(params)).resolves.not.toThrow();
    });

    it('should throw error for invalid database ID', async () => {
      const params: UpdateFieldParams = {
        databaseId: 0,
        fieldId: 1,
        name: 'Test',
      };

      await expect(dataApi.updateField(params)).rejects.toThrow(
        'Invalid database ID provided'
      );
    });

    it('should throw error for invalid field ID', async () => {
      const params: UpdateFieldParams = {
        databaseId: 1,
        fieldId: 0,
        name: 'Test',
      };

      await expect(dataApi.updateField(params)).rejects.toThrow('Invalid field ID provided');
    });
  });

  describe('deleteField', () => {
    it('should delete field successfully', async () => {
      await expect(dataApi.deleteField(1, 1)).resolves.not.toThrow();
    });

    it('should throw error for invalid database ID', async () => {
      await expect(dataApi.deleteField(0, 1)).rejects.toThrow('Invalid database ID provided');
    });

    it('should throw error for invalid field ID', async () => {
      await expect(dataApi.deleteField(1, 0)).rejects.toThrow('Invalid field ID provided');
    });

    it('should throw 404 error for non-existent field', async () => {
      await expect(dataApi.deleteField(1, 404)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Search Operations Tests
  // ==========================================================================

  describe('searchRecords', () => {
    it('should search records with simple query', async () => {
      const criteria: SearchCriteria = {
        search: 'john',
        page: 1,
        perPage: 20,
      };

      const result = await dataApi.searchRecords(1, criteria);

      expect(result).toHaveProperty('records');
      expect(result).toHaveProperty('pagination');
    });

    it('should search with advanced criteria', async () => {
      const criteria: SearchCriteria = {
        search: 'test',
        advanced: { 1: 'john@example.com' },
        sort: { field: 2, direction: 1 },
        page: 1,
        perPage: 10,
      };

      const result = await dataApi.searchRecords(1, criteria);

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.perPage).toBe(10);
    });

    it('should throw error for invalid database ID', async () => {
      await expect(dataApi.searchRecords(0, { page: 1 })).rejects.toThrow(
        'Invalid database ID provided'
      );
    });

    it('should return proper pagination for search results', async () => {
      const result = await dataApi.searchRecords(1, { page: 2, perPage: 10 });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.perPage).toBe(10);
      expect(typeof result.pagination.total).toBe('number');
      expect(typeof result.pagination.totalPages).toBe('number');
    });
  });

  // ==========================================================================
  // Template Operations Tests
  // ==========================================================================

  describe('getTemplates', () => {
    it('should fetch all templates successfully', async () => {
      const result = await dataApi.getTemplates(1);

      expect(result).toHaveLength(5);
      expect(result.some((t) => t.type === TemplateType.Single)).toBe(true);
      expect(result.some((t) => t.type === TemplateType.List)).toBe(true);
    });

    it('should throw error for invalid database ID', async () => {
      await expect(dataApi.getTemplates(0)).rejects.toThrow('Invalid database ID provided');
    });

    it('should return templates with content and isDefault flag', async () => {
      const result = await dataApi.getTemplates(1);

      result.forEach((template) => {
        expect(template).toHaveProperty('type');
        expect(template).toHaveProperty('content');
        expect(template).toHaveProperty('isDefault');
      });
    });
  });

  describe('updateTemplate', () => {
    it('should update template successfully', async () => {
      const params: UpdateTemplateParams = {
        databaseId: 1,
        templateType: TemplateType.Single,
        content: '<div>Updated [[Title]]</div>',
      };

      await expect(dataApi.updateTemplate(params)).resolves.not.toThrow();
    });

    it('should throw error for invalid database ID', async () => {
      const params: UpdateTemplateParams = {
        databaseId: 0,
        templateType: TemplateType.Single,
        content: '<div>Test</div>',
      };

      await expect(dataApi.updateTemplate(params)).rejects.toThrow('Invalid database ID provided');
    });

    it('should throw error for empty content', async () => {
      const params: UpdateTemplateParams = {
        databaseId: 1,
        templateType: TemplateType.Single,
        content: '',
      };

      await expect(dataApi.updateTemplate(params)).rejects.toThrow('Template content is required');
    });
  });

  describe('resetTemplate', () => {
    it('should reset template successfully', async () => {
      await expect(dataApi.resetTemplate(1, TemplateType.Single)).resolves.not.toThrow();
    });

    it('should throw error for invalid database ID', async () => {
      await expect(dataApi.resetTemplate(0, TemplateType.Single)).rejects.toThrow(
        'Invalid database ID provided'
      );
    });
  });

  // ==========================================================================
  // File Operations Tests
  // ==========================================================================

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const params: UploadFileParams = {
        databaseId: 1,
        recordId: 1,
        fieldId: 3,
        file,
      };

      const result = await dataApi.uploadFile(params);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('fileurl');
    });

    it('should throw error for invalid database ID', async () => {
      const file = new File(['test'], 'test.pdf');
      const params: UploadFileParams = {
        databaseId: 0,
        recordId: 1,
        fieldId: 3,
        file,
      };

      await expect(dataApi.uploadFile(params)).rejects.toThrow('Invalid database ID provided');
    });

    it('should throw error for invalid record ID', async () => {
      const file = new File(['test'], 'test.pdf');
      const params: UploadFileParams = {
        databaseId: 1,
        recordId: 0,
        fieldId: 3,
        file,
      };

      await expect(dataApi.uploadFile(params)).rejects.toThrow('Invalid record ID provided');
    });

    it('should throw error for invalid field ID', async () => {
      const file = new File(['test'], 'test.pdf');
      const params: UploadFileParams = {
        databaseId: 1,
        recordId: 1,
        fieldId: 0,
        file,
      };

      await expect(dataApi.uploadFile(params)).rejects.toThrow('Invalid field ID provided');
    });

    it('should throw error for missing file', async () => {
      const params: UploadFileParams = {
        databaseId: 1,
        recordId: 1,
        fieldId: 3,
        file: null as unknown as File,
      };

      await expect(dataApi.uploadFile(params)).rejects.toThrow('File is required');
    });
  });

  describe('getFiles', () => {
    it('should fetch files successfully', async () => {
      const result = await dataApi.getFiles(1, 1);

      expect(result).toHaveLength(1);
      expect(result[0]!.filename).toBe('project_doc.pdf');
    });

    it('should throw error for invalid database ID', async () => {
      await expect(dataApi.getFiles(0, 1)).rejects.toThrow('Invalid database ID provided');
    });

    it('should throw error for invalid record ID', async () => {
      await expect(dataApi.getFiles(1, 0)).rejects.toThrow('Invalid record ID provided');
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      await expect(dataApi.deleteFile(1, 1, 1)).resolves.not.toThrow();
    });

    it('should throw error for invalid database ID', async () => {
      await expect(dataApi.deleteFile(0, 1, 1)).rejects.toThrow('Invalid database ID provided');
    });

    it('should throw error for invalid record ID', async () => {
      await expect(dataApi.deleteFile(1, 0, 1)).rejects.toThrow('Invalid record ID provided');
    });

    it('should throw error for invalid file ID', async () => {
      await expect(dataApi.deleteFile(1, 1, 0)).rejects.toThrow('Invalid file ID provided');
    });
  });

  // ==========================================================================
  // Export/Import Operations Tests
  // ==========================================================================

  describe('exportRecords', () => {
    it('should export records to CSV successfully', async () => {
      const params: ExportRecordsParams = {
        databaseId: 1,
        format: 'csv',
      };

      const result = await dataApi.exportRecords(params);

      expect(result).toContain('.csv');
      expect(typeof result).toBe('string');
    });

    it('should export records to ODS successfully', async () => {
      const params: ExportRecordsParams = {
        databaseId: 1,
        format: 'ods',
      };

      const result = await dataApi.exportRecords(params);

      expect(result).toContain('.ods');
    });

    it('should export records to XML successfully', async () => {
      const params: ExportRecordsParams = {
        databaseId: 1,
        format: 'xml',
      };

      const result = await dataApi.exportRecords(params);

      expect(result).toContain('.xml');
    });

    it('should throw error for invalid database ID', async () => {
      const params: ExportRecordsParams = {
        databaseId: 0,
        format: 'csv',
      };

      await expect(dataApi.exportRecords(params)).rejects.toThrow('Invalid database ID provided');
    });

    it('should throw error for invalid format', async () => {
      const params: ExportRecordsParams = {
        databaseId: 1,
        format: 'invalid' as 'csv',
      };

      await expect(dataApi.exportRecords(params)).rejects.toThrow(
        'Invalid export format. Must be csv, ods, or xml'
      );
    });

    it('should support optional field and record filtering', async () => {
      let capturedBody: unknown;

      server.use(
        http.post(`*${API_BASE_URL}/data/databases/:id/export`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            success: true,
            data: { downloadurl: '/export.csv' },
          });
        })
      );

      const params: ExportRecordsParams = {
        databaseId: 1,
        format: 'csv',
        fieldIds: [1, 2],
        recordIds: [1, 2, 3],
      };

      await dataApi.exportRecords(params);

      expect((capturedBody as { fieldids: number[] }).fieldids).toEqual([1, 2]);
      expect((capturedBody as { recordids: number[] }).recordids).toEqual([1, 2, 3]);
    });
  });

  describe('importRecords', () => {
    it('should import records successfully', async () => {
      const file = new File(['Name,Email\nJohn,john@test.com'], 'import.csv', {
        type: 'text/csv',
      });
      const params: ImportRecordsParams = {
        databaseId: 1,
        file,
      };

      const result = await dataApi.importRecords(params);

      expect(result.count).toBe(5);
      expect(result.warnings).toHaveLength(1);
    });

    it('should throw error for invalid database ID', async () => {
      const file = new File(['test'], 'import.csv');
      const params: ImportRecordsParams = {
        databaseId: 0,
        file,
      };

      await expect(dataApi.importRecords(params)).rejects.toThrow('Invalid database ID provided');
    });

    it('should throw error for missing file', async () => {
      const params: ImportRecordsParams = {
        databaseId: 1,
        file: null as unknown as File,
      };

      await expect(dataApi.importRecords(params)).rejects.toThrow('Import file is required');
    });

    it('should support optional encoding and delimiter', async () => {
      let capturedFormData: FormData | undefined;

      server.use(
        http.post(`*${API_BASE_URL}/data/databases/:id/import`, async ({ request }) => {
          capturedFormData = await request.formData();
          return HttpResponse.json({
            success: true,
            data: { count: 5, warnings: [] },
          });
        })
      );

      const file = new File(['test'], 'import.csv');
      const params: ImportRecordsParams = {
        databaseId: 1,
        file,
        encoding: 'ISO-8859-1',
        delimiter: ';',
        hasHeader: false,
      };

      await dataApi.importRecords(params);

      expect(capturedFormData?.get('encoding')).toBe('ISO-8859-1');
      expect(capturedFormData?.get('delimiter')).toBe(';');
      expect(capturedFormData?.get('hasheader')).toBe('0');
    });
  });

  // ==========================================================================
  // Rating and Comments Tests
  // ==========================================================================

  describe('rateRecord', () => {
    it('should rate record successfully', async () => {
      const params: RateRecordParams = {
        databaseId: 1,
        recordId: 1,
        rating: 5,
      };

      const result = await dataApi.rateRecord(params);

      expect(result.aggregate).toBe(4.5);
      expect(result.count).toBe(11);
    });

    it('should throw error for invalid database ID', async () => {
      const params: RateRecordParams = {
        databaseId: 0,
        recordId: 1,
        rating: 5,
      };

      await expect(dataApi.rateRecord(params)).rejects.toThrow('Invalid database ID provided');
    });

    it('should throw error for invalid record ID', async () => {
      const params: RateRecordParams = {
        databaseId: 1,
        recordId: 0,
        rating: 5,
      };

      await expect(dataApi.rateRecord(params)).rejects.toThrow('Invalid record ID provided');
    });

    it('should throw error for missing rating', async () => {
      const params: RateRecordParams = {
        databaseId: 1,
        recordId: 1,
        rating: undefined as unknown as number,
      };

      await expect(dataApi.rateRecord(params)).rejects.toThrow('Rating value is required');
    });
  });

  describe('addComment', () => {
    it('should add comment successfully', async () => {
      const params: AddCommentParams = {
        databaseId: 1,
        recordId: 1,
        content: 'Great work on this project!',
      };

      const result = await dataApi.addComment(params);

      expect(result).toHaveProperty('id');
      expect(result.content).toBe('Great work on this project!');
    });

    it('should throw error for invalid database ID', async () => {
      const params: AddCommentParams = {
        databaseId: 0,
        recordId: 1,
        content: 'Test comment',
      };

      await expect(dataApi.addComment(params)).rejects.toThrow('Invalid database ID provided');
    });

    it('should throw error for invalid record ID', async () => {
      const params: AddCommentParams = {
        databaseId: 1,
        recordId: 0,
        content: 'Test comment',
      };

      await expect(dataApi.addComment(params)).rejects.toThrow('Invalid record ID provided');
    });

    it('should throw error for empty content', async () => {
      const params: AddCommentParams = {
        databaseId: 1,
        recordId: 1,
        content: '',
      };

      await expect(dataApi.addComment(params)).rejects.toThrow('Comment content is required');
    });

    it('should throw error for whitespace-only content', async () => {
      const params: AddCommentParams = {
        databaseId: 1,
        recordId: 1,
        content: '   ',
      };

      await expect(dataApi.addComment(params)).rejects.toThrow('Comment content is required');
    });
  });

  // ==========================================================================
  // Query Keys Tests
  // ==========================================================================

  describe('dataQueryKeys', () => {
    it('should generate correct base key', () => {
      expect(dataApi.dataQueryKeys.all).toEqual(['data']);
    });

    it('should generate correct databases key', () => {
      expect(dataApi.dataQueryKeys.databases()).toEqual(['data', 'databases']);
    });

    it('should generate correct database key with ID', () => {
      expect(dataApi.dataQueryKeys.database(123)).toEqual(['data', 'databases', 123]);
    });

    it('should generate correct databasesByCourse key', () => {
      expect(dataApi.dataQueryKeys.databasesByCourse(10)).toEqual([
        'data',
        'databases',
        'course',
        10,
      ]);
    });

    it('should generate correct databaseAccess key', () => {
      expect(dataApi.dataQueryKeys.databaseAccess(123)).toEqual([
        'data',
        'databases',
        123,
        'access',
      ]);
    });

    it('should generate correct records key', () => {
      expect(dataApi.dataQueryKeys.records()).toEqual(['data', 'records']);
    });

    it('should generate correct recordsByDatabase key with params', () => {
      const params: SearchCriteria = { page: 1, perPage: 10 };
      expect(dataApi.dataQueryKeys.recordsByDatabase(123, params)).toEqual([
        'data',
        'records',
        'database',
        123,
        params,
      ]);
    });

    it('should generate correct record key', () => {
      expect(dataApi.dataQueryKeys.record(123, 456)).toEqual(['data', 'records', 123, 456]);
    });

    it('should generate correct fields key', () => {
      expect(dataApi.dataQueryKeys.fields()).toEqual(['data', 'fields']);
    });

    it('should generate correct fieldsByDatabase key', () => {
      expect(dataApi.dataQueryKeys.fieldsByDatabase(123)).toEqual([
        'data',
        'fields',
        'database',
        123,
      ]);
    });

    it('should generate correct field key', () => {
      expect(dataApi.dataQueryKeys.field(123, 456)).toEqual(['data', 'fields', 123, 456]);
    });

    it('should generate correct search key', () => {
      const criteria: SearchCriteria = { search: 'test' };
      expect(dataApi.dataQueryKeys.search(123, criteria)).toEqual([
        'data',
        'search',
        123,
        criteria,
      ]);
    });

    it('should generate correct templates key', () => {
      expect(dataApi.dataQueryKeys.templates(123)).toEqual(['data', 'databases', 123, 'templates']);
    });

    it('should generate correct template key', () => {
      expect(dataApi.dataQueryKeys.template(123, TemplateType.Single)).toEqual([
        'data',
        'databases',
        123,
        'templates',
        TemplateType.Single,
      ]);
    });

    it('should generate correct files key', () => {
      expect(dataApi.dataQueryKeys.files(123, 456)).toEqual(['data', 'records', 123, 456, 'files']);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle network timeout errors', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/data/databases/:id`, () => {
          return HttpResponse.error();
        })
      );

      await expect(dataApi.getDatabase(1)).rejects.toThrow();
    });

    it('should handle 500 server errors', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/data/databases/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'SERVER_ERROR',
                message: 'Internal server error',
              },
            },
            { status: 500 }
          );
        })
      );

      await expect(dataApi.getDatabase(1)).rejects.toThrow();
    });

    it('should handle 401 unauthorized errors', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/data/databases/:id`, () => {
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

      await expect(dataApi.getDatabase(1)).rejects.toThrow();
    });

    it('should handle malformed JSON response', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/data/databases/:id`, () => {
          // Return a 500 error with malformed data to trigger an error condition
          return new HttpResponse('Internal Server Error - Malformed Response', {
            status: 500,
            headers: { 'Content-Type': 'text/plain' },
          });
        })
      );

      await expect(dataApi.getDatabase(1)).rejects.toThrow();
    });
  });
});
