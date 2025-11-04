/**
 * TypeScript type definitions for the quiz module
 *
 * This file provides comprehensive type safety for Quiz, QuizAttempt, Question, QuizSettings,
 * QuizTimer, and all related data structures. Types mirror the Moodle quiz database schema
 * (quiz, quiz_attempts, quiz_sections, quiz_slots tables) and ensure type consistency across
 * all quiz components, hooks, and API integrations.
 *
 * @package react-frontend
 * @subpackage features/activities/quizzes/types
 */

// ============================================================================
// Enums and Constants
// ============================================================================

/**
 * Quiz attempt state enumeration
 * Maps to the 'state' field in quiz_attempts table
 */
export enum QuizAttemptState {
  /** Attempt has been created but not started */
  NOT_STARTED = 'notstarted',
  /** Attempt is currently in progress */
  IN_PROGRESS = 'inprogress',
  /** Attempt is overdue but not yet submitted */
  OVERDUE = 'overdue',
  /** Attempt has been submitted and is awaiting grading */
  SUBMITTED = 'submitted',
  /** Attempt is finished and graded */
  FINISHED = 'finished',
  /** Attempt was abandoned */
  ABANDONED = 'abandoned',
}

/**
 * Quiz navigation method
 * Maps to the 'navmethod' field in quiz table
 */
export enum QuizNavMethod {
  /** Free navigation - students can move between questions freely */
  FREE = 'free',
  /** Sequential navigation - students must answer questions in order */
  SEQUENTIAL = 'seq',
}

/**
 * Quiz overdue handling method
 * Maps to the 'overduehandling' field in quiz table
 */
export enum OverdueHandling {
  /** Automatically submit the attempt when time expires */
  AUTO_SUBMIT = 'autosubmit',
  /** Allow a grace period for submission */
  GRACE_PERIOD = 'graceperiod',
  /** Automatically abandon the attempt */
  AUTO_ABANDON = 'autoabandon',
}

/**
 * Quiz grade calculation method
 * Maps to the 'grademethod' field in quiz table
 */
export enum GradeMethod {
  /** Use the highest grade from all attempts */
  HIGHEST = 1,
  /** Use the average grade from all attempts */
  AVERAGE = 2,
  /** Use the grade from the first attempt */
  FIRST = 3,
  /** Use the grade from the last attempt */
  LAST = 4,
}

/**
 * Question types supported by the quiz engine
 */
export enum QuestionType {
  MULTICHOICE = 'multichoice',
  TRUEFALSE = 'truefalse',
  SHORTANSWER = 'shortanswer',
  NUMERICAL = 'numerical',
  ESSAY = 'essay',
  MATCH = 'match',
  MULTIANSWER = 'multianswer',
  CALCULATED = 'calculated',
  DESCRIPTION = 'description',
  RANDOM = 'random',
}

/**
 * Question state during an attempt
 */
export enum QuestionState {
  /** Question not yet answered */
  TODO = 'todo',
  /** Question answered but not complete */
  INVALID = 'invalid',
  /** Question complete (answered correctly) */
  COMPLETE = 'complete',
  /** Question needs grading */
  NEEDS_GRADING = 'needsgrading',
  /** Question has been graded */
  GRADED = 'graded',
  /** Question gave up */
  GAVE_UP = 'gaveup',
}

/**
 * Browser security options
 */
export enum BrowserSecurity {
  NONE = '',
  SECURE_WINDOW = 'securewindow',
  SAFE_EXAM_BROWSER = 'safebrowser',
}

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Quiz interface - mirrors the quiz database table
 * Contains all settings and configuration for a quiz activity
 */
export interface Quiz {
  /** Quiz ID (primary key) */
  id: number;

  /** Course ID this quiz belongs to */
  course: number;

  /** Quiz name */
  name: string;

  /** Quiz introduction text */
  intro: string;

  /** Format of the intro text (HTML, plain text, etc.) */
  introformat: number;

  /** Time when quiz opens (Unix timestamp, 0 = no restriction) */
  timeopen: number;

  /** Time when quiz closes (Unix timestamp, 0 = no restriction) */
  timeclose: number;

  /** Time limit for attempts in seconds (0 = no limit) */
  timelimit: number;

  /** How to handle overdue attempts */
  overduehandling: OverdueHandling;

  /** Grace period in seconds after time limit */
  graceperiod: number;

