/**
 * E2E Test Fixtures - Gradebook Data
 * 
 * Provides predefined gradebook objects including grade items, categories, and user grades.
 * Supports testing grade calculations, aggregation methods (weighted mean, sum of grades),
 * grade history, and gradebook workflows for both students and teachers.
 * 
 * @module tests/e2e/fixtures/grades
 */

import { testCourse1 } from './courses';
import { testStudent, testStudent2 } from './users';
import { testAssignment1, testAssignment2 } from './assignments';
import { testQuiz1, testQuiz2 } from './quizzes';

/**
 * Grade aggregation method constants matching Moodle gradebook aggregation types
 * These determine how grades within a category are combined to produce a category total
 */
export const GRADE_AGGREGATION = {
  /** Mean of all grades (sum / count) - default method */
  MEAN_OF_GRADES: 0,
  /** Weighted mean using aggregationcoef values as weights */
  WEIGHTED_MEAN: 10,
  /** Simple sum of all grades */
  SUM_OF_GRADES: 6,
  /** Median grade value (middle value when sorted) */
  MEDIAN_OF_GRADES: 2,
  /** Highest grade value in the category */
  HIGHEST_GRADE: 4,
  /** Most frequently occurring grade value */
  MODE_OF_GRADES: 8,
} as const;

/**
 * Moodle grade item interface matching Moodle grade_items table structure
 * Represents a gradable item (assignment, quiz, manual item, category, or course)
 * from the backend/database perspective.
 * 
 * Note: This is distinct from the GradeItem interface in GradebookPage.ts
 * which represents the frontend React component's data structure.
 */
export interface MoodleGradeItem {
  /** Unique grade item identifier */
  id: number;
  /** Course ID this grade item belongs to */
  courseid: number;
  /** Name/title of the grade item */
  itemname: string;
  /** Type of grade item (mod, manual, course, category) */
  itemtype: string;
  /** Module name for mod items (assign, quiz, forum, etc.) */
  itemmodule: string | null;
  /** Maximum grade value */
  grademax: number;
  /** Minimum grade value */
  grademin: number;
  /** Weight/coefficient for aggregation calculations */
  aggregationcoef: number;
  /** Sort order within category */
  sortorder: number;
  /** Category ID this item belongs to (null for top-level) */
  categoryid: number | null;
  /** Whether this item is locked from editing */
  locked?: boolean;
  /** Whether this item is hidden from students */
  hidden?: boolean;
  /** Unix timestamp of last modification */
  timemodified?: number;
}

/**
 * Transforms a Moodle backend grade item to the frontend GradeItem format
 * used by the GradebookPage POM.
 * 
 * This helper bridges the gap between backend data structures (from fixtures/API)
 * and frontend React component data structures (expected by POM methods).
 * 
 * @param moodleItem - Backend grade item from Moodle database structure
 * @returns Frontend grade item compatible with GradebookPage methods
 */
export function transformToFrontendGradeItem(moodleItem: MoodleGradeItem): {
  id: string;
  name: string;
  maxGrade: number;
  category?: string;
  weight?: number;
} {
  return {
    id: moodleItem.id.toString(),
    name: moodleItem.itemname,
    maxGrade: moodleItem.grademax,
    category: moodleItem.categoryid?.toString(),
    weight: moodleItem.aggregationcoef,
  };
}

/**
 * Grade category interface matching Moodle grade_categories table structure
 * Represents a category that organizes grade items hierarchically
 */
export interface GradeCategory {
  /** Unique category identifier */
  id: number;
  /** Course ID this category belongs to */
  courseid: number;
  /** Category name/title */
  fullname: string;
  /** Aggregation method constant for combining grades */
  aggregation: number;
  /** Whether to aggregate only graded items (exclude ungraded) */
  aggregateonlygraded: boolean;
  /** Number of lowest grades to drop from calculation */
  droplow: number;
  /** Parent category ID (null for top-level categories) */
  parent?: number | null;
  /** Sort order among sibling categories */
  sortorder?: number;
  /** Whether category is hidden from students */
  hidden?: boolean;
}

