/**
 * Unit Tests for useWorkshopPhase Hook
 *
 * Tests comprehensive workshop phase tracking and phase transition capabilities.
 * This test suite validates:
 * - Phase constants matching Moodle's workshop phases (10, 20, 30, 40, 50)
 * - Current phase information and boolean helpers
 * - Permission-based phase switching detection
 * - Available phases for transitions
 * - Mutation for manual phase switching
 * - Automatic phase switching logic
 * - Phase transition validation
 * - Optimistic updates and cache management
 *
 * @module tests/unit/features/activities/workshop/useWorkshopPhase.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

// Hook under test
import useWorkshopPhase, {
  getPhaseTitle,
  PHASE_SETUP,
  PHASE_SUBMISSION,
  PHASE_ASSESSMENT,
  PHASE_EVALUATION,
  PHASE_CLOSED,
  type PhaseNumber,
  type PhaseInfo,
  type PhaseTransitionValidation,
} from '@/features/activities/workshop/hooks/useWorkshopPhase';

// Test utilities
import { createTestQueryClient } from '@tests/helpers/render';

// Import global MSW server - do NOT create local server
import { server } from '@tests/mocks/server';

// ============================================================================
// Constants
// ============================================================================

/**
 * API base URL for MSW handlers
 * Must match VITE_API_BASE_URL from vitest.config.ts for MSW to intercept requests
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Create a mock workshop instance with configurable phase
 */
function createMockWorkshop(overrides: Partial<{
  id: number;
  name: string;
  phase: number;
  phaseSwitchAssessment: boolean;
  submissionEnd: number;
  assessmentEnd: number;
}> = {}) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Test Workshop',
    intro: 'Workshop introduction',
    introformat: 1,
    course: 1,
    phase: overrides.phase ?? PHASE_SETUP,
    grade: 100,
    gradinggrade: 80,
    strategy: 'accumulative',
    useexamples: false,
    usepeerassessment: true,
    useselfassessment: false,
    latesubmissions: false,
    phaseSwitchAssessment: overrides.phaseSwitchAssessment ?? false,
    submissionStart: 0,
    submissionEnd: overrides.submissionEnd ?? 0,
    assessmentStart: 0,
    assessmentEnd: overrides.assessmentEnd ?? 0,
    instructauthors: '',
    instructauthorsformat: 1,
    instructreviewers: '',
    instructreviewersformat: 1,
    timemodified: Date.now(),
  };
}

/**
 * Create mock workshop user plan with phases
 */
function createMockUserPlan(currentPhase: number = PHASE_SETUP) {
  return {
    phases: [
      {
        phase: PHASE_SETUP,
        title: 'Setup phase',
        active: currentPhase === PHASE_SETUP,
        tasks: [],
      },
      {
        phase: PHASE_SUBMISSION,
        title: 'Submission phase',
        active: currentPhase === PHASE_SUBMISSION,
        tasks: [],
      },
      {
        phase: PHASE_ASSESSMENT,
        title: 'Assessment phase',
        active: currentPhase === PHASE_ASSESSMENT,
        tasks: [],
      },
      {
        phase: PHASE_EVALUATION,
        title: 'Grading evaluation phase',
        active: currentPhase === PHASE_EVALUATION,
        tasks: [],
      },
      {
        phase: PHASE_CLOSED,
        title: 'Closed',
        active: currentPhase === PHASE_CLOSED,
        tasks: [],
      },
    ],
  };
}

/**
 * Create a mock workshop API response
 */
function createMockWorkshopResponse(phase: number = PHASE_SETUP, options: Partial<{
  phaseSwitchAssessment: boolean;
  submissionEnd: number;
}> = {}) {
  const workshop = createMockWorkshop({ phase, ...options });
  return {
    success: true,
    data: {
      workshop,
      userPlan: createMockUserPlan(phase),
      submissions: [],
      currentPhase: phase,
      currentPhaseTitle: getPhaseTitle(phase),
    },
  };
}

/**
 * Create a mock phase switch response
 */
function createMockPhaseSwitchResponse(newPhase: number, success: boolean = true) {
  if (success) {
    return {
      success: true,
      data: {
        success: true,
        message: `Phase switched to ${getPhaseTitle(newPhase)}`,
        newPhase,
      },
    };
  }
  return {
    success: false,
    error: {
      code: 'PHASE_SWITCH_FAILED',
      message: 'Failed to switch workshop phase',
    },
  };
}

