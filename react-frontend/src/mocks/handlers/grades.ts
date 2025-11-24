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
  modificationHistory?: Array<{
    date: string;
    grade: number | string;
    modifiedBy: string;
    action: string;
  }>;
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
 * DEPRECATED: This interface is no longer used.
 * The actual API response format is defined in gradebookApi.ts as UserGradebookResponse.
 * Mock handlers now return data matching that format with camelCase property names.
 */
// interface UserGradesResponse {
//   userid: number;
//   courses: Array<{
//     courseid: number;
//     coursename: string;
//     coursetotal?: number;
//     coursetotalpercentage?: number;
//     lettergrade?: string;
//     categories: Array<{
//       categoryid: number;
//       categoryname: string;
//       total?: number;
//       weight?: number;
//     }>;
//     items: GradeItemWithGrade[];
//     history?: Array<{
//       itemid: number;
//       oldgrade?: number;
//       newgrade?: number;
//       timemodified: number;
//       usermodified: number;
//       reason?: string;
//     }>;
//   }>;
// }

/**
 * Grade update request
 */
interface GradeUpdateRequest {
  rawgrade?: number;
  finalgrade?: number; // Alias for rawgrade
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
 * Note: Interface removed - will be defined when report handlers are implemented
 */

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
        lettergrade: 'C',
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
        lettergrade: 'B',
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
        lettergrade: 'A',
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
        lettergrade: 'B',
        contributionToCategory: 89.0,
        contributionToCourse: 26.7,
      },
      // Extra assignment for testing update operations
      {
        id: 5001,
        courseid: 1,
        categoryid: 1,
        itemname: 'Extra Credit Assignment',
        itemtype: 'mod',
        itemmodule: 'assign',
        iteminstance: 21,
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        gradepass: 60,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 0.0,
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 8,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        categoryname: 'Assignments',
        weight: 25,
        grade: {
          id: 5001001,
          userid: 42,
          rawgrade: 80,
          finalgrade: 80,
          feedback: '',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000 * 5,
        },
        percentage: 80,
        lettergrade: 'B',
        contributionToCategory: 20.0,
        contributionToCourse: 8.0,
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
        lettergrade: 'B',
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
        lettergrade: 'B',
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
        lettergrade: 'B',
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
        lettergrade: 'B',
      },
    ],
    students: [],
  },
  // Course 101: Test course for E2E tests (matches testCourse1 in fixtures/courses.ts)
  101: {
    courseid: 101,
    coursename: 'Introduction to Programming',
    aggregation: 'AGGREGATION_MEAN_WEIGHTED',
    canViewAllGrades: true,
    canEditGrades: true,
    categories: [
      {
        id: 1001,
        courseid: 101,
        depth: 1,
        path: '/1001',
        fullname: 'Assignments',
        aggregation: 'AGGREGATION_MEAN_WEIGHTED',
        keephigh: 0,
        droplow: 0,
        aggregateonlygraded: true,
        aggregateoutcomes: false,
        hidden: false,
        locked: false,
        weight: 50,
      },
      {
        id: 1002,
        courseid: 101,
        depth: 1,
        path: '/1002',
        fullname: 'Quizzes',
        aggregation: 'AGGREGATION_MEAN_SIMPLE',
        keephigh: 0,
        droplow: 1,
        aggregateonlygraded: true,
        aggregateoutcomes: false,
        hidden: false,
        locked: false,
        weight: 50,
      },
    ],
    items: [
      // Programming Assignment 1 (Visible)
      {
        id: 2001,
        courseid: 101,
        categoryid: 1001,
        itemname: 'Programming Assignment 1',
        itemtype: 'mod',
        itemmodule: 'assign',
        iteminstance: 101,
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        gradepass: 60,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 2.0, // Weight of 2x
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 1,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        categoryname: 'Assignments',
        weight: 50,
        grade: {
          id: 3001,
          userid: 1001,
          rawgrade: 85.0,
          finalgrade: 85.0,
          feedback: 'Good work on the assignment',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000 * 3,
        },
        percentage: 85.0,
        lettergrade: 'B',
        contributionToCategory: 42.5,
        contributionToCourse: 21.25,
        modificationHistory: [
          {
            date: new Date(Date.now() - 86400000 * 5).toISOString(),
            grade: 85.0,
            modifiedBy: 'Prof. Smith',
            action: 'update',
          },
          {
            date: new Date(Date.now() - 86400000 * 10).toISOString(),
            grade: 80.0,
            modifiedBy: 'Prof. Smith',
            action: 'create',
          },
        ],
      },
      // Essay Assignment (Visible)
      {
        id: 2002,
        courseid: 101,
        categoryid: 1001,
        itemname: 'Essay Assignment: Programming Paradigms',
        itemtype: 'mod',
        itemmodule: 'assign',
        iteminstance: 102,
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        gradepass: 60,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 1.0, // Normal weight
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 2,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        categoryname: 'Assignments',
        weight: 50,
        grade: {
          id: 3002,
          userid: 1001,
          rawgrade: 92.0,
          finalgrade: 92.0,
          feedback: 'Excellent analysis',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000 * 2,
        },
        percentage: 92.0,
        lettergrade: 'A',
        contributionToCategory: 46.0,
        contributionToCourse: 23.0,
        modificationHistory: [
          {
            date: new Date(Date.now() - 86400000 * 8).toISOString(),
            grade: 88.0,
            modifiedBy: 'Prof. Smith',
            action: 'Graded',
          },
          {
            date: new Date(Date.now() - 86400000 * 6).toISOString(),
            grade: 92.0,
            modifiedBy: 'Prof. Smith',
            action: 'Updated',
          },
        ],
      },
      // Python Quiz (Visible)
      {
        id: 2003,
        courseid: 101,
        categoryid: 1002,
        itemname: 'Python Fundamentals Quiz',
        itemtype: 'mod',
        itemmodule: 'quiz',
        iteminstance: 103,
        gradetype: 1,
        grademax: 8.0,
        grademin: 0,
        gradepass: 5.0,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 1.0, // Normal weight
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 3,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        categoryname: 'Quizzes',
        weight: 50,
        grade: {
          id: 3003,
          userid: 1001,
          rawgrade: 7.0,
          finalgrade: 7.0,
          feedback: 'Great understanding',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000,
        },
        percentage: 87.5,
        lettergrade: 'B',
        contributionToCategory: 43.75,
        contributionToCourse: 21.875,
      },
      // Midterm Exam (Hidden for privacy test)
      {
        id: 2004,
        courseid: 101,
        categoryid: 1002,
        itemname: 'Midterm Exam: Programming Concepts',
        itemtype: 'mod',
        itemmodule: 'quiz',
        iteminstance: 104,
        gradetype: 1,
        grademax: 50,
        grademin: 0,
        gradepass: 30,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 1.5, // Extra weight (1.5x)
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 4,
        display: 1,
        decimals: 2,
        hidden: true, // HIDDEN ITEM for privacy test
        locked: false,
        categoryname: 'Quizzes',
        weight: 50,
        grade: {
          id: 3004,
          userid: 1001,
          rawgrade: 45.0,
          finalgrade: 45.0,
          feedback: 'Well done on the exam',
          feedbackformat: 1,
          hidden: true,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000 * 0.5,
        },
        percentage: 90.0,
        lettergrade: 'A',
        contributionToCategory: 45.0,
        contributionToCourse: 22.5,
      },
      // Course total
      {
        id: 101000,
        courseid: 101,
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
          id: 1010000,
          userid: 1001,
          rawgrade: 88.5,
          finalgrade: 88.5,
          feedback: '',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now(),
        },
        percentage: 88.5,
        lettergrade: 'B',
      },
    ],
    students: [],
  },
  // Course 104: CS202 - Data Structures and Algorithms (for E2E tests)
  104: {
    courseid: 104,
    coursename: 'Data Structures and Algorithms',
    aggregation: 'AGGREGATION_MEAN_WEIGHTED',
    canViewAllGrades: true,
    canEditGrades: false, // Student view
    categories: [
      {
        id: 201,
        courseid: 104,
        depth: 1,
        path: '/201',
        fullname: 'Assignments',
        aggregation: 'AGGREGATION_MEAN_WEIGHTED',
        keephigh: 0,
        droplow: 0,
        aggregateonlygraded: true,
        aggregateoutcomes: false,
        hidden: false,
        locked: false,
        weight: 60,
      },
      {
        id: 202,
        courseid: 104,
        depth: 1,
        path: '/202',
        fullname: 'Exams',
        aggregation: 'AGGREGATION_MEAN_SIMPLE',
        keephigh: 0,
        droplow: 0,
        aggregateonlygraded: false,
        aggregateoutcomes: false,
        hidden: false,
        locked: false,
        weight: 40,
      },
    ],
    items: [
      // Assignment 1
      {
        id: 10401,
        courseid: 104,
        categoryid: 201,
        itemname: 'Assignment 1: Arrays and Linked Lists',
        itemtype: 'mod',
        itemmodule: 'assign',
        iteminstance: 401,
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
        weight: 33.33,
        grade: {
          id: 104001,
          userid: 1001,
          rawgrade: 92,
          finalgrade: 92,
          feedback: 'Excellent implementation of linked list operations',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000 * 5,
        },
        percentage: 92,
        lettergrade: 'A',
        contributionToCategory: 30.67,
        contributionToCourse: 18.4,
      },
      // Assignment 2
      {
        id: 10402,
        courseid: 104,
        categoryid: 201,
        itemname: 'Assignment 2: Trees and Graphs',
        itemtype: 'mod',
        itemmodule: 'assign',
        iteminstance: 402,
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
        weight: 33.33,
        grade: {
          id: 104002,
          userid: 1001,
          rawgrade: 88,
          finalgrade: 88,
          feedback: 'Good work on graph traversal algorithms',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000 * 3,
        },
        percentage: 88,
        lettergrade: 'B',
        contributionToCategory: 29.33,
        contributionToCourse: 17.6,
      },
      // Assignment 3
      {
        id: 10403,
        courseid: 104,
        categoryid: 201,
        itemname: 'Assignment 3: Sorting Algorithms',
        itemtype: 'mod',
        itemmodule: 'assign',
        iteminstance: 403,
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
        weight: 33.33,
        grade: {
          id: 104003,
          userid: 1001,
          rawgrade: 95,
          finalgrade: 95,
          feedback: 'Excellent optimization of quicksort',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000,
        },
        percentage: 95,
        lettergrade: 'A',
        contributionToCategory: 31.67,
        contributionToCourse: 19,
      },
      // Midterm Exam
      {
        id: 10404,
        courseid: 104,
        categoryid: 202,
        itemname: 'Midterm Exam',
        itemtype: 'mod',
        itemmodule: 'quiz',
        iteminstance: 404,
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        gradepass: 60,
        multfactor: 1.0,
        plusfactor: 0.0,
        aggregationcoef: 0.0,
        aggregationcoef2: 1.0,
        weightoverride: false,
        sortorder: 4,
        display: 1,
        decimals: 2,
        hidden: false,
        locked: false,
        categoryname: 'Exams',
        weight: 50,
        grade: {
          id: 104004,
          userid: 1001,
          rawgrade: 86,
          finalgrade: 86,
          feedback: 'Strong understanding of core concepts',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000 * 7,
        },
        percentage: 86,
        lettergrade: 'B',
        contributionToCategory: 43,
        contributionToCourse: 17.2,
      },
      // Final Exam
      {
        id: 10405,
        courseid: 104,
        categoryid: 202,
        itemname: 'Final Exam',
        itemtype: 'mod',
        itemmodule: 'quiz',
        iteminstance: 405,
        gradetype: 1,
        grademax: 100,
        grademin: 0,
        gradepass: 60,
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
        categoryname: 'Exams',
        weight: 50,
        grade: {
          id: 104005,
          userid: 1001,
          rawgrade: 90,
          finalgrade: 90,
          feedback: 'Excellent performance on the final exam',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now() - 86400000 * 2,
        },
        percentage: 90,
        lettergrade: 'A',
        contributionToCategory: 45,
        contributionToCourse: 18,
      },
      // Course total (weighted average: 60% assignments + 40% exams = 0.6*91.67 + 0.4*88 = 55 + 35.2 = 90.2)
      {
        id: 104000,
        courseid: 104,
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
          id: 1040000,
          userid: 1001,
          rawgrade: 90.2,
          finalgrade: 90.2,
          feedback: '',
          feedbackformat: 1,
          hidden: false,
          locked: false,
          overridden: false,
          excluded: false,
          timemodified: Date.now(),
        },
        percentage: 90.2,
        lettergrade: 'A',
      },
    ],
    students: [],
  },
};

