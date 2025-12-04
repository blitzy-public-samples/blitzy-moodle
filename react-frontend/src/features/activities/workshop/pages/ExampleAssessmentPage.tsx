/**
 * Example Assessment Page Component
 *
 * This page handles the workshop example assessment workflow where students can
 * practice their assessment skills on teacher-provided example submissions. After
 * submitting their practice assessment, users receive immediate feedback by comparing
 * their grades against the reference assessment provided by the teacher.
 *
 * Key Features:
 * - Display of example submission for training assessment
 * - Assessment form identical to peer assessment but for practice purposes
 * - Clear indication this is a training/example assessment
 * - Comparison view showing user's assessment vs reference assessment after submission
 * - Feedback on how close the user's grades match the reference grades
 * - Option to reassess the example to improve assessment skills
 * - Progress tracking showing completion status of required examples
 * - Navigation to next example assessment if multiple examples exist
 *
 * Based on Moodle's workshop example assessment functionality from:
 * - public/mod/workshop/exassessment.php (example assessment form handling)
 * - public/mod/workshop/excompare.php (comparison view after submission)
 * - public/mod/workshop/locallib.php (workshop class and helper functions)
 *
 * @module features/activities/workshop/pages/ExampleAssessmentPage
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  LinearProgress,
  Chip,
  Divider,
} from '@mui/material';

// Internal imports from workshop module
import {
  useExampleSubmission,
  useExampleAssessment,
  useCreateExampleAssessment,
  useUpdateExampleAssessment,
  useSubmitExampleAssessment,
  useExampleAssessmentComparison,
} from '@/features/activities/workshop/hooks/useExampleAssessment';
import { AssessmentForm } from '@/features/activities/workshop/components/AssessmentForm';
import { AssessmentComparison } from '@/features/activities/workshop/components/AssessmentComparison';
import { SubmissionDisplay } from '@/features/activities/workshop/components/SubmissionDisplay';
import type {
  Workshop,
  WorkshopSubmission,
  WorkshopAssessment,
  WorkshopPhase,
  GradingStrategy,
  AssessmentDimension,
} from '@/features/activities/workshop/types/workshop.types';
import { useWorkshop } from '@/features/activities/workshop/hooks/useWorkshop';

// Global hooks
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * URL parameters expected by this page
 */
interface ExampleAssessmentParams {
  workshopId: string;
  exampleId: string;
  assessmentId?: string;
}

/**
 * View mode for the page
 * - 'assess': User is creating/editing their assessment
 * - 'compare': User is viewing comparison with reference assessment
 * - 'view': User is viewing an existing assessment (read-only)
 */
type ViewMode = 'assess' | 'compare' | 'view';

/**
 * Example progress tracking interface
 */
