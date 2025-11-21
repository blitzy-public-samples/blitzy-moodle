/**
 * Unit Tests for useFieldValidation Hook
 *
 * Comprehensive test suite for the Database activity field validation hook.
 * Tests cover all 12 field types with validation rules matching Moodle's
 * field.php implementation.
 *
 * Test Coverage:
 * - Required field validation for all types
 * - Text field: max length constraints
 * - Textarea field: basic validation
 * - Number field: numeric format, decimal places, range validation
 * - Date field: date format validation
 * - Checkbox field: boolean validation, required checks
 * - Menu field: option validation, required checks
 * - MultiMenu field: multiple option validation, required checks
 * - RadioButton field: option validation, required checks
 * - File field: file size limits, structure validation
 * - Picture field: image type validation, size limits
 * - URL field: URL format validation
 * - LatLong field: coordinate format, latitude/longitude range validation
 * - Hook state management: reset functionality
 *
 * @module tests/unit/features/activities/data/hooks/useFieldValidation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import useFieldValidation from '@/features/activities/data/hooks/useFieldValidation';
import type { 
  TextField,
  TextAreaField,
  NumberField,
  DateField,
  CheckboxField,
  MenuField,
  MultiMenuField,
  RadioButtonField,
  FileField,
  PictureField,
  URLField,
  LatLongField,
} from '@/features/activities/data/types/data.types';
import { FieldType } from '@/features/activities/data/types/data.types';

// ============================================================================
// Test Setup and Cleanup
// ============================================================================

beforeEach(() => {
  // Clear any mock state before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
  cleanup();
});

// ============================================================================
// Mock Field Definitions
// ============================================================================

/**
 * Helper function to create a base text field for testing
 */
const createTextField = (overrides: Partial<TextField> = {}): TextField => ({
  id: 1,
  dataid: 100,
  type: FieldType.Text,
  name: 'testfield',
  description: 'Test text field',
  required: false,
  param1: '60', // Default max length
  ...overrides,
});

/**
 * Helper function to create a base textarea field for testing
 */
const createTextAreaField = (overrides: Partial<TextAreaField> = {}): TextAreaField => ({
  id: 2,
  dataid: 100,
  type: FieldType.Textarea,
  name: 'textarea_field',
  description: 'Test textarea field',
  required: false,
  ...overrides,
});

/**
 * Helper function to create a base number field for testing
 */
const createNumberField = (overrides: Partial<NumberField> = {}): NumberField => ({
  id: 3,
  dataid: 100,
  type: FieldType.Number,
  name: 'number_field',
  description: 'Test number field',
  required: false,
  param1: '2', // 2 decimal places
  ...overrides,
});

/**
 * Helper function to create a base date field for testing
 */
const createDateField = (overrides: Partial<DateField> = {}): DateField => ({
  id: 4,
  dataid: 100,
  type: FieldType.Date,
  name: 'date_field',
  description: 'Test date field',
  required: false,
  ...overrides,
});

/**
 * Helper function to create a base checkbox field for testing
 */
const createCheckboxField = (overrides: Partial<CheckboxField> = {}): CheckboxField => ({
  id: 5,
  dataid: 100,
  type: FieldType.Checkbox,
  name: 'checkbox_field',
  description: 'Test checkbox field',
  required: false,
  ...overrides,
});

/**
 * Helper function to create a base menu field for testing
 */
const createMenuField = (overrides: Partial<MenuField> = {}): MenuField => ({
  id: 6,
  dataid: 100,
  type: FieldType.Menu,
  name: 'menu_field',
  description: 'Test menu field',
  required: false,
  param1: 'Option 1\nOption 2\nOption 3',
  ...overrides,
});

/**
 * Helper function to create a base multimenu field for testing
 */
const createMultiMenuField = (overrides: Partial<MultiMenuField> = {}): MultiMenuField => ({
  id: 7,
  dataid: 100,
  type: FieldType.MultiMenu,
  name: 'multimenu_field',
  description: 'Test multimenu field',
  required: false,
  param1: 'Choice A\nChoice B\nChoice C',
  ...overrides,
});

/**
 * Helper function to create a base radiobutton field for testing
 */
const createRadioButtonField = (overrides: Partial<RadioButtonField> = {}): RadioButtonField => ({
  id: 8,
  dataid: 100,
  type: FieldType.RadioButton,
  name: 'radio_field',
  description: 'Test radio button field',
  required: false,
  param1: 'Yes\nNo\nMaybe',
  ...overrides,
});

