/**
 * E2E Test Fixtures - Course Data
 * 
 * Provides predefined course objects with various enrollment methods, categories, and configurations.
 * Used across course catalog, enrollment, dashboard, and activity module E2E tests.
 * 
 * @module tests/e2e/fixtures/courses
 */

import { testTeacher } from './users';

/**
 * Enrollment method constants matching Moodle enrollment plugin types
 */
export const ENROLLMENT_METHODS = {
  /** Self-enrollment (students can enroll themselves) */
  SELF: 'self',
  /** Manual enrollment (teachers/admins manually enroll users) */
  MANUAL: 'manual',
  /** Guest access (view-only without enrollment) */
  GUEST: 'guest',
  /** Cohort sync (automatic enrollment based on cohort membership) */
  COHORT: 'cohort',
} as const;

/**
 * Course format constants matching Moodle course format types
 */
export const COURSE_FORMATS = {
  /** Topics format (course organized by topics) */
  TOPICS: 'topics',
  /** Weekly format (course organized by weeks) */
  WEEKS: 'weeks',
  /** Social format (forum-based course) */
  SOCIAL: 'social',
  /** Single activity format (course contains single activity) */
  SINGLEACTIVITY: 'singleactivity',
} as const;

/**
 * Course activity interface
 * Represents an activity module within a course section
 */
export interface CourseActivity {
  /** Activity instance identifier */
  id: number;
  /** Activity module name (assign, quiz, forum, etc.) */
  modname: string;
  /** Activity instance name */
  name: string;
  /** Whether activity is visible to students */
  visible: boolean;
  /** URL to access the activity */
  url: string;
  /** Activity completion state (0=none, 1=manual, 2=automatic) */
  completion: number;
}

/**
 * Course section interface matching Moodle course section structure
 * Represents a section (topic/week) within a course
 */
export interface CourseSection {
  /** Section identifier */
  id: number;
  /** Section name/title */
  name: string;
  /** Section summary/description */
  summary: string;
  /** Summary format (1=HTML, 0=MOODLE, 2=PLAIN, 4=MARKDOWN) */
  summaryformat: number;
  /** Whether section is visible to students */
  visible: boolean;
  /** Array of activities in this section */
  activities: CourseActivity[];
  /** Comma-separated list of activity module IDs */
  sequence: string;
}

/**
 * Course category interface matching Moodle course category structure
 * Represents a category that organizes courses hierarchically
 */
export interface CourseCategory {
  /** Category identifier */
  id: number;
  /** Category name */
  name: string;
  /** Category ID number (optional unique identifier) */
  idnumber: string;
  /** Category description */
  description: string;
  /** Parent category ID (0 for top-level) */
  parent: number;
  /** Sort order within parent category */
  sortorder: number;
  /** Number of courses in this category */
  coursecount: number;
  /** Whether category is visible */
  visible: boolean;
  /** Category depth in hierarchy (0 for top-level) */
  depth: number;
  /** Category path (e.g., /1/5 for category 5 under category 1) */
  path: string;
}

/**
 * Enrollment method configuration
 */
export interface EnrollmentMethod {
  /** Enrollment plugin type */
  type: string;
  /** Whether enrollment method is enabled */
  enabled: boolean;
  /** Enrollment key (password) if required */
  password?: string;
  /** Role ID assigned on enrollment */
  roleid?: number;
  /** Enrollment start date (Unix timestamp) */
  startdate?: number;
  /** Enrollment end date (Unix timestamp) */
  enddate?: number;
}

/**
 * Course interface matching Moodle course API structure
 * Represents a complete course object as returned by Moodle API endpoints
 */
