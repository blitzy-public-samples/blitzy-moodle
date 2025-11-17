/**
 * Authentication Type Definitions
 *
 * Comprehensive TypeScript type definitions for the authentication feature.
 * Based on Moodle user table schema and authentication system.
 *
 * @module features/auth/types/auth.types
 */

import type { Timezone } from '@/types/common';

// ============================================================================
// User Entity Types
// ============================================================================

/**
 * Complete user entity based on Moodle user table schema
 *
 * Represents a user in the system with all profile information,
 * authentication details, roles, and capabilities.
 */
export interface User {
  /**
   * Unique user identifier (mdl_user.id)
   */
  id: number;

  /**
   * Username for login (mdl_user.username)
   * Must be unique within the system
   */
  username: string;

  /**
   * User's email address (mdl_user.email)
   */
  email: string;

  /**
   * User's first name (mdl_user.firstname)
   */
  firstname: string;

  /**
   * User's last name (mdl_user.lastname)
   */
  lastname: string;

  /**
   * User's full name (derived from firstname + lastname)
   * Typically formatted as "firstname lastname"
   */
  fullname: string;

  /**
   * Authentication method used (mdl_user.auth)
   * Examples: 'manual', 'ldap', 'oauth2', 'saml'
   */
  auth: string;

  /**
   * Whether user has confirmed their email address (mdl_user.confirmed)
   * 0 = not confirmed, 1 = confirmed
   */
  confirmed: boolean;

  /**
   * Whether user account is suspended (mdl_user.suspended)
   * Suspended users cannot log in
   */
  suspended: boolean;

  /**
   * User's roles across the system
   * Array of role assignments with context information
   */
  roles: Role[];

  /**
   * User's capabilities/permissions
   * Map of capability names to permission grants
   */
  capabilities: Permission[];

  /**
   * Whether user account is deleted (mdl_user.deleted)
   * Deleted users are soft-deleted, not removed from database
   */
  deleted?: boolean;

  /**
   * ID number for external system integration (mdl_user.idnumber)
   */
  idnumber?: string;

  /**
   * User's phone number 1 (mdl_user.phone1)
   */
  phone1?: string;

  /**
   * User's phone number 2 (mdl_user.phone2)
   */
  phone2?: string;

  /**
   * User's institution (mdl_user.institution)
   */
  institution?: string;

  /**
   * User's department (mdl_user.department)
   */
  department?: string;

  /**
   * User's address (mdl_user.address)
   */
  address?: string;

  /**
   * User's city (mdl_user.city)
   */
  city?: string;

  /**
   * User's country code (mdl_user.country)
   * ISO 3166-1 alpha-2 format (e.g., 'US', 'GB')
   */
  country?: string;

  /**
   * User's preferred language (mdl_user.lang)
   * Language pack code (e.g., 'en', 'fr', 'de')
   */
  lang?: string;

  /**
   * User's calendar type (mdl_user.calendartype)
   * Default: 'gregorian'
   */
  calendartype?: string;

  /**
   * User's preferred theme (mdl_user.theme)
   */
  theme?: string;

  /**
   * User's timezone (mdl_user.timezone)
   * IANA timezone identifier (e.g., 'America/New_York')
   */
  timezone?: Timezone;

  /**
   * Unix timestamp of first access (mdl_user.firstaccess)
   */
  firstaccess?: number;

  /**
   * Unix timestamp of last access (mdl_user.lastaccess)
   */
  lastaccess?: number;

  /**
   * Unix timestamp of last login (mdl_user.lastlogin)
   */
  lastlogin?: number;

  /**
   * Unix timestamp of current login (mdl_user.currentlogin)
   */
  currentlogin?: number;

  /**
   * Last IP address used (mdl_user.lastip)
   */
  lastip?: string;

  /**
   * Profile picture revision (mdl_user.picture)
   * 0 = no image, positive values are revision numbers
   */
  picture?: number;

