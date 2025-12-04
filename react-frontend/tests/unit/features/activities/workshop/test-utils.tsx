/* eslint-disable react-refresh/only-export-components */
/**
 * Test Utilities for Workshop Activity Module
 *
 * Provides comprehensive mock data factories, test wrappers, and MSW handlers
 * for testing workshop components, hooks, and API integration.
 *
 * Features:
 * - Mock data factories matching workshop phase constants and structures
 * - Test wrapper with QueryClient, Redux, Router, and MUI providers
 * - MSW handlers for API endpoint mocking
 * - Helper functions for complex test scenarios
 */

import type { ReactElement, ReactNode } from 'react';
import type { RenderResult, RenderOptions } from '@testing-library/react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as ReduxProvider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { configureStore } from '@reduxjs/toolkit';

import type {
  Workshop,
  WorkshopSubmission,
  WorkshopAssessment,
  WorkshopUserPlan,
  WorkshopUserPlanPhase,
  WorkshopUserPlanTask,
  AssessmentDimension,
  DimensionGrade,
  AllocationResult,
  WorkshopPhase,
  GradingStrategy,
} from '@/features/activities/workshop/types/workshop.types';
import type { AuthState } from '@/features/auth/store/authSlice';
import { AuthStatus } from '@/features/auth/types/auth.types';

/**
 * Workshop phase constants matching Moodle's workshop module
 */
export const WORKSHOP_PHASE = {
  SETUP: 10,
  SUBMISSION: 20,
  ASSESSMENT: 30,
  EVALUATION: 40,
  CLOSED: 50,
} as const;

/**
 * Workshop grading strategies
 */
export const GRADING_STRATEGIES = {
  ACCUMULATIVE: 'accumulative',
  RUBRIC: 'rubric',
  COMMENTS: 'comments',
  NUMERRORS: 'numerrors',
} as const;

/**
 * Examples mode constants
 */
export const EXAMPLES_MODE = {
  VOLUNTARY: 0,
  BEFORE_SUBMISSION: 1,
  BEFORE_ASSESSMENT: 2,
} as const;

/**
 * API base URL for MSW handlers
 */
const API_BASE_URL = '/api/v1';

/**
 * Creates a mock workshop instance with default values
 */
export function createMockWorkshop(overrides?: Partial<Workshop>): Workshop {
  const now = Math.floor(Date.now() / 1000);
  const oneDay = 86400;

  return {
    id: 1,
    courseId: 10,
    name: 'Test Workshop',
    intro: '<p>This is a test workshop for peer assessment</p>',
    introFormat: 1,
    instructAuthors: '<p>Instructions for authors</p>',
    instructAuthorsFormat: 1,
    instructReviewers: '<p>Instructions for reviewers</p>',
    instructReviewersFormat: 1,
    phase: WORKSHOP_PHASE.SUBMISSION,
    strategy: GRADING_STRATEGIES.ACCUMULATIVE,
    evaluation: 'best',
    grade: 100,
    gradingGrade: 20,
    gradeDecimals: 0,
    submissionStart: now - oneDay,
    submissionEnd: now + oneDay * 7,
    assessmentStart: now + oneDay * 7,
    assessmentEnd: now + oneDay * 14,
    phaseSwitchAssessment: true,
    useExamples: true,
    examplesMode: EXAMPLES_MODE.BEFORE_SUBMISSION,
    usePeerAssessment: true,
    useSelfAssessment: false,
    lateSubmissions: true,
    maxBytes: 1048576, // 1MB
    nAttachments: 3,
    submissionFileTypes: '.pdf,.doc,.docx',
    overallFeedbackMode: 1,
    overallFeedbackFiles: 1,
    overallFeedbackFileTypes: '.pdf',
    conclusion: '<p>Workshop conclusion</p>',
    conclusionFormat: 1,
    timeCreated: now - oneDay * 30,
    timeModified: now - oneDay,
    ...overrides,
  };
}

/**
 * Creates a mock workshop submission
 */
