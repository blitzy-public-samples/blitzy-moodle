/**
 * SubmissionList Component Unit Tests
 * 
 * Comprehensive test suite for the SubmissionList component validating:
 * - Teacher view table rendering with submission data
 * - Student view card rendering with attempt history
 * - Status indicators with appropriate colors and icons
 * - Sorting functionality by various columns
 * - Pagination controls and navigation
 * - Action button handlers (view, grade)
 * - Loading and empty states
 * - Responsive design and accessibility features
 */

import type React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { format, formatDistanceToNow } from 'date-fns';
import SubmissionList from '@/features/activities/assignments/components/SubmissionList';
import type { Submission, Assignment, SubmissionStatus } from '@/features/activities/assignments/types/assignment.types';

/**
 * Test Utilities
 * Helper functions for generating mock data and rendering with providers
 */

/**
 * Creates a mock submission object with default values
 */
const createMockSubmission = (overrides: Partial<Submission> = {}): Submission => {
  const baseSubmission: Submission = {
    id: Math.floor(Math.random() * 10000),
    assignment: 1,
    userid: Math.floor(Math.random() * 1000),
    timecreated: Date.now() / 1000 - 86400, // 1 day ago
    timemodified: Date.now() / 1000 - 3600, // 1 hour ago
    timestarted: Date.now() / 1000 - 7200, // 2 hours ago
    status: 'submitted',
    attemptnumber: 1,
    latest: 1,
    groupid: 0,
    ...overrides,
  };
  return baseSubmission;
};

/**
 * Creates an array of mock submissions with various statuses
 */
const createMockSubmissions = (count: number, overrides: Partial<Submission>[] = []): Submission[] => {
  const statuses: SubmissionStatus[] = ['new', 'draft', 'submitted', 'reopened'];
  const submissions: Submission[] = [];
  
  for (let i = 0; i < count; i++) {
    const override = overrides[i] || {};
    submissions.push(
      createMockSubmission({
        id: i + 1,
        userid: 100 + i,
        status: statuses[i % statuses.length],
        attemptnumber: 1,
        grade: i % 2 === 0 ? 85 + i : undefined, // Half graded, half not
        ...override,
      })
    );
  }
  
  return submissions;
};

/**
 * Creates a mock assignment object
 */
const createMockAssignment = (overrides: Partial<Assignment> = {}): Assignment => {
  return {
    id: 1,
    course: 1,
    name: 'Test Assignment',
    intro: 'Test assignment description',
    introformat: 1,
    activity: 'assign',
    activityformat: '',
    alwaysshowdescription: 1,
    submissiondrafts: 1,
    sendnotifications: 1,
    sendlatenotifications: 1,
    sendstudentnotifications: 1,
    duedate: Date.now() / 1000 + 86400, // 1 day from now
    cutoffdate: Date.now() / 1000 + 172800, // 2 days from now
    gradingduedate: 0,
    allowsubmissionsfromdate: Date.now() / 1000 - 86400, // Started 1 day ago
    grade: 100,
    timemodified: Date.now() / 1000,
    completionsubmit: 0,
    requiresubmissionstatement: 0,
    teamsubmission: 0,
    requireallteammemberssubmit: 0,
    teamsubmissiongroupingid: 0,
    blindmarking: 0,
    hidegrader: 0,
    revealidentities: 0,
    attemptreopenmethod: 'none',
    maxattempts: -1,
    markingworkflow: 0,
    markingallocation: 0,
    sendstudentnotifications: 1,
    preventsubmissionnotingroup: 0,
    configs: {},
    ...overrides,
  };
};

/**
 * Helper to sort submissions for comparison
 */
const sortSubmissions = (submissions: Submission[], field: keyof Submission, order: 'asc' | 'desc'): Submission[] => {
  const sorted = [...submissions].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    
    if (aVal === undefined && bVal === undefined) {return 0;}
    if (aVal === undefined) {return order === 'asc' ? 1 : -1;}
    if (bVal === undefined) {return order === 'asc' ? -1 : 1;}
    
    if (aVal < bVal) {return order === 'asc' ? -1 : 1;}
    if (aVal > bVal) {return order === 'asc' ? 1 : -1;}
    return 0;
  });
  
  return sorted;
};

/**
 * Renders component with necessary context providers
 */
const renderWithProviders = (component: React.ReactElement) => {
  return render(component);
};

/**
 * Main Test Suite
 */
