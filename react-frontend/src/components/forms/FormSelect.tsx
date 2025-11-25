/**
 * FormSelect Component
 *
 * A reusable form select component that integrates Material-UI Select with React Hook Form.
 * Supports single and multiple selection modes, option groups, search functionality,
 * and comprehensive validation with accessibility features.
 *
 * Features:
 * - Single and multiple selection modes
 * - Option grouping with ListSubheader
 * - Search/filter functionality via Autocomplete
 * - Disabled options support
 * - Full React Hook Form integration
 * - WCAG 2.1 AA compliant with proper ARIA attributes
 * - Error state display with helper text
 * - Placeholder support for empty state
 *
 * @module components/forms/FormSelect
 */

import React from 'react';
import { Controller } from 'react-hook-form';
import type {
  Control,
  FieldError,
  FieldValues,
  Path,
  PathValue,
  ControllerRenderProps,
} from 'react-hook-form';
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  ListSubheader,
  Autocomplete,
  Chip,
  TextField,
} from '@mui/material';

/**
 * Interface defining the structure of a select option
 */
export interface SelectOption {
  /** The value to be submitted with the form */
  value: string | number;

  /** The display label shown to the user */
  label: string;

  /** Whether this option is disabled and cannot be selected */
  disabled?: boolean;

  /** Optional group name for organizing options into categories */
  group?: string;
}

/**
 * Props interface for the FormSelect component
 */
export interface FormSelectProps<TFieldValues extends FieldValues = FieldValues> {
  /** The name of the field in the form state */
  name: Path<TFieldValues>;

  /** The label text displayed above the select */
  label: string;

  /** Array of options to display in the dropdown */
  options: SelectOption[];

  /** Whether the field is required for form submission */
  required?: boolean;

  /** Whether the select is disabled */
  disabled?: boolean;

  /** Whether multiple options can be selected */
  multiple?: boolean;

  /** Placeholder text shown when no value is selected */
  placeholder?: string;

  /** Helper text displayed below the select field */
  helperText?: string;

  /** React Hook Form control object */
  control: Control<TFieldValues>;

  /** Whether to enable search/filter functionality for large option lists */
  searchable?: boolean;

  /** Optional function to group options (alternative to group property) */
  groupBy?: (option: SelectOption) => string;
}

/**
 * FormSelect Component
 *
 * A wrapper around Material-UI Select that integrates with React Hook Form
 * for form state management and validation.
 *
 * @example
 * ```tsx
 * <FormSelect
 *   name="role"
 *   label="User Role"
 *   control={control}
 *   options={[
 *     { value: 'student', label: 'Student' },
 *     { value: 'teacher', label: 'Teacher' },
 *     { value: 'admin', label: 'Administrator' }
 *   ]}
 *   required
 * />
 * ```
 *
 * @example With option groups
 * ```tsx
 * <FormSelect
 *   name="course"
 *   label="Select Course"
 *   control={control}
 *   options={[
 *     { value: 'math101', label: 'Math 101', group: 'Mathematics' },
 *     { value: 'math201', label: 'Math 201', group: 'Mathematics' },
 *     { value: 'eng101', label: 'English 101', group: 'English' }
 *   ]}
 * />
 * ```
 *
 * @example With search functionality
 * ```tsx
 * <FormSelect
 *   name="country"
 *   label="Country"
 *   control={control}
 *   options={countryOptions}
 *   searchable
 *   placeholder="Search for a country..."
 * />
 * ```
 */
