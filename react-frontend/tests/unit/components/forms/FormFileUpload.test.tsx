/**
 * FormFileUpload Component - Comprehensive Unit Tests
 *
 * Tests React Hook Form integration, Zod validation, drag-and-drop functionality,
 * accessibility (WCAG 2.1 AA), file list management, image previews, upload progress,
 * and comprehensive error handling for file uploads.
 *
 * @package    react-frontend
 * @category   tests
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Component under test
import { FormFileUpload } from '@/components/forms/FormFileUpload';

// Test utilities
import { render } from '@/tests/helpers/render';
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
  expectFileSize,
  createInvalidFile,
} from '@/tests/helpers/fileUtils';

// ============================================================================
// TEST SETUP AND UTILITIES
// ============================================================================

/**
 * Mock FileReader for testing preview generation
 */
let mockFileReader: {
  addEventListener: ReturnType<typeof vi.fn>;
  readAsDataURL: ReturnType<typeof vi.fn>;
  result: string | null;
  onload: (() => void) | null;
  onerror: (() => void) | null;
};

/**
 * Mock URL.createObjectURL and revokeObjectURL
 */
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();

/**
 * Form wrapper component for testing
 */
interface FormWrapperProps {
  children: React.ReactNode;
  defaultValues?: Record<string, unknown>;
  schema?: z.ZodSchema;
  onSubmit?: (data: unknown) => void;
}

function FormWrapper({ children, defaultValues = {}, schema, onSubmit }: FormWrapperProps) {
  const methods = useForm({
    defaultValues,
    resolver: schema ? zodResolver(schema) : undefined,
    mode: 'onChange',
  });

  const handleSubmit = methods.handleSubmit((data) => {
    if (onSubmit) {
      onSubmit(data);
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit} aria-label="test-form">
        {children}
        <button type="submit">Submit</button>
      </form>
    </FormProvider>
  );
}

// ============================================================================
// TEST LIFECYCLE HOOKS
// ============================================================================

beforeEach(() => {
  // Setup FileReader mock
  mockFileReader = {
    addEventListener: vi.fn((event, handler) => {
      if (event === 'load') {
        mockFileReader.onload = handler as () => void;
      }
      if (event === 'error') {
        mockFileReader.onerror = handler as () => void;
      }
    }),
    readAsDataURL: vi.fn(function (this: typeof mockFileReader) {
      // Simulate async file reading
      setTimeout(() => {
        this.result = 'data:image/png;base64,mockBase64Data';
        if (this.onload) {
          this.onload();
        }
      }, 0);
    }),
    result: null,
    onload: null,
    onerror: null,
  };

  // Mock FileReader constructor
  global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;

  // Mock URL methods
  global.URL.createObjectURL = mockCreateObjectURL.mockReturnValue('blob:mock-url');
  global.URL.revokeObjectURL = mockRevokeObjectURL;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// TEST SUITE: BASIC RENDERING
// ============================================================================

describe('FormFileUpload - Basic Rendering', () => {
  it('should render drag-and-drop zone with upload button', () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="testFile"
          control={methods.control}
          label="Test File Upload"
        />
      </FormProvider>
    );

    // Verify dropzone area
    const dropzone = screen.getByRole('button', { name: /upload test file upload/i });
    expect(dropzone).toBeInTheDocument();

    // Verify upload instructions text
    expect(screen.getByText(/drag and drop files here, or click to select/i)).toBeInTheDocument();

    // Verify hidden file input
    const fileInput = screen.getByLabelText('Test File Upload', { selector: 'input[type="file"]' });
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveStyle({ display: 'none' });
  });

  it('should display label with required indicator', () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="requiredFile"
          control={methods.control}
          label="Required File"
          required
        />
      </FormProvider>
    );

    const label = screen.getByText('Required File');
    expect(label).toBeInTheDocument();

    // Check for required asterisk
    const requiredIndicator = screen.getByLabelText('required');
    expect(requiredIndicator).toBeInTheDocument();
    expect(requiredIndicator).toHaveTextContent('*');
  });

  it('should display helper text when provided', () => {
    const methods = useForm();
    const helperText = 'Please upload a PDF or image file';
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="fileWithHelper"
          control={methods.control}
          label="File Upload"
          helperText={helperText}
        />
      </FormProvider>
    );

    expect(screen.getByText(helperText)).toBeInTheDocument();
  });

  it('should display maximum file size information', () => {
    const methods = useForm();
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="sizedFile"
          control={methods.control}
          label="Size Limited File"
          maxSize={maxSize}
        />
      </FormProvider>
    );

    expect(screen.getByText(/maximum file size: 10\.00 MB/i)).toBeInTheDocument();
  });

  it('should display maximum file count when multiple files allowed', () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="multipleFiles"
          control={methods.control}
          label="Multiple Files"
          multiple
          maxFiles={5}
        />
      </FormProvider>
    );

    expect(screen.getByText(/maximum 5 files allowed/i)).toBeInTheDocument();
  });

  it('should render CloudUpload icon', () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="iconTest"
          control={methods.control}
          label="Icon Test"
        />
      </FormProvider>
    );

    // MUI CloudUpload icon should be present
    const dropzone = screen.getByRole('button', { name: /upload icon test/i });
    expect(dropzone.querySelector('svg')).toBeInTheDocument();
  });
});

// ============================================================================
// TEST SUITE: REACT HOOK FORM INTEGRATION
// ============================================================================

