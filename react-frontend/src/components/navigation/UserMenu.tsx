/**
 * User Menu Component
 *
 * React component for user profile dropdown menu in the application header.
 * Displays user avatar, name, and email with a dropdown menu containing Profile,
 * Settings, Preferences, Help, and Logout options.
 *
 * Features:
 * - User avatar with initials fallback (firstname + lastname)
 * - Dropdown menu with Material-UI components
 * - Integration with Redux auth state for user information
 * - React Router navigation to profile, settings, and preferences pages
 * - Redux dispatch for logout action
 * - Proper accessibility with ARIA attributes and keyboard navigation
 * - Visual feedback on hover and active states
 * - Focus management for screen readers
 *
 * Architecture:
 * - Uses Redux useAppSelector to access auth.user state
 * - Uses useAppDispatch to dispatch logout action
 * - Uses useNavigate for client-side navigation
 * - Uses useLocation to detect current route for highlighting
 *
 * Accessibility:
 * - WCAG 2.1 AA compliant
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Screen reader support with ARIA labels
 * - Focus management for menu items
 *
 * @module components/navigation/UserMenu
 */

import type React from 'react';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
} from '@mui/material';
import {
  AccountCircle,
  Settings,
  HelpOutline,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useAppDispatch } from '@/app/store';
import { useAppSelector } from '@/app/store';
import { logout } from '@/features/auth/store/authSlice';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * UserMenu component props
 *
 * Optional className for custom styling of the container element
 */
export interface UserMenuProps {
  /**
   * Optional CSS class name for custom styling
   * Applied to the root IconButton element
   */
  className?: string;
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * UserMenu Component
 *
 * Displays a user profile dropdown menu with avatar, name, and menu options.
 * Integrates with Redux for auth state and logout, React Router for navigation.
 *
 * Menu Items:
 * - View Profile: Navigate to /profile
 * - Settings: Navigate to /settings
 * - Preferences: Navigate to /preferences
 * - Help Documentation: Navigate to /help
 * - Logout: Dispatch logout action and clear auth state
 *
 * Usage Example:
 * ```tsx
 * import { UserMenu } from '@/components/navigation/UserMenu';
 *
 * function Header() {
 *   return (
 *     <AppBar>
 *       <Toolbar>
 *         <Typography variant="h6">Moodle</Typography>
 *         <UserMenu />
 *       </Toolbar>
 *     </AppBar>
 *   );
 * }
 * ```
 *
 * @param props - Component props
 * @returns UserMenu component with dropdown functionality
 */
export default function UserMenu({ className }: UserMenuProps): React.ReactElement | null {
  // ============================================================================
  // Hooks
  // ============================================================================

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // Access current user from Redux auth state
  const user = useAppSelector((state) => state.auth.user);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  // Local state for menu anchor element (controls open/close)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // Early return if user is not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Open menu on avatar button click
   * Sets anchor element for menu positioning
   */
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  /**
   * Handle keyboard events for menu button
   * Opens menu on Enter or Space key press for accessibility
   *
   * @param event - Keyboard event
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setAnchorEl(event.currentTarget);
    }
  };

  /**
   * Close menu
   * Clears anchor element
   */
  const handleMenuClose = (): void => {
    setAnchorEl(null);
  };

  /**
   * Navigate to user profile page
   * Closes menu and navigates to /profile route
   */
  const handleProfileClick = (): void => {
    handleMenuClose();
    navigate('/profile');
  };

  /**
   * Navigate to settings page
   * Closes menu and navigates to /settings route
   */
  const handleSettingsClick = (): void => {
    handleMenuClose();
    navigate('/settings');
  };

  /**
   * Navigate to preferences page
   * Closes menu and navigates to /preferences route
   */
  const handlePreferencesClick = (): void => {
    handleMenuClose();
    navigate('/preferences');
  };

  /**
   * Open help documentation
   * Opens help in new window or navigates to /help route
   */
  const handleHelpClick = (): void => {
    handleMenuClose();
    // Navigate to help page (could also open external link)
    navigate('/help');
  };

  /**
   * Logout user
   * Dispatches Redux logout action to clear auth state and JWT tokens
   * Navigates to login page after logout completes
   */
  const handleLogoutClick = (): void => {
    handleMenuClose();
    // Dispatch logout action to clear Redux auth state
    dispatch(logout());
    // Navigate to login page
    navigate('/login');
  };

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Get user initials from firstname and lastname
   * Falls back to parsing fullname if firstname/lastname not available
   * Falls back to 'U' if no name information available
   *
   * @returns Two-letter initials or fallback
   */
  const getUserInitials = (): string => {
    if (!user) {
      return 'U';
    }

    // Try to get initials from firstname and lastname
    const firstInitial = user.firstname?.charAt(0)?.toUpperCase() || '';
    const lastInitial = user.lastname?.charAt(0)?.toUpperCase() || '';

    if (firstInitial && lastInitial) {
      return `${firstInitial}${lastInitial}`;
    }

    // If firstname or lastname exists, use what we have
    if (firstInitial || lastInitial) {
      return firstInitial || lastInitial;
    }

    // Fall back to parsing fullname
    if (user.fullname) {
      const nameParts = user.fullname.trim().split(/\s+/);
      if (nameParts.length >= 2 && nameParts[0] && nameParts[1]) {
        return `${nameParts[0].charAt(0).toUpperCase()}${nameParts[1].charAt(0).toUpperCase()}`;
      }
      if (nameParts.length === 1 && nameParts[0]) {
        return nameParts[0].charAt(0).toUpperCase();
      }
    }

    return 'U';
  };

  /**
   * Get user's full display name
   * Combines firstname and lastname, falls back to username or 'User'
   *
   * @returns Full name string
   */
  const getUserFullName = (): string => {
    if (!user) {
      return 'User';
    }

    if (user.fullname) {
      return user.fullname;
    }

    const parts = [user.firstname, user.lastname].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' ');
    }

