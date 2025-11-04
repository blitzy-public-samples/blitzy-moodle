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

import React from 'react';
import {
  Controller,
  Control,
  FieldError,
  FieldValues,
  Path,
} from 'react-hook-form';
import {
  DatePicker,
  TimePicker,
  DateTimePicker,
  LocalizationProvider,
} from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  TextField,
  FormControl,
  FormHelperText,
  TextFieldProps,
} from '@mui/material';
import {
  format,
  parse,
  isValid,
  isBefore,
  isAfter,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
} from 'date-fns';

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
}: FormDatePickerProps<TFieldValues>): React.ReactElement {
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
        return minDate
          ? `Date must be on or after ${format(minDate, 'PP')}`
          : 'Date is too early';
      case 'max':
        return maxDate
          ? `Date must be on or before ${format(maxDate, 'PP')}`
          : 'Date is too late';
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
      slotProps: {
        textField: {
          required,
          error: Boolean(error),
          helperText: error ? getErrorMessage(error) : helperText,
          fullWidth: true,
          onBlur: field.onBlur,
          // Accessibility attributes
          'aria-label': label,
          'aria-required': required,
          'aria-invalid': Boolean(error),
          'aria-describedby': error
            ? `${name}-error`
            : helperText
            ? `${name}-helper`
            : undefined,
        } as TextFieldProps,
      },
    };

    // Render appropriate picker based on mode
    switch (mode) {
      case 'time':
        return (
          <TimePicker
            {...commonProps}
            views={views as Array<'hours' | 'minutes' | 'seconds'>}
          />
        );

      case 'datetime':
        return (
          <DateTimePicker
            {...commonProps}
            views={
              views as Array<'year' | 'month' | 'day' | 'hours' | 'minutes'>
            }
          />
        );

      case 'date':
      default:
        return (
          <DatePicker
            {...commonProps}
            views={views as Array<'year' | 'month' | 'day'>}
          />
        );
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <FormControl fullWidth error={false}>
        <Controller
          name={name}
          control={control}
          rules={{
            required: required ? `${label} is required` : false,
            validate: (value: Date | null) => {
              // Skip validation if field is not required and value is null
              if (!required && !value) {
                return true;
              }

              // Validate that value exists for required fields
              if (required && !value) {
                return `${label} is required`;
              }

              // Validate that date is valid
              if (value && !isValid(value)) {
                return 'Invalid date format';
              }

              // Validate date is in allowed range
              if (value && !isDateInRange(value)) {
                if (minDate && isBefore(value, startOfDay(minDate))) {
                  return `Date must be on or after ${format(minDate, 'PP')}`;
                }
                if (maxDate && isAfter(value, endOfDay(maxDate))) {
                  return `Date must be on or before ${format(maxDate, 'PP')}`;
                }
                if (disablePast && isBefore(value, startOfDay(new Date()))) {
                  return 'Past dates are not allowed';
                }
                if (disableFuture && isAfter(value, endOfDay(new Date()))) {
                  return 'Future dates are not allowed';
                }
                return 'Invalid date selected';
              }

              return true;
            },
          }}
          render={({ field, fieldState: { error } }) => {
            // Convert field value to Date object if it's a string
            const dateValue =
              field.value instanceof Date
                ? field.value
                : field.value
                ? parse(
                    String(field.value),
                    mode === 'time'
                      ? 'HH:mm:ss'
                      : mode === 'datetime'
                      ? "yyyy-MM-dd'T'HH:mm:ss"
                      : 'yyyy-MM-dd',
                    new Date()
                  )
                : null;

            // Handler to convert Date back to appropriate format for form
            const handleChange = (date: Date | null): void => {
              if (!date || !isValid(date)) {
                field.onChange(null);
                return;
              }

              // Store Date object directly in form state
              // React Hook Form handles serialization if needed
              field.onChange(date);
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

        {/* Additional helper text for non-error states */}
        {!required && helperText && (
          <FormHelperText id={`${name}-helper`}>{helperText}</FormHelperText>
        )}
      </FormControl>
    </LocalizationProvider>
  );
}

/**
 * Default export for convenient importing
 */
export default FormDatePicker;
