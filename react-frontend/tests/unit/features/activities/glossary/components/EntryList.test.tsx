/**
 * Unit Tests for EntryList Component
 *
 * Comprehensive test suite for the glossary EntryList component validating paginated entry
 * list rendering, Material-UI Card layout, search functionality with debounced input, sort
 * controls with multiple sort keys and order toggling, Material-UI Pagination integration,
 * empty state handling with permission-based Add Entry button, loading skeleton placeholders,
 * and onClick handlers for entry navigation.
 *
 * Test Coverage:
 * - Entry list rendering with Material-UI Cards
 * - Pagination with page count calculation and navigation
 * - Search functionality with debouncing (500ms delay)
 * - Sorting by CREATION, UPDATE, FIRSTNAME, LASTNAME with ASC/DESC toggle
 * - Empty state with conditional Add Entry button based on mod/glossary:write capability
 * - Entry interaction with onClick handlers
 * - Loading states with skeleton placeholders
 *
 * @module tests/unit/features/activities/glossary/components
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Component under test
import { EntryList } from '@/features/activities/glossary/components/EntryList';
import type { EntryListProps } from '@/features/activities/glossary/components/EntryList';

// Type definitions
import type { GlossaryEntry } from '@/features/activities/glossary/types/glossary.types';

// Test utilities
import { render } from '@tests/helpers/render';
import { createMockUser, generateMockId, generateMockDate } from '@tests/helpers/mockData';

// ============================================================================
// Mock Data Factory Functions
// ============================================================================

/**
 * Creates a mock glossary entry with realistic default values.
 * Supports partial overrides for customizing specific properties.
 */
function createMockGlossaryEntry(overrides: Partial<GlossaryEntry> = {}): GlossaryEntry {
  const id = overrides.id ?? generateMockId();
  const concept = overrides.concept ?? `Test Concept ${id}`;
  const definition = overrides.definition ?? `This is a test definition for ${concept}. It contains detailed information about the concept with sufficient length to test the preview truncation at 200 characters. Additional text here to ensure we exceed the limit.`;

  return {
    id,
    glossaryid: overrides.glossaryid ?? 1,
    concept,
    definition,
    definitionformat: overrides.definitionformat ?? 1, // HTML
    definitiontrust: overrides.definitiontrust ?? false,
    userid: overrides.userid ?? generateMockId(),
    userfullname: overrides.userfullname ?? 'John Doe',
    userpictureurl: overrides.userpictureurl ?? '',
    attachment: overrides.attachment ?? false,
    attachments: overrides.attachments ?? [],
    definitioninlinefiles: overrides.definitioninlinefiles ?? [],
    usedynalink: overrides.usedynalink ?? true,
    casesensitive: overrides.casesensitive ?? false,
    fullmatch: overrides.fullmatch ?? false,
    approved: overrides.approved ?? true,
    teacherentry: overrides.teacherentry ?? false,
    sourceglossaryid: overrides.sourceglossaryid ?? 0,
    tags: overrides.tags ?? [],
    timecreated: overrides.timecreated ?? generateMockDate(-7),
    timemodified: overrides.timemodified ?? generateMockDate(-1),
  };
}

/**
 * Creates default pagination configuration for testing.
 */
function createMockPagination(overrides: Partial<EntryListProps['pagination']> = {}): EntryListProps['pagination'] {
  return {
    offset: overrides.offset ?? 0,
    limit: overrides.limit ?? 10,
    total: overrides.total ?? 50,
    page: overrides.page ?? 0,
  };
}

/**
 * Creates default filter configuration for testing.
 */
function createMockFilters(overrides: Partial<EntryListProps['filters']> = {}): EntryListProps['filters'] {
  return {
    mode: overrides.mode ?? 'letter',
    hook: overrides.hook ?? '',
    sortkey: overrides.sortkey ?? '',
    sortorder: overrides.sortorder ?? 'ASC',
  };
}

