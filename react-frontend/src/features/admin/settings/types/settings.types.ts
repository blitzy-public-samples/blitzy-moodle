/**
 * Admin Settings Type Definitions
 *
 * Comprehensive TypeScript interfaces and types for the Moodle admin settings
 * feature module. Defines all setting types, form data structures, API contracts,
 * validation schemas, and page state management for system configuration.
 *
 * Based on Moodle admin settings architecture from:
 * - public/admin/settings.php
 * - public/admin/settings/appearance.php
 * - public/admin/settings/server.php
 * - public/admin/settings/security.php
 * - public/admin/settings/courses.php
 *
 * @module features/admin/settings/types
 */

import type { MimeType } from '@/types/common';

// ============================================================================
// Setting Type Enum
// ============================================================================

/**
 * Enumeration of all possible setting types in Moodle admin configuration.
 * Each type corresponds to a specific input control and validation pattern.
 */
export enum SettingType {
  /** Plain text input field */
  TEXT = 'text',

  /** Dropdown select with predefined options */
  SELECT = 'select',

  /** Boolean checkbox control */
  CHECKBOX = 'checkbox',

  /** File upload control with validation */
  FILE = 'file',

  /** Color picker for theme customization */
  COLOR = 'color',

  /** Email address input with validation */
  EMAIL = 'email',

  /** URL input with format validation */
  URL = 'url',

  /** Executable path with filesystem validation */
  EXECUTABLE = 'executable',

  /** Multi-line text area */
  TEXTAREA = 'textarea',

  /** Password input with strength indicator */
  PASSWORD = 'password',

  /** Numeric input with min/max constraints */
  NUMBER = 'number',
}

// ============================================================================
// Base Setting Interface
// ============================================================================

/**
 * Base interface for all setting types with common properties.
 * All specific setting interfaces extend this base.
 */
export interface BaseSetting {
  /** Unique setting identifier (matches Moodle config key) */
  name: string;

  /** Current setting value */
  value: string | number | boolean | null;

  /** Human-readable label for the setting */
  label: string;

  /** Detailed description or help text */
  description: string;

  /** Whether the setting is required (must have non-empty value) */
  required: boolean;

  /** Whether the setting is read-only (display only, no editing) */
  readonly: boolean;

  /** Default value when resetting or initializing */
  defaultValue: string | number | boolean | null;

  /** Type discriminator for union type narrowing */
  type: SettingType;
}

// ============================================================================
// Specific Setting Type Interfaces
// ============================================================================

/**
 * Text input setting with optional constraints and formatting.
 */
export interface TextSetting extends BaseSetting {
  type: SettingType.TEXT;

  /** HTML5 input size attribute */
  size?: number;

  /** Maximum character length */
  maxLength?: number;

  /** Placeholder text for empty input */
  placeholder?: string;

  /** RegEx pattern for validation */
  pattern?: string;
}

/**
 * Select dropdown setting with single or multiple selection.
 */
export interface SelectSetting extends BaseSetting {
  type: SettingType.SELECT;

  /** Available options for the dropdown */
  options: SelectOption[];

  /** Allow multiple selections (renders as multi-select) */
  multiple?: boolean;
}

/**
 * Checkbox boolean setting.
 */
export interface CheckboxSetting extends BaseSetting {
  type: SettingType.CHECKBOX;
  value: boolean;

  /** Current checked state (same as value for type safety) */
  checked: boolean;
}

/**
 * File upload setting with MIME type and size restrictions.
 */
export interface FileSetting extends BaseSetting {
  type: SettingType.FILE;

  /** Accepted MIME types (e.g., "image/png,image/jpeg") */
  accept?: MimeType[];

  /** Maximum file size in bytes */
  maxSize?: number;

  /** Allow multiple file uploads */
  multiple?: boolean;
}

/**
 * Color picker setting for theme customization.
 */
export interface ColorSetting extends BaseSetting {
  type: SettingType.COLOR;
  value: string;

  /** Color format (hex, rgb, hsl) */
  format?: 'hex' | 'rgb' | 'hsl';

  /** Predefined color presets for quick selection */
  presets?: string[];
}

/**
 * Email address input with validation.
 */
export interface EmailSetting extends BaseSetting {
  type: SettingType.EMAIL;
  value: string;

  /** Enable server-side email format validation */
  validateEmail: boolean;
}

/**
 * URL input with format and accessibility validation.
 */
