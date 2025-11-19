/**
 * Unit Tests for QuestionRenderer Component
 *
 * Comprehensive test suite validating question rendering for different question types,
 * answer state management, user interactions, HTML content sanitization, and accessibility.
 *
 * @module tests/unit/features/activities/quizzes/QuestionRenderer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QuestionRenderer } from '@/features/activities/quizzes/components/QuestionRenderer';
import type { QuizQuestion } from '@/features/activities/quizzes/api/quizApi';

/**
 * Mock Material-UI components to avoid complex rendering dependencies
 * while maintaining test focus on component logic
 */
vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material');
  return {
    ...actual,
  };
});

describe('QuestionRenderer Component', () => {
  // ============================================================================
  // Test Setup and Utilities
  // ============================================================================

  let mockOnChange: ReturnType<typeof vi.fn>;

  /**
   * Create base question mock with common properties
   */
  const createBaseQuestion = (overrides: Partial<QuizQuestion> = {}): QuizQuestion => {
    return {
      id: 1,
      slot: 1,
      type: 'multichoice',
      questiontext: '<p>What is the capital of France?</p>',
      questiontextformat: 1,
      maxmark: 1.0,
      options: [],
      ...overrides,
    };
  };

  /**
   * Controlled wrapper component for testing QuestionRenderer with proper state management.
   * This component maintains internal state and properly updates the value prop,
   * simulating how QuestionRenderer would be used in a real parent component.
   */
  const ControlledQuestionRenderer: React.FC<{
    question: QuizQuestion;
    initialValue?: string;
    onChange: (value: string) => void;
    onFlag?: (flagged: boolean) => void;
    disabled?: boolean;
  }> = ({ question, initialValue = '', onChange, onFlag, disabled }) => {
    const [value, setValue] = React.useState(initialValue);

    const handleChange = (newValue: string) => {
      setValue(newValue);
      onChange(newValue);
    };

    return (
      <QuestionRenderer
        question={question}
        value={value}
        onChange={handleChange}
        onFlag={onFlag}
        disabled={disabled}
      />
    );
  };

  /**
   * Create multiple choice question options
   */
  const createMultipleChoiceOptions = () => [
    { id: 1, text: 'Paris', correct: true },
    { id: 2, text: 'London', correct: false },
    { id: 3, text: 'Berlin', correct: false },
    { id: 4, text: 'Madrid', correct: false },
  ];

  beforeEach(() => {
    mockOnChange = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Multiple Choice Question Tests (Single Answer)
  // ============================================================================

  describe('Multiple Choice Question (Single Answer)', () => {
    it('should render multiple choice question with radio buttons', () => {
      const question = createBaseQuestion({
        type: 'multichoice',
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      // Verify question text is rendered
      expect(screen.getByTestId('question-text')).toBeInTheDocument();
      expect(screen.getByTestId('question-text')).toHaveTextContent('What is the capital of France?');

      // Verify marks display
      expect(screen.getByText(/Marks: 1/)).toBeInTheDocument();

      // Verify all options are rendered as radio buttons
      expect(screen.getByTestId('option-1')).toBeInTheDocument();
      expect(screen.getByTestId('option-2')).toBeInTheDocument();
      expect(screen.getByTestId('option-3')).toBeInTheDocument();
      expect(screen.getByTestId('option-4')).toBeInTheDocument();

      // Verify options have correct labels
      expect(screen.getByText('Paris')).toBeInTheDocument();
      expect(screen.getByText('London')).toBeInTheDocument();
      expect(screen.getByText('Berlin')).toBeInTheDocument();
      expect(screen.getByText('Madrid')).toBeInTheDocument();
    });

    it('should handle option selection and emit onChange event', async () => {
      const user = userEvent.setup();
      const question = createBaseQuestion({
        type: 'multichoice',
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      // Click on the first option (Paris)
      const parisOption = screen.getByTestId('option-1');
      await user.click(parisOption);

      // Verify onChange was called with correct value
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith('1');
      });
    });

    it('should display selected option correctly', () => {
      const question = createBaseQuestion({
        type: 'multichoice',
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value="2"
          onChange={mockOnChange}
        />
      );

      // Verify the correct radio button is selected
      const londonOption = screen.getByTestId('option-2');
      const londonInput = londonOption.querySelector('input') as HTMLInputElement;
      expect(londonInput.checked).toBe(true);

      // Verify other options are not selected
      const parisOption = screen.getByTestId('option-1');
      const parisInput = parisOption.querySelector('input') as HTMLInputElement;
      expect(parisInput.checked).toBe(false);
    });

    it('should allow changing selection between options', async () => {
      const user = userEvent.setup();
      const question = createBaseQuestion({
        type: 'multichoice',
        options: createMultipleChoiceOptions(),
      });

      const { rerender } = render(
        <QuestionRenderer
          question={question}
          value="1"
          onChange={mockOnChange}
        />
      );

      // Click on a different option
      let berlinOption = screen.getByTestId('option-3');
      await user.click(berlinOption);

      // Verify onChange was called with new value
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('3');
      });

      // Rerender with new value
      rerender(
        <QuestionRenderer
          question={question}
          value="3"
          onChange={mockOnChange}
        />
      );

      // Verify new selection - re-query after rerender
      berlinOption = screen.getByTestId('option-3');
      const berlinInput = berlinOption.querySelector('input') as HTMLInputElement;
      expect(berlinInput.checked).toBe(true);
    });

    it('should render question text with HTML content', () => {
      const question = createBaseQuestion({
        type: 'multichoice',
        questiontext: '<p>What is <strong>2 + 2</strong>?</p><ul><li>Choose carefully</li></ul>',
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      const questionText = screen.getByTestId('question-text');
      expect(questionText.innerHTML).toContain('<strong>2 + 2</strong>');
      expect(questionText.innerHTML).toContain('<ul><li>Choose carefully</li></ul>');
    });

    it('should disable options when disabled prop is true', () => {
      const question = createBaseQuestion({
        type: 'multichoice',
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
          disabled={true}
        />
      );

      // Verify all radio buttons are disabled
      const option1 = screen.getByTestId('option-1');
      const input1 = option1.querySelector('input') as HTMLInputElement;
      const option2 = screen.getByTestId('option-2');
      const input2 = option2.querySelector('input') as HTMLInputElement;
      expect(input1.disabled).toBe(true);
      expect(input2.disabled).toBe(true);
    });
  });

  // ============================================================================
  // Multiple Choice Question Tests (Multiple Answers)
  // ============================================================================

  describe('Multiple Choice Question (Multiple Answers)', () => {
    it('should render multiple choice question with checkboxes', () => {
      const question = createBaseQuestion({
        type: 'multichoicemulti',
        questiontext: '<p>Select all prime numbers:</p>',
        options: [
          { id: 1, text: '2', correct: true },
          { id: 2, text: '3', correct: true },
          { id: 3, text: '4', correct: false },
          { id: 4, text: '5', correct: true },
        ],
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      // Verify checkboxes are rendered
      expect(screen.getByTestId('option-1')).toBeInTheDocument();
      expect(screen.getByTestId('option-2')).toBeInTheDocument();
      expect(screen.getByTestId('option-3')).toBeInTheDocument();
      expect(screen.getByTestId('option-4')).toBeInTheDocument();

      // Verify option labels
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should handle multiple option selection', async () => {
      const user = userEvent.setup();
      const question = createBaseQuestion({
        type: 'multichoicemulti',
        options: [
          { id: 1, text: '2', correct: true },
          { id: 2, text: '3', correct: true },
          { id: 3, text: '4', correct: false },
        ],
      });

      render(
        <QuestionRenderer
          question={question}
          value={[]}
          onChange={mockOnChange}
        />
      );

      // Click on first checkbox
      const option1 = screen.getByTestId('option-1');
      await user.click(option1);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(['1']);
      });
    });

    it('should add and remove selections correctly', async () => {
      const user = userEvent.setup();
      const question = createBaseQuestion({
        type: 'multichoicemulti',
        options: [
          { id: 1, text: 'Option 1' },
          { id: 2, text: 'Option 2' },
          { id: 3, text: 'Option 3' },
        ],
      });

      const { rerender } = render(
        <QuestionRenderer
          question={question}
          value={['1']}
          onChange={mockOnChange}
        />
      );

      // Add second selection
      const option2 = screen.getByTestId('option-2');
      await user.click(option2);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(['1', '2']);
      });

      // Update value
      rerender(
        <QuestionRenderer
          question={question}
          value={['1', '2']}
          onChange={mockOnChange}
        />
      );

      // Deselect first option
      mockOnChange.mockClear();
      const option1 = screen.getByTestId('option-1');
      await user.click(option1);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(['2']);
      });
    });

    it('should display multiple selected options correctly', () => {
      const question = createBaseQuestion({
        type: 'multichoicemulti',
        options: [
          { id: 1, text: 'Option 1' },
          { id: 2, text: 'Option 2' },
          { id: 3, text: 'Option 3' },
        ],
      });

      render(
        <QuestionRenderer
          question={question}
          value={['1', '3']}
          onChange={mockOnChange}
        />
      );

      // Verify correct checkboxes are checked
      const option1 = screen.getByTestId('option-1');
      const input1 = option1.querySelector('input') as HTMLInputElement;
      const option2 = screen.getByTestId('option-2');
      const input2 = option2.querySelector('input') as HTMLInputElement;
      const option3 = screen.getByTestId('option-3');
      const input3 = option3.querySelector('input') as HTMLInputElement;

      expect(input1.checked).toBe(true);
      expect(input2.checked).toBe(false);
      expect(input3.checked).toBe(true);
    });
  });

  // ============================================================================
  // True/False Question Tests
  // ============================================================================

  describe('True/False Question', () => {
    it('should render true/false question with two radio options', () => {
      const question = createBaseQuestion({
        type: 'truefalse',
        questiontext: '<p>The Earth is flat.</p>',
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      // Verify both options are rendered
      expect(screen.getByTestId('option-true')).toBeInTheDocument();
      expect(screen.getByTestId('option-false')).toBeInTheDocument();

      // Verify labels
      expect(screen.getByText('True')).toBeInTheDocument();
      expect(screen.getByText('False')).toBeInTheDocument();
    });

    it('should handle true selection', async () => {
      const user = userEvent.setup();
      const question = createBaseQuestion({
        type: 'truefalse',
        questiontext: '<p>Water boils at 100°C at sea level.</p>',
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      const trueOption = screen.getByTestId('option-true');
      await user.click(trueOption);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('true');
      });
    });

    it('should handle false selection', async () => {
      const user = userEvent.setup();
      const question = createBaseQuestion({
        type: 'truefalse',
        questiontext: '<p>The moon is made of cheese.</p>',
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      const falseOption = screen.getByTestId('option-false');
      await user.click(falseOption);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('false');
      });
    });

    it('should display selected true/false value correctly', () => {
      const question = createBaseQuestion({
        type: 'truefalse',
      });

      const { rerender } = render(
        <QuestionRenderer
          question={question}
          value="true"
          onChange={mockOnChange}
        />
      );

      // Verify true is selected
      const trueOption = screen.getByTestId('option-true');
      const trueInput = trueOption.querySelector('input') as HTMLInputElement;
      expect(trueInput.checked).toBe(true);

      // Rerender with false
      rerender(
        <QuestionRenderer
          question={question}
          value="false"
          onChange={mockOnChange}
        />
      );

      // Verify false is selected
      const falseOption = screen.getByTestId('option-false');
      const falseInput = falseOption.querySelector('input') as HTMLInputElement;
      expect(falseInput.checked).toBe(true);
    });
  });

  // ============================================================================
  // Short Answer Question Tests
  // ============================================================================

  describe('Short Answer Question', () => {
    it('should render short answer text field', () => {
      const question = createBaseQuestion({
        type: 'shortanswer',
        questiontext: '<p>What is the chemical symbol for water?</p>',
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      // Verify text field is rendered
      const textFieldWrapper = screen.getByTestId('short-answer-input');
      const textField = textFieldWrapper.querySelector('input') as HTMLInputElement;
      expect(textField).toBeInTheDocument();
      expect(textField).toHaveAttribute('placeholder', 'Enter your answer');
    });

    it('should handle text input and emit onChange event', async () => {
      const user = userEvent.setup();
      const question = createBaseQuestion({
        type: 'shortanswer',
        questiontext: '<p>Enter the answer:</p>',
      });

      render(
        <ControlledQuestionRenderer
          question={question}
          initialValue=""
          onChange={mockOnChange}
        />
      );

      const textFieldWrapper = screen.getByTestId('short-answer-input');
      const textField = textFieldWrapper.querySelector('input') as HTMLInputElement;
      await user.type(textField, 'H2O');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
        // Check that onChange was called with partial input as user types
        const calls = mockOnChange.mock.calls;
        expect(calls[calls.length - 1][0]).toBe('H2O');
      });
    });

    it('should display existing answer value', () => {
      const question = createBaseQuestion({
        type: 'shortanswer',
      });

      render(
        <QuestionRenderer
          question={question}
          value="H2O"
          onChange={mockOnChange}
        />
      );

      const textFieldWrapper = screen.getByTestId('short-answer-input');
      const textField = textFieldWrapper.querySelector('input') as HTMLInputElement;
      expect(textField.value).toBe('H2O');
    });

    it('should handle clearing text input', async () => {
      const user = userEvent.setup();
      const question = createBaseQuestion({
        type: 'shortanswer',
      });

      render(
        <QuestionRenderer
          question={question}
          value="Initial text"
          onChange={mockOnChange}
        />
      );

      const textFieldWrapper = screen.getByTestId('short-answer-input');
      const textField = textFieldWrapper.querySelector('input') as HTMLInputElement;
      await user.clear(textField);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('');
      });
    });

    it('should disable text field when disabled prop is true', () => {
      const question = createBaseQuestion({
        type: 'shortanswer',
      });

      render(
        <QuestionRenderer
          question={question}
          value=""
          onChange={mockOnChange}
          disabled={true}
        />
      );

      const textFieldWrapper = screen.getByTestId('short-answer-input');
      const textField = textFieldWrapper.querySelector('input') as HTMLInputElement;
      expect(textField.disabled).toBe(true);
    });
  });

  // ============================================================================
  // Numerical Question Tests
  // ============================================================================

  describe('Numerical Question', () => {
    it('should render numerical input field', () => {
      const question = createBaseQuestion({
        type: 'numerical',
        questiontext: '<p>What is 15 + 27?</p>',
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      const numberFieldWrapper = screen.getByTestId('numerical-input');
      const numberField = numberFieldWrapper.querySelector('input') as HTMLInputElement;
      expect(numberField).toBeInTheDocument();
      expect(numberField).toHaveAttribute('type', 'number');
      expect(numberField).toHaveAttribute('placeholder', 'Enter a number');
    });

    it('should handle numerical input', async () => {
      const user = userEvent.setup();
      const question = createBaseQuestion({
        type: 'numerical',
        questiontext: '<p>Enter a number:</p>',
      });

      render(
        <ControlledQuestionRenderer
          question={question}
          initialValue=""
          onChange={mockOnChange}
        />
      );

      const numberFieldWrapper = screen.getByTestId('numerical-input');
      const numberField = numberFieldWrapper.querySelector('input') as HTMLInputElement;
      await user.type(numberField, '42');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
        const calls = mockOnChange.mock.calls;
        expect(calls[calls.length - 1][0]).toBe('42');
      });
    });

    it('should display existing numerical value', () => {
      const question = createBaseQuestion({
        type: 'numerical',
      });

      render(
        <QuestionRenderer
          question={question}
          value="3.14159"
          onChange={mockOnChange}
        />
      );

      const numberFieldWrapper = screen.getByTestId('numerical-input');
      const numberField = numberFieldWrapper.querySelector('input') as HTMLInputElement;
      expect(numberField.value).toBe('3.14159');
    });

    it('should handle negative numbers', async () => {
      const user = userEvent.setup();
      const question = createBaseQuestion({
        type: 'numerical',
      });

      render(
        <ControlledQuestionRenderer
          question={question}
          initialValue=""
          onChange={mockOnChange}
        />
      );

      const numberFieldWrapper = screen.getByTestId('numerical-input');
      const numberField = numberFieldWrapper.querySelector('input') as HTMLInputElement;
      await user.type(numberField, '-25');

      await waitFor(() => {
        const calls = mockOnChange.mock.calls;
        expect(calls[calls.length - 1][0]).toBe('-25');
      });
    });

    it('should handle decimal numbers', async () => {
      const user = userEvent.setup();
      const question = createBaseQuestion({
        type: 'numerical',
      });

      render(
        <ControlledQuestionRenderer
          question={question}
          initialValue=""
          onChange={mockOnChange}
        />
      );

      const numberFieldWrapper = screen.getByTestId('numerical-input');
      const numberField = numberFieldWrapper.querySelector('input') as HTMLInputElement;
      await user.type(numberField, '3.14');

      await waitFor(() => {
        const calls = mockOnChange.mock.calls;
        expect(calls[calls.length - 1][0]).toBe('3.14');
      });
    });
  });

  // ============================================================================
  // Essay Question Tests
  // ============================================================================

  describe('Essay Question', () => {
    it('should render essay textarea field', () => {
      const question = createBaseQuestion({
        type: 'essay',
        questiontext: '<p>Discuss the impact of climate change on global agriculture.</p>',
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      const essayFieldWrapper = screen.getByTestId('essay-input');
      expect(essayFieldWrapper).toBeInTheDocument();
      
      // Query the actual textarea element inside the wrapper
      const essayField = essayFieldWrapper.querySelector('textarea') as HTMLTextAreaElement;
      expect(essayField).toBeInTheDocument();
      expect(essayField).toHaveAttribute('placeholder', 'Write your essay here');
      expect(essayField.tagName).toBe('TEXTAREA');
    });

    it('should handle essay text input', async () => {
      const user = userEvent.setup();
      const question = createBaseQuestion({
        type: 'essay',
        questiontext: '<p>Write your answer:</p>',
      });

      render(
        <ControlledQuestionRenderer
          question={question}
          initialValue=""
          onChange={mockOnChange}
        />
      );

      const essayFieldWrapper = screen.getByTestId('essay-input');
      const essayField = essayFieldWrapper.querySelector('textarea') as HTMLTextAreaElement;
      const essayText = 'Climate change has significant impacts on agriculture worldwide.';
      await user.type(essayField, essayText);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
        const calls = mockOnChange.mock.calls;
        expect(calls[calls.length - 1][0]).toBe(essayText);
      });
    });

    it('should handle multiline text', async () => {
      const user = userEvent.setup();
      const question = createBaseQuestion({
        type: 'essay',
      });

      render(
        <ControlledQuestionRenderer
          question={question}
          initialValue=""
          onChange={mockOnChange}
        />
      );

      const essayFieldWrapper = screen.getByTestId('essay-input');
      const essayField = essayFieldWrapper.querySelector('textarea') as HTMLTextAreaElement;
      await user.type(essayField, 'Line 1{Enter}Line 2{Enter}Line 3');

      await waitFor(() => {
        const calls = mockOnChange.mock.calls;
        const finalCall = calls[calls.length - 1];
        const finalValue = finalCall ? (finalCall[0] as string) : '';
        expect(finalValue).toContain('\n');
      });
    });

    it('should display existing essay value', () => {
      const existingEssay = 'This is a previously written essay.\nIt has multiple lines.';
      const question = createBaseQuestion({
        type: 'essay',
      });

      render(
        <QuestionRenderer
          question={question}
          value={existingEssay}
          onChange={mockOnChange}
        />
      );

      const essayFieldWrapper = screen.getByTestId('essay-input');
      const essayField = essayFieldWrapper.querySelector('textarea') as HTMLTextAreaElement;
      expect(essayField.value).toBe(existingEssay);
    });

    it('should support long text content', () => {
      const longEssay = 'Lorem ipsum dolor sit amet, '.repeat(100);
      const question = createBaseQuestion({
        type: 'essay',
      });

      render(
        <QuestionRenderer
          question={question}
          value={longEssay}
          onChange={mockOnChange}
        />
      );

      const essayFieldWrapper = screen.getByTestId('essay-input');
      const essayField = essayFieldWrapper.querySelector('textarea') as HTMLTextAreaElement;
      expect(essayField.value).toBe(longEssay);
      expect(essayField.value.length).toBeGreaterThan(1000);
    });
  });

  // ============================================================================
  // Question Text Display Tests
  // ============================================================================

  describe('Question Text Display', () => {
    it('should render HTML content in question text', () => {
      const htmlContent = '<p>This is <em>emphasized</em> and <strong>bold</strong> text.</p>';
      const question = createBaseQuestion({
        questiontext: htmlContent,
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      const questionText = screen.getByTestId('question-text');
      expect(questionText.innerHTML).toContain('<em>emphasized</em>');
      expect(questionText.innerHTML).toContain('<strong>bold</strong>');
    });

    it('should render complex HTML with images and lists', () => {
      const complexHtml = `
        <div>
          <p>Solve the following:</p>
          <img src="/image.png" alt="diagram" />
          <ul>
            <li>Step 1</li>
            <li>Step 2</li>
          </ul>
        </div>
      `;
      const question = createBaseQuestion({
        questiontext: complexHtml,
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      const questionText = screen.getByTestId('question-text');
      expect(questionText.innerHTML).toContain('<img');
      expect(questionText.innerHTML).toContain('<ul>');
      expect(questionText.innerHTML).toContain('Step 1');
    });

    it('should render mathematical notation in question text', () => {
      const mathContent = '<p>Calculate: <span class="math">x^2 + 2x + 1 = 0</span></p>';
      const question = createBaseQuestion({
        questiontext: mathContent,
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      const questionText = screen.getByTestId('question-text');
      expect(questionText.innerHTML).toContain('x^2 + 2x + 1 = 0');
    });
  });

  // ============================================================================
  // Question Marks Display Tests
  // ============================================================================

  describe('Question Marks Display', () => {
    it('should display question marks', () => {
      const question = createBaseQuestion({
        maxmark: 2.5,
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/Marks: 2.5/)).toBeInTheDocument();
    });

    it('should handle integer marks', () => {
      const question = createBaseQuestion({
        maxmark: 5,
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/Marks: 5/)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Unsupported Question Type Tests
  // ============================================================================

  describe('Unsupported Question Types', () => {
    it('should display warning for unsupported question types', () => {
      const question = createBaseQuestion({
        type: 'randomsamatch',
        questiontext: '<p>This is an unsupported question type.</p>',
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/Question type "randomsamatch" is not supported yet./)).toBeInTheDocument();
    });

    it('should handle calculated question type as unsupported', () => {
      const question = createBaseQuestion({
        type: 'calculated',
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/Question type "calculated" is not supported yet./)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Disabled State Tests
  // ============================================================================

  describe('Disabled State', () => {
    it('should prevent interactions when disabled', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const question = createBaseQuestion({
        type: 'multichoice',
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
          disabled={true}
        />
      );

      const option1 = screen.getByTestId('option-1');
      
      // Click should be possible but disabled component shouldn't respond
      await user.click(option1);

      // onChange should not be called when disabled
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should disable short answer input', () => {
      const question = createBaseQuestion({
        type: 'shortanswer',
      });

      render(
        <QuestionRenderer
          question={question}
          value=""
          onChange={mockOnChange}
          disabled={true}
        />
      );

      const textFieldWrapper = screen.getByTestId('short-answer-input');
      const textField = textFieldWrapper.querySelector('input') as HTMLInputElement;
      expect(textField.disabled).toBe(true);
    });

    it('should disable essay input', () => {
      const question = createBaseQuestion({
        type: 'essay',
      });

      render(
        <QuestionRenderer
          question={question}
          value=""
          onChange={mockOnChange}
          disabled={true}
        />
      );

      const essayFieldWrapper = screen.getByTestId('essay-input');
      const essayField = essayFieldWrapper.querySelector('textarea') as HTMLTextAreaElement;
      expect(essayField.disabled).toBe(true);
    });

    it('should disable numerical input', () => {
      const question = createBaseQuestion({
        type: 'numerical',
      });

      render(
        <QuestionRenderer
          question={question}
          value=""
          onChange={mockOnChange}
          disabled={true}
        />
      );

      const numberFieldWrapper = screen.getByTestId('numerical-input');
      const numberField = numberFieldWrapper.querySelector('input') as HTMLInputElement;
      expect(numberField.disabled).toBe(true);
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have proper ARIA structure for multiple choice', () => {
      const question = createBaseQuestion({
        type: 'multichoice',
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      const questionOptions = screen.getByTestId('question-options');
      expect(questionOptions).toHaveAttribute('role');
    });

    it('should have accessible form controls for true/false', () => {
      const question = createBaseQuestion({
        type: 'truefalse',
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      // Radio buttons should be accessible
      const trueOption = screen.getByTestId('option-true');
      const falseOption = screen.getByTestId('option-false');

      const trueInput = trueOption.querySelector('input') as HTMLInputElement;
      const falseInput = falseOption.querySelector('input') as HTMLInputElement;
      
      expect(trueInput).toHaveAttribute('type', 'radio');
      expect(falseInput).toHaveAttribute('type', 'radio');
    });

    it('should have accessible text inputs with labels', () => {
      const question = createBaseQuestion({
        type: 'shortanswer',
        questiontext: '<p>Enter your name:</p>',
      });

      render(
        <QuestionRenderer
          question={question}
          value=""
          onChange={mockOnChange}
        />
      );

      const textFieldWrapper = screen.getByTestId('short-answer-input');
      expect(textFieldWrapper).toBeInTheDocument();
      
      // Query the actual input element inside the wrapper
      const textField = textFieldWrapper.querySelector('input') as HTMLInputElement;
      expect(textField).toBeInTheDocument();
      expect(textField).toHaveAttribute('placeholder');
    });

    it('should maintain keyboard navigation for radio groups', async () => {
      const user = userEvent.setup();
      const question = createBaseQuestion({
        type: 'truefalse',
      });

      render(
        <ControlledQuestionRenderer
          question={question}
          initialValue={undefined}
          onChange={mockOnChange}
        />
      );

      // Focus on the True radio option using label
      const trueRadio = screen.getByLabelText('True');
      trueRadio.focus();
      expect(trueRadio).toHaveFocus();

      // Press Space to select (use space character, not {Space})
      await user.keyboard(' ');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('true');
      });
    });

    it('should support screen reader text for question marks', () => {
      const question = createBaseQuestion({
        maxmark: 3.0,
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      // Marks text should be visible and readable by screen readers
      const marksText = screen.getByText(/Marks: 3/);
      expect(marksText).toBeInTheDocument();
      expect(marksText).toBeVisible();
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty options array', () => {
      const question = createBaseQuestion({
        type: 'multichoice',
        options: [],
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      // Should render question text but no options
      expect(screen.getByTestId('question-text')).toBeInTheDocument();
      expect(screen.queryByTestId('question-options')).not.toBeInTheDocument();
    });

    it('should handle undefined value gracefully', () => {
      const question = createBaseQuestion({
        type: 'shortanswer',
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      const textFieldWrapper = screen.getByTestId('short-answer-input');
      const textField = textFieldWrapper.querySelector('input') as HTMLInputElement;
      expect(textField.value).toBe('');
    });

    it('should handle array value for non-array question types', () => {
      const question = createBaseQuestion({
        type: 'shortanswer',
      });

      // Pass array value to short answer (expects string)
      render(
        <QuestionRenderer
          question={question}
          value={['invalid'] as any}
          onChange={mockOnChange}
        />
      );

      const textFieldWrapper = screen.getByTestId('short-answer-input');
      const textField = textFieldWrapper.querySelector('input') as HTMLInputElement;
      // Should convert to empty string
      expect(textField.value).toBe('');
    });

    it('should handle string value for array question types', () => {
      const question = createBaseQuestion({
        type: 'multichoicemulti',
        options: createMultipleChoiceOptions(),
      });

      // Pass string value to multi-answer (expects array)
      render(
        <QuestionRenderer
          question={question}
          value={"1" as any}
          onChange={mockOnChange}
        />
      );

      // Should handle gracefully without crashing
      expect(screen.getByTestId('question-text')).toBeInTheDocument();
    });

    it('should handle question with no questiontext', () => {
      const question = createBaseQuestion({
        questiontext: '',
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      // Should still render the component
      expect(screen.getByTestId('question-renderer')).toBeInTheDocument();
    });

    it('should handle rapid selection changes', async () => {
      const user = userEvent.setup();
      const question = createBaseQuestion({
        type: 'multichoice',
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      // Rapidly click multiple options
      await user.click(screen.getByTestId('option-1'));
      await user.click(screen.getByTestId('option-2'));
      await user.click(screen.getByTestId('option-3'));

      // All clicks should be registered
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledTimes(3);
      });
    });
  });

  // ============================================================================
  // Component Structure Tests
  // ============================================================================

  describe('Component Structure', () => {
    it('should render main container with test id', () => {
      const question = createBaseQuestion({
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByTestId('question-renderer')).toBeInTheDocument();
    });

    it('should render all major sections', () => {
      const question = createBaseQuestion({
        options: createMultipleChoiceOptions(),
      });

      render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      // Question text section
      expect(screen.getByTestId('question-text')).toBeInTheDocument();

      // Marks section
      expect(screen.getByText(/Marks:/)).toBeInTheDocument();

      // Options section
      expect(screen.getByTestId('question-options')).toBeInTheDocument();
    });

    it('should apply consistent spacing and layout', () => {
      const question = createBaseQuestion({
        options: createMultipleChoiceOptions(),
      });

      const { container } = render(
        <QuestionRenderer
          question={question}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      // Verify container has proper structure
      const questionRenderer = container.querySelector('[data-testid="question-renderer"]');
      expect(questionRenderer).toBeInTheDocument();
      expect(questionRenderer?.children.length).toBeGreaterThan(0);
    });
  });
});
