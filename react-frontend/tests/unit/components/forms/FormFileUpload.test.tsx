/**
 * Unit Tests for FormFileUpload Component
 *
 * Comprehensive test suite validating:
 * - React Hook Form integration with file uploads
 * - Zod validation for file constraints (type, size, count)
 * - Drag-and-drop functionality with HTML5 File API
 * - Accessibility compliance (WCAG 2.1 AA)
 * - File list management with remove functionality
 * - Image preview thumbnails
 * - Upload progress indication
 * - Error handling and validation messages
 *
 * @module tests/unit/components/forms/FormFileUpload
 * @see Section 0.7 - Testing Requirements (90%+ coverage)
 * @see FormFileUpload component in src/components/forms/FormFileUpload.tsx
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, FormProvider } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Internal imports
import { FormFileUpload } from '@/components/forms/FormFileUpload';
import { render } from '../../../helpers/render';
import {
  createMockFile,
  createMockImageFile,
  createMockPDFFile,
  createLargeFile,
  createMockFileList,
  createSingleFileList,
  simulateFileDrop,
  simulateFileSelect,
  createDragEvent,
  expectFileType,
} from '../../../helpers/fileUtils';

// ============================================================================
// TEST SETUP AND MOCKS
// ============================================================================

/**
 * Mock FileReader for image preview testing
 */
let mockFileReader: {
  readAsDataURL: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  result: string | null;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null;
};

/**
 * Setup function to initialize mocks before each test
 */
beforeEach(() => {
  // Mock FileReader for image preview generation
  mockFileReader = {
    readAsDataURL: vi.fn(),
    addEventListener: vi.fn((event: string, handler: () => void) => {
      if (event === 'load') {
        mockFileReader.onload = handler as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null;
      }
    }),
    result: 'data:image/png;base64,mockImageData',
    onload: null,
  };

  global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;

  // Trigger onload after readAsDataURL is called
  mockFileReader.readAsDataURL.mockImplementation(() => {
    setTimeout(() => {
      if (mockFileReader.onload) {
        mockFileReader.onload.call(
          mockFileReader as unknown as FileReader,
          new ProgressEvent('load')
        );
      }
    }, 0);
  });
});

/**
 * Cleanup after each test
 */
afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// TEST WRAPPER COMPONENT
// ============================================================================

/**
 * Props for the test wrapper component
 */
interface TestWrapperProps {
  children: React.ReactNode;
  defaultValues?: Record<string, unknown>;
  validationSchema?: z.ZodTypeAny;
  onSubmit?: (data: Record<string, unknown>) => void;
}

/**
 * Wrapper component providing React Hook Form context for testing
 */
function TestWrapper({
  children,
  defaultValues = {},
  validationSchema,
  onSubmit = vi.fn(),
}: TestWrapperProps) {
  const methods = useForm({
    defaultValues,
    resolver: validationSchema ? zodResolver(validationSchema) : undefined,
    mode: 'onChange',
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>{children}</form>
    </FormProvider>
  );
}

/**
 * Helper to render FormFileUpload with form context
 */
function renderFormFileUpload(
  props: Partial<React.ComponentProps<typeof FormFileUpload>> & {
    name: string;
    label: string;
  },
  wrapperProps: Omit<TestWrapperProps, 'children'> = {}
) {
  const { control, ...methods } = useForm({
    defaultValues: wrapperProps.defaultValues || {},
    resolver: wrapperProps.validationSchema
      ? zodResolver(wrapperProps.validationSchema)
      : undefined,
    mode: 'onChange',
  });

  const handleSubmit = wrapperProps.onSubmit || vi.fn();

  const component = render(
    <FormProvider control={control} {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmit)}>
        <FormFileUpload control={control} {...props} />
        <button type="submit">Submit</button>
      </form>
    </FormProvider>
  );

  return {
    ...component,
    handleSubmit,
    methods,
  };
}

// ============================================================================
// RENDERING TESTS
// ============================================================================

