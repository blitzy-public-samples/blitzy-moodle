/**
 * GradingStrategyRenderer Component
 *
 * Dynamically renders different grading strategy interfaces based on workshop configuration.
 * Supports four grading strategies from Moodle's workshop module:
 * 
 * 1. Accumulative: Scoring aspects with weighted points
 * 2. Rubric: Criteria matrix with predefined level selections
 * 3. Comments: Feedback-only without numerical scores
 * 4. Number of errors: Yes/no assertions with error counting
 *
 * Based on Moodle workshop grading strategies from:
 * - public/mod/workshop/form/accumulative/lib.php
 * - public/mod/workshop/form/rubric/lib.php
 * - public/mod/workshop/form/comments/lib.php
 * - public/mod/workshop/form/numerrors/lib.php
 */

import React, { useCallback } from 'react';
import {
  Box,
  TextField,
  Typography,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  FormHelperText,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Divider,
  Alert,
} from '@mui/material';
import { useFormContext, Controller } from 'react-hook-form';
import type { Workshop } from '../types/workshop.types';

/**
 * Assessment dimension interface for grading
 * Represents a single criterion/aspect to be evaluated
 */
export interface GradingDimension {
  id: number;
  workshopId: number;
  sort: number;
  description: string;
  descriptionFormat: number;
  grade: number; // Max grade for this dimension
  weight: number; // Weight for calculating final grade
  strategy: string;
  // For rubric strategy
  levels?: RubricLevel[];
  // For numerrors strategy
  grade0?: number; // Grade when no errors
  grade1?: number; // Grade when errors found
}

/**
 * Rubric level definition for rubric strategy
 */
export interface RubricLevel {
  id: number;
  dimensionId: number;
  grade: number;
  definition: string;
  definitionFormat: number;
}

/**
 * Props for GradingStrategyRenderer component
 */
export interface GradingStrategyRendererProps {
  workshop: Workshop;
  dimensions: GradingDimension[];
  readonly?: boolean;
}

/**
 * Props for individual strategy renderers
 */
interface StrategyRendererProps {
  workshop: Workshop;
  dimensions: GradingDimension[];
  readonly?: boolean;
}

/**
 * Accumulative Strategy Renderer
 * Displays scoring aspects where reviewer assigns points up to maximum for each dimension
 */