/**
 * User grade interface matching Moodle grade_grades table structure
 * Represents a specific grade awarded to a user for a grade item
 */
export interface UserGrade {
  /** Unique grade record identifier */
  id: number;
  /** Grade item ID this grade belongs to */
  itemid: number;
  /** User ID of the student receiving this grade */
  userid: number;
  /** Final calculated grade value */
  finalgrade: number | null;
  /** Feedback text from grader (HTML allowed) */
  feedback: string | null;
  /** Unix timestamp when grade was last modified */
  timemodified: number;
  /** Whether grade was manually overridden by teacher */
  overridden: boolean;
  /** Whether grade is locked from further changes */
  locked: boolean;
  /** Whether grade is excluded from category aggregation */
  excluded?: boolean;
  /** User ID of the person who graded */
  usermodified?: number;
}

/**
 * Grade history record interface for tracking grade changes over time
 */
export interface GradeHistory {
  /** History record identifier */
  id: number;
  /** Grade item ID */
  itemid: number;
  /** User ID of the student */
  userid: number;
  /** Grade value before change */
  oldgrade: number | null;
  /** Grade value after change */
  newgrade: number | null;
  /** Feedback before change */
  oldfeedback: string | null;
  /** Feedback after change */
  newfeedback: string | null;
  /** Unix timestamp of change */
  timemodified: number;
  /** User ID who made the change */
  usermodified: number;
  /** Action description */
  action: string;
}

/**
 * Assignments category fixture
 * Category for grouping assignment grade items with weighted mean aggregation
 */
export const assignmentsCategory: GradeCategory = {
  id: 1001,
  courseid: testCourse1.id,
  fullname: 'Assignments',
  aggregation: GRADE_AGGREGATION.WEIGHTED_MEAN,
  aggregateonlygraded: true,
  droplow: 0, // Don't drop any grades
  parent: null,
  sortorder: 1,
  hidden: false,
};

/**
 * Quizzes category fixture
 * Category for quiz grades with mean aggregation and drop lowest score
 */
export const quizzesCategory: GradeCategory = {
  id: 1002,
  courseid: testCourse1.id,
  fullname: 'Quizzes',
  aggregation: GRADE_AGGREGATION.MEAN_OF_GRADES,
  aggregateonlygraded: true,
  droplow: 1, // Drop lowest quiz grade
  parent: null,
  sortorder: 2,
  hidden: false,
};

/**
 * Final exam category fixture
 * Category for final exam with simple sum aggregation
 */
export const finalExamCategory: GradeCategory = {
  id: 1003,
  courseid: testCourse1.id,
  fullname: 'Final Exam',
  aggregation: GRADE_AGGREGATION.SUM_OF_GRADES,
  aggregateonlygraded: true,
  droplow: 0,
  parent: null,
  sortorder: 3,
  hidden: false,
};

/**
 * Test grade item 1: Programming Assignment 1
 * Grade item linked to testAssignment1 with weight 2.0 (counts double)
 */
export const testGradeItem1: MoodleGradeItem = {
  id: 2001,
  courseid: testCourse1.id,
  itemname: testAssignment1.name,
  itemtype: 'mod',
  itemmodule: 'assign',
  grademax: testAssignment1.grade,
  grademin: 0,
  aggregationcoef: 2.0, // Weight of 2x
  sortorder: 1,
  categoryid: assignmentsCategory.id,
  locked: false,
  hidden: false,
  timemodified: Math.floor(Date.now() / 1000),
};

/**
 * Test grade item 2: Essay Assignment
 * Grade item linked to testAssignment2 with standard weight
 */
export const testGradeItem2: MoodleGradeItem = {
  id: 2002,
  courseid: testCourse1.id,
  itemname: testAssignment2.name,
  itemtype: 'mod',
  itemmodule: 'assign',
  grademax: testAssignment2.grade,
  grademin: 0,
  aggregationcoef: 1.0, // Standard weight
  sortorder: 2,
  categoryid: assignmentsCategory.id,
  locked: false,
  hidden: false,
  timemodified: Math.floor(Date.now() / 1000),
};

/**
 * Test grade item 3: Python Fundamentals Quiz
 * Grade item linked to testQuiz1 with standard weight
 */