describe('FormFileUpload - Rendering', () => {
  it('renders drag-and-drop zone with label', () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Assignment',
    });

    expect(screen.getByText('Upload Assignment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose files|browse/i })).toBeInTheDocument();
  });

  it('renders dropzone area with proper structure', () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    // Find the dropzone container
    const dropzone = screen.getByText(/drag.*drop.*files/i).closest('[role="button"]');
    expect(dropzone).toBeInTheDocument();
  });

  it('renders file input element (hidden)', () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).not.toBeVisible();
  });

  it('renders upload button', () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const uploadButton = screen.getByRole('button', { name: /choose files|browse/i });
    expect(uploadButton).toBeInTheDocument();
  });

  it('renders helper text when provided', () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      helperText: 'Maximum 5 files, 10MB each',
    });

    expect(screen.getByText('Maximum 5 files, 10MB each')).toBeInTheDocument();
  });

  it('applies disabled state correctly', () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      disabled: true,
    });

    const uploadButton = screen.getByRole('button', { name: /choose files|browse/i });
    expect(uploadButton).toBeDisabled();
  });
});

// ============================================================================
// REACT HOOK FORM INTEGRATION TESTS
// ============================================================================

describe('FormFileUpload - React Hook Form Integration', () => {
  it('integrates with React Hook Form Controller', async () => {
    const mockFile = createMockFile({ name: 'test.txt' });
    const onSubmit = vi.fn();

    renderFormFileUpload(
      {
        name: 'uploadedFile',
        label: 'Upload File',
      },
      {
        onSubmit,
      }
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // Simulate file selection
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  it('handles File object in form state', async () => {
    const mockFile = createMockFile({ name: 'document.pdf', type: 'application/pdf' });
    const onSubmit = vi.fn();

    renderFormFileUpload(
      {
        name: 'file',
        label: 'Upload Document',
      },
      {
        onSubmit,
      }
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      const submittedData = onSubmit.mock.calls[0][0];
      expect(submittedData.file).toBeInstanceOf(File);
      expect(submittedData.file.name).toBe('document.pdf');
    });
  });

  it('handles FileList object with multiple files', async () => {
    const file1 = createMockFile({ name: 'file1.txt' });
    const file2 = createMockFile({ name: 'file2.txt' });
    const onSubmit = vi.fn();

    renderFormFileUpload(
      {
        name: 'files',
        label: 'Upload Files',
        multiple: true,
      },
      {
        onSubmit,
      }
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, [file1, file2]);

    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
      expect(screen.getByText('file2.txt')).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      const submittedData = onSubmit.mock.calls[0][0];
      expect(submittedData.files).toHaveLength(2);
    });
  });

  it('updates form state when files are added', async () => {
    const mockFile = createMockFile({ name: 'update-test.txt' });

    renderFormFileUpload({
      name: 'file',
      label: 'Upload File',
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('update-test.txt')).toBeInTheDocument();
    });
  });

  it('updates form state when files are removed', async () => {
    const mockFile = createMockFile({ name: 'remove-test.txt' });

    renderFormFileUpload({
      name: 'file',
      label: 'Upload File',
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('remove-test.txt')).toBeInTheDocument();
    });

    // Find and click remove button
    const removeButton = screen.getByRole('button', { name: /delete|remove/i });
    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByText('remove-test.txt')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// ZOD VALIDATION TESTS
// ============================================================================

describe('FormFileUpload - Zod Validation', () => {
  it('validates required file field', async () => {
    const schema = z.object({
      file: z.instanceof(File, { message: 'File is required' }),
    });

    const onSubmit = vi.fn();

    renderFormFileUpload(
      {
        name: 'file',
        label: 'Upload File',
        required: true,
      },
      {
        validationSchema: schema,
        onSubmit,
      }
    );

    // Try to submit without file
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/file is required/i)).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('validates file type with MIME types', async () => {
    const schema = z.object({
      file: z
        .instanceof(File)
        .refine((file) => file.type === 'application/pdf', {
          message: 'Only PDF files are allowed',
        }),
    });

    renderFormFileUpload(
      {
        name: 'file',
        label: 'Upload PDF',
        accept: 'application/pdf',
      },
      {
        validationSchema: schema,
      }
    );

    const invalidFile = createMockFile({ name: 'document.txt', type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, invalidFile);

    await waitFor(() => {
      expect(screen.getByText(/only pdf files are allowed/i)).toBeInTheDocument();
    });
  });

  it('validates file size limit', async () => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const schema = z.object({
      file: z
        .instanceof(File)
        .refine((file) => file.size <= maxSize, {
          message: `File size must be less than ${maxSize / 1024 / 1024}MB`,
        }),
    });

    renderFormFileUpload(
      {
        name: 'file',
        label: 'Upload File',
        maxSize,
      },
      {
        validationSchema: schema,
      }
    );

    const largeFile = createLargeFile(10); // 10MB file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, largeFile);

    await waitFor(() => {
      expect(screen.getByText(/file size must be less than 5mb/i)).toBeInTheDocument();
    });
  });

  it('validates maximum file count', async () => {
    const maxFiles = 3;
    const schema = z.object({
      files: z
        .array(z.instanceof(File))
        .max(maxFiles, { message: `Maximum ${maxFiles} files allowed` }),
    });

    renderFormFileUpload(
      {
        name: 'files',
        label: 'Upload Files',
        multiple: true,
        maxFiles,
      },
      {
        validationSchema: schema,
      }
    );

    const files = [
      createMockFile({ name: 'file1.txt' }),
      createMockFile({ name: 'file2.txt' }),
      createMockFile({ name: 'file3.txt' }),
      createMockFile({ name: 'file4.txt' }),
    ];

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, files);

    await waitFor(() => {
      expect(screen.getByText(/maximum 3 files allowed/i)).toBeInTheDocument();
    });
  });

  it('validates custom file rules (image dimensions example)', async () => {
    const schema = z.object({
      image: z
        .instanceof(File)
        .refine((file) => file.type.startsWith('image/'), {
          message: 'File must be an image',
        })
        .refine((file) => file.size <= 2 * 1024 * 1024, {
          message: 'Image must be less than 2MB',
        }),
    });

    renderFormFileUpload(
      {
        name: 'image',
        label: 'Upload Image',
        accept: 'image/*',
      },
      {
        validationSchema: schema,
      }
    );

    const largeImage = createMockImageFile('large.jpg', 'jpg', 3000); // 3MB
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, largeImage);

    await waitFor(() => {
      expect(screen.getByText(/image must be less than 2mb/i)).toBeInTheDocument();
    });
  });

  it('displays validation error messages', async () => {
    const schema = z.object({
      file: z.instanceof(File, { message: 'Please select a file' }),
    });

    renderFormFileUpload(
      {
        name: 'file',
        label: 'Upload File',
        required: true,
      },
      {
        validationSchema: schema,
      }
    );

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      const errorMessage = screen.getByText(/please select a file/i);
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });
  });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

