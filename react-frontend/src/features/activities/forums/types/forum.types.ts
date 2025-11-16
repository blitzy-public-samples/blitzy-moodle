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
  /** Whether the current user is subscribed to the forum */
  subscribed: boolean;
  /** Whether the current user can subscribe/unsubscribe to the forum */
  canSubscribe: boolean;
  /** Whether the current user can create a new discussion in this forum */
  canAddDiscussion: boolean;
  /** Whether the current user can moderate discussions (lock, pin, move, delete) */
  canModerate: boolean;
  /** Number of unread discussions for the current user */
  unreadCount: number;
  /** Total number of discussions in the forum */
  discussionCount: number;
  /** Total number of posts in the forum */
  postCount: number;
  /** Number of participants in the forum */
  participants: number;
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

/**
 * Enriched Discussion entity returned from API
 * 
 * The API returns enriched discussion data that includes user information,
 * reply counts, and read status that aren't in the base Discussion entity.
 * This interface represents the actual API response format.
 */
export interface DiscussionEnriched {
  /** Discussion ID */
  id: number;
  /** Discussion name/title */
  name: string;
  /** User ID who created the discussion */
  userid: number;
  /** Full name of the user who created the discussion */
  userFullName?: string;
  /** URL to the user's profile picture */
  userPictureUrl?: string | null;
  /** Timestamp when discussion was created (Unix timestamp) */
  created: number;
  /** Number of replies to this discussion */
  numReplies?: number;
  /** Number of unread posts in this discussion for current user */
  numUnreadPosts?: number;
  /** Whether the discussion is pinned */
  pinned?: boolean;
  /** Whether the discussion is locked */
  locked?: boolean;
  /** Timestamp when discussion was locked (0 if not locked) */
  timelocked?: number;
  /** Forum ID this discussion belongs to */
  forumid: number;
  /** Course ID */
  courseid: number;
  /** ID of the first post in the discussion */
  firstpostid: number;
  /** Group ID if this is a group discussion (0 for all participants) */
  groupid?: number;
  /** Timestamp of last modification */
  timemodified: number;
}

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
  /** Whether the discussion is pinned (optional, only for first post) */
  pinned?: boolean;
  /** Whether the discussion is locked (optional, only for first post) */
  locked?: boolean;
  /** Tags associated with the post (optional) */
  tags?: string[];
}

/**
 * Post response from API mutations
 * Represents the server response when creating or updating a post
 */
