/**
 * Mock Quiz Data Generators
 * 
 * Factory functions for creating realistic Moodle quiz and quiz attempt entities for testing.
 * Provides mockQuiz(), mockQuizAttempt(), and specialized attempt factory functions with
 * sensible defaults for quiz properties including time limits, attempt rules, grading methods,
 * and customizable overrides.
 * 
 * All generated mock data matches the Quiz and QuizAttempt interface structures and includes
 * realistic values based on actual Moodle quiz configuration patterns.
 * 
 * @module tests/mocks/data/quizzes
 * @see react-frontend/src/types/entities.ts - Quiz and QuizAttempt interface definitions
 * @see public/mod/quiz/lib.php - Moodle quiz module reference
 * @see public/mod/quiz/view.php - Quiz display reference
 * @see public/mod/quiz/attempt.php - Quiz attempt handling reference
 */

import type { Quiz, QuizAttempt } from '@/types/entities';
import type { QuizId, CourseId, UserId, Id } from '@/types/common';
import { _mockCourse } from './courses';
import { _mockUser } from './users';

// ============================================================================
// Utility Types
// ============================================================================

/**
 * DeepPartial utility type for nested partial objects
 * Allows partial overrides of nested properties in Quiz and QuizAttempt interfaces
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : DeepPartial<T[P]>
    : T[P];
};

// ============================================================================
// ID and Timestamp Generation
// ============================================================================

/**
 * Counter for generating sequential quiz IDs
 */
let quizIdCounter = 1;

/**
 * Counter for generating sequential quiz attempt IDs
 */
let attemptIdCounter = 1;

/**
 * Counter for generating sequential unique IDs for question usage
 */
let uniqueIdCounter = 100000;

/**
 * Generates a unique sequential quiz ID
 * 
 * @returns {QuizId} Sequential quiz ID starting from 1
 * 
 * @example
 * const id1 = generateQuizId(); // 1
 * const id2 = generateQuizId(); // 2
 */
export function generateQuizId(): QuizId {
  return quizIdCounter++;
}

/**
 * Generates a unique sequential attempt ID
 * 
 * @returns {Id} Sequential attempt ID
 */
function generateAttemptId(): Id {
  return attemptIdCounter++;
}

/**
 * Generates a unique ID for question usage
 * 
 * @returns {number} Unique identifier for question session
 */
function generateUniqueId(): number {
  return uniqueIdCounter++;
}

/**
 * Generates a realistic Unix timestamp with optional offset
 * 
 * @param {number} [daysFromNow=0] - Number of days to offset from current time
 *                                   (positive=future, negative=past)
 * @returns {number} Unix timestamp in seconds
 * 
 * @example
 * const now = generateTimestamp();
 * const nextWeek = generateTimestamp(7);
 * const lastMonth = generateTimestamp(-30);
 */
