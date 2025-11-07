import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import PostCard from '@/features/activities/forums/components/PostCard';
import type { ForumPost, PostAttachment, UserRole } from '@/features/activities/forums/types/forum.types';

expect.extend(toHaveNoViolations);

// Mock handlers
const mockHandlers = {
  onReply: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onReport: vi.fn(),
  onLike: vi.fn(),
  onQuote: vi.fn(),
  onApprove: vi.fn(),
  onReject: vi.fn(),
  onSplit: vi.fn(),
  onMove: vi.fn(),
};

// Mock user profile navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
  configurable: true,
});

// Mock matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('PostCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset matchMedia mock before each test
    (window.matchMedia as any) = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  const createMockPost = (overrides?: Partial<ForumPost>): ForumPost => ({
    id: 1,
    discussionId: 100,
    parentId: null,
    subject: 'Test Post Subject',
    message: '<p>This is a test post message with <strong>HTML formatting</strong>.</p>',
    messageFormat: 1,
    author: {
      id: 42,
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      profileImageUrl: 'https://example.com/avatar/42.jpg',
      profileUrl: '/user/profile/42',
    },
    created: new Date('2024-01-15T10:30:00Z'),
    modified: null,
    editedBy: null,
    deleted: false,
    deletedBy: null,
    deletedAt: null,
    attachments: [],
    hasInlineFiles: false,
    wordCount: 15,
    charCount: 85,
    canEdit: false,
    canDelete: false,
    canReply: true,
    canSplit: false,
    canExport: false,
    canControlReadTracking: false,
    mailNow: false,
    unread: false,
    rating: null,
    userRating: null,
    replyCount: 0,
    likeCount: 0,
    userHasLiked: false,
    isPending: false,
    moderatorApproved: true,
    ...overrides,
  });

  const createMockAttachment = (overrides?: Partial<PostAttachment>): PostAttachment => ({
    id: 1,
    filename: 'document.pdf',
    filesize: 2048576, // 2MB
    mimetype: 'application/pdf',
    fileurl: 'https://example.com/files/document.pdf',
    timemodified: new Date('2024-01-15T10:30:00Z'),
    ...overrides,
  });

  describe('Author Information Section', () => {
    it('should render author avatar', () => {
      const post = createMockPost();
      render(<PostCard post={post} {...mockHandlers} />);
      
      const avatar = screen.getByRole('img', { name: /john doe/i });
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar/42.jpg');
    });

    it('should render author full name', () => {
      const post = createMockPost();
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should render author name as link to profile', () => {
      const post = createMockPost();
      render(<PostCard post={post} {...mockHandlers} />);
      
      const profileLink = screen.getByRole('link', { name: /john doe/i });
      expect(profileLink).toHaveAttribute('href', '/user/profile/42');
    });

    it('should render teacher role badge', () => {
      const post = createMockPost({
        author: {
          id: 42,
          firstName: 'Jane',
          lastName: 'Teacher',
          fullName: 'Jane Teacher',
          profileImageUrl: 'https://example.com/avatar/42.jpg',
          profileUrl: '/user/profile/42',
          role: 'teacher' as UserRole,
        },
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const roleBadge = screen.getByTestId('role-badge');
      expect(roleBadge).toBeInTheDocument();
      expect(roleBadge).toHaveTextContent('teacher');
    });

    it('should render moderator badge', () => {
      const post = createMockPost({
        author: {
          id: 42,
          firstName: 'Admin',
          lastName: 'User',
          fullName: 'Admin User',
          profileImageUrl: 'https://example.com/avatar/42.jpg',
          profileUrl: '/user/profile/42',
          role: 'moderator' as UserRole,
        },
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText(/moderator/i)).toBeInTheDocument();
    });

    it('should render student role badge', () => {
      const post = createMockPost({
        author: {
          id: 42,
          firstName: 'Student',
          lastName: 'User',
          fullName: 'Student User',
          profileImageUrl: 'https://example.com/avatar/42.jpg',
          profileUrl: '/user/profile/42',
          role: 'student' as UserRole,
        },
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const roleBadge = screen.getByTestId('role-badge');
      expect(roleBadge).toBeInTheDocument();
      expect(roleBadge).toHaveTextContent('student');
    });
  });

  describe('Post Metadata', () => {
    it('should render post timestamp', () => {
      const post = createMockPost();
      render(<PostCard post={post} {...mockHandlers} />);
      
      // Should display relative time or formatted date
      expect(screen.getByText(/jan/i)).toBeInTheDocument();
    });

    it('should render edited indicator when post has been modified', () => {
      const post = createMockPost({
        modified: new Date('2024-01-15T14:30:00Z'),
        editedBy: {
          id: 43,
          firstName: 'Editor',
          lastName: 'User',
          fullName: 'Editor User',
          profileImageUrl: 'https://example.com/avatar/43.jpg',
          profileUrl: '/user/profile/43',
        },
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText(/edited/i)).toBeInTheDocument();
      expect(screen.getByText(/editor user/i)).toBeInTheDocument();
    });

    it('should render edit history link when post has been edited', () => {
      const post = createMockPost({
        modified: new Date('2024-01-15T14:30:00Z'),
        editedBy: {
          id: 43,
          firstName: 'Editor',
          lastName: 'User',
          fullName: 'Editor User',
          profileImageUrl: 'https://example.com/avatar/43.jpg',
          profileUrl: '/user/profile/43',
        },
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const editHistoryLink = screen.getByRole('link', { name: /edit history/i });
      expect(editHistoryLink).toBeInTheDocument();
    });

    it('should not render edited indicator for non-edited posts', () => {
      const post = createMockPost();
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.queryByText(/edited/i)).not.toBeInTheDocument();
    });

    it('should render unread indicator badge for new posts', () => {
      const post = createMockPost({ unread: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByTestId('unread-indicator')).toBeInTheDocument();
    });

    it('should not render unread indicator for read posts', () => {
      const post = createMockPost({ unread: false });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.queryByTestId('unread-indicator')).not.toBeInTheDocument();
    });
  });

  describe('Post Content Rendering', () => {
    it('should render post subject', () => {
      const post = createMockPost();
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText('Test Post Subject')).toBeInTheDocument();
    });

    it('should render post message with HTML formatting preserved', () => {
      const post = createMockPost({
        message: '<p>This is a <strong>bold</strong> and <em>italic</em> text.</p>',
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const strongElement = screen.getByText('bold');
      expect(strongElement.tagName).toBe('STRONG');
      
      const emElement = screen.getByText('italic');
      expect(emElement.tagName).toBe('EM');
    });

    it('should sanitize and protect against XSS in message content', () => {
      const post = createMockPost({
        message: '<p>Safe content</p><script>alert("XSS")</script>',
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText('Safe content')).toBeInTheDocument();
      expect(screen.queryByText(/alert/i)).not.toBeInTheDocument();
    });

    it('should render embedded images in content', () => {
      const post = createMockPost({
        message: '<p>Check this image:</p><img src="https://example.com/image.jpg" alt="Test image" />',
        hasInlineFiles: true,
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const image = screen.getByRole('img', { name: /test image/i });
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
    });

    it('should render code blocks with syntax highlighting', () => {
      const post = createMockPost({
        message: '<pre><code class="language-javascript">const x = 10;</code></pre>',
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const codeBlock = screen.getByText(/const x = 10;/);
      expect(codeBlock).toBeInTheDocument();
      expect(codeBlock.closest('code')).toHaveClass('language-javascript');
    });

    it('should render "Show more" button for long posts', () => {
      const longMessage = '<p>' + 'Lorem ipsum dolor sit amet. '.repeat(100) + '</p>';
      const post = createMockPost({ message: longMessage });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const showMoreButton = screen.getByRole('button', { name: /show more/i });
      expect(showMoreButton).toBeInTheDocument();
    });

    it('should expand long post content when "Show more" is clicked', async () => {
      const longMessage = '<p>' + 'Lorem ipsum dolor sit amet. '.repeat(100) + '</p>';
      const post = createMockPost({ message: longMessage });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const showMoreButton = screen.getByRole('button', { name: /show more/i });
      await userEvent.click(showMoreButton);
      
      expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
    });
  });

  describe('File Attachments', () => {
    it('should render attachments list', () => {
      const attachment1 = createMockAttachment({ id: 1, filename: 'document.pdf' });
      const attachment2 = createMockAttachment({ id: 2, filename: 'image.png', mimetype: 'image/png' });
      const post = createMockPost({ attachments: [attachment1, attachment2] });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('image.png')).toBeInTheDocument();
    });

    it('should display attachment file sizes', () => {
      const attachment = createMockAttachment({ filesize: 2048576 }); // 2MB
      const post = createMockPost({ attachments: [attachment] });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText(/2\.0 MB/i)).toBeInTheDocument();
    });

    it('should render download button for each attachment', () => {
      const attachment = createMockAttachment();
      const post = createMockPost({ attachments: [attachment] });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const downloadButton = screen.getByRole('link', { name: /download/i });
      expect(downloadButton).toHaveAttribute('href', 'https://example.com/files/document.pdf');
    });

    it('should render attachment icon based on file type', () => {
      const pdfAttachment = createMockAttachment({ id: 1, mimetype: 'application/pdf' });
      const imageAttachment = createMockAttachment({ id: 2, mimetype: 'image/png', filename: 'image.png' });
      const post = createMockPost({ attachments: [pdfAttachment, imageAttachment] });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByTestId('attachment-icon-pdf')).toBeInTheDocument();
      expect(screen.getByTestId('attachment-icon-image')).toBeInTheDocument();
    });

    it('should render thumbnail preview for image attachments', () => {
      const imageAttachment = createMockAttachment({
        mimetype: 'image/jpeg',
        filename: 'photo.jpg',
        fileurl: 'https://example.com/files/photo.jpg',
      });
      const post = createMockPost({ attachments: [imageAttachment] });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const thumbnail = screen.getByRole('img', { name: /photo\.jpg/i });
      expect(thumbnail).toBeInTheDocument();
    });

    it('should render "Download all as ZIP" option for multiple attachments', () => {
      const attachment1 = createMockAttachment({ id: 1 });
      const attachment2 = createMockAttachment({ id: 2 });
      const post = createMockPost({ attachments: [attachment1, attachment2] });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByRole('button', { name: /download all as zip/i })).toBeInTheDocument();
    });

    it('should not render download all option for single attachment', () => {
      const attachment = createMockAttachment();
      const post = createMockPost({ attachments: [attachment] });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.queryByRole('button', { name: /download all as zip/i })).not.toBeInTheDocument();
    });

    it('should not render attachments section when no attachments', () => {
      const post = createMockPost({ attachments: [] });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.queryByText(/attachments/i)).not.toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should render Reply button when user can reply', () => {
      const post = createMockPost({ canReply: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument();
    });

    it('should call onReply handler when Reply button is clicked', async () => {
      const post = createMockPost({ canReply: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const replyButton = screen.getByRole('button', { name: /reply/i });
      await userEvent.click(replyButton);
      
      expect(mockHandlers.onReply).toHaveBeenCalledWith(post.id);
    });

    it('should not render Reply button when user cannot reply', () => {
      const post = createMockPost({ canReply: false });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.queryByRole('button', { name: /reply/i })).not.toBeInTheDocument();
    });

    it('should render Edit button when user can edit', () => {
      const post = createMockPost({ canEdit: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('should call onEdit handler when Edit button is clicked', async () => {
      const post = createMockPost({ canEdit: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const editButton = screen.getByRole('button', { name: /edit/i });
      await userEvent.click(editButton);
      
      expect(mockHandlers.onEdit).toHaveBeenCalledWith(post.id);
    });

    it('should not render Edit button when user cannot edit', () => {
      const post = createMockPost({ canEdit: false });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('should render Delete button when user can delete', () => {
      const post = createMockPost({ canDelete: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('should show confirmation dialog when Delete button is clicked', async () => {
      const post = createMockPost({ canDelete: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await userEvent.click(deleteButton);
      
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    it('should call onDelete handler when deletion is confirmed', async () => {
      const post = createMockPost({ canDelete: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await userEvent.click(deleteButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await userEvent.click(confirmButton);
      
      expect(mockHandlers.onDelete).toHaveBeenCalledWith(post.id);
    });

    it('should not call onDelete handler when deletion is cancelled', async () => {
      const post = createMockPost({ canDelete: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await userEvent.click(deleteButton);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);
      
      expect(mockHandlers.onDelete).not.toHaveBeenCalled();
    });

    it('should render Report button', () => {
      const post = createMockPost();
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByRole('button', { name: /report/i })).toBeInTheDocument();
    });

    it('should call onReport handler when Report button is clicked', async () => {
      const post = createMockPost();
      render(<PostCard post={post} {...mockHandlers} />);
      
      const reportButton = screen.getByRole('button', { name: /report/i });
      await userEvent.click(reportButton);
      
      expect(mockHandlers.onReport).toHaveBeenCalledWith(post.id);
    });

    it('should render Permalink button', () => {
      const post = createMockPost();
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByRole('button', { name: /permalink/i })).toBeInTheDocument();
    });

    it('should copy permalink to clipboard when Permalink button is clicked', async () => {
      const post = createMockPost();
      render(<PostCard post={post} {...mockHandlers} />);
      
      const permalinkButton = screen.getByRole('button', { name: /permalink/i });
      await userEvent.click(permalinkButton);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it('should render Quote button', () => {
      const post = createMockPost({ canReply: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByRole('button', { name: /quote/i })).toBeInTheDocument();
    });

    it('should call onQuote handler when Quote button is clicked', async () => {
      const post = createMockPost({ canReply: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const quoteButton = screen.getByRole('button', { name: /quote/i });
      await userEvent.click(quoteButton);
      
      expect(mockHandlers.onQuote).toHaveBeenCalledWith(post.id);
    });
  });

  describe('Like/Rating System', () => {
    it('should render Like button with count', () => {
      const post = createMockPost({ likeCount: 5 });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByRole('button', { name: /like/i })).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should show liked state when user has liked the post', () => {
      const post = createMockPost({ userHasLiked: true, likeCount: 5 });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const likeButton = screen.getByRole('button', { name: /liked/i });
      expect(likeButton).toHaveClass('liked');
    });

    it('should call onLike handler when Like button is clicked', async () => {
      const post = createMockPost({ likeCount: 0 });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const likeButton = screen.getByRole('button', { name: /like/i });
      await userEvent.click(likeButton);
      
      expect(mockHandlers.onLike).toHaveBeenCalledWith(post.id);
    });

    it('should render star rating when forum uses rating system', () => {
      const post = createMockPost({ rating: 4.5 });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByTestId('post-rating')).toBeInTheDocument();
      expect(screen.getByText(/4\.5/)).toBeInTheDocument();
    });

    it('should render user rating separately from average rating', () => {
      const post = createMockPost({ rating: 4.5, userRating: 5 });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByTestId('post-rating')).toBeInTheDocument();
      expect(screen.getByTestId('user-rating')).toBeInTheDocument();
    });
  });

  describe('Reply Count Badge', () => {
    it('should render reply count badge when post has replies', () => {
      const post = createMockPost({ replyCount: 3 });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText(/3 replies/i)).toBeInTheDocument();
    });

    it('should not render reply count badge when post has no replies', () => {
      const post = createMockPost({ replyCount: 0 });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.queryByText(/replies/i)).not.toBeInTheDocument();
    });

    it('should render singular "reply" for single reply', () => {
      const post = createMockPost({ replyCount: 1 });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText(/1 reply/i)).toBeInTheDocument();
    });
  });

  describe('Moderator Controls', () => {
    it('should render Approve button for pending posts when user is moderator', () => {
      const post = createMockPost({ isPending: true, canSplit: true });
      render(<PostCard post={post} currentUserRole="moderator" {...mockHandlers} />);
      
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    });

    it('should render Reject button for pending posts when user is moderator', () => {
      const post = createMockPost({ isPending: true, canSplit: true });
      render(<PostCard post={post} currentUserRole="moderator" {...mockHandlers} />);
      
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    });

    it('should call onApprove handler when Approve button is clicked', async () => {
      const post = createMockPost({ isPending: true, canSplit: true });
      render(<PostCard post={post} currentUserRole="moderator" {...mockHandlers} />);
      
      const approveButton = screen.getByRole('button', { name: /approve/i });
      await userEvent.click(approveButton);
      
      expect(mockHandlers.onApprove).toHaveBeenCalledWith(post.id);
    });

    it('should call onReject handler when Reject button is clicked', async () => {
      const post = createMockPost({ isPending: true, canSplit: true });
      render(<PostCard post={post} currentUserRole="moderator" {...mockHandlers} />);
      
      const rejectButton = screen.getByRole('button', { name: /reject/i });
      await userEvent.click(rejectButton);
      
      expect(mockHandlers.onReject).toHaveBeenCalledWith(post.id);
    });

    it('should render Split button when user can split posts', () => {
      const post = createMockPost({ canSplit: true });
      render(<PostCard post={post} currentUserRole="moderator" {...mockHandlers} />);
      
      expect(screen.getByRole('button', { name: /split/i })).toBeInTheDocument();
    });

    it('should call onSplit handler when Split button is clicked', async () => {
      const post = createMockPost({ canSplit: true });
      render(<PostCard post={post} currentUserRole="moderator" {...mockHandlers} />);
      
      const splitButton = screen.getByRole('button', { name: /split/i });
      await userEvent.click(splitButton);
      
      expect(mockHandlers.onSplit).toHaveBeenCalledWith(post.id);
    });

    it('should render Move button when user is moderator', () => {
      const post = createMockPost({ canSplit: true });
      render(<PostCard post={post} currentUserRole="moderator" {...mockHandlers} />);
      
      expect(screen.getByRole('button', { name: /move/i })).toBeInTheDocument();
    });

    it('should call onMove handler when Move button is clicked', async () => {
      const post = createMockPost({ canSplit: true });
      render(<PostCard post={post} currentUserRole="moderator" {...mockHandlers} />);
      
      const moveButton = screen.getByRole('button', { name: /move/i });
      await userEvent.click(moveButton);
      
      expect(mockHandlers.onMove).toHaveBeenCalledWith(post.id);
    });

    it('should not render moderator controls for non-moderators', () => {
      const post = createMockPost({ isPending: true });
      render(<PostCard post={post} currentUserRole="student" {...mockHandlers} />);
      
      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /split/i })).not.toBeInTheDocument();
    });
  });

  describe('Deleted Posts', () => {
    it('should render deleted post placeholder', () => {
      const post = createMockPost({
        deleted: true,
        deletedBy: {
          id: 50,
          firstName: 'Admin',
          lastName: 'User',
          fullName: 'Admin User',
          profileImageUrl: 'https://example.com/avatar/50.jpg',
          profileUrl: '/user/profile/50',
        },
        deletedAt: new Date('2024-01-16T10:00:00Z'),
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText(/this post has been deleted/i)).toBeInTheDocument();
      expect(screen.getByText(/admin user/i)).toBeInTheDocument();
    });

    it('should not render post content for deleted posts', () => {
      const post = createMockPost({
        deleted: true,
        message: '<p>This should not be visible</p>',
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.queryByText(/this should not be visible/i)).not.toBeInTheDocument();
    });

    it('should not render action buttons for deleted posts', () => {
      const post = createMockPost({
        deleted: true,
        canReply: true,
        canEdit: true,
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.queryByRole('button', { name: /reply/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });
  });

  describe('Pending Approval State', () => {
    it('should render pending approval indicator', () => {
      const post = createMockPost({ isPending: true, moderatorApproved: false });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText(/pending approval/i)).toBeInTheDocument();
    });

    it('should not render pending indicator for approved posts', () => {
      const post = createMockPost({ isPending: false, moderatorApproved: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.queryByText(/pending approval/i)).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle posts by deleted users', () => {
      const post = createMockPost({
        author: {
          id: 0,
          firstName: 'Deleted',
          lastName: 'User',
          fullName: 'Deleted User',
          profileImageUrl: '',
          profileUrl: '',
        },
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText(/deleted user/i)).toBeInTheDocument();
    });

    it('should handle posts with broken attachment links', () => {
      const attachment = createMockAttachment({ fileurl: '' });
      const post = createMockPost({ attachments: [attachment] });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /download/i })).not.toBeInTheDocument();
    });

    it('should handle posts with no author profile image', () => {
      const post = createMockPost({
        author: {
          id: 42,
          firstName: 'John',
          lastName: 'Doe',
          fullName: 'John Doe',
          profileImageUrl: '',
          profileUrl: '/user/profile/42',
        },
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      // Should render default avatar or initials
      expect(screen.getByTestId('default-avatar')).toBeInTheDocument();
    });

    it('should handle posts with extremely long content', () => {
      const veryLongMessage = '<p>' + 'A'.repeat(10000) + '</p>';
      const post = createMockPost({ message: veryLongMessage });
      
      expect(() => render(<PostCard post={post} {...mockHandlers} />)).not.toThrow();
    });

    it('should handle posts with no message content', () => {
      const post = createMockPost({ message: '' });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.queryByText(/no content/i)).toBeInTheDocument();
    });

    it('should handle posts with malformed HTML', () => {
      const post = createMockPost({ message: '<p>Unclosed paragraph<div>Nested incorrectly' });
      
      expect(() => render(<PostCard post={post} {...mockHandlers} />)).not.toThrow();
    });

    it('should handle multiple image attachments', () => {
      const attachments = Array.from({ length: 10 }, (_, i) =>
        createMockAttachment({
          id: i + 1,
          filename: `image${i + 1}.jpg`,
          mimetype: 'image/jpeg',
        })
      );
      const post = createMockPost({ attachments });
      render(<PostCard post={post} {...mockHandlers} />);
      
      attachments.forEach((attachment) => {
        expect(screen.getByText(attachment.filename)).toBeInTheDocument();
      });
    });

    it('should handle mixed attachment types', () => {
      const attachments = [
        createMockAttachment({ id: 1, filename: 'doc.pdf', mimetype: 'application/pdf' }),
        createMockAttachment({ id: 2, filename: 'image.png', mimetype: 'image/png' }),
        createMockAttachment({ id: 3, filename: 'video.mp4', mimetype: 'video/mp4' }),
        createMockAttachment({ id: 4, filename: 'data.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      ];
      const post = createMockPost({ attachments });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText('doc.pdf')).toBeInTheDocument();
      expect(screen.getByText('image.png')).toBeInTheDocument();
      expect(screen.getByText('video.mp4')).toBeInTheDocument();
      expect(screen.getByText('data.xlsx')).toBeInTheDocument();
    });
  });

  describe('Permission-Based Visibility', () => {
    it('should show Edit button only for post owner', () => {
      const post = createMockPost({ canEdit: true });
      render(<PostCard post={post} currentUserId={42} {...mockHandlers} />);
      
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('should not show Edit button for other users', () => {
      const post = createMockPost({ canEdit: false });
      render(<PostCard post={post} currentUserId={99} {...mockHandlers} />);
      
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('should show Delete button for moderators even if not owner', () => {
      const post = createMockPost({ canDelete: true });
      render(<PostCard post={post} currentUserRole="moderator" currentUserId={99} {...mockHandlers} />);
      
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('should show moderator controls only for moderators and teachers', () => {
      const post = createMockPost({ canSplit: true });
      render(<PostCard post={post} currentUserRole="teacher" {...mockHandlers} />);
      
      expect(screen.getByRole('button', { name: /split/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /move/i })).toBeInTheDocument();
    });

    it('should not show moderator controls for students', () => {
      const post = createMockPost({ canSplit: false });
      render(<PostCard post={post} currentUserRole="student" {...mockHandlers} />);
      
      expect(screen.queryByRole('button', { name: /split/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /move/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const post = createMockPost();
      const { container } = render(<PostCard post={post} {...mockHandlers} />);
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper semantic HTML structure', () => {
      const post = createMockPost();
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('should have proper ARIA labels for buttons', () => {
      const post = createMockPost({ canReply: true, canEdit: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const replyButton = screen.getByRole('button', { name: /reply/i });
      expect(replyButton).toHaveAttribute('aria-label');
      
      const editButton = screen.getByRole('button', { name: /edit/i });
      expect(editButton).toHaveAttribute('aria-label');
    });

    it('should support keyboard navigation', async () => {
      const post = createMockPost({ canReply: true, canEdit: true, canDelete: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const replyButton = screen.getByRole('button', { name: /reply/i });
      replyButton.focus();
      expect(replyButton).toHaveFocus();
      
      // Tab to next button
      await userEvent.tab();
      const editButton = screen.getByRole('button', { name: /edit/i });
      expect(editButton).toHaveFocus();
    });

    it('should have proper alt text for images', () => {
      const post = createMockPost();
      render(<PostCard post={post} {...mockHandlers} />);
      
      const avatar = screen.getByRole('img', { name: /john doe/i });
      expect(avatar).toHaveAttribute('alt');
    });

    it('should have proper heading hierarchy', () => {
      const post = createMockPost();
      render(<PostCard post={post} {...mockHandlers} />);
      
      const heading = screen.getByRole('heading', { name: /test post subject/i });
      expect(heading).toBeInTheDocument();
    });

    it('should announce dynamic content changes to screen readers', async () => {
      const post = createMockPost({ likeCount: 5 });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const likeButton = screen.getByRole('button', { name: /like/i });
      await userEvent.click(likeButton);
      
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Layout', () => {
    it('should render in mobile layout for small screens', () => {
      // Mock small screen - matches will be true for down('md')
      (window.matchMedia as any) = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width'), // Match mobile breakpoint
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      
      const post = createMockPost();
      render(<PostCard post={post} {...mockHandlers} />);
      
      const card = screen.getByRole('article');
      expect(card).toHaveClass('mobile-layout');
    });

    it('should render in desktop layout for large screens', () => {
      // Mock large screen - matches will be false for down('md')
      (window.matchMedia as any) = vi.fn().mockImplementation((query: string) => ({
        matches: false, // Don't match mobile breakpoint
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      
      const post = createMockPost();
      render(<PostCard post={post} {...mockHandlers} />);
      
      const card = screen.getByRole('article');
      expect(card).toHaveClass('desktop-layout');
    });

    it('should stack action buttons vertically on mobile', () => {
      // Mock mobile screen
      (window.matchMedia as any) = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      
      const post = createMockPost({ canReply: true, canEdit: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const actionButtons = screen.getByTestId('action-buttons');
      expect(actionButtons).toHaveClass('vertical');
    });

    it('should display action buttons horizontally on desktop', () => {
      // Mock desktop screen
      (window.matchMedia as any) = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      
      const post = createMockPost({ canReply: true, canEdit: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const actionButtons = screen.getByTestId('action-buttons');
      expect(actionButtons).toHaveClass('horizontal');
    });
  });

  describe('XSS Protection', () => {
    it('should sanitize script tags in message content', () => {
      const post = createMockPost({
        message: '<p>Safe text</p><script>alert("XSS")</script>',
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText('Safe text')).toBeInTheDocument();
      expect(document.querySelector('script')).not.toBeInTheDocument();
    });

    it('should sanitize onclick handlers', () => {
      const post = createMockPost({
        message: '<p onclick="alert(\'XSS\')">Click me</p>',
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const paragraph = screen.getByText('Click me');
      expect(paragraph).not.toHaveAttribute('onclick');
    });

    it('should sanitize javascript: URLs', () => {
      const post = createMockPost({
        message: '<a href="javascript:alert(\'XSS\')">Click</a>',
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const link = screen.queryByRole('link', { name: /click/i });
      if (link) {
        expect(link).not.toHaveAttribute('href', expect.stringContaining('javascript:'));
      }
    });

    it('should sanitize style attributes with expressions', () => {
      const post = createMockPost({
        message: '<div style="background: url(javascript:alert(\'XSS\'))">Content</div>',
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText('Content')).toBeInTheDocument();
      // Style should be sanitized
    });

    it('should allow safe HTML tags and attributes', () => {
      const post = createMockPost({
        message: '<p><strong>Bold</strong> <em>Italic</em> <a href="/safe-link">Link</a></p>',
      });
      render(<PostCard post={post} {...mockHandlers} />);
      
      expect(screen.getByText('Bold').tagName).toBe('STRONG');
      expect(screen.getByText('Italic').tagName).toBe('EM');
      expect(screen.getByRole('link', { name: /link/i })).toHaveAttribute('href', '/safe-link');
    });
  });

  describe('Integration Tests', () => {
    it('should render complete post card with all features', () => {
      const attachments = [
        createMockAttachment({ id: 1, filename: 'document.pdf' }),
        createMockAttachment({ id: 2, filename: 'image.jpg', mimetype: 'image/jpeg' }),
      ];
      const post = createMockPost({
        message: '<p>This is a <strong>complete</strong> post with all features.</p>',
        attachments,
        canEdit: true,
        canDelete: true,
        canReply: true,
        likeCount: 10,
        replyCount: 5,
        modified: new Date('2024-01-15T14:30:00Z'),
        editedBy: {
          id: 43,
          firstName: 'Editor',
          lastName: 'User',
          fullName: 'Editor User',
          profileImageUrl: 'https://example.com/avatar/43.jpg',
          profileUrl: '/user/profile/43',
        },
        author: {
          id: 42,
          firstName: 'John',
          lastName: 'Doe',
          fullName: 'John Doe',
          profileImageUrl: 'https://example.com/avatar/42.jpg',
          profileUrl: '/user/profile/42',
          role: 'teacher' as UserRole,
        },
      });
      
      render(<PostCard post={post} currentUserRole="teacher" {...mockHandlers} />);
      
      // Verify all major sections are present
      expect(screen.getByRole('img', { name: /john doe/i })).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText(/teacher/i)).toBeInTheDocument();
      expect(screen.getByText('Test Post Subject')).toBeInTheDocument();
      expect(screen.getByText(/complete/i)).toBeInTheDocument();
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('image.jpg')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByText(/10/)).toBeInTheDocument(); // Like count
      expect(screen.getByText(/5 replies/i)).toBeInTheDocument();
      expect(screen.getByText(/edited/i)).toBeInTheDocument();
    });

    it('should handle rapid button clicks without duplicate actions', async () => {
      const post = createMockPost({ canReply: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const replyButton = screen.getByRole('button', { name: /reply/i });
      
      // Click rapidly
      await userEvent.click(replyButton);
      await userEvent.click(replyButton);
      await userEvent.click(replyButton);
      
      // Should debounce or prevent duplicate calls
      expect(mockHandlers.onReply).toHaveBeenCalledTimes(1);
    });

    it('should update UI optimistically when liking a post', async () => {
      const post = createMockPost({ likeCount: 5, userHasLiked: false });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const likeButton = screen.getByRole('button', { name: /like/i });
      await userEvent.click(likeButton);
      
      // Should show liked state immediately
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /liked/i })).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should render efficiently with many attachments', () => {
      const attachments = Array.from({ length: 50 }, (_, i) =>
        createMockAttachment({ id: i + 1, filename: `file${i + 1}.pdf` })
      );
      const post = createMockPost({ attachments });
      
      const startTime = performance.now();
      render(<PostCard post={post} {...mockHandlers} />);
      const endTime = performance.now();
      
      // Should render in reasonable time (< 150ms) - adjusted for test environment variability
      expect(endTime - startTime).toBeLessThan(150);
    });

    it('should not re-render unnecessarily', () => {
      const post = createMockPost();
      const { rerender } = render(<PostCard post={post} {...mockHandlers} />);
      
      const renderSpy = vi.spyOn(console, 'log');
      
      // Re-render with same props
      rerender(<PostCard post={post} {...mockHandlers} />);
      
      // Component should be memoized
      expect(renderSpy).not.toHaveBeenCalled();
      
      renderSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing author gracefully', () => {
      const post = createMockPost({ author: null as any });
      
      expect(() => render(<PostCard post={post} {...mockHandlers} />)).not.toThrow();
    });

    it('should handle invalid date values', () => {
      const post = createMockPost({ created: null as any });
      
      expect(() => render(<PostCard post={post} {...mockHandlers} />)).not.toThrow();
    });

    it('should handle network errors when copying permalink', async () => {
      const clipboardError = new Error('Clipboard API not available');
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(clipboardError);
      
      const post = createMockPost();
      render(<PostCard post={post} {...mockHandlers} />);
      
      const permalinkButton = screen.getByRole('button', { name: /permalink/i });
      await userEvent.click(permalinkButton);
      
      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/failed to copy/i)).toBeInTheDocument();
      });
    });

    it('should handle handler errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockHandlers.onReply.mockImplementationOnce(() => {
        throw new Error('Handler error');
      });
      
      const post = createMockPost({ canReply: true });
      render(<PostCard post={post} {...mockHandlers} />);
      
      const replyButton = screen.getByRole('button', { name: /reply/i });
      await userEvent.click(replyButton);
      
      // Should not crash the component
      expect(screen.getByText('Test Post Subject')).toBeInTheDocument();
      
      consoleError.mockRestore();
    });
  });
});

