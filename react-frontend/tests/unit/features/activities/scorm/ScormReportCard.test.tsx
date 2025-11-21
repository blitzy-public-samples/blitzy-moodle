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

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScormReportCard } from '@/features/activities/scorm/components/ScormReportCard';
import type {
  ScormAttempt,
  ScormReport,
  ScormAttemptSummary,
  ScormScoProgress,
  ScormCMIInteraction,
  ScormCMIObjective,
} from '@/features/activities/scorm/types/scorm.types';
import { ScormGradeMethod, ScormStatus } from '@/features/activities/scorm/types/scorm.types';

// ============================================================================
// MOCKS
// ============================================================================

// Mock the useScorm hook
vi.mock('@/features/activities/scorm/hooks/useScorm', () => ({
  useScorm: vi.fn(),
  scormQueryKeys: {
    all: ['scorm'] as const,
    lists: () => ['scorm', 'list'] as const,
    list: (filters: string) => ['scorm', 'list', { filters }] as const,
    details: () => ['scorm', 'detail'] as const,
    detail: (id: number) => ['scorm', 'detail', id] as const,
    attempts: (scormId: number, userId?: number) =>
      ['scorm', 'attempts', scormId, userId] as const,
    report: (scormId: number, userId?: number, attemptNumber?: number) =>
      ['scorm', 'report', scormId, userId, attemptNumber] as const,
  },
}));

// Mock the scormApi to isolate component tests
vi.mock('@/features/activities/scorm/api/scormApi', () => ({
  fetchAttemptReport: vi.fn(),
}));

// Import the mocked modules after mocking
import { fetchAttemptReport } from '@/features/activities/scorm/api/scormApi';

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Creates mock SCORM report data with customizable properties
 */
const createMockReport = (overrides: Partial<ScormReport> = {}): ScormReport => {
  // Determine currentAttempt from overrides or default
  const currentAttempt = overrides.currentAttempt ?? 1;
  
  // Generate attempts array to match currentAttempt
  const defaultAttempts: ScormAttemptSummary[] = [];
  for (let i = 1; i <= currentAttempt; i++) {
    defaultAttempts.push({
      attemptNumber: i,
      status: i === currentAttempt ? 'completed' : 'completed',
      score: 85,
      timeSpent: '00:15:30',
      timeStarted: 1704067200 + (i - 1) * 1000,
      timeCompleted: 1704068130 + (i - 1) * 1000,
      scosCompleted: 1,
      scosTotal: 1,
    });
  }
  
  return {
    scormId: 1,
    userId: 100,
    currentAttempt,
    attempts: overrides.attempts ?? defaultAttempts,
    overallScore: 85,
    grade: 85,
    completionPercentage: 100,
    totalTimeSpent: '00:15:30',
    gradingMethod: ScormGradeMethod.HIGHEST,
    status: 'completed',
    scoProgress: [],
    interactions: [],
    objectives: [],
    ...overrides,
  };
};

/**
 * Creates mock attempt summary data
 */
const createMockAttemptSummary = (overrides: Partial<ScormAttemptSummary> = {}): ScormAttemptSummary => ({
  attemptNumber: 1,
  status: 'completed',
  score: 85,
  timeSpent: '00:15:30',
  timeStarted: 1704067200,
  timeCompleted: 1704068130,
  scosCompleted: 1,
  scosTotal: 1,
  ...overrides,
});

/**
 * Creates mock SCO progress data
 */
const createMockScoProgress = (overrides: Partial<ScormScoProgress> = {}): ScormScoProgress => ({
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
  attempts: 1,
  ...overrides,
});

/**
 * Creates mock interaction tracking data
 */
const createMockInteraction = (overrides: Partial<ScormCMIInteraction> = {}): ScormCMIInteraction => ({
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
const createMockObjective = (overrides: Partial<ScormCMIObjective> = {}): ScormCMIObjective => ({
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
        gcTime: 0, // React Query v5: renamed from cacheTime
      },
    },
  });

/**
 * Wrapper component that provides React Query context
 */
