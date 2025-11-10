/**
 * Moodle Entity Type Definitions
 * 
 * TypeScript interfaces for all major Moodle domain objects including User, Course,
 * Assignment, Quiz, Forum, Grade, Message, Role, and related entities. These interfaces
 * directly map to Moodle database tables and PHP objects, providing strong typing for
 * data retrieved from the backend API.
 * 
 * Each interface includes all relevant fields from the corresponding Moodle database
 * schema with appropriate TypeScript types. This ensures type safety when working with
 * Moodle data throughout the React application.
 * 
 * @see Section 0.3 Target Design - Moodle database schema reference
 * @see public/lib/db/install.xml - Moodle database schema definitions
 */

import type {
  Id,
  UserId,
  CourseId,
  ModuleId,
  ActivityId,
  GradeId,
  AssignmentId,
  QuizId,
  ForumId,
  MessageId,
  RoleId,
  ContextId,
  CategoryId,
  EnrolmentId,
  Timestamp,
  LanguageCode,
  CountryCode,
  Timezone,
  FileSize,
  MimeType,
} from './common';

/**
 * User Entity
 * 
 * Represents a Moodle user account with profile information and authentication details.
 * Maps to the 'user' table in Moodle database.
 * 
 * @see public/lib/moodlelib.php - User management functions
 * @see public/user/lib.php - User profile operations
 */
export interface User {
  /** Unique user identifier */
  id: UserId;
  /** Username for login (unique, alphanumeric) */
  username: string;
  /** User's first name */
  firstname: string;
  /** User's last name */
  lastname: string;
  /** Full name (computed, optional) - typically "firstname lastname" */
  fullname?: string;
  /** User's email address */
  email: string;
  /** Whether user has disabled email notifications */
  emailstop: boolean;
  /** Primary phone number */
  phone1?: string;
  /** Secondary phone number */
  phone2?: string;
  /** Institution/organization name */
  institution?: string;
  /** Department within institution */
  department?: string;
  /** Street address */
  address?: string;
  /** City */
  city?: string;
  /** Country code (ISO 3166-1 alpha-2) */
  country: CountryCode;
  /** Preferred language code */
  lang: LanguageCode;
  /** User's timezone */
  timezone: Timezone;
  /** Timestamp of first access to site */
  firstaccess: Timestamp;
  /** Timestamp of last access to site */
  lastaccess: Timestamp;
  /** Timestamp of previous login */
  lastlogin: Timestamp;
  /** Timestamp of current login session */
  currentlogin: Timestamp;
  /** Profile picture filename or hash */
  picture?: string;
  /** Alt text for profile image */
  imagealt?: string;
  /** Whether account is suspended */
  suspended: boolean;
  /** Whether email has been confirmed */
  confirmed: boolean;
  /** Authentication method (manual, ldap, oauth2, etc.) */
  auth: string;
  /** Preferred theme */
  theme?: string;
  /** Calendar type (gregorian, etc.) */
  calendartype: string;
  /** Full URL to profile image */
  profileimageurl?: string;
  /** URL to small profile image thumbnail */
  profileimageurlsmall?: string;
}

/**
 * Course Entity
 * 
 * Represents a Moodle course with settings and metadata.
 * Maps to the 'course' table in Moodle database.
 * 
 * @see public/course/lib.php - Course management functions
 */
export interface Course {
  /** Unique course identifier */
  id: CourseId;
  /** Course category ID */
  category: CategoryId;
  /** Sort order within category */
  sortorder: number;
  /** Full course name */
  fullname: string;
  /** Short course name/code */
  shortname: string;
  /** Course ID number (external identifier) */
  idnumber: string;
  /** Course summary/description (HTML) */
  summary?: string;
  /** Summary format (1=HTML, 2=plain text, etc.) */
  summaryformat: number;
  /** Course format (topics, weeks, social, etc.) */
  format: string;
  /** Whether to show grades to students */
  showgrades: boolean;
  /** Course start date (timestamp) */
  startdate: Timestamp;
  /** Course end date (timestamp) */
  enddate: Timestamp;
  /** Whether course is visible to students */
  visible: boolean;
  /** Group mode (0=no groups, 1=separate groups, 2=visible groups) */
  groupmode: number;
  /** Whether group mode is forced for all activities */
  groupmodeforce: boolean;
  /** Course language override */
  lang: LanguageCode;
  /** Course theme override */
  theme?: string;
  /** Timestamp when course was created */
  timecreated: Timestamp;
  /** Timestamp when course was last modified */
  timemodified: Timestamp;
  /** Whether completion tracking is enabled */
  enablecompletion: boolean;
  /** Whether to notify students of completion */
  completionnotify: boolean;
  /** Whether to show activity dates */
  showactivitydates: boolean;
  /** Whether to show completion conditions */
  showcompletionconditions?: boolean;
  /** URL to course image */
  courseimage?: string;
  /** User's progress percentage (0-100, optional) */
  progress?: number;
}

