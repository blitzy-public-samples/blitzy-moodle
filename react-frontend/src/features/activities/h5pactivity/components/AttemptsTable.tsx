/**
 * H5P Activity Attempts Table Component
 * 
 * Displays H5P activity attempts in a comprehensive, sortable, and filterable table.
 * Features include:
 * - Sortable columns for all attempt metadata
 * - Filterable rows based on completion and success status
 * - Pagination controls for large datasets
 * - Row selection for bulk operations
 * - Export functionality (CSV, JSON)
 * - Summary statistics in table footer
 * - Loading and empty state handling
 * - Responsive design with column hiding on mobile
 * 
 * @package    react-frontend
 * @copyright  2024 Moodle
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Skeleton,
  Tooltip,
  Typography,
  Button,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridSortModel,
  GridFilterModel,
  GridPaginationModel,
  GridToolbarContainer,
  GridRowSelectionModel,
  GridValueGetterParams,
} from '@mui/x-data-grid';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Visibility as VisibilityIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

/**
 * H5P Attempt interface matching API response format
 */
export interface H5PAttempt {
  id: number;
  h5pactivityid: number;
  userid: number;
  timecreated: number;
  timemodified: number;
  attempt: number;
  rawscore: number;
  maxscore: number;
  duration: string;
  durationcompact: string;
  completion: 0 | 1;
  success: 0 | 1;
  scaled: number;
  reporturl: string;
  score: string;
}

/**
 * Statistics for attempts display in footer
 */
interface AttemptStatistics {
  totalAttempts: number;
  averageScore: number;
  completionRate: number;
  successRate: number;
}

/**
 * Component props interface
 */
interface AttemptsTableProps {
  /** Array of H5P attempts to display */
  attempts: H5PAttempt[];
  /** Loading state for data fetching */
  loading?: boolean;
  /** Error message if data fetch failed */
  error?: string | null;
  /** Callback when view details is clicked */
  onViewDetails?: (attemptId: number) => void;
  /** Enable row selection */
  enableSelection?: boolean;
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: number[]) => void;
  /** Enable export functionality */
  enableExport?: boolean;
  /** Callback for CSV export */
  onExportCsv?: () => void;
  /** Callback for JSON export */
  onExportJson?: () => void;
}

/**
 * Custom toolbar with export functionality
 */
const CustomToolbar: React.FC<{
  onExportCsv?: () => void;
  onExportJson?: () => void;
  enableExport?: boolean;
}> = ({ onExportCsv, onExportJson, enableExport }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleExportCsv = () => {
    if (onExportCsv) {
      onExportCsv();
    }
    handleClose();
  };

  const handleExportJson = () => {
    if (onExportJson) {
      onExportJson();
    }
    handleClose();
  };

  if (!enableExport) {
    return <GridToolbarContainer />;
  }

  return (
    <GridToolbarContainer>
      <Button
        startIcon={<FileDownloadIcon />}
        onClick={handleClick}
        size="small"
        aria-controls={open ? 'export-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        Export
      </Button>
      <Menu
        id="export-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'export-button',
        }}
      >
        <MenuItem onClick={handleExportCsv}>Export as CSV</MenuItem>
        <MenuItem onClick={handleExportJson}>Export as JSON</MenuItem>
      </Menu>
    </GridToolbarContainer>
  );
};

/**
 * Empty state component when no attempts exist
 */
const EmptyState: React.FC = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      py: 8,
    }}
  >
    <Typography variant="h6" color="text.secondary" gutterBottom>
      No attempts found
    </Typography>
    <Typography variant="body2" color="text.secondary">
      There are no H5P activity attempts to display yet.
    </Typography>
  </Box>
);

/**
 * Loading skeleton for table rows
 */
const LoadingSkeleton: React.FC = () => (
  <Box sx={{ width: '100%', p: 2 }}>
    {[...Array(5)].map((_, index) => (
      <Skeleton
        key={index}
        variant="rectangular"
        height={52}
        sx={{ mb: 1 }}
        animation="wave"
      />
    ))}
  </Box>
);

/**
 * AttemptsTable Component
 * 
 * Renders H5P attempts in a Material-UI DataGrid with comprehensive features
 */
