/**
 * RecordList Component
 *
 * React component providing paginated, sortable, filterable list view of database
 * activity records with bulk actions, custom template support, and Material-UI
 * DataGrid or Card-based layout.
 *
 * Features:
 * - Server-side pagination with configurable page size
 * - Sorting by any field with ascending/descending order
 * - Filtering via search input integration
 * - Custom list template or default card layout with FieldRenderer
 * - Bulk actions: multi-select checkboxes, bulk delete, bulk approve/disapprove
 * - Record count and pagination controls using Material-UI Pagination
 * - Action buttons (view, edit, delete) based on user permissions
 * - Different view modes (list, single) and seamless transition
 *
 * @module features/activities/data/components/RecordList
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  Stack,
  Grid,
  Typography,
  Checkbox,
  IconButton,
  Button,
  Toolbar,
  Chip,
  CircularProgress,
  Alert,
  Tooltip,
  Menu,
  MenuItem,
  FormControlLabel,
  TableSortLabel,
  Divider,
  TextField,
  InputAdornment,
  Select,
  FormControl,
  InputLabel,
  SelectChangeEvent,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  MoreVert as MoreVertIcon,
  FilterList as FilterListIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';

// Internal imports from depends_on_files
import { FieldRenderer } from './FieldRenderer';
import { useRecords } from '../hooks/useRecords';
import { useDatabase } from '../hooks/useDatabase';
import { useApproveRecord, useDeleteRecord } from '../hooks/useDatabaseMutation';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { Pagination } from '@/components/data-display/Pagination';
import { Card } from '@/components/data-display/Card';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/useToast';
import type {
  DatabaseField,
  DatabaseRecord,
  FieldContent,
  Database,
} from '../types/data.types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Approval status filter options
 */
type ApprovalStatusFilter = 'all' | 'approved' | 'pending';

/**
 * Sort direction
 */
type SortDirection = 'asc' | 'desc';

/**
 * View mode options
 */
type ViewMode = 'list' | 'single';

/**
 * Extended record with field content mapping
 */
interface RecordWithContent extends DatabaseRecord {
  /** Field ID to FieldContent mapping for easy access */
  contents: Record<number, FieldContent | null>;
}

/**
 * Props for the RecordList component
 */
export interface RecordListProps {
  /**
   * Database activity ID
   * Used to fetch records and configuration
   */
  databaseId: number;

  /**
   * Course module ID for permission context
   */
  cmId: number;

  /**
   * Current view mode
   * @default 'list'
   */
  viewMode?: ViewMode;

  /**
   * Callback when view mode changes
   */
  onViewModeChange?: (mode: ViewMode) => void;

  /**
   * Callback when a record is selected for single view
   */
  onRecordSelect?: (recordId: number) => void;

  /**
   * Currently selected record ID (for single view)
   */
  selectedRecordId?: number;

  /**
   * Initial page number (1-indexed)
   * @default 1
   */
  initialPage?: number;

  /**
   * Initial items per page
   * @default 10
   */
  initialPerPage?: number;

  /**
   * Base URL for file downloads
   */
  fileBaseUrl?: string;

  /**
   * Whether to show the search input
   * @default true
   */
  showSearch?: boolean;

  /**
   * Whether to show filter controls
   * @default true
   */
  showFilters?: boolean;

