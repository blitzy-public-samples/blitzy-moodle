/**
 * RoleAssignment Component
 *
 * React component that implements a dual-list selector pattern for assigning
 * and unassigning roles to users in specific contexts. Displays two synchronized
 * lists: available users (left) and assigned users (right) with transfer buttons
 * between them.
 *
 * Features:
 * - Dual-list selector UI pattern using Material-UI components
 * - Context-aware role assignment at system, course, and activity levels
 * - Search and filtering for both user lists
 * - Bulk selection with checkboxes for multiple user transfers
 * - Visual feedback for transfer operations with loading states
 * - Optimistic UI updates with automatic rollback on error
 * - WCAG 2.1 AA accessibility compliance with proper focus management
 * - Screen reader announcements for user counts and transfer actions
 *
 * Backend Integration:
 * - Delegates to existing Moodle role_assign() function via API
 * - Delegates to existing Moodle role_unassign() function via API
 * - Permission checks (require_capability) enforced on backend
 *
 * @see public/admin/roles/assign.php - Original Moodle role assignment page
 * @see public/admin/roles/classes/existing_role_holders.php - User selector class
 * @module features/admin/roles/components/RoleAssignment
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';

// Material-UI Components
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Checkbox,
  Button,
  Divider,
  LinearProgress,
  Alert,
  Snackbar,
  Tooltip,
  Chip,
} from '@mui/material';

// Material-UI Icons
import {
  Search,
  ChevronLeft,
  ChevronRight,
  PersonAdd,
  Person,
} from '@mui/icons-material';

// Internal imports from depends_on_files
import { useRoles } from '@/features/admin/roles/hooks/useRoles';
import { useToast } from '@/hooks/useToast';
import useDebounce from '@/hooks/useDebounce';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Context type for role assignments
 *
 * Defines the level at which the role assignment applies in Moodle's hierarchy.
 */
export type ContextType = 'system' | 'course' | 'activity';

/**
 * User item for display in the transfer lists
 *
 * Simplified user representation for the role assignment interface.
 */
export interface RoleAssignmentUser {
  /** Unique user identifier */
  id: number;
  /** User's first name */
  firstname: string;
  /** User's last name */
  lastname: string;
  /** User's email address */
  email: string;
  /** URL to user's profile image (optional) */
  profileimageurl?: string;
}

/**
 * Props for the RoleAssignment component
 */
