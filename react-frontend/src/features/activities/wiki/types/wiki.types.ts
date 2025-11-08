/**
 * TypeScript type definitions for Moodle wiki activity module.
 *
 * Based on Moodle wiki database schema and external API specifications.
 * Provides comprehensive type safety for wiki-related data structures including
 * wikis, pages, versions, subwikis, locks, links, and synonyms.
 *
 * @module wiki.types
 */

/**
 * Wiki mode enumeration.
 * Determines whether the wiki is collaborative (shared by all users) or
 * individual (each user/group has their own wiki).
 */
export type WikiMode = 'collaborative' | 'individual';

/**
 * Wiki content format enumeration.
 * Specifies the markup language used for wiki content.
 */
export type WikiFormat = 'html' | 'creole' | 'nwiki';

/**
 * Main wiki activity configuration interface.
 * Represents a wiki instance within a course.
 *
 * Database table: wiki
 */
export interface Wiki {
  /** Wiki instance ID */
  id: number;

  /** Course ID this wiki belongs to */
  course: number;

  /** Wiki activity name */
  name: string;

  /** General introduction/description of the wiki activity */
  intro: string;

  /** Format of the intro field (MOODLE, HTML, MARKDOWN, etc.) */
  introformat: number;

  /** Title of the first page created in the wiki */
  firstpagetitle: string;

  /** Wiki mode: 'collaborative' or 'individual' */
  wikimode: WikiMode;

  /** Default editor format for wiki pages */
  defaultformat: WikiFormat;

  /** Whether to force the default format (1) or allow users to choose (0) */
  forceformat: number;

  /** Timestamp when wiki editing begins (0 = no restriction) */
  editbegin: number;

  /** Timestamp when wiki editing ends (0 = no restriction) */
  editend: number;

  /** Timestamp when the wiki was created */
  timecreated: number;

  /** Timestamp when the wiki was last modified */
  timemodified: number;

  /** Computed field: whether the current user can create new pages */
  cancreatepages: boolean;
}

/**
 * Subwiki instance interface.
 * Represents a wiki instance for a specific group or individual user.
 * In collaborative mode, there's typically one subwiki per group.
 * In individual mode, each user has their own subwiki.
 *
 * Database table: wiki_subwikis
 */
export interface WikiSubwiki {
  /** Subwiki instance ID */
  id: number;

  /** Wiki activity ID this subwiki belongs to */
  wikiid: number;

  /** Group ID that owns this subwiki (0 for no group) */
  groupid: number;

  /** User ID that owns this subwiki (0 for collaborative wikis) */
  userid: number;

  /** Computed field: whether the current user can edit this subwiki */
  canedit: boolean;
}

/**
 * Wiki page interface.
 * Represents a single page within a subwiki, including content and metadata.
 *
 * Database table: wiki_pages
 */
export interface WikiPage {
  /** Page ID */
  id: number;

  /** Subwiki instance ID this page belongs to */
  subwikiid: number;

  /** Page title/name */
  title: string;

  /** Cached rendered HTML content (optional, may not be included in list views) */
  cachedcontent?: string;

  /** Format of the cached content (optional, from latest version) */
  contentformat?: WikiFormat;

  /** Timestamp when the page was created */
  timecreated: number;

  /** Timestamp when the page was last modified */
  timemodified: number;

  /** Timestamp when the cached content was last rendered */
  timerendered: number;

  /** User ID of the last editor */
  userid: number;

  /** Number of times the page has been viewed */
  pageviews: number;

  /** Whether the page is read-only (1) or editable (0) */
  readonly: number;

  /** Computed field: whether the current user can edit this page */
  caneditpage: boolean;

  /** Computed field: whether this is the first page of the wiki */
  firstpage: boolean;

  /** Optional: latest version number of the page */
  version?: number;

  /** Optional: size of page contents in bytes (when content not included) */
  contentsize?: number;

  /** Optional: tags associated with the page */
  tags?: Tag[];
}

/**
 * Wiki page version interface.
 * Represents a specific version in a page's edit history.
 * Each edit creates a new version entry.
 *
 * Database table: wiki_versions
 */
export interface WikiVersion {
  /** Version record ID */
  id: number;

  /** Page ID this version belongs to */
  pageid: number;

  /** Raw wiki content for this version (not rendered) */
  content: string;

  /** Markup format used for this content */
  contentformat: WikiFormat;

  /** Version number (sequential, starts at 1) */
  version: number;

  /** Timestamp when this version was created */
  timecreated: number;

  /** User ID of the author of this version */
  userid: number;
}

/**
 * Wiki page lock interface.
 * Represents a temporary lock on a page or page section during editing.
 * Prevents concurrent editing conflicts.
 *
 * Database table: wiki_locks
 */
export interface WikiPageLock {
  /** Lock record ID */
  id: number;

  /** Page ID that is locked */
  pageid: number;

  /** Optional: specific section name that is locked (null = entire page) */
  sectionname: string | null;

  /** User ID of the user holding the lock */
  userid: number;

  /** Timestamp when the lock was acquired */
  lockedat: number;
}

