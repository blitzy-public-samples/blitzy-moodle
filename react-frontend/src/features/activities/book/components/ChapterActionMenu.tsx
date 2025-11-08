/**
 * ChapterActionMenu Component
 * 
 * Provides an action menu for chapter-level operations in the Book activity module.
 * Displays actions like edit, hide/show, move up/down, and delete based on user permissions.
 * 
 * Features:
 * - Permission-based action visibility
 * - Confirmation dialog for destructive operations
 * - Integration with React Router for navigation
 * - MUI components for consistent styling
 * - TypeScript strict mode compliance
 */

import React, { useState, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

/**
 * Props interface for ChapterActionMenu component
 */
export interface ChapterActionMenuProps {
  /** Unique identifier for the chapter */
  chapterId: number;
  
  /** Unique identifier for the parent book */
  bookId: number;
  
  /** Whether the chapter is currently hidden */
  isHidden: boolean;
  
  /** Whether the user has edit permissions */
  canEdit: boolean;
  
  /** Callback function when delete action is confirmed */
  onDelete: (chapterId: number) => void | Promise<void>;
  
  /** Callback function when visibility is toggled */
  onToggleVisibility: (chapterId: number, currentlyHidden: boolean) => void | Promise<void>;
  
  /** Callback function when move action is triggered */
  onMove: (chapterId: number, direction: 'up' | 'down') => void | Promise<void>;
  
  /** Whether the chapter is the first in the book (optional) */
  isFirst?: boolean;
  
  /** Whether the chapter is the last in the book (optional) */
  isLast?: boolean;
  
  /** Optional CSS class name */
  className?: string;
}

/**
 * ChapterActionMenu Component
 * 
 * Displays a menu with chapter management actions based on user permissions.
 */
export const ChapterActionMenu: React.FC<ChapterActionMenuProps> = ({
  chapterId,
  bookId,
  isHidden,
  canEdit,
  onDelete,
  onToggleVisibility,
  onMove,
  isFirst = false,
  isLast = false,
  className,
}) => {
  const navigate = useNavigate();
  
  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  
  /**
   * Opens the action menu
   */
  const handleMenuOpen = (event: MouseEvent<HTMLElement>): void => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };
  
  /**
   * Closes the action menu
   */
  const handleMenuClose = (): void => {
    setAnchorEl(null);
  };
  
  /**
   * Navigates to the chapter edit page
   */
  const handleEdit = (): void => {
    handleMenuClose();
    navigate(`/mod/book/${bookId}/edit/${chapterId}`);
  };
  
  /**
   * Toggles chapter visibility (hide/show)
   */
  const handleToggleVisibility = async (): Promise<void> => {
    handleMenuClose();
    try {
      await onToggleVisibility(chapterId, isHidden);
    } catch (error) {
      console.error('Failed to toggle chapter visibility:', error);
    }
  };
  
  /**
   * Moves chapter up in the order
   */
  const handleMoveUp = async (): Promise<void> => {
    handleMenuClose();
    try {
      await onMove(chapterId, 'up');
    } catch (error) {
      console.error('Failed to move chapter up:', error);
    }
  };
  
  /**
   * Moves chapter down in the order
   */
  const handleMoveDown = async (): Promise<void> => {
    handleMenuClose();
    try {
      await onMove(chapterId, 'down');
    } catch (error) {
      console.error('Failed to move chapter down:', error);
    }
  };
  
  /**
   * Opens the delete confirmation dialog
   */
  const handleDeleteClick = (): void => {
    handleMenuClose();
    setDeleteDialogOpen(true);
  };
  
  /**
   * Closes the delete confirmation dialog
   */
  const handleDeleteDialogClose = (): void => {
    setDeleteDialogOpen(false);
  };
  
  /**
   * Confirms and executes the delete action
   */
  const handleDeleteConfirm = async (): Promise<void> => {
    setIsDeleting(true);
    try {
      await onDelete(chapterId);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Failed to delete chapter:', error);
    } finally {
      setIsDeleting(false);
    }
  };
  
  // If user doesn't have edit permissions, don't render the menu
  if (!canEdit) {
    return null;
  }
  
  return (
    <>
      {/* Menu Trigger Button */}
      <Tooltip title="Chapter actions">
        <IconButton
          aria-label="chapter actions"
          aria-controls={menuOpen ? 'chapter-action-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={menuOpen ? 'true' : undefined}
          onClick={handleMenuOpen}
          className={className}
          size="small"
        >
          <MoreVertIcon />
        </IconButton>
      </Tooltip>
      
      {/* Action Menu */}
      <Menu
        id="chapter-action-menu"
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        MenuListProps={{
          'aria-labelledby': 'chapter-action-button',
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {/* Edit Action */}
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit chapter</ListItemText>
        </MenuItem>
        
        {/* Hide/Show Action */}
        <MenuItem onClick={handleToggleVisibility}>
          <ListItemIcon>
            {isHidden ? (
              <VisibilityIcon fontSize="small" />
            ) : (
              <VisibilityOffIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {isHidden ? 'Show chapter' : 'Hide chapter'}
          </ListItemText>
        </MenuItem>
        
        <Divider />
        
        {/* Move Up Action */}
        <MenuItem onClick={handleMoveUp} disabled={isFirst}>
          <ListItemIcon>
            <ArrowUpwardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Move up</ListItemText>
        </MenuItem>
        
        {/* Move Down Action */}
        <MenuItem onClick={handleMoveDown} disabled={isLast}>
          <ListItemIcon>
            <ArrowDownwardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Move down</ListItemText>
        </MenuItem>
        
        <Divider />
        
        {/* Delete Action */}
        <MenuItem onClick={handleDeleteClick}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText
            primary="Delete chapter"
            primaryTypographyProps={{ color: 'error' }}
          />
        </MenuItem>
      </Menu>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteDialogClose}
        aria-labelledby="delete-chapter-dialog-title"
        aria-describedby="delete-chapter-dialog-description"
      >
        <DialogTitle id="delete-chapter-dialog-title">
          Delete chapter?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-chapter-dialog-description">
            Are you sure you want to delete this chapter? This action cannot be undone.
            All content in this chapter will be permanently removed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleDeleteDialogClose}
            disabled={isDeleting}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            disabled={isDeleting}
            color="error"
            variant="contained"
            autoFocus
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ChapterActionMenu;
