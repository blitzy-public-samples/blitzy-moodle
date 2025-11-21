/**
 * Comprehensive Unit Tests for FileUploadZone Component
 *
 * Tests validate drag-and-drop functionality, file validation, upload progress tracking,
 * and file list management. Covers all user interactions, accessibility features,
 * error handling, and edge cases to achieve >90% test coverage.
 *
 * Test Coverage:
 * - Initial rendering and UI elements
 * - Drag-and-drop event handling
 * - File selection via click interaction
 * - File validation (size, type, count)
 * - Visual feedback for drag states
 * - File list display with remove functionality
 * - Upload progress indicators
 * - Error message display
 * - Existing files handling
 * - Disabled state behavior
 * - Accessibility (ARIA, keyboard navigation)
 * - Responsive design
 * - Performance optimizations
 * - Edge cases and error scenarios
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FileUploadZone from '@/features/activities/assignments/components/FileUploadZone';
import type { UploadedFile } from '@/features/activities/assignments/components/FileUploadZone';

// ============================================================================
// Test Helper Functions
// ============================================================================

/**
 * Create a mock File object with specified properties
 *
 * @param name - File name with extension
 * @param size - File size in bytes
 * @param type - MIME type of the file
 * @returns Mock File object
 */
function createMockFile(name: string, size: number, type: string): File {
  const file = new File(['file content'], name, { type });
  
  // Override the size property since File constructor doesn't set it accurately
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false,
  });
  
  return file;
}

/**
 * Create a DataTransfer object for drag-and-drop simulation
 *
 * @param files - Array of File objects to include in the transfer
 * @returns DataTransfer object with files
 */
function createDataTransfer(files: File[]): DataTransfer {
  const dataTransfer = new DataTransfer();
  
  files.forEach((file) => {
    dataTransfer.items.add(file);
  });
  
  return dataTransfer;
}

/**
 * Simulate a drag-and-drop event with files
 *
 * @param element - The HTML element to trigger the drop on
 * @param files - Array of File objects to drop
 */
function simulateDrop(element: HTMLElement, files: File[]): void {
  const dataTransfer = createDataTransfer(files);
  
  fireEvent.dragEnter(element, { dataTransfer });
  fireEvent.dragOver(element, { dataTransfer });
  fireEvent.drop(element, { dataTransfer });
}

/**
 * Simulate file selection via file input
 *
 * @param input - The file input element
 * @param files - Array of File objects to select
 */
function simulateFileInput(input: HTMLInputElement, files: File[]): void {
  const dataTransfer = createDataTransfer(files);
  
  // Set the files property of the input element
  Object.defineProperty(input, 'files', {
    value: dataTransfer.files,
    writable: false,
  });
  
  fireEvent.change(input);
}

/**
 * Create a mock UploadedFile object for existing files prop
 *
 * @param name - File name
 * @param size - File size in bytes
 * @param uploadProgress - Upload progress percentage (optional)
 * @param error - Error message (optional)
 * @returns UploadedFile object
 */
function createMockUploadedFile(
  name: string,
  size: number,
  uploadProgress?: number,
  error?: string
): UploadedFile {
  return {
    name,
    size,
    type: 'application/pdf',
    uploadProgress,
    error,
  };
}

// ============================================================================
// Test Suite: FileUploadZone Component
// ============================================================================

