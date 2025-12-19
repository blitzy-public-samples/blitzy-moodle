/**
 * UserEditForm Component
 *
 * A comprehensive React form component for creating and editing user profiles.
 * Integrates with React Hook Form for form state management and Zod for validation.
 * Mirrors the functionality of Moodle's public/user/editadvanced_form.php.
 *
 * Features:
 * - Create mode (userId = undefined) and edit mode (existing userId)
 * - Form fields: username, email, password, names, location, description, profile picture
 * - Authentication method selector with conditional field enabling/disabling
 * - Account status controls: suspended, email confirmed, force password change
 * - Form validation with Zod schemas
 * - Unsaved changes warning when navigating away
 * - Loading state with spinner overlay during submission
 * - Success/error toast notifications
 * - Permission-based field visibility
 *
 * @module features/admin/users/components/UserEditForm
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useBlocker, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Grid,
  Typography,
  Divider,
  Switch,
  FormControlLabel,
  Paper,
  CircularProgress,
} from '@mui/material';
import { Save, Cancel, ArrowBack } from '@mui/icons-material';

// Internal imports from depends_on_files
import { useUserMutations } from '../hooks/useUserMutations';
import type { User } from '../types/user.types';
import { UserAuthMethod } from '../types/user.types';
import type { UserFormData, UserCreateFormData, UserUpdateFormData } from '../types/user-form.types';
import {
  userFormSchema,
  userCreateFormSchema,
  userUpdateFormSchema,
} from '../types/user-form.types';
import { FormInput } from '../../../../components/forms/FormInput';
import { FormSelect } from '../../../../components/forms/FormSelect';
import { FormFileUpload } from '../../../../components/forms/FormFileUpload';
import { FormTextarea } from '../../../../components/forms/FormTextarea';
import { LoadingSpinner } from '../../../../components/feedback/LoadingSpinner';
import { useToast } from '../../../../hooks/useToast';
import { usePermissions } from '../../../../hooks/usePermissions';
import { Alert } from '../../../../components/feedback/Alert';
import { Modal } from '../../../../components/feedback/Modal';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Props interface for the UserEditForm component
 */
export interface UserEditFormProps {
  /**
   * User ID for edit mode. If undefined, form is in create mode.
   */
  userId?: number;

  /**
   * Existing user data to pre-populate form fields in edit mode.
   * Required when userId is provided.
   */
  user?: User;

  /**
   * Callback when form is submitted successfully
   */
  onSuccess?: (user: User) => void;

  /**
   * Callback when form submission is cancelled
   */
  onCancel?: () => void;

  /**
   * Whether to show a back button
   * @default true
   */
  showBackButton?: boolean;
}

/**
 * Authentication method options for the select field
 */
interface AuthMethodOption {
  value: UserAuthMethod;
  label: string;
  description?: string;
}

/**
 * Country option for select field
 */
interface CountryOption {
  value: string;
  label: string;
}

/**
 * Timezone option for select field
 */
