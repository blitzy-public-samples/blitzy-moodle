/**
 * Admin Settings Hooks - Barrel Export
 *
 * This barrel export file provides clean, consistent imports for all admin settings
 * hooks used throughout the application. Instead of deep import paths like:
 *
 * ```typescript
 * import { useSettings } from '@/features/admin/settings/hooks/useSettings';
 * ```
 *
 * Developers can use the cleaner import syntax:
 *
 * ```typescript
 * import { useSettings } from '@/features/admin/settings/hooks';
 * ```
 *
 * This pattern follows React/TypeScript best practices for module organization
 * and provides several benefits:
 *
 * 1. **Cleaner imports**: Shorter, more readable import statements
 * 2. **Encapsulation**: Internal file structure can change without affecting consumers
 * 3. **Discoverability**: IDE autocomplete shows available exports from directory
 * 4. **Consistency**: Unified pattern across all feature modules
 *
 * Exported Hooks:
 * - `useSettings`: Custom hook for admin settings state management with React Query
 *
 * Exported Types:
 * - `SettingsHookReturn`: Return type interface for useSettings hook
 *
 * @module features/admin/settings/hooks
 *
 * @example
 * ```tsx
 * import { useSettings, type SettingsHookReturn } from '@/features/admin/settings/hooks';
 *
 * function AdminSettingsPage() {
 *   const {
 *     settings,
 *     settingsBySection,
 *     isLoading,
 *     isSaving,
 *     error,
 *     updateSetting,
 *     resetSetting,
 *     clearError,
 *   } = useSettings({ section: 'appearance' });
 *
 *   // Component implementation...
 * }
 * ```
 */

// =============================================================================
// Hook Exports
// =============================================================================

/**
 * Re-export useSettings hook as both named and default export
 *
 * The useSettings hook provides comprehensive admin settings state management
 * using React Query for fetching and updating system settings. It includes:
 * - Server state management with automatic caching
 * - Optimistic updates for responsive UI
 * - Automatic cache invalidation on mutations
 * - Loading states for async operations
 * - Comprehensive error handling
 *
 * @see {@link useSettings} for detailed documentation and usage examples
 */
export { default as useSettings } from './useSettings';

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Re-export type definitions from useSettings module
 *
 * The SettingsHookReturn interface defines the complete return type of the
 * useSettings hook, including all state values, loading indicators, and
 * methods for managing admin settings.
 */
export type { SettingsHookReturn } from './useSettings';
