/**
 * TypeScript Type Definitions for SCORM Module
 *
 * Comprehensive type definitions for SCORM (Sharable Content Object Reference Model) module
 * supporting both SCORM 1.2 and SCORM 2004 standards.
 *
 * Based on Moodle SCORM database schema and business logic from:
 * - public/mod/scorm/db/install.xml
 * - public/mod/scorm/lib.php
 * - public/mod/scorm/locallib.php
 * - public/mod/scorm/datamodel.php
 *
 * @package react-frontend
 * @subpackage features/activities/scorm
 */

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

/**
 * SCORM package type
 */
export enum ScormType {
  LOCAL = 'local',
  LOCALSYNC = 'localsync',
  EXTERNAL = 'external',
  AICCURL = 'aiccurl',
}

/**
 * SCORM version enumeration
 */
export enum ScormVersion {
  SCORM_12 = 1,
  SCORM_13 = 2,
  SCORM_2004 = SCORM_13, // Alias for SCORM_13
  SCORM_AICC = 3,
}

/**
 * SCORM update frequency options
 */
export enum ScormUpdateFrequency {
  NEVER = 0,
  EVERYDAY = 2,
  EVERYTIME = 3,
}

/**
 * Skip view mode options
 */
export enum ScormSkipView {
  NEVER = 0,
  FIRST = 1,
  ALWAYS = 2,
}

/**
 * Grade calculation method
 */
export enum ScormGradeMethod {
  SCOES = 0, // Average of all SCOs
  HIGHEST = 1, // Highest score across all SCOs
  AVERAGE = 2, // Average score
  SUM = 3, // Sum of all scores
}

/**
 * Which attempt to use for grading
 */
export enum ScormWhatGrade {
  HIGHEST = 0, // Highest attempt score
  AVERAGE = 1, // Average of all attempts
  FIRST = 2, // First attempt
  LAST = 3, // Last attempt
}

/**
 * Force new attempt options
 */
export enum ScormForceAttempt {
  NO = 0,
  ONCOMPLETE = 1,
  ALWAYS = 2,
}

/**
 * Table of contents display mode
 */
export enum ScormTocDisplay {
  SIDE = 0,
  HIDDEN = 1,
  POPUP = 2,
  DISABLED = 3,
}

/**
 * Navigation display options
 */
export enum ScormNavDisplay {
  DISABLED = 0,
  UNDER_CONTENT = 1,
  FLOATING = 2,
}

/**
 * SCORM lesson/completion status values
 */
export enum ScormStatus {
  NOT_ATTEMPTED = 'not attempted',
  INCOMPLETE = 'incomplete',
  COMPLETED = 'completed',
  PASSED = 'passed',
  FAILED = 'failed',
  BROWSED = 'browsed',
  UNKNOWN = 'unknown',
}

/**
 * SCO type enumeration
 */
export enum ScoType {
  ASSET = 'asset',
  SCO = 'sco',
}

/**
 * SCORM 2004 navigation request types
 */
export enum ScormNavigationRequest {
  CONTINUE = 'continue',
  PREVIOUS = 'previous',
  CHOICE = 'choice',
  EXIT = 'exit',
  EXIT_ALL = 'exitAll',
  ABANDON = 'abandon',
  ABANDON_ALL = 'abandonAll',
  SUSPEND_ALL = 'suspendAll',
}

/**
 * Display attempt status options
 */
export enum ScormDisplayAttemptStatus {
  NO = 0,
  ALL = 1,
  MY = 2,
  ENTRY = 3,
}

// ============================================================================
// CORE SCORM INTERFACES
// ============================================================================

/**
 * Main SCORM activity interface
 * Maps to scorm database table
 */
export interface Scorm {
  /** SCORM activity ID */
  id: number;

  /** Course ID */
  course: number;

  /** Activity name */
  name: string;

  /** SCORM package type (local, external, repository, etc.) */
  scormtype: ScormType;

  /** Reference to package file or external URL */
  reference: string;

  /** Activity introduction/description */
  intro: string;

  /** Format of intro field */
  introformat: number;

  /** SCORM version string (e.g., "SCORM_1.2", "SCORM_2004") */
  version: string;

  /** Maximum grade for this activity */
  maxgrade: number;

  /** Grading method */
  grademethod: ScormGradeMethod;

  /** Which attempt to use for grading */
  whatgrade: ScormWhatGrade;

  /** Maximum number of attempts allowed (0 = unlimited) */
  maxattempt: number;

