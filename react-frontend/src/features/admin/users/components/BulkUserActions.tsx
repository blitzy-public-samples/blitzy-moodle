/**
 * Bulk User Actions Component
 *
 * React component that provides a dropdown menu for performing batch operations
 * on multiple selected users. Displays available bulk actions based on user
 * permissions and executes the selected action on all currently selected user IDs.
 *
 * Features:
 * - Permission-based action visibility using Moodle capabilities
 * - Confirmation dialogs for destructive actions (delete, suspend)
 * - Loading states during operation execution
 * - Success/error notifications via toast
 * - Plugin extension point support for custom actions
 *
 * Based on Moodle's bulk user action system:
 * - Source: public/admin/user/user_bulk_forms.php (action definitions)
 * - Source: public/admin/user/user_bulk.php (bulk action handling)
 * - Source: public/admin/user.php (user management interface)
 *
 * Required Capabilities by Action:
 * - Confirm users: moodle/user:update
 * - Send message: moodle/site:readallmessages AND moodle/user:update
 * - Delete users: moodle/user:delete
 * - Force password change: moodle/user:update
 * - Add to cohort: moodle/cohort:assign
 * - Suspend/Unsuspend users: moodle/user:update
 * - Download user data: moodle/user:update
 *
 * @module features/admin/users/components/BulkUserActions
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  Typography,
  Box,
  List,
  ListItem,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Block as SuspendIcon,
  CheckCircle as ConfirmIcon,
  Email as MessageIcon,
  VpnKey as PasswordIcon,
  GroupAdd as CohortIcon,
  PlayArrow as UnsuspendIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';

import { useBulkUserActions } from '../hooks/useBulkUserActions';
import { BulkActionType } from '../types/bulk-actions.types';
import type { User } from '../types/user.types';
import { usePermissions } from '@/hooks/usePermissions';
import { Modal } from '@/components/feedback/Modal';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Configuration for a bulk action menu item
 */
interface BulkActionMenuItem {
  /** Unique identifier for the action */
  id: string;
  /** Display label for the action */
  label: string;
  /** Icon component to display */
  icon: React.ReactNode;
  /** Action type for execution */
  actionType: BulkActionType;
  /** Whether this action requires confirmation */
  requiresConfirmation: boolean;
  /** Whether this action is destructive (shown in red) */
  isDestructive: boolean;
  /** Required capabilities for this action */
  capabilities: string[];
  /** Optional description for confirmation dialog */
  description?: string;
}

/**
 * Custom bulk action provided by plugins
 */
export interface CustomBulkAction {
  /** Unique identifier for the custom action */
  id: string;
  /** Display label for the action */
  label: string;
  /** Icon component to display */
  icon: React.ReactNode;
  /** Custom handler function */
  handler: (userIds: number[]) => Promise<void>;
  /** Whether this action requires confirmation */
  requiresConfirmation?: boolean;
  /** Whether this action is destructive */
  isDestructive?: boolean;
  /** Required capabilities */
  capabilities?: string[];
  /** Description for confirmation dialog */
  description?: string;
}

/**
 * Props interface for the BulkUserActions component
 */
export interface BulkUserActionsProps {
  /**
   * Array of currently selected user IDs
   * @required
   */
  selectedUserIds: number[];

  /**
   * Optional array of selected user objects (for displaying usernames in confirmation)
   * If not provided, only user count will be shown in confirmations
   */
  selectedUsers?: User[];

  /**
   * Callback function to refresh the user list after a bulk action completes
   */
  onActionComplete?: () => void;

  /**
   * Custom bulk actions provided by plugins
   * Allows extending the available actions without modifying this component
   */
  customActions?: CustomBulkAction[];

  /**
   * Whether the component is disabled
   * @default false
   */
  disabled?: boolean;

  /**
   * Button variant
   * @default 'contained'
   */
  variant?: 'text' | 'outlined' | 'contained';

  /**
   * Button size
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Callback to handle message action - opens message composer dialog
   * Called with the list of user IDs to message
   * If not provided, the message action will be hidden
   */
  onMessageAction?: (userIds: number[]) => void;

