/**
 * FormDatePicker Component
 *
 * React form component for date and time selection using Material-UI DatePicker
 * with React Hook Form integration. Provides accessible date/time input with
 * validation, error handling, and flexible configuration options.
 *
 * Features:
 * - Supports date-only, time-only, and datetime modes
 * - Integrates with React Hook Form for validation and state management
 * - Min/max date constraints with validation
 * - Disable past/future dates
 * - Accessible labels and error messages (WCAG 2.1 AA compliant)
 * - Material-UI v5 theming and styling
 * - Date-fns for date manipulation and formatting
 *
 * Usage:
 * ```tsx
 * <FormDatePicker
 *   name="deadline"
 *   label="Assignment Deadline"
 *   control={control}
 *   required
 *   minDate={new Date()}
 *   disablePast
 * />
 * ```
 */

import type React from 'react';
import type { Control, FieldError, FieldValues, Path } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { DatePicker, TimePicker, DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import type { TextFieldProps } from '@mui/material';
import { FormControl } from '@mui/material';
import { format, parse, isValid, isBefore, isAfter, startOfDay, endOfDay, formatISO } from 'date-fns';
import type { Locale } from 'date-fns';

/**
 * Props interface for FormDatePicker component
 *
 * @template TFieldValues - Type of form values from React Hook Form
 */
export interface FormDatePickerProps<TFieldValues extends FieldValues = FieldValues> {
  /**
   * Name of the field in the form (used for registration with React Hook Form)
   */
  name: Path<TFieldValues>;

  /**
   * Label displayed above the date picker input
   */
  label: string;

  /**
   * Control object from React Hook Form useForm hook
   * Connects this component to the parent form's state management
   */
  control: Control<TFieldValues>;

  /**
   * Whether the field is required (adds asterisk to label and validation)
   * @default false
   */
  required?: boolean;

  /**
   * Whether the date picker is disabled (greyed out and non-interactive)
   * @default false
   */
  disabled?: boolean;

  /**
   * Minimum selectable date (dates before this are disabled)
   */
  minDate?: Date;

  /**
   * Maximum selectable date (dates after this are disabled)
   */
  maxDate?: Date;

  /**
   * Disable all dates in the past (before today)
   * @default false
   */
  disablePast?: boolean;

  /**
   * Disable all dates in the future (after today)
   * @default false
   */
  disableFuture?: boolean;

  /**
   * Array of date views to show in the picker
   * For date mode: ['year', 'month', 'day']
   * For time mode: ['hours', 'minutes', 'seconds']
   * For datetime mode: ['year', 'month', 'day', 'hours', 'minutes']
   */
  views?: Array<'year' | 'month' | 'day' | 'hours' | 'minutes' | 'seconds'>;

  /**
   * Helper text displayed below the input (for guidance, not errors)
   */
  helperText?: string;

  /**
   * Mode of the date picker
   * - 'date': Date only (default)
   * - 'time': Time only
   * - 'datetime': Both date and time
   * @default 'date'
   */
  mode?: 'date' | 'time' | 'datetime';

  /**
   * Display format for the date/time in the input field
   * Uses date-fns format tokens (e.g., 'MM/dd/yyyy', 'HH:mm', 'dd/MM/yyyy HH:mm')
   * @default 'MM/dd/yyyy' for date mode, 'HH:mm' for time mode
   */
  format?: string;

  /**
   * Output format for the form value
   * - 'date': Returns Date object (default)
   * - 'iso': Returns ISO 8601 string
   * - 'string': Returns formatted string using display format
   * @default 'date'
   */
  outputFormat?: 'date' | 'iso' | 'string';

  /**
   * Locale for date formatting and calendar localization
   * Uses date-fns locale objects (e.g., enUS, es, fr)
   * @default enUS
   */
  locale?: Locale;
}

/**
 * FormDatePicker Component
 *
 * Material-UI date picker integrated with React Hook Form for seamless
 * form state management, validation, and error handling. Supports multiple
 * modes (date, time, datetime) and accessibility features.
 *
 * @template TFieldValues - Type of form values from React Hook Form
 */
export function FormDatePicker<TFieldValues extends FieldValues = FieldValues>({
  name,
  label,
  control,
  required = false,
  disabled = false,
  minDate,
  maxDate,
  disablePast = false,
  disableFuture = false,
  views,
  helperText,
  mode = 'date',
  format: customFormat,
  outputFormat = 'date',
  locale,
}: FormDatePickerProps<TFieldValues>): React.ReactElement {
  /**
   * Determines the display format based on mode and custom format
   */
  const getDisplayFormat = (): string => {
    if (customFormat) {
      return customFormat;
    }
    
    switch (mode) {
      case 'time':
        return 'HH:mm';
      case 'datetime':
        return 'MM/dd/yyyy HH:mm';
      case 'date':
      default:
        return 'MM/dd/yyyy';
    }
  };

  const displayFormat = getDisplayFormat();

  /**
   * Validates that a date is within the allowed range
   *
   * @param date - Date to validate
   * @returns True if date is valid and within range
   */
  const isDateInRange = (date: Date | null): boolean => {
    if (!date || !isValid(date)) {
      return false;
    }

    // Check minimum date constraint
    if (minDate && isBefore(date, startOfDay(minDate))) {
      return false;
    }

    // Check maximum date constraint
    if (maxDate && isAfter(date, endOfDay(maxDate))) {
      return false;
    }

    // Check disablePast constraint
    if (disablePast && isBefore(date, startOfDay(new Date()))) {
      return false;
    }

    // Check disableFuture constraint
    if (disableFuture && isAfter(date, endOfDay(new Date()))) {
      return false;
    }

    return true;
  };

  /**
   * Determines if a specific date should be disabled in the calendar
   *
   * @param date - Date to check
   * @returns True if the date should be disabled
   */
  const shouldDisableDate = (date: Date): boolean => {
    return !isDateInRange(date);
  };

  /**
   * Formats error message from React Hook Form field error
   *
   * @param error - Field error object from React Hook Form
   * @returns Formatted error message string
   */
  const getErrorMessage = (error: FieldError | undefined): string => {
    if (!error) {
      return '';
    }

    // Return custom error message if provided
    if (error.message) {
      return error.message;
    }

    // Generate default error messages based on error type
    switch (error.type) {
      case 'required':
        return `${label} is required`;
      case 'min':
        return minDate ? `Date must be on or after ${format(minDate, 'PP')}` : 'Date is too early';
      case 'max':
        return maxDate ? `Date must be on or before ${format(maxDate, 'PP')}` : 'Date is too late';
      case 'validate':
        return 'Invalid date selected';
      default:
        return 'Invalid date';
    }
  };

  /**
   * Renders the appropriate date picker component based on mode
   */
  const renderPicker = (
    field: {
      value: Date | null;
      onChange: (date: Date | null) => void;
      onBlur: () => void;
    },
    error: FieldError | undefined
  ): React.ReactElement => {
    const commonProps = {
      label,
      value: field.value,
      onChange: field.onChange,
      disabled,
      minDate,
      maxDate,
      disablePast,
      disableFuture,
      shouldDisableDate,
      format: displayFormat,
      slotProps: {
        textField: {
          required,
          error: Boolean(error),
          helperText: error ? getErrorMessage(error) : helperText,
          fullWidth: true,
          onBlur: field.onBlur,
          // Accessibility attributes
          // Note: We set aria-label on the input element through inputProps
          // to ensure the accessible name matches the label
          inputProps: {
            'aria-label': label,
          },
          'aria-required': required,
          'aria-invalid': Boolean(error),
          'aria-describedby': error ? `${name}-error` : helperText ? `${name}-helper` : undefined,
        } as TextFieldProps,
        openPickerButton: {
          'aria-label': `Choose ${label.toLowerCase()}`,
        },
        dialog: {
          'aria-label': `${label} picker dialog`,
        },
        actionBar: {
          // Enable action buttons in the calendar dialog
          // 'clear' button for clearing the selection
          // 'cancel' button for closing without changes
          // 'accept' button for confirming the selection
          // 'today' button for quickly selecting today's date
          actions: ['clear', 'cancel', 'accept', 'today'] as Array<'clear' | 'cancel' | 'accept' | 'today'>,
        },
      },
    };

    // Render appropriate picker based on mode
    switch (mode) {
      case 'time':
        return (
          <TimePicker {...commonProps} views={views as Array<'hours' | 'minutes' | 'seconds'>} />
        );

      case 'datetime':
        return (
          <DateTimePicker
            {...commonProps}
            views={views as Array<'year' | 'month' | 'day' | 'hours' | 'minutes'>}
          />
        );

      case 'date':
      default:
        return <DatePicker {...commonProps} views={views as Array<'year' | 'month' | 'day'>} />;
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
      <FormControl fullWidth error={false}>
        <Controller
          name={name}
          control={control}
          rules={{
            required: required ? `${label} is required` : false,
            validate: (value: Date | string | null) => {
              // Skip validation if field is not required and value is null/undefined/empty
              if (!required && !value) {
                return true;
              }

              // Validate that value exists for required fields
              if (required && !value) {
                return `${label} is required`;
              }

              // Convert value to Date object for validation
              // Handle different output formats: Date object, ISO string, or formatted string
              let dateToValidate: Date | null = null;
              if (value instanceof Date) {
                dateToValidate = value;
              } else if (typeof value === 'string') {
                // Try parsing as ISO format first
                if (value.includes('T') || value.includes('Z')) {
                  dateToValidate = new Date(value);
                } else {
                  // Parse using display format
                  dateToValidate = parse(value, displayFormat, new Date());
                }
              }

              // Validate that date is valid
              if (dateToValidate && !isValid(dateToValidate)) {
                return 'Invalid date format';
              }

              // Validate date is in allowed range
              if (dateToValidate && !isDateInRange(dateToValidate)) {
                if (minDate && isBefore(dateToValidate, startOfDay(minDate))) {
                  return `Date must be on or after ${format(minDate, 'PP')}`;
                }
                if (maxDate && isAfter(dateToValidate, endOfDay(maxDate))) {
                  return `Date must be on or before ${format(maxDate, 'PP')}`;
                }
                if (disablePast && isBefore(dateToValidate, startOfDay(new Date()))) {
                  return 'Past dates are not allowed';
                }
                if (disableFuture && isAfter(dateToValidate, endOfDay(new Date()))) {
                  return 'Future dates are not allowed';
                }
                return 'Invalid date selected';
              }

              return true;
            },
          }}
          render={({ field, fieldState: { error } }) => {
            // Convert field value to Date object if it's a string
            // Use type casting to handle generic field value type
            const rawValue = field.value as Date | string | null | undefined;
            const dateValue =
              rawValue instanceof Date
                ? rawValue
                : rawValue
                  ? parse(
                      String(rawValue),
                      // Try to parse ISO format first, then custom format
                      String(rawValue).includes('T') ? "yyyy-MM-dd'T'HH:mm:ss" : displayFormat,
                      new Date()
                    )
                  : null;

            // Handler to convert Date back to appropriate format for form
            const handleChange = (date: Date | null): void => {
              if (!date || !isValid(date)) {
                field.onChange(null);
                return;
              }

              // Convert to specified output format
              switch (outputFormat) {
                case 'iso':
                  field.onChange(formatISO(date));
                  break;
                case 'string':
                  field.onChange(format(date, displayFormat, locale ? { locale } : undefined));
                  break;
                case 'date':
                default:
                  field.onChange(date);
                  break;
              }
            };

            return renderPicker(
              {
                value: dateValue,
                onChange: handleChange,
                onBlur: field.onBlur,
              },
              error
            );
          }}
        />
      </FormControl>
    </LocalizationProvider>
  );
}

/**
 * Default export for convenient importing
 */
export default FormDatePicker;
