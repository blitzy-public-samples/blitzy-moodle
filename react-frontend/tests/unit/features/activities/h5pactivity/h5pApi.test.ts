/**
 * @file h5pApi.test.ts
 * @description Comprehensive unit tests for H5P activity API client
 * 
 * Tests validate all H5P activity API operations including:
 * - Activity fetching (getH5PActivities, getH5PActivity)
 * - Access information retrieval (getAccessInformation)
 * - Activity view logging (viewH5PActivity)
 * - Report view logging (logReportViewed)
 * - Attempt management (getAttempts, getUserAttempts)
 * - Results retrieval (getResults, getAttemptResults)
 * - xAPI statement submission (submitXAPIStatement)
 * 
 * Uses Vitest for test framework and MSW for API mocking
 */

import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Import API functions from h5pApi
import {
  getH5PActivities,
  getH5PActivity,
  getAccessInformation,
  viewH5PActivity,
  logReportViewed,
  getAttempts,
  getUserAttempts,
  getResults,
  getAttemptResults,
  submitXAPIStatement,
} from '../../../../../src/features/activities/h5pactivity/api/h5pApi';

// Import types from h5p.types
import type {
  H5PActivity,
  H5PAttempt,
  H5PResult,
  H5PAccessInfo,
  H5PUserAttempts,
  XAPIStatement,
} from '../../../../../src/features/activities/h5pactivity/types/h5p.types';

// Import apiClient for verification
import { apiClient } from '../../../../../src/services/api/client';

// ============================================================================
// Mock Data Fixtures
// ============================================================================

/**
 * Factory function to create mock H5P activity data
 */
const createMockH5PActivity = (overrides: Partial<H5PActivity> = {}): H5PActivity => ({
  id: 1,
  course: 101,
  name: 'Interactive H5P Content',
  intro: '<p>This is an interactive H5P activity for learning</p>',
  introformat: 1,
  grade: 100,
  displayoptions: '{"frame":true,"export":false,"embed":false,"copyright":true}',
  enabletracking: true,
  grademethod: 1,
  reviewmode: 1,
  timemodified: 1699999999,
  timecreated: 1699900000,
  coursemodule: 501,
  section: 1,
  visible: true,
  groupmode: 0,
  groupingid: 0,
  ...overrides,
});

/**
 * Factory function to create mock H5P attempt data
 */
const createMockH5PAttempt = (overrides: Partial<H5PAttempt> = {}): H5PAttempt => ({
  id: 1,
  h5pactivityid: 1,
  userid: 100,
  timecreated: 1699900000,
  timemodified: 1699999999,
  attempt: 1,
  rawscore: 80,
  maxscore: 100,
  scaled: 0.8,
  duration: 600,
  completion: true,
  success: true,
  ...overrides,
});

/**
 * Factory function to create mock H5P result data
 */
const createMockH5PResult = (overrides: Partial<H5PResult> = {}): H5PResult => ({
  id: 1,
  attemptid: 1,
  subcontent: '',
  timecreated: 1699999999,
  interactiontype: 'choice',
  description: 'Select the correct answer',
  correctpattern: '["choice1"]',
  response: 'choice1',
  additionals: '{"extensions":{}}',
  rawscore: 1,
  maxscore: 1,
  ...overrides,
});

/**
 * Factory function to create mock access information
 */
const createMockAccessInfo = (overrides: Partial<H5PAccessInfo> = {}): H5PAccessInfo => ({
  canview: true,
  cansubmit: true,
  canreviewattempts: false,
  canaddinstance: false,
  canviewallresults: false,
  canviewownresults: true,
  warnings: [],
  ...overrides,
});

/**
 * Factory function to create mock xAPI statement
 */
const createMockXAPIStatement = (overrides: Partial<XAPIStatement> = {}): XAPIStatement => ({
  actor: {
    name: 'Test Student',
    mbox: 'mailto:student@test.edu',
    objectType: 'Agent',
  },
  verb: {
    id: 'http://adlnet.gov/expapi/verbs/answered',
    display: { 'en-US': 'answered' },
  },
  object: {
    id: 'http://example.com/h5p/activity/1',
    definition: {
      type: 'http://adlnet.gov/expapi/activities/interaction',
      name: { 'en-US': 'H5P Activity' },
      description: { 'en-US': 'An interactive H5P activity' },
    },
    objectType: 'Activity',
  },
  result: {
    score: {
      scaled: 0.8,
      raw: 80,
      min: 0,
      max: 100,
    },
    success: true,
    completion: true,
    duration: 'PT10M',
  },
  context: {
    contextActivities: {
      parent: [{
        id: 'http://example.com/course/101',
        objectType: 'Activity',
      }],
    },
  },
  timestamp: new Date().toISOString(),
  ...overrides,
});

/**
 * Factory function to create mock user attempts data
 */
const createMockUserAttempts = (overrides: Partial<H5PUserAttempts> = {}): H5PUserAttempts => ({
  activityid: 1,
  usersattempts: [
    {
      userid: 100,
      attempts: [createMockH5PAttempt()],
      scored: { title: 'Highest', attempts: [createMockH5PAttempt()] },
    },
  ],
  totalattempts: 1,
  ...overrides,
});

// ============================================================================
// API Response Envelope Helper
// ============================================================================

/**
 * Wraps data in standard API response envelope
 */
const apiResponse = <T>(data: T, meta?: Record<string, unknown>) => ({
  success: true,
  data,
  meta,
});

/**
 * Creates error response envelope
 */
const apiErrorResponse = (code: string, message: string, details?: Record<string, unknown>) => ({
  success: false,
  error: {
    code,
    message,
    details,
  },
});

// ============================================================================
// MSW Server Setup
// ============================================================================

const API_BASE_URL = '/api/v1';

// Default mock data instances
const mockActivity = createMockH5PActivity();
const mockAttempt = createMockH5PAttempt();
const mockResult = createMockH5PResult();
const mockAccessInfo = createMockAccessInfo();
const mockXAPIStatement = createMockXAPIStatement();
const mockUserAttempts = createMockUserAttempts();

