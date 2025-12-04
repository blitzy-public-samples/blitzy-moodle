/**
 * AllocationManager Component
 *
 * Provides a comprehensive interface for teachers to manage peer review allocations
 * in workshop activities. This component supports three allocation methods:
 * - Manual: Teacher assigns reviewers to submissions using drag-and-drop
 * - Random: Automatic random allocation with configurable parameters
 * - Scheduled: Automatic allocation at a specified time
 *
 * Features:
 * - Tabbed interface for switching between allocation methods
 * - Allocation statistics dashboard (submissions, reviewers, coverage)
 * - Results table showing submission-reviewer pairs
 * - Permission checking for 'mod/workshop:allocate' capability
 * - React Query mutations for allocation API calls
 * - Undo/redo functionality for allocation operations
 * - Conflict and warning detection
 *
 * Based on Moodle's workshop allocation system:
 * - public/mod/workshop/allocation.php
 * - public/mod/workshop/allocation/manual/lib.php
 * - public/mod/workshop/allocation/random/lib.php
 * - public/mod/workshop/allocation/scheduled/lib.php
 *
 * @module features/activities/workshop/components/AllocationManager
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  TextField,
  FormControl,
  FormControlLabel,
  Checkbox,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Chip,
  Divider,
  Card,
  CardContent,
  Stack,
  FormHelperText,
} from '@mui/material';
import {
  Shuffle as RandomIcon,
  PersonAdd as ManualIcon,
  Schedule as ScheduleIcon,
  Delete as DeleteIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  PlayArrow as ExecuteIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useQueryClient, useMutation } from '@tanstack/react-query';

import type { AllocationResult } from '@/features/activities/workshop/types/workshop.types';
import { useWorkshop } from '@/features/activities/workshop/hooks/useWorkshop';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/useToast';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Modal } from '@/components/feedback/Modal';
import { Alert } from '@/components/feedback/Alert';
import { apiClient } from '@/services/api/client';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Allocation method types matching Moodle's allocation plugins
 */
type AllocationMethod = 'manual' | 'random' | 'scheduled';

/**
 * Configuration for random allocation
 * Based on workshop_random_allocator_setting from random/lib.php
 */
interface RandomAllocationConfig {
  /** Number of reviews per submission or reviewer */
  numOfReviews: number;
  /** Whether numOfReviews is per submission (true) or per reviewer (false) */
  numPerSubmission: boolean;
  /** Whether to remove existing allocations before creating new ones */
  removeCurrent: boolean;
  /** Whether to exclude same-group members from allocation */
  excludeSameGroup: boolean;
  /** Whether to add self-assessment */
  addSelfAssessment: boolean;
  /** Whether users can assess without their own submission */
  assessWithoutSubmission: boolean;
}

/**
 * Configuration for scheduled allocation
 * Based on workshopallocation_scheduled settings
 */
interface ScheduledAllocationConfig extends RandomAllocationConfig {
  /** Whether scheduled allocation is enabled */
  enabled: boolean;
  /** Timestamp for scheduled execution */
  scheduledTime: number | null;
}

/**
 * Represents a single allocation (submission-reviewer pair)
 */
interface Allocation {
  id: number;
  submissionId: number;
  submissionTitle: string;
  authorId: number;
  authorName: string;
  reviewerId: number;
  reviewerName: string;
  grade: number | null;
  timeCreated: number;
}

/**
 * Allocation statistics for the dashboard
 */
interface AllocationStats {
  totalSubmissions: number;
  totalReviewers: number;
  totalAllocations: number;
  coveragePercentage: number;
  averageReviewsPerSubmission: number;
  submissionsWithoutReviewer: number;
  reviewerWorkload: Map<number, number>;
}

/**
 * Undo/Redo history item
 */
interface HistoryItem {
  type: 'add' | 'remove';
  allocation: Allocation;
  timestamp: number;
}

/**
 * Props interface for AllocationManager component
 */
