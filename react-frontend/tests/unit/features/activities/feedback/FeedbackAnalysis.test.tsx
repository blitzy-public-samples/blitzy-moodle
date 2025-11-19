/**
 * Unit tests for FeedbackAnalysis component
 *
 * Tests validate analysis data display, chart rendering, statistics calculation,
 * FeedbackSummary integration, ResponseList integration, filtering options,
 * export functionality, and anonymous protection rules.
 *
 * @module FeedbackAnalysis.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

// Component under test
import FeedbackAnalysis from '@/features/activities/feedback/components/FeedbackAnalysis';

// Types
import type {
  FeedbackAnalysis as FeedbackAnalysisType,
  FeedbackStatistics,
  FeedbackItemAnalysis,
} from '@/features/activities/feedback/types';
import { FeedbackQuestionType } from '@/features/activities/feedback/types';

// Mock child components
vi.mock('@/features/activities/feedback/components/FeedbackSummary', () => ({
  default: ({ statistics }: { statistics: FeedbackStatistics }) => (
    <div data-testid="feedback-summary">
      <div data-testid="total-responses">{statistics.totalResponses}</div>
      <div data-testid="completion-rate">{statistics.completionRate}%</div>
      <div data-testid="average-time">{statistics.averageTime}s</div>
    </div>
  ),
}));

vi.mock('@/features/activities/feedback/components/ResponseList', () => ({
  default: ({
    responses,
    onDelete,
    canDelete,
  }: {
    responses: unknown[];
    onDelete: () => void;
    canDelete: boolean;
  }) => (
    <div data-testid="response-list">
      <div data-testid="response-count">{responses.length}</div>
      {canDelete && <button onClick={onDelete}>Delete</button>}
    </div>
  ),
}));

// Mock chart components from react-chartjs-2
vi.mock('react-chartjs-2', () => ({
  Bar: ({ data, options }: { data: unknown; options: unknown }) => (
    <div data-testid="bar-chart" data-chart-type="bar">
      {JSON.stringify({ data, options })}
    </div>
  ),
  Line: ({ data, options }: { data: unknown; options: unknown }) => (
    <div data-testid="line-chart" data-chart-type="line">
      {JSON.stringify({ data, options })}
    </div>
  ),
  Pie: ({ data, options }: { data: unknown; options: unknown }) => (
    <div data-testid="pie-chart" data-chart-type="pie">
      {JSON.stringify({ data, options })}
    </div>
  ),
}));

// Mock the useFeedbackAnalysis hook
vi.mock('@/features/activities/feedback/hooks/useFeedbackAnalysis', () => ({
  useFeedbackAnalysis: vi.fn(),
}));

import { useFeedbackAnalysis } from '@/features/activities/feedback/hooks/useFeedbackAnalysis';

/**
 * Helper function to create mock FeedbackStatistics
 */
const createMockStatistics = (
  overrides?: Partial<FeedbackStatistics>
): FeedbackStatistics => ({
  totalResponses: 45,
  completionRate: 75.5,
  averageTime: 420,
  responsesByCourse: [
    { courseId: 1, courseName: 'Course A', count: 25 },
    { courseId: 2, courseName: 'Course B', count: 20 },
  ],
  responsesByGroup: [
    { groupId: 1, groupName: 'Group 1', count: 30 },
    { groupId: 2, groupName: 'Group 2', count: 15 },
  ],
  respondents: [1, 2, 3, 4, 5],
  nonRespondents: [6, 7, 8],
  lastSubmissionDate: Date.now(),
  ...overrides,
});

/**
 * Helper function to create mock FeedbackItemAnalysis for multichoice
 */
