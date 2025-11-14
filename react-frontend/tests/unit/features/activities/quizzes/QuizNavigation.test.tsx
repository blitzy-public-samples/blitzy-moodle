/**
 * Unit Tests for QuizNavigation Component
 *
 * Comprehensive test suite validating quiz navigation panel functionality including:
 * - Question palette rendering with color-coded status indicators
 * - Navigation interactions (click, keyboard)
 * - Progress tracking and statistics display
 * - Flag toggle functionality
 * - Sequential vs non-sequential navigation modes
 * - Finish attempt workflow with confirmation dialog
 * - Responsive behavior and accessibility
 *
 * @package    react-frontend
 * @subpackage tests/unit/features/activities/quizzes
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type { QuizNavigationProps } from '@/features/activities/quizzes/components/QuizNavigation';
import type { QuestionNavigationState } from '@/features/activities/quizzes/types/quiz.types';

// Import the actual component
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Component exists in implementation
import { QuizNavigation } from '@/features/activities/quizzes/components/QuizNavigation';

/**
 * Helper function to create mock question navigation states
 */
function createMockQuestions(count: number): QuestionNavigationState[] {
  return Array.from({ length: count }, (_, index) => ({
    slot: index + 1,
    number: String(index + 1),
    answered: false,
    flagged: false,
    page: Math.floor(index / 5),
    isCurrentQuestion: index === 0,
    canNavigate: true,
  }));
}

/**
 * Helper function to create default props for QuizNavigation
 */
function createDefaultProps(overrides?: Partial<QuizNavigationProps>): QuizNavigationProps {
  return {
    questions: createMockQuestions(10),
    currentQuestionIndex: 0,
    onQuestionClick: vi.fn(),
    onFlagToggle: vi.fn(),
    onFinishAttempt: vi.fn(),
    navigationMode: 'free',
    isSequential: false,
    ...overrides,
  };
}

