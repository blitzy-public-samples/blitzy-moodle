/**
 * React Query Hook for Workshop Phase Management
 *
 * Provides comprehensive workshop phase tracking and phase transition capabilities.
 * This hook wraps the useWorkshop hook to derive phase-specific computed properties
 * and provides mutation functions for manual phase switching.
 *
 * Features:
 * - Phase constants matching Moodle's workshop phases (10, 20, 30, 40, 50)
 * - Current phase information and boolean helpers (isSetupPhase, isSubmissionPhase, etc.)
 * - Permission-based phase switching capability detection
 * - Available phases for transitions
 * - Mutation for manual phase switching via POST /api/v1/workshops/{id}/switch-phase
 * - Automatic phase switching logic (submission → assessment based on deadline)
 * - Phase transition validation
 * - Optimistic updates for immediate UI feedback
 *
 * Based on Moodle's workshop module implementation from:
 * - public/mod/workshop/locallib.php (lines 48-53 for phase constants)
 * - public/mod/workshop/locallib.php (line 2006 for switch_phase method)
 * - public/mod/workshop/switchphase.php (for phase switching flow)
 * - public/mod/workshop/view.php (lines 63-70 for automatic phase switching)
 *
 * @module features/activities/workshop/hooks/useWorkshopPhase
 */

import { useMemo, useCallback } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import type { Workshop } from '@/types/entities';
import { useWorkshop, WORKSHOP_QUERY_KEY } from '@/features/activities/workshop/hooks/useWorkshop';
import { usePermissions } from '@/hooks/usePermissions';

// ============================================================================
// Phase Constants
// ============================================================================

/**
 * Workshop phase: Setup
 *
 * Initial configuration phase where the teacher sets up the workshop.
 * Activities during this phase:
 * - Define assessment criteria
 * - Configure grading settings
 * - Create example submissions (optional)
 * - Set up allocation method
 *
 * @see public/mod/workshop/locallib.php line 49
 */
export const PHASE_SETUP = 10;

/**
 * Workshop phase: Submission
 *
 * Students submit their work during this phase.
 * Activities during this phase:
 * - Students create and submit their work
 * - Students may assess example submissions (if required)
 * - Late submissions may be allowed (if configured)
 *
 * @see public/mod/workshop/locallib.php line 50
 */
export const PHASE_SUBMISSION = 20;

/**
 * Workshop phase: Assessment
 *
 * Peer review phase where students assess each other's work.
 * Activities during this phase:
 * - Students assess allocated submissions
 * - Teachers monitor assessment progress
 * - Self-assessment may occur (if enabled)
 *
 * @see public/mod/workshop/locallib.php line 51
 */
export const PHASE_ASSESSMENT = 30;

/**
 * Workshop phase: Evaluation
 *
 * Grade calculation and aggregation phase.
 * Activities during this phase:
 * - System calculates submission grades from assessments
 * - System calculates assessment grades (how well students assessed)
 * - Teacher reviews and adjusts grades if needed
 *
 * @see public/mod/workshop/locallib.php line 52
 */
export const PHASE_EVALUATION = 40;

/**
 * Workshop phase: Closed
 *
 * Workshop is complete. All grades are finalized and pushed to gradebook.
 * Activities during this phase:
 * - Grades are pushed to the gradebook
 * - Students can view final results
 * - No further submissions or assessments allowed
 *
 * @see public/mod/workshop/locallib.php line 53
 */
export const PHASE_CLOSED = 50;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Workshop phase numeric type
 * Matches the phase constants defined above
 */
export type PhaseNumber = typeof PHASE_SETUP | typeof PHASE_SUBMISSION | typeof PHASE_ASSESSMENT | typeof PHASE_EVALUATION | typeof PHASE_CLOSED;

/**
 * Phase information interface
 * Contains all information about a workshop phase
 */