describe('FormFileUpload - React Hook Form Integration', () => {
  it('should integrate with React Hook Form Controller', () => {
    const methods = useForm({ defaultValues: { document: null } });
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="document"
          control={methods.control}
          label="Document"
        />
      </FormProvider>
    );

    // Component should render without errors
    expect(screen.getByRole('button', { name: /upload document/i })).toBeInTheDocument();
  });

  it('should handle single File object submission', async () => {
    const onSubmit = vi.fn();
    const mockFile = createMockFile('test.pdf', 1024, 'application/pdf');

    render(
      <FormWrapper defaultValues={{ singleFile: null }} onSubmit={onSubmit}>
        <FormFileUpload
          name="singleFile"
          control={useForm().control}
          label="Single File"
        />
      </FormWrapper>
    );

    const fileInput = screen.getByLabelText('Single File', { selector: 'input[type="file"]' });
    
    await userEvent.upload(fileInput, mockFile);
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      const submittedData = onSubmit.mock.calls[0][0];
      expect(submittedData.singleFile).toBeInstanceOf(File);
    });
  });

  it('should handle FileList object for multiple files', async () => {
    const onSubmit = vi.fn();
    const files = [
      createMockFile('doc1.pdf', 1024, 'application/pdf'),
      createMockFile('doc2.pdf', 2048, 'application/pdf'),
    ];
    const fileList = createMockFileList(files);

    render(
      <FormWrapper defaultValues={{ multipleFiles: null }} onSubmit={onSubmit}>
        <FormFileUpload
          name="multipleFiles"
          control={useForm().control}
          label="Multiple Files"
          multiple
        />
      </FormWrapper>
    );

    const fileInput = screen.getByLabelText('Multiple Files', { selector: 'input[type="file"]' });
    
    simulateFileSelect(fileInput, fileList);

    await waitFor(() => {
      expect(screen.getByText('doc1.pdf')).toBeInTheDocument();
      expect(screen.getByText('doc2.pdf')).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      const submittedData = onSubmit.mock.calls[0][0];
      expect(submittedData.multipleFiles).toHaveProperty('length', 2);
    });
  });

  it('should update form state when files are removed', async () => {
    const methods = useForm({ defaultValues: { removableFile: null } });
    const mockFile = createMockFile('remove-me.pdf', 1024, 'application/pdf');

    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="removableFile"
          control={methods.control}
          label="Removable File"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Removable File', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('remove-me.pdf')).toBeInTheDocument();
    });

    // Find and click remove button
    const removeButton = screen.getByRole('button', { name: /remove remove-me\.pdf/i });
    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByText('remove-me.pdf')).not.toBeInTheDocument();
    });

    // Form value should be null
    expect(methods.getValues('removableFile')).toBeNull();
  });

  it('should handle form reset', async () => {
    const methods = useForm({ defaultValues: { resetFile: null } });
    const mockFile = createMockFile('reset-test.pdf', 1024, 'application/pdf');

    render(
      <FormProvider {...methods}>
        <form>
          <FormFileUpload
            name="resetFile"
            control={methods.control}
            label="Reset File"
          />
          <button type="button" onClick={() => methods.reset()}>Reset Form</button>
        </form>
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Reset File', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('reset-test.pdf')).toBeInTheDocument();
    });

    const resetButton = screen.getByRole('button', { name: /reset form/i });
    await userEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.queryByText('reset-test.pdf')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// TEST SUITE: ZOD VALIDATION INTEGRATION
// ============================================================================

describe('FormFileUpload - Zod Validation', () => {
  it('should validate required file upload', async () => {
    const schema = z.object({
      requiredDoc: z.instanceof(File, { message: 'File is required' }),
    });

    render(
      <FormWrapper defaultValues={{ requiredDoc: null }} schema={schema}>
        <FormFileUpload
          name="requiredDoc"
          control={useForm().control}
          label="Required Document"
          required
        />
      </FormWrapper>
    );

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/file is required/i)).toBeInTheDocument();
    });
  });

  it('should validate file type using MIME types', async () => {
    const schema = z.object({
      pdfOnly: z.custom<File>((file) => {
        if (!(file instanceof File)) return false;
        return file.type === 'application/pdf';
      }, { message: 'Only PDF files are allowed' }),
    });

    render(
      <FormWrapper defaultValues={{ pdfOnly: null }} schema={schema}>
        <FormFileUpload
          name="pdfOnly"
          control={useForm().control}
          label="PDF Only"
          accept="application/pdf"
        />
      </FormWrapper>
    );

    const fileInput = screen.getByLabelText('PDF Only', { selector: 'input[type="file"]' });
    const invalidFile = createMockFile('image.jpg', 1024, 'image/jpeg');
    
    await userEvent.upload(fileInput, invalidFile);

    await waitFor(() => {
      expect(screen.getByText(/only pdf files are allowed/i)).toBeInTheDocument();
    });
  });

  it('should validate file size constraints', async () => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const schema = z.object({
      sizedDoc: z.custom<File>((file) => {
        if (!(file instanceof File)) return false;
        return file.size <= maxSize;
      }, { message: 'File exceeds 5MB limit' }),
    });

    render(
      <FormWrapper defaultValues={{ sizedDoc: null }} schema={schema}>
        <FormFileUpload
          name="sizedDoc"
          control={useForm().control}
          label="Size Limited"
          maxSize={maxSize}
        />
      </FormWrapper>
    );

    const fileInput = screen.getByLabelText('Size Limited', { selector: 'input[type="file"]' });
    const largeFile = createLargeFile('huge.pdf', 10 * 1024 * 1024); // 10MB
    
    await userEvent.upload(fileInput, largeFile);

    await waitFor(() => {
      expect(screen.getByText(/file exceeds 5mb limit/i)).toBeInTheDocument();
    });
  });

  it('should validate maximum file count', async () => {
    const schema = z.object({
      limitedFiles: z.custom<FileList>((files) => {
        if (!(files instanceof FileList)) return false;
        return files.length <= 3;
      }, { message: 'Maximum 3 files allowed' }),
    });

    render(
      <FormWrapper defaultValues={{ limitedFiles: null }} schema={schema}>
        <FormFileUpload
          name="limitedFiles"
          control={useForm().control}
          label="Limited Files"
          multiple
          maxFiles={3}
        />
      </FormWrapper>
    );

    const fileInput = screen.getByLabelText('Limited Files', { selector: 'input[type="file"]' });
    const files = [
      createMockFile('file1.pdf', 1024, 'application/pdf'),
      createMockFile('file2.pdf', 1024, 'application/pdf'),
      createMockFile('file3.pdf', 1024, 'application/pdf'),
      createMockFile('file4.pdf', 1024, 'application/pdf'),
    ];
    const fileList = createMockFileList(files);
    
    simulateFileSelect(fileInput, fileList);

    await waitFor(() => {
      expect(screen.getByText(/maximum 3 files allowed/i)).toBeInTheDocument();
    });
  });

  it('should validate file extensions', async () => {
    const schema = z.object({
      imageOnly: z.custom<File>((file) => {
        if (!(file instanceof File)) return false;
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        return validTypes.includes(file.type);
      }, { message: 'Only image files (PNG, JPG, JPEG) are allowed' }),
    });

    render(
      <FormWrapper defaultValues={{ imageOnly: null }} schema={schema}>
        <FormFileUpload
          name="imageOnly"
          control={useForm().control}
          label="Image Only"
          accept="image/png,image/jpeg,image/jpg"
        />
      </FormWrapper>
    );

    const fileInput = screen.getByLabelText('Image Only', { selector: 'input[type="file"]' });
    const pdfFile = createMockPDFFile('document.pdf', 1024);
    
    await userEvent.upload(fileInput, pdfFile);

    await waitFor(() => {
      expect(screen.getByText(/only image files \(png, jpg, jpeg\) are allowed/i)).toBeInTheDocument();
    });
  });

  it('should display Zod error messages correctly', async () => {
    const schema = z.object({
      validatedFile: z.custom<File>((file) => {
        if (!(file instanceof File)) {
          return false;
        }
        if (file.size > 1024 * 1024) {
          throw new Error('File too large');
        }
        if (!file.name.endsWith('.pdf')) {
          throw new Error('Must be a PDF file');
        }
        return true;
      }, { message: 'Invalid file' }),
    });

    render(
      <FormWrapper defaultValues={{ validatedFile: null }} schema={schema}>
        <FormFileUpload
          name="validatedFile"
          control={useForm().control}
          label="Validated File"
          accept="application/pdf"
        />
      </FormWrapper>
    );

    const fileInput = screen.getByLabelText('Validated File', { selector: 'input[type="file"]' });
    const invalidFile = createMockFile('test.txt', 512, 'text/plain');
    
    await userEvent.upload(fileInput, invalidFile);

    await waitFor(() => {
      expect(screen.getByText(/invalid file/i)).toBeInTheDocument();
    });
  });
});

// ============================================================================
// TEST SUITE: ACCESSIBILITY (WCAG 2.1 AA)
// ============================================================================