  /**
   * User's profile description (mdl_user.description)
   */
  description?: string;

  /**
   * Format of description field (mdl_user.descriptionformat)
   * 0 = MOODLE, 1 = HTML, 2 = PLAIN, 4 = MARKDOWN
   */
  descriptionformat?: number;

  /**
   * Email format preference (mdl_user.mailformat)
   * 0 = plain text, 1 = HTML
   */
  mailformat?: number;

  /**
   * Email digest type (mdl_user.maildigest)
   * 0 = no digest, 1 = complete, 2 = subjects only
   */
  maildigest?: number;

  /**
   * Email display preference (mdl_user.maildisplay)
   * 0 = hide from everyone, 1 = allow course members, 2 = allow everyone
   */
  maildisplay?: number;

  /**
   * Forum auto-subscribe preference (mdl_user.autosubscribe)
   */
  autosubscribe?: boolean;

  /**
   * Forum tracking preference (mdl_user.trackforums)
   */
  trackforums?: boolean;

  /**
   * Unix timestamp when user was created (mdl_user.timecreated)
   */
  timecreated?: number;

  /**
   * Unix timestamp when user was last modified (mdl_user.timemodified)
   */
  timemodified?: number;

  /**
   * Alt text for profile picture (mdl_user.imagealt)
   */
  imagealt?: string;

  /**
   * Last name phonetic (mdl_user.lastnamephonetic)
   */
  lastnamephonetic?: string;

  /**
   * First name phonetic (mdl_user.firstnamephonetic)
   */
  firstnamephonetic?: string;

  /**
   * Middle name (mdl_user.middlename)
   */
  middlename?: string;

  /**
   * Alternate name (mdl_user.alternatename)
   */
  alternatename?: string;

  /**
   * MoodleNet profile URL (mdl_user.moodlenetprofile)
   */
  moodlenetprofile?: string;
}

// ============================================================================
// Authentication Credentials
// ============================================================================

/**
 * Login credentials for username/password authentication
 */
export interface LoginCredentials {
  /**
   * Username for authentication
   */
  username: string;

  /**
   * Password for authentication
   * Should be transmitted over HTTPS only
   */
  password: string;

  /**
   * Optional login token for additional security
   * Used for passwordless login flows
   */
  logintoken?: string;

  /**
   * Whether to remember username for next login
   * Stored in browser localStorage
   */
  rememberUsername?: boolean;
}

/**
 * Password reset form data
 */
export interface PasswordResetFormData {
  /**
   * Username for password reset
   */
  username?: string;

  /**
   * Email address for password reset
   * User can provide either username or email
   */
  email?: string;
}

// ============================================================================
// JWT Token Types
// ============================================================================

/**
 * Access token string type
 * JWT token used for API authentication (1-hour expiration)
 */
export type AccessToken = string;

/**
 * Refresh token string type
 * JWT token used to obtain new access tokens (7-day expiration)
 */
export type RefreshToken = string;

/**
 * JWT token payload structure
 *
 * Contained within the JWT token, validated on backend
 */
export interface TokenPayload {
  /**
   * Subject: User ID (standard JWT claim)
   */
  sub: number;

  /**
   * Issuer: Moodle site URL (standard JWT claim)
   */
  iss: string;

  /**
   * Issued at: Unix timestamp (standard JWT claim)
   */
  iat: number;

  /**
   * Expiration: Unix timestamp (standard JWT claim)
   */
  exp: number;

  /**
   * User's role shortnames
   * Used for client-side UI adjustments (not for authorization)
   */
  roles: string[];
}

/**
 * Decoded JWT token
 *
 * Result of jwt-decode library, used for client-side token inspection
 */
export interface DecodedToken {
  /**
   * Subject: User ID
   */
  sub: number;

  /**
   * Issuer: Moodle site URL
   */
  iss: string;

  /**
   * Issued at: Unix timestamp
   */
  iat: number;