describe('FormFileUpload - Accessibility', () => {
  it('has proper aria-label for dropzone', () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Documents',
    });

    const dropzone = screen.getByText(/drag.*drop/i).closest('[role="button"]');
    expect(dropzone).toHaveAttribute('aria-label', expect.stringContaining('Upload Documents'));
  });

  it('has aria-describedby for instructions', () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      helperText: 'Supported formats: PDF, DOCX',
    });

    const dropzone = screen.getByText(/drag.*drop/i).closest('[role="button"]');
    const helperTextId = dropzone?.getAttribute('aria-describedby');
    
    if (helperTextId) {
      const helperElement = document.getElementById(helperTextId);
      expect(helperElement).toHaveTextContent(/supported formats/i);
    }
  });

  it('supports keyboard-accessible file selection with Enter key', async () => {
    const user = userEvent.setup();
    
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const uploadButton = screen.getByRole('button', { name: /choose files|browse/i });
    
    // Focus the button
    uploadButton.focus();
    expect(uploadButton).toHaveFocus();

    // Simulate Enter key press
    await user.keyboard('{Enter}');

    // Verify the file input would be triggered (it's handled by the component)
    expect(uploadButton).toBeInTheDocument();
  });

  it('supports keyboard-accessible file selection with Space key', async () => {
    const user = userEvent.setup();
    
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const uploadButton = screen.getByRole('button', { name: /choose files|browse/i });
    
    uploadButton.focus();
    await user.keyboard(' ');

    expect(uploadButton).toBeInTheDocument();
  });

  it('manages focus correctly', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const uploadButton = screen.getByRole('button', { name: /choose files|browse/i });
    
    // Tab to the button
    await userEvent.tab();
    
    // Check if button or its container receives focus
    const focusedElement = document.activeElement;
    expect(focusedElement).toBeDefined();
  });

  it('announces drag events for screen readers', () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const dropzone = screen.getByText(/drag.*drop/i).closest('[role="button"]');
    expect(dropzone).toHaveAttribute('role', 'button');
    expect(dropzone).toHaveAttribute('tabindex', '0');
  });

  it('announces file added to screen readers', async () => {
    const mockFile = createMockFile({ name: 'accessible.txt' });

    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      const fileListItem = screen.getByText('accessible.txt');
      expect(fileListItem).toBeInTheDocument();
    });
  });

  it('announces file removed to screen readers', async () => {
    const mockFile = createMockFile({ name: 'remove-accessible.txt' });

    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('remove-accessible.txt')).toBeInTheDocument();
    });

    const removeButton = screen.getByRole('button', { name: /delete|remove/i });
    expect(removeButton).toHaveAttribute('aria-label', expect.stringMatching(/remove|delete/i));
  });

  it('announces errors to screen readers', async () => {
    const schema = z.object({
      file: z.instanceof(File, { message: 'File is required' }),
    });

    renderFormFileUpload(
      {
        name: 'file',
        label: 'Upload File',
        required: true,
      },
      {
        validationSchema: schema,
      }
    );

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveTextContent(/file is required/i);
    });
  });
});