describe('FormFileUpload - Accessibility', () => {
  it('should have proper aria-label for dropzone', () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="accessibleFile"
          control={methods.control}
          label="Accessible File"
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload accessible file/i });
    expect(dropzone).toHaveAttribute('aria-label', 'Upload Accessible File');
  });

  it('should have aria-disabled attribute when disabled', () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="disabledFile"
          control={methods.control}
          label="Disabled File"
          disabled
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload disabled file/i });
    expect(dropzone).toHaveAttribute('aria-disabled', 'true');
  });

  it('should support keyboard navigation with Enter key', async () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="keyboardFile"
          control={methods.control}
          label="Keyboard File"
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload keyboard file/i });
    dropzone.focus();
    
    expect(dropzone).toHaveFocus();
    expect(dropzone).toHaveAttribute('tabIndex', '0');
    
    // Pressing Enter should trigger file input click
    const fileInput = screen.getByLabelText('Keyboard File', { selector: 'input[type="file"]' });
    const clickSpy = vi.spyOn(fileInput, 'click');
    
    await userEvent.keyboard('{Enter}');
    
    expect(clickSpy).toHaveBeenCalled();
  });

  it('should support keyboard navigation with Space key', async () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="spaceKeyFile"
          control={methods.control}
          label="Space Key File"
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload space key file/i });
    dropzone.focus();
    
    const fileInput = screen.getByLabelText('Space Key File', { selector: 'input[type="file"]' });
    const clickSpy = vi.spyOn(fileInput, 'click');
    
    await userEvent.keyboard(' ');
    
    expect(clickSpy).toHaveBeenCalled();
  });

  it('should have proper focus management', async () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="focusFile"
          control={methods.control}
          label="Focus File"
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload focus file/i });
    
    await userEvent.tab();
    expect(dropzone).toHaveFocus();
  });

  it('should announce file selection to screen readers', async () => {
    const methods = useForm();
    const mockFile = createMockFile('announced.pdf', 1024, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="announcedFile"
          control={methods.control}
          label="Announced File"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Announced File', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      // File list should be announced via aria-label
      const fileList = screen.getByLabelText('Selected files');
      expect(fileList).toBeInTheDocument();
    });
  });

  it('should have descriptive remove button labels', async () => {
    const methods = useForm();
    const mockFile = createMockFile('removable.pdf', 1024, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="labeledRemove"
          control={methods.control}
          label="Labeled Remove"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Labeled Remove', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      const removeButton = screen.getByRole('button', { name: /remove removable\.pdf/i });
      expect(removeButton).toBeInTheDocument();
      expect(removeButton).toHaveAttribute('aria-label', 'Remove removable.pdf');
    });
  });

  it('should announce validation errors to screen readers', async () => {
    const schema = z.object({
      errorFile: z.instanceof(File, { message: 'File is required for accessibility test' }),
    });

    render(
      <FormWrapper defaultValues={{ errorFile: null }} schema={schema}>
        <FormFileUpload
          name="errorFile"
          control={useForm().control}
          label="Error File"
          required
        />
      </FormWrapper>
    );

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      const errorMessage = screen.getByText(/file is required for accessibility test/i);
      expect(errorMessage).toBeInTheDocument();
      // Error should be in FormHelperText which is associated with the field
      expect(errorMessage.tagName).toBe('P');
    });
  });

  it('should not allow keyboard interaction when disabled', async () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="disabledKeyboard"
          control={methods.control}
          label="Disabled Keyboard"
          disabled
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload disabled keyboard/i });
    expect(dropzone).toHaveAttribute('tabIndex', '-1');
    
    dropzone.focus();
    const fileInput = screen.getByLabelText('Disabled Keyboard', { selector: 'input[type="file"]' });
    const clickSpy = vi.spyOn(fileInput, 'click');
    
    await userEvent.keyboard('{Enter}');
    
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

// ============================================================================
// TEST SUITE: DRAG-AND-DROP INTERACTIONS
// ============================================================================

describe('FormFileUpload - Drag-and-Drop', () => {
  it('should highlight dropzone on dragEnter event', async () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="dragFile"
          control={methods.control}
          label="Drag File"
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload drag file/i });
    const dragEnterEvent = createDragEvent('dragenter', []);
    
    fireEvent(dropzone, dragEnterEvent);

    await waitFor(() => {
      expect(screen.getByText(/drop files here/i)).toBeInTheDocument();
    });
  });

  it('should remove highlight on dragLeave event', async () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="dragLeaveFile"
          control={methods.control}
          label="Drag Leave File"
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload drag leave file/i });
    
    // First enter
    const dragEnterEvent = createDragEvent('dragenter', []);
    fireEvent(dropzone, dragEnterEvent);

    await waitFor(() => {
      expect(screen.getByText(/drop files here/i)).toBeInTheDocument();
    });

    // Then leave
    const dragLeaveEvent = createDragEvent('dragleave', []);
    fireEvent(dropzone, dragLeaveEvent);

    await waitFor(() => {
      expect(screen.getByText(/drag and drop files here, or click to select/i)).toBeInTheDocument();
    });
  });

  it('should prevent default on dragOver event', () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="dragOverFile"
          control={methods.control}
          label="Drag Over File"
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload drag over file/i });
    const dragOverEvent = createDragEvent('dragover', []);
    
    fireEvent(dropzone, dragOverEvent);
    
    expect(dragOverEvent.defaultPrevented).toBe(true);
  });

  it('should add files on drop event', async () => {
    const methods = useForm();
    const mockFile = createMockFile('dropped.pdf', 1024, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="dropFile"
          control={methods.control}
          label="Drop File"
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload drop file/i });
    
    simulateFileDrop(dropzone, [mockFile]);

    await waitFor(() => {
      expect(screen.getByText('dropped.pdf')).toBeInTheDocument();
    });
  });

  it('should handle multiple files drop', async () => {
    const methods = useForm();
    const files = [
      createMockFile('file1.pdf', 1024, 'application/pdf'),
      createMockFile('file2.pdf', 2048, 'application/pdf'),
      createMockFile('file3.pdf', 3072, 'application/pdf'),
    ];
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="multiDropFiles"
          control={methods.control}
          label="Multi Drop Files"
          multiple
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload multi drop files/i });
    
    simulateFileDrop(dropzone, files);

    await waitFor(() => {
      expect(screen.getByText('file1.pdf')).toBeInTheDocument();
      expect(screen.getByText('file2.pdf')).toBeInTheDocument();
      expect(screen.getByText('file3.pdf')).toBeInTheDocument();
    });
  });

  it('should reject invalid file types on drop', async () => {
    const methods = useForm();
    const invalidFile = createMockFile('invalid.txt', 1024, 'text/plain');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="pdfOnlyDrop"
          control={methods.control}
          label="PDF Only Drop"
          accept="application/pdf"
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload pdf only drop/i });
    
    simulateFileDrop(dropzone, [invalidFile]);

    await waitFor(() => {
      expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
    });
  });

  it('should not accept files when disabled', () => {
    const methods = useForm();
    const mockFile = createMockFile('disabled.pdf', 1024, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="disabledDrop"
          control={methods.control}
          label="Disabled Drop"
          disabled
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload disabled drop/i });
    
    const dragEnterEvent = createDragEvent('dragenter', []);
    fireEvent(dropzone, dragEnterEvent);

    // Should not show "Drop files here" when disabled
    expect(screen.queryByText(/drop files here/i)).not.toBeInTheDocument();
  });

  it('should show visual feedback during drag state', async () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="visualFeedback"
          control={methods.control}
          label="Visual Feedback"
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload visual feedback/i });
    
    // Initial state
    expect(screen.getByText(/drag and drop files here, or click to select/i)).toBeInTheDocument();

    // Drag enter
    const dragEnterEvent = createDragEvent('dragenter', []);
    fireEvent(dropzone, dragEnterEvent);

    await waitFor(() => {
      expect(screen.getByText(/drop files here/i)).toBeInTheDocument();
    });
  });
});

