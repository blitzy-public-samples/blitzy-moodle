/**
 * RecordDetail Component
 *
 * React component for displaying individual database activity records with
 * formatted field values, metadata, action buttons, and support for custom
 * template rendering.
 *
 * Features:
 * - Displays all field values formatted according to their field types
 * - Shows record metadata (author, creation date, last modified, approval status)
 * - Supports actions: edit, delete, approve/disapprove based on permissions
 * - Navigation to previous/next records
 * - Template-based rendering if custom single template is defined
 * - Comments display if enabled for the database activity
 *
 * Based on Moodle's PHP implementation:
 * - public/mod/data/view.php
 * - public/mod/data/locallib.php
 * - public/mod/data/renderer.php
 *
 * @module features/activities/data/components/RecordDetail
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Grid,
  Typography,
  Button,
  IconButton,
  Chip,
  Box,
  Divider,
  Avatar,
  CircularProgress,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import {
  Edit,
  Delete,
  Check,
  Close,
  NavigateBefore,
  NavigateNext,
  Person,
  AccessTime,
  CheckCircle,
  Cancel,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// Internal imports
import { FieldRenderer } from '@/features/activities/data/components/FieldRenderer';
import { useRecord } from '@/features/activities/data/hooks/useRecord';
import { useDatabase } from '@/features/activities/data/hooks/useDatabase';
import {
  useDeleteRecord,
  useApproveRecord,
} from '@/features/activities/data/hooks/useDatabaseMutation';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import type { DatabaseField } from '@/features/activities/data/types/data.types';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the RecordDetail component
 */
export interface RecordDetailProps {
  /**
   * Database activity instance ID
   */
  databaseId: number;

  /**
   * Record ID to display
   */
  recordId: number;

  /**
   * Course ID for context-aware permission checking
   */
  courseId: number;

  /**
   * Course module ID for context-aware permission checking
   */
  cmid?: number;

  /**
   * Optional ID of the previous record (for navigation)
   */
  previousRecordId?: number;

  /**
   * Optional ID of the next record (for navigation)
   */
  nextRecordId?: number;

  /**
   * Optional callback when record is deleted
   */
  onRecordDeleted?: () => void;

  /**
   * Optional callback when record approval status changes
   */
  onApprovalChanged?: (recordId: number, approved: boolean) => void;

  /**
   * Optional callback when navigating to another record
   */
  onNavigate?: (recordId: number) => void;
}

/**
 * Field value entry for display
 */
interface FieldValueEntry {
  /**
   * Field definition
   */
  field: DatabaseField;

