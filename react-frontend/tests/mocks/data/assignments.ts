/**
 * Mock Assignment Data Generators
 * 
 * Factory functions for creating realistic Moodle assignment and submission entities
 * for testing. Provides mockAssignment(), mockAssignmentSubmission(), and related
 * helper functions with sensible defaults and support for partial overrides.
 * 
 * All generated mock data matches the Assignment and Submission interface
 * structures and includes realistic timestamps, submission settings, grade configurations,
 * and status values based on actual Moodle assignment data patterns.
 * 
 * @module tests/mocks/data/assignments
 * @see react-frontend/src/features/activities/assignments/types/assignment.types.ts - Assignment type definitions
 * @see public/mod/assign/lib.php - Moodle assignment module functions
 * @see public/mod/assign/locallib.php - Assignment local library reference
 */

import type { 
  Assignment, 
  Submission as AssignmentSubmission 
} from '@/features/activities/assignments/types/assignment.types';
import type {
  Id,
  Timestamp,
} from '@/types/common';

/** Type alias for Assignment ID */
type AssignmentId = number;

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Deep partial type for allowing nested partial overrides
 * Enables customization of any nested property in Assignment or AssignmentSubmission
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
 * Assignment ID counter for generating unique sequential IDs
 */
let assignmentIdCounter = 1;

/**
 * Submission ID counter for generating unique sequential IDs
 */
let submissionIdCounter = 1;

/**
 * Generates a unique sequential assignment ID
 * 
 * @returns {AssignmentId} Unique assignment identifier
 * 
 * @example
 * const id1 = generateAssignmentId(); // 1
 * const id2 = generateAssignmentId(); // 2
 */
export function generateAssignmentId(): AssignmentId {
  return assignmentIdCounter++;
}

/**
 * Generates a submission ID
 * 
 * @returns {Id} Unique submission identifier
 */
