/**
 * ChoiceOptions Component
 *
 * Renders selectable choice activity options with Material-UI Radio/Checkbox inputs.
 * Supports both single-choice (radio buttons) and multiple-choice (checkboxes) selection modes.
 * Enforces maximum answer limits per option and displays availability status when enabled.
 * Integrates with React Hook Form for form state management and validation.
 *
 * @package   react-frontend
 * @copyright 2024 Moodle React Frontend
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import type React from 'react';
import { useState, useCallback } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm, Controller } from 'react-hook-form';
import {
  FormControl,
  RadioGroup,
  FormGroup,
  Radio,
  Checkbox,
  FormControlLabel,
  Button,
  Link,
  Stack,
  CircularProgress,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { Save } from '@mui/icons-material';
import type { ChoiceOptionForDisplay } from '../types/choice.types';

/**
 * Interface for form data structure
 */
interface ChoiceFormData {
  answer: number | number[];
}

/**
 * Props interface for ChoiceOptions component
 */
interface ChoiceOptionsProps {
  /** Array of available choice options */
  options: ChoiceOptionForDisplay[];
  /** Whether multiple selections are allowed */
  allowMultiple: boolean;
  /** Whether answer limits are enforced per option */
  limitAnswers: boolean;
  /** Whether to show availability status (response counts and limits) */
  showAvailable: boolean;
  /** Whether user has capability to submit choices */
  hascapability: boolean;
  /** Whether user can update/remove their existing choice */
  allowUpdate: boolean;
  /** Whether component is in preview-only mode (all inputs disabled) */
  previewOnly: boolean;
  /** Initial selection: single option ID or array of option IDs */
  initialSelection: number | number[];
  /** Callback function when choice is submitted */
  onSubmit: (answer: number | number[]) => Promise<void>;
  /** Optional callback function when user removes their choice */
  onRemove?: () => void | Promise<void>;
  /** Optional display layout orientation */
  displayLayout?: 'horizontal' | 'vertical';
}

/**
 * ChoiceOptions Component
 *
 * Renders choice activity options with single or multiple selection support.
 * Includes validation, loading states, and availability information display.
 * References PHP renderer logic from public/mod/choice/renderer.php lines 34-110.
 */