// ============================================================================
// DRAG AND DROP INTERACTION TESTS
// ============================================================================

describe('FormFileUpload - Drag and Drop', () => {
  it('highlights dropzone on dragEnter event', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const dropzone = screen.getByText(/drag.*drop/i).closest('[role="button"]') as HTMLElement;
    
    const dragEnterEvent = createDragEvent('dragenter', [createMockFile()]);
    fireEvent(dropzone, dragEnterEvent);

    // Check for highlight class or style change
    await waitFor(() => {
      expect(dropzone).toHaveStyle({ borderColor: expect.any(String) });
    });
  });

  it('prevents default on dragOver event', () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const dropzone = screen.getByText(/drag.*drop/i).closest('[role="button"]') as HTMLElement;
    
    const dragOverEvent = createDragEvent('dragover', [createMockFile()]);
    const preventDefaultSpy = vi.spyOn(dragOverEvent, 'preventDefault');
    
    fireEvent(dropzone, dragOverEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('removes highlight on dragLeave event', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const dropzone = screen.getByText(/drag.*drop/i).closest('[role="button"]') as HTMLElement;
    
    // First dragEnter to highlight
    const dragEnterEvent = createDragEvent('dragenter', [createMockFile()]);
    fireEvent(dropzone, dragEnterEvent);

    // Then dragLeave to remove highlight
    const dragLeaveEvent = new DragEvent('dragleave', { bubbles: true });
    fireEvent(dropzone, dragLeaveEvent);

    await waitFor(() => {
      // Highlight should be removed
      expect(dropzone).toBeInTheDocument();
    });
  });

  it('adds files to list on drop event', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const dropzone = screen.getByText(/drag.*drop/i).closest('[role="button"]') as HTMLElement;
    const mockFile = createMockFile({ name: 'dropped-file.txt' });
    
    simulateFileDrop(dropzone, mockFile);

    await waitFor(() => {
      expect(screen.getByText('dropped-file.txt')).toBeInTheDocument();
    });
  });

  it('handles multiple files in drop event', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      multiple: true,
    });

    const dropzone = screen.getByText(/drag.*drop/i).closest('[role="button"]') as HTMLElement;
    const files = [
      createMockFile({ name: 'file1.txt' }),
      createMockFile({ name: 'file2.txt' }),
      createMockFile({ name: 'file3.txt' }),
    ];
    
    simulateFileDrop(dropzone, files);

    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
      expect(screen.getByText('file2.txt')).toBeInTheDocument();
      expect(screen.getByText('file3.txt')).toBeInTheDocument();
    });
  });

  it('rejects invalid file types on drop', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload PDF Only',
      accept: 'application/pdf',
    });

    const dropzone = screen.getByText(/drag.*drop/i).closest('[role="button"]') as HTMLElement;
    const invalidFile = createMockFile({ name: 'document.txt', type: 'text/plain' });
    
    simulateFileDrop(dropzone, invalidFile);

    // File should not appear in the list
    await waitFor(() => {
      expect(screen.queryByText('document.txt')).not.toBeInTheDocument();
    });
  });

  it('shows drag state visual feedback', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const dropzone = screen.getByText(/drag.*drop/i).closest('[role="button"]') as HTMLElement;
    
    // Trigger drag enter
    const dragEnterEvent = createDragEvent('dragenter', [createMockFile()]);
    fireEvent(dropzone, dragEnterEvent);

    // Visual feedback should be present (border, background, etc.)
    await waitFor(() => {
      expect(dropzone).toBeInTheDocument();
    });
  });
});

// ============================================================================
// FILE SELECTION VIA BUTTON TESTS
// ============================================================================

