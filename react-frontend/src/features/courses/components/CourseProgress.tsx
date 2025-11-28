import { Box, LinearProgress, Typography, Chip, Stack, Tooltip } from '@mui/material';

/**
 * Interface for individual activity type breakdown
 * Represents completion status for a specific activity type (e.g., assignments, quizzes)
 */
export interface ActivityBreakdownItem {
  /** The type of activity (e.g., 'assignment', 'quiz', 'forum') */
  type: string;
  /** Number of completed activities of this type */
  completed: number;
  /** Total number of activities of this type */
  total: number;
}

/**
 * Props for the CourseProgress component
 */
export interface CourseProgressProps {
  /** Course completion percentage (0-100) */
  completionPercentage: number;
  /** Number of activities completed */
  completedActivities: number;
  /** Total number of activities in the course */
  totalActivities: number;
  /** Whether to show detailed breakdown by activity type */
  showDetails?: boolean;
  /** Optional breakdown of completion by activity type */
  activityBreakdown?: ActivityBreakdownItem[];
}

/**
 * Determines the color variant for the progress bar based on completion percentage
 * @param percentage - Completion percentage (0-100)
 * @returns MUI color variant
 */
const getProgressColor = (percentage: number): 'error' | 'warning' | 'success' => {
  if (percentage <= 30) {
    return 'error';
  } else if (percentage <= 70) {
    return 'warning';
  }
  return 'success';
};

/**
 * Formats activity type name for display
 * Converts snake_case or camelCase to Title Case
 * @param type - Activity type identifier
 * @returns Formatted display name
 */
const formatActivityType = (type: string): string => {
  // Handle ALL_CAPS strings: if the entire string is uppercase, convert to lowercase first
  // to avoid inserting spaces between every letter (e.g., 'QUIZ' -> 'Quiz' not 'Q U I Z')
  let processed = type;
  if (type === type.toUpperCase() && type.length > 1 && !/[a-z]/.test(type)) {
    processed = type.toLowerCase();
  }
  
  return processed
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * CourseProgress Component
 *
 * Displays course completion progress with visual indicators including percentage,
 * progress bars, and completion statistics. Shows a color-coded linear progress bar
 * with percentage label, completed/total activities count, and optional detailed
 * breakdown by activity type.
 *
 * Color coding:
 * - Red (error): 0-30% completion
 * - Orange (warning): 31-70% completion
 * - Green (success): 71-100% completion
 *
 * @example
 * ```tsx
 * <CourseProgress
 *   completionPercentage={75}
 *   completedActivities={15}
 *   totalActivities={20}
 *   showDetails={true}
 *   activityBreakdown={[
 *     { type: 'assignment', completed: 5, total: 6 },
 *     { type: 'quiz', completed: 3, total: 4 }
 *   ]}
 * />
 * ```
 */
function CourseProgress({
  completionPercentage,
  completedActivities,
  totalActivities,
  showDetails = false,
  activityBreakdown = [],
}: CourseProgressProps) {
  // Ensure percentage is within valid range
  const clampedPercentage = Math.max(0, Math.min(100, completionPercentage));
  const progressColor = getProgressColor(clampedPercentage);

  // Build detailed tooltip content
  const tooltipContent = (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
        Course Completion Details
      </Typography>
      <Typography variant="body2">Progress: {clampedPercentage.toFixed(1)}%</Typography>
      <Typography variant="body2">
        Activities: {completedActivities} of {totalActivities} completed
      </Typography>
      {activityBreakdown.length > 0 && (
        <>
          <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
            By Activity Type:
          </Typography>
          {activityBreakdown.map((item) => (
            <Typography key={item.type} variant="body2" sx={{ ml: 1 }}>
              • {formatActivityType(item.type)}: {item.completed}/{item.total}
            </Typography>
          ))}
        </>
      )}
    </Box>
  );

  return (
    <Tooltip title={tooltipContent} arrow enterDelay={300} leaveDelay={200}>
      <Box
        data-testid="course-progress"
        sx={{
          width: '100%',
          p: { xs: 1.5, sm: 2 },
          borderRadius: 1,
          backgroundColor: 'background.paper',
          border: 1,
          borderColor: 'divider',
        }}
      >
        {/* Main progress section */}
        <Stack spacing={2}>
          {/* Header with percentage and activities count */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1, sm: 2 }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '1rem', sm: '1.25rem' },
              }}
              data-testid="course-progress-percentage"
            >
              {clampedPercentage.toFixed(0)}% Complete
            </Typography>

            <Chip
              label={`${completedActivities} of ${totalActivities} activities completed`}
              size="small"
              color={progressColor}
              variant="outlined"
              data-testid="course-progress-chip"
              sx={{
                fontWeight: 500,
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
              }}
            />
          </Stack>

          {/* Progress bar */}
          <Box sx={{ width: '100%' }}>
            <LinearProgress
              variant="determinate"
              value={clampedPercentage}
              color={progressColor}
              sx={{
                height: 10,
                borderRadius: 5,
                backgroundColor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 5,
                  transition: 'transform 0.4s ease-in-out',
                },
              }}
              aria-label={`Course completion progress: ${clampedPercentage}% complete`}
              aria-valuenow={clampedPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              role="progressbar"
              data-testid="course-progress-bar"
            />
          </Box>

          {/* Detailed breakdown by activity type */}
          {showDetails && activityBreakdown.length > 0 && (
            <Box
              sx={{
                mt: 2,
                pt: 2,
                borderTop: 1,
                borderColor: 'divider',
              }}
              data-testid="course-progress-details"
            >
              <Typography
                variant="subtitle2"
                sx={{
                  mb: 1.5,
                  fontWeight: 600,
                  color: 'text.secondary',
                }}
              >
                Activity Breakdown
              </Typography>

              <Stack spacing={1.5}>
                {activityBreakdown.map((item) => {
                  const itemPercentage = item.total > 0 ? (item.completed / item.total) * 100 : 0;
                  const itemColor = getProgressColor(itemPercentage);

                  return (
                    <Box key={item.type} data-testid={`activity-breakdown-${item.type}`}>
                      {/* Activity type header */}
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ mb: 0.5 }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 500,
                            fontSize: { xs: '0.813rem', sm: '0.875rem' },
                          }}
                        >
                          {formatActivityType(item.type)}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontSize: { xs: '0.688rem', sm: '0.75rem' },
                          }}
                        >
                          {item.completed}/{item.total}
                        </Typography>
                      </Stack>

                      {/* Mini progress bar for this activity type */}
                      <LinearProgress
                        variant="determinate"
                        value={itemPercentage}
                        color={itemColor}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: 'action.hover',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                          },
                        }}
                        aria-label={`${formatActivityType(item.type)} progress: ${item.completed} of ${item.total} completed`}
                        data-testid={`activity-progress-bar-${item.type}`}
                      />
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          )}
        </Stack>
      </Box>
    </Tooltip>
  );
}

export default CourseProgress;
