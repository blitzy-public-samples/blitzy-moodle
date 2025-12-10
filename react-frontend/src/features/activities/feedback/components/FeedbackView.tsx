/**
 * FeedbackView Component
 *
 * Main feedback activity view component that displays feedback details, description,
 * availability dates, anonymous settings, and provides navigation to complete
 * feedback (FeedbackForm) or view analysis (FeedbackAnalysis) based on user
 * permissions and feedback status.
 *
 * Features:
 * - Displays feedback header with name, course, description
 * - Shows availability information (open/close dates, status indicator)
 * - Displays submission status and completion requirements
 * - Provides action buttons based on permissions (Complete, View Analysis, Edit)
 * - Implements conditional rendering for form/analysis views
 * - Full accessibility with WCAG 2.1 AA compliance
 * - Responsive layout using MUI Grid
 * - Loading and error state handling
 *
 * Based on public/mod/feedback/view.php structure.
 *
 * @module features/activities/feedback/components/FeedbackView
 * @see public/mod/feedback/view.php - PHP feedback view page
 * @see public/mod/feedback/lib.php - Core feedback functions
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import {
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  Grid,
  Box,
  Skeleton,
  Avatar,
  CardMedia,
} from '@mui/material';
import {
  Assignment,
  Analytics,
  Edit,
  CheckCircle,
  Schedule,
  Info,
} from '@mui/icons-material';

// Internal imports from depends_on_files
import { useFeedback } from '../hooks/useFeedback';
import { FeedbackForm } from './FeedbackForm';
import { FeedbackAnalysis } from './FeedbackAnalysis';
import type { Feedback, FeedbackPermissions } from '../types';
import Breadcrumbs from '@/components/navigation/Breadcrumbs';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Alert } from '@/components/feedback/Alert';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * View mode type for the component state
 * - 'view': Display feedback overview (default)
 * - 'form': Display feedback completion form
 * - 'analysis': Display feedback analysis/results
 */
export type ViewMode = 'view' | 'form' | 'analysis';

/**
 * Status type for feedback availability
 * - 'open': Feedback is currently accepting responses
 * - 'closed': Feedback is no longer accepting responses
 * - 'not_yet_open': Feedback has not opened yet
 */
export type FeedbackStatus = 'open' | 'closed' | 'not_yet_open';

/**
 * Permission set interface for controlling UI visibility
 */
export interface PermissionSet {
  /** Can the user complete the feedback */
  canComplete: boolean;
  /** Can the user view analysis results */
  canViewAnalysis: boolean;
  /** Can the user view individual responses */
  canViewResponses: boolean;
  /** Can the user edit their responses */
  canEditResponses: boolean;
  /** Can the user manage the feedback */
  canManage: boolean;
}

/**
 * Extended feedback detail interface with additional computed properties
 */
export interface FeedbackDetail extends Feedback {
  /** Course name for breadcrumb display */
  courseName?: string;
  /** Number of questions in the feedback */
  questionCount?: number;
  /** Estimated completion time in minutes */
  estimatedTime?: number;
  /** Total number of users who can complete */
  totalUsers?: number;
  /** Number of users who have completed */
  completedCount?: number;
}

/**
 * Props interface for FeedbackView component
 */
