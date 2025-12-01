/**
 * BBBRecordingList Component
 *
 * BigBlueButton recordings list component with playback controls, publish/unpublish
 * actions, protect/unprotect actions, delete functionality, and search filtering
 * capabilities. This component displays a searchable, actionable list of BBB recordings
 * for a specific BigBlueButton instance.
 *
 * Features:
 * - Recording table with search functionality
 * - Action toolbar with protect, unprotect, publish, unpublish, and delete actions
 * - Playback links for each recording format (presentation, video)
 * - Inline editing for recording name and description
 * - Status badges for published/unpublished and protected/unprotected states
 * - Debounced search input for filtering recordings
 * - Empty state message when no recordings exist
 * - Delete confirmation modal for safe recording deletion
 * - Optimistic updates for immediate UI feedback
 *
 * Based on Moodle templates:
 * - recordings_table.mustache - overall table structure
 * - recording_row_actionbar.mustache - action buttons
 * - recording_row_playback.mustache - playback links
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, {
  useState,
  useMemo,
  useCallback,
  type FC,
  type ChangeEvent,
} from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Chip,
  Button,
  Typography,
  Stack,
  Link,
} from '@mui/material';
import {
  Search as SearchIcon,
  PlayArrow as PlayIcon,
  Visibility as PublishIcon,
  VisibilityOff as UnpublishIcon,
  Lock as ProtectIcon,
  LockOpen as UnprotectIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  VideoLibrary as VideoIcon,
  Slideshow as PresentationIcon,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  useBBBRecordings,
  usePublishBBBRecording,
  useUnpublishBBBRecording,
  useDeleteBBBRecording,
  useUpdateBBBRecordingMetadata,
  bbbRecordingsKeys,
} from '@/features/activities/bigbluebuttonbn/hooks/useBBBRecordings';
import type { BBBRecording } from '@/features/activities/bigbluebuttonbn/types/bbb.types';
import { DataTable, type DataTableColumn, type RowAction } from '@/components/data-display/DataTable';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Alert } from '@/components/feedback/Alert';
import { Modal, type ModalAction } from '@/components/feedback/Modal';
import useDebounce from '@/hooks/useDebounce';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/services/api/client';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props interface for BBBRecordingList component
 */
export interface BBBRecordingListProps {
  /**
   * BigBlueButton instance ID
   */
  instanceId: number;

  /**
   * Optional group ID to filter recordings
   */
  groupId?: number;

  /**
   * Available tools for recording management
   * Comma-separated string of tool names: protect,unprotect,publish,unpublish,delete
   * @default 'protect,unprotect,publish,unpublish,delete'
   */
  tools?: string;

  /**
   * Title to display above the recordings table
   */
  title?: string;

  /**
   * Warning messages to display above the recordings list
   */
  recordingWarnings?: Array<{
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
  }>;

  /**
   * Whether to show the search input
   * @default true
   */
  showSearch?: boolean;

  /**
   * Whether the user can manage recordings (edit, delete, etc.)
   * @default true
   */
  canManage?: boolean;
}

/**
 * State for inline editing
 */
interface InlineEditState {
  recordingId: string | null;
  field: 'name' | 'description' | null;
  value: string;
}

/**
 * Recording to delete for confirmation modal
 */