export function createMockSubmission(
  overrides?: Partial<WorkshopSubmission>
): WorkshopSubmission {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: 1,
    workshopId: 1,
    example: false,
    authorId: 100,
    authorFirstName: 'John',
    authorLastName: 'Student',
    authorEmail: 'john.student@example.com',
    authorPicture: 0,
    title: 'My Workshop Submission',
    content: '<p>This is my submission content with detailed analysis</p>',
    contentFormat: 1,
    contentTrust: true,
    attachment: 0,
    grade: null,
    gradingGrade: null,
    gradeOver: null,
    gradingGradeOver: null,
    feedbackAuthor: null,
    feedbackAuthorFormat: 1,
    timeCreated: now - 3600,
    timeModified: now - 1800,
    published: false,
    late: false,
    url: '/mod/workshop/submission.php?cmid=1&id=1',
    ...overrides,
  };
}

/**
 * Creates a mock workshop assessment
 */
export function createMockAssessment(
  overrides?: Partial<WorkshopAssessment>
): WorkshopAssessment {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: 1,
    submissionId: 1,
    reviewerId: 101,
    reviewerFirstName: 'Jane',
    reviewerLastName: 'Reviewer',
    weight: 1,
    grade: null,
    gradingGrade: null,
    gradingGradeOver: null,
    feedbackAuthor: null,
    feedbackAuthorFormat: 1,
    feedbackAuthorAttachment: 0,
    feedbackReviewer: null,
    feedbackReviewerFormat: 1,
    timeCreated: now - 1800,
    timeModified: now - 900,
    url: '/mod/workshop/assessment.php?asid=1',
    ...overrides,
  };
}

/**
 * Creates a mock assessment dimension
 */
export function createMockDimension(
  overrides?: Partial<AssessmentDimension>
): AssessmentDimension {
  return {
    id: 1,
    workshopId: 1,
    sort: 1,
    description: '<p>Quality of analysis</p>',
    descriptionFormat: 1,
    grade: 20,
    weight: 1,
    strategy: GRADING_STRATEGIES.ACCUMULATIVE,
    ...overrides,
  };
}

/**
 * Creates a mock dimension grade
 */
export function createMockDimensionGrade(
  overrides?: Partial<DimensionGrade>
): DimensionGrade {
  return {
    dimensionId: 1,
    grade: 15,
    peerComment: 'Good analysis with room for improvement',
    peerCommentFormat: 1,
    ...overrides,
  };
}

/**
 * Creates a mock user plan task
 */
export function createMockUserPlanTask(
  overrides?: Partial<WorkshopUserPlanTask>
): WorkshopUserPlanTask {
  return {
    key: 'submit',
    title: 'Submit your work',
    link: '/mod/workshop/submission.php?cmid=1',
    completed: false,
    details: 'Upload your assignment before the deadline',
    ...overrides,
  };
}

/**
 * Creates a mock user plan phase
 */
export function createMockUserPlanPhase(
  overrides?: Partial<WorkshopUserPlanPhase>
): WorkshopUserPlanPhase {
  return {
    phase: WORKSHOP_PHASE.SUBMISSION,
    title: 'Submission phase',
    tasks: [
      createMockUserPlanTask({ key: 'submit', completed: false }),
      createMockUserPlanTask({
        key: 'assess_examples',
        title: 'Assess example submissions',
        completed: true,
      }),
    ],
    active: true,
    ...overrides,
  };
}

/**
 * Creates a mock user plan with all phases
 */
export function createMockUserPlan(
  overrides?: Partial<WorkshopUserPlan>
): WorkshopUserPlan {
  return {
    userId: 100,
    workshopId: 1,
    phases: [
      createMockUserPlanPhase({
        phase: WORKSHOP_PHASE.SETUP,
        title: 'Setup phase',
        tasks: [],
        active: false,
      }),
      createMockUserPlanPhase({
        phase: WORKSHOP_PHASE.SUBMISSION,
        title: 'Submission phase',
        active: true,
      }),
      createMockUserPlanPhase({
        phase: WORKSHOP_PHASE.ASSESSMENT,
        title: 'Assessment phase',
        tasks: [
          createMockUserPlanTask({
            key: 'assess_peers',
            title: 'Assess peer submissions',
            completed: false,
          }),
        ],
        active: false,
      }),
      createMockUserPlanPhase({
        phase: WORKSHOP_PHASE.EVALUATION,
        title: 'Evaluation phase',
        tasks: [],
        active: false,
      }),
      createMockUserPlanPhase({
        phase: WORKSHOP_PHASE.CLOSED,
        title: 'Closed',
        tasks: [],
        active: false,
      }),
    ],
    examples: [],
    ...overrides,
  };
}

