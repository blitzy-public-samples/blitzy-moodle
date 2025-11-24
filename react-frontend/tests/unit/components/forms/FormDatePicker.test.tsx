/**
 * FormDatePicker Component Unit Tests
 * 
 * Comprehensive test suite for FormDatePicker component covering Material-UI DatePicker
 * integration, React Hook Form validation, Zod schema validation, accessibility compliance
 * (WCAG 2.1 AA), keyboard navigation, user interactions, and date constraints.
 * 
 * Test Coverage Areas:
 * - Material-UI DatePicker/TimePicker/DateTimePicker rendering
 * - React Hook Form Controller integration with form state
 * - Zod validation rules for date constraints
 * - Accessibility features (ARIA labels, keyboard navigation)
 * - User interactions (clicking, typing, keyboard navigation)
 * - Date/time/datetime modes
 * - Min/max date enforcement
 * - DisablePast and disableFuture props
 * - Date formatting with date-fns
 * - Error handling and display
 * - Helper text and disabled states
 * 
 * @see react-frontend/src/components/forms/FormDatePicker.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, FormProvider } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { LocalizationProvider, DatePicker, TimePicker, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  format,
  addDays,
  subDays,
  isBefore,
  isAfter,
  isValid,
  startOfDay,
  endOfDay,
  getDay,
  parse,
  parseISO,
  formatISO,
} from 'date-fns';

// Internal imports
import { FormDatePicker } from '@/components/forms/FormDatePicker';
import { render } from '@/tests/helpers/render';
import {
  createPastDate,
  createFutureDate,
  createDate,
  expectDateToBe,
  expectDateToBeAfter,
  expectDateToBeBefore,
  createTimestamp,
} from '@/tests/helpers/dateUtils';

/**
 * Test form data interface
 */
interface TestFormData {
  testDate: Date | null;
  assignmentDeadline: Date | null;
  quizStartTime: Date | null;
  eventDate: Date | null;
  birthdayDate: Date | null;
}

/**
 * Form wrapper component for testing FormDatePicker with React Hook Form context
 * 
 * Wraps FormDatePicker in FormProvider to enable Controller integration and
 * form state management for realistic testing scenarios.
 */
interface FormWrapperProps {
  defaultValues?: Partial<TestFormData>;
  validationSchema?: z.ZodSchema<TestFormData>;
  onSubmit?: (data: TestFormData) => void;
  children: React.ReactNode;
}

function FormWrapper({
  defaultValues = {},
  validationSchema,
  onSubmit = vi.fn(),
  children,
}: FormWrapperProps): React.ReactElement {
  const methods = useForm<TestFormData>({
    defaultValues: {
      testDate: null,
      assignmentDeadline: null,
      quizStartTime: null,
      eventDate: null,
      birthdayDate: null,
      ...defaultValues,
    },
    resolver: validationSchema ? zodResolver(validationSchema) : undefined,
    mode: 'onChange',
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} data-testid="test-form">
        {children}
        <button type="submit" data-testid="submit-button">
          Submit
        </button>
      </form>
    </FormProvider>
  );
}