/**
 * Course Module Entity
 * 
 * Represents an activity module instance within a course section.
 * Maps to the 'course_modules' table in Moodle database.
 * 
 * @see public/lib/modinfolib.php - Module information functions
 */
export interface CourseModule {
  /** Unique course module identifier */
  id: ModuleId;
  /** Course ID this module belongs to */
  course: CourseId;
  /** Module type ID (maps to modules table) */
  module: number;
  /** Activity instance ID (e.g., assignment ID, quiz ID) */
  instance: ActivityId;
  /** Section number within course */
  section: number;
  /** ID number (external identifier) */
  idnumber: string;
  /** Timestamp when module was added */
  added: Timestamp;
  /** Whether module is visible to students */
  visible: boolean;
  /** Whether module is visible on course page */
  visibleoncoursepage: boolean;
  /** Completion type (0=none, 1=manual, 2=automatic) */
  completion: number;
  /** Expected completion timestamp */
  completionexpected?: Timestamp;
  /** Module type name (assign, quiz, forum, etc.) */
  modname: string;
  /** Activity name/title */
  name: string;
  /** URL to view activity */
  url: string;
  /** URL to module icon */
  iconurl?: string;
}

/**
 * Assignment Entity
 * 
 * Represents an assignment activity with submission settings.
 * Maps to the 'assign' table in Moodle database.
 * 
 * @see public/mod/assign/lib.php - Assignment module functions
 */
export interface Assignment {
  /** Unique assignment identifier */
  id: AssignmentId;
  /** Course ID this assignment belongs to */
  course: CourseId;
  /** Assignment name/title */
  name: string;
  /** Assignment instructions (HTML) */
  intro: string;
  /** Intro format (1=HTML, 2=plain text, etc.) */
  introformat: number;
  /** Whether to always show description */
  alwaysshowdescription: boolean;
  /** Whether submissions are saved as drafts */
  submissiondrafts: boolean;
  /** Whether to send notifications to graders */
  sendnotifications: boolean;
  /** Whether to send late submission notifications */
  sendlatenotifications: boolean;
  /** Due date timestamp */
  duedate?: Timestamp;
  /** Cut-off date timestamp (no submissions accepted after) */
  cutoffdate?: Timestamp;
  /** Date from which submissions are allowed */
  allowsubmissionsfromdate?: Timestamp;
  /** Maximum grade (points) */
  grade: number;
  /** Timestamp when assignment was last modified */
  timemodified: Timestamp;
  /** Whether submission statement is required */
  requiresubmissionstatement: boolean;
  /** Whether submission triggers completion */
  completionsubmit: boolean;
  /** Whether team submission is enabled */
  teamsubmission: boolean;
  /** Whether all team members must submit */
  requireallteammemberssubmit: boolean;
  /** Method for reopening attempts */
  attemptreopenmethod: string;
  /** Maximum number of attempts (-1=unlimited) */
  maxattempts: number;
  /** Whether marking workflow is enabled */
  markingworkflow: boolean;
  /** Whether marking allocation is enabled */
  markingallocation: boolean;
}

/**
 * Assignment Submission Entity
 * 
 * Represents a student's submission for an assignment.
 * Maps to the 'assign_submission' table in Moodle database.
 */