/**
 * Creates mock allocation result
 */
export function createMockAllocation(
  overrides?: Partial<AllocationResult>
): AllocationResult {
  return {
    success: true,
    allocated: 5,
    message: 'Successfully allocated 5 assessments',
    ...overrides,
  };
}

/**
 * Creates mock grading strategy configuration
 * Returns dimensions array based on strategy type
 */
export function createMockGradingStrategy(
  strategy: GradingStrategy,
  count: number = 3
): AssessmentDimension[] {
  const dimensions: AssessmentDimension[] = [];

  for (let i = 0; i < count; i++) {
    let description = '';
    let grade = 20;

    switch (strategy) {
      case GRADING_STRATEGIES.ACCUMULATIVE:
        description = `<p>Criterion ${i + 1}: Quality of work</p>`;
        grade = 20;
        break;
      case GRADING_STRATEGIES.RUBRIC:
        description = `<p>Rubric level ${i + 1}</p>`;
        grade = 10 * (i + 1);
        break;
      case GRADING_STRATEGIES.COMMENTS:
        description = `<p>Aspect ${i + 1} for comment</p>`;
        grade = 0;
        break;
      case GRADING_STRATEGIES.NUMERRORS:
        description = `<p>Error type ${i + 1}</p>`;
        grade = 1;
        break;
    }

    dimensions.push(
      createMockDimension({
        id: i + 1,
        sort: i + 1,
        description,
        grade,
        strategy,
      })
    );
  }

  return dimensions;
}

/**
 * Helper: Creates submission with file attachments
 */
export function mockSubmissionWithFiles(
  fileCount: number = 2
): WorkshopSubmission {
  return createMockSubmission({
    attachment: fileCount,
    title: `Submission with ${fileCount} files`,
    content: '<p>Submission content with attached files</p>',
  });
}

/**
 * Helper: Creates assessment with dimension grades
 */
export function mockAssessmentWithDimensions(
  dimensionCount: number = 3,
  strategy: GradingStrategy = GRADING_STRATEGIES.ACCUMULATIVE
): { assessment: WorkshopAssessment; dimensions: DimensionGrade[] } {
  const dimensions: DimensionGrade[] = [];
  let totalGrade = 0;

  for (let i = 0; i < dimensionCount; i++) {
    const grade = strategy === GRADING_STRATEGIES.COMMENTS ? null : 15 + i * 2;
    dimensions.push(
      createMockDimensionGrade({
        dimensionId: i + 1,
        grade,
        peerComment: `Feedback for dimension ${i + 1}`,
      })
    );
    if (grade !== null) {
      totalGrade += grade;
    }
  }

  const assessment = createMockAssessment({
    grade: strategy === GRADING_STRATEGIES.COMMENTS ? null : totalGrade,
    feedbackAuthor: '<p>Overall feedback for author</p>',
  });

  return { assessment, dimensions };
}

/**
 * Helper: Simulates workshop phase transition
 */
export function mockWorkshopPhaseTransition(
  fromPhase: WorkshopPhase,
  toPhase: WorkshopPhase
): Workshop {
  const workshop = createMockWorkshop({ phase: fromPhase });
  return { ...workshop, phase: toPhase };
}

/**
 * Creates a test-specific QueryClient with no retries and no caching
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Creates a test-specific Redux store
 */
