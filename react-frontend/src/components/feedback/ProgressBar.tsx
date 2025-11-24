import type { ReactNode } from 'react';
import { LinearProgress, Box, Typography } from '@mui/material';
import type { LinearProgressProps } from '@mui/material';

/**
 * Props for the ProgressBar component
 */
interface ProgressBarProps {
  /**
   * Progress value between 0 and 100 (optional)
   * If provided, shows determinate progress
   * If omitted, shows indeterminate progress
   */
  value?: number;

  /**
   * Progress variant
   * 'determinate' - shows specific percentage (requires value)
   * 'indeterminate' - shows continuous animation (default if no value)
   * 'buffer' - shows buffering progress with two bars
   */
  variant?: 'determinate' | 'indeterminate' | 'buffer';

  /**
   * Color variant matching operation status
   * Maps to MUI theme colors
   */
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'inherit';

  /**
   * Whether to show the label (percentage or custom text)
   */
  showLabel?: boolean;

  /**
   * Custom label text (optional)
   * If not provided and showLabel is true, shows percentage
   */
  label?: string | ReactNode;

  /**
   * Buffer value for buffer variant (0-100)
   * Used for multi-stage operations
   */
  buffer?: number;

  /**
   * Height of the progress bar in pixels
   * Default: 4
   */
  height?: number;

  /**
   * Label position: 'overlay' (on top of bar) or 'below' (underneath bar)
   * Default: 'below'
   */
  labelPosition?: 'overlay' | 'below';

  /**
   * Additional className for styling
   */
  className?: string;

  /**
   * Accessible label for screen readers
   */
  ariaLabel?: string;
}

/**
 * ProgressBar Component
 *
 * Displays determinate and indeterminate progress for long-running operations.
 * Uses MUI LinearProgress with support for percentage display, color variants,
 * and buffer mode.
 *
 * Essential for:
 * - File uploads and downloads
 * - Quiz timers and time limits
 * - Course completion tracking
 * - Bulk operations (user imports, grade exports)
 * - Assignment submission processing
 * - Video processing and encoding
 * - Database backup and restore operations
 *
 * Features:
 * - Determinate progress (0-100%)
 * - Indeterminate progress (unknown duration)
 * - Buffer mode for multi-stage operations
 * - Customizable colors matching operation status
 * - Optional label display (percentage or custom text)
 * - Label positioning (overlay or below)
 * - Customizable height
 * - Full accessibility support (WCAG 2.1 AA)
 *
 * @example
 * // Determinate progress with label
 * <ProgressBar value={75} showLabel color="primary" />
 *
 * @example
 * // Indeterminate progress for unknown duration
 * <ProgressBar color="secondary" ariaLabel="Loading content" />
 *
 * @example
 * // Buffer mode for multi-stage file upload
 * <ProgressBar
 *   value={40}
 *   buffer={70}
 *   variant="buffer"
 *   showLabel
 *   label="Uploading and processing..."
 * />
 *
 * @example
 * // Quiz timer with overlay label
 * <ProgressBar
 *   value={60}
 *   showLabel
 *   labelPosition="overlay"
 *   label="12:30 remaining"
 *   color="warning"
 *   height={8}
 * />
 *
 * @example
 * // Course completion tracking
 * <ProgressBar
 *   value={85}
 *   showLabel
 *   label="Course 85% complete"
 *   color="success"
 * />
 *
 * @example
 * // Error state during operation
 * <ProgressBar
 *   value={45}
 *   showLabel
 *   label="Upload failed"
 *   color="error"
 * />
 */
export function ProgressBar({
  value,
  variant,
  color = 'primary',
  showLabel = false,
  label,
  buffer,
  height = 4,
  labelPosition = 'below',
  className,
  ariaLabel,
}: ProgressBarProps) {
  // Determine variant automatically based on value and buffer
  const effectiveVariant: LinearProgressProps['variant'] =
    variant ??
    (buffer !== undefined ? 'buffer' : value !== undefined && value !== null ? 'determinate' : 'indeterminate');

  // Clamp value between 0 and 100, treating null as undefined
  const clampedValue = value !== undefined && value !== null ? Math.max(0, Math.min(100, value)) : undefined;

  // Clamp buffer between 0 and 100
  const clampedBuffer = buffer !== undefined ? Math.max(0, Math.min(100, buffer)) : undefined;

  // Determine label text - filter out empty strings
  const labelText =
    label !== undefined
      ? label === '' ? undefined : label
      : clampedValue !== undefined
        ? `${Math.round(clampedValue)}%`
        : undefined;

  // Map color to MUI theme colors
  // MUI LinearProgress supports: primary, secondary, error, info, success, warning, inherit
  const progressColor =
    color === 'primary' ||
    color === 'secondary' ||
    color === 'error' ||
    color === 'info' ||
    color === 'success' ||
    color === 'warning' ||
    color === 'inherit'
      ? color
      : 'primary';

  return (
    <Box
      className={className}
      sx={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: labelPosition === 'below' ? 0.5 : 0,
      }}
    >
      {/* Progress Bar with optional overlay label */}
      <Box sx={{ position: 'relative', width: '100%' }}>
        <LinearProgress
          variant={effectiveVariant}
          value={clampedValue}
          valueBuffer={clampedBuffer}
          color={progressColor}
          sx={{
            height: `${height}px`,
            borderRadius: `${height / 2}px`,
          }}
          aria-label={ariaLabel}
          {...(effectiveVariant === 'determinate' || effectiveVariant === 'buffer' ? {
            'aria-valuenow': clampedValue,
            'aria-valuemin': 0,
            'aria-valuemax': 100,
          } : {})}
          role="progressbar"
        />

        {/* Overlay Label - positioned on top of progress bar */}
        {showLabel && labelText && labelPosition === 'overlay' && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'text.primary',
                textShadow: '0px 0px 2px rgba(255, 255, 255, 0.8)',
              }}
            >
              {labelText}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Below Label - positioned underneath progress bar */}
      {showLabel && labelText && labelPosition === 'below' && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 20,
          }}
        >
          <Typography
            component="p"
            variant="caption"
            color="text.secondary"
            sx={{
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            {labelText}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
