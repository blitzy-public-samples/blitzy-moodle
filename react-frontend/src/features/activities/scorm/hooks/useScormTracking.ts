/**
 * SCORM Tracking Data Management Hook
 *
 * Custom React Query hook for handling SCORM tracking data submission,
 * CMI data model interactions, and learner progress updates.
 *
 * Features:
 * - Submits SCORM tracking data (CMI elements) to the backend API
 * - Supports both SCORM 1.2 and SCORM 2004 data model standards
 * - Validates CMI element names and values before submission
 * - Provides optimistic updates for immediate UI feedback
 * - Automatically invalidates SCORM queries after successful mutations
 * - Handles SCORM 2004 sequencing navigation requests
 * - Provides utility functions for time formatting and validation
 *
 * SCORM 1.2 CMI Elements Supported:
 * - cmi.core.lesson_status (passed, completed, failed, incomplete, browsed, not attempted)
 * - cmi.core.score.raw, cmi.core.score.min, cmi.core.score.max
 * - cmi.core.session_time (HHH:MM:SS.SS format)
 * - cmi.core.total_time (accumulated time)
 * - cmi.suspend_data (learner progress data)
 * - cmi.core.exit (suspend, logout, time-out, empty)
 * - cmi.interactions.* (learner interactions)
 *
 * SCORM 2004 CMI Elements Supported:
 * - cmi.completion_status (completed, incomplete, not attempted, unknown)
 * - cmi.success_status (passed, failed, unknown)
 * - cmi.score.scaled, cmi.score.raw, cmi.score.min, cmi.score.max
 * - cmi.session_time (ISO 8601 duration format PT#H#M#S)
 * - cmi.total_time
 * - cmi.exit (suspend, logout, normal, time-out, empty)
 * - cmi.progress_measure (0.0 to 1.0)
 * - adl.nav.request (sequencing navigation requests)
 *
 * Maps to backend API endpoints that wrap existing Moodle SCORM functions:
 * - POST /api/v1/scorm/{id}/track - scorm_insert_track() from locallib.php
 * - insert_scorm_tracks() from classes/external.php
 *
 * @module features/activities/scorm/hooks/useScormTracking
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitTracking } from '../api/scormApi';
import { scormQueryKeys } from './useScorm';
import type { SaveTrackingRequest } from '../types/scorm.types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Individual SCORM tracking element (CMI data model element)
 * Represents a single key-value pair in the SCORM data model
 */
export interface ScormTrackingElement {
  /** CMI element name (e.g., "cmi.core.lesson_status", "cmi.score.raw") */
  element: string;
  /** Element value as string (SCORM spec requires string values) */
  value: string;
  /** Timestamp of last modification (Unix timestamp) */
  timemodified?: number;
}

/**
 * Batch tracking data payload for API submission
 * Contains multiple tracking elements for a specific SCO and attempt
 */
export interface ScormTrackingPayload {
  /** SCO (Shareable Content Object) ID */
  scoid: number;
  /** Attempt number (1-based) */
  attempt: number;
  /** Array of tracking elements to save */
  tracks: ScormTrackingElement[];
}

/**
 * Parameters for the saveTracking mutation
 */
export interface SaveTrackingParams {
  /** SCORM module ID */
  scormId: number;
  /** SCO ID */
  scoid: number;
  /** Attempt number */
  attempt: number;
  /** Tracking elements to save */
  tracks: ScormTrackingElement[];
}

/**
 * SCORM 1.2 lesson status values
 */
export type Scorm12LessonStatus =
  | 'passed'
  | 'completed'
  | 'failed'
  | 'incomplete'
  | 'browsed'
  | 'not attempted';

/**
 * SCORM 2004 completion status values
 */
export type Scorm2004CompletionStatus =
  | 'completed'
  | 'incomplete'
  | 'not attempted'
  | 'unknown';

/**
 * SCORM 2004 success status values
 */
export type Scorm2004SuccessStatus = 'passed' | 'failed' | 'unknown';

/**
 * SCORM exit values (both 1.2 and 2004)
 */
export type ScormExitValue =
  | 'suspend'
  | 'logout'
  | 'time-out'
  | 'normal'
  | '';

/**
 * SCORM 2004 navigation request values
 */
export type ScormNavigationRequestValue =
  | 'continue'
  | 'previous'
  | 'exit'
  | 'exitAll'
  | 'abandon'
  | 'abandonAll'
  | 'suspendAll'
  | `{target=${string}}choice`;

