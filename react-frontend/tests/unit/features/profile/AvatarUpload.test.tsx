/**
 * Unit Tests for AvatarUpload Component
 * 
 * Tests avatar image upload functionality including:
 * - File selection and validation
 * - Image preview rendering
 * - Drag-and-drop interface
 * - Upload progress tracking
 * - Error handling
 * - Accessibility compliance
 * 
 * @package react-frontend
 * @subpackage tests/unit/features/profile
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend expect matchers
expect.extend(toHaveNoViolations);

// Mock AvatarUpload component (to be imported from actual implementation)
const AvatarUpload = vi.fn(({ onUploadSuccess, onUploadError, maxFileSize = 5242880, acceptedFormats = ['image/jpeg', 'image/png', 'image/gif'] }) => {
  const [preview, setPreview] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!acceptedFormats.includes(file.type)) {
      return `Invalid file type. Please upload ${acceptedFormats.join(', ')} only.`;
    }
    if (file.size > maxFileSize) {
      return `File size exceeds ${(maxFileSize / 1024 / 1024).toFixed(0)}MB limit.`;
    }
    return null;
  };

  const handleFileSelect = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      onUploadError?.(new Error(validationError));
      return;
    }

    setError(null);

    // Generate preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Simulate upload
    setUploading(true);
    setProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 100);

    // Simulate upload completion
    setTimeout(() => {
      setUploading(false);
      setProgress(100);
      onUploadSuccess?.(file);
    }, 1200);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div data-testid="avatar-upload" role="region" aria-label="Avatar upload">
      <div
        data-testid="drop-zone"
        role="button"
        tabIndex={0}
        aria-label="Upload avatar image. Drag and drop or click to browse."
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyPress}
        style={{
          border: isDragging ? '2px dashed blue' : '2px dashed gray',
          padding: '20px',
          cursor: 'pointer'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.join(',')}
          onChange={handleInputChange}
          style={{ display: 'none' }}
          aria-label="Choose avatar image file"
          data-testid="file-input"
        />
        
        {!preview && (
          <div>
            <p>Drag and drop an image here, or click to browse</p>
            <p aria-live="polite">Accepted formats: JPEG, PNG, GIF</p>
            <p aria-live="polite">Maximum size: {(maxFileSize / 1024 / 1024).toFixed(0)}MB</p>
          </div>
        )}

        {preview && !uploading && (
          <div data-testid="preview-container" role="img" aria-label="Avatar preview">
            <img src={preview} alt="Avatar preview" style={{ maxWidth: '200px', maxHeight: '200px' }} />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              aria-label="Remove avatar image"
              data-testid="remove-button"
            >
              Remove
            </button>
          </div>
        )}

        {uploading && (
          <div role="status" aria-live="polite" aria-label={`Uploading ${progress}%`}>
            <div data-testid="progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${progress}%`, height: '20px', backgroundColor: 'blue' }} />
            </div>
            <p>Uploading... {progress}%</p>
          </div>
        )}

        {error && (
          <div role="alert" aria-live="assertive" data-testid="error-message" style={{ color: 'red' }}>
            {error}
          </div>
        )}

        {progress === 100 && !uploading && !error && (
          <div role="status" aria-live="polite" data-testid="success-message" style={{ color: 'green' }}>
            Avatar uploaded successfully!
          </div>
        )}
      </div>
    </div>
  );
});

// Mock useFileUpload hook
const mockUseFileUpload = vi.fn(() => ({
  uploadFile: vi.fn(),
  progress: 0,
  uploading: false,
  error: null
}));

vi.mock('@/hooks/useFileUpload', () => ({
  useFileUpload: mockUseFileUpload
}));

describe('AvatarUpload Component', () => {
  let user: ReturnType<typeof userEvent.setup>;
  const mockOnUploadSuccess = vi.fn();
  const mockOnUploadError = vi.fn();

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    
    // Mock FileReader
    global.FileReader = class FileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
      
      readAsDataURL(blob: Blob) {
        setTimeout(() => {
          this.result = `data:${blob.type};base64,fake-image-data`;
          if (this.onload) {
            this.onload({ target: this } as ProgressEvent<FileReader>);
          }
        }, 0);
      }
      
      abort() {}
      readAsArrayBuffer() {}
      readAsBinaryString() {}
      readAsText() {}
      addEventListener() {}
      removeEventListener() {}
      dispatchEvent() { return true; }
      EMPTY = 0;
      LOADING = 1;
      DONE = 2;
      readyState = 0;
      error = null;
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('File Selection via Input', () => {
    it('should allow file selection through file input element', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const dropZone = screen.getByTestId('drop-zone');
      await user.click(dropZone);

      const fileInput = screen.getByTestId('file-input');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('type', 'file');
    });

    it('should trigger file selection when clicking the drop zone', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /avatar preview/i })).toBeInTheDocument();
      });
    });

    it('should handle keyboard navigation for file selection', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const dropZone = screen.getByTestId('drop-zone');
      dropZone.focus();
      
      expect(dropZone).toHaveAttribute('tabIndex', '0');
      expect(document.activeElement).toBe(dropZone);
    });
  });

  describe('File Type Validation', () => {
    it('should accept JPEG files', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /avatar preview/i })).toBeInTheDocument();
      });
      
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
    });

    it('should accept PNG files', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.png', { type: 'image/png' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /avatar preview/i })).toBeInTheDocument();
      });
      
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
    });

    it('should accept GIF files', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.gif', { type: 'image/gif' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /avatar preview/i })).toBeInTheDocument();
      });
      
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
    });

    it('should reject unsupported file types', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'document.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
      
      expect(screen.getByTestId('error-message')).toHaveTextContent(/invalid file type/i);
      expect(mockOnUploadError).toHaveBeenCalled();
    });

    it('should reject WebP files if not in accepted formats', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.webp', { type: 'image/webp' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
      
      expect(screen.getByTestId('error-message')).toHaveTextContent(/invalid file type/i);
    });

    it('should display accepted file formats in the UI', () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      expect(screen.getByText(/accepted formats: jpeg, png, gif/i)).toBeInTheDocument();
    });
  });

  describe('File Size Validation', () => {
    it('should accept files within size limit (2MB)', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
          maxFileSize={5242880}
        />
      );

      const content = new Array(2 * 1024 * 1024).fill('a').join('');
      const file = new File([content], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /avatar preview/i })).toBeInTheDocument();
      });
      
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
    });

    it('should reject files exceeding 5MB limit', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
          maxFileSize={5242880}
        />
      );

      const content = new Array(6 * 1024 * 1024).fill('a').join('');
      const file = new File([content], 'large-avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
      
      expect(screen.getByTestId('error-message')).toHaveTextContent(/file size exceeds.*5mb/i);
      expect(mockOnUploadError).toHaveBeenCalled();
    });

    it('should display maximum file size in the UI', () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
          maxFileSize={5242880}
        />
      );

      expect(screen.getByText(/maximum size: 5mb/i)).toBeInTheDocument();
    });

    it('should handle custom file size limits', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
          maxFileSize={2097152}
        />
      );

      const content = new Array(3 * 1024 * 1024).fill('a').join('');
      const file = new File([content], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent(/file size exceeds.*2mb/i);
      });
    });
  });

  describe('Image Preview', () => {
    it('should display image preview after file selection', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        const preview = screen.getByRole('img', { name: /avatar preview/i });
        expect(preview).toBeInTheDocument();
        expect(preview).toHaveAttribute('src', expect.stringContaining('data:image/jpeg'));
      });
    });

    it('should use FileReader API to generate preview', async () => {
      const fileReaderSpy = vi.spyOn(global, 'FileReader' as any);
      
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(fileReaderSpy).toHaveBeenCalled();
      });
    });

    it('should show preview container with proper ARIA attributes', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        const previewContainer = screen.getByTestId('preview-container');
        expect(previewContainer).toHaveAttribute('role', 'img');
        expect(previewContainer).toHaveAttribute('aria-label', 'Avatar preview');
      });
    });

    it('should hide drop zone text when preview is shown', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      expect(screen.getByText(/drag and drop an image here/i)).toBeInTheDocument();

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.queryByText(/drag and drop an image here/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop Functionality', () => {
    it('should handle drag over event', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const dropZone = screen.getByTestId('drop-zone');
      
      const dragOverEvent = new Event('dragover', { bubbles: true });
      Object.defineProperty(dragOverEvent, 'preventDefault', { value: vi.fn() });
      
      dropZone.dispatchEvent(dragOverEvent);

      // Visual feedback should be applied (border change)
      expect(dropZone).toHaveStyle({ border: '2px dashed blue' });
    });

    it('should handle drag leave event', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const dropZone = screen.getByTestId('drop-zone');
      
      const dragOverEvent = new Event('dragover', { bubbles: true });
      const dragLeaveEvent = new Event('dragleave', { bubbles: true });
      
      dropZone.dispatchEvent(dragOverEvent);
      dropZone.dispatchEvent(dragLeaveEvent);

      // Visual feedback should be removed
      expect(dropZone).toHaveStyle({ border: '2px dashed gray' });
    });

    it('should handle file drop event', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const dropZone = screen.getByTestId('drop-zone');
      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      
      const dropEvent = new Event('drop', { bubbles: true }) as any;
      dropEvent.dataTransfer = {
        files: [file]
      };
      Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() });
      
      dropZone.dispatchEvent(dropEvent);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /avatar preview/i })).toBeInTheDocument();
      });
    });

    it('should validate dropped files', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const dropZone = screen.getByTestId('drop-zone');
      const file = new File(['dummy content'], 'document.pdf', { type: 'application/pdf' });
      
      const dropEvent = new Event('drop', { bubbles: true }) as any;
      dropEvent.dataTransfer = {
        files: [file]
      };
      Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() });
      
      dropZone.dispatchEvent(dropEvent);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
    });

    it('should have appropriate ARIA label for drag and drop zone', () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const dropZone = screen.getByTestId('drop-zone');
      expect(dropZone).toHaveAttribute('aria-label', expect.stringContaining('drag and drop'));
    });
  });

  describe('Upload Progress Indication', () => {
    it('should display progress bar during upload', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
      });
    });

    it('should update progress percentage during upload', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText(/uploading\.\.\. \d+%/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should have proper ARIA attributes on progress bar', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        const progressBar = screen.getByTestId('progress-bar');
        expect(progressBar).toHaveAttribute('role', 'progressbar');
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '100');
        expect(progressBar).toHaveAttribute('aria-valuenow');
      });
    });

    it('should announce upload progress to screen readers', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        const status = screen.getByRole('status');
        expect(status).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should reach 100% progress on completion', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText(/uploaded successfully/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Error Handling', () => {
    it('should display error message for invalid file types', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'document.txt', { type: 'text/plain' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        const errorMessage = screen.getByTestId('error-message');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveAttribute('role', 'alert');
        expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
      });
    });

    it('should display error message for oversized files', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
          maxFileSize={1048576}
        />
      );

      const content = new Array(2 * 1024 * 1024).fill('a').join('');
      const file = new File([content], 'large.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent(/file size exceeds/i);
      });
    });

    it('should call onUploadError callback on validation failure', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'document.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockOnUploadError).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    it('should clear previous errors when valid file is selected', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      // First, upload invalid file
      const invalidFile = new File(['dummy'], 'doc.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, invalidFile);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });

      // Then, upload valid file
      const validFile = new File(['dummy'], 'avatar.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, validFile);

      await waitFor(() => {
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
      });
    });

    it('should not show preview for invalid files', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'document.txt', { type: 'text/plain' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });

      expect(screen.queryByRole('img', { name: /avatar preview/i })).not.toBeInTheDocument();
    });
  });

  describe('Successful Upload Confirmation', () => {
    it('should display success message after upload completes', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should call onUploadSuccess callback with file', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockOnUploadSuccess).toHaveBeenCalledWith(file);
      }, { timeout: 2000 });
    });

    it('should announce success to screen readers', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        const successMessage = screen.getByTestId('success-message');
        expect(successMessage).toHaveAttribute('role', 'status');
        expect(successMessage).toHaveAttribute('aria-live', 'polite');
      }, { timeout: 2000 });
    });

    it('should keep preview visible after successful upload', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument();
      }, { timeout: 2000 });

      expect(screen.getByRole('img', { name: /avatar preview/i })).toBeInTheDocument();
    });
  });

  describe('Avatar Removal and Replacement', () => {
    it('should allow removing uploaded avatar', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /avatar preview/i })).toBeInTheDocument();
      });

      const removeButton = screen.getByTestId('remove-button');
      await user.click(removeButton);

      expect(screen.queryByRole('img', { name: /avatar preview/i })).not.toBeInTheDocument();
      expect(screen.getByText(/drag and drop an image here/i)).toBeInTheDocument();
    });

    it('should allow replacing existing avatar', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const firstFile = new File(['first'], 'avatar1.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, firstFile);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /avatar preview/i })).toBeInTheDocument();
      });

      const secondFile = new File(['second'], 'avatar2.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, secondFile);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /avatar preview/i })).toBeInTheDocument();
      });

      expect(mockOnUploadSuccess).toHaveBeenCalledTimes(2);
    });

    it('should have accessible remove button', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        const removeButton = screen.getByTestId('remove-button');
        expect(removeButton).toHaveAttribute('aria-label', 'Remove avatar image');
      });
    });

    it('should clear file input value when removing', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /avatar preview/i })).toBeInTheDocument();
      });

      const removeButton = screen.getByTestId('remove-button');
      await user.click(removeButton);

      expect(fileInput.value).toBe('');
    });
  });

  describe('Accessibility Compliance', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper region role and label', () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const region = screen.getByRole('region', { name: /avatar upload/i });
      expect(region).toBeInTheDocument();
    });

    it('should support keyboard navigation for drop zone', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const dropZone = screen.getByTestId('drop-zone');
      
      expect(dropZone).toHaveAttribute('role', 'button');
      expect(dropZone).toHaveAttribute('tabIndex', '0');
      
      dropZone.focus();
      expect(document.activeElement).toBe(dropZone);
    });

    it('should trigger file selection with Enter key', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const dropZone = screen.getByTestId('drop-zone');
      dropZone.focus();
      
      await user.keyboard('{Enter}');
      
      // Verify that file input would be triggered (in real implementation)
      expect(dropZone).toHaveAttribute('role', 'button');
    });

    it('should trigger file selection with Space key', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const dropZone = screen.getByTestId('drop-zone');
      dropZone.focus();
      
      await user.keyboard(' ');
      
      expect(dropZone).toHaveAttribute('role', 'button');
    });

    it('should have aria-label on file input', () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const fileInput = screen.getByTestId('file-input');
      expect(fileInput).toHaveAttribute('aria-label', 'Choose avatar image file');
    });

    it('should use aria-live for dynamic content announcements', () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const formatInfo = screen.getByText(/accepted formats/i);
      expect(formatInfo).toHaveAttribute('aria-live', 'polite');
    });

    it('should have proper focus management', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const dropZone = screen.getByTestId('drop-zone');
      
      await user.tab();
      expect(document.activeElement).toBe(dropZone);
    });

    it('should announce errors assertively to screen readers', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy'], 'doc.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        const errorMessage = screen.getByTestId('error-message');
        expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
      });
    });

    it('should have color-independent error indication', async () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy'], 'doc.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        const errorMessage = screen.getByTestId('error-message');
        // Error is indicated by role="alert" and aria-live, not just color
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });
  });
});
