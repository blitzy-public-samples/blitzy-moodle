/**
 * TypeScript type definitions for user profile feature
 *
 * Based on Moodle user profile data structures from:
 * - public/user/externallib.php (user_description, create_users, update_users)
 * - public/user/lib.php (user_create_user, user_update_user)
 * - public/user/edit.php (profile edit form)
 * - public/user/profile.php (profile view)
 *
 * @package react-frontend
 * @subpackage features/profile
 */

/**
 * Mail display options enum
 * Controls email address visibility in user profile
 */
export enum MailDisplay {
  /** Hide email address from everyone */
  HIDE = 0,
  /** Show email to course members only */
  COURSE_MEMBERS = 1,
  /** Show email to everyone */
  EVERYONE = 2,
}

/**
 * Mail format options enum
 * Controls email format preference for system emails
 */
export enum MailFormat {
  /** Plain text email format */
  PLAIN_TEXT = 0,
  /** HTML email format */
  HTML = 1,
}

/**
 * Mail digest options enum
 * Controls forum email digest settings
 */
export enum MailDigest {
  /** No digest, send individual emails */
  NO_DIGEST = 0,
  /** Complete digest (full posts) */
  COMPLETE = 1,
  /** Subjects only digest */
  SUBJECTS = 2,
}

/**
 * Calendar type options
 * Common calendar systems supported by Moodle
 */
export type CalendarType = 'gregorian' | 'hijri' | 'hebrew' | 'persian' | 'buddhist' | 'chinese';

/**
 * Description format enum
 * Text format for user profile description field
 */
export enum DescriptionFormat {
  /** Moodle auto-format */
  MOODLE = 0,
  /** HTML format */
  HTML = 1,
  /** Plain text */
  PLAIN = 2,
  /** Markdown format */
  MARKDOWN = 4,
}

/**
 * Custom profile field interface
 * Represents a custom user profile field (user_info_field)
 */
export interface CustomField {
  /** Field type (e.g., 'text', 'checkbox', 'menu', 'textarea', 'datetime') */
  type: string;

  /** Raw field value as stored in database */
  value: string;

  /** Formatted display value (optional) */
  displayvalue?: string;

  /** Display name of the field */
  name: string;

  /** Short name used as field identifier in code */
  shortname: string;
}

/**
 * User preference interface
 * Represents a key-value user preference setting
 */
export interface UserPreference {
  /** Preference name/key */
  name: string;

  /** Preference value */
  value: string;
}

/**
 * User preferences collection interface
 * Structured user preferences for common settings
 */
export interface UserPreferences {
  /** Key-value map of all user preferences */
  [key: string]: string | number | boolean | undefined;

  /** Email display preference */
  maildisplay?: MailDisplay;

  /** Email format preference */
  mailformat?: MailFormat;

  /** Email digest preference */
  maildigest?: MailDigest;

  /** Auto-subscribe to forum discussions */
  autosubscribe?: boolean;

  /** Track forum read/unread status */
  trackforums?: boolean;

  /** User interface language preference */
  lang?: string;

  /** Calendar type preference */
  calendartype?: CalendarType;

  /** Theme preference */
  theme?: string;

  /** Timezone preference (e.g., 'America/New_York', '99' for server default) */
  timezone?: string;
}

/**
 * User role interface
 * Represents a role assigned to a user in a context
 */
export interface UserRole {
  /** Role ID */
  roleid: number;

  /** Role name */
  name: string;

  /** Role short name */
  shortname: string;

  /** Sort order */
  sortorder: number;
}

/**
 * Complete user profile interface
 * Based on user_description() from public/user/externallib.php
 * Represents the complete user profile data structure
 */
export interface User {
  /** User ID (primary key) */
  id: number;

  /** Username (unique login identifier) */
  username?: string;

  /** User's first name */
  firstname?: string;

  /** User's last name */
  lastname?: string;

  /** Full name (formatted firstname + lastname) */
  fullname: string;

