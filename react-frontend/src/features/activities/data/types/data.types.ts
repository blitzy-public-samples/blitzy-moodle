/**
 * TypeScript Type Definitions for Moodle Database Activity Module
 *
 * Comprehensive type definitions for the Database activity module, providing
 * type-safe interfaces for database instances, records, fields (12 field types),
 * field content, templates, search criteria, and permission structures.
 *
 * Based on Moodle's PHP implementation:
 * - public/mod/data/lib.php
 * - public/mod/data/db/install.xml
 * - public/mod/data/db/access.php
 *
 * @module features/activities/data/types
 */

import type { PaginationMeta } from '@/types/common';

// ============================================================================
// Field Type Enumerations
// ============================================================================

/**
 * Enumeration of all supported field types in the Database activity module.
 *
 * Maps to the 'type' column in mdl_data_fields table.
 */
export enum FieldType {
  /** Simple text input field */
  Text = 'text',

  /** Multi-line textarea field */
  Textarea = 'textarea',

  /** Numeric input field with decimal support */
  Number = 'number',

  /** Date picker field */
  Date = 'date',

  /** Single checkbox field */
  Checkbox = 'checkbox',

  /** Dropdown menu (single select) */
  Menu = 'menu',

  /** Multi-select menu */
  MultiMenu = 'multimenu',

  /** Radio button group */
  RadioButton = 'radiobutton',

  /** File upload field */
  File = 'file',

  /** Image/picture upload field */
  Picture = 'picture',

  /** URL input field */
  URL = 'url',

  /** Latitude/longitude coordinate field */
  LatLong = 'latlong',
}

/**
 * Enumeration of template types for database activity.
 *
 * Templates control how database entries are displayed and edited.
 */
export enum TemplateType {
  /** Template for displaying a single entry */
  Single = 'single',

  /** Template for displaying list of entries */
  List = 'list',

  /** Template for adding new entries */
  Add = 'add',

  /** Template for advanced search interface */
  Search = 'search',

  /** Template for RSS feed output */
  RSS = 'rss',

  /** CSS template for styling */
  CSS = 'css',

  /** JavaScript template for interactivity */
  JavaScript = 'javascript',
}

// ============================================================================
// Base Field Interfaces
// ============================================================================

/**
 * Common properties shared by all field types.
 *
 * Maps to mdl_data_fields table structure.
 */
interface BaseField {
  /**
   * Unique field identifier
   * Maps to: id (int 10)
   */
  id: number;

  /**
   * Database activity instance this field belongs to
   * Maps to: dataid (int 10)
   */
  dataid: number;

  /**
   * Field type identifier
   * Maps to: type (char 255)
   */
  type: FieldType;

  /**
   * Field display name
   * Maps to: name (char 255)
   */
  name: string;

  /**
   * Field description for users
   * Maps to: description (text)
   */
  description: string;

  /**
   * Whether this field is required for entry submission
   * Maps to: required (int 1)
   * 0 = optional, 1 = required
   */
  required: boolean;
}

// ============================================================================
// Specific Field Type Interfaces
// ============================================================================

/**
 * Text field type for short text input.
 *
 * Configuration:
 * - param1: Maximum character length (default: 60)
 */
export interface TextField extends BaseField {
  type: FieldType.Text;

  /**
   * Maximum character length for text input
   * Maps to: param1 (text)
   */
  param1?: string;
}

/**
 * Textarea field type for multi-line text input.
 *
 * Configuration:
 * - param1: Width in columns
 * - param2: Height in rows
 */
export interface TextAreaField extends BaseField {
  type: FieldType.Textarea;

  /**
   * Width in columns
   * Maps to: param1 (text)
   */
  param1?: string;

  /**
   * Height in rows
   * Maps to: param2 (text)
   */
  param2?: string;
}

/**
 * Number field type for numeric input with decimal support.
 *
 * Configuration:
 * - param1: Number of decimal places (0-10)
 */
export interface NumberField extends BaseField {
  type: FieldType.Number;

  /**
   * Number of decimal places to display (0-10)
   * Maps to: param1 (text)
   */
  param1?: string;
}

/**
 * Date field type for date selection.
 *
 * No specific parameters required.
 */
export interface DateField extends BaseField {
  type: FieldType.Date;
}

/**
 * Checkbox field type for boolean yes/no input.
 *
 * No specific parameters required.
 */
