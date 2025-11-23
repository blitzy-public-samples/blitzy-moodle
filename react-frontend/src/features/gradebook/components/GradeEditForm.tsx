/**
 * GradeEditForm Component
 * 
 * React form component for editing student grades in Moodle.
 * Provides a comprehensive interface for teachers to update grades, add feedback,
 * and manage grade settings (override, exclude, hide, lock).
 * 
 * Features:
 * - Form validation with Zod schema
 * - Permission checking for grade editing capability
 * - Rich text feedback editor
 * - Date/time pickers for hidden until and lock time
 * - Optimistic UI updates with loading states
 * - Comprehensive error handling with toast notifications
 * 
 * @module features/gradebook/components/GradeEditForm
 */

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  TextField,
  FormControlLabel,
  Checkbox,
  Switch,
  Button,
  Box,
  Stack,
  Alert,
  CircularProgress,
  FormHelperText,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';

// Internal imports
import type { Grade, GradeItem } from '../types/grade.types';
import { usePermissions } from '../../../hooks/usePermissions';
import RichTextEditor from '../../../components/editor/RichTextEditor';
import { useToast } from '../../../hooks/useToast';

/**
 * Props interface for GradeEditForm component
 */
export interface GradeEditFormProps {
  /** The grade item being edited (contains grademax, grademin, etc.) */
  gradeItem: GradeItem;
  
  /** Initial values for the form (existing grade data if available) */
  initialValues?: Partial<Grade>;
  
  /** Callback function invoked when form is submitted with validated data */
  onSubmit: (data: Partial<Grade>) => Promise<void>;
  
  /** Callback function invoked when user cancels the form */
  onCancel: () => void;
  
  /** Optional flag to make the entire form read-only */
  readOnly?: boolean;
}

/**
 * Creates a Zod validation schema for grade editing
 * 
 * @param grademax - Maximum grade value allowed
 * @param grademin - Minimum grade value allowed
 * @returns Zod schema for grade validation
 */
const createGradeSchema = (grademax: number, grademin: number) => {
  return z.object({
    finalgrade: z
      .number({
        required_error: 'Grade is required',
        invalid_type_error: 'Grade must be a number',
      })
      .min(grademin, `Grade must be at least ${grademin}`)
      .max(grademax, `Grade cannot exceed ${grademax}`)
      .nullable(),
    feedback: z.string().optional(),
    overridden: z.number().int().min(0).max(1),
    excluded: z.number().int().min(0).max(1),
    hidden: z.number().int().min(0),
    locked: z.number().int().min(0),
    locktime: z.number().int().min(0),
  }).refine((data) => {
    // When override is checked, finalgrade must not be null
    if (data.overridden === 1 && data.finalgrade === null) {
      return false;
    }
    return true;
  }, {
    message: 'Grade is required when override is checked',
    path: ['finalgrade'],
  });
};

/**
 * GradeEditForm Component
 * 
 * Provides a form interface for editing student grades with comprehensive
 * validation, permission checking, and error handling.
 */
