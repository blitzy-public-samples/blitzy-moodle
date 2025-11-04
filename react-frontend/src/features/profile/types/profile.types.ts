/**
 * Profile Feature Type Definitions
 * 
 * Comprehensive type definitions for user profiles, preferences, and related operations
 * in the Moodle React frontend. These types ensure type safety across profile management.
 * 
 * @module features/profile/types
 */

/**
 * Core User entity representing a Moodle user profile
 * Contains all essential user information displayed and managed in the profile feature
 */
export interface User {
  /** Unique user identifier */
  id: number;
  
  /** Username for authentication */
  username: string;
  
  /** User's first name */
  firstname: string;
  
  /** User's last name */
  lastname: string;
  
  /** Full name (computed from firstname + lastname) */
  fullname: string;
  
  /** Primary email address */
  email: string;
  
  /** URL to user's profile picture/avatar */
  profileimageurl: string;
  
  /** Alternative URL for small avatar */
  profileimageurlsmall: string;
  
  /** User's city */
  city?: string;
  
  /** User's country code (ISO 3166-1 alpha-2) */
  country?: string;
  
  /** User's timezone */
  timezone?: string;
  
  /** User's preferred language */
  lang?: string;
  
  /** User's phone number */
  phone1?: string;
  
  /** Alternative phone number */
  phone2?: string;
  
  /** User's institution/organization */
  institution?: string;
  
  /** User's department */
  department?: string;
  
  /** User's description/bio */
  description?: string;
  
  /** Description format (1=HTML, 0=MOODLE, 2=PLAIN, 4=MARKDOWN) */
  descriptionformat?: number;
  
  /** User's interests (comma-separated tags) */
  interests?: string;
  
  /** User's website URL */
  url?: string;
  
  /** Instant messaging ID (AIM) */
  aim?: string;
  
  /** Instant messaging ID (ICQ) */
  icq?: string;
  
  /** Instant messaging ID (MSN) */
  msn?: string;
  
  /** Instant messaging ID (Yahoo) */
  yahoo?: string;
  
  /** Instant messaging ID (Skype) */
  skype?: string;
  
  /** First access timestamp */
  firstaccess?: number;
  
  /** Last access timestamp */
  lastaccess?: number;
  
  /** Last login timestamp */
  lastlogin?: number;
  
  /** Current login timestamp */
  currentlogin?: number;
  
  /** User roles across the system */
  roles?: UserRole[];
  
  /** User preferences */
  preferences?: UserPreferences;
  
  /** Whether user email is confirmed */
  emailconfirmed?: boolean;
  
  /** Whether user account is suspended */
  suspended?: boolean;
  
  /** Authentication method */
  auth?: string;
  
  /** Custom profile fields */
  customfields?: CustomField[];
}

/**
 * User role information
 */
export interface UserRole {
  /** Role ID */
  roleid: number;
  
  /** Role short name */
  shortname: string;
  
  /** Role display name */
  name: string;
  
  /** Context ID where role is assigned */
  contextid: number;
  
  /** Context level (10=system, 50=course, etc.) */
  contextlevel: number;
}

/**
 * Custom profile field
 */
export interface CustomField {
  /** Field short name */
  shortname: string;
  
  /** Field display name */
  name: string;
  
  /** Field data type */
  type: string;
  
  /** Field value */
  value: string | number | boolean;
}

/**
 * User preferences and settings
 * Stores configurable user preferences for UI and behavior customization
 */
export interface UserPreferences {
  /** Theme preference */
  theme?: string;
  
  /** Email display setting (0=hidden, 1=visible to course members, 2=visible to all) */
  maildisplay?: number;
  
  /** Email digest type (0=no digest, 1=complete, 2=subjects) */
  maildigest?: number;
  
  /** Email format (0=plain text, 1=HTML) */
  mailformat?: number;
  
  /** Whether to auto-subscribe to forum discussions */
  autosubscribe?: boolean;
  
  /** Whether to track forum read/unread status */
  trackforums?: boolean;
  
  /** Calendar type preference */
  calendartype?: string;
  
