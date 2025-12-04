/**
 * AssessmentsList Component
 *
 * React component that displays a list of peer assessments for workshop submissions.
 * Shows assessment details including reviewer name, assessment grade, weight, and
 * completion status. Supports filtering by assessment status (completed, pending)
 * and sorting by various criteria. Includes actions for viewing and editing
 * assessments based on user role and workshop phase.
 *
 * Features:
 * - Material-UI DataTable integration for sortable, filterable display
 * - Filter by completion status (all, graded, pending, closed)
 * - Sort by reviewer name, grade, weight, or date
 * - View/edit action buttons based on user permissions
 * - Assessment allocation information for teachers
 * - Pending assessments count and completion progress
 * - Responsive design for mobile viewing
 * - Full accessibility support with ARIA attributes
 *
 * Based on Moodle's workshop module assessment rendering from:
 * - public/mod/workshop/assessment.php (assessment permission checks)
 * - public/mod/workshop/renderer.php (assessment display patterns)
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  type SelectChangeEvent,
  LinearProgress,
  Paper,
  Stack,
} from '@mui/material';
import {
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as PendingIcon,
  Block as ClosedIcon,
} from '@mui/icons-material';

// Internal imports from depends_on_files
import type {
  WorkshopAssessment,
  WorkshopPhase,
} from '@/features/activities/workshop/types/workshop.types';
import useWorkshop from '@/features/activities/workshop/hooks/useWorkshop';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/useToast';
import { DataTable, type DataTableColumn, type RowAction } from '@/components/data-display/DataTable';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Alert } from '@/components/feedback/Alert';
import { apiClient } from '@/services/api/client';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Assessment status filter options
 */
export type AssessmentStatusFilter = 'all' | 'graded' | 'pending' | 'closed';

/**
 * Props interface for the AssessmentsList component
 */
export interface AssessmentsListProps {
  /**
   * Workshop ID to fetch assessments for
   */
  workshopId: number;

  /**
   * Optional submission ID to filter assessments for a specific submission
   */
  submissionId?: number;

  /**
   * Optional callback when an assessment is selected
   */
  onAssessmentSelect?: (assessment: WorkshopAssessment) => void;

  /**
   * Whether to show the submission title column
   * @default true
   */
  showSubmissionTitle?: boolean;

  /**
   * Whether to show the allocation info section (teachers only)
   * @default true
   */
  showAllocationInfo?: boolean;

  /**
   * Optional CSS class name for styling
   */
  className?: string;
}

/**
 * Extended assessment interface with computed display properties
 */
interface DisplayAssessment extends WorkshopAssessment {
  /** Formatted reviewer name for display */
  reviewerName: string;
  /** Assessment status for filtering */
  status: 'graded' | 'pending' | 'closed';
  /** Formatted grade string */
  gradeDisplay: string;
  /** Formatted date string */
  dateDisplay: string;
  /** Submission title if available */
  submissionTitle?: string;
}

/**
 * API response envelope for assessments
 */
