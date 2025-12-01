/**
 * Course API Client Unit Tests
 *
 * Comprehensive test suite for the courseApi module, validating all course-related
 * API operations including fetching course lists with pagination and filtering,
 * retrieving individual course details, creating and updating courses, deleting
 * courses, enrollment operations, and course contents retrieval.
 *
 * Tests mock the axios HTTP client responses and verify proper request formatting,
 * error handling, TypeScript type safety, and integration with backend API endpoints
 * that wrap Moodle core functions (get_courses, get_course, create_course,
 * update_course, delete_course, enrol_try_internal_enrol).
 *
 * @module tests/unit/features/courses/courseApi.test
 * @see react-frontend/src/features/courses/api/courseApi.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Course, CourseModule } from '@/types/entities';

// Mock the apiClient module
vi.mock('@/services/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Import after mocking to ensure mocks are in place
import { apiClient } from '@/services/api/client';
import {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  enrollInCourse,
  unenrollFromCourse,
  getCourseContents,
  type CourseListItem,
  type CreateCourseInput,
  type UpdateCourseInput,
  type ContentOptions,
  type CourseContent,
  type EnrollmentResult,
  type CourseListParams,
} from '@/features/courses/api/courseApi';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Create a mock course object with all required fields
 */
function createMockCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 1,
    category: 1,
    sortorder: 1,
    fullname: 'Introduction to TypeScript',
    shortname: 'TS101',
    idnumber: 'TS-2024-001',
    summary: '<p>Learn TypeScript fundamentals and best practices.</p>',
    summaryformat: 1,
    format: 'topics',
    showgrades: true,
    startdate: 1704067200, // January 1, 2024
    enddate: 1717200000, // June 1, 2024
    visible: true,
    groupmode: 0,
    groupmodeforce: false,
    lang: 'en',
    timecreated: 1700000000,
    timemodified: 1705000000,
    enablecompletion: true,
    completionnotify: false,
    showactivitydates: true,
    ...overrides,
  };
}

/**
 * Create a mock course list item with extended properties
 */
function createMockCourseListItem(overrides: Partial<CourseListItem> = {}): CourseListItem {
  return {
    id: 1,
    fullname: 'Introduction to TypeScript',
    shortname: 'TS101',
    summary: '<p>Learn TypeScript fundamentals.</p>',
    categoryid: 5,
    categoryname: 'Programming',
    startdate: 1704067200,
    enddate: 1717200000,
    visible: 1,
    enrolledusers: 150,
    imageurl: 'https://example.com/course-image.jpg',
    hasprogress: true,
    progress: 45,
    format: 'topics',
    lang: 'en',
    ...overrides,
  };
}

/**
 * Create a mock course content/section object
 */
function createMockCourseContent(overrides: Partial<CourseContent> = {}): CourseContent {
  return {
    id: 1,
    name: 'General Section',
    visible: true,
    summary: '<p>Welcome to the course!</p>',
    summaryformat: 1,
    section: 0,
    hiddenbynumsections: false,
    uservisible: true,
    modules: [],
    ...overrides,
  };
}

/**
 * Create a mock course module
 */
function createMockCourseModule(overrides: Partial<CourseModule> = {}): CourseModule {
  return {
    id: 100,
    course: 1,
    module: 1,
    instance: 1,
    section: 0,
    idnumber: '',
    added: 1704067200,
    visible: true,
    visibleoncoursepage: true,
    completion: 1,
    completionexpected: 0,
    name: 'Assignment 1',
    modname: 'assign',
    url: '/mod/assign/view.php?id=100',
    iconurl: '/theme/boost/pix/mod/assign/monologo.svg',
    ...overrides,
  };
}

/**
 * Create a mock enrollment result
 */
function createMockEnrollmentResult(overrides: Partial<EnrollmentResult> = {}): EnrollmentResult {
  return {
    success: true,
    courseid: 1,
    userid: 10,
    roleid: 5, // Student role
    message: 'Successfully enrolled in course',
    ...overrides,
  };
}

/**
 * Create a mock paginated response
 */
function createMockPaginatedResponse<T>(
  items: T[],
  pagination: { page: number; perPage: number; total: number; totalPages: number }
): PaginatedResponse<T> {
  return {
    success: true,
    data: {
      items,
      total: pagination.total,
    },
    meta: {
      pagination: {
        page: pagination.page,
        perPage: pagination.perPage,
        total: pagination.total,
        totalPages: pagination.totalPages,
      },
    },
  };
}

/**
 * Create a mock API response
 */
function createMockApiResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: Date.now(),
    },
  };
}

/**
 * Create a mock Axios response
 */
function createMockAxiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as InternalAxiosRequestConfig,
  };
}

/**
 * Create a mock Axios error
 */