/**
 * CMI element validation result
 */
export interface CMIValidationResult {
  /** Whether the element is valid */
  isValid: boolean;
  /** Error message if invalid */
  errorMessage?: string;
  /** Normalized value if valid */
  normalizedValue?: string;
}

/**
 * Return type for useScormTracking hook
 */
export interface UseScormTrackingReturn {
  /** Function to save tracking data */
  saveTracking: (params: SaveTrackingParams) => void;
  /** Function to save tracking data and return a promise */
  saveTrackingAsync: (params: SaveTrackingParams) => Promise<{ success: boolean; message: string }>;
  /** Whether a save operation is in progress */
  savingTracking: boolean;
  /** Error from the last mutation attempt */
  error: Error | null;
  /** Reset the mutation state */
  reset: () => void;
  /** Whether the last mutation was successful */
  isSuccess: boolean;
}

// ============================================================================
// CMI ELEMENT VALIDATION PATTERNS
// ============================================================================

/**
 * Valid SCORM 1.2 CMI element patterns
 * Based on SCORM 1.2 Runtime Environment specification
 */
const SCORM_12_ELEMENTS: ReadonlySet<string> = new Set([
  'cmi.core.student_id',
  'cmi.core.student_name',
  'cmi.core.lesson_location',
  'cmi.core.credit',
  'cmi.core.lesson_status',
  'cmi.core.entry',
  'cmi.core.score.raw',
  'cmi.core.score.min',
  'cmi.core.score.max',
  'cmi.core.total_time',
  'cmi.core.lesson_mode',
  'cmi.core.exit',
  'cmi.core.session_time',
  'cmi.suspend_data',
  'cmi.launch_data',
  'cmi.comments',
  'cmi.comments_from_lms',
]);

/**
 * SCORM 1.2 elements that support array indexing (interactions, objectives)
 */
const SCORM_12_INDEXED_PREFIXES: ReadonlyArray<string> = [
  'cmi.objectives.',
  'cmi.interactions.',
  'cmi.student_data.',
];

/**
 * Valid SCORM 2004 CMI element patterns
 * Based on SCORM 2004 4th Edition Runtime Environment specification
 */
const SCORM_2004_ELEMENTS: ReadonlySet<string> = new Set([
  'cmi._version',
  'cmi.comments_from_learner._children',
  'cmi.comments_from_learner._count',
  'cmi.comments_from_lms._children',
  'cmi.comments_from_lms._count',
  'cmi.completion_status',
  'cmi.completion_threshold',
  'cmi.credit',
  'cmi.entry',
  'cmi.exit',
  'cmi.interactions._children',
  'cmi.interactions._count',
  'cmi.launch_data',
  'cmi.learner_id',
  'cmi.learner_name',
  'cmi.learner_preference._children',
  'cmi.learner_preference.audio_level',
  'cmi.learner_preference.language',
  'cmi.learner_preference.delivery_speed',
  'cmi.learner_preference.audio_captioning',
  'cmi.location',
  'cmi.max_time_allowed',
  'cmi.mode',
  'cmi.objectives._children',
  'cmi.objectives._count',
  'cmi.progress_measure',
  'cmi.scaled_passing_score',
  'cmi.score._children',
  'cmi.score.scaled',
  'cmi.score.raw',
  'cmi.score.min',
  'cmi.score.max',
  'cmi.session_time',
  'cmi.success_status',
  'cmi.suspend_data',
  'cmi.time_limit_action',
  'cmi.total_time',
]);

/**
 * SCORM 2004 elements that support array indexing
 */
const SCORM_2004_INDEXED_PREFIXES: ReadonlyArray<string> = [
  'cmi.comments_from_learner.',
  'cmi.comments_from_lms.',
  'cmi.interactions.',
  'cmi.objectives.',
];

/**
 * ADL navigation request element (SCORM 2004 only)
 */
const ADL_NAV_ELEMENT = 'adl.nav.request';

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate a SCORM 1.2 lesson status value
 */
function isValidScorm12LessonStatus(value: string): value is Scorm12LessonStatus {
  return [
    'passed',
    'completed',
    'failed',
    'incomplete',
    'browsed',
    'not attempted',
  ].includes(value);
}

/**
 * Validate a SCORM 2004 completion status value
 */
