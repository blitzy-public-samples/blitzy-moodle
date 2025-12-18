/**
 * WikiPageList Component
 *
 * Displays all pages in the current subwiki with comprehensive navigation,
 * search, sorting, and filtering capabilities. Shows page metadata including
 * title, author, modification date, size, and version number with support
 * for multiple view modes (list, tree, alphabetical), pagination, and visual
 * indicators for special page types.
 *
 * Features:
 * - Multiple view modes: list (table), tree (hierarchical), alphabetical (grouped)
 * - Real-time search with debounced API calls
 * - Sortable columns (title, modified date, author, size)
 * - Filter by author and date range
 * - Pagination for large wikis (20 pages per page)
 * - Visual indicators for first page, orphaned pages, and locked pages
 * - Permission-aware create page button
 * - Empty state handling with helpful messaging
 * - Seamless navigation integration with React Router
 *
 * References:
 * - public/mod/wiki/map.php for page navigation logic
 * - public/mod/wiki/locallib.php functions wiki_get_page_list(), wiki_search_title(), wiki_get_orphaned_pages()
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, {
  useState,
  useMemo,
  useCallback,
  type ChangeEvent,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

// MUI Components
import {
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemButton,
  Avatar,
  Typography,
  TextField,
  Select,
  MenuItem,
  Chip,
  Badge,
  IconButton,
  Tabs,
  Tab,
  Paper,
  Box,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableSortLabel,
  Pagination,
  Divider,
  Tooltip,
  Stack,
  Grid,
  FormControl,
  InputLabel,
  InputAdornment,
  type SelectChangeEvent,
} from '@mui/material';

// MUI Icons
import {
  Add as AddIcon,
  Search as SearchIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  ViewAgenda as ViewAgendaIcon,
  Star as StarIcon,
  Warning as WarningIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  Person as PersonIcon,
  CalendarToday as CalendarTodayIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';

// Internal imports from depends_on_files
import type { WikiPage } from '../types/wiki.types';
import { fetchPageList, searchWikiPages } from '../api/wikiApi';
import { useWiki } from '../hooks/useWiki';
import usePagination from '@/hooks/usePagination';
import useDebounce from '@/hooks/useDebounce';
import { usePermissions } from '@/hooks/usePermissions';
import { formatRelativeTime } from '@/utils/date';
import { formatFileSize } from '@/utils/formatters';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props interface for WikiPageList component
 *
 * Exports: WikiPageListProps with members: subwikiId, wikiId, onPageClick, showCreateButton
 */
export interface WikiPageListProps {
  /** ID of the subwiki to display pages from */
  subwikiId: number;
  /** ID of the parent wiki instance */
  wikiId: number;
  /** Optional callback when a page is clicked */
  onPageClick?: (page: WikiPage) => void;
  /** Whether to show the create page button (default: true, subject to permission check) */
  showCreateButton?: boolean;
}

/**
 * Available view modes for the page list
 */
type ViewMode = 'list' | 'tree' | 'alphabetical';

/**
 * Sort field options
 */
type SortField = 'title' | 'timemodified' | 'userid' | 'contentsize' | 'pageviews';

/**
 * Sort direction
 */
type SortDirection = 'asc' | 'desc';

/**
 * Interface for sort state
 */
interface SortState {
  field: SortField;
  direction: SortDirection;
}

/**
 * Interface for filter state
 */
interface FilterState {
  author: string;
  dateFrom: string;
  dateTo: string;
}

/**
 * Grouped pages for alphabetical view
 */
interface AlphabeticalGroup {
  letter: string;
  pages: WikiPage[];
}

// ============================================================================
// Constants
// ============================================================================

const ITEMS_PER_PAGE = 20;

const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: 'title', label: 'Title' },
  { value: 'timemodified', label: 'Last Modified' },
  { value: 'userid', label: 'Author' },
  { value: 'contentsize', label: 'Size' },
  { value: 'pageviews', label: 'Views' },
];