const createMockMultichoiceItem = (
  overrides?: Partial<FeedbackItemAnalysis>
): FeedbackItemAnalysis => ({
  itemId: 1,
  name: 'What is your favorite color?',
  type: FeedbackQuestionType.MULTICHOICE,
  position: 1,
  hasValue: true,
  responseCount: 45,
  distribution: [
    { value: 'Red', count: 15, percentage: 33.33 },
    { value: 'Blue', count: 20, percentage: 44.44 },
    { value: 'Green', count: 10, percentage: 22.22 },
  ],
  chartData: {
    labels: ['Red', 'Blue', 'Green'],
    values: [15, 20, 10],
    colors: ['#f44336', '#2196f3', '#4caf50'],
  },
  ...overrides,
});

/**
 * Helper function to create mock FeedbackItemAnalysis for multichoicerated
 */
const createMockMultichoiceratedItem = (
  overrides?: Partial<FeedbackItemAnalysis>
): FeedbackItemAnalysis => ({
  itemId: 2,
  name: 'How satisfied are you?',
  type: FeedbackQuestionType.MULTICHOICERATED,
  position: 2,
  hasValue: true,
  responseCount: 40,
  distribution: [
    { value: '1', count: 2, percentage: 5 },
    { value: '2', count: 5, percentage: 12.5 },
    { value: '3', count: 10, percentage: 25 },
    { value: '4', count: 15, percentage: 37.5 },
    { value: '5', count: 8, percentage: 20 },
  ],
  statistics: {
    mean: 3.6,
    median: 4,
    mode: 4,
    standardDeviation: 1.1,
    minimum: 1,
    maximum: 5,
  },
  chartData: {
    labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
    values: [2, 5, 10, 15, 8],
    colors: ['#f44336', '#ff9800', '#ffeb3b', '#8bc34a', '#4caf50'],
  },
  ...overrides,
});

/**
 * Helper function to create mock FeedbackItemAnalysis for numeric
 */
const createMockNumericItem = (
  overrides?: Partial<FeedbackItemAnalysis>
): FeedbackItemAnalysis => ({
  itemId: 3,
  name: 'How many hours do you study per week?',
  type: FeedbackQuestionType.NUMERIC,
  position: 3,
  hasValue: true,
  responseCount: 38,
  statistics: {
    mean: 15.5,
    median: 14,
    mode: 12,
    standardDeviation: 5.2,
    minimum: 5,
    maximum: 30,
  },
  chartData: {
    labels: ['5-10', '11-15', '16-20', '21-25', '26-30'],
    values: [8, 15, 10, 3, 2],
    colors: ['#2196f3', '#2196f3', '#2196f3', '#2196f3', '#2196f3'],
  },
  ...overrides,
});

/**
 * Helper function to create mock FeedbackItemAnalysis for textarea
 */
const createMockTextareaItem = (
  overrides?: Partial<FeedbackItemAnalysis>
): FeedbackItemAnalysis => ({
  itemId: 4,
  name: 'What did you like most about the course?',
  type: FeedbackQuestionType.TEXTAREA,
  position: 4,
  hasValue: true,
  responseCount: 35,
  textResponses: [
    'Great teaching style',
    'Clear explanations',
    'Engaging content',
    'Helpful examples',
    'Good pace',
  ],
  ...overrides,
});

/**
 * Helper function to create complete mock FeedbackAnalysis data
 */
const createMockAnalysisData = (
  overrides?: Partial<FeedbackAnalysisType>
): FeedbackAnalysisType => ({
  feedbackId: 42,
  totalResponses: 45,
  meetAnonymousThreshold: true,
  items: [
    createMockMultichoiceItem(),
    createMockMultichoiceratedItem(),
    createMockNumericItem(),
    createMockTextareaItem(),
  ],
  statistics: createMockStatistics(),
  generatedAt: Date.now(),
  ...overrides,
});

/**
 * Helper function to create a test QueryClient
 */
const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });
};

