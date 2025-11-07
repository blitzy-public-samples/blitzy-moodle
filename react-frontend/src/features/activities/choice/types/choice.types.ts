/**
 * TypeScript type definitions for the Choice activity module.
 *
 * These types define the data structures used throughout the Choice activity feature
 * for type-safe interaction with the Choice API endpoints and UI components.
 *
 * Based on Moodle's choice module database schema and PHP structures from:
 * - public/mod/choice/lib.php (constants and core functions)
 * - public/mod/choice/db/install.xml (database schema)
 * - public/mod/choice/classes/external.php (API return structures)
 *
 * @package   mod_choice
 * @copyright 2024 Moodle React Frontend
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Publish mode for choice results.
 * Determines whether user names are shown in results.
 *
 * Based on constants from public/mod/choice/lib.php lines 25-26:
 * - CHOICE_PUBLISH_ANONYMOUS = '0'
 * - CHOICE_PUBLISH_NAMES = '1'
 */
export enum PublishMode {
  /** Results are shown anonymously without user names */
  ANONYMOUS = 0,
  /** Results are shown with user names */
  NAMES = 1,
}

/**
 * When to show choice results to students.
 *
 * Based on constants from public/mod/choice/lib.php lines 28-31:
 * - CHOICE_SHOWRESULTS_NOT = '0'
 * - CHOICE_SHOWRESULTS_AFTER_ANSWER = '1'
 * - CHOICE_SHOWRESULTS_AFTER_CLOSE = '2'
 * - CHOICE_SHOWRESULTS_ALWAYS = '3'
 */
export enum ShowResultsMode {
  /** Do not show results to students */
  NOT = 0,
  /** Show results to students after they answer */
  AFTER_ANSWER = 1,
  /** Show results to students only after the choice is closed */
  AFTER_CLOSE = 2,
  /** Always show results to students */
  ALWAYS = 3,
}

/**
 * Display mode for choice options.
 *
 * Based on constants from public/mod/choice/lib.php lines 33-34:
 * - CHOICE_DISPLAY_HORIZONTAL = '0'
 * - CHOICE_DISPLAY_VERTICAL = '1'
 */
export enum DisplayMode {
  /** Display options horizontally */
  HORIZONTAL = 0,
  /** Display options vertically */
  VERTICAL = 1,
}

/**
 * Main Choice activity interface.
 *
 * Based on the choice table schema from public/mod/choice/db/install.xml lines 7-35.
 * Represents a choice activity instance with all configuration settings.
 */
export interface Choice {
  /** Unique identifier for the choice activity */
  id: number;

  /** Course ID that this choice belongs to */
  course: number;

  /** Name/title of the choice activity (max 1333 characters) */
  name: string;

  /** Introduction/description text for the choice activity */
  intro: string;

  /** Format of the intro text (0=Moodle, 1=HTML, 2=Plain, 4=Markdown) */
  introformat: number;

  /** How to publish results (0=anonymous, 1=with names) */
  publish: PublishMode;

  /** When to show results (0=not, 1=after answer, 2=after close, 3=always) */
  showresults: ShowResultsMode;

  /** Display mode for options (0=horizontal, 1=vertical) */
  display: DisplayMode;

  /** Whether students can update their choice (0=no, 1=yes) */
  allowupdate: boolean;

  /** Whether students can select multiple options (0=no, 1=yes) */
  allowmultiple: boolean;

  /** Whether to show users who haven't answered (0=no, 1=yes) */
  showunanswered: boolean;

  /** Whether to include inactive users in results (0=no, 1=yes) */
  includeinactive: boolean;

  /** Whether to limit the number of responses per option (0=no, 1=yes) */
  limitanswers: boolean;

  /** Timestamp when the choice opens (0=no restriction) */
  timeopen: number;

  /** Timestamp when the choice closes (0=no restriction) */
  timeclose: number;

  /** Whether to show preview before choice opens (0=no, 1=yes) */
  showpreview: boolean;

  /** Timestamp of last modification */
  timemodified: number;

  /** Whether submitting marks activity as complete (0=no, 1=yes) */
  completionsubmit: boolean;

  /** Whether to show available spaces (0=no, 1=yes) */
  showavailable: boolean;

  /** Array of choice options available for this choice */
  options?: ChoiceOption[];
}

/**
 * Choice option interface.
 *
 * Based on the choice_options table schema from public/mod/choice/db/install.xml lines 36-48.
 * Represents a single option within a choice activity that users can select.
 */
export interface ChoiceOption {
  /** Unique identifier for this option */
  id: number;

  /** ID of the choice activity this option belongs to */
  choiceid: number;

  /** Text content of this option */
  text: string;

  /** Maximum number of users who can select this option (0=unlimited) */
  maxanswers: number;

  /** Current count of users who have selected this option */
  countanswers: number;

  /** Timestamp of last modification */
  timemodified: number;
}

/**
 * User response to a choice activity.
 *
 * Based on the choice_answers table schema from public/mod/choice/db/install.xml lines 49-65.
 * Represents a single user's answer to a choice question.
 */
export interface ChoiceResponse {
  /** Unique identifier for this response */
  id: number;

  /** ID of the choice activity */
  choiceid: number;

  /** ID of the user who made this response */
  userid: number;

  /** ID of the selected option */
  optionid: number;

  /** Timestamp when this response was submitted/modified */
  timemodified: number;
}

/**
 * User response information within choice results.
 *
 * Based on the userresponses structure from public/mod/choice/classes/external.php lines 177-186.
 * Used when displaying results with user information.
 */
export interface UserResponse {
  /** User ID */
  userid: number;

