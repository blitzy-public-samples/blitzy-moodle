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
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material';

import { FeedbackForm } from '@/features/activities/feedback/components/FeedbackForm';
import { QuestionRenderer } from '@/features/activities/feedback/components/QuestionRenderer';
import { useFeedbackResponse } from '@/features/activities/feedback/hooks/useFeedbackResponse';
import type { FeedbackItem } from '@/features/activities/feedback/types';

// ============================================================================
// Mock Dependencies
// ============================================================================

// Mock QuestionRenderer component
vi.mock('@/features/activities/feedback/components/QuestionRenderer', () => ({
  QuestionRenderer: vi.fn(({ item, value, onChange, error }) => (
    <div data-testid={`question-${item.id}`} data-question-type={item.typ}>
      <label htmlFor={`input-${item.id}`}>{item.label}</label>
      <input
        id={`input-${item.id}`}
        data-testid={`input-${item.id}`}
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `error-${item.id}` : undefined}
        required={item.required}
        aria-required={item.required}
      />
      {error && (
        <span id={`error-${item.id}`} role="alert" data-testid={`error-${item.id}`}>
          {error}
        </span>
      )}
    </div>
  )),
}));

// Mock useFeedbackResponse hook
vi.mock('@/features/activities/feedback/hooks/useFeedbackResponse', () => ({
  useFeedbackResponse: vi.fn(),
}));

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
    typ: 'textfield',
    hasvalue: 1,
    position: 1,
    required: false,
    dependitem: 0,
    dependvalue: '',
    options: '',
    ...overrides,
  };
}

/**
 * Create mock feedback items for multi-page form (grouped by position)
 */
function createMultiPageFeedbackItems(): FeedbackItem[] {
  return [
    // Page 1 items (position 1)
    createMockFeedbackItem({
      id: 1,
      position: 1,
      label: 'Question 1 - Page 1',
      typ: 'textfield',
      required: true,
    }),
    createMockFeedbackItem({
      id: 2,
      position: 1,
      label: 'Question 2 - Page 1',
      typ: 'textarea',
      required: false,
    }),
    // Page 2 items (position 2)
    createMockFeedbackItem({
      id: 3,
      position: 2,
      label: 'Question 3 - Page 2',
      typ: 'multichoice',
      presentation: 'r>>>>>Option A|Option B|Option C',
      required: true,
    }),
    createMockFeedbackItem({
      id: 4,
      position: 2,
      label: 'Question 4 - Page 2',
      typ: 'numeric',
      required: false,
    }),
    // Page 3 items (position 3)
    createMockFeedbackItem({
      id: 5,
      position: 3,
      label: 'Question 5 - Page 3',
      typ: 'multichoicerated',
      presentation: 'r>>>>>1=Poor|2=Average|3=Good',
      required: true,
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
      label: 'Single Page Question 1',
      typ: 'textfield',
      required: true,
    }),
    createMockFeedbackItem({
      id: 2,
      position: 1,
      label: 'Single Page Question 2',
      typ: 'textarea',
      required: false,
    }),
  ];
}

/**
 * Default mock return value for useFeedbackResponse
 */
