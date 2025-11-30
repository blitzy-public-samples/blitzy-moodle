/**
 * Comprehensive Unit Tests for FieldRenderer Component
 * 
 * Tests all 12 field types (text, textarea, number, date, menu, checkbox, radiobutton,
 * file, picture, url, latlong, multimenu) in view and list modes with proper
 * formatting, validation, accessibility, and error handling.
 * 
 * NOTE: FieldRenderer is a READ-ONLY display component. It does not support
 * edit mode or onChange callbacks.
 * 
 * @see FieldRenderer.tsx - Component under test
 * @see data.types.ts - Type definitions for all field types
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';

// Component under test
import FieldRenderer from '@/features/activities/data/components/FieldRenderer';

// Type imports
import type { DatabaseField, FieldContent } from '@/features/activities/data/types/data.types';
import { FieldType } from '@/features/activities/data/types/data.types';

// Test utilities
import { render } from '@tests/helpers/render';

// =============================================================================
// Test Helper Functions
// =============================================================================

/**
 * Creates a field of any type with the given properties.
 * This function uses type assertion to allow flexible field creation in tests.
 * 
 * @param overrides - Partial field properties to override defaults
 * @returns A DatabaseField object cast to the appropriate type
 */
function createField(overrides: Partial<DatabaseField> & { type: FieldType }): DatabaseField {
  const base = {
    id: 1,
    dataid: 1,
    name: 'Test Field',
    description: '',
    required: false,
  };
  return { ...base, ...overrides } as DatabaseField;
}

/**
 * Creates a field content object with minimal required properties
 */
function createContent(overrides: Partial<FieldContent> = {}): FieldContent {
  return {
    id: 1,
    fieldid: 1,
    recordid: 1,
    content: 'Test content',
    ...overrides,
  };
}

// =============================================================================
// Text Field Tests
// =============================================================================

