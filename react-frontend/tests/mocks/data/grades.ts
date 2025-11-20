/**
 * Mock Grade Data Generators
 * 
 * Factory functions for creating realistic Moodle grade and grade item entities for testing.
 * Provides mockGrade(), mockGradeItem(), and helper functions with sensible defaults
 * for all grade properties including raw grades, final grades, feedback, grade item
 * configurations, and customizable overrides.
 * 
 * All generated mock data matches the Grade and GradeItem interface structures and includes
 * realistic grade values, aggregation coefficients, display settings, and timestamps based
 * on actual Moodle gradebook data patterns.
 * 
 * @module tests/mocks/data/grades
 * @see react-frontend/src/types/entities.ts - Grade entity type definitions
 * @see public/grade/lib.php - Moodle grade functions
 * @see public/lib/gradelib.php - Moodle grade calculation library
 */

import type { Grade, GradeItem } from '@/types/entities';
import type {
  GradeId,
  CourseId,
  UserId,
  Id,
  Timestamp,
} from '@/types/common';
import { mockCourse } from './courses';
import { mockUser } from './users';
import { mockAssignment } from './assignments';

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Deep partial type for allowing nested partial overrides
 * Enables customization of any nested property in Grade or GradeItem
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : DeepPartial<T[P]>
    : T[P];
};

// ============================================================================
// ID and Timestamp Generators
// ============================================================================

/**
 * Grade ID counter for generating unique sequential IDs
 */
let gradeIdCounter = 1;

/**
 * Grade item ID counter for generating unique sequential IDs
 */
let gradeItemIdCounter = 1;

/**
 * Generates a unique sequential grade ID
 * 
 * @returns {GradeId} Unique grade identifier
 * 
 * @example
 * const id1 = generateGradeId(); // 1
 * const id2 = generateGradeId(); // 2
 */
export function generateGradeId(): GradeId {
  return gradeIdCounter++;
}

/**
 * Generates a unique sequential grade item ID
 * 
 * @returns {Id} Unique grade item identifier
 */
function generateGradeItemId(): Id {
  return gradeItemIdCounter++;
}

/**
 * Generates a timestamp with optional offset from current time
 * 
 * @param {number} daysFromNow - Number of days to offset (positive=future, negative=past)
 * @returns {Timestamp} Unix timestamp in seconds
 * 
 * @example
 * const now = generateTimestamp(); // Current time
 * const nextWeek = generateTimestamp(7); // 7 days from now
 * const yesterday = generateTimestamp(-1); // 1 day ago
 */