export interface PhaseInfo {
  /** Numeric phase code (10, 20, 30, 40, 50) */
  phase: PhaseNumber;
  /** Human-readable phase title */
  title: string;
  /** Whether this phase can be transitioned to from current phase */
  canTransitionTo: boolean;
}

/**
 * Phase transition request data
 * Data sent to the API when switching phases
 */
export interface PhaseTransitionData {
  /** Target phase to switch to */
  targetPhase: PhaseNumber;
  /** Optional force flag to bypass validation */
  force?: boolean;
}

/**
 * Phase transition result from API
 */
interface PhaseTransitionResult {
  success: boolean;
  message?: string;
  newPhase: PhaseNumber;
}

/**
 * API response envelope for phase switch
 */
interface PhaseSwitchApiResponse {
  success: boolean;
  data: PhaseTransitionResult;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Phase transition validation result
 */
export interface PhaseTransitionValidation {
  /** Whether the transition is valid */
  valid: boolean;
  /** Validation message (empty if valid) */
  message: string;
  /** Specific validation warnings */
  warnings: string[];
}

/**
 * Return type for the useWorkshopPhase hook
 */
export interface UseWorkshopPhaseResult {
  // ---- Phase Information ----
  /** Current workshop phase number (10, 20, 30, 40, 50) */
  currentPhase: PhaseNumber | undefined;
  /** Current phase title (e.g., "Setup phase", "Submission phase") */
  currentPhaseTitle: string | undefined;

  // ---- Phase Boolean Helpers ----
  /** Whether workshop is in setup phase */
  isSetupPhase: boolean;
  /** Whether workshop is in submission phase */
  isSubmissionPhase: boolean;
  /** Whether workshop is in assessment phase */
  isAssessmentPhase: boolean;
  /** Whether workshop is in evaluation phase */
  isEvaluationPhase: boolean;
  /** Whether workshop is closed */
  isClosedPhase: boolean;

  // ---- Phase Transition Capabilities ----
  /** Whether current user can switch phases (has moodle/course:manageactivities) */
  canSwitchPhase: boolean;
  /** Array of phases that can be switched to from current phase */
  availablePhases: PhaseInfo[];

  // ---- Phase Switching Mutation ----
  /** Mutation function to switch to a new phase */
  switchPhase: (targetPhase: PhaseNumber) => void;
  /** Whether a phase switch is currently in progress */
  isSwitching: boolean;
  /** Error from phase switch operation */
  switchError: Error | null;

  // ---- Automatic Phase Switching ----
  /** Whether automatic phase switching to assessment is enabled */
  automaticSwitchEnabled: boolean;
  /** Whether conditions for automatic switch are met */
  shouldAutoSwitch: boolean;

  // ---- Validation ----
  /** Validate if a phase transition is allowed */
  validatePhaseTransition: (targetPhase: PhaseNumber) => PhaseTransitionValidation;

