/**
 * DataTable Component
 *
 * Sortable, filterable data table component extending MUI DataGrid with pagination,
 * row selection, and bulk actions. Primary component for displaying grades, users,
 * course lists, assignment submissions, and admin data throughout Moodle.
 *
 * Features:
 * - MUI DataGrid integration with Material Design theming
 * - Client-side and server-side data operations (sort/filter/paginate)
 * - Row selection with checkboxes and bulk action toolbar
 * - Customizable column definitions with cell renderers
 * - Row actions menu with edit/delete/view operations
 * - Dense and comfortable row height modes
 * - Column visibility toggles, resizing, and reordering
 * - Keyboard navigation (tab/arrow keys) for accessibility
 * - Screen reader announcements for WCAG 2.1 AA compliance
 * - Loading states with spinner overlay
 * - Empty states with helpful messages
 * - Error handling with retry actions
 * - CSV/Excel export functionality
 * - Light and dark mode support via MUI theme
 *
 * Usage:
 * ```tsx
 * <DataTable
 *   columns={[
 *     { field: 'name', headerName: 'Name', sortable: true, filterable: true },
 *     { field: 'email', headerName: 'Email', width: 250 }
 *   ]}
 *   rows={users}
 *   loading={isLoading}
 *   selectable
 *   onSelectionChange={handleSelection}
 *   bulkActions={[
 *     { label: 'Delete Selected', onClick: handleBulkDelete, icon: <DeleteIcon /> }
 *   ]}
 * />
 * ```
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { useState, useCallback, useMemo, useEffect, type FC, type ReactNode, type MouseEvent } from 'react';
import {
  DataGrid,
  type GridColDef,
  type GridRowSelectionModel,
  type GridSortModel,
  type GridFilterModel,
  type GridPaginationModel,
  type GridCallbackDetails,
  type GridRenderCellParams,
  type GridValidRowModel,
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarExport,
} from '@mui/x-data-grid';
import {
  Box,
  Toolbar,
  IconButton,
  Tooltip,
  Typography,
  Button,
  Menu,
  MenuItem,
} from '@mui/material';
import { MoreVert } from '@mui/icons-material';
import { LoadingSpinner } from '../feedback/LoadingSpinner';
import { Alert } from '../feedback/Alert';
import type { SortParams } from '../../types/common';

/**
 * Row action definition for context menu
 */
export interface RowAction<T extends GridValidRowModel = GridValidRowModel> {
  /**
   * Action label displayed in menu
   */
  label: string;

  /**
   * Action icon (optional)
   */
  icon?: ReactNode;

  /**
   * Click handler receiving the row data
   */
  onClick: (row: T) => void;

  /**
   * Whether action is disabled
   * Can be a boolean or function based on row data
   */
  disabled?: boolean | ((row: T) => boolean);

  /**
   * Whether action is visible
   * Can be a boolean or function based on row data
   */
  visible?: boolean | ((row: T) => boolean);

  /**
   * Color variant for action (e.g., 'error' for delete)
   */
  color?: 'inherit' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
}

/**
 * Bulk action definition for selected rows
 */
export interface BulkAction<T extends GridValidRowModel = GridValidRowModel> {
  /**
   * Action label displayed in toolbar
   */
  label: string;

  /**
   * Action icon (optional)
   */
  icon?: ReactNode;

  /**
   * Click handler receiving array of selected rows
   */
  onClick: (selectedRows: T[]) => void;

  /**
   * Whether action is disabled based on selection
   */
  disabled?: (selectedRows: T[]) => boolean;

  /**
   * Color variant for action
   */
  color?: 'inherit' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
}

/**
 * Data mode for table operations
 * - 'client': All data loaded, operations performed in browser
 * - 'server': Data fetched on demand, operations trigger API calls
 */
export type DataMode = 'client' | 'server';

/**
 * Column definition extending MUI GridColDef
 */
export interface DataTableColumn<T extends GridValidRowModel = GridValidRowModel> extends Omit<GridColDef, 'field' | 'renderCell' | 'valueGetter' | 'valueFormatter'> {
  /**
   * Column field name (must be a key of row data type)
   */
  field: keyof T | string;

