/**
 * FieldRenderer Component for Database Activity Module
 *
 * Renders database field values based on their field type with type-specific
 * formatting and display logic. Supports all 12 Moodle database field types:
 * text, textarea, number, date, menu, checkbox, radiobutton, file, picture,
 * url, latlong, and multimenu.
 *
 * This component replicates the display logic from Moodle's PHP field classes,
 * specifically the display_browse_field() methods found in:
 * - public/mod/data/field/text/field.class.php
 * - public/mod/data/field/textarea/field.class.php
 * - public/mod/data/field/number/field.class.php
 * - public/mod/data/field/date/field.class.php
 * - public/mod/data/field/menu/field.class.php
 * - public/mod/data/field/checkbox/field.class.php
 * - public/mod/data/field/radiobutton/field.class.php
 * - public/mod/data/field/file/field.class.php
 * - public/mod/data/field/picture/field.class.php
 * - public/mod/data/field/url/field.class.php
 * - public/mod/data/field/latlong/field.class.php
 * - public/mod/data/field/multimenu/field.class.php
 *
 * @package    react-frontend
 * @subpackage features/activities/data
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import type React from 'react';
import { useMemo } from 'react';
import {
  Typography,
  Box,
  Link,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle,
  AttachFile,
  Image as ImageIcon,
  LocationOn,
  OpenInNew,
} from '@mui/icons-material';
import { format } from 'date-fns';

// Internal imports
import type {
  DatabaseField,
  FieldContent,
} from '../types/data.types';
import { FieldType } from '../types/data.types';
import { formatNumber } from '@/utils/formatters';

// ============================================================================
// Component Props Interface
// ============================================================================

/**
 * Props for the FieldRenderer component
 */
interface FieldRendererProps {
  /**
   * Field definition containing type, name, and configuration parameters
   */
  field: DatabaseField;

  /**
   * Field content value(s) from mdl_data_content table
   * Different field types use different content fields:
   * - text: content
   * - textarea: content (HTML), content1 (format)
   * - number: content
   * - date: content (Unix timestamp)
   * - menu: content (selected option)
   * - checkbox: content (multiple selections separated by ##)
   * - radiobutton: content (selected option)
   * - file: content (filename), content1 (display name)
   * - picture: content (filename), content1 (alt text)
   * - url: content (URL), content1 (link text)
   * - latlong: content (latitude), content1 (longitude)
   * - multimenu: content (multiple selections separated by ##)
   */
  value: FieldContent;

  /**
   * Display mode for rendering
   * - 'view': Read-only display (browse mode)
   * - 'list': Compact display for list view (may show thumbnails for images)
   */
  mode?: 'view' | 'list';

  /**
   * Base URL for file downloads and image sources
   * Used to construct file URLs for file and picture fields
   */
  fileBaseUrl?: string;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * FieldRenderer Component
 *
 * Renders database field values with type-specific formatting. Uses useMemo
 * to optimize performance by preventing unnecessary recalculations when field
 * definition or value haven't changed.
 *
 * @param props - Component props
 * @returns Rendered field value
 */
function FieldRenderer({
  field,
  value,
  mode = 'view',
  fileBaseUrl = '/api/v1/files/download',
}: FieldRendererProps): React.ReactElement {
  /**
   * Memoized field rendering logic based on field type
   * Prevents unnecessary recalculations on re-renders
   */
  const renderedContent = useMemo(() => {
    // Handle empty or null values
    if (!value || (!value.content && value.content !== '0')) {
      return (
        <Typography variant="body2" color="text.secondary" fontStyle="italic">
          No value
        </Typography>
      );
    }

    // Render based on field type
    switch (field.type) {
      case FieldType.Text:
        return renderTextField(value);

      case FieldType.Textarea:
        return renderTextareaField(value);

      case FieldType.Number:
        return renderNumberField(field, value);

      case FieldType.Date:
        return renderDateField(value);

      case FieldType.Menu:
        return renderMenuField(value);

      case FieldType.Checkbox:
        return renderCheckboxField(value);

      case FieldType.RadioButton:
        return renderRadioButtonField(value);

      case FieldType.File:
        return renderFileField(value, fileBaseUrl);

      case FieldType.Picture:
        return renderPictureField(field, value, mode, fileBaseUrl);

      case FieldType.URL:
        return renderUrlField(field, value);

      case FieldType.LatLong:
        return renderLatLongField(field, value);

      case FieldType.MultiMenu:
        return renderMultiMenuField(value);

      default:
        // Fallback for unknown field types
        return (
          <Typography variant="body2" color="text.secondary">
            {value.content || 'Unknown field type'}
          </Typography>
        );
    }
  }, [field, value, mode, fileBaseUrl]);

  return <Box>{renderedContent}</Box>;
}

// ============================================================================
// Field Type Rendering Functions
// ============================================================================

/**
 * Render text field
 * Simple text display with the content value
 *
 * PHP Reference: public/mod/data/field/text/field.class.php
 * Uses default display_browse_field() from base class - just displays content
 *
 * @param value - Field content
 * @returns Rendered text
 */
function renderTextField(value: FieldContent): React.ReactNode {
  return (
    <Typography variant="body2" component="span">
      {value.content}
    </Typography>
  );
}

/**
 * Render textarea field
 * Rich text content with HTML formatting support
 *
 * PHP Reference: public/mod/data/field/textarea/field.class.php
 * display_browse_field() method shows:
 * - content: HTML content
 * - content1: Format type
 * - Uses format_text() for rendering with proper format handling
 *
 * Note: In React, we use dangerouslySetInnerHTML for HTML content.
 * In production, this should be sanitized server-side.
 *
 * @param value - Field content
 * @returns Rendered textarea content
 */
function renderTextareaField(value: FieldContent): React.ReactNode {
  const content = value.content ?? '';
  const format = value.content1 ?? '0';

  // Format types: 0=MOODLE, 1=HTML, 2=PLAIN, 4=MARKDOWN
  // For React display, we treat formats 0, 1, and 4 as HTML-capable
  if (format === '2') {
    // Plain text format - display as preformatted text
    return (
      <Typography
        variant="body2"
        component="pre"
        sx={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'inherit',
          margin: 0,
        }}
      >
        {content}
      </Typography>
    );
  }