  /** Question behavior (deferred feedback, immediate feedback, etc.) */
  preferredbehaviour: string;

  /** Whether students can redo completed questions */
  canredoquestions?: number;

  /** Maximum number of attempts allowed (0 = unlimited) */
  attempts: number;

  /** Whether subsequent attempts build on previous */
  attemptonlast?: number;

  /** Method for calculating final grade */
  grademethod: GradeMethod;

  /** Number of decimal points for displaying grades */
  decimalpoints: number;

  /** Number of decimal points for question grades (-1 = use decimalpoints) */
  questiondecimalpoints: number;

  /** Review options bit field - when to show attempt */
  reviewattempt: number;

  /** Review options bit field - when to show correctness */
  reviewcorrectness: number;

  /** Review options bit field - when to show max marks */
  reviewmaxmarks?: number;

  /** Review options bit field - when to show marks */
  reviewmarks: number;

  /** Review options bit field - when to show specific feedback */
  reviewspecificfeedback: number;

  /** Review options bit field - when to show general feedback */
  reviewgeneralfeedback: number;

  /** Review options bit field - when to show right answer */
  reviewrightanswer: number;

  /** Review options bit field - when to show overall feedback */
  reviewoverallfeedback: number;

  /** Number of questions per page (0 = all on one page) */
  questionsperpage: number;

  /** Navigation method (free or sequential) */
  navmethod: QuizNavMethod;

  /** Whether to shuffle answer options */
  shuffleanswers: number;

  /** Sum of all question grades */
  sumgrades: number;

  /** Grade the quiz is out of */
  grade: number;

  /** When the quiz was created (Unix timestamp) */
  timecreated: number;

  /** When the quiz was last modified (Unix timestamp) */
  timemodified: number;

  /** Password required to attempt quiz */
  password: string;

  /** Subnet restriction for quiz access */
  subnet: string;

  /** Browser security restrictions */
  browsersecurity: BrowserSecurity | string;

  /** Delay between first and second attempt (seconds) */
  delay1: number;

  /** Delay between subsequent attempts (seconds) */
  delay2: number;

  /** Whether to show user picture during attempt */
  showuserpicture: number;

  /** Whether to show blocks during attempt */
  showblocks: number;

  /** Completion requires all attempts exhausted */
  completionattemptsexhausted?: number;

  /** Minimum attempts required for completion */
  completionminattempts?: number;

  /** Completion requires passing grade */
  completionpass?: number;

  /** Whether offline attempts are allowed */
  allowofflineattempts?: number;

  /** Whether to pre-create attempts */
  precreateattempts?: number;
}

/**
 * Quiz attempt interface - mirrors the quiz_attempts table
 * Represents a single user's attempt at a quiz
 */
export interface QuizAttempt {
  /** Attempt ID (primary key) */
  id: number;

  /** Quiz ID (foreign key) */
  quiz: number;

  /** User ID (foreign key) */
  userid: number;

  /** Attempt number for this user */
  attempt: number;

  /** Unique ID for question usage */
  uniqueid: number;

  /** Layout of questions (comma-separated slot numbers with page breaks) */
  layout?: string;

  /** Current page number */
  currentpage: number;

  /** Whether this is a preview attempt */
  preview?: number;

  /** Current state of the attempt */
  state: QuizAttemptState;

  /** When the attempt was started (Unix timestamp) */
  timestart: number;

  /** When the attempt was finished (Unix timestamp, 0 = not finished) */
  timefinish: number;

  /** When the attempt was last modified (Unix timestamp) */
  timemodified: number;

  /** When the attempt was last modified offline (Unix timestamp) */
  timemodifiedoffline?: number;

  /** Next time to check attempt state (Unix timestamp, null = never) */
  timecheckstate?: number | null;

  /** Total marks for this attempt */
  sumgrades: number | null;

  /** When graded notification was sent (Unix timestamp) */
  gradednotificationsenttime?: number | null;
}

/**
 * Quiz section interface - mirrors the quiz_sections table
 * Represents a section/heading within a quiz
 */
export interface QuizSection {
  /** Section ID (primary key) */
  id: number;

  /** Quiz ID (foreign key) */
  quizid: number;

  /** First slot number in this section */
  firstslot: number;

  /** Section heading text (can be null) */
  heading: string | null;

  /** Whether to shuffle questions in this section */
  shufflequestions: number;