  /** Number of courses to display on dashboard */
  coursesperpage?: number;
  
  /** Editor preference */
  htmleditor?: boolean;
  
  /** Notification preferences */
  notifications?: {
    /** Email notifications enabled */
    email?: boolean;
    
    /** Web notifications enabled */
    web?: boolean;
    
    /** Mobile push notifications enabled */
    mobile?: boolean;
  };
  
  /** Accessibility features */
  accessibility?: {
    /** Screen reader optimization */
    screenreader?: boolean;
    
    /** Keyboard navigation hints */
    keyboardnav?: boolean;
    
    /** High contrast mode */
    highcontrast?: boolean;
  };
  
  /** Additional custom preferences */
  [key: string]: unknown;
}

/**
 * Payload for updating user profile
 * Contains only the fields that can be updated via the profile edit form
 */
export interface UpdateProfilePayload {
  /** User ID (required for identifying which profile to update) */
  userid: number;
  
  /** Updated first name */
  firstname?: string;
  
  /** Updated last name */
  lastname?: string;
  
  /** Updated email address */
  email?: string;
  
  /** Updated city */
  city?: string;
  
  /** Updated country code */
  country?: string;
  
  /** Updated timezone */
  timezone?: string;
  
  /** Updated preferred language */
  lang?: string;
  
  /** Updated phone number */
  phone1?: string;
  
  /** Updated alternative phone number */
  phone2?: string;
  
  /** Updated institution */
  institution?: string;
  
  /** Updated department */
  department?: string;
  
  /** Updated description/bio */
  description?: string;
  
  /** Updated description format */
  descriptionformat?: number;
  
  /** Updated interests */
  interests?: string;
  
  /** Updated website URL */
  url?: string;
  
  /** Updated AIM ID */
  aim?: string;
  
  /** Updated ICQ ID */
  icq?: string;
  
  /** Updated MSN ID */
  msn?: string;
  
  /** Updated Yahoo ID */
  yahoo?: string;
  
  /** Updated Skype ID */
  skype?: string;
  
  /** Updated custom fields */
  customfields?: Array<{
    shortname: string;
    value: string | number | boolean;
  }>;
}

/**
 * Response from avatar upload operation
 * Contains the new avatar URLs after successful upload
 */
export interface AvatarUploadResponse {
  /** Whether upload was successful */
  success: boolean;
  
  /** New profile image URL (full size) */
  profileimageurl: string;
  
  /** New profile image URL (small size) */
  profileimageurlsmall: string;
  
  /** Timestamp of when avatar was updated */
  updated: number;
  
  /** Optional message */
  message?: string;
  
  /** Optional error details if success is false */
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

/**
 * Profile update response
 * Response structure when updating profile information
 */
export interface ProfileUpdateResponse {
  /** Whether update was successful */
  success: boolean;
  
  /** Updated user data */
  user?: User;
  
  /** Success message */
  message?: string;
  
  /** Validation errors if any */
  errors?: Record<string, string[]>;
  
  /** Warnings (non-blocking issues) */
  warnings?: string[];
}

/**
 * Profile picture/avatar file constraints
 */
export interface AvatarConstraints {
  /** Maximum file size in bytes (default: 5MB) */
  maxSize: number;
  
  /** Allowed MIME types */
  allowedTypes: string[];
  
  /** Minimum dimensions */
  minWidth: number;
  minHeight: number;
  
  /** Maximum dimensions */
  maxWidth: number;
  maxHeight: number;
  
  /** Aspect ratio requirements */
  aspectRatio?: {
    min: number;
    max: number;
  };
}

/**
 * Type guard to check if a user has required profile fields
 */
export function isCompleteProfile(user: Partial<User>): user is User {
  return !!(
    user.id &&
    user.username &&
    user.firstname &&
    user.lastname &&
    user.email
  );
}

/**
 * Type for profile field names (for form validation)
 */
export type ProfileField = keyof UpdateProfilePayload;

/**
 * Type for profile edit form state
 */
export type ProfileFormState = Partial<UpdateProfilePayload> & {
  isSubmitting?: boolean;
  errors?: Record<string, string>;
};
