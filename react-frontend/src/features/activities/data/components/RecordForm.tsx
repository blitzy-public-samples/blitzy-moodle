/**
 * RecordForm Component
 *
 * A dynamic form component for creating and editing database activity records.
 * Generates form fields based on database field definitions, with appropriate
 * input components for each field type and comprehensive validation.
 *
 * Features:
 * - Dynamic field generation based on database configuration
 * - Field-type-specific input components (text, textarea, date, select, file, etc.)
 * - React Hook Form integration with Zod schema validation
 * - File upload support with drag-and-drop
 * - Edit mode with pre-populated values
 * - Optimistic updates via React Query mutations
 * - Comprehensive error handling and user feedback
 *
 * Based on Moodle's PHP implementation:
 * - public/mod/data/edit.php
 * - public/mod/data/locallib.php
 *
 * @module features/activities/data/components/RecordForm
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, Controller, type FieldValues, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
  TextField,
  Checkbox,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Stack,
  Grid,
  Paper,
  Divider,
  FormHelperText,
} from '@mui/material';
import { Save, Cancel, CloudUpload } from '@mui/icons-material';

// Internal imports from dependencies
import { useDatabase } from '@/features/activities/data/hooks/useDatabase';
import { useCreateRecord, useUpdateRecord } from '@/features/activities/data/hooks/useDatabaseMutation';
import { useRecord } from '@/features/activities/data/hooks/useRecord';
import { useToast } from '@/hooks/useToast';
import type {
  DatabaseField,
  FieldContent,
  FieldType,
} from '@/features/activities/data/types/data.types';
import { FormInput } from '@/components/forms/FormInput';
import { FormTextarea } from '@/components/forms/FormTextarea';
import { FormSelect } from '@/components/forms/FormSelect';
import { FormDatePicker } from '@/components/forms/FormDatePicker';
import { FormFileUpload } from '@/components/forms/FormFileUpload';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Props for the RecordForm component
 */