  /** Force completed status */
  forcecompleted: boolean;

  /** Force new attempt after completion */
  forcenewattempt: ScormForceAttempt;

  /** Lock final attempt */
  lastattemptlock: boolean;

  /** Allow mastery override */
  masteryoverride: boolean;

  /** Display attempt status */
  displayattemptstatus: ScormDisplayAttemptStatus;

  /** Display course structure */
  displaycoursestructure: boolean;

  /** Package update frequency */
  updatefreq: ScormUpdateFrequency;

  /** SHA1 hash of package */
  sha1hash: string | null;

  /** MD5 hash of package */
  md5hash: string;

  /** Package revision number */
  revision: number;

  /** Default SCO to launch */
  launch: number;

  /** Skip view mode */
  skipview: ScormSkipView;

  /** Hide browse button */
  hidebrowse: boolean;

  /** Table of contents display mode */
  hidetoc: ScormTocDisplay;

  /** Navigation display mode */
  nav: ScormNavDisplay;

  /** Navigation panel left position */
  navpositionleft: number;

  /** Navigation panel top position */
  navpositiontop: number;

  /** Auto-continue to next SCO */
  auto: boolean;

  /** Open in popup window */
  popup: boolean;

  /** Popup window options string */
  options: string;

  /** Player width */
  width: number;

  /** Player height */
  height: number;

  /** Time when activity opens */
  timeopen: number;

  /** Time when activity closes */
  timeclose: number;

  /** Last modified timestamp */
  timemodified: number;

  /** Completion status required (bitmask) */
  completionstatusrequired: number | null;

  /** Completion score required */
  completionscorerequired: number | null;

  /** Require completion of all SCOs */
  completionstatusallscos: boolean | null;

  /** Auto-commit tracking data */
  autocommit: boolean;
}

/**
 * Shareable Content Object (SCO) interface
 * Maps to scorm_scoes table
 */
export interface ScormSco {
  /** SCO ID */
  id: number;

  /** Parent SCORM activity ID */
  scorm: number;

  /** Manifest identifier */
  manifest: string;

  /** Organization identifier */
  organization: string;

  /** Parent SCO identifier */
  parent: string;

  /** SCO identifier from manifest */
  identifier: string;

  /** Launch URL/path */
  launch: string;

  /** SCO type (asset or sco) */
  scormtype: ScoType;

  /** SCO title */
  title: string;

  /** Sort order within manifest */
  sortorder: number;
}

/**
 * SCORM attempt tracking
 * Maps to scorm_attempt table
 */
export interface ScormAttempt {
  /** Attempt ID */
  id?: number;

  /** User ID */
  userid: number;

  /** SCORM activity ID */
  scormid: number;

  /** Attempt number (1-based) */
  attempt: number;

  /** Timestamp when attempt was last modified */
  timemodified?: number;

  /** Current status of the attempt */
  status?: ScormStatus;
}

/**
 * User tracking data for a specific SCO and attempt
 */
export interface ScormUserData {
  /** SCO ID */
  scoid: number;

  /** Attempt number */
  attempt: number;

  /** User ID */
  userid: number;

  /** Tracking data elements */
  tracks: Record<string, ScormTrackingElement>;

  /** Last modification timestamp */
  timemodified: number;
}

/**
 * SCORM tracking data for API communication
 */
export interface ScormTrackingData {
  /** SCO ID */
  scoid: number;

  /** Attempt number */
  attempt: number;

  /** CMI tracking elements (key-value pairs) */
  tracks: Record<string, string | number | boolean>;
}

/**
 * Individual tracking element
 */
export interface ScormTrackingElement {
  /** CMI element name (e.g., "cmi.core.lesson_status") */
  element: string;

  /** Element value */
  value: string;

  /** Timestamp of last modification */
  timemodified?: number;
}

/**
 * SCO static data from package manifest
 * Maps to scorm_scoes_data table
 */
export interface ScormScoData {
  /** Data ID */
  id: number;

  /** SCO ID */
  scoid: number;

  /** Data element name */
  name: string;

  /** Data element value */
  value: string;
}

// ============================================================================
// TABLE OF CONTENTS (TOC) INTERFACES
// ============================================================================

/**
 * Table of Contents node for SCORM navigation
 * Hierarchical tree structure for content organization
 */
export interface ScormTOCNode {
  /** SCO ID */
  id: number;

  /** Display title */
  title: string;

  /** SCO identifier from manifest */
  identifier: string;

  /** Organization this SCO belongs to */
  organization: string;