function isValidScorm2004CompletionStatus(
  value: string
): value is Scorm2004CompletionStatus {
  return ['completed', 'incomplete', 'not attempted', 'unknown'].includes(value);
}

/**
 * Validate a SCORM 2004 success status value
 */
function isValidScorm2004SuccessStatus(
  value: string
): value is Scorm2004SuccessStatus {
  return ['passed', 'failed', 'unknown'].includes(value);
}

/**
 * Validate an exit value (both SCORM 1.2 and 2004)
 */
function isValidExitValue(value: string): value is ScormExitValue {
  return ['suspend', 'logout', 'time-out', 'normal', ''].includes(value);
}

/**
 * Validate a SCORM 2004 navigation request value
 */
function isValidNavigationRequest(
  value: string
): value is ScormNavigationRequestValue {
  // Check direct values
  if (
    [
      'continue',
      'previous',
      'exit',
      'exitAll',
      'abandon',
      'abandonAll',
      'suspendAll',
    ].includes(value)
  ) {
    return true;
  }
  // Check choice pattern: {target=<identifier>}choice
  const choicePattern = /^\{target=[\w.-]+\}choice$/;
  return choicePattern.test(value);
}

/**
 * Validate a score value (should be a valid number within bounds)
 */
function isValidScoreValue(value: string, isScaled = false): boolean {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return false;
  }
  
  if (isScaled) {
    // Scaled score must be between -1 and 1
    return num >= -1 && num <= 1;
  }
  
  // Raw scores are typically 0-100 but can vary
  return true;
}

/**
 * Validate a progress measure value (0.0 to 1.0)
 */
function isValidProgressMeasure(value: string): boolean {
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0 && num <= 1;
}

/**
 * Check if an element name matches SCORM 1.2 indexed pattern
 * e.g., cmi.interactions.0.id, cmi.objectives.1.score.raw
 */
function isScorm12IndexedElement(element: string): boolean {
  return SCORM_12_INDEXED_PREFIXES.some(
    (prefix) => element.startsWith(prefix) && /\.\d+\./.test(element)
  );
}

/**
 * Check if an element name matches SCORM 2004 indexed pattern
 */
function isScorm2004IndexedElement(element: string): boolean {
  return SCORM_2004_INDEXED_PREFIXES.some(
    (prefix) => element.startsWith(prefix) && /\.\d+\./.test(element)
  );
}

/**
 * Validates a CMI element name and value according to SCORM specifications
 *
 * Performs validation for both SCORM 1.2 and SCORM 2004 data model elements:
 * - Verifies the element name is a valid CMI element
 * - Validates the value against element-specific constraints
 * - Handles indexed elements (arrays like interactions and objectives)
 * - Validates ADL navigation requests for SCORM 2004
 *
 * @param element - The CMI element name (e.g., "cmi.core.lesson_status")
 * @param value - The value to set for the element
 * @returns Validation result with isValid flag and optional error message
 *
 * @example
 * ```typescript
 * // Valid SCORM 1.2 element
 * const result = validateCMIElement('cmi.core.lesson_status', 'completed');
 * // { isValid: true, normalizedValue: 'completed' }
 *
 * // Invalid value
 * const result = validateCMIElement('cmi.score.scaled', '2.0');
 * // { isValid: false, errorMessage: 'Scaled score must be between -1 and 1' }
 * ```
 */