function generateSubmissionId(): Id {
  return submissionIdCounter++;
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
export function generateTimestamp(daysFromNow: number = 0): Timestamp {
  const now = Math.floor(Date.now() / 1000);
  const dayInSeconds = 86400; // 24 * 60 * 60
  return now + (daysFromNow * dayInSeconds);
}

/**
 * Returns a random submission status from valid Moodle values
 * 
 * @returns {'draft' | 'submitted' | 'reopened'} Random submission status
 * 
 * @example
 * const status = getRandomStatus(); // 'draft', 'submitted', or 'reopened'
 */
export function getRandomStatus(): 'draft' | 'submitted' | 'reopened' {
  const statuses: Array<'draft' | 'submitted' | 'reopened'> = ['draft', 'submitted', 'reopened'];
  const index = Math.floor(Math.random() * statuses.length);
  return statuses[index]!;
}

// ============================================================================
// Assignment Factory
// ============================================================================

/**
 * Creates a mock Assignment entity with realistic default values
 * 
 * Default values mirror typical Moodle assignment configuration:
 * - Due date 7 days from now
 * - Cut-off date 14 days from now (1 week grace period)
 * - Submissions allowed from current time
 * - 100 point maximum grade
 * - Draft submissions enabled
 * - Notifications enabled for graders
 * - Completion on submission
 * - Individual assignments (not team-based)
 * - Unlimited attempts
 * - No marking workflow or blind marking
 * 
 * @param {DeepPartial<Assignment>} overrides - Partial assignment properties to override defaults
 * @returns {Assignment} Complete assignment entity with all required fields
 * 
 * @example
 * ```typescript
 * // Create assignment with defaults
 * const assignment = mockAssignment();
 * 
 * // Create assignment with custom name and due date
 * const customAssignment = mockAssignment({
 *   name: 'Essay on Climate Change',
 *   duedate: generateTimestamp(14), // Due in 2 weeks
 *   grade: 50, // 50 point assignment
 * });
 * 
 * // Create team-based assignment
 * const teamAssignment = mockAssignment({
 *   teamsubmission: true,
 *   requireallteammemberssubmit: true,
 * });
 * ```
 */
export function mockAssignment(overrides: DeepPartial<Assignment> = {}): Assignment {
  const currentTimestamp = generateTimestamp();
  const sevenDaysFromNow = generateTimestamp(7);
  const fourteenDaysFromNow = generateTimestamp(14);
  const twentyOneDaysFromNow = generateTimestamp(21);

  const defaults: Assignment = {
    // Core identification
    id: overrides.id ?? generateAssignmentId(),
    cmid: overrides.cmid ?? (overrides.id ?? generateAssignmentId()) + 1000, // Course module ID
    course: 1,
    name: 'Test Assignment',
    
    // Description fields (optional)
    intro: 'This is a test assignment for unit testing',
    introformat: 1, // HTML format
    
    // Display settings
    alwaysshowdescription: 1, // Always show (using number for Moodle compatibility)
    
    // Submission settings
    nosubmissions: 0, // Submissions are allowed
    submissiondrafts: 1, // Draft mode enabled
    sendnotifications: 1, // Notify graders
    sendlatenotifications: 0, // Don't notify for late submissions
    sendstudentnotifications: 1, // Send student notifications when grading
    
    // Date fields
    duedate: sevenDaysFromNow,
    allowsubmissionsfromdate: currentTimestamp,
    cutoffdate: fourteenDaysFromNow,
    gradingduedate: twentyOneDaysFromNow,
    
    // Grade settings
    grade: 100, // Maximum points
    gradepenalty: 0, // No late penalty
    timemodified: currentTimestamp,
    
    // Submission statement
    requiresubmissionstatement: 0, // Not required
    
    // Completion settings
    completionsubmit: 1, // Complete on submission
    
    // Team submission settings
    teamsubmission: 0, // Individual submissions
    requireallteammemberssubmit: 0, // N/A for individual
    teamsubmissiongroupingid: 0, // No grouping
    
    // Anonymity settings
    blindmarking: 0, // Disabled
    hidegrader: 0, // Show grader identity
    revealidentities: 0, // Not revealed (N/A when blind marking disabled)
    
    // Attempt settings
    attemptreopenmethod: 'none',
    maxattempts: -1, // Unlimited attempts
    
    // Marking workflow settings
    markingworkflow: 0, // Disabled
    markingallocation: 0, // Disabled
    markinganonymous: 0, // Disabled
  };

  return {
    ...defaults,
    ...overrides,
  } as Assignment;
}

// ============================================================================
// Assignment Submission Factory
// ============================================================================

/**
 * Creates a mock AssignmentSubmission entity with realistic default values
 * 
 * Default values represent a typical student submission:
 * - Status: 'submitted' (completed submission)
 * - Created and modified at current time
 * - Attempt number 1
 * - Latest submission flag set to true
 * - No group ID (individual submission)
 * - User ID defaults to 2 (typical student ID)
 * 
 * @param {DeepPartial<AssignmentSubmission>} overrides - Partial submission properties to override defaults
 * @returns {AssignmentSubmission} Complete submission entity with all required fields
 * 
 * @example
 * ```typescript
 * // Create basic submission
 * const submission = mockAssignmentSubmission();
 * 
 * // Create draft submission for specific user
 * const draftSubmission = mockAssignmentSubmission({
 *   userid: 5,
 *   status: 'draft',
 * });
 * 
 * // Create graded submission
 * const gradedSubmission = mockAssignmentSubmission({
 *   status: 'submitted',
 *   grade: 85,
 *   grader: 3,
 *   gradingstatus: 'graded',
 * });
 * 
 * // Create team submission
 * const teamSubmission = mockAssignmentSubmission({
 *   groupid: 10,
 *   userid: 5,
 * });
 * ```
 */
export function mockAssignmentSubmission(
  overrides: DeepPartial<AssignmentSubmission> = {}
): AssignmentSubmission {
  const currentTimestamp = generateTimestamp();

  const defaults: AssignmentSubmission = {
    id: overrides.id ?? generateSubmissionId(),
    assignment: 1,
    userid: 2,
    timecreated: currentTimestamp,
    timemodified: currentTimestamp,
    status: 'submitted',
    groupid: 0, // 0 for individual submissions
    attemptnumber: 1,
    latest: 1, // 1 = this is the latest attempt
  };

  return {
    ...defaults,
    ...overrides,
  } as AssignmentSubmission;
}

// ============================================================================
// Specialized Submission Factories
// ============================================================================

/**
 * Creates a mock draft submission (not yet submitted)
 * 
 * Convenience function that creates a submission with 'draft' status.
 * Useful for testing workflows where students are still working on submissions.
 * 
 * @param {DeepPartial<AssignmentSubmission>} overrides - Additional submission properties
 * @returns {AssignmentSubmission} Draft submission entity
 * 
 * @example
 * ```typescript
 * const draft = mockDraftSubmission({
 *   userid: 5,
 *   assignment: 3,
 * });
 * console.log(draft.status); // 'draft'
 * ```
 */
export function mockDraftSubmission(
  overrides: DeepPartial<AssignmentSubmission> = {}
): AssignmentSubmission {
  return mockAssignmentSubmission({
    status: 'draft',
    ...overrides,
  });
}

/**
 * Creates a mock submitted submission (completed)
 * 
 * Convenience function that creates a submission with 'submitted' status.
 * Useful for testing grading workflows and submission viewing.
 * 
 * @param {DeepPartial<AssignmentSubmission>} overrides - Additional submission properties
 * @returns {AssignmentSubmission} Submitted submission entity
 * 
 * @example
 * ```typescript
 * const submitted = mockSubmittedSubmission({
 *   userid: 5,
 *   assignment: 3,
 *   timecreated: generateTimestamp(-2), // Submitted 2 days ago
 * });
 * console.log(submitted.status); // 'submitted'
 * ```
 */
export function mockSubmittedSubmission(
  overrides: DeepPartial<AssignmentSubmission> = {}
): AssignmentSubmission {
  return mockAssignmentSubmission({
    status: 'submitted',
    ...overrides,
  });
}

// ============================================================================
// Array Generators
// ============================================================================

/**
 * Creates an array of mock Assignment entities
 * 
 * Generates multiple assignments with sequential IDs and optionally unique names.
 * All assignments belong to the same course unless overridden individually.
 * 
 * @param {number} count - Number of assignments to generate
 * @param {CourseId} courseid - Course ID for all assignments
 * @param {DeepPartial<Assignment>} baseOverrides - Base overrides applied to all assignments
 * @returns {Assignment[]} Array of assignment entities
 * 
 * @example
 * ```typescript
 * // Create 5 assignments for course 1
 * const assignments = mockAssignmentArray(5, 1);
 * 
 * // Create 3 assignments with custom grade
 * const assignments = mockAssignmentArray(3, 2, {
 *   grade: 50,
 *   teamsubmission: true,
 * });
 * 
 * // Each assignment has unique ID and name:
 * // assignments[0].id === 1, name === 'Test Assignment 1'
 * // assignments[1].id === 2, name === 'Test Assignment 2'
 * // ...
 * ```
 */
export function mockAssignmentArray(
  count: number,
  courseid: number = 1,
  baseOverrides: DeepPartial<Assignment> = {}
): Assignment[] {
  const assignments: Assignment[] = [];

  for (let i = 0; i < count; i++) {
    const assignment = mockAssignment({
      id: generateAssignmentId(),
      course: courseid,
      name: `Test Assignment ${i + 1}`,
      ...baseOverrides,
    });
    assignments.push(assignment);
  }

  return assignments;
}

/**
 * Creates an array of mock AssignmentSubmission entities for a specific assignment
 * 
 * Generates multiple submissions with sequential IDs and user IDs.
 * All submissions belong to the same assignment.
 * 
 * @param {AssignmentId} assignmentid - Assignment ID for all submissions
 * @param {number} count - Number of submissions to generate
 * @param {DeepPartial<AssignmentSubmission>} baseOverrides - Base overrides applied to all submissions
 * @returns {AssignmentSubmission[]} Array of submission entities
 * 
 * @example
 * ```typescript
 * // Create 10 submissions for assignment 1
 * const submissions = mockSubmissionArray(1, 10);
 * 
 * // Create 5 draft submissions
 * const drafts = mockSubmissionArray(2, 5, {
 *   status: 'draft',
 * });
 * 
 * // Create 3 graded submissions
 * const graded = mockSubmissionArray(3, 3, {
 *   status: 'submitted',
 *   grade: 85,
 *   gradingstatus: 'graded',
 * });
 * 
 * // Each submission has unique ID and user ID:
 * // submissions[0].id === 1, userid === 2
 * // submissions[1].id === 2, userid === 3
 * // ...
 * ```
 */
export function mockSubmissionArray(
  assignmentid: AssignmentId,
  count: number,
  baseOverrides: DeepPartial<AssignmentSubmission> = {}
): AssignmentSubmission[] {
  const submissions: AssignmentSubmission[] = [];

  for (let i = 0; i < count; i++) {
    const submission = mockAssignmentSubmission({
      id: generateSubmissionId(),
      assignment: assignmentid,
      userid: 2 + i, // Start from user ID 2 (ID 1 is typically admin)
      ...baseOverrides,
    });
    submissions.push(submission);
  }

  return submissions;
}

// ============================================================================
// Advanced Scenarios
// ============================================================================

/**
 * Creates a complete assignment with associated submissions for testing
 * 
 * Convenience function that generates an assignment and multiple submissions
 * for realistic test scenarios.
 * 
 * @param {number} submissionCount - Number of submissions to generate
 * @param {DeepPartial<Assignment>} assignmentOverrides - Assignment overrides
 * @param {DeepPartial<AssignmentSubmission>} submissionOverrides - Submission overrides
 * @returns {{ assignment: Assignment; submissions: AssignmentSubmission[] }}
 * 
 * @example
 * ```typescript
 * // Create assignment with 5 submissions
 * const { assignment, submissions } = mockAssignmentWithSubmissions(5);
 * 
 * // Create overdue assignment with late submissions
 * const scenario = mockAssignmentWithSubmissions(3, {
 *   duedate: generateTimestamp(-7), // Due 7 days ago
 * }, {
 *   timemodified: generateTimestamp(-2), // Submitted 2 days ago (5 days late)
 * });
 * ```
 */
export function mockAssignmentWithSubmissions(
  submissionCount: number = 5,
  assignmentOverrides: DeepPartial<Assignment> = {},
  submissionOverrides: DeepPartial<AssignmentSubmission> = {}
): { assignment: Assignment; submissions: AssignmentSubmission[] } {
  const assignment = mockAssignment(assignmentOverrides);
  const submissions = mockSubmissionArray(
    assignment.id,
    submissionCount,
    submissionOverrides
  );

  return { assignment, submissions };
}

/**
 * Creates a grading scenario with ungraded, graded, and draft submissions
 * 
 * Generates a realistic mix of submission statuses for testing grading workflows.
 * 
 * @param {AssignmentId} assignmentid - Assignment ID
 * @returns {AssignmentSubmission[]} Mixed array of submissions with various statuses
 * 
 * @example
 * ```typescript
 * const submissions = mockGradingScenario(1);
 * // Returns array with mix of:
 * // - 2 submitted, ungraded submissions
 * // - 2 submitted, graded submissions
 * // - 1 draft submission
 * ```
 */
export function mockGradingScenario(assignmentid: AssignmentId): AssignmentSubmission[] {
  return [
    // Ungraded submitted submissions
    mockSubmittedSubmission({
      id: generateSubmissionId(),
      assignment: assignmentid,
      userid: 2,
      gradingstatus: 'notgraded',
    }),
    mockSubmittedSubmission({
      id: generateSubmissionId(),
      assignment: assignmentid,
      userid: 3,
      gradingstatus: 'notgraded',
    }),
    // Graded submissions
    mockSubmittedSubmission({
      id: generateSubmissionId(),
      assignment: assignmentid,
      userid: 4,
      grade: 85,
      gradingstatus: 'graded',
    }),
    mockSubmittedSubmission({
      id: generateSubmissionId(),
      assignment: assignmentid,
      userid: 5,
      grade: 92,
      gradingstatus: 'graded',
    }),
    // Draft submission (not yet submitted)
    mockDraftSubmission({
      id: generateSubmissionId(),
      assignment: assignmentid,
      userid: 6,
    }),
  ];
}

/**
 * Creates a mock assignment that is past due
 * 
 * @param overrides - Optional properties to override defaults
 * @returns Assignment with due date in the past
 * 
 * @example
 * ```typescript
 * const overdueAssignment = mockOverdueAssignment({ name: 'Late Assignment' });
 * ```
 */
export function mockOverdueAssignment(
  overrides: DeepPartial<Assignment> = {}
): Assignment {
  const threeDaysAgo = generateTimestamp(-3);
  return mockAssignment({
    duedate: threeDaysAgo,
    cutoffdate: generateTimestamp(-1),
    ...overrides,
  });
}

/**
 * Creates a mock assignment with a future due date
 * 
 * @param overrides - Optional properties to override defaults
 * @returns Assignment with due date in the future
 * 
 * @example
 * ```typescript
 * const upcomingAssignment = mockUpcomingAssignment({ duedate: generateTimestamp(10) });
 * ```
 */
export function mockUpcomingAssignment(
  overrides: DeepPartial<Assignment> = {}
): Assignment {
  return mockAssignment({
    duedate: generateTimestamp(7),
    cutoffdate: generateTimestamp(14),
    allowsubmissionsfromdate: generateTimestamp(1), // 1 day in future - submission period hasn't started yet
    ...overrides,
  });
}

/**
 * Creates a mock assignment configured for team submissions
 * 
 * @param overrides - Optional properties to override defaults
 * @returns Assignment with team submission enabled
 * 
 * @example
 * ```typescript
 * const teamAssignment = mockTeamAssignment({ requireallteammemberssubmit: true });
 * ```
 */
export function mockTeamAssignment(
  overrides: DeepPartial<Assignment> = {}
): Assignment {
  return mockAssignment({
    teamsubmission: 1,
    requireallteammemberssubmit: 0,
    ...overrides,
  });
}

/**
 * Creates a mock submission that has been graded
 * 
 * @param overrides - Optional properties to override defaults
 * @returns AssignmentSubmission with graded status
 * 
 * @example
 * ```typescript
 * const gradedSubmission = mockGradedSubmission({ grade: 85 });
 * ```
 */
export function mockGradedSubmission(
  overrides: DeepPartial<AssignmentSubmission> = {}
): AssignmentSubmission {
  return mockAssignmentSubmission({
    status: 'submitted',
    grade: 85,
    gradingstatus: 'graded',
    ...overrides,
  });
}

/**
 * Creates a mock submission that was submitted after the due date
 * 
 * @param overrides - Optional properties to override defaults
 * @returns AssignmentSubmission with late submission timestamp
 * 
 * @example
 * ```typescript
 * const lateSubmission = mockLateSubmission({ assignmentid: 5 });
 * ```
 */
export function mockLateSubmission(
  overrides: DeepPartial<AssignmentSubmission> = {}
): AssignmentSubmission {
  const assignment = mockOverdueAssignment();
  return mockAssignmentSubmission({
    assignment: assignment.id,
    timemodified: generateTimestamp(1),
    status: 'submitted',
    ...overrides,
  });
}

/**
 * Resets all ID counters to initial values
 * 
 * Useful for ensuring consistent IDs across test suites or resetting
 * state between tests.
 * 
 * @example
 * ```typescript
 * beforeEach(() => {
 *   resetCounters();
 * });
 * ```
 */
export function resetCounters(): void {
  assignmentIdCounter = 1;
  submissionIdCounter = 1;
}
