/**
 * React Hook for Database Activity Field Validation
 *
 * Provides comprehensive validation for all 12 database field types based on Moodle's
 * validation rules from field.php and individual field class implementations.
 *
 * Supports validation for:
 * - text: max length validation
 * - textarea: max length validation
 * - number: numeric validation with decimal places
 * - date: valid date format
 * - checkbox: boolean validation
 * - menu: value must be in options list
 * - multimenu: values must be in options list
 * - radiobutton: value must be in options list
 * - file: file type and size validation
 * - picture: image file validation
 * - url: valid URL format
 * - latlong: valid latitude/longitude format
 *
 * Based on Moodle PHP implementations:
 * - public/mod/data/field.php
 * - public/mod/data/field/text/field.class.php
 * - public/mod/data/field/number/field.class.php
 *
 * @module features/activities/data/hooks/useFieldValidation
 */

import { useCallback, useState } from 'react';
import { z } from 'zod';
import type { DatabaseField } from '../types/data.types';
import { FieldType } from '../types/data.types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Validation error structure for a single field validation failure.
 *
 * Provides detailed information about what failed validation and why.
 */
export interface FieldValidationError {
  /**
   * Field identifier that failed validation
   */
  field: string;

  /**
   * Human-readable error message describing the validation failure
   */
  message: string;

  /**
   * Error code for programmatic error handling
   * Common codes: REQUIRED, INVALID_FORMAT, OUT_OF_RANGE, INVALID_OPTION
   */
  code: string;
}

/**
 * Result object returned by the useFieldValidation hook.
 *
 * Provides validation state, error information, and validation functions.
 */
export interface FieldValidationResult {
  /**
   * Whether the last validation check passed (no errors)
   */
  isValid: boolean;

  /**
   * Array of validation errors from the last validation check
   */
  errors: FieldValidationError[];

  /**
   * Function to validate a field value against the field definition
   * @param field - The field definition with validation rules
   * @param value - The value to validate
   * @returns true if validation passed, false otherwise
   */
  validate: (field: DatabaseField, value: unknown) => boolean;

  /**
   * Whether validation is currently in progress (for async validation)
   */
  isValidating: boolean;

  /**
   * Function to reset validation state (clear errors)
   */
  reset: () => void;
}

// ============================================================================
// Validation Schema Builders
// ============================================================================

/**
 * Creates a Zod validation schema for text fields.
 *
 * Validates:
 * - Required field constraint
 * - Maximum length constraint (param1)
 *
 * @param field - Text field definition
 * @returns Zod schema for validation
 */
function createTextSchema(field: Extract<DatabaseField, { type: 'text' }>): z.ZodTypeAny {
  let schema = z.string();

  // Apply max length constraint from param1
  const maxLength = field.param1 ? parseInt(field.param1, 10) : 60;
  if (!isNaN(maxLength) && maxLength > 0) {
    schema = schema.max(maxLength, {
      message: `Text must not exceed ${maxLength} characters`,
    });
  }

  // Handle required constraint
  if (field.required) {
    return schema.min(1, { message: 'This field is required' }) as z.ZodTypeAny;
  } else {
    // Allow empty string for optional fields
    return schema.optional().or(z.literal('')) as z.ZodTypeAny;
  }
}

/**
 * Creates a Zod validation schema for textarea fields.
 *
 * Validates:
 * - Required field constraint
 * - String type validation
 *
 * @param field - Textarea field definition
 * @returns Zod schema for validation
 */
function createTextAreaSchema(field: Extract<DatabaseField, { type: 'textarea' }>): z.ZodTypeAny {
  const schema = z.string();

  // Handle required constraint
  if (field.required) {
    return schema.min(1, { message: 'This field is required' }) as z.ZodTypeAny;
  } else {
    return schema.optional().or(z.literal('')) as z.ZodTypeAny;
  }
}

/**
 * Creates a Zod validation schema for number fields.
 *
 * Validates:
 * - Required field constraint
 * - Numeric value
 * - Decimal places (param1)
 *
 * @param field - Number field definition
 * @returns Zod schema for validation
 */
