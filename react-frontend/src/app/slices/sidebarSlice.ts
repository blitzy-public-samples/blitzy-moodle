/**
 * Sidebar Redux Slice
 *
 * Redux Toolkit slice for managing sidebar navigation state across the React application.
 * Handles the open/close state of the main navigation drawer, providing consistent
 * sidebar behavior across desktop and mobile breakpoints.
 *
 * This slice serves as the single source of truth for sidebar visibility state,
 * enabling coordinated sidebar control from multiple components (AppBar toggle button,
 * responsive layout changes, user preferences, etc.).
 *
 * State Management:
 * - Desktop (md+): Sidebar typically open by default, can be toggled for more screen space
 * - Mobile (<md): Sidebar typically closed by default, opens as temporary overlay
 * - User preference can be persisted via localStorage (not implemented in this slice)
 *
 * Integration Points:
 * - Sidebar component: Consumes isOpen state to control Drawer visibility
 * - AppBar Header: Dispatches toggleSidebar on menu icon click
 * - Layout components: Adjusts content width based on sidebar state
 * - Responsive hooks: Can dispatch openSidebar/closeSidebar on breakpoint changes
 *
 * @module app/slices/sidebarSlice
 */

import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

// ============================================================================
// State Interface
// ============================================================================

/**
 * Sidebar state shape
 *
 * Represents the sidebar navigation state stored in Redux.
 * Intentionally minimal to keep sidebar state simple and predictable.
 *
 * State Management Rules:
 * - isOpen is true when sidebar should be visible
 * - Desktop default: true (sidebar visible on load)
 * - Mobile default: false (sidebar hidden, opens as overlay)
 * - State persists across navigation within the same session
 */
export interface SidebarState {
  /**
   * Whether the sidebar is currently open/visible
   * true = sidebar is displayed, false = sidebar is hidden
   */
  isOpen: boolean;
}

// ============================================================================
// Initial State
// ============================================================================

/**
 * Initial sidebar state
 *
 * Sidebar starts open by default for optimal desktop experience.
 * Responsive components can override this based on viewport size.
 *
 * Future Enhancement:
 * - Load from localStorage to persist user preference
 * - Detect viewport size to set appropriate initial state
 * - Support user preference API to sync across devices
 */
const initialState: SidebarState = {
  isOpen: true, // Open by default for desktop-first approach
};

// ============================================================================
// Redux Slice
// ============================================================================

/**
 * Sidebar slice created with Redux Toolkit's createSlice
 *
 * Provides reducers for sidebar state mutations and automatically generates
 * action creators for toggling, opening, and closing the sidebar.
 *
 * Actions:
 * - toggleSidebar: Inverts current open/close state
 * - openSidebar: Explicitly sets sidebar to open
 * - closeSidebar: Explicitly sets sidebar to closed
 * - setSidebarOpen: Sets sidebar to specific state (boolean payload)
 *
 * Usage Example:
 * ```typescript
 * // In component
 * import { useAppDispatch, useAppSelector } from '@/app/store';
 * import { toggleSidebar, closeSidebar } from '@/app/slices/sidebarSlice';
 *
 * const dispatch = useAppDispatch();
 * const isOpen = useAppSelector((state) => state.sidebar.isOpen);
 *
 * // Toggle on button click
 * <IconButton onClick={() => dispatch(toggleSidebar())}>
 *
 * // Close explicitly (e.g., on mobile after navigation)
 * useEffect(() => {
 *   if (isMobile) dispatch(closeSidebar());
 * }, [location.pathname]);
 * ```
 *
 * State Transitions:
 * - toggleSidebar: open <-> closed
 * - openSidebar: any -> open
 * - closeSidebar: any -> closed
 * - setSidebarOpen(true): any -> open
 * - setSidebarOpen(false): any -> closed
 */
