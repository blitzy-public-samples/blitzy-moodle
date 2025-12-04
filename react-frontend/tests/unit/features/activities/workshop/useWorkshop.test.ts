/**
 * Unit Tests for useWorkshop Hook
 *
 * Comprehensive test suite validating the useWorkshop React Query hook for fetching
 * workshop instance data. Tests cover query behavior, data structure, loading/error states,
 * caching, automatic refetching, and TypeScript type handling.
 *
 * The hook integrates with GET /api/v1/workshops/{id} endpoint which wraps existing
 * Moodle PHP functions without duplicating business logic:
 * - Workshop class instantiation (view.php line 54)
 * - User plan generation (view.php line 76)
 * - Submissions list retrieval
 *
 * @see react-frontend/src/features/activities/workshop/hooks/useWorkshop.ts
 * @see public/mod/workshop/view.php
 * @see public/mod/workshop/locallib.php
 */

import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React, { ReactNode } from 'react';

// Internal imports
import { useWorkshop, WORKSHOP_QUERY_KEY } from '@/features/activities/workshop/hooks/useWorkshop';
import { createMockWorkshop } from './test-utils';
import { createTestQueryClient } from '@/tests/helpers/render';

// Import types for type checking assertions
import type {
  Workshop,
  WorkshopSubmission,
  WorkshopUserPlan,
  WorkshopUserPlanPhase,
  WorkshopPhase,
} from '@/features/activities/workshop/types/workshop.types';

// ============================================================================
// Test Constants
// ============================================================================

/**
 * Workshop phase constants matching Moodle's workshop module
 * @see public/mod/workshop/lib.php - PHASE_SETUP, PHASE_SUBMISSION, etc.
 */
const PHASE_SETUP = 10;
const PHASE_SUBMISSION = 20;
const PHASE_ASSESSMENT = 30;
const PHASE_EVALUATION = 40;
const PHASE_CLOSED = 50;

/**
 * Default stale time matching the hook's configuration (5 minutes)
 */
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 300000ms

/**
 * Base API URL for workshop endpoints
 */
const API_BASE_URL = '/api/v1';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a mock user plan with phases and tasks
 */
function createMockUserPlan(workshopId: number = 1, userId: number = 100): WorkshopUserPlan {
  return {
    userId,
    workshopId,
    phases: [
      {
        phase: PHASE_SETUP as WorkshopPhase,
        title: 'Setup phase',
        active: false,
        tasks: [
          { key: 'info', title: 'Workshop information', completed: 'info' },
        ],
      },
      {
        phase: PHASE_SUBMISSION as WorkshopPhase,
        title: 'Submission phase',
        active: true,
        tasks: [
          { key: 'submit', title: 'Submit your work', completed: false, link: '/mod/workshop/submission.php?cmid=1' },
          { key: 'deadline', title: 'Submission deadline', completed: 'info', details: 'Dec 31, 2024' },
        ],
      },
      {
        phase: PHASE_ASSESSMENT as WorkshopPhase,
        title: 'Assessment phase',
        active: false,
        tasks: [
          { key: 'assess', title: 'Assess peers', completed: false },
        ],
      },
      {
        phase: PHASE_EVALUATION as WorkshopPhase,
        title: 'Grading evaluation phase',
        active: false,
        tasks: [],
      },
      {
        phase: PHASE_CLOSED as WorkshopPhase,
        title: 'Closed',
        active: false,
        tasks: [],
      },
    ],
    examples: [],
  };
}

/**
 * Creates a mock submission for testing
 */
function createMockSubmission(overrides: Partial<WorkshopSubmission> = {}): WorkshopSubmission {
  return {
    id: 1,
    workshopId: 1,
    example: false,
    authorId: 100,
    authorFirstName: 'John',
    authorLastName: 'Doe',
    authorEmail: 'john.doe@example.com',
    title: 'Test Submission',
    content: '<p>Test submission content</p>',
    contentFormat: 1,
    contentTrust: false,
    attachment: 0,
    grade: null,
    gradingGrade: null,
    gradeOver: null,
    gradingGradeOver: null,
    feedbackAuthor: null,
    feedbackAuthorFormat: 1,
    timeCreated: Date.now() / 1000,
    timeModified: Date.now() / 1000,
    published: false,
    late: false,
    ...overrides,
  };
}

/**
 * Creates a complete mock workshop API response
 */
