/**
 * FormInput Component
 *
 * A reusable form input component that wraps Material-UI TextField and integrates
 * with React Hook Form for validation and state management. Supports multiple input
 * types with built-in accessibility, error handling, and visual feedback.
 *
 * Features:
 * - Integration with React Hook Form via Controller
 * - Support for text, email, password, number, url, tel input types
 * - Password visibility toggle with eye icon
 * - Start and end adornments for icons/buttons
 * - Comprehensive accessibility (ARIA attributes)
 * - Validation error display
 * - Input constraints (maxLength, pattern)
 * - Material Design styling via MUI
 */

import { useState } from 'react';
import type { Control, FieldValues, Path } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import type { TextFieldProps } from '@mui/material';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

/**
 * Supported input types for the FormInput component
 */
export type FormInputType = 'text' | 'email' | 'password' | 'number' | 'url' | 'tel';

/**
 * Supported input modes for virtual keyboards
 */
export type InputMode = 'text' | 'email' | 'tel' | 'url' | 'numeric' | 'decimal' | 'search';

/**
 * Props for the FormInput component
 * @template T - The type of form values, defaults to FieldValues
 */
export interface FormInputProps<T extends FieldValues = FieldValues> {
  /**
   * Name of the form field - used for form registration and identification
   */
  name: Path<T>;

  /**
   * Label text displayed above/inside the input field
   */
  label: string;

  /**
   * Input type - determines keyboard, validation, and behavior
   * @default 'text'
   */
  type?: FormInputType;

  /**
   * Whether the field is required for form submission
   * @default false
   */
  required?: boolean;

  /**
   * Whether the field is disabled and non-interactive
   * @default false
   */
  disabled?: boolean;

  /**
   * Placeholder text shown when field is empty
   */
  placeholder?: string;

  /**
   * Helper text displayed below the input field
   * Useful for providing format guidance or additional context
   */
  helperText?: string;

  /**
   * Autocomplete attribute for browser autofill behavior
   * Examples: 'email', 'current-password', 'new-password', 'username', 'tel'
   */
  autoComplete?: string;

  /**
   * Maximum number of characters allowed in the input
   */
  maxLength?: number;

  /**
   * Regular expression pattern for input validation
   * Note: Primary validation should be handled via React Hook Form schema
   */
  pattern?: string;

  /**
   * Element displayed at the start of the input field (typically an icon)
   */
  startAdornment?: React.ReactNode;

  /**
   * Element displayed at the end of the input field (typically an icon)
   * Note: For password fields, visibility toggle icon is automatically added
   */
  endAdornment?: React.ReactNode;

  /**
   * Input mode hint for virtual keyboards on mobile devices
   * @default Automatically determined from type prop
   */
  inputMode?: InputMode;

  /**
   * React Hook Form control object for field registration and management
   * Required for integration with form state and validation
   */
  control: Control<T>;

  /**
   * Variant of the TextField component
   * @default 'outlined'
   */
  variant?: TextFieldProps['variant'];

  /**
   * Size of the TextField component
   * @default 'medium'
   */
  size?: TextFieldProps['size'];

  /**
   * Whether the input should take up full width of its container
   * @default true
   */
  fullWidth?: boolean;

  /**
   * Margin spacing around the input field
   * @default 'normal'
   */
  margin?: TextFieldProps['margin'];

  /**
   * Whether the input should automatically receive focus when the component mounts
   * @default false
   */
  autoFocus?: boolean;

  /**
   * Number of rows for multiline input (converts to textarea)
   * If specified, overrides type to create textarea
   */
  rows?: number;

  /**
   * Whether the textarea should be multiline
   * @default false
   */
  multiline?: boolean;

  /**
   * Minimum number of rows for multiline input
   */
  minRows?: number;

  /**
   * Maximum number of rows for multiline input
   */
  maxRows?: number;
}

/**
 * Determines the appropriate inputMode based on the input type
 * This optimizes virtual keyboard display on mobile devices
 */
const getInputModeFromType = (type: FormInputType): InputMode => {
  switch (type) {
    case 'email':
      return 'email';
    case 'tel':
      return 'tel';
    case 'url':
      return 'url';
    case 'number':
      return 'numeric';
    default:
      return 'text';
  }
};