/**
 * Calculate letter grade from percentage
 */
function getLetterGrade(percentage: number): string {
  if (percentage >= 93) {
    return 'A';
  }
  if (percentage >= 90) {
    return 'A-';
  }
  if (percentage >= 87) {
    return 'B+';
  }
  if (percentage >= 83) {
    return 'B';
  }
  if (percentage >= 80) {
    return 'B-';
  }
  if (percentage >= 77) {
    return 'C+';
  }
  if (percentage >= 73) {
    return 'C';
  }
  if (percentage >= 70) {
    return 'C-';
  }
  if (percentage >= 67) {
    return 'D+';
  }
  if (percentage >= 63) {
    return 'D';
  }
  if (percentage >= 60) {
    return 'D-';
  }
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

/**
 * GET /api/v1/gradebook/course/:id
 * Get complete gradebook for a course
 */
const getCourseGradebookHandler = http.get('http://*/api/v1/gradebook/course/:id', async ({ params, request }) => {
    await simulateLatency();

    const courseId = Number(params.id);
    const url = new URL(request.url);
    const includeHidden = url.searchParams.get('includeHidden') === 'true';

    // Simulate authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
    let { items } = gradebook;
    if (!includeHidden) {
      items = items.filter((item) => !item.hidden && !item.grade?.hidden);
    }

    // Transform CourseGradebook to CourseGradebookResponse
    // Separate grade items from user grades
    const gradeItems = items.map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { grade, percentage, lettergrade, contributionToCategory, contributionToCourse, ...gradeItem } = item;
      return gradeItem;
    });

    const userGrades = items.map((item) => ({
      id: item.id,
      itemname: item.itemname,
      category: item.categoryname || null,
      grade: item.grade?.finalgrade ?? null,
      lettergrade: item.lettergrade || null,
      percentage: item.percentage ?? null,
      range: `${item.grademin}-${item.grademax}`,
      grademax: item.grademax,
      grademin: item.grademin,
      feedback: item.grade?.feedback || null,
      timemodified: item.grade?.timemodified,
      weight: item.weight ?? null,
      contributiontocoursetotal: item.contributionToCourse ?? null,
      rank: null, // Not implemented in mock
      average: null, // Not implemented in mock
      parentcategories: item.categoryname ? [item.categoryname] : [],
      hidden: item.grade?.hidden ?? false,
      locked: item.grade?.locked ?? false,
      overridden: item.grade?.overridden ?? false,
      excluded: item.grade?.excluded ?? false,
      aggregationstatus: 'included' as const,
      modificationHistory: item.modificationHistory || undefined,
    }));

    const response: ApiResponse<{
      courseId: number;
      courseName: string;
      items: typeof gradeItems;
      categories: typeof gradebook.categories;
      userGrades: typeof userGrades;
    }> = {
      success: true,
      data: {
        courseId: gradebook.courseid,
        courseName: gradebook.coursename,
        items: gradeItems,
        categories: gradebook.categories,
        userGrades,
      },
      meta: {
        timestamp: Date.now(),
      },
    };

    return HttpResponse.json(response);
  });

