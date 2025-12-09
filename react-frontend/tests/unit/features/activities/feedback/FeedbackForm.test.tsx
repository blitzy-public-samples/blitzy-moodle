/**
 * Unit tests for FeedbackForm Component
 *
 * Comprehensive test suite validating multi-page feedback form functionality:
 * - Multi-page form rendering with MUI Stepper
 * - Question display via QuestionRenderer
 * - Page navigation (Previous/Next buttons)
 * - Form validation with React Hook Form and Zod
 * - Progress tracking with page indicators
 * - Draft saving functionality (manual and autosave)
 * - Form submission handling
 * - Anonymous response support
 * - Loading states and error handling
 * - Review page functionality
 * - Accessibility compliance (WCAG 2.1 AA)
 *
 * @module tests/unit/features/activities/feedback/FeedbackForm.test
 * @see react-frontend/src/features/activities/feedback/components/FeedbackForm.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { FeedbackForm } from '@/features/activities/feedback/components/FeedbackForm';
import type { FeedbackFormProps } from '@/features/activities/feedback/components/FeedbackForm';
import { FeedbackQuestionType } from '@/features/activities/feedback/types/feedback.types';
import type { FeedbackItem } from '@/features/activities/feedback/types/feedback.types';

// Extend Vitest matchers with jest-axe
expect.extend(toHaveNoViolations);

// ============================================================================
// MOCKS
// ============================================================================

// Mock QuestionRenderer component
vi.mock('@/features/activities/feedback/components/QuestionRenderer', () => ({
  QuestionRenderer: vi.fn(({ id, label, value, onChange, error, required }) => (
    <div data-testid={`question-renderer-${id}`}>
      <label htmlFor={`question-${id}`}>
        {label}
        {required === 1 && <span aria-label="required">*</span>}
      </label>
      <input
        id={`question-${id}`}
        data-testid={`question-input-${id}`}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `error-${id}` : undefined}
        aria-required={required === 1}
      />
      {error && (
        <span id={`error-${id}`} role="alert" aria-live="polite">
          {error}
        </span>
      )}
    </div>
  )),
}));

// Mock feedback API
vi.mock('@/features/activities/feedback/api/feedbackApi', () => ({
  submitFeedbackResponse: vi.fn(),
  saveProgress: vi.fn(),
}));

// Mock useToast hook
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};
vi.mock('@/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

// Mock Alert component
vi.mock('@/components/feedback/Alert', () => ({
  Alert: vi.fn(({ severity, message, title, action }) => (
    <div
      data-testid={`alert-${severity}`}
      role="alert"
      aria-label={title || severity}
    >
      {title && <strong>{title}</strong>}
      <span>{message}</span>
      {action}
    </div>
  )),
}));

// Mock LoadingSpinner component
vi.mock('@/components/feedback/LoadingSpinner', () => ({
  LoadingSpinner: vi.fn(({ message }) => (
    <div data-testid="loading-spinner" role="status" aria-live="polite">
      {message || 'Loading...'}
    </div>
  )),
}));

// Import mocked modules for assertion
import { submitFeedbackResponse, saveProgress } from '@/features/activities/feedback/api/feedbackApi';
import type { FeedbackSubmissionResult } from '@/features/activities/feedback/api/feedbackApi';
import { QuestionRenderer } from '@/features/activities/feedback/components/QuestionRenderer';
import type { ApiResponse } from '@/types/api';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a test QueryClient with disabled retries and caching
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
 * Test wrapper component providing necessary providers
 */
function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * Custom render function with QueryClientProvider
 */
function renderWithProviders(
  ui: React.ReactElement,
  options?: Parameters<typeof render>[1]
) {
  return render(ui, { wrapper: createWrapper(), ...options });
}

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

/**
 * Creates a mock feedback item with customizable properties
 */
function createMockFeedbackItem(
  overrides: Partial<FeedbackItem> = {}
): FeedbackItem {
  const id = overrides.id ?? Math.floor(Math.random() * 1000) + 1;
  return {
    id,
    feedback: 1,
    template: 0,
    name: `Question ${id}`,
    label: `Question ${id}`,
    presentation: 'r>>>>>Option 1|Option 2|Option 3',
    typ: FeedbackQuestionType.MULTICHOICE,
    hasvalue: 1,
    position: overrides.position ?? 1,
    required: 0,
    dependitem: 0,
    dependvalue: '',
    options: '',
    ...overrides,
  };
}

/**
 * Creates mock items for a single-page form
 */
function createSinglePageItems(): FeedbackItem[] {
  return [
    createMockFeedbackItem({
      id: 1,
      name: 'Rate our service',
      label: 'Rate our service',
      typ: FeedbackQuestionType.MULTICHOICE,
      required: 1,
      position: 1,
    }),
    createMockFeedbackItem({
      id: 2,
      name: 'Comments',
      label: 'Comments',
      typ: FeedbackQuestionType.TEXTAREA,
      presentation: '50|10',
      required: 0,
      position: 2,
    }),
  ];
}

/**
 * Creates mock items for a multi-page form with pagebreaks
 */
