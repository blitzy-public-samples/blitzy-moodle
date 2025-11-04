/**
 * Comprehensive TypeScript type definitions for the Moodle Lesson activity module
 * 
 * This file provides complete type safety for lesson activities including:
 * - Lesson configuration with all display and grading options
 * - Page structures with various question types and branch tables
 * - Attempt tracking with retry support
 * - Progress monitoring and timer management
 * - Answer options with conditional navigation jumps
 * - Override configurations for groups and users
 * 
 * Based on Moodle lesson database schema:
 * - lesson, lesson_pages, lesson_answers, lesson_attempts
 * - lesson_grades, lesson_timer, lesson_branch, lesson_overrides
 * 
 * @package react-frontend
 * @module features/activities/lesson/types
 */

/**
 * Question Types for Lesson Pages
 * Maps to Moodle LESSON_PAGE_* constants
 */
export enum QuestionType {
  /** Short answer question (qtype = 1) */
  SHORTANSWER = 1,
  
  /** True/False question (qtype = 2) */
  TRUEFALSE = 2,
  
  /** Multiple choice question (qtype = 3) */
  MULTICHOICE = 3,
  
  /** Matching question (qtype = 5) */
  MATCHING = 5,
  
  /** Numerical question (qtype = 8) */
  NUMERICAL = 8,
  
  /** Essay question (qtype = 10) */
  ESSAY = 10,
  
  /** Branch table - structural page (qtype = 20) */
  BRANCHTABLE = 20,
  
  /** End of branch marker (qtype = 21) */
  ENDOFBRANCH = 21,
  
  /** Start of cluster (qtype = 30) */
  CLUSTER = 30,
  
  /** End of cluster marker (qtype = 31) */
  ENDOFCLUSTER = 31,
}

/**
 * Page Type Categories
 * Distinguishes between structural and question pages
 */
export enum PageType {
  /** Structural pages (branch tables, clusters, end markers) */
  TYPE_STRUCTURE = 'structure',
  
  /** Question pages (all question types) */
  TYPE_QUESTION = 'question',
}

/**
 * Navigation Constants for Conditional Jumps
 * Maps to Moodle LESSON_* navigation constants
 */
export enum NavigationConstant {
  /** Stay on this page (jumpto = 0) */
  THISPAGE = 0,
  
  /** Next unseen page (jumpto = 1) */
  UNSEENPAGE = 1,
  
  /** Next unanswered page (jumpto = 2) */
  UNANSWEREDPAGE = 2,
  
  /** Jump to next page (jumpto = -1) */
  NEXTPAGE = -1,
  
  /** End of lesson (jumpto = -9) */
  EOL = -9,
  
  /** Jump to previous page (jumpto = -40) */
  PREVIOUSPAGE = -40,
  
  /** Unseen branch page (jumpto = -50) */
  UNSEENBRANCHPAGE = -50,
  
  /** Random page within branch (jumpto = -60) */
  RANDOMPAGE = -60,
  
  /** Random branch (jumpto = -70) */
  RANDOMBRANCH = -70,
  
  /** Cluster jump (jumpto = -80) */
  CLUSTERJUMP = -80,
  
  /** Undefined/not set (jumpto = -99) */
  UNDEFINED = -99,
}

/**
 * Lesson Entity
 * Represents the main lesson configuration with all settings
 * Maps to the 'lesson' database table
 */
export interface Lesson {
  /** Unique identifier */
  id: number;
  
  /** Course ID this lesson belongs to */
  course: number;
  
  /** Lesson name/title (max 1333 characters) */
  name: string;
  
  /** Introduction text */
  intro?: string;
  
  /** Introduction text format (0=HTML, 1=Plain, etc.) */
  introformat: number;
  
  /** Practice mode flag (0=graded, 1=practice) */
  practice: number;
  
  /** Allow students to re-take lesson (0=no, 1=yes) */
  modattempts: number;
  
  /** Require password to access (0=no, 1=yes) */
  usepassword: number;
  
  /** Password for lesson access (max 32 characters) */
  password: string;
  