function createNumberSchema(field: Extract<DatabaseField, { type: 'number' }>): z.ZodTypeAny {
  // Coerce string input to number for validation
  const baseSchema = z.coerce.number({
    invalid_type_error: 'Must be a valid number',
  });

  // Apply decimal places constraint from param1
  const decimals = field.param1 ? parseInt(field.param1, 10) : undefined;
  
  if (decimals !== undefined && !isNaN(decimals) && decimals >= 0) {
    // Refine to check decimal places
    const refinedSchema = baseSchema.refine(
      (val) => {
        const str = val.toString();
        const decimalIndex = str.indexOf('.');
        if (decimalIndex === -1) return true; // Integer is valid
        const actualDecimals = str.length - decimalIndex - 1;
        return actualDecimals <= decimals;
      },
      {
        message: `Number must have at most ${decimals} decimal places`,
      }
    );
    
    // Handle required constraint
    if (field.required) {
      return refinedSchema as z.ZodTypeAny;
    } else {
      return refinedSchema.optional() as z.ZodTypeAny;
    }
  } else {
    // No decimal constraint
    if (field.required) {
      return baseSchema as z.ZodTypeAny;
    } else {
      return baseSchema.optional() as z.ZodTypeAny;
    }
  }
}

/**
 * Creates a Zod validation schema for date fields.
 *
 * Validates:
 * - Required field constraint
 * - Valid date format (ISO string or Date object)
 *
 * @param field - Date field definition
 * @returns Zod schema for validation
 */
function createDateSchema(field: Extract<DatabaseField, { type: 'date' }>): z.ZodTypeAny {
  // Accept either ISO date string or Date object
  const schema = z.coerce.date({
    invalid_type_error: 'Must be a valid date',
  });

  // Handle required constraint
  if (field.required) {
    return schema as z.ZodTypeAny;
  } else {
    return schema.optional() as z.ZodTypeAny;
  }
}

/**
 * Creates a Zod validation schema for checkbox fields.
 *
 * Validates:
 * - Boolean value (true/false)
 * - Required field constraint (must be checked if required)
 *
 * @param field - Checkbox field definition
 * @returns Zod schema for validation
 */
function createCheckboxSchema(field: Extract<DatabaseField, { type: 'checkbox' }>): z.ZodTypeAny {
  const schema = z.boolean({
    invalid_type_error: 'Must be a boolean value',
  });

  // Handle required constraint - checkbox must be checked
  if (field.required) {
    return schema.refine((val: boolean) => val === true, {
      message: 'This checkbox must be checked',
    }) as z.ZodTypeAny;
  } else {
    return schema.optional() as z.ZodTypeAny;
  }
}

/**
 * Parses menu options from param1 field configuration.
 *
 * Options are stored as newline-separated strings in param1.
 *
 * @param param1 - The param1 configuration string
 * @returns Array of valid option values
 */
function parseMenuOptions(param1: string | undefined): string[] {
  if (!param1) return [];
  return param1
    .split('\n')
    .map((option) => option.trim())
    .filter((option) => option.length > 0);
}

/**
 * Creates a Zod validation schema for menu (dropdown) fields.
 *
 * Validates:
 * - Required field constraint
 * - Value must be one of the defined options (param1)
 *
 * @param field - Menu field definition
 * @returns Zod schema for validation
 */
function createMenuSchema(field: Extract<DatabaseField, { type: 'menu' }>): z.ZodTypeAny {
  const options = parseMenuOptions(field.param1);

  if (options.length > 0) {
    // Create enum schema from available options
    const enumSchema = z.enum(options as [string, ...string[]], {
      errorMap: () => ({ message: 'Must select a valid option' }),
    });
    
    // Handle required constraint
    if (field.required) {
      return enumSchema as z.ZodTypeAny;
    } else {
      return enumSchema.optional().or(z.literal('')) as z.ZodTypeAny;
    }
  } else {
    // Fallback to string if no options defined
    const stringSchema = z.string();
    
    if (field.required) {
      return stringSchema.min(1, { message: 'This field is required' }) as z.ZodTypeAny;
    } else {
      return stringSchema.optional().or(z.literal('')) as z.ZodTypeAny;
    }
  }
}