  // HTML or formatted text - render with HTML support
  // Note: Content should be sanitized on the server before reaching here
  return (
    <Box
      sx={{
        '& p:first-of-type': { marginTop: 0 },
        '& p:last-of-type': { marginBottom: 0 },
      }}
    >
      <Typography
        variant="body2"
        component="div"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </Box>
  );
}

/**
 * Render number field
 * Formatted number with configurable decimal places
 *
 * PHP Reference: public/mod/data/field/number/field.class.php
 * display_browse_field() method shows:
 * - content: Numeric value
 * - param1: Number of decimal places (0-10)
 * - Uses number_format() for display
 *
 * @param field - Field definition with param1 for decimal places
 * @param value - Field content
 * @returns Rendered number
 */
function renderNumberField(
  field: DatabaseField,
  value: FieldContent
): React.ReactNode {
  const numValue = parseFloat(value.content ?? '0');

  // Handle invalid numbers
  if (isNaN(numValue)) {
    return (
      <Typography variant="body2" color="text.secondary">
        Invalid number
      </Typography>
    );
  }

  // Get decimal places from param1 (default to 0)
  const decimals = parseInt(
    (field as { param1?: string }).param1 ?? '0',
    10
  );

  try {
    const formattedNumber = formatNumber(numValue, decimals);
    return (
      <Typography variant="body2" component="span">
        {formattedNumber}
      </Typography>
    );
  } catch (error) {
    // Fallback if formatting fails
    return (
      <Typography variant="body2" component="span">
        {numValue.toFixed(decimals)}
      </Typography>
    );
  }
}

/**
 * Render date field
 * Formatted date from Unix timestamp
 *
 * PHP Reference: public/mod/data/field/date/field.class.php
 * display_browse_field() method shows:
 * - content: Unix timestamp
 * - Uses userdate() for locale-aware formatting
 *
 * @param value - Field content with Unix timestamp
 * @returns Rendered date
 */
function renderDateField(value: FieldContent): React.ReactNode {
  const timestamp = parseInt(value.content ?? '0', 10);

  // Handle invalid or zero timestamps
  if (!timestamp || timestamp <= 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No date
      </Typography>
    );
  }

  try {
    // Convert Unix timestamp to Date object (multiply by 1000 for milliseconds)
    const date = new Date(timestamp * 1000);

    // Format date using date-fns with user-friendly format
    const formattedDate = format(date, 'MMM dd, yyyy');

    return (
      <Typography variant="body2" component="span">
        {formattedDate}
      </Typography>
    );
  } catch (error) {
    return (
      <Typography variant="body2" color="error">
        Invalid date
      </Typography>
    );
  }
}

