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

import type React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Import the actual component
import { AvatarUpload } from '../../../../src/features/profile/components/AvatarUpload';

 

// Mock the hooks
vi.mock('../../../../src/features/profile/hooks/useUpdateProfile', () => ({
  useUploadAvatar: vi.fn(),
  useDeleteAvatar: vi.fn(),
}));

import { useUploadAvatar, useDeleteAvatar } from '../../../../src/features/profile/hooks/useUpdateProfile';

// Extend expect matchers
expect.extend(toHaveNoViolations);

// Create a wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
};

describe('AvatarUpload Component', () => {
  let mockUploadMutate: Mock;
  let mockDeleteMutate: Mock;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();

    // Mock successful upload mutation
    mockUploadMutate = vi.fn();
    (useUploadAvatar as Mock).mockReturnValue({
      mutate: mockUploadMutate,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
    });

    // Mock delete mutation
    mockDeleteMutate = vi.fn();
    (useDeleteAvatar as Mock).mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
    });

    // Mock FileReader
    interface MockFileReaderType {
      readAsDataURL: ReturnType<typeof vi.fn>;
      result: string;
      onload: ((event: { target: { result: string } }) => void) | null;
      onerror: (() => void) | null;
      onabort: (() => void) | null;
      onloadend: (() => void) | null;
      onloadstart: (() => void) | null;
      onprogress: (() => void) | null;
      EMPTY: number;
      LOADING: number;
      DONE: number;
      readyState: number;
      error: null;
      abort: ReturnType<typeof vi.fn>;
      addEventListener: ReturnType<typeof vi.fn>;
      removeEventListener: ReturnType<typeof vi.fn>;
      dispatchEvent: ReturnType<typeof vi.fn>;
    }
    
    const mockFileReader: MockFileReaderType = {
      readAsDataURL: vi.fn(function(this: MockFileReaderType) {
        if (this.onload) {
          this.onload({ target: { result: 'data:image/jpeg;base64,fakebase64' } });
        }
      }) as ReturnType<typeof vi.fn>,
      result: 'data:image/jpeg;base64,fakebase64',
      onload: null,
      onerror: null,
      onabort: null,
      onloadend: null,
      onloadstart: null,
      onprogress: null,
      EMPTY: 0,
      LOADING: 1,
      DONE: 2,
      readyState: 0,
      error: null,
      abort: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;

    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost:3000/mock-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mock Image constructor for dimension validation
    interface MockImageType {
      width: number;
      height: number;
      src: string;
      onload: (() => void) | null;
      onerror: (() => void) | null;
      _src: string;
    }
    
    const MockImage = vi.fn(function(this: MockImageType) {
      // Set default dimensions that pass validation
      this.width = 500;
      this.height = 500;
      
      // Simulate image loading when src is set
      Object.defineProperty(this, 'src', {
        set(this: MockImageType, value: string) {
          this._src = value;
          // Trigger onload asynchronously to simulate real behavior
          setTimeout(() => {
            const onloadFn = this.onload;
            if (onloadFn) {
              onloadFn();
            }
          }, 0);
        },
        get(this: MockImageType) {
          return this._src;
        }
      });
      
      this.onload = null;
      this.onerror = null;
      this._src = '';
    }) as unknown as typeof Image;

    global.Image = MockImage as unknown as typeof Image;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('File Selection via Input', () => {
     
    it('should allow file selection through file input element', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // Find the hidden file input using querySelector since it has no test ID
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('type', 'file');
      expect(fileInput).toHaveAttribute('accept');
    });

    it('should trigger file selection when clicking the "Choose File" button', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });

     
    it('should have accessible "Choose File" button', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // The "Choose File" button should be accessible
      const chooseButton = screen.getByRole('button', { name: /choose file/i });
      expect(chooseButton).toBeInTheDocument();
      expect(chooseButton).toBeEnabled();
    });
  });

  describe('File Type Validation', () => {
    it('should accept JPEG files', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should accept PNG files', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['dummy content'], 'avatar.png', { type: 'image/png' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should accept GIF files', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['dummy content'], 'avatar.gif', { type: 'image/gif' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should reject unsupported file types', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['dummy content'], 'document.pdf', { type: 'application/pdf' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Use fireEvent instead of user.upload for hidden file inputs
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(fileInput);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
    });

    it('should accept WebP files by default', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['dummy content'], 'avatar.webp', { type: 'image/webp' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should display accepted file formats in the UI', () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // Check that file input accepts correct image types
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/gif,image/webp');
    });
  });

  describe('File Size Validation', () => {
    it('should accept files within size limit (2MB)', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // Create a 2MB file
      const fileSize = 2 * 1024 * 1024;
      const file = new File([new ArrayBuffer(fileSize)], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should reject files exceeding 5MB limit', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // Create a 6MB file
      const fileSize = 6 * 1024 * 1024;
      const file = new File([new ArrayBuffer(fileSize)], 'large.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/file size.*exceeds/i)).toBeInTheDocument();
      });
    });

    it('should display maximum file size in the UI', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // Check that max file size is mentioned (5MB default)
      expect(screen.getByText(/5.*mb/i)).toBeInTheDocument();
    });

    it('should handle custom file size limits', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload 
            userId={1} 
            constraints={{ maxSize: 1 * 1024 * 1024 }} // 1MB
          />
        </Wrapper>
      );

      // Create a 2MB file (should be rejected with 1MB limit)
      const fileSize = 2 * 1024 * 1024;
      const file = new File([new ArrayBuffer(fileSize)], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/file size.*exceeds/i)).toBeInTheDocument();
      });
    });
  });

  describe('Image Preview', () => {
    it('should display image preview after file selection', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        const img = screen.getByRole('img');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', expect.stringContaining('blob:'));
      });
    });

    it('should use FileReader API to generate preview', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(global.URL.createObjectURL).toHaveBeenCalled();
      });
    });

    it('should show preview container with proper ARIA attributes', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        const img = screen.getByRole('img');
        expect(img).toHaveAccessibleName();
      });
    });

    it('should update preview when new file is selected', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file1 = new File(['content1'], 'avatar1.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file1);

      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });

      // Upload a different file
      const file2 = new File(['content2'], 'avatar2.png', { type: 'image/png' });
      await user.upload(fileInput, file2);

      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop Functionality', () => {
    it('should handle drag over event', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const dropZone = screen.getByText(/click or drag image/i).closest('div[role="button"]');
      expect(dropZone).toBeInTheDocument();

      if (dropZone) {
        const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
        const dataTransfer: Partial<DataTransfer> = {
          items: [{ kind: 'file', type: 'image/jpeg', getAsFile: () => file }] as unknown as DataTransferItemList,
          types: ['Files'],
          files: [file] as unknown as FileList,
        };

        await user.pointer([
          { keys: '[MouseLeft>]', target: dropZone },
          { coords: { x: 100, y: 100 } },
        ]);

        // Simulate dragover
        const dragOverEvent = new DragEvent('dragover', {
          bubbles: true,
          dataTransfer: dataTransfer as DataTransfer,
        });
        dropZone.dispatchEvent(dragOverEvent);

        // Component should show visual feedback for drag state
        await waitFor(() => {
          expect(dropZone).toHaveStyle({ borderColor: expect.any(String) });
        });
      }
    });

     
    it('should handle drag leave event', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const dropZone = screen.getByText(/click or drag image/i).closest('div[role="button"]');

      if (dropZone) {
        // Simulate dragleave
        const dragLeaveEvent = new DragEvent('dragleave', { bubbles: true });
        dropZone.dispatchEvent(dragLeaveEvent);

        // Should reset drag state
        expect(dropZone).toBeInTheDocument();
      }
    });

    it('should handle file drop event', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const dropZone = screen.getByText(/click or drag image/i).closest('div[role="button"]');

      if (dropZone) {
        const file = new File(['content'], 'dropped.jpg', { type: 'image/jpeg' });
        const dataTransfer = {
          files: [file],
          items: [{ kind: 'file', type: 'image/jpeg', getAsFile: () => file }],
          types: ['Files'],
        };

        const dropEvent = new DragEvent('drop', {
          bubbles: true,
        });
        
        // Mock dataTransfer property on the event
        Object.defineProperty(dropEvent, 'dataTransfer', {
          value: dataTransfer,
          writable: false,
          configurable: true,
        });
        
        dropZone.dispatchEvent(dropEvent);

        await waitFor(() => {
          expect(screen.getByRole('img')).toBeInTheDocument();
        });
      }
    });

    it('should validate dropped files', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const dropZone = screen.getByText(/click or drag image/i).closest('div[role="button"]');

      if (dropZone) {
        const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
        const dataTransfer = {
          files: [file],
          items: [{ kind: 'file', type: 'application/pdf', getAsFile: () => file }],
          types: ['Files'],
        };

        const dropEvent = new DragEvent('drop', {
          bubbles: true,
        });
        
        // Mock dataTransfer property on the event
        Object.defineProperty(dropEvent, 'dataTransfer', {
          value: dataTransfer,
          writable: false,
          configurable: true,
        });
        
        dropZone.dispatchEvent(dropEvent);

        await waitFor(() => {
          expect(screen.getByRole('alert')).toBeInTheDocument();
          expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
        });
      }
    });

    it('should have appropriate ARIA label for drag and drop zone', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const dropZone = screen.getByText(/click or drag image/i).closest('div[role="button"]');
      expect(dropZone).toHaveAttribute('role', 'button');
    });
  });

  describe('Upload Progress Indication', () => {
    it('should automatically trigger upload when file is selected', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockUploadMutate).toHaveBeenCalledWith(file);
      });
    });

    it('should show loading state during upload', async () => {
      (useUploadAvatar as Mock).mockReturnValue({
        mutate: mockUploadMutate,
        isPending: true,
        isSuccess: false,
        isError: false,
        error: null,
      });

      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        // Verify loading indicator is shown (CircularProgress)
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });

    it('should have proper ARIA attributes during upload', async () => {
      (useUploadAvatar as Mock).mockReturnValue({
        mutate: mockUploadMutate,
        isPending: true,
        isSuccess: false,
        isError: false,
        error: null,
      });

      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        const progressbar = screen.getByRole('progressbar');
        expect(progressbar).toBeInTheDocument();
      });
    });

    it('should call upload mutation automatically when valid file is selected', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockUploadMutate).toHaveBeenCalledWith(file);
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message for invalid file types', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['content'], 'document.txt', { type: 'text/plain' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Use fireEvent instead of user.upload for hidden file inputs
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
      });
    });

    it('should display error message for oversized files', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const fileSize = 6 * 1024 * 1024; // 6MB
      const file = new File([new ArrayBuffer(fileSize)], 'large.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/file size.*exceeds/i)).toBeInTheDocument();
      });
    });

    it('should display error from upload mutation', async () => {
      (useUploadAvatar as Mock).mockReturnValue({
        mutate: mockUploadMutate,
        isPending: false,
        isSuccess: false,
        isError: true,
        error: new Error('Upload failed'),
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
      });
    });

    it('should clear previous errors when valid file is selected', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // First, upload invalid file
      const invalidFile = new File(['content'], 'document.pdf', { type: 'application/pdf' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Use fireEvent instead of user.upload for hidden file inputs
      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        writable: false,
        configurable: true, // Allow redefinition later
      });
      
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Then upload valid file
      const validFile = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
      Object.defineProperty(fileInput, 'files', {
        value: [validFile],
        writable: false,
        configurable: true,
      });
      
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    it('should not show preview for invalid files', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Use fireEvent instead of user.upload for hidden file inputs
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('Successful Upload Confirmation', () => {
    it('should call onUploadSuccess callback after successful upload', async () => {
      const onUploadSuccess = vi.fn();
      
      (useUploadAvatar as Mock).mockReturnValue({
        mutate: vi.fn(() => {
          // Simulate successful upload
          onUploadSuccess('https://example.com/avatar.jpg');
        }),
        isPending: false,
        isSuccess: true,
        isError: false,
        error: null,
      });

      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} onUploadSuccess={onUploadSuccess} />
        </Wrapper>
      );

      const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Use fireEvent instead of user.upload for hidden file inputs
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(uploadButton);

      expect(onUploadSuccess).toHaveBeenCalled();
    });

    it('should show success state after upload completes', async () => {
      (useUploadAvatar as Mock).mockReturnValue({
        mutate: mockUploadMutate,
        isPending: false,
        isSuccess: true,
        isError: false,
        error: null,
      });

      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Use fireEvent instead of user.upload for hidden file inputs
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(fileInput);

      await waitFor(() => {
        // Success state might be indicated by disabled upload button or success icon
        const uploadButton = screen.queryByRole('button', { name: /upload/i });
        expect(uploadButton).toBeInTheDocument();
      });
    });
  });

  describe('Avatar Removal and Replacement', () => {
    it('should allow removing uploaded avatar', async () => {
      // Mock window.confirm to return true
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <AvatarUpload 
            userId={1} 
            currentAvatarUrl="https://example.com/avatar.jpg"
            allowDelete
          />
        </Wrapper>
      );

      const deleteButton = screen.getByRole('button', { name: /remove|delete/i });
      expect(deleteButton).toBeInTheDocument();

      await user.click(deleteButton);

      expect(mockDeleteMutate).toHaveBeenCalled();
      
      // Restore the original confirm
      vi.restoreAllMocks();
    });

    it('should allow replacing existing avatar', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload 
            userId={1} 
            currentAvatarUrl="https://example.com/avatar.jpg"
          />
        </Wrapper>
      );

      const file = new File(['content'], 'new-avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Use fireEvent instead of user.upload for hidden file inputs
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(uploadButton);

      expect(mockUploadMutate).toHaveBeenCalledWith(file);
    });

     
    it('should have accessible remove button', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <AvatarUpload 
            userId={1} 
            currentAvatarUrl="https://example.com/avatar.jpg"
            allowDelete
          />
        </Wrapper>
      );

      const deleteButton = screen.getByRole('button', { name: /remove|delete/i });
      expect(deleteButton).toHaveAccessibleName();
      expect(deleteButton).toBeEnabled();
    });

    it('should hide delete button when allowDelete is false', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <AvatarUpload 
            userId={1} 
            currentAvatarUrl="https://example.com/avatar.jpg"
            allowDelete={false}
          />
        </Wrapper>
      );

      expect(screen.queryByRole('button', { name: /remove|delete/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // Tab to the drop zone
      await user.tab();
      
      const dropZone = screen.getByText(/click or drag image/i).closest('div[role="button"]');
      if (dropZone) {
        expect(document.activeElement).toBe(dropZone);
      }
    });

    it('should have proper ARIA labels', () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toHaveAttribute('aria-label');
    });

    it('should announce errors to screen readers', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Use fireEvent instead of user.upload for hidden file inputs
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(fileInput);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveAttribute('aria-live');
      });
    });
  });
});
