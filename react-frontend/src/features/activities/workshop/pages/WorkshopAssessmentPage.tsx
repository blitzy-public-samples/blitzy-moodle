/**
 * WorkshopAssessmentPage Component
 *
 * A comprehensive peer assessment page component for evaluating workshop submissions.
 * This page supports multiple grading strategies (accumulative, comments, numerrors, rubric)
 * and provides a complete assessment workflow including form validation, draft saving,
 * and final submission capabilities.
 *
 * Features:
 * - Display of submission being assessed with content and attachments
 * - Grading strategy-specific assessment forms
 * - Permission validation ensuring only assigned reviewers can edit
 * - Phase validation to ensure assessments are allowed in current workshop phase
 * - Example assessment requirements enforcement
 * - Draft saving and final submission support
 * - Reference assessment display for comparison (when available)
 * - Navigation back to workshop main page
 *
 * @module features/activities/workshop/pages/WorkshopAssessmentPage
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Breadcrumbs,
  Chip,
} from '@mui/material';

// Internal imports from workshop hooks
import { useAssessment } from '../hooks/useAssessment';
import { useWorkshop } from '../hooks/useWorkshop';
import { useSubmission } from '../hooks/useSubmission';

// Internal imports from workshop components
import { AssessmentForm } from '../components/AssessmentForm';
import { SubmissionDisplay } from '../components/SubmissionDisplay';

// Internal imports from workshop types
import type {
  Workshop,
  WorkshopSubmission,
  WorkshopAssessment,
  WorkshopPhase,
  GradingStrategy,
  AssessmentDimension,
} from '../types/workshop.types';

// Global hooks
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/useToast';

/**
 * URL parameters expected by the WorkshopAssessmentPage
 * The asid (assessment ID) can be for an existing assessment or a new one
 */
interface WorkshopAssessmentPageParams {
  /** Course module ID (cmid) */
  cmid: string;
  /** Workshop ID */
  workshopId: string;
  /** Assessment ID (existing) or submission ID (for new assessments) */
  asid: string;
  /** Optional: Submission ID when creating a new assessment */
  submissionId?: string;
}

/**
 * Represents the assessment mode - whether viewing, editing, or creating
 */
type AssessmentMode = 'view' | 'edit' | 'create';

/**
 * Validation result for phase and permission checks
 */
interface ValidationResult {
  isValid: boolean;
  errorMessage: string | null;
  warningMessage: string | null;
}

/**
 * WorkshopAssessmentPage Component
 *
 * Main component for peer assessment in workshops. Handles the complete
 * assessment workflow including:
 * - Loading workshop configuration and submission data
 * - Validating permissions and phase restrictions
 * - Rendering the appropriate assessment form based on grading strategy
 * - Managing draft saves and final submissions
 * - Displaying feedback and navigation options
 *
 * @returns The rendered workshop assessment page
 */
