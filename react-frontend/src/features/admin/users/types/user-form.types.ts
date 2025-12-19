/**
 * User Form Type Definitions
 *
 * TypeScript type definitions and Zod validation schemas for user edit forms.
 * These types ensure type-safe form handling for creating and updating users.
 *
 * Schema source: public/lib/db/install.xml (user table, lines 869-940)
 * Form reference: public/user/editadvanced.php, public/admin/user.php
 *
 * @package react-frontend
 * @subpackage features/admin/users/types
 */

import { z } from 'zod';
import { UserAuthMethod } from './user.types';

/**
 * Complete user form data interface
 *
 * Represents all editable fields in a user form based on Moodle user table schema.
 * This interface includes all fields that can be modified through the admin UI.
 *
 * @interface UserFormData
 */
export interface UserFormData {
  // Core identity fields
  /** Unique username for login (lowercase, alphanumeric, 3-100 chars) */
  username: string;

  /** Primary email address (must be valid email format) */
  email: string;

  /** User's first name / given name (max 100 chars) */
  firstname: string;

  /** User's last name / family name (max 100 chars) */
  lastname: string;

  /** Authentication method (manual, ldap, oauth2, shibboleth, cas) */
  auth: string;

  /** Password for new users or password change (min 8 chars, required for create) */
  password?: string;

  /** Password confirmation (must match password field) */
  passwordConfirm?: string;

  /** Force password change on next login (true/false) */
  forcePasswordChange?: boolean;

  /** Profile picture file for upload */
  profilePicture?: File | null;

  // Location fields
  /** City of residence (max 120 chars) */
  city: string;

  /** Country code (ISO 3166-1 alpha-2, 2 chars) */
  country: string;

  // Optional identity fields
  /** User ID number from external system (max 255 chars) */
  idnumber?: string;

  /** Primary phone number (max 20 chars) */
  phone1?: string;

  /** Secondary phone number (max 20 chars) */
  phone2?: string;

  /** Institution or organization (max 255 chars) */
  institution?: string;

  /** Department within institution (max 255 chars) */
  department?: string;

  /** Physical address (max 255 chars) */
  address?: string;

  // Preference fields
  /** Language preference (ISO 639-1 code, max 30 chars, default: 'en') */
  lang?: string;

  /** Calendar type preference (default: 'gregorian', max 30 chars) */
  calendartype?: string;

  /** Theme preference (max 50 chars) */
  theme?: string;

  /** Timezone preference (default: '99' for server timezone, max 100 chars) */
  timezone?: string;

  // Profile description
  /** User profile description (HTML allowed) */
  description?: string;

  /** Description format (0=MOODLE, 1=HTML, 2=PLAIN, 4=MARKDOWN) */
  descriptionformat?: number;

  // Email and notification preferences
  /** Email format preference (0=plain text, 1=HTML) */
  mailformat?: number;

  /** Email digest type (0=no digest, 1=complete, 2=subjects) */
  maildigest?: number;

  /** Email display setting (0=hide, 1=course members, 2=all users) */
  maildisplay?: number;

  /** Auto-subscribe to forum discussions (0=no, 1=yes) */
  autosubscribe?: number;

  /** Track forum read/unread status (0=no, 1=yes) */
  trackforums?: number;

  // Account status fields
  /** Account suspension status (false=active, true=suspended) */
  suspended?: boolean;

  /** Email confirmation status (false=unconfirmed, true=confirmed) */
  confirmed?: boolean;

  // Name variants for internationalization
  /** Middle name (max 255 chars) */
  middlename?: string;

  /** Alternate name for display (max 255 chars) */
  alternatename?: string;

  /** Phonetic spelling of last name (max 255 chars) */
  lastnamephonetic?: string;

  /** Phonetic spelling of first name (max 255 chars) */
  firstnamephonetic?: string;
}

/**
 * Zod validation schema for complete user form data
 *
 * Provides comprehensive validation rules for all user form fields including:
 * - Email format validation
 * - Username constraints (length, format)
 * - Phone number patterns
 * - Required vs optional fields
 * - String length limits
 * - Numeric range validation
 *
 * @constant userFormSchema
 */
