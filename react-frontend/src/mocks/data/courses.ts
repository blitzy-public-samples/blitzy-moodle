/**
 * Mock Course Data Generators
 * 
 * Factory functions for creating realistic Moodle course entities for testing.
 * Provides mockCourse(), mockCourseModule(), mockCourseCategory() with sensible
 * defaults and support for partial overrides.
 * 
 * @module tests/mocks/data/courses
 * @see react-frontend/src/types/entities.ts - Entity type definitions
 * @see public/course/lib.php - Source course management functions
 */

import type { Course, CourseModule, CourseCategory } from '@/types/entities';
import type {
  CourseId,
  LanguageCode,
  Timestamp,
} from '@/types/common';

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Deep partial type for allowing nested partial overrides
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ============================================================================
// ID and Timestamp Generators
// ============================================================================

/**
 * Course ID counter for generating unique sequential IDs
 */
let courseIdCounter = 1;

/**
 * Generates a unique sequential course ID
 * 
 * @returns {CourseId} Unique course identifier
 */
export function generateCourseId(): CourseId {
  return courseIdCounter++;
}

/**
 * Generates a timestamp with optional offset from current time
 * 
 * @param {number} daysFromNow - Number of days to offset (positive=future, negative=past)
 * @returns {Timestamp} Unix timestamp in seconds
 */
export function generateTimestamp(daysFromNow: number = 0): Timestamp {
  const now = Math.floor(Date.now() / 1000);
  const dayInSeconds = 86400; // 24 * 60 * 60
  return now + (daysFromNow * dayInSeconds);
}

/**
 * Returns a random course format from common Moodle formats
 * 
 * @returns {string} Course format name
 */
export function getCourseFormat(): string {
  const formats = ['topics', 'weeks', 'social'] as const;
  const index = Math.floor(Math.random() * formats.length);
  return formats[index] as string;
}

// ============================================================================
// Course Factory
// ============================================================================

/**
 * Creates a mock Course entity with realistic default values
 * 
 * Default values mirror typical Moodle course configuration:
 * - Topics-based format
 * - 90-day duration from current date
 * - Completion tracking enabled
 * - Activity dates visible
 * - HTML summary format
 * 
 * @param {DeepPartial<Course>} overrides - Partial course properties to override defaults
 * @returns {Course} Complete course entity with all required fields
 * 
 * @example
 * ```typescript
 * // Create course with defaults
 * const course = mockCourse();
 * 
 * // Create course with custom name and dates
 * const customCourse = mockCourse({
 *   fullname: 'Introduction to Programming',
 *   shortname: 'CS101',
 *   startdate: generateTimestamp(7), // Starts in 7 days
 * });
 * ```
 */
export function mockCourse(overrides: DeepPartial<Course> = {}): Course {
  const currentTimestamp = generateTimestamp();
  const ninetyDaysLater = generateTimestamp(90);
  
  const defaults: Course = {
    id: 1,
    category: 1,
    sortorder: 0,
    fullname: 'Test Course',
    shortname: 'TEST101',
    idnumber: 'TEST-101',
    summary: 'This is a test course for unit testing',
    summaryformat: 1, // HTML format
    format: 'topics',
    showgrades: true,
    startdate: currentTimestamp,
    enddate: ninetyDaysLater,
    visible: true,
    groupmode: 0, // No groups
    groupmodeforce: false,
    lang: 'en' as LanguageCode,
    timecreated: currentTimestamp,
    timemodified: currentTimestamp,
    enablecompletion: true,
    completionnotify: false,
    showactivitydates: true,
    showcompletionconditions: true,
    courseimage: 'https://via.placeholder.com/400x300.png?text=Course+Image',
    progress: 0,
  };

  return {
    ...defaults,
    ...overrides,
  } as Course;
}

// ============================================================================
// Course Module Factory
// ============================================================================

/**
 * Creates a mock CourseModule entity representing an activity within a course
 * 
 * Default values represent a typical assignment activity:
 * - Assignment module type (module ID 16)
 * - Manual completion tracking
 * - Visible on course page
 * - Added at current timestamp
 * 
 * @param {DeepPartial<CourseModule>} overrides - Partial module properties to override defaults
 * @returns {CourseModule} Complete course module entity
 * 
 * @example
 * ```typescript
 * // Create default assignment module
 * const module = mockCourseModule();
 * 
 * // Create quiz module for specific course
 * const quizModule = mockCourseModule({
 *   course: 5,
 *   module: 17, // Quiz module type
 *   modname: 'quiz',
 *   name: 'Week 1 Quiz',
 *   completion: 2, // Automatic completion
 * });
 * ```
 */
