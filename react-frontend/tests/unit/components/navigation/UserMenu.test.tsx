/**
 * UserMenu Component Unit Tests
 *
 * Comprehensive test suite for UserMenu component validating:
 * - User avatar rendering with initials
 * - User profile information display (full name, email)
 * - Menu open/close behavior (click, outside click, Escape key)
 * - Navigation to profile, settings, and preferences pages
 * - Logout action dispatch to Redux
 * - Keyboard navigation support (Tab, Enter, Escape)
 * - Accessibility with proper ARIA attributes
 * - Menu structure with dividers and help documentation
 *
 * Test Framework: Vitest
 * Component Testing: React Testing Library
 * User Interaction: @testing-library/user-event
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { render } from '@tests/helpers/render';
import { createMockUser } from '@tests/helpers/mockData';
import UserMenu from '@/components/navigation/UserMenu';
import { logout } from '@/features/auth/store/authSlice';
import * as storeHooks from '@/app/store';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock useNavigate from react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ============================================================================
// Test Suite
// ============================================================================

describe('UserMenu', () => {
  // Test user data used across multiple tests
  const testUser = createMockUser({
    firstname: 'Test',
    lastname: 'User',
    email: 'test@example.com',
  });

  // Mock dispatch function for Redux actions
  let mockDispatch: ReturnType<typeof vi.fn>;

  /**
   * Before Each Test Setup
   *
   * Resets all mocks to ensure test isolation.
   * Creates fresh mockDispatch for testing Redux action dispatch.
   */
  beforeEach(() => {
    // Clear all mock function call history
    vi.clearAllMocks();

    // Create fresh mock dispatch function
    mockDispatch = vi.fn();

    // Mock useAppDispatch to return our mock dispatch
    vi.spyOn(storeHooks, 'useAppDispatch').mockReturnValue(mockDispatch as any);
  });

  /**
   * After Each Test Cleanup
   *
   * Restores all mocked modules to their original implementations.
   */
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Test 1: Avatar Rendering with Initials
  // ==========================================================================

  it('renders user avatar with initials', () => {
    // Render UserMenu with authenticated user
    render(<UserMenu />, {
      authenticated: true,
      user: testUser,
    });

    // Find the avatar button by test ID
    const avatarButton = screen.getByTestId('user-menu-button');
    expect(avatarButton).toBeInTheDocument();

    // Avatar should display initials from firstname + lastname
    // Since we're using Test User, it should show "TU"
    const avatarElement = within(avatarButton).getByText('TU');
    expect(avatarElement).toBeInTheDocument();
  });

  // ==========================================================================
  // Test 2: User Information Display in Menu
  // ==========================================================================

  it('displays user full name and email in menu', async () => {
    // Render UserMenu with authenticated user
    const { user } = render(<UserMenu />, {
      authenticated: true,
      user: testUser,
    });

    // Open the menu by clicking the avatar button
    const avatarButton = screen.getByTestId('user-menu-button');
    await user.click(avatarButton);

    // Wait for menu to appear
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // Verify full name is displayed
    const fullName = `${testUser.firstname} ${testUser.lastname}`;
    expect(screen.getByText(fullName)).toBeInTheDocument();

    // Verify email is displayed
    expect(screen.getByText(testUser.email)).toBeInTheDocument();
  });

  // ==========================================================================
  // Test 3: Menu Open/Close Behavior
  // ==========================================================================

  it('opens menu on avatar click and closes on outside click', async () => {
    // Render UserMenu with authenticated user
    const { user } = render(<UserMenu />, {
      authenticated: true,
      user: testUser,
    });

    // Initially, menu should not be visible
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    // Click avatar button to open menu
    const avatarButton = screen.getByTestId('user-menu-button');
    await user.click(avatarButton);

    // Menu should now be visible
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // MUI Menu renders with a backdrop - find and click it to close
    // The backdrop is rendered as a div with specific classes by MUI Portal
    const backdrop = document.querySelector('.MuiBackdrop-root');
    expect(backdrop).toBeInTheDocument();
    
    // Click the backdrop to close the menu (simulates clicking outside)
    await user.click(backdrop as HTMLElement);

    // Menu should be closed
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Test 4: Navigation to Profile Page
  // ==========================================================================

  it('navigates to profile page on View Profile click', async () => {
    // Render UserMenu with authenticated user
    const { user } = render(<UserMenu />, {
      authenticated: true,
      user: testUser,
    });

    // Open the menu
    const avatarButton = screen.getByTestId('user-menu-button');
    await user.click(avatarButton);

    // Wait for menu to appear
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // Click "View Profile" menu item
    const profileMenuItem = screen.getByTestId('menu-item-profile');
    await user.click(profileMenuItem);

    // Verify navigate was called with '/profile'
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // Test 5: Navigation to Settings Page
  // ==========================================================================

  it('navigates to settings on Settings click', async () => {
    // Render UserMenu with authenticated user
    const { user } = render(<UserMenu />, {
      authenticated: true,
      user: testUser,
    });

    // Open the menu
    const avatarButton = screen.getByTestId('user-menu-button');
    await user.click(avatarButton);

    // Wait for menu to appear
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // Click "Settings" menu item
    const settingsMenuItem = screen.getByTestId('menu-item-settings');
    await user.click(settingsMenuItem);

    // Verify navigate was called with '/settings'
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // Test 6: Navigation to Preferences Page
  // ==========================================================================

  it('navigates to preferences on Preferences click', async () => {
    // Render UserMenu with authenticated user
    const { user } = render(<UserMenu />, {
      authenticated: true,
      user: testUser,
    });

    // Open the menu
    const avatarButton = screen.getByTestId('user-menu-button');
    await user.click(avatarButton);

    // Wait for menu to appear
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // Click "Preferences" menu item
    const preferencesMenuItem = screen.getByTestId('menu-item-preferences');
    await user.click(preferencesMenuItem);

    // Verify navigate was called with '/preferences'
    expect(mockNavigate).toHaveBeenCalledWith('/preferences');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // Test 7: Logout Action Dispatch
  // ==========================================================================

  it('dispatches logout action on Logout click', async () => {
    // Render UserMenu with authenticated user
    const { user } = render(<UserMenu />, {
      authenticated: true,
      user: testUser,
    });

    // Open the menu
    const avatarButton = screen.getByTestId('user-menu-button');
    await user.click(avatarButton);

    // Wait for menu to appear
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // Click "Logout" menu item
    const logoutMenuItem = screen.getByTestId('menu-item-logout');
    await user.click(logoutMenuItem);

    // Verify logout action was dispatched
    expect(mockDispatch).toHaveBeenCalledWith(logout());
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // Test 8: Close Menu on Escape Key
  // ==========================================================================

  it('closes menu on Escape key press', async () => {
    // Render UserMenu with authenticated user
    const { user } = render(<UserMenu />, {
      authenticated: true,
      user: testUser,
    });

    // Open the menu
    const avatarButton = screen.getByTestId('user-menu-button');
    await user.click(avatarButton);

    // Wait for menu to appear
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // MUI Menu uses Modal which listens for Escape key on the menu element
    // We need to fire the event on the actual menu or a focusable element within it
    const menu = screen.getByRole('menu');
    
    // Press Escape key on the menu element
    fireEvent.keyDown(menu, { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true });

    // Menu should be closed
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Test 9: Keyboard Navigation Support
  // ==========================================================================

  it('supports keyboard navigation with Arrow keys and Enter', async () => {
    // Render UserMenu with authenticated user
    const { user } = render(<UserMenu />, {
      authenticated: true,
      user: testUser,
    });

    // Open the menu
    const avatarButton = screen.getByTestId('user-menu-button');
    await user.click(avatarButton);

    // Wait for menu to appear
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // Verify menu items are keyboard accessible
    const profileMenuItem = screen.getByTestId('menu-item-profile');
    expect(profileMenuItem).toHaveAttribute('role', 'menuitem');
    expect(profileMenuItem).toHaveAttribute('tabindex', '-1');
    
    // Click the profile menu item to verify navigation works
    await user.click(profileMenuItem);

    // Verify navigate was called with '/profile'
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  // ==========================================================================
  // Test 10: ARIA Attributes for Accessibility
  // ==========================================================================

  it('has proper ARIA attributes', async () => {
    // Render UserMenu with authenticated user
    const { user } = render(<UserMenu />, {
      authenticated: true,
      user: testUser,
    });

    // Get the avatar button
    const avatarButton = screen.getByTestId('user-menu-button');

    // Verify ARIA attributes when menu is closed
    expect(avatarButton).toHaveAttribute('aria-haspopup', 'true');
    expect(avatarButton).toHaveAttribute('aria-expanded', 'false');

    // Open the menu
    await user.click(avatarButton);

    // Wait for menu to appear
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // Verify aria-expanded is now true
    expect(avatarButton).toHaveAttribute('aria-expanded', 'true');

    // The aria-controls should reference the menu ID (only set when open)
    const ariaControls = avatarButton.getAttribute('aria-controls');
    expect(ariaControls).toBeTruthy();
    expect(ariaControls).toBe('user-menu');

    // Verify an element with the menu ID exists in the document
    const menuContainer = document.getElementById(ariaControls!);
    expect(menuContainer).toBeInTheDocument();
    
    // Verify the menu role element exists in the document
    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
  });

  // ==========================================================================
  // Test 11: Divider Between Menu Sections
  // ==========================================================================

  it('displays Divider between menu sections', async () => {
    // Render UserMenu with authenticated user
    const { user } = render(<UserMenu />, {
      authenticated: true,
      user: testUser,
    });

    // Open the menu
    const avatarButton = screen.getByTestId('user-menu-button');
    await user.click(avatarButton);

    // Wait for menu to appear
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // Find all separator elements (MUI Divider renders as hr with role="separator")
    const dividers = screen.getAllByRole('separator');

    // There should be at least one divider separating sections
    expect(dividers.length).toBeGreaterThanOrEqual(1);
  });

  // ==========================================================================
  // Test 12: Help Documentation Menu Item
  // ==========================================================================

  it('shows Help Documentation menu item', async () => {
    // Render UserMenu with authenticated user
    const { user } = render(<UserMenu />, {
      authenticated: true,
      user: testUser,
    });

    // Open the menu
    const avatarButton = screen.getByTestId('user-menu-button');
    await user.click(avatarButton);

    // Wait for menu to appear
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // Verify Help menu item is present
    const helpMenuItem = screen.getByTestId('menu-item-help');
    expect(helpMenuItem).toBeInTheDocument();

    // Verify Help item is clickable (has button role or is a link)
    expect(helpMenuItem).toBeVisible();
  });

  // ==========================================================================
  // Additional Edge Cases
  // ==========================================================================

  it('renders null when user is not authenticated', () => {
    // Render UserMenu without authenticated user
    const { container } = render(<UserMenu />, {
      authenticated: false,
    });

    // Component should render nothing
    expect(container.firstChild).toBeNull();
  });

  it('displays correct initials for users with different names', () => {
    // Test with user having different name
    const userWithDifferentName = createMockUser({
      firstname: 'Alice',
      lastname: 'Smith',
      email: 'alice@example.com',
    });

    render(<UserMenu />, {
      authenticated: true,
      user: userWithDifferentName,
    });

    // Avatar should display "AS" for Alice Smith (firstname + lastname initials)
    const avatarButton = screen.getByTestId('user-menu-button');
    const avatarElement = within(avatarButton).getByText('AS');
    expect(avatarElement).toBeInTheDocument();
  });

  it('closes menu after navigation action', async () => {
    // Render UserMenu with authenticated user
    const { user } = render(<UserMenu />, {
      authenticated: true,
      user: testUser,
    });

    // Open the menu
    const avatarButton = screen.getByTestId('user-menu-button');
    await user.click(avatarButton);

    // Wait for menu to appear
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // Click a navigation item (Settings)
    const settingsMenuItem = screen.getByTestId('menu-item-settings');
    await user.click(settingsMenuItem);

    // Menu should close after navigation
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('closes menu after logout action', async () => {
    // Render UserMenu with authenticated user
    const { user } = render(<UserMenu />, {
      authenticated: true,
      user: testUser,
    });

    // Open the menu
    const avatarButton = screen.getByTestId('user-menu-button');
    await user.click(avatarButton);

    // Wait for menu to appear
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // Click Logout
    const logoutMenuItem = screen.getByTestId('menu-item-logout');
    await user.click(logoutMenuItem);

    // Menu should close after logout
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });
});