export interface AssignmentSubmission {
  /** Unique submission identifier */
  id: Id;
  /** Assignment ID this submission belongs to */
  assignment: AssignmentId;
  /** User ID of submitter */
  userid: UserId;
  /** Timestamp when submission was created */
  timecreated: Timestamp;
  /** Timestamp when submission was last modified */
  timemodified: Timestamp;
  /** Submission status */
  status: 'draft' | 'submitted' | 'reopened';
  /** Group ID (for team submissions) */
  groupid?: Id;
  /** Attempt number */
  attemptnumber: number;
  /** Whether this is the latest attempt */
  latest: boolean;
}

/**
 * Quiz Entity
 * 
 * Represents a quiz activity with questions and settings.
 * Maps to the 'quiz' table in Moodle database.
 * 
 * @see public/mod/quiz/lib.php - Quiz module functions
 */
export interface Quiz {
  /** Unique quiz identifier */
  id: QuizId;
  /** Course ID this quiz belongs to */
  course: CourseId;
  /** Quiz name/title */
  name: string;
  /** Quiz introduction (HTML) */
  intro: string;
  /** Intro format (1=HTML, 2=plain text, etc.) */
  introformat: number;
  /** Timestamp when quiz opens */
  timeopen?: Timestamp;
  /** Timestamp when quiz closes */
  timeclose?: Timestamp;
  /** Time limit in seconds (0=no limit) */
  timelimit?: number;
  /** How to handle overdue attempts */
  overduehandling: string;
  /** Grace period for submissions (seconds) */
  graceperiod?: number;
  /** Preferred question behavior */
  preferredbehaviour: string;
  /** Whether students can redo questions */
  canredoquestions: boolean;
  /** Number of allowed attempts (0=unlimited) */
  attempts: number;
  /** Grading method (1=highest, 2=average, 3=first, 4=last) */
  grademethod: number;
  /** Maximum grade (points) */
  grade: number;
  /** Sum of all question grades */
  sumgrades: number;
  /** Decimal points for question grades */
  questiondecimalpoints: number;
}

/**
 * Quiz Attempt Entity
 * 
 * Represents a student's attempt at a quiz.
 * Maps to the 'quiz_attempts' table in Moodle database.
 */
export interface QuizAttempt {
  /** Unique attempt identifier */
  id: Id;
  /** Quiz ID this attempt belongs to */
  quiz: QuizId;
  /** User ID of student */
  userid: UserId;
  /** Attempt number */
  attempt: number;
  /** Unique ID for question usage */
  uniqueid: number;
  /** Question layout string */
  layout: string;
  /** Current page number */
  currentpage: number;
  /** Whether this is a preview */
  preview: boolean;
  /** Attempt state */
  state: 'inprogress' | 'overdue' | 'finished' | 'abandoned';
  /** Timestamp when attempt started */
  timestart: Timestamp;
  /** Timestamp when attempt finished */
  timefinish?: Timestamp;
  /** Timestamp when attempt was last modified */
  timemodified: Timestamp;
  /** Sum of all grades for this attempt */
  sumgrades?: number;
}

/**
 * Forum Entity
 * 
 * Represents a forum activity for discussions.
 * Maps to the 'forum' table in Moodle database.
 * 
 * @see public/mod/forum/lib.php - Forum module functions
 */
export interface Forum {
  /** Unique forum identifier */
  id: ForumId;
  /** Course ID this forum belongs to */
  course: CourseId;
  /** Forum type */
  type: 'single' | 'news' | 'general' | 'social' | 'eachuser' | 'qanda' | 'blog';
  /** Forum name/title */
  name: string;
  /** Forum description (HTML) */
  intro: string;
  /** Intro format (1=HTML, 2=plain text, etc.) */
  introformat: number;
  /** Whether posts are assessed/rated */
  assessed: number;
  /** Assessment start timestamp */
  assesstimestart?: Timestamp;
  /** Assessment end timestamp */
  assesstimefinish?: Timestamp;
  /** Rating scale to use */
  scale: number;
  /** Maximum attachment file size (bytes) */
  maxbytes: number;
  /** Maximum number of attachments per post */
  maxattachments: number;
  /** Whether subscription is forced */
  forcesubscribe: boolean;
  /** Post tracking type */
  trackingtype: number;
  /** RSS feed type */
  rsstype: number;
  /** Number of RSS articles */
  rssarticles: number;
}