  /**
   * Callback to handle add to cohort action - opens cohort selector dialog
   * Called with the list of user IDs to add
   * If not provided, the cohort action will be hidden
   */
  onCohortAction?: (userIds: number[]) => void;

  /**
   * Callback to handle download action - opens download options dialog
   * Called with the list of user IDs to download
   * If not provided, the download action will be hidden
   */
  onDownloadAction?: (userIds: number[]) => void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Moodle capabilities used for bulk user actions
 */
const CAPABILITIES = {
  USER_UPDATE: 'moodle/user:update',
  USER_DELETE: 'moodle/user:delete',
  READ_ALL_MESSAGES: 'moodle/site:readallmessages',
  COHORT_ASSIGN: 'moodle/cohort:assign',
} as const;

/**
 * Default bulk action menu items configuration
 * Mirrors the actions available in Moodle's user_bulk_forms.php
 */
const DEFAULT_BULK_ACTIONS: BulkActionMenuItem[] = [
  {
    id: 'confirm',
    label: 'Confirm users',
    icon: <ConfirmIcon />,
    actionType: BulkActionType.CONFIRM,
    requiresConfirmation: false,
    isDestructive: false,
    capabilities: [CAPABILITIES.USER_UPDATE],
    description: 'Confirm unconfirmed user accounts. Users will receive a confirmation email.',
  },
  {
    id: 'message',
    label: 'Send message',
    icon: <MessageIcon />,
    actionType: BulkActionType.MESSAGE,
    requiresConfirmation: false,
    isDestructive: false,
    capabilities: [CAPABILITIES.USER_UPDATE, CAPABILITIES.READ_ALL_MESSAGES],
    description: 'Send a message to selected users.',
  },
  {
    id: 'forcepasswordchange',
    label: 'Force password change',
    icon: <PasswordIcon />,
    actionType: BulkActionType.FORCE_PASSWORD_CHANGE,
    requiresConfirmation: true,
    isDestructive: false,
    capabilities: [CAPABILITIES.USER_UPDATE],
    description: 'Force selected users to change their password on next login.',
  },
  {
    id: 'addtocohort',
    label: 'Add to cohort',
    icon: <CohortIcon />,
    actionType: BulkActionType.ADD_TO_COHORT,
    requiresConfirmation: false,
    isDestructive: false,
    capabilities: [CAPABILITIES.USER_UPDATE, CAPABILITIES.COHORT_ASSIGN],
    description: 'Add selected users to a cohort.',
  },
  {
    id: 'download',
    label: 'Download user data',
    icon: <DownloadIcon />,
    actionType: BulkActionType.DOWNLOAD,
    requiresConfirmation: false,
    isDestructive: false,
    capabilities: [CAPABILITIES.USER_UPDATE],
    description: 'Download user data for selected users.',
  },
  {
    id: 'suspend',
    label: 'Suspend users',
    icon: <SuspendIcon />,
    actionType: BulkActionType.SUSPEND,
    requiresConfirmation: true,
    isDestructive: true,
    capabilities: [CAPABILITIES.USER_UPDATE],
    description:
      'Suspend selected user accounts. Suspended users will not be able to log in until their accounts are unsuspended.',
  },
  {
    id: 'unsuspend',
    label: 'Unsuspend users',
    icon: <UnsuspendIcon />,
    actionType: BulkActionType.UNSUSPEND,
    requiresConfirmation: false,
    isDestructive: false,
    capabilities: [CAPABILITIES.USER_UPDATE],
    description: 'Reactivate suspended user accounts.',
  },
  {
    id: 'delete',
    label: 'Delete users',
    icon: <DeleteIcon />,
    actionType: BulkActionType.DELETE,
    requiresConfirmation: true,
    isDestructive: true,
    capabilities: [CAPABILITIES.USER_DELETE],
    description:
      'Delete selected user accounts. This action cannot be undone. All user data including enrollments, submissions, and grades will be permanently removed.',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the display name for a user
 * Returns fullname or username if fullname is not available
 */
function getUserDisplayName(user: User): string {
  const fullname = `${user.firstname} ${user.lastname}`.trim();
  return fullname || user.username || `User #${user.id}`;
}

/**
 * Get action label with user count
 */
function getActionLabelWithCount(label: string, count: number): string {
  return `${label} (${count} ${count === 1 ? 'user' : 'users'})`;
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * BulkUserActions Component
 *
 * Provides a dropdown menu for performing batch operations on multiple users.
 * Actions are shown or hidden based on the current user's capabilities.
 * Destructive actions require confirmation before execution.
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * ```tsx
 * function UserManagementPage() {
 *   const [selectedIds, setSelectedIds] = useState<number[]>([]);
 *
 *   return (
 *     <>
 *       <UserTable
 *         onSelectionChange={setSelectedIds}
 *       />
 *       <BulkUserActions
 *         selectedUserIds={selectedIds}
 *         onActionComplete={() => refetchUsers()}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function BulkUserActions({
  selectedUserIds,
  selectedUsers,
  onActionComplete,
  customActions = [],
  disabled = false,
  variant = 'contained',
  size = 'medium',
  onMessageAction,
  onCohortAction,
  onDownloadAction,
}: BulkUserActionsProps): React.ReactElement {
  // ============================================================================
  // Hooks
  // ============================================================================

  const { hasCapability, hasAnyCapability } = usePermissions();
  const toast = useToast();
  const {
    bulkDelete,
    bulkSuspend,
    bulkUnsuspend,
    bulkConfirm,
    bulkForcePasswordChange,
    isLoading: isBulkActionLoading,
    progress,
  } = useBulkUserActions();

  // ============================================================================
  // Local State
  // ============================================================================

  /** Anchor element for dropdown menu */
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  /** Currently executing action (for showing specific loading state) */
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  /** Confirmation dialog state */
  const [confirmationDialog, setConfirmationDialog] = useState<{
    open: boolean;
    action: BulkActionMenuItem | CustomBulkAction | null;
  }>({
    open: false,
    action: null,
  });

  // ============================================================================
  // Computed Values
  // ============================================================================

  /** Whether the dropdown menu is open */
  const isMenuOpen = Boolean(anchorEl);

  /** Number of selected users */
  const selectedCount = selectedUserIds.length;

  /** Whether the component should be disabled (no selection or currently loading) */
  const isDisabled = disabled || selectedCount === 0 || isBulkActionLoading;

  /**
   * Filter available actions based on user capabilities and required callbacks
   * Only shows actions that the current user has permission to perform
   * and for which the necessary callbacks are provided
   */
  const availableActions = useMemo((): BulkActionMenuItem[] => {
    return DEFAULT_BULK_ACTIONS.filter((action) => {
      // Filter out actions that require callbacks when callbacks are not provided
      if (action.actionType === BulkActionType.MESSAGE && !onMessageAction) {
        return false;
      }
      if (action.actionType === BulkActionType.ADD_TO_COHORT && !onCohortAction) {
        return false;
      }
      if (action.actionType === BulkActionType.DOWNLOAD && !onDownloadAction) {
        return false;
      }

      // Check if user has all required capabilities for this action
      if (action.capabilities.length === 0) {
        return true;
      }

      // For actions requiring single capability
      if (action.capabilities.length === 1) {
        return hasCapability(action.capabilities[0]);
      }

      // For multiple capabilities, check all are present
      return action.capabilities.every((cap) => hasCapability(cap));
    });
  }, [hasCapability, hasAnyCapability, onMessageAction, onCohortAction, onDownloadAction]);

  /**
   * Filter custom actions based on capabilities
   */
  const availableCustomActions = useMemo((): CustomBulkAction[] => {
    return customActions.filter((action) => {
      if (!action.capabilities || action.capabilities.length === 0) {
        return true;
      }
      return action.capabilities.every((cap) => hasCapability(cap));
    });
  }, [customActions, hasCapability]);

  /**
   * Check if any actions are available
   */
  const hasAvailableActions = availableActions.length > 0 || availableCustomActions.length > 0;

  /**
   * Get usernames for display in confirmation dialog
   */
  const selectedUsernames = useMemo((): string[] => {
    if (selectedUsers && selectedUsers.length > 0) {
      return selectedUsers.map(getUserDisplayName);
    }
    // If no user objects provided, return user IDs as strings
    return selectedUserIds.map((id) => `User #${id}`);
  }, [selectedUsers, selectedUserIds]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Open the dropdown menu
   */
  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  }, []);