/**
 * Render menu field (single select dropdown)
 * Displays selected option as a chip
 *
 * PHP Reference: public/mod/data/field/menu/field.class.php
 * Uses default display_browse_field() from base class - just displays content
 *
 * @param value - Field content with selected option
 * @returns Rendered menu selection
 */
function renderMenuField(value: FieldContent): React.ReactNode {
  return (
    <Chip
      label={value.content}
      size="small"
      color="primary"
      variant="outlined"
    />
  );
}

/**
 * Render checkbox field
 * Multiple selections displayed as chips
 *
 * PHP Reference: public/mod/data/field/checkbox/field.class.php
 * display_browse_field() method shows:
 * - content: Selected options separated by ##
 * - Displays each option on a new line
 *
 * @param value - Field content with ## separated selections
 * @returns Rendered checkbox selections
 */
function renderCheckboxField(value: FieldContent): React.ReactNode {
  const content = value.content ?? '';

  // Split by ## separator
  const selections = content.split('##').filter((item) => item.trim() !== '');

  if (selections.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" fontStyle="italic">
        None selected
      </Typography>
    );
  }

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {selections.map((selection) => (
        <Chip
          key={selection}
          icon={<CheckCircle />}
          label={selection}
          size="small"
          color="success"
          variant="outlined"
        />
      ))}
    </Stack>
  );
}

/**
 * Render radio button field
 * Single selected option displayed as text
 *
 * PHP Reference: public/mod/data/field/radiobutton/field.class.php
 * Uses default display_browse_field() from base class - just displays content
 *
 * @param value - Field content with selected option
 * @returns Rendered radio button selection
 */
function renderRadioButtonField(value: FieldContent): React.ReactNode {
  return (
    <Typography variant="body2" component="span">
      {value.content}
    </Typography>
  );
}

/**
 * Render file field
 * File download link with file icon
 *
 * PHP Reference: public/mod/data/field/file/field.class.php
 * display_browse_field() method shows:
 * - content: Filename
 * - content1: Optional display name
 * - Renders as download link with file icon
 *
 * @param value - Field content with filename and optional display name
 * @param fileBaseUrl - Base URL for file downloads
 * @returns Rendered file link
 */
function renderFileField(
  value: FieldContent,
  fileBaseUrl: string
): React.ReactNode {
  const filename = value.content ?? '';
  const displayName = value.content1 ?? filename;

  if (!filename) {
    return (
      <Typography variant="body2" color="text.secondary" fontStyle="italic">
        No file
      </Typography>
    );
  }

  // Construct file URL
  const fileUrl = `${fileBaseUrl}/${encodeURIComponent(filename)}`;

  return (
    <Link
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        textDecoration: 'none',
        '&:hover': {
          textDecoration: 'underline',
        },
      }}
    >
      <AttachFile fontSize="small" />
      <Typography variant="body2">{displayName}</Typography>
      <OpenInNew fontSize="small" sx={{ ml: 0.5, opacity: 0.7 }} />
    </Link>
  );
}

/**
 * Render picture field
 * Image display with alt text and configurable dimensions
 *
 * PHP Reference: public/mod/data/field/picture/field.class.php
 * display_browse_field() method shows:
 * - content: Filename
 * - content1: Alt text
 * - param1: Width for single view (pixels)
 * - param2: Height for single view (pixels)
 * - param4: Width for list view (pixels)
 * - param5: Height for list view (pixels)
 * - In list view, displays thumbnail with thumb_ prefix
 *
 * @param field - Field definition with dimension parameters
 * @param value - Field content with filename and alt text
 * @param mode - Display mode (view or list)
 * @param fileBaseUrl - Base URL for image files
 * @returns Rendered image
 */