  /**
   * Expiration: Unix timestamp
   */
  exp: number;

  /**
   * User's role shortnames
   */
  roles: string[];
}

/**
 * Authentication tokens returned by login endpoint
 */
export interface AuthTokens {
  /**
   * JWT access token (1-hour expiration)
   */
  accessToken: AccessToken;

  /**
   * JWT refresh token (7-day expiration)
   */
  refreshToken: RefreshToken;

  /**
   * Access token expiration time in seconds
   */
  expiresIn: number;

  /**
   * Token type (always 'Bearer' for JWT)
   */
  tokenType: string;
}

// ============================================================================
// Authentication State Management
// ============================================================================

/**
 * Authentication status enum
 */
export enum AuthStatus {
  /**
   * Initial state before any authentication attempt
   */
  IDLE = 'idle',

  /**
   * Authentication request in progress
   */
  LOADING = 'loading',

  /**
   * User is authenticated with valid token
   */
  AUTHENTICATED = 'authenticated',

  /**
   * User is not authenticated or token expired
   */
  UNAUTHENTICATED = 'unauthenticated',

  /**
   * Authentication error occurred
   */
  ERROR = 'error',
}

/**
 * Authentication state for Redux store
 *
 * Manages global authentication state across the application
 */
export interface AuthState {
  /**
   * Whether user is currently authenticated
   */
  isAuthenticated: boolean;

  /**
   * Current authenticated user (null if not authenticated)
   */
  user: User | null;

  /**
   * JWT tokens (null if not authenticated)
   */
  tokens: AuthTokens | null;

  /**
   * Loading state for auth operations
   */
  loading: boolean;

  /**
   * Error information if authentication failed
   */
  error: AuthError | null;

  /**
   * Current authentication status
   */
  status: AuthStatus;
}

// ============================================================================
// Permissions and Roles
// ============================================================================

/**
 * Moodle role archetypes
 *
 * Standard role types defined by Moodle core
 */
export enum RoleArchetype {
  /**
   * Site administrator with all permissions
   */
  MANAGER = 'manager',

  /**
   * Can create courses
   */
  COURSECREATOR = 'coursecreator',

  /**
   * Teacher with editing permissions
   */
  EDITINGTEACHER = 'editingteacher',

  /**
   * Teacher without editing permissions
   */
  TEACHER = 'teacher',

  /**
   * Student role
   */
  STUDENT = 'student',

  /**
   * Guest with read-only access
   */
  GUEST = 'guest',

  /**
   * Authenticated user
   */
  USER = 'user',

  /**
   * Front page role
   */
  FRONTPAGE = 'frontpage',
}

/**
 * Moodle context levels
 *
 * Hierarchical levels where permissions can be assigned
 */
export enum ContextLevel {
  /**
   * System-wide context
   */
  SYSTEM = 'system',

  /**
   * User context (personal)
   */
  USER = 'user',

  /**
   * Course category context
   */
  COURSECAT = 'coursecat',

  /**
   * Course context
   */
  COURSE = 'course',

  /**
   * Activity module context
   */
  MODULE = 'module',

  /**
   * Block context
   */
  BLOCK = 'block',
}

/**
 * Permission grant for a specific capability
 *
 * Represents whether user has a specific capability in a context
 */
export interface Permission {
  /**
   * Capability name (e.g., 'moodle/course:view')
   */
  capability: string;

  /**
   * Context ID where permission applies
   */
  contextId: number;

  /**
   * Whether permission is granted
   */
  granted: boolean;
}

/**
 * User role assignment
 *
 * Represents a role assigned to a user in a context
 */
export interface Role {
  /**
   * Role ID (mdl_role.id)
   */
  id: number;

  /**
   * Role shortname (mdl_role.shortname)
   * Examples: 'student', 'teacher', 'editingteacher', 'manager'
   */
  shortname: string;

  /**
   * Role display name (mdl_role.name)
   */
  name: string;

