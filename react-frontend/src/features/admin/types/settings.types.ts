/**
 * System Settings and Configuration Type Definitions
 *
 * TypeScript interfaces and enums for Moodle system settings management.
 * Based on Moodle's config and config_plugins database tables.
 * Referenced from: public/admin/settings.php, public/admin/settings/plugins.php, public/admin/lib.php
 *
 * @module features/admin/types/settings.types
 */

import type { Id, UserId, Timestamp } from '@/types/common';

// ============================================================================
// System Settings Interfaces
// ============================================================================

/**
 * System Setting Interface
 *
 * Represents a global system configuration setting from mdl_config table.
 * These settings control system-wide behavior and appearance.
 *
 * Database mapping:
 * - id: Primary key (int 10)
 * - name: Setting name/key (varchar 255)
 * - value: Setting value (text)
 */
export interface SystemSetting {
  /** Unique identifier for the system setting */
  id: Id;

  /** Setting name/key (e.g., 'sitename', 'defaultlang', 'theme') */
  name: string;

  /** Setting value (stored as text, can be string, number, or serialized data) */
  value: string | null;
}

/**
 * Plugin Configuration Interface
 *
 * Represents plugin-specific configuration from mdl_config_plugins table.
 * Each plugin (activity module, block, auth method, etc.) can have its own settings.
 *
 * Database mapping:
 * - id: Primary key (int 10)
 * - plugin: Plugin name (varchar 100)
 * - name: Setting name/key (varchar 100)
 * - value: Setting value (text)
 */
export interface PluginConfig {
  /** Unique identifier for the plugin config entry */
  id: Id;

  /** Plugin name (e.g., 'mod_forum', 'block_calendar', 'auth_ldap') */
  plugin: string;

  /** Setting name/key within the plugin (e.g., 'maxbytes', 'displaymode') */
  name: string;

  /** Setting value (stored as text, can be string, number, or serialized data) */
  value: string | null;
}

// ============================================================================
// Setting Categories and Types
// ============================================================================

/**
 * Setting Category Enum
 *
 * Organizes settings into logical groups for the admin interface.
 * Based on Moodle's admin settings tree structure.
 */
export enum SettingCategory {
  /** General site settings (site name, support email, etc.) */
  GENERAL = 'general',

  /** Appearance and theme settings */
  APPEARANCE = 'appearance',

  /** Course-related settings (format, completion, etc.) */
  COURSES = 'courses',

  /** User-related settings (profiles, authentication, etc.) */
  USERS = 'users',

  /** Grading and gradebook settings */
  GRADES = 'grades',

  /** Plugin management and configuration */
  PLUGINS = 'plugins',

  /** Development and debugging settings */
  DEVELOPMENT = 'development',

  /** Experimental features (may be unstable) */
  EXPERIMENTAL = 'experimental',

  /** Security settings (passwords, session, etc.) */
  SECURITY = 'security',

  /** Privacy and data protection settings */
  PRIVACY = 'privacy',
}

/**
 * Setting Type Enum
 *
 * Defines the input type for settings in forms.
 * Determines validation rules and UI rendering.
 */
export enum SettingType {
  /** Single-line text input */
  TEXT = 'text',

  /** Multi-line text area */
  TEXTAREA = 'textarea',

  /** Dropdown select menu */
  SELECT = 'select',

  /** Checkbox (boolean on/off) */
  CHECKBOX = 'checkbox',

  /** Password input (masked) */
  PASSWORD = 'password',

  /** File system path input */
  PATH = 'path',

  /** URL input with validation */
  URL = 'url',

  /** Email address input with validation */
  EMAIL = 'email',

  /** Numeric input */
  NUMBER = 'number',

  /** Duration input (seconds, with human-readable display) */
  DURATION = 'duration',
}

// ============================================================================
// Form and Validation Interfaces
// ============================================================================

/**
 * Setting Form Data Interface
 *
 * Data structure for updating settings through forms.
 * Used when submitting setting changes to the API.
 */
export interface SettingFormData {
  /** Setting name/key to update */
  name: string;

  /** New value for the setting */
  value: string | number | boolean | null;

  /** Optional plugin name (for plugin-specific settings) */
  plugin?: string;
}