  /**
   * Column header text
   */
  headerName: string;

  /**
   * Column width in pixels
   * @default 150
   */
  width?: number;

  /**
   * Whether column is sortable
   * @default true
   */
  sortable?: boolean;

  /**
   * Whether column is filterable
   * @default true
   */
  filterable?: boolean;

  /**
   * Custom cell renderer - uses MUI's GridRenderCellParams for full compatibility
   */
  renderCell?: (params: GridRenderCellParams<T>) => ReactNode;

  /**
   * Value getter for computed values - uses MUI's params structure
   */
  valueGetter?: (params: GridRenderCellParams<T>) => unknown;

  /**
   * Value formatter for display
   */
  valueFormatter?: (params: { value: unknown }) => string;
}

/**
 * Props interface for DataTable component
 */
export interface DataTableProps<T extends GridValidRowModel = GridValidRowModel> {
  /**
   * Array of column definitions
   */
  columns: DataTableColumn<T>[];

  /**
   * Array of row data objects
   * Each object must have an 'id' field
   */
  rows: T[];

  /**
   * Data operation mode
   * @default 'client'
   */
  mode?: DataMode;

  /**
   * Whether table is in loading state
   * @default false
   */
  loading?: boolean;

  /**
   * Error message to display
   */
  error?: string | null;

  /**
   * Callback when error needs to be retried
   */
  onRetry?: () => void;

  /**
   * Whether rows are selectable with checkboxes
   * @default false
   */
  selectable?: boolean;

  /**
   * Currently selected row IDs
   */
  selectedRows?: GridRowSelectionModel;

  /**
   * Callback when row selection changes
   */
  onSelectionChange?: (selectedRowIds: GridRowSelectionModel, selectedRowData: T[]) => void;

  /**
   * Bulk actions available for selected rows
   */
  bulkActions?: BulkAction<T>[];

  /**
   * Row actions displayed in context menu
   */
  rowActions?: RowAction<T>[];

  /**
   * Current sort configuration
   */
  sortModel?: SortParams<T>;

  /**
   * Callback when sort changes
   */
  onSortChange?: (sort: SortParams<T> | null) => void;

  /**
   * Current filter configuration
   */
  filterModel?: GridFilterModel;

  /**
   * Callback when filter changes
   */
  onFilterChange?: (filter: GridFilterModel) => void;

  /**
   * Current page number (0-indexed)
   * @default 0
   */
  page?: number;

  /**
   * Number of rows per page
   * @default 10
   */
  pageSize?: number;

  /**
   * Total number of rows (for server-side pagination)
   */
  totalRows?: number;

  /**
   * Callback when page changes
   */
  onPageChange?: (page: number) => void;

  /**
   * Callback when page size changes
   */
  onPageSizeChange?: (pageSize: number) => void;

  /**
   * Available page size options
   * @default [10, 25, 50, 100]
   */
  pageSizeOptions?: number[];

  /**
   * Whether to show pagination controls
   * @default true
   */
  pagination?: boolean;

  /**
   * Whether to show column toolbar
   * @default true
   */
  toolbar?: boolean;

  /**
   * Whether to enable CSV export
   * @default true
   */
  exportable?: boolean;

  /**
   * Initial row density
   * @default 'standard'
   */
  density?: 'compact' | 'standard' | 'comfortable';

  /**
   * Height of the table in pixels
   * @default 'auto' (adjusts to content with max-height)
   */
  height?: number | 'auto';

  /**
   * Message displayed when no rows
   * @default 'No data to display'
   */
  emptyMessage?: string;

  /**
   * Whether to auto-fit columns to container width
   * @default false
   */
  autoHeight?: boolean;

  /**
   * Whether to hide footer
   * @default false
   */
  hideFooter?: boolean;

  /**
   * Whether to hide footer pagination
   * @default false
   */
  hideFooterPagination?: boolean;

  /**
   * Whether to hide footer selected row count
   * @default false
   */
  hideFooterSelectedRowCount?: boolean;