interface AllocationManagerProps {
  /** Workshop instance ID */
  workshopId: number;
  /** Course module ID */
  cmId: number;
  /** Optional callback when allocations change */
  onAllocationChange?: () => void;
  /** Optional initial allocation method tab */
  initialMethod?: AllocationMethod;
}

// ============================================================================
// Constants
// ============================================================================

/** Default random allocation configuration */
const DEFAULT_RANDOM_CONFIG: RandomAllocationConfig = {
  numOfReviews: 2,
  numPerSubmission: true,
  removeCurrent: false,
  excludeSameGroup: false,
  addSelfAssessment: false,
  assessWithoutSubmission: false,
};

/** Default scheduled allocation configuration */
const DEFAULT_SCHEDULED_CONFIG: ScheduledAllocationConfig = {
  ...DEFAULT_RANDOM_CONFIG,
  enabled: false,
  scheduledTime: null,
};

/** Maximum history items for undo/redo */
const MAX_HISTORY_SIZE = 50;

// ============================================================================
// API Functions
// ============================================================================

/**
 * Execute manual allocation (add or remove reviewer)
 */
async function executeManualAllocation(
  workshopId: number,
  submissionId: number,
  reviewerId: number,
  action: 'add' | 'remove'
): Promise<AllocationResult> {
  const endpoint =
    action === 'add'
      ? `/workshops/${workshopId}/allocations`
      : `/workshops/${workshopId}/allocations/${submissionId}/${reviewerId}`;

  const method = action === 'add' ? 'post' : 'delete';

  const response = await apiClient[method]<{ success: boolean; data: AllocationResult }>(
    endpoint,
    action === 'add' ? { submissionId, reviewerId } : undefined
  );

  if (!response.data.success) {
    throw new Error('Manual allocation operation failed');
  }

  return response.data.data;
}

/**
 * Execute random allocation with given configuration
 */
async function executeRandomAllocation(
  workshopId: number,
  config: RandomAllocationConfig
): Promise<AllocationResult> {
  const response = await apiClient.post<{ success: boolean; data: AllocationResult }>(
    `/workshops/${workshopId}/allocations/random`,
    {
      numofreviews: config.numOfReviews,
      numper: config.numPerSubmission ? 1 : 2, // 1 = per submission, 2 = per reviewer
      removecurrent: config.removeCurrent,
      excludesamegroup: config.excludeSameGroup,
      addselfassessment: config.addSelfAssessment,
      assesswosubmission: config.assessWithoutSubmission,
    }
  );

  if (!response.data.success) {
    throw new Error('Random allocation failed');
  }

  return response.data.data;
}

/**
 * Save scheduled allocation configuration
 */
async function saveScheduledAllocation(
  workshopId: number,
  config: ScheduledAllocationConfig
): Promise<AllocationResult> {
  const response = await apiClient.post<{ success: boolean; data: AllocationResult }>(
    `/workshops/${workshopId}/allocations/scheduled`,
    {
      enabled: config.enabled,
      scheduledtime: config.scheduledTime,
      numofreviews: config.numOfReviews,
      numper: config.numPerSubmission ? 1 : 2,
      removecurrent: config.removeCurrent,
      excludesamegroup: config.excludeSameGroup,
      addselfassessment: config.addSelfAssessment,
      assesswosubmission: config.assessWithoutSubmission,
    }
  );

  if (!response.data.success) {
    throw new Error('Scheduled allocation configuration failed');
  }

  return response.data.data;
}

/**
 * Fetch current allocations for a workshop
 */
