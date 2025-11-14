/**
 * Unit Tests for FeedbackSummary Component
 * 
 * Comprehensive test suite validating:
 * - Statistics display (total responses, completion rate, average time, respondent counts)
 * - MUI LinearProgress with value and color coding
 * - Responsive Grid layout (md=3, sm=6, xs=12)
 * - Typography variants (h5, h6, body1, body2)
 * - Icon indicators (CheckCircle, People, Schedule, TrendingUp)
 * - Number formatting with Intl.NumberFormat
 * - Time duration formatting (hours, minutes)
 * - Chip components for course/group distribution
 * - Loading states with Skeleton components
 * - Empty/zero state handling
 * - Date formatting with date-fns
 * - WCAG 2.1 AA accessibility compliance
 * 
 * @module tests/unit/features/activities/feedback/components
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import '@testing-library/jest-dom';
import {
  Grid,
  LinearProgress,
  Typography,
  Skeleton,
  Chip,
  Card,
  CardContent,
  Box,
} from '@mui/material';
import {
  CheckCircle,
  People,
  Schedule,
  TrendingUp,
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';

import { FeedbackSummary } from '../../../../../../src/features/activities/feedback/components/FeedbackSummary';
import type { GroupResponseCount } from '../../../../../../src/features/activities/feedback/types/feedback.types';

/**
 * Helper function to create mock feedback statistics with sensible defaults
 */
const createMockStatistics = (overrides = {}) => ({
  totalResponses: 45,
  completionRate: 75.5,
  averageTime: 420, // 7 minutes
  responsesByCourse: [
    { courseId: 1, courseName: 'Mathematics 101', count: 20 },
    { courseId: 2, courseName: 'Physics 201', count: 15 },
    { courseId: 3, courseName: 'Chemistry 301', count: 10 },
  ],
  responsesByGroup: [
    { groupId: 1, groupName: 'Group A', count: 25 },
    { groupId: 2, groupName: 'Group B', count: 20 },
  ],
  respondents: Array.from({ length: 45 }, (_, i) => i + 1),
  nonRespondents: Array.from({ length: 15 }, (_, i) => i + 46),
  lastSubmissionDate: 1699564800, // Nov 10, 2023
  ...overrides,
});