/**
 * Forum Discussion Entity
 * 
 * Represents a discussion thread within a forum.
 * Maps to the 'forum_discussions' table in Moodle database.
 */
export interface ForumDiscussion {
  /** Unique discussion identifier */
  id: Id;
  /** Course ID this discussion belongs to */
  course: CourseId;
  /** Forum ID this discussion belongs to */
  forum: ForumId;
  /** Discussion name/subject */
  name: string;
  /** First post ID in this discussion */
  firstpost: Id;
  /** User ID of discussion creator */
  userid: UserId;
  /** Group ID (for group discussions) */
  groupid?: Id;
  /** Whether discussion is assessed */
  assessed: boolean;
  /** Timestamp when discussion was last modified */
  timemodified: Timestamp;
  /** User ID who last modified discussion */
  usermodified: UserId;
  /** Discussion start timestamp (for timed discussions) */
  timestart?: Timestamp;
  /** Discussion end timestamp (for timed discussions) */
  timeend?: Timestamp;
  /** Whether discussion is pinned to top */
  pinned: boolean;
}

/**
 * Forum Post Entity
 * 
 * Represents a post within a forum discussion.
 * Maps to the 'forum_posts' table in Moodle database.
 */
export interface ForumPost {
  /** Unique post identifier */
  id: Id;
  /** Discussion ID this post belongs to */
  discussion: Id;
  /** Parent post ID (0 for root posts) */
  parent: Id;
  /** User ID of post author */
  userid: UserId;
  /** Timestamp when post was created */
  created: Timestamp;
  /** Timestamp when post was last modified */
  modified: Timestamp;
  /** Post subject/title */
  subject: string;
  /** Post message content */
  message: string;
  /** Message format (1=HTML, 2=plain text, etc.) */
  messageformat: number;
  /** Whether message content is trusted */
  messagetrust: boolean;
  /** Whether post has attachments */
  attachment: boolean;
  /** Total score from ratings */
  totalscore: number;
  /** Whether to email post immediately */
  mailnow: boolean;
}

/**
 * Grade Entity
 * 
 * Represents a grade given to a user for a grade item.
 * Maps to the 'grade_grades' table in Moodle database.
 * 
 * @see public/lib/gradelib.php - Grade calculation functions
 */
export interface Grade {
  /** Unique grade identifier */
  id: GradeId;
  /** Grade item ID this grade belongs to */
  itemid: Id;
  /** User ID this grade is for */
  userid: UserId;
  /** Raw grade value */
  rawgrade?: number;
  /** Maximum possible raw grade */
  rawgrademax: number;
  /** Minimum possible raw grade */
  rawgrademin: number;
  /** Scale ID (if using scale instead of numeric) */
  rawscaleid?: number;
  /** User ID who last modified grade */
  usermodified?: UserId;
  /** Final calculated grade */
  finalgrade?: number;
  /** Whether grade is hidden from student */
  hidden: boolean;
  /** Whether grade is locked */
  locked: boolean;
  /** Timestamp when grade will be locked */
  locktime?: Timestamp;
  /** Timestamp when grade was exported */
  exported?: Timestamp;
  /** Whether grade was manually overridden */
  overridden: boolean;
  /** Whether grade is excluded from aggregation */
  excluded: boolean;
  /** Feedback text for student */
  feedback?: string;
  /** Feedback format (1=HTML, 2=plain text, etc.) */
  feedbackformat: number;
  /** Additional information */
  information?: string;
  /** Information format */
  informationformat: number;
}

/**
 * Grade Item Entity
 * 
 * Represents a gradeable item (assignment, quiz, manual item, etc.).
 * Maps to the 'grade_items' table in Moodle database.
 */
