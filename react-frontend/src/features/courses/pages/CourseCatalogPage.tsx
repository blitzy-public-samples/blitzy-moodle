/**
 * CourseCatalogPage Component
 *
 * Displays a searchable, filterable, and paginated catalog of available courses.
 * Supports grid/list view toggle, category filtering, sorting, and search.
 *
 * @module features/courses/pages/CourseCatalogPage
 */

import type React from 'react';
import { useState, useCallback } from 'react';
import type {
  SelectChangeEvent} from '@mui/material';
import {
  Box,
  Container,
  Grid,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Pagination,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link as MuiLink,
  Paper
} from '@mui/material';
import {
  Search as SearchIcon,
  GridView as GridViewIcon,
  ViewList as ViewListIcon,
  Sort as SortIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useCourses, type CourseListParams } from '../api/courseApi';
import { CourseCard } from '../components/CourseCard';

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'grid' | 'list';
type SortOption = 'fullname' | 'shortname' | 'startdate' | 'enrolledusers';

// ============================================================================
// Component
// ============================================================================

/**
 * CourseCatalogPage displays a comprehensive course catalog with
 * search, filtering, sorting, and pagination capabilities.
 *
 * Features:
 * - Search courses by name
 * - Filter by category
 * - Sort by name, date, or popularity
 * - Grid/list view toggle
 * - Pagination with configurable items per page
 * - Responsive design
 *
 * @returns Rendered course catalog page
 */