export interface UrlSetting extends BaseSetting {
  type: SettingType.URL;
  value: string;

  /** Enable URL format and accessibility validation */
  validateUrl: boolean;
}

/**
 * Executable path setting with filesystem validation.
 */
export interface ExecutableSetting extends BaseSetting {
  type: SettingType.EXECUTABLE;
  value: string;

  /** Enable server-side path existence and executable validation */
  validatePath: boolean;
}

/**
 * Multi-line textarea setting.
 */
export interface TextareaSetting extends BaseSetting {
  type: SettingType.TEXTAREA;
  value: string;

  /** Number of visible rows */
  rows?: number;

  /** Number of visible columns */
  cols?: number;

  /** Maximum character length */
  maxLength?: number;
}

/**
 * Password input with optional strength requirements.
 */
export interface PasswordSetting extends BaseSetting {
  type: SettingType.PASSWORD;
  value: string;

  /** Display password strength indicator */
  showStrength?: boolean;

  /** Minimum password length */
  minLength?: number;
}

/**
 * Numeric input with range constraints.
 */
export interface NumberSetting extends BaseSetting {
  type: SettingType.NUMBER;
  value: number;

  /** Minimum allowed value */
  min?: number;

  /** Maximum allowed value */
  max?: number;

  /** Increment/decrement step */
  step?: number;
}

// ============================================================================
// Union Types for Settings
// ============================================================================

/**
 * Discriminated union of all setting types.
 * Use the 'type' property for type narrowing with TypeScript's type guards.
 */
export type Setting =
  | TextSetting
  | SelectSetting
  | CheckboxSetting
  | FileSetting
  | ColorSetting
  | EmailSetting
  | UrlSetting
  | ExecutableSetting
  | TextareaSetting
  | PasswordSetting
  | NumberSetting;

/**
 * Union type of all possible setting values.
 */
export type SettingValue = string | number | boolean | null | string[];

// ============================================================================
// Setting Organization Structures
// ============================================================================

/**
 * Category grouping multiple related settings.
 * Maps to Moodle's admin settings categories.
 */
export interface SettingCategory {
  /** Unique category identifier */
  id: string;

  /** Category display name */
  name: string;

  /** Category description or help text */
  description: string;

  /** Material-UI icon name for visual identification */
  icon?: string;

  /** Array of settings within this category */
  settings: Setting[];
}

/**
 * Section grouping multiple categories with optional subsections.
 * Represents top-level admin settings pages (e.g., Appearance, Security).
 */
export interface SettingsSection {
  /** Section identifier (e.g., "appearance", "security") */
  section: string;

  /** Section display title */
  title: string;

  /** Section description */
  description: string;

  /** Categories within this section */
  categories: SettingCategory[];

  /** Optional nested subsections for hierarchical organization */
  subsections?: SettingsSection[];
}

// ============================================================================
// Specialized Setting Options
// ============================================================================

/**
 * Option for select dropdown settings.
 */
export interface SelectOption {
  /** Option value (stored in config) */
  value: string | number;

  /** Display label for the option */
  label: string;

  /** Whether the option is disabled */
  disabled?: boolean;
}

/**
 * Configuration options for file upload settings.
 */
export interface FileUploadOptions {
  /** Maximum file size in bytes */
  maxSize: number;

  /** Accepted MIME types */
  accept: MimeType[];

  /** Allow multiple file uploads */
  multiple: boolean;

  /** Show image preview for image files */
  preview: boolean;
}

/**
 * Configuration options for color picker settings.
 */
export interface ColorPickerOptions {
  /** Color value format */
  format: 'hex' | 'rgb' | 'hsl';

  /** Predefined color presets */
  presets: string[];

  /** Show alpha (transparency) channel */
  showAlpha: boolean;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request parameters for fetching settings.
 */
export interface GetSettingsRequest {
  /** Section identifier (optional, returns all if omitted) */
  section?: string;

  /** Category identifier (optional, returns all in section if omitted) */
  category?: string;
}

/**
 * Response from settings fetch API.
 */
export interface GetSettingsResponse {
  /** Request success status */
  success: boolean;

  /** Response data containing sections and settings */
  data: {
    sections: SettingsSection[];
  };

  /** Optional metadata (pagination, timestamps, etc.) */
  meta?: {
    timestamp: number;
    version: string;
  };
}

/**
 * Request to update a single setting value.
 */
export interface UpdateSettingRequest {
  /** Setting name (unique identifier) */
  name: string;

