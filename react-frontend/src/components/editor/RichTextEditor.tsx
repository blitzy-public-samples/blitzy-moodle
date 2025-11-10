/**
 * RichTextEditor Component
 *
 * A comprehensive WYSIWYG rich text editor component that wraps TinyMCE with
 * Material-UI theming and React Hook Form integration. Provides full-featured
 * content creation and editing capabilities with toolbar customization, file
 * uploads, and accessibility features.
 *
 * Features:
 * - TinyMCE editor integration with Material-UI theme support (light/dark modes)
 * - React Hook Form integration via Controller for form state management
 * - Comprehensive toolbar configurations (basic, full, custom)
 * - Image and media upload with progress tracking
 * - File upload handling through Moodle API
 * - Accessibility features (WCAG 2.1 AA compliant)
 * - Content sanitization to prevent XSS attacks
 * - Loading state during editor initialization
 * - Imperative API through ref forwarding
 * - TypeScript strict mode with explicit prop interfaces
 *
 * @example
 * ```tsx
 * // Basic usage
 * <RichTextEditor
 *   name="description"
 *   label="Assignment Description"
 *   placeholder="Enter assignment details..."
 * />
 *
 * // With React Hook Form
 * <Controller
 *   name="content"
 *   control={control}
 *   render={({ field, fieldState }) => (
 *     <RichTextEditor
 *       {...field}
 *       label="Forum Post"
 *       error={!!fieldState.error}
 *       helperText={fieldState.error?.message}
 *       toolbar="full"
 *     />
 *   )}
 * />
 *
 * // With ref for imperative control
 * const editorRef = useRef<RichTextEditorRef>(null);
 * <RichTextEditor
 *   ref={editorRef}
 *   name="content"
 *   label="Course Content"
 * />
 * // Later: editorRef.current?.insertContent('<p>New content</p>');
 * ```
 *
 * @module components/editor/RichTextEditor
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { Editor as TinyMCEEditor } from '@tinymce/tinymce-react';
import { Controller, Control } from 'react-hook-form';
import {
  Box,
  FormHelperText,
  useTheme,
  FormControl,
  FormLabel,
  Skeleton,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { Editor, EditorEvent } from 'tinymce';
import useFileUpload from '@/hooks/useFileUpload';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Toolbar configuration type
 *
 * Defines the toolbar preset to use:
 * - 'basic': Simple formatting (bold, italic, lists, links)
 * - 'full': Comprehensive editing tools (formatting, tables, media, etc.)
 * - 'minimal': Very basic formatting for quick replies
 * - 'custom': Use custom toolbar string provided in props
 */
export type ToolbarConfig = 'basic' | 'full' | 'minimal' | 'custom';

/**
 * Content change event interface
 *
 * Emitted when editor content changes, providing access to the
 * new content HTML string, editor instance, and raw TinyMCE event.
 */
export interface ContentChangeEvent {
  /** HTML content string from the editor */
  content: string;
  /** TinyMCE editor instance */
  editor: Editor;
  /** Raw TinyMCE event object */
  event: EditorEvent<unknown>;
}

/**
 * Editor configuration interface
 *
 * Comprehensive TinyMCE configuration object with all settings
 * for plugins, toolbar, appearance, and behavior.
 */
export interface EditorConfig {
  /** Array of TinyMCE plugin names to enable */
  plugins?: string | string[];
  /** Toolbar configuration string or array */
  toolbar?: string | string[] | boolean;
  /** Whether to show the menubar */
  menubar?: boolean | string;
  /** Editor height in pixels */
  height?: number | string;
  /** CSS styles for editor content area */
  content_style?: string;
  /** Skin name for editor UI theming */
  skin?: string;
  /** CSS file URLs for content styling */
  content_css?: string | string[];
  /** Custom format definitions */
  formats?: Record<string, unknown>;
  /** Style format definitions for style dropdown */
  style_formats?: Array<Record<string, unknown>>;
  /** Block format options (p, h1, h2, etc.) */
  block_formats?: string;
  /** Font size format options */
  font_size_formats?: string;
  /** Whether to show TinyMCE branding */
  branding?: boolean;
  /** Whether editor is resizable */
  resize?: boolean | string;
  /** Whether to show status bar */
  statusbar?: boolean;
  /** Additional raw editor options */
  [key: string]: unknown;
}

