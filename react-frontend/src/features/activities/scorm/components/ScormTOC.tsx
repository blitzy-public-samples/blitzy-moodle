/**
 * ScormTOC Component
 * 
 * React component for SCORM Table of Contents navigation displaying hierarchical 
 * SCORM package structure with SCO (Sharable Content Object) tree, navigation 
 * between items, completion status indicators, and support for both SCORM 1.2 
 * and SCORM 2004 organizations.
 * 
 * Replicates functionality from scorm_get_toc() and scorm_get_toc_object() PHP functions
 * from public/mod/scorm/locallib.php.
 * 
 * Features:
 * - Hierarchical tree structure with collapsible sections
 * - Completion and status indicators (completed, incomplete, passed, failed)
 * - Navigation to SCO content with React Router
 * - Support for SCORM 1.2 and SCORM 2004 formats
 * - Prerequisite checking and disabled states
 * - Score display for graded content
 * 
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import {
  Box,
  Typography,
  Chip,
  Stack,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  RadioButtonUnchecked as NotAttemptedIcon,
  Lock as LockIcon,
  PlayCircleOutline as PlayIcon,
} from '@mui/icons-material';

import { fetchScormToc } from '../api/scormApi';
import { scormQueryKeys } from '../hooks/useScorm';
import { LoadingSpinner } from '../../../../components/feedback/LoadingSpinner';
import { Alert } from '../../../../components/feedback/Alert';
import type { 
  Scorm, 
  ScormTOCNode, 
  ScormStatus,
  GetTOCResponse,
} from '../types/scorm.types';

/**
 * Props for ScormTOC component
 */
interface ScormTOCProps {
  /** SCORM activity ID */
  scormId: number;
  /** Current attempt number */
  attempt?: number;
  /** Currently active SCO ID for highlighting */
  currentScoId?: number;
  /** SCORM activity configuration */
  scorm?: Scorm;
  /** Callback when SCO is selected */
  onScoSelect?: (scoId: number) => void;
}

/**
 * Get status icon component based on SCO status
 */
const getStatusIcon = (status: ScormStatus, isEnabled: boolean): React.ReactNode => {
  if (!isEnabled) {
    return <LockIcon fontSize="small" color="disabled" />;
  }

  switch (status) {
    case 'completed':
    case 'passed':
      return <CheckCircleIcon fontSize="small" color="success" />;
    case 'failed':
      return <CancelIcon fontSize="small" color="error" />;
    case 'incomplete':
    case 'browsed':
      return <PlayIcon fontSize="small" color="primary" />;
    case 'not_attempted':
    default:
      return <NotAttemptedIcon fontSize="small" color="action" />;
  }
};

/**
 * Get status chip configuration based on SCO status
 */
const getStatusChip = (
  status: ScormStatus,
  score?: string,
  isEnabled: boolean = true
): { label: string; color: 'default' | 'primary' | 'success' | 'error' | 'warning' } | null => {
  if (!isEnabled) {
    return { label: 'Locked', color: 'default' };
  }

  switch (status) {
    case 'completed':
      return { label: score ? `Completed (${score})` : 'Completed', color: 'success' };
    case 'passed':
      return { label: score ? `Passed (${score})` : 'Passed', color: 'success' };
    case 'failed':
      return { label: score ? `Failed (${score})` : 'Failed', color: 'error' };
    case 'incomplete':
      return { label: 'Incomplete', color: 'warning' };
    case 'browsed':
      return { label: 'Browsed', color: 'primary' };
    case 'not_attempted':
      return null; // Don't show chip for not attempted
    default:
      return null;
  }
};

/**
 * TreeItem component for individual SCO with status indicators
 */
interface ScormTreeItemProps {
  node: ScormTOCNode;
  currentScoId?: number;
  onScoSelect: (scoId: number) => void;
}

