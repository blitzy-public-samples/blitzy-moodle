/**
 * User Type Definitions
 *
 * Comprehensive TypeScript type definitions for User entity based on Moodle user table schema.
 * These types ensure type-safe user data handling across all admin features.
 *
 * Schema source: public/lib/db/install.xml (user table, lines 869-940)
 *
 * @package react-frontend
 * @subpackage features/admin/users/types
 */

/**
 * Authentication methods supported by Moodle
 *
 * Corresponds to auth plugins available in the system.
 * These are the primary authentication methods used across Moodle installations.
 */
export enum UserAuthMethod {
  /** Manual account creation by administrators */
  MANUAL = 'manual',
  /** LDAP/Active Directory authentication */
  LDAP = 'ldap',
  /** OAuth2 authentication (Google, Microsoft, etc.) */
  OAUTH2 = 'oauth2',
  /** Shibboleth SSO authentication */
  SHIBBOLETH = 'shibboleth',
  /** CAS (Central Authentication Service) */
  CAS = 'cas',
  /** SAML 2.0 Single Sign-On */
  SAML = 'saml',
  /** Email-based authentication */
  EMAIL = 'email',
  /** No authentication method assigned */
  NONE = 'none',
  /** Account disabled for login */
  NOLOGIN = 'nologin',
  /** Multi-factor authentication */
  MFA = 'mfa',
}

/**
 * User account status enumeration
 *
 * Represents the current state of a user account in the system.
 */
export enum UserStatus {
  /** Active user account - can login and access system */
  ACTIVE = 'active',
  /** Suspended user account - temporarily disabled */
  SUSPENDED = 'suspended',
  /** Deleted user account - marked for deletion */
  DELETED = 'deleted',
}

/**
 * Complete User entity interface
 *
 * Represents a full user record from the Moodle user table.
 * This interface includes all 48 fields from the database schema.
 *
 * Note: password and secret fields are intentionally excluded from client-side types
 * for security reasons. These sensitive fields should never be transmitted to the frontend.
 *
 * @interface User
 */
export interface User {
  /** Unique user identifier (primary key) */
  id: number;

  /** Authentication method used for this user account */
  auth: string;

  /** Whether user has confirmed their account via email (0=no, 1=yes) */
  confirmed: number;

  /** Whether user has agreed to site policies (0=no, 1=yes) */
  policyagreed: number;

  /** Soft delete flag (0=active, 1=deleted) */
  deleted: number;

  /** Account suspension flag (0=active, 1=suspended) */
  suspended: number;

  /** MNet host ID for distributed Moodle networks */
  mnethostid: number;

  /** Unique username for login (lowercase, alphanumeric) */
  username: string;

  /** User ID number (alternative identifier, often from external systems) */
  idnumber: string;

  /** User's first name / given name */
  firstname: string;

  /** User's last name / family name */
  lastname: string;

  /** Primary email address */
  email: string;

  /** Email notification disable flag (0=enabled, 1=disabled) */
  emailstop: number;

  /** Primary phone number */
  phone1: string;

  /** Secondary phone number */
  phone2: string;

  /** Institution or organization name */
  institution: string;

  /** Department within institution */
  department: string;

  /** Street address */
  address: string;

  /** City name */
  city: string;

  /** ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB', 'AU') */
  country: string;

  /** Preferred language code (e.g., 'en', 'fr', 'es') */
  lang: string;

  /** Calendar type preference (e.g., 'gregorian', 'hijri') */
  calendartype: string;

  /** Preferred theme/skin for interface */
  theme: string;

  /** Timezone setting (e.g., 'America/New_York', '99' for server default) */
  timezone: string;

  /** Unix timestamp of first access to site (0 if never accessed) */
  firstaccess: number;

  /** Unix timestamp of most recent access to site */
  lastaccess: number;

  /** Unix timestamp of last successful login */
  lastlogin: number;

  /** Unix timestamp of current login session */
  currentlogin: number;

  /** IP address of last login (IPv4 or IPv6) */
  lastip: string;

  /** Profile picture file ID (references files table) */
  picture: number;

  /** User profile description/bio (HTML content) */
  description: string | null;

  /** Format of description field (1=HTML, 2=Plain, 4=Markdown) */
  descriptionformat: number;

  /** Email format preference (0=plain text, 1=HTML) */
  mailformat: number;

  /** Email digest mode (0=no digest, 1=complete, 2=subjects only) */
  maildigest: number;

  /** Email display setting (0=hide, 1=course members, 2=all) */
  maildisplay: number;

  /** Auto-subscribe to forum posts (0=no, 1=yes) */
  autosubscribe: number;

  /** Track forum read/unread status (0=no, 1=yes) */
  trackforums: number;

  /** Unix timestamp when user record was created */
  timecreated: number;

  /** Unix timestamp when user record was last modified */
  timemodified: number;

  /** Trust bitmask for content filtering bypass */
  trustbitmask: number;

  /** Alt text for profile picture */
  imagealt: string | null;

  /** Phonetic representation of last name (for sorting/searching) */
  lastnamephonetic: string | null;

  /** Phonetic representation of first name (for sorting/searching) */
  firstnamephonetic: string | null;

  /** Middle name(s) */
  middlename: string | null;

  /** Alternate name or preferred name */
  alternatename: string | null;

  /** MoodleNet profile URL */
  moodlenetprofile: string | null;
}

/**
 * Basic user information subset
 *
 * Contains only the most essential user identification fields.
 * Useful for user lists, dropdowns, and references where full details aren't needed.
 *
 * @type UserBasicInfo
 */
export type UserBasicInfo = Pick<User, 'id' | 'username' | 'firstname' | 'lastname' | 'email'>;

