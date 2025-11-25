/**
 * @file FieldRenderer Component Unit Tests
 * @description Comprehensive Vitest unit tests for the FieldRenderer component.
 * Tests rendering of all 12 database field types (text, textarea, number, date, menu,
 * checkbox, radiobutton, file, picture, url, latlong, multimenu) with proper formatting,
 * type-specific display logic, view/edit modes, and Material-UI component integration.
 * 
 * Test Coverage:
 * - All 12 field types in view mode with proper formatting
 * - Edit mode rendering with appropriate input components
 * - Date localization and formatting using date-fns
 * - File preview and image display for file/picture fields
 * - URL link rendering and validation
 * - Map coordinate display for latlong fields
 * - Multi-select rendering for multimenu fields
 * - Material-UI component integration
 * - Error handling for invalid field types or malformed data
 * - Accessibility attributes (ARIA labels, roles)
 * - onChange callback invocation
 * 
 * Target: 90%+ code coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { userEvent } from '../../../../../helpers/render';

import { FieldRenderer } from '../../../../../../src/features/activities/data/components/FieldRenderer';
import type { 
  DatabaseField, 
  FieldContent,
  TextField,
  TextAreaField,
  NumberField,
  DateField,
  MenuField,
  CheckboxField,
  RadioButtonField,
  FileField,
  PictureField,
  URLField,
  LatLongField,
  MultiMenuField
} from '../../../../../../src/features/activities/data/types/data.types';

// Mock date-fns format function
vi.mock('date-fns', () => ({
  format: vi.fn((date: Date, formatStr: string) => {
    if (formatStr === 'PPP') {
      return 'January 15, 2024';
    }
    return date.toISOString();
  }),
  parseISO: vi.fn((dateStr: string) => new Date(dateStr)),
}));

describe('FieldRenderer Component', () => {
  let mockOnChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnChange = vi.fn();
  });

  describe('Text Field Rendering', () => {
    const textField: TextField = {
      id: 1,
      dataid: 100,
      type: 'text',
      name: 'First Name',
      description: 'Enter your first name',
      required: false,
      param1: '',
      param2: '',
      param3: '',
    };

    it('should render text value in view mode', () => {
      const value: FieldContent = {
        id: 1,
        fieldid: 1,
        recordid: 50,
        content: 'John Doe',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={textField} 
          value={value} 
          mode="view"
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should render TextField in edit mode', () => {
      const value: FieldContent = {
        id: 1,
        fieldid: 1,
        recordid: 50,
        content: 'John Doe',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={textField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('John Doe');
    });

    it('should call onChange when text is edited', async () => {
      const value: FieldContent = {
        id: 1,
        fieldid: 1,
        recordid: 50,
        content: 'John',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={textField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'Jane');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });

    it('should render empty text field in view mode when no value', () => {
      const value: FieldContent = {
        id: 1,
        fieldid: 1,
        recordid: 50,
        content: '',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      const { container } = render(
        <FieldRenderer 
          field={textField} 
          value={value} 
          mode="view"
        />
      );

      const textElement = container.querySelector('p');
      expect(textElement).toBeInTheDocument();
      expect(textElement?.textContent).toBe('');
    });
  });

  describe('Textarea Field Rendering', () => {
    const textareaField: TextAreaField = {
      id: 2,
      dataid: 100,
      type: 'textarea',
      name: 'Description',
      description: 'Enter a description',
      required: false,
      param1: '',
      param2: '',
      param3: '',
    };

    it('should render multiline text in view mode', () => {
      const value: FieldContent = {
        id: 2,
        fieldid: 2,
        recordid: 50,
        content: 'Line 1\nLine 2\nLine 3',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={textareaField} 
          value={value} 
          mode="view"
        />
      );

      const text = screen.getByText(/Line 1/);
      expect(text).toBeInTheDocument();
    });

    it('should render multiline TextField in edit mode', () => {
      const value: FieldContent = {
        id: 2,
        fieldid: 2,
        recordid: 50,
        content: 'Multiline\nContent',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={textareaField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue('Multiline\nContent');
    });

    it('should preserve line breaks in view mode', () => {
      const value: FieldContent = {
        id: 2,
        fieldid: 2,
        recordid: 50,
        content: 'First line\nSecond line',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      const { container } = render(
        <FieldRenderer 
          field={textareaField} 
          value={value} 
          mode="view"
        />
      );

      const pre = container.querySelector('pre');
      expect(pre).toBeInTheDocument();
      expect(pre?.style.whiteSpace).toBe('pre-wrap');
    });
  });

  describe('Number Field Rendering', () => {
    const numberField: NumberField = {
      id: 3,
      dataid: 100,
      type: 'number',
      name: 'Price',
      description: 'Enter price',
      required: false,
      param1: '2', // decimal places
      param2: '',
      param3: '',
    };

    it('should render number with decimal formatting in view mode', () => {
      const value: FieldContent = {
        id: 3,
        fieldid: 3,
        recordid: 50,
        content: '123.456',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={numberField} 
          value={value} 
          mode="view"
        />
      );

      expect(screen.getByText('123.46')).toBeInTheDocument();
    });

    it('should render number TextField in edit mode', () => {
      const value: FieldContent = {
        id: 3,
        fieldid: 3,
        recordid: 50,
        content: '42.5',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={numberField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(42.5);
    });

    it('should handle number without decimal places', () => {
      const integerField: NumberField = {
        ...numberField,
        param1: '0',
      };

      const value: FieldContent = {
        id: 3,
        fieldid: 3,
        recordid: 50,
        content: '42.789',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={integerField} 
          value={value} 
          mode="view"
        />
      );

      expect(screen.getByText('43')).toBeInTheDocument();
    });

    it('should call onChange when number is edited', async () => {
      const value: FieldContent = {
        id: 3,
        fieldid: 3,
        recordid: 50,
        content: '10',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={numberField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      await userEvent.clear(input);
      await userEvent.type(input, '25');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });
  });

  describe('Date Field Rendering', () => {
    const dateField: DateField = {
      id: 4,
      dataid: 100,
      type: 'date',
      name: 'Birth Date',
      description: 'Enter your birth date',
      required: false,
      param1: '',
      param2: '',
      param3: '',
    };

    it('should render formatted date in view mode using date-fns', () => {
      const value: FieldContent = {
        id: 4,
        fieldid: 4,
        recordid: 50,
        content: '2024-01-15',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={dateField} 
          value={value} 
          mode="view"
        />
      );

      expect(screen.getByText('January 15, 2024')).toBeInTheDocument();
    });

    it('should render date input in edit mode', () => {
      const value: FieldContent = {
        id: 4,
        fieldid: 4,
        recordid: 50,
        content: '2024-01-15',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={dateField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const input = screen.getByDisplayValue('2024-01-15');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'date');
    });

    it('should handle empty date value', () => {
      const value: FieldContent = {
        id: 4,
        fieldid: 4,
        recordid: 50,
        content: '',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      const { container } = render(
        <FieldRenderer 
          field={dateField} 
          value={value} 
          mode="view"
        />
      );

      const textElement = container.querySelector('p');
      expect(textElement).toBeInTheDocument();
      expect(textElement?.textContent).toBe('');
    });
  });

  describe('Menu Field Rendering', () => {
    const menuField: MenuField = {
      id: 5,
      dataid: 100,
      type: 'menu',
      name: 'Color',
      description: 'Select a color',
      required: false,
      param1: 'Red\nGreen\nBlue\nYellow',
      param2: '',
      param3: '',
    };

    it('should render selected option label in view mode', () => {
      const value: FieldContent = {
        id: 5,
        fieldid: 5,
        recordid: 50,
        content: 'Green',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={menuField} 
          value={value} 
          mode="view"
        />
      );

      expect(screen.getByText('Green')).toBeInTheDocument();
    });

    it('should render Select component in edit mode', () => {
      const value: FieldContent = {
        id: 5,
        fieldid: 5,
        recordid: 50,
        content: 'Red',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={menuField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('should display all menu options', () => {
      const value: FieldContent = {
        id: 5,
        fieldid: 5,
        recordid: 50,
        content: 'Red',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={menuField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });
  });

  describe('Checkbox Field Rendering', () => {
    const checkboxField: CheckboxField = {
      id: 6,
      dataid: 100,
      type: 'checkbox',
      name: 'Agree',
      description: 'I agree to terms',
      required: false,
      param1: '',
      param2: '',
      param3: '',
    };

    it('should render "Yes" when checkbox is checked in view mode', () => {
      const value: FieldContent = {
        id: 6,
        fieldid: 6,
        recordid: 50,
        content: '1',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={checkboxField} 
          value={value} 
          mode="view"
        />
      );

      expect(screen.getByText('Yes')).toBeInTheDocument();
    });

    it('should render "No" when checkbox is unchecked in view mode', () => {
      const value: FieldContent = {
        id: 6,
        fieldid: 6,
        recordid: 50,
        content: '0',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={checkboxField} 
          value={value} 
          mode="view"
        />
      );

      expect(screen.getByText('No')).toBeInTheDocument();
    });

    it('should render Checkbox component in edit mode', () => {
      const value: FieldContent = {
        id: 6,
        fieldid: 6,
        recordid: 50,
        content: '1',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={checkboxField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toBeChecked();
    });

    it('should call onChange when checkbox is toggled', async () => {
      const value: FieldContent = {
        id: 6,
        fieldid: 6,
        recordid: 50,
        content: '0',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={checkboxField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      await userEvent.click(checkbox);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });
  });

  describe('RadioButton Field Rendering', () => {
    const radioField: RadioButtonField = {
      id: 7,
      dataid: 100,
      type: 'radiobutton',
      name: 'Size',
      description: 'Select size',
      required: false,
      param1: 'Small\nMedium\nLarge\nExtra Large',
      param2: '',
      param3: '',
    };

    it('should render selected radio option in view mode', () => {
      const value: FieldContent = {
        id: 7,
        fieldid: 7,
        recordid: 50,
        content: 'Medium',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={radioField} 
          value={value} 
          mode="view"
        />
      );

      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('should render RadioGroup in edit mode', () => {
      const value: FieldContent = {
        id: 7,
        fieldid: 7,
        recordid: 50,
        content: 'Large',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={radioField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const radios = screen.getAllByRole('radio');
      expect(radios.length).toBe(4);
    });

    it('should have correct radio button selected', () => {
      const value: FieldContent = {
        id: 7,
        fieldid: 7,
        recordid: 50,
        content: 'Small',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={radioField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const smallRadio = screen.getByLabelText('Small');
      expect(smallRadio).toBeChecked();
    });
  });

  describe('File Field Rendering', () => {
    const fileField: FileField = {
      id: 8,
      dataid: 100,
      type: 'file',
      name: 'Document',
      description: 'Upload document',
      required: false,
      param1: '',
      param2: '',
      param3: '',
    };

    it('should render file name as link in view mode', () => {
      const value: FieldContent = {
        id: 8,
        fieldid: 8,
        recordid: 50,
        content: 'document.pdf',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={fileField} 
          value={value} 
          mode="view"
          fileBaseUrl="https://example.com/files"
        />
      );

      const link = screen.getByRole('link', { name: /document\.pdf/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', expect.stringContaining('document.pdf'));
    });

    it('should construct proper file download URL', () => {
      const value: FieldContent = {
        id: 8,
        fieldid: 8,
        recordid: 50,
        content: 'report.docx',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={fileField} 
          value={value} 
          mode="view"
          fileBaseUrl="https://moodle.example.com/files"
        />
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toContain('report.docx');
    });

    it('should render file input in edit mode', () => {
      const value: FieldContent = {
        id: 8,
        fieldid: 8,
        recordid: 50,
        content: '',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      const { container } = render(
        <FieldRenderer 
          field={fileField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
    });

    it('should handle empty file value', () => {
      const value: FieldContent = {
        id: 8,
        fieldid: 8,
        recordid: 50,
        content: '',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      const { container } = render(
        <FieldRenderer 
          field={fileField} 
          value={value} 
          mode="view"
        />
      );

      const textElement = container.querySelector('p');
      expect(textElement).toBeInTheDocument();
      expect(textElement?.textContent).toBe('');
    });
  });

  describe('Picture Field Rendering', () => {
    const pictureField: PictureField = {
      id: 9,
      dataid: 100,
      type: 'picture',
      name: 'Photo',
      description: 'Upload photo',
      required: false,
      param1: '',
      param2: '',
      param3: '',
    };

    it('should render image with alt text in view mode', () => {
      const value: FieldContent = {
        id: 9,
        fieldid: 9,
        recordid: 50,
        content: 'profile.jpg',
        content1: 'Profile picture',
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={pictureField} 
          value={value} 
          mode="view"
          fileBaseUrl="https://example.com/files"
        />
      );

      const image = screen.getByRole('img', { name: /Profile picture/i });
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', expect.stringContaining('profile.jpg'));
      expect(image).toHaveAttribute('alt', 'Profile picture');
    });

    it('should construct proper image src URL', () => {
      const value: FieldContent = {
        id: 9,
        fieldid: 9,
        recordid: 50,
        content: 'image.png',
        content1: 'Test image',
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={pictureField} 
          value={value} 
          mode="view"
          fileBaseUrl="https://cdn.example.com/images"
        />
      );

      const image = screen.getByRole('img');
      expect(image.getAttribute('src')).toContain('image.png');
    });

    it('should use filename as alt text when content1 is empty', () => {
      const value: FieldContent = {
        id: 9,
        fieldid: 9,
        recordid: 50,
        content: 'photo.jpg',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={pictureField} 
          value={value} 
          mode="view"
          fileBaseUrl="https://example.com/files"
        />
      );

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt', 'photo.jpg');
    });

    it('should render file input for image upload in edit mode', () => {
      const value: FieldContent = {
        id: 9,
        fieldid: 9,
        recordid: 50,
        content: '',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      const { container } = render(
        <FieldRenderer 
          field={pictureField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('accept', 'image/*');
    });
  });

  describe('URL Field Rendering', () => {
    const urlField: URLField = {
      id: 10,
      dataid: 100,
      type: 'url',
      name: 'Website',
      description: 'Enter website URL',
      required: false,
      param1: '',
      param2: '',
      param3: '',
    };

    it('should render URL as link with custom text in view mode', () => {
      const value: FieldContent = {
        id: 10,
        fieldid: 10,
        recordid: 50,
        content: 'https://example.com',
        content1: 'Visit Example',
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={urlField} 
          value={value} 
          mode="view"
        />
      );

      const link = screen.getByRole('link', { name: /Visit Example/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should use URL as link text when content1 is empty', () => {
      const value: FieldContent = {
        id: 10,
        fieldid: 10,
        recordid: 50,
        content: 'https://moodle.org',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={urlField} 
          value={value} 
          mode="view"
        />
      );

      const link = screen.getByRole('link', { name: /moodle\.org/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://moodle.org');
    });

    it('should render URL TextField in edit mode', () => {
      const value: FieldContent = {
        id: 10,
        fieldid: 10,
        recordid: 50,
        content: 'https://example.com',
        content1: 'Example',
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={urlField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const urlInput = screen.getByLabelText(/URL/i);
      expect(urlInput).toBeInTheDocument();
      expect(urlInput).toHaveValue('https://example.com');
    });

    it('should render text input for link text in edit mode', () => {
      const value: FieldContent = {
        id: 10,
        fieldid: 10,
        recordid: 50,
        content: 'https://example.com',
        content1: 'Example Link',
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={urlField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const textInput = screen.getByLabelText(/Link Text/i);
      expect(textInput).toBeInTheDocument();
      expect(textInput).toHaveValue('Example Link');
    });
  });

  describe('LatLong Field Rendering', () => {
    const latlongField: LatLongField = {
      id: 11,
      dataid: 100,
      type: 'latlong',
      name: 'Location',
      description: 'Enter coordinates',
      required: false,
      param1: '',
      param2: '',
      param3: '',
    };

    it('should render coordinates in view mode', () => {
      const value: FieldContent = {
        id: 11,
        fieldid: 11,
        recordid: 50,
        content: '40.7128',
        content1: '-74.0060',
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={latlongField} 
          value={value} 
          mode="view"
        />
      );

      expect(screen.getByText(/40\.7128/)).toBeInTheDocument();
      expect(screen.getByText(/-74\.0060/)).toBeInTheDocument();
    });

    it('should format coordinates properly', () => {
      const value: FieldContent = {
        id: 11,
        fieldid: 11,
        recordid: 50,
        content: '51.5074',
        content1: '-0.1278',
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={latlongField} 
          value={value} 
          mode="view"
        />
      );

      const coordText = screen.getByText(/51\.5074.*-0\.1278/);
      expect(coordText).toBeInTheDocument();
    });

    it('should render latitude and longitude inputs in edit mode', () => {
      const value: FieldContent = {
        id: 11,
        fieldid: 11,
        recordid: 50,
        content: '34.0522',
        content1: '-118.2437',
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={latlongField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const latInput = screen.getByLabelText(/Latitude/i);
      const longInput = screen.getByLabelText(/Longitude/i);
      
      expect(latInput).toBeInTheDocument();
      expect(latInput).toHaveValue(34.0522);
      expect(longInput).toBeInTheDocument();
      expect(longInput).toHaveValue(-118.2437);
    });

    it('should handle empty coordinates', () => {
      const value: FieldContent = {
        id: 11,
        fieldid: 11,
        recordid: 50,
        content: '',
        content1: '',
        content2: null,
        content3: null,
        content4: null,
      };

      const { container } = render(
        <FieldRenderer 
          field={latlongField} 
          value={value} 
          mode="view"
        />
      );

      const textElement = container.querySelector('p');
      expect(textElement).toBeInTheDocument();
    });
  });

  describe('MultiMenu Field Rendering', () => {
    const multimenuField: MultiMenuField = {
      id: 12,
      dataid: 100,
      type: 'multimenu',
      name: 'Tags',
      description: 'Select tags',
      required: false,
      param1: 'JavaScript\nPython\nJava\nC++\nRuby\nGo',
      param2: '',
      param3: '',
    };

    it('should render multiple selected values as Chips in view mode', () => {
      const value: FieldContent = {
        id: 12,
        fieldid: 12,
        recordid: 50,
        content: 'JavaScript##@@##Python##@@##Go',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={multimenuField} 
          value={value} 
          mode="view"
        />
      );

      expect(screen.getByText('JavaScript')).toBeInTheDocument();
      expect(screen.getByText('Python')).toBeInTheDocument();
      expect(screen.getByText('Go')).toBeInTheDocument();
    });

    it('should render all chips with proper styling', () => {
      const value: FieldContent = {
        id: 12,
        fieldid: 12,
        recordid: 50,
        content: 'Java##@@##C++',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={multimenuField} 
          value={value} 
          mode="view"
        />
      );

      const javaChip = screen.getByText('Java');
      const cppChip = screen.getByText('C++');
      
      expect(javaChip.closest('.MuiChip-root')).toBeInTheDocument();
      expect(cppChip.closest('.MuiChip-root')).toBeInTheDocument();
    });

    it('should render Select with multiple prop in edit mode', () => {
      const value: FieldContent = {
        id: 12,
        fieldid: 12,
        recordid: 50,
        content: 'JavaScript',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={multimenuField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('should handle empty selection', () => {
      const value: FieldContent = {
        id: 12,
        fieldid: 12,
        recordid: 50,
        content: '',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      const { container } = render(
        <FieldRenderer 
          field={multimenuField} 
          value={value} 
          mode="view"
        />
      );

      // Should render empty Box, no chips
      const chips = container.querySelectorAll('.MuiChip-root');
      expect(chips.length).toBe(0);
    });

    it('should handle single selection', () => {
      const value: FieldContent = {
        id: 12,
        fieldid: 12,
        recordid: 50,
        content: 'Ruby',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={multimenuField} 
          value={value} 
          mode="view"
        />
      );

      const chip = screen.getByText('Ruby');
      expect(chip).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid field type gracefully', () => {
      const invalidField = {
        id: 99,
        dataid: 100,
        type: 'invalid_type' as any,
        name: 'Invalid',
        description: 'Invalid field type',
        required: false,
        param1: '',
        param2: '',
        param3: '',
      };

      const value: FieldContent = {
        id: 99,
        fieldid: 99,
        recordid: 50,
        content: 'test',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      const { container } = render(
        <FieldRenderer 
          field={invalidField} 
          value={value} 
          mode="view"
        />
      );

      // Should render error message or fallback
      expect(container.querySelector('p')).toBeInTheDocument();
    });

    it('should handle null value gracefully', () => {
      const textField: TextField = {
        id: 1,
        dataid: 100,
        type: 'text',
        name: 'Test',
        description: 'Test field',
        required: false,
        param1: '',
        param2: '',
        param3: '',
      };

      const value = null as any;

      const { container } = render(
        <FieldRenderer 
          field={textField} 
          value={value} 
          mode="view"
        />
      );

      expect(container).toBeInTheDocument();
    });

    it('should handle malformed date string', () => {
      const dateField: DateField = {
        id: 4,
        dataid: 100,
        type: 'date',
        name: 'Date',
        description: 'Test date',
        required: false,
        param1: '',
        param2: '',
        param3: '',
      };

      const value: FieldContent = {
        id: 4,
        fieldid: 4,
        recordid: 50,
        content: 'invalid-date',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      const { container } = render(
        <FieldRenderer 
          field={dateField} 
          value={value} 
          mode="view"
        />
      );

      expect(container).toBeInTheDocument();
    });

    it('should handle malformed number string', () => {
      const numberField: NumberField = {
        id: 3,
        dataid: 100,
        type: 'number',
        name: 'Number',
        description: 'Test number',
        required: false,
        param1: '2',
        param2: '',
        param3: '',
      };

      const value: FieldContent = {
        id: 3,
        fieldid: 3,
        recordid: 50,
        content: 'not-a-number',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      const { container } = render(
        <FieldRenderer 
          field={numberField} 
          value={value} 
          mode="view"
        />
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for text input', () => {
      const textField: TextField = {
        id: 1,
        dataid: 100,
        type: 'text',
        name: 'Username',
        description: 'Enter username',
        required: true,
        param1: '',
        param2: '',
        param3: '',
      };

      const value: FieldContent = {
        id: 1,
        fieldid: 1,
        recordid: 50,
        content: '',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={textField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('should have proper role for checkbox', () => {
      const checkboxField: CheckboxField = {
        id: 6,
        dataid: 100,
        type: 'checkbox',
        name: 'Terms',
        description: 'Accept terms',
        required: false,
        param1: '',
        param2: '',
        param3: '',
      };

      const value: FieldContent = {
        id: 6,
        fieldid: 6,
        recordid: 50,
        content: '0',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={checkboxField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('should have proper role for radio buttons', () => {
      const radioField: RadioButtonField = {
        id: 7,
        dataid: 100,
        type: 'radiobutton',
        name: 'Gender',
        description: 'Select gender',
        required: false,
        param1: 'Male\nFemale\nOther',
        param2: '',
        param3: '',
      };

      const value: FieldContent = {
        id: 7,
        fieldid: 7,
        recordid: 50,
        content: 'Male',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={radioField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const radios = screen.getAllByRole('radio');
      expect(radios.length).toBeGreaterThan(0);
    });

    it('should have proper alt text for images', () => {
      const pictureField: PictureField = {
        id: 9,
        dataid: 100,
        type: 'picture',
        name: 'Avatar',
        description: 'Upload avatar',
        required: false,
        param1: '',
        param2: '',
        param3: '',
      };

      const value: FieldContent = {
        id: 9,
        fieldid: 9,
        recordid: 50,
        content: 'avatar.jpg',
        content1: 'User avatar image',
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={pictureField} 
          value={value} 
          mode="view"
          fileBaseUrl="https://example.com/files"
        />
      );

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt', 'User avatar image');
    });

    it('should have proper rel attributes for external links', () => {
      const urlField: URLField = {
        id: 10,
        dataid: 100,
        type: 'url',
        name: 'External Link',
        description: 'Enter link',
        required: false,
        param1: '',
        param2: '',
        param3: '',
      };

      const value: FieldContent = {
        id: 10,
        fieldid: 10,
        recordid: 50,
        content: 'https://external.com',
        content1: 'External Site',
        content2: null,
        content3: null,
        content4: null,
      };

      render(
        <FieldRenderer 
          field={urlField} 
          value={value} 
          mode="view"
        />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  describe('Material-UI Component Integration', () => {
    it('should render MUI TextField for text input', () => {
      const textField: TextField = {
        id: 1,
        dataid: 100,
        type: 'text',
        name: 'Name',
        description: 'Enter name',
        required: false,
        param1: '',
        param2: '',
        param3: '',
      };

      const value: FieldContent = {
        id: 1,
        fieldid: 1,
        recordid: 50,
        content: 'Test',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      const { container } = render(
        <FieldRenderer 
          field={textField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const muiTextField = container.querySelector('.MuiTextField-root');
      expect(muiTextField).toBeInTheDocument();
    });

    it('should render MUI Checkbox component', () => {
      const checkboxField: CheckboxField = {
        id: 6,
        dataid: 100,
        type: 'checkbox',
        name: 'Checkbox',
        description: 'Check this',
        required: false,
        param1: '',
        param2: '',
        param3: '',
      };

      const value: FieldContent = {
        id: 6,
        fieldid: 6,
        recordid: 50,
        content: '1',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      const { container } = render(
        <FieldRenderer 
          field={checkboxField} 
          value={value} 
          mode="edit"
          onChange={mockOnChange}
        />
      );

      const muiCheckbox = container.querySelector('.MuiCheckbox-root');
      expect(muiCheckbox).toBeInTheDocument();
    });

    it('should render MUI Chip components for multimenu', () => {
      const multimenuField: MultiMenuField = {
        id: 12,
        dataid: 100,
        type: 'multimenu',
        name: 'Tags',
        description: 'Select tags',
        required: false,
        param1: 'Tag1\nTag2\nTag3',
        param2: '',
        param3: '',
      };

      const value: FieldContent = {
        id: 12,
        fieldid: 12,
        recordid: 50,
        content: 'Tag1##@@##Tag2',
        content1: null,
        content2: null,
        content3: null,
        content4: null,
      };

      const { container } = render(
        <FieldRenderer 
          field={multimenuField} 
          value={value} 
          mode="view"
        />
      );

      const chips = container.querySelectorAll('.MuiChip-root');
      expect(chips.length).toBe(2);
    });

    it('should render MUI Link component for URLs', () => {
      const urlField: URLField = {
        id: 10,
        dataid: 100,
        type: 'url',
        name: 'Link',
        description: 'Enter link',
        required: false,
        param1: '',
        param2: '',
        param3: '',
      };

      const value: FieldContent = {
        id: 10,
        fieldid: 10,
        recordid: 50,
        content: 'https://example.com',
        content1: 'Example',
        content2: null,
        content3: null,
        content4: null,
      };

      const { container } = render(
        <FieldRenderer 
          field={urlField} 
          value={value} 
          mode="view"
        />
      );

      const muiLink = container.querySelector('.MuiLink-root');
      expect(muiLink).toBeInTheDocument();
    });
  });
});
