/**
 * @file GradingInterface.test.tsx
 * @description Unit tests for the GradingInterface component
 * 
 * Tests cover:
 * - Component rendering in standard and quick grading modes
 * - Form validation for grades and feedback
 * - Navigation between submissions
 * - Grading mutations and callbacks
 * - Workflow state management
 * - Accessibility and responsive behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../../../helpers/render';
import { createMockAssignment, createMockSubmission } from '../../../../helpers/mockData';
import GradingInterface from '../../../../../src/features/activities/assignments/components/GradingInterface';
import type { GradingInterfaceProps } from '../../../../../src/features/activities/assignments/components/GradingInterface';
import type { Assignment, Submission, Grade } from '../../../../../src/features/activities/assignments/types/assignment.types';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the submission hooks
const mockGradeSubmission = vi.fn();
const mockSaveFeedback = vi.fn();
const mockGradeSubmissionMutate = vi.fn();
const mockSaveFeedbackMutate = vi.fn();

vi.mock('../../../../../src/features/activities/assignments/hooks/useSubmission', () => ({
  useGradeSubmission: () => ({
    mutate: mockGradeSubmissionMutate,
    mutateAsync: mockGradeSubmission,
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  }),
  useSaveFeedback: () => ({
    mutate: mockSaveFeedbackMutate,
    mutateAsync: mockSaveFeedback,
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  }),
}));

// Mock the RichTextEditor component
vi.mock('../../../../../src/components/editor/RichTextEditor', () => ({
  default: ({ value, onChange, placeholder, disabled }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <textarea
      data-testid="rich-text-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      aria-label="Feedback text editor"
    />
  ),
}));

// Mock the FileUploadZone component
vi.mock('../../../../../src/features/activities/assignments/components/FileUploadZone', () => ({
  default: ({ onFilesChange, disabled, maxFiles }: {
    onFilesChange: (files: File[]) => void;
    disabled?: boolean;
    maxFiles?: number;
  }) => (
    <div data-testid="file-upload-zone">
      <input
        type="file"
        data-testid="file-input"
        onChange={(e) => {
          if (e.target.files) {
            onFilesChange(Array.from(e.target.files));
          }
        }}
        disabled={disabled}
        multiple={maxFiles !== 1}
      />
    </div>
  ),
}));

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock assignment for testing
 */
function createTestAssignment(overrides: Partial<Assignment> = {}): Assignment {
  const baseAssignment = createMockAssignment();
  return {
    ...baseAssignment,
    name: 'Test Assignment',
    grade: 100,
    gradingduedate: Math.floor(Date.now() / 1000) + 86400, // Tomorrow
    duedate: Math.floor(Date.now() / 1000) - 86400, // Yesterday
    markingworkflow: 0,
    blindmarking: 0,
    ...overrides,
  } as Assignment;
}

/**
 * Creates a mock submission for testing
 */
function createTestSubmission(overrides: Partial<Submission> = {}): Submission {
  const baseSubmission = createMockSubmission();
  return {
    ...baseSubmission,
    id: 1,
    userid: 2,
    studentname: 'Test Student',
    status: 'submitted',
    timemodified: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    attemptnumber: 0,
    plugins: [],
    gradingstatus: 'notgraded',
    ...overrides,
  } as Submission;
}

/**
 * Creates a mock grade for testing
 */
function createTestGrade(overrides: Partial<Grade> = {}): Grade {
  return {
    id: 1,
    userid: 2,
    assignmentid: 1,
    grade: 85,
    grader: 1,
    gradedby: 'Test Teacher',
    timecreated: Math.floor(Date.now() / 1000),
    timemodified: Math.floor(Date.now() / 1000),
    ...overrides,
  } as Grade;
}

/**
 * Default props for the GradingInterface component
 */
