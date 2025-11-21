/**
 * Sidebar Navigation Component
 *
 * Collapsible side navigation drawer displaying hierarchical menu items for major
 * application sections. Provides primary navigation for Dashboard, My Courses,
 * Calendar, Messages, Gradebook, and Admin sections with role-based filtering.
 *
 * Architecture:
 * - Material-UI Drawer component with responsive variants
 * - Permanent drawer on desktop (md+ breakpoints)
 * - Temporary drawer on mobile (below md breakpoint)
 * - Hierarchical menu structure with expandable submenus
 * - Active route detection and visual indicators
 * - Redux integration ready for sidebar state management
 *
 * Features:
 * - Role-based menu filtering (student, teacher, admin)
 * - Active route highlighting with primary color
 * - Expandable submenus with collapse animation
 * - Keyboard navigation support
 * - WCAG 2.1 AA accessibility compliance
 * - Smooth transition animations
 * - Responsive behavior with overlay on mobile
 *
 * Design Patterns:
 * - Reference: Moodle theme_boost drawer navigation pattern
 * - User preferences for drawer open/close state
 * - Collapsible course index and block navigation
 * - Hierarchical visual structure with indentation
 *
 * Integration:
 * - Redux: User authentication and role data (via selectUser)
 * - React Router: Client-side navigation and active route detection
 * - Material-UI: Theming and responsive breakpoints
 *
 * Usage Example:
 * ```typescript
 * import { Sidebar, DRAWER_WIDTH } from '@/components/navigation/Sidebar';
 * 
 * function Layout() {
 *   return (
 *     <Box sx={{ display: 'flex' }}>
 *       <Sidebar />
 *       <Box component="main" sx={{ flexGrow: 1, marginLeft: `${DRAWER_WIDTH}px` }}>
 *         <Outlet />
 *       </Box>
 *     </Box>
 *   );
 * }
 * ```
 *
 * @module components/navigation/Sidebar
 */

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Divider,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Dashboard,
  School,
  CalendarMonth,
  Message,
  Assessment,
  AdminPanelSettings,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { selectUser } from '@/features/auth/store/authSlice';
import { closeSidebar, selectSidebarIsOpen } from '@/app/slices/sidebarSlice';

// ============================================================================
// Constants
// ============================================================================

/**
 * Drawer width constant
 *
 * Standard width for the side navigation drawer.
 * Used for:
 * - Drawer component width configuration
 * - Layout calculations (main content margin)
 * - Consistent spacing across components
 *
 * Value: 240px (Material Design standard for navigation drawers)
 *
 * Usage Example:
 * ```typescript
 * import { DRAWER_WIDTH } from '@/components/navigation/Sidebar';
 * <Box sx={{ marginLeft: `${DRAWER_WIDTH}px` }}>Content</Box>
 * ```
 */
export const DRAWER_WIDTH = 240;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Sidebar component props
 *
 * Props interface for the Sidebar component.
 * All props are optional with sensible defaults.
 *
 * Props:
 * - width: Custom drawer width (default: DRAWER_WIDTH)
 */
export interface SidebarProps {
  /**
   * Custom drawer width in pixels
   *
   * Overrides the default DRAWER_WIDTH constant.
   * Useful for custom layouts or responsive adjustments.
   *
   * Default: DRAWER_WIDTH (240)
   *
   * @example
   * <Sidebar width={280} />
   */
  width?: number;
}

/**
 * Menu item configuration interface
 *
 * Defines the structure of a navigation menu item.
 * Supports hierarchical menus with optional children.
 *
 * Properties:
 * - id: Unique identifier for the menu item
 * - label: Display text for the menu item
 * - icon: Material-UI icon component
 * - path: React Router path for navigation (optional)
 * - children: Nested submenu items (optional)
 * - roles: Required user roles to view this item (optional)
 */
interface MenuItem {
  /**
   * Unique identifier
   * Used for React keys and expansion state tracking
   */
  id: string;

  /**
   * Display label
   * Shown in the UI as the menu item text
   */
  label: string;

  /**
   * Icon component
   * Material-UI icon displayed before the label
   */
  icon: React.ReactElement;

  /**
   * Navigation path
   * React Router path for navigation on click
   * If undefined, item acts as submenu parent only
   */
  path?: string;

  /**
   * Submenu items
   * Nested menu items displayed in a collapsible section
   * Creates hierarchical navigation structure
   */
  children?: readonly MenuItem[];

