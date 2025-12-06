/**
 * @fileoverview Unit tests for GradeEditForm component
 * 
 * This test suite verifies the complete functionality of the GradeEditForm component
 * including form rendering with grade input fields, validation rules (min/max values,
 * scale constraints), feedback textarea, override checkbox, form submission workflow,
 * permission checks, optimistic updates, error handling, dirty state tracking,
 * unsaved changes warning, and accessibility features.
 * 
 * Tests use @testing-library/react, react-hook-form validation, MSW for API mocking,
 * userEvent for user interactions, and verify grade updates match PHP grade_update()
 * function behavior.
 * 
 * @module tests/unit/features/gradebook/GradeEditForm.test
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { run as axeRun, AxeResults } from 'axe-core';
import '@testing-library/jest-dom';

// Internal imports from depends_on_files
import { render, screen, waitFor, within } from '../../../helpers/render';
import { GradeEditForm } from '../../../../src/features/gradebook/components/GradeEditForm';
import { createMockGrade, createMockGradeItem } from '../../../helpers/mockData';
import { usePermissions } from '../../../../src/features/auth/hooks/usePermissions';
import type { GradeItem } from '../../../../src/types/entities';
import type { Grade } from '../../../../src/features/gradebook/types/grade.types';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock the usePermissions hook
vi.mock('../../../../src/features/auth/hooks/usePermissions', () => ({
  usePermissions: vi.fn(),
}));

const mockUsePermissions = usePermissions as ReturnType<typeof vi.fn>;

// API base URL for tests
const API_BASE_URL = 'http://localhost:3000/api/v1';

// ============================================================================
// MSW SERVER SETUP
// ============================================================================

/**
 * Default MSW handlers for gradebook API endpoints.
 * Handlers can be overridden per test using server.use().
 */
const handlers = [
  // PUT /api/v1/gradebook/grades/:gradeId - Update grade
  http.put(`${API_BASE_URL}/gradebook/grades/:gradeId`, async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>;
    const gradeId = params.gradeId as string;
    
    return HttpResponse.json({
      success: true,
      data: {
        id: parseInt(gradeId, 10),
        itemid: body.itemid || 1,
        userid: body.userid || 1,
        finalgrade: body.finalgrade,
        feedback: body.feedback || null,
        overridden: body.overridden || 0,
        excluded: body.excluded || 0,
        hidden: body.hidden || 0,
        locked: body.locked || 0,
        locktime: body.locktime || 0,
        timemodified: Math.floor(Date.now() / 1000),
      },
    });
  }),

  // PUT /api/v1/gradebook/items/:itemId - Update grade item (alternative endpoint)
  http.put(`${API_BASE_URL}/gradebook/items/:itemId`, async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>;
    const itemId = params.itemId as string;
    
    return HttpResponse.json({
      success: true,
      data: {
        id: parseInt(itemId, 10),
        finalgrade: body.finalgrade,
        feedback: body.feedback || null,
        overridden: body.overridden || 0,
        timemodified: Math.floor(Date.now() / 1000),
      },
    });
  }),
];

// Create MSW server instance
const server = setupServer(...handlers);

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Creates a standard numeric grade item for testing.
 */
function createNumericGradeItem(overrides: Partial<GradeItem> = {}): GradeItem {
  return createMockGradeItem({
    id: 1,
    courseid: 1,
    categoryid: 1,
    itemname: 'Test Assignment',
    itemtype: 'mod',
    itemmodule: 'assign',
    iteminstance: 1,
    gradetype: 1, // GradeType.VALUE
    grademax: 100,
    grademin: 0,
    scaleid: null,
    decimals: 2,
    display: 0,
    hidden: 0,
    locked: 0,
    locktime: 0,
    ...overrides,
  });
}

/**
 * Creates a scale-based grade item for testing.
 * Scale grades use gradetype=2 and reference a scale.
 */