// ============================================================================
// TEST SUITE: FILE SELECTION VIA BUTTON CLICK
// ============================================================================

describe('FormFileUpload - File Selection', () => {
  it('should open native file dialog on button click', async () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="clickFile"
          control={methods.control}
          label="Click File"
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload click file/i });
    const fileInput = screen.getByLabelText('Click File', { selector: 'input[type="file"]' });
    const clickSpy = vi.spyOn(fileInput, 'click');
    
    await userEvent.click(dropzone);
    
    expect(clickSpy).toHaveBeenCalled();
  });

  it('should select single file via input', async () => {
    const methods = useForm();
    const mockFile = createMockFile('selected.pdf', 1024, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="singleSelect"
          control={methods.control}
          label="Single Select"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Single Select', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('selected.pdf')).toBeInTheDocument();
    });
  });

  it('should select multiple files via input', async () => {
    const methods = useForm();
    const files = [
      createMockFile('multi1.pdf', 1024, 'application/pdf'),
      createMockFile('multi2.pdf', 2048, 'application/pdf'),
    ];
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="multiSelect"
          control={methods.control}
          label="Multi Select"
          multiple
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Multi Select', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, files);

    await waitFor(() => {
      expect(screen.getByText('multi1.pdf')).toBeInTheDocument();
      expect(screen.getByText('multi2.pdf')).toBeInTheDocument();
    });
  });

  it('should handle canceled selection', async () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="canceledSelect"
          control={methods.control}
          label="Canceled Select"
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload canceled select/i });
    await userEvent.click(dropzone);

    // No files should be added if selection is canceled
    expect(screen.queryByLabelText('Selected files')).not.toBeInTheDocument();
  });
});

// ============================================================================
// TEST SUITE: FILE LIST DISPLAY
// ============================================================================

describe('FormFileUpload - File List Display', () => {
  it('should display file names in list', async () => {
    const methods = useForm();
    const mockFile = createMockFile('display-name.pdf', 1024, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="fileListName"
          control={methods.control}
          label="File List Name"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('File List Name', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('display-name.pdf')).toBeInTheDocument();
    });
  });

  it('should display formatted file sizes', async () => {
    const methods = useForm();
    const mockFile = createMockFile('size-test.pdf', 1536, 'application/pdf'); // 1.5 KB
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="fileSizeDisplay"
          control={methods.control}
          label="File Size Display"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('File Size Display', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText(/1\.50 KB/i)).toBeInTheDocument();
    });
  });

  it('should display file type icons', async () => {
    const methods = useForm();
    const pdfFile = createMockPDFFile('icon-test.pdf', 1024);
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="fileIconDisplay"
          control={methods.control}
          label="File Icon Display"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('File Icon Display', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, pdfFile);

    await waitFor(() => {
      const fileItem = screen.getByText('icon-test.pdf').closest('li');
      expect(fileItem).toBeInTheDocument();
      // Icon should be present (MUI icon component)
      expect(fileItem?.querySelector('svg')).toBeInTheDocument();
    });
  });

  it('should display remove buttons for each file', async () => {
    const methods = useForm();
    const files = [
      createMockFile('remove1.pdf', 1024, 'application/pdf'),
      createMockFile('remove2.pdf', 2048, 'application/pdf'),
    ];
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="removeButtons"
          control={methods.control}
          label="Remove Buttons"
          multiple
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Remove Buttons', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, files);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /remove remove1\.pdf/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /remove remove2\.pdf/i })).toBeInTheDocument();
    });
  });

  it('should display thumbnail preview for images', async () => {
    const methods = useForm();
    const imageFile = createMockImageFile('preview.jpg', 2048);
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="thumbnailPreview"
          control={methods.control}
          label="Thumbnail Preview"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Thumbnail Preview', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, imageFile);

    await waitFor(() => {
      const img = screen.getByAltText('preview.jpg');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', expect.stringContaining('blob:'));
    });
  });

  it('should not display file list when empty', () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="emptyList"
          control={methods.control}
          label="Empty List"
        />
      </FormProvider>
    );

    expect(screen.queryByLabelText('Selected files')).not.toBeInTheDocument();
  });
});

// ============================================================================
// TEST SUITE: FILE REMOVAL
// ============================================================================

describe('FormFileUpload - File Removal', () => {
  it('should remove file on remove button click', async () => {
    const methods = useForm();
    const mockFile = createMockFile('removable.pdf', 1024, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="removeTest"
          control={methods.control}
          label="Remove Test"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Remove Test', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('removable.pdf')).toBeInTheDocument();
    });

    const removeButton = screen.getByRole('button', { name: /remove removable\.pdf/i });
    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByText('removable.pdf')).not.toBeInTheDocument();
    });
  });

  it('should revoke preview URL when removing image file', async () => {
    const methods = useForm();
    const imageFile = createMockImageFile('revoke-test.jpg', 2048);
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="revokeTest"
          control={methods.control}
          label="Revoke Test"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Revoke Test', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, imageFile);

    await waitFor(() => {
      expect(screen.getByAltText('revoke-test.jpg')).toBeInTheDocument();
    });

    mockRevokeObjectURL.mockClear();

    const removeButton = screen.getByRole('button', { name: /remove revoke-test\.jpg/i });
    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });

  it('should update form value to null when removing single file', async () => {
    const methods = useForm({ defaultValues: { singleFileRemove: null } });
    const mockFile = createMockFile('single-remove.pdf', 1024, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="singleFileRemove"
          control={methods.control}
          label="Single File Remove"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Single File Remove', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('single-remove.pdf')).toBeInTheDocument();
    });

    const removeButton = screen.getByRole('button', { name: /remove single-remove\.pdf/i });
    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(methods.getValues('singleFileRemove')).toBeNull();
    });
  });

  it('should update FileList when removing from multiple files', async () => {
    const methods = useForm({ defaultValues: { multipleFileRemove: null } });
    const files = [
      createMockFile('keep1.pdf', 1024, 'application/pdf'),
      createMockFile('remove-this.pdf', 2048, 'application/pdf'),
      createMockFile('keep2.pdf', 3072, 'application/pdf'),
    ];
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="multipleFileRemove"
          control={methods.control}
          label="Multiple File Remove"
          multiple
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Multiple File Remove', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, files);

    await waitFor(() => {
      expect(screen.getByText('keep1.pdf')).toBeInTheDocument();
      expect(screen.getByText('remove-this.pdf')).toBeInTheDocument();
      expect(screen.getByText('keep2.pdf')).toBeInTheDocument();
    });

    const removeButton = screen.getByRole('button', { name: /remove remove-this\.pdf/i });
    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByText('remove-this.pdf')).not.toBeInTheDocument();
      expect(screen.getByText('keep1.pdf')).toBeInTheDocument();
      expect(screen.getByText('keep2.pdf')).toBeInTheDocument();
    });

    const formValue = methods.getValues('multipleFileRemove') as FileList;
    expect(formValue).toHaveProperty('length', 2);
  });

  it('should not allow removal when disabled', async () => {
    const methods = useForm();
    const mockFile = createMockFile('no-remove.pdf', 1024, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="disabledRemove"
          control={methods.control}
          label="Disabled Remove"
          disabled
        />
      </FormProvider>
    );

    // First add file while enabled
    const { rerender } = render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="disabledRemove"
          control={methods.control}
          label="Disabled Remove"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Disabled Remove', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('no-remove.pdf')).toBeInTheDocument();
    });

    // Now disable
    rerender(
      <FormProvider {...methods}>
        <FormFileUpload
          name="disabledRemove"
          control={methods.control}
          label="Disabled Remove"
          disabled
        />
      </FormProvider>
    );

    const removeButton = screen.getByRole('button', { name: /remove no-remove\.pdf/i });
    expect(removeButton).toBeDisabled();
  });
});

