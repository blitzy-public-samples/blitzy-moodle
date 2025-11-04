/**
 * List Component
 * 
 * A flexible list component extending MUI List for displaying collections of items
 * with avatars, actions, and customizable rendering. Used throughout the application
 * for users, courses, assignments, messages, and forum discussions.
 * 
 * Features:
 * - Optional avatars (user photos, course icons)
 * - Primary and secondary text content
 * - Action buttons (edit, delete, view)
 * - Dense and comfortable spacing variants
 * - Dividers between items
 * - Interactive items with click handlers
 * - Disabled state support
 * - Customizable item rendering via render props
 * - Full keyboard navigation support
 * - WCAG 2.1 AA compliant
 * - Light and dark mode support via MUI theme
 */

import React, { FC, ReactNode, MouseEvent, useMemo, useCallback } from 'react';
import {
  List as MuiList,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  ListItemButton,
  Divider,
  Avatar,
  IconButton,
  Box,
} from '@mui/material';

/**
 * Action button definition for list items
 */
export interface ListItemAction {
  /** Unique identifier for the action */
  id: string;
  /** Icon component or element to display */
  icon: ReactNode;
  /** Accessible label for screen readers */
  label: string;
  /** Click handler for the action */
  onClick: (itemId: string | number, event: MouseEvent<HTMLButtonElement>) => void;
  /** Whether the action is disabled */
  disabled?: boolean;
}

/**
 * Data structure for individual list items
 */
export interface ListItemData {
  /** Unique identifier for the list item */
  id: string | number;
  /** Avatar source (image URL) or element to display */
  avatar?: string | ReactNode;
  /** Primary text content */
  primary: string | ReactNode;
  /** Secondary text content (optional) */
  secondary?: string | ReactNode;
  /** Array of action buttons to display */
  actions?: ListItemAction[];
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Click handler for the entire item */
  onClick?: (id: string | number, event: MouseEvent<HTMLDivElement>) => void;
}

/**
 * Props for the List component
 */
export interface ListProps {
  /** Array of items to display in the list */
  items: ListItemData[];
  /** Whether to use dense spacing (default: false) */
  dense?: boolean;
  /** Custom render function for list items (optional) */
  renderItem?: (item: ListItemData, index: number) => ReactNode;
  /** Global click handler for all items (overridden by item-specific onClick) */
  onItemClick?: (id: string | number, event: MouseEvent<HTMLDivElement>) => void;
  /** Whether to show dividers between items (default: false) */
  showDividers?: boolean;
  /** ARIA label for the list */
  ariaLabel?: string;
  /** Additional CSS class name */
  className?: string;
  /** Additional styles */
  sx?: object;
}

/**
 * List component for displaying collections of items with consistent styling
 * and interaction patterns throughout the Moodle React frontend.
 * 
 * @example
 * // Basic usage with users
 * <List
 *   items={users.map(user => ({
 *     id: user.id,
 *     avatar: user.profileImageUrl,
 *     primary: user.fullName,
 *     secondary: user.email,
 *     actions: [
 *       {
 *         id: 'edit',
 *         icon: <EditIcon />,
 *         label: 'Edit user',
 *         onClick: handleEditUser,
 *       },
 *     ],
 *   }))}
 *   dense
 *   showDividers
 *   ariaLabel="Users list"
 * />
 * 
 * @example
 * // Custom rendering
 * <List
 *   items={courses}
 *   renderItem={(course) => (
 *     <CustomCourseItem course={course} />
 *   )}
 *   ariaLabel="Courses list"
 * />
 */
