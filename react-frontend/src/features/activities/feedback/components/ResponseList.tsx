/**
 * ResponseList Component
 *
 * Displays and manages individual feedback submission entries with filtering,
 * sorting, pagination, and deletion capabilities using MUI DataGrid.
 *
 * Based on: public/mod/feedback/show_entries.php
 *
 * Features:
 * - Display feedback responses in a sortable, filterable DataGrid
 * - User avatars and profile information
 * - Date formatting with localized display
 * - Completion status indicators
 * - Row selection for bulk operations
 * - Filtering by user, course, date range
 * - Pagination with configurable page sizes (10, 25, 50, 100)
 * - Delete confirmation dialog with accessibility
 * - Loading states with skeleton placeholders
 * - Empty state messaging
 * - Error handling with user feedback
 * - Full keyboard navigation and screen reader support
 *
 * @module features/activities/feedback/components/ResponseList
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  DataGrid,
  GridColDef,
  GridRowSelectionModel,
  GridFilterModel,
  GridSortModel,
} from '@mui/x-data-grid';
import {
  Avatar,
  Chip,
  Button,
  Box,
  Typography,
  Skeleton,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Visibility,
  Delete,
  CheckCircle,
  Schedule,
  Info,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';

import { FeedbackCompleted } from '@/features/activities/feedback/types';
import { Alert } from '@/components/feedback/Alert';
import { Modal } from '@/components/feedback/Modal';
import { useToast } from '@/hooks/useToast';

/**
 * Extended response interface with user and course information
 * for display in the DataGrid
 */
interface ResponseWithDetails extends FeedbackCompleted {
  /** User full name for display */
  userName: string;
  /** User profile picture URL */
  userAvatar?: string;
  /** Course name where feedback was completed */
  courseName: string;
  /** Whether submission is complete (1) or in progress (0) */
  completionStatus: number;
}

/**
 * Filter state for response filtering
 */
interface ResponseFilterState {
  /** Filter by user name */
  userName?: string;
  /** Filter by course ID */
  courseId?: number;
  /** Filter by start date */
  dateFrom?: Date;
  /** Filter by end date */
  dateTo?: Date;
}

/**
 * Props interface for ResponseList component
 */
export interface ResponseListProps {
  /** Feedback activity ID */
  feedbackId: number;
  /** Array of response entries to display */
  responses: ResponseWithDetails[];
  /** Callback fired when delete action is triggered */
  onDelete: (responseIds: number[]) => Promise<void>;
  /** Whether current user has permission to delete responses */
  canDelete: boolean;
  /** Loading state for initial data fetch */
  loading?: boolean;
  /** Error state from data fetch */
  error?: Error | null;
  /** Callback for viewing response details */
  onViewDetails?: (responseId: number) => void;
}

/**
 * ResponseList Component
 *
 * Renders a comprehensive table of feedback response entries with
 * full CRUD operations, filtering, sorting, and accessibility support.
 */