/**
 * GET /api/v1/gradebook/user/:id
 * Get user grades across all enrolled courses
 */
const getUserGradesHandler = http.get('http://*/api/v1/gradebook/user/:id', async ({ params, request }) => {
    await simulateLatency();

    const userId = Number(params.id);

    // Simulate authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
    }

    // Check if user exists (mock: users with ID > 10000 don't exist)
    if (userId > 10000) {
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
    }

    // Build user grades response (matching UserGradebookResponse from gradebookApi.ts)
    const userGrades = {
      userId,
      courses: Object.values(mockGradebooks).map((gradebook) => {
        // Check if course item has a grade for the requested user
        const courseItem = gradebook.items.find((i) => i.itemtype === 'course');
        const courseGradeMatchesUser = courseItem?.grade?.userid === userId || courseItem?.grade?.userid === 42;
        
        return {
          courseId: gradebook.courseid,
          courseName: gradebook.coursename,
          courseTotal: courseGradeMatchesUser ? (courseItem?.grade?.finalgrade ?? null) : null,
          percentage: courseGradeMatchesUser ? (courseItem?.percentage ?? null) : null,
          letterGrade: courseGradeMatchesUser ? (courseItem?.lettergrade ?? null) : null,
          grades: gradebook.items.filter((item) => item.itemtype !== 'course').map((item) => {
            // Check if this item has a grade for the requested user
            // Allow userid 42 to match any test user (1000+) for E2E testing flexibility
            const gradeMatchesUser = !item.grade || item.grade.userid === userId || (userId >= 1000 && item.grade.userid === 42);
            
            return {
              id: item.id,
              itemname: item.itemname,
              category: item.categoryid ? gradebook.categories.find(c => c.id === item.categoryid)?.fullname ?? null : null,
              grade: gradeMatchesUser ? (item.grade?.finalgrade ?? null) : null,
              lettergrade: gradeMatchesUser ? (item.lettergrade ?? null) : null,
              percentage: gradeMatchesUser ? (item.percentage ?? null) : null,
              range: `${item.grademin}-${item.grademax}`,
              grademax: item.grademax,
              grademin: item.grademin,
              feedback: gradeMatchesUser ? (item.grade?.feedback ?? null) : null,
              timemodified: gradeMatchesUser ? item.grade?.timemodified : undefined,
              weight: item.weight ?? null,
              contributiontocoursetotal: null, // Would calculate from aggregation
              rank: null,
              average: null,
              parentcategories: [],
              hidden: item.hidden,
              locked: item.locked,
              overridden: false,
              excluded: false,
              aggregationstatus: 'included' as const,
            };
          }),
        };
      }),
    };

    const response = {
      success: true,
      data: userGrades,
      meta: {
        timestamp: Date.now(),
      },
    };

    return HttpResponse.json(response);
  });