export interface GradeItem {
  /** Unique grade item identifier */
  id: Id;
  /** Course ID this item belongs to */
  courseid: CourseId;
  /** Grade category ID */
  categoryid?: Id;
  /** Grade item name */
  itemname: string;
  /** Item type (manual, mod, course, category) */
  itemtype: string;
  /** Module type (if itemtype is 'mod') */
  itemmodule?: string;
  /** Module instance ID */
  iteminstance?: Id;
  /** Item number (for multiple grade items per activity) */
  itemnumber?: number;
  /** Grade type (1=value, 2=scale, 3=text) */
  gradetype: number;
  /** Maximum grade value */
  grademax: number;
  /** Minimum grade value */
  grademin: number;
  /** Scale ID (if gradetype is scale) */
  scaleid?: number;
  /** Outcome ID (if linked to outcome) */
  outcomeid?: number;
  /** Grade to pass (if set) */
  gradepass?: number;
  /** Multiplication factor for grade calculation */
  multfactor: number;
  /** Addition factor for grade calculation */
  plusfactor: number;
  /** Aggregation coefficient */
  aggregationcoef: number;
  /** Second aggregation coefficient */
  aggregationcoef2: number;
  /** Whether weight is overridden */
  weightoverride: boolean;
  /** Sort order within category */
  sortorder: number;
  /** Display type for grades */
  display: number;
  /** Decimal points to display */
  decimals?: number;
  /** Whether item is hidden */
  hidden: boolean;
  /** Whether item is locked */
  locked: boolean;
  /** Timestamp when item will be locked */
  locktime?: Timestamp;
}

/**
 * Message Entity
 * 
 * Represents a message sent between users.
 * Maps to the 'messages' table in Moodle database.
 * 
 * @see public/message/lib.php - Messaging functions
 */
export interface Message {
  /** Unique message identifier */
  id: MessageId;
  /** User ID of sender */
  useridfrom: UserId;
  /** User ID of recipient */
  useridto: UserId;
  /** Message subject */
  subject: string;
  /** Full message text */
  fullmessage: string;
  /** Full message format (1=HTML, 2=plain text, etc.) */
  fullmessageformat: number;
  /** Full message as HTML */
  fullmessagehtml?: string;
  /** Small message summary */
  smallmessage: string;
  /** Whether this is a notification */
  notification: boolean;
  /** Context URL for notification */
  contexturl?: string;
  /** Context URL name */
  contexturlname?: string;
  /** Timestamp when message was created */
  timecreated: Timestamp;
  /** Timestamp when message was read */
  timeread?: Timestamp;
  /** Timestamp when sender deleted message */
  timeuserfromdeleted?: Timestamp;
  /** Timestamp when recipient deleted message */
  timeusertodeleted?: Timestamp;
  /** Component that sent message */
  component?: string;
  /** Event type that triggered message */
  eventtype?: string;
}

/**
 * Conversation Entity
 * 
 * Represents a conversation between users.
 * Maps to the 'message_conversations' table in Moodle database.
 */
export interface Conversation {
  /** Unique conversation identifier */
  id: Id;
  /** Conversation type (1=individual, 2=group, 3=self) */
  type: number;
  /** Conversation name (for group conversations) */
  name?: string;
  /** Whether conversation is enabled */
  enabled: boolean;
  /** Timestamp when conversation was created */
  timecreated: Timestamp;
  /** Timestamp when conversation was last modified */
  timemodified: Timestamp;
}

/**
 * Role Entity
 * 
 * Represents a role that can be assigned to users.
 * Maps to the 'role' table in Moodle database.
 * 
 * @see public/lib/accesslib.php - Role and capability functions
 */
export interface Role {
  /** Unique role identifier */
  id: RoleId;
  /** Role name (full) */
  name: string;
  /** Role short name (student, teacher, editingteacher, manager, etc.) */
  shortname: string;
  /** Role description */
  description?: string;
  /** Sort order */
  sortorder: number;
  /** Role archetype */
  archetype: string;
}

/**
 * Role Assignment Entity
 * 
 * Represents a role assigned to a user in a context.
 * Maps to the 'role_assignments' table in Moodle database.
 */
export interface RoleAssignment {
  /** Unique role assignment identifier */
  id: Id;
  /** Role ID being assigned */
  roleid: RoleId;
  /** Context ID where role is assigned */
  contextid: ContextId;
  /** User ID receiving the role */
  userid: UserId;
  /** Timestamp when assignment was last modified */
  timemodified: Timestamp;
  /** User ID who made the assignment */
  modifierid: UserId;
  /** Component that created assignment */
  component?: string;
  /** Item ID (for component-specific assignments) */
  itemid?: Id;
}