export function validateCMIElement(
  element: string,
  value: string
): CMIValidationResult {
  // Empty element name is invalid
  if (!element || element.trim() === '') {
    return {
      isValid: false,
      errorMessage: 'Element name cannot be empty',
    };
  }

  const trimmedElement = element.trim();
  const trimmedValue = value.trim();

  // Handle ADL navigation request (SCORM 2004)
  if (trimmedElement === ADL_NAV_ELEMENT || trimmedElement.startsWith('adl.nav.')) {
    if (!isValidNavigationRequest(trimmedValue)) {
      return {
        isValid: false,
        errorMessage: `Invalid navigation request: ${trimmedValue}. Valid values are: continue, previous, exit, exitAll, abandon, abandonAll, suspendAll, or {target=<id>}choice`,
      };
    }
    return { isValid: true, normalizedValue: trimmedValue };
  }

  // Validate element name is a valid CMI element
  const isValidScorm12 =
    SCORM_12_ELEMENTS.has(trimmedElement) ||
    isScorm12IndexedElement(trimmedElement);
  const isValidScorm2004 =
    SCORM_2004_ELEMENTS.has(trimmedElement) ||
    isScorm2004IndexedElement(trimmedElement);

  if (!isValidScorm12 && !isValidScorm2004) {
    // Allow unknown elements for forward compatibility but log warning
    console.warn(`Unknown CMI element: ${trimmedElement}`);
    return { isValid: true, normalizedValue: trimmedValue };
  }

  // Element-specific value validation
  // SCORM 1.2 lesson status
  if (trimmedElement === 'cmi.core.lesson_status') {
    if (!isValidScorm12LessonStatus(trimmedValue)) {
      return {
        isValid: false,
        errorMessage: `Invalid lesson status: ${trimmedValue}. Valid values are: passed, completed, failed, incomplete, browsed, not attempted`,
      };
    }
  }

  // SCORM 2004 completion status
  if (trimmedElement === 'cmi.completion_status') {
    if (!isValidScorm2004CompletionStatus(trimmedValue)) {
      return {
        isValid: false,
        errorMessage: `Invalid completion status: ${trimmedValue}. Valid values are: completed, incomplete, not attempted, unknown`,
      };
    }
  }

  // SCORM 2004 success status
  if (trimmedElement === 'cmi.success_status') {
    if (!isValidScorm2004SuccessStatus(trimmedValue)) {
      return {
        isValid: false,
        errorMessage: `Invalid success status: ${trimmedValue}. Valid values are: passed, failed, unknown`,
      };
    }
  }

  // Exit value (both versions)
  if (trimmedElement === 'cmi.core.exit' || trimmedElement === 'cmi.exit') {
    if (!isValidExitValue(trimmedValue)) {
      return {
        isValid: false,
        errorMessage: `Invalid exit value: ${trimmedValue}. Valid values are: suspend, logout, time-out, normal, or empty string`,
      };
    }
  }

  // Scaled score (SCORM 2004)
  if (trimmedElement === 'cmi.score.scaled') {
    if (!isValidScoreValue(trimmedValue, true)) {
      return {
        isValid: false,
        errorMessage: 'Scaled score must be a number between -1 and 1',
      };
    }
  }

  // Progress measure (SCORM 2004)
  if (trimmedElement === 'cmi.progress_measure') {
    if (!isValidProgressMeasure(trimmedValue)) {
      return {
        isValid: false,
        errorMessage: 'Progress measure must be a number between 0 and 1',
      };
    }
  }

  // Score values (both versions)
  if (
    trimmedElement.includes('score.raw') ||
    trimmedElement.includes('score.min') ||
    trimmedElement.includes('score.max')
  ) {
    if (!isValidScoreValue(trimmedValue)) {
      return {
        isValid: false,
        errorMessage: 'Score must be a valid number',
      };
    }
  }

  return { isValid: true, normalizedValue: trimmedValue };
}

// ============================================================================
// TIME FORMATTING UTILITIES
// ============================================================================

/**
 * Formats elapsed time in milliseconds to SCORM time format
 *
 * Supports both SCORM 1.2 and SCORM 2004 time formats:
 * - SCORM 1.2: CMITimespan format (HHHH:MM:SS.SS)
 *   Example: "0001:23:45.67" for 1 hour, 23 minutes, 45.67 seconds
 * - SCORM 2004: ISO 8601 duration format (PT#H#M#S)
 *   Example: "PT1H23M45.67S" for 1 hour, 23 minutes, 45.67 seconds
 *
 * @param milliseconds - Elapsed time in milliseconds
 * @param scormVersion - SCORM version ('1.2' or '2004')
 * @returns Formatted time string according to SCORM specification
 *
 * @example
 * ```typescript
 * // Format for SCORM 1.2
 * formatSessionTime(5025670, '1.2');
 * // Returns: "0001:23:45.67"
 *
 * // Format for SCORM 2004
 * formatSessionTime(5025670, '2004');
 * // Returns: "PT1H23M45.67S"
 * ```
 */
