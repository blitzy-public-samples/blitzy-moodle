/**
 * LTI Configuration Form Component
 *
 * React form component for configuring LTI (Learning Tools Interoperability) external tool settings.
 * Provides comprehensive form fields for tool URL, authentication credentials, launch container options,
 * privacy settings, and grade passback configuration using Material-UI form controls and Zod validation.
 *
 * Features:
 * - Tool URL and secure tool URL configuration
 * - OAuth 1.0a credentials (consumer key, shared secret) for LTI 1.x
 * - LTI version selection (LTI 1.0/1.1 vs LTI 1.3)
 * - Preconfigured tool type selection from available types
 * - Launch container modes (embed, new window, replace window, embed without blocks)
 * - Privacy settings (send name, email, accept grades)
 * - Custom parameters in key=value format
 * - Icon URL configuration
 * - Grade passback settings
 * - Display options for title and description on launch
 *
 * References:
 * - public/mod/lti/mod_form.php - Instance configuration form
 * - public/mod/lti/edit_form.php - Tool type configuration form
 * - public/mod/lti/locallib.php - LTI constants and utilities
 *
 * @module features/activities/lti/components/LTIConfigForm
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  FormControlLabel,
  InputLabel,
  FormHelperText,
  Checkbox,
  Typography,
  Paper,
  Divider,
  Alert,
  Collapse,
  IconButton,
  Tooltip,
  CircularProgress,
  Grid,
  FormGroup,
  InputAdornment,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon,
  Security as SecurityIcon,
  Launch as LaunchIcon,
  Settings as SettingsIcon,
  Grade as GradeIcon,
  PrivacyTip as PrivacyTipIcon,
} from '@mui/icons-material';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { useUpdateLTIConfig } from '../hooks/useUpdateLTIConfig';
import type { UpdateLTIConfigParams } from '../hooks/useUpdateLTIConfig';
import { LtiVersion } from '../types/lti.types';
import { useLtiToolTypes } from '../api/ltiApi';

// ============================================================================
// Constants
// ============================================================================

/**
 * Launch container options based on locallib.php constants (lines 70-74)
 * LTI_LAUNCH_CONTAINER_DEFAULT = 1
 * LTI_LAUNCH_CONTAINER_EMBED = 2
 * LTI_LAUNCH_CONTAINER_EMBED_NO_BLOCKS = 3
 * LTI_LAUNCH_CONTAINER_WINDOW = 4
 * LTI_LAUNCH_CONTAINER_REPLACE_MOODLE_WINDOW = 5
 */
const LAUNCH_CONTAINER_OPTIONS = [
  { value: 1, label: 'Default', description: 'Use the default container setting from the tool configuration' },
  { value: 2, label: 'Embed', description: 'Embed the tool within the Moodle page with blocks visible' },
  { value: 3, label: 'Embed without blocks', description: 'Embed the tool in full page width without side blocks' },
  { value: 4, label: 'New window', description: 'Open the tool in a new browser window or tab' },
  { value: 5, label: 'Existing window', description: 'Replace the current Moodle window with the tool' },
] as const;

/**
 * LTI Version options based on locallib.php constants (lines 95-97)
 */
const LTI_VERSION_OPTIONS = [
  {
    value: LtiVersion.LTI_1P0,
    label: 'LTI 1.0/1.1 (OAuth 1.0a)',
    description: 'Uses consumer key and shared secret for OAuth 1.0a signing',
  },
  {
    value: LtiVersion.LTI_1P3,
    label: 'LTI 1.3 (JWT/OIDC)',
    description: 'Uses platform-initiated OIDC flow with JWT tokens for enhanced security',
  },
] as const;

/**
 * Grade scale options for grade passback
 */
const GRADE_TYPE_OPTIONS = [
  { value: 0, label: 'None', description: 'No grade passback' },
  { value: 100, label: 'Point (100)', description: 'Grade as percentage 0-100' },
  { value: 10, label: 'Point (10)', description: 'Grade as percentage 0-10' },
] as const;

// ============================================================================
// Validation Schema
// ============================================================================

/**
 * Custom URL validation that allows empty strings (optional fields)
 */