/**
 * GET /api/v1/gradebook/items
 * Get list of grade items (with optional course filter)
 */
const listGradeItemsHandler = http.get('http://*/api/v1/gradebook/items', async ({ request }) => {
    await simulateLatency();

    const url = new URL(request.url);
    const courseId = url.searchParams.get('courseid');
    const page = Number(url.searchParams.get('page') ?? '1');
    const perPage = Number(url.searchParams.get('perPage') ?? '20');

    // Simulate authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
    }

    // Collect all grade items
    let allItems: GradeItem[] = [];
    if (courseId) {
      const gradebook = mockGradebooks[Number(courseId)];
      if (gradebook) {
        allItems = gradebook.items.map(({ grade: _grade, ...item }) => item as GradeItem);
      }
    } else {
      allItems = Object.values(mockGradebooks).flatMap((gradebook) =>
        gradebook.items.map(({ grade: _grade, ...item }) => item as GradeItem)
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
  });

/**
 * PUT /api/v1/gradebook/items/:id
 * Update a grade item (grade value, feedback, exclusion flags)
 */
const updateGradeItemHandler = http.put('http://*/api/v1/gradebook/items/:id', async ({ params, request }) => {
    await simulateLatency();

    const itemId = Number(params.id);

    // Simulate authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

    // Normalize grade value (accept both rawgrade and finalgrade)
    const gradeValue = updateData.rawgrade ?? updateData.finalgrade;

    // Validate grade range
    if (
      gradeValue !== undefined &&
      (gradeValue < foundItem.grademin || gradeValue > foundItem.grademax)
    ) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Grade value out of range',
            details: {
              field: 'grade',
              value: gradeValue,
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
      if (gradeValue !== undefined) {
        foundItem.grade.rawgrade = gradeValue;
        foundItem.grade.finalgrade = gradeValue;
        foundItem.percentage = (gradeValue / foundItem.grademax) * 100;
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
      (i) => i.categoryid === foundItem.categoryid && i.itemtype !== 'category'
    );
    const categoryTotal =
      categoryItems.reduce((sum, i) => sum + (i.grade?.finalgrade ?? 0), 0) /
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
  });

/**
 * GET /api/v1/gradebook/categories
 * Get grade categories for a course
 */
const listGradeCategoriesHandler = http.get('http://*/api/v1/gradebook/categories', async ({ request }) => {
    await simulateLatency();

    const url = new URL(request.url);
    const courseIdParam = url.searchParams.get('courseid');

    // Simulate authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
    }

    // Validate required parameter
    if (!courseIdParam) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing required parameter: courseid',
            details: {
              field: 'courseid',
              reason: 'required',
            },
          },
        },
        { status: 400 }
      );
    }

    const courseId = Number(courseIdParam);
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
  });

