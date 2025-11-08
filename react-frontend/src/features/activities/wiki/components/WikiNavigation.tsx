import type React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Breadcrumbs,
  Link,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Autocomplete,
  Chip,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  useMediaQuery,
  useTheme,
  Paper,
  Badge,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  ChevronRight as ChevronRightIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Map as MapIcon,
  Folder as FolderIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  MoreVert as MoreVertIcon,
  Label as LabelIcon,
  AccessTime as RecentIcon,
  Link as LinkIcon,
  BrokenImage as BrokenLinkIcon,
} from '@mui/icons-material';

/**
 * Props for the WikiNavigation component
 */
export interface WikiNavigationProps {
  /** The ID of the wiki */
  wikiId: number;
  
  /** Current page information */
  currentPage?: {
    id: number;
    title: string;
    subwikiId: number;
    tags?: string[];
    hasEditPermission?: boolean;
    hasViewPermission?: boolean;
  };
  
  /** Callback when navigating to a different page or action */
  onNavigate: (target: NavigationTarget) => void;
  
  /** Whether to show the search functionality */
  showSearch?: boolean;
  
  /** Whether the component is being rendered on a mobile device */
  isMobile?: boolean;
  
  /** Course information for breadcrumb */
  course?: {
    id: number;
    name: string;
  };
  
  /** Wiki information for breadcrumb */
  wiki?: {
    id: number;
    name: string;
  };
  
  /** Available pages for search autocomplete */
  availablePages?: WikiPage[];
  
  /** Recently viewed pages */
  recentPages?: WikiPage[];
  
  /** Whether to enable sticky navigation on scroll */
  sticky?: boolean;
  
  /** Current user permissions */
  permissions?: {
    canEdit?: boolean;
    canViewHistory?: boolean;
    canManageFiles?: boolean;
    canViewMap?: boolean;
  };
}

/**
 * Navigation target types
 */
export type NavigationTarget =
  | { type: 'page'; pageId: number; pageTitle: string }
  | { type: 'action'; action: 'view' | 'edit' | 'history' | 'map' | 'files' }
  | { type: 'course'; courseId: number }
  | { type: 'wiki'; wikiId: number }
  | { type: 'tag'; tag: string }
  | { type: 'search'; query: string };

/**
 * Wiki page interface
 */
interface WikiPage {
  id: number;
  title: string;
  subwikiId: number;
  tags?: string[];
  isBroken?: boolean;
  lastModified?: string;
}

/**
 * WikiNavigation Component
 * 
 * Provides comprehensive navigation features for wiki pages including:
 * - Breadcrumb trail showing course > wiki > page hierarchy
 * - Navigation menu with permission-based action visibility
 * - Internal page links with broken link detection
 * - Recently viewed pages list
 * - Page search functionality with autocomplete
 * - Wiki map/sitemap view toggle
 * - Page tags/categories filtering
 * - Mobile navigation drawer
 * - Sticky navigation on scroll
 * - Keyboard shortcuts and accessibility features
 */
