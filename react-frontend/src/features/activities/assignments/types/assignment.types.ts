/**
 * TypeScript Type Definitions for Assignment Module
 *
 * This file contains comprehensive type definitions for the Moodle assignment module,
 * based on the database schema (assign, assign_submission, assign_grades tables)
 * and the external API structures defined in mod/assign/externallib.php.
 *
 * These types ensure type safety across all assignment components and API interactions
 * by matching the data structures returned by Moodle's REST API.
 *
 * @package react-frontend
 * @module features/activities/assignments/types
 */

/**
 * Submission Status Enum
 * Represents the possible states of a student's assignment submission.
 * Based on ASSIGN_SUBMISSION_STATUS constants in locallib.php.
 */
export enum SubmissionStatus {
  /** Initial state when submission is first created */
  NEW = 'new',
  /** Submission was previously submitted but has been reopened for changes */
  REOPENED = 'reopened',
  /** Submission is saved but not yet submitted (if drafts are enabled) */
  DRAFT = 'draft',
  /** Submission has been submitted for grading */
  SUBMITTED = 'submitted',
}

/**
 * Grading Status Enum
 * Indicates whether a submission has been graded.
 * Based on ASSIGN_GRADING_STATUS constants in locallib.php.
 */
export enum GradingStatus {
  /** Submission has received a grade */
  GRADED = 'graded',
  /** Submission has not been graded yet */
  NOT_GRADED = 'notgraded',
}

/**
 * Marking Workflow State Enum
 * Represents the stages in the marking workflow process.
 * Based on ASSIGN_MARKING_WORKFLOW_STATE constants in locallib.php.
 */
export enum WorkflowState {
  /** Initial state, not yet marked */
  NOT_MARKED = 'notmarked',
  /** Currently being marked by grader */
  IN_MARKING = 'inmarking',
  /** Marking complete, ready for review */
  READY_FOR_REVIEW = 'readyforreview',
  /** Currently under review */
  IN_REVIEW = 'inreview',
  /** Review complete, ready to release to student */
  READY_FOR_RELEASE = 'readyforrelease',
  /** Grade released to student */
  RELEASED = 'released',
}

/**
 * Attempt Reopen Method Enum
 * Defines how and when students can submit additional attempts.
 * Based on ASSIGN_ATTEMPT_REOPEN_METHOD constants in locallib.php.
 */
export enum AttemptReopenMethod {
  /** No additional attempts allowed */
  NONE = 'none',
  /** Teacher must manually allow new attempts */
  MANUAL = 'manual',
  /** New attempts automatically available after submission */
  AUTOMATIC = 'automatic',
  /** New attempts allowed until student passes */
  UNTIL_PASS = 'untilpass',
}

/**
 * Assignment File Interface
 * Represents a file attachment associated with an assignment or submission.
 * Based on the external_files structure used throughout the assignment API.
 */
export interface AssignmentFile {
  /** File name */
  filename: string;
  /** File path within Moodle's file system */
  filepath: string;
  /** File size in bytes */
  filesize: number;
  /** File URL for downloading */
  fileurl: string;
  /** Timestamp when file was last modified */
  timemodified: number;
  /** MIME type of the file */
  mimetype: string;
  /** Whether this is an external file */
  isexternalfile?: boolean;
  /** Repository type if external file */
  repositorytype?: string;
}

/**
 * Plugin File Area Interface
 * Represents a file area within an assignment plugin.
 * Based on get_plugin_structure() in externallib.php.
 */
export interface PluginFileArea {
  /** File area identifier */
  area: string;
  /** Array of files in this area */
  files?: AssignmentFile[];
}

/**
 * Plugin Editor Field Interface
 * Represents an editor field within an assignment plugin.
 * Based on get_plugin_structure() in externallib.php.
 */
export interface PluginEditorField {
  /** Field identifier */
  name: string;
  /** Field description */
  description: string;
  /** Field text content */
  text: string;
  /** Text format (1=HTML, 2=PLAIN, etc.) */
  format: number;
}

/**
 * Plugin Configuration Interface
 * Represents configuration settings for an assignment plugin.
 * Based on assign_plugin_config table and get_assignments_config_structure() in externallib.php.
 */
export interface PluginConfig {
  /** Plugin configuration ID */
  id?: number;
  /** Assignment ID this configuration belongs to */
  assignment?: number;
  /** Plugin name */
  plugin: string;
  /** Plugin subtype (assignsubmission or assignfeedback) */
  subtype: string;
  /** Configuration setting name */
  name: string;
  /** Configuration setting value */
  value: string;
}

/**
 * Assignment Plugin Interface
 * Represents a submission or feedback plugin with its data.
 * Based on get_plugin_structure() in externallib.php.
 */
export interface AssignmentPlugin {
  /** Plugin type (e.g., 'file', 'onlinetext', 'comments') */
  type: string;
  /** Plugin display name */
  name: string;
  /** File areas managed by this plugin */
  fileareas?: PluginFileArea[];
  /** Editor fields managed by this plugin */
  editorfields?: PluginEditorField[];
}

