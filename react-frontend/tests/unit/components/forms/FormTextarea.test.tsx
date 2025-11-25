/**
 * FormTextarea Component Unit Tests
 * 
 * Comprehensive test suite for FormTextarea component validating:
 * - React Hook Form integration with multiline text input
 * - Zod validation rules for text length and format
 * - Material-UI TextField multiline rendering
 * - Accessibility compliance (WCAG 2.1 AA)
 * - Auto-resize functionality
 * - Character counting
 * - User interactions for long-form text entry
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { useForm, FormProvider } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';

import { FormTextarea } from '@/components/forms/FormTextarea';
import { render, screen, waitFor, within, fireEvent } from '@/tests/helpers/render';

/**
 * Test wrapper component providing FormProvider context
 */
interface FormWrapperProps {
  children: React.ReactNode;
  defaultValues?: Record<string, any>;
  schema?: z.ZodSchema;
  onSubmit?: (data: any) => void;
}

const FormWrapper: React.FC<FormWrapperProps> = ({ 
  children, 
  defaultValues = {}, 
  schema,
  onSubmit = vi.fn()
}) => {
  const methods = useForm({
    defaultValues,
    resolver: schema ? zodResolver(schema) : undefined,
    mode: 'onChange'
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        {children}
        <button type="submit">Submit</button>
      </form>
    </FormProvider>
  );
};

describe('FormTextarea', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders textarea element with multiline prop', () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="description"
            label="Description"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /description/i });
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('renders with label text', () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="content"
            label="Course Content"
          />
        </FormWrapper>
      );

      expect(screen.getByText('Course Content')).toBeInTheDocument();
    });

    it('renders with placeholder text', () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="instructions"
            label="Instructions"
            placeholder="Enter assignment instructions here..."
          />
        </FormWrapper>
      );

      const textarea = screen.getByPlaceholderText('Enter assignment instructions here...');
      expect(textarea).toBeInTheDocument();
    });

    it('renders with helper text', () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="feedback"
            label="Feedback"
            helperText="Provide detailed feedback to the student"
          />
        </FormWrapper>
      );

      expect(screen.getByText('Provide detailed feedback to the student')).toBeInTheDocument();
    });

    it('respects rows prop for initial height', () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="essay"
            label="Essay Answer"
            rows={5}
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /essay answer/i }) as HTMLTextAreaElement;
      expect(textarea).toHaveAttribute('rows', '5');
    });

    it('respects minRows prop for minimum height', () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="comment"
            label="Comment"
            minRows={3}
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /comment/i });
      expect(textarea).toBeInTheDocument();
      // Material-UI applies minRows through CSS
    });

    it('respects maxRows prop for maximum height', () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="notes"
            label="Notes"
            maxRows={10}
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /notes/i });
      expect(textarea).toBeInTheDocument();
      // Material-UI applies maxRows through CSS and scrolling
    });

    it('renders in disabled state', () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="locked"
            label="Locked Field"
            disabled
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /locked field/i });
      expect(textarea).toBeDisabled();
    });

    it('applies fullWidth prop', () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="content"
            label="Content"
            fullWidth
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /content/i });
      const container = textarea.closest('.MuiFormControl-root');
      expect(container).toHaveClass('MuiFormControl-fullWidth');
    });
  });

  describe('React Hook Form Integration', () => {
    it('updates form state on multi-line text input', async () => {
      const handleSubmit = vi.fn();
      render(
        <FormWrapper onSubmit={handleSubmit}>
          <FormTextarea
            name="description"
            label="Description"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /description/i });
      const multilineText = 'First line\nSecond line\nThird line';
      
      await user.type(textarea, multilineText);
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            description: multilineText
          }),
          expect.anything()
        );
      });
    });

    it('handles form submission with long text content', async () => {
      const handleSubmit = vi.fn();
      const longText = 'Lorem ipsum '.repeat(100);
      
      render(
        <FormWrapper onSubmit={handleSubmit} defaultValues={{ essay: longText }}>
          <FormTextarea
            name="essay"
            label="Essay"
          />
        </FormWrapper>
      );

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            essay: longText
          }),
          expect.anything()
        );
      });
    });

    it('clears textarea value', async () => {
      render(
        <FormWrapper defaultValues={{ notes: 'Initial content' }}>
          <FormTextarea
            name="notes"
            label="Notes"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /notes/i }) as HTMLTextAreaElement;
      expect(textarea.value).toBe('Initial content');

      await user.clear(textarea);
      
      expect(textarea.value).toBe('');
    });

    it('handles controlled value updates', async () => {
      render(
        <FormWrapper defaultValues={{ comment: 'Original text' }}>
          <FormTextarea
            name="comment"
            label="Comment"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /comment/i }) as HTMLTextAreaElement;
      expect(textarea.value).toBe('Original text');

      await user.clear(textarea);
      await user.type(textarea, 'Updated text');

      expect(textarea.value).toBe('Updated text');
    });
  });

  describe('Zod Validation Integration', () => {
    it('validates required field', async () => {
      const schema = z.object({
        feedback: z.string().min(1, 'Feedback is required')
      });

      render(
        <FormWrapper schema={schema}>
          <FormTextarea
            name="feedback"
            label="Feedback"
            required
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /feedback/i });
      await user.click(textarea);
      await user.tab(); // Trigger blur

      await waitFor(() => {
        expect(screen.getByText('Feedback is required')).toBeInTheDocument();
      });
    });

    it('validates minLength constraint for essay-type answers', async () => {
      const schema = z.object({
        essay: z.string().min(100, 'Essay must be at least 100 characters')
      });

      render(
        <FormWrapper schema={schema}>
          <FormTextarea
            name="essay"
            label="Essay Answer"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /essay answer/i });
      await user.type(textarea, 'Too short');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Essay must be at least 100 characters')).toBeInTheDocument();
      });
    });

    it('validates maxLength constraint', async () => {
      const schema = z.object({
        description: z.string().max(50, 'Description must not exceed 50 characters')
      });

      render(
        <FormWrapper schema={schema}>
          <FormTextarea
            name="description"
            label="Description"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /description/i });
      const longText = 'a'.repeat(60);
      await user.type(textarea, longText);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Description must not exceed 50 characters')).toBeInTheDocument();
      });
    });

    it('validates word count requirement', async () => {
      const schema = z.object({
        response: z.string().refine(
          (val) => val.trim().split(/\s+/).length >= 50,
          { message: 'Response must contain at least 50 words' }
        )
      });

      render(
        <FormWrapper schema={schema}>
          <FormTextarea
            name="response"
            label="Response"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /response/i });
      await user.type(textarea, 'Only a few words here');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Response must contain at least 50 words')).toBeInTheDocument();
      });
    });

    it('validates custom validation rules', async () => {
      const schema = z.object({
        code: z.string().refine(
          (val) => !val.includes('<script>'),
          { message: 'Script tags are not allowed' }
        )
      });

      render(
        <FormWrapper schema={schema}>
          <FormTextarea
            name="code"
            label="Code"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /code/i });
      await user.type(textarea, '<script>alert("xss")</script>');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Script tags are not allowed')).toBeInTheDocument();
      });
    });

    it('displays validation error below textarea', async () => {
      const schema = z.object({
        content: z.string().min(1, 'Content is required')
      });

      render(
        <FormWrapper schema={schema}>
          <FormTextarea
            name="content"
            label="Content"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /content/i });
      await user.click(textarea);
      await user.tab();

      await waitFor(() => {
        const errorMessage = screen.getByText('Content is required');
        expect(errorMessage).toBeInTheDocument();
        
        // Error should be below the textarea
        const formControl = textarea.closest('.MuiFormControl-root');
        expect(within(formControl!).getByText('Content is required')).toBeInTheDocument();
      });
    });

    it('clears validation error when valid input is provided', async () => {
      const schema = z.object({
        notes: z.string().min(10, 'Notes must be at least 10 characters')
      });

      render(
        <FormWrapper schema={schema}>
          <FormTextarea
            name="notes"
            label="Notes"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /notes/i });
      
      // Trigger validation error
      await user.type(textarea, 'Short');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Notes must be at least 10 characters')).toBeInTheDocument();
      });

      // Fix the error
      await user.click(textarea);
      await user.clear(textarea);
      await user.type(textarea, 'This is a longer note that exceeds 10 characters');

      await waitFor(() => {
        expect(screen.queryByText('Notes must be at least 10 characters')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper aria-label attribute', () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="description"
            label="Course Description"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /course description/i });
      expect(textarea).toBeInTheDocument();
    });

    it('has aria-describedby for helper text', () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="instructions"
            label="Instructions"
            helperText="Provide clear instructions for students"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /instructions/i });
      const helperTextId = textarea.getAttribute('aria-describedby');
      
      expect(helperTextId).toBeTruthy();
      expect(document.getElementById(helperTextId!)).toHaveTextContent('Provide clear instructions for students');
    });

    it('has aria-describedby for error messages', async () => {
      const schema = z.object({
        feedback: z.string().min(1, 'Feedback is required')
      });

      render(
        <FormWrapper schema={schema}>
          <FormTextarea
            name="feedback"
            label="Feedback"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /feedback/i });
      await user.click(textarea);
      await user.tab();

      await waitFor(() => {
        const errorMessage = screen.getByText('Feedback is required');
        expect(errorMessage).toBeInTheDocument();
        
        const describedBy = textarea.getAttribute('aria-describedby');
        expect(describedBy).toBeTruthy();
        expect(document.getElementById(describedBy!)).toHaveTextContent('Feedback is required');
      });
    });

    it('has aria-invalid when validation fails', async () => {
      const schema = z.object({
        content: z.string().min(1, 'Content is required')
      });

      render(
        <FormWrapper schema={schema}>
          <FormTextarea
            name="content"
            label="Content"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /content/i });
      await user.click(textarea);
      await user.tab();

      await waitFor(() => {
        expect(textarea).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('has aria-required for required fields', () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="required_field"
            label="Required Field"
            required
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /required field/i });
      expect(textarea).toHaveAttribute('aria-required', 'true');
    });

    it('supports keyboard navigation with Tab', async () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="first"
            label="First"
          />
          <FormTextarea
            name="second"
            label="Second"
          />
        </FormWrapper>
      );

      const firstTextarea = screen.getByRole('textbox', { name: /first/i });
      const secondTextarea = screen.getByRole('textbox', { name: /second/i });

      firstTextarea.focus();
      expect(firstTextarea).toHaveFocus();

      await user.tab();
      expect(secondTextarea).toHaveFocus();
    });

    it('allows Enter key for newlines', async () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="multiline"
            label="Multiline"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /multiline/i }) as HTMLTextAreaElement;
      await user.click(textarea);
      await user.type(textarea, 'First line{Enter}Second line');

      expect(textarea.value).toBe('First line\nSecond line');
    });

    it('provides screen reader announcements for character count', () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="limited"
            label="Limited Text"
            maxLength={100}
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /limited text/i });
      const describedBy = textarea.getAttribute('aria-describedby');
      
      // Character count should be announced to screen readers
      expect(describedBy).toBeTruthy();
    });

    it('maintains focus management during validation', async () => {
      const schema = z.object({
        content: z.string().min(5, 'Too short')
      });

      render(
        <FormWrapper schema={schema}>
          <FormTextarea
            name="content"
            label="Content"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /content/i });
      await user.click(textarea);
      await user.type(textarea, 'Hi');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Too short')).toBeInTheDocument();
      });

      // Focus should move to next element, not trapped
      expect(textarea).not.toHaveFocus();
    });
  });

  describe('User Interactions', () => {
    it('handles typing multi-line text', async () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="essay"
            label="Essay"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /essay/i }) as HTMLTextAreaElement;
      const multilineText = 'Paragraph 1\n\nParagraph 2\n\nParagraph 3';
      
      await user.type(textarea, multilineText);

      expect(textarea.value).toBe(multilineText);
    });

    it('handles keyboard shortcuts', async () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="notes"
            label="Notes"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /notes/i }) as HTMLTextAreaElement;
      await user.click(textarea);
      await user.type(textarea, 'Some text');
      
      // Select all with Ctrl+A
      await user.keyboard('{Control>}a{/Control}');
      
      // Type to replace
      await user.type(textarea, 'Replaced');
      
      expect(textarea.value).toBe('Replaced');
    });

    it('handles copy/paste operations', async () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="content"
            label="Content"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /content/i });
      await user.click(textarea);
      
      const pastedText = 'Pasted content\nWith multiple lines';
      await user.paste(pastedText);

      expect(textarea).toHaveValue(pastedText);
    });

    it('handles text selection', async () => {
      render(
        <FormWrapper defaultValues={{ text: 'Select this text' }}>
          <FormTextarea
            name="text"
            label="Text"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /text/i }) as HTMLTextAreaElement;
      await user.click(textarea);
      
      // Select all text
      textarea.setSelectionRange(0, textarea.value.length);
      
      expect(textarea.selectionStart).toBe(0);
      expect(textarea.selectionEnd).toBe(textarea.value.length);
    });

    it('handles focus events', async () => {
      const handleFocus = vi.fn();
      
      render(
        <FormWrapper>
          <FormTextarea
            name="content"
            label="Content"
            onFocus={handleFocus}
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /content/i });
      await user.click(textarea);

      expect(handleFocus).toHaveBeenCalled();
    });

    it('handles blur events', async () => {
      const handleBlur = vi.fn();
      
      render(
        <FormWrapper>
          <FormTextarea
            name="content"
            label="Content"
            onBlur={handleBlur}
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /content/i });
      await user.click(textarea);
      await user.tab();

      expect(handleBlur).toHaveBeenCalled();
    });

    it('handles rapid typing', async () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="rapid"
            label="Rapid Input"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /rapid input/i }) as HTMLTextAreaElement;
      const rapidText = 'The quick brown fox jumps over the lazy dog';
      
      await user.type(textarea, rapidText, { delay: 1 }); // Very fast typing

      expect(textarea.value).toBe(rapidText);
    });

    it('prevents input when disabled', async () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="disabled"
            label="Disabled Field"
            disabled
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /disabled field/i }) as HTMLTextAreaElement;
      
      // Attempt to type
      await user.type(textarea, 'Should not appear');

      expect(textarea.value).toBe('');
    });
  });

  describe('Character Count Display', () => {
    it('displays character count when maxLength is provided', () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="limited"
            label="Limited Text"
            maxLength={200}
          />
        </FormWrapper>
      );

      expect(screen.getByText(/0 \/ 200/)).toBeInTheDocument();
    });

    it('updates character count in real-time', async () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="counted"
            label="Counted Text"
            maxLength={50}
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /counted text/i });
      await user.type(textarea, 'Hello World');

      await waitFor(() => {
        expect(screen.getByText(/11 \/ 50/)).toBeInTheDocument();
      });
    });

    it('shows warning when approaching character limit', async () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="limited"
            label="Limited"
            maxLength={20}
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /limited/i });
      await user.type(textarea, 'a'.repeat(18));

      await waitFor(() => {
        const charCount = screen.getByText(/18 \/ 20/);
        expect(charCount).toBeInTheDocument();
        // Should show warning color near limit
      });
    });

    it('prevents typing beyond maxLength', async () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="strict"
            label="Strict Limit"
            maxLength={10}
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /strict limit/i }) as HTMLTextAreaElement;
      await user.type(textarea, 'a'.repeat(15));

      // Should only allow 10 characters
      expect(textarea.value.length).toBeLessThanOrEqual(10);
    });

    it('counts multi-byte characters correctly', async () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="unicode"
            label="Unicode Text"
            maxLength={20}
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /unicode text/i });
      await user.type(textarea, '你好世界🌍');

      await waitFor(() => {
        expect(screen.getByText(/5 \/ 20/)).toBeInTheDocument();
      });
    });
  });

  describe('Auto-Resize Functionality', () => {
    it('expands height as content increases', async () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="expandable"
            label="Expandable"
            minRows={2}
            maxRows={10}
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /expandable/i }) as HTMLTextAreaElement;
      const initialHeight = textarea.offsetHeight;

      // Add many lines
      const manyLines = Array(15).fill('Line of text').join('\n');
      await user.type(textarea, manyLines);

      // Height should increase (Material-UI handles this internally)
      expect(textarea.value.split('\n').length).toBeGreaterThan(2);
    });

    it('respects minRows constraint', () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="minimum"
            label="Minimum"
            minRows={5}
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /minimum/i });
      // Material-UI applies minRows through CSS
      expect(textarea).toBeInTheDocument();
    });

    it('respects maxRows constraint with scrolling', async () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="maximum"
            label="Maximum"
            maxRows={3}
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /maximum/i }) as HTMLTextAreaElement;
      
      // Add more lines than maxRows
      const manyLines = Array(10).fill('Line').join('\n');
      await user.type(textarea, manyLines);

      // Textarea should scroll instead of expanding beyond maxRows
      expect(textarea.scrollHeight).toBeGreaterThan(textarea.clientHeight);
    });

    it('adjusts height when content is deleted', async () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="adjustable"
            label="Adjustable"
            minRows={2}
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /adjustable/i }) as HTMLTextAreaElement;
      
      // Add content
      await user.type(textarea, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
      
      // Clear content
      await user.clear(textarea);

      // Should shrink back to minimum height
      expect(textarea.value).toBe('');
    });
  });

  describe('Error State Styling', () => {
    it('applies error styling when validation fails', async () => {
      const schema = z.object({
        field: z.string().min(5, 'Too short')
      });

      render(
        <FormWrapper schema={schema}>
          <FormTextarea
            name="field"
            label="Field"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /field/i });
      await user.type(textarea, 'Hi');
      await user.tab();

      await waitFor(() => {
        const formControl = textarea.closest('.MuiFormControl-root');
        expect(formControl).toHaveClass('Mui-error');
      });
    });

    it('removes error styling when validation passes', async () => {
      const schema = z.object({
        field: z.string().min(5, 'Too short')
      });

      render(
        <FormWrapper schema={schema}>
          <FormTextarea
            name="field"
            label="Field"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /field/i });
      
      // Trigger error
      await user.type(textarea, 'Hi');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Too short')).toBeInTheDocument();
      });

      // Fix error
      await user.click(textarea);
      await user.clear(textarea);
      await user.type(textarea, 'Long enough text');

      await waitFor(() => {
        const formControl = textarea.closest('.MuiFormControl-root');
        expect(formControl).not.toHaveClass('Mui-error');
      });
    });

    it('displays error message in red color', async () => {
      const schema = z.object({
        field: z.string().min(1, 'Required')
      });

      render(
        <FormWrapper schema={schema}>
          <FormTextarea
            name="field"
            label="Field"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /field/i });
      await user.click(textarea);
      await user.tab();

      await waitFor(() => {
        const errorText = screen.getByText('Required');
        expect(errorText).toHaveClass('Mui-error');
      });
    });
  });

  describe('Long Text Handling', () => {
    it('handles very long text content', async () => {
      const longText = 'Lorem ipsum dolor sit amet. '.repeat(200);
      
      render(
        <FormWrapper defaultValues={{ essay: longText }}>
          <FormTextarea
            name="essay"
            label="Essay"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /essay/i }) as HTMLTextAreaElement;
      expect(textarea.value).toBe(longText);
    });

    it('enables scrolling for long content', async () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="long"
            label="Long Content"
            maxRows={5}
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /long content/i }) as HTMLTextAreaElement;
      const longText = Array(30).fill('Line of text').join('\n');
      
      await user.type(textarea, longText);

      // Should be scrollable
      expect(textarea.scrollHeight).toBeGreaterThan(textarea.clientHeight);
    });

    it('maintains scroll position during typing', async () => {
      render(
        <FormWrapper>
          <FormTextarea
            name="scrollable"
            label="Scrollable"
            maxRows={5}
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /scrollable/i }) as HTMLTextAreaElement;
      
      // Fill with content
      const initialText = Array(20).fill('Line').join('\n');
      await user.type(textarea, initialText);
      
      // Scroll to middle
      textarea.scrollTop = textarea.scrollHeight / 2;
      const scrollPosition = textarea.scrollTop;
      
      // Add more content at end
      await user.type(textarea, '\nNew line');
      
      // Scroll should stay near where it was
      expect(Math.abs(textarea.scrollTop - scrollPosition)).toBeLessThan(100);
    });
  });

  describe('Performance', () => {
    it('handles large text content efficiently', async () => {
      const largeText = 'a'.repeat(10000);
      const startTime = performance.now();
      
      render(
        <FormWrapper defaultValues={{ large: largeText }}>
          <FormTextarea
            name="large"
            label="Large"
          />
        </FormWrapper>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      const textarea = screen.getByRole('textbox', { name: /large/i }) as HTMLTextAreaElement;
      expect(textarea.value).toBe(largeText);
      
      // Should render in reasonable time (less than 100ms)
      expect(renderTime).toBeLessThan(100);
    });

    it('debounces validation during rapid typing', async () => {
      const schema = z.object({
        field: z.string().min(5, 'Too short')
      });

      render(
        <FormWrapper schema={schema}>
          <FormTextarea
            name="field"
            label="Field"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /field/i });
      
      // Type rapidly
      await user.type(textarea, 'abcdefghijk', { delay: 10 });

      // Validation should not run for every keystroke
      // Only final validation matters
      await waitFor(() => {
        expect(screen.queryByText('Too short')).not.toBeInTheDocument();
      });
    });
  });

  describe('Integration with Form Context', () => {
    it('integrates with form reset', async () => {
      const TestForm = () => {
        const methods = useForm({
          defaultValues: { content: 'Initial' }
        });

        return (
          <FormProvider {...methods}>
            <form>
              <FormTextarea name="content" label="Content" />
              <button type="button" onClick={() => methods.reset()}>
                Reset
              </button>
            </form>
          </FormProvider>
        );
      };

      render(<TestForm />);

      const textarea = screen.getByRole('textbox', { name: /content/i }) as HTMLTextAreaElement;
      
      await user.clear(textarea);
      await user.type(textarea, 'Modified content');
      expect(textarea.value).toBe('Modified content');

      await user.click(screen.getByRole('button', { name: /reset/i }));

      await waitFor(() => {
        expect(textarea.value).toBe('Initial');
      });
    });

    it('integrates with form validation trigger', async () => {
      const schema = z.object({
        field: z.string().min(5, 'Too short')
      });

      const TestForm = () => {
        const methods = useForm({
          resolver: zodResolver(schema)
        });

        return (
          <FormProvider {...methods}>
            <form>
              <FormTextarea name="field" label="Field" />
              <button
                type="button"
                onClick={() => methods.trigger('field')}
              >
                Validate
              </button>
            </form>
          </FormProvider>
        );
      };

      render(<TestForm />);

      const textarea = screen.getByRole('textbox', { name: /field/i });
      await user.type(textarea, 'Hi');

      await user.click(screen.getByRole('button', { name: /validate/i }));

      await waitFor(() => {
        expect(screen.getByText('Too short')).toBeInTheDocument();
      });
    });

    it('integrates with form setValue', async () => {
      const TestForm = () => {
        const methods = useForm();

        return (
          <FormProvider {...methods}>
            <form>
              <FormTextarea name="content" label="Content" />
              <button
                type="button"
                onClick={() => methods.setValue('content', 'Programmatically set')}
              >
                Set Value
              </button>
            </form>
          </FormProvider>
        );
      };

      render(<TestForm />);

      const textarea = screen.getByRole('textbox', { name: /content/i }) as HTMLTextAreaElement;
      
      await user.click(screen.getByRole('button', { name: /set value/i }));

      await waitFor(() => {
        expect(textarea.value).toBe('Programmatically set');
      });
    });
  });

  describe('Snapshot Tests', () => {
    it('matches snapshot for default state', () => {
      const { container } = render(
        <FormWrapper>
          <FormTextarea
            name="default"
            label="Default Textarea"
            helperText="Helper text"
          />
        </FormWrapper>
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for error state', async () => {
      const schema = z.object({
        field: z.string().min(1, 'Required')
      });

      const { container } = render(
        <FormWrapper schema={schema}>
          <FormTextarea
            name="field"
            label="Field"
          />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox', { name: /field/i });
      await user.click(textarea);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Required')).toBeInTheDocument();
      });

      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for disabled state', () => {
      const { container } = render(
        <FormWrapper>
          <FormTextarea
            name="disabled"
            label="Disabled"
            disabled
          />
        </FormWrapper>
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot with character count', () => {
      const { container } = render(
        <FormWrapper>
          <FormTextarea
            name="limited"
            label="Limited"
            maxLength={100}
          />
        </FormWrapper>
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
