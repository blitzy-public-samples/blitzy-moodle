/**
 * @file gradebookApi.test.ts
 * @description Comprehensive unit tests for gradebook API integration layer.
 * 
 * Tests API client methods for:
 * - Fetching course grades (getCourseGrades)
 * - Fetching user grades (getUserGrades)
 * - Fetching grade items (getGradeItems)
 * - Updating grade items (updateGradeItem)
 * - Fetching categories (getGradeCategories)
 * - Updating grades (updateGrade)
 * - Exporting grades (exportGrades)
 * - Generating reports (getGradeReport)
 * 
 * Validates request parameters, response data structure, error handling,
 * pagination, filtering, and proper authorization header inclusion.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse, delay } from 'msw';

// Internal imports - API functions under test
import {
  getCourseGrades,
  getUserGrades,
  getGradeItems,
  updateGradeItem,
  getGradeCategories,
  updateGrade,
  exportGrades,
  getGradeReport,
} from '@/features/gradebook/api/gradebookApi';

// Internal imports - Types
import type { Grade, GradeItem } from '@/types/entities';
import type { ApiResponse } from '@/types/api';

// Internal imports - Mock data factories
import {
  mockGrade,
  mockGradeItem,
  mockGradeArray,
  mockGradeItemArray,
  mockCourseGradebook,
} from '@/tests/mocks/data/grades';

// Internal imports - MSW server
import { server } from '@/tests/mocks/server';

// API base URL for MSW handlers
const API_BASE_URL = 'http://localhost:3000/api/v1';

/**
 * Test suite for gradebook API integration layer.
 * Uses MSW (Mock Service Worker) to intercept HTTP requests and provide
 * controlled responses for testing various scenarios including:
 * - Successful operations
 * - Validation errors (400)
 * - Permission errors (403)
 * - Not found errors (404)
 * - Server errors (500)
 * - Network failures
 */