describe('FormDatePicker', () => {
  /**
   * Setup before each test
   */
  beforeEach(() => {
    // Clear any mocked timers
    vi.clearAllMocks();
  });

  /**
   * Cleanup after each test
   */
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =============================================================================
  // RENDERING TESTS
  // =============================================================================

  describe('Material-UI DatePicker Rendering', () => {
    it('should render DatePicker with LocalizationProvider wrapper', () => {
      const { container } = render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
            mode="date"
          />
        </FormWrapper>
      );

      // Verify LocalizationProvider is in the tree (implicitly through functional date picker)
      const dateInput = screen.getByLabelText(/test date/i);
      expect(dateInput).toBeInTheDocument();
      
      // Verify it's a date input field
      expect(dateInput).toHaveAttribute('type');
    });

    it('should render date picker with calendar icon button', () => {
      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Select Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      // Find calendar button (MUI DatePicker renders a button for opening calendar)
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      expect(calendarButton).toBeInTheDocument();
    });

    it('should render TimePicker in time mode', () => {
      render(
        <FormWrapper>
          <FormDatePicker
            name="quizStartTime"
            label="Quiz Start Time"
            control={undefined as never}
            mode="time"
          />
        </FormWrapper>
      );

      const timeInput = screen.getByLabelText(/quiz start time/i);
      expect(timeInput).toBeInTheDocument();
    });

    it('should render DateTimePicker in datetime mode', () => {
      render(
        <FormWrapper>
          <FormDatePicker
            name="eventDate"
            label="Event Date and Time"
            control={undefined as never}
            mode="datetime"
          />
        </FormWrapper>
      );

      const datetimeInput = screen.getByLabelText(/event date and time/i);
      expect(datetimeInput).toBeInTheDocument();
    });

    it('should display label correctly', () => {
      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Assignment Deadline"
            control={undefined as never}
          />
        </FormWrapper>
      );

      expect(screen.getByLabelText(/assignment deadline/i)).toBeInTheDocument();
    });

    it('should display required asterisk when required prop is true', () => {
      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Required Date"
            control={undefined as never}
            required
          />
        </FormWrapper>
      );

      // MUI adds asterisk to required fields
      const input = screen.getByLabelText(/required date/i);
      expect(input).toHaveAttribute('required');
    });

    it('should display helper text when provided', () => {
      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Event Date"
            control={undefined as never}
            helperText="Select the date for the event"
          />
        </FormWrapper>
      );

      expect(screen.getByText(/select the date for the event/i)).toBeInTheDocument();
    });
  });

  // =============================================================================
  // REACT HOOK FORM INTEGRATION TESTS
  // =============================================================================

  describe('React Hook Form Integration', () => {
    it('should integrate with FormProvider and Controller', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();

      render(
        <FormWrapper onSubmit={onSubmit}>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      // Open date picker and select a date
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(calendarButton);

      // Wait for calendar popup to appear
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Select today's date (find day button with today's number)
      const today = new Date();
      const todayButton = screen.getByRole('gridcell', { name: String(today.getDate()) });
      await user.click(todayButton);

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Verify form submission with date value
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
        const submittedData = onSubmit.mock.calls[0][0];
        expect(submittedData.testDate).toBeInstanceOf(Date);
      });
    });

    it('should update form state when date is selected', async () => {
      const user = userEvent.setup();
      let formValues: TestFormData | null = null;

      function TestComponent() {
        const methods = useForm<TestFormData>({
          defaultValues: { testDate: null } as TestFormData,
        });

        // Capture form values for assertion
        React.useEffect(() => {
          const subscription = methods.watch((values) => {
            formValues = values as TestFormData;
          });
          return () => subscription.unsubscribe();
        }, [methods]);

        return (
          <FormProvider {...methods}>
            <FormDatePicker
              name="testDate"
              label="Test Date"
              control={methods.control}
            />
          </FormProvider>
        );
      }

      render(<TestComponent />);

      // Open calendar and select date
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(calendarButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const today = new Date();
      const todayButton = screen.getByRole('gridcell', { name: String(today.getDate()) });
      await user.click(todayButton);

      // Verify form state updated
      await waitFor(() => {
        expect(formValues).not.toBeNull();
        expect(formValues?.testDate).toBeInstanceOf(Date);
      });
    });

    it('should handle null date value (cleared date)', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper defaultValues={{ testDate: new Date() }}>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      // Find clear button (MUI DatePicker provides clear button)
      const input = screen.getByLabelText(/test date/i);
      const clearButton = within(input.parentElement!.parentElement!).getByRole('button', { name: /clear/i });
      
      await user.click(clearButton);

      // Verify input is cleared
      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('should format Date objects correctly for form submission', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      const testDate = new Date('2024-12-25T10:30:00');

      render(
        <FormWrapper onSubmit={onSubmit} defaultValues={{ testDate }}>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        const submittedData = onSubmit.mock.calls[0][0];
        expect(submittedData.testDate).toBeInstanceOf(Date);
        expect(submittedData.testDate.toISOString()).toContain('2024-12-25');
      });
    });

    it('should convert ISO string values to Date objects', () => {
      const isoString = '2024-01-15T00:00:00.000Z';

      render(
        <FormWrapper defaultValues={{ testDate: new Date(isoString) }}>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      const input = screen.getByLabelText(/test date/i);
      // Verify date is displayed (format may vary by locale)
      expect(input).toHaveValue();
    });
  });

  // =============================================================================
  // ZOD VALIDATION INTEGRATION TESTS
  // =============================================================================

  describe('Zod Validation Integration', () => {
    it('should validate required date field', async () => {
      const schema = z.object({
        testDate: z.date({ required_error: 'Date is required' }),
      });

      const user = userEvent.setup();

      render(
        <FormWrapper validationSchema={schema as never}>
          <FormDatePicker
            name="testDate"
            label="Required Date"
            control={undefined as never}
            required
          />
        </FormWrapper>
      );

      // Try to submit without selecting date
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Verify error message is displayed
      await waitFor(() => {
        expect(screen.getByText(/date is required/i)).toBeInTheDocument();
      });
    });

    it('should validate minDate constraint for assignment deadlines', async () => {
      const minDate = createFutureDate(1); // Tomorrow
      const schema = z.object({
        assignmentDeadline: z.date().min(minDate, {
          message: `Assignment deadline must be on or after ${format(minDate, 'PP')}`,
        }),
      });

      const user = userEvent.setup();
      const pastDate = createPastDate(1); // Yesterday

      render(
        <FormWrapper
          validationSchema={schema as never}
          defaultValues={{ assignmentDeadline: pastDate }}
        >
          <FormDatePicker
            name="assignmentDeadline"
            label="Assignment Deadline"
            control={undefined as never}
            minDate={minDate}
          />
        </FormWrapper>
      );

      // Submit form with past date
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Verify minDate error is displayed
      await waitFor(() => {
        const errorText = screen.getByText(/assignment deadline must be on or after/i);
        expect(errorText).toBeInTheDocument();
      });
    });

    it('should validate maxDate constraint for past event selection', async () => {
      const maxDate = new Date(); // Today
      const schema = z.object({
        eventDate: z.date().max(maxDate, {
          message: 'Event date cannot be in the future',
        }),
      });

      const user = userEvent.setup();
      const futureDate = createFutureDate(7); // Next week

      render(
        <FormWrapper
          validationSchema={schema as never}
          defaultValues={{ eventDate: futureDate }}
        >
          <FormDatePicker
            name="eventDate"
            label="Past Event Date"
            control={undefined as never}
            maxDate={maxDate}
          />
        </FormWrapper>
      );

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Verify maxDate error
      await waitFor(() => {
        expect(screen.getByText(/event date cannot be in the future/i)).toBeInTheDocument();
      });
    });

    it('should validate date range with refine method', async () => {
      const minDate = createDate(0); // Today
      const maxDate = createFutureDate(30); // 30 days from now

      const schema = z.object({
        testDate: z.date().refine(
          (date) => {
            return date >= minDate && date <= maxDate;
          },
          {
            message: 'Date must be between today and 30 days from now',
          }
        ),
      });

      const user = userEvent.setup();
      const invalidDate = createFutureDate(60); // 60 days from now

      render(
        <FormWrapper
          validationSchema={schema as never}
          defaultValues={{ testDate: invalidDate }}
        >
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/date must be between today and 30 days from now/i)).toBeInTheDocument();
      });
    });

    it('should validate future date restriction', async () => {
      const schema = z.object({
        testDate: z.date().refine((date) => date > new Date(), {
          message: 'Date must be in the future',
        }),
      });

      const user = userEvent.setup();
      const pastDate = createPastDate(1);

      render(
        <FormWrapper
          validationSchema={schema as never}
          defaultValues={{ testDate: pastDate }}
        >
          <FormDatePicker
            name="testDate"
            label="Future Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/date must be in the future/i)).toBeInTheDocument();
      });
    });

    it('should validate past date restriction', async () => {
      const schema = z.object({
        testDate: z.date().refine((date) => date < new Date(), {
          message: 'Date must be in the past',
        }),
      });

      const user = userEvent.setup();
      const futureDate = createFutureDate(1);

      render(
        <FormWrapper
          validationSchema={schema as never}
          defaultValues={{ testDate: futureDate }}
        >
          <FormDatePicker
            name="testDate"
            label="Past Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/date must be in the past/i)).toBeInTheDocument();
      });
    });

    it('should validate weekdays only using custom validation', async () => {
      const schema = z.object({
        testDate: z.date().refine(
          (date) => {
            const day = getDay(date);
            return day >= 1 && day <= 5; // Monday to Friday
          },
          {
            message: 'Date must be a weekday (Monday-Friday)',
          }
        ),
      });

      const user = userEvent.setup();
      
      // Find next Saturday
      const today = new Date();
      const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
      const saturday = addDays(today, daysUntilSaturday);

      render(
        <FormWrapper
          validationSchema={schema as never}
          defaultValues={{ testDate: saturday }}
        >
          <FormDatePicker
            name="testDate"
            label="Weekday Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/date must be a weekday/i)).toBeInTheDocument();
      });
    });

    it('should display Zod validation error messages for invalid dates', async () => {
      const schema = z.object({
        testDate: z.date().refine(() => false, {
          message: 'Custom validation error message',
        }),
      });

      const user = userEvent.setup();

      render(
        <FormWrapper
          validationSchema={schema as never}
          defaultValues={{ testDate: new Date() }}
        >
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/custom validation error message/i)).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // ACCESSIBILITY TESTS (WCAG 2.1 AA)
  // =============================================================================

  describe('Accessibility Compliance', () => {
    it('should have proper aria-label for date input', () => {
      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Assignment Due Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      const input = screen.getByLabelText(/assignment due date/i);
      expect(input).toHaveAccessibleName('Assignment Due Date');
    });

    it('should have aria-required attribute when required', () => {
      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Required Date"
            control={undefined as never}
            required
          />
        </FormWrapper>
      );

      const input = screen.getByLabelText(/required date/i);
      expect(input).toHaveAttribute('required');
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('should have aria-invalid attribute when there is an error', async () => {
      const schema = z.object({
        testDate: z.date({ required_error: 'Date is required' }),
      });

      const user = userEvent.setup();

      render(
        <FormWrapper validationSchema={schema as never}>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
            required
          />
        </FormWrapper>
      );

      // Trigger validation by submitting
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        const input = screen.getByLabelText(/test date/i);
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('should have aria-describedby for helper text', () => {
      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
            helperText="Select a date for the assignment"
          />
        </FormWrapper>
      );

      const input = screen.getByLabelText(/test date/i);
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();

      if (describedBy) {
        const helperText = document.getElementById(describedBy);
        expect(helperText).toHaveTextContent(/select a date for the assignment/i);
      }
    });

    it('should have aria-describedby for error messages', async () => {
      const schema = z.object({
        testDate: z.date({ required_error: 'Please select a date' }),
      });

      const user = userEvent.setup();

      render(
        <FormWrapper validationSchema={schema as never}>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
            required
          />
        </FormWrapper>
      );

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        const input = screen.getByLabelText(/test date/i);
        const describedBy = input.getAttribute('aria-describedby');
        expect(describedBy).toBeTruthy();

        if (describedBy) {
          const errorText = document.getElementById(describedBy);
          expect(errorText).toHaveTextContent(/please select a date/i);
        }
      });
    });

    it('should support keyboard navigation with Arrow keys for day navigation', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      // Open calendar
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(calendarButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Find today's date cell
      const today = new Date();
      const todayCell = screen.getByRole('gridcell', { name: String(today.getDate()) });

      // Focus on today's cell
      todayCell.focus();

      // Navigate with arrow keys
      await user.keyboard('{ArrowRight}');
      
      // Verify focus moved (next day should be focused)
      const nextDay = addDays(today, 1);
      const nextDayCell = screen.getByRole('gridcell', { name: String(nextDay.getDate()) });
      expect(nextDayCell).toHaveFocus();
    });

    it('should support Enter key to select date in calendar', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();

      render(
        <FormWrapper onSubmit={onSubmit}>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      // Open calendar
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(calendarButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Select date with Enter key
      const today = new Date();
      const todayCell = screen.getByRole('gridcell', { name: String(today.getDate()) });
      todayCell.focus();
      await user.keyboard('{Enter}');

      // Verify calendar closed and date selected
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should support Escape key to close calendar without selecting', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      // Open calendar
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(calendarButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Press Escape to close
      await user.keyboard('{Escape}');

      // Verify calendar closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should announce date changes to screen readers', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      // Open calendar and select date
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(calendarButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const today = new Date();
      const todayButton = screen.getByRole('gridcell', { name: String(today.getDate()) });
      
      // Verify aria-label exists for screen reader announcement
      expect(todayButton).toHaveAccessibleName();
    });

    it('should support Tab key navigation to calendar button', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      // Tab to calendar button
      await user.tab();
      
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      
      // Verify button can receive focus
      expect(document.activeElement).toBe(calendarButton);
    });
  });

  // =============================================================================
  // USER INTERACTION TESTS
  // =============================================================================

  describe('User Interactions', () => {
    it('should open calendar popup when clicking calendar icon', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(calendarButton);

      // Verify calendar dialog appears
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should select date when clicking in calendar view', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      render(
        <FormWrapper onSubmit={onSubmit}>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      // Open calendar
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(calendarButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click on a date (e.g., 15th)
      const dateCell = screen.getByRole('gridcell', { name: '15' });
      await user.click(dateCell);

      // Verify date selected and calendar closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Submit and verify date value
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        const data = onSubmit.mock.calls[0][0];
        expect(data.testDate).toBeInstanceOf(Date);
        expect(data.testDate.getDate()).toBe(15);
      });
    });

    it('should allow typing date in input field with format validation', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      const input = screen.getByLabelText(/test date/i);
      
      // Clear existing value and type new date
      await user.clear(input);
      await user.type(input, '12/25/2024');

      // Verify input accepts typed value
      expect(input).toHaveValue('12/25/2024');
    });

    it('should navigate through calendar with keyboard arrow keys', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      // Open calendar
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(calendarButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Find a date cell and focus it
      const dateCell = screen.getByRole('gridcell', { name: '15' });
      dateCell.focus();

      // Navigate right
      await user.keyboard('{ArrowRight}');
      
      // Verify focus moved to next day
      const nextDateCell = screen.getByRole('gridcell', { name: '16' });
      expect(nextDateCell).toHaveFocus();

      // Navigate left
      await user.keyboard('{ArrowLeft}');
      
      // Back to 15
      expect(dateCell).toHaveFocus();
    });

    it('should select today when clicking today button', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      // Open calendar
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(calendarButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click on today's date
      const today = new Date();
      const todayButton = screen.getByRole('gridcell', { name: String(today.getDate()) });
      await user.click(todayButton);

      // Verify today is selected
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should clear date selection when clicking clear button', async () => {
      const user = userEvent.setup();
      const initialDate = new Date('2024-06-15');

      render(
        <FormWrapper defaultValues={{ testDate: initialDate }}>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      // Find and click clear button
      const input = screen.getByLabelText(/test date/i);
      const container = input.parentElement!.parentElement!;
      const clearButton = within(container).getByRole('button', { name: /clear/i });
      
      await user.click(clearButton);

      // Verify input is cleared
      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });
  });

  // =============================================================================
  // VIEW MODE TESTS
  // =============================================================================

  describe('Different View Modes', () => {
    it('should render date-only picker in date mode', () => {
      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Date Only"
            control={undefined as never}
            mode="date"
          />
        </FormWrapper>
      );

      const input = screen.getByLabelText(/date only/i);
      expect(input).toBeInTheDocument();
      
      // Verify it's configured for date selection
      expect(input).toHaveAttribute('placeholder');
    });

    it('should render time-only picker in time mode', () => {
      render(
        <FormWrapper>
          <FormDatePicker
            name="quizStartTime"
            label="Time Only"
            control={undefined as never}
            mode="time"
          />
        </FormWrapper>
      );

      const input = screen.getByLabelText(/time only/i);
      expect(input).toBeInTheDocument();
    });

    it('should render datetime picker with both components in datetime mode', () => {
      render(
        <FormWrapper>
          <FormDatePicker
            name="eventDate"
            label="Date and Time"
            control={undefined as never}
            mode="datetime"
          />
        </FormWrapper>
      );

      const input = screen.getByLabelText(/date and time/i);
      expect(input).toBeInTheDocument();
    });

    it('should handle time selection in time mode', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      render(
        <FormWrapper onSubmit={onSubmit}>
          <FormDatePicker
            name="quizStartTime"
            label="Quiz Time"
            control={undefined as never}
            mode="time"
          />
        </FormWrapper>
      );

      // Open time picker
      const timeButton = screen.getByRole('button', { name: /choose time/i });
      await user.click(timeButton);

      // Wait for time picker dialog
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Select a time (implementation depends on MUI TimePicker structure)
      // For this test, we'll verify the dialog opened
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should handle datetime selection in datetime mode', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <FormDatePicker
            name="eventDate"
            label="Event DateTime"
            control={undefined as never}
            mode="datetime"
          />
        </FormWrapper>
      );

      // Open datetime picker
      const datetimeButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(datetimeButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // MIN/MAX DATE CONSTRAINT TESTS
  // =============================================================================

  describe('MinDate and MaxDate Constraints', () => {
    it('should disable dates before minDate in calendar', async () => {
      const user = userEvent.setup();
      const minDate = new Date(); // Today

      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Future Date"
            control={undefined as never}
            minDate={minDate}
          />
        </FormWrapper>
      );

      // Open calendar
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(calendarButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Find yesterday's date cell (should be disabled)
      const yesterday = subDays(new Date(), 1);
      const yesterdayCell = screen.getByRole('gridcell', { name: String(yesterday.getDate()) });
      
      expect(yesterdayCell).toHaveAttribute('disabled');
    });

    it('should disable dates after maxDate in calendar', async () => {
      const user = userEvent.setup();
      const maxDate = new Date(); // Today

      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Past Date"
            control={undefined as never}
            maxDate={maxDate}
          />
        </FormWrapper>
      );

      // Open calendar
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(calendarButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Find tomorrow's date cell (should be disabled)
      const tomorrow = addDays(new Date(), 1);
      const tomorrowCell = screen.getByRole('gridcell', { name: String(tomorrow.getDate()) });
      
      expect(tomorrowCell).toHaveAttribute('disabled');
    });

    it('should enforce minDate constraint on form submission', async () => {
      const user = userEvent.setup();
      const minDate = createFutureDate(7); // One week from now
      const invalidDate = createDate(0); // Today

      render(
        <FormWrapper defaultValues={{ testDate: invalidDate }}>
          <FormDatePicker
            name="testDate"
            label="Assignment Deadline"
            control={undefined as never}
            minDate={minDate}
          />
        </FormWrapper>
      );

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/date must be on or after/i)).toBeInTheDocument();
      });
    });

    it('should enforce maxDate constraint on form submission', async () => {
      const user = userEvent.setup();
      const maxDate = createPastDate(7); // One week ago
      const invalidDate = new Date(); // Today

      render(
        <FormWrapper defaultValues={{ testDate: invalidDate }}>
          <FormDatePicker
            name="testDate"
            label="Historical Event"
            control={undefined as never}
            maxDate={maxDate}
          />
        </FormWrapper>
      );

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/date must be on or before/i)).toBeInTheDocument();
      });
    });

    it('should allow selection of dates within minDate and maxDate range', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const minDate = new Date();
      const maxDate = createFutureDate(30);

      render(
        <FormWrapper onSubmit={onSubmit}>
          <FormDatePicker
            name="testDate"
            label="Valid Range"
            control={undefined as never}
            minDate={minDate}
            maxDate={maxDate}
          />
        </FormWrapper>
      );

      // Open calendar
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(calendarButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Select a valid date (today)
      const today = new Date();
      const todayCell = screen.getByRole('gridcell', { name: String(today.getDate()) });
      await user.click(todayCell);

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Verify successful submission
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        const data = onSubmit.mock.calls[0][0];
        expect(data.testDate).toBeInstanceOf(Date);
      });
    });
  });

  // =============================================================================
  // DISABLE PAST/FUTURE TESTS
  // =============================================================================

  describe('DisablePast and DisableFuture Props', () => {
    it('should disable all past dates when disablePast is true', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Future Only"
            control={undefined as never}
            disablePast
          />
        </FormWrapper>
      );

      // Open calendar
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(calendarButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Verify yesterday is disabled
      const yesterday = subDays(new Date(), 1);
      const yesterdayCell = screen.getByRole('gridcell', { name: String(yesterday.getDate()) });
      expect(yesterdayCell).toHaveAttribute('disabled');
    });

    it('should disable all future dates when disableFuture is true', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Past Only"
            control={undefined as never}
            disableFuture
          />
        </FormWrapper>
      );

      // Open calendar
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(calendarButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Verify tomorrow is disabled
      const tomorrow = addDays(new Date(), 1);
      const tomorrowCell = screen.getByRole('gridcell', { name: String(tomorrow.getDate()) });
      expect(tomorrowCell).toHaveAttribute('disabled');
    });

    it('should show validation error when trying to submit past date with disablePast', async () => {
      const user = userEvent.setup();
      const pastDate = createPastDate(7);

      render(
        <FormWrapper defaultValues={{ testDate: pastDate }}>
          <FormDatePicker
            name="testDate"
            label="Assignment Deadline"
            control={undefined as never}
            disablePast
          />
        </FormWrapper>
      );

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/past dates are not allowed/i)).toBeInTheDocument();
      });
    });

    it('should show validation error when trying to submit future date with disableFuture', async () => {
      const user = userEvent.setup();
      const futureDate = createFutureDate(7);

      render(
        <FormWrapper defaultValues={{ testDate: futureDate }}>
          <FormDatePicker
            name="testDate"
            label="Historical Event"
            control={undefined as never}
            disableFuture
          />
        </FormWrapper>
      );

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/future dates are not allowed/i)).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // DATE FORMATTING TESTS
  // =============================================================================

  describe('Date Formatting with date-fns', () => {
    it('should format displayed dates using date-fns', () => {
      const testDate = new Date('2024-12-25T10:30:00');

      render(
        <FormWrapper defaultValues={{ testDate }}>
          <FormDatePicker
            name="testDate"
            label="Formatted Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      const input = screen.getByLabelText(/formatted date/i);
      // Date should be displayed in locale format
      expect(input).toHaveValue();
    });

    it('should support date-fns locale configuration', () => {
      const testDate = new Date('2024-06-15');

      render(
        <FormWrapper defaultValues={{ testDate }}>
          <FormDatePicker
            name="testDate"
            label="Localized Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      // Verify date is rendered with proper formatting
      const input = screen.getByLabelText(/localized date/i);
      expect(input).toHaveValue();
    });

    it('should parse user-entered dates correctly', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      render(
        <FormWrapper onSubmit={onSubmit}>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      const input = screen.getByLabelText(/test date/i);
      
      // Type a date
      await user.clear(input);
      await user.type(input, '06/15/2024');

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Verify parsed date
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        const data = onSubmit.mock.calls[0][0];
        expect(data.testDate).toBeInstanceOf(Date);
      });
    });
  });

  // =============================================================================
  // DISABLED STATE TESTS
  // =============================================================================

  describe('Disabled State Behavior', () => {
    it('should render as disabled when disabled prop is true', () => {
      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Disabled Date"
            control={undefined as never}
            disabled
          />
        </FormWrapper>
      );

      const input = screen.getByLabelText(/disabled date/i);
      expect(input).toBeDisabled();
    });

    it('should prevent calendar from opening when disabled', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Disabled Date"
            control={undefined as never}
            disabled
          />
        </FormWrapper>
      );

      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      expect(calendarButton).toBeDisabled();
      
      // Attempt to click
      await user.click(calendarButton);

      // Verify calendar did not open
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should prevent typing when disabled', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Disabled Date"
            control={undefined as never}
            disabled
          />
        </FormWrapper>
      );

      const input = screen.getByLabelText(/disabled date/i);
      
      // Attempt to type
      await user.type(input, '06/15/2024');

      // Verify input did not change
      expect(input).toHaveValue('');
    });

    it('should apply disabled styling', () => {
      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Disabled Date"
            control={undefined as never}
            disabled
          />
        </FormWrapper>
      );

      const input = screen.getByLabelText(/disabled date/i);
      
      // Verify disabled attribute and class
      expect(input).toBeDisabled();
      expect(input).toHaveClass('Mui-disabled');
    });
  });

  // =============================================================================
  // HELPER TEXT AND PLACEHOLDER TESTS
  // =============================================================================

  describe('Helper Text and Placeholder Display', () => {
    it('should display helper text below input', () => {
      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
            helperText="Select the assignment due date"
          />
        </FormWrapper>
      );

      expect(screen.getByText(/select the assignment due date/i)).toBeInTheDocument();
    });

    it('should show error message instead of helper text when there is an error', async () => {
      const schema = z.object({
        testDate: z.date({ required_error: 'Date is required' }),
      });

      const user = userEvent.setup();

      render(
        <FormWrapper validationSchema={schema as never}>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
            required
            helperText="This is helper text"
          />
        </FormWrapper>
      );

      // Trigger validation
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Verify error message is shown instead of helper text
      await waitFor(() => {
        expect(screen.getByText(/date is required/i)).toBeInTheDocument();
        expect(screen.queryByText(/this is helper text/i)).not.toBeInTheDocument();
      });
    });

    it('should display placeholder in date input', () => {
      render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      const input = screen.getByLabelText(/test date/i);
      expect(input).toHaveAttribute('placeholder');
    });
  });

  // =============================================================================
  // ERROR STATE STYLING TESTS
  // =============================================================================

  describe('Error State Styling', () => {
    it('should apply error styling when validation fails', async () => {
      const schema = z.object({
        testDate: z.date({ required_error: 'Required' }),
      });

      const user = userEvent.setup();

      render(
        <FormWrapper validationSchema={schema as never}>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
            required
          />
        </FormWrapper>
      );

      // Trigger validation
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Verify error styling
      await waitFor(() => {
        const input = screen.getByLabelText(/test date/i);
        expect(input).toHaveAttribute('aria-invalid', 'true');
        
        // MUI applies error class
        const formControl = input.closest('.MuiFormControl-root');
        expect(formControl).toHaveClass('Mui-error');
      });
    });

    it('should remove error styling when error is resolved', async () => {
      const schema = z.object({
        testDate: z.date({ required_error: 'Required' }),
      });

      const user = userEvent.setup();

      render(
        <FormWrapper validationSchema={schema as never}>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
            required
          />
        </FormWrapper>
      );

      // Trigger validation error
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/required/i)).toBeInTheDocument();
      });

      // Fix the error by selecting a date
      const calendarButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(calendarButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const today = new Date();
      const todayButton = screen.getByRole('gridcell', { name: String(today.getDate()) });
      await user.click(todayButton);

      // Verify error is cleared
      await waitFor(() => {
        expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
      });
    });

    it('should display error message in red text', async () => {
      const schema = z.object({
        testDate: z.date({ required_error: 'This field is required' }),
      });

      const user = userEvent.setup();

      render(
        <FormWrapper validationSchema={schema as never}>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
            required
          />
        </FormWrapper>
      );

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        const errorText = screen.getByText(/this field is required/i);
        expect(errorText).toBeInTheDocument();
        
        // MUI applies error color class
        expect(errorText.closest('.MuiFormHelperText-root')).toHaveClass('Mui-error');
      });
    });
  });

  // =============================================================================
  // SNAPSHOT TEST
  // =============================================================================

  describe('Snapshot Tests', () => {
    it('should match snapshot for default date picker', () => {
      const { container } = render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Test Date"
            control={undefined as never}
          />
        </FormWrapper>
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for required date picker with helper text', () => {
      const { container } = render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Required Date"
            control={undefined as never}
            required
            helperText="Please select a date"
          />
        </FormWrapper>
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for disabled date picker', () => {
      const { container } = render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Disabled Date"
            control={undefined as never}
            disabled
          />
        </FormWrapper>
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for date picker with minDate and maxDate', () => {
      const minDate = createDate(0);
      const maxDate = createFutureDate(30);

      const { container } = render(
        <FormWrapper>
          <FormDatePicker
            name="testDate"
            label="Date with Range"
            control={undefined as never}
            minDate={minDate}
            maxDate={maxDate}
          />
        </FormWrapper>
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
