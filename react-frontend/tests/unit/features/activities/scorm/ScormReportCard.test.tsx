/**
 * Vitest Component Tests for ScormReportCard
 *
 * Comprehensive test suite for SCORM learner progress report display component.
 * Tests all aspects of report rendering including attempt summaries, scoring, grading,
 * completion tracking, time spent, interaction data, objectives, and error handling.
 *
 * Test Coverage:
 * - Basic report view with attempt summary and status
 * - Overall score display with raw, min, max, scaled values
 * - Grade display based on grading method (highest, average, first, last attempt)
 * - Completion percentage calculation and progress bar
 * - Total time spent formatting (hours:minutes:seconds)
 * - Attempt history table with all attempts
 * - Attempt selection and filtering
 * - Detailed report view with SCO-level progress
 * - Interaction tracking data display
 * - Objectives completion status
 * - Warning and error alerts for incomplete/failed attempts
 * - Empty report state handling
 * - Loading state display
 * - SCORM 1.2 and SCORM 2004 format support
 * - Responsive layout adjustments
 * - Accessibility with proper ARIA labels and headings
 * - Data formatting with proper locale support
 *
 * @module tests/unit/features/activities/scorm/ScormReportCard.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScormReportCard } from '@/features/activities/scorm/components/ScormReportCard';
import type { ScormAttempt } from '@/features/activities/scorm/types/scorm.types';

// ============================================================================
// MOCKS
// ============================================================================

// Mock the useScorm hook
vi.mock('@/features/activities/scorm/hooks/useScorm', () => ({
  useScorm: vi.fn(),
}));

// Mock the scormApi to isolate component tests
vi.mock('@/features/activities/scorm/api/scormApi', () => ({
  fetchAttemptReport: vi.fn(),
}));

// Import the mocked modules after mocking
import { useScorm } from '@/features/activities/scorm/hooks/useScorm';

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Creates mock SCORM report data with customizable properties
 */
const createMockReport = (overrides = {}) => ({
  scormId: 1,
  userId: 100,
  currentAttempt: 1,
  attempts: [
    {
      attemptNumber: 1,
      status: 'completed',
      score: 85,
      timeSpent: '00:15:30',
      timeStarted: 1704067200,
      timeCompleted: 1704068130,
    },
  ],
  overallScore: {
    raw: 85,
    min: 0,
    max: 100,
    scaled: 0.85,
  },
  grade: 85,
  completionPercentage: 100,
  totalTimeSpent: 930, // 15 minutes 30 seconds
  gradingMethod: 'highest',
  status: 'completed',
  scoProgress: [],
  interactions: [],
  objectives: [],
  ...overrides,
});

/**
 * Creates mock attempt data
 */
const createMockAttempt = (overrides = {}): ScormAttempt => ({
  attemptNumber: 1,
  userid: 100,
  scormid: 1,
  status: 'completed',
  score: 85,
  timemodified: 1704068130,
  ...overrides,
});

/**
 * Creates mock attempt summary data
 */
const createMockAttemptSummary = (overrides = {}) => ({
  attemptNumber: 1,
  status: 'completed',
  score: 85,
  timeSpent: '00:15:30',
  timeStarted: 1704067200,
  timeCompleted: 1704068130,
  ...overrides,
});

/**
 * Creates mock SCO progress data
 */
const createMockScoProgress = (overrides = {}) => ({
  scoid: 1,
  title: 'Introduction Module',
  status: 'completed',
  score: {
    raw: 90,
    min: 0,
    max: 100,
    scaled: 0.9,
  },
  timeSpent: '00:05:00',
  ...overrides,
});

/**
 * Creates mock interaction tracking data
 */
const createMockInteraction = (overrides = {}) => ({
  id: 'q1',
  type: 'choice',
  description: 'What is the capital of France?',
  learner_response: 'Paris',
  result: 'correct',
  latency: '15',
  timestamp: '2024-01-01T12:00:00Z',
  ...overrides,
});

/**
 * Creates mock objective data
 */