interface TimezoneOption {
  value: string;
  label: string;
  group: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Available authentication methods matching Moodle's auth plugins
 * Reference: public/auth/ directory for available plugins
 */
const AUTH_METHODS: AuthMethodOption[] = [
  { value: UserAuthMethod.MANUAL, label: 'Manual accounts', description: 'User accounts created manually by admin' },
  { value: UserAuthMethod.LDAP, label: 'LDAP server', description: 'Authentication against LDAP/Active Directory' },
  { value: UserAuthMethod.OAUTH2, label: 'OAuth 2', description: 'OAuth 2 authentication (Google, Microsoft, etc.)' },
  { value: UserAuthMethod.SAML, label: 'SAML 2.0', description: 'SAML-based Single Sign-On' },
  { value: UserAuthMethod.CAS, label: 'CAS server', description: 'Central Authentication Service' },
  { value: UserAuthMethod.SHIBBOLETH, label: 'Shibboleth', description: 'Shibboleth federated identity' },
  { value: UserAuthMethod.EMAIL, label: 'Email-based self-registration', description: 'Users register via email confirmation' },
  { value: UserAuthMethod.NONE, label: 'No authentication', description: 'Account disabled - no login allowed' },
];

/**
 * Auth methods where password field should be disabled
 * These methods manage passwords externally
 */
const EXTERNAL_AUTH_METHODS = new Set<UserAuthMethod>([
  UserAuthMethod.LDAP,
  UserAuthMethod.OAUTH2,
  UserAuthMethod.SAML,
  UserAuthMethod.CAS,
  UserAuthMethod.SHIBBOLETH,
  UserAuthMethod.NONE,
]);

/**
 * Common countries for the country select field
 * In production, this would be loaded from an API or localization file
 */
const COUNTRIES: CountryOption[] = [
  { value: '', label: 'Select a country...' },
  { value: 'AU', label: 'Australia' },
  { value: 'CA', label: 'Canada' },
  { value: 'DE', label: 'Germany' },
  { value: 'ES', label: 'Spain' },
  { value: 'FR', label: 'France' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'IN', label: 'India' },
  { value: 'IT', label: 'Italy' },
  { value: 'JP', label: 'Japan' },
  { value: 'MX', label: 'Mexico' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'US', label: 'United States' },
];

/**
 * Timezone options grouped by region
 * In production, this would be loaded from an API
 */
const TIMEZONES: TimezoneOption[] = [
  { value: '99', label: 'Server default', group: 'Default' },
  { value: 'America/New_York', label: 'America/New_York (Eastern)', group: 'Americas' },
  { value: 'America/Chicago', label: 'America/Chicago (Central)', group: 'Americas' },
  { value: 'America/Denver', label: 'America/Denver (Mountain)', group: 'Americas' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (Pacific)', group: 'Americas' },
  { value: 'America/Toronto', label: 'America/Toronto', group: 'Americas' },
  { value: 'Europe/London', label: 'Europe/London (GMT)', group: 'Europe' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET)', group: 'Europe' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET)', group: 'Europe' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)', group: 'Asia' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)', group: 'Asia' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)', group: 'Asia' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST)', group: 'Pacific' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST)', group: 'Pacific' },
];

/**
 * Moodle capabilities required for user management
 */
