/**
 * Glossary Entry List Component
 *
 * React component for rendering paginated lists of glossary entries with search functionality,
 * sort options, and filtering capabilities. Displays entries as clickable Material-UI Cards
 * showing concept and definition preview, integrates with React Query for data fetching and
 * implements pagination controls based on glossary configuration.
 *
 * This component references:
 * - public/mod/glossary/view.php lines 68-79 for pagination logic
 * - public/mod/glossary/view.php lines 151-159 for sort key validation
 * - public/mod/glossary/lib.php for data fetching modes
 *
 * Features:
 * - Paginated entry display using Material-UI Grid layout
 * - Debounced search functionality for filtering entries
 * - Sort controls (sortkey and sortorder) with dropdown and toggle
 * - Empty state with permission-based "Add Entry" button
 * - Loading skeleton placeholders during data fetch
 * - Clickable entry cards for navigation to detail view
 * - Responsive card design with concept, definition preview, and metadata
 *
 * @module features/activities/glossary/components
 */

import type React from 'react';
import { useState, useEffect, useMemo } from 'react';
import type {
  SelectChangeEvent} from '@mui/material';
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Pagination,
  Button,
  IconButton,
  Skeleton,
  InputAdornment
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';

// Internal imports from depends_on_files
import type { GlossaryEntry } from '../types/glossary.types';
import { stripHtml } from '@/utils/string';
import { formatRelativeTime } from '@/utils/date';
import useDebounce from '@/hooks/useDebounce';
import { usePermissions } from '@/hooks/usePermissions';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Sort key options for glossary entries
 * Based on public/mod/glossary/view.php lines 151-159
 */
export type GlossarySortKey = 'CREATION' | 'UPDATE' | 'FIRSTNAME' | 'LASTNAME';

/**
 * Sort order options
 */
export type GlossarySortOrder = 'ASC' | 'DESC';

/**
 * Pagination configuration for entry list
 * Based on public/mod/glossary/view.php lines 68-79
 */
export interface PaginationConfig {
  /** Current offset for pagination (entries to bypass) */
  offset: number;
  /** Maximum entries per page (from glossary.entbypage or CFG->glossary_entbypage) */
  limit: number;
  /** Total number of entries available */
  total: number;
  /** Current page number (calculated from offset) */
  page: number;
}

/**
 * Filter configuration for entry list
 */
export interface EntryFilters {
  /** Browse mode: term, entry, cat, date, letter, search, author, approval */
  mode: string;
  /** The term, entry, cat, etc. to look for based on mode */
  hook: string;
  /** Sort key for ordering entries */
  sortkey: GlossarySortKey | '';
  /** Sort order (ascending or descending) */
  sortorder: GlossarySortOrder;
}

/**
 * Props for EntryList component
 */
