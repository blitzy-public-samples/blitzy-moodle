/**
 * MSW Request Handlers for Gradebook API Endpoints
 * 
 * Provides comprehensive mock handlers for all gradebook-related API endpoints
 * including course grades, user grades, grade items, categories, and reports.
 * Supports various test scenarios with realistic mock data including different
 * aggregation methods, category weights, grade overrides, and complex grade
 * calculations matching Moodle's gradebook behavior.
 * 
 * Based on:
 * - public/grade/report/user/index.php
 * - public/grade/report/grader/index.php
 * - public/grade/lib.php
 */

import { http, HttpResponse } from 'msw';
import type { ApiResponse } from '@/types/api';
import type { GradeItem } from '@/types/entities';

/**
 * Grade aggregation methods supported by Moodle
 */
type AggregationMethod =
  | 'AGGREGATION_MEAN_WEIGHTED' // Weighted mean of grades
  | 'AGGREGATION_MEAN_SIMPLE' // Simple mean of grades
  | 'AGGREGATION_MEDIAN' // Median of grades
  | 'AGGREGATION_HIGHEST' // Highest grade
  | 'AGGREGATION_LOWEST' // Lowest grade
  | 'AGGREGATION_MODE' // Most common grade
  | 'AGGREGATION_SUM' // Sum of grades
  | 'AGGREGATION_NATURAL'; // Natural (weighted mean + extra credit)

/**
 * Grade category structure
 */
interface GradeCategory {
  id: number;
  courseid: number;
  parent?: number;
  depth: number;
  path: string;
  fullname: string;
  aggregation: AggregationMethod;
  keephigh: number; // Keep highest N grades
  droplow: number; // Drop lowest N grades
  aggregateonlygraded: boolean; // Exclude empty grades
  aggregateoutcomes: boolean;
  hidden: boolean;
  locked: boolean;
  weight?: number; // Category weight in parent
  children?: GradeCategory[];
  items?: GradeItem[];
}

/**
 * Complete gradebook structure for a course
 */
interface CourseGradebook {
  courseid: number;
  coursename: string;
  aggregation: AggregationMethod;
  categories: GradeCategory[];
  items: GradeItemWithGrade[];
  students?: StudentGrade[];
  canViewAllGrades: boolean;
  canEditGrades: boolean;
}

/**
 * Grade item with user's grade data
 */
interface GradeItemWithGrade extends GradeItem {
  grade?: {
    id: number;
    userid: number;
    rawgrade?: number;
    finalgrade?: number;
    feedback?: string;
    feedbackformat: number;
    hidden: boolean;
    locked: boolean;
    overridden: boolean;
    excluded: boolean;
    timemodified: number;
  };
  categoryname?: string;
  weight?: number;
  lettergrade?: string;
  percentage?: number;
  contributionToCategory?: number;
  contributionToCourse?: number;
}

/**
 * Student grade summary
 */
interface StudentGrade {
  userid: number;
  firstname: string;
  lastname: string;
  email: string;
  grades: Array<{
    itemid: number;
    itemname: string;
    rawgrade?: number;
    finalgrade?: number;
    percentage?: number;
    lettergrade?: string;
    feedback?: string;
  }>;
  coursetotal?: number;
  coursetotalpercentage?: number;
}

/**
 * User grades across all enrolled courses
 */
interface UserGradesResponse {
  userid: number;
  courses: Array<{
    courseid: number;
    coursename: string;
    coursetotal?: number;
    coursetotalpercentage?: number;
    lettergrade?: string;
    categories: Array<{
      categoryid: number;
      categoryname: string;
      total?: number;
      weight?: number;
    }>;
    items: GradeItemWithGrade[];
    history?: Array<{
      itemid: number;
      oldgrade?: number;
      newgrade?: number;
      timemodified: number;
      usermodified: number;
      reason?: string;
    }>;
  }>;
}

/**
 * Grade update request
 */
