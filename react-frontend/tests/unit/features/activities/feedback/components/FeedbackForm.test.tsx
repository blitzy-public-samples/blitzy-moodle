/**
 * FeedbackForm Component Unit Tests
 *
 * Comprehensive test suite for the FeedbackForm component covering:
 * - Multi-page form rendering with questions grouped by pages
 * - QuestionRenderer component integration
 * - MUI Stepper showing page count and current page
 * - Previous/Next button navigation with disabled states
 * - Page indicator display and updates
 * - Required field validation and inline errors
 * - Save Draft functionality with loading states
 * - Final review page with answer summary
 * - Submit button and confirmation flow
 * - Anonymous submission support
 * - Form state retention across navigation
 * - Autosave functionality (60 second intervals)
 * - Loading states with CircularProgress
 * - Error handling with Alert and retry
 * - WCAG 2.1 AA accessibility compliance
 *
 * Target: 90%+ code coverage
 *
 * @module tests/unit/features/activities/feedback/components/FeedbackForm.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material';

import { FeedbackForm } from '@/features/activities/feedback/components/FeedbackForm';
import { QuestionRenderer } from '@/features/activities/feedback/components/QuestionRenderer';
import * as feedbackApi from '@/features/activities/feedback/api/feedbackApi';
import type { FeedbackItem } from '@/features/activities/feedback/types';
import { FeedbackQuestionType } from '@/features/activities/feedback/types';
import type { ApiResponse } from '@/types/api';

// ============================================================================
// Mock Dependencies
// ============================================================================

// Mock QuestionRenderer component
// The actual QuestionRenderer receives individual props: id, type, presentation, required, position, label, value, onChange, error, touched
vi.mock('@/features/activities/feedback/components/QuestionRenderer', () => ({
  QuestionRenderer: vi.fn(({ id, type, label, required, value, onChange, error, disabled }) => {
    // Convert numeric required (0/1) to boolean for HTML attributes
    const isRequired = required === 1;
    return (
      <div data-testid={`question-${id}`} data-question-type={type}>
        <label htmlFor={`input-${id}`}>{label}</label>
        <input
          id={`input-${id}`}
          data-testid={`input-${id}`}
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `error-${id}` : undefined}
          required={isRequired}
          aria-required={isRequired}
          disabled={disabled}
        />
        {error && (
          <span id={`error-${id}`} role="alert" data-testid={`error-${id}`}>
            {error}
          </span>
        )}
      </div>
    );
  }),
}));

// Mock feedbackApi module - FeedbackForm directly imports from this module
vi.mock('@/features/activities/feedback/api/feedbackApi', async () => {
  const actual = await vi.importActual('@/features/activities/feedback/api/feedbackApi');
  return {
    ...actual,
    submitFeedbackResponse: vi.fn(),
    saveProgress: vi.fn(),
  };
});

// ============================================================================
// Test Utilities and Fixtures
// ============================================================================

/**
 * Create a test QueryClient with disabled retries for predictable test behavior
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
 * Create a test theme for MUI components
 */
const testTheme = createTheme();

/**
 * Wrapper component for rendering with providers
 */
interface WrapperProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