function createMockAxiosError(
  status: number,
  statusText: string,
  errorCode: string,
  message: string
): AxiosError {
  const error = new Error(message) as AxiosError;
  error.response = {
    data: {
      success: false,
      error: {
        code: errorCode,
        message,
      },
    },
    status,
    statusText,
    headers: {},
    config: {} as InternalAxiosRequestConfig,
  };
  error.config = {} as InternalAxiosRequestConfig;
  error.isAxiosError = true;
  return error;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('courseApi', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Verify no unexpected calls after each test
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // getCourses() Tests
  // ==========================================================================

  describe('getCourses()', () => {
    it('should fetch paginated course list with default parameters', async () => {
      const mockCourses = [
        createMockCourseListItem({ id: 1, fullname: 'Course 1' }),
        createMockCourseListItem({ id: 2, fullname: 'Course 2' }),
      ];
      const mockResponse = createMockPaginatedResponse(mockCourses as unknown as Course[], {
        page: 1,
        perPage: 20,
        total: 150,
        totalPages: 8,
      });

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await getCourses();

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledWith('/courses', { params: {} });
      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(2);
      expect(result.data.total).toBe(150);
      expect(result.meta.pagination.page).toBe(1);
      expect(result.meta.pagination.totalPages).toBe(8);
    });

    it('should filter courses by category ID', async () => {
      const mockCourses = [createMockCourseListItem({ categoryid: 5 })];
      const mockResponse = createMockPaginatedResponse(mockCourses as unknown as Course[], {
        page: 1,
        perPage: 20,
        total: 10,
        totalPages: 1,
      });

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const params: CourseListParams = { categoryId: 5 };
      const result = await getCourses(params);

      expect(apiClient.get).toHaveBeenCalledWith('/courses', {
        params: { categoryid: 5 },
      });
      expect(result.success).toBe(true);
    });

    it('should search courses by query string', async () => {
      const mockCourses = [
        createMockCourseListItem({ fullname: 'TypeScript Fundamentals' }),
      ];
      const mockResponse = createMockPaginatedResponse(mockCourses as unknown as Course[], {
        page: 1,
        perPage: 20,
        total: 1,
        totalPages: 1,
      });

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const params: CourseListParams = { search: 'typescript' };
      const result = await getCourses(params);

      expect(apiClient.get).toHaveBeenCalledWith('/courses', {
        params: { search: 'typescript' },
      });
      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(1);
    });

    it('should trim whitespace from search query', async () => {
      const mockResponse = createMockPaginatedResponse([] as Course[], {
        page: 1,
        perPage: 20,
        total: 0,
        totalPages: 0,
      });

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      await getCourses({ search: '  react  ' });

      expect(apiClient.get).toHaveBeenCalledWith('/courses', {
        params: { search: 'react' },
      });
    });

    it('should not include empty search parameter', async () => {
      const mockResponse = createMockPaginatedResponse([] as Course[], {
        page: 1,
        perPage: 20,
        total: 0,
        totalPages: 0,
      });

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      await getCourses({ search: '   ' });

      expect(apiClient.get).toHaveBeenCalledWith('/courses', { params: {} });
    });

    it('should paginate with page and perPage parameters', async () => {
      const mockCourses = [createMockCourseListItem()];
      const mockResponse = createMockPaginatedResponse(mockCourses as unknown as Course[], {
        page: 3,
        perPage: 10,
        total: 50,
        totalPages: 5,
      });

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const params: CourseListParams = { page: 3, perPage: 10 };
      const result = await getCourses(params);

      expect(apiClient.get).toHaveBeenCalledWith('/courses', {
        params: { page: 3, perPage: 10 },
      });
      expect(result.meta.pagination.page).toBe(3);
      expect(result.meta.pagination.perPage).toBe(10);
    });

    it('should sort courses by specified field and order', async () => {
      const mockResponse = createMockPaginatedResponse([] as Course[], {
        page: 1,
        perPage: 20,
        total: 0,
        totalPages: 0,
      });

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      await getCourses({ sort: 'fullname', order: 'asc' });

      expect(apiClient.get).toHaveBeenCalledWith('/courses', {
        params: { sort: 'fullname', order: 'asc' },
      });
    });

    it('should combine multiple query parameters correctly', async () => {
      const mockResponse = createMockPaginatedResponse([] as Course[], {
        page: 2,
        perPage: 15,
        total: 30,
        totalPages: 2,
      });

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const params: CourseListParams = {
        page: 2,
        perPage: 15,
        categoryId: 3,
        search: 'programming',
        sort: 'startdate',
        order: 'desc',
      };
      await getCourses(params);

      expect(apiClient.get).toHaveBeenCalledWith('/courses', {
        params: {
          page: 2,
          perPage: 15,
          categoryid: 3,
          search: 'programming',
          sort: 'startdate',
          order: 'desc',
        },
      });
    });

    it('should handle permission denied error (403)', async () => {
      const error = createMockAxiosError(
        403,
        'Forbidden',
        'PERMISSION_DENIED',
        'You do not have permission to view courses'
      );

      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(getCourses()).rejects.toMatchObject({
        response: {
          status: 403,
          data: {
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
            },
          },
        },
      });
    });

    it('should handle server error (500)', async () => {
      const error = createMockAxiosError(
        500,
        'Internal Server Error',
        'SERVER_ERROR',
        'An unexpected error occurred'
      );

      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(getCourses()).rejects.toThrow();
    });

    it('should verify response structure matches PaginatedResponse interface', async () => {
      const mockCourses = [
        createMockCourseListItem({ id: 1, fullname: 'Course 1', shortname: 'C1', categoryid: 1 }),
      ];
      const mockResponse = createMockPaginatedResponse(mockCourses as unknown as Course[], {
        page: 1,
        perPage: 20,
        total: 1,
        totalPages: 1,
      });

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await getCourses();

      // Verify required PaginatedResponse structure
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('items');
      expect(result.data).toHaveProperty('total');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toHaveProperty('pagination');
      expect(result.meta.pagination).toHaveProperty('page');
      expect(result.meta.pagination).toHaveProperty('perPage');
      expect(result.meta.pagination).toHaveProperty('total');
      expect(result.meta.pagination).toHaveProperty('totalPages');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      vi.mocked(apiClient.get).mockRejectedValueOnce(networkError);

      await expect(getCourses()).rejects.toThrow('Network Error');
    });
  });

  // ==========================================================================
  // getCourse() Tests
  // ==========================================================================

  describe('getCourse()', () => {
    it('should fetch single course by valid ID', async () => {
      const mockCourse = createMockCourse({ id: 42, fullname: 'Advanced TypeScript' });
      const mockResponse = createMockApiResponse(mockCourse);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await getCourse(42);

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledWith('/courses/42');
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(42);
      expect(result.data.fullname).toBe('Advanced TypeScript');
    });

    it('should return course with sections and activities', async () => {
      const mockModule = createMockCourseModule({
        id: 100,
        name: 'Week 1 Assignment',
        modname: 'assign',
      });
      const mockCourse = createMockCourse({
        id: 42,
        modules: [mockModule],
        sections: [
          {
            id: 1,
            course: 42,
            section: 0,
            name: 'General',
            visible: true,
            summary: '',
            summaryformat: 1,
            sequence: '100,101,102',
            availability: undefined,
          },
        ],
      });
      const mockResponse = createMockApiResponse(mockCourse);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await getCourse(42);

      expect(result.data.modules).toBeDefined();
      expect(result.data.modules).toHaveLength(1);
      expect(result.data.modules![0]!.name).toBe('Week 1 Assignment');
      expect(result.data.sections).toBeDefined();
    });

    it('should return course with enrollment status', async () => {
      const mockCourse = createMockCourse({
        id: 42,
        isenrolled: true,
        canaccess: true,
      });
      const mockResponse = createMockApiResponse(mockCourse);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await getCourse(42);

      expect(result.data.isenrolled).toBe(true);
      expect(result.data.canaccess).toBe(true);
    });

    it('should throw error for invalid course ID (zero)', async () => {
      await expect(getCourse(0)).rejects.toThrow('Invalid course ID: must be a positive number');
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('should throw error for negative course ID', async () => {
      await expect(getCourse(-5)).rejects.toThrow('Invalid course ID: must be a positive number');
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('should handle course not found error (404)', async () => {
      const error = createMockAxiosError(
        404,
        'Not Found',
        'COURSE_NOT_FOUND',
        'Course with ID 999 not found'
      );

      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(getCourse(999)).rejects.toMatchObject({
        response: {
          status: 404,
        },
      });
    });

    it('should handle permission denied error (403)', async () => {
      const error = createMockAxiosError(
        403,
        'Forbidden',
        'PERMISSION_DENIED',
        'You do not have permission to view this course'
      );

      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(getCourse(42)).rejects.toMatchObject({
        response: {
          status: 403,
          data: {
            error: {
              code: 'PERMISSION_DENIED',
            },
          },
        },
      });
    });

    it('should verify response matches ApiResponse<Course> interface', async () => {
      const mockCourse = createMockCourse();
      const mockResponse = createMockApiResponse(mockCourse);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await getCourse(1);

      // Verify ApiResponse structure
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('fullname');
      expect(result.data).toHaveProperty('shortname');
      expect(result.data).toHaveProperty('format');
    });
  });

  // ==========================================================================
  // createCourse() Tests
  // ==========================================================================

  describe('createCourse()', () => {
    it('should create course with required fields', async () => {
      const newCourse: CreateCourseInput = {
        fullname: 'New TypeScript Course',
        shortname: 'NTS101',
        categoryid: 5,
        format: 'topics',
        summary: '<p>A brand new course about TypeScript.</p>',
      };

      const createdCourse = createMockCourse({
        id: 100,
        fullname: 'New TypeScript Course',
        shortname: 'NTS101',
        category: 5,
        format: 'topics',
      });
      const mockResponse = createMockApiResponse(createdCourse);

      vi.mocked(apiClient.post).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await createCourse(newCourse);

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith('/courses', expect.objectContaining({
        fullname: 'New TypeScript Course',
        shortname: 'NTS101',
        categoryid: 5,
        format: 'topics',
        summary: '<p>A brand new course about TypeScript.</p>',
        summaryformat: 1,
        visible: true,
      }));
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(100);
    });

    it('should create course with all optional fields', async () => {
      const newCourse: CreateCourseInput = {
        fullname: 'Complete Course',
        shortname: 'CC101',
        categoryid: 3,
        format: 'weeks',
        summary: 'Full summary',
        summaryformat: 2,
        startdate: 1704067200,
        enddate: 1717200000,
        visible: false,
        customfields: {
          level: 'advanced',
          credits: 3,
          online: true,
        },
      };

      const mockResponse = createMockApiResponse(createMockCourse({ id: 101 }));
      vi.mocked(apiClient.post).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      await createCourse(newCourse);

      expect(apiClient.post).toHaveBeenCalledWith('/courses', expect.objectContaining({
        fullname: 'Complete Course',
        shortname: 'CC101',
        categoryid: 3,
        format: 'weeks',
        summary: 'Full summary',
        summaryformat: 2,
        startdate: 1704067200,
        enddate: 1717200000,
        visible: false,
        customfields: { level: 'advanced', credits: 3, online: true },
      }));
    });

    it('should throw error when fullname is empty', async () => {
      const invalidCourse: CreateCourseInput = {
        fullname: '',
        shortname: 'TS101',
        categoryid: 5,
        format: 'topics',
        summary: 'Summary',
      };

      await expect(createCourse(invalidCourse)).rejects.toThrow('Course fullname is required');
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('should throw error when fullname is whitespace only', async () => {
      const invalidCourse: CreateCourseInput = {
        fullname: '   ',
        shortname: 'TS101',
        categoryid: 5,
        format: 'topics',
        summary: 'Summary',
      };

      await expect(createCourse(invalidCourse)).rejects.toThrow('Course fullname is required');
    });

    it('should throw error when shortname is missing', async () => {
      const invalidCourse: CreateCourseInput = {
        fullname: 'Valid Name',
        shortname: '',
        categoryid: 5,
        format: 'topics',
        summary: 'Summary',
      };

      await expect(createCourse(invalidCourse)).rejects.toThrow('Course shortname is required');
    });

    it('should throw error when categoryid is invalid', async () => {
      const invalidCourse: CreateCourseInput = {
        fullname: 'Valid Name',
        shortname: 'VN101',
        categoryid: 0,
        format: 'topics',
        summary: 'Summary',
      };

      await expect(createCourse(invalidCourse)).rejects.toThrow('Valid category ID is required');
    });

    it('should throw error when categoryid is negative', async () => {
      const invalidCourse: CreateCourseInput = {
        fullname: 'Valid Name',
        shortname: 'VN101',
        categoryid: -1,
        format: 'topics',
        summary: 'Summary',
      };

      await expect(createCourse(invalidCourse)).rejects.toThrow('Valid category ID is required');
    });

    it('should throw error when format is missing', async () => {
      const invalidCourse: CreateCourseInput = {
        fullname: 'Valid Name',
        shortname: 'VN101',
        categoryid: 5,
        format: '',
        summary: 'Summary',
      };

      await expect(createCourse(invalidCourse)).rejects.toThrow('Course format is required');
    });

    it('should handle permission denied error (403)', async () => {
      const validCourse: CreateCourseInput = {
        fullname: 'New Course',
        shortname: 'NC101',
        categoryid: 5,
        format: 'topics',
        summary: 'Summary',
      };

      const error = createMockAxiosError(
        403,
        'Forbidden',
        'PERMISSION_DENIED',
        'You do not have permission to create courses'
      );

      vi.mocked(apiClient.post).mockRejectedValueOnce(error);

      await expect(createCourse(validCourse)).rejects.toMatchObject({
        response: {
          status: 403,
        },
      });
    });

    it('should handle validation error (400) with field-specific messages', async () => {
      const validCourse: CreateCourseInput = {
        fullname: 'New Course',
        shortname: 'DUPLICATE',
        categoryid: 5,
        format: 'topics',
        summary: 'Summary',
      };

      const error = createMockAxiosError(
        400,
        'Bad Request',
        'VALIDATION_ERROR',
        'Course shortname already exists'
      );

      vi.mocked(apiClient.post).mockRejectedValueOnce(error);

      await expect(createCourse(validCourse)).rejects.toMatchObject({
        response: {
          status: 400,
        },
      });
    });

    it('should trim whitespace from fullname and shortname', async () => {
      const courseWithWhitespace: CreateCourseInput = {
        fullname: '  Trimmed Course Name  ',
        shortname: '  TCN  ',
        categoryid: 5,
        format: 'topics',
        summary: 'Summary',
      };

      const mockResponse = createMockApiResponse(createMockCourse({ id: 102 }));
      vi.mocked(apiClient.post).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      await createCourse(courseWithWhitespace);

      expect(apiClient.post).toHaveBeenCalledWith('/courses', expect.objectContaining({
        fullname: 'Trimmed Course Name',
        shortname: 'TCN',
      }));
    });

    it('should return newly created course with generated ID', async () => {
      const newCourse: CreateCourseInput = {
        fullname: 'Created Course',
        shortname: 'CR101',
        categoryid: 5,
        format: 'topics',
        summary: 'Summary',
      };

      const createdCourse = createMockCourse({
        id: 999,
        fullname: 'Created Course',
        shortname: 'CR101',
      });
      const mockResponse = createMockApiResponse(createdCourse);

      vi.mocked(apiClient.post).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await createCourse(newCourse);

      expect(result.data.id).toBe(999);
      expect(result.data.fullname).toBe('Created Course');
    });
  });

  // ==========================================================================
  // updateCourse() Tests
  // ==========================================================================

  describe('updateCourse()', () => {
    it('should update course with partial data', async () => {
      const updateData: UpdateCourseInput = {
        id: 42,
        fullname: 'Updated Course Name',
      };

      const updatedCourse = createMockCourse({
        id: 42,
        fullname: 'Updated Course Name',
      });
      const mockResponse = createMockApiResponse(updatedCourse);

      vi.mocked(apiClient.put).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await updateCourse(42, updateData);

      expect(apiClient.put).toHaveBeenCalledTimes(1);
      expect(apiClient.put).toHaveBeenCalledWith('/courses/42', {
        id: 42,
        fullname: 'Updated Course Name',
      });
      expect(result.data.fullname).toBe('Updated Course Name');
    });

    it('should update individual fields without requiring others', async () => {
      const updateData: UpdateCourseInput = {
        id: 42,
        visible: false,
      };

      const mockResponse = createMockApiResponse(createMockCourse({
        id: 42,
        visible: false,
      }));

      vi.mocked(apiClient.put).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      await updateCourse(42, updateData);

      expect(apiClient.put).toHaveBeenCalledWith('/courses/42', {
        id: 42,
        visible: false,
      });
    });

    it('should update multiple fields at once', async () => {
      const updateData: UpdateCourseInput = {
        id: 42,
        fullname: 'New Name',
        summary: '<p>New summary</p>',
        format: 'weeks',
        startdate: 1704067200,
        enddate: 1717200000,
        categoryid: 10,
      };

      const mockResponse = createMockApiResponse(createMockCourse({ id: 42 }));
      vi.mocked(apiClient.put).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      await updateCourse(42, updateData);

      expect(apiClient.put).toHaveBeenCalledWith('/courses/42', expect.objectContaining({
        id: 42,
        fullname: 'New Name',
        summary: '<p>New summary</p>',
        format: 'weeks',
        startdate: 1704067200,
        enddate: 1717200000,
        categoryid: 10,
      }));
    });

    it('should throw error for invalid course ID (zero)', async () => {
      const updateData: UpdateCourseInput = {
        id: 0,
        fullname: 'Updated Name',
      };

      await expect(updateCourse(0, updateData)).rejects.toThrow(
        'Invalid course ID: must be a positive number'
      );
      expect(apiClient.put).not.toHaveBeenCalled();
    });

    it('should throw error for negative course ID', async () => {
      const updateData: UpdateCourseInput = {
        id: -1,
        fullname: 'Updated Name',
      };

      await expect(updateCourse(-5, updateData)).rejects.toThrow(
        'Invalid course ID: must be a positive number'
      );
    });

    it('should handle course not found error (404)', async () => {
      const updateData: UpdateCourseInput = {
        id: 999,
        fullname: 'Updated Name',
      };

      const error = createMockAxiosError(
        404,
        'Not Found',
        'COURSE_NOT_FOUND',
        'Course with ID 999 not found'
      );

      vi.mocked(apiClient.put).mockRejectedValueOnce(error);

      await expect(updateCourse(999, updateData)).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    it('should handle permission denied error (403)', async () => {
      const updateData: UpdateCourseInput = {
        id: 42,
        fullname: 'Updated Name',
      };

      const error = createMockAxiosError(
        403,
        'Forbidden',
        'PERMISSION_DENIED',
        'You do not have permission to update this course'
      );

      vi.mocked(apiClient.put).mockRejectedValueOnce(error);

      await expect(updateCourse(42, updateData)).rejects.toMatchObject({
        response: { status: 403 },
      });
    });

    it('should return updated course object', async () => {
      const updateData: UpdateCourseInput = {
        id: 42,
        fullname: 'Completely New Name',
        shortname: 'CNN',
      };

      const updatedCourse = createMockCourse({
        id: 42,
        fullname: 'Completely New Name',
        shortname: 'CNN',
      });
      const mockResponse = createMockApiResponse(updatedCourse);

      vi.mocked(apiClient.put).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await updateCourse(42, updateData);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(42);
      expect(result.data.fullname).toBe('Completely New Name');
      expect(result.data.shortname).toBe('CNN');
    });

    it('should trim whitespace from string fields', async () => {
      const updateData: UpdateCourseInput = {
        id: 42,
        fullname: '  Trimmed Name  ',
        shortname: '  TN  ',
        format: '  topics  ',
      };

      const mockResponse = createMockApiResponse(createMockCourse({ id: 42 }));
      vi.mocked(apiClient.put).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      await updateCourse(42, updateData);

      expect(apiClient.put).toHaveBeenCalledWith('/courses/42', expect.objectContaining({
        fullname: 'Trimmed Name',
        shortname: 'TN',
        format: 'topics',
      }));
    });
  });

  // ==========================================================================
  // deleteCourse() Tests
  // ==========================================================================

  describe('deleteCourse()', () => {
    it('should delete course successfully', async () => {
      const mockResponse = createMockApiResponse(undefined as unknown as void);

      vi.mocked(apiClient.delete).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await deleteCourse(42);

      expect(apiClient.delete).toHaveBeenCalledTimes(1);
      expect(apiClient.delete).toHaveBeenCalledWith('/courses/42');
      expect(result.success).toBe(true);
    });

    it('should throw error for invalid course ID (zero)', async () => {
      await expect(deleteCourse(0)).rejects.toThrow(
        'Invalid course ID: must be a positive number'
      );
      expect(apiClient.delete).not.toHaveBeenCalled();
    });

    it('should throw error for negative course ID', async () => {
      await expect(deleteCourse(-10)).rejects.toThrow(
        'Invalid course ID: must be a positive number'
      );
    });

    it('should handle course not found error (404)', async () => {
      const error = createMockAxiosError(
        404,
        'Not Found',
        'COURSE_NOT_FOUND',
        'Course with ID 999 not found'
      );

      vi.mocked(apiClient.delete).mockRejectedValueOnce(error);

      await expect(deleteCourse(999)).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    it('should handle permission denied error (403)', async () => {
      const error = createMockAxiosError(
        403,
        'Forbidden',
        'PERMISSION_DENIED',
        'You do not have permission to delete this course'
      );

      vi.mocked(apiClient.delete).mockRejectedValueOnce(error);

      await expect(deleteCourse(42)).rejects.toMatchObject({
        response: { status: 403 },
      });
    });

    it('should return success confirmation on deletion', async () => {
      const mockResponse: ApiResponse<void> = {
        success: true,
        data: undefined as unknown as void,
        meta: { timestamp: Date.now() },
      };

      vi.mocked(apiClient.delete).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await deleteCourse(42);

      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // enrollInCourse() Tests
  // ==========================================================================

  describe('enrollInCourse()', () => {
    it('should enroll current user without specifying userId', async () => {
      const mockResult = createMockEnrollmentResult({
        courseid: 42,
        userid: 10,
        success: true,
      });
      const mockResponse = createMockApiResponse(mockResult);

      vi.mocked(apiClient.post).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await enrollInCourse(42);

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith('/courses/42/enroll', {});
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.courseid).toBe(42);
    });

    it('should enroll specific user when userId is provided', async () => {
      const mockResult = createMockEnrollmentResult({
        courseid: 42,
        userid: 15,
      });
      const mockResponse = createMockApiResponse(mockResult);

      vi.mocked(apiClient.post).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await enrollInCourse(42, 15);

      expect(apiClient.post).toHaveBeenCalledWith('/courses/42/enroll', { userid: 15 });
      expect(result.data.userid).toBe(15);
    });

    it('should return enrollment status and details', async () => {
      const mockResult = createMockEnrollmentResult({
        success: true,
        courseid: 42,
        userid: 10,
        roleid: 5,
        message: 'Successfully enrolled as a student',
      });
      const mockResponse = createMockApiResponse(mockResult);

      vi.mocked(apiClient.post).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await enrollInCourse(42);

      expect(result.data).toEqual(
        expect.objectContaining({
          success: true,
          courseid: 42,
          userid: 10,
          roleid: 5,
          message: expect.any(String),
        })
      );
    });

    it('should verify response matches ApiResponse<EnrollmentResult> interface', async () => {
      const mockResult = createMockEnrollmentResult();
      const mockResponse = createMockApiResponse(mockResult);

      vi.mocked(apiClient.post).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await enrollInCourse(42);

      // Verify ApiResponse structure
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      // Verify EnrollmentResult structure
      expect(result.data).toHaveProperty('success');
      expect(result.data).toHaveProperty('courseid');
      expect(result.data).toHaveProperty('userid');
      expect(result.data).toHaveProperty('roleid');
      expect(result.data).toHaveProperty('message');
    });

    it('should throw error for invalid course ID', async () => {
      await expect(enrollInCourse(0)).rejects.toThrow(
        'Invalid course ID: must be a positive number'
      );
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('should throw error for negative course ID', async () => {
      await expect(enrollInCourse(-5)).rejects.toThrow(
        'Invalid course ID: must be a positive number'
      );
    });

    it('should handle course not found error (404)', async () => {
      const error = createMockAxiosError(
        404,
        'Not Found',
        'COURSE_NOT_FOUND',
        'Course with ID 999 not found'
      );

      vi.mocked(apiClient.post).mockRejectedValueOnce(error);

      await expect(enrollInCourse(999)).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    it('should handle permission denied error (403)', async () => {
      const error = createMockAxiosError(
        403,
        'Forbidden',
        'ENROLLMENT_NOT_ALLOWED',
        'Self-enrollment is not allowed for this course'
      );

      vi.mocked(apiClient.post).mockRejectedValueOnce(error);

      await expect(enrollInCourse(42)).rejects.toMatchObject({
        response: {
          status: 403,
          data: {
            error: {
              code: 'ENROLLMENT_NOT_ALLOWED',
            },
          },
        },
      });
    });

    it('should handle already enrolled scenario', async () => {
      const mockResult = createMockEnrollmentResult({
        success: false,
        courseid: 42,
        userid: 10,
        message: 'User is already enrolled in this course',
      });
      const mockResponse = createMockApiResponse(mockResult);

      vi.mocked(apiClient.post).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await enrollInCourse(42);

      expect(result.data.success).toBe(false);
      expect(result.data.message).toContain('already enrolled');
    });

    it('should not include userId in payload when userId is 0', async () => {
      const mockResult = createMockEnrollmentResult();
      const mockResponse = createMockApiResponse(mockResult);

      vi.mocked(apiClient.post).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      await enrollInCourse(42, 0);

      expect(apiClient.post).toHaveBeenCalledWith('/courses/42/enroll', {});
    });
  });

  // ==========================================================================
  // unenrollFromCourse() Tests
  // ==========================================================================

  describe('unenrollFromCourse()', () => {
    it('should unenroll current user', async () => {
      const mockResult = createMockEnrollmentResult({
        success: true,
        courseid: 42,
        message: 'Successfully unenrolled from course',
      });
      const mockResponse = createMockApiResponse(mockResult);

      vi.mocked(apiClient.post).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await unenrollFromCourse(42);

      expect(apiClient.post).toHaveBeenCalledWith('/courses/42/unenroll', {});
      expect(result.data.success).toBe(true);
    });

    it('should unenroll specific user when userId is provided', async () => {
      const mockResult = createMockEnrollmentResult({
        courseid: 42,
        userid: 15,
      });
      const mockResponse = createMockApiResponse(mockResult);

      vi.mocked(apiClient.post).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      await unenrollFromCourse(42, 15);

      expect(apiClient.post).toHaveBeenCalledWith('/courses/42/unenroll', { userid: 15 });
    });

    it('should throw error for invalid course ID', async () => {
      await expect(unenrollFromCourse(0)).rejects.toThrow(
        'Invalid course ID: must be a positive number'
      );
    });

    it('should handle permission denied error', async () => {
      const error = createMockAxiosError(
        403,
        'Forbidden',
        'PERMISSION_DENIED',
        'Cannot unenroll from this course'
      );

      vi.mocked(apiClient.post).mockRejectedValueOnce(error);

      await expect(unenrollFromCourse(42)).rejects.toMatchObject({
        response: { status: 403 },
      });
    });
  });

  // ==========================================================================
  // getCourseContents() Tests
  // ==========================================================================

  describe('getCourseContents()', () => {
    it('should fetch course contents with no options', async () => {
      const mockSections = [
        createMockCourseContent({ id: 1, name: 'General', section: 0 }),
        createMockCourseContent({
          id: 2,
          name: 'Week 1',
          section: 1,
          modules: [createMockCourseModule()],
        }),
      ];
      const mockResponse = createMockApiResponse(mockSections);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await getCourseContents(42);

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledWith('/courses/42/contents', { params: {} });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should filter with excludeModules option', async () => {
      const mockSections = [createMockCourseContent({ modules: [] })];
      const mockResponse = createMockApiResponse(mockSections);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const options: ContentOptions = { excludeModules: true };
      await getCourseContents(42, options);

      expect(apiClient.get).toHaveBeenCalledWith('/courses/42/contents', {
        params: { excludemodules: true },
      });
    });

    it('should filter with excludeContents option', async () => {
      const mockResponse = createMockApiResponse([createMockCourseContent()]);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const options: ContentOptions = { excludeContents: true };
      await getCourseContents(42, options);

      expect(apiClient.get).toHaveBeenCalledWith('/courses/42/contents', {
        params: { excludecontents: true },
      });
    });

    it('should filter by sectionId', async () => {
      const mockSections = [createMockCourseContent({ id: 5 })];
      const mockResponse = createMockApiResponse(mockSections);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const options: ContentOptions = { sectionId: 5 };
      await getCourseContents(42, options);

      expect(apiClient.get).toHaveBeenCalledWith('/courses/42/contents', {
        params: { sectionid: 5 },
      });
    });

    it('should filter by sectionNumber', async () => {
      const mockSections = [createMockCourseContent({ section: 2 })];
      const mockResponse = createMockApiResponse(mockSections);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const options: ContentOptions = { sectionNumber: 2 };
      await getCourseContents(42, options);

      expect(apiClient.get).toHaveBeenCalledWith('/courses/42/contents', {
        params: { sectionnumber: 2 },
      });
    });

    it('should filter by course module ID (cmId)', async () => {
      const mockResponse = createMockApiResponse([createMockCourseContent()]);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const options: ContentOptions = { cmId: 156 };
      await getCourseContents(42, options);

      expect(apiClient.get).toHaveBeenCalledWith('/courses/42/contents', {
        params: { cmid: 156 },
      });
    });

    it('should filter by module name (modName)', async () => {
      const mockResponse = createMockApiResponse([createMockCourseContent()]);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const options: ContentOptions = { modName: 'assign' };
      await getCourseContents(42, options);

      expect(apiClient.get).toHaveBeenCalledWith('/courses/42/contents', {
        params: { modname: 'assign' },
      });
    });

    it('should trim whitespace from modName', async () => {
      const mockResponse = createMockApiResponse([createMockCourseContent()]);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      await getCourseContents(42, { modName: '  quiz  ' });

      expect(apiClient.get).toHaveBeenCalledWith('/courses/42/contents', {
        params: { modname: 'quiz' },
      });
    });

    it('should not include empty modName', async () => {
      const mockResponse = createMockApiResponse([createMockCourseContent()]);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      await getCourseContents(42, { modName: '   ' });

      expect(apiClient.get).toHaveBeenCalledWith('/courses/42/contents', { params: {} });
    });

    it('should combine multiple filter options', async () => {
      const mockResponse = createMockApiResponse([createMockCourseContent()]);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const options: ContentOptions = {
        excludeModules: false,
        excludeContents: true,
        sectionNumber: 1,
        modName: 'forum',
      };
      await getCourseContents(42, options);

      expect(apiClient.get).toHaveBeenCalledWith('/courses/42/contents', {
        params: {
          excludemodules: false,
          excludecontents: true,
          sectionnumber: 1,
          modname: 'forum',
        },
      });
    });

    it('should return sections, modules, and completion status', async () => {
      const mockModule = createMockCourseModule({
        id: 100,
        name: 'Assignment 1',
        completion: 2, // 2 = automatic completion
      });
      const mockSections = [
        createMockCourseContent({
          id: 1,
          name: 'Week 1',
          visible: true,
          uservisible: true,
          modules: [mockModule],
        }),
      ];
      const mockResponse = createMockApiResponse(mockSections);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await getCourseContents(42);

      const firstSection = result.data[0];
      expect(firstSection).toBeDefined();
      expect(firstSection!.name).toBe('Week 1');
      expect(firstSection!.visible).toBe(true);
      expect(firstSection!.uservisible).toBe(true);
      expect(firstSection!.modules).toHaveLength(1);
      const firstModule = firstSection!.modules[0];
      expect(firstModule).toBeDefined();
      expect(firstModule!.name).toBe('Assignment 1');
      expect(firstModule!.completion).toBe(2);
    });

    it('should verify response matches ApiResponse<CourseContent[]> interface', async () => {
      const mockSections = [createMockCourseContent()];
      const mockResponse = createMockApiResponse(mockSections);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await getCourseContents(42);

      // Verify ApiResponse structure
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);

      // Verify CourseContent structure
      if (result.data.length > 0) {
        const section = result.data[0];
        expect(section).toHaveProperty('id');
        expect(section).toHaveProperty('name');
        expect(section).toHaveProperty('visible');
        expect(section).toHaveProperty('summary');
        expect(section).toHaveProperty('section');
        expect(section).toHaveProperty('modules');
      }
    });

    it('should throw error for invalid course ID', async () => {
      await expect(getCourseContents(0)).rejects.toThrow(
        'Invalid course ID: must be a positive number'
      );
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('should throw error for negative course ID', async () => {
      await expect(getCourseContents(-5)).rejects.toThrow(
        'Invalid course ID: must be a positive number'
      );
    });

    it('should handle course not found error (404)', async () => {
      const error = createMockAxiosError(
        404,
        'Not Found',
        'COURSE_NOT_FOUND',
        'Course with ID 999 not found'
      );

      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(getCourseContents(999)).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    it('should handle permission denied error (403)', async () => {
      const error = createMockAxiosError(
        403,
        'Forbidden',
        'PERMISSION_DENIED',
        'You do not have permission to view course contents'
      );

      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(getCourseContents(42)).rejects.toMatchObject({
        response: {
          status: 403,
          data: {
            error: {
              code: 'PERMISSION_DENIED',
            },
          },
        },
      });
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should properly catch and format network errors', async () => {
      const networkError = new Error('Network Error');
      (networkError as NodeJS.ErrnoException).code = 'ECONNREFUSED';

      vi.mocked(apiClient.get).mockRejectedValueOnce(networkError);

      await expect(getCourses()).rejects.toThrow('Network Error');
    });

    it('should parse API error responses correctly', async () => {
      const error = createMockAxiosError(
        422,
        'Unprocessable Entity',
        'INVALID_INPUT',
        'The provided input is invalid'
      );

      vi.mocked(apiClient.post).mockRejectedValueOnce(error);

      await expect(
        createCourse({
          fullname: 'Test',
          shortname: 'T',
          categoryid: 1,
          format: 'topics',
          summary: '',
        })
      ).rejects.toMatchObject({
        response: {
          data: {
            error: {
              code: 'INVALID_INPUT',
              message: 'The provided input is invalid',
            },
          },
        },
      });
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 30000ms exceeded');
      (timeoutError as AxiosError).code = 'ECONNABORTED';

      vi.mocked(apiClient.get).mockRejectedValueOnce(timeoutError);

      await expect(getCourses()).rejects.toThrow('timeout');
    });

    it('should handle 500 Internal Server Error', async () => {
      const error = createMockAxiosError(
        500,
        'Internal Server Error',
        'SERVER_ERROR',
        'An unexpected error occurred on the server'
      );

      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(getCourse(42)).rejects.toMatchObject({
        response: { status: 500 },
      });
    });

    it('should handle 502 Bad Gateway Error', async () => {
      const error = createMockAxiosError(
        502,
        'Bad Gateway',
        'BAD_GATEWAY',
        'Invalid response from upstream server'
      );

      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(getCourse(42)).rejects.toMatchObject({
        response: { status: 502 },
      });
    });

    it('should handle 503 Service Unavailable Error', async () => {
      const error = createMockAxiosError(
        503,
        'Service Unavailable',
        'SERVICE_UNAVAILABLE',
        'The service is temporarily unavailable'
      );

      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(getCourses()).rejects.toMatchObject({
        response: { status: 503 },
      });
    });
  });

  // ==========================================================================
  // TypeScript Type Safety Tests
  // ==========================================================================

  describe('TypeScript Type Safety', () => {
    it('should infer correct types for getCourses response', async () => {
      const mockResponse = createMockPaginatedResponse(
        [createMockCourse()] as Course[],
        { page: 1, perPage: 20, total: 1, totalPages: 1 }
      );

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await getCourses();

      // TypeScript should infer PaginatedResponse<Course>
      const items = result.data.items;
      expect(items.length).toBeGreaterThan(0);
      const firstItem = items[0]!;

      // These properties should be accessible with correct types
      expect(typeof firstItem.id).toBe('number');
      expect(typeof firstItem.fullname).toBe('string');
      expect(typeof firstItem.shortname).toBe('string');
    });

    it('should infer correct types for getCourse response', async () => {
      const mockResponse = createMockApiResponse(createMockCourse());

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await getCourse(42);

      // TypeScript should infer ApiResponse<Course>
      const course = result.data;

      // These properties should be accessible with correct types
      expect(typeof course.id).toBe('number');
      expect(typeof course.fullname).toBe('string');
      expect(typeof course.format).toBe('string');
      expect(typeof course.visible).toBe('boolean');
      expect(typeof course.startdate).toBe('number');
    });

    it('should enforce CreateCourseInput interface', async () => {
      const validInput: CreateCourseInput = {
        fullname: 'Test Course',
        shortname: 'TC',
        categoryid: 1,
        format: 'topics',
        summary: 'Test summary',
        startdate: 1704067200,
        enddate: 1717200000,
        visible: true,
      };

      const mockResponse = createMockApiResponse(createMockCourse());
      vi.mocked(apiClient.post).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      // Should compile without errors
      await createCourse(validInput);

      expect(apiClient.post).toHaveBeenCalled();
    });

    it('should enforce UpdateCourseInput interface', async () => {
      const validInput: UpdateCourseInput = {
        id: 42,
        fullname: 'Updated Course',
        visible: false,
      };

      const mockResponse = createMockApiResponse(createMockCourse());
      vi.mocked(apiClient.put).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      // Should compile without errors
      await updateCourse(42, validInput);

      expect(apiClient.put).toHaveBeenCalled();
    });

    it('should infer correct types for enrollInCourse response', async () => {
      const mockResponse = createMockApiResponse(createMockEnrollmentResult());

      vi.mocked(apiClient.post).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await enrollInCourse(42);

      // TypeScript should infer ApiResponse<EnrollmentResult>
      const enrollment = result.data;

      expect(typeof enrollment.success).toBe('boolean');
      expect(typeof enrollment.courseid).toBe('number');
      expect(typeof enrollment.userid).toBe('number');
      expect(typeof enrollment.roleid).toBe('number');
      expect(typeof enrollment.message).toBe('string');
    });

    it('should infer correct types for getCourseContents response', async () => {
      const mockModule = createMockCourseModule();
      const mockSection = createMockCourseContent({ modules: [mockModule] });
      const mockResponse = createMockApiResponse([mockSection]);

      vi.mocked(apiClient.get).mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await getCourseContents(42);

      // TypeScript should infer ApiResponse<CourseContent[]>
      const sections = result.data;
      expect(sections.length).toBeGreaterThan(0);
      const firstSection = sections[0]!;

      expect(typeof firstSection.id).toBe('number');
      expect(typeof firstSection.name).toBe('string');
      expect(Array.isArray(firstSection.modules)).toBe(true);

      expect(firstSection.modules.length).toBeGreaterThan(0);
      const firstModule = firstSection.modules[0]!;
      expect(typeof firstModule.id).toBe('number');
      expect(typeof firstModule.name).toBe('string');
    });
  });

  // ==========================================================================
  // Request Header Verification
  // ==========================================================================

  describe('Request Configuration', () => {
    it('should use correct HTTP methods for each operation', async () => {
      const mockCourseResponse = createMockApiResponse(createMockCourse());
      const mockEnrollResponse = createMockApiResponse(createMockEnrollmentResult());
      const mockDeleteResponse = createMockApiResponse(undefined as unknown as void);

      vi.mocked(apiClient.get).mockResolvedValue(createMockAxiosResponse(mockCourseResponse));
      vi.mocked(apiClient.post).mockResolvedValue(createMockAxiosResponse(mockCourseResponse));
      vi.mocked(apiClient.put).mockResolvedValue(createMockAxiosResponse(mockCourseResponse));
      vi.mocked(apiClient.delete).mockResolvedValue(createMockAxiosResponse(mockDeleteResponse));

      // GET operations
      await getCourses();
      expect(apiClient.get).toHaveBeenCalledWith('/courses', expect.anything());

      await getCourse(1);
      expect(apiClient.get).toHaveBeenCalledWith('/courses/1');

      await getCourseContents(1);
      expect(apiClient.get).toHaveBeenCalledWith('/courses/1/contents', expect.anything());

      // POST operations
      await createCourse({
        fullname: 'Test',
        shortname: 'T',
        categoryid: 1,
        format: 'topics',
        summary: '',
      });
      expect(apiClient.post).toHaveBeenCalledWith('/courses', expect.anything());

      vi.mocked(apiClient.post).mockResolvedValueOnce(createMockAxiosResponse(mockEnrollResponse));
      await enrollInCourse(1);
      expect(apiClient.post).toHaveBeenCalledWith('/courses/1/enroll', expect.anything());

      // PUT operations
      await updateCourse(1, { id: 1, fullname: 'Updated' });
      expect(apiClient.put).toHaveBeenCalledWith('/courses/1', expect.anything());

      // DELETE operations
      await deleteCourse(1);
      expect(apiClient.delete).toHaveBeenCalledWith('/courses/1');
    });

    it('should construct correct endpoint URLs with dynamic IDs', async () => {
      const mockResponse = createMockApiResponse(createMockCourse());

      vi.mocked(apiClient.get).mockResolvedValue(createMockAxiosResponse(mockResponse));
      vi.mocked(apiClient.put).mockResolvedValue(createMockAxiosResponse(mockResponse));
      vi.mocked(apiClient.delete).mockResolvedValue(
        createMockAxiosResponse(createMockApiResponse(undefined as unknown as void))
      );

      // Test various course IDs
      await getCourse(1);
      expect(apiClient.get).toHaveBeenCalledWith('/courses/1');

      await getCourse(999);
      expect(apiClient.get).toHaveBeenCalledWith('/courses/999');

      await getCourse(123456);
      expect(apiClient.get).toHaveBeenCalledWith('/courses/123456');

      await updateCourse(42, { id: 42, fullname: 'Test' });
      expect(apiClient.put).toHaveBeenCalledWith('/courses/42', expect.anything());

      await deleteCourse(55);
      expect(apiClient.delete).toHaveBeenCalledWith('/courses/55');
    });
  });
});
