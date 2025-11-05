/**
 * Forum Activity Module Type Definitions
 *
 * Comprehensive TypeScript type definitions for the forum activity module.
 * These types map directly to Moodle's mod_forum PHP entity classes and constants.
 *
 * @package    react-frontend
 * @subpackage features/activities/forums
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 *
 * Source References:
 * - public/mod/forum/classes/local/entities/author.php
 * - public/mod/forum/classes/local/entities/forum.php
 * - public/mod/forum/classes/local/entities/discussion.php
 * - public/mod/forum/classes/local/entities/post.php
 * - public/mod/forum/classes/local/entities/discussion_summary.php
 * - public/mod/forum/lib.php (constants and type definitions)
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Forum display modes
 * Maps to FORUM_MODE_* constants in public/mod/forum/lib.php
 */
export enum ForumDisplayMode {
  /** Display posts in flat mode, oldest first */
  FLAT_OLDEST = 1,
  /** Display posts in flat mode, newest first */
  FLAT_NEWEST = -1,
  /** Display posts in threaded mode */
  THREADED = 2,
  /** Display posts in nested mode (legacy) */
  NESTED = 3,
  /** Display posts in nested mode (version 2) */
  NESTED_V2 = 4,
}

/**
 * Forum types
 * Maps to forum types returned by forum_get_forum_types_all() in public/mod/forum/lib.php
 */
export enum ForumType {
  /** Standard forum for general use */
  GENERAL = 'general',
  /** Each person posts one discussion */
  EACHUSER = 'eachuser',
  /** A single simple discussion */
  SINGLE = 'single',
  /** Q and A forum */
  QANDA = 'qanda',
  /** Standard forum displayed on course main page */
  BLOG = 'blog',
  /** News forum for course announcements */
  NEWS = 'news',
  /** Social forum for informal discussions */
  SOCIAL = 'social',
}

/**
 * Forum subscription modes
 * Maps to FORUM_*SUBSCRIBE constants in public/mod/forum/lib.php
 */
export enum ForumSubscriptionMode {
  /** Users can choose whether to subscribe */
  CHOOSE = 0,
  /** All users are forced to be subscribed */
  FORCE = 1,
  /** Users are initially subscribed but can unsubscribe */
  INITIAL = 2,
  /** Subscription is not allowed */
  DISALLOW = 3,
}

/**
 * Forum tracking types
 * Maps to FORUM_TRACKING_* constants in public/mod/forum/lib.php
 */
export enum ForumTrackingType {
  /** Tracking is not available for this forum */
  OFF = 0,
  /** Tracking is based on user preference */
  OPTIONAL = 1,
  /** Tracking is on, regardless of user setting */
  FORCED = 2,
}

/**
 * Post mailing status
 * Maps to FORUM_MAILED_* constants in public/mod/forum/lib.php
 */
export enum ForumMailingStatus {
  /** Post is pending to be mailed */
  PENDING = 0,
  /** Post was successfully mailed */
  SUCCESS = 1,
  /** Error occurred while mailing post */
  ERROR = 2,
}

/**
 * Discussion pin status
 * Maps to FORUM_DISCUSSION_* constants in public/mod/forum/lib.php
 */
export enum DiscussionPinStatus {
  /** Discussion is not pinned */
  UNPINNED = 0,
  /** Discussion is pinned to the top */
  PINNED = 1,
}

// ============================================================================
// ENTITY INTERFACES
// ============================================================================

/**
 * Author entity
 * Maps to mod_forum\local\entities\author class in public/mod/forum/classes/local/entities/author.php
 */
export interface Author {
  /** User ID */
  id: number;
  /** Picture item ID for user avatar */
  pictureitemid: number;
  /** First name */
  firstname: string;
  /** Last name */
  lastname: string;
  /** Full name (display name) */
  fullname: string;
  /** Email address */
  email: string;
  /** Whether the user account is deleted */
  deleted: boolean;
  /** Middle name (optional) */
  middlename?: string;
  /** Phonetic spelling of first name (optional) */
  firstnamephonetic?: string;
  /** Phonetic spelling of last name (optional) */
  lastnamephonetic?: string;
  /** Alternate name (optional) */
  alternatename?: string;
  /** Image alt text (optional) */
  imagealt?: string;
}

/**
 * Forum entity
 * Maps to mod_forum\local\entities\forum class in public/mod/forum/classes/local/entities/forum.php
 */
