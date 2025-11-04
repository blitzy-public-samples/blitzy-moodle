import React from 'react';
import { Controller, Control, FieldValues } from 'react-hook-form';
import { TextField, TextFieldProps } from '@mui/material';

/**
 * Props for the FormTextarea component
 * Multi-line text input with React Hook Form integration
 */
export interface FormTextareaProps {
  /** Field name for form registration */
  name: string;
  
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
  
  /** React Hook Form control object */
  control: Control<FieldValues>;
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
export const FormTextarea: React.FC<FormTextareaProps> = ({
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
  control,
}) => {
  return (
    <Controller
      name={name}
      control={control}
      rules={{
        required: required ? 'This field is required' : false,
        maxLength: maxLength ? {
          value: maxLength,
          message: `Maximum ${maxLength} characters allowed`
        } : undefined,
      }}
      render={({ field, fieldState }) => {
        const { error } = fieldState;
        const currentLength = field.value?.length || 0;
        
        // Build helper text with character counter
        let displayHelperText = helperText || '';
        if (maxLength) {
          const counterText = `${currentLength}/${maxLength}`;
          displayHelperText = displayHelperText 
            ? `${displayHelperText} (${counterText})`
            : counterText;
        }
        
        // Add error message to helper text if present
        if (error) {
          displayHelperText = error.message || 'Invalid input';
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
        const ariaDescribedBy = displayHelperText 
          ? `${name}-helper-text` 
          : undefined;
        
        return (
          <TextField
            {...field}
            fullWidth
            multiline
            {...rowProps}
            label={label}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            error={Boolean(error)}
            helperText={displayHelperText}
            inputProps={{
              maxLength: maxLength,
              'aria-label': label || name,
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
};