const GradeEditForm: React.FC<GradeEditFormProps> = ({
  gradeItem,
  initialValues,
  onSubmit,
  onCancel,
  readOnly = false,
}) => {
  // Hooks
  const { hasCapability } = usePermissions();
  const { success, error: showError } = useToast();
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Check permissions on mount
  useEffect(() => {
    if (!hasCapability('moodle/grade:edit')) {
      setPermissionError('You do not have permission to edit grades');
    }
  }, [hasCapability]);

  // Create validation schema based on grade item constraints
  const gradeSchema = createGradeSchema(
    gradeItem.grademax || 100,
    gradeItem.grademin || 0
  );

  type GradeFormData = z.infer<typeof gradeSchema>;

  // Initialize form with React Hook Form
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<GradeFormData>({
    resolver: zodResolver(gradeSchema),
    defaultValues: {
      finalgrade: initialValues?.finalgrade ?? null,
      feedback: initialValues?.feedback ?? '',
      overridden: initialValues?.overridden ?? 0,
      excluded: initialValues?.excluded ?? 0,
      hidden: initialValues?.hidden ?? 0,
      locked: initialValues?.locked ?? 0,
      locktime: initialValues?.locktime ?? 0,
    },
    mode: 'onBlur',
  });

  // Watch form fields to enable conditional rendering
  const overridden = watch('overridden');
  const hidden = watch('hidden');
  const locked = watch('locked');
  const locktime = watch('locktime');
  const excluded = watch('excluded');

  /**
   * Handle form submission
   */
  const onSubmitForm = async (data: GradeFormData) => {
    // Double-check permission before submission
    if (!hasCapability('moodle/grade:edit')) {
      showError('You do not have permission to edit grades');
      return;
    }

    setIsLoading(true);
    
    try {
      // Transform form data to API format
      const gradeData: Partial<Grade> = {
        finalgrade: data.finalgrade,
        feedback: data.feedback || '',
        overridden: data.overridden,
        excluded: data.excluded,
        hidden: data.hidden,
        locked: data.locked,
        locktime: data.locktime,
      };

      // Call the onSubmit callback with the transformed data
      await onSubmit(gradeData);
      
      // Show success notification
      success('Grade saved successfully');
    } catch (err) {
      // Handle submission error
      const errorMessage = err instanceof Error ? err.message : 'Failed to save grade';
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle override checkbox change
   * When override is unchecked, disable grade input
   */
  const handleOverrideChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isOverridden = event.target.checked;
    setValue('overridden', isOverridden ? 1 : 0);
    
    // If override is disabled and grade was previously overridden, clear the grade
    if (!isOverridden && initialValues?.overridden) {
      setValue('finalgrade', null);
    }
  };

  /**
   * Handle excluded checkbox change
   * When excluded, typically the grade shouldn't be editable
   */
  const handleExcludedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isExcluded = event.target.checked;
    setValue('excluded', isExcluded ? 1 : 0);
  };

  // If user doesn't have permission, show error message
  if (permissionError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {permissionError}
        </Alert>
        <Button variant="outlined" onClick={onCancel}>
          Close
        </Button>
      </Box>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmitForm)}
      noValidate
      sx={{ width: '100%' }}
    >
      <Stack spacing={3}>
        {/* Form validation errors */}
        {Object.keys(errors).length > 0 && (
          <Alert severity="error">
            Please correct the errors in the form before submitting.
          </Alert>
        )}

        {/* Override Checkbox */}
        <FormControlLabel
          control={
            <Controller
              name="overridden"
              control={control}
              render={({ field }) => (
                <Checkbox
                  {...field}
                  checked={field.value === 1}
                  onChange={(e) => {
                    field.onChange(e);
                    handleOverrideChange(e);
                  }}
                  disabled={readOnly || isLoading}
                  aria-label="Override calculated grade"
                />
              )}
            />
          }
          label="Override calculated grade"
        />
        {overridden === 0 && (
          <FormHelperText>
            Check this box to manually enter a grade that overrides any calculated grade.
          </FormHelperText>
        )}

        {/* Grade Input Field */}
        <Controller
          name="finalgrade"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={`Grade (out of ${gradeItem.grademax || 100})`}
              type="number"
              fullWidth
              disabled={overridden === 0 || readOnly || isLoading || excluded === 1}
              error={!!errors.finalgrade}
              helperText={
                errors.finalgrade?.message ||
                `Enter a grade between ${gradeItem.grademin || 0} and ${gradeItem.grademax || 100}`
              }
              inputProps={{
                min: gradeItem.grademin || 0,
                max: gradeItem.grademax || 100,
                step: 0.01,
                'aria-label': 'Final grade value',
              }}
              value={field.value ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                field.onChange(value === '' ? null : parseFloat(value));
              }}
            />
          )}
        />

        {/* Excluded Checkbox */}
        <FormControlLabel
          control={
            <Controller
              name="excluded"
              control={control}
              render={({ field }) => (
                <Checkbox
                  {...field}
                  checked={field.value === 1}
                  onChange={(e) => {
                    field.onChange(e);
                    handleExcludedChange(e);
                  }}
                  disabled={readOnly || isLoading}
                  aria-label="Exclude grade from calculations"
                />
              )}
            />
          }
          label="Exclude from calculations"
        />
        {excluded === 1 && (
          <FormHelperText>
            This grade will be excluded from aggregation calculations.
          </FormHelperText>
        )}

        {/* Feedback Editor */}
        <Box>
          <Controller
            name="feedback"
            control={control}
            render={({ field }) => (
              <RichTextEditor
                name="feedback"
                label="Feedback"
                placeholder="Enter feedback for student"
                value={field.value || ''}
                onChange={field.onChange}
                disabled={readOnly || isLoading}
                error={!!errors.feedback}
                helperText={errors.feedback?.message}
              />
            )}
          />
        </Box>

        {/* Hidden Section */}
        <Box>
          <FormControlLabel
            control={
              <Controller
                name="hidden"
                control={control}
                render={({ field }) => (
                  <Switch
                    {...field}
                    checked={field.value > 0}
                    onChange={(e) => {
                      // Set to current timestamp if checked, 0 if unchecked
                      const newValue = e.target.checked ? Math.floor(Date.now() / 1000) : 0;
                      field.onChange(newValue);
                    }}
                    disabled={readOnly || isLoading}
                    aria-label="Hide grade from student"
                  />
                )}
              />
            }
            label="Hide from student"
          />
          {hidden > 0 && (
            <FormHelperText>
              Grade is hidden from student until {new Date(hidden * 1000).toLocaleString()}
            </FormHelperText>
          )}
        </Box>

        {/* Locked Section */}
        <Box>
          <FormControlLabel
            control={
              <Controller
                name="locked"
                control={control}
                render={({ field }) => (
                  <Switch
                    {...field}
                    checked={field.value === 1}
                    onChange={(e) => {
                      const newValue = e.target.checked ? 1 : 0;
                      field.onChange(newValue);
                      // If locking, set locktime to current timestamp
                      if (e.target.checked && locktime === 0) {
                        setValue('locktime', Math.floor(Date.now() / 1000));
                      }
                    }}
                    disabled={readOnly || isLoading}
                    aria-label="Lock grade"
                  />
                )}
              />
            }
            label="Lock grade"
          />
          {locked === 1 && (
            <Box sx={{ mt: 2 }}>
              <Controller
                name="locktime"
                control={control}
                render={({ field }) => (
                  <DateTimePicker
                    label="Locked at"
                    value={field.value > 0 ? new Date(field.value * 1000) : null}
                    onChange={(date) => {
                      const timestamp = date ? Math.floor(date.getTime() / 1000) : 0;
                      field.onChange(timestamp);
                    }}
                    disabled={readOnly || isLoading}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        helperText: 'Date and time when grade was locked',
                        error: !!errors.locktime,
                      },
                    }}
                  />
                )}
              />
            </Box>
          )}
        </Box>

        {/* Form Actions */}
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Cancel grade editing"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={isLoading || readOnly || !!permissionError}
            startIcon={isLoading && <CircularProgress size={20} />}
            aria-label="Save grade"
          >
            {isLoading ? 'Saving...' : 'Save Grade'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default GradeEditForm;
