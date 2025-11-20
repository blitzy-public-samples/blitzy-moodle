/**
 * H5P Attempt Report Card Component
 *
 * Displays individual H5P attempt results in a card format with comprehensive
 * attempt information including score, completion status, duration, and timestamp.
 *
 * This component transforms the PHP Mustache template rendering of attempt cards
 * into a TypeScript Material-UI component, providing a modern, responsive UI
 * for displaying H5P activity attempt results.
 *
 * Features:
 * - Display attempt number with clear identification
 * - Show score as fraction (rawscore/maxscore) with percentage calculation
 * - Visual progress indicator for score percentage
 * - Completion status indicator with Material-UI icons
 * - Success status indicator with appropriate color coding
 * - Human-readable duration formatting
 * - Timestamp display for attempt submission
 * - Clickable card for navigation to detailed attempt view
 * - Responsive layout for mobile and desktop
 * - Accessible with proper ARIA labels
 * - Hover effects for interactive feedback
 *
 * Based on Moodle templates:
 * @see public/mod/h5pactivity/templates/attempt.mustache
 * @see public/mod/h5pactivity/templates/attempts.mustache
 * @see public/mod/h5pactivity/classes/local/attempt.php
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Box,
  Chip,
  Stack,
  useTheme,
  alpha,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  AccessTime as AccessTimeIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { LinearProgress } from '@mui/material';
import { Link } from 'react-router-dom';

// Internal imports
import type { H5PAttempt } from '../types/h5p.types';
import { formatDuration } from '@/utils/date';
import { formatNumber } from '@/utils/formatters';
import { formatDistanceToNow } from 'date-fns';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props for H5PReportCard component
 */
