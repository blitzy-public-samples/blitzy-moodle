/**
 * Admin Settings API Client Module
 *
 * TypeScript API client for admin settings management that provides type-safe
 * functions for fetching and updating Moodle system configuration. Communicates
 * with the backend API endpoints at /api/v1/admin/settings.
 *
 * Features:
 * - Type-safe API functions with strict TypeScript typing
 * - JWT authentication via shared apiClient interceptors
 * - Comprehensive error handling with axios type guards
 * - Full support for settings CRUD operations
 * - Settings tree navigation and section management
 *
 * Usage:
 * ```typescript
 * import { fetchSettings, updateSettings, fetchAllSections } from '@/features/admin/settings/api/settingsApi';
 *
 * // Fetch settings for a specific section
 * const settings = await fetchSettings('security');
 *
 * // Update settings
 * const result = await updateSettings({
 *   section: 'security',
 *   settings: [{ name: 'forcelogin', value: true }]
 * });
 *
 * // Get the full settings tree
 * const tree = await fetchAllSections();
 * ```
 *
 * @module features/admin/settings/api/settingsApi
 */

import apiClient from '@/services/api/client';
import axios from 'axios';
import type { ApiResponse } from '@/types/api';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Settings value type
 *
 * Represents all possible value types that a Moodle setting can have.
 * Settings can be strings (text, email, url), numbers (integer values),
 * booleans (checkboxes), or arrays of strings (multi-select).
 */
export type SettingValue = string | number | boolean | string[];

/**
 * Individual setting structure
 *
 * Represents a single configurable setting within Moodle's administration.
 * Contains the setting's value, metadata, and validation rules.
 *
 * @property name - Unique identifier for the setting (e.g., 'forcelogin')
 * @property value - Current value of the setting
 * @property type - Input type for rendering the setting editor
 * @property title - Human-readable display title
 * @property description - Optional detailed description of the setting
 * @property defaultValue - Default value used when resetting the setting
 * @property options - Available options for select-type settings
 * @property required - Whether the setting must have a value
 * @property validation - Validation rules for the setting value
 */
export interface Setting {
  /** Unique identifier for the setting */
  name: string;

  /** Current value of the setting */
  value: SettingValue;

  /** Input type for the setting editor UI */
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'number' | 'email' | 'url' | 'password';

  /** Human-readable display title */
  title: string;

  /** Optional detailed description explaining the setting's purpose */
  description?: string;

  /** Default value used when resetting the setting */
  defaultValue: SettingValue;

  /** Available options for select-type settings */
  options?: Array<{
    /** Option value to be stored */
    value: string;
    /** Display label for the option */
    label: string;
  }>;

  /** Whether the setting is required to have a value */
  required?: boolean;

  /** Validation rules for the setting value */
  validation?: {
    /** Minimum value for number settings */
    min?: number;
    /** Maximum value for number settings */
    max?: number;
    /** Regular expression pattern for text validation */
    pattern?: string;
    /** Custom validation error message */
    message?: string;
  };
}

/**
 * Settings section structure
 *
 * Represents a grouping of related settings within a category.
 * Sections can contain subsections for nested organization.
 *
 * @property section - Unique identifier for the section (e.g., 'frontpagesettings')
 * @property title - Human-readable section title
 * @property description - Optional description of the section
 * @property settings - Array of settings within this section
 * @property subsections - Optional nested subsections
 */
export interface SettingsSection {
  /** Unique identifier for the section */
  section: string;

  /** Human-readable section title */
  title: string;

  /** Optional description of the section's purpose */
  description?: string;

  /** Array of settings contained in this section */
  settings: Setting[];

  /** Optional nested subsections for hierarchical organization */
  subsections?: SettingsSection[];
}

/**
 * Settings category structure
 *
 * Top-level grouping for settings sections. Categories represent major
 * areas of Moodle configuration (e.g., 'security', 'appearance', 'users').
 *
 * @property category - Unique identifier for the category
 * @property title - Human-readable category title
 * @property description - Optional description of the category
 * @property sections - Array of sections within this category
 */
