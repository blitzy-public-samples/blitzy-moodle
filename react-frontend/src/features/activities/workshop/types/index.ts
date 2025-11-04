/**
 * Barrel export file for workshop activity TypeScript type definitions
 * 
 * This file provides centralized exports of all workshop-related types, interfaces, and enums.
 * It enables clean imports throughout the application using the path alias.
 * 
 * Example usage:
 * ```typescript
 * import { Workshop, WorkshopSubmission, WorkshopPhase } from '@/features/activities/workshop/types';
 * ```
 * 
 * Instead of:
 * ```typescript
 * import { Workshop } from '@/features/activities/workshop/types/workshop.types';
 * ```
 * 
 * This follows TypeScript best practices for module organization and improves code maintainability
 * by providing a single entry point for all workshop type definitions.
 * 
 * Exported types include:
 * - Workshop: Main workshop configuration interface
 * - WorkshopSubmission: Student submission interface
 * - WorkshopAssessment: Peer assessment interface
 * - WorkshopPhase: Enum defining workshop lifecycle phases
 * - WorkshopUserPlan: User-specific workshop task plan
 * - AllocationResult: Result of peer review allocation operation
 * - DimensionGrade: Grade for a specific assessment criterion
 * - WorkshopAssessmentFormData: Form data for assessment submission
 * - And all other workshop-related type definitions
 */

// Export all types from workshop.types.ts
export * from './workshop.types';