  /**
   * Field content value (may be undefined if no content)
   */
  value: string | undefined;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Date format for displaying timestamps
 */
const DATE_FORMAT = 'MMM dd, yyyy hh:mm a';

/**
 * Capability constants for permission checks
 */
const CAPABILITIES = {
  WRITE_ENTRY: 'mod/data:writeentry',
  MANAGE_ENTRIES: 'mod/data:manageentries',
  APPROVE: 'mod/data:approve',
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats a Unix timestamp to a human-readable date string.
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string or 'N/A' if timestamp is invalid
 */
function formatTimestamp(timestamp: number | undefined): string {
  if (!timestamp || timestamp === 0) {
    return 'N/A';
  }
  try {
    // Moodle timestamps are in seconds, Date expects milliseconds
    return format(new Date(timestamp * 1000), DATE_FORMAT);
  } catch {
    return 'Invalid date';
  }
}

/**
 * Builds the field values array by mapping field definitions to their content.
 *
 * @param fields - Array of field definitions
 * @param contents - Array of field content objects
 * @returns Array of field-value pairs for rendering
 */
function buildFieldValues(
  fields: DatabaseField[] | undefined,
  contents: Array<{ fieldid: number; content?: string }> | undefined
): FieldValueEntry[] {
  if (!fields || fields.length === 0) {
    return [];
  }

  return fields
    .slice() // Create a copy to avoid mutating
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((field) => {
      const content = contents?.find((c) => c.fieldid === field.id);
      return {
        field,
        value: content?.content,
      };
    });
}

/**
 * Parses a custom template and replaces field placeholders with rendered content.
 *
 * Moodle templates use placeholders like [[fieldname]] for field values
 * and ##tags## for special values like author, date, etc.
 *
 * @param template - Template HTML string
 * @param fieldValues - Array of field-value pairs
 * @param recordData - Full record data for metadata placeholders
 * @returns Parsed HTML string with replaced placeholders
 */
function parseTemplate(
  template: string,
  fieldValues: FieldValueEntry[],
  recordData: {
    user?: { fullname?: string };
    timecreated?: number;
    timemodified?: number;
    approved?: boolean;
  }
): string {
  let parsed = template;

  // Replace field placeholders [[fieldname]]
  fieldValues.forEach(({ field, value }) => {
    const placeholder = new RegExp(`\\[\\[${field.name}\\]\\]`, 'gi');
    // For template rendering, we use the raw value; actual rendering happens
    // via React components for rich content
    parsed = parsed.replace(placeholder, value ?? '');
  });

  // Replace special placeholders
  const specialReplacements: Record<string, string> = {
    '##user##': recordData.user?.fullname ?? 'Unknown',
    '##timeadded##': formatTimestamp(recordData.timecreated),
    '##timemodified##': formatTimestamp(recordData.timemodified),
    '##approve##': recordData.approved ? 'Approved' : 'Pending Approval',
  };

  Object.entries(specialReplacements).forEach(([placeholder, replacement]) => {
    parsed = parsed.replace(new RegExp(placeholder, 'gi'), replacement);
  });

  return parsed;
}

// ============================================================================
// Component
// ============================================================================

/**
 * RecordDetail Component
 *
 * Displays a single database record in detail view with all field values,
 * metadata, and action buttons based on user permissions.
 *
 * @param props - Component props
 * @returns React element displaying the record detail view
 *
 * @example
 * ```tsx
 * <RecordDetail
 *   databaseId={5}
 *   recordId={123}
 *   courseId={10}
 *   cmid={42}
 *   previousRecordId={122}
 *   nextRecordId={124}
 *   onRecordDeleted={() => navigate('/data/5')}
 * />
 * ```
 */
function RecordDetail({
  databaseId,
  recordId,
  courseId,
  cmid,
  previousRecordId,
  nextRecordId,
  onRecordDeleted,
  onApprovalChanged,
  onNavigate,
}: RecordDetailProps): React.ReactElement {
  // ============================================================================
  // Hooks
  // ============================================================================

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const { hasCapability } = usePermissions();

  // Fetch record data
  const {
    record,
    isLoading: isLoadingRecord,
    isError: isRecordError,
    error: recordError,
    isApproved,
    isPending,
    canEdit: recordCanEdit,
    canDelete: recordCanDelete,
  } = useRecord({ dataId: databaseId, recordId });

  // Fetch database configuration
  const {
    database,
    isLoading: isLoadingDatabase,
    isError: isDatabaseError,
    error: databaseError,
  } = useDatabase({ databaseId });

  // Mutations
  const deleteRecordMutation = useDeleteRecord();
  const approveRecordMutation = useApproveRecord();

  // ============================================================================
  // State
  // ============================================================================

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ============================================================================
  // Memoized Values
  // ============================================================================

  // Build permission context for capability checks
  const permissionContext = useMemo(
    () => ({
      type: 'module' as const,
      contextId: cmid ?? 0,
    }),
    [cmid]
  );

  // Determine if user can perform various actions
  const canEdit = useMemo(() => {
    // Use record-level permission if available, otherwise check capability
    if (recordCanEdit !== undefined) {
      return recordCanEdit;
    }
    return hasCapability(CAPABILITIES.WRITE_ENTRY, permissionContext);
  }, [recordCanEdit, hasCapability, permissionContext]);

  const canDelete = useMemo(() => {
    // Use record-level permission if available, otherwise check capability
    if (recordCanDelete !== undefined) {
      return recordCanDelete;
    }
    return hasCapability(CAPABILITIES.MANAGE_ENTRIES, permissionContext);
  }, [recordCanDelete, hasCapability, permissionContext]);

  const canApprove = useMemo(() => {
    // Check if user has approval capability and record has permissions info
    if (record?.permissions?.canApprove !== undefined) {
      return record.permissions.canApprove;
    }
    return hasCapability(CAPABILITIES.APPROVE, permissionContext);
  }, [record?.permissions?.canApprove, hasCapability, permissionContext]);

  // Build field values for display
  const fieldValues = useMemo(
    () => buildFieldValues(database?.fields, record?.contents),
    [database?.fields, record?.contents]
  );

  // Check if custom single template is defined
  const hasCustomTemplate = useMemo(
    () =>
      database?.singletemplate !== undefined &&
      database.singletemplate.trim().length > 0,
    [database?.singletemplate]
  );

  // Parse custom template if available
  const parsedTemplate = useMemo(() => {
    if (!hasCustomTemplate || !database?.singletemplate || !record) {
      return null;
    }
    return parseTemplate(database.singletemplate, fieldValues, {
      user: record.user,
      timecreated: record.timecreated,
      timemodified: record.timemodified,
      approved: record.approved,
    });
  }, [hasCustomTemplate, database?.singletemplate, fieldValues, record]);

  // Check if comments are enabled
  const commentsEnabled = useMemo(() => database?.comments === true, [database?.comments]);

  // Check if approval is required
  const approvalRequired = useMemo(() => database?.approval === true, [database?.approval]);

  // ============================================================================
  // Callbacks
  // ============================================================================

  /**
   * Handles navigation to the edit page for this record
   */
  const handleEdit = useCallback(() => {
    navigate(`/mod/data/${databaseId}/record/${recordId}/edit`);
  }, [navigate, databaseId, recordId]);

  /**
   * Opens the delete confirmation dialog
   */
  const handleDeleteClick = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  /**
   * Closes the delete confirmation dialog
   */
  const handleDeleteCancel = useCallback(() => {
    setDeleteDialogOpen(false);
  }, []);

  /**
   * Confirms and executes the record deletion
   */
  const handleDeleteConfirm = useCallback(async () => {
    try {
      await deleteRecordMutation.mutateAsync({
        databaseId,
        recordId,
      });

      success('Record deleted successfully');

      // Close dialog
      setDeleteDialogOpen(false);

      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['data', 'records'] });

      // Call callback if provided
      if (onRecordDeleted) {
        onRecordDeleted();
      } else {
        // Navigate back to list view
        navigate(`/mod/data/${databaseId}`);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to delete record';
      toastError(errorMessage);
    }
  }, [
    deleteRecordMutation,
    databaseId,
    recordId,
    success,
    toastError,
    queryClient,
    onRecordDeleted,
    navigate,
  ]);

  /**
   * Handles approving the record
   */
  const handleApprove = useCallback(async () => {
    try {
      await approveRecordMutation.mutateAsync({
        databaseId,
        recordId,
        approved: true,
      });

      success('Record approved');

      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['data', 'records'] });
      queryClient.invalidateQueries({
        queryKey: ['data', 'records', databaseId, recordId],
      });

      // Call callback if provided
      if (onApprovalChanged) {
        onApprovalChanged(recordId, true);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to approve record';
      toastError(errorMessage);
    }
  }, [
    approveRecordMutation,
    databaseId,
    recordId,
    success,
    toastError,
    queryClient,
    onApprovalChanged,
  ]);