export function generateTimestamp(daysFromNow: number = 0): number {
  const now = Date.now();
  const daysInMs = daysFromNow * 24 * 60 * 60 * 1000;
  return Math.floor((now + daysInMs) / 1000);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Returns a random quiz attempt state
 * 
 * @returns {string} Random state value from valid QuizAttempt states
 */
export function getRandomState(): 'inprogress' | 'overdue' | 'finished' | 'abandoned' {
  const states: Array<'inprogress' | 'overdue' | 'finished' | 'abandoned'> = [
    'inprogress',
    'overdue',
    'finished',
    'abandoned',
  ];
  const index = Math.floor(Math.random() * states.length);
  return states[index];
}

/**
 * Generates a question layout string for quiz attempts
 * 
 * Question layout represents the order and pagination of questions in a quiz.
 * Format: comma-separated list of question IDs with 0 representing page breaks.
 * Example: "1,2,3,0,4,5,6,0" means questions 1-3 on page 1, questions 4-6 on page 2
 * 
 * @param {number} numQuestions - Total number of questions in the quiz
 * @returns {string} Question layout string with page breaks
 * 
 * @example
 * generateQuestionLayout(6); // "1,2,3,0,4,5,6,0"
 * generateQuestionLayout(3); // "1,2,3,0"
 */
export function generateQuestionLayout(numQuestions: number): string {
  const questionsPerPage = 3;
  const layout: (number | string)[] = [];
  
  for (let i = 1; i <= numQuestions; i++) {
    layout.push(i);
    if (i % questionsPerPage === 0 && i < numQuestions) {
      layout.push(0); // Page break
    }
  }
  
  layout.push(0); // Final page break
  return layout.join(',');
}

/**
 * Returns a random preferred behaviour from common Moodle quiz settings
 * 
 * @returns {string} Quiz behaviour setting
 */
function _getRandomBehaviour(): string {
  const behaviours = [
    'deferredfeedback',
    'adaptive',
    'immediatefeedback',
    'interactive',
  ];
  const index = Math.floor(Math.random() * behaviours.length);
  return behaviours[index];
}

/**
 * Returns a random overdue handling method
 * 
 * @returns {string} Overdue handling setting
 */
function _getRandomOverdueHandling(): string {
  const methods = ['autosubmit', 'graceperiod', 'autoabandon'];
  const index = Math.floor(Math.random() * methods.length);
  return methods[index];
}

// ============================================================================
// Quiz Factory
// ============================================================================

/**
 * Creates a mock Quiz entity with realistic default values
 * 
 * Default values mirror typical Moodle quiz configuration:
 * - 1 hour time limit (3600 seconds)
 * - Opens immediately, closes in 7 days
 * - 3 allowed attempts
 * - Highest grade grading method
 * - Deferred feedback question behaviour
 * - Auto-submit on overdue
 * - HTML intro format
 * - 100 points maximum grade
 * 
 * @param {DeepPartial<Quiz>} [overrides={}] - Partial quiz properties to override defaults
 * @returns {Quiz} Complete quiz entity with all required fields populated
 * 
 * @example
 * // Create quiz with defaults
 * const quiz = mockQuiz();
 * 
 * // Create quiz with custom settings
 * const customQuiz = mockQuiz({
 *   name: 'Final Exam',
 *   timelimit: 7200, // 2 hours
 *   attempts: 1, // Only one attempt allowed
 *   timeclose: generateTimestamp(14), // Closes in 2 weeks
 * });
 * 
 * // Create quiz for specific course
 * const courseQuiz = mockQuiz({
 *   course: 42,
 *   name: 'Chapter 5 Quiz',
 * });
 */
export function mockQuiz(overrides: DeepPartial<Quiz> = {}): Quiz {
  const now = generateTimestamp();
  const sevenDaysLater = generateTimestamp(7);
  
  const defaults: Quiz = {
    id: generateQuizId(),
    course: 1,
    name: 'Test Quiz',
    intro: 'This is a test quiz for unit testing',
    introformat: 1, // HTML format
    timeopen: now,
    timeclose: sevenDaysLater,
    timelimit: 3600, // 1 hour in seconds
    overduehandling: 'autosubmit',
    graceperiod: 0,
    preferredbehaviour: 'deferredfeedback',
    canredoquestions: false,
    attempts: 3, // Allow 3 attempts
    grademethod: 1, // Highest grade
    grade: 100, // Maximum grade (points)
    sumgrades: 100, // Sum of all question grades
    questiondecimalpoints: 2,
    attemptonlast: false,
    decimalpoints: 2,
    reviewattempt: 1,
    reviewcorrectness: 1,
    reviewmarks: 1,
    reviewspecificfeedback: 1,
    reviewgeneralfeedback: 1,
    reviewrightanswer: 1,
    reviewoverallfeedback: 1,
    questionsperpage: 3,
    navmethod: 'free',
    shuffleanswers: true,
    timecreated: generateTimestamp(-30), // Created 30 days ago
    timemodified: generateTimestamp(-1), // Modified yesterday
    password: undefined,
    subnet: undefined,
    browsersecurity: undefined,
    delay1: 0,
    delay2: 0,
    showuserpicture: false,
    showblocks: false,
    completionattemptsexhausted: false,
    completionpass: false,
    completionminattemptsenabled: false,
    completionminattempts: 0,
    allowofflineattempts: false,
  };
  
  return {
    ...defaults,
    ...overrides,
  } as Quiz;
}

// ============================================================================
// Quiz Attempt Factory
// ============================================================================

/**
 * Creates a mock QuizAttempt entity with realistic default values
 * 
 * Default values represent a typical quiz attempt:
 * - First attempt (attempt number 1)
 * - In progress state
 * - Started at current timestamp
 * - On first page (currentpage: 0)
 * - Not a preview
 * - 3-question layout
 * 
 * @param {DeepPartial<QuizAttempt>} [overrides={}] - Partial attempt properties to override
 * @returns {QuizAttempt} Complete quiz attempt entity with all required fields
 * 
 * @example
 * // Create attempt with defaults
 * const attempt = mockQuizAttempt();
 * 
 * // Create finished attempt with grade
 * const finishedAttempt = mockQuizAttempt({
 *   state: 'finished',
 *   timefinish: generateTimestamp(),
 *   sumgrades: 85.5,
 * });
 * 
 * // Create attempt for specific user and quiz
 * const userAttempt = mockQuizAttempt({
 *   quiz: 10,
 *   userid: 42,
 *   attempt: 2, // Second attempt
 * });
 */
export function mockQuizAttempt(overrides: DeepPartial<QuizAttempt> = {}): QuizAttempt {
  const now = generateTimestamp();
  
  const defaults: QuizAttempt = {
    id: generateAttemptId(),
    quiz: 1,
    userid: 2, // Default to student user ID
    attempt: 1, // First attempt
    uniqueid: generateUniqueId(),
    layout: '1,2,3,0', // 3 questions on one page
    currentpage: 0,
    preview: false,
    state: 'inprogress',
    timestart: now,
    timefinish: undefined, // Not finished yet
    timemodified: now,
    sumgrades: undefined, // Not graded yet
    timemodifiedoffline: undefined,
    timecheckstate: undefined,
    gradednotificationsenttime: undefined,
  };
  
  return {
    ...defaults,
    ...overrides,
  } as QuizAttempt;
}

// ============================================================================
// Specialized Attempt Factory Functions
// ============================================================================

/**
 * Creates a mock quiz attempt in "in progress" state
 * 
 * Represents an active quiz attempt that a student is currently working on.
 * The attempt has started but not yet finished or submitted.
 * 
 * @param {DeepPartial<QuizAttempt>} [overrides={}] - Partial attempt properties to override
 * @returns {QuizAttempt} Quiz attempt in "inprogress" state
 * 
 * @example
 * const activeAttempt = mockInProgressAttempt({
 *   quiz: 5,
 *   userid: 100,
 *   currentpage: 2, // Currently on page 2
 * });
 */
export function mockInProgressAttempt(overrides: DeepPartial<QuizAttempt> = {}): QuizAttempt {
  return mockQuizAttempt({
    state: 'inprogress',
    timefinish: undefined,
    sumgrades: undefined,
    ...overrides,
  });
}

/**
 * Creates a mock quiz attempt in "finished" state with a grade
 * 
 * Represents a completed quiz attempt that has been submitted and graded.
 * Includes finish timestamp and calculated grade.
 * 
 * @param {DeepPartial<QuizAttempt>} [overrides={}] - Partial attempt properties to override
 * @returns {QuizAttempt} Quiz attempt in "finished" state with grade
 * 
 * @example
 * const completedAttempt = mockFinishedAttempt({
 *   quiz: 5,
 *   userid: 100,
 *   sumgrades: 92.5,
 * });
 * 
 * // Create perfect score attempt
 * const perfectAttempt = mockFinishedAttempt({
 *   sumgrades: 100,
 * });
 */
export function mockFinishedAttempt(overrides: DeepPartial<QuizAttempt> = {}): QuizAttempt {
  const now = generateTimestamp();
  const oneHourAgo = generateTimestamp(-1/24); // 1 hour ago
  
  return mockQuizAttempt({
    state: 'finished',
    timestart: oneHourAgo,
    timefinish: now,
    timemodified: now,
    sumgrades: 85.0, // Default passing grade
    ...overrides,
  });
}

/**
 * Creates a mock quiz attempt in "overdue" state
 * 
 * Represents a quiz attempt that has exceeded the time limit but hasn't been
 * auto-submitted yet (depending on overduehandling setting).
 * 
 * @param {DeepPartial<QuizAttempt>} [overrides={}] - Partial attempt properties to override
 * @returns {QuizAttempt} Quiz attempt in "overdue" state
 * 
 * @example
 * const overdueAttempt = mockOverdueAttempt({
 *   quiz: 5,
 *   userid: 100,
 * });
 */
export function mockOverdueAttempt(overrides: DeepPartial<QuizAttempt> = {}): QuizAttempt {
  const twoHoursAgo = generateTimestamp(-2/24); // 2 hours ago
  
  return mockQuizAttempt({
    state: 'overdue',
    timestart: twoHoursAgo,
    timefinish: undefined,
    sumgrades: undefined,
    ...overrides,
  });
}

// ============================================================================
// Array Factory Functions
// ============================================================================

/**
 * Creates an array of mock Quiz entities
 * 
 * Useful for testing list views, pagination, and bulk operations.
 * Each quiz has a unique ID and optionally belongs to the same course.
 * 
 * @param {number} [count=5] - Number of quizzes to generate
 * @param {CourseId} [courseid] - Optional course ID for all quizzes
 * @param {DeepPartial<Quiz>} [baseOverrides={}] - Base properties to apply to all quizzes
 * @returns {Quiz[]} Array of quiz entities
 * 
 * @example
 * // Create 10 quizzes with default settings
 * const quizzes = mockQuizArray(10);
 * 
 * // Create 5 quizzes for specific course
 * const courseQuizzes = mockQuizArray(5, 42);
 * 
 * // Create quizzes with custom base settings
 * const timedQuizzes = mockQuizArray(3, undefined, {
 *   timelimit: 1800, // 30 minutes
 *   attempts: 1,
 * });
 */
export function mockQuizArray(
  count: number = 5,
  courseid?: CourseId,
  baseOverrides: DeepPartial<Quiz> = {}
): Quiz[] {
  const quizzes: Quiz[] = [];
  
  for (let i = 0; i < count; i++) {
    const quiz = mockQuiz({
      ...baseOverrides,
      id: i + 1, // Sequential IDs starting from 1
      name: `Quiz ${i + 1}`,
      ...(courseid !== undefined && { course: courseid }),
    });
    quizzes.push(quiz);
  }
  
  return quizzes;
}

/**
 * Creates an array of mock QuizAttempt entities for a specific quiz
 * 
 * Useful for testing attempt history, grading views, and student progress tracking.
 * Each attempt has a sequential attempt number and unique ID.
 * 
 * @param {number} [count=3] - Number of attempts to generate
 * @param {QuizId} [quizid=1] - Quiz ID for all attempts
 * @param {UserId} [userid=2] - User ID for all attempts
 * @param {DeepPartial<QuizAttempt>} [baseOverrides={}] - Base properties for all attempts
 * @returns {QuizAttempt[]} Array of quiz attempt entities
 * 
 * @example
 * // Create 3 attempts for quiz 5 by user 100
 * const attempts = mockAttemptArray(3, 5, 100);
 * 
 * // Create finished attempts with grades
 * const gradedAttempts = mockAttemptArray(3, 5, 100, {
 *   state: 'finished',
 *   timefinish: generateTimestamp(),
 * });
 * 
 * // Create attempts with varying states
 * const mixedAttempts = [
 *   mockFinishedAttempt({ quiz: 5, userid: 100, attempt: 1, sumgrades: 70 }),
 *   mockFinishedAttempt({ quiz: 5, userid: 100, attempt: 2, sumgrades: 85 }),
 *   mockInProgressAttempt({ quiz: 5, userid: 100, attempt: 3 }),
 * ];
 */
export function mockAttemptArray(
  count: number = 3,
  quizid: QuizId = 1,
  userid: UserId = 2,
  baseOverrides: DeepPartial<QuizAttempt> = {}
): QuizAttempt[] {
  const attempts: QuizAttempt[] = [];
  
  for (let i = 0; i < count; i++) {
    const attempt = mockQuizAttempt({
      ...baseOverrides,
      id: i + 1, // Sequential IDs starting from 1
      quiz: quizid,
      userid,
      attempt: i + 1, // Sequential attempt numbers
      uniqueid: generateUniqueId(),
    });
    attempts.push(attempt);
  }
  
  return attempts;
}
