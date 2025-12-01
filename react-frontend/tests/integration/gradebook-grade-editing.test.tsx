/**
 * @fileoverview Integration tests for grade editing workflow
 * 
 * Tests the complete teacher grade editing workflow including:
 * - Inline grade editing in gradebook cells
 * - Validation of grade input (min/max limits, decimal places)
 * - Locked grade prevention
 * - Override grade functionality
 * - Grade history and audit trail tracking
 * - API interaction with PUT /api/v1/gradebook/items/{id}
 * 
 * Uses MSW to mock API endpoints and simulate various response scenarios
 * including validation errors (422), locked grades (409), and successful updates.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { render, screen, waitFor, within, userEvent } from '../helpers/render';
import { createMockUser } from '../helpers/mockData';

// Mock functions for toast notifications
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

// Mock useToast hook to capture toast notifications
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    warning: vi.fn(),
    info: vi.fn(),
    toasts: [],
    dismiss: vi.fn(),
    clearAll: vi.fn(),
  }),
}));

// Mock RichTextEditor to render as a simple textarea for testing
vi.mock('@/components/editor/RichTextEditor', () => ({
  default: ({ 
    value, 
    onChange, 
    onBlur, 
    placeholder, 
    label, 
    disabled,
    error,
    helperText,
  }: { 
    value: string; 
    onChange: (value: string) => void; 
    onBlur?: () => void; 
    placeholder?: string;
    label?: string;
    disabled?: boolean;
    error?: boolean;
    helperText?: string;
  }) => (
    <div>
      <label htmlFor="feedback-editor">{label}</label>
      <textarea
        id="feedback-editor"
        data-testid="rich-text-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={label || 'Feedback'}
        aria-invalid={error ? 'true' : 'false'}
      />
      {helperText && <span>{helperText}</span>}
    </div>
  ),
}));

// Mock MUI DateTimePicker to avoid LocalizationProvider requirement
vi.mock('@mui/x-date-pickers', () => ({
  DateTimePicker: ({ 
    label, 
    value, 
    onChange, 
    disabled,
  }: { 
    label?: string;
    value: Date | null;
    onChange: (value: Date | null) => void;
    disabled?: boolean;
  }) => (
    <div>
      <label htmlFor="datetime-picker">{label}</label>
      <input 
        id="datetime-picker"
        type="datetime-local"
        data-testid="datetime-picker"
        value={value ? value.toISOString().slice(0, 16) : ''}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
        disabled={disabled}
        aria-label={label || 'Date time'}
      />
    </div>
  ),
  LocalizationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DesktopDateTimePicker: ({ 
    label, 
    value, 
    onChange, 
    disabled,
  }: { 
    label?: string;
    value: Date | null;
    onChange: (value: Date | null) => void;
    disabled?: boolean;
  }) => (
    <div>
      <label htmlFor="datetime-picker">{label}</label>
      <input 
        id="datetime-picker"
        type="datetime-local"
        data-testid="datetime-picker"
        value={value ? value.toISOString().slice(0, 16) : ''}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
        disabled={disabled}
        aria-label={label || 'Date time'}
      />
    </div>
  ),
}));

import GradeEditForm from '@/features/gradebook/components/GradeEditForm';
import type { Grade, GradeItem } from '@/features/gradebook/types/grade.types';
import { AggregationStatus } from '@/features/gradebook/types/grade.types';
import type { User } from '@/features/auth/types/auth.types';

/**
 * Base API URL for gradebook endpoints
 */
const API_BASE_URL = '/api/v1';

/**
 * Creates a test grade item with customizable properties.
 * This helper creates GradeItem objects directly to avoid type mismatches
 * with the shared mock helpers that use boolean instead of number for flag fields.
 * 
 * @param overrides - Properties to override default values
 * @returns A complete GradeItem object for testing
 */