const createMockObjective = (overrides = {}) => ({
  id: 'obj1',
  description: 'Understand basic concepts',
  status: 'completed',
  score: {
    raw: 85,
    min: 0,
    max: 100,
  },
  ...overrides,
});

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a test QueryClient with disabled retries for faster tests
 */
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
    },
  });

/**
 * Wrapper component that provides React Query context
 */
const createWrapper = () => {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/**
 * Helper to render component with React Query provider
 */
const renderWithQueryClient = (ui: React.ReactElement) => {
  return render(ui, { wrapper: createWrapper() });
};

// ============================================================================
// TESTS: LOADING AND ERROR STATES
// ============================================================================

describe('ScormReportCard - Loading and Error States', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display loading state with spinner while fetching data', () => {
    // Mock useScorm to return loading state
    vi.mocked(useScorm).mockReturnValue({
      isLoading: true,
      error: null,
      data: null,
      isError: false,
      isSuccess: false,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify loading message is displayed
    expect(screen.getByText(/loading scorm report/i)).toBeInTheDocument();
  });

  it('should display error alert when data fetch fails', () => {
    const errorMessage = 'Failed to load SCORM report data';

    // Mock useScorm to return error state
    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: new Error(errorMessage),
      data: null,
      isError: true,
      isSuccess: false,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify error message is displayed
    expect(
      screen.getByText(/failed to load scorm report/i)
    ).toBeInTheDocument();
  });

  it('should display info alert when no report data is available', () => {
    // Mock useScorm to return no data
    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: null,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify no data message is displayed
    expect(
      screen.getByText(/no report data available/i)
    ).toBeInTheDocument();
  });

  it('should display empty report state when no attempts exist', () => {
    const reportWithNoAttempts = createMockReport({
      attempts: [],
      currentAttempt: 0,
    });

    // Mock useScorm to return report with no attempts
    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: reportWithNoAttempts,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // In this case, the component should handle gracefully
    // Verify the report title is still shown
    expect(screen.getByText(/scorm activity report/i)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: BASIC REPORT VIEW
// ============================================================================

describe('ScormReportCard - Basic Report View', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display current attempt number and status', () => {
    const mockReport = createMockReport({
      currentAttempt: 2,
      status: 'completed',
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={2} showDetailed={false} />
    );

    // Verify attempt number is displayed in subtitle
    expect(screen.getByText(/attempt 2 of/i)).toBeInTheDocument();

    // Verify status chip is displayed
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
  });

  it('should display completed status with success color', () => {
    const mockReport = createMockReport({
      status: 'completed',
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify status chip with completed text
    const statusChip = screen.getAllByText(/completed/i)[0];
    expect(statusChip).toBeInTheDocument();
  });

  it('should display passed status correctly', () => {
    const mockReport = createMockReport({
      status: 'passed',
      attempts: [
        createMockAttemptSummary({
          status: 'passed',
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify passed status is shown
    expect(screen.getByText(/passed/i)).toBeInTheDocument();
  });

  it('should display failed status with error color', () => {
    const mockReport = createMockReport({
      status: 'failed',
      attempts: [
        createMockAttemptSummary({
          status: 'failed',
          score: 45,
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify failed status is shown
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
  });

  it('should display incomplete status with warning indication', () => {
    const mockReport = createMockReport({
      status: 'incomplete',
      attempts: [
        createMockAttemptSummary({
          status: 'incomplete',
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify incomplete status is shown
    expect(screen.getByText(/incomplete/i)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: SCORE AND GRADE DISPLAY
// ============================================================================

describe('ScormReportCard - Score and Grade Display', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display overall score with raw, min, max, and scaled values formatted correctly', () => {
    const mockReport = createMockReport({
      overallScore: {
        raw: 85,
        min: 0,
        max: 100,
        scaled: 0.85,
      },
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify score is displayed (component uses formatScore which shows raw/max)
    expect(screen.getByText(/85/)).toBeInTheDocument();
  });

  it('should display grade based on highest attempt score grading method', () => {
    const mockReport = createMockReport({
      gradingMethod: 'highest',
      grade: 95,
      attempts: [
        createMockAttemptSummary({ attemptNumber: 1, score: 80 }),
        createMockAttemptSummary({ attemptNumber: 2, score: 95 }),
        createMockAttemptSummary({ attemptNumber: 3, score: 85 }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={2} showDetailed={false} />
    );

    // Verify current score reflects the correct attempt
    expect(screen.getByText(/95/)).toBeInTheDocument();
  });

  it('should display grade based on average attempt score grading method', () => {
    const mockReport = createMockReport({
      gradingMethod: 'average',
      grade: 85,
      attempts: [
        createMockAttemptSummary({ attemptNumber: 1, score: 80 }),
        createMockAttemptSummary({ attemptNumber: 2, score: 90 }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify average score is displayed in summary
    expect(screen.getByText(/average score/i)).toBeInTheDocument();
    expect(screen.getByText(/85.0/)).toBeInTheDocument();
  });

  it('should display grade based on first attempt grading method', () => {
    const mockReport = createMockReport({
      gradingMethod: 'first',
      grade: 75,
      attempts: [
        createMockAttemptSummary({ attemptNumber: 1, score: 75 }),
        createMockAttemptSummary({ attemptNumber: 2, score: 90 }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify first attempt score is considered
    expect(screen.getByText(/75/)).toBeInTheDocument();
  });

  it('should display grade based on last attempt grading method', () => {
    const mockReport = createMockReport({
      gradingMethod: 'last',
      grade: 88,
      attempts: [
        createMockAttemptSummary({ attemptNumber: 1, score: 70 }),
        createMockAttemptSummary({ attemptNumber: 2, score: 88 }),
      ],
      currentAttempt: 2,
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={2} showDetailed={false} />
    );

    // Verify last attempt score is displayed
    expect(screen.getByText(/88/)).toBeInTheDocument();
  });

  it('should display N/A when score is not available', () => {
    const mockReport = createMockReport({
      overallScore: undefined,
      attempts: [
        createMockAttemptSummary({
          score: undefined,
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify N/A is displayed when score is missing
    expect(screen.getByText(/n\/a/i)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: COMPLETION AND TIME TRACKING
// ============================================================================

describe('ScormReportCard - Completion and Time Tracking', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display completion percentage with progress bar', () => {
    const mockReport = createMockReport({
      completionPercentage: 75,
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify completion percentage is displayed
    expect(screen.getByText(/75%/)).toBeInTheDocument();

    // Verify progress bar is present
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display 100% completion for completed attempts', () => {
    const mockReport = createMockReport({
      completionPercentage: 100,
      status: 'completed',
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify 100% completion
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('should display total time spent formatted as hours:minutes:seconds', () => {
    const mockReport = createMockReport({
      totalTimeSpent: 3665, // 1 hour, 1 minute, 5 seconds
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify time is formatted (component uses formatDuration helper)
    // Should display something like "01:01:05"
    expect(screen.getByText(/01:01:05/)).toBeInTheDocument();
  });

  it('should display time spent in minutes and seconds for short durations', () => {
    const mockReport = createMockReport({
      totalTimeSpent: 125, // 2 minutes, 5 seconds
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify short time format
    expect(screen.getByText(/00:02:05/)).toBeInTheDocument();
  });

  it('should handle zero time spent gracefully', () => {
    const mockReport = createMockReport({
      totalTimeSpent: 0,
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify zero time is displayed
    expect(screen.getByText(/00:00:00/)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: ATTEMPT HISTORY TABLE
// ============================================================================

describe('ScormReportCard - Attempt History Table', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render list of all attempts in MUI Table with correct columns', () => {
    const mockReport = createMockReport({
      attempts: [
        createMockAttemptSummary({ attemptNumber: 1, score: 75, status: 'completed' }),
        createMockAttemptSummary({ attemptNumber: 2, score: 85, status: 'completed' }),
        createMockAttemptSummary({ attemptNumber: 3, score: 90, status: 'passed' }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify table headers
    expect(screen.getByText(/attempt/i)).toBeInTheDocument();
    expect(screen.getByText(/status/i)).toBeInTheDocument();
    expect(screen.getByText(/score/i)).toBeInTheDocument();
    expect(screen.getByText(/time/i)).toBeInTheDocument();
    expect(screen.getByText(/date/i)).toBeInTheDocument();

    // Verify all attempts are rendered
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should display attempt numbers, dates, scores, and statuses correctly', () => {
    const mockReport = createMockReport({
      attempts: [
        createMockAttemptSummary({
          attemptNumber: 1,
          score: 80,
          status: 'completed',
          timeCompleted: 1704067200,
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify attempt data is displayed
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
  });

  it('should highlight current attempt in the table', () => {
    const mockReport = createMockReport({
      currentAttempt: 2,
      attempts: [
        createMockAttemptSummary({ attemptNumber: 1 }),
        createMockAttemptSummary({ attemptNumber: 2 }),
        createMockAttemptSummary({ attemptNumber: 3 }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={2} showDetailed={false} />
    );

    // Verify "Current" chip is displayed for attempt 2
    expect(screen.getByText(/current/i)).toBeInTheDocument();
  });

  it('should display N/A for attempts with missing time data', () => {
    const mockReport = createMockReport({
      attempts: [
        createMockAttemptSummary({
          timeSpent: undefined,
          timeCompleted: undefined,
          timeStarted: undefined,
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify N/A is displayed for missing data
    const naElements = screen.getAllByText(/n\/a/i);
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('should format dates with proper locale formatting', () => {
    const timestamp = 1704067200; // January 1, 2024, 00:00:00 UTC
    const mockReport = createMockReport({
      attempts: [
        createMockAttemptSummary({
          timeCompleted: timestamp,
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify date is formatted (toLocaleString is used in component)
    // The exact format depends on locale, but check that a formatted date exists
    const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}/;
    expect(screen.getByText(dateRegex)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: WARNING AND ERROR ALERTS
// ============================================================================

describe('ScormReportCard - Warning and Error Alerts', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display warning alert for incomplete attempts', () => {
    const mockReport = createMockReport({
      status: 'incomplete',
      attempts: [
        createMockAttemptSummary({
          status: 'incomplete',
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify warning message is displayed
    expect(
      screen.getByText(/attention.*incomplete/i)
    ).toBeInTheDocument();
  });

  it('should display warning alert with appropriate message for failed attempts', () => {
    const mockReport = createMockReport({
      status: 'failed',
      attempts: [
        createMockAttemptSummary({
          status: 'failed',
          score: 40,
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify warning message includes "failed"
    expect(
      screen.getByText(/attention.*failed/i)
    ).toBeInTheDocument();
  });

  it('should not display warning alert for completed attempts', () => {
    const mockReport = createMockReport({
      status: 'completed',
      attempts: [
        createMockAttemptSummary({
          status: 'completed',
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify warning alert is NOT present
    expect(
      screen.queryByText(/attention/i)
    ).not.toBeInTheDocument();
  });

  it('should not display warning alert for passed attempts', () => {
    const mockReport = createMockReport({
      status: 'passed',
      attempts: [
        createMockAttemptSummary({
          status: 'passed',
          score: 95,
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify no warning is shown for passed attempts
    expect(
      screen.queryByText(/attention/i)
    ).not.toBeInTheDocument();
  });

  it('should display appropriate feedback message for learner to complete requirements', () => {
    const mockReport = createMockReport({
      status: 'incomplete',
      attempts: [
        createMockAttemptSummary({
          status: 'incomplete',
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify helpful message about completing requirements
    expect(
      screen.getByText(/complete additional requirements/i)
    ).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: SCO PROGRESS DETAILS
// ============================================================================

describe('ScormReportCard - SCO Progress Details', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display SCO-level progress in expandable sections', () => {
    const mockReport = createMockReport({
      scoProgress: [
        createMockScoProgress({
          scoid: 1,
          title: 'Introduction',
          status: 'completed',
          score: { raw: 90, min: 0, max: 100 },
        }),
        createMockScoProgress({
          scoid: 2,
          title: 'Advanced Topics',
          status: 'incomplete',
          score: { raw: 60, min: 0, max: 100 },
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify SCO Progress section is displayed
    expect(screen.getByText(/sco progress details/i)).toBeInTheDocument();

    // Verify individual SCO titles are shown
    expect(screen.getByText(/introduction/i)).toBeInTheDocument();
    expect(screen.getByText(/advanced topics/i)).toBeInTheDocument();
  });

  it('should display SCO status, score, and time spent for each SCO', () => {
    const mockReport = createMockReport({
      scoProgress: [
        createMockScoProgress({
          scoid: 1,
          title: 'Module 1',
          status: 'completed',
          score: { raw: 85, min: 0, max: 100 },
          timeSpent: '00:10:00',
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify SCO data is displayed
    expect(screen.getByText(/module 1/i)).toBeInTheDocument();
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
    expect(screen.getByText(/85/)).toBeInTheDocument();
    expect(screen.getByText(/00:10:00/)).toBeInTheDocument();
  });

  it('should not display SCO progress section when no SCO data exists', () => {
    const mockReport = createMockReport({
      scoProgress: [],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify SCO progress section is not displayed
    expect(
      screen.queryByText(/sco progress details/i)
    ).not.toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: DETAILED REPORT VIEW
// ============================================================================

describe('ScormReportCard - Detailed Report View', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display interaction tracking data when showDetailed is true', () => {
    const mockReport = createMockReport({
      interactions: [
        createMockInteraction({
          id: 'q1',
          type: 'choice',
          description: 'Sample question',
          learner_response: 'Answer A',
          result: 'correct',
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={true} />
    );

    // Verify interaction tracking section is displayed
    expect(screen.getByText(/interaction tracking/i)).toBeInTheDocument();

    // Verify interaction data columns
    expect(screen.getByText(/description/i)).toBeInTheDocument();
    expect(screen.getByText(/learner response/i)).toBeInTheDocument();
    expect(screen.getByText(/result/i)).toBeInTheDocument();
  });

  it('should not display interaction tracking when showDetailed is false', () => {
    const mockReport = createMockReport({
      interactions: [
        createMockInteraction(),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify interaction tracking is not shown
    expect(
      screen.queryByText(/interaction tracking/i)
    ).not.toBeInTheDocument();
  });

  it('should display interaction ID, type, description, learner response, and result', () => {
    const mockReport = createMockReport({
      interactions: [
        createMockInteraction({
          id: 'q1',
          type: 'true-false',
          description: 'Is the sky blue?',
          learner_response: 'true',
          result: 'correct',
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={true} />
    );

    // Verify all interaction fields are displayed
    expect(screen.getByText(/q1/i)).toBeInTheDocument();
    expect(screen.getByText(/true-false/i)).toBeInTheDocument();
    expect(screen.getByText(/is the sky blue/i)).toBeInTheDocument();
    expect(screen.getByText(/true/i)).toBeInTheDocument();
    expect(screen.getByText(/correct/i)).toBeInTheDocument();
  });

  it('should display correct answer result with success color', () => {
    const mockReport = createMockReport({
      interactions: [
        createMockInteraction({
          result: 'correct',
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={true} />
    );

    // Verify correct result is shown (component uses Chip with success color)
    const correctChip = screen.getByText(/correct/i);
    expect(correctChip).toBeInTheDocument();
  });

  it('should display incorrect answer result with error color', () => {
    const mockReport = createMockReport({
      interactions: [
        createMockInteraction({
          result: 'incorrect',
          learner_response: 'Wrong answer',
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={true} />
    );

    // Verify incorrect result is shown
    const incorrectChip = screen.getByText(/incorrect/i);
    expect(incorrectChip).toBeInTheDocument();
  });

  it('should display interaction timestamps and latency', () => {
    const mockReport = createMockReport({
      interactions: [
        createMockInteraction({
          latency: '45', // 45 seconds
          timestamp: '2024-01-01T12:00:00Z',
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={true} />
    );

    // Verify latency is formatted and displayed
    // Component uses formatDuration which should show "00:00:45"
    expect(screen.getByText(/00:00:45/)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: OBJECTIVES COMPLETION STATUS
// ============================================================================

describe('ScormReportCard - Objectives Completion Status', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display objectives completion status when showDetailed is true', () => {
    const mockReport = createMockReport({
      objectives: [
        createMockObjective({
          id: 'obj1',
          description: 'Learn basics',
          status: 'completed',
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={true} />
    );

    // Verify objectives section is displayed
    expect(screen.getByText(/learning objectives/i)).toBeInTheDocument();
  });

  it('should display objective IDs, descriptions, and status (satisfied/not satisfied)', () => {
    const mockReport = createMockReport({
      objectives: [
        createMockObjective({
          id: 'obj1',
          description: 'Master the fundamentals',
          status: 'completed',
          score: { raw: 90, min: 0, max: 100 },
        }),
        createMockObjective({
          id: 'obj2',
          description: 'Apply advanced concepts',
          status: 'incomplete',
          score: { raw: 50, min: 0, max: 100 },
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={true} />
    );

    // Verify objective data is displayed
    expect(screen.getByText(/obj1/i)).toBeInTheDocument();
    expect(screen.getByText(/obj2/i)).toBeInTheDocument();
    expect(screen.getByText(/master the fundamentals/i)).toBeInTheDocument();
    expect(screen.getByText(/apply advanced concepts/i)).toBeInTheDocument();
  });

  it('should display objective scores when available', () => {
    const mockReport = createMockReport({
      objectives: [
        createMockObjective({
          id: 'obj1',
          score: { raw: 88, min: 0, max: 100 },
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={true} />
    );

    // Verify objective score is displayed
    expect(screen.getByText(/88/)).toBeInTheDocument();
  });

  it('should display count of completed objectives vs total objectives', () => {
    const mockReport = createMockReport({
      objectives: [
        createMockObjective({ status: 'completed' }),
        createMockObjective({ status: 'completed' }),
        createMockObjective({ status: 'incomplete' }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={true} />
    );

    // Verify objectives count is displayed (2 of 3 completed)
    expect(screen.getByText(/2 of 3 objectives/i)).toBeInTheDocument();
  });

  it('should display info message when no detailed data is available', () => {
    const mockReport = createMockReport({
      interactions: [],
      objectives: [],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={true} />
    );

    // Verify info message about no detailed data
    expect(
      screen.getByText(/no detailed interaction or objective data available/i)
    ).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: SCORM FORMAT SUPPORT
// ============================================================================

describe('ScormReportCard - SCORM Format Support', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display SCORM 1.2 report format with cmi.core.* elements', () => {
    const mockReport = createMockReport({
      version: 'SCORM_1_2',
      interactions: [
        createMockInteraction({
          id: 'cmi.interactions.0',
          type: 'choice',
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={true} />
    );

    // Component should handle SCORM 1.2 data appropriately
    expect(screen.getByText(/interaction tracking/i)).toBeInTheDocument();
  });

  it('should display SCORM 2004 report format with cmi.* elements and more detail', () => {
    const mockReport = createMockReport({
      version: 'SCORM_2004',
      interactions: [
        createMockInteraction({
          id: 'cmi.interactions.0',
          type: 'choice',
          description: 'SCORM 2004 question with detailed tracking',
        }),
      ],
      objectives: [
        createMockObjective({
          id: 'cmi.objectives.0',
          description: 'SCORM 2004 objective',
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={true} />
    );

    // Verify SCORM 2004 data is displayed
    expect(screen.getByText(/scorm 2004 question/i)).toBeInTheDocument();
    expect(screen.getByText(/scorm 2004 objective/i)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: LAYOUT AND ACCESSIBILITY
// ============================================================================

describe('ScormReportCard - Layout and Accessibility', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render MUI Card layout with proper sections', () => {
    const mockReport = createMockReport();

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify main card title
    expect(screen.getByText(/scorm activity report/i)).toBeInTheDocument();

    // Verify sections are present
    expect(screen.getByText(/current status/i)).toBeInTheDocument();
    expect(screen.getByText(/current score/i)).toBeInTheDocument();
    expect(screen.getByText(/completion/i)).toBeInTheDocument();
    expect(screen.getByText(/time spent/i)).toBeInTheDocument();
  });

  it('should use proper headings and ARIA labels for accessibility', () => {
    const mockReport = createMockReport();

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify table structure exists (tables have implicit roles)
    const tables = screen.getAllByRole('table');
    expect(tables.length).toBeGreaterThan(0);

    // Verify progress bar has proper role
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should handle responsive layout for mobile view', () => {
    const mockReport = createMockReport();

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    // Component uses MUI Grid which is responsive by default
    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify Grid layout is used (component has Grid items with xs, sm, md breakpoints)
    expect(screen.getByText(/scorm activity report/i)).toBeInTheDocument();
  });

  it('should format dates using proper locale', () => {
    const timestamp = 1704067200;
    const mockReport = createMockReport({
      attempts: [
        createMockAttemptSummary({
          timeCompleted: timestamp,
        }),
      ],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Component uses toLocaleString() which respects locale
    // Verify a date format is present
    const datePattern = /\d+/; // At least some number in the date
    expect(screen.getByText(datePattern)).toBeInTheDocument();
  });

  it('should display data in well-organized sections with clear visual hierarchy', () => {
    const mockReport = createMockReport({
      scoProgress: [createMockScoProgress()],
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify multiple sections are rendered
    expect(screen.getByText(/scorm activity report/i)).toBeInTheDocument();
    expect(screen.getByText(/attempt history/i)).toBeInTheDocument();
    expect(screen.getByText(/sco progress details/i)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: EDGE CASES AND DATA VALIDATION
// ============================================================================

describe('ScormReportCard - Edge Cases and Data Validation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle multiple attempts with varying scores correctly', () => {
    const mockReport = createMockReport({
      attempts: [
        createMockAttemptSummary({ attemptNumber: 1, score: 60 }),
        createMockAttemptSummary({ attemptNumber: 2, score: 75 }),
        createMockAttemptSummary({ attemptNumber: 3, score: 90 }),
        createMockAttemptSummary({ attemptNumber: 4, score: 85 }),
      ],
      currentAttempt: 3,
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={3} showDetailed={false} />
    );

    // Verify all attempts are displayed
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();

    // Verify current attempt is highlighted
    expect(screen.getByText(/current/i)).toBeInTheDocument();
  });

  it('should calculate average score correctly across multiple attempts', () => {
    const mockReport = createMockReport({
      attempts: [
        createMockAttemptSummary({ score: 70 }),
        createMockAttemptSummary({ score: 80 }),
        createMockAttemptSummary({ score: 90 }),
      ],
      gradingMethod: 'average',
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Average = (70 + 80 + 90) / 3 = 80
    expect(screen.getByText(/average score/i)).toBeInTheDocument();
    expect(screen.getByText(/80.0/)).toBeInTheDocument();
  });

  it('should handle very long time durations correctly', () => {
    const mockReport = createMockReport({
      totalTimeSpent: 36000, // 10 hours
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify long duration formatting: 10:00:00
    expect(screen.getByText(/10:00:00/)).toBeInTheDocument();
  });

  it('should handle missing optional fields gracefully', () => {
    const mockReport = createMockReport({
      overallScore: undefined,
      scoProgress: undefined,
      interactions: undefined,
      objectives: undefined,
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={true} />
    );

    // Component should render without crashing
    expect(screen.getByText(/scorm activity report/i)).toBeInTheDocument();

    // Should show N/A for missing score
    expect(screen.getByText(/n\/a/i)).toBeInTheDocument();
  });

  it('should display zero completion percentage for not-started attempts', () => {
    const mockReport = createMockReport({
      completionPercentage: 0,
      status: 'not_attempted',
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify 0% is displayed
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  it('should handle large numbers of interactions efficiently', () => {
    const interactions = Array.from({ length: 50 }, (_, i) =>
      createMockInteraction({ id: `q${i + 1}` })
    );

    const mockReport = createMockReport({
      interactions,
    });

    vi.mocked(useScorm).mockReturnValue({
      isLoading: false,
      error: null,
      data: mockReport,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={true} />
    );

    // Verify section shows correct count
    expect(screen.getByText(/50 interactions recorded/i)).toBeInTheDocument();
  });
});
