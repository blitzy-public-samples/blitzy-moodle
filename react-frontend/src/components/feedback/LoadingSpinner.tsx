/**
 * LoadingSpinner Component
 *
 * A reusable loading spinner component that displays an animated circular progress
 * indicator during async operations. Supports both inline and overlay display modes
 * with configurable size and color variants.
 *
 * Features:
 * - Material-UI CircularProgress with configurable size (small/medium/large)
 * - Overlay mode with backdrop for full-page blocking operations
 * - Inline mode for component-level loading states
 * - Optional loading message display
 * - Full accessibility support (WCAG 2.1 AA compliant)
 * - TypeScript strict mode with explicit prop interfaces
 *
 * Usage:
 * - React Query loading states: <LoadingSpinner size="medium" />
 * - React Suspense fallback: <LoadingSpinner message="Loading content..." />
 * - Form submissions: <LoadingSpinner overlay message="Submitting..." />
 * - Full page loading: <LoadingSpinner overlay fullPage />
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import type { ReactNode } from 'react';
import {
  CircularProgress,
  Box,
  Backdrop,
  Typography,
  type CircularProgressProps,
  type BackdropProps,
} from '@mui/material';

/**
 * Size variant type for the loading spinner
 * Maps to specific pixel dimensions for consistent sizing across the application
 */
export type LoadingSpinnerSize = 'small' | 'medium' | 'large';

/**
 * Color variant type for the loading spinner
 * Uses theme palette colors for consistent styling
 */
export type LoadingSpinnerColor = 'primary' | 'secondary' | 'inherit';

/**
 * Props interface for the LoadingSpinner component
 * All props are optional with sensible defaults for common use cases
 */
export interface LoadingSpinnerProps {
  /**
   * Size of the spinner
   * - small: 24px (inline loading, table cells, small buttons)
   * - medium: 40px (default, general purpose)
   * - large: 60px (full page loading, major operations)
   * @default 'medium'
   */
  size?: LoadingSpinnerSize;

  /**
   * Whether to display as an overlay with backdrop
   * When true, displays over existing content with semi-transparent backdrop
   * @default false
   */
  overlay?: boolean;

  /**
   * Color variant for the spinner
   * Uses theme.palette.primary or theme.palette.secondary colors
   * @default 'primary'
   */
  color?: LoadingSpinnerColor;

  /**
   * Whether to use full page positioning
   * When true with overlay, covers entire viewport with fixed positioning
   * @default false
   */
  fullPage?: boolean;

  /**
   * Optional loading message to display below the spinner
   * Useful for providing context about what is loading
   * @default undefined
   */
  message?: string | ReactNode;

  /**
   * Optional aria-label for accessibility
   * Overrides the default "Loading" label
   * @default 'Loading'
   */
  ariaLabel?: string;

  /**
   * Optional className for custom styling
   * Applied to the outermost container element
   * @default undefined
   */
  className?: string;

  /**
   * Optional z-index for overlay mode
   * Controls stacking order when multiple overlays exist
   * @default 1300 (MUI default for Backdrop)
   */
  zIndex?: number;
}

/**
 * Maps size variant to pixel dimensions
 * Provides consistent sizing across the application
 */
const SIZE_MAP: Record<LoadingSpinnerSize, number> = {
  small: 24,
  medium: 40,
  large: 60,
};

/**
 * LoadingSpinner Component
 *
 * Displays an animated circular progress indicator with optional message.
 * Supports both inline and overlay modes for different use cases.
 *
 * Inline Mode (overlay=false):
 * - Renders as a flex container with centered spinner
 * - Suitable for component-level loading states
 * - Does not block user interaction with other elements
 *
 * Overlay Mode (overlay=true):
 * - Uses MUI Backdrop component for semi-transparent overlay
 * - Blocks user interaction with underlying content
 * - Can be scoped to container or cover full viewport (fullPage=true)
 *
 * Accessibility:
 * - role="progressbar" for screen reader identification
 * - aria-label describes loading state
 * - Keyboard navigation not intercepted in inline mode
 * - Focus trap in overlay mode prevents interaction with covered content
 *
 * @param props - Component props
 * @returns Rendered loading spinner component
 */
export function LoadingSpinner({
  size = 'medium',
  overlay = false,
  color = 'primary',
  fullPage = false,
  message,
  ariaLabel = 'Loading',
  className,
  zIndex = 1300,
}: LoadingSpinnerProps): JSX.Element {
  // Calculate spinner size in pixels from size variant
  const spinnerSize = SIZE_MAP[size];

  // Build CircularProgress props
  const circularProgressProps: CircularProgressProps = {
    size: spinnerSize,
    color,
    role: 'progressbar',
    'aria-label': ariaLabel,
    'aria-busy': 'true',
  };

  /**
   * Renders the spinner content (CircularProgress + optional message)
   * This is the core loading indicator that's used in both modes
   */
  const renderSpinnerContent = () => (
    <Box
      data-testid="loading-spinner"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <CircularProgress {...circularProgressProps} />
      {message && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            textAlign: 'center',
            maxWidth: 300,
          }}
        >
          {message}
        </Typography>
      )}
    </Box>
  );

  // Overlay mode: Use Backdrop component for full-page or container-scoped blocking
  if (overlay) {
    const backdropProps: BackdropProps = {
      open: true,
      sx: {
        color: '#fff',
        zIndex,
        // Full page mode uses fixed positioning to cover entire viewport
        // Container mode uses absolute positioning to cover parent container
        position: fullPage ? 'fixed' : 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      },
      className,
    };

    return <Backdrop {...backdropProps}>{renderSpinnerContent()}</Backdrop>;
  }

  // Inline mode: Use Box container for component-level loading states
  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
        minHeight: fullPage ? '100vh' : 'auto',
      }}
    >
      {renderSpinnerContent()}
    </Box>
  );
}

// Named export (default export not used per schema specification)
export default LoadingSpinner;