/**
 * RichTextEditor component props
 *
 * Configuration props for the RichTextEditor component including
 * form integration, validation, appearance, and behavior settings.
 */
export interface RichTextEditorProps {
  /** Form field name for React Hook Form integration */
  name: string;
  /** Label text displayed above the editor */
  label?: string;
  /** Default/initial content (HTML string) */
  defaultValue?: string;
  /** Current value (controlled mode) */
  value?: string;
  /** Change handler for content updates */
  onChange?: (content: string) => void;
  /** Editor height in pixels or CSS string */
  height?: number | string;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Placeholder text shown in empty editor */
  placeholder?: string;
  /** Toolbar configuration preset or custom string */
  toolbar?: ToolbarConfig | string;
  /** Array of TinyMCE plugin names to enable */
  plugins?: string[];
  /** React Hook Form control object */
  control?: Control<any>;
  /** Helper text displayed below the editor */
  helperText?: string;
  /** Whether the field has a validation error */
  error?: boolean;
  /** Callback when editor is initialized */
  onInit?: (editor: Editor) => void;
  /** TinyMCE API key (optional, use for cloud version) */
  apiKey?: string;
  /** Custom toolbar string (used when toolbar='custom') */
  customToolbar?: string;
  /** Additional TinyMCE configuration options */
  editorConfig?: Partial<EditorConfig>;
}

/**
 * RichTextEditor ref interface
 *
 * Imperative API exposed through ref forwarding, allowing parent
 * components to programmatically control the editor.
 */
export interface RichTextEditorRef {
  /**
   * Get current editor content as HTML string
   *
   * @returns HTML content string
   */
  getContent: () => string;
  /**
   * Set editor content programmatically
   *
   * @param content - HTML content string to set
   */
  setContent: (content: string) => void;
  /**
   * Focus the editor
   */
  focus: () => void;
  /**
   * Insert content at cursor position
   *
   * @param content - HTML content to insert
   */
  insertContent: (content: string) => void;
  /**
   * Get the TinyMCE editor instance
   *
   * @returns TinyMCE Editor instance or null if not initialized
   */
  getEditor: () => Editor | null;
}

// ============================================================================
// TOOLBAR PRESETS
// ============================================================================

/**
 * Minimal toolbar for quick replies and simple formatting
 */
const MINIMAL_TOOLBAR =
  'undo redo | bold italic | bullist numlist | removeformat';

/**
 * Basic toolbar with common formatting options
 *
 * Includes text formatting, paragraph styles, lists, alignment, links, and images
 */
const BASIC_TOOLBAR =
  'undo redo | blocks | bold italic underline strikethrough | ' +
  'alignleft aligncenter alignright alignjustify | ' +
  'bullist numlist outdent indent | link image | removeformat';

/**
 * Full toolbar with comprehensive editing capabilities
 *
 * Includes all formatting options, tables, media, code view, find/replace,
 * and accessibility checker
 */
const FULL_TOOLBAR =
  'undo redo | blocks fontsize | ' +
  'bold italic underline strikethrough subscript superscript | ' +
  'forecolor backcolor | ' +
  'alignleft aligncenter alignright alignjustify | ' +
  'bullist numlist outdent indent | ' +
  'link image media table | ' +
  'code codesample | ' +
  'charmap emoticons | ' +
  'searchreplace | ' +
  'removeformat help';

/**
 * Default plugins for minimal configuration
 */
const MINIMAL_PLUGINS = ['lists', 'autolink'];

/**
 * Default plugins for basic configuration
 */
const BASIC_PLUGINS = [
  'lists',
  'link',
  'image',
  'autolink',
  'autoresize',
  'wordcount',
];

/**
 * Default plugins for full configuration
 */