interface ExampleProgress {
  total: number;
  completed: number;
  currentIndex: number;
  examples: {
    id: number;
    title: string;
    assessed: boolean;
  }[];
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Training banner component to clearly indicate this is a practice assessment
 */
const TrainingBanner: React.FC<{ isComparison?: boolean }> = ({ isComparison = false }) => (
  <Alert
    severity="info"
    sx={{
      mb: 3,
      '& .MuiAlert-message': {
        width: '100%',
      },
    }}
  >
    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
      {isComparison ? 'Assessment Training - Results' : 'Assessment Training Exercise'}
    </Typography>
    <Typography variant="body2">
      {isComparison
        ? 'Below you can see how your assessment compares to the reference assessment provided by the teacher. Use this feedback to improve your assessment skills before the peer assessment phase.'
        : 'This is a training exercise to help you practice assessment skills. Assess this example submission as you would assess your peers\' work. After submitting, you will see how your assessment compares to the reference assessment.'}
    </Typography>
  </Alert>
);

/**
 * Progress stepper component showing completion status of required examples
 */
const ExampleProgressStepper: React.FC<{
  progress: ExampleProgress;
  currentExampleId: number;
  workshopId: number;
}> = ({ progress, currentExampleId, workshopId }) => {
  const navigate = useNavigate();

  if (progress.total <= 1) {
    return null;
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="medium">
            Training Progress
          </Typography>
          <Chip
            label={`${progress.completed}/${progress.total} completed`}
            color={progress.completed === progress.total ? 'success' : 'default'}
            size="small"
            sx={{ ml: 2 }}
          />
        </Box>
        <LinearProgress
          variant="determinate"
          value={(progress.completed / progress.total) * 100}
          sx={{ mb: 2, height: 8, borderRadius: 4 }}
        />
        <Stepper activeStep={progress.currentIndex} alternativeLabel>
          {progress.examples.map((example, index) => (
            <Step key={example.id} completed={example.assessed}>
              <StepLabel
                onClick={() => {
                  if (example.id !== currentExampleId) {
                    navigate(`/mod/workshop/${workshopId}/example/${example.id}`);
                  }
                }}
                sx={{
                  cursor: example.id !== currentExampleId ? 'pointer' : 'default',
                  '&:hover': {
                    opacity: example.id !== currentExampleId ? 0.7 : 1,
                  },
                }}
              >
                <Typography
                  variant="caption"
                  color={example.id === currentExampleId ? 'primary' : 'textSecondary'}
                >
                  {example.title.length > 20
                    ? `${example.title.substring(0, 20)}...`
                    : example.title}
                </Typography>
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </CardContent>
    </Card>
  );
};

/**
 * Navigation buttons for moving between examples
 */
const ExampleNavigation: React.FC<{
  progress: ExampleProgress;
  currentExampleId: number;
  workshopId: number;
  onBackToWorkshop: () => void;
}> = ({ progress, currentExampleId, workshopId, onBackToWorkshop }) => {
  const navigate = useNavigate();

  const currentIndex = progress.examples.findIndex((e) => e.id === currentExampleId);
  const prevExample = currentIndex > 0 ? progress.examples[currentIndex - 1] : null;
  const nextExample =
    currentIndex < progress.examples.length - 1 ? progress.examples[currentIndex + 1] : null;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mt: 3,
        pt: 2,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Box>
        {prevExample && (
          <Button
            variant="outlined"
            onClick={() => navigate(`/mod/workshop/${workshopId}/example/${prevExample.id}`)}
          >
            ← Previous Example
          </Button>
        )}
      </Box>
      <Button variant="outlined" color="secondary" onClick={onBackToWorkshop}>
        Back to Workshop
      </Button>
      <Box>
        {nextExample && (
          <Button
            variant="contained"
            onClick={() => navigate(`/mod/workshop/${workshopId}/example/${nextExample.id}`)}
          >
            Next Example →
          </Button>
        )}
      </Box>
    </Box>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Example Assessment Page Component
 *
 * Handles the complete workflow for practicing assessment skills on example
 * submissions in a workshop activity. Supports assessment creation, editing,
 * submission, and comparison with reference assessment.
 */
const ExampleAssessmentPage: React.FC = () => {
  // -------------------------------------------------------------------------
  // URL Parameters and Navigation
  // -------------------------------------------------------------------------
  const { workshopId, exampleId, assessmentId } = useParams<
    keyof ExampleAssessmentParams
  >() as ExampleAssessmentParams;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const workshopIdNum = parseInt(workshopId, 10);
  const exampleIdNum = parseInt(exampleId, 10);
  const assessmentIdNum = assessmentId ? parseInt(assessmentId, 10) : undefined;

  // Get mode from query params - defaults to 'assess' if not specified
  const modeParam = searchParams.get('mode') as ViewMode | null;

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------
  const { hasCapability, hasAnyCapability, isTeacher } = usePermissions();
  const { success, error: showError, warning } = useToast();

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [viewMode, setViewMode] = useState<ViewMode>(modeParam || 'assess');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // -------------------------------------------------------------------------
  // Data Fetching with React Query
  // -------------------------------------------------------------------------

  // Fetch workshop data
  const {
    data: workshopData,
    isLoading: isLoadingWorkshop,
    error: workshopError,
  } = useWorkshop(workshopIdNum, {
    enabled: !isNaN(workshopIdNum),
  });

  // Fetch example submission
  const {
    data: exampleSubmission,
    isLoading: isLoadingExample,
    error: exampleError,
  } = useExampleSubmission(exampleIdNum, {
    enabled: !isNaN(exampleIdNum),
  });

  // Fetch existing assessment if assessmentId is provided
  const {
    data: existingAssessment,
    isLoading: isLoadingAssessment,
    error: assessmentError,
  } = useExampleAssessment(assessmentIdNum || 0, {
    enabled: !!assessmentIdNum && !isNaN(assessmentIdNum),
  });

  // Fetch comparison data when in comparison mode
  const {
    data: comparisonData,
    isLoading: isLoadingComparison,
    error: comparisonError,
  } = useExampleAssessmentComparison(
    exampleIdNum,
    existingAssessment?.id || assessmentIdNum || 0,
    {
      enabled: viewMode === 'compare' && !!(existingAssessment?.id || assessmentIdNum),
    }
  );

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const createAssessmentMutation = useCreateExampleAssessment();
  const updateAssessmentMutation = useUpdateExampleAssessment();
  const submitAssessmentMutation = useSubmitExampleAssessment();

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------

  const isLoading =
    isLoadingWorkshop ||
    isLoadingExample ||
    isLoadingAssessment ||
    (viewMode === 'compare' && isLoadingComparison);

  const workshop = workshopData?.workshop;
  const currentPhase = workshopData?.currentPhase;

  // Determine if user can assess examples based on workshop phase and permissions
  // Students can assess examples during setup phase or when examples are required
  const canAssessExamples =
    workshop &&
    (hasAnyCapability(['mod/workshop:manage', 'mod/workshop:editdimensions']) ||
      (workshop.useexamples !== 0 && hasCapability('mod/workshop:submit')));

  // Determine if the assessment form should be editable
  const isEditable =
    viewMode === 'assess' &&
    canAssessExamples &&
    (!existingAssessment || existingAssessment.grade === null);

  // Build progress tracking data from workshop submissions
  const exampleProgress: ExampleProgress | null = React.useMemo(() => {
    if (!workshopData?.submissions) {
      return null;
    }

    const examples = workshopData.submissions
      .filter((s) => s.example)
      .map((s) => ({
        id: s.id,
        title: s.title,
        assessed: s.gradeover !== null && s.gradeover !== undefined,
      }));

    if (examples.length === 0) {
      return null;
    }

    const currentIndex = examples.findIndex((e) => e.id === exampleIdNum);
    const completed = examples.filter((e) => e.assessed).length;

    return {
      total: examples.length,
      completed,
      currentIndex: currentIndex >= 0 ? currentIndex : 0,
      examples,
    };
  }, [workshopData?.submissions, exampleIdNum]);

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  // Update view mode based on URL params or assessment state
  useEffect(() => {
    if (modeParam) {
      setViewMode(modeParam);
    } else if (existingAssessment?.grade !== null && existingAssessment?.grade !== undefined) {
      // If assessment already has a grade, show comparison by default
      setViewMode('compare');
    }
  }, [modeParam, existingAssessment?.grade]);

  // -------------------------------------------------------------------------
  // Event Handlers
  // -------------------------------------------------------------------------

  /**
   * Handle assessment form submission
   * Creates or updates the assessment and optionally finalizes it
   */
  const handleAssessmentSubmit = async (
    data: {
      dimensionGrades: Record<number, number>;
      overallFeedback: string;
      feedbackFormat: number;
    },
    action: 'save' | 'submit' | 'saveAndNext'
  ) => {
    if (!exampleSubmission || !workshop) {
      showError('Cannot submit assessment: missing required data');
      return;
    }

    setIsSubmitting(true);

    try {
      let assessmentResult;

      if (existingAssessment?.id) {
        // Update existing assessment
        assessmentResult = await updateAssessmentMutation.mutateAsync({
          assessmentId: existingAssessment.id,
          workshopId: workshopIdNum,
          dimensionGrades: data.dimensionGrades,
          overallFeedback: data.overallFeedback,
          feedbackFormat: data.feedbackFormat,
        });
        success('Assessment updated successfully');
      } else {
        // Create new assessment
        assessmentResult = await createAssessmentMutation.mutateAsync({
          exampleId: exampleIdNum,
          workshopId: workshopIdNum,
          dimensionGrades: data.dimensionGrades,
          overallFeedback: data.overallFeedback,
          feedbackFormat: data.feedbackFormat,
        });
        success('Assessment created successfully');
      }

      // If submitting for final comparison
      if (action === 'submit' && assessmentResult?.id) {
        await submitAssessmentMutation.mutateAsync({
          assessmentId: assessmentResult.id,
          workshopId: workshopIdNum,
        });
        success('Assessment submitted! View your comparison below.');
        setViewMode('compare');
        // Navigate to comparison view
        navigate(
          `/mod/workshop/${workshopId}/example/${exampleId}/assessment/${assessmentResult.id}?mode=compare`,
          { replace: true }
        );
      } else if (action === 'saveAndNext' && exampleProgress) {
        // Navigate to next example
        const currentIndex = exampleProgress.examples.findIndex((e) => e.id === exampleIdNum);
        const nextExample = exampleProgress.examples[currentIndex + 1];
        if (nextExample) {
          navigate(`/mod/workshop/${workshopId}/example/${nextExample.id}`);
        } else {
          warning('No more examples to assess. Returning to workshop.');
          navigate(`/mod/workshop/${workshopId}`);
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to save assessment';
      showError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle reassess action from comparison view
   */
  const handleReassess = () => {
    setViewMode('assess');
    navigate(
      `/mod/workshop/${workshopId}/example/${exampleId}${assessmentId ? `/assessment/${assessmentId}` : ''}?mode=assess`,
      { replace: true }
    );
  };

  /**
   * Handle cancel action - return to workshop
   */
  const handleCancel = () => {
    navigate(`/mod/workshop/${workshopId}`);
  };

  /**
   * Handle navigation back to workshop
   */
  const handleBackToWorkshop = () => {
    navigate(`/mod/workshop/${workshopId}`);
  };

  // -------------------------------------------------------------------------
  // Error Handling
  // -------------------------------------------------------------------------

  if (workshopError || exampleError || assessmentError) {
    const errorMsg =
      workshopError?.message ||
      exampleError?.message ||
      assessmentError?.message ||
      'An error occurred while loading the page';

    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMsg}
        </Alert>
        <Button variant="contained" onClick={handleBackToWorkshop}>
          Back to Workshop
        </Button>
      </Container>
    );
  }

  // -------------------------------------------------------------------------
  // Loading State
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
          <CircularProgress size={48} sx={{ mb: 2 }} />
          <Typography variant="body1" color="textSecondary">
            Loading example assessment...
          </Typography>
        </Box>
      </Container>
    );
  }

  // -------------------------------------------------------------------------
  // Permission Check
  // -------------------------------------------------------------------------

  if (!canAssessExamples) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          You do not have permission to assess example submissions in this workshop.
        </Alert>
        <Button variant="contained" onClick={handleBackToWorkshop}>
          Back to Workshop
        </Button>
      </Container>
    );
  }

  // -------------------------------------------------------------------------
  // Missing Data Check
  // -------------------------------------------------------------------------

  if (!workshop || !exampleSubmission) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Unable to load example submission. It may have been removed or you may not have access.
        </Alert>
        <Button variant="contained" onClick={handleBackToWorkshop}>
          Back to Workshop
        </Button>
      </Container>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Example Assessment
        </Typography>
        <Typography variant="subtitle1" color="textSecondary">
          {workshop.name}
        </Typography>
      </Box>

      {/* Training Banner */}
      <TrainingBanner isComparison={viewMode === 'compare'} />

      {/* Progress Stepper */}
      {exampleProgress && (
        <ExampleProgressStepper
          progress={exampleProgress}
          currentExampleId={exampleIdNum}
          workshopId={workshopIdNum}
        />
      )}

      {/* Main Content */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {/* Example Submission Display */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Example Submission
            </Typography>
            <SubmissionDisplay
              submission={exampleSubmission as WorkshopSubmission}
              showAuthor={isTeacher}
              isExample={true}
              workshop={workshop}
            />
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Assessment Form or Comparison View */}
          {viewMode === 'compare' && comparisonData ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                Assessment Comparison
              </Typography>
              <AssessmentComparison
                referenceAssessment={comparisonData.referenceAssessment}
                userAssessment={comparisonData.userAssessment}
                workshop={workshop}
                comparisonData={comparisonData}
                onReassess={handleReassess}
                canReassess={canAssessExamples}
              />
            </Box>
          ) : (
            <Box>
              <Typography variant="h6" gutterBottom>
                {isEditable ? 'Your Assessment' : 'Assessment (View Only)'}
              </Typography>
              {!isEditable && existingAssessment && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  This assessment has already been submitted. You can view the comparison or
                  reassess to practice again.
                </Alert>
              )}
              <AssessmentForm
                workshop={workshop}
                assessment={existingAssessment || undefined}
                dimensions={workshop.dimensions || []}
                isEditable={isEditable}
                onSubmit={handleAssessmentSubmit}
                onCancel={handleCancel}
                canSetWeight={false}
                hasPendingAssessments={
                  exampleProgress
                    ? exampleProgress.completed < exampleProgress.total
                    : false
                }
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      {exampleProgress && (
        <ExampleNavigation
          progress={exampleProgress}
          currentExampleId={exampleIdNum}
          workshopId={workshopIdNum}
          onBackToWorkshop={handleBackToWorkshop}
        />
      )}

      {/* Additional Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
        {viewMode === 'compare' && canAssessExamples && (
          <Button variant="outlined" onClick={handleReassess}>
            Reassess This Example
          </Button>
        )}
        {viewMode === 'assess' && existingAssessment?.grade !== null && (
          <Button
            variant="outlined"
            onClick={() => {
              setViewMode('compare');
              navigate(
                `/mod/workshop/${workshopId}/example/${exampleId}/assessment/${existingAssessment.id}?mode=compare`,
                { replace: true }
              );
            }}
          >
            View Comparison
          </Button>
        )}
      </Box>

      {/* Submission Loading Overlay */}
      {isSubmitting && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <CircularProgress size={48} sx={{ mb: 2 }} />
          <Typography variant="body1">Saving your assessment...</Typography>
        </Box>
      )}
    </Container>
  );
};

export default ExampleAssessmentPage;
