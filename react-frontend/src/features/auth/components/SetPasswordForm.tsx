/**
 * Set Password Form Component
 *
 * React Hook Form-based set password form component using Material-UI v5 components
 * with Zod validation. This component collects new password and confirmation,
 * displays password policy requirements from API, validates password strength
 * client-side, and calls the password set API endpoint with reset token.
 *
 * @package    react-frontend
 * @subpackage auth
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import type React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  CircularProgress,
  LinearProgress,
  FormHelperText,
  Paper,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { apiClient } from '@/services/api/client';

/**
 * Password policy configuration interface
 */
interface PasswordPolicy {
  minLength: number;
  minDigits: number;
  minLower: number;
  minUpper: number;
  minNonAlphanumeric: number;
  reuseLimit: number;
  maxLength: number;
}

/**
 * Password strength levels
 */
enum PasswordStrength {
  WEAK = 'weak',
  FAIR = 'fair',
  GOOD = 'good',
  STRONG = 'strong',
}

/**
 * Password strength result
 */
interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number;
  feedback: string[];
}

/**
 * Form data interface
 */
interface SetPasswordFormData {
  password: string;
  password2: string;
  logoutOtherSessions: boolean;
}

/**
 * Component props interface
 */
interface SetPasswordFormProps {
  token: string;
  onSuccess: () => void;
  username?: string;
}

/**
 * API response interface for password policy
 */
interface PasswordPolicyResponse {
  success: boolean;
  data: PasswordPolicy;
}

/**
 * API response interface for password set
 */
interface SetPasswordResponse {
  success: boolean;
  data: {
    message: string;
    redirectUrl?: string;
  };
}

/**
 * API error response interface
 */
interface ApiError {
  response?: {
    data?: {
      success: boolean;
      error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
      };
    };
  };
  message: string;
}

/**
 * Calculate password strength based on various criteria
 */
const calculatePasswordStrength = (
  password: string,
  policy: PasswordPolicy
): PasswordStrengthResult => {
  let score = 0;
  const feedback: string[] = [];

  // Length check
  if (password.length >= policy.minLength) {
    score += 20;
  } else {
    feedback.push(`Password must be at least ${policy.minLength} characters long`);
  }

  if (password.length >= policy.minLength * 1.5) {
    score += 10;
  }

  // Digit check
  const digitCount = (password.match(/\d/g) ?? []).length;
  if (digitCount >= policy.minDigits) {
    score += 15;
  } else if (policy.minDigits > 0) {
    feedback.push(`Password must contain at least ${policy.minDigits} digit(s)`);
  }

  // Lowercase check
  const lowerCount = (password.match(/[a-z]/g) ?? []).length;
  if (lowerCount >= policy.minLower) {
    score += 15;
  } else if (policy.minLower > 0) {
    feedback.push(`Password must contain at least ${policy.minLower} lowercase letter(s)`);
  }

  // Uppercase check
  const upperCount = (password.match(/[A-Z]/g) ?? []).length;
  if (upperCount >= policy.minUpper) {
    score += 15;
  } else if (policy.minUpper > 0) {
    feedback.push(`Password must contain at least ${policy.minUpper} uppercase letter(s)`);
  }

  // Non-alphanumeric check
  const nonAlphaCount = (password.match(/[^a-zA-Z0-9]/g) ?? []).length;
  if (nonAlphaCount >= policy.minNonAlphanumeric) {
    score += 15;
  } else if (policy.minNonAlphanumeric > 0) {
    feedback.push(
      `Password must contain at least ${policy.minNonAlphanumeric} special character(s)`
    );
  }

  // Variety bonus
  const hasVariety =
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^a-zA-Z0-9]/.test(password);
  if (hasVariety) {
    score += 10;
  }

  // Check if all minimum requirements are met
  const meetsMinimumRequirements =
    password.length >= policy.minLength &&
    digitCount >= policy.minDigits &&
    lowerCount >= policy.minLower &&
    upperCount >= policy.minUpper &&
    nonAlphaCount >= policy.minNonAlphanumeric;

  // Determine strength level
  // If minimum requirements aren't met, password is WEAK regardless of score
  let strength: PasswordStrength;
  if (!meetsMinimumRequirements) {
    strength = PasswordStrength.WEAK;
  } else if (score >= 80) {
    strength = PasswordStrength.STRONG;
  } else if (score >= 60) {
    strength = PasswordStrength.GOOD;
  } else if (score >= 40) {
    strength = PasswordStrength.FAIR;
  } else {
    strength = PasswordStrength.WEAK;
  }

  return { strength, score, feedback };
};

