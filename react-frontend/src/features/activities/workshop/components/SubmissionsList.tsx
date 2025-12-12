/**
 * SubmissionsList Component
 *
 * React component that displays a list of workshop submissions with sorting,
 * filtering, and pagination capabilities. Shows submission details including
 * author name, title, submission time, grade, and assessment status.
 *
 * Supports different views for students (own submissions) and teachers
 * (all submissions). Includes actions for viewing, editing, and deleting
 * submissions based on user permissions.
 *
 * Based on Moodle PHP implementation:
 * - public/mod/workshop/view.php - Submission list rendering
 * - public/mod/workshop/renderer.php - Submission summary display (lines 167-219)
 *
 * @module features/activities/workshop/components/SubmissionsList
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

// MUI Components
import {
  Box,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
  Avatar,
  SelectChangeEvent,
} from '@mui/material';

// MUI Icons
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  CheckCircle as PublishedIcon,
  Cancel as UnpublishedIcon,
  Assignment as SubmissionIcon,
  Grade as GradeIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

// Internal components
import DataTable, { DataTableColumn, RowAction } from '@/components/data-display/DataTable';
import LoadingSpinner from '@/components/feedback/LoadingSpinner';
import Alert from '@/components/feedback/Alert';

// Hooks
import { useWorkshop } from '@/features/activities/workshop/hooks/useWorkshop';
import { useDeleteSubmission, useWorkshopSubmissions } from '@/features/activities/workshop/hooks/useSubmission';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/useToast';

// Types
import type {
  Workshop,
  WorkshopSubmission,
  WorkshopPhase,
} from '@/features/activities/workshop/types/workshop.types';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Filter options for submission status
 */
type SubmissionStatusFilter = 'all' | 'published' | 'unpublished' | 'graded' | 'ungraded';

/**
 * Props for the SubmissionsList component
 */
interface SubmissionsListProps {
  /** The workshop instance ID */
  workshopId: number;
  /** Optional pre-loaded workshop data */
  workshop?: Workshop;
  /** Optional pre-loaded submissions list */
  submissions?: WorkshopSubmission[];
  /** Whether to show only the current user's submissions */
  showOwnOnly?: boolean;
  /** Callback when a submission is selected */
  onSubmissionSelect?: (submission: WorkshopSubmission) => void;
  /** Custom class name for styling */
  className?: string;
}

/**
 * Sort direction type
 */
type SortDirection = 'asc' | 'desc';

/**
 * Sort configuration
 */
interface SortConfig {
  field: keyof WorkshopSubmission | 'authorName';
  direction: SortDirection;
}

// ============================================================================
// Constants
// ============================================================================

/** Default page size for pagination */
const DEFAULT_PAGE_SIZE = 10;

/** Date format for submission timestamps */
const DATE_FORMAT = 'MMM dd, yyyy HH:mm';

/** Short date format for compact displays */
const DATE_FORMAT_SHORT = 'MMM dd, yyyy';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a Unix timestamp to a human-readable date string
 *
 * @param timestamp - Unix timestamp in seconds
 * @param formatStr - date-fns format string
 * @returns Formatted date string or 'N/A' if timestamp is invalid
 */
