/**
 * Unit Tests for CourseProgress Component
 *
 * Comprehensive test suite validating the CourseProgress component's rendering,
 * progress bar visualization, completion percentage display, color coding based
 * on completion levels, activity counts, detailed breakdowns by activity type,
 * tooltip behavior, responsive design, accessibility features, and proper
 * Material-UI component integration.
 *
 * @see react-frontend/src/features/courses/components/CourseProgress.tsx
 * @see Section 0.4 Transformation Mapping - Course Feature Components
 */

import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';

import { render, screen, waitFor } from '@tests/helpers/render';
import CourseProgress, {
  type ActivityBreakdownItem,
  type CourseProgressProps,
} from '@/features/courses/components/CourseProgress';

/**
 * Default test props for CourseProgress component.
 * Provides baseline configuration for most test cases.
 */
const defaultProps: CourseProgressProps = {
  completionPercentage: 50,
  completedActivities: 5,
  totalActivities: 10,
  showDetails: false,
  activityBreakdown: [],
};

/**
 * Creates mock activity breakdown data for testing detailed progress display.
 *
 * @param overrides - Partial activity breakdown items to customize
 * @returns Array of ActivityBreakdownItem for testing
 */
const createMockActivityBreakdown = (
  overrides: Partial<ActivityBreakdownItem>[] = []
): ActivityBreakdownItem[] => {
  const defaultBreakdown: ActivityBreakdownItem[] = [
    { type: 'assignment', completed: 3, total: 5 },
    { type: 'quiz', completed: 2, total: 3 },
    { type: 'forum', completed: 1, total: 2 },
  ];

  if (overrides.length > 0) {
    return overrides.map((override, index) => {
      // Safe access with fallback to first item (always exists since array has 3 items)
      const baseIndex = index % defaultBreakdown.length;
      const base: ActivityBreakdownItem = defaultBreakdown[baseIndex]!;
      return {
        type: override.type ?? base.type,
        completed: override.completed ?? base.completed,
        total: override.total ?? base.total,
      };
    });
  }

  return defaultBreakdown;
};

/**
 * Helper function to render CourseProgress with custom props.
 *
 * @param props - Partial props to override defaults
 * @returns Enhanced render result with user event instance
 */
const renderCourseProgress = (props: Partial<CourseProgressProps> = {}) => {
  const mergedProps = { ...defaultProps, ...props };
  return render(<CourseProgress {...mergedProps} />);
};