async function fetchAllocations(workshopId: number): Promise<Allocation[]> {
  const response = await apiClient.get<{
    success: boolean;
    data: { allocations: Allocation[] };
  }>(`/workshops/${workshopId}/allocations`);

  if (!response.data.success) {
    throw new Error('Failed to fetch allocations');
  }

  return response.data.data.allocations;
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * AllocationManager Component
 *
 * Main component for managing peer review allocations in workshop activities.
 * Provides a tabbed interface with three allocation methods and comprehensive
 * allocation management features.
 */
function AllocationManager({
  workshopId,
  cmId,
  onAllocationChange,
  initialMethod = 'manual',
}: AllocationManagerProps): JSX.Element {
  const queryClient = useQueryClient();
  const { hasCapability } = usePermissions();
  const { success: showSuccess, error: showError, warning: showWarning } = useToast();

  // Fetch workshop data
  const {
    workshop,
    submissions,
    isLoading: isWorkshopLoading,
    isError: isWorkshopError,
    error: workshopError,
  } = useWorkshop(workshopId);

  // ============================================================================
  // State Management
  // ============================================================================

  // Active tab state
  const [activeTab, setActiveTab] = useState<AllocationMethod>(initialMethod);

  // Allocations state
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [isLoadingAllocations, setIsLoadingAllocations] = useState(true);

  // Random allocation configuration
  const [randomConfig, setRandomConfig] = useState<RandomAllocationConfig>(DEFAULT_RANDOM_CONFIG);

  // Scheduled allocation configuration
  const [scheduledConfig, setScheduledConfig] = useState<ScheduledAllocationConfig>(
    DEFAULT_SCHEDULED_CONFIG
  );

  // Manual allocation drag state
  const [selectedSubmission, setSelectedSubmission] = useState<number | null>(null);
  const [selectedReviewer, setSelectedReviewer] = useState<number | null>(null);

  // Undo/Redo history
  const [undoHistory, setUndoHistory] = useState<HistoryItem[]>([]);
  const [redoHistory, setRedoHistory] = useState<HistoryItem[]>([]);

  // Modal states
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmModalAction, setConfirmModalAction] = useState<() => void>(() => {});
  const [confirmModalMessage, setConfirmModalMessage] = useState('');

  // ============================================================================
  // Permission Check
  // ============================================================================

  const canAllocate = hasCapability('mod/workshop:allocate', cmId);

  // ============================================================================
  // Computed Values
  // ============================================================================

  /**
   * Calculate allocation statistics
   */
  const stats: AllocationStats = useMemo(() => {
    if (!submissions || submissions.length === 0) {
      return {
        totalSubmissions: 0,
        totalReviewers: 0,
        totalAllocations: 0,
        coveragePercentage: 0,
        averageReviewsPerSubmission: 0,
        submissionsWithoutReviewer: 0,
        reviewerWorkload: new Map(),
      };
    }

    const submissionsWithAllocations = new Set<number>();
    const reviewerWorkload = new Map<number, number>();
    const uniqueReviewers = new Set<number>();

    allocations.forEach((allocation) => {
      submissionsWithAllocations.add(allocation.submissionId);
      uniqueReviewers.add(allocation.reviewerId);

      const currentCount = reviewerWorkload.get(allocation.reviewerId) || 0;
      reviewerWorkload.set(allocation.reviewerId, currentCount + 1);
    });

    const totalSubmissions = submissions.length;
    const totalAllocations = allocations.length;
    const submissionsWithoutReviewer = totalSubmissions - submissionsWithAllocations.size;
    const coveragePercentage =
      totalSubmissions > 0 ? (submissionsWithAllocations.size / totalSubmissions) * 100 : 0;
    const averageReviewsPerSubmission =
      totalSubmissions > 0 ? totalAllocations / totalSubmissions : 0;

    return {
      totalSubmissions,
      totalReviewers: uniqueReviewers.size,
      totalAllocations,
      coveragePercentage,
      averageReviewsPerSubmission,
      submissionsWithoutReviewer,
      reviewerWorkload,
    };
  }, [allocations, submissions]);

  /**
   * Detect allocation conflicts and warnings
   */
  const warnings = useMemo(() => {
    const result: string[] = [];

    if (stats.submissionsWithoutReviewer > 0) {
      result.push(
        `${stats.submissionsWithoutReviewer} submission(s) have no assigned reviewers.`
      );
    }

    // Check for uneven workload distribution
    const workloadValues = Array.from(stats.reviewerWorkload.values());
    if (workloadValues.length > 0) {
      const maxWorkload = Math.max(...workloadValues);
      const minWorkload = Math.min(...workloadValues);
      if (maxWorkload - minWorkload > 2) {
        result.push('Reviewer workload is unevenly distributed.');
      }
    }

    // Check if allocation is possible
    if (stats.totalSubmissions === 0) {
      result.push('No submissions available for allocation.');
    }

    return result;
  }, [stats]);

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Load allocations on mount and when workshopId changes
   */
  useEffect(() => {
    if (!workshopId || !canAllocate) return;

    const loadAllocations = async () => {
      setIsLoadingAllocations(true);
      try {
        const data = await fetchAllocations(workshopId);
        setAllocations(data);
      } catch (err) {
        showError('Failed to load allocations');
        console.error('Failed to load allocations:', err);
      } finally {
        setIsLoadingAllocations(false);
      }
    };

    loadAllocations();
  }, [workshopId, canAllocate, showError]);

  // ============================================================================
  // Mutations
  // ============================================================================

  /**
   * Manual allocation mutation
   */
  const manualAllocationMutation = useMutation({
    mutationFn: ({
      submissionId,
      reviewerId,
      action,
    }: {
      submissionId: number;
      reviewerId: number;
      action: 'add' | 'remove';
    }) => executeManualAllocation(workshopId, submissionId, reviewerId, action),
    onSuccess: (result, variables) => {
      // Refresh allocations
      queryClient.invalidateQueries({ queryKey: ['workshops', workshopId] });
      fetchAllocations(workshopId).then(setAllocations);

      // Update history for undo support
      if (variables.action === 'add') {
        showSuccess(`Allocation created successfully (${result.allocated} allocation(s))`);
      } else {
        showSuccess('Allocation removed successfully');
      }

      onAllocationChange?.();
    },
    onError: (error: Error) => {
      showError(error.message || 'Allocation operation failed');
    },
  });

  /**
   * Random allocation mutation
   */
  const randomAllocationMutation = useMutation({
    mutationFn: (config: RandomAllocationConfig) => executeRandomAllocation(workshopId, config),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['workshops', workshopId] });
      fetchAllocations(workshopId).then(setAllocations);
      showSuccess(`Random allocation completed: ${result.allocated} allocation(s) created`);
      onAllocationChange?.();
    },
    onError: (error: Error) => {
      showError(error.message || 'Random allocation failed');
    },
  });

  /**
   * Scheduled allocation mutation
   */
  const scheduledAllocationMutation = useMutation({
    mutationFn: (config: ScheduledAllocationConfig) => saveScheduledAllocation(workshopId, config),
    onSuccess: (result) => {
      showSuccess(
        scheduledConfig.enabled
          ? 'Scheduled allocation enabled'
          : 'Scheduled allocation disabled'
      );
      onAllocationChange?.();
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to save scheduled allocation settings');
    },
  });

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle tab change
   */
  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent, newValue: AllocationMethod) => {
      setActiveTab(newValue);
    },
    []
  );

  /**
   * Handle manual allocation
   */
  const handleManualAllocate = useCallback(() => {
    if (!selectedSubmission || !selectedReviewer) {
      showWarning('Please select both a submission and a reviewer');
      return;
    }

    // Check if allocation already exists
    const existingAllocation = allocations.find(
      (a) => a.submissionId === selectedSubmission && a.reviewerId === selectedReviewer
    );

    if (existingAllocation) {
      showWarning('This allocation already exists');
      return;
    }

    manualAllocationMutation.mutate({
      submissionId: selectedSubmission,
      reviewerId: selectedReviewer,
      action: 'add',
    });

    // Clear selection
    setSelectedSubmission(null);
    setSelectedReviewer(null);
  }, [
    selectedSubmission,
    selectedReviewer,
    allocations,
    manualAllocationMutation,
    showWarning,
  ]);

  /**
   * Handle allocation removal
   */
  const handleRemoveAllocation = useCallback(
    (allocation: Allocation) => {
      // Check if allocation has been graded
      if (allocation.grade !== null) {
        setConfirmModalMessage(
          'This allocation has already been graded. Are you sure you want to remove it?'
        );
        setConfirmModalAction(() => () => {
          manualAllocationMutation.mutate({
            submissionId: allocation.submissionId,
            reviewerId: allocation.reviewerId,
            action: 'remove',
          });
          setIsConfirmModalOpen(false);
        });
        setIsConfirmModalOpen(true);
      } else {
        manualAllocationMutation.mutate({
          submissionId: allocation.submissionId,
          reviewerId: allocation.reviewerId,
          action: 'remove',
        });
      }
    },
    [manualAllocationMutation]
  );

  /**
   * Handle random allocation execution
   */
  const handleRandomAllocate = useCallback(() => {
    if (randomConfig.removeCurrent && allocations.length > 0) {
      setConfirmModalMessage(
        `This will remove ${allocations.length} existing allocation(s) before creating new ones. Continue?`
      );
      setConfirmModalAction(() => () => {
        randomAllocationMutation.mutate(randomConfig);
        setIsConfirmModalOpen(false);
      });
      setIsConfirmModalOpen(true);
    } else {
      randomAllocationMutation.mutate(randomConfig);
    }
  }, [randomConfig, allocations.length, randomAllocationMutation]);

  /**
   * Handle scheduled allocation save
   */
  const handleSaveScheduled = useCallback(() => {
    if (scheduledConfig.enabled && !scheduledConfig.scheduledTime) {
      showWarning('Please select a scheduled time');
      return;
    }
    scheduledAllocationMutation.mutate(scheduledConfig);
  }, [scheduledConfig, scheduledAllocationMutation, showWarning]);

  /**
   * Handle undo operation
   */
  const handleUndo = useCallback(() => {
    if (undoHistory.length === 0) return;

    const lastAction = undoHistory[undoHistory.length - 1];
    const newUndoHistory = undoHistory.slice(0, -1);

    // Reverse the action
    manualAllocationMutation.mutate({
      submissionId: lastAction.allocation.submissionId,
      reviewerId: lastAction.allocation.reviewerId,
      action: lastAction.type === 'add' ? 'remove' : 'add',
    });

    setUndoHistory(newUndoHistory);
    setRedoHistory([...redoHistory, lastAction]);
  }, [undoHistory, redoHistory, manualAllocationMutation]);

  /**
   * Handle redo operation
   */
  const handleRedo = useCallback(() => {
    if (redoHistory.length === 0) return;

    const lastAction = redoHistory[redoHistory.length - 1];
    const newRedoHistory = redoHistory.slice(0, -1);

    // Re-execute the action
    manualAllocationMutation.mutate({
      submissionId: lastAction.allocation.submissionId,
      reviewerId: lastAction.allocation.reviewerId,
      action: lastAction.type,
    });

    setRedoHistory(newRedoHistory);
    setUndoHistory([...undoHistory, lastAction]);
  }, [redoHistory, undoHistory, manualAllocationMutation]);

  // ============================================================================
  // Loading and Error States
  // ============================================================================

  if (isWorkshopLoading || isLoadingAllocations) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <LoadingSpinner size="large" message="Loading allocation data..." />
      </Box>
    );
  }

  if (isWorkshopError) {
    return (
      <Alert
        severity="error"
        title="Error Loading Workshop"
        message={workshopError?.message || 'Failed to load workshop data'}
      />
    );
  }

  if (!canAllocate) {
    return (
      <Alert
        severity="warning"
        title="Permission Denied"
        message="You do not have permission to manage allocations for this workshop."
      />
    );
  }

  // ============================================================================
  // Render Functions
  // ============================================================================

  /**
   * Render allocation statistics dashboard
   */
  const renderStatsDashboard = () => (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Allocation Statistics
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Chip
            icon={<InfoIcon />}
            label={`${stats.totalSubmissions} Submissions`}
            color="primary"
            variant="outlined"
          />
          <Chip
            icon={<InfoIcon />}
            label={`${stats.totalReviewers} Reviewers`}
            color="primary"
            variant="outlined"
          />
          <Chip
            icon={<InfoIcon />}
            label={`${stats.totalAllocations} Allocations`}
            color="secondary"
            variant="outlined"
          />
          <Chip
            icon={stats.coveragePercentage === 100 ? <SuccessIcon /> : <WarningIcon />}
            label={`${stats.coveragePercentage.toFixed(0)}% Coverage`}
            color={stats.coveragePercentage === 100 ? 'success' : 'warning'}
            variant="outlined"
          />
          <Chip
            label={`${stats.averageReviewsPerSubmission.toFixed(1)} Avg Reviews`}
            variant="outlined"
          />
        </Stack>

        {/* Warnings */}
        {warnings.length > 0 && (
          <Box sx={{ mt: 2 }}>
            {warnings.map((warning, index) => (
              <Alert
                key={index}
                severity="warning"
                message={warning}
                sx={{ mb: 1 }}
              />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );

  /**
   * Render manual allocation tab content
   */
  const renderManualTab = () => (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Manually assign reviewers to submissions by selecting a submission and a reviewer,
        then clicking the &quot;Allocate&quot; button.
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        {/* Submission Selection */}
        <FormControl fullWidth>
          <InputLabel id="submission-select-label">Select Submission</InputLabel>
          <Select
            labelId="submission-select-label"
            value={selectedSubmission || ''}
            label="Select Submission"
            onChange={(e) => setSelectedSubmission(e.target.value as number)}
          >
            {submissions?.map((submission) => (
              <MenuItem key={submission.id} value={submission.id}>
                {submission.title} ({submission.authorFirstName} {submission.authorLastName})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Reviewer Selection */}
        <FormControl fullWidth>
          <InputLabel id="reviewer-select-label">Select Reviewer</InputLabel>
          <Select
            labelId="reviewer-select-label"
            value={selectedReviewer || ''}
            label="Select Reviewer"
            onChange={(e) => setSelectedReviewer(e.target.value as number)}
          >
            {/* In a real implementation, this would come from the workshop participants */}
            {submissions?.map((submission) => (
              <MenuItem key={submission.authorId} value={submission.authorId}>
                {submission.authorFirstName} {submission.authorLastName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          startIcon={<ManualIcon />}
          onClick={handleManualAllocate}
          disabled={
            !selectedSubmission ||
            !selectedReviewer ||
            manualAllocationMutation.isPending
          }
          sx={{ minWidth: 140 }}
        >
          {manualAllocationMutation.isPending ? 'Allocating...' : 'Allocate'}
        </Button>
      </Stack>

      {/* Reviewer Workload Distribution */}
      <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
        Reviewer Workload Distribution
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {Array.from(stats.reviewerWorkload.entries()).map(([reviewerId, count]) => {
          const reviewer = submissions?.find((s) => s.authorId === reviewerId);
          return (
            <Chip
              key={reviewerId}
              label={`${reviewer?.authorFirstName || 'Unknown'}: ${count} reviews`}
              size="small"
              color={count > 3 ? 'warning' : 'default'}
            />
          );
        })}
      </Stack>
    </Box>
  );

  /**
   * Render random allocation tab content
   */
  const renderRandomTab = () => (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure random allocation settings and execute automatic peer review assignment.
      </Typography>

      <Stack spacing={2} sx={{ maxWidth: 500 }}>
        <TextField
          label="Number of Reviews"
          type="number"
          value={randomConfig.numOfReviews}
          onChange={(e) =>
            setRandomConfig({
              ...randomConfig,
              numOfReviews: parseInt(e.target.value, 10) || 1,
            })
          }
          inputProps={{ min: 1, max: 30 }}
          fullWidth
          helperText="Number of assessments to allocate"
        />

        <FormControl fullWidth>
          <InputLabel id="num-per-label">Reviews Per</InputLabel>
          <Select
            labelId="num-per-label"
            value={randomConfig.numPerSubmission ? 'submission' : 'reviewer'}
            label="Reviews Per"
            onChange={(e) =>
              setRandomConfig({
                ...randomConfig,
                numPerSubmission: e.target.value === 'submission',
              })
            }
          >
            <MenuItem value="submission">Per Submission</MenuItem>
            <MenuItem value="reviewer">Per Reviewer</MenuItem>
          </Select>
          <FormHelperText>
            Whether to allocate X reviews per submission or X reviews per reviewer
          </FormHelperText>
        </FormControl>

        <FormControlLabel
          control={
            <Checkbox
              checked={randomConfig.removeCurrent}
              onChange={(e) =>
                setRandomConfig({ ...randomConfig, removeCurrent: e.target.checked })
              }
            />
          }
          label="Remove current allocations before creating new ones"
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={randomConfig.excludeSameGroup}
              onChange={(e) =>
                setRandomConfig({ ...randomConfig, excludeSameGroup: e.target.checked })
              }
            />
          }
          label="Exclude same-group members from allocation"
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={randomConfig.addSelfAssessment}
              onChange={(e) =>
                setRandomConfig({ ...randomConfig, addSelfAssessment: e.target.checked })
              }
            />
          }
          label="Add self-assessment"
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={randomConfig.assessWithoutSubmission}
              onChange={(e) =>
                setRandomConfig({
                  ...randomConfig,
                  assessWithoutSubmission: e.target.checked,
                })
              }
            />
          }
          label="Allow assessing without own submission"
        />

        <Button
          variant="contained"
          color="primary"
          startIcon={<ExecuteIcon />}
          onClick={handleRandomAllocate}
          disabled={randomAllocationMutation.isPending}
          sx={{ mt: 2 }}
        >
          {randomAllocationMutation.isPending
            ? 'Allocating...'
            : 'Execute Random Allocation'}
        </Button>
      </Stack>
    </Box>
  );

  /**
   * Render scheduled allocation tab content
   */
  const renderScheduledTab = () => {
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const dateValue = e.target.value;
      if (dateValue) {
        setScheduledConfig({
          ...scheduledConfig,
          scheduledTime: new Date(dateValue).getTime() / 1000, // Convert to Unix timestamp
        });
      } else {
        setScheduledConfig({ ...scheduledConfig, scheduledTime: null });
      }
    };

    const formatDateForInput = (timestamp: number | null): string => {
      if (!timestamp) return '';
      const date = new Date(timestamp * 1000);
      return date.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
    };

    return (
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Schedule automatic allocation to run at a specific time. The random allocation
          settings below will be used when the scheduled task runs.
        </Typography>

        <Stack spacing={2} sx={{ maxWidth: 500 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={scheduledConfig.enabled}
                onChange={(e) =>
                  setScheduledConfig({ ...scheduledConfig, enabled: e.target.checked })
                }
              />
            }
            label="Enable scheduled allocation"
          />

          <TextField
            label="Scheduled Time"
            type="datetime-local"
            value={formatDateForInput(scheduledConfig.scheduledTime)}
            onChange={handleDateChange}
            disabled={!scheduledConfig.enabled}
            InputLabelProps={{ shrink: true }}
            fullWidth
            helperText="The time when automatic allocation will run"
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" gutterBottom>
            Allocation Settings (applied when scheduled)
          </Typography>

          <TextField
            label="Number of Reviews"
            type="number"
            value={scheduledConfig.numOfReviews}
            onChange={(e) =>
              setScheduledConfig({
                ...scheduledConfig,
                numOfReviews: parseInt(e.target.value, 10) || 1,
              })
            }
            inputProps={{ min: 1, max: 30 }}
            disabled={!scheduledConfig.enabled}
            fullWidth
          />

          <FormControl fullWidth disabled={!scheduledConfig.enabled}>
            <InputLabel id="scheduled-num-per-label">Reviews Per</InputLabel>
            <Select
              labelId="scheduled-num-per-label"
              value={scheduledConfig.numPerSubmission ? 'submission' : 'reviewer'}
              label="Reviews Per"
              onChange={(e) =>
                setScheduledConfig({
                  ...scheduledConfig,
                  numPerSubmission: e.target.value === 'submission',
                })
              }
            >
              <MenuItem value="submission">Per Submission</MenuItem>
              <MenuItem value="reviewer">Per Reviewer</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={scheduledConfig.removeCurrent}
                onChange={(e) =>
                  setScheduledConfig({ ...scheduledConfig, removeCurrent: e.target.checked })
                }
                disabled={!scheduledConfig.enabled}
              />
            }
            label="Remove current allocations"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={scheduledConfig.addSelfAssessment}
                onChange={(e) =>
                  setScheduledConfig({
                    ...scheduledConfig,
                    addSelfAssessment: e.target.checked,
                  })
                }
                disabled={!scheduledConfig.enabled}
              />
            }
            label="Add self-assessment"
          />

          <Button
            variant="contained"
            color="primary"
            startIcon={<ScheduleIcon />}
            onClick={handleSaveScheduled}
            disabled={scheduledAllocationMutation.isPending}
            sx={{ mt: 2 }}
          >
            {scheduledAllocationMutation.isPending
              ? 'Saving...'
              : 'Save Scheduled Allocation'}
          </Button>
        </Stack>
      </Box>
    );
  };

  /**
   * Render allocation results table
   */
  const renderAllocationTable = () => (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Current Allocations
      </Typography>

      {allocations.length === 0 ? (
        <Alert
          severity="info"
          message="No allocations have been created yet. Use one of the allocation methods above to assign reviewers to submissions."
        />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Submission</TableCell>
                <TableCell>Author</TableCell>
                <TableCell>Reviewer</TableCell>
                <TableCell>Grade</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allocations.map((allocation) => (
                <TableRow key={allocation.id}>
                  <TableCell>{allocation.submissionTitle}</TableCell>
                  <TableCell>{allocation.authorName}</TableCell>
                  <TableCell>{allocation.reviewerName}</TableCell>
                  <TableCell>
                    {allocation.grade !== null ? (
                      <Chip
                        size="small"
                        label={allocation.grade.toFixed(1)}
                        color="success"
                        variant="outlined"
                      />
                    ) : (
                      <Chip size="small" label="Not graded" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Remove allocation">
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveAllocation(allocation)}
                        disabled={manualAllocationMutation.isPending}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with Undo/Redo */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h5">Peer Review Allocation</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Undo last action">
            <span>
              <IconButton
                onClick={handleUndo}
                disabled={undoHistory.length === 0}
                size="small"
              >
                <UndoIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo last action">
            <span>
              <IconButton
                onClick={handleRedo}
                disabled={redoHistory.length === 0}
                size="small"
              >
                <RedoIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>

      {/* Statistics Dashboard */}
      {renderStatsDashboard()}

      {/* Allocation Method Tabs */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab
            icon={<ManualIcon />}
            iconPosition="start"
            label="Manual"
            value="manual"
          />
          <Tab
            icon={<RandomIcon />}
            iconPosition="start"
            label="Random"
            value="random"
          />
          <Tab
            icon={<ScheduleIcon />}
            iconPosition="start"
            label="Scheduled"
            value="scheduled"
          />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {activeTab === 'manual' && renderManualTab()}
          {activeTab === 'random' && renderRandomTab()}
          {activeTab === 'scheduled' && renderScheduledTab()}
        </Box>
      </Paper>

      {/* Allocation Results Table */}
      {renderAllocationTable()}

      {/* Confirmation Modal */}
      <Modal
        open={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Action"
        actions={[
          {
            label: 'Cancel',
            onClick: () => setIsConfirmModalOpen(false),
          },
          {
            label: 'Confirm',
            onClick: confirmModalAction,
            color: 'primary',
            variant: 'contained',
          },
        ]}
      >
        <Typography>{confirmModalMessage}</Typography>
      </Modal>
    </Box>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default AllocationManager;
