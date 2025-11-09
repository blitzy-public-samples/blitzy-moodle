/**
 * TypeScript type definitions for H5P Activity module
 *
 * Comprehensive interfaces and enums for the H5P Activity feature,
 * corresponding to the Moodle mod_h5pactivity module structure.
 * Based on h5pactivity database schema and PHP class structures.
 *
 * @module features/activities/h5pactivity/types/h5p.types
 * @see public/mod/h5pactivity/db/install.xml - Database schema
 * @see public/mod/h5pactivity/classes/local/manager.php - Manager constants
 * @see public/mod/h5pactivity/classes/local/attempt.php - Attempt structure
 */

import type { UserId } from '@/types/common';

// ============================================================================
// Enums - Grade Methods and Review Modes
// ============================================================================

/**
 * Grade method options for H5P activities
 * Determines which attempt score is used for final grading
 * 
 * @see mod_h5pactivity\local\manager - PHP constants
 */
export enum H5PGradeMethod {
  /** No automatic grading using attempt results (GRADEMANUAL) */
  MANUAL = 0,
  /** Use highest attempt results for grading (GRADEHIGHESTATTEMPT) */
  HIGHEST_ATTEMPT = 1,
  /** Use average attempt results for grading (GRADEAVERAGEATTEMPT) */
  AVERAGE_ATTEMPT = 2,
  /** Use last attempt results for grading (GRADELASTATTEMPT) */
  LAST_ATTEMPT = 3,
  /** Use first attempt results for grading (GRADEFIRSTATTEMPT) */
  FIRST_ATTEMPT = 4,
}

/**
 * Review mode options for H5P activities
 * Controls when students can review their attempts
 * 
 * @see mod_h5pactivity\local\manager - PHP constants
 */
export enum H5PReviewMode {
  /** Participants cannot review their own attempts (REVIEWNONE) */
  NONE = 0,
  /** Participants can review when they have one attempt completed (REVIEWCOMPLETION) */
  COMPLETION = 1,
}

// ============================================================================
// xAPI Interaction Types
// ============================================================================

/**
 * xAPI interaction types supported by H5P content
 * These represent different types of learner interactions tracked by xAPI
 * 
 * @see https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#interaction-types
 */
export type H5PInteractionType =
  | 'true-false'
  | 'choice'
  | 'fill-in'
  | 'long-fill-in'
  | 'matching'
  | 'performance'
  | 'sequencing'
  | 'likert'
  | 'numeric'
  | 'other';

// ============================================================================
// Display Options
// ============================================================================

/**
 * Parsed display options for H5P player
 * Boolean flags indicating which player features are enabled
 * Decoded from the displayoptions bitmask integer stored in the database
 */
export interface H5PDisplayOptions {
  /** Whether to show frame around H5P content */
  frame: boolean;
  /** Whether to allow downloading content */
  download: boolean;
  /** Whether to allow embedding content */
  embed: boolean;
  /** Whether to show copyright information */
  copyright: boolean;
  /** Whether to show about H5P information */
  about: boolean;
}

// ============================================================================
// Main Activity Interface
// ============================================================================

/**
 * Main H5P Activity interface
 * Represents a single H5P activity instance in a course
 *
 * @see h5pactivity database table (install.xml)
 */
export interface H5PActivity {
  /** Unique identifier for the activity */
  id: number;
  /** Course ID this activity belongs to */
  course: number;
  /** Display name of the activity (max length: 1333) */
  name: string;
  /** Activity description/introduction text */
  intro: string;
  /** Format of the intro field (0=Moodle, 1=HTML, 2=Plain, 4=Markdown) */
  introformat: number;
  /** Unix timestamp when activity was created */
  timecreated: number;
  /** Unix timestamp when activity was last modified */
  timemodified: number;
  /** Maximum grade for this activity (0 = no grade, or positive integer) */
  grade: number;
  /** Bit flags for H5P button display options (frame, download, embed, copyright, about) */
  displayoptions: number;
  /** Whether xAPI tracking is enabled (1 = enabled, 0 = disabled) */
  enabletracking: number;
  /** Method used to calculate final grade from multiple attempts */
  grademethod: number;
  /** When students can review their attempts (null or 0=none, 1=after completion) */
  reviewmode: number;
}