  /**
   * Whether to use custom template rendering
   * @default false
   */
  useCustomTemplate?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Default page size options */
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** Debounce delay for search input in milliseconds */
const SEARCH_DEBOUNCE_DELAY = 500;

/** Special sort field IDs */
const SORT_BY_TIME_ADDED = 0;
const SORT_BY_TIME_MODIFIED = -1;
const SORT_BY_FIRST_NAME = -2;
const SORT_BY_LAST_NAME = -3;

// ============================================================================
// RecordList Component
// ============================================================================

/**
 * RecordList Component
 *
 * Displays a paginated, sortable, filterable list of database activity records
 * with support for bulk actions and multiple display layouts.
 *
 * @example
 * ```tsx
 * <RecordList
 *   databaseId={123}
 *   cmId={456}
 *   onRecordSelect={(id) => navigate(`/record/${id}`)}
 *   showSearch={true}
 *   showFilters={true}
 * />
 * ```
 */
function RecordList({
  databaseId,
  cmId,
  viewMode = 'list',
  onViewModeChange,
  onRecordSelect,
  selectedRecordId,
  initialPage = 1,
  initialPerPage = 10,
  fileBaseUrl,
  showSearch = true,
  showFilters = true,
  useCustomTemplate = false,
}: RecordListProps): React.ReactElement {
  // =========================================================================
  // State Management
  // =========================================================================

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [perPage, setPerPage] = useState<number>(initialPerPage);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [approvalFilter, setApprovalFilter] = useState<ApprovalStatusFilter>('all');

  // Sorting state
  const [sortFieldId, setSortFieldId] = useState<number>(SORT_BY_TIME_ADDED);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Bulk selection state
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(new Set());

  // Menu state for record actions
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const [actionMenuRecordId, setActionMenuRecordId] = useState<number | null>(null);

  // Debounced search term for API calls
  const debouncedSearchTerm = useDebounce(searchTerm, SEARCH_DEBOUNCE_DELAY);

  // =========================================================================
  // Hooks
  // =========================================================================

  const queryClient = useQueryClient();
  const { success, error: toastError, warning } = useToast();
  const { hasCapability } = usePermissions();

  // Permission context for the module
  const permissionContext = useMemo(() => ({
    type: 'module' as const,
    contextId: cmId,
  }), [cmId]);

  // Check permissions
  const canViewEntry = useMemo(
    () => hasCapability('mod/data:viewentry', permissionContext),
    [hasCapability, permissionContext]
  );

  const canWriteEntry = useMemo(
    () => hasCapability('mod/data:writeentry', permissionContext),
    [hasCapability, permissionContext]
  );

  const canManageEntries = useMemo(
    () => hasCapability('mod/data:manageentries', permissionContext),
    [hasCapability, permissionContext]
  );

  const canApprove = useMemo(
    () => hasCapability('mod/data:approve', permissionContext),
    [hasCapability, permissionContext]
  );

  // Fetch database configuration
  const {
    data: database,
    isLoading: isDatabaseLoading,
    isError: isDatabaseError,
    error: databaseError,
  } = useDatabase(databaseId);

  // Build records query params
  const recordsParams = useMemo(() => ({
    databaseId,
    filters: {
      search: debouncedSearchTerm || undefined,
      approvalStatus: approvalFilter,
    },
    sort: {
      fieldId: sortFieldId,
      direction: sortDirection,
    },
    pagination: {
      page: currentPage,
      perPage,
    },
  }), [databaseId, debouncedSearchTerm, approvalFilter, sortFieldId, sortDirection, currentPage, perPage]);

  // Fetch records
  const {
    data: recordsData,
    isLoading: isRecordsLoading,
    isError: isRecordsError,
    error: recordsError,
    refetch: refetchRecords,
  } = useRecords(recordsParams);

  // Mutation hooks
  const { mutateAsync: approveRecord, isPending: isApproving } = useApproveRecord(databaseId);
  const { mutateAsync: deleteRecord, isPending: isDeleting } = useDeleteRecord(databaseId);

  // =========================================================================
  // Derived State
  // =========================================================================

  const records = recordsData?.records ?? [];
  const totalCount = recordsData?.totalCount ?? 0;
  const totalPages = recordsData?.totalPages ?? 0;

  // Fields available for display and sorting
  const fields: DatabaseField[] = database?.fields ?? [];

  // Check if database requires approval
  const requiresApproval = database?.approval ?? false;

  // Sort options combining special columns and database fields
  const sortOptions = useMemo(() => {
    const options: Array<{ value: number; label: string }> = [
      { value: SORT_BY_TIME_ADDED, label: 'Date added' },
      { value: SORT_BY_TIME_MODIFIED, label: 'Date modified' },
      { value: SORT_BY_FIRST_NAME, label: 'First name' },
      { value: SORT_BY_LAST_NAME, label: 'Last name' },
    ];

    fields.forEach((field) => {
      options.push({ value: field.id, label: field.name });
    });

    return options;
  }, [fields]);

  // Check if any records are selected
  const hasSelection = selectedRecordIds.size > 0;

  // Check if all visible records are selected
  const allSelected = records.length > 0 && records.every((r) => selectedRecordIds.has(r.id));

  // Check if some but not all visible records are selected
  const someSelected = hasSelection && !allSelected;

  // =========================================================================
  // Event Handlers
  // =========================================================================

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    // Reset to first page when search changes
    setCurrentPage(1);
  }, []);

  /**
   * Handle approval filter change
   */
  const handleApprovalFilterChange = useCallback((event: SelectChangeEvent<ApprovalStatusFilter>) => {
    setApprovalFilter(event.target.value as ApprovalStatusFilter);
    setCurrentPage(1);
  }, []);

  /**
   * Handle sort field change
   */
  const handleSortFieldChange = useCallback((fieldId: number) => {
    if (sortFieldId === fieldId) {
      // Toggle direction if same field
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortFieldId(fieldId);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  }, [sortFieldId]);

  /**
   * Handle page change
   */
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    // Clear selection when page changes
    setSelectedRecordIds(new Set());
  }, []);

  /**
   * Handle rows per page change
   */
  const handlePerPageChange = useCallback((newPerPage: number) => {
    setPerPage(newPerPage);
    setCurrentPage(1);
    setSelectedRecordIds(new Set());
  }, []);

  /**
   * Handle select all checkbox toggle
   */
  const handleSelectAll = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedRecordIds(new Set(records.map((r) => r.id)));
    } else {
      setSelectedRecordIds(new Set());
    }
  }, [records]);

  /**
   * Handle individual record selection toggle
   */
  const handleSelectRecord = useCallback((recordId: number, checked: boolean) => {
    setSelectedRecordIds((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(recordId);
      } else {
        newSet.delete(recordId);
      }
      return newSet;
    });
  }, []);

  /**
   * Handle record action menu open
   */
  const handleActionMenuOpen = useCallback((event: React.MouseEvent<HTMLButtonElement>, recordId: number) => {
    setActionMenuAnchor(event.currentTarget);
    setActionMenuRecordId(recordId);
  }, []);

  /**
   * Handle record action menu close
   */
  const handleActionMenuClose = useCallback(() => {
    setActionMenuAnchor(null);
    setActionMenuRecordId(null);
  }, []);

  /**
   * Handle view record action
   */
  const handleViewRecord = useCallback((recordId: number) => {
    handleActionMenuClose();
    if (onRecordSelect) {
      onRecordSelect(recordId);
    }
    if (onViewModeChange) {
      onViewModeChange('single');
    }
  }, [handleActionMenuClose, onRecordSelect, onViewModeChange]);

  /**
   * Handle edit record action
   */
  const handleEditRecord = useCallback((recordId: number) => {
    handleActionMenuClose();
    // Navigate to edit page - this would typically use React Router
    // For now, we can emit an event or call a callback
    if (onRecordSelect) {
      onRecordSelect(recordId);
    }
  }, [handleActionMenuClose, onRecordSelect]);

  /**
   * Handle delete single record
   */
  const handleDeleteRecord = useCallback(async (recordId: number) => {
    handleActionMenuClose();
    try {
      await deleteRecord({ recordId });
      success('Record deleted successfully');
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['database-records', databaseId] });
      // Remove from selection if selected
      setSelectedRecordIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(recordId);
        return newSet;
      });
    } catch (err) {
      toastError('Failed to delete record. Please try again.');
    }
  }, [handleActionMenuClose, deleteRecord, success, toastError, queryClient, databaseId]);

  /**
   * Handle approve single record
   */
  const handleApproveRecord = useCallback(async (recordId: number, approve: boolean) => {
    handleActionMenuClose();
    try {
      await approveRecord({ recordId, approved: approve });
      success(approve ? 'Record approved' : 'Record disapproved');
      queryClient.invalidateQueries({ queryKey: ['database-records', databaseId] });
    } catch (err) {
      toastError(`Failed to ${approve ? 'approve' : 'disapprove'} record. Please try again.`);
    }
  }, [handleActionMenuClose, approveRecord, success, toastError, queryClient, databaseId]);

  /**
   * Handle bulk delete
   */
  const handleBulkDelete = useCallback(async () => {
    if (selectedRecordIds.size === 0) {
      warning('No records selected');
      return;
    }

    try {
      // Delete records one by one (could be optimized with batch API)
      const deletePromises = Array.from(selectedRecordIds).map((recordId) =>
        deleteRecord({ recordId })
      );
      await Promise.all(deletePromises);

      success(`${selectedRecordIds.size} record(s) deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ['database-records', databaseId] });
      setSelectedRecordIds(new Set());
    } catch (err) {
      toastError('Failed to delete some records. Please try again.');
    }
  }, [selectedRecordIds, deleteRecord, success, toastError, warning, queryClient, databaseId]);

  /**
   * Handle bulk approve
   */
  const handleBulkApprove = useCallback(async (approve: boolean) => {
    if (selectedRecordIds.size === 0) {
      warning('No records selected');
      return;
    }

    try {
      const approvePromises = Array.from(selectedRecordIds).map((recordId) =>
        approveRecord({ recordId, approved: approve })
      );
      await Promise.all(approvePromises);

      success(`${selectedRecordIds.size} record(s) ${approve ? 'approved' : 'disapproved'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['database-records', databaseId] });
      setSelectedRecordIds(new Set());
    } catch (err) {
      toastError(`Failed to ${approve ? 'approve' : 'disapprove'} some records. Please try again.`);
    }
  }, [selectedRecordIds, approveRecord, success, toastError, warning, queryClient, databaseId]);

  // =========================================================================
  // Effect Hooks
  // =========================================================================

  // Reset selection when records change
  useEffect(() => {
    setSelectedRecordIds((prev) => {
      const recordIdSet = new Set(records.map((r) => r.id));
      const newSet = new Set<number>();
      prev.forEach((id) => {
        if (recordIdSet.has(id)) {
          newSet.add(id);
        }
      });
      return newSet;
    });
  }, [records]);

  // =========================================================================
  // Render Helpers
  // =========================================================================

  /**
   * Render loading state
   */
  const renderLoading = () => (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight={200}
      aria-busy="true"
      aria-label="Loading records"
    >
      <CircularProgress />
    </Box>
  );

  /**
   * Render error state
   */
  const renderError = (errorMessage: string) => (
    <Alert severity="error" sx={{ my: 2 }}>
      {errorMessage}
    </Alert>
  );

  /**
   * Render empty state
   */
  const renderEmpty = () => (
    <Alert severity="info" sx={{ my: 2 }}>
      {debouncedSearchTerm
        ? 'No records found matching your search criteria.'
        : 'No records have been added yet.'}
    </Alert>
  );

  /**
   * Render search and filter controls
   */
  const renderSearchAndFilters = () => (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
      {showSearch && (
        <TextField
          size="small"
          placeholder="Search records..."
          value={searchTerm}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 250 }}
          aria-label="Search records"
        />
      )}

      {showFilters && (
        <>
          {/* Approval filter - only show if database requires approval */}
          {requiresApproval && (
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="approval-filter-label">Status</InputLabel>
              <Select
                labelId="approval-filter-label"
                value={approvalFilter}
                onChange={handleApprovalFilterChange}
                label="Status"
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
              </Select>
            </FormControl>
          )}

          {/* Sort field selector */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="sort-field-label">Sort by</InputLabel>
            <Select
              labelId="sort-field-label"
              value={sortFieldId}
              onChange={(e) => handleSortFieldChange(e.target.value as number)}
              label="Sort by"
            >
              {sortOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Sort direction toggle */}
          <Tooltip title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}>
            <IconButton
              onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              aria-label={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
            >
              {sortDirection === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
            </IconButton>
          </Tooltip>
        </>
      )}
    </Stack>
  );

  /**
   * Render bulk actions toolbar
   */
  const renderBulkActionsToolbar = () => {
    if (!canManageEntries && !canApprove) {
      return null;
    }

    return (
      <Toolbar
        sx={{
          pl: { sm: 2 },
          pr: { xs: 1, sm: 1 },
          ...(hasSelection && {
            bgcolor: (theme) =>
              theme.palette.mode === 'light'
                ? theme.palette.primary.light
                : theme.palette.primary.dark,
          }),
        }}
      >
        {/* Select all checkbox */}
        <FormControlLabel
          control={
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={handleSelectAll}
              inputProps={{ 'aria-label': 'Select all records' }}
            />
          }
          label={hasSelection ? `${selectedRecordIds.size} selected` : 'Select all'}
        />

        <Box sx={{ flexGrow: 1 }} />

        {/* Bulk action buttons */}
        {hasSelection && (
          <Stack direction="row" spacing={1}>
            {canApprove && requiresApproval && (
              <>
                <Tooltip title="Approve selected">
                  <Button
                    size="small"
                    startIcon={<CheckIcon />}
                    onClick={() => handleBulkApprove(true)}
                    disabled={isApproving}
                  >
                    Approve
                  </Button>
                </Tooltip>
                <Tooltip title="Disapprove selected">
                  <Button
                    size="small"
                    startIcon={<CloseIcon />}
                    onClick={() => handleBulkApprove(false)}
                    disabled={isApproving}
                  >
                    Disapprove
                  </Button>
                </Tooltip>
              </>
            )}
            {canManageEntries && (
              <Tooltip title="Delete selected">
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                >
                  Delete
                </Button>
              </Tooltip>
            )}
          </Stack>
        )}
      </Toolbar>
    );
  };

  /**
   * Get record contents as a map
   */
  const getRecordContents = useCallback((record: DatabaseRecord): Record<number, FieldContent | null> => {
    // Note: In a real implementation, the record would include contents
    // This is a placeholder that returns an empty map
    // The actual implementation depends on how the API returns record data
    return (record as RecordWithContent).contents ?? {};
  }, []);

  /**
   * Render a single record card
   */
  const renderRecordCard = (record: DatabaseRecord) => {
    const isSelected = selectedRecordIds.has(record.id);
    const contents = getRecordContents(record);

    // Determine if user can edit this record
    const isOwnRecord = true; // This would need user context to determine
    const canEdit = canManageEntries || (canWriteEntry && isOwnRecord);
    const canDelete = canManageEntries;

    return (
      <Grid item xs={12} sm={6} md={4} key={record.id}>
        <Card
          elevation={isSelected ? 3 : 1}
          variant={isSelected ? 'outlined' : 'elevation'}
          sx={{
            position: 'relative',
            borderColor: isSelected ? 'primary.main' : undefined,
            transition: 'all 0.2s ease-in-out',
          }}
        >
          {/* Selection checkbox */}
          {(canManageEntries || canApprove) && (
            <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}>
              <Checkbox
                checked={isSelected}
                onChange={(e) => handleSelectRecord(record.id, e.target.checked)}
                inputProps={{ 'aria-label': `Select record ${record.id}` }}
              />
            </Box>
          )}

          {/* Approval status badge */}
          {requiresApproval && (
            <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
              <Chip
                size="small"
                label={record.approved ? 'Approved' : 'Pending'}
                color={record.approved ? 'success' : 'warning'}
              />
            </Box>
          )}

          {/* Card content - render fields */}
          <Box
            sx={{ pt: (canManageEntries || canApprove) ? 5 : 2, px: 2, pb: 1 }}
            onClick={() => canViewEntry && handleViewRecord(record.id)}
            style={{ cursor: canViewEntry ? 'pointer' : 'default' }}
          >
            {fields.slice(0, 3).map((field) => (
              <Box key={field.id} sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {field.name}
                </Typography>
                <Box>
                  <FieldRenderer
                    field={field}
                    value={contents[field.id] ?? null}
                    mode="list"
                    fileBaseUrl={fileBaseUrl}
                  />
                </Box>
              </Box>
            ))}

            {/* Metadata */}
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Added: {new Date(record.timecreated * 1000).toLocaleDateString()}
            </Typography>
          </Box>

          <Divider />

          {/* Action buttons */}
          <Stack
            direction="row"
            spacing={1}
            justifyContent="flex-end"
            sx={{ p: 1 }}
          >
            {canViewEntry && (
              <Tooltip title="View">
                <IconButton
                  size="small"
                  onClick={() => handleViewRecord(record.id)}
                  aria-label={`View record ${record.id}`}
                >
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canEdit && (
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  onClick={() => handleEditRecord(record.id)}
                  aria-label={`Edit record ${record.id}`}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canApprove && requiresApproval && (
              <Tooltip title={record.approved ? 'Disapprove' : 'Approve'}>
                <IconButton
                  size="small"
                  onClick={() => handleApproveRecord(record.id, !record.approved)}
                  aria-label={record.approved ? 'Disapprove record' : 'Approve record'}
                >
                  {record.approved ? <CloseIcon fontSize="small" /> : <CheckIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteRecord(record.id)}
                  aria-label={`Delete record ${record.id}`}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {/* More actions menu */}
            <IconButton
              size="small"
              onClick={(e) => handleActionMenuOpen(e, record.id)}
              aria-label="More actions"
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Card>
      </Grid>
    );
  };

  /**
   * Render records in card layout
   */
  const renderCardLayout = () => (
    <Grid container spacing={2}>
      {records.map((record) => renderRecordCard(record))}
    </Grid>
  );

  /**
   * Render pagination controls
   */
  const renderPagination = () => {
    if (totalCount === 0) {
      return null;
    }

    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mt: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        {/* Record count */}
        <Typography variant="body2" color="text.secondary">
          Showing {Math.min((currentPage - 1) * perPage + 1, totalCount)} -{' '}
          {Math.min(currentPage * perPage, totalCount)} of {totalCount} records
        </Typography>

        {/* Pagination component */}
        <Pagination
          variant="table"
          count={totalCount}
          page={currentPage - 1}
          rowsPerPage={perPage}
          rowsPerPageOptions={PAGE_SIZE_OPTIONS}
          onPageChange={(page) => handlePageChange(page + 1)}
          onRowsPerPageChange={handlePerPageChange}
          showFirstButton
          showLastButton
        />
      </Box>
    );
  };

  /**
   * Render action menu for records
   */
  const renderActionMenu = () => {
    const record = records.find((r) => r.id === actionMenuRecordId);
    if (!record) {
      return null;
    }

    const isOwnRecord = true; // Would need user context
    const canEdit = canManageEntries || (canWriteEntry && isOwnRecord);
    const canDelete = canManageEntries;

    return (
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionMenuClose}
      >
        {canViewEntry && (
          <MenuItem onClick={() => handleViewRecord(record.id)}>
            <VisibilityIcon fontSize="small" sx={{ mr: 1 }} />
            View
          </MenuItem>
        )}
        {canEdit && (
          <MenuItem onClick={() => handleEditRecord(record.id)}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
        )}
        {canApprove && requiresApproval && (
          <MenuItem onClick={() => handleApproveRecord(record.id, !record.approved)}>
            {record.approved ? (
              <>
                <CloseIcon fontSize="small" sx={{ mr: 1 }} />
                Disapprove
              </>
            ) : (
              <>
                <CheckIcon fontSize="small" sx={{ mr: 1 }} />
                Approve
              </>
            )}
          </MenuItem>
        )}
        {canDelete && (
          <MenuItem onClick={() => handleDeleteRecord(record.id)} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        )}
      </Menu>
    );
  };

  // =========================================================================
  // Main Render
  // =========================================================================

  // Loading state
  if (isDatabaseLoading || (isRecordsLoading && records.length === 0)) {
    return renderLoading();
  }

  // Error states
  if (isDatabaseError) {
    return renderError(
      databaseError instanceof Error
        ? databaseError.message
        : 'Failed to load database configuration'
    );
  }

  if (isRecordsError) {
    return renderError(
      recordsError instanceof Error
        ? recordsError.message
        : 'Failed to load records'
    );
  }

  return (
    <Box component="section" aria-label="Database records list">
      {/* Search and filter controls */}
      {renderSearchAndFilters()}

      {/* Bulk actions toolbar */}
      {renderBulkActionsToolbar()}

      {/* Loading overlay for refetching */}
      {isRecordsLoading && records.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <CircularProgress />
        </Box>
      )}

      {/* Records content */}
      <Box sx={{ position: 'relative', minHeight: 200 }}>
        {records.length === 0 ? renderEmpty() : renderCardLayout()}
      </Box>

      {/* Pagination */}
      {renderPagination()}

      {/* Action menu */}
      {renderActionMenu()}
    </Box>
  );
}

// Default export as specified in schema
export default RecordList;
