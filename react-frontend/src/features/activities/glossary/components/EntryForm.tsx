/**
 * EntryForm Component
 *
 * React component for creating and editing glossary entries with comprehensive
 * form validation and Material-UI styling. Implements React Hook Form with
 * Zod validation for type-safe form handling.
 *
 * Features:
 * - Create and edit modes for glossary entries
 * - Rich text editor for definition content
 * - Multi-select for category assignment
 * - File attachments with drag-and-drop upload
 * - Optional linking settings (dynamic linking, case sensitivity, full match)
 * - Form validation with meaningful error messages
 * - Permission checking before form display
 * - Success/error notifications via toast
 *
 * Based on Moodle's glossary edit form:
 * - public/mod/glossary/edit.php (permission checks)
 * - public/mod/glossary/edit_form.php (form structure)
 *
 * @module features/activities/glossary/components/EntryForm
 */

import React, { useEffect, useMemo } from 'react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Typography,
  FormControlLabel,
  Checkbox,
  Paper,
  Alert,
  Stack,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

// Internal component imports
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { FormFileUpload } from '@/components/forms/FormFileUpload';
import { FormInput } from '@/components/forms/FormInput';
import { FormTextarea } from '@/components/forms/FormTextarea';
import { FormSelect } from '@/components/forms/FormSelect';

// Hook imports
import { useCreateEntry, useUpdateEntry } from '@/features/activities/glossary/hooks/useEntry';
import { useCategories } from '@/features/activities/glossary/hooks/useCategories';
import { useGlossary } from '@/features/activities/glossary/hooks/useGlossary';
import { useToast } from '@/hooks/useToast';
import { usePermissions } from '@/features/auth/hooks/usePermissions';

// Type imports
import type {
  Glossary,
  GlossaryEntry,
  CreateEntryInput,
  UpdateEntryInput,
  GlossaryCategory,
} from '@/features/activities/glossary/types/glossary.types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Reserved characters that cannot be used as single-character aliases
 * Based on Moodle's edit_form.php validation logic
 */
const RESERVED_ALIAS_CHARACTERS = [
  '!', '@', '#', '$', '%', '^', '&', '*', '(', ')',
  '-', '_', '+', '=', '[', ']', '{', '}', '|', '\\',
  '/', '?', '<', '>', ',', '.', '`', '~',
];

/**
 * Maximum character lengths for form fields
 * Based on Moodle's PARAM_TEXT validation
 */
const FIELD_LIMITS = {
  concept: 255,
  aliases: 1000,
} as const;

/**
 * Default text format for definition content
 */
const TEXT_FORMAT_HTML = 1;

// ============================================================================
// Zod Schema for Form Validation
// ============================================================================

/**
 * Validation schema for glossary entry form
 *
 * Implements validation rules based on Moodle's edit_form.php:
 * - concept: required, 1-255 characters
 * - definition: required, minimum content
 * - categories: optional array of category IDs
 * - aliases: optional string with character validation
 * - attachments: optional file array
 * - linking options: optional booleans
 */
const entryFormSchema = z.object({
  // Required concept field with length constraints
  concept: z
    .string()
    .min(1, 'Concept is required')
    .max(FIELD_LIMITS.concept, `Concept must be ${FIELD_LIMITS.concept} characters or less`)
    .refine(
      (val) => val.trim().length > 0,
      'Concept cannot be only whitespace'
    ),

  // Required definition field with HTML content
  definition: z
    .string()
    .min(1, 'Definition is required')
    .refine(
      (val) => {
        // Strip HTML tags to check for actual content
        const textContent = val.replace(/<[^>]*>/g, '').trim();
        return textContent.length > 0;
      },
      'Definition must contain some text content'
    ),

  // Definition format (HTML=1, plain=0, etc.)
  definitionformat: z.number().default(TEXT_FORMAT_HTML),

  // Optional category IDs for multi-select
  categories: z.array(z.number()).optional().default([]),

  // Optional aliases/keywords with validation
  aliases: z
    .string()
    .max(FIELD_LIMITS.aliases, `Aliases must be ${FIELD_LIMITS.aliases} characters or less`)
    .optional()
    .default('')
    .refine(
      (val) => {
        if (!val || val.trim() === '') return true;
        // Check each alias for reserved characters
        const aliasLines = val.split('\n').map((line) => line.trim()).filter(Boolean);
        return !aliasLines.some(
          (alias) => alias.length === 1 && RESERVED_ALIAS_CHARACTERS.includes(alias)
        );
      },
      'Aliases cannot be single reserved characters'
    ),

  // Optional file attachments
  attachments: z.array(z.instanceof(File)).optional().default([]),

  // Linking options (conditional based on glossary settings)
  usedynalink: z.boolean().optional().default(false),
  casesensitive: z.boolean().optional().default(false),
  fullmatch: z.boolean().optional().default(false),
});