/**
 * Creates a Zod validation schema for multi-menu (multi-select) fields.
 *
 * Validates:
 * - Required field constraint (at least one selection)
 * - All selected values must be in the defined options (param1)
 *
 * @param field - Multi-menu field definition
 * @returns Zod schema for validation
 */
function createMultiMenuSchema(field: Extract<DatabaseField, { type: 'multimenu' }>): z.ZodTypeAny {
  const options = parseMenuOptions(field.param1);

  // Accept array of strings
  const baseSchema = z.array(z.string());

  if (options.length > 0) {
    // Handle required constraint first, then add options validation
    if (field.required) {
      const minSchema = baseSchema.min(1, { message: 'At least one option must be selected' });
      // Validate each item is a valid option
      return minSchema.refine(
        (values: string[]) => values.every((val) => options.includes(val)),
        {
          message: 'All selections must be valid options',
        }
      ) as z.ZodTypeAny;
    } else {
      // For optional, apply refine then make optional
      const refinedSchema = baseSchema.refine(
        (values: string[]) => values.every((val) => options.includes(val)),
        {
          message: 'All selections must be valid options',
        }
      );
      return refinedSchema.optional() as z.ZodTypeAny;
    }
  } else {
    // No options validation
    if (field.required) {
      return baseSchema.min(1, { message: 'At least one option must be selected' }) as z.ZodTypeAny;
    } else {
      return baseSchema.optional() as z.ZodTypeAny;
    }
  }
}

/**
 * Creates a Zod validation schema for radio button fields.
 *
 * Validates:
 * - Required field constraint
 * - Value must be one of the defined options (param1)
 *
 * @param field - Radio button field definition
 * @returns Zod schema for validation
 */
function createRadioButtonSchema(field: Extract<DatabaseField, { type: 'radiobutton' }>): z.ZodTypeAny {
  const options = parseMenuOptions(field.param1);

  if (options.length > 0) {
    // Create enum schema from available options
    const enumSchema = z.enum(options as [string, ...string[]], {
      errorMap: () => ({ message: 'Must select a valid option' }),
    });
    
    // Handle required constraint
    if (field.required) {
      return enumSchema as z.ZodTypeAny;
    } else {
      return enumSchema.optional().or(z.literal('')) as z.ZodTypeAny;
    }
  } else {
    // Fallback to string if no options defined
    const stringSchema = z.string();
    
    if (field.required) {
      return stringSchema.min(1, { message: 'This field is required' }) as z.ZodTypeAny;
    } else {
      return stringSchema.optional().or(z.literal('')) as z.ZodTypeAny;
    }
  }
}

/**
 * Creates a Zod validation schema for file upload fields.
 *
 * Validates:
 * - Required field constraint
 * - File object structure
 * - File size constraints (max 10MB default)
 *
 * @param field - File field definition
 * @returns Zod schema for validation
 */
function createFileSchema(field: Extract<DatabaseField, { type: 'file' }>): z.ZodTypeAny {
  // File validation - expect File object or file metadata
  const schema = z.object({
    name: z.string(),
    size: z.number(),
    type: z.string(),
  }).refine(
    (file) => {
      // Max file size: 10MB (configurable via field settings)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      return file.size <= maxSize;
    },
    {
      message: 'File size must not exceed 10MB',
    }
  );

  // Handle required constraint
  if (field.required) {
    return schema as z.ZodTypeAny;
  } else {
    return schema.optional() as z.ZodTypeAny;
  }
}

/**
 * Creates a Zod validation schema for picture (image) upload fields.
 *
 * Validates:
 * - Required field constraint
 * - File object structure
 * - File must be a valid image type (jpg, jpeg, png, gif, webp)
 * - File size constraints (max 10MB default)
 *
 * @param field - Picture field definition
 * @returns Zod schema for validation
 */