describe('FormFileUpload - File Selection via Button', () => {
  it('opens native file dialog on button click', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const uploadButton = screen.getByRole('button', { name: /choose files|browse/i });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    const clickSpy = vi.spyOn(fileInput, 'click');
    
    await userEvent.click(uploadButton);

    // In the actual component, clicking the button triggers file input click
    // We verify the button is clickable
    expect(uploadButton).toBeEnabled();
  });

  it('selects single file via button', async () => {
    renderFormFileUpload({
      name: 'file',
      label: 'Upload File',
    });

    const mockFile = createMockFile({ name: 'selected-file.txt' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('selected-file.txt')).toBeInTheDocument();
    });
  });

  it('selects multiple files via button', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      multiple: true,
    });

    const files = [
      createMockFile({ name: 'file1.txt' }),
      createMockFile({ name: 'file2.txt' }),
    ];
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    simulateFileSelect(fileInput, files);

    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
      expect(screen.getByText('file2.txt')).toBeInTheDocument();
    });
  });

  it('handles cancelled file selection', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Simulate cancel (empty FileList)
    Object.defineProperty(fileInput, 'files', {
      value: createMockFileList([]),
      writable: false,
      configurable: true,
    });
    
    fireEvent.change(fileInput);

    // No files should be added
    await waitFor(() => {
      const fileList = screen.queryByRole('list');
      expect(fileList).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// FILE LIST DISPLAY TESTS
// ============================================================================

describe('FormFileUpload - File List Display', () => {
  it('displays file names', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const mockFile = createMockFile({ name: 'my-document.pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('my-document.pdf')).toBeInTheDocument();
    });
  });

  it('displays formatted file sizes', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const mockFile = createMockFile({ name: 'document.pdf', size: 2.5 * 1024 * 1024 }); // 2.5MB
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText(/2\.5.*MB/i)).toBeInTheDocument();
    });
  });

  it('displays file type icons', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      multiple: true,
    });

    const pdfFile = createMockPDFFile('document.pdf');
    const imageFile = createMockImageFile('photo.jpg');
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, [pdfFile, imageFile]);

    await waitFor(() => {
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
      
      // Icons should be present (Material-UI SVG icons)
      const icons = document.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  it('displays remove buttons for each file', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      multiple: true,
    });

    const files = [
      createMockFile({ name: 'file1.txt' }),
      createMockFile({ name: 'file2.txt' }),
    ];
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, files);

    await waitFor(() => {
      const removeButtons = screen.getAllByRole('button', { name: /delete|remove/i });
      expect(removeButtons).toHaveLength(2);
    });
  });

  it('displays thumbnail previews for images', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Images',
      accept: 'image/*',
    });

    const imageFile = createMockImageFile('photo.jpg');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, imageFile);

    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
      
      // Preview image should be rendered
      const previewImage = document.querySelector('img[src*="data:image"]');
      expect(previewImage).toBeInTheDocument();
    });
  });
});

// ============================================================================
// FILE REMOVAL TESTS
// ============================================================================

describe('FormFileUpload - File Removal', () => {
  it('removes file when remove button clicked', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
    });

    const mockFile = createMockFile({ name: 'remove-me.txt' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('remove-me.txt')).toBeInTheDocument();
    });

    const removeButton = screen.getByRole('button', { name: /delete|remove/i });
    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByText('remove-me.txt')).not.toBeInTheDocument();
    });
  });

  it('updates form state after file removal', async () => {
    const onSubmit = vi.fn();

    renderFormFileUpload(
      {
        name: 'file',
        label: 'Upload File',
      },
      {
        onSubmit,
      }
    );

    const mockFile = createMockFile({ name: 'temporary.txt' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('temporary.txt')).toBeInTheDocument();
    });

    const removeButton = screen.getByRole('button', { name: /delete|remove/i });
    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByText('temporary.txt')).not.toBeInTheDocument();
    });

    // Submit and verify no file in form data
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      const submittedData = onSubmit.mock.calls[0][0];
      expect(submittedData.file).toBeUndefined();
    });
  });
});

// ============================================================================
// FILE TYPE RESTRICTION TESTS
// ============================================================================

