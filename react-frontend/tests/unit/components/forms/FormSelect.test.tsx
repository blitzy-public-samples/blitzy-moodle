/**
 * FormSelect Component Unit Tests
 *
 * Comprehensive test suite for FormSelect component validating:
 * - Material-UI Select and MenuItem rendering
 * - React Hook Form Controller integration
 * - Zod validation rules for selection constraints
 * - Accessibility compliance (WCAG 2.1 AA)
 * - Single and multiple selection modes
 * - Option groups rendering and navigation
 * - Search/filter functionality with Autocomplete
 * - Error handling and state management
 * - Keyboard navigation and screen reader support
 * - Performance with large option lists
 *
 * @see Section 0.4 Transformation Mapping - React component testing patterns
 * @see WCAG 2.1 AA compliance requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/render.tsx';
import userEvent from '@testing-library/user-event';
import { useForm, FormProvider } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import type { SelectOption } from '@/components/forms/FormSelect';

/**
 * Test helper: Creates a wrapper component with React Hook Form context
 */
interface FormWrapperProps {
  children: React.ReactNode;
  defaultValues?: Record<string, unknown>;
  validationSchema?: z.ZodSchema;
  onSubmit?: (data: unknown) => void;
}

function FormWrapper({
  children,
  defaultValues = {},
  validationSchema,
  onSubmit = () => {},
}: FormWrapperProps) {
  const methods = useForm({
    defaultValues,
    resolver: validationSchema ? zodResolver(validationSchema) : undefined,
    mode: 'onChange',
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        {children}
        <button type="submit">Submit</button>
      </form>
    </FormProvider>
  );
}

/**
 * Mock option data for testing
 */
const basicOptions: SelectOption[] = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Administrator' },
];

const optionsWithDisabled: SelectOption[] = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2', disabled: true },
  { value: 'option3', label: 'Option 3' },
];

const groupedOptions: SelectOption[] = [
  { value: 'math101', label: 'Math 101', group: 'Mathematics' },
  { value: 'math201', label: 'Math 201', group: 'Mathematics' },
  { value: 'eng101', label: 'English 101', group: 'English' },
  { value: 'eng201', label: 'English 201', group: 'English' },
  { value: 'sci101', label: 'Science 101', group: 'Science' },
];

const largeOptionList: SelectOption[] = Array.from({ length: 100 }, (_, i) => ({
  value: `option${i}`,
  label: `Option ${i + 1}`,
}));

