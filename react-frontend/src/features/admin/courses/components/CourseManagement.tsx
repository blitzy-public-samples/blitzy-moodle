/**
 * Admin Course Management Component
 *
 * Comprehensive admin interface for course CRUD operations providing:
 * - Course listing with Material-UI DataGrid
 * - Search and filtering by category, visibility
 * - Bulk actions (delete, hide, show, move to category)
 * - Individual course actions (edit, delete, toggle visibility)
 * - Pagination support with configurable page sizes
 *
 * This component integrates with the useCourseAdmin hook for state management
 * and React Query for data fetching and mutations. All operations call
 * existing Moodle API endpoints without duplicating business logic.
 *
 * @module features/admin/courses/components/CourseManagement
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  DataGrid,
  type GridColDef,
  type GridRowSelectionModel,
  type GridRenderCellParams,
  type GridValueGetterParams,
  type GridValueFormatterParams,
  type GridSortModel,
  type GridPaginationModel,
} from '@mui/x-data-grid';
import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Toolbar,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Snackbar,
  Typography,
  FormControl,
  InputLabel,
  InputAdornment,
  Chip,
  Paper,
  Stack,
  Divider,
  CircularProgress,
  FormControlLabel,
  RadioGroup,
  Radio,
  SelectChangeEvent,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  DriveFileMove as FolderMoveIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

// Internal imports
import type { Course, CourseCategory } from '@/types/entities';
import { deleteCourse } from '@/features/courses/api/courseApi';
import useDebounce from '@/hooks/useDebounce';
import { useToast } from '@/hooks/useToast';

// Admin-specific imports
import type { CourseFilters, CourseSortField, SortOrder } from '../types/filters.types';
import type { BulkActionResult } from '../types/bulk.types';
import {
  getAllCourses,
  getAllCategories,
  bulkDeleteCourses,
  bulkUpdateCourses,
  bulkMoveCourses,
} from '../api/adminCoursesApi';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props interface for the CourseManagement component
 */
export interface CourseManagementProps {
  /**
   * Optional category ID to filter courses by
   * When set, only courses in this category are displayed
   */
  categoryId?: number;

  /**
   * Callback fired when a course is selected
   * Receives the course ID of the selected course
   */
  onCourseSelect?: (courseId: number) => void;

  /**
   * Whether to show action buttons (edit, delete, etc.)
   * @default true
   */
  showActions?: boolean;
}

/**
 * Visibility filter options
 */
type VisibilityFilter = 'all' | 'visible' | 'hidden';

/**
 * Dialog state for various confirmation dialogs
 */
interface DialogState {
  deleteConfirm: boolean;
  bulkDeleteConfirm: boolean;
  moveCategoryDialog: boolean;
}

/**
 * Course row type for DataGrid with required fields
 */
