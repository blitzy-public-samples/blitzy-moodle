/**
 * EnrollButton Component
 *
 * A reusable React component for handling course enrollment actions with
 * comprehensive loading states, optimistic UI updates, and error handling.
 * Displays enrollment status (enrolled, not enrolled, pending) with appropriate
 * button states and visual feedback.
 *
 * This component wraps the enrollment functionality from public/enrol/index.php
 * and provides a modern, accessible interface for course enrollment operations.
 *
 * Features:
 * - Visual indication of enrollment status (enrolled, pending, available)
 * - Loading spinner during enrollment API calls
 * - Optimistic UI updates for immediate feedback
 * - Error handling with toast notifications
 * - Tooltip for additional context and error messages
 * - Full accessibility support with ARIA attributes
 * - TypeScript strict mode compliance (no 'any' types)
 *
 * Architecture:
 * Uses React Query mutation hook (useEnrollment) for API calls which wraps
 * Moodle's enrol_try_internal_enrol() function, maintaining 100% backward
 * compatibility with existing PHP business logic.
 *
 * @example
 * ```tsx
 * import EnrollButton from '@/features/courses/components/EnrollButton';
 *
 * function CourseCard({ course }) {
 *   const handleEnrollmentChange = (enrolled: boolean) => {
 *     console.log(`User is now ${enrolled ? 'enrolled' : 'not enrolled'}`);
 *   };
 *
 *   return (
 *     <div>
 *       <h2>{course.name}</h2>
 *       <EnrollButton
 *         courseId={course.id}
 *         isEnrolled={course.isEnrolled}
 *         enrollmentStatus={course.enrollmentStatus}
 *         onEnrollmentChange={handleEnrollmentChange}
 *       />
 *     </div>
 *   );
 * }
 * ```
 *
 * @module features/courses/components/EnrollButton
 * @see public/enrol/index.php - Moodle enrollment page reference
 * @see useEnrollment - React Query mutation hook for enrollment operations
 */

import { useState } from 'react';
import { Button, CircularProgress, Tooltip } from '@mui/material';
import { CheckCircle, PersonAdd, Schedule } from '@mui/icons-material';
import { useEnrollment } from '@/features/courses/hooks/useEnrollment';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Enrollment status values that determine button appearance and behavior
 *
 * @type {EnrollmentStatus}
 * - 'enrolled': User is currently enrolled in the course
 * - 'not_enrolled': User is not enrolled and can enroll
 * - 'pending': Enrollment is pending approval or processing
 * - 'restricted': User cannot enroll due to restrictions
 */
export type EnrollmentStatus = 'enrolled' | 'not_enrolled' | 'pending' | 'restricted';

/**
 * Props interface for the EnrollButton component
 *
 * Defines all required and optional props with TypeScript strict typing.
 * No 'any' types are used to ensure type safety throughout the component.
 *
 * @interface EnrollButtonProps
 */
export interface EnrollButtonProps {
  /**
   * The unique identifier of the course
   * Must be a positive integer matching the Moodle course ID
   */
  courseId: number;

  /**
   * Whether the current user is enrolled in the course
   * Used to determine initial button state and action type
   */
  isEnrolled: boolean;

  /**
   * Current enrollment status string
   * Determines button appearance and available actions
   * @default 'not_enrolled' if not provided and isEnrolled is false
   */
  enrollmentStatus: EnrollmentStatus;

  /**
   * Callback function invoked when enrollment status changes
   * Called with true on successful enrollment, false on unenrollment
   *
   * @param enrolled - New enrollment state after the operation
   */
  onEnrollmentChange?: (enrolled: boolean) => void;

  /**
   * Optional size variant for the button
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Optional full width mode
   * @default false
   */
  fullWidth?: boolean;

  /**
   * Optional custom className for additional styling
   */
  className?: string;

  /**
   * Optional disabled state override
   * When true, button is disabled regardless of enrollment status
   */
  disabled?: boolean;