/**
 * Get color for password strength indicator
 */
const getStrengthColor = (strength: PasswordStrength): string => {
  switch (strength) {
    case PasswordStrength.STRONG:
      return 'success.main';
    case PasswordStrength.GOOD:
      return 'info.main';
    case PasswordStrength.FAIR:
      return 'warning.main';
    case PasswordStrength.WEAK:
      return 'error.main';
    default:
      return 'grey.500';
  }
};

/**
 * Get label for password strength
 */
const getStrengthLabel = (strength: PasswordStrength): string => {
  switch (strength) {
    case PasswordStrength.STRONG:
      return 'Strong';
    case PasswordStrength.GOOD:
      return 'Good';
    case PasswordStrength.FAIR:
      return 'Fair';
    case PasswordStrength.WEAK:
      return 'Weak';
    default:
      return '';
  }
};

/**
 * SetPasswordForm Component
 *
 * Renders a form for users to set a new password using a reset token.
 * Features include password strength indicator, policy requirements display,
 * and accessibility compliance.
 */
function SetPasswordForm({ token, onSuccess, username }: SetPasswordFormProps): React.JSX.Element {
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrengthResult | null>(null);

  // Fetch password policy from API
  const {
    data: policyData,
    isLoading: isPolicyLoading,
    error: policyError,
  } = useQuery<PasswordPolicyResponse>({
    queryKey: ['passwordPolicy'],
    queryFn: async () => {
      const response = await apiClient.get<PasswordPolicyResponse>('/auth/password-policy');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry password policy fetch on failure
  });

  const passwordPolicy = useMemo(
    () =>
      policyData?.data ?? {
        minLength: 8,
        minDigits: 1,
        minLower: 1,
        minUpper: 1,
        minNonAlphanumeric: 1,
        reuseLimit: 5,
        maxLength: 128,
      },
    [policyData]
  );

  // Create dynamic Zod schema based on password policy
  const createPasswordSchema = (policy: PasswordPolicy) => {
    let passwordSchema = z
      .string()
      .min(policy.minLength, `Password must be at least ${policy.minLength} characters`)
      .max(policy.maxLength, `Password must not exceed ${policy.maxLength} characters`);

    if (policy.minDigits > 0) {
      passwordSchema = passwordSchema.regex(
        new RegExp(`(.*\\d){${policy.minDigits}}`),
        `Password must contain at least ${policy.minDigits} digit(s)`
      );
    }

    if (policy.minLower > 0) {
      passwordSchema = passwordSchema.regex(
        new RegExp(`(.*[a-z]){${policy.minLower}}`),
        `Password must contain at least ${policy.minLower} lowercase letter(s)`
      );
    }

    if (policy.minUpper > 0) {
      passwordSchema = passwordSchema.regex(
        new RegExp(`(.*[A-Z]){${policy.minUpper}}`),
        `Password must contain at least ${policy.minUpper} uppercase letter(s)`
      );
    }

    if (policy.minNonAlphanumeric > 0) {
      passwordSchema = passwordSchema.regex(
        new RegExp(`(.*[^a-zA-Z0-9]){${policy.minNonAlphanumeric}}`),
        `Password must contain at least ${policy.minNonAlphanumeric} special character(s)`
      );
    }

    return z
      .object({
        password: passwordSchema,
        password2: z.string().min(1, 'Password confirmation is required'),
        logoutOtherSessions: z.boolean(),
      })
      .refine((data) => data.password === data.password2, {
        message: 'Passwords do not match',
        path: ['password2'],
      });
  };

  const schema = useMemo(() => createPasswordSchema(passwordPolicy), [passwordPolicy]);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
    trigger,
  } = useForm<SetPasswordFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      password: '',
      password2: '',
      logoutOtherSessions: true,
    },
    mode: 'onChange',
  });

  const passwordValue = watch('password');

  // Re-validate form when password policy changes
  useEffect(() => {
    if (passwordValue) {
      void trigger('password');
    }
  }, [passwordPolicy, passwordValue, trigger]);

  // Update password strength as user types
  useEffect(() => {
    if (passwordValue) {
      const strength = calculatePasswordStrength(passwordValue, passwordPolicy);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(null);
    }
  }, [passwordValue, passwordPolicy]);

  // Set password mutation
  const setPasswordMutation = useMutation<SetPasswordResponse, ApiError, SetPasswordFormData>({
    mutationFn: async (data: SetPasswordFormData) => {
      const response = await apiClient.post<SetPasswordResponse>('/auth/password-reset/set', {
        token,
        password: data.password,
        logoutOtherSessions: data.logoutOtherSessions,
      });
      return response.data;
    },
    onSuccess: (_data) => {
      // Call onSuccess callback immediately
      // The success message will be visible for 1.5s via the mutation state
      onSuccess();
    },
    onError: (error: ApiError) => {
      const errorMessage =
        error.response?.data?.error?.message ?? error.message ?? 'An error occurred';
      const errorCode = error.response?.data?.error?.code;

      // Handle specific error cases
      if (errorCode === 'PASSWORD_REUSED') {
        setError('password', {
          type: 'manual',
          message: `This password has been used recently. Please choose a different password. (Last ${passwordPolicy.reuseLimit} passwords cannot be reused)`,
        });
        setError('password2', {
          type: 'manual',
          message: 'Please enter a different password',
        });
      } else if (errorCode === 'TOKEN_EXPIRED' || errorCode === 'INVALID_TOKEN') {
        setError('password', {
          type: 'manual',
          message: 'Password reset link has expired. Please request a new one.',
        });
      } else if (errorCode === 'RATE_LIMIT_EXCEEDED') {
        setError('password', {
          type: 'manual',
          message: 'Too many attempts. Please try again later.',
        });
      } else {
        setError('password', {
          type: 'manual',
          message: errorMessage,
        });
      }
    },
  });

  // Combine form validation state and mutation loading state for proper disabled/loading states
  const isLoading = isSubmitting || setPasswordMutation.isPending;

  const onSubmit = (data: SetPasswordFormData) => {
    setPasswordMutation.mutate(data);
  };

  // Handle toggle password visibility
  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleTogglePassword2Visibility = () => {
    setShowPassword2(!showPassword2);
  };

  // Show loading state while fetching policy
  if (isPolicyLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="300px"
        role="status"
        aria-live="polite"
        aria-label="Loading password policy"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Show error if policy fetch failed
  if (policyError) {
    return (
      <Alert severity="error" role="alert">
        Unable to load password requirements. Please try again later.
      </Alert>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-labelledby="set-password-heading"
    >
      <Stack spacing={3}>
        {/* Success message */}
        {setPasswordMutation.isSuccess && (
          <Alert severity="success" icon={<CheckCircleIcon />} role="alert" aria-live="polite">
            {setPasswordMutation.data?.data?.message ||
              'Password has been successfully updated! Redirecting...'}
          </Alert>
        )}

        {/* Username display (for browser autocomplete context) */}
        {username && (
          <input
            type="text"
            name="username"
            value={username}
            autoComplete="username"
            readOnly
            style={{
              position: 'absolute',
              left: '-9999px',
              width: '1px',
              height: '1px',
            }}
            aria-hidden="true"
            tabIndex={-1}
          />
        )}

        {username && (
          <Box>
            <Typography variant="body2" color="text.secondary">
              Username:
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {username}
            </Typography>
          </Box>
        )}

        {/* Password policy information */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            bgcolor: 'info.light',
            borderLeft: 4,
            borderColor: 'info.main',
          }}
          role="region"
          aria-label="Password requirements"
        >
          <Stack spacing={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <InfoIcon fontSize="small" color="info" />
              <Typography variant="subtitle2" fontWeight="bold">
                Password Requirements
              </Typography>
            </Box>
            <Box component="ul" sx={{ m: 0, pl: 3 }}>
              <Typography component="li" variant="body2">
                Minimum length: {passwordPolicy.minLength} characters
              </Typography>
              {passwordPolicy.minDigits > 0 && (
                <Typography component="li" variant="body2">
                  At least {passwordPolicy.minDigits} digit(s)
                </Typography>
              )}
              {passwordPolicy.minLower > 0 && (
                <Typography component="li" variant="body2">
                  At least {passwordPolicy.minLower} lowercase letter(s)
                </Typography>
              )}
              {passwordPolicy.minUpper > 0 && (
                <Typography component="li" variant="body2">
                  At least {passwordPolicy.minUpper} uppercase letter(s)
                </Typography>
              )}
              {passwordPolicy.minNonAlphanumeric > 0 && (
                <Typography component="li" variant="body2">
                  At least {passwordPolicy.minNonAlphanumeric} special character(s)
                </Typography>
              )}
              {passwordPolicy.reuseLimit > 0 && (
                <Typography component="li" variant="body2">
                  Cannot reuse last {passwordPolicy.reuseLimit} passwords
                </Typography>
              )}
            </Box>
          </Stack>
        </Paper>

        {/* Password field */}
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              fullWidth
              required
              error={Boolean(errors.password)}
              helperText={errors.password?.message}
              disabled={isLoading || setPasswordMutation.isSuccess}
              inputProps={{
                'aria-label': 'New password',
                'aria-describedby': errors.password ? 'password-error' : 'password-strength',
                'aria-invalid': Boolean(errors.password),
                maxLength: passwordPolicy.maxLength,
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={showPassword ? 'Hide password' : 'Show password'}>
                      <IconButton
                        onClick={handleTogglePasswordVisibility}
                        edge="end"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        disabled={isLoading || setPasswordMutation.isSuccess}
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
              FormHelperTextProps={{
                id: errors.password ? 'password-error' : undefined,
                role: errors.password ? 'alert' : undefined,
              }}
            />
          )}
        />

        {/* Password strength indicator */}
        {passwordStrength && (
          <Box
            role="status"
            aria-live="polite"
            aria-label={`Password strength: ${getStrengthLabel(passwordStrength.strength)}`}
            id="password-strength"
          >
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
              <Typography variant="caption" color="text.secondary">
                Password Strength:
              </Typography>
              <Typography
                variant="caption"
                fontWeight="bold"
                sx={{ color: getStrengthColor(passwordStrength.strength) }}
              >
                {getStrengthLabel(passwordStrength.strength)}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={passwordStrength.score}
              sx={{
                height: 6,
                borderRadius: 1,
                bgcolor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  bgcolor: getStrengthColor(passwordStrength.strength),
                  borderRadius: 1,
                },
              }}
            />
            {passwordStrength.feedback.length > 0 && (
              <Box mt={1}>
                {passwordStrength.feedback.map((feedback) => (
                  <Box key={feedback} display="flex" alignItems="center" gap={0.5}>
                    <CancelIcon fontSize="small" color="error" />
                    <Typography variant="caption" color="error">
                      {feedback}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Password confirmation field */}
        <Controller
          name="password2"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="New Password (again)"
              type={showPassword2 ? 'text' : 'password'}
              autoComplete="new-password"
              fullWidth
              required
              error={Boolean(errors.password2)}
              helperText={errors.password2?.message}
              disabled={isLoading || setPasswordMutation.isSuccess}
              inputProps={{
                'aria-label': 'Confirm new password',
                'aria-describedby': errors.password2 ? 'password2-error' : undefined,
                'aria-invalid': Boolean(errors.password2),
                maxLength: passwordPolicy.maxLength,
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={showPassword2 ? 'Hide password' : 'Show password'}>
                      <IconButton
                        onClick={handleTogglePassword2Visibility}
                        edge="end"
                        aria-label={
                          showPassword2
                            ? 'Hide confirmation password'
                            : 'Show confirmation password'
                        }
                        disabled={isLoading || setPasswordMutation.isSuccess}
                      >
                        {showPassword2 ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
              FormHelperTextProps={{
                id: errors.password2 ? 'password2-error' : undefined,
                role: errors.password2 ? 'alert' : undefined,
              }}
            />
          )}
        />

        {/* Logout other sessions checkbox */}
        <Controller
          name="logoutOtherSessions"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Checkbox
                  {...field}
                  checked={field.value}
                  disabled={isLoading || setPasswordMutation.isSuccess}
                  inputProps={{
                    'aria-label': 'Log out from other devices',
                    'aria-describedby': 'logout-sessions-help',
                  }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Log out from other devices</Typography>
                  <FormHelperText id="logout-sessions-help">
                    For security, log out all other sessions when you change your password
                  </FormHelperText>
                </Box>
              }
            />
          )}
        />

        {/* Action buttons */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            component={RouterLink}
            to="/login"
            variant="outlined"
            disabled={isLoading || setPasswordMutation.isSuccess}
            aria-label="Cancel and return to login page"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading || setPasswordMutation.isSuccess}
            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
            aria-label="Set new password"
          >
            {isLoading ? 'Setting Password...' : 'Set Password'}
          </Button>
        </Stack>

        {/* Additional help text */}
        <Box textAlign="center" mt={2}>
          <Typography variant="body2" color="text.secondary">
            Need help?{' '}
            <Link
              component={RouterLink}
              to="/help/password"
              underline="hover"
              aria-label="Get help with password reset"
            >
              Contact support
            </Link>
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

export default SetPasswordForm;