  /** ID of another lesson that must be completed first */
  dependency: number;
  
  /** JSON conditions for dependency */
  conditions: string;
  
  /** Maximum grade for the lesson */
  grade: number;
  
  /** Custom scoring flag (0=default, 1=custom) */
  custom: number;
  
  /** Ongoing score display (0=no, 1=yes) */
  ongoing: number;
  
  /** Use maximum grade achieved (0=average, 1=max) */
  usemaxgrade: number;
  
  /** Maximum number of answer options per page */
  maxanswers: number;
  
  /** Maximum number of attempts per question */
  maxattempts: number;
  
  /** Allow review flag (0=no, 1=yes) */
  review: number;
  
  /** Default next page action (0=this page, 1=next unseen, etc.) */
  nextpagedefault: number;
  
  /** Display feedback flag (0=no, 1=yes) */
  feedback: number;
  
  /** Minimum number of questions */
  minquestions: number;
  
  /** Maximum number of pages to display */
  maxpages: number;
  
  /** Time limit in seconds (0=no limit) */
  timelimit: number;
  
  /** Allow retaking lesson (0=no, 1=yes) */
  retake: number;
  
  /** Activity to link to after completion */
  activitylink: number;
  
  /** Path to media file or external URL (max 255 characters) */
  mediafile: string;
  
  /** Media player height in pixels */
  mediaheight: number;
  
  /** Media player width in pixels */
  mediawidth: number;
  
  /** Show media close button (0=no, 1=yes) */
  mediaclose: number;
  
  /** Enable slideshow mode (0=no, 1=yes) */
  slideshow: number;
  
  /** Slideshow width in pixels */
  width: number;
  
  /** Slideshow height in pixels */
  height: number;
  
  /** Background color for slideshow (hex format) */
  bgcolor: string;
  
  /** Display left menu (0=no, 1=yes) */
  displayleft: number;
  
  /** Display left menu only if (0=always, 1=if score above) */
  displayleftif: number;
  
  /** Show progress bar (0=no, 1=yes) */
  progressbar: number;
  
  /** Timestamp when lesson becomes available (0=immediately) */
  available: number;
  
  /** Timestamp for lesson deadline (0=no deadline) */
  deadline: number;
  
  /** Timestamp of last modification */
  timemodified: number;
  
  /** Completion requires reaching end (0=no, 1=yes) */
  completionendreached: number;
  
  /** Completion requires time spent (in seconds, 0=no requirement) */
  completiontimespent: number;
  
  /** Allow offline attempts in mobile app (0=no, 1=yes) */
  allowofflineattempts?: number;
}

/**
 * Lesson Page Entity
 * Represents a single page within a lesson (question or structural)
 * Maps to the 'lesson_pages' database table
 */
export interface LessonPage {
  /** Unique identifier */
  id: number;
  
  /** Parent lesson ID */
  lessonid: number;
  
  /** Previous page ID in sequence (0=first page) */
  prevpageid: number;
  
  /** Next page ID in sequence (0=last page) */
  nextpageid: number;
  
  /** Question type (see QuestionType enum) */
  qtype: QuestionType;
  
  /** Question options/flags (format depends on qtype) */
  qoption: number;
  
  /** Page layout option (1=standard, other values depend on qtype) */
  layout: number;
  
  /** Display options (1=standard, other values depend on qtype) */
  display: number;
  
  /** Timestamp when page was created */
  timecreated: number;
  
  /** Timestamp when page was last modified */
  timemodified: number;
  
  /** Page title (max 255 characters) */
  title: string;
  
  /** Page content/question text */
  contents: string;
  
  /** Content text format (0=HTML, 1=Plain, etc.) */
  contentsformat: number;
  
  /** Array of answer options for this page */
  answers?: Answer[];
}

/**
 * Answer Entity
 * Represents an answer option for a lesson page with jump navigation
 * Maps to the 'lesson_answers' database table
 */
export interface Answer {
  /** Unique identifier */
  id: number;
  
