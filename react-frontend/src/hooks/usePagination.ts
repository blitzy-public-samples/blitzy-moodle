import { useState, useMemo, useCallback } from 'react';

/**
 * Options for configuring the usePagination hook
 */
export interface PaginationOptions {
  /**
   * Initial page number (1-indexed). Defaults to 1.
   */
  initialPage?: number;
  /**
   * Number of items to display per page. Defaults to 20.
   */
  itemsPerPage?: number;
  /**
   * Total number of items across all pages
   */
  totalItems: number;
}

/**
 * Core pagination state
 */
export interface PaginationState {
  /**
   * Current active page number (1-indexed)
   */
  currentPage: number;
  /**
   * Total number of pages
   */
  totalPages: number;
  /**
   * Number of items per page
   */
  itemsPerPage: number;
  /**
   * Total number of items
   */
  totalItems: number;
}

/**
 * Complete return type of usePagination hook with state and navigation functions
 */
export interface UsePaginationReturn extends PaginationState {
  /**
   * Navigate to a specific page number
   */
  goToPage: (page: number) => void;
  /**
   * Navigate to the next page
   */
  nextPage: () => void;
  /**
   * Navigate to the previous page
   */
  previousPage: () => void;
  /**
   * Navigate to the first page
   */
  firstPage: () => void;
  /**
   * Navigate to the last page
   */
  lastPage: () => void;
  /**
   * Whether there is a next page available
   */
  hasNextPage: boolean;
  /**
   * Whether there is a previous page available
   */
  hasPreviousPage: boolean;
  /**
   * Start index for array slicing (0-indexed)
   */
  startIndex: number;
  /**
   * End index for array slicing (exclusive, 0-indexed)
   */
  endIndex: number;
  /**
   * Array of page numbers for pagination UI (includes ellipsis logic)
   */
  pageNumbers: number[];
  /**
   * Check if a specific page number is valid
   */
  canGoToPage: (page: number) => boolean;
}

/**
 * Custom hook for managing pagination state and logic
 *
 * Provides comprehensive pagination functionality including:
 * - Current page tracking
 * - Navigation functions (next, previous, first, last, goToPage)
 * - Array slice indices for client-side pagination
 * - Page number generation for UI
 * - Validation for page bounds
 *
 * Supports both client-side pagination (using startIndex/endIndex for array slicing)
 * and server-side pagination (using currentPage for API calls).
 *
 * @param options - Configuration options for pagination
 * @returns Pagination state and navigation functions
 *
 * @example
 * // Client-side pagination example
 * const allItems = [...]; // Full array of items
 * const {
 *   currentPage,
 *   startIndex,
 *   endIndex,
 *   nextPage,
 *   previousPage,
 *   pageNumbers
 * } = usePagination({
 *   totalItems: allItems.length,
 *   itemsPerPage: 20
 * });
 * const visibleItems = allItems.slice(startIndex, endIndex);
 *
 * @example
 * // Server-side pagination example
 * const { data } = useQuery(['courses', currentPage], () =>
 *   fetchCourses(currentPage, itemsPerPage)
 * );
 * const {
 *   currentPage,
 *   totalPages,
 *   nextPage,
 *   previousPage,
 *   hasNextPage,
 *   hasPreviousPage
 * } = usePagination({
 *   totalItems: data.total,
 *   itemsPerPage: 20
 * });
 */
export default function usePagination(options: PaginationOptions): UsePaginationReturn {
  const { initialPage = 1, itemsPerPage = 20, totalItems } = options;

  // Current page state (1-indexed)
  const [currentPage, setCurrentPage] = useState<number>(initialPage);

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(totalItems / itemsPerPage) || 1;
  }, [totalItems, itemsPerPage]);

  // Check if next/previous pages exist
  const hasNextPage = useMemo(() => {
    return currentPage < totalPages;
  }, [currentPage, totalPages]);

  const hasPreviousPage = useMemo(() => {
    return currentPage > 1;
  }, [currentPage]);

  // Calculate array slice indices for client-side pagination
  const startIndex = useMemo(() => {
    return (currentPage - 1) * itemsPerPage;
  }, [currentPage, itemsPerPage]);

  const endIndex = useMemo(() => {
    return Math.min(startIndex + itemsPerPage, totalItems);
  }, [startIndex, itemsPerPage, totalItems]);

  /**
   * Validate if a page number is within valid bounds
   */
  const canGoToPage = useCallback(
    (page: number): boolean => {
      return page >= 1 && page <= totalPages;
    },
    [totalPages]
  );

  /**
   * Navigate to a specific page number with validation
   */
  const goToPage = useCallback(
    (page: number): void => {
      if (canGoToPage(page)) {
        setCurrentPage(page);
      }
    },
    [canGoToPage]
  );

  /**
   * Navigate to the next page
   */
  const nextPage = useCallback((): void => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  /**
   * Navigate to the previous page
   */
  const previousPage = useCallback((): void => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  /**
   * Navigate to the first page
   */
  const firstPage = useCallback((): void => {
    goToPage(1);
  }, [goToPage]);

  /**
   * Navigate to the last page
   */
  const lastPage = useCallback((): void => {
    goToPage(totalPages);
  }, [goToPage, totalPages]);

  /**
   * Generate array of page numbers for pagination UI with ellipsis logic
   * Shows first page, last page, current page, and surrounding pages
   * Uses -1 to represent ellipsis (...) for gaps
   *
   * Examples:
   * - Total 5 pages, current 3: [1, 2, 3, 4, 5]
   * - Total 10 pages, current 5: [1, -1, 4, 5, 6, -1, 10]
   * - Total 20 pages, current 15: [1, -1, 14, 15, 16, -1, 20]
   */
  const pageNumbers = useMemo((): number[] => {
    const pages: number[] = [];
    const maxVisiblePages = 7; // Max pages to show including ellipsis

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate range around current page
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);

      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pages.push(-1); // -1 represents ellipsis
      }

      // Add pages around current page
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pages.push(-1); // -1 represents ellipsis
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  }, [currentPage, totalPages]);

  return {
    currentPage,
    totalPages,
    itemsPerPage,
    totalItems,
    goToPage,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    hasNextPage,
    hasPreviousPage,
    startIndex,
    endIndex,
    pageNumbers,
    canGoToPage,
  };
}