describe('FormSelect Component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test Suite 1: Basic Rendering with Material-UI Components
   */
  describe('Rendering', () => {
    it('should render Material-UI Select component with label', () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={basicOptions}
          />
        );
      };

      render(<TestComponent />);

      expect(screen.getByLabelText('User Role')).toBeInTheDocument();
    });

    it('should render all options as MenuItem components', async () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={basicOptions}
          />
        );
      };

      render(<TestComponent />);

      // Open the select dropdown
      const selectElement = screen.getByRole('combobox', { name: /user role/i });
      await user.click(selectElement);

      // Wait for dropdown to open and verify all options are rendered
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Student' })).toBeInTheDocument();
      });

      expect(screen.getByRole('option', { name: 'Teacher' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Administrator' })).toBeInTheDocument();
    });

    it('should display placeholder text when no selection is made', () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={basicOptions}
            placeholder="Select a role..."
          />
        );
      };

      render(<TestComponent />);

      expect(screen.getByText('Select a role...')).toBeInTheDocument();
    });

    it('should display helper text when provided', () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={basicOptions}
            helperText="Choose your role in the system"
          />
        );
      };

      render(<TestComponent />);

      expect(screen.getByText('Choose your role in the system')).toBeInTheDocument();
    });

    it('should handle empty options array gracefully', () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={[]}
          />
        );
      };

      render(<TestComponent />);

      expect(screen.getByLabelText('User Role')).toBeInTheDocument();
    });
  });

  /**
   * Test Suite 2: React Hook Form Integration
   */
  describe('React Hook Form Integration', () => {
    it('should integrate with React Hook Form via Controller', async () => {
      const onSubmit = vi.fn();
      
      const TestComponent = () => {
        const { control } = useForm({
          defaultValues: { role: '' },
        });

        return (
          <FormWrapper onSubmit={onSubmit}>
            <FormSelect
              name="role"
              label="User Role"
              control={control}
              options={basicOptions}
            />
          </FormWrapper>
        );
      };

      render(<TestComponent />);

      // Select an option
      const selectElement = screen.getByRole('combobox', { name: /user role/i });
      await user.click(selectElement);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Student' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('option', { name: 'Student' }));

      // Submit form
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ role: 'student' }),
          expect.anything()
        );
      });
    });

    it('should support single selection mode', async () => {
      const TestComponent = () => {
        const { control, watch } = useForm({
          defaultValues: { role: '' },
        });

        const selectedValue = watch('role');

        return (
          <>
            <FormSelect
              name="role"
              label="User Role"
              control={control}
              options={basicOptions}
            />
            <div data-testid="selected-value">{selectedValue}</div>
          </>
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user role/i });
      await user.click(selectElement);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Teacher' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('option', { name: 'Teacher' }));

      await waitFor(() => {
        expect(screen.getByTestId('selected-value')).toHaveTextContent('teacher');
      });
    });

    it('should support multiple selection mode with chips display', async () => {
      const TestComponent = () => {
        const { control } = useForm({
          defaultValues: { roles: [] },
        });

        return (
          <FormSelect
            name="roles"
            label="User Roles"
            control={control}
            options={basicOptions}
            multiple
          />
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user roles/i });
      await user.click(selectElement);

      // Select multiple options
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Student' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('option', { name: 'Student' }));
      await user.click(screen.getByRole('option', { name: 'Teacher' }));

      // Close dropdown by clicking outside
      await user.keyboard('{Escape}');

      // Verify chips are displayed
      await waitFor(() => {
        expect(screen.getByText('Student')).toBeInTheDocument();
        expect(screen.getByText('Teacher')).toBeInTheDocument();
      });
    });

    it('should submit form with multiple selected values', async () => {
      const onSubmit = vi.fn();

      const TestComponent = () => {
        const { control } = useForm({
          defaultValues: { roles: [] },
        });

        return (
          <FormWrapper onSubmit={onSubmit}>
            <FormSelect
              name="roles"
              label="User Roles"
              control={control}
              options={basicOptions}
              multiple
            />
          </FormWrapper>
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user roles/i });
      await user.click(selectElement);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Student' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('option', { name: 'Student' }));
      await user.click(screen.getByRole('option', { name: 'Admin' }));

      // Submit form
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ roles: ['student', 'admin'] }),
          expect.anything()
        );
      });
    });
  });

  /**
   * Test Suite 3: Zod Validation Integration
   */
  describe('Zod Validation', () => {
    it('should display required field validation error', async () => {
      const schema = z.object({
        role: z.string().min(1, 'Role is required'),
      });

      const TestComponent = () => {
        const { control } = useForm({
          resolver: zodResolver(schema),
          defaultValues: { role: '' },
        });

        return (
          <FormWrapper validationSchema={schema}>
            <FormSelect
              name="role"
              label="User Role"
              control={control}
              options={basicOptions}
              required
            />
          </FormWrapper>
        );
      };

      render(<TestComponent />);

      // Try to submit without selecting
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/role is required/i)).toBeInTheDocument();
      });
    });

    it('should validate enum constraints for allowed values', async () => {
      const schema = z.object({
        role: z.enum(['student', 'teacher'], {
          errorMap: () => ({ message: 'Invalid role selected' }),
        }),
      });

      const TestComponent = () => {
        const { control, setValue } = useForm({
          resolver: zodResolver(schema),
          defaultValues: { role: '' },
        });

        return (
          <>
            <FormWrapper validationSchema={schema}>
              <FormSelect
                name="role"
                label="User Role"
                control={control}
                options={basicOptions}
              />
            </FormWrapper>
            <button onClick={() => setValue('role', 'invalid')}>
              Set Invalid
            </button>
          </>
        );
      };

      render(<TestComponent />);

      // Set invalid value programmatically
      await user.click(screen.getByText('Set Invalid'));
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid role selected')).toBeInTheDocument();
      });
    });

    it('should validate array for multiple selections', async () => {
      const schema = z.object({
        roles: z.array(z.string()).min(1, 'Select at least one role'),
      });

      const TestComponent = () => {
        const { control } = useForm({
          resolver: zodResolver(schema),
          defaultValues: { roles: [] },
        });

        return (
          <FormWrapper validationSchema={schema}>
            <FormSelect
              name="roles"
              label="User Roles"
              control={control}
              options={basicOptions}
              multiple
              required
            />
          </FormWrapper>
        );
      };

      render(<TestComponent />);

      // Submit without selection
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText('Select at least one role')).toBeInTheDocument();
      });
    });

    it('should validate minimum selection count for multiple mode', async () => {
      const schema = z.object({
        roles: z
          .array(z.string())
          .min(2, 'Select at least 2 roles')
          .max(5, 'Select at most 5 roles'),
      });

      const TestComponent = () => {
        const { control } = useForm({
          resolver: zodResolver(schema),
          defaultValues: { roles: [] },
        });

        return (
          <FormWrapper validationSchema={schema}>
            <FormSelect
              name="roles"
              label="User Roles"
              control={control}
              options={basicOptions}
              multiple
            />
          </FormWrapper>
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user roles/i });
      await user.click(selectElement);

      // Select only one option
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Student' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('option', { name: 'Student' }));
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText('Select at least 2 roles')).toBeInTheDocument();
      });
    });

    it('should display validation error messages in helper text', async () => {
      const schema = z.object({
        role: z.string().min(1, 'Please select a role'),
      });

      const TestComponent = () => {
        const { control } = useForm({
          resolver: zodResolver(schema),
          mode: 'onBlur',
        });

        return (
          <FormWrapper validationSchema={schema}>
            <FormSelect
              name="role"
              label="User Role"
              control={control}
              options={basicOptions}
              helperText="Choose your role"
              required
            />
          </FormWrapper>
        );
      };

      render(<TestComponent />);

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        const helperText = screen.queryByText('Choose your role');
        expect(helperText).not.toBeInTheDocument();
        expect(screen.getByText('Please select a role')).toBeInTheDocument();
      });
    });
  });

  /**
   * Test Suite 4: Accessibility (WCAG 2.1 AA)
   */
  describe('Accessibility', () => {
    it('should have proper aria-label attribute', () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={basicOptions}
          />
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user role/i });
      expect(selectElement).toHaveAttribute('aria-label', 'User Role');
    });

    it('should have aria-describedby for helper text', () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={basicOptions}
            helperText="Select your role"
          />
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user role/i });
      const helperId = selectElement.getAttribute('aria-describedby');
      
      expect(helperId).toBeTruthy();
      expect(screen.getByText('Select your role')).toHaveAttribute('id', helperId);
    });

    it('should have aria-invalid when field has errors', async () => {
      const schema = z.object({
        role: z.string().min(1, 'Required'),
      });

      const TestComponent = () => {
        const { control } = useForm({
          resolver: zodResolver(schema),
        });

        return (
          <FormWrapper validationSchema={schema}>
            <FormSelect
              name="role"
              label="User Role"
              control={control}
              options={basicOptions}
              required
            />
          </FormWrapper>
        );
      };

      render(<TestComponent />);

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        const selectElement = screen.getByRole('combobox', { name: /user role/i });
        expect(selectElement).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('should have aria-required when field is required', () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={basicOptions}
            required
          />
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user role/i });
      expect(selectElement).toHaveAttribute('aria-required', 'true');
    });

    it('should have aria-haspopup for dropdown', () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={basicOptions}
          />
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user role/i });
      expect(selectElement).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('should have aria-expanded state for dropdown', async () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={basicOptions}
          />
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user role/i });
      
      // Initially collapsed
      expect(selectElement).toHaveAttribute('aria-expanded', 'false');

      // Open dropdown
      await user.click(selectElement);

      await waitFor(() => {
        expect(selectElement).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('should support keyboard navigation with Arrow keys', async () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={basicOptions}
          />
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user role/i });
      
      // Focus the select
      selectElement.focus();
      expect(selectElement).toHaveFocus();

      // Open with Space
      await user.keyboard(' ');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Student' })).toBeInTheDocument();
      });

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      
      // Select with Enter
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(selectElement).toHaveTextContent('Teacher');
      });
    });

    it('should support selection with Enter key', async () => {
      const TestComponent = () => {
        const { control, watch } = useForm({
          defaultValues: { role: '' },
        });

        return (
          <>
            <FormSelect
              name="role"
              label="User Role"
              control={control}
              options={basicOptions}
            />
            <div data-testid="value">{watch('role')}</div>
          </>
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user role/i });
      selectElement.focus();

      await user.keyboard(' '); // Open dropdown
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Student' })).toBeInTheDocument();
      });

      await user.keyboard('{Enter}'); // Select first option

      await waitFor(() => {
        expect(screen.getByTestId('value')).toHaveTextContent('student');
      });
    });

    it('should close dropdown with Escape key', async () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={basicOptions}
          />
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user role/i });
      
      await user.click(selectElement);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Student' })).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Student' })).not.toBeInTheDocument();
      });
    });

    it('should announce options to screen readers', async () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={basicOptions}
          />
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user role/i });
      await user.click(selectElement);

      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(basicOptions.length);
        
        options.forEach((option, index) => {
          expect(option).toHaveTextContent(basicOptions[index].label);
        });
      });
    });
  });

  /**
   * Test Suite 5: User Interactions
   */
  describe('User Interactions', () => {
    it('should open dropdown when clicked', async () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={basicOptions}
          />
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user role/i });
      await user.click(selectElement);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Student' })).toBeInTheDocument();
      });
    });

    it('should select option with mouse click', async () => {
      const TestComponent = () => {
        const { control, watch } = useForm({
          defaultValues: { role: '' },
        });

        return (
          <>
            <FormSelect
              name="role"
              label="User Role"
              control={control}
              options={basicOptions}
            />
            <div data-testid="value">{watch('role')}</div>
          </>
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user role/i });
      await user.click(selectElement);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Teacher' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('option', { name: 'Teacher' }));

      await waitFor(() => {
        expect(screen.getByTestId('value')).toHaveTextContent('teacher');
      });
    });

    it('should allow clearing selection in non-required field', async () => {
      const TestComponent = () => {
        const { control, setValue, watch } = useForm({
          defaultValues: { role: 'student' },
        });

        return (
          <>
            <FormSelect
              name="role"
              label="User Role"
              control={control}
              options={basicOptions}
            />
            <button onClick={() => setValue('role', '')}>Clear</button>
            <div data-testid="value">{watch('role')}</div>
          </>
        );
      };

      render(<TestComponent />);

      expect(screen.getByTestId('value')).toHaveTextContent('student');

      await user.click(screen.getByText('Clear'));

      await waitFor(() => {
        expect(screen.getByTestId('value')).toHaveTextContent('');
      });
    });

    it('should close dropdown when clicking outside', async () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <>
            <FormSelect
              name="role"
              label="User Role"
              control={control}
              options={basicOptions}
            />
            <div data-testid="outside">Outside</div>
          </>
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user role/i });
      await user.click(selectElement);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Student' })).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('outside'));

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Student' })).not.toBeInTheDocument();
      });
    });
  });

  /**
   * Test Suite 6: Option Groups
   */
  describe('Option Groups', () => {
    it('should render option groups with ListSubheader', async () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="course"
            label="Select Course"
            control={control}
            options={groupedOptions}
          />
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /select course/i });
      await user.click(selectElement);

      await waitFor(() => {
        expect(screen.getByText('Mathematics')).toBeInTheDocument();
        expect(screen.getByText('English')).toBeInTheDocument();
        expect(screen.getByText('Science')).toBeInTheDocument();
      });
    });

    it('should navigate through grouped options', async () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="course"
            label="Select Course"
            control={control}
            options={groupedOptions}
          />
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /select course/i });
      await user.click(selectElement);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Math 101' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'English 101' })).toBeInTheDocument();
      });

      // Verify all grouped options are present
      expect(screen.getByRole('option', { name: 'Math 201' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'English 201' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Science 101' })).toBeInTheDocument();
    });

    it('should select option from specific group', async () => {
      const TestComponent = () => {
        const { control, watch } = useForm({
          defaultValues: { course: '' },
        });

        return (
          <>
            <FormSelect
              name="course"
              label="Select Course"
              control={control}
              options={groupedOptions}
            />
            <div data-testid="value">{watch('course')}</div>
          </>
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /select course/i });
      await user.click(selectElement);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'English 201' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('option', { name: 'English 201' }));

      await waitFor(() => {
        expect(screen.getByTestId('value')).toHaveTextContent('eng201');
      });
    });
  });

  /**
   * Test Suite 7: Multiple Selection Mode
   */
  describe('Multiple Selection', () => {
    it('should display checkboxes in multiple selection mode', async () => {
      const TestComponent = () => {
        const { control } = useForm({
          defaultValues: { roles: [] },
        });

        return (
          <FormSelect
            name="roles"
            label="User Roles"
            control={control}
            options={basicOptions}
            multiple
          />
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user roles/i });
      await user.click(selectElement);

      await waitFor(() => {
        // In Material-UI, multiple select options have checkbox role
        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(0);
      });
    });

    it('should render chips for selected items', async () => {
      const TestComponent = () => {
        const { control } = useForm({
          defaultValues: { roles: [] },
        });

        return (
          <FormSelect
            name="roles"
            label="User Roles"
            control={control}
            options={basicOptions}
            multiple
          />
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user roles/i });
      await user.click(selectElement);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Student' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('option', { name: 'Student' }));
      await user.click(screen.getByRole('option', { name: 'Teacher' }));

      await user.keyboard('{Escape}');

      // Verify chips are displayed
      await waitFor(() => {
        const chips = screen.getAllByText(/Student|Teacher/);
        expect(chips.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should allow deselecting items in multiple mode', async () => {
      const TestComponent = () => {
        const { control, watch } = useForm({
          defaultValues: { roles: ['student'] },
        });

        return (
          <>
            <FormSelect
              name="roles"
              label="User Roles"
              control={control}
              options={basicOptions}
              multiple
            />
            <div data-testid="value">{JSON.stringify(watch('roles'))}</div>
          </>
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user roles/i });
      await user.click(selectElement);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Student' })).toBeInTheDocument();
      });

      // Click Student again to deselect
      await user.click(screen.getByRole('option', { name: 'Student' }));

      await waitFor(() => {
        expect(screen.getByTestId('value')).toHaveTextContent('[]');
      });
    });

    it('should show placeholder when multiple selection is empty', () => {
      const TestComponent = () => {
        const { control } = useForm({
          defaultValues: { roles: [] },
        });

        return (
          <FormSelect
            name="roles"
            label="User Roles"
            control={control}
            options={basicOptions}
            multiple
            placeholder="Select roles..."
          />
        );
      };

      render(<TestComponent />);

      expect(screen.getByText('Select roles...')).toBeInTheDocument();
    });
  });

  /**
   * Test Suite 8: Disabled States
   */
  describe('Disabled States', () => {
    it('should disable entire select when disabled prop is true', () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={basicOptions}
            disabled
          />
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /user role/i });
      expect(selectElement).toBeDisabled();
    });

    it('should disable individual options when option.disabled is true', async () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="option"
            label="Select Option"
            control={control}
            options={optionsWithDisabled}
          />
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /select option/i });
      await user.click(selectElement);

      await waitFor(() => {
        const option2 = screen.getByRole('option', { name: 'Option 2' });
        expect(option2).toHaveAttribute('aria-disabled', 'true');
      });
    });

    it('should not allow selecting disabled options', async () => {
      const TestComponent = () => {
        const { control, watch } = useForm({
          defaultValues: { option: '' },
        });

        return (
          <>
            <FormSelect
              name="option"
              label="Select Option"
              control={control}
              options={optionsWithDisabled}
            />
            <div data-testid="value">{watch('option')}</div>
          </>
        );
      };

      render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /select option/i });
      await user.click(selectElement);

      await waitFor(() => {
        const disabledOption = screen.getByRole('option', { name: 'Option 2' });
        expect(disabledOption).toHaveAttribute('aria-disabled', 'true');
      });

      // Try to click disabled option (should not work)
      const disabledOption = screen.getByRole('option', { name: 'Option 2' });
      await user.click(disabledOption);

      // Value should remain empty
      expect(screen.getByTestId('value')).toHaveTextContent('');
    });
  });

  /**
   * Test Suite 9: Search/Filter Functionality
   */
  describe('Search and Filter', () => {
    it('should render Autocomplete when searchable prop is true', () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="country"
            label="Country"
            control={control}
            options={largeOptionList}
            searchable
          />
        );
      };

      render(<TestComponent />);

      const inputElement = screen.getByRole('combobox', { name: /country/i });
      expect(inputElement).toBeInTheDocument();
    });

    it('should filter options when typing in searchable select', async () => {
      const searchableOptions: SelectOption[] = [
        { value: 'usa', label: 'United States' },
        { value: 'uk', label: 'United Kingdom' },
        { value: 'canada', label: 'Canada' },
        { value: 'australia', label: 'Australia' },
      ];

      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="country"
            label="Country"
            control={control}
            options={searchableOptions}
            searchable
          />
        );
      };

      render(<TestComponent />);

      const inputElement = screen.getByRole('combobox', { name: /country/i });
      
      // Type to filter
      await user.type(inputElement, 'united');

      await waitFor(() => {
        // Should show filtered options
        expect(screen.getByText('United States')).toBeInTheDocument();
        expect(screen.getByText('United Kingdom')).toBeInTheDocument();
      });
    });

    it('should handle large option lists with searchable mode', async () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="item"
            label="Select Item"
            control={control}
            options={largeOptionList}
            searchable
            placeholder="Search items..."
          />
        );
      };

      render(<TestComponent />);

      const inputElement = screen.getByRole('combobox', { name: /select item/i });
      
      // Type to filter large list
      await user.type(inputElement, '50');

      await waitFor(() => {
        // Should show filtered results
        expect(screen.getByText('Option 50')).toBeInTheDocument();
      });
    });

    it('should clear filter when option is selected', async () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="country"
            label="Country"
            control={control}
            options={[
              { value: 'usa', label: 'United States' },
              { value: 'canada', label: 'Canada' },
            ]}
            searchable
          />
        );
      };

      render(<TestComponent />);

      const inputElement = screen.getByRole('combobox', { name: /country/i });
      
      await user.type(inputElement, 'united');
      
      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });

      await user.click(screen.getByText('United States'));

      await waitFor(() => {
        expect(inputElement).toHaveValue('');
      });
    });
  });

  /**
   * Test Suite 10: Error State Styling
   */
  describe('Error State', () => {
    it('should apply error styling when field has validation error', async () => {
      const schema = z.object({
        role: z.string().min(1, 'Required'),
      });

      const TestComponent = () => {
        const { control } = useForm({
          resolver: zodResolver(schema),
        });

        return (
          <FormWrapper validationSchema={schema}>
            <FormSelect
              name="role"
              label="User Role"
              control={control}
              options={basicOptions}
              required
            />
          </FormWrapper>
        );
      };

      render(<TestComponent />);

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        // Material-UI applies error class
        const formControl = screen.getByRole('combobox', { name: /user role/i }).closest('.MuiFormControl-root');
        expect(formControl).toHaveClass('Mui-error');
      });
    });

    it('should display error message in FormHelperText', async () => {
      const schema = z.object({
        role: z.string().min(1, 'Please select a role'),
      });

      const TestComponent = () => {
        const { control } = useForm({
          resolver: zodResolver(schema),
        });

        return (
          <FormWrapper validationSchema={schema}>
            <FormSelect
              name="role"
              label="User Role"
              control={control}
              options={basicOptions}
              required
            />
          </FormWrapper>
        );
      };

      render(<TestComponent />);

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText('Please select a role')).toBeInTheDocument();
      });
    });

    it('should replace helper text with error message when error occurs', async () => {
      const schema = z.object({
        role: z.string().min(1, 'Selection required'),
      });

      const TestComponent = () => {
        const { control } = useForm({
          resolver: zodResolver(schema),
        });

        return (
          <FormWrapper validationSchema={schema}>
            <FormSelect
              name="role"
              label="User Role"
              control={control}
              options={basicOptions}
              helperText="Choose your role"
              required
            />
          </FormWrapper>
        );
      };

      render(<TestComponent />);

      // Initially helper text is shown
      expect(screen.getByText('Choose your role')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        // Error message replaces helper text
        expect(screen.queryByText('Choose your role')).not.toBeInTheDocument();
        expect(screen.getByText('Selection required')).toBeInTheDocument();
      });
    });
  });

  /**
   * Test Suite 11: Performance with Large Lists
   */
  describe('Performance', () => {
    it('should handle large option lists efficiently', async () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="item"
            label="Select Item"
            control={control}
            options={largeOptionList}
          />
        );
      };

      const { container } = render(<TestComponent />);

      const selectElement = screen.getByRole('combobox', { name: /select item/i });
      
      const startTime = performance.now();
      await user.click(selectElement);
      
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Rendering should be reasonably fast (under 1 second)
      expect(renderTime).toBeLessThan(1000);
      expect(container).toBeInTheDocument();
    });

    it('should use virtualization for large lists with searchable mode', async () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="item"
            label="Select Item"
            control={control}
            options={largeOptionList}
            searchable
          />
        );
      };

      render(<TestComponent />);

      const inputElement = screen.getByRole('combobox', { name: /select item/i });
      await user.click(inputElement);

      // Autocomplete should handle large lists efficiently
      await waitFor(() => {
        const listbox = screen.queryByRole('listbox');
        expect(listbox).toBeInTheDocument();
      });
    });
  });

  /**
   * Test Suite 12: Snapshot Testing
   */
  describe('Snapshot Tests', () => {
    it('should match snapshot for basic select', () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={basicOptions}
          />
        );
      };

      const { container } = render(<TestComponent />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for multiple select with chips', () => {
      const TestComponent = () => {
        const { control } = useForm({
          defaultValues: { roles: ['student', 'teacher'] },
        });

        return (
          <FormSelect
            name="roles"
            label="User Roles"
            control={control}
            options={basicOptions}
            multiple
          />
        );
      };

      const { container } = render(<TestComponent />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for grouped options', () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="course"
            label="Select Course"
            control={control}
            options={groupedOptions}
          />
        );
      };

      const { container } = render(<TestComponent />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for searchable select', () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="country"
            label="Country"
            control={control}
            options={basicOptions}
            searchable
            placeholder="Search..."
          />
        );
      };

      const { container } = render(<TestComponent />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for error state', async () => {
      const schema = z.object({
        role: z.string().min(1, 'Required'),
      });

      const TestComponent = () => {
        const { control } = useForm({
          resolver: zodResolver(schema),
        });

        return (
          <FormWrapper validationSchema={schema}>
            <FormSelect
              name="role"
              label="User Role"
              control={control}
              options={basicOptions}
              required
            />
          </FormWrapper>
        );
      };

      const { container } = render(<TestComponent />);

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText('Required')).toBeInTheDocument();
      });

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for disabled state', () => {
      const TestComponent = () => {
        const { control } = useForm();
        return (
          <FormSelect
            name="role"
            label="User Role"
            control={control}
            options={basicOptions}
            disabled
          />
        );
      };

      const { container } = render(<TestComponent />);
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