export function formatSessionTime(
  milliseconds: number,
  scormVersion: '1.2' | '2004' = '2004'
): string {
  if (milliseconds < 0) {
    milliseconds = 0;
  }

  const totalSeconds = milliseconds / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (scormVersion === '1.2') {
    // SCORM 1.2: CMITimespan format (HHHH:MM:SS.SS)
    // Hours can be up to 4 digits, zero-padded
    const hoursStr = hours.toString().padStart(4, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    // Seconds with 2 decimal places
    const secondsStr = seconds.toFixed(2).padStart(5, '0');
    return `${hoursStr}:${minutesStr}:${secondsStr}`;
  }

  // SCORM 2004: ISO 8601 duration format (PT#H#M#S)
  let duration = 'PT';

  if (hours > 0) {
    duration += `${hours}H`;
  }

  if (minutes > 0) {
    duration += `${minutes}M`;
  }

  // Always include seconds, even if 0
  // Use toFixed(2) for precision, remove trailing zeros
  const secondsFormatted = seconds.toFixed(2).replace(/\.?0+$/, '');
  duration += `${secondsFormatted}S`;

  return duration;
}

/**
 * Parses a SCORM time string back to milliseconds
 *
 * Supports both SCORM 1.2 and SCORM 2004 time formats:
 * - SCORM 1.2: HHHH:MM:SS.SS or HH:MM:SS.SS
 * - SCORM 2004: ISO 8601 duration (PT#H#M#S or P#Y#M#DT#H#M#S)
 *
 * @param timeString - SCORM formatted time string
 * @returns Time in milliseconds, or 0 if invalid format
 */
export function parseScormTime(timeString: string): number {
  if (!timeString) {
    return 0;
  }

  // Try SCORM 1.2 format (HHHH:MM:SS.SS)
  const scorm12Match = timeString.match(
    /^(\d{2,4}):(\d{2}):(\d{2}(?:\.\d{1,2})?)$/
  );
  if (scorm12Match) {
    const hours = parseInt(scorm12Match[1] ?? '0', 10);
    const minutes = parseInt(scorm12Match[2] ?? '0', 10);
    const seconds = parseFloat(scorm12Match[3] ?? '0');
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  // Try SCORM 2004 ISO 8601 duration format
  const iso8601Match = timeString.match(
    /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
  );
  if (iso8601Match) {
    const years = parseInt(iso8601Match[1] ?? '0', 10);
    const months = parseInt(iso8601Match[2] ?? '0', 10);
    const days = parseInt(iso8601Match[3] ?? '0', 10);
    const hours = parseInt(iso8601Match[4] ?? '0', 10);
    const minutes = parseInt(iso8601Match[5] ?? '0', 10);
    const seconds = parseFloat(iso8601Match[6] ?? '0');

    // Approximate conversion (assumes 30 days/month, 365 days/year)
    const totalSeconds =
      years * 365 * 24 * 3600 +
      months * 30 * 24 * 3600 +
      days * 24 * 3600 +
      hours * 3600 +
      minutes * 60 +
      seconds;

    return totalSeconds * 1000;
  }

  return 0;
}

/**
 * Adds two SCORM time strings together
 *
 * Useful for calculating total_time from session_time values.
 *
 * @param time1 - First time string
 * @param time2 - Second time string
 * @param scormVersion - Output format version
 * @returns Combined time in SCORM format
 */
export function addScormTimes(
  time1: string,
  time2: string,
  scormVersion: '1.2' | '2004' = '2004'
): string {
  const ms1 = parseScormTime(time1);
  const ms2 = parseScormTime(time2);
  return formatSessionTime(ms1 + ms2, scormVersion);
}

// ============================================================================
// MAIN HOOK IMPLEMENTATION
// ============================================================================

/**
 * Custom React hook for managing SCORM tracking data submission
 *
 * Provides mutation functionality for saving SCORM tracking data (CMI elements)
 * to the backend API. Supports both SCORM 1.2 and SCORM 2004 data models with
 * validation, optimistic updates, and automatic cache invalidation.
 *
 * Features:
 * - Validates CMI element names and values before submission
 * - Provides both sync (fire-and-forget) and async mutation methods
 * - Implements optimistic updates for immediate UI feedback
 * - Automatically invalidates relevant SCORM queries on success
 * - Comprehensive error handling with user-friendly messages
 * - Supports batch submission of multiple tracking elements
 *
 * @returns Object containing mutation function and state
 *
 * @example
 * ```typescript
 * const { saveTracking, savingTracking, error, reset } = useScormTracking();
 *
 * // Save a single tracking element
 * saveTracking({
 *   scormId: 123,
 *   scoid: 456,
 *   attempt: 1,
 *   tracks: [{ element: 'cmi.core.lesson_status', value: 'completed' }]
 * });
 *
 * // Save multiple elements at once
 * saveTracking({
 *   scormId: 123,
 *   scoid: 456,
 *   attempt: 1,
 *   tracks: [
 *     { element: 'cmi.completion_status', value: 'completed' },
 *     { element: 'cmi.success_status', value: 'passed' },
 *     { element: 'cmi.score.scaled', value: '0.85' },
 *     { element: 'cmi.session_time', value: 'PT1H23M45S' }
 *   ]
 * });
 * ```
 */
export default function useScormTracking(): UseScormTrackingReturn {
  const queryClient = useQueryClient();

  /**
   * Mutation for saving SCORM tracking data
   */
  const mutation = useMutation({
    /**
     * Mutation function that validates and submits tracking data
     */
    mutationFn: async (params: SaveTrackingParams) => {
      const { scormId, scoid, attempt, tracks } = params;

      // Validate all tracking elements before submission
      const validationErrors: string[] = [];
      const validatedTracks: Record<string, string | number | boolean> = {};

      for (const track of tracks) {
        const validationResult = validateCMIElement(track.element, track.value);

        if (!validationResult.isValid) {
          validationErrors.push(
            `${track.element}: ${validationResult.errorMessage}`
          );
        } else {
          // Use normalized value if available
          validatedTracks[track.element] =
            validationResult.normalizedValue ?? track.value;
        }
      }

      // If there are validation errors, throw aggregated error
      if (validationErrors.length > 0) {
        throw new Error(
          `Validation failed for CMI elements:\n${validationErrors.join('\n')}`
        );
      }

      // Prepare tracking data payload matching SaveTrackingRequest interface
      const trackingData: SaveTrackingRequest = {
        scormId,
        scoId: scoid,
        attempt,
        tracks: validatedTracks,
      };

      // Submit to API
      return submitTracking(scormId, trackingData);
    },

    /**
     * Optimistic update: Update cache immediately before API response
     * This provides instant feedback to the user
     */
    onMutate: async (params: SaveTrackingParams) => {
      const { scormId, scoid: _scoid, attempt, tracks } = params;

      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: scormQueryKeys.userData(scormId, attempt),
      });

      // Snapshot previous value for potential rollback
      const previousUserData = queryClient.getQueryData(
        scormQueryKeys.userData(scormId, attempt)
      );

      // Optimistically update the cache with new tracking data
      // This creates immediate UI feedback
      queryClient.setQueryData(
        scormQueryKeys.userData(scormId, attempt),
        (old: Record<string, ScormTrackingElement> | undefined) => {
          if (!old) {
            return old;
          }

          const updated = { ...old };
          for (const track of tracks) {
            updated[track.element] = {
              element: track.element,
              value: track.value,
              timemodified: Date.now() / 1000, // Unix timestamp
            };
          }
          return updated;
        }
      );

      // Return context for potential rollback
      return { previousUserData, scormId, attempt };
    },

    /**
     * On error: Rollback optimistic update
     */
    onError: (_error, _params, context) => {
      // Rollback to previous state on error
      if (context?.previousUserData) {
        queryClient.setQueryData(
          scormQueryKeys.userData(context.scormId, context.attempt),
          context.previousUserData
        );
      }
    },

    /**
     * On success: Invalidate related queries to ensure fresh data
     */
    onSuccess: (_data, params) => {
      const { scormId, attempt } = params;

      // Invalidate all SCORM queries for this package
      // This ensures UI reflects the latest state from server
      void queryClient.invalidateQueries({
        queryKey: scormQueryKeys.all,
      });

      // Specifically invalidate user data for this attempt
      void queryClient.invalidateQueries({
        queryKey: scormQueryKeys.userData(scormId, attempt),
      });

      // Invalidate user data without attempt (gets all attempts)
      void queryClient.invalidateQueries({
        queryKey: scormQueryKeys.userData(scormId),
      });
    },

    /**
     * Always refetch after mutation settles (success or error)
     */
    onSettled: (_data, _error, params) => {
      // Ensure data is eventually consistent
      void queryClient.invalidateQueries({
        queryKey: scormQueryKeys.userData(params.scormId),
      });
    },
  });

  return {
    /**
     * Fire-and-forget tracking data submission
     * Use when you don't need to wait for the result
     */
    saveTracking: mutation.mutate,

    /**
     * Async tracking data submission
     * Use when you need to await the result or handle it in a promise chain
     */
    saveTrackingAsync: mutation.mutateAsync,

    /**
     * Whether a save operation is currently in progress
     */
    savingTracking: mutation.isPending,

    /**
     * Error from the last mutation attempt (null if successful or not attempted)
     */
    error: mutation.error,

    /**
     * Reset the mutation state (clears error and other state)
     */
    reset: mutation.reset,

    /**
     * Whether the last mutation was successful
     */
    isSuccess: mutation.isSuccess,
  };
}