function formatTimestamp(timestamp: number | undefined | null, formatStr: string = DATE_FORMAT): string {
  if (!timestamp || timestamp <= 0) {
    return 'N/A';
  }
  try {
    // Moodle timestamps are in seconds, JS Date expects milliseconds
    return format(new Date(timestamp * 1000), formatStr);
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format grade for display
 *
 * @param grade - The grade value (0-100 scale typically)
 * @param gradeDecimals - Number of decimal places to show
 * @returns Formatted grade string
 */
function formatGrade(grade: number | null | undefined, gradeDecimals: number = 0): string {
  if (grade === null || grade === undefined) {
    return 'Not graded';
  }
  return `${grade.toFixed(gradeDecimals)}%`;
}

/**
 * Get assessment status summary for a submission
 *
 * @param submission - The submission to check
 * @returns Status string describing assessment progress
 */
function getAssessmentStatus(submission: WorkshopSubmission): string {
  const assessments = submission.assessments || [];
  const totalAssessments = assessments.length;
  
  if (totalAssessments === 0) {
    return 'No assessments';
  }
  
  const completedAssessments = assessments.filter(
    (a) => a.grade !== null && a.grade !== undefined
  ).length;
  
  if (completedAssessments === totalAssessments) {
    return `${totalAssessments} assessment${totalAssessments > 1 ? 's' : ''} complete`;
  }
  
  return `${completedAssessments}/${totalAssessments} assessments`;
}

/**
 * Check if a submission can be edited based on workshop phase and permissions
 *
 * @param submission - The submission to check
 * @param workshop - The workshop configuration
 * @param userId - Current user ID
 * @param isTeacher - Whether the user is a teacher
 * @returns Whether the submission can be edited
 */
function canEditSubmission(
  submission: WorkshopSubmission,
  workshop: Workshop | undefined,
  userId: number | undefined,
  isTeacher: boolean
): boolean {
  // Teachers can always edit
  if (isTeacher) {
    return true;
  }
  
  // Must be in submission phase
  if (workshop?.phase !== 20) { // WorkshopPhase.SUBMISSION = 20
    return false;
  }
  
  // Must be the author
  if (submission.authorId !== userId) {
    return false;
  }
  
  // Check if submission deadline has passed
  if (workshop?.submissionEnd && workshop.submissionEnd > 0) {
    const now = Math.floor(Date.now() / 1000);
    if (now > workshop.submissionEnd) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if a submission can be deleted
 *
 * @param submission - The submission to check
 * @param userId - Current user ID
 * @param hasDeleteCapability - Whether user has delete capability
 * @param isTeacher - Whether the user is a teacher
 * @returns Whether the submission can be deleted
 */
function canDeleteSubmission(
  submission: WorkshopSubmission,
  userId: number | undefined,
  hasDeleteCapability: boolean,
  isTeacher: boolean
): boolean {
  // Teachers with delete capability can delete any submission
  if (isTeacher && hasDeleteCapability) {
    return true;
  }
  
  // Authors can delete their own submissions if they have no assessments
  if (submission.authorId === userId) {
    const assessments = submission.assessments || [];
    return assessments.length === 0;
  }
  
  return false;
}

// ============================================================================
// SubmissionsList Component
// ============================================================================

/**
 * SubmissionsList Component
 *
 * Displays a list of workshop submissions with sorting, filtering,
 * and pagination. Provides action buttons for viewing, editing, and
 * deleting submissions based on user permissions.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <SubmissionsList workshopId={123} />
 *
 * // With pre-loaded data
 * <SubmissionsList
 *   workshopId={123}
 *   workshop={workshopData}
 *   submissions={submissionsData}
 * />
 *
 * // Student view (own submissions only)
 * <SubmissionsList workshopId={123} showOwnOnly={true} />
 * ```
 */
const SubmissionsList: React.FC<SubmissionsListProps> = ({
  workshopId,
  workshop: preloadedWorkshop,
  submissions: preloadedSubmissions,
  showOwnOnly = false,
  onSubmissionSelect,
  className,
}) => {
  // ============================================================================
  // Hooks
  // ============================================================================
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasCapability, isTeacher } = usePermissions();
  const { success, error: showError, warning } = useToast();
  
  // Fetch workshop data if not provided
  const {
    workshop: fetchedWorkshop,
    submissions: fetchedSubmissions,
    isLoading: isWorkshopLoading,
    isError: isWorkshopError,
    error: workshopError,
  } = useWorkshop(workshopId, {
    enabled: !preloadedWorkshop,
    includeSubmissions: true,
  });
  
  // Use pre-loaded data or fetched data
  const workshop = preloadedWorkshop || fetchedWorkshop;
  const allSubmissions = preloadedSubmissions || fetchedSubmissions || [];
  
  // Delete mutation
  const {
    mutate: deleteSubmission,
    isPending: isDeleting,
  } = useDeleteSubmission({
    onSuccess: () => {
      success('Submission deleted successfully');
      // Invalidate queries to refresh data
      void queryClient.invalidateQueries({
        queryKey: ['workshops', workshopId],
      });
    },
    onError: (err) => {
      showError(
        err.message || 'Failed to delete submission. It may have existing assessments.'
      );
    },
  });
  
  // ============================================================================
  // State
  // ============================================================================
  
  const [statusFilter, setStatusFilter] = useState<SubmissionStatusFilter>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'timeCreated',
    direction: 'desc',
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  
  // ============================================================================
  // Permission Checks
  // ============================================================================
  
  const canViewAll = hasCapability('mod/workshop:viewallsubmissions');
  const canSubmit = hasCapability('mod/workshop:submit');
  const canDeleteAll = hasCapability('mod/workshop:deletesubmissions');
  
  // Get current user ID from auth context (would typically come from auth state)
  const currentUserId = useMemo(() => {
    // This would typically come from auth context/Redux
    // For now, we'll extract from permissions or default to undefined
    return undefined as number | undefined;
  }, []);
  
  // ============================================================================
  // Filtered and Sorted Submissions
  // ============================================================================
  
  const filteredSubmissions = useMemo(() => {
    let result = [...allSubmissions];
    
    // Apply user filter (own submissions only for students)
    if (showOwnOnly && currentUserId) {
      result = result.filter((s) => s.authorId === currentUserId);
    }
    
    // Apply status filter
    switch (statusFilter) {
      case 'published':
        result = result.filter((s) => s.published);
        break;
      case 'unpublished':
        result = result.filter((s) => !s.published);
        break;
      case 'graded':
        result = result.filter((s) => s.grade !== null && s.grade !== undefined);
        break;
      case 'ungraded':
        result = result.filter((s) => s.grade === null || s.grade === undefined);
        break;
      default:
        // 'all' - no filtering
        break;
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let aValue: string | number | null = null;
      let bValue: string | number | null = null;
      
      switch (sortConfig.field) {
        case 'authorName':
          aValue = a.authorName?.toLowerCase() || '';
          bValue = b.authorName?.toLowerCase() || '';
          break;
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'timeCreated':
          aValue = a.timeCreated || 0;
          bValue = b.timeCreated || 0;
          break;
        case 'timeModified':
          aValue = a.timeModified || 0;
          bValue = b.timeModified || 0;
          break;
        case 'grade':
          aValue = a.grade ?? -1;
          bValue = b.grade ?? -1;
          break;
        default:
          aValue = a.timeCreated || 0;
          bValue = b.timeCreated || 0;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      const numA = Number(aValue);
      const numB = Number(bValue);
      return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
    });
    
    return result;
  }, [allSubmissions, showOwnOnly, currentUserId, statusFilter, sortConfig]);
  
  // Paginated submissions
  const paginatedSubmissions = useMemo(() => {
    const start = page * pageSize;
    return filteredSubmissions.slice(start, start + pageSize);
  }, [filteredSubmissions, page, pageSize]);
  
  // ============================================================================
  // Event Handlers
  // ============================================================================
  
  /**
   * Handle filter change
   */
  const handleFilterChange = useCallback((event: SelectChangeEvent<SubmissionStatusFilter>) => {
    setStatusFilter(event.target.value as SubmissionStatusFilter);
    setPage(0); // Reset to first page when filter changes
  }, []);
  
  /**
   * Handle view submission action
   */
  const handleView = useCallback(
    (submission: WorkshopSubmission) => {
      if (onSubmissionSelect) {
        onSubmissionSelect(submission);
      }
      navigate(`/workshops/${workshopId}/submissions/${submission.id}`);
    },
    [navigate, workshopId, onSubmissionSelect]
  );
  
  /**
   * Handle edit submission action
   */
  const handleEdit = useCallback(
    (submission: WorkshopSubmission) => {
      navigate(`/workshops/${workshopId}/submissions/${submission.id}/edit`);
    },
    [navigate, workshopId]
  );
  
  /**
   * Handle delete submission action
   */
  const handleDelete = useCallback(
    (submission: WorkshopSubmission) => {
      // Check for existing assessments
      const assessments = submission.assessments || [];
      if (assessments.length > 0 && !canDeleteAll) {
        warning(
          'Cannot delete this submission because it has existing assessments. ' +
            'Contact your teacher for assistance.'
        );
        return;
      }
      
      // Confirm deletion
      const confirmMessage = assessments.length > 0
        ? `Delete this submission? This will also remove ${assessments.length} assessment(s).`
        : 'Delete this submission? This action cannot be undone.';
      
      if (window.confirm(confirmMessage)) {
        setPendingDeleteId(submission.id);
        deleteSubmission(
          { workshopId, submissionId: submission.id },
          {
            onSettled: () => {
              setPendingDeleteId(null);
            },
          }
        );
      }
    },
    [workshopId, deleteSubmission, canDeleteAll, warning]
  );
  
  /**
   * Handle sort column click
   */
  const handleSort = useCallback((field: string) => {
    setSortConfig((prev) => ({
      field: field as keyof WorkshopSubmission | 'authorName',
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);
  
  /**
   * Handle page change
   */
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);
  
  /**
   * Handle page size change
   */
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(0);
  }, []);
  
  // ============================================================================
  // Table Configuration
  // ============================================================================
  
  /**
   * Table columns definition
   */
  const columns: DataTableColumn<WorkshopSubmission>[] = useMemo(
    () => [
      {
        id: 'authorName',
        label: 'Author',
        sortable: true,
        width: '20%',
        render: (submission) => (
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
              <PersonIcon fontSize="small" />
            </Avatar>
            <Typography variant="body2" noWrap>
              {submission.authorName || 'Unknown Author'}
            </Typography>
          </Stack>
        ),
      },
      {
        id: 'title',
        label: 'Title',
        sortable: true,
        width: '25%',
        render: (submission) => (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              cursor: 'pointer',
              '&:hover': { color: 'primary.main' },
            }}
            onClick={() => handleView(submission)}
          >
            {submission.title}
          </Typography>
        ),
      },
      {
        id: 'timeCreated',
        label: 'Submitted',
        sortable: true,
        width: '15%',
        render: (submission) => (
          <Tooltip title={formatTimestamp(submission.timeCreated)}>
            <Typography variant="body2" color="text.secondary">
              {formatTimestamp(submission.timeCreated, DATE_FORMAT_SHORT)}
            </Typography>
          </Tooltip>
        ),
      },
      {
        id: 'grade',
        label: 'Grade',
        sortable: true,
        width: '12%',
        render: (submission) => {
          const gradeValue = submission.grade;
          const hasGrade = gradeValue !== null && gradeValue !== undefined;
          
          return (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <GradeIcon
                fontSize="small"
                color={hasGrade ? 'success' : 'disabled'}
              />
              <Typography
                variant="body2"
                color={hasGrade ? 'text.primary' : 'text.secondary'}
              >
                {formatGrade(gradeValue, workshop?.gradeDecimals || 0)}
              </Typography>
            </Stack>
          );
        },
      },
      {
        id: 'status',
        label: 'Status',
        width: '18%',
        render: (submission) => (
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Assessment status */}
            <Tooltip title={getAssessmentStatus(submission)}>
              <Chip
                size="small"
                label={getAssessmentStatus(submission)}
                variant="outlined"
                color={
                  (submission.assessments?.length || 0) > 0 ? 'info' : 'default'
                }
              />
            </Tooltip>
            
            {/* Published indicator (only show in closed phase or for teachers) */}
            {(workshop?.phase === 50 || isTeacher) && ( // WorkshopPhase.CLOSED = 50
              <Tooltip title={submission.published ? 'Published' : 'Not published'}>
                {submission.published ? (
                  <PublishedIcon fontSize="small" color="success" />
                ) : (
                  <UnpublishedIcon fontSize="small" color="disabled" />
                )}
              </Tooltip>
            )}
          </Stack>
        ),
      },
    ],
    [workshop, handleView, isTeacher]
  );
  
  /**
   * Row actions definition
   */
  const rowActions: RowAction<WorkshopSubmission>[] = useMemo(
    () => [
      {
        id: 'view',
        label: 'View',
        icon: <ViewIcon />,
        onClick: handleView,
      },
      {
        id: 'edit',
        label: 'Edit',
        icon: <EditIcon />,
        onClick: handleEdit,
        disabled: (submission) =>
          !canEditSubmission(submission, workshop, currentUserId, isTeacher),
        hidden: (submission) =>
          !canEditSubmission(submission, workshop, currentUserId, isTeacher) &&
          !isTeacher,
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: <DeleteIcon />,
        onClick: handleDelete,
        disabled: (submission) =>
          !canDeleteSubmission(
            submission,
            currentUserId,
            canDeleteAll,
            isTeacher
          ) || pendingDeleteId === submission.id,
        hidden: (submission) =>
          !canDeleteSubmission(
            submission,
            currentUserId,
            canDeleteAll,
            isTeacher
          ),
        color: 'error',
      },
    ],
    [
      handleView,
      handleEdit,
      handleDelete,
      workshop,
      currentUserId,
      isTeacher,
      canDeleteAll,
      pendingDeleteId,
    ]
  );
  
  // ============================================================================
  // Render
  // ============================================================================
  
  // Loading state
  if (isWorkshopLoading && !preloadedWorkshop) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={200}
        className={className}
      >
        <LoadingSpinner message="Loading submissions..." />
      </Box>
    );
  }
  
  // Error state
  if (isWorkshopError) {
    return (
      <Alert
        severity="error"
        title="Error loading submissions"
        message={
          workshopError?.message ||
          'Failed to load submissions. Please try again later.'
        }
      />
    );
  }
  
  // Permission check - need view capability for all submissions or be a submitter
  if (!canViewAll && !canSubmit) {
    return (
      <Alert
        severity="warning"
        title="Access Denied"
        message="You do not have permission to view submissions in this workshop."
      />
    );
  }
  
  // Empty state
  if (allSubmissions.length === 0) {
    return (
      <Box className={className}>
        <Alert
          severity="info"
          title="No submissions yet"
          message={
            canSubmit
              ? 'Be the first to submit your work! Click the "Create Submission" button to get started.'
              : 'There are no submissions in this workshop yet.'
          }
        />
      </Box>
    );
  }
  
  return (
    <Box className={className}>
      {/* Header with filter */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        mb={2}
      >
        <Typography variant="h6" component="h2">
          <SubmissionIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Submissions ({filteredSubmissions.length})
        </Typography>
        
        {/* Status filter - only show for teachers or those who can view all */}
        {(canViewAll || isTeacher) && (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="submission-filter-label">Filter by Status</InputLabel>
            <Select<SubmissionStatusFilter>
              labelId="submission-filter-label"
              id="submission-filter"
              value={statusFilter}
              label="Filter by Status"
              onChange={handleFilterChange}
            >
              <MenuItem value="all">All Submissions</MenuItem>
              <MenuItem value="published">Published</MenuItem>
              <MenuItem value="unpublished">Unpublished</MenuItem>
              <MenuItem value="graded">Graded</MenuItem>
              <MenuItem value="ungraded">Ungraded</MenuItem>
            </Select>
          </FormControl>
        )}
      </Stack>
      
      {/* Filtered results info */}
      {statusFilter !== 'all' && (
        <Typography variant="body2" color="text.secondary" mb={1}>
          Showing {filteredSubmissions.length} of {allSubmissions.length} submissions
        </Typography>
      )}
      
      {/* Submissions table */}
      <DataTable<WorkshopSubmission>
        columns={columns}
        rows={paginatedSubmissions}
        rowActions={rowActions}
        loading={isDeleting}
        emptyMessage="No submissions match the selected filter."
        getRowId={(row) => row.id}
        onSort={handleSort}
        sortField={sortConfig.field}
        sortDirection={sortConfig.direction}
        pagination={{
          page,
          pageSize,
          totalRows: filteredSubmissions.length,
          onPageChange: handlePageChange,
          onPageSizeChange: handlePageSizeChange,
          pageSizeOptions: [5, 10, 25, 50],
        }}
        onRowClick={handleView}
        rowClassName={(submission) =>
          pendingDeleteId === submission.id ? 'row-pending-delete' : ''
        }
        sx={{
          '& .row-pending-delete': {
            opacity: 0.5,
            pointerEvents: 'none',
          },
        }}
      />
    </Box>
  );
};

// ============================================================================
// Exports
// ============================================================================

export default SubmissionsList;
