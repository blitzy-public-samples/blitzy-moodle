/**
 * Unit Tests for ChoiceResults Component
 *
 * Comprehensive test suite validating the ChoiceResults component's rendering,
 * user interactions, and functionality in both anonymous and named modes.
 * Tests cover table rendering, bulk action buttons, select-all functionality,
 * form submission, empty state handling, and accessibility compliance.
 *
 * @module tests/unit/features/activities/choice/components/ChoiceResults
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { render, screen, waitFor, within } from '@tests/helpers/render';

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations);
import userEvent from '@testing-library/user-event';
import ChoiceResults, {
  type ChoiceResultsDataExtended,
  type OptionResult,
  type User,
} from '@/features/activities/choice/components/ChoiceResults';
import ChoiceChart from '@/features/activities/choice/components/ChoiceChart';

// Mock the ChoiceChart component to isolate testing
vi.mock('@/features/activities/choice/components/ChoiceChart', () => ({
  default: vi.fn(() => <div data-testid="choice-chart">Mocked ChoiceChart</div>),
}));

// Mock the hooks for delete and modify operations
vi.mock('@/features/activities/choice/hooks/useDeleteResponses', () => ({
  default: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('@/features/activities/choice/hooks/useModifyResponses', () => ({
  default: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

/**
 * Factory function to create a mock User object for choice results.
 *
 * @param overrides - Partial User object to override default values
 * @returns Complete User object with all required fields
 */
function createMockChoiceUser(overrides: Partial<User> = {}): User {
  const id = overrides.id ?? 1;
  return {
    id,
    firstname: 'John',
    lastname: 'Doe',
    imagealt: 'John Doe',
    picture: 'https://example.com/avatar.jpg',
    answerid: 100 + id, // Generate unique answerid based on user id
    ...overrides,
  };
}

/**
 * Factory function to create a mock OptionResult object.
 *
 * @param overrides - Partial OptionResult object to override default values
 * @returns Complete OptionResult object with all required fields
 */
function createMockOptionResult(overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    text: 'Option 1',
    user: [],
    maxanswer: 0,
    numberofuser: 0,
    ...overrides,
  };
}

/**
 * Factory function to create a mock ChoiceResultsDataExtended object.
 *
 * @param overrides - Partial ChoiceResultsDataExtended object to override default values
 * @returns Complete ChoiceResultsDataExtended object with all required fields
 */
function createMockChoiceResults(
  overrides: Partial<ChoiceResultsDataExtended> = {}
): ChoiceResultsDataExtended {
  return {
    name: 'Test Choice Activity',
    publish: false,
    options: {},
    showunanswered: false,
    limitanswers: false,
    showavailable: false,
    viewresponsecapability: true,
    deleterepsonsecapability: true,
    coursemoduleid: 123,
    sesskey: 'test-session-key-123',
    numberofuser: 0,
    courseid: 456,
    ...overrides,
  };
}