  /** Parent lesson ID */
  lessonid: number;
  
  /** Parent page ID */
  pageid: number;
  
  /** Navigation target after selecting this answer
   * Can be a page ID or a NavigationConstant value
   */
  jumpto: number;
  
  /** Whether answer is correct (0=incorrect, 1=correct) */
  grade: number;
  
  /** Score value for this answer */
  score: number;
  
  /** Answer flags/options */
  flags: number;
  
  /** Timestamp when answer was created */
  timecreated: number;
  
  /** Timestamp when answer was last modified */
  timemodified: number;
  
  /** Answer text/content */
  answer?: string;
  
  /** Answer text format (0=HTML, 1=Plain, etc.) */
  answerformat: number;
  
  /** Response/feedback text for this answer */
  response?: string;
  
  /** Response text format (0=HTML, 1=Plain, etc.) */
  responseformat: number;
}

/**
 * Lesson Attempt Entity
 * Tracks a student's attempt at a specific lesson page
 * Maps to the 'lesson_attempts' database table
 */
export interface LessonAttempt {
  /** Unique identifier */
  id: number;
  
  /** Parent lesson ID */
  lessonid: number;
  
  /** User ID who made the attempt */
  userid: number;
  
  /** Page ID that was attempted */
  pageid: number;
  
  /** Retry/attempt number (0=first attempt, 1=second, etc.) */
  retry: number;
  
  /** Whether answer was correct (0=incorrect, 1=correct, other values for partial credit) */
  correct: number;
  
  /** User's answer(s) as text/JSON */
  useranswers?: string;
  
  /** Grade/score received for this attempt */
  grade?: number;
  
  /** Whether attempt is completed (0=in progress, 1=completed) */
  completed?: number;
  
  /** Timestamp when attempt was created */
  timecreated?: number;
  
  /** Timestamp when attempt was last modified */
  timemodified?: number;
  
  /** Answer ID that was selected */
  answerid?: number;
  
  /** Timestamp when page was seen */
  timeseen?: number;
}

/**
 * Lesson Progress Tracking
 * Client-side interface for tracking student progress through a lesson
 */
export interface LessonProgress {
  /** Array of page IDs that have been visited */
  visitedPages: number[];
  
  /** Current page ID being viewed */
  currentPageId: number;
  
  /** Progress percentage (0-100) */
  progressPercentage: number;
  
  /** Number of pages completed */
  pagesCompleted: number;
  
  /** Total number of pages in lesson */
  totalPages: number;
  
  /** Total time spent in lesson (seconds) */
  timeSpent: number;
  
  /** Current score/grade */
  score: number;
  
  /** Current attempt ID */
  attemptId?: number;
  
  /** Whether lesson is completed */
  isCompleted: boolean;
}

/**
 * Lesson Grade Entity
 * Stores the final grade for a student's lesson completion
 * Maps to the 'lesson_grades' database table
 */
export interface LessonGrade {
  /** Unique identifier */
  id: number;
  
  /** Parent lesson ID */
  lessonid: number;
  
  /** User ID who received the grade */
  userid: number;
  
  /** Final grade value */
  grade: number;
  
  /** Whether submission was late (0=on time, 1=late) */
  late: number;
  
  /** Timestamp when lesson was completed */
  completed: number;
}

/**
 * Lesson Timer Entity
 * Tracks timing information for student attempts
 * Maps to the 'lesson_timer' database table
 */
export interface LessonTimer {
  /** Unique identifier */
  id: number;
  
  /** Parent lesson ID */
  lessonid: number;
  
  /** User ID being timed */
  userid: number;
  
  /** Timestamp when timer started */
  starttime: number;
  
  /** Total time spent in lesson (seconds) */
  lessontime: number;
  
  /** Whether lesson is completed (0=in progress, 1=completed) */
  completed: number;
  
  /** Timestamp when timer was last modified */
  timemodified?: number;
  
  /** Last modified time via mobile app web services */
  timemodifiedoffline?: number;
}

