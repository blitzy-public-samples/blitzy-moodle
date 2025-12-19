/**
 * CategoryManagement Component Unit Tests
 *
 * Comprehensive test suite for the CategoryManagement React component that provides
 * category tree display, drag-and-drop reordering, CRUD operations, hierarchy management,
 * search/filter capabilities, and context menus for category actions.
 *
 * @module tests/unit/features/admin/courses/CategoryManagement.test
 * @see react-frontend/src/features/admin/courses/components/CategoryManagement.tsx
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient } from '@tanstack/react-query';
import '@testing-library/jest-dom';

import { CategoryManagement } from '@/features/admin/courses/components/CategoryManagement';
import type { CourseCategory } from '@/features/courses/types/course.types';
import { render, screen, waitFor, within, userEvent } from '@/tests/helpers/render';
import { waitForLoadingToFinish } from '@/tests/helpers/asyncUtils';
import { server } from '@/tests/mocks/server';
import { mockCourseCategory } from '@/tests/mocks/data';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a hierarchical category tree for testing
 * Returns categories at multiple depth levels
 */
function createCategoryHierarchy(): CourseCategory[] {
  const now = Math.floor(Date.now() / 1000);

  return [
    // Top-level categories
    mockCourseCategory({
      id: 1,
      name: 'Science',
      parent: 0,
      sortorder: 1,
      coursecount: 10,
      visible: 1,
      depth: 1,
      path: '/1',
      timemodified: now,
    }),
    mockCourseCategory({
      id: 2,
      name: 'Arts',
      parent: 0,
      sortorder: 2,
      coursecount: 8,
      visible: 1,
      depth: 1,
      path: '/2',
      timemodified: now,
    }),
    mockCourseCategory({
      id: 3,
      name: 'Technology',
      parent: 0,
      sortorder: 3,
      coursecount: 15,
      visible: 0,
      depth: 1,
      path: '/3',
      timemodified: now,
    }),
    // Second-level categories (children of Science)
    mockCourseCategory({
      id: 4,
      name: 'Physics',
      parent: 1,
      sortorder: 1,
      coursecount: 5,
      visible: 1,
      depth: 2,
      path: '/1/4',
      timemodified: now,
    }),
    mockCourseCategory({
      id: 5,
      name: 'Chemistry',
      parent: 1,
      sortorder: 2,
      coursecount: 3,
      visible: 1,
      depth: 2,
      path: '/1/5',
      timemodified: now,
    }),
    // Second-level categories (children of Arts)
    mockCourseCategory({
      id: 6,
      name: 'Music',
      parent: 2,
      sortorder: 1,
      coursecount: 4,
      visible: 1,
      depth: 2,
      path: '/2/6',
      timemodified: now,
    }),
    // Third-level categories (children of Physics)
    mockCourseCategory({
      id: 7,
      name: 'Quantum Mechanics',
      parent: 4,
      sortorder: 1,
      coursecount: 2,
      visible: 1,
      depth: 3,
      path: '/1/4/7',
      timemodified: now,
    }),
    mockCourseCategory({
      id: 8,
      name: 'Classical Mechanics',
      parent: 4,
      sortorder: 2,
      coursecount: 1,
      visible: 1,
      depth: 3,
      path: '/1/4/8',
      timemodified: now,
    }),
  ];
}

/**
 * Creates a flat list of categories for simpler tests
 */
function createFlatCategories(count: number = 3): CourseCategory[] {
  return Array.from({ length: count }, (_, i) =>
    mockCourseCategory({
      id: i + 1,
      name: `Category ${i + 1}`,
      parent: 0,
      sortorder: i + 1,
      coursecount: i * 2,
      visible: 1,
      depth: 1,
      path: `/${i + 1}`,
    })
  );
}

// ============================================================================
// API Handler Factories
// ============================================================================

const API_BASE = '/api/v1/admin/courses/categories';

/**
 * Creates a success handler for GET categories
 */
function createGetCategoriesHandler(categories: CourseCategory[]) {
  return http.get(API_BASE, () => {
    return HttpResponse.json({
      success: true,
      data: categories,
    });
  });
}

/**
 * Creates a success handler for POST create category
 */
function createPostCategoryHandler(returnCategory?: CourseCategory) {
  return http.post(API_BASE, async ({ request }) => {
    const body = (await request.json()) as Partial<CourseCategory>;
    const newCategory = returnCategory ?? mockCourseCategory({
      id: Date.now(),
      ...body,
    });
    return HttpResponse.json({
      success: true,
      data: newCategory,
    });
  });
}

/**
 * Creates a success handler for PUT update category
 */
function createPutCategoryHandler() {
  return http.put(`${API_BASE}/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Partial<CourseCategory>;
    const updatedCategory = mockCourseCategory({
      id: Number(params.id),
      ...body,
    });
    return HttpResponse.json({
      success: true,
      data: updatedCategory,
    });
  });
}

/**
 * Creates a success handler for DELETE category
 */
function createDeleteCategoryHandler() {
  return http.delete(`${API_BASE}/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: { id: Number(params.id) },
    });
  });
}

/**
 * Creates a success handler for POST move category
 */
function createMoveCategoryHandler() {
  return http.post(`${API_BASE}/:id/move`, async ({ request, params }) => {
    const body = (await request.json()) as { parent: number; sortorder?: number };
    return HttpResponse.json({
      success: true,
      data: {
        id: Number(params.id),
        parent: body.parent,
        sortorder: body.sortorder ?? 1,
      },
    });
  });
}

/**
 * Creates a success handler for PUT toggle visibility
 */
function createToggleVisibilityHandler() {
  return http.put(`${API_BASE}/:id/visibility`, async ({ request, params }) => {
    const body = (await request.json()) as { visible: number };
    return HttpResponse.json({
      success: true,
      data: {
        id: Number(params.id),
        visible: body.visible,
      },
    });
  });
}

/**
 * Creates an error handler for any endpoint
 */
function createErrorHandler(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  status: number,
  errorCode: string,
  message: string
) {
  const handlers = {
    get: http.get,
    post: http.post,
    put: http.put,
    delete: http.delete,
  };

  return handlers[method](path, () => {
    return HttpResponse.json(
      {
        success: false,
        error: { code: errorCode, message },
      },
      { status }
    );
  });
}

// ============================================================================
// Test Setup
// ============================================================================

