/**
 * E2E Test Fixtures - Assignment Data
 * 
 * Provides predefined assignment objects with different submission types, grading settings,
 * and sample submissions for testing assignment workflows including submission, grading,
 * and late submissions.
 * 
 * @module tests/e2e/fixtures/assignments
 */

import { testCourse1 } from './courses';
import { testTeacher } from './users';
import { samplePDFFile } from './files';

/**
 * Submission status constants matching Moodle assignment submission statuses
 */
export const SUBMISSION_STATUS = {
  /** New/not submitted - initial state */
  NEW: 'new',
  /** Draft - work in progress, not submitted */
  DRAFT: 'draft',
  /** Submitted - finalized submission */
  SUBMITTED: 'submitted',
  /** Reopened - submission was graded but reopened for resubmission */
  REOPENED: 'reopened',
} as const;

/**
 * Submission type constants matching Moodle assignment submission plugins
 */
export const SUBMISSION_TYPES = {
  /** File upload submission type */
  FILE: 'file',
  /** Online text (HTML editor) submission type */
  ONLINETEXT: 'onlinetext',
  /** Comments-only submission type */
  COMMENTS: 'comments',
} as const;

/**
 * Assignment interface matching Moodle assignment API structure
 * Represents a complete assignment object as returned by /api/v1/assignments/{id}
 */
export interface Assignment {
  /** Unique assignment identifier */
  id: number;
  /** Course ID this assignment belongs to */
  courseid: number;
  /** Assignment name/title */
  name: string;
  /** Assignment description/instructions (HTML) */
  intro: string;
  /** Due date (Unix timestamp in seconds) */
  duedate: number;
  /** Cut-off date - no submissions accepted after this (Unix timestamp) */
  cutoffdate?: number;
  /** Date from which submissions are allowed (Unix timestamp) */
  allowsubmissionsfromdate?: number;
  /** Whether students can save drafts before submitting */
  submissiondrafts?: boolean;
  /** Whether students must accept submission statement */
  requiresubmissionstatement?: boolean;
  /** Array of enabled submission types (file, onlinetext, comments) */
  submissiontypes: string[];
  /** Maximum number of files allowed for file submissions */
  maxfiles?: number;
  /** Maximum file size in bytes for file submissions */
  maxbytes?: number;
  /** Maximum grade for this assignment */
  grade: number;
  /** Unix timestamp of last modification */
  timemodified: number;
  /** Whether this is a team/group submission */
  teamsubmission?: boolean;
  /** Whether all team members must submit */
  requireallteammemberssubmit?: boolean;
}

/**
 * Assignment submission interface matching Moodle submission structure
 * Represents a student's submission for an assignment
 */
export interface AssignmentSubmission {
  /** Unique submission identifier */
  id: number;
  /** Assignment ID this submission belongs to */
  assignmentid: number;
  /** User ID of the student who submitted */
  userid: number;
  /** Unix timestamp when submission was created */
  timecreated: number;
  /** Unix timestamp when submission was last modified */
  timemodified: number;
  /** Submission status (new, draft, submitted, reopened) */
  status: string;
  /** Attempt number (for assignments allowing multiple attempts) */
  attemptnumber: number;
  /** Array of uploaded files (for file submission type) */
  files?: Array<{
    /** File ID from Moodle file storage */
    id: number;
    /** Original filename */
    filename: string;
    /** File size in bytes */
    filesize: number;
  }>;
  /** Online text content (HTML, for onlinetext submission type) */
  onlinetext?: string;
  /** Grade assigned to this submission (0-100 or assignment max) */
  grade?: number;
  /** Feedback text from grader (HTML) */
  feedback?: string;
  /** User ID of the grader */
  grader?: number;
  /** Whether this submission was submitted after the due date */
  late?: boolean;
}

/**
 * Test assignment 1: File submission assignment
 * Standard assignment with file upload enabled, multiple files allowed
 */
export const testAssignment1: Assignment = {
  id: 1001,
  courseid: testCourse1.id,
  name: 'Programming Assignment 1',
  intro: '<p>Submit your completed code files for the first programming assignment. Include all source code files, documentation, and a README file explaining how to run your program.</p><p><strong>Requirements:</strong></p><ul><li>All code must compile without errors</li><li>Include unit tests</li><li>Follow the coding style guide</li></ul>',
  duedate: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days from now
  cutoffdate: Math.floor(Date.now() / 1000) + (10 * 24 * 60 * 60), // 10 days from now
  allowsubmissionsfromdate: Math.floor(Date.now() / 1000) - (1 * 24 * 60 * 60), // Started 1 day ago
  submissiondrafts: true,
  submissiontypes: [SUBMISSION_TYPES.FILE],
  maxfiles: 5,
  maxbytes: 10485760, // 10 MB
  grade: 100,
  timemodified: Math.floor(Date.now() / 1000),
};

