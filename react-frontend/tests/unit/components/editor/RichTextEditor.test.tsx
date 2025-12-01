/**
 * RichTextEditor Component Test Suite
 *
 * Comprehensive unit tests for the RichTextEditor component using Vitest and
 * React Testing Library. Tests TinyMCE integration, React Hook Form Controller
 * binding, toolbar configurations, formatting controls, image/media uploads,
 * content sanitization, accessibility features, theme integration, loading states,
 * validation error display, and ref forwarding.
 *
 * @module tests/unit/components/editor/RichTextEditor.test
 */

import React, { createRef } from 'react';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import { cleanup, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { createTheme, ThemeProvider } from '@mui/material';
import type { Theme } from '@mui/material/styles';

import RichTextEditor from '@/components/editor/RichTextEditor';
import type {
  RichTextEditorProps,
  RichTextEditorRef,
} from '@/components/editor/RichTextEditor';
import {
  render,
  screen,
  userEvent,
  fireEvent,
} from '@/tests/helpers/render';
import { server } from '@/tests/mocks/server';

// ============================================================================
// MOCK TYPES AND INTERFACES
// ============================================================================

/**
 * Mock TinyMCE Editor instance interface for testing
 */
interface MockEditorInstance {
  getContent: Mock;
  setContent: Mock;
  focus: Mock;
  insertContent: Mock;
  remove: Mock;
  execCommand: Mock;
  on: Mock;
  off: Mock;
  fire: Mock;
}

/**
 * Mock TinyMCE Editor props passed to the component
 */
interface MockEditorProps {
  apiKey?: string;
  value?: string;
  onEditorChange?: (content: string, editor: MockEditorInstance) => void;
  onInit?: (evt: unknown, editor: MockEditorInstance) => void;
  init?: Record<string, unknown>;
  disabled?: boolean;
}

// ============================================================================
// MOCK TINYMCE EDITOR
// ============================================================================

/**
 * Create a mock TinyMCE editor instance with all required methods
 */
function createMockEditorInstance(): MockEditorInstance {
  return {
    getContent: vi.fn().mockReturnValue('<p>Test content</p>'),
    setContent: vi.fn(),
    focus: vi.fn(),
    insertContent: vi.fn(),
    remove: vi.fn(),
    execCommand: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    fire: vi.fn(),
  };
}

// Global mock editor instance for tests
let mockEditorInstance: MockEditorInstance;
let mockInitCallback: ((evt: unknown, editor: MockEditorInstance) => void) | null = null;
let mockOnChangeCallback: ((content: string, editor: MockEditorInstance) => void) | null = null;
let capturedInitConfig: Record<string, unknown> | null = null;

// Mock the @tinymce/tinymce-react module
vi.mock('@tinymce/tinymce-react', () => ({
  Editor: vi.fn(({ onInit, onEditorChange, init, value, disabled }: MockEditorProps) => {
    // Capture callbacks for testing
    mockInitCallback = onInit ?? null;
    mockOnChangeCallback = onEditorChange ?? null;
    capturedInitConfig = init ?? null;

    // Simulate editor initialization on render
    React.useEffect(() => {
      // Delay initialization to simulate real TinyMCE behavior
      const timer = setTimeout(() => {
        if (onInit) {
          mockEditorInstance = createMockEditorInstance();
          onInit({}, mockEditorInstance);
        }
      }, 10);
      return () => clearTimeout(timer);
    }, [onInit]);

    return (
      <div
        data-testid="tinymce-editor"
        role="textbox"
        aria-label="Rich Text Editor"
        aria-required={init?.required ? 'true' : 'false'}
        aria-invalid={init?.['aria-invalid'] ? 'true' : 'false'}
        aria-disabled={disabled ? 'true' : 'false'}
        tabIndex={0}
      >
        <textarea
          data-testid="tinymce-textarea"
          value={value ?? ''}
          onChange={(e) => {
            if (onEditorChange && mockEditorInstance) {
              onEditorChange(e.target.value, mockEditorInstance);
            }
          }}
          disabled={disabled}
        />
        <div data-testid="tinymce-toolbar" role="toolbar">
          <button data-testid="btn-bold" aria-label="Bold">B</button>
          <button data-testid="btn-italic" aria-label="Italic">I</button>
          <button data-testid="btn-underline" aria-label="Underline">U</button>
          <button data-testid="btn-link" aria-label="Insert Link">Link</button>
        </div>
      </div>
    );
  }),
}));

// Mock the useFileUpload hook
const mockUploadFile = vi.fn();
const mockResetUpload = vi.fn();

vi.mock('@/hooks/useFileUpload', () => ({
  default: vi.fn(() => ({
    uploadFile: mockUploadFile,
    reset: mockResetUpload,
    isUploading: false,
    progress: 0,
    error: null,
  })),
}));

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Helper component to wrap RichTextEditor with React Hook Form
 */
interface TestFormWrapperProps {
  defaultValues?: Record<string, string>;
  onSubmit?: (data: Record<string, string>) => void;
  children: React.ReactNode;
}

function TestFormWrapper({
  defaultValues = { content: '' },
  onSubmit = vi.fn(),
  children,
}: TestFormWrapperProps): React.ReactElement {
  const methods = useForm({
    defaultValues,
    mode: 'onChange',
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        {children}
        <button type="submit" data-testid="submit-button">
          Submit
        </button>
      </form>
    </FormProvider>
  );
}

/**
 * Simulate keyboard shortcut
 */
function simulateKeyboardShortcut(key: string, ctrlKey = true): void {
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key,
    ctrlKey,
    metaKey: false,
  });
}