/**
 * Payload for updating H5P Activity settings
 * Partial interface allowing selective field updates
 * 
 * Only provided fields will be updated, others remain unchanged
 * Used in PUT /api/v1/h5p/activity/{id} endpoint
 */
export interface H5PActivityUpdatePayload {
  /** Updated display name of the activity (max length: 1333) */
  name?: string;
  /** Updated activity description/introduction text */
  intro?: string;
  /** Updated format of the intro field (0=Moodle, 1=HTML, 2=Plain, 4=Markdown) */
  introformat?: number;
  /** Updated maximum grade for this activity (0 = no grade, or positive integer) */
  grade?: number;
  /** Updated bit flags for H5P button display options (frame, download, embed, copyright, about) */
  displayoptions?: number;
  /** Updated xAPI tracking setting (1 = enabled, 0 = disabled) */
  enabletracking?: number;
  /** Updated method used to calculate final grade from multiple attempts */
  grademethod?: number;
  /** Updated review mode setting (null or 0=none, 1=after completion) */
  reviewmode?: number;
}

// ============================================================================
// Access Information
// ============================================================================

/**
 * Access information for H5P activity
 * Contains capability checks for the current user
 * Used to control UI visibility and interactions
 */
export interface H5PAccessInfo {
  /** Whether user can view the activity */
  canview: boolean;
  /** Whether user can submit attempts (start new attempts) */
  cansubmit: boolean;
  /** Whether user can review all attempts (typically for teachers/graders) */
  canreviewattempts: boolean;
}

// ============================================================================
// xAPI Statement Components
// ============================================================================

/**
 * xAPI Actor - Represents the learner who performed the action
 * 
 * @see https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#actor
 */
export interface XAPIActor {
  /** Display name of the actor */
  name: string;
  /** Email in mailto: format (e.g., "mailto:user@example.com") */
  mbox: string;
  /** Type of actor object (typically "Agent") */
  objectType: string;
}

/**
 * xAPI Verb - Represents the action performed
 * 
 * @see https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#verb
 */
export interface XAPIVerb {
  /** IRI identifier for the verb (e.g., "http://adlnet.gov/expapi/verbs/completed") */
  id: string;
  /** Display name(s) for the verb in multiple languages */
  display: Record<string, string>;
}

/**
 * xAPI Object - Represents the target of the action
 * 
 * @see https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#object
 */
export interface XAPIObject {
  /** IRI identifier for the object */
  id: string;
  /** Type of object (typically "Activity") */
  objectType: string;
  /** Additional metadata about the object including interaction type */
  definition: {
    /** Name/title of the activity */
    name?: Record<string, string>;
    /** Description of the activity */
    description?: Record<string, string>;
    /** Type of interaction (true-false, choice, fill-in, etc.) */
    interactionType?: H5PInteractionType;
    /** Correct response pattern for the interaction */
    correctResponsesPattern?: string[];
    /** Choices available for choice-type interactions */
    choices?: Array<{
      id: string;
      description: Record<string, string>;
    }>;
  };
}

/**
 * xAPI Score - Represents the numeric score achieved
 * 
 * @see https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#score
 */
export interface XAPIScore {
  /** Raw score achieved (e.g., 8) */
  raw: number;
  /** Minimum possible score (e.g., 0) */
  min: number;
  /** Maximum possible score (e.g., 10) */
  max: number;
  /** Scaled score normalized to -1..1 range (e.g., 0.8) */
  scaled: number;
}

/**
 * xAPI Result - Represents the outcome of the activity
 * 
 * @see https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#result
 */
export interface XAPIResult {
  /** Score achieved */
  score?: XAPIScore;
  /** Whether the activity was completed */
  completion?: boolean;
  /** Whether the attempt was successful (passed) */
  success?: boolean;
  /** Duration in ISO 8601 format (e.g., "PT15M30S") */
  duration?: string;
  /** Learner's response to the interaction */
  response?: string;
}

/**
 * xAPI Context - Provides context for the statement
 * 
 * @see https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#context
 */
export interface XAPIContext {
  /** Related activities (parent, grouping, category, other) */
  contextActivities?: {
    parent?: Array<{ id: string; objectType: string }>;
    grouping?: Array<{ id: string; objectType: string }>;
    category?: Array<{ id: string; objectType: string }>;
    other?: Array<{ id: string; objectType: string }>;
  };
  /** UUID for grouping multiple statements from the same attempt */
  registration?: string;
  /** Actor representing the instructor */
  instructor?: XAPIActor;
  /** Group representing the team */
  team?: XAPIActor;
}

