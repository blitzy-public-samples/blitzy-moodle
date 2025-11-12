/**
 * User Management Type Definitions
 *
 * Comprehensive TypeScript type definitions for the admin user management domain.
 * Based on Moodle's mdl_user table schema and user administration structures.
 * Provides type-safe interfaces for:
 * - User entity with complete database schema mapping
 * - User filtering and search parameters
 * - User bulk operations
 * - User form data for create/edit operations
 * - User status and authentication types
 * - User preferences for settings
 *
 * All types follow TypeScript strict mode with no 'any' types.
 *
 * @module features/admin/types/user
 */

import type { Timezone } from '@/types/common';
import type { AdminFilterBase } from './admin.types';

// ============================================================================
// User Entity Interface
// ============================================================================

/**
 * User entity representing a complete Moodle user record.
 * Maps directly to the mdl_user table schema with all fields from Moodle 4.4+
 *
 * This interface includes all standard user fields for authentication,
 * profile data, communication preferences, and administrative metadata.
 *
 * @interface
 * @see {@link https://docs.moodle.org/dev/User|Moodle User Documentation}
 */
export interface User {
  /**
   * Unique user identifier
   * Primary key from mdl_user table (int 10, auto-increment)
   */
  id: number;

  /**
   * Authentication method used for this user
   * Examples: 'manual', 'ldap', 'oauth2', 'shibboleth', 'cas'
   * Corresponds to auth column (varchar 20)
   * @see UserAuthMethod
   */
  auth: string;

  /**
   * Whether user has confirmed their email address
   * 0 = unconfirmed, 1 = confirmed
   * Corresponds to confirmed column (tinyint 1)
   */
  confirmed: number;

  /**
   * Whether user has agreed to site policies
   * 0 = not agreed, 1 = agreed
   * Corresponds to policyagreed column (tinyint 1)
   */
  policyagreed: number;

  /**
   * Whether user account has been deleted (soft delete)
   * 0 = active, 1 = deleted
   * Corresponds to deleted column (tinyint 1)
   */
  deleted: number;

  /**
   * Whether user account is suspended
   * 0 = active, 1 = suspended
   * Corresponds to suspended column (tinyint 1)
   */
  suspended: number;

  /**
   * Moodle Network host ID
   * Default: 1 for local users
   * Corresponds to mnethostid column (int 10)
   */
  mnethostid: number;

  /**
   * Unique username for login
   * Corresponds to username column (varchar 100)
   * Must be unique across the system (case-insensitive)
   */
  username: string;

  /**
   * User's ID number from external system (optional)
   * Used for integration with student information systems
   * Corresponds to idnumber column (varchar 255)
   */
  idnumber: string;

  /**
   * User's first name (given name)
   * Corresponds to firstname column (varchar 100)
   * Required field
   */
  firstname: string;

  /**
   * User's last name (surname/family name)
   * Corresponds to lastname column (varchar 100)
   * Required field
   */
  lastname: string;

  /**
   * User's email address
   * Corresponds to email column (varchar 100)
   * Required field, must be unique if email uniqueness is enforced
   */
  email: string;

  /**
   * Whether to stop sending emails to this user
   * 0 = send emails, 1 = do not send emails
   * Corresponds to emailstop column (tinyint 1)
   */
  emailstop: number;

  /**
   * User's primary phone number
   * Corresponds to phone1 column (varchar 20)
   */
  phone1: string;

  /**
   * User's secondary phone number
   * Corresponds to phone2 column (varchar 20)
   */
  phone2: string;

  /**
   * User's institution/organization name
   * Corresponds to institution column (varchar 255)
   */
  institution: string;

  /**
   * User's department within institution
   * Corresponds to department column (varchar 255)
   */
  department: string;

  /**
   * User's street address
   * Corresponds to address column (varchar 255)
   */
  address: string;

  /**
   * User's city
   * Corresponds to city column (varchar 120)
   */
  city: string;