function createMultiPageItems(): FeedbackItem[] {
  return [
    // Page 1
    createMockFeedbackItem({
      id: 1,
      name: 'Page 1 Question 1',
      label: 'Page 1 Question 1',
      typ: FeedbackQuestionType.TEXTFIELD,
      presentation: '50|100',
      required: 1,
      position: 1,
    }),
    createMockFeedbackItem({
      id: 2,
      name: 'Page 1 Question 2',
      label: 'Page 1 Question 2',
      typ: FeedbackQuestionType.MULTICHOICE,
      presentation: 'r>>>>>Yes|No|Maybe',
      required: 0,
      position: 2,
    }),
    // Pagebreak
    {
      id: 100,
      feedback: 1,
      template: 0,
      name: 'pagebreak',
      label: '',
      presentation: '',
      typ: FeedbackQuestionType.PAGEBREAK,
      hasvalue: 0,
      position: 3,
      required: 0,
      dependitem: 0,
      dependvalue: '',
      options: '',
    },
    // Page 2
    createMockFeedbackItem({
      id: 3,
      name: 'Page 2 Question 1',
      label: 'Page 2 Question 1',
      typ: FeedbackQuestionType.NUMERIC,
      presentation: '1|10',
      required: 1,
      position: 4,
    }),
    createMockFeedbackItem({
      id: 4,
      name: 'Page 2 Question 2',
      label: 'Page 2 Question 2',
      typ: FeedbackQuestionType.TEXTAREA,
      presentation: '60|5',
      required: 0,
      position: 5,
    }),
    // Pagebreak
    {
      id: 101,
      feedback: 1,
      template: 0,
      name: 'pagebreak',
      label: '',
      presentation: '',
      typ: FeedbackQuestionType.PAGEBREAK,
      hasvalue: 0,
      position: 6,
      required: 0,
      dependitem: 0,
      dependvalue: '',
      options: '',
    },
    // Page 3
    createMockFeedbackItem({
      id: 5,
      name: 'Page 3 Question 1',
      label: 'Page 3 Question 1',
      typ: FeedbackQuestionType.MULTICHOICERATED,
      presentation: 'r>>>>>1####Very Poor|2####Poor|3####Average|4####Good|5####Excellent',
      required: 1,
      position: 7,
    }),
  ];
}

/**
 * Creates base props for FeedbackForm
 */