export interface Course {
  /** Unique course identifier */
  id: number;
  /** Course short name (unique identifier for URL) */
  shortname: string;
  /** Course full name (display name) */
  fullname: string;
  /** Course summary/description */
  summary: string;
  /** Summary format (1=HTML, 0=MOODLE, 2=PLAIN, 4=MARKDOWN) */
  summaryformat: number;
  /** Category ID this course belongs to */
  category: number;
  /** Whether course is visible to students (1=visible, 0=hidden) */
  visible: boolean;
  /** Course start date (Unix timestamp) */
  startdate: number;
  /** Course end date (Unix timestamp, 0=no end date) */
  enddate: number;
  /** Course format (topics, weeks, social, singleactivity) */
  format: string;
  /** Array of course sections */
  sections?: CourseSection[];
  /** Array of enrollment methods */
  enrollmentmethods: EnrollmentMethod[];
  /** Course instructor (teacher) information */
  instructor?: {
    /** Instructor user ID */
    id: number;
    /** Instructor first name */
    firstname: string;
    /** Instructor last name */
    lastname: string;
    /** Instructor full name */
    fullname: string;
  };
  /** Unix timestamp of course creation */
  timecreated: number;
  /** Unix timestamp of last modification */
  timemodified: number;
}

/**
 * Programming category fixture
 * Top-level category for programming and software development courses
 */
export const programmingCategory: CourseCategory = {
  id: 1,
  name: 'Programming',
  idnumber: 'CAT-PROG',
  description: 'Programming and software development courses',
  parent: 0,
  sortorder: 1,
  coursecount: 5,
  visible: true,
  depth: 0,
  path: '/1',
};

/**
 * Mathematics category fixture
 * Top-level category for mathematics and statistics courses
 */
export const mathematicsCategory: CourseCategory = {
  id: 2,
  name: 'Mathematics',
  idnumber: 'CAT-MATH',
  description: 'Mathematics and statistics courses',
  parent: 0,
  sortorder: 2,
  coursecount: 3,
  visible: true,
  depth: 0,
  path: '/2',
};

/**
 * Science category fixture
 * Top-level category for science courses (physics, chemistry, biology)
 */
export const scienceCategory: CourseCategory = {
  id: 3,
  name: 'Science',
  idnumber: 'CAT-SCI',
  description: 'Natural sciences including physics, chemistry, and biology',
  parent: 0,
  sortorder: 3,
  coursecount: 4,
  visible: true,
  depth: 0,
  path: '/3',
};

/**
 * Test course 1: Introduction to Programming
 * Standard course with self-enrollment enabled, no enrollment key required
 */
export const testCourse1: Course = {
  id: 101,
  shortname: 'PROG101',
  fullname: 'Introduction to Programming',
  summary: '<p>Learn the fundamentals of programming using Python. This course covers variables, data types, control structures, functions, and object-oriented programming basics.</p>',
  summaryformat: 1, // HTML
  category: programmingCategory.id,
  visible: true,
  startdate: Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days ago (Unix timestamp in seconds)
  enddate: Math.floor(Date.now() / 1000) + 86400 * 90, // 90 days from now (Unix timestamp in seconds)
  format: COURSE_FORMATS.TOPICS,
  enrollmentmethods: [
    {
      type: ENROLLMENT_METHODS.SELF,
      enabled: true,
      roleid: 5, // Student role
    },
    {
      type: ENROLLMENT_METHODS.MANUAL,
      enabled: true,
      roleid: 5,
    },
  ],
  instructor: {
    id: testTeacher.id,
    firstname: testTeacher.firstname,
    lastname: testTeacher.lastname,
    fullname: `${testTeacher.firstname} ${testTeacher.lastname}`,
  },
  timecreated: Math.floor(Date.now() / 1000) - 86400 * 60, // 60 days ago (Unix timestamp in seconds)
  timemodified: Math.floor(Date.now() / 1000) - 86400 * 5, // 5 days ago (Unix timestamp in seconds)
};

/**
 * Test course 2: Advanced Web Development
 * Course with self-enrollment but requires enrollment key (password)
 */
