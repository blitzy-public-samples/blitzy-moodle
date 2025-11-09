/**
 * SubmissionList Component
 *
 * Display component for showing a list of assignment submissions with status indicators,
 * timestamps, grades, and actions. Renders submission data in a table layout (teacher view)
 * or card layout (student view) showing student information, submission status, submission date,
 * grade if available, and action buttons for viewing/grading.
 *
 * Supports different views for students (showing their own submission history with multiple
 * attempts) and teachers (showing all student submissions for grading). Implements filtering
 * by status, sorting by various columns, and pagination for large submission lists.
 *
 * @package react-frontend
 * @module features/activities/assignments/components
 */

import { useMemo, useCallback, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Paper,
  Chip,
  IconButton,
  Typography,
  Box,
  Avatar,
  Tooltip,
  Card,
  CardContent,
  CardActions,
  Button,
  Skeleton,
  Grid,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import type { Submission, Assignment } from '../types/assignment.types';

/**
 * Props interface for SubmissionList component
 */
export interface SubmissionListProps {
  /** Array of submission objects to display */
  submissions: Submission[];
  /** Assignment details for context */
  assignment: Assignment;
  /** Callback to navigate to submission detail view */
  onViewSubmission?: (submission: Submission) => void;
  /** Callback to navigate to grading interface */
  onGradeSubmission?: (submission: Submission) => void;
  /** View mode determines layout: table for teachers, cards for students */
  viewMode: 'student' | 'teacher';
  /** Show loading skeleton during data fetch */
  loading?: boolean;
  /** Custom message to display when submissions array is empty */
  emptyMessage?: string;
}

/**
 * Enhanced submission data with computed display properties
 */
export interface SubmissionRowData extends Submission {
  /** Student's full name (or anonymous ID for blind marking) */
  studentName: string;
  /** Formatted date string for display */
  formattedDate: string;
  /** Status chip color based on submission state */
  statusColor: 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  /** Grade display string (grade value, percentage, or '-') */
  gradeDisplay: string;
  /** Whether submission was submitted after due date */
  isLate: boolean;
  /** Student initials for avatar */
  studentInitials: string;
}

/**
 * Sort order type
 */
type Order = 'asc' | 'desc';

/**
 * Sortable column identifiers for teacher view
 */
type SortableColumn = 'studentName' | 'status' | 'formattedDate' | 'gradeDisplay';

/**
 * SubmissionList Component
 *
 * Displays assignment submissions in either table format (teacher view) or
 * card format (student view) with comprehensive submission information.
 */
function SubmissionList({
  submissions,
  assignment,
  onViewSubmission,
  onGradeSubmission,
  viewMode,
  loading = false,
  emptyMessage,
}: SubmissionListProps): React.ReactElement {
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Sorting state for teacher view
  const [orderBy, setOrderBy] = useState<SortableColumn>('formattedDate');
  const [order, setOrder] = useState<Order>('desc');

  /**
   * Get status chip configuration based on submission status
   */
  const getStatusChipConfig = useCallback(
    (status: string, isLate: boolean) => {
      const configs = {
        new: {
          label: 'Not Submitted',
          color: 'default' as const,
          icon: <AssignmentIcon fontSize="small" />,
        },
        draft: {
          label: 'Draft',
          color: 'warning' as const,
          icon: <ScheduleIcon fontSize="small" />,
        },
        submitted: {
          label: isLate ? 'Submitted (Late)' : 'Submitted',
          color: isLate ? ('error' as const) : ('primary' as const),
          icon: <CheckCircleIcon fontSize="small" />,
        },
        reopened: {
          label: 'Reopened',
          color: 'secondary' as const,
          icon: <RefreshIcon fontSize="small" />,
        },
      };

      return (
        configs[status as keyof typeof configs] || {
          label: 'Unknown',
          color: 'default' as const,
          icon: null,
        }
      );
    },
    []
  );

  /**
   * Get student initials from name
   */
  const getInitials = useCallback((name: string): string => {
    const parts = name.trim().split(' ').filter(part => part.length > 0);
    if (parts.length === 0) {
      return '?';
    }
    const firstPart = parts[0];
    if (!firstPart) {
      return '?';
    }
    if (parts.length === 1) {
      return firstPart.charAt(0).toUpperCase();
    }
    const lastPart = parts[parts.length - 1];
    if (!lastPart) {
      return firstPart.charAt(0).toUpperCase();
    }
    return (firstPart.charAt(0) + lastPart.charAt(0)).toUpperCase();
  }, []);

  /**
   * Transform submissions into enhanced row data with computed properties
   */
  const submissionRows: SubmissionRowData[] = useMemo(() => {
    return submissions.map((submission) => {
      // Extract student name from submission (comes from API when fetched with user data)
      const studentName = submission.studentname || `Student ${submission.userid}`;

      // Format submission date
      let formattedDate = 'Not submitted';
      if (submission.timemodified && submission.status !== 'new') {
        formattedDate = format(new Date(submission.timemodified * 1000), 'MMM dd, yyyy HH:mm');
      }

      // Determine if submission is late
      const isLate =
        assignment.duedate > 0 &&
        submission.timemodified > assignment.duedate &&
        submission.status === 'submitted';

      // Map status to chip color
      let statusColor: SubmissionRowData['statusColor'] = 'default';
      switch (submission.status) {
        case 'new':
          statusColor = 'default';
          break;
        case 'draft':
          statusColor = 'warning';
          break;
        case 'submitted':
          statusColor = isLate ? 'error' : 'primary';
          break;
        case 'reopened':
          statusColor = 'secondary';
          break;
        default:
          statusColor = 'default';
      }

      // Format grade display: Show grade value or '-' if not graded
      // Reference: public/mod/assign/locallib.php display_grade() function
      let gradeDisplay = '-';
      if (submission.grade !== undefined && submission.grade !== null && submission.grade !== '') {
        const gradeValue = typeof submission.grade === 'number' ? submission.grade : parseFloat(submission.grade);
        if (!isNaN(gradeValue)) {
          gradeDisplay = `${gradeValue} / ${assignment.grade}`;
        }
      }

      return {
        ...submission,
        studentName,
        formattedDate,
        statusColor,
        gradeDisplay,
        isLate,
        studentInitials: getInitials(studentName),
      };
    });
  }, [submissions, assignment.duedate, getInitials]);

  /**
   * Sort comparison function
   */
  const getComparator = useCallback(
    (order: Order, orderBy: SortableColumn) => {
      return (a: SubmissionRowData, b: SubmissionRowData) => {
        let aValue: string | number = a[orderBy];
        let bValue: string | number = b[orderBy];

        // Special handling for date sorting
        if (orderBy === 'formattedDate') {
          aValue = a.timemodified || 0;
          bValue = b.timemodified || 0;
        }

        if (bValue < aValue) {
          return order === 'asc' ? 1 : -1;
        }
        if (bValue > aValue) {
          return order === 'asc' ? -1 : 1;
        }
        return 0;
      };
    },
    []
  );

  /**
   * Sort submissions based on current order and orderBy
   */
  const sortedRows = useMemo(() => {
    return [...submissionRows].sort(getComparator(order, orderBy));
  }, [submissionRows, order, orderBy, getComparator]);

  /**
   * Get paginated rows for current page
   */
  const paginatedRows = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return sortedRows.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedRows, page, rowsPerPage]);

  /**
   * Handle sort request
   */
  const handleRequestSort = useCallback(
    (property: SortableColumn) => {
      const isAsc = orderBy === property && order === 'asc';
      setOrder(isAsc ? 'desc' : 'asc');
      setOrderBy(property);
    },
    [orderBy, order]
  );

  /**
   * Handle page change
   */
  const handleChangePage = useCallback((_event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  /**
   * Handle rows per page change
   */
  const handleChangeRowsPerPage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  /**
   * Handle view submission action
   */
  const handleViewSubmission = useCallback(
    (submissionId: number) => {
      if (onViewSubmission) {
        const originalSubmission = submissions.find(s => s.id === submissionId);
        if (originalSubmission) {
          onViewSubmission(originalSubmission);
        }
      }
    },
    [onViewSubmission, submissions]
  );

  /**
   * Handle grade submission action
   */
  const handleGradeSubmission = useCallback(
    (submissionId: number) => {
      if (onGradeSubmission) {
        const originalSubmission = submissions.find(s => s.id === submissionId);
        if (originalSubmission) {
          onGradeSubmission(originalSubmission);
        }
      }
    },
    [onGradeSubmission, submissions]
  );

  /**
   * Handle download files action (placeholder for file download)
   */
  const handleDownloadFiles = useCallback((submission: Submission) => {
    // In production, this would trigger file download via API
    // TODO: Implement actual file download functionality
    void submission;
  }, []);

  /**
   * Render status chip
   */
  const renderStatusChip = useCallback(
    (status: string, isLate: boolean) => {
      const config = getStatusChipConfig(status, isLate);
      return (
        <Chip
          label={config.label}
          color={config.color}
          size="small"
          icon={config.icon}
          sx={{ minWidth: 120 }}
        />
      );
    },
    [getStatusChipConfig]
  );

  /**
   * Render loading skeleton
   */
  const renderLoadingSkeleton = () => {
    if (viewMode === 'teacher') {
      return (
        <TableBody>
          {Array.from({ length: rowsPerPage }, (_, index) => `skeleton-row-${index}`).map((key) => (
            <TableRow key={key}>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Skeleton variant="circular" width={40} height={40} data-testid="skeleton-avatar" />
                  <Skeleton variant="text" width={120} data-testid="skeleton-name" />
                </Box>
              </TableCell>
              <TableCell>
                <Skeleton variant="rectangular" width={120} height={24} data-testid="skeleton-status" />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" width={140} data-testid="skeleton-date" />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" width={60} data-testid="skeleton-grade" />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" width={80} data-testid="skeleton-actions" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      );
    }

    // Student view loading
    return (
      <Grid container spacing={2}>
        {Array.from({ length: 3 }, (_, index) => `skeleton-card-${index}`).map((key) => (
          <Grid item xs={12} key={key}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width="60%" data-testid="skeleton-title" />
                <Skeleton variant="text" width="40%" data-testid="skeleton-subtitle" />
                <Skeleton variant="rectangular" height={60} sx={{ mt: 2 }} data-testid="skeleton-content" />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => {
    const defaultMessage =
      viewMode === 'teacher' ? 'No student submissions yet' : "You haven't submitted yet";
    const message = emptyMessage ?? defaultMessage;

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          px: 2,
        }}
      >
        <AssignmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" align="center">
          {message}
        </Typography>
      </Box>
    );
  };

  /**
   * Render teacher view table
   */
  const renderTeacherView = () => {
    return (
      <>
        <TableContainer component={Paper} elevation={2}>
          <Table sx={{ minWidth: 650 }} aria-label="submission list table">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'studentName'}
                    direction={orderBy === 'studentName' ? order : 'asc'}
                    onClick={() => handleRequestSort('studentName')}
                    aria-label="Sort by student name"
                  >
                    Student
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'status'}
                    direction={orderBy === 'status' ? order : 'asc'}
                    onClick={() => handleRequestSort('status')}
                    aria-label="Sort by status"
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'formattedDate'}
                    direction={orderBy === 'formattedDate' ? order : 'asc'}
                    onClick={() => handleRequestSort('formattedDate')}
                    aria-label="Sort by submission date"
                  >
                    Submitted Date
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'gradeDisplay'}
                    direction={orderBy === 'gradeDisplay' ? order : 'asc'}
                    onClick={() => handleRequestSort('gradeDisplay')}
                    aria-label="Sort by grade"
                  >
                    Grade
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            {loading ? (
              renderLoadingSkeleton()
            ) : paginatedRows.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5}>{renderEmptyState()}</TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <TableBody>
                {paginatedRows.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                      cursor: 'pointer',
                    }}
                    onClick={() => handleViewSubmission(row.id)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: 'primary.main',
                            fontSize: '0.875rem',
                          }}
                        >
                          {row.studentInitials}
                        </Avatar>
                        <Typography variant="body2">{row.studentName}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {renderStatusChip(row.status, row.isLate)}
                      {row.isLate && (
                        <Tooltip title="Submitted after due date">
                          <ErrorIcon
                            fontSize="small"
                            color="error"
                            sx={{ ml: 0.5, verticalAlign: 'middle' }}
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{row.formattedDate}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{row.gradeDisplay}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="View submission">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewSubmission(row.id);
                            }}
                            aria-label={`View submission for ${row.studentName}`}
                            sx={{ minWidth: 44, minHeight: 44 }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {row.gradingstatus !== 'graded' && (
                          <Tooltip title="Grade submission">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGradeSubmission(row.id);
                              }}
                              aria-label={`Grade submission for ${row.studentName}`}
                              sx={{ minWidth: 44, minHeight: 44 }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {row.status === 'submitted' && row.plugins && row.plugins.length > 0 && (
                          <Tooltip title="Download files">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadFiles(row);
                              }}
                              aria-label={`Download files for ${row.studentName}`}
                              sx={{ minWidth: 44, minHeight: 44 }}
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </Table>
        </TableContainer>
        {!loading && sortedRows.length > 0 && (
          <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={sortedRows.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            aria-label="Submission list pagination"
          />
        )}
      </>
    );
  };

  /**
   * Render student view cards
   */
  const renderStudentView = () => {
    if (loading) {
      return renderLoadingSkeleton();
    }

    if (submissionRows.length === 0) {
      return renderEmptyState();
    }

    // Sort by attempt number descending (latest first) for student view
    const sortedSubmissions = [...submissionRows].sort(
      (a, b) => b.attemptnumber - a.attemptnumber
    );

    return (
      <Grid container spacing={2}>
        {sortedSubmissions.map((submission, index) => {
          const isLatestAttempt = index === 0;
          const relativeTime =
            submission.timemodified && submission.status !== 'new'
              ? formatDistanceToNow(new Date(submission.timemodified * 1000), {
                  addSuffix: true,
                })
              : null;

          return (
            <Grid item xs={12} key={submission.id}>
              <Card
                elevation={isLatestAttempt ? 4 : 2}
                sx={{
                  border: isLatestAttempt ? 2 : 0,
                  borderColor: 'primary.main',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    elevation: 6,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" component="h3">
                      {assignment.maxattempts > 1
                        ? `Attempt #${submission.attemptnumber + 1}`
                        : 'Submission'}
                    </Typography>
                    {isLatestAttempt && (
                      <Chip label="Latest" color="primary" size="small" variant="outlined" />
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                        Status:
                      </Typography>
                      {renderStatusChip(submission.status, submission.isLate)}
                    </Box>

                    {submission.status !== 'new' && submission.timemodified && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                          Submitted:
                        </Typography>
                        <Typography variant="body2">
                          {submission.formattedDate}
                          {relativeTime && (
                            <Typography
                              component="span"
                              variant="caption"
                              color="text.secondary"
                              sx={{ ml: 1 }}
                            >
                              ({relativeTime})
                            </Typography>
                          )}
                        </Typography>
                      </Box>
                    )}

                    {submission.gradingstatus === 'graded' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                          Grade:
                        </Typography>
                        <Chip
                          label={submission.gradeDisplay}
                          color="success"
                          size="small"
                          icon={<CheckCircleIcon />}
                        />
                      </Box>
                    )}

                    {submission.isLate && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          color: 'error.main',
                        }}
                      >
                        <ErrorIcon fontSize="small" />
                        <Typography variant="caption">
                          This submission was received after the due date
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<VisibilityIcon />}
                    onClick={() => handleViewSubmission(submission.id)}
                    aria-label={`View ${
                      assignment.maxattempts > 1 ? `attempt ${submission.attemptnumber + 1}` : 'submission'
                    }`}
                  >
                    View Details
                  </Button>
                  {submission.status === 'submitted' &&
                    submission.plugins &&
                    submission.plugins.length > 0 && (
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleDownloadFiles(submission)}
                        aria-label="Download submitted files"
                      >
                        Download Files
                      </Button>
                    )}
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  // Main render
  return (
    <Box sx={{ width: '100%' }}>
      {viewMode === 'teacher' ? renderTeacherView() : renderStudentView()}
    </Box>
  );
}

export default SubmissionList;