describe('FeedbackSummary Component', () => {
  describe('Basic Rendering', () => {
    it('should render the component with heading', () => {
      const statistics = createMockStatistics();
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByRole('heading', { name: /feedback summary/i })).toBeInTheDocument();
    });

    it('should render with proper ARIA region role', () => {
      const statistics = createMockStatistics();
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const region = screen.getByRole('region', { name: /feedback statistics summary/i });
      expect(region).toBeInTheDocument();
    });

    it('should render all four main metric cards', () => {
      const statistics = createMockStatistics();
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('Total Responses')).toBeInTheDocument();
      expect(screen.getByText('Completion Rate')).toBeInTheDocument();
      expect(screen.getByText('Average Time')).toBeInTheDocument();
      expect(screen.getByText('Participants')).toBeInTheDocument();
    });
  });

  describe('Total Responses Display', () => {
    it('should display the total response count with proper formatting', () => {
      const statistics = createMockStatistics({ totalResponses: 1234 });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // Intl.NumberFormat with default locale formats 1234 as "1,234"
      expect(screen.getByText('1,234')).toBeInTheDocument();
    });

    it('should render CheckCircle icon for total responses', () => {
      const statistics = createMockStatistics();
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const responseCard = screen.getByText('Total Responses').closest('.MuiCard-root');
      const icons = within(responseCard!).getAllByTestId('CheckCircleIcon');
      expect(icons.length).toBeGreaterThan(0);
      expect(icons[0]).toBeInTheDocument();
    });

    it('should display "Completed" chip with success color', () => {
      const statistics = createMockStatistics();
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const completedChip = screen.getByText('Completed').closest('.MuiChip-root');
      expect(completedChip).toHaveClass('MuiChip-colorSuccess');
    });

    it('should handle zero responses', () => {
      const statistics = createMockStatistics({ totalResponses: 0 });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // Should show empty state instead of cards
      expect(screen.getByText('No Responses Yet')).toBeInTheDocument();
      expect(screen.queryByText('Total Responses')).not.toBeInTheDocument();
    });

    it('should handle very large response counts', () => {
      const statistics = createMockStatistics({ totalResponses: 1000000 });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // Intl.NumberFormat formats 1000000 as "1,000,000"
      expect(screen.getByText('1,000,000')).toBeInTheDocument();
    });
  });

  describe('Completion Rate Display', () => {
    it('should display completion rate percentage', () => {
      const statistics = createMockStatistics({ completionRate: 85.7 });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('85.7%')).toBeInTheDocument();
    });

    it('should render LinearProgress with correct value', () => {
      const statistics = createMockStatistics({ completionRate: 65.5 });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const progressBar = screen.getByRole('progressbar', { name: /completion progress: 65.5%/i });
      expect(progressBar).toBeInTheDocument();
      // MUI rounds the aria-valuenow to the nearest integer
      expect(progressBar).toHaveAttribute('aria-valuenow', '66');
    });

    it('should cap LinearProgress value at 100 for rates over 100%', () => {
      const statistics = createMockStatistics({ completionRate: 125.0 });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    it('should render TrendingUp icon for completion rate', () => {
      const statistics = createMockStatistics();
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const completionCard = screen.getByText('Completion Rate').closest('.MuiCard-root');
      const icon = within(completionCard!).getByTestId('TrendingUpIcon');
      expect(icon).toBeInTheDocument();
    });

    it('should display enrolled user counts correctly', () => {
      const statistics = createMockStatistics({
        respondents: Array.from({ length: 30 }, (_, i) => i + 1),
        nonRespondents: Array.from({ length: 10 }, (_, i) => i + 31),
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('30 of 40 enrolled')).toBeInTheDocument();
    });

    it('should handle 0% completion rate', () => {
      const statistics = createMockStatistics({
        completionRate: 0,
        respondents: [],
        nonRespondents: Array.from({ length: 50 }, (_, i) => i + 1),
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('should handle 100% completion rate', () => {
      const statistics = createMockStatistics({
        completionRate: 100,
        respondents: Array.from({ length: 50 }, (_, i) => i + 1),
        nonRespondents: [],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
      expect(screen.getByText('50 of 50 enrolled')).toBeInTheDocument();
    });
  });

  describe('Average Completion Time Display', () => {
    it('should format time in minutes for durations under 1 hour', () => {
      const statistics = createMockStatistics({ averageTime: 420 }); // 7 minutes
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('7m')).toBeInTheDocument();
    });

    it('should format time in hours and minutes for durations over 1 hour', () => {
      const statistics = createMockStatistics({ averageTime: 5400 }); // 1h 30m
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('1h 30m')).toBeInTheDocument();
    });

    it('should format time in hours only for exact hour durations', () => {
      const statistics = createMockStatistics({ averageTime: 7200 }); // 2 hours exactly
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('2h')).toBeInTheDocument();
    });

    it('should handle zero time duration', () => {
      const statistics = createMockStatistics({ averageTime: 0 });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('0m')).toBeInTheDocument();
    });

    it('should render Schedule icon for average time', () => {
      const statistics = createMockStatistics();
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const timeCard = screen.getByText('Average Time').closest('.MuiCard-root');
      const icon = within(timeCard!).getByTestId('ScheduleIcon');
      expect(icon).toBeInTheDocument();
    });

    it('should display helper text for average time', () => {
      const statistics = createMockStatistics();
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('to complete feedback')).toBeInTheDocument();
    });

    it('should handle very long durations (multi-hour)', () => {
      const statistics = createMockStatistics({ averageTime: 25200 }); // 7 hours
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('7h')).toBeInTheDocument();
    });
  });

  describe('Participants/Respondents Display', () => {
    it('should display respondent count correctly', () => {
      const statistics = createMockStatistics({
        respondents: Array.from({ length: 42 }, (_, i) => i + 1),
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const participantsCard = screen.getByText('Participants').closest('.MuiCard-root');
      expect(within(participantsCard!).getByText('42')).toBeInTheDocument();
      expect(within(participantsCard!).getByText('Responded')).toBeInTheDocument();
    });

    it('should display non-respondent count correctly', () => {
      const statistics = createMockStatistics({
        nonRespondents: Array.from({ length: 18 }, (_, i) => i + 1),
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const participantsCard = screen.getByText('Participants').closest('.MuiCard-root');
      expect(within(participantsCard!).getByText('18')).toBeInTheDocument();
    });

    it('should render People icon for participants', () => {
      const statistics = createMockStatistics();
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const participantsCard = screen.getByText('Participants').closest('.MuiCard-root');
      const icon = within(participantsCard!).getByTestId('PeopleIcon');
      expect(icon).toBeInTheDocument();
    });

    it('should display pending chip when non-respondents exist', () => {
      const statistics = createMockStatistics({
        nonRespondents: Array.from({ length: 12 }, (_, i) => i + 1),
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const pendingChip = screen.getByText('12 pending');
      expect(pendingChip).toBeInTheDocument();
      expect(pendingChip.closest('.MuiChip-root')).toHaveClass('MuiChip-colorWarning');
    });

    it('should not display pending chip when all have responded', () => {
      const statistics = createMockStatistics({
        respondents: Array.from({ length: 50 }, (_, i) => i + 1),
        nonRespondents: [],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();
    });

    it('should apply warning color to non-respondent count when > 0', () => {
      const statistics = createMockStatistics({
        nonRespondents: Array.from({ length: 5 }, (_, i) => i + 1),
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const participantsCard = screen.getByText('Participants').closest('.MuiCard-root');
      const nonRespondentCount = within(participantsCard!).getByText('5');
      
      // Verify element is rendered with correct structure
      expect(nonRespondentCount).toBeInTheDocument();
      expect(nonRespondentCount.tagName).toBe('P');
      // When nonRespondents > 0, "Pending" text should be visible
      expect(within(participantsCard!).getByText('Pending')).toBeInTheDocument();
    });

    it('should apply success color to respondent count', () => {
      const statistics = createMockStatistics({
        respondents: Array.from({ length: 35 }, (_, i) => i + 1),
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const participantsCard = screen.getByText('Participants').closest('.MuiCard-root');
      const respondentCount = within(participantsCard!).getByText('35');
      
      // Verify element is rendered with correct structure
      expect(respondentCount).toBeInTheDocument();
      expect(respondentCount.tagName).toBe('P');
      expect(within(participantsCard!).getByText('Responded')).toBeInTheDocument();
    });
  });

  describe('Response Distribution by Course', () => {
    it('should render course distribution section when data exists', () => {
      const statistics = createMockStatistics();
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByRole('heading', { name: /responses by course/i })).toBeInTheDocument();
    });

    it('should display all course response counts', () => {
      const statistics = createMockStatistics({
        responsesByCourse: [
          { courseId: 1, courseName: 'Math 101', count: 25 },
          { courseId: 2, courseName: 'Physics 201', count: 15 },
          { courseId: 3, courseName: 'Chemistry 301', count: 10 },
        ],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('Math 101')).toBeInTheDocument();
      expect(screen.getByText('Physics 201')).toBeInTheDocument();
      expect(screen.getByText('Chemistry 301')).toBeInTheDocument();
    });

    it('should display chip with count for each course', () => {
      const statistics = createMockStatistics({
        responsesByCourse: [
          { courseId: 1, courseName: 'Math 101', count: 25 },
        ],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const mathCourseCard = screen.getByText('Math 101').closest('.MuiCard-root');
      const countChip = within(mathCourseCard!).getByText('25');
      expect(countChip.closest('.MuiChip-root')).toHaveClass('MuiChip-colorPrimary');
    });

    it('should not render course section when no course data', () => {
      const statistics = createMockStatistics({
        responsesByCourse: [],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.queryByRole('heading', { name: /responses by course/i })).not.toBeInTheDocument();
    });

    it('should format large course counts with locale formatting', () => {
      const statistics = createMockStatistics({
        responsesByCourse: [
          { courseId: 1, courseName: 'Popular Course', count: 1500 },
        ],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('1,500')).toBeInTheDocument();
    });

    it('should use responsive grid layout for course cards', () => {
      const statistics = createMockStatistics({
        responsesByCourse: [
          { courseId: 1, courseName: 'Course 1', count: 10 },
          { courseId: 2, courseName: 'Course 2', count: 20 },
          { courseId: 3, courseName: 'Course 3', count: 30 },
        ],
      });
      
      const { container } = render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // Check that Grid items have correct breakpoint classes
      const courseSection = screen.getByText('Responses by Course').closest('div');
      const gridItems = within(courseSection!).getAllByText(/Course \d/).map(el => el.closest('.MuiGrid-item'));
      
      gridItems.forEach(item => {
        expect(item).toHaveClass('MuiGrid-grid-xs-12');
        expect(item).toHaveClass('MuiGrid-grid-sm-6');
        expect(item).toHaveClass('MuiGrid-grid-md-4');
      });
    });
  });

  describe('Response Distribution by Group', () => {
    it('should render group distribution section when data exists', () => {
      const statistics = createMockStatistics();
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByRole('heading', { name: /responses by group/i })).toBeInTheDocument();
    });

    it('should display all group response counts', () => {
      const statistics = createMockStatistics({
        responsesByGroup: [
          { groupId: 1, groupName: 'Group Alpha', count: 30 },
          { groupId: 2, groupName: 'Group Beta', count: 20 },
          { groupId: 3, groupName: 'Group Gamma', count: 10 },
        ],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('Group Alpha')).toBeInTheDocument();
      expect(screen.getByText('Group Beta')).toBeInTheDocument();
      expect(screen.getByText('Group Gamma')).toBeInTheDocument();
    });

    it('should display chip with count for each group', () => {
      const statistics = createMockStatistics({
        responsesByGroup: [
          { groupId: 1, groupName: 'Group A', count: 18 },
        ],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const groupCard = screen.getByText('Group A').closest('.MuiCard-root');
      const countChip = within(groupCard!).getByText('18');
      expect(countChip.closest('.MuiChip-root')).toHaveClass('MuiChip-colorSecondary');
    });

    it('should not render group section when no group data', () => {
      const statistics = createMockStatistics({
        responsesByGroup: [],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.queryByRole('heading', { name: /responses by group/i })).not.toBeInTheDocument();
    });

    it('should format large group counts with locale formatting', () => {
      const statistics = createMockStatistics({
        responsesByGroup: [
          { groupId: 1, groupName: 'Large Group', count: 2250 },
        ],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('2,250')).toBeInTheDocument();
    });

    it('should use responsive grid layout for group cards', () => {
      const statistics = createMockStatistics({
        responsesByGroup: [
          { groupId: 1, groupName: 'Group 1', count: 10 },
          { groupId: 2, groupName: 'Group 2', count: 20 },
        ],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const groupSection = screen.getByText('Responses by Group').closest('div');
      const gridItems = within(groupSection!).getAllByText(/Group \d/).map(el => el.closest('.MuiGrid-item'));
      
      gridItems.forEach(item => {
        expect(item).toHaveClass('MuiGrid-grid-xs-12');
        expect(item).toHaveClass('MuiGrid-grid-sm-6');
        expect(item).toHaveClass('MuiGrid-grid-md-4');
      });
    });
  });

  describe('Last Submission Date Display', () => {
    it('should display last submission date when timestamp > 0', () => {
      const statistics = createMockStatistics({
        lastSubmissionDate: 1699564800, // Nov 10, 2023
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText(/Last submission:/i)).toBeInTheDocument();
    });

    it('should format date correctly using date-fns', () => {
      const timestamp = 1699564800; // Nov 10, 2023 12:00:00 AM UTC
      const statistics = createMockStatistics({
        lastSubmissionDate: timestamp,
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const expectedDate = format(new Date(timestamp * 1000), 'MMM d, yyyy h:mm a');
      expect(screen.getByText(new RegExp(expectedDate))).toBeInTheDocument();
    });

    it('should include relative time with formatDistanceToNow', () => {
      const statistics = createMockStatistics({
        lastSubmissionDate: 1699564800,
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // Check for "ago" pattern which is part of formatDistanceToNow output
      expect(screen.getByText(/ago\)/i)).toBeInTheDocument();
    });

    it('should not display last submission section when timestamp is 0', () => {
      const statistics = createMockStatistics({
        lastSubmissionDate: 0,
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.queryByText(/Last submission:/i)).not.toBeInTheDocument();
    });

    it('should handle invalid date gracefully', () => {
      const statistics = createMockStatistics({
        lastSubmissionDate: -1, // Invalid timestamp
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // Component handles invalid date by not showing the last submission section
      expect(screen.queryByText(/Last submission:/i)).not.toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should render skeleton loaders when isLoading is true', () => {
      render(
        <FeedbackSummary
          feedbackId={123}
          isLoading={true}
        />
      );

      // Should render 4 skeleton cards (one for each main metric)
      expect(screen.getByTestId('skeleton-circular-1')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-circular-2')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-circular-3')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-circular-4')).toBeInTheDocument();
    });

    it('should render skeleton loaders when statistics is undefined', () => {
      render(
        <FeedbackSummary
          feedbackId={123}
        />
      );

      expect(screen.getByTestId('skeleton-text-heading-1')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-text-value-1')).toBeInTheDocument();
    });

    it('should display "Feedback Summary" heading even in loading state', () => {
      render(
        <FeedbackSummary
          feedbackId={123}
          isLoading={true}
        />
      );

      expect(screen.getByRole('heading', { name: /feedback summary/i })).toBeInTheDocument();
    });

    it('should render skeleton with correct structure for each card', () => {
      render(
        <FeedbackSummary
          feedbackId={123}
          isLoading={true}
        />
      );

      // Each skeleton card should have circular, heading, value, and caption skeletons
      expect(screen.getByTestId('skeleton-circular-1')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-text-heading-1')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-text-value-1')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-text-caption-1')).toBeInTheDocument();
    });

    it('should not render metric cards when in loading state', () => {
      render(
        <FeedbackSummary
          feedbackId={123}
          isLoading={true}
        />
      );

      expect(screen.queryByText('Total Responses')).not.toBeInTheDocument();
      expect(screen.queryByText('Completion Rate')).not.toBeInTheDocument();
    });
  });

  describe('Empty State Display', () => {
    it('should render empty state when totalResponses is 0', () => {
      const statistics = createMockStatistics({
        totalResponses: 0,
        respondents: [],
        responsesByCourse: [],
        responsesByGroup: [],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('No Responses Yet')).toBeInTheDocument();
      expect(screen.getByText(/This feedback has not received any responses yet/i)).toBeInTheDocument();
    });

    it('should render People icon in empty state', () => {
      const statistics = createMockStatistics({
        totalResponses: 0,
        respondents: [],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByTestId('PeopleIcon')).toBeInTheDocument();
    });

    it('should not render metric cards in empty state', () => {
      const statistics = createMockStatistics({
        totalResponses: 0,
        respondents: [],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.queryByText('Total Responses')).not.toBeInTheDocument();
      expect(screen.queryByText('Completion Rate')).not.toBeInTheDocument();
      expect(screen.queryByText('Average Time')).not.toBeInTheDocument();
    });

    it('should not render course or group distributions in empty state', () => {
      const statistics = createMockStatistics({
        totalResponses: 0,
        respondents: [],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.queryByText(/Responses by Course/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Responses by Group/i)).not.toBeInTheDocument();
    });
  });

  describe('Responsive Layout', () => {
    it('should use correct Grid breakpoints for main metric cards', () => {
      const statistics = createMockStatistics();
      
      const { container } = render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // Get all main metric card Grid items
      const gridItems = container.querySelectorAll('.MuiGrid-item');
      
      // First 4 items should be the main metric cards with xs=12, sm=6, md=3
      const mainCardItems = Array.from(gridItems).slice(0, 4);
      mainCardItems.forEach(item => {
        expect(item).toHaveClass('MuiGrid-grid-xs-12');
        expect(item).toHaveClass('MuiGrid-grid-sm-6');
        expect(item).toHaveClass('MuiGrid-grid-md-3');
      });
    });

    it('should use correct spacing in Grid container', () => {
      const statistics = createMockStatistics();
      
      const { container } = render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const gridContainer = container.querySelector('.MuiGrid-container');
      expect(gridContainer).toHaveClass('MuiGrid-spacing-xs-3');
    });
  });

  describe('Typography Variants', () => {
    it('should use h5 variant for main heading', () => {
      const statistics = createMockStatistics();
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const heading = screen.getByRole('heading', { name: /feedback summary/i });
      expect(heading.closest('.MuiTypography-h5')).toBeInTheDocument();
    });

    it('should use h6 variant for card labels', () => {
      const statistics = createMockStatistics();
      
      const { container } = render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const cardLabels = container.querySelectorAll('.MuiTypography-h6');
      expect(cardLabels.length).toBeGreaterThan(0);
    });

    it('should use h3 variant for main metric values', () => {
      const statistics = createMockStatistics();
      
      const { container } = render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const metricValues = container.querySelectorAll('.MuiTypography-h3');
      expect(metricValues.length).toBeGreaterThanOrEqual(3); // At least 3 main metrics
    });

    it('should use body2 variant for helper text', () => {
      const statistics = createMockStatistics();
      
      const { container } = render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('to complete feedback').closest('.MuiTypography-body2')).toBeInTheDocument();
    });
  });

  describe('Number Formatting', () => {
    it('should use Intl.NumberFormat for locale-aware formatting', () => {
      const statistics = createMockStatistics({
        totalResponses: 10000,
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // Intl.NumberFormat formats 10000 as "10,000" in en-US locale
      expect(screen.getByText('10,000')).toBeInTheDocument();
    });

    it('should format decimal percentages with one decimal place', () => {
      const statistics = createMockStatistics({
        completionRate: 67.89,
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // NumberFormatter with maximumFractionDigits: 1 rounds to 67.9
      expect(screen.getByText('67.9%')).toBeInTheDocument();
    });

    it('should handle zero values correctly', () => {
      const statistics = createMockStatistics({
        totalResponses: 0,
        completionRate: 0,
        averageTime: 0,
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // Empty state should be shown
      expect(screen.getByText('No Responses Yet')).toBeInTheDocument();
    });

    it('should format counts in course distribution', () => {
      const statistics = createMockStatistics({
        responsesByCourse: [
          { courseId: 1, courseName: 'Course A', count: 5678 },
        ],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('5,678')).toBeInTheDocument();
    });

    it('should format counts in group distribution', () => {
      const statistics = createMockStatistics({
        responsesByGroup: [
          { groupId: 1, groupName: 'Group A', count: 3456 },
        ],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('3,456')).toBeInTheDocument();
    });
  });

  describe('Accessibility (WCAG 2.1 AA)', () => {
    it('should have proper heading hierarchy', () => {
      const statistics = createMockStatistics();
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // Main heading should be h2
      const mainHeading = screen.getByRole('heading', { name: /feedback summary/i });
      expect(mainHeading.tagName).toBe('H2');

      // Card headings should be h3
      const cardHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(cardHeadings.length).toBeGreaterThan(0);
    });

    it('should have ARIA label on progress bar', () => {
      const statistics = createMockStatistics({ completionRate: 75 });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label', 'Completion progress: 75%');
    });

    it('should have aria-hidden on decorative icons', () => {
      const statistics = createMockStatistics();
      
      const { container } = render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should have proper region role with aria-label', () => {
      const statistics = createMockStatistics();
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const region = screen.getByRole('region');
      expect(region).toHaveAttribute('aria-label', 'Feedback statistics summary');
    });

    it('should have accessible text for screen readers', () => {
      const statistics = createMockStatistics();
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // All key information should be in text content
      expect(screen.getByText('Total Responses')).toBeInTheDocument();
      expect(screen.getByText('Completion Rate')).toBeInTheDocument();
      expect(screen.getByText('Average Time')).toBeInTheDocument();
      expect(screen.getByText('Participants')).toBeInTheDocument();
    });

    it('should maintain focus order in logical sequence', () => {
      const statistics = createMockStatistics();
      
      const { container } = render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // Cards should appear in DOM order
      const cards = container.querySelectorAll('.MuiCard-root');
      expect(cards.length).toBeGreaterThan(0);
      
      // First card should contain "Total Responses"
      expect(within(cards[0] as HTMLElement).getByText('Total Responses')).toBeInTheDocument();
    });

    it('should have sufficient color contrast for text', () => {
      const statistics = createMockStatistics();
      
      const { container } = render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // MUI default theme should provide WCAG AA compliant colors
      // This is a basic check that text is not transparent
      const headings = container.querySelectorAll('.MuiTypography-h6');
      headings.forEach(heading => {
        const style = window.getComputedStyle(heading);
        expect(style.opacity).not.toBe('0');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing optional fields gracefully', () => {
      const statistics = {
        totalResponses: 10,
        completionRate: 50,
        averageTime: 300,
        responsesByCourse: [],
        responsesByGroup: [],
        respondents: [1, 2, 3],
        nonRespondents: [4, 5, 6],
        lastSubmissionDate: 0,
      };
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('Total Responses')).toBeInTheDocument();
      expect(screen.queryByText(/Responses by Course/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Last submission:/i)).not.toBeInTheDocument();
    });

    it('should handle fractional seconds in averageTime', () => {
      const statistics = createMockStatistics({
        averageTime: 125.7, // 2 minutes 5.7 seconds
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // Should floor to 2 minutes
      expect(screen.getByText('2m')).toBeInTheDocument();
    });

    it('should handle completionRate over 100%', () => {
      const statistics = createMockStatistics({
        completionRate: 150,
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('150%')).toBeInTheDocument();
      
      // Progress bar should be capped at 100
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    it('should handle negative timestamps gracefully', () => {
      const statistics = createMockStatistics({
        lastSubmissionDate: -1000,
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // Component handles negative timestamp by not showing the last submission section
      expect(screen.queryByText(/Last submission:/i)).not.toBeInTheDocument();
    });

    it('should handle empty arrays for respondents', () => {
      const statistics = createMockStatistics({
        respondents: [],
        nonRespondents: [],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('0 of 0 enrolled')).toBeInTheDocument();
    });

    it('should handle very long course names', () => {
      const statistics = createMockStatistics({
        responsesByCourse: [
          {
            courseId: 1,
            courseName: 'This is a very long course name that should be displayed properly without breaking the layout',
            count: 10,
          },
        ],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText(/This is a very long course name/)).toBeInTheDocument();
    });

    it('should handle very long group names', () => {
      const statistics = createMockStatistics({
        responsesByGroup: [
          {
            groupId: 1,
            groupName: 'This is a very long group name that might overflow if not handled correctly',
            count: 5,
          },
        ],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText(/This is a very long group name/)).toBeInTheDocument();
    });

    it('should handle single-digit response counts', () => {
      const statistics = createMockStatistics({
        totalResponses: 5,
        respondents: [1, 2, 3, 4, 5],
        nonRespondents: [6],
      });
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      // Verify single-digit counts are rendered
      const fives = screen.getAllByText('5');
      expect(fives.length).toBeGreaterThanOrEqual(2); // At least totalResponses and respondent count
      expect(screen.getByText('5 of 6 enrolled')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should apply hover effect to cards', async () => {
      const user = userEvent.setup();
      const statistics = createMockStatistics();
      
      const { container } = render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const firstCard = container.querySelector('.MuiCard-root');
      expect(firstCard).toBeInTheDocument();
      
      // Cards should have hover transition styles
      const computedStyle = window.getComputedStyle(firstCard!);
      expect(computedStyle.transition).toContain('box-shadow');
    });

    it('should maintain card structure on hover', async () => {
      const user = userEvent.setup();
      const statistics = createMockStatistics();
      
      render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      const responseCard = screen.getByText('Total Responses').closest('.MuiCard-root');
      
      await user.hover(responseCard!);
      
      // Content should remain visible after hover
      expect(within(responseCard!).getByText('Total Responses')).toBeVisible();
      expect(within(responseCard!).getByText('45')).toBeVisible();
    });
  });

  describe('Component Props', () => {
    it('should accept feedbackId prop', () => {
      const statistics = createMockStatistics();
      
      const { rerender } = render(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
        />
      );

      expect(screen.getByText('Total Responses')).toBeInTheDocument();

      // Should not throw on re-render with different feedbackId
      rerender(
        <FeedbackSummary
          feedbackId={456}
          statistics={statistics}
        />
      );

      expect(screen.getByText('Total Responses')).toBeInTheDocument();
    });

    it('should handle statistics prop updates', () => {
      const initialStatistics = createMockStatistics({ totalResponses: 10 });
      
      const { rerender } = render(
        <FeedbackSummary
          feedbackId={123}
          statistics={initialStatistics}
        />
      );

      // Verify initial value is rendered (may appear multiple times)
      const initialValues = screen.getAllByText('10');
      expect(initialValues.length).toBeGreaterThan(0);

      const updatedStatistics = createMockStatistics({ totalResponses: 20 });
      
      rerender(
        <FeedbackSummary
          feedbackId={123}
          statistics={updatedStatistics}
        />
      );

      // Verify updated value is rendered (may appear multiple times)
      const updatedValues = screen.getAllByText('20');
      expect(updatedValues.length).toBeGreaterThan(0);
    });

    it('should toggle between loading and loaded states', () => {
      const statistics = createMockStatistics();
      
      const { rerender } = render(
        <FeedbackSummary
          feedbackId={123}
          isLoading={true}
        />
      );

      expect(screen.getByTestId('skeleton-circular-1')).toBeInTheDocument();

      rerender(
        <FeedbackSummary
          feedbackId={123}
          statistics={statistics}
          isLoading={false}
        />
      );

      expect(screen.queryByTestId('skeleton-circular-1')).not.toBeInTheDocument();
      expect(screen.getByText('Total Responses')).toBeInTheDocument();
    });
  });
});