export const testCourse2: Course = {
  id: 102,
  shortname: 'WEB301',
  fullname: 'Advanced Web Development',
  summary: '<p>Master modern web development with React, Node.js, and TypeScript. Build full-stack applications with industry best practices.</p>',
  summaryformat: 1, // HTML
  category: programmingCategory.id,
  visible: true,
  startdate: Math.floor(Date.now() / 1000) - 86400 * 15, // 15 days ago (Unix timestamp in seconds)
  enddate: Math.floor(Date.now() / 1000) + 86400 * 105, // 105 days from now (Unix timestamp in seconds)
  format: COURSE_FORMATS.TOPICS,
  enrollmentmethods: [
    {
      type: ENROLLMENT_METHODS.SELF,
      enabled: true,
      password: 'WebDev2024!', // Enrollment key required
      roleid: 5,
    },
    {
      type: ENROLLMENT_METHODS.MANUAL,
      enabled: true,
      roleid: 5,
    },
  ],
  instructor: {
    id: testTeacher.id,
    firstname: testTeacher.firstname,
    lastname: testTeacher.lastname,
    fullname: `${testTeacher.firstname} ${testTeacher.lastname}`,
  },
  timecreated: Math.floor(Date.now() / 1000) - 86400 * 45, // 45 days ago (Unix timestamp in seconds)
  timemodified: Math.floor(Date.now() / 1000) - 86400 * 2, // 2 days ago (Unix timestamp in seconds)
};

/**
 * Test course 3: Calculus I (Hidden/Restricted)
 * Hidden course with manual enrollment only (not visible in course catalog)
 */
export const testCourse3: Course = {
  id: 103,
  shortname: 'MATH201',
  fullname: 'Calculus I',
  summary: '<p>Comprehensive introduction to differential and integral calculus. Topics include limits, derivatives, integrals, and applications.</p>',
  summaryformat: 1, // HTML
  category: mathematicsCategory.id,
  visible: false, // Hidden from catalog
  startdate: Math.floor(Date.now() / 1000) + 86400 * 7, // Starts in 7 days (Unix timestamp in seconds)
  enddate: Math.floor(Date.now() / 1000) + 86400 * 127, // Ends in 127 days (Unix timestamp in seconds)
  format: COURSE_FORMATS.WEEKS,
  enrollmentmethods: [
    {
      type: ENROLLMENT_METHODS.MANUAL,
      enabled: true,
      roleid: 5,
    },
  ],
  instructor: {
    id: testTeacher.id,
    firstname: testTeacher.firstname,
    lastname: testTeacher.lastname,
    fullname: `${testTeacher.firstname} ${testTeacher.lastname}`,
  },
  timecreated: Math.floor(Date.now() / 1000) - 86400 * 20, // 20 days ago (Unix timestamp in seconds)
  timemodified: Math.floor(Date.now() / 1000) - 86400 * 1, // 1 day ago (Unix timestamp in seconds)
};

/**
 * Test course 4: Data Structures and Algorithms
 * Complete course with multiple sections and activities for comprehensive testing
 */
