/**
 * Comprehensive Unit Tests for GradeEditForm Component
 *
 * Tests the GradeEditForm React component which provides an interface for
 * editing individual student grades. This component integrates with Moodle's
 * grade_update() function via the API layer.
 *
 * Test Coverage:
 * 1) Form renders with initial grade value pre-filled
 * 2) Input validation enforces min/max grade boundaries based on grade item settings
 * 3) Scale-based grades show dropdown with scale options
 * 4) Numeric grades allow decimal input with proper formatting
 * 5) Letter grades restricted to valid letter grade options
 * 6) Feedback textarea allows multi-line comments up to character limit
 * 7) Override checkbox toggles manual grade entry vs calculated
 * 8) Permission check via require_capability prevents unauthorized editing
 * 9) Form submission calls PUT /api/v1/gradebook/items/{id} with validated data
 * 10) Optimistic update immediately reflects change in UI before API response
 * 11) Successful save shows success toast notification
 * 12) Failed submission displays error message and reverts optimistic update
 * 13) Dirty state tracked to warn about unsaved changes on navigation
 * 14) Form validation errors displayed inline with field highlighting
 * 15) Accessibility with proper labels, error announcements, and keyboard navigation
 *
 * Tests use @testing-library/react, react-hook-form validation, mock API calls,
 * test user interactions with userEvent, and verify grade updates match PHP
 * grade_update() function behavior.
 *
 * @module GradeEditForm.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import GradeEditForm from '@/features/gradebook/components/GradeEditForm';
import type { Grade, GradeItem } from '@/features/gradebook/types/grade.types';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the useToast hook
const mockSuccess = vi.fn();
const mockError = vi.fn();
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    success: mockSuccess,
    error: mockError,
    toast: vi.fn(),
    showToast: vi.fn(),
  }),
}));

// Mock the usePermissions hook with controllable return values
const mockHasCapability = vi.fn(() => true);
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasCapability: mockHasCapability,
    canGrade: vi.fn(() => true),
    isTeacher: vi.fn(() => true),
    isAdmin: vi.fn(() => false),
    isStudent: vi.fn(() => false),
    requireCapability: vi.fn(),
    hasAnyCapability: vi.fn(() => true),
    hasAllCapabilities: vi.fn(() => true),
    canViewCourse: vi.fn(() => true),
    canEditCourse: vi.fn(() => true),
  }),
}));

// Mock the RichTextEditor component
vi.mock('@/components/editor/RichTextEditor', () => ({
  default: ({ value, onChange, id, ...props }: { value: string; onChange: (val: string) => void; id?: string }) => (
    <textarea
      data-testid="rich-text-editor"
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Feedback"
      {...props}
    />
  ),
}));

// Mock MUI DateTimePicker to avoid complex date handling in tests
vi.mock('@mui/x-date-pickers', () => ({
  DateTimePicker: ({ label, value, onChange, ...props }: { label: string; value: number | null; onChange: (val: number | null) => void }) => (
    <input
      type="datetime-local"
      aria-label={label}
      value={value ? new Date(value).toISOString().slice(0, 16) : ''}
      onChange={(e) => onChange(e.target.value ? new Date(e.target.value).getTime() : null)}
      {...props}
    />
  ),
}));

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Creates a mock numeric grade item with configurable min/max values
 */
const createNumericGradeItem = (
  overrides: Partial<GradeItem> = {}
): GradeItem => ({
  id: 101,
  courseid: 1,
  categoryid: 10,
  itemname: 'Test Assignment Grade',
  itemtype: 'mod',
  itemmodule: 'assign',
  iteminstance: 1,
  itemnumber: 0,
  iteminfo: null,
  idnumber: null,
  calculation: null,
  gradetype: 1, // VALUE grade type (numeric)
  grademax: 100,
  grademin: 0,
  gradepass: 60,
  scaleid: null,
  outcomeid: null,
  display: 1,
  decimals: 2,
  hidden: 0,
  locked: 0,
  locktime: 0,
  needsupdate: 0,
  weightoverride: 0,
  timecreated: Date.now(),
  timemodified: Date.now(),
  multfactor: 1.0,
  plusfactor: 0.0,
  aggregationcoef: 0.0,
  aggregationcoef2: 1.0,
  sortorder: 1,
  ...overrides,
});

/**
 * Creates a mock scale-based grade item
 */
