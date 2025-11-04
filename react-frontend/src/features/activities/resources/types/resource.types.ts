/**
 * TypeScript type definitions for Moodle resource activity modules
 *
 * This file provides comprehensive type safety for resource-related data structures
 * used across the Resources feature module, including Resource (file/document), Page,
 * URL, and Folder activity types.
 *
 * Based on Moodle's external API structures:
 * - mod_resource_external (public/mod/resource/classes/external.php)
 * - mod_page_external (public/mod/page/classes/external.php)
 * - mod_url_external (public/mod/url/classes/external.php)
 * - mod_folder_external (public/mod/folder/classes/external.php)
 *
 * @package react-frontend
 * @subpackage features/activities/resources
 */

/**
 * Display type enumeration for resource modules
 *
 * Corresponds to RESOURCELIB_DISPLAY_* constants in Moodle's public/lib/resourcelib.php
 */
export enum ResourceDisplayType {
  /** Automatic display type detection based on file type */
  AUTO = 0,
  /** Embed resource within page frame */
  EMBED = 1,
  /** Display in iframe frame */
  FRAME = 2,
  /** Open in new window/tab */
  NEW = 3,
  /** Force download of resource */
  DOWNLOAD = 4,
  /** Open directly in same window */
  OPEN = 5,
  /** Display in popup window */
  POPUP = 6,
}

/**
 * Resource activity type enumeration
 *
 * Identifies the specific type of resource activity module
 */
export enum ResourceType {
  /** File or document resource */
  RESOURCE = 'resource',
  /** HTML page content */
  PAGE = 'page',
  /** External URL link */
  URL = 'url',
  /** Collection of files in a folder */
  FOLDER = 'folder',
}

/**
 * File metadata interface
 *
 * Represents an individual file object attached to a resource activity.
 * Used in contentfiles, introfiles arrays for resources, pages, and folders.
 */
export interface File {
  /** File name with extension */
  filename: string;

  /** Full file path within Moodle file storage */
  filepath: string;

  /** File size in bytes */
  filesize: number;

  /** Publicly accessible URL to download/view the file */
  fileurl: string;

  /** Unix timestamp of when the file was last modified */
  timemodified: number;

  /** MIME type of the file (e.g., 'application/pdf', 'image/png') */
  mimetype: string;

  /** Whether this is an external file (not stored in Moodle's file system) */
  isexternalfile: boolean;

  /** External repository source if isexternalfile is true */
  repositorytype?: string;
}

/**
 * Display options configuration interface
 *
 * Defines visual presentation settings for resource activities.
 * Serialized as JSON in the displayoptions field of resource records.
 */
export interface DisplayOptions {
  /** Display width in pixels (for embedded or popup display) */
  width?: number;

  /** Display height in pixels (for embedded or popup display) */
  height?: number;

  /** Whether to print the intro/description text (0 = no, 1 = yes) */
  printintro?: number;

  /** Whether to print the resource heading/title (0 = no, 1 = yes) */
  printheading?: number;

  /** Popup window width in pixels (when display type is POPUP) */
  popupwidth?: number;

  /** Popup window height in pixels (when display type is POPUP) */
  popupheight?: number;

  /** Whether to show resource size information */
  showsize?: number;

  /** Whether to show file type icon */
  showtype?: number;

  /** Whether to show last modified date */
  showdate?: number;
}

/**
 * Base course module properties interface
 *
 * Common properties shared by all activity module types.
 * These fields come from helper_for_get_mods_by_courses::standard_coursemodule_elements_returns()
 */
export interface BaseCourseModule {
  /** Unique identifier for this activity instance */
  id: number;

  /** Course module ID (cm.id) */
  coursemodule: number;

  /** Course ID this activity belongs to */
  course: number;

  /** Activity name/title */
  name: string;

  /** Introduction/description text */
  intro: string;

  /** Format of intro text (1 = HTML, 0 = MOODLE, 2 = PLAIN, 4 = MARKDOWN) */
  introformat: number;

  /** Files attached to the introduction area */
  introfiles: File[];

  /** Section number within the course (0 = general section) */
  section: number;

  /** Visibility status (0 = hidden, 1 = visible) */
  visible: number;

  /** Group mode (0 = no groups, 1 = separate groups, 2 = visible groups) */
  groupmode: number;

  /** Grouping ID if groupings are used (0 = none) */
  groupingid: number;
}