/**
 * User profile information
 *
 * Contains fields relevant to displaying user profiles and contact information.
 * Includes personal details but excludes system/admin fields.
 *
 * @type UserProfile
 */
export type UserProfile = Pick<
  User,
  | 'id'
  | 'username'
  | 'firstname'
  | 'lastname'
  | 'email'
  | 'phone1'
  | 'phone2'
  | 'institution'
  | 'department'
  | 'address'
  | 'city'
  | 'country'
  | 'description'
  | 'descriptionformat'
  | 'picture'
  | 'imagealt'
>;

/**
 * User preferences subset
 *
 * Contains fields related to user preferences and settings.
 * Used for preference management interfaces.
 *
 * @type UserPreferences
 */
export type UserPreferences = Pick<
  User,
  | 'lang'
  | 'calendartype'
  | 'theme'
  | 'timezone'
  | 'mailformat'
  | 'maildigest'
  | 'maildisplay'
  | 'autosubscribe'
  | 'trackforums'
>;

/**
 * User creation data
 *
 * Defines the required and optional fields for creating a new user account.
 *
 * Required fields (per Moodle user_create_user function):
 * - auth: authentication method
 * - username: unique username
 * - firstname: first name
 * - lastname: last name
 * - email: email address
 * - password: initial password (hashed server-side, not stored in User type)
 * - city: city name
 * - country: country code
 *
 * Optional fields: all other user properties
 *
 * @type UserCreateData
 */
export type UserCreateData = {
  /** Authentication method (required) */
  auth: string;
  /** Username (required, must be unique) */
  username: string;
  /** First name (required) */
  firstname: string;
  /** Last name (required) */
  lastname: string;
  /** Email address (required, must be unique) */
  email: string;
  /** Initial password (required, will be hashed server-side) */
  password: string;
  /** City (required) */
  city: string;
  /** Country code (required) */
  country: string;
  /** MNet host ID (defaults to local host if not provided) */
  mnethostid?: number;
  /** Confirmed status (defaults to 0) */
  confirmed?: number;
  /** ID number / alternative identifier (optional) */
  idnumber?: string;
  /** Primary phone (optional) */
  phone1?: string;
  /** Secondary phone (optional) */
  phone2?: string;
  /** Institution (optional) */
  institution?: string;
  /** Department (optional) */
  department?: string;
  /** Address (optional) */
  address?: string;
  /** Language preference (defaults to site default) */
  lang?: string;
  /** Calendar type (defaults to 'gregorian') */
  calendartype?: string;
  /** Theme preference (defaults to site theme) */
  theme?: string;
  /** Timezone (defaults to '99' for server timezone) */
  timezone?: string;
  /** Profile description (optional) */
  description?: string;
  /** Description format (defaults to 1 for HTML) */
  descriptionformat?: number;
  /** Email format (defaults to 1 for HTML) */
  mailformat?: number;
  /** Email digest mode (defaults to 0) */
  maildigest?: number;
  /** Email display setting (defaults to 2) */
  maildisplay?: number;
  /** Auto-subscribe to forums (defaults to 1) */
  autosubscribe?: number;
  /** Track forum posts (defaults to 0) */
  trackforums?: number;
  /** Middle name (optional) */
  middlename?: string;
  /** Alternate name (optional) */
  alternatename?: string;
  /** Phonetic last name (optional) */
  lastnamephonetic?: string;
  /** Phonetic first name (optional) */
  firstnamephonetic?: string;
};

/**
 * User update data
 *
 * Defines fields that can be updated for an existing user account.
 * The id field is required to identify which user to update.
 * All other fields are optional - only provided fields will be updated.
 *
 * Note: Some fields like username, deleted, confirmed cannot be updated
 * through normal update operations and require special admin functions.
 *
 * @type UserUpdateData
 */
export type UserUpdateData = {
  /** User ID (required to identify user) */
  id: number;
  /** Authentication method (can be changed by admins) */
  auth?: string;
  /** First name */
  firstname?: string;
  /** Last name */
  lastname?: string;
  /** Email address (must remain unique) */
  email?: string;
  /** City */
  city?: string;
  /** Country code */
  country?: string;
  /** ID number */
  idnumber?: string;
  /** Primary phone */
  phone1?: string;
  /** Secondary phone */
  phone2?: string;
  /** Institution */
  institution?: string;
  /** Department */
  department?: string;
  /** Address */
  address?: string;
  /** Language preference */
  lang?: string;
  /** Calendar type */
  calendartype?: string;
  /** Theme preference */
  theme?: string;
  /** Timezone */
  timezone?: string;
  /** Profile description */
  description?: string;
  /** Description format */
  descriptionformat?: number;
  /** Email format */
  mailformat?: number;
  /** Email digest mode */
  maildigest?: number;
  /** Email display setting */
  maildisplay?: number;
  /** Auto-subscribe setting */
  autosubscribe?: number;
  /** Track forums setting */
  trackforums?: number;
  /** Suspension status (0=active, 1=suspended) */
  suspended?: number;
  /** Middle name */
  middlename?: string;
  /** Alternate name */
  alternatename?: string;
  /** Phonetic last name */
  lastnamephonetic?: string;
  /** Phonetic first name */
  firstnamephonetic?: string;
};

/**
 * User deletion data
 *
 * Defines the minimal data needed to perform a soft delete of a user account.
 * Moodle uses soft deletes - the user record is marked as deleted but not removed from database.
 *
 * @type UserDeleteData
 */
export type UserDeleteData = {
  /** User ID to delete (required) */
  id: number;
  /** Deleted flag (always 1 for deletion operations) */
  deleted: 1;
};
