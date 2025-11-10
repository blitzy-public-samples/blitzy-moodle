/**
 * Barrel Export File for Admin Course Management Type Definitions
 *
 * This file serves as a central export point for all TypeScript type definitions
 * related to admin course management. It re-exports types from individual type
 * definition files to provide convenient single-import access throughout the
 * application.
 *
 * Benefits of this barrel export pattern:
 * - Simplifies imports: `import { Course, CourseCategory } from '@/features/admin/courses/types'`
 * - Enables tree-shaking: Only imported types are included in final bundle
 * - Maintains type organization: Related types grouped in separate files
 * - Improves maintainability: Single import path for all course management types
 *
 * @module features/admin/courses/types
 * @see react-frontend/src/features/admin/courses/types/course.types.ts
 * @see react-frontend/src/features/admin/courses/types/category.types.ts
 * @see react-frontend/src/features/admin/courses/types/filters.types.ts
 * @see react-frontend/src/features/admin/courses/types/forms.types.ts
 * @see react-frontend/src/features/admin/courses/types/bulk.types.ts
 * @see react-frontend/src/features/admin/courses/types/state.types.ts
 *
 * @example
 * // Import multiple types with single import statement
 * import {
 *   Course,
 *   CourseCategory,
 *   CourseFilters,
 *   CourseFormData,
 *   BulkCourseAction
 * } from '@/features/admin/courses/types';
 *
 * @example
 * // Tree-shaking ensures only used types are bundled
 * import { Course } from '@/features/admin/courses/types'; // Only Course type in bundle
 */

// ============================================================================
// Course Entity Types
// ============================================================================
// Re-export all course-related type definitions including the main Course
// interface, course format types, visibility options, group modes, enrollment
// methods, and API request/response types for course CRUD operations.

export type {
  Course,
  CourseFormat,
  EnrolmentMethod,
  CourseTag,
  CourseCreateRequest,
  CourseUpdateRequest,
  CoursePaginatedResponse,
} from './course.types';

export {
  CourseVisibility,
  GroupMode,
  DownloadContentOption,
  TextFormat,
  LegacyFilesOption,
} from './course.types';

// ============================================================================
// Course Category Types
// ============================================================================
// Re-export all category-related type definitions including the main
// CourseCategory interface, category tree structure, and category CRUD
// operation types for hierarchical course organization.

export type {
  CourseCategory,
  CourseCategoryCreateInput,
  CourseCategoryUpdateInput,
  CourseCategoryTreeNode,
  CourseCategoryFilterOptions,
  CourseCategorySortField,
} from './category.types';

// Note: SortOrder is re-exported from filters.types.ts to avoid duplicate exports
// as it's defined in both category.types.ts and filters.types.ts with identical values

// ============================================================================
// Course Filtering and Sorting Types
// ============================================================================
// Re-export comprehensive filtering and sorting type definitions for course
// listings, including search criteria, date ranges, visibility filters, and
// pagination parameters.

export type {
  CourseFilters,
  CourseSortField,
  SortOrder,
} from './filters.types';

// ============================================================================
// Form Data Types
// ============================================================================
// Re-export form-related type definitions for course and category creation/edit
// forms, including validation interfaces and editor content structures.

export type {
  CourseFormData,
  CategoryFormData,
  EditorContent,
  CourseFormValidation,
  CategoryFormValidation,
} from './forms.types';

export {
  DownloadContent,
} from './forms.types';

// Note: TextFormat is already re-exported from course.types.ts to avoid duplicate exports

// ============================================================================
// Bulk Operation Types
// ============================================================================
// Re-export bulk action type definitions for performing operations on multiple
// courses simultaneously, including action types, parameters, results, and
// error handling structures.

export type {
  BulkActionParameters,
  BulkActionResult,
  BulkActionError,
  BulkCourseAction,
} from './bulk.types';

export {
  BulkActionType,
} from './bulk.types';

// ============================================================================
// Redux State Management Types
// ============================================================================
// Re-export Redux state type definitions for admin course management feature,
// including the main state interface, view modes, pagination metadata, and
// error tracking structures.

export type {
  CourseManagementState,
  ViewMode,
  PaginationMetadata,
  CourseManagementError,
} from './state.types';

// ============================================================================
// Type Re-export Summary
// ============================================================================
// This barrel file provides unified access to all course management types:
//
// From course.types.ts:
// - Course, CourseFormat, CourseVisibility, GroupMode, DownloadContentOption,
//   TextFormat, LegacyFilesOption, EnrolmentMethod, CourseTag,
//   CourseCreateRequest, CourseUpdateRequest, CoursePaginatedResponse
//
// From category.types.ts:
// - CourseCategory, CourseCategoryCreateInput, CourseCategoryUpdateInput,
//   CourseCategoryTreeNode, CourseCategoryFilterOptions, CourseCategorySortField
//
// From filters.types.ts:
// - CourseFilters, CourseSortField, SortOrder
//
// From forms.types.ts:
// - CourseFormData, CategoryFormData, EditorContent, DownloadContent,
//   CourseFormValidation, CategoryFormValidation
//
// From bulk.types.ts:
// - BulkActionType, BulkActionParameters, BulkActionResult, BulkActionError,
//   BulkCourseAction
//
// From state.types.ts:
// - CourseManagementState, ViewMode, PaginationMetadata, CourseManagementError
//
// Usage throughout the application:
// Components, hooks, and services can import any of these types using a single
// import statement, improving code readability and maintainability while
// supporting optimal bundle sizes through tree-shaking.
