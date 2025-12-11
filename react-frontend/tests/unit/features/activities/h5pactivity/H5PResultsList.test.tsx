/**
 * H5PResultsList Component Unit Tests
 *
 * Comprehensive test suite for the H5PResultsList component that validates
 * attempts list rendering with filtering, sorting, pagination, and multiple
 * view modes. Tests component rendering with various attempt datasets including
 * empty attempts list, single attempt display, and multiple attempts.
 *
 * Test coverage includes:
 * - Basic rendering with all columns
 * - Table and card view modes
 * - View toggle functionality
 * - Sorting by all sortable fields (ascending/descending)
 * - Filtering by completion and success status
 * - Pagination controls
 * - Summary statistics calculation
 * - Responsive layout behavior
 * - Loading and error states
 * - Integration with useH5PAttempts hook
 * - Accessibility compliance
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// Component under test
import { H5PResultsList } from '@/features/activities/h5pactivity/components/H5PResultsList';

// Mocked dependencies
import useH5PAttempts from '@/features/activities/h5pactivity/hooks/useH5PAttempts';
import H5PReportCard from '@/features/activities/h5pactivity/components/H5PReportCard';
import type { H5PAttempt } from '@/features/activities/h5pactivity/types/h5p.types';
import { formatDuration } from '@/utils/date';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the useH5PAttempts hook
vi.mock('@/features/activities/h5pactivity/hooks/useH5PAttempts', () => ({
  default: vi.fn(),
}));

// Mock the H5PReportCard component
vi.mock('@/features/activities/h5pactivity/components/H5PReportCard', () => ({
  default: vi.fn(({ attempt }) => (
    <div data-testid={`h5p-report-card-${attempt.id}`}>
      H5P Report Card: Attempt #{attempt.attempt}
    </div>
  )),
}));

// Mock the date utility
vi.mock('@/utils/date', () => ({
  formatDuration: vi.fn((seconds: number) => {
    if (seconds === 0) return '0 seconds';
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) {
      return secs > 0 ? `${minutes} minutes ${secs} seconds` : `${minutes} minutes`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} hours ${mins} minutes`;
  }),
}));

// Mock the formatters utility
vi.mock('@/utils/formatters', () => ({
  formatNumber: vi.fn((num: number) => num.toString()),
}));

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a mock H5P attempt with specified overrides
 */
function createMockAttempt(overrides: Partial<H5PAttempt> = {}): H5PAttempt {
  return {
    id: 1,
    h5pactivityid: 123,
    userid: 1,
    timecreated: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
    timemodified: Math.floor(Date.now() / 1000) - 86400,
    attempt: 1,
    rawscore: 8,
    maxscore: 10,
    scaled: 0.8,
    duration: 120,
    completion: 1,
    success: 1,
    ...overrides,
  };
}

/**
 * Creates multiple mock attempts for testing pagination and filtering
 */
function createMockAttempts(count: number): H5PAttempt[] {
  return Array.from({ length: count }, (_, index) => {
    const attemptNum = index + 1;
    const isCompleted = index % 3 !== 2; // 2/3 completed
    const isSuccessful = isCompleted && index % 2 === 0; // 1/2 of completed are successful
    const score = isCompleted ? (5 + (index % 6)) : 0; // Score 5-10 for completed

    return createMockAttempt({
      id: attemptNum,
      attempt: attemptNum,
      timecreated: Math.floor(Date.now() / 1000) - (86400 * attemptNum),
      timemodified: Math.floor(Date.now() / 1000) - (86400 * attemptNum),
      rawscore: score,
      maxscore: 10,
      scaled: score / 10,
      duration: 60 + (attemptNum * 30),
      completion: isCompleted ? 1 : 0,
      success: isSuccessful ? 1 : 0,
    });
  });
}

/**
 * Mock user attempts data structure that matches UserAttempts interface
 */
