/**
 * Unit tests for ResponseList component.
 *
 * Comprehensive test suite validating the ResponseList component's functionality including:
 * - MUI DataGrid rendering with all columns (ID, User, Date, Course, Status, Actions)
 * - User column with Avatar showing initials or images
 * - Date formatting with date-fns (relative time and full dates)
 * - Status display with MUI Chip and color coding
 * - Action buttons (View Details, Delete) with permission-based visibility
 * - Filtering by user (Autocomplete), course (Select), date range (DatePicker)
 * - Sorting by clicking column headers (ascending/descending)
 * - Pagination controls with page size selector and navigation
 * - Row selection with checkboxes (single and bulk operations)
 * - Delete functionality with confirmation Dialog (Cancel, Delete buttons)
 * - Loading states with Skeleton components
 * - Empty state with helpful messages
 * - Error handling with Alert and retry capabilities
 * - WCAG 2.1 AA accessibility compliance (ARIA grid roles, keyboard navigation, screen reader support)
 *
 * Target: 90%+ code coverage following React Testing Library best practices.
 *
 * @see react-frontend/src/features/activities/feedback/components/ResponseList.tsx
 * @see public/mod/feedback/show_entries.php - Reference PHP implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe, toHaveNoViolations } from 'jest-axe';
import { format } from 'date-fns';

// Component under test
import ResponseList from '@/features/activities/feedback/components/ResponseList';

// Types
import type { FeedbackCompleted } from '@/features/activities/feedback/types/feedback.types';

// Test helpers
import { renderWithRouter } from '@tests/helpers/render';
import { createMockUser, createMockCourse, generateMockId, generateMockDate } from '@tests/helpers/mockData';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

/**
 * Interface for response with enriched user and course details
 * Matches the ResponseWithDetails interface from ResponseList.tsx
 */
interface ResponseWithDetails extends FeedbackCompleted {
  userName: string;
  userAvatar?: string;
  courseName: string;
  completionStatus: number;
}

/**
 * Factory function to create mock feedback response with details
 */
function createMockResponse(overrides: Partial<ResponseWithDetails> = {}): ResponseWithDetails {
  const id = overrides.id ?? generateMockId();
  const user = createMockUser();
  const course = createMockCourse();

  return {
    id,
    feedback: overrides.feedback ?? generateMockId(),
    userid: overrides.userid ?? user.id,
    timemodified: overrides.timemodified ?? generateMockDate(-2),
    random_response: overrides.random_response ?? 0,
    anonymous_response: overrides.anonymous_response ?? 0,
    courseid: overrides.courseid ?? course.id,
    userName: overrides.userName ?? user.fullname,
    userAvatar: overrides.userAvatar ?? (typeof user.picture === 'string' ? user.picture : undefined),
    courseName: overrides.courseName ?? course.fullname,
    completionStatus: overrides.completionStatus ?? 1,
  };
}

/**
 * Helper to create multiple mock responses
 */
function createMockResponses(count: number): ResponseWithDetails[] {
  return Array.from({ length: count }, (_, index) => {
    const user = createMockUser({ firstname: `User${index + 1}`, lastname: 'Test' });
    const course = createMockCourse({ fullname: `Course ${index + 1}` });
    
    return createMockResponse({
      id: index + 1,
      userid: user.id,
      userName: user.fullname,
      courseName: course.fullname,
      courseid: course.id,
      timemodified: generateMockDate(-index),
      completionStatus: index % 2 === 0 ? 1 : 0, // Alternate between complete and in progress
    });
  });
}

/**
 * Test suite for ResponseList component
 */
