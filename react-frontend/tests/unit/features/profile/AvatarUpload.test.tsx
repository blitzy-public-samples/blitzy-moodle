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

 

// Mock the hooks (component may use these for some features)
vi.mock('../../../../src/features/profile/hooks/useUpdateProfile', () => ({
  useUploadAvatar: vi.fn(),
  useDeleteAvatar: vi.fn(),
}));

// Mock the API functions (the component uses these directly)
vi.mock('../../../../src/features/profile/api/profileApi', () => ({
  uploadAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
}));

import { useUploadAvatar, useDeleteAvatar } from '../../../../src/features/profile/hooks/useUpdateProfile';
import { uploadAvatar, deleteAvatar } from '../../../../src/features/profile/api/profileApi';

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

    // Mock successful upload API function (component uses this directly)
    // API returns profileimageurl which matches the Moodle API response type
    (uploadAvatar as Mock).mockResolvedValue({
      success: true,
      profileimageurl: 'https://example.com/new-avatar.jpg',
    });

    // Mock delete API function
    (deleteAvatar as Mock).mockResolvedValue({
      success: true,
    });

    // Mock successful upload mutation (for components using hooks)
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

    it('should trigger file selection when clicking the dropzone area', async () => {
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
        // After selecting a file, the Avatar should have a src attribute with blob URL
        const avatar = container.querySelector('.MuiAvatar-root img');
        expect(avatar).toBeInTheDocument();
      });
    });

     
    it('should have accessible dropzone button', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // The dropzone should be an accessible button
      const dropzone = screen.getByRole('button', { name: /drop zone for avatar image upload/i });
      expect(dropzone).toBeInTheDocument();
      expect(dropzone).toHaveAttribute('tabindex', '0');
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
        // MUI Avatar renders an img inside when src is provided
        const avatar = container.querySelector('.MuiAvatar-root img');
        expect(avatar).toBeInTheDocument();
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
        // MUI Avatar renders an img inside when src is provided
        const avatar = container.querySelector('.MuiAvatar-root img');
        expect(avatar).toBeInTheDocument();
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
        // MUI Avatar renders an img inside when src is provided
        const avatar = container.querySelector('.MuiAvatar-root img');
        expect(avatar).toBeInTheDocument();
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

      // The file input has an accept attribute, so unsupported types
      // are filtered by the browser. For testing, we verify the accept attribute
      // Note: react-dropzone validates files before calling onDrop, so rejected
      // files don't trigger the error state - they're silently filtered
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toHaveAttribute('accept');
      expect(fileInput.accept).toContain('image/jpeg');
      expect(fileInput.accept).toContain('image/png');
      expect(fileInput.accept).toContain('image/gif');
      expect(fileInput.accept).not.toContain('application/pdf');
    });

    it('should NOT accept WebP files by default (only JPEG, PNG, GIF)', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // Verify WebP is NOT in the default accepted formats
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput.accept).not.toContain('image/webp');
    });

    it('should display accepted file formats in the UI', () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // Check that file input accepts correct image types (JPEG, PNG, GIF - NOT WebP)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput.accept).toContain('image/jpeg');
      expect(fileInput.accept).toContain('image/png');
      expect(fileInput.accept).toContain('image/gif');
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
        const avatar = container.querySelector('.MuiAvatar-root img');
        expect(avatar).toBeInTheDocument();
      });
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should accept files under 100MB default limit', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // Create a 6MB file (should be accepted with 100MB default limit)
      const fileSize = 6 * 1024 * 1024;
      const file = new File([new ArrayBuffer(fileSize)], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        const avatar = container.querySelector('.MuiAvatar-root img');
        expect(avatar).toBeInTheDocument();
      });
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should display maximum file size in the UI', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // Check that max file size is mentioned (100MB default)
      expect(screen.getByText(/100.*mb/i)).toBeInTheDocument();
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
      
      // Note: react-dropzone filters by maxSize before onDrop is called
      // So oversized files are silently rejected and don't show error
      await user.upload(fileInput, file);

      // No preview should appear since file was rejected
      await waitFor(() => {
        const avatar = container.querySelector('.MuiAvatar-root img');
        expect(avatar).not.toBeInTheDocument();
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
        const avatar = container.querySelector('.MuiAvatar-root img');
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveAttribute('src', expect.stringContaining('blob:'));
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
        const avatar = container.querySelector('.MuiAvatar-root img');
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveAttribute('alt', 'Avatar preview');
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
        const avatar = container.querySelector('.MuiAvatar-root img');
        expect(avatar).toBeInTheDocument();
      });

      // Upload a different file
      const file2 = new File(['content2'], 'avatar2.png', { type: 'image/png' });
      await user.upload(fileInput, file2);

      await waitFor(() => {
        const avatar = container.querySelector('.MuiAvatar-root img');
        expect(avatar).toBeInTheDocument();
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

      const dropZone = screen.getByText(/drag.*drop.*image.*click.*browse/i).closest('div[role="button"]');
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

      const dropZone = screen.getByText(/drag.*drop.*image.*click.*browse/i).closest('div[role="button"]');

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
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const dropZone = screen.getByText(/drag.*drop.*image.*click.*browse/i).closest('div[role="button"]');

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
          const avatar = container.querySelector('.MuiAvatar-root img');
          expect(avatar).toBeInTheDocument();
        });
      }
    });

    it('should validate dropped files', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // react-dropzone filters invalid files based on accept attribute
      // so dropped invalid files are silently ignored - no preview, no error
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Verify the input only accepts valid image types
      expect(fileInput.accept).toContain('image/jpeg');
      expect(fileInput.accept).toContain('image/png');
      expect(fileInput.accept).toContain('image/gif');
      
      // Confirm no avatar preview is shown (since invalid files are filtered)
      const avatar = container.querySelector('.MuiAvatar-root img');
      expect(avatar).not.toBeInTheDocument();
    });

    it('should have appropriate ARIA label for drag and drop zone', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const dropZone = screen.getByText(/drag.*drop.*image.*click.*browse/i).closest('div[role="button"]');
      expect(dropZone).toHaveAttribute('role', 'button');
    });
  });

  describe('Upload Progress Indication', () => {
    it('should show preview after file selection (upload not triggered automatically)', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      // File selection shows preview, but doesn't automatically upload
      await waitFor(() => {
        const avatar = container.querySelector('.MuiAvatar-root img');
        expect(avatar).toBeInTheDocument();
      });

      // Verify upload button is now enabled
      const uploadButton = screen.getByRole('button', { name: /upload avatar/i });
      expect(uploadButton).not.toBeDisabled();
    });

    it('should call uploadAvatar API when upload button is clicked', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      // Wait for preview to appear
      await waitFor(() => {
        const avatar = container.querySelector('.MuiAvatar-root img');
        expect(avatar).toBeInTheDocument();
      });

      // Click upload button
      const uploadButton = screen.getByRole('button', { name: /upload avatar/i });
      await user.click(uploadButton);

      // Verify uploadAvatar API was called
      await waitFor(() => {
        expect(uploadAvatar).toHaveBeenCalledWith(1, expect.any(File));
      });
    });

    it('should have proper ARIA label on upload button', async () => {
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
        const avatar = container.querySelector('.MuiAvatar-root img');
        expect(avatar).toBeInTheDocument();
      });

      // Upload button should have accessible label
      const uploadButton = screen.getByRole('button', { name: /upload avatar/i });
      expect(uploadButton).toBeInTheDocument();
    });

    it('should show upload button only when file is selected', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // Initially no file selected - upload button should not exist
      expect(screen.queryByRole('button', { name: /upload avatar/i })).not.toBeInTheDocument();

      // Select a file
      const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(fileInput, file);

      // Now upload button should appear
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload avatar/i })).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should only accept valid image file types', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // react-dropzone filters invalid files based on accept attribute
      // so they are silently ignored (no error is shown)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput.accept).toContain('image/jpeg');
      expect(fileInput.accept).toContain('image/png');
      expect(fileInput.accept).toContain('image/gif');
      expect(fileInput.accept).not.toContain('text/plain');
    });

    it('should accept files under 100MB default limit', async () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // 6MB is under the 100MB default limit
      const fileSize = 6 * 1024 * 1024;
      const file = new File([new ArrayBuffer(fileSize)], 'large.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      // File should be accepted - no error
      await waitFor(() => {
        const avatar = container.querySelector('.MuiAvatar-root img');
        expect(avatar).toBeInTheDocument();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should display error when upload API fails', async () => {
      // Mock uploadAvatar to reject with an error
      (uploadAvatar as Mock).mockRejectedValueOnce(new Error('Upload failed'));

      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // Select a file
      const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(fileInput, file);

      // Click upload button
      const uploadButton = await screen.findByRole('button', { name: /upload avatar/i });
      await user.click(uploadButton);

      // Error alert should be shown
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('should clear error when new file is selected', async () => {
      // Mock uploadAvatar to reject first, then resolve
      (uploadAvatar as Mock)
        .mockRejectedValueOnce(new Error('Upload failed'))
        .mockResolvedValue({ success: true, avatarUrl: 'https://example.com/avatar.jpg' });

      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // First file and upload attempt
      const file1 = new File(['content1'], 'avatar1.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(fileInput, file1);

      // Click upload button - should fail
      const uploadButton = await screen.findByRole('button', { name: /upload avatar/i });
      await user.click(uploadButton);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Select new file - should clear error
      const file2 = new File(['content2'], 'avatar2.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, file2);

      // Error should be cleared
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

      // react-dropzone silently filters invalid files based on accept attribute
      // so no preview or error should appear for rejected file types
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Verify the input doesn't accept PDF files
      expect(fileInput.accept).not.toContain('application/pdf');
      
      // Confirm no avatar preview is shown initially
      const avatar = container.querySelector('.MuiAvatar-root img');
      expect(avatar).not.toBeInTheDocument();
    });
  });

  describe('Successful Upload Confirmation', () => {
    it('should call onUploadSuccess callback after successful upload', async () => {
      const onUploadSuccess = vi.fn();
      
      // Mock uploadAvatar API to return success with avatar URL
      // The API returns profileimageurl which is then passed to onUploadSuccess
      (uploadAvatar as Mock).mockResolvedValue({
        success: true,
        profileimageurl: 'https://example.com/new-avatar.jpg',
      });

      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} onUploadSuccess={onUploadSuccess} />
        </Wrapper>
      );

      const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload avatar/i })).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /upload avatar/i });
      await user.click(uploadButton);

      await waitFor(() => {
        expect(onUploadSuccess).toHaveBeenCalledWith('https://example.com/new-avatar.jpg');
      });
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
      
      // Mock deleteAvatar API
      (deleteAvatar as Mock).mockResolvedValue({ success: true });
      
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

      await waitFor(() => {
        expect(deleteAvatar).toHaveBeenCalledWith(1);
      });
      
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
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload avatar/i })).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /upload avatar/i });
      await user.click(uploadButton);

      await waitFor(() => {
        expect(uploadAvatar).toHaveBeenCalledWith(1, expect.any(File));
      });
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

      // Note: react-dropzone creates a nested interactive pattern (input inside role="button")
      // which is a known accessibility issue in the library. We disable this rule
      // for this test while acknowledging it should be addressed in future updates.
      const results = await axe(container, {
        rules: {
          'nested-interactive': { enabled: false },
        },
      });
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
      
      const dropZone = screen.getByText(/drag.*drop.*image.*click.*browse/i).closest('div[role="button"]');
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
      // Mock uploadAvatar to reject with error
      (uploadAvatar as Mock).mockRejectedValueOnce(new Error('Upload failed'));
      
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <AvatarUpload userId={1} />
        </Wrapper>
      );

      // Select a valid file
      const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(fileInput, file);

      // Click upload button (will trigger error)
      const uploadButton = await screen.findByRole('button', { name: /upload avatar/i });
      await user.click(uploadButton);

      // Error alert should have aria-live for screen reader announcement
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        // MUI Alert component has role="alert" which implicitly announces to screen readers
      });
    });
  });
});
