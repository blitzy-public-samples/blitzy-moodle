/**
 * GradingPage Component
 * 
 * Teacher grading interface that displays a list of student submissions and provides
 * access to individual grading views. Implements Material-UI DataGrid for optimal
 * performance with large classes.
 * 
 * Features:
 * - Submission list with status indicators, dates, and grades
 * - Filtering by submission status (all, submitted, draft, graded, not graded)
 * - Search by student name/email
 * - Sorting by various columns
 * - Pagination for large classes
 * - Quick grading support
 * - Batch operations (if marking workflow enabled)
 * 
 * @module features/activities/assignments/pages/GradingPage
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Grid,
  InputAdornment,
  Toolbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  SelectChangeEvent,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridRowSelectionModel,
  GridSortModel,
  GridPaginationModel,
  GridActionsCellItem,
  GridRowParams,
} from '@mui/x-data-grid';
import {
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  FilterList as FilterListIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  Assessment as AssessmentIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Group as GroupIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { format, isPast, parseISO } from 'date-fns';

// Internal imports from dependencies
import { useAssignment } from '../hooks/useAssignment';
import { useSubmissions, useGradeSubmission } from '../hooks/useSubmission';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { Submission } from '../types/assignment.types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Filter state for submissions table
 */
interface SubmissionFilters {
  /** Filter by submission status */
  status: 'all' | 'submitted' | 'draft' | 'graded' | 'notgraded';
  /** Search query for student name/email */
  search: string;
  /** Start date for date range filter */
  dateFrom: string;
  /** End date for date range filter */
  dateTo: string;
}

/**
 * Grading statistics summary
 */
interface GradingStatistics {
  total: number;
  submitted: number;
  graded: number;
  draft: number;
  notSubmitted: number;
  overdue: number;
  averageGrade: number | null;
}

/**
 * Row data for DataGrid
 */
interface SubmissionRow {
  id: number;
  userId: number;
  fullname: string;
  email: string;
  status: string;
  submissionDate: string | null;
  grade: number | null;
  gradingStatus: string;
  workflowState: string | null;
  hasFiles: boolean;
  attemptnumber: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default pagination settings */
const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** Default filter state */
const DEFAULT_FILTERS: SubmissionFilters = {
  status: 'all',
  search: '',
  dateFrom: '',
  dateTo: '',
};

/** Status filter options */
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Submissions' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'draft', label: 'Draft' },
  { value: 'graded', label: 'Graded' },
  { value: 'notgraded', label: 'Not Graded' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color for submission status chip
 */
function getStatusColor(status: string): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'submitted':
      return 'primary';
    case 'draft':
      return 'default';
    case 'new':
      return 'warning';
    default:
      return 'default';
  }
}

/**
 * Get color for grading status chip
 */
function getGradingStatusColor(status: string): 'default' | 'primary' | 'success' | 'warning' {
  switch (status) {
    case 'graded':
      return 'success';
    case 'notgraded':
      return 'warning';
    case 'inmarking':
      return 'primary';
    default:
      return 'default';
  }
}

/**
 * Get human-readable label for submission status
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'submitted':
      return 'Submitted';
    case 'draft':
      return 'Draft';
    case 'new':
      return 'No submission';
    case 'reopened':
      return 'Reopened';
    default:
      return status;
  }
}

/**
 * Get human-readable label for grading status
 */
function getGradingStatusLabel(status: string): string {
  switch (status) {
    case 'graded':
      return 'Graded';
    case 'notgraded':
      return 'Not Graded';
    case 'inmarking':
      return 'In Marking';
    default:
      return status;
  }
}

/**
 * Format date for display
 */
function formatDate(dateString: string | null | number): string {
  if (!dateString) return '-';
  try {
    const date = typeof dateString === 'number' 
      ? new Date(dateString * 1000) 
      : parseISO(dateString);
    return format(date, 'MMM dd, yyyy HH:mm');
  } catch {
    return '-';
  }
}

/**
 * Check if user has a specific capability
 */