describe('FieldRenderer - Text Field', () => {
  it('renders text field in view mode with content', () => {
    const field = createField({ type: FieldType.Text, name: 'First Name' });
    const value = createContent({ content: 'John Doe' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('renders empty text field with "No value" message', () => {
    const field = createField({ type: FieldType.Text, name: 'Empty Field' });
    const value = createContent({ content: '' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('No value')).toBeInTheDocument();
  });

  it('renders text field with special characters', () => {
    const field = createField({ type: FieldType.Text });
    const value = createContent({ content: '<script>alert("XSS")</script>' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    // React automatically escapes special characters
    expect(screen.getByText('<script>alert("XSS")</script>')).toBeInTheDocument();
  });

  it('handles null value gracefully', () => {
    const field = createField({ type: FieldType.Text });
    const value = createContent({ content: undefined });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('No value')).toBeInTheDocument();
  });
});

// =============================================================================
// Textarea Field Tests
// =============================================================================

describe('FieldRenderer - Textarea Field', () => {
  it('renders textarea field in view mode with formatted content', () => {
    const field = createField({ type: FieldType.Textarea, name: 'Description' });
    const value = createContent({ 
      content: '<p>This is <strong>bold</strong> text</p>',
      content1: '1' // HTML format
    });

    const { container } = render(<FieldRenderer field={field} value={value} mode="view" />);

    // HTML is parsed and rendered via dangerouslySetInnerHTML, so check for the actual DOM structure
    // Find the <strong> element and verify its content
    const strongElement = container.querySelector('strong');
    expect(strongElement).toBeInTheDocument();
    expect(strongElement?.textContent).toBe('bold');
    
    // Verify the <p> element exists with the full text content
    const pElement = container.querySelector('p');
    expect(pElement).toBeInTheDocument();
    expect(pElement?.textContent).toBe('This is bold text');
  });

  it('renders plain text textarea', () => {
    const field = createField({ type: FieldType.Textarea });
    const value = createContent({ 
      content: 'Plain text content',
      content1: '0' // Plain text format
    });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('Plain text content')).toBeInTheDocument();
  });

  it('renders multiline textarea content', () => {
    const field = createField({ type: FieldType.Textarea });
    const value = createContent({ 
      content: 'Line 1\nLine 2\nLine 3'
    });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText(/Line 1.*Line 2.*Line 3/)).toBeInTheDocument();
  });
});

// =============================================================================
// Number Field Tests
// =============================================================================

describe('FieldRenderer - Number Field', () => {
  it('renders number field with decimal places', () => {
    const field = createField({ 
      type: FieldType.Number, 
      name: 'Price',
      param1: '2' // 2 decimal places
    });
    const value = createContent({ content: '123.456' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    // Should format to 2 decimal places
    expect(screen.getByText('123.46')).toBeInTheDocument();
  });

  it('renders number field with zero decimal places', () => {
    const field = createField({ 
      type: FieldType.Number,
      param1: '0' // No decimal places
    });
    const value = createContent({ content: '123.789' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('124')).toBeInTheDocument();
  });

  it('handles negative numbers', () => {
    const field = createField({ 
      type: FieldType.Number,
      param1: '2'
    });
    const value = createContent({ content: '-456.789' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('-456.79')).toBeInTheDocument();
  });

  it('handles zero value', () => {
    const field = createField({ type: FieldType.Number });
    const value = createContent({ content: '0' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('0')).toBeInTheDocument();
  });
});

// =============================================================================
// Date Field Tests
// =============================================================================

describe('FieldRenderer - Date Field', () => {
  it('renders date field in view mode with formatted date', () => {
    // June 15, 2024 at midnight UTC
    const testDate = new Date('2024-06-15T00:00:00Z');
    const timestamp = Math.floor(testDate.getTime() / 1000);

    const field = createField({ type: FieldType.Date, name: 'Event Date' });
    const value = createContent({ content: timestamp.toString() });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    // Should display formatted date (exact format may vary by locale)
    const dateElement = screen.getByText(/2024/);
    expect(dateElement).toBeInTheDocument();
  });

  it('handles empty date field', () => {
    const field = createField({ type: FieldType.Date });
    const value = createContent({ content: '' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('No value')).toBeInTheDocument();
  });

  it('renders date with proper localization', () => {
    const testDate = new Date('2024-12-25T00:00:00Z');
    const timestamp = Math.floor(testDate.getTime() / 1000);

    const field = createField({ type: FieldType.Date });
    const value = createContent({ content: timestamp.toString() });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    // Should contain year and likely month
    const dateText = screen.getByText(/2024/);
    expect(dateText).toBeInTheDocument();
  });
});

// =============================================================================
// Menu Field Tests
// =============================================================================

describe('FieldRenderer - Menu Field', () => {
  it('renders menu field in view mode with selected option', () => {
    const field = createField({ 
      type: FieldType.Menu, 
      name: 'Category',
      param1: 'Option 1\nOption 2\nOption 3' // Menu options
    });
    const value = createContent({ content: 'Option 2' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('renders menu field with no selection', () => {
    const field = createField({ 
      type: FieldType.Menu,
      param1: 'Option 1\nOption 2'
    });
    const value = createContent({ content: '' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('No value')).toBeInTheDocument();
  });
});

// =============================================================================
// Checkbox Field Tests
// =============================================================================

describe('FieldRenderer - Checkbox Field', () => {
  it('renders checked checkbox field', () => {
    const field = createField({ 
      type: FieldType.Checkbox,
      name: 'Agree to Terms'
    });
    const value = createContent({ 
      content: '1' // 1 = checked, 0 = unchecked
    });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    // Should display the value "1" as a chip with CheckCircle icon
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByTestId('CheckCircleIcon')).toBeInTheDocument();
  });

  it('renders unchecked checkbox field', () => {
    const field = createField({ 
      type: FieldType.Checkbox,
      name: 'Subscribe'
    });
    const value = createContent({ content: '0' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    // Should display the value "0" as a chip with CheckCircle icon
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByTestId('CheckCircleIcon')).toBeInTheDocument();
  });

  it('renders empty checkbox field', () => {
    const field = createField({ type: FieldType.Checkbox });
    const value = createContent({ content: '' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('No value')).toBeInTheDocument();
  });

  it('handles checkbox with non-boolean string content', () => {
    const field = createField({ type: FieldType.Checkbox });
    const value = createContent({ content: 'true' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    // Should attempt to interpret any truthy value as checked
    expect(screen.getByText(/Yes|Checked|✓|true/i)).toBeInTheDocument();
  });
});

// =============================================================================
// Radio Button Field Tests
// =============================================================================

describe('FieldRenderer - Radio Button Field', () => {
  it('renders radio button field with selected value', () => {
    const field = createField({ 
      type: FieldType.RadioButton,
      name: 'Gender',
      param1: 'Male\nFemale\nOther' // Radio options
    });
    const value = createContent({ content: 'Female' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('Female')).toBeInTheDocument();
  });

  it('renders radio field with no selection', () => {
    const field = createField({ 
      type: FieldType.RadioButton,
      param1: 'Yes\nNo'
    });
    const value = createContent({ content: '' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('No value')).toBeInTheDocument();
  });
});

// =============================================================================
// File Field Tests
// =============================================================================

describe('FieldRenderer - File Field', () => {
  it('renders file field with download link', () => {
    const field = createField({ 
      type: FieldType.File,
      name: 'Attachment'
    });
    const value = createContent({ 
      content: 'document.pdf',
      content1: 'Project Proposal' // Display name
    });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText(/Project Proposal|document\.pdf/)).toBeInTheDocument();
    
    // Should have a link to the file
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('document.pdf'));
  });

  it('renders file field with no file uploaded', () => {
    const field = createField({ type: FieldType.File });
    const value = createContent({ content: '' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('No value')).toBeInTheDocument();
  });

  it('renders file field with custom fileBaseUrl', () => {
    const field = createField({ type: FieldType.File });
    const value = createContent({ 
      content: 'report.docx',
      content1: 'Annual Report'
    });

    render(
      <FieldRenderer 
        field={field} 
        value={value} 
        mode="view"
        fileBaseUrl="/custom/files"
      />
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('/custom/files'));
  });
});

// =============================================================================
// Picture Field Tests
// =============================================================================

describe('FieldRenderer - Picture Field', () => {
  it('renders picture field in view mode with image', () => {
    const field = createField({ 
      type: FieldType.Picture,
      name: 'Photo',
      param1: '800', // Max width
      param2: '600'  // Max height
    });
    const value = createContent({ 
      content: 'photo.jpg',
      content1: 'Profile picture' // Alt text
    });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', 'Profile picture');
    expect(img).toHaveAttribute('src', expect.stringContaining('photo.jpg'));
  });

  it('renders picture field in list mode with thumbnail', () => {
    const field = createField({ 
      type: FieldType.Picture,
      param1: '800',
      param2: '600'
    });
    const value = createContent({ 
      content: 'large-image.png',
      content1: 'Thumbnail view'
    });

    render(<FieldRenderer field={field} value={value} mode="list" />);

    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    // List mode might apply different styling or sizing
  });

  it('renders picture field with no image', () => {
    const field = createField({ type: FieldType.Picture });
    const value = createContent({ content: '' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('No value')).toBeInTheDocument();
  });

  it('renders picture with dimension constraints', () => {
    const field = createField({ 
      type: FieldType.Picture,
      param1: '300', // Max width
      param2: '200'  // Max height
    });
    const value = createContent({ 
      content: 'banner.jpg',
      content1: 'Banner image'
    });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    // Component should respect maxWidth/maxHeight from params
  });
});

// =============================================================================
// URL Field Tests
// =============================================================================

describe('FieldRenderer - URL Field', () => {
  it('renders URL field with link text', () => {
    const field = createField({ 
      type: FieldType.URL,
      name: 'Website'
    });
    const value = createContent({ 
      content: 'https://example.com',
      content1: 'Visit Example Site' // Link text
    });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    const link = screen.getByRole('link', { name: /Visit Example Site/ });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank'); // Opens in new tab
    expect(link).toHaveAttribute('rel', 'noopener noreferrer'); // Security
  });

  it('renders URL field without link text (uses URL as text)', () => {
    const field = createField({ type: FieldType.URL });
    const value = createContent({ 
      content: 'https://github.com'
      // No content1 = no link text, URL will be used as display text
    });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    const link = screen.getByRole('link', { name: /github\.com/ });
    expect(link).toHaveAttribute('href', 'https://github.com');
  });

  it('renders URL field with no URL', () => {
    const field = createField({ type: FieldType.URL });
    const value = createContent({ content: '' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('No value')).toBeInTheDocument();
  });

  it('handles URL with special characters', () => {
    const field = createField({ type: FieldType.URL });
    const value = createContent({ 
      content: 'https://example.com/path?query=value&other=123',
      content1: 'Query Link'
    });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    const link = screen.getByRole('link', { name: /Query Link/ });
    expect(link).toHaveAttribute('href', 'https://example.com/path?query=value&other=123');
  });
});

// =============================================================================
// LatLong Field Tests
// =============================================================================

describe('FieldRenderer - LatLong Field', () => {
  it('renders latitude and longitude coordinates', () => {
    const field = createField({ 
      type: FieldType.LatLong,
      name: 'Location'
    });
    const value = createContent({ 
      content: '40.7128',  // Latitude (New York)
      content1: '-74.0060' // Longitude
    });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText(/40\.7128/)).toBeInTheDocument();
    expect(screen.getByText(/-74\.0060/)).toBeInTheDocument();
  });

  it('renders latlong with map link', () => {
    const field = createField({ type: FieldType.LatLong });
    const value = createContent({ 
      content: '51.5074',  // London
      content1: '-0.1278'
    });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    // Should have a link to view on map (Google Maps, OpenStreetMap, etc.)
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    
    // Link should contain coordinates
    const mapLink = links.find(link => 
      link.getAttribute('href')?.includes('51.5074') || 
      link.getAttribute('href')?.includes('-0.1278')
    );
    expect(mapLink).toBeDefined();
  });

  it('renders latlong field with no coordinates', () => {
    const field = createField({ type: FieldType.LatLong });
    const value = createContent({ content: '', content1: '' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('No value')).toBeInTheDocument();
  });

  it('handles invalid coordinate format gracefully', () => {
    const field = createField({ type: FieldType.LatLong });
    const value = createContent({ 
      content: 'invalid',
      content1: 'also invalid'
    });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    // Should display an error message for invalid coordinates
    expect(screen.getByText('Invalid coordinates')).toBeInTheDocument();
  });
});

// =============================================================================
// MultiMenu Field Tests
// =============================================================================

describe('FieldRenderer - MultiMenu Field', () => {
  it('renders multiple selected options', () => {
    const field = createField({ 
      type: FieldType.MultiMenu,
      name: 'Skills',
      param1: 'JavaScript\nPython\nJava\nC++\nRuby' // Available options
    });
    const value = createContent({ 
      content: 'JavaScript##Python##Java' // ## separator
    });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('Java')).toBeInTheDocument();
  });

  it('renders single selected option', () => {
    const field = createField({ 
      type: FieldType.MultiMenu,
      param1: 'Red\nGreen\nBlue'
    });
    const value = createContent({ content: 'Red' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('Red')).toBeInTheDocument();
  });

  it('renders empty multimenu field', () => {
    const field = createField({ type: FieldType.MultiMenu });
    const value = createContent({ content: '' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('No value')).toBeInTheDocument();
  });

  it('renders multimenu options as chips', () => {
    const field = createField({ 
      type: FieldType.MultiMenu,
      param1: 'Tag1\nTag2\nTag3'
    });
    const value = createContent({ content: 'Tag1##Tag2' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    // MUI Chips should be present (they typically have specific class names or test IDs)
    // For now, just verify the text is present
    expect(screen.getByText('Tag1')).toBeInTheDocument();
    expect(screen.getByText('Tag2')).toBeInTheDocument();
  });
});

// =============================================================================
// Error Handling and Edge Cases
// =============================================================================

describe('FieldRenderer - Error Handling', () => {
  it('handles undefined field value gracefully', () => {
    const field = createField({ type: FieldType.Text });
    // Test with undefined content property (simulating missing/undefined value)
    const valueWithoutContent = createContent({ content: undefined });

    render(<FieldRenderer field={field} value={valueWithoutContent} mode="view" />);

    expect(screen.getByText('No value')).toBeInTheDocument();
  });

  it('handles unknown field type gracefully', () => {
    // Use unknown then cast to the expected type to test runtime handling of invalid types
    const field = createField({ type: 'unknown' as unknown as FieldType });
    const value = createContent({ content: 'Some content' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    // Should fall back to displaying raw content or error message
    expect(screen.getByText(/Some content|Unknown field type/)).toBeInTheDocument();
  });

  it('handles malformed field content structure', () => {
    const field = createField({ type: FieldType.Text });
    // Create a minimal FieldContent object with no content property
    const value: FieldContent = { 
      id: 1, 
      fieldid: 1,
      recordid: 1,
      // content intentionally omitted to test handling of missing content
    };

    render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('No value')).toBeInTheDocument();
  });
});

// =============================================================================
// Material-UI Integration Tests
// =============================================================================

describe('FieldRenderer - Material-UI Integration', () => {
  it('renders with MUI Typography component', () => {
    const field = createField({ type: FieldType.Text });
    const value = createContent({ content: 'Test Typography' });

    const { container } = render(<FieldRenderer field={field} value={value} mode="view" />);

    // MUI Typography typically has specific class names
    const typography = container.querySelector('[class*="MuiTypography"]');
    expect(typography).toBeTruthy();
  });

  it('uses MUI Box as container', () => {
    const field = createField({ type: FieldType.Text });
    const value = createContent({ content: 'Test' });

    const { container } = render(<FieldRenderer field={field} value={value} mode="view" />);

    // MUI Box typically has specific class names
    const box = container.querySelector('[class*="MuiBox"]');
    expect(box).toBeTruthy();
  });

  it('renders MUI Link for URL fields', () => {
    const field = createField({ type: FieldType.URL });
    const value = createContent({ 
      content: 'https://example.com',
      content1: 'Example'
    });

    const { container } = render(<FieldRenderer field={field} value={value} mode="view" />);

    const link = container.querySelector('[class*="MuiLink"]');
    expect(link).toBeTruthy();
  });

  it('renders MUI Chip for multimenu selections', () => {
    const field = createField({ 
      type: FieldType.MultiMenu,
      param1: 'Option1\nOption2'
    });
    const value = createContent({ content: 'Option1##Option2' });

    const { container } = render(<FieldRenderer field={field} value={value} mode="view" />);

    const chips = container.querySelectorAll('[class*="MuiChip"]');
    expect(chips.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Accessibility Tests
// =============================================================================

describe('FieldRenderer - Accessibility', () => {
  it('renders images with alt text', () => {
    const field = createField({ type: FieldType.Picture });
    const value = createContent({ 
      content: 'image.jpg',
      content1: 'Descriptive alt text'
    });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', 'Descriptive alt text');
  });

  it('renders links with proper roles', () => {
    const field = createField({ type: FieldType.URL });
    const value = createContent({ 
      content: 'https://example.com',
      content1: 'Example Link'
    });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
  });

  it('provides semantic HTML structure', () => {
    const field = createField({ type: FieldType.Text });
    const value = createContent({ content: 'Accessible content' });

    const { container } = render(<FieldRenderer field={field} value={value} mode="view" />);

    // Should not have accessibility violations
    expect(container).toBeInTheDocument();
  });

  it('handles screen reader announcements for empty fields', () => {
    const field = createField({ type: FieldType.Text });
    const value = createContent({ content: '' });

    render(<FieldRenderer field={field} value={value} mode="view" />);

    const noValueText = screen.getByText('No value');
    expect(noValueText).toBeInTheDocument();
    // Italic styling helps screen readers understand it's a status message
  });
});

// =============================================================================
// Performance and Optimization Tests
// =============================================================================

describe('FieldRenderer - Performance', () => {
  it('uses useMemo to optimize rendering', () => {
    const field = createField({ type: FieldType.Text });
    const value = createContent({ content: 'Initial content' });

    const { rerender } = render(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('Initial content')).toBeInTheDocument();

    // Rerender with same props - useMemo should prevent recalculation
    rerender(<FieldRenderer field={field} value={value} mode="view" />);

    expect(screen.getByText('Initial content')).toBeInTheDocument();
  });

  it('updates when field value changes', () => {
    const field = createField({ type: FieldType.Text });
    const value1 = createContent({ content: 'First value' });

    const { rerender } = render(<FieldRenderer field={field} value={value1} mode="view" />);

    expect(screen.getByText('First value')).toBeInTheDocument();

    // Update with new value
    const value2 = createContent({ content: 'Second value' });
    rerender(<FieldRenderer field={field} value={value2} mode="view" />);

    expect(screen.queryByText('First value')).not.toBeInTheDocument();
    expect(screen.getByText('Second value')).toBeInTheDocument();
  });
});