function createTestStore() {
  const mockAuthState: AuthState = {
    user: { 
      id: 100, 
      username: 'testuser',
      email: 'test@example.com', 
      firstname: 'Test',
      lastname: 'User',
      fullname: 'Test User',
      auth: 'manual',
      confirmed: true,
      suspended: false,
      roles: [{ id: 5, shortname: 'student', name: 'Student' }],
      capabilities: []
    },
    tokens: { 
      accessToken: 'test-access-token', 
      refreshToken: 'test-refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer'
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    status: AuthStatus.AUTHENTICATED,
  };

  return configureStore({
    reducer: {
      auth: (state: AuthState = mockAuthState): AuthState => state,
    },
  });
}

/**
 * Creates a test theme
 */
function createTestTheme() {
  return createTheme({
    palette: {
      mode: 'light',
    },
  });
}

/**
 * Test wrapper component with all necessary providers
 */
interface TestProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
  store?: ReturnType<typeof createTestStore>;
  initialRoutes?: string[];
}

function TestProviders({
  children,
  queryClient,
  store,
  initialRoutes = ['/'],
}: TestProvidersProps): ReactElement {
  const testQueryClient = queryClient || createTestQueryClient();
  const testStore = store || createTestStore();
  const theme = createTestTheme();

  return (
    <ReduxProvider store={testStore}>
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter initialEntries={initialRoutes}>
          <ThemeProvider theme={theme}>{children}</ThemeProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ReduxProvider>
  );
}

/**
 * Custom render function with all providers
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  store?: ReturnType<typeof createTestStore>;
  initialRoutes?: string[];
}

export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult {
  const { queryClient, store, initialRoutes, ...renderOptions } = options || {};

  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <TestProviders
        queryClient={queryClient}
        store={store}
        initialRoutes={initialRoutes}
      >
        {children}
      </TestProviders>
    ),
    ...renderOptions,
  });
}

/**
 * Sets up MSW handlers for workshop API endpoints
 */