export interface Forum {
  /** Forum ID */
  id: number;
  /** Course ID this forum belongs to */
  courseid: number;
  /** Forum type (general, single, eachuser, qanda, blog, news, social) */
  type: ForumType;
  /** Forum name */
  name: string;
  /** Introduction text */
  intro: string;
  /** Format of the introduction text (HTML, plain text, etc.) */
  introformat: number;
  /** Forum rating aggregate type */
  assessed: number;
  /** Timestamp to begin assessment */
  assesstimestart: number;
  /** Timestamp to end assessment */
  assesstimefinish: number;
  /** Rating scale ID */
  scale: number;
  /** Grade for the forum when grading holistically */
  gradeforum: number;
  /** Whether to notify students when graded holistically */
  gradeforumnotify: boolean;
  /** Maximum attachment size in bytes */
  maxbytes: number;
  /** Maximum number of attachments per post */
  maxattachments: number;
  /** Subscription mode (CHOOSE, FORCE, INITIAL, DISALLOW) */
  forcesubscribe: ForumSubscriptionMode;
  /** Tracking type (OFF, OPTIONAL, FORCED) */
  trackingtype: ForumTrackingType;
  /** RSS type */
  rsstype: number;
  /** RSS articles */
  rssarticles: number;
  /** Timestamp when forum was last modified */
  timemodified: number;
  /** Number of posts before warning */
  warnafter: number;
  /** Number of posts before blocking */
  blockafter: number;
  /** Time period for blocking (seconds) */
  blockperiod: number;
  /** Number of discussions required for completion */
  completiondiscussions: number;
  /** Number of replies required for completion */
  completionreplies: number;
  /** Number of posts required for completion */
  completionposts: number;
  /** Whether to display word count in posts */
  displaywordcount: boolean;
  /** Timestamp after which discussions are automatically locked */
  lockdiscussionafter: number;
  /** Due date timestamp for forum posts */
  duedate: number;
  /** Cut-off date timestamp after which posts are not accepted */
  cutoffdate: number;
}

/**
 * Discussion entity
 * Maps to mod_forum\local\entities\discussion class in public/mod/forum/classes/local/entities/discussion.php
 */
export interface Discussion {
  /** Discussion ID */
  id: number;
  /** Course ID */
  courseid: number;
  /** Forum ID this discussion belongs to */
  forumid: number;
  /** Discussion name/title */
  name: string;
  /** ID of the first post in the discussion */
  firstpostid: number;
  /** User ID who created the discussion */
  userid: number;
  /** Group ID if this is a group discussion (0 for all participants) */
  groupid: number;
  /** Whether the discussion is assessed */
  assessed: boolean;
  /** Timestamp of last modification */
  timemodified: number;
  /** User ID who last modified the discussion */
  usermodified: number;
  /** Start time for timed discussions */
  timestart: number;
  /** End time for timed discussions */
  timeend: number;
  /** Whether the discussion is pinned */
  pinned: boolean;
  /** Timestamp when discussion was locked (0 if not locked) */
  timelocked: number;
}

/**
 * Post entity
 * Maps to mod_forum\local\entities\post class in public/mod/forum/classes/local/entities/post.php
 */
export interface Post {
  /** Post ID */
  id: number;
  /** Discussion ID this post belongs to */
  discussionid: number;
  /** Parent post ID (0 if top-level post) */
  parentid: number;
  /** User ID of the post author */
  authorid: number;
  /** Timestamp when post was created */
  timecreated: number;
  /** Timestamp when post was last modified */
  timemodified: number;
  /** Whether the post has been mailed */
  mailed: boolean;
  /** Post subject/title */
  subject: string;
  /** Post message content */
  message: string;
  /** Format of the message (HTML, plain text, markdown, etc.) */
  messageformat: number;
  /** Whether this is a trusted message (from trusted user) */
  messagetrust: boolean;
  /** Whether the post has file attachments */
  hasattachments: boolean;
  /** Total rating score */
  totalscore: number;
  /** Whether to mail this post immediately */
  mailnow: boolean;
  /** Whether the post is deleted (soft delete) */
  deleted: boolean;
  /** User ID for private reply (0 if not a private reply) */
  privatereplyto: number;
  /** Word count in the message */
  wordcount: number;
  /** Character count in the message */
  charcount: number;
}

/**
 * Discussion summary entity
 * Maps to mod_forum\local\entities\discussion_summary class
 * in public/mod/forum/classes/local/entities/discussion_summary.php
 */
