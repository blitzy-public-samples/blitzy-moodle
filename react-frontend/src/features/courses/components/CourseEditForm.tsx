/**
 * CourseEditForm Component
 *
 * A comprehensive React form component for creating and editing Moodle courses.
 * Implements a multi-tab interface for organizing course settings with real-time
 * validation using react-hook-form and zod schema validation.
 *
 * Based on Moodle's course edit functionality from public/course/edit.php and
 * public/course/edit_form.php, this component provides a modern React interface
 * while maintaining compatibility with the existing backend API.
 *
 * Features:
 * - Multi-step form with tabs (General, Description, Settings, Enrollment, Completion)
 * - Real-time validation with comprehensive error messages
 * - Rich text editor integration for course descriptions
 * - File upload with preview for course images
 * - Category selection dropdown
 * - Date pickers for course start/end dates
 * - Loading states and error handling
 * - Unsaved changes warning before navigation
 * - Accessibility features (ARIA labels, keyboard navigation)
 * - TypeScript strict mode with explicit prop interfaces
 *
 * @example
 * ```tsx
 * // Create new course
 * <CourseEditForm
 *   onSubmit={handleCreateCourse}
 *   onCancel={handleCancel}
 * />
 *
 * // Edit existing course
 * <CourseEditForm
 *   courseId={42}
 *   onSubmit={handleUpdateCourse}
 *   onCancel={handleCancel}
 *   isLoading={isSubmitting}
 * />
 * ```
 *
 * @module features/courses/components/CourseEditForm
 * @see public/course/edit.php - Moodle course edit entry point
 * @see public/course/edit_form.php - Moodle course edit form definition
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import type { SubmitHandler, FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Tabs,
  Tab,
  TextField,
  Select,
  MenuItem,
  FormControl,
  FormControlLabel,
  Switch,
  Button,
  Grid,
  Paper,
  Typography,
  FormHelperText,
  Alert,
  CircularProgress,
  InputLabel,
  Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, isAfter, parseISO } from 'date-fns';

// Internal imports from depends_on_files
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { FormFileUpload } from '@/components/forms/FormFileUpload';
import { useCourse } from '@/features/courses/hooks/useCourse';
import type { CourseFormData } from '@/features/courses/types/course.types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Course format options supported by Moodle
 *
 * Common formats:
 * - 'topics': Standard topic-based course format
 * - 'weeks': Weekly-based course format
 * - 'social': Social format focusing on forums
 */
type CourseFormatType = 'topics' | 'weeks' | 'social' | 'singleactivity';

/**
 * Tab panel identifiers for the multi-step form
 */
type TabValue = 'general' | 'description' | 'settings' | 'enrollment' | 'completion';

/**
 * Category option for select dropdown
 */
interface CategoryOption {
  id: number;
  name: string;
  depth?: number;
}

/**
 * Extended form data interface for internal use
 * Extends CourseFormData with additional fields for form state
 */
interface ExtendedCourseFormData extends Omit<CourseFormData, 'startdate' | 'enddate' | 'visible'> {
  /** Course description (full HTML content) */
  description: string;
  /** Course start date as Date object for DatePicker */
  startDate: Date | null;
  /** Course end date as Date object for DatePicker */
  endDate: Date | null;
  /** Course visibility as boolean */
  visible: boolean;
  /** Course image URL (for preview) */
  imageUrl: string;
  /** Enrollment key/password for self-enrollment */
  enrollmentKey: string;
  /** Maximum enrollment limit (0 for unlimited) */
  maxEnrollment: number;
  /** Whether self-enrollment is enabled */
  selfEnrollmentEnabled: boolean;
  /** Whether completion tracking is enabled */
  completionEnabled: boolean;
  /** Course language override */
  language: string;
}

/**
 * Props interface for CourseEditForm component
 *
 * Defines all configuration options for the course edit form including
 * form submission, cancellation, and loading states.
 */
export interface CourseEditFormProps {
  /**
   * Course ID to edit (optional)
   * When provided, the form loads existing course data for editing.
   * When omitted, the form operates in create mode with empty defaults.
   */
  courseId?: number;

  /**
   * Callback function invoked on successful form submission
   * Receives validated form data conforming to CourseFormData interface.
   *
   * @param data - Validated course form data
   */
  onSubmit: (data: CourseFormData) => void;