  /** Full name of the user */
  fullname: string;

  /** URL to the user's profile image */
  profileimageurl: string;

  /** Answer ID (optional, present when available) */
  answerid?: number;

  /** Timestamp when the response was modified (optional) */
  timemodified?: number;
}

/**
 * Option results with user responses and statistics.
 *
 * Based on the options structure from public/mod/choice/classes/external.php lines 146-152.
 * Used in the get_choice_results API endpoint return value.
 */
export interface ChoiceOptionResult {
  /** Option ID */
  id: number;

  /** Text content of the option */
  text: string;

  /** Maximum number of answers allowed for this option */
  maxanswer: number;

  /** Array of user responses for this option (empty if anonymous or no permission) */
  userresponses: UserResponse[];

  /** Number of users who selected this option */
  numberofuser: number;

  /** Percentage of total users who selected this option */
  percentageamount: number;
}

/**
 * Complete choice results data structure.
 *
 * Based on the return structure from public/mod/choice/classes/external.php lines 156-159
 * and the get_choice_results_returns definition on lines 168-196.
 * Contains all result data for a choice activity including statistics and user responses.
 */
export interface ChoiceResults {
  /** Array of option results with user response data and statistics */
  options: ChoiceOptionResult[];

  /** Total number of users who participated */
  numberofuser: number;

  /** Overall percentage amount (typically 100.0 for all options combined) */
  percentageamount: number;
}

/**
 * Choice results API response structure.
 *
 * Complete API response structure returned by the get_choice_results endpoint,
 * including options array and any warnings from the API.
 */
export interface ChoiceResultsData {
  /** Array of option results */
  options: ChoiceOptionResult[];

  /** Array of warning messages from the API */
  warnings?: Array<{
    /** Type of item that generated the warning */
    item: string;

    /** ID of the item that generated the warning */
    itemid: number;

    /** Warning code identifier */
    warningcode: number;

    /** Human-readable warning message */
    message: string;
  }>;
}

/**
 * Choice option data for submission.
 *
 * Extended option interface used when displaying options for user selection,
 * including UI state like checked and disabled status.
 *
 * Based on the options structure from public/mod/choice/classes/external.php lines 258-275.
 */
export interface ChoiceOptionForDisplay extends ChoiceOption {
  /** Display layout flag (true=horizontal, false=vertical) */
  displaylayout?: boolean;

  /** Whether this option is currently selected by the user */
  checked?: boolean;

  /** Whether this option is disabled (cannot be selected) */
  disabled?: boolean;
}

/**
 * API response for getting choice options.
 *
 * Based on get_choice_options_returns from public/mod/choice/classes/external.php lines 298-316.
 */
export interface ChoiceOptionsData {
  /** Array of available options with display properties */
  options: ChoiceOptionForDisplay[];

  /** Array of warning messages */
  warnings?: Array<{
    item: string;
    itemid: number;
    warningcode: number;
    message: string;
  }>;
}

/**
 * Response from submitting a choice.
 *
 * Structure returned after a user submits their choice selection(s).
 */
export interface SubmitChoiceResponse {
  /** Array of created/updated answer IDs */
  answerids: number[];

  /** Array of warning messages if any */
  warnings?: Array<{
    item: string;
    itemid: number;
    warningcode: number;
    message: string;
  }>;
}

/**
 * Detailed user response data for choice results.
 *
 * Comprehensive user information returned in the results endpoint,
 * including user profile fields, group memberships, selected options,
 * and response timestamps. This provides all necessary data for
 * displaying detailed choice results and analytics.
 *
 * Based on Moodle's user profile structure and choice response data
 * from public/mod/choice/lib.php and public/user/profile/lib.php.
 */
export interface ChoiceUserResponse {
  /** User ID */
  id: number;

  /** User's first name */
  firstname: string;

  /** User's last name */
  lastname: string;

  /** User's email address (optional, may be hidden based on permissions) */
  email?: string;

  /** User's ID number (optional) */
  idnumber?: string;

  /** User's department (optional) */
  department?: string;

  /** User's institution (optional) */
  institution?: string;

  /** User's primary phone number (optional) */
  phone1?: string;

  /** User's secondary phone number (optional) */
  phone2?: string;

  /** User's city (optional) */
  city?: string;

  /** User's country code (optional) */
  country?: string;

  /** Array of groups the user belongs to */
  groups: Array<{
    /** Group ID */
    id: number;
    /** Group name */
    name: string;
  }>;

  /** Array of options the user selected */
  selectedOptions: Array<{
    /** Option ID */
    id: number;
    /** Option text */
    text: string;
    /** Maximum answers allowed (optional) */
    maxanswers?: number;
  }>;

  /** Timestamp when the response was last modified */
  timemodified: number;

  /** Answer ID for this user's response */
  answerid: number;
}

/**
 * Response structure for GET /api/v1/choices/{id}/results endpoint.
 *
 * Complete results data for a choice activity including all user responses
 * with detailed user information, group memberships, selected options, and
 * filtering metadata. This structure supports group filtering and active/
 * inactive user filtering as specified in the API requirements.
 *
 * The API endpoint wraps existing Moodle choice functions from
 * public/mod/choice/lib.php (choice_get_response_data, choice_get_all_responses).
 */
export interface ChoiceResultsResponse {
  /** Array of user responses with comprehensive details */
  responses: ChoiceUserResponse[];

  /** Total count of responses (after filtering) */
  totalCount: number;

  /** Choice activity ID */
  choiceId: number;

  /** Group ID filter applied (optional, present if filtered by group) */
  groupId?: number;

  /** Whether inactive users are included in results */
  includeinactive: boolean;
}