export const testGradeItem3: MoodleGradeItem = {
  id: 2003,
  courseid: testCourse1.id,
  itemname: testQuiz1.name,
  itemtype: 'mod',
  itemmodule: 'quiz',
  grademax: testQuiz1.sumgrades,
  grademin: 0,
  aggregationcoef: 1.0,
  sortorder: 1,
  categoryid: quizzesCategory.id,
  locked: false,
  hidden: false,
  timemodified: Math.floor(Date.now() / 1000),
};

/**
 * Test grade item 4: Midterm Exam Quiz
 * Grade item linked to testQuiz2 with higher weight
 */
export const testGradeItem4: MoodleGradeItem = {
  id: 2004,
  courseid: testCourse1.id,
  itemname: testQuiz2.name,
  itemtype: 'mod',
  itemmodule: 'quiz',
  grademax: testQuiz2.sumgrades,
  grademin: 0,
  aggregationcoef: 1.5, // Weight of 1.5x
  sortorder: 2,
  categoryid: quizzesCategory.id,
  locked: false,
  hidden: false,
  timemodified: Math.floor(Date.now() / 1000),
};

/**
 * Test student (John Student) grades fixture
 * Complete set of grades for the first test student
 */
export const testStudentGrades: UserGrade[] = [
  {
    id: 3001,
    itemid: testGradeItem1.id,
    userid: testStudent.id,
    finalgrade: 85.0,
    feedback: '<p>Good work on the programming assignment. Code is well-structured but needs better error handling.</p>',
    timemodified: Math.floor(Date.now() / 1000) - 86400 * 2, // 2 days ago
    overridden: false,
    locked: false,
    usermodified: 1, // Teacher ID
  },
  {
    id: 3002,
    itemid: testGradeItem2.id,
    userid: testStudent.id,
    finalgrade: 92.0,
    feedback: '<p>Excellent essay with clear analysis and good examples.</p>',
    timemodified: Math.floor(Date.now() / 1000) - 86400 * 1, // 1 day ago
    overridden: false,
    locked: false,
    usermodified: 1,
  },
  {
    id: 3003,
    itemid: testGradeItem3.id,
    userid: testStudent.id,
    finalgrade: 7.0, // Out of 8.0
    feedback: null,
    timemodified: Math.floor(Date.now() / 1000) - 86400 * 5, // 5 days ago
    overridden: false,
    locked: false,
  },
  {
    id: 3004,
    itemid: testGradeItem4.id,
    userid: testStudent.id,
    finalgrade: 45.0, // Out of 50.0
    feedback: '<p>Strong performance on the midterm. Review loop concepts for better mastery.</p>',
    timemodified: Math.floor(Date.now() / 1000) - 86400 * 3, // 3 days ago
    overridden: false,
    locked: false,
    usermodified: 1,
  },
];

/**
 * Test student 2 (Jane Smith) grades fixture
 * Complete set of grades for the second test student with different performance
 */
export const testStudent2Grades: UserGrade[] = [
  {
    id: 3005,
    itemid: testGradeItem1.id,
    userid: testStudent2.id,
    finalgrade: 95.0,
    feedback: '<p>Outstanding work! Code demonstrates excellent understanding of OOP principles.</p>',
    timemodified: Math.floor(Date.now() / 1000) - 86400 * 2,
    overridden: false,
    locked: false,
    usermodified: 1,
  },
  {
    id: 3006,
    itemid: testGradeItem2.id,
    userid: testStudent2.id,
    finalgrade: 88.0,
    feedback: '<p>Well-written essay with good insights. Could expand on the use case examples.</p>',
    timemodified: Math.floor(Date.now() / 1000) - 86400 * 1,
    overridden: false,
    locked: false,
    usermodified: 1,
  },
  {
    id: 3007,
    itemid: testGradeItem3.id,
    userid: testStudent2.id,
    finalgrade: 6.5, // Out of 8.0
    feedback: null,
    timemodified: Math.floor(Date.now() / 1000) - 86400 * 5,
    overridden: false,
    locked: false,
  },
  {
    id: 3008,
    itemid: testGradeItem4.id,
    userid: testStudent2.id,
    finalgrade: 48.0, // Out of 50.0
    feedback: '<p>Excellent work on the midterm exam. One of the top scores in the class!</p>',
    timemodified: Math.floor(Date.now() / 1000) - 86400 * 3,
    overridden: false,
    locked: false,
    usermodified: 1,
  },
];