export const userFormSchema = z.object({
  // Core identity fields - all required
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(100, 'Username must not exceed 100 characters')
    .regex(
      /^[a-z0-9@._-]+$/,
      'Username can only contain lowercase letters, numbers, and @._- symbols'
    )
    .trim(),

  email: z
    .string()
    .email('Must be a valid email address')
    .max(100, 'Email must not exceed 100 characters')
    .trim()
    .toLowerCase(),

  firstname: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must not exceed 100 characters')
    .trim(),

  lastname: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must not exceed 100 characters')
    .trim(),

  auth: z.nativeEnum(UserAuthMethod, {
    errorMap: () => ({ message: 'Invalid authentication method' }),
  }),

  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(255, 'Password must not exceed 255 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    )
    .optional(),

  // Location fields - required
  city: z
    .string()
    .min(1, 'City is required')
    .max(120, 'City must not exceed 120 characters')
    .trim(),

  country: z
    .string()
    .length(2, 'Country code must be exactly 2 characters')
    .regex(/^[A-Z]{2}$/, 'Country code must be uppercase ISO 3166-1 alpha-2 format')
    .trim(),

  // Optional identity fields
  idnumber: z
    .string()
    .max(255, 'ID number must not exceed 255 characters')
    .trim()
    .optional()
    .nullable(),

  phone1: z
    .string()
    .max(20, 'Phone number must not exceed 20 characters')
    .regex(/^[0-9+\-() ]*$/, 'Phone number can only contain numbers, +, -, (, ), and spaces')
    .trim()
    .optional()
    .nullable(),

  phone2: z
    .string()
    .max(20, 'Phone number must not exceed 20 characters')
    .regex(/^[0-9+\-() ]*$/, 'Phone number can only contain numbers, +, -, (, ), and spaces')
    .trim()
    .optional()
    .nullable(),

  institution: z
    .string()
    .max(255, 'Institution must not exceed 255 characters')
    .trim()
    .optional()
    .nullable(),

  department: z
    .string()
    .max(255, 'Department must not exceed 255 characters')
    .trim()
    .optional()
    .nullable(),

  address: z
    .string()
    .max(255, 'Address must not exceed 255 characters')
    .trim()
    .optional()
    .nullable(),

  // Preference fields
  lang: z
    .string()
    .max(30, 'Language code must not exceed 30 characters')
    .regex(/^[a-z]{2}(_[A-Z]{2})?$/, 'Invalid language code format')
    .trim()
    .optional()
    .nullable()
    .default('en'),

  calendartype: z
    .string()
    .max(30, 'Calendar type must not exceed 30 characters')
    .trim()
    .optional()
    .nullable()
    .default('gregorian'),

  theme: z
    .string()
    .max(50, 'Theme name must not exceed 50 characters')
    .trim()
    .optional()
    .nullable(),

  timezone: z
    .string()
    .max(100, 'Timezone must not exceed 100 characters')
    .trim()
    .optional()
    .nullable()
    .default('99'),

  // Profile description
  description: z.string().optional().nullable(),

  descriptionformat: z
    .number()
    .int()
    .min(0)
    .max(4)
    .optional()
    .nullable()
    .default(1),

  // Email and notification preferences
  mailformat: z
    .number()
    .int()
    .min(0)
    .max(1)
    .optional()
    .nullable()
    .default(1),

  maildigest: z
    .number()
    .int()
    .min(0)
    .max(2)
    .optional()
    .nullable()
    .default(0),

  maildisplay: z
    .number()
    .int()
    .min(0)
    .max(2)
    .optional()
    .nullable()
    .default(2),

  autosubscribe: z
    .number()
    .int()
    .min(0)
    .max(1)
    .optional()
    .nullable()
    .default(1),

  trackforums: z
    .number()
    .int()
    .min(0)
    .max(1)
    .optional()
    .nullable()
    .default(0),

  // Account status fields
  suspended: z
    .boolean()
    .optional()
    .nullable()
    .default(false),

  confirmed: z
    .boolean()
    .optional()
    .nullable()
    .default(true),

  // Name variants
  middlename: z
    .string()
    .max(255, 'Middle name must not exceed 255 characters')
    .trim()
    .optional()
    .nullable(),

  alternatename: z
    .string()
    .max(255, 'Alternate name must not exceed 255 characters')
    .trim()
    .optional()
    .nullable(),

  lastnamephonetic: z
    .string()
    .max(255, 'Last name phonetic must not exceed 255 characters')
    .trim()
    .optional()
    .nullable(),

  firstnamephonetic: z
    .string()
    .max(255, 'First name phonetic must not exceed 255 characters')
    .trim()
    .optional()
    .nullable(),
});

/**
 * User creation form data interface
 *
 * Subset of UserFormData for creating new users.
 * Password is required for new user creation.
 * Excludes fields that are auto-generated or not applicable for new users.
 *
 * @interface UserCreateFormData
 */
export interface UserCreateFormData {
  // Core identity fields - all required for creation
  username: string;
  email: string;
  firstname: string;
  lastname: string;
  auth: string;
  password: string; // Required for creation

  // Location fields - required
  city: string;
  country: string;

  // Account status - new users are typically confirmed
  confirmed: boolean;

  // Optional identity fields
  idnumber?: string;
  phone1?: string;
  phone2?: string;
  institution?: string;
  department?: string;
  address?: string;

  // Preference fields
  lang?: string;
  calendartype?: string;
  theme?: string;
  timezone?: string;

  // Profile description
  description?: string;
  descriptionformat?: number;

  // Email and notification preferences
  mailformat?: number;
  maildigest?: number;
  maildisplay?: number;
  autosubscribe?: number;
  trackforums?: number;

  // Name variants
  middlename?: string;
  alternatename?: string;
  lastnamephonetic?: string;
  firstnamephonetic?: string;
}

/**
 * User update form data interface
 *
 * Subset of UserFormData for updating existing users.
 * Includes user ID for identification.
 * Password is optional (only provided when changing password).
 * Includes suspended field for account management.
 *
 * @interface UserUpdateFormData
 */
export interface UserUpdateFormData {
  // User identification - required for updates
  id: number;

  // Core identity fields
  username?: string; // Username might not be editable in some cases
  email: string;
  firstname: string;
  lastname: string;
  auth: string;

  // Location fields
  city: string;
  country: string;

  // Optional identity fields
  idnumber?: string;
  phone1?: string;
  phone2?: string;
  institution?: string;
  department?: string;
  address?: string;

  // Preference fields
  lang?: string;
  calendartype?: string;
  theme?: string;
  timezone?: string;

  // Profile description
  description?: string;
  descriptionformat?: number;

  // Email and notification preferences
  mailformat?: number;
  maildigest?: number;
  maildisplay?: number;
  autosubscribe?: number;
  trackforums?: number;

  // Account status - suspension can be toggled on existing users
  suspended?: boolean;

  // Name variants
  middlename?: string;
  alternatename?: string;
  lastnamephonetic?: string;
  firstnamephonetic?: string;
}

/**
 * Zod validation schema for user creation
 *
 * Extends userFormSchema with creation-specific requirements:
 * - Password is required
 * - Confirmed defaults to 1
 *
 * @constant userCreateFormSchema
 */
export const userCreateFormSchema = userFormSchema
  .extend({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(255, 'Password must not exceed 255 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    confirmed: z
      .boolean()
      .default(true),
  })
  .required({
    username: true,
    email: true,
    firstname: true,
    lastname: true,
    auth: true,
    password: true,
    city: true,
    country: true,
  });

/**
 * Zod validation schema for user updates
 *
 * Extends userFormSchema with update-specific requirements:
 * - ID is required
 * - Password is optional
 * - Suspended field is included
 *
 * @constant userUpdateFormSchema
 */
export const userUpdateFormSchema = userFormSchema
  .extend({
    id: z.number().int().positive('User ID is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(255, 'Password must not exceed 255 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      )
      .optional(),
    suspended: z
      .boolean()
      .optional(),
  })
  .required({
    id: true,
    email: true,
    firstname: true,
    lastname: true,
    auth: true,
    city: true,
    country: true,
  })
  .partial({
    username: true, // Username might not be editable
  });

/**
 * Form field error type
 *
 * Represents validation errors for a single form field.
 */
export type FormFieldError = string | undefined;

/**
 * Form errors type
 *
 * Maps form field names to their validation error messages.
 * Uses Partial to allow for fields without errors.
 */
export type FormErrors<T = UserFormData> = Partial<Record<keyof T, FormFieldError>>;

/**
 * Form touched fields type
 *
 * Tracks which form fields have been interacted with by the user.
 * Used to determine when to display validation errors.
 */
export type FormTouchedFields<T = UserFormData> = Partial<Record<keyof T, boolean>>;

/**
 * Form submission state interface
 *
 * Tracks the overall state of form submission and validation.
 * Used for managing UI state during form operations.
 *
 * @interface FormSubmitState
 */
export interface FormSubmitState {
  /** Whether the form is currently being submitted */
  isSubmitting: boolean;

  /** Whether the form passes all validation rules */
  isValid: boolean;

  /** Whether any form fields have been modified */
  isDirty: boolean;

  /** Number of times form submission has been attempted */
  submitCount: number;

  /** Current validation errors keyed by field name */
  errors: FormErrors;
}

/**
 * Type inference helpers for Zod schemas
 *
 * These types are automatically inferred from the Zod schemas and can be used
 * as alternatives to the manually defined interfaces above.
 */
export type UserFormSchemaType = z.infer<typeof userFormSchema>;
export type UserCreateFormSchemaType = z.infer<typeof userCreateFormSchema>;
export type UserUpdateFormSchemaType = z.infer<typeof userUpdateFormSchema>;