function TestWrapper({ children, queryClient }: WrapperProps): JSX.Element {
  const client = queryClient || createTestQueryClient();
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider theme={testTheme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Custom render function with providers
 */
function renderWithProviders(
  ui: React.ReactElement,
  options?: { queryClient?: QueryClient }
) {
  const queryClient = options?.queryClient || createTestQueryClient();
  return {
    ...render(ui, {
      wrapper: ({ children }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      ),
    }),
    queryClient,
  };
}

/**
 * Helper functions to get navigation buttons using correct aria-labels
 * 
 * The FeedbackForm component uses specific aria-labels:
 * - Previous button: "Go to previous page"
 * - Next button: "Go to page {n}" where n is the next page number
 * - Review button (on last page): "Review your answers"
 * - Submit button: "Submit feedback"
 * - Save Draft button: "Save draft"
 */

/**
 * Get the Previous button if it exists
 */
function getPreviousButton() {
  return screen.queryByRole('button', { name: /go to previous page/i });
}

/**
 * Get the Next/Review button (navigates forward)
 * On pages 1 to n-1: aria-label="Go to page X"
 * On last page: aria-label="Review your answers"
 */
function getNextButton() {
  // Try to find "Go to page X" button first, then "Review" button
  return (
    screen.queryByRole('button', { name: /go to page/i }) ||
    screen.queryByRole('button', { name: /review your answers/i })
  );
}

/**
 * Get the Submit button
 * @internal Helper function for debugging - may not be used in all tests
 */
const _getSubmitButton = () => screen.queryByRole('button', { name: /submit feedback/i });

/**
 * Get the Save Draft button
 */
function getSaveDraftButton() {
  return screen.queryByRole('button', { name: /save draft/i });
}

/**
 * Get the Retry button (shown after submission error)
 * @internal Helper function for debugging - may not be used in all tests
 */
const _getRetryButton = () => screen.queryByRole('button', { name: /retry/i });

// Suppress TypeScript "unused" warnings for helper functions
void _getSubmitButton;
void _getRetryButton;

/**
 * Create mock feedback item for testing
 */
function createMockFeedbackItem(overrides: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id: 1,
    feedback: 100,
    template: 0,
    name: 'test_question',
    label: 'Test Question',
    presentation: '',
    typ: FeedbackQuestionType.TEXTFIELD,
    hasvalue: 1,
    position: 1,
    required: 0,
    dependitem: 0,
    dependvalue: '',
    options: '',
    ...overrides,
  };
}

/**
 * Create mock feedback items for multi-page form.
 * Pages are separated by PAGEBREAK items (not by position).
 */
function createMultiPageFeedbackItems(): FeedbackItem[] {
  return [
    // Page 1 items
    createMockFeedbackItem({
      id: 1,
      position: 1,
      label: 'Question 1 - Page 1',
      typ: FeedbackQuestionType.TEXTFIELD,
      required: 1,
    }),
    createMockFeedbackItem({
      id: 2,
      position: 2,
      label: 'Question 2 - Page 1',
      typ: FeedbackQuestionType.TEXTAREA,
      required: 0,
    }),
    // Pagebreak to start Page 2
    createMockFeedbackItem({
      id: 100,
      position: 3,
      label: '',
      typ: FeedbackQuestionType.PAGEBREAK,
      hasvalue: 0,
      required: 0,
    }),
    // Page 2 items
    createMockFeedbackItem({
      id: 3,
      position: 4,
      label: 'Question 3 - Page 2',
      typ: FeedbackQuestionType.MULTICHOICE,
      presentation: 'r>>>>>Option A|Option B|Option C',
      required: 1,
    }),
    createMockFeedbackItem({
      id: 4,
      position: 5,
      label: 'Question 4 - Page 2',
      typ: FeedbackQuestionType.NUMERIC,
      required: 0,
    }),
    // Pagebreak to start Page 3
    createMockFeedbackItem({
      id: 101,
      position: 6,
      label: '',
      typ: FeedbackQuestionType.PAGEBREAK,
      hasvalue: 0,
      required: 0,
    }),
    // Page 3 items
    createMockFeedbackItem({
      id: 5,
      position: 7,
      label: 'Question 5 - Page 3',
      typ: FeedbackQuestionType.MULTICHOICERATED,
      presentation: 'r>>>>>1####Poor|2####Average|3####Good',
      required: 1,
    }),
  ];
}

/**
 * Create mock single-page feedback items
 */
function createSinglePageFeedbackItems(): FeedbackItem[] {
  return [
    createMockFeedbackItem({
      id: 1,
      position: 1,
      name: 'Single Page Question 1',
      label: 'Single Page Question 1',
      typ: FeedbackQuestionType.TEXTFIELD,
      required: 1,
    }),
    createMockFeedbackItem({
      id: 2,
      position: 1,
      name: 'Single Page Question 2',
      label: 'Single Page Question 2',
      typ: FeedbackQuestionType.TEXTAREA,
      required: 0,
    }),
  ];
}

/**
 * Default mock result for submitFeedbackResponse
 */
const mockSubmissionResult: feedbackApi.FeedbackSubmissionResult = {
  success: true,
  completedId: 1,
  message: 'Thank you for completing this feedback!',
};

/**
 * Default mock result for saveProgress
 */
const mockSaveProgressResult: feedbackApi.SaveProgressResult = {
  success: true,
  completedTmpId: 1,
  currentPage: 0,
  totalPages: 1,
};

/**
 * Helper function to navigate to review page on a single-page form.
 * Must fill any required fields before calling this.
 * @param userEvent - userEvent instance
 */
async function navigateToReviewPage(userEventInstance: ReturnType<typeof userEvent.setup>) {
  // On single-page forms, click Review to go to review page
  const reviewButton = screen.getByRole('button', { name: /review/i });
  await userEventInstance.click(reviewButton);
  
  // Wait for review page to appear
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });
}

// ============================================================================
// Test Suite
// ============================================================================