  /**
   * Callback function invoked when user cancels the form
   * Should handle navigation away from the form.
   */
  onCancel: () => void;

  /**
   * Whether the form is in a loading state (e.g., during submission)
   * When true, disables form inputs and shows loading indicator on submit button.
   * @default false
   */
  isLoading?: boolean;
}

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

/**
 * Zod validation schema for course form data
 *
 * Implements validation rules based on Moodle's course validation:
 * - fullname: Required, 3-254 characters (core_course\constants::FULLNAME_MAXIMUM_LENGTH)
 * - shortname: Required, 2-100 characters (core_course\constants::SHORTNAME_MAXIMUM_LENGTH)
 * - category: Required, positive integer
 * - summary: Optional, max 500 characters for brief description
 * - description: Optional, unlimited length for full course description
 * - format: Required, must be valid format type
 * - startDate/endDate: Optional dates with endDate after startDate validation
 * - visible: Boolean for course visibility
 * - completionEnabled: Boolean for completion tracking
 * - maxEnrollment: Optional, non-negative integer
 */
const courseFormSchema = z
  .object({
    fullname: z
      .string()
      .min(3, 'Full name must be at least 3 characters')
      .max(254, 'Full name must not exceed 254 characters'),
    shortname: z
      .string()
      .min(2, 'Short name must be at least 2 characters')
      .max(100, 'Short name must not exceed 100 characters'),
    category: z
      .number({
        required_error: 'Please select a category',
        invalid_type_error: 'Please select a valid category',
      })
      .min(1, 'Please select a category'),
    summary: z
      .string()
      .max(500, 'Summary must not exceed 500 characters')
      .optional()
      .default(''),
    description: z.string().optional().default(''),
    format: z.enum(['topics', 'weeks', 'social', 'singleactivity'], {
      required_error: 'Please select a course format',
      invalid_type_error: 'Invalid course format',
    }),
    startDate: z.date().nullable().optional(),
    endDate: z.date().nullable().optional(),
    visible: z.boolean().default(true),
    imageUrl: z.string().optional().default(''),
    enrollmentKey: z.string().optional().default(''),
    maxEnrollment: z
      .number()
      .min(0, 'Maximum enrollment must be 0 or greater')
      .optional()
      .default(0),
    selfEnrollmentEnabled: z.boolean().default(false),
    completionEnabled: z.boolean().default(false),
    language: z.string().optional().default(''),
  })
  .refine(
    (data) => {
      // Validate that endDate is after startDate if both are provided
      if (data.startDate && data.endDate) {
        return isAfter(data.endDate, data.startDate);
      }
      return true;
    },
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    }
  );

/**
 * Inferred type from Zod schema for type-safe form handling
 */
type CourseFormSchema = z.infer<typeof courseFormSchema>;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default form values for new course creation
 */
const defaultFormValues: CourseFormSchema = {
  fullname: '',
  shortname: '',
  category: 0,
  summary: '',
  description: '',
  format: 'topics',
  startDate: new Date(),
  endDate: null,
  visible: true,
  imageUrl: '',
  enrollmentKey: '',
  maxEnrollment: 0,
  selfEnrollmentEnabled: false,
  completionEnabled: false,
  language: '',
};

/**
 * Course format options with display labels
 */
const COURSE_FORMATS: Array<{ value: CourseFormatType; label: string; description: string }> = [
  {
    value: 'topics',
    label: 'Topics format',
    description: 'The course page is organized into topic sections',
  },
  {
    value: 'weeks',
    label: 'Weekly format',
    description: 'The course page is organized into weekly sections',
  },
  {
    value: 'social',
    label: 'Social format',
    description: 'A single discussion forum is the main element',
  },
  {
    value: 'singleactivity',
    label: 'Single activity format',
    description: 'Course contains only one activity',
  },
];

/**
 * Mock categories for demo purposes
 * In production, these would be fetched from the API
 */
const MOCK_CATEGORIES: CategoryOption[] = [
  { id: 1, name: 'Miscellaneous', depth: 0 },
  { id: 2, name: 'Computer Science', depth: 0 },
  { id: 3, name: 'Programming', depth: 1 },
  { id: 4, name: 'Web Development', depth: 1 },
  { id: 5, name: 'Mathematics', depth: 0 },
  { id: 6, name: 'Science', depth: 0 },
  { id: 7, name: 'Physics', depth: 1 },
  { id: 8, name: 'Chemistry', depth: 1 },
];