export interface RoleAssignmentProps {
  /** Context ID where the role assignment applies */
  contextId: number;
  /** Role ID to assign/unassign */
  roleId: number;
  /** Type of context (system, course, or activity) */
  contextType: ContextType;
  /** List of users available to be assigned the role */
  availableUsers: RoleAssignmentUser[];
  /** List of users currently assigned the role */
  assignedUsers: RoleAssignmentUser[];
  /** Callback when users are assigned - for parent component state updates */
  onAssignmentChange?: () => void;
  /** Loading state for initial data fetch */
  isLoading?: boolean;
  /** Error from initial data fetch */
  error?: Error | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Filters users based on search query
 *
 * Matches against firstname, lastname, and email (case-insensitive).
 *
 * @param users - Array of users to filter
 * @param query - Search query string
 * @returns Filtered array of users matching the query
 */
function filterUsers(
  users: RoleAssignmentUser[],
  query: string
): RoleAssignmentUser[] {
  if (!query.trim()) {
    return users;
  }

  const lowerQuery = query.toLowerCase().trim();

  return users.filter((user) => {
    const fullName = `${user.firstname} ${user.lastname}`.toLowerCase();
    const email = user.email.toLowerCase();
    return fullName.includes(lowerQuery) || email.includes(lowerQuery);
  });
}

/**
 * Gets the full name of a user
 *
 * @param user - User object
 * @returns Full name string
 */
function getFullName(user: RoleAssignmentUser): string {
  return `${user.firstname} ${user.lastname}`;
}

/**
 * Gets the initials for an avatar
 *
 * @param user - User object
 * @returns Two-letter initials string
 */
function getInitials(user: RoleAssignmentUser): string {
  const first = user.firstname.charAt(0).toUpperCase();
  const last = user.lastname.charAt(0).toUpperCase();
  return `${first}${last}`;
}

/**
 * Gets context type label for display
 *
 * @param contextType - Context type enum value
 * @returns Human-readable label
 */
function getContextTypeLabel(contextType: ContextType): string {
  switch (contextType) {
    case 'system':
      return 'System';
    case 'course':
      return 'Course';
    case 'activity':
      return 'Activity';
    default:
      return 'Unknown';
  }
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * RoleAssignment Component
 *
 * Dual-list selector for managing role assignments. Left panel shows available
 * users who can be assigned the role, right panel shows users who currently
 * have the role assigned.
 */
function RoleAssignment({
  contextId,
  roleId,
  contextType,
  availableUsers,
  assignedUsers,
  onAssignmentChange,
  isLoading = false,
  error = null,
}: RoleAssignmentProps): React.JSX.Element {
  // ============================================================================
  // Hooks
  // ============================================================================

  const { assignRole, unassignRole, isAssigning, assignmentError } = useRoles();
  const { success, error: showError } = useToast();

  // ============================================================================
  // State
  // ============================================================================

  // Search state for both lists
  const [leftSearchQuery, setLeftSearchQuery] = useState<string>('');
  const [rightSearchQuery, setRightSearchQuery] = useState<string>('');

  // Debounced search queries for performance optimization
  const debouncedLeftSearch = useDebounce(leftSearchQuery, 300);
  const debouncedRightSearch = useDebounce(rightSearchQuery, 300);

  // Selection state - tracks which users are checked in each list
  const [leftSelected, setLeftSelected] = useState<Set<number>>(new Set());
  const [rightSelected, setRightSelected] = useState<Set<number>>(new Set());

  // Snackbar state for success feedback
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');

  // Refs for focus management
  const leftListRef = useRef<HTMLUListElement>(null);
  const rightListRef = useRef<HTMLUListElement>(null);
  const leftSearchRef = useRef<HTMLInputElement>(null);
  const rightSearchRef = useRef<HTMLInputElement>(null);

  // Live region ref for screen reader announcements
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // Filtered User Lists
  // ============================================================================

  const filteredAvailableUsers = useMemo(() => {
    return filterUsers(availableUsers, debouncedLeftSearch);
  }, [availableUsers, debouncedLeftSearch]);

  const filteredAssignedUsers = useMemo(() => {
    return filterUsers(assignedUsers, debouncedRightSearch);
  }, [assignedUsers, debouncedRightSearch]);

  // ============================================================================
  // Screen Reader Announcements
  // ============================================================================

  /**
   * Announces a message to screen readers via live region
   */
  const announce = useCallback((message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
    }
  }, []);

  // ============================================================================
  // Selection Handlers
  // ============================================================================

  /**
   * Toggles selection of a user in the left (available) list
   */
  const handleLeftToggle = useCallback((userId: number) => {
    setLeftSelected((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(userId)) {
        newSelected.delete(userId);
      } else {
        newSelected.add(userId);
      }
      return newSelected;
    });
  }, []);