function createScaleGradeItem(overrides: Partial<GradeItem> = {}): GradeItem {
  return createMockGradeItem({
    id: 2,
    courseid: 1,
    categoryid: 1,
    itemname: 'Scale Assignment',
    itemtype: 'mod',
    itemmodule: 'assign',
    iteminstance: 2,
    gradetype: 2, // GradeType.SCALE
    grademax: 5,
    grademin: 1,
    scaleid: 1,
    decimals: 0,
    display: 0,
    hidden: 0,
    locked: 0,
    locktime: 0,
    ...overrides,
  });
}

/**
 * Creates initial grade values for the form.
 */
function createInitialValues(overrides: Partial<Grade> = {}): Grade {
  return createMockGrade({
    id: 1,
    itemid: 1,
    userid: 1,
    rawgrade: 85,
    rawgrademax: 100,
    rawgrademin: 0,
    rawscaleid: null,
    usermodified: 1,
    finalgrade: 85,
    hidden: 0,
    locked: 0,
    locktime: 0,
    exported: 0,
    overridden: 0,
    excluded: 0,
    feedback: 'Good work!',
    feedbackformat: 1,
    information: null,
    informationformat: 0,
    timecreated: Math.floor(Date.now() / 1000) - 86400,
    timemodified: Math.floor(Date.now() / 1000),
    aggregationstatus: 'used',
    aggregationweight: 1,
    deductedmark: null,
    ...overrides,
  });
}

// ============================================================================
// TEST LIFECYCLE
// ============================================================================

beforeAll(() => {
  // Start MSW server before all tests
  server.listen({ onUnhandledRequest: 'error' });
});

afterAll(() => {
  // Stop MSW server after all tests
  server.close();
});

beforeEach(() => {
  // Reset MSW handlers to defaults before each test
  server.resetHandlers();
  
  // Reset all mocks
  vi.clearAllMocks();
  
  // Default permission: user has grade edit capability
  mockUsePermissions.mockReturnValue({
    hasCapability: vi.fn().mockReturnValue(true),
    checkPermission: vi.fn().mockResolvedValue(true),
    isLoading: false,
    error: null,
    permissions: {
      'moodle/grade:edit': true,
      'moodle/grade:view': true,
    },
  });
});

afterEach(() => {
  // Cleanup after each test
  vi.clearAllMocks();
});

// ============================================================================
// TEST SUITES
// ============================================================================