  /**
   * Close the dropdown menu
   */
  const handleMenuClose = useCallback((): void => {
    setAnchorEl(null);
  }, []);

  /**
   * Handle action selection from menu
   */
  const handleActionClick = useCallback(
    (action: BulkActionMenuItem): void => {
      handleMenuClose();

      // If action requires confirmation, show dialog
      if (action.requiresConfirmation) {
        setConfirmationDialog({
          open: true,
          action,
        });
        return;
      }

      // Execute action directly
      void executeAction(action);
    },
    [handleMenuClose]
  );

  /**
   * Handle custom action selection from menu
   */
  const handleCustomActionClick = useCallback(
    (action: CustomBulkAction): void => {
      handleMenuClose();

      // If action requires confirmation, show dialog
      if (action.requiresConfirmation) {
        setConfirmationDialog({
          open: true,
          action,
        });
        return;
      }

      // Execute custom action directly
      void executeCustomAction(action);
    },
    [handleMenuClose]
  );

  /**
   * Close confirmation dialog
   */
  const handleConfirmationClose = useCallback((): void => {
    setConfirmationDialog({
      open: false,
      action: null,
    });
  }, []);

  /**
   * Confirm and execute the action
   */
  const handleConfirmAction = useCallback(async (): Promise<void> => {
    const { action } = confirmationDialog;

    if (!action) {
      return;
    }

    handleConfirmationClose();

    // Check if it's a custom action
    if ('handler' in action) {
      await executeCustomAction(action as CustomBulkAction);
    } else {
      await executeAction(action as BulkActionMenuItem);
    }
  }, [confirmationDialog, handleConfirmationClose]);