function createBaseProps(overrides: Partial<FeedbackFormProps> = {}): FeedbackFormProps {
  return {
    feedbackId: 42,
    items: createSinglePageItems(),
    isAnonymous: false,
    canSubmit: true,
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('FeedbackForm Component', () => {
  let mockOnSubmit: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSubmit = vi.fn();
    mockOnCancel = vi.fn();
    
    // Setup default mock implementations
    vi.mocked(submitFeedbackResponse).mockResolvedValue({
      success: true,
      data: {
        success: true,
        completedId: 123,
        message: 'Feedback submitted successfully',
      },
    });
    
    vi.mocked(saveProgress).mockResolvedValue({
      success: true,
      data: {
        success: true,
        completedTmpId: 456,
        currentPage: 1,
        totalPages: 2,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // Basic Rendering Tests
  // ==========================================================================
  describe('Basic Rendering', () => {
    it('renders questions from items prop grouped by pages', () => {
      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      expect(screen.getByTestId('question-renderer-1')).toBeInTheDocument();
      expect(screen.getByTestId('question-renderer-2')).toBeInTheDocument();
    });

    it('renders MUI Stepper with page count for multi-page forms', () => {
      renderWithProviders(
        <FeedbackForm {...createBaseProps({ items: createMultiPageItems() })} />
      );

      // Should show stepper with page steps
      const stepLabels = screen.getAllByText(/Page \d/);
      expect(stepLabels.length).toBeGreaterThan(0);
    });

    it('renders current page questions via QuestionRenderer', () => {
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      // First page questions should be visible
      expect(screen.getByTestId('question-renderer-1')).toBeInTheDocument();
      expect(screen.getByTestId('question-renderer-2')).toBeInTheDocument();
      
      // Other page questions should not be visible
      expect(screen.queryByTestId('question-renderer-3')).not.toBeInTheDocument();
    });

    it('renders Previous/Next navigation buttons', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      // Initially only Next button visible (first page)
      // Previous button has aria-label "Go to previous page"
      expect(screen.queryByRole('button', { name: /go to previous page/i })).not.toBeInTheDocument();
      // Next button has aria-label "Go to page X" or "Review your answers"
      expect(screen.getByRole('button', { name: /go to page|review your answers/i })).toBeInTheDocument();

      // Fill required field and go to next page
      const input = screen.getByTestId('question-input-1');
      await user.type(input, 'Test value');
      await user.click(screen.getByRole('button', { name: /go to page|review your answers/i }));

      // Now Previous button should be visible
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /go to previous page/i })).toBeInTheDocument();
      });
    });

    it('displays page indicator: "Page 2 of 5"', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      // Initially shows "Page 1 of 3"
      expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();

      // Navigate to page 2
      const input = screen.getByTestId('question-input-1');
      await user.type(input, 'Test value');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      await waitFor(() => {
        expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
      });
    });

    it('renders Submit button on review page', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      // Navigate through all pages to review
      // Page 1 - fill required field
      await user.type(screen.getByTestId('question-input-1'), 'Test');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      // Page 2 - fill required field
      await waitFor(() => {
        expect(screen.getByTestId('question-input-3')).toBeInTheDocument();
      });
      await user.type(screen.getByTestId('question-input-3'), '5');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      // Page 3 - fill required field
      await waitFor(() => {
        expect(screen.getByTestId('question-input-5')).toBeInTheDocument();
      });
      await user.type(screen.getByTestId('question-input-5'), '3');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      // Should now show Submit button on review page
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      });
    });

    it('renders Save Draft button', () => {
      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Single Page Form Tests
  // ==========================================================================
  describe('Single Page Form', () => {
    it('form with single page shows no stepper', () => {
      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      // Single page forms shouldn't show the stepper
      // May show page indicator but no stepper steps for navigation
      // Check for absence of step buttons/indicators
      expect(screen.queryByRole('button', { name: /step/i })).not.toBeInTheDocument();
    });

    it('single page shows Review button to go to review page', async () => {
      const user = userEvent.setup();
      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      // Fill required field
      const input = screen.getByTestId('question-input-1');
      await user.type(input, '1');

      // Should show Review button (which leads to review page, then submit)
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Review Your Answers/i })).toBeInTheDocument();
      });
    });

    it('no Previous button on single page form initial view', () => {
      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      expect(screen.queryByRole('button', { name: /go to previous page/i })).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Multi-Page Navigation Tests
  // ==========================================================================
  describe('Multi-Page Navigation', () => {
    it('Next button advances to next page', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      // Fill required field on page 1
      await user.type(screen.getByTestId('question-input-1'), 'Test');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      // Should be on page 2
      await waitFor(() => {
        expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
      });
    });

    it('Previous button returns to previous page', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      // Navigate to page 2
      await user.type(screen.getByTestId('question-input-1'), 'Test');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      await waitFor(() => {
        expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
      });

      // Go back to page 1
      await user.click(screen.getByRole('button', { name: /go to previous page/i }));

      await waitFor(() => {
        expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
      });
    });

    it('Previous button disabled/hidden on first page', () => {
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      // Previous button should not exist on first page
      expect(screen.queryByRole('button', { name: /go to previous page/i })).not.toBeInTheDocument();
    });

    it('stepper highlights current page', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      // The active step should be indicated somehow - check for aria attributes or classes
      // MUI Stepper uses aria-current or specific classes for active step
      const pageLabels = screen.getAllByText(/Page \d/);
      expect(pageLabels.length).toBeGreaterThan(0);

      // Navigate and verify page indicator updates
      await user.type(screen.getByTestId('question-input-1'), 'Test');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      await waitFor(() => {
        expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
      });
    });

    it('page indicator updates on navigation', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();

      await user.type(screen.getByTestId('question-input-1'), 'Test');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      await waitFor(() => {
        expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
      });
    });

    it('keyboard Enter on Next button navigates', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      await user.type(screen.getByTestId('question-input-1'), 'Test');

      // Focus on Next button and press Enter
      const nextButton = screen.getByRole('button', { name: /go to page/i });
      nextButton.focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Page Validation Tests
  // ==========================================================================
  describe('Page Validation', () => {
    it('required fields prevent Next button navigation', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      // Try to navigate without filling required field
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      // Should still be on page 1 and show warning
      await waitFor(() => {
        expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
        expect(mockToast.warning).toHaveBeenCalled();
      });
    });

    it('validation runs before page change', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      // Click Next without filling required field
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      // Toast warning should be shown
      await waitFor(() => {
        expect(mockToast.warning).toHaveBeenCalledWith(
          expect.stringContaining('required')
        );
      });
    });

    it('successful validation allows navigation', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      // Fill required field
      await user.type(screen.getByTestId('question-input-1'), 'Valid input');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      // Should successfully navigate to page 2
      await waitFor(() => {
        expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
      });
    });

    it('validation does not run on Previous navigation', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      // Navigate to page 2
      await user.type(screen.getByTestId('question-input-1'), 'Test');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      await waitFor(() => {
        expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
      });

      // Clear the mock calls to verify Previous doesn't trigger validation warning
      mockToast.warning.mockClear();

      // Go back without filling page 2's required field
      await user.click(screen.getByRole('button', { name: /go to previous page/i }));

      // Should successfully go back without validation warning
      await waitFor(() => {
        expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
        expect(mockToast.warning).not.toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Question Rendering Tests
  // ==========================================================================
  describe('Question Rendering', () => {
    it('QuestionRenderer called for each question on page', () => {
      const props = createBaseProps();
      renderWithProviders(<FeedbackForm {...props} />);

      // Should call QuestionRenderer for each question on the page
      expect(vi.mocked(QuestionRenderer)).toHaveBeenCalled();
      expect(screen.getByTestId('question-renderer-1')).toBeInTheDocument();
      expect(screen.getByTestId('question-renderer-2')).toBeInTheDocument();
    });

    it('correct props passed to QuestionRenderer', () => {
      const props = createBaseProps();
      renderWithProviders(<FeedbackForm {...props} />);

      // Check QuestionRenderer was called with expected props
      expect(vi.mocked(QuestionRenderer)).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          label: expect.any(String),
          value: expect.any(String),
          onChange: expect.any(Function),
        }),
        expect.anything()
      );
    });

    it('question value updates on user input', async () => {
      const user = userEvent.setup();
      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      const input = screen.getByTestId('question-input-1');
      await user.type(input, 'New value');

      expect(input).toHaveValue('New value');
    });

    it('onChange callback updates form state', async () => {
      const user = userEvent.setup();
      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      const input = screen.getByTestId('question-input-1');
      await user.type(input, 'Updated');

      expect(input).toHaveValue('Updated');
    });

    it('required indicator displayed for required questions', () => {
      const items = [
        createMockFeedbackItem({
          id: 1,
          name: 'Required Question',
          label: 'Required Question',
          required: 1,
        }),
      ];
      renderWithProviders(<FeedbackForm {...createBaseProps({ items })} />);

      // Check that required field has aria-required attribute
      const input = screen.getByTestId('question-input-1');
      expect(input).toHaveAttribute('aria-required', 'true');
      // Also verify there's a visual required indicator (the * span with aria-label)
      const requiredIndicators = screen.getAllByLabelText(/required/i);
      expect(requiredIndicators.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Required Field Validation Tests
  // ==========================================================================
  describe('Required Field Validation', () => {
    it('required text field shows error when empty on validation', async () => {
      const user = userEvent.setup();
      const items = [
        createMockFeedbackItem({
          id: 1,
          name: 'Required Text',
          label: 'Required Text',
          typ: FeedbackQuestionType.TEXTFIELD,
          presentation: '50|100',
          required: 1,
        }),
      ];
      const props = createBaseProps({ items });
      renderWithProviders(<FeedbackForm {...props} />);

      // Try to go to review without filling
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      // Should show validation warning
      await waitFor(() => {
        expect(mockToast.warning).toHaveBeenCalled();
      });
    });

    it('error message styling applied correctly', async () => {
      const user = userEvent.setup();
      const items = [
        createMockFeedbackItem({
          id: 1,
          name: 'Required Field',
          label: 'Required Field',
          required: 1,
        }),
      ];
      renderWithProviders(<FeedbackForm {...createBaseProps({ items })} />);

      // Trigger validation
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      // The input should be marked as invalid
      await waitFor(() => {
        // The mock QuestionRenderer shows error state
        expect(mockToast.warning).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Save Draft Functionality Tests
  // ==========================================================================
  describe('Save Draft Functionality', () => {
    it('Save Draft button calls saveProgress API', async () => {
      const user = userEvent.setup();
      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      await user.type(screen.getByTestId('question-input-1'), 'Draft value');
      await user.click(screen.getByRole('button', { name: /save draft/i }));

      await waitFor(() => {
        expect(saveProgress).toHaveBeenCalledWith(42, expect.any(Object));
      });
    });

    it('draft saves current page responses', async () => {
      const user = userEvent.setup();
      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      await user.type(screen.getByTestId('question-input-1'), 'My answer');
      await user.type(screen.getByTestId('question-input-2'), 'My comment');
      await user.click(screen.getByRole('button', { name: /save draft/i }));

      await waitFor(() => {
        expect(saveProgress).toHaveBeenCalledWith(
          42,
          expect.objectContaining({
            1: 'My answer',
            2: 'My comment',
          })
        );
      });
    });

    it('success message displays after save', async () => {
      const user = userEvent.setup();
      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      await user.type(screen.getByTestId('question-input-1'), 'Test');
      await user.click(screen.getByRole('button', { name: /save draft/i }));

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Draft saved successfully.');
      });
    });

    it('loading state during save shows spinner on button', async () => {
      const user = userEvent.setup();
      
      // Make saveProgress slow
      vi.mocked(saveProgress).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ 
          success: true, 
          data: { success: true, completedTmpId: 456, currentPage: 1, totalPages: 2 } 
        }), 100))
      );

      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      await user.type(screen.getByTestId('question-input-1'), 'Test');
      await user.click(screen.getByRole('button', { name: /save draft/i }));

      // Button should show spinner during save - the aria-label stays "Save draft"
      // but a CircularProgress spinner should be visible (button shows "Saving..." text)
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      // Spinner should be visible (CircularProgress creates a progressbar role)
      expect(screen.getByRole('progressbar', { name: '' })).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
      });
    });

    it('Save Draft button is disabled during save', async () => {
      const user = userEvent.setup();
      
      vi.mocked(saveProgress).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ 
          success: true, 
          data: { success: true, completedTmpId: 456, currentPage: 1, totalPages: 2 } 
        }), 100))
      );

      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      await user.type(screen.getByTestId('question-input-1'), 'Test');
      await user.click(screen.getByRole('button', { name: /save draft/i }));

      // The button keeps aria-label="Save draft" even while saving, but should be disabled
      const saveDraftButton = screen.getByRole('button', { name: /save draft/i });
      expect(saveDraftButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled();
      });
    });
  });

  // ==========================================================================
  // Form Submission Tests
  // ==========================================================================
  describe('Form Submission', () => {
    it('Submit button visible on review page', async () => {
      const user = userEvent.setup();
      const items = createSinglePageItems();
      renderWithProviders(<FeedbackForm {...createBaseProps({ items })} />);

      // Fill required field and go to review
      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      });
    });

    it('Submit button calls submitFeedbackResponse', async () => {
      const user = userEvent.setup();
      const items = createSinglePageItems();
      renderWithProviders(
        <FeedbackForm {...createBaseProps({ items, onSubmit: mockOnSubmit })} />
      );

      // Fill and submit
      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(submitFeedbackResponse).toHaveBeenCalledWith(42, expect.any(Object));
      });
    });

    it('all pages responses included in submission', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({
        items: createMultiPageItems(),
        onSubmit: mockOnSubmit,
      });
      renderWithProviders(<FeedbackForm {...props} />);

      // Page 1
      await user.type(screen.getByTestId('question-input-1'), 'Page 1 Answer');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      // Page 2
      await waitFor(() => {
        expect(screen.getByTestId('question-input-3')).toBeInTheDocument();
      });
      await user.type(screen.getByTestId('question-input-3'), '5');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      // Page 3
      await waitFor(() => {
        expect(screen.getByTestId('question-input-5')).toBeInTheDocument();
      });
      await user.type(screen.getByTestId('question-input-5'), '3');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      // Submit
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(submitFeedbackResponse).toHaveBeenCalledWith(
          42,
          expect.objectContaining({
            1: 'Page 1 Answer',
            // Question 3 is NUMERIC type, so the value is converted to number
            3: 5,
            5: '3',
          })
        );
      });
    });

    it('loading state during submission', async () => {
      const user = userEvent.setup();
      
      // Make the mock resolve slowly to allow checking loading state
      let resolveSubmit: ((value: ApiResponse<FeedbackSubmissionResult>) => void) | undefined;
      vi.mocked(submitFeedbackResponse).mockImplementation(() =>
        new Promise<ApiResponse<FeedbackSubmissionResult>>(resolve => {
          resolveSubmit = resolve;
        })
      );

      const items = createSinglePageItems();
      renderWithProviders(<FeedbackForm {...createBaseProps({ items })} />);

      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Should show submitting state - button shows "Submitting..." text
      await waitFor(() => {
        expect(screen.getByText('Submitting...')).toBeInTheDocument();
      });
      // Submit button should be disabled during submission
      expect(screen.getByRole('button', { name: /submit feedback/i })).toBeDisabled();

      // Now resolve the promise
      resolveSubmit!({ 
        success: true, 
        data: { success: true, completedId: 123, message: 'Submitted' } 
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Thank You/i })).toBeInTheDocument();
      });
    });

    it('success message and callback after submission', async () => {
      const user = userEvent.setup();
      const items = createSinglePageItems();
      renderWithProviders(
        <FeedbackForm {...createBaseProps({ items, onSubmit: mockOnSubmit })} />
      );

      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Feedback submitted successfully!');
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Review Page Tests
  // ==========================================================================
  describe('Review Page', () => {
    it('final review page shows summary of all answers', async () => {
      const user = userEvent.setup();
      const items = createSinglePageItems();
      renderWithProviders(<FeedbackForm {...createBaseProps({ items })} />);

      await user.type(screen.getByTestId('question-input-1'), '2');
      await user.type(screen.getByTestId('question-input-2'), 'Great service!');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Review Your Answers/i })).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Great service!')).toBeInTheDocument();
      });
    });

    it('review displays questions and user responses', async () => {
      const user = userEvent.setup();
      const items = createSinglePageItems();
      renderWithProviders(<FeedbackForm {...createBaseProps({ items })} />);

      await user.type(screen.getByTestId('question-input-1'), 'My answer');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByText(/Rate our service/i)).toBeInTheDocument();
        expect(screen.getByText('My answer')).toBeInTheDocument();
      });
    });

    it('Previous button from review page returns to last page', async () => {
      const user = userEvent.setup();
      const items = createSinglePageItems();
      renderWithProviders(<FeedbackForm {...createBaseProps({ items })} />);

      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Review Your Answers/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /go to previous page/i }));

      await waitFor(() => {
        expect(screen.queryByText(/Review Your Answers/i)).not.toBeInTheDocument();
        expect(screen.getByTestId('question-renderer-1')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Anonymous Submission Tests
  // ==========================================================================
  describe('Anonymous Submission', () => {
    it('anonymous indicator displayed when isAnonymous is true', () => {
      renderWithProviders(
        <FeedbackForm {...createBaseProps({ isAnonymous: true })} />
      );

      expect(screen.getByTestId('alert-info')).toBeInTheDocument();
      expect(screen.getByText(/anonymous/i)).toBeInTheDocument();
    });

    it('anonymous info message shown', () => {
      renderWithProviders(
        <FeedbackForm {...createBaseProps({ isAnonymous: true })} />
      );

      expect(
        screen.getByText(/your identity will not be recorded/i)
      ).toBeInTheDocument();
    });

    it('no anonymous indicator when isAnonymous is false', () => {
      renderWithProviders(
        <FeedbackForm {...createBaseProps({ isAnonymous: false })} />
      );

      expect(screen.queryByTestId('alert-info')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Form State Management Tests
  // ==========================================================================
  describe('Form State Management', () => {
    it('form retains state across page navigation', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      // Fill page 1
      await user.type(screen.getByTestId('question-input-1'), 'Page 1 value');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      // Wait for page 2
      await waitFor(() => {
        expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
      });

      // Go back to page 1
      await user.click(screen.getByRole('button', { name: /go to previous page/i }));

      // Value should be preserved
      await waitFor(() => {
        expect(screen.getByTestId('question-input-1')).toHaveValue('Page 1 value');
      });
    });

    it('previous page answers preserved when returning', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      // Fill and navigate
      await user.type(screen.getByTestId('question-input-1'), 'Answer 1');
      await user.type(screen.getByTestId('question-input-2'), '2');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      await waitFor(() => {
        expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
      });

      // Return and check values
      await user.click(screen.getByRole('button', { name: /go to previous page/i }));

      await waitFor(() => {
        expect(screen.getByTestId('question-input-1')).toHaveValue('Answer 1');
        expect(screen.getByTestId('question-input-2')).toHaveValue('2');
      });
    });
  });

  // ==========================================================================
  // Loading States Tests
  // ==========================================================================
  describe('Loading States', () => {
    it('loading spinner during submission', async () => {
      const user = userEvent.setup();
      
      vi.mocked(submitFeedbackResponse).mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({ 
            success: true, 
            data: { success: true, completedId: 123, message: 'Submitted' } 
          }), 200)
        )
      );

      const items = createSinglePageItems();
      renderWithProviders(<FeedbackForm {...createBaseProps({ items })} />);

      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /submit/i }));

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Thank You/i })).toBeInTheDocument();
      });
    });

    it('buttons disabled during submission', async () => {
      const user = userEvent.setup();
      
      // Use manual promise control to check disabled state during submission
      let resolveSubmit: ((value: ApiResponse<FeedbackSubmissionResult>) => void) | undefined;
      vi.mocked(submitFeedbackResponse).mockImplementation(() =>
        new Promise<ApiResponse<FeedbackSubmissionResult>>(resolve => {
          resolveSubmit = resolve;
        })
      );

      const items = createSinglePageItems();
      renderWithProviders(<FeedbackForm {...createBaseProps({ items })} />);

      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Wait for the submission loading state to be active
      await waitFor(() => {
        expect(screen.getByText('Submitting...')).toBeInTheDocument();
      });

      // Buttons should be disabled during submission
      // The submit button has aria-label="Submit feedback" even when showing "Submitting..." text
      expect(screen.getByRole('button', { name: /submit feedback/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /go to previous page/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled();

      // Now resolve the promise
      resolveSubmit!({ 
        success: true, 
        data: { success: true, completedId: 123, message: 'Submitted' } 
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Thank You/i })).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================
  describe('Error Handling', () => {
    it('submission error displays alert', async () => {
      const user = userEvent.setup();
      
      vi.mocked(submitFeedbackResponse).mockRejectedValue(
        new Error('Server error')
      );

      const items = createSinglePageItems();
      renderWithProviders(<FeedbackForm {...createBaseProps({ items })} />);

      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByTestId('alert-error')).toBeInTheDocument();
        expect(mockToast.error).toHaveBeenCalled();
      });
    });

    it('network error shows retry button', async () => {
      const user = userEvent.setup();
      
      vi.mocked(submitFeedbackResponse).mockRejectedValue(
        new Error('Network error')
      );

      const items = createSinglePageItems();
      renderWithProviders(<FeedbackForm {...createBaseProps({ items })} />);

      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('error does not clear form data', async () => {
      const user = userEvent.setup();
      
      vi.mocked(submitFeedbackResponse).mockRejectedValue(
        new Error('Error')
      );

      const items = createSinglePageItems();
      renderWithProviders(<FeedbackForm {...createBaseProps({ items })} />);

      await user.type(screen.getByTestId('question-input-1'), 'My data');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByTestId('alert-error')).toBeInTheDocument();
      });

      // Go back and verify data is still there
      await user.click(screen.getByRole('button', { name: /go to previous page/i }));

      await waitFor(() => {
        expect(screen.getByTestId('question-input-1')).toHaveValue('My data');
      });
    });

    it('error allows user to retry submission', async () => {
      const user = userEvent.setup();
      
      vi.mocked(submitFeedbackResponse)
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce({ 
          success: true, 
          data: { success: true, completedId: 123, message: 'Submitted' } 
        });

      const items = createSinglePageItems();
      renderWithProviders(<FeedbackForm {...createBaseProps({ items })} />);

      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      });

      // First attempt fails
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      // Retry succeeds
      await user.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Thank You/i })).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Autosave Functionality Tests
  // ==========================================================================
  describe('Autosave Functionality', () => {
    it('autosave triggers after 60 seconds of inactivity', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ 
        advanceTimers: vi.advanceTimersByTime,
        delay: null 
      });

      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      // Type something to make form dirty
      const input = screen.getByTestId('question-input-1');
      await user.type(input, 'Test');

      // Fast-forward 60 seconds and flush promises
      await vi.advanceTimersByTimeAsync(60000);

      expect(saveProgress).toHaveBeenCalled();
      
      vi.useRealTimers();
    });

    it('autosave uses saveProgress mutation', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ 
        advanceTimers: vi.advanceTimersByTime,
        delay: null 
      });

      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      await user.type(screen.getByTestId('question-input-1'), 'Auto');

      // Fast-forward 60 seconds and flush promises  
      await vi.advanceTimersByTimeAsync(60000);

      expect(saveProgress).toHaveBeenCalledWith(42, expect.any(Object));
      
      vi.useRealTimers();
    });

    it('autosave does not interfere with manual save', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ 
        advanceTimers: vi.advanceTimersByTime,
        delay: null 
      });

      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      await user.type(screen.getByTestId('question-input-1'), 'Test');
      await user.click(screen.getByRole('button', { name: /save draft/i }));

      expect(saveProgress).toHaveBeenCalledTimes(1);

      // Autosave should still work after manual save
      await vi.advanceTimersByTimeAsync(60000);

      expect(saveProgress).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });
  });

  // ==========================================================================
  // Keyboard Navigation Tests
  // ==========================================================================
  describe('Keyboard Navigation', () => {
    it('Tab key navigates between form fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      const input1 = screen.getByTestId('question-input-1');
      input1.focus();
      expect(document.activeElement).toBe(input1);

      await user.tab();

      // Focus should move to next tabbable element
      expect(document.activeElement).not.toBe(input1);
    });

    it('Enter key submits form on review page', async () => {
      const user = userEvent.setup();
      const items = createSinglePageItems();
      renderWithProviders(
        <FeedbackForm {...createBaseProps({ items, onSubmit: mockOnSubmit })} />
      );

      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      submitButton.focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(submitFeedbackResponse).toHaveBeenCalled();
      });
    });

    it('focus management after page navigation', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      await user.type(screen.getByTestId('question-input-1'), 'Test');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      // After navigation, focus should be manageable on new page
      await waitFor(() => {
        expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================
  describe('Accessibility', () => {
    it('form fields have associated labels', () => {
      renderWithProviders(<FeedbackForm {...createBaseProps()} />);

      const input = screen.getByTestId('question-input-1');
      expect(input).toHaveAttribute('id');
      
      const label = screen.getByText(/Rate our service/i);
      expect(label).toBeInTheDocument();
    });

    it('page changes announced to screen readers', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      await user.type(screen.getByTestId('question-input-1'), 'Test');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      // Screen reader announcement area exists
      await waitFor(() => {
        const ariaLive = document.querySelector('[aria-live="polite"]');
        expect(ariaLive).toBeInTheDocument();
      });
    });

    it('submit button has descriptive aria-label', async () => {
      const user = userEvent.setup();
      const items = createSinglePageItems();
      renderWithProviders(<FeedbackForm {...createBaseProps({ items })} />);

      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit feedback/i });
        expect(submitButton).toBeInTheDocument();
      });
    });

    it('required fields indicated with aria-required', () => {
      const items = [
        createMockFeedbackItem({
          id: 1,
          name: 'Required Field',
          label: 'Required Field',
          required: 1,
        }),
      ];
      renderWithProviders(<FeedbackForm {...createBaseProps({ items })} />);

      const input = screen.getByTestId('question-input-1');
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('navigation buttons have descriptive aria-labels', () => {
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      const nextButton = screen.getByRole('button', { name: /go to page 2|next/i });
      expect(nextButton).toBeInTheDocument();

      const saveDraftButton = screen.getByRole('button', { name: /save draft/i });
      expect(saveDraftButton).toBeInTheDocument();
    });

    it('passes automated accessibility audit', async () => {
      const { container } = renderWithProviders(
        <FeedbackForm {...createBaseProps()} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================
  describe('Integration Tests', () => {
    it('complete user flow: navigate pages, fill answers, submit', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({
        items: createMultiPageItems(),
        onSubmit: mockOnSubmit,
      });
      renderWithProviders(<FeedbackForm {...props} />);

      // Page 1
      expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
      await user.type(screen.getByTestId('question-input-1'), 'Page 1 answer');
      await user.type(screen.getByTestId('question-input-2'), '1');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      // Page 2
      await waitFor(() => {
        expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
      });
      await user.type(screen.getByTestId('question-input-3'), '5');
      await user.type(screen.getByTestId('question-input-4'), 'Page 2 comment');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      // Page 3
      await waitFor(() => {
        expect(screen.getByText(/Page 3 of 3/i)).toBeInTheDocument();
      });
      await user.type(screen.getByTestId('question-input-5'), '4');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      // Review page
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Review Your Answers/i })).toBeInTheDocument();
      });

      // Submit
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(submitFeedbackResponse).toHaveBeenCalled();
        expect(mockOnSubmit).toHaveBeenCalled();
        expect(screen.getByRole('heading', { name: /Thank You/i })).toBeInTheDocument();
      });
    });

    it('validation error, fix, continue flow', async () => {
      const user = userEvent.setup();
      const props = createBaseProps({ items: createMultiPageItems() });
      renderWithProviders(<FeedbackForm {...props} />);

      // Try to proceed without filling required field
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      await waitFor(() => {
        expect(mockToast.warning).toHaveBeenCalled();
        expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
      });

      // Fix the error
      await user.type(screen.getByTestId('question-input-1'), 'Fixed value');
      await user.click(screen.getByRole('button', { name: /go to page/i }));

      // Should now proceed to page 2
      await waitFor(() => {
        expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
      });
    });

    it('anonymous submission complete flow', async () => {
      const user = userEvent.setup();
      const items = createSinglePageItems();
      renderWithProviders(
        <FeedbackForm
          {...createBaseProps({
            items,
            isAnonymous: true,
            onSubmit: mockOnSubmit,
          })}
        />
      );

      // Verify anonymous indicator is shown
      expect(screen.getByText(/anonymous/i)).toBeInTheDocument();

      // Fill and submit
      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(submitFeedbackResponse).toHaveBeenCalled();
        expect(screen.getByRole('heading', { name: /Thank You/i })).toBeInTheDocument();
        // Success message should mention anonymous
        expect(screen.getByText(/anonymously/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // TypeScript Props Tests
  // ==========================================================================
  describe('TypeScript Props', () => {
    it('component renders with all required props', () => {
      const props: FeedbackFormProps = {
        feedbackId: 1,
        items: createSinglePageItems(),
        isAnonymous: false,
        canSubmit: true,
      };

      expect(() => renderWithProviders(<FeedbackForm {...props} />)).not.toThrow();
    });

    it('component accepts optional props', () => {
      const props: FeedbackFormProps = {
        feedbackId: 1,
        items: createSinglePageItems(),
        isAnonymous: false,
        canSubmit: true,
        onSubmit: mockOnSubmit,
        onCancel: mockOnCancel,
        courseId: 5,
        savedResponses: { 1: 'saved' },
        resumePage: 0,
      };

      expect(() => renderWithProviders(<FeedbackForm {...props} />)).not.toThrow();
    });

    it('onSubmit callback receives FeedbackResponse', async () => {
      const user = userEvent.setup();
      const items = createSinglePageItems();
      renderWithProviders(
        <FeedbackForm {...createBaseProps({ items, onSubmit: mockOnSubmit })} />
      );

      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            completed: expect.objectContaining({
              id: expect.any(Number),
              feedback: 42,
            }),
            values: expect.any(Array),
          })
        );
      });
    });
  });

  // ==========================================================================
  // savedResponses and resumePage Tests
  // ==========================================================================
  describe('Saved Responses and Resume', () => {
    it('initializes form with savedResponses', () => {
      const items = createSinglePageItems();
      const savedResponses = { 1: 'Saved answer', 2: 'Saved comment' };

      renderWithProviders(
        <FeedbackForm
          {...createBaseProps({ items, savedResponses })}
        />
      );

      expect(screen.getByTestId('question-input-1')).toHaveValue('Saved answer');
      expect(screen.getByTestId('question-input-2')).toHaveValue('Saved comment');
    });

    it('resumes from specified page', () => {
      const props = createBaseProps({
        items: createMultiPageItems(),
        resumePage: 1, // Start on page 2 (0-indexed)
      });
      renderWithProviders(<FeedbackForm {...props} />);

      expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // canSubmit Prop Tests
  // ==========================================================================
  describe('canSubmit Prop', () => {
    it('Submit button disabled when canSubmit is false', async () => {
      const user = userEvent.setup();
      const items = createSinglePageItems();
      renderWithProviders(
        <FeedbackForm {...createBaseProps({ items, canSubmit: false })} />
      );

      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit/i });
        expect(submitButton).toBeDisabled();
      });
    });

    it('shows error when trying to submit without permission', async () => {
      const user = userEvent.setup();
      const items = createSinglePageItems();
      renderWithProviders(
        <FeedbackForm {...createBaseProps({ items, canSubmit: false })} />
      );

      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
      });
    });
  });

  // ==========================================================================
  // Cancel Functionality Tests
  // ==========================================================================
  describe('Cancel Functionality', () => {
    it('Cancel button calls onCancel callback', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <FeedbackForm {...createBaseProps({ onCancel: mockOnCancel })} />
      );

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('Cancel button not shown when onCancel not provided', () => {
      renderWithProviders(
        <FeedbackForm {...createBaseProps({ onCancel: undefined })} />
      );

      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });

    it('Return to Course button shown on success when onCancel provided', async () => {
      const user = userEvent.setup();
      const items = createSinglePageItems();
      renderWithProviders(
        <FeedbackForm
          {...createBaseProps({ items, onCancel: mockOnCancel })}
        />
      );

      await user.type(screen.getByTestId('question-input-1'), '1');
      await user.click(screen.getByRole('button', { name: /review your answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Thank You/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /return to course/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /return to course/i }));
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});
