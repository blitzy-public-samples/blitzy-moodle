import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Breadcrumbs,
  Link,
  Button,
  IconButton,
  Skeleton,
  Tooltip,
  InputAdornment,
  Card,
  CardContent,
  Stack,
  Chip,
} from '@mui/material';
import { TreeView, TreeItem } from '@mui/x-tree-view';
import {
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  VideoLibrary as VideoIcon,
  AudioFile as AudioIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

import { File } from '../types/resource.types';
import { useResourceFolder } from '../hooks/useResource';
import { LoadingSpinner } from '../../../../components/feedback/LoadingSpinner';
import { Alert } from '../../../../components/feedback/Alert';
import { useDebounce } from '../../../../hooks/useDebounce';
import { usePermissions } from '../../../../hooks/usePermissions';

/**
 * Props interface for FolderBrowser component
 */
export interface FolderBrowserProps {
  /** Folder resource ID */
  folderId: number;
  /** Whether to show folder introduction text */
  showdescription?: boolean;
  /** Whether to show folders expanded by default */
  showexpanded?: boolean;
  /** Display mode for folder content */
  displayMode?: 'inline' | 'page';
  /** Force file downloads instead of inline display */
  forcedownload?: boolean;
}

/**
 * Represents a node in the folder tree structure
 */
interface FolderNode {
  id: string;
  name: string;
  isFolder: boolean;
  isRoot?: boolean;
  children?: FolderNode[];
  file?: File;
  path: string;
  parentPath?: string;
}

/**
 * Folder data structure from API
 */
interface FolderData {
  id: number;
  name: string;
  intro?: string;
  introformat?: number;
  tree: FolderNode;
  canManageFiles: boolean;
  canDownload: boolean;
  archiveUrl?: string;
  editUrl?: string;
}

/**
 * Formats file size in human-readable format
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Gets appropriate icon for file based on MIME type
 */
const getFileIcon = (mimetype?: string): React.ReactElement => {
  if (!mimetype) return <FileIcon />;
  
  if (mimetype.startsWith('image/')) return <ImageIcon color="primary" />;
  if (mimetype.startsWith('video/')) return <VideoIcon color="secondary" />;
  if (mimetype.startsWith('audio/')) return <AudioIcon color="info" />;
  if (mimetype === 'application/pdf') return <PdfIcon color="error" />;
  if (
    mimetype.includes('word') ||
    mimetype.includes('document') ||
    mimetype === 'application/msword' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return <DocIcon color="primary" />;
  }
  
  return <FileIcon />;
};

/**
 * Checks if file is a web image that can display thumbnail
 */
const isWebImage = (mimetype?: string): boolean => {
  if (!mimetype) return false;
  return ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(mimetype);
};

/**
 * Recursively filters folder tree based on search query
 */
const filterTree = (node: FolderNode, query: string): FolderNode | null => {
  const lowerQuery = query.toLowerCase();
  const nameMatches = node.name.toLowerCase().includes(lowerQuery);
  
  if (node.isFolder && node.children) {
    const filteredChildren = node.children
      .map(child => filterTree(child, query))
      .filter((child): child is FolderNode => child !== null);
    
    if (filteredChildren.length > 0 || nameMatches) {
      return {
        ...node,
        children: filteredChildren,
      };
    }
    return null;
  }
  
  return nameMatches ? node : null;
};

/**
 * Collects all node IDs for initial expansion
 */
const collectNodeIds = (node: FolderNode): string[] => {
  const ids: string[] = [node.id];
  if (node.children) {
    node.children.forEach(child => {
      ids.push(...collectNodeIds(child));
    });
  }
  return ids;
};

/**
 * Extracts breadcrumb path from node path
 */
const getBreadcrumbsFromPath = (path: string, rootName: string): Array<{ label: string; path: string }> => {
  if (!path || path === '/') {
    return [{ label: rootName, path: '/' }];
  }
  
  const parts = path.split('/').filter(Boolean);
  const breadcrumbs: Array<{ label: string; path: string }> = [
    { label: rootName, path: '/' }
  ];
  
  let currentPath = '';
  parts.forEach(part => {
    currentPath += '/' + part;
    breadcrumbs.push({ label: part, path: currentPath });
  });
  
  return breadcrumbs;
};

/**
 * FolderBrowser Component
 * 
 * Displays hierarchical folder structure with expandable/collapsible navigation
 * using Material-UI TreeView. Fetches folder tree data via API, renders files
 * and subfolders with appropriate icons and thumbnails, provides breadcrumb
 * navigation trail, includes download folder functionality, implements
 * search/filter capabilities, and maintains comprehensive accessibility support
 * with WCAG 2.1 AA compliance.
 */
export const FolderBrowser: React.FC<FolderBrowserProps> = ({
  folderId,
  showdescription = true,
  showexpanded = false,
  displayMode = 'page',
  forcedownload = false,
}) => {
  // Fetch folder data using React Query hook
  const { data: folderData, isLoading, error } = useResourceFolder(folderId);
  const { hasCapability } = usePermissions();
  
  // Local state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [currentBreadcrumb, setCurrentBreadcrumb] = useState<string>('/');
  
  // Debounce search query to avoid excessive filtering
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  // Initialize expanded nodes based on showexpanded prop
  useEffect(() => {
    if (folderData?.tree && showexpanded) {
      const allIds = collectNodeIds(folderData.tree);
      setExpanded(allIds);
    } else if (folderData?.tree) {
      // Expand only root node
      setExpanded([folderData.tree.id]);
    }
  }, [folderData, showexpanded]);
  
  // Filter tree based on search query
  const filteredTree = useMemo(() => {
    if (!folderData?.tree) return null;
    if (!debouncedSearchQuery.trim()) return folderData.tree;
    
    return filterTree(folderData.tree, debouncedSearchQuery);
  }, [folderData?.tree, debouncedSearchQuery]);
  
  // Get breadcrumbs for current path
  const breadcrumbs = useMemo(() => {
    if (!folderData?.name) return [];
    return getBreadcrumbsFromPath(currentBreadcrumb, folderData.name);
  }, [currentBreadcrumb, folderData?.name]);
  
  // Handle tree node toggle
  const handleToggle = useCallback((event: React.SyntheticEvent, nodeIds: string[]) => {
    setExpanded(nodeIds);
  }, []);
  
  // Handle tree node selection
  const handleSelect = useCallback((event: React.SyntheticEvent, nodeIds: string[]) => {
    setSelected(nodeIds);
  }, []);
  
  // Handle file download
  const handleFileDownload = useCallback((file: File) => {
    if (file.fileurl) {
      const url = forcedownload && !file.fileurl.includes('forcedownload')
        ? `${file.fileurl}${file.fileurl.includes('?') ? '&' : '?'}forcedownload=1`
        : file.fileurl;
      
      window.open(url, '_blank');
    }
  }, [forcedownload]);
  
  // Handle folder archive download
  const handleDownloadFolder = useCallback(() => {
    if (folderData?.archiveUrl) {
      window.open(folderData.archiveUrl, '_blank');
    }
  }, [folderData]);
  
  // Handle edit action
  const handleEdit = useCallback(() => {
    if (folderData?.editUrl) {
      window.location.href = folderData.editUrl;
    }
  }, [folderData]);
  
  // Handle breadcrumb click
  const handleBreadcrumbClick = useCallback((path: string) => {
    setCurrentBreadcrumb(path);
  }, []);
  
  // Render individual tree node recursively
  const renderTreeNode = useCallback((node: FolderNode): React.ReactElement => {
    const nodeId = node.id;
    const isFolder = node.isFolder;
    
    // Prepare node label
    const label = (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          py: 0.5,
          gap: 1,
        }}
      >
        {isFolder ? (
          expanded.includes(nodeId) ? (
            <FolderOpenIcon color="primary" />
          ) : (
            <FolderIcon color="primary" />
          )
        ) : (
          getFileIcon(node.file?.mimetype)
        )}
        
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.name}
          </Typography>
          
          {!isFolder && node.file && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block' }}
            >
              {node.file.filesize && formatFileSize(node.file.filesize)}
              {node.file.timemodified && (
                <>
                  {' • '}
                  {format(new Date(node.file.timemodified * 1000), 'MMM d, yyyy')}
                </>
              )}
            </Typography>
          )}
        </Box>
        
        {!isFolder && node.file && isWebImage(node.file.mimetype) && node.file.fileurl && (
          <Box
            component="img"
            src={node.file.fileurl}
            alt={node.name}
            sx={{
              width: 40,
              height: 40,
              objectFit: 'cover',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          />
        )}
        
        {!isFolder && node.file && (
          <Tooltip title="Download">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                if (node.file) {
                  handleFileDownload(node.file);
                }
              }}
              aria-label={`Download ${node.name}`}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
    
    return (
      <TreeItem
        key={nodeId}
        nodeId={nodeId}
        label={label}
        sx={{
          '& .MuiTreeItem-content': {
            py: 0.5,
            '&:hover': {
              backgroundColor: 'action.hover',
            },
            '&.Mui-selected': {
              backgroundColor: 'action.selected',
              '&:hover': {
                backgroundColor: 'action.selected',
              },
            },
            '&.Mui-focused': {
              backgroundColor: 'action.focus',
            },
          },
          ...(node.isRoot && {
            '& > .MuiTreeItem-content': {
              fontWeight: 'bold',
            },
          }),
        }}
      >
        {isFolder && node.children && node.children.length > 0
          ? node.children.map(child => renderTreeNode(child))
          : null}
      </TreeItem>
    );
  }, [expanded, handleFileDownload]);
  
  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Skeleton variant="text" width="60%" height={40} />
          <Skeleton variant="rectangular" height={60} />
          <Skeleton variant="rectangular" height={200} />
        </Stack>
      </Box>
    );
  }
  
  // Error state
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load folder contents. Please try again later.
        </Alert>
      </Box>
    );
  }
  
  // No data state
  if (!folderData || !filteredTree) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          No folder data available.
        </Alert>
      </Box>
    );
  }
  
  // Empty search results
  if (debouncedSearchQuery && !filteredTree) {
    return (
      <Box sx={{ p: 3 }}>
        <TextField
          fullWidth
          placeholder="Search files and folders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
        <Alert severity="info">
          No files or folders match your search query "{debouncedSearchQuery}".
        </Alert>
      </Box>
    );
  }
  
  // Calculate total files count
  const countFiles = (node: FolderNode): number => {
    let count = node.isFolder ? 0 : 1;
    if (node.children) {
      count += node.children.reduce((sum, child) => sum + countFiles(child), 0);
    }
    return count;
  };
  
  const totalFiles = countFiles(filteredTree);
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with title and actions */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography
          variant="h5"
          component="h2"
          sx={{ fontWeight: 600 }}
        >
          {folderData.name}
        </Typography>
        
        <Stack direction="row" spacing={1}>
          {folderData.canManageFiles && hasCapability('mod/folder:managefiles') && folderData.editUrl && (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleEdit}
              aria-label="Edit folder"
            >
              Edit
            </Button>
          )}
          
          {folderData.canDownload && folderData.archiveUrl && (
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadFolder}
              aria-label="Download entire folder as archive"
            >
              Download Folder
            </Button>
          )}
        </Stack>
      </Box>
      
      {/* Folder introduction text */}
      {showdescription && folderData.intro && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box
              dangerouslySetInnerHTML={{ __html: folderData.intro }}
              sx={{
                '& p:last-child': { mb: 0 },
                '& a': {
                  color: 'primary.main',
                  textDecoration: 'underline',
                },
              }}
            />
          </CardContent>
        </Card>
      )}
      
      {/* Search bar */}
      <TextField
        fullWidth
        placeholder="Search files and folders..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
        aria-label="Search files and folders"
      />
      
      {/* Breadcrumb navigation */}
      {breadcrumbs.length > 1 && (
        <Breadcrumbs
          aria-label="Folder navigation breadcrumbs"
          sx={{ mb: 2 }}
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return isLast ? (
              <Typography key={crumb.path} color="text.primary">
                {crumb.label}
              </Typography>
            ) : (
              <Link
                key={crumb.path}
                component="button"
                variant="body2"
                onClick={() => handleBreadcrumbClick(crumb.path)}
                sx={{
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  '&:hover': {
                    textDecoration: 'none',
                  },
                }}
              >
                {crumb.label}
              </Link>
            );
          })}
        </Breadcrumbs>
      )}
      
      {/* File count indicator */}
      <Box sx={{ mb: 2 }}>
        <Chip
          label={`${totalFiles} file${totalFiles !== 1 ? 's' : ''}`}
          size="small"
          variant="outlined"
        />
      </Box>
      
      {/* Tree view */}
      <Card>
        <CardContent>
          {filteredTree.children && filteredTree.children.length > 0 ? (
            <TreeView
              aria-label="Folder structure"
              defaultCollapseIcon={<ExpandMoreIcon />}
              defaultExpandIcon={<ChevronRightIcon />}
              expanded={expanded}
              selected={selected}
              onNodeToggle={handleToggle}
              onNodeSelect={handleSelect}
              sx={{
                flexGrow: 1,
                overflowY: 'auto',
              }}
            >
              {filteredTree.children.map(child => renderTreeNode(child))}
            </TreeView>
          ) : (
            <Alert severity="info">
              This folder is empty.
            </Alert>
          )}
        </CardContent>
      </Card>
      
      {/* Screen reader instructions */}
      <Box
        component="div"
        sx={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
        aria-live="polite"
        aria-atomic="true"
      >
        {`Showing ${totalFiles} file${totalFiles !== 1 ? 's' : ''} in ${folderData.name}. Use arrow keys to navigate the folder tree.`}
      </Box>
    </Box>
  );
};

export default FolderBrowser;