/**
 * POST /api/v1/gradebook/categories
 * Create a new grade category
 */
const createGradeCategoryHandler = http.post('http://*/api/v1/gradebook/categories', async ({ request }) => {
    await simulateLatency();

    // Simulate authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
    }

    const categoryData = (await request.json()) as CategoryCreateRequest;

    // Validate required fields
    if (!categoryData.fullname || !categoryData.courseid) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing required fields',
            details: {
              required: ['fullname', 'courseid'],
            },
          },
        },
        { status: 400 }
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
      path: `/${categoryData.parent ?? 0}`,
      fullname: categoryData.fullname,
      aggregation: categoryData.aggregation ?? 'AGGREGATION_MEAN_WEIGHTED',
      keephigh: categoryData.keephigh ?? 0,
      droplow: categoryData.droplow ?? 0,
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
  });

/**
 * GET /api/v1/gradebook/export
 * Export gradebook data
 */
const exportGradebookHandler = http.get('http://*/api/v1/gradebook/export', async ({ request }) => {
    await simulateLatency();

    const url = new URL(request.url);
    const courseId = Number(url.searchParams.get('courseid'));
    const format = url.searchParams.get('format') ?? 'csv';

    // Simulate authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
        (item) => item.grade?.finalgrade?.toString() ?? '-'
      ),
    ]);

    const exportData = {
      format,
      headers,
      rows: rows ?? [],
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
  });

/**
 * GET /api/v1/gradebook/report
 * Generate gradebook report
 */
const generateGradebookReportHandler = http.get('http://*/api/v1/gradebook/report', async ({ request }) => {
    await simulateLatency();

    const url = new URL(request.url);
    const courseId = Number(url.searchParams.get('courseid'));
    const userId = url.searchParams.get('userid');
    const reportType = url.searchParams.get('reportType') ?? 'user';

    // Simulate authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
  });

/**
 * Export all gradebook handlers
 */
export const gradesHandlers = [
  getCourseGradebookHandler,
  getUserGradesHandler,
  listGradeItemsHandler,
  updateGradeItemHandler,
  listGradeCategoriesHandler,
  createGradeCategoryHandler,
  exportGradebookHandler,
  generateGradebookReportHandler,
];