export interface RecordFormProps {
  /** The database activity instance ID */
  databaseId: number;
  /** Optional record ID for edit mode. If provided, form will be in edit mode */
  recordId?: number;
  /** Optional group ID for the record */
  groupId?: number;
  /** Callback invoked after successful save */
  onSuccess?: (recordId: number) => void;
  /** Callback invoked when user cancels */
  onCancel?: () => void;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Form field value type for different field types
 */
type FieldValue =
  | string
  | number
  | boolean
  | Date
  | File[]
  | string[]
  | { lat: number; lng: number }
  | null;

/**
 * Form data structure mapping field IDs to values
 */
interface FormData {
  [fieldId: string]: FieldValue;
}

/**
 * File upload state for tracking uploaded files per field
 */
interface FileUploadState {
  [fieldId: string]: File[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Maps FieldType enum values to string identifiers for switch statements
 */
const getFieldTypeString = (type: FieldType): string => {
  // Handle both enum values and string values
  const typeMap: Record<string, string> = {
    '0': 'text',
    '1': 'textarea',
    '2': 'number',
    '3': 'date',
    '4': 'checkbox',
    '5': 'menu',
    '6': 'multimenu',
    '7': 'radiobutton',
    '8': 'file',
    '9': 'picture',
    '10': 'url',
    '11': 'latlong',
    text: 'text',
    textarea: 'textarea',
    number: 'number',
    date: 'date',
    checkbox: 'checkbox',
    menu: 'menu',
    multimenu: 'multimenu',
    radiobutton: 'radiobutton',
    file: 'file',
    picture: 'picture',
    url: 'url',
    latlong: 'latlong',
    Text: 'text',
    Textarea: 'textarea',
    Number: 'number',
    Date: 'date',
    Checkbox: 'checkbox',
    Menu: 'menu',
    MultiMenu: 'multimenu',
    RadioButton: 'radiobutton',
    File: 'file',
    Picture: 'picture',
    URL: 'url',
    LatLong: 'latlong',
  };

  return typeMap[String(type)] || 'text';
};

/**
 * Parses options string (newline-separated) into select options array
 */
const parseFieldOptions = (
  options: string | undefined
): Array<{ value: string; label: string }> => {
  if (!options) return [];

  return options
    .split('\n')
    .map((opt) => opt.trim())
    .filter((opt) => opt.length > 0)
    .map((opt) => ({ value: opt, label: opt }));
};

/**
 * Creates a Zod validation schema for a single field based on its type and configuration
 */
const createFieldSchema = (field: DatabaseField): z.ZodTypeAny => {
  const fieldType = getFieldTypeString(field.type);
  const isRequired = field.required ?? false;

  switch (fieldType) {
    case 'text': {
      let schema = z.string();
      if (isRequired) {
        schema = schema.min(1, `${field.name} is required`);
      }
      // Check for maxlength in field params
      const textField = field as DatabaseField & { param1?: string; maxLength?: number };
      const maxLength = textField.maxLength ?? (textField.param1 ? parseInt(textField.param1, 10) : undefined);
      if (maxLength && maxLength > 0) {
        schema = schema.max(maxLength, `${field.name} must be at most ${maxLength} characters`);
      }
      return isRequired ? schema : schema.optional().or(z.literal(''));
    }

    case 'textarea': {
      let schema = z.string();
      if (isRequired) {
        schema = schema.min(1, `${field.name} is required`);
      }
      const textareaField = field as DatabaseField & { param1?: string; maxLength?: number };
      const maxLen = textareaField.maxLength ?? (textareaField.param1 ? parseInt(textareaField.param1, 10) : undefined);
      if (maxLen && maxLen > 0) {
        schema = schema.max(maxLen, `${field.name} must be at most ${maxLen} characters`);
      }
      return isRequired ? schema : schema.optional().or(z.literal(''));
    }

    case 'number': {
      const numberField = field as DatabaseField & {
        param1?: string;
        param2?: string;
        min?: number;
        max?: number;
      };
      let schema = z.coerce.number();
      const minVal = numberField.min ?? (numberField.param1 ? parseFloat(numberField.param1) : undefined);
      const maxVal = numberField.max ?? (numberField.param2 ? parseFloat(numberField.param2) : undefined);

      if (minVal !== undefined && !isNaN(minVal)) {
        schema = schema.min(minVal, `${field.name} must be at least ${minVal}`);
      }
      if (maxVal !== undefined && !isNaN(maxVal)) {
        schema = schema.max(maxVal, `${field.name} must be at most ${maxVal}`);
      }
      if (isRequired) {
        return schema;
      }
      return schema.optional().or(z.literal('').transform(() => undefined));
    }

    case 'date': {
      if (isRequired) {
        return z.coerce.date({
          required_error: `${field.name} is required`,
          invalid_type_error: `${field.name} must be a valid date`,
        });
      }
      return z.coerce.date().optional().nullable();
    }

    case 'checkbox': {
      return z.boolean().default(false);
    }

    case 'menu': {
      let schema = z.string();
      if (isRequired) {
        schema = schema.min(1, `${field.name} is required`);
      }
      return isRequired ? schema : schema.optional().or(z.literal(''));
    }

    case 'multimenu': {
      let schema = z.array(z.string());
      if (isRequired) {
        schema = schema.min(1, `Please select at least one option for ${field.name}`);
      }
      return schema.default([]);
    }

    case 'radiobutton': {
      let schema = z.string();
      if (isRequired) {
        schema = schema.min(1, `${field.name} is required`);
      }
      return isRequired ? schema : schema.optional().or(z.literal(''));
    }

    case 'file':
    case 'picture': {
      // File validation is handled separately during upload
      // Store file names or references as strings
      return z.any().optional();
    }

    case 'url': {
      let schema = z.string();
      if (isRequired) {
        schema = schema.min(1, `${field.name} is required`).url(`${field.name} must be a valid URL`);
      } else {
        schema = schema.refine(
          (val) => !val || val.length === 0 || z.string().url().safeParse(val).success,
          { message: `${field.name} must be a valid URL` }
        );
      }
      return schema;
    }

    case 'latlong': {
      // Latitude/Longitude as object with lat and lng
      const latlongSchema = z.object({
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180),
      });
      if (isRequired) {
        return latlongSchema;
      }
      return latlongSchema.optional().nullable();
    }

    default:
      return z.string().optional();
  }
};

/**
 * Builds a complete Zod schema from all database fields
 */
const buildFormSchema = (fields: DatabaseField[]): z.ZodObject<Record<string, z.ZodTypeAny>> => {
  const schemaShape: Record<string, z.ZodTypeAny> = {};

  fields.forEach((field) => {
    const fieldKey = `field_${field.id}`;
    schemaShape[fieldKey] = createFieldSchema(field);
  });

  return z.object(schemaShape);
};

/**
 * Extracts initial form values from existing record data
 */
const getInitialValues = (
  fields: DatabaseField[],
  contents: FieldContent[] | undefined
): FormData => {
  const values: FormData = {};

  fields.forEach((field) => {
    const fieldKey = `field_${field.id}`;
    const content = contents?.find((c) => c.fieldid === field.id);
    const fieldType = getFieldTypeString(field.type);

    if (content) {
      switch (fieldType) {
        case 'checkbox':
          values[fieldKey] = content.content === '1' || content.content === 'true';
          break;
        case 'number':
          values[fieldKey] = content.content ? parseFloat(content.content) : '';
          break;
        case 'date':
          values[fieldKey] = content.content ? new Date(parseInt(content.content, 10) * 1000) : null;
          break;
        case 'multimenu':
          values[fieldKey] = content.content ? content.content.split('#') : [];
          break;
        case 'latlong':
          if (content.content && content.content1) {
            values[fieldKey] = {
              lat: parseFloat(content.content),
              lng: parseFloat(content.content1),
            };
          } else {
            values[fieldKey] = null;
          }
          break;
        case 'file':
        case 'picture':
          // Files are handled separately through the file upload state
          values[fieldKey] = content.content || '';
          break;
        default:
          values[fieldKey] = content.content || '';
      }
    } else {
      // Set default values for empty fields
      switch (fieldType) {
        case 'checkbox':
          values[fieldKey] = false;
          break;
        case 'multimenu':
          values[fieldKey] = [];
          break;
        case 'latlong':
          values[fieldKey] = null;
          break;
        default:
          values[fieldKey] = '';
      }
    }
  });

  return values;
};

/**
 * Transforms form data into API submission format
 */
const transformFormDataForSubmission = (
  fields: DatabaseField[],
  formData: FormData
): Array<{ fieldid: number; value: string; subfield?: string }> => {
  const submissionData: Array<{ fieldid: number; value: string; subfield?: string }> = [];

  fields.forEach((field) => {
    const fieldKey = `field_${field.id}`;
    const value = formData[fieldKey];
    const fieldType = getFieldTypeString(field.type);

    switch (fieldType) {
      case 'checkbox':
        submissionData.push({
          fieldid: field.id,
          value: value ? '1' : '0',
        });
        break;

      case 'date':
        if (value instanceof Date) {
          submissionData.push({
            fieldid: field.id,
            value: Math.floor(value.getTime() / 1000).toString(),
          });
        } else if (value) {
          submissionData.push({
            fieldid: field.id,
            value: String(value),
          });
        }
        break;

      case 'multimenu':
        if (Array.isArray(value)) {
          submissionData.push({
            fieldid: field.id,
            value: value.join('#'),
          });
        }
        break;

      case 'latlong':
        if (value && typeof value === 'object' && 'lat' in value && 'lng' in value) {
          const latlng = value as { lat: number; lng: number };
          submissionData.push({
            fieldid: field.id,
            value: String(latlng.lat),
            subfield: 'lat',
          });
          submissionData.push({
            fieldid: field.id,
            value: String(latlng.lng),
            subfield: 'lng',
          });
        }
        break;

      case 'file':
      case 'picture':
        // Files are uploaded separately; skip here unless there's a reference
        if (value && typeof value === 'string') {
          submissionData.push({
            fieldid: field.id,
            value: String(value),
          });
        }
        break;

      default:
        if (value !== undefined && value !== null && value !== '') {
          submissionData.push({
            fieldid: field.id,
            value: String(value),
          });
        }
        break;
    }
  });

  return submissionData;
};

// ============================================================================
// RecordForm Component
// ============================================================================

/**
 * RecordForm component for creating and editing database activity records.
 *
 * Dynamically generates form fields based on the database field definitions,
 * with appropriate input components and validation for each field type.
 *
 * @example
 * ```tsx
 * // Create new record
 * <RecordForm
 *   databaseId={123}
 *   onSuccess={(recordId) => console.log('Created:', recordId)}
 *   onCancel={() => navigate(-1)}
 * />
 *
 * // Edit existing record
 * <RecordForm
 *   databaseId={123}
 *   recordId={456}
 *   onSuccess={(recordId) => console.log('Updated:', recordId)}
 *   onCancel={() => navigate(-1)}
 * />
 * ```
 */
const RecordForm: React.FC<RecordFormProps> = ({
  databaseId,
  recordId,
  groupId = 0,
  onSuccess,
  onCancel,
  className,
}) => {
  // ============================================================================
  // Hooks and State
  // ============================================================================

  const toast = useToast();
  const queryClient = useQueryClient();

  // Determine if we're in edit mode
  const isEditMode = Boolean(recordId);

  // Fetch database configuration including field definitions
  const {
    data: database,
    isLoading: isDatabaseLoading,
    error: databaseError,
  } = useDatabase(databaseId, { enabled: Boolean(databaseId) });

  // Fetch existing record data if in edit mode
  const {
    data: existingRecord,
    isLoading: isRecordLoading,
    error: recordError,
  } = useRecord(databaseId, recordId ?? 0, { enabled: isEditMode });

  // Mutation hooks for create/update operations
  const createRecordMutation = useCreateRecord({
    onSuccess: (newRecordId) => {
      toast.success('Record created successfully');
      onSuccess?.(newRecordId);
    },
    onError: (error) => {
      toast.error(`Failed to create record: ${error.message}`);
    },
  });

  const updateRecordMutation = useUpdateRecord({
    onSuccess: () => {
      toast.success('Record updated successfully');
      if (recordId) {
        onSuccess?.(recordId);
      }
    },
    onError: (error) => {
      toast.error(`Failed to update record: ${error.message}`);
    },
  });

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadState>({});

  // Build validation schema from field definitions
  const validationSchema = useMemo(() => {
    if (!database?.fields || database.fields.length === 0) {
      return z.object({});
    }
    return buildFormSchema(database.fields);
  }, [database?.fields]);

  // Initialize React Hook Form
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: {},
    mode: 'onBlur',
  });