  /** Email address */
  email?: string;

  /** Postal address */
  address?: string;

  /** Phone number 1 */
  phone1?: string;

  /** Phone number 2 (mobile) */
  phone2?: string;

  /** Department */
  department?: string;

  /** Institution */
  institution?: string;

  /** ID number (arbitrary institution identifier) */
  idnumber?: string;

  /** User interests (comma-separated tags) */
  interests?: string;

  /** Timestamp of first site access (0 if never) */
  firstaccess?: number;

  /** Timestamp of last site access (0 if never) */
  lastaccess?: number;

  /** Authentication plugin (e.g., 'manual', 'ldap', 'oauth2') */
  auth?: string;

  /** Account suspended status */
  suspended?: boolean;

  /** Account confirmed status (1 = confirmed, 0 = pending) */
  confirmed?: boolean;

  /** Language code (e.g., 'en', 'es', 'fr') */
  lang?: string;

  /** Calendar type (e.g., 'gregorian') */
  calendartype?: CalendarType;

  /** Theme name */
  theme?: string;

  /** Timezone code or '99' for server default */
  timezone?: string;

  /** Mail format preference (0 = plain text, 1 = HTML) */
  mailformat?: MailFormat;

  /** Mail display preference (0 = hide, 1 = course members, 2 = everyone) */
  maildisplay?: MailDisplay;

  /** Mail digest preference (0 = no digest, 1 = complete, 2 = subjects) */
  maildigest?: MailDigest;

  /** Track forums preference */
  trackforums?: boolean;

  /** Auto-subscribe to forums preference */
  autosubscribe?: boolean;

  /** Profile description (bio) */
  description?: string;

  /** Description format (0 = moodle, 1 = HTML, 2 = plain, 4 = markdown) */
  descriptionformat?: DescriptionFormat;

  /** Home city */
  city?: string;

  /** Home country code (ISO 3166-1 alpha-2, e.g., 'US', 'GB') */
  country?: string;

  /** Small profile image URL */
  profileimageurlsmall: string;

  /** Full-size profile image URL */
  profileimageurl: string;

  /** Custom profile fields */
  customfields?: CustomField[];

  /** User preferences */
  preferences?: UserPreference[];

  /** User roles */
  roles?: UserRole[];

  /** Additional name fields for international users */
  firstnamephonetic?: string;
  lastnamephonetic?: string;
  middlename?: string;
  alternatename?: string;

  /** Image alt text for profile picture */
  imagealt?: string;

  /** Timestamp of account creation */
  timecreated?: number;

  /** Timestamp of last profile modification */
  timemodified?: number;
}

/**
 * Update profile data interface (for API requests)
 * Based on user_update_user() parameters from public/user/lib.php
 * Contains fields that can be updated via profile edit form
 * Note: userid is passed as URL parameter, not in request body
 */
export interface UpdateProfileData {
  /** User's first name */
  firstname?: string;

  /** User's last name */
  lastname?: string;

  /** Email address */
  email?: string;

  /** Profile description (bio) */
  description?: string;

  /** Home city */
  city?: string;

  /** Home country code (ISO 3166-1 alpha-2) */
  country?: string;

  /** Timezone code or '99' for server default */
  timezone?: string;

  /** Phone number 1 */
  phone1?: string;

  /** Phone number 2 (mobile) */
  phone2?: string;

  /** Institution */
  institution?: string;

  /** Department */
  department?: string;

  /** Postal address */
  address?: string;

  /** Language code */
  lang?: string;

  /** Calendar type */
  calendartype?: CalendarType;

  /** Theme name */
  theme?: string;

  /** Mailformat preference (0 = plain text, 1 = HTML) */
  mailformat?: 0 | 1;

  /** Auto-subscribe to forum posts (0 or 1) */
  autosubscribe?: 0 | 1;

  /** Track forum read/unread (0 or 1) */
  trackforums?: 0 | 1;
}