  // ============================================================================
  // Action Execution
  // ============================================================================

  /**
   * Execute a built-in bulk action
   */
  const executeAction = useCallback(
    async (action: BulkActionMenuItem): Promise<void> => {
      setExecutingAction(action.id);

      try {
        let result;

        switch (action.actionType) {
          case BulkActionType.DELETE:
            result = await bulkDelete({
              userIds: selectedUserIds,
              confirmed: true,
            });
            break;

          case BulkActionType.SUSPEND:
            result = await bulkSuspend({
              userIds: selectedUserIds,
            });
            break;

          case BulkActionType.UNSUSPEND:
            result = await bulkUnsuspend({
              userIds: selectedUserIds,
            });
            break;

          case BulkActionType.CONFIRM:
            result = await bulkConfirm({
              userIds: selectedUserIds,
            });
            break;

          case BulkActionType.FORCE_PASSWORD_CHANGE:
            result = await bulkForcePasswordChange({
              userIds: selectedUserIds,
            });
            break;

          case BulkActionType.MESSAGE:
            // Message action requires additional UI (message composer)
            // Delegate to parent component via callback
            if (onMessageAction) {
              onMessageAction(selectedUserIds);
            }
            return;

          case BulkActionType.ADD_TO_COHORT:
            // Cohort action requires additional UI (cohort selector)
            // Delegate to parent component via callback
            if (onCohortAction) {
              onCohortAction(selectedUserIds);
            }
            return;

          case BulkActionType.DOWNLOAD:
            // Download action requires additional UI (format selector)
            // Delegate to parent component via callback
            if (onDownloadAction) {
              onDownloadAction(selectedUserIds);
            }
            return;

          default:
            toast.error(`Unknown action: ${action.actionType}`);
            return;
        }

        // Handle result
        if (result) {
          if (result.success) {
            // Show success notification (already handled by useBulkUserActions)
            // Trigger parent refresh callback
            onActionComplete?.();
          }
          // Error notifications are already handled by useBulkUserActions
        }
      } catch (error) {
        // Error handling is done in useBulkUserActions hook
        console.error(`Error executing bulk action ${action.id}:`, error);
      } finally {
        setExecutingAction(null);
      }
    },
    [
      selectedUserIds,
      bulkDelete,
      bulkSuspend,
      bulkUnsuspend,
      bulkConfirm,
      bulkForcePasswordChange,
      onActionComplete,
      onMessageAction,
      onCohortAction,
      onDownloadAction,
      toast,
    ]
  );

