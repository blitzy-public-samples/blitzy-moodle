/**
 * Unit Tests for Sidebar Component
 * 
 * Comprehensive test suite validating collapsible side navigation drawer functionality.
 * Tests drawer rendering, hierarchical menu item display, menu item filtering based on
 * user roles/permissions, active route highlighting, expandable submenu behavior,
 * navigation on menu item click, responsive drawer variants (permanent on desktop,
 * temporary on mobile), drawer state synchronization with Redux, keyboard navigation,
 * and proper ARIA attributes.
 * 
 * @see react-frontend/src/components/navigation/Sidebar.tsx
 * @see Section 0.4 - Component unit tests with 90%+ coverage requirement
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render, userEvent } from '../../../helpers/render';
import {
  createStudentState,
  createTeacherState,
  createAdminState,
  createSidebarState,
} from '../../../helpers/mockStore';
import Sidebar, { DRAWER_WIDTH } from '@/components/navigation/Sidebar';

// ============================================================================
// Mock Setup
// ============================================================================

/**
 * Mock react-redux hooks
 * 
 * Mock useAppDispatch to track action dispatches during tests.
 * useAppSelector is NOT mocked - it uses the real Redux store from render().
 */
const mockDispatch = vi.fn();
vi.mock('react-redux', async () => {
  const actual = await vi.importActual('react-redux');
  return {
    ...actual,
    useDispatch: () => mockDispatch,
  };
});

/**
 * Mock react-router-dom hooks
 * 
 * Mock useNavigate to verify navigation calls without actual routing.
 * useLocation is NOT mocked - it uses the real MemoryRouter from render().
 */
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

/**
 * Mock MUI useMediaQuery hook
 * 
 * Controls responsive behavior in tests without changing window dimensions.
 * Default: desktop viewport (md+)
 */
let mockUseMediaQuery = vi.fn(() => true); // Default: desktop
vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material');
  return {
    ...actual,
    useMediaQuery: (query: string) => mockUseMediaQuery(query),
  };
});

// ============================================================================
// Test Suite
// ============================================================================

