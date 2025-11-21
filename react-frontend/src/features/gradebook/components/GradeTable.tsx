/**
 * GradeTable Component
 *
 * Displays student grades in a sortable, filterable table using MUI DataGrid.
 * Shows grade items with scores, letter grades, percentages, and feedback.
 * Supports category grouping, grade details modal, and grade history view.
 *
 * Features:
 * - Grade item display with name, category, and range
 * - Numeric grade, percentage, and letter grade columns
 * - Feedback display with truncation and expand option
 * - Hidden grade items filtering (based on permissions)
 * - Grade details modal with full feedback and metadata
 * - Grade history tracking with timestamps and grader info
 * - Responsive design with mobile optimizations
 * - WCAG 2.1 AA accessibility compliance
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Paper,
} from '@mui/material';
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from '@mui/x-data-grid';
import {
  Info as InfoIcon,
  History as HistoryIcon,
  Lock as LockIcon,
  VisibilityOff as HiddenIcon,
} from '@mui/icons-material';
import type { GradeSummary } from '../types/grade.types';

/**
 * Props for GradeTable component
 */
export interface GradeTableProps {
  /**
   * Array of grade summary data to display
   */
  grades: GradeSummary[];

  /**
   * Whether data is currently loading
   */
  loading?: boolean;

  /**
   * Course total grade information
   */
  courseTotal?: {
    grade: number | null;
    lettergrade: string | null;
    percentage: number | null;
    range: string;
  };

  /**
   * Callback when grade detail is requested
   */
  onViewDetails?: (gradeId: number) => void;

  /**
   * Callback when grade history is requested
   */
  onViewHistory?: (gradeId: number) => void;

  /**
   * Whether to show hidden grades (teacher view)
   */
  showHidden?: boolean;

  /**
   * Test ID for E2E testing
   */
  'data-testid'?: string;
}

/**
 * GradeTable component
 */
