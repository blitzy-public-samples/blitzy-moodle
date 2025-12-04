/**
 * Comprehensive TypeScript type definitions for workshop activity module
 *
 * This file contains all type definitions for Moodle's workshop activity, which implements
 * a multi-phase peer review workflow system. The workshop progresses through distinct phases:
 * setup, submission, assessment, evaluation, and closed.
 *
 * Based on Moodle's workshop module structure from:
 * - public/mod/workshop/lib.php
 * - public/mod/workshop/locallib.php
 * - public/mod/workshop/db/install.xml
 */

/**
 * Workshop lifecycle phases
 * These numeric values match Moodle's workshop phase constants
 */
export enum WorkshopPhase {
  SETUP = 10, // Initial configuration phase
  SUBMISSION = 20, // Students submit their work
  ASSESSMENT = 30, // Peer review phase
  EVALUATION = 40, // Grade calculation and aggregation
  CLOSED = 50, // Workshop completed
}

/**
 * Example submission modes
 * Determines when students must assess example submissions
 */
export enum ExamplesMode {
  VOLUNTARY = 0, // Optional examples
  BEFORE_SUBMISSION = 1, // Required before submission
  BEFORE_ASSESSMENT = 2, // Required before assessment
}

/**
 * Grading strategy types
 * Defines how assessments are structured and graded
 */
export type GradingStrategy =
  | 'accumulative' // Weighted sum of criteria
  | 'rubric' // Rubric-based assessment
  | 'comments' // Comments only, no grades
  | 'numerrors'; // Number of errors counting

/**
 * Allocation method types
 * Determines how peer reviewers are assigned to submissions
 */
export type AllocationMethod =
  | 'manual' // Teacher assigns reviewers
  | 'random' // Random allocation
  | 'scheduled'; // Scheduled automatic allocation

/**
 * Evaluation method types
 * Determines how final grades are calculated from multiple assessments
 * Common method: 'best' (best assessment used)
 * Supports other evaluation methods as string values
 */
export type EvaluationMethod = string;

/**
 * Main workshop configuration interface
 * Represents a workshop activity instance with all its settings
 */
export interface Workshop {
  id: number;
  courseId: number;
  name: string;
  intro: string;
  introFormat: number;
  instructAuthors: string;
  instructAuthorsFormat: number;
  instructReviewers: string;
  instructReviewersFormat: number;
  phase: WorkshopPhase;
  strategy: GradingStrategy;
  evaluation: string;
  grade: number;
  gradingGrade: number;
  gradeDecimals: number;
  submissionStart: number | null;
  submissionEnd: number | null;
  assessmentStart: number | null;
  assessmentEnd: number | null;
  /** Whether to automatically switch to assessment phase when submission deadline passes */
  phaseSwitchAssessment: boolean;
  useExamples: boolean;
  examplesMode: ExamplesMode;
  usePeerAssessment: boolean;
  useSelfAssessment: boolean;
  lateSubmissions: boolean;
  maxBytes: number;
  nAttachments: number;
  submissionFileTypes: string | null;
  overallFeedbackMode: number;
  overallFeedbackFiles: number;
  overallFeedbackFileTypes: string | null;
  conclusion: string;
  conclusionFormat: number;
  timeCreated: number;
  timeModified: number;
}

/**
 * Student submission interface
 * Represents a student's work submitted to the workshop
 */
export interface WorkshopSubmission {
  id: number;
  workshopId: number;
  example: boolean;
  authorId: number;
  authorFirstName?: string;
  authorLastName?: string;
  authorEmail?: string;
  authorPicture?: number;
  title: string;
  content: string;
  contentFormat: number;
  contentTrust: boolean;
  attachment: number;
  grade: number | null;
  gradingGrade: number | null;
  gradeOver: number | null;
  gradingGradeOver: number | null;
  feedbackAuthor: string | null;
  feedbackAuthorFormat: number;
  timeCreated: number;
  timeModified: number;
  published: boolean;
  late: boolean;
  url?: string;
}

/**
 * Peer assessment interface
 * Represents one reviewer's assessment of a submission
 */
export interface WorkshopAssessment {
  id: number;
  submissionId: number;
  reviewerId: number;
  reviewerFirstName?: string;
  reviewerLastName?: string;
  weight: number;
  grade: number | null;
  gradingGrade: number | null;
  gradingGradeOver: number | null;
  feedbackAuthor: string | null;
  feedbackAuthorFormat: number;
  feedbackAuthorAttachment: number;
  feedbackReviewer: string | null;
  feedbackReviewerFormat: number;
  timeCreated: number;
  timeModified: number;
  url?: string;
}

/**
 * Assessment dimension interface
 * Represents one criterion in a grading rubric or accumulative strategy
 */
export interface AssessmentDimension {
  id: number;
  workshopId: number;
  sort: number;
  description: string;
  descriptionFormat: number;
  grade: number;
  weight: number;
  strategy: GradingStrategy;
}

/**
 * Grade for a specific dimension
 * Represents the score awarded for one criterion
 */
export interface DimensionGrade {
  dimensionId: number;
  grade: number | null;
  peerComment: string | null;
  peerCommentFormat: number;
}

/**
 * Individual task in a workshop phase
 * Represents one action item for a user
 */
export interface WorkshopUserPlanTask {
  key: string;
  title: string;
  link?: string;
  completed: boolean | 'info';
  details?: string;
}

/**
 * Phase in user's workshop plan
 * Represents one phase with its tasks
 */
export interface WorkshopUserPlanPhase {
  phase: WorkshopPhase;
  title: string;
  tasks: WorkshopUserPlanTask[];
  active: boolean;
}

/**
 * Complete user plan for a workshop
 * Shows all phases and tasks relevant to a specific user
 */
export interface WorkshopUserPlan {
  userId: number;
  workshopId: number;
  phases: WorkshopUserPlanPhase[];
  examples?: WorkshopSubmission[];
}

/**
 * Result of a peer review allocation operation
 * Indicates success and number of allocations created
 */
export interface AllocationResult {
  success: boolean;
  allocated: number;
  message?: string;
}

/**
 * Form data for submitting an assessment
 * Contains dimension grades and overall feedback
 */
export interface WorkshopAssessmentFormData {
  assessmentId?: number;
  dimensionGrades: DimensionGrade[];
  feedbackAuthor?: string;
  feedbackAuthorFormat?: number;
}