/**
 * Grade history fixture showing grade changes over time
 * Tracks modifications to grades for audit and transparency
 */
export const gradeHistory: GradeHistory[] = [
  {
    id: 4001,
    itemid: testGradeItem1.id,
    userid: testStudent.id,
    oldgrade: 80.0,
    newgrade: 85.0,
    oldfeedback: '<p>Good work.</p>',
    newfeedback: '<p>Good work on the programming assignment. Code is well-structured but needs better error handling.</p>',
    timemodified: Math.floor(Date.now() / 1000) - 86400 * 2,
    usermodified: 1,
    action: 'Manual grade override - adjusted after reviewing resubmission',
  },
  {
    id: 4002,
    itemid: testGradeItem4.id,
    userid: testStudent2.id,
    oldgrade: 46.0,
    newgrade: 48.0,
    oldfeedback: null,
    newfeedback: '<p>Excellent work on the midterm exam. One of the top scores in the class!</p>',
    timemodified: Math.floor(Date.now() / 1000) - 86400 * 3,
    usermodified: 1,
    action: 'Manual grade adjustment - added partial credit for question 7',
  },
  {
    id: 4003,
    itemid: testGradeItem2.id,
    userid: testStudent.id,
    oldgrade: null,
    newgrade: 92.0,
    oldfeedback: null,
    newfeedback: '<p>Excellent essay with clear analysis and good examples.</p>',
    timemodified: Math.floor(Date.now() / 1000) - 86400 * 1,
    usermodified: 1,
    action: 'Initial grade entry',
  },
];

/**
 * Helper function to create a custom grade item for testing
 * 
 * @param overrides - Partial grade item properties to override defaults
 * @returns Complete MoodleGradeItem object with all required properties
 */