export interface CheckboxField extends BaseField {
  type: FieldType.Checkbox;
}

/**
 * Menu field type for dropdown single selection.
 *
 * Configuration:
 * - param1: Menu options (newline-separated list)
 */
export interface MenuField extends BaseField {
  type: FieldType.Menu;

  /**
   * Menu options as newline-separated string
   * Maps to: param1 (text)
   * Example: "Option 1\nOption 2\nOption 3"
   */
  param1?: string;
}

/**
 * Multi-menu field type for multiple selection dropdown.
 *
 * Configuration:
 * - param1: Menu options (newline-separated list)
 */
export interface MultiMenuField extends BaseField {
  type: FieldType.MultiMenu;

  /**
   * Menu options as newline-separated string
   * Maps to: param1 (text)
   * Example: "Option 1\nOption 2\nOption 3"
   */
  param1?: string;
}

/**
 * Radio button field type for single selection from options.
 *
 * Configuration:
 * - param1: Radio button options (newline-separated list)
 */
export interface RadioButtonField extends BaseField {
  type: FieldType.RadioButton;

  /**
   * Radio button options as newline-separated string
   * Maps to: param1 (text)
   * Example: "Option 1\nOption 2\nOption 3"
   */
  param1?: string;
}

/**
 * File field type for file uploads.
 *
 * No specific parameters required.
 */
export interface FileField extends BaseField {
  type: FieldType.File;
}

/**
 * Picture field type for image uploads.
 *
 * Configuration:
 * - param1: Width for single view (pixels)
 * - param2: Height for single view (pixels)
 */
export interface PictureField extends BaseField {
  type: FieldType.Picture;

  /**
   * Width for single view in pixels
   * Maps to: param1 (text)
   */
  param1?: string;

  /**
   * Height for single view in pixels
   * Maps to: param2 (text)
   */
  param2?: string;
}

/**
 * URL field type for web links.
 *
 * Configuration:
 * - param1: Force link (0=no, 1=yes)
 * - param2: Link text (default: URL itself)
 * - param3: Display mode (0=URL, 1=linked text, 2=both)
 */
export interface URLField extends BaseField {
  type: FieldType.URL;

  /**
   * Force display as clickable link
   * Maps to: param1 (text)
   * "0" = no (display as text), "1" = yes (display as link)
   */
  param1?: string;

  /**
   * Default text to display for the link
   * Maps to: param2 (text)
   */
  param2?: string;

  /**
   * Display mode
   * Maps to: param3 (text)
   * "0" = URL only, "1" = linked text, "2" = URL and linked text
   */
  param3?: string;
}

/**
 * Latitude/Longitude field type for geographic coordinates.
 *
 * No specific parameters required.
 * Stores coordinates in the format: latitude,longitude
 */
export interface LatLongField extends BaseField {
  type: FieldType.LatLong;
}

/**
 * Discriminated union type for all database field types.
 *
 * Enables type-safe handling of different field types based on the 'type' discriminator.
 */
export type DatabaseField =
  | TextField
  | TextAreaField
  | NumberField
  | DateField
  | CheckboxField
  | MenuField
  | MultiMenuField
  | RadioButtonField
  | FileField
  | PictureField
  | URLField
  | LatLongField;

// ============================================================================
// Field Content Interface
// ============================================================================

/**
 * Field content storage structure.
 *
 * Maps to mdl_data_content table.
 * Different field types use different content fields for storage.
 */
export interface FieldContent {
  /**
   * Unique content identifier
   * Maps to: id (int 10)
   */
  id: number;

  /**
   * Field this content belongs to
   * Maps to: fieldid (int 10)
   */
  fieldid: number;

  /**
   * Record this content belongs to
   * Maps to: recordid (int 10)
   */
  recordid: number;

  /**
   * Primary content field
   * Maps to: content (text)
   * Used by most field types for main data storage
   */
  content?: string;

  /**
   * Additional content field 1
   * Maps to: content1 (text)
   * Usage varies by field type
   */
  content1?: string;

  /**
   * Additional content field 2
   * Maps to: content2 (text)
   * Usage varies by field type
   */
  content2?: string;

  /**
   * Additional content field 3
   * Maps to: content3 (text)
   * Usage varies by field type
   */
  content3?: string;

  /**
   * Additional content field 4
   * Maps to: content4 (text)
   * Usage varies by field type
   */
  content4?: string;
}