  /** Last slot number in this section (computed field) */
  lastslot?: number;
}

/**
 * Quiz slot interface - mirrors the quiz_slots table
 * Represents a question slot in a quiz
 */
export interface QuizSlot {
  /** Slot ID (primary key) */
  id: number;

  /** Slot number (position in quiz) */
  slot: number;

  /** Quiz ID (foreign key) */
  quizid: number;

  /** Page number this question appears on */
  page: number;

  /** Custom display number (e.g., "1.2", "A1", can be null) */
  displaynumber: string | null;

  /** Whether previous question must be answered first */
  requireprevious: number;

  /** Maximum mark for this question */
  maxmark: number;

  /** Quiz grade item ID (for multi-grade quizzes, can be null) */
  quizgradeitemid: number | null;

  /** Question ID (computed field) */
  questionid?: number;

  /** Question bank entry ID */
  questionbankentryid?: number;
}

/**
 * Quiz feedback interface - mirrors the quiz_feedback table
 * Grade-based feedback shown to students
 */
export interface QuizFeedback {
  /** Feedback ID (primary key) */
  id: number;

  /** Quiz ID (foreign key) */
  quizid: number;

  /** Feedback text */
  feedbacktext: string;

  /** Format of feedback text */
  feedbacktextformat: number;

  /** Minimum grade for this feedback (inclusive) */
  mingrade: number;

  /** Maximum grade for this feedback (exclusive) */
  maxgrade: number;
}

/**
 * Quiz override interface - mirrors the quiz_overrides table
 * Per-user or per-group overrides to quiz settings
 */
export interface QuizOverride {
  /** Override ID (primary key) */
  id: number;

  /** Quiz ID (foreign key) */
  quiz: number;

  /** Group ID (null if user override) */
  groupid: number | null;

  /** User ID (null if group override) */
  userid: number | null;

  /** Override time open (null to use quiz default) */
  timeopen: number | null;

  /** Override time close (null to use quiz default) */
  timeclose: number | null;

  /** Override time limit (null to use quiz default) */
  timelimit: number | null;

  /** Override attempts limit (null to use quiz default) */
  attempts: number | null;

  /** Override password (null to use quiz default) */
  password: string | null;
}

/**
 * Quiz grade interface - mirrors the quiz_grades table
 * Overall grade for a user on a quiz
 */
export interface QuizGrade {
  /** Grade record ID (primary key) */
  id: number;

  /** Quiz ID (foreign key) */
  quiz: number;

  /** User ID (foreign key) */
  userid: number;

  /** Overall grade for this user */
  grade: number;

  /** When the grade was last modified (Unix timestamp) */
  timemodified: number;
}

// ============================================================================
// Question-Related Interfaces
// ============================================================================

/**
 * Question interface
 * Represents a question in a quiz
 */
export interface Question {
  /** Question ID */
  id: number;

  /** Question type */
  type: QuestionType | string;

  /** Question name */
  name: string;

  /** Question text */
  questiontext: string;

  /** Format of question text */
  questiontextformat?: number;

  /** Default mark for this question */
  defaultmark: number;

  /** Question-specific options (varies by question type) */
  options: QuestionOptions;

  /** Current state of this question in an attempt */
  state?: QuestionState;

  /** Mark received for this question */
  mark?: number | null;

  /** Maximum mark for this question */
  maxmark?: number;

  /** Fraction of max mark received (0-1) */
  fraction?: number | null;

  /** Whether the question is flagged */
  flagged?: boolean;

  /** Slot number this question occupies */
  slot?: number;

  /** Page number this question appears on */
  page?: number;

  /** Display number for this question */
  displaynumber?: string;

  /** Feedback for this question */
  feedback?: string;

  /** General feedback shown after attempt */
  generalfeedback?: string;

  /** Right answer (if allowed to be shown) */
  rightanswer?: string;

  /** Response given by student */
  response?: string | string[] | Record<string, string>;

  /** Response summary */
  responsesummary?: string;
}

/**
 * Question options base interface
 * Extended by specific question types
 */
export interface QuestionOptions {
  /** Question-specific configuration */
  [key: string]: unknown;

  /** Answers for this question (for multiple choice, etc.) */
  answers?: QuestionAnswer[];

  /** Whether to shuffle answer options */
  shuffleanswers?: boolean;

  /** Correct answer feedback */
  correctfeedback?: string;