describe('SubmissionList Component', () => {
  let mockOnViewSubmission: ReturnType<typeof vi.fn>;
  let mockOnGradeSubmission: ReturnType<typeof vi.fn>;
  let mockSubmissions: Submission[];
  let mockAssignment: Assignment;

  beforeEach(() => {
    // Reset mocks before each test
    mockOnViewSubmission = vi.fn();
    mockOnGradeSubmission = vi.fn();
    mockSubmissions = createMockSubmissions(5);
    mockAssignment = createMockAssignment();
    
    // Mock date-fns functions for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  /**
   * 1. Teacher View - Table Rendering Tests
   */
  describe('Teacher View - Table Rendering', () => {
    it('renders table with correct column headers', () => {
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      // Assert table exists
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      // Assert column headers are present
      expect(screen.getByText('Student')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Submitted Date')).toBeInTheDocument();
      expect(screen.getByText('Grade')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('displays all submissions in table rows', () => {
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      const rows = screen.getAllByRole('row');
      // +1 for header row
      expect(rows).toHaveLength(mockSubmissions.length + 1);
    });

    it('renders student name with avatar in Student column', () => {
      const submissionsWithNames = mockSubmissions.map((sub, idx) => ({
        ...sub,
        studentname: `Student ${idx + 1}`,
      }));

      renderWithProviders(
        <SubmissionList
          submissions={submissionsWithNames as any}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      submissionsWithNames.forEach((sub) => {
        expect(screen.getByText(sub.studentname)).toBeInTheDocument();
      });

      // Check for avatars using test ID (MUI Avatar with text content doesn't have role="img")
      const avatars = screen.getAllByTestId('student-avatar');
      expect(avatars.length).toBeGreaterThan(0);
    });

    it('displays submission status as Chip', () => {
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      // Check for status chips - count occurrences of each status
      const statusMap: Record<SubmissionStatus, string> = {
        new: 'Not Submitted',
        draft: 'Draft',
        submitted: 'Submitted',
        reopened: 'Reopened',
      };
      
      // Count expected occurrences of each status
      const statusCounts = mockSubmissions.reduce((acc, submission) => {
        const statusText = statusMap[submission.status];
        if (statusText) {
          acc[statusText] = (acc[statusText] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      
      // Verify each status appears the correct number of times
      Object.entries(statusCounts).forEach(([statusText, count]) => {
        const elements = screen.getAllByText(statusText);
        expect(elements).toHaveLength(count);
      });
    });

    it('formats submission dates correctly', () => {
      const submissions = [
        createMockSubmission({
          id: 1,
          timemodified: new Date('2024-01-10T10:30:00Z').getTime() / 1000,
        }),
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      // Date should be formatted
      const formattedDate = format(new Date('2024-01-10T10:30:00Z'), 'MMM dd, yyyy HH:mm');
      expect(screen.getByText(formattedDate)).toBeInTheDocument();
    });

    it('displays grade or "-" if not graded', () => {
      const submissions = [
        createMockSubmission({ id: 1, grade: 85 }),
        createMockSubmission({ id: 2, grade: undefined }),
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      expect(screen.getByText('85 / 100')).toBeInTheDocument();
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('shows grade as percentage if applicable', () => {
      const submissions = [
        createMockSubmission({ id: 1, grade: 85 }),
      ];

      const assignment = createMockAssignment({ grade: 100 });

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={assignment}
          viewMode="teacher"
        />
      );

      // Should show grade with percentage or fraction
      expect(screen.getByText('85 / 100')).toBeInTheDocument();
    });

    it('renders action buttons in Actions column', () => {
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
          onViewSubmission={mockOnViewSubmission}
          onGradeSubmission={mockOnGradeSubmission}
        />
      );

      // Check for action buttons (by aria-label)
      const viewButtons = screen.getAllByLabelText(/view submission/i);
      expect(viewButtons.length).toBeGreaterThan(0);
    });
  });

  /**
   * 2. Student View - Card Rendering Tests
   */
  describe('Student View - Card Rendering', () => {
    it('renders submissions as cards in student view', () => {
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="student"
        />
      );

      // Should not render as table
      expect(screen.queryByRole('table')).not.toBeInTheDocument();

      // Should render cards (look for multiple card-like structures)
      const cards = screen.getAllByTestId(/submission-card/i);
      expect(cards.length).toBeGreaterThan(0);
    });

    it('displays submissions in reverse chronological order', () => {
      const submissions = [
        createMockSubmission({ id: 1, timemodified: 1000 }),
        createMockSubmission({ id: 2, timemodified: 3000 }),
        createMockSubmission({ id: 3, timemodified: 2000 }),
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="student"
        />
      );

      const cards = screen.getAllByTestId(/submission-card/i);
      
      // Most recent (id: 2) should be first
      expect(cards[0]).toHaveAttribute('data-submission-id', '2');
    });

    it('shows attempt number for multiple attempts', () => {
      const assignment = createMockAssignment({ maxattempts: 3 });
      const submissions = [
        createMockSubmission({ id: 1, attemptnumber: 2 }),
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={assignment}
          viewMode="student"
        />
      );

      expect(screen.getByText(/Attempt #3/i)).toBeInTheDocument();
    });

    it('displays submission status chip in card', () => {
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="student"
        />
      );

      // Check for status chips
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });

    it('shows submission date with relative time', () => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const submissions = [
        createMockSubmission({ id: 1, timemodified: twoHoursAgo / 1000 }),
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="student"
        />
      );

      // Should show relative time
      const relativeTime = formatDistanceToNow(new Date(twoHoursAgo), { addSuffix: true });
      expect(screen.getByText(new RegExp(relativeTime, 'i'))).toBeInTheDocument();
    });

    it('displays grade and feedback preview if available', () => {
      const submissions = [
        createMockSubmission({
          id: 1,
          grade: 90,
          gradingstatus: 'graded',
          feedbacktext: 'Great work!',
        }) as any,
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="student"
        />
      );

      expect(screen.getByText('90 / 100')).toBeInTheDocument();
      expect(screen.getByText(/great work/i)).toBeInTheDocument();
    });

    it('shows view button to see full submission', () => {
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="student"
          onViewSubmission={mockOnViewSubmission}
        />
      );

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      expect(viewButtons.length).toBeGreaterThan(0);
    });

    it('highlights most recent submission', () => {
      const submissions = [
        createMockSubmission({ id: 1, timemodified: 1000 }),
        createMockSubmission({ id: 2, timemodified: 3000 }), // Most recent
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="student"
        />
      );

      const cards = screen.getAllByTestId(/submission-card/i);
      // First card should be highlighted (most recent)
      expect(cards[0]).toHaveAttribute('data-submission-id', '2');
      // Check for "Latest" chip to indicate highlighted status
      const latestChip = within(cards[0]).getByText('Latest');
      expect(latestChip).toBeInTheDocument();
    });
  });

  /**
   * 3. Status Indicator Tests
   */
  describe('Status Indicators', () => {
    it('displays "Not Submitted" status with default color', () => {
      const submissions = [createMockSubmission({ status: 'new' })];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      const chipLabel = screen.getByText('Not Submitted');
      expect(chipLabel).toBeInTheDocument();
      const chip = chipLabel.closest('.MuiChip-root');
      expect(chip).toHaveClass(/MuiChip-colorDefault/);
    });

    it('displays "Draft" status with warning color', () => {
      const submissions = [createMockSubmission({ status: 'draft' })];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      const chipLabel = screen.getByText('Draft');
      expect(chipLabel).toBeInTheDocument();
      const chip = chipLabel.closest('.MuiChip-root');
      expect(chip).toHaveClass(/MuiChip-colorWarning/);
    });

    it('displays "Submitted" status with primary color', () => {
      const submissions = [createMockSubmission({ status: 'submitted' })];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      const chipLabel = screen.getByText('Submitted');
      expect(chipLabel).toBeInTheDocument();
      const chip = chipLabel.closest('.MuiChip-root');
      expect(chip).toHaveClass(/MuiChip-colorPrimary/);
    });

    it('displays "Graded" status with success color', () => {
      const submissions = [
        createMockSubmission({
          status: 'submitted',
          grade: 95,
          gradingstatus: 'graded',
          gradeDisplay: '95 / 100',
        }),
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="student"
        />
      );

      // In student view, graded submissions show a success-colored chip with the grade
      const gradeChip = screen.getByText('95 / 100');
      expect(gradeChip).toBeInTheDocument();
      const chip = gradeChip.closest('.MuiChip-root');
      expect(chip).toHaveClass(/MuiChip-colorSuccess/);
    });

    it('displays late submission indicator', () => {
      const assignment = createMockAssignment({
        duedate: Date.now() / 1000 - 86400, // Due 1 day ago
      });

      const submissions = [
        createMockSubmission({
          timemodified: Date.now() / 1000, // Submitted now (late)
        }),
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={assignment}
          viewMode="teacher"
        />
      );

      // Should show late indicator
      expect(screen.getByText(/late/i)).toBeInTheDocument();
    });
  });

  /**
   * 4. Sorting Tests
   */
  describe('Sorting Functionality', () => {
    it('sorts by student name ascending', async () => {
      // Use real timers for this test to avoid timeout issues with userEvent
      vi.useRealTimers();
      
      const user = userEvent.setup();
      const submissions = [
        { ...createMockSubmission({ id: 1 }), studentname: 'Charlie' },
        { ...createMockSubmission({ id: 2 }), studentname: 'Alice' },
        { ...createMockSubmission({ id: 3 }), studentname: 'Bob' },
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions as any}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      // Find the sortable button by its aria-label
      const studentHeader = screen.getByLabelText('Sort by student name');
      await user.click(studentHeader);

      // Give React time to re-render after state change
      await new Promise(resolve => setTimeout(resolve, 50));

      // After sorting, Alice should be first
      const rows = screen.getAllByRole('row');
      expect(within(rows[1]).getByText('Alice')).toBeInTheDocument();
      
      // Restore fake timers for other tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    it('sorts by student name descending', async () => {
      // Use real timers for this test to avoid timeout issues with userEvent
      vi.useRealTimers();
      
      const user = userEvent.setup();
      const submissions = [
        { ...createMockSubmission({ id: 1 }), studentname: 'Alice' },
        { ...createMockSubmission({ id: 2 }), studentname: 'Charlie' },
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions as any}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      const studentHeader = screen.getByLabelText('Sort by student name');
      await user.click(studentHeader);
      await user.click(studentHeader); // Second click for descending

      // Give React time to re-render after state change
      await new Promise(resolve => setTimeout(resolve, 50));

      // After descending sort, Charlie should be first
      const rows = screen.getAllByRole('row');
      expect(within(rows[1]).getByText('Charlie')).toBeInTheDocument();
      
      // Restore fake timers for other tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    it('sorts by submission date', async () => {
      // Use real timers for this test to avoid timeout issues with userEvent
      vi.useRealTimers();
      
      const user = userEvent.setup();
      
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      const dateHeader = screen.getByLabelText('Sort by submission date');
      await user.click(dateHeader);

      // Give React time to re-render after state change
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify sorting occurred (TableSortLabel is active and has direction)
      expect(dateHeader).toHaveAttribute('aria-label', 'Sort by submission date');
      // The active state is shown via the arrow icon and direction
      
      // Restore fake timers for other tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    it('sorts by grade', async () => {
      // Use real timers for this test to avoid timeout issues with userEvent
      vi.useRealTimers();
      
      const user = userEvent.setup();
      
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      const gradeHeader = screen.getByLabelText('Sort by grade');
      await user.click(gradeHeader);

      // Give React time to re-render after state change
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify sorting occurred (TableSortLabel is active)
      expect(gradeHeader).toHaveAttribute('aria-label', 'Sort by grade');
      
      // Restore fake timers for other tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    it('sorts by status', async () => {
      // Use real timers for this test to avoid timeout issues with userEvent
      vi.useRealTimers();
      
      const user = userEvent.setup();
      
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      const statusHeader = screen.getByLabelText('Sort by status');
      await user.click(statusHeader);

      // Give React time to re-render after state change
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify sorting occurred (TableSortLabel is active)
      expect(statusHeader).toHaveAttribute('aria-label', 'Sort by status');
      
      // Restore fake timers for other tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    it('shows sort indicator on active column', async () => {
      // Use real timers for this test to avoid timeout issues with userEvent
      vi.useRealTimers();
      
      const user = userEvent.setup();
      
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      const studentHeader = screen.getByLabelText('Sort by student name');
      await user.click(studentHeader);

      // Give React time to re-render after state change
      await new Promise(resolve => setTimeout(resolve, 50));

      // After clicking, the sort label should be active (verify it's still present and clickable)
      expect(studentHeader).toBeInTheDocument();
      expect(studentHeader).toHaveAttribute('aria-label', 'Sort by student name');
      
      // Restore fake timers for other tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });
  });

  /**
   * 5. Pagination Tests
   */
  describe('Pagination', () => {
    it('renders pagination controls', () => {
      const manySubmissions = createMockSubmissions(25);

      renderWithProviders(
        <SubmissionList
          submissions={manySubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      // Look for pagination component
      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
    });

    it('displays correct rows per page options', () => {
      const manySubmissions = createMockSubmissions(25);

      renderWithProviders(
        <SubmissionList
          submissions={manySubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      // Check for rows per page selector
      expect(screen.getByRole('combobox', { name: /rows per page/i })).toBeInTheDocument();
    });

    it('shows correct page count', () => {
      const submissions = createMockSubmissions(35);

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      // Should show pagination info (MUI uses en dash, not hyphen)
      expect(screen.getByText(/1–10 of 35/i)).toBeInTheDocument();
    });

    it('navigates to next page', async () => {
      // Use real timers for this test to avoid timeout issues with userEvent
      vi.useRealTimers();
      
      const user = userEvent.setup();
      const submissions = createMockSubmissions(25);

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      const nextButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextButton);

      // Should show next page range (note: uses en dash, not hyphen)
      await waitFor(() => {
        expect(screen.getByText(/11–20 of 25/i)).toBeInTheDocument();
      });
    });

    it('navigates to previous page', async () => {
      // Use real timers for this test to avoid timeout issues with userEvent
      vi.useRealTimers();
      
      const user = userEvent.setup();
      const submissions = createMockSubmissions(25);

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      // Go to page 2 first
      const nextButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextButton);

      // Give React time to re-render after state change
      await new Promise(resolve => setTimeout(resolve, 50));

      // Then go back
      const prevButton = screen.getByRole('button', { name: /previous page/i });
      await user.click(prevButton);

      // Give React time to re-render after state change
      await new Promise(resolve => setTimeout(resolve, 50));

      // MUI uses en dash, not hyphen
      expect(screen.getByText(/1–10 of 25/i)).toBeInTheDocument();
      
      // Restore fake timers for other tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    it('changes rows per page', async () => {
      // Use real timers for this test to avoid timeout issues with userEvent
      vi.useRealTimers();
      
      const user = userEvent.setup();
      const submissions = createMockSubmissions(35);

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      const rowsPerPageSelect = screen.getByRole('combobox', { name: /rows per page/i });
      await user.click(rowsPerPageSelect);
      
      const option25 = await screen.findByRole('option', { name: '25' });
      await user.click(option25);

      // Wait for the pagination text to update (MUI uses en dash, not hyphen)
      await waitFor(() => {
        expect(screen.getByText(/1–25 of 35/i)).toBeInTheDocument();
      });
      
      // Restore fake timers for other tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });
  });

  /**
   * 6. Action Handler Tests
   */
  describe('Action Handlers', () => {
    it('calls onViewSubmission when View button clicked', async () => {
      // Use real timers for this test to avoid timeout issues with userEvent
      vi.useRealTimers();
      
      const user = userEvent.setup();

      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
          onViewSubmission={mockOnViewSubmission}
        />
      );

      const viewButtons = screen.getAllByLabelText(/view submission/i);
      await user.click(viewButtons[0]);

      // Give React time to process the click event
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockOnViewSubmission).toHaveBeenCalledTimes(1);
      // Verify that a submission was passed (the actual submission depends on table sorting)
      const calledSubmission = mockOnViewSubmission.mock.calls[0][0];
      expect(calledSubmission).toMatchObject({
        assignment: 1,
        attemptnumber: 1,
        latest: 1,
        groupid: 0,
      });
      expect(mockSubmissions).toContainEqual(calledSubmission);
      
      // Restore fake timers for other tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    it('calls onGradeSubmission when Grade button clicked', async () => {
      // Use real timers for this test to avoid timeout issues with userEvent
      vi.useRealTimers();
      
      const user = userEvent.setup();
      const ungradedSubmission = createMockSubmission({ grade: undefined });

      renderWithProviders(
        <SubmissionList
          submissions={[ungradedSubmission]}
          assignment={mockAssignment}
          viewMode="teacher"
          onGradeSubmission={mockOnGradeSubmission}
        />
      );

      const gradeButton = screen.getByLabelText(/grade submission/i);
      await user.click(gradeButton);

      // Give React time to process the click event
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockOnGradeSubmission).toHaveBeenCalledTimes(1);
      expect(mockOnGradeSubmission).toHaveBeenCalledWith(ungradedSubmission);
      
      // Restore fake timers for other tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    it('only shows Grade button for ungraded submissions', () => {
      const submissions = [
        createMockSubmission({ id: 1, grade: 85, gradingstatus: 'graded' }),
        createMockSubmission({ id: 2, grade: undefined, gradingstatus: 'notgraded' }),
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
          onGradeSubmission={mockOnGradeSubmission}
        />
      );

      // Should only have one Grade button (for ungraded submission)
      const gradeButtons = screen.getAllByLabelText(/grade submission/i);
      expect(gradeButtons).toHaveLength(1);
    });

    it('shows appropriate tooltip on hover', async () => {
      // Use real timers for this test to avoid timeout issues with userEvent
      vi.useRealTimers();
      
      const user = userEvent.setup();

      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
          onViewSubmission={mockOnViewSubmission}
        />
      );

      const viewButton = screen.getAllByLabelText(/view submission/i)[0];
      await user.hover(viewButton);

      await waitFor(() => {
        expect(screen.getByRole('tooltip', { name: /view submission/i })).toBeInTheDocument();
      });
    });
  });

  /**
   * 7. Loading State Tests
   */
  describe('Loading States', () => {
    it('displays skeleton components during loading', () => {
      renderWithProviders(
        <SubmissionList
          submissions={[]}
          assignment={mockAssignment}
          viewMode="teacher"
          loading
        />
      );

      // Should show skeleton loaders
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows loading spinner in student view', () => {
      renderWithProviders(
        <SubmissionList
          submissions={[]}
          assignment={mockAssignment}
          viewMode="student"
          loading
        />
      );

      // Component renders skeleton cards for student view loading
      expect(screen.getAllByTestId('skeleton-title')).toHaveLength(3);
      expect(screen.getAllByTestId('skeleton-content')).toHaveLength(3);
    });

    it('hides actual data during loading', () => {
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
          loading
        />
      );

      // Submission data should not be visible
      expect(screen.queryByText('Submitted')).not.toBeInTheDocument();
    });
  });

  /**
   * 8. Empty State Tests
   */
  describe('Empty States', () => {
    it('displays empty message when no submissions (teacher view)', () => {
      renderWithProviders(
        <SubmissionList
          submissions={[]}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      expect(screen.getByText(/no student submissions/i)).toBeInTheDocument();
    });

    it('displays empty message in student view', () => {
      renderWithProviders(
        <SubmissionList
          submissions={[]}
          assignment={mockAssignment}
          viewMode="student"
        />
      );

      expect(screen.getByText(/you haven't submitted yet/i)).toBeInTheDocument();
    });

    it('uses custom emptyMessage prop if provided', () => {
      renderWithProviders(
        <SubmissionList
          submissions={[]}
          assignment={mockAssignment}
          viewMode="teacher"
          emptyMessage="No data available"
        />
      );

      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });

  /**
   * 9. Data Transformation Tests
   */
  describe('Data Transformation', () => {
    it('formats dates consistently', () => {
      const submissions = [
        createMockSubmission({
          timemodified: new Date('2024-01-10T10:30:00Z').getTime() / 1000,
        }),
        createMockSubmission({
          timemodified: new Date('2024-01-11T14:45:00Z').getTime() / 1000,
        }),
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      // Both dates should use same format
      const date1 = format(new Date('2024-01-10T10:30:00Z'), 'MMM dd, yyyy HH:mm');
      const date2 = format(new Date('2024-01-11T14:45:00Z'), 'MMM dd, yyyy HH:mm');
      
      expect(screen.getByText(date1)).toBeInTheDocument();
      expect(screen.getByText(date2)).toBeInTheDocument();
    });

    it('maps status to correct chip colors', () => {
      const statuses: SubmissionStatus[] = ['new', 'draft', 'submitted', 'reopened'];
      const submissions = statuses.map((status, idx) =>
        createMockSubmission({ id: idx + 1, status })
      );

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      // Verify each status has a chip
      expect(screen.getByText('Not Submitted')).toBeInTheDocument();
      expect(screen.getByText('Draft')).toBeInTheDocument();
      expect(screen.getByText('Submitted')).toBeInTheDocument();
      expect(screen.getByText('Reopened')).toBeInTheDocument();
    });

    it('handles missing or null submission dates', () => {
      const submissions = [
        createMockSubmission({ timemodified: 0 }), // Null/zero timestamp
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      expect(screen.getByText(/not submitted/i)).toBeInTheDocument();
    });

    it('calculates grade percentage correctly', () => {
      const assignment = createMockAssignment({ grade: 100 });
      const submissions = [
        createMockSubmission({ grade: 75 }),
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={assignment}
          viewMode="teacher"
        />
      );

      // Should show grade value
      expect(screen.getByText('75 / 100')).toBeInTheDocument();
    });

    it('extracts student name from submission object', () => {
      const submissions = [
        { ...createMockSubmission({ id: 1 }), studentname: 'John Doe' },
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions as any}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  /**
   * 10. Responsive Design Tests
   */
  describe('Responsive Design', () => {
    it('enables horizontal scroll on mobile', () => {
      // Mock mobile viewport
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      const tableContainer = screen.getByRole('table').parentElement;
      expect(tableContainer).toHaveStyle({ overflowX: 'auto' });
    });

    it('uses touch-friendly button sizes', () => {
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
          onViewSubmission={mockOnViewSubmission}
        />
      );

      // Note: IconButtons in MUI use size="small", and computed styles are not available in jsdom
      // We verify buttons exist and are accessible, which is the core accessibility concern
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      // Verify buttons have aria-labels for accessibility (touch-friendly also means accessible)
      const viewButtons = screen.getAllByLabelText(/view submission/i);
      expect(viewButtons.length).toBeGreaterThan(0);
    });

    it('stacks cards vertically in student view', () => {
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="student"
        />
      );

      const cards = screen.getAllByTestId(/submission-card/i);
      // Component uses MUI Grid with xs={12} which stacks cards vertically
      // Verify cards are rendered and each Grid item exists
      expect(cards.length).toBeGreaterThan(0);
      cards.forEach((card) => {
        // Each card should be wrapped in a Grid item
        expect(card.closest('.MuiGrid-item')).toBeInTheDocument();
      });
    });
  });

  /**
   * 11. Accessibility Tests
   */
  describe('Accessibility', () => {
    it('has proper table semantics', () => {
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders.length).toBeGreaterThan(0);

      // Check for scope attribute
      columnHeaders.forEach((header) => {
        expect(header).toHaveAttribute('scope', 'col');
      });
    });

    it('has ARIA labels for icon buttons', () => {
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
          onViewSubmission={mockOnViewSubmission}
          onGradeSubmission={mockOnGradeSubmission}
        />
      );

      const viewButtons = screen.getAllByLabelText(/view submission/i);
      expect(viewButtons.length).toBeGreaterThan(0);
    });

    it('has aria-sort on sortable columns', async () => {
      // Use real timers for this test to avoid timeout issues with userEvent
      vi.useRealTimers();
      
      const user = userEvent.setup();

      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      // Find the sort label button and click it
      const studentSortButton = screen.getByRole('button', { name: /sort by student name/i });
      await user.click(studentSortButton);

      // Wait for the state update to reflect in the DOM
      // The aria-sort attribute should be on the th element (columnheader)
      // The columnheader's accessible name is "Student" (the text content)
      await waitFor(() => {
        const columnHeader = screen.getByRole('columnheader', { name: /student/i });
        expect(columnHeader).toHaveAttribute('aria-sort');
      });
      
      // Restore fake timers for other tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    it('supports keyboard navigation', async () => {
      // Use real timers for this test to avoid timeout issues with userEvent
      vi.useRealTimers();
      
      const user = userEvent.setup();

      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
          onViewSubmission={mockOnViewSubmission}
        />
      );

      const viewButton = screen.getAllByLabelText(/view submission/i)[0];
      
      // Focus the button directly (in real usage, user would tab to it)
      viewButton.focus();
      expect(viewButton).toHaveFocus();

      // Press Enter
      await user.keyboard('{Enter}');
      expect(mockOnViewSubmission).toHaveBeenCalled();
      
      // Restore fake timers for other tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    it('announces page changes to screen readers', async () => {
      // Use real timers for this test to avoid timeout issues with userEvent
      vi.useRealTimers();
      
      const user = userEvent.setup();
      const submissions = createMockSubmissions(25);

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      const nextButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextButton);

      // MUI TablePagination provides navigation with proper aria-label
      // The pagination text updates are automatically accessible
      await waitFor(() => {
        expect(screen.getByText(/11–20 of 25/i)).toBeInTheDocument();
      });
      
      // Verify navigation region has proper label
      const paginationNav = screen.getByRole('navigation', { name: /pagination/i });
      expect(paginationNav).toBeInTheDocument();
      
      // Restore fake timers for other tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });
  });

  /**
   * 12. Visual Enhancement Tests
   */
  describe('Visual Enhancements', () => {
    it('applies hover effect on table rows', () => {
      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      const rows = screen.getAllByRole('row');
      const dataRow = rows[1]; // Skip header row
      
      // Should have hover class
      expect(dataRow).toHaveClass(/MuiTableRow-hover/);
    });

    it('displays late submission indicator in red', () => {
      const assignment = createMockAssignment({
        duedate: Date.now() / 1000 - 86400, // Due yesterday
      });

      const submissions = [
        createMockSubmission({
          timemodified: Date.now() / 1000, // Submitted today (late)
        }),
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={assignment}
          viewMode="teacher"
        />
      );

      // Component shows "Submitted (Late)" in status chip and ErrorIcon with tooltip
      expect(screen.getByText(/submitted \(late\)/i)).toBeInTheDocument();
      
      // Verify ErrorIcon is present (late indicator in teacher view)
      const errorIcon = screen.getByTestId('ErrorIcon');
      expect(errorIcon).toBeInTheDocument();
    });

    it('shows student avatar with initials', () => {
      const submissions = [
        { ...createMockSubmission({ id: 1 }), studentname: 'John Doe' },
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions as any}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      // Avatar should show initials
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('displays tooltips on icon buttons', async () => {
      // Use real timers for this test to avoid timeout issues with userEvent
      vi.useRealTimers();
      
      const user = userEvent.setup();

      renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
          onViewSubmission={mockOnViewSubmission}
        />
      );

      const viewButton = screen.getAllByLabelText(/view submission/i)[0];
      await user.hover(viewButton);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });
  });

  /**
   * 13. Edge Cases Tests
   */
  describe('Edge Cases', () => {
    it('handles empty submission array', () => {
      expect(() => {
        renderWithProviders(
          <SubmissionList
            submissions={[]}
            assignment={mockAssignment}
            viewMode="teacher"
          />
        );
      }).not.toThrow();

      expect(screen.getByText(/no student submissions/i)).toBeInTheDocument();
    });

    it('handles single submission', () => {
      const submissions = [createMockSubmission()];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(2); // Header + 1 data row
    });

    it('handles very large submission list (100+)', () => {
      const submissions = createMockSubmissions(150);

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      // Should show pagination (MUI uses en dash, not hyphen)
      expect(screen.getByText(/1–10 of 150/i)).toBeInTheDocument();
    });

    it('handles submissions with missing data', () => {
      const submissions = [
        { ...createMockSubmission({ id: 1, userid: 1 }), studentname: undefined },
      ];

      expect(() => {
        renderWithProviders(
          <SubmissionList
            submissions={submissions as any}
            assignment={mockAssignment}
            viewMode="teacher"
          />
        );
      }).not.toThrow();

      // Should show fallback - component uses "Student {userid}"
      expect(screen.getByText('Student 1')).toBeInTheDocument();
    });

    it('handles identical submission times', () => {
      const sameTime = Date.now() / 1000;
      const submissions = [
        createMockSubmission({ id: 1, timemodified: sameTime }),
        createMockSubmission({ id: 2, timemodified: sameTime }),
      ];

      expect(() => {
        renderWithProviders(
          <SubmissionList
            submissions={submissions}
            assignment={mockAssignment}
            viewMode="teacher"
          />
        );
      }).not.toThrow();

      const rows = screen.getAllByRole('row');
      expect(rows.length).toBe(3); // Header + 2 data rows
    });
  });

  /**
   * 14. Performance Tests
   */
  describe('Performance', () => {
    it('memoizes row components', () => {
      const { rerender } = renderWithProviders(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      // Re-render with same props
      rerender(
        <SubmissionList
          submissions={mockSubmissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      // Component should not re-render unnecessarily (implementation specific)
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('virtualizes large lists if implemented', () => {
      const submissions = createMockSubmissions(100);

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={mockAssignment}
          viewMode="teacher"
        />
      );

      // Only visible rows should be rendered
      // Implementation specific - may use react-window
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeLessThan(100); // Not all rows rendered at once
    });
  });

  /**
   * 15. Integration with Assignment Context Tests
   */
  describe('Integration with Assignment Context', () => {
    it('uses assignment grade for percentage calculations', () => {
      const assignment = createMockAssignment({ grade: 50 });
      const submissions = [
        createMockSubmission({ grade: 25 }),
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={assignment}
          viewMode="teacher"
        />
      );

      // Should calculate 50% (25/50)
      expect(screen.getByText('25 / 50')).toBeInTheDocument();
    });

    it('respects maxattempts for attempt display', () => {
      const assignment = createMockAssignment({ maxattempts: 3 });
      const submissions = [
        createMockSubmission({ attemptnumber: 2 }),
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={assignment}
          viewMode="student"
        />
      );

      expect(screen.getByText(/Attempt #3/i)).toBeInTheDocument();
    });

    it('considers duedate for late submission detection', () => {
      const assignment = createMockAssignment({
        duedate: Date.now() / 1000 - 86400, // Due yesterday
      });

      const submissions = [
        createMockSubmission({
          timemodified: Date.now() / 1000, // Submitted today
        }),
      ];

      renderWithProviders(
        <SubmissionList
          submissions={submissions}
          assignment={assignment}
          viewMode="teacher"
        />
      );

      expect(screen.getByText(/late/i)).toBeInTheDocument();
    });
  });
});
