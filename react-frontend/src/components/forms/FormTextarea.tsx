import { Controller, useFormContext } from 'react-hook-form';
import type { Control, FieldValues, Path } from 'react-hook-form';
import { TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';

/**
 * Props for the FormTextarea component
 * Multi-line text input with React Hook Form integration
 */
export interface FormTextareaProps<TFieldValues extends FieldValues = FieldValues> {
  /** Field name for form registration */
  name: Path<TFieldValues>;

  /** Label text displayed above the textarea */
  label?: string;

  /** Whether the field is required */
  required?: boolean;

  /** Whether the field is disabled */
  disabled?: boolean;

  /** Placeholder text shown when empty */
  placeholder?: string;

  /** Helper text displayed below the textarea */
  helperText?: string;

  /** Fixed number of rows (overrides minRows/maxRows if set) */
  rows?: number;

  /** Minimum number of rows when autoResize is true */
  minRows?: number;

  /** Maximum number of rows when autoResize is true */
  maxRows?: number;

  /** Maximum character length (enables character counter) */
  maxLength?: number;

  /** Enable auto-growing height based on content */
  autoResize?: boolean;

  /** Whether the field should take full width of its container */
  fullWidth?: boolean;

  /** Callback fired when the textarea receives focus */
  onFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;

  /** Callback fired when the textarea loses focus */
  onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;

  /** React Hook Form control object (optional, uses context if not provided) */
  control?: Control<TFieldValues>;
}

/**
 * FormTextarea Component
 *
 * A multi-line text input component integrated with React Hook Form and Material-UI.
 * Supports character counting, auto-resize, validation, and full accessibility.
 *
 * Features:
 * - React Hook Form Controller integration for state management
 * - Character counting when maxLength is specified
 * - Auto-growing height with minRows/maxRows constraints
 * - Validation error display from form state
 * - Full ARIA accessibility attributes
 * - Material-UI theming support
 *
 * Usage:
 * ```tsx
 * <FormTextarea
 *   name="description"
 *   label="Course Description"
 *   control={control}
 *   required
 *   maxLength={500}
 *   autoResize
 *   minRows={3}
 *   maxRows={10}
 *   placeholder="Enter course description..."
 * />
 * ```
 *
 * @param props - FormTextarea component props
 * @returns Controlled multi-line text input component
 */
export function FormTextarea<TFieldValues extends FieldValues = FieldValues>({
  name,
  label,
  required = false,
  disabled = false,
  placeholder,
  helperText,
  rows,
  minRows = 3,
  maxRows,
  maxLength,
  autoResize = false,
  fullWidth = true,
  onFocus,
  onBlur,
  control: controlProp,
}: FormTextareaProps<TFieldValues>): JSX.Element {
  // Always call useFormContext unconditionally to satisfy React Hooks rules
  // If a control prop is provided, it will take precedence over the context value
  // This component must be used within a FormProvider wrapper
  const formContext = useFormContext<TFieldValues>();
  const control = controlProp ?? formContext?.control as Control<TFieldValues> | undefined;

  if (!control) {
    throw new Error('FormTextarea must be used within a FormProvider or have control prop');
  }

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const { error } = fieldState;
        // Use Array.from to correctly count multi-byte characters (emojis, etc.)
        const currentLength = typeof field.value === 'string' ? Array.from(field.value).length : 0;

        // Build helper text with character counter
        let displayHelperText = helperText ?? '';
        if (maxLength) {
          const counterText = `${currentLength} / ${maxLength}`;
          displayHelperText = displayHelperText
            ? `${displayHelperText} (${counterText})`
            : counterText;
        }

        // Add error message to helper text if present
        if (error) {
          const errorMessage = error.message ?? 'Invalid input';
          displayHelperText = displayHelperText
            ? `${errorMessage}. ${displayHelperText}`
            : errorMessage;
        }

        // Determine row configuration based on autoResize setting
        const rowProps: Pick<TextFieldProps, 'rows' | 'minRows' | 'maxRows'> = {};
        if (rows !== undefined) {
          // Fixed rows takes precedence
          rowProps.rows = rows;
        } else if (autoResize) {
          // Auto-resize with min/max constraints
          rowProps.minRows = minRows;
          if (maxRows !== undefined) {
            rowProps.maxRows = maxRows;
          }
        } else {
          // Default fixed rows
          rowProps.rows = minRows;
        }

        // Build ARIA attributes for accessibility
        const ariaDescribedBy = displayHelperText ? `${name}-helper-text` : undefined;

        return (
          <TextField
            {...field}
            fullWidth={fullWidth}
            multiline
            {...rowProps}
            label={label}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            error={Boolean(error)}
            helperText={displayHelperText}
            onFocus={onFocus}
            onBlur={(e) => {
              field.onBlur();
              onBlur?.(e as React.FocusEvent<HTMLTextAreaElement>);
            }}
            inputProps={{
              maxLength,
              'aria-label': label ?? name,
              'aria-describedby': ariaDescribedBy,
              'aria-invalid': Boolean(error),
              'aria-required': required,
            }}
            FormHelperTextProps={{
              id: `${name}-helper-text`,
            }}
            // Keyboard shortcuts handling
            onKeyDown={(e) => {
              // Allow Tab key for indentation (prevent default tab navigation)
              // Users can still use Ctrl+Tab for tab navigation
              if (e.key === 'Tab' && !e.ctrlKey && !e.shiftKey) {
                // Optional: could implement Tab indentation here
                // For now, allow default behavior for accessibility
              }
            }}
          />
        );
      }}
    />
  );
}