  /**
   * User's country code (ISO 3166-1 alpha-2)
   * Examples: 'US', 'GB', 'AU', 'CA'
   * Corresponds to country column (varchar 2)
   */
  country: string;

  /**
   * User's preferred language code (ISO 639-1)
   * Examples: 'en', 'fr', 'de', 'es'
   * Corresponds to lang column (varchar 30)
   */
  lang: string;

  /**
   * User's preferred calendar type
   * Examples: 'gregorian', 'islamic', 'hebrew'
   * Corresponds to calendartype column (varchar 30)
   */
  calendartype: string;

  /**
   * User's custom theme preference
   * Theme name or empty string for site default
   * Corresponds to theme column (varchar 50)
   */
  theme: string;

  /**
   * User's timezone preference
   * IANA timezone identifier or special value '99' for server default
   * Examples: 'America/New_York', 'Europe/London', 'Asia/Tokyo', '99'
   * Corresponds to timezone column (varchar 100)
   * @see Timezone
   */
  timezone: Timezone;

  /**
   * Unix timestamp of first access to the site
   * 0 if user has never logged in
   * Corresponds to firstaccess column (int 10)
   */
  firstaccess: number;

  /**
   * Unix timestamp of most recent access to any page
   * Updated frequently during active sessions
   * Corresponds to lastaccess column (int 10)
   */
  lastaccess: number;

  /**
   * Unix timestamp of most recent login to the site
   * Different from lastaccess - updated only at login
   * Corresponds to lastlogin column (int 10)
   */
  lastlogin: number;

  /**
   * Unix timestamp of current login session start
   * Corresponds to currentlogin column (int 10)
   */
  currentlogin: number;

  /**
   * IP address from most recent access
   * IPv4 or IPv6 format
   * Corresponds to lastip column (varchar 45)
   */
  lastip: string;

  /**
   * User's profile picture file ID
   * 0 = no custom picture (use default gravatar/initials)
   * References mdl_files table
   * Corresponds to picture column (int 10)
   */
  picture: number;

  /**
   * User's profile description/bio (HTML content)
   * Corresponds to description column (longtext)
   */
  description: string;

  /**
   * Format of the description field
   * 0 = Moodle auto-format, 1 = HTML, 2 = Plain text, 4 = Markdown
   * Corresponds to descriptionformat column (tinyint 2)
   */
  descriptionformat: number;

  /**
   * User's preferred email format
   * 0 = Plain text, 1 = HTML
   * Corresponds to mailformat column (tinyint 1)
   */
  mailformat: number;

  /**
   * User's email digest preference for forum posts
   * 0 = No digest, 1 = Complete posts, 2 = Subjects only
   * Corresponds to maildigest column (tinyint 1)
   */
  maildigest: number;

  /**
   * User's email address display preference
   * 0 = Hide from everyone, 1 = Allow everyone to see, 2 = Visible to course members only
   * Corresponds to maildisplay column (tinyint 2)
   */
  maildisplay: number;

  /**
   * Whether user is auto-subscribed to forums when posting
   * 0 = No auto-subscribe, 1 = Auto-subscribe
   * Corresponds to autosubscribe column (tinyint 1)
   */
  autosubscribe: number;

  /**
   * Whether to track unread forum posts for this user
   * 0 = No tracking, 1 = Track unread posts
   * Corresponds to trackforums column (tinyint 1)
   */
  trackforums: number;

  /**
   * Unix timestamp when user record was created
   * Set once during user creation, never updated
   * Corresponds to timecreated column (int 10)
   */
  timecreated: number;

  /**
   * Unix timestamp when user record was last modified
   * Updated whenever any user field changes
   * Corresponds to timemodified column (int 10)
   */
  timemodified: number;

  /**
   * Alternative text for user's profile picture
   * Used for accessibility (screen readers)
   * Corresponds to imagealt column (varchar 255)
   */
  imagealt: string;

