/**
 * Glossary Activity Module TypeScript Type Definitions
 *
 * Comprehensive type definitions for the Moodle glossary activity module.
 * Based on Moodle's glossary database schema (install.xml) and external API structures.
 *
 * @module features/activities/glossary/types
 */

import type { ContextId } from '@/types/common';

// ============================================================================
// Enumerations
// ============================================================================

/**
 * Display format options for glossary
 * Based on glossary_formats table and displayformat field
 */
export enum GlossaryDisplayFormat {
  /** Classic dictionary view with alphabetical navigation */
  DICTIONARY = 'dictionary',
  /** Continuous entries without category breaks */
  CONTINUOUS = 'continuous',
  /** Encyclopedia style with full entry display */
  ENCYCLOPEDIA = 'encyclopedia',
  /** Simple list of entries */
  ENTRY_LIST = 'entrylist',
  /** Frequently Asked Questions format */
  FAQ = 'faq',
  /** Full entry view with author information */
  FULLWITHAUTHOR = 'fullwithauthor',
  /** Full entry view without author information */
  FULLWITHOUTAUTHOR = 'fullwithoutauthor',
}

/**
 * Browse mode options for navigating glossary entries
 * Derived from glossary display format tabs
 */
export enum GlossaryBrowseMode {
  /** Browse alphabetically by first letter */
  LETTER = 'letter',
  /** Browse by category */
  CAT = 'cat',
  /** Browse by date created/modified */
  DATE = 'date',
  /** Browse by entry author */
  AUTHOR = 'author',
}

/**
 * Entry approval status
 * Based on approved field in glossary_entries table
 */
export enum GlossaryApprovalStatus {
  /** Entry awaiting approval */
  PENDING = 0,
  /** Entry approved and visible */
  APPROVED = 1,
  /** Entry rejected (not used in current Moodle but included for completeness) */
  REJECTED = -1,
}

/**
 * Text format types used in Moodle
 * Based on definitionformat field
 */
export enum TextFormat {
  /** Moodle auto-format */
  MOODLE = 0,
  /** HTML format */
  HTML = 1,
  /** Plain text */
  PLAIN = 2,
  /** Markdown format */
  MARKDOWN = 4,
}

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Main Glossary interface representing a glossary activity
 * Based on mdl_glossary table schema
 */
export interface Glossary {
  /** Glossary ID (primary key) */
  id: number;

  /** Course ID this glossary belongs to */
  course: number;

  /** Course module ID */
  coursemodule: number;

  /** Glossary name (max 1333 chars) */
  name: string;

  /** Introduction text */
  intro: string;

  /** Introduction text format (TextFormat enum) */
  introformat: TextFormat;

  /** Display format for entries */
  displayformat: GlossaryDisplayFormat;

  /** Allow duplicate entries for same concept */
  allowduplicatedentries: boolean;

  /** Is this the main glossary for the course */
  mainglossary: boolean;

  /** Show special characters link */
  showspecial: boolean;

  /** Show alphabet navigation */
  showalphabet: boolean;

  /** Show ALL link */
  showall: boolean;

  /** Allow comments on entries */
  allowcomments: boolean;

  /** Allow print view */
  allowprintview: boolean;

  /** Use dynamic linking of concepts */
  usedynalink: boolean;

  /** Default approval status for new entries */
  defaultapproval: boolean;

  /** Display format when approving entries */
  approvaldisplayformat: string;

  /** Is this a global glossary */
  globalglossary: boolean;

  /** Entries per page */
  entbypage: number;

  /** Allow editing at any time */
  editalways: boolean;

  /** RSS feed type */
  rsstype: number;

  /** Number of RSS articles */
  rssarticles: number;

  /** Assessed (grading enabled) */
  assessed: number;

  /** Assessment start time (Unix timestamp) */
  assesstimestart: number;

  /** Assessment end time (Unix timestamp) */
  assesstimefinish: number;

  /** Scale ID for ratings */
  scale: number;

  /** Time created (Unix timestamp) */
  timecreated: number;

  /** Time modified (Unix timestamp) */
  timemodified: number;

  /** Number of entries required for completion */
  completionentries: number;

  /** Can current user add entries */
  canaddentry: boolean;

  /** Available browse modes for this glossary */
  browsemodes: GlossaryBrowseMode[];
}

/**
 * Glossary entry interface
 * Based on mdl_glossary_entries table schema and external API structure
 */
export interface GlossaryEntry {
  /** Entry ID (primary key) */
  id: number;

  /** Parent glossary ID */
  glossaryid: number;

  /** Author user ID */
  userid: number;

  /** Author full name */
  userfullname: string;