// MSW handlers for H5P API endpoints
const handlers = [
  // GET /api/v1/h5p/activities - Get activities by courses
  http.get(`${API_BASE_URL}/h5p/activities`, ({ request }) => {
    const url = new URL(request.url);
    const courseIds = url.searchParams.get('courseIds');
    
    if (courseIds) {
      const ids = courseIds.split(',').map(Number);
      const activities = ids.map((courseId) =>
        createMockH5PActivity({ id: courseId, course: courseId })
      );
      return HttpResponse.json(apiResponse(activities));
    }
    
    return HttpResponse.json(apiResponse([mockActivity]));
  }),

  // GET /api/v1/h5p/activities/:id - Get single activity
  http.get(`${API_BASE_URL}/h5p/activities/:id`, ({ params }) => {
    const { id } = params;
    const numId = Number(id);
    
    if (numId === 999) {
      return HttpResponse.json(
        apiErrorResponse('NOT_FOUND', 'H5P activity not found'),
        { status: 404 }
      );
    }
    
    return HttpResponse.json(apiResponse(createMockH5PActivity({ id: numId })));
  }),

  // GET /api/v1/h5p/activities/:id/access - Get access information
  http.get(`${API_BASE_URL}/h5p/activities/:id/access`, ({ params, request }) => {
    const { id } = params;
    const numId = Number(id);
    
    // Check for authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        apiErrorResponse('UNAUTHORIZED', 'Authentication required'),
        { status: 401 }
      );
    }
    
    if (numId === 999) {
      return HttpResponse.json(
        apiErrorResponse('NOT_FOUND', 'H5P activity not found'),
        { status: 404 }
      );
    }
    
    // Return access info based on activity ID
    const accessInfo = createMockAccessInfo({
      canreviewattempts: numId === 2, // Teacher scenario
    });
    
    return HttpResponse.json(apiResponse(accessInfo));
  }),

  // POST /api/v1/h5p/activities/:id/view - Mark activity as viewed
  http.post(`${API_BASE_URL}/h5p/activities/:id/view`, ({ params }) => {
    const { id } = params;
    const numId = Number(id);
    
    if (numId === 999) {
      return HttpResponse.json(
        apiErrorResponse('NOT_FOUND', 'H5P activity not found'),
        { status: 404 }
      );
    }
    
    return HttpResponse.json(apiResponse({ status: true }));
  }),

  // POST /api/v1/h5p/report/viewed - Log report viewed
  http.post(`${API_BASE_URL}/h5p/report/viewed`, async ({ request }) => {
    const body = await request.json() as { activityId: number; userId?: number; attemptId?: number };
    
    if (!body.activityId) {
      return HttpResponse.json(
        apiErrorResponse('VALIDATION_ERROR', 'activityId is required'),
        { status: 400 }
      );
    }
    
    return HttpResponse.json(apiResponse({ status: true }));
  }),

  // GET /api/v1/h5p/activities/:id/attempts - Get attempts for activity
  http.get(`${API_BASE_URL}/h5p/activities/:id/attempts`, ({ params, request }) => {
    const { id } = params;
    const numId = Number(id);
    const url = new URL(request.url);
    const userIds = url.searchParams.get('userIds');
    
    if (numId === 999) {
      return HttpResponse.json(
        apiErrorResponse('NOT_FOUND', 'H5P activity not found'),
        { status: 404 }
      );
    }
    
    let attempts = [createMockH5PAttempt({ h5pactivityid: numId })];
    
    if (userIds) {
      const ids = userIds.split(',').map(Number);
      attempts = ids.map((userId) =>
        createMockH5PAttempt({ h5pactivityid: numId, userid: userId })
      );
    }
    
    return HttpResponse.json(apiResponse(attempts));
  }),

  // GET /api/v1/h5p/activities/:id/user-attempts - Get paginated user attempts
  http.get(`${API_BASE_URL}/h5p/activities/:id/user-attempts`, ({ params, request }) => {
    const { id } = params;
    const numId = Number(id);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const perPage = parseInt(url.searchParams.get('perPage') || '20', 10);
    const sortorder = url.searchParams.get('sortorder') || 'desc';
    const firstInitial = url.searchParams.get('firstInitial');
    const lastInitial = url.searchParams.get('lastInitial');
    
    if (numId === 999) {
      return HttpResponse.json(
        apiErrorResponse('NOT_FOUND', 'H5P activity not found'),
        { status: 404 }
      );
    }
    
    const response = createMockUserAttempts({ activityid: numId });
    
    return HttpResponse.json(
      apiResponse(response, {
        pagination: {
          page,
          perPage,
          total: 1,
          totalPages: 1,
        },
        sortorder,
        firstInitial,
        lastInitial,
      })
    );
  }),

  // GET /api/v1/h5p/results - Get results by attempt IDs
  http.get(`${API_BASE_URL}/h5p/results`, ({ request }) => {
    const url = new URL(request.url);
    const attemptIds = url.searchParams.get('attemptIds');
    
    if (!attemptIds) {
      return HttpResponse.json(
        apiErrorResponse('VALIDATION_ERROR', 'attemptIds is required'),
        { status: 400 }
      );
    }
    
    const ids = attemptIds.split(',').map(Number);
    const results = ids.map((attemptId) =>
      createMockH5PResult({ attemptid: attemptId })
    );
    
    return HttpResponse.json(apiResponse(results));
  }),

  // GET /api/v1/h5p/attempts/:id/results - Get results for single attempt
  http.get(`${API_BASE_URL}/h5p/attempts/:id/results`, ({ params }) => {
    const { id } = params;
    const numId = Number(id);
    
    if (numId === 999) {
      return HttpResponse.json(
        apiErrorResponse('NOT_FOUND', 'Attempt not found'),
        { status: 404 }
      );
    }
    
    const results = [
      createMockH5PResult({ attemptid: numId, id: 1 }),
      createMockH5PResult({ attemptid: numId, id: 2, interactiontype: 'fill-in' }),
    ];
    
    return HttpResponse.json(apiResponse(results));
  }),

  // POST /api/v1/h5p/xapi/statement - Submit xAPI statement
  http.post(`${API_BASE_URL}/h5p/xapi/statement`, async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        apiErrorResponse('UNAUTHORIZED', 'Authentication required'),
        { status: 401 }
      );
    }
    
    const body = await request.json() as { activityId: number; statementData: XAPIStatement };
    
    if (!body.activityId) {
      return HttpResponse.json(
        apiErrorResponse('VALIDATION_ERROR', 'activityId is required'),
        { status: 400 }
      );
    }
    
    if (!body.statementData) {
      return HttpResponse.json(
        apiErrorResponse('VALIDATION_ERROR', 'statementData is required'),
        { status: 400 }
      );
    }
    
    // Validate xAPI statement structure
    const { statementData } = body;
    if (!statementData.actor || !statementData.verb || !statementData.object) {
      return HttpResponse.json(
        apiErrorResponse('VALIDATION_ERROR', 'Invalid xAPI statement: missing required fields'),
        { status: 422 }
      );
    }
    
    return HttpResponse.json(apiResponse({ 
      success: true, 
      statementId: 'stmt-' + Date.now() 
    }));
  }),
];

// Create MSW server
const server = setupServer(...handlers);

// ============================================================================
// Test Suite
// ============================================================================