  /**
   * Phonetic spelling of user's last name
   * Used for proper pronunciation in some languages (e.g., Japanese)
   * Corresponds to lastnamephonetic column (varchar 255)
   */
  lastnamephonetic: string;

  /**
   * Phonetic spelling of user's first name
   * Used for proper pronunciation in some languages (e.g., Japanese)
   * Corresponds to firstnamephonetic column (varchar 255)
   */
  firstnamephonetic: string;

  /**
   * User's middle name
   * Corresponds to middlename column (varchar 255)
   */
  middlename: string;

  /**
   * Alternative name for user (nickname, preferred name)
   * Corresponds to alternatename column (varchar 255)
   */
  alternatename: string;

  /**
   * User's MoodleNet profile URL
   * Links to external MoodleNet social network profile
   * Corresponds to moodlenetprofile column (varchar 255)
   */
  moodlenetprofile: string;
}

// ============================================================================
// User Filter Interface
// ============================================================================

/**
 * Filter parameters for user search and listing operations.
 * Extends AdminFilterBase with user-specific filter fields.
 *
 * Used by admin user management interfaces to filter and search users
 * by various criteria including status, location, institution, and activity.
 *
 * @interface
 * @extends AdminFilterBase
 */
export interface UserFilter extends AdminFilterBase {
  /**
   * Search query for filtering users
   * Searches across: username, firstname, lastname, email, idnumber
   * Inherited from AdminFilterBase
   * @optional
   */
  search?: string;

  /**
   * Filter by authentication method
   * Examples: 'manual', 'ldap', 'oauth2', 'shibboleth'
   * @optional
   * @see UserAuthMethod
   */
  auth?: string;

  /**
   * Filter by confirmation status
   * true = confirmed users only
   * false = unconfirmed users only
   * undefined = all users (no filter)
   * @optional
   */
  confirmed?: boolean;

  /**
   * Filter by suspension status
   * true = suspended users only
   * false = active users only
   * undefined = all users (no filter)
   * @optional
   */
  suspended?: boolean;

  /**
   * Filter by deletion status
   * true = deleted users only
   * false = active (non-deleted) users only
   * undefined = all users (no filter)
   * @optional
   */
  deleted?: boolean;

  /**
   * Filter by country code
   * ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB', 'AU')
   * @optional
   */
  country?: string;

  /**
   * Filter by city name
   * Exact match on city field
   * @optional
   */
  city?: string;

  /**
   * Filter by institution name
   * Exact or partial match on institution field
   * @optional
   */
  institution?: string;

  /**
   * Filter by department name
   * Exact or partial match on department field
   * @optional
   */
  department?: string;

  /**
   * Filter by first access time range (start)
   * Unix timestamp - users who first accessed on or after this time
   * @optional
   */
  firstaccess?: number;

  /**
   * Filter by last access time range (start)
   * Unix timestamp - users who last accessed on or after this time
   * @optional
   */
  lastaccess?: number;

  /**
   * Filter by creation time range (start)
   * Unix timestamp - users created on or after this time
   * @optional
   */
  timecreated?: number;

  /**
   * Field to sort results by
   * Common values: 'username', 'firstname', 'lastname', 'email', 'lastaccess', 'timecreated'
   * Inherited from AdminFilterBase
   * @optional
   */
  sortBy?: string;

  /**
   * Sort direction
   * 'asc' = ascending, 'desc' = descending
   * Inherited from AdminFilterBase
   * @optional
   * @default 'asc'
   */
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// User Bulk Action Enum
// ============================================================================

/**
 * Bulk actions available for user management operations.
 * Represents actions that can be performed on multiple selected users.
 *
 * Based on Moodle's bulk user actions found in:
 * - public/admin/user/user_bulk_forms.php
 * - public/admin/user/user_bulk_*.php pages
 *
 * @enum {string}
 */
export enum UserBulkAction {
  /**
   * Confirm unconfirmed user accounts
   * Marks users as email-confirmed without requiring email verification
   * Requires capability: moodle/user:update
   */
  CONFIRM = 'confirm',