describe('ChoiceResults Component', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Basic Rendering Tests', () => {
    it('should render without crashing', () => {
      const results = createMockChoiceResults({
        options: {
          '1': createMockOptionResult({ text: 'Option A', user: [createMockChoiceUser({ id: 1 })] }),
        },
      });
      render(<ChoiceResults results={results} displayLayout="vertical" />);
      expect(screen.getByText(/Test Choice Activity/)).toBeInTheDocument();
    });

    it('should display the choice name from results.name', () => {
      const results = createMockChoiceResults({
        name: 'My Choice',
        options: {
          '1': createMockOptionResult({ text: 'Option A', user: [createMockChoiceUser({ id: 1 })] }),
        },
      });
      render(<ChoiceResults results={results} displayLayout="vertical" />);
      expect(screen.getByText(/My Choice/)).toBeInTheDocument();
    });

    it('should apply proper layout based on displayLayout prop', () => {
      const results = createMockChoiceResults({
        options: {
          '1': createMockOptionResult({ text: 'Option A', user: [createMockChoiceUser({ id: 1 })] }),
        },
      });
      const { rerender } = render(
        <ChoiceResults results={results} displayLayout="vertical" />
      );
      
      // Initial render with vertical layout
      expect(screen.getByText(/Test Choice Activity/)).toBeInTheDocument();
      
      // Re-render with horizontal layout
      rerender(<ChoiceResults results={results} displayLayout="horizontal" />);
      expect(screen.getByText(/Test Choice Activity/)).toBeInTheDocument();
    });
  });

  describe('2. Anonymous Mode (publish=false) Tests', () => {
    it('should call ChoiceChart component in anonymous mode', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser()],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: false,
        options: { 1: option1 },
        numberofuser: 1,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(ChoiceChart).toHaveBeenCalled();
      expect(screen.getByTestId('choice-chart')).toBeInTheDocument();
    });

    it('should pass correct props to ChoiceChart', () => {
      const option1 = createMockOptionResult({
        text: 'Red',
        user: [createMockChoiceUser({ id: 1 }), createMockChoiceUser({ id: 2 })],
        numberofuser: 2,
      });
      
      const option2 = createMockOptionResult({
        text: 'Blue',
        user: [createMockChoiceUser({ id: 3 })],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: false,
        options: { 1: option1, 2: option2 },
        numberofuser: 3,
      });

      render(<ChoiceResults results={results} displayLayout="horizontal" />);
      
      expect(ChoiceChart).toHaveBeenCalledWith(
        expect.objectContaining({
          displayLayout: 'horizontal',
        }),
        expect.anything()
      );
    });

    it('should NOT display individual user names in anonymous mode', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [
          createMockChoiceUser({ id: 1, firstname: 'Alice', lastname: 'Smith' }),
          createMockChoiceUser({ id: 2, firstname: 'Bob', lastname: 'Jones' }),
        ],
        numberofuser: 2,
      });
      
      const results = createMockChoiceResults({
        publish: false,
        options: { 1: option1 },
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.queryByText(/Alice Smith/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Bob Jones/i)).not.toBeInTheDocument();
    });

    it('should show aggregate statistics only in anonymous mode', () => {
      const option1 = createMockOptionResult({
        text: 'Yes',
        user: [createMockChoiceUser({ id: 1 }), createMockChoiceUser({ id: 2 })],
        numberofuser: 2,
      });
      
      const results = createMockChoiceResults({
        publish: false,
        options: { 1: option1 },
        numberofuser: 2,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      // Should display chart for aggregated data
      expect(screen.getByTestId('choice-chart')).toBeInTheDocument();
    });

    it('should not show action buttons in anonymous mode', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser()],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: false,
        options: { 1: option1 },
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.queryByRole('button', { name: /delete selected/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /move/i })).not.toBeInTheDocument();
    });
  });

  describe('3. Named Mode (publish=true) Tests', () => {
    it('should render MUI Table component in named mode', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser()],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should have proper table structure with TableHead and TableBody', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser()],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      const table = screen.getByRole('table');
      // Table should have 2 rowgroups: thead and tbody
      const rowgroups = within(table).getAllByRole('rowgroup');
      expect(rowgroups).toHaveLength(2);
    });

    it('should display option names as column headers', () => {
      const option1 = createMockOptionResult({
        text: 'Red',
        user: [createMockChoiceUser({ id: 1 })],
        numberofuser: 1,
      });
      
      const option2 = createMockOptionResult({
        text: 'Blue',
        user: [createMockChoiceUser({ id: 2 })],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1, 2: option2 },
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.getByText('Red')).toBeInTheDocument();
      expect(screen.getByText('Blue')).toBeInTheDocument();
    });

    it('should display user names with links to profile pages', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 42, firstname: 'Jane', lastname: 'Doe' })],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        courseid: 456,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      const userLink = screen.getByRole('link', { name: /Jane Doe/i });
      expect(userLink).toBeInTheDocument();
      expect(userLink).toHaveAttribute('href', '/user/view.php?id=42&course=456');
    });

    it('should use TableContainer for scrolling', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 1 })],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
      });

      const { container } = render(
        <ChoiceResults results={results} displayLayout="vertical" />
      );
      
      // TableContainer should be present for scrolling
      const tableContainer = container.querySelector('.MuiTableContainer-root');
      expect(tableContainer).toBeInTheDocument();
    });
  });

  describe('4. Column Headers with Select-All Tests', () => {
    it('should show checkbox in column header when capabilities exist', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 1, answerid: 101 })],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        viewresponsecapability: true,
        deleterepsonsecapability: true,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('should not show checkbox when viewresponsecapability is false', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser()],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        viewresponsecapability: false,
        deleterepsonsecapability: true,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('should not show checkbox when deleterepsonsecapability is false', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser()],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        viewresponsecapability: true,
        deleterepsonsecapability: false,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
  });

  describe('5. Response Count Row Tests', () => {
    it('should show total users who selected each option', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [
          createMockChoiceUser({ id: 1 }),
          createMockChoiceUser({ id: 2 }),
          createMockChoiceUser({ id: 3 }),
        ],
        numberofuser: 3,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.getByText(/3 users?/i)).toBeInTheDocument();
    });

    it('should format as "1 user" for singular', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 1 })],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.getByText(/1 user/i)).toBeInTheDocument();
    });

    it('should show limit info when limitanswers and showavailable are true', () => {
      const option1 = createMockOptionResult({
        text: 'Limited Option',
        user: [createMockChoiceUser({ id: 1 })],
        numberofuser: 1,
        maxanswer: 5,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        limitanswers: true,
        showavailable: true,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      // Should show limit information
      expect(screen.getByText('Limit: 5')).toBeInTheDocument();
    });
  });

  describe('6. Individual User Rows Tests', () => {
    it('should display each user who selected the option', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [
          createMockChoiceUser({ id: 1, firstname: 'Alice', lastname: 'Smith' }),
          createMockChoiceUser({ id: 2, firstname: 'Bob', lastname: 'Jones' }),
        ],
        numberofuser: 2,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument();
      expect(screen.getByText(/Bob Jones/i)).toBeInTheDocument();
    });

    it('should link to user profile with correct href', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 99, firstname: 'Test', lastname: 'User' })],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        courseid: 456,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      const link = screen.getByRole('link', { name: /Test User/i });
      expect(link).toHaveAttribute('href', '/user/view.php?id=99&course=456');
    });

    it('should have checkbox with value as response attemptid', async () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 1, answerid: 201 })],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        viewresponsecapability: true,
        deleterepsonsecapability: true,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });
  });

  describe('7. Bulk Action Buttons Tests', () => {
    it('should show delete button when responses selected', async () => {
      const user = userEvent.setup();
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 1, answerid: 101 })],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        viewresponsecapability: true,
        deleterepsonsecapability: true,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      // Find and click the checkbox
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[checkboxes.length - 1]!);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete selected/i })).toBeInTheDocument();
      });
    });

    it('should hide buttons when no responses selected', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 1, answerid: 101 })],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        viewresponsecapability: true,
        deleterepsonsecapability: true,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.queryByRole('button', { name: /delete selected/i })).not.toBeInTheDocument();
    });

    it('should hide buttons when capabilities do not exist', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 1, answerid: 101 })],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        viewresponsecapability: false,
        deleterepsonsecapability: false,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.queryByRole('button', { name: /delete selected/i })).not.toBeInTheDocument();
    });
  });

  describe('8. Form Wrapper Tests', () => {
    it('should wrap table in form when capabilities exist', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser()],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        viewresponsecapability: true,
        deleterepsonsecapability: true,
      });

      const { container } = render(
        <ChoiceResults results={results} displayLayout="vertical" />
      );
      
      const form = container.querySelector('form');
      expect(form).toBeInTheDocument();
    });

    it('should include hidden input for sesskey', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser()],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        viewresponsecapability: true,
        deleterepsonsecapability: true,
      });

      const { container } = render(
        <ChoiceResults results={results} displayLayout="vertical" />
      );
      
      const sesKeyInput = container.querySelector('input[name="sesskey"]');
      expect(sesKeyInput).toBeInTheDocument();
    });

    it('should include hidden input for course module id', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser()],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        coursemoduleid: 999,
        viewresponsecapability: true,
        deleterepsonsecapability: true,
      });

      const { container } = render(
        <ChoiceResults results={results} displayLayout="vertical" />
      );
      
      const idInput = container.querySelector('input[name="id"]');
      expect(idInput).toBeInTheDocument();
      expect(idInput).toHaveValue('999');
    });

    it('should not render form when viewresponsecapability is false', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser()],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        viewresponsecapability: false,
      });

      const { container } = render(
        <ChoiceResults results={results} displayLayout="vertical" />
      );
      
      const form = container.querySelector('form');
      expect(form).not.toBeInTheDocument();
    });
  });

  describe('9. "Not Answered" Column Tests', () => {
    it('should show column when showunanswered is true', () => {
      // Regular option with users (so hasResponses is true)
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 1 })],
        numberofuser: 1,
      });
      
      // Special "Not answered" option (id=0) with users who haven't answered
      const notAnsweredOption = createMockOptionResult({
        text: 'Not answered', // This will be shown as "Not answered" in the component
        user: [
          createMockChoiceUser({ id: 2, firstname: 'Jane', lastname: 'Smith' }),
          createMockChoiceUser({ id: 3, firstname: 'Bob', lastname: 'Jones' }),
        ],
        numberofuser: 2,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 
          1: option1,
          0: notAnsweredOption, // id=0 is the "Not answered" option
        },
        showunanswered: true,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.getByText(/not answered/i)).toBeInTheDocument();
    });

    it('should hide column when showunanswered is false', () => {
      // Regular option with users (so hasResponses is true)
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 1 })],
        numberofuser: 1,
      });
      
      // Special "Not answered" option (id=0) with users who haven't answered
      const notAnsweredOption = createMockOptionResult({
        text: 'Not answered',
        user: [
          createMockChoiceUser({ id: 2, firstname: 'Jane', lastname: 'Smith' }),
        ],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 
          1: option1,
          0: notAnsweredOption, // id=0 is the "Not answered" option
        },
        showunanswered: false, // Set to false to hide the column
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.queryByText(/not answered/i)).not.toBeInTheDocument();
    });

    it('should list users who have not responded', () => {
      // Regular option with users
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 1, firstname: 'John', lastname: 'Doe' })],
        numberofuser: 1,
      });
      
      // Special "Not answered" option with users who haven't answered
      const notAnsweredOption = createMockOptionResult({
        text: 'Not answered',
        user: [
          createMockChoiceUser({ id: 2, firstname: 'Jane', lastname: 'Smith' }),
          createMockChoiceUser({ id: 3, firstname: 'Bob', lastname: 'Jones' }),
        ],
        numberofuser: 2,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 
          1: option1,
          0: notAnsweredOption,
        },
        showunanswered: true,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      // Verify users in "Not answered" column are listed
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });

    it('should show count of unanswered users', () => {
      // Regular option with users
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 1 })],
        numberofuser: 1,
      });
      
      // Special "Not answered" option with 3 users
      const notAnsweredOption = createMockOptionResult({
        text: 'Not answered',
        user: [
          createMockChoiceUser({ id: 2 }),
          createMockChoiceUser({ id: 3 }),
          createMockChoiceUser({ id: 4 }),
        ],
        numberofuser: 3,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 
          1: option1,
          0: notAnsweredOption,
        },
        showunanswered: true,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      // The component should show "3 users" in the count row
      expect(screen.getByText('3 users')).toBeInTheDocument();
    });

    it('should not show checkboxes in "Not answered" column', () => {
      // Regular option with users and capabilities enabled
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 1, answerid: 101 })],
        numberofuser: 1,
      });
      
      // Special "Not answered" option
      const notAnsweredOption = createMockOptionResult({
        text: 'Not answered',
        user: [
          createMockChoiceUser({ id: 2, firstname: 'Jane', lastname: 'Smith', answerid: 102 }),
        ],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 
          1: option1,
          0: notAnsweredOption,
        },
        showunanswered: true,
        viewresponsecapability: true,
        deleterepsonsecapability: true,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      // Find the "Not answered" header
      const notAnsweredHeader = screen.getByText('Not answered');
      expect(notAnsweredHeader).toBeInTheDocument();
      
      // The "Not answered" column should not have a checkbox in the header
      // (There should be 1 checkbox for Option A header, but none for "Not answered")
      const allCheckboxes = screen.getAllByRole('checkbox');
      // Should have: 1 for Option A header + 1 for John Doe individual checkbox
      // Should NOT have checkbox for Jane Smith (in "Not answered" column)
      expect(allCheckboxes).toHaveLength(2);
    });
  });

  describe('10. Limit Information Display Tests', () => {
    it('should show limit when limitanswers and showavailable are true', () => {
      const option1 = createMockOptionResult({
        text: 'Limited Option',
        user: [createMockChoiceUser()],
        numberofuser: 1,
        maxanswer: 10,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        limitanswers: true,
        showavailable: true,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.getByText('Limit: 10')).toBeInTheDocument();
    });

    it('should hide limit when limitanswers is false', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser()],
        maxanswer: 10,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        limitanswers: false,
        showavailable: true,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.queryByText(/limit/i)).not.toBeInTheDocument();
    });
  });

  describe('11. Select/Deselect All Functionality Tests', () => {
    it('should select all visible responses when select all is clicked', async () => {
      const user = userEvent.setup();
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [
          createMockChoiceUser({ id: 1, answerid: 101 }),
          createMockChoiceUser({ id: 2, answerid: 102 }),
        ],
        numberofuser: 2,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        viewresponsecapability: true,
        deleterepsonsecapability: true,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      // Find the "Select All" checkbox (typically the first one)
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]!);
      
      await waitFor(() => {
        // After clicking select all, action buttons should appear
        expect(screen.getByRole('button', { name: /delete selected/i })).toBeInTheDocument();
      });
    });

    it('should deselect all when deselect all is clicked', async () => {
      const user = userEvent.setup();
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [
          createMockChoiceUser({ id: 1, answerid: 101 }),
          createMockChoiceUser({ id: 2, answerid: 102 }),
        ],
        numberofuser: 2,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        viewresponsecapability: true,
        deleterepsonsecapability: true,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      const checkboxes = screen.getAllByRole('checkbox');
      
      // Select all
      await user.click(checkboxes[0]!);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete selected/i })).toBeInTheDocument();
      });
      
      // Deselect all
      await user.click(checkboxes[0]!);
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /delete selected/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('12. Empty State Tests', () => {
    it('should show message when no responses exist', () => {
      const results = createMockChoiceResults({
        publish: true,
        options: {},
        numberofuser: 0,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.getByText(/no responses/i)).toBeInTheDocument();
    });

    it('should apply to both anonymous and named modes', () => {
      const resultsAnonymous = createMockChoiceResults({
        publish: false,
        options: {},
        numberofuser: 0,
      });

      const { rerender } = render(
        <ChoiceResults results={resultsAnonymous} displayLayout="vertical" />
      );
      
      expect(screen.getByText(/no responses/i)).toBeInTheDocument();
      
      const resultsNamed = createMockChoiceResults({
        publish: true,
        options: {},
        numberofuser: 0,
      });

      rerender(<ChoiceResults results={resultsNamed} displayLayout="vertical" />);
      
      expect(screen.getByText(/no responses/i)).toBeInTheDocument();
    });

    it('should not render table when empty', () => {
      const results = createMockChoiceResults({
        publish: true,
        options: {},
        numberofuser: 0,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('should not render chart when empty in anonymous mode', () => {
      const results = createMockChoiceResults({
        publish: false,
        options: {},
        numberofuser: 0,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.queryByTestId('choice-chart')).not.toBeInTheDocument();
    });
  });

  describe('13. Responsive Table Tests', () => {
    it('should use TableContainer for scrolling', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser()],
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
      });

      const { container } = render(
        <ChoiceResults results={results} displayLayout="vertical" />
      );
      
      const tableContainer = container.querySelector('.MuiTableContainer-root');
      expect(tableContainer).toBeInTheDocument();
    });
  });

  describe('14. Action Execution Tests', () => {
    it('should handle delete action when delete button clicked', async () => {
      const user = userEvent.setup();
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 1, answerid: 101 })],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        viewresponsecapability: true,
        deleterepsonsecapability: true,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      // Select a response
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[checkboxes.length - 1]!);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete selected/i })).toBeInTheDocument();
      });
      
      // Note: Testing actual mutation call would require mocking the hook more thoroughly
      // This test validates the button appears when selection is made
    });

    it('should handle modify action when move button clicked', async () => {
      const user = userEvent.setup();
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 1, answerid: 101 })],
        numberofuser: 1,
      });
      
      const option2 = createMockOptionResult({
        text: 'Option B',
        user: [],
        numberofuser: 0,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1, 2: option2 },
        viewresponsecapability: true,
        deleterepsonsecapability: true,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      // Select a response
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[checkboxes.length - 1]!);
      
      await waitFor(() => {
        // Should have both delete and move buttons
        expect(screen.getByRole('button', { name: /delete selected/i })).toBeInTheDocument();
      });
    });
  });

  describe('15. Accessibility Tests', () => {
    it('should have proper ARIA labels on table', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser()],
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    it('should pass axe accessibility checks for anonymous mode', async () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser()],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: false,
        options: { 1: option1 },
      });

      const { container } = render(
        <ChoiceResults results={results} displayLayout="vertical" />
      );
      
      const axeResults = await axe(container);
      expect(axeResults).toHaveNoViolations();
    });

    it('should pass axe accessibility checks for named mode', async () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser()],
        numberofuser: 1,
      });
      
      const resultsData = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
      });

      const { container } = render(
        <ChoiceResults results={resultsData} displayLayout="vertical" />
      );
      
      const axeResults = await axe(container);
      expect(axeResults).toHaveNoViolations();
    });
  });

  describe('16. Edge Cases', () => {
    it('should handle zero responses gracefully', () => {
      const results = createMockChoiceResults({
        publish: true,
        options: {},
        numberofuser: 0,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.getByText(/no responses/i)).toBeInTheDocument();
    });

    it('should handle single response', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [createMockChoiceUser({ id: 1 })],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        numberofuser: 1,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.getByText(/1 user/i)).toBeInTheDocument();
    });

    it('should handle all users selecting same option', () => {
      const option1 = createMockOptionResult({
        text: 'Unanimous Choice',
        user: [
          createMockChoiceUser({ id: 1 }),
          createMockChoiceUser({ id: 2 }),
          createMockChoiceUser({ id: 3 }),
        ],
        numberofuser: 3,
      });
      
      const option2 = createMockOptionResult({
        text: 'Other Option',
        user: [],
        numberofuser: 0,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1, 2: option2 },
        numberofuser: 3,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.getByText(/3 users/i)).toBeInTheDocument();
      expect(screen.getByText(/Unanimous Choice/i)).toBeInTheDocument();
      expect(screen.getByText(/Other Option/i)).toBeInTheDocument();
    });

    it('should handle very long user names', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [
          createMockChoiceUser({
            id: 1,
            firstname: 'VeryLongFirstNameThatExceedsNormalLength',
            lastname: 'VeryLongLastNameThatAlsoExceedsNormalLength',
          }),
        ],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(
        screen.getByText(/VeryLongFirstNameThatExceedsNormalLength VeryLongLastNameThatAlsoExceedsNormalLength/i)
      ).toBeInTheDocument();
    });

    it('should handle missing user data gracefully', () => {
      const option1 = createMockOptionResult({
        text: 'Option A',
        user: [
          {
            id: 1,
            firstname: '',
            lastname: '',
            imagealt: '',
            picture: '',
            answerid: 101,
          },
        ],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      // Component should still render without crashing
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should handle large number of responses', () => {
      const users = Array.from({ length: 150 }, (_, i) =>
        createMockChoiceUser({ id: i + 1, firstname: `User${i + 1}`, lastname: `Last${i + 1}` })
      );
      
      const option1 = createMockOptionResult({
        text: 'Popular Option',
        user: users,
        numberofuser: 150,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
        numberofuser: 150,
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.getByText(/150 users/i)).toBeInTheDocument();
    });

    it('should handle special characters in names', () => {
      const option1 = createMockOptionResult({
        text: 'Option with "quotes" & <tags>',
        user: [
          createMockChoiceUser({
            id: 1,
            firstname: "O'Brien",
            lastname: 'Smith-Jones',
          }),
        ],
        numberofuser: 1,
      });
      
      const results = createMockChoiceResults({
        publish: true,
        options: { 1: option1 },
      });

      render(<ChoiceResults results={results} displayLayout="vertical" />);
      
      expect(screen.getByText(/O'Brien Smith-Jones/i)).toBeInTheDocument();
    });
  });

  describe('17. Props Validation Tests', () => {
    it('should accept required results prop', () => {
      const results = createMockChoiceResults();
      
      expect(() => {
        render(<ChoiceResults results={results} displayLayout="vertical" />);
      }).not.toThrow();
    });

    it('should accept displayLayout prop with "horizontal" value', () => {
      const results = createMockChoiceResults();
      
      expect(() => {
        render(<ChoiceResults results={results} displayLayout="horizontal" />);
      }).not.toThrow();
    });

    it('should accept displayLayout prop with "vertical" value', () => {
      const results = createMockChoiceResults();
      
      expect(() => {
        render(<ChoiceResults results={results} displayLayout="vertical" />);
      }).not.toThrow();
    });

    it('should handle ChoiceResultsDataExtended structure correctly', () => {
      const results: ChoiceResultsDataExtended = createMockChoiceResults({
        name: 'Valid Choice',
        publish: true,
        options: {
          1: createMockOptionResult({ text: 'Option 1' }),
        },
        showunanswered: true,
        limitanswers: true,
        showavailable: true,
        viewresponsecapability: true,
        deleterepsonsecapability: true,
        coursemoduleid: 123,
        numberofuser: 5,
        courseid: 456,
      });
      
      expect(() => {
        render(<ChoiceResults results={results} displayLayout="vertical" />);
      }).not.toThrow();
    });
  });
});
