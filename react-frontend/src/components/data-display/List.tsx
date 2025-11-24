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

import type { ReactNode, MouseEvent } from 'react';
import React, { useMemo, useCallback } from 'react';
import {
  List as MuiList,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  ListItemButton,
  Avatar,
  IconButton,
  Box,
  type ListItemProps,
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
function List({
  items,
  dense = false,
  renderItem,
  onItemClick,
  showDividers = false,
  ariaLabel,
  className,
  sx,
}: ListProps): JSX.Element {
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
   * @param item - The list item data
   * @param index - The item index for divider calculation
   * @param totalItems - Total number of items for divider calculation
   */
  const renderDefaultItem = useCallback(
    (item: ListItemData, index: number, totalItems: number): ReactNode => {
      const hasClick = Boolean(item.onClick ?? onItemClick);
      const shouldShowDivider = showDividers && index < totalItems - 1;

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
      // ListItemButton must be wrapped in ListItem for proper accessibility
      if (hasClick) {
        return (
          <ListItem
            key={item.id}
            disabled={item.disabled}
            divider={shouldShowDivider}
            disablePadding
          >
            <ListItemButton
              disabled={item.disabled}
              onClick={(event) => handleItemClick(item, event)}
              aria-label={typeof item.primary === 'string' ? item.primary : undefined}
              sx={{ width: '100%' }}
            >
              {itemContent}
            </ListItemButton>
          </ListItem>
        );
      }

      return (
        <ListItem
          key={item.id}
          disabled={item.disabled}
          divider={shouldShowDivider}
          aria-label={typeof item.primary === 'string' ? item.primary : undefined}
        >
          {itemContent}
        </ListItem>
      );
    },
    [handleItemClick, onItemClick, renderAvatar, renderActions, showDividers]
  );

  /**
   * Memoized list items to prevent unnecessary re-renders
   */
  const listItems = useMemo(() => {
    return items.map((item, index) => {
      const shouldShowDivider = showDividers && index < items.length - 1;

      // Use custom renderer if provided
      if (renderItem) {
        const customItem = renderItem(item, index);

        // If custom renderer returns a ListItem or ListItemButton, use it directly
        // Clone it to add divider prop if needed
        if (React.isValidElement(customItem)) {
          // Check if it's a ListItem to add divider prop
          if (customItem.type === ListItem) {
            return React.cloneElement(customItem as React.ReactElement<ListItemProps>, {
              key: item.id,
              divider: shouldShowDivider,
            });
          }
          // For other elements, wrap in ListItem with divider
          return (
            <ListItem key={item.id} divider={shouldShowDivider}>
              {customItem}
            </ListItem>
          );
        }

        // Otherwise wrap in ListItem with divider
        return (
          <ListItem key={item.id} divider={shouldShowDivider}>
            {customItem}
          </ListItem>
        );
      }

      // Use default renderer (already includes divider prop)
      return renderDefaultItem(item, index, items.length);
    });
  }, [items, renderItem, showDividers, renderDefaultItem]);

  return (
    <MuiList dense={dense} aria-label={ariaLabel} className={className} sx={sx}>
      {listItems}
    </MuiList>
  );
}

export default List;