export interface PostResponse extends Post {
  /** Discussion ID (for consistency with API responses) */
  discussionId: number;
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
 * Enhanced discussion with computed metadata
 * Used by DiscussionThread component for display
 */
export interface DiscussionDetail extends Discussion {
  /** Author of the discussion (from first post) */
  author: Author;
  /** Creation timestamp (from first post) */
  created: number;
  /** Number of times the discussion has been viewed */
  numViews: number;
  /** Number of unique participants in the discussion */
  numParticipants: number;
  /** Number of replies (total posts minus 1) */
  numReplies: number;
  /** Number of unread replies for current user */
  unreadCount?: number;
  /** Whether current user is subscribed to this discussion */
  subscribed: boolean;
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
 * Enhanced post representation for discussion threads
 * Includes author information, permissions, and nested reply structure
 * Used by useDiscussion hook for rich UI display
 */
export interface DiscussionPost {
  /** Post ID */
  id: number;
  /** Discussion ID this post belongs to */
  discussionId: number;
  /** Parent post ID (null if top-level post) */
  parentId: number | null;
  /** Post subject/title */
  subject: string;
  /** Post message content */
  message: string;
  /** User ID of the post author */
  userId: number;
  /** Full name of the post author */
  userName: string;
  /** Profile picture URL of the author */
  userPictureUrl: string;
  /** Timestamp when post was created */
  created: number;
  /** Timestamp when post was last modified */
  modified: number;
  /** Version number for concurrent edit detection */
  version: number;
  /** Whether the post is deleted (soft delete) */
  deleted: boolean;
  /** Whether this post has file attachments */
  hasAttachments: boolean;
  /** Array of attachment file information */
  attachments: Array<{
    id: number;
    filename: string;
    filesize: number;
    mimetype: string;
    url: string;
  }>;
  /** Whether current user can edit this post */
  canEdit: boolean;
  /** Whether current user can delete this post */
  canDelete: boolean;
  /** Whether current user can reply to this post */
  canReply: boolean;
  /** Whether this post is unread by the current user */
  unread?: boolean;
  /** Nested array of reply posts */
  replies: DiscussionPost[];
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
 * Data required to create a new post (reply) or discussion
 * Unified API interface for post creation
 */
export interface CreatePostData {
  /** Forum ID where the post/discussion is being created */
  forumId: number;
  /** Discussion ID (for replies) - omit for new discussions */
  discussionId?: number;
  /** Parent post ID for nested replies (optional) */
  parentPostId?: number;
  /** Subject line (required for new discussions, omitted for replies) */
  subject?: string;
  /** Post message content */
  message: string;
  /** Whether to subscribe to discussion notifications */
  subscribe?: boolean;
  /** File attachments (optional) */
  attachments?: File[];
}

/**
 * Data required to update an existing post
 * Simplified API interface for post updates
 */
export interface UpdatePostData {
  /** Post ID to update */
  postId: number;
  /** Updated subject (if applicable) */
  subject?: string;
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
 * User role in forum context
 * Used for displaying role badges on posts
 */
export type UserRole = 'student' | 'teacher' | 'moderator';

/**
 * Post attachment entity
 * Represents a file attached to a forum post
 */
export interface PostAttachment {
  /** Attachment ID */
  id: number;
  /** Original filename */
  filename: string;
  /** File size in bytes */
  filesize: number;
  /** MIME type of the file */
  mimetype: string;
  /** URL to download the file */
  fileurl: string;
  /** Timestamp when file was last modified */
  timemodified: Date;
}

/**
 * Author information for PostCard component
 * Simplified author structure with camelCase properties
 */
export interface PostAuthor {
  /** User ID */
  id: number;
  /** First name */
  firstName: string;
  /** Last name */
  lastName: string;
  /** Full display name */
  fullName: string;
  /** Profile image URL */
  profileImageUrl: string;
  /** Profile page URL */
  profileUrl: string;
  /** User role (optional) */
  role?: UserRole;
}

/**
 * Forum post entity for PostCard component
 * Extended post structure with all display and permission data
 */
export interface ForumPost {
  /** Post ID */
  id: number;
  /** Discussion ID this post belongs to */
  discussionId: number;
  /** Parent post ID for nested replies (null for top-level posts) */
  parentId: number | null;
  /** Post subject/title */
  subject: string;
  /** Post message content (HTML) */
  message: string;
  /** Message format (1=HTML, 2=plain, etc.) */
  messageFormat: number;
  /** Post author information */
  author: PostAuthor;
  /** Timestamp when post was created */
  created: Date;
  /** Timestamp when post was last modified (null if never edited) */
  modified: Date | null;
  /** User who last edited the post (null if never edited) */
  editedBy: PostAuthor | null;
  /** Whether the post has been deleted */
  deleted: boolean;
  /** User who deleted the post (null if not deleted) */
  deletedBy: PostAuthor | null;
  /** Timestamp when post was deleted (null if not deleted) */
  deletedAt: Date | null;
  /** List of file attachments */
  attachments: PostAttachment[];
  /** Whether post has inline files/images */
  hasInlineFiles: boolean;
  /** Word count of the message */
  wordCount: number;
  /** Character count of the message */
  charCount: number;
  /** Whether current user can edit this post */
  canEdit: boolean;
  /** Whether current user can delete this post */
  canDelete: boolean;
  /** Whether current user can reply to this post */
  canReply: boolean;
  /** Whether current user can split this post */
  canSplit: boolean;
  /** Whether current user can export this post */
  canExport: boolean;
  /** Whether current user can control read tracking */
  canControlReadTracking: boolean;
  /** Whether to send immediate email notification */
  mailNow: boolean;
  /** Whether post is unread by current user */
  unread: boolean;
  /** Average rating for the post (null if no ratings) */
  rating: number | null;
  /** Current user's rating (null if not rated) */
  userRating: number | null;
  /** Number of replies to this post */
  replyCount: number;
  /** Number of likes on this post */
  likeCount: number;
  /** Whether current user has liked this post */
  userHasLiked: boolean;
  /** Whether post is pending moderation approval */
  isPending: boolean;
  /** Whether post has been approved by moderator */
  moderatorApproved: boolean;
}

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