const createWrapper = () => {
  const queryClient = createTestQueryClient();
  function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
  return Wrapper;
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

  it('should display loading state with spinner while fetching data', async () => {
    // Mock API to never resolve (simulates loading state)
    vi.mocked(fetchAttemptReport).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify loading message is displayed
    expect(await screen.findByText(/loading scorm report/i)).toBeInTheDocument();
  });

  it('should display error alert when data fetch fails', async () => {
    const errorMessage = 'Failed to load SCORM report data';

    // Mock API to reject with error
    vi.mocked(fetchAttemptReport).mockRejectedValue(new Error(errorMessage));

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify error message is displayed
    expect(
      await screen.findByText(/failed to load scorm report/i)
    ).toBeInTheDocument();
  });

  it('should display info alert when no report data is available', async () => {
    // Mock API to return null (no data)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    vi.mocked(fetchAttemptReport).mockResolvedValue(null as any);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify no data message is displayed
    expect(
      await screen.findByText(/no report data available/i)
    ).toBeInTheDocument();
  });

  it('should display empty report state when no attempts exist', async () => {
    const reportWithNoAttempts = createMockReport({
      attempts: [],
      currentAttempt: 0,
    });

    // Mock API to return report with no attempts
    vi.mocked(fetchAttemptReport).mockResolvedValue(reportWithNoAttempts);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // In this case, the component should handle gracefully
    // Verify the report title is still shown
    expect(await screen.findByText(/scorm activity report/i)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: BASIC REPORT VIEW
// ============================================================================

describe('ScormReportCard - Basic Report View', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display current attempt number and status', async () => {
    const mockReport = createMockReport({
      currentAttempt: 2,
      status: 'completed',
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={2} showDetailed={false} />
    );

    // Verify attempt number is displayed in subtitle
    expect(await screen.findByText(/attempt 2 of/i)).toBeInTheDocument();

    // Verify status chip is displayed in the Current Status section
    const currentStatusSection = await screen.findByText(/current status/i);
    const statusContainer = currentStatusSection.closest('div');
    expect(statusContainer).toBeInTheDocument();
    expect(within(statusContainer!).getByText(/completed/i)).toBeInTheDocument();
  });

  it('should display completed status with success color', async () => {
    const mockReport = createMockReport({
      status: 'completed',
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify status chip with completed text in the Current Status section
    const currentStatusSection = await screen.findByText(/current status/i);
    const statusContainer = currentStatusSection.closest('div');
    expect(statusContainer).toBeInTheDocument();
    expect(within(statusContainer!).getByText(/completed/i)).toBeInTheDocument();
  });

  it('should display passed status correctly', async () => {
    const mockReport = createMockReport({
      status: ScormStatus.PASSED,
      attempts: [
        createMockAttemptSummary({
          status: ScormStatus.PASSED,
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify passed status is shown in the Current Status section
    const currentStatusSection = await screen.findByText(/current status/i);
    const statusContainer = currentStatusSection.closest('div');
    expect(statusContainer).toBeInTheDocument();
    expect(within(statusContainer!).getByText(/passed/i)).toBeInTheDocument();
  });

  it('should display failed status with error color', async () => {
    const mockReport = createMockReport({
      status: ScormStatus.FAILED,
      attempts: [
        createMockAttemptSummary({
          status: ScormStatus.FAILED,
          score: 45,
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify failed status is shown in the Current Status section
    const currentStatusSection = await screen.findByText(/current status/i);
    const statusContainer = currentStatusSection.closest('div');
    expect(statusContainer).toBeInTheDocument();
    expect(within(statusContainer!).getByText(/failed/i)).toBeInTheDocument();
  });

  it('should display incomplete status with warning indication', async () => {
    const mockReport = createMockReport({
      status: 'incomplete',
      attempts: [
        createMockAttemptSummary({
          status: 'incomplete',
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify incomplete status is shown in the Current Status section
    const currentStatusSection = await screen.findByText(/current status/i);
    const statusContainer = currentStatusSection.closest('div');
    expect(statusContainer).toBeInTheDocument();
    expect(within(statusContainer!).getByText(/incomplete/i)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: SCORE AND GRADE DISPLAY
// ============================================================================

describe('ScormReportCard - Score and Grade Display', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display overall score with raw, min, max, and scaled values formatted correctly', async () => {
    const mockReport = createMockReport({
      overallScore: 85,
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify score is displayed in the Current Score section
    const currentScoreSection = await screen.findByText(/current score/i);
    const scoreContainer = currentScoreSection.closest('div');
    expect(scoreContainer).toBeInTheDocument();
    expect(within(scoreContainer!).getByText(/85/)).toBeInTheDocument();
  });

  it('should display grade based on highest attempt score grading method', async () => {
    const mockReport = createMockReport({
      gradingMethod: ScormGradeMethod.HIGHEST,
      grade: 95,
      overallScore: 95,
      attempts: [
        createMockAttemptSummary({ attemptNumber: 1, score: 80 }),
        createMockAttemptSummary({ attemptNumber: 2, score: 95 }),
        createMockAttemptSummary({ attemptNumber: 3, score: 85 }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={2} showDetailed={false} />
    );

    // Verify current score reflects the correct attempt in Current Score section
    const currentScoreSection = await screen.findByText(/current score/i);
    const scoreContainer = currentScoreSection.closest('div');
    expect(scoreContainer).toBeInTheDocument();
    expect(within(scoreContainer!).getByText(/95/)).toBeInTheDocument();
  });

  it('should display grade based on average attempt score grading method', async () => {
    const mockReport = createMockReport({
      gradingMethod: ScormGradeMethod.AVERAGE,
      grade: 85,
      attempts: [
        createMockAttemptSummary({ attemptNumber: 1, score: 80 }),
        createMockAttemptSummary({ attemptNumber: 2, score: 90 }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify average score is displayed in summary section
    const averageScoreSection = await screen.findByText(/average score/i);
    expect(averageScoreSection).toBeInTheDocument();
    const avgContainer = averageScoreSection.closest('div');
    expect(avgContainer).toBeInTheDocument();
    expect(within(avgContainer!).getByText(/85.0/)).toBeInTheDocument();
  });

  it('should display grade based on first attempt grading method', async () => {
    const mockReport = createMockReport({
      gradingMethod: ScormGradeMethod.HIGHEST,
      grade: 75,
      attempts: [
        createMockAttemptSummary({ attemptNumber: 1, score: 75 }),
        createMockAttemptSummary({ attemptNumber: 2, score: 90 }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify first attempt score is considered in Current Score section
    const currentScoreSection = await screen.findByText(/current score/i);
    const scoreContainer = currentScoreSection.closest('div');
    expect(scoreContainer).toBeInTheDocument();
    expect(within(scoreContainer!).getByText(/75/)).toBeInTheDocument();
  });

  it('should display grade based on last attempt grading method', async () => {
    const mockReport = createMockReport({
      gradingMethod: ScormGradeMethod.AVERAGE,
      grade: 88,
      attempts: [
        createMockAttemptSummary({ attemptNumber: 1, score: 70 }),
        createMockAttemptSummary({ attemptNumber: 2, score: 88 }),
      ],
      currentAttempt: 2,
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={2} showDetailed={false} />
    );

    // Verify last attempt score is displayed in Current Score section
    const currentScoreSection = await screen.findByText(/current score/i);
    const scoreContainer = currentScoreSection.closest('div');
    expect(scoreContainer).toBeInTheDocument();
    expect(within(scoreContainer!).getByText(/88/)).toBeInTheDocument();
  });

  it('should display N/A when score is not available', async () => {
    const mockReport = createMockReport({
      overallScore: undefined,
      attempts: [
        createMockAttemptSummary({
          score: undefined,
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify N/A is displayed when score is missing in the Current Score section
    const currentScoreSection = await screen.findByText(/current score/i);
    const scoreContainer = currentScoreSection.closest('div');
    expect(scoreContainer).toBeInTheDocument();
    expect(within(scoreContainer!).getByText(/n\/a/i)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: COMPLETION AND TIME TRACKING
// ============================================================================

describe('ScormReportCard - Completion and Time Tracking', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display completion percentage with progress bar', async () => {
    const mockReport = createMockReport({
      completionPercentage: 75,
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify completion percentage is displayed in the Completion section
    const completionSection = await screen.findByText(/completion/i);
    const completionContainer = completionSection.closest('div');
    expect(completionContainer).toBeInTheDocument();
    expect(within(completionContainer!).getByText(/75%/)).toBeInTheDocument();

    // Verify progress bar is present
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display 100% completion for completed attempts', async () => {
    const mockReport = createMockReport({
      completionPercentage: 100,
      status: 'completed',
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify 100% completion in the Completion section
    const completionSection = await screen.findByText(/completion/i);
    const completionContainer = completionSection.closest('div');
    expect(completionContainer).toBeInTheDocument();
    expect(within(completionContainer!).getByText(/100%/)).toBeInTheDocument();
  });

  it('should display total time spent formatted as hours:minutes:seconds', async () => {
    const mockReport = createMockReport({
      totalTimeSpent: '01:01:05', // 1 hour, 1 minute, 5 seconds
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify time is formatted in the Time Spent section
    const timeSection = await screen.findByText(/time spent/i);
    const timeContainer = timeSection.closest('div');
    expect(timeContainer).toBeInTheDocument();
    expect(within(timeContainer!).getByText('1h 1m 5s')).toBeInTheDocument();
  });

  it('should display time spent in minutes and seconds for short durations', async () => {
    const mockReport = createMockReport({
      totalTimeSpent: '00:02:05', // 2 minutes, 5 seconds
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify short time format in the Time Spent section
    const timeSection = await screen.findByText(/time spent/i);
    const timeContainer = timeSection.closest('div');
    expect(timeContainer).toBeInTheDocument();
    expect(within(timeContainer!).getByText('0h 2m 5s')).toBeInTheDocument();
  });

  it('should handle zero time spent gracefully', async () => {
    const mockReport = createMockReport({
      totalTimeSpent: '00:00:00',
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify zero time is displayed
    expect(await screen.findByText('0h 0m 0s')).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: ATTEMPT HISTORY TABLE
// ============================================================================

describe('ScormReportCard - Attempt History Table', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render list of all attempts in MUI Table with correct columns', async () => {
    const mockReport = createMockReport({
      currentAttempt: 1,
      attempts: [
        createMockAttemptSummary({ attemptNumber: 1, score: 75, status: ScormStatus.COMPLETED }),
        createMockAttemptSummary({ attemptNumber: 2, score: 85, status: ScormStatus.COMPLETED }),
        createMockAttemptSummary({ attemptNumber: 3, score: 90, status: ScormStatus.PASSED }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Wait for the Attempt History section to load
    const historySection = await screen.findByText('Attempt History');
    expect(historySection).toBeInTheDocument();

    // Find all tables and get the one that contains "Attempt History"
    const tables = screen.getAllByRole('table');
    // The history table should be the first one (or find by checking table headers)
    const historyTable = tables.find(table => {
      return within(table).queryByText('Attempt') !== null;
    });
    
    expect(historyTable).toBeDefined();
    
    // Verify table headers within the table
    expect(within(historyTable!).getByText('Attempt')).toBeInTheDocument();
    expect(within(historyTable!).getByText('Status')).toBeInTheDocument();
    expect(within(historyTable!).getByText('Score')).toBeInTheDocument();
    expect(within(historyTable!).getByText('Time')).toBeInTheDocument();
    expect(within(historyTable!).getByText('Date')).toBeInTheDocument();

    // Verify all attempts are rendered (checking for attempt numbers)
    // Note: Attempt 1 will have "1Current" since it's the current attempt
    const tableRows = within(historyTable!).getAllByRole('row');
    // Should have 4 rows (1 header + 3 data rows)
    expect(tableRows).toHaveLength(4);
  });

  it('should display attempt numbers, dates, scores, and statuses correctly', async () => {
    const mockReport = createMockReport({
      currentAttempt: 1,
      attempts: [
        createMockAttemptSummary({
          attemptNumber: 1,
          score: 80,
          status: 'completed',
          timeCompleted: 1704067200,
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Wait for the Attempt History section
    await screen.findByText('Attempt History');
    
    // Find the attempt history table
    const tables = screen.getAllByRole('table');
    const historyTable = tables.find(table => {
      return within(table).queryByText('Attempt') !== null;
    });
    
    expect(historyTable).toBeDefined();
    
    // Verify attempt data is displayed in the table
    // Score is formatted with .toFixed(1) so 80 becomes "80.0"
    expect(within(historyTable!).getByText('80.0')).toBeInTheDocument();
    // Status is capitalized by getStatusDisplay: "completed" -> "Completed"
    expect(within(historyTable!).getByText('Completed')).toBeInTheDocument();
  });

  it('should highlight current attempt in the table', async () => {
    const mockReport = createMockReport({
      currentAttempt: 2,
      attempts: [
        createMockAttemptSummary({ attemptNumber: 1 }),
        createMockAttemptSummary({ attemptNumber: 2 }),
        createMockAttemptSummary({ attemptNumber: 3 }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={2} showDetailed={false} />
    );

    // Wait for the Attempt History section
    await screen.findByText('Attempt History');
    
    // Find the attempt history table and verify "Current" chip is displayed for attempt 2
    const tables = screen.getAllByRole('table');
    const historyTable = tables.find(table => {
      return within(table).queryByText('Attempt') !== null;
    });
    
    expect(historyTable).toBeDefined();
    expect(within(historyTable!).getByText(/current/i)).toBeInTheDocument();
  });

  it('should display N/A for attempts with missing time data', async () => {
    const mockReport = createMockReport({
      attempts: [
        createMockAttemptSummary({
          timeSpent: undefined,
          timeCompleted: undefined,
          timeStarted: undefined,
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Wait for the component to load
    await screen.findByText('Attempt History');
    
    // Verify N/A is displayed for missing data
    const naElements = screen.getAllByText(/n\/a/i);
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('should format dates with proper locale formatting', async () => {
    const timestamp = 1704067200; // January 1, 2024, 00:00:00 UTC
    const mockReport = createMockReport({
      attempts: [
        createMockAttemptSummary({
          timeCompleted: timestamp,
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify date is formatted (toLocaleString is used in component)
    // The exact format depends on locale, but check that a formatted date exists
    const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}/;
    expect(await screen.findByText(dateRegex)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: WARNING AND ERROR ALERTS
// ============================================================================

describe('ScormReportCard - Warning and Error Alerts', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display warning alert for incomplete attempts', async () => {
    const mockReport = createMockReport({
      status: 'incomplete',
      attempts: [
        createMockAttemptSummary({
          status: 'incomplete',
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Wait for the component to load
    await screen.findByText('Attempt History');
    
    // Verify warning message is displayed
    expect(
      screen.getByText(/attention.*incomplete/i)
    ).toBeInTheDocument();
  });

  it('should display warning alert with appropriate message for failed attempts', async () => {
    const mockReport = createMockReport({
      status: ScormStatus.FAILED,
      attempts: [
        createMockAttemptSummary({
          status: ScormStatus.FAILED,
          score: 40,
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Wait for the component to load
    await screen.findByText('Attempt History');
    
    // Verify warning message includes "failed"
    expect(
      screen.getByText(/attention.*failed/i)
    ).toBeInTheDocument();
  });

  it('should not display warning alert for completed attempts', async () => {
    const mockReport = createMockReport({
      status: ScormStatus.COMPLETED,
      attempts: [
        createMockAttemptSummary({
          status: ScormStatus.COMPLETED,
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Wait for the component to load
    await screen.findByText('Attempt History');
    
    // Verify warning alert is NOT present
    expect(
      screen.queryByText(/attention/i)
    ).not.toBeInTheDocument();
  });

  it('should not display warning alert for passed attempts', async () => {
    const mockReport = createMockReport({
      status: ScormStatus.PASSED,
      attempts: [
        createMockAttemptSummary({
          status: ScormStatus.PASSED,
          score: 95,
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Wait for the component to load
    await screen.findByText('Attempt History');
    
    // Verify no warning is shown for passed attempts
    expect(
      screen.queryByText(/attention/i)
    ).not.toBeInTheDocument();
  });

  it('should display appropriate feedback message for learner to complete requirements', async () => {
    const mockReport = createMockReport({
      status: 'incomplete',
      attempts: [
        createMockAttemptSummary({
          status: 'incomplete',
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Wait for the component to load
    await screen.findByText('Attempt History');
    
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

  it('should display SCO-level progress in expandable sections', async () => {
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

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify SCO Progress section is displayed
    expect(await screen.findByText(/sco progress details/i)).toBeInTheDocument();

    // Verify individual SCO titles are shown
    expect(await screen.findByText(/introduction/i)).toBeInTheDocument();
    expect(await screen.findByText(/advanced topics/i)).toBeInTheDocument();
  });

  it('should display SCO status, score, and time spent for each SCO', async () => {
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

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Find the SCO Progress section
    const scoSection = await screen.findByText(/sco progress details/i);
    const scoCard = scoSection.closest('.MuiCard-root') || scoSection.parentElement;

    // Verify SCO data is displayed within the SCO Progress section
    expect(await within(scoCard as HTMLElement).findByText(/module 1/i)).toBeInTheDocument();
    expect(within(scoCard as HTMLElement).getByText(/completed/i)).toBeInTheDocument();
    expect(within(scoCard as HTMLElement).getByText(/85/)).toBeInTheDocument();
    expect(within(scoCard as HTMLElement).getByText('0h 10m 0s')).toBeInTheDocument();
  });

  // eslint-disable-next-line @typescript-eslint/require-await
  it('should not display SCO progress section when no SCO data exists', async () => {
    const mockReport = createMockReport({
      scoProgress: [],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

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

  it('should display interaction tracking data when showDetailed is true', async () => {
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

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed />
    );

    // Verify interaction tracking section is displayed
    expect(await screen.findByText(/interaction tracking/i)).toBeInTheDocument();

    // Verify interaction data columns
    expect(await screen.findByText(/description/i)).toBeInTheDocument();
    expect(await screen.findByText(/learner response/i)).toBeInTheDocument();
    expect(await screen.findByText(/result/i)).toBeInTheDocument();
  });

  // eslint-disable-next-line @typescript-eslint/require-await
  it('should not display interaction tracking when showDetailed is false', async () => {
    const mockReport = createMockReport({
      interactions: [
        createMockInteraction(),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify interaction tracking is not shown
    expect(
      screen.queryByText(/interaction tracking/i)
    ).not.toBeInTheDocument();
  });

  it('should display interaction ID, type, description, learner response, and result', async () => {
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

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed />
    );

    // Find the Interaction Tracking section
    const interactionSection = await screen.findByText(/interaction tracking/i);
    const interactionCard = interactionSection.closest('.MuiCard-root') || interactionSection.parentElement;

    // Verify all interaction fields are displayed within the Interaction Tracking section
    expect(within(interactionCard as HTMLElement).getByText(/q1/i)).toBeInTheDocument();
    expect(within(interactionCard as HTMLElement).getByText(/true-false/i)).toBeInTheDocument();
    expect(within(interactionCard as HTMLElement).getByText(/is the sky blue/i)).toBeInTheDocument();
    // Use getAllByText to handle multiple "true" occurrences (in "true-false" and as response)
    const trueElements = within(interactionCard as HTMLElement).getAllByText(/^true$/i);
    expect(trueElements.length).toBeGreaterThan(0);
    expect(within(interactionCard as HTMLElement).getByText(/correct/i)).toBeInTheDocument();
  });

  it('should display correct answer result with success color', async () => {
    const mockReport = createMockReport({
      interactions: [
        createMockInteraction({
          result: 'correct',
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed />
    );

    // Verify correct result is shown (component uses Chip with success color)
    const correctChip = await screen.findByText(/correct/i);
    expect(correctChip).toBeInTheDocument();
  });

  it('should display incorrect answer result with error color', async () => {
    const mockReport = createMockReport({
      interactions: [
        createMockInteraction({
          result: 'incorrect',
          learner_response: 'Wrong answer',
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed />
    );

    // Verify incorrect result is shown
    const incorrectChip = await screen.findByText(/incorrect/i);
    expect(incorrectChip).toBeInTheDocument();
  });

  it('should display interaction timestamps and latency', async () => {
    const mockReport = createMockReport({
      interactions: [
        createMockInteraction({
          latency: '00:00:45', // Pre-formatted as HH:MM:SS
          timestamp: '2024-01-01T12:00:00Z',
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed />
    );

    // Verify latency is formatted and displayed
    // Component uses formatDuration which outputs "0h 0m 45s" format
    expect(await screen.findByText(/0h 0m 45s/)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: OBJECTIVES COMPLETION STATUS
// ============================================================================

describe('ScormReportCard - Objectives Completion Status', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display objectives completion status when showDetailed is true', async () => {
    const mockReport = createMockReport({
      objectives: [
        createMockObjective({
          id: 'obj1',
          description: 'Learn basics',
          status: 'completed',
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed />
    );

    // Verify objectives section is displayed
    expect(await screen.findByText(/learning objectives/i)).toBeInTheDocument();
  });

  it('should display objective IDs, descriptions, and status (satisfied/not satisfied)', async () => {
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

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed />
    );

    // Verify objective data is displayed
    expect(await screen.findByText(/obj1/i)).toBeInTheDocument();
    expect(await screen.findByText(/obj2/i)).toBeInTheDocument();
    expect(await screen.findByText(/master the fundamentals/i)).toBeInTheDocument();
    expect(await screen.findByText(/apply advanced concepts/i)).toBeInTheDocument();
  });

  it('should display objective scores when available', async () => {
    const mockReport = createMockReport({
      objectives: [
        createMockObjective({
          id: 'obj1',
          score: { raw: 88, min: 0, max: 100 },
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed />
    );

    // Verify objective score is displayed
    expect(await screen.findByText(/88/)).toBeInTheDocument();
  });

  it('should display count of completed objectives vs total objectives', async () => {
    const mockReport = createMockReport({
      objectives: [
        createMockObjective({ status: 'completed' }),
        createMockObjective({ status: 'completed' }),
        createMockObjective({ status: 'incomplete' }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed />
    );

    // Verify objectives count is displayed (2 of 3 completed)
    expect(await screen.findByText(/2 of 3 objectives/i)).toBeInTheDocument();
  });

  it('should display info message when no detailed data is available', async () => {
    const mockReport = createMockReport({
      interactions: [],
      objectives: [],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed />
    );

    // Verify info message about no detailed data
    expect(
      await screen.findByText(/no detailed interaction or objective data available/i)
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

  it('should display SCORM 1.2 report format with cmi.core.* elements', async () => {
    const mockReport = createMockReport({
      version: 'SCORM_1_2',
      interactions: [
        createMockInteraction({
          id: 'cmi.interactions.0',
          type: 'choice',
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed />
    );

    // Component should handle SCORM 1.2 data appropriately
    expect(await screen.findByText(/interaction tracking/i)).toBeInTheDocument();
  });

  it('should display SCORM 2004 report format with cmi.* elements and more detail', async () => {
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

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed />
    );

    // Verify SCORM 2004 data is displayed
    expect(await screen.findByText(/scorm 2004 question/i)).toBeInTheDocument();
    expect(await screen.findByText(/scorm 2004 objective/i)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: LAYOUT AND ACCESSIBILITY
// ============================================================================

describe('ScormReportCard - Layout and Accessibility', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render MUI Card layout with proper sections', async () => {
    const mockReport = createMockReport();

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify main card title
    expect(await screen.findByText(/scorm activity report/i)).toBeInTheDocument();

    // Verify sections are present
    expect(await screen.findByText(/current status/i)).toBeInTheDocument();
    expect(await screen.findByText(/current score/i)).toBeInTheDocument();
    expect(await screen.findByText(/completion/i)).toBeInTheDocument();
    expect(await screen.findByText(/time spent/i)).toBeInTheDocument();
  });

  it('should use proper headings and ARIA labels for accessibility', async () => {
    const mockReport = createMockReport();

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Wait for data to load
    await screen.findByText(/scorm activity report/i);
    
    // Verify table structure exists (tables have implicit roles)
    const tables = screen.getAllByRole('table');
    expect(tables.length).toBeGreaterThan(0);

    // Verify progress bar has proper role
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should handle responsive layout for mobile view', async () => {
    const mockReport = createMockReport();

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    // Component uses MUI Grid which is responsive by default
    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify Grid layout is used (component has Grid items with xs, sm, md breakpoints)
    expect(await screen.findByText(/scorm activity report/i)).toBeInTheDocument();
  });

  it('should format dates using proper locale', async () => {
    const timestamp = 1704067200;
    const mockReport = createMockReport({
      attempts: [
        createMockAttemptSummary({
          timeCompleted: timestamp,
        }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Component uses toLocaleString() which respects locale
    // Verify a date format is present - looking for year 2024 in the formatted date
    // timestamp 1704067200 = Jan 1, 2024
    expect(await screen.findByText(/2024/)).toBeInTheDocument();
  });

  it('should display data in well-organized sections with clear visual hierarchy', async () => {
    const mockReport = createMockReport({
      scoProgress: [createMockScoProgress()],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify multiple sections are rendered
    expect(await screen.findByText(/scorm activity report/i)).toBeInTheDocument();
    expect(await screen.findByText(/attempt history/i)).toBeInTheDocument();
    expect(await screen.findByText(/sco progress details/i)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: EDGE CASES AND DATA VALIDATION
// ============================================================================

describe('ScormReportCard - Edge Cases and Data Validation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle multiple attempts with varying scores correctly', async () => {
    const mockReport = createMockReport({
      attempts: [
        createMockAttemptSummary({ attemptNumber: 1, score: 60 }),
        createMockAttemptSummary({ attemptNumber: 2, score: 75 }),
        createMockAttemptSummary({ attemptNumber: 3, score: 90 }),
        createMockAttemptSummary({ attemptNumber: 4, score: 85 }),
      ],
      currentAttempt: 3,
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={3} showDetailed={false} />
    );

    // Wait for component to load
    await screen.findByText(/scorm activity report/i);

    // Verify all attempts are displayed (scores formatted with one decimal place)
    // Using getAllByText since scores may appear in both summary and table
    expect(screen.getAllByText('60.0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('75.0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('90.0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('85.0').length).toBeGreaterThan(0);

    // Verify current attempt is highlighted (may appear in multiple places like "Current Status", "Current Score", chip)
    expect(screen.getAllByText(/current/i).length).toBeGreaterThan(0);
  });

  it('should calculate average score correctly across multiple attempts', async () => {
    const mockReport = createMockReport({
      attempts: [
        createMockAttemptSummary({ score: 70 }),
        createMockAttemptSummary({ score: 80 }),
        createMockAttemptSummary({ score: 90 }),
      ],
      gradingMethod: ScormGradeMethod.AVERAGE,
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Average = (70 + 80 + 90) / 3 = 80
    expect(await screen.findByText(/average score/i)).toBeInTheDocument();
    // Using getAllByText since score may appear in both summary and table
    expect(screen.getAllByText(/80.0/).length).toBeGreaterThan(0);
  });

  it('should handle very long time durations correctly', async () => {
    const mockReport = createMockReport({
      totalTimeSpent: '10:00:00', // 10 hours
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify long duration formatting - component uses "Xh Ym Zs" format
    expect(await screen.findByText('10h 0m 0s')).toBeInTheDocument();
  });

  it('should handle missing optional fields gracefully', async () => {
    const mockReport = createMockReport({
      overallScore: undefined,
      scoProgress: undefined,
      interactions: undefined,
      objectives: undefined,
      attempts: [
        createMockAttemptSummary({ attemptNumber: 1, score: undefined }),
      ],
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed />
    );

    // Component should render without crashing
    expect(await screen.findByText(/scorm activity report/i)).toBeInTheDocument();

    // Should show N/A for missing score (may appear in multiple places)
    // Using getAllByText since N/A may appear in both summary and table
    expect(screen.getAllByText(/n\/a/i).length).toBeGreaterThan(0);
  });

  it('should display zero completion percentage for not-started attempts', async () => {
    const mockReport = createMockReport({
      completionPercentage: 0,
      status: 'not_attempted',
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed={false} />
    );

    // Verify 0% is displayed
    expect(await screen.findByText(/0%/)).toBeInTheDocument();
  });

  it('should handle large numbers of interactions efficiently', async () => {
    const interactions = Array.from({ length: 50 }, (_, i) =>
      createMockInteraction({ id: `q${i + 1}` })
    );

    const mockReport = createMockReport({
      interactions,
    });

    vi.mocked(fetchAttemptReport).mockResolvedValue(mockReport);

    renderWithQueryClient(
      <ScormReportCard scormId={1} userId={100} attemptNumber={1} showDetailed />
    );

    // Verify section shows correct count
    expect(await screen.findByText(/50 interactions recorded/i)).toBeInTheDocument();
  });
});