const CAPABILITIES = {
  UPDATE_USER: 'moodle/user:update',
  CREATE_USER: 'moodle/user:create',
  DELETE_USER: 'moodle/user:delete',
  VIEW_HIDDEN_DETAILS: 'moodle/user:viewhiddendetails',
  EDIT_PASSWORD: 'moodle/user:editownpassword',
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Converts User entity to form data for pre-populating the form
 * 
 * @param user - The user entity to convert
 * @returns Form data object matching UserFormData interface
 */
function userToFormData(user: User): Partial<UserFormData> {
  return {
    username: user.username,
    email: user.email,
    firstname: user.firstname,
    lastname: user.lastname,
    auth: user.auth || UserAuthMethod.MANUAL,
    city: user.city || '',
    country: user.country || '',
    timezone: user.timezone || '99',
    description: user.description || '',
    suspended: user.suspended || false,
    confirmed: user.confirmed ?? true,
    forcePasswordChange: false,
    // Password fields are intentionally omitted - never pre-populate passwords
  };
}

/**
 * Gets default form values for create mode
 * 
 * @returns Default form data for new user creation
 */
function getDefaultFormValues(): Partial<UserFormData> {
  return {
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
    firstname: '',
    lastname: '',
    auth: UserAuthMethod.MANUAL,
    city: '',
    country: '',
    timezone: '99',
    description: '',
    suspended: false,
    confirmed: true,
    forcePasswordChange: true,
  };
}

/**
 * Checks if the selected auth method is external (password managed externally)
 * 
 * @param authMethod - The authentication method to check
 * @returns True if the auth method manages passwords externally
 */
function isExternalAuth(authMethod: UserAuthMethod): boolean {
  return EXTERNAL_AUTH_METHODS.has(authMethod);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * UserEditForm Component
 *
 * Comprehensive form for creating and editing Moodle user accounts.
 * Handles both create mode (new user) and edit mode (existing user).
 *
 * @param props - Component props
 * @returns Rendered form component
 */
export function UserEditForm({
  userId,
  user,
  onSuccess,
  onCancel,
  showBackButton = true,
}: UserEditFormProps): JSX.Element {
  // -------------------------------------------------------------------------
  // Hooks and State
  // -------------------------------------------------------------------------
  
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const { hasCapability } = usePermissions();
  const { createUser, updateUser } = useUserMutations();

  // Determine if we're in create or edit mode
  const isCreateMode = userId === undefined;

  // State for form submission and error handling
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Select the appropriate validation schema based on mode
  const validationSchema = useMemo(() => {
    return isCreateMode ? userCreateFormSchema : userUpdateFormSchema;
  }, [isCreateMode]);

  // Initialize form with React Hook Form
  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty, isValid },
    setValue,
  } = useForm<UserFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: isCreateMode ? getDefaultFormValues() : userToFormData(user!),
    mode: 'onChange',
  });

  // Watch auth method for conditional field rendering
  const selectedAuthMethod = watch('auth');
  const isPasswordDisabled = isExternalAuth(selectedAuthMethod as UserAuthMethod);

  // -------------------------------------------------------------------------
  // Permission Checks
  // -------------------------------------------------------------------------

  const canUpdateUser = hasCapability(CAPABILITIES.UPDATE_USER);
  const canCreateUser = hasCapability(CAPABILITIES.CREATE_USER);
  const canViewHiddenDetails = hasCapability(CAPABILITIES.VIEW_HIDDEN_DETAILS);

  // Check if user has permission for the current operation
  const hasPermission = isCreateMode ? canCreateUser : canUpdateUser;

  // -------------------------------------------------------------------------
  // Navigation Blocker for Unsaved Changes
  // -------------------------------------------------------------------------

  // Block navigation when form has unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  // Handle blocked navigation
  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowUnsavedChangesModal(true);
      setPendingNavigation(() => () => blocker.proceed());
    }
  }, [blocker]);

  // -------------------------------------------------------------------------
  // Form Pre-population for Edit Mode
  // -------------------------------------------------------------------------

  // Reset form when user data changes (edit mode)
  useEffect(() => {
    if (!isCreateMode && user) {
      reset(userToFormData(user));
    }
  }, [user, isCreateMode, reset]);

  // -------------------------------------------------------------------------
  // Form Submission Handler
  // -------------------------------------------------------------------------

  /**
   * Handles form submission for both create and update operations
   * Transforms form data and calls appropriate mutation hook
   */
  const onSubmit = useCallback(
    async (formData: UserFormData) => {
      setIsSubmitting(true);
      setSubmitError(null);

      try {
        if (isCreateMode) {
          // Create new user
          const createData = formData as UserCreateFormData;
          const result = await createUser.mutateAsync(createData);
          
          success('User created successfully');
          
          if (onSuccess) {
            onSuccess(result);
          } else {
            // Navigate to user list after successful creation
            navigate('/admin/users');
          }
        } else {
          // Update existing user
          const updateData = formData as UserUpdateFormData;
          const result = await updateUser.mutateAsync({
            id: userId!,
            data: updateData,
          });
          
          success('User updated successfully');
          
          if (onSuccess) {
            onSuccess(result);
          }
        }

        // Reset form dirty state after successful save
        reset(formData);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred. Please try again.';
        
        setSubmitError(errorMessage);
        showError(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    },
    [isCreateMode, userId, createUser, updateUser, success, showError, onSuccess, navigate, reset]
  );

  // -------------------------------------------------------------------------
  // Navigation Handlers
  // -------------------------------------------------------------------------

  /**
   * Handles cancel button click
   * Shows unsaved changes warning if form is dirty
   */
  const handleCancel = useCallback(() => {
    if (isDirty) {
      setShowUnsavedChangesModal(true);
      setPendingNavigation(() => () => {
        if (onCancel) {
          onCancel();
        } else {
          navigate('/admin/users');
        }
      });
    } else {
      if (onCancel) {
        onCancel();
      } else {
        navigate('/admin/users');
      }
    }
  }, [isDirty, onCancel, navigate]);

  /**
   * Handles confirmation of navigation despite unsaved changes
   */
  const handleConfirmNavigation = useCallback(() => {
    setShowUnsavedChangesModal(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  }, [pendingNavigation]);

  /**
   * Handles cancellation of navigation (stay on form)
   */
  const handleCancelNavigation = useCallback(() => {
    setShowUnsavedChangesModal(false);
    setPendingNavigation(null);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [blocker]);

  /**
   * Handles back button click
   */
  const handleBack = useCallback(() => {
    handleCancel();
  }, [handleCancel]);

  // -------------------------------------------------------------------------
  // Auth Method Change Handler
  // -------------------------------------------------------------------------

  /**
   * Handles auth method change and clears password fields for external auth
   */
  useEffect(() => {
    if (isPasswordDisabled) {
      // Clear password fields when switching to external auth
      setValue('password', '');
      setValue('passwordConfirm', '');
    }
  }, [isPasswordDisabled, setValue]);

  // -------------------------------------------------------------------------
  // Render Helpers
  // -------------------------------------------------------------------------

  /**
   * Renders the form header with title and back button
   */
  const renderHeader = () => (
    <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
      {showBackButton && (
        <Button
          startIcon={<ArrowBack />}
          onClick={handleBack}
          color="inherit"
          size="small"
        >
          Back
        </Button>
      )}
      <Typography variant="h4" component="h1">
        {isCreateMode ? 'Create New User' : 'Edit User'}
      </Typography>
    </Box>
  );

  /**
   * Renders error alert if submission failed
   */
  const renderErrorAlert = () => {
    if (!submitError) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Alert
          severity="error"
          title="Submission Failed"
          message={submitError}
          closeable
          onClose={() => setSubmitError(null)}
        />
      </Box>
    );
  };

  /**
   * Renders permission denied alert if user lacks required capabilities
   */
  const renderPermissionAlert = () => {
    if (hasPermission) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Alert
          severity="warning"
          title="Permission Denied"
          message={`You do not have permission to ${isCreateMode ? 'create' : 'edit'} users.`}
        />
      </Box>
    );
  };

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------

  // Show loading spinner during submission
  if (isSubmitting) {
    return (
      <LoadingSpinner
        overlay
        message={isCreateMode ? 'Creating user...' : 'Saving changes...'}
      />
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {renderHeader()}
      {renderPermissionAlert()}
      {renderErrorAlert()}

      <Paper sx={{ p: 3 }}>
        {/* Account Information Section */}
        <Typography variant="h6" gutterBottom>
          Account Information
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3}>
          {/* Username Field */}
          <Grid item xs={12} md={6}>
            <FormInput
              name="username"
              label="Username"
              control={control}
              required
              disabled={!isCreateMode || isPasswordDisabled}
              helperText={
                !isCreateMode
                  ? 'Username cannot be changed after account creation'
                  : 'Lowercase letters and numbers only, starting with a letter'
              }
              autoComplete="username"
            />
          </Grid>

          {/* Authentication Method Field */}
          <Grid item xs={12} md={6}>
            <FormSelect
              name="auth"
              label="Authentication Method"
              control={control}
              options={AUTH_METHODS}
              required
              disabled={!hasPermission}
              helperText="How this user authenticates to the system"
            />
          </Grid>

          {/* Email Field */}
          <Grid item xs={12} md={6}>
            <FormInput
              name="email"
              label="Email Address"
              control={control}
              required
              type="email"
              disabled={!hasPermission}
              autoComplete="email"
            />
          </Grid>

          {/* Empty grid item for layout balance */}
          <Grid item xs={12} md={6} />

          {/* Password Fields - Only shown for manual auth or new users */}
          {(!isPasswordDisabled || isCreateMode) && (
            <>
              <Grid item xs={12} md={6}>
                <FormInput
                  name="password"
                  label={isCreateMode ? 'Password' : 'New Password'}
                  control={control}
                  type="password"
                  required={isCreateMode}
                  disabled={isPasswordDisabled || !hasPermission}
                  helperText={
                    isPasswordDisabled
                      ? 'Password is managed by external authentication'
                      : isCreateMode
                        ? 'Minimum 8 characters with uppercase, lowercase, and number'
                        : 'Leave blank to keep current password'
                  }
                  autoComplete="new-password"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormInput
                  name="passwordConfirm"
                  label="Confirm Password"
                  control={control}
                  type="password"
                  required={isCreateMode}
                  disabled={isPasswordDisabled || !hasPermission}
                  autoComplete="new-password"
                />
              </Grid>
            </>
          )}
        </Grid>

        {/* Personal Information Section */}
        <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
          Personal Information
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3}>
          {/* First Name */}
          <Grid item xs={12} md={6}>
            <FormInput
              name="firstname"
              label="First Name"
              control={control}
              required
              disabled={!hasPermission}
              autoComplete="given-name"
            />
          </Grid>

          {/* Last Name */}
          <Grid item xs={12} md={6}>
            <FormInput
              name="lastname"
              label="Last Name"
              control={control}
              required
              disabled={!hasPermission}
              autoComplete="family-name"
            />
          </Grid>

          {/* City */}
          <Grid item xs={12} md={6}>
            <FormInput
              name="city"
              label="City/Town"
              control={control}
              disabled={!hasPermission}
              autoComplete="address-level2"
            />
          </Grid>

          {/* Country */}
          <Grid item xs={12} md={6}>
            <FormSelect
              name="country"
              label="Country"
              control={control}
              options={COUNTRIES}
              disabled={!hasPermission}
            />
          </Grid>

          {/* Timezone */}
          <Grid item xs={12} md={6}>
            <FormSelect
              name="timezone"
              label="Timezone"
              control={control}
              options={TIMEZONES}
              groupBy={(option) => option.group}
              disabled={!hasPermission}
            />
          </Grid>

          {/* Empty grid item for layout */}
          <Grid item xs={12} md={6} />

          {/* Description */}
          <Grid item xs={12}>
            <FormTextarea
              name="description"
              label="Description"
              control={control}
              disabled={!hasPermission}
              rows={4}
              maxLength={2000}
              helperText="Brief description or bio (optional)"
              autoResize
            />
          </Grid>

          {/* Profile Picture */}
          <Grid item xs={12}>
            <FormFileUpload
              name="profilePicture"
              label="Profile Picture"
              control={control}
              accept="image/jpeg,image/png,image/gif"
              maxSize={2 * 1024 * 1024} // 2MB
              disabled={!hasPermission}
              helperText="Upload a profile picture (JPEG, PNG, or GIF, max 2MB)"
            />
          </Grid>
        </Grid>

        {/* Account Status Section - Admin Only */}
        {canViewHiddenDetails && (
          <>
            <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
              Account Status
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              {/* Suspended Status */}
              <Grid item xs={12} md={4}>
                <Controller
                  name="suspended"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          {...field}
                          checked={field.value}
                          color="warning"
                          disabled={!hasPermission}
                        />
                      }
                      label="Account Suspended"
                    />
                  )}
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  Suspended users cannot log in to the system
                </Typography>
              </Grid>

              {/* Email Confirmed Status */}
              <Grid item xs={12} md={4}>
                <Controller
                  name="confirmed"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          {...field}
                          checked={field.value}
                          color="success"
                          disabled={!hasPermission}
                        />
                      }
                      label="Email Confirmed"
                    />
                  )}
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  Whether the user's email address has been verified
                </Typography>
              </Grid>

              {/* Force Password Change */}
              <Grid item xs={12} md={4}>
                <Controller
                  name="forcePasswordChange"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          {...field}
                          checked={field.value}
                          color="primary"
                          disabled={isPasswordDisabled || !hasPermission}
                        />
                      }
                      label="Force Password Change"
                    />
                  )}
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  User must change password on next login
                </Typography>
              </Grid>
            </Grid>
          </>
        )}

        {/* Form Actions */}
        <Box
          sx={{
            mt: 4,
            pt: 3,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 2,
          }}
        >
          <Button
            variant="outlined"
            color="inherit"
            onClick={handleCancel}
            startIcon={<Cancel />}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <Save />}
            disabled={isSubmitting || !hasPermission || !isValid}
          >
            {isSubmitting
              ? 'Saving...'
              : isCreateMode
                ? 'Create User'
                : 'Save Changes'}
          </Button>
        </Box>
      </Paper>

      {/* Unsaved Changes Warning Modal */}
      <Modal
        open={showUnsavedChangesModal}
        onClose={handleCancelNavigation}
        title="Unsaved Changes"
        maxWidth="sm"
        actions={[
          {
            label: 'Stay on Page',
            onClick: handleCancelNavigation,
            variant: 'outlined',
          },
          {
            label: 'Discard Changes',
            onClick: handleConfirmNavigation,
            color: 'error',
            variant: 'contained',
          },
        ]}
      >
        <Typography>
          You have unsaved changes. Are you sure you want to leave this page?
          Your changes will be lost.
        </Typography>
      </Modal>
    </Box>
  );
}
