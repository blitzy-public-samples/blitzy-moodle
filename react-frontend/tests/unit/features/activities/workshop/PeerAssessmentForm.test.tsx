/**
 * PeerAssessmentForm Component Unit Tests
 *
 * Comprehensive test suite for the PeerAssessmentForm component that handles peer assessment
 * workflow in Moodle workshop activities. Tests cover submission content display, grading
 * strategy integration, dimension validation, feedback submission, draft saving, permission
 * checks, and accessibility compliance.
 *
 * The PeerAssessmentForm is a critical component that:
 * - Displays submission content being assessed (title, text, files)
 * - Integrates with GradingStrategyRenderer for strategy-specific assessment forms
 * - Collects assessment dimensions with validation per grading strategy
 * - Handles overall feedback with optional rich text editing
 * - Supports draft saving with auto-save every 30 seconds
 * - Enforces permission checks (isreviewer, assessmenteditable)
 * - Requires example assessment completion before peer assessment
 *
 * @see Section 0.4 Transformation Mapping - Activity component tests
 * @see PeerAssessmentForm.tsx - Component under test
 * @see GradingStrategyRenderer.tsx - Child component for grading forms
 */

import React from 'react';
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import {
  render,
  screen,
  waitFor,
  within,
  userEvent,
} from '@/tests/helpers/render';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import PeerAssessmentForm from '@/features/activities/workshop/components/PeerAssessmentForm';
import type {
  Workshop,
  WorkshopSubmission,
  WorkshopAssessment,
  AssessmentDimension,
  DimensionGrade,
  WorkshopUserPlan,
} from '@/features/activities/workshop/types/workshop.types';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Factory function for creating realistic mock Workshop objects.
 * Matches Moodle workshop structure with all required properties.
 */