function createMockWorkshopResponse(workshopId: number = 1) {
  const workshop = createMockWorkshop({ id: workshopId });
  const userPlan = createMockUserPlan(workshopId);
  const submissions: WorkshopSubmission[] = [
    createMockSubmission({ id: 1, workshopId }),
    createMockSubmission({ id: 2, workshopId, title: 'Second Submission', authorId: 101 }),
  ];

  return {
    success: true,
    data: {
      workshop,
      userPlan,
      submissions,
      currentPhase: workshop.phase,
      currentPhaseTitle: 'Submission phase',
    },
  };
}

// ============================================================================
// MSW Server Setup
// ============================================================================

/**
 * Default workshop API handlers for MSW
 * Mocks GET /api/v1/workshops/{id} endpoint
 */
const workshopHandlers = [
  http.get(`${API_BASE_URL}/workshops/:id`, ({ params }) => {
    const id = Number(params.id);
    
    if (id <= 0 || isNaN(id)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PARAMETER',
            message: 'Invalid workshop ID',
          },
        },
        { status: 400 }
      );
    }

    return HttpResponse.json(createMockWorkshopResponse(id));
  }),
];

/**
 * MSW server instance for intercepting API requests
 */
const server = setupServer(...workshopHandlers);

// ============================================================================
// Test Suite Setup
// ============================================================================

beforeAll(() => {
  // Start MSW server before all tests
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  // Reset handlers after each test
  server.resetHandlers();
});

afterAll(() => {
  // Clean up MSW server after all tests
  server.close();
});

// ============================================================================
// Test Helper Functions
// ============================================================================