/**
 * Helper function to create a base file field for testing
 */
const createFileField = (overrides: Partial<FileField> = {}): FileField => ({
  id: 9,
  dataid: 100,
  type: FieldType.File,
  name: 'file_field',
  description: 'Test file field',
  required: false,
  ...overrides,
});

/**
 * Helper function to create a base picture field for testing
 */
const createPictureField = (overrides: Partial<PictureField> = {}): PictureField => ({
  id: 10,
  dataid: 100,
  type: FieldType.Picture,
  name: 'picture_field',
  description: 'Test picture field',
  required: false,
  ...overrides,
});

/**
 * Helper function to create a base URL field for testing
 */
const createURLField = (overrides: Partial<URLField> = {}): URLField => ({
  id: 11,
  dataid: 100,
  type: FieldType.URL,
  name: 'url_field',
  description: 'Test URL field',
  required: false,
  ...overrides,
});

/**
 * Helper function to create a base latlong field for testing
 */
const createLatLongField = (overrides: Partial<LatLongField> = {}): LatLongField => ({
  id: 12,
  dataid: 100,
  type: FieldType.LatLong,
  name: 'latlong_field',
  description: 'Test latitude/longitude field',
  required: false,
  ...overrides,
});

// ============================================================================
// Test Suite: Hook Initialization
// ============================================================================

describe('useFieldValidation - Hook Initialization', () => {
  it('should initialize with valid state', () => {
    const { result } = renderHook(() => useFieldValidation());

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toEqual([]);
    expect(result.current.isValidating).toBe(false);
    expect(typeof result.current.validate).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });

  it('should provide all required hook return properties', () => {
    const { result } = renderHook(() => useFieldValidation());

    expect(result.current).toHaveProperty('isValid');
    expect(result.current).toHaveProperty('errors');
    expect(result.current).toHaveProperty('validate');
    expect(result.current).toHaveProperty('isValidating');
    expect(result.current).toHaveProperty('reset');
  });
});

// ============================================================================
// Test Suite: Text Field Validation
// ============================================================================

