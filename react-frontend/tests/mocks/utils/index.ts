/**
 * Test Utilities Barrel Export
 *
 * This file provides a convenient single import point for all testing utilities.
 * Re-exports all test helpers from test-utils.tsx, including custom render functions,
 * store setup utilities, React Query test client, and all React Testing Library utilities.
 *
 * Usage Pattern:
 * Instead of:
 * ```typescript
 * import { renderWithProviders } from '@/tests/mocks/utils/test-utils';
 * import { screen } from '@testing-library/react';
 * ```
 *
 * You can simply use:
 * ```typescript
 * import { renderWithProviders, screen } from '@/tests/mocks/utils';
 * ```
 *
 * Exported Utilities:
 *
 * **Custom Test Utilities:**
 * - renderWithProviders: Custom render with all providers (Redux, React Query, MUI, Router)
 * - setupStore: Create Redux store with optional preloadedState
 * - testQueryClient: React Query client optimized for testing
 *
 * **Type Exports:**
 * - AppStore: Type for Redux store instance
 * - RootState: Type for Redux root state
 * - ExtendedRenderOptions: Type for renderWithProviders options
 * - AppDispatch: Type for Redux dispatch function
 *
 * **React Testing Library (Re-exported):**
 * - render: Standard RTL render function
 * - screen: Query utilities bound to document.body
 * - fireEvent: User interaction simulation
 * - waitFor: Async utility for waiting on conditions
 * - within: Query utilities bound to specific element
 * - cleanup: Clean up after tests
 * - act: Wrap state updates in act()
 * - All RTL query functions and utilities
 *
 * Benefits:
 * - Single import statement for all test utilities
 * - Cleaner test file imports
 * - Consistent with project barrel export patterns
 * - Tree-shaking support for unused utilities
 * - Full TypeScript type inference
 *
 * @example
 * ```typescript
 * import {
 *   renderWithProviders,
 *   screen,
 *   fireEvent,
 *   waitFor,
 *   setupStore,
 *   testQueryClient
 * } from '@/tests/mocks/utils';
 * import type { RootState } from '@/tests/mocks/utils';
 *
 * describe('CourseCard', () => {
 *   beforeEach(() => {
 *     testQueryClient.clear();
 *   });
 *
 *   test('renders course card with authenticated user', async () => {
 *     const { store } = renderWithProviders(<CourseCard courseId={1} />, {
 *       preloadedState: {
 *         auth: {
 *           user: { id: 1, username: 'testuser' },
 *           isAuthenticated: true,
 *         },
 *       },
 *     });
 *
 *     await waitFor(() => {
 *       expect(screen.getByText('Course Title')).toBeInTheDocument();
 *     });
 *
 *     expect(store.getState().auth.isAuthenticated).toBe(true);
 *   });
 * });
 * ```
 *
 * @module tests/mocks/utils
 */

// Re-export all utilities from test-utils.tsx
// This includes:
// - Custom utilities: renderWithProviders, setupStore, testQueryClient
// - Type exports: RootState, AppStore, ExtendedRenderOptions, AppDispatch
// - All React Testing Library exports: render, screen, fireEvent, waitFor, within, etc.
export * from './test-utils';
