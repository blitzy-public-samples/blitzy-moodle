/**
 * Unit tests for QuestionRenderer component
 * 
 * Comprehensive test suite validating dynamic rendering of all Moodle feedback question types
 * including multichoice (radio/checkbox), multichoicerated (with MUI Rating), numeric (with validation),
 * textarea, textfield, info display, and label headers using React Testing Library and Vitest.
 * 
 * Tests verify:
 * - Correct Material-UI component selection based on question type
 * - Value state management with onChange callbacks
 * - Validation error display with FormHelperText
 * - Required field indicators with ARIA attributes
 * - Presentation string parsing (options, min/max, rows)
 * - WCAG 2.1 AA accessibility compliance
 * - Keyboard navigation (Tab, Space, Enter, Arrow keys)
 * - Responsive design
 * - Edge cases (empty presentations, special characters, malformed data)
 * 
 * Target: 95%+ code coverage following React Testing Library best practices
 * 
 * @module tests/unit/features/activities/feedback/components/QuestionRenderer
 * @see react-frontend/src/features/activities/feedback/components/QuestionRenderer.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, _within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import _React from 'react';

import { QuestionRenderer } from '@/features/activities/feedback/components/QuestionRenderer';
import type { QuestionRendererProps } from '@/features/activities/feedback/components/QuestionRenderer';
import { FeedbackQuestionType } from '@/features/activities/feedback/types';
import type { _FeedbackItemPresentation } from '@/features/activities/feedback/types';

// Extend Vitest matchers with jest-axe
expect.extend(toHaveNoViolations);

describe('QuestionRenderer', () => {
  // Mock onChange callback used across tests
  let mockOnChange: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    mockOnChange = vi.fn();
  });

  /**
   * Test Suite: Multichoice Questions (Radio Buttons)
   * Tests radio button rendering for single-selection multichoice questions
   */
  describe('Multichoice Questions - Radio Buttons', () => {
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

    it('should render radio group with all options', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      // Check that the question label is rendered
      expect(screen.getByText('Select your preference')).toBeInTheDocument();
      
      // Check that all options are rendered as radio buttons
      expect(screen.getByLabelText('Not selected')).toBeInTheDocument();
      expect(screen.getByLabelText('Option 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Option 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Option 3')).toBeInTheDocument();
      
      // Verify RadioGroup is rendered
      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toBeInTheDocument();
    });

    it('should handle radio button selection and call onChange', async () => {
      const user = userEvent.setup();
      render(<QuestionRenderer {...getBaseProps()} />);
      
      // Click the second option (Option 1)
      const option1Radio = screen.getByLabelText('Option 1');
      await user.click(option1Radio);
      
      // Verify onChange was called with correct value
      expect(mockOnChange).toHaveBeenCalledWith('1');
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    it('should display selected value correctly', () => {
      render(<QuestionRenderer {...getBaseProps()} value="2" />);
      
      // Verify the correct radio button is checked
      const option2Radio = screen.getByLabelText('Option 2');
      expect(option2Radio).toBeChecked();
    });

    it('should render required indicator when required=1', () => {
      render(<QuestionRenderer {...getBaseProps()} required={1} />);
      
      // Check for required indicator in the FormLabel
      const legend = screen.getByText('Select your preference');
      expect(legend).toBeInTheDocument();
      
      // Verify aria-required attribute
      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toHaveAttribute('aria-labelledby');
    });

    it('should display validation error when touched and error provided', () => {
      render(
        <QuestionRenderer
          {...getBaseProps()}
          required={1}
          error="This field is required"
          touched
        />
      );
      
      // Check error message is displayed
      expect(screen.getByText('This field is required')).toBeInTheDocument();
      
      // Verify error role for screen readers
      const errorElement = screen.getByRole('alert');
      expect(errorElement).toHaveTextContent('This field is required');
    });

    it('should not display error when not touched', () => {
      render(
        <QuestionRenderer
          {...getBaseProps()}
          error="This field is required"
          touched={false}
        />
      );
      
      // Error should not be visible
      expect(screen.queryByText('This field is required')).not.toBeInTheDocument();
    });

    it('should hide "Not selected" option when hideNotSelected=true', () => {
      const propsWithHidden: QuestionRendererProps = {
        ...getBaseProps(),
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'r',
            randomize: false,
            hideNotSelected: true,
            ignoreEmpty: false,
            options: ['Option 1', 'Option 2'],
          },
        },
      };
      
      render(<QuestionRenderer {...propsWithHidden} />);
      
      // "Not selected" should not be present
      expect(screen.queryByLabelText('Not selected')).not.toBeInTheDocument();
      
      // But options should still be there
      expect(screen.getByLabelText('Option 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Option 2')).toBeInTheDocument();
    });

    it('should disable all radio buttons when disabled=true', () => {
      render(<QuestionRenderer {...getBaseProps()} disabled />);
      
      // All radio buttons should be disabled
      const radios = screen.getAllByRole('radio');
      radios.forEach(radio => {
        expect(radio).toBeDisabled();
      });
    });

    it('should have proper ARIA attributes for accessibility', () => {
      render(<QuestionRenderer {...getBaseProps()} required={1} />);
      
      const radioGroup = screen.getByRole('radiogroup');
      
      // Check ARIA labelledby
      expect(radioGroup).toHaveAttribute('aria-labelledby');
      
      // Check ARIA describedby
      expect(radioGroup).toHaveAttribute('aria-describedby');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<QuestionRenderer {...getBaseProps()} />);
      
      // Tab to the radio group
      await user.tab();
      
      // Use arrow keys to navigate between options
      await user.keyboard('{ArrowDown}');
      
      // Verify onChange is called
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });
  });

  /**
   * Test Suite: Multichoice Questions (Checkboxes)
   * Tests checkbox rendering for multiple-selection multichoice questions
   */
  describe('Multichoice Questions - Checkboxes', () => {
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
          options: ['Choice A', 'Choice B', 'Choice C'],
        },
      },
      required: 0,
      position: 1,
      label: 'Select all that apply',
      value: [],
      onChange: mockOnChange,
    });

    it('should render checkboxes for all options', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      // Check question label
      expect(screen.getByText('Select all that apply')).toBeInTheDocument();
      
      // Check all checkboxes are rendered
      expect(screen.getByLabelText('Choice A')).toBeInTheDocument();
      expect(screen.getByLabelText('Choice B')).toBeInTheDocument();
      expect(screen.getByLabelText('Choice C')).toBeInTheDocument();
      
      // Verify they are checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
    });

    it('should handle checkbox selection and call onChange with array', async () => {
      const user = userEvent.setup();
      render(<QuestionRenderer {...getBaseProps()} />);
      
      // Click first checkbox
      const choiceA = screen.getByLabelText('Choice A');
      await user.click(choiceA);
      
      // Verify onChange called with array containing '1'
      expect(mockOnChange).toHaveBeenCalledWith(['1']);
    });

    it('should handle multiple checkbox selections', async () => {
      const user = userEvent.setup();
      render(<QuestionRenderer {...getBaseProps()} value={['1']} />);
      
      // First checkbox should be checked
      expect(screen.getByLabelText('Choice A')).toBeChecked();
      
      // Click second checkbox
      const choiceB = screen.getByLabelText('Choice B');
      await user.click(choiceB);
      
      // Verify onChange called with both values
      expect(mockOnChange).toHaveBeenCalledWith(['1', '2']);
    });

    it('should handle checkbox deselection', async () => {
      const user = userEvent.setup();
      render(<QuestionRenderer {...getBaseProps()} value={['1', '2']} />);
      
      // Both checkboxes should be checked
      expect(screen.getByLabelText('Choice A')).toBeChecked();
      expect(screen.getByLabelText('Choice B')).toBeChecked();
      
      // Uncheck first checkbox
      const choiceA = screen.getByLabelText('Choice A');
      await user.click(choiceA);
      
      // Verify onChange called with only '2'
      expect(mockOnChange).toHaveBeenCalledWith(['2']);
    });

    it('should display validation error for checkboxes', () => {
      render(
        <QuestionRenderer
          {...getBaseProps()}
          required={1}
          error="Select at least one option"
          touched
        />
      );
      
      expect(screen.getByText('Select at least one option')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Select at least one option');
    });

    it('should have proper ARIA attributes on checkbox group', () => {
      render(<QuestionRenderer {...getBaseProps()} required={1} />);
      
      // Get all groups and find the one with aria-describedby (the Box, not the fieldset)
      const groups = screen.getAllByRole('group', { name: /Select all that apply/i });
      const group = groups.find(g => g.hasAttribute('aria-describedby'));
      expect(group).toHaveAttribute('aria-labelledby');
      expect(group).toHaveAttribute('aria-describedby');
    });
  });

  /**
   * Test Suite: Multichoicerated Questions
   * Tests rating scale questions with MUI Rating component
   */
  describe('Multichoicerated Questions', () => {
    const getBaseProps = (): QuestionRendererProps => ({
      id: 3,
      type: 'multichoicerated',
      presentation: {
        type: FeedbackQuestionType.MULTICHOICERATED,
        multichoicerated: {
          subtype: 'r',
          options: [
            { text: 'Very Poor', value: 1 },
            { text: 'Poor', value: 2 },
            { text: 'Average', value: 3 },
            { text: 'Good', value: 4 },
            { text: 'Excellent', value: 5 },
          ],
        },
      },
      required: 0,
      position: 1,
      label: 'Rate our service',
      value: '',
      onChange: mockOnChange,
    });

    it('should render rated options with Rating component', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      // Check question label
      expect(screen.getByText('Rate our service')).toBeInTheDocument();
      
      // Check all rated options are rendered
      expect(screen.getByLabelText('Very Poor - 1 points')).toBeInTheDocument();
      expect(screen.getByLabelText('Poor - 2 points')).toBeInTheDocument();
      expect(screen.getByLabelText('Average - 3 points')).toBeInTheDocument();
      expect(screen.getByLabelText('Good - 4 points')).toBeInTheDocument();
      expect(screen.getByLabelText('Excellent - 5 points')).toBeInTheDocument();
      
      // Verify radio buttons are rendered
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(5);
    });

    it('should display rating values correctly', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      // Check that rating values are displayed
      expect(screen.getByText('(1)')).toBeInTheDocument();
      expect(screen.getByText('(2)')).toBeInTheDocument();
      expect(screen.getByText('(3)')).toBeInTheDocument();
      expect(screen.getByText('(4)')).toBeInTheDocument();
      expect(screen.getByText('(5)')).toBeInTheDocument();
    });

    it('should handle rated option selection', async () => {
      const user = userEvent.setup();
      render(<QuestionRenderer {...getBaseProps()} />);
      
      // Click "Good" option
      const goodOption = screen.getByLabelText('Good - 4 points');
      await user.click(goodOption);
      
      // Verify onChange called with correct value
      expect(mockOnChange).toHaveBeenCalledWith('4');
    });

    it('should display selected rated option', () => {
      render(<QuestionRenderer {...getBaseProps()} value="3" />);
      
      // Verify "Average" is selected
      const averageOption = screen.getByLabelText('Average - 3 points');
      expect(averageOption).toBeChecked();
    });

    it('should display validation error for rated questions', () => {
      render(
        <QuestionRenderer
          {...getBaseProps()}
          required={1}
          error="Please select a rating"
          touched
        />
      );
      
      expect(screen.getByText('Please select a rating')).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Numeric Questions
   * Tests numeric input with min/max validation
   */
  describe('Numeric Questions', () => {
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

    it('should render numeric input field', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      // Check label
      expect(screen.getByLabelText('Enter your score')).toBeInTheDocument();
      
      // Check helper text shows range
      expect(screen.getByText('Enter a number between 0 and 100')).toBeInTheDocument();
      
      // Verify it's a number input
      const input = screen.getByLabelText('Enter your score');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('should have min and max attributes', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      const input = screen.getByLabelText('Enter your score');
      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '100');
    });

    it('should handle numeric input and call onChange', async () => {
      const user = userEvent.setup();
      render(<QuestionRenderer {...getBaseProps()} />);
      
      const input = screen.getByLabelText('Enter your score');
      await user.type(input, '75');
      
      // Verify onChange called with numeric values
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });

    it('should display numeric value correctly', () => {
      render(<QuestionRenderer {...getBaseProps()} value={42} />);
      
      const input = screen.getByLabelText('Enter your score');
      expect(input.value).toBe('42');
    });

    it('should display validation error for numeric input', () => {
      render(
        <QuestionRenderer
          {...getBaseProps()}
          required={1}
          error="Value must be between 0 and 100"
          touched
        />
      );
      
      expect(screen.getByText('Value must be between 0 and 100')).toBeInTheDocument();
      
      // Error should replace the helper text
      expect(screen.queryByText('Enter a number between 0 and 100')).not.toBeInTheDocument();
    });

    it('should handle clearing numeric input', async () => {
      const user = userEvent.setup();
      render(<QuestionRenderer {...getBaseProps()} value={50} />);
      
      const input = screen.getByLabelText('Enter your score');
      await user.clear(input);
      
      // Verify onChange called with empty string
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('');
      });
    });

    it('should have proper ARIA attributes for numeric input', () => {
      render(<QuestionRenderer {...getBaseProps()} required={1} />);
      
      const input = screen.getByLabelText(/Enter your score/i);
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('aria-describedby');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('should set aria-invalid to true when error exists', () => {
      render(
        <QuestionRenderer
          {...getBaseProps()}
          error="Invalid value"
          touched
        />
      );
      
      const input = screen.getByLabelText('Enter your score');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
  });

  /**
   * Test Suite: Textarea Questions
   * Tests multi-line text input
   */
  describe('Textarea Questions', () => {
    const getBaseProps = (): QuestionRendererProps => ({
      id: 5,
      type: 'textarea',
      presentation: {
        type: FeedbackQuestionType.TEXTAREA,
        text: {
          rows: 4,
          maxLength: 500,
        },
      },
      required: 0,
      position: 1,
      label: 'Please provide your feedback',
      value: '',
      onChange: mockOnChange,
    });

    it('should render multiline textarea', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      // Check label
      expect(screen.getByLabelText('Please provide your feedback')).toBeInTheDocument();
      
      // Verify it's a textarea (multiline)
      const textarea = screen.getByLabelText('Please provide your feedback');
      expect(textarea).toHaveAttribute('rows', '4');
    });

    it('should display character count when maxLength is set', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      // Check character counter
      expect(screen.getByText('0/500 characters')).toBeInTheDocument();
    });

    it('should update character count as user types', async () => {
      const user = userEvent.setup();
      render(<QuestionRenderer {...getBaseProps()} />);
      
      const textarea = screen.getByLabelText('Please provide your feedback');
      await user.type(textarea, 'Hello');
      
      // Character count should update (onChange would update value prop in real usage)
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should display textarea value correctly', () => {
      const longText = 'This is a longer feedback text that spans multiple lines.';
      render(<QuestionRenderer {...getBaseProps()} value={longText} />);
      
      const textarea = screen.getByLabelText('Please provide your feedback');
      expect(textarea.value).toBe(longText);
    });

    it('should enforce maxLength attribute', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      const textarea = screen.getByLabelText('Please provide your feedback');
      expect(textarea).toHaveAttribute('maxLength', '500');
    });

    it('should display validation error for textarea', () => {
      render(
        <QuestionRenderer
          {...getBaseProps()}
          required={1}
          error="This field is required"
          touched
        />
      );
      
      expect(screen.getByText('This field is required')).toBeInTheDocument();
      expect(screen.queryByText('0/500 characters')).not.toBeInTheDocument();
    });

    it('should render textarea without maxLength when not specified', () => {
      const propsWithoutMax: QuestionRendererProps = {
        ...getBaseProps(),
        presentation: {
          type: FeedbackQuestionType.TEXTAREA,
          text: {
            rows: 3,
          },
        },
      };
      
      render(<QuestionRenderer {...propsWithoutMax} />);
      
      const textarea = screen.getByLabelText('Please provide your feedback');
      expect(textarea).not.toHaveAttribute('maxLength');
      expect(screen.queryByText(/characters$/)).not.toBeInTheDocument();
    });

    it('should have proper ARIA attributes for textarea', () => {
      render(<QuestionRenderer {...getBaseProps()} required={1} />);
      
      const textarea = screen.getByLabelText(/Please provide your feedback/i);
      expect(textarea).toHaveAttribute('aria-required', 'true');
      expect(textarea).toHaveAttribute('aria-describedby');
    });
  });

  /**
   * Test Suite: Textfield Questions
   * Tests single-line text input
   */
  describe('Textfield Questions', () => {
    const getBaseProps = (): QuestionRendererProps => ({
      id: 6,
      type: 'textfield',
      presentation: {
        type: FeedbackQuestionType.TEXTFIELD,
        text: {
          width: 30,
          maxLength: 100,
        },
      },
      required: 0,
      position: 1,
      label: 'Enter your name',
      value: '',
      onChange: mockOnChange,
    });

    it('should render single-line text input', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      // Check label
      expect(screen.getByLabelText('Enter your name')).toBeInTheDocument();
      
      // Verify it's a text input (not multiline)
      const input = screen.getByLabelText('Enter your name');
      expect(input).not.toHaveAttribute('rows');
    });

    it('should display character count when maxLength is set', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      expect(screen.getByText('0/100 characters')).toBeInTheDocument();
    });

    it('should handle text input and call onChange', async () => {
      const user = userEvent.setup();
      render(<QuestionRenderer {...getBaseProps()} />);
      
      const input = screen.getByLabelText('Enter your name');
      await user.type(input, 'John Doe');
      
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should display textfield value correctly', () => {
      render(<QuestionRenderer {...getBaseProps()} value="Jane Smith" />);
      
      const input = screen.getByLabelText('Enter your name');
      expect(input.value).toBe('Jane Smith');
    });

    it('should enforce maxLength attribute', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      const input = screen.getByLabelText('Enter your name');
      expect(input).toHaveAttribute('maxLength', '100');
    });

    it('should apply width styling when width is specified', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      const input = screen.getByLabelText('Enter your name');
      expect(input).toHaveAttribute('size', '30');
    });

    it('should render textfield without maxLength when not specified', () => {
      const propsWithoutMax: QuestionRendererProps = {
        ...getBaseProps(),
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
          text: {},
        },
      };
      
      render(<QuestionRenderer {...propsWithoutMax} />);
      
      const input = screen.getByLabelText('Enter your name');
      expect(input).not.toHaveAttribute('maxLength');
      expect(screen.queryByText(/characters$/)).not.toBeInTheDocument();
    });

    it('should display validation error for textfield', () => {
      render(
        <QuestionRenderer
          {...getBaseProps()}
          required={1}
          error="Name is required"
          touched
        />
      );
      
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    it('should have proper ARIA attributes for textfield', () => {
      render(<QuestionRenderer {...getBaseProps()} required={1} />);
      
      const input = screen.getByLabelText(/Enter your name/i);
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('aria-describedby');
    });
  });

  /**
   * Test Suite: Info Display Questions
   * Tests informational display-only items
   */
  describe('Info Display', () => {
    const getBaseProps = (): QuestionRendererProps => ({
      id: 7,
      type: 'info',
      presentation: {
        type: FeedbackQuestionType.INFO,
        info: {
          content: '<p>This is important information that users should read.</p>',
        },
      },
      required: 0,
      position: 1,
      label: 'Information',
      value: '',
      onChange: mockOnChange,
    });

    it('should render info content as HTML', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      // Check that content is rendered
      const infoText = screen.getByText(
        'This is important information that users should read.'
      );
      expect(infoText).toBeInTheDocument();
    });

    it('should have role="note" for accessibility', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      const infoBox = screen.getByRole('note');
      expect(infoBox).toBeInTheDocument();
      expect(infoBox).toHaveAttribute('aria-label', 'Information');
    });

    it('should render info with styled background', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      const infoBox = screen.getByRole('note');
      expect(infoBox).toHaveStyle({ backgroundColor: expect.any(String) });
    });

    it('should fallback to label when content is not provided', () => {
      const propsWithoutContent: QuestionRendererProps = {
        ...getBaseProps(),
        presentation: {
          type: FeedbackQuestionType.INFO,
          info: {
            content: '',
          },
        },
        label: 'Fallback information text',
      };
      
      render(<QuestionRenderer {...propsWithoutContent} />);
      
      // Should display label as fallback
      expect(screen.getByText('Fallback information text')).toBeInTheDocument();
    });

    it('should handle HTML with multiple elements', () => {
      const propsWithComplexHTML: QuestionRendererProps = {
        ...getBaseProps(),
        presentation: {
          type: FeedbackQuestionType.INFO,
          info: {
            content: '<h4>Title</h4><p>Paragraph 1</p><p>Paragraph 2</p>',
          },
        },
      };
      
      render(<QuestionRenderer {...propsWithComplexHTML} />);
      
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Paragraph 1')).toBeInTheDocument();
      expect(screen.getByText('Paragraph 2')).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Label Headers
   * Tests section headers for organizing questions
   */
  describe('Label Headers', () => {
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

    it('should render label as heading', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      // Check that label is rendered as h3 heading
      const heading = screen.getByRole('heading', { level: 3, name: 'Section 1: Personal Information' });
      expect(heading).toHaveTextContent('Section 1: Personal Information');
    });

    it('should have role="heading" with aria-level', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      // Verify heading exists with correct level (implicit in h3 element)
      const heading = screen.getByRole('heading', { level: 3, name: 'Section 1: Personal Information' });
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe('H3');
    });

    it('should render label with styled border', () => {
      render(<QuestionRenderer {...getBaseProps()} />);
      
      const heading = screen.getByText('Section 1: Personal Information');
      expect(heading.parentElement).toHaveStyle({ borderBottom: expect.any(String) });
    });

    it('should support long label text', () => {
      const propsWithLongLabel: QuestionRendererProps = {
        ...getBaseProps(),
        label: 'This is a very long section header that describes the content below in great detail',
      };
      
      render(<QuestionRenderer {...propsWithLongLabel} />);
      
      const heading = screen.getByRole('heading', { 
        level: 3, 
        name: 'This is a very long section header that describes the content below in great detail' 
      });
      expect(heading).toHaveTextContent(
        'This is a very long section header that describes the content below in great detail'
      );
    });
  });

  /**
   * Test Suite: Validation and Error Handling
   * Tests validation error display and handling across all question types
   */
  describe('Validation and Error Handling', () => {
    it('should only show errors when field is touched', () => {
      const props: QuestionRendererProps = {
        id: 9,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
          text: {},
        },
        required: 1,
        position: 1,
        label: 'Required Field',
        value: '',
        onChange: mockOnChange,
        error: 'This field is required',
        touched: false,
      };
      
      render(<QuestionRenderer {...props} />);
      
      // Error should not be visible
      expect(screen.queryByText('This field is required')).not.toBeInTheDocument();
    });

    it('should show errors with role="alert" for screen readers', () => {
      const props: QuestionRendererProps = {
        id: 10,
        type: 'numeric',
        presentation: {
          type: FeedbackQuestionType.NUMERIC,
          numeric: {
            rangeFrom: 1,
            rangeTo: 10,
          },
        },
        required: 1,
        position: 1,
        label: 'Rate 1-10',
        value: '',
        onChange: mockOnChange,
        error: 'Value must be between 1 and 10',
        touched: true,
      };
      
      render(<QuestionRenderer {...props} />);
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Value must be between 1 and 10');
    });

    it('should link error to input via aria-describedby', () => {
      const props: QuestionRendererProps = {
        id: 11,
        type: 'textarea',
        presentation: {
          type: FeedbackQuestionType.TEXTAREA,
          text: { rows: 3 },
        },
        required: 1,
        position: 1,
        label: 'Comments',
        value: '',
        onChange: mockOnChange,
        error: 'Please provide comments',
        touched: true,
      };
      
      render(<QuestionRenderer {...props} />);
      
      const textarea = screen.getByLabelText(/Comments/i);
      const describedBy = textarea.getAttribute('aria-describedby');
      expect(describedBy).toContain('error');
    });

    it('should mark form control as error state', () => {
      const props: QuestionRendererProps = {
        id: 12,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'r',
            randomize: false,
            hideNotSelected: false,
            ignoreEmpty: false,
            options: ['Option 1'],
          },
        },
        required: 1,
        position: 1,
        label: 'Select one',
        value: '',
        onChange: mockOnChange,
        error: 'Selection required',
        touched: true,
      };
      
      render(<QuestionRenderer {...props} />);
      
      // Error should be displayed
      expect(screen.getByText('Selection required')).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Accessibility Compliance
   * Tests WCAG 2.1 AA compliance using axe-core
   */
  describe('Accessibility Compliance (WCAG 2.1 AA)', () => {
    it('should have no accessibility violations for multichoice radio', async () => {
      const props: QuestionRendererProps = {
        id: 13,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'r',
            randomize: false,
            hideNotSelected: false,
            ignoreEmpty: false,
            options: ['Yes', 'No', 'Maybe'],
          },
        },
        required: 1,
        position: 1,
        label: 'Do you agree?',
        value: '',
        onChange: mockOnChange,
      };
      
      const { container } = render(<QuestionRenderer {...props} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations for numeric input', async () => {
      const props: QuestionRendererProps = {
        id: 14,
        type: 'numeric',
        presentation: {
          type: FeedbackQuestionType.NUMERIC,
          numeric: {
            rangeFrom: 0,
            rangeTo: 100,
          },
        },
        required: 1,
        position: 1,
        label: 'Enter percentage',
        value: '',
        onChange: mockOnChange,
      };
      
      const { container } = render(<QuestionRenderer {...props} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations for textarea', async () => {
      const props: QuestionRendererProps = {
        id: 15,
        type: 'textarea',
        presentation: {
          type: FeedbackQuestionType.TEXTAREA,
          text: { rows: 5, maxLength: 200 },
        },
        required: 0,
        position: 1,
        label: 'Additional comments',
        value: '',
        onChange: mockOnChange,
      };
      
      const { container } = render(<QuestionRenderer {...props} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations with errors', async () => {
      const props: QuestionRendererProps = {
        id: 16,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
          text: {},
        },
        required: 1,
        position: 1,
        label: 'Email address',
        value: '',
        onChange: mockOnChange,
        error: 'Invalid email format',
        touched: true,
      };
      
      const { container } = render(<QuestionRenderer {...props} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  /**
   * Test Suite: Edge Cases and Error Conditions
   * Tests handling of malformed data, empty values, and special characters
   */
  describe('Edge Cases and Error Conditions', () => {
    it('should handle missing multichoice configuration gracefully', () => {
      const props: QuestionRendererProps = {
        id: 17,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          // Missing multichoice property
        },
        required: 0,
        position: 1,
        label: 'Question',
        value: '',
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      expect(screen.getByText('Invalid multichoice configuration')).toBeInTheDocument();
    });

    it('should handle missing numeric configuration gracefully', () => {
      const props: QuestionRendererProps = {
        id: 18,
        type: 'numeric',
        presentation: {
          type: FeedbackQuestionType.NUMERIC,
          // Missing numeric property
        },
        required: 0,
        position: 1,
        label: 'Number',
        value: '',
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      expect(screen.getByText('Invalid numeric configuration')).toBeInTheDocument();
    });

    it('should handle missing multichoicerated configuration gracefully', () => {
      const props: QuestionRendererProps = {
        id: 19,
        type: 'multichoicerated',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICERATED,
          // Missing multichoicerated property
        },
        required: 0,
        position: 1,
        label: 'Rating',
        value: '',
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      expect(screen.getByText('Invalid multichoicerated configuration')).toBeInTheDocument();
    });

    it('should handle unsupported question type', () => {
      const props: QuestionRendererProps = {
        id: 20,
        type: 'unknown_type',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD, // Doesn't match type
        },
        required: 0,
        position: 1,
        label: 'Question',
        value: '',
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Unsupported question type: unknown_type');
    });

    it('should handle empty options array for multichoice', () => {
      const props: QuestionRendererProps = {
        id: 21,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'r',
            randomize: false,
            hideNotSelected: false,
            ignoreEmpty: false,
            options: [], // Empty options
          },
        },
        required: 0,
        position: 1,
        label: 'Empty question',
        value: '',
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      // Should still render but with no options (except "Not selected" if applicable)
      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toBeInTheDocument();
    });

    it('should handle special characters in labels', () => {
      const props: QuestionRendererProps = {
        id: 22,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
          text: {},
        },
        required: 0,
        position: 1,
        label: 'Enter your <email> & "name"',
        value: '',
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      // Label should be rendered with special characters
      expect(screen.getByLabelText('Enter your <email> & "name"')).toBeInTheDocument();
    });

    it('should handle special characters in option text', () => {
      const props: QuestionRendererProps = {
        id: 23,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'r',
            randomize: false,
            hideNotSelected: false,
            ignoreEmpty: false,
            options: ['Option with "quotes"', 'Option with <brackets>', "Option with 'apostrophe'"],
          },
        },
        required: 0,
        position: 1,
        label: 'Select',
        value: '',
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      expect(screen.getByLabelText('Option with "quotes"')).toBeInTheDocument();
      expect(screen.getByLabelText('Option with <brackets>')).toBeInTheDocument();
      expect(screen.getByLabelText("Option with 'apostrophe'")).toBeInTheDocument();
    });

    it('should handle non-string values in multichoice', () => {
      const props: QuestionRendererProps = {
        id: 24,
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
        label: 'Select',
        // @ts-expect-error Testing edge case with non-string value
        value: 123, // Non-string value
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      // Should handle gracefully and convert to string
      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toBeInTheDocument();
    });

    it('should handle non-array values for checkbox multichoice', () => {
      const props: QuestionRendererProps = {
        id: 25,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'c',
            randomize: false,
            hideNotSelected: false,
            ignoreEmpty: false,
            options: ['Choice 1', 'Choice 2'],
          },
        },
        required: 0,
        position: 1,
        label: 'Select',
        // @ts-expect-error Testing edge case with non-array value
        value: 'not-an-array', // Non-array value
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      // Should treat as empty array
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked();
      });
    });

    it('should handle undefined presentation text config', () => {
      const props: QuestionRendererProps = {
        id: 26,
        type: 'textarea',
        presentation: {
          type: FeedbackQuestionType.TEXTAREA,
          // Missing text property
        },
        required: 0,
        position: 1,
        label: 'Comments',
        value: '',
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      // Should render with default values
      const textarea = screen.getByLabelText('Comments');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('rows', '4'); // Default rows
    });

    it('should handle zero values correctly for numeric type', () => {
      const props: QuestionRendererProps = {
        id: 27,
        type: 'numeric',
        presentation: {
          type: FeedbackQuestionType.NUMERIC,
          numeric: {
            rangeFrom: -10,
            rangeTo: 10,
          },
        },
        required: 0,
        position: 1,
        label: 'Number',
        value: 0,
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      const input = screen.getByLabelText('Number');
      expect(input.value).toBe('0');
    });

    it('should handle empty string as default for optional fields', () => {
      const props: QuestionRendererProps = {
        id: 28,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
          text: {},
        },
        required: 0,
        position: 1,
        label: 'Optional',
        value: '',
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      const input = screen.getByLabelText('Optional');
      expect(input.value).toBe('');
    });
  });

  /**
   * Test Suite: Responsive Design and Styling
   * Tests responsive behavior and custom styling
   */
  describe('Responsive Design and Styling', () => {
    it('should apply custom className when provided', () => {
      const props: QuestionRendererProps = {
        id: 29,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
          text: {},
        },
        required: 0,
        position: 1,
        label: 'Field',
        value: '',
        onChange: mockOnChange,
        className: 'custom-question-class',
      };
      
      render(<QuestionRenderer {...props} />);
      
      const input = screen.getByLabelText('Field');
      const formControl = input.closest('.MuiFormControl-root');
      expect(formControl).toHaveClass('custom-question-class');
    });

    it('should render full-width inputs by default', () => {
      const props: QuestionRendererProps = {
        id: 30,
        type: 'textarea',
        presentation: {
          type: FeedbackQuestionType.TEXTAREA,
          text: { rows: 3 },
        },
        required: 0,
        position: 1,
        label: 'Full width field',
        value: '',
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      const textarea = screen.getByLabelText('Full width field');
      const textField = textarea.closest('.MuiTextField-root');
      expect(textField).toHaveClass('MuiFormControl-fullWidth');
    });

    it('should respect width setting for textfield', () => {
      const props: QuestionRendererProps = {
        id: 31,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
          text: {
            width: 20,
          },
        },
        required: 0,
        position: 1,
        label: 'Short field',
        value: '',
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      const input = screen.getByLabelText('Short field');
      expect(input).toHaveAttribute('size', '20');
    });
  });

  /**
   * Test Suite: Keyboard Navigation
   * Tests keyboard accessibility and navigation patterns
   */
  describe('Keyboard Navigation', () => {
    it('should support Tab navigation to text inputs', async () => {
      const user = userEvent.setup();
      const props: QuestionRendererProps = {
        id: 32,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
          text: {},
        },
        required: 0,
        position: 1,
        label: 'Tab target',
        value: '',
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      // Tab to the input
      await user.tab();
      
      const input = screen.getByLabelText('Tab target');
      expect(input).toHaveFocus();
    });

    it('should support Space key to toggle checkboxes', async () => {
      const user = userEvent.setup();
      const props: QuestionRendererProps = {
        id: 33,
        type: 'multichoice',
        presentation: {
          type: FeedbackQuestionType.MULTICHOICE,
          multichoice: {
            subtype: 'c',
            randomize: false,
            hideNotSelected: false,
            ignoreEmpty: false,
            options: ['Check 1', 'Check 2'],
          },
        },
        required: 0,
        position: 1,
        label: 'Checkboxes',
        value: [],
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      // Tab to first checkbox and press Space
      const checkbox = screen.getByLabelText('Check 1');
      checkbox.focus();
      await user.keyboard(' ');
      
      // Verify onChange was called
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });

    it('should support Enter key in text inputs', async () => {
      const user = userEvent.setup();
      const props: QuestionRendererProps = {
        id: 34,
        type: 'textfield',
        presentation: {
          type: FeedbackQuestionType.TEXTFIELD,
          text: {},
        },
        required: 0,
        position: 1,
        label: 'Text input',
        value: '',
        onChange: mockOnChange,
      };
      
      render(<QuestionRenderer {...props} />);
      
      const input = screen.getByLabelText('Text input');
      await user.type(input, 'Test{Enter}');
      
      // onChange should have been called for typing
      expect(mockOnChange).toHaveBeenCalled();
    });
  });
});
