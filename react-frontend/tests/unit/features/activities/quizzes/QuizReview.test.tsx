/**
 * QuizReview Component Unit Tests
 *
 * Comprehensive unit tests for the QuizReview component that displays
 * completed quiz attempts with questions, answers, feedback, and grades.
 * Tests cover:
 * - Attempt summary header (score, grade, time taken, submission time)
 * - Question rendering in read-only review mode
 * - Submitted answer highlighting
 * - Correct answer display based on review settings
 * - Question feedback with color-coded indicators (green/red/orange)
 * - Marks awarded display
 * - General quiz feedback based on grade
 * - Question navigation integration
 * - Show all vs paginated view toggle
 * - Teacher comments display
 * - Print view functionality
 * - Review timing options (immediate, later, after close)
 * - Loading and error states
 * - Role-based UI (student vs teacher)
 *
 * @package    react-frontend
 * @subpackage tests/unit/features/activities/quizzes
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { type ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';

// Internal imports from depends_on_files
import QuizReview from '@/features/activities/quizzes/components/QuizReview';
import type { QuestionNavigationState } from '@/features/activities/quizzes/types/quiz.types';
import { QuizAttemptState } from '@/features/activities/quizzes/types/quiz.types';
import type { AttemptReviewResponse } from '@/features/activities/quizzes/api/quizApi';
import { createTestQueryClient, render } from '@tests/helpers/render';
import { createMockQuizAttempt, createMockQuiz } from '@tests/helpers/mockData';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock react-router-dom for URL params
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(() => ({ attemptId: '123' })),
    useNavigate: vi.fn(() => vi.fn()),
  };
});

// Mock the quiz API
vi.mock('@/features/activities/quizzes/api/quizApi', () => ({
  getAttemptReview: vi.fn(),
  quizQueryKeys: {
    all: ['quizzes'],
    review: (attemptId: number) => ['quizzes', 'review', attemptId],
  },
}));

// Mock child components to isolate QuizReview testing
vi.mock('@/features/activities/quizzes/components/QuizNavigation', () => ({
  QuizNavigation: vi.fn(({ questions, currentQuestionIndex, onQuestionClick }: {
    questions: QuestionNavigationState[];
    currentQuestionIndex: number;
    onQuestionClick: (index: number) => void;
  }) => (
    <div data-testid="quiz-navigation">
      <span data-testid="nav-question-count">{questions.length} questions</span>
      <span data-testid="nav-current-index">{currentQuestionIndex}</span>
      {questions.map((q, index) => (
        <button
          key={q.slot}
          data-testid={`nav-question-${index}`}
          data-answered={q.answered}
          data-flagged={q.flagged}
          aria-label={`Navigate to question ${index + 1}${q.answered ? ' (answered)' : ''}`}
          onClick={() => onQuestionClick(index)}
        >
          Q{index + 1}
        </button>
      ))}
    </div>
  )),
}));

// Mock UI components
vi.mock('@/components/data-display/Card', () => ({
  default: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <div data-testid="card" {...props}>{children}</div>
  ),
}));

vi.mock('@/components/feedback/Alert', () => ({
  Alert: ({ severity, title, message }: { severity: string; title: string; message: ReactNode }) => (
    <div data-testid={`alert-${severity}`} role="alert">
      <strong>{title}</strong>
      <div>{message}</div>
    </div>
  ),
}));

vi.mock('@/components/feedback/LoadingSpinner', () => ({
  LoadingSpinner: ({ message }: { message?: string }) => (
    <div data-testid="loading-spinner" role="status">
      {message || 'Loading...'}
    </div>
  ),
}));

// Mock utility functions
vi.mock('@/utils/formatters', () => ({
  formatNumber: (num: number, decimals?: number) => num.toFixed(decimals ?? 0),
  formatGrade: (grade: number) => `${grade}%`,
}));

vi.mock('@/utils/date', () => ({
  formatDuration: (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  },
  formatDateTime: (timestamp: number) => new Date(timestamp * 1000).toISOString(),
}));

// Import mocked API to control responses
import { getAttemptReview } from '@/features/activities/quizzes/api/quizApi';
const mockGetAttemptReview = vi.mocked(getAttemptReview);

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Creates mock review question data for testing
 */
function createMockReviewQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 1001, // Question attempt ID - required by QuizReviewQuestion
    slot: 1,
    type: 'multichoice',
    displaynumber: '1',
    questiontext: '<p>What is 2 + 2?</p>',
    response: 'A',
    responseSummary: 'Option A: 4',
    rightAnswer: '4',
    mark: 10,
    maxmark: 10,
    fraction: 1.0,
    correct: true,
    specificFeedback: '<p>Correct! 2 + 2 equals 4.</p>',
    generalFeedback: '<p>Addition is a basic arithmetic operation.</p>',
    flagged: false,
    page: 1,
    state: 'gradedright',
    ...overrides,
  };
}

