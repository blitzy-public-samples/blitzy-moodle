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

import type React from 'react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { TreeView, TreeItem } from '@mui/x-tree-view';
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

import { fetchScormToc } from '@/features/activities/scorm/api/scormApi';
import { scormQueryKeys } from '@/features/activities/scorm/hooks/useScorm';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Alert } from '@/components/feedback/Alert';
import { ScormStatus, ScormTocDisplay } from '@/features/activities/scorm/types/scorm.types';
import type { 
  Scorm, 
  ScormTOCNode,
  ScormToc,
  ScormScore,
} from '@/features/activities/scorm/types/scorm.types';

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
  /** Organization identifier for SCORM packages with multiple organizations */
  organization?: string;
  /** Callback when SCO is selected */
  onScoSelect?: (scoId: number) => void;
}

/**
 * Convert ScormScore object to display string
 */
const formatScore = (score?: ScormScore): string | undefined => {
  if (!score) {return undefined;}
  
  // Prefer scaled score for SCORM 2004 (displayed as percentage)
  if (score.scaled !== undefined) {
    return `${Math.round(score.scaled * 100)}%`;
  }
  
  // Fall back to raw score
  if (score.raw !== undefined) {
    // If we have max, show as fraction
    if (score.max !== undefined) {
      return `${score.raw}/${score.max}`;
    }
    return `${score.raw}`;
  }
  
  return undefined;
};

/**
 * Get status icon component based on SCO status
 */
const getStatusIcon = (status: ScormStatus | undefined, isEnabled: boolean): React.ReactNode => {
  if (!isEnabled) {
    return <LockIcon fontSize="small" color="disabled" />;
  }

  if (!status) {
    return <NotAttemptedIcon fontSize="small" color="action" />;
  }

  switch (status) {
    case ScormStatus.COMPLETED:
    case ScormStatus.PASSED:
      return <CheckCircleIcon fontSize="small" color="success" />;
    case ScormStatus.FAILED:
      return <CancelIcon fontSize="small" color="error" />;
    case ScormStatus.INCOMPLETE:
    case ScormStatus.BROWSED:
      return <PlayIcon fontSize="small" color="primary" />;
    case ScormStatus.NOT_ATTEMPTED:
    default:
      return <NotAttemptedIcon fontSize="small" color="action" />;
  }
};

/**
 * Get status chip configuration based on SCO status
 */
const getStatusChip = (
  status: ScormStatus | undefined,
  score?: string,
  isEnabled: boolean = true
): { label: string; color: 'default' | 'primary' | 'success' | 'error' | 'warning' } | null => {
  if (!isEnabled) {
    return { label: 'Locked', color: 'default' };
  }

  if (!status) {
    return null; // No status available
  }

  switch (status) {
    case ScormStatus.COMPLETED:
      return { label: score ? `Completed (${score})` : 'Completed', color: 'success' };
    case ScormStatus.PASSED:
      return { label: score ? `Passed (${score})` : 'Passed', color: 'success' };
    case ScormStatus.FAILED:
      return { label: score ? `Failed (${score})` : 'Failed', color: 'error' };
    case ScormStatus.INCOMPLETE:
      return { label: 'Incomplete', color: 'warning' };
    case ScormStatus.BROWSED:
      return { label: 'Browsed', color: 'primary' };
    case ScormStatus.NOT_ATTEMPTED:
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

function ScormTreeItem({
  node,
  currentScoId,
  onScoSelect,
}: ScormTreeItemProps): JSX.Element {
  const theme = useTheme();
  const isActive = currentScoId === node.id;
  const statusChip = getStatusChip(node.status, formatScore(node.score), node.isEnabled);

  const handleClick = (event: React.MouseEvent) => {
    // Only allow navigation if enabled and is a leaf node (has launch URL)
    if (node.isEnabled && node.launch) {
      event.stopPropagation();
      onScoSelect(node.id);
    }
  };

  // Build label with status indicators
  const labelContent = (
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
          fontWeight: isActive ? 'bold' : 400,
        }}
      >
        {node.title}
      </Typography>

      {/* Status Chip */}
      {statusChip && (
        <Chip
          data-testid="sco-status-chip"
          label={statusChip.label}
          color={statusChip.color}
          size="small"
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
      )}

      {/* Prerequisite warning icon */}
      {!node.isEnabled && node.prerequisite && (
        <LockIcon fontSize="small" color="disabled" />
      )}
    </Box>
  );

  // Wrap label with tooltip if there's a prerequisite message
  const label = !node.isEnabled && node.prerequisite ? (
    <Tooltip title={node.prerequisite} arrow>
      {labelContent}
    </Tooltip>
  ) : (
    labelContent
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
    <TreeItem 
      nodeId={node.id.toString()} 
      label={label}
      style={{
        fontWeight: isActive ? 'bold' : 400,
      }}
    >
      {renderChildren()}
    </TreeItem>
  );
}