const optionalUrlSchema = z.string().refine(
  (val) => {
    if (!val || val.trim() === '') return true;
    try {
      const url = new URL(val);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  },
  { message: 'Must be a valid HTTP or HTTPS URL' }
);

/**
 * Secure URL validation (must use HTTPS)
 */
const secureUrlSchema = z.string().refine(
  (val) => {
    if (!val || val.trim() === '') return true;
    try {
      const url = new URL(val);
      return url.protocol === 'https:';
    } catch {
      return false;
    }
  },
  { message: 'Must be a valid HTTPS URL' }
);

/**
 * Custom parameters validation (key=value format, one per line)
 */
const customParamsSchema = z.string().refine(
  (val) => {
    if (!val || val.trim() === '') return true;
    const lines = val.split('\n').filter((line) => line.trim() !== '');
    return lines.every((line) => {
      const parts = line.split('=');
      return parts.length >= 2 && parts[0].trim() !== '';
    });
  },
  { message: 'Each parameter must be in key=value format, one per line' }
);

/**
 * Zod schema for LTI configuration form validation
 * Mirrors the validation rules from mod_form.php and edit_form.php
 */
const ltiConfigFormSchema = z.object({
  // Basic Configuration
  toolurl: optionalUrlSchema.optional(),
  securetoolurl: secureUrlSchema.optional(),

  // Authentication (LTI 1.x)
  resourcekey: z.string().max(255, 'Consumer key must be at most 255 characters').optional(),
  password: z.string().max(255, 'Shared secret must be at most 255 characters').optional(),

  // LTI Version
  ltiversion: z.nativeEnum(LtiVersion).optional(),

  // Tool Type
  typeid: z.number().int().min(0).optional(),

  // Launch Settings
  launchcontainer: z.number().int().min(1).max(5).optional(),
  showtitlelaunch: z.boolean().optional(),
  showdescriptionlaunch: z.boolean().optional(),

  // Custom Parameters
  instructorcustomparameters: customParamsSchema.optional(),

  // Icons
  icon: optionalUrlSchema.optional(),
  secureicon: secureUrlSchema.optional(),

  // Privacy Settings
  instructorchoicesendname: z.boolean().optional(),
  instructorchoicesendemailaddr: z.boolean().optional(),
  instructorchoiceacceptgrades: z.boolean().optional(),

  // Grade Settings
  grade: z.number().min(-999).max(100).optional(),

  // Debug Mode
  debuglaunch: z.boolean().optional(),
});

/**
 * Type inference from Zod schema
 */
type LTIConfigFormData = z.infer<typeof ltiConfigFormSchema>;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Initial values for the LTI configuration form
 * All fields are optional to support partial updates
 */
export interface LTIConfigInitialValues {
  /** Tool launch URL */
  toolurl?: string;
  /** Secure tool URL (HTTPS) */
  securetoolurl?: string;
  /** OAuth consumer key */
  resourcekey?: string;
  /** OAuth shared secret */
  password?: string;
  /** LTI version */
  ltiversion?: LtiVersion | string;
  /** Preconfigured tool type ID */
  typeid?: number;
  /** Launch container mode (1-5) */
  launchcontainer?: number;
  /** Show title on launch */
  showtitlelaunch?: boolean | number;
  /** Show description on launch */
  showdescriptionlaunch?: boolean | number;
  /** Custom parameters (one per line, key=value format) */
  instructorcustomparameters?: string;
  /** Icon URL */
  icon?: string;
  /** Secure icon URL */
  secureicon?: string;
  /** Send user's name to tool */
  instructorchoicesendname?: boolean | number;
  /** Send user's email to tool */
  instructorchoicesendemailaddr?: boolean | number;
  /** Accept grades from tool */
  instructorchoiceacceptgrades?: boolean | number;
  /** Grade scale value */
  grade?: number;
  /** Debug launch mode */
  debuglaunch?: boolean | number;
}

/**
 * Props for the LTIConfigForm component
 */
export interface LTIConfigFormProps {
  /** LTI tool instance ID */
  ltiId: number;
  /** Initial values for the form fields */
  initialValues?: LTIConfigInitialValues;
  /** Callback function executed on successful configuration save */
  onSuccess?: () => void;
  /** Callback function executed when user cancels the form */
  onCancel?: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts a number (0 or 1) to boolean
 */
function toBoolean(value: boolean | number | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return false;
}

/**
 * Converts a boolean to number (0 or 1) for API compatibility
 */
function booleanToNumber(value: boolean | undefined): number {
  return value ? 1 : 0;
}

/**
 * Normalizes initial values to form data format
 */
function normalizeInitialValues(values?: LTIConfigInitialValues): LTIConfigFormData {
  return {
    toolurl: values?.toolurl ?? '',
    securetoolurl: values?.securetoolurl ?? '',
    resourcekey: values?.resourcekey ?? '',
    password: values?.password ?? '',
    ltiversion: (values?.ltiversion as LtiVersion) ?? LtiVersion.LTI_1P0,
    typeid: values?.typeid ?? 0,
    launchcontainer: values?.launchcontainer ?? 1,
    showtitlelaunch: toBoolean(values?.showtitlelaunch),
    showdescriptionlaunch: toBoolean(values?.showdescriptionlaunch),
    instructorcustomparameters: values?.instructorcustomparameters ?? '',
    icon: values?.icon ?? '',
    secureicon: values?.secureicon ?? '',
    instructorchoicesendname: toBoolean(values?.instructorchoicesendname),
    instructorchoicesendemailaddr: toBoolean(values?.instructorchoicesendemailaddr),
    instructorchoiceacceptgrades: toBoolean(values?.instructorchoiceacceptgrades),
    grade: values?.grade ?? 100,
    debuglaunch: toBoolean(values?.debuglaunch),
  };
}

/**
 * Converts form data to API update parameters
 */
function formDataToApiParams(data: LTIConfigFormData): UpdateLTIConfigParams {
  return {
    toolurl: data.toolurl || undefined,
    securetoolurl: data.securetoolurl || undefined,
    resourcekey: data.resourcekey || undefined,
    password: data.password || undefined,
    instructorcustomparameters: data.instructorcustomparameters || undefined,
    launchcontainer: data.launchcontainer,
    showtitlelaunch: booleanToNumber(data.showtitlelaunch),
    showdescriptionlaunch: booleanToNumber(data.showdescriptionlaunch),
    instructorchoicesendname: booleanToNumber(data.instructorchoicesendname),
    instructorchoicesendemailaddr: booleanToNumber(data.instructorchoicesendemailaddr),
    instructorchoiceacceptgrades: booleanToNumber(data.instructorchoiceacceptgrades),
    icon: data.icon || undefined,
    secureicon: data.secureicon || undefined,
    grade: data.grade,
    typeid: data.typeid && data.typeid > 0 ? data.typeid : undefined,
    debuglaunch: booleanToNumber(data.debuglaunch),
  };
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * LTI Configuration Form Component
 *
 * A comprehensive form for configuring LTI external tool settings including
 * tool URL, authentication credentials, launch container options, privacy settings,
 * and grade passback configuration.
 *
 * @example
 * ```tsx
 * function LTISettingsPage({ ltiId }: { ltiId: number }) {
 *   const handleSuccess = () => {
 *     toast.success('Configuration saved successfully');
 *     router.push(`/lti/${ltiId}`);
 *   };
 *
 *   return (
 *     <LTIConfigForm
 *       ltiId={ltiId}
 *       initialValues={{
 *         toolurl: 'https://example.com/lti',
 *         launchcontainer: 2,
 *       }}
 *       onSuccess={handleSuccess}
 *       onCancel={() => router.back()}
 *     />
 *   );
 * }
 * ```
 */
const LTIConfigForm: React.FC<LTIConfigFormProps> = ({
  ltiId,
  initialValues,
  onSuccess,
  onCancel,
}) => {
  // ============================================================================
  // State Management
  // ============================================================================

  /** Track expanded state for advanced sections */
  const [expandedSections, setExpandedSections] = useState({
    authentication: true,
    launch: true,
    privacy: true,
    display: false,
    advanced: false,
  });

  /** Track form submission attempt for showing all errors */
  const [hasSubmitAttempted, setHasSubmitAttempted] = useState(false);

  // ============================================================================
  // Hooks
  // ============================================================================

  /** Mutation hook for updating LTI configuration */
  const {
    updateConfig,
    isUpdating,
    error: updateError,
    isSuccess: isUpdateSuccess,
    reset: resetMutation,
  } = useUpdateLTIConfig(ltiId, {
    onSuccess: () => {
      onSuccess?.();
    },
  });

  /** Query hook for fetching available tool types */
  const {
    data: toolTypesData,
    isLoading: isLoadingToolTypes,
    error: toolTypesError,
  } = useLtiToolTypes({ includeGlobal: true });

  /** React Hook Form setup with Zod validation */
  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty, isValid },
  } = useForm<LTIConfigFormData>({
    resolver: zodResolver(ltiConfigFormSchema),
    defaultValues: normalizeInitialValues(initialValues),
    mode: 'onChange',
  });

  /** Watch LTI version for conditional field display */
  const selectedLtiVersion = watch('ltiversion');
  const selectedTypeId = watch('typeid');

  // ============================================================================
  // Memoized Values
  // ============================================================================

  /** Determine if OAuth credentials should be shown (LTI 1.x only) */
  const showOAuthCredentials = useMemo(() => {
    return selectedLtiVersion !== LtiVersion.LTI_1P3;
  }, [selectedLtiVersion]);

  /** Available tool types for selection */
  const availableToolTypes = useMemo(() => {
    if (!toolTypesData?.types) return [];
    return [
      { id: 0, name: 'Manual configuration (specify tool URL)' },
      ...toolTypesData.types.map((type) => ({
        id: type.id,
        name: type.name,
        baseurl: type.baseurl,
      })),
    ];
  }, [toolTypesData]);

  // ============================================================================
  // Effects
  // ============================================================================

  /** Reset form when initial values change */
  useEffect(() => {
    reset(normalizeInitialValues(initialValues));
  }, [initialValues, reset]);

  /** Call onSuccess callback when update succeeds */
  useEffect(() => {
    if (isUpdateSuccess) {
      resetMutation();
    }
  }, [isUpdateSuccess, resetMutation]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Toggles the expanded state of a section
   */
  const handleToggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  /**
   * Handles form submission
   */
  const onSubmit: SubmitHandler<LTIConfigFormData> = useCallback(
    async (data) => {
      setHasSubmitAttempted(true);
      const apiParams = formDataToApiParams(data);
      await updateConfig(apiParams);
    },
    [updateConfig]
  );

  /**
   * Handles cancel button click
   */
  const handleCancel = useCallback(() => {
    if (isDirty) {
      // Could show a confirmation dialog here
      reset(normalizeInitialValues(initialValues));
    }
    onCancel?.();
  }, [isDirty, reset, initialValues, onCancel]);

  /**
   * Handles form reset
   */
  const handleReset = useCallback(() => {
    reset(normalizeInitialValues(initialValues));
    setHasSubmitAttempted(false);
    resetMutation();
  }, [reset, initialValues, resetMutation]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  /**
   * Renders a section header with expand/collapse functionality
   */
  const renderSectionHeader = (
    title: string,
    section: keyof typeof expandedSections,
    icon: React.ReactNode
  ) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        py: 1,
        px: 2,
        bgcolor: 'action.hover',
        borderRadius: 1,
        mb: 2,
      }}
      onClick={() => handleToggleSection(section)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleToggleSection(section);
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {icon}
        <Typography variant="subtitle1" fontWeight="medium">
          {title}
        </Typography>
      </Box>
      <IconButton size="small" aria-label={expandedSections[section] ? 'Collapse' : 'Expand'}>
        {expandedSections[section] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </IconButton>
    </Box>
  );

  // ============================================================================
  // Component Render
  // ============================================================================

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Error Alert */}
      {updateError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => resetMutation()}>
          <Typography variant="subtitle2" gutterBottom>
            Failed to save configuration
          </Typography>
          <Typography variant="body2">{updateError.message}</Typography>
        </Alert>
      )}

      {/* Tool Types Error */}
      {toolTypesError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Unable to load preconfigured tool types. You can still configure the tool manually.
          </Typography>
        </Alert>
      )}

      <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.default' }}>
        {/* ================================================================== */}
        {/* Tool Type Selection */}
        {/* ================================================================== */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            External Tool Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure the LTI external tool settings. You can select a preconfigured tool type or
            configure the tool manually.
          </Typography>

          <Controller
            name="typeid"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth error={!!errors.typeid}>
                <InputLabel id="typeid-label">Tool Type</InputLabel>
                <Select
                  {...field}
                  labelId="typeid-label"
                  label="Tool Type"
                  disabled={isLoadingToolTypes}
                >
                  {availableToolTypes.map((type) => (
                    <MenuItem key={type.id} value={type.id}>
                      {type.name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {errors.typeid?.message ||
                    'Select a preconfigured tool type or choose manual configuration'}
                </FormHelperText>
              </FormControl>
            )}
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* ================================================================== */}
        {/* LTI Version Selection */}
        {/* ================================================================== */}
        <Box sx={{ mb: 4 }}>
          <Controller
            name="ltiversion"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth error={!!errors.ltiversion}>
                <InputLabel id="ltiversion-label">LTI Version</InputLabel>
                <Select {...field} labelId="ltiversion-label" label="LTI Version">
                  {LTI_VERSION_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      <Box>
                        <Typography variant="body1">{option.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {errors.ltiversion?.message ||
                    'LTI 1.3 provides enhanced security with JWT-based authentication'}
                </FormHelperText>
              </FormControl>
            )}
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* ================================================================== */}
        {/* Authentication Section */}
        {/* ================================================================== */}
        {renderSectionHeader('Authentication & Security', 'authentication', <SecurityIcon />)}
        <Collapse in={expandedSections.authentication}>
          <Box sx={{ px: 2, pb: 3 }}>
            {/* Tool URL */}
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Controller
                  name="toolurl"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Tool URL"
                      placeholder="https://example.com/lti/launch"
                      error={!!errors.toolurl}
                      helperText={
                        errors.toolurl?.message ||
                        'The base URL of the LTI tool. This is the URL that will be used to launch the tool.'
                      }
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LaunchIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="securetoolurl"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Secure Tool URL (HTTPS)"
                      placeholder="https://example.com/lti/launch"
                      error={!!errors.securetoolurl}
                      helperText={
                        errors.securetoolurl?.message ||
                        'Optional. The secure (HTTPS) URL for the tool. Used when the Moodle site is accessed via HTTPS.'
                      }
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SecurityIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              {/* OAuth Credentials - Only shown for LTI 1.x */}
              {showOAuthCredentials && (
                <>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="resourcekey"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Consumer Key"
                          placeholder="Enter consumer key"
                          error={!!errors.resourcekey}
                          helperText={
                            errors.resourcekey?.message ||
                            'The consumer key provided by the tool provider for OAuth authentication'
                          }
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Controller
                      name="password"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          type="password"
                          label="Shared Secret"
                          placeholder="Enter shared secret"
                          error={!!errors.password}
                          helperText={
                            errors.password?.message ||
                            'The shared secret provided by the tool provider for OAuth signing'
                          }
                        />
                      )}
                    />
                  </Grid>
                </>
              )}

              {/* LTI 1.3 Info Message */}
              {!showOAuthCredentials && (
                <Grid item xs={12}>
                  <Alert severity="info" icon={<InfoIcon />}>
                    <Typography variant="body2">
                      LTI 1.3 uses platform-managed keys and OIDC authentication. Consumer key and
                      shared secret are not required. Configure the tool type with the appropriate
                      public key or JWK keyset URL.
                    </Typography>
                  </Alert>
                </Grid>
              )}
            </Grid>
          </Box>
        </Collapse>

        <Divider sx={{ my: 2 }} />

        {/* ================================================================== */}
        {/* Launch Settings Section */}
        {/* ================================================================== */}
        {renderSectionHeader('Launch Settings', 'launch', <LaunchIcon />)}
        <Collapse in={expandedSections.launch}>
          <Box sx={{ px: 2, pb: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Controller
                  name="launchcontainer"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.launchcontainer}>
                      <InputLabel id="launchcontainer-label">Launch Container</InputLabel>
                      <Select
                        {...field}
                        labelId="launchcontainer-label"
                        label="Launch Container"
                      >
                        {LAUNCH_CONTAINER_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            <Box>
                              <Typography variant="body1">{option.label}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {option.description}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>
                        {errors.launchcontainer?.message ||
                          'How the tool will be displayed when launched'}
                      </FormHelperText>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="instructorcustomparameters"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={4}
                      label="Custom Parameters"
                      placeholder="param1=value1&#10;param2=value2"
                      error={!!errors.instructorcustomparameters}
                      helperText={
                        errors.instructorcustomparameters?.message ||
                        'Custom parameters to pass to the tool. Enter one parameter per line in key=value format.'
                      }
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        </Collapse>

        <Divider sx={{ my: 2 }} />

        {/* ================================================================== */}
        {/* Privacy Settings Section */}
        {/* ================================================================== */}
        {renderSectionHeader('Privacy Settings', 'privacy', <PrivacyTipIcon />)}
        <Collapse in={expandedSections.privacy}>
          <Box sx={{ px: 2, pb: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Control what user information is shared with the external tool when launching.
            </Typography>
            <FormGroup>
              <Controller
                name="instructorchoicesendname"
                control={control}
                render={({ field: { value, onChange, ...field } }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        {...field}
                        checked={value}
                        onChange={(e) => onChange(e.target.checked)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1">Share launcher's name</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Send the user's full name to the tool provider
                        </Typography>
                      </Box>
                    }
                  />
                )}
              />

              <Controller
                name="instructorchoicesendemailaddr"
                control={control}
                render={({ field: { value, onChange, ...field } }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        {...field}
                        checked={value}
                        onChange={(e) => onChange(e.target.checked)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1">Share launcher's email</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Send the user's email address to the tool provider
                        </Typography>
                      </Box>
                    }
                  />
                )}
              />

              <Controller
                name="instructorchoiceacceptgrades"
                control={control}
                render={({ field: { value, onChange, ...field } }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        {...field}
                        checked={value}
                        onChange={(e) => onChange(e.target.checked)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1">Accept grades from the tool</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Allow the tool to send grades back to the Moodle gradebook
                        </Typography>
                      </Box>
                    }
                  />
                )}
              />
            </FormGroup>
          </Box>
        </Collapse>

        <Divider sx={{ my: 2 }} />

        {/* ================================================================== */}
        {/* Display Settings Section */}
        {/* ================================================================== */}
        {renderSectionHeader('Display Options', 'display', <SettingsIcon />)}
        <Collapse in={expandedSections.display}>
          <Box sx={{ px: 2, pb: 3 }}>
            <FormGroup sx={{ mb: 3 }}>
              <Controller
                name="showtitlelaunch"
                control={control}
                render={({ field: { value, onChange, ...field } }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        {...field}
                        checked={value}
                        onChange={(e) => onChange(e.target.checked)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1">Show activity name on launch</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Display the activity name above the tool when embedded
                        </Typography>
                      </Box>
                    }
                  />
                )}
              />

              <Controller
                name="showdescriptionlaunch"
                control={control}
                render={({ field: { value, onChange, ...field } }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        {...field}
                        checked={value}
                        onChange={(e) => onChange(e.target.checked)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1">Show activity description on launch</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Display the activity description above the tool when embedded
                        </Typography>
                      </Box>
                    }
                  />
                )}
              />
            </FormGroup>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="icon"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Icon URL"
                      placeholder="https://example.com/icon.png"
                      error={!!errors.icon}
                      helperText={
                        errors.icon?.message ||
                        'URL of an icon to display for this activity (optional)'
                      }
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="secureicon"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Secure Icon URL (HTTPS)"
                      placeholder="https://example.com/icon.png"
                      error={!!errors.secureicon}
                      helperText={
                        errors.secureicon?.message ||
                        'HTTPS URL of an icon for secure connections (optional)'
                      }
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        </Collapse>

        <Divider sx={{ my: 2 }} />

        {/* ================================================================== */}
        {/* Advanced Settings Section */}
        {/* ================================================================== */}
        {renderSectionHeader('Grade & Advanced Settings', 'advanced', <GradeIcon />)}
        <Collapse in={expandedSections.advanced}>
          <Box sx={{ px: 2, pb: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="grade"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.grade}>
                      <InputLabel id="grade-label">Grade Type</InputLabel>
                      <Select {...field} labelId="grade-label" label="Grade Type">
                        {GRADE_TYPE_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            <Box>
                              <Typography variant="body1">{option.label}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {option.description}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>
                        {errors.grade?.message ||
                          'The maximum grade that can be passed back from the tool'}
                      </FormHelperText>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="debuglaunch"
                  control={control}
                  render={({ field: { value, onChange, ...field } }) => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          {...field}
                          checked={value}
                          onChange={(e) => onChange(e.target.checked)}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1">Enable debug mode</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Show detailed launch parameters for debugging (not recommended for
                            production)
                          </Typography>
                        </Box>
                      }
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Paper>

      {/* ================================================================== */}
      {/* Form Actions */}
      {/* ================================================================== */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 2,
          mt: 3,
          pt: 2,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Button variant="outlined" onClick={handleCancel} disabled={isUpdating}>
          Cancel
        </Button>
        <Button variant="outlined" onClick={handleReset} disabled={isUpdating || !isDirty}>
          Reset
        </Button>
        <Tooltip
          title={
            !isValid && hasSubmitAttempted
              ? 'Please fix the validation errors before saving'
              : ''
          }
        >
          <span>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isUpdating || (hasSubmitAttempted && !isValid)}
              startIcon={isUpdating ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isUpdating ? 'Saving...' : 'Save Configuration'}
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default LTIConfigForm;
