/**
 * Admin Settings Types Barrel Export
 *
 * This barrel file re-exports all TypeScript type definitions from settings.types.ts
 * to enable clean imports throughout the application without deep path references.
 *
 * Instead of:
 *   import { SettingType } from '@/features/admin/settings/types/settings.types';
 *
 * Developers can use:
 *   import { SettingType, BaseSetting, Setting } from '@/features/admin/settings/types';
 *
 * This improves code maintainability by centralizing type exports and making
 * refactoring easier if internal file structure changes.
 *
 * @module features/admin/settings/types
 */

// Re-export all type definitions from settings.types.ts
export * from './settings.types';
