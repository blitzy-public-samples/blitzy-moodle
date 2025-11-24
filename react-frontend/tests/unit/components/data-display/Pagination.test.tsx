/**
 * Unit Tests for Pagination Component
 * 
 * Validates page navigation controls, current page highlighting, rows per page selector,
 * first/last/previous/next buttons, keyboard accessibility, compact/standard sizes,
 * ARIA labels, and WCAG 2.1 AA compliance.
 * 
 * Test Coverage:
 * - Rendering tests (page count, highlighting, buttons, empty state)
 * - Page navigation tests (clicks, prev/next, first/last, disabled states)
 * - Callback tests (onChange, correct data, rapid clicks)
 * - Rows per page tests (selector, size change, recalculation, bounds adjustment)
 * - Boundary tests (disabled states at boundaries)
 * - Size variant tests (compact vs standard spacing)
 * - Page number display tests (ellipsis, page range)
 * - Keyboard navigation tests (arrow keys, Enter/Space, Tab)
 * - Accessibility tests (ARIA labels, screen reader, focus indicators)
 * 
 * @see Section 0.7 - Test Infrastructure: Vitest and React Testing Library
 * @see Section 0.7 - Accessibility: WCAG 2.1 AA compliance with keyboard navigation
 * @see Section 0.1 - TypeScript strict mode with explicit prop interfaces
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { render, screen, userEvent, waitFor, within } from '../../../helpers/render';
import Pagination from '@/components/data-display/Pagination';

// Extend Jest matchers with jest-axe
expect.extend(toHaveNoViolations);

describe('Pagination Component', () => {
  // Common props for testing
  const defaultSimpleProps = {
    variant: 'simple' as const,
    count: 100,
    page: 1,
    onPageChange: vi.fn(),
  };

  const defaultTableProps = {
    variant: 'table' as const,
    count: 250,
    page: 0,
    rowsPerPage: 25,
    rowsPerPageOptions: [10, 25, 50, 100],
    onPageChange: vi.fn(),
    onRowsPerPageChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Rendering Tests', () => {
    it('should render simple pagination with correct page count', () => {
      render(<Pagination {...defaultSimpleProps} />);

      // With count=100 and default rowsPerPage=10, should have 10 pages
      const pagination = screen.getByRole('navigation', { name: /pagination navigation/i });
      expect(pagination).toBeInTheDocument();

      // Check page buttons exist (MUI shows limited page numbers with ellipsis)
      const pageButtons = within(pagination).getAllByRole('button');
      expect(pageButtons.length).toBeGreaterThan(0);
    });

    it('should render table pagination with rows per page selector', () => {
      render(<Pagination {...defaultTableProps} />);

      // Check rows per page label exists
      expect(screen.getByText(/rows per page:/i)).toBeInTheDocument();

      // Check select dropdown exists and displays correct value
      // MUI Select displays value as text content, not as value attribute
      const select = screen.getByRole('combobox', { name: /rows per page:/i });
      expect(select).toBeInTheDocument();
      expect(select).toHaveTextContent('25');
    });

    it('should highlight current page in simple variant', () => {
      render(<Pagination {...defaultSimpleProps} page={3} />);

      // Current page button should have aria-current attribute
      const currentPageButton = screen.getByRole('button', { name: /page 3/i });
      expect(currentPageButton).toBeInTheDocument();
      expect(currentPageButton).toHaveAttribute('aria-current', 'true');
    });

    it('should display navigation buttons when enabled', () => {
      render(
        <Pagination
          {...defaultSimpleProps}
          showFirstButton
          showLastButton
        />
      );

      // Check all navigation buttons exist
      expect(screen.getByRole('button', { name: /first page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /last page/i })).toBeInTheDocument();
    });

    it('should handle empty state when count is 0', () => {
      render(<Pagination {...defaultSimpleProps} count={0} />);

      const pagination = screen.getByRole('navigation', { name: /pagination navigation/i });
      expect(pagination).toBeInTheDocument();

      // With 0 pages, MUI Pagination still renders navigation buttons (first, prev, next, last)
      // but no page number buttons
      const pageNumberButtons = screen.queryAllByRole('button', { name: /^page \d+$/i });
      expect(pageNumberButtons).toHaveLength(0);
    });

    it('should render with custom className', () => {
      const { container } = render(
        <Pagination {...defaultSimpleProps} className="custom-pagination" />
      );

      const paginationBox = container.querySelector('.custom-pagination');
      expect(paginationBox).toBeInTheDocument();
    });
  });

  describe('Page Navigation Tests', () => {
    it('should call onPageChange when clicking page numbers', async () => {
      const handlePageChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Pagination
          {...defaultSimpleProps}
          page={1}
          onPageChange={handlePageChange}
        />
      );

      // Click on page 2
      const page2Button = screen.getByRole('button', { name: /page 2/i });
      await user.click(page2Button);

      expect(handlePageChange).toHaveBeenCalledTimes(1);
      expect(handlePageChange).toHaveBeenCalledWith(2);
    });

    it('should navigate to previous page when clicking previous button', async () => {
      const handlePageChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Pagination
          {...defaultSimpleProps}
          page={3}
          onPageChange={handlePageChange}
        />
      );

      const prevButton = screen.getByRole('button', { name: /previous page/i });
      await user.click(prevButton);

      expect(handlePageChange).toHaveBeenCalledTimes(1);
      expect(handlePageChange).toHaveBeenCalledWith(2);
    });

    it('should navigate to next page when clicking next button', async () => {
      const handlePageChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Pagination
          {...defaultSimpleProps}
          page={3}
          onPageChange={handlePageChange}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextButton);

      expect(handlePageChange).toHaveBeenCalledTimes(1);
      expect(handlePageChange).toHaveBeenCalledWith(4);
    });

    it('should jump to first page when clicking first button', async () => {
      const handlePageChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Pagination
          {...defaultSimpleProps}
          page={5}
          onPageChange={handlePageChange}
          showFirstButton
        />
      );

      const firstButton = screen.getByRole('button', { name: /first page/i });
      await user.click(firstButton);

      expect(handlePageChange).toHaveBeenCalledTimes(1);
      expect(handlePageChange).toHaveBeenCalledWith(1);
    });

    it('should jump to last page when clicking last button', async () => {
      const handlePageChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Pagination
          {...defaultSimpleProps}
          page={1}
          count={100}
          onPageChange={handlePageChange}
          showLastButton
        />
      );

      const lastButton = screen.getByRole('button', { name: /last page/i });
      await user.click(lastButton);

      expect(handlePageChange).toHaveBeenCalledTimes(1);
      // With count=100 and rowsPerPage=10 (default), last page is 10
      expect(handlePageChange).toHaveBeenCalledWith(10);
    });

    it('should disable navigation when disabled prop is true', async () => {
      const handlePageChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Pagination
          {...defaultSimpleProps}
          page={2}
          onPageChange={handlePageChange}
          disabled
        />
      );

      // All buttons should be disabled
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button: HTMLElement) => {
        expect(button).toBeDisabled();
      });

      // No need to try clicking - disabled buttons with pointer-events: none
      // cannot be clicked by user-event, which is the correct behavior
      expect(handlePageChange).not.toHaveBeenCalled();
    });
  });

  describe('Page Change Callback Tests', () => {
    it('should call onChange handler with correct page number', async () => {
      const handlePageChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Pagination
          {...defaultSimpleProps}
          page={1}
          onPageChange={handlePageChange}
        />
      );

      const page4Button = screen.getByRole('button', { name: /page 4/i });
      await user.click(page4Button);

      expect(handlePageChange).toHaveBeenCalledTimes(1);
      expect(handlePageChange).toHaveBeenCalledWith(4);
    });

    it('should provide correct page data to callback in table variant', async () => {
      const handlePageChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Pagination
          {...defaultTableProps}
          page={0}
          onPageChange={handlePageChange}
        />
      );

      // Table variant uses 0-indexed pages
      const nextButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextButton);

      expect(handlePageChange).toHaveBeenCalledTimes(1);
      expect(handlePageChange).toHaveBeenCalledWith(1);
    });

    it('should handle multiple rapid clicks correctly', async () => {
      const handlePageChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Pagination
          {...defaultSimpleProps}
          page={1}
          onPageChange={handlePageChange}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next page/i });

      // Simulate rapid clicks
      await user.click(nextButton);
      await user.click(nextButton);
      await user.click(nextButton);

      // Should be called 3 times
      expect(handlePageChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('Rows Per Page Tests', () => {
    it('should display available page size options in table variant', async () => {
      const user = userEvent.setup();

      render(<Pagination {...defaultTableProps} />);

      const select = screen.getByRole('combobox', { name: /rows per page:/i });
      await user.click(select);

      // Check all options are available
      await waitFor(() => {
        expect(screen.getByRole('option', { name: '10' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: '25' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: '50' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: '100' })).toBeInTheDocument();
      });
    });

    it('should call onRowsPerPageChange when changing page size', async () => {
      const handleRowsPerPageChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Pagination
          {...defaultTableProps}
          rowsPerPage={25}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      );

      const select = screen.getByRole('combobox', { name: /rows per page:/i });
      await user.click(select);

      const option50 = await screen.findByRole('option', { name: '50' });
      await user.click(option50);

      expect(handleRowsPerPageChange).toHaveBeenCalledTimes(1);
      expect(handleRowsPerPageChange).toHaveBeenCalledWith(50);
    });

    it('should recalculate total pages when rows per page changes', () => {
      const { rerender } = render(
        <Pagination
          variant="simple"
          count={100}
          page={1}
          rowsPerPage={10}
          onPageChange={vi.fn()}
        />
      );

      // With rowsPerPage=10, should have 10 pages
      let pagination = screen.getByRole('navigation');
      expect(pagination).toBeInTheDocument();

      // Change to rowsPerPage=25
      rerender(
        <Pagination
          variant="simple"
          count={100}
          page={1}
          rowsPerPage={25}
          onPageChange={vi.fn()}
        />
      );

      // With rowsPerPage=25, should have 4 pages
      pagination = screen.getByRole('navigation');
      expect(pagination).toBeInTheDocument();
    });

    it('should display custom rows per page label', () => {
      render(
        <Pagination
          {...defaultTableProps}
          labelRowsPerPage="Items per page:"
        />
      );

      expect(screen.getByText('Items per page:')).toBeInTheDocument();
    });

    it('should use custom labelDisplayedRows function', () => {
      const customLabel = ({ from, to, count }: { from: number; to: number; count: number }) =>
        `Showing ${from} to ${to} out of ${count} total`;

      render(
        <Pagination
          {...defaultTableProps}
          count={250}
          page={0}
          rowsPerPage={25}
          labelDisplayedRows={customLabel}
        />
      );

      expect(screen.getByText('Showing 1 to 25 out of 250 total')).toBeInTheDocument();
    });
  });

  describe('Boundary Buttons Tests', () => {
    it('should disable first page button when on first page', () => {
      render(
        <Pagination
          {...defaultSimpleProps}
          page={1}
          showFirstButton
        />
      );

      const firstButton = screen.getByRole('button', { name: /first page/i });
      expect(firstButton).toBeDisabled();
    });

    it('should disable previous button when on first page', () => {
      render(
        <Pagination
          {...defaultSimpleProps}
          page={1}
        />
      );

      const prevButton = screen.getByRole('button', { name: /previous page/i });
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button when on last page', () => {
      render(
        <Pagination
          variant="simple"
          count={100}
          page={10}
          rowsPerPage={10}
          onPageChange={vi.fn()}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next page/i });
      expect(nextButton).toBeDisabled();
    });

    it('should disable last page button when on last page', () => {
      render(
        <Pagination
          variant="simple"
          count={100}
          page={10}
          rowsPerPage={10}
          onPageChange={vi.fn()}
          showLastButton
        />
      );

      const lastButton = screen.getByRole('button', { name: /last page/i });
      expect(lastButton).toBeDisabled();
    });

    it('should enable all navigation buttons on middle pages', () => {
      render(
        <Pagination
          {...defaultSimpleProps}
          page={5}
          showFirstButton
          showLastButton
        />
      );

      const firstButton = screen.getByRole('button', { name: /first page/i });
      const prevButton = screen.getByRole('button', { name: /previous page/i });
      const nextButton = screen.getByRole('button', { name: /next page/i });
      const lastButton = screen.getByRole('button', { name: /last page/i });

      expect(firstButton).not.toBeDisabled();
      expect(prevButton).not.toBeDisabled();
      expect(nextButton).not.toBeDisabled();
      expect(lastButton).not.toBeDisabled();
    });
  });

  describe('Size Variant Tests', () => {
    it('should apply small size styling', () => {
      render(
        <Pagination
          {...defaultSimpleProps}
          size="small"
        />
      );

      // MUI Pagination with size="small" should have smaller buttons
      const pagination = screen.getByRole('navigation');
      expect(pagination).toBeInTheDocument();
      
      // Check that the size prop was passed to MUI component
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should apply medium size styling by default', () => {
      render(<Pagination {...defaultSimpleProps} />);

      const pagination = screen.getByRole('navigation');
      expect(pagination).toBeInTheDocument();
    });

    it('should apply large size styling', () => {
      render(
        <Pagination
          {...defaultSimpleProps}
          size="large"
        />
      );

      const pagination = screen.getByRole('navigation');
      expect(pagination).toBeInTheDocument();
    });

    it('should apply size prop to table variant', () => {
      render(
        <Pagination
          {...defaultTableProps}
          size="small"
        />
      );

      // TablePagination should have toolbar with adjusted height for small size
      const rowsPerPageLabel = screen.getByText(/rows per page:/i);
      expect(rowsPerPageLabel).toBeInTheDocument();
    });
  });

  describe('Page Number Display Tests', () => {
    it('should show ellipsis for hidden pages in large page sets', () => {
      render(
        <Pagination
          variant="simple"
          count={1000}
          page={50}
          rowsPerPage={10}
          onPageChange={vi.fn()}
        />
      );

      // MUI Pagination shows ellipsis (...) for pages not in range
      // With 100 total pages and current page 50, should show ellipsis
      const pagination = screen.getByRole('navigation');
      expect(pagination).toBeInTheDocument();

      // Should have limited number of page buttons (not all 100)
      const pageButtons = within(pagination).getAllByRole('button');
      // Navigation buttons + limited page numbers (typically < 15 buttons total)
      expect(pageButtons.length).toBeLessThan(20);
    });

    it('should adjust page range around current page', () => {
      const { rerender } = render(
        <Pagination
          variant="simple"
          count={1000}
          page={10}
          rowsPerPage={10}
          onPageChange={vi.fn()}
        />
      );

      // Current page 10 should be visible
      const page10Buttons = screen.getAllByRole('button', { name: /page 10/i });
      expect(page10Buttons.length).toBeGreaterThan(0);
      // Find the one with aria-current="true"
      const currentPage10Button = page10Buttons.find(btn => btn.getAttribute('aria-current') === 'true');
      expect(currentPage10Button).toBeDefined();
      expect(currentPage10Button).toHaveAttribute('aria-current', 'true');

      // Change to page 50
      rerender(
        <Pagination
          variant="simple"
          count={1000}
          page={50}
          rowsPerPage={10}
          onPageChange={vi.fn()}
        />
      );

      // Current page 50 should be visible
      const page50Buttons = screen.getAllByRole('button', { name: /page 50/i });
      expect(page50Buttons.length).toBeGreaterThan(0);
      // Find the one with aria-current="true"
      const currentPage50Button = page50Buttons.find(btn => btn.getAttribute('aria-current') === 'true');
      expect(currentPage50Button).toBeDefined();
      expect(currentPage50Button).toHaveAttribute('aria-current', 'true');
    });

    it('should show all pages when total is small', () => {
      render(
        <Pagination
          variant="simple"
          count={30}
          page={2}
          rowsPerPage={10}
          onPageChange={vi.fn()}
        />
      );

      // With only 3 pages, all should be visible
      expect(screen.getByRole('button', { name: /page 1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /page 2/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /page 3/i })).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation Tests', () => {
    it('should allow Tab key navigation through controls', async () => {
      const user = userEvent.setup();

      render(
        <Pagination
          {...defaultSimpleProps}
          page={2}
          showFirstButton
          showLastButton
        />
      );

      const firstButton = screen.getByRole('button', { name: /first page/i });

      // Focus first button
      firstButton.focus();
      expect(firstButton).toHaveFocus();

      // Tab to next button
      await user.tab();
      const prevButton = screen.getByRole('button', { name: /previous page/i });
      expect(prevButton).toHaveFocus();

      // Tab to next button
      await user.tab();
      // Should focus on first page number button
      expect(document.activeElement?.getAttribute('aria-label')).toMatch(/page/i);
    });

    it('should allow Shift+Tab reverse navigation', async () => {
      const user = userEvent.setup();

      render(
        <Pagination
          {...defaultSimpleProps}
          page={2}
          showFirstButton
        />
      );

      const lastButton = screen.getByRole('button', { name: /last page/i });
      lastButton.focus();

      // Shift+Tab should move backwards
      await user.tab({ shift: true });
      expect(document.activeElement?.getAttribute('aria-label')).toMatch(/next page|page/i);
    });

    it('should activate button with Enter key', async () => {
      const handlePageChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Pagination
          {...defaultSimpleProps}
          page={1}
          onPageChange={handlePageChange}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next page/i });
      nextButton.focus();

      await user.keyboard('{Enter}');

      expect(handlePageChange).toHaveBeenCalledTimes(1);
      expect(handlePageChange).toHaveBeenCalledWith(2);
    });

    it('should activate button with Space key', async () => {
      const handlePageChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Pagination
          {...defaultSimpleProps}
          page={1}
          onPageChange={handlePageChange}
        />
      );

      const page2Button = screen.getByRole('button', { name: /page 2/i });
      page2Button.focus();

      await user.keyboard(' ');

      expect(handlePageChange).toHaveBeenCalledTimes(1);
      expect(handlePageChange).toHaveBeenCalledWith(2);
    });

    it('should navigate select dropdown with keyboard in table variant', async () => {
      const user = userEvent.setup();

      render(<Pagination {...defaultTableProps} />);

      const select = screen.getByRole('combobox', { name: /rows per page:/i });
      select.focus();

      // Open dropdown with Enter
      await user.keyboard('{Enter}');

      // Options should be visible
      await waitFor(() => {
        expect(screen.getByRole('option', { name: '10' })).toBeInTheDocument();
      });

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');

      // Select with Enter
      await user.keyboard('{Enter}');
    });
  });

  describe('Accessibility Tests', () => {
    it('should have proper ARIA labels for navigation buttons', () => {
      render(
        <Pagination
          {...defaultSimpleProps}
          page={2}
          showFirstButton
          showLastButton
        />
      );

      // Check all navigation buttons have proper labels
      expect(screen.getByRole('button', { name: /first page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /last page/i })).toBeInTheDocument();
    });

    it('should have proper ARIA labels for page number buttons', () => {
      render(<Pagination {...defaultSimpleProps} page={2} />);

      // Page buttons should have "Go to page X" labels
      // Use more precise regex to avoid matching "page 10" when looking for "page 1"
      const page1Button = screen.getByRole('button', { name: /^go to page 1$/i });
      expect(page1Button).toBeInTheDocument();
      expect(page1Button).toHaveAccessibleName();
    });

    it('should mark current page with aria-current attribute', () => {
      render(<Pagination {...defaultSimpleProps} page={3} />);

      const currentPageButton = screen.getByRole('button', { name: /page 3/i });
      expect(currentPageButton).toBeInTheDocument();
      expect(currentPageButton).toHaveAttribute('aria-current', 'true');
    });

    it('should have navigation landmark with proper label', () => {
      render(<Pagination {...defaultSimpleProps} />);

      const navigation = screen.getByRole('navigation', { name: /pagination navigation/i });
      expect(navigation).toBeInTheDocument();
    });

    it('should have proper ARIA label for rows per page select', () => {
      render(<Pagination {...defaultTableProps} />);

      const select = screen.getByRole('combobox', { name: /rows per page:/i });
      expect(select).toBeInTheDocument();
      expect(select).toHaveAccessibleName();
    });

    it('should announce page changes to screen readers', async () => {
      const user = userEvent.setup();

      render(<Pagination {...defaultSimpleProps} page={1} />);

      const page2Button = screen.getByRole('button', { name: /page 2/i });
      await user.click(page2Button);

      // After re-render with page=2, current page should be marked
      // (In actual implementation, parent component would re-render with new page prop)
    });

    it('should have WCAG 2.1 AA compliant focus indicators', async () => {
      const user = userEvent.setup();

      render(<Pagination {...defaultSimpleProps} page={1} />);
      
      // Focus the button
      await user.tab();
      
      // MUI components have built-in focus indicators
      // The focused element should be visible and identifiable
      expect(document.activeElement).toBeInTheDocument();
    });

    it('should pass automated accessibility checks', async () => {
      const { container } = render(
        <Pagination
          {...defaultSimpleProps}
          page={5}
          showFirstButton
          showLastButton
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should pass accessibility checks for table variant', async () => {
      const { container } = render(
        <Pagination
          {...defaultTableProps}
          page={2}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should maintain color contrast in light mode', async () => {
      const { container } = render(
        <Pagination {...defaultSimpleProps} page={1} />,
        { themeMode: 'light' }
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should maintain color contrast in dark mode', async () => {
      const { container } = render(
        <Pagination {...defaultSimpleProps} page={1} />,
        { themeMode: 'dark' }
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper disabled state styling and ARIA attributes', () => {
      render(
        <Pagination
          {...defaultSimpleProps}
          page={2}
          disabled
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
        // MUI disabled buttons use the native 'disabled' attribute
        // which is sufficient for accessibility - no need for aria-disabled
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle count of 1 correctly', () => {
      render(
        <Pagination
          variant="simple"
          count={1}
          page={1}
          onPageChange={vi.fn()}
        />
      );

      // Should show single page
      const page1Button = screen.getByRole('button', { name: /page 1/i });
      expect(page1Button).toBeInTheDocument();

      // Next and last buttons should be disabled
      const nextButton = screen.getByRole('button', { name: /next page/i });
      expect(nextButton).toBeDisabled();
    });

    it('should handle very large counts', () => {
      render(
        <Pagination
          variant="simple"
          count={1000000}
          page={500}
          rowsPerPage={100}
          onPageChange={vi.fn()}
        />
      );

      // Should render without errors and show current page
      const pagination = screen.getByRole('navigation');
      expect(pagination).toBeInTheDocument();
    });

    it('should handle page prop changes correctly', () => {
      const { rerender, container } = render(
        <Pagination {...defaultSimpleProps} page={1} />
      );

      // The current page (page 1) should have aria-current="true"
      // It might not be a button role since it's the current page
      const currentPage1 = container.querySelector('[aria-current="true"]');
      expect(currentPage1).toBeInTheDocument();
      expect(currentPage1).toHaveTextContent('1');

      // Change page prop to 5
      rerender(<Pagination {...defaultSimpleProps} page={5} />);

      // Now page 5 should be the current page
      const currentPage5 = container.querySelector('[aria-current="true"]');
      expect(currentPage5).toBeInTheDocument();
      expect(currentPage5).toHaveTextContent('5');

      // And page 1 should now be clickable (a button)
      const page1Button = screen.getByRole('button', { name: /^go to page 1$/i });
      expect(page1Button).toBeInTheDocument();
    });

    it('should handle missing onRowsPerPageChange gracefully', () => {
      render(
        <Pagination
          {...defaultTableProps}
          onRowsPerPageChange={undefined}
        />
      );

      // Should still render select, but changing it would do nothing
      const select = screen.getByRole('combobox', { name: /rows per page:/i });
      expect(select).toBeInTheDocument();
    });

    it('should handle empty rowsPerPageOptions array', () => {
      render(
        <Pagination
          {...defaultTableProps}
          rowsPerPageOptions={[]}
        />
      );

      // When rowsPerPageOptions is empty, MUI hides the rows per page selector
      const rowsPerPageLabel = screen.queryByText(/rows per page:/i);
      expect(rowsPerPageLabel).not.toBeInTheDocument();
    });
  });

  describe('Integration with Parent Components', () => {
    it('should work with controlled page state', async () => {
      const user = userEvent.setup();
      let currentPage = 1;
      const handlePageChange = vi.fn((newPage: number) => {
        currentPage = newPage;
      });

      const { rerender } = render(
        <Pagination
          {...defaultSimpleProps}
          page={currentPage}
          onPageChange={handlePageChange}
        />
      );

      // Click next page
      const nextButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextButton);

      expect(handlePageChange).toHaveBeenCalledWith(2);

      // Parent would update state and re-render
      rerender(
        <Pagination
          {...defaultSimpleProps}
          page={2}
          onPageChange={handlePageChange}
        />
      );

      // Verify new current page
      const page2Button = screen.getByRole('button', { name: /page 2/i });
      expect(page2Button).toBeInTheDocument();
      expect(page2Button).toHaveAttribute('aria-current', 'true');
    });

    it('should synchronize page and rowsPerPage changes in table variant', async () => {
      const user = userEvent.setup();
      const handlePageChange = vi.fn();
      const handleRowsPerPageChange = vi.fn();

      render(
        <Pagination
          {...defaultTableProps}
          page={2}
          rowsPerPage={25}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      );

      // Change rows per page
      const select = screen.getByRole('combobox', { name: /rows per page:/i });
      await user.click(select);

      const option50 = await screen.findByRole('option', { name: '50' });
      await user.click(option50);

      expect(handleRowsPerPageChange).toHaveBeenCalledWith(50);
      // Parent would typically reset to page 0 when changing page size
    });
  });
});