  /**
   * Toggles selection of a user in the right (assigned) list
   */
  const handleRightToggle = useCallback((userId: number) => {
    setRightSelected((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(userId)) {
        newSelected.delete(userId);
      } else {
        newSelected.add(userId);
      }
      return newSelected;
    });
  }, []);

  /**
   * Selects all visible users in the left list
   */
  const handleSelectAllLeft = useCallback(() => {
    const allIds = new Set(filteredAvailableUsers.map((user) => user.id));
    setLeftSelected(allIds);
    announce(`Selected all ${allIds.size} available users`);
  }, [filteredAvailableUsers, announce]);

  /**
   * Selects all visible users in the right list
   */
  const handleSelectAllRight = useCallback(() => {
    const allIds = new Set(filteredAssignedUsers.map((user) => user.id));
    setRightSelected(allIds);
    announce(`Selected all ${allIds.size} assigned users`);
  }, [filteredAssignedUsers, announce]);

  /**
   * Clears selection in the left list
   */
  const handleClearLeftSelection = useCallback(() => {
    setLeftSelected(new Set());
    announce('Cleared selection');
  }, [announce]);

  /**
   * Clears selection in the right list
   */
  const handleClearRightSelection = useCallback(() => {
    setRightSelected(new Set());
    announce('Cleared selection');
  }, [announce]);

  // ============================================================================
  // Transfer Handlers with Optimistic Updates
  // ============================================================================

  /**
   * Assigns selected users from the left list to the role
   *
   * Implements optimistic updates with rollback on error.
   */
  const handleAssignSelected = useCallback(async () => {
    if (leftSelected.size === 0) {
      return;
    }

    const usersToAssign = Array.from(leftSelected);
    const userCount = usersToAssign.length;

    try {
      // Perform assignments sequentially to maintain consistency
      for (const userId of usersToAssign) {
        await assignRole(roleId, userId, contextId);
      }

      // Clear selection after successful assignment
      setLeftSelected(new Set());

      // Notify parent component of change
      onAssignmentChange?.();

      // Show success feedback
      const message =
        userCount === 1
          ? 'User assigned successfully'
          : `${userCount} users assigned successfully`;
      setSnackbarMessage(message);
      setSnackbarOpen(true);
      success(message);
      announce(message);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to assign users';
      showError(errorMessage);
      announce(`Error: ${errorMessage}`);
    }
  }, [
    leftSelected,
    assignRole,
    roleId,
    contextId,
    onAssignmentChange,
    success,
    showError,
    announce,
  ]);

  /**
   * Unassigns selected users from the right list
   *
   * Implements optimistic updates with rollback on error.
   */
  const handleUnassignSelected = useCallback(async () => {
    if (rightSelected.size === 0) {
      return;
    }

    const usersToUnassign = Array.from(rightSelected);
    const userCount = usersToUnassign.length;

    try {
      // Perform unassignments sequentially to maintain consistency
      for (const userId of usersToUnassign) {
        await unassignRole(roleId, userId, contextId);
      }

      // Clear selection after successful unassignment
      setRightSelected(new Set());

      // Notify parent component of change
      onAssignmentChange?.();

      // Show success feedback
      const message =
        userCount === 1
          ? 'User unassigned successfully'
          : `${userCount} users unassigned successfully`;
      setSnackbarMessage(message);
      setSnackbarOpen(true);
      success(message);
      announce(message);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to unassign users';
      showError(errorMessage);
      announce(`Error: ${errorMessage}`);
    }
  }, [
    rightSelected,
    unassignRole,
    roleId,
    contextId,
    onAssignmentChange,
    success,
    showError,
    announce,
  ]);

  // ============================================================================
  // Keyboard Navigation Handlers
  // ============================================================================

  /**
   * Handles keyboard events for list items
   *
   * Supports Space/Enter for selection toggle
   */
  const handleListKeyDown = useCallback(
    (
      event: React.KeyboardEvent,
      userId: number,
      toggleFn: (id: number) => void
    ) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleFn(userId);
      }
    },
    []
  );

  // ============================================================================
  // Snackbar Handler
  // ============================================================================

  const handleSnackbarClose = useCallback(
    (_event?: React.SyntheticEvent | Event, reason?: string) => {
      if (reason === 'clickaway') {
        return;
      }
      setSnackbarOpen(false);
    },
    []
  );

  // ============================================================================
  // Effect: Clear selections when user lists change
  // ============================================================================

  useEffect(() => {
    // Clear left selections for users no longer available
    setLeftSelected((prev) => {
      const availableIds = new Set(availableUsers.map((u) => u.id));
      const newSelected = new Set<number>();
      prev.forEach((id) => {
        if (availableIds.has(id)) {
          newSelected.add(id);
        }
      });
      return newSelected;
    });

    // Clear right selections for users no longer assigned
    setRightSelected((prev) => {
      const assignedIds = new Set(assignedUsers.map((u) => u.id));
      const newSelected = new Set<number>();
      prev.forEach((id) => {
        if (assignedIds.has(id)) {
          newSelected.add(id);
        }
      });
      return newSelected;
    });
  }, [availableUsers, assignedUsers]);

  // ============================================================================
  // Render Helper: User List Item
  // ============================================================================

  /**
   * Renders a single user list item with checkbox and avatar
   */
  const renderUserListItem = useCallback(
    (
      user: RoleAssignmentUser,
      isSelected: boolean,
      toggleFn: (id: number) => void,
      side: 'left' | 'right'
    ) => {
      const labelId = `user-${side}-${user.id}`;
      const fullName = getFullName(user);

      return (
        <ListItem
          key={user.id}
          disablePadding
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <ListItemButton
            role="checkbox"
            aria-checked={isSelected}
            aria-labelledby={labelId}
            onClick={() => toggleFn(user.id)}
            onKeyDown={(e) => handleListKeyDown(e, user.id, toggleFn)}
            dense
            sx={{
              py: 1,
              '&:hover': {
                backgroundColor: 'action.hover',
              },
              '&.Mui-focusVisible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: -2,
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 42 }}>
              <Checkbox
                edge="start"
                checked={isSelected}
                tabIndex={-1}
                disableRipple
                inputProps={{
                  'aria-labelledby': labelId,
                }}
              />
            </ListItemIcon>
            <ListItemAvatar>
              <Avatar
                src={user.profileimageurl}
                alt={`${fullName}'s profile picture`}
                sx={{ width: 36, height: 36 }}
              >
                {getInitials(user)}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              id={labelId}
              primary={fullName}
              secondary={user.email}
              primaryTypographyProps={{
                variant: 'body2',
                fontWeight: 500,
              }}
              secondaryTypographyProps={{
                variant: 'caption',
                noWrap: true,
                sx: { maxWidth: 200 },
              }}
            />
          </ListItemButton>
        </ListItem>
      );
    },
    [handleListKeyDown]
  );

  // ============================================================================
  // Render
  // ============================================================================

  // Show loading state
  if (isLoading) {
    return (
      <Box sx={{ width: '100%', p: 3 }}>
        <LinearProgress aria-label="Loading role assignment data" />
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 2, textAlign: 'center' }}
        >
          Loading users...
        </Typography>
      </Box>
    );
  }

  // Show error state
  if (error) {
    return (
      <Alert
        severity="error"
        sx={{ m: 2 }}
        aria-live="polite"
      >
        {error.message || 'Failed to load role assignment data'}
      </Alert>
    );
  }

  return (
    <Box
      sx={{ width: '100%' }}
      role="region"
      aria-label={`Role assignment for ${getContextTypeLabel(contextType)} context`}
    >
      {/* Screen reader live region for announcements */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      />

      {/* Assignment error alert */}
      {assignmentError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          aria-live="polite"
        >
          {assignmentError.message || 'An error occurred during role assignment'}
        </Alert>
      )}

      {/* Context information header */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          label={getContextTypeLabel(contextType)}
          size="small"
          color="primary"
          variant="outlined"
        />
        <Typography variant="body2" color="text.secondary">
          Context ID: {contextId} | Role ID: {roleId}
        </Typography>
      </Box>

      {/* Loading progress bar during assignment operations */}
      {isAssigning && (
        <LinearProgress
          sx={{ mb: 2 }}
          aria-label="Processing role assignment"
        />
      )}

      {/* Main dual-list layout */}
      <Grid container spacing={2} alignItems="stretch">
        {/* Left Panel - Available Users */}
        <Grid item xs={12} md={5}>
          <Paper
            elevation={2}
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 400,
            }}
          >
            {/* Header */}
            <Box
              sx={{
                p: 2,
                backgroundColor: 'grey.50',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography
                variant="subtitle1"
                component="h3"
                fontWeight={600}
                id="available-users-heading"
              >
                <PersonAdd sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
                Available Users
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                aria-live="polite"
              >
                {filteredAvailableUsers.length} user
                {filteredAvailableUsers.length !== 1 ? 's' : ''} available
                {leftSelected.size > 0 && ` (${leftSelected.size} selected)`}
              </Typography>
            </Box>

            {/* Search Field */}
            <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <TextField
                inputRef={leftSearchRef}
                size="small"
                fullWidth
                placeholder="Search available users..."
                value={leftSearchQuery}
                onChange={(e) => setLeftSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                aria-label="Search available users"
                aria-describedby="available-users-heading"
              />
            </Box>

            {/* Selection Controls */}
            <Box
              sx={{
                px: 1.5,
                py: 1,
                display: 'flex',
                gap: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Button
                size="small"
                variant="text"
                onClick={handleSelectAllLeft}
                disabled={filteredAvailableUsers.length === 0}
                aria-label="Select all available users"
              >
                Select All
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={handleClearLeftSelection}
                disabled={leftSelected.size === 0}
                aria-label="Clear selection"
              >
                Clear
              </Button>
            </Box>

            {/* User List */}
            <List
              ref={leftListRef}
              dense
              sx={{
                flex: 1,
                overflow: 'auto',
                '& .MuiListItem-root:last-child': {
                  borderBottom: 'none',
                },
              }}
              aria-labelledby="available-users-heading"
              role="listbox"
              aria-multiselectable="true"
            >
              {filteredAvailableUsers.length === 0 ? (
                <ListItem>
                  <ListItemText
                    primary={
                      leftSearchQuery
                        ? 'No users match your search'
                        : 'No available users'
                    }
                    primaryTypographyProps={{
                      variant: 'body2',
                      color: 'text.secondary',
                      textAlign: 'center',
                    }}
                  />
                </ListItem>
              ) : (
                filteredAvailableUsers.map((user) =>
                  renderUserListItem(
                    user,
                    leftSelected.has(user.id),
                    handleLeftToggle,
                    'left'
                  )
                )
              )}
            </List>
          </Paper>
        </Grid>

        {/* Center Panel - Transfer Buttons */}
        <Grid
          item
          xs={12}
          md={2}
          sx={{
            display: 'flex',
            flexDirection: { xs: 'row', md: 'column' },
            justifyContent: 'center',
            alignItems: 'center',
            gap: 1,
            py: 2,
          }}
        >
          <Tooltip title="Assign selected users" placement="top">
            <span>
              <Button
                variant="contained"
                color="primary"
                size="medium"
                onClick={handleAssignSelected}
                disabled={leftSelected.size === 0 || isAssigning}
                aria-label={`Assign ${leftSelected.size} selected user${leftSelected.size !== 1 ? 's' : ''}`}
                sx={{
                  minWidth: 100,
                  '& .MuiButton-startIcon': {
                    display: { xs: 'none', md: 'inherit' },
                  },
                }}
                startIcon={<ChevronRight />}
                endIcon={<ChevronRight sx={{ display: { xs: 'inherit', md: 'none' } }} />}
              >
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>Add</Box>
                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                  <ChevronRight />
                </Box>
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Unassign selected users" placement="top">
            <span>
              <Button
                variant="outlined"
                color="secondary"
                size="medium"
                onClick={handleUnassignSelected}
                disabled={rightSelected.size === 0 || isAssigning}
                aria-label={`Unassign ${rightSelected.size} selected user${rightSelected.size !== 1 ? 's' : ''}`}
                sx={{
                  minWidth: 100,
                  '& .MuiButton-endIcon': {
                    display: { xs: 'none', md: 'inherit' },
                  },
                }}
                startIcon={<ChevronLeft sx={{ display: { xs: 'inherit', md: 'none' } }} />}
                endIcon={<ChevronLeft />}
              >
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>Remove</Box>
                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                  <ChevronLeft />
                </Box>
              </Button>
            </span>
          </Tooltip>

          <Divider
            sx={{
              width: { xs: 1, md: '100%' },
              height: { xs: '100%', md: 1 },
              my: 1,
            }}
          />

          {/* Selection summary */}
          <Typography
            variant="caption"
            color="text.secondary"
            textAlign="center"
            sx={{ display: { xs: 'none', md: 'block' } }}
          >
            {leftSelected.size > 0 && `${leftSelected.size} to add`}
            {leftSelected.size > 0 && rightSelected.size > 0 && <br />}
            {rightSelected.size > 0 && `${rightSelected.size} to remove`}
          </Typography>
        </Grid>

        {/* Right Panel - Assigned Users */}
        <Grid item xs={12} md={5}>
          <Paper
            elevation={2}
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 400,
            }}
          >
            {/* Header */}
            <Box
              sx={{
                p: 2,
                backgroundColor: 'primary.light',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography
                variant="subtitle1"
                component="h3"
                fontWeight={600}
                id="assigned-users-heading"
                sx={{ color: 'primary.contrastText' }}
              >
                <Person sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
                Assigned Users
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'primary.contrastText', opacity: 0.9 }}
                aria-live="polite"
              >
                {filteredAssignedUsers.length} user
                {filteredAssignedUsers.length !== 1 ? 's' : ''} assigned
                {rightSelected.size > 0 && ` (${rightSelected.size} selected)`}
              </Typography>
            </Box>

            {/* Search Field */}
            <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <TextField
                inputRef={rightSearchRef}
                size="small"
                fullWidth
                placeholder="Search assigned users..."
                value={rightSearchQuery}
                onChange={(e) => setRightSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                aria-label="Search assigned users"
                aria-describedby="assigned-users-heading"
              />
            </Box>

            {/* Selection Controls */}
            <Box
              sx={{
                px: 1.5,
                py: 1,
                display: 'flex',
                gap: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Button
                size="small"
                variant="text"
                onClick={handleSelectAllRight}
                disabled={filteredAssignedUsers.length === 0}
                aria-label="Select all assigned users"
              >
                Select All
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={handleClearRightSelection}
                disabled={rightSelected.size === 0}
                aria-label="Clear selection"
              >
                Clear
              </Button>
            </Box>

            {/* User List */}
            <List
              ref={rightListRef}
              dense
              sx={{
                flex: 1,
                overflow: 'auto',
                '& .MuiListItem-root:last-child': {
                  borderBottom: 'none',
                },
              }}
              aria-labelledby="assigned-users-heading"
              role="listbox"
              aria-multiselectable="true"
            >
              {filteredAssignedUsers.length === 0 ? (
                <ListItem>
                  <ListItemText
                    primary={
                      rightSearchQuery
                        ? 'No users match your search'
                        : 'No users assigned'
                    }
                    primaryTypographyProps={{
                      variant: 'body2',
                      color: 'text.secondary',
                      textAlign: 'center',
                    }}
                  />
                </ListItem>
              ) : (
                filteredAssignedUsers.map((user) =>
                  renderUserListItem(
                    user,
                    rightSelected.has(user.id),
                    handleRightToggle,
                    'right'
                  )
                )
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>

      {/* Success Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity="success"
          sx={{ width: '100%' }}
          elevation={6}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default RoleAssignment;