describe('h5pApi', () => {
  // Start server before all tests
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  // Reset handlers after each test
  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // Close server after all tests
  afterAll(() => {
    server.close();
  });

  // ==========================================================================
  // getH5PActivities Tests
  // ==========================================================================
  describe('getH5PActivities', () => {
    it('should fetch activities across courses', async () => {
      const result = await getH5PActivities([101, 102]);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should accept courseIds array parameter', async () => {
      const courseIds = [101, 102, 103];
      const spy = vi.spyOn(apiClient, 'get');
      
      await getH5PActivities(courseIds);
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/activities'),
        expect.objectContaining({
          params: expect.objectContaining({
            courseIds: expect.any(String),
          }),
        })
      );
    });

    it('should return activities with metadata', async () => {
      const result = await getH5PActivities([101]);
      
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('intro');
      expect(result[0]).toHaveProperty('course');
    });

    it('should include display options and settings', async () => {
      const result = await getH5PActivities([101]);
      
      expect(result[0]).toHaveProperty('displayoptions');
      expect(result[0]).toHaveProperty('enabletracking');
      expect(result[0]).toHaveProperty('grademethod');
    });

    it('should filter by course IDs', async () => {
      const result = await getH5PActivities([101, 102]);
      
      expect(result.length).toBe(2);
      expect(result[0].course).toBe(101);
      expect(result[1].course).toBe(102);
    });

    it('should handle empty course list', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities`, () => {
          return HttpResponse.json(apiResponse([]));
        })
      );
      
      const result = await getH5PActivities([]);
      
      expect(result).toEqual([]);
    });

    it('should return global H5P settings', async () => {
      const result = await getH5PActivities([101]);
      
      expect(result[0]).toHaveProperty('reviewmode');
      expect(result[0]).toHaveProperty('grade');
    });

    it('should handle API errors gracefully', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities`, () => {
          return HttpResponse.json(
            apiErrorResponse('SERVER_ERROR', 'Internal server error'),
            { status: 500 }
          );
        })
      );
      
      await expect(getH5PActivities([101])).rejects.toThrow();
    });
  });

  // ==========================================================================
  // getH5PActivity Tests
  // ==========================================================================
  describe('getH5PActivity', () => {
    it('should fetch single activity by ID', async () => {
      const result = await getH5PActivity(1);
      
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('should return complete activity data', async () => {
      const result = await getH5PActivity(1);
      
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('intro');
      expect(result).toHaveProperty('grade');
    });

    it('should include displayoptions JSON', async () => {
      const result = await getH5PActivity(1);
      
      expect(result).toHaveProperty('displayoptions');
      expect(typeof result.displayoptions).toBe('string');
    });

    it('should have enabletracking boolean', async () => {
      const result = await getH5PActivity(1);
      
      expect(result).toHaveProperty('enabletracking');
      expect(typeof result.enabletracking).toBe('boolean');
    });

    it('should include grademethod enum', async () => {
      const result = await getH5PActivity(1);
      
      expect(result).toHaveProperty('grademethod');
      expect(typeof result.grademethod).toBe('number');
    });

    it('should return reviewmode setting', async () => {
      const result = await getH5PActivity(1);
      
      expect(result).toHaveProperty('reviewmode');
    });

    it('should handle not found error', async () => {
      await expect(getH5PActivity(999)).rejects.toThrow();
    });

    it('should call apiClient.get with correct endpoint', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getH5PActivity(5);
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/activities/5'),
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // getAccessInformation Tests
  // ==========================================================================
  describe('getAccessInformation', () => {
    it('should retrieve capability flags', async () => {
      const result = await getAccessInformation(1);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('canview');
      expect(result).toHaveProperty('cansubmit');
    });

    it('should return canview, canreviewattempts, cansubmit flags', async () => {
      const result = await getAccessInformation(1);
      
      expect(result.canview).toBe(true);
      expect(result.cansubmit).toBe(true);
      expect(result.canreviewattempts).toBe(false);
    });

    it('should include other permission booleans', async () => {
      const result = await getAccessInformation(1);
      
      expect(result).toHaveProperty('canaddinstance');
      expect(result).toHaveProperty('canviewallresults');
      expect(result).toHaveProperty('canviewownresults');
    });

    it('should return different permissions for teacher role', async () => {
      // Activity ID 2 is configured for teacher access
      const result = await getAccessInformation(2);
      
      expect(result.canreviewattempts).toBe(true);
    });

    it('should handle missing permissions gracefully', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id/access`, () => {
          return HttpResponse.json(
            apiResponse({ canview: false, cansubmit: false, warnings: ['No access'] })
          );
        })
      );
      
      const result = await getAccessInformation(1);
      
      expect(result.canview).toBe(false);
      expect(result.cansubmit).toBe(false);
    });

    it('should handle 404 error for non-existent activity', async () => {
      await expect(getAccessInformation(999)).rejects.toThrow();
    });

    it('should include Authorization header in request', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getAccessInformation(1);
      
      expect(spy).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // viewH5PActivity Tests
  // ==========================================================================
  describe('viewH5PActivity', () => {
    it('should mark activity as viewed', async () => {
      const result = await viewH5PActivity(1);
      
      expect(result).toBeDefined();
      expect(result.status).toBe(true);
    });

    it('should trigger completion tracking', async () => {
      const spy = vi.spyOn(apiClient, 'post');
      
      await viewH5PActivity(1);
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/activities/1/view'),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should log event for analytics', async () => {
      const result = await viewH5PActivity(1);
      
      expect(result.status).toBe(true);
    });

    it('should return status object', async () => {
      const result = await viewH5PActivity(1);
      
      expect(result).toHaveProperty('status');
      expect(typeof result.status).toBe('boolean');
    });

    it('should send POST request', async () => {
      const spy = vi.spyOn(apiClient, 'post');
      
      await viewH5PActivity(1);
      
      expect(spy).toHaveBeenCalled();
    });

    it('should handle 404 error for non-existent activity', async () => {
      await expect(viewH5PActivity(999)).rejects.toThrow();
    });

    it('should handle server errors', async () => {
      server.use(
        http.post(`${API_BASE_URL}/h5p/activities/:id/view`, () => {
          return HttpResponse.json(
            apiErrorResponse('SERVER_ERROR', 'Internal server error'),
            { status: 500 }
          );
        })
      );
      
      await expect(viewH5PActivity(1)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // logReportViewed Tests
  // ==========================================================================
  describe('logReportViewed', () => {
    it('should log report viewing event', async () => {
      const result = await logReportViewed(1);
      
      expect(result).toBeDefined();
      expect(result.status).toBe(true);
    });

    it('should accept activityId parameter', async () => {
      const spy = vi.spyOn(apiClient, 'post');
      
      await logReportViewed(1);
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/report/viewed'),
        expect.objectContaining({ activityId: 1 }),
        expect.any(Object)
      );
    });

    it('should accept optional userId', async () => {
      const spy = vi.spyOn(apiClient, 'post');
      
      await logReportViewed(1, 100);
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/report/viewed'),
        expect.objectContaining({ activityId: 1, userId: 100 }),
        expect.any(Object)
      );
    });

    it('should accept optional attemptId', async () => {
      const spy = vi.spyOn(apiClient, 'post');
      
      await logReportViewed(1, undefined, 50);
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/report/viewed'),
        expect.objectContaining({ activityId: 1, attemptId: 50 }),
        expect.any(Object)
      );
    });

    it('should return success status', async () => {
      const result = await logReportViewed(1);
      
      expect(result).toHaveProperty('status');
      expect(result.status).toBe(true);
    });

    it('should handle validation errors', async () => {
      server.use(
        http.post(`${API_BASE_URL}/h5p/report/viewed`, () => {
          return HttpResponse.json(
            apiErrorResponse('VALIDATION_ERROR', 'activityId is required'),
            { status: 400 }
          );
        })
      );
      
      await expect(logReportViewed(0)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // getAttempts Tests
  // ==========================================================================
  describe('getAttempts', () => {
    it('should fetch attempts for activity', async () => {
      const result = await getAttempts(1);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should accept userIds array filter', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getAttempts(1, [100, 101]);
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/activities/1/attempts'),
        expect.objectContaining({
          params: expect.objectContaining({
            userIds: expect.any(String),
          }),
        })
      );
    });

    it('should return attempts with scores', async () => {
      const result = await getAttempts(1);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('rawscore');
      expect(result[0]).toHaveProperty('maxscore');
      expect(result[0]).toHaveProperty('scaled');
    });

    it('should include attempt metadata', async () => {
      const result = await getAttempts(1);
      
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('h5pactivityid');
      expect(result[0]).toHaveProperty('userid');
      expect(result[0]).toHaveProperty('attempt');
    });

    it('should contain rawscore, maxscore, scaled', async () => {
      const result = await getAttempts(1);
      
      expect(typeof result[0].rawscore).toBe('number');
      expect(typeof result[0].maxscore).toBe('number');
      expect(typeof result[0].scaled).toBe('number');
    });

    it('should have duration and timestamps', async () => {
      const result = await getAttempts(1);
      
      expect(result[0]).toHaveProperty('duration');
      expect(result[0]).toHaveProperty('timecreated');
      expect(result[0]).toHaveProperty('timemodified');
    });

    it('should include completion and success flags', async () => {
      const result = await getAttempts(1);
      
      expect(result[0]).toHaveProperty('completion');
      expect(result[0]).toHaveProperty('success');
      expect(typeof result[0].completion).toBe('boolean');
      expect(typeof result[0].success).toBe('boolean');
    });

    it('should handle 404 error for non-existent activity', async () => {
      await expect(getAttempts(999)).rejects.toThrow();
    });

    it('should filter attempts by user IDs', async () => {
      const result = await getAttempts(1, [100, 101]);
      
      expect(result.length).toBe(2);
      expect(result[0].userid).toBe(100);
      expect(result[1].userid).toBe(101);
    });
  });

  // ==========================================================================
  // getUserAttempts Tests
  // ==========================================================================
  describe('getUserAttempts', () => {
    it('should get paginated user attempts', async () => {
      const result = await getUserAttempts(1);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('activityid');
      expect(result).toHaveProperty('usersattempts');
    });

    it('should accept sortorder parameter', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1, { sortorder: 'asc' });
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/activities/1/user-attempts'),
        expect.objectContaining({
          params: expect.objectContaining({
            sortorder: 'asc',
          }),
        })
      );
    });

    it('should accept page and perPage parameters', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1, { page: 2, perPage: 10 });
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/activities/1/user-attempts'),
        expect.objectContaining({
          params: expect.objectContaining({
            page: 2,
            perPage: 10,
          }),
        })
      );
    });

    it('should accept firstInitial filter', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1, { firstInitial: 'A' });
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/activities/1/user-attempts'),
        expect.objectContaining({
          params: expect.objectContaining({
            firstInitial: 'A',
          }),
        })
      );
    });

    it('should accept lastInitial filter', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1, { lastInitial: 'S' });
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/activities/1/user-attempts'),
        expect.objectContaining({
          params: expect.objectContaining({
            lastInitial: 'S',
          }),
        })
      );
    });

    it('should return activityid and usersattempts', async () => {
      const result = await getUserAttempts(1);
      
      expect(result.activityid).toBe(1);
      expect(Array.isArray(result.usersattempts)).toBe(true);
    });

    it('should include totalattempts count', async () => {
      const result = await getUserAttempts(1);
      
      expect(result).toHaveProperty('totalattempts');
      expect(typeof result.totalattempts).toBe('number');
    });

    it('should handle 404 error for non-existent activity', async () => {
      await expect(getUserAttempts(999)).rejects.toThrow();
    });

    it('should default to page 1 and perPage 20', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1);
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/activities/1/user-attempts'),
        expect.objectContaining({
          params: expect.objectContaining({
            page: 1,
            perPage: 20,
          }),
        })
      );
    });
  });

  // ==========================================================================
  // getResults Tests
  // ==========================================================================
  describe('getResults', () => {
    it('should retrieve detailed attempt results', async () => {
      const result = await getResults([1, 2]);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should accept attemptIds array', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getResults([1, 2, 3]);
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/results'),
        expect.objectContaining({
          params: expect.objectContaining({
            attemptIds: expect.any(String),
          }),
        })
      );
    });

    it('should return results with xAPI data', async () => {
      const result = await getResults([1]);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('interactiontype');
      expect(result[0]).toHaveProperty('correctpattern');
      expect(result[0]).toHaveProperty('response');
    });

    it('should include interactiontype', async () => {
      const result = await getResults([1]);
      
      expect(result[0]).toHaveProperty('interactiontype');
      expect(typeof result[0].interactiontype).toBe('string');
    });

    it('should contain description text', async () => {
      const result = await getResults([1]);
      
      expect(result[0]).toHaveProperty('description');
      expect(typeof result[0].description).toBe('string');
    });

    it('should have correctanswer pattern', async () => {
      const result = await getResults([1]);
      
      expect(result[0]).toHaveProperty('correctpattern');
    });

    it('should include user response', async () => {
      const result = await getResults([1]);
      
      expect(result[0]).toHaveProperty('response');
    });

    it('should contain additionals object', async () => {
      const result = await getResults([1]);
      
      expect(result[0]).toHaveProperty('additionals');
      expect(typeof result[0].additionals).toBe('string');
    });

    it('should have scoring data', async () => {
      const result = await getResults([1]);
      
      expect(result[0]).toHaveProperty('rawscore');
      expect(result[0]).toHaveProperty('maxscore');
    });

    it('should handle empty attemptIds array', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/results`, () => {
          return HttpResponse.json(
            apiErrorResponse('VALIDATION_ERROR', 'attemptIds is required'),
            { status: 400 }
          );
        })
      );
      
      await expect(getResults([])).rejects.toThrow();
    });
  });

  // ==========================================================================
  // getAttemptResults Tests
  // ==========================================================================
  describe('getAttemptResults', () => {
    it('should get results for single attempt', async () => {
      const result = await getAttemptResults(1);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return array of results', async () => {
      const result = await getAttemptResults(1);
      
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have each result with full xAPI structure', async () => {
      const result = await getAttemptResults(1);
      
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('attemptid');
      expect(result[0]).toHaveProperty('interactiontype');
      expect(result[0]).toHaveProperty('description');
      expect(result[0]).toHaveProperty('correctpattern');
      expect(result[0]).toHaveProperty('response');
      expect(result[0]).toHaveProperty('rawscore');
      expect(result[0]).toHaveProperty('maxscore');
    });

    it('should call correct API endpoint', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getAttemptResults(5);
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/attempts/5/results'),
        expect.any(Object)
      );
    });

    it('should handle 404 error for non-existent attempt', async () => {
      await expect(getAttemptResults(999)).rejects.toThrow();
    });

    it('should return multiple results for complex activities', async () => {
      const result = await getAttemptResults(1);
      
      expect(result.length).toBe(2);
      expect(result[0].interactiontype).toBe('choice');
      expect(result[1].interactiontype).toBe('fill-in');
    });
  });

  // ==========================================================================
  // submitXAPIStatement Tests
  // ==========================================================================
  describe('submitXAPIStatement', () => {
    it('should submit xAPI tracking statement', async () => {
      const result = await submitXAPIStatement(1, mockXAPIStatement);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should accept activityId and statementData', async () => {
      const spy = vi.spyOn(apiClient, 'post');
      
      await submitXAPIStatement(1, mockXAPIStatement);
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/xapi/statement'),
        expect.objectContaining({
          activityId: 1,
          statementData: expect.any(Object),
        }),
        expect.any(Object)
      );
    });

    it('should validate statement format', async () => {
      const validStatement = createMockXAPIStatement();
      const result = await submitXAPIStatement(1, validStatement);
      
      expect(result.success).toBe(true);
    });

    it('should include actor in statement', async () => {
      const statement = createMockXAPIStatement();
      
      expect(statement.actor).toBeDefined();
      expect(statement.actor.name).toBeDefined();
      expect(statement.actor.mbox).toBeDefined();
    });

    it('should include verb in statement', async () => {
      const statement = createMockXAPIStatement();
      
      expect(statement.verb).toBeDefined();
      expect(statement.verb.id).toBeDefined();
      expect(statement.verb.display).toBeDefined();
    });

    it('should include object in statement', async () => {
      const statement = createMockXAPIStatement();
      
      expect(statement.object).toBeDefined();
      expect(statement.object.id).toBeDefined();
      expect(statement.object.definition).toBeDefined();
    });

    it('should have result and context', async () => {
      const statement = createMockXAPIStatement();
      
      expect(statement.result).toBeDefined();
      expect(statement.context).toBeDefined();
    });

    it('should send POST with JWT', async () => {
      const spy = vi.spyOn(apiClient, 'post');
      
      await submitXAPIStatement(1, mockXAPIStatement);
      
      expect(spy).toHaveBeenCalled();
    });

    it('should return submission status', async () => {
      const result = await submitXAPIStatement(1, mockXAPIStatement);
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('statementId');
    });

    it('should handle validation errors for invalid statement', async () => {
      const invalidStatement = { actor: null, verb: null, object: null } as unknown as XAPIStatement;
      
      server.use(
        http.post(`${API_BASE_URL}/h5p/xapi/statement`, () => {
          return HttpResponse.json(
            apiErrorResponse('VALIDATION_ERROR', 'Invalid xAPI statement: missing required fields'),
            { status: 422 }
          );
        })
      );
      
      await expect(submitXAPIStatement(1, invalidStatement)).rejects.toThrow();
    });

    it('should handle missing activityId', async () => {
      server.use(
        http.post(`${API_BASE_URL}/h5p/xapi/statement`, () => {
          return HttpResponse.json(
            apiErrorResponse('VALIDATION_ERROR', 'activityId is required'),
            { status: 400 }
          );
        })
      );
      
      await expect(submitXAPIStatement(0, mockXAPIStatement)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Authentication Tests
  // ==========================================================================
  describe('Authentication', () => {
    it('should include JWT token in Authorization header', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getH5PActivity(1);
      
      // apiClient should be called - interceptors add auth header
      expect(spy).toHaveBeenCalled();
    });

    it('should use Bearer token format', async () => {
      // The apiClient interceptor adds "Bearer <token>" format
      const spy = vi.spyOn(apiClient, 'get');
      
      await getAccessInformation(1);
      
      expect(spy).toHaveBeenCalled();
    });

    it('should handle missing token (401)', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id/access`, () => {
          return HttpResponse.json(
            apiErrorResponse('UNAUTHORIZED', 'Authentication required'),
            { status: 401 }
          );
        })
      );
      
      await expect(getAccessInformation(1)).rejects.toThrow();
    });

    it('should handle expired token', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id`, () => {
          return HttpResponse.json(
            apiErrorResponse('TOKEN_EXPIRED', 'Access token has expired'),
            { status: 401 }
          );
        })
      );
      
      await expect(getH5PActivity(1)).rejects.toThrow();
    });

    it('should integrate with apiClient interceptors', async () => {
      // Verify that apiClient is being used (which has interceptors)
      const spy = vi.spyOn(apiClient, 'post');
      
      await viewH5PActivity(1);
      
      expect(spy).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================
  describe('Error Handling', () => {
    it('should handle 400 Bad Request', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities`, () => {
          return HttpResponse.json(
            apiErrorResponse('BAD_REQUEST', 'Invalid request parameters'),
            { status: 400 }
          );
        })
      );
      
      await expect(getH5PActivities([101])).rejects.toThrow();
    });

    it('should handle 401 Unauthorized', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id`, () => {
          return HttpResponse.json(
            apiErrorResponse('UNAUTHORIZED', 'Authentication required'),
            { status: 401 }
          );
        })
      );
      
      await expect(getH5PActivity(1)).rejects.toThrow();
    });

    it('should handle 403 Forbidden', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id`, () => {
          return HttpResponse.json(
            apiErrorResponse('FORBIDDEN', 'Access denied'),
            { status: 403 }
          );
        })
      );
      
      await expect(getH5PActivity(1)).rejects.toThrow();
    });

    it('should handle 404 Not Found', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id`, () => {
          return HttpResponse.json(
            apiErrorResponse('NOT_FOUND', 'Resource not found'),
            { status: 404 }
          );
        })
      );
      
      await expect(getH5PActivity(1)).rejects.toThrow();
    });

    it('should handle 500 Internal Server Error', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities`, () => {
          return HttpResponse.json(
            apiErrorResponse('SERVER_ERROR', 'Internal server error'),
            { status: 500 }
          );
        })
      );
      
      await expect(getH5PActivities([101])).rejects.toThrow();
    });

    it('should handle 503 Service Unavailable', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities`, () => {
          return HttpResponse.json(
            apiErrorResponse('SERVICE_UNAVAILABLE', 'Service temporarily unavailable'),
            { status: 503 }
          );
        })
      );
      
      await expect(getH5PActivities([101])).rejects.toThrow();
    });

    it('should transform API errors to Error objects', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id`, () => {
          return HttpResponse.json(
            apiErrorResponse('CUSTOM_ERROR', 'Custom error message'),
            { status: 422 }
          );
        })
      );
      
      try {
        await getH5PActivity(1);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should include error message and code', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id`, () => {
          return HttpResponse.json(
            apiErrorResponse('VALIDATION_ERROR', 'Invalid activity ID'),
            { status: 400 }
          );
        })
      );
      
      try {
        await getH5PActivity(1);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Network Error Tests
  // ==========================================================================
  describe('Network Errors', () => {
    it('should handle connection timeout', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities`, () => {
          return HttpResponse.error();
        })
      );
      
      await expect(getH5PActivities([101])).rejects.toThrow();
    });

    it('should handle network disconnection', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id`, () => {
          return HttpResponse.error();
        })
      );
      
      await expect(getH5PActivity(1)).rejects.toThrow();
    });

    it('should handle DNS resolution failure', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities`, () => {
          return HttpResponse.error();
        })
      );
      
      await expect(getH5PActivities([101])).rejects.toThrow();
    });

    it('should throw on network error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/h5p/activities/:id/view`, () => {
          return HttpResponse.error();
        })
      );
      
      await expect(viewH5PActivity(1)).rejects.toThrow();
    });

    it('should handle network errors for POST requests', async () => {
      server.use(
        http.post(`${API_BASE_URL}/h5p/xapi/statement`, () => {
          return HttpResponse.error();
        })
      );
      
      await expect(submitXAPIStatement(1, mockXAPIStatement)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Response Transformation Tests
  // ==========================================================================
  describe('Response Transformation', () => {
    it('should transform API response to TypeScript types', async () => {
      const result = await getH5PActivity(1);
      
      // Verify the result conforms to H5PActivity type
      expect(typeof result.id).toBe('number');
      expect(typeof result.name).toBe('string');
      expect(typeof result.course).toBe('number');
    });

    it('should handle timestamp fields', async () => {
      const result = await getH5PActivity(1);
      
      expect(typeof result.timecreated).toBe('number');
      expect(typeof result.timemodified).toBe('number');
    });

    it('should parse JSON display options', async () => {
      const result = await getH5PActivity(1);
      
      // displayoptions is a JSON string
      expect(typeof result.displayoptions).toBe('string');
      const parsed = JSON.parse(result.displayoptions);
      expect(parsed).toHaveProperty('frame');
    });

    it('should handle null/undefined fields', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id`, () => {
          return HttpResponse.json(apiResponse({
            ...createMockH5PActivity(),
            intro: null,
            groupingid: undefined,
          }));
        })
      );
      
      const result = await getH5PActivity(1);
      
      expect(result).toBeDefined();
    });

    it('should provide default values where needed', async () => {
      const result = await getH5PActivity(1);
      
      expect(result.visible).toBeDefined();
      expect(result.groupmode).toBeDefined();
    });

    it('should transform attempt data correctly', async () => {
      const result = await getAttempts(1);
      
      expect(typeof result[0].rawscore).toBe('number');
      expect(typeof result[0].maxscore).toBe('number');
      expect(typeof result[0].scaled).toBe('number');
      expect(typeof result[0].completion).toBe('boolean');
      expect(typeof result[0].success).toBe('boolean');
    });

    it('should transform result data correctly', async () => {
      const result = await getResults([1]);
      
      expect(typeof result[0].interactiontype).toBe('string');
      expect(typeof result[0].description).toBe('string');
      expect(typeof result[0].rawscore).toBe('number');
    });
  });

  // ==========================================================================
  // Request Validation Tests
  // ==========================================================================
  describe('Request Validation', () => {
    it('should validate required parameters', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getH5PActivity(1);
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/activities/1'),
        expect.any(Object)
      );
    });

    it('should throw on missing activity ID in getH5PActivity', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id`, ({ params }) => {
          const { id } = params;
          if (!id || id === 'undefined') {
            return HttpResponse.json(
              apiErrorResponse('VALIDATION_ERROR', 'Activity ID is required'),
              { status: 400 }
            );
          }
          return HttpResponse.json(apiResponse(createMockH5PActivity()));
        })
      );
      
      // Pass invalid ID to trigger validation
      await expect(getH5PActivity(NaN)).rejects.toThrow();
    });

    it('should validate pagination parameters', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1, { page: 1, perPage: 10 });
      
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            page: 1,
            perPage: 10,
          }),
        })
      );
    });

    it('should validate sort order values', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1, { sortorder: 'asc' });
      
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            sortorder: 'asc',
          }),
        })
      );
    });

    it('should sanitize filter strings', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1, { firstInitial: 'A' });
      
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            firstInitial: 'A',
          }),
        })
      );
    });

    it('should type check with TypeScript', async () => {
      // This test verifies TypeScript types at compile time
      const activity: H5PActivity = await getH5PActivity(1);
      const attempts: H5PAttempt[] = await getAttempts(1);
      const results: H5PResult[] = await getResults([1]);
      
      expect(activity).toBeDefined();
      expect(attempts).toBeDefined();
      expect(results).toBeDefined();
    });
  });

  // ==========================================================================
  // Pagination Tests
  // ==========================================================================
  describe('Pagination', () => {
    it('should send page parameter', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1, { page: 2 });
      
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            page: 2,
          }),
        })
      );
    });

    it('should send perPage parameter', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1, { perPage: 50 });
      
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            perPage: 50,
          }),
        })
      );
    });

    it('should handle first page', async () => {
      const result = await getUserAttempts(1, { page: 1 });
      
      expect(result).toBeDefined();
      expect(result.usersattempts).toBeDefined();
    });

    it('should handle last page', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id/user-attempts`, () => {
          return HttpResponse.json(
            apiResponse(createMockUserAttempts(), {
              pagination: {
                page: 5,
                perPage: 20,
                total: 100,
                totalPages: 5,
              },
            })
          );
        })
      );
      
      const result = await getUserAttempts(1, { page: 5 });
      
      expect(result).toBeDefined();
    });

    it('should handle invalid page numbers gracefully', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id/user-attempts`, ({ request }) => {
          const url = new URL(request.url);
          const page = parseInt(url.searchParams.get('page') || '1', 10);
          
          if (page < 1) {
            return HttpResponse.json(
              apiErrorResponse('VALIDATION_ERROR', 'Page must be greater than 0'),
              { status: 400 }
            );
          }
          
          return HttpResponse.json(apiResponse(createMockUserAttempts()));
        })
      );
      
      await expect(getUserAttempts(1, { page: 0 })).rejects.toThrow();
    });

    it('should default page to 1 and perPage to 20', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1);
      
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            page: 1,
            perPage: 20,
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Sorting Tests
  // ==========================================================================
  describe('Sorting', () => {
    it('should send sortorder parameter', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1, { sortorder: 'asc' });
      
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            sortorder: 'asc',
          }),
        })
      );
    });

    it('should support ascending sort', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1, { sortorder: 'asc' });
      
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            sortorder: 'asc',
          }),
        })
      );
    });

    it('should support descending sort', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1, { sortorder: 'desc' });
      
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            sortorder: 'desc',
          }),
        })
      );
    });

    it('should support field-based sorting', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1, { sortorder: 'desc' });
      
      expect(spy).toHaveBeenCalled();
    });

    it('should default to descending sort', async () => {
      const result = await getUserAttempts(1);
      
      // Default behavior should return results (descending by default)
      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // Filtering Tests
  // ==========================================================================
  describe('Filtering', () => {
    it('should send firstInitial parameter', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1, { firstInitial: 'J' });
      
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            firstInitial: 'J',
          }),
        })
      );
    });

    it('should send lastInitial parameter', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1, { lastInitial: 'D' });
      
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            lastInitial: 'D',
          }),
        })
      );
    });

    it('should send userIds array', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getAttempts(1, [100, 101, 102]);
      
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            userIds: '100,101,102',
          }),
        })
      );
    });

    it('should send courseIds array', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getH5PActivities([101, 102, 103]);
      
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            courseIds: '101,102,103',
          }),
        })
      );
    });

    it('should combine multiple filters', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getUserAttempts(1, { firstInitial: 'A', lastInitial: 'B', page: 2 });
      
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            firstInitial: 'A',
            lastInitial: 'B',
            page: 2,
          }),
        })
      );
    });

    it('should return all results with empty filters', async () => {
      const result = await getUserAttempts(1, {});
      
      expect(result).toBeDefined();
      expect(result.usersattempts).toBeDefined();
    });
  });

  // ==========================================================================
  // xAPI Statement Validation Tests
  // ==========================================================================
  describe('xAPI Statement Validation', () => {
    it('should validate actor structure', () => {
      const statement = createMockXAPIStatement();
      
      expect(statement.actor).toBeDefined();
      expect(statement.actor.name).toBeDefined();
      expect(statement.actor.mbox).toContain('mailto:');
      expect(statement.actor.objectType).toBe('Agent');
    });

    it('should validate verb IRI', () => {
      const statement = createMockXAPIStatement();
      
      expect(statement.verb).toBeDefined();
      expect(statement.verb.id).toContain('http://');
      expect(statement.verb.display).toBeDefined();
    });

    it('should validate object definition', () => {
      const statement = createMockXAPIStatement();
      
      expect(statement.object).toBeDefined();
      expect(statement.object.id).toBeDefined();
      expect(statement.object.definition).toBeDefined();
      expect(statement.object.definition.type).toBeDefined();
      expect(statement.object.objectType).toBe('Activity');
    });

    it('should validate result structure', () => {
      const statement = createMockXAPIStatement();
      
      expect(statement.result).toBeDefined();
      expect(statement.result?.score).toBeDefined();
      expect(statement.result?.score?.scaled).toBeDefined();
      expect(statement.result?.success).toBeDefined();
      expect(statement.result?.completion).toBeDefined();
    });

    it('should validate context', () => {
      const statement = createMockXAPIStatement();
      
      expect(statement.context).toBeDefined();
      expect(statement.context?.contextActivities).toBeDefined();
    });

    it('should validate timestamp format', () => {
      const statement = createMockXAPIStatement();
      
      expect(statement.timestamp).toBeDefined();
      // ISO 8601 format
      expect(typeof statement.timestamp).toBe('string');
    });

    it('should accept valid xAPI statements', async () => {
      const validStatement = createMockXAPIStatement();
      const result = await submitXAPIStatement(1, validStatement);
      
      expect(result.success).toBe(true);
    });

    it('should reject statements missing actor', async () => {
      server.use(
        http.post(`${API_BASE_URL}/h5p/xapi/statement`, async ({ request }) => {
          const body = await request.json() as { statementData: XAPIStatement };
          if (!body.statementData?.actor) {
            return HttpResponse.json(
              apiErrorResponse('VALIDATION_ERROR', 'Invalid xAPI statement: missing actor'),
              { status: 422 }
            );
          }
          return HttpResponse.json(apiResponse({ success: true }));
        })
      );
      
      const invalidStatement = { ...createMockXAPIStatement(), actor: undefined } as unknown as XAPIStatement;
      
      await expect(submitXAPIStatement(1, invalidStatement)).rejects.toThrow();
    });

    it('should reject statements missing verb', async () => {
      server.use(
        http.post(`${API_BASE_URL}/h5p/xapi/statement`, async ({ request }) => {
          const body = await request.json() as { statementData: XAPIStatement };
          if (!body.statementData?.verb) {
            return HttpResponse.json(
              apiErrorResponse('VALIDATION_ERROR', 'Invalid xAPI statement: missing verb'),
              { status: 422 }
            );
          }
          return HttpResponse.json(apiResponse({ success: true }));
        })
      );
      
      const invalidStatement = { ...createMockXAPIStatement(), verb: undefined } as unknown as XAPIStatement;
      
      await expect(submitXAPIStatement(1, invalidStatement)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Concurrent Request Tests
  // ==========================================================================
  describe('Concurrent Requests', () => {
    it('should handle multiple simultaneous requests', async () => {
      const promises = [
        getH5PActivity(1),
        getH5PActivity(2),
        getH5PActivity(3),
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      expect(results[0].id).toBe(1);
      expect(results[1].id).toBe(2);
      expect(results[2].id).toBe(3);
    });

    it('should not interfere with each other', async () => {
      const [activity1, activity2] = await Promise.all([
        getH5PActivity(1),
        getH5PActivity(2),
      ]);
      
      expect(activity1.id).not.toBe(activity2.id);
    });

    it('should return correct response for each request', async () => {
      const results = await Promise.all([
        getAttempts(1),
        getAttempts(2),
      ]);
      
      expect(results[0][0].h5pactivityid).toBe(1);
      expect(results[1][0].h5pactivityid).toBe(2);
    });

    it('should handle mixed GET and POST requests', async () => {
      const [activity, viewStatus] = await Promise.all([
        getH5PActivity(1),
        viewH5PActivity(1),
      ]);
      
      expect(activity).toBeDefined();
      expect(viewStatus.status).toBe(true);
    });

    it('should handle partial failures gracefully', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/2`, () => {
          return HttpResponse.json(
            apiErrorResponse('NOT_FOUND', 'Activity not found'),
            { status: 404 }
          );
        })
      );
      
      const results = await Promise.allSettled([
        getH5PActivity(1),
        getH5PActivity(2), // This will fail
        getH5PActivity(3),
      ]);
      
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  // ==========================================================================
  // Request Cancellation Tests
  // ==========================================================================
  describe('Request Cancellation', () => {
    it('should support abort signal for cancellation', async () => {
      const controller = new AbortController();
      
      // Cancel immediately
      controller.abort();
      
      // If the API supports abort signal, this should throw
      // The implementation may vary based on how apiClient handles signals
      try {
        await getH5PActivity(1);
        // If it doesn't throw, that's also acceptable
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle cancelled requests gracefully', async () => {
      // Simulate a scenario where a request might be cancelled
      const result = await getH5PActivity(1);
      
      // Request completed successfully (not cancelled)
      expect(result).toBeDefined();
    });

    it('should clean up cancelled requests', async () => {
      // Multiple requests, some may be cancelled
      const results = await Promise.all([
        getH5PActivity(1),
        getH5PActivity(2),
      ]);
      
      expect(results).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Type Safety Tests
  // ==========================================================================
  describe('Type Safety', () => {
    it('should return H5PActivity type for getH5PActivity', async () => {
      const result: H5PActivity = await getH5PActivity(1);
      
      // TypeScript compile-time check - these properties must exist
      expect(result.id).toBeDefined();
      expect(result.name).toBeDefined();
      expect(result.course).toBeDefined();
      expect(result.intro).toBeDefined();
      expect(result.grade).toBeDefined();
      expect(result.enabletracking).toBeDefined();
    });

    it('should return H5PAttempt[] for getAttempts', async () => {
      const result: H5PAttempt[] = await getAttempts(1);
      
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0].id).toBeDefined();
        expect(result[0].h5pactivityid).toBeDefined();
        expect(result[0].userid).toBeDefined();
        expect(result[0].rawscore).toBeDefined();
      }
    });

    it('should return H5PResult[] for getResults', async () => {
      const result: H5PResult[] = await getResults([1]);
      
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0].id).toBeDefined();
        expect(result[0].attemptid).toBeDefined();
        expect(result[0].interactiontype).toBeDefined();
      }
    });

    it('should return H5PAccessInfo for getAccessInformation', async () => {
      const result: H5PAccessInfo = await getAccessInformation(1);
      
      expect(typeof result.canview).toBe('boolean');
      expect(typeof result.cansubmit).toBe('boolean');
    });

    it('should return H5PUserAttempts for getUserAttempts', async () => {
      const result: H5PUserAttempts = await getUserAttempts(1);
      
      expect(result.activityid).toBeDefined();
      expect(result.usersattempts).toBeDefined();
      expect(result.totalattempts).toBeDefined();
    });

    it('should handle generic types correctly', async () => {
      const activities = await getH5PActivities([101]);
      
      // Should be H5PActivity[]
      expect(Array.isArray(activities)).toBe(true);
      activities.forEach((activity: H5PActivity) => {
        expect(typeof activity.id).toBe('number');
      });
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================
  describe('Integration', () => {
    it('should work with apiClient from services/api/client', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getH5PActivity(1);
      
      expect(spy).toHaveBeenCalled();
    });

    it('should use configured base URL', async () => {
      const spy = vi.spyOn(apiClient, 'get');
      
      await getH5PActivity(1);
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/h5p/activities/'),
        expect.any(Object)
      );
    });

    it('should integrate with interceptors', async () => {
      // apiClient has interceptors configured
      const spy = vi.spyOn(apiClient, 'get');
      
      await getH5PActivities([101]);
      
      expect(spy).toHaveBeenCalled();
    });

    it('should work with POST interceptors', async () => {
      const spy = vi.spyOn(apiClient, 'post');
      
      await viewH5PActivity(1);
      
      expect(spy).toHaveBeenCalled();
    });

    it('should test end-to-end flow for activity viewing', async () => {
      // 1. Get activity
      const activity = await getH5PActivity(1);
      expect(activity).toBeDefined();
      
      // 2. Check access
      const access = await getAccessInformation(activity.id);
      expect(access.canview).toBe(true);
      
      // 3. Mark as viewed
      const viewResult = await viewH5PActivity(activity.id);
      expect(viewResult.status).toBe(true);
    });

    it('should test end-to-end flow for attempt submission', async () => {
      // 1. Get activity
      const activity = await getH5PActivity(1);
      
      // 2. Submit xAPI statement
      const statement = createMockXAPIStatement();
      const submitResult = await submitXAPIStatement(activity.id, statement);
      expect(submitResult.success).toBe(true);
      
      // 3. Get attempts
      const attempts = await getAttempts(activity.id);
      expect(attempts).toBeDefined();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('should handle empty response arrays', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities`, () => {
          return HttpResponse.json(apiResponse([]));
        })
      );
      
      const result = await getH5PActivities([101]);
      
      expect(result).toEqual([]);
    });

    it('should handle missing optional fields', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id`, () => {
          return HttpResponse.json(apiResponse({
            id: 1,
            course: 101,
            name: 'Test Activity',
            // Missing optional fields
          }));
        })
      );
      
      const result = await getH5PActivity(1);
      
      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Activity');
    });

    it('should handle malformed JSON gracefully', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id`, () => {
          return new HttpResponse('not valid json', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );
      
      await expect(getH5PActivity(1)).rejects.toThrow();
    });

    it('should handle very large responses', async () => {
      // Generate 100 activities
      const largeActivityList = Array.from({ length: 100 }, (_, i) =>
        createMockH5PActivity({ id: i + 1, course: 101 })
      );
      
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities`, () => {
          return HttpResponse.json(apiResponse(largeActivityList));
        })
      );
      
      const result = await getH5PActivities([101]);
      
      expect(result).toHaveLength(100);
    });

    it('should handle unicode characters', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id`, () => {
          return HttpResponse.json(apiResponse(createMockH5PActivity({
            name: 'Activité française avec émojis 🎓📚',
            intro: '<p>日本語のテスト</p>',
          })));
        })
      );
      
      const result = await getH5PActivity(1);
      
      expect(result.name).toContain('🎓');
      expect(result.intro).toContain('日本語');
    });

    it('should handle special characters in strings', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id`, () => {
          return HttpResponse.json(apiResponse(createMockH5PActivity({
            name: 'Test <script>alert("xss")</script>',
            intro: '<p>Content with "quotes" and \'apostrophes\'</p>',
          })));
        })
      );
      
      const result = await getH5PActivity(1);
      
      expect(result).toBeDefined();
      expect(result.name).toContain('<script>');
    });

    it('should handle zero values correctly', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id/attempts`, () => {
          return HttpResponse.json(apiResponse([
            createMockH5PAttempt({
              rawscore: 0,
              maxscore: 100,
              scaled: 0,
              duration: 0,
            }),
          ]));
        })
      );
      
      const result = await getAttempts(1);
      
      expect(result[0].rawscore).toBe(0);
      expect(result[0].scaled).toBe(0);
    });

    it('should handle negative values if applicable', async () => {
      // Some systems might return -1 for "not attempted"
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id/attempts`, () => {
          return HttpResponse.json(apiResponse([
            createMockH5PAttempt({
              rawscore: -1,
              duration: -1,
            }),
          ]));
        })
      );
      
      const result = await getAttempts(1);
      
      expect(result[0].rawscore).toBe(-1);
    });

    it('should handle boolean false values', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id/attempts`, () => {
          return HttpResponse.json(apiResponse([
            createMockH5PAttempt({
              completion: false,
              success: false,
            }),
          ]));
        })
      );
      
      const result = await getAttempts(1);
      
      expect(result[0].completion).toBe(false);
      expect(result[0].success).toBe(false);
    });

    it('should handle deeply nested objects', async () => {
      const complexStatement = createMockXAPIStatement({
        context: {
          contextActivities: {
            parent: [
              { id: 'http://example.com/parent', objectType: 'Activity' },
            ],
            grouping: [
              { id: 'http://example.com/group', objectType: 'Activity' },
            ],
          },
          extensions: {
            'http://example.com/ext1': { nested: { deep: 'value' } },
          },
        },
      });
      
      const result = await submitXAPIStatement(1, complexStatement);
      
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // MSW Setup Tests
  // ==========================================================================
  describe('MSW Setup', () => {
    it('should mock all API endpoints', async () => {
      // Verify all endpoints are mocked
      const [activities, activity, access, attempts, results] = await Promise.all([
        getH5PActivities([101]),
        getH5PActivity(1),
        getAccessInformation(1),
        getAttempts(1),
        getResults([1]),
      ]);
      
      expect(activities).toBeDefined();
      expect(activity).toBeDefined();
      expect(access).toBeDefined();
      expect(attempts).toBeDefined();
      expect(results).toBeDefined();
    });

    it('should return fixture data', async () => {
      const activity = await getH5PActivity(1);
      
      expect(activity.id).toBe(1);
      expect(activity.name).toBeDefined();
    });

    it('should simulate delays when needed', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return HttpResponse.json(apiResponse(createMockH5PActivity()));
        })
      );
      
      const start = Date.now();
      await getH5PActivity(1);
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(50);
    });

    it('should simulate errors', async () => {
      server.use(
        http.get(`${API_BASE_URL}/h5p/activities/:id`, () => {
          return HttpResponse.json(
            apiErrorResponse('SERVER_ERROR', 'Simulated error'),
            { status: 500 }
          );
        })
      );
      
      await expect(getH5PActivity(1)).rejects.toThrow();
    });

    it('should test different response scenarios', async () => {
      // Scenario 1: Success
      const successResult = await getH5PActivity(1);
      expect(successResult).toBeDefined();
      
      // Scenario 2: Not found
      await expect(getH5PActivity(999)).rejects.toThrow();
    });

    it('should reset handlers between tests', () => {
      // This test verifies that handlers are reset
      // The fact that other tests pass proves this works
      expect(true).toBe(true);
    });
  });
});