interface GradeUpdateRequest {
  rawgrade?: number;
  feedback?: string;
  feedbackformat?: number;
  excluded?: boolean;
  overridden?: boolean;
  reason?: string;
}

/**
 * Grade category creation request
 */
interface CategoryCreateRequest {
  fullname: string;
  aggregation: AggregationMethod;
  courseid: number;
  parent?: number;
  keephigh?: number;
  droplow?: number;
  aggregateonlygraded?: boolean;
}

/**
 * Gradebook report request
 */
interface GradebookReportRequest {
  courseid: number;
  userid?: number;
  reportType: 'user' | 'grader' | 'overview' | 'outcomes' | 'singleview';
  dateFrom?: number;
  dateTo?: number;
}

/**
 * Mock grade data for various courses
 */
const mockGradebooks: Record<number, CourseGradebook> = {
  // Course 1: Complex weighted gradebook with multiple categories
  1: {
    courseid: 1,
    coursename: 'Advanced Web Development',
    aggregation: 'AGGREGATION_MEAN_WEIGHTED',
    canViewAllGrades: true,
    canEditGrades: true,
    categories: [
      {
        id: 1,
        courseid: 1,
        depth: 1,
        path: '/1',
        fullname: 'Assignments',
        aggregation: 'AGGREGATION_MEAN_WEIGHTED',
        keephigh: 0,
        droplow: 1, // Drop lowest assignment
        aggregateonlygraded: true,
        aggregateoutcomes: false,
        hidden: false,
        locked: false,
        weight: 40,
      },
      {
        id: 2,
        courseid: 1,
        depth: 1,
        path: '/2',
        fullname: 'Quizzes',
        aggregation: 'AGGREGATION_HIGHEST',
        keephigh: 0,
        droplow: 0,
        aggregateonlygraded: true,
        aggregateoutcomes: false,
        hidden: false,
        locked: false,
        weight: 30,
      },
      {
        id: 3,
        courseid: 1,
        depth: 1,
        path: '/3',
        fullname: 'Final Project',
        aggregation: 'AGGREGATION_SUM',
        keephigh: 0,
        droplow: 0,
        aggregateonlygraded: false,
        aggregateoutcomes: false,
        hidden: false,
        locked: false,
        weight: 30,
      },
    ],
    items: [
      // Assignment category items
      {
        id: 101,
        courseid: 1,
        categoryid: 1,
        itemname: 'Assignment 1: HTML Basics',
        itemtype: 'mod',
        itemmodule: 'assign',
        iteminstance: 1,
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        gradepass: 60,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 0.0,
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 1,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        categoryname: 'Assignments',
        weight: 25,
        grade: {
          id: 1001,
          userid: 42,
          rawgrade: 85,
          finalgrade: 85,
          feedback: 'Good work on HTML structure',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000 * 7,
        },
        percentage: 85,
        lettergrade: 'B',
        contributionToCategory: 21.25,
        contributionToCourse: 8.5,
      },
      {
        id: 102,
        courseid: 1,
        categoryid: 1,
        itemname: 'Assignment 2: CSS Styling',
        itemtype: 'mod',
        itemmodule: 'assign',
        iteminstance: 2,
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        gradepass: 60,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 0.0,
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 2,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        categoryname: 'Assignments',
        weight: 25,
        grade: {
          id: 1002,
          userid: 42,
          rawgrade: 92,
          finalgrade: 92,
          feedback: 'Excellent CSS implementation',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000 * 5,
        },
        percentage: 92,
        lettergrade: 'A',
        contributionToCategory: 23.0,
        contributionToCourse: 9.2,
      },
      {
        id: 103,
        courseid: 1,
        categoryid: 1,
        itemname: 'Assignment 3: JavaScript Fundamentals',
        itemtype: 'mod',
        itemmodule: 'assign',
        iteminstance: 3,
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        gradepass: 60,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 0.0,
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 3,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        categoryname: 'Assignments',
        weight: 25,
        grade: {
          id: 1003,
          userid: 42,
          rawgrade: 78,
          finalgrade: 78,
          feedback: 'Good effort, review async concepts',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000 * 3,
        },
        percentage: 78,
        lettergrade: 'C+',
        contributionToCategory: 19.5,
        contributionToCourse: 7.8,
      },
      {
        id: 104,
        courseid: 1,
        categoryid: 1,
        itemname: 'Assignment 4: React Components',
        itemtype: 'mod',
        itemmodule: 'assign',
        iteminstance: 4,
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        gradepass: 60,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 0.0,
        aggregationcoef2: 1.5, // Extra credit
        weightoverride: false,
        sortorder: 4,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        categoryname: 'Assignments',
        weight: 25,
        grade: {
          id: 1004,
          userid: 42,
          rawgrade: 95,
          finalgrade: 95,
          feedback: 'Outstanding React implementation!',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000,
        },
        percentage: 95,
        lettergrade: 'A',
        contributionToCategory: 23.75,
        contributionToCourse: 9.5,
      },
      // Quiz category items
      {
        id: 201,
        courseid: 1,
        categoryid: 2,
        itemname: 'Midterm Quiz',
        itemtype: 'mod',
        itemmodule: 'quiz',
        iteminstance: 10,
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        gradepass: 70,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 0.0,
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 5,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        categoryname: 'Quizzes',
        weight: 50,
        grade: {
          id: 2001,
          userid: 42,
          rawgrade: 88,
          finalgrade: 88,
          feedback: '',
          feedbackformat: 1,
          hidden: false,
          locked: true,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000 * 10,
        },
        percentage: 88,
        lettergrade: 'B+',
        contributionToCategory: 44.0,
        contributionToCourse: 13.2,
      },
      {
        id: 202,
        courseid: 1,
        categoryid: 2,
        itemname: 'Final Quiz',
        itemtype: 'mod',
        itemmodule: 'quiz',
        iteminstance: 11,
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        gradepass: 70,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 0.0,
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 6,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        categoryname: 'Quizzes',
        weight: 50,
        grade: {
          id: 2002,
          userid: 42,
          rawgrade: 91,
          finalgrade: 91,
          feedback: '',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000 * 2,
        },
        percentage: 91,
        lettergrade: 'A-',
        contributionToCategory: 45.5,
        contributionToCourse: 13.65,
      },
      // Final Project
      {
        id: 301,
        courseid: 1,
        categoryid: 3,
        itemname: 'Final Project',
        itemtype: 'mod',
        itemmodule: 'assign',
        iteminstance: 20,
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        gradepass: 70,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 0.0,
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 7,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        categoryname: 'Final Project',
        weight: 100,
        grade: {
          id: 3001,
          userid: 42,
          rawgrade: 89,
          finalgrade: 89,
          feedback: 'Excellent project with great attention to detail',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000,
        },
        percentage: 89,
        lettergrade: 'B+',
        contributionToCategory: 89.0,
        contributionToCourse: 26.7,
      },
      // Course total (computed)
      {
        id: 1000,
        courseid: 1,
        categoryid: undefined,
        itemname: 'Course Total',
        itemtype: 'course',
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 0.0,
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 9999,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        grade: {
          id: 9999,
          userid: 42,
          rawgrade: 87.85,
          finalgrade: 87.85,
          feedback: '',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now(),
        },
        percentage: 87.85,
        lettergrade: 'B+',
        contributionToCourse: 100,
      },
    ],
    students: [
      {
        userid: 42,
        firstname: 'John',
        lastname: 'Doe',
        email: 'john.doe@example.com',
        coursetotal: 87.85,
        coursetotalpercentage: 87.85,
        grades: [],
      },
    ],
  },
  // Course 2: Simple mean aggregation
  2: {
    courseid: 2,
    coursename: 'Introduction to Programming',
    aggregation: 'AGGREGATION_MEAN_SIMPLE',
    canViewAllGrades: true,
    canEditGrades: false,
    categories: [
      {
        id: 10,
        courseid: 2,
        depth: 1,
        path: '/10',
        fullname: 'Course',
        aggregation: 'AGGREGATION_MEAN_SIMPLE',
        keephigh: 0,
        droplow: 0,
        aggregateonlygraded: true,
        aggregateoutcomes: false,
        hidden: false,
        locked: false,
      },
    ],
    items: [
      {
        id: 1001,
        courseid: 2,
        categoryid: 10,
        itemname: 'Quiz 1',
        itemtype: 'mod',
        itemmodule: 'quiz',
        iteminstance: 100,
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 0.0,
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 1,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        grade: {
          id: 10001,
          userid: 42,
          rawgrade: 75,
          finalgrade: 75,
          feedback: '',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000 * 15,
        },
        percentage: 75,
        lettergrade: 'C',
      },
      {
        id: 1002,
        courseid: 2,
        categoryid: 10,
        itemname: 'Quiz 2',
        itemtype: 'mod',
        itemmodule: 'quiz',
        iteminstance: 101,
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 0.0,
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 2,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        grade: {
          id: 10002,
          userid: 42,
          rawgrade: 82,
          finalgrade: 82,
          feedback: '',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000 * 8,
        },
        percentage: 82,
        lettergrade: 'B-',
      },
      {
        id: 1003,
        courseid: 2,
        categoryid: 10,
        itemname: 'Final Exam',
        itemtype: 'mod',
        itemmodule: 'quiz',
        iteminstance: 102,
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        gradepass: 60,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 0.0,
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 3,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        grade: {
          id: 10003,
          userid: 42,
          rawgrade: 88,
          finalgrade: 88,
          feedback: 'Well done!',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000,
        },
        percentage: 88,
        lettergrade: 'B+',
      },
      {
        id: 2000,
        courseid: 2,
        itemname: 'Course Total',
        itemtype: 'course',
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 0.0,
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 9999,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        grade: {
          id: 20000,
          userid: 42,
          rawgrade: 81.67,
          finalgrade: 81.67,
          feedback: '',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now(),
        },
        percentage: 81.67,
        lettergrade: 'B-',
      },
    ],
    students: [],
  },
};