function WikiNavigation({
  wikiId,
  currentPage,
  onNavigate,
  showSearch = true,
  isMobile: isMobileProp,
  course,
  wiki,
  availablePages = [],
  recentPages = [],
  sticky = true,
  permissions = {},
}: WikiNavigationProps) {
  const theme = useTheme();
  const isMobileScreen = useMediaQuery(theme.breakpoints.down('md'));
  const isMobile = isMobileProp ?? isMobileScreen;

  // State management
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isSticky, setIsSticky] = useState(false);
  const [recentMenuAnchor, setRecentMenuAnchor] = useState<null | HTMLElement>(null);

  // Effect to handle sticky navigation on scroll
  useEffect(() => {
    if (!sticky) {
      return;
    }

    const handleScroll = () => {
      const shouldBeSticky = window.scrollY > 100;
      setIsSticky(shouldBeSticky);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sticky]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Alt + H: Home (wiki main page)
      if (event.altKey && event.key === 'h') {
        event.preventDefault();
        onNavigate({ type: 'wiki', wikiId });
      }

      // Alt + E: Edit current page
      if (event.altKey && event.key === 'e' && permissions.canEdit && currentPage) {
        event.preventDefault();
        onNavigate({ type: 'action', action: 'edit' });
      }

      // Alt + M: View wiki map
      if (event.altKey && event.key === 'm' && permissions.canViewMap) {
        event.preventDefault();
        onNavigate({ type: 'action', action: 'map' });
      }

      // Alt + S: Focus search
      if (event.altKey && event.key === 's' && showSearch) {
        event.preventDefault();
        const searchInput = document.getElementById('wiki-search-input');
        searchInput?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wikiId, currentPage, permissions, showSearch, onNavigate]);

  // Filter pages based on search and tags
  const filteredPages = useMemo(() => {
    let filtered = availablePages;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(page =>
        page.title.toLowerCase().includes(query)
      );
    }

    // Filter by selected tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(page =>
        page.tags?.some(tag => selectedTags.includes(tag))
      );
    }

    return filtered;
  }, [availablePages, searchQuery, selectedTags]);

  // Extract unique tags from all pages
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    availablePages.forEach(page => {
      page.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [availablePages]);

  // Handlers
  const handleDrawerToggle = useCallback(() => {
    setMobileDrawerOpen(prev => !prev);
  }, []);

  const handleSearchChange = useCallback((_event: React.SyntheticEvent, value: WikiPage | null) => {
    if (value) {
      onNavigate({ type: 'page', pageId: value.id, pageTitle: value.title });
      setSearchQuery('');
    }
  }, [onNavigate]);

  const handleActionClick = useCallback((action: 'view' | 'edit' | 'history' | 'map' | 'files') => {
    onNavigate({ type: 'action', action });
    setMobileDrawerOpen(false);
    setAnchorEl(null);
  }, [onNavigate]);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      }
      return [...prev, tag];
    });
    onNavigate({ type: 'tag', tag });
  }, [onNavigate]);

  const handleTagRemove = useCallback((tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
  }, []);

  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleRecentMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setRecentMenuAnchor(event.currentTarget);
  }, []);

  const handleRecentMenuClose = useCallback(() => {
    setRecentMenuAnchor(null);
  }, []);

  const handleBreadcrumbClick = useCallback((target: NavigationTarget) => {
    onNavigate(target);
  }, [onNavigate]);

  // Render breadcrumb navigation
  const renderBreadcrumbs = () => (
    <Breadcrumbs
      separator={<ChevronRightIcon fontSize="small" />}
      aria-label="wiki navigation breadcrumb"
      sx={{ mb: 2 }}
    >
      {course && (
        <Link
          component="button"
          variant="body2"
          onClick={() => handleBreadcrumbClick({ type: 'course', courseId: course.id })}
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline',
            },
          }}
          aria-label={`Navigate to ${course.name} course`}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          {course.name}
        </Link>
      )}
      {wiki && (
        <Link
          component="button"
          variant="body2"
          onClick={() => handleBreadcrumbClick({ type: 'wiki', wikiId: wiki.id })}
          sx={{
            cursor: 'pointer',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline',
            },
          }}
          aria-label={`Navigate to ${wiki.name} wiki`}
        >
          {wiki.name}
        </Link>
      )}
      {currentPage && (
        <Typography variant="body2" color="text.primary" aria-current="page">
          {currentPage.title}
        </Typography>
      )}
    </Breadcrumbs>
  );

  // Render navigation actions menu
  const renderNavigationMenu = () => {
    const actions = [
      {
        id: 'view',
        icon: <ViewIcon />,
        label: 'View',
        action: 'view' as const,
        show: currentPage?.hasViewPermission !== false,
        shortcut: '',
      },
      {
        id: 'edit',
        icon: <EditIcon />,
        label: 'Edit',
        action: 'edit' as const,
        show: permissions.canEdit === true,
        shortcut: 'Alt+E',
      },
      {
        id: 'history',
        icon: <HistoryIcon />,
        label: 'History',
        action: 'history' as const,
        show: permissions.canViewHistory !== false,
        shortcut: '',
      },
      {
        id: 'map',
        icon: <MapIcon />,
        label: 'Map',
        action: 'map' as const,
        show: permissions.canViewMap !== false,
        shortcut: 'Alt+M',
      },
      {
        id: 'files',
        icon: <FolderIcon />,
        label: 'Files',
        action: 'files' as const,
        show: permissions.canManageFiles === true,
        shortcut: '',
      },
    ].filter(action => action.show);

    return (
      <List dense>
        {actions.map(action => (
          <ListItem key={action.id} disablePadding>
            <Tooltip
              title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
              placement="right"
            >
              <ListItemButton
                onClick={() => handleActionClick(action.action)}
                aria-label={`${action.label} page${action.shortcut ? ` (${action.shortcut})` : ''}`}
              >
                <ListItemIcon>{action.icon}</ListItemIcon>
                <ListItemText primary={action.label} />
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>
    );
  };

  // Render search with autocomplete
  const renderSearch = () => {
    if (!showSearch) {
      return null;
    }

    return (
      <Autocomplete
        id="wiki-search-input"
        options={filteredPages}
        getOptionLabel={(option) => option.title}
        value={null}
        onChange={handleSearchChange}
        inputValue={searchQuery}
        onInputChange={(_event, newValue) => setSearchQuery(newValue)}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search wiki pages..."
            variant="outlined"
            size="small"
            InputProps={{
              ...params.InputProps,
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
            }}
            aria-label="Search wiki pages"
          />
        )}
        renderOption={(props, option) => (
          <li {...props} key={option.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              {option.isBroken ? (
                <BrokenLinkIcon sx={{ mr: 1, color: 'error.main' }} fontSize="small" />
              ) : (
                <LinkIcon sx={{ mr: 1, color: 'action.active' }} fontSize="small" />
              )}
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2">{option.title}</Typography>
                {option.tags && option.tags.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                    {option.tags.map(tag => (
                      <Chip key={tag} label={tag} size="small" sx={{ height: 18 }} />
                    ))}
                  </Box>
                )}
              </Box>
              {option.isBroken && (
                <Typography variant="caption" color="error" sx={{ ml: 1 }}>
                  Broken
                </Typography>
              )}
            </Box>
          </li>
        )}
        sx={{ flexGrow: 1, maxWidth: 400 }}
        noOptionsText="No pages found"
        aria-label="Wiki page search autocomplete"
      />
    );
  };

  // Render tag filters
  const renderTagFilters = () => {
    if (allTags.length === 0) {
      return null;
    }

    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Filter by tags:
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {allTags.slice(0, 10).map(tag => {
            const isSelected = selectedTags.includes(tag);
            return (
              <Chip
                key={tag}
                label={tag}
                size="small"
                icon={<LabelIcon />}
                onClick={() => handleTagClick(tag)}
                onDelete={isSelected ? () => handleTagRemove(tag) : undefined}
                color={isSelected ? 'primary' : 'default'}
                variant={isSelected ? 'filled' : 'outlined'}
                aria-label={`${isSelected ? 'Remove' : 'Add'} filter for tag ${tag}`}
              />
            );
          })}
          {allTags.length > 10 && (
            <Chip
              label={`+${allTags.length - 10} more`}
              size="small"
              variant="outlined"
              aria-label={`${allTags.length - 10} more tags available`}
            />
          )}
        </Box>
      </Box>
    );
  };

  // Render recently viewed pages
  const renderRecentPages = () => {
    if (recentPages.length === 0) {
      return null;
    }

    return (
      <>
        <Tooltip title="Recently viewed pages">
          <IconButton
            onClick={handleRecentMenuOpen}
            size="small"
            aria-label="View recently accessed pages"
            aria-controls="recent-pages-menu"
            aria-haspopup="true"
          >
            <Badge badgeContent={recentPages.length} color="primary" max={9}>
              <RecentIcon />
            </Badge>
          </IconButton>
        </Tooltip>
        <Menu
          id="recent-pages-menu"
          anchorEl={recentMenuAnchor}
          open={Boolean(recentMenuAnchor)}
          onClose={handleRecentMenuClose}
          MenuListProps={{
            'aria-label': 'Recently viewed wiki pages',
          }}
        >
          <MenuItem disabled>
            <Typography variant="caption" fontWeight="bold">
              Recently Viewed
            </Typography>
          </MenuItem>
          <Divider />
          {recentPages.map(page => (
            <MenuItem
              key={page.id}
              onClick={() => {
                onNavigate({ type: 'page', pageId: page.id, pageTitle: page.title });
                handleRecentMenuClose();
              }}
            >
              <ListItemIcon>
                {page.isBroken ? (
                  <BrokenLinkIcon fontSize="small" color="error" />
                ) : (
                  <LinkIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={page.title}
                secondary={page.lastModified}
                primaryTypographyProps={{
                  noWrap: true,
                  sx: { maxWidth: 200 },
                }}
              />
            </MenuItem>
          ))}
        </Menu>
      </>
    );
  };

  // Render mobile drawer
  const renderMobileDrawer = () => (
    <Drawer
      anchor="left"
      open={mobileDrawerOpen}
      onClose={handleDrawerToggle}
      ModalProps={{
        keepMounted: true, // Better open performance on mobile
      }}
      aria-label="Wiki navigation drawer"
    >
      <Box
        sx={{ width: 280, pt: 2 }}
        role="navigation"
        aria-label="Wiki mobile navigation"
      >
        <Box sx={{ px: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Wiki Navigation</Typography>
          <IconButton onClick={handleDrawerToggle} aria-label="Close navigation drawer">
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider />
        <Box sx={{ px: 2, py: 2 }}>
          {renderBreadcrumbs()}
        </Box>
        <Divider />
        <Box sx={{ px: 2, py: 2 }}>
          {renderSearch()}
        </Box>
        <Divider />
        <Box sx={{ py: 1 }}>
          <Typography variant="subtitle2" sx={{ px: 2, py: 1, color: 'text.secondary' }}>
            Actions
          </Typography>
          {renderNavigationMenu()}
        </Box>
        {recentPages.length > 0 && (
          <>
            <Divider />
            <Box sx={{ py: 1 }}>
              <Typography variant="subtitle2" sx={{ px: 2, py: 1, color: 'text.secondary' }}>
                Recent Pages
              </Typography>
              <List dense>
                {recentPages.slice(0, 5).map(page => (
                  <ListItem key={page.id} disablePadding>
                    <ListItemButton
                      onClick={() => {
                        onNavigate({ type: 'page', pageId: page.id, pageTitle: page.title });
                        handleDrawerToggle();
                      }}
                    >
                      <ListItemIcon>
                        {page.isBroken ? (
                          <BrokenLinkIcon fontSize="small" color="error" />
                        ) : (
                          <LinkIcon fontSize="small" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={page.title}
                        primaryTypographyProps={{ noWrap: true }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          </>
        )}
        <Divider />
        <Box sx={{ px: 2, py: 2 }}>
          {renderTagFilters()}
        </Box>
      </Box>
    </Drawer>
  );

  // Render more actions menu (overflow menu)
  const renderMoreMenu = () => (
    <>
      <Tooltip title="More options">
        <IconButton
          onClick={handleMenuOpen}
          size="small"
          aria-label="More navigation options"
          aria-controls="more-menu"
          aria-haspopup="true"
        >
          <MoreVertIcon />
        </IconButton>
      </Tooltip>
      <Menu
        id="more-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        MenuListProps={{
          'aria-label': 'Additional navigation options',
        }}
      >
        {currentPage?.tags && currentPage.tags.length > 0 && (
          <MenuItem disabled>
            <Typography variant="caption" fontWeight="bold">
              Page Tags
            </Typography>
          </MenuItem>
        )}
        {currentPage?.tags?.map(tag => (
          <MenuItem key={tag} onClick={() => { handleTagClick(tag); handleMenuClose(); }}>
            <ListItemIcon>
              <LabelIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{tag}</ListItemText>
          </MenuItem>
        ))}
        {currentPage?.tags && currentPage.tags.length > 0 && <Divider />}
        <MenuItem onClick={() => { handleActionClick('map'); }}>
          <ListItemIcon>
            <MapIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Wiki Map</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );

  // Main render
  return (
    <>
      <AppBar
        position={sticky && isSticky ? 'fixed' : 'static'}
        color="default"
        elevation={isSticky ? 4 : 1}
        sx={{
          transition: theme.transitions.create(['box-shadow', 'background-color'], {
            duration: theme.transitions.duration.short,
          }),
          backgroundColor: isSticky ? 'background.paper' : 'transparent',
          zIndex: theme.zIndex.appBar,
        }}
        role="navigation"
        aria-label="Wiki navigation bar"
      >
        <Toolbar variant="dense" sx={{ gap: 2, flexWrap: 'wrap', py: 1 }}>
          {/* Mobile menu button */}
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="Open navigation drawer"
              edge="start"
              onClick={handleDrawerToggle}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Desktop breadcrumbs */}
          {!isMobile && (
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              {renderBreadcrumbs()}
            </Box>
          )}

          {/* Mobile title */}
          {isMobile && currentPage && (
            <Typography
              variant="subtitle1"
              noWrap
              sx={{ flexGrow: 1, minWidth: 0 }}
              aria-label={`Current page: ${currentPage.title}`}
            >
              {currentPage.title}
            </Typography>
          )}

          {/* Desktop search */}
          {!isMobile && renderSearch()}

          {/* Action buttons (desktop only) */}
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {permissions.canEdit && currentPage && (
                <Tooltip title="Edit page (Alt+E)">
                  <IconButton
                    onClick={() => handleActionClick('edit')}
                    size="small"
                    color="primary"
                    aria-label="Edit current page (Alt+E)"
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
              )}
              {permissions.canViewHistory !== false && currentPage && (
                <Tooltip title="View history">
                  <IconButton
                    onClick={() => handleActionClick('history')}
                    size="small"
                    aria-label="View page history"
                  >
                    <HistoryIcon />
                  </IconButton>
                </Tooltip>
              )}
              {permissions.canViewMap !== false && (
                <Tooltip title="View wiki map (Alt+M)">
                  <IconButton
                    onClick={() => handleActionClick('map')}
                    size="small"
                    aria-label="View wiki map (Alt+M)"
                  >
                    <MapIcon />
                  </IconButton>
                </Tooltip>
              )}
              {renderRecentPages()}
              {renderMoreMenu()}
            </Box>
          )}

          {/* Mobile action buttons */}
          {isMobile && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {permissions.canEdit && currentPage && (
                <IconButton
                  onClick={() => handleActionClick('edit')}
                  size="small"
                  color="primary"
                  aria-label="Edit page"
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {renderMoreMenu()}
            </Box>
          )}
        </Toolbar>

        {/* Desktop tag filters (below toolbar) */}
        {!isMobile && allTags.length > 0 && (
          <Box sx={{ px: 2, pb: 1 }}>
            {renderTagFilters()}
          </Box>
        )}
      </AppBar>

      {/* Spacer for sticky navigation */}
      {sticky && isSticky && (
        <Box
          sx={{
            height: isMobile ? 48 : 64,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      {isMobile && renderMobileDrawer()}

      {/* Desktop side panel (optional - can be implemented in parent component) */}
      {!isMobile && (
        <Paper
          elevation={0}
          sx={{
            position: 'fixed',
            right: 16,
            top: sticky && isSticky ? 80 : 120,
            width: 240,
            maxHeight: 'calc(100vh - 120px)',
            overflow: 'auto',
            p: 2,
            display: availablePages.length > 0 || recentPages.length > 0 ? 'block' : 'none',
            backgroundColor: 'background.paper',
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`,
          }}
          role="complementary"
          aria-label="Wiki navigation sidebar"
        >
          {recentPages.length > 0 && (
            <>
              <Typography variant="subtitle2" gutterBottom color="text.secondary">
                Recent Pages
              </Typography>
              <List dense>
                {recentPages.slice(0, 5).map(page => (
                  <ListItem key={page.id} disablePadding>
                    <ListItemButton
                      onClick={() => onNavigate({ type: 'page', pageId: page.id, pageTitle: page.title })}
                      sx={{ borderRadius: 1 }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {page.isBroken ? (
                          <BrokenLinkIcon fontSize="small" color="error" />
                        ) : (
                          <LinkIcon fontSize="small" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={page.title}
                        primaryTypographyProps={{
                          variant: 'body2',
                          noWrap: true,
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
              {allTags.length > 0 && <Divider sx={{ my: 1 }} />}
            </>
          )}
          {allTags.length > 0 && renderTagFilters()}
        </Paper>
      )}

      {/* Accessibility: Keyboard shortcuts help */}
      <Box
        component="div"
        sx={{ position: 'absolute', left: -10000, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        Available keyboard shortcuts: Alt+H (Home), Alt+E (Edit), Alt+M (Map), Alt+S (Search)
      </Box>
    </>
  );
}

export default WikiNavigation;