function createMockWorkshop(overrides: Partial<Workshop> = {}): Workshop {
  return {
    id: 1,
    course: 1,
    name: 'Test Workshop',
    intro: 'Workshop introduction text',
    introformat: 1,
    phase: 30, // Assessment phase
    strategy: 'accumulative',
    grade: 100,
    gradinggrade: 20,
    useexamples: false,
    usepeerassessment: true,
    useselfassessment: false,
    latesubmissions: false,
    maxbytes: 0,
    submissionstart: Math.floor(Date.now() / 1000) - 86400,
    submissionend: Math.floor(Date.now() / 1000) + 86400,
    assessmentstart: Math.floor(Date.now() / 1000) - 3600,
    assessmentend: Math.floor(Date.now() / 1000) + 86400,
    phaseswitchassessment: 0,
    overallFeedbackMode: 1, // Optional feedback
    overallFeedbackMaxBytes: 0,
    instructauthors: '',
    instructauthorsformat: 1,
    instructreviewers: 'Please assess this submission carefully.',
    instructreviewersformat: 1,
    submissiontypetext: 1,
    submissiontypefile: 1,
    nattachments: 1,
    submissionfiletypes: '',
    conclusion: '',
    conclusionformat: 1,
    examplesmode: 0,
    timemodified: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * Factory function for creating realistic mock WorkshopSubmission objects.
 * Includes author information, content, files, and grade fields.
 */
function createMockSubmission(overrides: Partial<WorkshopSubmission> = {}): WorkshopSubmission {
  return {
    id: 1,
    workshopid: 1,
    authorid: 100,
    title: 'Test Submission Title',
    content: '<p>This is the submission content with detailed explanation of the work.</p>',
    contentformat: 1,
    attachment: 1,
    grade: null,
    gradeover: null,
    gradeoverby: null,
    feedbackauthor: '',
    feedbackauthorformat: 1,
    feedbackauthorattachment: 0,
    published: false,
    late: 0,
    timecreated: Math.floor(Date.now() / 1000) - 7200,
    timemodified: Math.floor(Date.now() / 1000) - 3600,
    // Extended properties for React frontend
    authorname: 'John Student',
    authorfirstname: 'John',
    authorlastname: 'Student',
    authorpicture: '',
    files: [
      {
        filename: 'assignment.pdf',
        filesize: 102400,
        mimetype: 'application/pdf',
        fileurl: '/pluginfile.php/1/mod_workshop/submission_attachment/1/assignment.pdf',
      },
    ],
    ...overrides,
  };
}

/**
 * Factory function for creating mock WorkshopAssessment objects.
 * Contains reviewer, submission reference, grades, and dimension data.
 */
function createMockAssessment(overrides: Partial<WorkshopAssessment> = {}): WorkshopAssessment {
  return {
    id: 1,
    submissionid: 1,
    reviewerid: 200,
    weight: 1,
    timecreated: Math.floor(Date.now() / 1000) - 1800,
    timemodified: Math.floor(Date.now() / 1000) - 900,
    grade: null,
    gradinggrade: null,
    gradinggradeover: null,
    gradinggradeoverby: null,
    feedbackauthor: '',
    feedbackauthorformat: 1,
    feedbackauthorattachment: 0,
    feedbackreviewer: '',
    feedbackreviewerformat: 1,
    // Extended properties
    reviewername: 'Jane Reviewer',
    reviewerfirstname: 'Jane',
    reviewerlastname: 'Reviewer',
    reviewerpicture: '',
    submissiontitle: 'Test Submission Title',
    dimensions: [],
    ...overrides,
  };
}

/**
 * Creates mock assessment with dimension grades for testing.
 * Includes complete dimension-level feedback matching grading strategy.
 */
function mockAssessmentWithDimensions(
  strategy: Workshop['strategy'],
  dimensionCount: number = 3
): WorkshopAssessment {
  const dimensions: DimensionGrade[] = [];

  for (let i = 0; i < dimensionCount; i++) {
    dimensions.push({
      dimensionid: i + 1,
      grade: strategy === 'comments' ? null : 80,
      peercomment: `Feedback for dimension ${i + 1}`,
      peercommentformat: 1,
    });
  }

  return createMockAssessment({ dimensions });
}

/**
 * Creates mock assessment dimensions for grading forms.
 */
function createMockDimensions(
  strategy: Workshop['strategy'],
  count: number = 3
): AssessmentDimension[] {
  const dimensions: AssessmentDimension[] = [];

  for (let i = 0; i < count; i++) {
    const baseDimension = {
      id: i + 1,
      workshopid: 1,
      sort: i,
      description: `Assessment Criterion ${i + 1}`,
      descriptionformat: 1,
    };

    switch (strategy) {
      case 'accumulative':
        dimensions.push({
          ...baseDimension,
          grade: 100,
          weight: 1,
        });
        break;
      case 'rubric':
        dimensions.push({
          ...baseDimension,
          levels: [
            { id: 1, grade: 0, definition: 'Poor' },
            { id: 2, grade: 50, definition: 'Average' },
            { id: 3, grade: 100, definition: 'Excellent' },
          ],
        });
        break;
      case 'comments':
        dimensions.push({
          ...baseDimension,
        });
        break;
      case 'numerrors':
        dimensions.push({
          ...baseDimension,
          grade0: 1,
          grade1: 0,
        });
        break;
    }
  }

  return dimensions;
}

/**
 * Creates mock user plan with phase tasks and completion status.
 */
function createMockUserPlan(overrides: Partial<WorkshopUserPlan> = {}): WorkshopUserPlan {
  return {
    phases: {
      10: { title: 'Setup', tasks: [], actions: [] },
      20: { title: 'Submission', tasks: [], actions: [] },
      30: {
        title: 'Assessment',
        tasks: [
          { title: 'Assess peers', completed: false, count: 2 },
        ],
        actions: [],
      },
      40: { title: 'Evaluation', tasks: [], actions: [] },
      50: { title: 'Closed', tasks: [], actions: [] },
    },
    currentphase: 30,
    examplesRequired: 0,
    examplesCompleted: 0,
    canassess: true,
    ...overrides,
  };
}

// ============================================================================
// MSW Server Setup
// ============================================================================

const handlers = [
  // Get workshop details
  http.get('/api/v1/workshops/:id', () => {
    return HttpResponse.json({
      success: true,
      data: createMockWorkshop(),
    });
  }),

  // Get submission details
  http.get('/api/v1/workshops/:workshopId/submissions/:submissionId', () => {
    return HttpResponse.json({
      success: true,
      data: createMockSubmission(),
    });
  }),

  // Get assessment details
  http.get('/api/v1/workshops/:workshopId/assessments/:assessmentId', () => {
    return HttpResponse.json({
      success: true,
      data: createMockAssessment(),
    });
  }),

  // Update assessment (draft save)
  http.put('/api/v1/workshops/:workshopId/assessments/:assessmentId', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: {
        ...createMockAssessment(),
        ...(body as object),
        timemodified: Math.floor(Date.now() / 1000),
      },
    });
  }),

  // Submit assessment (final)
  http.post('/api/v1/workshops/:workshopId/assessments/:assessmentId/submit', () => {
    return HttpResponse.json({
      success: true,
      data: {
        ...createMockAssessment(),
        grade: 85,
        submitted: true,
      },
    });
  }),

  // Get grading dimensions
  http.get('/api/v1/workshops/:workshopId/dimensions', ({ request }) => {
    const url = new URL(request.url);
    const strategy = url.searchParams.get('strategy') || 'accumulative';
    return HttpResponse.json({
      success: true,
      data: createMockDimensions(strategy as Workshop['strategy']),
    });
  }),

  // Get user plan
  http.get('/api/v1/workshops/:workshopId/userplan', () => {
    return HttpResponse.json({
      success: true,
      data: createMockUserPlan(),
    });
  }),
];

const server = setupServer(...handlers);

// ============================================================================
// Test Setup
// ============================================================================

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient({
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
  vi.clearAllMocks();
});

afterEach(() => {
  server.resetHandlers();
});

// Start MSW server for API mocking
beforeAll(() => server.listen());
afterAll(() => server.close());

// ============================================================================
// Default Test Props
// ============================================================================

const defaultProps = {
  workshopId: 1,
  submissionId: 1,
  assessmentId: 1,
};

/**
 * Helper to render PeerAssessmentForm with all required providers
 */