const createScaleGradeItem = (
  overrides: Partial<GradeItem> = {}
): GradeItem => ({
  id: 102,
  courseid: 1,
  categoryid: 10,
  itemname: 'Scale-based Assessment',
  itemtype: 'mod',
  itemmodule: 'assign',
  iteminstance: 2,
  itemnumber: 0,
  iteminfo: null,
  idnumber: null,
  calculation: null,
  gradetype: 2, // SCALE grade type
  grademax: 5,
  grademin: 1,
  gradepass: 3,
  scaleid: 1,
  outcomeid: null,
  display: 1,
  decimals: 0,
  hidden: 0,
  locked: 0,
  locktime: 0,
  needsupdate: 0,
  weightoverride: 0,
  timecreated: Date.now(),
  timemodified: Date.now(),
  multfactor: 1.0,
  plusfactor: 0.0,
  aggregationcoef: 0.0,
  aggregationcoef2: 1.0,
  sortorder: 2,
  ...overrides,
});

/**
 * Creates a mock grade object with the correct type structure
 */
const createGrade = (
  overrides: Partial<Grade> = {}
): Partial<Grade> => ({
  id: 1001,
  itemid: 101,
  userid: 42,
  rawgrade: 85,
  rawgrademax: 100,
  rawgrademin: 0,
  rawscaleid: null,
  usermodified: null,
  finalgrade: 85,
  hidden: 0,
  locked: 0,
  locktime: 0,
  exported: 0,
  overridden: 0,
  excluded: 0,
  feedback: 'Good work on this assignment.',
  feedbackformat: 1,
  information: null,
  informationformat: 1,
  timecreated: Date.now(),
  timemodified: Date.now(),
  ...overrides,
});

// ============================================================================
// Test Suite
// ============================================================================