/**
 * Main ScormTOC Component
 * 
 * Displays the hierarchical table of contents for a SCORM package with
 * navigation, status indicators, and prerequisite checking.
 */
function ScormTOC({
  scormId,
  attempt,
  currentScoId,
  scorm,
  organization,
  onScoSelect,
}: ScormTOCProps): JSX.Element | null {
  const navigate = useNavigate();
  const theme = useTheme();

  // Check if TOC should be hidden based on SCORM settings
  const shouldHideTOC = scorm?.hidetoc === ScormTocDisplay.DISABLED;

  // Fetch TOC data using React Query (always called to comply with Rules of Hooks)
  const {
    data: tocResponse,
    isLoading,
    isError,
    error,
  } = useQuery<ScormToc, Error>({
    queryKey: scormQueryKeys.toc(scormId, attempt, organization),
    queryFn: () =>
      fetchScormToc(scormId, {
        attempt,
        organization,
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
    retry: false, // Disable retries for faster error display
    refetchOnWindowFocus: false,
  });

  /**
   * Tree data is already hierarchical from the backend (scorm_get_toc_object)
   * No transformation needed - just use tocResponse.scoes directly
   */

  /**
   * Get list of expanded items (all parent nodes with children)
   * This ensures the tree is fully expanded by default
   */
  const defaultExpandedItems = useMemo(() => {
    if (!tocResponse?.scoes) {return [];}

    const expandedIds: string[] = [];
    
    // Recursive function to collect all nodes with children
    const collectExpandedNodes = (nodes: ScormTOCNode[]) => {
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          expandedIds.push(node.id.toString());
          collectExpandedNodes(node.children);
        }
      });
    };

    collectExpandedNodes(tocResponse.scoes);
    return expandedIds;
  }, [tocResponse]);

  /**
   * Calculate completion statistics for display
   * NOTE: This must be before any early returns to comply with Rules of Hooks
   */
  const stats = useMemo(() => {
    if (!tocResponse?.scoes) {
      return { total: 0, completed: 0, percentage: 0 };
    }

    // Recursively flatten the tree to get all nodes
    const flattenNodes = (nodes: ScormTOCNode[]): ScormTOCNode[] => {
      const result: ScormTOCNode[] = [];
      nodes.forEach((node) => {
        result.push(node);
        if (node.children && node.children.length > 0) {
          result.push(...flattenNodes(node.children));
        }
      });
      return result;
    };

    const allNodes = flattenNodes(tocResponse.scoes);
    
    // Only count leaf nodes (SCOs with launch URLs)
    const launchableNodes = allNodes.filter((node) => node.launch);
    const total = launchableNodes.length;
    const completed = launchableNodes.filter(
      (node) => node.status === ScormStatus.COMPLETED || node.status === ScormStatus.PASSED
    ).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, percentage };
  }, [tocResponse]);

  /**
   * Helper function to find a node by ID in the tree
   */
  const findNodeById = (nodes: ScormTOCNode[], id: number): ScormTOCNode | null => {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const found = findNodeById(node.children, id);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  /**
   * Handle SCO selection and navigation
   */
  const handleScoSelect = (scoId: number) => {
    // Find the node to check if it's enabled and launchable
    if (tocResponse?.scoes) {
      const node = findNodeById(tocResponse.scoes, scoId);
      
      // Don't navigate if node is disabled
      if (node && !node.isEnabled) {
        return;
      }
      
      // Don't navigate if node doesn't have a launch URL (organizational nodes)
      if (node && !node.launch) {
        return;
      }
    }

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

  // Return null if TOC should be hidden (check after all hooks)
  if (shouldHideTOC) {
    return null;
  }

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
  if (!tocResponse?.scoes || tocResponse.scoes.length === 0) {
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
            {scorm?.name ?? 'Table of Contents'}
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
        <TreeView
          defaultExpanded={defaultExpandedItems}
          defaultSelected={currentScoId?.toString()}
          onNodeSelect={(_event: React.SyntheticEvent, nodeId: string) => {
            // nodeId comes as string from TreeView
            const numericId = parseInt(nodeId, 10);
            if (!isNaN(numericId)) {
              handleScoSelect(numericId);
            }
          }}
        >
          {tocResponse.scoes.map((node) => (
            <ScormTreeItem
              key={node.id}
              node={node}
              currentScoId={currentScoId}
              onScoSelect={handleScoSelect}
            />
          ))}
        </TreeView>
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
            <Typography variant="caption">Complete/Pass</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CancelIcon fontSize="small" color="error" />
            <Typography variant="caption">Failure</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PlayIcon fontSize="small" color="primary" />
            <Typography variant="caption">In Progress</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <NotAttemptedIcon fontSize="small" color="action" />
            <Typography variant="caption">Not Started</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LockIcon fontSize="small" color="disabled" />
            <Typography variant="caption">Locked</Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

export default ScormTOC;