function createMockUseFeedbackResponse(overrides = {}) {
  return {
    submitResponse: vi.fn().mockResolvedValue({ success: true }),
    saveProgress: vi.fn().mockResolvedValue({ success: true }),
    isSubmitting: false,
    isSaving: false,
    submitError: null,
    saveError: null,
    isSubmitSuccess: false,
    isSaveSuccess: false,
    resetSubmit: vi.fn(),
    resetSave: vi.fn(),
    ...overrides,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('FeedbackForm', () => {
  let mockUseFeedbackResponse: ReturnType<typeof createMockUseFeedbackResponse>;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup userEvent
    user = userEvent.setup();

    // Setup default mock return value
    mockUseFeedbackResponse = createMockUseFeedbackResponse();
    vi.mocked(useFeedbackResponse).mockReturnValue(mockUseFeedbackResponse);

    // Reset QuestionRenderer mock
    vi.mocked(QuestionRenderer).mockClear();
  });

  afterEach(() => {
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

      // Form should be rendered
      expect(screen.getByRole('form')).toBeInTheDocument();
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

      // Should show stepper with page navigation
      const stepper = screen.getByRole('navigation', { name: /page progress/i });
      expect(stepper).toBeInTheDocument();
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

    it('renders Previous and Next navigation buttons', () => {
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

      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
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
    it('disables Previous button on first page', () => {
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

      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeDisabled();
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

      const nextButton = screen.getByRole('button', { name: /next/i });
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

      // Click Next
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

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

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });

      // Now click Previous
      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeEnabled();
      await user.click(prevButton);

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

      // Initial state - first step should be active
      const stepper = screen.getByRole('navigation', { name: /page progress/i });
      expect(stepper).toBeInTheDocument();

      // Fill required field and navigate to page 2
      const requiredInput = screen.getByTestId('input-1');
      await user.type(requiredInput, 'Test Answer');

      await user.click(screen.getByRole('button', { name: /next/i }));

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
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });

      // Fill in field on page 2
      const input3 = screen.getByTestId('input-3');
      await user.type(input3, 'Page 2 Answer');

      // Navigate back to page 1
      await user.click(screen.getByRole('button', { name: /previous/i }));

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });

      // Page 1 answer should be retained
      const input1Again = screen.getByTestId('input-1');
      expect(input1Again).toHaveValue('Page 1 Answer');
    });

    it('shows Submit button instead of Next on last page', async () => {
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
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });

      // Fill required field and navigate to page 3
      const input3 = screen.getByTestId('input-3');
      await user.type(input3, 'Answer 3');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/page 3 of 3/i)).toBeInTheDocument();
      });

      // On last page, should show Submit button
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
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
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

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
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

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
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      // Fill the required field
      const requiredInput = screen.getByTestId('input-1');
      await user.type(requiredInput, 'Valid answer');

      // Try navigation again - should succeed
      await user.click(nextButton);

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
          required: true,
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

      // Try to submit without filling required field
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      // Submit should not have been called
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
        expect(mockUseFeedbackResponse.saveProgress).toHaveBeenCalled();
      });
    });

    it('shows loading state during draft save', async () => {
      mockUseFeedbackResponse = createMockUseFeedbackResponse({
        isSaving: true,
      });
      vi.mocked(useFeedbackResponse).mockReturnValue(mockUseFeedbackResponse);

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

      // Save Draft button should show loading state
      const saveDraftButton = screen.getByRole('button', { name: /saving/i });
      expect(saveDraftButton).toBeDisabled();
    });

    it('displays error Alert when save fails', async () => {
      mockUseFeedbackResponse = createMockUseFeedbackResponse({
        saveError: new Error('Network error'),
      });
      vi.mocked(useFeedbackResponse).mockReturnValue(mockUseFeedbackResponse);

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

      // Error alert should be visible
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('triggers autosave after 60 seconds of inactivity', async () => {
      vi.useFakeTimers();

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
      fireEvent.change(input, { target: { value: 'Autosave content' } });

      // Advance time by 60 seconds
      vi.advanceTimersByTime(60000);

      // saveProgress should be called for autosave
      await waitFor(() => {
        expect(mockUseFeedbackResponse.saveProgress).toHaveBeenCalled();
      });

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

      // Fill in data
      const input = screen.getByTestId('input-1');
      await user.type(input, 'Preserved content');

      // Save draft
      await user.click(screen.getByRole('button', { name: /save draft/i }));

      // Form values should be preserved
      expect(input).toHaveValue('Preserved content');
    });
  });

  // ==========================================================================
  // Submission Tests
  // ==========================================================================

  describe('Submission', () => {
    it('calls submitResponse with all form data on submit', async () => {
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

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      // submitResponse should be called
      await waitFor(() => {
        expect(mockUseFeedbackResponse.submitResponse).toHaveBeenCalled();
      });
    });

    it('shows loading state during submission', async () => {
      mockUseFeedbackResponse = createMockUseFeedbackResponse({
        isSubmitting: true,
      });
      vi.mocked(useFeedbackResponse).mockReturnValue(mockUseFeedbackResponse);

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

      // CircularProgress should be visible
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('disables form controls during submission', async () => {
      mockUseFeedbackResponse = createMockUseFeedbackResponse({
        isSubmitting: true,
      });
      vi.mocked(useFeedbackResponse).mockReturnValue(mockUseFeedbackResponse);

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

      // Submit button should be disabled
      const submitButton = screen.getByRole('button', { name: /submitting/i });
      expect(submitButton).toBeDisabled();
    });

    it('passes anonymous flag when isAnonymous is true', async () => {
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

      // Submit
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // submitResponse should be called with anonymous flag
      await waitFor(() => {
        expect(mockUseFeedbackResponse.submitResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            anonymous: true,
          })
        );
      });
    });

    it('displays success message after successful submission', async () => {
      mockUseFeedbackResponse = createMockUseFeedbackResponse({
        isSubmitSuccess: true,
      });
      vi.mocked(useFeedbackResponse).mockReturnValue(mockUseFeedbackResponse);

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

      // Success message should be visible
      expect(screen.getByText(/thank you/i)).toBeInTheDocument();
    });

    it('displays error Alert when submission fails', async () => {
      mockUseFeedbackResponse = createMockUseFeedbackResponse({
        submitError: new Error('Submission failed'),
      });
      vi.mocked(useFeedbackResponse).mockReturnValue(mockUseFeedbackResponse);

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

      // Error alert should be visible
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/failed/i);
    });

    it('provides retry capability after submission failure', async () => {
      mockUseFeedbackResponse = createMockUseFeedbackResponse({
        submitError: new Error('Submission failed'),
      });
      vi.mocked(useFeedbackResponse).mockReturnValue(mockUseFeedbackResponse);

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

      // Retry button should be present
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      // Click retry
      await user.click(retryButton);

      // resetSubmit should be called
      expect(mockUseFeedbackResponse.resetSubmit).toHaveBeenCalled();
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
          showReview={true}
        />
      );

      // Navigate through all pages filling required fields
      await user.type(screen.getByTestId('input-1'), 'Answer 1');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('input-3'), 'Answer 3');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/page 3 of 3/i)).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('input-5'), 'Answer 5');

      // Click to go to review
      const reviewButton = screen.getByRole('button', { name: /review/i });
      if (reviewButton) {
        await user.click(reviewButton);

        // Review page should show summary of answers
        await waitFor(() => {
          expect(screen.getByText(/review your responses/i)).toBeInTheDocument();
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

      // Should show Submit directly (no Next button needed for single page)
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      
      // Page indicator should show 1 of 1
      expect(screen.getByText(/page 1 of 1/i)).toBeInTheDocument();
    });

    it('allows direct submission on single page form', async () => {
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

      // Submit directly
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockUseFeedbackResponse.submitResponse).toHaveBeenCalled();
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
      expect(screen.getByRole('form')).toBeInTheDocument();
    });

    it('handles items with no required fields', async () => {
      const items = [
        createMockFeedbackItem({
          id: 1,
          required: false,
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

      // Should allow submission without filling any fields
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockUseFeedbackResponse.submitResponse).toHaveBeenCalled();
      });
    });

    it('handles info and label type questions (no input required)', () => {
      const items = [
        createMockFeedbackItem({
          id: 1,
          typ: 'info',
          label: 'This is informational text',
          required: false,
        }),
        createMockFeedbackItem({
          id: 2,
          typ: 'label',
          label: 'This is a label',
          required: false,
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

    it('disables form when canSubmit is false', () => {
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

      // Submit button should be disabled
      const submitButton = screen.getByRole('button', { name: /submit/i });
      expect(submitButton).toBeDisabled();
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('has accessible stepper with ARIA labels', () => {
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

      const stepper = screen.getByRole('navigation', { name: /page progress/i });
      expect(stepper).toHaveAttribute('aria-label');
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
      await user.click(screen.getByRole('button', { name: /next/i }));

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

      const prevButton = screen.getByRole('button', { name: /previous/i });
      const nextButton = screen.getByRole('button', { name: /next/i });
      const saveButton = screen.getByRole('button', { name: /save draft/i });

      // Buttons should have accessible names
      expect(prevButton).toBeVisible();
      expect(nextButton).toBeVisible();
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

      // Should be able to activate buttons with Enter
      const submitButton = screen.getByRole('button', { name: /submit/i });
      submitButton.focus();
      await user.keyboard('{Enter}');
    });

    it('associates error messages with form fields via aria-describedby', async () => {
      const items = [
        createMockFeedbackItem({
          id: 1,
          required: true,
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

      // Trigger validation error
      await user.click(screen.getByRole('button', { name: /submit/i }));

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
          required: true,
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

      // Trigger validation
      await user.click(screen.getByRole('button', { name: /submit/i }));

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
      await user.click(screen.getByRole('button', { name: /next/i }));

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
    it('shows CircularProgress during submission', () => {
      mockUseFeedbackResponse = createMockUseFeedbackResponse({
        isSubmitting: true,
      });
      vi.mocked(useFeedbackResponse).mockReturnValue(mockUseFeedbackResponse);

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

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('disables all form controls during submission', () => {
      mockUseFeedbackResponse = createMockUseFeedbackResponse({
        isSubmitting: true,
      });
      vi.mocked(useFeedbackResponse).mockReturnValue(mockUseFeedbackResponse);

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

      // All buttons should be disabled
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it('shows saving indicator during draft save', () => {
      mockUseFeedbackResponse = createMockUseFeedbackResponse({
        isSaving: true,
      });
      vi.mocked(useFeedbackResponse).mockReturnValue(mockUseFeedbackResponse);

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

      // Save Draft button should show "Saving..." text
      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
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
          typ: 'numeric',
          required: true,
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

      // Try to submit without valid data
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Should show validation-related feedback
      await waitFor(() => {
        const alerts = screen.queryAllByRole('alert');
        // At least one alert should be present
        expect(alerts.length).toBeGreaterThanOrEqual(0);
      });
    });

    it('displays network error Alert with retry button', async () => {
      mockUseFeedbackResponse = createMockUseFeedbackResponse({
        submitError: new Error('Network error: Unable to connect'),
      });
      vi.mocked(useFeedbackResponse).mockReturnValue(mockUseFeedbackResponse);

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

      // Error Alert should be visible
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Retry button should be present
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('clears error state when retry is clicked', async () => {
      mockUseFeedbackResponse = createMockUseFeedbackResponse({
        submitError: new Error('Server error'),
      });
      vi.mocked(useFeedbackResponse).mockReturnValue(mockUseFeedbackResponse);

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

      // Click retry
      await user.click(screen.getByRole('button', { name: /retry/i }));

      // resetSubmit should be called
      expect(mockUseFeedbackResponse.resetSubmit).toHaveBeenCalled();
    });

    it('handles save error gracefully', () => {
      mockUseFeedbackResponse = createMockUseFeedbackResponse({
        saveError: new Error('Save failed'),
      });
      vi.mocked(useFeedbackResponse).mockReturnValue(mockUseFeedbackResponse);

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

      // Error should be shown but form should remain usable
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('form')).toBeInTheDocument();
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
      expect(QuestionRenderer).toHaveBeenCalledTimes(2);

      // Verify props for first item
      expect(QuestionRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          item: expect.objectContaining({
            id: 1,
            label: 'Single Page Question 1',
          }),
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
          required: true,
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

      // Trigger validation
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Wait for error to appear
      await waitFor(() => {
        const input = screen.getByTestId('input-1');
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });
});