// ============================================================================
// Database Record Interface
// ============================================================================

/**
 * Database record structure representing a single entry in a database activity.
 *
 * Maps to mdl_data_records table.
 */
export interface DatabaseRecord {
  /**
   * Unique record identifier
   * Maps to: id (int 10)
   */
  id: number;

  /**
   * User who created this record
   * Maps to: userid (int 10)
   */
  userid: number;

  /**
   * Group this record belongs to (0 if not group-specific)
   * Maps to: groupid (int 10)
   */
  groupid: number;

  /**
   * Database activity instance this record belongs to
   * Maps to: dataid (int 10)
   */
  dataid: number;

  /**
   * Timestamp when record was created
   * Maps to: timecreated (int 10)
   */
  timecreated: number;

  /**
   * Timestamp when record was last modified
   * Maps to: timemodified (int 10)
   */
  timemodified: number;

  /**
   * Approval status of the record
   * Maps to: approved (int 4)
   * 0 = not approved, 1 = approved
   */
  approved: boolean;
}

// ============================================================================
// Database Activity Interface
// ============================================================================

/**
 * Main database activity instance configuration.
 *
 * Maps to mdl_data table structure.
 * Represents a complete database activity with all settings and templates.
 */
export interface Database {
  /**
   * Unique database activity identifier
   * Maps to: id (int 10)
   */
  id: number;

  /**
   * Course this database belongs to
   * Maps to: course (int 10)
   */
  course: number;

  /**
   * Database activity name
   * Maps to: name (char 1333)
   */
  name: string;

  /**
   * Introduction text for the database
   * Maps to: intro (text)
   */
  intro: string;

  /**
   * Format of intro text (HTML, Markdown, etc.)
   * Maps to: introformat (int 4)
   */
  introformat: number;

  /**
   * Whether comments are enabled
   * Maps to: comments (int 4)
   * 0 = disabled, 1 = enabled
   */
  comments: boolean;

  /**
   * Timestamp when database becomes available for submissions
   * Maps to: timeavailablefrom (int 10)
   * 0 = no restriction
   */
  timeavailablefrom: number;

  /**
   * Timestamp when database closes for submissions
   * Maps to: timeavailableto (int 10)
   * 0 = no restriction
   */
  timeavailableto: number;

  /**
   * Timestamp when database becomes viewable
   * Maps to: timeviewfrom (int 10)
   * 0 = no restriction
   */
  timeviewfrom: number;

  /**
   * Timestamp when database stops being viewable
   * Maps to: timeviewto (int 10)
   * 0 = no restriction
   */
  timeviewto: number;

  /**
   * Number of entries required from each user
   * Maps to: requiredentries (int 8)
   * 0 = no requirement
   */
  requiredentries: number;

  /**
   * Number of entries required before a user can view other entries
   * Maps to: requiredentriestoview (int 8)
   * 0 = no requirement
   */
  requiredentriestoview: number;

  /**
   * Maximum number of entries allowed per user
   * Maps to: maxentries (int 8)
   * 0 = unlimited
   */
  maxentries: number;

  /**
   * Number of articles to display in RSS feed
   * Maps to: rssarticles (int 4)
   * 0 = RSS disabled
   */
  rssarticles: number;

  /**
   * Template for displaying a single entry
   * Maps to: singletemplate (text)
   * HTML template with field placeholders
   */
  singletemplate?: string;

  /**
   * Template for displaying list of entries
   * Maps to: listtemplate (text)
   * HTML template with field placeholders
   */
  listtemplate?: string;

  /**
   * Header template for list view
   * Maps to: listtemplateheader (text)
   */
  listtemplateheader?: string;

  /**
   * Footer template for list view
   * Maps to: listtemplatefooter (text)
   */
  listtemplatefooter?: string;

  /**
   * Template for adding new entries
   * Maps to: addtemplate (text)
   * HTML form template
   */
  addtemplate?: string;

  /**
   * Template for RSS feed entries
   * Maps to: rsstemplate (text)
   */
  rsstemplate?: string;

  /**
   * Template for RSS feed titles
   * Maps to: rsstitletemplate (text)
   */
  rsstitletemplate?: string;

  /**
   * Custom CSS template for styling
   * Maps to: csstemplate (text)
   */
  csstemplate?: string;

  /**
   * Custom JavaScript template
   * Maps to: jstemplate (text)
   */
  jstemplate?: string;