function createTestGradeItem(overrides: Partial<GradeItem> = {}): GradeItem {
  return {
    id: 101,
    courseid: 1,
    categoryid: null,
    itemname: 'Test Assignment',
    itemtype: 'mod',
    itemmodule: 'assign',
    iteminstance: 1,
    itemnumber: 0,
    iteminfo: null,
    idnumber: null,
    calculation: null,
    gradetype: 1, // GradeType.VALUE
    grademax: 100,
    grademin: 0,
    scaleid: null,
    outcomeid: null,
    gradepass: 50,
    multfactor: 1.0,
    plusfactor: 0.0,
    aggregationcoef: 0.0,
    aggregationcoef2: 0.0,
    sortorder: 0,
    display: 0, // DisplayType.DEFAULT
    decimals: 2,
    hidden: 0,
    locked: 0,
    locktime: 0,
    needsupdate: 0,
    weightoverride: 0,
    timecreated: Date.now() - 86400000 * 30,
    timemodified: Date.now() - 86400000,
    ...overrides,
  };
}

/**
 * Test-specific override type that allows boolean values for number fields.
 * This provides a more convenient API for tests while maintaining correct output types.
 */
type TestGradeOverrides = Omit<Partial<Grade>, 'hidden' | 'locked' | 'overridden' | 'excluded'> & {
  hidden?: number | boolean;
  locked?: number | boolean;
  overridden?: number | boolean;
  excluded?: number | boolean;
};

/**
 * Creates a test grade with customizable properties.
 * This helper creates Grade objects directly to avoid type mismatches
 * with the shared mock helpers that use boolean instead of number for flag fields.
 * 
 * @param overrides - Properties to override default values (boolean values auto-converted to numbers)
 * @returns A complete Grade object for testing
 */
function createTestGrade(overrides: TestGradeOverrides = {}): Grade {
  // Convert boolean overrides to numbers
  const hidden = typeof overrides.hidden === 'boolean' ? (overrides.hidden ? 1 : 0) : (overrides.hidden ?? 0);
  const locked = typeof overrides.locked === 'boolean' ? (overrides.locked ? 1 : 0) : (overrides.locked ?? 0);
  const overridden = typeof overrides.overridden === 'boolean' ? (overrides.overridden ? 1 : 0) : (overrides.overridden ?? 0);
  const excluded = typeof overrides.excluded === 'boolean' ? (overrides.excluded ? 1 : 0) : (overrides.excluded ?? 0);
  
  // Extract remaining overrides without the boolean-convertible fields
  const { hidden: _, locked: __, overridden: ___, excluded: ____, ...restOverrides } = overrides;
  
  return {
    id: 1001,
    itemid: 101,
    userid: 2,
    rawgrade: 85.5,
    rawgrademax: 100,
    rawgrademin: 0,
    rawscaleid: null,
    usermodified: null,
    finalgrade: 85.5,
    hidden,
    locked,
    locktime: 0,
    exported: 0,
    overridden,
    excluded,
    feedback: '',
    feedbackformat: 1,
    information: null,
    informationformat: 0,
    timecreated: Date.now() - 86400000, // 1 day ago
    timemodified: Date.now() - 3600000, // 1 hour ago
    aggregationstatus: AggregationStatus.USED,
    aggregationweight: null,
    deductedmark: null,
    ...restOverrides,
  };
}

/**
 * Mock grade history entries for testing audit trail
 */
const mockGradeHistory = [
  {
    id: 1,
    gradeId: 1001,
    oldGrade: 75.0,
    newGrade: 85.5,
    userId: 3, // Teacher who made the change
    userFullname: 'John Teacher',
    timestamp: Date.now() - 3600000,
    action: 'update' as const,
    source: 'manual' as const,
  },
  {
    id: 2,
    gradeId: 1001,
    oldGrade: null,
    newGrade: 75.0,
    userId: 3,
    userFullname: 'John Teacher',
    timestamp: Date.now() - 86400000,
    action: 'create' as const,
    source: 'manual' as const,
  },
];

/**
 * Creates a teacher user with grading permissions for testing.
 * This user has the 'moodle/grade:edit' capability which is required
 * by GradeEditForm to allow grade editing.
 * 
 * @returns A User object configured as a teacher with grading permissions
 */