export const testCourse4: Course = {
  id: 104,
  shortname: 'CS202',
  fullname: 'Data Structures and Algorithms',
  summary: '<p>Deep dive into fundamental data structures (arrays, linked lists, trees, graphs) and algorithms (sorting, searching, dynamic programming). Essential for software engineering interviews and competitive programming.</p>',
  summaryformat: 1, // HTML
  category: programmingCategory.id,
  visible: true,
  startdate: Math.floor(Date.now() / 1000) - 86400 * 45, // 45 days ago (Unix timestamp in seconds)
  enddate: Math.floor(Date.now() / 1000) + 86400 * 75, // 75 days from now (Unix timestamp in seconds)
  format: COURSE_FORMATS.TOPICS,
  sections: [
    {
      id: 1041,
      name: 'Introduction and Setup',
      summary: '<p>Course overview, environment setup, and introduction to computational complexity.</p>',
      summaryformat: 1,
      visible: true,
      sequence: '10411,10412,10413',
      activities: [
        {
          id: 10411,
          modname: 'page',
          name: 'Course Syllabus',
          visible: true,
          url: '/mod/page/view.php?id=10411',
          completion: 1, // Manual completion
        },
        {
          id: 10412,
          modname: 'resource',
          name: 'Setup Guide PDF',
          visible: true,
          url: '/mod/resource/view.php?id=10412',
          completion: 1,
        },
        {
          id: 10413,
          modname: 'forum',
          name: 'General Discussion Forum',
          visible: true,
          url: '/mod/forum/view.php?id=10413',
          completion: 0, // No completion tracking
        },
      ],
    },
    {
      id: 1042,
      name: 'Arrays and Linked Lists',
      summary: '<p>Learn about linear data structures: arrays, dynamic arrays, and linked lists (singly, doubly, circular).</p>',
      summaryformat: 1,
      visible: true,
      sequence: '10421,10422,10423',
      activities: [
        {
          id: 10421,
          modname: 'resource',
          name: 'Arrays Lecture Slides',
          visible: true,
          url: '/mod/resource/view.php?id=10421',
          completion: 1,
        },
        {
          id: 10422,
          modname: 'assign',
          name: 'Assignment 1: Array Manipulation',
          visible: true,
          url: '/mod/assign/view.php?id=10422',
          completion: 2, // Automatic completion on submission
        },
        {
          id: 10423,
          modname: 'quiz',
          name: 'Quiz 1: Arrays and Linked Lists',
          visible: true,
          url: '/mod/quiz/view.php?id=10423',
          completion: 2, // Automatic completion on passing
        },
      ],
    },
    {
      id: 1043,
      name: 'Stacks and Queues',
      summary: '<p>Explore stack and queue data structures with real-world applications.</p>',
      summaryformat: 1,
      visible: true,
      sequence: '10431,10432,10433',
      activities: [
        {
          id: 10431,
          modname: 'url',
          name: 'Stack Visualization Tool',
          visible: true,
          url: '/mod/url/view.php?id=10431',
          completion: 0,
        },
        {
          id: 10432,
          modname: 'assign',
          name: 'Assignment 2: Implement a Queue',
          visible: true,
          url: '/mod/assign/view.php?id=10432',
          completion: 2,
        },
        {
          id: 10433,
          modname: 'forum',
          name: 'Discussion: Stack vs Queue Use Cases',
          visible: true,
          url: '/mod/forum/view.php?id=10433',
          completion: 0,
        },
      ],
    },
    {
      id: 1044,
      name: 'Trees and Graphs',
      summary: '<p>Study hierarchical and network data structures: binary trees, BST, AVL trees, graphs (directed, undirected).</p>',
      summaryformat: 1,
      visible: true,
      sequence: '10441,10442,10443,10444',
      activities: [
        {
          id: 10441,
          modname: 'resource',
          name: 'Trees and Graphs Lecture Notes',
          visible: true,
          url: '/mod/resource/view.php?id=10441',
          completion: 1,
        },
        {
          id: 10442,
          modname: 'assign',
          name: 'Assignment 3: Binary Search Tree',
          visible: true,
          url: '/mod/assign/view.php?id=10442',
          completion: 2,
        },
        {
          id: 10443,
          modname: 'quiz',
          name: 'Quiz 2: Trees and Graphs',
          visible: true,
          url: '/mod/quiz/view.php?id=10443',
          completion: 2,
        },
        {
          id: 10444,
          modname: 'workshop',
          name: 'Peer Review: Graph Algorithms',
          visible: true,
          url: '/mod/workshop/view.php?id=10444',
          completion: 2,
        },
      ],
    },
    {
      id: 1045,
      name: 'Sorting and Searching Algorithms',
      summary: '<p>Master fundamental algorithms: bubble sort, merge sort, quick sort, binary search, and complexity analysis.</p>',
      summaryformat: 1,
      visible: true,
      sequence: '10451,10452,10453',
      activities: [
        {
          id: 10451,
          modname: 'page',
          name: 'Algorithm Complexity Cheat Sheet',
          visible: true,
          url: '/mod/page/view.php?id=10451',
          completion: 1,
        },
        {
          id: 10452,
          modname: 'assign',
          name: 'Assignment 4: Implement Sorting Algorithms',
          visible: true,
          url: '/mod/assign/view.php?id=10452',
          completion: 2,
        },
        {
          id: 10453,
          modname: 'quiz',
          name: 'Final Exam: Comprehensive Test',
          visible: true,
          url: '/mod/quiz/view.php?id=10453',
          completion: 2,
        },
      ],
    },
  ],
  enrollmentmethods: [
    {
      type: ENROLLMENT_METHODS.SELF,
      enabled: true,
      roleid: 5,
    },
    {
      type: ENROLLMENT_METHODS.MANUAL,
      enabled: true,
      roleid: 5,
    },
  ],
  instructor: {
    id: testTeacher.id,
    firstname: testTeacher.firstname,
    lastname: testTeacher.lastname,
    fullname: `${testTeacher.firstname} ${testTeacher.lastname}`,
  },
  timecreated: Math.floor(Date.now() / 1000) - 86400 * 90, // 90 days ago (Unix timestamp in seconds)
  timemodified: Math.floor(Date.now() / 1000) - 86400 * 3, // 3 days ago (Unix timestamp in seconds)
};

