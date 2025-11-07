import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileEditForm } from '@/features/profile/components/ProfileEditForm';
import type { User } from '@/types/entities';

// Mock the useProfile hook
const mockUpdateProfile = vi.fn();
const mockUseProfile = vi.fn();

vi.mock('@/features/profile/hooks/useProfile', () => ({
  useProfile: () => mockUseProfile(),
}));

// Mock toast notifications
const mockShowToast = vi.fn();
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

describe('ProfileEditForm', () => {
  const mockUser: User = {
    id: 1,
    firstname: 'John',
    lastname: 'Doe',
    email: 'john.doe@example.com',
    city: 'New York',
    country: 'US',
    department: 'Engineering',
    description: 'Software developer with 5 years of experience',
    interests: ['programming', 'testing', 'react'],
    username: 'johndoe',
    imageUrl: 'https://example.com/avatar.jpg',
  };

  const defaultProps = {
    user: mockUser,
    onCancel: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProfile.mockReturnValue({
      updateProfile: mockUpdateProfile,
      isUpdating: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('renders with pre-filled user data', () => {
      render(<ProfileEditForm {...defaultProps} />);

      // Verify all fields are pre-filled with user data
      expect(screen.getByLabelText(/first name/i)).toHaveValue(mockUser.firstname);
      expect(screen.getByLabelText(/last name/i)).toHaveValue(mockUser.lastname);
      expect(screen.getByLabelText(/email address/i)).toHaveValue(mockUser.email);
      expect(screen.getByLabelText(/city/i)).toHaveValue(mockUser.city);
      expect(screen.getByLabelText(/country/i)).toHaveValue(mockUser.country);
      expect(screen.getByLabelText(/department/i)).toHaveValue(mockUser.department);
      expect(screen.getByLabelText(/description/i)).toHaveValue(mockUser.description);
    });

    it('renders all editable fields', () => {
      render(<ProfileEditForm {...defaultProps} />);

      // Verify all required fields are present
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('renders interests/tags field', () => {
      render(<ProfileEditForm {...defaultProps} />);

      // Check for interests field
      const interestsField = screen.getByLabelText(/interests/i);
      expect(interestsField).toBeInTheDocument();
      
      // Verify interests are pre-filled
      mockUser.interests.forEach((interest) => {
        expect(screen.getByText(interest)).toBeInTheDocument();
      });
    });

    it('renders save and cancel buttons', () => {
      render(<ProfileEditForm {...defaultProps} />);

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('Required Field Validation', () => {
    it('shows error when firstname is empty', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      const firstnameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstnameInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      });
    });

    it('shows error when lastname is empty', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      const lastnameInput = screen.getByLabelText(/last name/i);
      await user.clear(lastnameInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      });
    });

    it('shows error when email is empty', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.clear(emailInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });
    });

    it('prevents form submission with empty required fields', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      // Clear required fields
      await user.clear(screen.getByLabelText(/first name/i));
      await user.clear(screen.getByLabelText(/last name/i));

      // Attempt to submit
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Verify mutation was not called
      expect(mockUpdateProfile).not.toHaveBeenCalled();

      // Verify error messages are displayed
      await waitFor(() => {
        expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Email Format Validation', () => {
    it('shows error for invalid email format', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('accepts valid email format', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'valid.email@example.com');
      await user.tab();

      await waitFor(() => {
        expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
      });
    });

    it('validates complex email formats', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      const validEmails = [
        'user+tag@example.com',
        'user.name@sub.example.co.uk',
        'user_123@example-domain.com',
      ];

      const emailInput = screen.getByLabelText(/email address/i);

      for (const email of validEmails) {
        await user.clear(emailInput);
        await user.type(emailInput, email);
        await user.tab();

        await waitFor(() => {
          expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('Text Length Validation', () => {
    it('shows error when description exceeds maximum length', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      const descriptionInput = screen.getByLabelText(/description/i);
      const longText = 'a'.repeat(1001); // Exceeds typical 1000 character limit

      await user.clear(descriptionInput);
      await user.type(descriptionInput, longText);
      await user.tab();

      await waitFor(() => {
        expect(
          screen.getByText(/description must not exceed 1000 characters/i)
        ).toBeInTheDocument();
      });
    });

    it('accepts description within character limit', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      const descriptionInput = screen.getByLabelText(/description/i);
      const validText = 'a'.repeat(1000); // Exactly at limit

      await user.clear(descriptionInput);
      await user.type(descriptionInput, validText);
      await user.tab();

      await waitFor(() => {
        expect(
          screen.queryByText(/description must not exceed 1000 characters/i)
        ).not.toBeInTheDocument();
      });
    });

    it('displays character count for description field', () => {
      render(<ProfileEditForm {...defaultProps} />);

      const currentLength = mockUser.description.length;
      expect(
        screen.getByText(new RegExp(`${currentLength}\\s*/\\s*1000`, 'i'))
      ).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid data', async () => {
      const user = userEvent.setup();
      mockUpdateProfile.mockResolvedValue({ success: true });

      render(<ProfileEditForm {...defaultProps} />);

      // Modify some fields
      const firstnameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstnameInput);
      await user.type(firstnameInput, 'Jane');

      const cityInput = screen.getByLabelText(/city/i);
      await user.clear(cityInput);
      await user.type(cityInput, 'San Francisco');

      // Submit form
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Verify mutation was called with updated data
      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            firstname: 'Jane',
            lastname: mockUser.lastname,
            email: mockUser.email,
            city: 'San Francisco',
            country: mockUser.country,
          })
        );
      });
    });

    it('calls onSuccess callback after successful submission', async () => {
      const user = userEvent.setup();
      mockUpdateProfile.mockResolvedValue({ success: true });

      render(<ProfileEditForm {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(defaultProps.onSuccess).toHaveBeenCalled();
      });
    });

    it('displays success toast after successful submission', async () => {
      const user = userEvent.setup();
      mockUpdateProfile.mockResolvedValue({ success: true });

      render(<ProfileEditForm {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringMatching(/profile updated successfully/i),
            severity: 'success',
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('displays server-side validation errors', async () => {
      const user = userEvent.setup();
      const serverError = {
        message: 'Validation failed',
        errors: {
          email: 'Email address already in use',
        },
      };
      
      mockUpdateProfile.mockRejectedValue(serverError);

      render(<ProfileEditForm {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/email address already in use/i)).toBeInTheDocument();
      });
    });

    it('displays generic error message for unexpected errors', async () => {
      const user = userEvent.setup();
      mockUpdateProfile.mockRejectedValue(new Error('Network error'));

      render(<ProfileEditForm {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText(/an error occurred while updating your profile/i)
        ).toBeInTheDocument();
      });
    });

    it('displays error toast on submission failure', async () => {
      const user = userEvent.setup();
      mockUpdateProfile.mockRejectedValue(new Error('Update failed'));

      render(<ProfileEditForm {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringMatching(/failed to update profile/i),
            severity: 'error',
          })
        );
      });
    });
  });

  describe('Optimistic UI Updates', () => {
    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      let resolveUpdate: (value: any) => void;
      const updatePromise = new Promise((resolve) => {
        resolveUpdate = resolve;
      });
      mockUpdateProfile.mockReturnValue(updatePromise);

      render(<ProfileEditForm {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Verify loading state
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // Resolve the promise
      resolveUpdate!({ success: true });
    });

    it('disables form fields during submission', async () => {
      const user = userEvent.setup();
      mockUseProfile.mockReturnValue({
        updateProfile: mockUpdateProfile,
        isUpdating: true,
        error: null,
      });

      render(<ProfileEditForm {...defaultProps} />);

      // Verify all inputs are disabled
      expect(screen.getByLabelText(/first name/i)).toBeDisabled();
      expect(screen.getByLabelText(/last name/i)).toBeDisabled();
      expect(screen.getByLabelText(/email address/i)).toBeDisabled();
      expect(screen.getByLabelText(/city/i)).toBeDisabled();
    });

    it('re-enables form after submission completes', async () => {
      const user = userEvent.setup();
      mockUpdateProfile.mockResolvedValue({ success: true });

      const { rerender } = render(<ProfileEditForm {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Simulate loading state
      mockUseProfile.mockReturnValue({
        updateProfile: mockUpdateProfile,
        isUpdating: true,
        error: null,
      });
      rerender(<ProfileEditForm {...defaultProps} />);

      // Then simulate completion
      mockUseProfile.mockReturnValue({
        updateProfile: mockUpdateProfile,
        isUpdating: false,
        error: null,
      });
      rerender(<ProfileEditForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).not.toBeDisabled();
        expect(screen.getByLabelText(/last name/i)).not.toBeDisabled();
      });
    });
  });

  describe('Cancel Functionality', () => {
    it('resets form to original values when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      // Modify fields
      const firstnameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstnameInput);
      await user.type(firstnameInput, 'Modified Name');

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Verify form is reset to original values
      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue(mockUser.firstname);
      });
    });

    it('calls onCancel callback when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('confirms cancellation if form has unsaved changes', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(<ProfileEditForm {...defaultProps} />);

      // Modify a field
      const firstnameInput = screen.getByLabelText(/first name/i);
      await user.type(firstnameInput, ' Modified');

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Verify confirmation dialog was shown
      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringMatching(/unsaved changes/i)
      );

      confirmSpy.mockRestore();
    });
  });

  describe('Custom Profile Fields', () => {
    it('renders custom profile fields when provided', () => {
      const userWithCustomFields = {
        ...mockUser,
        customFields: [
          { name: 'employeeId', value: 'EMP123', label: 'Employee ID' },
          { name: 'department', value: 'Engineering', label: 'Department' },
        ],
      };

      render(
        <ProfileEditForm
          {...defaultProps}
          user={userWithCustomFields as any}
        />
      );

      expect(screen.getByLabelText(/employee id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/employee id/i)).toHaveValue('EMP123');
    });

    it('validates required custom fields', async () => {
      const user = userEvent.setup();
      const userWithRequiredCustomField = {
        ...mockUser,
        customFields: [
          { 
            name: 'employeeId', 
            value: '', 
            label: 'Employee ID', 
            required: true 
          },
        ],
      };

      render(
        <ProfileEditForm
          {...defaultProps}
          user={userWithRequiredCustomField as any}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/employee id is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Interests/Tags Functionality', () => {
    it('allows adding new interests', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      const interestsInput = screen.getByLabelText(/interests/i);
      await user.type(interestsInput, 'typescript{enter}');

      await waitFor(() => {
        expect(screen.getByText('typescript')).toBeInTheDocument();
      });
    });

    it('allows removing interests', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      const programmingTag = screen.getByText('programming');
      const removeButton = within(programmingTag.parentElement!).getByRole('button', {
        name: /delete/i,
      });
      
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByText('programming')).not.toBeInTheDocument();
      });
    });

    it('provides autocomplete suggestions for interests', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      const interestsInput = screen.getByLabelText(/interests/i);
      await user.type(interestsInput, 'prog');

      await waitFor(() => {
        // Verify autocomplete dropdown appears with suggestions
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(screen.getByText(/programming/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper labels for all form controls', () => {
      render(<ProfileEditForm {...defaultProps} />);

      // Verify all inputs have associated labels
      const inputs = screen.getAllByRole('textbox');
      inputs.forEach((input) => {
        expect(input).toHaveAccessibleName();
      });
    });

    it('uses fieldset and legend for grouped fields', () => {
      render(<ProfileEditForm {...defaultProps} />);

      // Check for fieldset with legend
      const fieldsets = screen.getAllByRole('group');
      expect(fieldsets.length).toBeGreaterThan(0);

      fieldsets.forEach((fieldset) => {
        expect(fieldset).toHaveAccessibleName();
      });
    });

    it('associates error messages with inputs using aria-describedby', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');
      await user.tab();

      await waitFor(() => {
        const errorMessage = screen.getByText(/please enter a valid email address/i);
        const errorId = errorMessage.getAttribute('id');
        expect(emailInput.getAttribute('aria-describedby')).toContain(errorId);
      });
    });

    it('marks required fields with aria-required', () => {
      render(<ProfileEditForm {...defaultProps} />);

      expect(screen.getByLabelText(/first name/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/last name/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/email address/i)).toHaveAttribute('aria-required', 'true');
    });

    it('sets appropriate aria-invalid on fields with errors', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');
      await user.tab();

      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      const firstInput = screen.getByLabelText(/first name/i);
      firstInput.focus();

      // Tab through fields
      await user.tab();
      expect(screen.getByLabelText(/last name/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/email address/i)).toHaveFocus();
    });

    it('announces loading state to screen readers', async () => {
      mockUseProfile.mockReturnValue({
        updateProfile: mockUpdateProfile,
        isUpdating: true,
        error: null,
      });

      render(<ProfileEditForm {...defaultProps} />);

      const loadingIndicator = screen.getByRole('progressbar');
      expect(loadingIndicator).toHaveAttribute('aria-label', expect.stringMatching(/saving/i));
    });

    it('provides accessible error summaries', async () => {
      const user = userEvent.setup();
      render(<ProfileEditForm {...defaultProps} />);

      // Clear required fields to trigger multiple errors
      await user.clear(screen.getByLabelText(/first name/i));
      await user.clear(screen.getByLabelText(/last name/i));
      await user.clear(screen.getByLabelText(/email address/i));

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        // Verify error summary region exists
        const errorSummary = screen.getByRole('alert');
        expect(errorSummary).toHaveTextContent(/please correct the following errors/i);
      });
    });
  });
});