export function FormSelect<TFieldValues extends FieldValues = FieldValues>({
  name,
  label,
  options,
  required = false,
  disabled = false,
  multiple = false,
  placeholder,
  helperText,
  control,
  searchable = false,
  groupBy,
}: FormSelectProps<TFieldValues>) {
  // Generate unique IDs for accessibility
  const labelId = `${name}-label`;
  const helperId = `${name}-helper`;

  /**
   * Groups options by their group property or groupBy function
   */
  const groupedOptions = React.useMemo(() => {
    if (!groupBy && !options.some((opt) => opt.group)) {
      return { ungrouped: options };
    }

    const grouped: Record<string, SelectOption[]> = {};

    options.forEach((option) => {
      const groupName = groupBy ? groupBy(option) : (option.group ?? 'Other');
      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(option);
    });

    return grouped;
  }, [options, groupBy]);

  /**
   * Determines if options should be grouped
   */
  const hasGroups =
    Object.keys(groupedOptions).length > 1 ||
    (Object.keys(groupedOptions).length === 1 && !groupedOptions.ungrouped);

  /**
   * Renders the select component with standard Material-UI Select
   */
  const renderStandardSelect = (
    field: ControllerRenderProps<TFieldValues, Path<TFieldValues>>,
    fieldState: { error?: FieldError }
  ) => {
    const hasError = !!fieldState.error;
    const errorMessage = fieldState.error?.message;

    return (
      <FormControl fullWidth required={required} disabled={disabled} error={hasError}>
        <InputLabel id={labelId}>{label}</InputLabel>
        <Select
          {...field}
          labelId={labelId}
          id={name}
          label={label}
          multiple={multiple}
          displayEmpty={!!placeholder}
          SelectDisplayProps={{
            'aria-describedby': hasError || helperText ? helperId : undefined,
            'aria-invalid': hasError ? 'true' : 'false',
            'aria-required': required ? 'true' : 'false',
          }}
          renderValue={
            multiple
              ? (selected: unknown) => {
                  if (!selected || (Array.isArray(selected) && selected.length === 0)) {
                    return <em style={{ color: 'text.secondary' }}>{placeholder}</em>;
                  }

                  if (Array.isArray(selected)) {
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {selected.map((value: string | number) => {
                          const option = options.find((opt) => opt.value === value);
                          return (
                            <Chip
                              key={String(value)}
                              label={option?.label ?? String(value)}
                              size="small"
                            />
                          );
                        })}
                      </div>
                    );
                  }

                  const option = options.find((opt) => opt.value === selected);
                  return option?.label ?? String(selected);
                }
              : undefined
          }
        >
          {placeholder && !multiple && (
            <MenuItem value="" disabled>
              <em>{placeholder}</em>
            </MenuItem>
          )}

          {hasGroups
            ? Object.entries(groupedOptions).map(([groupName, groupOptions]) => [
                <ListSubheader key={`group-${groupName}`}>{groupName}</ListSubheader>,
                ...groupOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </MenuItem>
                )),
              ])
            : options.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </MenuItem>
              ))}
        </Select>

        {(hasError || helperText) && (
          <FormHelperText id={helperId}>{errorMessage ?? helperText}</FormHelperText>
        )}
      </FormControl>
    );
  };

  /**
   * Renders the searchable select component using Autocomplete
   */
  const renderSearchableSelect = (
    field: ControllerRenderProps<TFieldValues, Path<TFieldValues>>,
    fieldState: { error?: FieldError }
  ) => {
    const hasError = !!fieldState.error;
    const errorMessage = fieldState.error?.message;

    // Find the selected option(s)
    const selectedOptions = multiple
      ? options.filter((opt) => {
          const values = field.value as unknown;
          return Array.isArray(values) && values.includes(opt.value);
        })
      : (options.find((opt) => opt.value === field.value) ?? null);

    return (
      <Autocomplete
        multiple={multiple}
        options={options}
        value={selectedOptions}
        onChange={(_, newValue: SelectOption | SelectOption[] | null) => {
          if (multiple && Array.isArray(newValue)) {
            field.onChange(newValue.map((opt) => opt.value));
          } else if (!multiple && newValue && !Array.isArray(newValue)) {
            field.onChange(newValue.value);
          } else {
            field.onChange(multiple ? [] : '');
          }
        }}
        getOptionLabel={(option: SelectOption) => option.label}
        getOptionDisabled={(option: SelectOption) => option.disabled ?? false}
        groupBy={groupBy ?? ((option: SelectOption) => option.group ?? '')}
        isOptionEqualToValue={(option, value) => option.value === value.value}
        disabled={disabled}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            required={required}
            error={hasError}
            helperText={errorMessage ?? helperText}
            placeholder={placeholder}
            inputProps={{
              ...params.inputProps,
              'aria-label': label,
              'aria-describedby': hasError || helperText ? helperId : undefined,
              'aria-invalid': hasError,
              'aria-required': required,
            }}
          />
        )}
        renderTags={(value: SelectOption[], getTagProps) =>
          value.map((option, index) => {
            const { key, ...otherTagProps } = getTagProps({ index });
            return <Chip key={key} label={option.label} {...otherTagProps} size="small" />;
          })
        }
      />
    );
  };

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={(multiple ? [] : '') as PathValue<TFieldValues, Path<TFieldValues>>}
      render={({ field, fieldState }) => {
        return searchable
          ? renderSearchableSelect(field, fieldState)
          : renderStandardSelect(field, fieldState);
      }}
    />
  );
}