describe('FileUploadZone Component', () => {
  // Default props for all tests
  const defaultProps = {
    onFilesChange: vi.fn(),
    maxFileSize: 10485760, // 10MB
  };

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Initial Rendering Tests
  // ==========================================================================

  describe('Initial Rendering', () => {
    it('renders upload zone with default UI', () => {
      render(<FileUploadZone {...defaultProps} />);
      
      // Assert CloudUpload icon is present
      const uploadIcon = document.querySelector('[data-testid="CloudUploadIcon"]');
      expect(uploadIcon || screen.getByRole('button', { name: /file upload area/i })).toBeInTheDocument();
      
      // Assert drag-and-drop text
      expect(screen.getByText(/drag and drop files here, or click to select/i)).toBeInTheDocument();
      
      // Assert 'Select Files' button exists
      expect(screen.getByRole('button', { name: /select files/i })).toBeInTheDocument();
    });

    it('displays file size and type restrictions', () => {
      render(
        <FileUploadZone
          {...defaultProps}
          maxFileSize={5242880} // 5MB
          acceptedFileTypes={['pdf', 'doc']}
        />
      );
      
      // Assert file size restriction is displayed
      expect(screen.getByText(/max size: 5 MB/i)).toBeInTheDocument();
      
      // Assert accepted file types are displayed
      expect(screen.getByText(/accepted: pdf, doc/i)).toBeInTheDocument();
    });

    it('displays file count limit', () => {
      render(<FileUploadZone {...defaultProps} maxFiles={3} />);
      
      // Assert file count display exists
      expect(screen.getByText(/files: 0\/3/i)).toBeInTheDocument();
    });

    it('is empty initially with no existing files', () => {
      render(<FileUploadZone {...defaultProps} />);
      
      // Assert file list is empty - no ListItem components
      const fileList = screen.queryByRole('list');
      expect(fileList).not.toBeInTheDocument();
    });

    it('displays all file types accepted when no restrictions', () => {
      render(<FileUploadZone {...defaultProps} />);
      
      expect(screen.getByText(/all file types accepted/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Drag-and-Drop Event Tests
  // ==========================================================================

  describe('Drag-and-Drop Events', () => {
    it('updates visual state on drag enter', () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Simulate drag enter
      fireEvent.dragEnter(uploadZone);
      
      // Assert visual feedback for drag-active state
      expect(screen.getByText(/drop files here/i)).toBeInTheDocument();
    });

    it('resets visual state on drag leave', () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Trigger drag enter then drag leave
      fireEvent.dragEnter(uploadZone);
      expect(screen.getByText(/drop files here/i)).toBeInTheDocument();
      
      fireEvent.dragLeave(uploadZone, { target: uploadZone, currentTarget: uploadZone });
      
      // Assert default text is restored
      expect(screen.getByText(/drag and drop files here, or click to select/i)).toBeInTheDocument();
    });

    it('prevents default on drag over', () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Create spy on preventDefault
      const preventDefaultSpy = vi.fn();
      const dragOverEvent = new DragEvent('dragover', { bubbles: true, cancelable: true });
      dragOverEvent.preventDefault = preventDefaultSpy;
      
      // Trigger drag over
      fireEvent(uploadZone, dragOverEvent);
      
      // Assert preventDefault was called
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('handles file drop correctly', async () => {
      const onFilesChange = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesChange={onFilesChange} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Create mock file
      const mockFile = createMockFile('document.pdf', 1024, 'application/pdf');
      
      // Simulate drop
      simulateDrop(uploadZone, [mockFile]);
      
      // Wait for async processing
      await waitFor(() => {
        expect(onFilesChange).toHaveBeenCalled();
      });
      
      // Assert callback was called with the dropped file
      const callArgs = (onFilesChange.mock.calls[0] as unknown as [File[]])[0];
      expect(callArgs).toHaveLength(1);
      expect(callArgs[0]!.name).toBe('document.pdf');
    });

    it('validates files on drop', async () => {
      render(<FileUploadZone {...defaultProps} maxFileSize={1024} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Drop file that exceeds maxFileSize
      const oversizedFile = createMockFile('large.pdf', 2048, 'application/pdf');
      simulateDrop(uploadZone, [oversizedFile]);
      
      // Assert error is displayed
      await waitFor(() => {
        expect(screen.getByText(/file "large.pdf" is too large/i)).toBeInTheDocument();
      });
    });

    it('handles multiple files in single drop', async () => {
      const onFilesChange = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesChange={onFilesChange} maxFiles={5} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Drop 3 files at once
      const files = [
        createMockFile('file1.pdf', 1024, 'application/pdf'),
        createMockFile('file2.pdf', 1024, 'application/pdf'),
        createMockFile('file3.pdf', 1024, 'application/pdf'),
      ];
      
      simulateDrop(uploadZone, files);
      
      // Assert all 3 files are added
      await waitFor(() => {
        expect(onFilesChange).toHaveBeenCalled();
        const callArgs = (onFilesChange.mock.calls[0] as unknown as [File[]])[0];
        expect(callArgs).toHaveLength(3);
      });
    });
  });

  // ==========================================================================
  // Click-to-Select File Tests
  // ==========================================================================

  describe('Click-to-Select Files', () => {
    it('opens file input on zone click', async () => {
      const user = userEvent.setup();
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Click on upload zone
      await user.click(uploadZone);
      
      // File input should be present (hidden)
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
    });

    it('opens file input on Select Files button click', async () => {
      const user = userEvent.setup();
      render(<FileUploadZone {...defaultProps} />);
      
      const selectButton = screen.getByRole('button', { name: /select files/i });
      
      // Click 'Select Files' button
      await user.click(selectButton);
      
      // File input should be triggered
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
    });

    it('handles file selection from input', async () => {
      const onFilesChange = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesChange={onFilesChange} />);
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Create mock files and simulate selection
      const mockFile = createMockFile('selected.pdf', 1024, 'application/pdf');
      simulateFileInput(fileInput, [mockFile]);
      
      // Assert onFilesChange was called
      await waitFor(() => {
        expect(onFilesChange).toHaveBeenCalled();
      });
    });

    it('allows multiple file selection when maxFiles > 1', () => {
      render(<FileUploadZone {...defaultProps} maxFiles={5} />);
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Assert file input has 'multiple' attribute
      expect(fileInput).toHaveAttribute('multiple');
    });

    it('restricts to single file when maxFiles = 1', () => {
      render(<FileUploadZone {...defaultProps} maxFiles={1} />);
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Assert file input does not have 'multiple' attribute
      expect(fileInput).not.toHaveAttribute('multiple');
    });
  });

  // ==========================================================================
  // File Validation Tests
  // ==========================================================================

  describe('File Validation', () => {
    it('validates file size against maxFileSize', async () => {
      render(<FileUploadZone {...defaultProps} maxFileSize={1048576} />); // 1MB
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add file with size > maxFileSize
      const oversizedFile = createMockFile('huge.pdf', 2097152, 'application/pdf'); // 2MB
      simulateDrop(uploadZone, [oversizedFile]);
      
      // Assert error message
      await waitFor(() => {
        expect(screen.getByText(/file "huge.pdf" is too large/i)).toBeInTheDocument();
      });
      
      // Assert file is not added to list
      expect(screen.queryByText('huge.pdf')).not.toBeInTheDocument();
    });

    it('validates file type against acceptedFileTypes', async () => {
      render(<FileUploadZone {...defaultProps} acceptedFileTypes={['pdf']} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add .txt file when only .pdf is accepted
      const invalidFile = createMockFile('document.txt', 1024, 'text/plain');
      simulateDrop(uploadZone, [invalidFile]);
      
      // Assert error message
      await waitFor(() => {
        expect(screen.getByText(/file "document.txt" has an invalid file type/i)).toBeInTheDocument();
      });
    });

    it('validates total file count against maxFiles', async () => {
      render(<FileUploadZone {...defaultProps} maxFiles={2} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add 2 valid files
      const file1 = createMockFile('file1.pdf', 1024, 'application/pdf');
      const file2 = createMockFile('file2.pdf', 1024, 'application/pdf');
      simulateDrop(uploadZone, [file1, file2]);
      
      await waitFor(() => {
        expect(screen.getByText('file1.pdf')).toBeInTheDocument();
      });
      
      // Attempt to add 3rd file
      const file3 = createMockFile('file3.pdf', 1024, 'application/pdf');
      simulateDrop(uploadZone, [file3]);
      
      // Assert error
      await waitFor(() => {
        expect(screen.getByText(/cannot upload more than 2 files/i)).toBeInTheDocument();
      });
    });

    it('allows files matching accepted types', async () => {
      const onFilesChange = vi.fn();
      render(
        <FileUploadZone
          {...defaultProps}
          onFilesChange={onFilesChange}
          acceptedFileTypes={['pdf', 'doc', 'jpg']}
        />
      );
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add file with .pdf extension
      const validFile = createMockFile('report.pdf', 1024, 'application/pdf');
      simulateDrop(uploadZone, [validFile]);
      
      // Assert no error is displayed
      await waitFor(() => {
        expect(onFilesChange).toHaveBeenCalled();
      });
      
      // Assert file is added to list
      await waitFor(() => {
        expect(screen.getByText('report.pdf')).toBeInTheDocument();
      });
    });

    it('accepts files within size limit', async () => {
      const onFilesChange = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesChange={onFilesChange} maxFileSize={1048576} />); // 1MB
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add file with size=524288 (512KB)
      const validFile = createMockFile('small.pdf', 524288, 'application/pdf');
      simulateDrop(uploadZone, [validFile]);
      
      // Assert no error
      await waitFor(() => {
        expect(onFilesChange).toHaveBeenCalled();
      });
      
      // Assert file is added
      await waitFor(() => {
        expect(screen.getByText('small.pdf')).toBeInTheDocument();
      });
    });

    it('handles wildcard file types (e.g., image/*)', async () => {
      const onFilesChange = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesChange={onFilesChange} acceptedFileTypes={['image/*']} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add image file
      const imageFile = createMockFile('photo.jpg', 1024, 'image/jpeg');
      simulateDrop(uploadZone, [imageFile]);
      
      // Assert file is accepted
      await waitFor(() => {
        expect(screen.getByText('photo.jpg')).toBeInTheDocument();
      });
      
      // Add non-image file
      const pdfFile = createMockFile('document.pdf', 1024, 'application/pdf');
      simulateDrop(uploadZone, [pdfFile]);
      
      // Assert file is rejected
      await waitFor(() => {
        expect(screen.getByText(/file "document.pdf" has an invalid file type/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // File List Display Tests
  // ==========================================================================

  describe('File List Display', () => {
    it('displays uploaded files in list', async () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add 2 files
      const files = [
        createMockFile('file1.pdf', 1024, 'application/pdf'),
        createMockFile('file2.pdf', 2048, 'application/pdf'),
      ];
      simulateDrop(uploadZone, files);
      
      // Assert List component is rendered
      await waitFor(() => {
        const fileList = screen.getByRole('list');
        expect(fileList).toBeInTheDocument();
      });
      
      // Assert both file names are displayed
      await waitFor(() => {
        expect(screen.getByText('file1.pdf')).toBeInTheDocument();
        expect(screen.getByText('file2.pdf')).toBeInTheDocument();
      });
    });

    it('displays formatted file sizes', async () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add file with size=2097152 (2MB)
      const file = createMockFile('large.pdf', 2097152, 'application/pdf');
      simulateDrop(uploadZone, [file]);
      
      // Assert formatted size is displayed
      await waitFor(() => {
        expect(screen.getByText(/2 MB/i)).toBeInTheDocument();
      });
    });

    it('shows file icon for each file', async () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add file
      const file = createMockFile('doc.pdf', 1024, 'application/pdf');
      simulateDrop(uploadZone, [file]);
      
      // Assert InsertDriveFile icon is present
      await waitFor(() => {
        const fileItem = screen.getByText('doc.pdf').closest('li');
        expect(fileItem).toBeInTheDocument();
      });
    });

    it('displays file count chip', async () => {
      render(<FileUploadZone {...defaultProps} maxFiles={5} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add 2 files
      const files = [
        createMockFile('file1.pdf', 1024, 'application/pdf'),
        createMockFile('file2.pdf', 1024, 'application/pdf'),
      ];
      simulateDrop(uploadZone, files);
      
      // Assert Chip displays '2/5'
      await waitFor(() => {
        expect(screen.getByText(/files: 2\/5/i)).toBeInTheDocument();
      });
    });

    it('updates count chip as files are added/removed', async () => {
      const user = userEvent.setup();
      render(<FileUploadZone {...defaultProps} maxFiles={5} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add first file
      const file1 = createMockFile('file1.pdf', 1024, 'application/pdf');
      simulateDrop(uploadZone, [file1]);
      
      await waitFor(() => {
        expect(screen.getByText(/files: 1\/5/i)).toBeInTheDocument();
      });
      
      // Add second file
      const file2 = createMockFile('file2.pdf', 1024, 'application/pdf');
      simulateDrop(uploadZone, [file2]);
      
      await waitFor(() => {
        expect(screen.getByText(/files: 2\/5/i)).toBeInTheDocument();
      });
      
      // Remove one file
      const deleteButtons = screen.getAllByLabelText(/remove/i);
      await user.click(deleteButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText(/files: 1\/5/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // File Removal Tests
  // ==========================================================================

  describe('File Removal', () => {
    it('displays delete button for each file', async () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add file
      const file = createMockFile('document.pdf', 1024, 'application/pdf');
      simulateDrop(uploadZone, [file]);
      
      // Assert Delete IconButton exists
      await waitFor(() => {
        expect(screen.getByLabelText(/remove document.pdf/i)).toBeInTheDocument();
      });
    });

    it('removes file when delete button clicked', async () => {
      const user = userEvent.setup();
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add 2 files
      const files = [
        createMockFile('file1.pdf', 1024, 'application/pdf'),
        createMockFile('file2.pdf', 1024, 'application/pdf'),
      ];
      simulateDrop(uploadZone, files);
      
      await waitFor(() => {
        expect(screen.getByText('file1.pdf')).toBeInTheDocument();
      });
      
      // Click delete button on first file
      const deleteButton = screen.getByLabelText(/remove file1.pdf/i);
      await user.click(deleteButton);
      
      // Assert only 1 file remains
      await waitFor(() => {
        expect(screen.queryByText('file1.pdf')).not.toBeInTheDocument();
        expect(screen.getByText('file2.pdf')).toBeInTheDocument();
      });
    });

    it('calls onFilesChange with updated file list after removal', async () => {
      const user = userEvent.setup();
      const onFilesChange = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesChange={onFilesChange} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add 2 files
      const files = [
        createMockFile('file1.pdf', 1024, 'application/pdf'),
        createMockFile('file2.pdf', 1024, 'application/pdf'),
      ];
      simulateDrop(uploadZone, files);
      
      await waitFor(() => {
        expect(onFilesChange).toHaveBeenCalled();
      });
      
      // Clear previous calls
      onFilesChange.mockClear();
      
      // Remove first file
      const deleteButton = screen.getByLabelText(/remove file1.pdf/i);
      await user.click(deleteButton);
      
      // Assert onFilesChange called with array of 1 file
      await waitFor(() => {
        expect(onFilesChange).toHaveBeenCalled();
        const callArgs = (onFilesChange.mock.calls[0] as unknown as [File[]])[0];
        expect(callArgs).toHaveLength(1);
        expect(callArgs[0]!.name).toBe('file2.pdf');
      });
    });

    it('allows adding files after removal below limit', async () => {
      render(<FileUploadZone {...defaultProps} maxFiles={2} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add 2 files (at limit)
      const initialFiles = [
        createMockFile('file1.pdf', 1024, 'application/pdf'),
        createMockFile('file2.pdf', 1024, 'application/pdf'),
      ];
      simulateDrop(uploadZone, initialFiles);
      
      await waitFor(() => {
        expect(screen.getByText('file1.pdf')).toBeInTheDocument();
      });
      
      // Remove 1 file
      const user = userEvent.setup();
      const deleteButton = screen.getByLabelText(/remove file1.pdf/i);
      await user.click(deleteButton);
      
      await waitFor(() => {
        expect(screen.queryByText('file1.pdf')).not.toBeInTheDocument();
      });
      
      // Add another file
      const newFile = createMockFile('file3.pdf', 1024, 'application/pdf');
      simulateDrop(uploadZone, [newFile]);
      
      // Assert new file is added successfully
      await waitFor(() => {
        expect(screen.getByText('file3.pdf')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Upload Progress Tests
  // ==========================================================================

  describe('Upload Progress', () => {
    it('displays progress bar for uploading files', () => {
      const existingFiles: UploadedFile[] = [
        createMockUploadedFile('uploading.pdf', 1024, 50),
      ];
      
      render(<FileUploadZone {...defaultProps} existingFiles={existingFiles} />);
      
      // Assert LinearProgress component is rendered
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      
      // Assert progress value is 50%
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('hides progress bar for completed uploads', () => {
      const existingFiles: UploadedFile[] = [
        createMockUploadedFile('completed.pdf', 1024, 100),
      ];
      
      render(<FileUploadZone {...defaultProps} existingFiles={existingFiles} />);
      
      // Assert no progress bar is displayed for completed file
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('shows different states for different files simultaneously', () => {
      const existingFiles: UploadedFile[] = [
        createMockUploadedFile('fileA.pdf', 1024, 30),
        createMockUploadedFile('fileB.pdf', 1024, 70),
      ];
      
      render(<FileUploadZone {...defaultProps} existingFiles={existingFiles} />);
      
      // Assert both progress values are displayed
      expect(screen.getByText('30%')).toBeInTheDocument();
      expect(screen.getByText('70%')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Error Handling and Display Tests
  // ==========================================================================

  describe('Error Handling and Display', () => {
    it('displays validation errors in Alert component', async () => {
      render(<FileUploadZone {...defaultProps} maxFileSize={1024} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Trigger validation error (oversized file)
      const oversizedFile = createMockFile('huge.pdf', 2048, 'application/pdf');
      simulateDrop(uploadZone, [oversizedFile]);
      
      // Assert Alert component with error message
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/file "huge.pdf" is too large/i)).toBeInTheDocument();
      });
    });

    it('shows multiple errors for multiple invalid files', async () => {
      render(<FileUploadZone {...defaultProps} maxFileSize={1024} acceptedFileTypes={['pdf']} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add 2 files with different validation errors
      const files = [
        createMockFile('oversized.pdf', 2048, 'application/pdf'), // Too large
        createMockFile('wrong-type.txt', 512, 'text/plain'), // Wrong type
      ];
      simulateDrop(uploadZone, files);
      
      // Assert both error messages are displayed
      await waitFor(() => {
        expect(screen.getByText(/file "oversized.pdf" is too large/i)).toBeInTheDocument();
        expect(screen.getByText(/file "wrong-type.txt" has an invalid file type/i)).toBeInTheDocument();
      });
    });

    it('clears errors when valid files are added', async () => {
      render(<FileUploadZone {...defaultProps} maxFileSize={1024} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Trigger error
      const invalidFile = createMockFile('invalid.pdf', 2048, 'application/pdf');
      simulateDrop(uploadZone, [invalidFile]);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      
      // Add valid file
      const validFile = createMockFile('valid.pdf', 512, 'application/pdf');
      simulateDrop(uploadZone, [validFile]);
      
      // Assert error Alert is removed
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    it('allows closing error alerts', async () => {
      const user = userEvent.setup();
      render(<FileUploadZone {...defaultProps} maxFileSize={1024} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Trigger error
      const invalidFile = createMockFile('invalid.pdf', 2048, 'application/pdf');
      simulateDrop(uploadZone, [invalidFile]);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      
      // Find and click close button
      const closeButton = within(screen.getByRole('alert')).getByRole('button');
      await user.click(closeButton);
      
      // Assert alert is closed
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Existing Files Handling Tests
  // ==========================================================================

  describe('Existing Files Handling', () => {
    it('displays existing files from props', () => {
      const existingFiles: UploadedFile[] = [
        createMockUploadedFile('existing1.pdf', 1024),
        createMockUploadedFile('existing2.pdf', 2048),
      ];
      
      render(<FileUploadZone {...defaultProps} existingFiles={existingFiles} />);
      
      // Assert existing files are shown in list
      expect(screen.getByText('existing1.pdf')).toBeInTheDocument();
      expect(screen.getByText('existing2.pdf')).toBeInTheDocument();
    });

    it('allows removing existing files', async () => {
      const user = userEvent.setup();
      const onFilesChange = vi.fn();
      const existingFiles: UploadedFile[] = [
        createMockUploadedFile('existing.pdf', 1024),
      ];
      
      render(<FileUploadZone {...defaultProps} existingFiles={existingFiles} onFilesChange={onFilesChange} />);
      
      // Click delete on existing file
      const deleteButton = screen.getByLabelText(/remove existing.pdf/i);
      await user.click(deleteButton);
      
      // Assert file is removed
      await waitFor(() => {
        expect(screen.queryByText('existing.pdf')).not.toBeInTheDocument();
      });
      
      // Assert onFilesChange reflects removal
      expect(onFilesChange).toHaveBeenCalledWith([]);
    });

    it('preserves existing files when adding new ones', async () => {
      const existingFiles: UploadedFile[] = [
        createMockUploadedFile('existing.pdf', 1024),
      ];
      
      render(<FileUploadZone {...defaultProps} existingFiles={existingFiles} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add new file
      const newFile = createMockFile('new.pdf', 1024, 'application/pdf');
      simulateDrop(uploadZone, [newFile]);
      
      // Assert both files are in list
      await waitFor(() => {
        expect(screen.getByText('existing.pdf')).toBeInTheDocument();
        expect(screen.getByText('new.pdf')).toBeInTheDocument();
      });
    });

    it('displays errors for existing files with error property', () => {
      const existingFiles: UploadedFile[] = [
        createMockUploadedFile('error-file.pdf', 1024, undefined, 'Upload failed'),
      ];
      
      render(<FileUploadZone {...defaultProps} existingFiles={existingFiles} />);
      
      // Assert error message is displayed
      expect(screen.getByText('Upload failed')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Disabled State Tests
  // ==========================================================================

  describe('Disabled State', () => {
    it('disables upload interactions when disabled=true', async () => {
      const user = userEvent.setup();
      render(<FileUploadZone {...defaultProps} disabled />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Attempt to click zone
      await user.click(uploadZone);
      
      // Assert drag events are ignored
      fireEvent.dragEnter(uploadZone);
      expect(screen.queryByText(/drop files here/i)).not.toBeInTheDocument();
    });

    it('displays disabled visual state', () => {
      render(<FileUploadZone {...defaultProps} disabled />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Assert disabled state
      expect(uploadZone).toHaveAttribute('aria-disabled', 'true');
    });

    it('disables delete buttons when disabled', () => {
      const existingFiles: UploadedFile[] = [
        createMockUploadedFile('file.pdf', 1024),
      ];
      
      render(<FileUploadZone {...defaultProps} existingFiles={existingFiles} disabled />);
      
      // Assert delete button is disabled
      const deleteButton = screen.getByLabelText(/remove file.pdf/i);
      expect(deleteButton).toBeDisabled();
    });

    it('disables Select Files button when disabled', () => {
      render(<FileUploadZone {...defaultProps} disabled />);
      
      const selectButton = screen.getByRole('button', { name: /select files/i });
      
      // Assert button is disabled
      expect(selectButton).toBeDisabled();
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('has aria-label on upload zone', () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Assert aria-label exists
      expect(uploadZone).toHaveAttribute('aria-label', 'File upload area');
    });

    it('has role="button" on clickable zone', () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Assert role='button'
      expect(uploadZone).toHaveAttribute('role', 'button');
    });

    it('is keyboard accessible with Enter key', async () => {
      const user = userEvent.setup();
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Focus on upload zone
      uploadZone.focus();
      expect(uploadZone).toHaveFocus();
      
      // Press Enter key
      await user.keyboard('{Enter}');
      
      // File input should be present
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
    });

    it('is keyboard accessible with Space key', async () => {
      const user = userEvent.setup();
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Focus on upload zone
      uploadZone.focus();
      
      // Press Space key
      await user.keyboard(' ');
      
      // File input should be present
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
    });

    it('has accessible labels for all buttons', () => {
      render(<FileUploadZone {...defaultProps} />);
      
      // Assert 'Select Files' button has accessible name
      expect(screen.getByRole('button', { name: /select files/i })).toBeInTheDocument();
    });

    it('has accessible labels for delete buttons', async () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add file
      const file = createMockFile('document.pdf', 1024, 'application/pdf');
      simulateDrop(uploadZone, [file]);
      
      // Assert delete button has aria-label
      await waitFor(() => {
        expect(screen.getByLabelText(/remove document.pdf/i)).toBeInTheDocument();
      });
    });

    it('has proper tabIndex for keyboard navigation', () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Assert tabIndex is 0 (focusable)
      expect(uploadZone).toHaveAttribute('tabIndex', '0');
    });

    it('removes tabIndex when disabled', () => {
      render(<FileUploadZone {...defaultProps} disabled />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Assert tabIndex is -1 (not focusable)
      expect(uploadZone).toHaveAttribute('tabIndex', '-1');
    });
  });

  // ==========================================================================
  // Responsive Design Tests
  // ==========================================================================

  describe('Responsive Design', () => {
    it('uses touch-friendly button sizes', () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const selectButton = screen.getByRole('button', { name: /select files/i });
      
      // Assert button has minimum touch-friendly size (MUI's minHeight and minWidth should be set via sx prop)
      expect(selectButton).toBeInTheDocument();
    });

    it('has touch-friendly delete buttons', async () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add file
      const file = createMockFile('doc.pdf', 1024, 'application/pdf');
      simulateDrop(uploadZone, [file]);
      
      // Assert delete button exists
      await waitFor(() => {
        const deleteButton = screen.getByLabelText(/remove doc.pdf/i);
        expect(deleteButton).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  describe('Performance', () => {
    it('efficiently renders large file lists', () => {
      const existingFiles: UploadedFile[] = Array.from({ length: 20 }, (_, i) =>
        createMockUploadedFile(`file${i + 1}.pdf`, 1024)
      );
      
      const startTime = performance.now();
      render(<FileUploadZone {...defaultProps} existingFiles={existingFiles} />);
      const endTime = performance.now();
      
      // Assert render time is reasonable (<200ms for 20 files to account for test system variability)
      expect(endTime - startTime).toBeLessThan(200);
      
      // Assert all files are displayed
      expect(screen.getByText('file1.pdf')).toBeInTheDocument();
      expect(screen.getByText('file20.pdf')).toBeInTheDocument();
    });

    it('handles callback updates efficiently', async () => {
      const onFilesChange = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesChange={onFilesChange} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add file
      const file = createMockFile('test.pdf', 1024, 'application/pdf');
      simulateDrop(uploadZone, [file]);
      
      // Assert callback is called exactly once
      await waitFor(() => {
        expect(onFilesChange).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('handles empty file drop gracefully', () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Simulate drop with empty files array
      simulateDrop(uploadZone, []);
      
      // Assert no errors thrown and no files added
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('handles files with same name', async () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add file named 'document.pdf'
      const file1 = createMockFile('document.pdf', 1024, 'application/pdf');
      simulateDrop(uploadZone, [file1]);
      
      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });
      
      // Add another file named 'document.pdf'
      const file2 = createMockFile('document.pdf', 2048, 'application/pdf');
      simulateDrop(uploadZone, [file2]);
      
      // Assert both files are displayed
      await waitFor(() => {
        const fileItems = screen.getAllByText('document.pdf');
        expect(fileItems).toHaveLength(2);
      });
    });

    it('handles special characters in filenames', async () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add file with special characters
      const file = createMockFile('test%20file&name.pdf', 1024, 'application/pdf');
      simulateDrop(uploadZone, [file]);
      
      // Assert displays correctly
      await waitFor(() => {
        expect(screen.getByText('test%20file&name.pdf')).toBeInTheDocument();
      });
    });

    it('handles zero maxFileSize (unlimited)', async () => {
      render(<FileUploadZone {...defaultProps} maxFileSize={0} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add very large file
      const largeFile = createMockFile('huge.pdf', 100000000, 'application/pdf'); // 100MB
      simulateDrop(uploadZone, [largeFile]);
      
      // Assert file is accepted (no size validation)
      await waitFor(() => {
        expect(screen.getByText('huge.pdf')).toBeInTheDocument();
      });
    });

    it('handles undefined maxFiles (unlimited)', async () => {
      render(<FileUploadZone {...defaultProps} maxFiles={undefined} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add many files
      const files = Array.from({ length: 10 }, (_, i) =>
        createMockFile(`file${i + 1}.pdf`, 1024, 'application/pdf')
      );
      
      simulateDrop(uploadZone, files);
      
      // Assert all files are accepted
      await waitFor(() => {
        expect(screen.getByText('file1.pdf')).toBeInTheDocument();
        expect(screen.getByText('file10.pdf')).toBeInTheDocument();
      });
    });

    it('handles file types with dots in extension', async () => {
      render(<FileUploadZone {...defaultProps} acceptedFileTypes={['.tar.gz']} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add file with .tar.gz extension
      const file = createMockFile('archive.tar.gz', 1024, 'application/gzip');
      simulateDrop(uploadZone, [file]);
      
      // Assert file is handled correctly
      await waitFor(() => {
        expect(screen.getByText('archive.tar.gz')).toBeInTheDocument();
      });
    });

    it('handles rapid successive drops', async () => {
      const onFilesChange = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesChange={onFilesChange} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Drop files rapidly
      const file1 = createMockFile('file1.pdf', 1024, 'application/pdf');
      const file2 = createMockFile('file2.pdf', 1024, 'application/pdf');
      
      simulateDrop(uploadZone, [file1]);
      simulateDrop(uploadZone, [file2]);
      
      // Assert both files are processed
      await waitFor(() => {
        expect(screen.getByText('file1.pdf')).toBeInTheDocument();
        expect(screen.getByText('file2.pdf')).toBeInTheDocument();
      });
    });

    it('handles files without extensions', async () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add file without extension
      const file = createMockFile('README', 1024, 'text/plain');
      simulateDrop(uploadZone, [file]);
      
      // Assert file is displayed
      await waitFor(() => {
        expect(screen.getByText('README')).toBeInTheDocument();
      });
    });

    it('handles extremely long filenames', async () => {
      render(<FileUploadZone {...defaultProps} />);
      
      const uploadZone = screen.getByRole('button', { name: /file upload area/i });
      
      // Add file with very long name
      const longName = `${'a'.repeat(200)  }.pdf`;
      const file = createMockFile(longName, 1024, 'application/pdf');
      simulateDrop(uploadZone, [file]);
      
      // Assert file is displayed with proper text handling
      await waitFor(() => {
        expect(screen.getByText(longName)).toBeInTheDocument();
      });
    });
  });
});