export interface DiscussionSummary {
  /** The discussion being summarized */
  discussion: Discussion;
  /** The first post in the discussion */
  firstPost: Post;
  /** Author of the first post */
  firstPostAuthor: Author;
  /** Author of the most recent post */
  latestPostAuthor: Author;
}

/**
 * Forum subscription entity
 * Represents a user's subscription to an entire forum
 */
export interface ForumSubscription {
  /** Subscription ID */
  id: number;
  /** User ID */
  userid: number;
  /** Forum ID */
  forumid: number;
}

/**
 * Discussion subscription entity
 * Represents a user's subscription preference for a specific discussion
 */
export interface DiscussionSubscription {
  /** Subscription ID */
  id: number;
  /** Forum ID */
  forumid: number;
  /** User ID */
  userid: number;
  /** Discussion ID */
  discussionid: number;
  /** Subscription preference (1 = subscribed, 0 = unsubscribed) */
  preference: number;
}

/**
 * Rating entity
 * Represents a rating given to a forum post
 */
export interface Rating {
  /** Rating ID */
  id: number;
  /** Context ID where rating occurs */
  contextid: number;
  /** Component name (e.g., 'mod_forum') */
  component: string;
  /** Rating area (e.g., 'post') */
  ratingarea: string;
  /** ID of the item being rated */
  itemid: number;
  /** Scale ID used for rating */
  scaleid: number;
  /** User ID who gave the rating */
  userid: number;
  /** The rating value */
  rating: number;
  /** Timestamp when rating was created */
  timecreated: number;
  /** Timestamp when rating was last modified */
  timemodified: number;
}

// ============================================================================
// DATA TRANSFER OBJECTS (DTOs)
// ============================================================================

/**
 * Data required to create a new post (reply)
 * Simplified API interface for post creation
 */
export interface CreatePostData {
  /** Post message content */
  message: string;
  /** Parent post ID for nested replies (optional) */
  parentId?: number;
  /** File attachments (optional) */
  attachments?: File[];
}

/**
 * Data required to update an existing post
 * Simplified API interface for post updates
 */
export interface UpdatePostData {
  /** Updated message content */
  message: string;
  /** New file attachments to add (optional) */
  attachments?: File[];
  /** Array of attachment IDs to remove (optional) */
  removeAttachments?: number[];
  /** Version number for concurrent edit detection (optional) */
  version?: number;
  /** Timestamp for concurrent edit detection (optional) */
  timestamp?: number;
}

/**
 * Data required to create a new discussion
 * Simplified API interface for discussion creation
 */
export interface CreateDiscussionData {
  /** Discussion subject/title */
  subject: string;
  /** First post message content */
  message: string;
  /** Whether to subscribe user to the discussion */
  subscribe?: boolean;
  /** Whether to pin the discussion (moderator only) */
  pinned?: boolean;
  /** File attachments for first post */
  attachments?: File[];
}

// ============================================================================
// COMPONENT PROP INTERFACES
// ============================================================================

/**
 * Props for ForumView component
 * Main forum view showing discussions list
 */
export interface ForumViewProps {
  /** Forum to display */
  forum: Forum;
  /** Current user ID */
  userid: number;
  /** Whether user can add discussions */
  canAddDiscussion: boolean;
  /** Whether user can subscribe */
  canSubscribe: boolean;
  /** Current user's subscription status */
  isSubscribed: boolean;
  /** Callback when creating new discussion */
  onCreateDiscussion?: (data: CreateDiscussionData) => void;
  /** Callback when toggling subscription */
  onToggleSubscription?: () => void;
}

/**
 * Props for DiscussionList component
 * List of discussions in a forum
 */
export interface DiscussionListProps {
  /** Forum ID */
  forumid: number;
  /** List of discussion summaries */
  discussions: DiscussionSummary[];
  /** Current display mode */
  displayMode: ForumDisplayMode;
  /** Whether discussions are loading */
  isLoading?: boolean;
  /** Callback when clicking a discussion */
  onDiscussionClick: (discussionId: number) => void;
  /** Callback when pinning/unpinning discussion */
  onTogglePin?: (discussionId: number) => void;
  /** Callback when locking/unlocking discussion */
  onToggleLock?: (discussionId: number) => void;
}

/**
 * Props for DiscussionThread component
 * Full discussion view with all posts
 */
