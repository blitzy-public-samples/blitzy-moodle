/**
 * Category Management Component
 *
 * Admin category management component for course category hierarchy with:
 * - Drag-and-drop reordering support
 * - Nested category tree display using Material-UI TreeView
 * - Category CRUD operations (create, edit, delete, move)
 * - Visual hierarchy indicators with indentation and depth levels
 * - Real-time updates via React Query mutations
 *
 * This component wraps Moodle's core_course_category functionality via API endpoints
 * without modifying any existing PHP business logic.
 *
 * @module features/admin/courses/components/CategoryManagement
 * @see public/course/editcategory.php - Reference for category edit form patterns
 * @see public/course/classes/category.php - Reference for category class structure
 * @see public/course/category.ajax.php - Reference for AJAX operations
 */

import type React from 'react';
import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  memo,
} from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Tooltip,
  Menu,
  Alert,
  Snackbar,
  Skeleton,
  InputAdornment,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  CircularProgress,
} from '@mui/material';
import {
  ExpandMore,
  ChevronRight,
  Add,
  Edit,
  Delete,
  DragIndicator,
  Folder,
  FolderOpen,
  Visibility,
  VisibilityOff,
  Search,
  Clear,
  UnfoldMore,
  UnfoldLess,
  DriveFileMove,
  Warning,
} from '@mui/icons-material';

// Internal imports from depends_on_files
import type { CourseCategory } from '@/features/courses/types/course.types';
import { apiClient } from '@/services/api/client';

import useDebounce from '@/hooks/useDebounce';
import { moveCategory } from '@/features/admin/courses/api/adminCoursesApi';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props interface for CategoryManagement component
 */
interface CategoryManagementProps {
  /** Optional callback when a category is selected */
  onCategorySelect?: (category: CourseCategory | null) => void;
  /** Whether to enable drag-and-drop functionality */
  allowDragDrop?: boolean;
  /** Whether to show course counts for each category */
  showCourseCount?: boolean;
  /** Whether to expand all categories by default */
  expandAll?: boolean;
}

/**
 * Extended category type with children array for tree structure
 */
interface CategoryTreeNode extends CourseCategory {
  /** Child categories */
  children: CategoryTreeNode[];
}

/**
 * Form data interface for category create/edit dialogs
 */
interface CategoryFormData {
  /** Category name (required) */
  name: string;
  /** Category description */
  description: string;
  /** Parent category ID (0 for top-level) */
  parent: number;
  /** Whether category is visible */
  visible: boolean;
  /** Custom ID number */
  idnumber: string;
}

/**
 * Drag item interface for drag-and-drop operations
 */
interface DragState {
  /** ID of category being dragged */
  draggingId: number | null;
  /** ID of potential drop target */
  dropTargetId: number | null;
  /** Drop position relative to target */
  dropPosition: 'before' | 'after' | 'inside' | null;
}

/**
 * API response wrapper type
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
}

// ============================================================================
// Constants
// ============================================================================

/** API endpoint for categories */
const CATEGORIES_ENDPOINT = '/admin/courses/categories';

/** Query key for categories */
const CATEGORIES_QUERY_KEY = ['admin', 'categories'];