  /**
   * Custom class name for styling
   */
  className?: string;

  /**
   * ARIA label for accessibility
   */
  ariaLabel?: string;
}

/**
 * Custom toolbar component with bulk actions
 */
interface CustomToolbarProps<T extends GridValidRowModel> {
  selectedRows: GridRowSelectionModel;
  selectedRowData: T[];
  bulkActions?: BulkAction<T>[];
  exportable?: boolean;
}

function CustomToolbar<T extends GridValidRowModel>({ selectedRows, selectedRowData, bulkActions, exportable }: CustomToolbarProps<T>) {
  const selectedCount = selectedRows.length;

  return (
    <GridToolbarContainer>
      {selectedCount > 0 && bulkActions && bulkActions.length > 0 ? (
        <Toolbar
          sx={{
            pl: { sm: 2 },
            pr: { xs: 1, sm: 1 },
            bgcolor: (theme) => theme.palette.action.selected,
            width: '100%',
          }}
        >
          <Typography
            sx={{ flex: '1 1 100%' }}
            color="inherit"
            variant="subtitle1"
            component="div"
            role="status"
            aria-live="polite"
          >
            {selectedCount} {selectedCount === 1 ? 'row' : 'rows'} selected
          </Typography>
          {bulkActions.map((action) => {
            const isDisabled = action.disabled ? action.disabled(selectedRowData) : false;
            return (
              <Tooltip key={action.label} title={action.label}>
                <span>
                  <Button
                    size="small"
                    startIcon={action.icon}
                    onClick={() => action.onClick(selectedRowData)}
                    disabled={isDisabled}
                    color={action.color ?? 'primary'}
                    aria-label={action.label}
                  >
                    {action.label}
                  </Button>
                </span>
              </Tooltip>
            );
          })}
        </Toolbar>
      ) : (
        <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
          <GridToolbarColumnsButton />
          <GridToolbarFilterButton />
          <GridToolbarDensitySelector />
          {exportable && <GridToolbarExport />}
        </Box>
      )}
    </GridToolbarContainer>
  );
}

/**
 * Row actions menu component
 */
interface RowActionsMenuProps<T extends GridValidRowModel> {
  row: T;
  actions: RowAction<T>[];
}