export interface FeedbackViewProps {
  /** Feedback activity ID (optional, can be from route params) */
  feedbackId?: number;
  /** Course ID (optional, can be from route params) */
  courseId?: number;
  /** Permission to complete feedback (optional, calculated if not provided) */
  canComplete?: boolean;
  /** Permission to view analysis (optional, calculated if not provided) */
  canViewAnalysis?: boolean;
  /** Permission to view responses (optional, calculated if not provided) */
  canViewResponses?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Anonymous feedback mode constant (matches FEEDBACK_ANONYMOUS_YES from lib.php) */
const FEEDBACK_ANONYMOUS_YES = 1;

/** Status chip color mapping */
const STATUS_COLORS: Record<FeedbackStatus, 'success' | 'error' | 'warning'> = {
  open: 'success',
  closed: 'error',
  not_yet_open: 'warning',
};

/** Status labels for display */
const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: 'Open',
  closed: 'Closed',
  not_yet_open: 'Not Yet Open',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formats a Unix timestamp to a human-readable date string
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string or 'Not set' if no timestamp
 */
function formatTimestamp(timestamp: number | undefined | null): string {
  if (!timestamp || timestamp === 0) {
    return 'Not set';
  }
  try {
    // Convert Unix timestamp (seconds) to milliseconds for JavaScript Date
    const date = new Date(timestamp * 1000);
    return format(date, 'PPp'); // e.g., "Mar 15, 2024 at 2:30 PM"
  } catch {
    return 'Invalid date';
  }
}

/**
 * Determines the feedback availability status based on time settings
 *
 * @param timeopen - Unix timestamp when feedback opens (0 = always open)
 * @param timeclose - Unix timestamp when feedback closes (0 = no deadline)
 * @returns Current status of the feedback
 */
function determineFeedbackStatus(
  timeopen: number | undefined | null,
  timeclose: number | undefined | null
): FeedbackStatus {
  const now = Math.floor(Date.now() / 1000); // Current Unix timestamp

  // Check if feedback hasn't opened yet
  if (timeopen && timeopen > 0 && timeopen > now) {
    return 'not_yet_open';
  }

  // Check if feedback has closed
  if (timeclose && timeclose > 0 && timeclose < now) {
    return 'closed';
  }

  // Feedback is open
  return 'open';
}

// ============================================================================
// COMPONENT IMPLEMENTATION
// ============================================================================

/**
 * FeedbackView Component
 *
 * Main view component for feedback activities that handles:
 * - Display of feedback information and availability
 * - Permission-based action buttons
 * - Conditional rendering of form and analysis views
 * - Loading and error states
 *
 * @param props - Component props
 * @returns Rendered feedback view component
 */
export function FeedbackView({
  feedbackId: propFeedbackId,
  courseId: propCourseId,
  canComplete: propCanComplete,
  canViewAnalysis: propCanViewAnalysis,
  canViewResponses: propCanViewResponses,
}: FeedbackViewProps): JSX.Element {
  // ============================================================================
  // HOOKS AND STATE
  // ============================================================================

  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ feedbackId?: string; courseId?: string }>();
  const { hasCapability, isTeacher, isAdmin, isStudent } = usePermissions();
  const { success, error: showError, info } = useToast();

  // Extract IDs from props or route params
  const feedbackId = propFeedbackId ?? (params.feedbackId ? parseInt(params.feedbackId, 10) : 0);
  const courseId = propCourseId ?? (params.courseId ? parseInt(params.courseId, 10) : undefined);

  // View mode state for conditional rendering
  const [viewMode, setViewMode] = useState<ViewMode>('view');