/**
 * Complete xAPI Statement
 * Represents a single tracked learning interaction
 * 
 * @see https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#statement
 */
export interface H5PStatement {
  /** The learner who performed the action */
  actor: XAPIActor;
  /** The action that was performed */
  verb: XAPIVerb;
  /** The target of the action */
  object: XAPIObject;
  /** The outcome of the action */
  result: XAPIResult;
  /** Contextual information about the statement */
  context: XAPIContext;
  /** ISO 8601 timestamp when the statement occurred */
  timestamp: string;
}

// ============================================================================
// Attempt and Result Interfaces
// ============================================================================

/**
 * H5P Activity attempt data
 * Represents a single user attempt at an H5P activity
 *
 * @see h5pactivity_attempts database table (install.xml)
 */
export interface H5PAttempt {
  /** Unique identifier for the attempt */
  id: number;
  /** H5P activity ID this attempt belongs to */
  h5pactivityid: number;
  /** User ID who made this attempt (references mdl_user.id) */
  userid: UserId;
  /** Unix timestamp when attempt was created */
  timecreated: number;
  /** Unix timestamp when attempt was last modified */
  timemodified: number;
  /** Attempt number for this user (1, 2, 3, etc.) */
  attempt: number;
  /** Raw score achieved (sum of all interaction scores) */
  rawscore: number;
  /** Maximum possible score (sum of all interaction max scores) */
  maxscore: number;
  /** Scaled score (0..1) reflecting the performance of the learner */
  scaled: number;
  /** Total duration in seconds spent on this attempt */
  duration: number;
  /** xAPI completion status (1 = complete, 0 = incomplete, null = unknown) */
  completion: number | null;
  /** xAPI success status (1 = success, 0 = failure, null = unknown) */
  success: number | null;
}

/**
 * H5P Attempt result (individual interaction within an attempt)
 * Represents tracking information for a single interaction/question in an attempt
 *
 * @see h5pactivity_attempts_results database table (install.xml)
 */
export interface H5PResult {
  /** Unique identifier for the result */
  id: number;
  /** Attempt ID this result belongs to (references h5pactivity_attempts.id) */
  attemptid: number;
  /** Subcontent identifier (optional, for multi-part H5P content) */
  subcontent: string;
  /** Unix timestamp when result was created */
  timecreated: number;
  /** Type of interaction (true-false, choice, fill-in, etc.) */
  interactiontype: H5PInteractionType;
  /** Description of the interaction/question */
  description: string;
  /** Correct response pattern in xAPI format */
  correctpattern: string;
  /** User's response data in xAPI format */
  response: string;
  /** Extra subcontent information in JSON format */
  additionals: string;
  /** Raw score achieved for this interaction */
  rawscore: number;
  /** Maximum possible score for this interaction */
  maxscore: number;
  /** Duration in seconds spent on this interaction */
  duration: number;
  /** xAPI completion status (1 = complete, 0 = incomplete, null = unknown) */
  completion: number | null;
  /** xAPI success status (1 = success, 0 = failure, null = unknown) */
  success: number | null;
}

/**
 * H5P Attempt with embedded results
 * Extended attempt interface that includes the individual interaction results
 * Used in detailed reports and review pages
 */
export interface H5PAttemptWithResults extends H5PAttempt {
  /** Array of individual interaction results for this attempt */
  results: H5PResult[];
}

// ============================================================================
// Report Data Structure
// ============================================================================

/**
 * H5P Report Data structure
 * Aggregated data for displaying attempt reports and analytics
 * Returned by the get_results external API method
 */
export interface H5PReportData {
  /** H5P activity ID */
  activityid: number;
  /** Complete activity information */
  activity: H5PActivity;
  /** Array of attempts with their results */
  attempts: H5PAttemptWithResults[];
  /** API warnings or informational messages */
  warnings: Array<{
    /** Warning type/code */
    item: string;
    /** ID of the item that caused the warning */
    itemid: number;
    /** Warning code (e.g., "cannotviewreport") */
    warningcode: string;
    /** Human-readable warning message */
    message: string;
  }>;
}
