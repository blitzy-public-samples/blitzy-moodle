/**
 * Barrel Export for Database Activity Type Definitions
 *
 * This file serves as the central export point for all TypeScript type definitions
 * related to the Moodle Database activity module. It re-exports all types from
 * data.types.ts to enable convenient importing throughout the React frontend application.
 *
 * Usage Example:
 * ```typescript
 * import {
 *   Database,
 *   DatabaseRecord,
 *   DatabaseField,
 *   FieldContent,
 *   SearchCriteria,
 *   FieldType,
 *   TemplateType
 * } from '@/features/activities/data/types';
 * ```
 *
 * This follows React/TypeScript best practices by:
 * - Providing a single import point for all Database activity types
 * - Abstracting internal file structure from consumers
 * - Enabling easier refactoring of internal organization
 * - Reducing import statement complexity
 *
 * @module features/activities/data/types
 */

// ============================================================================
// Re-export All Database Activity Types
// ============================================================================

// Enumerations
export { FieldType, TemplateType } from './data.types';

// Field Type Interfaces
export type {
  TextField,
  TextAreaField,
  NumberField,
  DateField,
  CheckboxField,
  MenuField,
  MultiMenuField,
  RadioButtonField,
  FileField,
  PictureField,
  URLField,
  LatLongField,
} from './data.types';

// Discriminated Union Type
export type { DatabaseField } from './data.types';

// Core Database Interfaces
export type { Database, DatabaseRecord, FieldContent } from './data.types';

// Search and Response Interfaces
export type { SearchCriteria, DatabaseRecordsResponse } from './data.types';

// Permission Interfaces
export type { DatabasePermissions } from './data.types';