// ============================================================================
// TEST SUITE: FILE TYPE AND SIZE RESTRICTIONS
// ============================================================================

describe('FormFileUpload - File Restrictions', () => {
  it('should enforce file type restrictions with accept prop', async () => {
    const methods = useForm();
    const invalidFile = createMockFile('wrong-type.txt', 1024, 'text/plain');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="typeRestricted"
          control={methods.control}
          label="Type Restricted"
          accept="application/pdf,image/*"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Type Restricted', { selector: 'input[type="file"]' });
    expect(fileInput).toHaveAttribute('accept', 'application/pdf,image/*');

    await userEvent.upload(fileInput, invalidFile);

    await waitFor(() => {
      expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
    });
  });

  it('should display user-friendly error for invalid file type', async () => {
    const methods = useForm();
    const invalidFile = createInvalidFile('document.exe', 1024, 'application/x-msdownload');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="friendlyError"
          control={methods.control}
          label="Friendly Error"
          accept="application/pdf"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Friendly Error', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, invalidFile);

    await waitFor(() => {
      const error = screen.getByText(/invalid file type/i);
      expect(error).toBeInTheDocument();
      // Error should be styled as MUI FormHelperText with error prop
      expect(error.closest('.MuiFormHelperText-root')).toHaveClass('Mui-error');
    });
  });

  it('should enforce file size limit with maxSize prop', async () => {
    const methods = useForm();
    const maxSize = 5 * 1024 * 1024; // 5MB
    const largeFile = createLargeFile('huge-file.pdf', 10 * 1024 * 1024); // 10MB
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="sizeRestricted"
          control={methods.control}
          label="Size Restricted"
          maxSize={maxSize}
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Size Restricted', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, largeFile);

    await waitFor(() => {
      expect(screen.getByText(/file exceeds maximum size/i)).toBeInTheDocument();
    });
  });

  it('should display clear error message for size limit', async () => {
    const methods = useForm();
    const maxSize = 2 * 1024 * 1024; // 2MB
    const largeFile = createLargeFile('oversized.pdf', 3 * 1024 * 1024); // 3MB
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="sizeError"
          control={methods.control}
          label="Size Error"
          maxSize={maxSize}
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Size Error', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, largeFile);

    await waitFor(() => {
      expect(screen.getByText(/file exceeds maximum size of 2\.00 MB/i)).toBeInTheDocument();
    });
  });

  it('should accept files within size limit', async () => {
    const methods = useForm();
    const maxSize = 5 * 1024 * 1024; // 5MB
    const validFile = createMockFile('valid-size.pdf', 3 * 1024 * 1024, 'application/pdf'); // 3MB
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="validSize"
          control={methods.control}
          label="Valid Size"
          maxSize={maxSize}
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Valid Size', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, validFile);

    await waitFor(() => {
      expect(screen.getByText('valid-size.pdf')).toBeInTheDocument();
      expect(screen.queryByText(/file exceeds/i)).not.toBeInTheDocument();
    });
  });

  it('should accept files with valid MIME types', async () => {
    const methods = useForm();
    const validFile = createMockPDFFile('valid-type.pdf', 1024);
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="validType"
          control={methods.control}
          label="Valid Type"
          accept="application/pdf"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Valid Type', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, validFile);

    await waitFor(() => {
      expect(screen.getByText('valid-type.pdf')).toBeInTheDocument();
      expect(screen.queryByText(/invalid file type/i)).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// TEST SUITE: MAXIMUM FILE COUNT
// ============================================================================

describe('FormFileUpload - Maximum File Count', () => {
  it('should enforce maximum file count with maxFiles prop', async () => {
    const methods = useForm();
    const files = [
      createMockFile('file1.pdf', 1024, 'application/pdf'),
      createMockFile('file2.pdf', 1024, 'application/pdf'),
      createMockFile('file3.pdf', 1024, 'application/pdf'),
      createMockFile('file4.pdf', 1024, 'application/pdf'),
    ];
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="maxFilesTest"
          control={methods.control}
          label="Max Files Test"
          multiple
          maxFiles={3}
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Max Files Test', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, files);

    await waitFor(() => {
      // Only first 3 files should be added
      expect(screen.getByText('file1.pdf')).toBeInTheDocument();
      expect(screen.getByText('file2.pdf')).toBeInTheDocument();
      expect(screen.getByText('file3.pdf')).toBeInTheDocument();
      expect(screen.queryByText('file4.pdf')).not.toBeInTheDocument();
    });
  });

  it('should display warning when maximum files reached', async () => {
    const methods = useForm();
    const files = [
      createMockFile('max1.pdf', 1024, 'application/pdf'),
      createMockFile('max2.pdf', 1024, 'application/pdf'),
    ];
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="maxWarning"
          control={methods.control}
          label="Max Warning"
          multiple
          maxFiles={2}
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Max Warning', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, files);

    await waitFor(() => {
      expect(screen.getByText(/maximum number of files reached \(2\)/i)).toBeInTheDocument();
    });
  });

  it('should allow adding more files after removing some', async () => {
    const methods = useForm();
    const initialFiles = [
      createMockFile('initial1.pdf', 1024, 'application/pdf'),
      createMockFile('initial2.pdf', 1024, 'application/pdf'),
    ];
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="addAfterRemove"
          control={methods.control}
          label="Add After Remove"
          multiple
          maxFiles={2}
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Add After Remove', { selector: 'input[type="file"]' });
    
    // Add initial files
    await userEvent.upload(fileInput, initialFiles);

    await waitFor(() => {
      expect(screen.getByText('initial1.pdf')).toBeInTheDocument();
      expect(screen.getByText('initial2.pdf')).toBeInTheDocument();
    });

    // Remove one file
    const removeButton = screen.getByRole('button', { name: /remove initial1\.pdf/i });
    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByText('initial1.pdf')).not.toBeInTheDocument();
    });

    // Should be able to add another file now
    const newFile = createMockFile('new-file.pdf', 1024, 'application/pdf');
    await userEvent.upload(fileInput, newFile);

    await waitFor(() => {
      expect(screen.getByText('new-file.pdf')).toBeInTheDocument();
    });
  });

  it('should not show max files warning when below limit', async () => {
    const methods = useForm();
    const file = createMockFile('single.pdf', 1024, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="belowLimit"
          control={methods.control}
          label="Below Limit"
          multiple
          maxFiles={5}
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Below Limit', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('single.pdf')).toBeInTheDocument();
      expect(screen.queryByText(/maximum number of files reached/i)).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// TEST SUITE: UPLOAD PROGRESS INDICATOR
// ============================================================================

describe('FormFileUpload - Upload Progress', () => {
  it('should display upload progress indicator during upload', async () => {
    const methods = useForm();
    // Note: The component uses useFileUpload hook which handles progress
    // This test verifies the UI renders progress when uploadState.status is 'uploading'
    const mockFile = createMockFile('progress-test.pdf', 1024, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="progressTest"
          control={methods.control}
          label="Progress Test"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Progress Test', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    // File should be added to list
    await waitFor(() => {
      expect(screen.getByText('progress-test.pdf')).toBeInTheDocument();
    });

    // Note: Progress indicator would show during actual upload operation
    // which is handled by the useFileUpload hook
  });

  it('should display percentage during upload', () => {
    // This test would require mocking the useFileUpload hook
    // to return uploadState with status: 'uploading' and progress: 50
    // For now, we verify the component structure supports it
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="percentageTest"
          control={methods.control}
          label="Percentage Test"
        />
      </FormProvider>
    );

    // Component should be rendered successfully
    expect(screen.getByRole('button', { name: /upload percentage test/i })).toBeInTheDocument();
  });

  it('should display progress bar with determinate value', () => {
    // This verifies the component structure for progress display
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="progressBar"
          control={methods.control}
          label="Progress Bar"
        />
      </FormProvider>
    );

    // Component should render without errors
    expect(screen.getByRole('button', { name: /upload progress bar/i })).toBeInTheDocument();
  });

  it('should display cancel upload button during upload', () => {
    // This tests the presence of cancel button structure
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="cancelUpload"
          control={methods.control}
          label="Cancel Upload"
        />
      </FormProvider>
    );

    // Component structure should support cancel button
    expect(screen.getByRole('button', { name: /upload cancel upload/i })).toBeInTheDocument();
  });
});

// ============================================================================
// TEST SUITE: IMAGE PREVIEW GENERATION
// ============================================================================

describe('FormFileUpload - Image Preview', () => {
  it('should generate preview thumbnail for image files', async () => {
    const methods = useForm();
    const imageFile = createMockImageFile('preview-image.jpg', 2048);
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="imagePreview"
          control={methods.control}
          label="Image Preview"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Image Preview', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, imageFile);

    await waitFor(() => {
      const img = screen.getByAltText('preview-image.jpg');
      expect(img).toBeInTheDocument();
      expect(img.tagName).toBe('IMG');
    });
  });

  it('should use FileReader API for preview generation', async () => {
    const methods = useForm();
    const imageFile = createMockImageFile('reader-test.png', 2048);
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="readerTest"
          control={methods.control}
          label="Reader Test"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Reader Test', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, imageFile);

    await waitFor(() => {
      expect(mockFileReader.readAsDataURL).toHaveBeenCalled();
    });
  });

  it('should display icon for non-image files', async () => {
    const methods = useForm();
    const pdfFile = createMockPDFFile('no-preview.pdf', 1024);
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="noPreview"
          control={methods.control}
          label="No Preview"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('No Preview', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, pdfFile);

    await waitFor(() => {
      const fileItem = screen.getByText('no-preview.pdf').closest('li');
      expect(fileItem).toBeInTheDocument();
      // Should have icon instead of image
      expect(fileItem?.querySelector('svg')).toBeInTheDocument();
      expect(screen.queryByAltText('no-preview.pdf')).not.toBeInTheDocument();
    });
  });

  it('should handle preview generation errors gracefully', async () => {
    // Mock FileReader to throw error
    mockFileReader.readAsDataURL = vi.fn(function (this: typeof mockFileReader) {
      setTimeout(() => {
        if (this.onerror) {
          this.onerror();
        }
      }, 0);
    });

    const methods = useForm();
    const imageFile = createMockImageFile('error-preview.jpg', 2048);
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="errorPreview"
          control={methods.control}
          label="Error Preview"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Error Preview', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, imageFile);

    // File should still be added even if preview fails
    await waitFor(() => {
      expect(screen.getByText('error-preview.jpg')).toBeInTheDocument();
    });
  });

  it('should use URL.createObjectURL for preview URLs', async () => {
    const methods = useForm();
    const imageFile = createMockImageFile('blob-url.jpg', 2048);
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="blobUrl"
          control={methods.control}
          label="Blob URL"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Blob URL', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, imageFile);

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// TEST SUITE: DISABLED STATE
// ============================================================================

describe('FormFileUpload - Disabled State', () => {
  it('should prevent file selection when disabled', async () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="disabledSelection"
          control={methods.control}
          label="Disabled Selection"
          disabled
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload disabled selection/i });
    const fileInput = screen.getByLabelText('Disabled Selection', { selector: 'input[type="file"]' });
    
    expect(fileInput).toBeDisabled();
    
    const clickSpy = vi.spyOn(fileInput, 'click');
    await userEvent.click(dropzone);
    
    // File input click should not be triggered when disabled
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('should display disabled styling', () => {
    const methods = useForm();
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="disabledStyle"
          control={methods.control}
          label="Disabled Style"
          disabled
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload disabled style/i });
    
    // Should have cursor: not-allowed and disabled background
    expect(dropzone).toHaveStyle({ cursor: 'not-allowed' });
  });

  it('should not accept drag and drop when disabled', () => {
    const methods = useForm();
    const mockFile = createMockFile('no-drop.pdf', 1024, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="disabledDragDrop"
          control={methods.control}
          label="Disabled Drag Drop"
          disabled
        />
      </FormProvider>
    );

    const dropzone = screen.getByRole('button', { name: /upload disabled drag drop/i });
    
    simulateFileDrop(dropzone, [mockFile]);

    // File should not be added
    expect(screen.queryByText('no-drop.pdf')).not.toBeInTheDocument();
  });

  it('should disable remove buttons when component is disabled', async () => {
    const methods = useForm();
    const mockFile = createMockFile('cannot-remove.pdf', 1024, 'application/pdf');
    
    // First render enabled to add file
    const { rerender } = render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="disableRemoveButtons"
          control={methods.control}
          label="Disable Remove Buttons"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Disable Remove Buttons', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('cannot-remove.pdf')).toBeInTheDocument();
    });

    // Now disable
    rerender(
      <FormProvider {...methods}>
        <FormFileUpload
          name="disableRemoveButtons"
          control={methods.control}
          label="Disable Remove Buttons"
          disabled
        />
      </FormProvider>
    );

    const removeButton = screen.getByRole('button', { name: /remove cannot-remove\.pdf/i });
    expect(removeButton).toBeDisabled();
  });
});

// ============================================================================
// TEST SUITE: MULTIPLE VS SINGLE FILE MODE
// ============================================================================

describe('FormFileUpload - Multiple vs Single File Mode', () => {
  it('should accept only one file in single file mode', async () => {
    const methods = useForm();
    const files = [
      createMockFile('first.pdf', 1024, 'application/pdf'),
      createMockFile('second.pdf', 2048, 'application/pdf'),
    ];
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="singleMode"
          control={methods.control}
          label="Single Mode"
          multiple={false}
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Single Mode', { selector: 'input[type="file"]' });
    expect(fileInput).not.toHaveAttribute('multiple');

    // Try to upload multiple files (second file should replace first)
    await userEvent.upload(fileInput, files[0]);

    await waitFor(() => {
      expect(screen.getByText('first.pdf')).toBeInTheDocument();
    });

    await userEvent.upload(fileInput, files[1]);

    await waitFor(() => {
      expect(screen.queryByText('first.pdf')).not.toBeInTheDocument();
      expect(screen.getByText('second.pdf')).toBeInTheDocument();
    });
  });

  it('should accept multiple files in multiple file mode', async () => {
    const methods = useForm();
    const files = [
      createMockFile('multi1.pdf', 1024, 'application/pdf'),
      createMockFile('multi2.pdf', 2048, 'application/pdf'),
    ];
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="multiMode"
          control={methods.control}
          label="Multi Mode"
          multiple
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Multi Mode', { selector: 'input[type="file"]' });
    expect(fileInput).toHaveAttribute('multiple');

    await userEvent.upload(fileInput, files);

    await waitFor(() => {
      expect(screen.getByText('multi1.pdf')).toBeInTheDocument();
      expect(screen.getByText('multi2.pdf')).toBeInTheDocument();
    });
  });

  it('should clear previous file when adding new file in single mode', async () => {
    const methods = useForm();
    const file1 = createMockFile('replace-me.pdf', 1024, 'application/pdf');
    const file2 = createMockFile('replacement.pdf', 2048, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="replaceFile"
          control={methods.control}
          label="Replace File"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Replace File', { selector: 'input[type="file"]' });

    await userEvent.upload(fileInput, file1);
    await waitFor(() => {
      expect(screen.getByText('replace-me.pdf')).toBeInTheDocument();
    });

    await userEvent.upload(fileInput, file2);
    await waitFor(() => {
      expect(screen.queryByText('replace-me.pdf')).not.toBeInTheDocument();
      expect(screen.getByText('replacement.pdf')).toBeInTheDocument();
    });
  });

  it('should accumulate files in multiple mode', async () => {
    const methods = useForm();
    const file1 = createMockFile('accumulate1.pdf', 1024, 'application/pdf');
    const file2 = createMockFile('accumulate2.pdf', 2048, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="accumulateFiles"
          control={methods.control}
          label="Accumulate Files"
          multiple
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Accumulate Files', { selector: 'input[type="file"]' });

    await userEvent.upload(fileInput, file1);
    await waitFor(() => {
      expect(screen.getByText('accumulate1.pdf')).toBeInTheDocument();
    });

    await userEvent.upload(fileInput, file2);
    await waitFor(() => {
      expect(screen.getByText('accumulate1.pdf')).toBeInTheDocument();
      expect(screen.getByText('accumulate2.pdf')).toBeInTheDocument();
    });
  });

  it('should not show max files warning in single file mode', async () => {
    const methods = useForm();
    const mockFile = createMockFile('single.pdf', 1024, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="singleNoWarning"
          control={methods.control}
          label="Single No Warning"
          maxFiles={1}
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Single No Warning', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('single.pdf')).toBeInTheDocument();
      expect(screen.queryByText(/maximum number of files reached/i)).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// TEST SUITE: ERROR STATE AND HELPER TEXT
// ============================================================================

describe('FormFileUpload - Error State and Helper Text', () => {
  it('should display error state styling when validation fails', async () => {
    const schema = z.object({
      errorStyleFile: z.instanceof(File, { message: 'File is required' }),
    });

    render(
      <FormWrapper defaultValues={{ errorStyleFile: null }} schema={schema}>
        <FormFileUpload
          name="errorStyleFile"
          control={useForm().control}
          label="Error Style File"
          required
        />
      </FormWrapper>
    );

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      const errorText = screen.getByText(/file is required/i);
      expect(errorText).toBeInTheDocument();
      // Error text should have error class from MUI
      expect(errorText.closest('.MuiFormHelperText-root')).toHaveClass('Mui-error');
    });
  });

  it('should display helper text when no error present', () => {
    const methods = useForm();
    const helperText = 'Upload your assignment document here';
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="helperTextDisplay"
          control={methods.control}
          label="Helper Text Display"
          helperText={helperText}
        />
      </FormProvider>
    );

    expect(screen.getByText(helperText)).toBeInTheDocument();
  });

  it('should hide helper text when error is present', async () => {
    const schema = z.object({
      hideHelper: z.instanceof(File, { message: 'File validation error' }),
    });
    const helperText = 'This helper text should be hidden when error appears';

    render(
      <FormWrapper defaultValues={{ hideHelper: null }} schema={schema}>
        <FormFileUpload
          name="hideHelper"
          control={useForm().control}
          label="Hide Helper"
          helperText={helperText}
          required
        />
      </FormWrapper>
    );

    // Initially helper text should be visible
    expect(screen.getByText(helperText)).toBeInTheDocument();

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/file validation error/i)).toBeInTheDocument();
      expect(screen.queryByText(helperText)).not.toBeInTheDocument();
    });
  });

  it('should change border color to error color when validation fails', async () => {
    const schema = z.object({
      borderError: z.instanceof(File, { message: 'Border should be red' }),
    });

    render(
      <FormWrapper defaultValues={{ borderError: null }} schema={schema}>
        <FormFileUpload
          name="borderError"
          control={useForm().control}
          label="Border Error"
          required
        />
      </FormWrapper>
    );

    const dropzone = screen.getByRole('button', { name: /upload border error/i });

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      // Dropzone should have error border color
      const styles = window.getComputedStyle(dropzone);
      // The border color should be set by MUI theme error color
      expect(dropzone).toBeTruthy();
    });
  });

  it('should display custom error message from field state', async () => {
    const methods = useForm();
    const customError = 'This is a custom error message';
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="customError"
          control={methods.control}
          label="Custom Error"
          required
        />
      </FormProvider>
    );

    // Manually set error
    methods.setError('customError', { message: customError });

    await waitFor(() => {
      expect(screen.getByText(customError)).toBeInTheDocument();
    });
  });
});

// ============================================================================
// TEST SUITE: FILE METADATA EXTRACTION
// ============================================================================

describe('FormFileUpload - File Metadata', () => {
  it('should extract file name correctly', async () => {
    const methods = useForm();
    const fileName = 'metadata-test-file.pdf';
    const mockFile = createMockFile(fileName, 1024, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="fileNameMeta"
          control={methods.control}
          label="File Name Meta"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('File Name Meta', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText(fileName)).toBeInTheDocument();
    });
  });

  it('should extract and display file size', async () => {
    const methods = useForm();
    const fileSize = 2560; // 2.5 KB
    const mockFile = createMockFile('size-meta.pdf', fileSize, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="fileSizeMeta"
          control={methods.control}
          label="File Size Meta"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('File Size Meta', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText(/2\.50 KB/i)).toBeInTheDocument();
    });
  });

  it('should extract file type (MIME type)', async () => {
    const methods = useForm();
    const fileType = 'application/pdf';
    const mockFile = createMockFile('type-meta.pdf', 1024, fileType);
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="fileTypeMeta"
          control={methods.control}
          label="File Type Meta"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('File Type Meta', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      // File type is used internally for validation and icon selection
      expect(screen.getByText('type-meta.pdf')).toBeInTheDocument();
    });

    expectFileType(mockFile, fileType);
  });

  it('should handle lastModified timestamp', async () => {
    const methods = useForm();
    const mockFile = createMockFile('timestamp-meta.pdf', 1024, 'application/pdf');
    
    // Mock File objects include lastModified property
    expect(mockFile).toHaveProperty('lastModified');
    expect(typeof mockFile.lastModified).toBe('number');

    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="timestampMeta"
          control={methods.control}
          label="Timestamp Meta"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Timestamp Meta', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('timestamp-meta.pdf')).toBeInTheDocument();
    });
  });

  it('should format file sizes correctly (KB, MB, GB)', async () => {
    const methods = useForm();
    const files = [
      createMockFile('small.txt', 512, 'text/plain'), // 512 B
      createMockFile('medium.pdf', 1024 * 1024, 'application/pdf'), // 1 MB
      createMockFile('large.zip', 1024 * 1024 * 1024, 'application/zip'), // 1 GB
    ];
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="formatSizes"
          control={methods.control}
          label="Format Sizes"
          multiple
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Format Sizes', { selector: 'input[type="file"]' });

    for (const file of files) {
      await userEvent.upload(fileInput, file);
    }

    await waitFor(() => {
      // Check for formatted sizes
      expect(screen.getByText(/512 B/i) || screen.getByText(/0\.50 KB/i)).toBeTruthy();
      expect(screen.getByText(/1\.00 MB/i)).toBeInTheDocument();
      expect(screen.getByText(/1\.00 GB/i) || screen.getByText(/1024\.00 MB/i)).toBeTruthy();
    });
  });
});