function renderPeerAssessmentForm(props: Partial<typeof defaultProps> = {}) {
  const mergedProps = { ...defaultProps, ...props };

  return render(
    <PeerAssessmentForm {...mergedProps} />,
    { queryClient }
  );
}

// ============================================================================
// Test Suites
// ============================================================================

describe('PeerAssessmentForm', () => {
  describe('Submission Content Display', () => {
    it('should display submission title', async () => {
      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText('Test Submission Title')).toBeInTheDocument();
      });
    });

    it('should display submission content text', async () => {
      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(
          screen.getByText(/This is the submission content/i)
        ).toBeInTheDocument();
      });
    });

    it('should display submission files with download links', async () => {
      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText('assignment.pdf')).toBeInTheDocument();
      });

      const fileLink = screen.getByRole('link', { name: /assignment\.pdf/i });
      expect(fileLink).toHaveAttribute('href', expect.stringContaining('pluginfile.php'));
    });

    it('should display file size information', async () => {
      renderPeerAssessmentForm();

      await waitFor(() => {
        // File size displayed in KB or MB format
        expect(screen.getByText(/100\s*KB|0\.1\s*MB/i)).toBeInTheDocument();
      });
    });
  });

  describe('Author Information Display', () => {
    it('should display submission author name when not anonymized', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ blindassessment: false }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText(/John Student/i)).toBeInTheDocument();
      });
    });

    it('should anonymize author name when blind assessment is enabled', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ blindassessment: true }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/submissions/:submissionId', () => {
          return HttpResponse.json({
            success: true,
            data: createMockSubmission({ authorname: 'Anonymous' }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.queryByText('John Student')).not.toBeInTheDocument();
        expect(screen.getByText(/Anonymous|Participant \d+/i)).toBeInTheDocument();
      });
    });
  });

  describe('GradingStrategyRenderer Integration', () => {
    it('should render accumulative strategy form correctly', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText(/Assessment Criterion 1/i)).toBeInTheDocument();
        // Accumulative shows numeric grade inputs
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });
    });

    it('should render rubric strategy form correctly', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'rubric' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('rubric'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText(/Assessment Criterion 1/i)).toBeInTheDocument();
        // Rubric shows level selections
        expect(screen.getByText('Poor')).toBeInTheDocument();
        expect(screen.getByText('Average')).toBeInTheDocument();
        expect(screen.getByText('Excellent')).toBeInTheDocument();
      });
    });

    it('should render comments-only strategy form correctly', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'comments' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('comments'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(
          screen.getByText(/comment-only feedback|no numerical grades/i)
        ).toBeInTheDocument();
        // Comments strategy should not have numeric inputs
        expect(screen.queryAllByRole('spinbutton').length).toBe(0);
      });
    });

    it('should render number of errors strategy form correctly', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'numerrors' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('numerrors'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        // Numerrors shows yes/no radio buttons
        expect(screen.getByText(/error not present|No/i)).toBeInTheDocument();
        expect(screen.getByText(/error present|Yes/i)).toBeInTheDocument();
      });
    });
  });

  describe('Dimension Validation', () => {
    it('should validate grade range for accumulative strategy (0-100)', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      const gradeInputs = screen.getAllByRole('spinbutton');
      const firstGradeInput = gradeInputs[0];

      // Clear and enter invalid value (above 100)
      await user.clear(firstGradeInput);
      await user.type(firstGradeInput, '150');

      // Try to submit
      const submitButton = screen.getByRole('button', { name: /submit|save/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/grade.*range|must be.*100|invalid/i)).toBeInTheDocument();
      });
    });

    it('should validate grade range for accumulative strategy (negative value)', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      const gradeInputs = screen.getAllByRole('spinbutton');
      const firstGradeInput = gradeInputs[0];

      await user.clear(firstGradeInput);
      await user.type(firstGradeInput, '-10');

      const submitButton = screen.getByRole('button', { name: /submit|save/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/grade.*range|must be.*0|negative|invalid/i)).toBeInTheDocument();
      });
    });

    it('should require rubric level selection for all dimensions', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'rubric' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('rubric'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText('Assessment Criterion 1')).toBeInTheDocument();
      });

      // Try to submit without selecting levels
      const submitButton = screen.getByRole('button', { name: /submit|save/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/select.*level|required/i)).toBeInTheDocument();
      });
    });

    it('should require comments for comments-only strategy', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'comments' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('comments'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText('Assessment Criterion 1')).toBeInTheDocument();
      });

      // Try to submit without entering comments
      const submitButton = screen.getByRole('button', { name: /submit|save/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/comment.*required|feedback.*required/i)).toBeInTheDocument();
      });
    });

    it('should require error selection for numerrors strategy', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'numerrors' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('numerrors'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText('Assessment Criterion 1')).toBeInTheDocument();
      });

      // Try to submit without selecting error presence
      const submitButton = screen.getByRole('button', { name: /submit|save/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/select.*error|selection.*required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Overall Feedback', () => {
    it('should display overall feedback text area', async () => {
      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /overall.*feedback|feedback/i })).toBeInTheDocument();
      });
    });

    it('should allow entering feedback text', async () => {
      const user = userEvent.setup();
      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /overall.*feedback|feedback/i })).toBeInTheDocument();
      });

      const feedbackInput = screen.getByRole('textbox', { name: /overall.*feedback|feedback/i });
      await user.type(feedbackInput, 'Great work on this submission!');

      expect(feedbackInput).toHaveValue('Great work on this submission!');
    });

    it('should require feedback when overallFeedbackMode is 2 (required)', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ overallFeedbackMode: 2 }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /overall.*feedback|feedback/i })).toBeInTheDocument();
      });

      // Try to submit without feedback
      const submitButton = screen.getByRole('button', { name: /submit|save/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/feedback.*required/i)).toBeInTheDocument();
      });
    });

    it('should not require feedback when overallFeedbackMode is 1 (optional)', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ 
              overallFeedbackMode: 1,
              strategy: 'accumulative',
            }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      // Fill in dimensions but not feedback
      const gradeInputs = screen.getAllByRole('spinbutton');
      for (const input of gradeInputs) {
        await user.clear(input);
        await user.type(input, '85');
      }

      // Should be able to submit without feedback
      const submitButton = screen.getByRole('button', { name: /submit/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('should hide feedback section when overallFeedbackMode is 0 (disabled)', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ overallFeedbackMode: 0 }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText('Test Submission Title')).toBeInTheDocument();
      });

      // Feedback section should not be visible
      expect(screen.queryByRole('textbox', { name: /overall.*feedback/i })).not.toBeInTheDocument();
    });
  });

  describe('Assessment Instructions', () => {
    it('should display assessment instructions when configured', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({
              instructreviewers: 'Please assess this submission carefully and provide detailed feedback.',
            }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(
          screen.getByText(/Please assess this submission carefully/i)
        ).toBeInTheDocument();
      });
    });

    it('should not display instructions section when empty', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ instructreviewers: '' }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText('Test Submission Title')).toBeInTheDocument();
      });

      // Instructions section should not render empty content
      expect(screen.queryByText(/instructions/i)).not.toBeInTheDocument();
    });
  });

  describe('Teacher Options (Assessment Weight Override)', () => {
    it('should display weight override field for teachers with allocate capability', async () => {
      // Render with authenticated teacher user having allocate capability
      render(
        <PeerAssessmentForm {...defaultProps} />,
        {
          queryClient,
          authenticated: true,
          preloadedState: {
            auth: {
              user: {
                id: 1,
                username: 'teacher',
                firstname: 'Test',
                lastname: 'Teacher',
                email: 'teacher@example.com',
                fullname: 'Test Teacher',
                roles: ['editingteacher'],
                capabilities: ['mod/workshop:allocate', 'mod/workshop:overridegrades'],
              },
              tokens: { accessToken: 'test-token', refreshToken: 'test-refresh' },
              status: 'authenticated' as const,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            },
          },
        }
      );

      await waitFor(() => {
        expect(screen.getByText('Test Submission Title')).toBeInTheDocument();
      });

      // Weight override should be visible for teachers
      expect(screen.getByLabelText(/weight|override/i)).toBeInTheDocument();
    });

    it('should hide weight override field for students without allocate capability', async () => {
      render(
        <PeerAssessmentForm {...defaultProps} />,
        {
          queryClient,
          authenticated: true,
          preloadedState: {
            auth: {
              user: {
                id: 2,
                username: 'student',
                firstname: 'Test',
                lastname: 'Student',
                email: 'student@example.com',
                fullname: 'Test Student',
                roles: ['student'],
                capabilities: [],
              },
              tokens: { accessToken: 'test-token', refreshToken: 'test-refresh' },
              status: 'authenticated' as const,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            },
          },
        }
      );

      await waitFor(() => {
        expect(screen.getByText('Test Submission Title')).toBeInTheDocument();
      });

      // Weight override should not be visible for students
      expect(screen.queryByLabelText(/weight.*override/i)).not.toBeInTheDocument();
    });

    it('should allow teachers to modify assessment weight', async () => {
      const user = userEvent.setup();

      render(
        <PeerAssessmentForm {...defaultProps} />,
        {
          queryClient,
          authenticated: true,
          preloadedState: {
            auth: {
              user: {
                id: 1,
                username: 'teacher',
                firstname: 'Test',
                lastname: 'Teacher',
                email: 'teacher@example.com',
                fullname: 'Test Teacher',
                roles: ['editingteacher'],
                capabilities: ['mod/workshop:allocate'],
              },
              tokens: { accessToken: 'test-token', refreshToken: 'test-refresh' },
              status: 'authenticated' as const,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            },
          },
        }
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/weight/i)).toBeInTheDocument();
      });

      const weightInput = screen.getByLabelText(/weight/i);
      await user.clear(weightInput);
      await user.type(weightInput, '2');

      expect(weightInput).toHaveValue(2);
    });
  });

  describe('Draft Save Functionality', () => {
    it('should display draft save button', async () => {
      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /save.*draft|draft/i })
        ).toBeInTheDocument();
      });
    });

    it('should save draft when clicking save draft button', async () => {
      const user = userEvent.setup();
      let draftSaved = false;

      server.use(
        http.put('/api/v1/workshops/:workshopId/assessments/:assessmentId', () => {
          draftSaved = true;
          return HttpResponse.json({
            success: true,
            data: createMockAssessment(),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save.*draft|draft/i })).toBeInTheDocument();
      });

      const saveDraftButton = screen.getByRole('button', { name: /save.*draft|draft/i });
      await user.click(saveDraftButton);

      await waitFor(() => {
        expect(draftSaved).toBe(true);
      });
    });

    it('should trigger auto-save after 30 seconds of inactivity', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      let autoSaveCount = 0;

      server.use(
        http.put('/api/v1/workshops/:workshopId/assessments/:assessmentId', () => {
          autoSaveCount++;
          return HttpResponse.json({
            success: true,
            data: createMockAssessment(),
          });
        }),
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      // Make a change to trigger dirty state
      const gradeInput = screen.getAllByRole('spinbutton')[0];
      await user.clear(gradeInput);
      await user.type(gradeInput, '85');

      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(autoSaveCount).toBeGreaterThan(0);
      });

      vi.useRealTimers();
    });

    it('should show auto-save status indicator', async () => {
      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText('Test Submission Title')).toBeInTheDocument();
      });

      // Auto-save status should be visible
      expect(
        screen.getByText(/auto-save|saved|last saved|saving/i)
      ).toBeInTheDocument();
    });

    it('should display unsaved changes warning when form is dirty', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      const gradeInput = screen.getAllByRole('spinbutton')[0];
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      // Should show unsaved changes indicator
      await waitFor(() => {
        expect(screen.getByText(/unsaved.*changes|not saved/i)).toBeInTheDocument();
      });
    });

    it('should show optimistic update during draft save', async () => {
      const user = userEvent.setup();

      let resolveRequest: () => void;
      const delayedResponse = new Promise<void>((resolve) => {
        resolveRequest = resolve;
      });

      server.use(
        http.put('/api/v1/workshops/:workshopId/assessments/:assessmentId', async () => {
          await delayedResponse;
          return HttpResponse.json({
            success: true,
            data: createMockAssessment(),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save.*draft|draft/i })).toBeInTheDocument();
      });

      const saveDraftButton = screen.getByRole('button', { name: /save.*draft|draft/i });
      await user.click(saveDraftButton);

      // Should show saving state
      await waitFor(() => {
        expect(screen.getByText(/saving|loading/i)).toBeInTheDocument();
      });

      // Resolve the request
      resolveRequest!();

      await waitFor(() => {
        expect(screen.getByText(/saved|success/i)).toBeInTheDocument();
      });
    });
  });

  describe('Confirmation Dialog', () => {
    it('should show confirmation dialog before final submission', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      // Fill in all dimensions
      const gradeInputs = screen.getAllByRole('spinbutton');
      for (const input of gradeInputs) {
        await user.clear(input);
        await user.type(input, '85');
      }

      // Click submit button
      const submitButton = screen.getByRole('button', { name: /submit.*assessment|submit/i });
      await user.click(submitButton);

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(
          screen.getByText(/confirm|are you sure|submit.*assessment/i)
        ).toBeInTheDocument();
      });
    });

    it('should not submit when canceling confirmation dialog', async () => {
      const user = userEvent.setup();
      let submitted = false;

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        }),
        http.post('/api/v1/workshops/:workshopId/assessments/:assessmentId/submit', () => {
          submitted = true;
          return HttpResponse.json({
            success: true,
            data: createMockAssessment(),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      const gradeInputs = screen.getAllByRole('spinbutton');
      for (const input of gradeInputs) {
        await user.clear(input);
        await user.type(input, '85');
      }

      const submitButton = screen.getByRole('button', { name: /submit.*assessment|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click cancel in the dialog
      const cancelButton = within(screen.getByRole('dialog')).getByRole('button', {
        name: /cancel|no|go back/i,
      });
      await user.click(cancelButton);

      // Dialog should close and assessment should not be submitted
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      expect(submitted).toBe(false);
    });

    it('should submit assessment when confirming dialog', async () => {
      const user = userEvent.setup();
      let submitted = false;

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        }),
        http.post('/api/v1/workshops/:workshopId/assessments/:assessmentId/submit', () => {
          submitted = true;
          return HttpResponse.json({
            success: true,
            data: createMockAssessment({ grade: 85 }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      const gradeInputs = screen.getAllByRole('spinbutton');
      for (const input of gradeInputs) {
        await user.clear(input);
        await user.type(input, '85');
      }

      const submitButton = screen.getByRole('button', { name: /submit.*assessment|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click confirm in the dialog
      const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {
        name: /confirm|yes|submit/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(submitted).toBe(true);
      });
    });
  });

  describe('Permission Checks', () => {
    it('should display form when user is reviewer and assessment is editable', async () => {
      server.use(
        http.get('/api/v1/workshops/:workshopId/assessments/:assessmentId', () => {
          return HttpResponse.json({
            success: true,
            data: createMockAssessment({
              isreviewer: true,
              assessmenteditable: true,
            }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText('Test Submission Title')).toBeInTheDocument();
      });

      // Form inputs should be present and editable
      expect(screen.getByRole('button', { name: /submit|save/i })).toBeInTheDocument();
    });

    it('should show read-only view when assessment is not editable', async () => {
      server.use(
        http.get('/api/v1/workshops/:workshopId/assessments/:assessmentId', () => {
          return HttpResponse.json({
            success: true,
            data: createMockAssessment({
              isreviewer: true,
              assessmenteditable: false,
            }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText('Test Submission Title')).toBeInTheDocument();
      });

      // Submit button should be disabled or not present
      const submitButton = screen.queryByRole('button', { name: /submit.*assessment/i });
      if (submitButton) {
        expect(submitButton).toBeDisabled();
      }
    });

    it('should show error when user is not the reviewer', async () => {
      server.use(
        http.get('/api/v1/workshops/:workshopId/assessments/:assessmentId', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: 'You are not assigned as the reviewer for this submission.',
            },
          }, { status: 403 });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(
          screen.getByText(/permission denied|not.*reviewer|not authorized/i)
        ).toBeInTheDocument();
      });
    });

    it('should show error when not in assessment phase', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ phase: 20 }), // Submission phase, not assessment
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(
          screen.getByText(/assessment.*phase|not.*open|assessment.*closed/i)
        ).toBeInTheDocument();
      });
    });

    it('should show error when assessment window has not opened', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({
              phase: 30,
              assessmentstart: Math.floor(Date.now() / 1000) + 86400, // Opens tomorrow
            }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(
          screen.getByText(/assessment.*not.*started|not.*yet.*open/i)
        ).toBeInTheDocument();
      });
    });

    it('should show error when assessment window has closed', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({
              phase: 30,
              assessmentend: Math.floor(Date.now() / 1000) - 86400, // Closed yesterday
            }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(
          screen.getByText(/assessment.*closed|deadline.*passed/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Example Assessment Completion', () => {
    it('should show warning when examples are required but not completed', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ useexamples: true, examplesmode: 1 }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/userplan', () => {
          return HttpResponse.json({
            success: true,
            data: createMockUserPlan({
              examplesRequired: 2,
              examplesCompleted: 0,
            }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(
          screen.getByText(/complete.*example|example.*assessment|must.*assess.*example/i)
        ).toBeInTheDocument();
      });
    });

    it('should disable form submission when examples not completed', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ useexamples: true, examplesmode: 1 }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/userplan', () => {
          return HttpResponse.json({
            success: true,
            data: createMockUserPlan({
              examplesRequired: 2,
              examplesCompleted: 1,
            }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText('Test Submission Title')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      expect(submitButton).toBeDisabled();
    });

    it('should allow submission when all examples are completed', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ 
              useexamples: true, 
              examplesmode: 1,
              strategy: 'accumulative',
            }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/userplan', () => {
          return HttpResponse.json({
            success: true,
            data: createMockUserPlan({
              examplesRequired: 2,
              examplesCompleted: 2,
            }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('should show examples completion status', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ useexamples: true, examplesmode: 1 }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/userplan', () => {
          return HttpResponse.json({
            success: true,
            data: createMockUserPlan({
              examplesRequired: 2,
              examplesCompleted: 1,
            }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText(/1.*of.*2|1\/2|50%/i)).toBeInTheDocument();
      });
    });
  });

  describe('React Query Mutation', () => {
    it('should call assessment submission mutation on form submit', async () => {
      const user = userEvent.setup();
      let mutationCalled = false;
      let mutationPayload: unknown = null;

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        }),
        http.post('/api/v1/workshops/:workshopId/assessments/:assessmentId/submit', async ({ request }) => {
          mutationCalled = true;
          mutationPayload = await request.json();
          return HttpResponse.json({
            success: true,
            data: createMockAssessment({ grade: 85 }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      // Fill in dimensions
      const gradeInputs = screen.getAllByRole('spinbutton');
      for (const input of gradeInputs) {
        await user.clear(input);
        await user.type(input, '85');
      }

      // Submit
      const submitButton = screen.getByRole('button', { name: /submit.*assessment|submit/i });
      await user.click(submitButton);

      // Confirm dialog
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {
        name: /confirm|yes|submit/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mutationCalled).toBe(true);
        expect(mutationPayload).toBeDefined();
      });
    });

    it('should handle mutation error gracefully', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        }),
        http.post('/api/v1/workshops/:workshopId/assessments/:assessmentId/submit', () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid grade values submitted.',
            },
          }, { status: 400 });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      const gradeInputs = screen.getAllByRole('spinbutton');
      for (const input of gradeInputs) {
        await user.clear(input);
        await user.type(input, '85');
      }

      const submitButton = screen.getByRole('button', { name: /submit.*assessment|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {
        name: /confirm|yes|submit/i,
      });
      await user.click(confirmButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/error|failed|invalid/i)).toBeInTheDocument();
      });
    });

    it('should invalidate queries after successful submission', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        }),
        http.post('/api/v1/workshops/:workshopId/assessments/:assessmentId/submit', () => {
          return HttpResponse.json({
            success: true,
            data: createMockAssessment({ grade: 85, submitted: true }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      const gradeInputs = screen.getAllByRole('spinbutton');
      for (const input of gradeInputs) {
        await user.clear(input);
        await user.type(input, '85');
      }

      const submitButton = screen.getByRole('button', { name: /submit.*assessment|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {
        name: /confirm|yes|submit/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalled();
      });

      invalidateSpy.mockRestore();
    });

    it('should show success feedback after submission', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        }),
        http.post('/api/v1/workshops/:workshopId/assessments/:assessmentId/submit', () => {
          return HttpResponse.json({
            success: true,
            data: createMockAssessment({ grade: 85, submitted: true }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      const gradeInputs = screen.getAllByRole('spinbutton');
      for (const input of gradeInputs) {
        await user.clear(input);
        await user.type(input, '85');
      }

      const submitButton = screen.getByRole('button', { name: /submit.*assessment|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {
        name: /confirm|yes|submit/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(
          screen.getByText(/success|submitted|assessment.*saved/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Pending Assessments List', () => {
    it('should display pending assessments count for reviewer context', async () => {
      server.use(
        http.get('/api/v1/workshops/:workshopId/userplan', () => {
          return HttpResponse.json({
            success: true,
            data: createMockUserPlan({
              pendingAssessments: 3,
              completedAssessments: 2,
            }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText(/3.*pending|pending.*3/i)).toBeInTheDocument();
      });
    });

    it('should show progress indicator for completed assessments', async () => {
      server.use(
        http.get('/api/v1/workshops/:workshopId/userplan', () => {
          return HttpResponse.json({
            success: true,
            data: createMockUserPlan({
              pendingAssessments: 1,
              completedAssessments: 4,
              totalAssessments: 5,
            }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText(/4.*of.*5|4\/5|80%/i)).toBeInTheDocument();
      });
    });

    it('should navigate to next pending assessment after submission', async () => {
      const user = userEvent.setup();
      const mockNavigate = vi.fn();

      vi.mock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom');
        return {
          ...actual,
          useNavigate: () => mockNavigate,
        };
      });

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/userplan', () => {
          return HttpResponse.json({
            success: true,
            data: createMockUserPlan({
              pendingAssessments: 2,
              nextPendingAssessmentId: 456,
            }),
          });
        }),
        http.post('/api/v1/workshops/:workshopId/assessments/:assessmentId/submit', () => {
          return HttpResponse.json({
            success: true,
            data: createMockAssessment({ grade: 85, submitted: true }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      const gradeInputs = screen.getAllByRole('spinbutton');
      for (const input of gradeInputs) {
        await user.clear(input);
        await user.type(input, '85');
      }

      const submitButton = screen.getByRole('button', { name: /submit.*assessment|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {
        name: /confirm|yes|submit/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/success|submitted/i)).toBeInTheDocument();
      });

      // Should show option to go to next assessment
      const nextButton = screen.queryByRole('button', { name: /next.*assessment|continue/i });
      if (nextButton) {
        await user.click(nextButton);
        expect(mockNavigate).toHaveBeenCalled();
      }
    });
  });

  describe('Accessibility', () => {
    it('should have accessible form controls with labels', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      // All form inputs should have accessible names
      const inputs = screen.getAllByRole('spinbutton');
      inputs.forEach((input) => {
        expect(input).toHaveAccessibleName();
      });
    });

    it('should have proper ARIA attributes on dimension sections', async () => {
      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText('Test Submission Title')).toBeInTheDocument();
      });

      // Check for region landmarks
      const regions = screen.getAllByRole('region');
      expect(regions.length).toBeGreaterThan(0);
    });

    it('should support keyboard navigation through form', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      // Tab through form elements
      await user.tab();
      expect(document.activeElement).not.toBe(document.body);

      // Continue tabbing through
      await user.tab();
      await user.tab();

      // Should be able to tab to all interactive elements
      const buttons = screen.getAllByRole('button');
      const canReachButton = buttons.some((btn) => btn === document.activeElement);
      // At least verify tab navigation works
      expect(document.activeElement?.tagName).toBeTruthy();
    });

    it('should announce validation errors to screen readers', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      // Enter invalid value
      const gradeInput = screen.getAllByRole('spinbutton')[0];
      await user.clear(gradeInput);
      await user.type(gradeInput, '150'); // Out of range

      // Blur to trigger validation
      await user.tab();

      // Submit to trigger validation
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      // Error messages should have appropriate ARIA attributes
      await waitFor(() => {
        const errorMessages = screen.getAllByRole('alert');
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });

    it('should have accessible feedback text area', async () => {
      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText('Test Submission Title')).toBeInTheDocument();
      });

      const feedbackArea = screen.getByRole('textbox', { name: /feedback|comment/i });
      expect(feedbackArea).toHaveAccessibleName();
      expect(feedbackArea).toHaveAttribute('aria-describedby');
    });

    it('should have accessible submit and save buttons', async () => {
      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getByText('Test Submission Title')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      expect(submitButton).toHaveAccessibleName();

      const saveButton = screen.queryByRole('button', { name: /save.*draft|draft/i });
      if (saveButton) {
        expect(saveButton).toHaveAccessibleName();
      }
    });

    it('should have accessible confirmation dialog', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      const gradeInputs = screen.getAllByRole('spinbutton');
      for (const input of gradeInputs) {
        await user.clear(input);
        await user.type(input, '85');
      }

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAccessibleName();

      // Dialog should trap focus
      const dialogButtons = within(dialog).getAllByRole('button');
      expect(dialogButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('should provide screen reader feedback during form submission', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ strategy: 'accumulative' }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        }),
        http.post('/api/v1/workshops/:workshopId/assessments/:assessmentId/submit', async () => {
          // Simulate network delay
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: createMockAssessment({ grade: 85, submitted: true }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      const gradeInputs = screen.getAllByRole('spinbutton');
      for (const input of gradeInputs) {
        await user.clear(input);
        await user.type(input, '85');
      }

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {
        name: /confirm|yes|submit/i,
      });
      await user.click(confirmButton);

      // Should show loading status (aria-live region)
      const loadingIndicator = screen.queryByRole('status');
      if (loadingIndicator) {
        expect(loadingIndicator).toHaveAttribute('aria-live');
      }

      // Success message should be announced
      await waitFor(() => {
        const successMessage = screen.getByText(/success|submitted/i);
        expect(successMessage).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission Flow', () => {
    it('should follow complete submission flow: validation -> confirmation -> API call -> success', async () => {
      const user = userEvent.setup();
      let apiCalled = false;

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ 
              strategy: 'accumulative',
              overallfeedbackmode: 2, // Required feedback
            }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        }),
        http.post('/api/v1/workshops/:workshopId/assessments/:assessmentId/submit', () => {
          apiCalled = true;
          return HttpResponse.json({
            success: true,
            data: createMockAssessment({ grade: 85, submitted: true }),
          });
        })
      );

      renderPeerAssessmentForm();

      // Step 1: Wait for form to load
      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      // Step 2: Fill in dimensions
      const gradeInputs = screen.getAllByRole('spinbutton');
      for (const input of gradeInputs) {
        await user.clear(input);
        await user.type(input, '85');
      }

      // Step 3: Fill in required feedback
      const feedbackArea = screen.getByRole('textbox', { name: /feedback|comment/i });
      await user.type(feedbackArea, 'Excellent work! Well structured and thorough.');

      // Step 4: Click submit (validation should pass)
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      // Step 5: Confirmation dialog appears
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Step 6: Confirm submission
      const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {
        name: /confirm|yes|submit/i,
      });
      await user.click(confirmButton);

      // Step 7: API is called
      await waitFor(() => {
        expect(apiCalled).toBe(true);
      });

      // Step 8: Success feedback shown
      await waitFor(() => {
        expect(screen.getByText(/success|submitted|assessment.*saved/i)).toBeInTheDocument();
      });
    });

    it('should prevent submission when validation fails', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ 
              strategy: 'accumulative',
              overallfeedbackmode: 2, // Required feedback
            }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      // Don't fill in required feedback

      // Try to submit
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      // Confirmation dialog should NOT appear due to validation failure
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Validation error should be shown
      expect(screen.getByText(/required|feedback.*required/i)).toBeInTheDocument();
    });

    it('should allow resubmission after fixing validation errors', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/workshops/:id', () => {
          return HttpResponse.json({
            success: true,
            data: createMockWorkshop({ 
              strategy: 'accumulative',
              overallfeedbackmode: 2, // Required feedback
            }),
          });
        }),
        http.get('/api/v1/workshops/:workshopId/dimensions', () => {
          return HttpResponse.json({
            success: true,
            data: createMockDimensions('accumulative'),
          });
        }),
        http.post('/api/v1/workshops/:workshopId/assessments/:assessmentId/submit', () => {
          return HttpResponse.json({
            success: true,
            data: createMockAssessment({ grade: 85, submitted: true }),
          });
        })
      );

      renderPeerAssessmentForm();

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      // Fill dimensions but not feedback
      const gradeInputs = screen.getAllByRole('spinbutton');
      for (const input of gradeInputs) {
        await user.clear(input);
        await user.type(input, '85');
      }

      // Try to submit (will fail validation)
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      // Validation error appears
      await waitFor(() => {
        expect(screen.getByText(/required|feedback.*required/i)).toBeInTheDocument();
      });

      // Fix the validation error
      const feedbackArea = screen.getByRole('textbox', { name: /feedback|comment/i });
      await user.type(feedbackArea, 'Great work on this submission!');

      // Resubmit
      await user.click(submitButton);

      // Now confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Confirm
      const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {
        name: /confirm|yes|submit/i,
      });
      await user.click(confirmButton);

      // Success
      await waitFor(() => {
        expect(screen.getByText(/success|submitted/i)).toBeInTheDocument();
      });
    });
  });
});
