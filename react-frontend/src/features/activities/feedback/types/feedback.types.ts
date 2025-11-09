/**
 * TypeScript type definitions for the Feedback activity module.
 *
 * This file contains comprehensive type definitions for Moodle's Feedback module,
 * including types for feedback activities, items/questions, responses, values,
 * templates, and analysis data structures.
 *
 * @module feedback.types
 * @see public/mod/feedback/db/install.xml - Database schema
 * @see public/mod/feedback/lib.php - Core feedback functions
 * @see public/mod/feedback/item/feedback_item_class.php - Item class definitions
 * @see public/mod/feedback/analysis.php - Analysis functionality
 */

/**
 * Enumeration of all supported feedback question types.
 *
 * These types correspond to the 'typ' field in the feedback_item table
 * and determine how questions are rendered and responses are collected.
 */
export enum FeedbackQuestionType {
  /** Multiple choice question with single selection */
  MULTICHOICE = 'multichoice',

  /** Multiple choice question with rating scale */
  MULTICHOICERATED = 'multichoicerated',

  /** Numeric input question */
  NUMERIC = 'numeric',

  /** Multi-line text area for long answers */
  TEXTAREA = 'textarea',

  /** Single-line text field for short answers */
  TEXTFIELD = 'textfield',

  /** Informational text (non-question display item) */
  INFO = 'info',

  /** Label/heading for organizing questions */
  LABEL = 'label',

  /** Page break marker for multi-page feedback */
  PAGEBREAK = 'pagebreak',

  /** CAPTCHA verification */
  CAPTCHA = 'captcha',
}

/**
 * Main Feedback activity interface.
 *
 * Represents a feedback instance in a course, mapping to the 'feedback' table.
 * Contains all configuration and metadata for a feedback activity.
 */
export type Feedback = {
  /** Unique identifier for the feedback activity */
  id: number;

  /** Course ID where this feedback is located */
  course: number;

  /** Name/title of the feedback activity (max 1333 chars) */
  name: string;

  /** Introduction/description text */
  intro: string;

  /** Text format for intro field (0=MOODLE, 1=HTML, 2=PLAIN, 4=MARKDOWN) */
  introformat: number;

  /**
   * Anonymous submission mode:
   * 1 = FEEDBACK_ANONYMOUS_YES (anonymous responses)
   * 2 = FEEDBACK_ANONYMOUS_NO (identified responses)
   */
  anonymous: number;

  /** Whether to send email notifications (0=no, 1=yes) */
  email_notification: number;

  /** Allow multiple submissions from same user (0=no, 1=yes) */
  multiple_submit: number;

  /** Enable automatic question numbering (0=no, 1=yes) */
  autonumbering: number;

  /** URL to redirect to after submission (max 255 chars) */
  site_after_submit: string;

  /** HTML content to display after submission */
  page_after_submit: string;

  /** Text format for page_after_submit field */
  page_after_submitformat: number;

  /** Publish statistics to students (0=no, 1=yes) */
  publish_stats: number;

  /** Unix timestamp when feedback opens (0=always open) */
  timeopen: number;

  /** Unix timestamp when feedback closes (0=no deadline) */
  timeclose: number;

  /** Unix timestamp of last modification */
  timemodified: number;

  /** Mark activity complete on submission (0=no, 1=yes) */
  completionsubmit: number;
};

/**
 * Feedback item (question) interface.
 *
 * Represents a single question or display element within a feedback,
 * mapping to the 'feedback_item' table.
 */