  /**
   * Permanently delete user accounts (soft delete)
   * Sets deleted flag to 1, preserves data for backup purposes
   * Requires capability: moodle/user:delete
   */
  DELETE = 'delete',

  /**
   * Suspend user accounts
   * Prevents login while preserving all user data and enrollments
   * Requires capability: moodle/user:update
   */
  SUSPEND = 'suspend',

  /**
   * Unsuspend previously suspended user accounts
   * Re-enables login access for suspended users
   * Requires capability: moodle/user:update
   */
  UNSUSPEND = 'unsuspend',

  /**
   * Force password change on next login
   * Sets preference requiring users to change password at next login
   * Requires capability: moodle/user:update
   */
  FORCE_PASSWORD_CHANGE = 'force_password_change',

  /**
   * Add users to a cohort (site-wide group)
   * Bulk enrollment in system-level cohorts
   * Requires capability: moodle/cohort:assign
   */
  ADD_TO_COHORT = 'add_to_cohort',

  /**
   * Send bulk message to selected users
   * Compose and send message via Moodle messaging system
   * Requires capability: moodle/site:readallmessages
   */
  SEND_MESSAGE = 'send_message',

  /**
   * Download user data as file (CSV, Excel, etc.)
   * Export selected user information for reporting
   * Requires capability: moodle/user:update
   */
  DOWNLOAD = 'download',

  /**
   * Display selected users on current page
   * Shows full details of selected users for review
   * Requires capability: moodle/user:update or moodle/user:delete
   */
  DISPLAY_ON_PAGE = 'display_on_page',
}

// ============================================================================
// User Form Data Interface
// ============================================================================

/**
 * User form data for create and edit operations.
 * Contains fields required for creating a new user or updating an existing user.
 *
 * Subset of User interface with only editable fields.
 * Password field included for creation, optional for updates.
 *
 * @interface
 */
export interface UserFormData {
  /**
   * Username for login (required)
   * Must be unique, lowercase, no spaces
   * Length: 1-100 characters
   */
  username: string;

  /**
   * User password (required for creation, optional for updates)
   * Should meet site password policy requirements
   * Stored as bcrypt hash in database
   * @optional for updates
   */
  password?: string;

  /**
   * User's first name (required)
   * Length: 1-100 characters
   */
  firstname: string;

  /**
   * User's last name (required)
   * Length: 1-100 characters
   */
  lastname: string;

  /**
   * User's email address (required)
   * Must be valid email format
   * Must be unique if email uniqueness is enforced
   * Length: 1-100 characters
   */
  email: string;

  /**
   * Authentication method for the user
   * Default: 'manual' for locally managed accounts
   * @optional
   * @default 'manual'
   */
  auth?: string;

  /**
   * User's ID number from external system
   * @optional
   */
  idnumber?: string;

  /**
   * User's primary phone number
   * @optional
   */
  phone1?: string;

  /**
   * User's secondary phone number
   * @optional
   */
  phone2?: string;

  /**
   * User's institution/organization
   * @optional
   */
  institution?: string;

  /**
   * User's department
   * @optional
   */
  department?: string;

  /**
   * User's street address
   * @optional
   */
  address?: string;

  /**
   * User's city
   * @optional
   */
  city?: string;

  /**
   * User's country code (ISO 3166-1 alpha-2)
   * @optional
   */
  country?: string;

  /**
   * User's preferred language code
   * @optional
   * @default site default language
   */
  lang?: string;

  /**
   * User's timezone preference
   * @optional
   * @default '99' (server default)
   */
  timezone?: Timezone;

  /**
   * User's profile description/bio
   * HTML content supported based on descriptionformat
   * @optional
   */
  description?: string;