  /**
   * Execute a custom plugin-provided bulk action
   */
  const executeCustomAction = useCallback(
    async (action: CustomBulkAction): Promise<void> => {
      setExecutingAction(action.id);

      try {
        await action.handler(selectedUserIds);
        toast.success(`${action.label} completed successfully`);
        onActionComplete?.();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        toast.error(`${action.label} failed: ${errorMessage}`);
      } finally {
        setExecutingAction(null);
      }
    },
    [selectedUserIds, onActionComplete, toast]
  );

  // ============================================================================
  // Render Helpers
  // ============================================================================

  /**
   * Render a menu item for a bulk action
   */
  const renderMenuItem = useCallback(
    (action: BulkActionMenuItem): React.ReactElement => {
      const isExecuting = executingAction === action.id;

      return (
        <MenuItem
          key={action.id}
          onClick={() => handleActionClick(action)}
          disabled={isExecuting || isBulkActionLoading}
          sx={{
            color: action.isDestructive ? 'error.main' : 'inherit',
            '&:hover': {
              backgroundColor: action.isDestructive ? 'error.light' : undefined,
            },
          }}
        >
          <ListItemIcon
            sx={{
              color: action.isDestructive ? 'error.main' : 'inherit',
              minWidth: 40,
            }}
          >
            {isExecuting ? <CircularProgress size={20} /> : action.icon}
          </ListItemIcon>
          <ListItemText primary={action.label} />
        </MenuItem>
      );
    },
    [executingAction, isBulkActionLoading, handleActionClick]
  );

  /**
   * Render a menu item for a custom action
   */
  const renderCustomMenuItem = useCallback(
    (action: CustomBulkAction): React.ReactElement => {
      const isExecuting = executingAction === action.id;

      return (
        <MenuItem
          key={`custom-${action.id}`}
          onClick={() => handleCustomActionClick(action)}
          disabled={isExecuting || isBulkActionLoading}
          sx={{
            color: action.isDestructive ? 'error.main' : 'inherit',
          }}
        >
          <ListItemIcon
            sx={{
              color: action.isDestructive ? 'error.main' : 'inherit',
              minWidth: 40,
            }}
          >
            {isExecuting ? <CircularProgress size={20} /> : action.icon}
          </ListItemIcon>
          <ListItemText primary={action.label} />
        </MenuItem>
      );
    },
    [executingAction, isBulkActionLoading, handleCustomActionClick]
  );

  /**
   * Get the title for confirmation dialog
   */
  const getConfirmationTitle = useCallback((): string => {
    const { action } = confirmationDialog;

    if (!action) {
      return 'Confirm Action';
    }

    return getActionLabelWithCount(action.label, selectedCount);
  }, [confirmationDialog, selectedCount]);

  /**
   * Get the description for confirmation dialog
   */
  const getConfirmationDescription = useCallback((): string | undefined => {
    const { action } = confirmationDialog;

    if (!action) {
      return undefined;
    }

    return action.description;
  }, [confirmationDialog]);

  // ============================================================================
  // Render
  // ============================================================================

  // Don't render anything if no actions are available
  if (!hasAvailableActions) {
    return <></>;
  }