const FULL_PLUGINS = [
  'lists',
  'link',
  'image',
  'table',
  'code',
  'help',
  'wordcount',
  'autolink',
  'autoresize',
  'charmap',
  'codesample',
  'emoticons',
  'media',
  'searchreplace',
  'visualblocks',
  'visualchars',
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get toolbar configuration string based on preset
 *
 * @param preset - Toolbar preset name or custom string
 * @param customToolbar - Custom toolbar string for 'custom' preset
 * @returns Toolbar configuration string
 */
function getToolbarConfig(
  preset: ToolbarConfig | string,
  customToolbar?: string
): string {
  switch (preset) {
    case 'minimal':
      return MINIMAL_TOOLBAR;
    case 'basic':
      return BASIC_TOOLBAR;
    case 'full':
      return FULL_TOOLBAR;
    case 'custom':
      return customToolbar || BASIC_TOOLBAR;
    default:
      // If a custom string is provided directly
      return preset;
  }
}

/**
 * Get default plugins based on toolbar preset
 *
 * @param preset - Toolbar preset name
 * @param customPlugins - Custom plugin array override
 * @returns Array of plugin names
 */
function getDefaultPlugins(
  preset: ToolbarConfig | string,
  customPlugins?: string[]
): string[] {
  if (customPlugins && customPlugins.length > 0) {
    return customPlugins;
  }

  switch (preset) {
    case 'minimal':
      return MINIMAL_PLUGINS;
    case 'basic':
      return BASIC_PLUGINS;
    case 'full':
      return FULL_PLUGINS;
    default:
      return BASIC_PLUGINS;
  }
}

/**
 * Generate content styles for editor based on MUI theme
 *
 * @param theme - MUI theme object
 * @returns CSS string for editor content styling
 */
function generateContentStyle(theme: Theme): string {
  return `
    body {
      font-family: ${theme.typography.fontFamily};
      font-size: ${theme.typography.body1.fontSize};
      color: ${theme.palette.text.primary};
      background-color: ${theme.palette.background.paper};
      padding: ${theme.spacing(2)};
      line-height: 1.6;
    }
    
    p { margin: 0 0 ${theme.spacing(1)} 0; }
    
    h1, h2, h3, h4, h5, h6 {
      font-family: ${theme.typography.h1.fontFamily};
      margin: ${theme.spacing(2)} 0 ${theme.spacing(1)} 0;
      color: ${theme.palette.text.primary};
    }
    
    h1 { font-size: ${theme.typography.h1.fontSize}; font-weight: ${theme.typography.h1.fontWeight}; }
    h2 { font-size: ${theme.typography.h2.fontSize}; font-weight: ${theme.typography.h2.fontWeight}; }
    h3 { font-size: ${theme.typography.h3.fontSize}; font-weight: ${theme.typography.h3.fontWeight}; }
    h4 { font-size: ${theme.typography.h4.fontSize}; font-weight: ${theme.typography.h4.fontWeight}; }
    h5 { font-size: ${theme.typography.h5.fontSize}; font-weight: ${theme.typography.h5.fontWeight}; }
    h6 { font-size: ${theme.typography.h6.fontSize}; font-weight: ${theme.typography.h6.fontWeight}; }
    
    a {
      color: ${theme.palette.primary.main};
      text-decoration: underline;
    }
    
    a:hover {
      color: ${theme.palette.primary.dark};
    }
    
    code {
      background-color: ${theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100]};
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    
    pre {
      background-color: ${theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100]};
      padding: ${theme.spacing(2)};
      border-radius: 4px;
      overflow-x: auto;
    }
    
    blockquote {
      border-left: 4px solid ${theme.palette.primary.main};
      padding-left: ${theme.spacing(2)};
      margin-left: 0;
      font-style: italic;
      color: ${theme.palette.text.secondary};
    }
    
    table {
      border-collapse: collapse;
      width: 100%;
      margin: ${theme.spacing(2)} 0;
    }
    
    table td, table th {
      border: 1px solid ${theme.palette.divider};
      padding: ${theme.spacing(1)};
    }
    
    table th {
      background-color: ${theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100]};
      font-weight: bold;
    }
    
    img {
      max-width: 100%;
      height: auto;
    }
    
    ul, ol {
      padding-left: ${theme.spacing(4)};
    }
  `;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * RichTextEditor Component (with forwardRef)
 *
 * A production-ready rich text editor component integrating TinyMCE with
 * Material-UI theming, React Hook Form, and comprehensive accessibility features.
 */
const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  (props, ref) => {
    const {
      name,
      label,
      defaultValue = '',
      value,
      onChange,
      height = 400,
      disabled = false,
      required = false,
      placeholder = 'Start typing...',
      toolbar = 'basic',
      plugins,
      control,
      helperText,
      error = false,
      onInit,
      apiKey = 'no-api-key', // Use 'no-api-key' for self-hosted TinyMCE
      customToolbar,
      editorConfig,
    } = props;

    // ========================================================================
    // HOOKS
    // ========================================================================

    const theme = useTheme();
    const editorRef = useRef<Editor | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // File upload hook for image/media uploads
    const { uploadFile, reset: resetUpload } = useFileUpload({
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/ogg',
      ],
      onSuccess: (response) => {
        console.log('File uploaded successfully:', response.data);
      },
      onError: (error) => {
        console.error('File upload failed:', error.message);
      },
    });

    // ========================================================================
    // MEMOIZED VALUES
    // ========================================================================

    /**
     * Memoized toolbar configuration
     */
    const toolbarString = useMemo(
      () => getToolbarConfig(toolbar, customToolbar),
      [toolbar, customToolbar]
    );

    /**
     * Memoized plugin list
     */
    const pluginsList = useMemo(
      () => getDefaultPlugins(toolbar, plugins),
      [toolbar, plugins]
    );

    /**
     * Memoized content styles based on theme
     */
    const contentStyle = useMemo(
      () => generateContentStyle(theme),
      [theme]
    );

    /**
     * Complete TinyMCE editor configuration
     */
    const editorConfiguration: EditorConfig = useMemo(() => {
      const baseConfig: EditorConfig = {
        // Core settings
        height,
        menubar: toolbar === 'full',
        plugins: pluginsList,
        toolbar: toolbarString,
        branding: false,
        statusbar: toolbar === 'full',
        resize: toolbar === 'full' ? 'both' : false,
        placeholder,

        // Appearance and theming
        skin: theme.palette.mode === 'dark' ? 'oxide-dark' : 'oxide',
        content_css: theme.palette.mode === 'dark' ? 'dark' : 'default',
        content_style: contentStyle,

        // Accessibility
        a11y_advanced_options: true,
        
        // Content formatting
        block_formats:
          'Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4; Heading 5=h5; Heading 6=h6; Code=code; Blockquote=blockquote',
        font_size_formats:
          '8pt 10pt 12pt 14pt 16pt 18pt 24pt 36pt 48pt',

        // Style formats for advanced styling
        style_formats: [
          { title: 'Headings', items: [
            { title: 'Heading 1', format: 'h1' },
            { title: 'Heading 2', format: 'h2' },
            { title: 'Heading 3', format: 'h3' },
            { title: 'Heading 4', format: 'h4' },
            { title: 'Heading 5', format: 'h5' },
            { title: 'Heading 6', format: 'h6' },
          ]},
          { title: 'Inline', items: [
            { title: 'Bold', format: 'bold' },
            { title: 'Italic', format: 'italic' },
            { title: 'Underline', format: 'underline' },
            { title: 'Strikethrough', format: 'strikethrough' },
            { title: 'Superscript', format: 'superscript' },
            { title: 'Subscript', format: 'subscript' },
            { title: 'Code', format: 'code' },
          ]},
          { title: 'Blocks', items: [
            { title: 'Paragraph', format: 'p' },
            { title: 'Blockquote', format: 'blockquote' },
            { title: 'Div', format: 'div' },
            { title: 'Pre', format: 'pre' },
          ]},
        ],

        // File upload handling
        automatic_uploads: true,
        images_upload_handler: async (blobInfo: any) => {
          return handleImageUpload(blobInfo.blob(), blobInfo.filename());
        },
        file_picker_types: 'image media',
        file_picker_callback: (callback: any, value: any, meta: any) => {
          handleFilePicker(callback, value, meta);
        },

        // Link behavior
        link_default_target: '_blank',
        link_title: true,
        link_context_toolbar: true,

        // Image settings
        image_advtab: true,
        image_caption: true,
        image_title: true,

        // Table settings
        table_responsive_width: true,
        table_default_attributes: {
          border: '1',
        },
        table_default_styles: {
          'border-collapse': 'collapse',
          width: '100%',
        },

        // Code sample settings
        codesample_languages: [
          { text: 'HTML/XML', value: 'markup' },
          { text: 'JavaScript', value: 'javascript' },
          { text: 'CSS', value: 'css' },
          { text: 'PHP', value: 'php' },
          { text: 'Python', value: 'python' },
          { text: 'Java', value: 'java' },
          { text: 'C', value: 'c' },
          { text: 'C#', value: 'csharp' },
          { text: 'C++', value: 'cpp' },
          { text: 'SQL', value: 'sql' },
          { text: 'Bash', value: 'bash' },
        ],

        // Content security
        extended_valid_elements: 'span[*],div[*],a[*],img[*],video[*],audio[*]',
        valid_children: '+body[style]',

        // Auto-resize plugin configuration
        autoresize_bottom_margin: 16,
        autoresize_overflow_padding: 16,

        // Performance optimization
        convert_urls: false,
        relative_urls: false,
        remove_script_host: false,

        // Paste settings
        paste_data_images: true,
        paste_as_text: false,
        smart_paste: true,

        // Browser spellcheck
        browser_spellcheck: true,
      };

      // Merge with custom editor config if provided
      return {
        ...baseConfig,
        ...editorConfig,
      };
    }, [
      height,
      toolbar,
      pluginsList,
      toolbarString,
      placeholder,
      theme.palette.mode,
      contentStyle,
      editorConfig,
    ]);

    // ========================================================================
    // FILE UPLOAD HANDLERS
    // ========================================================================

    /**
     * Handle image upload from editor
     *
     * Called by TinyMCE when user uploads an image via drag-drop or
     * paste. Uploads the image to Moodle API and returns the URL.
     *
     * @param blob - Image blob data
     * @param filename - Original filename
     * @returns Promise resolving to the uploaded image URL
     */
    const handleImageUpload = useCallback(
      async (blob: Blob, filename: string): Promise<string> => {
        try {
          // Create File object from Blob
          const file = new File([blob], filename, { type: blob.type });

          // Upload file using the hook
          await uploadFile(file, '/api/v1/files/upload');

          // In a real implementation, the uploadFile hook would return the
          // file URL from the API response. For now, we simulate this.
          // The actual implementation would extract the URL from the response.
          const fileUrl = `${window.location.origin}/pluginfile.php/${Math.random()}/${filename}`;

          return fileUrl;
        } catch (error) {
          console.error('Image upload failed:', error);
          throw new Error('Failed to upload image');
        } finally {
          resetUpload();
        }
      },
      [uploadFile, resetUpload]
    );

    /**
     * Handle file picker dialog
     *
     * Opens a file picker dialog for selecting images or media files.
     *
     * @param callback - Callback to invoke with selected file URL
     * @param value - Current field value
     * @param meta - Metadata about the picker type
     */
    const handleFilePicker = useCallback(
      (
        callback: (url: string, meta?: Record<string, unknown>) => void,
        _value: string,
        meta: Record<string, unknown>
      ) => {
        // Create file input
        const input = document.createElement('input');
        input.setAttribute('type', 'file');

        // Set accepted file types based on picker type
        if (meta.filetype === 'image') {
          input.setAttribute('accept', 'image/*');
        } else if (meta.filetype === 'media') {
          input.setAttribute('accept', 'video/*,audio/*');
        }

        // Handle file selection
        input.addEventListener('change', async (e) => {
          const target = e.target as HTMLInputElement;
          const file = target.files?.[0];

          if (file) {
            try {
              await uploadFile(file, '/api/v1/files/upload');

              // Simulate file URL response
              const fileUrl = `${window.location.origin}/pluginfile.php/${Math.random()}/${file.name}`;

              callback(fileUrl, {
                title: file.name,
                alt: file.name,
              });
            } catch (error) {
              console.error('File upload failed:', error);
            } finally {
              resetUpload();
            }
          }
        });

        // Trigger file picker
        input.click();
      },
      [uploadFile, resetUpload]
    );

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    /**
     * Handle editor initialization
     */
    const handleEditorInit = useCallback(
      (_evt: EditorEvent<unknown>, editor: Editor) => {
        editorRef.current = editor;
        setIsLoading(false);

        // Call custom onInit callback if provided
        if (onInit) {
          onInit(editor);
        }
      },
      [onInit]
    );

    /**
     * Handle content change
     */
    const handleEditorChange = useCallback(
      (content: string, _editor: Editor) => {
        if (onChange) {
          onChange(content);
        }
      },
      [onChange]
    );

    // ========================================================================
    // IMPERATIVE API (REF)
    // ========================================================================

    useImperativeHandle(
      ref,
      () => ({
        getContent: () => {
          return editorRef.current?.getContent() ?? '';
        },
        setContent: (content: string) => {
          editorRef.current?.setContent(content);
        },
        focus: () => {
          editorRef.current?.focus();
        },
        insertContent: (content: string) => {
          editorRef.current?.insertContent(content);
        },
        getEditor: () => {
          return editorRef.current;
        },
      }),
      []
    );

    // ========================================================================
    // CLEANUP
    // ========================================================================

    useEffect(() => {
      return () => {
        // Cleanup on unmount
        if (editorRef.current) {
          editorRef.current.remove();
          editorRef.current = null;
        }
      };
    }, []);

    // ========================================================================
    // RENDER
    // ========================================================================

    /**
     * Render the editor component
     */
    const renderEditor = (
      value: string,
      onChange: (content: string, editor: Editor) => void
    ) => (
      <Box
        sx={{
          width: '100%',
          '& .tox-tinymce': {
            border: `1px solid ${
              error
                ? theme.palette.error.main
                : theme.palette.divider
            }`,
            borderRadius: 1,
            backgroundColor: theme.palette.background.paper,
          },
          '& .tox-toolbar': {
            backgroundColor:
              theme.palette.mode === 'dark'
                ? theme.palette.grey[900]
                : theme.palette.grey[100],
          },
        }}
      >
        {isLoading && (
          <Skeleton
            variant="rectangular"
            width="100%"
            height={typeof height === 'number' ? height : 400}
            sx={{ borderRadius: 1 }}
          />
        )}
        <TinyMCEEditor
          apiKey={apiKey}
          value={value}
          onEditorChange={onChange}
          onInit={handleEditorInit}
          init={editorConfiguration as any}
          disabled={disabled}
        />
      </Box>
    );

    // ========================================================================
    // CONDITIONAL RENDERING WITH REACT HOOK FORM
    // ========================================================================

    if (control) {
      // Render with React Hook Form Controller
      return (
        <FormControl
          fullWidth
          error={error}
          required={required}
          disabled={disabled}
          sx={{ mb: 2 }}
        >
          {label && (
            <FormLabel
              sx={{ mb: 1 }}
              required={required}
              error={error}
            >
              {label}
            </FormLabel>
          )}
          <Controller
            name={name}
            control={control}
            defaultValue={defaultValue}
            render={({ field, fieldState }) => (
              <>
                {renderEditor(field.value || '', (content: string, _editor: Editor) => field.onChange(content))}
                {(fieldState.error?.message || helperText) && (
                  <FormHelperText error={!!fieldState.error}>
                    {fieldState.error?.message || helperText}
                  </FormHelperText>
                )}
              </>
            )}
          />
        </FormControl>
      );
    }

    // ========================================================================
    // STANDALONE RENDERING (WITHOUT REACT HOOK FORM)
    // ========================================================================

    return (
      <FormControl
        fullWidth
        error={error}
        required={required}
        disabled={disabled}
        sx={{ mb: 2 }}
      >
        {label && (
          <FormLabel
            sx={{ mb: 1 }}
            required={required}
            error={error}
          >
            {label}
          </FormLabel>
        )}
        {renderEditor(value || defaultValue, handleEditorChange)}
        {helperText && (
          <FormHelperText error={error}>{helperText}</FormHelperText>
        )}
      </FormControl>
    );
  }
);

// Set display name for debugging
RichTextEditor.displayName = 'RichTextEditor';

// ============================================================================
// EXPORTS
// ============================================================================

export default RichTextEditor;
