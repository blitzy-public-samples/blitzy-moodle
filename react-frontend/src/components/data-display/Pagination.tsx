import type React from 'react';
import { useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import {
  Pagination as MuiPagination,
  TablePagination as MuiTablePagination,
  Box,
} from '@mui/material';

/**
 * Props for the Pagination component
 * Supports both simple pagination (page numbers) and table pagination (with rows per page)
 */
export interface PaginationProps {
  /**
   * Variant of pagination to display
   * - 'simple': Shows only page numbers with navigation buttons
   * - 'table': Shows rows per page selector and page info display
   */
  variant?: 'simple' | 'table';

  /**
   * Total number of items to paginate
   */
  count: number;

  /**
   * Current page number (1-indexed for simple, 0-indexed for table)
   */
  page: number;

  /**
   * Number of rows per page (only for table variant)
   */
  rowsPerPage?: number;

  /**
   * Available options for rows per page (only for table variant)
   * @default [10, 25, 50, 100]
   */
  rowsPerPageOptions?: number[];

  /**
   * Callback fired when the page changes
   * For simple variant: page is 1-indexed
   * For table variant: page is 0-indexed
   */
  onPageChange: (page: number) => void;

  /**
   * Callback fired when rows per page changes (only for table variant)
   */
  onRowsPerPageChange?: (rowsPerPage: number) => void;

  /**
   * Size of the pagination component
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Show button to jump to first page
   * @default true
   */
  showFirstButton?: boolean;

  /**
   * Show button to jump to last page
   * @default true
   */
  showLastButton?: boolean;

  /**
   * Label for rows per page selector (only for table variant)
   * @default 'Rows per page:'
   */
  labelRowsPerPage?: string;

  /**
   * Function to customize the displayed rows label (only for table variant)
   * @default ({ from, to, count }) => `${from}-${to} of ${count}`
   */
  labelDisplayedRows?: (paginationInfo: { from: number; to: number; count: number }) => string;

  /**
   * If true, the component is disabled
   * @default false
   */
  disabled?: boolean;

  /**
   * Additional CSS class name
   */
  className?: string;
}

/**
 * Pagination component for consistent page navigation across the application.
 *
 * Supports two variants:
 * - Simple: Page numbers with first/last/previous/next buttons
 * - Table: Rows per page selector with page info display
 *
 * Features:
 * - Full keyboard navigation support (Tab, Arrow keys, Enter, Space)
 * - WCAG 2.1 AA compliant with proper ARIA labels
 * - Theme-aware (works with light and dark modes)
 * - Customizable page sizes and options
 * - Responsive design for mobile and desktop
 *
 * Used across:
 * - Course catalogs and listings
 * - User management tables
 * - Assignment submissions
 * - Grade tables and reports
 * - Search results
 * - Forum discussions
 *
 * @example
 * // Simple pagination for course catalog
 * <Pagination
 *   variant="simple"
 *   count={100}
 *   page={currentPage}
 *   onPageChange={handlePageChange}
 *   showFirstButton={true}
 *   showLastButton={true}
 * />
 *
 * @example
 * // Table pagination for user list with rows per page
 * <Pagination
 *   variant="table"
 *   count={250}
 *   page={currentPage}
 *   rowsPerPage={rowsPerPage}
 *   rowsPerPageOptions={[10, 25, 50, 100]}
 *   onPageChange={handlePageChange}
 *   onRowsPerPageChange={handleRowsPerPageChange}
 *   labelRowsPerPage="Items per page:"
 * />
 */
function Pagination({
  variant = 'simple',
  count,
  page,
  rowsPerPage = 10,
  rowsPerPageOptions = [10, 25, 50, 100],
  onPageChange,
  onRowsPerPageChange,
  size = 'medium',
  showFirstButton = true,
  showLastButton = true,
  labelRowsPerPage = 'Rows per page:',
  labelDisplayedRows,
  disabled = false,
  className,
}: PaginationProps) {
  // Calculate total pages for simple variant
  const totalPages = useMemo(() => {
    if (variant === 'simple') {
      return Math.ceil(count / (rowsPerPage || 10));
    }
    return 0;
  }, [variant, count, rowsPerPage]);

  // Handle page change for simple pagination (MUI Pagination uses 1-indexed pages)
  const handleSimplePageChange = useCallback(
    (_event: ChangeEvent<unknown>, value: number | { page: number; selected: number }) => {
      if (!disabled) {
        // MUI Pagination may pass either a number or an object with page property
        const pageNumber = typeof value === 'number' ? value : value.page;
        onPageChange(pageNumber);
      }
    },
    [disabled, onPageChange]
  );

  // Handle page change for table pagination (TablePagination uses 0-indexed pages)
  const handleTablePageChange = useCallback(
    (_event: React.MouseEvent<HTMLButtonElement> | null, newPage: number) => {
      if (!disabled) {
        onPageChange(newPage);
      }
    },
    [disabled, onPageChange]
  );

  // Handle rows per page change for table pagination
  const handleRowsPerPageChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!disabled && onRowsPerPageChange) {
        const newRowsPerPage = parseInt(event.target.value, 10);
        onRowsPerPageChange(newRowsPerPage);
      }
    },
    [disabled, onRowsPerPageChange]
  );

  // Default label function for displayed rows
  const defaultLabelDisplayedRows = useCallback(
    ({ from, to, count: totalCount }: { from: number; to: number; count: number }) => {
      return `${from}-${to} of ${totalCount !== -1 ? totalCount : `more than ${to}`}`;
    },
    []
  );

  // Render simple pagination variant
  if (variant === 'simple') {
    return (
      <Box
        className={className}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 2,
        }}
      >
        <MuiPagination
          count={totalPages}
          page={page}
          onChange={handleSimplePageChange}
          size={size}
          showFirstButton={showFirstButton}
          showLastButton={showLastButton}
          disabled={disabled}
          color="primary"
          shape="rounded"
          siblingCount={1}
          boundaryCount={1}
          // Accessibility attributes
          aria-label="Pagination navigation"
          // MUI Pagination automatically provides proper ARIA labels for each button
          // including "Go to first page", "Go to previous page", "Go to page X",
          // "Go to next page", "Go to last page"
        />
      </Box>
    );
  }

  // Render table pagination variant
  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <MuiTablePagination
        component="div"
        count={count}
        page={page}
        onPageChange={handleTablePageChange}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={rowsPerPageOptions}
        onRowsPerPageChange={handleRowsPerPageChange}
        labelRowsPerPage={labelRowsPerPage}
        labelDisplayedRows={labelDisplayedRows ?? defaultLabelDisplayedRows}
        disabled={disabled}
        showFirstButton={showFirstButton}
        showLastButton={showLastButton}
        // Accessibility attributes
        // MUI TablePagination automatically provides proper ARIA labels
        // for the select dropdown and navigation buttons
        slotProps={{
          select: {
            // Ensure select is properly labeled for screen readers
            'aria-label': labelRowsPerPage,
            inputProps: {
              'aria-label': labelRowsPerPage,
            },
          },
        }}
        sx={{
          // Ensure proper spacing and alignment
          '.MuiTablePagination-toolbar': {
            minHeight: size === 'small' ? 48 : 56,
            paddingLeft: 2,
            paddingRight: 2,
          },
          '.MuiTablePagination-selectLabel': {
            marginBottom: 0,
          },
          '.MuiTablePagination-displayedRows': {
            marginBottom: 0,
          },
        }}
      />
    </Box>
  );
}

export default Pagination;
