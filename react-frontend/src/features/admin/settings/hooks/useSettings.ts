/**
 * Admin Settings Management Hook
 *
 * Custom React hook for comprehensive admin settings state management that integrates
 * React Query for fetching and updating system settings. Provides TypeScript-safe
 * methods for retrieving settings by section, updating individual settings, batch
 * updating multiple settings, and resetting settings to defaults.
 *
 * This hook serves as the primary interface for admin settings components to interact
 * with the Moodle backend settings API endpoints. It wraps existing Moodle admin
 * functions (admin_get_root(), admin_write_settings()) without duplicating any
 * business logic.
 *
 * Features:
 * - Server state management via React Query with automatic caching
 * - Optimistic updates for responsive UI feedback
 * - Automatic cache invalidation on mutations
 * - Loading states for async operations
 * - Comprehensive error handling with typed errors
 * - Settings grouped by section for organized access
 * - Individual and batch setting updates
 * - Setting reset to default values
 * - Client-side validation before API calls
 *
 * Caching Strategy:
 * - Query key format: ['admin', 'settings', section?]
 * - Stale time: 5 minutes (settings don't change frequently)
 * - Cache time: 10 minutes
 * - Automatic refetch on window focus (disabled for admin settings)
 *
 * Backend Integration:
 * - GET /api/v1/admin/settings - Fetch all or section-specific settings
 * - PUT /api/v1/admin/settings - Update single setting
 * - PUT /api/v1/admin/settings/bulk - Batch update multiple settings
 * - DELETE /api/v1/admin/settings/{name} - Reset setting to default
 *
 * All API endpoints enforce permission checks via require_capability('moodle/site:config')
 * on the backend. React Query provides automatic request deduplication, caching,
 * and background refetching.
 *
 * @example
 * ```tsx
 * function SettingsPage() {
 *   const {
 *     settings,
 *     settingsBySection,
 *     isLoading,
 *     isSaving,
 *     error,
 *     updateSetting,
 *     resetSetting,
 *     clearError
 *   } = useSettings('appearance');
 *
 *   const handleChange = async (name: string, value: SettingValue) => {
 *     await updateSetting(name, value);
 *   };
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorAlert error={error} onDismiss={clearError} />;
 *
 *   return <SettingsForm settings={settings} onChange={handleChange} />;
 * }
 * ```
 *
 * @module features/admin/settings/hooks/useSettings
 */