export interface SettingsCategory {
  /** Unique identifier for the category */
  category: string;

  /** Human-readable category title */
  title: string;

  /** Optional description of the category's purpose */
  description?: string;

  /** Array of sections contained in this category */
  sections: SettingsSection[];
}

/**
 * Update settings payload
 *
 * Request structure for updating settings in a specific section.
 * Contains the target section and an array of setting name/value pairs.
 *
 * @property section - Target section identifier
 * @property settings - Array of settings to update with name and value
 */
export interface UpdateSettingsPayload {
  /** Target section identifier where settings should be updated */
  section: string;

  /** Array of settings to update */
  settings: Array<{
    /** Setting name/identifier */
    name: string;
    /** New value for the setting */
    value: SettingValue;
  }>;
}

/**
 * Update settings response
 *
 * Response structure returned after attempting to update settings.
 * Contains the success status, count of updated settings, and any errors.
 *
 * @property success - Whether the overall operation succeeded
 * @property updated - Number of settings successfully updated
 * @property errors - Array of validation/update errors for specific settings
 */
export interface UpdateSettingsResponse {
  /** Whether the overall update operation succeeded */
  success: boolean;

  /** Number of settings successfully updated */
  updated: number;

  /** Array of errors for settings that failed to update */
  errors: Array<{
    /** Name of the setting that failed */
    setting: string;
    /** Error message describing the failure */
    message: string;
  }>;
}

// ============================================================================
// Custom API Error Class
// ============================================================================

/**
 * Custom API error for settings operations
 *
 * Provides structured error information for settings API operations,
 * including HTTP status codes and error codes for programmatic handling.
 */
export class SettingsApiError extends Error {
  /** HTTP status code */
  public readonly status: number;

  /** Error code for programmatic handling */
  public readonly code: string;

  /** Additional error details */
  public readonly details?: Record<string, unknown>;

  /**
   * Creates a new SettingsApiError instance
   *
   * @param message - Human-readable error message
   * @param status - HTTP status code
   * @param code - Error code for programmatic handling
   * @param details - Optional additional error details
   */
  constructor(
    message: string,
    status: number,
    code: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SettingsApiError';
    this.status = status;
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SettingsApiError);
    }
  }
}

// ============================================================================
// API Client Functions
// ============================================================================

/**
 * Fetch settings for a specific section
 *
 * Retrieves all settings within a specified section from the Moodle admin
 * settings API. The returned settings include their current values, types,
 * validation rules, and metadata.
 *
 * @param section - Section identifier (e.g., 'frontpagesettings', 'security', 'appearance')
 * @returns Promise resolving to SettingsSection with settings array
 * @throws SettingsApiError on API or network errors
 *
 * @example
 * ```typescript
 * const securitySettings = await fetchSettings('security');
 * console.log(securitySettings.settings); // Array of Setting objects
 * ```
 */
export async function fetchSettings(section: string): Promise<SettingsSection> {
  try {
    const response = await apiClient.get<ApiResponse<SettingsSection>>(
      '/admin/settings',
      {
        params: { section },
      }
    );

    // Validate response structure
    if (!response.data.success) {
      throw new SettingsApiError(
        'Failed to fetch settings',
        response.status,
        'FETCH_SETTINGS_FAILED'
      );
    }

    return response.data.data;
  } catch (error: unknown) {
    // Handle axios-specific errors with type guard
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 500;
      const errorData = error.response?.data as {
        error?: { message?: string; code?: string; details?: Record<string, unknown> };
      } | undefined;

      throw new SettingsApiError(
        errorData?.error?.message ?? error.message ?? 'Network error occurred',
        status,
        errorData?.error?.code ?? 'SETTINGS_ERROR',
        errorData?.error?.details
      );
    }

    // Re-throw non-axios errors
    if (error instanceof SettingsApiError) {
      throw error;
    }

    // Wrap unknown errors
    throw new SettingsApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500,
      'UNKNOWN_ERROR'
    );
  }
}