export type FeedbackItem = {
  /** Unique identifier for the item */
  id: number;

  /** Parent feedback activity ID */
  feedback: number;

  /** Template ID if item is from a template (0 if not) */
  template: number;

  /** Question text or label (max 1333 chars) */
  name: string;

  /** Short label for the item (max 255 chars) */
  label: string;

  /** Item-specific configuration data (format varies by type) */
  presentation: string;

  /** Question type from FeedbackQuestionType enum */
  typ: FeedbackQuestionType;

  /** Whether this item has a value (0=no, 1=yes) */
  hasvalue: number;

  /** Display position/order in the feedback (1-based) */
  position: number;

  /** Whether response is required (0=optional, 1=required) */
  required: number;

  /** ID of item this depends on (0 if no dependency) */
  dependitem: number;

  /** Required value of dependent item to show this item */
  dependvalue: string;

  /** Additional options for the item (max 255 chars) */
  options: string;
};

/**
 * Completed feedback submission interface.
 *
 * Represents a completed feedback submission by a user,
 * mapping to the 'feedback_completed' table.
 */
export type FeedbackCompleted = {
  /** Unique identifier for the completed submission */
  id: number;

  /** Parent feedback activity ID */
  feedback: number;

  /** User ID who completed the feedback (0 for anonymous) */
  userid: number;

  /** Unix timestamp when submission was last modified */
  timemodified: number;

  /** Random response identifier for anonymous submissions */
  random_response: number;

  /** Flag indicating if this is an anonymous response (0=no, 1=yes) */
  anonymous_response: number;

  /** Course ID where feedback was completed */
  courseid: number;
};

/**
 * Temporary completed feedback submission interface.
 *
 * Used for in-progress submissions that haven't been finalized yet.
 * Maps to the 'feedback_completedtmp' table.
 */
export type FeedbackCompletedTmp = {
  /** Unique identifier */
  id: number;

  /** Parent feedback activity ID */
  feedback: number;

  /** User ID (0 for guests) */
  userid: number;

  /** Guest session identifier (max 255 chars) */
  guestid: string;

  /** Unix timestamp of last modification */
  timemodified: number;

  /** Random response identifier */
  random_response: number;

  /** Anonymous response flag (0=no, 1=yes) */
  anonymous_response: number;

  /** Course ID */
  courseid: number;
};

/**
 * Feedback response value interface.
 *
 * Stores the actual answer value for a single item in a completed feedback,
 * mapping to the 'feedback_value' table.
 */
export type FeedbackValue = {
  /** Unique identifier for the value */
  id: number;

  /** Course ID */
  course_id: number;

  /** Feedback item ID this value belongs to */
  item: number;

  /** Completed feedback submission ID (0 if temporary) */
  completed: number;

  /** Temporary completed submission ID (0 if finalized) */
  tmp_completed: number;

  /** The actual response value (text representation) */
  value: string;
};

/**
 * Feedback template interface.
 *
 * Represents a reusable template of feedback items,
 * mapping to the 'feedback_template' table.
 */
export type FeedbackTemplate = {
  /** Unique identifier for the template */
  id: number;

  /** Course ID (0 for site-wide templates) */
  course: number;

  /** Whether template is public (0=no, 1=yes) */
  ispublic: number;

  /** Template name (max 255 chars) */
  name: string;
};

/**
 * Site-course mapping interface.
 *
 * Maps site-wide feedbacks to specific courses,
 * mapping to the 'feedback_sitecourse_map' table.
 */
export type FeedbackSiteCourseMap = {
  /** Unique identifier */
  id: number;

  /** Feedback activity ID */
  feedbackid: number;

  /** Course ID */
  courseid: number;
};

/**
 * Comprehensive feedback analysis data structure.
 *
 * Contains aggregated analysis data for an entire feedback activity,
 * including response counts, statistics, and per-item analysis.
 */
export type FeedbackAnalysis = {
  /** Feedback activity ID */
  feedbackId: number;

  /** Total number of completed responses */
  totalResponses: number;

  /** Number of completed responses in the selected group (if applicable) */
  groupResponses?: number;

  /** Group ID for filtered analysis (undefined for all responses) */
  groupId?: number;

  /** Whether responses meet minimum count for anonymous display */
  meetAnonymousThreshold: boolean;

  /** Individual item analysis data */
  items: FeedbackItemAnalysis[];

  /** Overall statistics */
  statistics: FeedbackStatistics;

  /** Timestamp when analysis was generated */
  generatedAt: number;
};