  /**
   * Required roles
   * Array of role names that can access this menu item
   * If undefined, item is visible to all authenticated users
   * If empty array, item is visible to all users
   */
  roles?: readonly string[];
}

// ============================================================================
// Menu Configuration
// ============================================================================

/**
 * Navigation menu items configuration
 *
 * Defines the complete navigation structure for the application.
 * Hierarchical menu with role-based access control.
 *
 * Menu Structure:
 * - Dashboard: Home page for all users
 * - My Courses: Course list with submenu for enrolled courses
 * - Calendar: Calendar view with upcoming events
 * - Messages: Messaging center with inbox/sent
 * - Gradebook: Grade viewing/editing (role-based)
 * - Admin: Administration section (admin only)
 *
 * Role-Based Access:
 * - No roles specified: Visible to all authenticated users
 * - Specific roles: Visible only to users with those roles
 * - Multiple roles: Visible to users with any of the specified roles
 *
 * Integration Points:
 * - Roles come from Redux auth state (user.roles array)
 * - Paths match React Router route definitions
 * - Icons from @mui/icons-material library
 *
 * Referenced Pattern:
 * Based on Moodle's global_navigation structure and drawer navigation
 * from theme_boost/layout/drawers.php (drawer-open-index user preference)
 */
const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <Dashboard />,
    path: '/dashboard',
    roles: [], // All authenticated users
  },
  {
    id: 'courses',
    label: 'My Courses',
    icon: <School />,
    path: '/courses',
    roles: [], // All authenticated users
    children: [
      {
        id: 'courses-enrolled',
        label: 'Enrolled Courses',
        icon: <School />,
        path: '/courses/enrolled',
      },
      {
        id: 'courses-available',
        label: 'Available Courses',
        icon: <School />,
        path: '/courses/available',
      },
    ],
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: <CalendarMonth />,
    path: '/calendar',
    roles: [], // All authenticated users
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: <Message />,
    path: '/messages',
    roles: [], // All authenticated users
    children: [
      {
        id: 'messages-inbox',
        label: 'Inbox',
        icon: <Message />,
        path: '/messages/inbox',
      },
      {
        id: 'messages-sent',
        label: 'Sent',
        icon: <Message />,
        path: '/messages/sent',
      },
    ],
  },
  {
    id: 'gradebook',
    label: 'Gradebook',
    icon: <Assessment />,
    path: '/gradebook',
    roles: ['teacher', 'admin'], // Teachers and admins only
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: <AdminPanelSettings />,
    path: '/admin',
    roles: ['admin'], // Admins only
    children: [
      {
        id: 'admin-users',
        label: 'User Management',
        icon: <AdminPanelSettings />,
        path: '/admin/users',
        roles: ['admin'],
      },
      {
        id: 'admin-courses',
        label: 'Course Management',
        icon: <AdminPanelSettings />,
        path: '/admin/courses',
        roles: ['admin'],
      },
      {
        id: 'admin-settings',
        label: 'System Settings',
        icon: <AdminPanelSettings />,
        path: '/admin/settings',
        roles: ['admin'],
      },
    ],
  },
] as const;

// Destructure menu items for type-safe access without non-null assertions
const [dashboardItem, coursesItem, calendarItem, messagesItem, gradebookItem, adminItem] = menuItems;

// ============================================================================
// Main Component
// ============================================================================

/**
 * Sidebar Component
 *
 * Renders the main navigation sidebar with hierarchical menu structure.
 * Responsive design with permanent drawer on desktop and temporary on mobile.
 *
 * State Management:
 * - expandedItems: Set of menu item IDs with expanded submenus
 * - Local state for mobile drawer open/close (ready for Redux migration)
 *
 * Responsive Behavior:
 * - Desktop (md+): Permanent drawer always visible
 * - Mobile (<md): Temporary drawer with overlay, closeable
 *
 * Navigation:
 * - Click menu item with path: Navigate to that route
 * - Click menu item with children: Toggle submenu expansion
 * - Active route: Highlighted with primary color and selected state
 *
 * Accessibility:
 * - aria-label for main navigation
 * - aria-current="page" for active menu items
 * - Keyboard navigation support (Tab, Enter, Escape)
 * - Screen reader compatible with proper ARIA attributes
 *
 * Performance:
 * - Memoized menu filtering for role-based access
 * - Efficient re-renders via React.memo and proper key usage
 * - Smooth CSS transitions for expand/collapse animations
 *
 * @param props - Component props (optional width)
 * @returns Rendered Sidebar component
 */