/**
 * Helper function to create a course with custom properties
 * Useful for generating dynamic test courses in E2E tests
 * 
 * @param overrides - Partial course object to override default values
 * @returns Complete course object with defaults applied
 */
export function createCourse(overrides: Partial<Course> = {}): Course {
  const now = Date.now();
  const defaultCourse: Course = {
    id: Math.floor(Math.random() * 900000) + 100000, // Random ID 100000-999999
    shortname: `TEST${Math.floor(Math.random() * 1000)}`,
    fullname: 'Test Course',
    summary: '<p>This is a test course created dynamically for E2E testing.</p>',
    summaryformat: 1,
    category: programmingCategory.id,
    visible: true,
    startdate: now - 86400000 * 7, // Started 7 days ago
    enddate: now + 86400000 * 90, // Ends in 90 days
    format: COURSE_FORMATS.TOPICS,
    enrollmentmethods: [
      {
        type: ENROLLMENT_METHODS.SELF,
        enabled: true,
        roleid: 5,
      },
    ],
    instructor: {
      id: testTeacher.id,
      firstname: testTeacher.firstname,
      lastname: testTeacher.lastname,
      fullname: `${testTeacher.firstname} ${testTeacher.lastname}`,
    },
    timecreated: now - 86400000 * 14, // Created 14 days ago
    timemodified: now - 86400000 * 1, // Modified 1 day ago
  };

  return {
    ...defaultCourse,
    ...overrides,
    // Ensure instructor is properly merged if provided
    instructor: overrides.instructor
      ? { ...defaultCourse.instructor!, ...overrides.instructor }
      : defaultCourse.instructor,
  };
}

/**
 * Helper function to get a course with activities populated
 * Returns testCourse4 by default (which has comprehensive sections and activities)
 * or creates a new course with activities based on provided overrides
 * 
 * @param overrides - Optional partial course object to customize
 * @returns Course object with sections and activities populated
 */
export function getCourseWithActivities(overrides: Partial<Course> = {}): Course {
  // If no overrides, return testCourse4 which has full activity structure
  if (Object.keys(overrides).length === 0) {
    return testCourse4;
  }

  // Create a course with basic activity structure
  const baseCourse = createCourse(overrides);
  
  // If sections not provided in overrides, add default section with activities
  if (!overrides.sections) {
    baseCourse.sections = [
      {
        id: Math.floor(Math.random() * 900000) + 100000,
        name: 'General',
        summary: '<p>General course section</p>',
        summaryformat: 1,
        visible: true,
        sequence: '1,2,3',
        activities: [
          {
            id: Math.floor(Math.random() * 900000) + 100000,
            modname: 'page',
            name: 'Course Introduction',
            visible: true,
            url: '/mod/page/view.php?id=1',
            completion: 1,
          },
          {
            id: Math.floor(Math.random() * 900000) + 100000,
            modname: 'assign',
            name: 'First Assignment',
            visible: true,
            url: '/mod/assign/view.php?id=2',
            completion: 2,
          },
          {
            id: Math.floor(Math.random() * 900000) + 100000,
            modname: 'quiz',
            name: 'Quiz 1',
            visible: true,
            url: '/mod/quiz/view.php?id=3',
            completion: 2,
          },
        ],
      },
    ];
  }

  return baseCourse;
}
