/**
 * RoleList Component
 *
 * A comprehensive React component that displays Moodle system roles in a Material-UI
 * DataGrid with full sorting, filtering, and action capabilities. This component
 * provides administrators with a complete interface for viewing and managing roles.
 *
 * Features:
 * - DataGrid display with sortable columns (ID, Name, Shortname, Description, Sort Order)
 * - Action buttons for edit, delete, move up, and move down operations
 * - Delete confirmation dialog with role details and user count warning
 * - Loading skeleton states during data fetch
 * - Error handling with user-friendly messages
 * - Toast notifications for operation feedback
 * - WCAG 2.1 AA accessibility compliance with proper aria-labels
 * - Responsive design for mobile and desktop viewports
 * - Keyboard navigation support for all interactive elements
 *
 * Backend Integration:
 * - Uses useRoles hook for data fetching via React Query
 * - Supports callback props for action handling
 * - Integrates with Moodle's role management API endpoints
 *
 * Moodle Role System:
 * - Roles define sets of permissions (capabilities) assignable to users
 * - System roles (guest, user, frontpage) cannot be deleted
 * - Role sort order determines display priority and can be reordered
 * - Role archetypes provide default capability templates
 *
 * @module features/admin/roles/components/RoleList
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
  type GridRowParams,
  type GridSortModel,
  type GridFilterModel,
} from '@mui/x-data-grid';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Chip,
  Skeleton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  AdminPanelSettings as RoleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

import { useRoles } from '@/features/admin/roles/hooks/useRoles';
import type { Role } from '@/features/admin/roles/types/role.types';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props interface for the RoleList component
 *
 * Provides callback handlers for role management actions. All handlers are
 * optional to allow flexible integration with different parent components.
 */
export interface RoleListProps {
  /**
   * Callback fired when the edit action is triggered for a role.
   * Typically navigates to the role edit page or opens an edit modal.
   *
   * @param role - The role to edit
   */
  onEdit?: (role: Role) => void;

  /**
   * Callback fired when a role deletion is confirmed.
   * Should handle the API call to delete the role.
   * Returns a promise to allow the component to show loading state.
   *
   * @param role - The role to delete
   * @returns Promise that resolves when deletion is complete
   */
  onDelete?: (role: Role) => Promise<void>;

  /**
   * Callback fired when the move up action is triggered.
   * Should handle the API call to decrease the role's sort order.
   *
   * @param role - The role to move up
   * @returns Promise that resolves when the operation is complete
   */
  onMoveUp?: (role: Role) => Promise<void>;

  /**
   * Callback fired when the move down action is triggered.
   * Should handle the API call to increase the role's sort order.
   *
   * @param role - The role to move down
   * @returns Promise that resolves when the operation is complete
   */
  onMoveDown?: (role: Role) => Promise<void>;

  /**
   * Optional page size for pagination
   * @default 10
   */
  pageSize?: number;

  /**
   * Optional array of allowed page size options
   * @default [5, 10, 25, 50]
   */
  pageSizeOptions?: number[];

  /**
   * Whether to show the archetype column
   * @default true
   */
  showArchetype?: boolean;

  /**
   * Whether to auto-focus the DataGrid on mount
   * @default false
   */
  autoFocus?: boolean;
}

/**
 * Internal state for the delete confirmation dialog
 */
