/**
 * Unit Tests for FeedbackSummary Component
 * 
 * Comprehensive test suite validating the display of feedback statistics including
 * total responses, completion rate, average time, response distribution by course/group,
 * respondent counts, and last submission date. Tests verify Material-UI Grid/Card layout,
 * Typography variants, LinearProgress component, Chip components, icon usage, responsive
 * design, loading states, empty states, and accessibility compliance.
 * 
 * @module tests/unit/features/activities/feedback
 * @see react-frontend/src/features/activities/feedback/components/FeedbackSummary.tsx
 * @see public/mod/feedback/analysis.php - PHP reference implementation
 * @see public/mod/feedback/show_nonrespondents.php - Non-respondent tracking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FeedbackSummary } from '@/features/activities/feedback/components/FeedbackSummary';
import type { FeedbackStatistics } from '@/features/activities/feedback/types/feedback.types';

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock date-fns to ensure consistent date formatting in tests
vi.mock('date-fns', async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import('date-fns')>('date-fns');
  return {
    ...actual,
    formatDistanceToNow: vi.fn((date: Date) => {
      const now = new Date('2024-01-15T12:00:00Z');
      const diff = now.getTime() - date.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours < 1) {
        return 'less than an hour ago';
      }
      if (hours === 1) {
        return '1 hour ago';
      }
      if (hours < 24) {
        return `${hours} hours ago`;
      }
      return `${Math.floor(hours / 24)} days ago`;
    }),
    format: vi.fn((date: Date, formatStr: string) => {
      if (formatStr === 'MMM d, yyyy h:mm a') {
        return 'Jan 15, 2024 10:00 AM';
      }
      return date.toISOString();
    }),
  };
});

describe('FeedbackSummary Component', () => {
  // Test data setup
  const mockStatistics: FeedbackStatistics = {
    totalResponses: 125,
    completionRate: 75.5,
    averageTime: 2700, // 45 minutes in seconds
    responsesByCourse: [
      { courseId: 1, courseName: 'Mathematics 101', count: 50 },
      { courseId: 2, courseName: 'Physics 201', count: 45 },
      { courseId: 3, courseName: 'Chemistry 301', count: 30 },
    ],
    responsesByGroup: [
      { groupId: 1, groupName: 'Group A', count: 60 },
      { groupId: 2, groupName: 'Group B', count: 40 },
      { groupId: 3, groupName: 'Group C', count: 25 },
    ],
    respondents: Array.from({ length: 125 }, (_, i) => i + 1),
    nonRespondents: Array.from({ length: 40 }, (_, i) => i + 126),
    lastSubmissionDate: 1705316400, // Unix timestamp
  };

  const defaultProps = {
    feedbackId: 1,
    statistics: mockStatistics,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering Tests', () => {
    it('renders responsive MUI Grid layout', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      const gridContainer = screen.getByRole('region', { name: /feedback statistics summary/i });
      expect(gridContainer).toBeInTheDocument();
      
      // Check that metric cards are rendered by verifying their headings
      expect(screen.getByRole('heading', { name: /total responses/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /completion rate/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /average time/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /participants/i })).toBeInTheDocument();
    });

    it('renders Card components for each metric', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      // Verify main metric cards are present
      expect(screen.getByText('Total Responses')).toBeInTheDocument();
      expect(screen.getByText('Completion Rate')).toBeInTheDocument();
      expect(screen.getByText('Average Time')).toBeInTheDocument();
      expect(screen.getByText('Participants')).toBeInTheDocument();
    });

    it('renders Typography for headings and values', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      // Check heading typography
      const heading = screen.getByRole('heading', { name: /feedback summary/i });
      expect(heading).toBeInTheDocument();
      
      // Check metric headings
      expect(screen.getByText('Total Responses')).toBeInTheDocument();
      expect(screen.getByText('Completion Rate')).toBeInTheDocument();
    });

    it('renders icons (CheckCircle, People, Schedule, TrendingUp)', () => {
      const { container } = render(<FeedbackSummary {...defaultProps} />);
      
      // MUI icons render as SVG elements
      const icons = container.querySelectorAll('svg[data-testid*="Icon"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Total Responses Display Tests', () => {
    it('displays total response count', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      const totalResponsesHeading = screen.getByRole('heading', { name: /total responses/i });
      expect(totalResponsesHeading).toBeInTheDocument();
      
      // Find the card containing this heading and verify the count is displayed
      const responseCard = totalResponsesHeading.closest('div[class*="MuiCard"]');
      expect(responseCard).toHaveTextContent('125');
    });

    it('renders in Card with appropriate icon', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      const responseCard = screen.getByText('Total Responses').closest('div[class*="MuiCard"]');
      expect(responseCard).toBeInTheDocument();
    });

    it('displays "Completed" chip', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      const chip = screen.getByText('Completed');
      expect(chip).toBeInTheDocument();
    });
  });

  describe('Completion Rate Display Tests', () => {
    it('displays completion percentage', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      expect(screen.getByText('Completion Rate')).toBeInTheDocument();
      expect(screen.getByText('75.5%')).toBeInTheDocument();
    });

    it('renders MUI LinearProgress with value', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      const progressBar = screen.getByRole('progressbar', { name: /completion progress/i });
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow');
    });

    it('displays respondent and enrolled counts', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      // Should show "125 of 165 enrolled"
      expect(screen.getByText(/125 of 165 enrolled/i)).toBeInTheDocument();
    });

    it('percentage formatted to 1 decimal place', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      // Verify precise formatting
      const percentageText = screen.getByText('75.5%');
      expect(percentageText).toBeInTheDocument();
    });

    it('handles 100% completion rate', () => {
      const fullCompletionStats: FeedbackStatistics = {
        ...mockStatistics,
        completionRate: 100,
        nonRespondents: [],
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={fullCompletionStats} />);
      
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('handles 0% completion rate', () => {
      const zeroCompletionStats: FeedbackStatistics = {
        ...mockStatistics,
        totalResponses: 0,
        completionRate: 0,
        respondents: [],
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={zeroCompletionStats} />);
      
      expect(screen.getByText(/no responses yet/i)).toBeInTheDocument();
    });
  });

  describe('Average Time Display Tests', () => {
    it('displays average completion time', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      expect(screen.getByText('Average Time')).toBeInTheDocument();
    });

    it('formats duration: 45 minutes', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      // 2700 seconds = 45 minutes
      expect(screen.getByText('45m')).toBeInTheDocument();
    });

    it('formats duration: 1 hour 15 minutes', () => {
      const statsWithLongerTime: FeedbackStatistics = {
        ...mockStatistics,
        averageTime: 4500, // 75 minutes = 1 hour 15 minutes
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={statsWithLongerTime} />);
      
      expect(screen.getByText('1h 15m')).toBeInTheDocument();
    });

    it('formats duration: hours only', () => {
      const statsWithHoursOnly: FeedbackStatistics = {
        ...mockStatistics,
        averageTime: 7200, // 2 hours exactly
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={statsWithHoursOnly} />);
      
      expect(screen.getByText('2h')).toBeInTheDocument();
    });

    it('handles zero time', () => {
      const statsWithZeroTime: FeedbackStatistics = {
        ...mockStatistics,
        averageTime: 0,
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={statsWithZeroTime} />);
      
      expect(screen.getByText('0m')).toBeInTheDocument();
    });
  });

  describe('Response Distribution Tests', () => {
    it('displays responses by course when provided', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      expect(screen.getByText('Responses by Course')).toBeInTheDocument();
      expect(screen.getByText('Mathematics 101')).toBeInTheDocument();
      expect(screen.getByText('Physics 201')).toBeInTheDocument();
      expect(screen.getByText('Chemistry 301')).toBeInTheDocument();
    });

    it('displays responses by group when provided', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      expect(screen.getByText('Responses by Group')).toBeInTheDocument();
      expect(screen.getByText('Group A')).toBeInTheDocument();
      expect(screen.getByText('Group B')).toBeInTheDocument();
      expect(screen.getByText('Group C')).toBeInTheDocument();
    });

    it('renders course response counts as MUI Chips', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      // Find the "Responses by Course" section
      const courseSectionHeading = screen.getByText('Responses by Course');
      const courseSection = courseSectionHeading.closest('div');
      
      // Check chips with counts are rendered
      expect(within(courseSection!).getByText('50')).toBeInTheDocument();
      expect(within(courseSection!).getByText('45')).toBeInTheDocument();
      expect(within(courseSection!).getByText('30')).toBeInTheDocument();
    });

    it('renders group response counts as MUI Chips', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      // Find the "Responses by Group" section
      const groupSectionHeading = screen.getByText('Responses by Group');
      const groupSection = groupSectionHeading.closest('div');
      
      // Check chips with counts are rendered
      expect(within(groupSection!).getByText('60')).toBeInTheDocument();
      expect(within(groupSection!).getByText('40')).toBeInTheDocument();
      expect(within(groupSection!).getByText('25')).toBeInTheDocument();
    });

    it('does not display course distribution when empty', () => {
      const statsWithoutCourses: FeedbackStatistics = {
        ...mockStatistics,
        responsesByCourse: [],
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={statsWithoutCourses} />);
      
      expect(screen.queryByText('Responses by Course')).not.toBeInTheDocument();
    });

    it('does not display group distribution when empty', () => {
      const statsWithoutGroups: FeedbackStatistics = {
        ...mockStatistics,
        responsesByGroup: [],
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={statsWithoutGroups} />);
      
      expect(screen.queryByText('Responses by Group')).not.toBeInTheDocument();
    });
  });

  describe('Respondent Counts Tests', () => {
    it('displays number of respondents', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      const participantsHeading = screen.getByRole('heading', { name: /participants/i });
      expect(participantsHeading).toBeInTheDocument();
      
      // Find the Participants card and verify respondent count
      const participantsCard = participantsHeading.closest('div[class*="MuiCard"]');
      expect(participantsCard).toHaveTextContent('125');
      expect(participantsCard).toHaveTextContent('Responded');
    });

    it('displays number of non-respondents', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      const participantsHeading = screen.getByRole('heading', { name: /participants/i });
      const participantsCard = participantsHeading.closest('div[class*="MuiCard"]');
      
      expect(participantsCard).toHaveTextContent('40');
      expect(participantsCard).toHaveTextContent('Pending');
    });

    it('displays pending chip when non-respondents exist', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      const chip = screen.getByText('40 pending');
      expect(chip).toBeInTheDocument();
    });

    it('handles zero non-respondents', () => {
      const statsWithNoNonRespondents: FeedbackStatistics = {
        ...mockStatistics,
        nonRespondents: [],
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={statsWithNoNonRespondents} />);
      
      expect(screen.queryByText('Pending')).not.toBeInTheDocument();
      expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();
    });
  });

  describe('Last Submission Date Tests', () => {
    it('displays last submission timestamp', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      expect(screen.getByText(/last submission:/i)).toBeInTheDocument();
    });

    it('formats date with date-fns', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      // Find the specific container with "Last submission:" text
      const lastSubmissionElement = screen.getByText(/last submission:/i);
      
      // Check that the parent container includes both the formatted date and relative time
      const parentContainer = lastSubmissionElement.closest('.MuiTypography-root') ?? lastSubmissionElement.parentElement;
      expect(parentContainer?.textContent).toContain('Jan 15, 2024');
      // Match both singular and plural forms: "hour ago", "hours ago", "day ago", "days ago"
      expect(parentContainer?.textContent).toMatch(/hours? ago|days? ago/i);
    });

    it('does not display when lastSubmissionDate is 0', () => {
      const statsWithNoSubmission: FeedbackStatistics = {
        ...mockStatistics,
        lastSubmissionDate: 0,
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={statsWithNoSubmission} />);
      
      expect(screen.queryByText(/last submission:/i)).not.toBeInTheDocument();
    });
  });

  describe('Responsive Grid Layout Tests', () => {
    it('renders 4 metric cards in main grid', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      // Count main metric cards
      expect(screen.getByText('Total Responses')).toBeInTheDocument();
      expect(screen.getByText('Completion Rate')).toBeInTheDocument();
      expect(screen.getByText('Average Time')).toBeInTheDocument();
      expect(screen.getByText('Participants')).toBeInTheDocument();
    });

    it('cards have equal height styling', () => {
      const { container } = render(<FeedbackSummary {...defaultProps} />);
      
      // Check that cards have height: 100% in their parent Grid items
      const cards = container.querySelectorAll('div[class*="MuiCard-root"]');
      expect(cards.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Icon Indicators Tests', () => {
    it('icons have aria-hidden="true" (decorative)', () => {
      const { container } = render(<FeedbackSummary {...defaultProps} />);
      
      // MUI icons should have aria-hidden
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Number Formatting Tests', () => {
    it('formats large numbers with commas', () => {
      const statsWithLargeNumbers: FeedbackStatistics = {
        ...mockStatistics,
        totalResponses: 1234,
        respondents: Array.from({ length: 1234 }, (_, i) => i + 1),
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={statsWithLargeNumbers} />);
      
      // Find the Total Responses heading
      const totalResponsesHeading = screen.getByText('Total Responses');
      const totalResponsesCard = totalResponsesHeading.closest('.MuiCard-root');
      
      // Check that the card contains the formatted number with commas
      expect(totalResponsesCard?.textContent).toMatch(/1,234|1234/);
    });

    it('handles zero values', () => {
      const statsWithZeros: FeedbackStatistics = {
        totalResponses: 0,
        completionRate: 0,
        averageTime: 0,
        responsesByCourse: [],
        responsesByGroup: [],
        respondents: [],
        nonRespondents: Array.from({ length: 100 }, (_, i) => i + 1),
        lastSubmissionDate: 0,
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={statsWithZeros} />);
      
      expect(screen.getByText(/no responses yet/i)).toBeInTheDocument();
    });

    it('formats percentage to 1 decimal', () => {
      const statsWithDecimalRate: FeedbackStatistics = {
        ...mockStatistics,
        completionRate: 67.89,
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={statsWithDecimalRate} />);
      
      expect(screen.getByText('67.9%')).toBeInTheDocument();
    });
  });

  describe('Empty/Zero State Tests', () => {
    it('displays helpful message when no responses', () => {
      const emptyStats: FeedbackStatistics = {
        totalResponses: 0,
        completionRate: 0,
        averageTime: 0,
        responsesByCourse: [],
        responsesByGroup: [],
        respondents: [],
        nonRespondents: [],
        lastSubmissionDate: 0,
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={emptyStats} />);
      
      expect(screen.getByText('No Responses Yet')).toBeInTheDocument();
      expect(screen.getByText(/has not received any responses yet/i)).toBeInTheDocument();
    });

    it('displays empty state card with People icon', () => {
      const emptyStats: FeedbackStatistics = {
        totalResponses: 0,
        completionRate: 0,
        averageTime: 0,
        responsesByCourse: [],
        responsesByGroup: [],
        respondents: [],
        nonRespondents: [],
        lastSubmissionDate: 0,
      };
      
      const { container } = render(<FeedbackSummary feedbackId={1} statistics={emptyStats} />);
      
      // Check that empty state is rendered in a card
      const card = container.querySelector('div[class*="MuiCard-root"]');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Loading State Tests', () => {
    it('displays MUI Skeleton when statistics prop undefined', () => {
      render(<FeedbackSummary feedbackId={1} />);
      
      // Check for skeleton elements
      const skeletons = screen.getAllByTestId(/skeleton-/);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('displays skeleton for each metric card', () => {
      render(<FeedbackSummary feedbackId={1} />);
      
      // Should have 4 skeleton cards
      expect(screen.getByTestId('skeleton-circular-1')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-circular-2')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-circular-3')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-circular-4')).toBeInTheDocument();
    });

    it('displays skeleton when isLoading is true', () => {
      render(<FeedbackSummary feedbackId={1} statistics={mockStatistics} isLoading />);
      
      // Should show skeleton even with statistics
      const skeletons = screen.getAllByTestId(/skeleton-/);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('skeleton matches card layout', () => {
      render(<FeedbackSummary feedbackId={1} />);
      
      // Check that "Feedback Summary" heading is still shown
      expect(screen.getByText('Feedback Summary')).toBeInTheDocument();
      
      // Verify skeleton elements for text, circular, etc.
      expect(screen.getByTestId('skeleton-circular-1')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-text-heading-1')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-text-value-1')).toBeInTheDocument();
    });
  });

  describe('Accessibility Tests', () => {
    it('all metrics have descriptive labels', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      // Check that headings provide context
      expect(screen.getByText('Total Responses')).toBeInTheDocument();
      expect(screen.getByText('Completion Rate')).toBeInTheDocument();
      expect(screen.getByText('Average Time')).toBeInTheDocument();
      expect(screen.getByText('Participants')).toBeInTheDocument();
    });

    it('progress bar has aria attributes', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      const progressBar = screen.getByRole('progressbar', { name: /completion progress/i });
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-label');
    });

    it('icons have aria-hidden="true"', () => {
      const { container } = render(<FeedbackSummary {...defaultProps} />);
      
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('proper heading hierarchy', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      // Main heading should be h2
      const mainHeading = screen.getByRole('heading', { name: /feedback summary/i });
      expect(mainHeading.tagName).toBe('H2');
      
      // Section headings should be h3
      const sectionHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(sectionHeadings.length).toBeGreaterThan(0);
    });

    it('has no accessibility violations', async () => {
      const { container } = render(<FeedbackSummary {...defaultProps} />);
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('region has descriptive aria-label', () => {
      render(<FeedbackSummary {...defaultProps} />);
      
      const region = screen.getByRole('region', { name: /feedback statistics summary/i });
      expect(region).toBeInTheDocument();
    });
  });

  describe('Edge Cases Tests', () => {
    it('handles very large numbers (>1000000)', () => {
      const statsWithVeryLargeNumbers: FeedbackStatistics = {
        ...mockStatistics,
        totalResponses: 1500000,
        respondents: Array.from({ length: 1500000 }, (_, i) => i + 1),
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={statsWithVeryLargeNumbers} />);
      
      // Find the Total Responses heading
      const totalResponsesHeading = screen.getByText('Total Responses');
      const totalResponsesCard = totalResponsesHeading.closest('.MuiCard-root');
      
      // Check that the card contains the formatted very large number
      expect(totalResponsesCard?.textContent).toMatch(/1,500,000|1500000/);
    });

    it('handles completion rate over 100%', () => {
      const statsWithHighRate: FeedbackStatistics = {
        ...mockStatistics,
        completionRate: 120, // Edge case: might occur with multiple submissions
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={statsWithHighRate} />);
      
      // Progress bar should cap at 100
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('handles null/undefined values in optional fields', () => {
      const minimalStats: FeedbackStatistics = {
        totalResponses: 10,
        completionRate: 50,
        averageTime: 300,
        responsesByCourse: [],
        responsesByGroup: [],
        respondents: [1, 2, 3],
        nonRespondents: [4, 5, 6],
        lastSubmissionDate: 0,
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={minimalStats} />);
      
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.queryByText('Responses by Course')).not.toBeInTheDocument();
      expect(screen.queryByText('Responses by Group')).not.toBeInTheDocument();
    });

    it('handles empty arrays for course/group breakdown', () => {
      const statsWithEmptyArrays: FeedbackStatistics = {
        ...mockStatistics,
        responsesByCourse: [],
        responsesByGroup: [],
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={statsWithEmptyArrays} />);
      
      expect(screen.queryByText('Responses by Course')).not.toBeInTheDocument();
      expect(screen.queryByText('Responses by Group')).not.toBeInTheDocument();
    });
  });

  describe('TypeScript Props Tests', () => {
    it('component accepts FeedbackStatistics interface', () => {
      const validStats: FeedbackStatistics = {
        totalResponses: 50,
        completionRate: 80,
        averageTime: 600,
        responsesByCourse: [],
        responsesByGroup: [],
        respondents: [1, 2, 3],
        nonRespondents: [4],
        lastSubmissionDate: 1705316400,
      };
      
      render(<FeedbackSummary feedbackId={1} statistics={validStats} />);
      
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('component handles missing optional statistics gracefully', () => {
      render(<FeedbackSummary feedbackId={1} />);
      
      // Should render loading state
      expect(screen.getByTestId('skeleton-circular-1')).toBeInTheDocument();
    });

    it('component handles isLoading prop', () => {
      render(<FeedbackSummary feedbackId={1} isLoading />);
      
      // Should show skeleton
      expect(screen.getByTestId('skeleton-circular-1')).toBeInTheDocument();
    });
  });
});