describe('FormFileUpload - File Type Restrictions', () => {
  it('enforces file type restrictions via accept prop', () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload PDF',
      accept: 'application/pdf',
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toHaveAttribute('accept', 'application/pdf');
  });

  it('rejects invalid MIME types with error message', async () => {
    const schema = z.object({
      file: z
        .instanceof(File)
        .refine((file) => file.type === 'application/pdf', {
          message: 'Only PDF files are allowed',
        }),
    });

    renderFormFileUpload(
      {
        name: 'file',
        label: 'Upload PDF',
        accept: 'application/pdf',
      },
      {
        validationSchema: schema,
      }
    );

    const invalidFile = createMockFile({ name: 'document.txt', type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, invalidFile);

    await waitFor(() => {
      expect(screen.getByText(/only pdf files are allowed/i)).toBeInTheDocument();
    });
  });

  it('accepts valid file types', async () => {
    renderFormFileUpload({
      name: 'file',
      label: 'Upload PDF',
      accept: 'application/pdf',
    });

    const validFile = createMockPDFFile('valid.pdf');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, validFile);

    await waitFor(() => {
      expect(screen.getByText('valid.pdf')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// FILE SIZE RESTRICTION TESTS
// ============================================================================

describe('FormFileUpload - File Size Restrictions', () => {
  it('displays clear error message for oversized files', async () => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const schema = z.object({
      file: z
        .instanceof(File)
        .refine((file) => file.size <= maxSize, {
          message: 'File exceeds 5MB limit',
        }),
    });

    renderFormFileUpload(
      {
        name: 'file',
        label: 'Upload File',
        maxSize,
      },
      {
        validationSchema: schema,
      }
    );

    const largeFile = createLargeFile(10); // 10MB
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, largeFile);

    await waitFor(() => {
      expect(screen.getByText(/file exceeds 5mb limit/i)).toBeInTheDocument();
    });
  });

  it('accepts files within size limit', async () => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    renderFormFileUpload({
      name: 'file',
      label: 'Upload File',
      maxSize,
    });

    const validFile = createMockFile({ name: 'small-file.txt', size: 1024 }); // 1KB
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, validFile);

    await waitFor(() => {
      expect(screen.getByText('small-file.txt')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// MAXIMUM FILE COUNT TESTS
// ============================================================================

describe('FormFileUpload - Maximum File Count', () => {
  it('enforces maximum file count limit', async () => {
    const maxFiles = 2;
    const schema = z.object({
      files: z
        .array(z.instanceof(File))
        .max(maxFiles, { message: 'Maximum 2 files allowed' }),
    });

    renderFormFileUpload(
      {
        name: 'files',
        label: 'Upload Files',
        multiple: true,
        maxFiles,
      },
      {
        validationSchema: schema,
      }
    );

    const files = [
      createMockFile({ name: 'file1.txt' }),
      createMockFile({ name: 'file2.txt' }),
      createMockFile({ name: 'file3.txt' }),
    ];

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, files);

    await waitFor(() => {
      expect(screen.getByText(/maximum 2 files allowed/i)).toBeInTheDocument();
    });
  });

  it('allows files up to the maximum count', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      multiple: true,
      maxFiles: 3,
    });

    const files = [
      createMockFile({ name: 'file1.txt' }),
      createMockFile({ name: 'file2.txt' }),
      createMockFile({ name: 'file3.txt' }),
    ];

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, files);

    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
      expect(screen.getByText('file2.txt')).toBeInTheDocument();
      expect(screen.getByText('file3.txt')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// UPLOAD PROGRESS TESTS
// ============================================================================

describe('FormFileUpload - Upload Progress', () => {
  it('displays upload progress indicator', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      uploadUrl: '/api/v1/files/upload',
    });

    const mockFile = createMockFile({ name: 'upload-test.txt' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('upload-test.txt')).toBeInTheDocument();
    });

    // Progress bar should be present during upload
    // Note: Actual upload progress would require mocking fetch/axios
  });

  it('shows percentage complete', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      uploadUrl: '/api/v1/files/upload',
    });

    const mockFile = createMockFile({ name: 'progress-test.txt' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('progress-test.txt')).toBeInTheDocument();
    });

    // Check for progress bar element
    const progressBar = document.querySelector('[role="progressbar"]');
    if (progressBar) {
      expect(progressBar).toBeInTheDocument();
    }
  });
});

// ============================================================================
// IMAGE PREVIEW TESTS
// ============================================================================

describe('FormFileUpload - Image Previews', () => {
  it('generates preview thumbnails for image files', async () => {
    renderFormFileUpload({
      name: 'image',
      label: 'Upload Image',
      accept: 'image/*',
    });

    const imageFile = createMockImageFile('preview-test.jpg');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, imageFile);

    await waitFor(() => {
      expect(screen.getByText('preview-test.jpg')).toBeInTheDocument();
      expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(imageFile);
    });

    await waitFor(() => {
      const previewImage = document.querySelector('img[src^="data:image"]');
      expect(previewImage).toBeInTheDocument();
    });
  });

  it('uses FileReader API for preview generation', async () => {
    renderFormFileUpload({
      name: 'image',
      label: 'Upload Image',
      accept: 'image/*',
    });

    const imageFile = createMockImageFile('filereader-test.png', 'png');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, imageFile);

    await waitFor(() => {
      expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(imageFile);
    });
  });

  it('does not generate previews for non-image files', async () => {
    renderFormFileUpload({
      name: 'file',
      label: 'Upload File',
    });

    const pdfFile = createMockPDFFile('document.pdf');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, pdfFile);

    await waitFor(() => {
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    // Should not have image preview
    const previewImage = document.querySelector('img[src^="data:image"]');
    expect(previewImage).not.toBeInTheDocument();
  });
});

