/**
 * Header Component
 *
 * Main application header bar (AppBar) component for the Moodle React frontend.
 * Displays site branding, global search with autocomplete, notifications, theme toggle,
 * and user menu. Implements Material-UI AppBar with responsive design.
 *
 * Features:
 * - Sticky positioning with elevation change on scroll
 * - Left section: Menu toggle (hamburger), site logo/name
 * - Middle section: Global search with autocomplete suggestions
 * - Right section: Notifications badge, theme toggle, user menu
 * - Keyboard shortcut (Ctrl+K / Cmd+K) to focus search
 * - Responsive design: hides search bar on xs, shows search icon instead
 * - Proper z-index layering above Sidebar drawer
 * - Full accessibility with ARIA labels
 *
 * Architecture:
 * - Uses Redux for sidebar toggle and notifications state
 * - Uses React Query for search suggestions fetching
 * - Uses React Router for navigation to search results
 * - Uses MUI theme hooks for responsive breakpoints and theming
 *
 * @module components/navigation/Header
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  TextField,
  InputAdornment,
  Autocomplete,
  Badge,
  useScrollTrigger,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogContent,
  CircularProgress,
  Paper,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import type { AutocompleteChangeReason } from '@mui/material/Autocomplete';
import {
  Menu as MenuIcon,
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Brightness4 as Brightness4Icon,
  Brightness7 as Brightness7Icon,
  School as CourseIcon,
  Person as PersonIcon,
  Assignment as ActivityIcon,
} from '@mui/icons-material';

// Internal imports
import UserMenu from './UserMenu';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { toggleSidebar } from '@/app/slices/sidebarSlice';
import { appConfig } from '@/config/env';
import { SEARCH_ENDPOINTS } from '@/services/api/endpoints';
import apiClient from '@/services/api/client';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Header component props interface
 *
 * Provides optional callback for custom menu click handling.
 * If not provided, default behavior dispatches sidebar toggle action.
 */
export interface HeaderProps {
  /**
   * Optional callback fired when menu (hamburger) button is clicked.
   * If provided, overrides default sidebar toggle behavior.
   * Useful for custom navigation drawer handling or analytics tracking.
   */
  onMenuClick?: () => void;
}

/**
 * Search suggestion item interface
 *
 * Represents a single search result/suggestion from the API.
 * Used for autocomplete dropdown rendering.
 */
interface SearchSuggestion {
  /** Unique identifier for the suggestion */
  id: number;
  /** Display title/name of the item */
  title: string;
  /** Type of content (course, user, activity) */
  type: 'course' | 'user' | 'activity';
  /** Optional additional description or context */
  description?: string;
  /** URL path for navigation */
  url?: string;
}

/**
 * Search API response interface
 *
 * Standard API response envelope for search suggestions.
 */
interface SearchApiResponse {
  success: boolean;
  data: SearchSuggestion[];
}

// ============================================================================
// Constants
// ============================================================================

/** Minimum characters before triggering search */
const SEARCH_MIN_CHARS = 2;

/** Debounce delay for search input (ms) */
const SEARCH_DEBOUNCE_MS = 300;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get icon component for search suggestion type
 *
 * @param type - Type of the search suggestion
 * @returns MUI icon component for the type
 */
function getTypeIcon(type: SearchSuggestion['type']): React.ReactElement {
  switch (type) {
    case 'course':
      return <CourseIcon />;
    case 'user':
      return <PersonIcon />;
    case 'activity':
      return <ActivityIcon />;
    default:
      return <SearchIcon />;
  }
}

/**
 * Get display label for search suggestion type
 *
 * @param type - Type of the search suggestion
 * @returns Human-readable label for the type
 */
function getTypeLabel(type: SearchSuggestion['type']): string {
  switch (type) {
    case 'course':
      return 'Courses';
    case 'user':
      return 'Users';
    case 'activity':
      return 'Activities';
    default:
      return 'Other';
  }
}

// ============================================================================
// Custom Hooks
// ============================================================================