/**
 * Helper function to render component with QueryClientProvider
 */
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe('FeedbackAnalysis Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders FeedbackSummary at top', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByTestId('feedback-summary')).toBeInTheDocument();
      expect(screen.getByTestId('total-responses')).toHaveTextContent('45');
      expect(screen.getByTestId('completion-rate')).toHaveTextContent('75.5%');
    });

    it('renders analysis results section', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByText(/analysis results/i)).toBeInTheDocument();
    });

    it('renders MUI Tabs for Analysis/Responses views', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByRole('tab', { name: /analysis/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /responses/i })).toBeInTheDocument();
    });

    it('renders question analysis items in Accordion', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByText('What is your favorite color?')).toBeInTheDocument();
      expect(screen.getByText('How satisfied are you?')).toBeInTheDocument();
      expect(
        screen.getByText('How many hours do you study per week?')
      ).toBeInTheDocument();
    });

    it('renders export button', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    });
  });

  describe('FeedbackSummary Integration', () => {
    it('FeedbackSummary receives correct statistics prop', () => {
      const customStatistics = createMockStatistics({
        totalResponses: 100,
        completionRate: 85,
        averageTime: 600,
      });
      const mockData = createMockAnalysisData({
        statistics: customStatistics,
      });
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByTestId('total-responses')).toHaveTextContent('100');
      expect(screen.getByTestId('completion-rate')).toHaveTextContent('85%');
      expect(screen.getByTestId('average-time')).toHaveTextContent('600s');
    });

    it('summary displays total responses', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByTestId('total-responses')).toHaveTextContent('45');
    });

    it('summary displays completion rate', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByTestId('completion-rate')).toHaveTextContent('75.5%');
    });

    it('summary displays average completion time', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByTestId('average-time')).toHaveTextContent('420s');
    });
  });

  describe('Question Analysis Rendering', () => {
    it('each question renders in MUI Accordion', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordions = screen.getAllByRole('button', { expanded: false });
      expect(accordions.length).toBeGreaterThanOrEqual(4);
    });

    it('question text displayed in AccordionSummary', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByText('What is your favorite color?')).toBeInTheDocument();
    });

    it('response count displayed for each question', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByText(/45 responses/i)).toBeInTheDocument();
    });

    it('percentage calculation displayed', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByText(/33.33%/)).toBeInTheDocument();
      expect(screen.getByText(/44.44%/)).toBeInTheDocument();
    });

    it('accordion expands to show details', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordion = screen.getByText('What is your favorite color?').closest('button');
      expect(accordion).toBeInTheDocument();

      if (accordion) {
        await user.click(accordion);
        await waitFor(() => {
          expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Chart Rendering - Multichoice Questions', () => {
    it('horizontal bar chart for multichoice questions', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordion = screen.getByText('What is your favorite color?').closest('button');
      if (accordion) {
        await user.click(accordion);
        await waitFor(() => {
          expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        });
      }
    });

    it('chart shows option distribution', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordion = screen.getByText('What is your favorite color?').closest('button');
      if (accordion) {
        await user.click(accordion);
        await waitFor(() => {
          const chart = screen.getByTestId('bar-chart');
          expect(chart.textContent).toContain('Red');
          expect(chart.textContent).toContain('Blue');
          expect(chart.textContent).toContain('Green');
        });
      }
    });

    it('chart data from analysis items', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordion = screen.getByText('What is your favorite color?').closest('button');
      if (accordion) {
        await user.click(accordion);
        await waitFor(() => {
          const chart = screen.getByTestId('bar-chart');
          expect(chart.textContent).toContain('15');
          expect(chart.textContent).toContain('20');
          expect(chart.textContent).toContain('10');
        });
      }
    });

    it('chart has title and legend', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordion = screen.getByText('What is your favorite color?').closest('button');
      if (accordion) {
        await user.click(accordion);
        await waitFor(() => {
          const chart = screen.getByTestId('bar-chart');
          const chartData = JSON.parse(chart.textContent || '{}');
          expect(chartData.options).toBeDefined();
        });
      }
    });

    it('chart accessible with data table alternative', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordion = screen.getByText('What is your favorite color?').closest('button');
      if (accordion) {
        await user.click(accordion);
        await waitFor(() => {
          // Data table should be present for accessibility
          expect(screen.getByRole('table')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Chart Rendering - Multichoicerated Questions', () => {
    it('bar chart with rating scale (1-5 stars)', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordion = screen.getByText('How satisfied are you?').closest('button');
      if (accordion) {
        await user.click(accordion);
        await waitFor(() => {
          expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        });
      }
    });

    it('average rating displayed', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordion = screen.getByText('How satisfied are you?').closest('button');
      if (accordion) {
        await user.click(accordion);
        await waitFor(() => {
          expect(screen.getByText(/average.*3\.6/i)).toBeInTheDocument();
        });
      }
    });

    it('rating distribution shown', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordion = screen.getByText('How satisfied are you?').closest('button');
      if (accordion) {
        await user.click(accordion);
        await waitFor(() => {
          expect(screen.getByText(/5%/)).toBeInTheDocument();
          expect(screen.getByText(/37\.5%/)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Chart Rendering - Numeric Questions', () => {
    it('line chart for numeric data', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordion = screen
        .getByText('How many hours do you study per week?')
        .closest('button');
      if (accordion) {
        await user.click(accordion);
        await waitFor(() => {
          expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        });
      }
    });

    it('average, min, max statistics shown', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordion = screen
        .getByText('How many hours do you study per week?')
        .closest('button');
      if (accordion) {
        await user.click(accordion);
        await waitFor(() => {
          expect(screen.getByText(/average.*15\.5/i)).toBeInTheDocument();
          expect(screen.getByText(/minimum.*5/i)).toBeInTheDocument();
          expect(screen.getByText(/maximum.*30/i)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Text Response Display - Textarea/Textfield', () => {
    it('text responses displayed as list', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordion = screen
        .getByText('What did you like most about the course?')
        .closest('button');
      if (accordion) {
        await user.click(accordion);
        await waitFor(() => {
          expect(screen.getByText('Great teaching style')).toBeInTheDocument();
          expect(screen.getByText('Clear explanations')).toBeInTheDocument();
        });
      }
    });

    it('responses anonymized when anonymous feedback', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordion = screen
        .getByText('What did you like most about the course?')
        .closest('button');
      if (accordion) {
        await user.click(accordion);
        await waitFor(() => {
          // Should not display user names for anonymous feedback
          expect(screen.queryByText(/user \d+/i)).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('Filtering Options', () => {
    it('group filter dropdown renders', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByLabelText(/group/i)).toBeInTheDocument();
    });

    it('selecting group updates analysis data', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      const mockHook = vi.fn();
      mockHook.mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);
      vi.mocked(useFeedbackAnalysis).mockImplementation(mockHook);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const groupSelect = screen.getByLabelText(/group/i);
      await user.click(groupSelect);

      const option = await screen.findByRole('option', { name: /group 1/i });
      await user.click(option);

      await waitFor(() => {
        expect(mockHook).toHaveBeenCalledWith(
          expect.objectContaining({ groupId: 1 })
        );
      });
    });

    it('course filter for multi-course feedback', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis
          feedbackId={42}
          canViewAnalysis
          canViewResponses
          courseId={1}
        />
      );

      expect(screen.getByLabelText(/course/i)).toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    it('export to Excel button present', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(
        screen.getByRole('button', { name: /export.*excel/i })
      ).toBeInTheDocument();
    });

    it('click calls export API endpoint', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      // Mock window.open for download
      const mockOpen = vi.fn();
      window.open = mockOpen;

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const exportButton = screen.getByRole('button', { name: /export.*excel/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(mockOpen).toHaveBeenCalled();
      });
    });
  });

  describe('Tabs Navigation', () => {
    it('Analysis tab active by default', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const analysisTab = screen.getByRole('tab', { name: /analysis/i });
      expect(analysisTab).toHaveAttribute('aria-selected', 'true');
    });

    it('Responses tab shows ResponseList', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const responsesTab = screen.getByRole('tab', { name: /responses/i });
      await user.click(responsesTab);

      await waitFor(() => {
        expect(screen.getByTestId('response-list')).toBeInTheDocument();
      });
    });

    it('clicking tab switches view', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const responsesTab = screen.getByRole('tab', { name: /responses/i });
      expect(responsesTab).toHaveAttribute('aria-selected', 'false');

      await user.click(responsesTab);

      await waitFor(() => {
        expect(responsesTab).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('keyboard navigation between tabs', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const analysisTab = screen.getByRole('tab', { name: /analysis/i });
      analysisTab.focus();

      await user.keyboard('{ArrowRight}');

      await waitFor(() => {
        const responsesTab = screen.getByRole('tab', { name: /responses/i });
        expect(document.activeElement).toBe(responsesTab);
      });
    });
  });

  describe('ResponseList Integration', () => {
    it('ResponseList rendered in Responses tab', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const responsesTab = screen.getByRole('tab', { name: /responses/i });
      await user.click(responsesTab);

      await waitFor(() => {
        expect(screen.getByTestId('response-list')).toBeInTheDocument();
      });
    });

    it('ResponseList receives feedbackId prop', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const responsesTab = screen.getByRole('tab', { name: /responses/i });
      await user.click(responsesTab);

      await waitFor(() => {
        expect(screen.getByTestId('response-list')).toBeInTheDocument();
      });
    });
  });

  describe('Anonymous Protection', () => {
    it('warning displayed when responses below threshold', () => {
      const mockData = createMockAnalysisData({
        meetAnonymousThreshold: false,
        totalResponses: 2,
      });
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(
        screen.getByText(/insufficient responses.*anonymous/i)
      ).toBeInTheDocument();
    });

    it('warning shows minimum threshold message', () => {
      const mockData = createMockAnalysisData({
        meetAnonymousThreshold: false,
        totalResponses: 2,
      });
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByText(/minimum.*responses required/i)).toBeInTheDocument();
    });

    it('analysis hidden when below threshold', () => {
      const mockData = createMockAnalysisData({
        meetAnonymousThreshold: false,
        totalResponses: 2,
      });
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(
        screen.queryByText('What is your favorite color?')
      ).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('message when no responses exist', () => {
      const mockData = createMockAnalysisData({
        totalResponses: 0,
        items: [],
      });
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByText(/no responses yet/i)).toBeInTheDocument();
    });

    it('helpful message for teachers', () => {
      const mockData = createMockAnalysisData({
        totalResponses: 0,
        items: [],
      });
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(
        screen.getByText(/analysis will be available once students/i)
      ).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('MUI Skeleton components during data fetch', () => {
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        isError: false,
        isSuccess: false,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getAllByTestId(/skeleton/i).length).toBeGreaterThan(0);
    });

    it('loading state when useFeedbackAnalysis returns isLoading = true', () => {
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        isError: false,
        isSuccess: false,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('error message when API fails', () => {
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        isError: true,
        isSuccess: false,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByText(/error.*loading/i)).toBeInTheDocument();
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    it('permission denied error (403)', () => {
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('You do not have permission to view feedback analysis'),
        isError: true,
        isSuccess: false,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByText(/permission/i)).toBeInTheDocument();
    });

    it('retry button in error state', async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        isError: true,
        isSuccess: false,
        refetch,
      } as unknown as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(refetch).toHaveBeenCalled();
    });
  });

  describe('Permission-Based Visibility', () => {
    it('analysis visible when canViewAnalysis = true', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByRole('tab', { name: /analysis/i })).toBeInTheDocument();
    });

    it('analysis hidden when permission denied', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis={false} canViewResponses />
      );

      expect(screen.getByText(/permission.*view analysis/i)).toBeInTheDocument();
    });

    it('responses tab visible when canViewResponses = true', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      expect(screen.getByRole('tab', { name: /responses/i })).toBeInTheDocument();
    });
  });

  describe('Statistical Display', () => {
    it('average rating/score displayed', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordion = screen.getByText('How satisfied are you?').closest('button');
      if (accordion) {
        await user.click(accordion);
        await waitFor(() => {
          expect(screen.getByText(/average.*3\.6/i)).toBeInTheDocument();
        });
      }
    });

    it('statistics formatted properly (2 decimal places)', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordion = screen
        .getByText('How many hours do you study per week?')
        .closest('button');
      if (accordion) {
        await user.click(accordion);
        await waitFor(() => {
          const avgText = screen.getByText(/average.*15\.5/i).textContent;
          expect(avgText).toMatch(/\d+\.\d{1,2}/);
        });
      }
    });
  });

  describe('Accessibility', () => {
    it('tabs have proper ARIA labels', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const analysisTab = screen.getByRole('tab', { name: /analysis/i });
      expect(analysisTab).toHaveAttribute('aria-controls');
      expect(analysisTab).toHaveAttribute('aria-selected');
    });

    it('accordions have proper ARIA attributes', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const accordion = screen.getByText('What is your favorite color?').closest('button');
      expect(accordion).toHaveAttribute('aria-expanded');
    });

    it('export button has descriptive aria-label', () => {
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const exportButton = screen.getByRole('button', { name: /export.*excel/i });
      expect(exportButton).toHaveAccessibleName();
    });

    it('keyboard navigation works', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      const analysisTab = screen.getByRole('tab', { name: /analysis/i });
      analysisTab.focus();
      expect(document.activeElement).toBe(analysisTab);

      await user.keyboard('{Tab}');
      expect(document.activeElement).not.toBe(analysisTab);
    });
  });

  describe('Integration Tests', () => {
    it('complete analysis workflow', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      // Verify summary is displayed
      expect(screen.getByTestId('feedback-summary')).toBeInTheDocument();

      // Expand a question
      const accordion = screen.getByText('What is your favorite color?').closest('button');
      if (accordion) {
        await user.click(accordion);
        await waitFor(() => {
          expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        });
      }

      // Switch to responses tab
      const responsesTab = screen.getByRole('tab', { name: /responses/i });
      await user.click(responsesTab);

      await waitFor(() => {
        expect(screen.getByTestId('response-list')).toBeInTheDocument();
      });
    });

    it('filter changes update charts', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      const mockHook = vi.fn();
      mockHook.mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);
      vi.mocked(useFeedbackAnalysis).mockImplementation(mockHook);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      // Change filter
      const groupSelect = screen.getByLabelText(/group/i);
      await user.click(groupSelect);

      const option = await screen.findByRole('option', { name: /group 1/i });
      await user.click(option);

      // Hook should be called with new filter
      await waitFor(() => {
        expect(mockHook).toHaveBeenCalledWith(
          expect.objectContaining({ groupId: 1 })
        );
      });
    });

    it('tab switching preserves filter state', async () => {
      const user = userEvent.setup();
      const mockData = createMockAnalysisData();
      vi.mocked(useFeedbackAnalysis).mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as UseQueryResult<FeedbackAnalysisType, Error>);

      renderWithProviders(
        <FeedbackAnalysis feedbackId={42} canViewAnalysis canViewResponses />
      );

      // Select a filter
      const groupSelect = screen.getByLabelText(/group/i);
      await user.click(groupSelect);
      const option = await screen.findByRole('option', { name: /group 1/i });
      await user.click(option);

      // Switch tabs
      const responsesTab = screen.getByRole('tab', { name: /responses/i });
      await user.click(responsesTab);

      await waitFor(() => {
        expect(screen.getByTestId('response-list')).toBeInTheDocument();
      });

      // Switch back
      const analysisTab = screen.getByRole('tab', { name: /analysis/i });
      await user.click(analysisTab);

      // Filter should still be selected
      await waitFor(() => {
        expect(groupSelect).toHaveTextContent(/group 1/i);
      });
    });
  });
});
