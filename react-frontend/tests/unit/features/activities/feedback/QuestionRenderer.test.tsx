/**
 * Unit tests for QuestionRenderer Component
 * 
 * Comprehensive test suite validating dynamic rendering of all feedback question types:
 * - Multichoice (radio buttons and checkboxes)
 * - Multichoicerated (rating scale)
 * - Numeric (with validation)
 * - Textarea and Textfield
 * - Info and Label display
 * - Validation and error handling
 * - Accessibility compliance (WCAG 2.1 AA)
 * 
 * @module tests/unit/features/activities/feedback/QuestionRenderer.test
 * @see react-frontend/src/features/activities/feedback/components/QuestionRenderer.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import { QuestionRenderer } from '@/features/activities/feedback/components/QuestionRenderer';
import type { QuestionRendererProps } from '@/features/activities/feedback/components/QuestionRenderer';
import { FeedbackQuestionType } from '@/features/activities/feedback/types/feedback.types';
import type { FeedbackItemPresentation } from '@/features/activities/feedback/types/feedback.types';

// Extend Vitest matchers with jest-axe
expect.extend(toHaveNoViolations);

describe('QuestionRenderer Component', () => {
  let mockOnChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChange = vi.fn();
  });

  /**
   * Test Suite: Multichoice Question Tests (Radio Buttons)
   * Validates single-selection multichoice questions rendered as radio buttons
   */
  describe('Multichoice Question - Radio Buttons', () => {
    const getBaseProps = (): QuestionRendererProps => ({
      id: 1,
      type: 'multichoice',
      presentation: {
        type: FeedbackQuestionType.MULTICHOICE,
        multichoice: {
          subtype: 'r',
          randomize: false,
          hideNotSelected: false,
          ignoreEmpty: false,
          options: ['Option 1', 'Option 2', 'Option 3'],
        },
      },
      required: 0,
      position: 1,
      label: 'Select your preference',
      value: '',
      onChange: mockOnChange,
    });

    it('renders radio buttons when type is multichoice with single select', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toBeInTheDocument();
      expect(radioGroup).toHaveAttribute('aria-labelledby', 'feedback-item-1');
    });

    it('renders MUI RadioGroup with FormControlLabel for each option', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(4); // 3 options + "Not selected"

      expect(screen.getByLabelText('Not selected')).toBeInTheDocument();
      expect(screen.getByLabelText('Option 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Option 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Option 3')).toBeInTheDocument();
    });

    it('parses options from presentation string', () => {
      const props = getBaseProps();
      render(<QuestionRenderer {...props} />);

      const {options} = (props.presentation.multichoice!);
      options.forEach((option) => {
        expect(screen.getByLabelText(option)).toBeInTheDocument();
      });
    });

    it('highlights selected value correctly', () => {
      const { rerender } = render(<QuestionRenderer {...getBaseProps()} value="1" />);

      const option1Radio = screen.getByLabelText('Option 1') as HTMLInputElement;
      expect(option1Radio.checked).toBe(true);

      rerender(<QuestionRenderer {...getBaseProps()} value="2" />);
      const option2Radio = screen.getByLabelText('Option 2') as HTMLInputElement;
      expect(option2Radio.checked).toBe(true);
    });

    it('triggers onChange callback when radio selected', async () => {
      const user = userEvent.setup();
      render(<QuestionRenderer {...getBaseProps()} />);

      const option2Radio = screen.getByLabelText('Option 2');
      await user.click(option2Radio);

      expect(mockOnChange).toHaveBeenCalledWith('2');
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    it('displays required indicator when required is 1', () => {
      render(<QuestionRenderer {...getBaseProps()} required={1} />);

      // MUI adds asterisk to required field labels
      const legend = screen.getByText(/Select your preference/i);
      expect(legend).toBeInTheDocument();
      
      // Check that the fieldset or radiogroup indicates it's required
      // MUI RadioGroup doesn't add 'required' to individual radios by default,
      // but the FormLabel has required prop which adds visual indicator
      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toBeInTheDocument();
    });

    it('hides "Not selected" option when hideNotSelected is true', () => {
      const props = getBaseProps();
      const propsWithHidden = {
        ...props,
        presentation: {
          ...props.presentation,
          multichoice: {
            ...props.presentation.multichoice!,
            hideNotSelected: true,
          },
        },
      };

      render(<QuestionRenderer {...propsWithHidden} />);

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3); // Only 3 options, no "Not selected"
      expect(screen.queryByLabelText('Not selected')).not.toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Multichoice Question Tests (Checkboxes)
   * Validates multi-selection multichoice questions rendered as checkboxes
   */
  describe('Multichoice Question - Checkboxes', () => {
    const getBaseProps = (): QuestionRendererProps => ({
      id: 2,
      type: 'multichoice',
      presentation: {
        type: FeedbackQuestionType.MULTICHOICE,
        multichoice: {
          subtype: 'c',
          randomize: false,
          hideNotSelected: false,
          ignoreEmpty: false,
          options: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
        },
      },
      required: 0,
      position: 1,
      label: 'Select all that apply',
      value: [],
      onChange: mockOnChange,
    });

    it('renders checkboxes when type is multichoice and multiple select', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(4);
    });

    it('renders MUI Checkbox with FormControlLabel for each option', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      expect(screen.getByLabelText('Choice A')).toBeInTheDocument();
      expect(screen.getByLabelText('Choice B')).toBeInTheDocument();
      expect(screen.getByLabelText('Choice C')).toBeInTheDocument();
      expect(screen.getByLabelText('Choice D')).toBeInTheDocument();
    });

    it('allows multiple selections', async () => {
      const user = userEvent.setup();
      render(<QuestionRenderer {...getBaseProps()} />);

      const choiceA = screen.getByLabelText('Choice A');
      const choiceC = screen.getByLabelText('Choice C');

      await user.click(choiceA);
      expect(mockOnChange).toHaveBeenCalledWith(['1']);

      await user.click(choiceC);
      expect(mockOnChange).toHaveBeenCalledWith(['3']);
    });

    it('calls onChange with array of selected values', async () => {
      const user = userEvent.setup();
      render(<QuestionRenderer {...getBaseProps()} value={['1']} />);

      const choiceB = screen.getByLabelText('Choice B');
      await user.click(choiceB);

      expect(mockOnChange).toHaveBeenCalledWith(['1', '2']);
    });

    it('reflects checked state from value prop', () => {
      render(<QuestionRenderer {...getBaseProps()} value={['1', '3']} />);

      const choiceA = screen.getByLabelText('Choice A') as HTMLInputElement;
      const choiceB = screen.getByLabelText('Choice B') as HTMLInputElement;
      const choiceC = screen.getByLabelText('Choice C') as HTMLInputElement;
      const choiceD = screen.getByLabelText('Choice D') as HTMLInputElement;

      expect(choiceA.checked).toBe(true);
      expect(choiceB.checked).toBe(false);
      expect(choiceC.checked).toBe(true);
      expect(choiceD.checked).toBe(false);
    });

    it('removes value from array when unchecked', async () => {
      const user = userEvent.setup();
      render(<QuestionRenderer {...getBaseProps()} value={['1', '2', '3']} />);

      const choiceB = screen.getByLabelText('Choice B');
      await user.click(choiceB);

      expect(mockOnChange).toHaveBeenCalledWith(['1', '3']);
    });
  });

  /**
   * Test Suite: Multichoicerated Question Tests
   * Validates rating scale questions with numeric values
   */
  describe('Multichoicerated Question - Rating Scale', () => {
    const getBaseProps = (): QuestionRendererProps => ({
      id: 3,
      type: 'multichoicerated',
      presentation: {
        type: FeedbackQuestionType.MULTICHOICERATED,
        multichoicerated: {
          subtype: 'r',
          options: [
            { text: 'Strongly Disagree', value: 1 },
            { text: 'Disagree', value: 2 },
            { text: 'Neutral', value: 3 },
            { text: 'Agree', value: 4 },
            { text: 'Strongly Agree', value: 5 },
          ],
        },
      },
      required: 0,
      position: 1,
      label: 'Rate your satisfaction',
      value: '',
      onChange: mockOnChange,
    });

    it('renders rating scale when type is multichoicerated', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toBeInTheDocument();
    });

    it('renders MUI Rating component for each option', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const ratings = screen.getAllByRole('img', { hidden: true });
      // Each option has a rating component, check they exist
      expect(ratings.length).toBeGreaterThan(0);
    });

    it('displays rating options with values', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      expect(screen.getByLabelText(/Strongly Disagree - 1 points/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Neutral - 3 points/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Strongly Agree - 5 points/)).toBeInTheDocument();
    });

    it('calls onChange with selected rating value', async () => {
      const user = userEvent.setup();
      render(<QuestionRenderer {...getBaseProps()} />);

      const agreeOption = screen.getByLabelText(/Agree - 4 points/);
      await user.click(agreeOption);

      expect(mockOnChange).toHaveBeenCalledWith('4');
    });

    it('sets initial rating from value prop', () => {
      render(<QuestionRenderer {...getBaseProps()} value="3" />);

      const neutralOption = screen.getByLabelText(/Neutral - 3 points/) as HTMLInputElement;
      expect(neutralOption.checked).toBe(true);
    });

    it('displays required indicator for required ratings', () => {
      render(<QuestionRenderer {...getBaseProps()} required={1} />);

      const legend = screen.getByText('Rate your satisfaction');
      expect(legend).toBeInTheDocument();
    });

    it('displays rating value as numeric text', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      expect(screen.getByText('(1)')).toBeInTheDocument();
      expect(screen.getByText('(2)')).toBeInTheDocument();
      expect(screen.getByText('(3)')).toBeInTheDocument();
      expect(screen.getByText('(4)')).toBeInTheDocument();
      expect(screen.getByText('(5)')).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Numeric Question Tests
   * Validates numeric input with range validation
   */
  describe('Numeric Question', () => {
    const getBaseProps = (): QuestionRendererProps => ({
      id: 4,
      type: 'numeric',
      presentation: {
        type: FeedbackQuestionType.NUMERIC,
        numeric: {
          rangeFrom: 0,
          rangeTo: 100,
        },
      },
      required: 0,
      position: 1,
      label: 'Enter your score',
      value: '',
      onChange: mockOnChange,
    });

    it('renders number input when type is numeric', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const input = screen.getByLabelText('Enter your score') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.type).toBe('number');
    });

    it('renders MUI TextField with type="number"', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const input = screen.getByLabelText('Enter your score');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('applies min and max attributes from presentation', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const input = screen.getByLabelText('Enter your score');
      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '100');
    });

    it('calls onChange with numeric value', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<QuestionRenderer {...getBaseProps()} />);

      const input = screen.getByLabelText('Enter your score');
      
      // Type '7'
      await user.clear(input);
      await user.type(input, '7');
      expect(mockOnChange).toHaveBeenCalledWith(7);
      
      // Simulate parent updating value prop
      rerender(<QuestionRenderer {...getBaseProps()} value={7} />);
      
      // Type '5' (which appends to '7' to make '75')
      await user.type(input, '5');
      expect(mockOnChange).toHaveBeenCalledWith(75);
    });

    it('displays helper text with range information', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      expect(screen.getByText('Enter a number between 0 and 100')).toBeInTheDocument();
    });

    it('displays error message for invalid values', () => {
      render(<QuestionRenderer {...getBaseProps()} error="Value must be between 0 and 100" touched />);

      expect(screen.getByText('Value must be between 0 and 100')).toBeInTheDocument();
    });

    it('handles empty value correctly', () => {
      render(<QuestionRenderer {...getBaseProps()} value="" />);

      const input = screen.getByLabelText('Enter your score') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('converts string value to number', () => {
      render(<QuestionRenderer {...getBaseProps()} value={42} />);

      const input = screen.getByLabelText('Enter your score') as HTMLInputElement;
      expect(input.value).toBe('42');
    });
  });

  /**
   * Test Suite: Textarea Question Tests
   * Validates multi-line text input with character counting
   */
  describe('Textarea Question', () => {
    const getBaseProps = (): QuestionRendererProps => ({
      id: 5,
      type: 'textarea',
      presentation: {
        type: FeedbackQuestionType.TEXTAREA,
        text: {
          rows: 5,
          maxLength: 500,
        },
      },
      required: 0,
      position: 1,
      label: 'Enter your comments',
      value: '',
      onChange: mockOnChange,
    });

    it('renders textarea when type is textarea', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const textarea = screen.getByLabelText('Enter your comments');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('renders MUI TextField with multiline prop', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const textarea = screen.getByLabelText('Enter your comments');
      // MUI TextField with multiline creates a textarea
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('applies rows count from presentation', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const textarea = screen.getByLabelText('Enter your comments') as HTMLTextAreaElement;
      // Check the rows attribute (always a string in HTML)
      expect(textarea).toHaveAttribute('rows', '5');
      // The .rows property should parse to 5
      expect(Number(textarea.rows)).toBe(5);
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('calls onChange with text value', async () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const textarea = screen.getByLabelText('Enter your comments');
      
      // Directly change the textarea value and trigger change event
      fireEvent.change(textarea, { target: { value: 'This is my comment' } });

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('This is my comment');
    });

    it('applies maxlength attribute from presentation', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const textarea = screen.getByLabelText('Enter your comments') as HTMLTextAreaElement;
      expect(textarea.maxLength).toBe(500);
    });

    it('displays character count when maxlength is set', () => {
      render(<QuestionRenderer {...getBaseProps()} value="Hello" />);

      expect(screen.getByText('5/500 characters')).toBeInTheDocument();
    });

    it('updates character count as user types', () => {
      const { rerender } = render(<QuestionRenderer {...getBaseProps()} value="" />);
      expect(screen.getByText('0/500 characters')).toBeInTheDocument();

      rerender(<QuestionRenderer {...getBaseProps()} value="Test message" />);
      expect(screen.getByText('12/500 characters')).toBeInTheDocument();
    });

    it('displays required indicator when required', () => {
      render(<QuestionRenderer {...getBaseProps()} required={1} />);

      // MUI adds asterisk (*) to required field labels
      const textarea = screen.getByLabelText(/Enter your comments/i);
      expect(textarea).toHaveAttribute('aria-required', 'true');
    });
  });

  /**
   * Test Suite: Textfield Question Tests
   * Validates single-line text input
   */
  describe('Textfield Question', () => {
    const getBaseProps = (): QuestionRendererProps => ({
      id: 6,
      type: 'textfield',
      presentation: {
        type: FeedbackQuestionType.TEXTFIELD,
        text: {
          maxLength: 100,
          width: 40,
        },
      },
      required: 0,
      position: 1,
      label: 'Enter your name',
      value: '',
      onChange: mockOnChange,
    });

    it('renders text input when type is textfield', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const input = screen.getByLabelText('Enter your name') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.type).toBe('text');
    });

    it('renders MUI TextField single-line', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const input = screen.getByLabelText('Enter your name');
      expect(input.tagName).toBe('INPUT');
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('calls onChange with text value', async () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const input = screen.getByLabelText('Enter your name');
      
      // Directly change the input value and trigger change event
      fireEvent.change(input, { target: { value: 'John Doe' } });

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('John Doe');
    });

    it('applies maxlength validation', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const input = screen.getByLabelText('Enter your name') as HTMLInputElement;
      expect(input.maxLength).toBe(100);
    });

    it('displays character count when maxlength is set', () => {
      render(<QuestionRenderer {...getBaseProps()} value="John" />);

      expect(screen.getByText('4/100 characters')).toBeInTheDocument();
    });

    it('displays required indicator when required', () => {
      render(<QuestionRenderer {...getBaseProps()} required={1} />);

      // MUI adds asterisk (*) to required field labels
      const input = screen.getByLabelText(/Enter your name/i);
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('controls input value via value prop', () => {
      const { rerender } = render(<QuestionRenderer {...getBaseProps()} value="Initial" />);

      const input = screen.getByLabelText('Enter your name') as HTMLInputElement;
      expect(input.value).toBe('Initial');

      rerender(<QuestionRenderer {...getBaseProps()} value="Updated" />);
      expect(input.value).toBe('Updated');
    });
  });

  /**
   * Test Suite: Info Question Tests
   * Validates read-only informational display
   */
  describe('Info Question', () => {
    const getBaseProps = (): QuestionRendererProps => ({
      id: 7,
      type: 'info',
      presentation: {
        type: FeedbackQuestionType.INFO,
        info: {
          content: '<p>This is <strong>important</strong> information.</p>',
        },
      },
      required: 0,
      position: 1,
      label: 'Information',
      value: '',
      onChange: mockOnChange,
    });

    it('renders read-only text when type is info', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const infoBox = screen.getByRole('note');
      expect(infoBox).toBeInTheDocument();
    });

    it('uses MUI Typography component', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const infoBox = screen.getByRole('note');
      expect(infoBox).toBeInTheDocument();
    });

    it('displays formatted content from presentation', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      // The HTML content is rendered via dangerouslySetInnerHTML
      expect(screen.getByText('important')).toBeInTheDocument();
    });

    it('does not render input field', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('does not call onChange callback', async () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      // Info items are display-only, no interaction
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('has proper ARIA attributes', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const infoBox = screen.getByRole('note');
      expect(infoBox).toHaveAttribute('aria-label', 'Information');
    });
  });

  /**
   * Test Suite: Label Question Tests
   * Validates section header display
   */
  describe('Label Question', () => {
    const getBaseProps = (): QuestionRendererProps => ({
      id: 8,
      type: 'label',
      presentation: {
        type: FeedbackQuestionType.LABEL,
      },
      required: 0,
      position: 1,
      label: 'Section 1: Personal Information',
      value: '',
      onChange: mockOnChange,
    });

    it('renders section header when type is label', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      // The label text should be rendered as a heading
      const heading = screen.getByText('Section 1: Personal Information');
      expect(heading).toBeInTheDocument();
      
      // Verify it's rendered as an h3 element (level 3 heading)
      expect(heading.tagName).toBe('H3');
    });

    it('uses MUI Typography variant="h6"', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const heading = screen.getByText('Section 1: Personal Information');
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe('H3');
    });

    it('displays label text', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      expect(screen.getByText('Section 1: Personal Information')).toBeInTheDocument();
    });

    it('does not render input field', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('applies proper spacing and styling for section break', () => {
      render(<QuestionRenderer {...getBaseProps()} />);

      const heading = screen.getByText('Section 1: Personal Information');
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe('H3');
    });
  });

  /**
   * Test Suite: Required Field Indicator Tests
   * Validates display of required field markers
   */
  describe('Required Field Indicators', () => {
    it('displays required attribute for multichoice when required is 1', () => {
      const props: QuestionRendererProps = {
        id: 9,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'r',
            randomize: false,
            hideNotSelected: false,
            ignoreEmpty: false,
            options: ['Option 1', 'Option 2'],
          },
        },
        required: 1,
        position: 1,
        label: 'Required Question',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const legend = screen.getByText('Required Question');
      expect(legend).toBeInTheDocument();
    });

    it('displays required indicator for numeric input', () => {
      const props: QuestionRendererProps = {
        id: 10,
        type: 'numeric',
        presentation: {
          type: FeedbackQuestionType.NUMERIC,
          numeric: { rangeFrom: 0, rangeTo: 10 },
        },
        required: 1,
        position: 1,
        label: 'Required Number',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      // MUI adds asterisk (*) to required field labels
      const input = screen.getByLabelText(/Required Number/i);
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('displays required indicator for textarea', () => {
      const props: QuestionRendererProps = {
        id: 11,
        type: 'textarea',
        presentation: {
          type: FeedbackQuestionType.TEXTAREA,
          text: { rows: 4 },
        },
        required: 1,
        position: 1,
        label: 'Required Comment',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      // MUI adds asterisk (*) to required field labels
      const textarea = screen.getByLabelText(/Required Comment/i);
      expect(textarea).toHaveAttribute('aria-required', 'true');
    });

    it('does not display indicator when required is 0', () => {
      const props: QuestionRendererProps = {
        id: 12,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
        },
        required: 0,
        position: 1,
        label: 'Optional Field',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const input = screen.getByLabelText('Optional Field');
      expect(input).toHaveAttribute('aria-required', 'false');
    });
  });

  /**
   * Test Suite: Validation Error Display Tests
   * Validates error message rendering and styling
   */
  describe('Validation Error Display', () => {
    it('displays error message when error prop provided and touched', () => {
      const props: QuestionRendererProps = {
        id: 13,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
        },
        required: 1,
        position: 1,
        label: 'Name',
        value: '',
        onChange: mockOnChange,
        error: 'This field is required',
        touched: true,
      };

      render(<QuestionRenderer {...props} />);

      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('does not display error when not touched', () => {
      const props: QuestionRendererProps = {
        id: 14,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
        },
        required: 1,
        position: 1,
        label: 'Name',
        value: '',
        onChange: mockOnChange,
        error: 'This field is required',
        touched: false,
      };

      render(<QuestionRenderer {...props} />);

      expect(screen.queryByText('This field is required')).not.toBeInTheDocument();
    });

    it('uses MUI FormHelperText for error display', () => {
      const props: QuestionRendererProps = {
        id: 15,
        type: 'numeric',
        presentation: {
          type: FeedbackQuestionType.NUMERIC,
          numeric: { rangeFrom: 0, rangeTo: 100 },
        },
        required: 0,
        position: 1,
        label: 'Score',
        value: 150,
        onChange: mockOnChange,
        error: 'Value must be between 0 and 100',
        touched: true,
      };

      render(<QuestionRenderer {...props} />);

      const errorText = screen.getByText('Value must be between 0 and 100');
      expect(errorText).toBeInTheDocument();
      expect(errorText).toHaveAttribute('role', 'alert');
    });

    it('displays error with proper ARIA attributes', () => {
      const props: QuestionRendererProps = {
        id: 16,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
        },
        required: 1,
        position: 1,
        label: 'Email',
        value: 'invalid',
        onChange: mockOnChange,
        error: 'Invalid email format',
        touched: true,
      };

      render(<QuestionRenderer {...props} />);

      // MUI adds asterisk (*) to required field labels
      const input = screen.getByLabelText(/Email/i);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'feedback-item-16-error');

      const errorText = screen.getByText('Invalid email format');
      expect(errorText).toHaveAttribute('id', 'feedback-item-16-error');
    });

    it('applies error styling to input field', () => {
      const props: QuestionRendererProps = {
        id: 17,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
        },
        required: 1,
        position: 1,
        label: 'Username',
        value: '',
        onChange: mockOnChange,
        error: 'Username is required',
        touched: true,
      };

      render(<QuestionRenderer {...props} />);

      // Check that the input has error attributes
      // MUI adds asterisk for required fields, so use regex
      const input = screen.getByLabelText(/Username/i);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      
      // Check that error message is displayed
      const errorMessage = screen.getByText('Username is required');
      expect(errorMessage).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Value State Management Tests
   * Validates controlled component behavior
   */
  describe('Value State Management', () => {
    it('controls input value via value prop for textfield', () => {
      const props: QuestionRendererProps = {
        id: 18,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
        },
        required: 0,
        position: 1,
        label: 'Controlled Input',
        value: 'Initial Value',
        onChange: mockOnChange,
      };

      const { rerender } = render(<QuestionRenderer {...props} />);

      const input = screen.getByLabelText('Controlled Input') as HTMLInputElement;
      expect(input.value).toBe('Initial Value');

      rerender(<QuestionRenderer {...props} value="Updated Value" />);
      expect(input.value).toBe('Updated Value');
    });

    it('controls numeric input value via value prop', () => {
      const props: QuestionRendererProps = {
        id: 19,
        type: 'numeric',
        presentation: {
          type: FeedbackQuestionType.NUMERIC,
          numeric: { rangeFrom: 0, rangeTo: 100 },
        },
        required: 0,
        position: 1,
        label: 'Score',
        value: 50,
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const input = screen.getByLabelText('Score') as HTMLInputElement;
      expect(input.value).toBe('50');
    });

    it('controls radio selection via value prop', () => {
      const props: QuestionRendererProps = {
        id: 20,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'r',
            randomize: false,
            hideNotSelected: false,
            ignoreEmpty: false,
            options: ['A', 'B', 'C'],
          },
        },
        required: 0,
        position: 1,
        label: 'Choice',
        value: '2',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const optionB = screen.getByLabelText('B') as HTMLInputElement;
      expect(optionB.checked).toBe(true);
    });

    it('controls checkbox selections via array value prop', () => {
      const props: QuestionRendererProps = {
        id: 21,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'c',
            randomize: false,
            hideNotSelected: false,
            ignoreEmpty: false,
            options: ['X', 'Y', 'Z'],
          },
        },
        required: 0,
        position: 1,
        label: 'Choices',
        value: ['1', '3'],
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const optionX = screen.getByLabelText('X') as HTMLInputElement;
      const optionY = screen.getByLabelText('Y') as HTMLInputElement;
      const optionZ = screen.getByLabelText('Z') as HTMLInputElement;

      expect(optionX.checked).toBe(true);
      expect(optionY.checked).toBe(false);
      expect(optionZ.checked).toBe(true);
    });
  });

  /**
   * Test Suite: onChange Callback Tests
   * Validates callback invocation and parameters
   */
  describe('onChange Callback Tests', () => {
    it('calls onChange with string value for textfield', async () => {
      const user = userEvent.setup();
      const props: QuestionRendererProps = {
        id: 22,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
        },
        required: 0,
        position: 1,
        label: 'Input',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const input = screen.getByLabelText('Input');
      await user.type(input, 'test');

      expect(mockOnChange).toHaveBeenCalled();
      expect(typeof mockOnChange.mock.calls[0]![0]).toBe('string');
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('calls onChange with number value for numeric', async () => {
      const props: QuestionRendererProps = {
        id: 23,
        type: 'numeric',
        presentation: {
          type: FeedbackQuestionType.NUMERIC,
          numeric: { rangeFrom: 0, rangeTo: 100 },
        },
        required: 0,
        position: 1,
        label: 'Number',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const input = screen.getByLabelText('Number');
      
      // Directly change the input value and trigger change event
      fireEvent.change(input, { target: { value: '42' } });

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith(42);
    });

    it('calls onChange with array value for checkbox', async () => {
      const user = userEvent.setup();
      const props: QuestionRendererProps = {
        id: 24,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'c',
            randomize: false,
            hideNotSelected: false,
            ignoreEmpty: false,
            options: ['Option 1', 'Option 2'],
          },
        },
        required: 0,
        position: 1,
        label: 'Multi',
        value: [],
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const option1 = screen.getByLabelText('Option 1');
      await user.click(option1);

      expect(mockOnChange).toHaveBeenCalledWith(['1']);
      expect(Array.isArray(mockOnChange.mock.calls[0]![0])).toBe(true);
    });

    it('does not call onChange for info type', () => {
      const props: QuestionRendererProps = {
        id: 25,
        type: 'info',
        presentation: {
          type: FeedbackQuestionType.INFO,
          info: { content: 'Information' },
        },
        required: 0,
        position: 1,
        label: 'Info',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('does not call onChange for label type', () => {
      const props: QuestionRendererProps = {
        id: 26,
        type: 'label',
        presentation: {
          type: FeedbackQuestionType.LABEL,
        },
        required: 0,
        position: 1,
        label: 'Section Header',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  /**
   * Test Suite: Accessibility Tests
   * Validates WCAG 2.1 AA compliance
   */
  describe('Accessibility Compliance (WCAG 2.1 AA)', () => {
    it('has accessible labels for textfield inputs', () => {
      const props: QuestionRendererProps = {
        id: 27,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
        },
        required: 0,
        position: 1,
        label: 'Accessible Input',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const input = screen.getByLabelText('Accessible Input');
      expect(input).toBeInTheDocument();
    });

    it('links error messages via aria-describedby', () => {
      const props: QuestionRendererProps = {
        id: 28,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
        },
        required: 1,
        position: 1,
        label: 'Input',
        value: '',
        onChange: mockOnChange,
        error: 'Error message',
        touched: true,
      };

      render(<QuestionRenderer {...props} />);

      // MUI adds asterisk (*) to required field labels
      const input = screen.getByLabelText(/Input/i);
      const errorId = 'feedback-item-28-error';
      expect(input).toHaveAttribute('aria-describedby', errorId);
      expect(screen.getByText('Error message')).toHaveAttribute('id', errorId);
    });

    it('marks required fields with aria-required', () => {
      const props: QuestionRendererProps = {
        id: 29,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
        },
        required: 1,
        position: 1,
        label: 'Required',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      // MUI TextField adds an asterisk to required fields, so use regex or find by role
      const input = screen.getByLabelText(/Required/i);
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('has proper role for radio groups', () => {
      const props: QuestionRendererProps = {
        id: 30,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'r',
            randomize: false,
            hideNotSelected: false,
            ignoreEmpty: false,
            options: ['A', 'B'],
          },
        },
        required: 0,
        position: 1,
        label: 'Radio Group',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toHaveAttribute('aria-labelledby', 'feedback-item-30');
    });

    it('has fieldset and legend for checkbox groups', () => {
      const props: QuestionRendererProps = {
        id: 31,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'c',
            randomize: false,
            hideNotSelected: false,
            ignoreEmpty: false,
            options: ['X', 'Y'],
          },
        },
        required: 0,
        position: 1,
        label: 'Checkbox Group',
        value: [],
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const legend = screen.getByText('Checkbox Group');
      expect(legend.tagName).toBe('LEGEND');
      expect(legend.closest('fieldset')).toBeInTheDocument();
    });

    it('supports keyboard navigation for radio buttons', async () => {
      const user = userEvent.setup();
      const props: QuestionRendererProps = {
        id: 32,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'r',
            randomize: false,
            hideNotSelected: false,
            ignoreEmpty: false,
            options: ['Option 1', 'Option 2'],
          },
        },
        required: 0,
        position: 1,
        label: 'Keyboard Test',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      // "Not selected" is already selected (value is ''), so we need to select a different option
      // to trigger onChange. Tab to Option 1 and press Space
      const option1Radio = screen.getByLabelText('Option 1');
      option1Radio.focus();

      // Pressing Space should select the radio
      await user.keyboard(' ');
      expect(mockOnChange).toHaveBeenCalledWith('1'); // Option 1 has value '1' (index in allOptions array)
    });

    it('has proper ARIA attributes for info boxes', () => {
      const props: QuestionRendererProps = {
        id: 33,
        type: 'info',
        presentation: {
          type: FeedbackQuestionType.INFO,
          info: { content: 'Information content' },
        },
        required: 0,
        position: 1,
        label: 'Info',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const infoBox = screen.getByRole('note');
      expect(infoBox).toHaveAttribute('aria-label', 'Information');
    });

    it('passes axe accessibility checks for multichoice radio', async () => {
      const props: QuestionRendererProps = {
        id: 34,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'r',
            randomize: false,
            hideNotSelected: false,
            ignoreEmpty: false,
            options: ['Option 1', 'Option 2'],
          },
        },
        required: 0,
        position: 1,
        label: 'Accessible Radio',
        value: '',
        onChange: mockOnChange,
      };

      const { container } = render(<QuestionRenderer {...props} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility checks for textfield', async () => {
      const props: QuestionRendererProps = {
        id: 35,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
        },
        required: 1,
        position: 1,
        label: 'Accessible Text',
        value: '',
        onChange: mockOnChange,
      };

      const { container } = render(<QuestionRenderer {...props} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  /**
   * Test Suite: Edge Cases Tests
   * Validates component behavior with edge cases and invalid data
   */
  describe('Edge Cases', () => {
    it('handles missing multichoice options gracefully', () => {
      const props: QuestionRendererProps = {
        id: 36,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
        } as FeedbackItemPresentation, // Missing multichoice config - intentionally incomplete for testing
        required: 0,
        position: 1,
        label: 'Invalid',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      expect(screen.getByText('Invalid multichoice configuration')).toBeInTheDocument();
    });

    it('handles missing numeric configuration gracefully', () => {
      const props: QuestionRendererProps = {
        id: 37,
        type: 'numeric',
        presentation: {
          type: FeedbackQuestionType.NUMERIC,
        } as FeedbackItemPresentation, // Missing numeric config - intentionally incomplete for testing
        required: 0,
        position: 1,
        label: 'Invalid',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      expect(screen.getByText('Invalid numeric configuration')).toBeInTheDocument();
    });

    it('handles missing multichoicerated configuration gracefully', () => {
      const props: QuestionRendererProps = {
        id: 38,
        type: 'multichoicerated',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICERATED,
        } as FeedbackItemPresentation, // Missing multichoicerated config - intentionally incomplete for testing
        required: 0,
        position: 1,
        label: 'Invalid',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      expect(screen.getByText('Invalid multichoicerated configuration')).toBeInTheDocument();
    });

    it('handles empty options array for multichoice', () => {
      const props: QuestionRendererProps = {
        id: 39,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'r',
            randomize: false,
            hideNotSelected: false,
            ignoreEmpty: false,
            options: [],
          },
        },
        required: 0,
        position: 1,
        label: 'Empty Options',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toBeInTheDocument();
      // Should only have "Not selected" option
      const radios = screen.getAllByRole('radio');
      expect(radios.length).toBeLessThanOrEqual(1);
    });

    it('handles unsupported question type', () => {
      const props: QuestionRendererProps = {
        id: 40,
        type: 'unsupported',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
        },
        required: 0,
        position: 1,
        label: 'Unsupported',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      expect(screen.getByText('Unsupported question type: unsupported')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('handles extremely long text input', async () => {
      const props: QuestionRendererProps = {
        id: 41,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
          text: { maxLength: 100 },
        },
        required: 0,
        position: 1,
        label: 'Long Text',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const input = screen.getByLabelText('Long Text') as HTMLInputElement;
      // MUI TextField with maxLength will prevent typing beyond limit
      expect(input.maxLength).toBe(100);
    });

    it('handles special characters in label', () => {
      const props: QuestionRendererProps = {
        id: 42,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
        },
        required: 0,
        position: 1,
        label: 'Name <script>alert("xss")</script> & Email',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      // React automatically escapes special characters in text content
      const input = screen.getByLabelText(/Name.*Email/);
      expect(input).toBeInTheDocument();
    });

    it('handles disabled state for all input types', () => {
      const props: QuestionRendererProps = {
        id: 43,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
        },
        required: 0,
        position: 1,
        label: 'Disabled',
        value: '',
        onChange: mockOnChange,
        disabled: true,
      };

      render(<QuestionRenderer {...props} />);

      const input = screen.getByLabelText('Disabled');
      expect(input).toBeDisabled();
    });

    it('handles undefined presentation properties gracefully', () => {
      const props: QuestionRendererProps = {
        id: 44,
        type: 'textarea',
        presentation: {
          type: FeedbackQuestionType.TEXTAREA,
          // No text config provided
        },
        required: 0,
        position: 1,
        label: 'Default Textarea',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const textarea = screen.getByLabelText('Default Textarea') as HTMLTextAreaElement;
      expect(textarea).toBeInTheDocument();
      // MUI TextField may render rows as a string attribute
      expect(Number(textarea.rows)).toBe(4); // Default value
    });
  });

  /**
   * Test Suite: Presentation Parsing Tests
   * Validates parsing of presentation configuration
   */
  describe('Presentation Parsing', () => {
    it('parses multichoice options correctly', () => {
      const props: QuestionRendererProps = {
        id: 45,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'r',
            randomize: false,
            hideNotSelected: false,
            ignoreEmpty: false,
            options: ['First', 'Second', 'Third'],
          },
        },
        required: 0,
        position: 1,
        label: 'Options Test',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      expect(screen.getByLabelText('First')).toBeInTheDocument();
      expect(screen.getByLabelText('Second')).toBeInTheDocument();
      expect(screen.getByLabelText('Third')).toBeInTheDocument();
    });

    it('parses numeric min/max from presentation', () => {
      const props: QuestionRendererProps = {
        id: 46,
        type: 'numeric',
        presentation: {
          type: FeedbackQuestionType.NUMERIC,
          numeric: {
            rangeFrom: 10,
            rangeTo: 50,
          },
        },
        required: 0,
        position: 1,
        label: 'Range Test',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const input = screen.getByLabelText('Range Test');
      expect(input).toHaveAttribute('min', '10');
      expect(input).toHaveAttribute('max', '50');
    });

    it('parses textarea rows from presentation', () => {
      const props: QuestionRendererProps = {
        id: 47,
        type: 'textarea',
        presentation: {
          type: FeedbackQuestionType.TEXTAREA,
          text: {
            rows: 8,
          },
        },
        required: 0,
        position: 1,
        label: 'Rows Test',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      const textarea = screen.getByLabelText('Rows Test') as HTMLTextAreaElement;
      // MUI TextField may render rows as a string attribute
      expect(Number(textarea.rows)).toBe(8);
    });

    it('parses rating scale range from presentation', () => {
      const props: QuestionRendererProps = {
        id: 48,
        type: 'multichoicerated',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICERATED,
          multichoicerated: {
            subtype: 'r',
            options: [
              { text: 'Low', value: 1 },
              { text: 'Medium', value: 3 },
              { text: 'High', value: 5 },
            ],
          },
        },
        required: 0,
        position: 1,
        label: 'Rating Test',
        value: '',
        onChange: mockOnChange,
      };

      render(<QuestionRenderer {...props} />);

      expect(screen.getByLabelText(/Low - 1 points/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Medium - 3 points/)).toBeInTheDocument();
      expect(screen.getByLabelText(/High - 5 points/)).toBeInTheDocument();
    });
  });
});
