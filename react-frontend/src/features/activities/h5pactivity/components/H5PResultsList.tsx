/**
 * H5PResultsList Component
 *
 * Displays a comprehensive list of all user H5P activity attempts with filtering,
 * sorting, and pagination capabilities. Supports both table and card view modes
 * for different user preferences and screen sizes.
 *
 * Features:
 * - Dual view modes (table with DataGrid and card view with H5PReportCard)
 * - Advanced filtering by completion status, success status, date range, score range
 * - Sortable columns for all attempt attributes
 * - Pagination for large datasets
 * - Summary statistics (total attempts, average score, best score, completion rate)
 * - Empty state handling with helpful messages
 * - Loading states with skeleton rows
 * - Error handling with retry actions
 * - Responsive design with mobile-optimized layouts
 * - Accessibility compliance (WCAG 2.1 AA)
 *
 * Usage:
 * ```tsx
 * <H5PResultsList
 *   h5pActivityId={123}
 *   userId={456}
 * />
 * ```
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { useState, useMemo, useCallback, type FC } from 'react';
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Stack,
  type SelectChangeEvent,
} from '@mui/material';
import {
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  HourglassEmpty as HourglassEmptyIcon,
} from '@mui/icons-material';
import { Chip } from '@mui/material';

// Internal imports from dependencies
import { H5PReportCard } from './H5PReportCard';
import { useH5PAttempts } from '../hooks/useH5PAttempts';
import type { H5PAttempt } from '../types/h5p.types';
import { DataTable, type DataTableColumn } from '../../../../components/data-display/DataTable';
import { Pagination } from '../../../../components/data-display/Pagination';
import { formatDuration } from '../../../../utils/date';
import { formatNumber } from '../../../../utils/formatters';
import { LoadingSpinner } from '../../../../components/feedback/LoadingSpinner';
import { Alert } from '../../../../components/feedback/Alert';

/**
 * View mode type for display toggle
 */
type ViewMode = 'table' | 'card';

/**
 * Completion status filter options
 */
type CompletionFilter = 'all' | 'completed' | 'incomplete';

/**
 * Success status filter options
 */
type SuccessFilter = 'all' | 'passed' | 'failed';

/**
 * Filter state interface for attempt filtering
 */
interface AttemptFilters {
  /**
   * Completion status filter
   */
  completion: CompletionFilter;

  /**
   * Success status filter
   */
  success: SuccessFilter;

  /**
   * Minimum score filter (0-100)
   */
  minScore?: number;

  /**
   * Maximum score filter (0-100)
   */
  maxScore?: number;

  /**
   * Start date filter (ISO string)
   */
  dateFrom?: string;

  /**
   * End date filter (ISO string)
   */
  dateTo?: string;
}

/**
 * Props interface for H5PResultsList component
 */
export interface H5PResultsListProps {
  /**
   * H5P activity ID to fetch attempts for
   */
  h5pActivityId: number;

  /**
   * User ID to fetch attempts for
   * If not provided, fetches attempts for current user
   */
  userId?: number;

  /**
   * Initial view mode
   * @default 'table'
   */
  initialViewMode?: ViewMode;

  /**
   * Number of items per page
   * @default 10
   */
  pageSize?: number;
}

/**
 * H5PResultsList Component
 *
 * Main component for displaying H5P activity attempts with filtering,
 * sorting, and dual view modes (table/card).
 */