/**
 * Lesson Branch Entity
 * Tracks branch navigation for students
 * Maps to the 'lesson_branch' database table
 */
export interface LessonBranch {
  /** Unique identifier */
  id: number;
  
  /** Parent lesson ID */
  lessonid: number;
  
  /** User ID who took the branch */
  userid: number;
  
  /** Page ID where branch occurred */
  pageid: number;
  
  /** Retry/attempt number */
  retry: number;
  
  /** Branch flag/status */
  flag: number;
  
  /** Timestamp when branch was taken */
  timeseen: number;
  
  /** Next page ID in branch sequence */
  nextpageid: number;
}

/**
 * Lesson Override Entity
 * Stores per-user or per-group overrides for lesson settings
 * Maps to the 'lesson_overrides' database table
 */
export interface LessonOverride {
  /** Unique identifier */
  id: number;
  
  /** Parent lesson ID */
  lessonid: number;
  
  /** Group ID for group override (null for user override) */
  groupid?: number | null;
  
  /** User ID for user override (null for group override) */
  userid?: number | null;
  
  /** Override available date (null to use lesson default) */
  available?: number | null;
  
  /** Override deadline (null to use lesson default) */
  deadline?: number | null;
  
  /** Override time limit in seconds (null to use lesson default) */
  timelimit?: number | null;
  
  /** Override review setting (null to use lesson default) */
  review?: number | null;
  
  /** Override max attempts (null to use lesson default) */
  maxattempts?: number | null;
  
  /** Override retake setting (null to use lesson default) */
  retake?: number | null;
  
  /** Override password (null to use lesson default) */
  password?: string | null;
}

/**
 * Question Configuration Options
 * Type-specific configuration for different question types
 */
export interface QuestionOptions {
  /** For multichoice: whether answer is case-sensitive */
  caseSensitive?: boolean;
  
  /** For multichoice: whether to shuffle answers */
  shuffleAnswers?: boolean;
  
  /** For multichoice: whether multiple answers are allowed */
  multipleAnswers?: boolean;
  
  /** For numerical: tolerance for correct answer */
  tolerance?: number;
  
  /** For matching: whether order matters */
  orderMatters?: boolean;
  
  /** For essay: minimum word count */
  minWords?: number;
  
  /** For essay: maximum word count */
  maxWords?: number;
}

/**
 * Display Settings
 * Settings for how lesson content is displayed
 */
export interface DisplaySettings {
  /** Show left menu */
  showMenu: boolean;
  
  /** Show progress bar */
  showProgress: boolean;
  
  /** Enable slideshow mode */
  slideshow: boolean;
  
  /** Display feedback */
  showFeedback: boolean;
  
  /** Display ongoing score */
  showOngoingScore: boolean;
  
  /** Allow review */
  allowReview: boolean;
}

/**
 * Lesson Statistics
 * Aggregated statistics for a lesson
 */
export interface LessonStatistics {
  /** Total number of attempts */
  totalAttempts: number;
  
  /** Number of completed attempts */
  completedAttempts: number;
  
  /** Average grade */
  averageGrade: number;
  
  /** Highest grade */
  highestGrade: number;
  
  /** Lowest grade */
  lowestGrade: number;
  
  /** Average time spent (seconds) */
  averageTime: number;
  
  /** Number of students who attempted */
  studentsAttempted: number;
  
  /** Number of students who completed */
  studentsCompleted: number;
}

/**
 * Lesson Navigation State
 * Client-side state for lesson navigation
 */
export interface LessonNavigationState {
  /** Current page */
  currentPage: LessonPage;
  
  /** Previous page (if exists) */
  previousPage?: LessonPage;
  
  /** Next page (if exists) */
  nextPage?: LessonPage;
  
  /** Can navigate back */
  canGoBack: boolean;
  
  /** Can navigate forward */
  canGoForward: boolean;
  
  /** Current page index in sequence */
  currentPageIndex: number;
  
  /** Total pages in lesson */
  totalPages: number;
  
  /** Pages available for navigation */
  availablePages: LessonPage[];
}
