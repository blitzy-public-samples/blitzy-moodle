/**
 * GradeDetail Component
 *
 * Displays detailed information about a single grade item including:
 * - Grade value with proper formatting (numeric, scale, or text)
 * - Submission status (submitted, late, missing, graded)
 * - Feedback comments with HTML sanitization
 * - Grade modification history timeline
 * - Status indicators (overridden, hidden, locked, excluded)
 * - Grade scale information
 *
 * This component provides a comprehensive read-only view of grade details
 * with collapsible sections for feedback and history. All data is retrieved
 * from the backend API which wraps existing Moodle grade functions.
 *
 * @package    react-frontend
 * @subpackage features/gradebook/components
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import type React from 'react';
import { useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Skeleton,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineDot,
  TimelineContent,
} from '@mui/lab';
import {
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import DOMPurify from 'dompurify';
import { formatDistanceToNow } from 'date-fns';

// Internal imports
import { GradeType } from '../types/grade.types';
import { formatDate } from '../../../utils/date';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Submission status enumeration
 * Indicates the current state of a student's submission for a grade item
 */
export type SubmissionStatus = 'submitted' | 'late' | 'missing' | 'graded' | 'pending';

/**
 * Grade modification history entry
 * Represents a single modification event in the grade's audit trail
 */
export interface GradeModificationEntry {
  /** Unique identifier for this modification event */
  id: number;
  /** Name of the user who made the modification */
  modifierName: string;
  /** Timestamp when the modification occurred (Unix timestamp in seconds) */
  timestamp: number;
  /** Previous grade value before modification */
  oldGrade: number | null;
  /** New grade value after modification */
  newGrade: number | null;
  /** Optional reason or comment explaining the modification */
  reason?: string;
}

/**
 * Grade scale option
 * Represents a single option in a grade scale (e.g., competency levels)
 */
export interface GradeScaleOption {
  /** Numeric value associated with this scale option */
  value: number;
  /** Display name for this scale option */
  name: string;
}

/**
 * Grade scale definition
 * Complete definition of a grade scale with all available options
 */
export interface GradeScale {
  /** Unique identifier for this scale */
  id: number;
  /** Name of the scale (e.g., "Competency Scale") */
  name: string;
  /** Ordered list of scale options from lowest to highest */
  options: GradeScaleOption[];
}

/**
 * Complete grade detail data structure
 * Contains all information needed to display comprehensive grade details
 */
export interface GradeDetailData {
  /** Unique identifier for this grade record */
  id: number;
  /** Display name of the grade item */
  name: string;
  /** Final calculated grade value after all adjustments */
  finalgrade: number | null;
  /** Maximum possible grade value */
  grademax: number;
  /** Textual feedback from instructor */
  feedback: string | null;
  /** Current submission status */
  submissionStatus: SubmissionStatus;
  /** Complete history of modifications to this grade */
  modificationHistory: GradeModificationEntry[];
  /** Whether this grade was manually overridden by instructor */
  overridden: boolean;
  /** Whether this grade is excluded from course total calculations */
  excluded: boolean;
  /** Hidden status: false=visible, true=hidden, or timestamp for hidden until */
  hidden: boolean | number;
  /** Locked status: false=unlocked, true=locked, or timestamp for locked until */
  locked: boolean | number;
  /** Timestamp when this grade should be automatically locked (0 if no auto-lock) */
  locktime: number;
  /** Type of grade (NONE, VALUE, SCALE, TEXT) */
  gradetype: GradeType;
  /** Scale information if gradetype is SCALE */
  scale?: GradeScale;
  /** Selected scale option ID if gradetype is SCALE */
  scaleid: number | null;
}

/**
 * Props for the GradeDetail component
 */
export interface GradeDetailProps {
  /** Grade item data to display */
  gradeItem: GradeDetailData | null;
  /** Loading state indicator */
  loading?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color for submission status chip
 *
 * @param status - Submission status
 * @returns Material-UI color prop value
 */
function getStatusColor(
  status: SubmissionStatus
): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
  switch (status) {
    case 'submitted':
    case 'graded':
      return 'success';
    case 'late':
      return 'warning';
    case 'missing':
      return 'error';
    case 'pending':
      return 'info';
    default:
      return 'default';
  }
}

/**
 * Format grade value for display
 *
 * @param grade - Numeric grade value
 * @param max - Maximum grade value
 * @param gradetype - Type of grade
 * @param scale - Scale information if applicable
 * @param scaleid - Selected scale option ID
 * @returns Formatted grade string
 */
function formatGradeValue(
  grade: number | null,
  max: number,
  gradetype: GradeType,
  scale?: GradeScale,
  scaleid?: number | null
): string {
  if (grade === null) {
    return 'Not graded';
  }

  switch (gradetype) {
    case GradeType.VALUE: {
      // Numeric grade - show as fraction and percentage
      const percentage = max > 0 ? ((grade / max) * 100).toFixed(1) : '0.0';
      return `${grade.toFixed(2)} / ${max.toFixed(2)} (${percentage}%)`;
    }

    case GradeType.SCALE:
      // Scale grade - show scale option name
      if (scale && scaleid) {
        const option = scale.options.find((opt) => opt.value === scaleid);
        return option ? option.name : `Scale value: ${scaleid}`;
      }
      return `Scale value: ${scaleid ?? 'N/A'}`;

    case GradeType.TEXT:
      // Text grade - no numeric value
      return 'Text feedback only';

    case GradeType.NONE:
    default:
      return 'No grade';
  }
}