describe('Gradebook API', () => {
  // Setup MSW server lifecycle
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    server.resetHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // getCourseGrades Tests
  // ============================================================================
  describe('getCourseGrades', () => {
    const courseId = 1;
    const mockGradebook = mockCourseGradebook(courseId);

    describe('successful requests', () => {
      it('should fetch course grades successfully', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/course/:courseId`, ({ params }) => {
            expect(params.courseId).toBe(String(courseId));
            return HttpResponse.json({
              success: true,
              data: {
                courseId: Number(params.courseId),
                items: mockGradebook.items,
                grades: mockGradebook.grades,
                aggregation: {
                  method: 'weighted_mean',
                  total: 85.5,
                },
              },
              meta: {
                timestamp: new Date().toISOString(),
              },
            });
          })
        );

        const result = await getCourseGrades(courseId);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.courseId).toBe(courseId);
          expect(result.data.items).toBeDefined();
          expect(result.data.grades).toBeDefined();
          expect(Array.isArray(result.data.items)).toBe(true);
        }
      });

      it('should include user IDs in query parameters when provided', async () => {
        const userIds = [1, 2, 3];
        let capturedUrl: URL | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/course/:courseId`, ({ request }) => {
            capturedUrl = new URL(request.url);
            return HttpResponse.json({
              success: true,
              data: {
                courseId,
                items: mockGradebook.items,
                grades: mockGradebook.grades.filter((g) => userIds.includes(g.userid)),
              },
            });
          })
        );

        await getCourseGrades(courseId, { userIds });

        expect(capturedUrl).not.toBeNull();
        const userIdsParam = capturedUrl!.searchParams.get('userIds');
        expect(userIdsParam).toBe(userIds.join(','));
      });

      it('should include authorization header in request', async () => {
        let capturedAuthHeader: string | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/course/:courseId`, ({ request }) => {
            capturedAuthHeader = request.headers.get('Authorization');
            return HttpResponse.json({
              success: true,
              data: {
                courseId,
                items: mockGradebook.items,
                grades: mockGradebook.grades,
              },
            });
          })
        );

        await getCourseGrades(courseId);

        // JWT token should be included via apiClient interceptors
        expect(capturedAuthHeader).not.toBeNull();
      });

      it('should handle pagination parameters', async () => {
        let capturedUrl: URL | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/course/:courseId`, ({ request }) => {
            capturedUrl = new URL(request.url);
            return HttpResponse.json({
              success: true,
              data: {
                courseId,
                items: mockGradebook.items,
                grades: mockGradebook.grades,
              },
              meta: {
                pagination: {
                  page: 1,
                  perPage: 20,
                  total: 100,
                  totalPages: 5,
                },
              },
            });
          })
        );

        await getCourseGrades(courseId, { page: 1, perPage: 20 });

        expect(capturedUrl).not.toBeNull();
        expect(capturedUrl!.searchParams.get('page')).toBe('1');
        expect(capturedUrl!.searchParams.get('perPage')).toBe('20');
      });

      it('should return correct TypeScript types', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/course/:courseId`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                courseId,
                items: mockGradebook.items,
                grades: mockGradebook.grades,
              },
            });
          })
        );

        const result = await getCourseGrades(courseId);

        expect(result.success).toBe(true);
        if (result.success) {
          // Verify grade item structure
          result.data.items.forEach((item: GradeItem) => {
            expect(item).toHaveProperty('id');
            expect(item).toHaveProperty('courseid');
            expect(item).toHaveProperty('itemname');
            expect(item).toHaveProperty('grademax');
            expect(item).toHaveProperty('grademin');
          });

          // Verify grade structure
          result.data.grades.forEach((grade: Grade) => {
            expect(grade).toHaveProperty('id');
            expect(grade).toHaveProperty('itemid');
            expect(grade).toHaveProperty('userid');
            expect(grade).toHaveProperty('finalgrade');
          });
        }
      });
    });

    describe('error handling', () => {
      it('should handle invalid course ID (400)', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/course/:courseId`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Invalid course ID',
                  details: { field: 'courseId', reason: 'Must be a positive integer' },
                },
              },
              { status: 400 }
            );
          })
        );

        const result = await getCourseGrades(-1);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('VALIDATION_ERROR');
          expect(result.error.message).toContain('Invalid');
        }
      });

      it('should handle permission denied (403)', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/course/:courseId`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'PERMISSION_DENIED',
                  message: 'You do not have permission to view grades for this course',
                  details: {
                    required_capability: 'moodle/grade:view',
                    context: 'course',
                  },
                },
              },
              { status: 403 }
            );
          })
        );

        const result = await getCourseGrades(courseId);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('PERMISSION_DENIED');
        }
      });

      it('should handle course not found (404)', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/course/:courseId`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'Course not found',
                },
              },
              { status: 404 }
            );
          })
        );

        const result = await getCourseGrades(99999);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('NOT_FOUND');
        }
      });

      it('should handle server error (500)', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/course/:courseId`, () => {
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

        const result = await getCourseGrades(courseId);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('SERVER_ERROR');
        }
      });

      it('should handle network failure', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/course/:courseId`, () => {
            return HttpResponse.error();
          })
        );

        const result = await getCourseGrades(courseId);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('NETWORK_ERROR');
        }
      });

      it('should handle request timeout', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/course/:courseId`, async () => {
            await delay(30000); // Simulate timeout
            return HttpResponse.json({ success: true, data: {} });
          })
        );

        // Test with shorter timeout - this should be handled by the API client
        const result = await getCourseGrades(courseId);

        // The timeout should be caught and handled
        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================================================
  // getUserGrades Tests
  // ============================================================================
  describe('getUserGrades', () => {
    const userId = 42;
    const mockGrades = mockGradeArray(1, 5);

    describe('successful requests', () => {
      it('should fetch user grades successfully', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/user/:userId`, ({ params }) => {
            expect(params.userId).toBe(String(userId));
            return HttpResponse.json({
              success: true,
              data: {
                userId: Number(params.userId),
                courses: [
                  {
                    courseId: 1,
                    courseName: 'Test Course',
                    grades: mockGrades,
                    total: 87.5,
                  },
                ],
              },
            });
          })
        );

        const result = await getUserGrades(userId);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.userId).toBe(userId);
          expect(result.data.courses).toBeDefined();
          expect(Array.isArray(result.data.courses)).toBe(true);
        }
      });

      it('should filter by course ID when provided', async () => {
        const courseId = 5;
        let capturedUrl: URL | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/user/:userId`, ({ request }) => {
            capturedUrl = new URL(request.url);
            return HttpResponse.json({
              success: true,
              data: {
                userId,
                courses: [
                  {
                    courseId,
                    courseName: 'Filtered Course',
                    grades: mockGrades,
                    total: 92.0,
                  },
                ],
              },
            });
          })
        );

        await getUserGrades(userId, { courseId });

        expect(capturedUrl).not.toBeNull();
        expect(capturedUrl!.searchParams.get('courseId')).toBe(String(courseId));
      });

      it('should include authorization header', async () => {
        let authHeader: string | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/user/:userId`, ({ request }) => {
            authHeader = request.headers.get('Authorization');
            return HttpResponse.json({
              success: true,
              data: {
                userId,
                courses: [],
              },
            });
          })
        );

        await getUserGrades(userId);

        expect(authHeader).not.toBeNull();
      });

      it('should return grades with correct structure', async () => {
        const testGrade = mockGrade({ userid: userId });

        server.use(
          http.get(`${API_BASE_URL}/gradebook/user/:userId`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                userId,
                courses: [
                  {
                    courseId: 1,
                    courseName: 'Course 1',
                    grades: [testGrade],
                    total: testGrade.finalgrade,
                  },
                ],
              },
            });
          })
        );

        const result = await getUserGrades(userId);

        expect(result.success).toBe(true);
        if (result.success) {
          const grade = result.data.courses[0].grades[0];
          expect(grade).toHaveProperty('id');
          expect(grade).toHaveProperty('itemid');
          expect(grade).toHaveProperty('userid');
          expect(grade).toHaveProperty('finalgrade');
          expect(grade.userid).toBe(userId);
        }
      });
    });

    describe('error handling', () => {
      it('should handle user not found (404)', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/user/:userId`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'User not found',
                },
              },
              { status: 404 }
            );
          })
        );

        const result = await getUserGrades(99999);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('NOT_FOUND');
        }
      });

      it('should handle permission denied for viewing other user grades', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/user/:userId`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'PERMISSION_DENIED',
                  message: 'You cannot view grades for this user',
                  details: {
                    required_capability: 'moodle/grade:viewall',
                  },
                },
              },
              { status: 403 }
            );
          })
        );

        const result = await getUserGrades(userId);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('PERMISSION_DENIED');
        }
      });

      it('should handle network errors gracefully', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/user/:userId`, () => {
            return HttpResponse.error();
          })
        );

        const result = await getUserGrades(userId);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });
    });
  });

  // ============================================================================
  // getGradeItems Tests
  // ============================================================================
  describe('getGradeItems', () => {
    const courseId = 1;
    const mockItems = mockGradeItemArray(courseId, 10);

    describe('successful requests', () => {
      it('should fetch grade items for a course', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/items`, ({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('courseId')).toBe(String(courseId));
            return HttpResponse.json({
              success: true,
              data: mockItems,
              meta: {
                total: mockItems.length,
              },
            });
          })
        );

        const result = await getGradeItems({ courseId });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(Array.isArray(result.data)).toBe(true);
          expect(result.data.length).toBe(mockItems.length);
        }
      });

      it('should filter by category when provided', async () => {
        const categoryId = 3;
        let capturedUrl: URL | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/items`, ({ request }) => {
            capturedUrl = new URL(request.url);
            return HttpResponse.json({
              success: true,
              data: mockItems.filter((item) => item.categoryid === categoryId),
            });
          })
        );

        await getGradeItems({ courseId, categoryId });

        expect(capturedUrl).not.toBeNull();
        expect(capturedUrl!.searchParams.get('categoryId')).toBe(String(categoryId));
      });

      it('should filter by item type when provided', async () => {
        const itemType = 'mod';
        let capturedUrl: URL | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/items`, ({ request }) => {
            capturedUrl = new URL(request.url);
            return HttpResponse.json({
              success: true,
              data: mockItems.filter((item) => item.itemtype === itemType),
            });
          })
        );

        await getGradeItems({ courseId, itemType });

        expect(capturedUrl).not.toBeNull();
        expect(capturedUrl!.searchParams.get('itemType')).toBe(itemType);
      });

      it('should return grade items with correct TypeScript structure', async () => {
        const testItem = mockGradeItem({ courseid: courseId });

        server.use(
          http.get(`${API_BASE_URL}/gradebook/items`, () => {
            return HttpResponse.json({
              success: true,
              data: [testItem],
            });
          })
        );

        const result = await getGradeItems({ courseId });

        expect(result.success).toBe(true);
        if (result.success) {
          const item = result.data[0];
          expect(item).toHaveProperty('id');
          expect(item).toHaveProperty('courseid');
          expect(item).toHaveProperty('categoryid');
          expect(item).toHaveProperty('itemname');
          expect(item).toHaveProperty('itemtype');
          expect(item).toHaveProperty('grademax');
          expect(item).toHaveProperty('grademin');
          expect(item).toHaveProperty('gradepass');
        }
      });

      it('should include hidden items when requested', async () => {
        let capturedUrl: URL | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/items`, ({ request }) => {
            capturedUrl = new URL(request.url);
            return HttpResponse.json({
              success: true,
              data: mockItems,
            });
          })
        );

        await getGradeItems({ courseId, includeHidden: true });

        expect(capturedUrl).not.toBeNull();
        expect(capturedUrl!.searchParams.get('includeHidden')).toBe('true');
      });
    });

    describe('error handling', () => {
      it('should handle missing course ID', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/items`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Course ID is required',
                },
              },
              { status: 400 }
            );
          })
        );

        // @ts-expect-error - Testing runtime validation
        const result = await getGradeItems({});

        expect(result.success).toBe(false);
      });

      it('should handle permission denied', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/items`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'PERMISSION_DENIED',
                  message: 'Cannot view grade items for this course',
                },
              },
              { status: 403 }
            );
          })
        );

        const result = await getGradeItems({ courseId });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('PERMISSION_DENIED');
        }
      });
    });
  });

  // ============================================================================
  // updateGradeItem Tests
  // ============================================================================
  describe('updateGradeItem', () => {
    const itemId = 1;
    const updateData = {
      itemname: 'Updated Assignment',
      grademax: 100,
      grademin: 0,
      gradepass: 60,
      hidden: false,
      locked: false,
    };

    describe('successful requests', () => {
      it('should update grade item successfully', async () => {
        const updatedItem = mockGradeItem({ id: itemId, ...updateData });

        server.use(
          http.put(`${API_BASE_URL}/gradebook/items/:itemId`, async ({ params, request }) => {
            expect(params.itemId).toBe(String(itemId));
            const body = await request.json();
            expect(body).toMatchObject(updateData);
            return HttpResponse.json({
              success: true,
              data: updatedItem,
            });
          })
        );

        const result = await updateGradeItem(itemId, updateData);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBe(itemId);
          expect(result.data.itemname).toBe(updateData.itemname);
        }
      });

      it('should include authorization header', async () => {
        let authHeader: string | null = null;

        server.use(
          http.put(`${API_BASE_URL}/gradebook/items/:itemId`, ({ request }) => {
            authHeader = request.headers.get('Authorization');
            return HttpResponse.json({
              success: true,
              data: mockGradeItem({ id: itemId }),
            });
          })
        );

        await updateGradeItem(itemId, updateData);

        expect(authHeader).not.toBeNull();
      });

      it('should handle partial updates', async () => {
        const partialUpdate = { itemname: 'New Name Only' };

        server.use(
          http.put(`${API_BASE_URL}/gradebook/items/:itemId`, async ({ request }) => {
            const body = await request.json();
            expect(body).toMatchObject(partialUpdate);
            return HttpResponse.json({
              success: true,
              data: mockGradeItem({ id: itemId, ...partialUpdate }),
            });
          })
        );

        const result = await updateGradeItem(itemId, partialUpdate);

        expect(result.success).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should handle validation errors (invalid grade range)', async () => {
        server.use(
          http.put(`${API_BASE_URL}/gradebook/items/:itemId`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Grade minimum cannot be greater than grade maximum',
                  details: {
                    field: 'grademin',
                    value: 100,
                    constraint: 'must be less than grademax',
                  },
                },
              },
              { status: 400 }
            );
          })
        );

        const result = await updateGradeItem(itemId, { grademin: 100, grademax: 50 });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('VALIDATION_ERROR');
        }
      });

      it('should handle item not found', async () => {
        server.use(
          http.put(`${API_BASE_URL}/gradebook/items/:itemId`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'Grade item not found',
                },
              },
              { status: 404 }
            );
          })
        );

        const result = await updateGradeItem(99999, updateData);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('NOT_FOUND');
        }
      });

      it('should handle permission denied (no edit capability)', async () => {
        server.use(
          http.put(`${API_BASE_URL}/gradebook/items/:itemId`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'PERMISSION_DENIED',
                  message: 'You do not have permission to edit grade items',
                  details: {
                    required_capability: 'moodle/grade:manage',
                  },
                },
              },
              { status: 403 }
            );
          })
        );

        const result = await updateGradeItem(itemId, updateData);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('PERMISSION_DENIED');
        }
      });

      it('should handle locked grade item', async () => {
        server.use(
          http.put(`${API_BASE_URL}/gradebook/items/:itemId`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'LOCKED',
                  message: 'Cannot modify a locked grade item',
                },
              },
              { status: 400 }
            );
          })
        );

        const result = await updateGradeItem(itemId, updateData);

        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================================================
  // getGradeCategories Tests
  // ============================================================================
  describe('getGradeCategories', () => {
    const courseId = 1;
    const mockCategories = [
      {
        id: 1,
        courseid: courseId,
        fullname: 'Assignments',
        aggregation: 'weighted_mean',
        parent: null,
        depth: 1,
        weight: 0.4,
        items: mockGradeItemArray(courseId, 3),
      },
      {
        id: 2,
        courseid: courseId,
        fullname: 'Quizzes',
        aggregation: 'weighted_mean',
        parent: null,
        depth: 1,
        weight: 0.3,
        items: mockGradeItemArray(courseId, 2),
      },
      {
        id: 3,
        courseid: courseId,
        fullname: 'Participation',
        aggregation: 'simple_weighted_mean',
        parent: null,
        depth: 1,
        weight: 0.3,
        items: mockGradeItemArray(courseId, 1),
      },
    ];

    describe('successful requests', () => {
      it('should fetch grade categories for a course', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/categories`, ({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('courseId')).toBe(String(courseId));
            return HttpResponse.json({
              success: true,
              data: mockCategories,
            });
          })
        );

        const result = await getGradeCategories(courseId);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(Array.isArray(result.data)).toBe(true);
          expect(result.data.length).toBe(3);
        }
      });

      it('should return categories with correct structure', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/categories`, () => {
            return HttpResponse.json({
              success: true,
              data: mockCategories,
            });
          })
        );

        const result = await getGradeCategories(courseId);

        expect(result.success).toBe(true);
        if (result.success) {
          const category = result.data[0];
          expect(category).toHaveProperty('id');
          expect(category).toHaveProperty('courseid');
          expect(category).toHaveProperty('fullname');
          expect(category).toHaveProperty('aggregation');
          expect(category).toHaveProperty('weight');
        }
      });

      it('should include nested items when requested', async () => {
        let capturedUrl: URL | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/categories`, ({ request }) => {
            capturedUrl = new URL(request.url);
            return HttpResponse.json({
              success: true,
              data: mockCategories,
            });
          })
        );

        await getGradeCategories(courseId, { includeItems: true });

        expect(capturedUrl).not.toBeNull();
        expect(capturedUrl!.searchParams.get('includeItems')).toBe('true');
      });

      it('should return hierarchical category structure', async () => {
        const nestedCategories = [
          {
            id: 1,
            courseid: courseId,
            fullname: 'Course Total',
            parent: null,
            depth: 0,
            children: [
              { id: 2, fullname: 'Unit 1', parent: 1, depth: 1, children: [] },
              { id: 3, fullname: 'Unit 2', parent: 1, depth: 1, children: [] },
            ],
          },
        ];

        server.use(
          http.get(`${API_BASE_URL}/gradebook/categories`, () => {
            return HttpResponse.json({
              success: true,
              data: nestedCategories,
            });
          })
        );

        const result = await getGradeCategories(courseId, { nested: true });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data[0].children).toBeDefined();
          expect(result.data[0].children.length).toBe(2);
        }
      });
    });

    describe('error handling', () => {
      it('should handle course not found', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/categories`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'Course not found',
                },
              },
              { status: 404 }
            );
          })
        );

        const result = await getGradeCategories(99999);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('NOT_FOUND');
        }
      });

      it('should handle permission denied', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/categories`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'PERMISSION_DENIED',
                  message: 'Cannot view grade categories',
                },
              },
              { status: 403 }
            );
          })
        );

        const result = await getGradeCategories(courseId);

        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================================================
  // updateGrade Tests
  // ============================================================================
  describe('updateGrade', () => {
    const gradeId = 1;
    const updateData = {
      finalgrade: 85.5,
      feedback: 'Great work on this assignment!',
      overridden: true,
    };

    describe('successful requests', () => {
      it('should update grade successfully', async () => {
        const updatedGrade = mockGrade({ id: gradeId, ...updateData });

        server.use(
          http.put(`${API_BASE_URL}/gradebook/grades/:gradeId`, async ({ params, request }) => {
            expect(params.gradeId).toBe(String(gradeId));
            const body = await request.json();
            expect(body).toMatchObject(updateData);
            return HttpResponse.json({
              success: true,
              data: updatedGrade,
            });
          })
        );

        const result = await updateGrade(gradeId, updateData);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBe(gradeId);
          expect(result.data.finalgrade).toBe(updateData.finalgrade);
          expect(result.data.feedback).toBe(updateData.feedback);
        }
      });

      it('should include authorization header for grade updates', async () => {
        let authHeader: string | null = null;

        server.use(
          http.put(`${API_BASE_URL}/gradebook/grades/:gradeId`, ({ request }) => {
            authHeader = request.headers.get('Authorization');
            return HttpResponse.json({
              success: true,
              data: mockGrade({ id: gradeId }),
            });
          })
        );

        await updateGrade(gradeId, updateData);

        expect(authHeader).not.toBeNull();
      });

      it('should support updating only feedback', async () => {
        const feedbackOnly = { feedback: 'Updated feedback text' };

        server.use(
          http.put(`${API_BASE_URL}/gradebook/grades/:gradeId`, async ({ request }) => {
            const body = await request.json();
            expect(body).toMatchObject(feedbackOnly);
            return HttpResponse.json({
              success: true,
              data: mockGrade({ id: gradeId, ...feedbackOnly }),
            });
          })
        );

        const result = await updateGrade(gradeId, feedbackOnly);

        expect(result.success).toBe(true);
      });

      it('should handle grade override with reason', async () => {
        const overrideData = {
          finalgrade: 95,
          overridden: true,
          overrideReason: 'Late submission policy exception',
        };

        server.use(
          http.put(`${API_BASE_URL}/gradebook/grades/:gradeId`, async ({ request }) => {
            const body = await request.json();
            expect(body.overrideReason).toBe(overrideData.overrideReason);
            return HttpResponse.json({
              success: true,
              data: mockGrade({ id: gradeId, ...overrideData }),
            });
          })
        );

        const result = await updateGrade(gradeId, overrideData);

        expect(result.success).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should handle grade validation errors (out of range)', async () => {
        server.use(
          http.put(`${API_BASE_URL}/gradebook/grades/:gradeId`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Grade value exceeds maximum allowed',
                  details: {
                    field: 'finalgrade',
                    value: 150,
                    constraint: 'must be between 0 and 100',
                  },
                },
              },
              { status: 400 }
            );
          })
        );

        const result = await updateGrade(gradeId, { finalgrade: 150 });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('VALIDATION_ERROR');
        }
      });

      it('should handle grade not found', async () => {
        server.use(
          http.put(`${API_BASE_URL}/gradebook/grades/:gradeId`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'Grade not found',
                },
              },
              { status: 404 }
            );
          })
        );

        const result = await updateGrade(99999, updateData);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('NOT_FOUND');
        }
      });

      it('should handle permission denied (no grading capability)', async () => {
        server.use(
          http.put(`${API_BASE_URL}/gradebook/grades/:gradeId`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'PERMISSION_DENIED',
                  message: 'You do not have permission to modify grades',
                  details: {
                    required_capability: 'moodle/grade:edit',
                  },
                },
              },
              { status: 403 }
            );
          })
        );

        const result = await updateGrade(gradeId, updateData);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('PERMISSION_DENIED');
        }
      });

      it('should handle locked grade', async () => {
        server.use(
          http.put(`${API_BASE_URL}/gradebook/grades/:gradeId`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'LOCKED',
                  message: 'This grade is locked and cannot be modified',
                },
              },
              { status: 400 }
            );
          })
        );

        const result = await updateGrade(gradeId, updateData);

        expect(result.success).toBe(false);
      });

      it('should handle network errors', async () => {
        server.use(
          http.put(`${API_BASE_URL}/gradebook/grades/:gradeId`, () => {
            return HttpResponse.error();
          })
        );

        const result = await updateGrade(gradeId, updateData);

        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================================================
  // exportGrades Tests
  // ============================================================================
  describe('exportGrades', () => {
    const courseId = 1;

    describe('successful requests', () => {
      it('should export grades as CSV', async () => {
        const csvData = 'Student,Assignment 1,Quiz 1,Total\nJohn Doe,85,90,87.5';

        server.use(
          http.get(`${API_BASE_URL}/gradebook/export`, ({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('courseId')).toBe(String(courseId));
            expect(url.searchParams.get('format')).toBe('csv');
            return HttpResponse.json({
              success: true,
              data: {
                content: csvData,
                filename: `grades_course_${courseId}.csv`,
                mimeType: 'text/csv',
              },
            });
          })
        );

        const result = await exportGrades({ courseId, format: 'csv' });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.content).toBeDefined();
          expect(result.data.filename).toContain('.csv');
          expect(result.data.mimeType).toBe('text/csv');
        }
      });

      it('should export grades as Excel', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/export`, ({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('format')).toBe('xlsx');
            return HttpResponse.json({
              success: true,
              data: {
                content: 'base64_encoded_excel_content',
                filename: `grades_course_${courseId}.xlsx`,
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              },
            });
          })
        );

        const result = await exportGrades({ courseId, format: 'xlsx' });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.filename).toContain('.xlsx');
        }
      });

      it('should filter export by user IDs', async () => {
        const userIds = [1, 2, 3];
        let capturedUrl: URL | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/export`, ({ request }) => {
            capturedUrl = new URL(request.url);
            return HttpResponse.json({
              success: true,
              data: {
                content: 'filtered_csv_content',
                filename: 'grades.csv',
                mimeType: 'text/csv',
              },
            });
          })
        );

        await exportGrades({ courseId, format: 'csv', userIds });

        expect(capturedUrl).not.toBeNull();
        expect(capturedUrl!.searchParams.get('userIds')).toBe(userIds.join(','));
      });

      it('should filter export by grade items', async () => {
        const itemIds = [10, 20, 30];
        let capturedUrl: URL | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/export`, ({ request }) => {
            capturedUrl = new URL(request.url);
            return HttpResponse.json({
              success: true,
              data: {
                content: 'filtered_content',
                filename: 'grades.csv',
                mimeType: 'text/csv',
              },
            });
          })
        );

        await exportGrades({ courseId, format: 'csv', itemIds });

        expect(capturedUrl).not.toBeNull();
        expect(capturedUrl!.searchParams.get('itemIds')).toBe(itemIds.join(','));
      });

      it('should export grades with date range filter', async () => {
        const dateFrom = '2024-01-01';
        const dateTo = '2024-12-31';
        let capturedUrl: URL | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/export`, ({ request }) => {
            capturedUrl = new URL(request.url);
            return HttpResponse.json({
              success: true,
              data: {
                content: 'dated_content',
                filename: 'grades.csv',
                mimeType: 'text/csv',
              },
            });
          })
        );

        await exportGrades({ courseId, format: 'csv', dateFrom, dateTo });

        expect(capturedUrl).not.toBeNull();
        expect(capturedUrl!.searchParams.get('dateFrom')).toBe(dateFrom);
        expect(capturedUrl!.searchParams.get('dateTo')).toBe(dateTo);
      });

      it('should include feedback in export when requested', async () => {
        let capturedUrl: URL | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/export`, ({ request }) => {
            capturedUrl = new URL(request.url);
            return HttpResponse.json({
              success: true,
              data: {
                content: 'content_with_feedback',
                filename: 'grades.csv',
                mimeType: 'text/csv',
              },
            });
          })
        );

        await exportGrades({ courseId, format: 'csv', includeFeedback: true });

        expect(capturedUrl).not.toBeNull();
        expect(capturedUrl!.searchParams.get('includeFeedback')).toBe('true');
      });
    });

    describe('error handling', () => {
      it('should handle invalid format', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/export`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Invalid export format',
                  details: {
                    field: 'format',
                    allowed: ['csv', 'xlsx', 'ods', 'txt'],
                  },
                },
              },
              { status: 400 }
            );
          })
        );

        const result = await exportGrades({ courseId, format: 'invalid' as any });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('VALIDATION_ERROR');
        }
      });

      it('should handle permission denied', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/export`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'PERMISSION_DENIED',
                  message: 'You cannot export grades for this course',
                  details: {
                    required_capability: 'gradeexport/txt:view',
                  },
                },
              },
              { status: 403 }
            );
          })
        );

        const result = await exportGrades({ courseId, format: 'csv' });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('PERMISSION_DENIED');
        }
      });

      it('should handle large export timeout', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/export`, async () => {
            await delay(30000); // Simulate timeout
            return HttpResponse.json({ success: true, data: {} });
          })
        );

        const result = await exportGrades({ courseId, format: 'csv' });

        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================================================
  // getGradeReport Tests
  // ============================================================================
  describe('getGradeReport', () => {
    const courseId = 1;

    describe('successful requests', () => {
      it('should fetch grade report successfully', async () => {
        const mockReport = {
          courseId,
          courseName: 'Test Course',
          summary: {
            totalStudents: 50,
            averageGrade: 78.5,
            passRate: 0.85,
            gradeDistribution: {
              A: 10,
              B: 15,
              C: 15,
              D: 7,
              F: 3,
            },
          },
          items: mockGradeItemArray(courseId, 5),
          students: [],
        };

        server.use(
          http.get(`${API_BASE_URL}/gradebook/report`, ({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('courseId')).toBe(String(courseId));
            return HttpResponse.json({
              success: true,
              data: mockReport,
            });
          })
        );

        const result = await getGradeReport({ courseId });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.courseId).toBe(courseId);
          expect(result.data.summary).toBeDefined();
          expect(result.data.summary.totalStudents).toBe(50);
          expect(result.data.summary.averageGrade).toBe(78.5);
        }
      });

      it('should filter report by group', async () => {
        const groupId = 5;
        let capturedUrl: URL | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/report`, ({ request }) => {
            capturedUrl = new URL(request.url);
            return HttpResponse.json({
              success: true,
              data: {
                courseId,
                courseName: 'Test Course',
                summary: { totalStudents: 10, averageGrade: 82.0, passRate: 0.9 },
                items: [],
                students: [],
              },
            });
          })
        );

        await getGradeReport({ courseId, groupId });

        expect(capturedUrl).not.toBeNull();
        expect(capturedUrl!.searchParams.get('groupId')).toBe(String(groupId));
      });

      it('should specify report type', async () => {
        let capturedUrl: URL | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/report`, ({ request }) => {
            capturedUrl = new URL(request.url);
            return HttpResponse.json({
              success: true,
              data: {
                courseId,
                courseName: 'Test Course',
                summary: { totalStudents: 50, averageGrade: 78.5, passRate: 0.85 },
                items: [],
                students: [],
              },
            });
          })
        );

        await getGradeReport({ courseId, reportType: 'overview' });

        expect(capturedUrl).not.toBeNull();
        expect(capturedUrl!.searchParams.get('reportType')).toBe('overview');
      });

      it('should include grade distribution statistics', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/report`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                courseId,
                courseName: 'Test Course',
                summary: {
                  totalStudents: 50,
                  averageGrade: 78.5,
                  passRate: 0.85,
                  gradeDistribution: {
                    A: 10,
                    B: 15,
                    C: 15,
                    D: 7,
                    F: 3,
                  },
                  standardDeviation: 12.5,
                  median: 80.0,
                  highest: 100,
                  lowest: 35,
                },
                items: [],
                students: [],
              },
            });
          })
        );

        const result = await getGradeReport({ courseId, includeStatistics: true });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.summary.gradeDistribution).toBeDefined();
          expect(result.data.summary.standardDeviation).toBeDefined();
          expect(result.data.summary.median).toBeDefined();
        }
      });

      it('should paginate student results', async () => {
        let capturedUrl: URL | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/report`, ({ request }) => {
            capturedUrl = new URL(request.url);
            return HttpResponse.json({
              success: true,
              data: {
                courseId,
                courseName: 'Test Course',
                summary: { totalStudents: 100 },
                items: [],
                students: [],
              },
              meta: {
                pagination: {
                  page: 2,
                  perPage: 25,
                  total: 100,
                  totalPages: 4,
                },
              },
            });
          })
        );

        await getGradeReport({ courseId, page: 2, perPage: 25 });

        expect(capturedUrl).not.toBeNull();
        expect(capturedUrl!.searchParams.get('page')).toBe('2');
        expect(capturedUrl!.searchParams.get('perPage')).toBe('25');
      });

      it('should include authorization header', async () => {
        let authHeader: string | null = null;

        server.use(
          http.get(`${API_BASE_URL}/gradebook/report`, ({ request }) => {
            authHeader = request.headers.get('Authorization');
            return HttpResponse.json({
              success: true,
              data: {
                courseId,
                courseName: 'Test Course',
                summary: {},
                items: [],
                students: [],
              },
            });
          })
        );

        await getGradeReport({ courseId });

        expect(authHeader).not.toBeNull();
      });
    });

    describe('error handling', () => {
      it('should handle course not found', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/report`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'Course not found',
                },
              },
              { status: 404 }
            );
          })
        );

        const result = await getGradeReport({ courseId: 99999 });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('NOT_FOUND');
        }
      });

      it('should handle permission denied', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/report`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'PERMISSION_DENIED',
                  message: 'You cannot view grade reports for this course',
                  details: {
                    required_capability: 'gradereport/grader:view',
                  },
                },
              },
              { status: 403 }
            );
          })
        );

        const result = await getGradeReport({ courseId });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('PERMISSION_DENIED');
        }
      });

      it('should handle invalid report type', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/report`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Invalid report type',
                  details: {
                    field: 'reportType',
                    allowed: ['grader', 'user', 'overview', 'outcomes'],
                  },
                },
              },
              { status: 400 }
            );
          })
        );

        const result = await getGradeReport({ courseId, reportType: 'invalid' as any });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('VALIDATION_ERROR');
        }
      });

      it('should handle network errors gracefully', async () => {
        server.use(
          http.get(`${API_BASE_URL}/gradebook/report`, () => {
            return HttpResponse.error();
          })
        );

        const result = await getGradeReport({ courseId });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });
    });
  });

  // ============================================================================
  // Cross-cutting Concerns Tests
  // ============================================================================
  describe('Cross-cutting Concerns', () => {
    describe('authorization header', () => {
      it('should include JWT token in all API requests', async () => {
        const capturedHeaders: (string | null)[] = [];

        // Mock all gradebook endpoints to capture auth headers
        server.use(
          http.get(`${API_BASE_URL}/gradebook/*`, ({ request }) => {
            capturedHeaders.push(request.headers.get('Authorization'));
            return HttpResponse.json({ success: true, data: {} });
          }),
          http.put(`${API_BASE_URL}/gradebook/*`, ({ request }) => {
            capturedHeaders.push(request.headers.get('Authorization'));
            return HttpResponse.json({ success: true, data: {} });
          })
        );

        // Make various API calls
        await getCourseGrades(1);
        await getUserGrades(1);
        await getGradeItems({ courseId: 1 });
        await getGradeCategories(1);
        await getGradeReport({ courseId: 1 });

        // All requests should have authorization header
        capturedHeaders.forEach((header) => {
          expect(header).not.toBeNull();
        });
      });
    });

    describe('content-type headers', () => {
      it('should set correct content-type for PUT requests', async () => {
        let contentType: string | null = null;

        server.use(
          http.put(`${API_BASE_URL}/gradebook/grades/:gradeId`, ({ request }) => {
            contentType = request.headers.get('Content-Type');
            return HttpResponse.json({
              success: true,
              data: mockGrade({ id: 1 }),
            });
          })
        );

        await updateGrade(1, { finalgrade: 85 });

        expect(contentType).toContain('application/json');
      });
    });

    describe('error response consistency', () => {
      it('should return consistent error structure across all endpoints', async () => {
        const endpoints = [
          { method: 'get', path: '/gradebook/course/1' },
          { method: 'get', path: '/gradebook/user/1' },
          { method: 'get', path: '/gradebook/items' },
          { method: 'get', path: '/gradebook/categories' },
          { method: 'get', path: '/gradebook/report' },
          { method: 'get', path: '/gradebook/export' },
        ];

        for (const endpoint of endpoints) {
          server.resetHandlers();
          server.use(
            http.get(`${API_BASE_URL}${endpoint.path}`, () => {
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

          let result;
          switch (endpoint.path) {
            case '/gradebook/course/1':
              result = await getCourseGrades(1);
              break;
            case '/gradebook/user/1':
              result = await getUserGrades(1);
              break;
            case '/gradebook/items':
              result = await getGradeItems({ courseId: 1 });
              break;
            case '/gradebook/categories':
              result = await getGradeCategories(1);
              break;
            case '/gradebook/report':
              result = await getGradeReport({ courseId: 1 });
              break;
            case '/gradebook/export':
              result = await exportGrades({ courseId: 1, format: 'csv' });
              break;
          }

          expect(result?.success).toBe(false);
          if (result && !result.success) {
            expect(result.error).toHaveProperty('code');
            expect(result.error).toHaveProperty('message');
          }
        }
      });
    });

    describe('response type validation', () => {
      it('should validate grade data structure matches PHP backend format', async () => {
        // Grade structure should match PHP grade_get_grades() output format
        const phpStyleGrade = mockGrade({
          id: 1,
          itemid: 10,
          userid: 42,
          rawgrade: 85.5,
          rawgrademax: 100,
          rawgrademin: 0,
          finalgrade: 85.5,
          hidden: 0,
          locked: 0,
          overridden: 0,
          excluded: 0,
          feedback: 'Good work!',
          feedbackformat: 1,
          information: '',
          informationformat: 1,
          timecreated: Math.floor(Date.now() / 1000),
          timemodified: Math.floor(Date.now() / 1000),
        });

        server.use(
          http.get(`${API_BASE_URL}/gradebook/course/:courseId`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                courseId: 1,
                items: [mockGradeItem({ id: 10, courseid: 1 })],
                grades: [phpStyleGrade],
              },
            });
          })
        );

        const result = await getCourseGrades(1);

        expect(result.success).toBe(true);
        if (result.success) {
          const grade = result.data.grades[0];
          // Verify structure matches PHP backend format
          expect(grade).toHaveProperty('id');
          expect(grade).toHaveProperty('itemid');
          expect(grade).toHaveProperty('userid');
          expect(grade).toHaveProperty('rawgrade');
          expect(grade).toHaveProperty('finalgrade');
          expect(grade).toHaveProperty('hidden');
          expect(grade).toHaveProperty('locked');
          expect(grade).toHaveProperty('overridden');
          expect(grade).toHaveProperty('feedback');
        }
      });

      it('should validate grade item structure matches PHP backend format', async () => {
        // GradeItem structure should match PHP grade_item database structure
        const phpStyleGradeItem = mockGradeItem({
          id: 10,
          courseid: 1,
          categoryid: 1,
          itemname: 'Test Assignment',
          itemtype: 'mod',
          itemmodule: 'assign',
          iteminstance: 5,
          itemnumber: 0,
          iteminfo: null,
          idnumber: '',
          gradetype: 1,
          grademax: 100,
          grademin: 0,
          scaleid: null,
          outcomeid: null,
          gradepass: 60,
          multfactor: 1.0,
          plusfactor: 0,
          aggregationcoef: 0,
          aggregationcoef2: 0,
          sortorder: 1,
          display: 0,
          decimals: null,
          hidden: 0,
          locked: 0,
          locktime: 0,
          needsupdate: 0,
          weightoverride: 0,
          timecreated: Math.floor(Date.now() / 1000),
          timemodified: Math.floor(Date.now() / 1000),
        });

        server.use(
          http.get(`${API_BASE_URL}/gradebook/items`, () => {
            return HttpResponse.json({
              success: true,
              data: [phpStyleGradeItem],
            });
          })
        );

        const result = await getGradeItems({ courseId: 1 });

        expect(result.success).toBe(true);
        if (result.success) {
          const item = result.data[0];
          // Verify structure matches PHP backend format
          expect(item).toHaveProperty('id');
          expect(item).toHaveProperty('courseid');
          expect(item).toHaveProperty('categoryid');
          expect(item).toHaveProperty('itemname');
          expect(item).toHaveProperty('itemtype');
          expect(item).toHaveProperty('grademax');
          expect(item).toHaveProperty('grademin');
          expect(item).toHaveProperty('gradepass');
        }
      });
    });
  });
});