  /** Partially correct answer feedback */
  partiallycorrectfeedback?: string;

  /** Incorrect answer feedback */
  incorrectfeedback?: string;

  /** Whether single answer or multiple answers */
  single?: boolean;

  /** Number format for numerical questions */
  unitsleft?: boolean;
}

/**
 * Question answer interface
 * Represents a possible answer for a question
 */
export interface QuestionAnswer {
  /** Answer ID */
  id: number;

  /** Answer text */
  answer: string;

  /** Format of answer text */
  answerformat?: number;

  /** Fraction of mark this answer receives (0-1 or negative) */
  fraction: number;

  /** Feedback for selecting this answer */
  feedback: string;

  /** Format of feedback text */
  feedbackformat?: number;
}

/**
 * Question attempt state during a quiz attempt
 */
export interface QuestionAttempt {
  /** Question attempt ID */
  id: number;

  /** Question usage ID */
  questionusageid: number;

  /** Slot number */
  slot: number;

  /** Question ID */
  questionid: number;

  /** Current state */
  state: QuestionState;

  /** Maximum mark */
  maxmark: number;

  /** Current mark */
  mark: number | null;

  /** Fraction of max mark (0-1) */
  fraction: number | null;

  /** Whether flagged by student */
  flagged: boolean;

  /** Time this question attempt was modified */
  timemodified: number;

  /** Response given */
  response: Record<string, string>;

  /** Response summary */
  responsesummary: string;
}

/**
 * Question display options
 * Controls what information is shown to the student
 */
export interface QuestionDisplayOptions {
  /** Whether to show marks */
  marks?: number;

  /** Whether to show correctness */
  correctness?: boolean;

  /** Whether to show max marks */
  maxmarks?: boolean;

  /** Whether to show specific feedback */
  feedback?: boolean;

  /** Whether to show general feedback */
  generalfeedback?: boolean;

  /** Whether to show right answer */
  rightanswer?: boolean;

  /** Whether the attempt can be edited */
  readonly?: boolean;

  /** Whether questions can be flagged */
  flags?: number;

  /** Whether student can navigate freely */
  navigation?: boolean;
}

/**
 * Question navigation state
 * Used for rendering navigation panel
 */
export interface QuestionNavigationState {
  /** Slot number */
  slot: number;

  /** Display number */
  number: string;

  /** Whether the question has been answered */
  answered: boolean;

  /** Whether the question is flagged */
  flagged: boolean;

  /** Page number */
  page: number;

  /** Whether this is the current question being viewed */
  isCurrentQuestion: boolean;

  /** Question state */
  state?: QuestionState;

  /** Whether navigation to this question is allowed */
  canNavigate?: boolean;
}

// ============================================================================
// Quiz Settings and Configuration
// ============================================================================

/**
 * Quiz settings interface
 * Based on quiz_settings PHP class - enhanced quiz data with computed properties
 */
export interface QuizSettings {
  /** The quiz entity */
  quiz: Quiz;

  /** Course module information */
  cm: CourseModule;

  /** Course information */
  course: Course;

  /** Context information */
  context: Context;

  /** Questions in this quiz with slot information */
  questions: Question[];

  /** Access manager configuration */
  accessmanager: AccessManager;

  /** User's attempts at this quiz */
  attempts: QuizAttempt[];

  /** Whether the current user can review their attempts */
  canreviewmine: boolean;

  /** Whether the current user can attempt the quiz */
  canattempt: boolean;

  /** Whether the current user can preview the quiz */
  canpreview: boolean;

  /** Number of attempts user has made */
  numattempts: number;

  /** User's best grade */
  bestgrade: number | null;

  /** Gradebook feedback for user */
  gradebookfeedback: string | null;

  /** User's overall quiz grade */
  userquizgrade: number | null;

  /** Whether user has an unfinished attempt */
  unfinished: boolean;

  /** ID of unfinished attempt (null if none) */
  unfinishedattemptid: number | null;
}

/**
 * Course module interface
 * Simplified representation of Moodle course module
 */
export interface CourseModule {
  /** Course module ID */
  id: number;

  /** Course ID */
  course: number;

  /** Module type */
  module: string;

  /** Instance ID */
  instance: number;

  /** Section ID */
  section: number;

  /** Whether module is visible */
  visible: boolean;

  /** Module name */
  name?: string;

  /** Availability conditions */
  availability?: string | null;
}