// ============================================================================
// TAB PANEL COMPONENT
// ============================================================================

/**
 * Props for TabPanel component
 */
interface TabPanelProps {
  children?: React.ReactNode;
  value: TabValue;
  activeValue: TabValue;
}

/**
 * TabPanel component for managing tab content visibility
 *
 * Renders children only when the panel is active, improving performance
 * by not rendering hidden tab content.
 */
function TabPanel({ children, value, activeValue }: TabPanelProps): React.ReactElement | null {
  return (
    <Box
      role="tabpanel"
      hidden={value !== activeValue}
      id={`course-tabpanel-${value}`}
      aria-labelledby={`course-tab-${value}`}
      sx={{ py: 3 }}
    >
      {value === activeValue && children}
    </Box>
  );
}

/**
 * Generate accessibility props for tabs
 */
function a11yProps(index: TabValue): Record<string, string> {
  return {
    id: `course-tab-${index}`,
    'aria-controls': `course-tabpanel-${index}`,
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * CourseEditForm Component
 *
 * A comprehensive multi-tab form for creating and editing Moodle courses.
 * Provides real-time validation, rich text editing, file uploads, and
 * accessibility features.
 *
 * @param props - Component props
 * @returns React element rendering the course edit form
 */
const CourseEditForm: React.FC<CourseEditFormProps> = ({
  courseId,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  // ============================================================================
  // STATE
  // ============================================================================

  /** Current active tab in the form */
  const [activeTab, setActiveTab] = useState<TabValue>('general');

  /** API error message to display */
  const [apiError, setApiError] = useState<string | null>(null);

  /** Whether form has unsaved changes */
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  /** Categories fetched from API */
  const [categories] = useState<CategoryOption[]>(MOCK_CATEGORIES);

  // ============================================================================
  // HOOKS
  // ============================================================================

  /**
   * Fetch existing course data when editing
   * Only enabled when courseId is provided
   */
  const {
    data: existingCourse,
    isLoading: isCourseLoading,
    isError: isCourseError,
    error: courseError,
  } = useCourse(courseId ?? 0, {
    enabled: !!courseId && courseId > 0,
  });

  /**
   * Initialize react-hook-form with zod validation
   */
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isValid, isSubmitting },
  } = useForm<CourseFormSchema>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: defaultFormValues,
    mode: 'onBlur',
  });

  // Watch form values for unsaved changes detection
  const watchedValues = watch();

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Load existing course data into form when available
   */
  useEffect(() => {
    if (existingCourse) {
      const formData: CourseFormSchema = {
        fullname: existingCourse.fullname || '',
        shortname: existingCourse.shortname || '',
        category: existingCourse.category || 0,
        summary: existingCourse.summary || '',
        description: existingCourse.summary || '', // Moodle uses summary for main description
        format: (existingCourse.format as CourseFormatType) || 'topics',
        startDate: existingCourse.startdate ? new Date(existingCourse.startdate * 1000) : null,
        endDate: existingCourse.enddate ? new Date(existingCourse.enddate * 1000) : null,
        visible: existingCourse.visible === 1,
        imageUrl: '',
        enrollmentKey: '',
        maxEnrollment: 0,
        selfEnrollmentEnabled: false,
        completionEnabled: existingCourse.enablecompletion === 1,
        language: existingCourse.lang || '',
      };
      reset(formData);
    }
  }, [existingCourse, reset]);

  /**
   * Track unsaved changes for navigation warning
   */
  useEffect(() => {
    setHasUnsavedChanges(isDirty);
  }, [isDirty]);

  /**
   * Setup beforeunload event listener for unsaved changes warning
   */
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent): string | undefined => {
      if (hasUnsavedChanges) {
        const message = 'You have unsaved changes. Are you sure you want to leave?';
        event.preventDefault();
        event.returnValue = message;
        return message;
      }
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  /**
   * Handle tab change
   */
  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent, newValue: TabValue): void => {
      setActiveTab(newValue);
    },
    []
  );

  /**
   * Handle form submission
   * Transforms form data to CourseFormData format expected by API
   */
  const handleFormSubmit: SubmitHandler<CourseFormSchema> = useCallback(
    (data) => {
      setApiError(null);

      try {
        // Transform form data to API format
        const courseData: CourseFormData = {
          fullname: data.fullname,
          shortname: data.shortname,
          category: data.category,
          summary: data.summary || '',
          startdate: data.startDate ? Math.floor(data.startDate.getTime() / 1000) : 0,
          enddate: data.endDate ? Math.floor(data.endDate.getTime() / 1000) : 0,
          format: data.format,
          language: data.language || undefined,
          visible: data.visible,
          image: undefined, // File uploads handled separately
        };

        onSubmit(courseData);
        setHasUnsavedChanges(false);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'An unexpected error occurred';
        setApiError(errorMessage);
      }
    },
    [onSubmit]
  );

  /**
   * Handle form validation errors
   * Navigates to the tab containing the first error
   */
  const handleValidationErrors = useCallback((formErrors: FieldErrors<CourseFormSchema>): void => {
    // Map error fields to their tabs
    const fieldToTab: Record<keyof CourseFormSchema, TabValue> = {
      fullname: 'general',
      shortname: 'general',
      category: 'general',
      summary: 'general',
      imageUrl: 'general',
      description: 'description',
      format: 'settings',
      startDate: 'settings',
      endDate: 'settings',
      visible: 'settings',
      language: 'settings',
      enrollmentKey: 'enrollment',
      maxEnrollment: 'enrollment',
      selfEnrollmentEnabled: 'enrollment',
      completionEnabled: 'completion',
    };

    // Find the first error and navigate to its tab
    const firstErrorField = Object.keys(formErrors)[0] as keyof CourseFormSchema | undefined;
    if (firstErrorField && fieldToTab[firstErrorField]) {
      setActiveTab(fieldToTab[firstErrorField]);
    }
  }, []);

  /**
   * Handle cancel button click
   */
  const handleCancel = useCallback((): void => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to cancel?'
      );
      if (!confirmed) {
        return;
      }
    }
    onCancel();
  }, [hasUnsavedChanges, onCancel]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * Render loading state while fetching course data
   */
  if (courseId && isCourseLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={400}
        data-testid="course-edit-form-loading"
      >
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading course data...
        </Typography>
      </Box>
    );
  }

  /**
   * Render error state if course fetch failed
   */
  if (courseId && isCourseError) {
    return (
      <Alert severity="error" data-testid="course-edit-form-error">
        {courseError?.message || 'Failed to load course data. Please try again.'}
      </Alert>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Paper
        elevation={0}
        sx={{ p: 3 }}
        component="form"
        onSubmit={handleSubmit(handleFormSubmit, handleValidationErrors)}
        data-testid="course-edit-form"
        noValidate
      >
        {/* Form Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            {courseId ? 'Edit Course' : 'Create New Course'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {courseId
              ? 'Update the course settings below.'
              : 'Fill in the details below to create a new course.'}
          </Typography>
        </Box>

        {/* API Error Alert */}
        {apiError && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setApiError(null)}>
            {apiError}
          </Alert>
        )}

        {/* Tab Navigation */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="Course settings tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="General" value="general" {...a11yProps('general')} />
            <Tab label="Description" value="description" {...a11yProps('description')} />
            <Tab label="Settings" value="settings" {...a11yProps('settings')} />
            <Tab label="Enrollment" value="enrollment" {...a11yProps('enrollment')} />
            <Tab label="Completion" value="completion" {...a11yProps('completion')} />
          </Tabs>
        </Box>

        {/* General Tab */}
        <TabPanel value="general" activeValue={activeTab}>
          <Grid container spacing={3}>
            {/* Full Name */}
            <Grid item xs={12}>
              <Controller
                name="fullname"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Course Full Name"
                    placeholder="e.g., Introduction to Computer Science"
                    required
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message || 'The full name of the course'}
                    inputProps={{
                      maxLength: 254,
                      'aria-required': true,
                      'data-testid': 'course-fullname-input',
                    }}
                  />
                )}
              />
            </Grid>

            {/* Short Name */}
            <Grid item xs={12} md={6}>
              <Controller
                name="shortname"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Course Short Name"
                    placeholder="e.g., CS101"
                    required
                    fullWidth
                    error={!!fieldState.error}
                    helperText={
                      fieldState.error?.message ||
                      'A short code used in navigation and reports'
                    }
                    inputProps={{
                      maxLength: 100,
                      'aria-required': true,
                      'data-testid': 'course-shortname-input',
                    }}
                  />
                )}
              />
            </Grid>

            {/* Category */}
            <Grid item xs={12} md={6}>
              <Controller
                name="category"
                control={control}
                render={({ field, fieldState }) => (
                  <FormControl fullWidth error={!!fieldState.error} required>
                    <InputLabel id="course-category-label">Course Category</InputLabel>
                    <Select
                      {...field}
                      labelId="course-category-label"
                      label="Course Category"
                      data-testid="course-category-select"
                    >
                      <MenuItem value={0} disabled>
                        Select a category
                      </MenuItem>
                      {categories.map((cat) => (
                        <MenuItem
                          key={cat.id}
                          value={cat.id}
                          sx={{ pl: cat.depth ? cat.depth * 2 + 2 : 2 }}
                        >
                          {cat.depth ? '— ' : ''}
                          {cat.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {fieldState.error && (
                      <FormHelperText>{fieldState.error.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />
            </Grid>

            {/* Summary */}
            <Grid item xs={12}>
              <Controller
                name="summary"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Course Summary"
                    placeholder="Brief description of the course (max 500 characters)"
                    multiline
                    rows={3}
                    fullWidth
                    error={!!fieldState.error}
                    helperText={
                      fieldState.error?.message ||
                      `${field.value?.length || 0}/500 characters - This appears in course listings`
                    }
                    inputProps={{
                      maxLength: 500,
                      'data-testid': 'course-summary-input',
                    }}
                  />
                )}
              />
            </Grid>

            {/* Course Image Upload */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Course Image
              </Typography>
              <FormFileUpload
                name="courseImage"
                label="Upload Course Image"
                control={control}
                accept="image/jpeg,image/png,image/gif,image/webp"
                maxSize={5 * 1024 * 1024}
                helperText="Recommended size: 800x400 pixels. Supported formats: JPEG, PNG, GIF, WebP (max 5MB)"
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Description Tab */}
        <TabPanel value="description" activeValue={activeTab}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Course Description
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Provide a detailed description of the course content, objectives, and
                requirements.
              </Typography>
              <Controller
                name="description"
                control={control}
                render={({ field, fieldState }) => (
                  <RichTextEditor
                    name="description"
                    label="Full Course Description"
                    value={field.value}
                    onChange={field.onChange}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    height={400}
                    placeholder="Enter detailed course description, learning objectives, prerequisites, and other important information..."
                  />
                )}
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Settings Tab */}
        <TabPanel value="settings" activeValue={activeTab}>
          <Grid container spacing={3}>
            {/* Course Format */}
            <Grid item xs={12} md={6}>
              <Controller
                name="format"
                control={control}
                render={({ field, fieldState }) => (
                  <FormControl fullWidth error={!!fieldState.error} required>
                    <InputLabel id="course-format-label">Course Format</InputLabel>
                    <Select
                      {...field}
                      labelId="course-format-label"
                      label="Course Format"
                      data-testid="course-format-select"
                    >
                      {COURSE_FORMATS.map((format) => (
                        <MenuItem key={format.value} value={format.value}>
                          <Box>
                            <Typography variant="body1">{format.label}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {format.description}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                    {fieldState.error && (
                      <FormHelperText>{fieldState.error.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />
            </Grid>

            {/* Language */}
            <Grid item xs={12} md={6}>
              <Controller
                name="language"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel id="course-language-label">Force Language</InputLabel>
                    <Select
                      {...field}
                      labelId="course-language-label"
                      label="Force Language"
                      data-testid="course-language-select"
                    >
                      <MenuItem value="">Do not force</MenuItem>
                      <MenuItem value="en">English</MenuItem>
                      <MenuItem value="es">Spanish</MenuItem>
                      <MenuItem value="fr">French</MenuItem>
                      <MenuItem value="de">German</MenuItem>
                      <MenuItem value="pt">Portuguese</MenuItem>
                      <MenuItem value="zh">Chinese</MenuItem>
                      <MenuItem value="ja">Japanese</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            {/* Start Date */}
            <Grid item xs={12} md={6}>
              <Controller
                name="startDate"
                control={control}
                render={({ field, fieldState }) => (
                  <DatePicker
                    label="Course Start Date"
                    value={field.value}
                    onChange={(date) => field.onChange(date)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: !!fieldState.error,
                        helperText:
                          fieldState.error?.message || 'When the course becomes available',
                        'data-testid': 'course-startdate-picker',
                      },
                    }}
                  />
                )}
              />
            </Grid>

            {/* End Date */}
            <Grid item xs={12} md={6}>
              <Controller
                name="endDate"
                control={control}
                render={({ field, fieldState }) => (
                  <DatePicker
                    label="Course End Date"
                    value={field.value}
                    onChange={(date) => field.onChange(date)}
                    minDate={watchedValues.startDate || undefined}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: !!fieldState.error,
                        helperText:
                          fieldState.error?.message ||
                          'When the course ends (optional)',
                        'data-testid': 'course-enddate-picker',
                      },
                    }}
                  />
                )}
              />
            </Grid>

            {/* Visibility */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Controller
                name="visible"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        data-testid="course-visible-switch"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1">Course Visibility</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {field.value
                            ? 'Course is visible to students'
                            : 'Course is hidden from students'}
                        </Typography>
                      </Box>
                    }
                  />
                )}
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Enrollment Tab */}
        <TabPanel value="enrollment" activeValue={activeTab}>
          <Grid container spacing={3}>
            {/* Self Enrollment */}
            <Grid item xs={12}>
              <Controller
                name="selfEnrollmentEnabled"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        data-testid="course-selfenroll-switch"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1">Enable Self-Enrollment</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Allow students to enroll themselves in this course
                        </Typography>
                      </Box>
                    }
                  />
                )}
              />
            </Grid>

            {/* Enrollment Key */}
            <Grid item xs={12} md={6}>
              <Controller
                name="enrollmentKey"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Enrollment Key"
                    placeholder="Enter enrollment password"
                    type="password"
                    fullWidth
                    disabled={!watchedValues.selfEnrollmentEnabled}
                    error={!!fieldState.error}
                    helperText={
                      fieldState.error?.message ||
                      'Students must provide this key to self-enroll'
                    }
                    inputProps={{
                      'data-testid': 'course-enrollment-key-input',
                    }}
                  />
                )}
              />
            </Grid>

            {/* Max Enrollment */}
            <Grid item xs={12} md={6}>
              <Controller
                name="maxEnrollment"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                    label="Maximum Enrollment"
                    type="number"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={
                      fieldState.error?.message || '0 for unlimited enrollment'
                    }
                    inputProps={{
                      min: 0,
                      'data-testid': 'course-max-enrollment-input',
                    }}
                  />
                )}
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Completion Tab */}
        <TabPanel value="completion" activeValue={activeTab}>
          <Grid container spacing={3}>
            {/* Enable Completion Tracking */}
            <Grid item xs={12}>
              <Controller
                name="completionEnabled"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        data-testid="course-completion-switch"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1">
                          Enable Completion Tracking
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Track and display completion status for activities in this
                          course
                        </Typography>
                      </Box>
                    }
                  />
                )}
              />
            </Grid>

            {/* Completion Tracking Info */}
            {watchedValues.completionEnabled && (
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    When completion tracking is enabled, you can set completion
                    conditions for individual activities. Students will see their
                    progress on the course page.
                  </Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        </TabPanel>

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
            onClick={handleCancel}
            disabled={isLoading || isSubmitting}
            data-testid="course-cancel-button"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={isLoading || isSubmitting}
            startIcon={
              (isLoading || isSubmitting) && <CircularProgress size={20} color="inherit" />
            }
            data-testid="course-submit-button"
          >
            {isLoading || isSubmitting
              ? 'Saving...'
              : courseId
                ? 'Update Course'
                : 'Create Course'}
          </Button>
        </Box>

        {/* Unsaved Changes Indicator */}
        {hasUnsavedChanges && (
          <Typography
            variant="caption"
            color="warning.main"
            sx={{ display: 'block', mt: 1, textAlign: 'right' }}
          >
            You have unsaved changes
          </Typography>
        )}
      </Paper>
    </LocalizationProvider>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default CourseEditForm;
