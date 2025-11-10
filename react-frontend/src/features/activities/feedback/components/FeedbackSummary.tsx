/**
 * FeedbackSummary Component
 * 
 * Displays comprehensive statistics and metrics for a feedback activity including
 * total responses, completion rate, average completion time, response distribution
 * by course/group, and respondent/non-respondent counts.
 * 
 * Features:
 * - Responsive grid layout (4 columns desktop, 2 tablet, 1 mobile)
 * - Visual indicators with Material-UI icons
 * - Progress visualization with LinearProgress
 * - Skeleton loading states for async data
 * - Locale-aware number and date formatting
 * - WCAG 2.1 AA accessible with proper color contrast and semantic markup
 * 
 * @module features/activities/feedback/components
 * @see public/mod/feedback/analysis.php - PHP reference implementation
 * @see public/mod/feedback/show_nonrespondents.php - Non-respondent tracking
 */

import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Box,
  Skeleton,
} from '@mui/material';
import {
  CheckCircle,
  People,
  Schedule,
  TrendingUp,
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import type { FeedbackStatistics } from '../types';

/**
 * Props interface for FeedbackSummary component
 */
interface FeedbackSummaryProps {
  /** Unique identifier for the feedback activity */
  feedbackId: number;
  
  /** 
   * Statistics object containing all metrics to display.
   * If undefined, component renders loading skeleton states.
   */
  statistics?: FeedbackStatistics;
  
  /**
   * Optional loading state for explicit loading control.
   * When true, displays skeleton loaders regardless of statistics value.
   */
  isLoading?: boolean;
}

/**
 * FeedbackSummary Component
 * 
 * Displays key metrics and overview data for a feedback activity in a responsive
 * grid layout with visual indicators and formatted statistics.
 * 
 * @param props - Component properties
 * @returns React component displaying feedback statistics summary
 * 
 * @example
 * ```tsx
 * <FeedbackSummary
 *   feedbackId={123}
 *   statistics={{
 *     totalResponses: 45,
 *     completionRate: 75.5,
 *     averageTime: 420,
 *     responsesByCourse: [{courseId: 1, courseName: "Math", count: 20}],
 *     responsesByGroup: [{groupId: 1, groupName: "Group A", count: 15}],
 *     respondents: [1, 2, 3],
 *     nonRespondents: [4, 5],
 *     lastSubmissionDate: 1699564800
 *   }}
 * />
 * ```
 */
export const FeedbackSummary: React.FC<FeedbackSummaryProps> = ({
  feedbackId: _feedbackId,
  statistics,
  isLoading = false,
}) => {
  // Initialize locale-aware number formatter
  const numberFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  });

  /**
   * Formats a duration in seconds to human-readable format (hours and/or minutes)
   * 
   * @param seconds - Duration in seconds
   * @returns Formatted duration string (e.g., "1h 30m" or "45m")
   */
  const formatDuration = (seconds: number): string => {
    if (seconds === 0) {
      return '0m';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  };

  /**
   * Formats a Unix timestamp to a readable date string
   * 
   * @param timestamp - Unix timestamp in seconds
   * @returns Formatted date string or relative time
   */
  const formatDate = (timestamp: number): string => {
    try {
      const date = new Date(timestamp * 1000);
      const distanceString = formatDistanceToNow(date, { addSuffix: true });
      const dateString = format(date, 'MMM d, yyyy h:mm a');
      return `${dateString} (${distanceString})`;
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Show loading skeleton if explicitly loading or statistics not available
  if (isLoading || !statistics) {
    return (
      <Box sx={{ width: '100%', mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Feedback Summary
        </Typography>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card elevation={2}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Skeleton 
                      variant="circular" 
                      width={40} 
                      height={40} 
                      sx={{ mr: 2 }}
                      data-testid={`skeleton-circular-${index}`}
                    />
                    <Skeleton 
                      variant="text" 
                      width="60%" 
                      height={32}
                      data-testid={`skeleton-text-heading-${index}`}
                    />
                  </Box>
                  <Skeleton 
                    variant="text" 
                    width="80%" 
                    height={48}
                    data-testid={`skeleton-text-value-${index}`}
                  />
                  <Skeleton 
                    variant="text" 
                    width="40%" 
                    height={24}
                    data-testid={`skeleton-text-caption-${index}`}
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  // Calculate respondent and non-respondent counts
  const respondentCount = statistics.respondents.length;
  const nonRespondentCount = statistics.nonRespondents.length;
  const totalEnrolled = respondentCount + nonRespondentCount;

  // Check for empty/zero state
  const hasNoResponses = statistics.totalResponses === 0;

  return (
    <Box sx={{ width: '100%', mb: 3 }} role="region" aria-label="Feedback statistics summary">
      <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 3 }}>
        Feedback Summary
      </Typography>

      {hasNoResponses ? (
        <Card elevation={2}>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <People sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Responses Yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This feedback has not received any responses yet. Check back later for statistics.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <>
          <Grid container spacing={3}>
            {/* Total Responses Card */}
            <Grid item xs={12} sm={6} md={3}>
              <Card 
                elevation={2}
                sx={{ 
                  height: '100%',
                  '&:hover': { boxShadow: 4 },
                  transition: 'box-shadow 0.3s ease-in-out'
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CheckCircle 
                      sx={{ 
                        fontSize: 40, 
                        color: 'success.main',
                        mr: 2
                      }} 
                      aria-hidden="true"
                    />
                    <Typography variant="h6" component="h3" color="text.secondary">
                      Total Responses
                    </Typography>
                  </Box>
                  <Typography variant="h3" component="p" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {numberFormatter.format(statistics.totalResponses)}
                  </Typography>
                  <Chip 
                    label="Completed" 
                    color="success" 
                    size="small"
                    icon={<CheckCircle />}
                    sx={{ fontWeight: 500 }}
                  />
                </CardContent>
              </Card>
            </Grid>

            {/* Completion Rate Card */}
            <Grid item xs={12} sm={6} md={3}>
              <Card 
                elevation={2}
                sx={{ 
                  height: '100%',
                  '&:hover': { boxShadow: 4 },
                  transition: 'box-shadow 0.3s ease-in-out'
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrendingUp 
                      sx={{ 
                        fontSize: 40, 
                        color: 'primary.main',
                        mr: 2
                      }} 
                      aria-hidden="true"
                    />
                    <Typography variant="h6" component="h3" color="text.secondary">
                      Completion Rate
                    </Typography>
                  </Box>
                  <Typography variant="h3" component="p" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {numberFormatter.format(statistics.completionRate)}%
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min(statistics.completionRate, 100)}
                    sx={{ 
                      height: 8, 
                      borderRadius: 4,
                      mb: 1
                    }}
                    aria-label={`Completion progress: ${statistics.completionRate}%`}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {respondentCount} of {totalEnrolled} enrolled
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Average Completion Time Card */}
            <Grid item xs={12} sm={6} md={3}>
              <Card 
                elevation={2}
                sx={{ 
                  height: '100%',
                  '&:hover': { boxShadow: 4 },
                  transition: 'box-shadow 0.3s ease-in-out'
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Schedule 
                      sx={{ 
                        fontSize: 40, 
                        color: 'info.main',
                        mr: 2
                      }} 
                      aria-hidden="true"
                    />
                    <Typography variant="h6" component="h3" color="text.secondary">
                      Average Time
                    </Typography>
                  </Box>
                  <Typography variant="h3" component="p" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {formatDuration(statistics.averageTime)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    to complete feedback
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Respondents Overview Card */}
            <Grid item xs={12} sm={6} md={3}>
              <Card 
                elevation={2}
                sx={{ 
                  height: '100%',
                  '&:hover': { boxShadow: 4 },
                  transition: 'box-shadow 0.3s ease-in-out'
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <People 
                      sx={{ 
                        fontSize: 40, 
                        color: 'secondary.main',
                        mr: 2
                      }} 
                      aria-hidden="true"
                    />
                    <Typography variant="h6" component="h3" color="text.secondary">
                      Participants
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                    <Box>
                      <Typography variant="h4" component="p" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                        {respondentCount}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Responded
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="h4" component="p" sx={{ fontWeight: 'bold', color: nonRespondentCount > 0 ? 'warning.main' : 'text.secondary' }}>
                        {nonRespondentCount}
                      </Typography>
                      {nonRespondentCount > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          Pending
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  {nonRespondentCount > 0 && (
                    <Chip 
                      label={`${nonRespondentCount} pending`}
                      color="warning" 
                      size="small"
                      sx={{ fontWeight: 500 }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Response Distribution by Course (if applicable) */}
          {statistics.responsesByCourse.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" component="h3" gutterBottom sx={{ mb: 2 }}>
                Responses by Course
              </Typography>
              <Grid container spacing={2}>
                {statistics.responsesByCourse.map((courseResponse) => (
                  <Grid item xs={12} sm={6} md={4} key={courseResponse.courseId}>
                    <Card elevation={1}>
                      <CardContent sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {courseResponse.courseName}
                          </Typography>
                          <Chip 
                            label={numberFormatter.format(courseResponse.count)}
                            color="primary"
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Response Distribution by Group (if applicable) */}
          {statistics.responsesByGroup.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" component="h3" gutterBottom sx={{ mb: 2 }}>
                Responses by Group
              </Typography>
              <Grid container spacing={2}>
                {statistics.responsesByGroup.map((groupResponse) => (
                  <Grid item xs={12} sm={6} md={4} key={groupResponse.groupId}>
                    <Card elevation={1}>
                      <CardContent sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {groupResponse.groupName}
                          </Typography>
                          <Chip 
                            label={numberFormatter.format(groupResponse.count)}
                            color="secondary"
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Last Submission Info */}
          {statistics.lastSubmissionDate > 0 && (
            <Box sx={{ mt: 3 }}>
              <Card elevation={1} sx={{ bgcolor: 'grey.50' }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Last submission:</strong> {formatDate(statistics.lastSubmissionDate)}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};