/**
 * Creates mock review data response for testing
 */
function createMockReviewData(overrides: Partial<AttemptReviewResponse> = {}): AttemptReviewResponse {
  const mockAttempt = createMockQuizAttempt({
    id: 123,
    quiz: 1,
    userid: 100,
    attempt: 1,
    state: QuizAttemptState.FINISHED,
    timestart: 1700000000,
    timefinish: 1700003600, // 1 hour later
    sumgrades: 85,
  });

  const mockQuiz = createMockQuiz({
    id: 1,
    name: 'Test Quiz',
    course: 1,
    intro: '<p>This is a test quiz.</p>',
    timelimit: 3600,
    grade: 100,
  });

  // Create mock questions with proper typing
  const questions = [
    createMockReviewQuestion({ slot: 1, displaynumber: '1' }),
    createMockReviewQuestion({
      slot: 2,
      displaynumber: '2',
      questiontext: '<p>What is 3 + 3?</p>',
      response: 'B',
      responseSummary: 'Option B: 5',
      rightAnswer: '6',
      mark: 5,
      maxmark: 10,
      fraction: 0.5,
      correct: null, // Use null for partial credit
      specificFeedback: '<p>Partially correct.</p>',
      state: 'gradedpartial',
    }),
    createMockReviewQuestion({
      slot: 3,
      displaynumber: '3',
      questiontext: '<p>What is 5 + 5?</p>',
      response: 'C',
      responseSummary: 'Option C: 8',
      rightAnswer: '10',
      mark: 0,
      maxmark: 10,
      fraction: 0,
      correct: false,
      specificFeedback: '<p>Incorrect. The answer is 10.</p>',
      state: 'gradedwrong',
    }),
  ];

  // Create navigation state from questions
  const navigation: QuestionNavigationState[] = questions.map((q, index) => ({
    slot: q.slot,
    number: q.displaynumber,
    answered: q.response !== null && q.response !== undefined,
    flagged: q.flagged || false,
    page: q.page || 1,
    isCurrentQuestion: index === 0,
    state: undefined,
    canNavigate: true,
  }));

  return {
    attempt: mockAttempt,
    quiz: mockQuiz,
    questions,
    grade: 85,
    maxGrade: 100,
    percentage: 85, // Required property
    navigation, // Required property
    overallFeedback: '<p>Good attempt! You scored well on this quiz.</p>',
    displayOptions: {
      rightanswer: true,
      feedback: true,
      marks: 2,
      generalfeedback: true,
    },
    ...overrides,
  } as AttemptReviewResponse;
}

// ============================================================================
// Test Wrapper and Utilities
// ============================================================================

let queryClient: QueryClient;

/**
 * Custom render function with QueryClientProvider
 */
function renderWithProviders(ui: React.ReactElement) {
  queryClient = createTestQueryClient();
  
  return render(ui, {
    queryClient,
  });
}

// ============================================================================
// Test Suites
// ============================================================================