export function mockCourseModule(overrides: DeepPartial<CourseModule> = {}): CourseModule {
  const currentTimestamp = generateTimestamp();
  
  const defaults: CourseModule = {
    id: 1,
    course: 1,
    module: 16, // Assignment module type ID
    instance: 1,
    section: 1,
    idnumber: 'MOD-001',
    added: currentTimestamp,
    visible: true,
    visibleoncoursepage: true,
    completion: 1, // Manual completion
    modname: 'assign',
    name: 'Test Activity',
    url: '/mod/assign/view.php?id=1',
    iconurl: 'https://via.placeholder.com/32x32.png?text=Icon',
  };

  return {
    ...defaults,
    ...overrides,
  } as CourseModule;
}

// ============================================================================
// Course Category Factory
// ============================================================================

/**
 * Creates a mock CourseCategory entity for organizing courses
 * 
 * Default values represent a top-level category:
 * - Depth 1 (top-level)
 * - Parent 0 (no parent)
 * - Path '/1' (root path)
 * - 5 courses in category
 * - Visible to all users
 * 
 * @param {DeepPartial<CourseCategory>} overrides - Partial category properties to override defaults
 * @returns {CourseCategory} Complete course category entity
 * 
 * @example
 * ```typescript
 * // Create top-level category
 * const category = mockCourseCategory();
 * 
 * // Create subcategory
 * const subcategory = mockCourseCategory({
 *   id: 2,
 *   name: 'Programming Courses',
 *   parent: 1,
 *   depth: 2,
 *   path: '/1/2',
 * });
 * ```
 */
export function mockCourseCategory(overrides: DeepPartial<CourseCategory> = {}): CourseCategory {
  const currentTimestamp = generateTimestamp();
  
  const defaults: CourseCategory = {
    id: 1,
    name: 'Test Category',
    idnumber: 'CAT-001',
    description: 'Test category description',
    descriptionformat: 1, // HTML format
    parent: 0, // Top-level category
    sortorder: 0,
    coursecount: 5,
    visible: 1, // 1=visible, 0=hidden (matches Moodle schema)
    visibleold: 1,
    timemodified: currentTimestamp,
    depth: 1,
    path: '/1',
  };

  return {
    ...defaults,
    ...overrides,
  } as CourseCategory;
}

// ============================================================================
// Array Generators
// ============================================================================

/**
 * Generates an array of mock courses with unique IDs and names
 * 
 * Each course gets:
 * - Sequential ID starting from 1
 * - Unique shortname (TEST101, TEST102, etc.)
 * - Unique fullname (Test Course 1, Test Course 2, etc.)
 * 
 * @param {number} count - Number of courses to generate
 * @param {DeepPartial<Course>} baseOverrides - Common overrides to apply to all courses
 * @returns {Course[]} Array of course entities
 * 
 * @example
 * ```typescript
 * // Generate 10 courses in same category
 * const courses = mockCourseArray(10, { category: 5 });
 * 
 * // Generate 5 hidden courses
 * const hiddenCourses = mockCourseArray(5, { visible: false });
 * ```
 */
export function mockCourseArray(
  count: number,
  baseOverrides: DeepPartial<Course> = {}
): Course[] {
  return Array.from({ length: count }, (_, index) => {
    const courseNumber = index + 1;
    return mockCourse({
      ...baseOverrides,
      id: courseNumber,
      shortname: `TEST${100 + courseNumber}`,
      fullname: `Test Course ${courseNumber}`,
      idnumber: `TEST-${100 + courseNumber}`,
    });
  });
}

/**
 * Generates an array of mock course modules for a specific course
 * 
 * Each module gets:
 * - Sequential ID and section number
 * - Unique idnumber
 * - Unique name
 * - Associated with specified course
 * 
 * @param {CourseId} courseid - Course ID to associate modules with
 * @param {number} count - Number of modules to generate
 * @param {DeepPartial<CourseModule>} baseOverrides - Common overrides to apply to all modules
 * @returns {CourseModule[]} Array of course module entities
 * 
 * @example
 * ```typescript
 * // Generate 5 activities for course 3
 * const modules = mockCourseModuleArray(3, 5);
 * 
 * // Generate 3 quiz modules for course 1
 * const quizzes = mockCourseModuleArray(1, 3, {
 *   module: 17,
 *   modname: 'quiz',
 * });
 * ```
 */
export function mockCourseModuleArray(
  courseid: CourseId,
  count: number,
  baseOverrides: DeepPartial<CourseModule> = {}
): CourseModule[] {
  return Array.from({ length: count }, (_, index) => {
    const moduleNumber = index + 1;
    return mockCourseModule({
      ...baseOverrides,
      id: moduleNumber,
      course: courseid,
      section: moduleNumber,
      instance: moduleNumber,
      idnumber: `MOD-${String(moduleNumber).padStart(3, '0')}`,
      name: `${baseOverrides.modname ?? 'Activity'} ${moduleNumber}`,
      url: `/mod/${baseOverrides.modname ?? 'assign'}/view.php?id=${moduleNumber}`,
    });
  });
}