/**
 * Context Entity
 * 
 * Represents a context in the Moodle permission system.
 * Maps to the 'context' table in Moodle database.
 * 
 * Context levels:
 * - 10: System
 * - 30: User
 * - 40: Course Category
 * - 50: Course
 * - 70: Module
 * - 80: Block
 */
export interface Context {
  /** Unique context identifier */
  id: ContextId;
  /** Context level (10=system, 30=user, 40=coursecat, 50=course, 70=module, 80=block) */
  contextlevel: number;
  /** Instance ID (e.g., course ID for course context) */
  instanceid: Id;
  /** Context path (slash-separated context IDs) */
  path: string;
  /** Context depth in hierarchy */
  depth: number;
}

/**
 * Enrollment Entity
 * 
 * Represents a user's enrollment in a course.
 * Maps to the 'user_enrolments' table in Moodle database.
 * 
 * @see public/enrol/externallib.php - Enrollment functions
 */
export interface Enrollment {
  /** Unique enrollment identifier */
  id: EnrolmentId;
  /** Course ID */
  courseid: CourseId;
  /** User ID */
  userid: UserId;
  /** Enrollment method (manual, self, cohort, etc.) */
  enrol: string;
  /** Enrollment status (0=active, 1=suspended) */
  status: number;
  /** Enrollment start timestamp */
  timestart: Timestamp;
  /** Enrollment end timestamp */
  timeend?: Timestamp;
  /** Timestamp when enrollment was created */
  timecreated: Timestamp;
  /** Timestamp when enrollment was last modified */
  timemodified: Timestamp;
}

/**
 * Course Category Entity
 * 
 * Represents a category for organizing courses.
 * Maps to the 'course_categories' table in Moodle database.
 */
export interface CourseCategory {
  /** Unique category identifier */
  id: CategoryId;
  /** Category name */
  name: string;
  /** Category ID number (external identifier) */
  idnumber: string;
  /** Category description (HTML) */
  description?: string;
  /** Description format (1=HTML, 2=plain text, etc.) */
  descriptionformat: number;
  /** Parent category ID (0 for top-level) */
  parent: CategoryId;
  /** Sort order within parent */
  sortorder: number;
  /** Number of courses in category */
  coursecount: number;
  /** Whether category is visible */
  visible: boolean;
  /** Previous visibility state */
  visibleold: boolean;
  /** Timestamp when category was last modified */
  timemodified: Timestamp;
  /** Depth in category hierarchy */
  depth: number;
  /** Category path (slash-separated category IDs) */
  path: string;
}

/**
 * File Entity
 * 
 * Represents a file stored in Moodle's file system.
 * Maps to the 'files' table in Moodle database.
 * 
 * @see public/lib/filelib.php - File handling functions
 */
export interface File {
  /** Unique file identifier */
  id: Id;
  /** Content hash (SHA1) */
  contenthash: string;
  /** Pathname hash (unique) */
  pathnamehash: string;
  /** Context ID where file is stored */
  contextid: ContextId;
  /** Component that owns the file */
  component: string;
  /** File area within component */
  filearea: string;
  /** Item ID within file area */
  itemid: Id;
  /** File path within area */
  filepath: string;
  /** File name */
  filename: string;
  /** User ID who uploaded file */
  userid?: UserId;
  /** File size in bytes */
  filesize: FileSize;
  /** MIME type */
  mimetype: MimeType;
  /** File status */
  status: number;
  /** Source information */
  source?: string;
  /** Author name */
  author?: string;
  /** License type */
  license?: string;
  /** Timestamp when file was created */
  timecreated: Timestamp;
  /** Timestamp when file was last modified */
  timemodified: Timestamp;
  /** URL to download file */
  fileurl?: string;
  /** URL to file thumbnail */
  thumbnailurl?: string;
}

/**
 * Calendar Event Entity
 * 
 * Represents an event in the calendar.
 * Maps to the 'event' table in Moodle database.
 */