const ScormTreeItem: React.FC<ScormTreeItemProps> = ({
  node,
  currentScoId,
  onScoSelect,
}) => {
  const theme = useTheme();
  const isActive = currentScoId === node.id;
  const statusChip = getStatusChip(node.status, node.score, node.isEnabled);

  const handleClick = (event: React.MouseEvent) => {
    // Only allow navigation if enabled and is a leaf node (has launch URL)
    if (node.isEnabled && node.launch) {
      event.stopPropagation();
      onScoSelect(node.id);
    }
  };

  // Build label with status indicators
  const label = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.5,
        px: 1,
        borderRadius: 1,
        cursor: node.isEnabled && node.launch ? 'pointer' : 'default',
        backgroundColor: isActive
          ? alpha(theme.palette.primary.main, 0.1)
          : 'transparent',
        '&:hover': node.isEnabled && node.launch
          ? {
              backgroundColor: alpha(
                theme.palette.primary.main,
                isActive ? 0.15 : 0.05
              ),
            }
          : {},
      }}
      onClick={handleClick}
    >
      {/* Status Icon */}
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {getStatusIcon(node.status, node.isEnabled)}
      </Box>

      {/* Title */}
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          color: !node.isEnabled
            ? theme.palette.text.disabled
            : isActive
            ? theme.palette.primary.main
            : theme.palette.text.primary,
          fontWeight: isActive ? 600 : 400,
        }}
      >
        {node.title}
      </Typography>

      {/* Status Chip */}
      {statusChip && (
        <Chip
          label={statusChip.label}
          color={statusChip.color}
          size="small"
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
      )}

      {/* Prerequisite warning tooltip */}
      {!node.isEnabled && node.prereqMessage && (
        <Tooltip title={node.prereqMessage} arrow>
          <LockIcon fontSize="small" color="disabled" />
        </Tooltip>
      )}
    </Box>
  );

  // Recursively render children
  const renderChildren = () => {
    if (!node.children || node.children.length === 0) {
      return null;
    }

    return node.children.map((child) => (
      <ScormTreeItem
        key={child.id}
        node={child}
        currentScoId={currentScoId}
        onScoSelect={onScoSelect}
      />
    ));
  };

  return (
    <TreeItem itemId={node.id.toString()} label={label}>
      {renderChildren()}
    </TreeItem>
  );
};

/**
 * Main ScormTOC Component
 * 
 * Displays the hierarchical table of contents for a SCORM package with
 * navigation, status indicators, and prerequisite checking.
 */