/**
 * Assignment Interface
 * Represents a complete assignment activity with all its properties.
 * Based on the assign table schema and get_assignments_assignment_structure() in externallib.php.
 *
 * This interface matches the data structure returned by the GET /api/v1/assignments/{id} endpoint
 * and encompasses all assignment configuration, dates, and settings.
 */
export interface Assignment {
  /** Unique assignment ID */
  id: number;
  /** Course module ID */
  cmid: number;
  /** Course ID this assignment belongs to */
  course: number;
  /** Assignment name/title (max 1333 chars) */
  name: string;
  /** Assignment description/instructions */
  intro?: string;
  /** Format of intro field (1=HTML, 2=PLAIN, etc.) */
  introformat?: number;
  /** Files attached to the assignment introduction */
  introfiles?: AssignmentFile[];
  /** Additional intro attachment files */
  introattachments?: AssignmentFile[];
  /** Activity description field */
  activity?: string;
  /** Format of activity field */
  activityformat?: number;
  /** Files attached to the activity field */
  activityattachments?: AssignmentFile[];

  /** Whether to always show description (0=no, 1=yes) */
  alwaysshowdescription?: number;
  /** Cache flag indicating if any submission plugin is enabled */
  nosubmissions: number;
  /** Whether submissions are drafts until explicitly submitted (0=no, 1=yes) */
  submissiondrafts: number;
  /** Whether to send notifications to graders on submission (0=no, 1=yes) */
  sendnotifications: number;
  /** Whether to send notifications for late submissions (0=no, 1=yes) */
  sendlatenotifications: number;
  /** Default value for send student notifications checkbox when grading */
  sendstudentnotifications: number;

  /** Due date timestamp (0 if no due date) */
  duedate: number;
  /** Date from which submissions are accepted (0 if always) */
  allowsubmissionsfromdate: number;
  /** Cut-off date after which submissions are not accepted without extension (0 if none) */
  cutoffdate: number;
  /** Expected date for marking/grading completion (0 if none) */
  gradingduedate: number;

  /** Maximum grade for this assignment (negative values indicate scale usage) */
  grade: number;
  /** If enabled, penalty will be applied to late submissions (0=no, 1=yes) */
  gradepenalty: number;
  /** Timestamp of last modification to assignment settings */
  timemodified: number;

  /** Whether student must accept submission statement (0=no, 1=yes) */
  requiresubmissionstatement: number;
  /** Submission statement text formatted for display */
  submissionstatement?: string;
  /** Format of submission statement */
  submissionstatementformat?: number;
  /** Set activity as complete when submission made (0=no, 1=yes) */
  completionsubmit: number;

  /** Whether students submit as teams (0=no, 1=yes) */
  teamsubmission: number;
  /** Whether all team members must submit (0=no, 1=yes) */
  requireallteammemberssubmit: number;
  /** Grouping ID for team submission groups (0 if none) */
  teamsubmissiongroupingid: number;

  /** Hide student/grader identities until revealed (0=no, 1=yes) */
  blindmarking: number;
  /** Hide grader identity from students (0=no, 1=yes) */
  hidegrader: number;
  /** Whether identities have been revealed for blind marking (0=no, 1=yes) */
  revealidentities: number;

  /** Method for reopening attempts (manual, automatic, untilpass) */
  attemptreopenmethod: string;
  /** Maximum number of attempts allowed (-1 for unlimited) */
  maxattempts: number;

  /** Enable marking workflow features (0=no, 1=yes) */
  markingworkflow: number;
  /** Enable marking allocation features (0=no, 1=yes) */
  markingallocation: number;
  /** Enable marking anonymous features (0=no, 1=yes) */
  markinganonymous: number;

  /** Prevent submission unless student is in a group (0=no, 1=yes) */
  preventsubmissionnotingroup?: number;
  /** Time limit to complete assignment in seconds (0 if none) */
  timelimit?: number;
  /** Flag to only show files during submission (0=no, 1=yes) */
  submissionattachments?: number;

  /** Array of plugin configurations for this assignment */
  configs?: PluginConfig[];
}

/**
 * Submission Interface
 * Represents a student's submission for an assignment.
 * Based on the assign_submission table and get_submission_structure() in externallib.php.
 *
 * This interface matches the data returned by submission-related API endpoints
 * and includes all submission metadata and plugin data.
 */