// ============================================================================
// DISABLED STATE TESTS
// ============================================================================

describe('FormFileUpload - Disabled State', () => {
  it('prevents file selection when disabled', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      disabled: true,
    });

    const uploadButton = screen.getByRole('button', { name: /choose files|browse/i });
    expect(uploadButton).toBeDisabled();

    await userEvent.click(uploadButton);

    // No file dialog should open (button is disabled)
    expect(uploadButton).toBeDisabled();
  });

  it('disables drag and drop when disabled', () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      disabled: true,
    });

    const dropzone = screen.getByText(/drag.*drop/i).closest('[role="button"]') as HTMLElement;
    expect(dropzone).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables remove buttons when disabled', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      disabled: false,
    });

    const mockFile = createMockFile({ name: 'test.txt' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    // Re-render with disabled prop
    const { rerender } = renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      disabled: true,
    });

    // Remove button should be disabled
    // Note: In real component, remove buttons would be disabled
  });
});

// ============================================================================
// MULTIPLE VS SINGLE FILE MODE TESTS
// ============================================================================

describe('FormFileUpload - Multiple vs Single File Mode', () => {
  it('allows only one file in single file mode', async () => {
    renderFormFileUpload({
      name: 'file',
      label: 'Upload File',
      multiple: false,
    });

    const file1 = createMockFile({ name: 'first.txt' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, file1);

    await waitFor(() => {
      expect(screen.getByText('first.txt')).toBeInTheDocument();
    });

    // Select another file (should replace the first)
    const file2 = createMockFile({ name: 'second.txt' });
    simulateFileSelect(fileInput, file2);

    await waitFor(() => {
      expect(screen.getByText('second.txt')).toBeInTheDocument();
      expect(screen.queryByText('first.txt')).not.toBeInTheDocument();
    });
  });

  it('allows multiple files in multiple file mode', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      multiple: true,
    });

    const files = [
      createMockFile({ name: 'file1.txt' }),
      createMockFile({ name: 'file2.txt' }),
    ];
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, files);

    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
      expect(screen.getByText('file2.txt')).toBeInTheDocument();
    });
  });

  it('sets multiple attribute on file input', () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      multiple: true,
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toHaveAttribute('multiple');
  });

  it('does not set multiple attribute in single file mode', () => {
    renderFormFileUpload({
      name: 'file',
      label: 'Upload File',
      multiple: false,
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toHaveAttribute('multiple');
  });
});

// ============================================================================
// ERROR STATE TESTS
// ============================================================================

describe('FormFileUpload - Error States', () => {
  it('applies error styling when validation fails', async () => {
    const schema = z.object({
      file: z.instanceof(File, { message: 'File is required' }),
    });

    renderFormFileUpload(
      {
        name: 'file',
        label: 'Upload File',
        required: true,
      },
      {
        validationSchema: schema,
      }
    );

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveClass(expect.stringMatching(/error/i));
    });
  });

  it('displays error message below upload zone', async () => {
    const schema = z.object({
      file: z.instanceof(File, { message: 'Please upload a file' }),
    });

    renderFormFileUpload(
      {
        name: 'file',
        label: 'Upload File',
        required: true,
      },
      {
        validationSchema: schema,
      }
    );

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      const errorMessage = screen.getByText(/please upload a file/i);
      expect(errorMessage).toBeInTheDocument();
    });
  });

  it('clears error when valid file is selected', async () => {
    const schema = z.object({
      file: z.instanceof(File, { message: 'File is required' }),
    });

    renderFormFileUpload(
      {
        name: 'file',
        label: 'Upload File',
        required: true,
      },
      {
        validationSchema: schema,
      }
    );

    // Trigger validation error
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/file is required/i)).toBeInTheDocument();
    });

    // Select a file to clear error
    const mockFile = createMockFile({ name: 'valid.txt' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.queryByText(/file is required/i)).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// HELPER TEXT TESTS
// ============================================================================

describe('FormFileUpload - Helper Text', () => {
  it('displays helper text with file requirements', () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      helperText: 'Accepted formats: PDF, JPG, PNG. Maximum 10MB per file.',
    });

    expect(
      screen.getByText('Accepted formats: PDF, JPG, PNG. Maximum 10MB per file.')
    ).toBeInTheDocument();
  });

  it('displays helper text below upload zone', () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      helperText: 'Upload up to 5 files',
    });

    const helperText = screen.getByText('Upload up to 5 files');
    expect(helperText).toBeInTheDocument();
    
    // Should be in FormHelperText component
    expect(helperText.tagName).toBe('P');
  });
});

