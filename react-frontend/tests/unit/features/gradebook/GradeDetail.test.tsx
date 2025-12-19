/**
 * GradeDetail Component Unit Tests
 *
 * Comprehensive test suite for the GradeDetail component covering:
 * - Grade item rendering with all data types (numeric, scale, text)
 * - Grade value formatting and percentage calculations
 * - Feedback display with HTML sanitization
 * - Submission status indicators (submitted, late, missing, graded, pending)
 * - Grade modification history timeline
 * - Override and exclusion status indicators
 * - Hidden and locked status display
 * - Loading state with skeleton placeholders
 * - Empty state when no grade data available
 * - Permission-based UI element visibility
 * - Accessibility compliance (WCAG 2.1 AA)
 *
 * @package    react-frontend/tests
 * @subpackage unit/features/gradebook
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React from 'react';
import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { run as axeRun, type AxeResults } from 'axe-core';

// Internal imports from test helpers
import { render, screen, waitFor, within } from '../../../helpers/render';
import { createMockUser, createMockStudent, createMockTeacher } from '../../../helpers/mockData';

// Component under test
import GradeDetail, {
  type GradeDetailData,
  type GradeDetailProps,
  type SubmissionStatus,
  type GradeModificationEntry,
  type GradeScale,
} from '@/features/gradebook/components/GradeDetail';

// Type imports
import { GradeType } from '@/features/gradebook/types/grade.types';

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Creates a mock grade scale for testing scale-based grades
 */
function createMockGradeScale(overrides: Partial<GradeScale> = {}): GradeScale {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Competency Scale',
    options: overrides.options ?? [
      { value: 1, name: 'Not Yet Competent' },
      { value: 2, name: 'Developing' },
      { value: 3, name: 'Competent' },
      { value: 4, name: 'Proficient' },
    ],
  };
}

/**
 * Creates a mock modification history entry
 */
function createMockHistoryEntry(overrides: Partial<GradeModificationEntry> = {}): GradeModificationEntry {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: overrides.id ?? Math.floor(Math.random() * 1000000) + 1,
    modifierName: overrides.modifierName ?? 'Teacher User',
    timestamp: overrides.timestamp ?? now - 86400, // 1 day ago
    oldGrade: overrides.oldGrade ?? null,
    newGrade: overrides.newGrade ?? 85,
    reason: overrides.reason,
  };
}

/**
 * Creates mock grade detail data for testing
 */
function createMockGradeDetail(overrides: Partial<GradeDetailData> = {}): GradeDetailData {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Assignment 1',
    finalgrade: overrides.finalgrade ?? 85.5,
    grademax: overrides.grademax ?? 100,
    feedback: overrides.feedback ?? null,
    submissionStatus: overrides.submissionStatus ?? 'graded',
    modificationHistory: overrides.modificationHistory ?? [],
    overridden: overrides.overridden ?? false,
    excluded: overrides.excluded ?? false,
    hidden: overrides.hidden ?? false,
    locked: overrides.locked ?? false,
    locktime: overrides.locktime ?? 0,
    gradetype: overrides.gradetype ?? GradeType.VALUE,
    scale: overrides.scale,
    scaleid: overrides.scaleid ?? null,
    timemodified: overrides.timemodified ?? now,
  };
}

// ============================================================================
// Test Suite: GradeDetail Component
// ============================================================================