interface H5PReportCardProps {
  /** The H5P attempt data to display */
  attempt: H5PAttempt;
  /** URL path for detailed attempt view */
  reportUrl: string;
  /** Whether to display in compact mode (for list views) */
  compact?: boolean;
  /** Whether this attempt is the scored attempt (used for grading) */
  isScored?: boolean;
  /** Optional click handler (overrides default navigation) */
  onClick?: (attemptId: number) => void;
  /** Optional CSS class name for styling */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate percentage score from raw and max scores
 *
 * @param rawScore - The raw score achieved
 * @param maxScore - The maximum possible score
 * @returns Percentage score (0-100), or 0 if maxScore is 0
 */
function calculatePercentage(rawScore: number, maxScore: number): number {
  if (maxScore === 0) {
    return 0;
  }
  return Math.round((rawScore / maxScore) * 100);
}

/**
 * Get color for score percentage
 *
 * @param percentage - The percentage score (0-100)
 * @returns Color string for Material-UI components
 */
function getScoreColor(percentage: number): 'error' | 'warning' | 'success' {
  if (percentage < 50) {
    return 'error';
  } else if (percentage < 75) {
    return 'warning';
  }
  return 'success';
}

/**
 * Format timestamp to human-readable relative time string
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted relative time string (e.g., "about 1 hour ago")
 */
function formatTimestamp(timestamp: number): string {
  // Convert Unix timestamp (seconds) to milliseconds for Date constructor
  const date = new Date(timestamp * 1000);
  
  // Use formatDistanceToNow to get relative time (e.g., "about 1 hour ago")
  return formatDistanceToNow(date, { addSuffix: true });
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * H5PReportCard Component
 *
 * Displays an individual H5P attempt as a card with score, completion,
 * success status, duration, and timestamp information.
 *
 * @param props - Component properties
 * @returns React element
 */
export function H5PReportCard({
  attempt,
  reportUrl,
  compact = false,
  isScored = false,
  onClick,
  className,
}: H5PReportCardProps): JSX.Element {
  const theme = useTheme();

  // Calculate derived values
  const percentage = calculatePercentage(attempt.rawscore, attempt.maxscore);
  const scoreColor = getScoreColor(percentage);
  const hasScore = attempt.maxscore > 0;

  // Determine completion status
  const isComplete = attempt.completion === 1;
  const isSuccessful = attempt.success === 1;
  
  // Format values for display
  const formattedDate = formatTimestamp(attempt.timemodified);
  const formattedDuration = formatDuration(attempt.duration);
  const formattedRawScore = formatNumber(attempt.rawscore, 1);
  const formattedMaxScore = formatNumber(attempt.maxscore, 1);

  // Handle card click
  const handleClick = () => {
    if (onClick) {
      onClick(attempt.id);
    }
  };

  // ============================================================================
  // Render Functions
  // ============================================================================

  /**
   * Render completion status chip
   */
  const renderCompletionChip = () => {
    if (isComplete) {
      return (
        <Chip
          icon={<CheckCircleIcon />}
          label="Complete"
          color="success"
          size="small"
          variant="outlined"
          aria-label="Attempt completed"
        />
      );
    }
    return (
      <Chip
        icon={<RadioButtonUncheckedIcon />}
        label="Incomplete"
        color="default"
        size="small"
        variant="outlined"
        aria-label="Attempt incomplete"
      />
    );
  };

  /**
   * Render success status chip
   */
  const renderSuccessChip = () => {
    if (!hasScore) {
      return null;
    }

    if (isSuccessful) {
      return (
        <Chip
          icon={<CheckCircleIcon />}
          label="Passed"
          color="success"
          size="small"
          aria-label="Attempt successful"
        />
      );
    }
    return (
      <Chip
        icon={<RadioButtonUncheckedIcon />}
        label="Failed"
        color="error"
        size="small"
        aria-label="Attempt not successful"
      />
    );
  };

  /**
   * Render score section with progress bar
   */
  const renderScoreSection = () => {
    if (!hasScore) {
      return (
        <Typography variant="body2" color="text.secondary">
          No score available
        </Typography>
      );
    }

    return (
      <Box sx={{ width: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            mb: 0.5,
          }}
        >
          <Typography variant="h6" component="span" fontWeight="bold">
            {formattedRawScore} / {formattedMaxScore}
          </Typography>
          <Typography
            variant="body2"
            component="span"
            color={`${scoreColor}.main`}
            fontWeight="medium"
          >
            {percentage}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={percentage}
          color={scoreColor}
          sx={{
            height: 8,
            borderRadius: 1,
            backgroundColor: alpha(theme.palette[scoreColor].main, 0.1),
          }}
          aria-label={`Score: ${percentage} percent`}
        />
      </Box>
    );
  };

  /**
   * Render metadata (duration and timestamp)
   */
  const renderMetadata = () => {
    return (
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <SpeedIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            {formattedDuration}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <AccessTimeIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            {formattedDate}
          </Typography>
        </Box>
      </Stack>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Card
      className={className}
      role="article"
      sx={{
        position: 'relative',
        ...(isScored && {
          borderColor: 'primary.main',
          borderWidth: 2,
          borderStyle: 'solid',
        }),
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: theme.shadows[8],
          transform: 'translateY(-2px)',
        },
      }}
      elevation={2}
    >
      <CardActionArea
        {...(onClick
          ? {
              onClick: handleClick,
            }
          : {
              component: Link,
              to: reportUrl,
            })}
        sx={{ height: '100%' }}
        aria-label={`View details for attempt ${attempt.attempt}`}
      >
        <CardContent
          sx={{
            position: 'relative',
            p: compact ? 2 : 3,
          }}
        >
          {/* Scored badge */}
          {isScored && (
            <Chip
              label="Scored"
              color="primary"
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
              }}
            />
          )}

          {/* Attempt number header */}
          <Typography
            variant="h6"
            component="h3"
            gutterBottom
            fontWeight="medium"
            sx={{ mb: 2 }}
          >
            Attempt {attempt.attempt}
          </Typography>

          {/* Score section */}
          <Box sx={{ mb: 2 }}>
            {renderScoreSection()}
          </Box>

          {/* Status chips */}
          <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            {renderCompletionChip()}
            {renderSuccessChip()}
          </Stack>

          {/* Metadata section */}
          {!compact && renderMetadata()}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default H5PReportCard;