interface DeleteConfirmation {
  recording: BBBRecording | null;
  isOpen: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format duration from milliseconds to human-readable string
 */
function formatDuration(startTime: number | null, endTime: number | null): string {
  if (startTime === null || endTime === null) {
    return 'N/A';
  }

  const durationMs = endTime - startTime;
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Format timestamp to localized date string
 */
function formatDate(timestamp: number | null): string {
  if (timestamp === null) {
    return 'N/A';
  }

  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get icon component for playback format
 */
function getPlaybackIcon(format: string): React.ReactNode {
  switch (format.toLowerCase()) {
    case 'presentation':
      return <PresentationIcon fontSize="small" />;
    case 'video':
      return <VideoIcon fontSize="small" />;
    default:
      return <PlayIcon fontSize="small" />;
  }
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * BigBlueButton recordings list component
 *
 * Displays a searchable table of BBB recordings with management actions including
 * publish/unpublish, protect/unprotect, delete, and inline editing capabilities.
 *
 * @example
 * ```tsx
 * <BBBRecordingList
 *   instanceId={42}
 *   groupId={5}
 *   tools="protect,unprotect,publish,unpublish,delete"
 *   title="Meeting Recordings"
 *   canManage={true}
 * />
 * ```
 */
export const BBBRecordingList: FC<BBBRecordingListProps> = ({
  instanceId,
  groupId,
  tools = 'protect,unprotect,publish,unpublish,delete',
  title,
  recordingWarnings = [],
  showSearch = true,
  canManage = true,
}) => {
  // ============================================================================
  // State Management
  // ============================================================================

  // Search input state
  const [searchInput, setSearchInput] = useState<string>('');
  const debouncedSearch = useDebounce(searchInput, 500);

  // Inline editing state
  const [editState, setEditState] = useState<InlineEditState>({
    recordingId: null,
    field: null,
    value: '',
  });

  // Delete confirmation modal state
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>({
    recording: null,
    isOpen: false,
  });

  // Toast notifications
  const { success, error: showError, warning } = useToast();

  // Query client for cache management
  const queryClient = useQueryClient();

  // Parse available tools
  const availableTools = useMemo(() => {
    const toolList = tools.split(',').map((t) => t.trim().toLowerCase());
    return {
      protect: toolList.includes('protect'),
      unprotect: toolList.includes('unprotect'),
      publish: toolList.includes('publish'),
      unpublish: toolList.includes('unpublish'),
      delete: toolList.includes('delete'),
    };
  }, [tools]);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const {
    data: recordings,
    isLoading,
    isError,
    error,
    refetch,
  } = useBBBRecordings(instanceId, {
    groupId,
    enabled: instanceId > 0,
  });

  // ============================================================================
  // Mutations
  // ============================================================================

  const publishMutation = usePublishBBBRecording(instanceId);
  const unpublishMutation = useUnpublishBBBRecording(instanceId);
  const deleteMutation = useDeleteBBBRecording(instanceId);
  const updateMetadataMutation = useUpdateBBBRecordingMetadata(instanceId);

  // Protect recording mutation (not in useBBBRecordings, implement inline)
  const protectMutation = useMutation<BBBRecording, Error, { recordingId: string }>({
    mutationFn: async ({ recordingId }) => {
      const response = await apiClient.post<{
        success: boolean;
        data: { recording: BBBRecording };
        error?: string;
      }>(`/bigbluebuttonbn/recordings/${recordingId}/protect`);

      if (!response.data.success) {
        throw new Error(response.data.error ?? 'Failed to protect recording');
      }

      return response.data.data.recording;
    },
    onMutate: async ({ recordingId }) => {
      await queryClient.cancelQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });

      const previousRecordings = queryClient.getQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId)
      );

      queryClient.setQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId),
        (old) =>
          old?.map((recording) =>
            recording.recordingId === recordingId
              ? { ...recording, protected: true }
              : recording
          )
      );

      return { previousRecordings };
    },
    onError: (err, _variables, context) => {
      if (context?.previousRecordings) {
        queryClient.setQueryData(
          bbbRecordingsKeys.list(instanceId),
          context.previousRecordings
        );
      }
      showError(`Failed to protect recording: ${err.message}`);
    },
    onSuccess: () => {
      success('Recording protected successfully');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });
    },
  });

  // Unprotect recording mutation
  const unprotectMutation = useMutation<BBBRecording, Error, { recordingId: string }>({
    mutationFn: async ({ recordingId }) => {
      const response = await apiClient.post<{
        success: boolean;
        data: { recording: BBBRecording };
        error?: string;
      }>(`/bigbluebuttonbn/recordings/${recordingId}/unprotect`);

      if (!response.data.success) {
        throw new Error(response.data.error ?? 'Failed to unprotect recording');
      }

      return response.data.data.recording;
    },
    onMutate: async ({ recordingId }) => {
      await queryClient.cancelQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });

      const previousRecordings = queryClient.getQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId)
      );

      queryClient.setQueryData<BBBRecording[]>(
        bbbRecordingsKeys.list(instanceId),
        (old) =>
          old?.map((recording) =>
            recording.recordingId === recordingId
              ? { ...recording, protected: false }
              : recording
          )
      );

      return { previousRecordings };
    },
    onError: (err, _variables, context) => {
      if (context?.previousRecordings) {
        queryClient.setQueryData(
          bbbRecordingsKeys.list(instanceId),
          context.previousRecordings
        );
      }
      showError(`Failed to unprotect recording: ${err.message}`);
    },
    onSuccess: () => {
      success('Recording unprotected successfully');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: bbbRecordingsKeys.list(instanceId),
      });
    },
  });

  // ============================================================================
  // Filtered Recordings
  // ============================================================================

  const filteredRecordings = useMemo(() => {
    if (!recordings) {
      return [];
    }

    if (!debouncedSearch.trim()) {
      return recordings;
    }

    const searchLower = debouncedSearch.toLowerCase();
    return recordings.filter(
      (recording) =>
        (recording.name?.toLowerCase().includes(searchLower) ?? false) ||
        (recording.description?.toLowerCase().includes(searchLower) ?? false)
    );
  }, [recordings, debouncedSearch]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(event.target.value);
  }, []);

  const handlePublish = useCallback(
    (recording: BBBRecording) => {
      publishMutation.mutate({ recordingId: recording.recordingId });
    },
    [publishMutation]
  );

  const handleUnpublish = useCallback(
    (recording: BBBRecording) => {
      unpublishMutation.mutate({ recordingId: recording.recordingId });
    },
    [unpublishMutation]
  );

  const handleProtect = useCallback(
    (recording: BBBRecording) => {
      protectMutation.mutate({ recordingId: recording.recordingId });
    },
    [protectMutation]
  );

  const handleUnprotect = useCallback(
    (recording: BBBRecording) => {
      unprotectMutation.mutate({ recordingId: recording.recordingId });
    },
    [unprotectMutation]
  );

  const handleDeleteRequest = useCallback((recording: BBBRecording) => {
    setDeleteConfirmation({
      recording,
      isOpen: true,
    });
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteConfirmation.recording) {
      deleteMutation.mutate(
        { recordingId: deleteConfirmation.recording.recordingId },
        {
          onSettled: () => {
            setDeleteConfirmation({ recording: null, isOpen: false });
          },
        }
      );
    }
  }, [deleteConfirmation.recording, deleteMutation]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmation({ recording: null, isOpen: false });
  }, []);

  // Inline editing handlers
  const handleStartEdit = useCallback(
    (recording: BBBRecording, field: 'name' | 'description') => {
      setEditState({
        recordingId: recording.recordingId,
        field,
        value: (field === 'name' ? recording.name : recording.description) ?? '',
      });
    },
    []
  );

  const handleEditChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setEditState((prev) => ({
      ...prev,
      value: event.target.value,
    }));
  }, []);

  const handleEditSave = useCallback(() => {
    if (editState.recordingId && editState.field) {
      const updateData: { recordingId: string; name?: string; description?: string } = {
        recordingId: editState.recordingId,
      };

      if (editState.field === 'name') {
        updateData.name = editState.value;
      } else {
        updateData.description = editState.value;
      }

      updateMetadataMutation.mutate(updateData, {
        onSettled: () => {
          setEditState({ recordingId: null, field: null, value: '' });
        },
      });
    }
  }, [editState, updateMetadataMutation]);

  const handleEditCancel = useCallback(() => {
    setEditState({ recordingId: null, field: null, value: '' });
  }, []);

  // ============================================================================
  // Column Definitions
  // ============================================================================

  const columns = useMemo<DataTableColumn<BBBRecording>[]>(() => {
    const cols: DataTableColumn<BBBRecording>[] = [
      // Recording Name Column with inline editing
      {
        field: 'name',
        headerName: 'Recording Name',
        width: 250,
        sortable: true,
        filterable: true,
        renderCell: (params) => {
          const recording = params.row as BBBRecording;
          const isEditing =
            editState.recordingId === recording.recordingId &&
            editState.field === 'name';

          if (isEditing) {
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}>
                <TextField
                  size="small"
                  value={editState.value}
                  onChange={handleEditChange}
                  autoFocus
                  fullWidth
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleEditSave();
                    } else if (e.key === 'Escape') {
                      handleEditCancel();
                    }
                  }}
                />
                <IconButton
                  size="small"
                  onClick={handleEditSave}
                  disabled={updateMetadataMutation.isPending}
                  color="primary"
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handleEditCancel}
                  disabled={updateMetadataMutation.isPending}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            );
          }

          return (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                width: '100%',
                '&:hover .edit-btn': { opacity: 1 },
              }}
            >
              <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                {recording.name ?? 'Untitled Recording'}
              </Typography>
              {canManage && (
                <IconButton
                  size="small"
                  className="edit-btn"
                  sx={{ opacity: 0, transition: 'opacity 0.2s' }}
                  onClick={() => handleStartEdit(recording, 'name')}
                  aria-label="Edit recording name"
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          );
        },
      },

      // Description Column with inline editing
      {
        field: 'description',
        headerName: 'Description',
        width: 200,
        sortable: true,
        filterable: true,
        renderCell: (params) => {
          const recording = params.row as BBBRecording;
          const isEditing =
            editState.recordingId === recording.recordingId &&
            editState.field === 'description';

          if (isEditing) {
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}>
                <TextField
                  size="small"
                  value={editState.value}
                  onChange={handleEditChange}
                  autoFocus
                  fullWidth
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleEditSave();
                    } else if (e.key === 'Escape') {
                      handleEditCancel();
                    }
                  }}
                />
                <IconButton
                  size="small"
                  onClick={handleEditSave}
                  disabled={updateMetadataMutation.isPending}
                  color="primary"
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handleEditCancel}
                  disabled={updateMetadataMutation.isPending}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            );
          }

          return (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                width: '100%',
                '&:hover .edit-btn': { opacity: 1 },
              }}
            >
              <Typography
                variant="body2"
                noWrap
                sx={{ flex: 1 }}
                color={recording.description ? 'textPrimary' : 'textSecondary'}
              >
                {recording.description ?? 'No description'}
              </Typography>
              {canManage && (
                <IconButton
                  size="small"
                  className="edit-btn"
                  sx={{ opacity: 0, transition: 'opacity 0.2s' }}
                  onClick={() => handleStartEdit(recording, 'description')}
                  aria-label="Edit recording description"
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          );
        },
      },

      // Date Column
      {
        field: 'startTime',
        headerName: 'Date',
        width: 180,
        sortable: true,
        renderCell: (params) => {
          const recording = params.row as BBBRecording;
          return (
            <Typography variant="body2">
              {formatDate(recording.startTime)}
            </Typography>
          );
        },
      },

      // Duration Column
      {
        field: 'duration',
        headerName: 'Duration',
        width: 120,
        sortable: false,
        renderCell: (params) => {
          const recording = params.row as BBBRecording;
          return (
            <Typography variant="body2">
              {formatDuration(recording.startTime, recording.endTime)}
            </Typography>
          );
        },
      },

      // Status Column (Published/Protected badges)
      {
        field: 'status',
        headerName: 'Status',
        width: 180,
        sortable: false,
        renderCell: (params) => {
          const recording = params.row as BBBRecording;
          return (
            <Stack direction="row" spacing={0.5}>
              <Chip
                label={recording.published ? 'Published' : 'Unpublished'}
                size="small"
                color={recording.published ? 'success' : 'default'}
                variant={recording.published ? 'filled' : 'outlined'}
              />
              {recording.protected && (
                <Chip
                  label="Protected"
                  size="small"
                  color="warning"
                  variant="outlined"
                  icon={<ProtectIcon fontSize="small" />}
                />
              )}
            </Stack>
          );
        },
      },

      // Playback Links Column
      {
        field: 'playbacks',
        headerName: 'Playback',
        width: 200,
        sortable: false,
        renderCell: (params) => {
          const recording = params.row as BBBRecording;
          const playbacks = recording.playbacks ?? [];

          if (playbacks.length === 0) {
            return (
              <Typography variant="body2" color="textSecondary">
                No playback available
              </Typography>
            );
          }

          return (
            <Stack direction="row" spacing={1}>
              {playbacks.map((playback, index) => (
                <Tooltip key={index} title={`Play ${playback.type}`}>
                  <Link
                    href={playback.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      textDecoration: 'none',
                      color: 'primary.main',
                      '&:hover': {
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    {getPlaybackIcon(playback.type)}
                    <Typography variant="body2" component="span">
                      {playback.type}
                    </Typography>
                  </Link>
                </Tooltip>
              ))}
            </Stack>
          );
        },
      },
    ];

    return cols;
  }, [
    editState,
    canManage,
    handleEditChange,
    handleEditSave,
    handleEditCancel,
    handleStartEdit,
    updateMetadataMutation.isPending,
  ]);

  // ============================================================================
  // Row Actions
  // ============================================================================

  const rowActions = useMemo<RowAction<BBBRecording>[]>(() => {
    if (!canManage) {
      return [];
    }

    const actions: RowAction<BBBRecording>[] = [];

    // Publish/Unpublish action
    if (availableTools.publish || availableTools.unpublish) {
      actions.push({
        label: 'Toggle Publish',
        icon: <PublishIcon />,
        onClick: (recording) => {
          if (recording.published) {
            handleUnpublish(recording);
          } else {
            handlePublish(recording);
          }
        },
        disabled: (recording) =>
          publishMutation.isPending ||
          unpublishMutation.isPending ||
          (recording.published && !availableTools.unpublish) ||
          (!recording.published && !availableTools.publish),
      });
    }

    // Protect/Unprotect action
    if (availableTools.protect || availableTools.unprotect) {
      actions.push({
        label: 'Toggle Protection',
        icon: <ProtectIcon />,
        onClick: (recording) => {
          if (recording.protected) {
            handleUnprotect(recording);
          } else {
            handleProtect(recording);
          }
        },
        disabled: (recording) =>
          protectMutation.isPending ||
          unprotectMutation.isPending ||
          (recording.protected && !availableTools.unprotect) ||
          (!recording.protected && !availableTools.protect),
      });
    }

    // Delete action
    if (availableTools.delete) {
      actions.push({
        label: 'Delete',
        icon: <DeleteIcon />,
        onClick: handleDeleteRequest,
        color: 'error',
        disabled: (recording) =>
          deleteMutation.isPending || (recording.protected ?? false),
      });
    }

    return actions;
  }, [
    canManage,
    availableTools,
    handlePublish,
    handleUnpublish,
    handleProtect,
    handleUnprotect,
    handleDeleteRequest,
    publishMutation.isPending,
    unpublishMutation.isPending,
    protectMutation.isPending,
    unprotectMutation.isPending,
    deleteMutation.isPending,
  ]);

  // ============================================================================
  // Render
  // ============================================================================

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <LoadingSpinner message="Loading recordings..." />
      </Box>
    );
  }

  // Error state
  if (isError) {
    return (
      <Alert
        severity="error"
        title="Failed to load recordings"
        message={error?.message ?? 'An unexpected error occurred while loading recordings.'}
        action={
          <Button onClick={() => refetch()} size="small">
            Retry
          </Button>
        }
      />
    );
  }

  // No recordings state
  const hasRecordings = recordings && recordings.length > 0;

  if (!hasRecordings) {
    return (
      <Box className="mod_bigbluebuttonbn_recordings_table">
        <Box id="bigbluebuttonbn_recordings_table" sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="textSecondary">
            There are no recordings yet.
          </Typography>
        </Box>
        {recordingWarnings.length > 0 && (
          <Box sx={{ mt: 3 }}>
            {recordingWarnings.map((warning, index) => (
              <Alert
                key={index}
                severity={warning.type}
                message={warning.message}
                closeable
              />
            ))}
          </Box>
        )}
      </Box>
    );
  }

  // Delete confirmation modal actions
  const deleteModalActions: ModalAction[] = [
    {
      label: 'Cancel',
      onClick: handleDeleteCancel,
      variant: 'text',
      disabled: deleteMutation.isPending,
    },
    {
      label: 'Delete',
      onClick: handleDeleteConfirm,
      color: 'error',
      variant: 'contained',
      loading: deleteMutation.isPending,
    },
  ];

  return (
    <Box className="mod_bigbluebuttonbn_recordings_table">
      {/* Title */}
      {title && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" component="h4">
            {title}
          </Typography>
        </Box>
      )}

      {/* Recording Warnings */}
      {recordingWarnings.length > 0 && (
        <Box sx={{ mt: 3 }}>
          {recordingWarnings.map((warningItem, index) => (
            <Alert
              key={index}
              severity={warningItem.type}
              message={warningItem.message}
              closeable
            />
          ))}
        </Box>
      )}

      {/* Search Input */}
      {showSearch && (
        <Box sx={{ mb: 2, maxWidth: 400 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search recordings..."
            value={searchInput}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            aria-label="Search recordings by name or description"
          />
        </Box>
      )}

      {/* Recordings Table */}
      <DataTable<BBBRecording>
        columns={columns}
        rows={filteredRecordings}
        loading={isLoading}
        rowActions={rowActions}
        emptyMessage={
          debouncedSearch
            ? `No recordings found matching "${debouncedSearch}"`
            : 'No recordings available'
        }
        ariaLabel="BigBlueButton recordings list"
        autoHeight
        density="standard"
        pagination
        pageSize={10}
        pageSizeOptions={[5, 10, 25, 50]}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteConfirmation.isOpen}
        onClose={handleDeleteCancel}
        title="Delete Recording"
        description={
          deleteConfirmation.recording
            ? `Are you sure you want to permanently delete the recording "${deleteConfirmation.recording.name ?? 'Untitled Recording'}"? This action cannot be undone.`
            : ''
        }
        actions={deleteModalActions}
        maxWidth="sm"
        loading={deleteMutation.isPending}
      />
    </Box>
  );
};

export default BBBRecordingList;
