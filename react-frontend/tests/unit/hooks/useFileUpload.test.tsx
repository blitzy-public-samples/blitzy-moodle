/**
 * Unit tests for useFileUpload hook
 *
 * Comprehensive test suite validating file upload functionality including:
 * - File validation (size and MIME type constraints)
 * - Upload state transitions (idle → uploading → success/error)
 * - Progress tracking with real-time updates
 * - Upload cancellation and cleanup
 * - Success and error callback execution
 * - Toast notification integration
 * - FormData construction and axios configuration
 * - Multiple sequential uploads
 * - Custom axios options merging
 *
 * Tests simulate Moodle assignment submission patterns and profile avatar uploads,
 * ensuring robust file handling across all use cases.
 *
 * @module tests/unit/hooks/useFileUpload
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import type { AxiosResponse, CancelTokenSource } from 'axios';
import useFileUpload from '@/hooks/useFileUpload';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// MOCKS
// ============================================================================

// Mock axios module
vi.mock('axios', () => {
  const mockCancelToken = {
    source: vi.fn(() => ({
      token: 'mock-cancel-token',
      cancel: vi.fn(),
    })),
  };

  const isCancelImpl = vi.fn((err: unknown) => {
    return err && typeof err === 'object' && 'message' in err && err.message === 'Upload cancelled by user';
  });

  const isAxiosErrorImpl = vi.fn((err: unknown) => {
    return err && typeof err === 'object' && 'response' in err;
  });

  return {
    default: {
      post: vi.fn(),
      CancelToken: mockCancelToken,
      isCancel: isCancelImpl,
      isAxiosError: isAxiosErrorImpl,
    },
    isCancel: isCancelImpl,
    isAxiosError: isAxiosErrorImpl,
    CancelToken: mockCancelToken,
  };
});

// Mock useToast hook
vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  })),
}));

// ============================================================================
// TEST SUITE
// ============================================================================

describe('useFileUpload', () => {
  // Mock functions
  let mockAxiosPost: ReturnType<typeof vi.fn<[string, FormData, Record<string, unknown>?], Promise<AxiosResponse>>>;
  let mockCancelTokenSource: CancelTokenSource;
  let mockSuccess: ReturnType<typeof vi.fn>;
  let mockError: ReturnType<typeof vi.fn>;

  // Test file objects
  let validImageFile: File;
  let validPdfFile: File;
  let oversizedFile: File;
  let invalidTypeFile: File;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup axios mock
    mockAxiosPost = vi.fn();
    (axios.post as unknown) = mockAxiosPost;

    // Setup cancel token mock
    mockCancelTokenSource = {
      token: 'mock-cancel-token' as unknown as CancelTokenSource['token'],
      cancel: vi.fn(),
    };
    (axios.CancelToken.source as ReturnType<typeof vi.fn>).mockReturnValue(mockCancelTokenSource);

    // Setup toast mocks
    mockSuccess = vi.fn();
    mockError = vi.fn();
    (useToast as ReturnType<typeof vi.fn>).mockReturnValue({
      success: mockSuccess,
      error: mockError,
      warning: vi.fn(),
      info: vi.fn(),
    });

    // Create test files
    validImageFile = new File(['x'.repeat(1024 * 1024)], 'test.jpg', { type: 'image/jpeg' }); // 1MB
    validPdfFile = new File(['x'.repeat(2 * 1024 * 1024)], 'test.pdf', { type: 'application/pdf' }); // 2MB
    oversizedFile = new File(['x'.repeat(200 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' }); // 200MB
    invalidTypeFile = new File(['content'], 'test.exe', { type: 'application/x-msdownload' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // INITIALIZATION TESTS
  // ==========================================================================

  it('should initialize with idle state', () => {
    const { result } = renderHook(() => useFileUpload());

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.progress).toBe(0);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.file).toBeNull();
  });

  // ==========================================================================
  // FILE VALIDATION TESTS
  // ==========================================================================

  it('should validate file size before upload', async () => {
    const { result } = renderHook(() =>
      useFileUpload({
        maxSize: 10 * 1024 * 1024, // 10MB limit
      })
    );

    await act(async () => {
      await result.current.uploadFile(oversizedFile, '/api/v1/files/upload');
    });

    // Should set error state
    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toContain('exceeds maximum allowed size');

    // Should not make API call
    expect(mockAxiosPost).not.toHaveBeenCalled();

    // Should show error toast
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('exceeds maximum allowed size'));
  });

  it('should validate file type before upload', async () => {
    const { result } = renderHook(() =>
      useFileUpload({
        allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
      })
    );

    await act(async () => {
      await result.current.uploadFile(invalidTypeFile, '/api/v1/files/upload');
    });

    // Should set error state
    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toContain('is not allowed');

    // Should not make API call
    expect(mockAxiosPost).not.toHaveBeenCalled();

    // Should show error toast
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('is not allowed'));
  });

  it('should not upload if validation fails', async () => {
    const { result } = renderHook(() =>
      useFileUpload({
        maxSize: 1024 * 1024, // 1MB
        allowedTypes: ['image/png'],
      })
    );

    // Try to upload file that fails both validations (size and type)
    await act(async () => {
      await result.current.uploadFile(oversizedFile, '/api/v1/files/upload');
    });

    // Should be in error state
    expect(result.current.state.status).toBe('error');

    // Should not call axios
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // SUCCESSFUL UPLOAD TESTS
  // ==========================================================================

  it('should upload file successfully', async () => {
    const mockResponse: AxiosResponse = {
      data: { success: true, fileId: 123 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    };

    mockAxiosPost.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.uploadFile(validImageFile, '/api/v1/files/upload');
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });

    // Verify axios was called correctly
    expect(mockAxiosPost).toHaveBeenCalledWith(
      '/api/v1/files/upload',
      expect.any(FormData),
      expect.objectContaining({
        cancelToken: 'mock-cancel-token',
        onUploadProgress: expect.any(Function) as unknown as () => void,
        headers: expect.objectContaining({
          'Content-Type': 'multipart/form-data',
        }) as unknown as Record<string, string>,
      })
    );

    // Verify final state
    expect(result.current.state.status).toBe('success');
    expect(result.current.state.progress).toBe(100);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.file).toBe(validImageFile);

    // Verify success toast was shown
    expect(mockSuccess).toHaveBeenCalledWith(`File "${validImageFile.name}" uploaded successfully`);
  });

  it('should call onSuccess callback after successful upload', async () => {
    const mockResponse: AxiosResponse = {
      data: { success: true, fileId: 456 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    };

    mockAxiosPost.mockResolvedValue(mockResponse);

    const mockOnSuccess = vi.fn();

    const { result } = renderHook(() =>
      useFileUpload({
        onSuccess: mockOnSuccess,
      })
    );

    await act(async () => {
      await result.current.uploadFile(validPdfFile, '/api/v1/assignments/123/submit');
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });

    // Verify onSuccess callback was called with response
    expect(mockOnSuccess).toHaveBeenCalledWith(mockResponse);
    expect(mockOnSuccess).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // ERROR HANDLING TESTS
  // ==========================================================================

  it('should handle upload error', async () => {
    const mockErrorResponse = {
      response: {
        data: { error: 'Upload failed' },
        status: 500,
      },
      message: 'Upload failed',
    };

    mockAxiosPost.mockRejectedValue(mockErrorResponse);

    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.uploadFile(validImageFile, '/api/v1/files/upload');
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });

    // Verify error state
    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toBe('Upload failed');
    expect(result.current.state.progress).toBe(0);
    expect(result.current.state.file).toBeNull();

    // Verify error toast was shown
    expect(mockError).toHaveBeenCalledWith('Upload failed: Upload failed');
  });

  it('should call onError callback after upload failure', async () => {
    const mockErrorObj = new Error('Network error');
    mockAxiosPost.mockRejectedValue(mockErrorObj);

    const mockOnError = vi.fn();

    const { result } = renderHook(() =>
      useFileUpload({
        onError: mockOnError,
      })
    );

    await act(async () => {
      await result.current.uploadFile(validImageFile, '/api/v1/files/upload');
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });

    // Verify onError callback was called
    expect(mockOnError).toHaveBeenCalledWith(mockErrorObj);
    expect(mockOnError).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // PROGRESS TRACKING TESTS
  // ==========================================================================

  it('should update progress during upload', async () => {
    let capturedProgressCallback: ((event: { loaded: number; total: number }) => void) | null = null;

    // Mock axios to capture progress callback
    mockAxiosPost.mockImplementation((_url, _data, config?: Record<string, unknown>) => {
      capturedProgressCallback = (config?.onUploadProgress as ((event: { loaded: number; total: number }) => void)) ?? null;
      // Return a promise that never resolves (we'll manually trigger progress)
      return new Promise(() => {
        // Never resolves - we control progress manually
      });
    });

    const { result } = renderHook(() => useFileUpload());

    // Start upload
    act(() => {
      void result.current.uploadFile(validImageFile, '/api/v1/files/upload');
    });

    // Wait for uploading state
    await waitFor(() => {
      expect(result.current.state.status).toBe('uploading');
    });

    // Simulate progress updates
    act(() => {
      if (capturedProgressCallback) {
        capturedProgressCallback({ loaded: 25, total: 100 });
      }
    });

    expect(result.current.state.progress).toBe(25);

    act(() => {
      if (capturedProgressCallback) {
        capturedProgressCallback({ loaded: 50, total: 100 });
      }
    });

    expect(result.current.state.progress).toBe(50);

    act(() => {
      if (capturedProgressCallback) {
        capturedProgressCallback({ loaded: 100, total: 100 });
      }
    });

    expect(result.current.state.progress).toBe(100);
  });

  // ==========================================================================
  // FORMDATA TESTS
  // ==========================================================================

  it('should create FormData with file', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    });

    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.uploadFile(validImageFile, '/api/v1/files/upload');
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });

    // Verify FormData was passed to axios
    const callArgs = mockAxiosPost.mock.calls[0]!;
    const formData = callArgs[1];

    expect(formData).toBeInstanceOf(FormData);
  });

  // ==========================================================================
  // CANCELLATION TESTS
  // ==========================================================================

  it('should cancel upload when cancelUpload is called', async () => {
    // Mock a long-running upload
    mockAxiosPost.mockImplementation(() => {
      return new Promise(() => {
        // Never resolves naturally
      });
    });

    const { result } = renderHook(() => useFileUpload());

    // Start upload
    act(() => {
      void result.current.uploadFile(validImageFile, '/api/v1/files/upload');
    });

    // Wait for uploading state
    await waitFor(() => {
      expect(result.current.state.status).toBe('uploading');
    });

    // Cancel upload
    act(() => {
      result.current.cancelUpload();
    });

    // Verify cancel was called
    expect(mockCancelTokenSource.cancel).toHaveBeenCalledWith('Upload cancelled by user');

    // Verify state was reset to idle
    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.progress).toBe(0);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.file).toBeNull();

    // Verify error toast was shown for cancellation
    expect(mockError).toHaveBeenCalledWith('Upload cancelled');
  });

  // ==========================================================================
  // RESET TESTS
  // ==========================================================================

  it('should reset state with reset function', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    });

    const { result } = renderHook(() => useFileUpload());

    // Upload file
    await act(async () => {
      await result.current.uploadFile(validImageFile, '/api/v1/files/upload');
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });

    // Reset state
    act(() => {
      result.current.reset();
    });

    // Verify state was reset
    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.progress).toBe(0);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.file).toBeNull();
  });

  // ==========================================================================
  // SEQUENTIAL UPLOADS TESTS
  // ==========================================================================

  it('should handle multiple file uploads sequentially', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    });

    const { result } = renderHook(() => useFileUpload());

    // Upload first file
    await act(async () => {
      await result.current.uploadFile(validImageFile, '/api/v1/files/upload');
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });

    expect(result.current.state.file).toBe(validImageFile);

    // Reset
    act(() => {
      result.current.reset();
    });

    // Upload second file
    await act(async () => {
      await result.current.uploadFile(validPdfFile, '/api/v1/files/upload');
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });

    expect(result.current.state.file).toBe(validPdfFile);

    // Verify both uploads were made
    expect(mockAxiosPost).toHaveBeenCalledTimes(2);
  });

  // ==========================================================================
  // CUSTOM AXIOS OPTIONS TESTS
  // ==========================================================================

  it('should pass additional axios config options', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    });

    const { result } = renderHook(() => useFileUpload());

    const customOptions = {
      headers: {
        'X-Custom-Header': 'custom-value',
      },
      timeout: 30000,
    };

    await act(async () => {
      await result.current.uploadFile(validImageFile, '/api/v1/files/upload', customOptions);
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });

    // Verify custom options were merged
    expect(mockAxiosPost).toHaveBeenCalledWith(
      '/api/v1/files/upload',
      expect.any(FormData),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Custom-Header': 'custom-value',
          'Content-Type': 'multipart/form-data',
        }) as unknown as Record<string, string>,
        timeout: 30000,
      })
    );
  });

  // ==========================================================================
  // CALLBACK VALIDATION TESTS
  // ==========================================================================

  it('should call onError callback with validation error', async () => {
    const mockOnError = vi.fn();

    const { result } = renderHook(() =>
      useFileUpload({
        maxSize: 1024 * 1024, // 1MB
        onError: mockOnError,
      })
    );

    await act(async () => {
      await result.current.uploadFile(oversizedFile, '/api/v1/files/upload');
    });

    // Verify onError was called with validation error
    expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
     
    expect(mockOnError.mock.calls[0][0].message).toContain('exceeds maximum allowed size');
  });

  // ==========================================================================
  // TOAST NOTIFICATION TESTS
  // ==========================================================================

  it('should show toast notifications for upload status', async () => {
    // Test success notification
    mockAxiosPost.mockResolvedValue({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    });

    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.uploadFile(validImageFile, '/api/v1/files/upload');
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });

    expect(mockSuccess).toHaveBeenCalledWith(`File "${validImageFile.name}" uploaded successfully`);

    // Test error notification
    mockAxiosPost.mockRejectedValue(new Error('Upload failed'));

    await act(async () => {
      await result.current.uploadFile(validPdfFile, '/api/v1/files/upload');
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });

    expect(mockError).toHaveBeenCalledWith('Upload failed: Upload failed');
  });

  // ==========================================================================
  // EDGE CASES AND BOUNDARY CONDITIONS
  // ==========================================================================

  it('should handle file with wildcard MIME type validation', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    });

    const { result } = renderHook(() =>
      useFileUpload({
        allowedTypes: ['image/*'], // Wildcard for all image types
      })
    );

    await act(async () => {
      await result.current.uploadFile(validImageFile, '/api/v1/files/upload');
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });

    // Should successfully upload image file with wildcard match
    expect(mockAxiosPost).toHaveBeenCalled();
  });

  it('should handle progress with zero total bytes', async () => {
    let capturedProgressCallback: ((event: { loaded: number; total?: number }) => void) | null = null;

    mockAxiosPost.mockImplementation((_url, _data, config?: Record<string, unknown>) => {
      capturedProgressCallback = (config?.onUploadProgress as ((event: { loaded: number; total?: number }) => void)) ?? null;
      return new Promise(() => {
        // Never resolves
      });
    });

    const { result } = renderHook(() => useFileUpload());

    act(() => {
      void result.current.uploadFile(validImageFile, '/api/v1/files/upload');
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('uploading');
    });

    // Simulate progress event with zero or undefined total
    act(() => {
      if (capturedProgressCallback) {
        capturedProgressCallback({ loaded: 50, total: 0 });
      }
    });

    // Progress should be 0 when total is 0
    expect(result.current.state.progress).toBe(0);
  });

  it('should handle cancellation during upload without treating as error', async () => {
    const cancelError = { message: 'Upload cancelled by user' };
    
    mockAxiosPost.mockRejectedValue(cancelError);
    vi.mocked(axios.isCancel).mockReturnValue(true);

    const mockOnError = vi.fn();

    const { result } = renderHook(() =>
      useFileUpload({
        onError: mockOnError,
      })
    );

    await act(async () => {
      await result.current.uploadFile(validImageFile, '/api/v1/files/upload');
    });

    // Should reset to idle, not error
    await waitFor(() => {
      expect(result.current.state.status).toBe('idle');
    });

    // Should not call onError callback for cancellation
    expect(mockOnError).not.toHaveBeenCalled();
  });
});