const AttemptsTable: React.FC<AttemptsTableProps> = ({
  attempts = [],
  loading = false,
  error = null,
  onViewDetails,
  enableSelection = false,
  onSelectionChange,
  enableExport = true,
  onExportCsv,
  onExportJson,
}) => {
  // State management
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'timemodified', sort: 'desc' },
  ]);
  const [filterModel, setFilterModel] = useState<GridFilterModel>({
    items: [],
  });
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>([]);

  /**
   * Calculate aggregate statistics from attempts data
   */
  const statistics = useMemo<AttemptStatistics>(() => {
    if (attempts.length === 0) {
      return {
        totalAttempts: 0,
        averageScore: 0,
        completionRate: 0,
        successRate: 0,
      };
    }

    const totalScore = attempts.reduce((sum, attempt) => {
      const percentage = attempt.maxscore > 0
        ? (attempt.rawscore / attempt.maxscore) * 100
        : 0;
      return sum + percentage;
    }, 0);

    const completedCount = attempts.filter((attempt) => attempt.completion === 1).length;
    const successCount = attempts.filter((attempt) => attempt.success === 1).length;

    return {
      totalAttempts: attempts.length,
      averageScore: totalScore / attempts.length,
      completionRate: (completedCount / attempts.length) * 100,
      successRate: (successCount / attempts.length) * 100,
    };
  }, [attempts]);

  /**
   * Handle sort model change with accessibility announcement
   */
  const handleSortModelChange = useCallback((newModel: GridSortModel) => {
    setSortModel(newModel);
    
    // Announce sort change to screen readers
    if (newModel.length > 0) {
      const { field, sort } = newModel[0];
      const announcement = `Table sorted by ${field} in ${sort === 'asc' ? 'ascending' : 'descending'} order`;
      const ariaLive = document.createElement('div');
      ariaLive.setAttribute('role', 'status');
      ariaLive.setAttribute('aria-live', 'polite');
      ariaLive.textContent = announcement;
      ariaLive.style.position = 'absolute';
      ariaLive.style.left = '-10000px';
      document.body.appendChild(ariaLive);
      setTimeout(() => document.body.removeChild(ariaLive), 1000);
    }
  }, []);

  /**
   * Handle filter model change with accessibility announcement
   */
  const handleFilterModelChange = useCallback((newModel: GridFilterModel) => {
    setFilterModel(newModel);
    
    // Announce filter change to screen readers
    if (newModel.items.length > 0) {
      const announcement = `Table filtered. ${newModel.items.length} filter${newModel.items.length > 1 ? 's' : ''} applied`;
      const ariaLive = document.createElement('div');
      ariaLive.setAttribute('role', 'status');
      ariaLive.setAttribute('aria-live', 'polite');
      ariaLive.textContent = announcement;
      ariaLive.style.position = 'absolute';
      ariaLive.style.left = '-10000px';
      document.body.appendChild(ariaLive);
      setTimeout(() => document.body.removeChild(ariaLive), 1000);
    }
  }, []);

  /**
   * Handle pagination model change
   */
  const handlePaginationModelChange = useCallback((newModel: GridPaginationModel) => {
    setPaginationModel(newModel);
  }, []);

  /**
   * Handle row selection change
   */
  const handleRowSelectionChange = useCallback(
    (newSelection: GridRowSelectionModel) => {
      setRowSelectionModel(newSelection);
      if (onSelectionChange) {
        onSelectionChange(newSelection as number[]);
      }
    },
    [onSelectionChange]
  );

  /**
   * Handle view details action
   */
  const handleViewDetails = useCallback(
    (attemptId: number) => {
      if (onViewDetails) {
        onViewDetails(attemptId);
      }
    },
    [onViewDetails]
  );

  /**
   * Column definitions for DataGrid
   */
  const columns = useMemo<GridColDef[]>(
    () => [
      {
        field: 'attempt',
        headerName: '#',
        width: 80,
        sortable: true,
        type: 'number',
        headerAlign: 'left',
        align: 'left',
        description: 'Attempt number',
      },
      {
        field: 'timemodified',
        headerName: 'Date',
        width: 180,
        sortable: true,
        type: 'dateTime',
        headerAlign: 'left',
        align: 'left',
        description: 'Date of attempt',
        valueGetter: (params: GridValueGetterParams<H5PAttempt>) => {
          return new Date(params.row.timemodified * 1000);
        },
        renderCell: (params: GridRenderCellParams<H5PAttempt>) => {
          const date = new Date(params.row.timemodified * 1000);
          return (
            <Tooltip title={format(date, 'PPpp')}>
              <span>{format(date, 'PP')}</span>
            </Tooltip>
          );
        },
      },
      {
        field: 'duration',
        headerName: 'Duration',
        width: 120,
        sortable: false,
        headerAlign: 'left',
        align: 'left',
        description: 'Attempt duration',
        hideable: true,
      },
      {
        field: 'rawscore',
        headerName: 'Score',
        width: 150,
        sortable: true,
        type: 'number',
        headerAlign: 'left',
        align: 'left',
        description: 'Score achieved',
        renderCell: (params: GridRenderCellParams<H5PAttempt>) => {
          const { rawscore, maxscore } = params.row;
          const percentage = maxscore > 0
            ? ((rawscore / maxscore) * 100).toFixed(1)
            : '0.0';
          
          return (
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="body2" component="span">
                {rawscore} / {maxscore}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ({percentage}%)
              </Typography>
            </Box>
          );
        },
      },
      {
        field: 'completion',
        headerName: 'Completion',
        width: 120,
        sortable: true,
        type: 'boolean',
        headerAlign: 'center',
        align: 'center',
        description: 'Completion status',
        hideable: true,
        valueGetter: (params: GridValueGetterParams<H5PAttempt>) => {
          return params.row.completion === 1;
        },
        renderCell: (params: GridRenderCellParams<H5PAttempt>) => {
          const isCompleted = params.row.completion === 1;
          return (
            <Tooltip title={isCompleted ? 'Completed' : 'Not completed'}>
              {isCompleted ? (
                <CheckCircleIcon color="success" aria-label="Completed" />
              ) : (
                <RadioButtonUncheckedIcon color="action" aria-label="Not completed" />
              )}
            </Tooltip>
          );
        },
      },
      {
        field: 'success',
        headerName: 'Success',
        width: 120,
        sortable: true,
        type: 'boolean',
        headerAlign: 'center',
        align: 'center',
        description: 'Success status',
        valueGetter: (params: GridValueGetterParams<H5PAttempt>) => {
          return params.row.success === 1;
        },
        renderCell: (params: GridRenderCellParams<H5PAttempt>) => {
          const isSuccess = params.row.success === 1;
          return (
            <Chip
              label={isSuccess ? 'Success' : 'Failed'}
              color={isSuccess ? 'success' : 'default'}
              size="small"
              icon={
                isSuccess ? (
                  <CheckCircleIcon />
                ) : (
                  <RadioButtonUncheckedIcon />
                )
              }
              aria-label={isSuccess ? 'Successful attempt' : 'Failed attempt'}
            />
          );
        },
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 100,
        sortable: false,
        filterable: false,
        hideable: false,
        headerAlign: 'center',
        align: 'center',
        description: 'Available actions',
        renderCell: (params: GridRenderCellParams<H5PAttempt>) => {
          return (
            <Tooltip title="View attempt details">
              <IconButton
                size="small"
                onClick={() => handleViewDetails(params.row.id)}
                aria-label={`View details for attempt ${params.row.attempt}`}
                color="primary"
              >
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          );
        },
      },
    ],
    [handleViewDetails]
  );

  /**
   * Custom footer with statistics
   */
  const CustomFooter: React.FC = () => (
    <Box
      sx={{
        p: 2,
        display: 'flex',
        justifyContent: 'space-around',
        borderTop: 1,
        borderColor: 'divider',
        backgroundColor: 'background.default',
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Total Attempts
        </Typography>
        <Typography variant="h6">{statistics.totalAttempts}</Typography>
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Average Score
        </Typography>
        <Typography variant="h6">
          {statistics.averageScore.toFixed(1)}%
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Completion Rate
        </Typography>
        <Typography variant="h6">
          {statistics.completionRate.toFixed(1)}%
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Success Rate
        </Typography>
        <Typography variant="h6">
          {statistics.successRate.toFixed(1)}%
        </Typography>
      </Box>
    </Box>
  );

  // Error state
  if (error) {
    return (
      <Box
        sx={{
          p: 3,
          textAlign: 'center',
          color: 'error.main',
        }}
      >
        <Typography variant="h6">Error loading attempts</Typography>
        <Typography variant="body2">{error}</Typography>
      </Box>
    );
  }

  // Loading state
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Empty state
  if (attempts.length === 0) {
    return <EmptyState />;
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: 600,
      }}
      role="region"
      aria-label="H5P Activity Attempts Table"
    >
      <DataGrid
        rows={attempts}
        columns={columns}
        sortModel={sortModel}
        onSortModelChange={handleSortModelChange}
        filterModel={filterModel}
        onFilterModelChange={handleFilterModelChange}
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        pageSizeOptions={[5, 10, 25, 50, 100]}
        checkboxSelection={enableSelection}
        rowSelectionModel={rowSelectionModel}
        onRowSelectionModelChange={handleRowSelectionChange}
        disableRowSelectionOnClick
        slots={{
          toolbar: CustomToolbar,
          footer: CustomFooter,
        }}
        slotProps={{
          toolbar: {
            onExportCsv,
            onExportJson,
            enableExport,
          },
        }}
        // Responsive column visibility
        columnVisibilityModel={{
          duration: true,
          completion: true,
        }}
        // Accessibility
        aria-label="H5P Activity Attempts"
        // Performance
        density="standard"
        // Styling
        sx={{
          border: 1,
          borderColor: 'divider',
          '& .MuiDataGrid-cell:focus': {
            outline: 'none',
          },
          '& .MuiDataGrid-cell:focus-within': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: '-1px',
          },
        }}
      />
    </Box>
  );
};

export default AttemptsTable;