/**
 * Sanitize HTML feedback content
 *
 * @param html - Raw HTML string
 * @returns Sanitized HTML safe for rendering
 */
function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'b',
      'i',
      'ul',
      'ol',
      'li',
      'a',
      'span',
      'div',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Format hidden status for display
 *
 * @param hidden - Hidden status value
 * @returns Human-readable hidden status
 */
function formatHiddenStatus(hidden: boolean | number): string {
  if (typeof hidden === 'boolean') {
    return hidden ? 'Hidden' : 'Visible';
  }
  if (hidden > 0) {
    const date = new Date(hidden * 1000);
    return `Hidden until ${formatDate(date)}`;
  }
  return 'Visible';
}

/**
 * Format locked status for display
 *
 * @param locked - Locked status value
 * @returns Human-readable locked status
 */
function formatLockedStatus(locked: boolean | number): string {
  if (typeof locked === 'boolean') {
    return locked ? 'Locked' : 'Unlocked';
  }
  if (locked > 0) {
    const date = new Date(locked * 1000);
    return `Locked until ${formatDate(date)}`;
  }
  return 'Unlocked';
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * GradeDetail Component
 *
 * Displays comprehensive grade information with collapsible sections for
 * feedback and modification history. Supports multiple grade types and
 * provides visual indicators for grade status.
 *
 * @param props - Component props
 * @returns React element
 */
export default function GradeDetail({ gradeItem, loading = false }: GradeDetailProps): React.ReactElement {
  // ============================================================================
  // Memoized Values
  // ============================================================================

  /**
   * Formatted grade display string
   */
  const gradeDisplay = useMemo(() => {
    if (!gradeItem) {
      return '';
    }
    return formatGradeValue(
      gradeItem.finalgrade,
      gradeItem.grademax,
      gradeItem.gradetype,
      gradeItem.scale,
      gradeItem.scaleid
    );
  }, [gradeItem]);

  /**
   * Sanitized feedback HTML
   */
  const sanitizedFeedback = useMemo(() => {
    if (!gradeItem?.feedback) {
      return '';
    }
    return sanitizeHTML(gradeItem.feedback);
  }, [gradeItem?.feedback]);

  /**
   * Hidden status display string
   */
  const hiddenStatus = useMemo(() => {
    if (!gradeItem) {
      return '';
    }
    return formatHiddenStatus(gradeItem.hidden);
  }, [gradeItem]);

  /**
   * Locked status display string
   */
  const lockedStatus = useMemo(() => {
    if (!gradeItem) {
      return '';
    }
    return formatLockedStatus(gradeItem.locked);
  }, [gradeItem]);

  /**
   * Whether the grade is currently hidden
   */
  const isHidden = useMemo(() => {
    if (!gradeItem) {
      return false;
    }
    if (typeof gradeItem.hidden === 'boolean') {
      return gradeItem.hidden;
    }
    if (typeof gradeItem.hidden === 'number' && gradeItem.hidden > 0) {
      return Date.now() < gradeItem.hidden * 1000;
    }
    return false;
  }, [gradeItem]);

  /**
   * Whether the grade is currently locked
   */
  const isLocked = useMemo(() => {
    if (!gradeItem) {
      return false;
    }
    if (typeof gradeItem.locked === 'boolean') {
      return gradeItem.locked;
    }
    if (typeof gradeItem.locked === 'number' && gradeItem.locked > 0) {
      return Date.now() < gradeItem.locked * 1000;
    }
    return false;
  }, [gradeItem]);

  // ============================================================================
  // Loading State
  // ============================================================================

  if (loading) {
    return (
      <Card>
        <CardHeader
          title={<Skeleton width="60%" />}
          subheader={<Skeleton width="40%" />}
        />
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Skeleton variant="rectangular" height={60} />
            <Skeleton variant="rectangular" height={100} />
            <Skeleton variant="rectangular" height={150} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // Empty State
  // ============================================================================

  if (!gradeItem) {
    return (
      <Card>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4,
              gap: 2,
            }}
          >
            <InfoIcon color="info" sx={{ fontSize: 64 }} />
            <Typography variant="h6" color="text.secondary">
              No grade data available
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Select a grade item to view detailed information.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" component="h2">
              {gradeItem.name}
            </Typography>
            {gradeItem.submissionStatus === 'missing' && (
              <Tooltip title="Submission missing">
                <WarningIcon color="error" fontSize="small" />
              </Tooltip>
            )}
          </Box>
        }
        subheader={`Grade ID: ${gradeItem.id}`}
      />

      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Grade Display Section */}
          <Box>
            <Typography variant="overline" color="text.secondary" gutterBottom>
              Grade
            </Typography>
            <Typography variant="h5" color="primary" gutterBottom>
              {gradeDisplay}
            </Typography>

            {/* Submission Status */}
            <Box sx={{ mt: 1 }}>
              <Chip
                label={gradeItem.submissionStatus.charAt(0).toUpperCase() + gradeItem.submissionStatus.slice(1)}
                color={getStatusColor(gradeItem.submissionStatus)}
                size="small"
              />
            </Box>
          </Box>

          <Divider />

          {/* Status Indicators Section */}
          {(gradeItem.overridden || gradeItem.excluded || isHidden || isLocked) && (
            <>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {gradeItem.overridden && (
                  <Alert severity="info" icon={<InfoIcon />}>
                    This grade has been manually overridden by an instructor.
                  </Alert>
                )}

                {gradeItem.excluded && (
                  <Chip
                    label="Excluded from course total"
                    color="warning"
                    size="small"
                    variant="outlined"
                  />
                )}

                {isHidden && (
                  <Tooltip title={hiddenStatus}>
                    <Box 
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                      aria-label={`This grade is currently hidden. ${hiddenStatus}`}
                    >
                      <VisibilityOffIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {hiddenStatus}
                      </Typography>
                    </Box>
                  </Tooltip>
                )}

                {!isHidden && gradeItem.hidden !== false && (
                  <Tooltip title={hiddenStatus}>
                    <Box 
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                      aria-label={hiddenStatus}
                    >
                      <VisibilityIcon fontSize="small" color="success" />
                      <Typography variant="body2" color="text.secondary">
                        {hiddenStatus}
                      </Typography>
                    </Box>
                  </Tooltip>
                )}

                {isLocked && (
                  <Tooltip title={lockedStatus}>
                    <Box 
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                      aria-label={`This grade is locked. ${lockedStatus} - Cannot be modified`}
                    >
                      <LockIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {lockedStatus} - Cannot be modified
                      </Typography>
                    </Box>
                  </Tooltip>
                )}

                {!isLocked && gradeItem.locked !== false && (
                  <Tooltip title={lockedStatus}>
                    <Box 
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                      aria-label={lockedStatus}
                    >
                      <LockOpenIcon fontSize="small" color="success" />
                      <Typography variant="body2" color="text.secondary">
                        {lockedStatus}
                      </Typography>
                    </Box>
                  </Tooltip>
                )}

                {gradeItem.locktime > 0 && !isLocked && (
                  <Typography variant="caption" color="text.secondary">
                    Auto-lock scheduled: {formatDate(new Date(gradeItem.locktime * 1000))}
                  </Typography>
                )}
              </Box>

              <Divider />
            </>
          )}

          {/* Scale Information Section */}
          {gradeItem.gradetype === GradeType.SCALE && gradeItem.scale && (
            <>
              <Box>
                <Typography variant="overline" color="text.secondary" gutterBottom>
                  Scale Information
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Scale:</strong> {gradeItem.scale.name}
                </Typography>
                <Typography variant="body2">
                  <strong>Options:</strong> {gradeItem.scale.options.map((opt) => opt.name).join(', ')}
                </Typography>
              </Box>

              <Divider />
            </>
          )}

          {/* Feedback Section */}
          {gradeItem.feedback && (
            <>
              <Accordion>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="grade-feedback-content"
                  id="grade-feedback-header"
                >
                  <Typography variant="subtitle1">Feedback</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box
                    sx={{
                      '& p': { mb: 1 },
                      '& ul, & ol': { mb: 1, pl: 2 },
                      '& li': { mb: 0.5 },
                    }}
                    dangerouslySetInnerHTML={{ __html: sanitizedFeedback }}
                  />
                </AccordionDetails>
              </Accordion>

              <Divider />
            </>
          )}

          {/* Modification History Section */}
          {gradeItem.modificationHistory.length > 0 && (
            <Accordion>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="grade-history-content"
                id="grade-history-header"
              >
                <Typography variant="subtitle1">
                  Modification History ({gradeItem.modificationHistory.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Timeline>
                  {gradeItem.modificationHistory.map((entry, index) => (
                    <TimelineItem key={entry.id}>
                      <TimelineSeparator>
                        <TimelineDot color="primary" />
                        {index < gradeItem.modificationHistory.length - 1 && <TimelineConnector />}
                      </TimelineSeparator>
                      <TimelineContent>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" component="h3">
                            {entry.modifierName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDistanceToNow(new Date(entry.timestamp * 1000), { addSuffix: true })}
                            {' · '}
                            {formatDate(new Date(entry.timestamp * 1000))}
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2">
                              Grade changed from{' '}
                              <strong>{entry.oldGrade !== null ? entry.oldGrade.toFixed(2) : 'Not graded'}</strong> to{' '}
                              <strong>{entry.newGrade !== null ? entry.newGrade.toFixed(2) : 'Not graded'}</strong>
                            </Typography>
                            {entry.reason && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Reason: {entry.reason}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TimelineContent>
                    </TimelineItem>
                  ))}
                </Timeline>
              </AccordionDetails>
            </Accordion>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