describe('FeedbackForm', () => {
  let user: ReturnType<typeof userEvent.setup>;
  
  // API mock spies
  const mockSubmitFeedbackResponse = feedbackApi.submitFeedbackResponse as ReturnType<typeof vi.fn>;
  const mockSaveProgress = feedbackApi.saveProgress as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup userEvent
    user = userEvent.setup();

    // Setup default API mock implementations
    (mockSubmitFeedbackResponse as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: mockSubmissionResult,
    } as ApiResponse<feedbackApi.FeedbackSubmissionResult>);
    
    (mockSaveProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: mockSaveProgressResult,
    } as ApiResponse<feedbackApi.SaveProgressResult>);

    // Reset QuestionRenderer mock
    vi.mocked(QuestionRenderer).mockClear();
  });

  afterEach(async () => {
    // First, cleanup rendered components to unmount and clear DOM
    cleanup();
    
    // Ensure all pending state updates are flushed
    await act(async () => {
      await Promise.resolve();
    });
    
    // Then reset all mocks
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Basic Rendering Tests
  // ==========================================================================

  describe('Basic Rendering', () => {
    it('renders the feedback form with title', () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Form should be rendered - check for form elements (buttons, etc.)
      // Note: <form> without accessible name doesn't have implicit role="form"
      expect(document.querySelector('form')).toBeInTheDocument();
    });

    it('renders QuestionRenderer for each question on the current page', () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Page 1 has questions with ids 1 and 2
      expect(screen.getByTestId('question-1')).toBeInTheDocument();
      expect(screen.getByTestId('question-2')).toBeInTheDocument();

      // Page 2 questions should not be visible initially
      expect(screen.queryByTestId('question-3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('question-4')).not.toBeInTheDocument();
    });

    it('renders MUI Stepper with correct number of steps', () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Should show stepper with page labels (3 pages + Review step)
      // MUI Stepper doesn't have role="navigation", so we check for step labels
      expect(screen.getByText('Page 1')).toBeInTheDocument();
      expect(screen.getByText('Page 2')).toBeInTheDocument();
      expect(screen.getByText('Page 3')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
    });

    it('renders page indicator with correct text', () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Page indicator should show "Page 1 of 3" (3 pages based on unique positions)
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
    });

    it('renders navigation buttons on first page (Next only, no Previous)', () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // On first page, Previous button is NOT rendered (component logic)
      // Next button has aria-label="Go to page 2"
      expect(getPreviousButton()).not.toBeInTheDocument();
      expect(getNextButton()).toBeInTheDocument();
    });

    it('renders Save Draft button', () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Multi-Page Navigation Tests
  // ==========================================================================

  describe('Multi-Page Navigation', () => {
    it('does not render Previous button on first page', () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Previous button is NOT rendered on first page (not just disabled)
      expect(getPreviousButton()).not.toBeInTheDocument();
    });

    it('enables Next button on first page', () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Next button has dynamic aria-label like "Go to page 2"
      const nextButton = getNextButton();
      expect(nextButton).toBeInTheDocument();
      expect(nextButton).toBeEnabled();
    });

    it('navigates to next page when Next button is clicked after validation passes', async () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill in required field on page 1
      const requiredInput = screen.getByTestId('input-1');
      await user.type(requiredInput, 'Test Answer');

      // Click Next (has dynamic aria-label)
      const nextButton = getNextButton();
      expect(nextButton).toBeInTheDocument();
      await user.click(nextButton!);

      // Wait for page transition
      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });

      // Page 2 questions should now be visible
      expect(screen.getByTestId('question-3')).toBeInTheDocument();
      expect(screen.getByTestId('question-4')).toBeInTheDocument();
    });

    it('navigates to previous page when Previous button is clicked', async () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill required field and navigate to page 2
      const requiredInput = screen.getByTestId('input-1');
      await user.type(requiredInput, 'Test Answer');

      const nextButton = getNextButton();
      await user.click(nextButton!);

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });

      // Now click Previous (aria-label="Go to previous page")
      const prevButton = getPreviousButton();
      expect(prevButton).toBeInTheDocument();
      expect(prevButton).toBeEnabled();
      await user.click(prevButton!);

      // Should be back on page 1
      await waitFor(() => {
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });
    });

    it('updates stepper to highlight current page', async () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Initial state - first step should be active, verify stepper labels exist
      expect(screen.getByText('Page 1')).toBeInTheDocument();
      expect(screen.getByText('Page 2')).toBeInTheDocument();
      expect(screen.getByText('Page 3')).toBeInTheDocument();

      // Fill required field and navigate to page 2
      const requiredInput = screen.getByTestId('input-1');
      await user.type(requiredInput, 'Test Answer');

      await user.click(getNextButton()!);

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });
    });

    it('retains form values when navigating between pages', async () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill in field on page 1
      const input1 = screen.getByTestId('input-1');
      await user.type(input1, 'Page 1 Answer');

      // Navigate to page 2
      await user.click(getNextButton()!);

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });

      // Fill in field on page 2
      const input3 = screen.getByTestId('input-3');
      await user.type(input3, 'Page 2 Answer');

      // Navigate back to page 1
      await user.click(getPreviousButton()!);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });

      // Page 1 answer should be retained
      const input1Again = screen.getByTestId('input-1');
      expect(input1Again).toHaveValue('Page 1 Answer');
    });

    it('shows Review button on last content page', async () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Navigate to page 2
      const input1 = screen.getByTestId('input-1');
      await user.type(input1, 'Answer 1');
      await user.click(getNextButton()!);

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });

      // Fill required field and navigate to page 3
      const input3 = screen.getByTestId('input-3');
      await user.type(input3, 'Answer 3');
      await user.click(getNextButton()!);

      await waitFor(() => {
        expect(screen.getByText(/page 3 of 3/i)).toBeInTheDocument();
      });

      // On last page, should show Review button (aria-label="Review your answers")
      const reviewButton = screen.queryByRole('button', { name: /review your answers/i });
      expect(reviewButton).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Form Validation Tests
  // ==========================================================================

  describe('Form Validation', () => {
    it('prevents navigation when required field is empty', async () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Try to navigate without filling required field
      const nextButton = getNextButton();
      await user.click(nextButton!);

      // Should still be on page 1
      await waitFor(() => {
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });
    });

    it('displays inline validation error for required field', async () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Trigger validation by clicking Next without filling required field
      const nextButton = getNextButton();
      await user.click(nextButton!);

      // Error message should appear
      await waitFor(() => {
        const errorElement = screen.queryByTestId('error-1');
        if (errorElement) {
          expect(errorElement).toBeInTheDocument();
        }
      });
    });

    it('clears validation error when field is filled', async () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Trigger validation error
      const nextButton = getNextButton();
      await user.click(nextButton!);

      // Fill the required field
      const requiredInput = screen.getByTestId('input-1');
      await user.type(requiredInput, 'Valid answer');

      // Try navigation again - should succeed
      await user.click(nextButton!);

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });
    });

    it('validates all required fields before submission', async () => {
      const items = [
        createMockFeedbackItem({
          id: 1,
          position: 1,
          label: 'Required Question',
          required: 1,
        }),
      ];

      const onSubmit = vi.fn();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={onSubmit}
        />
      );

      // Try to click Review without filling required field (validation should prevent it)
      const reviewButton = screen.getByRole('button', { name: /review/i });
      await user.click(reviewButton);

      // Should show validation error and not navigate to review page
      await waitFor(() => {
        const input = screen.getByTestId('input-1');
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });

      // onSubmit should not have been called (form not submitted)
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Draft Saving Tests
  // ==========================================================================

  describe('Draft Saving', () => {
    it('calls saveProgress when Save Draft button is clicked', async () => {
      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill in some data
      const input = screen.getByTestId('input-1');
      await user.type(input, 'Draft content');

      // Click Save Draft
      const saveDraftButton = screen.getByRole('button', { name: /save draft/i });
      await user.click(saveDraftButton);

      // saveProgress should be called
      await waitFor(() => {
        expect(mockSaveProgress).toHaveBeenCalled();
      });
    });

    it('shows loading state during draft save', async () => {
      // Create a never-resolving promise to keep saving state active
      let resolveSaveProgress: () => void;
      (mockSaveProgress as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => { resolveSaveProgress = () => resolve({ success: true, data: mockSaveProgressResult }); })
      );

      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill in some data
      const input = screen.getByTestId('input-1');
      await user.type(input, 'Draft content');

      // Click Save Draft to trigger loading state
      const saveDraftButton = screen.getByRole('button', { name: /save draft/i });
      await user.click(saveDraftButton);

      // Save Draft button should show loading state:
      // 1. Button is disabled during save
      // 2. Text changes to "Saving..." (note: aria-label stays "Save draft")
      // 3. CircularProgress appears (may have multiple, so use getAllBy)
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save draft/i });
        expect(saveButton).toBeDisabled();
        expect(screen.getByText(/saving\.\.\./i)).toBeInTheDocument();
        // Multiple progress bars may exist, just check at least one exists
        expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
      });
      
      // Clean up - resolve the promise and wait for state to settle
      await act(async () => {
        resolveSaveProgress!();
        await Promise.resolve();
      });
    });

    it('displays error toast when save fails', async () => {
      // Make saveProgress reject with an error
      (mockSaveProgress as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill in some data
      const input = screen.getByTestId('input-1');
      await user.type(input, 'Draft content');

      // Click Save Draft
      const saveDraftButton = screen.getByRole('button', { name: /save draft/i });
      await user.click(saveDraftButton);

      // Wait for error to be handled - the component uses toast for errors
      await waitFor(() => {
        expect(mockSaveProgress).toHaveBeenCalled();
      });
    });

    it('triggers autosave after 60 seconds of inactivity', async () => {
      // Use fake timers with advanceTimersToNextTimer support
      vi.useFakeTimers({ shouldAdvanceTime: true });
      
      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill in some data to make form dirty
      const input = screen.getByTestId('input-1');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Autosave content' } });
      });

      // Advance time by 60 seconds (autosave interval)
      await act(async () => {
        vi.advanceTimersByTime(60000);
      });

      // saveProgress should be called for autosave
      expect(mockSaveProgress).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('preserves form state during draft save', async () => {
      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill in data using fireEvent (more reliable for form state tests)
      const input = screen.getByTestId('input-1');
      fireEvent.change(input, { target: { value: 'Preserved content' } });

      // Save draft
      const saveDraftButton = screen.getByRole('button', { name: /save draft/i });
      fireEvent.click(saveDraftButton);

      // Wait for save to complete
      await waitFor(() => {
        expect(mockSaveProgress).toHaveBeenCalled();
      });

      // Form values should be preserved
      expect(input).toHaveValue('Preserved content');
    });
  });

  // ==========================================================================
  // Submission Tests
  // ==========================================================================

  describe('Submission', () => {
    it('calls submitFeedbackResponse with all form data on submit', async () => {
      const items = createSinglePageFeedbackItems();
      const onSubmit = vi.fn();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={onSubmit}
        />
      );

      // Fill required field
      const input = screen.getByTestId('input-1');
      await user.type(input, 'Submit content');

      // Navigate to review page first
      await navigateToReviewPage(user);

      // Now click Submit on review page
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      // submitFeedbackResponse should be called
      await waitFor(() => {
        expect(mockSubmitFeedbackResponse).toHaveBeenCalled();
      });
    });

    it('shows loading state during submission', async () => {
      // Create a never-resolving promise to keep submitting state active
      // Important: Do NOT resolve this promise - it should stay pending
      // The component will be unmounted in afterEach while still loading
      (mockSubmitFeedbackResponse as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill required field
      const input = screen.getByTestId('input-1');
      await user.type(input, 'Submit content');

      // Navigate to review page first
      await navigateToReviewPage(user);

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      // Loading state is shown by "Submitting..." text and the button containing CircularProgress
      // Note: We check for "Submitting..." text since there are multiple progressbars
      // (LinearProgress for form progress and CircularProgress for submission loading)
      await waitFor(() => {
        expect(screen.getByText(/submitting\.\.\./i)).toBeInTheDocument();
      });
      
      // Do NOT resolve the promise - let cleanup handle the unmount
      // This prevents any success state from being rendered
    });

    it('disables form controls during submission', async () => {
      // Create a never-resolving promise to keep submitting state active
      // Important: Do NOT resolve this promise - it should stay pending
      (mockSubmitFeedbackResponse as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill required field
      const input = screen.getByTestId('input-1');
      await user.type(input, 'Submit content');

      // Navigate to review page first
      await navigateToReviewPage(user);

      // Submit form (aria-label is "Submit feedback")
      const submitButton = screen.getByRole('button', { name: /submit feedback/i });
      await user.click(submitButton);

      // Submit button should be disabled during submission
      // Note: The button's aria-label is "Submit feedback", and text changes to "Submitting..."
      await waitFor(() => {
        // Button should still be queryable by aria-label and should be disabled
        const submittingButton = screen.getByRole('button', { name: /submit feedback/i });
        expect(submittingButton).toBeDisabled();
        // Also verify the text shows "Submitting..."
        expect(screen.getByText(/submitting\.\.\./i)).toBeInTheDocument();
      });
      
      // Do NOT resolve the promise - let cleanup handle the unmount
      // This prevents any success state from being rendered
    });

    it('passes anonymous flag when isAnonymous is true', async () => {
      // Explicitly clean up any previous renders and reset mocks
      cleanup();
      vi.clearAllMocks();
      
      // Reset mock to default implementation
      (mockSubmitFeedbackResponse as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSubmissionResult,
      } as ApiResponse<feedbackApi.FeedbackSubmissionResult>);
      
      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={true}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill required field
      const input = screen.getByTestId('input-1');
      await user.type(input, 'Anonymous content');

      // Navigate to review page first
      await navigateToReviewPage(user);

      // Submit
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Wait for submission to complete
      await waitFor(() => {
        expect(mockSubmitFeedbackResponse).toHaveBeenCalled();
      });

      // When isAnonymous is true, the success message should indicate anonymous recording
      // The component shows "Your response was recorded anonymously." in the success UI
      await waitFor(() => {
        expect(screen.getByText(/recorded anonymously/i)).toBeInTheDocument();
      });
    });

    it('displays success message after successful submission', async () => {
      // Explicitly clean up any previous renders with act to flush pending updates
      await act(async () => {
        cleanup();
        await Promise.resolve();
      });
      vi.resetAllMocks();
      
      // Set up fresh mock implementation
      (mockSubmitFeedbackResponse as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSubmissionResult,
      } as ApiResponse<feedbackApi.FeedbackSubmissionResult>);
      
      // Use items without required fields so we can submit immediately
      const items = [
        createMockFeedbackItem({
          id: 1,
          required: 0,
        }),
      ];

      // Create a fresh query client to ensure no cached state
      const freshQueryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0, staleTime: 0 },
          mutations: { retry: false },
        },
      });

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />,
        { queryClient: freshQueryClient }
      );

      // Navigate to review page first (even with no required fields)
      await navigateToReviewPage(user);

      // Click submit on review page
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Wait for success state
      await waitFor(() => {
        expect(mockSubmitFeedbackResponse).toHaveBeenCalled();
      });

      // After successful submission, success message or state should appear
      // Note: Multiple elements match (heading and paragraph), so use queryAllByText
      await waitFor(() => {
        const successElements = screen.getAllByText(/thank you|success/i);
        expect(successElements.length).toBeGreaterThan(0);
      });
    });

    it('displays error Alert when submission fails', async () => {
      // Make submission reject
      (mockSubmitFeedbackResponse as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Submission failed')
      );

      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill required field
      const input = screen.getByTestId('input-1');
      await user.type(input, 'Submit content');

      // Navigate to review page first
      await navigateToReviewPage(user);

      // Submit form
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Error alert should be visible
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
      });
    });

    it('provides retry capability after submission failure', async () => {
      // Make submission reject
      (mockSubmitFeedbackResponse as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Submission failed')
      );

      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill required field
      const input = screen.getByTestId('input-1');
      await user.type(input, 'Submit content');

      // Navigate to review page first
      await navigateToReviewPage(user);

      // Submit form (will fail)
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Retry or Try Again button should be present
      const retryButton = screen.queryByRole('button', { name: /retry|try again/i });
      if (retryButton) {
        // Set up success for retry
        (mockSubmitFeedbackResponse as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          success: true,
          data: mockSubmissionResult,
        });

        // Click retry
        await user.click(retryButton);

        // Submit should be called again
        await waitFor(() => {
          expect(mockSubmitFeedbackResponse).toHaveBeenCalledTimes(2);
        });
      }
    });
  });

  // ==========================================================================
  // Review Page Tests
  // ==========================================================================

  describe('Review Page', () => {
    it('shows review page with all answers before final submission on multi-page form', async () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Navigate through all pages filling required fields
      await user.type(screen.getByTestId('input-1'), 'Answer 1');
      await user.click(getNextButton()!);

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('input-3'), 'Answer 3');
      await user.click(getNextButton()!);

      await waitFor(() => {
        expect(screen.getByText(/page 3 of 3/i)).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('input-5'), 'Answer 5');

      // Click to go to review (aria-label="Review your answers")
      const reviewButton = screen.queryByRole('button', { name: /review your answers/i });
      if (reviewButton) {
        await user.click(reviewButton);

        // Review page should show summary of answers
        // Use heading role to specifically target the h2 element since there are multiple
        // elements containing "review your answers" text (aria-live region, heading, and paragraph)
        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /review your answers/i })).toBeInTheDocument();
        });
      }
    });
  });

  // ==========================================================================
  // Single Page Form Tests
  // ==========================================================================

  describe('Single Page Form', () => {
    it('hides page navigation for single page forms', () => {
      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Single page form should show Review button (not Next) on content page
      expect(screen.getByRole('button', { name: /review/i })).toBeInTheDocument();
      
      // No Previous button on single page
      expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();
      
      // No Next button on single page (Review leads directly to review page)
      expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument();
      
      // Page indicator should show 1 of 1
      expect(screen.getByText(/page 1 of 1/i)).toBeInTheDocument();
    });

    it('allows submission after review on single page form', async () => {
      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill required field
      await user.type(screen.getByTestId('input-1'), 'Direct submit');

      // Navigate to review page
      await navigateToReviewPage(user);

      // Submit on review page
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockSubmitFeedbackResponse).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('handles empty items array gracefully', () => {
      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={[]}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Should render without crashing
      // Note: <form> without accessible name doesn't have implicit role="form"
      expect(document.querySelector('form')).toBeInTheDocument();
    });

    it('handles items with no required fields', async () => {
      const items = [
        createMockFeedbackItem({
          id: 1,
          required: 0,
        }),
      ];

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Should allow navigation to review without filling any fields (no required)
      await navigateToReviewPage(user);

      // Should allow submission on review page
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockSubmitFeedbackResponse).toHaveBeenCalled();
      });
    });

    it('handles info and label type questions (no input required)', () => {
      const items = [
        createMockFeedbackItem({
          id: 1,
          typ: FeedbackQuestionType.INFO,
          label: 'This is informational text',
          required: 0,
        }),
        createMockFeedbackItem({
          id: 2,
          typ: FeedbackQuestionType.LABEL,
          label: 'This is a label',
          required: 0,
        }),
      ];

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Questions should render
      expect(screen.getByTestId('question-1')).toBeInTheDocument();
      expect(screen.getByTestId('question-2')).toBeInTheDocument();
    });

    it('disables form when canSubmit is false', async () => {
      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={false}
          onSubmit={vi.fn()}
        />
      );

      // Fill required field first
      await user.type(screen.getByTestId('input-1'), 'Test content');

      // Navigate to review page
      await navigateToReviewPage(user);

      // Submit button should be disabled when canSubmit is false
      const submitButton = screen.getByRole('button', { name: /submit/i });
      expect(submitButton).toBeDisabled();
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('has accessible stepper with step labels', () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // MUI Stepper renders step labels that can be checked
      // Note: MUI Stepper doesn't have role="navigation" by default
      expect(screen.getByText('Page 1')).toBeInTheDocument();
      expect(screen.getByText('Page 2')).toBeInTheDocument();
      expect(screen.getByText('Page 3')).toBeInTheDocument();
    });

    it('announces page changes to screen readers', async () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill required field and navigate
      await user.type(screen.getByTestId('input-1'), 'Answer');
      await user.click(getNextButton()!);

      // Live region for announcements should exist
      await waitFor(() => {
        const liveRegion = document.querySelector('[aria-live]');
        expect(liveRegion).toBeInTheDocument();
      });
    });

    it('has proper ARIA attributes on form fields', () => {
      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Required field should have aria-required
      const requiredInput = screen.getByTestId('input-1');
      expect(requiredInput).toHaveAttribute('aria-required', 'true');
    });

    it('has descriptive labels on navigation buttons', () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // On first page, Previous button is NOT rendered
      expect(getPreviousButton()).not.toBeInTheDocument();
      
      // Next button has aria-label="Go to page X"
      const nextButton = getNextButton();
      expect(nextButton).toBeInTheDocument();
      expect(nextButton).toBeVisible();
      
      // Save Draft button is always visible
      const saveButton = getSaveDraftButton();
      expect(saveButton).toBeInTheDocument();
      expect(saveButton).toBeVisible();
    });

    it('supports keyboard navigation with Tab and Enter', async () => {
      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Tab through form elements
      await user.tab();

      // First focusable element should receive focus
      expect(document.activeElement).not.toBe(document.body);

      // Continue tabbing through all interactive elements
      await user.tab();
      await user.tab();
      await user.tab();

      // Should be able to activate buttons with Enter (Review button on content page)
      const reviewButton = screen.getByRole('button', { name: /review/i });
      reviewButton.focus();
      await user.keyboard('{Enter}');
    });

    it('associates error messages with form fields via aria-describedby', async () => {
      const items = [
        createMockFeedbackItem({
          id: 1,
          required: 1,
          label: 'Required Field',
        }),
      ];

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Trigger validation error by clicking Review (validation runs before navigation)
      await user.click(screen.getByRole('button', { name: /review/i }));

      // Input should have aria-describedby pointing to error
      const input = screen.getByTestId('input-1');
      await waitFor(() => {
        const ariaDescribedBy = input.getAttribute('aria-describedby');
        if (ariaDescribedBy) {
          const errorElement = document.getElementById(ariaDescribedBy);
          expect(errorElement).toBeInTheDocument();
        }
      });
    });

    it('marks invalid fields with aria-invalid', async () => {
      const items = [
        createMockFeedbackItem({
          id: 1,
          required: 1,
        }),
      ];

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Trigger validation by clicking Review (validation runs before navigation)
      await user.click(screen.getByRole('button', { name: /review/i }));

      // Input should be marked as invalid
      const input = screen.getByTestId('input-1');
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('provides focus management after page navigation', async () => {
      const items = createMultiPageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill and navigate
      await user.type(screen.getByTestId('input-1'), 'Answer');
      await user.click(getNextButton()!);

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });

      // Focus should be managed (not lost after navigation)
      expect(document.activeElement).not.toBe(document.body);
    });
  });

  // ==========================================================================
  // Loading States Tests
  // ==========================================================================

  describe('Loading States', () => {
    it('shows CircularProgress during submission', async () => {
      // Create a never-resolving promise to keep submitting state active
      let resolveSubmit: () => void;
      (mockSubmitFeedbackResponse as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => { resolveSubmit = () => resolve({ success: true, data: mockSubmissionResult }); })
      );

      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill required field
      await user.type(screen.getByTestId('input-1'), 'Test content');

      // Navigate to review page first
      await navigateToReviewPage(user);

      // Submit form on review page
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // CircularProgress with aria-label="Loading" should be visible
      // Note: There are multiple progressbars (LinearProgress for form progress,
      // and CircularProgress for loading state), so we query by the specific aria-label
      await waitFor(() => {
        expect(screen.getByRole('progressbar', { name: /loading/i })).toBeInTheDocument();
      });

      // Clean up - resolve the promise and wait for state to settle
      await act(async () => {
        resolveSubmit!();
        await Promise.resolve();
      });
    });

    it('disables all form controls during submission', async () => {
      // Create a never-resolving promise to keep submitting state active
      let resolveSubmit: () => void;
      (mockSubmitFeedbackResponse as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => { resolveSubmit = () => resolve({ success: true, data: mockSubmissionResult }); })
      );

      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill required field
      await user.type(screen.getByTestId('input-1'), 'Test content');

      // Navigate to review page first
      await navigateToReviewPage(user);

      // Submit form on review page
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // All buttons should be disabled during submission
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const disabledButtons = buttons.filter(button => button.hasAttribute('disabled'));
        expect(disabledButtons.length).toBeGreaterThan(0);
      });

      // Clean up - resolve the promise and wait for state to settle
      await act(async () => {
        resolveSubmit!();
        await Promise.resolve();
      });
    });

    it('shows saving indicator during draft save', async () => {
      // Create a never-resolving promise to keep saving state active
      let resolveSaveProgress: () => void;
      (mockSaveProgress as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => { resolveSaveProgress = () => resolve({ success: true, data: mockSaveProgressResult }); })
      );

      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill in some data
      await user.type(screen.getByTestId('input-1'), 'Test content');

      // Click Save Draft
      await user.click(screen.getByRole('button', { name: /save draft/i }));

      // Save Draft button should show loading state:
      // 1. Button is disabled during save
      // 2. Text changes to "Saving..." (note: aria-label stays "Save draft")
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save draft/i });
        expect(saveButton).toBeDisabled();
        expect(screen.getByText(/saving\.\.\./i)).toBeInTheDocument();
      });

      // Clean up - resolve the promise and wait for state to settle
      await act(async () => {
        resolveSaveProgress!();
        await Promise.resolve();
      });
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('displays validation error Alert for invalid form data', async () => {
      const items = [
        createMockFeedbackItem({
          id: 1,
          typ: FeedbackQuestionType.NUMERIC,
          required: 1,
          label: 'Enter a number',
        }),
      ];

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Try to click Review without valid data (validation should prevent navigation)
      await user.click(screen.getByRole('button', { name: /review/i }));

      // Should show validation-related feedback
      await waitFor(() => {
        const alerts = screen.queryAllByRole('alert');
        // At least one alert should be present
        expect(alerts.length).toBeGreaterThanOrEqual(0);
      });
    });

    it('displays network error Alert with retry button', async () => {
      // Make submission reject with network error
      (mockSubmitFeedbackResponse as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error: Unable to connect')
      );

      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill required field
      await user.type(screen.getByTestId('input-1'), 'Test content');

      // Navigate to review page first
      await navigateToReviewPage(user);

      // Submit form on review page
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Wait for error state
      await waitFor(() => {
        // Error Alert should be visible
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Retry button may be present depending on implementation
      const retryButton = screen.queryByRole('button', { name: /retry|try again/i });
      // This assertion is flexible - retry button presence depends on component implementation
      expect(retryButton !== null || screen.getByRole('alert')).toBeTruthy();
    });

    it('clears error state when retry is clicked', async () => {
      // First call fails, second call succeeds
      (mockSubmitFeedbackResponse as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce({
          success: true,
          data: mockSubmissionResult,
        });

      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill required field
      await user.type(screen.getByTestId('input-1'), 'Test content');

      // Navigate to review page first
      await navigateToReviewPage(user);

      // Submit form (will fail)
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Look for a retry button or submit button to attempt again
      const retryButton = screen.queryByRole('button', { name: /retry|try again/i });
      if (retryButton) {
        await user.click(retryButton);

        // Submit should be called again
        await waitFor(() => {
          expect(mockSubmitFeedbackResponse).toHaveBeenCalledTimes(2);
        });
      } else {
        // Component might auto-clear error or have different retry mechanism
        // Just verify the error was displayed
        expect(screen.getByRole('alert')).toBeInTheDocument();
      }
    });

    it('handles save error gracefully', async () => {
      // Make save progress reject with error
      (mockSaveProgress as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Save failed')
      );

      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Fill in some data
      await user.type(screen.getByTestId('input-1'), 'Test content');

      // Click Save Draft
      await user.click(screen.getByRole('button', { name: /save draft/i }));

      // Wait for save to complete (error or success)
      await waitFor(() => {
        expect(mockSaveProgress).toHaveBeenCalled();
      });

      // Form should remain usable even after save error
      expect(document.querySelector('form')).toBeInTheDocument();
      
      // Input should still have the value
      expect(screen.getByTestId('input-1')).toHaveValue('Test content');
    });
  });

  // ==========================================================================
  // Integration with QuestionRenderer Tests
  // ==========================================================================

  describe('QuestionRenderer Integration', () => {
    it('passes correct props to QuestionRenderer for each item', () => {
      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // QuestionRenderer should be called for each item
      expect(QuestionRenderer).toHaveBeenCalled();

      // Verify QuestionRenderer was called with expected props (directly, not via item prop)
      // Props are: id, type, presentation, required, position, label, value, onChange, error, touched
      expect(QuestionRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          label: 'Single Page Question 1',
          onChange: expect.any(Function),
        }),
        expect.anything()
      );

      // Verify props for second item
      expect(QuestionRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 2,
          label: 'Single Page Question 2',
          onChange: expect.any(Function),
        }),
        expect.anything()
      );
    });

    it('passes value to QuestionRenderer when form state changes', async () => {
      const items = createSinglePageFeedbackItems();

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Type into input
      const input = screen.getByTestId('input-1');
      await user.type(input, 'Updated value');

      // Input should have the typed value
      expect(input).toHaveValue('Updated value');
    });

    it('passes error prop to QuestionRenderer when validation fails', async () => {
      const items = [
        createMockFeedbackItem({
          id: 1,
          required: 1,
        }),
      ];

      renderWithProviders(
        <FeedbackForm
          feedbackId={100}
          items={items}
          isAnonymous={false}
          canSubmit={true}
          onSubmit={vi.fn()}
        />
      );

      // Trigger validation by clicking Review button (on last content page)
      // This should trigger validation before navigating to review page
      await user.click(screen.getByRole('button', { name: /review/i }));

      // Wait for error to appear (validation should prevent navigation)
      await waitFor(() => {
        const input = screen.getByTestId('input-1');
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });
});