/**
 * TypeScript type inferred from Zod schema
 */
type EntryFormData = z.infer<typeof entryFormSchema>;

// ============================================================================
// Component Props Interface
// ============================================================================

/**
 * Props for EntryForm component
 */
export interface EntryFormProps {
  /**
   * Form mode - 'create' for new entries, 'edit' for updating existing entries
   */
  mode: 'create' | 'edit';

  /**
   * ID of the glossary this entry belongs to
   */
  glossaryId: number;

  /**
   * ID of the entry being edited (required for edit mode)
   */
  entryId?: number;

  /**
   * Initial data for populating the form (used in edit mode)
   */
  initialData?: Partial<GlossaryEntry>;

  /**
   * Optional callback triggered on successful form submission
   */
  onSuccess?: (entry: GlossaryEntry) => void;

  /**
   * Optional callback triggered on form cancellation
   */
  onCancel?: () => void;
}

// ============================================================================
// EntryForm Component
// ============================================================================

/**
 * EntryForm Component
 *
 * Renders a form for creating or editing glossary entries with full validation,
 * file upload support, and Material-UI styling.
 *
 * @param props - Component props
 * @returns React component or null if user lacks permission
 *
 * @example
 * ```tsx
 * // Create mode
 * <EntryForm
 *   mode="create"
 *   glossaryId={123}
 *   onSuccess={(entry) => navigate(`/glossary/${entry.glossaryid}/entry/${entry.id}`)}
 * />
 *
 * // Edit mode
 * <EntryForm
 *   mode="edit"
 *   glossaryId={123}
 *   entryId={456}
 *   initialData={existingEntry}
 * />
 * ```
 */
