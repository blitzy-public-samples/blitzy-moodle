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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  DataGrid,
  GridRow,
  type GridColDef,
  type GridRenderCellParams,
  type GridRowProps,
} from '@mui/x-data-grid';
import {
  Info as InfoIcon,
  History as HistoryIcon,
  Lock as LockIcon,
  VisibilityOff as HiddenIcon,
  ExpandMore as ExpandMoreIcon,
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
    maxGrade?: number;
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
 * Custom row component that adds data-item-id attribute to each row
 */
function CustomGradeRow(props: GridRowProps) {
  const { row } = props;
  if (!row) {
    return <GridRow {...props} />;
  }
  return (
    <GridRow
      {...props}
      data-testid={`grade-item-${row.id}`}
      data-item-id={String(row.id)}
      tabIndex={0}
    />
  );
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
            <Typography variant="body2" data-testid={`grade-item-name-${params.row.id}`}>{params.row.itemname}</Typography>
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
            <Typography variant="body2" data-testid={`grade-value-${params.row.id}`}>
              {grade.toFixed(2)}
            </Typography>
          );
        },
      },
      {
        field: 'range',
        headerName: 'Max Grade',
        width: 100,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params: GridRenderCellParams<GradeSummary>) => (
          <Typography variant="body2" color="text.secondary" data-testid={`max-grade-${params.row.id}`}>
            {params.row.grademax}
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
            return <Typography variant="body2" data-testid={`grade-percentage-${params.row.id}`}>—</Typography>;
          }
          return (
            <Typography variant="body2" data-testid={`grade-percentage-${params.row.id}`}>
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
            return <Typography variant="body2" data-testid={`letter-grade-${params.row.id}`}>—</Typography>;
          }
          return (
            <Chip
              label={letter}
              size="small"
              color="primary"
              variant="outlined"
              data-testid={`letter-grade-${params.row.id}`}
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
            return <Typography variant="body2" color="text.disabled" data-testid={`grade-feedback-${params.row.id}`}>—</Typography>;
          }
          return (
            <Tooltip title={feedback}>
              <Typography
                variant="body2"
                data-testid={`grade-feedback-${params.row.id}`}
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
    <Box>
      {/* Course Total Summary */}
      {courseTotal && (
        <Paper
          sx={{ p: 2, mb: 2 }}
          data-testid="course-total"
        >
          <Stack direction="row" spacing={3} alignItems="center">
            <Typography variant="h6">Course Total:</Typography>
            <Box>
              <Typography variant="h5" component="span" data-testid="total-grade">
                {courseTotal.grade !== null ? courseTotal.grade.toFixed(2) : '—'}
              </Typography>
              <Typography variant="body2" component="span" color="text.secondary" sx={{ ml: 1 }}>
                / <Typography variant="body1" component="span" data-testid="max-total-grade">
                  {courseTotal.maxGrade !== undefined ? courseTotal.maxGrade.toFixed(2) : courseTotal.range.split('-')[1]}
                </Typography>
              </Typography>
            </Box>
            {courseTotal.percentage !== null && (
              <Typography variant="h6" data-testid="total-percentage">
                {courseTotal.percentage.toFixed(1)}%
              </Typography>
            )}
            {courseTotal.lettergrade && (
              <Chip
                label={courseTotal.lettergrade}
                color="primary"
                data-testid="overview-letter"
              />
            )}
          </Stack>
        </Paper>
      )}

      {/* Grades Table */}
      <Box>
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
          getRowId={(row) => row.id}
          getRowClassName={(params) => `grade-item grade-item-${params.id}`}
          aria-label="Student grades table"
          data-testid={testId}
          slots={{
            row: CustomGradeRow,
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
      </Box>

      {/* Grade Details Modal */}
      <Dialog
        open={detailsOpen}
        onClose={handleCloseDetails}
        maxWidth="sm"
        fullWidth
        aria-labelledby="grade-details-title"
        PaperProps={{
          'data-testid': 'grade-details-modal'
        } as any}
      >
        {selectedGrade && (
          <>
            <DialogTitle id="grade-details-title">
              <Typography variant="h6" data-testid="grade-item-name">{selectedGrade.itemname}</Typography>
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
                  <Typography variant="h4" data-testid="grade-value">
                    {selectedGrade.grade !== null ? selectedGrade.grade.toFixed(2) : '—'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    out of <span data-testid="max-grade">{selectedGrade.grademax}</span>
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
                    <Typography variant="body1" data-testid="grade-feedback">
                      {selectedGrade.feedback}
                    </Typography>
                  </Box>
                )}

                {selectedGrade.timemodified && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Date Graded
                    </Typography>
                    <Typography variant="body1" data-testid="date-graded">
                      {new Date(selectedGrade.timemodified).toLocaleString()}
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

                {selectedGrade.modificationHistory && selectedGrade.modificationHistory.length > 0 && (
                  <Accordion data-testid="grade-history-accordion">
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      aria-controls="grade-history-content"
                      id="grade-history-header"
                    >
                      <Typography variant="subtitle2">
                        Grade History ({selectedGrade.modificationHistory.length} changes)
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1.5}>
                        {selectedGrade.modificationHistory.map((record, index) => (
                          <Paper
                            key={index}
                            variant="outlined"
                            sx={{ p: 1.5 }}
                            data-testid={`history-record-${index}`}
                          >
                            <Stack spacing={0.5}>
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" fontWeight="medium" data-testid={`history-grade-${index}`}>
                                  Grade: {record.grade}
                                </Typography>
                                <Chip
                                  label={record.action}
                                  size="small"
                                  color={record.action === 'Graded' ? 'primary' : 'default'}
                                  data-testid={`history-action-${index}`}
                                />
                              </Box>
                              <Typography variant="caption" color="text.secondary" data-testid={`history-date-${index}`}>
                                {new Date(record.date).toLocaleString()}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" data-testid={`history-modifier-${index}`}>
                                Modified by: {record.modifiedBy}
                              </Typography>
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDetails} data-testid="close-modal">Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

export default GradeTable;
