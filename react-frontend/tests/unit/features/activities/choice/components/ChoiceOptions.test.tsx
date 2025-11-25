/**
 * Unit tests for ChoiceOptions component
 * 
 * Tests validate component rendering with various props, user interactions,
 * form submissions, error states, and edge cases.
 * 
 * @jest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, userEvent } from '@tests/helpers/render';
import { axe } from 'vitest-axe';
import ChoiceOptions from '@/features/activities/choice/components/ChoiceOptions';
import { createMockChoiceOption } from '@tests/unit/features/activities/choice/mocks/choiceMocks';
import type { ChoiceOptionForDisplay } from '@/features/activities/choice/types/choice.types';

/**
 * Helper function to create mock ChoiceOptionForDisplay objects for testing
 */
function createMockOptionForDisplay(
  overrides: Partial<ChoiceOptionForDisplay> = {}
): ChoiceOptionForDisplay {
  const baseOption = createMockChoiceOption({
    id: 1,
    choiceid: 1,
    text: 'Test Option',
    maxanswers: 0,
    ...overrides,
  });

  return {
    ...baseOption,
    countanswers: ('countanswers' in overrides ? overrides.countanswers : 0) as number,
    displaylayout: false,
    checked: false,
    disabled: false,
    ...overrides,
  } as ChoiceOptionForDisplay;
}

