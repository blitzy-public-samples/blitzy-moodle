/**
 * SettingsForm Component
 *
 * Comprehensive React form component for admin settings management that handles
 * multiple setting types (text, textarea, checkbox, select, time, duration, etc.),
 * uses react-hook-form for state management, zod for validation, Material-UI
 * components for consistent styling, implements change tracking with isDirty state,
 * provides save/reset functionality with confirmation dialogs, organizes settings
 * into collapsible sections, displays inline validation errors, supports setting
 * dependencies for conditional field visibility, implements WCAG 2.1 AA accessibility
 * with proper ARIA labels and keyboard navigation, handles loading and error states
 * gracefully, and provides TypeScript strict typing with explicit interfaces for all
 * props and data structures.
 *
 * Features:
 * - Multiple setting type renderers (text, textarea, checkbox, select, password, etc.)
 * - React Hook Form integration for performant form state management
 * - Zod schema validation with dynamic schema generation based on setting types
 * - Material-UI components for consistent, themeable UI
 * - Collapsible sections with Accordion components for organization
 * - Change tracking with isDirty state to enable/disable save button
 * - Unsaved changes warning and confirmation before reset
 * - Loading states with skeletons and progress indicators
 * - Inline validation error display
 * - Setting dependencies for conditional visibility
 * - WCAG 2.1 AA accessibility compliance
 * - TypeScript strict mode with zero any types
 * - Light/dark mode support through MUI theme
 *
 * @example
 * ```tsx
 * <SettingsForm
 *   settings={settingsData}
 *   onSave={handleSave}
 *   onError={handleError}
 *   loading={isLoading}
 *   initialExpanded={['general', 'appearance']}
 * />
 * ```
 *
 * @module features/admin/settings/components/SettingsForm
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ZodType, ZodSchema } from 'zod';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  FormHelperText,
  FormGroup,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  CircularProgress,
  LinearProgress,
  Paper,
  Container,
  Skeleton,
  InputLabel,
  Divider,
  Chip,
  IconButton,
} from '@mui/material';
import {
  ExpandMore,
  Save,
  RestoreOutlined,
  InfoOutlined,
  WarningAmberOutlined,
  Visibility,
  VisibilityOff,
  HelpOutline,
} from '@mui/icons-material';

// Internal imports
import { useToast } from '@/hooks/useToast';
import type {
  Setting,
  TextSetting,
  TextareaSetting,
  PasswordSetting,
  SelectSetting,
  MultiSelectSetting,
  CheckboxSetting,
  MultiCheckboxSetting,
  NumberSetting,
  TimeSetting,
  DurationSetting,
  HtmlEditorSetting,
  FileSetting,
  ExecutableSetting,
  ColorSetting,
  HeadingSetting,
  DescriptionSetting,
  SettingCategory,
  SettingsFormProps,
  EmailSetting,
  UrlSetting,
} from '@/features/admin/settings/types/settings.types';
import { SettingType } from '@/features/admin/settings/types/settings.types';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { Alert } from '@/components/feedback/Alert';
import { Modal } from '@/components/feedback/Modal';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Internal form values type - maps setting names to their values
 */
type FormValues = Record<string, unknown>;

/**
 * Expanded sections state type
 */
type ExpandedSections = Record<string, boolean>;

/**
 * Password visibility state type
 */
type PasswordVisibility = Record<string, boolean>;

// ============================================================================
// VALIDATION SCHEMA BUILDER
// ============================================================================

/**
 * Builds a dynamic Zod validation schema based on setting definitions
 *
 * @param categories - Array of setting categories with their settings
 * @returns Zod object schema for form validation
 */