/**
 * Resource (File/Document) activity interface
 *
 * Represents a file or document resource activity module.
 * Corresponds to the 'resource' database table and mod_resource_external API.
 *
 * @example
 * ```typescript
 * const resource: Resource = {
 *   id: 42,
 *   coursemodule: 156,
 *   course: 3,
 *   name: "Course Syllabus",
 *   intro: "Read the syllabus carefully",
 *   introformat: 1,
 *   introfiles: [],
 *   contentfiles: [{
 *     filename: "syllabus.pdf",
 *     filepath: "/",
 *     filesize: 245680,
 *     fileurl: "https://moodle.example.com/pluginfile.php/...",
 *     timemodified: 1640995200,
 *     mimetype: "application/pdf",
 *     isexternalfile: false
 *   }],
 *   tobemigrated: 0,
 *   legacyfiles: 0,
 *   legacyfileslast: 0,
 *   display: ResourceDisplayType.AUTO,
 *   displayoptions: "{}",
 *   filterfiles: 1,
 *   revision: 5,
 *   timemodified: 1640995200,
 *   section: 1,
 *   visible: 1,
 *   groupmode: 0,
 *   groupingid: 0
 * };
 * ```
 */
export interface Resource extends BaseCourseModule {
  /** Array of content files attached to this resource */
  contentfiles: File[];

  /** Flag indicating if resource needs migration from old format (0 = no, 1 = yes) */
  tobemigrated: number;

  /** Legacy files flag for backward compatibility (0 = no, 1 = yes) */
  legacyfiles: number;

  /** Legacy files last control flag (timestamp or 0) */
  legacyfileslast: number;

  /** How to display the resource (see ResourceDisplayType enum) */
  display: ResourceDisplayType;

  /** JSON-encoded display options (width, height, popup settings) */
  displayoptions: string;

  /** Whether to apply filters to resource content (0 = no, 1 = yes) */
  filterfiles: number;

  /** Revision number, incremented after each file change to avoid caching issues */
  revision: number;

  /** Unix timestamp of when this resource was last modified */
  timemodified: number;
}

/**
 * Page (HTML Content) activity interface
 *
 * Represents an HTML page activity module with formatted content.
 * Corresponds to the 'page' database table and mod_page_external API.
 *
 * @example
 * ```typescript
 * const page: Page = {
 *   id: 38,
 *   coursemodule: 152,
 *   course: 3,
 *   name: "Introduction to Course",
 *   intro: "Welcome page",
 *   introformat: 1,
 *   introfiles: [],
 *   content: "<h1>Welcome</h1><p>This is the course introduction...</p>",
 *   contentformat: 1,
 *   contentfiles: [],
 *   legacyfiles: 0,
 *   legacyfileslast: 0,
 *   display: ResourceDisplayType.OPEN,
 *   displayoptions: '{"printheading":1,"printintro":0}',
 *   revision: 3,
 *   timemodified: 1640995200,
 *   section: 0,
 *   visible: 1,
 *   groupmode: 0,
 *   groupingid: 0
 * };
 * ```
 */
export interface Page extends BaseCourseModule {
  /** HTML content of the page */
  content: string;

  /** Format of content (1 = HTML, 0 = MOODLE, 2 = PLAIN, 4 = MARKDOWN) */
  contentformat: number;

  /** Files embedded in the page content */
  contentfiles: File[];

  /** Legacy files flag for backward compatibility (0 = no, 1 = yes) */
  legacyfiles: number;

  /** Legacy files last control flag (timestamp or 0) */
  legacyfileslast: number;

  /** How to display the page (see ResourceDisplayType enum) */
  display: ResourceDisplayType;

  /** JSON-encoded display options (printheading, printintro, etc.) */
  displayoptions: string;

  /** Revision number, incremented after each content change */
  revision: number;

  /** Unix timestamp of when this page was last modified */
  timemodified: number;
}

/**
 * URL (External Link) activity interface
 *
 * Represents an external URL link activity module.
 * Corresponds to the 'url' database table and mod_url_external API.
 *
 * @example
 * ```typescript
 * const url: URL = {
 *   id: 44,
 *   coursemodule: 158,
 *   course: 3,
 *   name: "Course Textbook Website",
 *   intro: "Official textbook companion site",
 *   introformat: 1,
 *   introfiles: [],
 *   externalurl: "https://textbook.example.com/chapter1",
 *   display: ResourceDisplayType.NEW,
 *   displayoptions: '{"popupwidth":800,"popupheight":600}',
 *   parameters: "",
 *   timemodified: 1640995200,
 *   section: 1,
 *   visible: 1,
 *   groupmode: 0,
 *   groupingid: 0
 * };
 * ```
 */
export interface URL extends BaseCourseModule {
  /** The external URL to link to */
  externalurl: string;

  /** How to display the URL (see ResourceDisplayType enum) */
  display: ResourceDisplayType;

  /** JSON-encoded display options (popup dimensions, etc.) */
  displayoptions: string;

  /** Additional URL parameters to append (query string format) */
  parameters: string;