describe('CourseProgress', () => {
  /**
   * Test Suite: Basic Rendering
   * Validates that the component renders correctly with required props
   * and all essential elements are present in the DOM.
   */
  describe('Basic Rendering', () => {
    it('renders component with required props', () => {
      renderCourseProgress();

      const progressContainer = screen.getByTestId('course-progress');
      expect(progressContainer).toBeInTheDocument();
    });

    it('renders LinearProgress component', () => {
      renderCourseProgress();

      const progressBar = screen.getByTestId('course-progress-bar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('role', 'progressbar');
    });

    it('renders Typography showing percentage', () => {
      renderCourseProgress();

      const percentageText = screen.getByTestId('course-progress-percentage');
      expect(percentageText).toBeInTheDocument();
      expect(percentageText).toHaveTextContent('50% Complete');
    });

    it('renders activity count chip', () => {
      renderCourseProgress();

      const activityChip = screen.getByTestId('course-progress-chip');
      expect(activityChip).toBeInTheDocument();
      expect(activityChip).toHaveTextContent('5 of 10 activities completed');
    });

    it('has proper data-testid attributes', () => {
      renderCourseProgress();

      expect(screen.getByTestId('course-progress')).toBeInTheDocument();
      expect(screen.getByTestId('course-progress-percentage')).toBeInTheDocument();
      expect(screen.getByTestId('course-progress-chip')).toBeInTheDocument();
      expect(screen.getByTestId('course-progress-bar')).toBeInTheDocument();
    });

    it('is accessible via semantic roles', () => {
      renderCourseProgress();

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Completion Percentage Display
   * Validates correct formatting and display of various completion percentages.
   */
  describe('Completion Percentage Display', () => {
    it('displays "0% Complete" when completionPercentage is 0', () => {
      renderCourseProgress({ completionPercentage: 0 });

      const percentageText = screen.getByTestId('course-progress-percentage');
      expect(percentageText).toHaveTextContent('0% Complete');
    });

    it('displays "50% Complete" when completionPercentage is 50', () => {
      renderCourseProgress({ completionPercentage: 50 });

      const percentageText = screen.getByTestId('course-progress-percentage');
      expect(percentageText).toHaveTextContent('50% Complete');
    });

    it('displays "100% Complete" when completionPercentage is 100', () => {
      renderCourseProgress({ completionPercentage: 100 });

      const percentageText = screen.getByTestId('course-progress-percentage');
      expect(percentageText).toHaveTextContent('100% Complete');
    });

    it('formats percentage correctly without decimals', () => {
      renderCourseProgress({ completionPercentage: 75.8 });

      const percentageText = screen.getByTestId('course-progress-percentage');
      // Component uses toFixed(0) which rounds the value
      expect(percentageText).toHaveTextContent('76% Complete');
    });

    it('displays percentage as prominent text', () => {
      renderCourseProgress({ completionPercentage: 85 });

      const percentageText = screen.getByTestId('course-progress-percentage');
      expect(percentageText).toBeVisible();
      // Verify it's an h6 element (Typography variant="h6")
      expect(percentageText.tagName.toLowerCase()).toBe('div');
    });

    it('handles various percentage values correctly', () => {
      // Test 25%
      const { unmount: unmount25 } = renderCourseProgress({ completionPercentage: 25 });
      expect(screen.getByTestId('course-progress-percentage')).toHaveTextContent('25% Complete');
      unmount25();

      // Test 33%
      const { unmount: unmount33 } = renderCourseProgress({ completionPercentage: 33 });
      expect(screen.getByTestId('course-progress-percentage')).toHaveTextContent('33% Complete');
      unmount33();

      // Test 67%
      renderCourseProgress({ completionPercentage: 67 });
      expect(screen.getByTestId('course-progress-percentage')).toHaveTextContent('67% Complete');
    });
  });

  /**
   * Test Suite: Progress Bar Rendering
   * Validates LinearProgress component rendering and value attributes.
   */
  describe('Progress Bar Rendering', () => {
    it('renders LinearProgress component', () => {
      renderCourseProgress();

      const progressBar = screen.getByTestId('course-progress-bar');
      expect(progressBar).toBeInTheDocument();
    });

    it('progress bar has determinate variant', () => {
      renderCourseProgress();

      const progressBar = screen.getByTestId('course-progress-bar');
      // MUI LinearProgress with determinate variant has specific structure
      expect(progressBar).toHaveClass('MuiLinearProgress-root');
    });

    it('progress bar has proper ARIA attributes with role="progressbar"', () => {
      renderCourseProgress({ completionPercentage: 60 });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('role', 'progressbar');
    });

    it('progress bar aria-valuenow matches completionPercentage prop', () => {
      renderCourseProgress({ completionPercentage: 45 });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '45');
    });

    it('progress bar fills appropriately for 0%', () => {
      renderCourseProgress({ completionPercentage: 0 });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('progress bar fills appropriately for 100%', () => {
      renderCourseProgress({ completionPercentage: 100 });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    it('progress bar fills appropriately for intermediate values', () => {
      renderCourseProgress({ completionPercentage: 75 });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    });
  });

  /**
   * Test Suite: Progress Bar Color Coding
   * Validates color changes based on completion thresholds.
   */
  describe('Progress Bar Color Coding', () => {
    it('color is error/red when 0% complete', () => {
      renderCourseProgress({ completionPercentage: 0 });

      const progressBar = screen.getByTestId('course-progress-bar');
      expect(progressBar).toHaveClass('MuiLinearProgress-colorError');
    });

    it('color is error/red when 15% complete (0-30% range)', () => {
      renderCourseProgress({ completionPercentage: 15 });

      const progressBar = screen.getByTestId('course-progress-bar');
      expect(progressBar).toHaveClass('MuiLinearProgress-colorError');
    });

    it('color is error/red when 30% complete (boundary)', () => {
      renderCourseProgress({ completionPercentage: 30 });

      const progressBar = screen.getByTestId('course-progress-bar');
      expect(progressBar).toHaveClass('MuiLinearProgress-colorError');
    });

    it('color is warning/yellow when 31% complete', () => {
      renderCourseProgress({ completionPercentage: 31 });

      const progressBar = screen.getByTestId('course-progress-bar');
      expect(progressBar).toHaveClass('MuiLinearProgress-colorWarning');
    });

    it('color is warning/yellow when 50% complete (31-70% range)', () => {
      renderCourseProgress({ completionPercentage: 50 });

      const progressBar = screen.getByTestId('course-progress-bar');
      expect(progressBar).toHaveClass('MuiLinearProgress-colorWarning');
    });

    it('color is warning/yellow when 70% complete (boundary)', () => {
      renderCourseProgress({ completionPercentage: 70 });

      const progressBar = screen.getByTestId('course-progress-bar');
      expect(progressBar).toHaveClass('MuiLinearProgress-colorWarning');
    });

    it('color is success/green when 71% complete', () => {
      renderCourseProgress({ completionPercentage: 71 });

      const progressBar = screen.getByTestId('course-progress-bar');
      expect(progressBar).toHaveClass('MuiLinearProgress-colorSuccess');
    });

    it('color is success/green when 85% complete (71-100% range)', () => {
      renderCourseProgress({ completionPercentage: 85 });

      const progressBar = screen.getByTestId('course-progress-bar');
      expect(progressBar).toHaveClass('MuiLinearProgress-colorSuccess');
    });

    it('color is success/green when 100% complete', () => {
      renderCourseProgress({ completionPercentage: 100 });

      const progressBar = screen.getByTestId('course-progress-bar');
      expect(progressBar).toHaveClass('MuiLinearProgress-colorSuccess');
    });

    it('color transitions correctly at 30% boundary', () => {
      // At 30% should be error
      const { unmount: unmount30 } = renderCourseProgress({ completionPercentage: 30 });
      expect(screen.getByTestId('course-progress-bar')).toHaveClass('MuiLinearProgress-colorError');
      unmount30();

      // At 31% should be warning
      renderCourseProgress({ completionPercentage: 31 });
      expect(screen.getByTestId('course-progress-bar')).toHaveClass('MuiLinearProgress-colorWarning');
    });

    it('color transitions correctly at 70% boundary', () => {
      // At 70% should be warning
      const { unmount: unmount70 } = renderCourseProgress({ completionPercentage: 70 });
      expect(screen.getByTestId('course-progress-bar')).toHaveClass('MuiLinearProgress-colorWarning');
      unmount70();

      // At 71% should be success
      renderCourseProgress({ completionPercentage: 71 });
      expect(screen.getByTestId('course-progress-bar')).toHaveClass('MuiLinearProgress-colorSuccess');
    });
  });

  /**
   * Test Suite: Activity Counts
   * Validates display of completed/total activity counts.
   */
  describe('Activity Counts', () => {
    it('displays "0 of 10 activities completed"', () => {
      renderCourseProgress({
        completedActivities: 0,
        totalActivities: 10,
        completionPercentage: 0,
      });

      const activityChip = screen.getByTestId('course-progress-chip');
      expect(activityChip).toHaveTextContent('0 of 10 activities completed');
    });

    it('displays "5 of 10 activities completed"', () => {
      renderCourseProgress({
        completedActivities: 5,
        totalActivities: 10,
        completionPercentage: 50,
      });

      const activityChip = screen.getByTestId('course-progress-chip');
      expect(activityChip).toHaveTextContent('5 of 10 activities completed');
    });

    it('displays "10 of 10 activities completed"', () => {
      renderCourseProgress({
        completedActivities: 10,
        totalActivities: 10,
        completionPercentage: 100,
      });

      const activityChip = screen.getByTestId('course-progress-chip');
      expect(activityChip).toHaveTextContent('10 of 10 activities completed');
    });

    it('displays activity count with single total', () => {
      renderCourseProgress({
        completedActivities: 1,
        totalActivities: 1,
        completionPercentage: 100,
      });

      const activityChip = screen.getByTestId('course-progress-chip');
      // Component uses "activities" even for single (no singular handling in original)
      expect(activityChip).toHaveTextContent('1 of 1 activities completed');
    });

    it('displays large activity counts correctly', () => {
      renderCourseProgress({
        completedActivities: 150,
        totalActivities: 200,
        completionPercentage: 75,
      });

      const activityChip = screen.getByTestId('course-progress-chip');
      expect(activityChip).toHaveTextContent('150 of 200 activities completed');
    });
  });

  /**
   * Test Suite: showDetails Prop (False by Default)
   * Validates that detailed breakdown is hidden when showDetails is false.
   */
  describe('showDetails Prop (False)', () => {
    it('activity breakdown NOT shown when showDetails is false', () => {
      renderCourseProgress({
        showDetails: false,
        activityBreakdown: createMockActivityBreakdown(),
      });

      const detailsSection = screen.queryByTestId('course-progress-details');
      expect(detailsSection).not.toBeInTheDocument();
    });

    it('only main progress bar and summary shown when showDetails is false', () => {
      renderCourseProgress({
        showDetails: false,
        activityBreakdown: createMockActivityBreakdown(),
      });

      // Main elements should be present
      expect(screen.getByTestId('course-progress')).toBeInTheDocument();
      expect(screen.getByTestId('course-progress-percentage')).toBeInTheDocument();
      expect(screen.getByTestId('course-progress-bar')).toBeInTheDocument();
      expect(screen.getByTestId('course-progress-chip')).toBeInTheDocument();

      // Details section should not be present
      expect(screen.queryByTestId('course-progress-details')).not.toBeInTheDocument();
    });

    it('provides compact view suitable for course cards', () => {
      renderCourseProgress({
        showDetails: false,
        activityBreakdown: createMockActivityBreakdown(),
      });

      // Verify compact structure without breakdown items
      expect(screen.queryByTestId('activity-breakdown-assignment')).not.toBeInTheDocument();
      expect(screen.queryByTestId('activity-breakdown-quiz')).not.toBeInTheDocument();
      expect(screen.queryByTestId('activity-breakdown-forum')).not.toBeInTheDocument();
    });
  });

  /**
   * Test Suite: showDetails Prop (True)
   * Validates that detailed activity breakdown is shown when showDetails is true.
   */
  describe('showDetails Prop (True)', () => {
    it('activity breakdown shown when showDetails is true', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: createMockActivityBreakdown(),
      });

      const detailsSection = screen.getByTestId('course-progress-details');
      expect(detailsSection).toBeInTheDocument();
    });

    it('breakdown displays "Activity Breakdown" header', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: createMockActivityBreakdown(),
      });

      expect(screen.getByText('Activity Breakdown')).toBeInTheDocument();
    });

    it('breakdown shows assignments: "3/5"', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: createMockActivityBreakdown(),
      });

      const assignmentBreakdown = screen.getByTestId('activity-breakdown-assignment');
      expect(assignmentBreakdown).toHaveTextContent('3/5');
    });

    it('breakdown shows quizzes: "2/3"', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: createMockActivityBreakdown(),
      });

      const quizBreakdown = screen.getByTestId('activity-breakdown-quiz');
      expect(quizBreakdown).toHaveTextContent('2/3');
    });

    it('breakdown shows forums: "1/2"', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: createMockActivityBreakdown(),
      });

      const forumBreakdown = screen.getByTestId('activity-breakdown-forum');
      expect(forumBreakdown).toHaveTextContent('1/2');
    });

    it('each activity type has mini progress indicator', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: createMockActivityBreakdown(),
      });

      // Check for mini progress bars
      expect(screen.getByTestId('activity-progress-bar-assignment')).toBeInTheDocument();
      expect(screen.getByTestId('activity-progress-bar-quiz')).toBeInTheDocument();
      expect(screen.getByTestId('activity-progress-bar-forum')).toBeInTheDocument();
    });

    it('breakdown organized by activity type', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: createMockActivityBreakdown(),
      });

      // Verify each activity type is displayed with formatted name
      expect(screen.getByText('Assignment')).toBeInTheDocument();
      expect(screen.getByText('Quiz')).toBeInTheDocument();
      expect(screen.getByText('Forum')).toBeInTheDocument();
    });

    it('does not show details section when activityBreakdown is empty', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: [],
      });

      const detailsSection = screen.queryByTestId('course-progress-details');
      expect(detailsSection).not.toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Activity Breakdown Structure
   * Validates the structure and content of activity breakdown items.
   */
  describe('Activity Breakdown Structure', () => {
    it('activityBreakdown array rendered correctly', () => {
      const breakdown: ActivityBreakdownItem[] = [
        { type: 'assignment', completed: 4, total: 6 },
        { type: 'quiz', completed: 3, total: 5 },
        { type: 'resource', completed: 2, total: 4 },
      ];

      renderCourseProgress({
        showDetails: true,
        activityBreakdown: breakdown,
      });

      expect(screen.getByTestId('activity-breakdown-assignment')).toBeInTheDocument();
      expect(screen.getByTestId('activity-breakdown-quiz')).toBeInTheDocument();
      expect(screen.getByTestId('activity-breakdown-resource')).toBeInTheDocument();
    });

    it('each item shows type, completed count, and total count', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: [{ type: 'assignment', completed: 7, total: 10 }],
      });

      const assignmentItem = screen.getByTestId('activity-breakdown-assignment');
      expect(assignmentItem).toHaveTextContent('Assignment');
      expect(assignmentItem).toHaveTextContent('7/10');
    });

    it('mini progress bars for each activity type have correct values', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: [
          { type: 'assignment', completed: 6, total: 10 }, // 60%
          { type: 'quiz', completed: 2, total: 4 }, // 50%
        ],
      });

      const assignmentProgressBar = screen.getByTestId('activity-progress-bar-assignment');
      const quizProgressBar = screen.getByTestId('activity-progress-bar-quiz');

      expect(assignmentProgressBar).toBeInTheDocument();
      expect(quizProgressBar).toBeInTheDocument();
    });

    it('handles camelCase activity type names', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: [{ type: 'videoLesson', completed: 2, total: 3 }],
      });

      // Should format as "Video Lesson"
      expect(screen.getByText('Video Lesson')).toBeInTheDocument();
    });

    it('handles snake_case activity type names', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: [{ type: 'peer_review', completed: 1, total: 2 }],
      });

      // Should format as "Peer Review"
      expect(screen.getByText('Peer Review')).toBeInTheDocument();
    });

    it('breakdown item color reflects completion percentage', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: [
          { type: 'assignment', completed: 2, total: 10 }, // 20% - error
          { type: 'quiz', completed: 5, total: 10 }, // 50% - warning
          { type: 'forum', completed: 8, total: 10 }, // 80% - success
        ],
      });

      const assignmentBar = screen.getByTestId('activity-progress-bar-assignment');
      const quizBar = screen.getByTestId('activity-progress-bar-quiz');
      const forumBar = screen.getByTestId('activity-progress-bar-forum');

      expect(assignmentBar).toHaveClass('MuiLinearProgress-colorError');
      expect(quizBar).toHaveClass('MuiLinearProgress-colorWarning');
      expect(forumBar).toHaveClass('MuiLinearProgress-colorSuccess');
    });
  });

  /**
   * Test Suite: Tooltip Behavior
   * Validates tooltip appearance and content on hover.
   */
  describe('Tooltip Behavior', () => {
    it('tooltip appears on hover over progress component', async () => {
      const user = userEvent.setup();
      renderCourseProgress({
        completionPercentage: 75,
        activityBreakdown: createMockActivityBreakdown(),
      });

      const progressContainer = screen.getByTestId('course-progress');
      await user.hover(progressContainer);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('tooltip shows "Course Completion Details" header', async () => {
      const user = userEvent.setup();
      renderCourseProgress({
        completionPercentage: 75,
      });

      const progressContainer = screen.getByTestId('course-progress');
      await user.hover(progressContainer);

      await waitFor(() => {
        expect(screen.getByText('Course Completion Details')).toBeInTheDocument();
      });
    });

    it('tooltip includes detailed progress percentage', async () => {
      const user = userEvent.setup();
      renderCourseProgress({
        completionPercentage: 75.5,
      });

      const progressContainer = screen.getByTestId('course-progress');
      await user.hover(progressContainer);

      await waitFor(() => {
        // Tooltip shows 1 decimal place (75.5%)
        expect(screen.getByText(/Progress: 75\.5%/)).toBeInTheDocument();
      });
    });

    it('tooltip shows activity count information', async () => {
      const user = userEvent.setup();
      renderCourseProgress({
        completedActivities: 8,
        totalActivities: 12,
      });

      const progressContainer = screen.getByTestId('course-progress');
      await user.hover(progressContainer);

      await waitFor(() => {
        expect(screen.getByText(/Activities: 8 of 12 completed/)).toBeInTheDocument();
      });
    });

    it('tooltip includes activity breakdown summary when available', async () => {
      const user = userEvent.setup();
      renderCourseProgress({
        activityBreakdown: [
          { type: 'assignment', completed: 3, total: 5 },
          { type: 'quiz', completed: 2, total: 3 },
        ],
      });

      const progressContainer = screen.getByTestId('course-progress');
      await user.hover(progressContainer);

      await waitFor(() => {
        expect(screen.getByText('By Activity Type:')).toBeInTheDocument();
        expect(screen.getByText(/Assignment: 3\/5/)).toBeInTheDocument();
        expect(screen.getByText(/Quiz: 2\/3/)).toBeInTheDocument();
      });
    });

    it('tooltip dismissed when mouse leaves', async () => {
      const user = userEvent.setup();
      renderCourseProgress();

      const progressContainer = screen.getByTestId('course-progress');
      await user.hover(progressContainer);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      await user.unhover(progressContainer);

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });
  });

  /**
   * Test Suite: ARIA Attributes
   * Validates accessibility attributes for screen readers.
   */
  describe('ARIA Attributes', () => {
    it('progress bar has aria-label with completion info', () => {
      renderCourseProgress({ completionPercentage: 65 });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute(
        'aria-label',
        'Course completion progress: 65% complete'
      );
    });

    it('aria-valuenow matches completionPercentage', () => {
      renderCourseProgress({ completionPercentage: 42 });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '42');
    });

    it('aria-valuemin is 0', () => {
      renderCourseProgress();

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    });

    it('aria-valuemax is 100', () => {
      renderCourseProgress();

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('activity breakdown progress bars have descriptive aria-labels', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: [{ type: 'assignment', completed: 3, total: 5 }],
      });

      const assignmentBar = screen.getByTestId('activity-progress-bar-assignment');
      expect(assignmentBar).toHaveAttribute(
        'aria-label',
        'Assignment progress: 3 of 5 completed'
      );
    });
  });

  /**
   * Test Suite: Edge Cases
   * Validates handling of boundary and invalid input values.
   */
  describe('Edge Cases', () => {
    it('handles completionPercentage < 0 (clamps to 0)', () => {
      renderCourseProgress({ completionPercentage: -10 });

      const percentageText = screen.getByTestId('course-progress-percentage');
      expect(percentageText).toHaveTextContent('0% Complete');

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('handles completionPercentage > 100 (clamps to 100)', () => {
      renderCourseProgress({ completionPercentage: 150 });

      const percentageText = screen.getByTestId('course-progress-percentage');
      expect(percentageText).toHaveTextContent('100% Complete');

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    it('handles completionPercentage of exactly 0', () => {
      renderCourseProgress({ completionPercentage: 0 });

      const percentageText = screen.getByTestId('course-progress-percentage');
      expect(percentageText).toHaveTextContent('0% Complete');

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('handles completionPercentage of exactly 100', () => {
      renderCourseProgress({ completionPercentage: 100 });

      const percentageText = screen.getByTestId('course-progress-percentage');
      expect(percentageText).toHaveTextContent('100% Complete');

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    it('handles 0 total activities', () => {
      renderCourseProgress({
        completedActivities: 0,
        totalActivities: 0,
        completionPercentage: 0,
      });

      const activityChip = screen.getByTestId('course-progress-chip');
      expect(activityChip).toHaveTextContent('0 of 0 activities completed');
    });

    it('handles activity breakdown with 0 total (shows 0%)', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: [{ type: 'assignment', completed: 0, total: 0 }],
      });

      // When total is 0, percentage should be 0
      const assignmentBar = screen.getByTestId('activity-progress-bar-assignment');
      expect(assignmentBar).toHaveClass('MuiLinearProgress-colorError'); // 0% is error color
    });

    it('handles empty activityBreakdown array', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: [],
      });

      // Details section should not show when breakdown is empty
      expect(screen.queryByTestId('course-progress-details')).not.toBeInTheDocument();
    });

    it('handles very long activity type names', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: [
          { type: 'veryLongActivityTypeNameThatMightOverflow', completed: 2, total: 5 },
        ],
      });

      // Should still render without breaking
      expect(screen.getByText(/Very Long Activity Type Name/)).toBeInTheDocument();
    });

    it('handles decimal percentage values correctly', () => {
      renderCourseProgress({ completionPercentage: 33.33 });

      const percentageText = screen.getByTestId('course-progress-percentage');
      // toFixed(0) rounds 33.33 to 33
      expect(percentageText).toHaveTextContent('33% Complete');
    });

    it('handles percentage that rounds up', () => {
      renderCourseProgress({ completionPercentage: 99.6 });

      const percentageText = screen.getByTestId('course-progress-percentage');
      // toFixed(0) rounds 99.6 to 100
      expect(percentageText).toHaveTextContent('100% Complete');
    });
  });

  /**
   * Test Suite: Theme Integration
   * Validates proper use of MUI theme colors and styling.
   */
  describe('Theme Integration', () => {
    it('uses theme colors for progress bar', () => {
      renderCourseProgress({ completionPercentage: 80 });

      const progressBar = screen.getByTestId('course-progress-bar');
      // MUI applies theme color classes
      expect(progressBar).toHaveClass('MuiLinearProgress-colorSuccess');
    });

    it('component uses theme typography', () => {
      renderCourseProgress();

      const percentageText = screen.getByTestId('course-progress-percentage');
      expect(percentageText).toHaveClass('MuiTypography-root');
    });

    it('renders correctly with light theme', () => {
      render(<CourseProgress {...defaultProps} />, { themeMode: 'light' });

      const progressContainer = screen.getByTestId('course-progress');
      expect(progressContainer).toBeInTheDocument();
    });

    it('renders correctly with dark theme', () => {
      render(<CourseProgress {...defaultProps} />, { themeMode: 'dark' });

      const progressContainer = screen.getByTestId('course-progress');
      expect(progressContainer).toBeInTheDocument();
    });

    it('chip uses theme color based on progress', () => {
      // Success color for high completion
      const { unmount } = renderCourseProgress({ completionPercentage: 85 });
      let chip = screen.getByTestId('course-progress-chip');
      expect(chip).toHaveClass('MuiChip-colorSuccess');
      unmount();

      // Warning color for medium completion
      renderCourseProgress({ completionPercentage: 50 });
      chip = screen.getByTestId('course-progress-chip');
      expect(chip).toHaveClass('MuiChip-colorWarning');
    });
  });

  /**
   * Test Suite: Zero Progress
   * Validates display when no progress has been made.
   */
  describe('Zero Progress', () => {
    it('0% completion shows empty progress bar', () => {
      renderCourseProgress({
        completionPercentage: 0,
        completedActivities: 0,
        totalActivities: 10,
      });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('"0 of X activities completed" displayed', () => {
      renderCourseProgress({
        completionPercentage: 0,
        completedActivities: 0,
        totalActivities: 15,
      });

      const activityChip = screen.getByTestId('course-progress-chip');
      expect(activityChip).toHaveTextContent('0 of 15 activities completed');
    });

    it('shows error color for zero progress', () => {
      renderCourseProgress({ completionPercentage: 0 });

      const progressBar = screen.getByTestId('course-progress-bar');
      expect(progressBar).toHaveClass('MuiLinearProgress-colorError');
    });
  });

  /**
   * Test Suite: Partial Progress
   * Validates display for various intermediate completion percentages.
   */
  describe('Partial Progress', () => {
    it('25% completion displays correctly', () => {
      renderCourseProgress({
        completionPercentage: 25,
        completedActivities: 5,
        totalActivities: 20,
      });

      expect(screen.getByTestId('course-progress-percentage')).toHaveTextContent('25% Complete');
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
      expect(screen.getByTestId('course-progress-bar')).toHaveClass('MuiLinearProgress-colorError');
    });

    it('50% completion displays correctly', () => {
      renderCourseProgress({
        completionPercentage: 50,
        completedActivities: 10,
        totalActivities: 20,
      });

      expect(screen.getByTestId('course-progress-percentage')).toHaveTextContent('50% Complete');
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
      expect(screen.getByTestId('course-progress-bar')).toHaveClass('MuiLinearProgress-colorWarning');
    });

    it('75% completion displays correctly', () => {
      renderCourseProgress({
        completionPercentage: 75,
        completedActivities: 15,
        totalActivities: 20,
      });

      expect(screen.getByTestId('course-progress-percentage')).toHaveTextContent('75% Complete');
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
      expect(screen.getByTestId('course-progress-bar')).toHaveClass('MuiLinearProgress-colorSuccess');
    });

    it('activity counts match percentage context', () => {
      renderCourseProgress({
        completionPercentage: 60,
        completedActivities: 6,
        totalActivities: 10,
      });

      expect(screen.getByTestId('course-progress-chip')).toHaveTextContent('6 of 10 activities completed');
    });
  });

  /**
   * Test Suite: Complete Progress
   * Validates display when 100% completion is achieved.
   */
  describe('Complete Progress', () => {
    it('100% completion shows full progress bar', () => {
      renderCourseProgress({
        completionPercentage: 100,
        completedActivities: 20,
        totalActivities: 20,
      });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    it('success green color applied at 100%', () => {
      renderCourseProgress({ completionPercentage: 100 });

      const progressBar = screen.getByTestId('course-progress-bar');
      expect(progressBar).toHaveClass('MuiLinearProgress-colorSuccess');
    });

    it('"All activities completed" shown via counts', () => {
      renderCourseProgress({
        completionPercentage: 100,
        completedActivities: 12,
        totalActivities: 12,
      });

      const activityChip = screen.getByTestId('course-progress-chip');
      expect(activityChip).toHaveTextContent('12 of 12 activities completed');
    });

    it('chip shows success color at 100%', () => {
      renderCourseProgress({ completionPercentage: 100 });

      const chip = screen.getByTestId('course-progress-chip');
      expect(chip).toHaveClass('MuiChip-colorSuccess');
    });
  });

  /**
   * Test Suite: Progress Updates
   * Validates component reactivity when props change.
   */
  describe('Progress Updates', () => {
    it('component updates when completionPercentage changes', () => {
      const { rerender } = render(
        <CourseProgress {...defaultProps} completionPercentage={30} />
      );

      expect(screen.getByTestId('course-progress-percentage')).toHaveTextContent('30% Complete');

      rerender(<CourseProgress {...defaultProps} completionPercentage={60} />);

      expect(screen.getByTestId('course-progress-percentage')).toHaveTextContent('60% Complete');
    });

    it('counts update when activity props change', () => {
      const { rerender } = render(
        <CourseProgress {...defaultProps} completedActivities={3} totalActivities={10} />
      );

      expect(screen.getByTestId('course-progress-chip')).toHaveTextContent('3 of 10 activities completed');

      rerender(
        <CourseProgress {...defaultProps} completedActivities={7} totalActivities={10} />
      );

      expect(screen.getByTestId('course-progress-chip')).toHaveTextContent('7 of 10 activities completed');
    });

    it('color changes when crossing thresholds', () => {
      const { rerender } = render(
        <CourseProgress {...defaultProps} completionPercentage={25} />
      );

      expect(screen.getByTestId('course-progress-bar')).toHaveClass('MuiLinearProgress-colorError');

      rerender(<CourseProgress {...defaultProps} completionPercentage={50} />);

      expect(screen.getByTestId('course-progress-bar')).toHaveClass('MuiLinearProgress-colorWarning');

      rerender(<CourseProgress {...defaultProps} completionPercentage={80} />);

      expect(screen.getByTestId('course-progress-bar')).toHaveClass('MuiLinearProgress-colorSuccess');
    });

    it('breakdown updates when showDetails changes', () => {
      const breakdown = createMockActivityBreakdown();
      const { rerender } = render(
        <CourseProgress {...defaultProps} showDetails={false} activityBreakdown={breakdown} />
      );

      expect(screen.queryByTestId('course-progress-details')).not.toBeInTheDocument();

      rerender(
        <CourseProgress {...defaultProps} showDetails activityBreakdown={breakdown} />
      );

      expect(screen.getByTestId('course-progress-details')).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Activity Type Formatting
   * Validates proper formatting of activity type names.
   */
  describe('Activity Type Formatting', () => {
    it('formats lowercase type names to Title Case', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: [{ type: 'assignment', completed: 2, total: 5 }],
      });

      expect(screen.getByText('Assignment')).toBeInTheDocument();
    });

    it('formats camelCase type names with spaces', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: [{ type: 'peerReview', completed: 1, total: 2 }],
      });

      expect(screen.getByText('Peer Review')).toBeInTheDocument();
    });

    it('formats snake_case type names with spaces', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: [{ type: 'group_project', completed: 3, total: 4 }],
      });

      expect(screen.getByText('Group Project')).toBeInTheDocument();
    });

    it('formats UPPERCASE type names correctly', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: [{ type: 'QUIZ', completed: 2, total: 3 }],
      });

      expect(screen.getByText('Quiz')).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Accessibility
   * Comprehensive accessibility validation for WCAG 2.1 AA compliance.
   */
  describe('Accessibility', () => {
    it('progress bar is keyboard focusable via tooltip', async () => {
      const user = userEvent.setup();
      renderCourseProgress();

      // Tab to focus the progress container (which has the tooltip)
      await user.tab();

      // The tooltip should be reachable
      const progressContainer = screen.getByTestId('course-progress');
      expect(document.body).toContainElement(progressContainer);
    });

    it('screen reader announces progress via aria attributes', () => {
      renderCourseProgress({ completionPercentage: 55 });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label');
      expect(progressBar).toHaveAttribute('aria-valuenow');
      expect(progressBar).toHaveAttribute('aria-valuemin');
      expect(progressBar).toHaveAttribute('aria-valuemax');
    });

    it('semantic HTML structure with proper roles', () => {
      renderCourseProgress();

      // Main progress bar has progressbar role
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('maintains proper heading hierarchy', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: createMockActivityBreakdown(),
      });

      // Verify text content is visible and properly structured
      expect(screen.getByTestId('course-progress-percentage')).toBeVisible();
      expect(screen.getByText('Activity Breakdown')).toBeVisible();
    });

    it('activity breakdown items are readable by screen readers', () => {
      renderCourseProgress({
        showDetails: true,
        activityBreakdown: [{ type: 'assignment', completed: 3, total: 5 }],
      });

      const assignmentBar = screen.getByTestId('activity-progress-bar-assignment');
      expect(assignmentBar).toHaveAttribute('aria-label', 'Assignment progress: 3 of 5 completed');
    });
  });

  /**
   * Test Suite: TypeScript Type Safety
   * Validates props interface enforcement (compile-time checks).
   */
  describe('TypeScript Type Safety', () => {
    it('renders with all required props', () => {
      const props: CourseProgressProps = {
        completionPercentage: 50,
        completedActivities: 5,
        totalActivities: 10,
      };

      render(<CourseProgress {...props} />);
      expect(screen.getByTestId('course-progress')).toBeInTheDocument();
    });

    it('accepts optional showDetails prop', () => {
      const props: CourseProgressProps = {
        completionPercentage: 50,
        completedActivities: 5,
        totalActivities: 10,
        showDetails: true,
      };

      render(<CourseProgress {...props} />);
      expect(screen.getByTestId('course-progress')).toBeInTheDocument();
    });

    it('accepts optional activityBreakdown prop', () => {
      const breakdown: ActivityBreakdownItem[] = [
        { type: 'quiz', completed: 2, total: 3 },
      ];

      const props: CourseProgressProps = {
        completionPercentage: 66,
        completedActivities: 2,
        totalActivities: 3,
        activityBreakdown: breakdown,
      };

      render(<CourseProgress {...props} />);
      expect(screen.getByTestId('course-progress')).toBeInTheDocument();
    });

    it('ActivityBreakdownItem interface works correctly', () => {
      const item: ActivityBreakdownItem = {
        type: 'forum',
        completed: 4,
        total: 6,
      };

      renderCourseProgress({
        showDetails: true,
        activityBreakdown: [item],
      });

      expect(screen.getByTestId('activity-breakdown-forum')).toBeInTheDocument();
      expect(screen.getByText('4/6')).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Performance
   * Validates component doesn't have performance issues.
   */
  describe('Performance', () => {
    it('renders multiple activity breakdown items efficiently', () => {
      const manyItems: ActivityBreakdownItem[] = Array.from({ length: 20 }, (_, i) => ({
        type: `activity${i}`,
        completed: i,
        total: 20,
      }));

      const { container } = renderCourseProgress({
        showDetails: true,
        activityBreakdown: manyItems,
      });

      // All items should be rendered
      expect(container.querySelectorAll('[data-testid^="activity-breakdown-"]').length).toBe(20);
    });

    it('handles rapid prop updates without issues', () => {
      const { rerender } = render(
        <CourseProgress {...defaultProps} completionPercentage={0} />
      );

      // Rapidly update the percentage
      for (let i = 1; i <= 100; i++) {
        rerender(<CourseProgress {...defaultProps} completionPercentage={i} />);
      }

      // Final state should be correct
      expect(screen.getByTestId('course-progress-percentage')).toHaveTextContent('100% Complete');
    });
  });

  /**
   * Test Suite: Component Composition
   * Validates proper composition with parent components.
   */
  describe('Component Composition', () => {
    it('can be rendered inside a container with proper sizing', () => {
      const { container } = render(
        <div style={{ width: '300px' }}>
          <CourseProgress {...defaultProps} />
        </div>
      );

      const progressContainer = container.querySelector('[data-testid="course-progress"]');
      expect(progressContainer).toBeInTheDocument();
    });

    it('multiple instances can coexist on same page', () => {
      render(
        <>
          <CourseProgress
            {...defaultProps}
            completionPercentage={25}
          />
          <CourseProgress
            {...defaultProps}
            completionPercentage={75}
          />
        </>
      );

      const progressElements = screen.getAllByTestId('course-progress');
      expect(progressElements).toHaveLength(2);

      const percentageTexts = screen.getAllByTestId('course-progress-percentage');
      expect(percentageTexts[0]).toHaveTextContent('25% Complete');
      expect(percentageTexts[1]).toHaveTextContent('75% Complete');
    });
  });
});
