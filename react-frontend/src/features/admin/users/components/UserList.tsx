/**
 * UserList Component
 *
 * React component that displays a paginated list of users using Material-UI DataGrid
 * with sorting, filtering, and search capabilities. Fetches user data from the API
 * with React Query, supports role-based filtering, status filtering (active/suspended/deleted),
 * and provides action buttons for viewing, editing, suspending, and deleting individual
 * users based on permissions.
 *
 * Features:
 * - Material-UI DataGrid for displaying paginated user data
 * - Server-side pagination with React Query
 * - Column sorting (username, email, first name, last name, last access, auth method)
 * - Filtering by role, status (active/suspended/deleted), and authentication method
 * - Search functionality for username, email, first name, last name
 * - Action buttons per row based on user permissions:
 *   - View profile
 *   - Edit user
 *   - Suspend/unsuspend account
 *   - Delete user
 *   - Unlock account
 *   - Resend confirmation email
 * - Row selection for bulk actions integration
 * - Loading, error, and empty state handling
 * - Confirmation modals for destructive actions
 *
 * Based on PHP source: public/admin/user.php
 *
 * @package react-frontend
 * @subpackage features/admin/users/components
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  DataGrid,
  type GridColDef,
  type GridRowSelectionModel,
  type GridSortModel,
  type GridRenderCellParams,
  type GridPaginationModel,
} from '@mui/x-data-grid';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Typography,
  InputAdornment,
  Button,
} from '@mui/material';
import {
  Edit,
  Delete,
  Visibility,
  Block,
  CheckCircle,
  LockOpen,
  Email,
  Search,
  Refresh,
  PersonAdd,
  PersonOff,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format, fromUnixTime } from 'date-fns';

// Internal imports
import { useUserManagement } from '../hooks/useUserManagement';
import { useUserMutations } from '../hooks/useUserMutations';
import type { User } from '../types/user.types';
import { UserFilterStatus } from '../types/user-list.types';
import { usePermissions } from '@/hooks/usePermissions';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Alert } from '@/components/feedback/Alert';
import { Modal } from '@/components/feedback/Modal';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Filter status options matching Moodle user status states
 */
type UserStatusFilter = 'all' | 'active' | 'suspended' | 'deleted';

/**
 * Confirmation modal state for destructive actions
 */
interface ConfirmationModalState {
  open: boolean;
  action: 'delete' | 'suspend' | 'unsuspend' | 'confirm' | 'resend' | 'unlock' | null;
  user: User | null;
}

/**
 * Props interface for UserList component
 */
export interface UserListProps {
  /**
   * Callback when users are selected for bulk actions
   * @param userIds - Array of selected user IDs
   */
  onSelectionChange?: (userIds: number[]) => void;

  /**
   * Initial page size for pagination
   * @default 20
   */
  initialPageSize?: number;

  /**
   * Whether to enable row selection for bulk actions
   * @default true
   */
  enableSelection?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Status filter options for the dropdown
 */
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Users' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'deleted', label: 'Deleted' },
] as const;

/**
 * Common authentication methods in Moodle
 */
const AUTH_METHOD_OPTIONS = [
  { value: '', label: 'All Authentication Methods' },
  { value: 'manual', label: 'Manual' },
  { value: 'ldap', label: 'LDAP' },
  { value: 'oauth2', label: 'OAuth2' },
  { value: 'shibboleth', label: 'Shibboleth' },
  { value: 'email', label: 'Email' },
  { value: 'nologin', label: 'No Login' },
] as const;

/**
 * Page size options for the DataGrid
 */
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format Unix timestamp to human-readable date string
 * Returns 'Never' if timestamp is 0 or undefined
 *
 * @param timestamp - Unix timestamp
 * @returns Formatted date string or 'Never'
 */
function formatLastAccess(timestamp: number | undefined | null): string {
  if (!timestamp || timestamp === 0) {
    return 'Never';
  }
  try {
    return format(fromUnixTime(timestamp), 'yyyy-MM-dd HH:mm');
  } catch {
    return 'Invalid date';
  }
}