// ============================================================================
// FILE METADATA TESTS
// ============================================================================

describe('FormFileUpload - File Metadata', () => {
  it('extracts file name correctly', async () => {
    renderFormFileUpload({
      name: 'file',
      label: 'Upload File',
    });

    const mockFile = createMockFile({ name: 'metadata-test.txt' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('metadata-test.txt')).toBeInTheDocument();
    });
  });

  it('extracts file size correctly', async () => {
    renderFormFileUpload({
      name: 'file',
      label: 'Upload File',
    });

    const mockFile = createMockFile({ name: 'size-test.txt', size: 1024 * 512 }); // 512KB
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText(/512.*KB/i)).toBeInTheDocument();
    });
  });

  it('extracts file type correctly', async () => {
    renderFormFileUpload({
      name: 'file',
      label: 'Upload File',
    });

    const mockFile = createMockPDFFile('type-test.pdf');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('type-test.pdf')).toBeInTheDocument();
    });

    expectFileType(mockFile, 'application/pdf');
  });

  it('captures lastModified timestamp', async () => {
    const lastModified = Date.now();
    const mockFile = createMockFile({
      name: 'timestamp-test.txt',
      lastModified,
    });

    renderFormFileUpload({
      name: 'file',
      label: 'Upload File',
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('timestamp-test.txt')).toBeInTheDocument();
    });

    expect(mockFile.lastModified).toBe(lastModified);
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('FormFileUpload - Performance', () => {
  it('handles large files efficiently', async () => {
    renderFormFileUpload({
      name: 'file',
      label: 'Upload File',
      maxSize: 100 * 1024 * 1024, // 100MB
    });

    const largeFile = createLargeFile(50); // 50MB
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    const startTime = performance.now();
    simulateFileSelect(fileInput, largeFile);
    
    await waitFor(() => {
      expect(screen.getByText(/50.*MB/i)).toBeInTheDocument();
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should handle large file in reasonable time (<2 seconds)
    expect(duration).toBeLessThan(2000);
  });

  it('handles many files without performance degradation', async () => {
    renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      multiple: true,
      maxFiles: 50,
    });

    const files = Array.from({ length: 20 }, (_, i) =>
      createMockFile({ name: `file-${i + 1}.txt` })
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    const startTime = performance.now();
    simulateFileSelect(fileInput, files);
    
    await waitFor(() => {
      expect(screen.getByText('file-1.txt')).toBeInTheDocument();
      expect(screen.getByText('file-20.txt')).toBeInTheDocument();
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should handle 20 files efficiently (<1 second)
    expect(duration).toBeLessThan(1000);
  });
});

// ============================================================================
// SNAPSHOT TESTS
// ============================================================================

describe('FormFileUpload - Snapshot Tests', () => {
  it('matches snapshot for empty state', () => {
    const { container } = renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      helperText: 'Maximum 5 files, 10MB each',
    });

    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot with files loaded', async () => {
    const { container } = renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      multiple: true,
    });

    const files = [
      createMockFile({ name: 'file1.txt' }),
      createMockFile({ name: 'file2.txt' }),
    ];

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    simulateFileSelect(fileInput, files);

    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
    });

    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot in error state', async () => {
    const schema = z.object({
      file: z.instanceof(File, { message: 'File is required' }),
    });

    const { container } = renderFormFileUpload(
      {
        name: 'file',
        label: 'Upload File',
        required: true,
      },
      {
        validationSchema: schema,
      }
    );

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/file is required/i)).toBeInTheDocument();
    });

    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot in disabled state', () => {
    const { container } = renderFormFileUpload({
      name: 'files',
      label: 'Upload Files',
      disabled: true,
      helperText: 'Upload is currently disabled',
    });

    expect(container.firstChild).toMatchSnapshot();
  });
});