  // Initialize form with existing record data when in edit mode
  useEffect(() => {
    if (database?.fields && (!isEditMode || existingRecord)) {
      const initialValues = getInitialValues(
        database.fields,
        isEditMode ? existingRecord?.contents : undefined
      );
      reset(initialValues);
    }
  }, [database?.fields, existingRecord, isEditMode, reset]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handles file selection/upload for file fields
   */
  const handleFileChange = useCallback(
    (fieldId: number, files: File[]) => {
      const fieldKey = `field_${fieldId}`;
      setUploadedFiles((prev) => ({
        ...prev,
        [fieldKey]: files,
      }));
      // Store file reference in form
      setValue(fieldKey, files.length > 0 ? files[0].name : '');
    },
    [setValue]
  );

  /**
   * Handles form submission for both create and update operations
   */
  const onSubmit: SubmitHandler<FormData> = useCallback(
    async (formData) => {
      if (!database?.fields) {
        toast.error('Database configuration not loaded');
        return;
      }

      try {
        // Transform form data to API format
        const submissionData = transformFormDataForSubmission(database.fields, formData);

        // Collect files for upload
        const filesToUpload: Array<{ fieldId: number; file: File }> = [];
        Object.entries(uploadedFiles).forEach(([fieldKey, files]) => {
          const fieldId = parseInt(fieldKey.replace('field_', ''), 10);
          files.forEach((file) => {
            filesToUpload.push({ fieldId, file });
          });
        });

        if (isEditMode && recordId) {
          // Update existing record
          await updateRecordMutation.mutateAsync({
            databaseId,
            recordId,
            data: submissionData,
            files: filesToUpload,
          });
        } else {
          // Create new record
          await createRecordMutation.mutateAsync({
            databaseId,
            groupId,
            data: submissionData,
            files: filesToUpload,
          });
        }
      } catch (error) {
        // Error handling is done in mutation callbacks
        console.error('Form submission error:', error);
      }
    },
    [
      database?.fields,
      uploadedFiles,
      isEditMode,
      recordId,
      databaseId,
      groupId,
      createRecordMutation,
      updateRecordMutation,
      toast,
    ]
  );

  /**
   * Handles form cancellation
   */
  const handleCancel = useCallback(() => {
    if (isDirty) {
      // Could add confirmation dialog here
    }
    onCancel?.();
  }, [isDirty, onCancel]);

  // ============================================================================
  // Field Rendering Functions
  // ============================================================================

  /**
   * Renders the appropriate input component for a field based on its type
   */
  const renderField = useCallback(
    (field: DatabaseField): React.ReactNode => {
      const fieldKey = `field_${field.id}`;
      const fieldType = getFieldTypeString(field.type);
      const error = errors[fieldKey];
      const errorMessage = error?.message as string | undefined;

      switch (fieldType) {
        case 'text':
          return (
            <FormInput
              name={fieldKey}
              control={control}
              label={field.name}
              required={field.required}
              placeholder={field.description || `Enter ${field.name}`}
              helperText={field.description}
              error={Boolean(error)}
              errorMessage={errorMessage}
              fullWidth
            />
          );

        case 'textarea':
          return (
            <FormTextarea
              name={fieldKey}
              control={control}
              label={field.name}
              required={field.required}
              placeholder={field.description || `Enter ${field.name}`}
              helperText={field.description}
              error={Boolean(error)}
              errorMessage={errorMessage}
              rows={4}
              fullWidth
            />
          );

        case 'number':
          return (
            <FormInput
              name={fieldKey}
              control={control}
              label={field.name}
              required={field.required}
              type="number"
              placeholder={field.description || `Enter ${field.name}`}
              helperText={field.description}
              error={Boolean(error)}
              errorMessage={errorMessage}
              fullWidth
            />
          );

        case 'date':
          return (
            <FormDatePicker
              name={fieldKey}
              control={control}
              label={field.name}
              required={field.required}
              helperText={field.description}
              error={Boolean(error)}
              errorMessage={errorMessage}
            />
          );

        case 'checkbox':
          return (
            <Controller
              name={fieldKey}
              control={control}
              render={({ field: formField }) => (
                <FormControl error={Boolean(error)} component="fieldset">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(formField.value)}
                        onChange={(e) => formField.onChange(e.target.checked)}
                        onBlur={formField.onBlur}
                      />
                    }
                    label={
                      <Typography component="span">
                        {field.name}
                        {field.required && (
                          <Typography component="span" color="error" sx={{ ml: 0.5 }}>
                            *
                          </Typography>
                        )}
                      </Typography>
                    }
                  />
                  {field.description && (
                    <FormHelperText>{field.description}</FormHelperText>
                  )}
                  {errorMessage && (
                    <FormHelperText error>{errorMessage}</FormHelperText>
                  )}
                </FormControl>
              )}
            />
          );

        case 'menu': {
          const menuField = field as DatabaseField & { param1?: string; options?: string };
          const options = parseFieldOptions(menuField.options || menuField.param1);
          return (
            <FormSelect
              name={fieldKey}
              control={control}
              label={field.name}
              required={field.required}
              options={options}
              placeholder={`Select ${field.name}`}
              helperText={field.description}
              error={Boolean(error)}
              errorMessage={errorMessage}
              fullWidth
            />
          );
        }

        case 'multimenu': {
          const multiMenuField = field as DatabaseField & { param1?: string; options?: string };
          const multiOptions = parseFieldOptions(multiMenuField.options || multiMenuField.param1);
          return (
            <FormSelect
              name={fieldKey}
              control={control}
              label={field.name}
              required={field.required}
              options={multiOptions}
              multiple
              placeholder={`Select ${field.name}`}
              helperText={field.description}
              error={Boolean(error)}
              errorMessage={errorMessage}
              fullWidth
            />
          );
        }

        case 'radiobutton': {
          const radioField = field as DatabaseField & { param1?: string; options?: string };
          const radioOptions = parseFieldOptions(radioField.options || radioField.param1);
          return (
            <Controller
              name={fieldKey}
              control={control}
              render={({ field: formField }) => (
                <FormControl error={Boolean(error)} component="fieldset" fullWidth>
                  <FormLabel component="legend">
                    {field.name}
                    {field.required && (
                      <Typography component="span" color="error" sx={{ ml: 0.5 }}>
                        *
                      </Typography>
                    )}
                  </FormLabel>
                  <RadioGroup
                    value={formField.value || ''}
                    onChange={(e) => formField.onChange(e.target.value)}
                    onBlur={formField.onBlur}
                  >
                    {radioOptions.map((option) => (
                      <FormControlLabel
                        key={option.value}
                        value={option.value}
                        control={<Radio />}
                        label={option.label}
                      />
                    ))}
                  </RadioGroup>
                  {field.description && (
                    <FormHelperText>{field.description}</FormHelperText>
                  )}
                  {errorMessage && (
                    <FormHelperText error>{errorMessage}</FormHelperText>
                  )}
                </FormControl>
              )}
            />
          );
        }

        case 'file':
          return (
            <FormFileUpload
              name={fieldKey}
              control={control}
              label={field.name}
              required={field.required}
              helperText={field.description}
              error={Boolean(error)}
              errorMessage={errorMessage}
              onFilesChange={(files) => handleFileChange(field.id, files)}
              accept="*/*"
              maxFiles={1}
            />
          );

        case 'picture':
          return (
            <FormFileUpload
              name={fieldKey}
              control={control}
              label={field.name}
              required={field.required}
              helperText={field.description || 'Upload an image file'}
              error={Boolean(error)}
              errorMessage={errorMessage}
              onFilesChange={(files) => handleFileChange(field.id, files)}
              accept="image/*"
              maxFiles={1}
            />
          );

        case 'url':
          return (
            <FormInput
              name={fieldKey}
              control={control}
              label={field.name}
              required={field.required}
              type="url"
              placeholder="https://example.com"
              helperText={field.description || 'Enter a valid URL'}
              error={Boolean(error)}
              errorMessage={errorMessage}
              fullWidth
            />
          );

        case 'latlong':
          return (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {field.name}
                {field.required && (
                  <Typography component="span" color="error" sx={{ ml: 0.5 }}>
                    *
                  </Typography>
                )}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Controller
                    name={`${fieldKey}.lat`}
                    control={control}
                    render={({ field: latField }) => (
                      <TextField
                        {...latField}
                        label="Latitude"
                        type="number"
                        fullWidth
                        size="small"
                        inputProps={{ step: 'any', min: -90, max: 90 }}
                        error={Boolean(error)}
                        helperText={error ? 'Invalid latitude (-90 to 90)' : ''}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Controller
                    name={`${fieldKey}.lng`}
                    control={control}
                    render={({ field: lngField }) => (
                      <TextField
                        {...lngField}
                        label="Longitude"
                        type="number"
                        fullWidth
                        size="small"
                        inputProps={{ step: 'any', min: -180, max: 180 }}
                        error={Boolean(error)}
                        helperText={error ? 'Invalid longitude (-180 to 180)' : ''}
                      />
                    )}
                  />
                </Grid>
              </Grid>
              {field.description && (
                <FormHelperText>{field.description}</FormHelperText>
              )}
            </Box>
          );

        default:
          return (
            <FormInput
              name={fieldKey}
              control={control}
              label={field.name}
              required={field.required}
              placeholder={`Enter ${field.name}`}
              helperText={field.description}
              error={Boolean(error)}
              errorMessage={errorMessage}
              fullWidth
            />
          );
      }
    },
    [control, errors, handleFileChange]
  );

  // ============================================================================
  // Loading and Error States
  // ============================================================================

  // Show loading state while fetching database or record data
  const isLoading = isDatabaseLoading || (isEditMode && isRecordLoading);

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={200}
        className={className}
      >
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          {isEditMode ? 'Loading record...' : 'Loading form...'}
        </Typography>
      </Box>
    );
  }

  // Show error state
  const error = databaseError || recordError;
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }} className={className}>
        <Typography variant="body1">
          {error instanceof Error ? error.message : 'An error occurred loading the form'}
        </Typography>
      </Alert>
    );
  }

  // Validate database data
  if (!database) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }} className={className}>
        <Typography variant="body1">Database not found</Typography>
      </Alert>
    );
  }

  if (!database.fields || database.fields.length === 0) {
    return (
      <Alert severity="info" sx={{ mb: 2 }} className={className}>
        <Typography variant="body1">
          No fields defined for this database. Please add fields before creating records.
        </Typography>
      </Alert>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  const isSubmittingForm = isSubmitting || createRecordMutation.isPending || updateRecordMutation.isPending;

  return (
    <Paper elevation={0} sx={{ p: 3 }} className={className}>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Form Header */}
        <Typography variant="h5" component="h2" gutterBottom>
          {isEditMode ? 'Edit Record' : 'Add New Record'}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          {isEditMode
            ? 'Update the fields below to modify this record.'
            : 'Fill in the fields below to create a new record.'}
        </Typography>
        <Divider sx={{ mb: 3 }} />

        {/* Form Fields */}
        <Stack spacing={3}>
          {database.fields
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((field) => (
              <Box key={field.id}>{renderField(field)}</Box>
            ))}
        </Stack>

        <Divider sx={{ my: 3 }} />

        {/* Form Actions */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            variant="outlined"
            color="inherit"
            onClick={handleCancel}
            startIcon={<Cancel />}
            disabled={isSubmittingForm}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={isSubmittingForm ? <CircularProgress size={20} color="inherit" /> : <Save />}
            disabled={isSubmittingForm}
          >
            {isSubmittingForm
              ? 'Saving...'
              : isEditMode
              ? 'Update Record'
              : 'Save Record'}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
};

export default RecordForm;