export interface CalendarEvent {
  /** Unique event identifier */
  id: Id;
  /** Event name/title */
  name: string;
  /** Event description (HTML) */
  description: string;
  /** Description format (1=HTML, 2=plain text, etc.) */
  descriptionformat: number;
  /** Event type */
  eventtype: 'site' | 'course' | 'group' | 'user' | 'category';
  /** Course ID (for course events) */
  courseid?: CourseId;
  /** Group ID (for group events) */
  groupid?: Id;
  /** User ID (for user events) */
  userid?: UserId;
  /** Repeat event ID (for repeating events) */
  repeatid?: Id;
  /** Module name (for activity events) */
  modulename?: string;
  /** Activity instance ID */
  instance?: Id;
  /** Event start timestamp */
  timestart: Timestamp;
  /** Event duration in seconds */
  timeduration: number;
  /** Whether event is visible */
  visible: boolean;
  /** UUID for external calendar sync */
  uuid: string;
  /** Sequence number */
  sequence: number;
  /** Timestamp when event was last modified */
  timemodified: Timestamp;
}

/**
 * Notification Entity
 * 
 * Represents a notification sent to a user.
 * Maps to the 'notifications' table in Moodle database.
 */
export interface Notification {
  /** Unique notification identifier */
  id: Id;
  /** User ID of sender */
  useridfrom: UserId;
  /** User ID of recipient */
  useridto: UserId;
  /** Notification subject */
  subject: string;
  /** Full notification text */
  fullmessage: string;
  /** Full message format (1=HTML, 2=plain text, etc.) */
  fullmessageformat: number;
  /** Full notification as HTML */
  fullmessagehtml?: string;
  /** Small notification summary */
  smallmessage: string;
  /** Component that sent notification */
  component: string;
  /** Event type that triggered notification */
  eventtype: string;
  /** Context URL for notification */
  contexturl?: string;
  /** Context URL name */
  contexturlname?: string;
  /** Timestamp when notification was read */
  timeread?: Timestamp;
  /** Timestamp when notification was created */
  timecreated: Timestamp;
}

/**
 * Badge Entity
 * 
 * Represents an achievement badge that can be awarded to users.
 * Maps to the 'badge' table in Moodle database.
 */
export interface Badge {
  /** Unique badge identifier */
  id: Id;
  /** Badge name */
  name: string;
  /** Badge description (HTML) */
  description: string;
  /** Timestamp when badge was created */
  timecreated: Timestamp;
  /** Timestamp when badge was last modified */
  timemodified: Timestamp;
  /** User ID who created badge */
  usercreated: UserId;
  /** User ID who last modified badge */
  usermodified: UserId;
  /** Issuer name */
  issuername: string;
  /** Issuer URL */
  issuerurl: string;
  /** Issuer contact */
  issuercontact: string;
  /** Expiry date timestamp */
  expiredate?: Timestamp;
  /** Expiry period in seconds */
  expireperiod?: number;
  /** Badge type (1=site, 2=course) */
  type: number;
  /** Course ID (for course badges) */
  courseid?: CourseId;
  /** Message to award recipient */
  message: string;
  /** Message subject */
  messagesubject: string;
  /** Whether to attach badge image */
  attachment: boolean;
  /** Whether to send notification */
  notification: boolean;
  /** Badge status (0=inactive, 1=active, 2=active+locked, 3=archived, 4=archived+locked) */
  status: number;
  /** Image author name */
  imageauthorname?: string;
  /** Image author email */
  imageauthoremail?: string;
  /** Image author URL */
  imageauthorurl?: string;
  /** Image caption */
  imagecaption?: string;
}

/**
 * Workshop Entity
 * 
 * Represents a workshop activity for peer assessment.
 * Maps to the 'workshop' table in Moodle database.
 */