import { useCallback, useMemo, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import apiClient from '@/services/api/client';
import { useToast } from '@/hooks/useToast';
import type {
  Setting,
  SettingValue,
  SettingUpdate,
  SettingsError,
  SettingsSection,
} from '@/features/admin/settings/types/settings.types';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * API response structure for settings fetch
 */
interface SettingsApiResponse {
  success: boolean;
  data: {
    sections: SettingsSection[];
    settings?: Setting[];
  };
  meta?: {
    timestamp: number;
    version: string;
  };
}

/**
 * API response structure for single setting update
 */
interface UpdateSettingApiResponse {
  success: boolean;
  data: {
    setting: Setting;
  };
  meta?: {
    timestamp: number;
  };
}

/**
 * API response structure for batch settings update
 */
interface BatchUpdateApiResponse {
  success: boolean;
  data: {
    updated: number;
    failed: Array<{
      name: string;
      error: string;
    }>;
  };
  meta?: {
    timestamp: number;
  };
}

/**
 * Interface defining the return type of the useSettings hook
 * Provides comprehensive methods and state for settings management
 */
export interface SettingsHookReturn {
  /** Array of all settings in current section (undefined while loading) */
  settings: Setting[] | undefined;

  /** Settings grouped by section name for organized access */
  settingsBySection: Record<string, Setting[]>;

  /** Loading state for initial settings fetch */
  isLoading: boolean;

  /** Loading state for any save/update operation */
  isSaving: boolean;

  /** Current error state (null if no error) */
  error: SettingsError | null;

  /** Fetch settings for a specific section or all settings */
  fetchSettings: (section?: string) => Promise<Setting[]>;

  /** Fetch all admin settings grouped by section */
  fetchAllSettings: () => Promise<Record<string, Setting[]>>;

  /** Get a single setting by name with optional section filter */
  getSetting: (name: string, section?: string) => Setting | undefined;

  /** Update a single setting value */
  updateSetting: (name: string, value: SettingValue, section?: string) => Promise<void>;

  /** Batch update multiple settings at once */
  updateSettings: (updates: SettingUpdate[]) => Promise<void>;

  /** Reset a setting to its default value */
  resetSetting: (name: string, section?: string) => Promise<void>;

  /** Validate a setting value before submission */
  validateSetting: (name: string, value: SettingValue) => boolean;

  /** Clear the current error state */
  clearError: () => void;
}

/**
 * Options for the useSettings hook
 */
interface UseSettingsOptions {
  /** Initial section to load (optional) */
  section?: string;

  /** Whether to enable automatic background refetching */
  enableRefetchOnWindowFocus?: boolean;
}

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Query key factory for settings queries
 * Ensures consistent key structure across all operations
 */
const settingsQueryKeys = {
  /** Base key for all settings queries */
  all: ['admin', 'settings'] as const,

  /** Key for fetching all settings */
  allSettings: () => [...settingsQueryKeys.all, 'all'] as const,

  /** Key for fetching settings by section */
  section: (section: string) => [...settingsQueryKeys.all, section] as const,
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch settings from the API
 *
 * Calls GET /api/v1/admin/settings endpoint which wraps admin_get_root()
 * and $settingspage->output_html() from Moodle's adminlib.php
 *
 * @param section - Optional section identifier to filter settings
 * @returns Promise resolving to array of settings
 */
async function fetchSettingsApi(section?: string): Promise<Setting[]> {
  const params = section ? { section } : {};
  const response = await apiClient.get<SettingsApiResponse>('/admin/settings', { params });

  if (!response.data.success) {
    throw new Error('Failed to fetch settings');
  }

  // Extract settings from sections structure
  const allSettings: Setting[] = [];
  for (const sectionData of response.data.data.sections) {
    for (const category of sectionData.categories) {
      allSettings.push(...category.settings);
    }
  }

  return allSettings;
}

/**
 * Fetch all settings grouped by section
 *
 * @returns Promise resolving to settings grouped by section name
 */
async function fetchAllSettingsApi(): Promise<Record<string, Setting[]>> {
  const response = await apiClient.get<SettingsApiResponse>('/admin/settings');

  if (!response.data.success) {
    throw new Error('Failed to fetch all settings');
  }

  const groupedSettings: Record<string, Setting[]> = {};
  for (const sectionData of response.data.data.sections) {
    const sectionSettings: Setting[] = [];
    for (const category of sectionData.categories) {
      sectionSettings.push(...category.settings);
    }
    groupedSettings[sectionData.section] = sectionSettings;
  }

  return groupedSettings;
}

/**
 * Update a single setting via API
 *
 * Calls PUT /api/v1/admin/settings which wraps admin_write_settings()
 * from Moodle's adminlib.php
 *
 * @param name - Setting name/identifier
 * @param value - New setting value
 * @param section - Section containing the setting
 * @returns Promise resolving to updated setting
 */
async function updateSettingApi(
  name: string,
  value: SettingValue,
  section: string
): Promise<Setting> {
  const response = await apiClient.put<UpdateSettingApiResponse>('/admin/settings', {
    name,
    value,
    section,
  });

  if (!response.data.success) {
    throw new Error('Failed to update setting');
  }

  return response.data.data.setting;
}

/**
 * Batch update multiple settings via API
 *
 * Calls PUT /api/v1/admin/settings/bulk which processes multiple
 * admin_write_settings() calls in a transaction
 *
 * @param updates - Array of setting updates
 * @returns Promise resolving to batch update result
 */
async function batchUpdateSettingsApi(
  updates: SettingUpdate[]
): Promise<{ updated: number; failed: Array<{ name: string; error: string }> }> {
  const response = await apiClient.put<BatchUpdateApiResponse>('/admin/settings/bulk', {
    settings: updates,
  });

  if (!response.data.success) {
    throw new Error('Failed to batch update settings');
  }

  return response.data.data;
}

/**
 * Reset a setting to its default value via API
 *
 * Calls DELETE /api/v1/admin/settings/{name} which resets the config
 * value to null/default from admin settings definition
 *
 * @param name - Setting name/identifier
 * @returns Promise resolving when reset is complete
 */
async function resetSettingApi(name: string): Promise<void> {
  const response = await apiClient.delete(`/admin/settings/${encodeURIComponent(name)}`);

  if (!response.data.success) {
    throw new Error('Failed to reset setting');
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate a setting value based on its type and constraints
 *
 * Performs client-side validation before sending to the API.
 * Returns true if valid, false otherwise.
 *
 * @param setting - The setting definition to validate against
 * @param value - The value to validate
 * @returns Boolean indicating whether the value is valid
 */
function validateSettingValue(setting: Setting | undefined, value: SettingValue): boolean {
  if (!setting) {
    return false;
  }

  // Check required constraint
  if (setting.required && (value === null || value === undefined || value === '')) {
    return false;
  }

  // Type-specific validation
  switch (setting.type) {
    case 'text':
    case 'textarea':
    case 'password':
      if (typeof value !== 'string') {
        return false;
      }
      // Check maxLength if defined
      const textSetting = setting as { maxLength?: number };
      if (textSetting.maxLength && value.length > textSetting.maxLength) {
        return false;
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return false;
      }
      const numberSetting = setting as { min?: number; max?: number };
      if (numberSetting.min !== undefined && value < numberSetting.min) {
        return false;
      }
      if (numberSetting.max !== undefined && value > numberSetting.max) {
        return false;
      }
      break;

    case 'checkbox':
      if (typeof value !== 'boolean') {
        return false;
      }
      break;

    case 'email':
      if (typeof value !== 'string') {
        return false;
      }
      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value && !emailRegex.test(value)) {
        return false;
      }
      break;

    case 'url':
      if (typeof value !== 'string') {
        return false;
      }
      // Basic URL format validation
      if (value) {
        try {
          new URL(value);
        } catch {
          return false;
        }
      }
      break;

    case 'select':
      if (typeof value !== 'string' && typeof value !== 'number') {
        return false;
      }
      break;

    case 'multicheckbox':
    case 'multiselect':
      if (!Array.isArray(value)) {
        return false;
      }
      break;

    case 'color':
      if (typeof value !== 'string') {
        return false;
      }
      // Basic hex color validation
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (value && !hexColorRegex.test(value)) {
        return false;
      }
      break;

    case 'duration':
      if (
        typeof value !== 'object' ||
        value === null ||
        !('hours' in value) ||
        !('minutes' in value)
      ) {
        return false;
      }
      break;

    case 'time':
      if (typeof value !== 'string') {
        return false;
      }
      // Basic time format validation (HH:MM)
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (value && !timeRegex.test(value)) {
        return false;
      }
      break;

    // Display-only types (heading, description) don't need validation
    case 'heading':
    case 'description':
      return true;

    default:
      // Unknown type - allow by default
      return true;
  }

  return true;
}

/**
 * Create a SettingsError from an error object
 *
 * @param error - The error to convert
 * @returns Structured SettingsError object
 */
function createSettingsError(error: unknown): SettingsError {
  if (error instanceof Error) {
    // Check for specific error types
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('permission') || errorMessage.includes('access denied')) {
      return {
        code: 'PERMISSION_DENIED',
        message: 'You do not have permission to modify these settings',
        details: { originalMessage: error.message },
      };
    }

    if (errorMessage.includes('validation')) {
      return {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: {},
      };
    }

    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to the server. Please check your connection.',
        details: { originalMessage: error.message },
      };
    }

    return {
      code: 'SERVER_ERROR',
      message: error.message,
      details: {},
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    details: { error },
  };
}

// ============================================================================
// Main Hook Implementation
// ============================================================================

/**
 * Custom React hook for admin settings state management
 *
 * Integrates React Query for fetching and updating system settings with
 * comprehensive loading states, error handling, optimistic updates, and
 * cache invalidation. Provides TypeScript-safe methods for all settings
 * operations.
 *
 * @param options - Hook configuration options
 * @returns SettingsHookReturn object with settings data and management methods
 *
 * @example
 * ```tsx
 * // Basic usage with section filter
 * const { settings, isLoading, updateSetting } = useSettings({ section: 'appearance' });
 *
 * // Full usage with all features
 * const {
 *   settings,
 *   settingsBySection,
 *   isLoading,
 *   isSaving,
 *   error,
 *   fetchSettings,
 *   getSetting,
 *   updateSetting,
 *   updateSettings,
 *   resetSetting,
 *   validateSetting,
 *   clearError,
 * } = useSettings();
 * ```
 */
export function useSettings(options: UseSettingsOptions = {}): SettingsHookReturn {
  const { section, enableRefetchOnWindowFocus = false } = options;

  // Get query client for cache manipulation
  const queryClient = useQueryClient();

  // Toast notifications for user feedback
  const toast = useToast();

  // Local error state for mutation errors
  const [mutationError, setMutationError] = useState<SettingsError | null>(null);

  // ============================================================================
  // Query: Fetch Settings
  // ============================================================================

  /**
   * React Query hook for fetching settings
   *
   * Fetches settings for the specified section or all settings if no section.
   * Caches results with 5-minute stale time and 10-minute cache time.
   */
  const settingsQuery: UseQueryResult<Setting[], Error> = useQuery({
    queryKey: section ? settingsQueryKeys.section(section) : settingsQueryKeys.allSettings(),
    queryFn: () => fetchSettingsApi(section),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 2,
    refetchOnWindowFocus: enableRefetchOnWindowFocus,
  });

  // ============================================================================
  // Mutation: Update Single Setting
  // ============================================================================

  /**
   * React Query mutation for updating a single setting
   *
   * Implements optimistic updates:
   * 1. Cache is updated immediately before API call
   * 2. On success: cache is invalidated to refetch fresh data
   * 3. On error: optimistic update is rolled back
   */
  const updateSettingMutation: UseMutationResult<
    Setting,
    Error,
    { name: string; value: SettingValue; section: string }
  > = useMutation({
    mutationFn: ({ name, value, section: sec }) => updateSettingApi(name, value, sec),

    // Optimistic update
    onMutate: async ({ name, value, section: sec }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: settingsQueryKeys.section(sec),
      });

      // Snapshot previous value
      const previousSettings = queryClient.getQueryData<Setting[]>(
        section ? settingsQueryKeys.section(section) : settingsQueryKeys.allSettings()
      );

      // Optimistically update cache
      // Note: Type assertion needed because spreading with new value loses discriminated union narrowing
      queryClient.setQueryData<Setting[]>(
        section ? settingsQueryKeys.section(section) : settingsQueryKeys.allSettings(),
        (old) => {
          if (!old) return old;
          return old.map((s) => (s.name === name ? { ...s, value } : s)) as Setting[];
        }
      );

      return { previousSettings };
    },

    // On error, rollback optimistic update
    onError: (err, _params, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(
          section ? settingsQueryKeys.section(section) : settingsQueryKeys.allSettings(),
          context.previousSettings
        );
      }
      const settingsError = createSettingsError(err);
      setMutationError(settingsError);
      toast.error(`Failed to update setting: ${settingsError.message}`);
    },

    // On success, invalidate and refetch
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: section ? settingsQueryKeys.section(section) : settingsQueryKeys.all,
      });
      toast.success('Setting updated successfully');
      setMutationError(null);
    },
  });

  // ============================================================================
  // Mutation: Batch Update Settings
  // ============================================================================

  /**
   * React Query mutation for batch updating multiple settings
   *
   * Processes all updates in a single transaction on the backend.
   * Optimistically updates all affected settings in the cache.
   */
  const batchUpdateMutation: UseMutationResult<
    { updated: number; failed: Array<{ name: string; error: string }> },
    Error,
    SettingUpdate[]
  > = useMutation({
    mutationFn: (updates) => batchUpdateSettingsApi(updates),

    // Optimistic update for all settings
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: settingsQueryKeys.all,
      });

      // Snapshot previous settings
      const previousSettings = queryClient.getQueryData<Setting[]>(
        section ? settingsQueryKeys.section(section) : settingsQueryKeys.allSettings()
      );

      // Optimistically update all affected settings
      // Note: Type assertion needed because spreading with new value loses discriminated union narrowing
      queryClient.setQueryData<Setting[]>(
        section ? settingsQueryKeys.section(section) : settingsQueryKeys.allSettings(),
        (old) => {
          if (!old) return old;
          return old.map((s) => {
            const update = updates.find((u) => u.name === s.name);
            return update ? { ...s, value: update.value } : s;
          }) as Setting[];
        }
      );

      return { previousSettings };
    },

    // On error, rollback all optimistic updates
    onError: (err, _updates, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(
          section ? settingsQueryKeys.section(section) : settingsQueryKeys.allSettings(),
          context.previousSettings
        );
      }
      const settingsError = createSettingsError(err);
      setMutationError(settingsError);
      toast.error(`Failed to update settings: ${settingsError.message}`);
    },

    // On success, invalidate all affected section caches
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: settingsQueryKeys.all,
      });

      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} setting(s) failed to update`);
      } else {
        toast.success(`${result.updated} setting(s) updated successfully`);
      }
      setMutationError(null);
    },
  });

  // ============================================================================
  // Mutation: Reset Setting
  // ============================================================================

  /**
   * React Query mutation for resetting a setting to default
   *
   * Calls the reset API and invalidates cache to show the default value.
   */
  const resetSettingMutation: UseMutationResult<void, Error, { name: string; section: string }> =
    useMutation({
      mutationFn: ({ name }) => resetSettingApi(name),

      onSuccess: (_data, { section: sec }) => {
        // Invalidate cache to refetch and show default value
        queryClient.invalidateQueries({
          queryKey: sec ? settingsQueryKeys.section(sec) : settingsQueryKeys.all,
        });
        toast.success('Setting reset to default value');
        setMutationError(null);
      },

      onError: (err) => {
        const settingsError = createSettingsError(err);
        setMutationError(settingsError);
        toast.error(`Failed to reset setting: ${settingsError.message}`);
      },
    });

  // ============================================================================
  // Computed Values
  // ============================================================================

  /**
   * Group settings by section name
   *
   * Memoized computation that creates a record mapping section names
   * to arrays of settings within that section.
   */
  const settingsBySection = useMemo<Record<string, Setting[]>>(() => {
    const settings = settingsQuery.data;
    if (!settings) return {};

    const grouped: Record<string, Setting[]> = {};

    for (const setting of settings) {
      // Extract section from setting if available (via dependsOn or other metadata)
      // For now, group by the current section or use 'default'
      const sectionKey = section ?? 'default';
      if (!grouped[sectionKey]) {
        grouped[sectionKey] = [];
      }
      grouped[sectionKey].push(setting);
    }

    return grouped;
  }, [settingsQuery.data, section]);

  // ============================================================================
  // Memoized Callbacks
  // ============================================================================

  /**
   * Fetch settings for a specific section
   *
   * Returns settings array for the given section. If no section is provided,
   * returns all settings.
   */
  const fetchSettings = useCallback(
    async (fetchSection?: string): Promise<Setting[]> => {
      const queryKey = fetchSection
        ? settingsQueryKeys.section(fetchSection)
        : settingsQueryKeys.allSettings();

      const result = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => fetchSettingsApi(fetchSection),
        staleTime: 5 * 60 * 1000,
      });

      return result;
    },
    [queryClient]
  );

  /**
   * Fetch all settings grouped by section
   *
   * Returns a record mapping section names to arrays of settings.
   */
  const fetchAllSettings = useCallback(async (): Promise<Record<string, Setting[]>> => {
    const result = await fetchAllSettingsApi();
    return result;
  }, []);

  /**
   * Get a single setting by name
   *
   * Memoized selector that searches the settings array for a setting
   * with the matching name. Optionally filters by section.
   */
  const getSetting = useCallback(
    (name: string, filterSection?: string): Setting | undefined => {
      const settings = settingsQuery.data;
      if (!settings) return undefined;

      const setting = settings.find((s) => s.name === name);

      // If section filter is provided, verify the setting belongs to that section
      // (This is a basic implementation - actual section matching may need more logic)
      if (filterSection && setting) {
        // Section filtering logic would go here based on your data structure
        return setting;
      }

      return setting;
    },
    [settingsQuery.data]
  );

  /**
   * Update a single setting value
   *
   * Validates the value before sending to API. Shows toast notifications
   * on success or failure.
   */
  const updateSetting = useCallback(
    async (name: string, value: SettingValue, updateSection?: string): Promise<void> => {
      const settingSection = updateSection ?? section ?? 'default';

      // Get the setting for validation
      const setting = settingsQuery.data?.find((s) => s.name === name);

      // Validate before sending
      if (setting && !validateSettingValue(setting, value)) {
        const error: SettingsError = {
          code: 'VALIDATION_ERROR',
          message: `Invalid value for setting "${name}"`,
          details: { name, value },
        };
        setMutationError(error);
        toast.error(error.message);
        return;
      }

      await updateSettingMutation.mutateAsync({
        name,
        value,
        section: settingSection,
      });
    },
    [section, settingsQuery.data, updateSettingMutation, toast]
  );

  /**
   * Batch update multiple settings
   *
   * Updates all provided settings in a single transaction.
   * Validates all values before sending to API.
   */
  const updateSettings = useCallback(
    async (updates: SettingUpdate[]): Promise<void> => {
      // Validate all updates before sending
      for (const update of updates) {
        const setting = settingsQuery.data?.find((s) => s.name === update.name);
        if (setting && !validateSettingValue(setting, update.value)) {
          const error: SettingsError = {
            code: 'VALIDATION_ERROR',
            message: `Invalid value for setting "${update.name}"`,
            details: { name: update.name, value: update.value },
          };
          setMutationError(error);
          toast.error(error.message);
          return;
        }
      }

      await batchUpdateMutation.mutateAsync(updates);
    },
    [settingsQuery.data, batchUpdateMutation, toast]
  );

  /**
   * Reset a setting to its default value
   *
   * Calls the reset API and refreshes the settings cache.
   */
  const resetSetting = useCallback(
    async (name: string, resetSection?: string): Promise<void> => {
      const settingSection = resetSection ?? section ?? 'default';

      await resetSettingMutation.mutateAsync({
        name,
        section: settingSection,
      });
    },
    [section, resetSettingMutation]
  );

  /**
   * Validate a setting value
   *
   * Performs client-side validation against the setting's constraints.
   * Returns true if valid, false otherwise.
   */
  const validateSetting = useCallback(
    (name: string, value: SettingValue): boolean => {
      const setting = settingsQuery.data?.find((s) => s.name === name);
      return validateSettingValue(setting, value);
    },
    [settingsQuery.data]
  );

  /**
   * Clear the current error state
   *
   * Resets both query and mutation errors.
   */
  const clearError = useCallback((): void => {
    setMutationError(null);
  }, []);

  // ============================================================================
  // Return Value
  // ============================================================================

  // Combine query and mutation loading states
  const isSaving =
    updateSettingMutation.isPending ||
    batchUpdateMutation.isPending ||
    resetSettingMutation.isPending;

  // Combine query and mutation errors
  const error: SettingsError | null =
    mutationError ?? (settingsQuery.error ? createSettingsError(settingsQuery.error) : null);

  return {
    settings: settingsQuery.data,
    settingsBySection,
    isLoading: settingsQuery.isLoading,
    isSaving,
    error,
    fetchSettings,
    fetchAllSettings,
    getSetting,
    updateSetting,
    updateSettings,
    resetSetting,
    validateSetting,
    clearError,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default useSettings;