/**
 * Update settings for a specific section
 *
 * Updates one or more settings within a specified section. The API validates
 * all settings before applying changes and returns detailed error information
 * for any settings that fail validation.
 *
 * @param payload - UpdateSettingsPayload containing section and settings to update
 * @returns Promise resolving to UpdateSettingsResponse with success status and any errors
 * @throws SettingsApiError on API or network errors (excludes validation errors)
 *
 * @example
 * ```typescript
 * const result = await updateSettings({
 *   section: 'security',
 *   settings: [
 *     { name: 'forcelogin', value: true },
 *     { name: 'passwordpolicy', value: 'yes' }
 *   ]
 * });
 *
 * if (result.success) {
 *   console.log(`Updated ${result.updated} settings`);
 * } else {
 *   result.errors.forEach(err => console.error(`${err.setting}: ${err.message}`));
 * }
 * ```
 */
export async function updateSettings(
  payload: UpdateSettingsPayload
): Promise<UpdateSettingsResponse> {
  try {
    const response = await apiClient.put<ApiResponse<UpdateSettingsResponse>>(
      '/admin/settings',
      payload
    );

    // Handle response - validation errors are returned in the response, not as exceptions
    if (!response.data.success) {
      // API returned failure in envelope - extract error info
      const errorData = response.data as unknown as {
        error?: { message?: string; code?: string };
      };

      throw new SettingsApiError(
        errorData.error?.message ?? 'Failed to update settings',
        response.status,
        errorData.error?.code ?? 'UPDATE_SETTINGS_FAILED'
      );
    }

    return response.data.data;
  } catch (error: unknown) {
    // Handle axios-specific errors with type guard
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 500;
      const errorData = error.response?.data as {
        error?: { message?: string; code?: string; details?: Record<string, unknown> };
        data?: UpdateSettingsResponse;
      } | undefined;

      // Check if this is a validation error with partial results
      // Some APIs return validation errors in the response body rather than throwing
      if (errorData?.data?.errors && Array.isArray(errorData.data.errors)) {
        return errorData.data;
      }

      throw new SettingsApiError(
        errorData?.error?.message ?? error.message ?? 'Network error occurred',
        status,
        errorData?.error?.code ?? 'UPDATE_ERROR',
        errorData?.error?.details
      );
    }

    // Re-throw SettingsApiError instances
    if (error instanceof SettingsApiError) {
      throw error;
    }

    // Wrap unknown errors
    throw new SettingsApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500,
      'UNKNOWN_ERROR'
    );
  }
}

/**
 * Fetch the complete settings tree
 *
 * Retrieves the full hierarchical structure of all settings categories
 * and sections. Used for building navigation trees and discovering
 * available settings sections.
 *
 * Note: This is a relatively expensive operation. The response should
 * be cached by React Query for 5 minutes to reduce server load.
 *
 * @returns Promise resolving to array of SettingsCategory with nested sections
 * @throws SettingsApiError on API or network errors
 *
 * @example
 * ```typescript
 * const categories = await fetchAllSections();
 * categories.forEach(cat => {
 *   console.log(`Category: ${cat.title}`);
 *   cat.sections.forEach(sec => {
 *     console.log(`  Section: ${sec.title} (${sec.settings.length} settings)`);
 *   });
 * });
 * ```
 */