export interface Submission {
  /** Unique submission ID */
  id: number;
  /** Assignment ID this submission belongs to */
  assignment: number;
  /** User ID of the submitting student */
  userid: number;
  /** Timestamp when submission was first created */
  timecreated: number;
  /** Timestamp when submission was last modified */
  timemodified: number;
  /** Timestamp when student started working on submission */
  timestarted?: number;
  /** Current status of submission (new, draft, submitted, reopened) */
  status: string;
  /** Group ID for team submissions (0 for individual) */
  groupid: number;
  /** Attempt number (0-based) */
  attemptnumber: number;
  /** Whether this is the latest attempt (0=no, 1=yes) */
  latest?: number;
  /** Grading status for this submission (graded, notgraded) */
  gradingstatus?: string;
  /** Array of submission plugins with their data */
  plugins?: AssignmentPlugin[];
  /** Grade ID (when fetched with grade data in grading context) */
  gradeid?: number;
  /** Numeric grade value (when fetched with grade data in grading context) */
  grade?: string | number;
  /** Student name (when fetched with user data) */
  studentname?: string;
}

/**
 * Grade Interface
 * Represents grading information for an assignment submission.
 * Based on the assign_grades table and get_grade_structure() in externallib.php.
 *
 * This interface matches the grade data returned by grading API endpoints
 * and includes all grade information and feedback.
 */
export interface Grade {
  /** Unique grade ID */
  id: number;
  /** Assignment ID this grade belongs to */
  assignment?: number;
  /** User ID of the student being graded */
  userid: number;
  /** Attempt number this grade relates to */
  attemptnumber: number;
  /** Timestamp when grade was created */
  timecreated: number;
  /** Timestamp when grade was last modified */
  timemodified: number;
  /** User ID of the grader (-1 if grader is hidden) */
  grader: number;
  /** Numeric grade value (can be string for scale grades) */
  grade: string | number;
  /** Percentage to be deducted from final grade as penalty */
  penalty?: number;
  /** Grade formatted for display to students */
  gradefordisplay?: string;
}

/**
 * User Flag Interface
 * Represents special flags set for a user in an assignment.
 * Used for extensions, marking allocation, and workflow state.
 * Based on assign_user_flags table schema.
 */
export interface UserFlag {
  /** Unique flag ID */
  id: number;
  /** Assignment ID */
  assignment: number;
  /** User ID */
  userid: number;
  /** Whether user is locked from making changes (0=no, 1=yes) */
  locked?: number;
  /** User ID of allocated marker (0 if none) */
  allocatedmarker?: number;
  /** Marking workflow state */
  workflowstate?: string;
  /** Extension due date timestamp (0 if none) */
  extensionduedate?: number;
  /** Whether user should be mailed about this (0=no, 1=yes) */
  mailed?: number;
}

/**
 * User Mapping Interface
 * Maps anonymous IDs to real user IDs for blind marking.
 * Based on assign_user_mapping table schema.
 */
export interface UserMapping {
  /** Unique mapping ID */
  id: number;
  /** Assignment ID */
  assignment: number;
  /** Real user ID */
  userid: number;
}

/**
 * Assignment Override Interface
 * Represents overrides to assignment dates for specific users or groups.
 * Based on assign_overrides table schema.
 */
export interface AssignmentOverride {
  /** Unique override ID */
  id: number;
  /** Assignment ID */
  assignid: number;
  /** Group ID if this is a group override (null for user override) */
  groupid?: number;
  /** User ID if this is a user override (null for group override) */
  userid?: number;
  /** Override for allow submissions from date (null if not overridden) */
  allowsubmissionsfromdate?: number;
  /** Override for due date (null if not overridden) */
  duedate?: number;
  /** Override for cut-off date (null if not overridden) */
  cutoffdate?: number;
  /** Override for time limit (null if not overridden) */
  timelimit?: number;
}

/**
 * Assignment Submission Response
 * Response structure for submission-related API calls.
 * Used when submitting work or updating submission status.
 */
export interface SubmissionResponse {
  /** Whether the operation was successful */
  success: boolean;
  /** The updated submission object */
  submission?: Submission;
  /** Error message if operation failed */
  error?: string;
  /** Warning messages */
  warnings?: string[];
}

/**
 * Assignment Grade Response
 * Response structure for grading-related API calls.
 * Used when grading submissions or updating grades.
 */
export interface GradeResponse {
  /** Whether the operation was successful */
  success: boolean;
  /** The updated grade object */
  grade?: Grade;
  /** Error message if operation failed */
  error?: string;
  /** Warning messages */
  warnings?: string[];
}

/**
 * Assignment List Response
 * Response structure for API calls that return multiple assignments.
 * Includes pagination metadata.
 */
export interface AssignmentListResponse {
  /** Array of assignments */
  assignments: Assignment[];
  /** Total count of assignments matching query */
  total: number;
  /** Current page number (0-based) */
  page: number;
  /** Items per page */
  perPage: number;
}

/**
 * Submission List Response
 * Response structure for API calls that return multiple submissions.
 * Used for viewing all submissions to an assignment.
 */
export interface SubmissionListResponse {
  /** Assignment ID */
  assignmentid: number;
  /** Array of submissions */
  submissions: Submission[];
  /** Total count of submissions */
  total: number;
}