/**
 * FormInput Component
 *
 * A controlled form input component that integrates Material-UI TextField
 * with React Hook Form for seamless form state management and validation.
 *
 * @example
 * // Basic text input
 * <FormInput
 *   name="username"
 *   label="Username"
 *   control={control}
 *   required
 * />
 *
 * @example
 * // Email input with validation
 * <FormInput
 *   name="email"
 *   label="Email Address"
 *   type="email"
 *   control={control}
 *   required
 *   autoComplete="email"
 *   placeholder="user@example.com"
 * />
 *
 * @example
 * // Password input with visibility toggle
 * <FormInput
 *   name="password"
 *   label="Password"
 *   type="password"
 *   control={control}
 *   required
 *   autoComplete="current-password"
 * />
 *
 * @example
 * // Number input with icon
 * <FormInput
 *   name="age"
 *   label="Age"
 *   type="number"
 *   control={control}
 *   startAdornment={<PersonIcon />}
 *   helperText="Enter your age in years"
 * />
 */
export function FormInput<T extends FieldValues = FieldValues>({
  name,
  label,
  type = 'text',
  required = false,
  disabled = false,
  placeholder,
  helperText,
  autoComplete,
  maxLength,
  pattern,
  startAdornment,
  endAdornment,
  inputMode,
  control,
  variant = 'outlined',
  size = 'medium',
  fullWidth = true,
  margin = 'normal',
  autoFocus = false,
  rows,
  multiline = false,
  minRows,
  maxRows,
}: FormInputProps<T>): JSX.Element {
  // State for password visibility toggle
  const [showPassword, setShowPassword] = useState(false);

  /**
   * Toggles password visibility between hidden and visible
   */
  const handleTogglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  /**
   * Prevents default behavior on mouse down to maintain focus on input
   */
  const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  // Determine the actual input type to use
  // For password fields, toggle between 'password' and 'text' based on visibility state
  const actualInputType = type === 'password' ? (showPassword ? 'text' : 'password') : type;

  // Determine the input mode for virtual keyboards
  const actualInputMode = inputMode ?? getInputModeFromType(type);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        // Build input props object for TextField
        const inputProps: TextFieldProps['inputProps'] = {
          'aria-label': label,
          'aria-required': required,
          'aria-invalid': !!error,
          'aria-describedby': error
            ? `${name}-error`
            : helperText
              ? `${name}-helper-text`
              : undefined,
          inputMode: actualInputMode,
          ...(maxLength && { maxLength }),
          ...(pattern && { pattern }),
        };

        // Build start adornment
        const startAdornmentElement = startAdornment ? (
          <InputAdornment position="start">{startAdornment}</InputAdornment>
        ) : undefined;

        // Build end adornment
        // For password fields, add visibility toggle icon
        let endAdornmentElement: React.ReactNode = undefined;

        if (type === 'password') {
          endAdornmentElement = (
            <InputAdornment position="end">
              <IconButton
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={handleTogglePasswordVisibility}
                onMouseDown={handleMouseDownPassword}
                edge="end"
                size={size === 'small' ? 'small' : 'medium'}
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
              {endAdornment}
            </InputAdornment>
          );
        } else if (endAdornment) {
          endAdornmentElement = <InputAdornment position="end">{endAdornment}</InputAdornment>;
        }

        return (
          <TextField
            {...field}
            label={label}
            type={actualInputType}
            variant={variant}
            size={size}
            fullWidth={fullWidth}
            margin={margin}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            autoComplete={autoComplete}
            autoFocus={autoFocus} // eslint-disable-line jsx-a11y/no-autofocus
            multiline={multiline}
            rows={rows}
            minRows={minRows}
            maxRows={maxRows}
            error={!!error}
            helperText={
              error ? (
                <span id={`${name}-error`} role="alert">
                  {error.message}
                </span>
              ) : helperText ? (
                <span id={`${name}-helper-text`}>{helperText}</span>
              ) : undefined
            }
            InputProps={{
              startAdornment: startAdornmentElement,
              endAdornment: endAdornmentElement,
            }}
            inputProps={inputProps}
          />
        );
      }}
    />
  );
}

export default FormInput;