/** Default form data */
const DEFAULT_FORM_DATA: CategoryFormData = {
  name: '',
  description: '',
  parent: 0,
  visible: true,
  idnumber: '',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Builds a hierarchical tree structure from a flat list of categories.
 *
 * @param categories - Flat array of categories
 * @returns Array of root-level CategoryTreeNode objects with nested children
 */
function buildCategoryTree(categories: CourseCategory[]): CategoryTreeNode[] {
  // Create a map of categories by ID for quick lookup
  const categoryMap = new Map<number, CategoryTreeNode>();

  // Initialize all categories as tree nodes with empty children arrays
  categories.forEach((category) => {
    categoryMap.set(category.id, {
      ...category,
      children: [],
    });
  });

  // Build the tree by linking parents and children
  const rootCategories: CategoryTreeNode[] = [];

  categories.forEach((category) => {
    const treeNode = categoryMap.get(category.id);
    if (!treeNode) {return;}

    if (category.parent === 0) {
      // Top-level category
      rootCategories.push(treeNode);
    } else {
      // Find parent and add as child
      const parent = categoryMap.get(category.parent);
      if (parent) {
        parent.children.push(treeNode);
      } else {
        // Orphaned category - treat as root
        rootCategories.push(treeNode);
      }
    }
  });

  // Sort by sortorder within each level
  const sortByOrder = (a: CategoryTreeNode, b: CategoryTreeNode) =>
    a.sortorder - b.sortorder;

  const sortRecursively = (nodes: CategoryTreeNode[]): CategoryTreeNode[] => {
    return nodes.sort(sortByOrder).map((node) => ({
      ...node,
      children: sortRecursively(node.children),
    }));
  };

  return sortRecursively(rootCategories);
}

/**
 * Gets all descendant IDs of a category.
 *
 * @param categoryId - The category ID to get descendants for
 * @param tree - The category tree
 * @returns Array of descendant category IDs
 */
function getDescendantIds(categoryId: number, tree: CategoryTreeNode[]): number[] {
  const descendants: number[] = [];

  const findAndCollect = (nodes: CategoryTreeNode[], collecting: boolean): boolean => {
    for (const node of nodes) {
      if (node.id === categoryId) {
        // Found the target, start collecting
        collectAll(node.children);
        return true;
      }
      if (collecting) {
        descendants.push(node.id);
        collectAll(node.children);
      } else if (findAndCollect(node.children, false)) {
        return true;
      }
    }
    return false;
  };

  const collectAll = (nodes: CategoryTreeNode[]) => {
    nodes.forEach((node) => {
      descendants.push(node.id);
      collectAll(node.children);
    });
  };

  findAndCollect(tree, false);
  return descendants;
}

/**
 * Filters categories by search term.
 *
 * @param tree - Category tree to filter
 * @param searchTerm - Search term to match against names
 * @returns Filtered tree with matching categories and their ancestors
 */
function filterCategoryTree(
  tree: CategoryTreeNode[],
  searchTerm: string
): CategoryTreeNode[] {
  if (!searchTerm.trim()) {
    return tree;
  }

  const term = searchTerm.toLowerCase();

  const filterNode = (node: CategoryTreeNode): CategoryTreeNode | null => {
    // Check if this node matches
    const matches = node.name.toLowerCase().includes(term);

    // Recursively filter children
    const filteredChildren = node.children
      .map(filterNode)
      .filter((n): n is CategoryTreeNode => n !== null);

    // Include node if it matches or has matching descendants
    if (matches || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren,
      };
    }

    return null;
  };

  return tree.map(filterNode).filter((n): n is CategoryTreeNode => n !== null);
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Props for CategoryTreeItem component
 */
interface CategoryTreeItemProps {
  /** Category node to render */
  node: CategoryTreeNode;
  /** Current depth level (for indentation) */
  depth: number;
  /** Set of expanded category IDs */
  expandedIds: Set<number>;
  /** Callback to toggle expansion */
  onToggleExpand: (id: number) => void;
  /** Currently selected category ID */
  selectedId: number | null;
  /** Callback when category is selected */
  onSelect: (category: CourseCategory) => void;
  /** Callback to open edit dialog */
  onEdit: (category: CourseCategory) => void;
  /** Callback to open delete dialog */
  onDelete: (category: CourseCategory) => void;
  /** Callback to open create subcategory dialog */
  onAddSubcategory: (parentId: number) => void;
  /** Callback to toggle visibility */
  onToggleVisibility: (category: CourseCategory) => void;
  /** Callback to open move dialog */
  onMove: (category: CourseCategory) => void;
  /** Whether to show course counts */
  showCourseCount: boolean;
  /** Whether drag-and-drop is enabled */
  allowDragDrop: boolean;
  /** Current drag state */
  dragState: DragState;
  /** Callback when drag starts */
  onDragStart: (id: number) => void;
  /** Callback when drag enters a target */
  onDragEnter: (id: number, position: 'before' | 'after' | 'inside') => void;
  /** Callback when drag ends */
  onDragEnd: () => void;
  /** Callback when drop occurs */
  onDrop: (targetId: number, position: 'before' | 'after' | 'inside') => void;
  /** Search term for highlighting */
  searchTerm: string;
  /** Whether this item is being processed */
  isProcessing: boolean;
}

/**
 * Memoized category tree item component for performance
 */
const CategoryTreeItem = memo(function CategoryTreeItem({
  node,
  depth,
  expandedIds,
  onToggleExpand,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onAddSubcategory,
  onToggleVisibility,
  onMove,
  showCourseCount,
  allowDragDrop,
  dragState,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
  searchTerm,
  isProcessing,
}: CategoryTreeItemProps) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children.length > 0;
  const isDragging = dragState.draggingId === node.id;
  const isDropTarget = dragState.dropTargetId === node.id;

  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);

  // Handle context menu
  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setContextMenu({
        mouseX: event.clientX,
        mouseY: event.clientY,
      });
    },
    []
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle drag events
  const handleDragStart = useCallback(
    (event: React.DragEvent) => {
      if (!allowDragDrop) {return;}
      event.dataTransfer.setData('text/plain', String(node.id));
      event.dataTransfer.effectAllowed = 'move';
      onDragStart(node.id);
    },
    [allowDragDrop, node.id, onDragStart]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      if (!allowDragDrop || isDragging) {return;}
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';

      // Determine drop position based on mouse position
      const rect = event.currentTarget.getBoundingClientRect();
      const y = event.clientY - rect.top;
      const {height} = rect;

      let position: 'before' | 'after' | 'inside';
      if (y < height * 0.25) {
        position = 'before';
      } else if (y > height * 0.75) {
        position = 'after';
      } else {
        position = 'inside';
      }

      onDragEnter(node.id, position);
    },
    [allowDragDrop, isDragging, node.id, onDragEnter]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      if (!allowDragDrop) {return;}
      event.preventDefault();
      const position = dragState.dropPosition ?? 'inside';
      onDrop(node.id, position);
    },
    [allowDragDrop, node.id, dragState.dropPosition, onDrop]
  );

  const handleDragEnd = useCallback(() => {
    onDragEnd();
  }, [onDragEnd]);

  // Highlight matching text
  const highlightText = useCallback(
    (text: string) => {
      if (!searchTerm.trim()) {return text;}
      const regex = new RegExp(`(${searchTerm})`, 'gi');
      const parts = text.split(regex);
      let position = 0;
      return parts.map((part) => {
        const key = `${position}-${part.slice(0, 10)}`;
        position += part.length;
        return regex.test(part) ? (
          <Box
            key={`highlight-${key}`}
            component="span"
            sx={{ backgroundColor: 'warning.light', borderRadius: 0.5 }}
          >
            {part}
          </Box>
        ) : (
          <span key={`text-${key}`}>{part}</span>
        );
      });
    },
    [searchTerm]
  );

  // Get drop indicator styles
  const getDropIndicatorStyle = () => {
    if (!isDropTarget || !dragState.dropPosition) {return {};}

    switch (dragState.dropPosition) {
      case 'before':
        return {
          borderTop: '2px solid',
          borderTopColor: 'primary.main',
        };
      case 'after':
        return {
          borderBottom: '2px solid',
          borderBottomColor: 'primary.main',
        };
      case 'inside':
        return {
          backgroundColor: 'action.selected',
        };
      default:
        return {};
    }
  };

  return (
    <>
      <ListItem
        disablePadding
        draggable={allowDragDrop}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        onContextMenu={handleContextMenu}
        sx={{
          pl: depth * 3,
          opacity: isDragging ? 0.5 : 1,
          ...getDropIndicatorStyle(),
        }}
      >
        <ListItemButton
          selected={isSelected}
          onClick={() => onSelect(node)}
          disabled={isProcessing}
          sx={{ py: 0.5 }}
        >
          {/* Drag handle */}
          {allowDragDrop && (
            <Box
              sx={{
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                mr: 0.5,
                color: 'action.disabled',
                '&:hover': { color: 'text.secondary' },
              }}
            >
              <DragIndicator fontSize="small" />
            </Box>
          )}

          {/* Expand/collapse button */}
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            disabled={!hasChildren}
            sx={{
              mr: 0.5,
              visibility: hasChildren ? 'visible' : 'hidden',
            }}
          >
            {isExpanded ? (
              <ExpandMore fontSize="small" />
            ) : (
              <ChevronRight fontSize="small" />
            )}
          </IconButton>

          {/* Folder icon */}
          <ListItemIcon sx={{ minWidth: 36 }}>
            {isExpanded && hasChildren ? (
              <FolderOpen color={node.visible ? 'primary' : 'disabled'} />
            ) : (
              <Folder color={node.visible ? 'primary' : 'disabled'} />
            )}
          </ListItemIcon>

          {/* Category name and info */}
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isSelected ? 600 : 400,
                    color: node.visible ? 'text.primary' : 'text.disabled',
                  }}
                >
                  {highlightText(node.name)}
                </Typography>
                {showCourseCount && (
                  <Chip
                    size="small"
                    label={node.coursecount}
                    color={node.coursecount > 0 ? 'default' : 'default'}
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.75rem' }}
                  />
                )}
                {!node.visible && (
                  <Tooltip title="Hidden category">
                    <VisibilityOff
                      fontSize="small"
                      color="disabled"
                      sx={{ fontSize: 16 }}
                    />
                  </Tooltip>
                )}
                {isProcessing && <CircularProgress size={16} />}
              </Box>
            }
            secondary={node.idnumber ? `ID: ${node.idnumber}` : undefined}
          />

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Add subcategory">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSubcategory(node.id);
                }}
                disabled={isProcessing}
              >
                <Add fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit category">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(node);
                }}
                disabled={isProcessing}
              >
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={node.visible ? 'Hide category' : 'Show category'}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(node);
                }}
                disabled={isProcessing}
                data-testid={node.visible ? 'visibility-on' : 'visibility-off'}
              >
                {node.visible ? (
                  <Visibility fontSize="small" />
                ) : (
                  <VisibilityOff fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete category">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(node);
                }}
                disabled={isProcessing}
                color="error"
              >
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </ListItemButton>
      </ListItem>

      {/* Context menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem
          onClick={() => {
            handleCloseContextMenu();
            onAddSubcategory(node.id);
          }}
        >
          <ListItemIcon>
            <Add fontSize="small" />
          </ListItemIcon>
          Add subcategory
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleCloseContextMenu();
            onEdit(node);
          }}
        >
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleCloseContextMenu();
            onToggleVisibility(node);
          }}
        >
          <ListItemIcon>
            {node.visible ? (
              <VisibilityOff fontSize="small" />
            ) : (
              <Visibility fontSize="small" />
            )}
          </ListItemIcon>
          {node.visible ? 'Hide' : 'Show'}
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleCloseContextMenu();
            onMove(node);
          }}
        >
          <ListItemIcon>
            <DriveFileMove fontSize="small" />
          </ListItemIcon>
          Move
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleCloseContextMenu();
            onDelete(node);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>

      {/* Render children */}
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          {node.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              selectedId={selectedId}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddSubcategory={onAddSubcategory}
              onToggleVisibility={onToggleVisibility}
              onMove={onMove}
              showCourseCount={showCourseCount}
              allowDragDrop={allowDragDrop}
              dragState={dragState}
              onDragStart={onDragStart}
              onDragEnter={onDragEnter}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
              searchTerm={searchTerm}
              isProcessing={isProcessing}
            />
          ))}
        </List>
      </Collapse>
    </>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * CategoryManagement Component
 *
 * Provides a comprehensive interface for managing course category hierarchy
 * in the Moodle admin interface. Supports CRUD operations, drag-and-drop
 * reordering, and real-time updates via React Query.
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * ```tsx
 * <CategoryManagement
 *   allowDragDrop={true}
 *   showCourseCount={true}
 *   onCategorySelect={(category) => console.log('Selected:', category)}
 * />
 * ```
 */