describe('QuizNavigation Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Question Palette Rendering', () => {
    it('should render all question buttons in a grid layout', () => {
      const props = createDefaultProps();
      render(<QuizNavigation {...props} />);

      // Verify all 10 questions are rendered
      props.questions.forEach((question) => {
        const button = screen.getByRole('button', {
          name: new RegExp(`Navigate to question ${question.number}`, 'i'),
        });
        expect(button).toBeInTheDocument();
        expect(button).toHaveTextContent(question.number);
      });
    });

    it('should render question numbers correctly', () => {
      const props = createDefaultProps();
      render(<QuizNavigation {...props} />);

      // Check that buttons display correct question numbers
      for (let i = 1; i <= 10; i++) {
        expect(screen.getByText(String(i))).toBeInTheDocument();
      }
    });

    it('should render grid container for question palette', () => {
      const props = createDefaultProps();
      const { container } = render(<QuizNavigation {...props} />);

      // Verify Grid container exists
      const gridContainer = container.querySelector('.MuiGrid-container');
      expect(gridContainer).toBeInTheDocument();
    });

    it('should handle single question correctly', () => {
      const props = createDefaultProps({ questions: createMockQuestions(1) });
      render(<QuizNavigation {...props} />);

      const button = screen.getByRole('button', { name: /Navigate to question 1/i });
      expect(button).toBeInTheDocument();
    });

    it('should handle 100 questions correctly', () => {
      const props = createDefaultProps({ questions: createMockQuestions(100) });
      render(<QuizNavigation {...props} />);

      // Verify first, middle, and last questions
      expect(screen.getByRole('button', { name: /Navigate to question 1\b/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Navigate to question 50\b/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Navigate to question 100\b/i })).toBeInTheDocument();
    });
  });

  describe('Color Coding and Visual States', () => {
    it('should apply primary color to current question button', () => {
      const props = createDefaultProps({ currentQuestionIndex: 2 });
      const { container } = render(<QuizNavigation {...props} />);

      const currentButton = container.querySelector('[data-question-index="2"]');
      expect(currentButton).toHaveClass('MuiButton-containedPrimary');
    });

    it('should apply success color to answered questions', () => {
      const questions = createMockQuestions(10);
      questions[0].answered = true;
      questions[0].isCurrentQuestion = false;
      questions[3].answered = true;
      questions[3].isCurrentQuestion = false;

      const props = createDefaultProps({ questions, currentQuestionIndex: 1 });
      const { container } = render(<QuizNavigation {...props} />);

      const answeredButton1 = container.querySelector('[data-question-index="0"]');
      const answeredButton2 = container.querySelector('[data-question-index="3"]');

      expect(answeredButton1).toHaveClass('MuiButton-outlinedSuccess');
      expect(answeredButton2).toHaveClass('MuiButton-outlinedSuccess');
    });

    it('should apply warning color to flagged questions', () => {
      const questions = createMockQuestions(10);
      questions[2].flagged = true;
      questions[2].isCurrentQuestion = false;

      const props = createDefaultProps({ questions, currentQuestionIndex: 0 });
      const { container } = render(<QuizNavigation {...props} />);

      const flaggedButton = container.querySelector('[data-question-index="2"]');
      expect(flaggedButton).toHaveClass('MuiButton-outlinedWarning');
    });

    it('should prioritize current question color over answered color', () => {
      const questions = createMockQuestions(10);
      questions[2].answered = true;
      questions[2].isCurrentQuestion = false;

      const props = createDefaultProps({ questions, currentQuestionIndex: 2 });
      const { container } = render(<QuizNavigation {...props} />);

      const currentButton = container.querySelector('[data-question-index="2"]');
      // Current question should be blue (primary), not green (success)
      expect(currentButton).toHaveClass('MuiButton-containedPrimary');
      expect(currentButton).not.toHaveClass('MuiButton-success');
    });

    it('should prioritize answered color over flagged color', () => {
      const questions = createMockQuestions(10);
      questions[3].answered = true;
      questions[3].flagged = true;
      questions[3].isCurrentQuestion = false;

      const props = createDefaultProps({ questions, currentQuestionIndex: 0 });
      const { container } = render(<QuizNavigation {...props} />);

      const button = container.querySelector('[data-question-index="3"]');
      // Answered takes priority over flagged
      expect(button).toHaveClass('MuiButton-outlinedSuccess');
    });

    it('should apply default color to unanswered, unflagged questions', () => {
      const questions = createMockQuestions(10);
      questions[5].answered = false;
      questions[5].flagged = false;
      questions[5].isCurrentQuestion = false;

      const props = createDefaultProps({ questions, currentQuestionIndex: 0 });
      const { container } = render(<QuizNavigation {...props} />);

      const button = container.querySelector('[data-question-index="5"]');
      expect(button).toHaveClass('MuiButton-outlined');
      expect(button).toHaveClass('MuiButton-colorInherit');
    });

    it('should display check icon on answered questions', () => {
      const questions = createMockQuestions(10);
      questions[4].answered = true;

      const props = createDefaultProps({ questions });
      const { container } = render(<QuizNavigation {...props} />);

      // Check for CheckCircleIcon within the button
      const button = container.querySelector('[data-question-index="4"]');
      const checkIcon = button?.querySelector('.MuiSvgIcon-root');
      expect(checkIcon).toBeInTheDocument();
    });

    it('should handle all questions flagged edge case', () => {
      const questions = createMockQuestions(10);
      questions.forEach((q, index) => {
        q.flagged = true;
        q.isCurrentQuestion = false;
      });

      const props = createDefaultProps({ questions, currentQuestionIndex: 0 });
      render(<QuizNavigation {...props} />);

      // Current question should still be primary colored
      const { container } = render(<QuizNavigation {...props} />);
      const currentButton = container.querySelector('[data-question-index="0"]');
      expect(currentButton).toHaveClass('MuiButton-containedPrimary');
    });
  });

  describe('Click Navigation', () => {
    it('should call onQuestionClick with correct index when button clicked', async () => {
      const user = userEvent.setup();
      const mockOnQuestionClick = vi.fn();
      const props = createDefaultProps({ onQuestionClick: mockOnQuestionClick });

      render(<QuizNavigation {...props} />);

      const questionButton = screen.getByRole('button', { name: /Navigate to question 5/i });
      await user.click(questionButton);

      expect(mockOnQuestionClick).toHaveBeenCalledWith(4); // 0-based index
      expect(mockOnQuestionClick).toHaveBeenCalledTimes(1);
    });

    it('should allow navigation to any question in free mode', async () => {
      const user = userEvent.setup();
      const mockOnQuestionClick = vi.fn();
      const props = createDefaultProps({
        onQuestionClick: mockOnQuestionClick,
        navigationMode: 'free',
        isSequential: false,
      });

      render(<QuizNavigation {...props} />);

      // Click on various questions
      await user.click(screen.getByRole('button', { name: /Navigate to question 1\b/i }));
      await user.click(screen.getByRole('button', { name: /Navigate to question 10\b/i }));
      await user.click(screen.getByRole('button', { name: /Navigate to question 5/i }));

      expect(mockOnQuestionClick).toHaveBeenNthCalledWith(1, 0);
      expect(mockOnQuestionClick).toHaveBeenNthCalledWith(2, 9);
      expect(mockOnQuestionClick).toHaveBeenNthCalledWith(3, 4);
    });

    it('should not call onQuestionClick for disabled buttons', async () => {
      const user = userEvent.setup();
      const mockOnQuestionClick = vi.fn();
      const questions = createMockQuestions(10);
      questions[7].canNavigate = false;

      const props = createDefaultProps({
        questions,
        onQuestionClick: mockOnQuestionClick,
        navigationMode: 'seq',
        isSequential: true,
      });

      render(<QuizNavigation {...props} />);

      const disabledButton = screen.getByRole('button', { name: /Navigate to question 8/i });
      expect(disabledButton).toBeDisabled();

      // Attempt to click disabled button
      await user.click(disabledButton);

      expect(mockOnQuestionClick).not.toHaveBeenCalled();
    });
  });

  describe('Current Question Highlighting', () => {
    it('should highlight the current question with contained variant', () => {
      const props = createDefaultProps({ currentQuestionIndex: 3 });
      const { container } = render(<QuizNavigation {...props} />);

      const currentButton = container.querySelector('[data-question-index="3"]');
      expect(currentButton).toHaveClass('MuiButton-contained');
    });

    it('should apply outlined variant to non-current questions', () => {
      const props = createDefaultProps({ currentQuestionIndex: 3 });
      const { container } = render(<QuizNavigation {...props} />);

      const nonCurrentButton = container.querySelector('[data-question-index="5"]');
      expect(nonCurrentButton).toHaveClass('MuiButton-outlined');
      expect(nonCurrentButton).not.toHaveClass('MuiButton-contained');
    });

    it('should update highlighting when currentQuestionIndex changes', () => {
      const props = createDefaultProps({ currentQuestionIndex: 2 });
      const { container, rerender } = render(<QuizNavigation {...props} />);

      let currentButton = container.querySelector('[data-question-index="2"]');
      expect(currentButton).toHaveClass('MuiButton-contained');

      // Change current question
      rerender(<QuizNavigation {...props} currentQuestionIndex={5} />);

      const newCurrentButton = container.querySelector('[data-question-index="5"]');
      const previousButton = container.querySelector('[data-question-index="2"]');

      expect(newCurrentButton).toHaveClass('MuiButton-contained');
      expect(previousButton).toHaveClass('MuiButton-outlined');
    });

    it('should apply bold font weight to current question', () => {
      const props = createDefaultProps({ currentQuestionIndex: 4 });
      const { container } = render(<QuizNavigation {...props} />);

      const currentButton = container.querySelector('[data-question-index="4"]') as HTMLElement;
      const styles = window.getComputedStyle(currentButton);

      // Font weight should be 600 for current question
      expect(currentButton).toHaveStyle({ fontWeight: 600 });
    });

    it('should set aria-current attribute on current question', () => {
      const props = createDefaultProps({ currentQuestionIndex: 6 });
      const { container } = render(<QuizNavigation {...props} />);

      const currentButton = container.querySelector('[data-question-index="6"]');
      expect(currentButton).toHaveAttribute('aria-current', 'true');

      const otherButton = container.querySelector('[data-question-index="3"]');
      expect(otherButton).not.toHaveAttribute('aria-current');
    });
  });

  describe('Progress Bar Display', () => {
    it('should render LinearProgress component', () => {
      const props = createDefaultProps();
      const { container } = render(<QuizNavigation {...props} />);

      const progressBar = container.querySelector('.MuiLinearProgress-root');
      expect(progressBar).toBeInTheDocument();
    });

    it('should show 0% progress when no questions answered', () => {
      const questions = createMockQuestions(10);
      questions.forEach((q) => (q.answered = false));

      const props = createDefaultProps({ questions });
      const { container } = render(<QuizNavigation {...props} />);

      const progressBar = container.querySelector('.MuiLinearProgress-bar') as HTMLElement;
      // 0% progress
      expect(progressBar).toHaveStyle({ transform: 'translateX(-100%)' });
    });

    it('should show 50% progress when half questions answered', () => {
      const questions = createMockQuestions(10);
      questions.slice(0, 5).forEach((q) => (q.answered = true));

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      // Check that progress text shows "5 of 10 answered"
      expect(screen.getByText(/5 of 10 answered/i)).toBeInTheDocument();
    });

    it('should show 100% progress when all questions answered', () => {
      const questions = createMockQuestions(10);
      questions.forEach((q) => (q.answered = true));

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      expect(screen.getByText(/10 of 10 answered/i)).toBeInTheDocument();
    });

    it('should update progress bar when answers change', () => {
      const questions = createMockQuestions(10);
      const props = createDefaultProps({ questions });

      const { rerender } = render(<QuizNavigation {...props} />);
      expect(screen.getByText(/0 of 10 answered/i)).toBeInTheDocument();

      // Update to have 3 answered
      questions[0].answered = true;
      questions[1].answered = true;
      questions[2].answered = true;

      rerender(<QuizNavigation {...props} questions={questions} />);
      expect(screen.getByText(/3 of 10 answered/i)).toBeInTheDocument();
    });

    it('should calculate progress percentage correctly', () => {
      const questions = createMockQuestions(15);
      questions.slice(0, 10).forEach((q) => (q.answered = true));

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      // 10 of 15 = 66.67%
      expect(screen.getByText(/10 of 15 answered/i)).toBeInTheDocument();
    });
  });

  describe('Summary Statistics', () => {
    it('should display correct answered count', () => {
      const questions = createMockQuestions(10);
      questions[0].answered = true;
      questions[1].answered = true;
      questions[2].answered = true;

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      expect(screen.getByText(/3 of 10 answered/i)).toBeInTheDocument();
    });

    it('should display flagged count when questions are flagged', () => {
      const questions = createMockQuestions(10);
      questions[3].flagged = true;
      questions[5].flagged = true;

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      expect(screen.getByText(/2 flagged/i)).toBeInTheDocument();
    });

    it('should not display flagged count when no questions flagged', () => {
      const questions = createMockQuestions(10);
      questions.forEach((q) => (q.flagged = false));

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      expect(screen.queryByText(/flagged/i)).not.toBeInTheDocument();
    });

    it('should update statistics when question states change', () => {
      const questions = createMockQuestions(10);
      const props = createDefaultProps({ questions });

      const { rerender } = render(<QuizNavigation {...props} />);

      // Initially 0 answered
      expect(screen.getByText(/0 of 10 answered/i)).toBeInTheDocument();

      // Update to have 5 answered and 2 flagged
      questions[0].answered = true;
      questions[1].answered = true;
      questions[2].answered = true;
      questions[3].answered = true;
      questions[4].answered = true;
      questions[6].flagged = true;
      questions[7].flagged = true;

      rerender(<QuizNavigation {...props} questions={questions} />);

      expect(screen.getByText(/5 of 10 answered/i)).toBeInTheDocument();
      expect(screen.getByText(/2 flagged/i)).toBeInTheDocument();
    });
  });

  describe('Flag Toggle Button', () => {
    it('should render flag button for each question', () => {
      const props = createDefaultProps();
      render(<QuizNavigation {...props} />);

      const flagButtons = screen.getAllByLabelText(/flag for review|remove flag/i);
      expect(flagButtons).toHaveLength(10);
    });

    it('should call onFlagToggle when flag button clicked', async () => {
      const user = userEvent.setup();
      const mockOnFlagToggle = vi.fn();
      const props = createDefaultProps({ onFlagToggle: mockOnFlagToggle });

      render(<QuizNavigation {...props} />);

      const flagButton = screen.getAllByLabelText(/flag for review/i)[2];
      await user.click(flagButton);

      expect(mockOnFlagToggle).toHaveBeenCalledWith(2);
      expect(mockOnFlagToggle).toHaveBeenCalledTimes(1);
    });

    it('should not trigger question navigation when flag button clicked', async () => {
      const user = userEvent.setup();
      const mockOnQuestionClick = vi.fn();
      const mockOnFlagToggle = vi.fn();

      const props = createDefaultProps({
        onQuestionClick: mockOnQuestionClick,
        onFlagToggle: mockOnFlagToggle,
      });

      render(<QuizNavigation {...props} />);

      const flagButton = screen.getAllByLabelText(/flag for review/i)[4];
      await user.click(flagButton);

      expect(mockOnFlagToggle).toHaveBeenCalledWith(4);
      expect(mockOnQuestionClick).not.toHaveBeenCalled();
    });

    it('should show filled flag icon when question is flagged', () => {
      const questions = createMockQuestions(10);
      questions[3].flagged = true;

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      const flagButton = screen.getAllByLabelText(/remove flag/i)[0];
      expect(flagButton).toBeInTheDocument();
    });

    it('should show outlined flag icon when question is not flagged', () => {
      const questions = createMockQuestions(10);
      questions[3].flagged = false;

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      const flagButtons = screen.getAllByLabelText(/flag for review/i);
      expect(flagButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Sequential Navigation Mode', () => {
    it('should allow navigation only to accessible questions in sequential mode', () => {
      const questions = createMockQuestions(10);
      questions[0].canNavigate = true;
      questions[1].canNavigate = true;
      questions[2].canNavigate = true;
      questions[3].canNavigate = false;
      questions[4].canNavigate = false;

      const props = createDefaultProps({
        questions,
        navigationMode: 'seq',
        isSequential: true,
      });

      render(<QuizNavigation {...props} />);

      const accessibleButton = screen.getByRole('button', { name: /Navigate to question 2/i });
      const lockedButton = screen.getByRole('button', { name: /Navigate to question 4/i });

      expect(accessibleButton).not.toBeDisabled();
      expect(lockedButton).toBeDisabled();
    });

    it('should display sequential navigation info message', () => {
      const props = createDefaultProps({
        navigationMode: 'seq',
        isSequential: true,
      });

      render(<QuizNavigation {...props} />);

      expect(screen.getByText(/sequential navigation.*answer questions in order/i)).toBeInTheDocument();
    });

    it('should not display sequential info in free navigation mode', () => {
      const props = createDefaultProps({
        navigationMode: 'free',
        isSequential: false,
      });

      render(<QuizNavigation {...props} />);

      expect(screen.queryByText(/sequential navigation/i)).not.toBeInTheDocument();
    });
  });

  describe('Non-Sequential Navigation Mode', () => {
    it('should allow navigation to all questions in free mode', () => {
      const props = createDefaultProps({
        navigationMode: 'free',
        isSequential: false,
      });

      render(<QuizNavigation {...props} />);

      // All buttons should be enabled
      props.questions.forEach((question) => {
        const button = screen.getByRole('button', {
          name: new RegExp(`Navigate to question ${question.number}`, 'i'),
        });
        expect(button).not.toBeDisabled();
      });
    });

    it('should allow jumping to any question in free mode', async () => {
      const user = userEvent.setup();
      const mockOnQuestionClick = vi.fn();

      const props = createDefaultProps({
        onQuestionClick: mockOnQuestionClick,
        navigationMode: 'free',
        isSequential: false,
        currentQuestionIndex: 2,
      });

      render(<QuizNavigation {...props} />);

      // Jump from question 3 to question 8
      await user.click(screen.getByRole('button', { name: /Navigate to question 8/i }));

      expect(mockOnQuestionClick).toHaveBeenCalledWith(7);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate to next question with ArrowRight key', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      render(<QuizNavigation {...props} />);

      const firstButton = screen.getByRole('button', { name: /Navigate to question 1\b/i });
      firstButton.focus();

      await user.keyboard('{ArrowRight}');

      const secondButton = screen.getByRole('button', { name: /Navigate to question 2/i });
      expect(secondButton).toHaveFocus();
    });

    it('should navigate to next question with ArrowDown key', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      render(<QuizNavigation {...props} />);

      const firstButton = screen.getByRole('button', { name: /Navigate to question 1\b/i });
      firstButton.focus();

      await user.keyboard('{ArrowDown}');

      const secondButton = screen.getByRole('button', { name: /Navigate to question 2/i });
      expect(secondButton).toHaveFocus();
    });

    it('should navigate to previous question with ArrowLeft key', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      render(<QuizNavigation {...props} />);

      const thirdButton = screen.getByRole('button', { name: /Navigate to question 3/i });
      thirdButton.focus();

      await user.keyboard('{ArrowLeft}');

      const secondButton = screen.getByRole('button', { name: /Navigate to question 2/i });
      expect(secondButton).toHaveFocus();
    });

    it('should navigate to previous question with ArrowUp key', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      render(<QuizNavigation {...props} />);

      const thirdButton = screen.getByRole('button', { name: /Navigate to question 3/i });
      thirdButton.focus();

      await user.keyboard('{ArrowUp}');

      const secondButton = screen.getByRole('button', { name: /Navigate to question 2/i });
      expect(secondButton).toHaveFocus();
    });

    it('should select question with Enter key', async () => {
      const user = userEvent.setup();
      const mockOnQuestionClick = vi.fn();
      const props = createDefaultProps({ onQuestionClick: mockOnQuestionClick });

      render(<QuizNavigation {...props} />);

      const fourthButton = screen.getByRole('button', { name: /Navigate to question 4/i });
      fourthButton.focus();

      await user.keyboard('{Enter}');

      expect(mockOnQuestionClick).toHaveBeenCalledWith(3);
    });

    it('should not navigate beyond first question with ArrowLeft', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      render(<QuizNavigation {...props} />);

      const firstButton = screen.getByRole('button', { name: /Navigate to question 1\b/i });
      firstButton.focus();

      await user.keyboard('{ArrowLeft}');

      // Should still be on first button
      expect(firstButton).toHaveFocus();
    });

    it('should not navigate beyond last question with ArrowRight', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      render(<QuizNavigation {...props} />);

      const lastButton = screen.getByRole('button', { name: /Navigate to question 10\b/i });
      lastButton.focus();

      await user.keyboard('{ArrowRight}');

      // Should still be on last button
      expect(lastButton).toHaveFocus();
    });
  });

  describe('Tooltips', () => {
    it('should display tooltip on hover with question status', async () => {
      const user = userEvent.setup();
      const questions = createMockQuestions(10);
      questions[2].answered = true;

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      const questionButton = screen.getByRole('button', { name: /Navigate to question 3/i });

      await user.hover(questionButton);

      await waitFor(() => {
        expect(screen.getByText(/Question 3.*Answered/i)).toBeInTheDocument();
      });
    });

    it('should show "Not answered" status in tooltip for unanswered questions', async () => {
      const user = userEvent.setup();
      const questions = createMockQuestions(10);
      questions[4].answered = false;

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      const questionButton = screen.getByRole('button', { name: /Navigate to question 5/i });

      await user.hover(questionButton);

      await waitFor(() => {
        expect(screen.getByText(/Question 5.*Not answered/i)).toBeInTheDocument();
      });
    });

    it('should show "Flagged for review" status in tooltip for flagged questions', async () => {
      const user = userEvent.setup();
      const questions = createMockQuestions(10);
      questions[6].flagged = true;

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      const questionButton = screen.getByRole('button', { name: /Navigate to question 7/i });

      await user.hover(questionButton);

      await waitFor(() => {
        expect(screen.getByText(/Question 7.*Flagged for review/i)).toBeInTheDocument();
      });
    });
  });

  describe('Finish Attempt Button', () => {
    it('should render finish attempt button', () => {
      const props = createDefaultProps();
      render(<QuizNavigation {...props} />);

      const finishButton = screen.getByRole('button', { name: /finish.*attempt/i });
      expect(finishButton).toBeInTheDocument();
    });

    it('should open confirmation modal when finish button clicked', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      render(<QuizNavigation {...props} />);

      const finishButton = screen.getByRole('button', { name: /finish.*attempt/i });
      await user.click(finishButton);

      await waitFor(() => {
        expect(screen.getByText(/Finish Quiz Attempt\?/i)).toBeInTheDocument();
      });
    });

    it('should display current progress in confirmation modal', async () => {
      const user = userEvent.setup();
      const questions = createMockQuestions(10);
      questions[0].answered = true;
      questions[1].answered = true;
      questions[2].answered = true;

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      const finishButton = screen.getByRole('button', { name: /finish.*attempt/i });
      await user.click(finishButton);

      await waitFor(() => {
        expect(screen.getByText(/3 of 10 questions answered/i)).toBeInTheDocument();
      });
    });

    it('should show warning when not all questions answered', async () => {
      const user = userEvent.setup();
      const questions = createMockQuestions(10);
      questions[0].answered = true;

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      const finishButton = screen.getByRole('button', { name: /finish.*attempt/i });
      await user.click(finishButton);

      await waitFor(() => {
        expect(screen.getByText(/not answered all questions/i)).toBeInTheDocument();
      });
    });

    it('should call onFinishAttempt when confirmed', async () => {
      const user = userEvent.setup();
      const mockOnFinishAttempt = vi.fn();
      const props = createDefaultProps({ onFinishAttempt: mockOnFinishAttempt });

      render(<QuizNavigation {...props} />);

      const finishButton = screen.getByRole('button', { name: /finish.*attempt/i });
      await user.click(finishButton);

      await waitFor(() => {
        expect(screen.getByText(/Finish Quiz Attempt\?/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /^Finish Attempt$/i });
      await user.click(confirmButton);

      expect(mockOnFinishAttempt).toHaveBeenCalledTimes(1);
    });

    it('should close modal when cancelled', async () => {
      const user = userEvent.setup();
      const mockOnFinishAttempt = vi.fn();
      const props = createDefaultProps({ onFinishAttempt: mockOnFinishAttempt });

      render(<QuizNavigation {...props} />);

      const finishButton = screen.getByRole('button', { name: /finish.*attempt/i });
      await user.click(finishButton);

      await waitFor(() => {
        expect(screen.getByText(/Finish Quiz Attempt\?/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/Finish Quiz Attempt\?/i)).not.toBeInTheDocument();
      });

      expect(mockOnFinishAttempt).not.toHaveBeenCalled();
    });

    it('should display flagged count in confirmation modal', async () => {
      const user = userEvent.setup();
      const questions = createMockQuestions(10);
      questions[2].flagged = true;
      questions[5].flagged = true;
      questions[7].flagged = true;

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      const finishButton = screen.getByRole('button', { name: /finish.*attempt/i });
      await user.click(finishButton);

      await waitFor(() => {
        expect(screen.getByText(/3 questions? flagged for review/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Layout', () => {
    it('should render with sticky positioning', () => {
      const props = createDefaultProps();
      const { container } = render(<QuizNavigation {...props} />);

      const navContainer = container.querySelector('[class*="MuiBox"]');
      expect(navContainer).toHaveStyle({ position: 'sticky' });
    });

    it('should have proper spacing and padding', () => {
      const props = createDefaultProps();
      const { container } = render(<QuizNavigation {...props} />);

      const navContainer = container.querySelector('[class*="MuiBox"]');
      expect(navContainer).toHaveStyle({ padding: '16px' });
    });
  });

  describe('Legend Display', () => {
    it('should render color legend', () => {
      const props = createDefaultProps();
      render(<QuizNavigation {...props} />);

      expect(screen.getByText(/legend:/i)).toBeInTheDocument();
      expect(screen.getByText(/current question/i)).toBeInTheDocument();
      expect(screen.getByText(/^answered$/i)).toBeInTheDocument();
      expect(screen.getByText(/flagged for review/i)).toBeInTheDocument();
      expect(screen.getByText(/not answered/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty questions array', () => {
      const props = createDefaultProps({ questions: [] });
      render(<QuizNavigation {...props} />);

      expect(screen.getByText(/0 of 0 answered/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /finish.*attempt/i })).toBeInTheDocument();
    });

    it('should handle all questions answered', () => {
      const questions = createMockQuestions(10);
      questions.forEach((q) => (q.answered = true));

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      expect(screen.getByText(/10 of 10 answered/i)).toBeInTheDocument();
    });

    it('should handle rapid question navigation clicks', async () => {
      const user = userEvent.setup();
      const mockOnQuestionClick = vi.fn();
      const props = createDefaultProps({ onQuestionClick: mockOnQuestionClick });

      render(<QuizNavigation {...props} />);

      // Click multiple questions rapidly
      await user.click(screen.getByRole('button', { name: /Navigate to question 2/i }));
      await user.click(screen.getByRole('button', { name: /Navigate to question 5/i }));
      await user.click(screen.getByRole('button', { name: /Navigate to question 8/i }));

      expect(mockOnQuestionClick).toHaveBeenCalledTimes(3);
      expect(mockOnQuestionClick).toHaveBeenNthCalledWith(1, 1);
      expect(mockOnQuestionClick).toHaveBeenNthCalledWith(2, 4);
      expect(mockOnQuestionClick).toHaveBeenNthCalledWith(3, 7);
    });

    it('should handle rapid flag toggle clicks', async () => {
      const user = userEvent.setup();
      const mockOnFlagToggle = vi.fn();
      const props = createDefaultProps({ onFlagToggle: mockOnFlagToggle });

      render(<QuizNavigation {...props} />);

      const flagButtons = screen.getAllByLabelText(/flag for review/i);

      // Toggle flags rapidly
      await user.click(flagButtons[0]);
      await user.click(flagButtons[2]);
      await user.click(flagButtons[4]);

      expect(mockOnFlagToggle).toHaveBeenCalledTimes(3);
      expect(mockOnFlagToggle).toHaveBeenNthCalledWith(1, 0);
      expect(mockOnFlagToggle).toHaveBeenNthCalledWith(2, 2);
      expect(mockOnFlagToggle).toHaveBeenNthCalledWith(3, 4);
    });

    it('should maintain state consistency during re-renders', () => {
      const questions = createMockQuestions(10);
      const props = createDefaultProps({ questions, currentQuestionIndex: 3 });

      const { rerender } = render(<QuizNavigation {...props} />);

      expect(screen.getByText(/0 of 10 answered/i)).toBeInTheDocument();

      // Update some question states
      questions[0].answered = true;
      questions[1].answered = true;
      questions[5].flagged = true;

      rerender(<QuizNavigation {...props} questions={questions} currentQuestionIndex={5} />);

      expect(screen.getByText(/2 of 10 answered/i)).toBeInTheDocument();
      expect(screen.getByText(/1 flagged/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on question buttons', () => {
      const questions = createMockQuestions(5);
      questions[1].answered = true;
      questions[2].flagged = true;

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      expect(screen.getByLabelText(/Navigate to question 1\b/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Navigate to question 2.*answered/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Navigate to question 3.*flagged/i)).toBeInTheDocument();
    });

    it('should have proper ARIA labels on flag buttons', () => {
      const questions = createMockQuestions(5);
      questions[1].flagged = true;

      const props = createDefaultProps({ questions });
      render(<QuizNavigation {...props} />);

      const unflaggedButtons = screen.getAllByLabelText(/flag for review/i);
      expect(unflaggedButtons.length).toBeGreaterThan(0);

      const flaggedButtons = screen.getAllByLabelText(/remove flag/i);
      expect(flaggedButtons.length).toBe(1);
    });

    it('should have proper ARIA label on finish button', () => {
      const props = createDefaultProps();
      render(<QuizNavigation {...props} />);

      expect(screen.getByLabelText(/finish quiz attempt/i)).toBeInTheDocument();
    });
  });

  describe('Title and Headings', () => {
    it('should display Quiz Navigation title', () => {
      const props = createDefaultProps();
      render(<QuizNavigation {...props} />);

      expect(screen.getByText(/^Quiz Navigation$/i)).toBeInTheDocument();
    });

    it('should display Questions subtitle', () => {
      const props = createDefaultProps();
      render(<QuizNavigation {...props} />);

      expect(screen.getByText(/^Questions$/i)).toBeInTheDocument();
    });
  });
});
