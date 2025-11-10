// Copyright (c) Moodle React Frontend
// Licensed under the GNU General Public License v3.0 or later

/**
 * ScormReportCard Component
 *
 * Displays comprehensive learner progress report for SCORM packages.
 * Provides detailed view of attempt history, scores, completion status,
 * time spent, interaction tracking, and objectives completion for both
 * SCORM 1.2 and SCORM 2004 standards.
 *
 * Features:
 * - Current attempt number and status with color-coded badges
 * - Overall score and grade display
 * - Completion percentage with visual progress indicators
 * - Total time spent tracking
 * - Historical attempts list with scores and timestamps
 * - Detailed interaction tracking data (questions, responses, results)
 * - Objectives completion status
 * - SCO-level progress details
 * - Support for basic and detailed report views
 * - Warning messages for incomplete or failed attempts
 *
 * Data Flow:
 * - Fetches report data via fetchAttemptReport API function
 * - Uses React Query for caching and state management
 * - Wraps existing PHP reporting functions from public/mod/scorm/report/
 * - Supports filtering by specific attempt number
 *
 * @module ScormReportCard
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Divider,
  Stack,
  Grid,
} from '@mui/material';
import { Chip } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  AccessTime as AccessTimeIcon,
  Grade as GradeIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';

// Internal imports from depends_on_files
import type { ScormUserData } from '../types/scorm.types';
import { fetchAttemptReport } from '../api/scormApi';
import { Alert } from '../../../../components/feedback/Alert';
import { Card } from '../../../../components/data-display/Card';
import { LoadingSpinner } from '../../../../components/feedback/LoadingSpinner';
import { scormQueryKeys } from '../hooks/useScorm';

/**
 * Props interface for ScormReportCard component
 */
export interface ScormReportCardProps {
  /**
   * SCORM activity ID
   * Used to fetch report data from the API
   */
  scormId: number;

  /**
   * User ID to display report for
   * If not provided, displays report for current user
   * @default undefined (current user)
   */
  userId?: number;

  /**
   * Specific attempt number to display
   * If not provided, displays the current/latest attempt
   * @default undefined (latest attempt)
   */
  attemptNumber?: number;

  /**
   * Whether to show detailed view with interactions and objectives
   * @default false
   */
  showDetailed?: boolean;
}

/**
 * Helper function to format time duration from seconds to human-readable format
 * Converts seconds into hours, minutes, and seconds display
 *
 * @param seconds - Total seconds to format
 * @returns Formatted time string (e.g., "1h 23m 45s" or "5m 30s")
 */