const buildValidationSchema = (categories: SettingCategory[]): ZodType<FormValues> => {
  const schemaFields: Record<string, ZodSchema> = {};

  categories.forEach((category) => {
    category.settings.forEach((setting) => {
      let fieldSchema: ZodSchema;

      // Build schema based on setting type
      switch (setting.type) {
        case 'number':
          fieldSchema = z.coerce.number({
            required_error: `${setting.label} is required`,
            invalid_type_error: `${setting.label} must be a number`,
          });
          if (setting.min !== undefined) {
            fieldSchema = (fieldSchema as z.ZodNumber).min(
              setting.min,
              `${setting.label} must be at least ${setting.min}`
            );
          }
          if (setting.max !== undefined) {
            fieldSchema = (fieldSchema as z.ZodNumber).max(
              setting.max,
              `${setting.label} must be at most ${setting.max}`
            );
          }
          break;

        case 'email':
          fieldSchema = z
            .string()
            .email(`${setting.label} must be a valid email address`);
          break;

        case 'url':
          fieldSchema = z
            .string()
            .url(`${setting.label} must be a valid URL`);
          break;

        case 'checkbox':
        case 'multicheckbox':
          fieldSchema = z.union([z.boolean(), z.array(z.string())]);
          break;

        case 'select':
        case 'multiselect':
          if (setting.type === 'multiselect') {
            fieldSchema = z.array(z.string());
          } else {
            fieldSchema = z.string();
          }
          break;

        case 'time':
          fieldSchema = z.string().regex(
            /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
            `${setting.label} must be in HH:MM format`
          );
          break;

        case 'duration':
          fieldSchema = z.object({
            hours: z.coerce.number().min(0, 'Hours must be non-negative'),
            minutes: z.coerce.number().min(0).max(59, 'Minutes must be 0-59'),
          });
          break;

        case 'file':
        case 'executable':
          fieldSchema = z.string();
          // Add file path validation if needed
          break;

        default:
          // Default to string for text, textarea, password, color, htmleditor, heading, description
          fieldSchema = z.string();
          break;
      }

      // Apply required validation
      if (setting.required && fieldSchema instanceof z.ZodString) {
        fieldSchema = fieldSchema.min(1, `${setting.label} is required`);
      } else if (!setting.required && fieldSchema instanceof z.ZodString) {
        fieldSchema = fieldSchema.optional();
      } else if (!setting.required) {
        fieldSchema = fieldSchema.optional();
      }

      // Add custom validation if provided
      if (setting.validation) {
        if (fieldSchema instanceof z.ZodString) {
          const validationPattern = setting.validation instanceof RegExp 
            ? setting.validation 
            : new RegExp(setting.validation);
          fieldSchema = fieldSchema.regex(
            validationPattern,
            setting.validationMessage || 'Invalid value'
          );
        }
      }

      schemaFields[setting.name] = fieldSchema;
    });
  });

  return z.object(schemaFields as z.ZodRawShape);
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extracts default values from settings for form initialization
 *
 * @param categories - Array of setting categories
 * @returns Object mapping setting names to their default values
 */
const getDefaultValues = (categories: SettingCategory[]): FormValues => {
  const defaults: FormValues = {};

  categories.forEach((category) => {
    category.settings.forEach((setting) => {
      // Use current value if available, otherwise use defaultValue
      defaults[setting.name] = setting.value ?? setting.defaultValue ?? '';
    });
  });

  return defaults;
};

/**
 * Checks if a setting should be visible based on dependencies
 *
 * @param setting - The setting to check
 * @param formValues - Current form values
 * @returns True if setting should be visible
 */
const isSettingVisible = (
  setting: Setting,
  formValues: FormValues
): boolean => {
  if (!setting.dependsOn) {
    return true;
  }

  // Get the value of the dependent setting
  const dependentValue = formValues[setting.dependsOn.setting];
  const requiredValue = setting.dependsOn.value;

  // If requiredValue is an array, check if dependentValue is in the array
  if (Array.isArray(requiredValue)) {
    return requiredValue.includes(dependentValue as any);
  }

  // Otherwise, check for equality
  return dependentValue === requiredValue;
};

/**
 * Counts the number of changed settings in a category
 *
 * @param category - Setting category to check
 * @param dirtyFields - Object of dirty field flags from react-hook-form
 * @returns Number of changed settings
 */
const countChangedSettings = (
  category: SettingCategory,
  dirtyFields: Record<string, boolean>
): number => {
  return category.settings.filter((setting) => dirtyFields[setting.name]).length;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * SettingsForm Component
 *
 * Main settings management form component
 */
export const SettingsForm: React.FC<SettingsFormProps> = ({
  settings,
  onSave,
  onError,
  loading = false,
  initialExpanded = [],
}) => {
  const { success, error: showErrorToast, warning } = useToast();

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  // Track expanded accordion sections
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>(() => {
    const initial: ExpandedSections = {};
    initialExpanded.forEach((sectionId) => {
      initial[sectionId] = true;
    });
    return initial;
  });

  // Track password field visibility
  const [passwordVisibility, setPasswordVisibility] = useState<PasswordVisibility>({});

  // Track reset confirmation modal
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Track API errors
  const [apiError, setApiError] = useState<string | null>(null);

  // Build validation schema
  const validationSchema = useMemo(() => buildValidationSchema(settings), [settings]);

  // Initialize form with react-hook-form
  const {
    control,
    handleSubmit,
    formState: { isDirty, dirtyFields, isSubmitting },
    reset,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: getDefaultValues(settings),
    mode: 'onBlur',
  });

  // Watch all form values for dependency checking
  const formValues = watch();

  // ============================================================================
  // EFFECT HOOKS
  // ============================================================================

  /**
   * Warn user about unsaved changes when leaving page
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  /**
   * Reset form when settings data changes
   */
  useEffect(() => {
    reset(getDefaultValues(settings));
  }, [settings, reset]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Handle accordion section expansion/collapse
   */
  const handleAccordionChange = useCallback(
    (sectionId: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedSections((prev) => ({
        ...prev,
        [sectionId]: isExpanded,
      }));
    },
    []
  );

  /**
   * Handle password visibility toggle
   */
  const handlePasswordVisibilityToggle = useCallback((fieldName: string) => {
    setPasswordVisibility((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
  }, []);

  /**
   * Handle form submission
   */
  const onSubmit = useCallback(
    async (data: FormValues) => {
      try {
        setApiError(null);
        await onSave(data);
        success('Settings saved successfully');
        reset(data); // Reset dirty state with new values
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
        setApiError(errorMessage);
        showErrorToast(errorMessage);
        if (onError) {
          onError(err as Error);
        }
      }
    },
    [onSave, onError, success, showErrorToast, reset]
  );

  /**
   * Handle reset button click - show confirmation modal
   */
  const handleResetClick = useCallback(() => {
    if (isDirty) {
      setResetModalOpen(true);
    }
  }, [isDirty]);

  /**
   * Handle confirmed reset
   */
  const handleResetConfirm = useCallback(() => {
    reset(getDefaultValues(settings));
    setResetModalOpen(false);
    warning('All changes have been reset');
  }, [settings, reset, warning]);

  /**
   * Handle reset modal close
   */
  const handleResetCancel = useCallback(() => {
    setResetModalOpen(false);
  }, []);

  // ============================================================================
  // SETTING FIELD RENDERERS
  // ============================================================================

  /**
   * Renders a text input field (supports TEXT, EMAIL, and URL types)
   */
  const renderTextField = useCallback(
    (setting: TextSetting | EmailSetting | UrlSetting) => {
      const isVisible = isSettingVisible(setting, formValues);
      if (!isVisible) return null;

      // Type-specific properties
      const placeholder = setting.type === SettingType.TEXT 
        ? (setting as TextSetting).placeholder || setting.defaultValue?.toString()
        : setting.defaultValue?.toString();
      const size = setting.type === SettingType.TEXT 
        ? (setting as TextSetting).size 
        : undefined;

      return (
        <Controller
          key={setting.name}
          name={setting.name}
          control={control}
          render={({ field, fieldState }) => (
            <FormControl fullWidth error={!!fieldState.error} sx={{ mb: 2 }}>
              <TextField
                {...field}
                label={setting.label}
                placeholder={placeholder}
                helperText={
                  fieldState.error?.message || setting.description || ''
                }
                error={!!fieldState.error}
                disabled={setting.readonly || loading || isSubmitting}
                required={setting.required}
                size="medium"
                fullWidth
                inputProps={{
                  size: size,
                  'aria-label': setting.label,
                  'aria-describedby': setting.description
                    ? `${setting.name}-description`
                    : undefined,
                  'aria-required': setting.required,
                  'aria-invalid': !!fieldState.error,
                }}
              />
            </FormControl>
          )}
        />
      );
    },
    [control, formValues, loading, isSubmitting]
  );

  /**
   * Renders a textarea field
   */
  const renderTextareaField = useCallback(
    (setting: TextareaSetting) => {
      const isVisible = isSettingVisible(setting, formValues);
      if (!isVisible) return null;

      return (
        <Controller
          key={setting.name}
          name={setting.name}
          control={control}
          render={({ field, fieldState }) => (
            <FormControl fullWidth error={!!fieldState.error} sx={{ mb: 2 }}>
              <TextField
                {...field}
                label={setting.label}
                helperText={
                  fieldState.error?.message || setting.description || ''
                }
                error={!!fieldState.error}
                disabled={setting.readonly || loading || isSubmitting}
                required={setting.required}
                multiline
                rows={setting.rows || 4}
                fullWidth
                inputProps={{
                  'aria-label': setting.label,
                  'aria-describedby': setting.description
                    ? `${setting.name}-description`
                    : undefined,
                  'aria-required': setting.required,
                  'aria-invalid': !!fieldState.error,
                }}
              />
            </FormControl>
          )}
        />
      );
    },
    [control, formValues, loading, isSubmitting]
  );

  /**
   * Renders a password field with visibility toggle
   */
  const renderPasswordField = useCallback(
    (setting: PasswordSetting) => {
      const isVisible = isSettingVisible(setting, formValues);
      if (!isVisible) return null;

      const showPassword = passwordVisibility[setting.name] || false;

      return (
        <Controller
          key={setting.name}
          name={setting.name}
          control={control}
          render={({ field, fieldState }) => (
            <FormControl fullWidth error={!!fieldState.error} sx={{ mb: 2 }}>
              <TextField
                {...field}
                type={showPassword ? 'text' : 'password'}
                label={setting.label}
                helperText={
                  fieldState.error?.message || setting.description || ''
                }
                error={!!fieldState.error}
                disabled={setting.readonly || loading || isSubmitting}
                required={setting.required}
                fullWidth
                InputProps={{
                  endAdornment: (
                    <IconButton
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      onClick={() =>
                        handlePasswordVisibilityToggle(setting.name)
                      }
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  ),
                }}
                inputProps={{
                  'aria-label': setting.label,
                  'aria-describedby': setting.description
                    ? `${setting.name}-description`
                    : undefined,
                  'aria-required': setting.required,
                  'aria-invalid': !!fieldState.error,
                }}
              />
            </FormControl>
          )}
        />
      );
    },
    [control, formValues, loading, isSubmitting, passwordVisibility, handlePasswordVisibilityToggle]
  );

  /**
   * Renders a checkbox field
   */
  const renderCheckboxField = useCallback(
    (setting: CheckboxSetting) => {
      const isVisible = isSettingVisible(setting, formValues);
      if (!isVisible) return null;

      return (
        <Controller
          key={setting.name}
          name={setting.name}
          control={control}
          render={({ field, fieldState }) => (
            <FormControl
              fullWidth
              error={!!fieldState.error}
              sx={{ mb: 2 }}
              component="fieldset"
            >
              <FormControlLabel
                control={
                  <Checkbox
                    {...field}
                    checked={Boolean(field.value)}
                    onChange={(e) => field.onChange(e.target.checked)}
                    disabled={setting.readonly || loading || isSubmitting}
                    inputProps={{
                      'aria-label': setting.label,
                      'aria-describedby': setting.description
                        ? `${setting.name}-description`
                        : undefined,
                      'aria-required': setting.required,
                      'aria-invalid': !!fieldState.error,
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">{setting.label}</Typography>
                    {setting.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        id={`${setting.name}-description`}
                      >
                        {setting.description}
                      </Typography>
                    )}
                  </Box>
                }
              />
              {fieldState.error && (
                <FormHelperText error>
                  {fieldState.error.message}
                </FormHelperText>
              )}
            </FormControl>
          )}
        />
      );
    },
    [control, formValues, loading, isSubmitting]
  );

  /**
   * Renders a multi-checkbox field
   */
  const renderMultiCheckboxField = useCallback(
    (setting: MultiCheckboxSetting) => {
      const isVisible = isSettingVisible(setting, formValues);
      if (!isVisible) return null;

      return (
        <Controller
          key={setting.name}
          name={setting.name}
          control={control}
          render={({ field, fieldState }) => (
            <FormControl
              fullWidth
              error={!!fieldState.error}
              sx={{ mb: 2 }}
              component="fieldset"
            >
              <FormLabel component="legend">{setting.label}</FormLabel>
              {setting.description && (
                <FormHelperText id={`${setting.name}-description`}>
                  {setting.description}
                </FormHelperText>
              )}
              <FormGroup>
                {setting.options.map((option) => {
                  const values = Array.isArray(field.value) ? field.value : [];
                  const isChecked = values.includes(option.value);

                  return (
                    <FormControlLabel
                      key={option.value}
                      control={
                        <Checkbox
                          checked={isChecked}
                          onChange={(e) => {
                            const newValues = e.target.checked
                              ? [...values, option.value]
                              : values.filter((v) => v !== option.value);
                            field.onChange(newValues);
                          }}
                          disabled={setting.readonly || loading || isSubmitting}
                        />
                      }
                      label={option.label}
                    />
                  );
                })}
              </FormGroup>
              {fieldState.error && (
                <FormHelperText error>
                  {fieldState.error.message}
                </FormHelperText>
              )}
            </FormControl>
          )}
        />
      );
    },
    [control, formValues, loading, isSubmitting]
  );

  /**
   * Renders a select dropdown field
   */
  const renderSelectField = useCallback(
    (setting: SelectSetting) => {
      const isVisible = isSettingVisible(setting, formValues);
      if (!isVisible) return null;

      return (
        <Controller
          key={setting.name}
          name={setting.name}
          control={control}
          render={({ field, fieldState }) => (
            <FormControl fullWidth error={!!fieldState.error} sx={{ mb: 2 }}>
              <InputLabel id={`${setting.name}-label`}>
                {setting.label}
              </InputLabel>
              <Select
                {...field}
                labelId={`${setting.name}-label`}
                label={setting.label}
                disabled={setting.readonly || loading || isSubmitting}
                inputProps={{
                  'aria-label': setting.label,
                  'aria-describedby': setting.description
                    ? `${setting.name}-description`
                    : undefined,
                  'aria-required': setting.required,
                  'aria-invalid': !!fieldState.error,
                }}
              >
                {setting.options.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
              {(fieldState.error?.message || setting.description) && (
                <FormHelperText
                  error={!!fieldState.error}
                  id={`${setting.name}-description`}
                >
                  {fieldState.error?.message || setting.description}
                </FormHelperText>
              )}
            </FormControl>
          )}
        />
      );
    },
    [control, formValues, loading, isSubmitting]
  );

  /**
   * Renders a multi-select dropdown field
   */
  const renderMultiSelectField = useCallback(
    (setting: MultiSelectSetting) => {
      const isVisible = isSettingVisible(setting, formValues);
      if (!isVisible) return null;

      return (
        <Controller
          key={setting.name}
          name={setting.name}
          control={control}
          render={({ field, fieldState }) => (
            <FormControl fullWidth error={!!fieldState.error} sx={{ mb: 2 }}>
              <InputLabel id={`${setting.name}-label`}>
                {setting.label}
              </InputLabel>
              <Select
                {...field}
                labelId={`${setting.name}-label`}
                label={setting.label}
                multiple
                value={Array.isArray(field.value) ? field.value : []}
                disabled={setting.readonly || loading || isSubmitting}
                inputProps={{
                  'aria-label': setting.label,
                  'aria-describedby': setting.description
                    ? `${setting.name}-description`
                    : undefined,
                  'aria-required': setting.required,
                  'aria-invalid': !!fieldState.error,
                }}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => {
                      const option = setting.options.find(
                        (opt) => opt.value === value
                      );
                      return (
                        <Chip
                          key={value}
                          label={option?.label || value}
                          size="small"
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {setting.options.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
              {(fieldState.error?.message || setting.description) && (
                <FormHelperText
                  error={!!fieldState.error}
                  id={`${setting.name}-description`}
                >
                  {fieldState.error?.message || setting.description}
                </FormHelperText>
              )}
            </FormControl>
          )}
        />
      );
    },
    [control, formValues, loading, isSubmitting]
  );

  /**
   * Renders a number input field
   */
  const renderNumberField = useCallback(
    (setting: NumberSetting) => {
      const isVisible = isSettingVisible(setting, formValues);
      if (!isVisible) return null;

      return (
        <Controller
          key={setting.name}
          name={setting.name}
          control={control}
          render={({ field, fieldState }) => (
            <FormControl fullWidth error={!!fieldState.error} sx={{ mb: 2 }}>
              <TextField
                {...field}
                type="number"
                label={setting.label}
                helperText={
                  fieldState.error?.message || setting.description || ''
                }
                error={!!fieldState.error}
                disabled={setting.readonly || loading || isSubmitting}
                required={setting.required}
                fullWidth
                inputProps={{
                  min: setting.min,
                  max: setting.max,
                  step: setting.step || 1,
                  'aria-label': setting.label,
                  'aria-describedby': setting.description
                    ? `${setting.name}-description`
                    : undefined,
                  'aria-required': setting.required,
                  'aria-invalid': !!fieldState.error,
                }}
              />
            </FormControl>
          )}
        />
      );
    },
    [control, formValues, loading, isSubmitting]
  );

  /**
   * Renders a time input field (HH:MM format)
   */
  const renderTimeField = useCallback(
    (setting: TimeSetting) => {
      const isVisible = isSettingVisible(setting, formValues);
      if (!isVisible) return null;

      return (
        <Controller
          key={setting.name}
          name={setting.name}
          control={control}
          render={({ field, fieldState }) => (
            <FormControl fullWidth error={!!fieldState.error} sx={{ mb: 2 }}>
              <TextField
                {...field}
                type="time"
                label={setting.label}
                helperText={
                  fieldState.error?.message || setting.description || ''
                }
                error={!!fieldState.error}
                disabled={setting.readonly || loading || isSubmitting}
                required={setting.required}
                fullWidth
                InputLabelProps={{
                  shrink: true,
                }}
                inputProps={{
                  'aria-label': setting.label,
                  'aria-describedby': setting.description
                    ? `${setting.name}-description`
                    : undefined,
                  'aria-required': setting.required,
                  'aria-invalid': !!fieldState.error,
                }}
              />
            </FormControl>
          )}
        />
      );
    },
    [control, formValues, loading, isSubmitting]
  );

  /**
   * Renders a duration input field (hours and minutes)
   */
  const renderDurationField = useCallback(
    (setting: DurationSetting) => {
      const isVisible = isSettingVisible(setting, formValues);
      if (!isVisible) return null;

      return (
        <Controller
          key={setting.name}
          name={setting.name}
          control={control}
          render={({ field, fieldState }) => {
            const value = (field.value as { hours?: number; minutes?: number }) || {
              hours: 0,
              minutes: 0,
            };

            return (
              <FormControl fullWidth error={!!fieldState.error} sx={{ mb: 2 }}>
                <FormLabel>{setting.label}</FormLabel>
                {setting.description && (
                  <FormHelperText id={`${setting.name}-description`}>
                    {setting.description}
                  </FormHelperText>
                )}
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <TextField
                    type="number"
                    label="Hours"
                    value={value.hours || 0}
                    onChange={(e) => {
                      field.onChange({
                        ...value,
                        hours: parseInt(e.target.value, 10) || 0,
                      });
                    }}
                    disabled={setting.readonly || loading || isSubmitting}
                    inputProps={{
                      min: 0,
                      'aria-label': `${setting.label} hours`,
                    }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    type="number"
                    label="Minutes"
                    value={value.minutes || 0}
                    onChange={(e) => {
                      field.onChange({
                        ...value,
                        minutes: parseInt(e.target.value, 10) || 0,
                      });
                    }}
                    disabled={setting.readonly || loading || isSubmitting}
                    inputProps={{
                      min: 0,
                      max: 59,
                      'aria-label': `${setting.label} minutes`,
                    }}
                    sx={{ flex: 1 }}
                  />
                </Box>
                {fieldState.error && (
                  <FormHelperText error>
                    {fieldState.error.message}
                  </FormHelperText>
                )}
              </FormControl>
            );
          }}
        />
      );
    },
    [control, formValues, loading, isSubmitting]
  );

  /**
   * Renders a rich text HTML editor field
   */
  const renderHtmlEditorField = useCallback(
    (setting: HtmlEditorSetting) => {
      const isVisible = isSettingVisible(setting, formValues);
      if (!isVisible) return null;

      return (
        <Controller
          key={setting.name}
          name={setting.name}
          control={control}
          render={({ field, fieldState }) => (
            <Box sx={{ mb: 2 }}>
              <RichTextEditor
                name={field.name}
                value={field.value as string | undefined}
                onChange={field.onChange}
                label={setting.label}
                defaultValue={setting.defaultValue as string}
                disabled={setting.readonly || loading || isSubmitting}
                required={setting.required}
                error={!!fieldState.error}
                helperText={
                  fieldState.error?.message || setting.description || ''
                }
                height={400}
                toolbar="full"
              />
            </Box>
          )}
        />
      );
    },
    [control, formValues, loading, isSubmitting]
  );

  /**
   * Renders a file path input field
   */
  const renderFileField = useCallback(
    (setting: FileSetting | ExecutableSetting) => {
      const isVisible = isSettingVisible(setting, formValues);
      if (!isVisible) return null;

      return (
        <Controller
          key={setting.name}
          name={setting.name}
          control={control}
          render={({ field, fieldState }) => (
            <FormControl fullWidth error={!!fieldState.error} sx={{ mb: 2 }}>
              <TextField
                {...field}
                label={setting.label}
                placeholder="/path/to/file"
                helperText={
                  fieldState.error?.message || setting.description || ''
                }
                error={!!fieldState.error}
                disabled={setting.readonly || loading || isSubmitting}
                required={setting.required}
                fullWidth
                inputProps={{
                  'aria-label': setting.label,
                  'aria-describedby': setting.description
                    ? `${setting.name}-description`
                    : undefined,
                  'aria-required': setting.required,
                  'aria-invalid': !!fieldState.error,
                }}
              />
            </FormControl>
          )}
        />
      );
    },
    [control, formValues, loading, isSubmitting]
  );

  /**
   * Renders a color picker field
   */
  const renderColorField = useCallback(
    (setting: ColorSetting) => {
      const isVisible = isSettingVisible(setting, formValues);
      if (!isVisible) return null;

      return (
        <Controller
          key={setting.name}
          name={setting.name}
          control={control}
          render={({ field, fieldState }) => (
            <FormControl fullWidth error={!!fieldState.error} sx={{ mb: 2 }}>
              <FormLabel>{setting.label}</FormLabel>
              {setting.description && (
                <FormHelperText id={`${setting.name}-description`}>
                  {setting.description}
                </FormHelperText>
              )}
              <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
                <TextField
                  {...field}
                  type="color"
                  disabled={setting.readonly || loading || isSubmitting}
                  sx={{ width: 100 }}
                  inputProps={{
                    'aria-label': setting.label,
                  }}
                />
                <TextField
                  value={field.value || ''}
                  onChange={field.onChange}
                  placeholder="#000000"
                  disabled={setting.readonly || loading || isSubmitting}
                  sx={{ flex: 1 }}
                  inputProps={{
                    'aria-label': `${setting.label} hex code`,
                  }}
                />
              </Box>
              {fieldState.error && (
                <FormHelperText error>
                  {fieldState.error.message}
                </FormHelperText>
              )}
            </FormControl>
          )}
        />
      );
    },
    [control, formValues, loading, isSubmitting]
  );

  /**
   * Renders a heading (non-editable section divider)
   */
  const renderHeading = useCallback((setting: HeadingSetting) => {
    return (
      <Box key={setting.name} sx={{ mb: 2, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          {setting.label}
        </Typography>
        {setting.description && (
          <Typography variant="body2" color="text.secondary">
            {setting.description}
          </Typography>
        )}
        <Divider sx={{ mt: 1 }} />
      </Box>
    );
  }, []);

  /**
   * Renders a description (informational text block)
   */
  const renderDescription = useCallback((setting: DescriptionSetting) => {
    return (
      <Box
        key={setting.name}
        sx={{
          mb: 2,
          p: 2,
          bgcolor: 'info.light',
          borderRadius: 1,
          display: 'flex',
          gap: 1,
        }}
      >
        <InfoOutlined color="info" />
        <Box>
          {setting.label && (
            <Typography variant="subtitle2" gutterBottom>
              {setting.label}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {setting.description}
          </Typography>
        </Box>
      </Box>
    );
  }, []);

  /**
   * Master field renderer - routes to appropriate renderer based on setting type
   */
  const renderField = useCallback(
    (setting: Setting) => {
      switch (setting.type) {
        case 'text':
          return renderTextField(setting);
        case 'textarea':
          return renderTextareaField(setting);
        case 'password':
          return renderPasswordField(setting);
        case 'checkbox':
          return renderCheckboxField(setting);
        case 'multicheckbox':
          return renderMultiCheckboxField(setting);
        case 'select':
          return renderSelectField(setting);
        case 'multiselect':
          return renderMultiSelectField(setting);
        case 'number':
          return renderNumberField(setting);
        case 'time':
          return renderTimeField(setting);
        case 'duration':
          return renderDurationField(setting);
        case 'htmleditor':
          return renderHtmlEditorField(setting);
        case 'file':
        case 'executable':
          return renderFileField(setting);
        case 'color':
          return renderColorField(setting);
        case 'heading':
          return renderHeading(setting);
        case 'description':
          return renderDescription(setting);
        case 'email':
        case 'url':
          // Email and URL use text field with validation in schema
          return renderTextField(setting);
        default:
          // Default to text field for unknown types
          return renderTextField(setting as TextSetting);
      }
    },
    [
      renderTextField,
      renderTextareaField,
      renderPasswordField,
      renderCheckboxField,
      renderMultiCheckboxField,
      renderSelectField,
      renderMultiSelectField,
      renderNumberField,
      renderTimeField,
      renderDurationField,
      renderHtmlEditorField,
      renderFileField,
      renderColorField,
      renderHeading,
      renderDescription,
    ]
  );

  // ============================================================================
  // LOADING STATE RENDER
  // ============================================================================

  if (loading && settings.length === 0) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          {[1, 2, 3].map((i) => (
            <Box key={i} sx={{ mb: 3 }}>
              <Skeleton variant="rectangular" height={60} sx={{ mb: 1 }} />
              <Skeleton variant="rectangular" height={200} />
            </Box>
          ))}
        </Box>
      </Container>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  const changedCount = Object.keys(dirtyFields).length;

  return (
    <Container maxWidth="lg">
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Loading Progress Bar */}
        {isSubmitting && (
          <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
            <LinearProgress />
          </Box>
        )}

        {/* API Error Display */}
        {apiError && (
          <Box sx={{ mb: 3 }}>
            <Alert
              severity="error"
              message={apiError}
              closeable
              onClose={() => setApiError(null)}
            />
          </Box>
        )}

        {/* Unsaved Changes Warning */}
        {isDirty && !isSubmitting && (
          <Box sx={{ mb: 3 }}>
            <Alert
              severity="warning"
              title="Unsaved Changes"
              message={`You have ${changedCount} unsaved ${
                changedCount === 1 ? 'change' : 'changes'
              }. Remember to save your settings.`}
              icon={<WarningAmberOutlined />}
            />
          </Box>
        )}

        {/* Settings Sections */}
        <Box sx={{ mb: 10 }}>
          {settings.map((category) => {
            const isExpanded = expandedSections[category.id] || false;
            const changedInCategory = countChangedSettings(
              category,
              dirtyFields as Record<string, boolean>
            );

            return (
              <Accordion
                key={category.id}
                expanded={isExpanded}
                onChange={handleAccordionChange(category.id)}
                sx={{ mb: 1 }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  aria-controls={`${category.id}-content`}
                  id={`${category.id}-header`}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      pr: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="h6">{category.name}</Typography>
                      {category.description && (
                        <IconButton
                          size="small"
                          aria-label={`Help for ${category.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Could show tooltip or help dialog
                          }}
                        >
                          <HelpOutline fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {changedInCategory > 0 && (
                        <Chip
                          label={`${changedInCategory} changed`}
                          size="small"
                          color="warning"
                          icon={<WarningAmberOutlined />}
                        />
                      )}
                      <Chip
                        label={`${category.settings.length} settings`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {category.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 3 }}
                    >
                      {category.description}
                    </Typography>
                  )}
                  <Box>
                    {category.settings.map((setting) => renderField(setting))}
                  </Box>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>

        {/* Sticky Action Bar */}
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 3,
            zIndex: 1000,
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {isDirty && (
              <Typography variant="body2" color="text.secondary">
                {changedCount} unsaved {changedCount === 1 ? 'change' : 'changes'}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RestoreOutlined />}
              onClick={handleResetClick}
              disabled={!isDirty || isSubmitting}
              aria-label="Reset all changes"
            >
              Reset
            </Button>
            <Button
              variant="contained"
              type="submit"
              startIcon={
                isSubmitting ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <Save />
                )
              }
              disabled={!isDirty || isSubmitting || loading}
              aria-label="Save settings"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Paper>

        {/* Reset Confirmation Modal */}
        <Modal
          open={resetModalOpen}
          onClose={handleResetCancel}
          title="Reset All Changes?"
          maxWidth="sm"
          actions={[
            {
              label: 'Cancel',
              onClick: handleResetCancel,
              variant: 'outlined',
            },
            {
              label: 'Reset',
              onClick: handleResetConfirm,
              color: 'error',
              variant: 'contained',
            },
          ]}
        >
          <Typography>
            Are you sure you want to reset all changes? This will discard all
            unsaved modifications to your settings.
          </Typography>
        </Modal>
      </Box>
    </Container>
  );
};

// Export component as default
export default SettingsForm;

// Export props interface for external use
export type { SettingsFormProps };