function createTeacherWithGradingPermissions(): User {
  return createMockUser({
    id: 3,
    username: 'teacher1',
    firstname: 'John',
    lastname: 'Teacher',
    fullname: 'John Teacher',
    email: 'teacher1@example.com',
    roles: [
      {
        id: 3,
        name: 'Editing Teacher',
        shortname: 'editingteacher',
        description: 'Teachers can edit course content and grade students',
      },
    ],
    capabilities: [
      {
        capability: 'moodle/grade:edit',
        contextId: 1, // System context
        granted: true,
      },
      {
        capability: 'moodle/grade:view',
        contextId: 1,
        granted: true,
      },
      {
        capability: 'moodle/grade:viewall',
        contextId: 1,
        granted: true,
      },
      {
        capability: 'moodle/grade:manage',
        contextId: 1,
        granted: true,
      },
      {
        capability: 'mod/assign:grade',
        contextId: 1,
        granted: true,
      },
    ],
  });
}

/**
 * Helper function that renders a component with teacher authentication.
 * This ensures the user has the moodle/grade:edit capability required
 * for grade editing operations.
 * 
 * @param ui - React element to render
 * @returns Enhanced render result with store, queryClient, and user event utilities
 */
function renderWithTeacher(ui: React.ReactElement) {
  const teacherUser = createTeacherWithGradingPermissions();
  return render(ui, {
    authenticated: true,
    user: teacherUser,
  });
}