function ChoiceOptions({
  options,
  allowMultiple,
  limitAnswers,
  showAvailable,
  hascapability,
  allowUpdate,
  previewOnly,
  initialSelection,
  onSubmit,
  onRemove,
  displayLayout = 'vertical',
}: ChoiceOptionsProps) {
  // Local state for loading indicator during submission
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize React Hook Form with validation
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ChoiceFormData>({
    defaultValues: {
      answer: initialSelection,
    },
    mode: 'onSubmit',
  });

  /**
   * Form submission handler with loading state management
   * Validates that at least one option is selected before calling onSubmit callback
   */
  const handleFormSubmit: SubmitHandler<ChoiceFormData> = useCallback(
    async (data) => {
      try {
        setIsSubmitting(true);
        await onSubmit(data.answer);
      } catch (error) {
        console.error('Error submitting choice:', error);
        // Error handling is delegated to parent component via onSubmit rejection
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmit]
  );

  /**
   * Calculate number of available (non-full) options
   * Used to determine if submit button should be shown and if "Choice is full" message appears
   */
  const availableOptionCount = options.filter((option) => {
    // Option is unavailable if it's disabled or if it's at max capacity
    if (option.disabled) {
      return false;
    }
    if (limitAnswers && option.countanswers >= option.maxanswers) {
      return false;
    }
    return true;
  }).length;

  /**
   * Render label text for an option including availability information
   * Per renderer.php lines 61-72:
   * - Append " (Full)" when option is disabled
   * - Show "Responses: X" and "Limit: Y" when limitAnswers and showAvailable are true
   */
  const renderOptionLabel = (option: ChoiceOptionForDisplay): React.ReactNode => {
    let labelText = option.text;

    // Check if option is full (disabled or at max capacity)
    const isFull =
      (option.disabled ?? false) ||
      (limitAnswers && option.maxanswers > 0 && option.countanswers >= option.maxanswers);

    if (isFull) {
      labelText += ' (Full)';
    }

    // Show availability information if configured
    if (limitAnswers && showAvailable) {
      return (
        <Box component="span">
          {labelText}
          <br />
          <Typography variant="caption" color="text.secondary" component="span">
            Responses: {option.countanswers}
          </Typography>
          <br />
          <Typography variant="caption" color="text.secondary" component="span">
            Limit: {option.maxanswers}
          </Typography>
        </Box>
      );
    }

    return labelText;
  };

  /**
   * Determine if an option should be disabled
   * Disabled when:
   * - previewOnly mode is active
   * - Option's disabled flag is true
   * - Option is at max capacity (limitAnswers enabled)
   */
  const isOptionDisabled = (option: ChoiceOptionForDisplay): boolean => {
    if (previewOnly) {
      return true;
    }
    if (option.disabled) {
      return true;
    }
    if (limitAnswers && option.countanswers >= option.maxanswers) {
      return true;
    }
    return false;
  };

  return (
    <Box component="form" onSubmit={handleSubmit(handleFormSubmit)} noValidate>
      <Stack spacing={2}>
        {/* Render choice options with appropriate input type */}
        <Controller
          name="answer"
          control={control}
          rules={{
            required: 'You must choose an option',
            validate: (value) => {
              if (allowMultiple) {
                return (
                  (Array.isArray(value) && value.length > 0) ||
                  'You must choose an option'
                );
              }
              return (
                (typeof value === 'number' && value > 0) || 'You must choose an option'
              );
            },
          }}
          render={({ field }) => {
            if (allowMultiple) {
              // Multiple choice mode: render checkboxes in FormGroup
              return (
                <FormControl
                  component="fieldset"
                  error={!!errors.answer}
                  disabled={isSubmitting}
                  sx={{
                    display: 'flex',
                    flexDirection: displayLayout === 'horizontal' ? 'row' : 'column',
                  }}
                >
                  <FormGroup
                    sx={{
                      flexDirection: displayLayout === 'horizontal' ? 'row' : 'column',
                      gap: displayLayout === 'horizontal' ? 2 : 1,
                    }}
                  >
                    {options.map((option, index) => {
                      const currentValue = Array.isArray(field.value) ? field.value : [];
                      const isChecked = currentValue.includes(option.id);

                      return (
                        <FormControlLabel
                          key={`choice_${index + 1}`}
                          control={
                            <Checkbox
                              checked={isChecked}
                              onChange={(e) => {
                                const newValue = e.target.checked
                                  ? [...currentValue, option.id]
                                  : currentValue.filter((id) => id !== option.id);
                                field.onChange(newValue);
                              }}
                              disabled={isOptionDisabled(option) || isSubmitting}
                              value={option.id}
                              name="answer[]"
                              sx={{ mx: 1 }}
                            />
                          }
                          label={renderOptionLabel(option)}
                          sx={{
                            alignItems: 'flex-start',
                            mr: displayLayout === 'horizontal' ? 3 : 0,
                          }}
                        />
                      );
                    })}
                  </FormGroup>
                </FormControl>
              );
            }
            // Single choice mode: render radio buttons in RadioGroup
            return (
              <FormControl
                component="fieldset"
                error={!!errors.answer}
                disabled={isSubmitting}
                sx={{
                  display: 'flex',
                  flexDirection: displayLayout === 'horizontal' ? 'row' : 'column',
                }}
              >
                <RadioGroup
                  name="answer"
                  value={field.value || ''}
                  onChange={(e) => {
                    field.onChange(Number(e.target.value));
                  }}
                  sx={{
                    flexDirection: displayLayout === 'horizontal' ? 'row' : 'column',
                    gap: displayLayout === 'horizontal' ? 2 : 1,
                  }}
                >
                  {options.map((option, index) => (
                    <FormControlLabel
                      key={`choice_${index + 1}`}
                      value={option.id}
                      control={
                        <Radio disabled={isOptionDisabled(option) || isSubmitting} sx={{ mx: 1 }} />
                      }
                      label={renderOptionLabel(option)}
                      sx={{
                        alignItems: 'flex-start',
                        mr: displayLayout === 'horizontal' ? 3 : 0,
                      }}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            );
          }}
        />

        {/* Display validation error message */}
        {errors.answer && (
          <Typography variant="body2" color="error" role="alert">
            {errors.answer.message}
          </Typography>
        )}

        {/* Action buttons section */}
        {!previewOnly && hascapability && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {availableOptionCount < 1 ? (
              // Show "Choice is full" message when no options available
              // Per renderer.php line 88
              <Alert severity="warning" sx={{ width: '100%' }}>
                Choice is full
              </Alert>
            ) : (
              // Show submit button when options are available
              // Per renderer.php lines 90-94
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <Save />}
              >
                {isSubmitting ? 'Saving...' : 'Save my choice'}
              </Button>
            )}

            {/* Show "Remove my choice" link when allowUpdate is true */}
            {/* Per renderer.php lines 97-100 */}
            {allowUpdate && (
              <Link
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  // Call the onRemove callback if provided
                  if (onRemove) {
                    onRemove();
                  }
                }}
                underline="hover"
                sx={{ ml: 1 }}
              >
                Remove my choice
              </Link>
            )}
          </Box>
        )}

        {/* Display message for users without capability */}
        {!previewOnly && !hascapability && (
          <Alert severity="info">You must be enrolled to make a choice</Alert>
        )}
      </Stack>
    </Box>
  );
}

export default ChoiceOptions;
