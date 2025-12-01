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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { render, screen, waitFor, within, userEvent } from '../helpers/render';
import { createMockGrade, createMockGradeItem, createMockTeacher } from '../helpers/mockData';
import { GradeEditForm } from '@/features/gradebook/components/GradeEditForm';
import type { Grade, GradeItem } from '@/features/gradebook/types/grade.types';

/**
 * Base API URL for gradebook endpoints
 */
const API_BASE_URL = '/api/v1';

/**
 * Creates a test grade item with customizable properties
 * @param overrides - Properties to override default values
 * @returns A complete GradeItem object for testing
 */
function createTestGradeItem(overrides: Partial<GradeItem> = {}): GradeItem {
  return createMockGradeItem({
    id: 101,
    courseid: 1,
    itemname: 'Test Assignment',
    itemtype: 'mod',
    itemmodule: 'assign',
    grademin: 0,
    grademax: 100,
    gradepass: 50,
    decimals: 2,
    locked: false,
    hidden: false,
    ...overrides,
  });
}

/**
 * Creates a test grade with customizable properties
 * @param overrides - Properties to override default values
 * @returns A complete Grade object for testing
 */
function createTestGrade(overrides: Partial<Grade> = {}): Grade {
  return createMockGrade({
    id: 1001,
    itemid: 101,
    userid: 2,
    rawgrade: 85.5,
    finalgrade: 85.5,
    feedback: '',
    overridden: false,
    excluded: false,
    hidden: false,
    locked: false,
    locktime: null,
    timecreated: Date.now() - 86400000, // 1 day ago
    timemodified: Date.now() - 3600000, // 1 hour ago
    ...overrides,
  });
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

describe('Grade Editing Integration Tests', () => {
  // Common test data
  let mockTeacher: ReturnType<typeof createMockTeacher>;
  let mockGradeItem: GradeItem;
  let mockGrade: Grade;

  beforeEach(() => {
    // Initialize fresh test data for each test
    mockTeacher = createMockTeacher({
      id: 3,
      firstname: 'John',
      lastname: 'Teacher',
      email: 'teacher@example.com',
    });
    mockGradeItem = createTestGradeItem();
    mockGrade = createTestGrade();

    // Mock window.scrollTo to prevent jsdom errors
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    // Reset all MSW handlers to default state after each test
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('Basic Grade Editing', () => {
    it('should display grade edit form with current grade value', async () => {
      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
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

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={onSave}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      
      // Clear and enter new grade
      await user.clear(gradeInput);
      await user.type(gradeInput, '92.5');

      expect(gradeInput).toHaveValue(92.5);
    });

    it('should display grade item information (name, max points)', () => {
      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Should show the assignment name and max grade
      expect(screen.getByText(/Test Assignment/i)).toBeInTheDocument();
      expect(screen.getByText(/100/)).toBeInTheDocument();
    });

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
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

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
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

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
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
      const user = userEvent.setup();
      
      // Grade item with 1 decimal place
      const gradeItemOneDecimal = createTestGradeItem({ decimals: 1 });

      render(
        <GradeEditForm
          gradeItem={gradeItemOneDecimal}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '85.567');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show error about decimal places
      await waitFor(() => {
        expect(screen.getByText(/too many decimal places/i)).toBeInTheDocument();
      });
    });

    it('should show error when API returns 422 for out-of-range grade', async () => {
      const user = userEvent.setup();

      // Override handler to return validation error
      server.use(
        http.put(`${API_BASE_URL}/gradebook/items/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Grade is outside valid range',
                details: {
                  field: 'grade',
                  min: 0,
                  max: 100,
                },
              },
            },
            { status: 422 }
          );
        })
      );

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '95');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show the API error message
      await waitFor(() => {
        expect(screen.getByText(/Grade is outside valid range/i)).toBeInTheDocument();
      });
    });

    it('should accept valid grades within range', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();

      // Override handler for successful update
      server.use(
        http.put(`${API_BASE_URL}/gradebook/items/:id`, async ({ request }) => {
          const body = await request.json() as { grade: number };
          return HttpResponse.json({
            success: true,
            data: {
              grade: {
                ...mockGrade,
                rawgrade: body.grade,
                finalgrade: body.grade,
                timemodified: Date.now(),
              },
            },
          });
        })
      );

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={onSave}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '88');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should not show any error messages
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('Locked Grades', () => {
    it('should display lock indicator for locked grades', () => {
      const lockedGrade = createTestGrade({ locked: true, locktime: Date.now() });

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={lockedGrade}
          studentId={lockedGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Should show lock icon or indicator
      expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
    });

    it('should disable grade input for locked grades', () => {
      const lockedGrade = createTestGrade({ locked: true });

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={lockedGrade}
          studentId={lockedGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      expect(gradeInput).toBeDisabled();
    });

    it('should disable save button for locked grades', () => {
      const lockedGrade = createTestGrade({ locked: true });

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={lockedGrade}
          studentId={lockedGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should show 409 Conflict error when trying to save locked grade via API', async () => {
      const user = userEvent.setup();

      // Override handler to return 409 Conflict for locked grade
      server.use(
        http.put(`${API_BASE_URL}/gradebook/items/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'GRADE_LOCKED',
                message: 'Cannot modify a locked grade',
                details: {
                  locktime: Date.now() - 86400000,
                  lockedby: 'system',
                },
              },
            },
            { status: 409 }
          );
        })
      );

      // Render with non-locked grade but simulate API returns locked
      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show the conflict error
      await waitFor(() => {
        expect(screen.getByText(/Cannot modify a locked grade/i)).toBeInTheDocument();
      });
    });

    it('should display lock time when grade is locked', () => {
      const lockTime = Date.now() - 86400000; // Locked 1 day ago
      const lockedGrade = createTestGrade({ locked: true, locktime: lockTime });

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={lockedGrade}
          studentId={lockedGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Should display when the grade was locked
      expect(screen.getByText(/locked/i)).toBeInTheDocument();
    });
  });

  describe('Override Grades', () => {
    it('should display override checkbox', () => {
      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const overrideCheckbox = screen.getByRole('checkbox', { name: /override/i });
      expect(overrideCheckbox).toBeInTheDocument();
    });

    it('should show override checkbox checked when grade is overridden', () => {
      const overriddenGrade = createTestGrade({ overridden: true });

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={overriddenGrade}
          studentId={overriddenGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const overrideCheckbox = screen.getByRole('checkbox', { name: /override/i });
      expect(overrideCheckbox).toBeChecked();
    });

    it('should toggle override state when checkbox is clicked', async () => {
      const user = userEvent.setup();

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
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

    it('should send override flag in API request when saving', async () => {
      const user = userEvent.setup();
      let capturedRequest: { grade: number; overridden: boolean } | null = null;

      server.use(
        http.put(`${API_BASE_URL}/gradebook/items/:id`, async ({ request }) => {
          capturedRequest = await request.json() as { grade: number; overridden: boolean };
          return HttpResponse.json({
            success: true,
            data: {
              grade: {
                ...mockGrade,
                rawgrade: capturedRequest.grade,
                finalgrade: capturedRequest.grade,
                overridden: capturedRequest.overridden,
                timemodified: Date.now(),
              },
            },
          });
        })
      );

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const overrideCheckbox = screen.getByRole('checkbox', { name: /override/i });
      await user.click(overrideCheckbox);

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '95');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
        expect(capturedRequest?.overridden).toBe(true);
      });
    });

    it('should allow overriding a calculated grade', async () => {
      const user = userEvent.setup();
      
      // Create a category total item (calculated grade)
      const categoryItem = createTestGradeItem({
        itemtype: 'category',
        itemname: 'Category Total',
        calculation: '=average([[item1]],[[item2]])',
      });

      const categoryGrade = createTestGrade({
        itemid: categoryItem.id,
        rawgrade: 80,
        finalgrade: 80,
      });

      render(
        <GradeEditForm
          gradeItem={categoryItem}
          grade={categoryGrade}
          studentId={categoryGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Should display info about calculated grade
      expect(screen.getByText(/calculated/i)).toBeInTheDocument();

      const overrideCheckbox = screen.getByRole('checkbox', { name: /override/i });
      await user.click(overrideCheckbox);

      // Grade input should now be editable
      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      expect(gradeInput).not.toBeDisabled();
    });
  });

  describe('Save Operations', () => {
    it('should call PUT API endpoint on save', async () => {
      const user = userEvent.setup();
      let apiCalled = false;

      server.use(
        http.put(`${API_BASE_URL}/gradebook/items/:id`, () => {
          apiCalled = true;
          return HttpResponse.json({
            success: true,
            data: {
              grade: {
                ...mockGrade,
                rawgrade: 90,
                finalgrade: 90,
                timemodified: Date.now(),
              },
            },
          });
        })
      );

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(apiCalled).toBe(true);
      });
    });

    it('should show success toast on successful save', async () => {
      const user = userEvent.setup();

      server.use(
        http.put(`${API_BASE_URL}/gradebook/items/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              grade: {
                ...mockGrade,
                rawgrade: 90,
                finalgrade: 90,
                timemodified: Date.now(),
              },
            },
            meta: {
              message: 'Grade saved successfully',
            },
          });
        })
      );

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/grade saved/i)).toBeInTheDocument();
      });
    });

    it('should call onSave callback with updated grade after successful API response', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();

      server.use(
        http.put(`${API_BASE_URL}/gradebook/items/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              grade: {
                ...mockGrade,
                rawgrade: 90,
                finalgrade: 90,
                timemodified: Date.now(),
              },
            },
          });
        })
      );

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={onSave}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            rawgrade: 90,
            finalgrade: 90,
          })
        );
      });
    });

    it('should show loading state while saving', async () => {
      const user = userEvent.setup();

      // Delay the response to test loading state
      server.use(
        http.put(`${API_BASE_URL}/gradebook/items/:id`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: {
              grade: mockGrade,
            },
          });
        })
      );

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show loading indicator
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should show error message on API failure', async () => {
      const user = userEvent.setup();

      server.use(
        http.put(`${API_BASE_URL}/gradebook/items/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'SERVER_ERROR',
                message: 'An unexpected error occurred',
              },
            },
            { status: 500 }
          );
        })
      );

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
      });
    });

    it('should show 403 error when user lacks grade editing permission', async () => {
      const user = userEvent.setup();

      server.use(
        http.put(`${API_BASE_URL}/gradebook/items/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to edit grades',
                details: {
                  required_capability: 'moodle/grade:edit',
                },
              },
            },
            { status: 403 }
          );
        })
      );

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '90');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/permission/i)).toBeInTheDocument();
      });
    });
  });

  describe('Grade History and Audit Trail', () => {
    it('should display history button for viewing grade history', () => {
      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      expect(historyButton).toBeInTheDocument();
    });

    it('should open grade history modal when history button is clicked', async () => {
      const user = userEvent.setup();

      // Mock the grade history API endpoint
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

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      await user.click(historyButton);

      // Should open the modal
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/grade history/i)).toBeInTheDocument();
      });
    });

    it('should display previous grade values in history modal', async () => {
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

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      await user.click(historyButton);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        
        // Should show the old and new grade values
        expect(within(modal).getByText('75')).toBeInTheDocument();
        expect(within(modal).getByText('85.5')).toBeInTheDocument();
      });
    });

    it('should display timestamps for grade history entries', async () => {
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

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      await user.click(historyButton);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        
        // Should display formatted timestamps
        expect(within(modal).getByText(/ago/i)).toBeInTheDocument();
      });
    });

    it('should display who made each grade change in audit trail', async () => {
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

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      await user.click(historyButton);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        
        // Should show who made the change
        expect(within(modal).getByText('John Teacher')).toBeInTheDocument();
      });
    });

    it('should display action type (create, update) in grade history', async () => {
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

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
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

    it('should close history modal when close button is clicked', async () => {
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

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
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

    it('should show empty state when no grade history exists', async () => {
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

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
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
      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const feedbackInput = screen.getByRole('textbox', { name: /feedback/i });
      expect(feedbackInput).toBeInTheDocument();
    });

    it('should allow entering feedback text', async () => {
      const user = userEvent.setup();

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const feedbackInput = screen.getByRole('textbox', { name: /feedback/i });
      await user.type(feedbackInput, 'Great work on this assignment!');

      expect(feedbackInput).toHaveValue('Great work on this assignment!');
    });

    it('should include feedback in save request', async () => {
      const user = userEvent.setup();
      let capturedRequest: { grade: number; feedback: string } | null = null;

      server.use(
        http.put(`${API_BASE_URL}/gradebook/items/:id`, async ({ request }) => {
          capturedRequest = await request.json() as { grade: number; feedback: string };
          return HttpResponse.json({
            success: true,
            data: {
              grade: {
                ...mockGrade,
                feedback: capturedRequest.feedback,
                timemodified: Date.now(),
              },
            },
          });
        })
      );

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const feedbackInput = screen.getByRole('textbox', { name: /feedback/i });
      await user.type(feedbackInput, 'Well done!');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
        expect(capturedRequest?.feedback).toBe('Well done!');
      });
    });
  });

  describe('Excluded Grades', () => {
    it('should display excluded checkbox', () => {
      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const excludedCheckbox = screen.getByRole('checkbox', { name: /exclude/i });
      expect(excludedCheckbox).toBeInTheDocument();
    });

    it('should show excluded checkbox checked when grade is excluded', () => {
      const excludedGrade = createTestGrade({ excluded: true });

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={excludedGrade}
          studentId={excludedGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const excludedCheckbox = screen.getByRole('checkbox', { name: /exclude/i });
      expect(excludedCheckbox).toBeChecked();
    });

    it('should include excluded flag in save request', async () => {
      const user = userEvent.setup();
      let capturedRequest: { grade: number; excluded: boolean } | null = null;

      server.use(
        http.put(`${API_BASE_URL}/gradebook/items/:id`, async ({ request }) => {
          capturedRequest = await request.json() as { grade: number; excluded: boolean };
          return HttpResponse.json({
            success: true,
            data: {
              grade: {
                ...mockGrade,
                excluded: capturedRequest.excluded,
                timemodified: Date.now(),
              },
            },
          });
        })
      );

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const excludedCheckbox = screen.getByRole('checkbox', { name: /exclude/i });
      await user.click(excludedCheckbox);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
        expect(capturedRequest?.excluded).toBe(true);
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

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={onSave}
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

    it('should allow cancellation with Escape key', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
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

      render(
        <GradeEditForm
          gradeItem={mockGradeItem}
          grade={mockGrade}
          studentId={mockGrade.userid}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Tab through the form
      await user.tab();
      expect(screen.getByRole('spinbutton', { name: /grade/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('textbox', { name: /feedback/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('checkbox', { name: /override/i })).toHaveFocus();
    });
  });
});