function renderPictureField(
  field: DatabaseField,
  value: FieldContent,
  mode: 'view' | 'list',
  fileBaseUrl: string
): React.ReactNode {
  const filename = value.content ?? '';
  const altText = value.content1 ?? 'Image';

  if (!filename) {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          color: 'text.secondary',
        }}
      >
        <ImageIcon fontSize="small" />
        <Typography variant="body2" fontStyle="italic">
          No image
        </Typography>
      </Box>
    );
  }

  // Get dimensions based on mode
  const fieldParams = field as {
    param1?: string;
    param2?: string;
    param4?: string;
    param5?: string;
  };

  let width: number | undefined;
  let height: number | undefined;
  let imageFilename = filename;

  if (mode === 'list') {
    // List view: use param4/param5 and thumbnail
    width = fieldParams.param4 ? parseInt(fieldParams.param4, 10) : undefined;
    height = fieldParams.param5 ? parseInt(fieldParams.param5, 10) : undefined;

    // Use thumbnail version (thumb_ prefix)
    imageFilename = `thumb_${filename}`;
  } else {
    // Single view: use param1/param2
    width = fieldParams.param1 ? parseInt(fieldParams.param1, 10) : undefined;
    height = fieldParams.param2 ? parseInt(fieldParams.param2, 10) : undefined;
  }

  // Construct image URL
  const imageUrl = `${fileBaseUrl}/${encodeURIComponent(imageFilename)}`;

  return (
    <Box
      component="img"
      src={imageUrl}
      alt={altText}
      sx={{
        maxWidth: width ?? '100%',
        maxHeight: height,
        width: width ? `${width}px` : 'auto',
        height: height ? `${height}px` : 'auto',
        display: 'block',
        objectFit: 'contain',
      }}
    />
  );
}

/**
 * Render URL field
 * Clickable link with customizable display text
 *
 * PHP Reference: public/mod/data/field/url/field.class.php
 * display_browse_field() method shows:
 * - content: URL
 * - content1: Link text (if provided)
 * - Renders as clickable link
 *
 * @param _field - Field definition (for future param support)
 * @param value - Field content with URL and optional link text
 * @returns Rendered URL link
 */
function renderUrlField(
  _field: DatabaseField,
  value: FieldContent
): React.ReactNode {
  const url = value.content ?? '';
  const linkText = value.content1 ?? url;

  if (!url) {
    return (
      <Typography variant="body2" color="text.secondary" fontStyle="italic">
        No URL
      </Typography>
    );
  }

  // Ensure URL has protocol
  const fullUrl = url.match(/^https?:\/\//i) ? url : `http://${url}`;

  return (
    <Link
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        textDecoration: 'none',
        '&:hover': {
          textDecoration: 'underline',
        },
      }}
    >
      <Typography variant="body2">{linkText}</Typography>
      <OpenInNew fontSize="small" sx={{ ml: 0.5, opacity: 0.7 }} />
    </Link>
  );
}

/**
 * Render latitude/longitude field
 * Geographic coordinates with map service links
 *
 * PHP Reference: public/mod/data/field/latlong/field.class.php
 * display_browse_field() method shows:
 * - content: Latitude
 * - content1: Longitude
 * - param1: Controls which map services to show links for
 * - Displays coordinates and optionally map links
 *
 * @param _field - Field definition (for future map link support)
 * @param value - Field content with latitude and longitude
 * @returns Rendered coordinates
 */
function renderLatLongField(
  _field: DatabaseField,
  value: FieldContent
): React.ReactNode {
  const latitude = value.content ?? '';
  const longitude = value.content1 ?? '';

  if (!latitude || !longitude) {
    return (
      <Typography variant="body2" color="text.secondary" fontStyle="italic">
        No coordinates
      </Typography>
    );
  }

  // Parse coordinates
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return (
      <Typography variant="body2" color="error">
        Invalid coordinates
      </Typography>
    );
  }

  // Format coordinates with proper precision
  const formattedLat = lat.toFixed(6);
  const formattedLng = lng.toFixed(6);

  // Construct Google Maps link
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title="View on map">
        <LocationOn fontSize="small" color="primary" />
      </Tooltip>
      <Link
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
        }}
      >
        <Typography variant="body2">
          {formattedLat}, {formattedLng}
        </Typography>
        <OpenInNew fontSize="small" sx={{ ml: 0.5, opacity: 0.7 }} />
      </Link>
    </Box>
  );
}

/**
 * Render multi-menu field (multiple select)
 * Multiple selections displayed as chips
 *
 * PHP Reference: public/mod/data/field/multimenu/field.class.php
 * display_browse_field() method shows:
 * - content: Selected options separated by ##
 * - Displays each option on a new line (similar to checkbox)
 *
 * @param value - Field content with ## separated selections
 * @returns Rendered multi-menu selections
 */
function renderMultiMenuField(value: FieldContent): React.ReactNode {
  const content = value.content ?? '';

  // Split by ## separator
  const selections = content.split('##').filter((item) => item.trim() !== '');

  if (selections.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" fontStyle="italic">
        None selected
      </Typography>
    );
  }

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {selections.map((selection) => (
        <Chip
          key={selection}
          label={selection}
          size="small"
          color="primary"
          variant="outlined"
        />
      ))}
    </Stack>
  );
}

// ============================================================================
// Export
// ============================================================================

export default FieldRenderer;