/**
 * Test assignment 2: Online text assignment
 * Essay-type assignment with online text editor, requires submission statement
 */
export const testAssignment2: Assignment = {
  id: 1002,
  courseid: testCourse1.id,
  name: 'Essay Assignment: Programming Paradigms',
  intro: '<p>Write a 500-word essay comparing object-oriented and functional programming paradigms.</p><p><strong>Topics to cover:</strong></p><ul><li>Core principles of each paradigm</li><li>Advantages and disadvantages</li><li>Real-world use cases</li><li>Your personal perspective</li></ul>',
  duedate: Math.floor(Date.now() / 1000) + (14 * 24 * 60 * 60), // 14 days from now
  requiresubmissionstatement: true,
  submissiontypes: [SUBMISSION_TYPES.ONLINETEXT],
  grade: 100,
  timemodified: Math.floor(Date.now() / 1000),
};

/**
 * Test assignment 3: Multiple submission types
 * Allows both file uploads and online text for comprehensive submissions
 */
export const testAssignment3: Assignment = {
  id: 1003,
  courseid: testCourse1.id,
  name: 'Mixed Media Project',
  intro: '<p>Submit both written analysis (online text) and supporting files (code, diagrams, etc.) for this comprehensive project.</p>',
  duedate: Math.floor(Date.now() / 1000) + (21 * 24 * 60 * 60), // 21 days from now
  submissiontypes: [SUBMISSION_TYPES.FILE, SUBMISSION_TYPES.ONLINETEXT],
  maxfiles: 3,
  grade: 100,
  timemodified: Math.floor(Date.now() / 1000),
};

/**
 * Test assignment 4: Past due date assignment
 * Assignment with due date in the past for testing late submission scenarios
 */
export const testAssignment4: Assignment = {
  id: 1004,
  courseid: testCourse1.id,
  name: 'Late Submission Test Assignment',
  intro: '<p>This assignment is past due for testing late submission workflows and penalties.</p>',
  duedate: Math.floor(Date.now() / 1000) - (2 * 24 * 60 * 60), // 2 days ago
  cutoffdate: Math.floor(Date.now() / 1000) + (5 * 24 * 60 * 60), // 5 days from now (still accepting)
  submissiontypes: [SUBMISSION_TYPES.FILE],
  grade: 100,
  timemodified: Math.floor(Date.now() / 1000),
};

/**
 * Test assignment 5: Group assignment
 * Team-based assignment where one submission represents the entire group
 */
export const testAssignment5: Assignment = {
  id: 1005,
  courseid: testCourse1.id,
  name: 'Group Project: Software Development',
  intro: '<p>Work together as a team to complete this group project. One team member should submit on behalf of the group.</p><p><strong>Deliverables:</strong></p><ul><li>Complete source code</li><li>Design documentation</li><li>User manual</li><li>Test results</li></ul>',
  duedate: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
  submissiontypes: [SUBMISSION_TYPES.FILE, SUBMISSION_TYPES.ONLINETEXT],
  teamsubmission: true,
  requireallteammemberssubmit: false,
  grade: 100,
  timemodified: Math.floor(Date.now() / 1000),
};

/**
 * Sample submission fixture (basic/new state)
 * Represents a new submission that hasn't been started yet
 */
export const sampleSubmission: AssignmentSubmission = {
  id: 2001,
  assignmentid: testAssignment1.id,
  userid: 1001, // Student user ID
  timecreated: Math.floor(Date.now() / 1000) - (1 * 60 * 60), // 1 hour ago
  timemodified: Math.floor(Date.now() / 1000) - (1 * 60 * 60),
  status: SUBMISSION_STATUS.NEW,
  attemptnumber: 0,
};

/**
 * Submitted submission fixture
 * Represents a completed and submitted assignment with file attachment
 */
export const submittedSubmission: AssignmentSubmission = {
  id: 2002,
  assignmentid: testAssignment1.id,
  userid: 1001,
  timecreated: Math.floor(Date.now() / 1000) - (2 * 60 * 60), // 2 hours ago
  timemodified: Math.floor(Date.now() / 1000) - (30 * 60), // 30 minutes ago (submission time)
  status: SUBMISSION_STATUS.SUBMITTED,
  attemptnumber: 1,
  files: [
    {
      id: samplePDFFile.id,
      filename: samplePDFFile.filename,
      filesize: samplePDFFile.filesize,
    },
  ],
};

/**
 * Draft submission fixture
 * Represents a work-in-progress submission with online text but not yet submitted
 */