interface AssessmentsApiResponse {
  success: boolean;
  data: {
    assessments: WorkshopAssessment[];
    totalCount: number;
    gradedCount: number;
    pendingCount: number;
  };
  meta?: {
    timestamp?: number;
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch assessments for a workshop from the API
 *
 * Makes a GET request to /api/v1/workshops/{workshopId}/assessments
 * Returns array of assessments with reviewer and grade information.
 *
 * @param workshopId - The workshop instance ID
 * @param submissionId - Optional submission ID to filter by
 * @returns Promise resolving to assessments data
 */
async function fetchAssessments(
  workshopId: number,
  submissionId?: number
): Promise<AssessmentsApiResponse['data']> {
  const params = submissionId ? { submissionId } : {};
  const response = await apiClient.get<AssessmentsApiResponse>(
    `/workshops/${workshopId}/assessments`,
    { params }
  );

  if (!response.data.success) {
    throw new Error('Failed to fetch assessments data');
  }

  return response.data.data;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Workshop phases where assessments can be edited
 * Based on workshop->assessing_allowed() logic from locallib.php
 */
const EDITABLE_PHASES: WorkshopPhase[] = [30]; // PHASE_ASSESSMENT = 30

/**
 * Date format pattern for assessment timestamps
 */
const DATE_FORMAT = 'MMM dd, yyyy HH:mm';

/**
 * Query key prefix for assessments queries
 */
const ASSESSMENTS_QUERY_KEY = 'workshop-assessments';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine assessment status based on grade and workshop phase
 *
 * @param assessment - Assessment object
 * @param workshopPhase - Current workshop phase
 * @returns Assessment status string
 */
function getAssessmentStatus(
  assessment: WorkshopAssessment,
  workshopPhase: WorkshopPhase
): 'graded' | 'pending' | 'closed' {
  // If workshop is closed, all assessments are closed
  if (workshopPhase >= 50) {
    return 'closed';
  }

  // If assessment has a grade, it's graded
  if (assessment.grade !== null && assessment.grade !== undefined) {
    return 'graded';
  }

  // Otherwise it's pending
  return 'pending';
}

/**
 * Format assessment grade for display
 *
 * @param grade - Grade value (0-100 scale or null)
 * @param maxGrade - Maximum possible grade
 * @returns Formatted grade string
 */
function formatGrade(grade: number | null, maxGrade: number = 100): string {
  if (grade === null || grade === undefined) {
    return '—';
  }
  return `${grade.toFixed(1)} / ${maxGrade}`;
}

/**
 * Get status chip color based on assessment status
 *
 * @param status - Assessment status
 * @returns MUI chip color
 */
function getStatusColor(
  status: 'graded' | 'pending' | 'closed'
): 'success' | 'warning' | 'default' {
  switch (status) {
    case 'graded':
      return 'success';
    case 'pending':
      return 'warning';
    case 'closed':
    default:
      return 'default';
  }
}

/**
 * Get status icon based on assessment status
 *
 * @param status - Assessment status
 * @returns React icon element
 */
function getStatusIcon(status: 'graded' | 'pending' | 'closed') {
  switch (status) {
    case 'graded':
      return <CheckCircleIcon fontSize="small" />;
    case 'pending':
      return <PendingIcon fontSize="small" />;
    case 'closed':
      return <ClosedIcon fontSize="small" />;
  }
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * AssessmentsList Component
 *
 * Displays a list of peer assessments for workshop submissions with filtering,
 * sorting, and action capabilities based on user permissions.
 */
function AssessmentsList({
  workshopId,
  submissionId,
  onAssessmentSelect,
  showSubmissionTitle = true,
  showAllocationInfo = true,
  className,
}: AssessmentsListProps): JSX.Element {
  // Navigation hook for routing to assessment detail/edit pages
  const navigate = useNavigate();

  // Toast notifications for user feedback
  const { error: showError, info: showInfo } = useToast();

  // Permission checking from auth state
  const { hasCapability, isTeacher } = usePermissions();

  // Filter state for assessment status
  const [statusFilter, setStatusFilter] = useState<AssessmentStatusFilter>('all');

  // Fetch workshop data for phase and settings
  const {
    workshop,
    currentPhase,
    isLoading: workshopLoading,
    isError: workshopError,
  } = useWorkshop(workshopId);

  // Fetch assessments data with React Query
  const {
    data: assessmentsData,
    isLoading: assessmentsLoading,
    isError: assessmentsError,
    error: assessmentsErrorObj,
    refetch: refetchAssessments,
  } = useQuery({
    queryKey: [ASSESSMENTS_QUERY_KEY, workshopId, submissionId],
    queryFn: () => fetchAssessments(workshopId, submissionId),
    enabled: workshopId > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Check user capabilities for workshop assessments
  const canPeerAssess = useMemo(
    () => hasCapability('mod/workshop:peerassess'),
    [hasCapability]
  );

  const canOverrideGrades = useMemo(
    () => hasCapability('mod/workshop:overridegrades'),
    [hasCapability]
  );

  const canViewReviewerNames = useMemo(
    () => hasCapability('mod/workshop:viewreviewernames'),
    [hasCapability]
  );

  // Check if assessment editing is allowed based on workshop phase
  const isEditingAllowed = useMemo(() => {
    if (!currentPhase) return false;
    return EDITABLE_PHASES.includes(currentPhase);
  }, [currentPhase]);

  // Transform raw assessments into display assessments with computed properties
  const displayAssessments = useMemo((): DisplayAssessment[] => {
    if (!assessmentsData?.assessments || !currentPhase) {
      return [];
    }

    return assessmentsData.assessments.map((assessment): DisplayAssessment => {
      // Build reviewer name from first/last name
      const reviewerName = canViewReviewerNames
        ? `${assessment.reviewerFirstName || ''} ${assessment.reviewerLastName || ''}`.trim() ||
          `Reviewer ${assessment.reviewerId}`
        : `Reviewer ${assessment.reviewerId}`;

      // Determine assessment status
      const status = getAssessmentStatus(assessment, currentPhase);

      // Format grade for display
      const gradeDisplay = formatGrade(assessment.grade, workshop?.grade);

      // Format date for display
      const dateDisplay = assessment.timeModified
        ? format(new Date(assessment.timeModified * 1000), DATE_FORMAT)
        : assessment.timeCreated
          ? format(new Date(assessment.timeCreated * 1000), DATE_FORMAT)
          : '—';

      return {
        ...assessment,
        reviewerName,
        status,
        gradeDisplay,
        dateDisplay,
      };
    });
  }, [assessmentsData?.assessments, currentPhase, canViewReviewerNames, workshop?.grade]);

  // Apply status filter to assessments
  const filteredAssessments = useMemo(() => {
    if (statusFilter === 'all') {
      return displayAssessments;
    }
    return displayAssessments.filter((a) => a.status === statusFilter);
  }, [displayAssessments, statusFilter]);

  // Calculate completion statistics
  const completionStats = useMemo(() => {
    const total = displayAssessments.length;
    const graded = displayAssessments.filter((a) => a.status === 'graded').length;
    const pending = displayAssessments.filter((a) => a.status === 'pending').length;
    const completionPercentage = total > 0 ? Math.round((graded / total) * 100) : 0;

    return {
      total,
      graded,
      pending,
      completionPercentage,
    };
  }, [displayAssessments]);

  // Handle filter change
  const handleFilterChange = useCallback((event: SelectChangeEvent<AssessmentStatusFilter>) => {
    setStatusFilter(event.target.value as AssessmentStatusFilter);
    showInfo(`Filtering by: ${event.target.value}`);
  }, [showInfo]);

  // Handle view assessment action
  const handleViewAssessment = useCallback(
    (assessment: DisplayAssessment) => {
      if (onAssessmentSelect) {
        onAssessmentSelect(assessment);
      }
      navigate(`/workshops/${workshopId}/assessments/${assessment.id}`);
    },
    [workshopId, navigate, onAssessmentSelect]
  );

  // Handle edit assessment action
  const handleEditAssessment = useCallback(
    (assessment: DisplayAssessment) => {
      if (!isEditingAllowed) {
        showError('Assessment editing is not available in the current workshop phase');
        return;
      }
      navigate(`/workshops/${workshopId}/assessments/${assessment.id}/edit`);
    },
    [workshopId, navigate, isEditingAllowed, showError]
  );

  // Define table columns with memoization
  const columns = useMemo((): DataTableColumn<DisplayAssessment>[] => {
    const cols: DataTableColumn<DisplayAssessment>[] = [
      {
        field: 'reviewerName',
        headerName: 'Reviewer',
        width: 200,
        sortable: true,
        filterable: true,
      },
      {
        field: 'gradeDisplay',
        headerName: 'Grade',
        width: 120,
        sortable: true,
        filterable: false,
        renderCell: (params) => (
          <Typography
            variant="body2"
            sx={{
              fontWeight: params.row.grade !== null ? 600 : 400,
              color: params.row.grade !== null ? 'text.primary' : 'text.secondary',
            }}
          >
            {params.row.gradeDisplay}
          </Typography>
        ),
      },
      {
        field: 'weight',
        headerName: 'Weight',
        width: 80,
        sortable: true,
        filterable: false,
        renderCell: (params) => (
          <Typography variant="body2">{params.row.weight}</Typography>
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 120,
        sortable: true,
        filterable: true,
        renderCell: (params) => (
          <Chip
            icon={getStatusIcon(params.row.status)}
            label={params.row.status.charAt(0).toUpperCase() + params.row.status.slice(1)}
            color={getStatusColor(params.row.status)}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: 'dateDisplay',
        headerName: 'Date',
        width: 160,
        sortable: true,
        filterable: false,
      },
    ];

    // Add submission title column if enabled
    if (showSubmissionTitle) {
      cols.splice(1, 0, {
        field: 'submissionTitle',
        headerName: 'Submission',
        width: 200,
        sortable: true,
        filterable: true,
        renderCell: (params) => (
          <Typography variant="body2" noWrap>
            {params.row.submissionTitle || `Submission ${params.row.submissionId}`}
          </Typography>
        ),
      });
    }

    // Add feedback status column
    cols.push({
      field: 'feedbackAuthor',
      headerName: 'Feedback',
      width: 100,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Chip
          label={params.row.feedbackAuthor ? 'Yes' : 'No'}
          color={params.row.feedbackAuthor ? 'info' : 'default'}
          size="small"
          variant="outlined"
        />
      ),
    });

    return cols;
  }, [showSubmissionTitle]);

  // Define row actions with memoization
  const rowActions = useMemo((): RowAction<DisplayAssessment>[] => {
    const actions: RowAction<DisplayAssessment>[] = [
      {
        label: 'View Assessment',
        icon: <VisibilityIcon fontSize="small" />,
        onClick: handleViewAssessment,
        visible: true,
      },
    ];

    // Add edit action if user can edit assessments
    if (canPeerAssess || canOverrideGrades) {
      actions.push({
        label: 'Edit Assessment',
        icon: <EditIcon fontSize="small" />,
        onClick: handleEditAssessment,
        visible: (row) => {
          // Can edit if user is the reviewer and phase allows editing
          const isReviewer = hasCapability('mod/workshop:peerassess');
          const canEdit =
            (isReviewer && row.status === 'pending' && isEditingAllowed) ||
            canOverrideGrades;
          return canEdit;
        },
        disabled: (_row) => !isEditingAllowed && !canOverrideGrades,
      });
    }

    return actions;
  }, [
    handleViewAssessment,
    handleEditAssessment,
    canPeerAssess,
    canOverrideGrades,
    isEditingAllowed,
    hasCapability,
  ]);

  // Combined loading state
  const isLoading = workshopLoading || assessmentsLoading;

  // Combined error state
  const hasError = workshopError || assessmentsError;
  const errorMessage = assessmentsErrorObj
    ? assessmentsErrorObj.message
    : 'Failed to load assessment data';

  // Loading state
  if (isLoading) {
    return (
      <Box
        className={className}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 200,
        }}
      >
        <LoadingSpinner size="medium" message="Loading assessments..." />
      </Box>
    );
  }

  // Error state
  if (hasError) {
    return (
      <Box className={className} sx={{ p: 2 }}>
        <Alert
          severity="error"
          title="Error Loading Assessments"
          message={errorMessage}
          action={
            <IconButton
              size="small"
              onClick={() => refetchAssessments()}
              aria-label="Retry loading assessments"
            >
              Retry
            </IconButton>
          }
        />
      </Box>
    );
  }

  // Empty state - no assessments exist
  if (!displayAssessments.length) {
    return (
      <Box className={className} sx={{ p: 2 }}>
        <Alert
          severity="info"
          message="No assessments have been allocated yet. Assessments will appear here once the allocation phase is complete."
        />
      </Box>
    );
  }

  return (
    <Box className={className} sx={{ width: '100%' }}>
      {/* Header with allocation info for teachers */}
      {showAllocationInfo && isTeacher && (
        <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
          <Typography variant="h6" gutterBottom>
            Assessment Progress
          </Typography>
          <Stack direction="row" spacing={3} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Total: <strong>{completionStats.total}</strong>
            </Typography>
            <Typography variant="body2" color="success.main">
              Completed: <strong>{completionStats.graded}</strong>
            </Typography>
            <Typography variant="body2" color="warning.main">
              Pending: <strong>{completionStats.pending}</strong>
            </Typography>
          </Stack>
          <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2 }}>
            <LinearProgress
              variant="determinate"
              value={completionStats.completionPercentage}
              sx={{ flexGrow: 1, height: 8, borderRadius: 1 }}
              aria-label={`Assessment completion: ${completionStats.completionPercentage}%`}
            />
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 45 }}>
              {completionStats.completionPercentage}%
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Filter controls */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="h6" component="h2">
          Assessments ({filteredAssessments.length})
        </Typography>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="assessment-filter-label">Filter by Status</InputLabel>
          <Select
            labelId="assessment-filter-label"
            id="assessment-filter-select"
            value={statusFilter}
            label="Filter by Status"
            onChange={handleFilterChange}
          >
            <MenuItem value="all">All Assessments</MenuItem>
            <MenuItem value="graded">Graded</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="closed">Closed</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Empty filtered results */}
      {filteredAssessments.length === 0 && statusFilter !== 'all' && (
        <Alert
          severity="info"
          message={`No ${statusFilter} assessments found. Try changing the filter.`}
        />
      )}

      {/* Assessments data table */}
      {filteredAssessments.length > 0 && (
        <DataTable<DisplayAssessment>
          columns={columns}
          rows={filteredAssessments}
          loading={false}
          rowActions={rowActions}
          mode="client"
          selectable={false}
          sortModel={{ field: 'reviewerName', order: 'asc' }}
          pageSize={10}
          pageSizeOptions={[10, 25, 50]}
          emptyMessage="No assessments match the current filter"
          aria-label="Workshop assessments list"
        />
      )}

      {/* Phase information */}
      {workshop && (
        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={`Phase: ${workshop.phase === 30 ? 'Assessment' : workshop.phase === 50 ? 'Closed' : 'Other'}`}
            color={workshop.phase === 30 ? 'primary' : 'default'}
            size="small"
          />
          {!isEditingAllowed && (
            <Chip
              label="Editing disabled (workshop not in assessment phase)"
              color="warning"
              size="small"
              variant="outlined"
            />
          )}
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Default export for the AssessmentsList component
 *
 * Usage:
 * ```typescript
 * import AssessmentsList from '@/features/activities/workshop/components/AssessmentsList';
 *
 * <AssessmentsList
 *   workshopId={workshopId}
 *   showAllocationInfo={isTeacher}
 * />
 * ```
 */
export default AssessmentsList;