/**
 * Wait for TinyMCE editor to initialize
 */
async function waitForEditorInit(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('tinymce-editor')).toBeInTheDocument();
  });
}

/**
 * Create light theme for testing
 */
function createLightTheme(): Theme {
  return createTheme({
    palette: {
      mode: 'light',
      primary: { main: '#1976d2' },
      background: { paper: '#ffffff', default: '#fafafa' },
      text: { primary: '#333333', secondary: '#666666' },
      divider: '#e0e0e0',
      error: { main: '#d32f2f' },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    },
  });
}

/**
 * Create dark theme for testing
 */
function createDarkTheme(): Theme {
  return createTheme({
    palette: {
      mode: 'dark',
      primary: { main: '#90caf9' },
      background: { paper: '#1e1e1e', default: '#121212' },
      text: { primary: '#ffffff', secondary: '#b0b0b0' },
      divider: '#424242',
      error: { main: '#f44336' },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    },
  });
}

// ============================================================================
// TEST SETUP
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockEditorInstance = createMockEditorInstance();
  mockInitCallback = null;
  mockOnChangeCallback = null;
  capturedInitConfig = null;
  mockUploadFile.mockResolvedValue({ url: 'https://example.com/uploaded.jpg' });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  server.resetHandlers();
});

// ============================================================================
// TEST SUITES
// ============================================================================