export function createGradeItem(overrides: Partial<MoodleGradeItem> = {}): MoodleGradeItem {
  return {
    id: Math.floor(Math.random() * 10000) + 5000,
    courseid: testCourse1.id,
    itemname: 'Custom Grade Item',
    itemtype: 'manual',
    itemmodule: null,
    grademax: 100,
    grademin: 0,
    aggregationcoef: 1.0,
    sortorder: 99,
    categoryid: null,
    locked: false,
    hidden: false,
    timemodified: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * Helper function to create a custom grade category for testing
 * 
 * @param overrides - Partial grade category properties to override defaults
 * @returns Complete GradeCategory object with all required properties
 */
export function createGradeCategory(overrides: Partial<GradeCategory> = {}): GradeCategory {
  return {
    id: Math.floor(Math.random() * 10000) + 5000,
    courseid: testCourse1.id,
    fullname: 'Custom Category',
    aggregation: GRADE_AGGREGATION.MEAN_OF_GRADES,
    aggregateonlygraded: true,
    droplow: 0,
    parent: null,
    sortorder: 99,
    hidden: false,
    ...overrides,
  };
}

/**
 * Helper function to create a user grade record for testing
 * 
 * @param overrides - Partial user grade properties to override defaults
 * @returns Complete UserGrade object with all required properties
 */
export function createUserGrade(overrides: Partial<UserGrade> = {}): UserGrade {
  return {
    id: Math.floor(Math.random() * 10000) + 5000,
    itemid: testGradeItem1.id,
    userid: testStudent.id,
    finalgrade: 75.0,
    feedback: null,
    timemodified: Math.floor(Date.now() / 1000),
    overridden: false,
    locked: false,
    ...overrides,
  };
}

/**
 * Calculate course grade based on category aggregation methods
 * This helper simulates Moodle's grade calculation algorithm for testing
 * 
 * @param grades - Array of user grades to aggregate
 * @param items - Array of grade items corresponding to the grades
 * @param categories - Array of categories for hierarchical calculation
 * @returns Calculated final course grade as percentage (0-100)
 * 
 * @example
 * ```typescript
 * const courseGrade = calculateCourseGrade(
 *   testStudentGrades,
 *   [testGradeItem1, testGradeItem2, testGradeItem3, testGradeItem4],
 *   [assignmentsCategory, quizzesCategory]
 * );
 * expect(courseGrade).toBeCloseTo(88.5, 1);
 * ```
 */
export function calculateCourseGrade(
  grades: UserGrade[],
  items: MoodleGradeItem[],
  categories: GradeCategory[]
): number {
  // Group grades by category
  const gradesByCategory = new Map<number | null, Array<{ grade: UserGrade; item: MoodleGradeItem }>>();
  
  grades.forEach(grade => {
    const item = items.find(i => i.id === grade.itemid);
    if (!item || grade.finalgrade === null) {
      return; // Skip if item not found or grade is null
    }
    
    const categoryId = item.categoryid;
    if (!gradesByCategory.has(categoryId)) {
      gradesByCategory.set(categoryId, []);
    }
    gradesByCategory.get(categoryId)!.push({ grade, item });
  });
  
  // Calculate category totals
  const categoryTotals: Array<{ value: number; weight: number }> = [];
  
  categories.forEach(category => {
    const categoryGrades = gradesByCategory.get(category.id) || [];
    if (categoryGrades.length === 0) {
      return; // Skip empty categories
    }
    
    // Convert raw grades to percentages
    const percentageGrades = categoryGrades.map(({ grade, item }) => {
      const percentage = ((grade.finalgrade || 0) / item.grademax) * 100;
      const weight = item.aggregationcoef || 1.0;
      return { percentage, weight };
    });
    
    let categoryTotal = 0;
    
    // Apply aggregation method
    switch (category.aggregation) {
      case GRADE_AGGREGATION.MEAN_OF_GRADES:
        // Simple average
        categoryTotal = percentageGrades.reduce((sum, g) => sum + g.percentage, 0) / percentageGrades.length;
        break;
        
      case GRADE_AGGREGATION.WEIGHTED_MEAN: {
        // Weighted average
        const totalWeight = percentageGrades.reduce((sum, g) => sum + g.weight, 0);
        const weightedSum = percentageGrades.reduce((sum, g) => sum + (g.percentage * g.weight), 0);
        categoryTotal = weightedSum / totalWeight;
        break;
      }
        
      case GRADE_AGGREGATION.SUM_OF_GRADES:
        // Sum all grades
        categoryTotal = percentageGrades.reduce((sum, g) => sum + g.percentage, 0);
        break;
        
      case GRADE_AGGREGATION.HIGHEST_GRADE:
        // Maximum grade
        categoryTotal = Math.max(...percentageGrades.map(g => g.percentage));
        break;
        
      case GRADE_AGGREGATION.MEDIAN_OF_GRADES: {
        // Median grade
        const sorted = percentageGrades.map(g => g.percentage).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        categoryTotal = sorted.length % 2 === 0 
          ? (sorted[mid - 1]! + sorted[mid]!) / 2 
          : sorted[mid]!;
        break;
      }
        
      default:
        // Default to mean
        categoryTotal = percentageGrades.reduce((sum, g) => sum + g.percentage, 0) / percentageGrades.length;
    }
    
    // Handle drop lowest
    if (category.droplow > 0 && percentageGrades.length > category.droplow) {
      const sortedGrades = [...percentageGrades].sort((a, b) => a.percentage - b.percentage);
      const keptGrades = sortedGrades.slice(category.droplow); // Drop lowest N
      categoryTotal = keptGrades.reduce((sum, g) => sum + g.percentage, 0) / keptGrades.length;
    }
    
    categoryTotals.push({ value: categoryTotal, weight: 1.0 });
  });
  
  // Calculate final course grade as mean of category totals
  if (categoryTotals.length === 0) {
    return 0;
  }
  
  const totalWeight = categoryTotals.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = categoryTotals.reduce((sum, c) => sum + (c.value * c.weight), 0);
  return weightedSum / totalWeight;
}
