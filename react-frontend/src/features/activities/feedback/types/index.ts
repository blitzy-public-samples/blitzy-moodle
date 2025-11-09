/**
 * Barrel export file for Feedback activity type definitions.
 *
 * This file re-exports all type definitions, interfaces, and enums from feedback.types.ts,
 * providing a convenient single import point for consumers throughout the application.
 *
 * @module features/activities/feedback/types
 * @example
 * // Import types from the barrel export
 * import { Feedback, FeedbackItem, FeedbackQuestionType } from '@/features/activities/feedback/types';
 *
 * @see feedback.types.ts - Complete type definitions with documentation
 */

// Re-export all types, interfaces, and enums from feedback.types.ts
export type {
  Feedback,
  FeedbackItem,
  FeedbackCompleted,
  FeedbackValue,
  FeedbackTemplate,
  FeedbackAnalysis,
  FeedbackItemAnalysis,
  FeedbackResponse,
  FeedbackItemPresentation,
  FeedbackStatistics,
  CourseResponseCount,
  GroupResponseCount,
} from './feedback.types';

// Re-export enums
export { FeedbackQuestionType } from './feedback.types';