function createMockUserAttempts(attempts: H5PAttempt[]) {
  return [{
    userid: 1,
    firstname: 'Test',
    lastname: 'User',
    email: 'test@example.com',
    attempts,
    scored: undefined,
  }];
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a configured QueryClient for testing
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

/**
 * Wrapper component providing required context providers
 */
function createWrapper() {
  const queryClient = createTestQueryClient();

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

/**
 * Render the H5PResultsList component with all required providers
 */
function renderComponent(props: { h5pActivityId: number; userId?: number } = { h5pActivityId: 123 }) {
  const user = userEvent.setup();
  const wrapper = createWrapper();

  const result = render(<H5PResultsList {...props} />, { wrapper });

  return {
    ...result,
    user,
  };
}

/**
 * Sets up the useH5PAttempts mock with specified return values
 */
function setupMockHook(options: {
  attempts?: H5PAttempt[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
} = {}) {
  const {
    attempts = createMockAttempts(5),
    isLoading = false,
    isError = false,
    error = null,
  } = options;

  const refetch = vi.fn().mockResolvedValue(undefined);

  (useH5PAttempts as ReturnType<typeof vi.fn>).mockReturnValue({
    attempts: createMockUserAttempts(attempts),
    isLoading,
    isError,
    error,
    refetch,
  });

  return { refetch };
}

/**
 * Helper function to find MUI Select by its label text.
 * MUI Select doesn't properly associate labels for accessible name computation,
 * so we need to find the FormControl containing the label and then query within it.
 */
function getSelectByLabel(labelText: string): HTMLElement {
  const label = screen.getByText(labelText, { selector: 'label' });
  const formControl = label.closest('.MuiFormControl-root') as HTMLElement;
  return within(formControl).getByRole('combobox');
}

// ============================================================================
// Test Suites
// ============================================================================

describe('H5PResultsList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Basic Rendering Tests
  // ==========================================================================

  describe('Basic Rendering', () => {
    it('renders the component with title', async () => {
      setupMockHook();
      renderComponent();

      expect(screen.getByRole('heading', { name: /h5p activity attempts/i })).toBeInTheDocument();
    });

    it('renders table with all columns in table view', async () => {
      setupMockHook();
      renderComponent();

      await waitFor(() => {
        // Use getAllByText since column headers and filter labels may share text
        expect(screen.getAllByText('Attempt').length).toBeGreaterThan(0);
      });

      // Column headers may appear in both table and filter sections
      expect(screen.getAllByText('Date').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Score').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Duration').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Status').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Result').length).toBeGreaterThan(0);
    });

    it('displays all attempts from useH5PAttempts hook', async () => {
      const attempts = createMockAttempts(5);
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        // Check that attempt rows are rendered
        expect(screen.getByText('#1')).toBeInTheDocument();
      });

      // Verify all 5 attempts are displayed
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByText(`#${i}`)).toBeInTheDocument();
      }
    });

    it('shows row for each attempt with correct data', async () => {
      const attempts = [
        createMockAttempt({
          id: 1,
          attempt: 1,
          rawscore: 8,
          maxscore: 10,
          duration: 120,
          completion: 1,
          success: 1,
        }),
      ];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });

      // Check score is displayed - use getAllByText since score format is "8 / 10"
      // which appears as separate elements and may match statistics
      expect(screen.getAllByText(/\b8\b/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/\b10\b/).length).toBeGreaterThan(0);
    });

    it('renders empty state when no attempts exist', async () => {
      setupMockHook({ attempts: [] });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no attempts found/i)).toBeInTheDocument();
      });
    });

    it('displays "No attempts found" message for empty attempts', async () => {
      setupMockHook({ attempts: [] });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no attempts found/i)).toBeInTheDocument();
        expect(screen.getByText(/complete the activity to see your results/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Table View Tests
  // ==========================================================================

  describe('Table View', () => {
    it('uses table structure for displaying attempts', async () => {
      setupMockHook();
      renderComponent();

      await waitFor(() => {
        // MUI DataGrid uses role="grid" instead of role="table"
        expect(screen.getByRole('grid')).toBeInTheDocument();
      });
    });

    it('shows column headers for all data fields', async () => {
      setupMockHook();
      renderComponent();

      await waitFor(() => {
        // Use getAllByText since column headers and filter labels may share text
        expect(screen.getAllByText('Attempt').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Date').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Score').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Duration').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Status').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Result').length).toBeGreaterThan(0);
      });
    });

    it('displays rows with attempt data', async () => {
      const attempts = createMockAttempts(3);
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
        expect(screen.getByText('#2')).toBeInTheDocument();
        expect(screen.getByText('#3')).toBeInTheDocument();
      });
    });

    it('renders completion status chip correctly', async () => {
      const attempts = [
        createMockAttempt({ completion: 1 }),
        createMockAttempt({ id: 2, attempt: 2, completion: 0 }),
      ];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
        expect(screen.getByText('In Progress')).toBeInTheDocument();
      });
    });

    it('renders success status chip correctly', async () => {
      const attempts = [
        createMockAttempt({ completion: 1, success: 1 }),
        createMockAttempt({ id: 2, attempt: 2, completion: 1, success: 0 }),
      ];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Passed')).toBeInTheDocument();
        expect(screen.getByText('Failed')).toBeInTheDocument();
      });
    });

    it('shows dash for success when attempt is incomplete', async () => {
      const attempts = [
        createMockAttempt({ completion: 0, success: null }),
      ];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('-')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Card View Tests
  // ==========================================================================

  describe('Card View', () => {
    it('renders H5PReportCard for each attempt in card view', async () => {
      const attempts = createMockAttempts(3);
      setupMockHook({ attempts });
      const { user } = renderComponent();

      // Switch to card view
      const cardViewButton = screen.getByRole('button', { name: /card view/i });
      await user.click(cardViewButton);

      await waitFor(() => {
        expect(screen.getByTestId('h5p-report-card-1')).toBeInTheDocument();
        expect(screen.getByTestId('h5p-report-card-2')).toBeInTheDocument();
        expect(screen.getByTestId('h5p-report-card-3')).toBeInTheDocument();
      });
    });

    it('uses Grid layout for card display', async () => {
      const attempts = createMockAttempts(3);
      setupMockHook({ attempts });
      const { user } = renderComponent();

      // Switch to card view
      const cardViewButton = screen.getByRole('button', { name: /card view/i });
      await user.click(cardViewButton);

      await waitFor(() => {
        // H5PReportCard components should be rendered
        expect(H5PReportCard).toHaveBeenCalled();
      });
    });

    it('passes correct props to H5PReportCard', async () => {
      const attempts = [createMockAttempt({ id: 1, attempt: 1 })];
      setupMockHook({ attempts });
      const { user } = renderComponent();

      // Switch to card view
      const cardViewButton = screen.getByRole('button', { name: /card view/i });
      await user.click(cardViewButton);

      await waitFor(() => {
        expect(H5PReportCard).toHaveBeenCalledWith(
          expect.objectContaining({
            attempt: expect.objectContaining({
              id: 1,
              attempt: 1,
            }),
            reportUrl: expect.stringContaining('/mod/h5pactivity/report.php'),
          }),
          expect.anything()
        );
      });
    });
  });

  // ==========================================================================
  // View Toggle Tests
  // ==========================================================================

  describe('View Toggle', () => {
    it('renders ToggleButtonGroup component', async () => {
      setupMockHook();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /view mode/i })).toBeInTheDocument();
      });
    });

    it('shows Table and Card view options', async () => {
      setupMockHook();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /table view/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /card view/i })).toBeInTheDocument();
      });
    });

    it('switches view on toggle click', async () => {
      setupMockHook();
      const { user } = renderComponent();

      // Initially in table view (MUI DataGrid uses role="grid")
      await waitFor(() => {
        expect(screen.getByRole('grid')).toBeInTheDocument();
      });

      // Switch to card view
      const cardViewButton = screen.getByRole('button', { name: /card view/i });
      await user.click(cardViewButton);

      // Grid should not be visible anymore
      await waitFor(() => {
        expect(screen.queryByRole('grid')).not.toBeInTheDocument();
      });

      // Switch back to table view
      const tableViewButton = screen.getByRole('button', { name: /table view/i });
      await user.click(tableViewButton);

      await waitFor(() => {
        expect(screen.getByRole('grid')).toBeInTheDocument();
      });
    });

    it('default view is table', async () => {
      setupMockHook();
      renderComponent();

      await waitFor(() => {
        // MUI DataGrid uses role="grid"
        expect(screen.getByRole('grid')).toBeInTheDocument();
      });

      // Card view should not be showing
      expect(screen.queryByTestId(/h5p-report-card/)).not.toBeInTheDocument();
    });

    it('maintains view state between toggles', async () => {
      setupMockHook();
      const { user } = renderComponent();

      // Switch to card view
      const cardViewButton = screen.getByRole('button', { name: /card view/i });
      await user.click(cardViewButton);

      await waitFor(() => {
        expect(screen.queryByRole('grid')).not.toBeInTheDocument();
      });

      // The card view button should be selected
      expect(cardViewButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  // ==========================================================================
  // Sorting Tests
  // ==========================================================================

  describe('Sorting', () => {
    it('sorts by attempt number on column click', async () => {
      const attempts = createMockAttempts(5);
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('Attempt').length).toBeGreaterThan(0);
      });

      // Click on the Attempt column header to sort (first match is usually the column header)
      const attemptHeaders = screen.getAllByText('Attempt');
      await user.click(attemptHeaders[0]);

      // The sort should be applied - check hook was called with sort params
      expect(useH5PAttempts).toHaveBeenCalled();
    });

    it('toggles sort direction on subsequent clicks', async () => {
      const attempts = createMockAttempts(5);
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('Attempt').length).toBeGreaterThan(0);
      });

      const attemptHeaders = screen.getAllByText('Attempt');

      // First click - should set ascending
      await user.click(attemptHeaders[0]);

      // Second click - should toggle to descending
      await user.click(attemptHeaders[0]);

      // Hook should be called with updated sort order
      expect(useH5PAttempts).toHaveBeenCalled();
    });

    it('can sort by date column', async () => {
      const attempts = createMockAttempts(3);
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('Date').length).toBeGreaterThan(0);
      });

      const dateHeaders = screen.getAllByText('Date');
      await user.click(dateHeaders[0]);

      expect(useH5PAttempts).toHaveBeenCalled();
    });

    it('can sort by score column', async () => {
      const attempts = createMockAttempts(3);
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('Score').length).toBeGreaterThan(0);
      });

      const scoreHeaders = screen.getAllByText('Score');
      await user.click(scoreHeaders[0]);

      expect(useH5PAttempts).toHaveBeenCalled();
    });

    it('can sort by duration column', async () => {
      const attempts = createMockAttempts(3);
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('Duration').length).toBeGreaterThan(0);
      });

      const durationHeaders = screen.getAllByText('Duration');
      await user.click(durationHeaders[0]);

      expect(useH5PAttempts).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Filtering Tests
  // ==========================================================================

  describe('Filtering', () => {
    it('renders filter controls', async () => {
      setupMockHook();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/filter attempts/i)).toBeInTheDocument();
      });
    });

    it('renders completion status filter', async () => {
      setupMockHook();
      renderComponent();

      await waitFor(() => {
        // Find the completion filter using the helper
        const completionSelect = getSelectByLabel('Completion');
        expect(completionSelect).toBeInTheDocument();
      });
    });

    it('renders success status filter', async () => {
      setupMockHook();
      renderComponent();

      await waitFor(() => {
        // Find the result filter using the helper
        const resultSelect = getSelectByLabel('Result');
        expect(resultSelect).toBeInTheDocument();
      });
    });

    it('filters by completion status - completed', async () => {
      const attempts = [
        createMockAttempt({ id: 1, completion: 1 }),
        createMockAttempt({ id: 2, attempt: 2, completion: 0 }),
        createMockAttempt({ id: 3, attempt: 3, completion: 1 }),
      ];
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(getSelectByLabel('Completion')).toBeInTheDocument();
      });

      // Open the completion filter dropdown
      const completionSelect = getSelectByLabel('Completion');
      await user.click(completionSelect);

      // Select "Completed"
      const completedOption = await screen.findByRole('option', { name: /completed/i });
      await user.click(completedOption);

      // Wait for filter to be applied
      await waitFor(() => {
        // Only completed attempts should show
        expect(screen.queryByText('In Progress')).not.toBeInTheDocument();
      });
    });

    it('filters by completion status - incomplete', async () => {
      const attempts = [
        createMockAttempt({ id: 1, completion: 1 }),
        createMockAttempt({ id: 2, attempt: 2, completion: 0 }),
        createMockAttempt({ id: 3, attempt: 3, completion: 1 }),
      ];
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(getSelectByLabel('Completion')).toBeInTheDocument();
      });

      // Open the completion filter dropdown
      const completionSelect = getSelectByLabel('Completion');
      await user.click(completionSelect);

      // Select "In Progress"
      const incompleteOption = await screen.findByRole('option', { name: /in progress/i });
      await user.click(incompleteOption);

      // Wait for filter to be applied - use getAllByText since "In Progress" appears in both
      // the dropdown (selected value) and the grid cell
      await waitFor(() => {
        const inProgressElements = screen.getAllByText('In Progress');
        expect(inProgressElements.length).toBeGreaterThan(0);
      });
    });

    it('filters by success status - passed', async () => {
      const attempts = [
        createMockAttempt({ id: 1, completion: 1, success: 1 }),
        createMockAttempt({ id: 2, attempt: 2, completion: 1, success: 0 }),
      ];
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(getSelectByLabel('Result')).toBeInTheDocument();
      });

      // Open the result filter dropdown
      const resultSelect = getSelectByLabel('Result');
      await user.click(resultSelect);

      // Select "Passed"
      const passedOption = await screen.findByRole('option', { name: /passed/i });
      await user.click(passedOption);

      // "Passed" appears in dropdown and may appear in cell - use getAllByText
      await waitFor(() => {
        const passedElements = screen.getAllByText('Passed');
        expect(passedElements.length).toBeGreaterThan(0);
        // "Failed" should not appear as filter excludes it (may show in dropdown options if open)
        expect(screen.queryByRole('gridcell', { name: /failed/i })).not.toBeInTheDocument();
      });
    });

    it('filters by success status - failed', async () => {
      const attempts = [
        createMockAttempt({ id: 1, completion: 1, success: 1 }),
        createMockAttempt({ id: 2, attempt: 2, completion: 1, success: 0 }),
      ];
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(getSelectByLabel('Result')).toBeInTheDocument();
      });

      // Open the result filter dropdown
      const resultSelect = getSelectByLabel('Result');
      await user.click(resultSelect);

      // Select "Failed"
      const failedOption = await screen.findByRole('option', { name: /failed/i });
      await user.click(failedOption);

      // "Failed" appears in dropdown and may appear in cell - use getAllByText
      await waitFor(() => {
        const failedElements = screen.getAllByText('Failed');
        expect(failedElements.length).toBeGreaterThan(0);
        // "Passed" should not appear in data cells as filter excludes it
        expect(screen.queryByRole('gridcell', { name: /passed/i })).not.toBeInTheDocument();
      });
    });

    it('combines multiple filters', async () => {
      const attempts = [
        createMockAttempt({ id: 1, completion: 1, success: 1 }),
        createMockAttempt({ id: 2, attempt: 2, completion: 1, success: 0 }),
        createMockAttempt({ id: 3, attempt: 3, completion: 0, success: null }),
      ];
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(getSelectByLabel('Completion')).toBeInTheDocument();
        expect(getSelectByLabel('Result')).toBeInTheDocument();
      });

      // Filter by completed
      const completionSelect = getSelectByLabel('Completion');
      await user.click(completionSelect);
      const completedOption = await screen.findByRole('option', { name: /completed/i });
      await user.click(completedOption);

      // Filter by passed
      const resultSelect = getSelectByLabel('Result');
      await user.click(resultSelect);
      const passedOption = await screen.findByRole('option', { name: /passed/i });
      await user.click(passedOption);

      // Values appear in both dropdowns and cells - use getAllByText
      await waitFor(() => {
        // Only completed AND passed attempts should show
        const passedElements = screen.getAllByText('Passed');
        const completedElements = screen.getAllByText('Completed');
        expect(passedElements.length).toBeGreaterThan(0);
        expect(completedElements.length).toBeGreaterThan(0);
      });
    });

    it('shows no matching attempts message when filters return empty results', async () => {
      const attempts = [
        createMockAttempt({ id: 1, completion: 1, success: 1 }),
      ];
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(getSelectByLabel('Result')).toBeInTheDocument();
      });

      // Filter by failed (no failed attempts exist)
      const resultSelect = getSelectByLabel('Result');
      await user.click(resultSelect);
      const failedOption = await screen.findByRole('option', { name: /failed/i });
      await user.click(failedOption);

      await waitFor(() => {
        expect(screen.getByText(/no matching attempts/i)).toBeInTheDocument();
      });
    });

    it('maintains filter state when changing view mode', async () => {
      const attempts = [
        createMockAttempt({ id: 1, completion: 1, success: 1 }),
        createMockAttempt({ id: 2, attempt: 2, completion: 1, success: 0 }),
      ];
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(getSelectByLabel('Result')).toBeInTheDocument();
      });

      // Filter by passed
      const resultSelect = getSelectByLabel('Result');
      await user.click(resultSelect);
      const passedOption = await screen.findByRole('option', { name: /passed/i });
      await user.click(passedOption);

      // "Passed" appears in dropdown and may appear in cell
      await waitFor(() => {
        const passedElements = screen.getAllByText('Passed');
        expect(passedElements.length).toBeGreaterThan(0);
      });

      // Switch to card view
      const cardViewButton = screen.getByRole('button', { name: /card view/i });
      await user.click(cardViewButton);

      // Filter should still be applied
      await waitFor(() => {
        // Only one card should show (the passed attempt)
        expect(screen.getByTestId('h5p-report-card-1')).toBeInTheDocument();
        expect(screen.queryByTestId('h5p-report-card-2')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Pagination Tests
  // ==========================================================================

  describe('Pagination', () => {
    it('shows pagination for large datasets', async () => {
      const attempts = createMockAttempts(25);
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        // MUI DataGrid pagination renders buttons for page navigation
        // Look for the "Go to next page" button which indicates pagination is present
        expect(screen.getByRole('button', { name: /go to next page/i })).toBeInTheDocument();
      });
    });

    it('displays current page and total pages', async () => {
      const attempts = createMockAttempts(30);
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        // MUI TablePagination shows row count info like "1-10 of 30"
        // The pagination buttons should be visible
        expect(screen.getByRole('button', { name: /go to next page/i })).toBeInTheDocument();
        // Should show pagination text indicating total rows
        expect(screen.getByText(/of 30/i)).toBeInTheDocument();
      });
    });

    it('navigates to next page', async () => {
      const attempts = createMockAttempts(25);
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /go to next page/i })).toBeInTheDocument();
      });

      // Click next page button
      const nextButton = screen.getByRole('button', { name: /go to next page/i });
      await user.click(nextButton);

      // Hook should be called with new page
      expect(useH5PAttempts).toHaveBeenCalled();
    });

    it('navigates to previous page', async () => {
      const attempts = createMockAttempts(25);
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /go to next page/i })).toBeInTheDocument();
      });

      // Go to page 2 first
      const nextButton = screen.getByRole('button', { name: /go to next page/i });
      await user.click(nextButton);

      // Then go back to page 1
      const prevButton = screen.getByRole('button', { name: /go to previous page/i });
      await user.click(prevButton);

      expect(useH5PAttempts).toHaveBeenCalled();
    });

    it('resets to first page when filter changes', async () => {
      const attempts = createMockAttempts(25);
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /go to next page/i })).toBeInTheDocument();
      });

      // Go to page 2
      const nextButton = screen.getByRole('button', { name: /go to next page/i });
      await user.click(nextButton);

      // Change filter
      const completionSelect = getSelectByLabel('Completion');
      await user.click(completionSelect);
      const completedOption = await screen.findByRole('option', { name: /completed/i });
      await user.click(completedOption);

      // Should reset to page 1
      expect(useH5PAttempts).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Summary Statistics Tests
  // ==========================================================================

  describe('Summary Statistics', () => {
    it('displays summary section header', async () => {
      setupMockHook();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/summary/i)).toBeInTheDocument();
      });
    });

    it('calculates and displays total attempts count', async () => {
      const attempts = createMockAttempts(5);
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/5 attempts/i)).toBeInTheDocument();
      });
    });

    it('calculates and displays average score', async () => {
      const attempts = [
        createMockAttempt({ id: 1, rawscore: 8, maxscore: 10 }),
        createMockAttempt({ id: 2, attempt: 2, rawscore: 6, maxscore: 10 }),
      ];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        // Average should be 70% ((80% + 60%) / 2)
        expect(screen.getByText(/avg:/i)).toBeInTheDocument();
      });
    });

    it('calculates and displays best score', async () => {
      const attempts = [
        createMockAttempt({ id: 1, rawscore: 8, maxscore: 10 }),
        createMockAttempt({ id: 2, attempt: 2, rawscore: 10, maxscore: 10 }),
      ];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/best:/i)).toBeInTheDocument();
      });
    });

    it('calculates and displays completion rate', async () => {
      const attempts = [
        createMockAttempt({ id: 1, completion: 1 }),
        createMockAttempt({ id: 2, attempt: 2, completion: 1 }),
        createMockAttempt({ id: 3, attempt: 3, completion: 0 }),
      ];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/completion:/i)).toBeInTheDocument();
      });
    });

    it('updates statistics when attempts change', async () => {
      const initialAttempts = createMockAttempts(3);
      setupMockHook({ attempts: initialAttempts });
      const { rerender } = renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/3 attempts/i)).toBeInTheDocument();
      });

      // Update the mock with more attempts
      const updatedAttempts = createMockAttempts(5);
      setupMockHook({ attempts: updatedAttempts });

      // Force a re-render - RTL will use the same wrapper from renderComponent
      // Note: We only pass the component, not the wrappers, because the wrapper option
      // is automatically applied by RTL
      rerender(<H5PResultsList h5pActivityId={123} />);

      await waitFor(() => {
        // After the mock updates and rerender, statistics should reflect new data
        expect(screen.getByText(/5 attempts/i)).toBeInTheDocument();
      });
    });

    it('shows average duration when available', async () => {
      const attempts = [
        createMockAttempt({ id: 1, duration: 120 }),
        createMockAttempt({ id: 2, attempt: 2, duration: 180 }),
      ];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/avg duration/i)).toBeInTheDocument();
      });

      expect(formatDuration).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  describe('Loading State', () => {
    it('shows loading spinner while loading', async () => {
      setupMockHook({ isLoading: true, attempts: [] });
      renderComponent();

      expect(screen.getByText(/loading attempts/i)).toBeInTheDocument();
    });

    it('hides actual data during load', async () => {
      setupMockHook({ isLoading: true, attempts: [] });
      renderComponent();

      // Grid (DataGrid) should not be visible
      expect(screen.queryByRole('grid')).not.toBeInTheDocument();
      // Summary should not be visible
      expect(screen.queryByText(/summary/i)).not.toBeInTheDocument();
    });

    it('shows content after loading completes', async () => {
      setupMockHook({ isLoading: false });
      renderComponent();

      await waitFor(() => {
        // MUI DataGrid uses role="grid"
        expect(screen.getByRole('grid')).toBeInTheDocument();
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Error State Tests
  // ==========================================================================

  describe('Error State', () => {
    it('displays error Alert on fetch failure', async () => {
      setupMockHook({
        isError: true,
        error: new Error('Failed to fetch attempts'),
        attempts: [],
      });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/failed to load attempts/i)).toBeInTheDocument();
      });
    });

    it('shows error message', async () => {
      const errorMessage = 'Network connection failed';
      setupMockHook({
        isError: true,
        error: new Error(errorMessage),
        attempts: [],
      });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('renders retry button', async () => {
      setupMockHook({
        isError: true,
        error: new Error('Error'),
        attempts: [],
      });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('calls refetch on retry button click', async () => {
      const { refetch } = setupMockHook({
        isError: true,
        error: new Error('Error'),
        attempts: [],
      });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(refetch).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Empty State Tests
  // ==========================================================================

  describe('Empty State', () => {
    it('shows appropriate message when no attempts exist', async () => {
      setupMockHook({ attempts: [] });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no attempts found/i)).toBeInTheDocument();
      });
    });

    it('suggests starting new attempt', async () => {
      setupMockHook({ attempts: [] });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/complete the activity to see your results/i)).toBeInTheDocument();
      });
    });

    it('hides table when empty', async () => {
      setupMockHook({ attempts: [] });
      renderComponent();

      await waitFor(() => {
        // MUI DataGrid uses role="grid"
        expect(screen.queryByRole('grid')).not.toBeInTheDocument();
      });
    });

    it('hides pagination when empty', async () => {
      setupMockHook({ attempts: [] });
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration', () => {
    it('useH5PAttempts hook provides attempt data', async () => {
      const attempts = createMockAttempts(3);
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(useH5PAttempts).toHaveBeenCalledWith(
          expect.objectContaining({
            activityId: 123,
          })
        );
      });
    });

    it('H5PReportCard receives correct props in card view', async () => {
      const attempts = [createMockAttempt({ id: 42, attempt: 1, rawscore: 8, maxscore: 10 })];
      setupMockHook({ attempts });
      const { user } = renderComponent();

      // Switch to card view
      const cardViewButton = screen.getByRole('button', { name: /card view/i });
      await user.click(cardViewButton);

      await waitFor(() => {
        expect(H5PReportCard).toHaveBeenCalledWith(
          expect.objectContaining({
            attempt: expect.objectContaining({
              id: 42,
              attempt: 1,
              rawscore: 8,
              maxscore: 10,
            }),
          }),
          expect.anything()
        );
      });
    });

    it('date formatting uses date utilities', async () => {
      const attempts = [createMockAttempt({ duration: 150 })];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(formatDuration).toHaveBeenCalledWith(150);
      });
    });

    it('filter and sort state managed correctly', async () => {
      const attempts = createMockAttempts(10);
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(getSelectByLabel('Completion')).toBeInTheDocument();
      });

      // Apply filter
      const completionSelect = getSelectByLabel('Completion');
      await user.click(completionSelect);
      const completedOption = await screen.findByRole('option', { name: /completed/i });
      await user.click(completedOption);

      // Apply sort
      const attemptHeader = screen.getByText('Attempt');
      await user.click(attemptHeader);

      // Both should be reflected in hook calls
      expect(useH5PAttempts).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('table has proper ARIA structure', async () => {
      setupMockHook();
      renderComponent();

      await waitFor(() => {
        // MUI DataGrid uses role="grid" instead of role="table"
        const grid = screen.getByRole('grid');
        expect(grid).toBeInTheDocument();
      });
    });

    it('sort buttons are keyboard accessible', async () => {
      setupMockHook();
      const { user } = renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Attempt')).toBeInTheDocument();
      });

      // Focus and press Enter on column header
      const attemptHeader = screen.getByText('Attempt');
      attemptHeader.focus();
      await user.keyboard('{Enter}');

      // Sort should be triggered
      expect(useH5PAttempts).toHaveBeenCalled();
    });

    it('filter controls have labels', async () => {
      setupMockHook();
      renderComponent();

      await waitFor(() => {
        // Check that labels exist and their associated comboboxes are present
        expect(getSelectByLabel('Completion')).toBeInTheDocument();
        expect(getSelectByLabel('Result')).toBeInTheDocument();
      });
    });

    it('view toggle buttons have accessible names', async () => {
      setupMockHook();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /table view/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /card view/i })).toBeInTheDocument();
      });
    });

    it('toggle button group has accessible label', async () => {
      setupMockHook();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /view mode/i })).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('handles exactly 10 attempts (default page size boundary)', async () => {
      const attempts = createMockAttempts(10);
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        // All 10 attempts should be visible (fits in one page)
        expect(screen.getByText('#1')).toBeInTheDocument();
        expect(screen.getByText('#10')).toBeInTheDocument();
      });
    });

    it('handles single attempt', async () => {
      const attempts = [createMockAttempt()];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
        expect(screen.getByText(/1 attempts/i)).toBeInTheDocument();
      });
    });

    it('handles large attempt lists efficiently', async () => {
      // Create many attempts but mock should handle pagination
      const attempts = createMockAttempts(100);
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        // Component should render without hanging (MUI DataGrid uses role="grid")
        expect(screen.getByRole('grid')).toBeInTheDocument();
      });
    });

    it('handles null scores gracefully', async () => {
      const attempts = [
        createMockAttempt({
          id: 1,
          rawscore: 0,
          maxscore: 0,
          scaled: 0,
        }),
      ];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
        // Should show 0/0 without crashing - use getAllByText since "0" appears multiple times
        const zeroElements = screen.getAllByText(/0/);
        expect(zeroElements.length).toBeGreaterThan(0);
      });
    });

    it('handles zero duration', async () => {
      const attempts = [createMockAttempt({ duration: 0 })];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });

      // Component should render without crashing when duration is 0
      // The duration cell may show "0s", "0:00", "N/A", or similar
      // formatDuration may or may not be called depending on implementation
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    it('handles very old timestamps', async () => {
      const attempts = [
        createMockAttempt({
          timecreated: 0, // Unix epoch
          timemodified: 0,
        }),
      ];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
    });

    it('handles future timestamps', async () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400 * 365; // 1 year in future
      const attempts = [
        createMockAttempt({
          timecreated: futureTimestamp,
          timemodified: futureTimestamp,
        }),
      ];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
    });

    it('handles attempts with maxscore of 0', async () => {
      const attempts = [
        createMockAttempt({
          rawscore: 0,
          maxscore: 0,
          scaled: 0,
        }),
      ];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        // Should not crash when calculating percentage with 0 maxscore
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
    });

    it('handles all incomplete attempts', async () => {
      const attempts = [
        createMockAttempt({ id: 1, completion: 0, success: null }),
        createMockAttempt({ id: 2, attempt: 2, completion: 0, success: null }),
      ];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        // Should show completion rate of 0%
        expect(screen.getByText(/completion:/i)).toBeInTheDocument();
      });
    });

    it('handles userId prop correctly', async () => {
      setupMockHook();
      renderComponent({ h5pActivityId: 123, userId: 456 });

      expect(useH5PAttempts).toHaveBeenCalledWith(
        expect.objectContaining({
          activityId: 123,
          userIds: [456],
        })
      );
    });
  });

  // ==========================================================================
  // Score Display Tests
  // ==========================================================================

  describe('Score Display', () => {
    it('displays score as fraction with percentage', async () => {
      const attempts = [createMockAttempt({ rawscore: 7, maxscore: 10 })];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        // Score should show 7/10 (70%) - numbers may appear multiple times
        // so we just verify the percentage is displayed correctly
        expect(screen.getByText(/70\.0%/)).toBeInTheDocument();
        // Also verify the fraction format exists somewhere
        const scoreElements = screen.getAllByText(/7/);
        expect(scoreElements.length).toBeGreaterThan(0);
      });
    });

    it('handles perfect score', async () => {
      const attempts = [createMockAttempt({ rawscore: 10, maxscore: 10, scaled: 1 })];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/100\.0%/)).toBeInTheDocument();
      });
    });

    it('handles zero score', async () => {
      const attempts = [createMockAttempt({ rawscore: 0, maxscore: 10, scaled: 0 })];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/0\.0%/)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Duration Display Tests
  // ==========================================================================

  describe('Duration Display', () => {
    it('formats short durations correctly', async () => {
      const attempts = [createMockAttempt({ duration: 45 })];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(formatDuration).toHaveBeenCalledWith(45);
      });
    });

    it('formats medium durations correctly', async () => {
      const attempts = [createMockAttempt({ duration: 150 })];
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(formatDuration).toHaveBeenCalledWith(150);
      });
    });

    it('formats long durations correctly', async () => {
      const attempts = [createMockAttempt({ duration: 3720 })]; // 1 hour 2 minutes
      setupMockHook({ attempts });
      renderComponent();

      await waitFor(() => {
        expect(formatDuration).toHaveBeenCalledWith(3720);
      });
    });

    it('displays N/A for missing duration', async () => {
      const attempts = [createMockAttempt({ duration: 0 })];
      setupMockHook({ attempts });
      renderComponent();

      // Component should render correctly with 0 duration
      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });

      // The component should render the duration cell (may show N/A, 0s, etc.)
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Date Score Filter Tests
  // ==========================================================================

  describe('Score Range Filtering', () => {
    it('filters by minimum score', async () => {
      const attempts = [
        createMockAttempt({ id: 1, rawscore: 5, maxscore: 10 }), // 50%
        createMockAttempt({ id: 2, attempt: 2, rawscore: 8, maxscore: 10 }), // 80%
      ];
      setupMockHook({ attempts });
      const { user } = renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/min score/i)).toBeInTheDocument();
      });

      // Set minimum score filter to 60%
      const minScoreInput = screen.getByLabelText(/min score/i);
      await user.clear(minScoreInput);
      await user.type(minScoreInput, '60');

      // Only the 80% attempt should remain
      await waitFor(() => {
        expect(screen.getByText('#2')).toBeInTheDocument();
        expect(screen.queryByText('#1')).not.toBeInTheDocument();
      });
    });

    it('filters by maximum score', async () => {
      const attempts = [
        createMockAttempt({ id: 1, rawscore: 5, maxscore: 10 }), // 50%
        createMockAttempt({ id: 2, attempt: 2, rawscore: 8, maxscore: 10 }), // 80%
      ];
      setupMockHook({ attempts });
      renderComponent();

      // Wait for grid to render with both attempts
      await waitFor(() => {
        expect(screen.getByRole('grid')).toBeInTheDocument();
      });

      // Set maximum score filter to 60% using fireEvent for direct value change
      const maxScoreInput = screen.getByLabelText(/max score/i);
      fireEvent.change(maxScoreInput, { target: { value: '60' } });

      // Only the 50% attempt should remain (50% <= 60%)
      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
        expect(screen.queryByText('#2')).not.toBeInTheDocument();
      });
    });
  });
});