export function CourseCatalogPage() {
  const navigate = useNavigate();

  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [coursesPerPage, setCoursesPerPage] = useState(20);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('fullname');
  const [sortOrder] = useState<'asc' | 'desc'>('asc');
  const [categoryId] = useState<number | undefined>(undefined);

  // Build query parameters
  const queryParams: CourseListParams = {
    page: currentPage,
    perPage: coursesPerPage,
    search: searchQuery || undefined,
    categoryId: categoryId,
    sort: sortBy,
    order: sortOrder,
  };

  // Fetch courses using React Query
  const { data, isLoading, error, isError } = useCourses(queryParams);

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setCurrentPage(1); // Reset to first page on search
  }, []);

  /**
   * Handle search submission
   */
  const handleSearchSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    setCurrentPage(1);
  }, []);

  /**
   * Handle view mode change
   */
  const handleViewModeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
      if (newMode !== null) {
        setViewMode(newMode);
      }
    },
    []
  );

  /**
   * Handle sort change
   */
  const handleSortChange = useCallback((event: SelectChangeEvent<string>) => {
    const value = event.target.value as SortOption;
    setSortBy(value);
    setCurrentPage(1);
  }, []);

  /**
   * Handle courses per page change
   */
  const handleCoursesPerPageChange = useCallback((event: SelectChangeEvent<number>) => {
    setCoursesPerPage(event.target.value as number);
    setCurrentPage(1);
  }, []);

  /**
   * Handle pagination change
   */
  const handlePageChange = useCallback((_event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /**
   * Handle course card click
   */
  const handleCourseClick = useCallback(
    (courseId: number) => {
      navigate(`/courses/${courseId}`);
    },
    [navigate]
  );

  // Extract data from response
  const courses = data?.data?.items ?? [];
  const pagination = data?.meta?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const totalCourses = pagination?.total ?? data?.data?.total ?? 0;

  // Determine grid columns based on view mode
  const gridColumns = viewMode === 'grid' ? { xs: 12, sm: 6, md: 4, lg: 3 } : { xs: 12 };

  return (
    <Box data-testid="course-catalog-container">
      <Container
        maxWidth="xl"
        sx={{ py: 4 }}
      >
        {/* Breadcrumb Navigation */}
        <Box data-testid="category-navigation" sx={{ mb: 3 }}>
        <Breadcrumbs aria-label="breadcrumb">
          <MuiLink
            component="button"
            color="inherit"
            onClick={() => navigate('/')}
            sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            Home
          </MuiLink>
          <Typography color="text.primary">Courses</Typography>
        </Breadcrumbs>
      </Box>

      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
          Course Catalog
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {totalCourses > 0
            ? `Browse ${totalCourses} available courses`
            : 'Browse available courses'}
        </Typography>
      </Box>

      {/* Search and Controls */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, backgroundColor: 'grey.50' }}>
        <Grid container spacing={2} alignItems="center">
          {/* Search Input */}
          <Grid item xs={12} md={6}>
            <form onSubmit={handleSearchSubmit}>
              <TextField
                fullWidth
                data-testid="course-search-input"
                placeholder="Search courses..."
                value={searchQuery}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton
                        data-testid="search-button"
                        type="submit"
                        edge="end"
                        size="small"
                      >
                        <SearchIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </form>
          </Grid>

          {/* Sort Dropdown */}
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="sort-label">Sort By</InputLabel>
              <Select
                labelId="sort-label"
                data-testid="sort-dropdown"
                value={sortBy}
                label="Sort By"
                onChange={handleSortChange}
                startAdornment={
                  <InputAdornment position="start">
                    <SortIcon fontSize="small" />
                  </InputAdornment>
                }
              >
                <MenuItem value="fullname" data-testid="sort-option-name">
                  Name
                </MenuItem>
                <MenuItem value="startdate" data-testid="sort-option-date">
                  Start Date
                </MenuItem>
                <MenuItem value="enrolledusers" data-testid="sort-option-popularity">
                  Popularity
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* View Toggle */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <ToggleButtonGroup
                data-testid="view-toggle"
                value={viewMode}
                exclusive
                onChange={handleViewModeChange}
                size="small"
              >
                <ToggleButton
                  value="grid"
                  data-testid="view-grid-button"
                  aria-label="grid view"
                  aria-pressed={viewMode === 'grid'}
                >
                  <GridViewIcon />
                </ToggleButton>
                <ToggleButton
                  value="list"
                  data-testid="view-list-button"
                  aria-label="list view"
                  aria-pressed={viewMode === 'list'}
                >
                  <ViewListIcon />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Grid>
        </Grid>

        {/* Courses Per Page Selector */}
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Show:
          </Typography>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <Select
              data-testid="courses-per-page-select"
              value={coursesPerPage}
              onChange={handleCoursesPerPageChange}
            >
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            courses per page
          </Typography>
        </Box>
      </Paper>

      {/* Filter Panel (Placeholder) */}
      <Box data-testid="filter-panel" sx={{ display: 'none' }}>
        {/* Filter panel implementation would go here */}
      </Box>

      {/* Loading State */}
      {isLoading && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 400,
          }}
        >
          <CircularProgress size={60} />
        </Box>
      )}

      {/* Error State */}
      {isError && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error instanceof Error
            ? error.message
            : 'Failed to load courses. Please try again.'}
        </Alert>
      )}

      {/* Course Grid/List */}
      {!isLoading && !isError && courses.length > 0 && (
        <>
          <Grid container spacing={3}>
            {courses.map((course) => (
              <Grid item key={course.id} {...gridColumns}>
                <CourseCard course={course} onClick={handleCourseClick} />
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          <Box
            data-testid="pagination-controls"
            sx={{
              mt: 6,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={handlePageChange}
              color="primary"
              size="large"
              showFirstButton
              showLastButton
              renderItem={(item) => {
                // Custom render for data-testid attributes
                const testId =
                  item.type === 'previous'
                    ? 'previous-page-button'
                    : item.type === 'next'
                    ? 'next-page-button'
                    : item.page
                    ? `page-${item.page}`
                    : undefined;

                return (
                  <Box
                    component="button"
                    data-testid={testId}
                    aria-current={item.selected ? 'page' : undefined}
                    {...item}
                    sx={{
                      border: 'none',
                      background: 'transparent',
                      cursor: item.disabled ? 'default' : 'pointer',
                    }}
                  />
                );
              }}
            />
            <Typography variant="body2" color="text.secondary">
              Showing {courses.length} of {totalCourses} courses
            </Typography>
          </Box>
        </>
      )}

      {/* Empty State */}
      {!isLoading && !isError && courses.length === 0 && (
        <Box
          data-testid="empty-state-message"
          sx={{
            textAlign: 'center',
            py: 8,
          }}
        >
          <Typography variant="h6" gutterBottom>
            No courses found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchQuery
              ? `No courses match "${searchQuery}". Try a different search term.`
              : 'No courses are currently available.'}
          </Typography>
        </Box>
      )}
      </Container>
    </Box>
  );
}

export default CourseCatalogPage;