  /**
   * Optional tooltip text override
   * When provided, replaces the default tooltip text
   */
  tooltipText?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines the appropriate icon component based on enrollment status
 *
 * @param status - Current enrollment status
 * @param isLoading - Whether an operation is in progress
 * @returns React node for the button icon
 */
function getStatusIcon(
  status: EnrollmentStatus,
  isLoading: boolean
): React.ReactNode {
  if (isLoading) {
    return <CircularProgress size={20} color="inherit" />;
  }

  switch (status) {
    case 'enrolled':
      return <CheckCircle />;
    case 'pending':
      return <Schedule />;
    case 'not_enrolled':
    case 'restricted':
    default:
      return <PersonAdd />;
  }
}

/**
 * Determines the button text based on enrollment status and loading state
 *
 * @param status - Current enrollment status
 * @param isLoading - Whether an operation is in progress
 * @returns Display text for the button
 */
function getButtonText(status: EnrollmentStatus, isLoading: boolean): string {
  if (isLoading) {
    return 'Enrolling...';
  }

  switch (status) {
    case 'enrolled':
      return 'Enrolled';
    case 'pending':
      return 'Pending';
    case 'restricted':
      return 'Restricted';
    case 'not_enrolled':
    default:
      return 'Enroll';
  }
}

/**
 * Determines the button variant based on enrollment status
 *
 * @param status - Current enrollment status
 * @returns MUI button variant
 */
function getButtonVariant(
  status: EnrollmentStatus
): 'contained' | 'outlined' | 'text' {
  switch (status) {
    case 'enrolled':
      return 'outlined';
    case 'pending':
      return 'outlined';
    case 'not_enrolled':
    default:
      return 'contained';
  }
}

/**
 * Determines the button color based on enrollment status
 *
 * @param status - Current enrollment status
 * @returns MUI button color
 */
function getButtonColor(
  status: EnrollmentStatus
): 'primary' | 'success' | 'warning' | 'inherit' {
  switch (status) {
    case 'enrolled':
      return 'success';
    case 'pending':
      return 'warning';
    case 'restricted':
      return 'inherit';
    case 'not_enrolled':
    default:
      return 'primary';
  }
}

/**
 * Generates default tooltip text based on enrollment status
 *
 * @param status - Current enrollment status
 * @param errorMessage - Optional error message to display
 * @returns Tooltip text string
 */
function getDefaultTooltipText(
  status: EnrollmentStatus,
  errorMessage?: string
): string {
  if (errorMessage) {
    return errorMessage;
  }

  switch (status) {
    case 'enrolled':
      return 'You are enrolled in this course';
    case 'pending':
      return 'Your enrollment is pending approval';
    case 'restricted':
      return 'Enrollment is restricted for this course';
    case 'not_enrolled':
    default:
      return 'Click to enroll in this course';
  }
}

/**
 * Generates ARIA label for accessibility based on enrollment status
 *
 * @param status - Current enrollment status
 * @param isLoading - Whether an operation is in progress
 * @returns ARIA label string
 */
function getAriaLabel(status: EnrollmentStatus, isLoading: boolean): string {
  if (isLoading) {
    return 'Enrollment in progress, please wait';
  }

  switch (status) {
    case 'enrolled':
      return 'You are currently enrolled in this course';
    case 'pending':
      return 'Your enrollment request is pending approval';
    case 'restricted':
      return 'Enrollment is restricted for this course';
    case 'not_enrolled':
    default:
      return 'Click to enroll in this course';
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * EnrollButton Component
 *
 * Renders an enrollment button with dynamic states based on the user's
 * enrollment status. Handles enrollment actions through React Query mutations
 * with optimistic updates and comprehensive error handling.
 *
 * @param props - Component props
 * @returns JSX.Element - Rendered enrollment button
 */
function EnrollButton({
  courseId,
  isEnrolled,
  enrollmentStatus,
  onEnrollmentChange,
  size = 'medium',
  fullWidth = false,
  className,
  disabled = false,
  tooltipText,
}: EnrollButtonProps): JSX.Element {
  // ============================================================================
  // Hooks
  // ============================================================================

  /**
   * State for tracking local error messages for tooltip display
   */
  const [localError, setLocalError] = useState<string | undefined>(undefined);

  /**
   * Enrollment mutation hook providing enrollInCourse function and loading state
   * Uses React Query for automatic cache invalidation and optimistic updates
   */
  const { enrollInCourse, isEnrolling } = useEnrollment();

  /**
   * Toast notification hook for success and error feedback
   */
  const { success, error } = useToast();

  // ============================================================================
  // Derived State
  // ============================================================================

  /**
   * Determine effective enrollment status considering props and current state
   * Default to 'not_enrolled' if no status provided and user is not enrolled
   */
  const effectiveStatus: EnrollmentStatus = enrollmentStatus || 
    (isEnrolled ? 'enrolled' : 'not_enrolled');

  /**
   * Determine if the button should be disabled
   * Disabled when: explicitly disabled, already enrolled, pending, restricted, or loading
   */
  const isButtonDisabled: boolean =
    disabled ||
    effectiveStatus === 'enrolled' ||
    effectiveStatus === 'pending' ||
    effectiveStatus === 'restricted' ||
    isEnrolling;

  /**
   * Determine if we're currently loading (enrolling)
   */
  const isLoading: boolean = isEnrolling;

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handles the enrollment action when the button is clicked
   *
   * Triggers the enrollment mutation with success and error callbacks.
   * On success: Shows success toast and calls onEnrollmentChange callback.
   * On error: Shows error toast and sets local error for tooltip display.
   */
  const handleEnroll = (): void => {
    // Clear any previous error
    setLocalError(undefined);

    // Validate courseId before proceeding
    if (!courseId || courseId <= 0) {
      const errorMessage = 'Invalid course ID. Please refresh and try again.';
      setLocalError(errorMessage);
      error(errorMessage);
      return;
    }

    // Only proceed if not already enrolled
    if (effectiveStatus !== 'not_enrolled') {
      return;
    }

    // Call enrollment mutation with callbacks
    enrollInCourse(
      { courseId },
      {
        onSuccess: () => {
          // Clear any error state
          setLocalError(undefined);

          // Show success notification
          success('Successfully enrolled in the course!');

          // Notify parent component of enrollment change
          if (onEnrollmentChange) {
            onEnrollmentChange(true);
          }
        },
        onError: (enrollmentError) => {
          // Extract user-friendly error message
          const errorMessage = enrollmentError.message || 
            'Failed to enroll in the course. Please try again.';

          // Set local error for tooltip display
          setLocalError(errorMessage);

          // Show error notification
          error(errorMessage, { duration: 6000 });
        },
      }
    );
  };

  /**
   * Handles keyboard events for accessibility
   * Allows activation with Enter or Space keys
   *
   * @param event - Keyboard event
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isButtonDisabled) {
        handleEnroll();
      }
    }
  };

  // ============================================================================
  // Computed Values for Rendering
  // ============================================================================

  const buttonIcon = getStatusIcon(effectiveStatus, isLoading);
  const buttonText = getButtonText(effectiveStatus, isLoading);
  const buttonVariant = getButtonVariant(effectiveStatus);
  const buttonColor = getButtonColor(effectiveStatus);
  const finalTooltipText = tooltipText || getDefaultTooltipText(effectiveStatus, localError);
  const ariaLabel = getAriaLabel(effectiveStatus, isLoading);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Tooltip
      title={finalTooltipText}
      arrow
      placement="top"
      enterDelay={300}
      leaveDelay={100}
    >
      {/* Span wrapper needed for Tooltip to work with disabled buttons */}
      <span style={{ display: fullWidth ? 'block' : 'inline-block' }}>
        <Button
          variant={buttonVariant}
          color={buttonColor}
          size={size}
          fullWidth={fullWidth}
          disabled={isButtonDisabled}
          onClick={handleEnroll}
          onKeyDown={handleKeyDown}
          className={className}
          startIcon={buttonIcon}
          aria-label={ariaLabel}
          aria-busy={isLoading}
          aria-disabled={isButtonDisabled}
          role="button"
          data-testid="enroll-button"
          data-enrollment-status={effectiveStatus}
          data-course-id={courseId}
          data-is-loading={isLoading}
          sx={{
            // Ensure button maintains consistent dimensions during loading
            minWidth: size === 'small' ? 100 : size === 'large' ? 140 : 120,
            // Smooth transition for state changes
            transition: 'all 0.2s ease-in-out',
            // Proper cursor for disabled states
            cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
            // Ensure pointer events work even when disabled (for tooltip)
            pointerEvents: isButtonDisabled ? 'auto' : undefined,
            // Opacity adjustment for better disabled state visibility
            opacity: isButtonDisabled && effectiveStatus === 'restricted' ? 0.6 : undefined,
          }}
        >
          {buttonText}
        </Button>
      </span>
    </Tooltip>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default EnrollButton;
export { EnrollButton };