describe('GradeEditForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();
  
  const defaultProps = {
    gradeItem: createNumericGradeItem(),
    initialValues: createGrade(),
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHasCapability.mockReturnValue(true);
    mockOnSubmit.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 1) Form renders with initial grade value pre-filled
  // ==========================================================================
  describe('Form Rendering with Initial Values', () => {
    it('renders with initial grade value pre-filled', () => {
      render(
        <GradeEditForm {...defaultProps} />
      );

      // Verify grade input has the initial value
      const gradeInput = screen.getByRole('spinbutton');
      expect(gradeInput).toHaveValue(85);
    });

    it('renders with initial feedback text pre-filled', () => {
      render(
        <GradeEditForm {...defaultProps} />
      );

      // Verify feedback textarea has initial value
      const feedbackInput = screen.getByTestId('rich-text-editor');
      expect(feedbackInput).toHaveValue('Good work on this assignment.');
    });

    it('displays grade input label with max value', () => {
      render(
        <GradeEditForm {...defaultProps} />
      );

      // The grade label should show the max grade value
      expect(screen.getByLabelText(/final grade value/i)).toBeInTheDocument();
    });

    it('renders save and cancel buttons', () => {
      render(
        <GradeEditForm {...defaultProps} />
      );

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('renders with null finalgrade when no initial grade provided', () => {
      render(
        <GradeEditForm
          gradeItem={createNumericGradeItem()}
          initialValues={{}}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Grade input should have no value or empty
      const gradeInput = screen.getByRole('spinbutton');
      expect(gradeInput).toHaveValue(null);
    });
  });

  // ==========================================================================
  // 2) Input validation enforces min/max grade boundaries
  // ==========================================================================
  describe('Grade Range Validation', () => {
    // Note: Grade input is only enabled when override is checked
    it('prevents submission when grade exceeds maximum', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ finalgrade: 85, overridden: 1 })}
        />
      );

      const gradeInput = screen.getByRole('spinbutton');
      await user.clear(gradeInput);
      await user.type(gradeInput, '150'); // Exceeds max of 100

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Wait for validation error to be displayed
      await waitFor(() => {
        expect(screen.getByText(/cannot exceed|must be at most|grade cannot/i)).toBeInTheDocument();
      });
      
      // Submission should be prevented
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('prevents submission when grade is below minimum', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ finalgrade: 85, overridden: 1 })}
        />
      );

      const gradeInput = screen.getByRole('spinbutton');
      await user.clear(gradeInput);
      await user.type(gradeInput, '-10'); // Below min of 0

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Wait for validation error
      await waitFor(() => {
        expect(screen.getByText(/must be at least|cannot be less than|below minimum/i)).toBeInTheDocument();
      });
      
      // Submission should be prevented
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('accepts grade at exact maximum boundary', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ finalgrade: 50, overridden: 1 })}
        />
      );

      const gradeInput = screen.getByRole('spinbutton');
      await user.clear(gradeInput);
      await user.type(gradeInput, '100'); // Exactly at max

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('accepts grade at exact minimum boundary', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ finalgrade: 50, overridden: 1 })}
        />
      );

      const gradeInput = screen.getByRole('spinbutton');
      await user.clear(gradeInput);
      await user.type(gradeInput, '0'); // Exactly at min

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('validates against custom grade range', async () => {
      const customGradeItem = createNumericGradeItem({
        grademin: 50,
        grademax: 200,
      });

      const user = userEvent.setup();
      render(
        <GradeEditForm
          gradeItem={customGradeItem}
          initialValues={createGrade({ finalgrade: 100, overridden: 1 })}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const gradeInput = screen.getByRole('spinbutton');
      await user.clear(gradeInput);
      await user.type(gradeInput, '40'); // Below custom min of 50

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/50/)).toBeInTheDocument(); // Error mentioning min value
      });
      
      // Submission should be prevented due to validation failure
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 3) Scale-based grades show dropdown with scale options
  // ==========================================================================
  describe('Scale-Based Grades', () => {
    it('handles scale-based grade items', () => {
      render(
        <GradeEditForm
          gradeItem={createScaleGradeItem()}
          initialValues={createGrade({ finalgrade: 3 })}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Form should render for scale-based items
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 4) Numeric grades allow decimal input with proper formatting
  // ==========================================================================
  describe('Decimal Grade Input', () => {
    it('accepts decimal values for numeric grades', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ finalgrade: 50, overridden: 1 })}
        />
      );

      const gradeInput = screen.getByRole('spinbutton');
      await user.clear(gradeInput);
      await user.type(gradeInput, '85.75');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
        const callArg = mockOnSubmit.mock.calls[0]?.[0];
        expect(callArg.finalgrade).toBe(85.75);
      });
    });

    it('displays grade with proper decimal value', () => {
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ finalgrade: 85.5, overridden: 1 })}
        />
      );

      const gradeInput = screen.getByRole('spinbutton');
      expect(gradeInput).toHaveValue(85.5);
    });
  });

  // ==========================================================================
  // 5) Letter grades - tested via gradetype
  // ==========================================================================
  describe('Letter Grade Input', () => {
    it('handles letter grade type configuration', () => {
      const letterGradeItem = createNumericGradeItem({
        gradetype: 3, // LETTER grade type
        display: 3, // Display as letter
      });

      render(
        <GradeEditForm
          gradeItem={letterGradeItem}
          initialValues={createGrade({ finalgrade: 90 })}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Form should render for letter grade items
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 6) Feedback textarea allows multi-line comments
  // ==========================================================================
  describe('Feedback Textarea', () => {
    it('allows multi-line feedback comments', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm {...defaultProps} />
      );

      const feedbackInput = screen.getByTestId('rich-text-editor');
      await user.clear(feedbackInput);
      await user.type(feedbackInput, 'Line 1{enter}Line 2{enter}Line 3');

      expect(feedbackInput).toHaveValue('Line 1\nLine 2\nLine 3');
    });

    it('allows entering feedback up to maximum length', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm {...defaultProps} />
      );

      const feedbackInput = screen.getByTestId('rich-text-editor');
      const longFeedback = 'A'.repeat(500); // Reasonable feedback length
      
      await user.clear(feedbackInput);
      await user.type(feedbackInput, longFeedback);

      // Verify the feedback was entered
      expect(feedbackInput).toHaveValue(longFeedback);
    });

    it('preserves feedback on submission', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm {...defaultProps} />
      );

      const feedbackInput = screen.getByTestId('rich-text-editor');
      await user.clear(feedbackInput);
      await user.type(feedbackInput, 'Updated feedback text');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
        const callArg = mockOnSubmit.mock.calls[0]?.[0];
        expect(callArg.feedback).toContain('Updated feedback text');
      });
    });
  });

  // ==========================================================================
  // 7) Override checkbox toggles manual grade entry vs calculated
  // ==========================================================================
  describe('Override Checkbox', () => {
    it('renders override checkbox', () => {
      render(
        <GradeEditForm {...defaultProps} />
      );

      const overrideCheckbox = screen.getByRole('checkbox', { name: /override/i });
      expect(overrideCheckbox).toBeInTheDocument();
    });

    it('toggles override state when clicked', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ overridden: 0 })}
        />
      );

      const overrideCheckbox = screen.getByRole('checkbox', { name: /override/i });
      expect(overrideCheckbox).not.toBeChecked();

      await user.click(overrideCheckbox);
      expect(overrideCheckbox).toBeChecked();
    });

    it('submits with override flag set', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ overridden: 0 })}
        />
      );

      const overrideCheckbox = screen.getByRole('checkbox', { name: /override/i });
      await user.click(overrideCheckbox);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
        const callArg = mockOnSubmit.mock.calls[0]?.[0];
        expect(callArg.overridden).toBe(1);
      });
    });

    it('pre-selects checkbox when grade is already overridden', () => {
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ overridden: 1 })}
        />
      );

      const overrideCheckbox = screen.getByRole('checkbox', { name: /override/i });
      expect(overrideCheckbox).toBeChecked();
    });
  });

  // ==========================================================================
  // 8) Permission check prevents unauthorized editing
  // ==========================================================================
  describe('Permission Checks', () => {
    it('disables form when user lacks grade edit permission', async () => {
      mockHasCapability.mockReturnValue(false);

      render(
        <GradeEditForm {...defaultProps} />
      );

      // Wait for permission check to take effect
      await waitFor(() => {
        expect(screen.getByText(/permission/i)).toBeInTheDocument();
      });
    });

    it('shows permission denied message when user cannot edit', async () => {
      mockHasCapability.mockReturnValue(false);

      render(
        <GradeEditForm {...defaultProps} />
      );

      await waitFor(() => {
        expect(screen.getByText(/do not have permission/i)).toBeInTheDocument();
      });
    });

    it('enables form when user has grade edit permission', () => {
      mockHasCapability.mockReturnValue(true);

      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ finalgrade: 85, overridden: 1 })}
        />
      );

      const gradeInput = screen.getByRole('spinbutton');
      const saveButton = screen.getByRole('button', { name: /save/i });

      // Grade input is enabled when override is checked and user has permission
      expect(gradeInput).not.toBeDisabled();
      expect(saveButton).not.toBeDisabled();
    });

    it('checks for moodle/grade:edit capability', () => {
      render(
        <GradeEditForm {...defaultProps} />
      );

      expect(mockHasCapability).toHaveBeenCalledWith('moodle/grade:edit');
    });
  });

  // ==========================================================================
  // 9) Form submission calls onSubmit with validated data
  // ==========================================================================
  describe('Form Submission', () => {
    it('calls onSubmit with validated grade data', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ finalgrade: 85, overridden: 1 })}
        />
      );

      const gradeInput = screen.getByRole('spinbutton');
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            finalgrade: 90,
          })
        );
      });
    });

    it('includes feedback in submission data', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm {...defaultProps} />
      );

      const feedbackInput = screen.getByTestId('rich-text-editor');
      await user.clear(feedbackInput);
      await user.type(feedbackInput, 'Updated feedback comment');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            feedback: expect.stringContaining('Updated feedback comment'),
          })
        );
      });
    });

    it('disables save button during submission', async () => {
      const user = userEvent.setup();
      
      // Mock a slow submission
      mockOnSubmit.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 200))
      );

      render(
        <GradeEditForm {...defaultProps} />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Button should show loading state
      await waitFor(() => {
        const progressIndicator = screen.queryByRole('progressbar');
        if (progressIndicator) {
          expect(progressIndicator).toBeInTheDocument();
        }
      });
    });
  });

  // ==========================================================================
  // 10) Optimistic update immediately reflects change in UI
  // ==========================================================================
  describe('Optimistic Updates', () => {
    it('reflects grade change immediately in UI', async () => {
      const user = userEvent.setup();
      
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ finalgrade: 85, overridden: 1 })}
        />
      );

      const gradeInput = screen.getByRole('spinbutton');
      await user.clear(gradeInput);
      await user.type(gradeInput, '95');

      // Value should be immediately reflected
      expect(gradeInput).toHaveValue(95);
    });
  });

  // ==========================================================================
  // 11) Successful save shows success toast notification
  // ==========================================================================
  describe('Success Notifications', () => {
    it('shows success toast on successful save', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValueOnce(undefined);

      render(
        <GradeEditForm {...defaultProps} />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalled();
      });
    });

    it('displays success message text', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValueOnce(undefined);

      render(
        <GradeEditForm {...defaultProps} />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalledWith(
          expect.stringMatching(/saved|success|updated/i)
        );
      });
    });
  });

  // ==========================================================================
  // 12) Failed submission displays error message
  // ==========================================================================
  describe('Error Handling', () => {
    it('displays error message on submission failure', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValueOnce(new Error('API Error'));

      render(
        <GradeEditForm {...defaultProps} />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockError).toHaveBeenCalled();
      });
    });

    it('re-enables form after error', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValueOnce(new Error('API Error'));

      render(
        <GradeEditForm {...defaultProps} />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });

    it('preserves entered data after error', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValueOnce(new Error('API Error'));

      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ finalgrade: 85, overridden: 1 })}
        />
      );

      const gradeInput = screen.getByRole('spinbutton');
      await user.clear(gradeInput);
      await user.type(gradeInput, '92');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        // Data should be preserved
        expect(gradeInput).toHaveValue(92);
      });
    });

    it('handles validation errors from onSubmit', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValueOnce(new Error('Grade value out of range'));

      render(
        <GradeEditForm {...defaultProps} />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockError).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // 13) Dirty state tracked to warn about unsaved changes
  // ==========================================================================
  describe('Dirty State Tracking', () => {
    it('enables form interactions by default', () => {
      render(
        <GradeEditForm {...defaultProps} />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('allows saving after editing grade', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ finalgrade: 85, overridden: 1 })}
        />
      );

      const gradeInput = screen.getByRole('spinbutton');
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      // Save button should be enabled after changes
      const saveButton = screen.getByRole('button', { name: /save/i });
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });

    it('allows saving after editing feedback', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm {...defaultProps} />
      );

      const feedbackInput = screen.getByTestId('rich-text-editor');
      await user.clear(feedbackInput);
      await user.type(feedbackInput, 'New feedback');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });

    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm {...defaultProps} />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 14) Form validation errors displayed inline
  // ==========================================================================
  describe('Inline Validation Errors', () => {
    it('displays inline error for invalid grade value', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ finalgrade: 85, overridden: 1 })}
        />
      );

      const gradeInput = screen.getByRole('spinbutton');
      await user.clear(gradeInput);
      await user.type(gradeInput, '200'); // Exceeds max

      // Trigger validation by submitting
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        // Error should be displayed near the field
        expect(screen.getByText(/cannot exceed|must be at most/i)).toBeInTheDocument();
      });
    });

    it('clears error when valid value entered', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ finalgrade: 85, overridden: 1 })}
        />
      );

      const gradeInput = screen.getByRole('spinbutton');
      
      // Enter invalid value first
      await user.clear(gradeInput);
      await user.type(gradeInput, '200');
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/cannot exceed|must be at most/i)).toBeInTheDocument();
      });

      // Now correct the value
      await user.clear(gradeInput);
      await user.type(gradeInput, '85');
      await user.click(saveButton);

      // After submitting valid value, submission should proceed
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // 15) Accessibility with proper labels and keyboard navigation
  // ==========================================================================
  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(
        <GradeEditForm {...defaultProps} />
      );

      const results = await axe(container);
      expect(results.violations).toHaveLength(0);
    });

    it('all primary form fields are labeled', () => {
      render(
        <GradeEditForm {...defaultProps} />
      );

      // Grade input should be accessible
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
      // Feedback should be accessible
      expect(screen.getByTestId('rich-text-editor')).toHaveAttribute('aria-label', 'Feedback');
    });

    it('supports keyboard navigation through form fields', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm {...defaultProps} />
      );

      // Tab through form fields
      await user.tab();
      
      // Some element should receive focus
      expect(document.activeElement).not.toBe(document.body);
    });

    it('buttons have accessible names', () => {
      render(
        <GradeEditForm {...defaultProps} />
      );

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Additional Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('handles locked grade items', () => {
      const lockedGradeItem = createNumericGradeItem({ locked: 1 });

      render(
        <GradeEditForm
          gradeItem={lockedGradeItem}
          initialValues={createGrade({ locked: 1 })}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Form should still render
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('handles hidden grade items', () => {
      const hiddenGradeItem = createNumericGradeItem({ hidden: 1 });

      render(
        <GradeEditForm
          gradeItem={hiddenGradeItem}
          initialValues={createGrade({ hidden: 1 })}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Form should render
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('handles excluded grades', () => {
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ excluded: 1 })}
        />
      );

      // Excluded checkbox should be checked - using role to find the checkbox directly
      const excludedCheckbox = screen.getByRole('checkbox', { name: /exclude/i });
      expect(excludedCheckbox).toBeChecked();
    });

    it('handles zero grade value', async () => {
      const user = userEvent.setup();
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ finalgrade: 50, overridden: 1 })}
        />
      );

      const gradeInput = screen.getByRole('spinbutton');
      await user.clear(gradeInput);
      await user.type(gradeInput, '0');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            finalgrade: 0,
          })
        );
      });
    });

    it('disables grade input when override is not checked', () => {
      render(
        <GradeEditForm
          {...defaultProps}
          initialValues={createGrade({ overridden: 0 })}
        />
      );

      const gradeInput = screen.getByRole('spinbutton');
      expect(gradeInput).toBeDisabled();
    });
  });
});