  return (
    <>
      {/* Bulk Actions Button */}
      <Button
        id="bulk-actions-button"
        variant={variant}
        size={size}
        disabled={isDisabled}
        onClick={handleMenuOpen}
        endIcon={
          isBulkActionLoading ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <ExpandMoreIcon />
          )
        }
        aria-controls={isMenuOpen ? 'bulk-actions-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={isMenuOpen ? 'true' : undefined}
        aria-label={`Bulk actions for ${selectedCount} selected users`}
      >
        {isBulkActionLoading
          ? `Processing... ${progress.percentComplete}%`
          : `Bulk actions (${selectedCount})`}
      </Button>

      {/* Dropdown Menu */}
      <Menu
        id="bulk-actions-menu"
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleMenuClose}
        MenuListProps={{
          'aria-labelledby': 'bulk-actions-button',
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        {/* Header showing selected count */}
        <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            {selectedCount} {selectedCount === 1 ? 'user' : 'users'} selected
          </Typography>
        </Box>

        {/* Non-destructive actions */}
        {availableActions
          .filter((action) => !action.isDestructive)
          .map(renderMenuItem)}

        {/* Custom actions (non-destructive) */}
        {availableCustomActions
          .filter((action) => !action.isDestructive)
          .map(renderCustomMenuItem)}

        {/* Divider before destructive actions */}
        {(availableActions.some((a) => a.isDestructive) ||
          availableCustomActions.some((a) => a.isDestructive)) && <Divider />}

        {/* Destructive actions */}
        {availableActions
          .filter((action) => action.isDestructive)
          .map(renderMenuItem)}

        {/* Custom actions (destructive) */}
        {availableCustomActions
          .filter((action) => action.isDestructive)
          .map(renderCustomMenuItem)}
      </Menu>

      {/* Confirmation Dialog */}
      <Modal
        open={confirmationDialog.open}
        onClose={handleConfirmationClose}
        title={getConfirmationTitle()}
        description={getConfirmationDescription()}
        maxWidth="sm"
        actions={[
          {
            label: 'Cancel',
            onClick: handleConfirmationClose,
            variant: 'outlined',
          },
          {
            label:
              confirmationDialog.action?.isDestructive ||
              ('isDestructive' in (confirmationDialog.action ?? {}) &&
                (confirmationDialog.action as CustomBulkAction)?.isDestructive)
                ? 'Confirm'
                : 'Proceed',
            onClick: () => void handleConfirmAction(),
            color:
              confirmationDialog.action?.isDestructive ||
              ('isDestructive' in (confirmationDialog.action ?? {}) &&
                (confirmationDialog.action as CustomBulkAction)?.isDestructive)
                ? 'error'
                : 'primary',
            variant: 'contained',
            autoFocus: true,
          },
        ]}
      >
        <Box>
          {/* Warning message for destructive actions */}
          {(confirmationDialog.action?.isDestructive ||
            ('isDestructive' in (confirmationDialog.action ?? {}) &&
              (confirmationDialog.action as CustomBulkAction)?.isDestructive)) && (
            <Typography
              variant="body2"
              color="error.main"
              sx={{ mb: 2, fontWeight: 'medium' }}
            >
              Warning: This action cannot be undone.
            </Typography>
          )}

          {/* List of affected users */}
          <Typography variant="subtitle2" gutterBottom>
            The following {selectedCount === 1 ? 'user' : 'users'} will be affected:
          </Typography>

          <Box
            sx={{
              maxHeight: 200,
              overflow: 'auto',
              bgcolor: 'grey.50',
              borderRadius: 1,
              mt: 1,
            }}
          >
            <List dense>
              {selectedUsernames.slice(0, 50).map((username, index) => (
                <ListItem key={index} sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={username}
                    primaryTypographyProps={{
                      variant: 'body2',
                    }}
                  />
                </ListItem>
              ))}
              {selectedUsernames.length > 50 && (
                <ListItem sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={`... and ${selectedUsernames.length - 50} more users`}
                    primaryTypographyProps={{
                      variant: 'body2',
                      color: 'text.secondary',
                      fontStyle: 'italic',
                    }}
                  />
                </ListItem>
              )}
            </List>
          </Box>
        </Box>
      </Modal>
    </>
  );
}

// Export default for convenience
export default BulkUserActions;