  // ---- Loading States ----
  /** Whether workshop data is loading */
  isLoading: boolean;
  /** Whether there was an error loading workshop data */
  isError: boolean;
  /** Error from loading workshop data */
  error: Error | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get human-readable title for a workshop phase
 *
 * Maps numeric phase codes to user-friendly titles.
 * Titles are based on Moodle's language strings for workshop phases.
 *
 * @param phase - Numeric phase code (10, 20, 30, 40, 50)
 * @returns Human-readable phase title
 *
 * @example
 * ```typescript
 * getPhaseTitle(PHASE_SETUP) // "Setup phase"
 * getPhaseTitle(PHASE_SUBMISSION) // "Submission phase"
 * getPhaseTitle(30) // "Assessment phase"
 * ```
 */
export function getPhaseTitle(phase: number): string {
  switch (phase) {
    case PHASE_SETUP:
      return 'Setup phase';
    case PHASE_SUBMISSION:
      return 'Submission phase';
    case PHASE_ASSESSMENT:
      return 'Assessment phase';
    case PHASE_EVALUATION:
      return 'Grading evaluation phase';
    case PHASE_CLOSED:
      return 'Closed';
    default:
      return 'Unknown phase';
  }
}

/**
 * Get all available phases as PhaseInfo array
 *
 * @returns Array of all workshop phases with their information
 */
function getAllPhases(): PhaseInfo[] {
  return [
    { phase: PHASE_SETUP, title: getPhaseTitle(PHASE_SETUP), canTransitionTo: true },
    { phase: PHASE_SUBMISSION, title: getPhaseTitle(PHASE_SUBMISSION), canTransitionTo: true },
    { phase: PHASE_ASSESSMENT, title: getPhaseTitle(PHASE_ASSESSMENT), canTransitionTo: true },
    { phase: PHASE_EVALUATION, title: getPhaseTitle(PHASE_EVALUATION), canTransitionTo: true },
    { phase: PHASE_CLOSED, title: getPhaseTitle(PHASE_CLOSED), canTransitionTo: true },
  ];
}

/**
 * Check if a phase transition is logically valid
 *
 * In Moodle's workshop, any phase can technically transition to any other phase,
 * but there are recommended transitions and warnings for unusual transitions.
 *
 * @param currentPhase - Current workshop phase
 * @param targetPhase - Target phase to switch to
 * @param workshopData - Workshop data for validation context
 * @returns Validation result with status, message, and warnings
 */
function validateTransition(
  currentPhase: PhaseNumber,
  targetPhase: PhaseNumber,
  workshopData?: {
    hasSubmissions?: boolean;
    hasAssessments?: boolean;
    gradingCompleted?: boolean;
  }
): PhaseTransitionValidation {
  const warnings: string[] = [];

  // Same phase transition is a no-op
  if (currentPhase === targetPhase) {
    return {
      valid: false,
      message: 'Workshop is already in this phase',
      warnings: [],
    };
  }

  // All phase transitions are technically valid in Moodle
  // But we can provide helpful warnings

  // Moving backward from assessment to submission loses assessments
  if (currentPhase === PHASE_ASSESSMENT && targetPhase === PHASE_SUBMISSION) {
    if (workshopData?.hasAssessments) {
      warnings.push('Existing assessments will need to be re-evaluated after phase change');
    }
  }

  // Moving backward from evaluation to assessment may need re-calculation
  if (currentPhase === PHASE_EVALUATION && targetPhase === PHASE_ASSESSMENT) {
    warnings.push('Calculated grades may need to be re-evaluated');
  }

  // Moving backward from closed re-opens the workshop
  if (currentPhase === PHASE_CLOSED && targetPhase !== PHASE_CLOSED) {
    warnings.push('Grades will be removed from the gradebook until workshop is closed again');
  }

  // Moving to closed without completing evaluation
  if (targetPhase === PHASE_CLOSED) {
    if (currentPhase === PHASE_SETUP) {
      warnings.push('No submissions or assessments have been made');
    }
    if (currentPhase === PHASE_SUBMISSION) {
      warnings.push('Assessment phase was not completed');
    }
    if (currentPhase === PHASE_ASSESSMENT && !workshopData?.gradingCompleted) {
      warnings.push('Grading evaluation has not been completed');
    }
  }

  // Moving to assessment without submissions
  if (targetPhase === PHASE_ASSESSMENT && !workshopData?.hasSubmissions) {
    warnings.push('No submissions have been made yet');
  }

  return {
    valid: true,
    message: '',
    warnings,
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Switch workshop phase via API
 *
 * Makes a POST request to /api/v1/workshops/{workshopId}/switch-phase
 * which wraps the workshop->switch_phase() method from locallib.php.
 *
 * @param workshopId - Workshop instance ID
 * @param data - Phase transition data including target phase
 * @returns Promise resolving to the phase transition result
 * @throws Error if the API request fails or returns an error response
 */
async function switchWorkshopPhase(
  workshopId: number,
  data: PhaseTransitionData
): Promise<PhaseTransitionResult> {
  const response = await apiClient.post<PhaseSwitchApiResponse>(
    `/workshops/${workshopId}/switch-phase`,
    {
      phase: data.targetPhase,
      force: data.force ?? false,
    }
  );

  if (!response.data.success) {
    throw new Error(response.data.error?.message ?? 'Failed to switch workshop phase');
  }

  return response.data.data;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React Query hook for workshop phase management
 *
 * Provides comprehensive phase tracking and phase transition capabilities
 * for Moodle workshop activities. This hook wraps useWorkshop to derive
 * phase-specific computed properties and provides mutation functions for
 * manual phase switching.
 *
 * Features:
 * - Current phase information with boolean helpers
 * - Permission-based phase switching detection
 * - Available phases for transitions
 * - Mutation for manual phase switching with optimistic updates
 * - Automatic phase switching logic detection
 * - Phase transition validation
 *
 * @param workshopId - The workshop instance ID
 * @returns Object containing phase data, helpers, and mutation functions
 *
 * @example
 * ```typescript
 * // Basic usage - display current phase
 * const { currentPhaseTitle, isSubmissionPhase } = useWorkshopPhase(workshopId);
 *
 * if (isSubmissionPhase) {
 *   return <SubmissionForm />;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Phase switching
 * const { canSwitchPhase, availablePhases, switchPhase, isSwitching } = useWorkshopPhase(workshopId);
 *
 * if (canSwitchPhase) {
 *   return (
 *     <Select onChange={(e) => switchPhase(Number(e.target.value))}>
 *       {availablePhases.map((phase) => (
 *         <MenuItem key={phase.phase} value={phase.phase}>
 *           {phase.title}
 *         </MenuItem>
 *       ))}
 *     </Select>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Phase transition validation
 * const { validatePhaseTransition, currentPhase } = useWorkshopPhase(workshopId);
 *
 * const validation = validatePhaseTransition(PHASE_CLOSED);
 * if (!validation.valid) {
 *   alert(validation.message);
 * } else if (validation.warnings.length > 0) {
 *   if (!confirm(`Warning: ${validation.warnings.join(', ')}. Continue?`)) {
 *     return;
 *   }
 * }
 * ```
 */
function useWorkshopPhase(workshopId: number): UseWorkshopPhaseResult {
  // ============================================================================
  // Dependencies
  // ============================================================================

  const queryClient = useQueryClient();
  const { hasCapability } = usePermissions();

  // Fetch workshop data using the useWorkshop hook
  const {
    workshop,
    isLoading,
    isError,
    error,
  } = useWorkshop(workshopId);

  // ============================================================================
  // Phase Information
  // ============================================================================

  /**
   * Current workshop phase number
   * Derived from workshop.phase property
   * Values: 10 (setup), 20 (submission), 30 (assessment), 40 (evaluation), 50 (closed)
   */
  const currentPhase = useMemo<PhaseNumber | undefined>(() => {
    if (!workshop?.phase) {
      return undefined;
    }
    return workshop.phase as PhaseNumber;
  }, [workshop?.phase]);

  /**
   * Current phase title
   * Human-readable title for the current phase
   */
  const currentPhaseTitle = useMemo<string | undefined>(() => {
    if (currentPhase === undefined) {
      return undefined;
    }
    return getPhaseTitle(currentPhase);
  }, [currentPhase]);

  // ============================================================================
  // Phase Boolean Helpers
  // ============================================================================

  /**
   * Boolean helpers for phase checking
   * Optimized with useMemo to prevent unnecessary recalculations
   */
  const isSetupPhase = useMemo<boolean>(() => {
    return currentPhase === PHASE_SETUP;
  }, [currentPhase]);

  const isSubmissionPhase = useMemo<boolean>(() => {
    return currentPhase === PHASE_SUBMISSION;
  }, [currentPhase]);

  const isAssessmentPhase = useMemo<boolean>(() => {
    return currentPhase === PHASE_ASSESSMENT;
  }, [currentPhase]);

  const isEvaluationPhase = useMemo<boolean>(() => {
    return currentPhase === PHASE_EVALUATION;
  }, [currentPhase]);

  const isClosedPhase = useMemo<boolean>(() => {
    return currentPhase === PHASE_CLOSED;
  }, [currentPhase]);

  // ============================================================================
  // Phase Switching Capabilities
  // ============================================================================

  /**
   * Check if user can switch phases
   *
   * Based on Moodle's switchphase.php which requires 'mod/workshop:switchphase' capability.
   * We check for 'moodle/course:manageactivities' as a general management capability
   * that typically grants phase switching rights.
   *
   * @see public/mod/workshop/switchphase.php line 41
   */
  const canSwitchPhase = useMemo<boolean>(() => {
    // User needs course management capability or workshop switch phase capability
    return (
      hasCapability('moodle/course:manageactivities') ||
      hasCapability('mod/workshop:switchphase')
    );
  }, [hasCapability]);

  /**
   * Available phases for transition
   *
   * Returns all phases with canTransitionTo flag based on current phase
   * and workshop state. In Moodle, any phase can transition to any other,
   * but we provide context-aware filtering.
   */
  const availablePhases = useMemo<PhaseInfo[]>(() => {
    if (currentPhase === undefined) {
      return [];
    }

    // Get all phases and mark current phase as not available
    const phases = getAllPhases();
    return phases.map((phase) => ({
      ...phase,
      canTransitionTo: phase.phase !== currentPhase,
    }));
  }, [currentPhase]);

  // ============================================================================
  // Automatic Phase Switching
  // ============================================================================

  /**
   * Whether automatic phase switching to assessment is enabled
   *
   * Based on workshop.phaseswitchassessment flag from database.
   * When true, workshop will auto-switch from submission to assessment
   * when submission deadline passes.
   *
   * @see public/mod/workshop/view.php lines 63-70
   */
  const automaticSwitchEnabled = useMemo<boolean>(() => {
    if (!workshop) {
      return false;
    }
    // Access the phaseswitchassessment property from Workshop entity
    return Boolean(workshop.phaseswitchassessment);
  }, [workshop]);

  /**
   * Whether conditions for automatic switch are met
   *
   * Auto-switch happens when:
   * 1. Current phase is submission (PHASE_SUBMISSION = 20)
   * 2. phaseswitchassessment flag is enabled
   * 3. submissionend timestamp is set and in the past
   *
   * @see public/mod/workshop/view.php lines 63-64
   */
  const shouldAutoSwitch = useMemo<boolean>(() => {
    if (!workshop || !automaticSwitchEnabled) {
      return false;
    }

    // Must be in submission phase
    if (currentPhase !== PHASE_SUBMISSION) {
      return false;
    }

    // Must have a submission deadline set
    const submissionEnd = workshop.submissionend;
    if (!submissionEnd || submissionEnd <= 0) {
      return false;
    }

    // Deadline must have passed (compare with current timestamp in seconds)
    const now = Math.floor(Date.now() / 1000);
    return submissionEnd < now;
  }, [workshop, automaticSwitchEnabled, currentPhase]);

  // ============================================================================
  // Phase Transition Validation
  // ============================================================================

  /**
   * Validate if a phase transition is allowed
   *
   * Checks business rules and provides warnings for unusual transitions.
   * This is a client-side validation - the server will perform its own
   * validation when the switch is attempted.
   *
   * @param targetPhase - Target phase to validate transition to
   * @returns Validation result with valid flag, message, and warnings
   */
  const validatePhaseTransition = useCallback(
    (targetPhase: PhaseNumber): PhaseTransitionValidation => {
      if (currentPhase === undefined) {
        return {
          valid: false,
          message: 'Workshop data not loaded',
          warnings: [],
        };
      }

      // Build workshop data context for validation
      // In a real implementation, this would include actual submission/assessment counts
      const workshopData = {
        hasSubmissions: true, // Would be derived from actual data
        hasAssessments: currentPhase >= PHASE_ASSESSMENT,
        gradingCompleted: currentPhase >= PHASE_EVALUATION,
      };

      return validateTransition(currentPhase, targetPhase, workshopData);
    },
    [currentPhase]
  );

  // ============================================================================
  // Phase Switching Mutation
  // ============================================================================

  /**
   * Mutation for switching workshop phase
   *
   * Uses React Query mutation with optimistic updates for immediate UI feedback.
   * On success, invalidates the workshop query to refresh all data.
   * On error, rolls back the optimistic update.
   */
  const phaseSwitchMutation: UseMutationResult<
    PhaseTransitionResult,
    Error,
    PhaseTransitionData
  > = useMutation({
    mutationFn: (data: PhaseTransitionData) => switchWorkshopPhase(workshopId, data),

    // Optimistic update: immediately update the phase in cache
    onMutate: async (data) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: [WORKSHOP_QUERY_KEY, workshopId] });

      // Snapshot the previous workshop data for rollback
      const previousWorkshop = queryClient.getQueryData([WORKSHOP_QUERY_KEY, workshopId]);

      // Optimistically update the workshop phase in cache
      queryClient.setQueryData([WORKSHOP_QUERY_KEY, workshopId], (oldData: { workshop?: Workshop } | undefined) => {
        if (!oldData?.workshop) {
          return oldData;
        }
        return {
          ...oldData,
          workshop: {
            ...oldData.workshop,
            phase: data.targetPhase,
          },
        };
      });

      // Return context for rollback
      return { previousWorkshop };
    },

    // On error, roll back to previous value
    onError: (_error, _variables, context) => {
      if (context?.previousWorkshop) {
        queryClient.setQueryData(
          [WORKSHOP_QUERY_KEY, workshopId],
          context.previousWorkshop
        );
      }
    },

    // On success or error, invalidate queries to ensure fresh data
    onSettled: () => {
      // Invalidate workshop query to refetch fresh data
      void queryClient.invalidateQueries({ queryKey: [WORKSHOP_QUERY_KEY, workshopId] });
    },
  });

  /**
   * Switch phase function
   *
   * Wrapped function for easy calling without needing to construct data object.
   *
   * @param targetPhase - Target phase to switch to
   */
  const switchPhase = useCallback(
    (targetPhase: PhaseNumber): void => {
      phaseSwitchMutation.mutate({ targetPhase });
    },
    [phaseSwitchMutation]
  );

  // ============================================================================
  // Return Hook Result
  // ============================================================================

  return {
    // Phase Information
    currentPhase,
    currentPhaseTitle,

    // Phase Boolean Helpers
    isSetupPhase,
    isSubmissionPhase,
    isAssessmentPhase,
    isEvaluationPhase,
    isClosedPhase,

    // Phase Transition Capabilities
    canSwitchPhase,
    availablePhases,

    // Phase Switching Mutation
    switchPhase,
    isSwitching: phaseSwitchMutation.isPending,
    switchError: phaseSwitchMutation.error,

    // Automatic Phase Switching
    automaticSwitchEnabled,
    shouldAutoSwitch,

    // Validation
    validatePhaseTransition,

    // Loading States
    isLoading,
    isError,
    error,
  };
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Default export for the useWorkshopPhase hook
 *
 * Usage:
 * ```typescript
 * import useWorkshopPhase from '@/features/activities/workshop/hooks/useWorkshopPhase';
 * ```
 */
export default useWorkshopPhase;

/**
 * Named export for explicit imports
 *
 * Usage:
 * ```typescript
 * import { useWorkshopPhase, PHASE_SETUP, getPhaseTitle } from '@/features/activities/workshop/hooks/useWorkshopPhase';
 * ```
 */
export { useWorkshopPhase };