export const draftSubmission: AssignmentSubmission = {
  id: 2003,
  assignmentid: testAssignment2.id,
  userid: 1001,
  timecreated: Math.floor(Date.now() / 1000) - (3 * 60 * 60), // 3 hours ago
  timemodified: Math.floor(Date.now() / 1000) - (15 * 60), // 15 minutes ago (last auto-save)
  status: SUBMISSION_STATUS.DRAFT,
  attemptnumber: 0,
  onlinetext: '<p>This is a draft of my essay comparing object-oriented and functional programming paradigms.</p><p><strong>Introduction:</strong></p><p>Programming paradigms represent fundamentally different approaches to software development. Object-oriented programming (OOP) organizes code around objects and their interactions, while functional programming (FP) treats computation as the evaluation of mathematical functions...</p><p><em>[Still working on this section...]</em></p>',
};

/**
 * Graded submission fixture
 * Represents a submitted assignment that has been graded by the teacher
 */
export const gradedSubmission: AssignmentSubmission = {
  id: 2004,
  assignmentid: testAssignment1.id,
  userid: 1002, // Different student
  timecreated: Math.floor(Date.now() / 1000) - (5 * 24 * 60 * 60), // 5 days ago (submission)
  timemodified: Math.floor(Date.now() / 1000) - (1 * 24 * 60 * 60), // 1 day ago (grading time)
  status: SUBMISSION_STATUS.SUBMITTED,
  attemptnumber: 1,
  files: [
    {
      id: samplePDFFile.id,
      filename: samplePDFFile.filename,
      filesize: samplePDFFile.filesize,
    },
  ],
  grade: 85,
  feedback: `<p>Good work overall! ${testTeacher.firstname} ${testTeacher.lastname} has reviewed your submission.</p><p><strong>Strengths:</strong></p><ul><li>Clear and well-structured code</li><li>Comprehensive documentation</li><li>Good error handling</li></ul><p><strong>Areas for improvement:</strong></p><ul><li>Consider edge cases in the input validation</li><li>Add more unit tests for boundary conditions</li><li>Could optimize the algorithm for better performance</li></ul>`,
  grader: testTeacher.id,
};

/**
 * Late submission fixture
 * Represents a submission made after the due date
 */
export const lateSubmission: AssignmentSubmission = {
  id: 2005,
  assignmentid: testAssignment4.id,
  userid: 1001,
  timecreated: Math.floor(Date.now() / 1000) - (1 * 24 * 60 * 60), // 1 day ago (after due date)
  timemodified: Math.floor(Date.now() / 1000) - (1 * 24 * 60 * 60),
  status: SUBMISSION_STATUS.SUBMITTED,
  attemptnumber: 1,
  files: [
    {
      id: samplePDFFile.id,
      filename: samplePDFFile.filename,
      filesize: samplePDFFile.filesize,
    },
  ],
  late: true,
};

/**
 * Helper function to create custom assignment fixtures
 * 
 * @param overrides - Partial assignment object to override default values
 * @returns Complete Assignment object with defaults and overrides merged
 * 
 * @example
 * const customAssignment = createAssignment({
 *   name: 'My Custom Assignment',
 *   grade: 50,
 *   duedate: Math.floor(Date.now() / 1000) + (3 * 24 * 60 * 60), // 3 days from now
 * });
 */
export function createAssignment(overrides: Partial<Assignment> = {}): Assignment {
  const defaults: Assignment = {
    id: Math.floor(Math.random() * 10000) + 10000,
    courseid: testCourse1.id,
    name: 'Test Assignment',
    intro: '<p>This is a test assignment created for E2E testing purposes.</p>',
    duedate: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days from now
    submissiontypes: [SUBMISSION_TYPES.FILE],
    grade: 100,
    timemodified: Math.floor(Date.now() / 1000),
  };

  return { ...defaults, ...overrides };
}

/**
 * Helper function to create custom submission fixtures
 * 
 * @param overrides - Partial submission object to override default values
 * @returns Complete AssignmentSubmission object with defaults and overrides merged
 * 
 * @example
 * const customSubmission = createSubmission({
 *   assignmentid: testAssignment2.id,
 *   status: SUBMISSION_STATUS.SUBMITTED,
 *   grade: 92,
 * });
 */
export function createSubmission(overrides: Partial<AssignmentSubmission> = {}): AssignmentSubmission {
  const defaults: AssignmentSubmission = {
    id: Math.floor(Math.random() * 10000) + 20000,
    assignmentid: testAssignment1.id,
    userid: 1001,
    timecreated: Math.floor(Date.now() / 1000),
    timemodified: Math.floor(Date.now() / 1000),
    status: SUBMISSION_STATUS.NEW,
    attemptnumber: 0,
  };

  return { ...defaults, ...overrides };
}