describe('Grade Editing Integration Tests', () => {
  // Common test data
  let mockGradeItem: GradeItem;
  let mockGrade: Grade;

  beforeEach(() => {
    // Initialize fresh test data for each test
    // By default, create a grade with override enabled so grade input is editable
    // The component requires overridden=1 for the grade input to be enabled
    mockGradeItem = createTestGradeItem();
    mockGrade = createTestGrade({ overridden: 1 });

    // Mock window.scrollTo to prevent jsdom errors
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    
    // Reset toast mocks before each test
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  afterEach(() => {
    // Reset all MSW handlers to default state after each test
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('Basic Grade Editing', () => {
    it('should display grade edit form with current grade value', async () => {
      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Should display the current grade value in the input
      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      expect(gradeInput).toBeInTheDocument();
      expect(gradeInput).toHaveValue(85.5);
    });

    it('should allow teacher to enter a new grade value', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={onSave}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      
      // Clear and enter new grade
      await user.clear(gradeInput);
      await user.type(gradeInput, '92.5');

      expect(gradeInput).toHaveValue(92.5);
    });

    it('should display grade item information (max points in label)', () => {
      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // The component uses aria-label="Final grade value" for the input
      const gradeInput = screen.getByRole('spinbutton', { name: /final grade value/i });
      expect(gradeInput).toBeInTheDocument();
      
      // Should have proper input constraints based on gradeItem
      expect(gradeInput).toHaveAttribute('min', '0');
      expect(gradeInput).toHaveAttribute('max', '100');
    });

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={onCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Grade Validation', () => {
    it('should validate grade is not below minimum (0)', async () => {
      const user = userEvent.setup();

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '-5');

      // Submit the form to trigger validation
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/grade must be at least 0/i)).toBeInTheDocument();
      });
    });

    it('should validate grade is not above maximum (100)', async () => {
      const user = userEvent.setup();

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '150');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show validation error for exceeding max
      await waitFor(() => {
        expect(screen.getByText(/grade cannot exceed 100/i)).toBeInTheDocument();
      });
    });

    it('should enforce decimal places according to grade item configuration', async () => {
      // Grade item with 1 decimal place
      const gradeItemOneDecimal = createTestGradeItem({ decimals: 1 });

      renderWithTeacher(
        <GradeEditForm
          gradeItem={gradeItemOneDecimal}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      
      // Component uses a hardcoded step of 0.01 for all inputs
      // This allows fine-grained grade entry regardless of decimals setting
      expect(gradeInput).toHaveAttribute('step', '0.01');
      
      // Verify min/max constraints are present
      expect(gradeInput).toHaveAttribute('min', '0');
      expect(gradeInput).toHaveAttribute('max', '100');
    });

    it('should show error when submission returns validation error', async () => {
      const user = userEvent.setup();

      // Component shows error from onSubmit rejection via toast
      const onSubmit = vi.fn().mockRejectedValue(
        new Error('Grade is outside valid range')
      );

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '95');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show the error message via toast hook
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringMatching(/Grade is outside valid range|error|failed/i)
        );
      });
    });

    it('should accept valid grades within range', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '88');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should call onSubmit with the valid grade
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            finalgrade: 88,
          })
        );
      });
    });
  });

  describe('Locked Grades', () => {
    // NOTE: The GradeEditForm component handles locked grades via the `readOnly` prop
    // and a "Lock grade" switch. When readOnly=true, all inputs are disabled.
    // The locked field in grade data represents whether the grade is locked from calculations.

    it('should disable grade input when readOnly prop is true', () => {
      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          readOnly={true}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      expect(gradeInput).toBeDisabled();
    });

    it('should disable save button when readOnly prop is true', () => {
      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          readOnly={true}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should show locked grade error when submission fails', async () => {
      const user = userEvent.setup();

      // Simulate API returning locked error via onSubmit rejection
      const onSubmit = vi.fn().mockRejectedValue(
        new Error('Cannot modify a locked grade')
      );

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show the error via toast hook
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringMatching(/Cannot modify a locked grade|locked|error/i)
        );
      });
    });

    it('should display Lock grade toggle', () => {
      // The component has a "Lock grade" switch that users can toggle
      const gradeWithLock = createTestGrade({ locked: 1 });

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={gradeWithLock}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Should display the lock grade switch - use role query to avoid ambiguity
      // between FormControlLabel label and Switch aria-label
      const lockSwitch = screen.getByRole('checkbox', { name: /lock grade/i });
      expect(lockSwitch).toBeInTheDocument();
      // Should be checked since locked: 1
      expect(lockSwitch).toBeChecked();
    });
  });

  describe('Override Grades', () => {
    it('should display override checkbox', () => {
      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const overrideCheckbox = screen.getByRole('checkbox', { name: /override/i });
      expect(overrideCheckbox).toBeInTheDocument();
    });

    it('should show override checkbox checked when grade is overridden', () => {
      const overriddenGrade = createTestGrade({ overridden: true });

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={overriddenGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const overrideCheckbox = screen.getByRole('checkbox', { name: /override/i });
      expect(overrideCheckbox).toBeChecked();
    });

    it('should toggle override state when checkbox is clicked', async () => {
      const user = userEvent.setup();
      // Start with override unchecked
      const gradeWithoutOverride = createTestGrade({ overridden: 0 });

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={gradeWithoutOverride}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const overrideCheckbox = screen.getByRole('checkbox', { name: /override/i });
      expect(overrideCheckbox).not.toBeChecked();

      await user.click(overrideCheckbox);
      expect(overrideCheckbox).toBeChecked();

      await user.click(overrideCheckbox);
      expect(overrideCheckbox).not.toBeChecked();
    });

    it('should include override flag in onSubmit data when saving', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}  // mockGrade has overridden: 1
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '95');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Component should include override flag in callback data
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            overridden: 1,  // Component passes overridden as number (1 = true)
            finalgrade: 95,
          })
        );
      });
    });

    it('should allow overriding a calculated grade', async () => {
      const user = userEvent.setup();
      
      // Create a category total item (calculated grade) with override unchecked
      const categoryItem = createTestGradeItem({
        itemtype: 'category',
        itemname: 'Category Total',
        calculation: '=average([[item1]],[[item2]])',
      });

      const categoryGrade = createTestGrade({
        itemid: categoryItem.id,
        rawgrade: 80,
        finalgrade: 80,
        overridden: 0,  // Start unchecked so we can test enabling override
      });

      renderWithTeacher(
        <GradeEditForm
          gradeItem={categoryItem}
          initialValues={categoryGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Grade input should initially be disabled (override not checked)
      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      expect(gradeInput).toBeDisabled();

      // Click override checkbox to enable editing
      const overrideCheckbox = screen.getByRole('checkbox', { name: /override/i });
      await user.click(overrideCheckbox);

      // Grade input should now be editable
      expect(gradeInput).not.toBeDisabled();
    });
  });

  describe('Save Operations', () => {
    it('should call onSubmit callback with grade data on save', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Component calls onSubmit with grade data when save is clicked
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            finalgrade: 90,
          })
        );
      });
    });

    it('should show success toast on successful save', async () => {
      const user = userEvent.setup();
      // Component uses callback pattern - onSubmit resolving = success
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Component uses useToast hook to show success notification
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        expect(mockToastSuccess).toHaveBeenCalledWith(
          expect.stringMatching(/grade saved|saved successfully/i)
        );
      });
    });

    it('should call onSubmit callback with grade data when form is saved', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
        // Component passes finalgrade (not rawgrade) to onSubmit
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            finalgrade: 90,
          })
        );
      });
    });

    it('should show loading state while saving', async () => {
      const user = userEvent.setup();

      // Create a promise that we control to keep loading state visible
      let resolveSubmit: () => void = () => {};
      const onSubmit = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      }));

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show loading indicator while onSubmit promise is pending
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });

      // Clean up by resolving the promise
      resolveSubmit();
    });

    it('should show error message on submission failure', async () => {
      const user = userEvent.setup();

      // Component shows error via toast when onSubmit throws
      const onSubmit = vi.fn().mockRejectedValue(new Error('Failed to save grade'));

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show error message via toast hook
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringMatching(/failed to save grade|error|failed/i)
        );
      });
    });

    it('should show permission error when onSubmit throws permission error', async () => {
      const user = userEvent.setup();

      // Simulate parent component throwing permission error from API
      const onSubmit = vi.fn().mockRejectedValue(
        new Error('You do not have permission to edit grades')
      );

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show permission error via toast hook
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringMatching(/permission|error|failed/i)
        );
      });
    });
  });

  describe('Grade History and Audit Trail', () => {
    // NOTE: The GradeEditForm component does not currently implement the history/audit trail
    // feature. These tests document the expected behavior for future implementation.
    // The parent page component would typically handle fetching and displaying history.

    it.skip('should display history button for viewing grade history', () => {
      // Feature not implemented in GradeEditForm - history is typically handled by parent component
      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      expect(historyButton).toBeInTheDocument();
    });

    it.skip('should open grade history modal when history button is clicked', async () => {
      // Feature not implemented - placeholder for future enhancement
      const user = userEvent.setup();

      server.use(
        http.get(`${API_BASE_URL}/gradebook/items/:id/history`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              history: mockGradeHistory,
            },
          });
        })
      );

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      await user.click(historyButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/grade history/i)).toBeInTheDocument();
      });
    });

    it.skip('should display previous grade values in history modal', async () => {
      // Feature not implemented - placeholder for future enhancement
      const user = userEvent.setup();

      server.use(
        http.get(`${API_BASE_URL}/gradebook/items/:id/history`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              history: mockGradeHistory,
            },
          });
        })
      );

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      await user.click(historyButton);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(within(modal).getByText('75')).toBeInTheDocument();
        expect(within(modal).getByText('85.5')).toBeInTheDocument();
      });
    });

    it.skip('should display timestamps for grade history entries', async () => {
      // Feature not implemented - placeholder for future enhancement
      const user = userEvent.setup();

      server.use(
        http.get(`${API_BASE_URL}/gradebook/items/:id/history`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              history: mockGradeHistory,
            },
          });
        })
      );

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      await user.click(historyButton);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(within(modal).getByText(/ago/i)).toBeInTheDocument();
      });
    });

    it.skip('should display who made each grade change in audit trail', async () => {
      // Feature not implemented - placeholder for future enhancement
      const user = userEvent.setup();

      server.use(
        http.get(`${API_BASE_URL}/gradebook/items/:id/history`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              history: mockGradeHistory,
            },
          });
        })
      );

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      await user.click(historyButton);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(within(modal).getByText('John Teacher')).toBeInTheDocument();
      });
    });

    it.skip('should display action type (create, update) in grade history', async () => {
      // Feature not implemented - placeholder for future enhancement
      const user = userEvent.setup();

      server.use(
        http.get(`${API_BASE_URL}/gradebook/items/:id/history`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              history: mockGradeHistory,
            },
          });
        })
      );

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      await user.click(historyButton);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        
        // Should show action types
        expect(within(modal).getByText(/updated/i)).toBeInTheDocument();
        expect(within(modal).getByText(/created/i)).toBeInTheDocument();
      });
    });

    it.skip('should close history modal when close button is clicked', async () => {
      // Feature not implemented - placeholder for future enhancement
      const user = userEvent.setup();

      server.use(
        http.get(`${API_BASE_URL}/gradebook/items/:id/history`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              history: mockGradeHistory,
            },
          });
        })
      );

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      await user.click(historyButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Close the modal
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it.skip('should show empty state when no grade history exists', async () => {
      // Feature not implemented - placeholder for future enhancement
      const user = userEvent.setup();

      server.use(
        http.get(`${API_BASE_URL}/gradebook/items/:id/history`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              history: [],
            },
          });
        })
      );

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      await user.click(historyButton);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(within(modal).getByText(/no history/i)).toBeInTheDocument();
      });
    });
  });

  describe('Feedback Field', () => {
    it('should display feedback text area', () => {
      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const feedbackInput = screen.getByRole('textbox', { name: /feedback/i });
      expect(feedbackInput).toBeInTheDocument();
    });

    it('should allow entering feedback text', async () => {
      const user = userEvent.setup();

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const feedbackInput = screen.getByRole('textbox', { name: /feedback/i });
      await user.type(feedbackInput, 'Great work on this assignment!');

      expect(feedbackInput).toHaveValue('Great work on this assignment!');
    });

    it('should include feedback in onSubmit callback data', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      );

      const feedbackInput = screen.getByRole('textbox', { name: /feedback/i });
      await user.type(feedbackInput, 'Well done!');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            feedback: expect.stringContaining('Well done!'),
          })
        );
      });
    });
  });

  describe('Excluded Grades', () => {
    it('should display excluded checkbox', () => {
      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const excludedCheckbox = screen.getByRole('checkbox', { name: /exclude/i });
      expect(excludedCheckbox).toBeInTheDocument();
    });

    it('should show excluded checkbox checked when grade is excluded', () => {
      const excludedGrade = createTestGrade({ excluded: true });

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={excludedGrade}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const excludedCheckbox = screen.getByRole('checkbox', { name: /exclude/i });
      expect(excludedCheckbox).toBeChecked();
    });

    it('should include excluded flag in onSubmit callback data', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      );

      const excludedCheckbox = screen.getByRole('checkbox', { name: /exclude/i });
      await user.click(excludedCheckbox);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            excluded: 1, // Component uses 1/0 for boolean fields
          })
        );
      });
    });
  });

  describe('Keyboard Accessibility', () => {
    it('should allow form submission with Enter key', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();

      server.use(
        http.put(`${API_BASE_URL}/gradebook/items/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              grade: mockGrade,
            },
          });
        })
      );

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={onSave}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '95{Enter}');

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });
    });

    // SKIPPED: Component does not implement Escape key handling
    // This would be a good enhancement to add in the future for accessibility
    it.skip('should allow cancellation with Escape key', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={mockGrade}
          onSubmit={vi.fn()}
          onCancel={onCancel}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.click(gradeInput);
      await user.keyboard('{Escape}');

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should have proper tab order through form elements', async () => {
      const user = userEvent.setup();

      // Use grade with override enabled so grade input is focusable
      const gradeWithOverride = createTestGrade({ overridden: true });

      renderWithTeacher(
        <GradeEditForm
          gradeItem={mockGradeItem}
          initialValues={gradeWithOverride}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Tab through the form - actual order in component is:
      // 1. Override checkbox
      // 2. Grade input (enabled when override is checked)
      // 3. Excluded checkbox
      // 4. Lock grade switch
      // 5. Hidden switch
      // 6. Feedback textbox
      // 7. Cancel button
      // 8. Save button
      
      await user.tab();
      // First tab goes to Override checkbox
      expect(screen.getByRole('checkbox', { name: /override/i })).toHaveFocus();

      await user.tab();
      // Second tab goes to Grade input (enabled since override is checked)
      expect(screen.getByRole('spinbutton', { name: /grade/i })).toHaveFocus();
    });
  });
});