function RowActionsMenu<T extends GridValidRowModel>({ row, actions }: RowActionsMenuProps<T>) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleActionClick = useCallback(
    (action: RowAction<T>) => {
      action.onClick(row);
      handleClose();
    },
    [row, handleClose]
  );

  // Filter visible actions
  const visibleActions = useMemo(() => {
    return actions.filter((action) => {
      if (action.visible === undefined) {
        return true;
      }
      return typeof action.visible === 'function' ? action.visible(row) : action.visible;
    });
  }, [actions, row]);

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <>
      <Tooltip title="Actions">
        <IconButton
          size="small"
          onClick={handleClick}
          aria-label="row actions"
          aria-controls={open ? 'row-actions-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
        >
          <MoreVert />
        </IconButton>
      </Tooltip>
      <Menu
        id="row-actions-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'row-actions-button',
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {visibleActions.map((action) => {
          const isDisabled =
            action.disabled !== undefined
              ? typeof action.disabled === 'function'
                ? action.disabled(row)
                : action.disabled
              : false;

          return (
            <MenuItem
              key={action.label}
              onClick={() => handleActionClick(action)}
              disabled={isDisabled}
              sx={{ color: action.color ? `${action.color}.main` : 'inherit' }}
            >
              {action.icon && (
                <Box component="span" sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                  {action.icon}
                </Box>
              )}
              {action.label}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

/**
 * Toolbar slot component to avoid inline component definitions
 */
interface ToolbarSlotProps<T extends GridValidRowModel> {
  selectedRows: GridRowSelectionModel;
  selectedRowData: T[];
  bulkActions?: BulkAction<T>[];
  exportable?: boolean;
}

function ToolbarSlot<T extends GridValidRowModel>({ selectedRows, selectedRowData, bulkActions, exportable }: ToolbarSlotProps<T>): JSX.Element {
  return (
    <CustomToolbar<T>
      selectedRows={selectedRows}
      selectedRowData={selectedRowData}
      bulkActions={bulkActions}
      exportable={exportable}
    />
  );
}

/**
 * No rows overlay component to avoid inline component definitions
 */
interface NoRowsOverlayProps {
  emptyMessage: string;
}

function NoRowsOverlay({ emptyMessage }: NoRowsOverlayProps): JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
      }}
    >
      <Typography variant="body1" color="text.secondary" role="status">
        {emptyMessage}
      </Typography>
    </Box>
  );
}

/**
 * Factory function to create a toolbar component with bound props
 */
function createToolbarComponent<T extends GridValidRowModel>(props: ToolbarSlotProps<T>): FC {
  function BoundToolbar(): JSX.Element {
    return <ToolbarSlot<T> {...props} />;
  }
  return BoundToolbar;
}

/**
 * Factory function to create a no rows overlay component with bound props
 */
function createNoRowsComponent(emptyMessage: string): FC {
  function BoundNoRowsOverlay(): JSX.Element {
    return <NoRowsOverlay emptyMessage={emptyMessage} />;
  }
  return BoundNoRowsOverlay;
}

/**
 * DataTable component implementation
 */
export function DataTable<T extends { id: string | number }>({
  columns,
  rows,
  mode = 'client',
  loading = false,
  error = null,
  onRetry,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  bulkActions = [],
  rowActions = [],
  sortModel,
  onSortChange,
  filterModel,
  onFilterChange,
  page = 0,
  pageSize = 10,
  totalRows,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  pagination = true,
  toolbar = true,
  exportable = true,
  density = 'standard',
  height = 'auto',
  emptyMessage = 'No data to display',
  autoHeight = false,
  hideFooter = false,
  hideFooterPagination = false,
  hideFooterSelectedRowCount = false,
  className,
  ariaLabel = 'Data table',
}: DataTableProps<T>): ReturnType<FC> {
  // Internal state for controlled components
  const [internalSortModel, setInternalSortModel] = useState<GridSortModel>([]);
  const [internalFilterModel, setInternalFilterModel] = useState<GridFilterModel>({ items: [] });
  const [internalPaginationModel, setInternalPaginationModel] = useState<GridPaginationModel>({
    page,
    pageSize,
  });
  const [internalSelectedRows, setInternalSelectedRows] = useState<GridRowSelectionModel>(selectedRows);

  // Sync external state changes
  useEffect(() => {
    setInternalSelectedRows(selectedRows);
  }, [selectedRows]);

  useEffect(() => {
    setInternalPaginationModel({ page, pageSize });
  }, [page, pageSize]);

  useEffect(() => {
    if (sortModel) {
      setInternalSortModel([{ field: String(sortModel.field), sort: sortModel.order }]);
    }
  }, [sortModel]);

  useEffect(() => {
    if (filterModel) {
      setInternalFilterModel(filterModel);
    }
  }, [filterModel]);

  // Convert columns to GridColDef format with row actions
  const gridColumns = useMemo<GridColDef[]>(() => {
    const cols: GridColDef[] = columns.map((col) => ({
      ...col,
      field: String(col.field),
      headerName: col.headerName,
      width: col.width ?? 150,
      sortable: col.sortable !== false,
      filterable: col.filterable !== false,
    }));

    // Add actions column if row actions are provided
    if (rowActions && rowActions.length > 0) {
      cols.push({
        field: 'actions',
        headerName: 'Actions',
        width: 80,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => <RowActionsMenu row={params.row as T} actions={rowActions} />,
      });
    }

    return cols;
  }, [columns, rowActions]);

  // Handle sort changes
  const handleSortModelChange = useCallback(
    (model: GridSortModel, _details: GridCallbackDetails) => {
      setInternalSortModel(model);

      if (onSortChange) {
        if (model.length > 0 && model[0]?.sort) {
          const sortItem = model[0];
          onSortChange({
            field: sortItem.field as keyof T,
            order: sortItem.sort as 'asc' | 'desc',
          });
        } else {
          onSortChange(null);
        }
      }
    },
    [onSortChange]
  );

  // Handle filter changes
  const handleFilterModelChange = useCallback(
    (model: GridFilterModel, _details: GridCallbackDetails) => {
      setInternalFilterModel(model);

      if (onFilterChange) {
        onFilterChange(model);
      }
    },
    [onFilterChange]
  );

  // Handle pagination changes
  const handlePaginationModelChange = useCallback(
    (model: GridPaginationModel, _details: GridCallbackDetails) => {
      setInternalPaginationModel(model);

      if (onPageChange && model.page !== internalPaginationModel.page) {
        onPageChange(model.page);
      }

      if (onPageSizeChange && model.pageSize !== internalPaginationModel.pageSize) {
        onPageSizeChange(model.pageSize);
      }
    },
    [onPageChange, onPageSizeChange, internalPaginationModel]
  );

  // Handle selection changes
  const handleSelectionChange = useCallback(
    (newSelection: GridRowSelectionModel, _details: GridCallbackDetails) => {
      setInternalSelectedRows(newSelection);

      if (onSelectionChange) {
        const selectedRowData = rows.filter((row) => newSelection.includes(row.id));
        onSelectionChange(newSelection, selectedRowData);
      }
    },
    [onSelectionChange, rows]
  );

  // Get selected row data for bulk actions
  const selectedRowData = useMemo<T[]>(() => {
    return rows.filter((row) => internalSelectedRows.includes(row.id));
  }, [rows, internalSelectedRows]);

  // Calculate row count for pagination
  const rowCount = mode === 'server' && totalRows !== undefined ? totalRows : rows.length;

  // Create stable slot components using useMemo to avoid recreation on every render
  const ToolbarComponent = useMemo(
    () =>
      toolbar
        ? createToolbarComponent<T>({
            selectedRows: internalSelectedRows,
            selectedRowData,
            bulkActions,
            exportable,
          })
        : undefined,
    [toolbar, internalSelectedRows, selectedRowData, bulkActions, exportable]
  );

  const NoRowsComponent = useMemo(() => createNoRowsComponent(emptyMessage), [emptyMessage]);

  // Render loading state
  if (loading && rows.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
        }}
      >
        <LoadingSpinner size="large" message="Loading data..." />
      </Box>
    );
  }

  // Render error state
  if (error && rows.length === 0) {
    return (
      <Alert
        severity="error"
        title="Failed to load data"
        message={error}
        action={
          onRetry ? (
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <Box
      className={className}
      sx={{
        width: '100%',
        height: height === 'auto' ? '100%' : height,
      }}
    >
      <DataGrid
        rows={rows}
        columns={gridColumns}
        loading={loading}
        checkboxSelection={selectable}
        disableRowSelectionOnClick
        rowSelectionModel={internalSelectedRows}
        onRowSelectionModelChange={handleSelectionChange}
        sortModel={internalSortModel}
        onSortModelChange={handleSortModelChange}
        filterModel={internalFilterModel}
        onFilterModelChange={handleFilterModelChange}
        paginationMode={mode === 'server' ? 'server' : 'client'}
        paginationModel={internalPaginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        pageSizeOptions={pageSizeOptions}
        rowCount={rowCount}
        {...(pagination && { pagination: true })}
        density={density}
        autoHeight={autoHeight}
        hideFooter={hideFooter}
        hideFooterPagination={hideFooterPagination}
        hideFooterSelectedRowCount={hideFooterSelectedRowCount}
        slots={{
          toolbar: ToolbarComponent,
          noRowsOverlay: NoRowsComponent,
        }}
        sx={{
          border: 1,
          borderColor: 'divider',
          '& .MuiDataGrid-cell:focus': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: -1,
          },
          '& .MuiDataGrid-cell:focus-within': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: -1,
          },
          '& .MuiDataGrid-columnHeader:focus': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: -1,
          },
          '& .MuiDataGrid-columnHeader:focus-within': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: -1,
          },
        }}
        aria-label={ariaLabel}
      />
    </Box>
  );
}

// Set display name for debugging
DataTable.displayName = 'DataTable';