  /** SCO type (asset or sco) */
  scormtype: ScoType;

  /** Parent SCO identifier (empty string for root) */
  parent: string;

  /** Whether SCO is visible in TOC */
  isvisible: boolean;

  /** Launch URL (empty for organizational nodes) */
  launch: string;

  /** Child SCO nodes */
  children: ScormTOCNode[];

  /** Completion/attempt status for this SCO */
  status?: ScormStatus;

  /** Whether SCO is enabled (prerequisites met) */
  isEnabled: boolean;

  /** Prerequisite condition string */
  prerequisite?: string;

  /** Sort order */
  sortorder?: number;

  /** Current score for this SCO */
  score?: ScormScore;
}

/**
 * Score information for a SCO
 */
export interface ScormScore {
  /** Raw score */
  raw?: number;

  /** Minimum possible score */
  min?: number;

  /** Maximum possible score */
  max?: number;

  /** Scaled score (-1 to 1 for SCORM 2004) */
  scaled?: number;
}

// ============================================================================
// CMI DATA MODEL INTERFACES
// ============================================================================

/**
 * CMI Core data (SCORM 1.2)
 */
export interface ScormCMICore {
  student_id: string;
  student_name: string;
  lesson_location?: string;
  credit: 'credit' | 'no-credit';
  lesson_status: ScormStatus;
  entry: 'ab-initio' | 'resume' | '';
  score?: ScormScore;
  total_time: string;
  lesson_mode: 'browse' | 'normal' | 'review';
  exit?: 'time-out' | 'suspend' | 'logout' | '';
  session_time: string;
}

/**
 * CMI Learner data (SCORM 2004)
 */
export interface ScormCMILearner {
  id: string;
  name: string;
}

/**
 * CMI Objective
 */
export interface ScormCMIObjective {
  id: string;
  score?: ScormScore;
  status?: ScormStatus;
  description?: string;
}

/**
 * CMI Interaction (for tracking assessments)
 */
export interface ScormCMIInteraction {
  id: string;
  type:
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
  objectives?: string[];
  timestamp?: string;
  correct_responses?: string[];
  weighting?: number;
  learner_response?: string;
  result?: 'correct' | 'incorrect' | 'unanticipated' | 'neutral' | number;
  latency?: string;
  description?: string;
}

/**
 * Complete CMI data model (SCORM 1.2)
 */
export interface ScormCMIData12 {
  core: ScormCMICore;
  suspend_data?: string;
  launch_data?: string;
  comments?: string;
  comments_from_lms?: string;
  objectives?: ScormCMIObjective[];
  student_data?: {
    mastery_score?: number;
    max_time_allowed?: string;
    time_limit_action?:
      | 'exit,message'
      | 'exit,no message'
      | 'continue,message'
      | 'continue,no message';
  };
  interactions?: ScormCMIInteraction[];
}

/**
 * Complete CMI data model (SCORM 2004)
 */
export interface ScormCMIData2004 {
  version: '1.0';
  comments_from_learner?: Array<{
    comment: string;
    location?: string;
    timestamp?: string;
  }>;
  comments_from_lms?: Array<{
    comment: string;
    location?: string;
    timestamp?: string;
  }>;
  completion_status: 'completed' | 'incomplete' | 'not attempted' | 'unknown';
  completion_threshold?: number;
  credit: 'credit' | 'no-credit';
  entry: 'ab-initio' | 'resume' | '';
  exit: 'time-out' | 'suspend' | 'logout' | 'normal' | '';
  interactions?: ScormCMIInteraction[];
  launch_data?: string;
  learner_id: string;
  learner_name: string;
  learner_preference?: {
    audio_level?: number;
    language?: string;
    delivery_speed?: number;
    audio_captioning?: number;
  };
  location?: string;
  max_time_allowed?: string;
  mode: 'browse' | 'normal' | 'review';
  objectives?: ScormCMIObjective[];
  progress_measure?: number;
  scaled_passing_score?: number;
  score?: ScormScore;
  session_time: string;
  success_status: 'passed' | 'failed' | 'unknown';
  suspend_data?: string;
  time_limit_action:
    | 'exit,message'
    | 'exit,no message'
    | 'continue,message'
    | 'continue,no message';
  total_time: string;
}

// ============================================================================
// SCORM 2004 SEQUENCING INTERFACES
// ============================================================================

/**
 * SCORM 2004 Objective
 * Maps to scorm_seq_objective table
 */