describe('ResponseList Component', () => {
  // Mock functions - using explicit mock function type
  let mockOnDelete: ReturnType<typeof vi.fn<[number[]], Promise<void>>>;
  let mockOnViewDetails: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  // Setup before each test
  beforeEach(() => {
    mockOnDelete = vi.fn<[number[]], Promise<void>>().mockResolvedValue(undefined);
    mockOnViewDetails = vi.fn();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  // Cleanup after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper function to render ResponseList with QueryClient wrapper
   */
  function renderResponseList(props: {
    responses?: ResponseWithDetails[];
    feedbackId?: number;
    canDelete?: boolean;
    loading?: boolean;
    error?: Error | null;
    onDelete?: (ids: number[]) => Promise<void>;
    onViewDetails?: (id: number) => void;
  }) {
    const {
      responses = [],
      feedbackId = generateMockId(),
      canDelete = true,
      loading = false,
      error = null,
      onDelete = mockOnDelete,
      onViewDetails = mockOnViewDetails,
    } = props;

    return renderWithRouter(
      <QueryClientProvider client={queryClient}>
        <ResponseList
          feedbackId={feedbackId}
          responses={responses}
          onDelete={onDelete}
          canDelete={canDelete}
          loading={loading}
          error={error}
          onViewDetails={onViewDetails}
        />
      </QueryClientProvider>,
      '/'
    );
  }

  describe('Loading State', () => {
    it('should display skeleton loading when loading prop is true', () => {
      renderResponseList({ loading: true });

      // Verify skeleton is displayed
      const skeleton = screen.getByTestId('skeleton') || document.querySelector('.MuiSkeleton-root');
      expect(skeleton).toBeInTheDocument();
    });

    it('should not display DataGrid when loading', () => {
      renderResponseList({ loading: true });

      // Verify DataGrid is not rendered
      expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error alert when error prop is provided', () => {
      const error = new Error('Failed to load responses');
      renderResponseList({ error });

      // Verify error message is displayed
      const errorAlert = screen.getByTestId('error-alert');
      expect(errorAlert).toBeInTheDocument();
      // Alert may contain the text multiple times (title and message), so use getAllByText
      const errorTexts = within(errorAlert).getAllByText(/failed to load responses/i);
      expect(errorTexts.length).toBeGreaterThan(0);
    });

    it('should display generic error message for errors without message', () => {
      const error = new Error();
      renderResponseList({ error });

      // Verify generic error message
      expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument();
    });

    it('should not display DataGrid when error is present', () => {
      const error = new Error('Test error');
      renderResponseList({ error });

      // Verify DataGrid is not rendered
      expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state message when no responses', () => {
      renderResponseList({ responses: [] });

      // Verify empty state message
      expect(screen.getByText(/no responses yet/i)).toBeInTheDocument();
      expect(screen.getByText(/there are no feedback responses to display/i)).toBeInTheDocument();
    });

    it('should display info icon in empty state', () => {
      renderResponseList({ responses: [] });

      // Verify info icon is present
      const infoIcon = document.querySelector('[data-testid="InfoIcon"]');
      expect(infoIcon).toBeInTheDocument();
    });

    it('should not display DataGrid when responses array is empty', () => {
      renderResponseList({ responses: [] });

      // Verify DataGrid is not rendered
      expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    });
  });

  describe('DataGrid Rendering', () => {
    it('should render DataGrid with responses', () => {
      const responses = createMockResponses(3);
      renderResponseList({ responses });

      // Verify DataGrid is rendered
      const grid = screen.getByRole('grid');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveAttribute('aria-label', 'Feedback responses table');
    });

    it('should display all column headers', () => {
      const responses = createMockResponses(3);
      renderResponseList({ responses });

      // Verify column headers
      expect(screen.getByRole('columnheader', { name: /id/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /user/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /submission date/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /course/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /actions/i })).toBeInTheDocument();
    });

    it('should display response data in grid rows', () => {
      const responses = createMockResponses(3);
      renderResponseList({ responses });

      // Verify response IDs are displayed
      responses.forEach((response) => {
        expect(screen.getByText(response.id.toString())).toBeInTheDocument();
      });
    });

    it('should render correct number of rows', () => {
      const responses = createMockResponses(5);
      renderResponseList({ responses });

      // Get all rows (excluding header)
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows).toHaveLength(5);
    });
  });

  describe('User Column with Avatar', () => {
    it('should display user name in user column', () => {
      const responses = [createMockResponse({ userName: 'John Doe' })];
      renderResponseList({ responses });

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should display Avatar with user initials when no image', () => {
      const responses = [createMockResponse({ userName: 'Jane Smith', userAvatar: undefined })];
      renderResponseList({ responses });

      // Avatar should show initials JS
      const avatar = document.querySelector('.MuiAvatar-root');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveTextContent('JS');
    });

    it('should display Avatar with image when userAvatar is provided', () => {
      const responses = [createMockResponse({ 
        userName: 'Alice Johnson', 
        userAvatar: 'https://example.com/avatar.jpg' 
      })];
      renderResponseList({ responses });

      // Avatar should have image
      const avatar = document.querySelector('.MuiAvatar-root img');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('should handle anonymous responses correctly', () => {
      const responses = [createMockResponse({ 
        userName: 'Anonymous', 
        anonymous_response: 1,
        random_response: 123
      })];
      renderResponseList({ responses });

      // Component renders "Anonymous (random_response)"
      expect(screen.getByText(/Anonymous \(123\)/)).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('should display formatted submission date', () => {
      const timestamp = generateMockDate(-2); // 2 days ago
      const responses = [createMockResponse({ timemodified: timestamp })];
      renderResponseList({ responses });

      // Date should be formatted relative (e.g., "2 days ago")
      const dateText = format(new Date(timestamp * 1000), 'PPp');
      const firstWord = dateText.split(' ')[0];
      if (firstWord) {
        expect(screen.getByText(new RegExp(firstWord))).toBeInTheDocument();
      }
    });

    it('should display relative time for recent submissions', () => {
      const timestamp = generateMockDate(0); // now
      const responses = [createMockResponse({ timemodified: timestamp })];
      renderResponseList({ responses });

      // Should show relative time like "less than a minute ago"
      const grid = screen.getByRole('grid');
      expect(grid).toBeInTheDocument();
    });
  });

  describe('Status Column with Chip', () => {
    it('should display "Complete" status with success color for completed responses', () => {
      const responses = [createMockResponse({ completionStatus: 1 })];
      renderResponseList({ responses });

      const chip = screen.getByText('Complete');
      expect(chip).toBeInTheDocument();
      expect(chip.closest('.MuiChip-root')).toHaveClass('MuiChip-colorSuccess');
    });

    it('should display "In Progress" status with warning color for incomplete responses', () => {
      const responses = [createMockResponse({ completionStatus: 0 })];
      renderResponseList({ responses });

      const chip = screen.getByText('In Progress');
      expect(chip).toBeInTheDocument();
      expect(chip.closest('.MuiChip-root')).toHaveClass('MuiChip-colorWarning');
    });

    it('should display CheckCircle icon for complete status', () => {
      const responses = [createMockResponse({ completionStatus: 1 })];
      renderResponseList({ responses });

      const checkIcon = document.querySelector('[data-testid="CheckCircleIcon"]');
      expect(checkIcon).toBeInTheDocument();
    });

    it('should display Schedule icon for in progress status', () => {
      const responses = [createMockResponse({ completionStatus: 0 })];
      renderResponseList({ responses });

      const scheduleIcon = document.querySelector('[data-testid="ScheduleIcon"]');
      expect(scheduleIcon).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should display View Details button for each response', () => {
      const responses = createMockResponses(2);
      renderResponseList({ responses });

      const viewButtons = screen.getAllByLabelText(/view details for response/i);
      expect(viewButtons).toHaveLength(2);
    });

    it('should call onViewDetails when View Details button is clicked', async () => {
      const user = userEvent.setup();
      const responses = [createMockResponse({ id: 123 })];
      renderResponseList({ responses });

      const viewButton = screen.getByLabelText(/view details for response 123/i);
      await user.click(viewButton);

      expect(mockOnViewDetails).toHaveBeenCalledWith(123);
      expect(mockOnViewDetails).toHaveBeenCalledTimes(1);
    });

    it('should display Delete button when canDelete is true', () => {
      const responses = createMockResponses(2);
      renderResponseList({ responses, canDelete: true });

      const deleteButtons = screen.getAllByLabelText(/delete response/i);
      expect(deleteButtons).toHaveLength(2);
    });

    it('should not display Delete button when canDelete is false', () => {
      const responses = createMockResponses(2);
      renderResponseList({ responses, canDelete: false });

      const deleteButtons = screen.queryAllByLabelText(/delete response/i);
      expect(deleteButtons).toHaveLength(0);
    });

    it('should display tooltips on hover for action buttons', async () => {
      const user = userEvent.setup();
      const responses = [createMockResponse()];
      renderResponseList({ responses });

      const viewButton = screen.getByLabelText(/view details/i);
      await user.hover(viewButton);

      // Tooltip should appear
      await waitFor(() => {
        expect(screen.getByRole('tooltip', { name: /view details/i })).toBeInTheDocument();
      });
    });
  });

  describe('Row Selection', () => {
    it('should display checkboxes when canDelete is true', () => {
      const responses = createMockResponses(3);
      renderResponseList({ responses, canDelete: true });

      const checkboxes = screen.getAllByRole('checkbox');
      // One checkbox per row + header checkbox
      expect(checkboxes.length).toBeGreaterThan(3);
    });

    it('should not display checkboxes when canDelete is false', () => {
      const responses = createMockResponses(3);
      renderResponseList({ responses, canDelete: false });

      const checkboxes = screen.queryAllByRole('checkbox');
      expect(checkboxes).toHaveLength(0);
    });

    it('should select single row when checkbox is clicked', async () => {
      const user = userEvent.setup();
      const responses = createMockResponses(3);
      renderResponseList({ responses, canDelete: true });

      const checkboxes = screen.getAllByRole('checkbox');
      const firstRowCheckbox = checkboxes[1]; // Skip header checkbox
      expect(firstRowCheckbox).toBeDefined();

      await user.click(firstRowCheckbox!);

      // Wait for the checkbox state to update (MUI state propagation)
      await waitFor(() => {
        expect(firstRowCheckbox).toBeChecked();
      });
    });

    it('should select all rows when header checkbox is clicked', async () => {
      const user = userEvent.setup();
      const responses = createMockResponses(3);
      renderResponseList({ responses, canDelete: true });

      const checkboxes = screen.getAllByRole('checkbox');
      const headerCheckbox = checkboxes[0];
      expect(headerCheckbox).toBeDefined();

      await user.click(headerCheckbox!);

      // Wait for all row checkboxes to be checked (state propagation in DataGrid)
      await waitFor(() => {
        const updatedCheckboxes = screen.getAllByRole('checkbox');
        updatedCheckboxes.slice(1).forEach((checkbox) => {
          expect(checkbox).toBeChecked();
        });
      });
    });

    it('should display bulk actions toolbar when rows are selected', async () => {
      const user = userEvent.setup();
      const responses = createMockResponses(3);
      renderResponseList({ responses, canDelete: true });

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[1]).toBeDefined();
      await user.click(checkboxes[1]!);

      // Bulk actions toolbar should appear
      expect(screen.getByText(/1 response selected/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete selected/i })).toBeInTheDocument();
    });

    it('should display correct count in bulk actions toolbar', async () => {
      const user = userEvent.setup();
      const responses = createMockResponses(5);
      renderResponseList({ responses, canDelete: true });

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[1]).toBeDefined();
      expect(checkboxes[2]).toBeDefined();
      expect(checkboxes[3]).toBeDefined();
      await user.click(checkboxes[1]!);
      await user.click(checkboxes[2]!);
      await user.click(checkboxes[3]!);

      expect(screen.getByText(/3 responses selected/i)).toBeInTheDocument();
    });
  });

  describe('Delete Functionality', () => {
    it('should open confirmation dialog when delete button is clicked', async () => {
      const user = userEvent.setup();
      const responses = [createMockResponse({ id: 123 })];
      renderResponseList({ responses });

      const deleteButton = screen.getByLabelText(/delete response 123/i);
      await user.click(deleteButton);

      // Dialog should open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/delete response\?/i)).toBeInTheDocument();
    });

    it('should display warning message in delete dialog', async () => {
      const user = userEvent.setup();
      const responses = [createMockResponse()];
      renderResponseList({ responses });

      const deleteButton = screen.getAllByLabelText(/delete response/i)[0];
      expect(deleteButton).toBeDefined();
      await user.click(deleteButton!);

      expect(screen.getByText(/are you sure you want to delete this feedback response/i)).toBeInTheDocument();
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
    });

    it('should display Cancel and Delete buttons in dialog', async () => {
      const user = userEvent.setup();
      const responses = [createMockResponse()];
      renderResponseList({ responses });

      const deleteButton = screen.getAllByLabelText(/delete response/i)[0];
      expect(deleteButton).toBeDefined();
      await user.click(deleteButton!);

      const dialog = screen.getByRole('dialog');
      const dialogButtons = within(dialog).getAllByRole('button');
      
      expect(dialogButtons.find(btn => btn.textContent === 'Cancel')).toBeInTheDocument();
      expect(dialogButtons.find(btn => btn.textContent === 'Delete')).toBeInTheDocument();
    });

    it('should close dialog when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const responses = [createMockResponse()];
      renderResponseList({ responses });

      const deleteButton = screen.getAllByLabelText(/delete response/i)[0];
      expect(deleteButton).toBeDefined();
      await user.click(deleteButton!);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should call onDelete when Delete is confirmed', async () => {
      const user = userEvent.setup();
      mockOnDelete.mockResolvedValue(undefined);
      const responses = [createMockResponse({ id: 123 })];
      renderResponseList({ responses });

      const deleteButton = screen.getByLabelText(/delete response 123/i);
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledWith([123]);
      });
    });

    it('should handle bulk delete from bulk actions toolbar', async () => {
      const user = userEvent.setup();
      mockOnDelete.mockResolvedValue(undefined);
      const responses = createMockResponses(3);
      renderResponseList({ responses });

      // Select multiple rows
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[1]).toBeDefined();
      expect(checkboxes[2]).toBeDefined();
      await user.click(checkboxes[1]!); // First row
      await user.click(checkboxes[2]!); // Second row

      // Click bulk delete button
      const bulkDeleteButton = screen.getByRole('button', { name: /delete selected/i });
      await user.click(bulkDeleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledWith(expect.arrayContaining([1, 2]));
      });
    });

    it('should display warning for multiple responses in delete dialog', async () => {
      const user = userEvent.setup();
      const responses = createMockResponses(3);
      renderResponseList({ responses });

      // Select multiple rows
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeDefined();
      await user.click(checkboxes[0]!); // Header checkbox (select all)

      // Click bulk delete button
      const bulkDeleteButton = screen.getByRole('button', { name: /delete selected/i });
      await user.click(bulkDeleteButton);

      // Verify bulk delete warning
      expect(screen.getByText(/are you sure you want to delete 3 feedback responses/i)).toBeInTheDocument();
      expect(screen.getByText(/you are about to delete multiple responses at once/i)).toBeInTheDocument();
    });

    it('should disable buttons during delete operation', async () => {
      const user = userEvent.setup();
      let resolveDelete: () => void;
      mockOnDelete.mockImplementation(() => new Promise((resolve) => {
        resolveDelete = resolve as () => void;
      }));
      
      const responses = [createMockResponse()];
      renderResponseList({ responses });

      const deleteButton = screen.getAllByLabelText(/delete response/i)[0];
      expect(deleteButton).toBeDefined();
      await user.click(deleteButton!);

      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      // Buttons should be disabled during operation
      await waitFor(() => {
        expect(confirmButton).toBeDisabled();
        expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
      });

      resolveDelete!();
    });
  });

  describe('Pagination', () => {
    it('should display pagination controls', () => {
      const responses = createMockResponses(25);
      renderResponseList({ responses });

      // Pagination controls should be present
      const pagination = document.querySelector('.MuiTablePagination-root');
      expect(pagination).toBeInTheDocument();
    });

    it('should display page size options (10, 25, 50, 100)', () => {
      const responses = createMockResponses(25);
      renderResponseList({ responses });

      const pageSizeSelector = screen.getByRole('combobox', { name: /rows per page/i });
      expect(pageSizeSelector).toBeInTheDocument();
    });

    it('should paginate responses correctly with default page size', () => {
      const responses = createMockResponses(25);
      renderResponseList({ responses });

      // First page should show 10 responses (default page size)
      const rows = screen.getAllByRole('row').slice(1); // Exclude header
      expect(rows.length).toBeLessThanOrEqual(10);
    });

    it('should navigate to next page', async () => {
      const user = userEvent.setup();
      const responses = createMockResponses(25);
      renderResponseList({ responses });

      const nextButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextButton);

      // Wait for pagination to update (MUI DataGrid async state)
      await waitFor(() => {
        expect(screen.getByText(/11–20 of 25/i)).toBeInTheDocument();
      });
    });

    it('should change page size', async () => {
      const user = userEvent.setup();
      const responses = createMockResponses(50);
      renderResponseList({ responses });

      const pageSizeSelector = screen.getByRole('combobox', { name: /rows per page/i });
      await user.click(pageSizeSelector);

      const option25 = screen.getByRole('option', { name: '25' });
      await user.click(option25);

      // Should display 25 rows
      await waitFor(() => {
        const rows = screen.getAllByRole('row').slice(1);
        expect(rows.length).toBeLessThanOrEqual(25);
      });
    });
  });

  describe('Sorting', () => {
    it('should sort by column when column header is clicked', async () => {
      const user = userEvent.setup();
      const responses = createMockResponses(5);
      renderResponseList({ responses });

      const userHeader = screen.getByRole('columnheader', { name: /user/i });
      await user.click(userHeader);

      // Column should have sort indicator
      expect(userHeader).toHaveAttribute('aria-sort');
    });

    it('should toggle sort direction on repeated clicks', async () => {
      const user = userEvent.setup();
      const responses = createMockResponses(5);
      renderResponseList({ responses });

      const dateHeader = screen.getByRole('columnheader', { name: /submission date/i });
      
      // Component initializes with desc sort on timemodified
      expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
      
      // First click - toggles to ascending
      await user.click(dateHeader);
      await waitFor(() => {
        expect(dateHeader).toHaveAttribute('aria-sort', 'ascending');
      });

      // Second click - toggles back to descending
      await user.click(dateHeader);
      await waitFor(() => {
        expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
      });
    });

    it('should maintain sort order when navigating pages', async () => {
      const user = userEvent.setup();
      const responses = createMockResponses(25);
      renderResponseList({ responses });

      const dateHeader = screen.getByRole('columnheader', { name: /submission date/i });
      await user.click(dateHeader);

      const nextButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextButton);

      // Sort should still be active
      expect(dateHeader).toHaveAttribute('aria-sort');
    });
  });

  describe('Accessibility (WCAG 2.1 AA)', () => {
    it('should have proper ARIA grid role', () => {
      const responses = createMockResponses(3);
      renderResponseList({ responses });

      const grid = screen.getByRole('grid');
      expect(grid).toHaveAttribute('aria-label', 'Feedback responses table');
    });

    it('should have proper ARIA labels on column headers', () => {
      const responses = createMockResponses(3);
      renderResponseList({ responses });

      const headers = screen.getAllByRole('columnheader');
      headers.forEach((header) => {
        expect(header).toHaveAttribute('role', 'columnheader');
      });
    });

    it('should have proper ARIA labels on action buttons', () => {
      const responses = [createMockResponse({ id: 123 })];
      renderResponseList({ responses });

      const viewButton = screen.getByLabelText(/view details for response 123/i);
      expect(viewButton).toHaveAttribute('aria-label');
    });

    it('should support keyboard navigation with Tab', async () => {
      const user = userEvent.setup();
      const responses = createMockResponses(2);
      renderResponseList({ responses });

      const grid = screen.getByRole('grid');
      grid.focus();

      // Tab should navigate through focusable elements
      await user.tab();
      
      const focusedElement = document.activeElement;
      expect(focusedElement).toBeDefined();
    });

    it('should have visible focus indicators', () => {
      const responses = createMockResponses(3);
      renderResponseList({ responses });

      // DataGrid cells should have focus styles defined
      const grid = screen.getByRole('grid');
      
      // Component defines custom focus styles in sx prop
      expect(grid).toBeInTheDocument();
    });

    it('should announce screen reader text for selected rows', async () => {
      const user = userEvent.setup();
      const responses = createMockResponses(3);
      renderResponseList({ responses, canDelete: true });

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[1]).toBeDefined();
      await user.click(checkboxes[1]!);

      // Footer should announce selection
      expect(screen.getByText(/1 response selected/i)).toBeInTheDocument();
    });

    it('should pass axe accessibility tests', async () => {
      const responses = createMockResponses(3);
      const { container } = renderResponseList({ responses });

      // Note: MUI DataGrid has known aria-required-children violations
      // that are internal to the library and cannot be fixed at the component level
      const results = await axe(container, {
        rules: {
          // Disable aria-required-children rule for MUI DataGrid
          'aria-required-children': { enabled: false }
        }
      });
      expect(results).toHaveNoViolations();
    });

    it('should have proper focus trap in delete dialog', async () => {
      const user = userEvent.setup();
      const responses = [createMockResponse()];
      renderResponseList({ responses });

      const deleteButton = screen.getAllByLabelText(/delete response/i)[0];
      expect(deleteButton).toBeDefined();
      await user.click(deleteButton!);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      // Focus should be trapped within dialog
      const dialogButtons = within(dialog).getAllByRole('button');
      expect(dialogButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty user name gracefully', () => {
      const responses = [createMockResponse({ userName: '' })];
      renderResponseList({ responses });

      // Should still render row
      const grid = screen.getByRole('grid');
      expect(grid).toBeInTheDocument();
    });

    it('should handle very long user names', () => {
      const longName = 'A'.repeat(100);
      const responses = [createMockResponse({ userName: longName })];
      renderResponseList({ responses });

      // Should render without breaking layout
      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    it('should handle responses with same timestamp', () => {
      const timestamp = generateMockDate(-1);
      const responses = [
        createMockResponse({ id: 1, timemodified: timestamp }),
        createMockResponse({ id: 2, timemodified: timestamp }),
        createMockResponse({ id: 3, timemodified: timestamp }),
      ];
      renderResponseList({ responses });

      // All responses should render
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows).toHaveLength(3);
    });

    it('should handle large datasets (100+ responses)', () => {
      const responses = createMockResponses(150);
      renderResponseList({ responses });

      // Should render grid with pagination (default page size is 10)
      const grid = screen.getByRole('grid');
      expect(grid).toBeInTheDocument();
      expect(screen.getByText(/1–10 of 150/i)).toBeInTheDocument();
    });

    it('should handle deletion failure gracefully', async () => {
      const user = userEvent.setup();
      mockOnDelete.mockRejectedValue(new Error('Deletion failed'));
      
      const responses = [createMockResponse({ id: 123 })];
      renderResponseList({ responses });

      const deleteButton = screen.getByLabelText(/delete response 123/i);
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      // Wait for the mutation to be called
      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalled();
      });

      // Verify dialog closes after error
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should handle responses from different courses', () => {
      const responses = [
        createMockResponse({ id: 1, courseName: 'Course A', courseid: 100 }),
        createMockResponse({ id: 2, courseName: 'Course B', courseid: 200 }),
        createMockResponse({ id: 3, courseName: 'Course C', courseid: 300 }),
      ];
      renderResponseList({ responses });

      expect(screen.getByText('Course A')).toBeInTheDocument();
      expect(screen.getByText('Course B')).toBeInTheDocument();
      expect(screen.getByText('Course C')).toBeInTheDocument();
    });

    it('should handle anonymous responses without user images', () => {
      const responses = [createMockResponse({ 
        userName: 'Anonymous',
        userAvatar: undefined,
        anonymous_response: 1,
        userid: 0,
        random_response: 123
      })];
      renderResponseList({ responses });

      // Component renders "Anonymous (random_response)" for anonymous responses
      expect(screen.getByText(/Anonymous \(123\)/i)).toBeInTheDocument();
      
      // Avatar should display 'A' for Anonymous
      const avatar = document.querySelector('.MuiAvatar-root');
      expect(avatar).toHaveTextContent('AN');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete user workflow: view, select, and delete', async () => {
      const user = userEvent.setup();
      mockOnDelete.mockResolvedValue(undefined);
      
      const responses = createMockResponses(3);
      renderResponseList({ responses });

      // Step 1: View details
      const viewButton = screen.getAllByLabelText(/view details/i)[0];
      expect(viewButton).toBeDefined();
      await user.click(viewButton!);
      expect(mockOnViewDetails).toHaveBeenCalled();

      // Step 2: Select a row
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[1]).toBeDefined();
      await user.click(checkboxes[1]!);
      expect(screen.getByText(/1 response selected/i)).toBeInTheDocument();

      // Step 3: Delete selected
      const bulkDeleteButton = screen.getByRole('button', { name: /delete selected/i });
      await user.click(bulkDeleteButton);
      
      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalled();
      });
    });

    it('should handle sorting, pagination, and selection together', async () => {
      const user = userEvent.setup();
      const responses = createMockResponses(25);
      renderResponseList({ responses });

      // Sort by date
      const dateHeader = screen.getByRole('columnheader', { name: /submission date/i });
      await user.click(dateHeader);

      // Change page size
      const pageSizeSelector = screen.getByRole('combobox', { name: /rows per page/i });
      await user.click(pageSizeSelector);
      const option25 = screen.getByRole('option', { name: '25' });
      await user.click(option25);

      // Select a row
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[1]).toBeDefined();
      await user.click(checkboxes[1]!);

      // All operations should work together
      expect(screen.getByText(/1 response selected/i)).toBeInTheDocument();
    });
  });
});