function generateTimestamp(daysFromNow: number = 0): Timestamp {
  const now = Math.floor(Date.now() / 1000);
  const dayInSeconds = 86400; // 24 * 60 * 60
  return now + (daysFromNow * dayInSeconds);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates a random grade value within specified range
 * 
 * @param {number} min - Minimum grade value
 * @param {number} max - Maximum grade value
 * @returns {number} Random grade value rounded to 2 decimal places
 * 
 * @example
 * const grade = generateRandomGrade(0, 100); // e.g., 73.45
 * const partialCredit = generateRandomGrade(50, 80); // e.g., 65.23
 */
export function generateRandomGrade(min: number, max: number): number {
  const random = Math.random() * (max - min) + min;
  return Math.round(random * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculates final grade applying multiplication and addition factors
 * 
 * Mimics Moodle's grade calculation formula:
 * finalgrade = (rawgrade * multfactor) + plusfactor
 * 
 * @param {number} rawgrade - Raw grade value
 * @param {number} multfactor - Multiplication factor (default: 1.0)
 * @param {number} plusfactor - Addition factor (default: 0.0)
 * @returns {number} Calculated final grade rounded to 2 decimal places
 * 
 * @example
 * const final = calculateFinalGrade(85.5, 1.0, 0.0); // 85.5
 * const weighted = calculateFinalGrade(85.5, 0.8, 5.0); // 73.4
 */
export function calculateFinalGrade(
  rawgrade: number,
  multfactor: number = 1.0,
  plusfactor: number = 0.0
): number {
  const calculated = (rawgrade * multfactor) + plusfactor;
  return Math.round(calculated * 100) / 100; // Round to 2 decimal places
}

// ============================================================================
// Grade Item Factory
// ============================================================================

/**
 * Creates a mock GradeItem entity with realistic default values
 * 
 * Generates a complete GradeItem object representing a gradeable item in Moodle
 * (assignment, quiz, manual grade item, or course total). Default values mirror
 * typical Moodle grade item configuration:
 * 
 * - Item type: 'mod' (module/activity)
 * - Item module: 'assign' (assignment)
 * - Grade type: 1 (value/numeric)
 * - Grade range: 0-100
 * - Pass grade: 50
 * - Default aggregation coefficients: 0.0
 * - Multiplication factor: 1.0 (no scaling)
 * - Addition factor: 0.0 (no offset)
 * - 2 decimal places for display
 * - Not hidden, not locked
 * 
 * @param {DeepPartial<GradeItem>} overrides - Partial grade item properties to override defaults
 * @returns {GradeItem} Complete grade item entity with all required fields
 * 
 * @example
 * // Create grade item with defaults
 * const item = mockGradeItem();
 * 
 * // Create quiz grade item
 * const quizItem = mockGradeItem({
 *   itemname: 'Midterm Quiz',
 *   itemmodule: 'quiz',
 *   grademax: 50,
 *   gradepass: 25,
 * });
 * 
 * // Create manual grade item
 * const manualItem = mockGradeItem({
 *   itemtype: 'manual',
 *   itemname: 'Participation',
 *   grademax: 10,
 * });
 */
export function mockGradeItem(overrides: DeepPartial<GradeItem> = {}): GradeItem {
  const id = overrides.id ?? generateGradeItemId();
  const courseid = overrides.courseid ?? 1;

  return {
    id,
    courseid,
    categoryid: overrides.categoryid,
    itemname: overrides.itemname ?? 'Test Grade Item',
    itemtype: overrides.itemtype ?? 'mod',
    itemmodule: overrides.itemmodule ?? 'assign',
    iteminstance: overrides.iteminstance ?? 1,
    itemnumber: overrides.itemnumber ?? 0,
    gradetype: overrides.gradetype ?? 1, // 1=value, 2=scale, 3=text
    grademax: overrides.grademax ?? 100,
    grademin: overrides.grademin ?? 0,
    scaleid: overrides.scaleid,
    outcomeid: overrides.outcomeid,
    gradepass: overrides.gradepass ?? 50,
    multfactor: overrides.multfactor ?? 1.0,
    plusfactor: overrides.plusfactor ?? 0.0,
    aggregationcoef: overrides.aggregationcoef ?? 0.0,
    aggregationcoef2: overrides.aggregationcoef2 ?? 0.0,
    weightoverride: overrides.weightoverride ?? false,
    sortorder: overrides.sortorder ?? 1,
    display: overrides.display ?? 0, // 0=real grade, 1=percentage, etc.
    decimals: overrides.decimals ?? 2,
    hidden: overrides.hidden ?? false,
    locked: overrides.locked ?? false,
    locktime: overrides.locktime,
    iteminfo: overrides.iteminfo,
    idnumber: overrides.idnumber,
    calculation: overrides.calculation,
    needsupdate: overrides.needsupdate ?? false,
    timecreated: overrides.timecreated ?? generateTimestamp(-30),
    timemodified: overrides.timemodified ?? generateTimestamp(-1),
  };
}

// ============================================================================
// Grade Factory
// ============================================================================

/**
 * Creates a mock Grade entity with realistic default values
 * 
 * Generates a complete Grade object representing a grade given to a user for a
 * grade item. Default values mirror typical Moodle grade configuration:
 * 
 * - Raw grade: 85.5 (B+ equivalent)
 * - Grade range: 0-100
 * - Final grade equals raw grade (no adjustments)
 * - User modified: 1 (teacher who graded)
 * - Feedback: 'Good work!'
 * - Feedback format: 1 (HTML)
 * - Not hidden, not locked, not overridden, not excluded
 * 
 * @param {DeepPartial<Grade>} overrides - Partial grade properties to override defaults
 * @returns {Grade} Complete grade entity with all required fields
 * 
 * @example
 * // Create grade with defaults
 * const grade = mockGrade();
 * 
 * // Create perfect score
 * const perfectGrade = mockGrade({
 *   rawgrade: 100,
 *   finalgrade: 100,
 *   feedback: 'Excellent work!',
 * });
 * 
 * // Create grade for specific user and item
 * const studentGrade = mockGrade({
 *   userid: 42,
 *   itemid: 5,
 *   rawgrade: 78.5,
 * });
 */
export function mockGrade(overrides: DeepPartial<Grade> = {}): Grade {
  const id = overrides.id ?? generateGradeId();
  const rawgrade = overrides.rawgrade ?? 85.5;
  const multfactor = 1.0;
  const plusfactor = 0.0;
  const finalgrade = overrides.finalgrade ?? calculateFinalGrade(rawgrade, multfactor, plusfactor);

  return {
    id,
    itemid: overrides.itemid ?? 1,
    userid: overrides.userid ?? 2,
    rawgrade,
    rawgrademax: overrides.rawgrademax ?? 100,
    rawgrademin: overrides.rawgrademin ?? 0,
    rawscaleid: overrides.rawscaleid,
    usermodified: overrides.usermodified ?? 1, // Teacher who graded
    finalgrade,
    hidden: overrides.hidden ?? false,
    locked: overrides.locked ?? false,
    locktime: overrides.locktime,
    exported: overrides.exported,
    overridden: overrides.overridden ?? false,
    excluded: overrides.excluded ?? false,
    feedback: overrides.feedback ?? 'Good work!',
    feedbackformat: overrides.feedbackformat ?? 1, // 1=HTML
    information: overrides.information ?? '',
    informationformat: overrides.informationformat ?? 1,
  };
}

// ============================================================================
// Specialized Grade Factories
// ============================================================================

/**
 * Creates a mock Grade with a passing grade value
 * 
 * Generates a grade that meets or exceeds the standard passing threshold (50%).
 * Useful for testing pass/fail scenarios and grade aggregation.
 * 
 * @param {DeepPartial<Grade>} overrides - Additional grade properties to override
 * @returns {Grade} Grade with rawgrade >= 50
 * 
 * @example
 * const passingGrade = mockPassingGrade();
 * const highPassingGrade = mockPassingGrade({ rawgrade: 92 });
 */
export function mockPassingGrade(overrides: DeepPartial<Grade> = {}): Grade {
  const rawgrade = overrides.rawgrade ?? generateRandomGrade(50, 100);
  return mockGrade({
    ...overrides,
    rawgrade,
    finalgrade: calculateFinalGrade(rawgrade),
  });
}

/**
 * Creates a mock Grade with a failing grade value
 * 
 * Generates a grade below the standard passing threshold (50%).
 * Useful for testing fail scenarios and grade recovery workflows.
 * 
 * @param {DeepPartial<Grade>} overrides - Additional grade properties to override
 * @returns {Grade} Grade with rawgrade < 50
 * 
 * @example
 * const failingGrade = mockFailingGrade();
 * const barelyFailingGrade = mockFailingGrade({ rawgrade: 48 });
 */
export function mockFailingGrade(overrides: DeepPartial<Grade> = {}): Grade {
  const rawgrade = overrides.rawgrade ?? generateRandomGrade(0, 49);
  return mockGrade({
    ...overrides,
    rawgrade,
    finalgrade: calculateFinalGrade(rawgrade),
  });
}

/**
 * Creates a mock Grade that has been manually overridden
 * 
 * Generates a grade with the overridden flag set to true, indicating manual
 * teacher adjustment. Useful for testing grade override functionality and
 * gradebook workflows.
 * 
 * @param {DeepPartial<Grade>} overrides - Additional grade properties to override
 * @returns {Grade} Grade with overridden=true
 * 
 * @example
 * const overriddenGrade = mockOverriddenGrade();
 * const manualGrade = mockOverriddenGrade({
 *   rawgrade: 75,
 *   feedback: 'Adjusted for participation',
 * });
 */
export function mockOverriddenGrade(overrides: DeepPartial<Grade> = {}): Grade {
  return mockGrade({
    ...overrides,
    overridden: true,
    usermodified: overrides.usermodified ?? 1,
  });
}

// ============================================================================
// Array Generators
// ============================================================================

/**
 * Creates an array of mock Grade entities
 * 
 * Generates multiple grades for a specific grade item, each with a unique ID
 * and user ID. Useful for testing gradebook displays, aggregations, and
 * statistical calculations.
 * 
 * @param {Id} itemid - Grade item ID these grades belong to
 * @param {number} count - Number of grades to generate
 * @param {DeepPartial<Grade>} baseOverrides - Base properties to apply to all grades
 * @returns {Grade[]} Array of grade entities
 * 
 * @example
 * // Create 20 grades for assignment 1
 * const grades = mockGradeArray(1, 20);
 * 
 * // Create 10 passing grades for quiz 2
 * const passingGrades = mockGradeArray(2, 10, {
 *   rawgrade: 80,
 * });
 */
export function mockGradeArray(
  itemid: Id,
  count: number,
  baseOverrides: DeepPartial<Grade> = {}
): Grade[] {
  const grades: Grade[] = [];
  
  for (let i = 0; i < count; i++) {
    const userid = (i + 2); // Start from userid 2 (1 is typically admin/teacher)
    const rawgrade = baseOverrides.rawgrade ?? generateRandomGrade(0, 100);
    
    grades.push(mockGrade({
      ...baseOverrides,
      id: generateGradeId(),
      itemid,
      userid,
      rawgrade,
      finalgrade: calculateFinalGrade(rawgrade),
    }));
  }
  
  return grades;
}

/**
 * Creates an array of mock GradeItem entities for a course
 * 
 * Generates multiple grade items representing different gradeable activities
 * in a course. Each item has a unique ID and sort order. Useful for testing
 * gradebook structure, category organization, and item management.
 * 
 * @param {CourseId} courseid - Course ID these grade items belong to
 * @param {number} count - Number of grade items to generate
 * @param {DeepPartial<GradeItem>} baseOverrides - Base properties to apply to all items
 * @returns {GradeItem[]} Array of grade item entities
 * 
 * @example
 * // Create 5 grade items for course 1
 * const items = mockGradeItemArray(1, 5);
 * 
 * // Create 3 assignment grade items
 * const assignments = mockGradeItemArray(1, 3, {
 *   itemtype: 'mod',
 *   itemmodule: 'assign',
 *   grademax: 100,
 * });
 */
export function mockGradeItemArray(
  courseid: CourseId,
  count: number,
  baseOverrides: DeepPartial<GradeItem> = {}
): GradeItem[] {
  const items: GradeItem[] = [];
  
  for (let i = 0; i < count; i++) {
    const sortorder = i + 1;
    
    items.push(mockGradeItem({
      ...baseOverrides,
      id: generateGradeItemId(),
      courseid,
      sortorder,
      itemname: baseOverrides.itemname ?? `Grade Item ${i + 1}`,
    }));
  }
  
  return items;
}

/**
 * Creates a complete mock gradebook structure for a course
 * 
 * Generates a realistic gradebook with multiple grade items and corresponding
 * grades for multiple students. Useful for testing complete gradebook views,
 * aggregations, and reporting functionality.
 * 
 * Default structure:
 * - 5 grade items (assignments, quizzes, etc.)
 * - 10 students with grades
 * - Mix of passing and failing grades
 * - Realistic grade distribution
 * 
 * @param {CourseId} courseid - Course ID for the gradebook
 * @param {number} itemCount - Number of grade items to create
 * @param {number} studentCount - Number of students to create grades for
 * @returns {Object} Gradebook structure with items and grades
 * @returns {GradeItem[]} returns.items - Array of grade items
 * @returns {Grade[]} returns.grades - Array of all grades
 * 
 * @example
 * // Create default gradebook for course 1
 * const gradebook = mockCourseGradebook(1);
 * 
 * // Create large gradebook with 10 items and 50 students
 * const largeGradebook = mockCourseGradebook(1, 10, 50);
 * 
 * // Access specific data
 * const { items, grades } = mockCourseGradebook(2);
 * const firstItem = items[0];
 * const gradesForFirstItem = grades.filter(g => g.itemid === firstItem.id);
 */
export function mockCourseGradebook(
  courseid: CourseId,
  itemCount: number = 5,
  studentCount: number = 10
): { items: GradeItem[]; grades: Grade[] } {
  // Create grade items
  const items: GradeItem[] = [];
  const grades: Grade[] = [];
  
  // Generate various types of grade items
  const itemTypes = [
    { itemtype: 'mod', itemmodule: 'assign', itemname: 'Assignment', grademax: 100 },
    { itemtype: 'mod', itemmodule: 'quiz', itemname: 'Quiz', grademax: 50 },
    { itemtype: 'mod', itemmodule: 'forum', itemname: 'Forum Participation', grademax: 20 },
    { itemtype: 'manual', itemmodule: undefined, itemname: 'Participation', grademax: 10 },
    { itemtype: 'mod', itemmodule: 'assign', itemname: 'Final Project', grademax: 150 },
  ];
  
  for (let i = 0; i < itemCount; i++) {
    const typeIndex = i % itemTypes.length;
    const typeConfig = itemTypes[typeIndex];
    
    const item = mockGradeItem({
      id: generateGradeItemId(),
      courseid,
      itemname: `${typeConfig.itemname} ${Math.floor(i / itemTypes.length) + 1}`,
      itemtype: typeConfig.itemtype,
      itemmodule: typeConfig.itemmodule,
      iteminstance: i + 1,
      grademax: typeConfig.grademax,
      gradepass: typeConfig.grademax * 0.5, // 50% pass threshold
      sortorder: i + 1,
    });
    
    items.push(item);
    
    // Create grades for each student for this item
    for (let j = 0; j < studentCount; j++) {
      const userid = j + 2; // Start from userid 2
      
      // Generate varied grade distribution (mix of high, medium, low)
      let rawgrade: number;
      const rand = Math.random();
      if (rand < 0.7) {
        // 70% passing grades
        rawgrade = generateRandomGrade(item.gradepass!, item.grademax);
      } else {
        // 30% failing grades
        rawgrade = generateRandomGrade(item.grademin, item.gradepass! - 1);
      }
      
      grades.push(mockGrade({
        id: generateGradeId(),
        itemid: item.id,
        userid,
        rawgrade,
        rawgrademax: item.grademax,
        rawgrademin: item.grademin,
        finalgrade: calculateFinalGrade(rawgrade, item.multfactor, item.plusfactor),
        feedback: rawgrade >= item.gradepass! ? 'Good work!' : 'Needs improvement',
      }));
    }
  }
  
  return { items, grades };
}