export interface ScormSeqObjective {
  id: number;
  scoid: number;
  primaryobj: boolean;
  objectiveid: string;
  satisfiedbymeasure: boolean;
  minnormalizedmeasure: number;
}

/**
 * SCORM 2004 Objective Map Info
 * Maps to scorm_seq_mapinfo table
 */
export interface ScormSeqMapInfo {
  id: number;
  scoid: number;
  objectiveid: number;
  targetobjectiveid: number;
  readsatisfiedstatus: boolean;
  readnormalizedmeasure: boolean;
  writesatisfiedstatus: boolean;
  writenormalizedmeasure: boolean;
}

/**
 * SCORM 2004 Sequencing Rule Conditions
 * Maps to scorm_seq_ruleconds table
 */
export interface ScormSeqRuleConditions {
  id: number;
  scoid: number;
  conditioncombination: 'all' | 'any';
  ruletype: number;
  action: string;
}

/**
 * SCORM 2004 Sequencing Rule Condition
 * Maps to scorm_seq_rulecond table
 */
export interface ScormSeqRuleCondition {
  id: number;
  scoid: number;
  ruleconditionsid: number;
  refrencedobjective: string;
  measurethreshold: number;
  operator: 'noOp' | 'not' | 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge';
  cond: string;
}

/**
 * SCORM 2004 Rollup Rule
 * Maps to scorm_seq_rolluprule table
 */
export interface ScormSeqRollupRule {
  id: number;
  scoid: number;
  childactivityset: string;
  minimumcount: number;
  minimumpercent: number;
  conditioncombination: 'all' | 'any';
  action: string;
}

/**
 * SCORM 2004 Rollup Rule Condition
 * Maps to scorm_seq_rolluprulecond table
 */
export interface ScormSeqRollupRuleCondition {
  id: number;
  scoid: number;
  rollupruleid: number;
  operator: 'noOp' | 'not';
  cond: string;
}

/**
 * SCORM 2004 Navigation Request
 */
export interface ScormNavRequest {
  request: ScormNavigationRequest;
  target?: string; // For choice navigation
  valid?: boolean; // Whether request is valid
}

// ============================================================================
// REPORTING INTERFACES
// ============================================================================

/**
 * Comprehensive SCORM report for a user
 */
export interface ScormReport {
  /** SCORM activity ID */
  scormId: number;

  /** User ID */
  userId: number;

  /** All attempts made by user */
  attempts: ScormAttemptSummary[];

  /** Current/active attempt number */
  currentAttempt: number;

  /** Overall score across all attempts */
  overallScore: number;

  /** Final calculated grade */
  grade: number;

  /** Completion percentage */
  completionPercentage: number;

  /** Total time spent across all attempts */
  totalTimeSpent: string;

  /** Interaction tracking data */
  interactions: ScormCMIInteraction[];

  /** Objectives progress */
  objectives: ScormCMIObjective[];

  /** Progress for each SCO */
  scoProgress: ScormScoProgress[];

  /** Grading method used */
  gradingMethod: ScormGradeMethod;

  /** Overall status */
  status: ScormStatus;
}

/**
 * Summary of a single attempt
 */
export interface ScormAttemptSummary {
  /** Attempt number */
  attemptNumber: number;

  /** Attempt score */
  score: number;

  /** Completion status */
  status: ScormStatus;

  /** Time started */
  timeStarted: number;

  /** Time completed */
  timeCompleted?: number;

  /** Time spent in this attempt */
  timeSpent: string;

  /** Number of SCOs completed */
  scosCompleted: number;

  /** Total number of SCOs */
  scosTotal: number;
}

/**
 * Progress tracking for individual SCO
 */
export interface ScormScoProgress {
  /** SCO ID */
  scoid: number;

  /** SCO title */
  title: string;

  /** Completion status */
  status: ScormStatus;

  /** Score achieved */
  score?: ScormScore;

  /** Time spent on this SCO */
  timeSpent: string;

  /** Number of attempts on this SCO */
  attempts: number;