/**
 * Wiki link interface.
 * Represents a link from one wiki page to another (or to a missing page).
 * Used for tracking page relationships and broken links.
 *
 * Database table: wiki_links
 */
export interface WikiLink {
  /** Link record ID */
  id: number;

  /** Subwiki instance ID */
  subwikiid: number;

  /** Source page ID (page containing the link) */
  frompageid: number;

  /** Destination page ID (0 if link is to a missing page) */
  topageid: number;

  /** Title of the missing page (null if topageid is set) */
  tomissingpage: string | null;
}

/**
 * Wiki page synonym interface.
 * Allows multiple names to refer to the same page.
 *
 * Database table: wiki_synonyms
 */
export interface WikiSynonym {
  /** Synonym record ID */
  id: number;

  /** Subwiki instance ID */
  subwikiid: number;

  /** Original page ID */
  pageid: number;

  /** Alternative name for the page */
  pagesynonym: string;
}

/**
 * Tag interface for wiki pages.
 * Represents a tag associated with a wiki page.
 */
export interface Tag {
  /** Tag ID */
  id: number;

  /** Tag name/label */
  name: string;

  /** Raw tag name */
  rawname: string;

  /** Whether this is a standard tag */
  isstandard: boolean;

  /** Tag collection ID */
  tagcollid: number;

  /** Tag instance ID */
  taginstanceid: number;

  /** Context ID where the tag is used */
  taginstancecontextid: number;

  /** Item ID (wiki page ID) */
  itemid: number;

  /** Ordering value */
  ordering: number;

  /** Flag value */
  flag: number;
}

/**
 * API response for wiki list endpoint.
 * Contains an array of wikis and optional warnings.
 */
export interface WikiListResponse {
  /** Array of wiki instances */
  wikis: Wiki[];

  /** Optional warnings from the API */
  warnings?: ApiWarning[];
}

/**
 * API response for wiki page list endpoint.
 * Contains an array of pages with pagination metadata.
 */
export interface WikiPageListResponse {
  /** Array of wiki pages */
  pages: WikiPage[];

  /** Optional warnings from the API */
  warnings?: ApiWarning[];
}

/**
 * API response for subwiki list endpoint.
 */
export interface WikiSubwikiListResponse {
  /** Array of subwiki instances */
  subwikis: WikiSubwiki[];

  /** Optional warnings from the API */
  warnings?: ApiWarning[];
}

/**
 * API response for page version history endpoint.
 */
export interface WikiVersionListResponse {
  /** Array of page versions */
  versions: WikiVersion[];

  /** Optional warnings from the API */
  warnings?: ApiWarning[];
}

/**
 * API warning interface.
 * Represents a non-fatal warning returned by the API.
 */
export interface ApiWarning {
  /** Warning code/identifier */
  warningcode: string;

  /** Human-readable warning message */
  message: string;

  /** Optional item identifier related to the warning */
  item?: string;

  /** Optional item ID related to the warning */
  itemid?: number;
}

/**
 * Options for fetching wiki pages.
 */
export interface WikiPageFetchOptions {
  /** Field to sort by (e.g., 'title', 'timemodified') */
  sortby?: string;

  /** Sort direction: 'ASC' or 'DESC' */
  sortdirection?: 'ASC' | 'DESC';

  /** Whether to include full page content (1) or just size (0) */
  includecontent?: number;
}

/**
 * Parameters for creating a new wiki page.
 */
export interface CreateWikiPageParams {
  /** Title of the new page */
  title: string;

  /** Content of the new page */
  content: string;

  /** Content format */
  contentformat: WikiFormat;

  /** Subwiki ID where the page will be created */
  subwikiid: number;
}

/**
 * Parameters for editing an existing wiki page.
 */
export interface EditWikiPageParams {
  /** Page ID to edit */
  pageid: number;

  /** New content for the page */
  content: string;

  /** Content format */
  contentformat?: WikiFormat;

  /** Optional section name if editing a specific section */
  section?: string;
}

/**
 * Result of a wiki page save operation.
 */
export interface SaveWikiPageResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** Page ID (existing or newly created) */
  pageid: number;

  /** New version number */
  version: number;

  /** Optional error message if success is false */
  error?: string;
}

/**
 * Request parameters for saving a wiki page
 * 
 * Used by the wiki edit hook to send save requests to the API.
 */
export interface WikiSaveRequest {
  /** Page content to save */
  content: string;

  /** Content format (HTML, Markdown, etc.) */
  contentFormat: WikiFormat;
}

/**
 * Response from wiki page preview operation
 * 
 * Contains rendered HTML and any parser warnings.
 */
export interface WikiPreviewResponse {
  /** Rendered HTML content */
  html: string;

  /** Whether preview rendering was successful */
  success: boolean;

  /** Optional warning messages from parser */
  warnings?: string[];
}

/**
 * Validation error for wiki content
 * 
 * Describes a validation failure with field, message, and error code.
 */
export interface WikiValidationError {
  /** Field that failed validation */
  field: string;

  /** Human-readable error message */
  message: string;

  /** Error code for programmatic handling */
  code: string;
}