export interface EntryListProps {
  /** Array of glossary entries to display */
  entries: GlossaryEntry[];
  /** Loading state while fetching entries */
  loading: boolean;
  /** Pagination configuration */
  pagination: PaginationConfig;
  /** Current filter settings */
  filters: EntryFilters;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback when an entry is selected */
  onEntrySelect: (entry: GlossaryEntry) => void;
  /** Callback when search query changes */
  onSearchChange?: (searchQuery: string) => void;
  /** Callback when sort settings change */
  onSortChange?: (sortkey: GlossarySortKey | '', sortorder: GlossarySortOrder) => void;
  /** Callback when "Add Entry" button is clicked */
  onAddEntry?: () => void;
  /** Glossary ID for permission checking */
  glossaryId?: number;
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * EntryList Component
 *
 * Displays a paginated, searchable, and sortable list of glossary entries
 * using Material-UI components. Integrates with permission system to show
 * appropriate actions based on user capabilities.
 */
export function EntryList({
  entries,
  loading,
  pagination,
  filters,
  onPageChange,
  onEntrySelect,
  onSearchChange,
  onSortChange,
  onAddEntry,
  glossaryId: _glossaryId,
}: EntryListProps): JSX.Element {
  // ============================================================================
  // State Management
  // ============================================================================

  // Local search query state (debounced before triggering callback)
  const [searchQuery, setSearchQuery] = useState<string>(filters.hook || '');
  
  // Debounce search query to prevent excessive callback invocations
  // Reference: useDebounce hook with default 500ms delay
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // ============================================================================
  // Permissions
  // ============================================================================

  // Check if user has capability to write/add entries
  // Reference: public/mod/glossary/lib.php - glossary_user_can_post()
  const { hasCapability } = usePermissions();
  const canAddEntry = hasCapability('mod/glossary:write');

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Trigger search callback when debounced query changes
   * Prevents API requests during rapid typing
   */
  useEffect(() => {
    if (onSearchChange && debouncedSearchQuery !== filters.hook) {
      onSearchChange(debouncedSearchQuery);
    }
  }, [debouncedSearchQuery, onSearchChange, filters.hook]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  /**
   * Calculate total number of pages
   * Reference: public/mod/glossary/view.php lines 73-75
   * Page calculation: page = offset / entriesbypage
   */
  const pageCount = useMemo(() => {
    if (pagination.limit === 0) {
      return 1; // No pagination (pagelimit = 0 shows all)
    }
    return Math.ceil(pagination.total / pagination.limit);
  }, [pagination.total, pagination.limit]);

  /**
   * Current page number (1-indexed for Material-UI Pagination)
   * Convert from 0-indexed offset to 1-indexed page number
   */
  const currentPage = useMemo(() => {
    if (pagination.limit === 0) {
      return 1;
    }
    return pagination.page + 1; // Add 1 for 1-indexed display
  }, [pagination.page, pagination.limit]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle search input changes
   * Updates local state immediately for responsive UI
   */
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  /**
   * Handle page change from pagination component
   * Converts 1-indexed page to 0-indexed for callback
   */
  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    onPageChange(page - 1); // Convert back to 0-indexed
  };

  /**
   * Handle sort key selection change
   */
  const handleSortKeyChange = (event: SelectChangeEvent<GlossarySortKey | ''>) => {
    const newSortKey = event.target.value as GlossarySortKey | '';
    if (onSortChange) {
      onSortChange(newSortKey, filters.sortorder);
    }
  };

  /**
   * Toggle sort order between ASC and DESC
   * Reference: public/mod/glossary/view.php lines 146-150
   */
  const handleSortOrderToggle = () => {
    if (onSortChange) {
      const newSortOrder: GlossarySortOrder = filters.sortorder === 'ASC' ? 'DESC' : 'ASC';
      onSortChange(filters.sortkey, newSortOrder);
    }
  };

  /**
   * Handle entry card click
   * Navigates to entry detail view
   */
  const handleEntryClick = (entry: GlossaryEntry) => {
    onEntrySelect(entry);
  };

  /**
   * Handle "Add Entry" button click
   */
  const handleAddEntry = () => {
    if (onAddEntry) {
      onAddEntry();
    }
  };

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Get definition preview text
   * Strips HTML tags and truncates to first 200 characters
   * Reference: public/mod/glossary/view.php - definition display
   */
  const getDefinitionPreview = (definition: string): string => {
    const plainText = stripHtml(definition);
    const maxLength = 200;
    
    if (plainText.length <= maxLength) {
      return plainText;
    }
    
    return `${plainText.substring(0, maxLength).trim()  }...`;
  };

  /**
   * Format entry metadata (author and date)
   * Uses relative time for better UX
   */
  const formatEntryMetadata = (entry: GlossaryEntry): string => {
    const authorName = entry.userfullname || 'Unknown';
    const timeLabel = formatRelativeTime(entry.timemodified * 1000); // Convert Unix timestamp to milliseconds
    return `${authorName} · ${timeLabel}`;
  };

  // ============================================================================
  // Render: Loading State
  // ============================================================================

  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        {/* Search and sort controls skeleton */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
          <Skeleton variant="rectangular" width="100%" height={56} />
          <Skeleton variant="rectangular" width={200} height={56} />
          <Skeleton variant="circular" width={48} height={48} />
        </Box>

        {/* Entry cards skeleton */}
        <Grid container spacing={2}>
          {Array.from({ length: 6 }).map((_, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" height={32} />
                  <Skeleton variant="text" width="100%" />
                  <Skeleton variant="text" width="100%" />
                  <Skeleton variant="text" width="80%" />
                  <Skeleton variant="text" width="40%" sx={{ mt: 1 }} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  // ============================================================================
  // Render: Empty State
  // ============================================================================

  if (entries.length === 0) {
    return (
      <Box sx={{ width: '100%' }}>
        {/* Show search controls even in empty state */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search entries..."
            value={searchQuery}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1, minWidth: 200 }}
          />
        </Box>

        {/* Empty state message */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 8,
            px: 2,
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No entries found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            {searchQuery
              ? 'Try adjusting your search criteria or filters'
              : 'This glossary does not have any entries yet'}
          </Typography>

          {/* Show "Add Entry" button if user has write permission */}
          {canAddEntry && onAddEntry && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddEntry}
            >
              Add Entry
            </Button>
          )}
        </Box>
      </Box>
    );
  }

  // ============================================================================
  // Render: Main Content
  // ============================================================================

  return (
    <Box sx={{ width: '100%' }}>
      {/* Search and Sort Controls */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search Field */}
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search entries..."
          value={searchQuery}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ flex: 1, minWidth: 200 }}
        />

        {/* Sort Key Select */}
        <FormControl variant="outlined" sx={{ minWidth: 180 }}>
          <InputLabel id="sort-key-label">Sort by</InputLabel>
          <Select
            labelId="sort-key-label"
            id="sort-key-select"
            value={filters.sortkey || ''}
            onChange={handleSortKeyChange}
            label="Sort by"
          >
            <MenuItem value="">
              <em>Default</em>
            </MenuItem>
            <MenuItem value="CREATION">Date Created</MenuItem>
            <MenuItem value="UPDATE">Date Modified</MenuItem>
            <MenuItem value="FIRSTNAME">First Name</MenuItem>
            <MenuItem value="LASTNAME">Last Name</MenuItem>
          </Select>
        </FormControl>

        {/* Sort Order Toggle */}
        <IconButton
          onClick={handleSortOrderToggle}
          color="primary"
          aria-label={`Sort order: ${filters.sortorder === 'ASC' ? 'Ascending' : 'Descending'}`}
          title={`Sort order: ${filters.sortorder === 'ASC' ? 'Ascending' : 'Descending'}`}
        >
          {filters.sortorder === 'ASC' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
        </IconButton>
      </Box>

      {/* Entry Cards Grid */}
      <Grid container spacing={2}>
        {entries.map((entry) => (
          <Grid item xs={12} sm={6} md={4} key={entry.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
            >
              <CardActionArea
                onClick={() => handleEntryClick(entry)}
                sx={{ flexGrow: 1, display: 'flex', alignItems: 'flex-start' }}
              >
                <CardContent sx={{ width: '100%' }}>
                  {/* Concept (Entry Title) */}
                  <Typography
                    variant="h6"
                    component="h3"
                    gutterBottom
                    sx={{
                      fontWeight: 600,
                      color: 'primary.main',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {entry.concept}
                  </Typography>

                  {/* Definition Preview */}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      minHeight: 60,
                    }}
                  >
                    {getDefinitionPreview(entry.definition)}
                  </Typography>

                  {/* Metadata (Author and Date) */}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: 'block',
                      fontStyle: 'italic',
                    }}
                  >
                    {formatEntryMetadata(entry)}
                  </Typography>

                  {/* Approval Status Badge (if not approved) */}
                  {!entry.approved && (
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'inline-block',
                        mt: 1,
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        backgroundColor: 'warning.light',
                        color: 'warning.dark',
                        fontWeight: 600,
                      }}
                    >
                      Pending Approval
                    </Typography>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Pagination Controls */}
      {pageCount > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={pageCount}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            size="large"
            showFirstButton
            showLastButton
            siblingCount={1}
            boundaryCount={1}
          />
        </Box>
      )}

      {/* Add Entry Button (bottom of page) */}
      {canAddEntry && onAddEntry && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddEntry}
          >
            Add Entry
          </Button>
        </Box>
      )}
    </Box>
  );
}