/**
 * Calculate letter grade from percentage
 */
function getLetterGrade(percentage: number): string {
  if (percentage >= 93) return 'A';
  if (percentage >= 90) return 'A-';
  if (percentage >= 87) return 'B+';
  if (percentage >= 83) return 'B';
  if (percentage >= 80) return 'B-';
  if (percentage >= 77) return 'C+';
  if (percentage >= 73) return 'C';
  if (percentage >= 70) return 'C-';
  if (percentage >= 67) return 'D+';
  if (percentage >= 63) return 'D';
  if (percentage >= 60) return 'D-';
  return 'F';
}

/**
 * Simulate network latency
 */
function simulateLatency(): Promise<void> {
  const latency = Math.floor(Math.random() * 300) + 100; // 100-400ms
  return new Promise((resolve) => setTimeout(resolve, latency));
}

/**
 * MSW Handlers for gradebook endpoints
 */
export const gradesHandlers = [
  /**
   * GET /api/v1/gradebook/course/:id
   * Get complete gradebook for a course
   */
  http.get('/api/v1/gradebook/course/:id', async ({ params, request }) => {
    await simulateLatency();

    const courseId = Number(params.id);
    const url = new URL(request.url);
    const userId = url.searchParams.get('userid');
    const includeHidden = url.searchParams.get('includeHidden') === 'true';

    // Simulate authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    // Check if course gradebook exists
    const gradebook = mockGradebooks[courseId];
    if (!gradebook) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Gradebook for course ${courseId} not found`,
            details: {
              resourceType: 'gradebook',
              resourceId: courseId,
            },
          },
        },
        { status: 404 }
      );
    }

    // Filter hidden items if not authorized
    let items = gradebook.items;
    if (!includeHidden && !gradebook.canViewAllGrades) {
      items = items.filter((item) => !item.hidden && !item.grade?.hidden);
    }

    const response: ApiResponse<CourseGradebook> = {
      success: true,
      data: {
        ...gradebook,
        items,
      },
      meta: {
        timestamp: Date.now(),
      },
    };

    return HttpResponse.json(response);
  }),

  /**
   * GET /api/v1/gradebook/user/:id
   * Get user grades across all enrolled courses
   */
  http.get('/api/v1/gradebook/user/:id', async ({ params, request }) => {
    await simulateLatency();

    const userId = Number(params.id);
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');

    // Simulate authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    // Build user grades response
    const userGrades: UserGradesResponse = {
      userid: userId,
      courses: Object.values(mockGradebooks).map((gradebook) => ({
        courseid: gradebook.courseid,
        coursename: gradebook.coursename,
        coursetotal: gradebook.items.find((i) => i.itemtype === 'course')
          ?.grade?.finalgrade,
        coursetotalpercentage: gradebook.items.find((i) => i.itemtype === 'course')
          ?.percentage,
        lettergrade: gradebook.items.find((i) => i.itemtype === 'course')
          ?.lettergrade,
        categories: gradebook.categories.map((cat) => ({
          categoryid: cat.id,
          categoryname: cat.fullname,
          total: undefined, // Would calculate from items
          weight: cat.weight,
        })),
        items: gradebook.items.filter((item) => item.itemtype !== 'course'),
        history: [
          {
            itemid: 101,
            oldgrade: 82,
            newgrade: 85,
            timemodified: Date.now() - 86400000 * 8,
            usermodified: 1,
            reason: 'Grade adjustment after review',
          },
        ],
      })),
    };

    const response: ApiResponse<UserGradesResponse> = {
      success: true,
      data: userGrades,
      meta: {
        timestamp: Date.now(),
      },
    };

    return HttpResponse.json(response);
  }),

  /**
   * GET /api/v1/gradebook/items
   * Get list of grade items (with optional course filter)
   */
  http.get('/api/v1/gradebook/items', async ({ request }) => {
    await simulateLatency();

    const url = new URL(request.url);
    const courseId = url.searchParams.get('courseid');
    const page = Number(url.searchParams.get('page') || '1');
    const perPage = Number(url.searchParams.get('perPage') || '20');

    // Simulate authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    // Collect all grade items
    let allItems: GradeItem[] = [];
    if (courseId) {
      const gradebook = mockGradebooks[Number(courseId)];
      if (gradebook) {
        allItems = gradebook.items.map(({ grade, ...item }) => item as GradeItem);
      }
    } else {
      allItems = Object.values(mockGradebooks).flatMap((gradebook) =>
        gradebook.items.map(({ grade, ...item }) => item as GradeItem)
      );
    }

    // Pagination
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedItems = allItems.slice(startIndex, endIndex);

    const response: ApiResponse<GradeItem[]> = {
      success: true,
      data: paginatedItems,
      meta: {
        pagination: {
          page,
          perPage,
          total: allItems.length,
          totalPages: Math.ceil(allItems.length / perPage),
        },
        timestamp: Date.now(),
      },
    };

    return HttpResponse.json(response);
  }),

  /**
   * PUT /api/v1/gradebook/items/:id
   * Update a grade item (grade value, feedback, exclusion flags)
   */
  http.put('/api/v1/gradebook/items/:id', async ({ params, request }) => {
    await simulateLatency();

    const itemId = Number(params.id);

    // Simulate authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    // Parse request body
    const updateData = (await request.json()) as GradeUpdateRequest;

    // Find the grade item
    let foundItem: GradeItemWithGrade | undefined;
    let foundGradebook: CourseGradebook | undefined;

    for (const gradebook of Object.values(mockGradebooks)) {
      const item = gradebook.items.find((i) => i.id === itemId);
      if (item) {
        foundItem = item;
        foundGradebook = gradebook;
        break;
      }
    }

    if (!foundItem || !foundGradebook) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Grade item ${itemId} not found`,
            details: {
              resourceType: 'gradeItem',
              resourceId: itemId,
            },
          },
        },
        { status: 404 }
      );
    }

    // Check permissions
    if (!foundGradebook.canEditGrades) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to edit grades',
            details: {
              required_capability: 'moodle/grade:edit',
              context: 'course',
            },
          },
        },
        { status: 403 }
      );
    }

    // Check if item is locked
    if (foundItem.grade?.locked) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Grade item is locked and cannot be modified',
            details: {
              itemId,
              locked: true,
            },
          },
        },
        { status: 409 }
      );
    }

    // Validate grade range
    if (
      updateData.rawgrade !== undefined &&
      (updateData.rawgrade < foundItem.grademin ||
        updateData.rawgrade > foundItem.grademax)
    ) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Grade value out of range',
            details: {
              field: 'rawgrade',
              value: updateData.rawgrade,
              min: foundItem.grademin,
              max: foundItem.grademax,
            },
          },
        },
        { status: 422 }
      );
    }

    // Update grade
    if (foundItem.grade) {
      if (updateData.rawgrade !== undefined) {
        foundItem.grade.rawgrade = updateData.rawgrade;
        foundItem.grade.finalgrade = updateData.rawgrade;
        foundItem.percentage = (updateData.rawgrade / foundItem.grademax) * 100;
        foundItem.lettergrade = getLetterGrade(foundItem.percentage);
      }
      if (updateData.feedback !== undefined) {
        foundItem.grade.feedback = updateData.feedback;
      }
      if (updateData.feedbackformat !== undefined) {
        foundItem.grade.feedbackformat = updateData.feedbackformat;
      }
      if (updateData.excluded !== undefined) {
        foundItem.grade.excluded = updateData.excluded;
      }
      if (updateData.overridden !== undefined) {
        foundItem.grade.overridden = updateData.overridden;
      }
      foundItem.grade.timemodified = Date.now();
    }

    // Recalculate course total (simplified)
    const categoryItems = foundGradebook.items.filter(
      (i) => i.categoryid === foundItem!.categoryid && i.itemtype !== 'category'
    );
    const categoryTotal =
      categoryItems.reduce((sum, i) => sum + (i.grade?.finalgrade || 0), 0) /
      categoryItems.length;

    const response: ApiResponse<GradeItemWithGrade> = {
      success: true,
      data: {
        ...foundItem,
        contributionToCategory: categoryTotal,
      },
      meta: {
        timestamp: Date.now(),
        message: 'Grade updated successfully. Course totals recalculated.',
      },
    };

    return HttpResponse.json(response);
  }),

  /**
   * GET /api/v1/gradebook/categories
   * Get grade categories for a course
   */
  http.get('/api/v1/gradebook/categories', async ({ request }) => {
    await simulateLatency();

    const url = new URL(request.url);
    const courseId = Number(url.searchParams.get('courseid'));

    // Simulate authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const gradebook = mockGradebooks[courseId];
    if (!gradebook) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Course ${courseId} not found`,
          },
        },
        { status: 404 }
      );
    }

    const response: ApiResponse<GradeCategory[]> = {
      success: true,
      data: gradebook.categories,
      meta: {
        timestamp: Date.now(),
      },
    };

    return HttpResponse.json(response);
  }),

  /**
   * POST /api/v1/gradebook/categories
   * Create a new grade category
   */
  http.post('/api/v1/gradebook/categories', async ({ request }) => {
    await simulateLatency();

    // Simulate authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const categoryData = (await request.json()) as CategoryCreateRequest;

    // Validate required fields
    if (!categoryData.fullname || !categoryData.courseid) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields',
            details: {
              required: ['fullname', 'courseid'],
            },
          },
        },
        { status: 422 }
      );
    }

    // Check if course exists
    const gradebook = mockGradebooks[categoryData.courseid];
    if (!gradebook) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Course ${categoryData.courseid} not found`,
          },
        },
        { status: 404 }
      );
    }

    // Create new category
    const newCategory: GradeCategory = {
      id: Math.floor(Math.random() * 10000) + 1000,
      courseid: categoryData.courseid,
      parent: categoryData.parent,
      depth: categoryData.parent ? 2 : 1,
      path: `/${categoryData.parent || 0}`,
      fullname: categoryData.fullname,
      aggregation: categoryData.aggregation || 'AGGREGATION_MEAN_WEIGHTED',
      keephigh: categoryData.keephigh || 0,
      droplow: categoryData.droplow || 0,
      aggregateonlygraded: categoryData.aggregateonlygraded ?? true,
      aggregateoutcomes: false,
      hidden: false,
      locked: false,
    };

    gradebook.categories.push(newCategory);

    const response: ApiResponse<GradeCategory> = {
      success: true,
      data: newCategory,
      meta: {
        timestamp: Date.now(),
      },
    };

    return HttpResponse.json(response, { status: 201 });
  }),

  /**
   * GET /api/v1/gradebook/export
   * Export gradebook data
   */
  http.get('/api/v1/gradebook/export', async ({ request }) => {
    await simulateLatency();

    const url = new URL(request.url);
    const courseId = Number(url.searchParams.get('courseid'));
    const format = url.searchParams.get('format') || 'csv';

    // Simulate authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const gradebook = mockGradebooks[courseId];
    if (!gradebook) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Course ${courseId} not found`,
          },
        },
        { status: 404 }
      );
    }

    // Generate export data (simplified CSV format)
    const headers = ['Student', 'Email', ...gradebook.items.map((i) => i.itemname)];
    const rows = gradebook.students?.map((student) => [
      `${student.firstname} ${student.lastname}`,
      student.email,
      ...gradebook.items.map(
        (item) => item.grade?.finalgrade?.toString() || '-'
      ),
    ]);

    const exportData = {
      format,
      headers,
      rows: rows || [],
      generatedAt: Date.now(),
    };

    const response: ApiResponse<typeof exportData> = {
      success: true,
      data: exportData,
      meta: {
        timestamp: Date.now(),
      },
    };

    return HttpResponse.json(response);
  }),

  /**
   * GET /api/v1/gradebook/report
   * Generate gradebook report
   */
  http.get('/api/v1/gradebook/report', async ({ request }) => {
    await simulateLatency();

    const url = new URL(request.url);
    const courseId = Number(url.searchParams.get('courseid'));
    const userId = url.searchParams.get('userid');
    const reportType = url.searchParams.get('reportType') || 'user';

    // Simulate authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const gradebook = mockGradebooks[courseId];
    if (!gradebook) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Course ${courseId} not found`,
          },
        },
        { status: 404 }
      );
    }

    // Generate report based on type
    const reportData = {
      reportType,
      courseid: courseId,
      coursename: gradebook.coursename,
      generatedAt: Date.now(),
      data:
        reportType === 'user'
          ? {
              userid: userId ? Number(userId) : 42,
              items: gradebook.items,
              visualization: {
                categoryBreakdown: gradebook.categories.map((cat) => ({
                  category: cat.fullname,
                  score: Math.random() * 100,
                  weight: cat.weight,
                })),
                progressIndicators: {
                  completed: 7,
                  total: 7,
                  percentage: 100,
                },
              },
            }
          : {
              students: gradebook.students,
              summary: {
                averageGrade: 85.5,
                medianGrade: 87.0,
                highestGrade: 95.0,
                lowestGrade: 75.0,
              },
            },
    };

    const response: ApiResponse<typeof reportData> = {
      success: true,
      data: reportData,
      meta: {
        timestamp: Date.now(),
      },
    };

    return HttpResponse.json(response);
  }),
];