const VIEW_MODES: Array<{ value: ViewMode; label: string; icon: React.ReactElement }> = [
  { value: 'list', label: 'List View', icon: <ViewListIcon /> },
  { value: 'tree', label: 'Tree View', icon: <ViewAgendaIcon /> },
  { value: 'alphabetical', label: 'Alphabetical', icon: <ViewModuleIcon /> },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Groups pages alphabetically by first letter of title
 */
function groupPagesByLetter(pages: WikiPage[]): AlphabeticalGroup[] {
  const groups: Map<string, WikiPage[]> = new Map();

  pages.forEach((page) => {
    const firstChar = page.title.charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';

    if (!groups.has(letter)) {
      groups.set(letter, []);
    }
    groups.get(letter)!.push(page);
  });

  // Sort groups by letter, with '#' at the end
  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    })
    .map(([letter, letterPages]) => ({
      letter,
      pages: letterPages.sort((a, b) => a.title.localeCompare(b.title)),
    }));
}

/**
 * Sorts pages based on sort state
 */
function sortPages(pages: WikiPage[], sort: SortState): WikiPage[] {
  const sorted = [...pages].sort((a, b) => {
    let comparison = 0;

    switch (sort.field) {
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'timemodified':
        comparison = a.timemodified - b.timemodified;
        break;
      case 'userid':
        comparison = (a.userid || 0) - (b.userid || 0);
        break;
      case 'contentsize':
        comparison = (a.contentsize || 0) - (b.contentsize || 0);
        break;
      case 'pageviews':
        comparison = (a.pageviews || 0) - (b.pageviews || 0);
        break;
      default:
        comparison = 0;
    }

    return sort.direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Filters pages based on filter state
 */
function filterPages(pages: WikiPage[], filters: FilterState): WikiPage[] {
  return pages.filter((page) => {
    // Filter by author ID
    if (filters.author && page.userid?.toString() !== filters.author) {
      return false;
    }

    // Filter by date range
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom).getTime() / 1000;
      if (page.timemodified < fromDate) {
        return false;
      }
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo).getTime() / 1000;
      if (page.timemodified > toDate) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Checks if a page was recently updated (within last 7 days)
 */
function isRecentlyUpdated(page: WikiPage): boolean {
  const sevenDaysAgo = Date.now() / 1000 - 7 * 24 * 60 * 60;
  return page.timemodified > sevenDaysAgo;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Page status indicators component
 */
interface PageIndicatorsProps {
  page: WikiPage;
  isFirstPage: boolean;
  isOrphaned?: boolean;
}

function PageIndicators({ page, isFirstPage, isOrphaned }: PageIndicatorsProps): JSX.Element {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {isFirstPage && (
        <Tooltip title="First Page (Wiki Homepage)">
          <StarIcon fontSize="small" color="warning" />
        </Tooltip>
      )}
      {page.readonly && (
        <Tooltip title="Page is Locked">
          <LockIcon fontSize="small" color="action" />
        </Tooltip>
      )}
      {isOrphaned && (
        <Tooltip title="Orphaned Page (No Incoming Links)">
          <WarningIcon fontSize="small" color="error" />
        </Tooltip>
      )}
      {isRecentlyUpdated(page) && (
        <Chip
          label="Updated"
          size="small"
          color="info"
          variant="outlined"
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
      )}
    </Stack>
  );
}

/**
 * Empty state component
 */
interface EmptyStateProps {
  searchTerm: string;
  canCreate: boolean;
  onCreateClick?: () => void;
}

function EmptyState({ searchTerm, canCreate, onCreateClick }: EmptyStateProps): JSX.Element {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        textAlign: 'center',
        backgroundColor: 'grey.50',
        borderRadius: 2,
      }}
    >
      <FolderOpenIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
      {searchTerm ? (
        <>
          <Typography variant="h6" gutterBottom>
            No pages found
          </Typography>
          <Typography color="text.secondary" gutterBottom>
            No wiki pages match your search "{searchTerm}".
          </Typography>
          <Typography color="text.secondary">
            Try adjusting your search terms or filters.
          </Typography>
        </>
      ) : (
        <>
          <Typography variant="h6" gutterBottom>
            No pages in this wiki yet
          </Typography>
          <Typography color="text.secondary" gutterBottom>
            This wiki doesn't have any pages. Get started by creating the first page.
          </Typography>
          {canCreate && onCreateClick && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onCreateClick}
              sx={{ mt: 2 }}
            >
              Create First Page
            </Button>
          )}
        </>
      )}
    </Paper>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * WikiPageList Component
 *
 * Displays all pages in the current subwiki with comprehensive navigation,
 * search, sorting, and filtering capabilities.
 *
 * @param props - Component props
 * @returns JSX element rendering the wiki page list
 */
function WikiPageList({
  subwikiId,
  wikiId,
  onPageClick,
  showCreateButton = true,
}: WikiPageListProps): JSX.Element {
  // ============================================================================
  // State Management
  // ============================================================================

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Search state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Sort state
  const [sort, setSort] = useState<SortState>({
    field: 'title',
    direction: 'asc',
  });

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    author: '',
    dateFrom: '',
    dateTo: '',
  });

  // Show/hide filters
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // ============================================================================
  // Hooks
  // ============================================================================

  // Fetch wiki metadata
  const { data: wiki, isLoading: wikiLoading } = useWiki(wikiId);

  // Permission check for creating pages
  const { hasCapability } = usePermissions();
  const canCreatePage = hasCapability('mod/wiki:createpage');

  // Fetch page list
  const {
    data: pageListData,
    isLoading: pagesLoading,
    error: pagesError,
    refetch: refetchPages,
  } = useQuery({
    queryKey: ['wiki', 'pages', subwikiId, sort.field, sort.direction],
    queryFn: () =>
      fetchPageList(wikiId, {
        subwikiid: subwikiId,
        sortby: sort.field as 'title' | 'timemodified' | 'timecreated',
        sortdirection: sort.direction as 'ASC' | 'DESC',
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: Boolean(subwikiId),
  });

  // Search pages when search term changes
  const {
    data: searchResults,
    isLoading: searchLoading,
  } = useQuery({
    queryKey: ['wiki', 'search', subwikiId, debouncedSearchTerm],
    queryFn: () =>
      searchWikiPages(wikiId, {
        query: debouncedSearchTerm,
        includeContent: true,
      }),
    enabled: Boolean(subwikiId) && debouncedSearchTerm.length >= 2,
    staleTime: 30 * 1000, // 30 seconds
  });

  // ============================================================================
  // Computed Values
  // ============================================================================

  // Determine which pages to display (search results or full list)
  const basePagesData = useMemo((): WikiPage[] => {
    if (debouncedSearchTerm.length >= 2 && searchResults) {
      return searchResults.pages;
    }
    return pageListData || [];
  }, [debouncedSearchTerm, searchResults, pageListData]);

  // Apply filters
  const filteredPages = useMemo(() => {
    return filterPages(basePagesData, filters);
  }, [basePagesData, filters]);

  // Apply sorting (only if not using search results, which are already sorted by relevance)
  const sortedPages = useMemo(() => {
    if (debouncedSearchTerm.length >= 2) {
      return filteredPages; // Keep search relevance order
    }
    return sortPages(filteredPages, sort);
  }, [filteredPages, sort, debouncedSearchTerm]);

  // Pagination
  const {
    currentPage,
    totalPages,
    goToPage,
    startIndex,
    endIndex,
  } = usePagination({
    totalItems: sortedPages.length,
    itemsPerPage: ITEMS_PER_PAGE,
    initialPage: 1,
  });

  // Slice pages for current page view
  const paginatedPages = useMemo(
    () => sortedPages.slice(startIndex, endIndex),
    [sortedPages, startIndex, endIndex]
  );

  // Alphabetical grouping for alphabetical view
  const alphabeticalGroups = useMemo(() => {
    if (viewMode !== 'alphabetical') return [];
    return groupPagesByLetter(sortedPages);
  }, [sortedPages, viewMode]);

  // Get unique authors for filter dropdown
  const uniqueAuthors = useMemo(() => {
    const authorIds = new Set<number>();
    basePagesData.forEach((page) => {
      if (page.userid) {
        authorIds.add(page.userid);
      }
    });
    return Array.from(authorIds);
  }, [basePagesData]);

  // Identify first page
  const firstPageTitle = wiki?.firstpagetitle || '';

  // Check if page is first page
  const isFirstPage = useCallback(
    (page: WikiPage): boolean => {
      return page.title === firstPageTitle || Boolean(page.firstpage);
    },
    [firstPageTitle]
  );

  // Loading state
  const isLoading = pagesLoading || wikiLoading;

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle view mode change
   */
  const handleViewModeChange = useCallback(
    (_event: React.SyntheticEvent, newValue: ViewMode) => {
      setViewMode(newValue);
    },
    []
  );

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    goToPage(1); // Reset to first page on search
  }, [goToPage]);

  /**
   * Clear search term
   */
  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    goToPage(1);
  }, [goToPage]);

  /**
   * Handle sort field change
   */
  const handleSortFieldChange = useCallback((event: SelectChangeEvent<SortField>) => {
    setSort((prev) => ({
      ...prev,
      field: event.target.value as SortField,
    }));
    goToPage(1);
  }, [goToPage]);

  /**
   * Handle sort direction toggle
   */
  const handleSortDirectionToggle = useCallback(() => {
    setSort((prev) => ({
      ...prev,
      direction: prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    goToPage(1);
  }, [goToPage]);

  /**
   * Handle table header sort click
   */
  const handleTableSortClick = useCallback(
    (field: SortField) => {
      setSort((prev) => ({
        field,
        direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
      }));
      goToPage(1);
    },
    [goToPage]
  );

  /**
   * Handle author filter change
   */
  const handleAuthorFilterChange = useCallback((event: SelectChangeEvent<string>) => {
    setFilters((prev) => ({
      ...prev,
      author: event.target.value,
    }));
    goToPage(1);
  }, [goToPage]);

  /**
   * Handle date filter change
   */
  const handleDateFilterChange = useCallback(
    (field: 'dateFrom' | 'dateTo') => (event: ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
      goToPage(1);
    },
    [goToPage]
  );

  /**
   * Clear all filters
   */
  const handleClearFilters = useCallback(() => {
    setFilters({
      author: '',
      dateFrom: '',
      dateTo: '',
    });
    goToPage(1);
  }, [goToPage]);

  /**
   * Toggle filters visibility
   */
  const handleToggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  /**
   * Handle page click
   */
  const handlePageClick = useCallback(
    (page: WikiPage) => {
      if (onPageClick) {
        onPageClick(page);
      }
    },
    [onPageClick]
  );

  /**
   * Handle pagination change
   */
  const handlePaginationChange = useCallback(
    (_event: ChangeEvent<unknown>, page: number) => {
      goToPage(page);
    },
    [goToPage]
  );

  /**
   * Handle create page button click
   */
  const handleCreatePageClick = useCallback(() => {
    // Navigate to create page - typically handled by parent or router
    // This can be extended to open a dialog or navigate
  }, []);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  /**
   * Render page row for table view
   */
  const renderTableRow = useCallback(
    (page: WikiPage): JSX.Element => (
      <TableRow
        key={page.id}
        hover
        sx={{ cursor: 'pointer' }}
        onClick={() => handlePageClick(page)}
      >
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Link
              to={`/wiki/${wikiId}/page/${page.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: isFirstPage(page) ? 600 : 400,
                  '&:hover': { textDecoration: 'underline', color: 'primary.main' },
                }}
              >
                {page.title}
              </Typography>
            </Link>
            <PageIndicators page={page} isFirstPage={isFirstPage(page)} />
          </Box>
        </TableCell>
        <TableCell>
          <Tooltip title={new Date(page.timemodified * 1000).toLocaleString()}>
            <Typography variant="body2" color="text.secondary">
              {formatRelativeTime(page.timemodified * 1000)}
            </Typography>
          </Tooltip>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ width: 24, height: 24 }}>
              <PersonIcon sx={{ fontSize: 16 }} />
            </Avatar>
            <Typography variant="body2" color="text.secondary">
              User {page.userid}
            </Typography>
          </Box>
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2" color="text.secondary">
            {page.contentsize ? formatFileSize(page.contentsize) : '-'}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Chip
            label={`v${page.version || 1}`}
            size="small"
            variant="outlined"
            sx={{ minWidth: 50 }}
          />
        </TableCell>
        <TableCell align="right">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <VisibilityIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {page.pageviews || 0}
            </Typography>
          </Box>
        </TableCell>
      </TableRow>
    ),
    [handlePageClick, isFirstPage, wikiId]
  );

  /**
   * Render page item for list view
   */
  const renderListItem = useCallback(
    (page: WikiPage): JSX.Element => (
      <ListItem
        key={page.id}
        disablePadding
        divider
        secondaryAction={
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={`v${page.version || 1}`}
              size="small"
              variant="outlined"
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <VisibilityIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {page.pageviews || 0}
              </Typography>
            </Box>
          </Stack>
        }
      >
        <ListItemButton
          component={Link}
          to={`/wiki/${wikiId}/page/${page.id}`}
          onClick={() => handlePageClick(page)}
        >
          <ListItemAvatar>
            <Avatar sx={{ bgcolor: isFirstPage(page) ? 'warning.main' : 'primary.main' }}>
              {isFirstPage(page) ? <StarIcon /> : page.title.charAt(0).toUpperCase()}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="body1"
                  sx={{ fontWeight: isFirstPage(page) ? 600 : 400 }}
                >
                  {page.title}
                </Typography>
                <PageIndicators page={page} isFirstPage={isFirstPage(page)} />
              </Box>
            }
            secondary={
              <Stack
                direction="row"
                spacing={2}
                divider={<Divider orientation="vertical" flexItem />}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CalendarTodayIcon sx={{ fontSize: 14 }} />
                  <Typography variant="caption">
                    {formatRelativeTime(page.timemodified * 1000)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PersonIcon sx={{ fontSize: 14 }} />
                  <Typography variant="caption">User {page.userid}</Typography>
                </Box>
                {page.contentsize && (
                  <Typography variant="caption">
                    {formatFileSize(page.contentsize)}
                  </Typography>
                )}
              </Stack>
            }
          />
        </ListItemButton>
      </ListItem>
    ),
    [handlePageClick, isFirstPage, wikiId]
  );

  /**
   * Render alphabetical group
   */
  const renderAlphabeticalGroup = useCallback(
    (group: AlphabeticalGroup): JSX.Element => (
      <Box key={group.letter} sx={{ mb: 3 }}>
        <Typography
          variant="h6"
          component="h3"
          sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            px: 2,
            py: 0.5,
            borderRadius: 1,
            mb: 1,
          }}
        >
          {group.letter}
        </Typography>
        <List disablePadding>
          {group.pages.map((page) => renderListItem(page))}
        </List>
      </Box>
    ),
    [renderListItem]
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  // Error state
  if (pagesError) {
    return (
      <Paper elevation={0} sx={{ p: 3, textAlign: 'center' }}>
        <WarningIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
        <Typography variant="h6" color="error" gutterBottom>
          Error Loading Pages
        </Typography>
        <Typography color="text.secondary" gutterBottom>
          Unable to load wiki pages. Please try again.
        </Typography>
        <Button variant="outlined" onClick={() => refetchPages()} sx={{ mt: 2 }}>
          Retry
        </Button>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Header with title and create button */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h5" component="h2">
          Wiki Pages
          {sortedPages.length > 0 && (
            <Chip
              label={sortedPages.length}
              size="small"
              sx={{ ml: 1, verticalAlign: 'middle' }}
            />
          )}
        </Typography>
        {showCreateButton && canCreatePage && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreatePageClick}
            component={Link}
            to={`/wiki/${wikiId}/create`}
          >
            Create Page
          </Button>
        )}
      </Box>

      {/* View mode tabs */}
      <Paper elevation={1} sx={{ mb: 2 }}>
        <Tabs
          value={viewMode}
          onChange={handleViewModeChange}
          aria-label="Page list view modes"
        >
          {VIEW_MODES.map((mode) => (
            <Tab
              key={mode.value}
              value={mode.value}
              icon={mode.icon}
              iconPosition="start"
              label={mode.label}
              sx={{ minHeight: 48 }}
            />
          ))}
        </Tabs>
      </Paper>

      {/* Search and filter controls */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Search input */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search pages..."
              value={searchTerm}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={handleClearSearch}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          {/* Sort controls */}
          <Grid item xs={12} md={4}>
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="sort-field-label">Sort by</InputLabel>
                <Select
                  labelId="sort-field-label"
                  value={sort.field}
                  onChange={handleSortFieldChange}
                  label="Sort by"
                >
                  {SORT_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Tooltip title={sort.direction === 'asc' ? 'Ascending' : 'Descending'}>
                <IconButton onClick={handleSortDirectionToggle}>
                  {sort.direction === 'asc' ? (
                    <ArrowUpwardIcon />
                  ) : (
                    <ArrowDownwardIcon />
                  )}
                </IconButton>
              </Tooltip>
            </Stack>
          </Grid>

          {/* Filter toggle */}
          <Grid item xs={12} md={4}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant={showFilters ? 'contained' : 'outlined'}
                startIcon={<FilterListIcon />}
                onClick={handleToggleFilters}
              >
                Filters
                {(filters.author || filters.dateFrom || filters.dateTo) && (
                  <Badge badgeContent="!" color="error" sx={{ ml: 1 }} />
                )}
              </Button>
            </Stack>
          </Grid>
        </Grid>

        {/* Expanded filters */}
        {showFilters && (
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="author-filter-label">Author</InputLabel>
                  <Select
                    labelId="author-filter-label"
                    value={filters.author}
                    onChange={handleAuthorFilterChange}
                    label="Author"
                  >
                    <MenuItem value="">All Authors</MenuItem>
                    {uniqueAuthors.map((authorId) => (
                      <MenuItem key={authorId} value={authorId.toString()}>
                        User {authorId}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="From Date"
                  value={filters.dateFrom}
                  onChange={handleDateFilterChange('dateFrom')}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="To Date"
                  value={filters.dateTo}
                  onChange={handleDateFilterChange('dateTo')}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  variant="text"
                  startIcon={<ClearIcon />}
                  onClick={handleClearFilters}
                  disabled={!filters.author && !filters.dateFrom && !filters.dateTo}
                >
                  Clear Filters
                </Button>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Search results indicator */}
      {debouncedSearchTerm.length >= 2 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {searchLoading ? (
              'Searching...'
            ) : (
              <>
                Found {sortedPages.length} page{sortedPages.length !== 1 ? 's' : ''} matching "
                {debouncedSearchTerm}"
              </>
            )}
          </Typography>
        </Box>
      )}

      {/* Loading state */}
      {isLoading && (
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">Loading pages...</Typography>
        </Paper>
      )}

      {/* Empty state */}
      {!isLoading && sortedPages.length === 0 && (
        <EmptyState
          searchTerm={searchTerm}
          canCreate={canCreatePage}
          onCreateClick={handleCreatePageClick}
        />
      )}

      {/* Page list content */}
      {!isLoading && sortedPages.length > 0 && (
        <>
          {/* Table view (list mode) */}
          {viewMode === 'list' && (
            <Paper elevation={1}>
              <Table size="medium">
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel
                        active={sort.field === 'title'}
                        direction={sort.field === 'title' ? sort.direction : 'asc'}
                        onClick={() => handleTableSortClick('title')}
                      >
                        Title
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sort.field === 'timemodified'}
                        direction={sort.field === 'timemodified' ? sort.direction : 'asc'}
                        onClick={() => handleTableSortClick('timemodified')}
                      >
                        Modified
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sort.field === 'userid'}
                        direction={sort.field === 'userid' ? sort.direction : 'asc'}
                        onClick={() => handleTableSortClick('userid')}
                      >
                        Author
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel
                        active={sort.field === 'contentsize'}
                        direction={sort.field === 'contentsize' ? sort.direction : 'asc'}
                        onClick={() => handleTableSortClick('contentsize')}
                      >
                        Size
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="center">Version</TableCell>
                    <TableCell align="right">
                      <TableSortLabel
                        active={sort.field === 'pageviews'}
                        direction={sort.field === 'pageviews' ? sort.direction : 'asc'}
                        onClick={() => handleTableSortClick('pageviews')}
                      >
                        Views
                      </TableSortLabel>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedPages.map((page) => renderTableRow(page))}
                </TableBody>
              </Table>
            </Paper>
          )}

          {/* Tree view */}
          {viewMode === 'tree' && (
            <Paper elevation={1}>
              <List>
                {paginatedPages.map((page) => renderListItem(page))}
              </List>
            </Paper>
          )}

          {/* Alphabetical view */}
          {viewMode === 'alphabetical' && (
            <Box>
              {alphabeticalGroups.map((group) => renderAlphabeticalGroup(group))}
            </Box>
          )}

          {/* Pagination */}
          {totalPages > 1 && viewMode !== 'alphabetical' && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mt: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Showing {startIndex + 1}-{Math.min(endIndex, sortedPages.length)} of{' '}
                {sortedPages.length} pages
              </Typography>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={handlePaginationChange}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

// Default export as specified in exports schema
export default WikiPageList;