export async function fetchAllSections(): Promise<SettingsCategory[]> {
  try {
    const response = await apiClient.get<ApiResponse<SettingsCategory[]>>(
      '/admin/settings/tree'
    );

    // Validate response structure
    if (!response.data.success) {
      throw new SettingsApiError(
        'Failed to fetch settings tree',
        response.status,
        'FETCH_TREE_FAILED'
      );
    }

    return response.data.data;
  } catch (error: unknown) {
    // Handle axios-specific errors with type guard
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 500;
      const errorData = error.response?.data as {
        error?: { message?: string; code?: string; details?: Record<string, unknown> };
      } | undefined;

      throw new SettingsApiError(
        errorData?.error?.message ?? error.message ?? 'Network error occurred',
        status,
        errorData?.error?.code ?? 'TREE_ERROR',
        errorData?.error?.details
      );
    }

    // Re-throw SettingsApiError instances
    if (error instanceof SettingsApiError) {
      throw error;
    }

    // Wrap unknown errors
    throw new SettingsApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500,
      'UNKNOWN_ERROR'
    );
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Type guard to check if an error is a SettingsApiError
 *
 * Useful for error handling in catch blocks to determine
 * if the error provides structured API error information.
 *
 * @param error - Error to check
 * @returns True if error is a SettingsApiError instance
 *
 * @example
 * ```typescript
 * try {
 *   await updateSettings(payload);
 * } catch (error) {
 *   if (isSettingsApiError(error)) {
 *     console.log(`API Error ${error.code}: ${error.message}`);
 *   }
 * }
 * ```
 */
export function isSettingsApiError(error: unknown): error is SettingsApiError {
  return error instanceof SettingsApiError;
}

/**
 * Check if a setting value is valid according to its type
 *
 * Client-side validation helper to check if a value matches
 * the expected type for a setting before submitting to the API.
 *
 * @param setting - Setting definition with type information
 * @param value - Value to validate
 * @returns True if value is valid for the setting type
 *
 * @example
 * ```typescript
 * const setting: Setting = { name: 'port', type: 'number', ... };
 * const isValid = isValidSettingValue(setting, '8080'); // false - string not number
 * const isValid2 = isValidSettingValue(setting, 8080);  // true
 * ```
 */
export function isValidSettingValue(setting: Setting, value: unknown): boolean {
  switch (setting.type) {
    case 'checkbox':
      return typeof value === 'boolean';

    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return false;
      }
      // Check validation constraints if present
      if (setting.validation?.min !== undefined && value < setting.validation.min) {
        return false;
      }
      if (setting.validation?.max !== undefined && value > setting.validation.max) {
        return false;
      }
      return true;

    case 'text':
    case 'textarea':
    case 'email':
    case 'url':
    case 'password':
      if (typeof value !== 'string') {
        return false;
      }
      // Check required constraint
      if (setting.required && value.trim() === '') {
        return false;
      }
      // Check pattern constraint if present
      if (setting.validation?.pattern) {
        const regex = new RegExp(setting.validation.pattern);
        if (!regex.test(value)) {
          return false;
        }
      }
      return true;

    case 'select':
      // For select, value must be a string and match one of the options
      if (typeof value !== 'string') {
        return false;
      }
      if (setting.options && setting.options.length > 0) {
        return setting.options.some(opt => opt.value === value);
      }
      return true;

    default:
      // Unknown type - assume valid to allow extension
      return true;
  }
}

/**
 * Convert a setting value to its proper type
 *
 * Converts string representations of values (e.g., from form inputs)
 * to their appropriate JavaScript types based on the setting definition.
 *
 * @param setting - Setting definition with type information
 * @param value - String value to convert
 * @returns Converted value in appropriate type
 *
 * @example
 * ```typescript
 * const numSetting: Setting = { type: 'number', ... };
 * const converted = convertSettingValue(numSetting, '42'); // returns 42
 *
 * const boolSetting: Setting = { type: 'checkbox', ... };
 * const converted2 = convertSettingValue(boolSetting, 'true'); // returns true
 * ```
 */
export function convertSettingValue(setting: Setting, value: string): SettingValue {
  switch (setting.type) {
    case 'checkbox':
      return value === 'true' || value === '1' || value === 'yes';

    case 'number':
      const num = parseFloat(value);
      return Number.isNaN(num) ? 0 : num;

    case 'text':
    case 'textarea':
    case 'email':
    case 'url':
    case 'password':
    case 'select':
    default:
      return value;
  }
}