/**
 * Custom hook for debounced search value
 *
 * @param value - Value to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns Debounced value
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook for fetching search suggestions
 *
 * Uses React Query to fetch search suggestions from the API with:
 * - Automatic caching and deduplication
 * - Debounced query execution
 * - Loading and error state management
 *
 * @param query - Search query string
 * @returns React Query result with suggestions data
 */
function useSearchSuggestions(query: string) {
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);

  return useQuery<SearchSuggestion[]>({
    queryKey: ['searchSuggestions', debouncedQuery],
    queryFn: async (): Promise<SearchSuggestion[]> => {
      if (debouncedQuery.length < SEARCH_MIN_CHARS) {
        return [];
      }

      const response = await apiClient.get<SearchApiResponse>(
        SEARCH_ENDPOINTS.GLOBAL,
        {
          params: { q: debouncedQuery },
        }
      );

      return response.data.data || [];
    },
    enabled: debouncedQuery.length >= SEARCH_MIN_CHARS,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
  });
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * Header Component
 *
 * Main application header bar with site branding, global search, notifications,
 * theme toggle, and user menu. Implements Material-UI AppBar with responsive
 * design and accessibility features.
 *
 * Usage Example:
 * ```tsx
 * // Basic usage with default sidebar toggle
 * <Header />
 *
 * // With custom menu click handler
 * <Header onMenuClick={() => console.log('Menu clicked')} />
 *
 * // In layout component
 * function AppLayout({ children }) {
 *   return (
 *     <Box sx={{ display: 'flex' }}>
 *       <Header />
 *       <Sidebar />
 *       <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
 *         {children}
 *       </Box>
 *     </Box>
 *   );
 * }
 * ```
 *
 * @param props - Component props
 * @returns Header component with AppBar and navigation elements
 */