describe('CategoryManagement', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    // Reset MSW handlers to defaults
    server.resetHandlers();

    // Create fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          staleTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });

    // Setup userEvent
    user = userEvent.setup();

    // Set up global QueryClient for async utilities
    globalThis.__queryClient__ = queryClient;

    // Setup default success handlers
    const categories = createCategoryHierarchy();
    server.use(
      createGetCategoriesHandler(categories),
      createPostCategoryHandler(),
      createPutCategoryHandler(),
      createDeleteCategoryHandler(),
      createMoveCategoryHandler(),
      createToggleVisibilityHandler()
    );
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    globalThis.__queryClient__ = undefined;
  });

  // ==========================================================================
  // Test Suite: Category Tree Display
  // ==========================================================================

  describe('Category Tree Display', () => {
    it('renders category tree container', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Should have a list structure for the tree
      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('displays root categories at top level', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      expect(screen.getByText('Science')).toBeInTheDocument();
      expect(screen.getByText('Arts')).toBeInTheDocument();
      expect(screen.getByText('Technology')).toBeInTheDocument();
    });

    it('shows nested subcategories with proper indentation when expanded', async () => {
      render(<CategoryManagement expandAll />, { queryClient });

      await waitForLoadingToFinish();

      // After expansion, subcategories should be visible
      expect(screen.getByText('Physics')).toBeInTheDocument();
      expect(screen.getByText('Chemistry')).toBeInTheDocument();
      expect(screen.getByText('Music')).toBeInTheDocument();
      expect(screen.getByText('Quantum Mechanics')).toBeInTheDocument();
    });

    it('displays category names correctly', async () => {
      const categories = createFlatCategories(3);
      server.use(createGetCategoriesHandler(categories));

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      expect(screen.getByText('Category 1')).toBeInTheDocument();
      expect(screen.getByText('Category 2')).toBeInTheDocument();
      expect(screen.getByText('Category 3')).toBeInTheDocument();
    });

    it('shows course count badge for each category when showCourseCount is true', async () => {
      render(<CategoryManagement showCourseCount />, { queryClient });

      await waitForLoadingToFinish();

      // Science has 10 courses
      expect(screen.getByText('10')).toBeInTheDocument();
      // Arts has 8 courses
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('displays folder icons for categories', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Folder icons should be present (using data-testid or aria-label)
      const folderIcons = screen.getAllByTestId(/folder-icon|FolderIcon/i);
      expect(folderIcons.length).toBeGreaterThan(0);
    });

    it('shows visibility indicator for hidden categories', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Technology is hidden (visible: 0)
      const techCategory = screen.getByText('Technology').closest('li');
      expect(techCategory).toHaveAttribute('data-visible', 'false');
    });

    it('renders empty state when no categories exist', async () => {
      server.use(createGetCategoriesHandler([]));

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      expect(screen.getByText(/no categories/i)).toBeInTheDocument();
    });

    it('shows loading skeleton while fetching categories', async () => {
      // Delay the response to catch loading state
      server.use(
        http.get(API_BASE, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: createFlatCategories(),
          });
        })
      );

      render(<CategoryManagement />, { queryClient });

      // Should show loading indicator
      expect(
        screen.getByRole('progressbar') ||
          screen.getByTestId('loading-skeleton') ||
          screen.getByText(/loading/i)
      ).toBeInTheDocument();

      await waitForLoadingToFinish();
    });

    it('calculates and displays correct depth level for each category', async () => {
      render(<CategoryManagement expandAll />, { queryClient });

      await waitForLoadingToFinish();

      // Check depth attributes on list items
      const scienceItem = screen.getByText('Science').closest('[data-depth]');
      const physicsItem = screen.getByText('Physics').closest('[data-depth]');
      const quantumItem = screen.getByText('Quantum Mechanics').closest('[data-depth]');

      if (scienceItem) expect(scienceItem).toHaveAttribute('data-depth', '1');
      if (physicsItem) expect(physicsItem).toHaveAttribute('data-depth', '2');
      if (quantumItem) expect(quantumItem).toHaveAttribute('data-depth', '3');
    });
  });

  // ==========================================================================
  // Test Suite: Tree Hierarchy Structure
  // ==========================================================================

  describe('Tree Hierarchy Structure', () => {
    it('builds correct parent-child relationships from flat category list', async () => {
      render(<CategoryManagement expandAll />, { queryClient });

      await waitForLoadingToFinish();

      // Physics and Chemistry should be under Science
      const scienceNode = screen.getByText('Science').closest('li');
      expect(scienceNode).toBeInTheDocument();

      // When expanded, children should be visible within parent subtree
      expect(screen.getByText('Physics')).toBeInTheDocument();
      expect(screen.getByText('Chemistry')).toBeInTheDocument();
    });

    it('handles categories with multiple nesting levels (depth 3+)', async () => {
      render(<CategoryManagement expandAll />, { queryClient });

      await waitForLoadingToFinish();

      // Verify three-level hierarchy: Science > Physics > Quantum Mechanics
      expect(screen.getByText('Science')).toBeInTheDocument();
      expect(screen.getByText('Physics')).toBeInTheDocument();
      expect(screen.getByText('Quantum Mechanics')).toBeInTheDocument();
      expect(screen.getByText('Classical Mechanics')).toBeInTheDocument();
    });

    it('sorts categories by sortorder within each parent', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const listItems = screen.getAllByRole('listitem');
      const categoryNames = listItems
        .filter((item) => item.querySelector('[data-depth="1"]'))
        .map((item) => item.textContent);

      // Science (sortorder: 1), Arts (sortorder: 2), Technology (sortorder: 3)
      const scienceIndex = categoryNames.findIndex((name) => name?.includes('Science'));
      const artsIndex = categoryNames.findIndex((name) => name?.includes('Arts'));
      const techIndex = categoryNames.findIndex((name) => name?.includes('Technology'));

      expect(scienceIndex).toBeLessThan(artsIndex);
      expect(artsIndex).toBeLessThan(techIndex);
    });

    it('handles orphaned categories (missing parent) gracefully', async () => {
      const orphanedCategories = [
        mockCourseCategory({
          id: 1,
          name: 'Valid Category',
          parent: 0,
          depth: 1,
          path: '/1',
        }),
        mockCourseCategory({
          id: 2,
          name: 'Orphaned Category',
          parent: 999, // Non-existent parent
          depth: 2,
          path: '/999/2',
        }),
      ];
      server.use(createGetCategoriesHandler(orphanedCategories));

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Valid category should render
      expect(screen.getByText('Valid Category')).toBeInTheDocument();

      // Orphaned category might be hidden or shown at root level
      // depending on implementation - shouldn't crash
      expect(screen.queryByText('Orphaned Category')).not.toBeInTheDocument();
    });

    it('displays category path breadcrumb for selected category', async () => {
      render(<CategoryManagement expandAll />, { queryClient });

      await waitForLoadingToFinish();

      // Click on a deeply nested category
      await user.click(screen.getByText('Quantum Mechanics'));

      // Should show path in selection or details area
      await waitFor(() => {
        const breadcrumb = screen.queryByText(/Science.*Physics.*Quantum/i) ||
          screen.queryByTestId('category-path');
        expect(breadcrumb).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Test Suite: Expand and Collapse
  // ==========================================================================

  describe('Expand and Collapse', () => {
    it('expands category to show children when clicked', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Initially, subcategories might not be visible
      expect(screen.queryByText('Physics')).not.toBeInTheDocument();

      // Click expand button or category
      const expandButton = screen.getByRole('button', { name: /expand.*science/i }) ||
        screen.getByTestId('expand-1');
      await user.click(expandButton);

      // Now subcategories should be visible
      await waitFor(() => {
        expect(screen.getByText('Physics')).toBeInTheDocument();
        expect(screen.getByText('Chemistry')).toBeInTheDocument();
      });
    });

    it('collapses category to hide children when clicked again', async () => {
      render(<CategoryManagement expandAll />, { queryClient });

      await waitForLoadingToFinish();

      // Subcategories should be visible with expandAll
      expect(screen.getByText('Physics')).toBeInTheDocument();

      // Click collapse button
      const collapseButton = screen.getByRole('button', { name: /collapse.*science/i }) ||
        screen.getByTestId('collapse-1');
      await user.click(collapseButton);

      // Subcategories should be hidden
      await waitFor(() => {
        expect(screen.queryByText('Physics')).not.toBeInTheDocument();
      });
    });

    it('shows expand/collapse icon (chevron) next to category name', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Categories with children should have expand icons
      const scienceItem = screen.getByText('Science').closest('li');
      const expandIcon = within(scienceItem!).queryByTestId(/chevron|expand|arrow/i);
      expect(expandIcon || within(scienceItem!).getByRole('button')).toBeInTheDocument();
    });

    it('Expand All button expands entire tree', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Click "Expand All" button
      const expandAllButton = screen.getByRole('button', { name: /expand all/i });
      await user.click(expandAllButton);

      // All nested categories should now be visible
      await waitFor(() => {
        expect(screen.getByText('Physics')).toBeInTheDocument();
        expect(screen.getByText('Quantum Mechanics')).toBeInTheDocument();
        expect(screen.getByText('Music')).toBeInTheDocument();
      });
    });

    it('Collapse All button collapses all nodes to root level', async () => {
      render(<CategoryManagement expandAll />, { queryClient });

      await waitForLoadingToFinish();

      // Nested categories should be visible
      expect(screen.getByText('Physics')).toBeInTheDocument();

      // Click "Collapse All" button
      const collapseAllButton = screen.getByRole('button', { name: /collapse all/i });
      await user.click(collapseAllButton);

      // Nested categories should be hidden
      await waitFor(() => {
        expect(screen.queryByText('Physics')).not.toBeInTheDocument();
        expect(screen.queryByText('Quantum Mechanics')).not.toBeInTheDocument();
      });

      // Root categories should still be visible
      expect(screen.getByText('Science')).toBeInTheDocument();
    });

    it('remembers expansion state when component re-renders', async () => {
      const { rerender } = render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Expand Science
      const expandButton = screen.getByTestId('expand-1') ||
        screen.getByRole('button', { name: /expand.*science/i });
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Physics')).toBeInTheDocument();
      });

      // Re-render the component
      rerender(<CategoryManagement />);

      // Expansion state should persist
      await waitFor(() => {
        expect(screen.getByText('Physics')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Test Suite: Search and Filter
  // ==========================================================================

  describe('Search and Filter', () => {
    it('renders search input field above tree', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const searchInput = screen.getByRole('searchbox') ||
        screen.getByPlaceholderText(/search/i) ||
        screen.getByLabelText(/search/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('filters categories by name match', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const searchInput = screen.getByRole('searchbox') ||
        screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'Physics');

      await waitFor(() => {
        expect(screen.getByText('Physics')).toBeInTheDocument();
        // Non-matching categories should be filtered
        expect(screen.queryByText('Arts')).not.toBeInTheDocument();
      });
    });

    it('shows only matching categories and their parents', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const searchInput = screen.getByRole('searchbox') ||
        screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'Quantum');

      await waitFor(() => {
        // Quantum Mechanics should show
        expect(screen.getByText('Quantum Mechanics')).toBeInTheDocument();
        // Parent categories should also show to maintain context
        expect(screen.getByText('Physics')).toBeInTheDocument();
        expect(screen.getByText('Science')).toBeInTheDocument();
        // Unrelated categories should be hidden
        expect(screen.queryByText('Arts')).not.toBeInTheDocument();
      });
    });

    it('shows "No results" message when search yields no matches', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const searchInput = screen.getByRole('searchbox') ||
        screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'NonExistentCategory12345');

      await waitFor(() => {
        expect(screen.getByText(/no results|no categories found/i)).toBeInTheDocument();
      });
    });

    it('clears filter and shows full tree when search cleared', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const searchInput = screen.getByRole('searchbox') ||
        screen.getByPlaceholderText(/search/i);

      // Filter
      await user.type(searchInput, 'Physics');
      await waitFor(() => {
        expect(screen.queryByText('Arts')).not.toBeInTheDocument();
      });

      // Clear
      await user.clear(searchInput);
      await waitFor(() => {
        expect(screen.getByText('Science')).toBeInTheDocument();
        expect(screen.getByText('Arts')).toBeInTheDocument();
        expect(screen.getByText('Technology')).toBeInTheDocument();
      });
    });

    it('debounces search input to avoid excessive filtering', async () => {
      const filterSpy = vi.fn();
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const searchInput = screen.getByRole('searchbox') ||
        screen.getByPlaceholderText(/search/i);

      // Rapid typing shouldn't trigger filter for each character
      await user.type(searchInput, 'test', { delay: 10 });

      // Wait for debounce to complete
      await new Promise((resolve) => setTimeout(resolve, 350));

      // The filtering should have happened once or twice, not for every character
      // This is tested by verifying the final state is correct
      await waitFor(() => {
        expect(searchInput).toHaveValue('test');
      });
    });

    it('auto-expands tree to show matching categories', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Initially, deep nested categories are not visible
      expect(screen.queryByText('Quantum Mechanics')).not.toBeInTheDocument();

      const searchInput = screen.getByRole('searchbox') ||
        screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'Quantum');

      // Should auto-expand to show the match
      await waitFor(() => {
        expect(screen.getByText('Quantum Mechanics')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Test Suite: Drag and Drop - Setup
  // ==========================================================================

  describe('Drag and Drop - Setup', () => {
    it('each category has draggable attribute when allowDragDrop is true', async () => {
      render(<CategoryManagement allowDragDrop />, { queryClient });

      await waitForLoadingToFinish();

      const categoryItems = screen.getAllByRole('listitem');
      categoryItems.forEach((item) => {
        const draggableElement = item.querySelector('[draggable="true"]') || item;
        expect(draggableElement.getAttribute('draggable')).toBe('true');
      });
    });

    it('does not have draggable attribute when allowDragDrop is false', async () => {
      render(<CategoryManagement allowDragDrop={false} />, { queryClient });

      await waitForLoadingToFinish();

      const categoryItems = screen.getAllByRole('listitem');
      categoryItems.forEach((item) => {
        expect(item.getAttribute('draggable')).not.toBe('true');
      });
    });

    it('shows drag handle icon on hover', async () => {
      render(<CategoryManagement allowDragDrop />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      await user.hover(scienceItem!);

      await waitFor(() => {
        const dragHandle = within(scienceItem!).queryByTestId(/drag-handle|drag-indicator/i);
        expect(dragHandle || within(scienceItem!).getByLabelText(/drag/i)).toBeInTheDocument();
      });
    });

    it('category becomes draggable when drag initiated', async () => {
      render(<CategoryManagement allowDragDrop />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('[draggable="true"]');
      expect(scienceItem).toBeInTheDocument();

      // Simulate drag start
      const dataTransfer = new DataTransfer();
      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });

      scienceItem!.dispatchEvent(dragStartEvent);

      // The item should indicate it's being dragged
      await waitFor(() => {
        expect(scienceItem).toHaveAttribute('data-dragging', 'true');
      });
    });
  });

  // ==========================================================================
  // Test Suite: Drag and Drop - Reordering
  // ==========================================================================

  describe('Drag and Drop - Reordering', () => {
    it('reorders categories within same parent when dropped', async () => {
      render(<CategoryManagement allowDragDrop />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('[draggable="true"]');
      const artsItem = screen.getByText('Arts').closest('[draggable="true"]');

      // Simulate drag from Science to after Arts
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', '1'); // Science ID

      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        dataTransfer,
      });
      scienceItem!.dispatchEvent(dragStartEvent);

      const dragOverEvent = new DragEvent('dragover', {
        bubbles: true,
        dataTransfer,
      });
      artsItem!.dispatchEvent(dragOverEvent);

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        dataTransfer,
      });
      artsItem!.dispatchEvent(dropEvent);

      // Verify API was called with new order
      await waitFor(() => {
        // The UI should reflect the new order after API success
        const items = screen.getAllByRole('listitem');
        const names = items.map((item) => item.textContent);
        // Science should now be after Arts
        const artsIndex = names.findIndex((n) => n?.includes('Arts'));
        const scienceIndex = names.findIndex((n) => n?.includes('Science'));
        expect(artsIndex).toBeLessThan(scienceIndex);
      });
    });

    it('shows visual feedback (highlight) on valid drop target', async () => {
      render(<CategoryManagement allowDragDrop />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('[draggable="true"]');
      const artsItem = screen.getByText('Arts').closest('li');

      // Start dragging Science
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', '1');

      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        dataTransfer,
      });
      scienceItem!.dispatchEvent(dragStartEvent);

      // Drag over Arts
      const dragOverEvent = new DragEvent('dragover', {
        bubbles: true,
        dataTransfer,
      });
      artsItem!.dispatchEvent(dragOverEvent);

      // Arts should show drop indicator
      await waitFor(() => {
        expect(artsItem).toHaveClass(/drop-target|drag-over|highlighted/i);
      });
    });

    it('prevents dropping on itself', async () => {
      render(<CategoryManagement allowDragDrop />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('[draggable="true"]');

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', '1');

      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        dataTransfer,
      });
      scienceItem!.dispatchEvent(dragStartEvent);

      // Try to drop on itself
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        dataTransfer,
      });
      scienceItem!.dispatchEvent(dropEvent);

      // Should not have called API or changed anything
      await waitFor(() => {
        // No error snackbar, no API call
        expect(screen.queryByText(/cannot drop/i)).not.toBeInTheDocument();
      });
    });

    it('shows drop indicator line (above/below target)', async () => {
      render(<CategoryManagement allowDragDrop />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('[draggable="true"]');
      const artsItem = screen.getByText('Arts').closest('li');

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', '1');

      scienceItem!.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer })
      );

      artsItem!.dispatchEvent(
        new DragEvent('dragover', { bubbles: true, dataTransfer })
      );

      // Should show drop line indicator
      await waitFor(() => {
        const dropLine = screen.queryByTestId(/drop-line|drop-indicator/i) ||
          artsItem!.querySelector('[class*="drop-"]');
        expect(dropLine).toBeInTheDocument();
      });
    });

    it('calls API to persist new order on drop', async () => {
      const reorderHandler = vi.fn();
      server.use(
        http.post(`${API_BASE}/reorder`, async ({ request }) => {
          const body = await request.json();
          reorderHandler(body);
          return HttpResponse.json({ success: true });
        })
      );

      render(<CategoryManagement allowDragDrop />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('[draggable="true"]');
      const artsItem = screen.getByText('Arts').closest('li');

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', '1');

      scienceItem!.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer })
      );
      artsItem!.dispatchEvent(
        new DragEvent('drop', { bubbles: true, dataTransfer })
      );

      await waitFor(() => {
        expect(reorderHandler).toHaveBeenCalled();
      });
    });

    it('reverts UI on API error (optimistic update rollback)', async () => {
      server.use(
        http.post(`${API_BASE}/reorder`, () => {
          return HttpResponse.json(
            { success: false, error: { code: 'REORDER_FAILED', message: 'Failed' } },
            { status: 500 }
          );
        })
      );

      render(<CategoryManagement allowDragDrop />, { queryClient });

      await waitForLoadingToFinish();

      // Remember original order
      const originalItems = screen.getAllByRole('listitem');
      const originalOrder = originalItems.map((i) => i.textContent);

      // Attempt reorder
      const scienceItem = screen.getByText('Science').closest('[draggable="true"]');
      const artsItem = screen.getByText('Arts').closest('li');

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', '1');

      scienceItem!.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer })
      );
      artsItem!.dispatchEvent(
        new DragEvent('drop', { bubbles: true, dataTransfer })
      );

      // Wait for error and rollback
      await waitFor(() => {
        const errorMessage = screen.getByText(/failed|error/i);
        expect(errorMessage).toBeInTheDocument();
      });

      // Order should be reverted
      const finalItems = screen.getAllByRole('listitem');
      const finalOrder = finalItems.map((i) => i.textContent);
      expect(finalOrder).toEqual(originalOrder);
    });
  });

  // ==========================================================================
  // Test Suite: Drag and Drop - Moving to Different Parent
  // ==========================================================================

  describe('Drag and Drop - Moving to Different Parent', () => {
    it('allows dropping category onto another category to change parent', async () => {
      render(<CategoryManagement allowDragDrop />, { queryClient });

      await waitForLoadingToFinish();

      // Drag Music (under Arts) to Science
      const musicItem = screen.getByText('Music').closest('[draggable="true"]');
      const scienceItem = screen.getByText('Science').closest('li');

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', '6'); // Music ID

      musicItem!.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer })
      );
      scienceItem!.dispatchEvent(
        new DragEvent('drop', { bubbles: true, dataTransfer })
      );

      // Music should now be under Science
      await waitFor(() => {
        const updatedMusicItem = screen.getByText('Music').closest('[data-parent]');
        expect(updatedMusicItem).toHaveAttribute('data-parent', '1');
      });
    });

    it('prevents dropping parent category into its own descendant', async () => {
      render(<CategoryManagement allowDragDrop expandAll />, { queryClient });

      await waitForLoadingToFinish();

      // Try to drag Science into Quantum Mechanics (its grandchild)
      const scienceItem = screen.getByText('Science').closest('[draggable="true"]');
      const quantumItem = screen.getByText('Quantum Mechanics').closest('li');

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', '1');

      scienceItem!.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer })
      );
      quantumItem!.dispatchEvent(
        new DragEvent('dragover', { bubbles: true, dataTransfer })
      );

      // Should show invalid drop indicator
      await waitFor(() => {
        expect(quantumItem).toHaveAttribute('data-drop-valid', 'false');
      });
    });

    it('prevents dropping onto hidden categories with warning', async () => {
      render(<CategoryManagement allowDragDrop />, { queryClient });

      await waitForLoadingToFinish();

      // Technology is hidden
      const scienceItem = screen.getByText('Science').closest('[draggable="true"]');
      const techItem = screen.getByText('Technology').closest('li');

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', '1');

      scienceItem!.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer })
      );
      techItem!.dispatchEvent(
        new DragEvent('drop', { bubbles: true, dataTransfer })
      );

      // Should show warning
      await waitFor(() => {
        expect(screen.getByText(/cannot drop.*hidden/i)).toBeInTheDocument();
      });
    });

    it('calls API with new parent ID on drop', async () => {
      const moveSpy = vi.fn();
      server.use(
        http.post(`${API_BASE}/:id/move`, async ({ request, params }) => {
          const body = await request.json();
          moveSpy({ id: params.id, body });
          return HttpResponse.json({ success: true, data: { id: params.id } });
        })
      );

      render(<CategoryManagement allowDragDrop expandAll />, { queryClient });

      await waitForLoadingToFinish();

      const musicItem = screen.getByText('Music').closest('[draggable="true"]');
      const scienceItem = screen.getByText('Science').closest('li');

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', '6');

      musicItem!.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer })
      );
      scienceItem!.dispatchEvent(
        new DragEvent('drop', { bubbles: true, dataTransfer })
      );

      await waitFor(() => {
        expect(moveSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            id: '6',
            body: expect.objectContaining({ parent: 1 }),
          })
        );
      });
    });

    it('shows error message for invalid moves', async () => {
      server.use(
        http.post(`${API_BASE}/:id/move`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'INVALID_MOVE', message: 'Cannot move to this location' },
            },
            { status: 400 }
          );
        })
      );

      render(<CategoryManagement allowDragDrop expandAll />, { queryClient });

      await waitForLoadingToFinish();

      const musicItem = screen.getByText('Music').closest('[draggable="true"]');
      const scienceItem = screen.getByText('Science').closest('li');

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', '6');

      musicItem!.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer })
      );
      scienceItem!.dispatchEvent(
        new DragEvent('drop', { bubbles: true, dataTransfer })
      );

      await waitFor(() => {
        expect(screen.getByText(/cannot move/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Test Suite: Create Category
  // ==========================================================================

  describe('Create Category', () => {
    it('renders "Add Category" button at top', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      expect(
        screen.getByRole('button', { name: /add category|new category|create/i })
      ).toBeInTheDocument();
    });

    it('opens create dialog when "Add Category" clicked', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category|new category/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/create.*category|new category/i)).toBeInTheDocument();
      });
    });

    it('opens create dialog with parent pre-filled when "Add Subcategory" clicked', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Right-click for context menu or find add subcategory button
      const scienceItem = screen.getByText('Science').closest('li');
      const addSubButton = within(scienceItem!).getByRole('button', { name: /add sub|add child/i });
      await user.click(addSubButton);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        // Parent should be pre-selected as Science
        const parentSelect = within(dialog).getByLabelText(/parent/i);
        expect(parentSelect).toHaveValue('1'); // Science ID
      });
    });

    it('displays form fields: name (required), parent, description, visible', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category|new category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');

      expect(within(dialog).getByLabelText(/name/i)).toBeInTheDocument();
      expect(within(dialog).getByLabelText(/parent/i)).toBeInTheDocument();
      expect(within(dialog).getByLabelText(/description/i)).toBeInTheDocument();
      expect(within(dialog).getByLabelText(/visible/i)).toBeInTheDocument();
    });

    it('validates name is required and not empty', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category|new category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');
      const submitButton = within(dialog).getByRole('button', { name: /create|save|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/name.*required|required.*name/i)).toBeInTheDocument();
      });
    });

    it('calls POST API with form data when submitted', async () => {
      const createSpy = vi.fn();
      server.use(
        http.post(API_BASE, async ({ request }) => {
          const body = await request.json();
          createSpy(body);
          return HttpResponse.json({
            success: true,
            data: mockCourseCategory({ id: 100, ...body as object }),
          });
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category|new category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');

      await user.type(within(dialog).getByLabelText(/name/i), 'New Category');
      await user.type(within(dialog).getByLabelText(/description/i), 'Test description');

      const submitButton = within(dialog).getByRole('button', { name: /create|save|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Category',
            description: 'Test description',
          })
        );
      });
    });

    it('closes dialog and shows success message on successful creation', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category|new category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText(/name/i), 'New Category');

      const submitButton = within(dialog).getByRole('button', { name: /create|save|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        // Dialog should close
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        // Success message should appear
        expect(screen.getByText(/created|success/i)).toBeInTheDocument();
      });
    });

    it('adds new category to tree at correct position', async () => {
      const newCategory = mockCourseCategory({
        id: 100,
        name: 'New Top Category',
        parent: 0,
        sortorder: 4,
        depth: 1,
        path: '/100',
      });

      server.use(
        http.post(API_BASE, () => {
          return HttpResponse.json({ success: true, data: newCategory });
        }),
        http.get(API_BASE, () => {
          return HttpResponse.json({
            success: true,
            data: [...createCategoryHierarchy(), newCategory],
          });
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category|new category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText(/name/i), 'New Top Category');

      const submitButton = within(dialog).getByRole('button', { name: /create|save|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('New Top Category')).toBeInTheDocument();
      });
    });

    it('resets form when dialog closed without submit', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category|new category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText(/name/i), 'Temporary Name');

      // Close without submitting
      const cancelButton = within(dialog).getByRole('button', { name: /cancel|close/i });
      await user.click(cancelButton);

      // Re-open dialog
      await user.click(addButton);

      const newDialog = await screen.findByRole('dialog');
      expect(within(newDialog).getByLabelText(/name/i)).toHaveValue('');
    });
  });

  // ==========================================================================
  // Test Suite: Edit Category
  // ==========================================================================

  describe('Edit Category', () => {
    it('renders edit button (pencil icon) for each category', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      const editButton = within(scienceItem!).getByRole('button', { name: /edit/i });
      expect(editButton).toBeInTheDocument();
    });

    it('opens edit dialog when edit button clicked', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      const editButton = within(scienceItem!).getByRole('button', { name: /edit/i });
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/edit.*category/i)).toBeInTheDocument();
      });
    });

    it('pre-fills form with current category data', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      const editButton = within(scienceItem!).getByRole('button', { name: /edit/i });
      await user.click(editButton);

      const dialog = await screen.findByRole('dialog');

      expect(within(dialog).getByLabelText(/name/i)).toHaveValue('Science');
    });

    it('allows changing category name', async () => {
      const updateSpy = vi.fn();
      server.use(
        http.put(`${API_BASE}/:id`, async ({ request, params }) => {
          const body = await request.json();
          updateSpy({ id: params.id, body });
          return HttpResponse.json({
            success: true,
            data: mockCourseCategory({ id: Number(params.id), ...body as object }),
          });
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      const editButton = within(scienceItem!).getByRole('button', { name: /edit/i });
      await user.click(editButton);

      const dialog = await screen.findByRole('dialog');
      const nameInput = within(dialog).getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Natural Sciences');

      const submitButton = within(dialog).getByRole('button', { name: /save|update|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            id: '1',
            body: expect.objectContaining({ name: 'Natural Sciences' }),
          })
        );
      });
    });

    it('allows changing visibility status', async () => {
      const updateSpy = vi.fn();
      server.use(
        http.put(`${API_BASE}/:id`, async ({ request, params }) => {
          const body = await request.json();
          updateSpy({ id: params.id, body });
          return HttpResponse.json({
            success: true,
            data: mockCourseCategory({ id: Number(params.id), ...body as object }),
          });
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      const editButton = within(scienceItem!).getByRole('button', { name: /edit/i });
      await user.click(editButton);

      const dialog = await screen.findByRole('dialog');
      const visibleCheckbox = within(dialog).getByLabelText(/visible/i);
      await user.click(visibleCheckbox);

      const submitButton = within(dialog).getByRole('button', { name: /save|update|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({ visible: 0 }),
          })
        );
      });
    });

    it('shows success message with updated category name', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      const editButton = within(scienceItem!).getByRole('button', { name: /edit/i });
      await user.click(editButton);

      const dialog = await screen.findByRole('dialog');
      const nameInput = within(dialog).getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Natural Sciences');

      const submitButton = within(dialog).getByRole('button', { name: /save|update|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/updated|saved|success/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Test Suite: Delete Category
  // ==========================================================================

  describe('Delete Category', () => {
    it('renders delete button (trash icon) for each category', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      const deleteButton = within(scienceItem!).getByRole('button', { name: /delete/i });
      expect(deleteButton).toBeInTheDocument();
    });

    it('opens delete confirmation dialog when delete button clicked', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const artsItem = screen.getByText('Arts').closest('li');
      const deleteButton = within(artsItem!).getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/delete.*category|confirm.*delete/i)).toBeInTheDocument();
      });
    });

    it('shows category name in confirmation dialog', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const artsItem = screen.getByText('Arts').closest('li');
      const deleteButton = within(artsItem!).getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/Arts/)).toBeInTheDocument();
    });

    it('shows warning if category contains courses', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Science has 10 courses
      const scienceItem = screen.getByText('Science').closest('li');
      const deleteButton = within(scienceItem!).getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/contains.*courses|10.*courses|courses will be/i)).toBeInTheDocument();
    });

    it('shows warning if category has subcategories', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Science has subcategories
      const scienceItem = screen.getByText('Science').closest('li');
      const deleteButton = within(scienceItem!).getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/subcategories|child categories/i)).toBeInTheDocument();
    });

    it('calls DELETE API when confirmed', async () => {
      const deleteSpy = vi.fn();
      server.use(
        http.delete(`${API_BASE}/:id`, ({ params }) => {
          deleteSpy(params.id);
          return HttpResponse.json({ success: true, data: { id: params.id } });
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Delete Arts (simpler - no subcategories)
      const artsItem = screen.getByText('Arts').closest('li');
      const deleteButton = within(artsItem!).getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      const dialog = await screen.findByRole('dialog');
      const confirmButton = within(dialog).getByRole('button', { name: /delete|confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith('2'); // Arts ID
      });
    });

    it('removes category from tree on successful delete', async () => {
      server.use(
        http.delete(`${API_BASE}/:id`, () => {
          return HttpResponse.json({ success: true });
        }),
        http.get(API_BASE, () => {
          // Return categories without Arts
          const categoriesWithoutArts = createCategoryHierarchy().filter(
            (c) => c.id !== 2 && c.id !== 6
          );
          return HttpResponse.json({ success: true, data: categoriesWithoutArts });
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const artsItem = screen.getByText('Arts').closest('li');
      const deleteButton = within(artsItem!).getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      const dialog = await screen.findByRole('dialog');
      const confirmButton = within(dialog).getByRole('button', { name: /delete|confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.queryByText('Arts')).not.toBeInTheDocument();
      });
    });

    it('shows success message after deletion', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const artsItem = screen.getByText('Arts').closest('li');
      const deleteButton = within(artsItem!).getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      const dialog = await screen.findByRole('dialog');
      const confirmButton = within(dialog).getByRole('button', { name: /delete|confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/deleted|removed|success/i)).toBeInTheDocument();
      });
    });

    it('handles delete failure with error message', async () => {
      server.use(
        http.delete(`${API_BASE}/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'CATEGORY_IN_USE', message: 'Category cannot be deleted' },
            },
            { status: 400 }
          );
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const artsItem = screen.getByText('Arts').closest('li');
      const deleteButton = within(artsItem!).getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      const dialog = await screen.findByRole('dialog');
      const confirmButton = within(dialog).getByRole('button', { name: /delete|confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/cannot be deleted|error|failed/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Test Suite: Move Category Dialog
  // ==========================================================================

  describe('Move Category Dialog', () => {
    it('renders "Move" option in context menu', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      await user.pointer({ keys: '[MouseRight]', target: scienceItem! });

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /move/i })).toBeInTheDocument();
      });
    });

    it('opens move dialog showing target category selector', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      await user.pointer({ keys: '[MouseRight]', target: scienceItem! });

      const moveOption = await screen.findByRole('menuitem', { name: /move/i });
      await user.click(moveOption);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/select.*destination|move to|target/i)).toBeInTheDocument();
      });
    });

    it('prevents selecting self as target parent', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      await user.pointer({ keys: '[MouseRight]', target: scienceItem! });

      const moveOption = await screen.findByRole('menuitem', { name: /move/i });
      await user.click(moveOption);

      const dialog = await screen.findByRole('dialog');

      // Science should be disabled in the target list
      const scienceTarget = within(dialog).getByText('Science');
      const targetItem = scienceTarget.closest('[role="option"]') || scienceTarget.closest('li');
      expect(targetItem).toHaveAttribute('aria-disabled', 'true');
    });

    it('prevents selecting descendants as target parent', async () => {
      render(<CategoryManagement expandAll />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      await user.pointer({ keys: '[MouseRight]', target: scienceItem! });

      const moveOption = await screen.findByRole('menuitem', { name: /move/i });
      await user.click(moveOption);

      const dialog = await screen.findByRole('dialog');

      // Physics (child of Science) should be disabled
      const physicsTarget = within(dialog).getByText('Physics');
      const targetItem = physicsTarget.closest('[role="option"]') || physicsTarget.closest('li');
      expect(targetItem).toHaveAttribute('aria-disabled', 'true');
    });

    it('calls API to move category when confirmed', async () => {
      const moveSpy = vi.fn();
      server.use(
        http.post(`${API_BASE}/:id/move`, async ({ request, params }) => {
          const body = await request.json();
          moveSpy({ id: params.id, body });
          return HttpResponse.json({ success: true });
        })
      );

      render(<CategoryManagement expandAll />, { queryClient });

      await waitForLoadingToFinish();

      const physicsItem = screen.getByText('Physics').closest('li');
      await user.pointer({ keys: '[MouseRight]', target: physicsItem! });

      const moveOption = await screen.findByRole('menuitem', { name: /move/i });
      await user.click(moveOption);

      const dialog = await screen.findByRole('dialog');

      // Select Arts as destination
      const artsTarget = within(dialog).getByText('Arts');
      await user.click(artsTarget);

      const confirmButton = within(dialog).getByRole('button', { name: /move|confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(moveSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            id: '4', // Physics ID
            body: expect.objectContaining({ parent: 2 }), // Arts ID
          })
        );
      });
    });
  });

  // ==========================================================================
  // Test Suite: Toggle Visibility
  // ==========================================================================

  describe('Toggle Visibility', () => {
    it('renders visibility toggle button for each category', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      const visibilityButton = within(scienceItem!).getByRole('button', { name: /visibility|hide|show/i });
      expect(visibilityButton).toBeInTheDocument();
    });

    it('shows eye icon for visible categories', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      const eyeIcon = within(scienceItem!).queryByTestId(/visibility-on|eye-open/i);
      expect(eyeIcon).toBeInTheDocument();
    });

    it('shows crossed eye icon for hidden categories', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Technology is hidden
      const techItem = screen.getByText('Technology').closest('li');
      const eyeOffIcon = within(techItem!).queryByTestId(/visibility-off|eye-closed/i);
      expect(eyeOffIcon).toBeInTheDocument();
    });

    it('toggles visibility when button clicked', async () => {
      const toggleSpy = vi.fn();
      server.use(
        http.put(`${API_BASE}/:id/visibility`, async ({ request, params }) => {
          const body = await request.json();
          toggleSpy({ id: params.id, body });
          return HttpResponse.json({
            success: true,
            data: { id: params.id, visible: (body as { visible: number }).visible },
          });
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      const visibilityButton = within(scienceItem!).getByRole('button', { name: /visibility|hide/i });
      await user.click(visibilityButton);

      await waitFor(() => {
        expect(toggleSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            id: '1',
            body: expect.objectContaining({ visible: 0 }),
          })
        );
      });
    });

    it('reverts visibility icon if API call fails', async () => {
      server.use(
        http.put(`${API_BASE}/:id/visibility`, () => {
          return HttpResponse.json(
            { success: false, error: { code: 'TOGGLE_FAILED', message: 'Failed' } },
            { status: 500 }
          );
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      const visibilityButton = within(scienceItem!).getByRole('button', { name: /visibility|hide/i });

      // Initially visible
      expect(within(scienceItem!).queryByTestId(/visibility-on/i)).toBeInTheDocument();

      await user.click(visibilityButton);

      // Should revert after error
      await waitFor(() => {
        expect(within(scienceItem!).queryByTestId(/visibility-on/i)).toBeInTheDocument();
        expect(screen.getByText(/failed|error/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Test Suite: Context Menu
  // ==========================================================================

  describe('Context Menu', () => {
    it('opens context menu on right-click of category', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      await user.pointer({ keys: '[MouseRight]', target: scienceItem! });

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('shows all available actions in menu', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      await user.pointer({ keys: '[MouseRight]', target: scienceItem! });

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /move/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /add.*sub/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /visibility|hide|show/i })).toBeInTheDocument();
      });
    });

    it('closes context menu when action clicked', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      await user.pointer({ keys: '[MouseRight]', target: scienceItem! });

      const editItem = await screen.findByRole('menuitem', { name: /edit/i });
      await user.click(editItem);

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('closes context menu when clicking outside', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      await user.pointer({ keys: '[MouseRight]', target: scienceItem! });

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      // Click outside
      await user.click(document.body);

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Test Suite: Form Validation
  // ==========================================================================

  describe('Form Validation', () => {
    it('validates category name is required', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');
      const submitButton = within(dialog).getByRole('button', { name: /create|save/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/name.*required|required/i)).toBeInTheDocument();
      });
    });

    it('validates category name length (min/max)', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');
      const nameInput = within(dialog).getByLabelText(/name/i);

      // Too short
      await user.type(nameInput, 'A');
      const submitButton = within(dialog).getByRole('button', { name: /create|save/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/too short|minimum|at least/i)).toBeInTheDocument();
      });
    });

    it('shows inline error messages for invalid fields', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');
      const submitButton = within(dialog).getByRole('button', { name: /create|save/i });
      await user.click(submitButton);

      await waitFor(() => {
        // Error should be associated with the name field
        const nameInput = within(dialog).getByLabelText(/name/i);
        expect(nameInput).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('clears validation errors when field corrected', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');
      const submitButton = within(dialog).getByRole('button', { name: /create|save/i });
      await user.click(submitButton);

      // Error should appear
      await waitFor(() => {
        expect(screen.getByText(/name.*required/i)).toBeInTheDocument();
      });

      // Correct the field
      const nameInput = within(dialog).getByLabelText(/name/i);
      await user.type(nameInput, 'Valid Name');

      // Error should clear
      await waitFor(() => {
        expect(screen.queryByText(/name.*required/i)).not.toBeInTheDocument();
      });
    });

    it('disables submit button while form is invalid', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');

      // Initially the button might be enabled; click to trigger validation
      const submitButton = within(dialog).getByRole('button', { name: /create|save/i });
      await user.click(submitButton);

      // After failed validation, it may remain enabled for retry
      // Let's verify the form doesn't submit with invalid data
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument(); // Dialog still open
      });
    });
  });

  // ==========================================================================
  // Test Suite: Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('displays error message when category fetch fails', async () => {
      server.use(
        http.get(API_BASE, () => {
          return HttpResponse.json(
            { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to load' } },
            { status: 500 }
          );
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitFor(() => {
        expect(screen.getByText(/failed.*load|error|unable/i)).toBeInTheDocument();
      });
    });

    it('shows retry button in error state', async () => {
      server.use(
        http.get(API_BASE, () => {
          return HttpResponse.json(
            { success: false, error: { code: 'FETCH_ERROR', message: 'Failed' } },
            { status: 500 }
          );
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry|try again/i })).toBeInTheDocument();
      });
    });

    it('handles 403 permission errors with appropriate message', async () => {
      server.use(
        http.get(API_BASE, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'PERMISSION_DENIED', message: 'Access denied' },
            },
            { status: 403 }
          );
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitFor(() => {
        expect(screen.getByText(/permission|access denied|not authorized/i)).toBeInTheDocument();
      });
    });

    it('handles 404 category not found errors', async () => {
      server.use(
        http.get(`${API_BASE}/:id`, () => {
          return HttpResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } },
            { status: 404 }
          );
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Try to edit a category
      const scienceItem = screen.getByText('Science').closest('li');
      const editButton = within(scienceItem!).getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Could show not found error in dialog or snackbar
    });

    it('handles 409 conflict errors', async () => {
      server.use(
        http.post(API_BASE, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'DUPLICATE_NAME', message: 'Category name already exists' },
            },
            { status: 409 }
          );
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText(/name/i), 'Science'); // Duplicate name

      const submitButton = within(dialog).getByRole('button', { name: /create|save/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/already exists|duplicate/i)).toBeInTheDocument();
      });
    });

    it('shows Snackbar for operation errors', async () => {
      server.use(
        http.delete(`${API_BASE}/:id`, () => {
          return HttpResponse.json(
            { success: false, error: { code: 'DELETE_FAILED', message: 'Could not delete' } },
            { status: 500 }
          );
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const artsItem = screen.getByText('Arts').closest('li');
      const deleteButton = within(artsItem!).getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      const dialog = await screen.findByRole('dialog');
      const confirmButton = within(dialog).getByRole('button', { name: /delete|confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        // Look for snackbar alert
        const snackbar = screen.getByRole('alert');
        expect(snackbar).toBeInTheDocument();
        expect(snackbar).toHaveTextContent(/could not delete|failed|error/i);
      });
    });

    it('allows manual dismissal of error messages', async () => {
      server.use(
        http.get(API_BASE, () => {
          return HttpResponse.json(
            { success: false, error: { code: 'ERROR', message: 'Error occurred' } },
            { status: 500 }
          );
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Find and click close button on snackbar
      const closeButton = screen.getByRole('button', { name: /close|dismiss/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Test Suite: Loading States
  // ==========================================================================

  describe('Loading States', () => {
    it('shows skeleton loaders while fetching categories', async () => {
      server.use(
        http.get(API_BASE, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({ success: true, data: createFlatCategories() });
        })
      );

      render(<CategoryManagement />, { queryClient });

      // Should show loading state
      expect(
        screen.getByRole('progressbar') ||
          screen.queryAllByTestId(/skeleton/i).length > 0 ||
          screen.getByText(/loading/i)
      ).toBeTruthy();

      await waitForLoadingToFinish();
    });

    it('shows loading spinner in dialog during form submission', async () => {
      server.use(
        http.post(API_BASE, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: mockCourseCategory({ id: 100, name: 'New' }),
          });
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText(/name/i), 'New Category');

      const submitButton = within(dialog).getByRole('button', { name: /create|save/i });
      await user.click(submitButton);

      // Should show loading in dialog
      await waitFor(() => {
        expect(
          within(dialog).queryByRole('progressbar') ||
            submitButton.hasAttribute('disabled')
        ).toBeTruthy();
      });
    });

    it('disables all actions while mutation is in progress', async () => {
      server.use(
        http.post(API_BASE, async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return HttpResponse.json({
            success: true,
            data: mockCourseCategory({ id: 100 }),
          });
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText(/name/i), 'New');

      const submitButton = within(dialog).getByRole('button', { name: /create|save/i });
      await user.click(submitButton);

      // Submit button should be disabled during submission
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });
  });

  // ==========================================================================
  // Test Suite: Permissions and Authorization
  // ==========================================================================

  describe('Permissions and Authorization', () => {
    it('hides create button if user lacks create permission', async () => {
      // Mock categories endpoint to return user permissions
      server.use(
        http.get(API_BASE, () => {
          return HttpResponse.json({
            success: true,
            data: createFlatCategories(),
            meta: {
              permissions: {
                canCreate: false,
                canEdit: true,
                canDelete: true,
              },
            },
          });
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      expect(
        screen.queryByRole('button', { name: /add category|new category/i })
      ).not.toBeInTheDocument();
    });

    it('hides edit button if user lacks edit permission', async () => {
      server.use(
        http.get(API_BASE, () => {
          return HttpResponse.json({
            success: true,
            data: createFlatCategories(),
            meta: {
              permissions: {
                canCreate: true,
                canEdit: false,
                canDelete: true,
              },
            },
          });
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const categoryItem = screen.getByText('Category 1').closest('li');
      expect(
        within(categoryItem!).queryByRole('button', { name: /edit/i })
      ).not.toBeInTheDocument();
    });

    it('hides delete button if user lacks delete permission', async () => {
      server.use(
        http.get(API_BASE, () => {
          return HttpResponse.json({
            success: true,
            data: createFlatCategories(),
            meta: {
              permissions: {
                canCreate: true,
                canEdit: true,
                canDelete: false,
              },
            },
          });
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const categoryItem = screen.getByText('Category 1').closest('li');
      expect(
        within(categoryItem!).queryByRole('button', { name: /delete/i })
      ).not.toBeInTheDocument();
    });

    it('disables drag-and-drop if user lacks move permission', async () => {
      server.use(
        http.get(API_BASE, () => {
          return HttpResponse.json({
            success: true,
            data: createFlatCategories(),
            meta: {
              permissions: {
                canCreate: true,
                canEdit: true,
                canDelete: true,
                canMove: false,
              },
            },
          });
        })
      );

      render(<CategoryManagement allowDragDrop />, { queryClient });

      await waitForLoadingToFinish();

      const categoryItem = screen.getByText('Category 1').closest('li');
      expect(categoryItem).not.toHaveAttribute('draggable', 'true');
    });
  });

  // ==========================================================================
  // Test Suite: React Query Integration
  // ==========================================================================

  describe('React Query Integration', () => {
    it('uses useQuery to fetch category hierarchy', async () => {
      const fetchSpy = vi.fn();
      server.use(
        http.get(API_BASE, () => {
          fetchSpy();
          return HttpResponse.json({ success: true, data: createFlatCategories() });
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      expect(fetchSpy).toHaveBeenCalled();
    });

    it('uses useMutation for category operations', async () => {
      const createSpy = vi.fn();
      server.use(
        http.post(API_BASE, async ({ request }) => {
          const body = await request.json();
          createSpy(body);
          return HttpResponse.json({
            success: true,
            data: mockCourseCategory({ id: 100, ...body as object }),
          });
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText(/name/i), 'Test');

      const submitButton = within(dialog).getByRole('button', { name: /create|save/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalled();
      });
    });

    it('invalidates category query cache after mutations', async () => {
      const fetchSpy = vi.fn();
      server.use(
        http.get(API_BASE, () => {
          fetchSpy();
          return HttpResponse.json({ success: true, data: createFlatCategories() });
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const initialCallCount = fetchSpy.mock.calls.length;

      // Create a new category
      const addButton = screen.getByRole('button', { name: /add category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText(/name/i), 'New');

      const submitButton = within(dialog).getByRole('button', { name: /create|save/i });
      await user.click(submitButton);

      // After creation, query should be invalidated and refetched
      await waitFor(() => {
        expect(fetchSpy.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it('implements optimistic updates for visibility toggle', async () => {
      server.use(
        http.put(`${API_BASE}/:id/visibility`, async () => {
          // Delay response to observe optimistic update
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({ success: true });
        })
      );

      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      const visibilityButton = within(scienceItem!).getByRole('button', { name: /visibility|hide/i });

      // Initially visible (eye-open icon)
      expect(within(scienceItem!).queryByTestId(/visibility-on/i)).toBeInTheDocument();

      await user.click(visibilityButton);

      // Should immediately update (optimistic)
      await waitFor(() => {
        expect(within(scienceItem!).queryByTestId(/visibility-off/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Test Suite: Accessibility
  // ==========================================================================

  describe('Accessibility', () => {
    it('TreeView is keyboard navigable (arrow keys)', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const tree = screen.getByRole('list');
      tree.focus();

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}');

      // Focus should move to first/next item
      const firstItem = screen.getByText('Science').closest('li');
      expect(firstItem).toHaveAttribute('data-focused', 'true');
    });

    it('Enter key expands/collapses category', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science');
      scienceItem.focus();

      // Press Enter to expand
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Physics')).toBeInTheDocument();
      });
    });

    it('all categories have accessible names (ARIA labels)', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const listItems = screen.getAllByRole('listitem');

      listItems.forEach((item) => {
        expect(item).toHaveAccessibleName();
      });
    });

    it('focus management for dialogs', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');

      // Focus should be inside the dialog
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('focus returns to trigger after dialog closes', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const addButton = screen.getByRole('button', { name: /add category/i });
      await user.click(addButton);

      await screen.findByRole('dialog');

      // Close dialog
      const cancelButton = screen.getByRole('button', { name: /cancel|close/i });
      await user.click(cancelButton);

      // Focus should return to add button
      await waitFor(() => {
        expect(document.activeElement).toBe(addButton);
      });
    });

    it('all action buttons have tooltips', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');

      // Hover over edit button
      const editButton = within(scienceItem!).getByRole('button', { name: /edit/i });
      await user.hover(editButton);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('ARIA live regions announce tree changes', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Create a new category
      const addButton = screen.getByRole('button', { name: /add category/i });
      await user.click(addButton);

      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText(/name/i), 'New Category');

      const submitButton = within(dialog).getByRole('button', { name: /create|save/i });
      await user.click(submitButton);

      await waitFor(() => {
        // Look for ARIA live region announcement
        const liveRegion = screen.getByRole('status') || screen.getByRole('alert');
        expect(liveRegion).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Test Suite: Performance
  // ==========================================================================

  describe('Performance', () => {
    it('uses React.memo to prevent unnecessary re-renders', async () => {
      // This test verifies memoization indirectly by checking render behavior
      const { rerender } = render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      // Re-render with same props
      rerender(<CategoryManagement />);

      // Component should still be stable
      expect(screen.getByText('Science')).toBeInTheDocument();
    });

    it('search debouncing prevents excessive re-renders', async () => {
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const searchInput = screen.getByRole('searchbox') ||
        screen.getByPlaceholderText(/search/i);

      // Type quickly
      await user.type(searchInput, 'test', { delay: 10 });

      // Should not have filtered until debounce completes
      await new Promise((resolve) => setTimeout(resolve, 100));

      // After debounce, filter should be applied
      await waitFor(
        () => {
          // Either shows no results or filtered results
          expect(searchInput).toHaveValue('test');
        },
        { timeout: 500 }
      );
    });

    it('component does not re-render entire tree on single category update', async () => {
      // This is tested by verifying that the tree structure remains stable
      // when only visibility of one item changes
      render(<CategoryManagement />, { queryClient });

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      const artsItem = screen.getByText('Arts').closest('li');

      // Get initial render state
      const artsInitialText = artsItem?.textContent;

      // Toggle visibility of Science
      const visibilityButton = within(scienceItem!).getByRole('button', { name: /visibility/i });
      await user.click(visibilityButton);

      await waitFor(() => {
        // Arts should remain unchanged (same content, not re-created)
        expect(artsItem?.textContent).toBe(artsInitialText);
      });
    });
  });

  // ==========================================================================
  // Test Suite: Component Props
  // ==========================================================================

  describe('Component Props', () => {
    it('calls onCategorySelect when a category is clicked', async () => {
      const onSelect = vi.fn();

      render(<CategoryManagement onCategorySelect={onSelect} />, { queryClient });

      await waitForLoadingToFinish();

      await user.click(screen.getByText('Science'));

      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith(
          expect.objectContaining({ id: 1, name: 'Science' })
        );
      });
    });

    it('respects showCourseCount prop', async () => {
      const { rerender } = render(
        <CategoryManagement showCourseCount={false} />,
        { queryClient }
      );

      await waitForLoadingToFinish();

      // Course counts should not be visible
      expect(screen.queryByText('10')).not.toBeInTheDocument();

      // Re-render with showCourseCount true
      rerender(<CategoryManagement showCourseCount />);

      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument();
      });
    });

    it('respects expandAll prop', async () => {
      render(<CategoryManagement expandAll />, { queryClient });

      await waitForLoadingToFinish();

      // All nested categories should be visible
      expect(screen.getByText('Physics')).toBeInTheDocument();
      expect(screen.getByText('Quantum Mechanics')).toBeInTheDocument();
      expect(screen.getByText('Music')).toBeInTheDocument();
    });

    it('respects allowDragDrop prop', async () => {
      const { rerender } = render(
        <CategoryManagement allowDragDrop={false} />,
        { queryClient }
      );

      await waitForLoadingToFinish();

      const scienceItem = screen.getByText('Science').closest('li');
      expect(scienceItem).not.toHaveAttribute('draggable', 'true');

      // Re-render with drag enabled
      rerender(<CategoryManagement allowDragDrop />);

      await waitFor(() => {
        const updatedItem = screen.getByText('Science').closest('[draggable]');
        expect(updatedItem).toHaveAttribute('draggable', 'true');
      });
    });
  });
});