export function EntryForm({
  mode,
  glossaryId,
  entryId,
  initialData,
  onSuccess,
  onCancel,
}: EntryFormProps): React.ReactElement | null {
  // ============================================================================
  // Hooks
  // ============================================================================

  const navigate = useNavigate();
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const { hasCapability } = usePermissions();

  // Fetch glossary configuration for linking options visibility
  const {
    data: glossary,
    isLoading: isGlossaryLoading,
    error: glossaryError,
  } = useGlossary(glossaryId, { enabled: glossaryId > 0 });

  // Fetch categories for the multi-select dropdown
  const {
    data: categoriesData,
    isLoading: isCategoriesLoading,
  } = useCategories(glossaryId, { enabled: glossaryId > 0 });

  // Mutations for create and update operations
  const createMutation = useCreateEntry(glossaryId, {
    onSuccess: (entry) => {
      showSuccessToast('Entry created successfully!');
      onSuccess?.(entry);
      navigate(`/glossary/${glossaryId}/entry/${entry.id}`);
    },
    onError: (error) => {
      showErrorToast(`Failed to create entry: ${error.message}`);
    },
  });

  const updateMutation = useUpdateEntry(glossaryId, {
    onSuccess: (entry) => {
      showSuccessToast('Entry updated successfully!');
      onSuccess?.(entry);
      navigate(`/glossary/${glossaryId}/entry/${entry.id}`);
    },
    onError: (error) => {
      showErrorToast(`Failed to update entry: ${error.message}`);
    },
  });

  // Form setup with React Hook Form and Zod validation
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EntryFormData>({
    resolver: zodResolver(entryFormSchema),
    defaultValues: {
      concept: '',
      definition: '',
      definitionformat: TEXT_FORMAT_HTML,
      categories: [],
      aliases: '',
      attachments: [],
      usedynalink: false,
      casesensitive: false,
      fullmatch: false,
    },
  });

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Populate form with initial data when in edit mode
   */
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      reset({
        concept: initialData.concept || '',
        definition: initialData.definition || '',
        definitionformat: initialData.definitionformat ?? TEXT_FORMAT_HTML,
        categories: initialData.categories?.map((c) => c.id) || [],
        aliases: initialData.aliases || '',
        attachments: [],
        usedynalink: initialData.usedynalink ?? false,
        casesensitive: initialData.casesensitive ?? false,
        fullmatch: initialData.fullmatch ?? false,
      });
    }
  }, [mode, initialData, reset]);

  // ============================================================================
  // Permission Checking
  // ============================================================================

  /**
   * Check if user has permission to create/edit glossary entries
   * - Create mode: requires 'mod/glossary:write' capability
   * - Edit mode: requires ability to update the specific entry
   */
  const hasWritePermission = useMemo(() => {
    return hasCapability('mod/glossary:write', {
      type: 'module',
      contextId: glossaryId,
    });
  }, [hasCapability, glossaryId]);

  // ============================================================================
  // Derived State
  // ============================================================================

  /**
   * Whether the form is currently loading initial data
   */
  const isInitialLoading = isGlossaryLoading || isCategoriesLoading;

  /**
   * Whether the form is currently submitting
   */
  const isMutating = createMutation.isPending || updateMutation.isPending;

  /**
   * Whether to show linking options based on glossary configuration
   */
  const showLinkingOptions = glossary?.usedynalink ?? false;

  /**
   * Format categories for the select dropdown
   */
  const categoryOptions = useMemo(() => {
    const categories = categoriesData?.categories || [];
    return [
      { value: 0, label: 'Not Categorized' },
      ...categories.map((cat: GlossaryCategory) => ({
        value: cat.id,
        label: cat.name,
      })),
    ];
  }, [categoriesData]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle form submission
   * Transforms form data to API input format and triggers appropriate mutation
   */
  const onSubmit: SubmitHandler<EntryFormData> = async (data) => {
    try {
      if (mode === 'create') {
        // Prepare create input
        const createInput: CreateEntryInput = {
          glossaryId,
          concept: data.concept.trim(),
          definition: data.definition,
          definitionformat: data.definitionformat,
          usedynalink: data.usedynalink,
          casesensitive: data.casesensitive,
          fullmatch: data.fullmatch,
          categoryId: data.categories?.[0], // Primary category
          aliases: data.aliases,
          attachments: data.attachments,
        };
        await createMutation.mutateAsync(createInput);
      } else if (mode === 'edit' && entryId) {
        // Prepare update input
        const updateInput: UpdateEntryInput = {
          id: entryId,
          concept: data.concept.trim(),
          definition: data.definition,
          definitionformat: data.definitionformat,
          usedynalink: data.usedynalink,
          casesensitive: data.casesensitive,
          fullmatch: data.fullmatch,
          categoryId: data.categories?.[0], // Primary category
          aliases: data.aliases,
          attachments: data.attachments,
        };
        await updateMutation.mutateAsync(updateInput);
      }
    } catch (error) {
      // Error handling is done in mutation callbacks
      console.error('Form submission error:', error);
    }
  };

  /**
   * Handle form cancellation
   * Navigates back to glossary view or calls custom handler
   */
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(`/glossary/${glossaryId}`);
    }
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  /**
   * Render loading state while fetching initial data
   */
  if (isInitialLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={200}
        role="status"
        aria-label="Loading form..."
      >
        <CircularProgress size={40} />
      </Box>
    );
  }

  /**
   * Render error state if glossary fetch failed
   */
  if (glossaryError) {
    return (
      <Alert severity="error" role="alert">
        Failed to load glossary information. Please try again later.
      </Alert>
    );
  }

  /**
   * Render permission denied message if user lacks write access
   */
  if (!hasWritePermission) {
    return (
      <Alert severity="warning" role="alert">
        You do not have permission to {mode === 'create' ? 'create' : 'edit'} glossary entries.
      </Alert>
    );
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Paper
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{ p: 3 }}
      elevation={1}
      role="form"
      aria-label={mode === 'create' ? 'Create glossary entry form' : 'Edit glossary entry form'}
    >
      {/* Form Header */}
      <Typography variant="h5" component="h2" gutterBottom>
        {mode === 'create' ? 'Add New Entry' : 'Edit Entry'}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {mode === 'create'
          ? 'Create a new glossary entry with a concept and its definition.'
          : 'Update the glossary entry details below.'}
      </Typography>

      <Divider sx={{ my: 2 }} />

      {/* Mutation Error Alert */}
      {(createMutation.isError || updateMutation.isError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {createMutation.error?.message || updateMutation.error?.message}
        </Alert>
      )}

      <Stack spacing={3}>
        {/* Concept Field - Required text input */}
        <FormInput
          name="concept"
          control={control}
          label="Concept"
          placeholder="Enter the term or concept"
          required
          fullWidth
          maxLength={FIELD_LIMITS.concept}
          helperText={errors.concept?.message || 'The term or phrase being defined'}
          error={!!errors.concept}
          disabled={isMutating}
          aria-describedby="concept-helper"
        />

        {/* Definition Field - Rich text editor */}
        <Box>
          <Typography
            component="label"
            variant="subtitle2"
            sx={{ display: 'block', mb: 1 }}
          >
            Definition <span style={{ color: 'error.main' }}>*</span>
          </Typography>
          <Controller
            name="definition"
            control={control}
            render={({ field }) => (
              <RichTextEditor
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Enter the definition..."
                minHeight={200}
                disabled={isMutating}
                error={!!errors.definition}
                helperText={errors.definition?.message}
                aria-label="Definition editor"
              />
            )}
          />
          {errors.definition && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
              {errors.definition.message}
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 1 }} />

        {/* Categories Field - Multi-select dropdown */}
        <FormSelect
          name="categories"
          control={control}
          label="Categories"
          options={categoryOptions}
          multiple
          fullWidth
          disabled={isMutating}
          helperText="Select one or more categories for this entry"
          aria-describedby="categories-helper"
        />

        {/* Aliases Field - Multiline textarea */}
        <FormTextarea
          name="aliases"
          control={control}
          label="Aliases (Keywords)"
          placeholder="Enter alternative names or keywords, one per line"
          rows={3}
          fullWidth
          maxLength={FIELD_LIMITS.aliases}
          helperText={
            errors.aliases?.message ||
            'Alternative terms that will also link to this entry (one per line)'
          }
          error={!!errors.aliases}
          disabled={isMutating}
          aria-describedby="aliases-helper"
        />

        {/* File Attachments */}
        <Box>
          <Typography
            component="label"
            variant="subtitle2"
            sx={{ display: 'block', mb: 1 }}
          >
            Attachments
          </Typography>
          <Controller
            name="attachments"
            control={control}
            render={({ field }) => (
              <FormFileUpload
                value={field.value || []}
                onChange={field.onChange}
                multiple
                accept="image/*,application/pdf,.doc,.docx,.txt"
                maxSize={10 * 1024 * 1024} // 10MB
                maxFiles={5}
                disabled={isMutating}
                helperText="Drag and drop files here, or click to browse (max 5 files, 10MB each)"
                aria-label="File attachments"
              />
            )}
          />
        </Box>

        {/* Linking Options Section - Conditional based on glossary settings */}
        {showLinkingOptions && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Auto-Linking Options
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Configure how this entry is automatically linked in course content.
              </Typography>

              <Stack spacing={1}>
                {/* Use Dynamic Linking */}
                <Controller
                  name="usedynalink"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          disabled={isMutating}
                          aria-describedby="usedynalink-description"
                        />
                      }
                      label="Enable auto-linking"
                    />
                  )}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  id="usedynalink-description"
                  sx={{ pl: 4, mt: -1 }}
                >
                  When enabled, this concept will be automatically linked whenever it appears in course content.
                </Typography>

                {/* Case Sensitive */}
                <Controller
                  name="casesensitive"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          disabled={isMutating}
                          aria-describedby="casesensitive-description"
                        />
                      }
                      label="Case sensitive matching"
                    />
                  )}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  id="casesensitive-description"
                  sx={{ pl: 4, mt: -1 }}
                >
                  Only match this entry when the case matches exactly (e.g., "HTML" won't match "html").
                </Typography>

                {/* Full Match */}
                <Controller
                  name="fullmatch"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          disabled={isMutating}
                          aria-describedby="fullmatch-description"
                        />
                      }
                      label="Match whole words only"
                    />
                  )}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  id="fullmatch-description"
                  sx={{ pl: 4, mt: -1 }}
                >
                  Only match complete words (e.g., "cat" won't match "catalog").
                </Typography>
              </Stack>
            </Box>
          </>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Form Actions */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            type="button"
            variant="outlined"
            color="inherit"
            onClick={handleCancel}
            disabled={isMutating}
            startIcon={<CancelIcon />}
            aria-label="Cancel and go back"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={isMutating || !isDirty}
            startIcon={
              isMutating ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <SaveIcon />
              )
            }
            aria-label={mode === 'create' ? 'Create entry' : 'Save changes'}
          >
            {isMutating
              ? 'Saving...'
              : mode === 'create'
              ? 'Create Entry'
              : 'Save Changes'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

// Default export for convenience
export default EntryForm;