export const ResponseList: React.FC<ResponseListProps> = ({
  feedbackId,
  responses,
  onDelete,
  canDelete,
  loading = false,
  error = null,
  onViewDetails,
}) => {
  // State management
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [responseToDelete, setResponseToDelete] = useState<number[]>([]);
  const [filterState, setFilterState] = useState<ResponseFilterState>({});
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 25,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'timemodified', sort: 'desc' },
  ]);

  // Hooks
  const queryClient = useQueryClient();
  const { success, error: errorToast, warning } = useToast();

  // Delete mutation with React Query
  const deleteMutation = useMutation({
    mutationFn: async (responseIds: number[]) => {
      await onDelete(responseIds);
    },
    onSuccess: (_, deletedIds) => {
      // Invalidate feedback responses query
      queryClient.invalidateQueries({
        queryKey: ['feedback', feedbackId, 'responses'],
      });
      
      success(
        deletedIds.length === 1
          ? 'Response deleted successfully'
          : `${deletedIds.length} responses deleted successfully`
      );
      
      // Clear selection
      setSelectedRows([]);
    },
    onError: (err: Error) => {
      errorToast(`Failed to delete response: ${err.message}`);
    },
  });

  /**
   * Handle opening delete confirmation dialog
   */
  const handleDeleteClick = useCallback((responseIds: number[]) => {
    if (responseIds.length === 0) {
      warning('Please select at least one response to delete');
      return;
    }
    setResponseToDelete(responseIds);
    setDeleteDialogOpen(true);
  }, [warning]);

  /**
   * Handle confirmed deletion
   */
  const handleConfirmDelete = useCallback(async () => {
    setDeleteDialogOpen(false);
    await deleteMutation.mutateAsync(responseToDelete);
    setResponseToDelete([]);
  }, [deleteMutation, responseToDelete]);

  /**
   * Handle cancel deletion
   */
  const handleCancelDelete = useCallback(() => {
    setDeleteDialogOpen(false);
    setResponseToDelete([]);
  }, []);

  /**
   * Handle view details action
   */
  const handleViewDetails = useCallback((responseId: number) => {
    if (onViewDetails) {
      onViewDetails(responseId);
    }
  }, [onViewDetails]);

  /**
   * Handle row selection change
   */
  const handleSelectionChange = useCallback((newSelection: GridRowSelectionModel) => {
    setSelectedRows(newSelection);
  }, []);

  /**
   * Format date for display
   */
  const formatDate = useCallback((timestamp: number) => {
    try {
      const date = new Date(timestamp * 1000); // Convert Unix timestamp to milliseconds
      return format(date, 'MMM dd, yyyy HH:mm');
    } catch (err) {
      return 'Invalid date';
    }
  }, []);

  /**
   * Get user initials for avatar fallback
   */
  const getUserInitials = useCallback((userName: string) => {
    const names = userName.trim().split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return userName.substring(0, 2).toUpperCase();
  }, []);

  /**
   * Column definitions for DataGrid
   */
  const columns: GridColDef<ResponseWithDetails>[] = useMemo(
    () => [
      {
        field: 'id',
        headerName: 'Submission ID',
        width: 120,
        type: 'number',
        sortable: true,
        filterable: true,
      },
      {
        field: 'userName',
        headerName: 'User',
        width: 250,
        sortable: true,
        filterable: true,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar
              src={params.row.userAvatar}
              alt={params.row.userName}
              sx={{ width: 32, height: 32 }}
            >
              {getUserInitials(params.row.userName)}
            </Avatar>
            <Typography variant="body2">
              {params.row.anonymous_response === 1
                ? `Anonymous (${params.row.random_response})`
                : params.row.userName}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'timemodified',
        headerName: 'Submission Date',
        width: 180,
        type: 'dateTime',
        sortable: true,
        filterable: true,
        renderCell: (params) => (
          <Typography variant="body2">
            {formatDate(params.row.timemodified)}
          </Typography>
        ),
      },
      {
        field: 'courseName',
        headerName: 'Course',
        width: 200,
        sortable: true,
        filterable: true,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.row.courseName}>
            {params.row.courseName}
          </Typography>
        ),
      },
      {
        field: 'completionStatus',
        headerName: 'Status',
        width: 130,
        sortable: true,
        filterable: true,
        renderCell: (params) => (
          <Chip
            icon={params.row.completionStatus === 1 ? <CheckCircle /> : <Schedule />}
            label={params.row.completionStatus === 1 ? 'Complete' : 'In Progress'}
            color={params.row.completionStatus === 1 ? 'success' : 'warning'}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 150,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="View details" arrow>
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleViewDetails(params.row.id)}
                aria-label={`View details for response ${params.row.id}`}
              >
                <Visibility fontSize="small" />
              </IconButton>
            </Tooltip>
            {canDelete && (
              <Tooltip title="Delete response" arrow>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteClick([params.row.id])}
                  aria-label={`Delete response ${params.row.id}`}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ),
      },
    ],
    [canDelete, formatDate, getUserInitials, handleDeleteClick, handleViewDetails]
  );

  /**
   * Filtered and sorted responses
   */
  const filteredResponses = useMemo(() => {
    let filtered = [...responses];

    // Apply user name filter
    if (filterState.userName) {
      const searchTerm = filterState.userName.toLowerCase();
      filtered = filtered.filter((response) =>
        response.userName.toLowerCase().includes(searchTerm)
      );
    }

    // Apply course filter
    if (filterState.courseId) {
      filtered = filtered.filter(
        (response) => response.courseid === filterState.courseId
      );
    }

    // Apply date range filter
    if (filterState.dateFrom) {
      const fromTimestamp = Math.floor(filterState.dateFrom.getTime() / 1000);
      filtered = filtered.filter(
        (response) => response.timemodified >= fromTimestamp
      );
    }

    if (filterState.dateTo) {
      const toTimestamp = Math.floor(filterState.dateTo.getTime() / 1000);
      filtered = filtered.filter(
        (response) => response.timemodified <= toTimestamp
      );
    }

    return filtered;
  }, [responses, filterState]);

  /**
   * Loading skeleton for table
   */
  if (loading) {
    return (
      <Box sx={{ width: '100%', p: 2 }}>
        <Skeleton variant="rectangular" height={400} />
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Skeleton variant="rectangular" width={120} height={36} />
          <Skeleton variant="rectangular" width={120} height={36} />
        </Box>
      </Box>
    );
  }

  /**
   * Error state display
   */
  if (error) {
    return (
      <Alert
        severity="error"
        title="Failed to load responses"
        message={error.message || 'An unexpected error occurred. Please try again.'}
        closeable
      />
    );
  }

  /**
   * Empty state display
   */
  if (responses.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          textAlign: 'center',
          p: 3,
        }}
      >
        <Info sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Responses Yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          There are no feedback responses to display. Responses will appear here once
          users complete the feedback activity.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Bulk actions toolbar */}
      {selectedRows.length > 0 && canDelete && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            bgcolor: 'action.hover',
            borderRadius: 1,
            mb: 2,
          }}
        >
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            {selectedRows.length} {selectedRows.length === 1 ? 'response' : 'responses'} selected
          </Typography>
          <Button
            variant="contained"
            color="error"
            startIcon={<Delete />}
            onClick={() => handleDeleteClick(selectedRows as number[])}
            disabled={deleteMutation.isPending}
          >
            Delete Selected
          </Button>
        </Box>
      )}

      {/* DataGrid with responses */}
      <DataGrid
        rows={filteredResponses}
        columns={columns}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[10, 25, 50, 100]}
        checkboxSelection={canDelete}
        disableRowSelectionOnClick
        rowSelectionModel={selectedRows}
        onRowSelectionModelChange={handleSelectionChange}
        sortModel={sortModel}
        onSortModelChange={setSortModel}
        autoHeight
        density="standard"
        sx={{
          '& .MuiDataGrid-cell:focus': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: -1,
          },
          '& .MuiDataGrid-columnHeader:focus': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: -1,
          },
        }}
        aria-label="Feedback responses table"
        getRowId={(row) => row.id}
        localeText={{
          noRowsLabel: 'No responses to display',
          footerRowSelected: (count) =>
            count !== 1
              ? `${count.toLocaleString()} responses selected`
              : `${count.toLocaleString()} response selected`,
        }}
      />

      {/* Delete confirmation dialog */}
      <Modal
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        title="Delete Response?"
        maxWidth="sm"
        actions={[
          {
            label: 'Cancel',
            onClick: handleCancelDelete,
            color: 'inherit',
            disabled: deleteMutation.isPending,
          },
          {
            label: 'Delete',
            onClick: handleConfirmDelete,
            color: 'error',
            variant: 'contained',
            disabled: deleteMutation.isPending,
          },
        ]}
        loading={deleteMutation.isPending}
      >
        <Typography variant="body1" color="text.secondary">
          {responseToDelete.length === 1
            ? 'Are you sure you want to delete this feedback response? This action cannot be undone.'
            : `Are you sure you want to delete ${responseToDelete.length} feedback responses? This action cannot be undone.`}
        </Typography>
        {responseToDelete.length > 1 && (
          <Alert
            severity="warning"
            message="You are about to delete multiple responses at once."
            sx={{ mt: 2 }}
          />
        )}
      </Modal>
    </Box>
  );
};

export default ResponseList;