  /** Author profile picture URL */
  userpictureurl: string;

  /** Entry concept/term (max 255 chars) */
  concept: string;

  /** Entry definition/description */
  definition: string;

  /** Definition text format */
  definitionformat: TextFormat;

  /** Definition trust flag */
  definitiontrust: boolean;

  /** Has attachment files */
  attachment: boolean;

  /** Array of attachment files */
  attachments: GlossaryAttachment[];

  /** Inline files in definition */
  definitioninlinefiles: GlossaryAttachment[];

  /** Use dynamic linking for this entry */
  usedynalink: boolean;

  /** Case sensitive matching */
  casesensitive: boolean;

  /** Full word match only */
  fullmatch: boolean;

  /** Entry approval status */
  approved: boolean;

  /** Created by teacher or equivalent */
  teacherentry: boolean;

  /** Source glossary ID (for imported entries) */
  sourceglossaryid: number;

  /** Category ID (optional) */
  categoryid?: number;

  /** Category name (optional) */
  categoryname?: string;

  /** Entry aliases/keywords (newline separated) */
  aliases?: string;

  /** Entry tags */
  tags: GlossaryTag[];

  /** Time created (Unix timestamp) */
  timecreated: number;

  /** Time modified (Unix timestamp) */
  timemodified: number;
}

/**
 * Glossary category for organizing entries
 * Based on mdl_glossary_categories table
 */
export interface GlossaryCategory {
  /** Category ID (primary key) */
  id: number;

  /** Parent glossary ID */
  glossaryid: number;

  /** Category name (max 255 chars) */
  name: string;

  /** Use dynamic linking for category entries */
  usedynalink: boolean;

  /** Number of entries in this category (optional, computed) */
  entrycount?: number;
}

/**
 * Glossary entry rating
 * Based on mdl_rating table structure
 */
export interface GlossaryRating {
  /** Rating ID */
  id: number;

  /** Component name (always 'mod_glossary') */
  component: string;

  /** Rating area (always 'entry') */
  ratingarea: string;

  /** Context ID */
  contextid: ContextId;

  /** Item ID (entry ID) */
  itemid: number;

  /** Scale ID */
  scaleid: number;

  /** Rating value */
  rating: number;

  /** User who gave the rating */
  userid: number;

  /** Time created (Unix timestamp) */
  timecreated: number;

  /** Time modified (Unix timestamp) */
  timemodified: number;

  /** Aggregate rating value (optional, computed) */
  aggregate?: number;
}

/**
 * Glossary entry comment
 * Based on mdl_comments table structure
 */
export interface GlossaryComment {
  /** Comment ID */
  id: number;

  /** Context ID */
  contextid: ContextId;

  /** Component name (always 'mod_glossary') */
  component: string;

  /** Comment area (always 'glossary_entry') */
  commentarea: string;

  /** Item ID (entry ID) */
  itemid: number;

  /** Comment content */
  content: string;

  /** Comment text format */
  format: TextFormat;

  /** User who posted the comment */
  userid: number;

  /** Commenter full name */
  userfullname: string;

  /** Commenter profile picture URL */
  userpictureurl: string;

  /** Time created (Unix timestamp) */
  timecreated: number;

  /** Time modified (Unix timestamp) */
  timemodified: number;
}

/**
 * File attachment interface
 * Based on Moodle file storage and external_files structure
 */
export interface GlossaryAttachment {
  /** File name */
  filename: string;

  /** File path relative to file area */
  filepath: string;

  /** File size in bytes */
  filesize: number;

  /** File download URL */
  fileurl: string;

  /** MIME type */
  mimetype: string;

  /** Time modified (Unix timestamp) */
  timemodified: number;

  /** File author (optional) */
  author?: string;

  /** File license (optional) */
  license?: string;

  /** Is external file (optional) */
  isexternalfile?: boolean;

  /** Repository type if external (optional) */
  repositorytype?: string;
}

/**
 * Glossary tag interface
 * Based on core_tag system and external API
 */
export interface GlossaryTag {
  /** Tag ID */
  id: number;

  /** Tag name (display) */
  name: string;

  /** Raw tag name */
  rawname: string;

  /** Is standard tag */
  isstandard: boolean;

  /** Tag collection ID */
  tagcollid: number;

  /** Tag instance ID */
  taginstanceid: number;

  /** Tag instance context ID */
  taginstancecontextid: ContextId;

  /** Item ID (entry ID) */
  itemid: number;

  /** Tag ordering */
  ordering: number;

  /** Tag flag (0 = normal, 1 = inappropriate) */
  flag: number;
}

// ============================================================================
// Input/Form Interfaces
// ============================================================================

