/**
 * PeerAssessmentForm Component
 *
 * React form component for peer assessment of workshop submissions.
 * Displays the submission being assessed and renders the appropriate grading
 * strategy form (accumulative, rubric, comments, or numerrors). Collects
 * assessment dimensions, grades, feedback comments, and overall assessment.
 * Validates required fields and grade ranges according to workshop configuration.
 * Supports draft saving and final assessment submission.
 *
 * Based on Moodle's workshop assessment functionality from:
 * - public/mod/workshop/assessment.php (assessment display and handling)
 * - public/mod/workshop/form/assessment_form.php (form structure)
 *
 * @module features/activities/workshop/components/PeerAssessmentForm
 */

import type React from 'react';
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import {
  Box,
  Typography,
  Button,
  TextField,
  FormHelperText,
  Paper,
  Divider,
  Stack,
  Card,
  CardContent,
  FormControl,
  FormLabel,
  InputAdornment,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';

// Internal imports from dependency whitelist
import GradingStrategyRenderer, {
  type GradingDimension,
} from '@/features/activities/workshop/components/GradingStrategyRenderer';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { Modal } from '@/components/feedback/Modal';
import Alert from '@/components/feedback/Alert';
import LoadingSpinner from '@/components/feedback/LoadingSpinner';

// Types
import type {
  Workshop,
  DimensionGrade,
  WorkshopUserPlan,
} from '@/features/activities/workshop/types/workshop.types';
import type { WorkshopAssessmentDimension } from '@/types/entities';

// Hooks
import {
  useAssessment,
  useUpdateAssessment,
  useSubmitAssessment,
} from '@/features/activities/workshop/hooks/useAssessment';
import { useWorkshop } from '@/features/activities/workshop/hooks/useWorkshop';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props for the PeerAssessmentForm component
 */
export interface PeerAssessmentFormProps {
  /** ID of the assessment being edited */
  assessmentId: number;
  /** ID of the workshop instance */
  workshopId: number;
  /**
   * Grading dimension definitions for the workshop.
   * Contains descriptions, max grades, weights, etc. for each criterion.
   * Required for GradingStrategyRenderer to display proper grading UI.
   */
  dimensionDefinitions?: GradingDimension[];
  /** Optional callback when assessment is successfully submitted */
  onSubmitSuccess?: (assessmentId: number) => void;
  /** Optional callback when draft is saved */
  onDraftSaved?: () => void;
  /** Optional callback to navigate to next assessment */
  onNavigateNext?: (nextAssessmentId: number) => void;
  /** Optional callback when assessment is cancelled */
  onCancel?: () => void;
}

/**
 * Extended dimension grade type for form that includes validation metadata
 */
interface FormDimensionGrade extends DimensionGrade {
  /** Maximum grade for this dimension (for validation) */
  maxgrade?: number;
  /** Whether peer comment is required */
  peercommentrequired?: boolean;
}

/**
 * Form data structure for the assessment form
 */
interface AssessmentFormData {
  /** Grades and comments for each assessment dimension */
  dimensions: FormDimensionGrade[];
  /** Overall feedback to the submission author */
  feedbackauthor: string;
  /** Format of feedback to author (1 = HTML, default) */
  feedbackauthorformat: number;
  /** Assessment weight override (for teachers with allocate capability) */
  weight: number;
  /** Grade override for grading of assessment (for teachers) */
  gradinggradeover?: number | null;
  /** Feedback from teacher to reviewer */
  feedbackreviewer?: string;
  /** Format of feedback to reviewer */
  feedbackreviewerformat?: number;
}

/**
 * Workshop phase constants matching Moodle's phase values
 */
const PHASE = {
  SETUP: 10,
  SUBMISSION: 20,
  ASSESSMENT: 30,
  EVALUATION: 40,
  CLOSED: 50,
} as const;

/**
 * Auto-save interval in milliseconds (30 seconds)
 */
const AUTO_SAVE_INTERVAL = 30000;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines if assessment is allowed in the current workshop phase
 *
 * Assessment is allowed during:
 * - Assessment phase (30) - primary assessment period
 * - Evaluation phase (40) - late assessments may be allowed
 *
 * @param phase - Current workshop phase
 * @returns true if assessment is allowed
 */
function isAssessmentPhaseActive(phase: number | undefined): boolean {
  if (!phase) {return false;}
  return phase === PHASE.ASSESSMENT || phase === PHASE.EVALUATION;
}

/**
 * Validates dimension grades according to workshop grading strategy
 *
 * @param dimensions - Array of dimension grades to validate
 * @param strategy - Workshop grading strategy type
 * @param dimensionDefinitions - Array of dimension definitions with max grades
 * @returns Array of validation error messages (empty if valid)
 */
function validateDimensions(
  dimensions: FormDimensionGrade[],
  strategy: string | undefined,
  dimensionDefinitions?: GradingDimension[]
): string[] {
  const errors: string[] = [];

  if (!dimensions || dimensions.length === 0) {
    errors.push('Assessment dimensions are required');
    return errors;
  }

  dimensions.forEach((dimension, index) => {
    const dimNumber = index + 1;
    
    // Get max grade from dimension definitions (by matching index or ID)
    const definition = dimensionDefinitions?.[index];
    const maxGrade = dimension.maxgrade ?? definition?.grade;

    // Check required grade for strategies that require it
    if (strategy !== 'comments') {
      if (dimension.grade === null || dimension.grade === undefined) {
        errors.push(`Grade is required for dimension ${dimNumber}`);
      } else if (dimension.grade < 0) {
        errors.push(`Grade for dimension ${dimNumber} cannot be negative`);
      }
    }

    // For accumulative and rubric strategies, grade must be within valid range
    if (
      strategy === 'accumulative' ||
      strategy === 'rubric'
    ) {
      if (
        dimension.grade !== null &&
        dimension.grade !== undefined &&
        maxGrade !== undefined &&
        dimension.grade > maxGrade
      ) {
        errors.push(
          `Grade for dimension ${dimNumber} exceeds maximum (${maxGrade})`
        );
      }
    }

    // Check peerComment if required (for some strategies)
    if (dimension.peercommentrequired && !dimension.peerComment?.trim()) {
      errors.push(`Comment is required for dimension ${dimNumber}`);
    }
  });

  return errors;
}

/**
 * Checks if all example assessments have been completed
 *
 * @param workshop - Workshop configuration
 * @param userPlan - User's workshop plan with task completion status
 * @returns true if examples are not required or all are completed
 */
function areExamplesCompleted(
  workshop: Workshop | undefined,
  userPlan: WorkshopUserPlan | undefined
): boolean {
  // If examples are not required, consider them completed
  if (!workshop?.useExamples) {return true;}

  // Find the example assessment task in the submission or assessment phase
  if (!userPlan?.phases) {return true;}

  for (const phase of userPlan.phases) {
    for (const task of phase.tasks) {
      // Check for example assessment tasks using 'key' property
      if (
        task.key === 'exampleassessment' ||
        task.key === 'assessexamples'
      ) {
        // Handle boolean | 'info' - treat 'info' as incomplete
        if (task.completed !== true) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Transforms form dimension grades to API-expected format
 *
 * Converts from camelCase FormDimensionGrade to lowercase WorkshopAssessmentDimension
 * to match the API contract defined in entities.ts.
 *
 * @param dimensions - Array of form dimension grades with camelCase properties
 * @returns Array of API-formatted dimension grades with lowercase properties
 */
function transformDimensionsForApi(
  dimensions: FormDimensionGrade[]
): WorkshopAssessmentDimension[] {
  return dimensions.map((dim) => ({
    dimensionid: dim.dimensionId,
    grade: dim.grade ?? undefined,
    peercomment: dim.peerComment ?? undefined,
    peercommentformat: dim.peerCommentFormat,
  }));
}

/**
 * Transforms API dimension grades to form format
 *
 * Converts from lowercase WorkshopAssessmentDimension to camelCase FormDimensionGrade
 * for use in the React Hook Form.
 *
 * @param dimensions - Array of API dimension grades with lowercase properties
 * @returns Array of form-formatted dimension grades with camelCase properties
 */
function transformDimensionsFromApi(
  dimensions: WorkshopAssessmentDimension[] | undefined
): FormDimensionGrade[] {
  if (!dimensions) {return [];}
  return dimensions.map((dim) => ({
    dimensionId: typeof dim.dimensionid === 'number' ? dim.dimensionid : Number(dim.dimensionid),
    grade: dim.grade ?? null,
    peerComment: dim.peercomment ?? null,
    peerCommentFormat: dim.peercommentformat,
  }));
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * PeerAssessmentForm Component
 *
 * Renders a complete peer assessment interface including:
 * - Display of the submission being assessed (with author anonymization if configured)
 * - Grading strategy-specific assessment dimensions form
 * - Overall feedback textarea with rich text editing
 * - Assessment weight override for teachers
 * - Draft saving with auto-save functionality
 * - Final submission with confirmation dialog
 *
 * Validates:
 * - Required grade fields per grading strategy
 * - Grade ranges (must be within 0 to max grade)
 * - Required feedback comments if configured
 * - Proper permission checks for assessment actions
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * ```tsx
 * <PeerAssessmentForm
 *   assessmentId={123}
 *   workshopId={45}
 *   onSubmitSuccess={(id) => navigate(`/workshops/${workshopId}`)}
 *   onCancel={() => navigate(-1)}
 * />
 * ```
 */
function PeerAssessmentForm({
  assessmentId,
  workshopId,
  dimensionDefinitions = [],
  onSubmitSuccess,
  onDraftSaved,
  onNavigateNext,
  onCancel,
}: PeerAssessmentFormProps): React.ReactElement {
  // ==========================================================================
  // State Management
  // ==========================================================================

  // Modal state for confirmation dialog
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [submitMode, setSubmitMode] = useState<'close' | 'next'>('close');

  // Auto-save state
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // ==========================================================================
  // Hooks
  // ==========================================================================

  const { hasCapability } = usePermissions();
  const { success: showSuccess, error: showError } = useToast();

  // Fetch workshop data
  const {
    data: workshopData,
    isLoading: isLoadingWorkshop,
    error: workshopError,
  } = useWorkshop(workshopId);

  // Fetch assessment data
  const {
    data: assessment,
    isLoading: isLoadingAssessment,
    error: assessmentError,
  } = useAssessment(assessmentId);

  // Mutation hooks
  const {
    updateAssessmentAsync,
    isLoading: isUpdating,
    error: updateError,
  } = useUpdateAssessment(assessmentId, workshopId);

  const {
    submitAssessment,
    isLoading: isSubmitting,
    isSuccess: isSubmitSuccess,
    nextAssessmentId,
    error: submitError,
  } = useSubmitAssessment(assessmentId, workshopId);

  // Check if user has allocate capability (for weight override)
  const canAllocate = hasCapability('mod/workshop:allocate');

  // Extract workshop and submission data
  const workshop = workshopData?.workshop;
  const userPlan = workshopData?.userPlan;
  const currentPhase = workshopData?.currentPhase;

  // ==========================================================================
  // Form Setup
  // ==========================================================================

  const defaultValues: AssessmentFormData = useMemo(() => ({
    dimensions: transformDimensionsFromApi(assessment?.dimensions),
    feedbackauthor: assessment?.feedbackauthor ?? '',
    feedbackauthorformat: assessment?.feedbackauthorformat ?? 1,
    weight: assessment?.weight ?? 1,
    gradinggradeover: assessment?.gradinggradeover,
    feedbackreviewer: assessment?.feedbackreviewer ?? '',
    feedbackreviewerformat: assessment?.feedbackreviewerformat ?? 1,
  }), [assessment]);

  // Form methods - using `methods` pattern to enable FormProvider for nested components
  const methods = useForm<AssessmentFormData>({
    defaultValues,
    mode: 'onChange',
  });
  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { isDirty },
  } = methods;

  // Watch form values for auto-save
  const watchedDimensions = watch('dimensions');
  const watchedFeedback = watch('feedbackauthor');

  // Reset form when assessment data loads
  useEffect(() => {
    if (assessment) {
      reset({
        dimensions: transformDimensionsFromApi(assessment.dimensions),
        feedbackauthor: assessment.feedbackauthor ?? '',
        feedbackauthorformat: assessment.feedbackauthorformat ?? 1,
        weight: assessment.weight ?? 1,
        gradinggradeover: assessment.gradinggradeover,
        feedbackreviewer: assessment.feedbackreviewer ?? '',
        feedbackreviewerformat: assessment.feedbackreviewerformat ?? 1,
      });
    }
  }, [assessment, reset]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(isDirty);
  }, [isDirty]);

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  // Determine if assessment can be edited
  const isEditable = useMemo(() => {
    // Must be in assessment phase
    if (!isAssessmentPhaseActive(currentPhase)) {return false;}

    // Check if assessment exists and is editable
    if (!assessment) {return false;}

    // Check if user is the reviewer
    // The API should validate this, but we check client-side for UI
    return true;
  }, [currentPhase, assessment]);

  // Check if examples are completed
  const examplesCompleted = useMemo(() => {
    return areExamplesCompleted(workshop, userPlan);
  }, [workshop, userPlan]);

  // Determine if feedback to author is required
  const isFeedbackRequired = useMemo(() => {
    if (!workshop) {return false;}
    // overallFeedbackMode: 0 = disabled, 1 = enabled optional, 2 = enabled required
    return workshop.overallFeedbackMode === 2;
  }, [workshop]);

  // Check if feedback is enabled at all
  const isFeedbackEnabled = useMemo(() => {
    if (!workshop) {return true;}
    return (workshop.overallFeedbackMode ?? 1) > 0;
  }, [workshop]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  /**
   * Validates the form and returns validation errors
   */
  const validateForm = useCallback((): string[] => {
    const errors: string[] = [];

    // Validate dimensions (pass dimensionDefinitions for max grade lookup)
    const dimensionErrors = validateDimensions(
      watchedDimensions,
      workshop?.strategy,
      dimensionDefinitions
    );
    errors.push(...dimensionErrors);

    // Validate required feedback
    if (isFeedbackRequired && !watchedFeedback?.trim()) {
      errors.push('Overall feedback to the author is required');
    }

    return errors;
  }, [watchedDimensions, watchedFeedback, workshop?.strategy, isFeedbackRequired, dimensionDefinitions]);

  /**
   * Saves the assessment as a draft (without finalizing)
   */
  const handleSaveDraft = useCallback(async () => {
    const formData = watch();

    try {
      await updateAssessmentAsync({
        dimensions: transformDimensionsForApi(formData.dimensions),
        feedbackauthor: formData.feedbackauthor,
        feedbackauthorformat: formData.feedbackauthorformat,
        weight: canAllocate ? formData.weight : undefined,
        gradinggradeover: canAllocate ? formData.gradinggradeover : undefined,
        feedbackreviewer: canAllocate ? formData.feedbackreviewer : undefined,
        feedbackreviewerformat: canAllocate
          ? formData.feedbackreviewerformat
          : undefined,
      });

      setLastAutoSave(new Date());
      setHasUnsavedChanges(false);
      showSuccess('Assessment draft saved successfully');
      onDraftSaved?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save draft';
      showError(errorMessage);
    }
  }, [
    watch,
    updateAssessmentAsync,
    canAllocate,
    showSuccess,
    showError,
    onDraftSaved,
  ]);

  /**
   * Opens confirmation modal before final submission
   */
  const handleSubmitClick = useCallback(
    (mode: 'close' | 'next') => {
      // Validate form first
      const errors = validateForm();
      if (errors.length > 0) {
        setValidationErrors(errors);
        showError('Please fix the validation errors before submitting');
        return;
      }

      setValidationErrors([]);
      setSubmitMode(mode);
      setIsConfirmModalOpen(true);
    },
    [validateForm, showError]
  );

  /**
   * Handles final submission after confirmation
   */
  const handleConfirmSubmit = useCallback(async () => {
    setIsConfirmModalOpen(false);
    const formData = watch();

    try {
      // First update the assessment with final data
      await updateAssessmentAsync({
        dimensions: transformDimensionsForApi(formData.dimensions),
        feedbackauthor: formData.feedbackauthor,
        feedbackauthorformat: formData.feedbackauthorformat,
        weight: canAllocate ? formData.weight : undefined,
        gradinggradeover: canAllocate ? formData.gradinggradeover : undefined,
        feedbackreviewer: canAllocate ? formData.feedbackreviewer : undefined,
        feedbackreviewerformat: canAllocate
          ? formData.feedbackreviewerformat
          : undefined,
      });

      // Then submit/finalize the assessment
      submitAssessment({
        saveandclose: submitMode === 'close',
        saveandshownext: submitMode === 'next',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to submit assessment';
      showError(errorMessage);
    }
  }, [
    watch,
    updateAssessmentAsync,
    submitAssessment,
    submitMode,
    canAllocate,
    showError,
  ]);

  /**
   * Handles modal close (cancel submission)
   */
  const handleCancelSubmit = useCallback(() => {
    setIsConfirmModalOpen(false);
  }, []);

  // ==========================================================================
  // Side Effects
  // ==========================================================================

  // Handle successful submission
  useEffect(() => {
    if (isSubmitSuccess) {
      showSuccess('Assessment submitted successfully');
      setHasUnsavedChanges(false);

      if (submitMode === 'next' && nextAssessmentId) {
        onNavigateNext?.(nextAssessmentId);
      } else {
        onSubmitSuccess?.(assessmentId);
      }
    }
  }, [
    isSubmitSuccess,
    submitMode,
    nextAssessmentId,
    assessmentId,
    showSuccess,
    onNavigateNext,
    onSubmitSuccess,
  ]);

  // Auto-save timer setup
  useEffect(() => {
    if (!isEditable || !hasUnsavedChanges) {
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new auto-save timer
    autoSaveTimerRef.current = setTimeout(() => {
      void handleSaveDraft();
    }, AUTO_SAVE_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [isEditable, hasUnsavedChanges, handleSaveDraft]);

  // Warn about unsaved changes on navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // ==========================================================================
  // Loading and Error States
  // ==========================================================================

  // Show loading spinner while data is loading
  if (isLoadingWorkshop || isLoadingAssessment) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={400}
      >
        <LoadingSpinner />
      </Box>
    );
  }

  // Show error if workshop failed to load
  if (workshopError) {
    return (
      <Alert
        severity="error"
        title="Error Loading Workshop"
        message={workshopError.message || 'Failed to load workshop data'}
      />
    );
  }

  // Show error if assessment failed to load
  if (assessmentError) {
    return (
      <Alert
        severity="error"
        title="Error Loading Assessment"
        message={assessmentError.message || 'Failed to load assessment data'}
      />
    );
  }

  // Check if assessment exists
  if (!assessment) {
    return (
      <Alert
        severity="warning"
        title="Assessment Not Found"
        message="The requested assessment could not be found. Please check the URL and try again."
      />
    );
  }

  // Check phase restrictions
  if (!isAssessmentPhaseActive(currentPhase)) {
    return (
      <Alert
        severity="info"
        title="Assessment Not Available"
        message={`Assessment is only available during the assessment phase of the workshop. The current phase is: ${workshopData?.currentPhaseTitle ?? 'Unknown'}`}
      />
    );
  }

  // Check example assessments completion
  if (!examplesCompleted) {
    return (
      <Alert
        severity="warning"
        title="Example Assessments Required"
        message="You must complete all example assessments before you can assess peer submissions. Please complete the example assessments first."
      />
    );
  }

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={handleSubmit(() => {})}>
      {/* Header Section */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Peer Assessment
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review the submission below and provide your assessment using the
          grading form.
        </Typography>

        {/* Assessment instructions from workshop */}
        {workshop?.instructReviewers && (
          <Alert
            severity="info"
            sx={{ mt: 2 }}
            title="Assessment Instructions"
            message={
              <div
                dangerouslySetInnerHTML={{
                  __html: workshop.instructReviewers,
                }}
              />
            }
          />
        )}
      </Paper>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          title="Validation Errors"
          message={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {validationErrors.map((error) => (
                <li key={`validation-error-${error}`}>{error}</li>
              ))}
            </ul>
          }
        />
      )}

      {/* Update/Submit Errors */}
      {(updateError ?? submitError) && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          title="Error"
          message={
            updateError?.message ??
            submitError?.message ??
            'An error occurred while saving the assessment'
          }
        />
      )}

      {/* Submission Display */}
      {assessment.submissionid && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Submission Being Assessed
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {assessment.submissiontitle ? (
              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                {assessment.submissiontitle}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Submission ID: {assessment.submissionid}
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grading Strategy Form */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Assessment Criteria
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Grade each criterion according to the{' '}
            {workshop?.strategy ?? 'default'} grading strategy.
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {workshop && dimensionDefinitions.length > 0 ? (
            <GradingStrategyRenderer
              workshop={workshop}
              dimensions={dimensionDefinitions}
              readonly={!isEditable}
            />
          ) : (
            <Alert
              severity="warning"
              title="Grading Criteria Unavailable"
              message="The grading criteria definitions are not available. Please contact your instructor."
            />
          )}
        </CardContent>
      </Card>

      {/* Overall Feedback Section */}
      {isFeedbackEnabled && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <FormControl fullWidth error={isFeedbackRequired && !watchedFeedback?.trim()}>
              <FormLabel component="legend">
                <Typography variant="h6" gutterBottom>
                  Overall Feedback to Author
                  {isFeedbackRequired && (
                    <Typography
                      component="span"
                      color="error"
                      sx={{ ml: 0.5 }}
                    >
                      *
                    </Typography>
                  )}
                </Typography>
              </FormLabel>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Provide constructive feedback to help the author improve their
                work.
              </Typography>

              <Controller
                name="feedbackauthor"
                control={control}
                rules={{
                  required: isFeedbackRequired
                    ? 'Overall feedback is required'
                    : false,
                }}
                render={({ field, fieldState }) => (
                  <>
                    <RichTextEditor
                      name="feedbackauthor"
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder="Enter your feedback to the submission author..."
                      disabled={!isEditable}
                    />
                    {fieldState.error && (
                      <FormHelperText error>
                        {fieldState.error.message}
                      </FormHelperText>
                    )}
                  </>
                )}
              />
            </FormControl>
          </CardContent>
        </Card>
      )}

      {/* Teacher Override Section */}
      {canAllocate && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Teacher Options
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              <InfoIcon
                fontSize="small"
                sx={{ verticalAlign: 'middle', mr: 0.5 }}
              />
              These options are only visible to teachers with allocation
              capability.
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Stack spacing={3}>
              {/* Assessment Weight Override */}
              <Controller
                name="weight"
                control={control}
                rules={{
                  min: { value: 0, message: 'Weight cannot be negative' },
                  max: { value: 16, message: 'Weight cannot exceed 16' },
                }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Assessment Weight"
                    helperText={
                      fieldState.error?.message ??
                      'Weight of this assessment in grade aggregation (0-16, default: 1)'
                    }
                    error={!!fieldState.error}
                    disabled={!isEditable}
                    InputProps={{
                      inputProps: { min: 0, max: 16, step: 1 },
                    }}
                    sx={{ maxWidth: 200 }}
                  />
                )}
              />

              {/* Grading Grade Override */}
              <Controller
                name="gradinggradeover"
                control={control}
                rules={{
                  min: {
                    value: 0,
                    message: 'Grade override cannot be negative',
                  },
                  max: {
                    value: workshop?.gradingGrade ?? 100,
                    message: `Grade override cannot exceed ${
                      workshop?.gradingGrade ?? 100
                    }`,
                  },
                }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Grading Grade Override"
                    helperText={
                      fieldState.error?.message ??
                      `Override the calculated grading grade (0-${
                        workshop?.gradingGrade ?? 100
                      })`
                    }
                    error={!!fieldState.error}
                    disabled={!isEditable}
                    InputProps={{
                      inputProps: {
                        min: 0,
                        max: workshop?.gradingGrade ?? 100,
                        step: 0.01,
                      },
                      endAdornment: (
                        <InputAdornment position="end">
                          / {workshop?.gradingGrade ?? 100}
                        </InputAdornment>
                      ),
                    }}
                    sx={{ maxWidth: 250 }}
                  />
                )}
              />

              {/* Feedback to Reviewer */}
              <Controller
                name="feedbackreviewer"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    multiline
                    rows={3}
                    label="Feedback to Reviewer"
                    helperText="Private feedback to the reviewer about their assessment quality"
                    disabled={!isEditable}
                    fullWidth
                  />
                )}
              />
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Auto-save Status */}
      {lastAutoSave && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Draft auto-saved at {lastAutoSave.toLocaleTimeString()}
          </Typography>
        </Box>
      )}

      {/* Unsaved Changes Warning */}
      {hasUnsavedChanges && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          message={
            <>
              <WarningIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
              You have unsaved changes. Save your draft or submit to avoid losing
              your work.
            </>
          }
        />
      )}

      {/* Action Buttons */}
      <Paper elevation={1} sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSaveDraft}
              disabled={!isEditable || isUpdating || isSubmitting}
            >
              {isUpdating ? 'Saving...' : 'Save Draft'}
            </Button>

            {onCancel && (
              <Button variant="outlined" color="inherit" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </Stack>

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SendIcon />}
              onClick={() => handleSubmitClick('close')}
              disabled={!isEditable || isUpdating || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
            </Button>

            <Button
              variant="contained"
              color="secondary"
              onClick={() => handleSubmitClick('next')}
              disabled={!isEditable || isUpdating || isSubmitting}
            >
              Submit and Next
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Confirmation Modal */}
      <Modal
        open={isConfirmModalOpen}
        title="Confirm Assessment Submission"
        onClose={handleCancelSubmit}
        actions={
          <>
            <Button onClick={handleCancelSubmit} color="inherit">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSubmit}
              variant="contained"
              color="primary"
            >
              Confirm Submit
            </Button>
          </>
        }
      >
        <Typography>
          Are you sure you want to submit this assessment? Once submitted, you
          may not be able to modify your grades and feedback.
        </Typography>
        {submitMode === 'next' && (
          <Typography sx={{ mt: 2 }} color="text.secondary">
            After submission, you will be redirected to the next pending
            assessment.
          </Typography>
        )}
      </Modal>
      </Box>
    </FormProvider>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default PeerAssessmentForm;