/**
 * Analysis data for a single feedback item.
 *
 * Contains response distribution, statistics, and visualization data
 * for an individual question in the feedback.
 */
export type FeedbackItemAnalysis = {
  /** Item ID */
  itemId: number;

  /** Item name/question text */
  name: string;

  /** Question type */
  type: FeedbackQuestionType;

  /** Item position in feedback */
  position: number;

  /** Whether item has a value (is answerable) */
  hasValue: boolean;

  /** Number of responses for this item */
  responseCount: number;

  /** Response distribution by value (for choice questions) */
  distribution?: Array<{
    value: string;
    count: number;
    percentage: number;
  }>;

  /** Statistical measures (for numeric questions) */
  statistics?: {
    mean: number;
    median: number;
    mode: number;
    standardDeviation: number;
    minimum: number;
    maximum: number;
  };

  /** Text responses (for text questions) */
  textResponses?: string[];

  /** Chart data for visualization */
  chartData?: {
    labels: string[];
    values: number[];
    colors: string[];
  };
};

/**
 * Combined feedback response interface.
 *
 * Represents a complete user submission with all item values,
 * combining data from feedback_completed and feedback_value tables.
 */
export type FeedbackResponse = {
  /** Completion record */
  completed: FeedbackCompleted;

  /** Array of response values for each item */
  values: Array<{
    itemId: number;
    value: string;
  }>;

  /** Whether this is an in-progress (temporary) submission */
  isTemporary: boolean;

  /** Current page number for multi-page feedback */
  currentPage?: number;
};

/**
 * Item presentation configuration interface.
 *
 * Defines the structure of the 'presentation' field for different item types.
 * The presentation format varies by question type.
 */
export type FeedbackItemPresentation = {
  /** Presentation type identifier */
  type: FeedbackQuestionType;

  /** Configuration for multichoice questions */
  multichoice?: {
    /** Display as radio buttons ('r') or dropdown ('d') */
    subtype: 'r' | 'd';
    /** Whether to randomize options */
    randomize: boolean;
    /** Whether to hide the "Not selected" option */
    hideNotSelected: boolean;
    /** Whether to ignore empty values in analysis */
    ignoreEmpty: boolean;
    /** Array of choice options */
    options: string[];
  };

  /** Configuration for multichoicerated questions */
  multichoicerated?: {
    /** Display as radio buttons ('r') or dropdown ('d') */
    subtype: 'r' | 'd';
    /** Array of rated options with values */
    options: Array<{
      text: string;
      value: number;
    }>;
  };

  /** Configuration for numeric questions */
  numeric?: {
    /** Minimum allowed value */
    rangeFrom: number;
    /** Maximum allowed value */
    rangeTo: number;
  };

  /** Configuration for text questions */
  text?: {
    /** Width in characters for textfield */
    width?: number;
    /** Maximum character length */
    maxLength?: number;
    /** Number of rows for textarea */
    rows?: number;
  };

  /** Configuration for info/label items */
  info?: {
    /** HTML content to display */
    content: string;
  };
};

/**
 * Overall feedback statistics.
 *
 * Aggregated statistics across all responses for a feedback activity.
 */
export type FeedbackStatistics = {
  /** Total number of responses submitted */
  totalResponses: number;

  /** Completion rate as percentage (0-100) */
  completionRate: number;

  /** Average time to complete in seconds */
  averageTime: number;

  /** Response counts by course */
  responsesByCourse: CourseResponseCount[];

  /** Response counts by group */
  responsesByGroup: GroupResponseCount[];

  /** List of user IDs who have responded */
  respondents: number[];

  /** List of user IDs who have not responded */
  nonRespondents: number[];

  /** Timestamp of most recent submission */
  lastSubmissionDate: number;
};