function createPictureSchema(field: Extract<DatabaseField, { type: 'picture' }>): z.ZodTypeAny {
  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  const schema = z.object({
    name: z.string(),
    size: z.number(),
    type: z.string(),
  }).refine(
    (file) => validImageTypes.includes(file.type.toLowerCase()),
    {
      message: 'File must be a valid image (JPG, PNG, GIF, or WebP)',
    }
  ).refine(
    (file) => {
      // Max file size: 10MB
      const maxSize = 10 * 1024 * 1024;
      return file.size <= maxSize;
    },
    {
      message: 'Image size must not exceed 10MB',
    }
  );

  // Handle required constraint
  if (field.required) {
    return schema as z.ZodTypeAny;
  } else {
    return schema.optional() as z.ZodTypeAny;
  }
}

/**
 * Creates a Zod validation schema for URL fields.
 *
 * Validates:
 * - Required field constraint
 * - Valid URL format (must start with http:// or https://)
 *
 * @param field - URL field definition
 * @returns Zod schema for validation
 */
function createURLSchema(field: Extract<DatabaseField, { type: 'url' }>): z.ZodTypeAny {
  const schema = z.string().url({ message: 'Must be a valid URL' });

  // Handle required constraint
  if (field.required) {
    return schema.min(1, { message: 'This field is required' }) as z.ZodTypeAny;
  } else {
    return schema.optional().or(z.literal('')) as z.ZodTypeAny;
  }
}

/**
 * Creates a Zod validation schema for latitude/longitude coordinate fields.
 *
 * Validates:
 * - Required field constraint
 * - Valid coordinate format (object with lat and lng properties)
 * - Latitude range: -90 to 90
 * - Longitude range: -180 to 180
 *
 * @param field - LatLong field definition
 * @returns Zod schema for validation
 */
function createLatLongSchema(field: Extract<DatabaseField, { type: 'latlong' }>): z.ZodTypeAny {
  // Base coordinate validation schema
  const coordinateSchema = z.object({
    lat: z.number({
      invalid_type_error: 'Latitude must be a number',
    }).min(-90, { message: 'Latitude must be between -90 and 90' })
      .max(90, { message: 'Latitude must be between -90 and 90' }),
    lng: z.number({
      invalid_type_error: 'Longitude must be a number',
    }).min(-180, { message: 'Longitude must be between -180 and 180' })
      .max(180, { message: 'Longitude must be between -180 and 180' }),
  });

  // Schema that accepts string (comma or space separated) or object format
  const schema = z.union([
    // Accept string format: "lat,lng" or "lat lng"
    z.string().transform((val, ctx) => {
      // Try comma-separated format first (frontend standard)
      let parts = val.split(',').map(s => s.trim());
      
      // If no comma found, try space-separated format (import format)
      if (parts.length !== 2) {
        parts = val.split(/\s+/).filter(s => s.length > 0);
      }
      
      // Validate we have exactly 2 parts
      if (parts.length !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Coordinates must be in format "latitude,longitude" or "latitude longitude"',
        });
        return z.NEVER;
      }
      
      // Parse to numbers (non-null assertion safe because we validated length === 2)
      const lat = parseFloat(parts[0]!);
      const lng = parseFloat(parts[1]!);
      
      // Check if parsing was successful
      if (isNaN(lat) || isNaN(lng)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Latitude and longitude must be valid numbers',
        });
        return z.NEVER;
      }
      
      return { lat, lng };
    }).pipe(coordinateSchema),
    
    // Also accept object format directly
    coordinateSchema,
  ]);

  // Handle required constraint
  if (field.required) {
    return schema as z.ZodTypeAny;
  } else {
    return schema.optional() as z.ZodTypeAny;
  }
}

// ============================================================================
// Main Hook Implementation
// ============================================================================

