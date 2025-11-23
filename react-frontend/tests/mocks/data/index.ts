/**
 * Mock Data Generators - Central Export Module
 * 
 * This barrel export module provides a centralized import point for all test mock data
 * generators across the testing suite. It re-exports mock factories from auth, users,
 * courses, assignments, quizzes, grades, and messages modules.
 * 
 * @module tests/mocks/data
 * 
 * @example
 * ```typescript
 * import {
 *   mockUser,
 *   mockCourse,
 *   mockAssignment,
 *   mockQuiz,
 *   mockGrade,
 *   mockMessage
 * } from '@/tests/mocks/data';
 * 
 * // Create mock data with custom overrides
 * const user = mockUser({ id: 1, username: 'testuser' });
 * const course = mockCourse({ id: 1, fullname: 'Test Course' });
 * const assignment = mockAssignment({ course: course.id });
 * const quiz = mockQuiz({ course: course.id, name: 'Test Quiz' });
 * const grade = mockGrade({ userid: user.id, itemid: assignment.id });
 * const message = mockMessage({ useridfrom: user.id });
 * ```
 * 
 * @example
 * ```typescript
 * // Create arrays of mock data for testing lists
 * import { mockUserArray, mockCourseArray, mockAssignmentArray } from '@/tests/mocks/data';
 * 
 * const users = mockUserArray(5); // Create 5 mock users
 * const courses = mockCourseArray(10); // Create 10 mock courses
 * const assignments = mockAssignmentArray(3, { course: 1 }); // Create 3 assignments for course 1
 * ```
 * 
 * @example
 * ```typescript
 * // Use specialized mock generators for specific states
 * import {
 *   mockStudent,
 *   mockTeacher,
 *   mockAdmin,
 *   mockDraftSubmission,
 *   mockSubmittedSubmission,
 *   mockInProgressAttempt,
 *   mockFinishedAttempt,
 *   mockPassingGrade,
 *   mockFailingGrade
 * } from '@/tests/mocks/data';
 * 
 * const student = mockStudent();
 * const teacher = mockTeacher();
 * const admin = mockAdmin();
 * const draft = mockDraftSubmission();
 * const submitted = mockSubmittedSubmission();
 * const attempt = mockInProgressAttempt();
 * const finishedAttempt = mockFinishedAttempt();
 * const passingGrade = mockPassingGrade();
 * const failingGrade = mockFailingGrade();
 * ```
 */

// ============================================================================
// Authentication Mock Data
// ============================================================================
/**
 * Re-export authentication-related mock data generators.
 * 
 * Provides generators for JWT tokens, decoded JWT payloads, and login responses
 * used in authentication testing scenarios.
 */
export * from './auth';

// ============================================================================
// User Mock Data
// ============================================================================
/**
 * Re-export user-related mock data generators.
 * 
 * Provides generators for users with different roles (student, teacher, admin)
 * and functions to create arrays of users for testing list operations.
 */
export * from './users';

// ============================================================================
// Course Mock Data
// ============================================================================
/**
 * Re-export course-related mock data generators.
 * 
 * Provides generators for courses, course modules, course categories, and
 * functions to create arrays for testing course catalogs and course content.
 */
export * from './courses';

// ============================================================================
// Assignment Mock Data
// ============================================================================
/**
 * Re-export assignment-related mock data generators.
 * 
 * Provides generators for assignments, submissions in various states (draft,
 * submitted), and functions to create arrays for testing assignment workflows.
 */
export * from './assignments';

// ============================================================================
// Quiz Mock Data
// ============================================================================
/**
 * Re-export quiz-related mock data generators.
 * 
 * Provides generators for quizzes, quiz attempts in various states (in-progress,
 * finished, overdue), and functions to create arrays for testing quiz functionality.
 */
export * from './quizzes';

// ============================================================================
// Grade Mock Data
// ============================================================================
/**
 * Re-export grade-related mock data generators.
 * 
 * Provides generators for grades, grade items, specialized grade states (passing,
 * failing, overridden), and functions to create complete gradebook scenarios.
 */
export * from './grades';

// ============================================================================
// Message Mock Data
// ============================================================================
/**
 * Re-export message-related mock data generators.
 * 
 * Provides generators for messages, notifications, conversations (individual and
 * group), and functions to create complete messaging scenarios for testing.
 */
export * from './messages';
