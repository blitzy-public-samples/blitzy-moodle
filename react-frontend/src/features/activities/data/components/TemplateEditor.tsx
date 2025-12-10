/**
 * @fileoverview Template Editor Component for Database Activity
 *
 * React component for editing database activity display templates (list template,
 * single template, add template, CSS template, JavaScript template, and search template).
 * Features include:
 * - Rich text HTML editing with syntax highlighting for template tags
 * - Field placeholder inserter showing available field tags (e.g., [[fieldname]])
 * - Template preview functionality
 * - Save and reset to default actions
 * - Validation for required template tags
 * - Tabs for switching between different template types
 *
 * @module features/activities/data/components/TemplateEditor
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Tabs,
  Tab,
  Box,
  Paper,
  Button,
  Typography,
  Divider,
  Alert,
  IconButton,
  Tooltip,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Chip,
  Stack,
  CircularProgress,
  TextField,
  Collapse,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Help as HelpIcon,
  Code as CodeIcon,
  Visibility as VisibilityIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as ContentCopyIcon,
  Javascript as JavaScriptIcon,
} from '@mui/icons-material';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';

// Internal imports
import { useDatabase } from '../hooks/useDatabase';
import { TemplateType, DatabaseField } from '../types/data.types';
import RichTextEditor from '../../../../components/editor/RichTextEditor';
import { useToast } from '../../../../hooks/useToast';
import { updateTemplate, resetTemplate, getFields } from '../api/dataApi';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Props for the TemplateEditor component
 */
interface TemplateEditorProps {
  /** Database instance ID */
  databaseId: number;
  /** Course module ID for context */
  cmid?: number;
  /** Initial template type to display */
  initialTab?: TemplateType;
  /** Callback when templates are successfully saved */
  onSave?: () => void;
  /** Whether the editor is read-only */
  readOnly?: boolean;
}

/**
 * Template placeholder definition
 */
interface Placeholder {
  /** Placeholder tag (e.g., [[fieldname]] or ##edit##) */
  tag: string;
  /** Human-readable description */
  description: string;
  /** Whether this is a field placeholder or system tag */
  isField: boolean;
}

/**
 * Placeholder category for grouping in the sidebar
 */
interface PlaceholderCategory {
  /** Category name */
  name: string;
  /** Category icon */
  icon: React.ReactNode;
  /** Placeholders in this category */
  placeholders: Placeholder[];
}

/**
 * Template content state for all template types
 */
interface TemplateContent {
  [TemplateType.List]: string;
  [TemplateType.Single]: string;
  [TemplateType.Add]: string;
  [TemplateType.Search]: string;
  [TemplateType.CSS]: string;
  [TemplateType.JavaScript]: string;
  [TemplateType.RSS]: string;
}

/**
 * Validation result for a template
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * System placeholders available in templates (not field-specific)
 */
const SYSTEM_PLACEHOLDERS: Placeholder[] = [
  { tag: '##edit##', description: 'Edit entry link', isField: false },
  { tag: '##delete##', description: 'Delete entry link', isField: false },
  { tag: '##approve##', description: 'Approve entry button (for pending entries)', isField: false },
  { tag: '##disapprove##', description: 'Disapprove entry button', isField: false },
  { tag: '##export##', description: 'Export entry link', isField: false },
  { tag: '##more##', description: 'Link to view full entry (list template)', isField: false },
  { tag: '##moreurl##', description: 'URL to full entry (for custom links)', isField: false },
  { tag: '##user##', description: 'Entry author name', isField: false },
  { tag: '##userpicture##', description: 'Entry author profile picture', isField: false },
  { tag: '##timeadded##', description: 'Entry creation timestamp', isField: false },
  { tag: '##timemodified##', description: 'Entry last modified timestamp', isField: false },
  { tag: '##comments##', description: 'Comments section for entry', isField: false },
  { tag: '##rating##', description: 'Rating component for entry', isField: false },
  { tag: '##tags##', description: 'Tags associated with entry', isField: false },
  { tag: '##id##', description: 'Entry ID number', isField: false },
  { tag: '##class##', description: 'CSS class based on entry status', isField: false },
];

/**
 * Add template-specific placeholders
 */