// ============================================================================
// CONVENIENCE HOOKS FOR SPECIFIC USE CASES
// ============================================================================

/**
 * Creates a tracking element for SCORM 1.2 lesson status
 */
export function createLessonStatusElement(
  status: Scorm12LessonStatus
): ScormTrackingElement {
  return {
    element: 'cmi.core.lesson_status',
    value: status,
  };
}

/**
 * Creates a tracking element for SCORM 2004 completion status
 */
export function createCompletionStatusElement(
  status: Scorm2004CompletionStatus
): ScormTrackingElement {
  return {
    element: 'cmi.completion_status',
    value: status,
  };
}

/**
 * Creates a tracking element for SCORM 2004 success status
 */
export function createSuccessStatusElement(
  status: Scorm2004SuccessStatus
): ScormTrackingElement {
  return {
    element: 'cmi.success_status',
    value: status,
  };
}

/**
 * Creates tracking elements for score (raw, min, max, scaled)
 */
export function createScoreElements(
  score: {
    raw?: number;
    min?: number;
    max?: number;
    scaled?: number;
  },
  scormVersion: '1.2' | '2004' = '2004'
): ScormTrackingElement[] {
  const elements: ScormTrackingElement[] = [];
  const prefix = scormVersion === '1.2' ? 'cmi.core.score.' : 'cmi.score.';

  if (score.raw !== undefined) {
    elements.push({ element: `${prefix}raw`, value: score.raw.toString() });
  }
  if (score.min !== undefined) {
    elements.push({ element: `${prefix}min`, value: score.min.toString() });
  }
  if (score.max !== undefined) {
    elements.push({ element: `${prefix}max`, value: score.max.toString() });
  }
  if (scormVersion === '2004' && score.scaled !== undefined) {
    elements.push({ element: 'cmi.score.scaled', value: score.scaled.toString() });
  }

  return elements;
}