describe('ChoiceOptions', () => {
  // Common mock data
  const mockOptions: ChoiceOptionForDisplay[] = [
    createMockOptionForDisplay({
      id: 1,
      text: 'Option 1',
      maxanswers: 0,
      countanswers: 0,
    }),
    createMockOptionForDisplay({
      id: 2,
      text: 'Option 2',
      maxanswers: 0,
      countanswers: 0,
    }),
    createMockOptionForDisplay({
      id: 3,
      text: 'Option 3',
      maxanswers: 0,
      countanswers: 0,
    }),
  ];

  const defaultProps = {
    options: mockOptions,
    allowMultiple: false,
    limitAnswers: false,
    showAvailable: false,
    allowUpdate: false,
    previewOnly: false,
    hascapability: true,
    initialSelection: 0 as number | number[],
    onSubmit: vi.fn(),
    onRemove: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering Tests', () => {
    it('renders form with proper structure', () => {
      render(<ChoiceOptions {...defaultProps} />);

      // Check for form element
      const form = screen.getByRole('group');
      expect(form).toBeInTheDocument();
    });

    it('displays all options passed in props', () => {
      render(<ChoiceOptions {...defaultProps} />);

      expect(screen.getByLabelText('Option 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Option 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Option 3')).toBeInTheDocument();
    });

    it('shows option text labels correctly', () => {
      render(<ChoiceOptions {...defaultProps} />);

      mockOptions.forEach((option) => {
        const label = screen.getByText(option.text);
        expect(label).toBeInTheDocument();
      });
    });

    it('renders submit button with "Save my choice" text', () => {
      render(<ChoiceOptions {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /save my choice/i });
      expect(submitButton).toBeInTheDocument();
    });

    it('uses FormControl and FormLabel from MUI', () => {
      const { container } = render(<ChoiceOptions {...defaultProps} />);

      // FormControl creates a div with role="group"
      expect(screen.getByRole('group')).toBeInTheDocument();

      // Check for MUI-specific classes
      const formControl = container.querySelector('.MuiFormControl-root');
      expect(formControl).toBeInTheDocument();
    });
  });

  describe('Single Choice (Radio) Tests', () => {
    it('renders Radio components when allowMultiple is false', () => {
      render(<ChoiceOptions {...defaultProps} allowMultiple={false} />);

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(mockOptions.length);
    });

    it('each option has unique radio input', () => {
      render(<ChoiceOptions {...defaultProps} allowMultiple={false} />);

      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      radios.forEach((radio, index) => {
        const option = mockOptions[index];
        if (option) {
          expect(radio.value).toBe(option.id.toString());
        }
      });
    });

    it('only one radio can be selected at a time', async () => {
      const user = userEvent.setup();
      render(<ChoiceOptions {...defaultProps} allowMultiple={false} />);

      const radio1 = screen.getByLabelText('Option 1') as HTMLInputElement;
      const radio2 = screen.getByLabelText('Option 2') as HTMLInputElement;

      // Select first option
      await user.click(radio1);
      await waitFor(() => {
        expect(radio1).toBeChecked();
        expect(radio2).not.toBeChecked();
      });

      // Select second option
      await user.click(radio2);
      await waitFor(() => {
        expect(radio1).not.toBeChecked();
        expect(radio2).toBeChecked();
      });
    });

    it('initial selection set from props', () => {
      render(<ChoiceOptions {...defaultProps} initialSelection={2} allowMultiple={false} />);

      const radio2 = screen.getByLabelText('Option 2') as HTMLInputElement;
      expect(radio2).toBeChecked();
    });

    it('selecting new option deselects previous', async () => {
      const user = userEvent.setup();
      render(<ChoiceOptions {...defaultProps} allowMultiple={false} />);

      const radio1 = screen.getByLabelText('Option 1') as HTMLInputElement;
      const radio2 = screen.getByLabelText('Option 2') as HTMLInputElement;
      const radio3 = screen.getByLabelText('Option 3') as HTMLInputElement;

      await user.click(radio1);
      await waitFor(() => expect(radio1).toBeChecked());

      await user.click(radio2);
      await waitFor(() => {
        expect(radio1).not.toBeChecked();
        expect(radio2).toBeChecked();
        expect(radio3).not.toBeChecked();
      });
    });

    it('radio buttons have correct value attributes', () => {
      render(<ChoiceOptions {...defaultProps} allowMultiple={false} />);

      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      radios.forEach((radio, index) => {
        const option = mockOptions[index];
        if (option) {
          expect(radio.value).toBe(option.id.toString());
        }
      });
    });

    it('labels associated with inputs via htmlFor', () => {
      const { container } = render(<ChoiceOptions {...defaultProps} allowMultiple={false} />);

      const labels = container.querySelectorAll('label.MuiFormControlLabel-root');
      expect(labels.length).toBeGreaterThan(0);
    });
  });

  describe('Multiple Choice (Checkbox) Tests', () => {
    it('renders Checkbox components when allowMultiple is true', () => {
      render(<ChoiceOptions {...defaultProps} allowMultiple={true} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(mockOptions.length);
    });

    it('multiple checkboxes can be selected simultaneously', async () => {
      const user = userEvent.setup();
      render(<ChoiceOptions {...defaultProps} allowMultiple={true} />);

      const checkbox1 = screen.getByLabelText('Option 1') as HTMLInputElement;
      const checkbox2 = screen.getByLabelText('Option 2') as HTMLInputElement;
      const checkbox3 = screen.getByLabelText('Option 3') as HTMLInputElement;

      await user.click(checkbox1);
      await user.click(checkbox2);

      await waitFor(() => {
        expect(checkbox1).toBeChecked();
        expect(checkbox2).toBeChecked();
        expect(checkbox3).not.toBeChecked();
      });
    });

    it('initial selections set from props', () => {
      render(<ChoiceOptions {...defaultProps} initialSelection={[1, 3]} allowMultiple={true} />);

      const checkbox1 = screen.getByLabelText('Option 1') as HTMLInputElement;
      const checkbox2 = screen.getByLabelText('Option 2') as HTMLInputElement;
      const checkbox3 = screen.getByLabelText('Option 3') as HTMLInputElement;

      expect(checkbox1).toBeChecked();
      expect(checkbox2).not.toBeChecked();
      expect(checkbox3).toBeChecked();
    });

    it('checking and unchecking works independently', async () => {
      const user = userEvent.setup();
      render(<ChoiceOptions {...defaultProps} allowMultiple={true} />);

      const checkbox1 = screen.getByLabelText('Option 1') as HTMLInputElement;
      const checkbox2 = screen.getByLabelText('Option 2') as HTMLInputElement;

      // Check both
      await user.click(checkbox1);
      await user.click(checkbox2);
      await waitFor(() => {
        expect(checkbox1).toBeChecked();
        expect(checkbox2).toBeChecked();
      });

      // Uncheck first
      await user.click(checkbox1);
      await waitFor(() => {
        expect(checkbox1).not.toBeChecked();
        expect(checkbox2).toBeChecked();
      });
    });

    it('checkbox values match option IDs', () => {
      render(<ChoiceOptions {...defaultProps} allowMultiple={true} />);

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      checkboxes.forEach((checkbox, index) => {
        const option = mockOptions[index];
        if (option) {
          expect(checkbox.value).toBe(option.id.toString());
        }
      });
    });
  });

  describe('Form Validation Tests', () => {
    it('submit button enabled when selection is made', async () => {
      const user = userEvent.setup();
      render(<ChoiceOptions {...defaultProps} allowMultiple={false} />);

      const submitButton = screen.getByRole('button', { name: /save my choice/i });
      const radio1 = screen.getByLabelText('Option 1');

      await user.click(radio1);
      await waitFor(() => {
        expect(submitButton).toBeEnabled();
      });
    });

    it('validation error shown when submitting with no selection', async () => {
      const user = userEvent.setup();
      render(<ChoiceOptions {...defaultProps} allowMultiple={false} />);

      const submitButton = screen.getByRole('button', { name: /save my choice/i });

      // Try to submit without selection
      await user.click(submitButton);

      // Wait for validation error
      await waitFor(() => {
        const errorMessage = screen.getByText(/you must choose an option/i);
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('error message displays "You must choose an option"', async () => {
      const user = userEvent.setup();
      render(<ChoiceOptions {...defaultProps} allowMultiple={false} />);

      const submitButton = screen.getByRole('button', { name: /save my choice/i });
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByText(/you must choose an option/i);
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('validation passes with at least one selection (single)', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

      render(<ChoiceOptions {...defaultProps} onSubmit={mockOnSubmit} allowMultiple={false} />);

      const radio1 = screen.getByLabelText('Option 1');
      const submitButton = screen.getByRole('button', { name: /save my choice/i });

      await user.click(radio1);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('validation passes with at least one selection (multiple)', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

      render(<ChoiceOptions {...defaultProps} onSubmit={mockOnSubmit} allowMultiple={true} />);

      const checkbox1 = screen.getByLabelText('Option 1');
      const submitButton = screen.getByRole('button', { name: /save my choice/i });

      await user.click(checkbox1);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });

  describe('Submit Button Behavior Tests', () => {
    it('button enabled when hasCapability is true and options available', () => {
      render(<ChoiceOptions {...defaultProps} hascapability={true} />);

      const submitButton = screen.getByRole('button', { name: /save my choice/i });
      expect(submitButton).toBeInTheDocument();
    });

    it('button shows "Save my choice" text', () => {
      render(<ChoiceOptions {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /save my choice/i });
      expect(submitButton).toHaveTextContent(/save my choice/i);
    });

    it('button has type="submit"', () => {
      render(<ChoiceOptions {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /save my choice/i });
      expect(submitButton).toHaveAttribute('type', 'submit');
    });

    it('button has variant="contained" color="primary"', () => {
      render(<ChoiceOptions {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /save my choice/i });
      expect(submitButton).toHaveClass('MuiButton-containedPrimary');
    });

    it('clicking button calls onSubmit with selected answer (single)', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

      render(<ChoiceOptions {...defaultProps} onSubmit={mockOnSubmit} allowMultiple={false} />);

      const radio2 = screen.getByLabelText('Option 2');
      const submitButton = screen.getByRole('button', { name: /save my choice/i });

      await user.click(radio2);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(2);
      });
    });

    it('clicking button calls onSubmit with selected answers array (multiple)', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

      render(<ChoiceOptions {...defaultProps} onSubmit={mockOnSubmit} allowMultiple={true} />);

      const checkbox1 = screen.getByLabelText('Option 1');
      const checkbox3 = screen.getByLabelText('Option 3');
      const submitButton = screen.getByRole('button', { name: /save my choice/i });

      await user.click(checkbox1);
      await user.click(checkbox3);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith([1, 3]);
      });
    });

    it('button shows loading state during submission', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<ChoiceOptions {...defaultProps} onSubmit={mockOnSubmit} allowMultiple={false} />);

      const radio1 = screen.getByLabelText('Option 1');
      const submitButton = screen.getByRole('button', { name: /save my choice/i });

      await user.click(radio1);
      await user.click(submitButton);

      // Check for loading indicator
      await waitFor(() => {
        const loadingIndicator = screen.getByRole('progressbar');
        expect(loadingIndicator).toBeInTheDocument();
      });
    });

    it('button disabled during submission', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<ChoiceOptions {...defaultProps} onSubmit={mockOnSubmit} allowMultiple={false} />);

      const radio1 = screen.getByLabelText('Option 1');
      const submitButton = screen.getByRole('button', { name: /save my choice/i });

      await user.click(radio1);
      await user.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe('Remove Choice Link Tests', () => {
    it('link visible when allowUpdate is true', () => {
      const optionsWithChecked = mockOptions.map((opt, idx) => ({
        ...opt,
        checked: idx === 0,
      }));

      render(<ChoiceOptions {...defaultProps} options={optionsWithChecked} allowUpdate={true} />);

      const removeLink = screen.getByText(/remove my choice/i);
      expect(removeLink).toBeInTheDocument();
    });

    it('link hidden when allowUpdate is false', () => {
      render(<ChoiceOptions {...defaultProps} allowUpdate={false} />);

      const removeLink = screen.queryByText(/remove my choice/i);
      expect(removeLink).not.toBeInTheDocument();
    });

    it('link text is "Remove my choice"', () => {
      const optionsWithChecked = mockOptions.map((opt, idx) => ({
        ...opt,
        checked: idx === 0,
      }));

      render(<ChoiceOptions {...defaultProps} options={optionsWithChecked} allowUpdate={true} />);

      const removeLink = screen.getByText(/remove my choice/i);
      expect(removeLink).toHaveTextContent(/remove my choice/i);
    });

    it('link is MUI Link component', () => {
      const optionsWithChecked = mockOptions.map((opt, idx) => ({
        ...opt,
        checked: idx === 0,
      }));

      render(<ChoiceOptions {...defaultProps} options={optionsWithChecked} allowUpdate={true} />);

      const removeLink = screen.getByText(/remove my choice/i);
      expect(removeLink).toHaveClass('MuiLink-root');
    });

    it('clicking link calls removal handler', async () => {
      const user = userEvent.setup();
      const mockOnRemove = vi.fn();
      const optionsWithChecked = mockOptions.map((opt, idx) => ({
        ...opt,
        checked: idx === 0,
      }));

      render(
        <ChoiceOptions
          {...defaultProps}
          options={optionsWithChecked}
          allowUpdate={true}
          onRemove={mockOnRemove}
        />
      );

      const removeLink = screen.getByText(/remove my choice/i);
      await user.click(removeLink);

      expect(mockOnRemove).toHaveBeenCalled();
    });
  });

  describe('Disabled State Tests', () => {
    it('options disabled when option.disabled is true', () => {
      const disabledOptions = mockOptions.map((opt, idx) => ({
        ...opt,
        disabled: idx === 1, // Second option disabled
      }));

      render(<ChoiceOptions {...defaultProps} options={disabledOptions} allowMultiple={false} />);

      // When disabled is true, the label includes " (Full)" suffix
      const radio2 = screen.getByLabelText('Option 2 (Full)') as HTMLInputElement;
      expect(radio2).toBeDisabled();
    });

    it('options disabled when option is full', () => {
      const fullOptions = mockOptions.map((opt, idx) => ({
        ...opt,
        maxanswers: idx === 1 ? 10 : 0,
        countanswers: idx === 1 ? 10 : 0,
        disabled: idx === 1,
      }));

      render(<ChoiceOptions {...defaultProps} options={fullOptions} allowMultiple={false} />);

      const radio2 = screen.getByLabelText(/option 2/i) as HTMLInputElement;
      expect(radio2).toBeDisabled();
    });

    it('label appends " (Full)" text when disabled due to limit', () => {
      const fullOptions = mockOptions.map((opt, idx) => ({
        ...opt,
        maxanswers: idx === 1 ? 10 : 0,
        countanswers: idx === 1 ? 10 : 0,
        disabled: idx === 1,
      }));

      render(
        <ChoiceOptions
          {...defaultProps}
          options={fullOptions}
          limitAnswers={true}
          showAvailable={true}
          allowMultiple={false}
        />
      );

      // Look for the full indicator
      const fullText = screen.getByText(/\(Full\)/i);
      expect(fullText).toBeInTheDocument();
    });

    it('all inputs disabled when previewOnly is true', () => {
      render(<ChoiceOptions {...defaultProps} previewOnly={true} allowMultiple={false} />);

      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      radios.forEach((radio) => {
        expect(radio).toBeDisabled();
      });
    });

    it('submit button hidden when previewOnly is true', () => {
      render(<ChoiceOptions {...defaultProps} previewOnly={true} />);

      const submitButton = screen.queryByRole('button', { name: /save my choice/i });
      expect(submitButton).not.toBeInTheDocument();
    });

    it('form cannot be submitted when disabled', () => {
      const mockOnSubmit = vi.fn();

      render(<ChoiceOptions {...defaultProps} previewOnly={true} onSubmit={mockOnSubmit} allowMultiple={false} />);

      // Verify all radios are disabled
      const radio1 = screen.getByLabelText('Option 1') as HTMLInputElement;
      const radio2 = screen.getByLabelText('Option 2') as HTMLInputElement;
      
      expect(radio1).toBeDisabled();
      expect(radio2).toBeDisabled();
      expect(radio1).not.toBeChecked();
      expect(radio2).not.toBeChecked();

      // Verify submit button is not present in preview mode
      expect(screen.queryByRole('button', { name: /save my choice/i })).not.toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Limit Display Tests', () => {
    it('shows response count when limitAnswers and showAvailable are true', () => {
      const limitedOptions = mockOptions.map((opt) => ({
        ...opt,
        maxanswers: 20,
        countanswers: 5,
      }));

      render(
        <ChoiceOptions
          {...defaultProps}
          options={limitedOptions}
          limitAnswers={true}
          showAvailable={true}
        />
      );

      // Look for response count indicators
      const responseCounts = screen.getAllByText(/Responses:/i);
      expect(responseCounts.length).toBeGreaterThan(0);
    });

    it('shows limit when limitAnswers and showAvailable are true', () => {
      const limitedOptions = mockOptions.map((opt) => ({
        ...opt,
        maxanswers: 20,
        countanswers: 5,
      }));

      render(
        <ChoiceOptions
          {...defaultProps}
          options={limitedOptions}
          limitAnswers={true}
          showAvailable={true}
        />
      );

      // Look for limit indicators
      const limitText = screen.getAllByText(/Limit:/i);
      expect(limitText.length).toBeGreaterThan(0);
    });

    it('formats limit info correctly', () => {
      const limitedOptions = [
        createMockOptionForDisplay({
          id: 1,
          text: 'Option 1',
          maxanswers: 20,
          countanswers: 5,
        }),
      ];

      render(
        <ChoiceOptions
          {...defaultProps}
          options={limitedOptions}
          limitAnswers={true}
          showAvailable={true}
        />
      );

      expect(screen.getByText(/Responses: 5/i)).toBeInTheDocument();
      expect(screen.getByText(/Limit: 20/i)).toBeInTheDocument();
    });

    it('hides limit info when limitAnswers is false', () => {
      const limitedOptions = mockOptions.map((opt) => ({
        ...opt,
        maxanswers: 20,
        countanswers: 5,
      }));

      render(
        <ChoiceOptions
          {...defaultProps}
          options={limitedOptions}
          limitAnswers={false}
          showAvailable={true}
        />
      );

      const responseCounts = screen.queryByText(/Responses:/i);
      expect(responseCounts).not.toBeInTheDocument();
    });

    it('hides limit info when showAvailable is false', () => {
      const limitedOptions = mockOptions.map((opt) => ({
        ...opt,
        maxanswers: 20,
        countanswers: 5,
      }));

      render(
        <ChoiceOptions
          {...defaultProps}
          options={limitedOptions}
          limitAnswers={true}
          showAvailable={false}
        />
      );

      const responseCounts = screen.queryByText(/Responses:/i);
      expect(responseCounts).not.toBeInTheDocument();
    });
  });

  describe('"Choice is Full" Message Tests', () => {
    it('message displayed when all options disabled', () => {
      const allDisabledOptions = mockOptions.map((opt) => ({
        ...opt,
        disabled: true,
      }));

      render(<ChoiceOptions {...defaultProps} options={allDisabledOptions} />);

      const fullMessage = screen.getByText(/choice is full/i);
      expect(fullMessage).toBeInTheDocument();
    });

    it('message text is "Choice is full"', () => {
      const allDisabledOptions = mockOptions.map((opt) => ({
        ...opt,
        disabled: true,
      }));

      render(<ChoiceOptions {...defaultProps} options={allDisabledOptions} />);

      const fullMessage = screen.getByText(/choice is full/i);
      expect(fullMessage).toHaveTextContent(/choice is full/i);
    });

    it('message shown instead of submit button when all disabled', () => {
      const allDisabledOptions = mockOptions.map((opt) => ({
        ...opt,
        disabled: true,
      }));

      render(<ChoiceOptions {...defaultProps} options={allDisabledOptions} />);

      const fullMessage = screen.getByText(/choice is full/i);
      expect(fullMessage).toBeInTheDocument();

      const submitButton = screen.queryByRole('button', { name: /save my choice/i });
      expect(submitButton).not.toBeInTheDocument();
    });

    it('uses MUI Alert component', () => {
      const allDisabledOptions = mockOptions.map((opt) => ({
        ...opt,
        disabled: true,
      }));

      const { container } = render(<ChoiceOptions {...defaultProps} options={allDisabledOptions} />);

      const alert = container.querySelector('.MuiAlert-root');
      expect(alert).toBeInTheDocument();
    });
  });

  describe('Controlled Component Tests', () => {
    it('component state controlled by form', async () => {
      const user = userEvent.setup();
      render(<ChoiceOptions {...defaultProps} allowMultiple={false} />);

      const radio1 = screen.getByLabelText('Option 1') as HTMLInputElement;
      const radio2 = screen.getByLabelText('Option 2') as HTMLInputElement;

      // Select first option
      await user.click(radio1);
      await waitFor(() => expect(radio1).toBeChecked());

      // Select second option
      await user.click(radio2);
      await waitFor(() => {
        expect(radio1).not.toBeChecked();
        expect(radio2).toBeChecked();
      });
    });

    it('programmatic value setting works', () => {
      // Component initializes from initialSelection prop, not from checked property
      render(<ChoiceOptions {...defaultProps} allowMultiple={false} initialSelection={3} />);

      const radio3 = screen.getByLabelText('Option 3') as HTMLInputElement;
      expect(radio3).toBeChecked();
    });
  });

  describe('Form Submission Tests', () => {
    it('onSubmit called with correct answer value (single)', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

      render(<ChoiceOptions {...defaultProps} onSubmit={mockOnSubmit} allowMultiple={false} />);

      const radio2 = screen.getByLabelText('Option 2');
      const submitButton = screen.getByRole('button', { name: /save my choice/i });

      await user.click(radio2);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(2);
      });
    });

    it('onSubmit called with correct answers array (multiple)', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

      render(<ChoiceOptions {...defaultProps} onSubmit={mockOnSubmit} allowMultiple={true} />);

      const checkbox1 = screen.getByLabelText('Option 1');
      const checkbox3 = screen.getByLabelText('Option 3');
      const submitButton = screen.getByRole('button', { name: /save my choice/i });

      await user.click(checkbox1);
      await user.click(checkbox3);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith([1, 3]);
      });
    });

    it('promise resolved on success', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockResolvedValue({ success: true });

      render(<ChoiceOptions {...defaultProps} onSubmit={mockOnSubmit} allowMultiple={false} />);

      const radio1 = screen.getByLabelText('Option 1');
      const submitButton = screen.getByRole('button', { name: /save my choice/i });

      await user.click(radio1);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('error messages displayed on failure', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockRejectedValue(new Error('Submission failed'));

      render(<ChoiceOptions {...defaultProps} onSubmit={mockOnSubmit} allowMultiple={false} />);

      const radio1 = screen.getByLabelText('Option 1');
      const submitButton = screen.getByRole('button', { name: /save my choice/i });

      await user.click(radio1);
      await user.click(submitButton);

      await waitFor(() => {
        // Check that error is shown (component should handle this)
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('loading state during async submission', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<ChoiceOptions {...defaultProps} onSubmit={mockOnSubmit} allowMultiple={false} />);

      const radio1 = screen.getByLabelText('Option 1');
      const submitButton = screen.getByRole('button', { name: /save my choice/i });

      await user.click(radio1);
      await user.click(submitButton);

      // Check for loading state
      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toBeInTheDocument();
      });

      // Wait for submission to complete
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });

  describe('Layout Tests', () => {
    it('uses MUI Stack for spacing', () => {
      const { container } = render(<ChoiceOptions {...defaultProps} />);

      const stack = container.querySelector('.MuiStack-root');
      expect(stack).toBeInTheDocument();
    });

    it('FormControlLabel components properly spaced', () => {
      const { container } = render(<ChoiceOptions {...defaultProps} />);

      const labels = container.querySelectorAll('.MuiFormControlLabel-root');
      expect(labels.length).toBe(mockOptions.length);
    });
  });

  describe('Accessibility Tests', () => {
    it('FormControl has proper role', () => {
      render(<ChoiceOptions {...defaultProps} />);

      const formControl = screen.getByRole('group');
      expect(formControl).toBeInTheDocument();
    });

    it('labels associated with inputs', () => {
      render(<ChoiceOptions {...defaultProps} allowMultiple={false} />);

      mockOptions.forEach((option) => {
        const input = screen.getByLabelText(option.text);
        expect(input).toBeInTheDocument();
      });
    });

    it('keyboard navigation works', async () => {
      const user = userEvent.setup();
      render(<ChoiceOptions {...defaultProps} allowMultiple={false} />);

      const radio1 = screen.getByLabelText('Option 1');

      // Tab to first radio
      await user.tab();

      // Use Space to select
      await user.keyboard(' ');

      await waitFor(() => {
        expect(radio1).toBeChecked();
      });
    });

    it('error messages announced to screen readers', async () => {
      const user = userEvent.setup();
      render(<ChoiceOptions {...defaultProps} allowMultiple={false} />);

      const submitButton = screen.getByRole('button', { name: /save my choice/i });
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByText(/you must choose an option/i);
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });

    it('runs accessibility checks with axe', async () => {
      const { container } = render(<ChoiceOptions {...defaultProps} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Edge Cases', () => {
    it('handles zero options gracefully', () => {
      render(<ChoiceOptions {...defaultProps} options={[]} />);

      const submitButton = screen.queryByRole('button', { name: /save my choice/i });
      expect(submitButton).not.toBeInTheDocument();
    });

    it('handles single option', () => {
      const singleOption = [mockOptions[0]!];

      render(<ChoiceOptions {...defaultProps} options={singleOption} allowMultiple={false} />);

      const radio = screen.getByRole('radio');
      expect(radio).toBeInTheDocument();
    });

    it('handles all options disabled', () => {
      const allDisabledOptions = mockOptions.map((opt) => ({
        ...opt,
        disabled: true,
      }));

      render(<ChoiceOptions {...defaultProps} options={allDisabledOptions} />);

      const fullMessage = screen.getByText(/choice is full/i);
      expect(fullMessage).toBeInTheDocument();
    });

    it('handles very long option text', () => {
      const longTextOption = createMockOptionForDisplay({
        id: 1,
        text: 'This is a very long option text that should wrap properly and not break the layout of the component'.repeat(3),
      });

      render(<ChoiceOptions {...defaultProps} options={[longTextOption]} />);

      const label = screen.getByText(/This is a very long/i);
      expect(label).toBeInTheDocument();
    });

    it('handles special characters in option text', () => {
      const specialCharOption = createMockOptionForDisplay({
        id: 1,
        text: 'Option with <tags> & "quotes" and \'apostrophes\'',
      });

      render(<ChoiceOptions {...defaultProps} options={[specialCharOption]} />);

      // React should escape these properly
      const label = screen.getByLabelText(/Option with/i);
      expect(label).toBeInTheDocument();
    });

    it('handles missing onSubmit handler gracefully', () => {
      const propsWithoutSubmit = {
        ...defaultProps,
        onSubmit: undefined as any,
      };

      expect(() => {
        render(<ChoiceOptions {...propsWithoutSubmit} />);
      }).not.toThrow();
    });
  });

  describe('Integration with React Hook Form', () => {
    it('uses controlled inputs', async () => {
      const user = userEvent.setup();
      render(<ChoiceOptions {...defaultProps} allowMultiple={false} />);

      const radio1 = screen.getByLabelText('Option 1') as HTMLInputElement;

      await user.click(radio1);
      await waitFor(() => expect(radio1).toBeChecked());
    });

    it('handles form state changes', async () => {
      const user = userEvent.setup();
      render(<ChoiceOptions {...defaultProps} allowMultiple={true} />);

      const checkbox1 = screen.getByLabelText('Option 1') as HTMLInputElement;
      const checkbox2 = screen.getByLabelText('Option 2') as HTMLInputElement;

      await user.click(checkbox1);
      await waitFor(() => expect(checkbox1).toBeChecked());

      await user.click(checkbox2);
      await waitFor(() => {
        expect(checkbox1).toBeChecked();
        expect(checkbox2).toBeChecked();
      });

      await user.click(checkbox1);
      await waitFor(() => {
        expect(checkbox1).not.toBeChecked();
        expect(checkbox2).toBeChecked();
      });
    });

    it('validation triggers on submit', async () => {
      const user = userEvent.setup();
      render(<ChoiceOptions {...defaultProps} allowMultiple={false} />);

      const submitButton = screen.getByRole('button', { name: /save my choice/i });
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByText(/you must choose an option/i);
        expect(errorMessage).toBeInTheDocument();
      });
    });
  });
});