/**
 * Course interface
 * Simplified representation of Moodle course
 */
export interface Course {
  /** Course ID */
  id: number;

  /** Course full name */
  fullname: string;

  /** Course short name */
  shortname: string;

  /** Course category */
  category: number;

  /** Course start date */
  startdate: number;

  /** Course end date */
  enddate: number;
}

/**
 * Context interface
 * Represents Moodle context
 */
export interface Context {
  /** Context ID */
  id: number;

  /** Context level (system, course, module, etc.) */
  contextlevel: number;

  /** Instance ID */
  instanceid: number;

  /** Context path */
  path: string;
}

/**
 * Access manager interface
 * Controls access rules for quiz attempts
 */
export interface AccessManager {
  /** Quiz settings */
  quizobj: QuizSettings;

  /** Current time */
  timenow: number;

  /** Whether time limits are ignored */
  ignoretimelimits: boolean;

  /** Access rules preventing access */
  preventAccessReasons: string[];

  /** Whether new attempts are allowed */
  canAttempt: boolean;

  /** Whether preview is allowed */
  canPreview: boolean;

  /** Time when quiz opens */
  timeopen: number;

  /** Time when quiz closes */
  timeclose: number;

  /** Description of access restrictions */
  description: string[];
}

// ============================================================================
// Timer-Related Interfaces
// ============================================================================

/**
 * Quiz timer interface
 * Tracks time remaining during an attempt
 */
export interface QuizTimer {
  /** Time remaining in seconds */
  timeRemaining: number;

  /** Time limit in seconds (0 = no limit) */
  timeLimit: number;

  /** When the attempt started (Unix timestamp) */
  startTime: number;

  /** When the attempt must end (Unix timestamp, 0 = no limit) */
  endTime: number;

  /** Whether the timer is actively running */
  isRunning: boolean;

  /** Whether the timer is paused */
  isPaused: boolean;

  /** Whether the time has expired */
  isExpired: boolean;

  /** Formatted time string (e.g., "05:30") */
  formattedTime: string;

  /** Percentage of time remaining (0-100) */
  percentage: number;

  /** Whether in grace period */
  inGracePeriod?: boolean;

  /** Grace period end time (Unix timestamp) */
  gracePeriodEnd?: number;
}

// ============================================================================
// API Request/Response Interfaces
// ============================================================================

/**
 * Create attempt request
 * Request body for creating a new quiz attempt
 */
export interface CreateAttemptRequest {
  /** Quiz ID */
  quizId: number;

  /** Whether this is a preview attempt */
  preview?: boolean;

  /** Page to start on */
  page?: number;
}

/**
 * Submit answers request
 * Request body for submitting quiz answers
 */
export interface SubmitAnswersRequest {
  /** Attempt ID */
  attemptId: number;

  /** Answers keyed by slot number or question ID */
  answers: Record<string, string | string[] | number | boolean>;

  /** Whether to finish the attempt */
  finishattempt: boolean;

  /** Current page being submitted */
  currentpage?: number;

  /** Time remaining (for validation) */
  timeremaining?: number;
}

/**
 * Attempt summary
 * Summary information for review before submission
 */
export interface AttemptSummary {
  /** The attempt */
  attempt: QuizAttempt;

  /** Questions with answers */
  questions: Question[];

  /** Time remaining in seconds */
  timeremaining: number;

  /** Number of questions answered */
  answered: number;

  /** Number of questions flagged */
  flagged: number;

  /** Total number of questions */
  total: number;

  /** Warnings (e.g., unanswered questions) */
  warnings: string[];
}

/**
 * Attempt response
 * Response after submitting/finishing an attempt
 */
export interface AttemptResponse {
  /** The completed attempt */
  attempt: QuizAttempt;

  /** Grade received (null if not yet graded) */
  grade: number | null;

  /** Feedback text */
  feedback: string | null;

  /** Final state of attempt */
  state: QuizAttemptState;

  /** Time finished (Unix timestamp) */
  timefinish: number;

  /** Whether attempt can be reviewed */
  canreview: boolean;

  /** URL to review the attempt */
  reviewurl?: string;
}

/**
 * Quiz list response
 * Response for fetching list of quizzes
 */
export interface QuizListResponse {
  /** Array of quizzes */
  quizzes: Quiz[];

  /** Total count */
  total: number;

  /** Current page */
  page: number;

  /** Items per page */
  perPage: number;
}