/**
 * Course response count data.
 *
 * Number of responses from a specific course (for site-wide feedbacks).
 */
export type CourseResponseCount = {
  /** Course ID */
  courseId: number;

  /** Course name */
  courseName: string;

  /** Number of responses from this course */
  count: number;
};

/**
 * Group response count data.
 *
 * Number of responses from a specific group within a course.
 */
export type GroupResponseCount = {
  /** Group ID */
  groupId: number;

  /** Group name */
  groupName: string;

  /** Number of responses from this group */
  count: number;
};

/**
 * Options for submitting a feedback response.
 *
 * Used when finalizing a feedback submission via API.
 */
export type SubmitResponseOptions = {
  /** Feedback activity ID */
  feedbackId: number;

  /** Response values for each item */
  responses: Array<{
    itemId: number;
    value: string | number | boolean;
  }>;

  /** Whether to submit anonymously (if allowed) */
  anonymous?: boolean;

  /** Target page to navigate to after submission (for multi-page) */
  goToPage?: number;
};

/**
 * Options for saving progress on a feedback.
 *
 * Used when saving temporary/in-progress feedback submissions.
 */
export type SaveProgressOptions = {
  /** Feedback activity ID */
  feedbackId: number;

  /** Response values collected so far */
  responses: Array<{
    itemId: number;
    value: string | number | boolean;
  }>;

  /** Current page number being worked on */
  currentPage: number;
};

/**
 * Feedback display configuration.
 *
 * Client-side configuration for rendering a feedback activity.
 */
export type FeedbackDisplayConfig = {
  /** Whether to show question numbers */
  showNumbering: boolean;

  /** Whether to show progress bar */
  showProgress: boolean;

  /** Whether to allow navigation between pages */
  allowNavigation: boolean;

  /** Whether to show "Save draft" button */
  allowSaveDraft: boolean;

  /** Current page being displayed (1-based) */
  currentPage: number;

  /** Total number of pages */
  totalPages: number;
};

/**
 * Feedback permissions interface.
 *
 * Tracks what actions the current user can perform on a feedback activity.
 */
export type FeedbackPermissions = {
  /** Can view the feedback activity */
  canView: boolean;

  /** Can complete/submit the feedback */
  canComplete: boolean;

  /** Can view own responses */
  canViewOwnResponses: boolean;

  /** Can view analysis/reports */
  canViewAnalysis: boolean;

  /** Can view all responses (teacher capability) */
  canViewResponses: boolean;

  /** Can delete responses */
  canDeleteResponses: boolean;

  /** Can edit feedback structure */
  canEdit: boolean;

  /** Can manage templates */
  canManageTemplates: boolean;
};

/**
 * Validation result for a feedback item response.
 *
 * Used to validate user input before submission.
 */
export type FeedbackItemValidation = {
  /** Item ID being validated */
  itemId: number;

  /** Whether the response is valid */
  isValid: boolean;

  /** Validation error message (if invalid) */
  errorMessage?: string;

  /** Field-specific validation details */
  errors?: {
    required?: boolean;
    format?: boolean;
    range?: boolean;
    maxLength?: boolean;
  };
};

/**
 * Feedback export options.
 *
 * Configuration for exporting feedback responses to Excel or other formats.
 */
export type FeedbackExportOptions = {
  /** Feedback activity ID */
  feedbackId: number;

  /** Export format ('excel' | 'csv' | 'pdf') */
  format: 'excel' | 'csv' | 'pdf';

  /** Group ID to filter by (undefined for all) */
  groupId?: number;

  /** Whether to include item labels */
  includeLabels: boolean;

  /** Whether to anonymize responses */
  anonymize: boolean;

  /** Date range filter */
  dateRange?: {
    from: number;
    to: number;
  };
};

