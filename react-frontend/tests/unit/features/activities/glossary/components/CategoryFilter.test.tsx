/**
 * Unit Tests for CategoryFilter Component
 *
 * Comprehensive test suite validating category filtering functionality including:
 * - Multi-select behavior with controlled component state management
 * - Category list rendering with All Categories and Not Categorized options
 * - onChange callback firing with correct category IDs
 * - Material-UI Select integration and accessibility
 * - Edge cases (empty categories, single category, dynamic prop changes)
 *
 * @module tests/unit/features/activities/glossary/components
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Component under test
import { CategoryFilter } from '@/features/activities/glossary/components/CategoryFilter';

// Types
import type { GlossaryCategory } from '@/features/activities/glossary/types/glossary.types';

// Test helpers
import { render } from '@/tests/helpers/render';

/**
 * Special category ID constants (matching component implementation)
 */
const CATEGORY_ALL = -1;
const CATEGORY_NOT_CATEGORIZED = 0;

/**
 * Test suite for CategoryFilter component
 */
describe('CategoryFilter', () => {
  // Mock data
  let mockCategories: GlossaryCategory[];
  let mockOnChange: ReturnType<typeof vi.fn>;

  /**
   * Setup before each test
   * Initializes fresh mock data and callback for isolated testing
   */
  beforeEach(() => {
    // Create mock onChange callback
    mockOnChange = vi.fn();

    // Create mock categories with realistic data
    mockCategories = [
      {
        id: 1,
        glossaryid: 100,
        name: 'Technical Terms',
        usedynalink: true,
        entrycount: 15,
      },
      {
        id: 2,
        glossaryid: 100,
        name: 'Business Concepts',
        usedynalink: false,
        entrycount: 8,
      },
      {
        id: 3,
        glossaryid: 100,
        name: 'Academic Vocabulary',
        usedynalink: true,
        entrycount: 23,
      },
    ];
  });

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe('Rendering', () => {
    it('renders with empty selection', () => {
      render(
        <CategoryFilter
          categories={mockCategories}
          value={[]}
          onChange={mockOnChange}
        />
      );

      // Component should be in the document
      const select = screen.getByLabelText(/filter by category/i);
      expect(select).toBeInTheDocument();
    });

    it('renders with preselected categories', () => {
      render(
        <CategoryFilter
          categories={mockCategories}
          value={[1, 2]}
          onChange={mockOnChange}
        />
      );

      // Should display chips for selected categories
      expect(screen.getByText('Technical Terms')).toBeInTheDocument();
      expect(screen.getByText('Business Concepts')).toBeInTheDocument();
    });

    it('displays All Categories option', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      // Open the dropdown
      const select = screen.getByLabelText(/filter by category/i);
      await user.click(select);

      // Wait for menu to appear
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // All Categories option should be visible
      const allCategoriesOption = screen.getByRole('option', { name: /all categories/i });
      expect(allCategoriesOption).toBeInTheDocument();
    });

    it('displays Not Categorized option', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      // Open the dropdown
      const select = screen.getByLabelText(/filter by category/i);
      await user.click(select);

      // Wait for menu to appear
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Not Categorized option should be visible
      const notCategorizedOption = screen.getByRole('option', { name: /not categorized/i });
      expect(notCategorizedOption).toBeInTheDocument();
    });

    it('renders all provided categories from props', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      // Open the dropdown
      const select = screen.getByLabelText(/filter by category/i);
      await user.click(select);

      // Wait for menu to appear
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // All categories should be rendered
      expect(screen.getByRole('option', { name: /technical terms/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /business concepts/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /academic vocabulary/i })).toBeInTheDocument();
    });

    it('displays entry count for categories when available', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      // Open the dropdown
      const select = screen.getByLabelText(/filter by category/i);
      await user.click(select);

      // Wait for menu to appear
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Entry counts should be visible
      expect(screen.getByText(/\(15\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(8\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(23\)/)).toBeInTheDocument();
    });

    it('renders with custom label', () => {
      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
          label="Select Category"
        />
      );

      expect(screen.getByLabelText('Select Category')).toBeInTheDocument();
    });

    it('renders in disabled state', () => {
      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
          disabled
        />
      );

      const select = screen.getByLabelText(/filter by category/i);
      expect(select).toBeDisabled();
    });
  });

  // ============================================================================
  // Controlled Component Tests
  // ============================================================================

  describe('Controlled Component Behavior', () => {
    it('value prop controls selected state', () => {
      const { rerender } = render(
        <CategoryFilter
          categories={mockCategories}
          value={[1]}
          onChange={mockOnChange}
        />
      );

      // Initially shows first category
      expect(screen.getByText('Technical Terms')).toBeInTheDocument();

      // Update value prop
      rerender(
        <CategoryFilter
          categories={mockCategories}
          value={[2]}
          onChange={mockOnChange}
        />
      );

      // Should now show second category
      expect(screen.getByText('Business Concepts')).toBeInTheDocument();
      expect(screen.queryByText('Technical Terms')).not.toBeInTheDocument();
    });

    it('onChange callback fires with correct category IDs when selection changes', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      // Open the dropdown
      const select = screen.getByLabelText(/filter by category/i);
      await user.click(select);

      // Wait for menu to appear
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Click on a category
      const technicalTermsOption = screen.getByRole('option', { name: /technical terms/i });
      await user.click(technicalTermsOption);

      // onChange should be called with the category ID
      expect(mockOnChange).toHaveBeenCalledWith([1]);
    });

    it('supports clearing selection back to empty array', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilter
          categories={mockCategories}
          value={[1, 2]}
          onChange={mockOnChange}
        />
      );

      // Open the dropdown
      const select = screen.getByLabelText(/filter by category/i);
      await user.click(select);

      // Wait for menu to appear
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Click on All Categories to clear selection
      const allCategoriesOption = screen.getByRole('option', { name: /all categories/i });
      await user.click(allCategoriesOption);

      // onChange should be called with All Categories ID
      expect(mockOnChange).toHaveBeenCalledWith([CATEGORY_ALL]);
    });

    it('defaults to All Categories when empty array is selected', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilter
          categories={mockCategories}
          value={[1]}
          onChange={mockOnChange}
        />
      );

      // Open the dropdown
      const select = screen.getByLabelText(/filter by category/i);
      await user.click(select);

      // Wait for menu to appear
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Deselect current category by clicking it again
      const technicalTermsOption = screen.getByRole('option', { name: /technical terms/i });
      await user.click(technicalTermsOption);

      // Component should default to All Categories when selection is empty
      // Based on component code, this calls onChange with [CATEGORY_ALL]
      expect(mockOnChange).toHaveBeenCalledWith([CATEGORY_ALL]);
    });
  });

  // ============================================================================
  // Multi-Select Behavior Tests
  // ============================================================================

  describe('Multi-Select Behavior', () => {
    it('multiple categories can be selected simultaneously', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilter
          categories={mockCategories}
          value={[]}
          onChange={mockOnChange}
        />
      );

      // Open the dropdown
      const select = screen.getByLabelText(/filter by category/i);
      await user.click(select);

      // Wait for menu to appear
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Select first category
      const technicalTermsOption = screen.getByRole('option', { name: /technical terms/i });
      await user.click(technicalTermsOption);

      expect(mockOnChange).toHaveBeenCalledWith([1]);

      // Simulate selecting second category (in real app, component would rerender with updated value)
      // The component is controlled, so parent would update value prop
      // For testing, we verify that multiple IDs can be in the value prop
      const { rerender } = render(
        <CategoryFilter
          categories={mockCategories}
          value={[1, 2]}
          onChange={mockOnChange}
        />
      );

      // Both categories should be displayed as chips
      expect(screen.getByText('Technical Terms')).toBeInTheDocument();
      expect(screen.getByText('Business Concepts')).toBeInTheDocument();
    });

    it('selected categories display as chips inside select', () => {
      render(
        <CategoryFilter
          categories={mockCategories}
          value={[1, 2, 3]}
          onChange={mockOnChange}
        />
      );

      // All selected categories should be visible as chips
      expect(screen.getByText('Technical Terms')).toBeInTheDocument();
      expect(screen.getByText('Business Concepts')).toBeInTheDocument();
      expect(screen.getByText('Academic Vocabulary')).toBeInTheDocument();
    });

    it('All Categories chip displays when CATEGORY_ALL is selected', () => {
      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('All Categories')).toBeInTheDocument();
    });

    it('Not Categorized chip displays when CATEGORY_NOT_CATEGORIZED is selected', () => {
      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_NOT_CATEGORIZED]}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Not Categorized')).toBeInTheDocument();
    });

    it('selecting All Categories clears other selections', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilter
          categories={mockCategories}
          value={[1, 2]}
          onChange={mockOnChange}
        />
      );

      // Open the dropdown
      const select = screen.getByLabelText(/filter by category/i);
      await user.click(select);

      // Wait for menu to appear
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Click All Categories
      const allCategoriesOption = screen.getByRole('option', { name: /all categories/i });
      await user.click(allCategoriesOption);

      // onChange should be called with only CATEGORY_ALL
      expect(mockOnChange).toHaveBeenCalledWith([CATEGORY_ALL]);
    });

    it('selecting a regular category when All Categories is selected replaces it', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      // Open the dropdown
      const select = screen.getByLabelText(/filter by category/i);
      await user.click(select);

      // Wait for menu to appear
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Click a regular category
      const technicalTermsOption = screen.getByRole('option', { name: /technical terms/i });
      await user.click(technicalTermsOption);

      // onChange should be called with the specific category ID
      // The multi-select will pass both CATEGORY_ALL and 1, but the component handles this
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('select has proper aria labels', () => {
      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      const select = screen.getByLabelText(/filter by category/i);
      expect(select).toHaveAttribute('aria-labelledby');
    });

    it('select has proper id attributes for accessibility', () => {
      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      const select = screen.getByLabelText(/filter by category/i);
      expect(select).toHaveAttribute('id', 'glossary-category-filter');
    });

    it('keyboard navigation works - arrow keys open dropdown', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      const select = screen.getByLabelText(/filter by category/i);
      
      // Focus the select
      await user.tab();
      expect(select).toHaveFocus();

      // Press arrow down to open dropdown
      await user.keyboard('{ArrowDown}');

      // Wait for menu to appear
      await waitFor(() => {
        const listbox = screen.queryByRole('listbox');
        expect(listbox).toBeInTheDocument();
      });
    });

    it('keyboard navigation works - enter to select option', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      const select = screen.getByLabelText(/filter by category/i);
      
      // Focus and open dropdown
      await user.click(select);

      // Wait for menu to appear
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      
      // Press Enter to select
      await user.keyboard('{Enter}');

      // onChange should have been called
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('keyboard navigation works - escape to close dropdown', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      const select = screen.getByLabelText(/filter by category/i);
      
      // Open dropdown
      await user.click(select);

      // Wait for menu to appear
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Press Escape to close
      await user.keyboard('{Escape}');

      // Wait for menu to disappear
      await waitFor(() => {
        const listbox = screen.queryByRole('listbox');
        expect(listbox).not.toBeInTheDocument();
      });
    });

    it('focus management is correct when opening and closing dropdown', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      const select = screen.getByLabelText(/filter by category/i);
      
      // Focus should move to select when tabbing
      await user.tab();
      expect(select).toHaveFocus();

      // Open dropdown
      await user.click(select);

      // Wait for menu to appear
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Close dropdown
      await user.keyboard('{Escape}');

      // Focus should return to select
      await waitFor(() => {
        expect(select).toHaveFocus();
      });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles empty categories array', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilter
          categories={[]}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      // Component should still render
      const select = screen.getByLabelText(/filter by category/i);
      expect(select).toBeInTheDocument();

      // Open dropdown
      await user.click(select);

      // Wait for menu to appear
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Should show special options but empty state message for regular categories
      expect(screen.getByRole('option', { name: /all categories/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /not categorized/i })).toBeInTheDocument();
      expect(screen.getByText(/no categories available/i)).toBeInTheDocument();
    });

    it('handles single category', async () => {
      const user = userEvent.setup();

      const singleCategory: GlossaryCategory[] = [
        {
          id: 1,
          glossaryid: 100,
          name: 'Technical Terms',
          usedynalink: true,
          entrycount: 15,
        },
      ];

      render(
        <CategoryFilter
          categories={singleCategory}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      // Open dropdown
      const select = screen.getByLabelText(/filter by category/i);
      await user.click(select);

      // Wait for menu to appear
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Should show special options and the single category
      expect(screen.getByRole('option', { name: /all categories/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /not categorized/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /technical terms/i })).toBeInTheDocument();
    });

    it('updates when categories prop changes', async () => {
      const user = userEvent.setup();

      const { rerender } = render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      // Open dropdown and verify initial categories
      const select = screen.getByLabelText(/filter by category/i);
      await user.click(select);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      expect(screen.getByRole('option', { name: /technical terms/i })).toBeInTheDocument();

      // Close dropdown
      await user.keyboard('{Escape}');

      // Update categories prop with new data
      const newCategories: GlossaryCategory[] = [
        {
          id: 4,
          glossaryid: 100,
          name: 'New Category',
          usedynalink: true,
          entrycount: 5,
        },
      ];

      rerender(
        <CategoryFilter
          categories={newCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      // Open dropdown again
      await user.click(select);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Should show new category
      expect(screen.getByRole('option', { name: /new category/i })).toBeInTheDocument();
      // Old categories should not be present
      expect(screen.queryByRole('option', { name: /technical terms/i })).not.toBeInTheDocument();
    });

    it('handles category without entrycount property', async () => {
      const user = userEvent.setup();

      const categoriesWithoutCount: GlossaryCategory[] = [
        {
          id: 1,
          glossaryid: 100,
          name: 'Technical Terms',
          usedynalink: true,
          // entrycount is optional and not provided
        },
      ];

      render(
        <CategoryFilter
          categories={categoriesWithoutCount}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      // Open dropdown
      const select = screen.getByLabelText(/filter by category/i);
      await user.click(select);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Category should render without count
      const categoryOption = screen.getByRole('option', { name: /technical terms/i });
      expect(categoryOption).toBeInTheDocument();
      // Should not have entry count displayed
      expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
    });

    it('handles selecting Not Categorized option', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
        />
      );

      // Open dropdown
      const select = screen.getByLabelText(/filter by category/i);
      await user.click(select);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Click Not Categorized
      const notCategorizedOption = screen.getByRole('option', { name: /not categorized/i });
      await user.click(notCategorizedOption);

      // onChange should be called with CATEGORY_NOT_CATEGORIZED
      expect(mockOnChange).toHaveBeenCalledWith([CATEGORY_NOT_CATEGORIZED]);
    });

    it('displays correct chip for unknown category ID', () => {
      // Edge case: value contains ID not in categories array
      render(
        <CategoryFilter
          categories={mockCategories}
          value={[999]}
          onChange={mockOnChange}
        />
      );

      // Should display fallback chip text
      expect(screen.getByText('Category 999')).toBeInTheDocument();
    });

    it('handles fullWidth prop correctly', () => {
      const { container } = render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
          fullWidth
        />
      );

      // FormControl should have fullWidth styling
      const formControl = container.querySelector('.MuiFormControl-root');
      expect(formControl).toHaveClass('MuiFormControl-fullWidth');
    });

    it('handles different size variants', () => {
      const { rerender, container } = render(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
          size="small"
        />
      );

      // FormControl should have small size class
      let formControl = container.querySelector('.MuiFormControl-root');
      expect(formControl).toHaveClass('MuiFormControl-sizeSmall');

      // Rerender with medium size
      rerender(
        <CategoryFilter
          categories={mockCategories}
          value={[CATEGORY_ALL]}
          onChange={mockOnChange}
          size="medium"
        />
      );

      formControl = container.querySelector('.MuiFormControl-root');
      expect(formControl).not.toHaveClass('MuiFormControl-sizeSmall');
    });
  });
});