export interface DiscussionThreadProps {
  /** Discussion to display */
  discussion: Discussion;
  /** All posts in the discussion */
  posts: Post[];
  /** Post authors mapped by user ID */
  authors: Record<number, Author>;
  /** Current display mode */
  displayMode: ForumDisplayMode;
  /** Current user ID */
  userid: number;
  /** Whether user can reply */
  canReply: boolean;
  /** Callback when creating new post */
  onCreatePost: (data: CreatePostData) => void;
  /** Callback when editing post */
  onEditPost?: (data: UpdatePostData) => void;
  /** Callback when deleting post */
  onDeletePost?: (postId: number) => void;
}

/**
 * Props for PostCard component
 * Individual post display
 */
export interface PostCardProps {
  /** Post to display */
  post: Post;
  /** Post author */
  author: Author;
  /** Whether this is the first post in discussion */
  isFirstPost: boolean;
  /** Current user ID */
  userid: number;
  /** Whether user can edit this post */
  canEdit: boolean;
  /** Whether user can delete this post */
  canDelete: boolean;
  /** Whether user can reply to this post */
  canReply: boolean;
  /** Whether user can rate this post */
  canRate: boolean;
  /** Callback when replying to post */
  onReply?: (parentId: number) => void;
  /** Callback when editing post */
  onEdit?: (post: Post) => void;
  /** Callback when deleting post */
  onDelete?: (postId: number) => void;
  /** Callback when rating post */
  onRate?: (postId: number, rating: number) => void;
}

/**
 * Props for PostForm component
 * Form for creating or editing posts
 */
export interface PostFormProps {
  /** Discussion ID (for new posts) */
  discussionid?: number;
  /** Parent post ID (for replies) */
  parentid?: number;
  /** Existing post data (for edits) */
  post?: Post;
  /** Whether form is for reply vs new discussion */
  isReply: boolean;
  /** Whether form is submitting */
  isSubmitting?: boolean;
  /** Maximum attachment size in bytes */
  maxBytes: number;
  /** Maximum number of attachments */
  maxAttachments: number;
  /** Callback when form is submitted */
  onSubmit: (data: CreatePostData | UpdatePostData) => void;
  /** Callback when form is cancelled */
  onCancel: () => void;
}

/**
 * Props for SubscriptionToggle component
 * Toggle button for forum subscription
 */
export interface SubscriptionToggleProps {
  /** Forum ID */
  forumid: number;
  /** Current subscription status */
  isSubscribed: boolean;
  /** Whether toggle is disabled */
  disabled?: boolean;
  /** Whether action is in progress */
  isLoading?: boolean;
  /** Callback when toggling subscription */
  onToggle: () => void;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Forum list item for catalog/overview displays
 */
export interface ForumListItem {
  /** Forum entity */
  forum: Forum;
  /** Number of discussions */
  discussionCount: number;
  /** Number of unread posts (if tracking enabled) */
  unreadCount?: number;
  /** Latest discussion summary */
  latestDiscussion?: DiscussionSummary;
}

/**
 * Forum statistics
 */
export interface ForumStatistics {
  /** Total number of discussions */
  totalDiscussions: number;
  /** Total number of posts */
  totalPosts: number;
  /** Number of unread posts for current user */
  unreadPosts: number;
  /** Number of users subscribed */
  subscriberCount: number;
}

/**
 * Search/filter criteria for forums and discussions
 */
export interface ForumSearchCriteria {
  /** Search query string */
  query?: string;
  /** Filter by forum type */
  forumType?: ForumType;
  /** Filter by user ID (posts by user) */
  userid?: number;
  /** Filter by group ID */
  groupid?: number;
  /** Only show unread posts */
  unreadOnly?: boolean;
  /** Date range start */
  dateFrom?: number;
  /** Date range end */
  dateTo?: number;
}

/**
 * Options for fetching discussion lists
 * Used by getDiscussions API function
 */
export interface DiscussionListOptions {
  /** Page number for pagination (1-based) */
  page?: number;
  /** Number of items per page */
  perPage?: number;
  /** Sort field (date, replies, author) */
  sortBy?: 'date' | 'replies' | 'author';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Filter type (all, unread, pinned) */
  filter?: 'all' | 'unread' | 'pinned';
  /** Filter by group ID */
  groupid?: number;
}

/**
 * Subscription preferences for forums
 * Controls email notifications and digest settings
 */
export interface SubscriptionPreferences {
  /** Enable immediate email notification for new posts */
  emailNotifications?: boolean;
  /** Enable daily digest of forum posts */
  emailDigest?: boolean;
  /** Digest format (plain text or HTML) */
  digestFormat?: 'plain' | 'html';
}