interface CourseRow extends Course {
  id: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default number of items per page */
const DEFAULT_PAGE_SIZE = 20;

/** Available page size options */
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** Debounce delay for search input (milliseconds) */
const SEARCH_DEBOUNCE_MS = 500;

/** Query key for admin courses */
const ADMIN_COURSES_QUERY_KEY = 'admin-courses-management';

/** Query key for admin categories */
const ADMIN_CATEGORIES_QUERY_KEY = 'admin-categories-management';

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * Admin Course Management Component
 *
 * Provides comprehensive CRUD operations for courses including search,
 * filtering, bulk actions, and individual course management.
 *
 * @param props - Component props
 * @returns JSX element for course management interface
 *
 * @example
 * ```tsx
 * // Basic usage
 * <CourseManagement />
 *
 * // With category filter
 * <CourseManagement categoryId={5} />
 *
 * // With course selection callback
 * <CourseManagement onCourseSelect={(id) => navigate(`/admin/courses/${id}`)} />
 * ```
 */
const CourseManagement: React.FC<CourseManagementProps> = ({
  categoryId: initialCategoryId,
  onCourseSelect,
  showActions = true,
}) => {
  // ============================================================================
  // Hooks
  // ============================================================================

  const queryClient = useQueryClient();
  const toast = useToast();

  // ============================================================================
  // Local State
  // ============================================================================

  // Search and filtering state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>(initialCategoryId);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');

  // Pagination state
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // Sort state
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'fullname', sort: 'asc' },
  ]);

  // Selection state
  const [selectedCourseIds, setSelectedCourseIds] = useState<GridRowSelectionModel>([]);

  // Dialog states
  const [dialogState, setDialogState] = useState<DialogState>({
    deleteConfirm: false,
    bulkDeleteConfirm: false,
    moveCategoryDialog: false,
  });

  // Single course action state
  const [courseToDelete, setCourseToDelete] = useState<CourseRow | null>(null);

  // Move category dialog state
  const [targetCategoryId, setTargetCategoryId] = useState<number | ''>('');

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // ============================================================================
  // Debounced Values
  // ============================================================================

  const debouncedSearchTerm = useDebounce(searchTerm, SEARCH_DEBOUNCE_MS);

  // ============================================================================
  // Computed Values
  // ============================================================================

  /**
   * Build filters object for API request
   */
  const filters = useMemo<CourseFilters>(() => {
    const filterObj: CourseFilters = {
      page: paginationModel.page + 1, // API uses 1-indexed pages
      perPage: paginationModel.pageSize,
    };

    if (debouncedSearchTerm) {
      filterObj.search = debouncedSearchTerm;
    }

    if (categoryFilter !== undefined) {
      filterObj.categoryId = categoryFilter;
    }

    if (visibilityFilter !== 'all') {
      filterObj.visible = visibilityFilter === 'visible';
    }

    if (sortModel.length > 0 && sortModel[0]) {
      const sortField = sortModel[0].field;
      const sortDirection = sortModel[0].sort;
      if (sortField) {
        filterObj.sortBy = sortField as CourseSortField;
      }
      if (sortDirection) {
        filterObj.sortOrder = sortDirection as SortOrder;
      }
    }

    return filterObj;
  }, [paginationModel, debouncedSearchTerm, categoryFilter, visibilityFilter, sortModel]);

  // ============================================================================
  // React Query - Data Fetching
  // ============================================================================

  /**
   * Query for fetching courses with filters
   */
  const {
    data: coursesData,
    isLoading: isCoursesLoading,
    error: coursesError,
    refetch: refetchCourses,
  } = useQuery({
    queryKey: [ADMIN_COURSES_QUERY_KEY, filters],
    queryFn: () => getAllCourses(filters),
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  /**
   * Query for fetching categories for filter dropdown
   */
  const { data: categoriesData } = useQuery({
    queryKey: [ADMIN_CATEGORIES_QUERY_KEY],
    queryFn: () => getAllCategories(),
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });

  // ============================================================================
  // React Query - Mutations
  // ============================================================================

  /**
   * Mutation for deleting a single course
   */
  const deleteMutation = useMutation({
    mutationFn: (courseId: number) => deleteCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_COURSES_QUERY_KEY] });
      toast.success('Course deleted successfully');
      handleCloseDeleteDialog();
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete course: ${error.message}`);
    },
  });

  /**
   * Mutation for bulk deleting courses
   */
  const bulkDeleteMutation = useMutation({
    mutationFn: (courseIds: number[]) => bulkDeleteCourses(courseIds),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_COURSES_QUERY_KEY] });
      handleBulkActionSuccess(result.data, 'deleted');
      handleCloseBulkDeleteDialog();
      setSelectedCourseIds([]);
    },
    onError: (error: Error) => {
      toast.error(`Bulk delete failed: ${error.message}`);
    },
  });

  /**
   * Mutation for bulk visibility update
   */
  const bulkVisibilityMutation = useMutation({
    mutationFn: ({ courseIds, visible }: { courseIds: number[]; visible: boolean }) =>
      bulkUpdateCourses(courseIds, visible),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_COURSES_QUERY_KEY] });
      const action = variables.visible ? 'shown' : 'hidden';
      handleBulkActionSuccess(result.data, action);
      setSelectedCourseIds([]);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update course visibility: ${error.message}`);
    },
  });

  /**
   * Mutation for bulk move to category
   */
  const bulkMoveMutation = useMutation({
    mutationFn: ({ courseIds, categoryId }: { courseIds: number[]; categoryId: number }) =>
      bulkMoveCourses(courseIds, categoryId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_COURSES_QUERY_KEY] });
      handleBulkActionSuccess(result.data, 'moved');
      handleCloseMoveCategoryDialog();
      setSelectedCourseIds([]);
    },
    onError: (error: Error) => {
      toast.error(`Failed to move courses: ${error.message}`);
    },
  });

  // ============================================================================
  // Computed Data
  // ============================================================================

  const courses: CourseRow[] = useMemo(() => {
    if (!coursesData?.success || !coursesData.data?.items) {
      return [];
    }
    return coursesData.data.items.map((course: Course) => ({
      ...course,
      id: course.id,
    }));
  }, [coursesData]);

  const totalCourses = useMemo(() => {
    return coursesData?.data?.total ?? 0;
  }, [coursesData]);

  const categories: CourseCategory[] = useMemo(() => {
    if (!categoriesData?.success || !categoriesData.data?.items) {
      return [];
    }
    return categoriesData.data.items;
  }, [categoriesData]);

  const selectedCoursesCount = selectedCourseIds.length;
  const hasSelection = selectedCoursesCount > 0;

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(event.target.value);
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
    },
    []
  );

  /**
   * Handle category filter change
   */
  const handleCategoryChange = useCallback((event: SelectChangeEvent<number | ''>) => {
    const value = event.target.value;
    setCategoryFilter(value === '' ? undefined : (value as number));
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, []);

  /**
   * Handle visibility filter change
   */
  const handleVisibilityChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setVisibilityFilter(event.target.value as VisibilityFilter);
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
    },
    []
  );

  /**
   * Clear all filters
   */
  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setCategoryFilter(initialCategoryId);
    setVisibilityFilter('all');
    setPaginationModel({ page: 0, pageSize: DEFAULT_PAGE_SIZE });
    setSortModel([{ field: 'fullname', sort: 'asc' }]);
  }, [initialCategoryId]);

  /**
   * Handle row selection change
   */
  const handleSelectionChange = useCallback((newSelection: GridRowSelectionModel) => {
    setSelectedCourseIds(newSelection);
  }, []);

  /**
   * Handle pagination model change
   */
  const handlePaginationChange = useCallback((model: GridPaginationModel) => {
    setPaginationModel(model);
  }, []);

  /**
   * Handle sort model change
   */
  const handleSortChange = useCallback((model: GridSortModel) => {
    setSortModel(model);
  }, []);

  /**
   * Handle row click for course selection
   */
  const handleRowClick = useCallback(
    (params: { id: number | string }) => {
      if (onCourseSelect) {
        onCourseSelect(params.id as number);
      }
    },
    [onCourseSelect]
  );

  // ============================================================================
  // Dialog Handlers
  // ============================================================================

  /**
   * Open delete confirmation dialog for a single course
   */
  const handleOpenDeleteDialog = useCallback((course: CourseRow) => {
    setCourseToDelete(course);
    setDialogState((prev) => ({ ...prev, deleteConfirm: true }));
  }, []);

  /**
   * Close delete confirmation dialog
   */
  const handleCloseDeleteDialog = useCallback(() => {
    setCourseToDelete(null);
    setDialogState((prev) => ({ ...prev, deleteConfirm: false }));
  }, []);

  /**
   * Confirm single course deletion
   */
  const handleConfirmDelete = useCallback(() => {
    if (courseToDelete) {
      deleteMutation.mutate(courseToDelete.id);
    }
  }, [courseToDelete, deleteMutation]);

  /**
   * Open bulk delete confirmation dialog
   */
  const handleOpenBulkDeleteDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, bulkDeleteConfirm: true }));
  }, []);

  /**
   * Close bulk delete confirmation dialog
   */
  const handleCloseBulkDeleteDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, bulkDeleteConfirm: false }));
  }, []);

  /**
   * Confirm bulk deletion
   */
  const handleConfirmBulkDelete = useCallback(() => {
    const courseIds = selectedCourseIds.map((id) => Number(id));
    bulkDeleteMutation.mutate(courseIds);
  }, [selectedCourseIds, bulkDeleteMutation]);

  /**
   * Open move category dialog
   */
  const handleOpenMoveCategoryDialog = useCallback(() => {
    setTargetCategoryId('');
    setDialogState((prev) => ({ ...prev, moveCategoryDialog: true }));
  }, []);

  /**
   * Close move category dialog
   */
  const handleCloseMoveCategoryDialog = useCallback(() => {
    setTargetCategoryId('');
    setDialogState((prev) => ({ ...prev, moveCategoryDialog: false }));
  }, []);

  /**
   * Confirm move to category
   */
  const handleConfirmMoveCategory = useCallback(() => {
    if (targetCategoryId !== '') {
      const courseIds = selectedCourseIds.map((id) => Number(id));
      bulkMoveMutation.mutate({ courseIds, categoryId: targetCategoryId as number });
    }
  }, [selectedCourseIds, targetCategoryId, bulkMoveMutation]);

  // ============================================================================
  // Bulk Action Handlers
  // ============================================================================

  /**
   * Handle bulk show courses
   */
  const handleBulkShow = useCallback(() => {
    const courseIds = selectedCourseIds.map((id) => Number(id));
    bulkVisibilityMutation.mutate({ courseIds, visible: true });
  }, [selectedCourseIds, bulkVisibilityMutation]);

  /**
   * Handle bulk hide courses
   */
  const handleBulkHide = useCallback(() => {
    const courseIds = selectedCourseIds.map((id) => Number(id));
    bulkVisibilityMutation.mutate({ courseIds, visible: false });
  }, [selectedCourseIds, bulkVisibilityMutation]);

  /**
   * Handle bulk action success notification
   */
  const handleBulkActionSuccess = useCallback(
    (result: BulkActionResult, action: string) => {
      if (result.failedCount > 0) {
        toast.warning(
          `${result.successCount} courses ${action}, ${result.failedCount} failed`
        );
      } else {
        toast.success(`${result.successCount} courses ${action} successfully`);
      }
    },
    [toast]
  );

  /**
   * Handle single course visibility toggle
   */
  const handleToggleVisibility = useCallback(
    (course: CourseRow) => {
      const newVisibility = !course.visible;
      bulkVisibilityMutation.mutate({
        courseIds: [course.id],
        visible: newVisibility,
      });
    },
    [bulkVisibilityMutation]
  );

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(() => {
    refetchCourses();
  }, [refetchCourses]);

  /**
   * Handle snackbar close
   */
  const handleSnackbarClose = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  // ============================================================================
  // DataGrid Column Definitions
  // ============================================================================

  const columns = useMemo<GridColDef<CourseRow>[]>(
    () => [
      {
        field: 'fullname',
        headerName: 'Course Name',
        flex: 2,
        minWidth: 200,
        renderCell: (params: GridRenderCellParams<CourseRow>) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                cursor: onCourseSelect ? 'pointer' : 'default',
                '&:hover': onCourseSelect ? { textDecoration: 'underline' } : {},
              }}
              onClick={() => onCourseSelect?.(params.row.id)}
            >
              {params.value}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'shortname',
        headerName: 'Short Name',
        flex: 1,
        minWidth: 120,
      },
      {
        field: 'categoryName',
        headerName: 'Category',
        flex: 1,
        minWidth: 150,
        valueGetter: (params: GridValueGetterParams<CourseRow>) => {
          const categoryId = params.row.category;
          const category = categories.find((c) => c.id === categoryId);
          return category?.name ?? 'Unknown';
        },
      },
      {
        field: 'format',
        headerName: 'Format',
        width: 100,
      },
      {
        field: 'visible',
        headerName: 'Visibility',
        width: 100,
        renderCell: (params: GridRenderCellParams<CourseRow>) => (
          <Chip
            icon={params.value === 1 ? <VisibilityIcon /> : <VisibilityOffIcon />}
            label={params.value === 1 ? 'Visible' : 'Hidden'}
            size="small"
            color={params.value === 1 ? 'success' : 'default'}
            variant="outlined"
          />
        ),
      },
      {
        field: 'startdate',
        headerName: 'Start Date',
        width: 120,
        valueFormatter: (params: GridValueFormatterParams<number>) => {
          if (!params.value) return '-';
          return new Date(params.value * 1000).toLocaleDateString();
        },
      },
      ...(showActions
        ? [
            {
              field: 'actions',
              headerName: 'Actions',
              width: 160,
              sortable: false,
              filterable: false,
              renderCell: (params: GridRenderCellParams<CourseRow>) => (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title="Edit Course">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/course/edit.php?id=${params.row.id}`, '_blank');
                      }}
                      aria-label={`Edit ${params.row.fullname}`}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={params.row.visible ? 'Hide Course' : 'Show Course'}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleVisibility(params.row);
                      }}
                      aria-label={
                        params.row.visible
                          ? `Hide ${params.row.fullname}`
                          : `Show ${params.row.fullname}`
                      }
                    >
                      {params.row.visible ? (
                        <VisibilityOffIcon fontSize="small" />
                      ) : (
                        <VisibilityIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="View Course">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/course/view.php?id=${params.row.id}`, '_blank');
                      }}
                      aria-label={`View ${params.row.fullname}`}
                    >
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Course">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDeleteDialog(params.row);
                      }}
                      aria-label={`Delete ${params.row.fullname}`}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ),
            } as GridColDef<CourseRow>,
          ]
        : []),
    ],
    [
      categories,
      showActions,
      onCourseSelect,
      handleToggleVisibility,
      handleOpenDeleteDialog,
    ]
  );

  // ============================================================================
  // Loading and Error States
  // ============================================================================

  if (coursesError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load courses: {coursesError.message}
          <Button onClick={handleRefresh} sx={{ ml: 2 }}>
            Retry
          </Button>
        </Alert>
      </Box>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Search and Filter Toolbar */}
      <Paper sx={{ mb: 2, p: 2 }}>
        <Stack spacing={2}>
          {/* Search Row */}
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              placeholder="Search courses..."
              value={searchTerm}
              onChange={handleSearchChange}
              size="small"
              sx={{ minWidth: 250, flex: 1, maxWidth: 400 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchTerm ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSearchTerm('')}
                      aria-label="Clear search"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
              aria-label="Search courses"
            />

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="category-filter-label">Category</InputLabel>
              <Select
                labelId="category-filter-label"
                value={categoryFilter ?? ''}
                label="Category"
                onChange={handleCategoryChange}
                aria-label="Filter by category"
              >
                <MenuItem value="">
                  <em>All Categories</em>
                </MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl component="fieldset" size="small">
              <RadioGroup
                row
                value={visibilityFilter}
                onChange={handleVisibilityChange}
                aria-label="Filter by visibility"
              >
                <FormControlLabel
                  value="all"
                  control={<Radio size="small" />}
                  label="All"
                />
                <FormControlLabel
                  value="visible"
                  control={<Radio size="small" />}
                  label="Visible"
                />
                <FormControlLabel
                  value="hidden"
                  control={<Radio size="small" />}
                  label="Hidden"
                />
              </RadioGroup>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
              size="small"
              aria-label="Clear all filters"
            >
              Clear Filters
            </Button>

            <IconButton
              onClick={handleRefresh}
              disabled={isCoursesLoading}
              aria-label="Refresh course list"
            >
              <RefreshIcon />
            </IconButton>
          </Stack>

          {/* Bulk Actions Toolbar - Only visible when courses are selected */}
          {hasSelection && showActions && (
            <>
              <Divider />
              <Toolbar
                variant="dense"
                sx={{
                  bgcolor: 'action.selected',
                  borderRadius: 1,
                  pl: { sm: 2 },
                  pr: { xs: 1, sm: 1 },
                }}
              >
                <Typography
                  sx={{ flex: '1 1 100%' }}
                  color="inherit"
                  variant="subtitle1"
                  component="div"
                >
                  {selectedCoursesCount} course{selectedCoursesCount !== 1 ? 's' : ''} selected
                </Typography>

                <Stack direction="row" spacing={1}>
                  <Tooltip title="Show selected courses">
                    <Button
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={handleBulkShow}
                      disabled={bulkVisibilityMutation.isPending}
                      aria-label="Show selected courses"
                    >
                      Show
                    </Button>
                  </Tooltip>

                  <Tooltip title="Hide selected courses">
                    <Button
                      size="small"
                      startIcon={<VisibilityOffIcon />}
                      onClick={handleBulkHide}
                      disabled={bulkVisibilityMutation.isPending}
                      aria-label="Hide selected courses"
                    >
                      Hide
                    </Button>
                  </Tooltip>

                  <Tooltip title="Move to category">
                    <Button
                      size="small"
                      startIcon={<FolderMoveIcon />}
                      onClick={handleOpenMoveCategoryDialog}
                      disabled={bulkMoveMutation.isPending}
                      aria-label="Move selected courses to category"
                    >
                      Move
                    </Button>
                  </Tooltip>

                  <Tooltip title="Delete selected courses">
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={handleOpenBulkDeleteDialog}
                      disabled={bulkDeleteMutation.isPending}
                      aria-label="Delete selected courses"
                    >
                      Delete
                    </Button>
                  </Tooltip>

                  <Button
                    size="small"
                    onClick={() => setSelectedCourseIds([])}
                    aria-label="Clear selection"
                  >
                    Clear Selection
                  </Button>
                </Stack>
              </Toolbar>
            </>
          )}
        </Stack>
      </Paper>

      {/* DataGrid */}
      <Paper sx={{ flex: 1, minHeight: 400 }}>
        <DataGrid
          rows={courses}
          columns={columns}
          loading={isCoursesLoading}
          paginationMode="server"
          sortingMode="server"
          rowCount={totalCourses}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          paginationModel={paginationModel}
          onPaginationModelChange={handlePaginationChange}
          sortModel={sortModel}
          onSortModelChange={handleSortChange}
          checkboxSelection={showActions}
          rowSelectionModel={selectedCourseIds}
          onRowSelectionModelChange={handleSelectionChange}
          disableRowSelectionOnClick
          onRowClick={onCourseSelect ? handleRowClick : undefined}
          sx={{
            border: 0,
            '& .MuiDataGrid-cell:focus': {
              outline: 'none',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: 'action.hover',
            },
          }}
          aria-label="Course management table"
          getRowId={(row) => row.id}
          slots={{
            noRowsOverlay: () => (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  p: 3,
                }}
              >
                <Typography variant="h6" color="text.secondary">
                  No courses found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try adjusting your search or filter criteria
                </Typography>
              </Box>
            ),
          }}
        />
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={dialogState.deleteConfirm}
        onClose={handleCloseDeleteDialog}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">Delete Course</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete the course{' '}
            <strong>{courseToDelete?.fullname}</strong>? This action is permanent and cannot
            be undone. All course content, enrollments, and grades will be deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            startIcon={deleteMutation.isPending ? <CircularProgress size={16} /> : null}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={dialogState.bulkDeleteConfirm}
        onClose={handleCloseBulkDeleteDialog}
        aria-labelledby="bulk-delete-dialog-title"
        aria-describedby="bulk-delete-dialog-description"
      >
        <DialogTitle id="bulk-delete-dialog-title">Delete Multiple Courses</DialogTitle>
        <DialogContent>
          <DialogContentText id="bulk-delete-dialog-description">
            Are you sure you want to delete <strong>{selectedCoursesCount}</strong> course
            {selectedCoursesCount !== 1 ? 's' : ''}? This action is permanent and cannot be
            undone. All course content, enrollments, and grades will be deleted.
          </DialogContentText>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This operation will permanently delete all selected courses and their data.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseBulkDeleteDialog}
            disabled={bulkDeleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmBulkDelete}
            color="error"
            variant="contained"
            disabled={bulkDeleteMutation.isPending}
            startIcon={bulkDeleteMutation.isPending ? <CircularProgress size={16} /> : null}
          >
            {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete All'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move Category Dialog */}
      <Dialog
        open={dialogState.moveCategoryDialog}
        onClose={handleCloseMoveCategoryDialog}
        aria-labelledby="move-category-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="move-category-dialog-title">Move Courses to Category</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Select a target category for the <strong>{selectedCoursesCount}</strong> selected
            course{selectedCoursesCount !== 1 ? 's' : ''}.
          </Typography>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel id="target-category-label">Target Category</InputLabel>
            <Select
              labelId="target-category-label"
              value={targetCategoryId}
              label="Target Category"
              onChange={(e) => setTargetCategoryId(e.target.value as number | '')}
              aria-label="Select target category"
            >
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {'—'.repeat(category.depth)} {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseMoveCategoryDialog}
            disabled={bulkMoveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmMoveCategory}
            color="primary"
            variant="contained"
            disabled={bulkMoveMutation.isPending || targetCategoryId === ''}
            startIcon={bulkMoveMutation.isPending ? <CircularProgress size={16} /> : null}
          >
            {bulkMoveMutation.isPending ? 'Moving...' : 'Move'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CourseManagement;