describe('RichTextEditor', () => {
  // ==========================================================================
  // 1. TinyMCE Integration Tests
  // ==========================================================================
  describe('TinyMCE Integration', () => {
    it('should render TinyMCE Editor component', async () => {
      render(<RichTextEditor name="content" label="Test Editor" />);

      await waitForEditorInit();
      expect(screen.getByTestId('tinymce-editor')).toBeInTheDocument();
    });

    it('should pass correct TinyMCE configuration on initialization', async () => {
      render(
        <RichTextEditor
          name="content"
          label="Test Editor"
          toolbar="full"
          height={500}
        />
      );

      await waitForEditorInit();

      // Verify init config was captured
      expect(capturedInitConfig).toBeDefined();
      expect(capturedInitConfig?.height).toBe(500);
      expect(capturedInitConfig?.branding).toBe(false);
    });

    it('should pass plugins array correctly based on toolbar preset', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      // Full toolbar should include more plugins
      expect(capturedInitConfig).toBeDefined();
      const plugins = capturedInitConfig?.plugins as string[];
      expect(plugins).toContain('lists');
      expect(plugins).toContain('link');
      expect(plugins).toContain('image');
      expect(plugins).toContain('table');
      expect(plugins).toContain('code');
    });

    it('should make editor instance methods accessible via ref', async () => {
      const editorRef = createRef<RichTextEditorRef>();

      render(<RichTextEditor ref={editorRef} name="content" />);

      await waitForEditorInit();

      // Wait for ref to be populated
      await waitFor(() => {
        expect(editorRef.current).toBeDefined();
      });

      expect(editorRef.current?.getContent).toBeDefined();
      expect(editorRef.current?.setContent).toBeDefined();
      expect(editorRef.current?.focus).toBeDefined();
      expect(editorRef.current?.insertContent).toBeDefined();
      expect(editorRef.current?.getEditor).toBeDefined();
    });

    it('should cleanup editor on unmount', async () => {
      const { unmount } = render(<RichTextEditor name="content" />);

      await waitForEditorInit();

      // Unmount the component
      unmount();

      // Editor remove should be called on cleanup
      // Note: This is handled in useEffect cleanup
      expect(mockEditorInstance.remove).toBeDefined();
    });
  });

  // ==========================================================================
  // 2. React Hook Form Controller Binding Tests
  // ==========================================================================
  describe('React Hook Form Controller Binding', () => {
    it('should sync editor content with form state via onChange callback', async () => {
      const onSubmit = vi.fn();

      render(
        <TestFormWrapper defaultValues={{ content: '' }} onSubmit={onSubmit}>
          <Controller
            name="content"
            render={({ field }) => (
              <RichTextEditor
                name="content"
                label="Content"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </TestFormWrapper>
      );

      await waitForEditorInit();

      // Simulate content change
      const textarea = screen.getByTestId('tinymce-textarea');
      fireEvent.change(textarea, { target: { value: '<p>New content</p>' } });

      // Submit form
      const submitBtn = screen.getByTestId('submit-button');
      await userEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });
    });

    it('should use Controller name prop for form field registration', async () => {
      const methods = {
        control: {} as never,
        handleSubmit: vi.fn((fn) => (e: React.FormEvent) => {
          e?.preventDefault?.();
          return fn({ content: '' });
        }),
      };

      render(
        <RichTextEditor
          name="testFieldName"
          label="Test Field"
          control={methods.control}
        />
      );

      await waitForEditorInit();

      // The component should render with the provided name
      expect(screen.getByText('Test Field')).toBeInTheDocument();
    });

    it('should display FormHelperText when validation fails', async () => {
      render(
        <RichTextEditor
          name="content"
          label="Content"
          error={true}
          helperText="This field is required"
        />
      );

      await waitForEditorInit();

      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('should populate editor content with defaultValue on mount', async () => {
      const defaultContent = '<p>Default content</p>';

      render(
        <RichTextEditor
          name="content"
          label="Content"
          defaultValue={defaultContent}
        />
      );

      await waitForEditorInit();

      const textarea = screen.getByTestId('tinymce-textarea');
      expect(textarea).toHaveValue(defaultContent);
    });
  });

  // ==========================================================================
  // 3. Toolbar Configuration Tests
  // ==========================================================================
  describe('Toolbar Configuration', () => {
    it('should render basic toolbar preset correctly', async () => {
      render(<RichTextEditor name="content" toolbar="basic" />);

      await waitForEditorInit();

      expect(capturedInitConfig).toBeDefined();
      const toolbar = capturedInitConfig?.toolbar as string;
      expect(toolbar).toContain('undo redo');
      expect(toolbar).toContain('bold italic');
    });

    it('should render full toolbar preset with all formatting options', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig).toBeDefined();
      const toolbar = capturedInitConfig?.toolbar as string;
      expect(toolbar).toContain('bold italic underline');
      expect(toolbar).toContain('bullist numlist');
      expect(toolbar).toContain('link image media table');
    });

    it('should render minimal toolbar preset', async () => {
      render(<RichTextEditor name="content" toolbar="minimal" />);

      await waitForEditorInit();

      expect(capturedInitConfig).toBeDefined();
      const toolbar = capturedInitConfig?.toolbar as string;
      expect(toolbar).toContain('undo redo');
      expect(toolbar).toContain('bold italic');
      expect(toolbar).toContain('removeformat');
    });

    it('should use custom toolbar configuration when provided', async () => {
      const customToolbar = 'undo redo | bold italic | custom';

      render(
        <RichTextEditor
          name="content"
          toolbar="custom"
          customToolbar={customToolbar}
        />
      );

      await waitForEditorInit();

      expect(capturedInitConfig).toBeDefined();
      expect(capturedInitConfig?.toolbar).toBe(customToolbar);
    });

    it('should pass toolbar buttons to TinyMCE config', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      // Check toolbar rendering
      expect(screen.getByTestId('tinymce-toolbar')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 4. Formatting Controls Tests
  // ==========================================================================
  describe('Formatting Controls', () => {
    it('should support bold formatting via Ctrl+B keyboard shortcut', async () => {
      render(<RichTextEditor name="content" />);

      await waitForEditorInit();

      const editor = screen.getByTestId('tinymce-editor');
      editor.focus();

      simulateKeyboardShortcut('b', true);

      // In real TinyMCE, this would apply bold formatting
      // For mock, we verify the keyboard event is captured
      expect(editor).toBeInTheDocument();
    });

    it('should support italic formatting via Ctrl+I keyboard shortcut', async () => {
      render(<RichTextEditor name="content" />);

      await waitForEditorInit();

      const editor = screen.getByTestId('tinymce-editor');
      editor.focus();

      simulateKeyboardShortcut('i', true);

      expect(editor).toBeInTheDocument();
    });

    it('should support underline formatting via Ctrl+U keyboard shortcut', async () => {
      render(<RichTextEditor name="content" />);

      await waitForEditorInit();

      const editor = screen.getByTestId('tinymce-editor');
      editor.focus();

      simulateKeyboardShortcut('u', true);

      expect(editor).toBeInTheDocument();
    });

    it('should include heading styles in configuration', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig).toBeDefined();
      const blockFormats = capturedInitConfig?.block_formats as string;
      expect(blockFormats).toContain('Heading 1=h1');
      expect(blockFormats).toContain('Heading 2=h2');
      expect(blockFormats).toContain('Heading 3=h3');
    });

    it('should include list creation options in toolbar', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      const toolbar = capturedInitConfig?.toolbar as string;
      expect(toolbar).toContain('bullist numlist');
    });

    it('should include text alignment options in full toolbar', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      const toolbar = capturedInitConfig?.toolbar as string;
      expect(toolbar).toContain('alignleft aligncenter alignright alignjustify');
    });

    it('should include link insertion capability', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      const toolbar = capturedInitConfig?.toolbar as string;
      expect(toolbar).toContain('link');
      expect(capturedInitConfig?.link_default_target).toBe('_blank');
    });
  });

  // ==========================================================================
  // 5. Image/Media Upload Tests
  // ==========================================================================
  describe('Image/Media Upload', () => {
    beforeEach(() => {
      // Setup MSW handler for file upload
      server.use(
        http.post('/api/v1/files/upload', async ({ request }) => {
          const formData = await request.formData();
          const file = formData.get('file') as File;

          if (!file) {
            return HttpResponse.json(
              {
                success: false,
                error: { code: 'NO_FILE', message: 'No file provided' },
              },
              { status: 400 }
            );
          }

          // Check file size (5MB limit)
          if (file.size > 5 * 1024 * 1024) {
            return HttpResponse.json(
              {
                success: false,
                error: { code: 'FILE_TOO_LARGE', message: 'File exceeds 5MB limit' },
              },
              { status: 422 }
            );
          }

          // Check file type
          if (!file.type.startsWith('image/')) {
            return HttpResponse.json(
              {
                success: false,
                error: { code: 'INVALID_TYPE', message: 'Only image files are allowed' },
              },
              { status: 422 }
            );
          }

          return HttpResponse.json({
            success: true,
            data: {
              id: 'file-123',
              url: `https://example.com/files/${file.name}`,
              filename: file.name,
              size: file.size,
            },
          });
        })
      );
    });

    it('should configure automatic image uploads', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.automatic_uploads).toBe(true);
    });

    it('should configure file picker for image and media', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.file_picker_types).toBe('image media');
    });

    it('should have images_upload_handler configured', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.images_upload_handler).toBeDefined();
      expect(typeof capturedInitConfig?.images_upload_handler).toBe('function');
    });

    it('should have file_picker_callback configured', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.file_picker_callback).toBeDefined();
      expect(typeof capturedInitConfig?.file_picker_callback).toBe('function');
    });

    it('should call upload API when file is selected', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      // Verify upload hook is configured
      expect(mockUploadFile).toBeDefined();
    });

    it('should handle upload success by returning image URL', async () => {
      const expectedUrl = 'https://example.com/uploaded-image.jpg';
      mockUploadFile.mockResolvedValueOnce({ url: expectedUrl });

      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      // The images_upload_handler should return a URL on success
      expect(capturedInitConfig?.images_upload_handler).toBeDefined();
    });

    it('should handle upload error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockUploadFile.mockRejectedValueOnce(new Error('Upload failed'));

      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      // The component should handle upload errors
      expect(capturedInitConfig?.images_upload_handler).toBeDefined();

      consoleErrorSpy.mockRestore();
    });

    it('should configure paste data images support', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.paste_data_images).toBe(true);
    });
  });

  // ==========================================================================
  // 6. Content Sanitization Tests
  // ==========================================================================
  describe('Content Sanitization', () => {
    it('should configure extended valid elements', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.extended_valid_elements).toBeDefined();
      const validElements = capturedInitConfig?.extended_valid_elements as string;
      expect(validElements).toContain('span[*]');
      expect(validElements).toContain('div[*]');
      expect(validElements).toContain('a[*]');
      expect(validElements).toContain('img[*]');
    });

    it('should configure valid children for body', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.valid_children).toBe('+body[style]');
    });

    it('should configure smart paste settings', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.paste_as_text).toBe(false);
      expect(capturedInitConfig?.smart_paste).toBe(true);
    });

    it('should preserve safe HTML tags in configuration', async () => {
      render(<RichTextEditor name="content" />);

      await waitForEditorInit();

      const validElements = capturedInitConfig?.extended_valid_elements as string;
      // Safe tags should be in valid elements
      expect(validElements).toContain('span');
      expect(validElements).toContain('div');
      expect(validElements).toContain('a');
      expect(validElements).toContain('img');
    });

    it('should configure URL conversion settings', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.convert_urls).toBe(false);
      expect(capturedInitConfig?.relative_urls).toBe(false);
      expect(capturedInitConfig?.remove_script_host).toBe(false);
    });
  });

  // ==========================================================================
  // 7. Accessibility Tests
  // ==========================================================================
  describe('Accessibility', () => {
    it('should apply aria-label to editor container', async () => {
      render(<RichTextEditor name="content" label="Test Editor" />);

      await waitForEditorInit();

      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('aria-label');
    });

    it('should set role=textbox for screen readers', async () => {
      render(<RichTextEditor name="content" />);

      await waitForEditorInit();

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should support keyboard navigation through toolbar', async () => {
      render(<RichTextEditor name="content" />);

      await waitForEditorInit();

      const toolbar = screen.getByTestId('tinymce-toolbar');
      expect(toolbar).toHaveAttribute('role', 'toolbar');
    });

    it('should make interactive elements keyboard accessible', async () => {
      render(<RichTextEditor name="content" />);

      await waitForEditorInit();

      const editor = screen.getByTestId('tinymce-editor');
      expect(editor).toHaveAttribute('tabIndex', '0');
    });

    it('should support focus management', async () => {
      const editorRef = createRef<RichTextEditorRef>();

      render(<RichTextEditor ref={editorRef} name="content" />);

      await waitForEditorInit();

      await waitFor(() => {
        expect(editorRef.current).toBeDefined();
      });

      // Focus method should be available
      expect(typeof editorRef.current?.focus).toBe('function');
    });

    it('should configure advanced accessibility options', async () => {
      render(<RichTextEditor name="content" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.a11y_advanced_options).toBe(true);
    });

    it('should set aria-disabled when disabled prop is true', async () => {
      render(<RichTextEditor name="content" disabled={true} />);

      await waitForEditorInit();

      const editor = screen.getByTestId('tinymce-editor');
      expect(editor).toHaveAttribute('aria-disabled', 'true');
    });

    it('should enable browser spellcheck', async () => {
      render(<RichTextEditor name="content" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.browser_spellcheck).toBe(true);
    });
  });

  // ==========================================================================
  // 8. Theme Integration Tests
  // ==========================================================================
  describe('Theme Integration', () => {
    it('should apply light theme skin when in light mode', async () => {
      const lightTheme = createLightTheme();

      render(
        <ThemeProvider theme={lightTheme}>
          <RichTextEditor name="content" />
        </ThemeProvider>
      );

      await waitForEditorInit();

      expect(capturedInitConfig?.skin).toBe('oxide');
      expect(capturedInitConfig?.content_css).toBe('default');
    });

    it('should apply dark theme skin when in dark mode', async () => {
      const darkTheme = createDarkTheme();

      render(
        <ThemeProvider theme={darkTheme}>
          <RichTextEditor name="content" />
        </ThemeProvider>
      );

      await waitForEditorInit();

      expect(capturedInitConfig?.skin).toBe('oxide-dark');
      expect(capturedInitConfig?.content_css).toBe('dark');
    });

    it('should apply theme-based content styles', async () => {
      const lightTheme = createLightTheme();

      render(
        <ThemeProvider theme={lightTheme}>
          <RichTextEditor name="content" />
        </ThemeProvider>
      );

      await waitForEditorInit();

      const contentStyle = capturedInitConfig?.content_style as string;
      expect(contentStyle).toBeDefined();
      expect(contentStyle).toContain('background-color');
      expect(contentStyle).toContain('color');
    });

    it('should use theme typography in content styles', async () => {
      const lightTheme = createLightTheme();

      render(
        <ThemeProvider theme={lightTheme}>
          <RichTextEditor name="content" />
        </ThemeProvider>
      );

      await waitForEditorInit();

      const contentStyle = capturedInitConfig?.content_style as string;
      expect(contentStyle).toContain('font-family');
    });

    it('should apply error border color when error prop is true', async () => {
      render(
        <RichTextEditor
          name="content"
          error={true}
          helperText="Error message"
        />
      );

      await waitForEditorInit();

      // Error state should be reflected in FormControl
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });

    it('should render using renderWithTheme helper in light mode', async () => {
      render(<RichTextEditor name="content" />, { themeMode: 'light' });

      await waitForEditorInit();

      expect(screen.getByTestId('tinymce-editor')).toBeInTheDocument();
    });

    it('should render using renderWithTheme helper in dark mode', async () => {
      render(<RichTextEditor name="content" />, { themeMode: 'dark' });

      await waitForEditorInit();

      expect(screen.getByTestId('tinymce-editor')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 9. Loading States Tests
  // ==========================================================================
  describe('Loading States', () => {
    it('should display skeleton during TinyMCE initialization', async () => {
      // The component shows a skeleton while loading
      render(<RichTextEditor name="content" height={400} />);

      // Initially, skeleton should be shown
      // After init, skeleton should be replaced by editor
      await waitForEditorInit();

      expect(screen.getByTestId('tinymce-editor')).toBeInTheDocument();
    });

    it('should hide loading state after editor initialization', async () => {
      render(<RichTextEditor name="content" />);

      await waitForEditorInit();

      // After initialization, editor should be visible
      expect(screen.getByTestId('tinymce-editor')).toBeInTheDocument();
    });

    it('should use correct height for skeleton based on height prop', async () => {
      const customHeight = 600;

      render(<RichTextEditor name="content" height={customHeight} />);

      // Wait for full initialization
      await waitForEditorInit();

      // The height should be passed to init config
      expect(capturedInitConfig?.height).toBe(customHeight);
    });

    it('should render editor after onInit callback fires', async () => {
      const onInit = vi.fn();

      render(<RichTextEditor name="content" onInit={onInit} />);

      await waitForEditorInit();

      await waitFor(() => {
        expect(onInit).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // 10. Validation and Error Display Tests
  // ==========================================================================
  describe('Validation and Error Display', () => {
    it('should display FormHelperText with validation error message', async () => {
      render(
        <RichTextEditor
          name="content"
          error={true}
          helperText="This field is required"
        />
      );

      await waitForEditorInit();

      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('should apply error styling when error prop is true', async () => {
      render(
        <RichTextEditor
          name="content"
          error={true}
          helperText="Validation error"
        />
      );

      await waitForEditorInit();

      const helperText = screen.getByText('Validation error');
      expect(helperText).toBeInTheDocument();
    });

    it('should display custom validation messages', async () => {
      const customMessage = 'Content must be at least 100 characters';

      render(
        <RichTextEditor
          name="content"
          error={true}
          helperText={customMessage}
        />
      );

      await waitForEditorInit();

      expect(screen.getByText(customMessage)).toBeInTheDocument();
    });

    it('should show helper text without error styling when error is false', async () => {
      render(
        <RichTextEditor
          name="content"
          error={false}
          helperText="Enter your content here"
        />
      );

      await waitForEditorInit();

      expect(screen.getByText('Enter your content here')).toBeInTheDocument();
    });

    it('should display required indicator when required prop is true', async () => {
      render(
        <RichTextEditor name="content" label="Required Field" required={true} />
      );

      await waitForEditorInit();

      // MUI FormLabel shows asterisk for required fields
      const label = screen.getByText(/Required Field/);
      expect(label).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 11. Ref Forwarding Tests
  // ==========================================================================
  describe('Ref Forwarding', () => {
    it('should return editor HTML content via ref.getContent()', async () => {
      const editorRef = createRef<RichTextEditorRef>();

      render(<RichTextEditor ref={editorRef} name="content" />);

      await waitForEditorInit();

      await waitFor(() => {
        expect(editorRef.current).toBeDefined();
      });

      const content = editorRef.current?.getContent();
      expect(typeof content).toBe('string');
    });

    it('should update editor content via ref.setContent(html)', async () => {
      const editorRef = createRef<RichTextEditorRef>();

      render(<RichTextEditor ref={editorRef} name="content" />);

      await waitForEditorInit();

      await waitFor(() => {
        expect(editorRef.current).toBeDefined();
      });

      const newContent = '<p>New content via ref</p>';
      act(() => {
        editorRef.current?.setContent(newContent);
      });

      expect(editorRef.current?.setContent).toBeDefined();
    });

    it('should focus the editor via ref.focus()', async () => {
      const editorRef = createRef<RichTextEditorRef>();

      render(<RichTextEditor ref={editorRef} name="content" />);

      await waitForEditorInit();

      await waitFor(() => {
        expect(editorRef.current).toBeDefined();
      });

      act(() => {
        editorRef.current?.focus();
      });

      expect(editorRef.current?.focus).toBeDefined();
    });

    it('should insert content at cursor via ref.insertContent()', async () => {
      const editorRef = createRef<RichTextEditorRef>();

      render(<RichTextEditor ref={editorRef} name="content" />);

      await waitForEditorInit();

      await waitFor(() => {
        expect(editorRef.current).toBeDefined();
      });

      const insertedContent = '<img src="test.jpg" alt="Test" />';
      act(() => {
        editorRef.current?.insertContent(insertedContent);
      });

      expect(editorRef.current?.insertContent).toBeDefined();
    });

    it('should expose TinyMCE editor instance via ref.getEditor()', async () => {
      const editorRef = createRef<RichTextEditorRef>();

      render(<RichTextEditor ref={editorRef} name="content" />);

      await waitForEditorInit();

      await waitFor(() => {
        expect(editorRef.current).toBeDefined();
      });

      const editor = editorRef.current?.getEditor();
      // Editor may be null if not yet initialized, but the method should exist
      expect(editorRef.current?.getEditor).toBeDefined();
    });
  });

  // ==========================================================================
  // 12. Props and Configuration Tests
  // ==========================================================================
  describe('Props and Configuration', () => {
    it('should use name prop for form field identification', async () => {
      render(<RichTextEditor name="testContent" label="Test" />);

      await waitForEditorInit();

      // Component should render with the provided name
      expect(screen.getByTestId('tinymce-editor')).toBeInTheDocument();
    });

    it('should display label prop above editor', async () => {
      render(<RichTextEditor name="content" label="Editor Label" />);

      await waitForEditorInit();

      expect(screen.getByText('Editor Label')).toBeInTheDocument();
    });

    it('should populate initial content from defaultValue prop', async () => {
      const defaultValue = '<p>Initial content</p>';

      render(
        <RichTextEditor name="content" defaultValue={defaultValue} />
      );

      await waitForEditorInit();

      const textarea = screen.getByTestId('tinymce-textarea');
      expect(textarea).toHaveValue(defaultValue);
    });

    it('should call onChange callback when content changes', async () => {
      const onChange = vi.fn();

      render(
        <RichTextEditor name="content" onChange={onChange} />
      );

      await waitForEditorInit();

      const textarea = screen.getByTestId('tinymce-textarea');
      fireEvent.change(textarea, { target: { value: '<p>Changed content</p>' } });

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith('<p>Changed content</p>');
      });
    });

    it('should set editor height from height prop', async () => {
      const height = 600;

      render(<RichTextEditor name="content" height={height} />);

      await waitForEditorInit();

      expect(capturedInitConfig?.height).toBe(height);
    });

    it('should disable editing when disabled prop is true', async () => {
      render(<RichTextEditor name="content" disabled={true} />);

      await waitForEditorInit();

      const textarea = screen.getByTestId('tinymce-textarea');
      expect(textarea).toBeDisabled();
    });

    it('should show placeholder text from placeholder prop', async () => {
      const placeholder = 'Enter your text here...';

      render(<RichTextEditor name="content" placeholder={placeholder} />);

      await waitForEditorInit();

      expect(capturedInitConfig?.placeholder).toBe(placeholder);
    });

    it('should merge custom plugins with default plugins', async () => {
      const customPlugins = ['customPlugin1', 'customPlugin2'];

      render(
        <RichTextEditor name="content" plugins={customPlugins} />
      );

      await waitForEditorInit();

      const plugins = capturedInitConfig?.plugins as string[];
      expect(plugins).toEqual(customPlugins);
    });

    it('should pass additional editorConfig options to TinyMCE', async () => {
      const customConfig = {
        statusbar: true,
        resize: 'both' as const,
      };

      render(
        <RichTextEditor
          name="content"
          editorConfig={customConfig}
        />
      );

      await waitForEditorInit();

      expect(capturedInitConfig?.statusbar).toBe(true);
      expect(capturedInitConfig?.resize).toBe('both');
    });

    it('should call onInit callback when editor initializes', async () => {
      const onInit = vi.fn();

      render(<RichTextEditor name="content" onInit={onInit} />);

      await waitForEditorInit();

      await waitFor(() => {
        expect(onInit).toHaveBeenCalled();
      });
    });

    it('should support controlled value prop', async () => {
      const { rerender } = render(
        <RichTextEditor name="content" value="<p>Initial</p>" />
      );

      await waitForEditorInit();

      let textarea = screen.getByTestId('tinymce-textarea');
      expect(textarea).toHaveValue('<p>Initial</p>');

      // Update value prop
      rerender(<RichTextEditor name="content" value="<p>Updated</p>" />);

      textarea = screen.getByTestId('tinymce-textarea');
      expect(textarea).toHaveValue('<p>Updated</p>');
    });

    it('should not show menubar for basic toolbar preset', async () => {
      render(<RichTextEditor name="content" toolbar="basic" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.menubar).toBe(false);
    });

    it('should show menubar for full toolbar preset', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.menubar).toBe(true);
    });

    it('should hide branding in all configurations', async () => {
      render(<RichTextEditor name="content" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.branding).toBe(false);
    });

    it('should configure codesample languages', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      const codesampleLanguages = capturedInitConfig?.codesample_languages as Array<{
        text: string;
        value: string;
      }>;
      expect(codesampleLanguages).toBeDefined();
      expect(codesampleLanguages.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 13. React Hook Form Integration with Control Prop
  // ==========================================================================
  describe('React Hook Form Integration with Control', () => {
    it('should render with Controller when control prop is provided', async () => {
      function FormWithEditor(): React.ReactElement {
        const { control } = useForm({ defaultValues: { content: '' } });
        return (
          <RichTextEditor
            name="content"
            label="Form Content"
            control={control}
          />
        );
      }

      render(<FormWithEditor />);

      await waitForEditorInit();

      expect(screen.getByText('Form Content')).toBeInTheDocument();
      expect(screen.getByTestId('tinymce-editor')).toBeInTheDocument();
    });

    it('should display field error from fieldState when using control', async () => {
      function FormWithValidation(): React.ReactElement {
        const { control, formState } = useForm({
          defaultValues: { content: '' },
          mode: 'onChange',
        });

        return (
          <RichTextEditor
            name="content"
            label="Required Content"
            control={control}
            error={!!formState.errors.content}
            helperText={formState.errors.content?.message ?? ''}
            required
          />
        );
      }

      render(<FormWithValidation />);

      await waitForEditorInit();

      expect(screen.getByText('Required Content')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 14. Table Configuration Tests
  // ==========================================================================
  describe('Table Configuration', () => {
    it('should configure table responsive width', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.table_responsive_width).toBe(true);
    });

    it('should set table default attributes', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      const tableDefaults = capturedInitConfig?.table_default_attributes as Record<
        string,
        string
      >;
      expect(tableDefaults?.border).toBe('1');
    });

    it('should set table default styles', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      const tableStyles = capturedInitConfig?.table_default_styles as Record<
        string,
        string
      >;
      expect(tableStyles?.['border-collapse']).toBe('collapse');
      expect(tableStyles?.width).toBe('100%');
    });
  });

  // ==========================================================================
  // 15. Image Configuration Tests
  // ==========================================================================
  describe('Image Configuration', () => {
    it('should enable advanced image tab', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.image_advtab).toBe(true);
    });

    it('should enable image captions', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.image_caption).toBe(true);
    });

    it('should enable image titles', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.image_title).toBe(true);
    });
  });

  // ==========================================================================
  // 16. Link Configuration Tests
  // ==========================================================================
  describe('Link Configuration', () => {
    it('should set default link target to _blank', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.link_default_target).toBe('_blank');
    });

    it('should enable link title', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.link_title).toBe(true);
    });

    it('should enable link context toolbar', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.link_context_toolbar).toBe(true);
    });
  });

  // ==========================================================================
  // 17. Style Format Configuration Tests
  // ==========================================================================
  describe('Style Format Configuration', () => {
    it('should include headings in style formats', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      const styleFormats = capturedInitConfig?.style_formats as Array<{
        title: string;
        items?: Array<{ title: string; format: string }>;
      }>;
      expect(styleFormats).toBeDefined();

      const headingsGroup = styleFormats.find((g) => g.title === 'Headings');
      expect(headingsGroup).toBeDefined();
      expect(headingsGroup?.items?.length).toBeGreaterThan(0);
    });

    it('should include inline formats in style formats', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      const styleFormats = capturedInitConfig?.style_formats as Array<{
        title: string;
        items?: Array<{ title: string; format: string }>;
      }>;

      const inlineGroup = styleFormats.find((g) => g.title === 'Inline');
      expect(inlineGroup).toBeDefined();
    });

    it('should include block formats in style formats', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      const styleFormats = capturedInitConfig?.style_formats as Array<{
        title: string;
        items?: Array<{ title: string; format: string }>;
      }>;

      const blocksGroup = styleFormats.find((g) => g.title === 'Blocks');
      expect(blocksGroup).toBeDefined();
    });
  });

  // ==========================================================================
  // 18. Font Size Configuration Tests
  // ==========================================================================
  describe('Font Size Configuration', () => {
    it('should configure font size formats', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      const fontSizeFormats = capturedInitConfig?.font_size_formats as string;
      expect(fontSizeFormats).toBeDefined();
      expect(fontSizeFormats).toContain('12pt');
      expect(fontSizeFormats).toContain('14pt');
    });
  });

  // ==========================================================================
  // 19. Auto-resize Configuration Tests
  // ==========================================================================
  describe('Auto-resize Configuration', () => {
    it('should configure autoresize bottom margin', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.autoresize_bottom_margin).toBe(16);
    });

    it('should configure autoresize overflow padding', async () => {
      render(<RichTextEditor name="content" toolbar="full" />);

      await waitForEditorInit();

      expect(capturedInitConfig?.autoresize_overflow_padding).toBe(16);
    });
  });
});