/**
 * Update profile payload interface (for mutation hooks)
 * Based on user_update_user() parameters from public/user/lib.php
 * Contains fields that can be updated via profile edit form
 * Includes userid for internal routing to correct user
 */
export interface UpdateProfilePayload {
  /** User ID (required to identify which user to update) */
  userid: number;

  /** User's first name */
  firstname?: string;

  /** User's last name */
  lastname?: string;

  /** Email address */
  email?: string;

  /** Profile description (bio) */
  description?: string;

  /** Home city */
  city?: string;

  /** Home country code (ISO 3166-1 alpha-2) */
  country?: string;

  /** Timezone code or '99' for server default */
  timezone?: string;

  /** Phone number 1 */
  phone1?: string;

  /** Phone number 2 (mobile) */
  phone2?: string;

  /** Institution */
  institution?: string;

  /** Department */
  department?: string;

  /** Postal address */
  address?: string;

  /** Language code */
  lang?: string;

  /** Calendar type */
  calendartype?: CalendarType;

  /** Theme name */
  theme?: string;

  /** User interests (comma-separated tags) */
  interests?: string;

  /** Image alt text for profile picture */
  imagealt?: string;

  /** Additional name fields */
  firstnamephonetic?: string;
  lastnamephonetic?: string;
  middlename?: string;
  alternatename?: string;

  /** Mail format preference */
  mailformat?: MailFormat;

  /** Mail display preference */
  maildisplay?: MailDisplay;

  /** Mail digest preference */
  maildigest?: MailDigest;

  /** Auto-subscribe to forums */
  autosubscribe?: boolean;

  /** Track forums */
  trackforums?: boolean;

  /** Custom profile fields to update */
  customfields?: CustomField[];
}

/**
 * Avatar constraints interface
 * Defines the constraints for avatar uploads
 */
export interface AvatarConstraints {
  /** Maximum file size in bytes */
  maxSize: number;

  /** Allowed file types (MIME types) */
  allowedTypes: string[];

  /** Minimum width in pixels */
  minWidth?: number;

  /** Minimum height in pixels */
  minHeight?: number;

  /** Maximum width in pixels */
  maxWidth?: number;

  /** Maximum height in pixels */
  maxHeight?: number;
}

/**
 * Avatar upload response interface
 * Based on core_user::update_picture() response from public/user/lib.php
 * Contains updated profile image URLs after successful upload
 */
export interface AvatarUploadResponse {
  /** Success status */
  success: boolean;

  /** Full-size profile image URL */
  profileimageurl: string;

  /** Small profile image URL */
  profileimageurlsmall: string;

  /** Error information if success is false */
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Profile API response wrapper
 * Standard API response structure for profile endpoints
 */
export interface ProfileAPIResponse<T> {
  /** Success status */
  success: boolean;

  /** Response data */
  data?: T;

  /** Error information if success is false */
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * User profile update API response
 */
export type UpdateProfileResponse = ProfileAPIResponse<User>;

/**
 * Alias for UpdateProfileResponse (backwards compatibility)
 */
export type ProfileUpdateResponse = UpdateProfileResponse;

/**
 * Avatar upload API response
 */
export type AvatarUploadAPIResponse = ProfileAPIResponse<AvatarUploadResponse>;

/**
 * User profile fetch API response
 */
export type UserProfileResponse = ProfileAPIResponse<User>;

/**
 * User preferences update API response
 */
export type UserPreferencesResponse = ProfileAPIResponse<UserPreferences>;

/**
 * Profile validation error interface
 * Represents field-level validation errors
 */
export interface ProfileValidationError {
  /** Field name with error */
  field: string;

  /** Error message */
  message: string;

  /** Error code for i18n */
  code?: string;
}

/**
 * Profile validation result
 */
export interface ProfileValidationResult {
  /** Validation success status */
  valid: boolean;

  /** Array of validation errors */
  errors: ProfileValidationError[];
}