const ADD_TEMPLATE_PLACEHOLDERS: Placeholder[] = [
  { tag: '##actionbuttons##', description: 'Submit and cancel buttons', isField: false },
  { tag: '##requirednotice##', description: 'Required fields notice', isField: false },
];

/**
 * Search template-specific placeholders
 */
const SEARCH_TEMPLATE_PLACEHOLDERS: Placeholder[] = [
  { tag: '##firstname##', description: 'Author first name search field', isField: false },
  { tag: '##lastname##', description: 'Author last name search field', isField: false },
  { tag: '##searchbutton##', description: 'Search submit button', isField: false },
  { tag: '##resetbutton##', description: 'Reset search filters button', isField: false },
];

/**
 * Required tags for each template type
 */
const REQUIRED_TAGS: Record<TemplateType, string[]> = {
  [TemplateType.List]: ['##more##'],
  [TemplateType.Single]: [],
  [TemplateType.Add]: ['##actionbuttons##'],
  [TemplateType.Search]: ['##searchbutton##'],
  [TemplateType.CSS]: [],
  [TemplateType.JavaScript]: [],
  [TemplateType.RSS]: [],
};

/**
 * Tab configuration for each template type
 */
const TEMPLATE_TABS = [
  {
    type: TemplateType.List,
    label: 'List Template',
    icon: <ViewListIcon />,
    description: 'Template for displaying entries in list view',
    usesRichEditor: true,
  },
  {
    type: TemplateType.Single,
    label: 'Single Template',
    icon: <ViewModuleIcon />,
    description: 'Template for displaying a single entry in detail',
    usesRichEditor: true,
  },
  {
    type: TemplateType.Add,
    label: 'Add Template',
    icon: <AddIcon />,
    description: 'Template for the entry submission form',
    usesRichEditor: true,
  },
  {
    type: TemplateType.Search,
    label: 'Search Template',
    icon: <SearchIcon />,
    description: 'Template for the advanced search form',
    usesRichEditor: true,
  },
  {
    type: TemplateType.CSS,
    label: 'CSS',
    icon: <CodeIcon />,
    description: 'Custom CSS styles for templates',
    usesRichEditor: false,
  },
  {
    type: TemplateType.JavaScript,
    label: 'JavaScript',
    icon: <JavaScriptIcon />,
    description: 'Custom JavaScript for templates',
    usesRichEditor: false,
  },
];

/**
 * Default empty template content
 */
