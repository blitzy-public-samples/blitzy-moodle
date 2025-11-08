import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  FormHelperText,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Collapse,
  IconButton,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

/**
 * Workshop grading strategy types
 */
export type GradingStrategyType = 'accumulative' | 'rubric' | 'comments' | 'numerrors';

/**
 * Workshop assessment dimension interface
 */
export interface AssessmentDimension {
  id: number;
  description: string;
  descriptionformat: number;
  grade: number;
  weight: number;
  min?: number;
  max?: number;
  [key: string]: any;
}

/**
 * Workshop interface
 */
export interface Workshop {
  id: number;
  name: string;
  strategy: GradingStrategyType;
  instructreviewers?: string;
  instructreviewersformat?: number;
  overallfeedbackmode: number;
  overallfeedbackfiles: number;
  overallfeedbackmaxbytes?: number;
  overallfeedbackmaxfiles?: number;
  [key: string]: any;
}

/**
 * Workshop assessment interface
 */
export interface WorkshopAssessment {
  id: number;
  submissionid: number;
  reviewerid: number;
  weight: number;
  feedbackauthor?: string;
  feedbackauthorformat?: number;
  feedbackauthorattachment?: number;
  grade?: number;
  gradinggradeover?: number;
  gradinggrade?: number;
  timemodified?: number;
  timecreated?: number;
  [key: string]: any;
}

/**
 * Assessment form data interface
 */
export interface AssessmentFormData {
  dimensions: Record<string, number | string>;
  feedbackauthor: string;
  feedbackauthorattachment?: File[];
  weight?: number;
  [key: string]: any;
}

/**
 * Props for the AssessmentForm component
 */
export interface AssessmentFormProps {
  workshop: Workshop;
  assessment: WorkshopAssessment | null;
  dimensions: AssessmentDimension[];
  isEditable: boolean;
  onSubmit: (data: AssessmentFormData, isDraft: boolean) => Promise<void>;
  onCancel: () => void;
  canSetWeight?: boolean;
  hasPendingAssessments?: boolean;
}

/**
 * Props for GradingStrategyRenderer component
 */
interface GradingStrategyRendererProps {
  strategy: GradingStrategyType;
  dimensions: AssessmentDimension[];
  control: any;
  errors: any;
  isEditable: boolean;
}

/**
 * GradingStrategyRenderer component
 * Renders form fields based on the grading strategy type
 */
