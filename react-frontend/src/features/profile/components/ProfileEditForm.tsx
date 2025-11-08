/**
 * ProfileEditForm Component
 *
 * Form component for editing user profile information.
 * Uses react-hook-form for form management and validation.
 * Integrates with useUpdateProfile hook for API mutations.
 *
 * @module features/profile/components
 */

import { useEffect } from 'react';
import {
  Box,
  Button,
  Grid,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import type { User, UpdateProfilePayload } from '../types/profile.types';
import type { ApiError } from '@/types/api';
import { useUpdateProfile } from '../hooks/useUpdateProfile';

/**
 * Props for ProfileEditForm component
 */
export interface ProfileEditFormProps {
  /**
   * User object to edit
   */
  user: User;

  /**
   * Callback when form is successfully submitted
   */
  onSuccess?: () => void;

  /**
   * Callback when cancel button is clicked
   */
  onCancel?: () => void;

  /**
   * Whether to show cancel button
   * @default true
   */
  showCancelButton?: boolean;

  /**
   * Additional CSS class name
   */
  className?: string;
}

/**
 * Form data structure matching UpdateProfilePayload
 */
type ProfileFormData = Omit<UpdateProfilePayload, 'userid'>;

/**
 * Common countries for country selector
 * In production, this would be fetched from API or config
 */
const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  // Add more countries as needed
];

/**
 * Common timezones for timezone selector
 * In production, this would be fetched from API
 */
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  // Add more timezones as needed
];

/**
 * ProfileEditForm Component
 *
 * Comprehensive form for editing user profile with validation,
 * error handling, and optimistic updates.
 *
 * @example
 * ```tsx
 * <ProfileEditForm
 *   user={currentUser}
 *   onSuccess={() => {
 *     toast.success('Profile updated!');
 *     navigate('/profile');
 *   }}
 *   onCancel={() => navigate('/profile')}
 * />
 * ```
 */