export default function Header({ onMenuClick }: HeaderProps): React.ReactElement {
  // ============================================================================
  // Hooks
  // ============================================================================

  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Responsive breakpoints
  const isXsScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const isSmScreen = useMediaQuery(theme.breakpoints.down('md'));

  // Scroll trigger for elevation change
  const scrollTrigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 0,
  });

  // Search input ref for keyboard shortcut focus
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Local state
  const [searchValue, setSearchValue] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState<boolean>(false);

  // Redux state
  // Note: Notification count could come from a notifications slice when implemented
  // For now, we check if the auth user has an extended property for notifications
  const notificationCount = useAppSelector(
    (state) => {
      const user = state.auth.user as (typeof state.auth.user & { unreadNotifications?: number }) | null;
      return user?.unreadNotifications ?? 0;
    }
  );
  const themeMode = useAppSelector(
    (state) => 'theme' in state 
      ? (state as { theme: { mode: string } }).theme.mode 
      : 'light'
  );

  // Search suggestions from React Query
  const {
    data: suggestions = [],
    isLoading: isSearchLoading,
  } = useSearchSuggestions(searchValue);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle menu button click
   * Dispatches sidebar toggle action or calls custom handler
   */
  const handleMenuClick = useCallback((): void => {
    if (onMenuClick) {
      onMenuClick();
    } else {
      dispatch(toggleSidebar());
    }
  }, [dispatch, onMenuClick]);

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback(
    (_event: React.SyntheticEvent, value: string): void => {
      setSearchValue(value);
    },
    []
  );

  /**
   * Handle search submission (Enter key)
   */
  const handleSearchSubmit = useCallback(
    (event: React.KeyboardEvent): void => {
      if (event.key === 'Enter' && searchValue.trim()) {
        navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
        setSearchValue('');
        setMobileSearchOpen(false);
      }
    },
    [navigate, searchValue]
  );

  /**
   * Handle search suggestion selection
   * Handles both SearchSuggestion objects and freeSolo string values
   */
  const handleSuggestionSelect = useCallback(
    (
      _event: React.SyntheticEvent,
      value: string | SearchSuggestion | null,
      _reason: AutocompleteChangeReason
    ): void => {
      // Handle freeSolo string input (user typed and pressed enter without selecting)
      if (typeof value === 'string') {
        if (value.trim()) {
          navigate(`/search?q=${encodeURIComponent(value.trim())}`);
          setSearchValue('');
          setMobileSearchOpen(false);
        }
        return;
      }

      // Handle SearchSuggestion object selection
      if (value?.url) {
        navigate(value.url);
        setSearchValue('');
        setMobileSearchOpen(false);
      } else if (value) {
        // Navigate based on type and id
        switch (value.type) {
          case 'course':
            navigate(`/courses/${value.id}`);
            break;
          case 'user':
            navigate(`/users/${value.id}`);
            break;
          case 'activity':
            navigate(`/activities/${value.id}`);
            break;
          default:
            navigate(`/search?q=${encodeURIComponent(value.title)}`);
        }
        setSearchValue('');
        setMobileSearchOpen(false);
      }
    },
    [navigate]
  );

  /**
   * Handle theme mode toggle
   * Dispatches theme toggle action if themeSlice exists
   */
  const handleThemeToggle = useCallback((): void => {
    // Theme toggle action would be dispatched here if themeSlice exists
    // For now, log to console as placeholder behavior
    // In production, this would dispatch: dispatch(toggleTheme())
    console.info('Theme toggle requested');
  }, []);

  /**
   * Handle notifications button click
   * Navigates to notifications page
   */
  const handleNotificationsClick = useCallback((): void => {
    navigate('/notifications');
  }, [navigate]);

  /**
   * Handle mobile search button click
   * Opens mobile search dialog
   */
  const handleMobileSearchClick = useCallback((): void => {
    setMobileSearchOpen(true);
  }, []);

  /**
   * Handle mobile search dialog close
   */
  const handleMobileSearchClose = useCallback((): void => {
    setMobileSearchOpen(false);
    setSearchValue('');
  }, []);

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Keyboard shortcut listener for search focus (Ctrl+K / Cmd+K)
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Check for Ctrl+K (Windows/Linux) or Cmd+K (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();

        if (isXsScreen) {
          // On mobile, open search dialog
          setMobileSearchOpen(true);
        } else {
          // On desktop, focus search input
          searchInputRef.current?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isXsScreen]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  /**
   * Render search autocomplete component
   */
  const renderSearchAutocomplete = (
    isMobile: boolean = false
  ): React.ReactElement => (
    <Autocomplete<SearchSuggestion, false, false, true>
      freeSolo
      options={suggestions}
      loading={isSearchLoading}
      open={isSearchOpen && searchValue.length >= SEARCH_MIN_CHARS}
      onOpen={() => setIsSearchOpen(true)}
      onClose={() => setIsSearchOpen(false)}
      inputValue={searchValue}
      onInputChange={handleSearchChange}
      onChange={handleSuggestionSelect}
      getOptionLabel={(option) =>
        typeof option === 'string' ? option : option.title
      }
      groupBy={(option) => getTypeLabel(option.type)}
      filterOptions={(options) => options} // Server-side filtering
      isOptionEqualToValue={(option, value) => option.id === value.id}
      renderInput={(params) => (
        <TextField
          {...params}
          inputRef={isMobile ? undefined : searchInputRef}
          placeholder="Search courses, users, activities..."
          size="small"
          onKeyDown={handleSearchSubmit}
          inputProps={{
            ...params.inputProps,
            'aria-label': 'Search Moodle',
          }}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <>
                {isSearchLoading ? (
                  <CircularProgress color="inherit" size={20} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.09)'
                : 'rgba(0, 0, 0, 0.04)',
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.13)'
                  : 'rgba(0, 0, 0, 0.08)',
              },
              '&.Mui-focused': {
                backgroundColor: theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.13)'
                  : 'rgba(0, 0, 0, 0.08)',
              },
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none',
            },
            minWidth: isMobile ? '100%' : { sm: 200, md: 300, lg: 400 },
          }}
        />
      )}
      renderOption={(props, option) => (
        <ListItem {...props} key={`${option.type}-${option.id}`}>
          <ListItemIcon sx={{ minWidth: 40 }}>
            {getTypeIcon(option.type)}
          </ListItemIcon>
          <ListItemText
            primary={option.title}
            secondary={option.description}
            primaryTypographyProps={{ noWrap: true }}
            secondaryTypographyProps={{ noWrap: true }}
          />
        </ListItem>
      )}
      PaperComponent={({ children, ...paperProps }) => (
        <Paper {...paperProps} elevation={8}>
          {children}
        </Paper>
      )}
      sx={{
        flexGrow: isMobile ? 1 : 0,
      }}
    />
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <>
      <AppBar
        position="sticky"
        elevation={scrollTrigger ? 4 : 0}
        role="banner"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          transition: theme.transitions.create(['box-shadow'], {
            duration: theme.transitions.duration.short,
          }),
        }}
      >
        <Toolbar
          sx={{
            px: { xs: 1, sm: 2 },
            gap: { xs: 0.5, sm: 1, md: 2 },
          }}
        >
          {/* Left Section: Menu Toggle and Branding */}
          <IconButton
            color="inherit"
            aria-label="Toggle navigation menu"
            onClick={handleMenuClick}
            edge="start"
            sx={{
              mr: { xs: 0.5, sm: 1 },
            }}
          >
            <MenuIcon />
          </IconButton>

          {/* Site Branding */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              minWidth: 'fit-content',
            }}
          >
            <Typography
              variant="h6"
              component="div"
              noWrap
              sx={{
                fontWeight: 600,
                display: { xs: isSmScreen ? 'none' : 'block', sm: 'block' },
              }}
            >
              {appConfig.title}
            </Typography>
          </Box>

          {/* Middle Section: Search (hidden on xs screens) */}
          <Box
            sx={{
              flexGrow: 1,
              display: { xs: 'none', sm: 'flex' },
              justifyContent: 'center',
              px: { sm: 1, md: 2, lg: 4 },
            }}
          >
            {renderSearchAutocomplete()}
          </Box>

          {/* Spacer for xs screens */}
          <Box sx={{ flexGrow: 1, display: { xs: 'block', sm: 'none' } }} />

          {/* Right Section: Actions */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 0, sm: 0.5 },
            }}
          >
            {/* Mobile Search Button (xs only) */}
            <IconButton
              color="inherit"
              aria-label="Open search"
              onClick={handleMobileSearchClick}
              sx={{
                display: { xs: 'flex', sm: 'none' },
              }}
            >
              <SearchIcon />
            </IconButton>

            {/* Notifications */}
            <IconButton
              color="inherit"
              aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ''}`}
              onClick={handleNotificationsClick}
            >
              <Badge
                badgeContent={notificationCount}
                color="error"
                max={99}
              >
                <NotificationsIcon />
              </Badge>
            </IconButton>

            {/* Theme Toggle */}
            <IconButton
              color="inherit"
              aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
              onClick={handleThemeToggle}
            >
              {themeMode === 'dark' ? (
                <Brightness7Icon />
              ) : (
                <Brightness4Icon />
              )}
            </IconButton>

            {/* User Menu */}
            <UserMenu />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Search Dialog */}
      <Dialog
        open={mobileSearchOpen}
        onClose={handleMobileSearchClose}
        fullWidth
        maxWidth="sm"
        aria-labelledby="mobile-search-dialog-title"
        PaperProps={{
          sx: {
            position: 'absolute',
            top: 0,
            m: 0,
            borderRadius: 0,
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
          },
        }}
      >
        <DialogContent sx={{ p: 2 }}>
          <Box
            id="mobile-search-dialog-title"
            component="h2"
            sx={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            Search Moodle
          </Box>
          {renderSearchAutocomplete(true)}
        </DialogContent>
      </Dialog>
    </>
  );
}