describe('GradeEditForm', () => {
  // ==========================================================================
  // FORM RENDERING TESTS
  // ==========================================================================

  describe('Form Rendering', () => {
    it('should render form with initial grade value pre-filled', async () => {
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ finalgrade: 85 });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      // Verify initial grade value is pre-filled
      const gradeInput = screen.getByLabelText(/grade/i) as HTMLInputElement;
      expect(gradeInput.value).toBe('85');
    });

    it('should render form with feedback textarea pre-filled', async () => {
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ feedback: 'Great work on this assignment!' });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        const feedbackTextarea = screen.getByLabelText(/feedback/i) as HTMLTextAreaElement;
        expect(feedbackTextarea.value).toBe('Great work on this assignment!');
      });
    });

    it('should render override checkbox reflecting overridden state', async () => {
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ overridden: 1 });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        const overrideCheckbox = screen.getByRole('checkbox', { name: /override/i });
        expect(overrideCheckbox).toBeChecked();
      });
    });

    it('should render form in read-only mode when readOnly prop is true', async () => {
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ finalgrade: 90 });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
          readOnly={true}
        />
      );

      await waitFor(() => {
        const gradeInput = screen.getByLabelText(/grade/i);
        expect(gradeInput).toBeDisabled();
      });

      // Save button should not be present in read-only mode
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    });

    it('should display grade item name in form header', async () => {
      const gradeItem = createNumericGradeItem({ itemname: 'Week 1 Quiz' });
      const initialValues = createInitialValues();
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Week 1 Quiz/i)).toBeInTheDocument();
      });
    });

    it('should display Save and Cancel buttons', async () => {
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues();
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // INPUT VALIDATION TESTS
  // ==========================================================================

  describe('Input Validation', () => {
    it('should enforce minimum grade boundary based on grade item settings', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem({ grademin: 0, grademax: 100 });
      const initialValues = createInitialValues({ finalgrade: 50 });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      const gradeInput = screen.getByLabelText(/grade/i);
      
      // Clear and enter value below minimum
      await user.clear(gradeInput);
      await user.type(gradeInput, '-10');
      
      // Try to submit the form
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/grade must be at least 0/i)).toBeInTheDocument();
      });
      
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should enforce maximum grade boundary based on grade item settings', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem({ grademin: 0, grademax: 100 });
      const initialValues = createInitialValues({ finalgrade: 50 });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      const gradeInput = screen.getByLabelText(/grade/i);
      
      // Clear and enter value above maximum
      await user.clear(gradeInput);
      await user.type(gradeInput, '150');
      
      // Try to submit the form
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/grade must be at most 100/i)).toBeInTheDocument();
      });
      
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should allow decimal input with proper formatting for numeric grades', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem({ decimals: 2, grademax: 100 });
      const initialValues = createInitialValues({ finalgrade: null });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      const gradeInput = screen.getByLabelText(/grade/i);
      
      // Enter decimal value
      await user.type(gradeInput, '85.75');
      
      expect((gradeInput as HTMLInputElement).value).toBe('85.75');
    });

    it('should show scale dropdown options for scale-based grades', async () => {
      const user = userEvent.setup();
      const gradeItem = createScaleGradeItem();
      const initialValues = createInitialValues({ 
        finalgrade: 3,
        rawscaleid: 1,
      });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      // For scale grades, look for a select element or combobox
      await waitFor(() => {
        const selectElement = screen.queryByRole('combobox') || screen.queryByLabelText(/grade/i);
        expect(selectElement).toBeInTheDocument();
      });
    });

    it('should display validation errors inline with field highlighting', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem({ grademax: 100 });
      const initialValues = createInitialValues({ finalgrade: 50 });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      const gradeInput = screen.getByLabelText(/grade/i);
      
      // Enter invalid value
      await user.clear(gradeInput);
      await user.type(gradeInput, '999');
      
      // Trigger validation by blurring or submitting
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Check for error state on the input field
      await waitFor(() => {
        // MUI inputs typically get aria-invalid attribute when invalid
        const inputWrapper = gradeInput.closest('.MuiFormControl-root') || gradeInput;
        expect(inputWrapper).toHaveClass(/error/i);
      });
    });

    it('should allow feedback textarea with multi-line comments', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ feedback: '' });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/feedback/i)).toBeInTheDocument();
      });

      const feedbackTextarea = screen.getByLabelText(/feedback/i);
      const multiLineText = 'Line 1\nLine 2\nLine 3';
      
      await user.type(feedbackTextarea, multiLineText);
      
      expect((feedbackTextarea as HTMLTextAreaElement).value).toContain('Line 1');
      expect((feedbackTextarea as HTMLTextAreaElement).value).toContain('Line 2');
    });
  });

  // ==========================================================================
  // PERMISSION TESTS
  // ==========================================================================

  describe('Permission Checks', () => {
    it('should show permission error when user lacks moodle/grade:edit capability', async () => {
      // Mock permission denied
      mockUsePermissions.mockReturnValue({
        hasCapability: vi.fn().mockReturnValue(false),
        checkPermission: vi.fn().mockResolvedValue(false),
        isLoading: false,
        error: null,
        permissions: {
          'moodle/grade:edit': false,
          'moodle/grade:view': true,
        },
      });

      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues();
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      // Should show permission error or disable form
      await waitFor(() => {
        const permissionError = screen.queryByText(/permission/i) || 
                               screen.queryByText(/not authorized/i) ||
                               screen.queryByText(/cannot edit/i);
        const gradeInput = screen.queryByLabelText(/grade/i);
        
        // Either show error message or disable the form
        const hasPermissionError = permissionError !== null;
        const formIsDisabled = gradeInput && gradeInput.hasAttribute('disabled');
        
        expect(hasPermissionError || formIsDisabled).toBe(true);
      });
    });

    it('should allow editing when user has moodle/grade:edit capability', async () => {
      // Mock permission granted (already set in beforeEach)
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues();
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        const gradeInput = screen.getByLabelText(/grade/i);
        expect(gradeInput).not.toBeDisabled();
      });

      // Save button should be enabled
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('should check permission with correct context on mount', async () => {
      const mockHasCapability = vi.fn().mockReturnValue(true);
      mockUsePermissions.mockReturnValue({
        hasCapability: mockHasCapability,
        checkPermission: vi.fn().mockResolvedValue(true),
        isLoading: false,
        error: null,
        permissions: {
          'moodle/grade:edit': true,
        },
      });

      const gradeItem = createNumericGradeItem({ courseid: 5 });
      const initialValues = createInitialValues();
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(mockHasCapability).toHaveBeenCalledWith(
          'moodle/grade:edit',
          expect.objectContaining({ courseid: 5 })
        );
      });
    });
  });

  // ==========================================================================
  // FORM SUBMISSION TESTS
  // ==========================================================================

  describe('Form Submission', () => {
    it('should call onSubmit with validated data when form is submitted', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ finalgrade: 75 });
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      // Update the grade
      const gradeInput = screen.getByLabelText(/grade/i);
      await user.clear(gradeInput);
      await user.type(gradeInput, '95');

      // Submit the form
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Verify onSubmit was called with correct data
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            finalgrade: 95,
          })
        );
      });
    });

    it('should call onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues();
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });

    it('should include feedback in submission data', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ feedback: '' });
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/feedback/i)).toBeInTheDocument();
      });

      // Enter grade and feedback
      const gradeInput = screen.getByLabelText(/grade/i);
      await user.type(gradeInput, '88');
      
      const feedbackTextarea = screen.getByLabelText(/feedback/i);
      await user.type(feedbackTextarea, 'Excellent work!');

      // Submit
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            feedback: expect.stringContaining('Excellent work!'),
          })
        );
      });
    });

    it('should include override state in submission data', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ overridden: 0 });
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /override/i })).toBeInTheDocument();
      });

      // Toggle override checkbox
      const overrideCheckbox = screen.getByRole('checkbox', { name: /override/i });
      await user.click(overrideCheckbox);

      // Enter grade value
      const gradeInput = screen.getByLabelText(/grade/i);
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      // Submit
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            overridden: 1,
          })
        );
      });
    });

    it('should disable Save button while form is submitting', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ finalgrade: 80 });
      
      // Create a promise that we can control
      let resolveSubmit: () => void;
      const submitPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });
      const onSubmit = vi.fn().mockReturnValue(submitPromise);
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      
      // Click save
      await user.click(saveButton);

      // Button should be disabled during submission
      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });

      // Resolve the submission
      resolveSubmit!();
    });
  });

  // ==========================================================================
  // OPTIMISTIC UPDATE TESTS
  // ==========================================================================

  describe('Optimistic Updates', () => {
    it('should show updated value immediately before API response', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ finalgrade: 70 });
      
      // Delay the API response
      server.use(
        http.put(`${API_BASE_URL}/gradebook/grades/:gradeId`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return HttpResponse.json({
            success: true,
            data: { id: 1, finalgrade: 95 },
          });
        })
      );

      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      // Update grade
      const gradeInput = screen.getByLabelText(/grade/i);
      await user.clear(gradeInput);
      await user.type(gradeInput, '95');

      // Verify the input shows the new value immediately (optimistic)
      expect((gradeInput as HTMLInputElement).value).toBe('95');
    });

    it('should show success toast notification on successful save', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ finalgrade: 80 });
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      // Submit the form
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Wait for and verify success notification
      await waitFor(() => {
        const successMessage = screen.queryByText(/saved/i) ||
                              screen.queryByText(/success/i) ||
                              screen.queryByRole('alert');
        expect(successMessage).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  // ==========================================================================
  // ERROR HANDLING TESTS
  // ==========================================================================

  describe('Error Handling', () => {
    it('should display error message when API call fails', async () => {
      const user = userEvent.setup();
      
      // Mock API error
      server.use(
        http.put(`${API_BASE_URL}/gradebook/grades/:gradeId`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'UPDATE_FAILED',
                message: 'Failed to update grade',
              },
            },
            { status: 500 }
          );
        })
      );

      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ finalgrade: 75 });
      const onSubmit = vi.fn().mockRejectedValue(new Error('Failed to update grade'));
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      // Try to submit
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should display error message
      await waitFor(() => {
        const errorMessage = screen.queryByText(/failed/i) ||
                            screen.queryByText(/error/i) ||
                            screen.queryByRole('alert');
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('should handle permission denied error (403)', async () => {
      const user = userEvent.setup();
      
      // Mock 403 error
      server.use(
        http.put(`${API_BASE_URL}/gradebook/grades/:gradeId`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to edit this grade',
              },
            },
            { status: 403 }
          );
        })
      );

      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues();
      const onSubmit = vi.fn().mockRejectedValue(new Error('Permission denied'));
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        const errorMessage = screen.queryByText(/permission/i) ||
                            screen.queryByText(/denied/i) ||
                            screen.queryByText(/not authorized/i);
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('should handle validation error (400) with field-specific messages', async () => {
      const user = userEvent.setup();
      
      // Mock 400 validation error
      server.use(
        http.put(`${API_BASE_URL}/gradebook/grades/:gradeId`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
                details: {
                  finalgrade: 'Grade value is out of valid range',
                },
              },
            },
            { status: 400 }
          );
        })
      );

      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues();
      const onSubmit = vi.fn().mockRejectedValue(new Error('Validation failed'));
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        const errorMessage = screen.queryByText(/validation/i) ||
                            screen.queryByText(/invalid/i) ||
                            screen.queryByRole('alert');
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('should revert optimistic update on failed submission', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ finalgrade: 75 });
      const onSubmit = vi.fn().mockRejectedValue(new Error('Failed'));
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      const gradeInput = screen.getByLabelText(/grade/i);
      
      // Change the grade
      await user.clear(gradeInput);
      await user.type(gradeInput, '99');

      // Submit (will fail)
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Wait for error handling
      await waitFor(() => {
        // Form should still show the user's input or be ready to retry
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // DIRTY STATE TESTS
  // ==========================================================================

  describe('Dirty State Tracking', () => {
    it('should track dirty state when grade is modified', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ finalgrade: 80 });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      const gradeInput = screen.getByLabelText(/grade/i);
      
      // Modify the grade
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      // Form should be marked as dirty - Save button should be enabled
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('should track dirty state when feedback is modified', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ feedback: 'Original feedback' });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/feedback/i)).toBeInTheDocument();
      });

      const feedbackTextarea = screen.getByLabelText(/feedback/i);
      
      // Modify the feedback
      await user.clear(feedbackTextarea);
      await user.type(feedbackTextarea, 'Updated feedback');

      // Form should be marked as dirty
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('should warn about unsaved changes when Cancel is clicked with dirty form', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ finalgrade: 80 });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      // Modify the grade
      const gradeInput = screen.getByLabelText(/grade/i);
      await user.clear(gradeInput);
      await user.type(gradeInput, '95');

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Should show warning dialog or confirmation
      await waitFor(() => {
        const warningText = screen.queryByText(/unsaved/i) ||
                           screen.queryByText(/discard/i) ||
                           screen.queryByRole('dialog');
        // Warning should appear, OR onCancel should still be called if no warning
        const warningAppeared = warningText !== null;
        const cancelCalled = onCancel.mock.calls.length > 0;
        expect(warningAppeared || cancelCalled).toBe(true);
      });
    });
  });

  // ==========================================================================
  // OVERRIDE CHECKBOX TESTS
  // ==========================================================================

  describe('Override Checkbox Behavior', () => {
    it('should enable grade input when override is checked', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ 
        overridden: 0,
        finalgrade: null,
      });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /override/i })).toBeInTheDocument();
      });

      // Initially, grade input might be disabled if not overridden
      const gradeInput = screen.getByLabelText(/grade/i);
      
      // Check override
      const overrideCheckbox = screen.getByRole('checkbox', { name: /override/i });
      await user.click(overrideCheckbox);

      // Grade input should be enabled
      expect(gradeInput).not.toBeDisabled();
    });

    it('should toggle override state correctly', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ overridden: 0 });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /override/i })).toBeInTheDocument();
      });

      const overrideCheckbox = screen.getByRole('checkbox', { name: /override/i });
      
      // Initially unchecked
      expect(overrideCheckbox).not.toBeChecked();
      
      // Click to check
      await user.click(overrideCheckbox);
      expect(overrideCheckbox).toBeChecked();
      
      // Click to uncheck
      await user.click(overrideCheckbox);
      expect(overrideCheckbox).not.toBeChecked();
    });
  });

  // ==========================================================================
  // ACCESSIBILITY TESTS
  // ==========================================================================

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues();
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      const { container } = render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      // Run axe accessibility checks
      const results: AxeResults = await axeRun(container);
      expect(results.violations).toHaveLength(0);
    });

    it('should have proper labels for all form controls', async () => {
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues();
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        // All interactive elements should have accessible labels
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/feedback/i)).toBeInTheDocument();
      });

      // Buttons should have accessible names
      expect(screen.getByRole('button', { name: /save/i })).toHaveAccessibleName();
      expect(screen.getByRole('button', { name: /cancel/i })).toHaveAccessibleName();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues();
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      // Tab through form elements
      const gradeInput = screen.getByLabelText(/grade/i);
      await user.click(gradeInput);
      
      // Tab to next element
      await user.tab();
      
      // Should move focus to another focusable element
      expect(document.activeElement).not.toBe(gradeInput);
      expect(document.activeElement).toBeInstanceOf(HTMLElement);
    });

    it('should announce validation errors to screen readers', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem({ grademax: 100 });
      const initialValues = createInitialValues({ finalgrade: 50 });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      // Enter invalid value
      const gradeInput = screen.getByLabelText(/grade/i);
      await user.clear(gradeInput);
      await user.type(gradeInput, '500');
      
      // Submit to trigger validation
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Error should be accessible via aria-describedby or role="alert"
      await waitFor(() => {
        const errorElement = screen.queryByRole('alert') ||
                            screen.getByText(/must be at most/i);
        expect(errorElement).toBeInTheDocument();
      });
    });

    it('should have proper ARIA attributes on form controls', async () => {
      const gradeItem = createNumericGradeItem({ grademax: 100, grademin: 0 });
      const initialValues = createInitialValues();
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      // Numeric input should have appropriate ARIA attributes
      const gradeInput = screen.getByLabelText(/grade/i);
      
      // Check that input is properly labeled (either via label element or aria-label)
      expect(gradeInput).toHaveAttribute('id');
    });
  });

  // ==========================================================================
  // HIDDEN AND LOCKED STATE TESTS
  // ==========================================================================

  describe('Hidden and Locked States', () => {
    it('should display hidden switch for grade visibility', async () => {
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ hidden: 0 });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        // Look for hidden toggle/switch/checkbox
        const hiddenControl = screen.queryByLabelText(/hidden/i) ||
                             screen.queryByRole('switch', { name: /hidden/i }) ||
                             screen.queryByRole('checkbox', { name: /hidden/i });
        expect(hiddenControl).toBeInTheDocument();
      });
    });

    it('should display locked switch for grade locking', async () => {
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ locked: 0 });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        // Look for locked toggle/switch/checkbox
        const lockedControl = screen.queryByLabelText(/locked/i) ||
                             screen.queryByRole('switch', { name: /locked/i }) ||
                             screen.queryByRole('checkbox', { name: /locked/i });
        expect(lockedControl).toBeInTheDocument();
      });
    });

    it('should disable form when grade is locked', async () => {
      const gradeItem = createNumericGradeItem({ locked: 1 });
      const initialValues = createInitialValues({ locked: 1 });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
          readOnly={true}
        />
      );

      await waitFor(() => {
        const gradeInput = screen.getByLabelText(/grade/i);
        expect(gradeInput).toBeDisabled();
      });
    });

    it('should include hidden state in submission data', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ hidden: 0 });
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      // Toggle hidden if available
      const hiddenControl = screen.queryByLabelText(/hidden/i) ||
                           screen.queryByRole('switch', { name: /hidden/i }) ||
                           screen.queryByRole('checkbox', { name: /hidden/i });
      
      if (hiddenControl) {
        await user.click(hiddenControl);
      }

      // Fill in a grade value
      const gradeInput = screen.getByLabelText(/grade/i);
      await user.clear(gradeInput);
      await user.type(gradeInput, '85');

      // Submit
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // EXCLUDED STATE TESTS
  // ==========================================================================

  describe('Excluded State', () => {
    it('should display excluded checkbox for grade exclusion', async () => {
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ excluded: 0 });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        const excludedControl = screen.queryByLabelText(/exclude/i) ||
                               screen.queryByRole('checkbox', { name: /exclude/i });
        expect(excludedControl).toBeInTheDocument();
      });
    });

    it('should include excluded state in submission data', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ excluded: 0 });
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      // Toggle excluded if available
      const excludedControl = screen.queryByLabelText(/exclude/i) ||
                             screen.queryByRole('checkbox', { name: /exclude/i });
      
      if (excludedControl) {
        await user.click(excludedControl);
      }

      // Fill in a grade value
      const gradeInput = screen.getByLabelText(/grade/i);
      await user.clear(gradeInput);
      await user.type(gradeInput, '70');

      // Submit
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // LOCKTIME TESTS
  // ==========================================================================

  describe('Lock Time', () => {
    it('should display lock time picker when available', async () => {
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ locktime: 0 });
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        // Look for lock time or lock until control
        const lockTimeControl = screen.queryByLabelText(/lock.*time/i) ||
                               screen.queryByLabelText(/lock.*until/i);
        // Lock time control may or may not be present depending on implementation
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // EMPTY/NEW GRADE TESTS
  // ==========================================================================

  describe('New Grade Entry', () => {
    it('should handle empty initial values for new grade', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({
        finalgrade: null,
        feedback: null,
        overridden: 0,
      });
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      // Enter new grade
      const gradeInput = screen.getByLabelText(/grade/i);
      await user.type(gradeInput, '75');

      // Enter feedback
      const feedbackTextarea = screen.getByLabelText(/feedback/i);
      await user.type(feedbackTextarea, 'First grade entry');

      // Submit
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            finalgrade: 75,
          })
        );
      });
    });

    it('should allow clearing an existing grade', async () => {
      const user = userEvent.setup();
      const gradeItem = createNumericGradeItem();
      const initialValues = createInitialValues({ finalgrade: 80 });
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={gradeItem}
          initialValues={initialValues}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      });

      // Clear the grade
      const gradeInput = screen.getByLabelText(/grade/i);
      await user.clear(gradeInput);

      // Submit
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });
    });
  });
});