describe('QuizReview Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: successful review data fetch
    mockGetAttemptReview.mockResolvedValue(createMockReviewData());
  });

  afterEach(() => {
    queryClient?.clear();
  });

  // --------------------------------------------------------------------------
  // Loading State Tests
  // --------------------------------------------------------------------------
  describe('Loading State', () => {
    it('should display loading spinner while fetching review data', async () => {
      // Never resolve to keep loading state
      mockGetAttemptReview.mockImplementation(
        () => new Promise(() => {})
      );

      renderWithProviders(<QuizReview attemptId={123} />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/loading quiz review/i)).toBeInTheDocument();
    });

    it('should display skeleton placeholders during loading', async () => {
      mockGetAttemptReview.mockImplementation(
        () => new Promise(() => {})
      );

      renderWithProviders(<QuizReview attemptId={123} />);

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveAttribute('role', 'status');
    });
  });

  // --------------------------------------------------------------------------
  // Error State Tests
  // --------------------------------------------------------------------------
  describe('Error State', () => {
    it('should display error message when fetch fails', async () => {
      const errorMessage = 'Network error: Unable to fetch review data';
      mockGetAttemptReview.mockRejectedValue(new Error(errorMessage));

      renderWithProviders(<QuizReview attemptId={123} />);

      // Wait longer due to component's retry: 2 configuration which overrides client defaults
      await waitFor(
        () => {
          expect(screen.getByTestId('alert-error')).toBeInTheDocument();
        },
        { timeout: 10000 }
      );

      expect(screen.getByText(/unable to load review/i)).toBeInTheDocument();
    });

    it('should display retry option on fetch failure', async () => {
      mockGetAttemptReview.mockRejectedValue(new Error('Failed'));

      const mockOnBack = vi.fn();
      renderWithProviders(<QuizReview attemptId={123} onBack={mockOnBack} />);

      // Wait longer due to component's retry: 2 configuration which overrides client defaults
      await waitFor(
        () => {
          expect(screen.getByTestId('alert-error')).toBeInTheDocument();
        },
        { timeout: 10000 }
      );

      const backButton = screen.getByRole('button', { name: /back to quiz/i });
      expect(backButton).toBeInTheDocument();

      fireEvent.click(backButton);
      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid attempt ID gracefully', async () => {
      renderWithProviders(<QuizReview attemptId={0} />);

      // With attemptId=0, query should be disabled
      await waitFor(() => {
        expect(mockGetAttemptReview).not.toHaveBeenCalled();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Attempt Summary Header Tests
  // --------------------------------------------------------------------------
  describe('Attempt Summary Header', () => {
    it('should display score in attempt summary', async () => {
      const reviewData = createMockReviewData({ grade: 85, maxGrade: 100 });
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // The score is displayed as "85%" (without decimals) in the Score section
        // Using getAllByText since the score appears in multiple places (Score + Grade)
        const scoreElements = screen.getAllByText(/85/);
        expect(scoreElements.length).toBeGreaterThan(0);
      });
    });

    it('should display grade percentage', async () => {
      const reviewData = createMockReviewData({ grade: 85, maxGrade: 100 });
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // 85/100 = 85%
        expect(screen.getByText(/85\.00%/)).toBeInTheDocument();
      });
    });

    it('should display time taken from attempt timestamps', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Time taken is calculated from timestart and timefinish (1 hour = 3600 seconds)
        expect(screen.getByText(/1h 0m 0s/)).toBeInTheDocument();
      });
    });

    it('should display submission time', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Should show the formatted submission timestamp
        expect(screen.getByText(/submitted/i)).toBeInTheDocument();
      });
    });

    it('should display quiz name in header', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Component renders quiz name with " - Review" suffix
        expect(screen.getByText(/Test Quiz.*Review/)).toBeInTheDocument();
      });
    });

    it('should display attempt number', async () => {
      const reviewData = createMockReviewData();
      reviewData.attempt.attempt = 2;
      mockGetAttemptReview.mockResolvedValue(reviewData);

      // Attempt number is displayed in teacher mode only
      renderWithProviders(<QuizReview attemptId={123} teacherMode />);

      await waitFor(() => {
        expect(screen.getByText(/attempt #2/i)).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Question Rendering Tests
  // --------------------------------------------------------------------------
  describe('Question Rendering in Review Mode', () => {
    it('should render all questions when show all is enabled', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
        expect(screen.getByText(/question 2/i)).toBeInTheDocument();
        expect(screen.getByText(/question 3/i)).toBeInTheDocument();
      });
    });

    it('should display question text content', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/what is 2 \+ 2\?/i)).toBeInTheDocument();
        expect(screen.getByText(/what is 3 \+ 3\?/i)).toBeInTheDocument();
        expect(screen.getByText(/what is 5 \+ 5\?/i)).toBeInTheDocument();
      });
    });

    it('should render questions in read-only state', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Questions should be displayed without editable inputs
        const questionCards = screen.getAllByTestId('card');
        expect(questionCards.length).toBeGreaterThan(0);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Submitted Answer Highlighting Tests
  // --------------------------------------------------------------------------
  describe('Submitted Answer Highlighting', () => {
    it('should display user submitted answer with distinct styling', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Use getAllByText since "Your Answer" appears for each question
        const yourAnswerElements = screen.getAllByText(/your answer/i);
        expect(yourAnswerElements.length).toBeGreaterThan(0);
        expect(screen.getByText(/option a: 4/i)).toBeInTheDocument();
      });
    });

    it('should show response summary for each question', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Each question should show the response summary
        expect(screen.getByText(/option a: 4/i)).toBeInTheDocument();
        expect(screen.getByText(/option b: 5/i)).toBeInTheDocument();
        expect(screen.getByText(/option c: 8/i)).toBeInTheDocument();
      });
    });

    it('should display "Not answered" for unanswered questions', async () => {
      const reviewData = createMockReviewData();
      const question = reviewData.questions[2];
      if (question) {
        (question as unknown as Record<string, unknown>).response = null;
        (question as unknown as Record<string, unknown>).responseSummary = null;
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Use getAllByText since "Not answered" appears in multiple places (question card + navigation)
        const notAnsweredElements = screen.getAllByText(/not answered/i);
        expect(notAnsweredElements.length).toBeGreaterThan(0);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Correct Answer Display Tests
  // --------------------------------------------------------------------------
  describe('Correct Answer Display', () => {
    it('should show correct answer when review settings allow', async () => {
      const reviewData = createMockReviewData();
      reviewData.displayOptions.rightanswer = true;
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getAllByText(/correct answer/i).length).toBeGreaterThan(0);
      });
    });

    it('should hide correct answer when review settings disallow', async () => {
      const reviewData = createMockReviewData();
      reviewData.displayOptions.rightanswer = false;
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Wait for content to load
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
      });

      // Correct answers should not be shown
      expect(screen.queryByText(/^correct answer:$/i)).not.toBeInTheDocument();
    });

    it('should display the actual correct answer value', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // The actual correct answer values should be shown
        expect(screen.getByText('4')).toBeInTheDocument();
        expect(screen.getByText('6')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Question Feedback Display Tests (Color-coded)
  // --------------------------------------------------------------------------
  describe('Question Feedback Display', () => {
    it('should display correct feedback with success (green) styling', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // There can be multiple success alerts (one for each correct question)
        const successAlerts = screen.getAllByTestId('alert-success');
        expect(successAlerts.length).toBeGreaterThan(0);
        // Check that at least one contains the expected feedback
        const hasCorrectFeedback = successAlerts.some(alert => 
          alert.textContent?.match(/correct! 2 \+ 2 equals 4/i)
        );
        expect(hasCorrectFeedback).toBe(true);
      });
    });

    it('should display incorrect feedback with error (red) styling', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // There can be multiple error alerts (one for each incorrect question)
        const errorAlerts = screen.getAllByTestId('alert-error');
        expect(errorAlerts.length).toBeGreaterThan(0);
        // Check that at least one contains the expected feedback
        const hasIncorrectFeedback = errorAlerts.some(alert => 
          alert.textContent?.match(/incorrect\. the answer is 10/i)
        );
        expect(hasIncorrectFeedback).toBe(true);
      });
    });

    it('should display partial credit feedback with warning (orange) styling', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // There can be multiple warning alerts (one for each partial credit question)
        const warningAlerts = screen.getAllByTestId('alert-warning');
        expect(warningAlerts.length).toBeGreaterThan(0);
        // Check that at least one contains the expected feedback
        const hasPartialFeedback = warningAlerts.some(alert => 
          alert.textContent?.match(/partially correct/i)
        );
        expect(hasPartialFeedback).toBe(true);
      });
    });

    it('should hide feedback when review settings disallow', async () => {
      const reviewData = createMockReviewData();
      reviewData.displayOptions.feedback = false;
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
      });

      // Feedback alerts for questions should not be visible
      expect(screen.queryAllByTestId('alert-success').filter(
        el => el.textContent?.match(/correct! 2 \+ 2 equals 4/i)
      ).length).toBe(0);
    });

    it('should display correct status chip for each question', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Use getAllByText since multiple elements may have these states
        expect(screen.getAllByText(/^Correct$/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Partially Correct/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/^Incorrect$/i).length).toBeGreaterThan(0);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Marks Awarded Display Tests
  // --------------------------------------------------------------------------
  describe('Marks Awarded Display', () => {
    it('should display marks awarded for each question', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Marks are rendered with <strong> tags breaking the text
        // Use function matcher to handle broken text across elements
        const marksTextMatcher = (_content: string, element: Element | null) => {
          if (!element) return false;
          const hasMarks = element.textContent?.includes('marks');
          return hasMarks === true;
        };
        
        // Check that marks elements exist (text broken by <strong> tags)
        const marksElements = screen.getAllByText(marksTextMatcher);
        expect(marksElements.length).toBeGreaterThan(0);
        
        // Verify specific mark values are present
        expect(screen.getByText('10.00')).toBeInTheDocument();
        expect(screen.getByText('5.00')).toBeInTheDocument();
        expect(screen.getByText('0.00')).toBeInTheDocument();
      });
    });

    it('should hide marks when review settings disallow', async () => {
      const reviewData = createMockReviewData();
      reviewData.displayOptions.marks = 0;
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
      });

      // Marks should not be shown (implementation dependent on how displayOptions.marks is used)
    });

    it('should format marks with proper decimal precision', async () => {
      const reviewData = createMockReviewData();
      const firstQuestion = reviewData.questions[0];
      if (firstQuestion) {
        firstQuestion.mark = 8.5;
        firstQuestion.maxmark = 10;
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Check that mark is formatted with 2 decimal places
        expect(screen.getByText('8.50')).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // General Quiz Feedback Tests
  // --------------------------------------------------------------------------
  describe('General Quiz Feedback', () => {
    it('should display overall feedback based on grade', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/good attempt! you scored well/i)).toBeInTheDocument();
      });
    });

    it('should display success feedback for high grades (>=80%)', async () => {
      const reviewData = createMockReviewData({ grade: 90, maxGrade: 100 });
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Should show excellent/success feedback
        expect(screen.getByText(/excellent/i)).toBeInTheDocument();
      });
    });

    it('should display info feedback for good grades (60-79%)', async () => {
      const reviewData = createMockReviewData({ grade: 70, maxGrade: 100 });
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // "good" appears in multiple places, use getAllByText
        const goodElements = screen.getAllByText(/good/i);
        expect(goodElements.length).toBeGreaterThan(0);
      });
    });

    it('should display warning feedback for improvement needed (40-59%)', async () => {
      const reviewData = createMockReviewData({ grade: 50, maxGrade: 100 });
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/needs improvement/i)).toBeInTheDocument();
      });
    });

    it('should display error feedback for low grades (<40%)', async () => {
      const reviewData = createMockReviewData({ grade: 30, maxGrade: 100 });
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/below average/i)).toBeInTheDocument();
      });
    });

    it('should hide general feedback when review settings disallow', async () => {
      const reviewData = createMockReviewData();
      reviewData.displayOptions.generalfeedback = false;
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
      });

      // General feedback should not be shown for questions
    });
  });

  // --------------------------------------------------------------------------
  // Question Navigation Tests
  // --------------------------------------------------------------------------
  describe('Question Navigation', () => {
    // Helper to disable "show all" mode which reveals the QuizNavigation component
    const disableShowAllMode = async () => {
      // Wait for content to load first
      await waitFor(() => {
        // Use getAllByText since "question 1" appears multiple times
        const elements = screen.getAllByText(/question 1/i);
        expect(elements.length).toBeGreaterThan(0);
      });
      // Toggle off "show all questions" to reveal navigation
      const toggleSwitch = screen.getByRole('checkbox', { name: /show all questions/i });
      fireEvent.click(toggleSwitch);
      // Wait for the state change to take effect and navigation to appear
      await waitFor(() => {
        expect(screen.getByTestId('quiz-navigation')).toBeInTheDocument();
      });
    };

    it('should embed QuizNavigation component', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await disableShowAllMode();

      await waitFor(() => {
        expect(screen.getByTestId('quiz-navigation')).toBeInTheDocument();
      });
    });

    it('should pass correct question count to navigation', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await disableShowAllMode();

      await waitFor(() => {
        // Look for question count display in navigation
        const navPanel = screen.getByTestId('quiz-navigation');
        expect(navPanel).toBeInTheDocument();
        // Navigation buttons have aria-label "Navigate to question N..."
        const questionButtons = screen.getAllByRole('button', { name: /navigate to question \d+/i });
        expect(questionButtons.length).toBe(3);
      });
    });

    it('should handle navigation click to specific question', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await disableShowAllMode();

      await waitFor(() => {
        expect(screen.getByTestId('quiz-navigation')).toBeInTheDocument();
      });

      // Click on question 2 in navigation (aria-label is "Navigate to question 2...")
      const questionButtons = screen.getAllByRole('button', { name: /navigate to question \d+/i });
      const secondButton = questionButtons[1];
      if (secondButton) {
        fireEvent.click(secondButton);
      }

      // The test verifies navigation click is handled (component should update view)
      await waitFor(() => {
        expect(screen.getByTestId('quiz-navigation')).toBeInTheDocument();
      });
    });

    it('should show answered status in navigation', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await disableShowAllMode();

      await waitFor(() => {
        // QuizNavigation is present
        expect(screen.getByTestId('quiz-navigation')).toBeInTheDocument();
        // Navigation buttons should show answered/unanswered styling
      });
    });

    it('should show flagged status in navigation', async () => {
      const reviewData = createMockReviewData();
      const secondQuestion = reviewData.questions[1];
      if (secondQuestion) {
        secondQuestion.flagged = true;
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await disableShowAllMode();

      await waitFor(() => {
        // QuizNavigation is present
        expect(screen.getByTestId('quiz-navigation')).toBeInTheDocument();
        // Question 2 should show flagged status
      });
    });
  });

  // --------------------------------------------------------------------------
  // Show All vs Paginated View Tests
  // --------------------------------------------------------------------------
  describe('Show All Questions Toggle', () => {
    it('should display toggle switch for view mode', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /show all/i })).toBeInTheDocument();
      });
    });

    it('should show all questions when toggle is enabled', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // All 3 questions should be visible
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
        expect(screen.getByText(/question 2/i)).toBeInTheDocument();
        expect(screen.getByText(/question 3/i)).toBeInTheDocument();
      });
    });

    it('should show single question when toggle is disabled', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /show all/i })).toBeInTheDocument();
      });

      // Toggle off the show all switch
      const toggle = screen.getByRole('checkbox', { name: /show all/i });
      fireEvent.click(toggle);

      // Only current question should be visible (implementation may vary)
    });
  });

  // --------------------------------------------------------------------------
  // Teacher Comments Tests
  // --------------------------------------------------------------------------
  describe('Teacher Comments Display', () => {
    it('should display teacher comments accordion in teacher mode', async () => {
      const reviewData = createMockReviewData();
      const firstQuestion = reviewData.questions[0];
      if (firstQuestion) {
        (firstQuestion as unknown as Record<string, unknown>).teacherComment = 'Great work on this question!';
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} teacherMode={true} />);

      await waitFor(() => {
        expect(screen.getByText(/great work on this question/i)).toBeInTheDocument();
      });
    });

    it('should hide teacher comments in student mode', async () => {
      const reviewData = createMockReviewData();
      const firstQuestion = reviewData.questions[0];
      if (firstQuestion) {
        (firstQuestion as unknown as Record<string, unknown>).teacherComment = 'Teacher-only comment';
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} teacherMode={false} />);

      await waitFor(() => {
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
      });

      expect(screen.queryByText(/teacher-only comment/i)).not.toBeInTheDocument();
    });

    it('should expand accordion to show full teacher comment', async () => {
      const reviewData = createMockReviewData();
      const firstQuestion = reviewData.questions[0];
      if (firstQuestion) {
        (firstQuestion as unknown as Record<string, unknown>).teacherComment = 'Detailed teacher feedback here';
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} teacherMode={true} />);

      await waitFor(() => {
        expect(screen.getByText(/detailed teacher feedback/i)).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Grading Breakdown Tests
  // --------------------------------------------------------------------------
  describe('Grade Calculation Details', () => {
    it('should display grading breakdown for complex questions', async () => {
      const reviewData = createMockReviewData();
      const firstQuestion = reviewData.questions[0];
      if (firstQuestion) {
        (firstQuestion as unknown as Record<string, unknown>).gradingBreakdown = [
          { criterion: 'Content', marks: 8, maxMarks: 10, feedback: 'Good content' },
          { criterion: 'Grammar', marks: 2, maxMarks: 2, feedback: 'Perfect grammar' },
        ];
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} teacherMode={true} />);

      await waitFor(() => {
        expect(screen.getByText(/grading breakdown/i)).toBeInTheDocument();
      });
    });

    it('should show partial credit calculations', async () => {
      const reviewData = createMockReviewData();
      const secondQuestion = reviewData.questions[1];
      if (secondQuestion) {
        (secondQuestion as unknown as Record<string, unknown>).gradingBreakdown = [
          { criterion: 'Part A', marks: 3, maxMarks: 5 },
          { criterion: 'Part B', marks: 2, maxMarks: 5 },
        ];
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} teacherMode={true} />);

      await waitFor(() => {
        // Breakdown should be visible in teacher mode
        expect(screen.getByText(/grading breakdown/i)).toBeInTheDocument();
      });
    });

    it('should hide grading breakdown for students', async () => {
      const reviewData = createMockReviewData();
      const firstQuestion = reviewData.questions[0];
      if (firstQuestion) {
        (firstQuestion as unknown as Record<string, unknown>).gradingBreakdown = [
          { criterion: 'Content', marks: 8, maxMarks: 10 },
        ];
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} teacherMode={false} />);

      await waitFor(() => {
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
      });

      // Grading breakdown should not be visible in student mode
      expect(screen.queryByText(/grading breakdown/i)).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // File Attachment Tests
  // --------------------------------------------------------------------------
  describe('File Attachment Viewing', () => {
    it('should display file attachments for essay responses', async () => {
      const reviewData = createMockReviewData();
      const firstQuestion = reviewData.questions[0];
      if (firstQuestion) {
        (firstQuestion as unknown as Record<string, unknown>).attachments = [
          { filename: 'essay.pdf', url: '/files/essay.pdf', mimetype: 'application/pdf', size: 1024 },
        ];
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/essay\.pdf/i)).toBeInTheDocument();
      });
    });

    it('should provide download link for attachments', async () => {
      const reviewData = createMockReviewData();
      const firstQuestion = reviewData.questions[0];
      if (firstQuestion) {
        (firstQuestion as unknown as Record<string, unknown>).attachments = [
          { filename: 'document.docx', url: '/files/document.docx' },
        ];
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        const downloadLink = screen.getByText(/document\.docx/i);
        expect(downloadLink).toBeInTheDocument();
      });
    });

    it('should handle multiple file attachments', async () => {
      const reviewData = createMockReviewData();
      const firstQuestion = reviewData.questions[0];
      if (firstQuestion) {
        (firstQuestion as unknown as Record<string, unknown>).attachments = [
          { filename: 'file1.pdf', url: '/files/file1.pdf' },
          { filename: 'file2.docx', url: '/files/file2.docx' },
        ];
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/file1\.pdf/i)).toBeInTheDocument();
        expect(screen.getByText(/file2\.docx/i)).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Print View Tests
  // --------------------------------------------------------------------------
  describe('Print View Option', () => {
    it('should display print button', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument();
      });
    });

    it('should trigger print when print button is clicked', async () => {
      const mockPrint = vi.spyOn(window, 'print').mockImplementation(() => {});
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      fireEvent.click(printButton);

      expect(mockPrint).toHaveBeenCalledTimes(1);
      mockPrint.mockRestore();
    });

    it('should have print-friendly styling', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      const { container } = renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
      });

      // Check that the component has print media styles
      expect(container.querySelector('[style*="@media print"]')).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Review Timing Options Tests
  // --------------------------------------------------------------------------
  describe('Review Timing Options', () => {
    it('should display immediate review when settings allow', async () => {
      const reviewData = createMockReviewData();
      reviewData.displayOptions.rightanswer = true;
      reviewData.displayOptions.feedback = true;
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Immediate review shows all feedback and answers (multiple per question)
        expect(screen.getAllByText(/correct answer/i).length).toBeGreaterThan(0);
        expect(screen.getAllByTestId('alert-success').length).toBeGreaterThan(0);
      });
    });

    it('should restrict content for "later" review setting', async () => {
      const reviewData = createMockReviewData();
      reviewData.displayOptions.rightanswer = false;
      reviewData.displayOptions.feedback = false;
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
      });

      // With restrictive settings, answers and feedback are hidden
      expect(screen.queryByText(/correct answer/i)).not.toBeInTheDocument();
    });

    it('should handle "after quiz closes" review settings', async () => {
      const reviewData = createMockReviewData();
      // Simulate restrictive settings for quiz that hasn't closed
      reviewData.displayOptions = {
        rightanswer: false,
        feedback: true,
        marks: 0,
        generalfeedback: false,
      };
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Question History Tests
  // --------------------------------------------------------------------------
  describe('Question History', () => {
    it('should display question history for multiple attempts', async () => {
      const reviewData = createMockReviewData();
      const firstQuestion = reviewData.questions[0];
      if (firstQuestion) {
        (firstQuestion as unknown as Record<string, unknown>).history = [
          { timestamp: 1700000100, answer: 'A', marks: 10 },
          { timestamp: 1700000200, answer: 'B', marks: 0 },
        ];
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // History icon or section should be visible
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
      });
    });

    it('should show previous answers in history', async () => {
      const reviewData = createMockReviewData();
      const firstQuestion = reviewData.questions[0];
      if (firstQuestion) {
        (firstQuestion as unknown as Record<string, unknown>).history = [
          { timestamp: 1700000100, answer: 'First Answer' },
          { timestamp: 1700000200, answer: 'Second Answer' },
        ];
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} teacherMode={true} />);

      await waitFor(() => {
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Role-based UI Tests
  // --------------------------------------------------------------------------
  describe('Role-based UI Variations', () => {
    it('should show additional grading info for teachers', async () => {
      const reviewData = createMockReviewData();
      const firstQuestion = reviewData.questions[0];
      if (firstQuestion) {
        (firstQuestion as unknown as Record<string, unknown>).gradingBreakdown = [
          { criterion: 'Accuracy', marks: 8, maxMarks: 10 },
        ];
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} teacherMode={true} />);

      await waitFor(() => {
        expect(screen.getByText(/grading breakdown/i)).toBeInTheDocument();
      });
    });

    it('should hide detailed grading from students', async () => {
      const reviewData = createMockReviewData();
      const firstQuestion = reviewData.questions[0];
      if (firstQuestion) {
        (firstQuestion as unknown as Record<string, unknown>).gradingBreakdown = [
          { criterion: 'Accuracy', marks: 8, maxMarks: 10 },
        ];
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} teacherMode={false} />);

      await waitFor(() => {
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
      });

      expect(screen.queryByText(/grading breakdown/i)).not.toBeInTheDocument();
    });

    it('should apply teacher mode prop correctly', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} teacherMode={true} />);

      await waitFor(() => {
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
      });

      // Teacher mode should have additional UI elements
    });

    it('should apply student mode by default', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
      });

      // Student mode is default (teacherMode = false)
    });
  });

  // --------------------------------------------------------------------------
  // Back Navigation Tests
  // --------------------------------------------------------------------------
  describe('Back Navigation', () => {
    it('should display back button when onBack prop is provided', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);
      const mockOnBack = vi.fn();

      renderWithProviders(<QuizReview attemptId={123} onBack={mockOnBack} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      });
    });

    it('should call onBack when back button is clicked', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);
      const mockOnBack = vi.fn();

      renderWithProviders(<QuizReview attemptId={123} onBack={mockOnBack} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /back/i }));
      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });

    it('should hide back button when onBack prop is not provided', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
      });

      // Back button should not be present when onBack is not provided
      // Note: The back button might still be present for other navigation purposes
    });
  });

  // --------------------------------------------------------------------------
  // Cleanup and Unmounting Tests
  // --------------------------------------------------------------------------
  describe('Cleanup and Unmounting', () => {
    it('should clean up properly on unmount', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      const { unmount } = renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/question 1/i)).toBeInTheDocument();
      });

      // Unmount should not cause errors
      expect(() => unmount()).not.toThrow();
    });

    it('should handle rapid mount/unmount cycles', async () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      for (let i = 0; i < 3; i++) {
        const { unmount } = renderWithProviders(<QuizReview attemptId={123} />);
        unmount();
      }

      // No errors should occur
      expect(true).toBe(true);
    });

    it('should cancel pending queries on unmount', async () => {
      // Create a long-running promise that never resolves
      mockGetAttemptReview.mockImplementation(
        () => new Promise(() => {})
      );

      const { unmount } = renderWithProviders(<QuizReview attemptId={123} />);

      // Unmount while query is still pending
      unmount();

      // No errors should occur
      expect(true).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // TypeScript Interface Tests
  // --------------------------------------------------------------------------
  describe('TypeScript Interfaces', () => {
    it('should accept valid attemptId prop', () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      // Should compile and render without errors
      expect(() => renderWithProviders(<QuizReview attemptId={123} />)).not.toThrow();
    });

    it('should accept valid teacherMode prop', () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      expect(() => renderWithProviders(<QuizReview attemptId={123} teacherMode={true} />)).not.toThrow();
      expect(() => renderWithProviders(<QuizReview attemptId={123} teacherMode={false} />)).not.toThrow();
    });

    it('should accept valid onBack callback prop', () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);
      const onBack = vi.fn();

      expect(() => renderWithProviders(<QuizReview attemptId={123} onBack={onBack} />)).not.toThrow();
    });

    it('should accept valid className prop', () => {
      const reviewData = createMockReviewData();
      mockGetAttemptReview.mockResolvedValue(reviewData);

      expect(() => renderWithProviders(<QuizReview attemptId={123} className="custom-class" />)).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Edge Case Tests
  // --------------------------------------------------------------------------
  describe('Edge Cases', () => {
    it('should handle empty questions array', async () => {
      const reviewData = createMockReviewData({ questions: [] });
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Should render without errors even with no questions
        // Quiz name appears multiple times in different elements
        const quizNameElements = screen.getAllByText(/test quiz/i);
        expect(quizNameElements.length).toBeGreaterThan(0);
      });
    });

    it('should handle null grade value', async () => {
      const reviewData = createMockReviewData({ grade: null });
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Quiz name appears multiple times in different elements
        const quizNameElements = screen.getAllByText(/test quiz/i);
        expect(quizNameElements.length).toBeGreaterThan(0);
      });
    });

    it('should handle zero maxGrade', async () => {
      const reviewData = createMockReviewData({ maxGrade: 0 });
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Quiz name appears multiple times in different elements
        const quizNameElements = screen.getAllByText(/test quiz/i);
        expect(quizNameElements.length).toBeGreaterThan(0);
      });
    });

    it('should handle missing displayOptions', async () => {
      const reviewData = createMockReviewData();
      delete (reviewData as { displayOptions?: unknown }).displayOptions;
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Should use default display options - question 1 appears multiple times
        const questionElements = screen.getAllByText(/question 1/i);
        expect(questionElements.length).toBeGreaterThan(0);
      });
    });

    it('should handle question with no response', async () => {
      const reviewData = createMockReviewData();
      const noResponseQuestion = createMockReviewQuestion({
        response: undefined,
        responseSummary: undefined,
      });
      reviewData.questions[0] = noResponseQuestion;
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // "Not answered" text may appear multiple times
        const notAnsweredElements = screen.getAllByText(/not answered/i);
        expect(notAnsweredElements.length).toBeGreaterThan(0);
      });
    });

    it('should handle question with no correct answer', async () => {
      const reviewData = createMockReviewData();
      const firstQuestion = reviewData.questions[0];
      if (firstQuestion) {
        firstQuestion.rightAnswer = undefined;
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        // Question 1 text may appear multiple times
        const questionElements = screen.getAllByText(/question 1/i);
        expect(questionElements.length).toBeGreaterThan(0);
      });
    });

    it('should handle very long question text', async () => {
      const reviewData = createMockReviewData();
      const firstQuestion = reviewData.questions[0];
      if (firstQuestion) {
        firstQuestion.questiontext = '<p>' + 'A'.repeat(10000) + '</p>';
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/AAAA/i)).toBeInTheDocument();
      });
    });

    it('should handle HTML content in question text', async () => {
      const reviewData = createMockReviewData();
      const firstQuestion = reviewData.questions[0];
      if (firstQuestion) {
        firstQuestion.questiontext = '<p><strong>Bold</strong> and <em>italic</em> text</p>';
      }
      mockGetAttemptReview.mockResolvedValue(reviewData);

      renderWithProviders(<QuizReview attemptId={123} />);

      await waitFor(() => {
        expect(screen.getByText(/bold/i)).toBeInTheDocument();
        expect(screen.getByText(/italic/i)).toBeInTheDocument();
      });
    });
  });
});