/**
 * Feedback list filter options.
 *
 * Used for filtering feedback activities in lists and searches.
 */
export type FeedbackListFilter = {
  /** Course ID filter */
  courseId?: number;

  /** Search term for name/intro */
  searchTerm?: string;

  /** Filter by completion status */
  completionStatus?: 'all' | 'completed' | 'not_completed';

  /** Filter by availability */
  availability?: 'all' | 'open' | 'closed' | 'upcoming';

  /** Filter by anonymous mode */
  anonymousMode?: 'all' | 'anonymous' | 'identified';

  /** Sort field */
  sortBy?: 'name' | 'timemodified' | 'timeopen' | 'timeclose';

  /** Sort direction */
  sortDirection?: 'asc' | 'desc';

  /** Pagination offset */
  offset?: number;

  /** Pagination limit */
  limit?: number;
};

/**
 * Paginated feedback list result.
 *
 * Response structure for feedback list queries with pagination.
 */
export type FeedbackListResult = {
  /** Array of feedback activities */
  feedbacks: Feedback[];

  /** Total count (before pagination) */
  total: number;

  /** Current offset */
  offset: number;

  /** Items per page */
  limit: number;

  /** Whether there are more results */
  hasMore: boolean;
};

/**
 * Group mode constants from Moodle.
 *
 * Defines how groups are used in activities:
 * - NOGROUPS: No groups used
 * - SEPARATEGROUPS: Students can only see their own group
 * - VISIBLEGROUPS: Students can see all groups but work in their own
 */
export enum GroupMode {
  /** No groups are used in this activity */
  NOGROUPS = 0,
  /** Separate groups - students only see their own group */
  SEPARATEGROUPS = 1,
  /** Visible groups - students see all groups but work in their own */
  VISIBLEGROUPS = 2,
}

/**
 * Group data structure matching Moodle's group object.
 *
 * Represents a course group with all Moodle-specific fields.
 * Used for filtering feedback responses and other group-based operations.
 */
export interface Group {
  /** Unique group identifier */
  id: number;
  /** Group name */
  name: string;
  /** Course ID this group belongs to */
  courseid: number;
  /** Optional group description */
  description?: string;
  /** Text format for description field */
  descriptionformat?: number;
  /** Optional enrollment key for self-enrollment */
  enrolmentkey?: string;
  /** Group picture file ID */
  picture?: number;
  /** Whether to hide the group picture */
  hidepicture?: number;
  /** Unix timestamp when group was created */
  timecreated?: number;
  /** Unix timestamp when group was last modified */
  timemodified?: number;
}

/**
 * Props for the GroupFilter component.
 *
 * Defines the interface for the group filter dropdown component
 * used in feedback analysis and response viewing.
 */
export interface GroupFilterProps {
  /**
   * Array of available groups for filtering
   */
  groups: Group[];

  /**
   * Currently selected group ID
   * 0 means "All participants"
   * -1 means no selection (loading or error state)
   */
  selectedGroupId: number;

  /**
   * Callback fired when group selection changes
   */
  onChange: (groupId: number) => void;

  /**
   * Whether groups are currently being loaded
   */
  isLoading?: boolean;

  /**
   * Error message if groups failed to load
   */
  error?: string | null;

  /**
   * Group mode for the activity
   * Determines label text and visibility options
   */
  groupMode?: GroupMode;

  /**
   * Whether to show "All participants" option
   * Depends on group mode and user capabilities
   */
  showAllParticipants?: boolean;

  /**
   * Optional label override
   */
  label?: string;

  /**
   * Whether the select is disabled
   */
  disabled?: boolean;

  /**
   * Optional CSS class name
   */
  className?: string;

  /**
   * Whether to show the groups icon
   */
  showIcon?: boolean;

  /**
   * Size variant of the select component
   */
  size?: 'small' | 'medium';

  /**
   * Optional grouping name to display with label
   */
  groupingName?: string;
}