/**
 * Form data for creating a new glossary entry
 */
export interface CreateEntryInput {
  /** Parent glossary ID */
  glossaryId: number;

  /** Entry concept/term */
  concept: string;

  /** Entry definition/description */
  definition: string;

  /** Definition text format */
  definitionformat: TextFormat;

  /** Use dynamic linking */
  usedynalink: boolean;

  /** Case sensitive matching */
  casesensitive: boolean;

  /** Full word match only */
  fullmatch: boolean;

  /** Category ID (optional) */
  categoryId?: number;

  /** Entry aliases/keywords (newline separated) */
  aliases?: string;

  /** File attachments (optional) */
  attachments?: File[];
}

/**
 * Form data for updating an existing glossary entry
 */
export interface UpdateEntryInput {
  /** Entry ID to update */
  entryId: number;

  /** Entry concept/term */
  concept: string;

  /** Entry definition/description */
  definition: string;

  /** Definition text format */
  definitionformat: TextFormat;

  /** Use dynamic linking */
  usedynalink: boolean;

  /** Case sensitive matching */
  casesensitive: boolean;

  /** Full word match only */
  fullmatch: boolean;

  /** Category ID (optional) */
  categoryId?: number;

  /** Entry aliases/keywords (newline separated) */
  aliases?: string;

  /** File attachments (optional) */
  attachments?: File[];
}

/**
 * Form data for creating a new glossary category
 */
export interface CreateCategoryInput {
  /** Parent glossary ID */
  glossaryId: number;

  /** Category name */
  name: string;

  /** Use dynamic linking for category entries */
  usedynalink: boolean;
}

/**
 * Form data for updating a glossary category
 */
export interface UpdateCategoryInput {
  /** Category ID to update */
  categoryId: number;

  /** Category name */
  name: string;

  /** Use dynamic linking for category entries */
  usedynalink: boolean;
}

/**
 * Input for rating a glossary entry
 */
export interface RateEntryInput {
  /** Entry ID to rate */
  entryId: number;

  /** Rating value */
  rating: number;

  /** Scale ID */
  scaleid: number;
}

/**
 * Input for posting a comment on an entry
 */
export interface PostCommentInput {
  /** Entry ID to comment on */
  entryId: number;

  /** Comment content */
  content: string;

  /** Comment text format */
  format: TextFormat;
}

/**
 * Input for updating a comment
 */
export interface UpdateCommentInput {
  /** Comment ID to update */
  commentId: number;

  /** Comment content */
  content: string;

  /** Comment text format */
  format: TextFormat;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Form data for creating/editing a glossary
 * Used in glossary configuration forms
 */
export type GlossaryFormData = Omit<
  Glossary,
  'id' | 'timecreated' | 'timemodified' | 'canaddentry' | 'browsemodes'
>;

/**
 * Form data for creating/editing a glossary entry
 * Used in entry forms
 */
export type GlossaryEntryFormData = Omit<
  GlossaryEntry,
  | 'id'
  | 'userid'
  | 'userfullname'
  | 'userpictureurl'
  | 'teacherentry'
  | 'sourceglossaryid'
  | 'tags'
  | 'timecreated'
  | 'timemodified'
  | 'definitioninlinefiles'
  | 'categoryname'
>;

/**
 * Filters for searching/filtering glossary entries
 */
export type GlossaryFilters = {
  /** Search query for concept or definition */
  search?: string;

  /** Filter by category ID */
  categoryId?: number;

  /** Filter by approval status */
  approved?: boolean;

  /** Filter by author user ID */
  userId?: number;

  /** Filter by browse mode */
  browseMode?: GlossaryBrowseMode;

  /** Letter for alphabetical browsing */
  letter?: string;

  /** Sort field */
  sortBy?: 'concept' | 'author' | 'created' | 'modified';

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';

  /** Page number (for pagination) */
  page?: number;

  /** Entries per page */
  perPage?: number;
};

/**
 * Glossary statistics
 * Used for displaying glossary metrics
 */
export type GlossaryStats = {
  /** Total number of entries */
  totalEntries: number;

  /** Number of approved entries */
  approvedEntries: number;

  /** Number of pending entries */
  pendingEntries: number;

  /** Number of categories */
  totalCategories: number;

  /** Number of entries with attachments */
  entriesWithAttachments: number;

  /** Number of comments */
  totalComments: number;

  /** Average rating */
  averageRating?: number;
};

/**
 * Rating statistics for an entry
 */
export interface RatingStats {
  /** Average rating */
  average: number;

  /** Number of ratings */
  count: number;

  /** Sum of all ratings */
  sum: number;

  /** Current user's rating (optional) */
  userRating?: number;
}