/**
 * Get user's full name
 *
 * @param user - User object
 * @returns Full name string
 */
function getFullName(user: User): string {
  return `${user.firstname} ${user.lastname}`.trim() || user.username;
}

/**
 * Determine user status chip color and label
 *
 * @param user - User object
 * @returns Object with color and label for status chip
 */
function getUserStatusInfo(user: User): { color: 'success' | 'error' | 'warning' | 'default'; label: string } {
  if (user.deleted) {
    return { color: 'error', label: 'Deleted' };
  }
  if (user.suspended) {
    return { color: 'warning', label: 'Suspended' };
  }
  if (!user.confirmed) {
    return { color: 'default', label: 'Unconfirmed' };
  }
  return { color: 'success', label: 'Active' };
}

// ============================================================================
// UserList Component
// ============================================================================

/**
 * UserList Component
 *
 * Displays a paginated, sortable, filterable list of users with action buttons.
 * Integrates with React Query for server-side data management and provides
 * a comprehensive admin interface for user management.
 *
 * @param props - Component props
 * @returns React element
 */
export function UserList({
  onSelectionChange,
  initialPageSize = 20,
  enableSelection = true,
}: UserListProps): React.ReactElement {
  // ============================================================================
  // Hooks
  // ============================================================================

  const navigate = useNavigate();
  const { hasCapability, isAdmin } = usePermissions();

  // User management hook for fetching and filtering users
  const {
    users,
    totalCount,
    isLoading,
    isFetching,
    error,
    page,
    perPage,
    sortBy,
    sortOrder,
    goToPage,
    setPerPage,
    changeSortOrder,
    setSearch,
    setStatus,
    setAuthMethod,
    resetFilters,
    refetch,
  } = useUserManagement({
    initialPerPage: initialPageSize,
  });

  // User mutations for CRUD operations
  const {
    deleteUser,
    suspendUser,
    unsuspendUser,
    unlockUser,
    confirmUser,
    resendConfirmationEmail,
  } = useUserMutations();

  // ============================================================================
  // Local State
  // ============================================================================

  // Search input state (debounced in useUserManagement)
  const [searchInput, setSearchInput] = useState<string>('');

  // Filter states
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');
  const [authMethodFilter, setAuthMethodFilter] = useState<string>('');

  // Row selection state
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>([]);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<ConfirmationModalState>({
    open: false,
    action: null,
    user: null,
  });

  // ============================================================================
  // Permission Checks
  // ============================================================================

  const canUpdateUser = useCallback(
    () => hasCapability('moodle/user:update') || isAdmin,
    [hasCapability, isAdmin]
  );

  const canDeleteUser = useCallback(
    () => hasCapability('moodle/user:delete') || isAdmin,
    [hasCapability, isAdmin]
  );

  const canCreateUser = useCallback(
    () => hasCapability('moodle/user:create') || isAdmin,
    [hasCapability, isAdmin]
  );

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle search input change with debounce
   */
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchInput(value);
      setSearch(value);
    },
    [setSearch]
  );

  /**
   * Handle status filter change
   */
  const handleStatusFilterChange = useCallback(
    (event: React.ChangeEvent<{ value: unknown }> | { target: { value: unknown } }) => {
      const value = event.target.value as UserStatusFilter;
      setStatusFilter(value);

      // Map status filter to API parameters using enum
      const statusMap: Record<UserStatusFilter, UserFilterStatus | undefined> = {
        all: undefined,
        active: UserFilterStatus.ACTIVE,
        suspended: UserFilterStatus.SUSPENDED,
        deleted: UserFilterStatus.DELETED,
      };
      setStatus(statusMap[value]);
    },
    [setStatus]
  );

  /**
   * Handle authentication method filter change
   */
  const handleAuthMethodFilterChange = useCallback(
    (event: React.ChangeEvent<{ value: unknown }> | { target: { value: unknown } }) => {
      const value = event.target.value as string;
      setAuthMethodFilter(value);
      setAuthMethod(value || undefined);
    },
    [setAuthMethod]
  );

  /**
   * Handle reset filters button click
   */
  const handleResetFilters = useCallback(() => {
    setSearchInput('');
    setStatusFilter('all');
    setAuthMethodFilter('');
    resetFilters();
  }, [resetFilters]);

  /**
   * Handle DataGrid sort model change
   */
  const handleSortModelChange = useCallback(
    (model: GridSortModel) => {
      const firstItem = model[0];
      if (firstItem) {
        // Map DataGrid field to API sort field
        changeSortOrder(firstItem.field as typeof sortBy);
      }
    },
    [changeSortOrder]
  );

  /**
   * Handle DataGrid pagination model change
   */
  const handlePaginationModelChange = useCallback(
    (model: GridPaginationModel) => {
      // DataGrid uses 0-based page index, API uses 1-based
      goToPage(model.page + 1);
      setPerPage(model.pageSize);
    },
    [goToPage, setPerPage]
  );

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
   * Navigate to user profile page
   */
  const handleViewUser = useCallback(
    (user: User) => {
      navigate(`/admin/users/${user.id}`);
    },
    [navigate]
  );

  /**
   * Navigate to user edit page
   */
  const handleEditUser = useCallback(
    (user: User) => {
      navigate(`/admin/users/${user.id}/edit`);
    },
    [navigate]
  );

  /**
   * Open confirmation modal for delete action
   */
  const handleDeleteClick = useCallback((user: User) => {
    setConfirmModal({
      open: true,
      action: 'delete',
      user,
    });
  }, []);

  /**
   * Open confirmation modal for suspend action
   */
  const handleSuspendClick = useCallback((user: User) => {
    setConfirmModal({
      open: true,
      action: user.suspended ? 'unsuspend' : 'suspend',
      user,
    });
  }, []);

  /**
   * Handle unlock user action (no confirmation needed)
   */
  const handleUnlockClick = useCallback(
    (user: User) => {
      unlockUser.mutate({
        userId: user.id,
        userName: getFullName(user),
      });
    },
    [unlockUser]
  );

  /**
   * Open confirmation modal for confirm user action
   */
  const handleConfirmClick = useCallback((user: User) => {
    setConfirmModal({
      open: true,
      action: 'confirm',
      user,
    });
  }, []);

  /**
   * Open confirmation modal for resend email action
   */
  const handleResendEmailClick = useCallback((user: User) => {
    setConfirmModal({
      open: true,
      action: 'resend',
      user,
    });
  }, []);

  /**
   * Close confirmation modal
   */
  const handleCloseModal = useCallback(() => {
    setConfirmModal({
      open: false,
      action: null,
      user: null,
    });
  }, []);

  /**
   * Execute confirmed action
   */
  const handleConfirmAction = useCallback(() => {
    const { action, user } = confirmModal;
    if (!user) return;

    const userName = getFullName(user);

    switch (action) {
      case 'delete':
        deleteUser.mutate({ userId: user.id, userName });
        break;
      case 'suspend':
        suspendUser.mutate({ userId: user.id, userName });
        break;
      case 'unsuspend':
        unsuspendUser.mutate({ userId: user.id, userName });
        break;
      case 'confirm':
        confirmUser.mutate({ userId: user.id, userName });
        break;
      case 'resend':
        resendConfirmationEmail.mutate({ userId: user.id, userName });
        break;
      default:
        break;
    }

    handleCloseModal();
  }, [
    confirmModal,
    deleteUser,
    suspendUser,
    unsuspendUser,
    confirmUser,
    resendConfirmationEmail,
    handleCloseModal,
  ]);

  /**
   * Navigate to create user page
   */
  const handleCreateUser = useCallback(() => {
    navigate('/admin/users/new');
  }, [navigate]);

  // ============================================================================
  // Memoized Column Definitions
  // ============================================================================

  const columns: GridColDef<User>[] = useMemo(
    () => [
      {
        field: 'username',
        headerName: 'Username',
        flex: 1,
        minWidth: 120,
        sortable: true,
      },
      {
        field: 'email',
        headerName: 'Email',
        flex: 1.5,
        minWidth: 180,
        sortable: true,
      },
      {
        field: 'firstname',
        headerName: 'First Name',
        flex: 1,
        minWidth: 100,
        sortable: true,
      },
      {
        field: 'lastname',
        headerName: 'Last Name',
        flex: 1,
        minWidth: 100,
        sortable: true,
      },
      {
        field: 'auth',
        headerName: 'Auth Method',
        width: 120,
        sortable: true,
        renderCell: (params: GridRenderCellParams<User>) => (
          <Chip
            label={params.value || 'unknown'}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 120,
        sortable: false,
        renderCell: (params: GridRenderCellParams<User>) => {
          const statusInfo = getUserStatusInfo(params.row);
          return (
            <Chip
              label={statusInfo.label}
              color={statusInfo.color}
              size="small"
            />
          );
        },
      },
      {
        field: 'confirmed',
        headerName: 'Confirmed',
        width: 100,
        sortable: true,
        renderCell: (params: GridRenderCellParams<User>) => (
          <Chip
            label={params.row.confirmed ? 'Yes' : 'No'}
            color={params.row.confirmed ? 'success' : 'default'}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: 'lastaccess',
        headerName: 'Last Access',
        width: 150,
        sortable: true,
        renderCell: (params: GridRenderCellParams<User>) => (
          <Typography variant="body2" color="textSecondary">
            {formatLastAccess(params.row.lastaccess)}
          </Typography>
        ),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 220,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams<User>) => {
          const user = params.row;
          const isDeleted = user.deleted === 1;
          const isSuspended = user.suspended === 1;
          const isConfirmed = user.confirmed === 1;

          return (
            <Stack direction="row" spacing={0.5} alignItems="center">
              {/* View Profile Button */}
              <Tooltip title="View Profile">
                <IconButton
                  size="small"
                  onClick={() => handleViewUser(user)}
                  aria-label={`View profile of ${getFullName(user)}`}
                >
                  <Visibility fontSize="small" />
                </IconButton>
              </Tooltip>

              {/* Edit User Button */}
              {canUpdateUser() && !isDeleted && (
                <Tooltip title="Edit User">
                  <IconButton
                    size="small"
                    onClick={() => handleEditUser(user)}
                    aria-label={`Edit ${getFullName(user)}`}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              {/* Suspend/Unsuspend Button */}
              {canUpdateUser() && !isDeleted && (
                <Tooltip title={isSuspended ? 'Unsuspend User' : 'Suspend User'}>
                  <IconButton
                    size="small"
                    onClick={() => handleSuspendClick(user)}
                    color={isSuspended ? 'success' : 'warning'}
                    aria-label={
                      isSuspended
                        ? `Unsuspend ${getFullName(user)}`
                        : `Suspend ${getFullName(user)}`
                    }
                  >
                    {isSuspended ? <PersonAdd fontSize="small" /> : <Block fontSize="small" />}
                  </IconButton>
                </Tooltip>
              )}

              {/* Unlock Account Button */}
              {canUpdateUser() && !isDeleted && !isSuspended && (
                <Tooltip title="Unlock Account">
                  <IconButton
                    size="small"
                    onClick={() => handleUnlockClick(user)}
                    aria-label={`Unlock account of ${getFullName(user)}`}
                  >
                    <LockOpen fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              {/* Confirm User Button (for unconfirmed users) */}
              {canUpdateUser() && !isDeleted && !isConfirmed && (
                <Tooltip title="Confirm User">
                  <IconButton
                    size="small"
                    onClick={() => handleConfirmClick(user)}
                    color="success"
                    aria-label={`Confirm ${getFullName(user)}`}
                  >
                    <CheckCircle fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              {/* Resend Confirmation Email Button (for unconfirmed users) */}
              {canUpdateUser() && !isDeleted && !isConfirmed && (
                <Tooltip title="Resend Confirmation Email">
                  <IconButton
                    size="small"
                    onClick={() => handleResendEmailClick(user)}
                    color="info"
                    aria-label={`Resend confirmation email to ${getFullName(user)}`}
                  >
                    <Email fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              {/* Delete User Button */}
              {canDeleteUser() && !isDeleted && (
                <Tooltip title="Delete User">
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteClick(user)}
                    color="error"
                    aria-label={`Delete ${getFullName(user)}`}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          );
        },
      },
    ],
    [
      canUpdateUser,
      canDeleteUser,
      handleViewUser,
      handleEditUser,
      handleSuspendClick,
      handleUnlockClick,
      handleConfirmClick,
      handleResendEmailClick,
      handleDeleteClick,
    ]
  );

  // ============================================================================
  // Memoized Sort Model
  // ============================================================================

  const sortModel: GridSortModel = useMemo(() => {
    return [
      {
        field: sortBy,
        sort: sortOrder === 'asc' ? 'asc' : 'desc',
      },
    ];
  }, [sortBy, sortOrder]);

  // ============================================================================
  // Memoized Pagination Model
  // ============================================================================

  const paginationModel: GridPaginationModel = useMemo(() => ({
    page: page - 1, // DataGrid uses 0-based page index
    pageSize: perPage,
  }), [page, perPage]);

  // ============================================================================
  // Modal Content Generation
  // ============================================================================

  const getModalContent = useCallback(() => {
    const { action, user } = confirmModal;
    if (!user) return { title: '', message: '', confirmLabel: '', confirmColor: 'primary' as const };

    const userName = getFullName(user);

    switch (action) {
      case 'delete':
        return {
          title: 'Delete User',
          message: `Are you sure you want to delete "${userName}"? This action cannot be easily undone.`,
          confirmLabel: 'Delete',
          confirmColor: 'error' as const,
        };
      case 'suspend':
        return {
          title: 'Suspend User',
          message: `Are you sure you want to suspend "${userName}"? They will be logged out and unable to access the site.`,
          confirmLabel: 'Suspend',
          confirmColor: 'warning' as const,
        };
      case 'unsuspend':
        return {
          title: 'Unsuspend User',
          message: `Are you sure you want to unsuspend "${userName}"? They will be able to log in again.`,
          confirmLabel: 'Unsuspend',
          confirmColor: 'success' as const,
        };
      case 'confirm':
        return {
          title: 'Confirm User',
          message: `Are you sure you want to manually confirm "${userName}"? This will skip email verification.`,
          confirmLabel: 'Confirm',
          confirmColor: 'success' as const,
        };
      case 'resend':
        return {
          title: 'Resend Confirmation Email',
          message: `Send a new confirmation email to "${userName}" (${user.email})?`,
          confirmLabel: 'Send Email',
          confirmColor: 'primary' as const,
        };
      default:
        return { title: '', message: '', confirmLabel: '', confirmColor: 'primary' as const };
    }
  }, [confirmModal]);

  // ============================================================================
  // Loading State
  // ============================================================================

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={400}
        role="status"
        aria-label="Loading user list"
      >
        <LoadingSpinner size="large" message="Loading users..." />
      </Box>
    );
  }

  // ============================================================================
  // Error State
  // ============================================================================

  if (error) {
    return (
      <Box p={2}>
        <Alert
          severity="error"
          title="Error Loading Users"
          message={
            error.message || 'Failed to load user list. Please try again later.'
          }
          action={
            <Button onClick={() => refetch()} variant="outlined" size="small">
              Retry
            </Button>
          }
        />
      </Box>
    );
  }

  // ============================================================================
  // Modal Content
  // ============================================================================

  const modalContent = getModalContent();

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Box sx={{ width: '100%' }}>
      {/* Toolbar with Search and Filters */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          backgroundColor: 'background.default',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
        >
          {/* Search and Filters */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            sx={{ flexGrow: 1 }}
          >
            {/* Search Input */}
            <TextField
              placeholder="Search users..."
              value={searchInput}
              onChange={handleSearchChange}
              size="small"
              sx={{ minWidth: 200 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search color="action" />
                  </InputAdornment>
                ),
              }}
              inputProps={{
                'aria-label': 'Search users by username, email, or name',
              }}
            />

            {/* Status Filter */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="status-filter-label">Status</InputLabel>
              <Select
                labelId="status-filter-label"
                id="status-filter"
                value={statusFilter}
                label="Status"
                onChange={handleStatusFilterChange as (event: any) => void}
              >
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Auth Method Filter */}
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="auth-filter-label">Auth Method</InputLabel>
              <Select
                labelId="auth-filter-label"
                id="auth-filter"
                value={authMethodFilter}
                label="Auth Method"
                onChange={handleAuthMethodFilterChange as (event: any) => void}
              >
                {AUTH_METHOD_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Reset Filters Button */}
            <Button
              variant="text"
              size="small"
              onClick={handleResetFilters}
              startIcon={<Refresh />}
            >
              Reset
            </Button>
          </Stack>

          {/* Action Buttons */}
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Refresh Button */}
            <Tooltip title="Refresh List">
              <IconButton
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Refresh user list"
              >
                <Refresh />
              </IconButton>
            </Tooltip>

            {/* Create User Button */}
            {canCreateUser() && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<PersonAdd />}
                onClick={handleCreateUser}
              >
                Add User
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* User Count Display */}
      <Box sx={{ mb: 1, px: 1 }}>
        <Typography variant="body2" color="textSecondary">
          {totalCount === 0
            ? 'No users found'
            : `Showing ${users.length} of ${totalCount} users`}
        </Typography>
      </Box>

      {/* Empty State */}
      {users.length === 0 && !isLoading && (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight={300}
          p={4}
        >
          <PersonOff sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="textSecondary" gutterBottom>
            No Users Found
          </Typography>
          <Typography variant="body2" color="textSecondary" align="center">
            {searchInput || statusFilter !== 'all' || authMethodFilter
              ? 'Try adjusting your search or filter criteria.'
              : 'There are no users in the system yet.'}
          </Typography>
          {(searchInput || statusFilter !== 'all' || authMethodFilter) && (
            <Button
              variant="outlined"
              onClick={handleResetFilters}
              sx={{ mt: 2 }}
              startIcon={<Refresh />}
            >
              Clear Filters
            </Button>
          )}
        </Box>
      )}

      {/* DataGrid */}
      {users.length > 0 && (
        <Paper elevation={1} sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={users}
            columns={columns}
            rowCount={totalCount}
            loading={isFetching}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            paginationModel={paginationModel}
            onPaginationModelChange={handlePaginationModelChange}
            paginationMode="server"
            sortModel={sortModel}
            onSortModelChange={handleSortModelChange}
            sortingMode="server"
            checkboxSelection={enableSelection}
            rowSelectionModel={rowSelectionModel}
            onRowSelectionModelChange={handleRowSelectionChange}
            disableRowSelectionOnClick
            getRowId={(row) => row.id}
            sx={{
              '& .MuiDataGrid-cell:focus': {
                outline: 'none',
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: 'action.hover',
              },
            }}
            localeText={{
              noRowsLabel: 'No users found',
              MuiTablePagination: {
                labelRowsPerPage: 'Users per page:',
              },
            }}
            aria-label="User list table"
          />
        </Paper>
      )}

      {/* Confirmation Modal */}
      <Modal
        open={confirmModal.open}
        onClose={handleCloseModal}
        title={modalContent.title}
        maxWidth="sm"
        actions={[
          {
            label: 'Cancel',
            onClick: handleCloseModal,
            variant: 'outlined',
          },
          {
            label: modalContent.confirmLabel,
            onClick: handleConfirmAction,
            color: modalContent.confirmColor,
            variant: 'contained',
            autoFocus: true,
          },
        ]}
      >
        <Typography>{modalContent.message}</Typography>
      </Modal>
    </Box>
  );
}

/**
 * Default export for convenient importing
 */
export default UserList;