function hasCapability(capabilities: Array<{ capability: string; granted: boolean }>, capabilityName: string): boolean {
  return capabilities.some(cap => cap.capability === capabilityName && cap.granted);
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * GradingPage Component
 * 
 * Main teacher grading interface displaying all student submissions for an assignment.
 * Provides filtering, sorting, pagination, and navigation to individual grading views.
 */
const GradingPage: React.FC = () => {
  // -------------------------------------------------------------------------
  // Router Hooks
  // -------------------------------------------------------------------------
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // -------------------------------------------------------------------------
  // Authentication and Permission Checking
  // -------------------------------------------------------------------------
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  /**
   * Check if user has grading capability
   * Returns true if user has 'mod/assign:grade' capability
   */
  const hasGradingPermission = useMemo(() => {
    if (!user || !user.capabilities) return false;
    return hasCapability(user.capabilities, 'mod/assign:grade');
  }, [user]);

  // -------------------------------------------------------------------------
  // State Management
  // -------------------------------------------------------------------------
  
  /** Filter state */
  const [filters, setFilters] = useState<SubmissionFilters>(() => ({
    status: (searchParams.get('status') as SubmissionFilters['status']) || 'all',
    search: searchParams.get('search') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
  }));

  /** Pagination state */
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: parseInt(searchParams.get('page') || '0', 10),
    pageSize: parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10),
  });

  /** Sort state */
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: searchParams.get('sortField') || 'fullname', sort: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc' },
  ]);

  /** Row selection for batch operations */
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>([]);

  /** Batch operation dialog state */
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchAction, setBatchAction] = useState<string>('');

  /** Quick grade dialog state */
  const [quickGradeDialog, setQuickGradeDialog] = useState<{
    open: boolean;
    submissionId: number | null;
    userId: number | null;
    currentGrade: number | null;
  }>({
    open: false,
    submissionId: null,
    userId: null,
    currentGrade: null,
  });

  /** Temporary quick grade value */
  const [quickGradeValue, setQuickGradeValue] = useState<string>('');

  // -------------------------------------------------------------------------
  // Data Fetching Hooks
  // -------------------------------------------------------------------------

  const assignmentIdNum = assignmentId ? parseInt(assignmentId, 10) : 0;

  /** Fetch assignment details */
  const {
    data: assignment,
    isLoading: assignmentLoading,
    error: assignmentError,
  } = useAssignment(assignmentIdNum);

  /** Build filter params for API */
  const submissionFilterParams = useMemo(() => ({
    status: filters.status !== 'all' ? filters.status : undefined,
    search: filters.search || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    page: paginationModel.page,
    pageSize: paginationModel.pageSize,
    sortField: sortModel[0]?.field || 'fullname',
    sortOrder: sortModel[0]?.sort || 'asc',
  }), [filters, paginationModel, sortModel]);

  /** Fetch submissions list */
  const {
    data: submissionsData,
    isLoading: submissionsLoading,
    error: submissionsError,
    refetch: refetchSubmissions,
  } = useSubmissions(assignmentIdNum, submissionFilterParams);

  /** Grade submission mutation */
  const { mutate: gradeSubmission, isPending: isGrading } = useGradeSubmission();

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------

  /** Convert submissions to DataGrid rows */
  const rows: SubmissionRow[] = useMemo(() => {
    if (!submissionsData?.submissions) return [];
    
    return submissionsData.submissions.map((submission: Submission) => {
      // Parse grade value - grade can be string or number directly
      let gradeValue: number | null = null;
      if (submission.grade !== undefined && submission.grade !== null) {
        const parsed = typeof submission.grade === 'number' 
          ? submission.grade 
          : parseFloat(submission.grade);
        gradeValue = isNaN(parsed) ? null : parsed;
      }
      
      // Check if submission has file attachments
      const hasFiles = submission.plugins?.some(
        p => p.type === 'file' && (p.fileareas?.length ?? 0) > 0
      ) ?? false;
      
      return {
        id: submission.id,
        userId: submission.userid,
        fullname: submission.studentname || `User ${submission.userid}`,
        email: '', // Email not available in Submission type, would need separate user fetch
        status: submission.status,
        submissionDate: submission.timemodified ? String(submission.timemodified) : null,
        grade: gradeValue,
        gradingStatus: submission.gradingstatus || 'notgraded',
        workflowState: null, // Workflow state comes from UserFlag, not Submission
        hasFiles,
        attemptnumber: submission.attemptnumber || 0,
      };
    });
  }, [submissionsData]);

  /** Calculate grading statistics */
  const statistics: GradingStatistics = useMemo(() => {
    const submissions = submissionsData?.submissions || [];
    const total = submissionsData?.total || submissions.length;
    
    let submitted = 0;
    let graded = 0;
    let draft = 0;
    let notSubmitted = 0;
    let overdue = 0;
    let gradeSum = 0;
    let gradeCount = 0;

    const dueDate = assignment?.duedate ? new Date(assignment.duedate * 1000) : null;

    submissions.forEach((submission: Submission) => {
      if (submission.status === 'submitted') {
        submitted++;
      } else if (submission.status === 'draft') {
        draft++;
      } else if (submission.status === 'new') {
        notSubmitted++;
      }

      if (submission.gradingstatus === 'graded') {
        graded++;
      }

      // Parse grade value - grade can be string or number directly
      if (submission.grade !== undefined && submission.grade !== null) {
        const gradeValue = typeof submission.grade === 'number' 
          ? submission.grade 
          : parseFloat(submission.grade);
        if (!isNaN(gradeValue)) {
          gradeSum += gradeValue;
          gradeCount++;
        }
      }

      // Check for overdue
      if (dueDate && isPast(dueDate) && submission.status !== 'submitted') {
        overdue++;
      }
    });

    return {
      total,
      submitted,
      graded,
      draft,
      notSubmitted,
      overdue,
      averageGrade: gradeCount > 0 ? gradeSum / gradeCount : null,
    };
  }, [submissionsData, assignment]);

  // -------------------------------------------------------------------------
  // Event Handlers
  // -------------------------------------------------------------------------

  /**
   * Handle status filter change
   */
  const handleStatusFilterChange = useCallback((event: SelectChangeEvent<string>) => {
    const newStatus = event.target.value as SubmissionFilters['status'];
    setFilters(prev => ({ ...prev, status: newStatus }));
    setPaginationModel(prev => ({ ...prev, page: 0 }));
  }, []);

  /**
   * Handle search input change (debounced)
   */
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, search: event.target.value }));
  }, []);

  /**
   * Handle date filter change
   */
  const handleDateChange = useCallback((field: 'dateFrom' | 'dateTo', value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPaginationModel(prev => ({ ...prev, page: 0 }));
  }, []);

  /**
   * Clear all filters
   */
  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPaginationModel(prev => ({ ...prev, page: 0 }));
  }, []);

  /**
   * Handle row click - navigate to grading view
   */
  const handleRowClick = useCallback((params: GridRowParams) => {
    navigate(`/assignments/${assignmentId}/grading/${params.row.userId}`);
  }, [navigate, assignmentId]);

  /**
   * Handle view submission action
   */
  const handleViewSubmission = useCallback((userId: number) => {
    navigate(`/assignments/${assignmentId}/submissions/${userId}`);
  }, [navigate, assignmentId]);

  /**
   * Handle grade submission action - navigate to grading view
   */
  const handleGradeClick = useCallback((userId: number) => {
    navigate(`/assignments/${assignmentId}/grading/${userId}`);
  }, [navigate, assignmentId]);

  /**
   * Handle download files action
   */
  const handleDownloadFiles = useCallback((submissionId: number) => {
    // Construct download URL for submission files
    window.open(`/api/v1/assignments/${assignmentId}/submissions/${submissionId}/download`, '_blank');
  }, [assignmentId]);

  /**
   * Handle download all submissions
   */
  const handleDownloadAll = useCallback(() => {
    window.open(`/api/v1/assignments/${assignmentId}/submissions/download-all`, '_blank');
  }, [assignmentId]);

  /**
   * Handle download selected submissions
   */
  const handleDownloadSelected = useCallback(() => {
    if (selectedRows.length === 0) return;
    const ids = selectedRows.join(',');
    window.open(`/api/v1/assignments/${assignmentId}/submissions/download?ids=${ids}`, '_blank');
  }, [assignmentId, selectedRows]);

  /**
   * Open quick grade dialog for inline grading without opening full interface
   */
  const handleOpenQuickGrade = useCallback((submissionId: number, userId: number, currentGrade: number | null) => {
    setQuickGradeDialog({
      open: true,
      submissionId,
      userId,
      currentGrade,
    });
    setQuickGradeValue(currentGrade !== null ? String(currentGrade) : '');
  }, []);

  /**
   * Close quick grade dialog
   */
  const handleCloseQuickGrade = useCallback(() => {
    setQuickGradeDialog({
      open: false,
      submissionId: null,
      userId: null,
      currentGrade: null,
    });
    setQuickGradeValue('');
  }, []);

  /**
   * Submit quick grade
   */
  const handleSubmitQuickGrade = useCallback(() => {
    if (quickGradeDialog.userId === null || !assignmentIdNum) return;
    
    const gradeValue = parseFloat(quickGradeValue);
    if (isNaN(gradeValue)) return;

    gradeSubmission(
      {
        assignmentId: assignmentIdNum,
        userId: quickGradeDialog.userId,
        grade: gradeValue,
      },
      {
        onSuccess: () => {
          handleCloseQuickGrade();
          refetchSubmissions();
        },
      }
    );
  }, [assignmentIdNum, quickGradeDialog.userId, quickGradeValue, gradeSubmission, handleCloseQuickGrade, refetchSubmissions]);

  /**
   * Handle pagination change
   */
  const handlePaginationChange = useCallback((model: GridPaginationModel) => {
    setPaginationModel(model);
  }, []);

  /**
   * Handle sort change
   */
  const handleSortChange = useCallback((model: GridSortModel) => {
    setSortModel(model);
  }, []);

  /**
   * Handle row selection change
   */
  const handleSelectionChange = useCallback((model: GridRowSelectionModel) => {
    setSelectedRows(model);
  }, []);

  /**
   * Open batch action dialog
   */
  const handleBatchAction = useCallback((action: string) => {
    setBatchAction(action);
    setBatchDialogOpen(true);
  }, []);

  /**
   * Close batch action dialog
   */
  const handleCloseBatchDialog = useCallback(() => {
    setBatchDialogOpen(false);
    setBatchAction('');
  }, []);

  // -------------------------------------------------------------------------
  // URL Sync Effect
  // -------------------------------------------------------------------------

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (paginationModel.page > 0) params.set('page', String(paginationModel.page));
    if (paginationModel.pageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(paginationModel.pageSize));
    if (sortModel[0]?.field) params.set('sortField', sortModel[0].field);
    if (sortModel[0]?.sort) params.set('sortOrder', sortModel[0].sort);
    
    setSearchParams(params, { replace: true });
  }, [filters, paginationModel, sortModel, setSearchParams]);

  // -------------------------------------------------------------------------
  // Column Definitions
  // -------------------------------------------------------------------------

  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'fullname',
      headerName: 'Student Name',
      flex: 1,
      minWidth: 180,
      renderCell: (params: GridRenderCellParams<SubmissionRow>) => (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {params.row.fullname}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.email}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Submission Status',
      width: 150,
      renderCell: (params: GridRenderCellParams<SubmissionRow>) => (
        <Chip
          size="small"
          label={getStatusLabel(params.row.status)}
          color={getStatusColor(params.row.status)}
          variant="outlined"
        />
      ),
    },
    {
      field: 'submissionDate',
      headerName: 'Submission Date',
      width: 170,
      renderCell: (params: GridRenderCellParams<SubmissionRow>) => (
        <Typography variant="body2">
          {formatDate(params.row.submissionDate)}
        </Typography>
      ),
    },
    {
      field: 'grade',
      headerName: 'Grade',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams<SubmissionRow>) => {
        const grade = params.row.grade;
        const maxGrade = assignment?.grade || 100;
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" fontWeight="medium">
              {grade !== null ? `${grade}` : '-'}
            </Typography>
            {grade !== null && (
              <Typography variant="caption" color="text.secondary">
                / {maxGrade}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: 'gradingStatus',
      headerName: 'Grading Status',
      width: 140,
      renderCell: (params: GridRenderCellParams<SubmissionRow>) => (
        <Chip
          size="small"
          label={getGradingStatusLabel(params.row.gradingStatus)}
          color={getGradingStatusColor(params.row.gradingStatus)}
          variant="filled"
        />
      ),
    },
    ...(assignment?.markingworkflow ? [{
      field: 'workflowState',
      headerName: 'Workflow State',
      width: 140,
      renderCell: (params: GridRenderCellParams<SubmissionRow>) => (
        params.row.workflowState ? (
          <Chip
            size="small"
            label={params.row.workflowState}
            variant="outlined"
          />
        ) : (
          <Typography variant="body2" color="text.secondary">-</Typography>
        )
      ),
    }] : []),
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 180,
      getActions: (params: GridRowParams<SubmissionRow>) => [
        <GridActionsCellItem
          key="view"
          icon={
            <Tooltip title="View Submission">
              <VisibilityIcon />
            </Tooltip>
          }
          label="View"
          onClick={() => handleViewSubmission(params.row.userId)}
        />,
        <GridActionsCellItem
          key="grade"
          icon={
            <Tooltip title="Grade Submission">
              <EditIcon />
            </Tooltip>
          }
          label="Grade"
          onClick={() => handleGradeClick(params.row.userId)}
        />,
        <GridActionsCellItem
          key="quickgrade"
          icon={
            <Tooltip title="Quick Grade">
              <SpeedIcon />
            </Tooltip>
          }
          label="Quick Grade"
          onClick={() => handleOpenQuickGrade(params.row.id, params.row.userId, params.row.grade)}
        />,
        ...(params.row.hasFiles ? [
          <GridActionsCellItem
            key="download"
            icon={
              <Tooltip title="Download Files">
                <DownloadIcon />
              </Tooltip>
            }
            label="Download"
            onClick={() => handleDownloadFiles(params.row.id)}
          />,
        ] : []),
      ],
    },
  ], [assignment, handleViewSubmission, handleGradeClick, handleOpenQuickGrade, handleDownloadFiles]);

  // -------------------------------------------------------------------------
  // Loading State
  // -------------------------------------------------------------------------

  if (authLoading || assignmentLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <CircularProgress size={48} />
      </Box>
    );
  }

  // -------------------------------------------------------------------------
  // Permission Check
  // -------------------------------------------------------------------------

  if (!isAuthenticated || !user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          You must be logged in to access this page.
        </Alert>
      </Box>
    );
  }

  if (!hasGradingPermission) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <Typography variant="subtitle1" fontWeight="bold">
            403 Forbidden
          </Typography>
          <Typography variant="body2">
            You do not have permission to grade submissions for this assignment.
            Required capability: mod/assign:grade
          </Typography>
        </Alert>
      </Box>
    );
  }

  // -------------------------------------------------------------------------
  // Error State
  // -------------------------------------------------------------------------

  if (assignmentError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load assignment details. Please try again later.
          {assignmentError instanceof Error && (
            <Typography variant="caption" display="block">
              Error: {assignmentError.message}
            </Typography>
          )}
        </Alert>
      </Box>
    );
  }

  if (!assignment) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Assignment not found.
        </Alert>
      </Box>
    );
  }

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Grading: {assignment.name}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Review and grade student submissions
        </Typography>
        {assignment.duedate && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <ScheduleIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              Due: {formatDate(assignment.duedate)}
            </Typography>
            {isPast(new Date(assignment.duedate * 1000)) && (
              <Chip size="small" label="Past Due" color="error" />
            )}
          </Box>
        )}
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <GroupIcon color="primary" />
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {statistics.total}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Students
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon color="success" />
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {statistics.submitted}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Submitted
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssessmentIcon color="info" />
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {statistics.graded}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Graded ({statistics.total > 0 ? Math.round((statistics.graded / statistics.total) * 100) : 0}%)
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssessmentIcon color="secondary" />
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {statistics.averageGrade !== null ? statistics.averageGrade.toFixed(1) : '-'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Average Grade
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        {statistics.overdue > 0 && (
          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ bgcolor: 'error.light' }}>
              <CardContent sx={{ py: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon sx={{ color: 'error.dark' }} />
                  <Box>
                    <Typography variant="h5" fontWeight="bold" sx={{ color: 'error.dark' }}>
                      {statistics.overdue}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'error.dark' }}>
                      Overdue
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Filter Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <FilterListIcon />
          <Typography variant="subtitle1" fontWeight="medium">
            Filters
          </Typography>
        </Box>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="status-filter-label">Status</InputLabel>
              <Select
                labelId="status-filter-label"
                id="status-filter"
                value={filters.status}
                label="Status"
                onChange={handleStatusFilterChange}
              >
                {STATUS_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="From Date"
              value={filters.dateFrom}
              onChange={(e) => handleDateChange('dateFrom', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="To Date"
              value={filters.dateTo}
              onChange={(e) => handleDateChange('dateTo', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={12} md={2}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
              >
                Clear
              </Button>
              <IconButton size="small" onClick={() => refetchSubmissions()} title="Refresh">
                <RefreshIcon />
              </IconButton>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Batch Actions Toolbar */}
      {selectedRows.length > 0 && (
        <Toolbar
          sx={{
            pl: { sm: 2 },
            pr: { xs: 1, sm: 1 },
            bgcolor: 'primary.light',
            borderRadius: 1,
            mb: 2,
          }}
        >
          <Typography
            sx={{ flex: '1 1 100%' }}
            color="inherit"
            variant="subtitle1"
          >
            {selectedRows.length} selected
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadSelected}
            sx={{ mr: 1 }}
          >
            Download Selected
          </Button>
          {assignment.markingworkflow && (
            <Button
              variant="contained"
              size="small"
              onClick={() => handleBatchAction('setWorkflow')}
            >
              Set Workflow State
            </Button>
          )}
        </Toolbar>
      )}

      {/* Download All Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadAll}
        >
          Download All Submissions
        </Button>
      </Box>

      {/* Submissions DataGrid */}
      <Paper sx={{ height: 600, width: '100%' }}>
        {submissionsLoading && <LinearProgress />}
        {submissionsError && (
          <Alert severity="error" sx={{ m: 2 }}>
            Failed to load submissions. Please try again.
          </Alert>
        )}
        <DataGrid
          rows={rows}
          columns={columns}
          paginationModel={paginationModel}
          onPaginationModelChange={handlePaginationChange}
          sortModel={sortModel}
          onSortModelChange={handleSortChange}
          checkboxSelection
          rowSelectionModel={selectedRows}
          onRowSelectionModelChange={handleSelectionChange}
          onRowClick={handleRowClick}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          rowCount={submissionsData?.total || rows.length}
          paginationMode="server"
          sortingMode="server"
          loading={submissionsLoading}
          disableRowSelectionOnClick={false}
          getRowId={(row) => row.id}
          sx={{
            '& .MuiDataGrid-row:hover': {
              cursor: 'pointer',
            },
          }}
          localeText={{
            noRowsLabel: 'No submissions found',
            noResultsOverlayLabel: 'No submissions match your filters',
          }}
          slots={{
            noRowsOverlay: () => (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                }}
              >
                <Typography variant="h6" color="text.secondary">
                  No submissions found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {filters.status !== 'all' || filters.search
                    ? 'Try adjusting your filters'
                    : 'No students have made submissions yet'}
                </Typography>
              </Box>
            ),
          }}
        />
      </Paper>

      {/* Quick Grade Dialog */}
      <Dialog open={quickGradeDialog.open} onClose={handleCloseQuickGrade}>
        <DialogTitle>Quick Grade</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={`Grade (0 - ${assignment.grade || 100})`}
            type="number"
            fullWidth
            variant="outlined"
            value={quickGradeValue}
            onChange={(e) => setQuickGradeValue(e.target.value)}
            inputProps={{
              min: 0,
              max: assignment.grade || 100,
              step: 0.01,
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseQuickGrade}>Cancel</Button>
          <Button
            onClick={handleSubmitQuickGrade}
            variant="contained"
            disabled={isGrading || !quickGradeValue}
          >
            {isGrading ? <CircularProgress size={20} /> : 'Save Grade'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Batch Action Dialog */}
      <Dialog open={batchDialogOpen} onClose={handleCloseBatchDialog}>
        <DialogTitle>Batch Action: {batchAction}</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to perform this action on {selectedRows.length} selected submissions?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBatchDialog}>Cancel</Button>
          <Button
            onClick={handleCloseBatchDialog}
            variant="contained"
            color="primary"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GradingPage;