  /**
   * Whether account should be suspended
   * @optional
   * @default false
   */
  suspended?: boolean;

  /**
   * Whether account should be confirmed (skip email confirmation)
   * @optional
   * @default false (requires email confirmation)
   */
  confirmed?: boolean;
}

// ============================================================================
// User Status Enum
// ============================================================================

/**
 * User account status enumeration.
 * Represents the various states a user account can be in.
 *
 * Status is computed from user fields: deleted, suspended, confirmed
 *
 * @enum {string}
 */
export enum UserStatus {
  /**
   * Active user account
   * Can log in and access all entitled resources
   * Conditions: deleted=0, suspended=0, confirmed=1
   */
  ACTIVE = 'active',

  /**
   * Suspended user account
   * Cannot log in, data preserved, can be unsuspended
   * Conditions: deleted=0, suspended=1
   */
  SUSPENDED = 'suspended',

  /**
   * Deleted user account (soft delete)
   * Cannot log in, data preserved for backup, cannot be restored via UI
   * Conditions: deleted=1
   */
  DELETED = 'deleted',

  /**
   * Unconfirmed user account
   * Created but email not yet confirmed
   * Cannot log in until email confirmation completed
   * Conditions: deleted=0, suspended=0, confirmed=0
   */
  UNCONFIRMED = 'unconfirmed',
}

// ============================================================================
// User Authentication Method Type
// ============================================================================

/**
 * User authentication method type.
 * Represents the various authentication plugins available in Moodle.
 *
 * Common authentication methods include:
 * - 'manual': Local Moodle accounts managed by administrators
 * - 'email': Self-registration with email confirmation
 * - 'ldap': LDAP/Active Directory authentication
 * - 'oauth2': OAuth 2.0 providers (Google, Microsoft, Facebook, etc.)
 * - 'shibboleth': Shibboleth SSO authentication
 * - 'cas': CAS (Central Authentication Service)
 * - 'lti': LTI (Learning Tools Interoperability)
 * - 'mnet': Moodle Network authentication
 * - 'webservice': Web service token authentication
 *
 * Additional auth plugins can be installed, so this is not an exhaustive enum.
 *
 * @type {string}
 */
export type UserAuthMethod = string;

// ============================================================================
// User Preferences Interface
// ============================================================================

/**
 * User preferences for personalization and communication settings.
 * Subset of User interface containing only preference-related fields.
 *
 * These preferences control how the user experiences Moodle:
 * - Display settings (language, theme, timezone)
 * - Communication preferences (email format, digest, notifications)
 * - Calendar settings
 *
 * @interface
 */
export interface UserPreferences {
  /**
   * Preferred language code
   * Controls UI language for this user
   * @see User.lang
   */
  lang: string;

  /**
   * Preferred timezone
   * Controls how dates and times are displayed
   * @see User.timezone
   */
  timezone: Timezone;

  /**
   * Preferred theme
   * Custom theme override, or empty string for site default
   * @see User.theme
   */
  theme: string;

  /**
   * Email format preference
   * 0 = Plain text, 1 = HTML
   * @see User.mailformat
   */
  mailformat: number;

  /**
   * Email digest preference for forums
   * 0 = No digest, 1 = Complete posts, 2 = Subjects only
   * @see User.maildigest
   */
  maildigest: number;

  /**
   * Email address display preference
   * 0 = Hidden, 1 = Everyone, 2 = Course members only
   * @see User.maildisplay
   */
  maildisplay: number;

  /**
   * Auto-subscribe to forums when posting
   * 0 = No, 1 = Yes
   * @see User.autosubscribe
   */
  autosubscribe: number;

  /**
   * Track unread forum posts
   * 0 = No tracking, 1 = Track unread
   * @see User.trackforums
   */
  trackforums: number;

  /**
   * Calendar type preference
   * Examples: 'gregorian', 'islamic', 'hebrew'
   * @see User.calendartype
   */
  calendartype: string;
}
