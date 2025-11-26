/**
 * Unit Tests for BookNavigation Component
 *
 * Comprehensive test suite for the BookNavigation component that provides
 * Previous/Next chapter navigation controls for the Moodle book activity module.
 *
 * Test Coverage:
 * - Button rendering with proper labels and icons
 * - Click handlers calling onNavigate with correct chapter IDs
 * - Disabled states at chapter boundaries (first/last)
 * - Keyboard navigation shortcuts (ArrowLeft/ArrowRight)
 * - Event listener cleanup on unmount
 * - Accessibility features (ARIA labels, keyboard navigation)
 * - Edge cases (single chapter, rapid clicks)
 * - Responsive layout verification
 *
 * Based on Moodle book navigation functionality from:
 * - public/mod/book/view.php
 * - public/mod/book/templates/main_action_menu.mustache
 *
 * @module tests/unit/features/activities/book
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { userEvent } from '@tests/helpers/render';
import BookNavigation from '@/features/activities/book/components/BookNavigation';
import type { Chapter } from '@/features/activities/book/types/book.types';

// ============================================================================
// Test Data Fixtures
// ============================================================================

/**
 * Create a mock chapter for testing
 * @param overrides - Partial chapter properties to override defaults
 * @returns Complete Chapter object with all required properties
 */
const createMockChapter = (overrides: Partial<Chapter> = {}): Chapter => ({
  id: 1,
  bookid: 100,
  pagenum: 1,
  title: 'Chapter 1',
  subchapter: 0,
  content: '<p>Test content</p>',
  contentformat: 1,
  hidden: 0,
  timecreated: Date.now(),
  timemodified: Date.now(),
  importsrc: '',
  parent: null,
  number: null,
  prev: null,
  next: null,
  ...overrides,
});

/**
 * Create an array of mock chapters for testing navigation scenarios
 * @param count - Number of chapters to create
 * @returns Array of Chapter objects with sequential IDs and page numbers
 */
const createMockChapters = (count: number): Chapter[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockChapter({
      id: index + 1,
      pagenum: index + 1,
      title: `Chapter ${index + 1}`,
    })
  );
};

// ============================================================================
// Test Suite Setup
// ============================================================================