describe('useFieldValidation - Text Field Validation', () => {
  it('should pass validation for valid text within max length', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createTextField({ param1: '10' });

    act(() => {
      result.current.validate(field, 'short');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should fail validation when text exceeds max length', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createTextField({ param1: '5' });

    act(() => {
      result.current.validate(field, 'too long text');
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.field).toBe('testfield');
    expect(result.current.errors[0]!.message).toContain('5 characters');
  });

  it('should fail validation when required text field is empty', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createTextField({ required: true });

    act(() => {
      result.current.validate(field, '');
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('required');
  });

  it('should pass validation when optional text field is empty', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createTextField({ required: false });

    act(() => {
      result.current.validate(field, '');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should use default max length of 60 when param1 is not specified', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createTextField({ param1: undefined });
    const longText = 'a'.repeat(70);

    act(() => {
      result.current.validate(field, longText);
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors[0]!.message).toContain('60 characters');
  });
});

// ============================================================================
// Test Suite: Textarea Field Validation
// ============================================================================

describe('useFieldValidation - Textarea Field Validation', () => {
  it('should pass validation for valid textarea content', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createTextAreaField();

    act(() => {
      result.current.validate(field, 'Multi-line\ntext content\nhere');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should fail validation when required textarea is empty', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createTextAreaField({ required: true });

    act(() => {
      result.current.validate(field, '');
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('required');
  });

  it('should pass validation when optional textarea is empty', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createTextAreaField({ required: false });

    act(() => {
      result.current.validate(field, '');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });
});

// ============================================================================
// Test Suite: Number Field Validation
// ============================================================================

describe('useFieldValidation - Number Field Validation', () => {
  it('should pass validation for valid integer', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createNumberField({ param1: '0' }); // 0 decimal places

    act(() => {
      result.current.validate(field, 42);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should pass validation for valid decimal with correct decimal places', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createNumberField({ param1: '2' }); // 2 decimal places

    act(() => {
      result.current.validate(field, 3.14);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should fail validation when decimal places exceed limit', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createNumberField({ param1: '2' }); // 2 decimal places

    act(() => {
      result.current.validate(field, 3.14159);
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('2 decimal places');
  });

  it('should fail validation for non-numeric value', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createNumberField();

    act(() => {
      result.current.validate(field, 'not a number');
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('valid number');
  });

  it('should coerce string numbers to numeric values', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createNumberField({ param1: '1' });

    act(() => {
      result.current.validate(field, '42.5');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should pass validation for integer when decimal places specified', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createNumberField({ param1: '2' });

    act(() => {
      result.current.validate(field, 42); // Integer is valid even with decimal constraint
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should handle negative numbers correctly', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createNumberField({ param1: '2' });

    act(() => {
      result.current.validate(field, -15.75);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });
});

// ============================================================================
// Test Suite: Date Field Validation
// ============================================================================

describe('useFieldValidation - Date Field Validation', () => {
  it('should pass validation for valid Date object', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createDateField();

    act(() => {
      result.current.validate(field, new Date('2024-01-15'));
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should pass validation for valid ISO date string', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createDateField();

    act(() => {
      result.current.validate(field, '2024-01-15T10:30:00Z');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should fail validation for invalid date string', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createDateField();

    act(() => {
      result.current.validate(field, 'not a date');
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('valid date');
  });

  it('should pass validation for optional empty date field', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createDateField({ required: false });

    act(() => {
      result.current.validate(field, undefined);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });
});

// ============================================================================
// Test Suite: Checkbox Field Validation
// ============================================================================

describe('useFieldValidation - Checkbox Field Validation', () => {
  it('should pass validation for checked checkbox (true)', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createCheckboxField();

    act(() => {
      result.current.validate(field, true);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should pass validation for unchecked optional checkbox (false)', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createCheckboxField({ required: false });

    act(() => {
      result.current.validate(field, false);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should fail validation when required checkbox is not checked', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createCheckboxField({ required: true });

    act(() => {
      result.current.validate(field, false);
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('must be checked');
  });

  it('should fail validation for non-boolean value', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createCheckboxField();

    act(() => {
      result.current.validate(field, 'yes');
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('boolean');
  });
});

// ============================================================================
// Test Suite: Menu Field Validation
// ============================================================================

describe('useFieldValidation - Menu Field Validation', () => {
  it('should pass validation for valid menu option', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createMenuField();

    act(() => {
      result.current.validate(field, 'Option 2');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should fail validation for invalid menu option', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createMenuField();

    act(() => {
      result.current.validate(field, 'Invalid Option');
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('valid option');
  });

  it('should fail validation when required menu has no selection', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createMenuField({ required: true });

    act(() => {
      result.current.validate(field, '');
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
  });

  it('should pass validation when optional menu has no selection', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createMenuField({ required: false });

    act(() => {
      result.current.validate(field, '');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should handle menu options with whitespace correctly', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createMenuField();

    act(() => {
      result.current.validate(field, 'Option 1'); // Exact match including spaces
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });
});

// ============================================================================
// Test Suite: MultiMenu Field Validation
// ============================================================================

describe('useFieldValidation - MultiMenu Field Validation', () => {
  it('should pass validation for valid multiple selections', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createMultiMenuField();

    act(() => {
      result.current.validate(field, ['Choice A', 'Choice C']);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should pass validation for single selection', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createMultiMenuField();

    act(() => {
      result.current.validate(field, ['Choice B']);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should fail validation when any selection is invalid', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createMultiMenuField();

    act(() => {
      result.current.validate(field, ['Choice A', 'Invalid Choice']);
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('valid options');
  });

  it('should fail validation when required multimenu has no selections', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createMultiMenuField({ required: true });

    act(() => {
      result.current.validate(field, []);
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('At least one option must be selected');
  });

  it('should pass validation when optional multimenu has no selections', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createMultiMenuField({ required: false });

    act(() => {
      result.current.validate(field, undefined);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should pass validation for all valid selections', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createMultiMenuField();

    act(() => {
      result.current.validate(field, ['Choice A', 'Choice B', 'Choice C']);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });
});

// ============================================================================
// Test Suite: RadioButton Field Validation
// ============================================================================

describe('useFieldValidation - RadioButton Field Validation', () => {
  it('should pass validation for valid radio option', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createRadioButtonField();

    act(() => {
      result.current.validate(field, 'Yes');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should fail validation for invalid radio option', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createRadioButtonField();

    act(() => {
      result.current.validate(field, 'Unknown');
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('valid option');
  });

  it('should fail validation when required radio has no selection', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createRadioButtonField({ required: true });

    act(() => {
      result.current.validate(field, '');
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
  });

  it('should pass validation when optional radio has no selection', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createRadioButtonField({ required: false });

    act(() => {
      result.current.validate(field, '');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });
});

// ============================================================================
// Test Suite: File Field Validation
// ============================================================================

describe('useFieldValidation - File Field Validation', () => {
  it('should pass validation for valid file within size limit', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createFileField();
    const mockFile = {
      name: 'document.pdf',
      size: 5 * 1024 * 1024, // 5MB
      type: 'application/pdf',
    };

    act(() => {
      result.current.validate(field, mockFile);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should fail validation when file exceeds size limit', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createFileField();
    const mockFile = {
      name: 'large-file.zip',
      size: 15 * 1024 * 1024, // 15MB (exceeds 10MB limit)
      type: 'application/zip',
    };

    act(() => {
      result.current.validate(field, mockFile);
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('10MB');
  });

  it('should pass validation for optional file field with no file', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createFileField({ required: false });

    act(() => {
      result.current.validate(field, undefined);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should validate file object structure', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createFileField();
    const mockFile = {
      name: 'test.txt',
      size: 1024,
      type: 'text/plain',
    };

    act(() => {
      result.current.validate(field, mockFile);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });
});

// ============================================================================
// Test Suite: Picture Field Validation
// ============================================================================

describe('useFieldValidation - Picture Field Validation', () => {
  it('should pass validation for valid JPEG image', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createPictureField();
    const mockImage = {
      name: 'photo.jpg',
      size: 2 * 1024 * 1024, // 2MB
      type: 'image/jpeg',
    };

    act(() => {
      result.current.validate(field, mockImage);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should pass validation for valid PNG image', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createPictureField();
    const mockImage = {
      name: 'graphic.png',
      size: 3 * 1024 * 1024, // 3MB
      type: 'image/png',
    };

    act(() => {
      result.current.validate(field, mockImage);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should pass validation for valid WebP image', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createPictureField();
    const mockImage = {
      name: 'modern.webp',
      size: 1 * 1024 * 1024, // 1MB
      type: 'image/webp',
    };

    act(() => {
      result.current.validate(field, mockImage);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should fail validation for non-image file type', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createPictureField();
    const mockFile = {
      name: 'document.pdf',
      size: 1 * 1024 * 1024,
      type: 'application/pdf',
    };

    act(() => {
      result.current.validate(field, mockFile);
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('valid image');
  });

  it('should fail validation when image exceeds size limit', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createPictureField();
    const mockImage = {
      name: 'huge-image.jpg',
      size: 12 * 1024 * 1024, // 12MB (exceeds 10MB limit)
      type: 'image/jpeg',
    };

    act(() => {
      result.current.validate(field, mockImage);
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('10MB');
  });

  it('should pass validation for GIF image', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createPictureField();
    const mockImage = {
      name: 'animation.gif',
      size: 500 * 1024, // 500KB
      type: 'image/gif',
    };

    act(() => {
      result.current.validate(field, mockImage);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });
});

// ============================================================================
// Test Suite: URL Field Validation
// ============================================================================

describe('useFieldValidation - URL Field Validation', () => {
  it('should pass validation for valid HTTP URL', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createURLField();

    act(() => {
      result.current.validate(field, 'http://example.com');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should pass validation for valid HTTPS URL', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createURLField();

    act(() => {
      result.current.validate(field, 'https://www.example.com/path/to/page');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should fail validation for invalid URL format', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createURLField();

    act(() => {
      result.current.validate(field, 'not-a-valid-url');
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('valid URL');
  });

  it('should fail validation for URL without protocol', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createURLField();

    act(() => {
      result.current.validate(field, 'www.example.com');
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('valid URL');
  });

  it('should fail validation when required URL field is empty', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createURLField({ required: true });

    act(() => {
      result.current.validate(field, '');
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('required');
  });

  it('should pass validation when optional URL field is empty', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createURLField({ required: false });

    act(() => {
      result.current.validate(field, '');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should pass validation for URL with query parameters', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createURLField();

    act(() => {
      result.current.validate(field, 'https://example.com/search?q=test&page=1');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });
});

// ============================================================================
// Test Suite: LatLong Field Validation
// ============================================================================

describe('useFieldValidation - LatLong Field Validation', () => {
  it('should pass validation for valid coordinates as object', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createLatLongField();

    act(() => {
      result.current.validate(field, { lat: 40.7128, lng: -74.0060 });
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should pass validation for valid coordinates as comma-separated string', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createLatLongField();

    act(() => {
      result.current.validate(field, '40.7128, -74.0060');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should pass validation for valid coordinates as space-separated string', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createLatLongField();

    act(() => {
      result.current.validate(field, '40.7128 -74.0060');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('should fail validation when latitude exceeds maximum (90)', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createLatLongField();

    act(() => {
      result.current.validate(field, { lat: 95, lng: 0 });
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('between -90 and 90');
  });

  it('should fail validation when latitude is below minimum (-90)', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createLatLongField();

    act(() => {
      result.current.validate(field, { lat: -95, lng: 0 });
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('between -90 and 90');
  });

  it('should fail validation when longitude exceeds maximum (180)', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createLatLongField();

    act(() => {
      result.current.validate(field, { lat: 0, lng: 185 });
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('between -180 and 180');
  });

  it('should fail validation when longitude is below minimum (-180)', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createLatLongField();

    act(() => {
      result.current.validate(field, { lat: 0, lng: -185 });
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('between -180 and 180');
  });

  it('should pass validation for boundary latitude values', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createLatLongField();

    // Test max latitude
    act(() => {
      result.current.validate(field, { lat: 90, lng: 0 });
    });
    expect(result.current.isValid).toBe(true);

    // Test min latitude
    act(() => {
      result.current.validate(field, { lat: -90, lng: 0 });
    });
    expect(result.current.isValid).toBe(true);
  });

  it('should pass validation for boundary longitude values', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createLatLongField();

    // Test max longitude
    act(() => {
      result.current.validate(field, { lat: 0, lng: 180 });
    });
    expect(result.current.isValid).toBe(true);

    // Test min longitude
    act(() => {
      result.current.validate(field, { lat: 0, lng: -180 });
    });
    expect(result.current.isValid).toBe(true);
  });

  it('should fail validation for invalid coordinate format', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createLatLongField();

    act(() => {
      result.current.validate(field, 'invalid coordinates');
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
  });

  it('should fail validation when coordinate string has non-numeric values', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createLatLongField();

    act(() => {
      result.current.validate(field, 'abc, def');
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.message).toContain('valid numbers');
  });

  it('should pass validation for optional latlong field with no value', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createLatLongField({ required: false });

    act(() => {
      result.current.validate(field, undefined);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });
});

// ============================================================================
// Test Suite: Hook State Management
// ============================================================================

describe('useFieldValidation - State Management', () => {
  it('should reset validation state when reset is called', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createTextField({ required: true });

    // First, create an error
    act(() => {
      result.current.validate(field, '');
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);

    // Then reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
    expect(result.current.isValidating).toBe(false);
  });

  it('should clear errors for specific field on successful validation', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field1 = createTextField({ name: 'field1', required: true });
    const field2 = createTextField({ name: 'field2', required: true });

    // Create errors for both fields
    act(() => {
      result.current.validate(field1, '');
      result.current.validate(field2, '');
    });

    expect(result.current.errors).toHaveLength(2);

    // Fix one field
    act(() => {
      result.current.validate(field1, 'valid text');
    });

    // Should only have error for field2
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]!.field).toBe('field2');
  });

  it('should accumulate errors for multiple fields', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field1 = createTextField({ name: 'field1', required: true });
    const field2 = createNumberField({ name: 'field2', required: true });
    const field3 = createURLField({ name: 'field3', required: true });

    act(() => {
      result.current.validate(field1, '');
      result.current.validate(field2, 'not a number');
      result.current.validate(field3, 'not a url');
    });

    expect(result.current.errors).toHaveLength(3);
    expect(result.current.errors[0]!.field).toBe('field1');
    expect(result.current.errors[1]!.field).toBe('field2');
    expect(result.current.errors[2]!.field).toBe('field3');
  });

  it('should update errors when validating the same field multiple times', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createTextField({ param1: '5' });

    // First validation failure
    act(() => {
      result.current.validate(field, 'too long text');
    });

    expect(result.current.errors).toHaveLength(1);

    // Second validation failure with different error
    act(() => {
      result.current.validate(field, 'another too long text');
    });

    // Should still have 1 error (replaced, not accumulated)
    expect(result.current.errors).toHaveLength(1);
  });

  it('should return validation result from validate function', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createTextField();

    let validationResult: boolean;

    act(() => {
      validationResult = result.current.validate(field, 'valid text');
    });

    expect(validationResult!).toBe(true);

    act(() => {
      validationResult = result.current.validate(field, 'a'.repeat(100)); // Too long
    });

    expect(validationResult!).toBe(false);
  });
});

// ============================================================================
// Test Suite: Error Message Validation
// ============================================================================

describe('useFieldValidation - Error Messages', () => {
  it('should provide detailed error messages with field context', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createTextField({ name: 'username', required: true });

    act(() => {
      result.current.validate(field, '');
    });

    expect(result.current.errors[0]).toMatchObject({
      field: 'username',
      message: expect.any(String) as string,
      code: expect.any(String) as string,
    });
  });

  it('should include error codes for programmatic handling', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createNumberField();

    act(() => {
      result.current.validate(field, 'not a number');
    });

    expect(result.current.errors[0]!.code).toBeDefined();
    expect(typeof result.current.errors[0]!.code).toBe('string');
  });

  it('should provide specific error messages for different validation failures', () => {
    const { result } = renderHook(() => useFieldValidation());

    // Test text field max length error
    const textField = createTextField({ param1: '5' });
    act(() => {
      result.current.validate(textField, 'too long');
    });
    expect(result.current.errors[0]!.message).toContain('5 characters');

    // Test number field error
    result.current.reset();
    const numberField = createNumberField({ param1: '2' });
    act(() => {
      result.current.validate(numberField, 3.14159);
    });
    expect(result.current.errors[0]!.message).toContain('2 decimal places');

    // Test required field error
    result.current.reset();
    const requiredField = createTextField({ required: true });
    act(() => {
      result.current.validate(requiredField, '');
    });
    expect(result.current.errors[0]!.message).toContain('required');
  });
});

// ============================================================================
// Test Suite: Edge Cases and Complex Scenarios
// ============================================================================

describe('useFieldValidation - Edge Cases', () => {
  it('should handle undefined field param1 gracefully', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createTextField({ param1: undefined });

    act(() => {
      result.current.validate(field, 'some text');
    });

    // Should use default max length (60)
    expect(result.current.isValid).toBe(true);
  });

  it('should handle empty menu options gracefully', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createMenuField({ param1: '' });

    act(() => {
      result.current.validate(field, 'any value');
    });

    // Falls back to string validation
    expect(result.current.isValid).toBe(true);
  });

  it('should handle zero decimal places for number field', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createNumberField({ param1: '0' });

    act(() => {
      result.current.validate(field, 42);
    });

    expect(result.current.isValid).toBe(true);

    act(() => {
      result.current.validate(field, 42.5);
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors[0]!.message).toContain('0 decimal places');
  });

  it('should handle exactly at size limit for files', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createFileField();
    const mockFile = {
      name: 'exactly-10mb.zip',
      size: 10 * 1024 * 1024, // Exactly 10MB
      type: 'application/zip',
    };

    act(() => {
      result.current.validate(field, mockFile);
    });

    expect(result.current.isValid).toBe(true);
  });

  it('should handle latitude/longitude at exact boundaries', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createLatLongField();

    // North pole
    act(() => {
      result.current.validate(field, { lat: 90, lng: 0 });
    });
    expect(result.current.isValid).toBe(true);

    // South pole
    act(() => {
      result.current.validate(field, { lat: -90, lng: 0 });
    });
    expect(result.current.isValid).toBe(true);

    // International date line
    act(() => {
      result.current.validate(field, { lat: 0, lng: 180 });
    });
    expect(result.current.isValid).toBe(true);

    act(() => {
      result.current.validate(field, { lat: 0, lng: -180 });
    });
    expect(result.current.isValid).toBe(true);
  });

  it('should handle menu options with special characters', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createMenuField({ 
      param1: 'Option #1\nOption @2\nOption $3' 
    });

    act(() => {
      result.current.validate(field, 'Option @2');
    });

    expect(result.current.isValid).toBe(true);
  });

  it('should handle empty multimenu array for optional field', () => {
    const { result } = renderHook(() => useFieldValidation());
    const field = createMultiMenuField({ required: false });

    act(() => {
      result.current.validate(field, []);
    });

    // Empty array is allowed for optional multimenu
    expect(result.current.isValid).toBe(true);
  });
});