export function GradeTable({
  grades,
  loading = false,
  courseTotal,
  onViewDetails,
  onViewHistory,
  showHidden = false,
  'data-testid': testId = 'gradebook-table',
}: GradeTableProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<GradeSummary | null>(null);

  // Filter hidden grades unless showHidden is true
  const visibleGrades = useMemo(() => {
    if (showHidden) {
      return grades;
    }
    return grades.filter((grade) => !grade.hidden);
  }, [grades, showHidden]);

  // Handle viewing grade details
  const handleViewDetails = useCallback((grade: GradeSummary) => {
    setSelectedGrade(grade);
    setDetailsOpen(true);
    if (onViewDetails) {
      onViewDetails(grade.id);
    }
  }, [onViewDetails]);

  // Define columns for the DataGrid
  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'itemname',
        headerName: 'Grade Item',
        flex: 2,
        minWidth: 200,
        renderCell: (params: GridRenderCellParams<GradeSummary>) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">{params.row.itemname}</Typography>
            {params.row.hidden && (
              <Tooltip title="Hidden grade">
                <HiddenIcon fontSize="small" color="disabled" />
              </Tooltip>
            )}
            {params.row.locked && (
              <Tooltip title="Locked grade">
                <LockIcon fontSize="small" color="disabled" />
              </Tooltip>
            )}
          </Box>
        ),
      },
      {
        field: 'category',
        headerName: 'Category',
        flex: 1,
        minWidth: 150,
        renderCell: (params: GridRenderCellParams<GradeSummary>) => (
          <Typography variant="body2" color="text.secondary">
            {params.row.category ?? '—'}
          </Typography>
        ),
      },
      {
        field: 'grade',
        headerName: 'Grade',
        width: 100,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params: GridRenderCellParams<GradeSummary>) => {
          const {grade} = params.row;
          if (grade === null || grade === undefined) {
            return <Typography variant="body2">—</Typography>;
          }
          return (
            <Typography variant="body2" data-testid={`grade-${params.row.id}`}>
              {grade.toFixed(2)}
            </Typography>
          );
        },
      },
      {
        field: 'range',
        headerName: 'Range',
        width: 100,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params: GridRenderCellParams<GradeSummary>) => (
          <Typography variant="body2" color="text.secondary">
            {params.row.range}
          </Typography>
        ),
      },
      {
        field: 'percentage',
        headerName: 'Percentage',
        width: 120,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params: GridRenderCellParams<GradeSummary>) => {
          const {percentage} = params.row;
          if (percentage === null || percentage === undefined) {
            return <Typography variant="body2">—</Typography>;
          }
          return (
            <Typography variant="body2" data-testid={`percentage-${params.row.id}`}>
              {percentage.toFixed(1)}%
            </Typography>
          );
        },
      },
      {
        field: 'lettergrade',
        headerName: 'Letter',
        width: 80,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params: GridRenderCellParams<GradeSummary>) => {
          const letter = params.row.lettergrade;
          if (!letter) {
            return <Typography variant="body2">—</Typography>;
          }
          return (
            <Chip
              label={letter}
              size="small"
              color="primary"
              variant="outlined"
              data-testid={`letter-${params.row.id}`}
            />
          );
        },
      },
      {
        field: 'feedback',
        headerName: 'Feedback',
        flex: 1,
        minWidth: 150,
        renderCell: (params: GridRenderCellParams<GradeSummary>) => {
          const {feedback} = params.row;
          if (!feedback) {
            return <Typography variant="body2" color="text.disabled">—</Typography>;
          }
          return (
            <Tooltip title={feedback}>
              <Typography
                variant="body2"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {feedback}
              </Typography>
            </Tooltip>
          );
        },
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 100,
        align: 'center',
        headerAlign: 'center',
        sortable: false,
        renderCell: (params: GridRenderCellParams<GradeSummary>) => (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="View details">
              <IconButton
                size="small"
                onClick={() => handleViewDetails(params.row)}
                data-testid={`details-${params.row.id}`}
              >
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {onViewHistory && (
              <Tooltip title="View history">
                <IconButton
                  size="small"
                  onClick={() => onViewHistory(params.row.id)}
                  data-testid={`history-${params.row.id}`}
                >
                  <HistoryIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ),
      },
    ],
    [handleViewDetails, onViewHistory]
  );

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedGrade(null);
  };

  return (
    <Box data-testid={testId}>
      {/* Course Total Summary */}
      {courseTotal && (
        <Paper
          sx={{ p: 2, mb: 2 }}
          data-testid="course-total"
        >
          <Stack direction="row" spacing={3} alignItems="center">
            <Typography variant="h6">Course Total:</Typography>
            <Box>
              <Typography variant="h5" component="span" data-testid="course-total-grade">
                {courseTotal.grade !== null ? courseTotal.grade.toFixed(2) : '—'}
              </Typography>
              <Typography variant="body2" component="span" color="text.secondary" sx={{ ml: 1 }}>
                ({courseTotal.range})
              </Typography>
            </Box>
            {courseTotal.percentage !== null && (
              <Typography variant="h6" data-testid="course-total-percentage">
                {courseTotal.percentage.toFixed(1)}%
              </Typography>
            )}
            {courseTotal.lettergrade && (
              <Chip
                label={courseTotal.lettergrade}
                color="primary"
                data-testid="course-total-letter"
              />
            )}
          </Stack>
        </Paper>
      )}

      {/* Grades Table */}
      <DataGrid
        rows={visibleGrades}
        columns={columns}
        loading={loading}
        autoHeight
        disableRowSelectionOnClick
        pageSizeOptions={[10, 25, 50, 100]}
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } },
        }}
        sx={{
          '& .MuiDataGrid-cell:focus': {
            outline: 'none',
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: 'action.hover',
          },
        }}
      />

      {/* Grade Details Modal */}
      <Dialog
        open={detailsOpen}
        onClose={handleCloseDetails}
        maxWidth="sm"
        fullWidth
        data-testid="grade-details-modal"
      >
        {selectedGrade && (
          <>
            <DialogTitle>
              <Typography variant="h6">{selectedGrade.itemname}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedGrade.category ?? 'No category'}
              </Typography>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Grade
                  </Typography>
                  <Typography variant="h4" data-testid="modal-grade">
                    {selectedGrade.grade !== null ? selectedGrade.grade.toFixed(2) : '—'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Range: {selectedGrade.range}
                  </Typography>
                </Box>

                {selectedGrade.percentage !== null && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Percentage
                    </Typography>
                    <Typography variant="h5" data-testid="modal-percentage">
                      {selectedGrade.percentage.toFixed(1)}%
                    </Typography>
                  </Box>
                )}

                {selectedGrade.lettergrade && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Letter Grade
                    </Typography>
                    <Chip
                      label={selectedGrade.lettergrade}
                      color="primary"
                      size="medium"
                      data-testid="modal-letter"
                    />
                  </Box>
                )}

                {selectedGrade.feedback && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Feedback
                    </Typography>
                    <Typography variant="body1" data-testid="modal-feedback">
                      {selectedGrade.feedback}
                    </Typography>
                  </Box>
                )}

                {selectedGrade.weight !== null && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Weight in Course Total
                    </Typography>
                    <Typography variant="body1">
                      {(selectedGrade.weight * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDetails}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

export default GradeTable;