function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) {
    return '0s';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Helper function to get color and label for attempt status
 * Maps SCORM status values to Material-UI Chip colors and display text
 *
 * @param status - SCORM lesson status (completed, passed, failed, etc.)
 * @returns Object with color variant and display label
 */
function getStatusDisplay(status: string): {
  color: 'success' | 'error' | 'warning' | 'default';
  label: string;
  icon: JSX.Element;
} {
  const lowerStatus = status.toLowerCase();

  switch (lowerStatus) {
    case 'completed':
    case 'passed':
      return {
        color: 'success',
        label: lowerStatus.charAt(0).toUpperCase() + lowerStatus.slice(1),
        icon: <CheckCircleIcon />,
      };
    case 'failed':
      return {
        color: 'error',
        label: 'Failed',
        icon: <CancelIcon />,
      };
    case 'incomplete':
    case 'browsed':
      return {
        color: 'warning',
        label: 'Incomplete',
        icon: <RadioButtonUncheckedIcon />,
      };
    case 'not attempted':
    case 'notattempted':
      return {
        color: 'default',
        label: 'Not Attempted',
        icon: <RadioButtonUncheckedIcon />,
      };
    default:
      return {
        color: 'default',
        label: status || 'Unknown',
        icon: <RadioButtonUncheckedIcon />,
      };
  }
}

/**
 * Helper function to check if a status indicates failure or incompletion
 * Used to determine whether to show warning messages
 *
 * @param status - SCORM lesson status
 * @returns True if status is failed or incomplete
 */
function isFailedOrIncomplete(status: string): boolean {
  const lowerStatus = status.toLowerCase();
  return (
    lowerStatus === 'failed' ||
    lowerStatus === 'incomplete' ||
    lowerStatus === 'not attempted' ||
    lowerStatus === 'notattempted' ||
    lowerStatus === 'browsed'
  );
}

/**
 * Helper function to format score display
 * Handles various score formats from SCORM tracking data
 *
 * @param score - Raw score value (number or string)
 * @param maxScore - Maximum possible score
 * @returns Formatted score string
 */
function formatScore(score: number | string | undefined, maxScore?: number): string {
  if (score === undefined || score === null || score === '') {
    return 'N/A';
  }

  const numScore = typeof score === 'string' ? parseFloat(score) : score;
  if (isNaN(numScore)) {
    return 'N/A';
  }

  if (maxScore !== undefined && maxScore > 0) {
    return `${numScore.toFixed(1)} / ${maxScore}`;
  }

  return numScore.toFixed(1);
}

/**
 * ScormReportCard Component
 *
 * Main component that renders the SCORM learner progress report.
 * Fetches data from the API and displays comprehensive attempt information
 * including scores, completion status, interaction data, and objectives.
 *
 * @param props - Component props
 * @returns Rendered SCORM report card
 */
export function ScormReportCard({
  scormId,
  userId,
  attemptNumber,
  showDetailed = false,
}: ScormReportCardProps): JSX.Element {
  // Fetch report data using React Query
  // Uses scormQueryKeys.report for consistent caching
  const {
    data: reportData,
    isLoading,
    error,
  } = useQuery({
    queryKey: scormQueryKeys.report(scormId, userId, attemptNumber),
    queryFn: () => fetchAttemptReport(scormId, userId, attemptNumber),
    // Cache report data for 5 minutes
    staleTime: 5 * 60 * 1000,
    // Keep in cache for 10 minutes
    cacheTime: 10 * 60 * 1000,
    // Don't retry on failure - report permissions are strict
    retry: false,
  });

  // Memoize calculated statistics to prevent recalculation on every render
  const statistics = useMemo(() => {
    if (!reportData) {
      return null;
    }

    const { attempts, scoProgress, interactions, objectives } = reportData;

    // Calculate overall completion percentage from SCO progress
    let totalScos = scoProgress.length;
    let completedScos = 0;
    let totalTimeSeconds = 0;

    scoProgress.forEach((sco) => {
      const status = sco.status?.toLowerCase() || '';
      if (status === 'completed' || status === 'passed') {
        completedScos++;
      }
      // Sum up session time from tracking data
      if (sco.timeModified) {
        totalTimeSeconds += sco.timeModified;
      }
    });

    const completionPercentage =
      totalScos > 0 ? Math.round((completedScos / totalScos) * 100) : 0;

    // Get current attempt data
    const currentAttemptData = attempts.find(
      (att) => att.attempt === reportData.currentAttempt
    ) || attempts[attempts.length - 1];

    // Calculate average score across all attempts
    const attemptsWithScores = attempts.filter(
      (att) => att.scoreRaw !== undefined && att.scoreRaw !== null
    );
    const averageScore =
      attemptsWithScores.length > 0
        ? attemptsWithScores.reduce((sum, att) => sum + (att.scoreRaw || 0), 0) /
          attemptsWithScores.length
        : undefined;

    return {
      completionPercentage,
      totalTimeSeconds,
      currentAttemptData,
      averageScore,
      totalAttempts: attempts.length,
      totalInteractions: interactions.length,
      totalObjectives: objectives.length,
      completedObjectives: objectives.filter(
        (obj) =>
          obj.status?.toLowerCase() === 'completed' ||
          obj.status?.toLowerCase() === 'passed'
      ).length,
    };
  }, [reportData]);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner message="Loading SCORM report..." />
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <Alert severity="error">
          {error instanceof Error
            ? error.message
            : 'Failed to load SCORM report. Please check your permissions and try again.'}
        </Alert>
      </Card>
    );
  }

  // No data state
  if (!reportData || !statistics) {
    return (
      <Card>
        <Alert severity="info">
          No report data available. The learner may not have started this SCORM activity yet.
        </Alert>
      </Card>
    );
  }

  const { currentAttemptData } = statistics;

  // Determine if current attempt has issues
  const showWarning =
    currentAttemptData && isFailedOrIncomplete(currentAttemptData.status || '');
  const statusDisplay = currentAttemptData
    ? getStatusDisplay(currentAttemptData.status || 'unknown')
    : null;

  return (
    <Stack spacing={3}>
      {/* Warning Alert for Failed or Incomplete Attempts */}
      {showWarning && (
        <Alert severity="warning">
          <strong>Attention:</strong> This attempt is marked as{' '}
          <strong>{statusDisplay?.label || 'incomplete'}</strong>. The learner may need to
          complete additional requirements or retake the activity.
        </Alert>
      )}

      {/* Summary Card - Overall Statistics */}
      <Card
        title="SCORM Activity Report"
        subtitle={`Attempt ${reportData.currentAttempt} of ${statistics.totalAttempts}`}
      >
        <Grid container spacing={3}>
          {/* Current Attempt Status */}
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Current Status
              </Typography>
              {statusDisplay && (
                <Chip
                  icon={statusDisplay.icon}
                  label={statusDisplay.label}
                  color={statusDisplay.color}
                  size="medium"
                />
              )}
            </Box>
          </Grid>

          {/* Overall Score */}
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <GradeIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                Current Score
              </Typography>
              <Typography variant="h6">
                {currentAttemptData?.scoreRaw !== undefined
                  ? formatScore(
                      currentAttemptData.scoreRaw,
                      currentAttemptData.scoreMax
                    )
                  : 'N/A'}
              </Typography>
              {currentAttemptData?.scoreScaled !== undefined && (
                <Typography variant="body2" color="text.secondary">
                  ({(currentAttemptData.scoreScaled * 100).toFixed(1)}%)
                </Typography>
              )}
            </Box>
          </Grid>

          {/* Completion Percentage */}
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <AssignmentIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                Completion
              </Typography>
              <Typography variant="h6">{statistics.completionPercentage}%</Typography>
              <LinearProgress
                variant="determinate"
                value={statistics.completionPercentage}
                sx={{ mt: 1 }}
              />
            </Box>
          </Grid>

          {/* Total Time Spent */}
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <AccessTimeIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                Time Spent
              </Typography>
              <Typography variant="h6">
                {formatDuration(statistics.totalTimeSeconds)}
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Average Score across all attempts */}
        {statistics.averageScore !== undefined && statistics.totalAttempts > 1 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box>
              <Typography variant="body2" color="text.secondary">
                Average Score (across {statistics.totalAttempts} attempts):{' '}
                <strong>{statistics.averageScore.toFixed(1)}</strong>
              </Typography>
            </Box>
          </>
        )}
      </Card>

      {/* Attempts History Table */}
      <Card title="Attempt History">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <strong>Attempt</strong>
                </TableCell>
                <TableCell>
                  <strong>Status</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>Score</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>Time</strong>
                </TableCell>
                <TableCell>
                  <strong>Date</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reportData.attempts.map((attempt) => {
                const attemptStatus = getStatusDisplay(attempt.status || 'unknown');
                return (
                  <TableRow
                    key={attempt.attempt}
                    sx={{
                      backgroundColor:
                        attempt.attempt === reportData.currentAttempt
                          ? 'action.selected'
                          : 'inherit',
                    }}
                  >
                    <TableCell>
                      {attempt.attempt}
                      {attempt.attempt === reportData.currentAttempt && (
                        <Chip label="Current" size="small" sx={{ ml: 1 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={attemptStatus.icon}
                        label={attemptStatus.label}
                        color={attemptStatus.color}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {formatScore(attempt.scoreRaw, attempt.scoreMax)}
                      {attempt.scoreScaled !== undefined && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {(attempt.scoreScaled * 100).toFixed(1)}%
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {attempt.timeModified ? formatDuration(attempt.timeModified) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {attempt.timeModified
                        ? new Date(attempt.timeModified * 1000).toLocaleString()
                        : 'N/A'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* SCO Progress Details */}
      {reportData.scoProgress.length > 0 && (
        <Card title="SCO Progress Details" subtitle="Progress for each Sharable Content Object">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>Title</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Status</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Score</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Time</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reportData.scoProgress.map((sco) => {
                  const scoStatus = getStatusDisplay(sco.status || 'unknown');
                  return (
                    <TableRow key={sco.scoid}>
                      <TableCell>{sco.title || `SCO ${sco.scoid}`}</TableCell>
                      <TableCell>
                        <Chip
                          icon={scoStatus.icon}
                          label={scoStatus.label}
                          color={scoStatus.color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {sco.scoreRaw !== undefined
                          ? formatScore(sco.scoreRaw, sco.scoreMax)
                          : 'N/A'}
                      </TableCell>
                      <TableCell align="right">
                        {sco.timeModified ? formatDuration(sco.timeModified) : 'N/A'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Detailed View - Interactions and Objectives */}
      {showDetailed && (
        <>
          {/* Interactions Table */}
          {reportData.interactions.length > 0 && (
            <Card
              title="Interaction Tracking"
              subtitle={`${reportData.interactions.length} interactions recorded`}
            >
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <strong>ID</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Type</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Description</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Learner Response</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Result</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Latency</strong>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData.interactions.map((interaction, index) => (
                      <TableRow key={`interaction-${index}`}>
                        <TableCell>{interaction.id || `Int ${index + 1}`}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {interaction.type || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 300 }}>
                            {interaction.description || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 200 }}>
                            {interaction.learnerResponse || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {interaction.result && (
                            <Chip
                              label={interaction.result}
                              color={
                                interaction.result.toLowerCase() === 'correct'
                                  ? 'success'
                                  : interaction.result.toLowerCase() === 'incorrect'
                                  ? 'error'
                                  : 'default'
                              }
                              size="small"
                            />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {interaction.latency
                            ? formatDuration(parseFloat(interaction.latency))
                            : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}

          {/* Objectives Table */}
          {reportData.objectives.length > 0 && (
            <Card
              title="Learning Objectives"
              subtitle={`${statistics.completedObjectives} of ${statistics.totalObjectives} objectives completed`}
            >
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <strong>Objective ID</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Description</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Status</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Score</strong>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData.objectives.map((objective, index) => {
                      const objStatus = getStatusDisplay(objective.status || 'unknown');
                      return (
                        <TableRow key={`objective-${index}`}>
                          <TableCell>{objective.id || `Obj ${index + 1}`}</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ maxWidth: 400 }}>
                              {objective.description || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={objStatus.icon}
                              label={objStatus.label}
                              color={objStatus.color}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            {objective.scoreRaw !== undefined
                              ? formatScore(objective.scoreRaw, objective.scoreMax)
                              : 'N/A'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}
        </>
      )}

      {/* No Detailed Data Message */}
      {showDetailed &&
        reportData.interactions.length === 0 &&
        reportData.objectives.length === 0 && (
          <Card>
            <Alert severity="info">
              No detailed interaction or objective data available for this attempt. This may be
              normal depending on the SCORM package configuration.
            </Alert>
          </Card>
        )}
    </Stack>
  );
}

// Named export as specified in schema (no default export)
export default ScormReportCard;