  /**
   * Advanced search template
   * Maps to: asearchtemplate (text)
   */
  asearchtemplate?: string;

  /**
   * Whether entries require approval before being visible
   * Maps to: approval (int 4)
   * 0 = no approval required, 1 = approval required
   */
  approval: boolean;

  /**
   * Whether approved entries can still be edited
   * Maps to: manageapproved (int 4)
   * 0 = cannot edit, 1 = can edit
   */
  manageapproved: boolean;

  /**
   * Scale ID for ratings (0 if ratings disabled)
   * Maps to: scale (int 10)
   */
  scale: number;

  /**
   * Assessment aggregate method for ratings
   * Maps to: assessed (int 10)
   * 0 = no ratings
   */
  assessed: number;

  /**
   * Timestamp when rating period starts
   * Maps to: assesstimestart (int 10)
   * 0 = no restriction
   */
  assesstimestart: number;

  /**
   * Timestamp when rating period ends
   * Maps to: assesstimefinish (int 10)
   * 0 = no restriction
   */
  assesstimefinish: number;

  /**
   * Default field to sort entries by (field ID)
   * Maps to: defaultsort (int 10)
   * 0 = no default sort
   */
  defaultsort: number;

  /**
   * Default sort direction
   * Maps to: defaultsortdir (int 4)
   * 0 = ascending, 1 = descending
   */
  defaultsortdir: number;

  /**
   * Whether users can edit any entry (not just their own)
   * Maps to: editany (int 4)
   * 0 = own entries only, 1 = any entry
   */
  editany: boolean;

  /**
   * Notification settings
   * Maps to: notification (int 10)
   * Bitfield for notification preferences
   */
  notification: number;

  /**
   * Timestamp when database settings were last modified
   * Maps to: timemodified (int 10)
   */
  timemodified: number;

  /**
   * Additional configuration as JSON string
   * Maps to: config (text)
   */
  config?: string;

  /**
   * Number of entries required for activity completion
   * Maps to: completionentries (int 10)
   * 0 = completion not based on entries
   */
  completionentries: number;
}

// ============================================================================
// Search Criteria Interface
// ============================================================================

/**
 * Search criteria for querying database records.
 *
 * Used in database list and search operations with pagination support.
 */
export interface SearchCriteria {
  /**
   * Simple search query string
   * Searches across all fields
   */
  search?: string;

  /**
   * Sort configuration
   */
  sort?: {
    /**
     * Field ID to sort by (or special value like DATA_TIMEADDED)
     */
    field: number;

    /**
     * Sort direction
     * 0 = ascending, 1 = descending
     */
    direction: number;
  };

  /**
   * Advanced search criteria
   * Map of field ID to search value
   */
  advanced?: Record<number, string>;

  /**
   * Current page number for pagination (1-indexed)
   * Used with PaginationMeta
   */
  page?: number;

  /**
   * Number of records per page
   * Used with PaginationMeta
   */
  perPage?: number;
}

// ============================================================================
// Permission Interfaces
// ============================================================================

/**
 * Permission structure for database activity capabilities.
 *
 * Based on capabilities defined in mod/data/db/access.php
 */
export interface DatabasePermissions {
  /**
   * Can view the database activity
   * Capability: mod/data:viewentry
   */
  canView: boolean;

  /**
   * Can view database entries
   * Capability: mod/data:viewentry
   */
  canViewEntry: boolean;

  /**
   * Can create and edit own entries
   * Capability: mod/data:writeentry
   */
  canWriteEntry: boolean;

  /**
   * Can edit and delete any entry
   * Capability: mod/data:manageentries
   */
  canManageEntries: boolean;

  /**
   * Can manage templates
   * Capability: mod/data:managetemplates
   */
  canManageTemplates: boolean;

  /**
   * Can rate entries
   * Capability: mod/data:rate
   */
  canRate: boolean;

  /**
   * Can view own ratings
   * Capability: mod/data:viewrating
   */
  canViewRating: boolean;

  /**
   * Can view all ratings
   * Capability: mod/data:viewanyrating
   */
  canViewAnyRating: boolean;

  /**
   * Can approve entries
   * Capability: mod/data:approve
   */
  canApprove: boolean;

  /**
   * Can export entries to presets
   * Capability: mod/data:viewalluserpresets
   */
  canExport: boolean;
}