  /** Unix timestamp of when this URL was last modified */
  timemodified: number;
}

/**
 * Folder (File Collection) activity interface
 *
 * Represents a folder containing multiple files.
 * Corresponds to the 'folder' database table and mod_folder_external API.
 *
 * @example
 * ```typescript
 * const folder: Folder = {
 *   id: 51,
 *   coursemodule: 164,
 *   course: 3,
 *   name: "Course Materials",
 *   intro: "All course PDFs and documents",
 *   introformat: 1,
 *   introfiles: [],
 *   files: [
 *     {
 *       filename: "lecture1.pdf",
 *       filepath: "/",
 *       filesize: 1024000,
 *       fileurl: "https://moodle.example.com/pluginfile.php/...",
 *       timemodified: 1640995200,
 *       mimetype: "application/pdf",
 *       isexternalfile: false
 *     },
 *     {
 *       filename: "lecture2.pdf",
 *       filepath: "/week2/",
 *       filesize: 856000,
 *       fileurl: "https://moodle.example.com/pluginfile.php/...",
 *       timemodified: 1641081600,
 *       mimetype: "application/pdf",
 *       isexternalfile: false
 *     }
 *   ],
 *   revision: 7,
 *   timemodified: 1641081600,
 *   display: ResourceDisplayType.OPEN,
 *   showexpanded: 1,
 *   showdownloadfolder: 1,
 *   forcedownload: 0,
 *   section: 2,
 *   visible: 1,
 *   groupmode: 0,
 *   groupingid: 0
 * };
 * ```
 */
export interface Folder extends BaseCourseModule {
  /** Array of files contained in this folder */
  files: File[];

  /** Revision number, incremented after file changes */
  revision: number;

  /** Unix timestamp of when this folder was last modified */
  timemodified: number;

  /** How to display the folder (inline or separate page) */
  display: ResourceDisplayType;

  /** Whether sub-folders are expanded by default (0 = collapsed, 1 = expanded) */
  showexpanded: number;

  /** Whether to show a button to download the entire folder as ZIP (0 = no, 1 = yes) */
  showdownloadfolder: number;

  /** Whether file downloads are forced (bypass browser display) (0 = no, 1 = yes) */
  forcedownload: number;
}

/**
 * API response wrapper for resources list
 *
 * Standard Moodle API response structure for get_resources_by_courses endpoint
 */
export interface ResourcesResponse {
  /** Array of resource activities */
  resources: Resource[];

  /** Array of warning messages, if any */
  warnings: Array<{
    /** Warning item identifier */
    item?: string;
    /** Warning item ID */
    itemid?: number;
    /** Warning code */
    warningcode: string;
    /** Human-readable warning message */
    message: string;
  }>;
}

/**
 * API response wrapper for pages list
 *
 * Standard Moodle API response structure for get_pages_by_courses endpoint
 */
export interface PagesResponse {
  /** Array of page activities */
  pages: Page[];

  /** Array of warning messages, if any */
  warnings: Array<{
    item?: string;
    itemid?: number;
    warningcode: string;
    message: string;
  }>;
}

/**
 * API response wrapper for URLs list
 *
 * Standard Moodle API response structure for get_urls_by_courses endpoint
 */
export interface URLsResponse {
  /** Array of URL activities */
  urls: URL[];

  /** Array of warning messages, if any */
  warnings: Array<{
    item?: string;
    itemid?: number;
    warningcode: string;
    message: string;
  }>;
}

/**
 * API response wrapper for folders list
 *
 * Standard Moodle API response structure for get_folders_by_courses endpoint
 */
export interface FoldersResponse {
  /** Array of folder activities */
  folders: Folder[];

  /** Array of warning messages, if any */
  warnings: Array<{
    item?: string;
    itemid?: number;
    warningcode: string;
    message: string;
  }>;
}

/**
 * Union type for all resource activity types
 *
 * Useful for components that can handle any resource type generically
 */
export type AnyResource = Resource | Page | URL | Folder;

/**
 * Type guard to check if a resource is a Resource (file/document)
 */
export function isResource(resource: AnyResource): resource is Resource {
  return 'contentfiles' in resource && 'tobemigrated' in resource;
}

/**
 * Type guard to check if a resource is a Page
 */
export function isPage(resource: AnyResource): resource is Page {
  return 'content' in resource && 'contentformat' in resource;
}

/**
 * Type guard to check if a resource is a URL
 */
export function isURL(resource: AnyResource): resource is URL {
  return 'externalurl' in resource;
}

/**
 * Type guard to check if a resource is a Folder
 */
export function isFolder(resource: AnyResource): resource is Folder {
  return 'files' in resource && 'showexpanded' in resource;
}