/**
 * Setting Validation Interface
 *
 * Defines validation rules for setting values.
 * Used for client-side validation before submission.
 */
export interface SettingValidation {
  /** Whether the setting is required (cannot be empty) */
  required?: boolean;

  /** Minimum length for text values */
  minLength?: number;

  /** Maximum length for text values */
  maxLength?: number;

  /** Regular expression pattern for validation */
  pattern?: string;

  /** Minimum value for numeric settings */
  min?: number;

  /** Maximum value for numeric settings */
  max?: number;

  /** Custom validation function */
  custom?: (value: string | number | boolean | null) => boolean | string;
}

// ============================================================================
// Configuration Audit and Logging
// ============================================================================

/**
 * Configuration Log Interface
 *
 * Tracks configuration changes for audit trail.
 * Records who changed what setting, when, and what the previous value was.
 *
 * Database mapping:
 * - id: Primary key (int 10)
 * - userid: User who made the change (int 10, FK to mdl_user)
 * - timemodified: When the change was made (int 10, Unix timestamp)
 * - plugin: Plugin name or null for system settings (varchar 100)
 * - name: Setting name (varchar 100)
 * - value: New value (text)
 * - oldvalue: Previous value (text)
 */
export interface ConfigLog {
  /** Unique identifier for the log entry */
  id: Id;

  /** ID of the administrator who made the change */
  userid: UserId;

  /** Unix timestamp of when the change was made */
  timemodified: Timestamp;

  /** Plugin name (null for system settings) */
  plugin: string | null;

  /** Setting name that was changed */
  name: string;

  /** New value that was set */
  value: string | null;

  /** Previous value before the change */
  oldvalue: string | null;
}

// ============================================================================
// Plugin Management Interfaces
// ============================================================================

/**
 * Plugin Information Interface
 *
 * Comprehensive information about an installed plugin.
 * Used in plugin management and configuration interfaces.
 */
export interface PluginInfo {
  /** Plugin name (e.g., 'mod_forum', 'block_calendar') */
  name: string;

  /** Plugin type (e.g., 'mod', 'block', 'auth', 'enrol') */
  type: string;

  /** Plugin version string (e.g., '2024011500') */
  version: string;

  /** Whether the plugin is currently enabled */
  enabled: boolean;

  /** List of plugin dependencies (other plugins required) */
  dependencies: string[];

  /** Plugin-specific configuration settings */
  settings: PluginConfig[];
}

// ============================================================================
// Setting Group Interface
// ============================================================================

/**
 * Setting Group Interface
 *
 * Groups related settings together in the admin interface.
 * Provides organizational structure and metadata for setting pages.
 */
export interface SettingGroup {
  /** Internal name/identifier for the group */
  name: string;

  /** Display label for the group */
  label: string;

  /** Description of what settings in this group control */
  description: string;

  /** Category this group belongs to */
  category: SettingCategory;

  /** Array of setting names in this group */
  settings: string[];

  /** Display order (lower numbers appear first) */
  order: number;
}

// ============================================================================
// Type Guards and Utility Types
// ============================================================================

/**
 * Type guard to check if a config entry is a system setting
 */
export function isSystemSetting(
  setting: SystemSetting | PluginConfig
): setting is SystemSetting {
  return !('plugin' in setting);
}

/**
 * Type guard to check if a config entry is a plugin setting
 */
export function isPluginConfig(
  setting: SystemSetting | PluginConfig
): setting is PluginConfig {
  return 'plugin' in setting;
}

/**
 * Union type for any configuration setting
 */
export type AnySetting = SystemSetting | PluginConfig;

/**
 * Setting value type (union of possible value types)
 */
export type SettingValue = string | number | boolean | null;

/**
 * Setting with metadata (includes type, category, validation)
 */
export interface SettingMetadata {
  /** The setting data */
  setting: AnySetting;

  /** Setting type for form rendering */
  type: SettingType;

  /** Setting category for organization */
  category: SettingCategory;

  /** Validation rules */
  validation?: SettingValidation;

  /** Display label */
  label: string;

  /** Help text or description */
  description?: string;

  /** Whether the setting requires a restart to take effect */
  requiresRestart?: boolean;

  /** Default value for the setting */
  defaultValue?: SettingValue;
}