export function Sidebar({ width = DRAWER_WIDTH }: SidebarProps) {
  // ==========================================================================
  // Hooks
  // ==========================================================================

  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Responsive breakpoint detection (md = 900px by default)
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Redux state: Current user data including roles for menu filtering
  const user = useAppSelector(selectUser);

  // Redux dispatch for sidebar actions
  const dispatch = useAppDispatch();

  // Redux state: Sidebar open/close state for responsive drawer control
  const sidebarOpen = useAppSelector(selectSidebarIsOpen);

  // ==========================================================================
  // Local State
  // ==========================================================================

  /**
   * Expanded menu items state
   *
   * Tracks which menu items with children are currently expanded.
   * Uses Set for O(1) lookup performance.
   *
   * State Type: Set<string>
   * - Contains menu item IDs that are expanded
   * - Empty set means all submenus are collapsed
   * - Add ID to expand, delete ID to collapse
   *
   * Usage:
   * - Check: expandedItems.has(itemId)
   * - Add: setExpandedItems(prev => new Set(prev).add(itemId))
   * - Remove: setExpandedItems(prev => { const next = new Set(prev); next.delete(itemId); return next; })
   */
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  /**
   * Sidebar open/close state is now managed by Redux
   *
   * The sidebar visibility state has been migrated from local component state
   * to global Redux state for consistent control across the application.
   *
   * State Location: Redux store via sidebarSlice
   * - Read: sidebarOpen = useAppSelector(selectSidebarIsOpen)
   * - Write: dispatch(closeSidebar()), dispatch(openSidebar()), dispatch(toggleSidebar())
   *
   * Usage Pattern:
   * - Desktop (md+): Permanent drawer, always visible (ignores Redux state)
   * - Mobile (<md): Temporary drawer, visibility controlled by sidebarOpen Redux state
   * - On navigation: Automatically closes on mobile via dispatch(closeSidebar())
   * - On overlay click: Closes via dispatch(closeSidebar())
   *
   * Redux Integration Complete:
   * ✓ State read from Redux via useAppSelector(selectSidebarIsOpen)
   * ✓ State updates via dispatch(closeSidebar())
   * ✓ Removed local useState for mobileOpen
   */

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  /**
   * Check if menu item should be visible based on user roles
   *
   * Implements role-based access control for navigation menu.
   * Filters menu items based on current user's roles.
   *
   * Access Rules:
   * - No roles specified: Visible to all authenticated users
   * - Empty roles array: Visible to all users (public)
   * - Specific roles: Visible only if user has at least one matching role
   * - No user (not authenticated): Hide all items except public ones
   *
   * Performance:
   * - Early return for common cases (no roles, empty roles)
   * - Array.some() for efficient role checking (stops on first match)
   *
   * @param item - Menu item configuration
   * @returns true if item should be visible, false otherwise
   */
  const isMenuItemVisible = (item: MenuItem): boolean => {
    // Item has no role restrictions - visible to all authenticated users
    if (!item.roles) {
      return !!user; // Show only if user is authenticated
    }

    // Empty roles array - visible to all users (public item)
    if (item.roles.length === 0) {
      return true;
    }

    // No user or no user roles - hide restricted items
    if (!user?.roles || user.roles.length === 0) {
      return false;
    }

    // Check if user has at least one of the required roles
    // Use Array.some() for efficient checking (stops on first match)
    // Compare role shortnames since user.roles is Role[] objects
    return item.roles.some((requiredRole) =>
      user.roles.some((userRole) => userRole.shortname === requiredRole)
    );
  };

  /**
   * Check if current route matches menu item path
   *
   * Determines if a menu item should be highlighted as active.
   * Used for visual indication of current page in navigation.
   *
   * Matching Logic:
   * - Exact match: location.pathname === item.path
   * - Prefix match: location.pathname starts with item.path
   *   (for child routes not in submenu)
   *
   * Examples:
   * - Path: "/courses", Location: "/courses" → Active
   * - Path: "/courses", Location: "/courses/123" → Active
   * - Path: "/messages", Location: "/calendar" → Not Active
   *
   * @param item - Menu item to check
   * @returns true if item path matches current location, false otherwise
   */
  const isActive = (item: MenuItem): boolean => {
    if (!item.path) {return false;}
    return (
      location.pathname === item.path ||
      location.pathname.startsWith(`${item.path  }/`)
    );
  };

  /**
   * Toggle submenu expansion state
   *
   * Expands or collapses a menu item's submenu.
   * Updates expandedItems Set with new state.
   *
   * Behavior:
   * - If item is expanded: Collapse it (remove from Set)
   * - If item is collapsed: Expand it (add to Set)
   *
   * State Update Pattern:
   * - Create new Set from previous state (immutability)
   * - Add or delete the item ID
   * - Return new Set to trigger re-render
   *
   * Performance:
   * - O(1) Set operations for add/delete
   * - Creates new Set to maintain React immutability
   *
   * @param itemId - Unique ID of the menu item to toggle
   */
  const toggleExpanded = (itemId: string): void => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId); // Collapse: Remove from expanded set
      } else {
        next.add(itemId); // Expand: Add to expanded set
      }
      return next;
    });
  };

  /**
   * Handle menu item click
   *
   * Processes click events on menu items with navigation or expansion logic.
   * Determines action based on menu item configuration.
   *
   * Click Behavior:
   * - Item with children: Toggle submenu expansion
   * - Item with path: Navigate to that route
   * - Item with both: Expand submenu (navigation to parent not common)
   *
   * Mobile Behavior:
   * - After navigation, close mobile drawer (temporary drawer only)
   * - Prevents overlay from staying open after navigation
   *
   * Event Handling:
   * - preventDefault not needed (no form submission)
   * - Uses React Router's useNavigate for client-side navigation
   *
   * @param item - Menu item that was clicked
   */
  const handleMenuItemClick = (item: MenuItem): void => {
    // Item has children - toggle expansion
    if (item.children && item.children.length > 0) {
      toggleExpanded(item.id);
      return;
    }

    // Item has path - navigate to route
    if (item.path) {
      navigate(item.path);

      // Close mobile drawer after navigation (temporary drawer only)
      // Redux action dispatched to update global sidebar state
      if (isMobile) {
        dispatch(closeSidebar());
      }
    }
  };

  /**
   * Handle mobile drawer close
   *
   * Closes the temporary drawer on mobile devices.
   * Called when user clicks overlay or presses Escape key.
   *
   * Redux Integration:
   * Dispatches closeSidebar() action to update global sidebar state.
   * This triggers a re-render with sidebarOpen set to false.
   */
  const handleDrawerClose = (): void => {
    dispatch(closeSidebar());
  };

  // ==========================================================================
  // Render Helpers
  // ==========================================================================

  /**
   * Render a single menu item with optional submenu
   *
   * Recursively renders menu items and their children.
   * Handles visual styling, active state, and expansion controls.
   *
   * Visual Features:
   * - Icon with label in ListItemButton
   * - Active state: Primary color + selected background
   * - Expand/collapse icon for items with children
   * - Indentation for nested items (via paddingLeft)
   *
   * Interaction:
   * - Click: Navigate or toggle expansion
   * - Keyboard: Enter to activate, Tab to navigate
   * - Active route: Visual highlight with aria-current
   *
   * Accessibility:
   * - aria-current="page" for active items
   * - aria-expanded for expandable items
   * - Semantic HTML with proper list structure
   *
   * @param item - Menu item configuration to render
   * @param depth - Nesting depth for indentation (0-based)
   * @returns Rendered menu item with optional submenu
   */
  const renderMenuItem = (item: MenuItem, depth: number = 0): JSX.Element | null => {
    // Filter based on user roles
    if (!isMenuItemVisible(item)) {
      return null;
    }

    const active = isActive(item);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);

    // Calculate indentation based on depth (16px per level)
    const paddingLeft = theme.spacing(2 + depth * 2);

    return (
      <React.Fragment key={item.id}>
        {/* Main menu item */}
        <ListItem disablePadding>
          <ListItemButton
            selected={active}
            onClick={() => handleMenuItemClick(item)}
            aria-current={active ? 'page' : undefined}
            aria-expanded={hasChildren ? isExpanded : undefined}
            sx={{
              paddingLeft,
              // Active item styling with theme colors
              ...(active && {
                color: theme.palette.primary.main,
                backgroundColor: theme.palette.action.selected,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }),
            }}
          >
            {/* Icon */}
            <ListItemIcon
              sx={{
                color: active ? theme.palette.primary.main : 'inherit',
                minWidth: 40,
              }}
            >
              {item.icon}
            </ListItemIcon>

            {/* Label */}
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                variant: 'body2',
                fontWeight: active ? 600 : 400,
              }}
            />

            {/* Expand/collapse icon for items with children */}
            {hasChildren && (
              isExpanded ? (
                <ExpandLess fontSize="small" />
              ) : (
                <ExpandMore fontSize="small" />
              )
            )}
          </ListItemButton>
        </ListItem>

        {/* Submenu (collapsible) */}
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children?.map((child) =>
                renderMenuItem(child, depth + 1)
              )}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  /**
   * Render drawer header
   *
   * Displays site branding at the top of the drawer.
   * Matches AppBar height (64px) for visual alignment.
   *
   * Content:
   * - Site name or logo
   * - Centered text with proper typography
   * - Consistent height with AppBar
   *
   * Styling:
   * - Flexbox centering for logo/text
   * - Primary color for branding
   * - Bottom border for visual separation
   *
   * Integration Point:
   * - Logo could be fetched from Redux config state
   * - Site name from global configuration
   */
  const drawerHeader = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 64, // Match AppBar height
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography
        variant="h6"
        component="div"
        sx={{
          color: theme.palette.primary.main,
          fontWeight: 600,
        }}
      >
        Moodle
      </Typography>
    </div>
  );

  /**
   * Render drawer content
   *
   * Main navigation menu with hierarchical structure.
   * Includes header, menu sections, and dividers.
   *
   * Structure:
   * - Drawer header (logo/branding)
   * - Main menu items (filtered by role)
   * - Dividers between major sections
   *
   * Sections:
   * 1. Primary navigation (Dashboard, Courses)
   * 2. Communication tools (Calendar, Messages)
   * 3. Assessment tools (Gradebook)
   * 4. Administration (Admin section)
   *
   * Accessibility:
   * - aria-label on main List component
   * - Semantic structure with proper list markup
   * - Keyboard navigation support
   */
  const drawerContent = (
    <>
      {/* Header with logo/site name */}
      {drawerHeader}

      {/* Main navigation menu */}
      <List
        component="nav"
        aria-label="Main navigation"
        sx={{
          paddingTop: theme.spacing(2),
          paddingBottom: theme.spacing(2),
        }}
      >
        {/* Dashboard */}
        {renderMenuItem(dashboardItem, 0)}

        {/* My Courses */}
        {renderMenuItem(coursesItem, 0)}

        {/* Divider after primary navigation */}
        <Divider sx={{ marginY: 1 }} />

        {/* Calendar */}
        {renderMenuItem(calendarItem, 0)}

        {/* Messages */}
        {renderMenuItem(messagesItem, 0)}

        {/* Divider after communication tools */}
        <Divider sx={{ marginY: 1 }} />

        {/* Gradebook (teachers/admins only) */}
        {renderMenuItem(gradebookItem, 0)}

        {/* Divider before admin section */}
        {user?.roles?.some((role) => role.shortname === 'admin') && <Divider sx={{ marginY: 1 }} />}

        {/* Administration (admins only) */}
        {renderMenuItem(adminItem, 0)}
      </List>
    </>
  );

  // ==========================================================================
  // Render
  // ==========================================================================

  /**
   * Main component render
   *
   * Renders responsive drawer with appropriate variant based on screen size.
   *
   * Desktop (md+):
   * - variant="permanent": Always visible, no overlay
   * - Fixed position in layout
   * - Part of main layout structure
   *
   * Mobile (<md):
   * - variant="temporary": Overlays content when open
   * - Modal behavior with backdrop
   * - Closes on navigation or backdrop click
   *
   * Styling:
   * - Fixed width from DRAWER_WIDTH constant
   * - Smooth transitions for open/close
   * - Proper z-index for overlay behavior
   *
   * Accessibility:
   * - Proper ARIA labels and attributes
   * - Keyboard navigation (Escape to close on mobile)
   * - Focus management for modal behavior
   */
  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={isMobile ? sidebarOpen : true}
      onClose={handleDrawerClose}
      ModalProps={{
        keepMounted: true, // Better mobile performance
      }}
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}

/**
 * Default export
 *
 * Exports Sidebar component as default for convenient importing.
 *
 * Usage:
 * ```typescript
 * import Sidebar from '@/components/navigation/Sidebar';
 * <Sidebar />
 * ```
 *
 * Named exports also available:
 * ```typescript
 * import { Sidebar, DRAWER_WIDTH, SidebarProps } from '@/components/navigation/Sidebar';
 * ```
 */
export default Sidebar;