/**
 * Quiz response
 * Response for fetching a single quiz
 */
export interface QuizResponse {
  /** The quiz */
  quiz: Quiz;

  /** Quiz settings */
  settings: QuizSettings;

  /** User's attempts */
  attempts: QuizAttempt[];

  /** Best grade */
  bestgrade: number | null;

  /** Whether user can attempt */
  canattempt: boolean;

  /** Access restrictions */
  accessrestrictions: string[];
}

/**
 * Attempts list response
 * Response for fetching user's attempts at a quiz
 */
export interface AttemptsListResponse {
  /** Array of attempts */
  attempts: QuizAttempt[];

  /** Total count */
  total: number;

  /** Quiz information */
  quiz: Quiz;
}

/**
 * Question page response
 * Response when navigating to a question page during attempt
 */
export interface QuestionPageResponse {
  /** Attempt information */
  attempt: QuizAttempt;

  /** Questions on this page */
  questions: Question[];

  /** Current page number */
  currentpage: number;

  /** Total number of pages */
  totalpages: number;

  /** Navigation state for all questions */
  navigation: QuestionNavigationState[];

  /** Display options */
  displayoptions: QuestionDisplayOptions;

  /** Timer information */
  timer: QuizTimer;
}

// ============================================================================
// Form and Filter Interfaces
// ============================================================================

/**
 * Quiz form data
 * Data structure for creating/editing quizzes
 */
export interface QuizFormData {
  /** Quiz name */
  name: string;

  /** Introduction text */
  intro: string;

  /** Time open */
  timeopen: number;

  /** Time close */
  timeclose: number;

  /** Time limit in seconds */
  timelimit: number;

  /** Overdue handling */
  overduehandling: OverdueHandling;

  /** Grace period */
  graceperiod: number;

  /** Question behavior */
  preferredbehaviour: string;

  /** Max attempts */
  attempts: number;

  /** Grade method */
  grademethod: GradeMethod;

  /** Quiz grade */
  grade: number;

  /** Questions per page */
  questionsperpage: number;

  /** Navigation method */
  navmethod: QuizNavMethod;

  /** Shuffle answers */
  shuffleanswers: boolean;

  /** Password */
  password: string;

  /** Review options */
  reviewoptions: ReviewOptions;
}

/**
 * Review options
 * Controls when students can review attempts
 */
export interface ReviewOptions {
  /** Show attempt */
  attempt: ReviewTimeOptions;

  /** Show correctness */
  correctness: ReviewTimeOptions;

  /** Show marks */
  marks: ReviewTimeOptions;

  /** Show specific feedback */
  specificfeedback: ReviewTimeOptions;

  /** Show general feedback */
  generalfeedback: ReviewTimeOptions;

  /** Show right answer */
  rightanswer: ReviewTimeOptions;

  /** Show overall feedback */
  overallfeedback: ReviewTimeOptions;
}

/**
 * Review time options
 * When review information is available
 */
export interface ReviewTimeOptions {
  /** During the attempt */
  during: boolean;

  /** Immediately after attempt (within 2 minutes) */
  immediately: boolean;

  /** After attempt is closed but quiz is still open */
  open: boolean;

  /** After quiz has closed */
  closed: boolean;
}

/**
 * Quiz filters
 * For filtering quiz lists
 */
export interface QuizFilters {
  /** Course ID */
  courseid?: number;

  /** Search query */
  search?: string;

  /** Only show open quizzes */
  onlyopen?: boolean;

  /** Only show quizzes with attempts */
  withattempts?: boolean;

  /** Sort field */
  sortby?: 'name' | 'timeopen' | 'timeclose' | 'grade';

  /** Sort direction */
  sortdirection?: 'asc' | 'desc';
}

/**
 * Quiz statistics
 * Statistical information about a quiz
 */
export interface QuizStatistics {
  /** Quiz ID */
  quizid: number;

  /** Number of attempts */
  attemptscount: number;

  /** Number of unique students */
  studentscount: number;

  /** Average grade */
  averagegrade: number;

  /** Median grade */
  mediangrade: number;

  /** Highest grade */
  highestgrade: number;

  /** Lowest grade */
  lowestgrade: number;

  /** Standard deviation */
  standarddeviation: number;

  /** Pass rate (percentage) */
  passrate: number;

  /** Average time taken (seconds) */
  averagetime: number;
}