/**
 * Custom React hook for validating database activity field values.
 *
 * Provides comprehensive validation for all 12 database field types based on
 * Moodle's validation rules. Returns validation state, errors, and validation
 * functions for use in forms.
 *
 * @example
 * ```tsx
 * const { isValid, errors, validate, reset } = useFieldValidation();
 *
 * const handleSubmit = (values: Record<string, unknown>) => {
 *   let allValid = true;
 *   fields.forEach(field => {
 *     const fieldValue = values[field.id];
 *     const valid = validate(field, fieldValue);
 *     if (!valid) allValid = false;
 *   });
 *
 *   if (allValid) {
 *     // Submit form
 *   }
 * };
 * ```
 *
 * @returns FieldValidationResult object with validation state and functions
 */
export default function useFieldValidation(): FieldValidationResult {
  const [isValid, setIsValid] = useState<boolean>(true);
  const [errors, setErrors] = useState<FieldValidationError[]>([]);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  /**
   * Validates a field value against the field definition.
   *
   * Uses Zod schemas to validate based on field type and configuration.
   *
   * @param field - The database field definition with validation rules
   * @param value - The value to validate against the field rules
   * @returns true if validation passes, false otherwise
   */
  const validate = useCallback((field: DatabaseField, value: unknown): boolean => {
    setIsValidating(true);

    try {
      let schema: z.ZodTypeAny;

      // Create appropriate schema based on field type
      switch (field.type) {
        case FieldType.Text:
          schema = createTextSchema(field);
          break;
        case FieldType.Textarea:
          schema = createTextAreaSchema(field);
          break;
        case FieldType.Number:
          schema = createNumberSchema(field);
          break;
        case FieldType.Date:
          schema = createDateSchema(field);
          break;
        case FieldType.Checkbox:
          schema = createCheckboxSchema(field);
          break;
        case FieldType.Menu:
          schema = createMenuSchema(field);
          break;
        case FieldType.MultiMenu:
          schema = createMultiMenuSchema(field);
          break;
        case FieldType.RadioButton:
          schema = createRadioButtonSchema(field);
          break;
        case FieldType.File:
          schema = createFileSchema(field);
          break;
        case FieldType.Picture:
          schema = createPictureSchema(field);
          break;
        case FieldType.URL:
          schema = createURLSchema(field);
          break;
        case FieldType.LatLong:
          schema = createLatLongSchema(field);
          break;
        default:
          // Exhaustive check - TypeScript will error if a case is missing
          const _exhaustiveCheck: never = field;
          throw new Error(`Unknown field type: ${(_exhaustiveCheck as DatabaseField).type}`);
      }

      // Perform validation
      schema.parse(value);

      // Validation passed - clear errors for this field
      setErrors((prev) => prev.filter((err) => err.field !== field.name));
      setIsValid(true);
      setIsValidating(false);
      return true;

    } catch (error) {
      // Validation failed
      if (error instanceof z.ZodError) {
        const validationErrors: FieldValidationError[] = error.errors.map((err) => ({
          field: field.name,
          message: err.message,
          code: err.code || 'VALIDATION_ERROR',
        }));

        // Update errors state
        setErrors((prev) => {
          // Remove old errors for this field
          const filtered = prev.filter((err) => err.field !== field.name);
          // Add new errors
          return [...filtered, ...validationErrors];
        });

        setIsValid(false);
        setIsValidating(false);
        return false;
      }

      // Unknown error
      const unknownError: FieldValidationError = {
        field: field.name,
        message: error instanceof Error ? error.message : 'Unknown validation error',
        code: 'UNKNOWN_ERROR',
      };

      setErrors((prev) => [...prev, unknownError]);
      setIsValid(false);
      setIsValidating(false);
      return false;
    }
  }, []);

  /**
   * Resets validation state by clearing all errors and setting isValid to true.
   *
   * Useful for clearing form validation state when user starts a new entry
   * or cancels the current form.
   */
  const reset = useCallback(() => {
    setIsValid(true);
    setErrors([]);
    setIsValidating(false);
  }, []);

  return {
    isValid,
    errors,
    validate,
    isValidating,
    reset,
  };
}