interface DeleteDialogState {
  /** Whether the dialog is open */
  open: boolean;
  /** The role being considered for deletion */
  role: Role | null;
  /** Whether the delete operation is in progress */
  isDeleting: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * System role shortnames that cannot be deleted
 *
 * These roles are essential for Moodle's operation and are protected from
 * deletion by both frontend and backend validation.
 */
const PROTECTED_ROLE_SHORTNAMES = ['guest', 'user', 'frontpage'];

/**
 * Default page size options for the DataGrid
 */
const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/**
 * Default page size
 */
const DEFAULT_PAGE_SIZE = 10;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if a role can be deleted based on its shortname
 *
 * System roles (guest, user, frontpage) are protected from deletion.
 *
 * @param role - The role to check
 * @returns True if the role can be deleted, false otherwise
 */
function canDeleteRole(role: Role): boolean {
  return !PROTECTED_ROLE_SHORTNAMES.includes(role.shortname.toLowerCase());
}

/**
 * Checks if a role can be moved up in the sort order
 *
 * @param role - The role to check
 * @param allRoles - All roles in the list
 * @returns True if the role can be moved up
 */
function canMoveUp(role: Role, allRoles: Role[]): boolean {
  if (!allRoles || allRoles.length === 0) return false;
  const sortedRoles = [...allRoles].sort((a, b) => a.sortorder - b.sortorder);
  const firstRole = sortedRoles[0];
  return role.sortorder !== firstRole?.sortorder;
}

/**
 * Checks if a role can be moved down in the sort order
 *
 * @param role - The role to check
 * @param allRoles - All roles in the list
 * @returns True if the role can be moved down
 */
function canMoveDown(role: Role, allRoles: Role[]): boolean {
  if (!allRoles || allRoles.length === 0) return false;
  const sortedRoles = [...allRoles].sort((a, b) => a.sortorder - b.sortorder);
  const lastRole = sortedRoles[sortedRoles.length - 1];
  return role.sortorder !== lastRole?.sortorder;
}

/**
 * Formats the role archetype for display
 *
 * @param archetype - The role archetype value
 * @returns Formatted archetype string
 */
function formatArchetype(archetype: string): string {
  if (!archetype) return 'Custom';

  const archetypeMap: Record<string, string> = {
    manager: 'Manager',
    coursecreator: 'Course Creator',
    editingteacher: 'Editing Teacher',
    teacher: 'Non-editing Teacher',
    student: 'Student',
    guest: 'Guest',
    user: 'Authenticated User',
    frontpage: 'Frontpage',
  };

  return archetypeMap[archetype] ?? archetype;
}

/**
 * Gets the appropriate color for an archetype chip
 *
 * @param archetype - The role archetype value
 * @returns MUI color for the chip
 */
function getArchetypeColor(
  archetype: string
): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
  const colorMap: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
    manager: 'error',
    coursecreator: 'warning',
    editingteacher: 'primary',
    teacher: 'info',
    student: 'success',
    guest: 'default',
    user: 'secondary',
    frontpage: 'default',
  };

  return colorMap[archetype] ?? 'default';
}

// ============================================================================
// Loading Skeleton Component
// ============================================================================

/**
 * Renders a loading skeleton that matches the DataGrid structure
 *
 * Provides visual feedback during data loading with animated placeholder rows.
 */