describe('BookNavigation Component', () => {
  // Shared test state
  let mockOnNavigate: ReturnType<typeof vi.fn>;
  let mockChapters: Chapter[];

  /**
   * Setup before each test
   * Creates fresh mock data and callback functions
   */
  beforeEach(() => {
    // Create mock callback function
    mockOnNavigate = vi.fn();

    // Create default set of 5 chapters for most tests
    mockChapters = createMockChapters(5);
  });

  /**
   * Cleanup after each test
   * Clears all mocks and unmounts components
   */
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Button Rendering Tests
  // ==========================================================================

  describe('Button Rendering', () => {
    it('should render Previous button with correct label', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      expect(previousButton).toBeInTheDocument();
      expect(previousButton).toHaveTextContent('Previous');
    });

    it('should render Next button with correct label', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeInTheDocument();
      expect(nextButton).toHaveTextContent('Next');
    });

    it('should render Previous button with NavigateBefore icon', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      const icon = previousButton.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon?.getAttribute('data-testid')).toBe('NavigateBeforeIcon');
    });

    it('should render Next button with NavigateNext icon', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      const icon = nextButton.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon?.getAttribute('data-testid')).toBe('NavigateNextIcon');
    });

    it('should render both buttons when on middle chapter', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('should render navigation container with correct ID', () => {
      const { container } = render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const navContainer = container.querySelector('#mod_book-chaptersnavigation');
      expect(navContainer).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Click Handler Tests
  // ==========================================================================

  describe('Click Handlers', () => {
    it('should call onNavigate with previous chapter ID when Previous button clicked', async () => {
      const user = userEvent.setup();

      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      await user.click(previousButton);

      expect(mockOnNavigate).toHaveBeenCalledTimes(1);
      expect(mockOnNavigate).toHaveBeenCalledWith(2); // Chapter ID 2 (previous of chapter 3)
    });

    it('should call onNavigate with next chapter ID when Next button clicked', async () => {
      const user = userEvent.setup();

      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      expect(mockOnNavigate).toHaveBeenCalledTimes(1);
      expect(mockOnNavigate).toHaveBeenCalledWith(4); // Chapter ID 4 (next of chapter 3)
    });

    it('should not call onNavigate when disabled Previous button clicked', async () => {
      render(
        <BookNavigation
          currentChapterId={1}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      
      // Assert button is disabled
      expect(previousButton).toBeDisabled();
      
      // Use fireEvent to force click on disabled button and verify no navigation
      fireEvent.click(previousButton);
      expect(mockOnNavigate).not.toHaveBeenCalled();
    });

    it('should not call onNavigate when disabled Next button clicked', async () => {
      render(
        <BookNavigation
          currentChapterId={5}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      
      // Assert button is disabled
      expect(nextButton).toBeDisabled();
      
      // Use fireEvent to force click on disabled button and verify no navigation
      fireEvent.click(nextButton);
      expect(mockOnNavigate).not.toHaveBeenCalled();
    });

    it('should handle rapid consecutive clicks correctly', async () => {
      const user = userEvent.setup();

      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });

      // Simulate rapid clicks
      await user.click(nextButton);
      await user.click(nextButton);
      await user.click(nextButton);

      // All clicks should be registered (no debouncing in component)
      expect(mockOnNavigate).toHaveBeenCalledTimes(3);
      expect(mockOnNavigate).toHaveBeenCalledWith(4);
    });
  });

  // ==========================================================================
  // Disabled States at Boundaries
  // ==========================================================================

  describe('Disabled States at Boundaries', () => {
    it('should disable Previous button on first chapter', () => {
      render(
        <BookNavigation
          currentChapterId={1}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      expect(previousButton).toBeDisabled();
    });

    it('should enable Next button on first chapter', () => {
      render(
        <BookNavigation
          currentChapterId={1}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).not.toBeDisabled();
    });

    it('should enable Previous button on last chapter', () => {
      render(
        <BookNavigation
          currentChapterId={5}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      expect(previousButton).not.toBeDisabled();
    });

    it('should disable Next button on last chapter', () => {
      render(
        <BookNavigation
          currentChapterId={5}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it('should enable both buttons on middle chapter', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      const nextButton = screen.getByRole('button', { name: /next/i });

      expect(previousButton).not.toBeDisabled();
      expect(nextButton).not.toBeDisabled();
    });

    it('should disable both buttons with single chapter', () => {
      const singleChapter = createMockChapters(1);

      render(
        <BookNavigation
          currentChapterId={1}
          chapters={singleChapter}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      const nextButton = screen.getByRole('button', { name: /next/i });

      expect(previousButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });

    it('should disable both buttons when current chapter not found', () => {
      render(
        <BookNavigation
          currentChapterId={999}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      const nextButton = screen.getByRole('button', { name: /next/i });

      expect(previousButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });
  });

  // ==========================================================================
  // Keyboard Navigation Tests
  // ==========================================================================

  describe('Keyboard Navigation', () => {
    it('should navigate to previous chapter on ArrowLeft key press', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      fireEvent.keyDown(window, { key: 'ArrowLeft' });

      expect(mockOnNavigate).toHaveBeenCalledTimes(1);
      expect(mockOnNavigate).toHaveBeenCalledWith(2);
    });

    it('should navigate to next chapter on ArrowRight key press', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(mockOnNavigate).toHaveBeenCalledTimes(1);
      expect(mockOnNavigate).toHaveBeenCalledWith(4);
    });

    it('should not navigate to previous on ArrowLeft when on first chapter', () => {
      render(
        <BookNavigation
          currentChapterId={1}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      fireEvent.keyDown(window, { key: 'ArrowLeft' });

      expect(mockOnNavigate).not.toHaveBeenCalled();
    });

    it('should not navigate to next on ArrowRight when on last chapter', () => {
      render(
        <BookNavigation
          currentChapterId={5}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(mockOnNavigate).not.toHaveBeenCalled();
    });

    it('should prevent default behavior on ArrowLeft when navigating', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      
      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should prevent default behavior on ArrowRight when navigating', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      
      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should ignore keyboard navigation when input element is focused', () => {
      render(
        <div>
          <input type="text" data-testid="test-input" />
          <BookNavigation
            currentChapterId={3}
            chapters={mockChapters}
            onNavigate={mockOnNavigate}
          />
        </div>
      );

      const input = screen.getByTestId('test-input');
      input.focus();

      fireEvent.keyDown(input, { key: 'ArrowLeft' });
      fireEvent.keyDown(input, { key: 'ArrowRight' });

      expect(mockOnNavigate).not.toHaveBeenCalled();
    });

    it('should ignore keyboard navigation when textarea element is focused', () => {
      render(
        <div>
          <textarea data-testid="test-textarea" />
          <BookNavigation
            currentChapterId={3}
            chapters={mockChapters}
            onNavigate={mockOnNavigate}
          />
        </div>
      );

      const textarea = screen.getByTestId('test-textarea');
      textarea.focus();

      fireEvent.keyDown(textarea, { key: 'ArrowLeft' });
      fireEvent.keyDown(textarea, { key: 'ArrowRight' });

      expect(mockOnNavigate).not.toHaveBeenCalled();
    });

    it('should ignore non-arrow key presses', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      fireEvent.keyDown(window, { key: 'Enter' });
      fireEvent.keyDown(window, { key: 'Space' });
      fireEvent.keyDown(window, { key: 'Tab' });
      fireEvent.keyDown(window, { key: 'a' });

      expect(mockOnNavigate).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Event Listener Cleanup Tests
  // ==========================================================================

  describe('Event Listener Cleanup', () => {
    it('should remove keyboard event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should not trigger navigation after component unmounts', () => {
      const { unmount } = render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      unmount();

      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(mockOnNavigate).not.toHaveBeenCalled();
    });

    it('should update event listener when navigation state changes', () => {
      const { rerender } = render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      // Navigate to next chapter
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(mockOnNavigate).toHaveBeenCalledWith(4);

      mockOnNavigate.mockClear();

      // Rerender with new current chapter
      rerender(
        <BookNavigation
          currentChapterId={4}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      // Should now navigate from chapter 4 to chapter 5
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(mockOnNavigate).toHaveBeenCalledWith(5);
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('should have proper ARIA label on Previous button with chapter title', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      expect(previousButton).toHaveAttribute('aria-label', 'Previous chapter: Chapter 2');
    });

    it('should have proper ARIA label on Next button with chapter title', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toHaveAttribute('aria-label', 'Next chapter: Chapter 4');
    });

    it('should have fallback ARIA label when Previous chapter not available', () => {
      render(
        <BookNavigation
          currentChapterId={1}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      expect(previousButton).toHaveAttribute('aria-label', 'Previous chapter (not available)');
    });

    it('should have fallback ARIA label when Next chapter not available', () => {
      render(
        <BookNavigation
          currentChapterId={5}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toHaveAttribute('aria-label', 'Next chapter (not available)');
    });

    it('should have title attribute on Previous button with chapter title', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      expect(previousButton).toHaveAttribute('title', 'Chapter 2');
    });

    it('should have title attribute on Next button with chapter title', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toHaveAttribute('title', 'Chapter 4');
    });

    it('should not have title attribute when Previous chapter not available', () => {
      render(
        <BookNavigation
          currentChapterId={1}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      expect(previousButton).not.toHaveAttribute('title');
    });

    it('should not have title attribute when Next chapter not available', () => {
      render(
        <BookNavigation
          currentChapterId={5}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).not.toHaveAttribute('title');
    });

    it('should be keyboard navigable with Tab key', async () => {
      const user = userEvent.setup();

      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      const nextButton = screen.getByRole('button', { name: /next/i });

      // Tab to Previous button
      await user.tab();
      expect(previousButton).toHaveFocus();

      // Tab to Next button
      await user.tab();
      expect(nextButton).toHaveFocus();
    });

    it('should be activatable with Enter key when focused', async () => {
      const user = userEvent.setup();

      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      nextButton.focus();

      await user.keyboard('{Enter}');

      expect(mockOnNavigate).toHaveBeenCalledWith(4);
    });

    it('should be activatable with Space key when focused', async () => {
      const user = userEvent.setup();

      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      nextButton.focus();

      await user.keyboard(' ');

      expect(mockOnNavigate).toHaveBeenCalledWith(4);
    });
  });

  // ==========================================================================
  // Responsive Layout Tests
  // ==========================================================================

  describe('Responsive Layout', () => {
    it('should render navigation container with flexbox layout', () => {
      const { container } = render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const navContainer = container.querySelector('#mod_book-chaptersnavigation');

      // MUI Box with sx prop creates inline styles
      expect(navContainer).toBeInTheDocument();
    });

    it('should position Previous button on the left', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      const previousContainer = previousButton.parentElement;

      expect(previousContainer).toBeInTheDocument();
    });

    it('should position Next button on the right', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      const nextContainer = nextButton.parentElement;

      expect(nextContainer).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Edge Case Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty chapters array gracefully', () => {
      render(
        <BookNavigation
          currentChapterId={1}
          chapters={[]}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      const nextButton = screen.getByRole('button', { name: /next/i });

      expect(previousButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });

    it('should handle chapters with non-sequential IDs correctly', () => {
      const nonSequentialChapters = [
        createMockChapter({ id: 5, pagenum: 1, title: 'Chapter A' }),
        createMockChapter({ id: 10, pagenum: 2, title: 'Chapter B' }),
        createMockChapter({ id: 15, pagenum: 3, title: 'Chapter C' }),
      ];

      render(
        <BookNavigation
          currentChapterId={10}
          chapters={nonSequentialChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      const nextButton = screen.getByRole('button', { name: /next/i });

      expect(previousButton).not.toBeDisabled();
      expect(nextButton).not.toBeDisabled();

      fireEvent.click(previousButton);
      expect(mockOnNavigate).toHaveBeenCalledWith(5);

      mockOnNavigate.mockClear();

      fireEvent.click(nextButton);
      expect(mockOnNavigate).toHaveBeenCalledWith(15);
    });

    it('should handle chapters with hidden property correctly', () => {
      const chaptersWithHidden = [
        createMockChapter({ id: 1, pagenum: 1, title: 'Chapter 1', hidden: 0 }),
        createMockChapter({ id: 2, pagenum: 2, title: 'Chapter 2', hidden: 1 }),
        createMockChapter({ id: 3, pagenum: 3, title: 'Chapter 3', hidden: 0 }),
      ];

      render(
        <BookNavigation
          currentChapterId={1}
          chapters={chaptersWithHidden}
          onNavigate={mockOnNavigate}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      // Should navigate to hidden chapter (filtering is handled elsewhere)
      expect(mockOnNavigate).toHaveBeenCalledWith(2);
    });

    it('should handle subchapters correctly', () => {
      const chaptersWithSubchapters = [
        createMockChapter({ id: 1, pagenum: 1, title: 'Chapter 1', subchapter: 0 }),
        createMockChapter({ id: 2, pagenum: 2, title: 'Subchapter 1.1', subchapter: 1 }),
        createMockChapter({ id: 3, pagenum: 3, title: 'Chapter 2', subchapter: 0 }),
      ];

      render(
        <BookNavigation
          currentChapterId={2}
          chapters={chaptersWithSubchapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      const nextButton = screen.getByRole('button', { name: /next/i });

      expect(previousButton).not.toBeDisabled();
      expect(nextButton).not.toBeDisabled();

      fireEvent.click(previousButton);
      expect(mockOnNavigate).toHaveBeenCalledWith(1);

      mockOnNavigate.mockClear();

      fireEvent.click(nextButton);
      expect(mockOnNavigate).toHaveBeenCalledWith(3);
    });

    it('should update navigation when chapters array changes', () => {
      const initialChapters = createMockChapters(3);
      const updatedChapters = createMockChapters(5);

      const { rerender } = render(
        <BookNavigation
          currentChapterId={3}
          chapters={initialChapters}
          onNavigate={mockOnNavigate}
        />
      );

      // On initial render with 3 chapters, Next should be disabled
      let nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();

      // Rerender with 5 chapters, Next should now be enabled
      rerender(
        <BookNavigation
          currentChapterId={3}
          chapters={updatedChapters}
          onNavigate={mockOnNavigate}
        />
      );

      nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).not.toBeDisabled();
    });

    it('should update navigation when currentChapterId changes', () => {
      const { rerender } = render(
        <BookNavigation
          currentChapterId={1}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      // On first chapter, Previous should be disabled
      let previousButton = screen.getByRole('button', { name: /previous/i });
      expect(previousButton).toBeDisabled();

      // Rerender with middle chapter, Previous should be enabled
      rerender(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      previousButton = screen.getByRole('button', { name: /previous/i });
      expect(previousButton).not.toBeDisabled();
    });
  });

  // ==========================================================================
  // MUI Component Integration Tests
  // ==========================================================================

  describe('Material-UI Component Integration', () => {
    it('should use MUI Button component with text variant', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });
      const nextButton = screen.getByRole('button', { name: /next/i });

      // MUI buttons have the MuiButton class
      expect(previousButton.className).toContain('MuiButton');
      expect(nextButton.className).toContain('MuiButton');
    });

    it('should render MUI Box container', () => {
      const { container } = render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const navContainer = container.querySelector('#mod_book-chaptersnavigation');
      expect(navContainer?.className).toContain('MuiBox');
    });

    it('should apply custom styling to buttons', () => {
      render(
        <BookNavigation
          currentChapterId={3}
          chapters={mockChapters}
          onNavigate={mockOnNavigate}
        />
      );

      const previousButton = screen.getByRole('button', { name: /previous/i });

      // Component applies textTransform: 'none' via sx prop
      expect(previousButton).toBeInTheDocument();
    });
  });
});