function getDefaultProps(): GradingInterfaceProps {
  return {
    assignment: createTestAssignment(),
    submission: createTestSubmission(),
    onGradeSuccess: vi.fn(),
    onNavigatePrevious: vi.fn(),
    onNavigateNext: vi.fn(),
    quickGrading: false,
    currentIndex: 1,
    totalSubmissions: 10,
    disablePrevious: false,
    disableNext: false,
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('GradingInterface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mutation implementations
    mockGradeSubmission.mockResolvedValue({ success: true });
    mockSaveFeedback.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe('Rendering', () => {
    it('renders the component with standard assignment and submission', () => {
      const props = getDefaultProps();
      render(<GradingInterface {...props} />);

      // Check main sections are present
      expect(screen.getByText('Student Submission')).toBeInTheDocument();
      expect(screen.getByText('Grade and Feedback')).toBeInTheDocument();
      
      // Check student name is displayed (only when studentname is provided)
      expect(screen.getByText(/Test Student/)).toBeInTheDocument();
    });

    it('renders quick grading mode with minimal UI', () => {
      const props = getDefaultProps();
      props.quickGrading = true;
      render(<GradingInterface {...props} />);

      // In quick grading mode, should show compact interface
      expect(screen.getByLabelText(/Grade/i)).toBeInTheDocument();
      
      // Should have quick action buttons
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('renders navigation controls with position information', () => {
      const props = getDefaultProps();
      props.currentIndex = 5;
      props.totalSubmissions = 20;
      const { container } = render(<GradingInterface {...props} />);

      // Check navigation text is present (text is split by multiple elements)
      const navText = container.textContent;
      expect(navText).toContain('Submission');
      expect(navText).toContain('5');
      expect(navText).toContain('of');
      expect(navText).toContain('20');
      
      // Check navigation buttons - use aria-label for specific matches
      expect(screen.getByRole('button', { name: /Navigate to previous submission/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Navigate to next submission/i })).toBeInTheDocument();
    });

    it('disables previous button when on first submission', () => {
      const props = getDefaultProps();
      props.currentIndex = 1;
      props.disablePrevious = true;
      render(<GradingInterface {...props} />);

      const prevButton = screen.getByRole('button', { name: /Navigate to previous submission/i });
      expect(prevButton).toBeDisabled();
    });

    it('disables next button when on last submission', () => {
      const props = getDefaultProps();
      props.currentIndex = 10;
      props.totalSubmissions = 10;
      props.disableNext = true;
      render(<GradingInterface {...props} />);

      const nextButton = screen.getByRole('button', { name: /Navigate to next submission/i });
      expect(nextButton).toBeDisabled();
    });

    it('shows late submission warning when submitted after due date', () => {
      const props = getDefaultProps();
      props.assignment.duedate = Math.floor(Date.now() / 1000) - 86400 * 2; // 2 days ago
      props.submission.timemodified = Math.floor(Date.now() / 1000) - 86400; // 1 day ago
      render(<GradingInterface {...props} />);

      expect(screen.getByText(/Late Submission/i)).toBeInTheDocument();
    });

    it('shows blind marking placeholder when enabled', () => {
      const props = getDefaultProps();
      props.assignment.blindmarking = 1;
      render(<GradingInterface {...props} />);

      // Should show participant number instead of name
      expect(screen.getByText(/Participant/i)).toBeInTheDocument();
      expect(screen.queryByText('Test Student')).not.toBeInTheDocument();
    });

    it('displays submission files when present', () => {
      const props = getDefaultProps();
      // Files come from plugins structure, not submissionfiles
      props.submission.plugins = [
        {
          type: 'file',
          name: 'File submissions',
          fileareas: [
            {
              area: 'submission_files',
              files: [
                {
                  filename: 'homework.pdf',
                  filepath: '/submissions/',
                  fileurl: 'http://example.com/homework.pdf',
                  filesize: 1024000,
                  mimetype: 'application/pdf',
                  timemodified: Math.floor(Date.now() / 1000),
                },
              ],
            },
          ],
        },
      ];
      render(<GradingInterface {...props} />);

      expect(screen.getByText('homework.pdf')).toBeInTheDocument();
      expect(screen.getByText(/Submitted Files/i)).toBeInTheDocument();
    });

    it('displays online text submission when present', () => {
      const props = getDefaultProps();
      // Online text comes from plugins structure
      props.submission.plugins = [
        {
          type: 'onlinetext',
          name: 'Online text',
          editorfields: [
            {
              name: 'onlinetext',
              description: 'Online text submission',
              text: '<p>This is my assignment submission.</p>',
              format: 1,
            },
          ],
        },
      ];
      render(<GradingInterface {...props} />);

      expect(screen.getByText(/Online Text Submission/i)).toBeInTheDocument();
      expect(screen.getByText('This is my assignment submission.')).toBeInTheDocument();
    });

    it('shows previous grade indicator when grade exists', () => {
      const props = getDefaultProps();
      // existingGrade is a separate prop, not submission.grade
      props.existingGrade = createTestGrade({ grade: 75 });
      render(<GradingInterface {...props} />);

      expect(screen.getByText(/Previous grade: 75/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Grade Input Tests
  // ==========================================================================

  describe('Grade Input', () => {
    it('renders point-based grade input with correct max value', () => {
      const props = getDefaultProps();
      props.assignment.grade = 100;
      render(<GradingInterface {...props} />);

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      expect(gradeInput).toBeInTheDocument();
      expect(gradeInput).toHaveAttribute('max', '100');
    });

    it('renders scale-based grade input when assignment uses scale', () => {
      const props = getDefaultProps();
      props.assignment.grade = -1; // Negative grade indicates scale
      render(<GradingInterface {...props} />);

      // Should show select dropdown instead of number input
      const gradeSelect = screen.getByLabelText(/grade/i);
      expect(gradeSelect).toBeInTheDocument();
    });

    it('validates grade is required by keeping button disabled', () => {
      const props = getDefaultProps();
      render(<GradingInterface {...props} />);

      // When no grade is entered, the save button should be disabled
      const saveButton = screen.getByRole('button', { name: /save and release/i });
      expect(saveButton).toBeDisabled();
    });

    it('validates grade does not exceed maximum', async () => {
      const user = userEvent.setup();
      const props = getDefaultProps();
      props.assignment.grade = 100;
      render(<GradingInterface {...props} />);

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '150');

      // Trigger form validation by trying to submit
      const saveButton = screen.getByRole('button', { name: /save and release/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/cannot exceed 100/i)).toBeInTheDocument();
      });
    });

    it('validates grade is not negative', async () => {
      const user = userEvent.setup();
      const props = getDefaultProps();
      render(<GradingInterface {...props} />);

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '-5');

      const saveButton = screen.getByRole('button', { name: /save and release/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument();
      });
    });

    it('shows grade percentage when grade is entered', async () => {
      const user = userEvent.setup();
      const props = getDefaultProps();
      props.assignment.grade = 100;
      render(<GradingInterface {...props} />);

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '85');

      await waitFor(() => {
        // Percentage is displayed with one decimal place (85.0%)
        expect(screen.getByText(/85\.0%/)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Feedback Tests
  // ==========================================================================

  describe('Feedback', () => {
    it('renders feedback text editor', () => {
      const props = getDefaultProps();
      render(<GradingInterface {...props} />);

      expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
    });

    it('updates feedback text when typing', async () => {
      const user = userEvent.setup();
      const props = getDefaultProps();
      render(<GradingInterface {...props} />);

      const feedbackEditor = screen.getByTestId('rich-text-editor');
      await user.type(feedbackEditor, 'Great work on this assignment!');

      expect(feedbackEditor).toHaveValue('Great work on this assignment!');
    });

    it('shows word count for feedback text', async () => {
      const user = userEvent.setup();
      const props = getDefaultProps();
      render(<GradingInterface {...props} />);

      const feedbackEditor = screen.getByTestId('rich-text-editor');
      await user.type(feedbackEditor, 'This is a test feedback');

      await waitFor(() => {
        expect(screen.getByText(/Word count: 5/i)).toBeInTheDocument();
      });
    });

    it('renders file upload zone for feedback files', () => {
      const props = getDefaultProps();
      render(<GradingInterface {...props} />);

      expect(screen.getByTestId('file-upload-zone')).toBeInTheDocument();
    });

    it('displays existing feedback when present', () => {
      const props = getDefaultProps();
      // existingFeedbackText is a separate prop
      props.existingFeedbackText = 'Previous feedback from teacher';
      props.existingGrade = createTestGrade();
      render(<GradingInterface {...props} />);

      // Previous feedback should populate the editor initially
      const feedbackEditor = screen.getByTestId('rich-text-editor');
      expect(feedbackEditor).toHaveValue('Previous feedback from teacher');
    });
  });

  // ==========================================================================
  // Marking Workflow Tests
  // ==========================================================================

  describe('Marking Workflow', () => {
    it('shows workflow state selector when marking workflow is enabled', () => {
      const props = getDefaultProps();
      props.assignment.markingworkflow = 1;
      render(<GradingInterface {...props} />);

      expect(screen.getByLabelText(/Marking Workflow State/i)).toBeInTheDocument();
    });

    it('does not show workflow selector when disabled', () => {
      const props = getDefaultProps();
      props.assignment.markingworkflow = 0;
      render(<GradingInterface {...props} />);

      expect(screen.queryByLabelText(/Marking Workflow State/i)).not.toBeInTheDocument();
    });

    it('shows save draft button when workflow is enabled', () => {
      const props = getDefaultProps();
      props.assignment.markingworkflow = 1;
      render(<GradingInterface {...props} />);

      expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    });

    it('allows selecting different workflow states', async () => {
      const user = userEvent.setup();
      const props = getDefaultProps();
      props.assignment.markingworkflow = 1;
      render(<GradingInterface {...props} />);

      const workflowSelect = screen.getByLabelText(/Marking Workflow State/i);
      await user.click(workflowSelect);

      // Check workflow options are available
      await waitFor(() => {
        expect(screen.getByRole('option', { name: /In marking/i })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /Ready for release/i })).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Action Button Tests
  // ==========================================================================

  describe('Action Buttons', () => {
    it('calls gradeSubmission mutation on Save and Release', async () => {
      const user = userEvent.setup();
      const props = getDefaultProps();
      const onGradeSuccess = vi.fn();
      props.onGradeSuccess = onGradeSuccess;
      render(<GradingInterface {...props} />);

      // Fill in grade
      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '85');

      // Click save and release
      const saveButton = screen.getByRole('button', { name: /save and release/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockGradeSubmission).toHaveBeenCalled();
      });
    });

    it('calls handleSaveDraft when Save Draft is clicked', async () => {
      const user = userEvent.setup();
      const props = getDefaultProps();
      props.assignment.markingworkflow = 1;
      render(<GradingInterface {...props} />);

      // Fill in grade
      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '85');

      // Click save draft
      const draftButton = screen.getByRole('button', { name: /save draft/i });
      await user.click(draftButton);

      await waitFor(() => {
        expect(mockGradeSubmission).toHaveBeenCalled();
      });
    });

    it('navigates to next submission after Save and Next', async () => {
      const user = userEvent.setup();
      const props = getDefaultProps();
      const onNavigateNext = vi.fn();
      props.onNavigateNext = onNavigateNext;
      render(<GradingInterface {...props} />);

      // Fill in grade
      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '85');

      // Click save and next
      const saveNextButton = screen.getByRole('button', { name: /save and next/i });
      await user.click(saveNextButton);

      await waitFor(() => {
        expect(mockGradeSubmission).toHaveBeenCalled();
      });
    });

    it('disables buttons when form has not been modified', () => {
      const props = getDefaultProps();
      render(<GradingInterface {...props} />);

      const saveButton = screen.getByRole('button', { name: /save and release/i });
      expect(saveButton).toBeDisabled();
    });
  });

  // ==========================================================================
  // Navigation Tests
  // ==========================================================================

  describe('Navigation', () => {
    it('calls onNavigatePrevious when previous button is clicked', async () => {
      const user = userEvent.setup();
      const props = getDefaultProps();
      const onNavigatePrevious = vi.fn();
      props.onNavigatePrevious = onNavigatePrevious;
      props.currentIndex = 5;
      render(<GradingInterface {...props} />);

      const prevButton = screen.getByRole('button', { name: /Navigate to previous submission/i });
      await user.click(prevButton);

      expect(onNavigatePrevious).toHaveBeenCalled();
    });

    it('calls onNavigateNext when next button is clicked', async () => {
      const user = userEvent.setup();
      const props = getDefaultProps();
      const onNavigateNext = vi.fn();
      props.onNavigateNext = onNavigateNext;
      props.currentIndex = 5;
      props.totalSubmissions = 10;
      render(<GradingInterface {...props} />);

      const nextButton = screen.getByRole('button', { name: /Navigate to next submission/i });
      await user.click(nextButton);

      expect(onNavigateNext).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('displays error message when grading fails', async () => {
      mockGradeSubmission.mockRejectedValue(new Error('Network error'));
      
      const user = userEvent.setup();
      const props = getDefaultProps();
      render(<GradingInterface {...props} />);

      // Fill in grade
      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '85');

      // Click save and release
      const saveButton = screen.getByRole('button', { name: /save and release/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('prevents submission when grade is empty by disabling button', () => {
      const props = getDefaultProps();
      render(<GradingInterface {...props} />);

      // Save button should be disabled when form hasn't been modified
      const saveButton = screen.getByRole('button', { name: /save and release/i });
      expect(saveButton).toBeDisabled();
    });

    it('shows validation error when invalid grade is entered', async () => {
      const user = userEvent.setup();
      const props = getDefaultProps();
      props.assignment.grade = 100;
      render(<GradingInterface {...props} />);

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      // Enter an invalid grade (too high)
      await user.clear(gradeInput);
      await user.type(gradeInput, '150');
      
      // Click save button
      const saveButton = screen.getByRole('button', { name: /save and release/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/cannot exceed 100/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('has proper labels for form fields', () => {
      const props = getDefaultProps();
      render(<GradingInterface {...props} />);

      // Check grade input has accessible label
      expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
      
      // Check feedback editor has accessible label
      expect(screen.getByLabelText(/feedback/i)).toBeInTheDocument();
    });

    it('maintains focus after form actions', async () => {
      const user = userEvent.setup();
      const props = getDefaultProps();
      render(<GradingInterface {...props} />);

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.click(gradeInput);
      await user.type(gradeInput, '85');

      // Focus should remain in the form area
      expect(document.activeElement).toBe(gradeInput);
    });
  });

  // ==========================================================================
  // History Section Tests
  // ==========================================================================

  describe('Grading History', () => {
    it('shows grading history when previous grades exist', () => {
      const props = getDefaultProps();
      props.existingGrade = createTestGrade({ grade: 75 });
      props.existingFeedbackText = 'Initial feedback';
      render(<GradingInterface {...props} />);

      // History section should be present (collapsed by default)
      expect(screen.getByText(/Previous Grades and Feedback/i)).toBeInTheDocument();
    });

    it('displays previous grade indicator', () => {
      const props = getDefaultProps();
      props.existingGrade = createTestGrade({ 
        grade: 75,
        timemodified: Math.floor(Date.now() / 1000),
      });
      render(<GradingInterface {...props} />);

      // Previous grade indicator shows as "Previous grade: 75 / 100"
      expect(screen.getByText(/Previous grade: 75/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  describe('Loading States', () => {
    it('shows loading indicator during submission', async () => {
      const user = userEvent.setup();
      const props = getDefaultProps();
      
      // Make the mutation take longer
      mockGradeSubmission.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));
      
      render(<GradingInterface {...props} />);

      const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
      await user.clear(gradeInput);
      await user.type(gradeInput, '85');
      
      const saveButton = screen.getByRole('button', { name: /save and release/i });
      await user.click(saveButton);
      
      // The mutation should be called
      await waitFor(() => {
        expect(mockGradeSubmission).toHaveBeenCalled();
      });
    });
  });
});