  /**
   * Role description (mdl_role.description)
   */
  description?: string;

  /**
   * Role archetype (mdl_role.archetype)
   */
  archetype?: RoleArchetype;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Login API response
 */
export interface LoginResponse {
  /**
   * Whether login was successful
   */
  success: boolean;

  /**
   * JWT tokens (only present if successful)
   */
  tokens?: AuthTokens;

  /**
   * Authenticated user information (only present if successful)
   */
  user?: User;

  /**
   * Response message (success or error message)
   */
  message?: string;
}

/**
 * Logout API response
 */
export interface LogoutResponse {
  /**
   * Whether logout was successful
   */
  success: boolean;

  /**
   * Response message
   */
  message?: string;
}

/**
 * Refresh token API response
 */
export interface RefreshTokenResponse {
  /**
   * Whether token refresh was successful
   */
  success: boolean;

  /**
   * New JWT tokens (only present if successful)
   */
  tokens?: AuthTokens;
}

/**
 * Current user (me) API response
 */
export interface MeResponse {
  /**
   * Whether request was successful
   */
  success: boolean;

  /**
   * Current user information
   */
  user?: User;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Authentication error codes
 */
export enum AuthErrorCode {
  /**
   * Invalid username or password
   */
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  /**
   * JWT token has expired
   */
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  /**
   * JWT token is invalid or malformed
   */
  TOKEN_INVALID = 'TOKEN_INVALID',

  /**
   * User account is suspended
   */
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',

  /**
   * User account email not confirmed
   */
  ACCOUNT_NOT_CONFIRMED = 'ACCOUNT_NOT_CONFIRMED',

  /**
   * User does not have required permission
   */
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  /**
   * Session has expired
   */
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  /**
   * Network error occurred
   */
  NETWORK_ERROR = 'NETWORK_ERROR',

  /**
   * Server error occurred
   */
  SERVER_ERROR = 'SERVER_ERROR',
}

/**
 * Authentication error information
 */
export interface AuthError {
  /**
   * Error code for programmatic handling
   */
  code: AuthErrorCode;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Additional error details
   */
  details?: Record<string, unknown>;
}

// ============================================================================
// Additional Types
// ============================================================================

/**
 * Authentication methods supported by Moodle
 */
export enum AuthMethod {
  /**
   * Manual accounts (username/password)
   */
  MANUAL = 'manual',

  /**
   * LDAP authentication
   */
  LDAP = 'ldap',

  /**
   * OAuth2 authentication
   */
  OAUTH2 = 'oauth2',

  /**
   * SAML authentication
   */
  SAML = 'saml',

  /**
   * Shibboleth authentication
   */
  SHIBBOLETH = 'shibboleth',

  /**
   * CAS authentication
   */
  CAS = 'cas',

  /**
   * MNet authentication
   */
  MNet = 'mnet',

  /**
   * Email-based self-registration
   */
  EMAIL = 'email',
}

/**
 * User preferences
 *
 * Stored in mdl_user_preferences table
 */
export interface UserPreferences {
  /**
   * Preferred theme
   */
  theme?: string;

  /**
   * Preferred language
   */
  language?: string;

  /**
   * Preferred timezone
   */
  timezone?: Timezone;

  /**
   * Email format (0 = plain, 1 = HTML)
   */
  mailformat?: number;

  /**
   * Whether to stop all emails (0 = no, 1 = yes)
   */
  emailstop?: number;
}

/**
 * Session information
 *
 * Tracks user session details
 */
export interface SessionInfo {
  /**
   * Session identifier
   */
  sessionId: string;

  /**
   * User ID for this session
   */
  userId: number;

  /**
   * Unix timestamp when user logged in
   */
  loginTime: number;

  /**
   * Unix timestamp of last activity
   */
  lastAccess: number;

  /**
   * IP address for this session
   */
  ipAddress: string;

  /**
   * User agent string
   */
  userAgent: string;
}