  /**
   * Handles disapproving (unapproving) the record
   */
  const handleDisapprove = useCallback(async () => {
    try {
      await approveRecordMutation.mutateAsync({
        databaseId,
        recordId,
        approved: false,
      });

      success('Record disapproved');

      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['data', 'records'] });
      queryClient.invalidateQueries({
        queryKey: ['data', 'records', databaseId, recordId],
      });

      // Call callback if provided
      if (onApprovalChanged) {
        onApprovalChanged(recordId, false);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to disapprove record';
      toastError(errorMessage);
    }
  }, [
    approveRecordMutation,
    databaseId,
    recordId,
    success,
    toastError,
    queryClient,
    onApprovalChanged,
  ]);

  /**
   * Handles navigation to previous record
   */
  const handlePreviousRecord = useCallback(() => {
    if (previousRecordId) {
      if (onNavigate) {
        onNavigate(previousRecordId);
      } else {
        navigate(`/mod/data/${databaseId}/record/${previousRecordId}`);
      }
    }
  }, [previousRecordId, onNavigate, navigate, databaseId]);

  /**
   * Handles navigation to next record
   */
  const handleNextRecord = useCallback(() => {
    if (nextRecordId) {
      if (onNavigate) {
        onNavigate(nextRecordId);
      } else {
        navigate(`/mod/data/${databaseId}/record/${nextRecordId}`);
      }
    }
  }, [nextRecordId, onNavigate, navigate, databaseId]);

  // ============================================================================
  // Effects
  // ============================================================================

  // No side effects needed for this component currently

  // ============================================================================
  // Render Loading State
  // ============================================================================

  if (isLoadingRecord || isLoadingDatabase) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={200}
      >
        <CircularProgress />
      </Box>
    );
  }

  // ============================================================================
  // Render Error State
  // ============================================================================

  if (isRecordError || isDatabaseError) {
    const errorMsg =
      recordError?.message ||
      databaseError?.message ||
      'Failed to load record';
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {errorMsg}
      </Alert>
    );
  }

  // ============================================================================
  // Render No Data State
  // ============================================================================

  if (!record || !database) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Record not found
      </Alert>
    );
  }

  // ============================================================================
  // Render Custom Template
  // ============================================================================

  if (hasCustomTemplate && parsedTemplate) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardHeader
          avatar={
            record.user?.picture ? (
              <Avatar src={record.user.picture} alt={record.user.fullname} />
            ) : (
              <Avatar>
                <Person />
              </Avatar>
            )
          }
          title={record.user?.fullname || 'Unknown User'}
          subheader={
            <Box display="flex" alignItems="center" gap={1}>
              <AccessTime fontSize="small" />
              <Typography variant="caption">
                Created: {formatTimestamp(record.timecreated)}
              </Typography>
            </Box>
          }
          action={
            <Box display="flex" gap={1}>
              {approvalRequired && (
                <Chip
                  icon={isApproved ? <CheckCircle /> : <Cancel />}
                  label={isApproved ? 'Approved' : 'Pending Approval'}
                  color={isApproved ? 'success' : 'warning'}
                  size="small"
                />
              )}
            </Box>
          }
        />
        <CardContent>
          {/* Render parsed template HTML */}
          <Box
            dangerouslySetInnerHTML={{ __html: parsedTemplate }}
            sx={{
              '& img': { maxWidth: '100%', height: 'auto' },
              '& table': { width: '100%', borderCollapse: 'collapse' },
            }}
          />
        </CardContent>

        {/* Comments section if enabled */}
        {commentsEnabled && record.comments && record.comments.length > 0 && (
          <>
            <Divider />
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Comments ({record.comments.length})
              </Typography>
              {record.comments.map((comment) => (
                <Box key={comment.id} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">
                    {comment.userfullname}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatTimestamp(comment.timecreated)}
                  </Typography>
                  <Typography variant="body1">{comment.content}</Typography>
                </Box>
              ))}
            </CardContent>
          </>
        )}

        <Divider />
        <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1 }}>
          {/* Navigation buttons */}
          <Box>
            <Tooltip title="Previous record">
              <span>
                <IconButton
                  onClick={handlePreviousRecord}
                  disabled={!previousRecordId}
                  size="small"
                >
                  <NavigateBefore />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Next record">
              <span>
                <IconButton
                  onClick={handleNextRecord}
                  disabled={!nextRecordId}
                  size="small"
                >
                  <NavigateNext />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          {/* Action buttons */}
          <Box display="flex" gap={1}>
            {canApprove && approvalRequired && (
              <>
                {isPending && (
                  <Tooltip title="Approve this record">
                    <Button
                      variant="outlined"
                      color="success"
                      size="small"
                      startIcon={<Check />}
                      onClick={handleApprove}
                      disabled={approveRecordMutation.isPending}
                    >
                      Approve
                    </Button>
                  </Tooltip>
                )}
                {isApproved && (
                  <Tooltip title="Disapprove this record">
                    <Button
                      variant="outlined"
                      color="warning"
                      size="small"
                      startIcon={<Close />}
                      onClick={handleDisapprove}
                      disabled={approveRecordMutation.isPending}
                    >
                      Disapprove
                    </Button>
                  </Tooltip>
                )}
              </>
            )}
            {canEdit && (
              <Tooltip title="Edit this record">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Edit />}
                  onClick={handleEdit}
                >
                  Edit
                </Button>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title="Delete this record">
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<Delete />}
                  onClick={handleDeleteClick}
                >
                  Delete
                </Button>
              </Tooltip>
            )}
          </Box>
        </CardActions>

        {/* Delete confirmation dialog */}
        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          isDeleting={deleteRecordMutation.isPending}
        />
      </Card>
    );
  }

  // ============================================================================
  // Render Default Field-by-Field Layout
  // ============================================================================

  return (
    <Card sx={{ mb: 2 }}>
      {/* Card Header with user info and approval status */}
      <CardHeader
        avatar={
          record.user?.picture ? (
            <Avatar src={record.user.picture} alt={record.user.fullname} />
          ) : (
            <Avatar>
              <Person />
            </Avatar>
          )
        }
        title={record.user?.fullname || 'Unknown User'}
        subheader={
          <Box>
            <Box display="flex" alignItems="center" gap={0.5}>
              <AccessTime fontSize="small" />
              <Typography variant="caption">
                Created: {formatTimestamp(record.timecreated)}
              </Typography>
            </Box>
            {record.timemodified !== record.timecreated && (
              <Typography variant="caption" color="text.secondary">
                Modified: {formatTimestamp(record.timemodified)}
              </Typography>
            )}
          </Box>
        }
        action={
          <Box display="flex" gap={1} alignItems="center">
            {approvalRequired && (
              <Chip
                icon={isApproved ? <CheckCircle /> : <Cancel />}
                label={isApproved ? 'Approved' : 'Pending Approval'}
                color={isApproved ? 'success' : 'warning'}
                size="small"
              />
            )}
          </Box>
        }
      />

      <Divider />

      {/* Field values */}
      <CardContent>
        {fieldValues.length === 0 ? (
          <Typography color="text.secondary">
            No fields defined for this database
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {fieldValues.map(({ field, value }) => (
              <Grid item xs={12} sm={6} md={4} key={field.id}>
                <Box>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    gutterBottom
                  >
                    {field.name}
                    {field.required && (
                      <Typography
                        component="span"
                        color="error"
                        sx={{ ml: 0.5 }}
                      >
                        *
                      </Typography>
                    )}
                  </Typography>
                  <FieldRenderer field={field} value={value} mode="view" />
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>

      {/* Tags section if present */}
      {record.tags && record.tags.length > 0 && (
        <>
          <Divider />
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Tags
            </Typography>
            <Box display="flex" gap={0.5} flexWrap="wrap">
              {record.tags.map((tag) => (
                <Chip key={tag.id} label={tag.name} size="small" />
              ))}
            </Box>
          </CardContent>
        </>
      )}

      {/* Comments section if enabled */}
      {commentsEnabled && record.comments && record.comments.length > 0 && (
        <>
          <Divider />
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Comments ({record.comments.length})
            </Typography>
            {record.comments.map((comment) => (
              <Box
                key={comment.id}
                sx={{
                  mb: 2,
                  p: 2,
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                }}
              >
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="subtitle2">
                    {comment.userfullname}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatTimestamp(comment.timecreated)}
                  </Typography>
                </Box>
                <Typography variant="body2">{comment.content}</Typography>
              </Box>
            ))}
          </CardContent>
        </>
      )}

      {/* Rating section if present */}
      {record.rating && (
        <>
          <Divider />
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Rating
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              {record.rating.aggregate !== undefined && (
                <Typography variant="body2">
                  Average: {record.rating.aggregate.toFixed(1)}
                </Typography>
              )}
              {record.rating.count !== undefined && (
                <Typography variant="body2" color="text.secondary">
                  ({record.rating.count} ratings)
                </Typography>
              )}
            </Box>
          </CardContent>
        </>
      )}

      <Divider />

      {/* Action buttons and navigation */}
      <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1 }}>
        {/* Navigation buttons */}
        <Box>
          <Tooltip title="Previous record">
            <span>
              <IconButton
                onClick={handlePreviousRecord}
                disabled={!previousRecordId}
                size="small"
              >
                <NavigateBefore />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Next record">
            <span>
              <IconButton
                onClick={handleNextRecord}
                disabled={!nextRecordId}
                size="small"
              >
                <NavigateNext />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {/* Action buttons */}
        <Box display="flex" gap={1}>
          {canApprove && approvalRequired && (
            <>
              {isPending && (
                <Tooltip title="Approve this record">
                  <Button
                    variant="outlined"
                    color="success"
                    size="small"
                    startIcon={<Check />}
                    onClick={handleApprove}
                    disabled={approveRecordMutation.isPending}
                  >
                    Approve
                  </Button>
                </Tooltip>
              )}
              {isApproved && (
                <Tooltip title="Disapprove this record">
                  <Button
                    variant="outlined"
                    color="warning"
                    size="small"
                    startIcon={<Close />}
                    onClick={handleDisapprove}
                    disabled={approveRecordMutation.isPending}
                  >
                    Disapprove
                  </Button>
                </Tooltip>
              )}
            </>
          )}
          {canEdit && (
            <Tooltip title="Edit this record">
              <Button
                variant="outlined"
                size="small"
                startIcon={<Edit />}
                onClick={handleEdit}
              >
                Edit
              </Button>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title="Delete this record">
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<Delete />}
                onClick={handleDeleteClick}
              >
                Delete
              </Button>
            </Tooltip>
          )}
        </Box>
      </CardActions>

      {/* Delete confirmation dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteRecordMutation.isPending}
      />
    </Card>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Props for the DeleteConfirmationDialog component
 */
interface DeleteConfirmationDialogProps {
  /**
   * Whether the dialog is open
   */
  open: boolean;

  /**
   * Callback when dialog is cancelled
   */
  onCancel: () => void;

  /**
   * Callback when deletion is confirmed
   */
  onConfirm: () => void;

  /**
   * Whether deletion is in progress
   */
  isDeleting: boolean;
}

/**
 * Delete Confirmation Dialog Component
 *
 * Modal dialog for confirming record deletion.
 */
function DeleteConfirmationDialog({
  open,
  onCancel,
  onConfirm,
  isDeleting,
}: DeleteConfirmationDialogProps): React.ReactElement {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-description"
    >
      <DialogTitle id="delete-dialog-title">Delete Record</DialogTitle>
      <DialogContent>
        <DialogContentText id="delete-dialog-description">
          Are you sure you want to delete this record? This action cannot be
          undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          disabled={isDeleting}
          startIcon={isDeleting ? <CircularProgress size={16} /> : <Delete />}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Export
// ============================================================================

export default RecordDetail;