  // Fetch feedback data using React Query hook
  const {
    feedback,
    questions,
    completion,
    isOpen,
    canComplete: hookCanComplete,
    canSubmit,
    isAnonymous,
    hasResponded,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useFeedback({
    feedbackId,
    courseId,
    enabled: feedbackId > 0,
  });

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  /**
   * Determine permissions based on props, hook data, and capability checks
   */
  const permissions = useMemo((): PermissionSet => {
    const canCompleteCalc = propCanComplete ?? hookCanComplete;
    const canViewAnalysisCalc =
      propCanViewAnalysis ??
      hasCapability('mod/feedback:viewanalysepage') ||
      isTeacher ||
      isAdmin;
    const canViewResponsesCalc =
      propCanViewResponses ??
      hasCapability('mod/feedback:viewreports') ||
      isTeacher ||
      isAdmin;
    const canEditResponses =
      hasResponded && canCompleteCalc && feedback?.multiple_submit === 1;
    const canManage = hasCapability('mod/feedback:edititems') || isAdmin;

    return {
      canComplete: canCompleteCalc,
      canViewAnalysis: canViewAnalysisCalc,
      canViewResponses: canViewResponsesCalc,
      canEditResponses,
      canManage,
    };
  }, [
    propCanComplete,
    propCanViewAnalysis,
    propCanViewResponses,
    hookCanComplete,
    hasCapability,
    isTeacher,
    isAdmin,
    hasResponded,
    feedback?.multiple_submit,
  ]);

  /**
   * Calculate feedback status based on time settings
   */
  const feedbackStatus = useMemo((): FeedbackStatus => {
    if (!feedback) return 'closed';
    return determineFeedbackStatus(feedback.timeopen, feedback.timeclose);
  }, [feedback]);

  /**
   * Calculate number of actual questions (excluding labels, pagebreaks, etc.)
   */
  const questionCount = useMemo((): number => {
    if (!questions || questions.length === 0) return 0;
    return questions.filter(
      (q) => q.typ !== 'label' && q.typ !== 'pagebreak' && q.typ !== 'info'
    ).length;
  }, [questions]);

  /**
   * Estimate completion time based on question count
   * Average ~30 seconds per question
   */
  const estimatedTime = useMemo((): number => {
    const minTime = Math.ceil((questionCount * 0.5)); // 30 seconds per question
    return Math.max(1, minTime); // Minimum 1 minute
  }, [questionCount]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Handle navigation to feedback completion form
   */
  const handleStartFeedback = (): void => {
    if (!permissions.canComplete || !isOpen) {
      showError('You cannot complete this feedback at this time.');
      return;
    }
    setViewMode('form');
    info('Starting feedback submission...');
  };

  /**
   * Handle navigation to feedback analysis view
   */
  const handleViewAnalysis = (): void => {
    if (!permissions.canViewAnalysis) {
      showError('You do not have permission to view the analysis.');
      return;
    }
    setViewMode('analysis');
  };

  /**
   * Handle navigation to edit responses
   */
  const handleEditResponses = (): void => {
    if (!permissions.canEditResponses) {
      showError('You cannot edit your responses.');
      return;
    }
    setViewMode('form');
  };

  /**
   * Handle returning to the main view from form or analysis
   */
  const handleReturnToView = (): void => {
    setViewMode('view');
    refetch();
  };

  /**
   * Handle form submission completion
   */
  const handleFormComplete = (): void => {
    success('Thank you! Your feedback has been submitted successfully.');
    setViewMode('view');
    refetch();
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * Renders loading skeleton while data is being fetched
   */
  const renderLoadingSkeleton = (): JSX.Element => (
    <Box sx={{ width: '100%', p: 3 }}>
      <Skeleton variant="text" height={48} width="60%" sx={{ mb: 2 }} />
      <Skeleton variant="text" height={24} width="40%" sx={{ mb: 3 }} />
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Skeleton variant="rectangular" height={200} sx={{ mb: 2, borderRadius: 1 }} />
          <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 1 }} />
        </Grid>
        <Grid item xs={12} md={4}>
          <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
        </Grid>
      </Grid>
    </Box>
  );

  /**
   * Renders error state when data fetch fails
   */
  const renderErrorState = (): JSX.Element => (
    <Box sx={{ p: 3 }}>
      <Alert
        severity="error"
        title="Error Loading Feedback"
        message={
          error?.message ||
          'Unable to load feedback details. Please try again later.'
        }
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => refetch()}
            aria-label="Retry loading feedback"
          >
            Retry
          </Button>
        }
      />
    </Box>
  );

  /**
   * Renders the feedback header section
   */
  const renderHeader = (): JSX.Element => (
    <Box sx={{ mb: 3 }}>
      {/* Breadcrumb navigation */}
      <Breadcrumbs />

      {/* Feedback title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Avatar
          sx={{
            bgcolor: 'primary.main',
            width: 56,
            height: 56,
          }}
          aria-hidden="true"
        >
          <Assignment fontSize="large" />
        </Avatar>
        <Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 600 }}
          >
            {feedback?.name || 'Feedback Activity'}
          </Typography>
          {feedback?.course && (
            <Typography
              variant="subtitle1"
              color="text.secondary"
            >
              Course ID: {feedback.course}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Status and anonymous badges */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <Chip
          label={STATUS_LABELS[feedbackStatus]}
          color={STATUS_COLORS[feedbackStatus]}
          size="small"
          icon={feedbackStatus === 'open' ? <CheckCircle /> : <Schedule />}
          aria-label={`Feedback status: ${STATUS_LABELS[feedbackStatus]}`}
        />
        {isAnonymous && (
          <Chip
            label="Anonymous Responses"
            color="info"
            variant="outlined"
            size="small"
            icon={<Info />}
            aria-label="This feedback accepts anonymous responses"
          />
        )}
        {feedback?.multiple_submit === 1 && (
          <Chip
            label="Multiple Submissions Allowed"
            color="default"
            variant="outlined"
            size="small"
            aria-label="Multiple submissions are allowed"
          />
        )}
      </Box>
    </Box>
  );

  /**
   * Renders the feedback description section
   */
  const renderDescription = (): JSX.Element | null => {
    if (!feedback?.intro) return null;

    return (
      <Box
        sx={{
          mb: 3,
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Typography
          variant="h6"
          component="h2"
          sx={{ mb: 1 }}
        >
          Description
        </Typography>
        <Box
          dangerouslySetInnerHTML={{ __html: feedback.intro }}
          sx={{
            '& p': { my: 1 },
            '& a': { color: 'primary.main' },
          }}
          aria-label="Feedback description"
        />
      </Box>
    );
  };

  /**
   * Renders the availability information card
   */
  const renderAvailabilityCard = (): JSX.Element => (
    <Card
      sx={{ mb: 3 }}
      aria-labelledby="availability-heading"
    >
      <CardContent>
        <Typography
          variant="h6"
          component="h2"
          id="availability-heading"
          sx={{ mb: 2 }}
        >
          Availability
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Opens:
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {formatTimestamp(feedback?.timeopen)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Closes:
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {formatTimestamp(feedback?.timeclose)}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Chip
            label={STATUS_LABELS[feedbackStatus]}
            color={STATUS_COLORS[feedbackStatus]}
            size="medium"
            sx={{ width: '100%' }}
            aria-label={`Current status: ${STATUS_LABELS[feedbackStatus]}`}
          />
        </Box>
      </CardContent>
    </Card>
  );

  /**
   * Renders the submission status section
   */
  const renderSubmissionStatus = (): JSX.Element => (
    <Card
      sx={{ mb: 3 }}
      aria-labelledby="submission-status-heading"
    >
      <CardContent>
        <Typography
          variant="h6"
          component="h2"
          id="submission-status-heading"
          sx={{ mb: 2 }}
        >
          Your Submission
        </Typography>

        {hasResponded ? (
          <Box>
            <Alert
              severity="success"
              message="You have already completed this feedback."
              variant="standard"
            />
            {completion && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1 }}
              >
                Submitted on: {formatTimestamp(completion.timemodified)}
              </Typography>
            )}
            {permissions.canEditResponses && (
              <Typography
                variant="body2"
                color="info.main"
                sx={{ mt: 1 }}
              >
                You can modify your responses.
              </Typography>
            )}
          </Box>
        ) : (
          <Box>
            {isOpen && permissions.canComplete ? (
              <Alert
                severity="info"
                message="You have not yet completed this feedback. Click the button below to start."
                variant="standard"
              />
            ) : !isOpen ? (
              <Alert
                severity="warning"
                message={
                  feedbackStatus === 'not_yet_open'
                    ? 'This feedback is not yet open for submissions.'
                    : 'This feedback is no longer accepting submissions.'
                }
                variant="standard"
              />
            ) : (
              <Alert
                severity="info"
                message="You do not have permission to complete this feedback."
                variant="standard"
              />
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );

  /**
   * Renders the completion requirements section
   */
  const renderRequirements = (): JSX.Element => (
    <Card
      sx={{ mb: 3 }}
      aria-labelledby="requirements-heading"
    >
      <CardContent>
        <Typography
          variant="h6"
          component="h2"
          id="requirements-heading"
          sx={{ mb: 2 }}
        >
          Completion Requirements
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              Questions:
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {questionCount}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              Estimated time:
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {estimatedTime} minute{estimatedTime !== 1 ? 's' : ''}
            </Typography>
          </Box>
          {feedback?.completionsubmit === 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Required for completion:
              </Typography>
              <Typography variant="body2" fontWeight="medium" color="primary">
                Yes
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  /**
   * Renders action buttons based on permissions and status
   */
  const renderActions = (): JSX.Element => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        mb: 3,
      }}
      role="group"
      aria-label="Feedback actions"
    >
      {/* Complete Feedback Button - for students who haven't completed */}
      {permissions.canComplete && isOpen && !hasResponded && (
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<Assignment />}
          onClick={handleStartFeedback}
          fullWidth
          aria-label="Start completing the feedback"
        >
          Complete Feedback
        </Button>
      )}

      {/* Edit Responses Button - for users who have completed and can edit */}
      {permissions.canEditResponses && isOpen && hasResponded && (
        <Button
          variant="outlined"
          color="primary"
          size="large"
          startIcon={<Edit />}
          onClick={handleEditResponses}
          fullWidth
          aria-label="Edit your feedback responses"
        >
          Edit Responses
        </Button>
      )}

      {/* View Analysis Button - for teachers/admins */}
      {permissions.canViewAnalysis && (
        <Button
          variant="outlined"
          color="secondary"
          size="large"
          startIcon={<Analytics />}
          onClick={handleViewAnalysis}
          fullWidth
          aria-label="View feedback analysis and results"
        >
          View Analysis
        </Button>
      )}

      {/* Manage Feedback - for admins/teachers with edit capability */}
      {permissions.canManage && (
        <Button
          variant="text"
          color="primary"
          size="medium"
          startIcon={<Edit />}
          onClick={() => navigate(`/feedback/${feedbackId}/edit`)}
          fullWidth
          aria-label="Edit feedback settings"
        >
          Edit Feedback
        </Button>
      )}
    </Box>
  );

  /**
   * Renders role-specific content for teachers/admins
   */
  const renderTeacherContent = (): JSX.Element | null => {
    if (!isTeacher && !isAdmin) return null;

    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
            Instructor Overview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            As an instructor, you can view analysis of all responses,
            export data, and manage feedback settings.
          </Typography>
        </CardContent>
      </Card>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  // Handle loading state
  if (isLoading) {
    return renderLoadingSkeleton();
  }

  // Handle error state
  if (error) {
    return renderErrorState();
  }

  // Handle feedback not found
  if (!feedback && !isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="warning"
          title="Feedback Not Found"
          message="The requested feedback activity could not be found or you do not have permission to access it."
        />
      </Box>
    );
  }

  // Render FeedbackForm when in form mode
  if (viewMode === 'form') {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Button
          variant="text"
          onClick={handleReturnToView}
          sx={{ mb: 2 }}
          aria-label="Return to feedback overview"
        >
          ← Back to Overview
        </Button>
        <FeedbackForm
          feedbackId={feedbackId}
          courseId={courseId}
          questions={questions}
          isAnonymous={isAnonymous}
          existingResponses={hasResponded ? completion : undefined}
          onComplete={handleFormComplete}
          onCancel={handleReturnToView}
        />
      </Box>
    );
  }

  // Render FeedbackAnalysis when in analysis mode
  if (viewMode === 'analysis') {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Button
          variant="text"
          onClick={handleReturnToView}
          sx={{ mb: 2 }}
          aria-label="Return to feedback overview"
        >
          ← Back to Overview
        </Button>
        <FeedbackAnalysis
          feedbackId={feedbackId}
          courseId={courseId}
          canViewAnalysis={permissions.canViewAnalysis}
          canViewResponses={permissions.canViewResponses}
        />
      </Box>
    );
  }

  // Render main view mode
  return (
    <Box
      component="main"
      sx={{
        p: { xs: 2, md: 3 },
        maxWidth: 'lg',
        mx: 'auto',
      }}
      role="main"
      aria-label="Feedback activity view"
    >
      {/* Show refetching indicator */}
      {isFetching && !isLoading && (
        <Box sx={{ mb: 2 }}>
          <LoadingSpinner size="small" message="Refreshing..." />
        </Box>
      )}

      {/* Header section */}
      {renderHeader()}

      {/* Main content grid */}
      <Grid container spacing={3}>
        {/* Left column - Description and main content */}
        <Grid item xs={12} md={8}>
          {renderDescription()}
          {renderSubmissionStatus()}
          {renderTeacherContent()}
        </Grid>

        {/* Right column - Availability, requirements, actions */}
        <Grid item xs={12} md={4}>
          {renderAvailabilityCard()}
          {renderRequirements()}
          {renderActions()}
        </Grid>
      </Grid>
    </Box>
  );
}

// Named export (as specified in exports schema)
export default FeedbackView;