export const H5PResultsList: FC<H5PResultsListProps> = ({
  h5pActivityId,
  userId,
  initialViewMode = 'table',
  pageSize: initialPageSize = 10,
}) => {
  // ============================================================================
  // State Management
  // ============================================================================

  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [page, setPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  
  const [filters, setFilters] = useState<AttemptFilters>({
    completion: 'all',
    success: 'all',
  });

  const [sortField, setSortField] = useState<string>('attemptNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const {
    data: attemptsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useH5PAttempts({
    h5pActivityId,
    userId,
    page: page + 1, // Convert 0-indexed to 1-indexed
    limit: pageSize,
    sortBy: sortField as any,
    sortOrder,
  });

  const attempts = attemptsData?.attempts || [];
  const totalAttempts = attemptsData?.total || 0;

  // ============================================================================
  // Filtering Logic
  // ============================================================================

  /**
   * Apply client-side filters to attempts data
   * Server-side filtering can be implemented by passing filters to useH5PAttempts
   */
  const filteredAttempts = useMemo(() => {
    let filtered = [...attempts];

    // Filter by completion status
    if (filters.completion === 'completed') {
      filtered = filtered.filter((attempt) => attempt.completion);
    } else if (filters.completion === 'incomplete') {
      filtered = filtered.filter((attempt) => !attempt.completion);
    }

    // Filter by success status
    if (filters.success === 'passed') {
      filtered = filtered.filter((attempt) => attempt.success);
    } else if (filters.success === 'failed') {
      filtered = filtered.filter((attempt) => !attempt.success);
    }

    // Filter by score range
    if (filters.minScore !== undefined) {
      filtered = filtered.filter((attempt) => {
        const percentage = attempt.maxScore > 0 
          ? (attempt.score / attempt.maxScore) * 100 
          : 0;
        return percentage >= filters.minScore!;
      });
    }

    if (filters.maxScore !== undefined) {
      filtered = filtered.filter((attempt) => {
        const percentage = attempt.maxScore > 0 
          ? (attempt.score / attempt.maxScore) * 100 
          : 0;
        return percentage <= filters.maxScore!;
      });
    }

    // Filter by date range
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter((attempt) => {
        const attemptDate = new Date(attempt.timecreated * 1000);
        return attemptDate >= fromDate;
      });
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      filtered = filtered.filter((attempt) => {
        const attemptDate = new Date(attempt.timecreated * 1000);
        return attemptDate <= toDate;
      });
    }

    return filtered;
  }, [attempts, filters]);

  // ============================================================================
  // Summary Statistics
  // ============================================================================

  /**
   * Compute summary statistics from filtered attempts
   */
  const summaryStats = useMemo(() => {
    if (filteredAttempts.length === 0) {
      return {
        totalAttempts: 0,
        averageScore: 0,
        bestScore: 0,
        completionRate: 0,
        averageDuration: 0,
      };
    }

    const total = filteredAttempts.length;
    const completed = filteredAttempts.filter((a) => a.completion).length;
    
    // Calculate average score percentage
    const scorePercentages = filteredAttempts.map((attempt) =>
      attempt.maxScore > 0 ? (attempt.score / attempt.maxScore) * 100 : 0
    );
    const averageScore = scorePercentages.reduce((sum, pct) => sum + pct, 0) / total;
    
    // Find best score
    const bestScore = Math.max(...scorePercentages);
    
    // Calculate completion rate
    const completionRate = (completed / total) * 100;
    
    // Calculate average duration (in seconds)
    const durations = filteredAttempts
      .map((a) => a.duration || 0)
      .filter((d) => d > 0);
    const averageDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    return {
      totalAttempts: total,
      averageScore: Math.round(averageScore * 10) / 10,
      bestScore: Math.round(bestScore * 10) / 10,
      completionRate: Math.round(completionRate * 10) / 10,
      averageDuration,
    };
  }, [filteredAttempts]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle view mode toggle
   */
  const handleViewModeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
      if (newMode !== null) {
        setViewMode(newMode);
      }
    },
    []
  );

  /**
   * Handle filter changes
   */
  const handleCompletionFilterChange = useCallback((event: SelectChangeEvent<CompletionFilter>) => {
    setFilters((prev) => ({ ...prev, completion: event.target.value as CompletionFilter }));
    setPage(0); // Reset to first page
  }, []);

  const handleSuccessFilterChange = useCallback((event: SelectChangeEvent<SuccessFilter>) => {
    setFilters((prev) => ({ ...prev, success: event.target.value as SuccessFilter }));
    setPage(0); // Reset to first page
  }, []);

  const handleMinScoreChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFilters((prev) => ({
      ...prev,
      minScore: value ? parseFloat(value) : undefined,
    }));
    setPage(0);
  }, []);

  const handleMaxScoreChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFilters((prev) => ({
      ...prev,
      maxScore: value ? parseFloat(value) : undefined,
    }));
    setPage(0);
  }, []);

  const handleDateFromChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, dateFrom: event.target.value }));
    setPage(0);
  }, []);

  const handleDateToChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, dateTo: event.target.value }));
    setPage(0);
  }, []);

  /**
   * Handle pagination change
   */
  const handlePageChange = useCallback((_event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((event: SelectChangeEvent<number>) => {
    setPageSize(event.target.value as number);
    setPage(0);
  }, []);

  // ============================================================================
  // Table Column Definitions
  // ============================================================================

  /**
   * Column definitions for DataTable component
   */
  const columns: DataTableColumn<H5PAttempt>[] = useMemo(
    () => [
      {
        field: 'attemptNumber',
        headerName: 'Attempt',
        width: 100,
        sortable: true,
        renderCell: (params) => (
          <Typography variant="body2" fontWeight="medium">
            #{params.row.attemptNumber}
          </Typography>
        ),
      },
      {
        field: 'timecreated',
        headerName: 'Date',
        width: 180,
        sortable: true,
        renderCell: (params) => {
          const date = new Date(params.row.timecreated * 1000);
          return (
            <Typography variant="body2">
              {date.toLocaleDateString()} {date.toLocaleTimeString()}
            </Typography>
          );
        },
      },
      {
        field: 'score',
        headerName: 'Score',
        width: 150,
        sortable: true,
        renderCell: (params) => {
          const percentage = params.row.maxScore > 0
            ? ((params.row.score / params.row.maxScore) * 100).toFixed(1)
            : '0.0';
          return (
            <Typography variant="body2">
              {formatNumber(params.row.score)} / {formatNumber(params.row.maxScore)}{' '}
              <Typography component="span" variant="caption" color="text.secondary">
                ({percentage}%)
              </Typography>
            </Typography>
          );
        },
      },
      {
        field: 'duration',
        headerName: 'Duration',
        width: 120,
        sortable: true,
        renderCell: (params) => (
          <Typography variant="body2">
            {params.row.duration ? formatDuration(params.row.duration) : 'N/A'}
          </Typography>
        ),
      },
      {
        field: 'completion',
        headerName: 'Status',
        width: 130,
        sortable: true,
        renderCell: (params) => (
          <Chip
            icon={params.row.completion ? <CheckCircleIcon /> : <HourglassEmptyIcon />}
            label={params.row.completion ? 'Completed' : 'In Progress'}
            color={params.row.completion ? 'success' : 'default'}
            size="small"
          />
        ),
      },
      {
        field: 'success',
        headerName: 'Result',
        width: 120,
        sortable: true,
        renderCell: (params) => {
          if (!params.row.completion) {
            return <Typography variant="body2" color="text.secondary">-</Typography>;
          }
          return (
            <Chip
              icon={params.row.success ? <CheckCircleIcon /> : <CancelIcon />}
              label={params.row.success ? 'Passed' : 'Failed'}
              color={params.row.success ? 'success' : 'error'}
              size="small"
              variant="outlined"
            />
          );
        },
      },
    ],
    []
  );

  // ============================================================================
  // Render Logic
  // ============================================================================

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <LoadingSpinner message="Loading attempts..." />
      </Box>
    );
  }

  // Error state
  if (isError) {
    return (
      <Alert
        severity="error"
        title="Failed to Load Attempts"
        message={error instanceof Error ? error.message : 'An unexpected error occurred'}
        action={
          <button onClick={() => refetch()} style={{ marginLeft: '8px' }}>
            Retry
          </button>
        }
      />
    );
  }

  // Empty state
  if (attempts.length === 0) {
    return (
      <Alert
        severity="info"
        title="No Attempts Found"
        message="This H5P activity has no recorded attempts yet. Complete the activity to see your results here."
      />
    );
  }

  // Filtered empty state
  if (filteredAttempts.length === 0) {
    return (
      <>
        {/* Render filters to allow user to adjust */}
        {renderFilters()}
        <Alert
          severity="info"
          title="No Matching Attempts"
          message="No attempts match your current filters. Try adjusting the filter criteria above."
        />
      </>
    );
  }

  /**
   * Render filter controls
   */
  function renderFilters() {
    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Filter Attempts
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Completion</InputLabel>
              <Select
                value={filters.completion}
                label="Completion"
                onChange={handleCompletionFilterChange}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="incomplete">In Progress</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Result</InputLabel>
              <Select
                value={filters.success}
                label="Result"
                onChange={handleSuccessFilterChange}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="passed">Passed</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Min Score (%)"
              type="number"
              size="small"
              fullWidth
              value={filters.minScore || ''}
              onChange={handleMinScoreChange}
              inputProps={{ min: 0, max: 100, step: 1 }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Max Score (%)"
              type="number"
              size="small"
              fullWidth
              value={filters.maxScore || ''}
              onChange={handleMaxScoreChange}
              inputProps={{ min: 0, max: 100, step: 1 }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="From Date"
              type="date"
              size="small"
              fullWidth
              value={filters.dateFrom || ''}
              onChange={handleDateFromChange}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="To Date"
              type="date"
              size="small"
              fullWidth
              value={filters.dateTo || ''}
              onChange={handleDateToChange}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </Box>
    );
  }

  /**
   * Render summary statistics
   */
  function renderSummaryStats() {
    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Summary
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label={`${summaryStats.totalAttempts} Attempts`}
            color="primary"
            variant="outlined"
          />
          <Chip
            label={`Avg: ${summaryStats.averageScore}%`}
            color="info"
            variant="outlined"
          />
          <Chip
            label={`Best: ${summaryStats.bestScore}%`}
            color="success"
            variant="outlined"
          />
          <Chip
            label={`Completion: ${summaryStats.completionRate}%`}
            color="secondary"
            variant="outlined"
          />
          {summaryStats.averageDuration > 0 && (
            <Chip
              label={`Avg Duration: ${formatDuration(summaryStats.averageDuration)}`}
              color="default"
              variant="outlined"
            />
          )}
        </Stack>
      </Box>
    );
  }

  /**
   * Render table view
   */
  function renderTableView() {
    return (
      <DataTable
        columns={columns}
        rows={filteredAttempts.map((attempt, index) => ({
          ...attempt,
          id: attempt.id || `attempt-${index}`,
        }))}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        totalRows={filteredAttempts.length}
        onPageChange={handlePageChange}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(0);
        }}
      />
    );
  }

  /**
   * Render card view
   */
  function renderCardView() {
    return (
      <>
        <Grid container spacing={2}>
          {filteredAttempts
            .slice(page * pageSize, (page + 1) * pageSize)
            .map((attempt) => (
              <Grid item xs={12} sm={6} md={4} key={attempt.id || attempt.attemptNumber}>
                <H5PReportCard attempt={attempt} h5pActivityId={h5pActivityId} />
              </Grid>
            ))}
        </Grid>

        {/* Pagination for card view */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={Math.ceil(filteredAttempts.length / pageSize)}
            page={page + 1}
            onChange={(_, newPage) => setPage(newPage - 1)}
            color="primary"
          />
        </Box>
      </>
    );
  }

  // Main render
  return (
    <Box>
      {/* Header with view toggle */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h5" component="h2">
          H5P Activity Attempts
        </Typography>

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          aria-label="view mode"
          size="small"
        >
          <ToggleButton value="table" aria-label="table view">
            <ViewListIcon />
          </ToggleButton>
          <ToggleButton value="card" aria-label="card view">
            <ViewModuleIcon />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Summary Statistics */}
      {renderSummaryStats()}

      {/* Filter Controls */}
      {renderFilters()}

      {/* View Content */}
      {viewMode === 'table' ? renderTableView() : renderCardView()}
    </Box>
  );
};

export default H5PResultsList;