function CategoryManagement({
  onCategorySelect,
  allowDragDrop = true,
  showCourseCount = true,
  expandAll = false,
}: CategoryManagementProps): React.ReactElement {
  const queryClient = useQueryClient();
  // Note: Using local snackbar state instead of useToast for consistent UI feedback

  // ============================================================================
  // State Management
  // ============================================================================

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Expansion state
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Selection state
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  // Form data
  const [formData, setFormData] = useState<CategoryFormData>(DEFAULT_FORM_DATA);
  const [editingCategory, setEditingCategory] = useState<CourseCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CourseCategory | null>(null);
  const [movingCategory, setMovingCategory] = useState<CourseCategory | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<number>(0);

  // Delete confirmation
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [moveContentsTo, setMoveContentsTo] = useState<number | null>(null);

  // Drag and drop state
  const [dragState, setDragState] = useState<DragState>({
    draggingId: null,
    dropTargetId: null,
    dropPosition: null,
  });

  // Processing state for optimistic updates
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // ============================================================================
  // API Queries and Mutations
  // ============================================================================

  // Fetch categories
  const {
    data: categoriesResponse,
    isLoading,
    isError,
    error: fetchError,
    refetch,
  } = useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<CourseCategory[]>>(
        CATEGORIES_ENDPOINT
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Create category mutation
  const createMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      const response = await apiClient.post<ApiResponse<CourseCategory>>(
        CATEGORIES_ENDPOINT,
        {
          name: data.name,
          parent: data.parent,
          description: data.description,
          visible: data.visible ? 1 : 0,
          idnumber: data.idnumber || undefined,
        }
      );
      return response.data;
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
      setCreateDialogOpen(false);
      setFormData(DEFAULT_FORM_DATA);
      setSnackbar({
        open: true,
        message: `Category "${response.data.name}" created successfully`,
        severity: 'success',
      });
    },
    onError: (err: Error) => {
      setSnackbar({
        open: true,
        message: `Failed to create category: ${err.message}`,
        severity: 'error',
      });
    },
  });

  // Update category mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<CategoryFormData>;
    }) => {
      const response = await apiClient.put<ApiResponse<CourseCategory>>(
        `${CATEGORIES_ENDPOINT}/${id}`,
        {
          name: data.name,
          description: data.description,
          visible: data.visible !== undefined ? (data.visible ? 1 : 0) : undefined,
          idnumber: data.idnumber,
        }
      );
      return response.data;
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
      setEditDialogOpen(false);
      setEditingCategory(null);
      setSnackbar({
        open: true,
        message: `Category "${response.data.name}" updated successfully`,
        severity: 'success',
      });
    },
    onError: (err: Error) => {
      setSnackbar({
        open: true,
        message: `Failed to update category: ${err.message}`,
        severity: 'error',
      });
    },
  });

  // Delete category mutation
  const deleteMutation = useMutation({
    mutationFn: async ({
      id,
      moveTo,
    }: {
      id: number;
      moveTo?: number;
    }) => {
      const params = moveTo !== undefined ? { moveTo } : undefined;
      const response = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
        `${CATEGORIES_ENDPOINT}/${id}`,
        { params }
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
      setDeleteDialogOpen(false);
      setDeletingCategory(null);
      setDeleteConfirmed(false);
      setMoveContentsTo(null);
      setSnackbar({
        open: true,
        message: 'Category deleted successfully',
        severity: 'success',
      });
    },
    onError: (err: Error) => {
      setSnackbar({
        open: true,
        message: `Failed to delete category: ${err.message}`,
        severity: 'error',
      });
    },
  });

  // Move category mutation
  const moveMutation = useMutation({
    mutationFn: async ({
      categoryId,
      newParentId,
    }: {
      categoryId: number;
      newParentId: number;
    }) => {
      return moveCategory(categoryId, newParentId);
    },
    onMutate: ({ categoryId }) => {
      setProcessingIds((prev) => new Set(prev).add(categoryId));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
      setMoveDialogOpen(false);
      setMovingCategory(null);
      setMoveTargetId(0);
      setSnackbar({
        open: true,
        message: 'Category moved successfully',
        severity: 'success',
      });
    },
    onError: (err: Error) => {
      setSnackbar({
        open: true,
        message: `Failed to move category: ${err.message}`,
        severity: 'error',
      });
    },
    onSettled: (_, __, { categoryId }) => {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(categoryId);
        return next;
      });
    },
  });

  // Toggle visibility mutation
  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({
      id,
      visible,
    }: {
      id: number;
      visible: boolean;
    }) => {
      const response = await apiClient.put<ApiResponse<CourseCategory>>(
        `${CATEGORIES_ENDPOINT}/${id}`,
        { visible: visible ? 1 : 0 }
      );
      return response.data;
    },
    onMutate: ({ id }) => {
      setProcessingIds((prev) => new Set(prev).add(id));
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
      setSnackbar({
        open: true,
        message: `Category "${response.data.name}" is now ${
          response.data.visible ? 'visible' : 'hidden'
        }`,
        severity: 'info',
      });
    },
    onError: (err: Error) => {
      setSnackbar({
        open: true,
        message: `Failed to update visibility: ${err.message}`,
        severity: 'error',
      });
    },
    onSettled: (_, __, { id }) => {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
  });

  // ============================================================================
  // Computed Values
  // ============================================================================

  // Build category tree from flat list
  const categoryTree = useMemo(() => {
    if (!categoriesResponse?.data) {return [];}
    return buildCategoryTree(categoriesResponse.data);
  }, [categoriesResponse?.data]);

  // Filter tree by search term
  const filteredTree = useMemo(() => {
    return filterCategoryTree(categoryTree, debouncedSearchTerm);
  }, [categoryTree, debouncedSearchTerm]);

  // Get flat list for parent selector
  const flatCategories = useMemo(() => {
    return categoriesResponse?.data ?? [];
  }, [categoriesResponse?.data]);

  // ============================================================================
  // Effect Hooks
  // ============================================================================

  // Expand all on mount if requested
  useEffect(() => {
    if (expandAll && categoriesResponse?.data) {
      setExpandedIds(new Set(categoriesResponse.data.map((c) => c.id)));
    }
  }, [expandAll, categoriesResponse?.data]);

  // Expand matching categories when searching
  useEffect(() => {
    if (debouncedSearchTerm.trim()) {
      // Expand all categories to show search results
      const allIds = flatCategories.map((c) => c.id);
      setExpandedIds(new Set(allIds));
    }
  }, [debouncedSearchTerm, flatCategories]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  // Toggle category expansion
  const handleToggleExpand = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Expand all categories
  const handleExpandAll = useCallback(() => {
    setExpandedIds(new Set(flatCategories.map((c) => c.id)));
  }, [flatCategories]);

  // Collapse all categories
  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  // Select category
  const handleSelect = useCallback(
    (category: CourseCategory) => {
      setSelectedId(category.id);
      onCategorySelect?.(category);
    },
    [onCategorySelect]
  );

  // Open create dialog
  const handleOpenCreate = useCallback((parentId: number = 0) => {
    setFormData({
      ...DEFAULT_FORM_DATA,
      parent: parentId,
    });
    setCreateDialogOpen(true);
  }, []);

  // Open edit dialog
  const handleOpenEdit = useCallback((category: CourseCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description ?? '',
      parent: category.parent,
      visible: category.visible === 1,
      idnumber: category.idnumber ?? '',
    });
    setEditDialogOpen(true);
  }, []);

  // Open delete dialog
  const handleOpenDelete = useCallback((category: CourseCategory) => {
    setDeletingCategory(category);
    setDeleteConfirmed(false);
    setMoveContentsTo(null);
    setDeleteDialogOpen(true);
  }, []);

  // Open move dialog
  const handleOpenMove = useCallback((category: CourseCategory) => {
    setMovingCategory(category);
    setMoveTargetId(category.parent);
    setMoveDialogOpen(true);
  }, []);

  // Toggle visibility
  const handleToggleVisibility = useCallback(
    (category: CourseCategory) => {
      toggleVisibilityMutation.mutate({
        id: category.id,
        visible: category.visible !== 1,
      });
    },
    [toggleVisibilityMutation]
  );

  // Submit create form
  const handleCreateSubmit = useCallback(() => {
    if (!formData.name.trim()) {
      setSnackbar({
        open: true,
        message: 'Category name is required',
        severity: 'warning',
      });
      return;
    }
    createMutation.mutate(formData);
  }, [formData, createMutation]);

  // Submit edit form
  const handleEditSubmit = useCallback(() => {
    if (!editingCategory || !formData.name.trim()) {
      setSnackbar({
        open: true,
        message: 'Category name is required',
        severity: 'warning',
      });
      return;
    }
    updateMutation.mutate({
      id: editingCategory.id,
      data: formData,
    });
  }, [editingCategory, formData, updateMutation]);

  // Submit delete
  const handleDeleteSubmit = useCallback(() => {
    if (!deletingCategory) {return;}

    const hasContents =
      deletingCategory.coursecount > 0 ||
      categoryTree.some(
        (node) =>
          node.id === deletingCategory.id && node.children.length > 0
      );

    if (hasContents && !deleteConfirmed) {
      setSnackbar({
        open: true,
        message: 'Please confirm deletion of category with contents',
        severity: 'warning',
      });
      return;
    }

    deleteMutation.mutate({
      id: deletingCategory.id,
      moveTo: moveContentsTo ?? undefined,
    });
  }, [
    deletingCategory,
    deleteConfirmed,
    moveContentsTo,
    categoryTree,
    deleteMutation,
  ]);

  // Submit move
  const handleMoveSubmit = useCallback(() => {
    if (!movingCategory) {return;}

    // Validate move operation
    const descendantIds = getDescendantIds(movingCategory.id, categoryTree);
    if (descendantIds.includes(moveTargetId)) {
      setSnackbar({
        open: true,
        message: 'Cannot move a category into its own descendants',
        severity: 'error',
      });
      return;
    }

    moveMutation.mutate({
      categoryId: movingCategory.id,
      newParentId: moveTargetId,
    });
  }, [movingCategory, moveTargetId, categoryTree, moveMutation]);

  // Drag and drop handlers
  const handleDragStart = useCallback((id: number) => {
    setDragState({
      draggingId: id,
      dropTargetId: null,
      dropPosition: null,
    });
  }, []);

  const handleDragEnter = useCallback(
    (id: number, position: 'before' | 'after' | 'inside') => {
      if (!dragState.draggingId || dragState.draggingId === id) {return;}

      // Validate drop target
      const descendantIds = getDescendantIds(
        dragState.draggingId,
        categoryTree
      );
      if (descendantIds.includes(id)) {return;}

      setDragState((prev) => ({
        ...prev,
        dropTargetId: id,
        dropPosition: position,
      }));
    },
    [dragState.draggingId, categoryTree]
  );

  const handleDragEnd = useCallback(() => {
    setDragState({
      draggingId: null,
      dropTargetId: null,
      dropPosition: null,
    });
  }, []);

  const handleDrop = useCallback(
    (targetId: number, position: 'before' | 'after' | 'inside') => {
      const { draggingId } = dragState;
      if (!draggingId || draggingId === targetId) {
        handleDragEnd();
        return;
      }

      // Find target category
      const targetCategory = flatCategories.find((c) => c.id === targetId);
      if (!targetCategory) {
        handleDragEnd();
        return;
      }

      let newParentId: number;
      if (position === 'inside') {
        newParentId = targetId;
      } else {
        newParentId = targetCategory.parent;
      }

      // Execute move
      moveMutation.mutate({
        categoryId: draggingId,
        newParentId,
      });

      handleDragEnd();
    },
    [dragState, flatCategories, moveMutation, handleDragEnd]
  );

  // Close snackbar
  const handleCloseSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  // Loading state
  if (isLoading) {
    return (
      <Paper sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={48} sx={{ mb: 2 }} />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            height={40}
            sx={{ mb: 1, ml: i % 2 === 0 ? 4 : 0 }}
          />
        ))}
      </Paper>
    );
  }

  // Error state
  if (isError) {
    return (
      <Paper sx={{ p: 2 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          Failed to load categories:{' '}
          {fetchError instanceof Error ? fetchError.message : 'Unknown error'}
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography variant="h6" component="h2">
          Category Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenCreate(0)}
        >
          Add Category
        </Button>
      </Box>

      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 2,
        }}
      >
        {/* Search */}
        <TextField
          size="small"
          placeholder="Search categories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setSearchTerm('')}
                  edge="end"
                >
                  <Clear fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, maxWidth: 300 }}
        />

        {/* Expand/Collapse buttons */}
        <Tooltip title="Expand all">
          <IconButton onClick={handleExpandAll}>
            <UnfoldMore />
          </IconButton>
        </Tooltip>
        <Tooltip title="Collapse all">
          <IconButton onClick={handleCollapseAll}>
            <UnfoldLess />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Category Tree */}
      {filteredTree.length === 0 ? (
        <Box
          sx={{
            py: 4,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <Folder sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
          <Typography>
            {debouncedSearchTerm
              ? 'No categories match your search'
              : 'No categories found'}
          </Typography>
        </Box>
      ) : (
        <List component="nav" disablePadding>
          {filteredTree.map((node) => (
            <CategoryTreeItem
              key={node.id}
              node={node}
              depth={0}
              expandedIds={expandedIds}
              onToggleExpand={handleToggleExpand}
              selectedId={selectedId}
              onSelect={handleSelect}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
              onAddSubcategory={handleOpenCreate}
              onToggleVisibility={handleToggleVisibility}
              onMove={handleOpenMove}
              showCourseCount={showCourseCount}
              allowDragDrop={allowDragDrop}
              dragState={dragState}
              onDragStart={handleDragStart}
              onDragEnter={handleDragEnter}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              searchTerm={debouncedSearchTerm}
              isProcessing={processingIds.has(node.id)}
            />
          ))}
        </List>
      )}

      {/* Create Category Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Category</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Category Name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
              fullWidth
              inputProps={{ 'aria-label': 'Category name' }}
              error={formData.name.length > 255}
              helperText={
                formData.name.length > 255
                  ? 'Name must be 255 characters or less'
                  : undefined
              }
            />
            <FormControl fullWidth>
              <InputLabel>Parent Category</InputLabel>
              <Select
                value={formData.parent}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    parent: Number(e.target.value),
                  }))
                }
                label="Parent Category"
              >
                <MenuItem value={0}>Top level</MenuItem>
                {flatCategories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {'—'.repeat(cat.depth)} {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="ID Number (optional)"
              value={formData.idnumber}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, idnumber: e.target.value }))
              }
              fullWidth
              helperText="External identifier for integration purposes"
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              multiline
              rows={3}
              fullWidth
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.visible}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, visible: e.target.checked }))
                  }
                />
              }
              label="Visible to users"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateSubmit}
            disabled={createMutation.isPending || !formData.name.trim()}
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Category</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Category Name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
              fullWidth
              inputProps={{ 'aria-label': 'Category name input' }}
              error={formData.name.length > 255}
              helperText={
                formData.name.length > 255
                  ? 'Name must be 255 characters or less'
                  : undefined
              }
            />
            <TextField
              label="ID Number (optional)"
              value={formData.idnumber}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, idnumber: e.target.value }))
              }
              fullWidth
              helperText="External identifier for integration purposes"
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              multiline
              rows={3}
              fullWidth
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.visible}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, visible: e.target.checked }))
                  }
                />
              }
              label="Visible to users"
            />
            {editingCategory && editingCategory.coursecount > 0 && (
              <Alert severity="info">
                This category contains {editingCategory.coursecount} course(s).
                Use the Move dialog to change the parent category.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleEditSubmit}
            disabled={updateMutation.isPending || !formData.name.trim()}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="error" />
          Delete Category
        </DialogTitle>
        <DialogContent>
          {deletingCategory && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography>
                Are you sure you want to delete the category{' '}
                <strong>{deletingCategory.name}</strong>?
              </Typography>

              {deletingCategory.coursecount > 0 && (
                <Alert severity="warning">
                  This category contains {deletingCategory.coursecount} course(s).
                  <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>Move courses to</InputLabel>
                    <Select
                      value={moveContentsTo ?? ''}
                      onChange={(e) =>
                        setMoveContentsTo(
                          e.target.value === '' ? null : Number(e.target.value)
                        )
                      }
                      label="Move courses to"
                    >
                      <MenuItem value="">Delete courses</MenuItem>
                      {flatCategories
                        .filter((c) => c.id !== deletingCategory.id)
                        .map((cat) => (
                          <MenuItem key={cat.id} value={cat.id}>
                            {'—'.repeat(cat.depth)} {cat.name}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </Alert>
              )}

              {(deletingCategory.coursecount > 0 ||
                categoryTree.some(
                  (node) =>
                    node.id === deletingCategory.id && node.children.length > 0
                )) && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={deleteConfirmed}
                      onChange={(e) => setDeleteConfirmed(e.target.checked)}
                    />
                  }
                  label="I understand this action cannot be undone"
                />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteSubmit}
            disabled={
              deleteMutation.isPending ||
              ((deletingCategory?.coursecount ?? 0) > 0 && !deleteConfirmed)
            }
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move Category Dialog */}
      <Dialog
        open={moveDialogOpen}
        onClose={() => setMoveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DriveFileMove />
          Move Category
        </DialogTitle>
        <DialogContent>
          {movingCategory && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Typography>
                Move <strong>{movingCategory.name}</strong> to:
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Target Parent</InputLabel>
                <Select
                  value={moveTargetId}
                  onChange={(e) => setMoveTargetId(Number(e.target.value))}
                  label="Target Parent"
                >
                  <MenuItem value={0}>Top level</MenuItem>
                  {flatCategories
                    .filter((cat) => {
                      // Exclude self and descendants
                      if (cat.id === movingCategory.id) {return false;}
                      const descendantIds = getDescendantIds(
                        movingCategory.id,
                        categoryTree
                      );
                      return !descendantIds.includes(cat.id);
                    })
                    .map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {'—'.repeat(cat.depth)} {cat.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              {moveTargetId !== movingCategory.parent && (
                <Alert severity="info">
                  Current parent:{' '}
                  {movingCategory.parent === 0
                    ? 'Top level'
                    : flatCategories.find((c) => c.id === movingCategory.parent)
                        ?.name ?? 'Unknown'}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleMoveSubmit}
            disabled={
              moveMutation.isPending ||
              moveTargetId === movingCategory?.parent
            }
          >
            {moveMutation.isPending ? 'Moving...' : 'Move'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
}

export default CategoryManagement;