const GradingStrategyRenderer: React.FC<GradingStrategyRendererProps> = ({
  strategy,
  dimensions,
  control,
  errors,
  isEditable,
}) => {
  /**
   * Render accumulative strategy fields
   * Shows text fields for each dimension with min/max validation
   */
  const renderAccumulativeStrategy = () => {
    return dimensions.map((dimension) => (
      <Box key={dimension.id} sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          {dimension.description}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Grade range: {dimension.min || 0} - {dimension.max || dimension.grade}
        </Typography>
        <Controller
          name={`dimensions.dim_${dimension.id}`}
          control={control}
          defaultValue=""
          rules={{
            required: 'Grade is required',
            min: {
              value: dimension.min || 0,
              message: `Minimum grade is ${dimension.min || 0}`,
            },
            max: {
              value: dimension.max || dimension.grade,
              message: `Maximum grade is ${dimension.max || dimension.grade}`,
            },
            validate: (value) => {
              const numValue = parseFloat(value);
              if (isNaN(numValue)) {
                return 'Please enter a valid number';
              }
              return true;
            },
          }}
          render={({ field }) => (
            <TextField
              {...field}
              type="number"
              fullWidth
              disabled={!isEditable}
              error={!!errors?.dimensions?.[`dim_${dimension.id}`]}
              helperText={errors?.dimensions?.[`dim_${dimension.id}`]?.message}
              inputProps={{
                min: dimension.min || 0,
                max: dimension.max || dimension.grade,
                step: 0.01,
              }}
              placeholder={`Enter grade (${dimension.min || 0}-${dimension.max || dimension.grade})`}
            />
          )}
        />
        {dimension.weight && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Weight: {dimension.weight}
          </Typography>
        )}
      </Box>
    ));
  };

  /**
   * Render rubric strategy fields
   * Shows radio buttons or select dropdowns for rubric levels
   */
  const renderRubricStrategy = () => {
    return dimensions.map((dimension) => (
      <Box key={dimension.id} sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          {dimension.description}
        </Typography>
        <Controller
          name={`dimensions.dim_${dimension.id}`}
          control={control}
          defaultValue=""
          rules={{ required: 'Please select a level' }}
          render={({ field }) => (
            <FormControl fullWidth error={!!errors?.dimensions?.[`dim_${dimension.id}`]} disabled={!isEditable}>
              <InputLabel>Select Level</InputLabel>
              <Select {...field} label="Select Level">
                {dimension.levels?.map((level: any) => (
                  <MenuItem key={level.id} value={level.id}>
                    {level.definition} ({level.grade} points)
                  </MenuItem>
                ))}
              </Select>
              {errors?.dimensions?.[`dim_${dimension.id}`] && (
                <FormHelperText>{errors.dimensions[`dim_${dimension.id}`].message}</FormHelperText>
              )}
            </FormControl>
          )}
        />
      </Box>
    ));
  };

  /**
   * Render comments strategy fields
   * Shows text areas for comments on each dimension
   */
  const renderCommentsStrategy = () => {
    return dimensions.map((dimension) => (
      <Box key={dimension.id} sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          {dimension.description}
        </Typography>
        <Controller
          name={`dimensions.dim_${dimension.id}`}
          control={control}
          defaultValue=""
          rules={{
            required: 'Comment is required',
            minLength: {
              value: 10,
              message: 'Comment must be at least 10 characters',
            },
          }}
          render={({ field }) => (
            <TextField
              {...field}
              multiline
              rows={4}
              fullWidth
              disabled={!isEditable}
              error={!!errors?.dimensions?.[`dim_${dimension.id}`]}
              helperText={
                errors?.dimensions?.[`dim_${dimension.id}`]?.message ||
                `${field.value?.length || 0} characters`
              }
              placeholder="Enter your comment..."
            />
          )}
        />
      </Box>
    ));
  };

  /**
   * Render number of errors strategy fields
   * Shows dropdown for selecting number of errors found
   */
  const renderNumErrorsStrategy = () => {
    return dimensions.map((dimension) => (
      <Box key={dimension.id} sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          {dimension.description}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Select the number of errors found
        </Typography>
        <Controller
          name={`dimensions.dim_${dimension.id}`}
          control={control}
          defaultValue=""
          rules={{ required: 'Please select the number of errors' }}
          render={({ field }) => (
            <FormControl fullWidth error={!!errors?.dimensions?.[`dim_${dimension.id}`]} disabled={!isEditable}>
              <InputLabel>Number of Errors</InputLabel>
              <Select {...field} label="Number of Errors">
                {Array.from({ length: (dimension.grade || 10) + 1 }, (_, i) => i).map((num) => (
                  <MenuItem key={num} value={num}>
                    {num} {num === 1 ? 'error' : 'errors'}
                  </MenuItem>
                ))}
              </Select>
              {errors?.dimensions?.[`dim_${dimension.id}`] && (
                <FormHelperText>{errors.dimensions[`dim_${dimension.id}`].message}</FormHelperText>
              )}
            </FormControl>
          )}
        />
      </Box>
    ));
  };

  // Render appropriate strategy fields based on strategy type
  switch (strategy) {
    case 'accumulative':
      return <>{renderAccumulativeStrategy()}</>;
    case 'rubric':
      return <>{renderRubricStrategy()}</>;
    case 'comments':
      return <>{renderCommentsStrategy()}</>;
    case 'numerrors':
      return <>{renderNumErrorsStrategy()}</>;
    default:
      return (
        <Alert severity="error">
          Unknown grading strategy: {strategy}
        </Alert>
      );
  }
};

/**
 * RichTextEditor component
 * A simple rich text editor wrapper using Material-UI TextField
 * In production, this would use a proper rich text editor like TinyMCE or Draft.js
 */
interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  maxLength?: number;
  required?: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  disabled = false,
  error = false,
  helperText,
  maxLength,
  required = false,
}) => {
  const characterCount = value?.length || 0;
  const helperTextWithCount = maxLength
    ? `${helperText || ''} ${characterCount}/${maxLength} characters`
    : helperText;

  return (
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      multiline
      rows={6}
      fullWidth
      disabled={disabled}
      error={error}
      helperText={helperTextWithCount}
      placeholder="Enter overall feedback for the author..."
      inputProps={{
        maxLength,
      }}
      required={required}
    />
  );
};

/**
 * AssessmentForm Component
 * 
 * A comprehensive form component for workshop assessments that supports multiple grading strategies.
 * Provides functionality for peer and example assessments with validation, draft saving, and
 * final submission capabilities.
 * 
 * @param props - AssessmentFormProps containing workshop, assessment, and callback functions
 * @returns React component for assessment form
 */
const AssessmentForm: React.FC<AssessmentFormProps> = ({
  workshop,
  assessment,
  dimensions,
  isEditable,
  onSubmit,
  onCancel,
  canSetWeight = false,
  hasPendingAssessments = false,
}) => {
  // Form state management with React Hook Form
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<AssessmentFormData>({
    defaultValues: {
      dimensions: {},
      feedbackauthor: assessment?.feedbackauthor || '',
      weight: assessment?.weight || 1,
    },
  });

  // Local state for UI controls
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [submitAction, setSubmitAction] = useState<'draft' | 'close' | 'next'>('draft');

  /**
   * Initialize form with existing assessment data
   */
  useEffect(() => {
    if (assessment && dimensions) {
      const dimensionValues: Record<string, any> = {};
      
      // Load existing dimension grades from assessment
      dimensions.forEach((dimension) => {
        const existingGrade = assessment[`grade_${dimension.id}`];
        if (existingGrade !== undefined) {
          dimensionValues[`dim_${dimension.id}`] = existingGrade;
        }
      });

      reset({
        dimensions: dimensionValues,
        feedbackauthor: assessment.feedbackauthor || '',
        weight: assessment.weight || 1,
      });
    }
  }, [assessment, dimensions, reset]);

  /**
   * Handle form submission
   * Validates form data and calls onSubmit callback with isDraft flag
   */
  const handleFormSubmit = async (data: AssessmentFormData) => {
    try {
      // Add uploaded files to form data
      if (uploadedFiles.length > 0) {
        data.feedbackauthorattachment = uploadedFiles;
      }

      // Determine if this is a draft submission
      const isDraft = submitAction === 'draft';

      await onSubmit(data, isDraft);
    } catch (error) {
      console.error('Error submitting assessment:', error);
      // Error handling is managed by parent component
    }
  };

  /**
   * Handle file upload for overall feedback attachments
   */
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      
      // Validate file count
      const maxFiles = workshop.overallfeedbackmaxfiles || 5;
      if (fileArray.length > maxFiles) {
        alert(`Maximum ${maxFiles} files allowed`);
        return;
      }

      // Validate file sizes
      const maxBytes = workshop.overallfeedbackmaxbytes || 5242880; // 5MB default
      const oversizedFiles = fileArray.filter(file => file.size > maxBytes);
      if (oversizedFiles.length > 0) {
        alert(`Some files exceed the maximum size of ${(maxBytes / 1048576).toFixed(2)}MB`);
        return;
      }

      setUploadedFiles(fileArray);
    }
  };

  /**
   * Available assessment weight values (0-16)
   * Used for teacher assessment weight configuration
   */
  const availableWeights = Array.from({ length: 17 }, (_, i) => i);

  /**
   * Render assessment instructions if available
   */
  const renderInstructions = () => {
    if (!workshop.instructreviewers) {
      return null;
    }

    return (
      <Card sx={{ mb: 3, bgcolor: 'info.lighter' }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() => setInstructionsExpanded(!instructionsExpanded)}
          >
            <Typography variant="h6">Instructions for Reviewers</Typography>
            <IconButton
              sx={{
                transform: instructionsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s',
              }}
              size="small"
            >
              <ExpandMoreIcon />
            </IconButton>
          </Box>
          <Collapse in={instructionsExpanded}>
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="body2"
                dangerouslySetInnerHTML={{ __html: workshop.instructreviewers }}
              />
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    );
  };

  /**
   * Render overall feedback section
   */
  const renderOverallFeedback = () => {
    if (!workshop.overallfeedbackmode || !isEditable) {
      return null;
    }

    const isRequired = workshop.overallfeedbackmode === 2;

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Overall Feedback
        </Typography>
        <Controller
          name="feedbackauthor"
          control={control}
          rules={{
            required: isRequired ? 'Overall feedback is required' : false,
            minLength: isRequired ? {
              value: 10,
              message: 'Feedback must be at least 10 characters',
            } : undefined,
          }}
          render={({ field }) => (
            <RichTextEditor
              value={field.value}
              onChange={field.onChange}
              disabled={!isEditable}
              error={!!errors.feedbackauthor}
              helperText={errors.feedbackauthor?.message}
              maxLength={5000}
              required={isRequired}
            />
          )}
        />

        {/* File attachments for overall feedback */}
        {workshop.overallfeedbackfiles > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Attach Files (Optional)
            </Typography>
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              disabled={!isEditable}
              style={{ display: 'block', marginTop: 8 }}
            />
            {uploadedFiles.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {uploadedFiles.length} file(s) selected
                </Typography>
                <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                  {uploadedFiles.map((file, index) => (
                    <li key={index}>
                      <Typography variant="caption">
                        {file.name} ({(file.size / 1024).toFixed(2)} KB)
                      </Typography>
                    </li>
                  ))}
                </ul>
              </Box>
            )}
          </Box>
        )}
      </Box>
    );
  };

  /**
   * Render assessment weight selector for teachers
   */
  const renderWeightSelector = () => {
    if (!canSetWeight || !isEditable) {
      return null;
    }

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Assessment Weight
        </Typography>
        <Controller
          name="weight"
          control={control}
          defaultValue={1}
          render={({ field }) => (
            <FormControl fullWidth>
              <InputLabel>Weight</InputLabel>
              <Select {...field} label="Weight">
                {availableWeights.map((weight) => (
                  <MenuItem key={weight} value={weight}>
                    {weight}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Set the importance of this assessment (0 = excluded from calculation)
              </FormHelperText>
            </FormControl>
          )}
        />
      </Box>
    );
  };

  /**
   * Render form action buttons
   */
  const renderActionButtons = () => {
    if (!isEditable) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="outlined" onClick={onCancel}>
            Close
          </Button>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        
        <Button
          variant="outlined"
          onClick={handleSubmit((data) => {
            setSubmitAction('draft');
            return handleFormSubmit(data);
          })}
          disabled={isSubmitting}
        >
          {isSubmitting && submitAction === 'draft' ? (
            <CircularProgress size={20} sx={{ mr: 1 }} />
          ) : null}
          Save and Continue
        </Button>

        {hasPendingAssessments && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit((data) => {
              setSubmitAction('next');
              return handleFormSubmit(data);
            })}
            disabled={isSubmitting}
          >
            {isSubmitting && submitAction === 'next' ? (
              <CircularProgress size={20} sx={{ mr: 1 }} />
            ) : null}
            Save and Show Next
          </Button>
        )}

        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit((data) => {
            setSubmitAction('close');
            return handleFormSubmit(data);
          })}
          disabled={isSubmitting}
        >
          {isSubmitting && submitAction === 'close' ? (
            <CircularProgress size={20} sx={{ mr: 1 }} />
          ) : null}
          Save and Close
        </Button>
      </Box>
    );
  };

  // Main component render
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          {assessment ? 'Edit Assessment' : 'New Assessment'}
        </Typography>

        {/* Assessment Instructions */}
        {renderInstructions()}

        {/* Grading Strategy Fields */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Assessment Criteria
          </Typography>
          {dimensions.length === 0 ? (
            <Alert severity="warning">
              No assessment dimensions configured for this workshop.
            </Alert>
          ) : (
            <GradingStrategyRenderer
              strategy={workshop.strategy}
              dimensions={dimensions}
              control={control}
              errors={errors}
              isEditable={isEditable}
            />
          )}
        </Box>

        {/* Overall Feedback Section */}
        {renderOverallFeedback()}

        {/* Assessment Weight Selector */}
        {renderWeightSelector()}

        {/* Form Action Buttons */}
        {renderActionButtons()}

        {/* Global Form Errors */}
        {errors.root && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errors.root.message}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default AssessmentForm;