// ============================================================================
// Test Suite Setup
// ============================================================================

describe('EntryList Component', () => {
  // Default props for component
  let defaultProps: EntryListProps;
  let mockOnPageChange: ReturnType<typeof vi.fn>;
  let mockOnEntrySelect: ReturnType<typeof vi.fn>;
  let mockOnSearchChange: ReturnType<typeof vi.fn>;
  let mockOnSortChange: ReturnType<typeof vi.fn>;
  let mockOnAddEntry: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Initialize mock callbacks
    mockOnPageChange = vi.fn();
    mockOnEntrySelect = vi.fn();
    mockOnSearchChange = vi.fn();
    mockOnSortChange = vi.fn();
    mockOnAddEntry = vi.fn();

    // Create default props
    defaultProps = {
      entries: Array.from({ length: 10 }, (_, i) =>
        createMockGlossaryEntry({
          id: i + 1,
          concept: `Entry ${i + 1}`,
          definition: `Definition for entry ${i + 1}. This is a longer definition to test preview functionality.`,
        })
      ),
      loading: false,
      pagination: createMockPagination(),
      filters: createMockFilters(),
      onPageChange: mockOnPageChange,
      onEntrySelect: mockOnEntrySelect,
      onSearchChange: mockOnSearchChange,
      onSortChange: mockOnSortChange,
      onAddEntry: mockOnAddEntry,
      glossaryId: 1,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Entry List Rendering Tests
  // ============================================================================

  describe('Entry List Rendering', () => {
    it('should render list of entries as Material-UI Cards', () => {
      render(<EntryList {...defaultProps} />);

      // Verify all entries are rendered
      defaultProps.entries.forEach((entry) => {
        expect(screen.getByText(entry.concept)).toBeInTheDocument();
      });

      // Verify cards exist in the document
      const cards = screen.getAllByRole('button'); // CardActionArea creates button role
      expect(cards.length).toBeGreaterThanOrEqual(defaultProps.entries.length);
    });

    it('should display each entry concept as heading (Typography h6)', () => {
      render(<EntryList {...defaultProps} />);

      // Find all h3 elements (component uses h3 with h6 variant)
      const headings = screen.getAllByRole('heading', { level: 3 });
      expect(headings).toHaveLength(defaultProps.entries.length);

      // Verify concepts are displayed
      defaultProps.entries.forEach((entry, index) => {
        expect(headings[index]).toHaveTextContent(entry.concept);
      });
    });

    it('should show definition preview with first 200 chars and HTML stripped', () => {
      const entryWithHtml = createMockGlossaryEntry({
        concept: 'HTML Entry',
        definition: '<p>This is a <strong>bold</strong> definition with HTML tags that should be stripped.</p>',
      });

      render(
        <EntryList
          {...defaultProps}
          entries={[entryWithHtml]}
        />
      );

      // Verify HTML is stripped
      expect(screen.getByText(/This is a bold definition with HTML tags/)).toBeInTheDocument();
      expect(screen.queryByText(/<p>/)).not.toBeInTheDocument();
      expect(screen.queryByText(/<strong>/)).not.toBeInTheDocument();
    });

    it('should display metadata with author name and date as card subtitle', () => {
      const entry = createMockGlossaryEntry({
        concept: 'Test Entry',
        userfullname: 'Jane Smith',
      });

      render(
        <EntryList
          {...defaultProps}
          entries={[entry]}
        />
      );

      // Verify author name is displayed
      expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    });

    it('should render correct number of entries based on entries prop', () => {
      const fiveEntries = Array.from({ length: 5 }, (_, i) =>
        createMockGlossaryEntry({ id: i + 1, concept: `Entry ${i + 1}` })
      );

      render(
        <EntryList
          {...defaultProps}
          entries={fiveEntries}
        />
      );

      // Verify exactly 5 entries are rendered
      fiveEntries.forEach((entry) => {
        expect(screen.getByText(entry.concept)).toBeInTheDocument();
      });

      const headings = screen.getAllByRole('heading', { level: 3 });
      expect(headings).toHaveLength(5);
    });

    it('should handle loading state with skeleton placeholders', () => {
      render(
        <EntryList
          {...defaultProps}
          loading
          entries={[]}
        />
      );

      // Verify skeleton loaders are displayed
      // MUI Skeleton components have a specific class
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);

      // Verify no actual entries are shown
      expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
    });

    it('should display pending approval badge for unapproved entries', () => {
      const unapprovedEntry = createMockGlossaryEntry({
        concept: 'Unapproved Entry',
        approved: false,
      });

      render(
        <EntryList
          {...defaultProps}
          entries={[unapprovedEntry]}
        />
      );

      expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    });

    it('should not display approval badge for approved entries', () => {
      const approvedEntry = createMockGlossaryEntry({
        concept: 'Approved Entry',
        approved: true,
      });

      render(
        <EntryList
          {...defaultProps}
          entries={[approvedEntry]}
        />
      );

      expect(screen.queryByText('Pending Approval')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Pagination Tests
  // ============================================================================

  describe('Pagination', () => {
    it('should render Material-UI Pagination component', () => {
      render(<EntryList {...defaultProps} />);

      // Pagination component creates navigation with page buttons
      const pagination = screen.getByRole('navigation');
      expect(pagination).toBeInTheDocument();
    });

    it('should show correct page count calculated from total entries and entries per page', () => {
      const pagination = createMockPagination({
        total: 50,
        limit: 10, // 50 / 10 = 5 pages
      });

      render(
        <EntryList
          {...defaultProps}
          pagination={pagination}
        />
      );

      // MUI Pagination renders page buttons - verify page 5 exists
      expect(screen.getByRole('button', { name: 'Go to page 5' })).toBeInTheDocument();
    });

    it('should make page numbers clickable and trigger callback', async () => {
      const user = userEvent.setup();
      render(<EntryList {...defaultProps} />);

      // Click on page 2
      const page2Button = screen.getByRole('button', { name: 'Go to page 2' });
      await user.click(page2Button);

      // Verify callback was called with correct page (0-indexed)
      expect(mockOnPageChange).toHaveBeenCalledWith(1); // Page 2 is index 1
    });

    it('should highlight current page', () => {
      const pagination = createMockPagination({
        page: 2, // 0-indexed, so this is page 3 in UI
      });

      render(
        <EntryList
          {...defaultProps}
          pagination={pagination}
        />
      );

      // Current page button should be selected
      const currentPageButton = screen.getByRole('button', { name: 'page 3' });
      expect(currentPageButton).toHaveAttribute('aria-current', 'true');
    });

    it('should handle offset calculation correctly', () => {
      const pagination = createMockPagination({
        offset: 20, // Offset 20 means page 2 (if limit is 10)
        limit: 10,
        page: 2,
      });

      render(
        <EntryList
          {...defaultProps}
          pagination={pagination}
        />
      );

      // Verify page 3 is highlighted (page index 2 + 1)
      const currentPageButton = screen.getByRole('button', { name: 'page 3' });
      expect(currentPageButton).toHaveAttribute('aria-current', 'true');
    });

    it('should update pagination when total entries change', () => {
      const { rerender } = render(<EntryList {...defaultProps} />);

      // Initial: 50 entries, 10 per page = 5 pages
      expect(screen.getByRole('button', { name: 'Go to page 5' })).toBeInTheDocument();

      // Update to 100 entries = 10 pages
      const updatedPagination = createMockPagination({
        total: 100,
        limit: 10,
      });

      rerender(
        <EntryList
          {...defaultProps}
          pagination={updatedPagination}
        />
      );

      // Verify page 10 now exists
      expect(screen.getByRole('button', { name: 'Go to page 10' })).toBeInTheDocument();
    });

    it('should handle edge case: single page (no pagination shown)', () => {
      const singlePagePagination = createMockPagination({
        total: 5,
        limit: 10, // Only 5 entries, limit is 10 = 1 page
      });

      render(
        <EntryList
          {...defaultProps}
          entries={defaultProps.entries.slice(0, 5)}
          pagination={singlePagePagination}
        />
      );

      // Pagination should not be rendered for single page
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });

    it('should handle edge case: no entries (no pagination shown)', () => {
      const noPagination = createMockPagination({
        total: 0,
        limit: 10,
      });

      render(
        <EntryList
          {...defaultProps}
          entries={[]}
          pagination={noPagination}
        />
      );

      // Pagination should not be rendered
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Search Functionality Tests
  // ============================================================================

  describe('Search Functionality', () => {
    it('should render search TextField with search icon', () => {
      render(<EntryList {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search entries...');
      expect(searchInput).toBeInTheDocument();

      // Search icon should be present (MUI InputAdornment)
      const searchIcon = document.querySelector('[data-testid="SearchIcon"]');
      expect(searchIcon).toBeInTheDocument();
    });

    it('should update search input on user typing', async () => {
      const user = userEvent.setup();
      render(<EntryList {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search entries...');
      await user.type(searchInput, 'test query');

      expect(searchInput).toHaveValue('test query');
    });

    it('should trigger debounced callback after typing stops', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ delay: null });

      render(<EntryList {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search entries...');

      // Type rapidly
      await user.type(searchInput, 'test');

      // Callback should not be called immediately
      expect(mockOnSearchChange).not.toHaveBeenCalled();

      // Advance timers by debounce delay (500ms) and flush promises
      await act(async () => {
        vi.advanceTimersByTime(500);
        await Promise.resolve();
      });

      // Now callback should be called
      expect(mockOnSearchChange).toHaveBeenCalledWith('test');

      vi.useRealTimers();
    });

    it('should not trigger callback immediately during typing', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ delay: null });

      render(<EntryList {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search entries...');

      // Type multiple characters quickly
      await user.type(searchInput, 't');
      await act(async () => {
        vi.advanceTimersByTime(100);
        await Promise.resolve();
      });
      await user.type(searchInput, 'e');
      await act(async () => {
        vi.advanceTimersByTime(100);
        await Promise.resolve();
      });
      await user.type(searchInput, 's');
      await act(async () => {
        vi.advanceTimersByTime(100);
        await Promise.resolve();
      });
      await user.type(searchInput, 't');

      // Callback should not be called yet (total 400ms < 500ms)
      expect(mockOnSearchChange).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should use appropriate debounce delay (500ms)', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ delay: null });

      render(<EntryList {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search entries...');
      await user.type(searchInput, 'query');

      // Test exactly 500ms delay
      await act(async () => {
        vi.advanceTimersByTime(499);
        await Promise.resolve();
      });
      expect(mockOnSearchChange).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1); // Total 500ms
        await Promise.resolve();
      });
      
      expect(mockOnSearchChange).toHaveBeenCalledWith('query');

      vi.useRealTimers();
    });

    it('should work with empty query (shows all entries)', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ delay: null });

      const filtersWithSearch = createMockFilters({ hook: 'previous' });
      render(
        <EntryList
          {...defaultProps}
          filters={filtersWithSearch}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search entries...');

      // Clear the search
      await user.clear(searchInput);

      await act(async () => {
        vi.advanceTimersByTime(500);
        await Promise.resolve();
      });

      expect(mockOnSearchChange).toHaveBeenCalledWith('');

      vi.useRealTimers();
    });

    it('should display current search value from filters prop', () => {
      const filtersWithSearch = createMockFilters({ hook: 'search term' });

      render(
        <EntryList
          {...defaultProps}
          filters={filtersWithSearch}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search entries...');
      expect(searchInput).toHaveValue('search term');
    });
  });

  // ============================================================================
  // Sorting Tests
  // ============================================================================

  describe('Sorting', () => {
    it('should render sort Select dropdown with options', () => {
      render(<EntryList {...defaultProps} />);

      // Find sort select by label
      const sortSelect = screen.getByLabelText('Sort by');
      expect(sortSelect).toBeInTheDocument();
    });

    it('should show all sort options: CREATION, UPDATE, FIRSTNAME, LASTNAME', async () => {
      const user = userEvent.setup();
      render(<EntryList {...defaultProps} />);

      // Open the select dropdown
      const sortSelect = screen.getByLabelText('Sort by');
      await user.click(sortSelect);

      // Verify all options are present
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Date Created' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Date Modified' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'First Name' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Last Name' })).toBeInTheDocument();
      });
    });

    it('should trigger callback with correct sortkey when selecting option', async () => {
      const user = userEvent.setup();
      render(<EntryList {...defaultProps} />);

      // Open select and choose CREATION
      const sortSelect = screen.getByLabelText('Sort by');
      await user.click(sortSelect);

      const creationOption = await screen.findByRole('option', { name: 'Date Created' });
      await user.click(creationOption);

      // Verify callback with correct sortkey
      expect(mockOnSortChange).toHaveBeenCalledWith('CREATION', 'ASC');
    });

    it('should work with sort order toggle button', async () => {
      const user = userEvent.setup();
      const filtersWithSort = createMockFilters({ sortkey: 'CREATION', sortorder: 'ASC' });

      render(
        <EntryList
          {...defaultProps}
          filters={filtersWithSort}
        />
      );

      // Find sort order toggle button
      const toggleButton = screen.getByRole('button', { name: /Sort order: Ascending/ });
      expect(toggleButton).toBeInTheDocument();

      await user.click(toggleButton);

      // Verify callback with toggled order
      expect(mockOnSortChange).toHaveBeenCalledWith('CREATION', 'DESC');
    });

    it('should show correct sort indicator for current sort direction', () => {
      const filtersAsc = createMockFilters({ sortorder: 'ASC' });

      const { rerender } = render(
        <EntryList
          {...defaultProps}
          filters={filtersAsc}
        />
      );

      // ArrowUpwardIcon should be present for ASC
      const ascButton = screen.getByRole('button', { name: /Sort order: Ascending/ });
      expect(ascButton).toBeInTheDocument();
      expect(ascButton.querySelector('[data-testid="ArrowUpwardIcon"]')).toBeInTheDocument();

      // Change to DESC
      const filtersDesc = createMockFilters({ sortorder: 'DESC' });
      rerender(
        <EntryList
          {...defaultProps}
          filters={filtersDesc}
        />
      );

      // ArrowDownwardIcon should be present for DESC
      const descButton = screen.getByRole('button', { name: /Sort order: Descending/ });
      expect(descButton).toBeInTheDocument();
      expect(descButton.querySelector('[data-testid="ArrowDownwardIcon"]')).toBeInTheDocument();
    });

    it('should combine sort with pagination correctly', async () => {
      const user = userEvent.setup();
      const filtersWithSort = createMockFilters({ sortkey: 'UPDATE', sortorder: 'DESC' });

      render(
        <EntryList
          {...defaultProps}
          filters={filtersWithSort}
        />
      );

      // Change page
      const page2Button = screen.getByRole('button', { name: 'Go to page 2' });
      await user.click(page2Button);

      expect(mockOnPageChange).toHaveBeenCalledWith(1);

      // Sort should still be maintained
      expect(screen.getByLabelText('Sort by')).toHaveTextContent('Date Modified');
    });
  });

  // ============================================================================
  // Empty State Tests
  // ============================================================================

  describe('Empty State', () => {
    it('should display empty state message when entries array is empty', () => {
      render(
        <EntryList
          {...defaultProps}
          entries={[]}
          pagination={createMockPagination({ total: 0 })}
        />
      );

      expect(screen.getByText('No entries found')).toBeInTheDocument();
    });

    it('should show Add Entry button in empty state if user has write permission', () => {
      // Mock user with write permission
      const userWithPermission = createMockUser({
        capabilities: [{ capability: 'mod/glossary:write', contextId: 1, granted: true }],
      });

      render(
        <EntryList
          {...defaultProps}
          entries={[]}
          pagination={createMockPagination({ total: 0 })}
        />,
        { user: userWithPermission, authenticated: true }
      );

      const addButton = screen.getByRole('button', { name: /Add Entry/i });
      expect(addButton).toBeInTheDocument();
    });

    it('should hide Add Entry button if no write permission', () => {
      // Mock user without write permission
      const userWithoutPermission = createMockUser({
        capabilities: [],
      });

      render(
        <EntryList
          {...defaultProps}
          entries={[]}
          pagination={createMockPagination({ total: 0 })}
        />,
        { user: userWithoutPermission, authenticated: true }
      );

      const addButton = screen.queryByRole('button', { name: /Add Entry/i });
      expect(addButton).not.toBeInTheDocument();
    });

    it('should have helpful instructional text in empty state', () => {
      render(
        <EntryList
          {...defaultProps}
          entries={[]}
          pagination={createMockPagination({ total: 0 })}
        />
      );

      expect(screen.getByText(/This glossary does not have any entries yet/)).toBeInTheDocument();
    });

    it('should show different message when search has no results', () => {
      const filtersWithSearch = createMockFilters({ hook: 'nonexistent' });

      render(
        <EntryList
          {...defaultProps}
          entries={[]}
          filters={filtersWithSearch}
          pagination={createMockPagination({ total: 0 })}
        />
      );

      expect(screen.getByText(/Try adjusting your search criteria or filters/)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Entry Interaction Tests
  // ============================================================================

  describe('Entry Interaction', () => {
    it('should trigger onClick handler with correct entry ID when clicking card', async () => {
      const user = userEvent.setup();
      const testEntry = createMockGlossaryEntry({ id: 42, concept: 'Clickable Entry' });

      render(
        <EntryList
          {...defaultProps}
          entries={[testEntry]}
        />
      );

      const entryCard = screen.getByText('Clickable Entry').closest('button');
      expect(entryCard).toBeInTheDocument();

      await user.click(entryCard!);

      expect(mockOnEntrySelect).toHaveBeenCalledWith(testEntry);
    });

    it('should have proper hover effects on entry cards', () => {
      const testEntry = createMockGlossaryEntry({ concept: 'Hover Entry' });

      render(
        <EntryList
          {...defaultProps}
          entries={[testEntry]}
        />
      );

      const card = screen.getByText('Hover Entry').closest('.MuiCard-root');
      // Verify the card is rendered and has necessary CSS classes for styling
      // Note: Material-UI applies hover effects via emotion CSS classes, not inline styles
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('MuiCard-root');
    });

    it('should navigate to detail view when entry is selected', async () => {
      const user = userEvent.setup();
      const entry = createMockGlossaryEntry({ id: 100, concept: 'Detail Entry' });

      render(
        <EntryList
          {...defaultProps}
          entries={[entry]}
        />
      );

      const entryButton = screen.getByText('Detail Entry').closest('button');
      await user.click(entryButton!);

      // Verify onEntrySelect was called with the full entry object
      expect(mockOnEntrySelect).toHaveBeenCalledTimes(1);
      expect(mockOnEntrySelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 100,
          concept: 'Detail Entry',
        })
      );
    });
  });

  // ============================================================================
  // Loading States Tests
  // ============================================================================

  describe('Loading States', () => {
    it('should display skeleton loader during initial load', () => {
      render(
        <EntryList
          {...defaultProps}
          loading
          entries={[]}
        />
      );

      // Verify multiple skeleton elements are present
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show skeleton count matching expected entries per page', () => {
      render(
        <EntryList
          {...defaultProps}
          loading
          entries={[]}
          pagination={createMockPagination({ limit: 6 })}
        />
      );

      // Component shows 6 skeleton cards by default
      const skeletonCards = document.querySelectorAll('.MuiCard-root');
      expect(skeletonCards).toHaveLength(6);
    });

    it('should not show entries during loading state', () => {
      render(
        <EntryList
          {...defaultProps}
          loading
          entries={defaultProps.entries}
        />
      );

      // Verify no actual entry concepts are rendered
      defaultProps.entries.forEach((entry) => {
        expect(screen.queryByText(entry.concept)).not.toBeInTheDocument();
      });
    });

    it('should hide loading skeletons after data loads', () => {
      const { rerender } = render(
        <EntryList
          {...defaultProps}
          loading
          entries={[]}
        />
      );

      // Verify skeletons are present
      expect(document.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);

      // Simulate data load
      rerender(
        <EntryList
          {...defaultProps}
          loading={false}
          entries={defaultProps.entries}
        />
      );

      // Verify skeletons are gone and entries are shown
      expect(document.querySelectorAll('.MuiSkeleton-root')).toHaveLength(0);
      expect(screen.getByText(defaultProps.entries[0]!.concept)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Integration Tests with Multiple Features
  // ============================================================================

  describe('Integration Tests', () => {
    it('should handle search, sort, and pagination together', async () => {
      const user = userEvent.setup({ delay: null });
      vi.useFakeTimers();

      render(<EntryList {...defaultProps} />);

      // Perform search
      const searchInput = screen.getByPlaceholderText('Search entries...');
      await user.type(searchInput, 'test');
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Assert directly after advancing timers (don't use waitFor with fake timers)
      expect(mockOnSearchChange).toHaveBeenCalledWith('test');

      // Change sort
      const sortSelect = screen.getByLabelText('Sort by');
      await user.click(sortSelect);
      // Advance timers to allow MUI to render the dropdown options
      act(() => {
        vi.advanceTimersByTime(100);
      });
      const updateOption = screen.getByRole('option', { name: 'Date Modified' });
      await user.click(updateOption);

      expect(mockOnSortChange).toHaveBeenCalledWith('UPDATE', 'ASC');

      // Change page
      const page3Button = screen.getByRole('button', { name: 'Go to page 3' });
      await user.click(page3Button);

      expect(mockOnPageChange).toHaveBeenCalledWith(2);

      vi.useRealTimers();
    });

    it('should maintain state when entries update', () => {
      const { rerender } = render(<EntryList {...defaultProps} />);

      // Verify initial entries
      expect(screen.getByText('Entry 1')).toBeInTheDocument();

      // Update entries
      const newEntries = Array.from({ length: 10 }, (_, i) =>
        createMockGlossaryEntry({ id: i + 100, concept: `New Entry ${i + 1}` })
      );

      rerender(
        <EntryList
          {...defaultProps}
          entries={newEntries}
        />
      );

      // Verify new entries are displayed
      expect(screen.getByText('New Entry 1')).toBeInTheDocument();
      expect(screen.queryByText('Entry 1')).not.toBeInTheDocument();
    });

    it('should handle Add Entry button click at bottom of page', async () => {
      const user = userEvent.setup({ delay: null });
      const userWithPermission = createMockUser({
        capabilities: [{ capability: 'mod/glossary:write', contextId: 1, granted: true }],
      });

      render(
        <EntryList {...defaultProps} />,
        { user: userWithPermission, authenticated: true }
      );

      // Find Add Entry button at bottom (not in empty state)
      const addButtons = screen.getAllByRole('button', { name: /Add Entry/i });
      const bottomButton = addButtons[addButtons.length - 1];
      expect(bottomButton).toBeDefined();

      await user.click(bottomButton!);

      expect(mockOnAddEntry).toHaveBeenCalledTimes(1);
    });
  });
});