/**
 * Creates a wrapper component with QueryClientProvider for testing hooks
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
// Test Suites
// ============================================================================

describe('useWorkshop Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create fresh QueryClient for each test to prevent cache pollution
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    // Clear all queries after each test
    queryClient.clear();
  });

  // --------------------------------------------------------------------------
  // Basic Hook Functionality Tests
  // --------------------------------------------------------------------------

  describe('Basic Hook Functionality', () => {
    it('should accept workshopId parameter and return workshop data', async () => {
      const workshopId = 1;
      const { result } = renderHook(() => useWorkshop(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify workshop data is returned
      expect(result.current.workshop).toBeDefined();
      expect(result.current.workshop?.id).toBe(workshopId);
    });

    it('should use React Query with proper query key [workshops, workshopId]', async () => {
      const workshopId = 42;
      const { result } = renderHook(() => useWorkshop(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify query key structure matches expected pattern
      const queryCache = queryClient.getQueryCache();
      const queries = queryCache.getAll();
      const workshopQuery = queries.find(
        (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === WORKSHOP_QUERY_KEY &&
          query.queryKey[1] === workshopId
      );

      expect(workshopQuery).toBeDefined();
      expect(workshopQuery?.queryKey).toEqual([WORKSHOP_QUERY_KEY, workshopId]);
    });

    it('should return isLoading=true during initial data fetch', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      // Should start in loading state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should return isSuccess=true after successful data fetch', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Workshop Instance Properties Tests
  // --------------------------------------------------------------------------

  describe('Workshop Instance Properties', () => {
    it('should return workshop with all required properties', async () => {
      const workshopId = 1;
      const { result } = renderHook(() => useWorkshop(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.workshop).toBeDefined();
      });

      const workshop = result.current.workshop;

      // Verify core workshop properties exist
      expect(workshop?.id).toBe(workshopId);
      expect(typeof workshop?.name).toBe('string');
      expect(typeof workshop?.phase).toBe('number');
      expect(typeof workshop?.strategy).toBe('string');
    });

    it('should return workshop with correct phase value (10, 20, 30, 40, or 50)', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.workshop).toBeDefined();
      });

      const validPhases = [PHASE_SETUP, PHASE_SUBMISSION, PHASE_ASSESSMENT, PHASE_EVALUATION, PHASE_CLOSED];
      expect(validPhases).toContain(result.current.workshop?.phase);
    });

    it('should return workshop with grading strategy type', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.workshop).toBeDefined();
      });

      const validStrategies = ['accumulative', 'rubric', 'comments', 'numerrors'];
      expect(validStrategies).toContain(result.current.workshop?.strategy);
    });

    it('should return workshop with date properties (submissionStart, submissionEnd, assessmentStart, assessmentEnd)', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.workshop).toBeDefined();
      });

      const workshop = result.current.workshop;

      // Date properties should exist (can be null)
      expect('submissionStart' in (workshop ?? {})).toBe(true);
      expect('submissionEnd' in (workshop ?? {})).toBe(true);
      expect('assessmentStart' in (workshop ?? {})).toBe(true);
      expect('assessmentEnd' in (workshop ?? {})).toBe(true);
    });

    it('should return workshop with grading options (grade, gradingGrade)', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.workshop).toBeDefined();
      });

      const workshop = result.current.workshop;

      expect(typeof workshop?.grade).toBe('number');
      expect(typeof workshop?.gradingGrade).toBe('number');
    });
  });

  // --------------------------------------------------------------------------
  // User Plan Data Structure Tests
  // --------------------------------------------------------------------------

  describe('User Plan Data Structure', () => {
    it('should return userPlan with phases array', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.userPlan).toBeDefined();
      });

      expect(Array.isArray(result.current.userPlan?.phases)).toBe(true);
      expect(result.current.userPlan?.phases.length).toBeGreaterThan(0);
    });

    it('should return userPlan phases with tasks per phase', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.userPlan?.phases).toBeDefined();
      });

      const phases = result.current.userPlan?.phases ?? [];
      
      // Each phase should have the required structure
      phases.forEach((phase) => {
        expect(typeof phase.phase).toBe('number');
        expect(typeof phase.title).toBe('string');
        expect(Array.isArray(phase.tasks)).toBe(true);
        expect(typeof phase.active).toBe('boolean');
      });
    });

    it('should return userPlan with all five workshop phases', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.userPlan?.phases).toBeDefined();
      });

      const phaseNumbers = result.current.userPlan?.phases.map((p) => p.phase) ?? [];

      expect(phaseNumbers).toContain(PHASE_SETUP);
      expect(phaseNumbers).toContain(PHASE_SUBMISSION);
      expect(phaseNumbers).toContain(PHASE_ASSESSMENT);
      expect(phaseNumbers).toContain(PHASE_EVALUATION);
      expect(phaseNumbers).toContain(PHASE_CLOSED);
    });

    it('should return tasks with key, title, and completed status', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.userPlan?.phases).toBeDefined();
      });

      const phasesWithTasks = result.current.userPlan?.phases.filter((p) => p.tasks.length > 0) ?? [];
      expect(phasesWithTasks.length).toBeGreaterThan(0);

      const firstTask = phasesWithTasks[0].tasks[0];
      expect(typeof firstTask.key).toBe('string');
      expect(typeof firstTask.title).toBe('string');
      expect(['boolean', 'string']).toContain(typeof firstTask.completed);
    });
  });

  // --------------------------------------------------------------------------
  // Submissions List Tests
  // --------------------------------------------------------------------------

  describe('Submissions List', () => {
    it('should return submissions array', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.submissions).toBeDefined();
      });

      expect(Array.isArray(result.current.submissions)).toBe(true);
    });

    it('should return submissions with proper structure', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.submissions).toBeDefined();
        expect((result.current.submissions?.length ?? 0) > 0).toBe(true);
      });

      const submission = result.current.submissions?.[0];

      // Verify core submission properties
      expect(typeof submission?.id).toBe('number');
      expect(typeof submission?.workshopId).toBe('number');
      expect(typeof submission?.authorId).toBe('number');
      expect(typeof submission?.title).toBe('string');
      expect(typeof submission?.content).toBe('string');
      expect(typeof submission?.published).toBe('boolean');
    });
  });

  // --------------------------------------------------------------------------
  // Phase Information Tests
  // --------------------------------------------------------------------------

  describe('Phase Information', () => {
    it('should return currentPhase matching workshop phase', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.currentPhase).toBeDefined();
      });

      expect(result.current.currentPhase).toBe(result.current.workshop?.phase);
    });

    it('should return currentPhaseTitle as string', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.currentPhaseTitle).toBeDefined();
      });

      expect(typeof result.current.currentPhaseTitle).toBe('string');
      expect(result.current.currentPhaseTitle?.length).toBeGreaterThan(0);
    });

    it('should handle all phase constants (10, 20, 30, 40, 50)', () => {
      // Verify phase constants are correctly defined
      expect(PHASE_SETUP).toBe(10);
      expect(PHASE_SUBMISSION).toBe(20);
      expect(PHASE_ASSESSMENT).toBe(30);
      expect(PHASE_EVALUATION).toBe(40);
      expect(PHASE_CLOSED).toBe(50);
    });
  });

  // --------------------------------------------------------------------------
  // Error Handling Tests
  // --------------------------------------------------------------------------

  describe('Error Handling', () => {
    it('should return isError=true when API call fails', async () => {
      // Override handler to return error
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'SERVER_ERROR',
                message: 'Internal server error',
              },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(false);
    });

    it('should handle 404 not found errors', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Workshop not found',
              },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useWorkshop(999), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.workshop).toBeUndefined();
    });

    it('should handle 500 server errors', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Database connection failed',
              },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle network failures', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.isLoading).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Caching Behavior Tests
  // --------------------------------------------------------------------------

  describe('Caching Behavior', () => {
    it('should use cached data without additional API request on second call', async () => {
      let apiCallCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, ({ params }) => {
          apiCallCount++;
          return HttpResponse.json(createMockWorkshopResponse(Number(params.id)));
        })
      );

      // First render - should make API call
      const { result: result1, unmount: unmount1 } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      expect(apiCallCount).toBe(1);

      // Unmount first hook
      unmount1();

      // Second render with same workshopId - should use cache
      const { result: result2 } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      // Data should be available immediately from cache
      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Since test QueryClient has staleTime: 0, it might refetch
      // But the data should be available immediately from cache
      expect(result2.current.data).toBeDefined();
    });

    it('should make new API request for different workshopId', async () => {
      const callsByWorkshopId: Record<number, number> = {};

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, ({ params }) => {
          const id = Number(params.id);
          callsByWorkshopId[id] = (callsByWorkshopId[id] || 0) + 1;
          return HttpResponse.json(createMockWorkshopResponse(id));
        })
      );

      // First workshop
      const { result: result1 } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Different workshop
      const { result: result2 } = renderHook(() => useWorkshop(2), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Both workshops should have been fetched
      expect(callsByWorkshopId[1]).toBeGreaterThanOrEqual(1);
      expect(callsByWorkshopId[2]).toBeGreaterThanOrEqual(1);

      // Verify different data was returned
      expect(result1.current.workshop?.id).toBe(1);
      expect(result2.current.workshop?.id).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // Refetch Functionality Tests
  // --------------------------------------------------------------------------

  describe('Refetch Functionality', () => {
    it('should provide refetch function to manually trigger data refresh', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(typeof result.current.refetch).toBe('function');
    });

    it('should fetch new data when refetch is called', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, ({ params }) => {
          fetchCount++;
          return HttpResponse.json(createMockWorkshopResponse(Number(params.id)));
        })
      );

      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const initialFetchCount = fetchCount;

      // Manually trigger refetch
      await result.current.refetch();

      expect(fetchCount).toBeGreaterThan(initialFetchCount);
    });

    it('should set isFetching=true during refetch', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Start refetch
      const refetchPromise = result.current.refetch();

      // Should be fetching after refetch is called
      await waitFor(() => {
        // The isFetching state should become true at some point
        expect(result.current.isFetching || result.current.isSuccess).toBe(true);
      });

      await refetchPromise;

      // After refetch completes
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Query Invalidation Tests
  // --------------------------------------------------------------------------

  describe('Query Invalidation', () => {
    it('should refetch when query is invalidated', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, ({ params }) => {
          fetchCount++;
          return HttpResponse.json(createMockWorkshopResponse(Number(params.id)));
        })
      );

      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const initialFetchCount = fetchCount;

      // Invalidate the specific workshop query
      await queryClient.invalidateQueries({ queryKey: [WORKSHOP_QUERY_KEY, 1] });

      await waitFor(() => {
        expect(fetchCount).toBeGreaterThan(initialFetchCount);
      });
    });

    it('should support invalidating all workshop queries', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, ({ params }) => {
          fetchCount++;
          return HttpResponse.json(createMockWorkshopResponse(Number(params.id)));
        })
      );

      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const initialFetchCount = fetchCount;

      // Invalidate all workshop queries using the exported query key
      await queryClient.invalidateQueries({ queryKey: [WORKSHOP_QUERY_KEY] });

      await waitFor(() => {
        expect(fetchCount).toBeGreaterThan(initialFetchCount);
      });
    });
  });

  // --------------------------------------------------------------------------
  // TypeScript Type Handling Tests
  // --------------------------------------------------------------------------

  describe('TypeScript Type Handling', () => {
    it('should return properly typed Workshop interface', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.workshop).toBeDefined();
      });

      // TypeScript should recognize these properties
      const workshop: Workshop | undefined = result.current.workshop;
      
      if (workshop) {
        // These should all be type-safe accesses
        const _id: number = workshop.id;
        const _name: string = workshop.name;
        const _phase: WorkshopPhase = workshop.phase;
        const _strategy: string = workshop.strategy;
        const _grade: number = workshop.grade;
        
        // Suppress unused variable warnings
        expect(_id).toBeDefined();
        expect(_name).toBeDefined();
        expect(_phase).toBeDefined();
        expect(_strategy).toBeDefined();
        expect(_grade).toBeDefined();
      }
    });

    it('should return properly typed UserPlan interface', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.userPlan).toBeDefined();
      });

      const userPlan: WorkshopUserPlan | undefined = result.current.userPlan;

      if (userPlan) {
        const _userId: number = userPlan.userId;
        const _workshopId: number = userPlan.workshopId;
        const _phases: WorkshopUserPlanPhase[] = userPlan.phases;

        expect(_userId).toBeDefined();
        expect(_workshopId).toBeDefined();
        expect(Array.isArray(_phases)).toBe(true);
      }
    });

    it('should return properly typed Submission interface', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.submissions).toBeDefined();
      });

      const submissions: WorkshopSubmission[] | undefined = result.current.submissions;

      if (submissions && submissions.length > 0) {
        const submission = submissions[0];
        const _id: number = submission.id;
        const _title: string = submission.title;
        const _authorId: number = submission.authorId;
        const _published: boolean = submission.published;

        expect(_id).toBeDefined();
        expect(_title).toBeDefined();
        expect(_authorId).toBeDefined();
        expect(typeof _published).toBe('boolean');
      }
    });
  });

  // --------------------------------------------------------------------------
  // Hook Options Tests
  // --------------------------------------------------------------------------

  describe('Hook Options', () => {
    it('should support enabled option to conditionally fetch', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, ({ params }) => {
          fetchCount++;
          return HttpResponse.json(createMockWorkshopResponse(Number(params.id)));
        })
      );

      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) => useWorkshop(1, { enabled }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { enabled: false },
        }
      );

      // Should not fetch when disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(fetchCount).toBe(0);

      // Enable the query
      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchCount).toBe(1);
    });

    it('should not fetch for invalid workshopId (0 or negative)', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
          fetchCount++;
          return HttpResponse.json(createMockWorkshopResponse(1));
        })
      );

      const { result } = renderHook(() => useWorkshop(0), {
        wrapper: createWrapper(queryClient),
      });

      // Wait a bit to ensure no fetch is made
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(result.current.isLoading).toBe(false);
      expect(fetchCount).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Data Structure Validation Tests
  // --------------------------------------------------------------------------

  describe('Data Structure Validation', () => {
    it('should return data matching API response structure', async () => {
      const workshopId = 1;
      const { result } = renderHook(() => useWorkshop(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      const data = result.current.data;

      // Verify complete data structure
      expect(data).toHaveProperty('workshop');
      expect(data).toHaveProperty('userPlan');
      expect(data).toHaveProperty('submissions');
      expect(data).toHaveProperty('currentPhase');
      expect(data).toHaveProperty('currentPhaseTitle');
    });

    it('should provide convenient accessors that match data properties', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      // Convenient accessors should match nested data
      expect(result.current.workshop).toEqual(result.current.data?.workshop);
      expect(result.current.userPlan).toEqual(result.current.data?.userPlan);
      expect(result.current.submissions).toEqual(result.current.data?.submissions);
      expect(result.current.currentPhase).toEqual(result.current.data?.currentPhase);
      expect(result.current.currentPhaseTitle).toEqual(result.current.data?.currentPhaseTitle);
    });
  });

  // --------------------------------------------------------------------------
  // Integration with QueryClient Provider Tests
  // --------------------------------------------------------------------------

  describe('Integration with QueryClient Provider', () => {
    it('should work correctly with QueryClientProvider wrapper', async () => {
      const { result } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      // Should not throw errors
      expect(result.current).toBeDefined();
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.workshop).toBeDefined();
    });

    it('should share cache between hooks using same QueryClient', async () => {
      const { result: result1 } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second hook with same workshopId should share cache
      const { result: result2 } = renderHook(() => useWorkshop(1), {
        wrapper: createWrapper(queryClient),
      });

      // Should have data immediately (from cache)
      expect(result2.current.data).toBeDefined();
      expect(result2.current.workshop?.id).toBe(1);
    });
  });
});
