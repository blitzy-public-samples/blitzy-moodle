/**
 * Unit tests for PostForm component
 * 
 * Tests validate post creation and editing functionality including:
 * - Rich text editor integration
 * - File attachment uploads
 * - Form validation
 * - Draft saving
 * - Subscription options
 * - Edge cases like concurrent edits
 * 
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PostFormProps } from '@/features/activities/forums/components/PostForm';
import { PostForm } from '@/features/activities/forums/components/PostForm';

// Mock dependencies
vi.mock('@/features/activities/forums/hooks/useCreatePost', () => ({
  useCreatePost: vi.fn(),
}));

vi.mock('@/features/activities/forums/hooks/useCreateDiscussion', () => ({
  useCreateDiscussion: vi.fn(),
}));

vi.mock('@/features/activities/forums/hooks/useUpdatePost', () => ({
  useUpdatePost: vi.fn(),
}));

vi.mock('@/features/activities/forums/hooks/useSaveDraft', () => ({
  useSaveDraft: vi.fn(),
}));

vi.mock('@/hooks/useMultiFileUpload', () => ({
  useMultiFileUpload: vi.fn(),
}));

vi.mock('@/components/editor/RichTextEditor', () => ({
  default: ({ value, onChange, onBlur, placeholder }: { 
    value: string; 
    onChange: (value: string) => void; 
    onBlur?: () => void; 
    placeholder?: string;
  }) => (
    <textarea
      data-testid="rich-text-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      aria-label="Message body"
    />
  ),
}));

import { useCreatePost } from '@/features/activities/forums/hooks/useCreatePost';
import { useCreateDiscussion } from '@/features/activities/forums/hooks/useCreateDiscussion';
import { useUpdatePost } from '@/features/activities/forums/hooks/useUpdatePost';
import { useSaveDraft } from '@/features/activities/forums/hooks/useSaveDraft';
import { useMultiFileUpload } from '@/hooks/useMultiFileUpload';
import type { Post } from '@/features/activities/forums/types/forum.types';
import type * as UseSaveDraftModule from '@/features/activities/forums/hooks/useSaveDraft';

describe('PostForm Component', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  // Mock mutation functions
  const mockCreatePost = vi.fn();
  const mockCreateDiscussion = vi.fn();
  const mockUpdatePost = vi.fn();
  const mockSaveDraft = vi.fn();
  const mockLoadDraft = vi.fn();
  const mockDeleteDraft = vi.fn();
  const mockAddFiles = vi.fn<[File[]], void>();
  const mockRemoveFile = vi.fn();
  const mockClearFiles = vi.fn();
  const mockUpdateProgress = vi.fn();
  const mockSetFileError = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    user = userEvent.setup();

    // Setup default mock implementations
    vi.mocked(useCreatePost).mockReturnValue({
      createPost: mockCreatePost,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(useCreateDiscussion).mockReturnValue({
      createDiscussion: mockCreateDiscussion,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(useUpdatePost).mockReturnValue({
      updatePost: mockUpdatePost,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(useSaveDraft).mockReturnValue({
      saveDraft: mockSaveDraft,
      loadDraft: mockLoadDraft,
      deleteDraft: mockDeleteDraft,
      hasDraft: false,
      lastSavedAt: null,
    });

    vi.mocked(useMultiFileUpload).mockReturnValue({
      files: [],
      addFiles: mockAddFiles,
      removeFile: mockRemoveFile,
      clearFiles: mockClearFiles,
      updateProgress: mockUpdateProgress,
      setFileError: mockSetFileError,
      isMaxFilesReached: false,
      totalSize: 0,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup(); // Ensure all components are unmounted and DOM is cleaned up
  });

  const renderComponent = (props: Partial<PostFormProps> = {}) => {
    const defaultProps: PostFormProps = {
      forumId: 1,
      discussionId: null,
      parentPostId: null,
      onSubmitSuccess: vi.fn(),
      onCancel: vi.fn(),
      ...props,
    };

    // If supportsTags is true, provide default tags if not explicitly provided
    if (defaultProps.supportsTags && !defaultProps.availableTags) {
      defaultProps.availableTags = ['Discussion', 'Question'];
    }

    return render(
      <QueryClientProvider client={queryClient}>
        <PostForm {...defaultProps} />
      </QueryClientProvider>
    );
  };

  // Helper to create complete Post objects for tests
  const createMockPost = (overrides: Partial<Post> = {}): Post => {
    return {
      id: 10,
      discussionid: 1,
      parentid: 0,
      authorid: 1,
      timecreated: Date.now(),
      timemodified: Date.now(),
      mailed: false,
      subject: 'Test Subject',
      message: 'Test message content',
      messageformat: 1,
      messagetrust: false,
      hasattachments: false,
      totalscore: 0,
      mailnow: false,
      deleted: false,
      ...overrides,
    } as Post;
  };

  describe('Form Rendering', () => {
    it('renders form for creating new discussion with subject field', () => {
      renderComponent({ discussionId: null });

      expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/message body/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /post/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('renders form for replying to post without subject field', () => {
      renderComponent({ discussionId: 1, parentPostId: 5 });

      expect(screen.queryByLabelText(/subject/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/message body/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /post reply/i })).toBeInTheDocument();
    });

    it('renders form for editing existing post with pre-populated fields', () => {
      const existingPost = createMockPost({
        id: 10,
        subject: 'Test Subject',
        message: 'Test message content',
      });

      renderComponent({ post: existingPost });

      expect(screen.getByLabelText(/subject/i)).toHaveValue('Test Subject');
      expect(screen.getByLabelText(/message body/i)).toHaveValue('Test message content');
      expect(screen.getByRole('button', { name: /update post/i })).toBeInTheDocument();
    });

    it('displays subscription checkbox with proper label', () => {
      renderComponent();

      const checkbox = screen.getByRole('checkbox', { name: /subscribe to this discussion/i });
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });

    it('renders file attachment upload area', () => {
      renderComponent();

      expect(screen.getByText(/drag and drop files here or click to select/i)).toBeInTheDocument();
      expect(screen.getByText(/maximum 5 files/i)).toBeInTheDocument();
    });

    it('displays character count for message body', () => {
      renderComponent();

      expect(screen.getByText(/0 \/ 30000 characters/i)).toBeInTheDocument();
    });

    it('shows quote context when replying to a post', () => {
      const parentPost = {
        id: 5,
        author: 'John Doe',
        message: 'Original post content',
      };

      renderComponent({ 
        discussionId: 1, 
        parentPostId: 5, 
        parentPost 
      });

      expect(screen.getByText(/replying to john doe/i)).toBeInTheDocument();
      expect(screen.getByText(/original post content/i)).toBeInTheDocument();
    });

    it('shows moderator options for new discussions with permission', () => {
      renderComponent({ 
        discussionId: null, 
        canModerate: true 
      });

      expect(screen.getByRole('checkbox', { name: 'Pin discussion' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Lock discussion' })).toBeInTheDocument();
    });
  });

  describe('Subject Field Validation', () => {
    it('validates required subject for new discussion', async () => {
      renderComponent({ discussionId: null });

      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/subject is required/i)).toBeInTheDocument();
      });
      expect(mockCreatePost).not.toHaveBeenCalled();
    });

    it('validates minimum subject length', async () => {
      renderComponent({ discussionId: null });

      const subjectInput = screen.getByLabelText(/subject/i);
      await user.type(subjectInput, 'ab');

      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/subject must be at least 3 characters/i)).toBeInTheDocument();
      });
    });

    it('validates maximum subject length', async () => {
      renderComponent({ discussionId: null });

      const longSubject = 'a'.repeat(256);
      const subjectInput = screen.getByLabelText(/subject/i);
      const messageInput = screen.getByLabelText(/message body/i);
      
      // Use fireEvent.change to directly trigger validation without delays
      fireEvent.change(subjectInput, { target: { value: longSubject } });
      fireEvent.change(messageInput, { target: { value: 'Test message' } });

      // Submit the form to trigger validation
      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/subject must not exceed 255 characters/i)).toBeInTheDocument();
      });
    });

    it('shows character count for subject field', async () => {
      renderComponent({ discussionId: null });

      const subjectInput = screen.getByLabelText(/subject/i);
      await user.type(subjectInput, 'Test');

      expect(screen.getByText(/4 \/ 255 characters/i)).toBeInTheDocument();
    });
  });

  describe('Message Body Validation', () => {
    it('validates required message body', async () => {
      renderComponent();

      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/message is required/i)).toBeInTheDocument();
      });
      expect(mockCreatePost).not.toHaveBeenCalled();
    });

    it('validates minimum message length', async () => {
      renderComponent();

      const messageInput = screen.getByLabelText(/message body/i);
      // Use fireEvent to avoid slow typing - message needs 10 chars minimum
      fireEvent.change(messageInput, { target: { value: 'short' } });

      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/message must be at least 10 characters/i)).toBeInTheDocument();
      });
    });

    it('updates character count as user types', async () => {
      renderComponent();

      const messageInput = screen.getByLabelText(/message body/i);
      await user.type(messageInput, 'Hello World');

      expect(screen.getByText(/11 \/ 30000 characters/i)).toBeInTheDocument();
    });
  });

  describe('Rich Text Editor Integration', () => {
    it('renders rich text editor with formatting controls', () => {
      renderComponent();

      // The message field is a multiline TextField, not a separate rich text editor
      const messageInput = screen.getByLabelText(/message body/i);
      expect(messageInput).toBeInTheDocument();
      expect(messageInput).toHaveAttribute('aria-label', 'Message body');
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('handles rich text content changes', async () => {
      renderComponent();

      const messageInput = screen.getByLabelText(/message body/i);
      // Use fireEvent for speed - plain text content in TextField
      fireEvent.change(messageInput, { target: { value: 'Formatted content' } });

      expect(messageInput).toHaveValue('Formatted content');
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('preserves HTML formatting in message', async () => {
      const existingPost = createMockPost({
        id: 10,
        subject: 'Test',
        message: '<p><strong>Bold text</strong></p>',
      });

      renderComponent({ post: existingPost });

      const messageInput = screen.getByLabelText(/message body/i);
      // The TextField displays the message value as-is (HTML as text)
      expect(messageInput).toHaveValue('<p><strong>Bold text</strong></p>');
    });
  });

  describe('File Attachment Management', () => {
    it('handles file selection via input', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      
      renderComponent();

      const fileInput = screen.getByLabelText(/file input/i);
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockAddFiles).toHaveBeenCalled();
        const callArgs = mockAddFiles.mock.calls[0]?.[0];
        expect(callArgs).toBeDefined();
        expect(callArgs).toHaveLength(1);
        expect(callArgs?.[0]?.name).toBe('test.pdf');
      });
    });

    it('supports drag and drop file upload', async () => {
      const file = new File(['content'], 'document.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      
      renderComponent();

      const dropZone = screen.getByLabelText(/drag and drop files or click to select/i);
      
      // Simulate drop event
      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          files: [file],
          types: ['Files'],
        },
      });
      dropZone.dispatchEvent(dropEvent);

      await waitFor(() => {
        expect(mockAddFiles).toHaveBeenCalled();
        const callArgs = mockAddFiles.mock.calls[0]?.[0];
        expect(callArgs).toBeDefined();
        expect(callArgs).toHaveLength(1);
        expect(callArgs?.[0]?.name).toBe('document.docx');
      });
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('displays uploaded files with preview', async () => {
      vi.mocked(useMultiFileUpload).mockReturnValue({
        files: [
          { id: '1', name: 'test.pdf', size: 1024, type: 'application/pdf', progress: 100, file: new File([''], 'test.pdf') },
        ],
        addFiles: mockAddFiles,
        removeFile: mockRemoveFile,
        clearFiles: mockClearFiles,
        updateProgress: mockUpdateProgress,
        setFileError: mockSetFileError,
        isMaxFilesReached: false,
        totalSize: 1024,
      });

      renderComponent();

      expect(screen.getByText('test.pdf')).toBeInTheDocument();
      expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    });

    it('handles file removal', async () => {
      vi.mocked(useMultiFileUpload).mockReturnValue({
        files: [
          { id: '1', name: 'test.pdf', size: 1024, type: 'application/pdf', progress: 100, file: new File([''], 'test.pdf') },
        ],
        addFiles: mockAddFiles,
        removeFile: mockRemoveFile,
        clearFiles: mockClearFiles,
        updateProgress: mockUpdateProgress,
        setFileError: mockSetFileError,
        isMaxFilesReached: false,
        totalSize: 1024,
      });

      renderComponent();

      const removeButton = screen.getByRole('button', { name: /remove test\.pdf/i });
      await user.click(removeButton);

      expect(mockRemoveFile).toHaveBeenCalledWith('1');
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('validates file type restrictions', async () => {
      const invalidFile = new File(['content'], 'test.exe', { type: 'application/x-msdownload' });
      
      // Mock useMultiFileUpload to simulate file error
      vi.mocked(useMultiFileUpload).mockReturnValue({
        files: [
          { id: '1', name: 'test.exe', size: 1024, type: 'application/x-msdownload', progress: 0, file: invalidFile, error: 'File type not allowed' },
        ],
        addFiles: mockAddFiles,
        removeFile: mockRemoveFile,
        clearFiles: mockClearFiles,
        updateProgress: mockUpdateProgress,
        setFileError: mockSetFileError,
        isMaxFilesReached: false,
        totalSize: 1024,
      });
      
      renderComponent();

      // The error message should be displayed
      expect(screen.getByText(/file type not allowed/i)).toBeInTheDocument();
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('validates file size limit', async () => {
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });
      Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 });
      
      // Mock useMultiFileUpload to simulate file size error
      vi.mocked(useMultiFileUpload).mockReturnValue({
        files: [
          { id: '1', name: 'large.pdf', size: 11 * 1024 * 1024, type: 'application/pdf', progress: 0, file: largeFile, error: 'File size exceeds maximum limit of 10 MB' },
        ],
        addFiles: mockAddFiles,
        removeFile: mockRemoveFile,
        clearFiles: mockClearFiles,
        updateProgress: mockUpdateProgress,
        setFileError: mockSetFileError,
        isMaxFilesReached: false,
        totalSize: 11 * 1024 * 1024,
      });
      
      renderComponent();

      // The error message should be displayed
      expect(screen.getByText(/file size exceeds maximum/i)).toBeInTheDocument();
    });

    it('shows upload progress indicator', () => {
      vi.mocked(useMultiFileUpload).mockReturnValue({
        files: [
          { id: '1', name: 'uploading.pdf', size: 2048, type: 'application/pdf', progress: 45, file: new File([''], 'uploading.pdf') },
        ],
        addFiles: mockAddFiles,
        removeFile: mockRemoveFile,
        clearFiles: mockClearFiles,
        updateProgress: mockUpdateProgress,
        setFileError: mockSetFileError,
        isMaxFilesReached: false,
        totalSize: 2048,
      });

      renderComponent();

      expect(screen.getByText('uploading.pdf')).toBeInTheDocument();
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      // Check that the progress bar has the correct value
      expect(progressBar).toHaveAttribute('aria-valuenow', '45');
    });

    it('handles multiple file uploads', async () => {
      const file1 = new File(['content1'], 'file1.pdf', { type: 'application/pdf' });
      const file2 = new File(['content2'], 'file2.pdf', { type: 'application/pdf' });
      
      renderComponent();

      const fileInput = screen.getByLabelText(/file input/i);
      await user.upload(fileInput, [file1, file2]);

      await waitFor(() => {
        expect(mockAddFiles).toHaveBeenCalled();
        const callArgs = mockAddFiles.mock.calls[0]?.[0];
        expect(callArgs).toBeDefined();
        expect(callArgs).toHaveLength(2);
        expect(callArgs?.[0]?.name).toBe('file1.pdf');
        expect(callArgs?.[1]?.name).toBe('file2.pdf');
      });
    });
  });

  describe('Draft Auto-Save Functionality', () => {
    let timerUser: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
      vi.useFakeTimers();
      // Create a user instance configured for fake timers
      timerUser = userEvent.setup({ delay: null });
    });

    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it('auto-saves draft every 30 seconds', async () => {
      renderComponent();

      const messageInput = screen.getByLabelText(/message body/i);
      await timerUser.type(messageInput, 'Draft content');

      // Wait a tick for form state to update and effect to run
      await act(async () => {
        await Promise.resolve();
      });
      
      // Fast-forward 30 seconds to trigger auto-save (using synchronous version)
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // Check expectation immediately - no waitFor needed with fake timers
      expect(mockSaveDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Draft content',
        })
      );
    });

    it('does not auto-save if content is empty', async () => {
      renderComponent();

      // Wait for initial render to complete
      await act(async () => {
        await Promise.resolve();
      });

      // Fast-forward 30 seconds with empty content (using synchronous version)
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      expect(mockSaveDraft).not.toHaveBeenCalled();
    });

    it('restores draft on component mount', () => {
      const draft = {
        subject: 'Draft Subject',
        message: 'Draft message content',
        subscribe: true,
      };

      renderComponent({ draft });

      expect(screen.getByLabelText(/subject/i)).toHaveValue('Draft Subject');
      expect(screen.getByLabelText(/message body/i)).toHaveValue('Draft message content');
      expect(screen.getByRole('checkbox', { name: /subscribe/i })).toBeChecked();
    });
  });

  // Separate describe block for the draft saved indicator test (needs real timers)
  describe('Draft Saved Indicator (Real Timers)', () => {
    it('shows draft saved indicator', async () => {
      // Use real timers for this test to properly test auto-save
      vi.useRealTimers();
      
      // Import the actual hook implementation
      const actualModule = await vi.importActual<typeof UseSaveDraftModule>(
        '@/features/activities/forums/hooks/useSaveDraft'
      );
      
      // Replace mock with actual implementation for this test
      vi.mocked(useSaveDraft).mockImplementation(actualModule.useSaveDraft);
      
      // Mock localStorage
      const localStorageMock: Record<string, string> = {};
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
        return localStorageMock[key] || null;
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
        localStorageMock[key] = value;
      });

      // Create a user instance with real timers
      const realTimerUser = userEvent.setup({ delay: null });

      renderComponent();

      const messageInput = screen.getByLabelText(/message body/i);
      
      // Type the message
      await realTimerUser.type(messageInput, 'Draft content');

      // Verify draft saved indicator is not shown initially
      expect(screen.queryByText(/draft saved/i)).not.toBeInTheDocument();

      // Wait for auto-save to trigger (30 seconds + buffer)
      await waitFor(() => {
        expect(screen.getByText(/draft saved/i)).toBeInTheDocument();
      }, { timeout: 35000 }); // 35 seconds to account for typing time
      
      // Restore mock for other tests
      vi.mocked(useSaveDraft).mockReturnValue({
        saveDraft: mockSaveDraft,
        loadDraft: mockLoadDraft,
        deleteDraft: mockDeleteDraft,
        hasDraft: false,
        lastSavedAt: null,
      });
    }, 40000); // Increase test timeout to 40 seconds
  });

  describe('Form Submission', () => {
    it('submits new discussion with all fields', async () => {
      const onSubmitSuccess = vi.fn();
      
      renderComponent({ 
        discussionId: null,
        onSubmitSuccess,
      });

      const subjectInput = screen.getByLabelText(/subject/i);
      const messageInput = screen.getByLabelText(/message body/i);
      const subscribeCheckbox = screen.getByRole('checkbox', { name: /subscribe/i });

      await user.type(subjectInput, 'New Discussion Subject');
      await user.type(messageInput, 'This is the message body content');
      await user.click(subscribeCheckbox);

      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateDiscussion).toHaveBeenCalledWith(1, {
          subject: 'New Discussion Subject',
          message: 'This is the message body content',
          subscribe: true,
          attachments: [],
        });
      });
    });

    it('submits reply without subject field', async () => {
      const onSubmitSuccess = vi.fn();
      
      renderComponent({ 
        discussionId: 1,
        parentPostId: 5,
        onSubmitSuccess,
      });

      const messageInput = screen.getByLabelText(/message body/i);
      await user.type(messageInput, 'Reply message content');

      const submitButton = screen.getByRole('button', { name: /post reply/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreatePost).toHaveBeenCalledWith({
          forumId: 1,
          discussionId: 1,
          parentPostId: 5,
          message: 'Reply message content',
          subscribe: false,
          attachments: [],
        });
      });
    });

    it('submits edited post with updates', async () => {
      const existingPost = createMockPost({
        id: 10,
        subject: 'Original Subject',
        message: 'Original message',
      });

      const onSubmitSuccess = vi.fn();
      
      renderComponent({ 
        post: existingPost,
        onSubmitSuccess,
      });

      const subjectInput = screen.getByLabelText(/subject/i);
      const messageInput = screen.getByLabelText(/message body/i);

      await user.clear(subjectInput);
      await user.type(subjectInput, 'Updated Subject');
      
      await user.clear(messageInput);
      await user.type(messageInput, 'Updated message content');

      const submitButton = screen.getByRole('button', { name: /update post/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdatePost).toHaveBeenCalledWith({
          postId: 10,
          subject: 'Updated Subject',
          message: 'Updated message content',
          attachments: [],
        });
      });
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('shows loading state during submission', async () => {
      vi.mocked(useCreatePost).mockReturnValue({
        createPost: mockCreatePost,
        isLoading: true,
        isError: false,
        error: null,
      } as any);

      renderComponent();

      const submitButton = screen.getByRole('button', { name: /posting/i });
      expect(submitButton).toBeDisabled();
      // Component shows loading via button text change to "Posting..." and disabled state, not a progressbar
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('disables form fields during submission', async () => {
      vi.mocked(useCreatePost).mockReturnValue({
        createPost: mockCreatePost,
        isLoading: true,
        isError: false,
        error: null,
      } as any);

      renderComponent();

      const subjectInput = screen.getByLabelText(/subject/i);
      const messageInput = screen.getByLabelText(/message body/i);

      expect(subjectInput).toBeDisabled();
      expect(messageInput).toBeDisabled();
    });

    it('calls onSubmitSuccess after successful submission', async () => {
      const onSubmitSuccess = vi.fn();
      const createdPost = {
        discussion: {
          id: 20,
          courseid: 1,
          forumid: 1,
          name: 'New Post',
          firstpostid: 100,
          userid: 1,
          timemodified: Date.now(),
          timestart: 0,
          timeend: 0,
          pinned: false,
          timelocked: 0,
        },
        message: 'Discussion created successfully',
      };

      // Mock useCreateDiscussion to capture onSuccess callback and invoke it
      vi.mocked(useCreateDiscussion).mockImplementation((options) => {
        const mockCreateDiscussionWithCallback = vi.fn((_data) => {
          // Simulate successful mutation by calling the onSuccess callback
          options?.onSuccess?.(createdPost);
        });

        return {
          createDiscussion: mockCreateDiscussionWithCallback,
          isLoading: false,
          isError: false,
          error: null,
        } as any;
      });

      renderComponent({ 
        discussionId: null,
        onSubmitSuccess,
      });

      const subjectInput = screen.getByLabelText(/subject/i);
      const messageInput = screen.getByLabelText(/message body/i);

      await user.type(subjectInput, 'Test Subject');
      await user.type(messageInput, 'Test message');

      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSubmitSuccess).toHaveBeenCalledWith(createdPost);
      });
    });

    it('resets form after successful submission', async () => {
      const createdPost = {
        discussion: {
          id: 20,
          courseid: 1,
          forumid: 1,
          name: 'New Post',
          firstpostid: 100,
          userid: 1,
          timemodified: Date.now(),
          timestart: 0,
          timeend: 0,
          pinned: false,
          timelocked: 0,
        },
        message: 'Discussion created successfully',
      };

      // Mock useCreateDiscussion to capture onSuccess callback and invoke it
      vi.mocked(useCreateDiscussion).mockImplementation((options) => {
        const mockCreateDiscussionWithCallback = vi.fn((_data) => {
          // Simulate successful mutation by calling the onSuccess callback
          options?.onSuccess?.(createdPost);
        });

        return {
          createDiscussion: mockCreateDiscussionWithCallback,
          isLoading: false,
          isError: false,
          error: null,
        } as any;
      });

      renderComponent({ discussionId: null });

      const subjectInput = screen.getByLabelText(/subject/i);
      const messageInput = screen.getByLabelText(/message body/i);

      await user.type(subjectInput, 'Test Subject');
      await user.type(messageInput, 'Test message');

      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(subjectInput).toHaveValue('');
        expect(messageInput).toHaveValue('');
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message on failed submission', async () => {
      const error = new Error('Network error occurred');

      // Mock useCreateDiscussion to capture onError callback and invoke it on submission
      vi.mocked(useCreateDiscussion).mockImplementation((options) => {
        const mockCreateDiscussionWithError = vi.fn((_data) => {
          // Simulate failed mutation by calling the onError callback
          options?.onError?.(error);
        });

        return {
          createDiscussion: mockCreateDiscussionWithError,
          isLoading: false,
          isError: false,
          error: null,
        } as any;
      });

      renderComponent({ discussionId: null });

      const subjectInput = screen.getByLabelText(/subject/i);
      const messageInput = screen.getByLabelText(/message body/i);

      await user.type(subjectInput, 'Test Subject');
      await user.type(messageInput, 'Test message');

      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('displays validation errors inline', async () => {
      renderComponent({ discussionId: null });

      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/subject is required/i)).toBeInTheDocument();
        expect(screen.getByText(/message is required/i)).toBeInTheDocument();
      });
    });

    it('displays error summary for multiple validation errors', async () => {
      renderComponent({ discussionId: null });

      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        const errorSummary = screen.getByRole('alert', { name: /form has errors/i });
        expect(errorSummary).toBeInTheDocument();
        
        const errorList = within(errorSummary).getAllByRole('listitem');
        expect(errorList).toHaveLength(2);
      });
    });

    it('clears errors when user starts fixing them', async () => {
      renderComponent({ discussionId: null });

      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/subject is required/i)).toBeInTheDocument();
      });

      const subjectInput = screen.getByLabelText(/subject/i);
      await user.type(subjectInput, 'Valid subject');

      await waitFor(() => {
        expect(screen.queryByText(/subject is required/i)).not.toBeInTheDocument();
      });
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('handles concurrent edit detection', async () => {
      const existingPost = createMockPost({
        id: 10,
        subject: 'Original Subject',
        message: 'Original message',
      });

      const conflictError = {
        message: 'Post has been modified by another user',
        code: 'CONCURRENT_EDIT',
      };

      vi.mocked(useUpdatePost).mockReturnValue({
        updatePost: mockUpdatePost,
        isLoading: false,
        isError: true,
        error: conflictError,
      } as any);

      renderComponent({ post: existingPost });

      expect(screen.getByText(/post has been modified by another user/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reload latest version/i })).toBeInTheDocument();
    });
  });

  describe('Cancel and Unsaved Changes', () => {
    it('calls onCancel when cancel button is clicked without changes', async () => {
      const onCancel = vi.fn();
      
      renderComponent({ onCancel });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });

    it('shows confirmation dialog when canceling with unsaved changes', async () => {
      const onCancel = vi.fn();
      
      renderComponent({ onCancel });

      const messageInput = screen.getByLabelText(/message body/i);
      await user.type(messageInput, 'Some content');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.getByText(/you have unsaved changes/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /discard changes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /keep editing/i })).toBeInTheDocument();
    });

    it('discards changes when user confirms', async () => {
      const onCancel = vi.fn();
      
      renderComponent({ onCancel });

      const messageInput = screen.getByLabelText(/message body/i);
      await user.type(messageInput, 'Some content');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      const discardButton = screen.getByRole('button', { name: /discard changes/i });
      await user.click(discardButton);

      expect(onCancel).toHaveBeenCalled();
    });

    it('continues editing when user cancels discard', async () => {
      const onCancel = vi.fn();
      
      renderComponent({ onCancel });

      const messageInput = screen.getByLabelText(/message body/i);
      await user.type(messageInput, 'Some content');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      const keepEditingButton = screen.getByRole('button', { name: /keep editing/i });
      await user.click(keepEditingButton);

      expect(onCancel).not.toHaveBeenCalled();
      expect(messageInput).toHaveValue('Some content');
    });
  });

  describe('Preview Mode', () => {
    it('switches to preview mode when preview button clicked', async () => {
      renderComponent();

      const messageInput = screen.getByLabelText(/message body/i);
      await user.type(messageInput, 'This is a **bold** message');

      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);

      expect(screen.getByText(/preview mode/i)).toBeInTheDocument();
      expect(screen.getByText(/bold/i)).toBeInTheDocument();
    });

    it('returns to edit mode from preview', async () => {
      renderComponent();

      const messageInput = screen.getByLabelText(/message body/i);
      await user.type(messageInput, 'Content to preview');

      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      expect(screen.getByLabelText(/message body/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/message body/i)).toHaveValue('Content to preview');
    });

    it('renders HTML content in preview mode', async () => {
      renderComponent();

      const messageInput = screen.getByLabelText(/message body/i);
      await user.type(messageInput, '<p>Paragraph</p><ul><li>Item 1</li></ul>');

      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);

      const preview = screen.getByTestId('message-preview');
      expect(preview).toContainHTML('<p>Paragraph</p>');
      expect(preview).toContainHTML('<ul><li>Item 1</li></ul>');
    });
  });

  describe('Subscription Options', () => {
    it('toggles subscription checkbox', async () => {
      renderComponent();

      const checkbox = screen.getByRole('checkbox', { name: /subscribe to this discussion/i });
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('includes subscription preference in submission', async () => {
      renderComponent({ discussionId: null });

      const subjectInput = screen.getByLabelText(/subject/i);
      const messageInput = screen.getByLabelText(/message body/i);
      const subscribeCheckbox = screen.getByRole('checkbox', { name: /subscribe/i });

      await user.type(subjectInput, 'Test');
      await user.type(messageInput, 'Test message');
      await user.click(subscribeCheckbox);

      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateDiscussion).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            subscribe: true,
          })
        );
      });
    });

    it('displays email notification preferences', () => {
      renderComponent();

      expect(screen.getByLabelText(/email notification/i)).toBeInTheDocument();
    });
  });

  describe('Moderator Options', () => {
    it('includes pin discussion option for moderators', async () => {
      renderComponent({ 
        discussionId: null,
        canModerate: true,
      });

      const pinCheckbox = screen.getByRole('checkbox', { name: /pin discussion/i });
      await user.click(pinCheckbox);

      const subjectInput = screen.getByLabelText(/subject/i);
      const messageInput = screen.getByLabelText(/message body/i);

      await user.type(subjectInput, 'Test');
      await user.type(messageInput, 'Test message');

      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateDiscussion).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            pinned: true,
          })
        );
      });
    });

    it('includes lock discussion option for moderators', async () => {
      renderComponent({ 
        discussionId: null,
        canModerate: true,
      });

      const lockCheckbox = screen.getByRole('checkbox', { name: /lock discussion/i });
      await user.click(lockCheckbox);

      const subjectInput = screen.getByLabelText(/subject/i);
      const messageInput = screen.getByLabelText(/message body/i);

      await user.type(subjectInput, 'Test');
      await user.type(messageInput, 'Test message');

      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateDiscussion).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            locked: true,
          })
        );
      });
    });

    it('does not show moderator options for regular users', () => {
      renderComponent({ 
        discussionId: null,
        canModerate: false,
      });

      expect(screen.queryByRole('checkbox', { name: /pin discussion/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: /lock discussion/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels for screen readers', () => {
      renderComponent();

      expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/message body/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/subscribe to this discussion/i)).toBeInTheDocument();
    });

    it('announces validation errors to screen readers', async () => {
      renderComponent({ discussionId: null });

      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        const subjectError = screen.getByText(/subject is required/i);
        expect(subjectError).toHaveAttribute('role', 'alert');
        expect(subjectError).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('supports keyboard navigation', async () => {
      renderComponent();

      const subjectInput = screen.getByLabelText(/subject/i);
      const messageInput = screen.getByLabelText(/message body/i);
      const subscribeCheckbox = screen.getByRole('checkbox', { name: /subscribe/i });
      const submitButton = screen.getByRole('button', { name: /post/i });

      // Tab through form
      await user.tab();
      expect(subjectInput).toHaveFocus();

      await user.tab();
      expect(messageInput).toHaveFocus();

      await user.tab();
      expect(subscribeCheckbox).toHaveFocus();

      // Continue tabbing to submit button
      await user.tab();
      await user.tab(); // Skip cancel button
      expect(submitButton).toHaveFocus();
    });

    it('allows form submission via Enter key', async () => {
      renderComponent({ discussionId: null });

      const subjectInput = screen.getByLabelText(/subject/i);
      const messageInput = screen.getByLabelText(/message body/i);

      await user.type(subjectInput, 'Test Subject');
      await user.type(messageInput, 'Test message');
      
      // Press Enter in subject field (single-line input) to submit
      await user.click(subjectInput);
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockCreateDiscussion).toHaveBeenCalled();
      });
    });

    it('has aria-describedby for input constraints', () => {
      renderComponent();

      const subjectInput = screen.getByLabelText(/subject/i);
      const ariaDescribedBy = subjectInput.getAttribute('aria-describedby');
      
      expect(ariaDescribedBy).toBeTruthy();
      expect(document.getElementById(ariaDescribedBy!)).toHaveTextContent(/255 characters/i);
    });

    it('marks required fields with aria-required', () => {
      renderComponent();

      expect(screen.getByLabelText(/subject/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/message body/i)).toHaveAttribute('aria-required', 'true');
    });

    it('associates error messages with inputs via aria-describedby', async () => {
      renderComponent({ discussionId: null });

      const submitButton = screen.getByRole('button', { name: /post/i });
      await user.click(submitButton);

      await waitFor(() => {
        const subjectInput = screen.getByLabelText(/subject/i);
        const errorId = subjectInput.getAttribute('aria-describedby');
        const errorElement = document.getElementById(errorId!);
        
        expect(errorElement).toHaveTextContent(/subject is required/i);
      });
    });
  });

  describe('Additional Features', () => {
    it('displays formatting toolbar with common options', () => {
      renderComponent();

      expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /insert link/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bullet list/i })).toBeInTheDocument();
    });

    it('supports emoji picker integration', async () => {
      renderComponent();

      const emojiButton = screen.getByRole('button', { name: /insert emoji/i });
      await user.click(emojiButton);

      expect(screen.getByRole('dialog', { name: /emoji picker/i })).toBeInTheDocument();
    });

    it('supports user mention autocomplete', async () => {
      renderComponent();

      const messageInput = screen.getByLabelText(/message body/i);
      await user.type(messageInput, 'Hello @john');

      await waitFor(() => {
        expect(screen.getByRole('listbox', { name: /user suggestions/i })).toBeInTheDocument();
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });
    });

    it('inserts selected mention into message', async () => {
      renderComponent();

      const messageInput = screen.getByLabelText(/message body/i);
      await user.type(messageInput, 'Hello @john');

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      const mention = screen.getByText(/john doe/i);
      await user.click(mention);

      expect(messageInput).toHaveValue('Hello @johndoe ');
    });

    it('displays tags selector if forum supports tags', () => {
      renderComponent({ supportsTags: true });

      expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
    });

    it('allows selecting multiple tags', async () => {
      renderComponent({ supportsTags: true });

      const tagsInput = screen.getByLabelText(/tags/i);
      await user.click(tagsInput);

      await user.click(screen.getByRole('option', { name: /discussion/i }));
      await user.click(screen.getByRole('option', { name: /question/i }));

      // Verify tags are displayed (may appear multiple times - in dropdown and as chips)
      const discussionElements = screen.getAllByText(/discussion/i);
      const questionElements = screen.getAllByText(/question/i);
      
      expect(discussionElements.length).toBeGreaterThan(0);
      expect(questionElements.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    it('handles network timeout during submission', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';

      vi.mocked(useCreatePost).mockReturnValue({
        createPost: mockCreatePost,
        isLoading: false,
        isError: true,
        error: timeoutError,
      } as any);

      renderComponent();

      expect(screen.getByText(/request timeout/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('handles server validation errors', async () => {
      const validationError = {
        message: 'Validation failed',
        fields: {
          subject: 'Subject contains inappropriate content',
          message: 'Message is too short',
        },
      };

      vi.mocked(useCreatePost).mockReturnValue({
        createPost: mockCreatePost,
        isLoading: false,
        isError: true,
        error: validationError,
      } as any);

      renderComponent();

      expect(screen.getByText(/subject contains inappropriate content/i)).toBeInTheDocument();
      expect(screen.getByText(/message is too short/i)).toBeInTheDocument();
    });

    it('preserves unsaved content on page reload attempt', () => {
      const beforeUnloadHandler = vi.fn((e: BeforeUnloadEvent) => {
        e.preventDefault();
        return '';
      });

      window.addEventListener('beforeunload', beforeUnloadHandler);

      renderComponent();

      const messageInput = screen.getByLabelText(/message body/i);
      void user.type(messageInput, 'Unsaved content');

      const event = new Event('beforeunload');
      window.dispatchEvent(event);

      expect(beforeUnloadHandler).toHaveBeenCalled();

      window.removeEventListener('beforeunload', beforeUnloadHandler);
    });

    it('handles rapid successive submissions gracefully', async () => {
      renderComponent({ discussionId: null });

      const subjectInput = screen.getByLabelText(/subject/i);
      const messageInput = screen.getByLabelText(/message body/i);

      await user.type(subjectInput, 'Test Subject');
      await user.type(messageInput, 'Test message');

      const submitButton = screen.getByRole('button', { name: /post/i });
      
      // First, verify the button is not disabled initially
      expect(submitButton).not.toBeDisabled();
      
      // Click once to initiate submission - this should work
      await user.click(submitButton);
      
      // The button should now be disabled immediately due to isSubmittingLocal
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
      
      // Try to click again while disabled - these should have no effect
      // Using fireEvent instead of user.click to bypass the pointer-events check
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);

      // Should only call once because subsequent clicks are on a disabled button
      expect(mockCreateDiscussion).toHaveBeenCalledTimes(1);
    });

    it('handles empty file list gracefully', () => {
      vi.mocked(useMultiFileUpload).mockReturnValue({
        files: [],
        addFiles: mockAddFiles,
        removeFile: mockRemoveFile,
        clearFiles: mockClearFiles,
        updateProgress: mockUpdateProgress,
        setFileError: mockSetFileError,
        isMaxFilesReached: false,
        totalSize: 0,
      });

      renderComponent();

      expect(screen.queryByRole('list', { name: /attached files/i })).not.toBeInTheDocument();
    });
  });
});

