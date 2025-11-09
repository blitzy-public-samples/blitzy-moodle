import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import usePagination from '@/hooks/usePagination';

/**
 * Unit tests for usePagination custom hook
 *
 * Tests pagination state management and navigation logic used throughout
 * Moodle React frontend for course lists, user management, grade reports,
 * forum discussions, and other paginated data displays.
 *
 * The usePagination hook provides:
 * - Page state management (currentPage, totalPages, itemsPerPage)
 * - Navigation functions (next, previous, first, last, goToPage)
 * - Array slice indices for client-side pagination
 * - Page number generation with ellipsis for UI
 * - Boundary validation and page availability checks
 *
 * Pagination patterns tested here match Moodle's traditional pagination
 * behavior while enabling modern React state management and optimistic updates.
 */
describe('usePagination', () => {
  describe('Initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
        })
      );

      expect(result.current.currentPage).toBe(1);
      expect(result.current.itemsPerPage).toBe(20); // Default value
      expect(result.current.totalPages).toBe(5); // 100 / 20
      expect(result.current.totalItems).toBe(100);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.hasPreviousPage).toBe(false);
    });

    it('should initialize with custom initialPage and itemsPerPage', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPage: 3,
          itemsPerPage: 10,
        })
      );

      expect(result.current.currentPage).toBe(3);
      expect(result.current.itemsPerPage).toBe(10);
      expect(result.current.totalPages).toBe(10); // 100 / 10
      expect(result.current.totalItems).toBe(100);
    });

    it('should handle totalPages of 1', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 10,
          itemsPerPage: 20,
        })
      );

      expect(result.current.totalPages).toBe(1);
      expect(result.current.currentPage).toBe(1);
      expect(result.current.hasNextPage).toBe(false);
      expect(result.current.hasPreviousPage).toBe(false);
    });

    it('should handle totalItems of 0', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 0,
        })
      );

      expect(result.current.totalPages).toBe(1); // Minimum 1 page
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(0);
      expect(result.current.hasNextPage).toBe(false);
      expect(result.current.hasPreviousPage).toBe(false);
    });
  });

  describe('Array Slice Indices', () => {
    it('should calculate correct startIndex and endIndex', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 50,
          itemsPerPage: 10,
          initialPage: 1,
        })
      );

      // Page 1: indices 0-10
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(10);

      // Navigate to page 3: indices 20-30
      act(() => {
        result.current.goToPage(3);
      });

      expect(result.current.startIndex).toBe(20); // (3 - 1) * 10
      expect(result.current.endIndex).toBe(30);
    });

    it('should handle last page with partial items', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 47,
          itemsPerPage: 10,
        })
      );

      // Navigate to last page (page 5)
      act(() => {
        result.current.lastPage();
      });

      expect(result.current.currentPage).toBe(5);
      expect(result.current.startIndex).toBe(40); // (5 - 1) * 10
      expect(result.current.endIndex).toBe(47); // Capped at totalItems, not 50
    });

    it('should calculate indices for different pages correctly', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          itemsPerPage: 15,
        })
      );

      // Page 1: 0-15
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(15);

      // Page 2: 15-30
      act(() => {
        result.current.nextPage();
      });
      expect(result.current.startIndex).toBe(15);
      expect(result.current.endIndex).toBe(30);

      // Page 4: 45-60
      act(() => {
        result.current.goToPage(4);
      });
      expect(result.current.startIndex).toBe(45);
      expect(result.current.endIndex).toBe(60);

      // Last page (7): 90-100
      act(() => {
        result.current.lastPage();
      });
      expect(result.current.startIndex).toBe(90);
      expect(result.current.endIndex).toBe(100);
    });
  });

  describe('Navigation - Next Page', () => {
    it('should navigate to next page', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          itemsPerPage: 20,
        })
      );

      expect(result.current.currentPage).toBe(1);

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.currentPage).toBe(2);

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.currentPage).toBe(3);
    });

    it('should not navigate beyond last page with nextPage', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 30,
          itemsPerPage: 10, // 3 pages total
        })
      );

      // Navigate to last page
      act(() => {
        result.current.goToPage(3);
      });

      expect(result.current.currentPage).toBe(3);
      expect(result.current.hasNextPage).toBe(false);

      // Try to go beyond last page
      act(() => {
        result.current.nextPage();
      });

      expect(result.current.currentPage).toBe(3); // Should stay at 3
      expect(result.current.hasNextPage).toBe(false);
    });
  });

  describe('Navigation - Previous Page', () => {
    it('should navigate to previous page', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          itemsPerPage: 20,
          initialPage: 3,
        })
      );

      expect(result.current.currentPage).toBe(3);

      act(() => {
        result.current.previousPage();
      });

      expect(result.current.currentPage).toBe(2);

      act(() => {
        result.current.previousPage();
      });

      expect(result.current.currentPage).toBe(1);
    });

    it('should not navigate before first page with previousPage', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          itemsPerPage: 20,
        })
      );

      expect(result.current.currentPage).toBe(1);
      expect(result.current.hasPreviousPage).toBe(false);

      act(() => {
        result.current.previousPage();
      });

      expect(result.current.currentPage).toBe(1); // Should stay at 1
      expect(result.current.hasPreviousPage).toBe(false);
    });
  });

  describe('Navigation - First and Last Page', () => {
    it('should navigate to first page', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          itemsPerPage: 20,
          initialPage: 5,
        })
      );

      expect(result.current.currentPage).toBe(5);

      act(() => {
        result.current.firstPage();
      });

      expect(result.current.currentPage).toBe(1);
    });

    it('should navigate to last page', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          itemsPerPage: 10, // 10 pages
        })
      );

      expect(result.current.currentPage).toBe(1);

      act(() => {
        result.current.lastPage();
      });

      expect(result.current.currentPage).toBe(10);
      expect(result.current.hasNextPage).toBe(false);
    });
  });

  describe('Navigation - Go To Page', () => {
    it('should navigate to specific page with goToPage', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          itemsPerPage: 10,
        })
      );

      act(() => {
        result.current.goToPage(7);
      });

      expect(result.current.currentPage).toBe(7);

      act(() => {
        result.current.goToPage(3);
      });

      expect(result.current.currentPage).toBe(3);
    });

    it('should validate page bounds with goToPage', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 50,
          itemsPerPage: 10, // 5 total pages
        })
      );

      const initialPage = result.current.currentPage;

      // Try invalid page numbers
      act(() => {
        result.current.goToPage(0); // Invalid: below minimum
      });
      expect(result.current.currentPage).toBe(initialPage); // No change

      act(() => {
        result.current.goToPage(-1); // Invalid: negative
      });
      expect(result.current.currentPage).toBe(initialPage); // No change

      act(() => {
        result.current.goToPage(6); // Invalid: beyond last page
      });
      expect(result.current.currentPage).toBe(initialPage); // No change

      act(() => {
        result.current.goToPage(100); // Invalid: way beyond last page
      });
      expect(result.current.currentPage).toBe(initialPage); // No change

      // Valid page should work
      act(() => {
        result.current.goToPage(3);
      });
      expect(result.current.currentPage).toBe(3); // Changed successfully
    });
  });

  describe('Page Validation', () => {
    it('should return correct canGoToPage validation', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 50,
          itemsPerPage: 10, // 5 total pages
        })
      );

      // Valid pages
      expect(result.current.canGoToPage(1)).toBe(true);
      expect(result.current.canGoToPage(3)).toBe(true);
      expect(result.current.canGoToPage(5)).toBe(true);

      // Invalid pages
      expect(result.current.canGoToPage(0)).toBe(false);
      expect(result.current.canGoToPage(-1)).toBe(false);
      expect(result.current.canGoToPage(6)).toBe(false);
      expect(result.current.canGoToPage(100)).toBe(false);
    });
  });

  describe('Page Availability Flags', () => {
    it('should update hasNextPage and hasPreviousPage correctly', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 30,
          itemsPerPage: 10, // 3 total pages
        })
      );

      // Page 1: has next, no previous
      expect(result.current.currentPage).toBe(1);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.hasPreviousPage).toBe(false);

      // Navigate to page 2: has both
      act(() => {
        result.current.nextPage();
      });
      expect(result.current.currentPage).toBe(2);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.hasPreviousPage).toBe(true);

      // Navigate to page 3: no next, has previous
      act(() => {
        result.current.nextPage();
      });
      expect(result.current.currentPage).toBe(3);
      expect(result.current.hasNextPage).toBe(false);
      expect(result.current.hasPreviousPage).toBe(true);
    });
  });

  describe('Page Numbers Array', () => {
    it('should generate pageNumbers array for small total pages', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 50,
          itemsPerPage: 10, // 5 total pages
        })
      );

      // Should show all pages when total <= 7
      expect(result.current.pageNumbers).toEqual([1, 2, 3, 4, 5]);
    });

    it('should generate pageNumbers array with ellipsis for large total pages', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          itemsPerPage: 10, // 10 total pages
          initialPage: 5,
        })
      );

      // Should include first, last, current, and surrounding pages with ellipsis (-1)
      const pageNumbers = result.current.pageNumbers;
      expect(pageNumbers).toContain(1); // First page
      expect(pageNumbers).toContain(10); // Last page
      expect(pageNumbers).toContain(5); // Current page
      expect(pageNumbers).toContain(-1); // Ellipsis marker

      // Verify ellipsis positions
      expect(pageNumbers[0]).toBe(1); // Starts with first page
      expect(pageNumbers[pageNumbers.length - 1]).toBe(10); // Ends with last page
    });

    it('should generate pageNumbers for current page near start', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 200,
          itemsPerPage: 10, // 20 total pages
          initialPage: 2,
        })
      );

      const pageNumbers = result.current.pageNumbers;
      expect(pageNumbers).toContain(1);
      expect(pageNumbers).toContain(2);
      expect(pageNumbers).toContain(3);
      expect(pageNumbers).toContain(20); // Last page
      expect(pageNumbers).toContain(-1); // Ellipsis before last page
    });

    it('should generate pageNumbers for current page near end', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 200,
          itemsPerPage: 10, // 20 total pages
          initialPage: 19,
        })
      );

      const pageNumbers = result.current.pageNumbers;
      expect(pageNumbers).toContain(1); // First page
      expect(pageNumbers).toContain(-1); // Ellipsis after first page
      expect(pageNumbers).toContain(18);
      expect(pageNumbers).toContain(19);
      expect(pageNumbers).toContain(20);
    });

    it('should update pageNumbers when navigating', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 150,
          itemsPerPage: 10, // 15 total pages
          initialPage: 1,
        })
      );

      const initialPageNumbers = result.current.pageNumbers;
      expect(initialPageNumbers[0]).toBe(1);

      // Navigate to middle page
      act(() => {
        result.current.goToPage(8);
      });

      const middlePageNumbers = result.current.pageNumbers;
      expect(middlePageNumbers).toContain(8); // Current page
      expect(middlePageNumbers).toContain(7); // Surrounding pages
      expect(middlePageNumbers).toContain(9);
    });
  });

  describe('Dynamic Total Items Updates', () => {
    it('should recalculate when totalItems changes dynamically', () => {
      const { result, rerender } = renderHook(
        ({ totalItems }) => usePagination({ totalItems, itemsPerPage: 10 }),
        { initialProps: { totalItems: 100 } }
      );

      // Initial state: 100 items = 10 pages
      expect(result.current.totalPages).toBe(10);
      expect(result.current.totalItems).toBe(100);

      // Navigate to page 5
      act(() => {
        result.current.goToPage(5);
      });
      expect(result.current.currentPage).toBe(5);

      // Update totalItems to 30 (now only 3 pages)
      rerender({ totalItems: 30 });

      expect(result.current.totalPages).toBe(3);
      expect(result.current.totalItems).toBe(30);
      // Current page stays at 5 (hook doesn't auto-adjust, component should handle)
      expect(result.current.currentPage).toBe(5);
      // But page 5 is now invalid
      expect(result.current.canGoToPage(5)).toBe(false);
    });

    it('should handle increase in totalItems', () => {
      const { result, rerender } = renderHook(
        ({ totalItems }) => usePagination({ totalItems, itemsPerPage: 10 }),
        { initialProps: { totalItems: 30 } }
      );

      expect(result.current.totalPages).toBe(3);

      // Increase totalItems
      rerender({ totalItems: 100 });

      expect(result.current.totalPages).toBe(10);
      expect(result.current.totalItems).toBe(100);
    });
  });

  describe('Different Items Per Page Values', () => {
    it('should work with itemsPerPage: 5', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 50,
          itemsPerPage: 5,
        })
      );

      expect(result.current.totalPages).toBe(10); // 50 / 5
      expect(result.current.itemsPerPage).toBe(5);
      expect(result.current.endIndex).toBe(5); // Page 1: 0-5
    });

    it('should work with itemsPerPage: 10', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          itemsPerPage: 10,
        })
      );

      expect(result.current.totalPages).toBe(10); // 100 / 10
      expect(result.current.itemsPerPage).toBe(10);
    });

    it('should work with itemsPerPage: 20', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          itemsPerPage: 20,
        })
      );

      expect(result.current.totalPages).toBe(5); // 100 / 20
      expect(result.current.itemsPerPage).toBe(20);
    });

    it('should work with itemsPerPage: 50', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 200,
          itemsPerPage: 50,
        })
      );

      expect(result.current.totalPages).toBe(4); // 200 / 50
      expect(result.current.itemsPerPage).toBe(50);
    });

    it('should work with itemsPerPage: 100', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 250,
          itemsPerPage: 100,
        })
      );

      expect(result.current.totalPages).toBe(3); // 250 / 100 = 2.5, ceil = 3
      expect(result.current.itemsPerPage).toBe(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single item', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 1,
          itemsPerPage: 10,
        })
      );

      expect(result.current.totalPages).toBe(1);
      expect(result.current.currentPage).toBe(1);
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(1);
      expect(result.current.hasNextPage).toBe(false);
      expect(result.current.hasPreviousPage).toBe(false);
    });

    it('should handle exact multiple of itemsPerPage', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          itemsPerPage: 20,
        })
      );

      expect(result.current.totalPages).toBe(5); // Exactly 100 / 20

      // Navigate to last page
      act(() => {
        result.current.lastPage();
      });

      expect(result.current.startIndex).toBe(80); // (5 - 1) * 20
      expect(result.current.endIndex).toBe(100); // Exactly at total
    });

    it('should handle very large totalItems', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 10000,
          itemsPerPage: 20,
        })
      );

      expect(result.current.totalPages).toBe(500);

      act(() => {
        result.current.goToPage(250);
      });

      expect(result.current.currentPage).toBe(250);
      expect(result.current.startIndex).toBe(4980); // (250 - 1) * 20
      expect(result.current.endIndex).toBe(5000);
    });

    it('should handle itemsPerPage larger than totalItems', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 5,
          itemsPerPage: 50,
        })
      );

      expect(result.current.totalPages).toBe(1);
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(5); // Capped at totalItems
    });
  });

  describe('Integration - Typical Usage Patterns', () => {
    it('should support client-side array slicing pattern', () => {
      // Simulates slicing an array of items for display
      const allItems = Array.from({ length: 47 }, (_, i) => `item-${i + 1}`);

      const { result } = renderHook(() =>
        usePagination({
          totalItems: allItems.length,
          itemsPerPage: 10,
        })
      );

      // Page 1
      let visibleItems = allItems.slice(
        result.current.startIndex,
        result.current.endIndex
      );
      expect(visibleItems.length).toBe(10);
      expect(visibleItems[0]).toBe('item-1');
      expect(visibleItems[9]).toBe('item-10');

      // Navigate to page 3
      act(() => {
        result.current.goToPage(3);
      });

      visibleItems = allItems.slice(
        result.current.startIndex,
        result.current.endIndex
      );
      expect(visibleItems.length).toBe(10);
      expect(visibleItems[0]).toBe('item-21');
      expect(visibleItems[9]).toBe('item-30');

      // Last page (partial)
      act(() => {
        result.current.lastPage();
      });

      visibleItems = allItems.slice(
        result.current.startIndex,
        result.current.endIndex
      );
      expect(visibleItems.length).toBe(7); // Only 7 items on last page
      expect(visibleItems[0]).toBe('item-41');
      expect(visibleItems[6]).toBe('item-47');
    });

    it('should support pagination controls rendering pattern', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 200,
          itemsPerPage: 10,
          initialPage: 10,
        })
      );

      // Verify all pagination UI data is available
      expect(result.current.currentPage).toBe(10);
      expect(result.current.totalPages).toBe(20);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.hasPreviousPage).toBe(true);
      expect(result.current.pageNumbers).toBeDefined();
      expect(Array.isArray(result.current.pageNumbers)).toBe(true);

      // Verify navigation functions are callable
      expect(typeof result.current.nextPage).toBe('function');
      expect(typeof result.current.previousPage).toBe('function');
      expect(typeof result.current.firstPage).toBe('function');
      expect(typeof result.current.lastPage).toBe('function');
      expect(typeof result.current.goToPage).toBe('function');
      expect(typeof result.current.canGoToPage).toBe('function');
    });
  });
});