describe('Sidebar', () => {
  // Reset all mocks before each test for isolation
  beforeEach(() => {
    mockDispatch.mockClear();
    mockNavigate.mockClear();
    mockUseMediaQuery = vi.fn(() => true); // Reset to desktop
  });

  // Cleanup after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Drawer Width and Basic Rendering
  // ==========================================================================

  it('renders with correct drawer width', () => {
    const { container } = render(<Sidebar />, {
      initialState: createAdminState(),
    });

    // Find the Drawer component (MUI Drawer renders as a div with specific class)
    const drawer = container.querySelector('.MuiDrawer-root');
    expect(drawer).toBeInTheDocument();

    // Verify drawer paper has correct width
    const drawerPaper = container.querySelector('.MuiDrawer-paper');
    expect(drawerPaper).toBeInTheDocument();
    
    // Check that DRAWER_WIDTH constant is used (240px)
    expect(DRAWER_WIDTH).toBe(240);
    
    // Verify the computed styles contain the width
    // Note: In permanent drawer (desktop), width is applied via sx prop
    const style = window.getComputedStyle(drawerPaper as Element);
    expect(style.width).toBe(`${DRAWER_WIDTH}px`);
  });

  // ==========================================================================
  // Menu Item Filtering by Role
  // ==========================================================================

  it('displays all menu items for admin user', () => {
    render(<Sidebar />, {
      initialState: createAdminState(),
    });

    // Verify all menu sections are visible including admin-only sections
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('My Courses')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Gradebook')).toBeInTheDocument();
    
    // Admin-only section should be visible
    expect(screen.getByText('Administration')).toBeInTheDocument();
    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Course Management')).toBeInTheDocument();
    expect(screen.getByText('System Settings')).toBeInTheDocument();
  });

  it('filters menu items for student user', () => {
    render(<Sidebar />, {
      initialState: createStudentState(),
    });

    // Verify student sections are visible
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('My Courses')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Gradebook')).toBeInTheDocument();

    // Admin section should NOT be present
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
    expect(screen.queryByText('Course Management')).not.toBeInTheDocument();
    expect(screen.queryByText('System Settings')).not.toBeInTheDocument();
  });

  it('filters menu items for teacher user', () => {
    render(<Sidebar />, {
      initialState: createTeacherState(),
    });

    // Verify teacher sections are visible
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('My Courses')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Gradebook')).toBeInTheDocument();

    // Teachers can see Course Management but not full Administration
    expect(screen.getByText('Course Management')).toBeInTheDocument();
    
    // But not user management or system settings
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
    expect(screen.queryByText('System Settings')).not.toBeInTheDocument();
  });

  // ==========================================================================
  // Active Route Highlighting
  // ==========================================================================

  it('highlights active route', () => {
    render(<Sidebar />, {
      initialState: createAdminState(),
      initialRoute: '/dashboard',
    });

    // Find the Dashboard menu item
    const dashboardItem = screen.getByText('Dashboard').closest('a');
    expect(dashboardItem).toBeInTheDocument();

    // Verify it has the selected/active styling
    // MUI ListItemButton uses 'selected' prop which applies aria-current
    expect(dashboardItem).toHaveAttribute('aria-current', 'page');
    
    // Verify it has primary color styling
    const listItemButton = dashboardItem?.querySelector('.MuiListItemButton-root');
    expect(listItemButton).toHaveClass('Mui-selected');
  });

  // ==========================================================================
  // Submenu Expand/Collapse Behavior
  // ==========================================================================

  it('expands submenu on click', async () => {
    const user = userEvent.setup();
    
    render(<Sidebar />, {
      initialState: createAdminState(),
    });

    // Find a menu item with children (Administration)
    const adminMenuItem = screen.getByText('Administration');
    expect(adminMenuItem).toBeInTheDocument();

    // Initially, submenu items should not be visible (collapsed)
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();

    // Click to expand
    await user.click(adminMenuItem);

    // Wait for submenu to expand
    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('Course Management')).toBeInTheDocument();
      expect(screen.getByText('System Settings')).toBeInTheDocument();
    });

    // Verify ExpandMore icon changed to ExpandLess (check aria-expanded)
    const adminButton = adminMenuItem.closest('button');
    expect(adminButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses submenu on second click', async () => {
    const user = userEvent.setup();
    
    render(<Sidebar />, {
      initialState: createAdminState(),
    });

    const adminMenuItem = screen.getByText('Administration');

    // First click: expand
    await user.click(adminMenuItem);
    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });

    // Second click: collapse
    await user.click(adminMenuItem);
    await waitFor(() => {
      expect(screen.queryByText('User Management')).not.toBeInTheDocument();
    });

    // Verify aria-expanded is false
    const adminButton = adminMenuItem.closest('button');
    expect(adminButton).toHaveAttribute('aria-expanded', 'false');
  });

  // ==========================================================================
  // Navigation on Menu Item Click
  // ==========================================================================

  it('navigates on menu item click', async () => {
    const user = userEvent.setup();
    
    render(<Sidebar />, {
      initialState: createAdminState(),
      initialRoute: '/dashboard',
    });

    // Click on "My Courses" menu item
    const myCoursesItem = screen.getByText('My Courses');
    await user.click(myCoursesItem);

    // Verify navigate was called with correct path
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/courses');
    });
  });

  // ==========================================================================
  // Responsive Drawer Variants
  // ==========================================================================

  it('renders permanent drawer on desktop', () => {
    // Mock desktop viewport (md+)
    mockUseMediaQuery = vi.fn(() => true);
    
    const { container } = render(<Sidebar />, {
      initialState: createAdminState(),
    });

    // Verify permanent drawer variant
    const drawer = container.querySelector('.MuiDrawer-root');
    expect(drawer).toHaveClass('MuiDrawer-docked');
    
    // Permanent drawer should not have modal/overlay
    const backdrop = container.querySelector('.MuiBackdrop-root');
    expect(backdrop).not.toBeInTheDocument();
  });

  it('renders temporary drawer on mobile', () => {
    // Mock mobile viewport (below md)
    mockUseMediaQuery = vi.fn(() => false);
    
    const { container } = render(<Sidebar />, {
      initialState: {
        ...createAdminState(),
        sidebar: createSidebarState(true), // Drawer open
      },
    });

    // Verify temporary drawer variant
    const drawer = container.querySelector('.MuiDrawer-root');
    expect(drawer).not.toHaveClass('MuiDrawer-docked');
    
    // Temporary drawer should have modal/overlay when open
    const backdrop = container.querySelector('.MuiBackdrop-root');
    expect(backdrop).toBeInTheDocument();
  });

  it('closes temporary drawer on outside click', async () => {
    const user = userEvent.setup();
    
    // Mock mobile viewport
    mockUseMediaQuery = vi.fn(() => false);
    
    const { container } = render(<Sidebar />, {
      initialState: {
        ...createAdminState(),
        sidebar: createSidebarState(true), // Drawer open
      },
    });

    // Find and click the backdrop (overlay)
    const backdrop = container.querySelector('.MuiBackdrop-root');
    expect(backdrop).toBeInTheDocument();

    await user.click(backdrop as Element);

    // Verify dispatch was called with close action
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalled();
      
      // Verify the dispatched action is closeSidebar
      const dispatchedAction = mockDispatch.mock.calls[0][0];
      expect(dispatchedAction.type).toBe('sidebar/closeSidebar');
    });
  });

  // ==========================================================================
  // Redux State Synchronization
  // ==========================================================================

  it('syncs open state with Redux', () => {
    // Mock mobile viewport for temporary drawer
    mockUseMediaQuery = vi.fn(() => false);
    
    // Test with drawer closed
    const { container: containerClosed } = render(<Sidebar />, {
      initialState: {
        ...createAdminState(),
        sidebar: createSidebarState(false), // Drawer closed
      },
    });

    // Temporary drawer should not be visible when closed
    const drawerClosed = containerClosed.querySelector('.MuiDrawer-root');
    expect(drawerClosed).toBeInTheDocument();
    
    // In MUI, temporary drawer's visibility is controlled by 'open' prop
    // When closed, the drawer paper should not be visible
    const drawerPaperClosed = containerClosed.querySelector('.MuiDrawer-paper');
    expect(drawerPaperClosed).not.toBeInTheDocument();

    // Test with drawer open
    const { container: containerOpen } = render(<Sidebar />, {
      initialState: {
        ...createAdminState(),
        sidebar: createSidebarState(true), // Drawer open
      },
    });

    // Drawer paper should be visible when open
    const drawerPaperOpen = containerOpen.querySelector('.MuiDrawer-paper');
    expect(drawerPaperOpen).toBeInTheDocument();
  });

  // ==========================================================================
  // Visual Hierarchy and Styling
  // ==========================================================================

  it('shows nested menu items with increased padding', async () => {
    const user = userEvent.setup();
    
    render(<Sidebar />, {
      initialState: createAdminState(),
    });

    // Expand Administration menu to see nested items
    const adminMenuItem = screen.getByText('Administration');
    await user.click(adminMenuItem);

    await waitFor(() => {
      const userMgmtItem = screen.getByText('User Management');
      expect(userMgmtItem).toBeInTheDocument();

      // Find the ListItemButton for the nested item
      const listItemButton = userMgmtItem.closest('.MuiListItemButton-root');
      expect(listItemButton).toBeInTheDocument();

      // Verify increased padding-left for visual hierarchy
      // Nested items have sx={{ pl: 4 }} (4 * 8px = 32px)
      const style = window.getComputedStyle(listItemButton as Element);
      const paddingLeft = parseInt(style.paddingLeft);
      
      // Should be greater than top-level items (pl: 2 = 16px)
      expect(paddingLeft).toBeGreaterThan(16);
    });
  });

  it('renders Divider between menu sections', () => {
    render(<Sidebar />, {
      initialState: createAdminState(),
    });

    // Find all dividers (MUI Divider renders as hr with role="separator")
    const dividers = screen.getAllByRole('separator');
    
    // Should have multiple dividers between sections
    expect(dividers.length).toBeGreaterThan(0);
    
    // Verify dividers have correct styling
    dividers.forEach((divider) => {
      expect(divider).toHaveClass('MuiDivider-root');
    });
  });

  // ==========================================================================
  // Accessibility (ARIA)
  // ==========================================================================

  it('has proper ARIA label on drawer', () => {
    const { container } = render(<Sidebar />, {
      initialState: createAdminState(),
    });

    // Find the Drawer component
    const drawer = container.querySelector('.MuiDrawer-root');
    expect(drawer).toBeInTheDocument();

    // Verify aria-label on drawer navigation
    const nav = container.querySelector('nav');
    expect(nav).toHaveAttribute('aria-label', 'Main navigation');
  });

  it('marks active item with aria-current', () => {
    render(<Sidebar />, {
      initialState: createAdminState(),
      initialRoute: '/courses',
    });

    // Find the active menu item (My Courses)
    const activeItem = screen.getByText('My Courses').closest('a');
    expect(activeItem).toHaveAttribute('aria-current', 'page');
  });

  // ==========================================================================
  // Keyboard Navigation
  // ==========================================================================

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    
    render(<Sidebar />, {
      initialState: createAdminState(),
    });

    // Tab to first menu item
    await user.tab();
    
    // The focused element should be a menu item
    const focusedElement = document.activeElement;
    expect(focusedElement).toBeInTheDocument();
    expect(focusedElement?.tagName).toBe('A');

    // Press Enter to activate
    await user.keyboard('{Enter}');

    // Verify navigation occurred
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Icon Rendering
  // ==========================================================================

  it('displays menu item icons', () => {
    const { container } = render(<Sidebar />, {
      initialState: createAdminState(),
    });

    // Find icons by MUI icon classes
    // Each menu item should have an icon
    const icons = container.querySelectorAll('.MuiSvgIcon-root');
    
    // Should have multiple icons (one for each menu item)
    expect(icons.length).toBeGreaterThan(5);
    
    // Verify icons have proper ARIA
    icons.forEach((icon) => {
      // Icons should be decorative (aria-hidden) as text provides label
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // ==========================================================================
  // Header Rendering
  // ==========================================================================

  it('shows header with logo/site name', () => {
    render(<Sidebar />, {
      initialState: createAdminState(),
    });

    // Find the drawer header
    // The header contains the site branding
    const header = screen.getByText('Moodle LMS');
    expect(header).toBeInTheDocument();

    // Verify header styling
    const headerBox = header.closest('.MuiBox-root');
    expect(headerBox).toBeInTheDocument();
  });
});