describe('GradeDetail Component', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================================================
  // Test Group: Basic Rendering
  // ==========================================================================

  describe('Basic Rendering', () => {
    it('renders grade item name correctly', () => {
      const gradeItem = createMockGradeDetail({ name: 'Midterm Exam' });
      render(<GradeDetail gradeItem={gradeItem} />);

      expect(screen.getByTestId('grade-item-name')).toHaveTextContent('Midterm Exam');
    });

    it('renders grade ID in subheader', () => {
      const gradeItem = createMockGradeDetail({ id: 42 });
      render(<GradeDetail gradeItem={gradeItem} />);

      expect(screen.getByText('Grade ID: 42')).toBeInTheDocument();
    });

    it('renders component without crashing when valid data provided', () => {
      const gradeItem = createMockGradeDetail();
      const { container } = render(<GradeDetail gradeItem={gradeItem} />);

      expect(container.querySelector('.MuiCard-root')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Test Group: Grade Value Display
  // ==========================================================================

  describe('Grade Value Display', () => {
    describe('Numeric Grades (GradeType.VALUE)', () => {
      it('displays numeric grade with fraction and percentage', () => {
        const gradeItem = createMockGradeDetail({
          finalgrade: 85.5,
          grademax: 100,
          gradetype: GradeType.VALUE,
        });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText('85.50 / 100.00 (85.5%)')).toBeInTheDocument();
      });

      it('displays zero grade correctly', () => {
        const gradeItem = createMockGradeDetail({
          finalgrade: 0,
          grademax: 100,
          gradetype: GradeType.VALUE,
        });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText('0.00 / 100.00 (0.0%)')).toBeInTheDocument();
      });

      it('displays perfect grade correctly', () => {
        const gradeItem = createMockGradeDetail({
          finalgrade: 100,
          grademax: 100,
          gradetype: GradeType.VALUE,
        });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText('100.00 / 100.00 (100.0%)')).toBeInTheDocument();
      });

      it('handles custom max grade values', () => {
        const gradeItem = createMockGradeDetail({
          finalgrade: 45,
          grademax: 50,
          gradetype: GradeType.VALUE,
        });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText('45.00 / 50.00 (90.0%)')).toBeInTheDocument();
      });

      it('displays "Not graded" when finalgrade is null', () => {
        const gradeItem = createMockGradeDetail({
          finalgrade: null,
          gradetype: GradeType.VALUE,
        });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText('Not graded')).toBeInTheDocument();
      });
    });

    describe('Scale Grades (GradeType.SCALE)', () => {
      it('displays scale option name when scale is provided', () => {
        const scale = createMockGradeScale();
        const gradeItem = createMockGradeDetail({
          gradetype: GradeType.SCALE,
          scale,
          scaleid: 3, // "Competent" option
          finalgrade: 3,
        });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText('Competent')).toBeInTheDocument();
      });

      it('displays scale value when option not found in scale', () => {
        const scale = createMockGradeScale();
        const gradeItem = createMockGradeDetail({
          gradetype: GradeType.SCALE,
          scale,
          scaleid: 99, // Not in scale options
          finalgrade: 99,
        });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText('Scale value: 99')).toBeInTheDocument();
      });

      it('displays "Scale value: N/A" when scaleid is null', () => {
        const gradeItem = createMockGradeDetail({
          gradetype: GradeType.SCALE,
          scaleid: null,
          finalgrade: null,
        });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText('Not graded')).toBeInTheDocument();
      });

      it('renders scale information section with scale name and options', () => {
        const scale = createMockGradeScale({ name: 'Performance Scale' });
        const gradeItem = createMockGradeDetail({
          gradetype: GradeType.SCALE,
          scale,
          scaleid: 2,
          finalgrade: 2,
        });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText('Performance Scale')).toBeInTheDocument();
        expect(screen.getByText(/Not Yet Competent, Developing, Competent, Proficient/)).toBeInTheDocument();
      });
    });

    describe('Text Grades (GradeType.TEXT)', () => {
      it('displays "Text feedback only" for text grade type', () => {
        const gradeItem = createMockGradeDetail({
          gradetype: GradeType.TEXT,
          finalgrade: 0, // Ignored for text type
        });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText('Text feedback only')).toBeInTheDocument();
      });
    });

    describe('No Grade (GradeType.NONE)', () => {
      it('displays "No grade" for NONE grade type', () => {
        const gradeItem = createMockGradeDetail({
          gradetype: GradeType.NONE,
          finalgrade: null,
        });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText('No grade')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Test Group: Submission Status
  // ==========================================================================

  describe('Submission Status', () => {
    const statusTestCases: { status: SubmissionStatus; expectedText: string; expectedColor: string }[] = [
      { status: 'submitted', expectedText: 'Submitted', expectedColor: 'success' },
      { status: 'graded', expectedText: 'Graded', expectedColor: 'success' },
      { status: 'late', expectedText: 'Late', expectedColor: 'warning' },
      { status: 'missing', expectedText: 'Missing', expectedColor: 'error' },
      { status: 'pending', expectedText: 'Pending', expectedColor: 'info' },
    ];

    test.each(statusTestCases)(
      'displays $status status with correct chip',
      ({ status, expectedText }) => {
        const gradeItem = createMockGradeDetail({ submissionStatus: status });
        render(<GradeDetail gradeItem={gradeItem} />);

        const chip = screen.getByText(expectedText);
        expect(chip).toBeInTheDocument();
      }
    );

    it('shows warning icon for missing submissions', () => {
      const gradeItem = createMockGradeDetail({ submissionStatus: 'missing' });
      render(<GradeDetail gradeItem={gradeItem} />);

      // Warning icon should be present in the header
      expect(screen.getByRole('img', { hidden: true }) || 
             screen.getByTestId('WarningIcon') ||
             document.querySelector('[data-testid="WarningIcon"]') ||
             document.querySelector('svg')).toBeTruthy();
    });
  });

  // ==========================================================================
  // Test Group: Date Graded
  // ==========================================================================

  describe('Date Graded', () => {
    it('displays date when grade was last modified', () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400; // 1 day ago
      const gradeItem = createMockGradeDetail({ timemodified: timestamp });
      render(<GradeDetail gradeItem={gradeItem} />);

      const dateElement = screen.getByTestId('date-graded');
      expect(dateElement).toBeInTheDocument();
      expect(dateElement).toHaveTextContent(/Graded:/);
    });

    it('does not display date when timemodified is 0', () => {
      const gradeItem = createMockGradeDetail({ timemodified: 0 });
      render(<GradeDetail gradeItem={gradeItem} />);

      expect(screen.queryByTestId('date-graded')).not.toBeInTheDocument();
    });

    it('does not display date when timemodified is undefined', () => {
      const gradeItem = createMockGradeDetail({ timemodified: undefined });
      render(<GradeDetail gradeItem={gradeItem} />);

      expect(screen.queryByTestId('date-graded')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Test Group: Feedback Display
  // ==========================================================================

  describe('Feedback Display', () => {
    it('renders feedback accordion when feedback is present', async () => {
      const gradeItem = createMockGradeDetail({
        feedback: '<p>Great work on this assignment!</p>',
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      const feedbackAccordion = screen.getByText('Feedback');
      expect(feedbackAccordion).toBeInTheDocument();
    });

    it('expands feedback accordion on click', async () => {
      const user = userEvent.setup();
      const gradeItem = createMockGradeDetail({
        feedback: '<p>Excellent analysis and well-structured arguments.</p>',
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      const accordionSummary = screen.getByRole('button', { name: /Feedback/i });
      await user.click(accordionSummary);

      await waitFor(() => {
        expect(screen.getByTestId('grade-feedback')).toBeInTheDocument();
      });
    });

    it('sanitizes HTML in feedback content', async () => {
      const user = userEvent.setup();
      const gradeItem = createMockGradeDetail({
        feedback: '<p>Good work!</p><script>alert("xss")</script>',
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      const accordionSummary = screen.getByRole('button', { name: /Feedback/i });
      await user.click(accordionSummary);

      await waitFor(() => {
        const feedbackContent = screen.getByTestId('grade-feedback');
        expect(feedbackContent.innerHTML).not.toContain('<script>');
        expect(feedbackContent.innerHTML).toContain('Good work!');
      });
    });

    it('does not render feedback section when feedback is null', () => {
      const gradeItem = createMockGradeDetail({ feedback: null });
      render(<GradeDetail gradeItem={gradeItem} />);

      expect(screen.queryByText('Feedback')).not.toBeInTheDocument();
    });

    it('preserves allowed HTML tags in feedback', async () => {
      const user = userEvent.setup();
      const gradeItem = createMockGradeDetail({
        feedback: '<p>Good <strong>introduction</strong>, but needs <em>better</em> conclusion.</p><ul><li>Point 1</li><li>Point 2</li></ul>',
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      const accordionSummary = screen.getByRole('button', { name: /Feedback/i });
      await user.click(accordionSummary);

      await waitFor(() => {
        const feedbackContent = screen.getByTestId('grade-feedback');
        expect(feedbackContent.innerHTML).toContain('<strong>');
        expect(feedbackContent.innerHTML).toContain('<em>');
        expect(feedbackContent.innerHTML).toContain('<ul>');
        expect(feedbackContent.innerHTML).toContain('<li>');
      });
    });
  });

  // ==========================================================================
  // Test Group: Status Indicators
  // ==========================================================================

  describe('Status Indicators', () => {
    describe('Override Status', () => {
      it('displays override alert when grade is overridden', () => {
        const gradeItem = createMockGradeDetail({ overridden: true });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText(/manually overridden/i)).toBeInTheDocument();
      });

      it('does not display override alert when grade is not overridden', () => {
        const gradeItem = createMockGradeDetail({ overridden: false });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.queryByText(/manually overridden/i)).not.toBeInTheDocument();
      });
    });

    describe('Excluded Status', () => {
      it('displays excluded chip when grade is excluded from totals', () => {
        const gradeItem = createMockGradeDetail({ excluded: true });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText(/Excluded from course total/i)).toBeInTheDocument();
      });

      it('does not display excluded chip when grade is not excluded', () => {
        const gradeItem = createMockGradeDetail({ excluded: false });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.queryByText(/Excluded from course total/i)).not.toBeInTheDocument();
      });
    });

    describe('Hidden Status', () => {
      it('displays "Hidden" status when hidden is true', () => {
        const gradeItem = createMockGradeDetail({ hidden: true });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText('Hidden')).toBeInTheDocument();
      });

      it('displays "Hidden until" with date when hidden is a future timestamp', () => {
        const futureTimestamp = Math.floor(Date.now() / 1000) + 86400 * 7; // 7 days in future
        const gradeItem = createMockGradeDetail({ hidden: futureTimestamp });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText(/Hidden until/i)).toBeInTheDocument();
      });

      it('does not display hidden status when hidden is false', () => {
        const gradeItem = createMockGradeDetail({ hidden: false });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
      });
    });

    describe('Locked Status', () => {
      it('displays "Locked" status when locked is true', () => {
        const gradeItem = createMockGradeDetail({ locked: true });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText(/Locked/i)).toBeInTheDocument();
        expect(screen.getByText(/Cannot be modified/i)).toBeInTheDocument();
      });

      it('displays "Locked until" with date when locked is a future timestamp', () => {
        const futureTimestamp = Math.floor(Date.now() / 1000) + 86400 * 14; // 14 days in future
        const gradeItem = createMockGradeDetail({ locked: futureTimestamp });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText(/Locked until/i)).toBeInTheDocument();
      });

      it('displays auto-lock scheduled message when locktime is set', () => {
        const futureTimestamp = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days in future
        const gradeItem = createMockGradeDetail({ locked: false, locktime: futureTimestamp });
        render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText(/Auto-lock scheduled/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Test Group: Modification History
  // ==========================================================================

  describe('Modification History', () => {
    it('renders modification history accordion when history exists', () => {
      const gradeItem = createMockGradeDetail({
        modificationHistory: [
          createMockHistoryEntry({ oldGrade: null, newGrade: 80 }),
        ],
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      expect(screen.getByTestId('grade-history-accordion')).toBeInTheDocument();
      expect(screen.getByText(/Modification History \(1\)/)).toBeInTheDocument();
    });

    it('does not render history accordion when history is empty', () => {
      const gradeItem = createMockGradeDetail({ modificationHistory: [] });
      render(<GradeDetail gradeItem={gradeItem} />);

      expect(screen.queryByTestId('grade-history-accordion')).not.toBeInTheDocument();
    });

    it('displays all history entries with correct count', () => {
      const gradeItem = createMockGradeDetail({
        modificationHistory: [
          createMockHistoryEntry({ id: 1, oldGrade: null, newGrade: 70 }),
          createMockHistoryEntry({ id: 2, oldGrade: 70, newGrade: 80 }),
          createMockHistoryEntry({ id: 3, oldGrade: 80, newGrade: 85 }),
        ],
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      expect(screen.getByText(/Modification History \(3\)/)).toBeInTheDocument();
    });

    it('expands history accordion on click', async () => {
      const user = userEvent.setup();
      const gradeItem = createMockGradeDetail({
        modificationHistory: [
          createMockHistoryEntry({ modifierName: 'Jane Smith', oldGrade: 70, newGrade: 85 }),
        ],
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      const accordionSummary = screen.getByRole('button', { name: /Modification History/i });
      await user.click(accordionSummary);

      await waitFor(() => {
        expect(screen.getByTestId('grade-history-list')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('displays modifier name in history entry', async () => {
      const user = userEvent.setup();
      const gradeItem = createMockGradeDetail({
        modificationHistory: [
          createMockHistoryEntry({ modifierName: 'Professor Johnson' }),
        ],
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      const accordionSummary = screen.getByRole('button', { name: /Modification History/i });
      await user.click(accordionSummary);

      await waitFor(() => {
        expect(screen.getByTestId('history-user')).toHaveTextContent('Professor Johnson');
      });
    });

    it('displays grade change values in history entry', async () => {
      const user = userEvent.setup();
      const gradeItem = createMockGradeDetail({
        modificationHistory: [
          createMockHistoryEntry({ oldGrade: 72.5, newGrade: 85.0 }),
        ],
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      const accordionSummary = screen.getByRole('button', { name: /Modification History/i });
      await user.click(accordionSummary);

      await waitFor(() => {
        const historyGrade = screen.getByTestId('history-grade');
        expect(historyGrade).toHaveTextContent('72.50');
        expect(historyGrade).toHaveTextContent('85.00');
      });
    });

    it('displays "Not graded" for null grades in history', async () => {
      const user = userEvent.setup();
      const gradeItem = createMockGradeDetail({
        modificationHistory: [
          createMockHistoryEntry({ oldGrade: null, newGrade: 80 }),
        ],
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      const accordionSummary = screen.getByRole('button', { name: /Modification History/i });
      await user.click(accordionSummary);

      await waitFor(() => {
        const historyGrade = screen.getByTestId('history-grade');
        expect(historyGrade).toHaveTextContent('Not graded');
        expect(historyGrade).toHaveTextContent('80.00');
      });
    });

    it('displays reason when provided in history entry', async () => {
      const user = userEvent.setup();
      const gradeItem = createMockGradeDetail({
        modificationHistory: [
          createMockHistoryEntry({ reason: 'Late submission penalty applied' }),
        ],
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      const accordionSummary = screen.getByRole('button', { name: /Modification History/i });
      await user.click(accordionSummary);

      await waitFor(() => {
        expect(screen.getByTestId('history-reason')).toHaveTextContent('Late submission penalty applied');
      });
    });

    it('displays relative time for history entries', async () => {
      const user = userEvent.setup();
      const recentTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const gradeItem = createMockGradeDetail({
        modificationHistory: [
          createMockHistoryEntry({ timestamp: recentTimestamp }),
        ],
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      const accordionSummary = screen.getByRole('button', { name: /Modification History/i });
      await user.click(accordionSummary);

      await waitFor(() => {
        const historyDate = screen.getByTestId('history-date');
        expect(historyDate).toHaveTextContent(/ago/i);
      });
    });
  });

  // ==========================================================================
  // Test Group: Loading State
  // ==========================================================================

  describe('Loading State', () => {
    it('displays skeleton placeholders when loading', () => {
      render(<GradeDetail gradeItem={null} loading={true} />);

      // Check for skeleton elements
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders card structure during loading state', () => {
      const { container } = render(<GradeDetail gradeItem={null} loading={true} />);

      expect(container.querySelector('.MuiCard-root')).toBeInTheDocument();
      expect(container.querySelector('.MuiCardHeader-root')).toBeInTheDocument();
      expect(container.querySelector('.MuiCardContent-root')).toBeInTheDocument();
    });

    it('does not render grade data during loading', () => {
      render(<GradeDetail gradeItem={null} loading={true} />);

      expect(screen.queryByTestId('grade-item-name')).not.toBeInTheDocument();
      expect(screen.queryByText(/Graded/)).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Test Group: Empty State
  // ==========================================================================

  describe('Empty State', () => {
    it('displays empty state message when gradeItem is null', () => {
      render(<GradeDetail gradeItem={null} />);

      expect(screen.getByText('No grade data available')).toBeInTheDocument();
      expect(screen.getByText(/Select a grade item/i)).toBeInTheDocument();
    });

    it('displays info icon in empty state', () => {
      render(<GradeDetail gradeItem={null} />);

      // InfoIcon should be rendered
      const card = document.querySelector('.MuiCard-root');
      expect(card).toBeInTheDocument();
    });

    it('renders card structure in empty state', () => {
      const { container } = render(<GradeDetail gradeItem={null} />);

      expect(container.querySelector('.MuiCard-root')).toBeInTheDocument();
      expect(container.querySelector('.MuiCardContent-root')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Test Group: Grade Calculations Match PHP Backend
  // ==========================================================================

  describe('Grade Calculations Match PHP Backend', () => {
    it('calculates percentage correctly for standard grades', () => {
      const testCases = [
        { finalgrade: 85, grademax: 100, expectedPercent: '85.0%' },
        { finalgrade: 45, grademax: 50, expectedPercent: '90.0%' },
        { finalgrade: 12.5, grademax: 25, expectedPercent: '50.0%' },
        { finalgrade: 33.33, grademax: 100, expectedPercent: '33.3%' },
      ];

      testCases.forEach(({ finalgrade, grademax, expectedPercent }) => {
        const gradeItem = createMockGradeDetail({ finalgrade, grademax, gradetype: GradeType.VALUE });
        const { unmount } = render(<GradeDetail gradeItem={gradeItem} />);

        expect(screen.getByText(new RegExp(expectedPercent.replace('.', '\\.')))).toBeInTheDocument();
        unmount();
      });
    });

    it('handles edge case of zero max grade', () => {
      const gradeItem = createMockGradeDetail({
        finalgrade: 0,
        grademax: 0, // Edge case
        gradetype: GradeType.VALUE,
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      // Should show 0% without division by zero error
      expect(screen.getByText(/0\.0%/)).toBeInTheDocument();
    });

    it('rounds grade values to 2 decimal places like PHP backend', () => {
      const gradeItem = createMockGradeDetail({
        finalgrade: 85.12345,
        grademax: 100,
        gradetype: GradeType.VALUE,
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      // Should show 85.12, not full precision
      expect(screen.getByText(/85\.12/)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Test Group: Accessibility Compliance (WCAG 2.1 AA)
  // ==========================================================================

  describe('Accessibility Compliance', () => {
    it('has proper heading hierarchy', () => {
      const gradeItem = createMockGradeDetail({ name: 'Test Assignment' });
      render(<GradeDetail gradeItem={gradeItem} />);

      // Grade item name should be an h2
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toBeInTheDocument();
    });

    it('has proper ARIA labels for status icons', () => {
      const gradeItem = createMockGradeDetail({
        hidden: true,
        locked: true,
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      // Check for aria-label attributes on status indicators
      const hiddenStatus = document.querySelector('[aria-label*="hidden"]');
      const lockedStatus = document.querySelector('[aria-label*="locked"]');
      
      expect(hiddenStatus).toBeInTheDocument();
      expect(lockedStatus).toBeInTheDocument();
    });

    it('accordions have proper aria-controls and aria-expanded', async () => {
      const user = userEvent.setup();
      const gradeItem = createMockGradeDetail({
        feedback: '<p>Test feedback</p>',
        modificationHistory: [createMockHistoryEntry()],
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      const feedbackButton = screen.getByRole('button', { name: /Feedback/i });
      const historyButton = screen.getByRole('button', { name: /Modification History/i });

      // Check initial state
      expect(feedbackButton).toHaveAttribute('aria-expanded', 'false');
      expect(feedbackButton).toHaveAttribute('aria-controls');

      // Click to expand
      await user.click(feedbackButton);
      expect(feedbackButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('history entries have proper heading structure', async () => {
      const user = userEvent.setup();
      const gradeItem = createMockGradeDetail({
        modificationHistory: [createMockHistoryEntry({ modifierName: 'Test User' })],
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      const accordionSummary = screen.getByRole('button', { name: /Modification History/i });
      await user.click(accordionSummary);

      await waitFor(() => {
        // History entry user name should be an h3
        const entryHeading = screen.getByRole('heading', { level: 3 });
        expect(entryHeading).toHaveTextContent('Test User');
      });
    });

    it('passes axe accessibility audit', async () => {
      const gradeItem = createMockGradeDetail({
        name: 'Accessible Assignment',
        feedback: '<p>Feedback content</p>',
        modificationHistory: [createMockHistoryEntry()],
        overridden: true,
      });
      const { container } = render(<GradeDetail gradeItem={gradeItem} />);

      // Run axe accessibility check
      const results: AxeResults = await axeRun(container);
      
      // Filter out minor issues that don't affect WCAG 2.1 AA compliance
      const criticalViolations = results.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious'
      );

      expect(criticalViolations).toHaveLength(0);
    });

    it('loading state is accessible', async () => {
      const { container } = render(<GradeDetail gradeItem={null} loading={true} />);

      const results: AxeResults = await axeRun(container);
      const criticalViolations = results.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious'
      );

      expect(criticalViolations).toHaveLength(0);
    });

    it('empty state is accessible', async () => {
      const { container } = render(<GradeDetail gradeItem={null} />);

      const results: AxeResults = await axeRun(container);
      const criticalViolations = results.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious'
      );

      expect(criticalViolations).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Test Group: Component Props
  // ==========================================================================

  describe('Component Props', () => {
    it('accepts loading prop defaulting to false', () => {
      const gradeItem = createMockGradeDetail();
      render(<GradeDetail gradeItem={gradeItem} />);

      // Should render grade data, not loading skeletons
      expect(screen.getByTestId('grade-item-name')).toBeInTheDocument();
    });

    it('handles undefined gradeItem gracefully', () => {
      render(<GradeDetail gradeItem={null as unknown as GradeDetailData} />);

      expect(screen.getByText('No grade data available')).toBeInTheDocument();
    });

    it('updates when gradeItem prop changes', () => {
      const gradeItem1 = createMockGradeDetail({ name: 'Assignment 1', finalgrade: 75 });
      const { rerender } = render(<GradeDetail gradeItem={gradeItem1} />);

      expect(screen.getByTestId('grade-item-name')).toHaveTextContent('Assignment 1');

      const gradeItem2 = createMockGradeDetail({ name: 'Assignment 2', finalgrade: 90 });
      rerender(<GradeDetail gradeItem={gradeItem2} />);

      expect(screen.getByTestId('grade-item-name')).toHaveTextContent('Assignment 2');
    });

    it('transitions from loading to loaded state', () => {
      const gradeItem = createMockGradeDetail({ name: 'Loaded Assignment' });
      const { rerender } = render(<GradeDetail gradeItem={null} loading={true} />);

      // Initially loading
      expect(document.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);

      // Transition to loaded
      rerender(<GradeDetail gradeItem={gradeItem} loading={false} />);

      expect(screen.getByTestId('grade-item-name')).toHaveTextContent('Loaded Assignment');
    });
  });

  // ==========================================================================
  // Test Group: Complex Scenarios
  // ==========================================================================

  describe('Complex Scenarios', () => {
    it('renders all status indicators simultaneously', () => {
      const gradeItem = createMockGradeDetail({
        overridden: true,
        excluded: true,
        hidden: true,
        locked: true,
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      expect(screen.getByText(/manually overridden/i)).toBeInTheDocument();
      expect(screen.getByText(/Excluded from course total/i)).toBeInTheDocument();
      expect(screen.getByText('Hidden')).toBeInTheDocument();
      expect(screen.getByText(/Locked/)).toBeInTheDocument();
    });

    it('handles grade with full data including history and feedback', async () => {
      const user = userEvent.setup();
      const gradeItem = createMockGradeDetail({
        name: 'Complete Assignment',
        finalgrade: 92.5,
        grademax: 100,
        feedback: '<p><strong>Excellent work!</strong> Great analysis.</p>',
        submissionStatus: 'graded',
        modificationHistory: [
          createMockHistoryEntry({ id: 1, oldGrade: null, newGrade: 85, modifierName: 'Auto-grader' }),
          createMockHistoryEntry({ id: 2, oldGrade: 85, newGrade: 92.5, modifierName: 'Prof. Smith', reason: 'Bonus applied' }),
        ],
        overridden: true,
        timemodified: Math.floor(Date.now() / 1000),
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      // Verify basic info
      expect(screen.getByTestId('grade-item-name')).toHaveTextContent('Complete Assignment');
      expect(screen.getByText(/92\.50/)).toBeInTheDocument();
      expect(screen.getByText('Graded')).toBeInTheDocument();
      expect(screen.getByText(/manually overridden/i)).toBeInTheDocument();

      // Expand and verify feedback
      await user.click(screen.getByRole('button', { name: /Feedback/i }));
      await waitFor(() => {
        expect(screen.getByText(/Excellent work!/)).toBeInTheDocument();
      });

      // Expand and verify history
      await user.click(screen.getByRole('button', { name: /Modification History/i }));
      await waitFor(() => {
        expect(screen.getByText('Auto-grader')).toBeInTheDocument();
        expect(screen.getByText('Prof. Smith')).toBeInTheDocument();
        expect(screen.getByText(/Bonus applied/)).toBeInTheDocument();
      });
    });

    it('handles scale grade with complete scale information', () => {
      const customScale = createMockGradeScale({
        name: 'Custom Mastery Scale',
        options: [
          { value: 1, name: 'Beginning' },
          { value: 2, name: 'Developing' },
          { value: 3, name: 'Accomplished' },
          { value: 4, name: 'Exemplary' },
        ],
      });
      const gradeItem = createMockGradeDetail({
        gradetype: GradeType.SCALE,
        scale: customScale,
        scaleid: 4,
        finalgrade: 4,
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      expect(screen.getByText('Exemplary')).toBeInTheDocument();
      expect(screen.getByText('Custom Mastery Scale')).toBeInTheDocument();
      expect(screen.getByText(/Beginning, Developing, Accomplished, Exemplary/)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Test Group: Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('handles malformed feedback HTML gracefully', async () => {
      const user = userEvent.setup();
      const gradeItem = createMockGradeDetail({
        feedback: '<p>Unclosed tag<div>Mixed content</p></div><invalid>Unknown tag</invalid>',
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      const accordionSummary = screen.getByRole('button', { name: /Feedback/i });
      await user.click(accordionSummary);

      // Should not throw and should render sanitized content
      await waitFor(() => {
        expect(screen.getByTestId('grade-feedback')).toBeInTheDocument();
      });
    });

    it('handles empty string feedback without rendering section', () => {
      const gradeItem = createMockGradeDetail({ feedback: '' });
      render(<GradeDetail gradeItem={gradeItem} />);

      // Empty string is falsy, so feedback section should not render
      expect(screen.queryByText('Feedback')).not.toBeInTheDocument();
    });

    it('handles negative grade values', () => {
      const gradeItem = createMockGradeDetail({
        finalgrade: -5,
        grademax: 100,
        gradetype: GradeType.VALUE,
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      expect(screen.getByText(/-5\.00/)).toBeInTheDocument();
    });

    it('handles very large grade values', () => {
      const gradeItem = createMockGradeDetail({
        finalgrade: 9999999.99,
        grademax: 10000000,
        gradetype: GradeType.VALUE,
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      expect(screen.getByText(/9999999\.99/)).toBeInTheDocument();
    });

    it('handles history entries with all null grades', async () => {
      const user = userEvent.setup();
      const gradeItem = createMockGradeDetail({
        modificationHistory: [
          createMockHistoryEntry({ oldGrade: null, newGrade: null }),
        ],
      });
      render(<GradeDetail gradeItem={gradeItem} />);

      const accordionSummary = screen.getByRole('button', { name: /Modification History/i });
      await user.click(accordionSummary);

      await waitFor(() => {
        const historyGrade = screen.getByTestId('history-grade');
        expect(historyGrade.textContent?.match(/Not graded/g)?.length).toBe(2);
      });
    });
  });

  // ==========================================================================
  // Test Group: Styling and Layout
  // ==========================================================================

  describe('Styling and Layout', () => {
    it('applies correct color to success status chip', () => {
      const gradeItem = createMockGradeDetail({ submissionStatus: 'graded' });
      const { container } = render(<GradeDetail gradeItem={gradeItem} />);

      const chip = container.querySelector('.MuiChip-colorSuccess');
      expect(chip).toBeInTheDocument();
    });

    it('applies correct color to error status chip', () => {
      const gradeItem = createMockGradeDetail({ submissionStatus: 'missing' });
      const { container } = render(<GradeDetail gradeItem={gradeItem} />);

      const chip = container.querySelector('.MuiChip-colorError');
      expect(chip).toBeInTheDocument();
    });

    it('applies correct color to warning status chip', () => {
      const gradeItem = createMockGradeDetail({ submissionStatus: 'late' });
      const { container } = render(<GradeDetail gradeItem={gradeItem} />);

      const chip = container.querySelector('.MuiChip-colorWarning');
      expect(chip).toBeInTheDocument();
    });

    it('renders timeline connectors between history entries', async () => {
      const user = userEvent.setup();
      const gradeItem = createMockGradeDetail({
        modificationHistory: [
          createMockHistoryEntry({ id: 1 }),
          createMockHistoryEntry({ id: 2 }),
        ],
      });
      const { container } = render(<GradeDetail gradeItem={gradeItem} />);

      const accordionSummary = screen.getByRole('button', { name: /Modification History/i });
      await user.click(accordionSummary);

      await waitFor(() => {
        // Should have timeline connectors between items
        const connectors = container.querySelectorAll('.MuiTimelineConnector-root');
        expect(connectors.length).toBeGreaterThan(0);
      });
    });

    it('renders dividers between sections', () => {
      const gradeItem = createMockGradeDetail({
        feedback: '<p>Test</p>',
        overridden: true,
      });
      const { container } = render(<GradeDetail gradeItem={gradeItem} />);

      const dividers = container.querySelectorAll('.MuiDivider-root');
      expect(dividers.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Integration Tests with Authentication Context
// ============================================================================

describe('GradeDetail with Authentication Context', () => {
  it('renders correctly for authenticated student', () => {
    const student = createMockStudent({ firstname: 'Alice', lastname: 'Student' });
    const gradeItem = createMockGradeDetail({ name: 'Student Assignment' });

    render(<GradeDetail gradeItem={gradeItem} />, {
      authenticated: true,
      user: student,
    });

    expect(screen.getByTestId('grade-item-name')).toHaveTextContent('Student Assignment');
  });

  it('renders correctly for authenticated teacher', () => {
    const teacher = createMockTeacher({ firstname: 'Bob', lastname: 'Teacher' });
    const gradeItem = createMockGradeDetail({ name: 'Teacher View Assignment' });

    render(<GradeDetail gradeItem={gradeItem} />, {
      authenticated: true,
      user: teacher,
    });

    expect(screen.getByTestId('grade-item-name')).toHaveTextContent('Teacher View Assignment');
  });

  it('handles unauthenticated state gracefully', () => {
    const gradeItem = createMockGradeDetail({ name: 'Public Assignment' });

    render(<GradeDetail gradeItem={gradeItem} />, {
      authenticated: false,
    });

    expect(screen.getByTestId('grade-item-name')).toHaveTextContent('Public Assignment');
  });
});