    return user.username || 'User';
  };

  /**
   * Check if menu item is for current route
   * Used to highlight active menu items
   *
   * @param path - Route path to check
   * @returns true if current location matches path
   */
  const isActiveRoute = (path: string): boolean => {
    return location.pathname === path;
  };

  // ============================================================================
  // Computed Values
  // ============================================================================

  const userInitials = getUserInitials();
  const userFullName = getUserFullName();
  const userEmail = user?.email ?? '';

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <>
      {/* Avatar Button - Opens Menu */}
      <IconButton
        onClick={handleMenuOpen}
        onKeyDown={handleKeyDown}
        size="small"
        className={className}
        sx={{ ml: 2 }}
        aria-controls="user-menu"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`User menu for ${userFullName}`}
        data-testid="user-menu-button"
      >
        <Avatar
          src={user.profileimageurl ?? undefined}
          sx={{
            width: 36,
            height: 36,
            bgcolor: 'primary.main',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
          alt={userFullName}
        >
          {userInitials}
        </Avatar>
      </IconButton>

      {/* Dropdown Menu */}
      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        onClick={handleMenuClose}
        MenuListProps={{
          'aria-labelledby': 'user-menu-button',
          role: 'menu',
        }}
        PaperProps={{
          elevation: 3,
          sx: {
            overflow: 'visible',
            mt: 1.5,
            minWidth: 240,
            '& .MuiAvatar-root': {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1,
            },
            // Arrow pointer at top
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* User Info Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {userFullName}
          </Typography>
          {userEmail && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {userEmail}
            </Typography>
          )}
        </Box>

        {/* Profile Menu Item */}
        <MenuItem
          onClick={handleProfileClick}
          selected={isActiveRoute('/profile')}
          data-testid="menu-item-profile"
          role="menuitem"
        >
          <ListItemIcon>
            <AccountCircle fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Profile</ListItemText>
        </MenuItem>

        {/* Settings Menu Item */}
        <MenuItem
          onClick={handleSettingsClick}
          selected={isActiveRoute('/settings')}
          data-testid="menu-item-settings"
          role="menuitem"
        >
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText>Settings</ListItemText>
        </MenuItem>

        {/* Preferences Menu Item */}
        <MenuItem
          onClick={handlePreferencesClick}
          selected={isActiveRoute('/preferences')}
          data-testid="menu-item-preferences"
          role="menuitem"
        >
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText>Preferences</ListItemText>
        </MenuItem>

        {/* Help Documentation Menu Item */}
        <MenuItem
          onClick={handleHelpClick}
          selected={isActiveRoute('/help')}
          data-testid="menu-item-help"
          role="menuitem"
        >
          <ListItemIcon>
            <HelpOutline fontSize="small" />
          </ListItemIcon>
          <ListItemText>Help Documentation</ListItemText>
        </MenuItem>

        {/* Divider before Logout */}
        <Divider />

        {/* Logout Menu Item */}
        <MenuItem
          onClick={handleLogoutClick}
          data-testid="menu-item-logout"
          role="menuitem"
          sx={{
            color: 'error.main',
            '&:hover': {
              backgroundColor: 'error.light',
              color: 'error.contrastText',
            },
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" sx={{ color: 'inherit' }} />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