const List: FC<ListProps> = ({
  items,
  dense = false,
  renderItem,
  onItemClick,
  showDividers = false,
  ariaLabel,
  className,
  sx,
}) => {
  /**
   * Handles click events for list items
   * Calls item-specific onClick if provided, otherwise falls back to global onItemClick
   */
  const handleItemClick = useCallback(
    (item: ListItemData, event: MouseEvent<HTMLDivElement>) => {
      // Don't trigger if the item is disabled
      if (item.disabled) {
        event.preventDefault();
        return;
      }

      // Call item-specific handler if provided
      if (item.onClick) {
        item.onClick(item.id, event);
      }
      // Otherwise call global handler
      else if (onItemClick) {
        onItemClick(item.id, event);
      }
    },
    [onItemClick]
  );

  /**
   * Renders an avatar element based on the provided avatar data
   */
  const renderAvatar = useCallback((avatar: string | ReactNode | undefined): ReactNode => {
    if (!avatar) {
      return null;
    }

    // If avatar is a string, treat it as an image URL
    if (typeof avatar === 'string') {
      return (
        <ListItemAvatar>
          <Avatar src={avatar} alt="" />
        </ListItemAvatar>
      );
    }

    // If avatar is a ReactNode, wrap it in ListItemAvatar if not already an Avatar
    if (React.isValidElement(avatar) && avatar.type === Avatar) {
      return <ListItemAvatar>{avatar}</ListItemAvatar>;
    }

    // Otherwise wrap the element in both Avatar and ListItemAvatar
    return (
      <ListItemAvatar>
        <Avatar>{avatar}</Avatar>
      </ListItemAvatar>
    );
  }, []);

  /**
   * Renders action buttons for a list item
   */
  const renderActions = useCallback(
    (actions: ListItemAction[] | undefined, itemId: string | number): ReactNode => {
      if (!actions || actions.length === 0) {
        return null;
      }

      return (
        <ListItemSecondaryAction>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {actions.map((action) => (
              <IconButton
                key={action.id}
                edge="end"
                aria-label={action.label}
                onClick={(event) => {
                  // Stop propagation to prevent item click
                  event.stopPropagation();
                  action.onClick(itemId, event);
                }}
                disabled={action.disabled}
                size="small"
              >
                {action.icon}
              </IconButton>
            ))}
          </Box>
        </ListItemSecondaryAction>
      );
    },
    []
  );

  /**
   * Renders a default list item using MUI components
   */
  const renderDefaultItem = useCallback(
    (item: ListItemData): ReactNode => {
      const hasClick = Boolean(item.onClick || onItemClick);

      // Shared content for both interactive and static items
      const itemContent = (
        <>
          {renderAvatar(item.avatar)}
          <ListItemText
            primary={item.primary}
            secondary={item.secondary}
            primaryTypographyProps={{
              noWrap: false,
              sx: { wordBreak: 'break-word' },
            }}
            secondaryTypographyProps={{
              noWrap: false,
              sx: { wordBreak: 'break-word' },
            }}
          />
          {renderActions(item.actions, item.id)}
        </>
      );

      // Use ListItemButton for interactive items, ListItem for static items
      if (hasClick) {
        return (
          <ListItemButton
            key={item.id}
            disabled={item.disabled}
            onClick={(event) => handleItemClick(item, event)}
            aria-label={typeof item.primary === 'string' ? item.primary : undefined}
          >
            {itemContent}
          </ListItemButton>
        );
      }

      return (
        <ListItem
          key={item.id}
          disabled={item.disabled}
          aria-label={typeof item.primary === 'string' ? item.primary : undefined}
        >
          {itemContent}
        </ListItem>
      );
    },
    [handleItemClick, onItemClick, renderAvatar, renderActions]
  );

  /**
   * Memoized list items to prevent unnecessary re-renders
   */
  const listItems = useMemo(() => {
    return items.map((item, index) => {
      // Use custom renderer if provided
      if (renderItem) {
        const customItem = renderItem(item, index);
        
        // If custom renderer returns a ListItem or ListItemButton, use it directly
        if (React.isValidElement(customItem)) {
          return (
            <React.Fragment key={item.id}>
              {customItem}
              {showDividers && index < items.length - 1 && (
                <Divider component="li" />
              )}
            </React.Fragment>
          );
        }
        
        // Otherwise wrap in ListItem
        return (
          <React.Fragment key={item.id}>
            <ListItem>{customItem}</ListItem>
            {showDividers && index < items.length - 1 && (
              <Divider component="li" />
            )}
          </React.Fragment>
        );
      }

      // Use default renderer
      return (
        <React.Fragment key={item.id}>
          {renderDefaultItem(item)}
          {showDividers && index < items.length - 1 && (
            <Divider component="li" />
          )}
        </React.Fragment>
      );
    });
  }, [items, renderItem, showDividers, renderDefaultItem]);

  return (
    <MuiList
      dense={dense}
      aria-label={ariaLabel}
      className={className}
      sx={sx}
    >
      {listItems}
    </MuiList>
  );
};

export default List;