  /** New setting value */
  value: SettingValue;

  /** Section containing the setting */
  section: string;
}

/**
 * Response from single setting update API.
 */
export interface UpdateSettingResponse {
  /** Request success status */
  success: boolean;

  /** Response data with updated setting */
  data: {
    setting: Setting;
  };

  /** Optional metadata */
  meta?: {
    timestamp: number;
  };
}

/**
 * Request to save multiple settings at once (batch update).
 */
export interface SaveAllSettingsRequest {
  /** Array of setting updates */
  settings: SettingUpdate[];

  /** Section identifier for the batch update */
  section: string;
}

/**
 * Response from batch settings save API.
 */
export interface SaveAllSettingsResponse {
  /** Request success status */
  success: boolean;

  /** Response data with update results */
  data: {
    /** Number of settings successfully updated */
    updated: number;

    /** Array of settings that failed validation or update */
    failed: Array<{
      name: string;
      error: string;
    }>;
  };

  /** Optional metadata */
  meta?: {
    timestamp: number;
  };
}

// ============================================================================
// Form Data Types
// ============================================================================

/**
 * Form state for settings management.
 */
export interface SettingsFormData {
  /** Map of setting names to their current form values */
  settings: Record<string, SettingValue>;

  /** Whether the form has unsaved changes */
  isDirty: boolean;

  /** Validation errors by setting name */
  errors: Record<string, ValidationError[]>;
}

/**
 * Individual setting update for batch operations.
 */
export interface SettingUpdate {
  /** Setting name (unique identifier) */
  name: string;

  /** New setting value */
  value: SettingValue;

  /** Section containing the setting */
  section: string;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation error for a specific setting field.
 */
export interface ValidationError {
  /** Field name that failed validation */
  field: string;

  /** Human-readable error message */
  message: string;

  /** Error type for categorization */
  type: 'required' | 'format' | 'range' | 'custom';
}

/**
 * Validation rule configuration for a setting.
 */
export interface SettingValidationRule {
  /** Rule type */
  type: 'required' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'email' | 'url' | 'custom';

  /** Validation error message */
  message: string;

  /** Rule parameters (e.g., min: 5, max: 100) */
  params?: Record<string, unknown>;
}

/**
 * Result of setting validation.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Array of validation errors (empty if valid) */
  errors: ValidationError[];
}

// ============================================================================
// Setting Metadata and Behavior
// ============================================================================

/**
 * Metadata controlling setting visibility, dependencies, and callbacks.
 */
export interface SettingMetadata {
  /** Visibility conditions based on other settings or user roles */
  visibility?: {
    /** Show setting only if condition evaluates to true */
    condition?: (settings: Record<string, SettingValue>) => boolean;

    /** Required capabilities to view/edit this setting */
    requiredCapabilities?: string[];
  };

  /** Dependencies on other settings */
  dependencies?: {
    /** Setting names that this setting depends on */
    dependsOn: string[];

    /** Callback to validate dependencies */
    validate?: (values: Record<string, SettingValue>) => boolean;
  };

  /** Callback function executed after setting update */
  onUpdate?: (value: SettingValue, allSettings: Record<string, SettingValue>) => void | Promise<void>;
}

// ============================================================================
// Page State Types
// ============================================================================

/**
 * Complete state for the settings management page.
 */
export interface SettingsPageState {
  /** All settings sections */
  sections: SettingsSection[];

  /** Currently active section identifier */
  currentSection: string | null;

  /** Loading state for async operations */
  loadingState: SettingsLoadingState;

  /** Save operation state */
  saveState: SettingsSaveState;

  /** Global errors not tied to specific fields */
  errors: SettingsError[];
}

/**
 * Loading state for settings page operations.
 */
export type SettingsLoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * State tracking save operations.
 */
export interface SettingsSaveState {
  /** Current save operation status */
  status: 'idle' | 'saving' | 'success' | 'error';

  /** Save progress (0-100) for batch operations */
  progress: number;

  /** Errors encountered during save */
  errors: SettingsError[];
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Structured error for settings operations.
 */
export interface SettingsError {
  /** Error code for categorization */
  code: 'VALIDATION_ERROR' | 'PERMISSION_DENIED' | 'NETWORK_ERROR' | 'SERVER_ERROR' | 'UNKNOWN_ERROR';

  /** Human-readable error message */
  message: string;

  /** Additional error details */
  details?: Record<string, unknown>;
}