export function ProfileEditForm({
  user,
  onSuccess,
  onCancel,
  showCancelButton = true,
  className,
}: ProfileEditFormProps) {
  // Form management with react-hook-form
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    setError,
  } = useForm<ProfileFormData>({
    defaultValues: {
      firstname: user.firstname ?? '',
      lastname: user.lastname ?? '',
      email: user.email ?? '',
      city: user.city ?? '',
      country: user.country ?? '',
      timezone: user.timezone ?? '',
      lang: user.lang ?? '',
      phone1: user.phone1 ?? '',
      phone2: user.phone2 ?? '',
      institution: user.institution ?? '',
      department: user.department ?? '',
      description: user.description ?? '',
      interests: user.interests ?? '',
    },
  });

  // Profile update mutation
  const {
    mutate: updateProfile,
    isPending,
    isError,
    error,
    isSuccess,
  } = useUpdateProfile({
    onSuccess: () => {
      // Mutation succeeded
      onSuccess?.();
    },
    onError: (error) => {
      // Handle validation errors
      // Check if error has field-specific details
      if (error && typeof error === 'object' && 'details' in error) {
        const apiError = error as ApiError;
        const {details} = apiError;
        if (details && typeof details === 'object') {
          Object.entries(details).forEach(([field, message]) => {
            if (typeof message === 'string') {
              setError(field as keyof ProfileFormData, {
                type: 'server',
                message,
              });
            }
          });
        }
      }
    },
  });

  // Reset form when user changes
  useEffect(() => {
    reset({
      firstname: user.firstname ?? '',
      lastname: user.lastname ?? '',
      email: user.email ?? '',
      city: user.city ?? '',
      country: user.country ?? '',
      timezone: user.timezone ?? '',
      lang: user.lang ?? '',
      phone1: user.phone1 ?? '',
      phone2: user.phone2 ?? '',
      institution: user.institution ?? '',
      department: user.department ?? '',
      description: user.description ?? '',
      interests: user.interests ?? '',
    });
  }, [user, reset]);

  /**
   * Handle form submission
   */
  const onSubmit = (data: ProfileFormData) => {
    const payload: UpdateProfilePayload = {
      userid: user.id,
      ...data,
    };
    updateProfile(payload);
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      className={className}
      sx={{ maxWidth: 900, margin: 'auto' }}
    >
      {/* Error Alert */}
      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error?.message || 'Failed to update profile. Please try again.'}
        </Alert>
      )}

      {/* Success Alert */}
      {isSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Profile updated successfully!
        </Alert>
      )}

      {/* Basic Information Section */}
      <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
        Basic Information
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <Controller
            name="firstname"
            control={control}
            rules={{
              required: 'First name is required',
              minLength: { value: 2, message: 'Minimum 2 characters' },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="First Name"
                fullWidth
                required
                error={!!errors.firstname}
                helperText={errors.firstname?.message}
                disabled={isPending}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Controller
            name="lastname"
            control={control}
            rules={{
              required: 'Last name is required',
              minLength: { value: 2, message: 'Minimum 2 characters' },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Last Name"
                fullWidth
                required
                error={!!errors.lastname}
                helperText={errors.lastname?.message}
                disabled={isPending}
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="email"
            control={control}
            rules={{
              required: 'Email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address',
              },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Email"
                type="email"
                fullWidth
                required
                error={!!errors.email}
                helperText={errors.email?.message}
                disabled={isPending}
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Description / Bio"
                fullWidth
                multiline
                rows={4}
                error={!!errors.description}
                helperText={errors.description?.message}
                disabled={isPending}
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="interests"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Interests (comma-separated)"
                fullWidth
                placeholder="e.g., programming, teaching, mathematics"
                error={!!errors.interests}
                helperText={errors.interests?.message ?? 'Separate interests with commas'}
                disabled={isPending}
              />
            )}
          />
        </Grid>
      </Grid>

      {/* Location & Language Section */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Location & Language
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <Controller
            name="city"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="City"
                fullWidth
                error={!!errors.city}
                helperText={errors.city?.message}
                disabled={isPending}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Controller
            name="country"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth error={!!errors.country}>
                <InputLabel>Country</InputLabel>
                <Select {...field} label="Country" disabled={isPending}>
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {COUNTRIES.map((country) => (
                    <MenuItem key={country.code} value={country.code}>
                      {country.name}
                    </MenuItem>
                  ))}
                </Select>
                {errors.country && <FormHelperText>{errors.country.message}</FormHelperText>}
              </FormControl>
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Controller
            name="timezone"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth error={!!errors.timezone}>
                <InputLabel>Timezone</InputLabel>
                <Select {...field} label="Timezone" disabled={isPending}>
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {TIMEZONES.map((tz) => (
                    <MenuItem key={tz} value={tz}>
                      {tz}
                    </MenuItem>
                  ))}
                </Select>
                {errors.timezone && <FormHelperText>{errors.timezone.message}</FormHelperText>}
              </FormControl>
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Controller
            name="lang"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Preferred Language"
                fullWidth
                placeholder="e.g., en, es, fr"
                error={!!errors.lang}
                helperText={errors.lang?.message}
                disabled={isPending}
              />
            )}
          />
        </Grid>
      </Grid>

      {/* Contact Information Section */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Contact Information
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <Controller
            name="phone1"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Phone Number"
                fullWidth
                error={!!errors.phone1}
                helperText={errors.phone1?.message}
                disabled={isPending}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Controller
            name="phone2"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Alternative Phone"
                fullWidth
                error={!!errors.phone2}
                helperText={errors.phone2?.message}
                disabled={isPending}
              />
            )}
          />
        </Grid>
      </Grid>

      {/* Professional Information Section */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Professional Information
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <Controller
            name="institution"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Institution / Organization"
                fullWidth
                error={!!errors.institution}
                helperText={errors.institution?.message}
                disabled={isPending}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Controller
            name="department"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Department"
                fullWidth
                error={!!errors.department}
                helperText={errors.department?.message}
                disabled={isPending}
              />
            )}
          />
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box display="flex" gap={2} justifyContent="flex-end" mt={4}>
        {showCancelButton && (
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="contained"
          startIcon={isPending ? <CircularProgress size={20} /> : <SaveIcon />}
          disabled={isPending || !isDirty}
        >
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>
    </Box>
  );
}

export default ProfileEditForm;