const ScormTOC: React.FC<ScormTOCProps> = ({
  scormId,
  attempt,
  currentScoId,
  scorm,
  onScoSelect,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();

  // Fetch TOC data using React Query
  const {
    data: tocResponse,
    isLoading,
    isError,
    error,
  } = useQuery<GetTOCResponse, Error>({
    queryKey: scormQueryKeys.toc(scormId, attempt),
    queryFn: () =>
      fetchScormToc({
        scormId,
        attempt,
        includeStatus: true,
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
    retry: 2,
    refetchOnWindowFocus: false,
  });

  /**
   * Transform flat TOC array into hierarchical tree structure
   * Memoized to prevent recalculation on every render
   */
  const treeData = useMemo(() => {
    if (!tocResponse?.nodes || tocResponse.nodes.length === 0) {
      return [];
    }

    // Create a map of all nodes by ID for quick lookup
    const nodeMap = new Map<number, ScormTOCNode>();
    tocResponse.nodes.forEach((node) => {
      nodeMap.set(node.id, { ...node, children: [] });
    });

    // Build the tree structure by assigning children to parents
    const rootNodes: ScormTOCNode[] = [];

    tocResponse.nodes.forEach((node) => {
      const treeNode = nodeMap.get(node.id);
      if (!treeNode) return;

      if (node.parent === null || node.parent === 0 || node.parent === '0') {
        // This is a root node
        rootNodes.push(treeNode);
      } else {
        // This is a child node, add it to its parent
        const parentId = typeof node.parent === 'string' ? parseInt(node.parent, 10) : node.parent;
        const parentNode = nodeMap.get(parentId);
        if (parentNode) {
          if (!parentNode.children) {
            parentNode.children = [];
          }
          parentNode.children.push(treeNode);
        } else {
          // Parent not found, treat as root
          rootNodes.push(treeNode);
        }
      }
    });

    return rootNodes;
  }, [tocResponse]);

  /**
   * Get list of expanded items (all parent nodes with children)
   * This ensures the tree is fully expanded by default
   */
  const defaultExpandedItems = useMemo(() => {
    if (!tocResponse?.nodes) return [];

    return tocResponse.nodes
      .filter((node) => {
        // Check if this node has children
        const hasChildren = tocResponse.nodes.some(
          (n) => n.parent === node.id || n.parent === node.id.toString()
        );
        return hasChildren;
      })
      .map((node) => node.id.toString());
  }, [tocResponse]);

  /**
   * Handle SCO selection and navigation
   */
  const handleScoSelect = (scoId: number) => {
    // Call optional callback
    if (onScoSelect) {
      onScoSelect(scoId);
    }

    // Navigate to SCORM player with selected SCO
    navigate(`/scorm/${scormId}/player`, {
      state: {
        scoId,
        attempt,
      },
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 200,
          py: 4,
        }}
      >
        <LoadingSpinner size="large" message="Loading SCORM content..." />
      </Box>
    );
  }

  // Error state
  if (isError) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="error"
          title="Failed to Load SCORM Content"
          message={
            error?.message ||
            'Unable to load the SCORM table of contents. Please try again later.'
          }
        />
      </Box>
    );
  }

  // Empty state
  if (!tocResponse || !treeData || treeData.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="info"
          title="No Content Available"
          message="This SCORM package does not contain any content to display."
        />
      </Box>
    );
  }

  // Check if TOC should be hidden based on SCORM settings
  const shouldHideTOC = scorm?.hidetoc === 3; // SCORM_TOC_HIDDEN = 3

  if (shouldHideTOC) {
    return null;
  }

  /**
   * Calculate completion statistics for display
   */
  const stats = useMemo(() => {
    if (!tocResponse?.nodes) {
      return { total: 0, completed: 0, percentage: 0 };
    }

    // Only count leaf nodes (SCOs with launch URLs)
    const launchableNodes = tocResponse.nodes.filter((node) => node.launch);
    const total = launchableNodes.length;
    const completed = launchableNodes.filter(
      (node) => node.status === 'completed' || node.status === 'passed'
    ).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, percentage };
  }, [tocResponse]);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.palette.background.paper,
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      {/* Header with title and completion stats */}
      <Box
        sx={{
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: alpha(theme.palette.primary.main, 0.05),
        }}
      >
        <Stack spacing={1}>
          <Typography variant="h6" component="h2">
            {tocResponse.title || 'Table of Contents'}
          </Typography>

          {/* Completion progress */}
          {stats.total > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Progress:
              </Typography>
              <Chip
                label={`${stats.completed} / ${stats.total} (${stats.percentage}%)`}
                size="small"
                color={stats.percentage === 100 ? 'success' : 'default'}
                variant={stats.percentage > 0 ? 'filled' : 'outlined'}
              />
            </Box>
          )}

          {/* Organization selector (for SCORM 2004 packages with multiple orgs) */}
          {tocResponse.organizations && tocResponse.organizations.length > 1 && (
            <Typography variant="caption" color="text.secondary">
              Organization: {tocResponse.currentOrganization || 'Default'}
            </Typography>
          )}
        </Stack>
      </Box>

      {/* Tree View */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          '& .MuiTreeItem-content': {
            padding: 0,
          },
          '& .MuiTreeItem-label': {
            padding: 0,
          },
        }}
      >
        <SimpleTreeView
          defaultExpandedItems={defaultExpandedItems}
          selectedItems={currentScoId?.toString()}
        >
          {treeData.map((node) => (
            <ScormTreeItem
              key={node.id}
              node={node}
              currentScoId={currentScoId}
              onScoSelect={handleScoSelect}
            />
          ))}
        </SimpleTreeView>
      </Box>

      {/* Footer with legend */}
      <Box
        sx={{
          p: 2,
          borderTop: `1px solid ${theme.palette.divider}`,
          backgroundColor: alpha(theme.palette.background.default, 0.5),
        }}
      >
        <Typography variant="caption" color="text.secondary" component="div">
          <strong>Status Legend:</strong>
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CheckCircleIcon fontSize="small" color="success" />
            <Typography variant="caption">Completed/Passed</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CancelIcon fontSize="small" color="error" />
            <Typography variant="caption">Failed</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PlayIcon fontSize="small" color="primary" />
            <Typography variant="caption">In Progress</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <NotAttemptedIcon fontSize="small" color="action" />
            <Typography variant="caption">Not Attempted</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LockIcon fontSize="small" color="disabled" />
            <Typography variant="caption">Locked</Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
};

export default ScormTOC;