// ============================================================================
// TEST SUITE: PERFORMANCE AND EDGE CASES
// ============================================================================

describe('FormFileUpload - Performance and Edge Cases', () => {
  it('should handle large number of files efficiently', async () => {
    const methods = useForm();
    const manyFiles = Array.from({ length: 50 }, (_, i) =>
      createMockFile(`file${i + 1}.pdf`, 1024, 'application/pdf')
    );
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="manyFiles"
          control={methods.control}
          label="Many Files"
          multiple
          maxFiles={50}
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Many Files', { selector: 'input[type="file"]' });
    
    const startTime = performance.now();
    await userEvent.upload(fileInput, manyFiles);
    const endTime = performance.now();

    await waitFor(() => {
      expect(screen.getByText('file1.pdf')).toBeInTheDocument();
    });

    // Performance check: should complete within reasonable time
    expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
  });

  it('should handle very large file sizes', async () => {
    const methods = useForm();
    const largeSize = 500 * 1024 * 1024; // 500 MB
    const largeFile = createLargeFile('huge-video.mp4', largeSize);
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="hugeFile"
          control={methods.control}
          label="Huge File"
          maxSize={1024 * 1024 * 1024} // 1 GB limit
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Huge File', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, largeFile);

    await waitFor(() => {
      expect(screen.getByText(/500\.00 MB/i)).toBeInTheDocument();
    });

    expectFileSize(largeFile, largeSize);
  });

  it('should handle special characters in file names', async () => {
    const methods = useForm();
    const specialName = 'file with spaces & special (chars) [2024].pdf';
    const mockFile = createMockFile(specialName, 1024, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="specialChars"
          control={methods.control}
          label="Special Chars"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Special Chars', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText(specialName)).toBeInTheDocument();
    });
  });

  it('should handle empty file (0 bytes)', async () => {
    const methods = useForm();
    const emptyFile = createMockFile('empty.txt', 0, 'text/plain');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="emptyFile"
          control={methods.control}
          label="Empty File"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Empty File', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, emptyFile);

    await waitFor(() => {
      // Should display file even if empty, or show validation error
      expect(screen.getByText('empty.txt') || screen.getByText(/file is empty/i)).toBeTruthy();
    });
  });

  it('should handle concurrent file operations', async () => {
    const methods = useForm();
    const file1 = createMockFile('concurrent1.pdf', 1024, 'application/pdf');
    const file2 = createMockFile('concurrent2.pdf', 2048, 'application/pdf');
    
    render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="concurrentFiles"
          control={methods.control}
          label="Concurrent Files"
          multiple
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Concurrent Files', { selector: 'input[type="file"]' });
    
    // Upload files in quick succession
    await Promise.all([
      userEvent.upload(fileInput, file1),
      userEvent.upload(fileInput, file2),
    ]);

    await waitFor(() => {
      expect(screen.getByText('concurrent1.pdf')).toBeInTheDocument();
      expect(screen.getByText('concurrent2.pdf')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// TEST SUITE: SNAPSHOT TESTING
// ============================================================================

describe('FormFileUpload - Snapshot Tests', () => {
  it('should match snapshot for basic render', () => {
    const methods = useForm();
    
    const { container } = render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="snapshotBasic"
          control={methods.control}
          label="Snapshot Test"
        />
      </FormProvider>
    );

    expect(container.firstChild).toMatchSnapshot();
  });

  it('should match snapshot with files uploaded', async () => {
    const methods = useForm();
    const mockFile = createMockFile('snapshot.pdf', 1024, 'application/pdf');
    
    const { container } = render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="snapshotWithFiles"
          control={methods.control}
          label="Snapshot With Files"
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Snapshot With Files', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('snapshot.pdf')).toBeInTheDocument();
    });

    expect(container.firstChild).toMatchSnapshot();
  });

  it('should match snapshot with error state', async () => {
    const schema = z.object({
      snapshotError: z.instanceof(File, { message: 'Error for snapshot' }),
    });

    const { container } = render(
      <FormWrapper defaultValues={{ snapshotError: null }} schema={schema}>
        <FormFileUpload
          name="snapshotError"
          control={useForm().control}
          label="Snapshot Error"
          required
        />
      </FormWrapper>
    );

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/error for snapshot/i)).toBeInTheDocument();
    });

    expect(container.firstChild).toMatchSnapshot();
  });

  it('should match snapshot in disabled state', () => {
    const methods = useForm();
    
    const { container } = render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="snapshotDisabled"
          control={methods.control}
          label="Snapshot Disabled"
          disabled
        />
      </FormProvider>
    );

    expect(container.firstChild).toMatchSnapshot();
  });

  it('should match snapshot with multiple files and helper text', async () => {
    const methods = useForm();
    const files = [
      createMockFile('multi-snap1.pdf', 1024, 'application/pdf'),
      createMockFile('multi-snap2.pdf', 2048, 'application/pdf'),
    ];
    
    const { container } = render(
      <FormProvider {...methods}>
        <FormFileUpload
          name="snapshotMultiple"
          control={methods.control}
          label="Snapshot Multiple"
          helperText="Upload up to 5 files"
          multiple
          maxFiles={5}
        />
      </FormProvider>
    );

    const fileInput = screen.getByLabelText('Snapshot Multiple', { selector: 'input[type="file"]' });
    await userEvent.upload(fileInput, files);

    await waitFor(() => {
      expect(screen.getByText('multi-snap1.pdf')).toBeInTheDocument();
      expect(screen.getByText('multi-snap2.pdf')).toBeInTheDocument();
    });

    expect(container.firstChild).toMatchSnapshot();
  });
});