const AccumulativeStrategyRenderer: React.FC<StrategyRendererProps> = ({
  workshop,
  dimensions,
  readonly = false,
}) => {
  const { control, formState } = useFormContext();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {dimensions.map((dimension, index) => {
        const gradeError = formState.errors.dimensions?.[index]?.grade;
        const commentError = formState.errors.dimensions?.[index]?.peerComment;

        return (
          <Box key={dimension.id} sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            {/* Dimension description */}
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              {dimension.description}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Maximum grade: {dimension.grade.toFixed(workshop.gradeDecimals)} points
              {dimension.weight !== 1 && ` (Weight: ${dimension.weight})`}
            </Typography>

            {/* Grade input field */}
            <Controller
              name={`dimensions.${index}.grade`}
              control={control}
              defaultValue=""
              rules={{
                required: 'Grade is required',
                min: { value: 0, message: 'Grade cannot be negative' },
                max: {
                  value: dimension.grade,
                  message: `Grade cannot exceed ${dimension.grade}`,
                },
                validate: (value) => {
                  if (value === '' || value === null || value === undefined) {
                    return 'Grade is required';
                  }
                  const numValue = Number(value);
                  if (isNaN(numValue)) {
                    return 'Grade must be a valid number';
                  }
                  return true;
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label="Grade"
                  placeholder={`0 - ${dimension.grade}`}
                  fullWidth
                  disabled={readonly || formState.isSubmitting}
                  error={!!gradeError}
                  helperText={gradeError?.message}
                  inputProps={{
                    min: 0,
                    max: dimension.grade,
                    step: Math.pow(10, -workshop.gradeDecimals),
                  }}
                  sx={{ mb: 2 }}
                  onChange={(e) => {
                    const value = e.target.value === '' ? '' : Number(e.target.value);
                    field.onChange(value);
                  }}
                />
              )}
            />

            {/* Comment field */}
            <Controller
              name={`dimensions.${index}.peerComment`}
              control={control}
              defaultValue=""
              rules={{
                required:
                  workshop.overallFeedbackMode === 2
                    ? 'Comment is required'
                    : false,
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Comment"
                  multiline
                  rows={3}
                  fullWidth
                  disabled={readonly || formState.isSubmitting}
                  error={!!commentError}
                  helperText={commentError?.message || 'Provide feedback for this aspect'}
                  placeholder="Enter your feedback and justification for the grade..."
                />
              )}
            />

            {/* Hidden dimension ID field */}
            <Controller
              name={`dimensions.${index}.dimensionId`}
              control={control}
              defaultValue={dimension.id}
              render={({ field }) => <input type="hidden" {...field} />}
            />
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * Rubric Strategy Renderer
 * Displays criteria matrix where reviewer selects predefined performance level for each criterion
 */
const RubricStrategyRenderer: React.FC<StrategyRendererProps> = ({
  workshop,
  dimensions,
  readonly = false,
}) => {
  const { control, formState } = useFormContext();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {dimensions.map((dimension, index) => {
        const gradeError = formState.errors.dimensions?.[index]?.grade;
        const commentError = formState.errors.dimensions?.[index]?.peerComment;

        // Sort levels by grade in descending order (best to worst)
        const sortedLevels = [...(dimension.levels || [])].sort(
          (a, b) => b.grade - a.grade
        );

        return (
          <Box key={dimension.id} sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            {/* Criterion description */}
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              {dimension.description}
            </Typography>

            {/* Level selection */}
            <FormControl
              fullWidth
              error={!!gradeError}
              disabled={readonly || formState.isSubmitting}
              sx={{ mb: 2 }}
            >
              <InputLabel id={`dimension-${index}-level-label`}>Select Level</InputLabel>
              <Controller
                name={`dimensions.${index}.grade`}
                control={control}
                defaultValue=""
                rules={{
                  required: 'Please select a level',
                  validate: (value) => {
                    if (value === '' || value === null || value === undefined) {
                      return 'Level selection is required';
                    }
                    return true;
                  },
                }}
                render={({ field }) => (
                  <Select
                    {...field}
                    labelId={`dimension-${index}-level-label`}
                    label="Select Level"
                    displayEmpty
                  >
                    <MenuItem value="" disabled>
                      <em>Select a performance level</em>
                    </MenuItem>
                    {sortedLevels.map((level) => (
                      <MenuItem key={level.id} value={level.grade}>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {level.grade.toFixed(workshop.gradeDecimals)} points
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {level.definition}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              {gradeError && (
                <FormHelperText>{gradeError.message}</FormHelperText>
              )}
            </FormControl>

            {/* Comment field */}
            <Controller
              name={`dimensions.${index}.peerComment`}
              control={control}
              defaultValue=""
              rules={{
                required:
                  workshop.overallFeedbackMode === 2
                    ? 'Comment is required'
                    : false,
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Comment"
                  multiline
                  rows={3}
                  fullWidth
                  disabled={readonly || formState.isSubmitting}
                  error={!!commentError}
                  helperText={commentError?.message || 'Explain your level selection'}
                  placeholder="Provide feedback explaining why you selected this level..."
                />
              )}
            />

            {/* Hidden dimension ID field */}
            <Controller
              name={`dimensions.${index}.dimensionId`}
              control={control}
              defaultValue={dimension.id}
              render={({ field }) => <input type="hidden" {...field} />}
            />
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * Comments Strategy Renderer
 * Displays comment-only fields without numerical grading
 */
const CommentsStrategyRenderer: React.FC<StrategyRendererProps> = ({
  workshop,
  dimensions,
  readonly = false,
}) => {
  const { control, formState } = useFormContext();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Alert severity="info" sx={{ mb: 1 }}>
        This workshop uses comment-only feedback. No numerical grades are assigned.
      </Alert>

      {dimensions.map((dimension, index) => {
        const commentError = formState.errors.dimensions?.[index]?.peerComment;

        return (
          <Box key={dimension.id} sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            {/* Aspect description */}
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              {dimension.description}
            </Typography>

            {/* Comment field - required for comments-only strategy */}
            <Controller
              name={`dimensions.${index}.peerComment`}
              control={control}
              defaultValue=""
              rules={{
                required: 'Comment is required for this aspect',
                minLength: {
                  value: 10,
                  message: 'Please provide more detailed feedback (at least 10 characters)',
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Feedback"
                  multiline
                  rows={4}
                  fullWidth
                  required
                  disabled={readonly || formState.isSubmitting}
                  error={!!commentError}
                  helperText={
                    commentError?.message ||
                    'Provide detailed qualitative feedback for this aspect'
                  }
                  placeholder="Enter comprehensive feedback addressing this aspect..."
                />
              )}
            />

            {/* Hidden dimension ID field */}
            <Controller
              name={`dimensions.${index}.dimensionId`}
              control={control}
              defaultValue={dimension.id}
              render={({ field }) => <input type="hidden" {...field} />}
            />

            {/* Hidden grade field set to null for comments strategy */}
            <Controller
              name={`dimensions.${index}.grade`}
              control={control}
              defaultValue={null}
              render={({ field }) => <input type="hidden" {...field} />}
            />
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * Number of Errors Strategy Renderer
 * Displays yes/no assertions where reviewer indicates presence of errors
 */
const NumberOfErrorsStrategyRenderer: React.FC<StrategyRendererProps> = ({
  workshop,
  dimensions,
  readonly = false,
}) => {
  const { control, formState } = useFormContext();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Alert severity="info" sx={{ mb: 1 }}>
        Review each assertion and indicate whether the error/issue is present.
        The grade is calculated based on the number of errors found.
      </Alert>

      {dimensions.map((dimension, index) => {
        const gradeError = formState.errors.dimensions?.[index]?.grade;
        const commentError = formState.errors.dimensions?.[index]?.peerComment;

        return (
          <Box key={dimension.id} sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            {/* Assertion/error description */}
            <FormControl
              component="fieldset"
              error={!!gradeError}
              disabled={readonly || formState.isSubmitting}
            >
              <FormLabel component="legend">
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  {dimension.description}
                </Typography>
              </FormLabel>

              {/* Yes/No selection for error presence */}
              <Controller
                name={`dimensions.${index}.grade`}
                control={control}
                defaultValue=""
                rules={{
                  required: 'Please select whether this error is present',
                  validate: (value) => {
                    if (value === '' || value === null || value === undefined) {
                      return 'Selection is required';
                    }
                    return true;
                  },
                }}
                render={({ field }) => (
                  <RadioGroup
                    {...field}
                    row
                    onChange={(e) => {
                      // Convert string value to number
                      const numValue = Number(e.target.value);
                      field.onChange(numValue);
                    }}
                  >
                    <FormControlLabel
                      value={dimension.grade0 || 1}
                      control={<Radio />}
                      label="No (error not present)"
                    />
                    <FormControlLabel
                      value={dimension.grade1 || 0}
                      control={<Radio />}
                      label="Yes (error present)"
                    />
                  </RadioGroup>
                )}
              />
              {gradeError && (
                <FormHelperText error>{gradeError.message}</FormHelperText>
              )}
            </FormControl>

            {/* Comment field */}
            <Controller
              name={`dimensions.${index}.peerComment`}
              control={control}
              defaultValue=""
              rules={{
                required:
                  workshop.overallFeedbackMode === 2
                    ? 'Comment is required'
                    : false,
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Comment"
                  multiline
                  rows={2}
                  fullWidth
                  disabled={readonly || formState.isSubmitting}
                  error={!!commentError}
                  helperText={
                    commentError?.message || 'Optional: Explain or provide examples'
                  }
                  placeholder="Provide specific examples or explanation if needed..."
                  sx={{ mt: 2 }}
                />
              )}
            />

            {/* Hidden dimension ID field */}
            <Controller
              name={`dimensions.${index}.dimensionId`}
              control={control}
              defaultValue={dimension.id}
              render={({ field }) => <input type="hidden" {...field} />}
            />
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * Main GradingStrategyRenderer Component
 * 
 * Factory component that selects and renders the appropriate grading strategy
 * interface based on workshop configuration. Integrates with React Hook Form
 * for validation and submission handling.
 *
 * @param workshop - Workshop configuration including strategy type and grading settings
 * @param dimensions - Array of grading dimensions/criteria for the assessment
 * @param readonly - Whether the form should be displayed in read-only mode
 */
const GradingStrategyRenderer: React.FC<GradingStrategyRendererProps> = ({
  workshop,
  dimensions,
  readonly = false,
}) => {
  // Validate that dimensions exist
  if (!dimensions || dimensions.length === 0) {
    return (
      <Alert severity="warning">
        No grading criteria have been defined for this workshop yet.
        Please contact your instructor.
      </Alert>
    );
  }

  // Factory pattern: Select appropriate strategy renderer based on workshop strategy
  const renderStrategy = useCallback(() => {
    switch (workshop.strategy) {
      case 'accumulative':
        return (
          <AccumulativeStrategyRenderer
            workshop={workshop}
            dimensions={dimensions}
            readonly={readonly}
          />
        );

      case 'rubric':
        return (
          <RubricStrategyRenderer
            workshop={workshop}
            dimensions={dimensions}
            readonly={readonly}
          />
        );

      case 'comments':
        return (
          <CommentsStrategyRenderer
            workshop={workshop}
            dimensions={dimensions}
            readonly={readonly}
          />
        );

      case 'numerrors':
        return (
          <NumberOfErrorsStrategyRenderer
            workshop={workshop}
            dimensions={dimensions}
            readonly={readonly}
          />
        );

      default:
        return (
          <Alert severity="error">
            Unknown grading strategy: {workshop.strategy}
          </Alert>
        );
    }
  }, [workshop, dimensions, readonly]);

  return (
    <Box>
      {/* Strategy header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Assessment Criteria
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Strategy: {workshop.strategy.charAt(0).toUpperCase() + workshop.strategy.slice(1)}
        </Typography>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Render selected strategy */}
      {renderStrategy()}
    </Box>
  );
};

export default GradingStrategyRenderer;