export const sidebarSlice = createSlice({
  name: 'sidebar',
  initialState,
  reducers: {
    /**
     * Toggle sidebar action
     *
     * Inverts the current open/close state of the sidebar.
     * Most common action, typically triggered by menu icon button in AppBar.
     *
     * State Changes:
     * - If isOpen is true, sets to false
     * - If isOpen is false, sets to true
     *
     * Use Cases:
     * - AppBar menu button click
     * - Keyboard shortcut (Ctrl+B or Cmd+B)
     * - Toggle button in sidebar footer
     */
    toggleSidebar: (state) => {
      state.isOpen = !state.isOpen;
    },

    /**
     * Open sidebar action
     *
     * Explicitly sets the sidebar to open state.
     * Idempotent operation (safe to call when already open).
     *
     * State Changes:
     * - Sets isOpen to true
     *
     * Use Cases:
     * - Programmatic opening on specific routes
     * - Restoring sidebar on desktop breakpoint
     * - User clicks "Show Navigation" button
     * - Keyboard navigation focus moves to sidebar
     */
    openSidebar: (state) => {
      state.isOpen = true;
    },

    /**
     * Close sidebar action
     *
     * Explicitly sets the sidebar to closed state.
     * Idempotent operation (safe to call when already closed).
     *
     * State Changes:
     * - Sets isOpen to false
     *
     * Use Cases:
     * - Mobile: Auto-close after navigation item click
     * - User clicks outside sidebar overlay (mobile)
     * - Responsive: Auto-close on mobile breakpoint
     * - User clicks "Hide Navigation" or close button
     * - Escape key press when sidebar is focused
     */
    closeSidebar: (state) => {
      state.isOpen = false;
    },

    /**
     * Set sidebar open action with payload
     *
     * Sets sidebar to a specific open/closed state based on boolean payload.
     * Useful for programmatic control with explicit state value.
     *
     * State Changes:
     * - Sets isOpen to payload value
     *
     * Use Cases:
     * - Responsive layout: dispatch(setSidebarOpen(isDesktop))
     * - User preference toggle: dispatch(setSidebarOpen(userPref))
     * - Restore from localStorage: dispatch(setSidebarOpen(savedState))
     * - Conditional logic: dispatch(setSidebarOpen(shouldOpen))
     *
     * @param action.payload - Boolean value for sidebar open state
     */
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.isOpen = action.payload;
    },
  },
});

// ============================================================================
// Action Exports
// ============================================================================

/**
 * Sidebar action creators
 *
 * Automatically generated by createSlice, exported for use in components.
 * All actions are typed with Redux Toolkit's PayloadAction where applicable.
 */
export const { toggleSidebar, openSidebar, closeSidebar, setSidebarOpen } =
  sidebarSlice.actions;

// ============================================================================
// Reducer Export
// ============================================================================

/**
 * Sidebar reducer
 *
 * Default export for inclusion in the Redux store configuration.
 * Handles all sidebar state mutations based on dispatched actions.
 *
 * Used in store.ts:
 * ```typescript
 * import { sidebarReducer } from '@/app/slices/sidebarSlice';
 *
 * export const store = configureStore({
 *   reducer: {
 *     auth: authReducer,
 *     sidebar: sidebarReducer,
 *   },
 * });
 * ```
 */
export const sidebarReducer = sidebarSlice.reducer;

// ============================================================================
// Selector Helpers (Optional)
// ============================================================================

/**
 * Selector to get sidebar open state
 *
 * Convenience selector for accessing sidebar open state.
 * Can be used directly with useAppSelector or in other selectors.
 *
 * Usage Example:
 * ```typescript
 * import { selectSidebarIsOpen } from '@/app/slices/sidebarSlice';
 * const isOpen = useAppSelector(selectSidebarIsOpen);
 * ```
 *
 * @param state - Root Redux state
 * @returns Current sidebar open state
 */
export const selectSidebarIsOpen = (state: { sidebar: SidebarState }): boolean =>
  state.sidebar.isOpen;