function LoadingSkeleton(): React.ReactElement {
  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      <Box sx={{ p: 2 }}>
        {/* Header skeleton */}
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            mb: 2,
            pb: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Skeleton variant="text" width={50} height={24} />
          <Skeleton variant="text" width={150} height={24} />
          <Skeleton variant="text" width={100} height={24} />
          <Skeleton variant="text" width={200} height={24} sx={{ flexGrow: 1 }} />
          <Skeleton variant="text" width={100} height={24} />
        </Box>

        {/* Row skeletons */}
        {Array.from({ length: 5 }).map((_, index) => (
          <Box
            key={`skeleton-row-${index}`}
            sx={{
              display: 'flex',
              gap: 2,
              py: 1.5,
              borderBottom: index < 4 ? 1 : 0,
              borderColor: 'divider',
            }}
          >
            <Skeleton variant="text" width={50} height={24} />
            <Skeleton variant="text" width={150} height={24} />
            <Skeleton variant="text" width={100} height={24} />
            <Skeleton variant="text" width={200} height={24} sx={{ flexGrow: 1 }} />
            <Skeleton variant="rectangular" width={140} height={32} />
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * RoleList Component
 *
 * Displays a list of Moodle roles in a Material-UI DataGrid with comprehensive
 * management capabilities including viewing, editing, deleting, and reordering.
 *
 * @param props - Component props
 * @returns React element
 *
 * @example
 * ```tsx
 * function RoleManagementPage() {
 *   const navigate = useNavigate();
 *
 *   const handleEdit = (role: Role) => {
 *     navigate(`/admin/roles/${role.id}/edit`);
 *   };
 *
 *   const handleDelete = async (role: Role) => {
 *     await deleteRoleApi(role.id);
 *   };
 *
 *   return (
 *     <RoleList
 *       onEdit={handleEdit}
 *       onDelete={handleDelete}
 *     />
 *   );
 * }
 * ```
 */
function RoleList({
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  pageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  showArchetype = true,
  autoFocus = false,
}: RoleListProps): React.ReactElement {
  // ============================================================================
  // Hooks
  // ============================================================================

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // Fetch roles data using the useRoles hook
  const { roles, isLoadingRoles, rolesError } = useRoles();

  // Toast notifications for user feedback
  const { success, error: showError } = useToast();

  // ============================================================================
  // State
  // ============================================================================

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    role: null,
    isDeleting: false,
  });

  // DataGrid pagination state
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize,
  });

  // Sorting state
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'sortorder', sort: 'asc' },
  ]);

  // Filter state
  const [filterModel, setFilterModel] = useState<GridFilterModel>({
    items: [],
  });

  // ============================================================================
  // Memoized Data
  // ============================================================================

  // Sort roles by sortorder for move up/down logic
  const sortedRoles = useMemo(() => {
    if (!roles) return [];
    return [...roles].sort((a, b) => a.sortorder - b.sortorder);
  }, [roles]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handles the edit action for a role
   *
   * @param role - The role to edit
   */
  const handleEdit = useCallback(
    (role: Role) => {
      if (onEdit) {
        onEdit(role);
      } else {
        // Fallback: Log warning for development
        console.warn(
          `Edit action triggered for role "${role.name}" (ID: ${role.id}), but no onEdit handler provided.`
        );
      }
    },
    [onEdit]
  );

  /**
   * Opens the delete confirmation dialog for a role
   *
   * @param role - The role to potentially delete
   */
  const handleDeleteClick = useCallback((role: Role) => {
    setDeleteDialog({
      open: true,
      role,
      isDeleting: false,
    });
  }, []);

  /**
   * Closes the delete confirmation dialog
   */
  const handleDeleteCancel = useCallback(() => {
    setDeleteDialog({
      open: false,
      role: null,
      isDeleting: false,
    });
  }, []);

  /**
   * Confirms and executes the role deletion
   */
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteDialog.role) return;

    setDeleteDialog((prev) => ({ ...prev, isDeleting: true }));

    try {
      if (onDelete) {
        await onDelete(deleteDialog.role);
        success(`Role "${deleteDialog.role.name}" has been deleted successfully.`);
      } else {
        // Fallback: Log warning for development
        console.warn(
          `Delete action confirmed for role "${deleteDialog.role.name}" (ID: ${deleteDialog.role.id}), but no onDelete handler provided.`
        );
        showError('Delete operation is not configured. Please contact your administrator.');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unexpected error occurred while deleting the role.';
      showError(errorMessage);
      console.error('Failed to delete role:', err);
    } finally {
      setDeleteDialog({
        open: false,
        role: null,
        isDeleting: false,
      });
    }
  }, [deleteDialog.role, onDelete, success, showError]);

  /**
   * Handles the move up action for a role
   *
   * @param role - The role to move up
   */
  const handleMoveUp = useCallback(
    async (role: Role) => {
      if (!canMoveUp(role, sortedRoles)) return;

      try {
        if (onMoveUp) {
          await onMoveUp(role);
          success(`Role "${role.name}" has been moved up.`);
        } else {
          console.warn(
            `Move up action triggered for role "${role.name}" (ID: ${role.id}), but no onMoveUp handler provided.`
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to move role up.';
        showError(errorMessage);
        console.error('Failed to move role up:', err);
      }
    },
    [sortedRoles, onMoveUp, success, showError]
  );

  /**
   * Handles the move down action for a role
   *
   * @param role - The role to move down
   */
  const handleMoveDown = useCallback(
    async (role: Role) => {
      if (!canMoveDown(role, sortedRoles)) return;

      try {
        if (onMoveDown) {
          await onMoveDown(role);
          success(`Role "${role.name}" has been moved down.`);
        } else {
          console.warn(
            `Move down action triggered for role "${role.name}" (ID: ${role.id}), but no onMoveDown handler provided.`
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to move role down.';
        showError(errorMessage);
        console.error('Failed to move role down:', err);
      }
    },
    [sortedRoles, onMoveDown, success, showError]
  );

  // ============================================================================
  // Column Definitions
  // ============================================================================

  /**
   * DataGrid column definitions with accessibility labels and responsive sizing
   */
  const columns: GridColDef<Role>[] = useMemo(() => {
    const baseColumns: GridColDef<Role>[] = [
      {
        field: 'id',
        headerName: 'ID',
        width: 70,
        type: 'number',
        sortable: true,
        filterable: true,
        description: 'Unique identifier for the role',
      },
      {
        field: 'name',
        headerName: 'Role Name',
        flex: 1,
        minWidth: 150,
        sortable: true,
        filterable: true,
        description: 'Display name of the role',
        renderCell: (params: GridRenderCellParams<Role>) => (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              overflow: 'hidden',
            }}
          >
            <RoleIcon
              fontSize="small"
              color="action"
              aria-hidden="true"
            />
            <Typography
              variant="body2"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {params.value || 'Unnamed Role'}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'shortname',
        headerName: 'Short Name',
        width: 130,
        sortable: true,
        filterable: true,
        description: 'Unique identifier used in code and URLs',
        renderCell: (params: GridRenderCellParams<Role>) => (
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              backgroundColor: 'action.hover',
              px: 1,
              py: 0.5,
              borderRadius: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {params.value}
          </Typography>
        ),
      },
      {
        field: 'description',
        headerName: 'Description',
        flex: 2,
        minWidth: 200,
        sortable: false,
        filterable: true,
        description: 'Description of the role and its purpose',
        renderCell: (params: GridRenderCellParams<Role>) => {
          // Strip HTML tags from description for display
          const plainText = params.value
            ? String(params.value).replace(/<[^>]*>/g, '')
            : 'No description';
          return (
            <Tooltip title={plainText} arrow>
              <Typography
                variant="body2"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: params.value ? 'text.primary' : 'text.secondary',
                }}
              >
                {plainText}
              </Typography>
            </Tooltip>
          );
        },
      },
      {
        field: 'sortorder',
        headerName: 'Order',
        width: 80,
        type: 'number',
        sortable: true,
        filterable: false,
        description: 'Display order of the role in lists',
        align: 'center',
        headerAlign: 'center',
      },
    ];

    // Add archetype column if enabled
    if (showArchetype) {
      baseColumns.splice(4, 0, {
        field: 'archetype',
        headerName: 'Type',
        width: 150,
        sortable: true,
        filterable: true,
        description: 'Role archetype determining default capabilities',
        renderCell: (params: GridRenderCellParams<Role>) => (
          <Chip
            label={formatArchetype(params.value as string)}
            size="small"
            color={getArchetypeColor(params.value as string)}
            variant="outlined"
          />
        ),
      });
    }

    // Add actions column
    baseColumns.push({
      field: 'actions',
      headerName: 'Actions',
      width: isMobile ? 100 : 180,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      description: 'Available actions for this role',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams<Role>) => {
        const role = params.row;
        const isProtected = !canDeleteRole(role);
        const isFirst = !canMoveUp(role, sortedRoles);
        const isLast = !canMoveDown(role, sortedRoles);

        return (
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              justifyContent: 'center',
            }}
            role="group"
            aria-label={`Actions for role ${role.name}`}
          >
            {/* Move Up Button */}
            <Tooltip title={isFirst ? 'Already at top' : 'Move up'}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => handleMoveUp(role)}
                  disabled={isFirst}
                  aria-label={`Move role ${role.name} up in order`}
                  sx={{
                    '&:focus': {
                      outline: `2px solid ${theme.palette.primary.main}`,
                      outlineOffset: 2,
                    },
                  }}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>

            {/* Move Down Button */}
            <Tooltip title={isLast ? 'Already at bottom' : 'Move down'}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => handleMoveDown(role)}
                  disabled={isLast}
                  aria-label={`Move role ${role.name} down in order`}
                  sx={{
                    '&:focus': {
                      outline: `2px solid ${theme.palette.primary.main}`,
                      outlineOffset: 2,
                    },
                  }}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>

            {/* Edit Button */}
            <Tooltip title="Edit role">
              <IconButton
                size="small"
                onClick={() => handleEdit(role)}
                aria-label={`Edit role ${role.name}`}
                color="primary"
                sx={{
                  '&:focus': {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: 2,
                  },
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Delete Button */}
            <Tooltip
              title={
                isProtected
                  ? `System role "${role.shortname}" cannot be deleted`
                  : 'Delete role'
              }
            >
              <span>
                <IconButton
                  size="small"
                  onClick={() => handleDeleteClick(role)}
                  disabled={isProtected}
                  aria-label={
                    isProtected
                      ? `Cannot delete system role ${role.name}`
                      : `Delete role ${role.name}`
                  }
                  color="error"
                  sx={{
                    '&:focus': {
                      outline: `2px solid ${theme.palette.error.main}`,
                      outlineOffset: 2,
                    },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        );
      },
    });

    return baseColumns;
  }, [
    showArchetype,
    isMobile,
    sortedRoles,
    theme.palette.primary.main,
    theme.palette.error.main,
    handleEdit,
    handleDeleteClick,
    handleMoveUp,
    handleMoveDown,
  ]);

  // ============================================================================
  // Render: Loading State
  // ============================================================================

  if (isLoadingRoles) {
    return (
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
        aria-busy="true"
        aria-label="Loading roles list"
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 1,
          }}
        >
          <CircularProgress size={24} aria-hidden="true" />
          <Typography variant="body2" color="text.secondary">
            Loading roles...
          </Typography>
        </Box>
        <LoadingSkeleton />
      </Box>
    );
  }

  // ============================================================================
  // Render: Error State
  // ============================================================================

  if (rolesError) {
    return (
      <Alert
        severity="error"
        sx={{ width: '100%' }}
        role="alert"
        aria-live="assertive"
      >
        <Typography variant="subtitle2" component="div" gutterBottom>
          Failed to load roles
        </Typography>
        <Typography variant="body2">
          {rolesError.message || 'An unexpected error occurred. Please try again later.'}
        </Typography>
      </Alert>
    );
  }

  // ============================================================================
  // Render: Empty State
  // ============================================================================

  if (!roles || roles.length === 0) {
    return (
      <Alert
        severity="info"
        sx={{ width: '100%' }}
        role="status"
      >
        <Typography variant="body2">
          No roles found. Roles are typically created during Moodle installation.
        </Typography>
      </Alert>
    );
  }

  // ============================================================================
  // Render: Main Content
  // ============================================================================

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {/* DataGrid Container */}
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <DataGrid
          rows={roles}
          columns={columns}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={pageSizeOptions}
          sortModel={sortModel}
          onSortModelChange={setSortModel}
          filterModel={filterModel}
          onFilterModelChange={setFilterModel}
          disableRowSelectionOnClick
          autoHeight
          density={isTablet ? 'compact' : 'standard'}
          getRowId={(row: Role) => row.id}
          initialState={{
            sorting: {
              sortModel: [{ field: 'sortorder', sort: 'asc' }],
            },
          }}
          sx={{
            '& .MuiDataGrid-cell:focus': {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: -2,
            },
            '& .MuiDataGrid-cell:focus-within': {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: -2,
            },
            '& .MuiDataGrid-columnHeader:focus': {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: -2,
            },
            '& .MuiDataGrid-columnHeader:focus-within': {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: -2,
            },
            border: 'none',
          }}
          aria-label="Roles list"
          tabIndex={autoFocus ? 0 : -1}
          slots={{
            noRowsOverlay: () => (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  p: 3,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  No roles found matching your criteria.
                </Typography>
              </Box>
            ),
          }}
        />
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-role-dialog-title"
        aria-describedby="delete-role-dialog-description"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          id="delete-role-dialog-title"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <WarningIcon color="warning" aria-hidden="true" />
          Confirm Role Deletion
        </DialogTitle>
        <DialogContent>
          <DialogContentText
            id="delete-role-dialog-description"
            component="div"
          >
            {deleteDialog.role && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body1">
                  Are you sure you want to delete the following role?
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{ p: 2 }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Name:
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {deleteDialog.role.name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Short name:
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          backgroundColor: 'action.hover',
                          px: 1,
                          borderRadius: 0.5,
                        }}
                      >
                        {deleteDialog.role.shortname}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        ID:
                      </Typography>
                      <Typography variant="body2">
                        {deleteDialog.role.id}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
                <Alert severity="warning" icon={<WarningIcon />}>
                  <Typography variant="body2">
                    <strong>Warning:</strong> Deleting this role will remove all role
                    assignments for users with this role. Users will lose any permissions
                    granted by this role. This action cannot be undone.
                  </Typography>
                </Alert>
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleDeleteCancel}
            disabled={deleteDialog.isDeleting}
            variant="outlined"
            aria-label="Cancel deletion"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            disabled={deleteDialog.isDeleting}
            variant="contained"
            color="error"
            startIcon={
              deleteDialog.isDeleting ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <DeleteIcon />
              )
            }
            aria-label={
              deleteDialog.isDeleting
                ? 'Deleting role...'
                : `Confirm deletion of role ${deleteDialog.role?.name}`
            }
          >
            {deleteDialog.isDeleting ? 'Deleting...' : 'Delete Role'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ============================================================================
// Export
// ============================================================================

export default RoleList;