export interface Workshop {
  /** Unique workshop identifier */
  id: Id;
  /** Course ID this workshop belongs to */
  course: CourseId;
  /** Workshop name/title */
  name: string;
  /** Workshop phase (0=setup, 10=submission, 20=assessment, 30=grading, 40=closed) */
  phase: number;
  /** Whether to use example submissions */
  useexamples: boolean;
  /** Whether to use peer assessment */
  usepeerassessment: boolean;
  /** Whether to use self assessment */
  useselfassessment: boolean;
  /** Maximum grade for submission */
  grade: number;
  /** Maximum grade for assessment */
  gradinggrade: number;
  /** Grading strategy (accumulative, comments, numerrors, rubric) */
  strategy: string;
  /** Submission phase start timestamp */
  submissionstart?: Timestamp;
  /** Submission phase end timestamp */
  submissionend?: Timestamp;
  /** Assessment phase start timestamp */
  assessmentstart?: Timestamp;
  /** Assessment phase end timestamp */
  assessmentend?: Timestamp;
  /** Whether to automatically switch to assessment phase */
  phaseswitchassessment: boolean;
  /** Whether text submissions are enabled */
  submissiontypetext: boolean;
  /** Whether file submissions are enabled */
  submissiontypefile: boolean;
}

/**
 * Workshop Submission Entity
 * 
 * Represents a submission in a workshop activity.
 * Maps to the 'workshop_submissions' table in Moodle database.
 */
export interface WorkshopSubmission {
  /** Unique submission identifier */
  id: Id;
  /** Workshop ID this submission belongs to */
  workshopid: Id;
  /** User ID of submission author */
  authorid: UserId;
  /** Submission title */
  title: string;
  /** Submission content (HTML) */
  content: string;
  /** Content format (1=HTML, 2=plain text, etc.) */
  contentformat: number;
  /** Whether submission has file attachments */
  attachment: boolean;
  /** Grade received for submission */
  grade?: number;
  /** Grade override by teacher */
  gradeover?: number;
  /** Whether submission is published */
  published: boolean;
  /** Feedback from teacher to author */
  feedbackauthor?: string;
  /** Feedback format */
  feedbackauthorformat: number;
  /** Timestamp when submission was created */
  timecreated: Timestamp;
  /** Timestamp when submission was last modified */
  timemodified: Timestamp;
  /** Whether this is an example submission */
  example: boolean;
  /** Array of attached files */
  files?: File[];
}

/**
 * Workshop Assessment Entity
 * 
 * Represents a peer/self assessment of a workshop submission.
 * Maps to the 'workshop_assessments' table in Moodle database.
 */
export interface WorkshopAssessment {
  /** Unique assessment identifier */
  id: Id;
  /** Submission ID being assessed */
  submissionid: Id;
  /** User ID of reviewer */
  reviewerid: UserId;
  /** Grade given to submission */
  grade?: number;
  /** Grading grade (quality of assessment) */
  gradinggrade?: number;
  /** Grading grade override by teacher */
  gradinggradeover?: number;
  /** User ID who overrode grading grade */
  gradinggradeoverby?: UserId;
  /** Feedback to submission author */
  feedbackauthor?: string;
  /** Feedback format */
  feedbackauthorformat: number;
  /** Whether feedback has attachments */
  feedbackauthorattachment: boolean;
  /** Feedback to reviewer (from teacher) */
  feedbackreviewer?: string;
  /** Feedback reviewer format */
  feedbackreviewerformat: number;
  /** Weight of this assessment */
  weight: number;
  /** Timestamp when assessment was created */
  timecreated: Timestamp;
  /** Timestamp when assessment was last modified */
  timemodified: Timestamp;
  /** Assessment dimension values */
  dimensions?: WorkshopAssessmentDimension[];
}

/**
 * Workshop Assessment Dimension
 * 
 * Represents a single dimension/criterion in a workshop assessment.
 */
export interface WorkshopAssessmentDimension {
  /** Dimension ID from workshop form */
  dimensionid: Id;
  /** Grade given for this dimension */
  grade?: number;
  /** Peer comment on this dimension */
  peercomment?: string;
  /** Peer comment format */
  peercommentformat: number;
}

/**
 * Workshop Assessment Form Data
 * 
 * Represents form data for submitting a workshop assessment.
 */
export interface WorkshopAssessmentFormData {
  /** Overall grade for submission */
  grade?: number;
  /** Feedback to author */
  feedbackauthor?: string;
  /** Feedback to reviewer (from teacher) */
  feedbackreviewer?: string;
  /** Dimension grades and comments */
  dimensions: WorkshopAssessmentDimension[];
}