// ============================================================================
// Mock usePermissions Hook
// ============================================================================

// Track the mock implementation for testing
let mockHasCapability: (capability: string) => boolean = () => false;

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasCapability: (cap: string) => mockHasCapability(cap),
    hasAnyCapability: (caps: string[]) => caps.some(cap => mockHasCapability(cap)),
    hasAllCapabilities: (caps: string[]) => caps.every(cap => mockHasCapability(cap)),
    isAdmin: false,
    isTeacher: false,
    isStudent: true,
  }),
}));

// ============================================================================
// Test Wrapper
// ============================================================================

/**
 * Create wrapper with QueryClientProvider for hook testing
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('useWorkshopPhase', () => {
  let queryClient: QueryClient;

  // Note: server.listen() and server.close() are handled globally in tests/setup.ts

  beforeEach(() => {
    queryClient = createTestQueryClient();
    // Reset mock permissions to default (no capabilities)
    mockHasCapability = () => false;
    
    // Set up default handlers for each test
    server.use(
      // GET workshop endpoint - default to PHASE_SETUP
      http.get(`${API_BASE_URL}/workshops/:id`, () => {
        return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
      }),
      // POST switch phase endpoint
      http.post(`${API_BASE_URL}/workshops/:id/switch-phase`, async ({ request }) => {
        const body = await request.json() as { phase: number; force?: boolean };
        return HttpResponse.json(createMockPhaseSwitchResponse(body.phase));
      })
    );
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Phase Constants Tests
  // ==========================================================================

  describe('Phase Constants', () => {
    it('should export PHASE_SETUP constant with value 10', () => {
      expect(PHASE_SETUP).toBe(10);
    });

    it('should export PHASE_SUBMISSION constant with value 20', () => {
      expect(PHASE_SUBMISSION).toBe(20);
    });

    it('should export PHASE_ASSESSMENT constant with value 30', () => {
      expect(PHASE_ASSESSMENT).toBe(30);
    });

    it('should export PHASE_EVALUATION constant with value 40', () => {
      expect(PHASE_EVALUATION).toBe(40);
    });

    it('should export PHASE_CLOSED constant with value 50', () => {
      expect(PHASE_CLOSED).toBe(50);
    });

    it('should have sequential phase ordering with 10-step increments', () => {
      expect(PHASE_SUBMISSION - PHASE_SETUP).toBe(10);
      expect(PHASE_ASSESSMENT - PHASE_SUBMISSION).toBe(10);
      expect(PHASE_EVALUATION - PHASE_ASSESSMENT).toBe(10);
      expect(PHASE_CLOSED - PHASE_EVALUATION).toBe(10);
    });
  });

  // ==========================================================================
  // getPhaseTitle Helper Function Tests
  // ==========================================================================

  describe('getPhaseTitle', () => {
    it('should return "Setup phase" for PHASE_SETUP (10)', () => {
      expect(getPhaseTitle(PHASE_SETUP)).toBe('Setup phase');
    });

    it('should return "Submission phase" for PHASE_SUBMISSION (20)', () => {
      expect(getPhaseTitle(PHASE_SUBMISSION)).toBe('Submission phase');
    });

    it('should return "Assessment phase" for PHASE_ASSESSMENT (30)', () => {
      expect(getPhaseTitle(PHASE_ASSESSMENT)).toBe('Assessment phase');
    });

    it('should return "Grading evaluation phase" for PHASE_EVALUATION (40)', () => {
      expect(getPhaseTitle(PHASE_EVALUATION)).toBe('Grading evaluation phase');
    });

    it('should return "Closed" for PHASE_CLOSED (50)', () => {
      expect(getPhaseTitle(PHASE_CLOSED)).toBe('Closed');
    });

    it('should return "Unknown phase" for invalid phase number', () => {
      expect(getPhaseTitle(0)).toBe('Unknown phase');
      expect(getPhaseTitle(-1)).toBe('Unknown phase');
      expect(getPhaseTitle(100)).toBe('Unknown phase');
      expect(getPhaseTitle(15)).toBe('Unknown phase');
    });

    it('should handle number type correctly', () => {
      // Type safety test - should accept number and return string
      const title: string = getPhaseTitle(10);
      expect(typeof title).toBe('string');
    });
  });

  // ==========================================================================
  // Current Phase Information Tests
  // ==========================================================================

  describe('Current Phase Information', () => {
    it('should derive currentPhase from useWorkshop hook', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SUBMISSION));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentPhase).toBe(PHASE_SUBMISSION);
    });

    it('should provide currentPhaseTitle as computed string', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_ASSESSMENT));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentPhaseTitle).toBe('Assessment phase');
    });

    it('should return undefined for currentPhase while loading', () => {
      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      // Initial state before data loads
      expect(result.current.currentPhase).toBeUndefined();
    });

    it('should return undefined for currentPhaseTitle while loading', () => {
      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.currentPhaseTitle).toBeUndefined();
    });
  });

  // ==========================================================================
  // Boolean Phase Helpers Tests
  // ==========================================================================

  describe('Boolean Phase Helpers', () => {
    it('should set isSetupPhase to true when in setup phase', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSetupPhase).toBe(true);
      expect(result.current.isSubmissionPhase).toBe(false);
      expect(result.current.isAssessmentPhase).toBe(false);
      expect(result.current.isEvaluationPhase).toBe(false);
      expect(result.current.isClosedPhase).toBe(false);
    });

    it('should set isSubmissionPhase to true when in submission phase', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SUBMISSION));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSetupPhase).toBe(false);
      expect(result.current.isSubmissionPhase).toBe(true);
      expect(result.current.isAssessmentPhase).toBe(false);
      expect(result.current.isEvaluationPhase).toBe(false);
      expect(result.current.isClosedPhase).toBe(false);
    });

    it('should set isAssessmentPhase to true when in assessment phase', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_ASSESSMENT));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSetupPhase).toBe(false);
      expect(result.current.isSubmissionPhase).toBe(false);
      expect(result.current.isAssessmentPhase).toBe(true);
      expect(result.current.isEvaluationPhase).toBe(false);
      expect(result.current.isClosedPhase).toBe(false);
    });

    it('should set isEvaluationPhase to true when in evaluation phase', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_EVALUATION));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSetupPhase).toBe(false);
      expect(result.current.isSubmissionPhase).toBe(false);
      expect(result.current.isAssessmentPhase).toBe(false);
      expect(result.current.isEvaluationPhase).toBe(true);
      expect(result.current.isClosedPhase).toBe(false);
    });

    it('should set isClosedPhase to true when closed', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_CLOSED));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSetupPhase).toBe(false);
      expect(result.current.isSubmissionPhase).toBe(false);
      expect(result.current.isAssessmentPhase).toBe(false);
      expect(result.current.isEvaluationPhase).toBe(false);
      expect(result.current.isClosedPhase).toBe(true);
    });

    it('should have all boolean helpers return false while loading', () => {
      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isSetupPhase).toBe(false);
      expect(result.current.isSubmissionPhase).toBe(false);
      expect(result.current.isAssessmentPhase).toBe(false);
      expect(result.current.isEvaluationPhase).toBe(false);
      expect(result.current.isClosedPhase).toBe(false);
    });
  });

  // ==========================================================================
  // canSwitchPhase Capability Tests
  // ==========================================================================

  describe('canSwitchPhase', () => {
    it('should return false when user lacks phase switch capability', async () => {
      mockHasCapability = () => false;

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canSwitchPhase).toBe(false);
    });

    it('should return true when user has moodle/course:manageactivities', async () => {
      mockHasCapability = (cap: string) => cap === 'moodle/course:manageactivities';

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canSwitchPhase).toBe(true);
    });

    it('should return true when user has mod/workshop:switchphase', async () => {
      mockHasCapability = (cap: string) => cap === 'mod/workshop:switchphase';

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canSwitchPhase).toBe(true);
    });

    it('should return true when user has both capabilities', async () => {
      mockHasCapability = (cap: string) =>
        cap === 'moodle/course:manageactivities' || cap === 'mod/workshop:switchphase';

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canSwitchPhase).toBe(true);
    });
  });

  // ==========================================================================
  // availablePhases Array Tests
  // ==========================================================================

  describe('availablePhases', () => {
    it('should return empty array while loading', () => {
      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.availablePhases).toEqual([]);
    });

    it('should list all phases with canTransitionTo flag', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.availablePhases).toHaveLength(5);

      // Current phase (SETUP) should have canTransitionTo = false
      const setupPhase = result.current.availablePhases.find(p => p.phase === PHASE_SETUP);
      expect(setupPhase?.canTransitionTo).toBe(false);

      // Other phases should have canTransitionTo = true
      const submissionPhase = result.current.availablePhases.find(p => p.phase === PHASE_SUBMISSION);
      expect(submissionPhase?.canTransitionTo).toBe(true);
    });

    it('should include correct title for each phase', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const phaseMap = new Map(
        result.current.availablePhases.map(p => [p.phase, p.title])
      );

      expect(phaseMap.get(PHASE_SETUP)).toBe('Setup phase');
      expect(phaseMap.get(PHASE_SUBMISSION)).toBe('Submission phase');
      expect(phaseMap.get(PHASE_ASSESSMENT)).toBe('Assessment phase');
      expect(phaseMap.get(PHASE_EVALUATION)).toBe('Grading evaluation phase');
      expect(phaseMap.get(PHASE_CLOSED)).toBe('Closed');
    });

    it('should update canTransitionTo when current phase changes', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_ASSESSMENT));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Current phase (ASSESSMENT) should have canTransitionTo = false
      const assessmentPhase = result.current.availablePhases.find(p => p.phase === PHASE_ASSESSMENT);
      expect(assessmentPhase?.canTransitionTo).toBe(false);

      // SETUP should now have canTransitionTo = true
      const setupPhase = result.current.availablePhases.find(p => p.phase === PHASE_SETUP);
      expect(setupPhase?.canTransitionTo).toBe(true);
    });
  });

  // ==========================================================================
  // useSwitchPhase Mutation Tests
  // ==========================================================================

  describe('switchPhase mutation', () => {
    it('should call POST /api/v1/workshops/{id}/switch-phase', async () => {
      mockHasCapability = () => true;
      let capturedRequest: { phase: number; force?: boolean } | null = null;

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        }),
        http.post(`${API_BASE_URL}/workshops/:id/switch-phase`, async ({ request }) => {
          capturedRequest = await request.json() as { phase: number; force?: boolean };
          return HttpResponse.json(createMockPhaseSwitchResponse(PHASE_SUBMISSION));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.switchPhase(PHASE_SUBMISSION);
      });

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      expect((capturedRequest as { phase: number; force?: boolean } | null)?.phase).toBe(PHASE_SUBMISSION);
    });

    it('should set isSwitching to true during mutation', async () => {
      mockHasCapability = () => true;

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        }),
        http.post(`${API_BASE_URL}/workshops/:id/switch-phase`, async () => {
          // Delay response to observe isSwitching state
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json(createMockPhaseSwitchResponse(PHASE_SUBMISSION));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSwitching).toBe(false);

      act(() => {
        result.current.switchPhase(PHASE_SUBMISSION);
      });

      await waitFor(() => {
        expect(result.current.isSwitching).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isSwitching).toBe(false);
      });
    });

    it('should set switchError on mutation failure', async () => {
      mockHasCapability = () => true;

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        }),
        http.post(`${API_BASE_URL}/workshops/:id/switch-phase`, () => {
          return HttpResponse.json(createMockPhaseSwitchResponse(PHASE_SUBMISSION, false), {
            status: 403,
          });
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.switchPhase(PHASE_SUBMISSION);
      });

      await waitFor(() => {
        expect(result.current.switchError).not.toBeNull();
      });
    });

    it('should clear switchError on successful mutation', async () => {
      mockHasCapability = () => true;

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        }),
        http.post(`${API_BASE_URL}/workshops/:id/switch-phase`, () => {
          return HttpResponse.json(createMockPhaseSwitchResponse(PHASE_SUBMISSION));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.switchPhase(PHASE_SUBMISSION);
      });

      await waitFor(() => {
        expect(result.current.isSwitching).toBe(false);
      });

      expect(result.current.switchError).toBeNull();
    });
  });

  // ==========================================================================
  // Automatic Phase Switching Tests
  // ==========================================================================

  describe('Automatic Phase Switching', () => {
    it('should detect automaticSwitchEnabled from phaseswitchassessment flag', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SUBMISSION, {
            phaseSwitchAssessment: true,
          }));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.automaticSwitchEnabled).toBe(true);
    });

    it('should set automaticSwitchEnabled to false when flag is not set', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SUBMISSION, {
            phaseSwitchAssessment: false,
          }));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.automaticSwitchEnabled).toBe(false);
    });

    it('should set shouldAutoSwitch when conditions are met', async () => {
      const pastDeadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SUBMISSION, {
            phaseSwitchAssessment: true,
            submissionEnd: pastDeadline,
          }));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.shouldAutoSwitch).toBe(true);
    });

    it('should not set shouldAutoSwitch when deadline is in the future', async () => {
      const futureDeadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SUBMISSION, {
            phaseSwitchAssessment: true,
            submissionEnd: futureDeadline,
          }));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.shouldAutoSwitch).toBe(false);
    });

    it('should not set shouldAutoSwitch when not in submission phase', async () => {
      const pastDeadline = Math.floor(Date.now() / 1000) - 3600;

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_ASSESSMENT, {
            phaseSwitchAssessment: true,
            submissionEnd: pastDeadline,
          }));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.shouldAutoSwitch).toBe(false);
    });

    it('should not set shouldAutoSwitch when automaticSwitchEnabled is false', async () => {
      const pastDeadline = Math.floor(Date.now() / 1000) - 3600;

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SUBMISSION, {
            phaseSwitchAssessment: false,
            submissionEnd: pastDeadline,
          }));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.shouldAutoSwitch).toBe(false);
    });
  });

  // ==========================================================================
  // Phase Transition Validation Tests
  // ==========================================================================

  describe('validatePhaseTransition', () => {
    it('should return invalid when workshop data not loaded', () => {
      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      const validation = result.current.validatePhaseTransition(PHASE_SUBMISSION);
      expect(validation.valid).toBe(false);
      expect(validation.message).toBe('Workshop data not loaded');
    });

    it('should return invalid for same phase transition', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const validation = result.current.validatePhaseTransition(PHASE_SETUP);
      expect(validation.valid).toBe(false);
      expect(validation.message).toBe('Workshop is already in this phase');
    });

    it('should return invalid for invalid phase number', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const validation = result.current.validatePhaseTransition(15 as PhaseNumber);
      expect(validation.valid).toBe(false);
      expect(validation.message).toBe('Invalid target phase value');
    });

    it('should return valid for forward phase progression', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const validation = result.current.validatePhaseTransition(PHASE_SUBMISSION);
      expect(validation.valid).toBe(true);
      expect(validation.message).toBe('');
    });

    it('should include warning when closing without completing evaluation', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const validation = result.current.validatePhaseTransition(PHASE_CLOSED);
      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain('No submissions or assessments have been made');
    });

    it('should include warning when moving backward from closed phase', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_CLOSED));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const validation = result.current.validatePhaseTransition(PHASE_EVALUATION);
      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain(
        'Grades will be removed from the gradebook until workshop is closed again'
      );
    });
  });

  // ==========================================================================
  // Optimistic Updates Tests
  // ==========================================================================

  describe('Optimistic Updates', () => {
    it('should optimistically update phase in cache during mutation', async () => {
      mockHasCapability = () => true;

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        }),
        http.post(`${API_BASE_URL}/workshops/:id/switch-phase`, async () => {
          // Delay to observe optimistic update
          await new Promise(resolve => setTimeout(resolve, 200));
          return HttpResponse.json(createMockPhaseSwitchResponse(PHASE_SUBMISSION));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.currentPhase).toBe(PHASE_SETUP);
      });

      act(() => {
        result.current.switchPhase(PHASE_SUBMISSION);
      });

      // Optimistic update should have applied
      await waitFor(() => {
        expect(result.current.currentPhase).toBe(PHASE_SUBMISSION);
      });
    });

    it('should rollback optimistic update on mutation error', async () => {
      mockHasCapability = () => true;

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        }),
        http.post(`${API_BASE_URL}/workshops/:id/switch-phase`, async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.currentPhase).toBe(PHASE_SETUP);
      });

      act(() => {
        result.current.switchPhase(PHASE_SUBMISSION);
      });

      // Wait for error and rollback
      await waitFor(() => {
        expect(result.current.switchError).not.toBeNull();
      });

      // Should rollback to original phase
      await waitFor(() => {
        expect(result.current.currentPhase).toBe(PHASE_SETUP);
      });
    });
  });

  // ==========================================================================
  // Query Invalidation Tests
  // ==========================================================================

  describe('Query Invalidation', () => {
    it('should invalidate workshops query on successful phase change', async () => {
      mockHasCapability = () => true;
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        }),
        http.post(`${API_BASE_URL}/workshops/:id/switch-phase`, () => {
          return HttpResponse.json(createMockPhaseSwitchResponse(PHASE_SUBMISSION));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.switchPhase(PHASE_SUBMISSION);
      });

      await waitFor(() => {
        expect(result.current.isSwitching).toBe(false);
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining(['workshops']),
        })
      );

      invalidateQueriesSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Loading and Error States Tests
  // ==========================================================================

  describe('Loading and Error States', () => {
    it('should set isLoading to true while fetching', () => {
      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should set isLoading to false after fetch completes', async () => {
      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should set isError and error on fetch failure', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).not.toBeNull();
    });
  });

  // ==========================================================================
  // Phase Progression Logic Tests
  // ==========================================================================

  describe('Phase Progression Logic', () => {
    it('should support setup → submission transition', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const validation = result.current.validatePhaseTransition(PHASE_SUBMISSION);
      expect(validation.valid).toBe(true);
    });

    it('should support submission → assessment transition', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SUBMISSION));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const validation = result.current.validatePhaseTransition(PHASE_ASSESSMENT);
      expect(validation.valid).toBe(true);
    });

    it('should support assessment → evaluation transition', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_ASSESSMENT));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const validation = result.current.validatePhaseTransition(PHASE_EVALUATION);
      expect(validation.valid).toBe(true);
    });

    it('should support evaluation → closed transition', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_EVALUATION));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const validation = result.current.validatePhaseTransition(PHASE_CLOSED);
      expect(validation.valid).toBe(true);
    });

    it('should support backward transitions (with warnings)', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_ASSESSMENT));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Backward transition should be valid but may have warnings
      const validation = result.current.validatePhaseTransition(PHASE_SUBMISSION);
      expect(validation.valid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // TypeScript Type Safety Tests
  // ==========================================================================

  describe('TypeScript Types', () => {
    it('should have correct type for PhaseNumber', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Type assertion - currentPhase should be PhaseNumber | undefined
      const phase: PhaseNumber | undefined = result.current.currentPhase;
      expect([10, 20, 30, 40, 50, undefined]).toContain(phase);
    });

    it('should have correct type for PhaseInfo', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Type assertion - availablePhases should be PhaseInfo[]
      const phases: PhaseInfo[] = result.current.availablePhases;
      phases.forEach(phaseInfo => {
        expect(typeof phaseInfo.phase).toBe('number');
        expect(typeof phaseInfo.title).toBe('string');
        expect(typeof phaseInfo.canTransitionTo).toBe('boolean');
      });
    });

    it('should have correct type for PhaseTransitionValidation', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Type assertion - validatePhaseTransition returns PhaseTransitionValidation
      const validation: PhaseTransitionValidation = result.current.validatePhaseTransition(PHASE_SUBMISSION);
      expect(typeof validation.valid).toBe('boolean');
      expect(typeof validation.message).toBe('string');
      expect(Array.isArray(validation.warnings)).toBe(true);
    });
  });

  // ==========================================================================
  // Error Handling for Invalid Phase Transitions Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Hook should still be usable with default values
      expect(result.current.isSetupPhase).toBe(false);
      expect(result.current.availablePhases).toEqual([]);
    });

    it('should handle phase switch mutation error', async () => {
      mockHasCapability = () => true;

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(createMockWorkshopResponse(PHASE_SETUP));
        }),
        http.post(`${API_BASE_URL}/workshops/:id/switch-phase`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to switch phases',
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useWorkshopPhase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.switchPhase(PHASE_SUBMISSION);
      });

      await waitFor(() => {
        expect(result.current.switchError).not.toBeNull();
      });
    });
  });
});