export function setupWorkshopHandlers(workshopId: number = 1) {
  const mockWorkshop = createMockWorkshop({ id: workshopId });
  const mockSubmissions = [
    createMockSubmission({ id: 1, workshopId }),
    createMockSubmission({ id: 2, workshopId, authorId: 101, title: 'Second Submission' }),
  ];
  const mockAssessments = [
    createMockAssessment({ id: 1, submissionId: 1 }),
    createMockAssessment({ id: 2, submissionId: 2 }),
  ];
  const mockUserPlan = createMockUserPlan({ workshopId });
  const mockDimensions = createMockGradingStrategy(GRADING_STRATEGIES.ACCUMULATIVE, 3);

  return [
    // GET workshop details
    http.get(`${API_BASE_URL}/workshops/:id`, ({ params }) => {
      const { id } = params;
      if (Number(id) === workshopId) {
        return HttpResponse.json({
          success: true,
          data: mockWorkshop,
        });
      }
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Workshop not found' },
        },
        { status: 404 }
      );
    }),

    // GET workshop submissions
    http.get(`${API_BASE_URL}/workshops/:id/submissions`, ({ params }) => {
      const { id } = params;
      if (Number(id) === workshopId) {
        return HttpResponse.json({
          success: true,
          data: mockSubmissions,
          meta: { pagination: { total: mockSubmissions.length } },
        });
      }
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Workshop not found' },
        },
        { status: 404 }
      );
    }),

    // POST create submission
    http.post(`${API_BASE_URL}/workshops/:id/submissions`, async ({ request, params }) => {
      const { id } = params;
      if (Number(id) === workshopId) {
        const body = await request.json();
        const newSubmission = createMockSubmission({
          id: 100,
          workshopId: Number(id),
          ...(body as Partial<WorkshopSubmission>),
        });
        return HttpResponse.json({
          success: true,
          data: newSubmission,
        });
      }
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'PERMISSION_DENIED', message: 'Cannot create submission' },
        },
        { status: 403 }
      );
    }),

    // GET submission details
    http.get(`${API_BASE_URL}/workshops/submissions/:submissionId`, ({ params }) => {
      const { submissionId } = params;
      const submission = mockSubmissions.find((s) => s.id === Number(submissionId));
      if (submission) {
        return HttpResponse.json({
          success: true,
          data: submission,
        });
      }
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Submission not found' },
        },
        { status: 404 }
      );
    }),

    // GET submission assessments
    http.get(`${API_BASE_URL}/workshops/submissions/:submissionId/assessments`, ({ params }) => {
      const { submissionId } = params;
      const assessments = mockAssessments.filter((a) => a.submissionId === Number(submissionId));
      return HttpResponse.json({
        success: true,
        data: assessments,
      });
    }),

    // POST create assessment
    http.post(
      `${API_BASE_URL}/workshops/submissions/:submissionId/assessments`,
      async ({ request, params }) => {
        const { submissionId } = params;
        const body = await request.json();
        const newAssessment = createMockAssessment({
          id: 100,
          submissionId: Number(submissionId),
          ...(body as Partial<WorkshopAssessment>),
        });
        return HttpResponse.json({
          success: true,
          data: newAssessment,
        });
      }
    ),

    // GET user plan
    http.get(`${API_BASE_URL}/workshops/:id/userplan`, ({ params }) => {
      const { id } = params;
      if (Number(id) === workshopId) {
        return HttpResponse.json({
          success: true,
          data: mockUserPlan,
        });
      }
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Workshop not found' },
        },
        { status: 404 }
      );
    }),

    // GET grading dimensions
    http.get(`${API_BASE_URL}/workshops/:id/dimensions`, ({ params }) => {
      const { id } = params;
      if (Number(id) === workshopId) {
        return HttpResponse.json({
          success: true,
          data: mockDimensions,
        });
      }
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Workshop not found' },
        },
        { status: 404 }
      );
    }),

    // POST phase transition
    http.post(`${API_BASE_URL}/workshops/:id/phase`, async ({ request, params }) => {
      const { id } = params;
      if (Number(id) === workshopId) {
        const body = (await request.json()) as { phase: WorkshopPhase };
        const updatedWorkshop = { ...mockWorkshop, phase: body.phase };
        return HttpResponse.json({
          success: true,
          data: updatedWorkshop,
        });
      }
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'PERMISSION_DENIED', message: 'Cannot change phase' },
        },
        { status: 403 }
      );
    }),

    // POST allocate assessments
    http.post(`${API_BASE_URL}/workshops/:id/allocate`, ({ params }) => {
      const { id } = params;
      if (Number(id) === workshopId) {
        return HttpResponse.json({
          success: true,
          data: createMockAllocation(),
        });
      }
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'PERMISSION_DENIED', message: 'Cannot allocate assessments' },
        },
        { status: 403 }
      );
    }),

    // GET assessment details
    http.get(`${API_BASE_URL}/workshops/assessments/:assessmentId`, ({ params }) => {
      const { assessmentId } = params;
      const assessment = mockAssessments.find((a) => a.id === Number(assessmentId));
      if (assessment) {
        return HttpResponse.json({
          success: true,
          data: assessment,
        });
      }
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Assessment not found' },
        },
        { status: 404 }
      );
    }),

    // PUT update assessment
    http.put(`${API_BASE_URL}/workshops/assessments/:assessmentId`, async ({ request, params }) => {
      const { assessmentId } = params;
      const body = await request.json();
      const assessment = mockAssessments.find((a) => a.id === Number(assessmentId));
      if (assessment) {
        const updatedAssessment = { ...assessment, ...(body as Partial<WorkshopAssessment>) };
        return HttpResponse.json({
          success: true,
          data: updatedAssessment,
        });
      }
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Assessment not found' },
        },
        { status: 404 }
      );
    }),

    // Error simulation handler
    http.get(`${API_BASE_URL}/workshops/error`, () => {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Simulated server error' },
        },
        { status: 500 }
      );
    }),
  ];
}

/**
 * Creates MSW server instance with workshop handlers
 */
export function createWorkshopMockServer(workshopId: number = 1) {
  return setupServer(...setupWorkshopHandlers(workshopId));
}

/**
 * Exports for convenience
 */
export { createTestQueryClient, createTestStore, createTestTheme };