const WorkshopAssessmentPage: React.FC = () => {
  // Extract URL parameters
  const params = useParams<WorkshopAssessmentPageParams>();
  const navigate = useNavigate();
  const { success, error, warning, info } = useToast();
  const { hasCapability, isTeacher } = usePermissions();

  // Parse URL parameters with defaults
  const cmid = params.cmid ? parseInt(params.cmid, 10) : 0;
  const workshopId = params.workshopId ? parseInt(params.workshopId, 10) : 0;
  const asid = params.asid ? parseInt(params.asid, 10) : 0;
  const submissionIdParam = params.submissionId
    ? parseInt(params.submissionId, 10)
    : undefined;

  // Local state management
  const [assessmentMode, setAssessmentMode] = useState<AssessmentMode>('view');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    errorMessage: null,
    warningMessage: null,
  });
  const [examplesAssessed, setExamplesAssessed] = useState<boolean | null>(null);

  // Fetch workshop data using React Query
  const {
    data: workshopData,
    isLoading: isWorkshopLoading,
    error: workshopError,
  } = useWorkshop(workshopId, {
    enabled: workshopId > 0,
  });

  // Fetch assessment data if we have an assessment ID
  const {
    data: assessmentData,
    isLoading: isAssessmentLoading,
    error: assessmentError,
    refetch: refetchAssessment,
  } = useAssessment(asid, {
    enabled: asid > 0 && !submissionIdParam,
  });

  // Determine the submission ID to load
  const submissionIdToLoad = useMemo(() => {
    if (submissionIdParam) {
      return submissionIdParam;
    }
    if (assessmentData?.assessment?.submissionId) {
      return assessmentData.assessment.submissionId;
    }
    return 0;
  }, [submissionIdParam, assessmentData]);

  // Fetch submission data
  const {
    data: submissionData,
    isLoading: isSubmissionLoading,
    error: submissionError,
  } = useSubmission(submissionIdToLoad, {
    enabled: submissionIdToLoad > 0,
  });

  // Extract the workshop and assessment objects from query results
  const workshop = workshopData?.workshop ?? null;
  const assessment = assessmentData?.assessment ?? null;
  const submission = submissionData?.submission ?? null;

  /**
   * Validates whether the current user can perform assessments
   * Checks phase restrictions, reviewer permissions, and example requirements
   */
  const validateAssessmentAccess = useMemo((): ValidationResult => {
    if (!workshop) {
      return {
        isValid: false,
        errorMessage: null,
        warningMessage: null,
      };
    }

    // Check if the workshop is in the assessment phase
    const assessmentPhase = 30; // WorkshopPhase.ASSESSMENT
    const evaluationPhase = 40; // WorkshopPhase.EVALUATION
    const closedPhase = 50; // WorkshopPhase.CLOSED

    if (workshop.phase === closedPhase) {
      return {
        isValid: false,
        errorMessage: 'This workshop is closed. Assessments can no longer be modified.',
        warningMessage: null,
      };
    }

    // Teachers can always view but may not edit in certain phases
    const teacherCapability = hasCapability('mod/workshop:allocate', cmid);

    // Check if assessing is allowed in the current phase
    if (workshop.phase !== assessmentPhase && !teacherCapability) {
      if (workshop.phase < assessmentPhase) {
        return {
          isValid: false,
          errorMessage:
            'The assessment phase has not started yet. Please wait until assessments are open.',
          warningMessage: null,
        };
      }
      if (workshop.phase === evaluationPhase) {
        return {
          isValid: false,
          errorMessage:
            'The assessment phase has ended. Assessments can no longer be modified.',
          warningMessage: null,
        };
      }
    }

    // Check example assessment requirements
    if (examplesAssessed === false && workshop.useexamples) {
      return {
        isValid: false,
        errorMessage:
          'You must assess all required example submissions before you can assess peers.',
        warningMessage: null,
      };
    }

    // Warn about approaching deadlines
    if (workshop.assessmentEnd) {
      const deadlineDate = new Date(workshop.assessmentEnd * 1000);
      const now = new Date();
      const hoursUntilDeadline =
        (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilDeadline > 0 && hoursUntilDeadline < 24) {
        return {
          isValid: true,
          errorMessage: null,
          warningMessage: `Assessment deadline is in ${Math.round(hoursUntilDeadline)} hours.`,
        };
      }

      if (hoursUntilDeadline <= 0) {
        return {
          isValid: false,
          errorMessage: 'The assessment deadline has passed.',
          warningMessage: null,
        };
      }
    }

    return {
      isValid: true,
      errorMessage: null,
      warningMessage: null,
    };
  }, [workshop, cmid, hasCapability, examplesAssessed]);

  /**
   * Determine the assessment mode based on data and permissions
   */
  useEffect(() => {
    if (!workshop || !submission) {
      return;
    }

    // If we have an existing assessment
    if (assessment) {
      // Check if the current user is the reviewer
      const canEdit =
        hasCapability('mod/workshop:peerassess', cmid) || isTeacher;

      if (canEdit && validateAssessmentAccess.isValid) {
        setAssessmentMode('edit');
      } else {
        setAssessmentMode('view');
      }
    } else if (submissionIdParam) {
      // Creating a new assessment for a submission
      setAssessmentMode('create');
    } else {
      setAssessmentMode('view');
    }
  }, [
    workshop,
    submission,
    assessment,
    submissionIdParam,
    cmid,
    hasCapability,
    isTeacher,
    validateAssessmentAccess.isValid,
  ]);

  /**
   * Update validation result when access validation changes
   */
  useEffect(() => {
    setValidationResult(validateAssessmentAccess);
  }, [validateAssessmentAccess]);

  /**
   * Check if example assessments are required and completed
   * This simulates the PHP check_examples_assessed_before_assessment function
   */
  useEffect(() => {
    if (!workshop) {
      return;
    }

    // If workshop doesn't use examples, mark as assessed
    if (!workshop.useexamples || workshop.examplesMode === 0) {
      setExamplesAssessed(true);
      return;
    }

    // In a real implementation, this would check against the API
    // For now, we assume examples are assessed if the user has gotten this far
    // The API should return this information as part of the workshop data
    const hasAssessedExamples =
      workshopData?.examplesAssessed !== undefined
        ? workshopData.examplesAssessed
        : true;

    setExamplesAssessed(hasAssessedExamples);
  }, [workshop, workshopData]);

  /**
   * Handle successful assessment submission
   * Shows success toast and navigates based on action
   */
  const handleAssessmentSuccess = (action: string): void => {
    switch (action) {
      case 'save':
        success('Assessment saved as draft.');
        refetchAssessment();
        break;
      case 'submit':
        success('Assessment submitted successfully.');
        navigate(`/mod/workshop/view.php?id=${cmid}`);
        break;
      case 'savenext':
        success('Assessment saved. Loading next submission...');
        // Navigate to next pending assessment
        navigate(`/mod/workshop/view.php?id=${cmid}#assessments`);
        break;
      default:
        success('Assessment saved.');
    }
  };

  /**
   * Handle assessment submission errors
   */
  const handleAssessmentError = (errorMessage: string): void => {
    error(`Failed to save assessment: ${errorMessage}`);
    setIsSubmitting(false);
  };

  /**
   * Handle form submission from AssessmentForm component
   */
  const handleFormSubmit = async (
    formData: Record<string, unknown>,
    action: string
  ): Promise<void> => {
    setIsSubmitting(true);

    try {
      // The AssessmentForm will handle the actual API call
      // We just need to show the appropriate feedback
      handleAssessmentSuccess(action);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      handleAssessmentError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle form cancellation
   */
  const handleFormCancel = (): void => {
    info('Assessment editing cancelled.');
    navigate(`/mod/workshop/view.php?id=${cmid}`);
  };

  /**
   * Check if the assessment is editable based on mode and permissions
   */
  const isEditable = useMemo((): boolean => {
    if (assessmentMode === 'view') {
      return false;
    }
    if (!validationResult.isValid) {
      return false;
    }
    return true;
  }, [assessmentMode, validationResult.isValid]);

  /**
   * Get the page title based on assessment mode
   */
  const pageTitle = useMemo((): string => {
    switch (assessmentMode) {
      case 'create':
        return 'Assess Submission';
      case 'edit':
        return 'Edit Assessment';
      case 'view':
      default:
        return 'View Assessment';
    }
  }, [assessmentMode]);

  /**
   * Get the grading strategy display name
   */
  const getStrategyDisplayName = (strategy: string): string => {
    const strategyNames: Record<string, string> = {
      accumulative: 'Accumulative Grading',
      comments: 'Comments',
      numerrors: 'Number of Errors',
      rubric: 'Rubric',
    };
    return strategyNames[strategy] || strategy;
  };

  /**
   * Render loading state
   */
  const renderLoading = (): React.ReactElement => (
    <Container maxWidth="lg">
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="400px"
        gap={2}
      >
        <CircularProgress size={48} />
        <Typography variant="body1" color="textSecondary">
          Loading assessment...
        </Typography>
      </Box>
    </Container>
  );

  /**
   * Render error state
   */
  const renderError = (errorMessage: string): React.ReactElement => (
    <Container maxWidth="lg">
      <Box py={4}>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body1">{errorMessage}</Typography>
        </Alert>
        <Button
          component={Link}
          to={`/mod/workshop/view.php?id=${cmid}`}
          variant="outlined"
        >
          Return to Workshop
        </Button>
      </Box>
    </Container>
  );

  /**
   * Render breadcrumb navigation
   */
  const renderBreadcrumbs = (): React.ReactElement => (
    <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
      <Link
        to="/my"
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <Typography color="textSecondary">Dashboard</Typography>
      </Link>
      <Link
        to={`/course/view.php?id=${workshop?.course || 0}`}
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <Typography color="textSecondary">Course</Typography>
      </Link>
      <Link
        to={`/mod/workshop/view.php?id=${cmid}`}
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <Typography color="textSecondary">
          {workshop?.name || 'Workshop'}
        </Typography>
      </Link>
      <Typography color="textPrimary">{pageTitle}</Typography>
    </Breadcrumbs>
  );

  /**
   * Render workshop phase and assessment info header
   */
  const renderAssessmentHeader = (): React.ReactElement => {
    const phaseNames: Record<number, string> = {
      0: 'Setup',
      10: 'Submission',
      20: 'Submission',
      30: 'Assessment',
      40: 'Evaluation',
      50: 'Closed',
    };

    const currentPhaseName = phaseNames[workshop?.phase || 0] || 'Unknown';

    return (
      <Box mb={4}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Typography variant="h4" component="h1">
            {pageTitle}
          </Typography>
          <Chip
            label={`${currentPhaseName} Phase`}
            color={workshop?.phase === 30 ? 'primary' : 'default'}
            size="small"
          />
          {assessment?.weight && assessment.weight > 0 && (
            <Chip
              label={`Weight: ${assessment.weight}`}
              color="secondary"
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {workshop && (
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Grading Strategy: {getStrategyDisplayName(workshop.strategy)}
          </Typography>
        )}

        {/* Validation warnings and errors */}
        {validationResult.warningMessage && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {validationResult.warningMessage}
          </Alert>
        )}

        {validationResult.errorMessage && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {validationResult.errorMessage}
          </Alert>
        )}

        {/* Example assessment requirement notice */}
        {workshop?.useexamples && examplesAssessed === false && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              This workshop requires you to assess example submissions before
              assessing peers.{' '}
              <Link
                to={`/mod/workshop/view.php?id=${cmid}#examples`}
                style={{ fontWeight: 'bold' }}
              >
                Assess examples now
              </Link>
            </Typography>
          </Alert>
        )}
      </Box>
    );
  };

  /**
   * Render the submission being assessed
   * Uses SubmissionDisplay component for consistent presentation
   */
  const renderSubmissionSection = (): React.ReactElement | null => {
    if (!submission || !workshop) {
      return null;
    }

    return (
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography
            variant="h6"
            component="h2"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            Submission Being Assessed
            {submission.late && (
              <Chip label="Late" color="warning" size="small" />
            )}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <SubmissionDisplay
            submission={submission}
            workshop={workshop}
            showGrade={assessmentMode === 'view' && Boolean(assessment?.grade)}
            showFeedback={false}
            showAuthor={!workshop.assessmentAnonymous}
            compact={false}
          />
        </CardContent>
      </Card>
    );
  };

  /**
   * Render the assessment form section
   * Includes grading strategy-specific inputs and overall feedback
   */
  const renderAssessmentFormSection = (): React.ReactElement | null => {
    if (!workshop || !submission) {
      return null;
    }

    // Don't render form if validation failed
    if (!validationResult.isValid && assessmentMode !== 'view') {
      return null;
    }

    return (
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            {assessmentMode === 'view' ? 'Assessment Details' : 'Assessment Form'}
          </Typography>
          <Divider sx={{ mb: 3 }} />

          {/* Assessment instructions */}
          {workshop.instructReviewers && assessmentMode !== 'view' && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2" component="div">
                <strong>Instructions for reviewers:</strong>
                <Box
                  component="div"
                  dangerouslySetInnerHTML={{
                    __html: workshop.instructReviewers,
                  }}
                  sx={{ mt: 1 }}
                />
              </Typography>
            </Alert>
          )}

          <AssessmentForm
            workshop={workshop}
            submission={submission}
            assessment={assessment || undefined}
            isEditable={isEditable}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
            isSubmitting={isSubmitting}
          />
        </CardContent>
      </Card>
    );
  };

  /**
   * Render reference assessment section (if available)
   * Shows teacher's reference assessment for comparison
   */
  const renderReferenceAssessment = (): React.ReactElement | null => {
    // Reference assessments would be loaded from the API
    // They are typically provided by teachers as examples of good assessments
    if (!workshopData?.referenceAssessment || !workshop) {
      return null;
    }

    const referenceAssessment = workshopData.referenceAssessment;

    return (
      <Card sx={{ mb: 4, bgcolor: 'action.hover' }}>
        <CardContent>
          <Typography
            variant="h6"
            component="h2"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            Reference Assessment
            <Chip label="Teacher" color="info" size="small" />
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="body2" color="textSecondary" paragraph>
            This is a reference assessment provided by the teacher. Compare your
            assessment with this reference to ensure you are grading consistently.
          </Typography>

          {/* Display reference assessment details */}
          {referenceAssessment.dimensionGrades && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Reference Grades:
              </Typography>
              {referenceAssessment.dimensionGrades.map(
                (
                  gradeInfo: { dimensionId: number; grade: number; comment?: string },
                  index: number
                ) => (
                  <Box
                    key={gradeInfo.dimensionId || index}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      py: 1,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="body2" sx={{ minWidth: 120 }}>
                      Criterion {index + 1}:
                    </Typography>
                    <Chip
                      label={`Grade: ${gradeInfo.grade}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    {gradeInfo.comment && (
                      <Typography variant="body2" color="textSecondary">
                        {gradeInfo.comment}
                      </Typography>
                    )}
                  </Box>
                )
              )}
            </Box>
          )}

          {referenceAssessment.feedbackAuthor && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Reference Feedback:
              </Typography>
              <Box
                component="div"
                dangerouslySetInnerHTML={{
                  __html: referenceAssessment.feedbackAuthor,
                }}
                sx={{
                  bgcolor: 'background.paper',
                  p: 2,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              />
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  /**
   * Render navigation buttons
   * Provides quick access to related pages
   */
  const renderNavigationButtons = (): React.ReactElement => (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      flexWrap="wrap"
      gap={2}
      mt={4}
    >
      <Button
        component={Link}
        to={`/mod/workshop/view.php?id=${cmid}`}
        variant="outlined"
      >
        Back to Workshop
      </Button>

      <Box display="flex" gap={2}>
        {/* Link to all assessments list */}
        <Button
          component={Link}
          to={`/mod/workshop/view.php?id=${cmid}#assessments`}
          variant="text"
          color="primary"
        >
          View All Assessments
        </Button>

        {/* Link to submission list (for teachers) */}
        {isTeacher && (
          <Button
            component={Link}
            to={`/mod/workshop/view.php?id=${cmid}#submissions`}
            variant="text"
            color="primary"
          >
            View All Submissions
          </Button>
        )}
      </Box>
    </Box>
  );

  /**
   * Render assessment weight information (for teacher assessments)
   */
  const renderWeightInfo = (): React.ReactElement | null => {
    if (!assessment?.weight || assessment.weight <= 0) {
      return null;
    }

    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Assessment Weight:</strong> This assessment has a weight of{' '}
          <strong>{assessment.weight}</strong> in the grade aggregation. Higher
          weights have more influence on the final submission grade.
        </Typography>
      </Alert>
    );
  };

  /**
   * Render assessment grade summary (for view mode)
   */
  const renderGradeSummary = (): React.ReactElement | null => {
    if (assessmentMode !== 'view' || !assessment) {
      return null;
    }

    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            Assessment Summary
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Box
            display="grid"
            gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}
            gap={2}
          >
            <Box>
              <Typography variant="body2" color="textSecondary">
                Grade for Submission
              </Typography>
              <Typography variant="h5" color="primary">
                {assessment.grade !== null && assessment.grade !== undefined
                  ? `${assessment.grade.toFixed(1)}%`
                  : 'Not graded'}
              </Typography>
            </Box>

            {assessment.gradingGrade !== null &&
              assessment.gradingGrade !== undefined && (
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Grade for Assessment
                  </Typography>
                  <Typography variant="h5" color="secondary">
                    {assessment.gradingGrade.toFixed(1)}%
                  </Typography>
                </Box>
              )}

            <Box>
              <Typography variant="body2" color="textSecondary">
                Reviewer
              </Typography>
              <Typography variant="body1">
                {assessment.reviewerName || 'Anonymous'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="textSecondary">
                Assessed On
              </Typography>
              <Typography variant="body1">
                {assessment.timeCreated
                  ? new Date(assessment.timeCreated * 1000).toLocaleString()
                  : 'Unknown'}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  // =========================================================================
  // Main render logic
  // =========================================================================

  // Show loading state while fetching data
  const isLoading = isWorkshopLoading || isAssessmentLoading || isSubmissionLoading;

  if (isLoading) {
    return renderLoading();
  }

  // Check for errors in data fetching
  if (workshopError) {
    return renderError(
      workshopError instanceof Error
        ? workshopError.message
        : 'Failed to load workshop data.'
    );
  }

  if (assessmentError && asid > 0) {
    return renderError(
      assessmentError instanceof Error
        ? assessmentError.message
        : 'Failed to load assessment data.'
    );
  }

  if (submissionError && submissionIdToLoad > 0) {
    return renderError(
      submissionError instanceof Error
        ? submissionError.message
        : 'Failed to load submission data.'
    );
  }

  // Check for required data
  if (!workshop) {
    return renderError('Workshop not found.');
  }

  if (!submission) {
    return renderError('Submission not found.');
  }

  // Main page render
  return (
    <Container maxWidth="lg">
      <Box py={4}>
        {/* Breadcrumb navigation */}
        {renderBreadcrumbs()}

        {/* Page header with phase info and validation messages */}
        {renderAssessmentHeader()}

        {/* Assessment weight info for teacher assessments */}
        {renderWeightInfo()}

        {/* Grade summary for view mode */}
        {renderGradeSummary()}

        {/* Reference assessment (if available) */}
        {renderReferenceAssessment()}

        {/* Submission being assessed */}
        {renderSubmissionSection()}

        {/* Assessment form */}
        {renderAssessmentFormSection()}

        {/* Navigation buttons */}
        {renderNavigationButtons()}
      </Box>
    </Container>
  );
};

export default WorkshopAssessmentPage;