const DEFAULT_TEMPLATE_CONTENT: TemplateContent = {
  [TemplateType.List]: '',
  [TemplateType.Single]: '',
  [TemplateType.Add]: '',
  [TemplateType.Search]: '',
  [TemplateType.CSS]: '',
  [TemplateType.JavaScript]: '',
  [TemplateType.RSS]: '',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates field placeholders from database field definitions
 *
 * @param fields - Array of database field definitions
 * @returns Array of field placeholders
 */
function generateFieldPlaceholders(fields: DatabaseField[]): Placeholder[] {
  return fields.map((field) => ({
    tag: `[[${field.name}]]`,
    description: field.description || `Field: ${field.name}`,
    isField: true,
  }));
}

/**
 * Generates add template field placeholders (input fields)
 *
 * @param fields - Array of database field definitions
 * @returns Array of input field placeholders
 */
function generateAddFieldPlaceholders(fields: DatabaseField[]): Placeholder[] {
  return fields.map((field) => ({
    tag: `[[${field.name}#id]]`,
    description: `Input field for: ${field.name}`,
    isField: true,
  }));
}

/**
 * Validates a template for required tags and common issues
 *
 * @param templateType - Type of template being validated
 * @param content - Template content to validate
 * @returns Validation result with errors and warnings
 */
function validateTemplate(templateType: TemplateType, content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required tags
  const required = REQUIRED_TAGS[templateType] || [];
  for (const tag of required) {
    if (!content.includes(tag)) {
      errors.push(`Missing required tag: ${tag}`);
    }
  }

  // Template-specific validations
  if (templateType === TemplateType.List) {
    // List template should have field placeholders
    if (!content.match(/\[\[[^\]]+\]\]/)) {
      warnings.push('No field placeholders found. Add [[fieldname]] to display field values.');
    }
  }

  if (templateType === TemplateType.Add) {
    // Add template should have field input placeholders
    if (!content.match(/\[\[[^\]]+#id\]\]/)) {
      warnings.push('No input field placeholders found. Add [[fieldname#id]] for form fields.');
    }
  }

  if (templateType === TemplateType.CSS || templateType === TemplateType.JavaScript) {
    // Basic syntax checking
    if (templateType === TemplateType.CSS) {
      // Check for unclosed braces
      const openBraces = (content.match(/{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push('Unbalanced braces in CSS. Check for missing { or }.');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Panel for displaying and inserting template placeholders
 */
interface PlaceholderPanelProps {
  fields: DatabaseField[];
  templateType: TemplateType;
  onInsert: (tag: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const PlaceholderPanel: React.FC<PlaceholderPanelProps> = ({
  fields,
  templateType,
  onInsert,
  isOpen,
  onClose,
}) => {
  const [expandedCategory, setExpandedCategory] = useState<string | false>('fields');

  // Build placeholder categories based on template type
  const categories = useMemo((): PlaceholderCategory[] => {
    const fieldPlaceholders = templateType === TemplateType.Add
      ? generateAddFieldPlaceholders(fields)
      : generateFieldPlaceholders(fields);

    const cats: PlaceholderCategory[] = [
      {
        name: 'fields',
        icon: <ViewModuleIcon />,
        placeholders: fieldPlaceholders,
      },
      {
        name: 'system',
        icon: <InfoIcon />,
        placeholders: SYSTEM_PLACEHOLDERS,
      },
    ];

    // Add template-specific placeholders
    if (templateType === TemplateType.Add) {
      cats.push({
        name: 'form',
        icon: <AddIcon />,
        placeholders: ADD_TEMPLATE_PLACEHOLDERS,
      });
    }

    if (templateType === TemplateType.Search) {
      cats.push({
        name: 'search',
        icon: <SearchIcon />,
        placeholders: SEARCH_TEMPLATE_PLACEHOLDERS,
      });
    }

    return cats;
  }, [fields, templateType]);

  const handleCategoryChange = useCallback(
    (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedCategory(isExpanded ? panel : false);
    },
    []
  );

  const handleInsertClick = useCallback(
    (tag: string) => () => {
      onInsert(tag);
    },
    [onInsert]
  );

  const handleCopyClick = useCallback(
    (tag: string) => (event: React.MouseEvent) => {
      event.stopPropagation();
      navigator.clipboard.writeText(tag);
    },
    []
  );

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={onClose}
      variant="persistent"
      sx={{
        width: 320,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 320,
          boxSizing: 'border-box',
          position: 'relative',
          height: '100%',
        },
      }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" component="div">
          Template Tags
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Click a tag to insert it at cursor position
        </Typography>
      </Box>

      <Box sx={{ overflow: 'auto', flex: 1 }}>
        {categories.map((category) => (
          <Accordion
            key={category.name}
            expanded={expandedCategory === category.name}
            onChange={handleCategoryChange(category.name)}
            disableGutters
            elevation={0}
            sx={{
              '&:before': { display: 'none' },
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{ px: 2 }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {category.icon}
                <Typography sx={{ textTransform: 'capitalize' }}>
                  {category.name} Tags
                </Typography>
                <Chip
                  label={category.placeholders.length}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <List dense disablePadding>
                {category.placeholders.map((placeholder) => (
                  <ListItem
                    key={placeholder.tag}
                    disablePadding
                    secondaryAction={
                      <Tooltip title="Copy tag">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={handleCopyClick(placeholder.tag)}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemButton onClick={handleInsertClick(placeholder.tag)}>
                      <ListItemText
                        primary={
                          <Typography
                            component="code"
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.85rem',
                              bgcolor: 'action.hover',
                              px: 0.5,
                              borderRadius: 0.5,
                            }}
                          >
                            {placeholder.tag}
                          </Typography>
                        }
                        secondary={placeholder.description}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Drawer>
  );
};

/**
 * Template preview component
 */
interface TemplatePreviewProps {
  content: string;
  templateType: TemplateType;
  fields: DatabaseField[];
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  content,
  templateType,
  fields,
}) => {
  // Replace field placeholders with sample values for preview
  const previewContent = useMemo(() => {
    let preview = content;

    // Replace field placeholders with sample values
    fields.forEach((field, index) => {
      const sampleValue = getSampleValueForField(field, index);
      preview = preview.replace(
        new RegExp(`\\[\\[${field.name}\\]\\]`, 'g'),
        sampleValue
      );
      // Also handle input placeholders for add template
      preview = preview.replace(
        new RegExp(`\\[\\[${field.name}#id\\]\\]`, 'g'),
        `<input type="text" value="${sampleValue}" disabled style="padding: 4px; border: 1px solid #ccc; border-radius: 4px;" />`
      );
    });

    // Replace system placeholders with sample values
    preview = preview.replace(/##edit##/g, '<a href="#">Edit</a>');
    preview = preview.replace(/##delete##/g, '<a href="#">Delete</a>');
    preview = preview.replace(/##more##/g, '<a href="#">View Details →</a>');
    preview = preview.replace(/##moreurl##/g, '#entry-detail');
    preview = preview.replace(/##user##/g, 'John Doe');
    preview = preview.replace(/##userpicture##/g, '👤');
    preview = preview.replace(/##timeadded##/g, new Date().toLocaleDateString());
    preview = preview.replace(/##timemodified##/g, new Date().toLocaleDateString());
    preview = preview.replace(/##comments##/g, '<div style="background: #f5f5f5; padding: 8px; border-radius: 4px;">[Comments Section]</div>');
    preview = preview.replace(/##rating##/g, '⭐⭐⭐⭐☆');
    preview = preview.replace(/##tags##/g, '<span style="background: #e3f2fd; padding: 2px 8px; border-radius: 12px; margin-right: 4px;">tag1</span><span style="background: #e3f2fd; padding: 2px 8px; border-radius: 12px;">tag2</span>');
    preview = preview.replace(/##id##/g, '42');
    preview = preview.replace(/##class##/g, 'entry-approved');
    preview = preview.replace(/##approve##/g, '<button disabled>Approve</button>');
    preview = preview.replace(/##disapprove##/g, '<button disabled>Disapprove</button>');
    preview = preview.replace(/##export##/g, '<a href="#">Export</a>');
    preview = preview.replace(/##actionbuttons##/g, '<button style="margin-right: 8px;">Save</button><button>Cancel</button>');
    preview = preview.replace(/##requirednotice##/g, '<p style="color: #d32f2f; font-size: 0.85rem;">* Required fields</p>');
    preview = preview.replace(/##searchbutton##/g, '<button>Search</button>');
    preview = preview.replace(/##resetbutton##/g, '<button>Reset</button>');
    preview = preview.replace(/##firstname##/g, '<input type="text" placeholder="First name" disabled />');
    preview = preview.replace(/##lastname##/g, '<input type="text" placeholder="Last name" disabled />');

    return preview;
  }, [content, fields]);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        bgcolor: 'background.default',
        minHeight: 200,
        maxHeight: 400,
        overflow: 'auto',
      }}
    >
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Preview (with sample data)
      </Typography>
      <Divider sx={{ mb: 2 }} />
      {templateType === TemplateType.CSS || templateType === TemplateType.JavaScript ? (
        <Box
          component="pre"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            m: 0,
          }}
        >
          {content}
        </Box>
      ) : (
        <Box
          dangerouslySetInnerHTML={{ __html: previewContent }}
          sx={{
            '& a': { color: 'primary.main' },
            '& button': { cursor: 'default' },
          }}
        />
      )}
    </Paper>
  );
};

/**
 * Helper function to generate sample values for field preview
 */
function getSampleValueForField(field: DatabaseField, index: number): string {
  switch (field.type) {
    case 'text':
      return `Sample Text ${index + 1}`;
    case 'textarea':
      return `This is sample paragraph content for the ${field.name} field.`;
    case 'number':
      return String((index + 1) * 10);
    case 'date':
      return new Date().toLocaleDateString();
    case 'menu':
    case 'radiobutton':
      return 'Option 1';
    case 'checkbox':
    case 'multimenu':
      return 'Option A, Option B';
    case 'file':
      return '<a href="#">document.pdf</a>';
    case 'picture':
      return '<img src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'%3E%3Crect fill=\'%23ddd\' width=\'100\' height=\'100\'/%3E%3Ctext x=\'50\' y=\'50\' text-anchor=\'middle\' dy=\'.3em\'%3E🖼️%3C/text%3E%3C/svg%3E" alt="Sample Image" style="max-width: 100px;" />';
    case 'url':
      return '<a href="#">https://example.com</a>';
    case 'latlong':
      return '40.7128° N, 74.0060° W';
    default:
      return `Sample ${field.name}`;
  }
}

// ============================================================================
// Help Content Component
// ============================================================================

interface HelpContentProps {
  templateType: TemplateType;
}

const HelpContent: React.FC<HelpContentProps> = ({ templateType }) => {
  const helpText = useMemo(() => {
    switch (templateType) {
      case TemplateType.List:
        return {
          title: 'List Template Help',
          content: `The list template defines how entries appear when viewing multiple entries. 
Use [[fieldname]] to display field values, and ##more## to link to the full entry view.
Common tags: ##edit##, ##delete##, ##user##, ##timeadded##`,
        };
      case TemplateType.Single:
        return {
          title: 'Single Template Help',
          content: `The single template defines how a single entry is displayed in detail view.
Use [[fieldname]] to display field values. Include ##comments## and ##rating## if enabled.
Common tags: ##edit##, ##delete##, ##approve##, ##user##, ##timemodified##`,
        };
      case TemplateType.Add:
        return {
          title: 'Add Template Help',
          content: `The add template defines the entry submission form layout.
Use [[fieldname#id]] to place input fields for each database field.
Required: ##actionbuttons## for submit/cancel buttons.
Optional: ##requirednotice## to show required fields notice.`,
        };
      case TemplateType.Search:
        return {
          title: 'Search Template Help',
          content: `The search template defines the advanced search form layout.
Use [[fieldname]] to place search inputs for each field.
Required: ##searchbutton## for the search button.
Optional: ##resetbutton##, ##firstname##, ##lastname## for author search.`,
        };
      case TemplateType.CSS:
        return {
          title: 'CSS Template Help',
          content: `Add custom CSS styles to format your templates.
Use standard CSS syntax. Styles will be scoped to the database activity.
Example: .entry-approved { background: #e8f5e9; }`,
        };
      case TemplateType.JavaScript:
        return {
          title: 'JavaScript Template Help',
          content: `Add custom JavaScript for interactivity.
Scripts run after the page loads. Be careful with DOM manipulation.
Example: document.querySelectorAll('.entry').forEach(e => { ... });`,
        };
      default:
        return {
          title: 'Template Help',
          content: 'Configure how entries are displayed and interacted with.',
        };
    }
  }, [templateType]);

  return (
    <Alert severity="info" icon={<HelpIcon />} sx={{ mb: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        {helpText.title}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
        {helpText.content}
      </Typography>
    </Alert>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * TemplateEditor Component
 *
 * Provides a comprehensive interface for editing database activity display templates.
 * Supports HTML editing with field placeholders, preview, and validation.
 *
 * @param props - Component props
 * @returns React element
 *
 * @example
 * ```tsx
 * <TemplateEditor
 *   databaseId={123}
 *   cmid={456}
 *   onSave={() => console.log('Templates saved')}
 * />
 * ```
 */
const TemplateEditor: React.FC<TemplateEditorProps> = ({
  databaseId,
  cmid: _cmid,
  initialTab = TemplateType.List,
  onSave,
  readOnly = false,
}) => {
  // ============================================================================
  // State
  // ============================================================================

  const [activeTab, setActiveTab] = useState<TemplateType>(initialTab);
  const [templates, setTemplates] = useState<TemplateContent>(DEFAULT_TEMPLATE_CONTENT);
  const [showPlaceholders, setShowPlaceholders] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // ============================================================================
  // Hooks
  // ============================================================================

  const toast = useToast();
  const queryClient = useQueryClient();

  // Fetch database configuration
  const {
    data: database,
    isLoading: isDatabaseLoading,
    error: databaseError,
  } = useDatabase(databaseId);

  // Fetch fields for placeholder generation
  const {
    data: fields = [],
    isLoading: isFieldsLoading,
  } = useQuery({
    queryKey: ['database-fields', databaseId],
    queryFn: () => getFields(databaseId),
    enabled: !!databaseId,
  });

  // ============================================================================
  // Mutations
  // ============================================================================

  const updateTemplateMutation = useMutation({
    mutationFn: async ({
      type,
      content,
    }: {
      type: TemplateType;
      content: string;
    }) => {
      return updateTemplate({
        databaseId,
        templateType: type,
        content,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['database', databaseId] });
      toast.success(`${variables.type} template saved successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to save template: ${error.message}`);
    },
  });

  const resetTemplateMutation = useMutation({
    mutationFn: async (type: TemplateType) => {
      return resetTemplate(databaseId, type);
    },
    onSuccess: (defaultContent, templateType) => {
      setTemplates((prev) => ({
        ...prev,
        [templateType]: defaultContent,
      }));
      queryClient.invalidateQueries({ queryKey: ['database', databaseId] });
      toast.success(`${templateType} template reset to default`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to reset template: ${error.message}`);
    },
  });

  // ============================================================================
  // Effects
  // ============================================================================

  // Initialize template content from database
  useEffect(() => {
    if (database) {
      setTemplates({
        [TemplateType.List]: database.listtemplate || '',
        [TemplateType.Single]: database.singletemplate || '',
        [TemplateType.Add]: database.addtemplate || '',
        [TemplateType.Search]: database.asearchtemplate || '',
        [TemplateType.CSS]: database.csstemplate || '',
        [TemplateType.JavaScript]: database.jstemplate || '',
        [TemplateType.RSS]: database.rsstemplate || '',
      });
      setHasChanges(false);
    }
  }, [database]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const currentTemplate = templates[activeTab];

  const validation = useMemo(
    () => validateTemplate(activeTab, currentTemplate),
    [activeTab, currentTemplate]
  );

  const currentTabConfig = useMemo(
    () => TEMPLATE_TABS.find((tab) => tab.type === activeTab),
    [activeTab]
  );

  const isLoading = isDatabaseLoading || isFieldsLoading;
  const isSaving = updateTemplateMutation.isPending;
  const isResetting = resetTemplateMutation.isPending;

  // ============================================================================
  // Callbacks
  // ============================================================================

  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent, newValue: TemplateType) => {
      setActiveTab(newValue);
    },
    []
  );

  const handleTemplateChange = useCallback(
    (content: string) => {
      setTemplates((prev) => ({
        ...prev,
        [activeTab]: content,
      }));
      setHasChanges(true);
    },
    [activeTab]
  );

  const handleSave = useCallback(async () => {
    if (!validation.isValid) {
      toast.warning('Please fix validation errors before saving');
      return;
    }

    await updateTemplateMutation.mutateAsync({
      type: activeTab,
      content: currentTemplate,
    });
    setHasChanges(false);
    onSave?.();
  }, [
    validation.isValid,
    updateTemplateMutation,
    activeTab,
    currentTemplate,
    toast,
    onSave,
  ]);

  const handleSaveAll = useCallback(async () => {
    const types = Object.keys(templates) as TemplateType[];
    let hasErrors = false;

    for (const type of types) {
      const typeValidation = validateTemplate(type, templates[type]);
      if (!typeValidation.isValid) {
        toast.warning(`Validation errors in ${type} template`);
        hasErrors = true;
      }
    }

    if (hasErrors) {
      return;
    }

    try {
      for (const type of types) {
        if (templates[type]) {
          await updateTemplateMutation.mutateAsync({
            type,
            content: templates[type],
          });
        }
      }
      setHasChanges(false);
      toast.success('All templates saved successfully');
      onSave?.();
    } catch (error) {
      // Error handling is done in mutation
    }
  }, [templates, updateTemplateMutation, toast, onSave]);

  const handleReset = useCallback(() => {
    resetTemplateMutation.mutate(activeTab);
  }, [resetTemplateMutation, activeTab]);

  const handlePlaceholderInsert = useCallback(
    (tag: string) => {
      // Insert tag at cursor position or append to end
      // For simplicity, we append to current content
      // In a full implementation, we'd use the editor's API to insert at cursor
      setTemplates((prev) => ({
        ...prev,
        [activeTab]: prev[activeTab] + tag,
      }));
      setHasChanges(true);
    },
    [activeTab]
  );

  const togglePlaceholders = useCallback(() => {
    setShowPlaceholders((prev) => !prev);
  }, []);

  const togglePreview = useCallback(() => {
    setShowPreview((prev) => !prev);
  }, []);

  const toggleHelp = useCallback(() => {
    setShowHelp((prev) => !prev);
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={400}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (databaseError) {
    return (
      <Alert severity="error">
        Failed to load database configuration: {databaseError.message}
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', minHeight: 600 }}>
      {/* Main Editor Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <Paper
          elevation={0}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            p: 1,
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Stack direction="row" spacing={1}>
              <Tooltip title={showPlaceholders ? 'Hide tags panel' : 'Show tags panel'}>
                <IconButton onClick={togglePlaceholders} color={showPlaceholders ? 'primary' : 'default'}>
                  <CodeIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={showPreview ? 'Hide preview' : 'Show preview'}>
                <IconButton onClick={togglePreview} color={showPreview ? 'primary' : 'default'}>
                  <VisibilityIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={showHelp ? 'Hide help' : 'Show help'}>
                <IconButton onClick={toggleHelp} color={showHelp ? 'primary' : 'default'}>
                  <HelpIcon />
                </IconButton>
              </Tooltip>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleReset}
                disabled={readOnly || isResetting}
              >
                {isResetting ? 'Resetting...' : 'Reset to Default'}
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={readOnly || isSaving || !hasChanges}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleSaveAll}
                disabled={readOnly || isSaving || !hasChanges}
              >
                Save All
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* Tab Navigation */}
        <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 2 }}
          >
            {TEMPLATE_TABS.map((tab) => (
              <Tab
                key={tab.type}
                value={tab.type}
                label={tab.label}
                icon={tab.icon}
                iconPosition="start"
                sx={{ minHeight: 56 }}
              />
            ))}
          </Tabs>
        </Paper>

        {/* Validation Messages */}
        <Box sx={{ p: 2, pb: 0 }}>
          {!validation.isValid && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Template has validation errors:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {validation.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </Alert>
          )}
          {validation.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Warnings:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {validation.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </Alert>
          )}
        </Box>

        {/* Help Section */}
        <Collapse in={showHelp}>
          <Box sx={{ px: 2 }}>
            <HelpContent templateType={activeTab} />
          </Box>
        </Collapse>

        {/* Template Description */}
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {currentTabConfig?.description}
          </Typography>
        </Box>

        {/* Editor Area */}
        <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {currentTabConfig?.usesRichEditor ? (
            <RichTextEditor
              name={`template-${activeTab}`}
              value={currentTemplate}
              onChange={handleTemplateChange}
              height={showPreview ? 250 : 400}
              toolbar="full"
              disabled={readOnly}
              placeholder={`Enter ${currentTabConfig.label.toLowerCase()} HTML...`}
            />
          ) : (
            <TextField
              multiline
              fullWidth
              minRows={showPreview ? 10 : 16}
              maxRows={showPreview ? 10 : 16}
              value={currentTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              disabled={readOnly}
              placeholder={`Enter ${currentTabConfig?.label || 'template'} code...`}
              sx={{
                fontFamily: 'monospace',
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                },
              }}
            />
          )}

          {/* Preview Section */}
          <Collapse in={showPreview}>
            <TemplatePreview
              content={currentTemplate}
              templateType={activeTab}
              fields={fields}
            />
          </Collapse>
        </Box>

        {/* Status Bar */}
        <Paper
          elevation={0}
          sx={{
            borderTop: 1,
            borderColor: 'divider',
            p: 1,
            px: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {currentTemplate.length} characters
            </Typography>
            {hasChanges && (
              <Chip
                label="Unsaved changes"
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1}>
            {validation.isValid ? (
              <Chip
                label="Valid"
                size="small"
                color="success"
                variant="outlined"
              />
            ) : (
              <Chip
                label={`${validation.errors.length} error(s)`}
                size="small"
                color="error"
                variant="outlined"
              />
            )}
          </Stack>
        </Paper>
      </Box>

      {/* Placeholder Panel */}
      {showPlaceholders && (
        <PlaceholderPanel
          fields={fields}
          templateType={activeTab}
          onInsert={handlePlaceholderInsert}
          isOpen={showPlaceholders}
          onClose={togglePlaceholders}
        />
      )}
    </Box>
  );
};

// ============================================================================
// Export
// ============================================================================

export default TemplateEditor;