  /** Last accessed timestamp */
  lastAccessed?: number;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request to get SCORM activity details
 */
export interface GetScormRequest {
  scormId: number;
  includeScores?: boolean;
}

/**
 * Response with SCORM activity details
 */
export interface GetScormResponse {
  scorm: Scorm;
  scos: ScormSco[];
  userAttempts?: ScormAttempt[];
  canAttempt: boolean;
  maxAttemptsReached: boolean;
}

/**
 * Request to launch a SCO
 */
export interface LaunchScoRequest {
  scormId: number;
  scoId: number;
  attempt: number;
  mode?: 'normal' | 'browse' | 'review';
}

/**
 * Response for SCO launch
 */
export interface LaunchScoResponse {
  launchUrl: string;
  parameters: Record<string, string>;
  cmiData: ScormCMIData12 | ScormCMIData2004;
  scormVersion: ScormVersion;
}

/**
 * Request to save tracking data
 */
export interface SaveTrackingRequest {
  scormId: number;
  scoId: number;
  attempt: number;
  tracks: Record<string, string | number | boolean>;
}

/**
 * Response after saving tracking data
 */
export interface SaveTrackingResponse {
  success: boolean;
  navigationRequest?: ScormNavRequest;
  nextSco?: number;
}

/**
 * Request to get table of contents
 * Note: scormId is passed as URL parameter, not in request body
 */
export interface GetTOCRequest {
  attempt?: number;
  includeStatus?: boolean;
  organization?: string;
}

/**
 * Response with table of contents
 */
export interface GetTOCResponse {
  toc: ScormTOCNode[];
  currentSco?: number;
  completionStatus: Record<number, ScormStatus>;
}

/**
 * Request to get SCORM report
 */
export interface GetReportRequest {
  scormId: number;
  userId?: number;
  attempt?: number;
  includeInteractions?: boolean;
}

/**
 * Response with SCORM report
 */
export interface GetReportResponse {
  report: ScormReport;
}

/**
 * Request to create new attempt
 */
export interface CreateAttemptRequest {
  scormId: number;
  forcenew?: boolean;
}

/**
 * Response after creating attempt
 */
export interface CreateAttemptResponse {
  attempt: ScormAttempt;
  attemptNumber: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Popup window options for SCORM player
 */
export interface ScormPopupOptions {
  scrollbars: boolean;
  directories: boolean;
  location: boolean;
  menubar: boolean;
  toolbar: boolean;
  status: boolean;
  resizable?: boolean;
  width?: number;
  height?: number;
}

/**
 * SCORM player configuration
 */
export interface ScormPlayerConfig {
  scormId: number;
  scoId: number;
  attempt: number;
  mode: 'normal' | 'browse' | 'review';
  navigation: ScormNavDisplay;
  tocDisplay: ScormTocDisplay;
  width: number;
  height: number;
  popup: boolean;
  popupOptions?: ScormPopupOptions;
  autoCommit: boolean;
  autoProgress: boolean;
}

/**
 * Time duration in SCORM format
 * SCORM 1.2: CMITimespan format (HHHH:MM:SS.SS)
 * SCORM 2004: ISO 8601 duration format (P[yY][mM][dD][T[hH][mM][s[.s]S]])
 */
export type ScormDuration = string;

/**
 * SCORM prerequisite evaluation result
 */
export interface PrerequisiteResult {
  met: boolean;
  expression: string;
  evaluation: string;
}

/**
 * List response with pagination
 */
export interface ScormListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================================================
// TYPE ALIASES FOR API LAYER COMPATIBILITY
// ============================================================================

/**
 * SCORM Table of Contents Response
 * Matches the structure returned by scorm_get_toc_object() PHP function
 * 
 * Contains:
 * - scoes: Hierarchical array of SCO nodes with children
 * - usertracks: User tracking data for the current attempt
 * - scoid: Current SCO ID (active node)
 */
export interface ScormToc {
  /** Array of hierarchical SCO nodes (already structured with children) */
  scoes: ScormTOCNode[];
  
  /** User tracking data for current attempt */
  usertracks: Record<string, unknown>;
  
  /** Current/active SCO ID */
  scoid: number | null;
}

/**
 * Type alias for SCORM report (API compatibility)
 */
export type ScormAttemptReport = ScormReport;

/**
 * Type alias for launch SCO parameters (API compatibility)
 */
export type LaunchScoParams = LaunchScoRequest;

/**
 * Type alias for submit tracking parameters (API compatibility)
 */
export type SubmitTrackingParams = SaveTrackingRequest;

/**
 * Type alias for fetch TOC parameters (API compatibility)
 */
export type FetchScormTocParams = GetTOCRequest;

/**
 * Type alias for fetch report parameters (API compatibility)
 */
export type FetchAttemptReportParams = GetReportRequest;

/**
 * Parameters for evaluating SCORM prerequisites
 */
export interface EvaluatePrerequisitesParams {
  scormId: number;
  scoId: number;
  attempt: number;
  currentSco?: number;
}