/**
 * Creates a tracking element for session time
 */
export function createSessionTimeElement(
  milliseconds: number,
  scormVersion: '1.2' | '2004' = '2004'
): ScormTrackingElement {
  const element =
    scormVersion === '1.2' ? 'cmi.core.session_time' : 'cmi.session_time';
  return {
    element,
    value: formatSessionTime(milliseconds, scormVersion),
  };
}

/**
 * Creates a tracking element for suspend data
 */
export function createSuspendDataElement(data: string): ScormTrackingElement {
  return {
    element: 'cmi.suspend_data',
    value: data,
  };
}

/**
 * Creates a tracking element for exit status
 */
export function createExitElement(
  exit: ScormExitValue,
  scormVersion: '1.2' | '2004' = '2004'
): ScormTrackingElement {
  const element = scormVersion === '1.2' ? 'cmi.core.exit' : 'cmi.exit';
  return {
    element,
    value: exit,
  };
}

/**
 * Creates a tracking element for SCORM 2004 progress measure
 */
export function createProgressMeasureElement(
  progress: number
): ScormTrackingElement {
  // Clamp value between 0 and 1
  const clampedProgress = Math.max(0, Math.min(1, progress));
  return {
    element: 'cmi.progress_measure',
    value: clampedProgress.toString(),
  };
}

/**
 * Creates a tracking element for SCORM 2004 navigation request
 */
export function createNavigationRequestElement(
  request: ScormNavigationRequestValue
): ScormTrackingElement {
  return {
    element: 'adl.nav.request',
    value: request,
  };
}

/**
 * Creates a tracking element for lesson location (bookmark)
 */
export function createLessonLocationElement(
  location: string,
  scormVersion: '1.2' | '2004' = '2004'
): ScormTrackingElement {
  const element =
    scormVersion === '1.2' ? 'cmi.core.lesson_location' : 'cmi.location';
  return {
    element,
    value: location,
  };
}
