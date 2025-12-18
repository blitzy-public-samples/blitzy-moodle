/**
 * PostCard Component
 *
 * Individual forum post display component showing post content with rich text
 * formatting, author information, timestamps, ratings, action buttons, and
 * file attachments. Implements WCAG 2.1 AA accessibility features.
 *
 * @module features/activities/forums/components/PostCard
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Avatar,
  Button,
  IconButton,
  Chip,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Rating,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Link as MuiLink,
  useTheme,
  useMediaQuery,
  Fade,
} from '@mui/material';
import {
  Reply as ReplyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  ThumbUp as ThumbUpIcon,
  ThumbUpOutlined as ThumbUpOutlinedIcon,
  AttachFile,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  Flag as ReportIcon,
  Link as LinkIcon,
  FormatQuote as QuoteIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  CallSplit as SplitIcon,
  DriveFileMove as MoveIcon,
  FolderZip as ZipIcon,
  HourglassEmpty as PendingIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { formatDistanceToNow, format } from 'date-fns';
import DOMPurify from 'dompurify';

import { useDeletePost } from '../hooks/useDiscussion';
import type { PostCardProps, PostAuthor, PostAttachment } from '../types/forum.types';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum message length before showing expand/collapse */
const MAX_MESSAGE_LENGTH = 500;

/** DOMPurify configuration for safe HTML rendering */
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'blockquote', 'pre', 'code',
    'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'sub', 'sup',
  ] as string[],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'target', 'rel',
    'width', 'height', 'style', 'colspan', 'rowspan',
  ] as string[],
  ALLOW_DATA_ATTR: false,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get initials from a full name for avatar display
 */
const getInitials = (fullname: string): string => {
  if (!fullname) return '?';
  const names = fullname.trim().split(/\s+/);
  const firstName = names[0];
  const lastName = names[names.length - 1];
  
  if (!firstName) return '?';
  
  if (names.length >= 2 && lastName) {
    const firstInitial = firstName[0] ?? '';
    const lastInitial = lastName[0] ?? '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
  }
  return firstName.substring(0, 2).toUpperCase();
};

/**
 * Format file size in human-readable format
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

/**
 * Get appropriate icon for file type based on MIME type
 */
/**
 * Get file icon and testid based on mimetype
 * Returns [icon element, testId]
 */
const getFileIconWithTestId = (mimetype: string): [React.ReactNode, string] => {
  if (mimetype.startsWith('image/')) {
    return [<ImageIcon fontSize="small" color="primary" />, 'attachment-icon-image'];
  }
  if (mimetype === 'application/pdf') {
    return [<PdfIcon fontSize="small" color="error" />, 'attachment-icon-pdf'];
  }
  if (mimetype.includes('zip') || mimetype.includes('compressed')) {
    return [<ZipIcon fontSize="small" color="warning" />, 'attachment-icon-zip'];
  }
  if (
    mimetype.includes('document') ||
    mimetype.includes('word') ||
    mimetype.includes('text')
  ) {
    return [<DocIcon fontSize="small" color="info" />, 'attachment-icon-doc'];
  }
  return [<FileIcon fontSize="small" color="action" />, 'attachment-icon-file'];
};

/**
 * Check if mimetype is an image type
 */
const isImageMimetype = (mimetype: string): boolean => {
  return mimetype.startsWith('image/');
};

/**
 * Generate profile image URL from PostAuthor object
 */
const getAuthorImageUrl = (author: PostAuthor | null): string | undefined => {
  if (!author) return undefined;
  return author.profileImageUrl || undefined;
};

/**
 * Generate profile page URL from PostAuthor object
 */
const getAuthorProfileUrl = (author: PostAuthor | null): string => {
  if (!author) return '/user/profile.php';
  return author.profileUrl || `/user/profile.php?id=${author.id}`;
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PostCard Component
 *
 * Displays an individual forum post with all associated metadata, actions,
 * and accessibility features. Supports rich text content display with XSS
 * protection, file attachments, ratings, and moderation actions.
 *
 * @param props - Component props conforming to PostCardProps interface
 * @returns React component rendering a forum post card
 */
function PostCard({
  post,
  onReply,
  onEdit,
  onDelete,
  onRate,
  // Additional feature handlers
  onReport,
  onLike,
  onQuote,
  onApprove,
  onReject,
  onSplit,
  onMove,
}: PostCardProps): React.ReactElement {
  // Extract author from post for convenience with fallback for missing author
  const author = post.author;
  const authorName = author?.fullName || 'Unknown User';
  const authorProfileUrl = getAuthorProfileUrl(author);
  const authorImageUrl = getAuthorImageUrl(author);

  // Determine if this is the first post in discussion (no parent)
  const isFirstPost = post.parentId === null;

  // Get permissions from post object
  const canEdit = post.canEdit;
  const canDelete = post.canDelete;
  const canReply = post.canReply;
  const canRate = post.canRate;
  // Note: canSplit, canExport, canControlReadTracking are reserved for future moderation features

  // Theme and responsive hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Permission checking hook
  const { hasCapability } = usePermissions();

  // Toast notification hook
  const toast = useToast();

  // Delete mutation hook - requires discussionId for cache invalidation
  const deletePostMutation = useDeletePost(post.discussionId);

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  /** Menu anchor element for more actions */
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  /** Whether post content is expanded */
  const [expanded, setExpanded] = useState<boolean>(false);

  /** Delete confirmation dialog state */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);

  /** Optimistic like state */
  const [isLiked, setIsLiked] = useState<boolean>(post.userHasLiked);
  const [likeCount, setLikeCount] = useState<number>(post.likeCount || 0);

  /** Current rating value */
  const [currentRating, setCurrentRating] = useState<number | null>(null);

  /** Hover rating for preview */
  const [hoverRating, setHoverRating] = useState<number>(-1);

  /** Status announcement for screen readers */
  const [statusAnnouncement, setStatusAnnouncement] = useState<string>('');

  /** Error message state for inline display */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  /** Check if message is long enough to need expand/collapse */
  const isLongMessage = useMemo(() => {
    return post.message.length > MAX_MESSAGE_LENGTH;
  }, [post.message]);

  /** Sanitized HTML content for safe rendering */
  const sanitizedMessage = useMemo(() => {
    return DOMPurify.sanitize(post.message, DOMPURIFY_CONFIG);
  }, [post.message]);

  /** Message to display (truncated or full) */
  const displayMessage = useMemo(() => {
    if (!isLongMessage || expanded) {
      return sanitizedMessage;
    }
    // Truncate at word boundary
    const truncated = post.message.substring(0, MAX_MESSAGE_LENGTH);
    const lastSpace = truncated.lastIndexOf(' ');
    const cleanTruncated = lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
    return DOMPurify.sanitize(cleanTruncated + '...', DOMPURIFY_CONFIG);
  }, [sanitizedMessage, isLongMessage, expanded, post.message]);

  /** Formatted creation timestamp */
  const formattedTimestamp = useMemo(() => {
    try {
      return formatDistanceToNow(post.created, { addSuffix: true });
    } catch {
      return 'Unknown date';
    }
  }, [post.created]);

  /** Formatted modification timestamp */
  const formattedModifiedTimestamp = useMemo(() => {
    if (!post.modified) {
      return null;
    }
    try {
      return format(post.modified, 'PPpp');
    } catch {
      return null;
    }
  }, [post.modified]);

  /** Whether current user is the author (determined by canEdit permission) */
  const isOwnPost = useMemo(() => {
    // If user can edit but doesn't have editanypost capability, they're likely the author
    return canEdit && !hasCapability('mod/forum:editanypost');
  }, [canEdit, hasCapability]);

  /** Check if user can edit any post (moderator capability) */
  const canEditAnyPost = useMemo(() => {
    return hasCapability('mod/forum:editanypost');
  }, [hasCapability]);

  /** Check if user can delete any post (moderator capability) */
  const canDeleteAnyPost = useMemo(() => {
    return hasCapability('mod/forum:deleteanypost');
  }, [hasCapability]);

  /** Effective edit permission (prop or capability) */
  const effectiveCanEdit = useMemo(() => {
    return canEdit || canEditAnyPost;
  }, [canEdit, canEditAnyPost]);

  /** Effective delete permission (prop or capability) */
  const effectiveCanDelete = useMemo(() => {
    return canDelete || canDeleteAnyPost;
  }, [canDelete, canDeleteAnyPost]);

  /** Check if post is a private reply */
  const isPrivateReply = useMemo(() => {
    return post.privateReplyTo !== null && post.privateReplyTo > 0;
  }, [post.privateReplyTo]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /** Open more actions menu */
  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  }, []);

  /** Close more actions menu */
  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  /** Toggle content expansion */
  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  /** Handle reply action */
  const handleReply = useCallback(() => {
    handleMenuClose();
    if (onReply) {
      try {
        onReply(post.id);
      } catch (error) {
        console.error('Error in reply handler:', error);
      }
    }
  }, [onReply, post.id, handleMenuClose]);

  /** Handle edit action */
  const handleEdit = useCallback(() => {
    handleMenuClose();
    if (onEdit) {
      try {
        onEdit(post);
      } catch (error) {
        console.error('Error in edit handler:', error);
      }
    }
  }, [onEdit, post, handleMenuClose]);

  /** Open delete confirmation dialog */
  const handleDeleteClick = useCallback(() => {
    handleMenuClose();
    setDeleteDialogOpen(true);
  }, [handleMenuClose]);

  /** Cancel delete action */
  const handleDeleteCancel = useCallback(() => {
    setDeleteDialogOpen(false);
  }, []);

  /** Confirm and execute delete action */
  const handleDeleteConfirm = useCallback(async () => {
    setDeleteDialogOpen(false);

    try {
      // Use the useDeletePost mutation hook - pass just the postId
      await deletePostMutation.mutateAsync(post.id);

      toast.success('Post deleted successfully');

      // Also call the callback if provided
      if (onDelete) {
        onDelete(post.id);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete post';
      toast.error(errorMessage);
    }
  }, [deletePostMutation, post.id, toast, onDelete]);

  /** Handle like/unlike toggle */
  const handleLikeToggle = useCallback(() => {
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    // Optimistic update for like count
    const newCount = newLikedState ? likeCount + 1 : Math.max(0, likeCount - 1);
    setLikeCount(newCount);
    // Set status announcement for screen readers
    setStatusAnnouncement(newLikedState ? `Liked. ${newCount} likes.` : `Unliked. ${newCount} likes.`);
    // Call onLike handler if provided
    if (onLike) {
      try {
        onLike(post.id);
      } catch (error) {
        console.error('Error in like handler:', error);
      }
    }
  }, [isLiked, likeCount, onLike, post.id]);

  /** Handle copying permalink to clipboard */
  const handleCopyPermalink = useCallback(async () => {
    const permalink = `${window.location.origin}/mod/forum/discuss.php?d=${post.discussionId}#p${post.id}`;
    try {
      setErrorMessage(null);
      await navigator.clipboard.writeText(permalink);
      toast.success('Permalink copied to clipboard');
    } catch (error) {
      const message = 'Failed to copy permalink';
      setErrorMessage(message);
      toast.error(message);
    }
  }, [post.id, post.discussionId, toast]);

  /** Handle rating change */
  const handleRatingChange = useCallback(
    (_event: React.SyntheticEvent, newValue: number | null) => {
      if (!canRate || newValue === null) return;

      setCurrentRating(newValue);
      if (onRate) {
        try {
          onRate(post.id, newValue);
          toast.success(`Rated ${newValue} stars`);
        } catch (error) {
          console.error('Error in rate handler:', error);
        }
      }
    },
    [canRate, onRate, post.id, toast]
  );

  // ============================================================================
  // RENDER: DELETED POST
  // ============================================================================

  // Handle deleted posts - show placeholder
  if (post.deleted) {
    return (
      <Card
        sx={{ mb: 2, opacity: 0.7 }}
        role="article"
        aria-label="Deleted post"
        data-post-id={post.id}
        data-testid={`post-card-${post.id}`}
        className={isMobile ? 'mobile-layout' : 'desktop-layout'}
      >
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: 'grey.400' }}>
              <DeleteIcon />
            </Avatar>
            <Box>
              <Typography variant="body1" color="text.secondary">
                This post has been deleted
              </Typography>
              {post.deletedBy && (
                <Typography variant="caption" color="text.secondary">
                  Deleted by {post.deletedBy.fullName}
                  {post.deletedAt && ` on ${format(post.deletedAt, 'PPpp')}`}
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        mb: 2,
        position: 'relative',
        borderLeft: isFirstPost ? `4px solid ${theme.palette.primary.main}` : undefined,
        ...(isPrivateReply && {
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(255, 152, 0, 0.08)'
            : 'rgba(255, 152, 0, 0.04)',
          borderLeft: `4px solid ${theme.palette.warning.main}`,
        }),
      }}
      className={isMobile ? 'mobile-layout' : 'desktop-layout'}
      role="article"
      aria-label={`Post by ${authorName}`}
      data-post-id={post.id}
      data-testid={`post-card-${post.id}`}
    >
      {/* Status Announcement for Screen Readers */}
      {statusAnnouncement && (
        <Box
          role="status"
          aria-live="polite"
          sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)' }}
        >
          {statusAnnouncement}
        </Box>
      )}

      {/* Error Message Display */}
      {errorMessage && (
        <Box
          role="alert"
          sx={{
            p: 1,
            mb: 1,
            backgroundColor: 'error.light',
            borderRadius: 1,
            color: 'error.contrastText',
          }}
        >
          <Typography variant="body2">{errorMessage}</Typography>
        </Box>
      )}

      <CardContent>
        {/* Pending Approval Indicator */}
        {post.isPending && !post.moderatorApproved && (
          <Chip
            icon={<PendingIcon />}
            label="Pending Approval"
            size="small"
            color="warning"
            sx={{ mb: 1 }}
            aria-label="This post is pending approval"
          />
        )}

        {/* Private Reply Indicator */}
        {isPrivateReply && (
          <Chip
            label="Private Reply"
            size="small"
            color="warning"
            sx={{ mb: 1, ml: post.isPending ? 1 : 0 }}
            aria-label="This is a private reply"
          />
        )}

        {/* Author Section */}
        <Box
          display="flex"
          alignItems="flex-start"
          gap={2}
          mb={2}
        >
          {/* Avatar */}
          <MuiLink
            href={authorProfileUrl}
            sx={{ textDecoration: 'none' }}
            aria-label={`View ${authorName}'s profile`}
          >
            {authorImageUrl ? (
              <Avatar
                src={authorImageUrl}
                alt={authorName}
                sx={{
                  width: isMobile ? 40 : 48,
                  height: isMobile ? 40 : 48,
                }}
              />
            ) : (
              <Avatar
                data-testid="default-avatar"
                alt={authorName}
                sx={{
                  width: isMobile ? 40 : 48,
                  height: isMobile ? 40 : 48,
                  bgcolor: 'primary.main',
                }}
              >
                {getInitials(authorName) || <PersonIcon />}
              </Avatar>
            )}
          </MuiLink>

          {/* Author Info */}
          <Box flex={1} minWidth={0}>
            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              <MuiLink
                href={authorProfileUrl}
                sx={{ textDecoration: 'none', color: 'inherit' }}
              >
                <Typography
                  variant="subtitle1"
                  component="span"
                  fontWeight="bold"
                  sx={{
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  {authorName}
                </Typography>
              </MuiLink>

              {isFirstPost && (
                <Chip
                  label="Author"
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}

              {isOwnPost && (
                <Chip
                  label="You"
                  size="small"
                  color="secondary"
                  variant="outlined"
                />
              )}

              {/* Author Role Badge */}
              {author?.role && (
                <Chip
                  data-testid="role-badge"
                  label={author.role}
                  size="small"
                  color={
                    author.role === 'teacher' ? 'success' :
                    author.role === 'moderator' ? 'info' :
                    'default'
                  }
                  variant="outlined"
                />
              )}

              {/* Unread Indicator */}
              {post.unread && (
                <Chip
                  data-testid="unread-indicator"
                  label="New"
                  size="small"
                  color="error"
                  sx={{ fontWeight: 'bold' }}
                />
              )}
            </Box>

            {/* Timestamp */}
            <Typography variant="caption" color="text.secondary" component="div">
              {formattedTimestamp}
              {formattedModifiedTimestamp && (
                <span>
                  {' • '}
                  <Tooltip title={`Edited ${formattedModifiedTimestamp}`}>
                    <span style={{ cursor: 'help' }}>
                      Edited{post.editedBy && ` by ${post.editedBy.fullName}`}
                    </span>
                  </Tooltip>
                  {' • '}
                  <MuiLink
                    href={`/mod/forum/post.php?edit=${post.id}&history=1`}
                    sx={{ 
                      color: 'inherit',
                      textDecoration: 'underline',
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    edit history
                  </MuiLink>
                </span>
              )}
            </Typography>
          </Box>

          {/* More Actions Menu Button */}
          <IconButton
            aria-label="More actions"
            aria-controls={menuAnchor ? 'post-actions-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={Boolean(menuAnchor)}
            onClick={handleMenuOpen}
            size="small"
          >
            <MoreVertIcon />
          </IconButton>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Post Subject */}
        <Typography
          variant="h6"
          component="h3"
          gutterBottom
          sx={{ wordBreak: 'break-word' }}
        >
          {post.subject}
        </Typography>

        {/* Post Content */}
        {post.message ? (
          <Box
            sx={{
              '& img': {
                maxWidth: '100%',
                height: 'auto',
                borderRadius: 1,
              },
              '& pre': {
                backgroundColor: 'action.hover',
                padding: 2,
                borderRadius: 1,
                overflowX: 'auto',
              },
              '& code': {
                backgroundColor: 'action.hover',
                padding: '2px 4px',
                borderRadius: 0.5,
                fontFamily: 'monospace',
              },
              '& blockquote': {
                borderLeft: `4px solid ${theme.palette.divider}`,
                margin: '16px 0',
                paddingLeft: 2,
                color: 'text.secondary',
              },
              '& a': {
                color: theme.palette.primary.main,
              },
              '& table': {
                borderCollapse: 'collapse',
                width: '100%',
                '& th, & td': {
                  border: `1px solid ${theme.palette.divider}`,
                  padding: 1,
                },
              },
            }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: displayMessage }}
              aria-label="Post content"
            />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" fontStyle="italic">
            No content
          </Typography>
        )}

        {/* Expand/Collapse Button */}
        {isLongMessage && (
          <Fade in>
            <Button
              size="small"
              startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={handleToggleExpand}
              sx={{ mt: 1 }}
              aria-expanded={expanded}
              aria-controls={`post-content-${post.id}`}
            >
              {expanded ? 'Show less' : 'Show more'}
            </Button>
          </Fade>
        )}

        {/* Attachments Section */}
        {post.attachments && post.attachments.length > 0 && (
          <AttachmentsSection
            postId={post.id}
            attachments={post.attachments}
            // Note: Actual attachments would be fetched or passed separately
          />
        )}

        {/* Star Rating Section - Display average rating and user rating */}
        {post.rating !== undefined && post.rating !== null && (
          <Box mt={2} display="flex" alignItems="center" gap={2} flexWrap="wrap">
            {/* Average Post Rating */}
            <Box display="flex" alignItems="center" gap={0.5} data-testid="post-rating">
              <Rating
                value={post.rating}
                readOnly
                precision={0.5}
                size="small"
                emptyIcon={<StarBorderIcon fontSize="inherit" />}
                icon={<StarIcon fontSize="inherit" />}
                aria-label={`Average rating: ${post.rating} stars`}
              />
              <Typography variant="body2" color="text.secondary">
                {post.rating}
              </Typography>
            </Box>

            {/* User's Rating (if exists) */}
            {post.userRating !== undefined && post.userRating !== null && (
              <Box display="flex" alignItems="center" gap={0.5} data-testid="user-rating">
                <Typography variant="caption" color="text.secondary">
                  Your rating:
                </Typography>
                <Rating
                  value={post.userRating}
                  readOnly
                  precision={1}
                  size="small"
                  emptyIcon={<StarBorderIcon fontSize="inherit" />}
                  icon={<StarIcon fontSize="inherit" />}
                  aria-label={`Your rating: ${post.userRating} stars`}
                />
              </Box>
            )}
          </Box>
        )}

        {/* Interactive Rating Section - Only for users who can rate */}
        {canRate && (
          <Box mt={2} display="flex" alignItems="center" gap={1}>
            <Typography variant="body2" color="text.secondary">
              Rate this post:
            </Typography>
            <Rating
              value={currentRating}
              onChange={handleRatingChange}
              onChangeActive={(_, newHover) => setHoverRating(newHover)}
              precision={1}
              size="small"
              emptyIcon={<StarBorderIcon fontSize="inherit" />}
              icon={<StarIcon fontSize="inherit" />}
              aria-label="Rate this post"
            />
            {hoverRating !== -1 && (
              <Typography variant="caption" color="text.secondary">
                {hoverRating} star{hoverRating !== 1 ? 's' : ''}
              </Typography>
            )}
          </Box>
        )}
      </CardContent>

      <Divider />

      {/* Action Buttons */}
      <CardActions
        data-testid="action-buttons"
        className={isMobile ? 'vertical' : 'horizontal'}
        sx={{
          justifyContent: 'flex-start',
          flexWrap: 'wrap',
          gap: 1,
          px: 2,
          ...(isMobile && {
            flexDirection: 'column',
            alignItems: 'flex-start',
          }),
        }}
      >
        {/* Like Button with Count */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title={isLiked ? 'Unlike' : 'Like'}>
            <IconButton
              onClick={handleLikeToggle}
              color={isLiked ? 'primary' : 'default'}
              className={isLiked ? 'liked' : ''}
              aria-label={isLiked ? 'Liked' : 'Like this post'}
              aria-pressed={isLiked}
              size="small"
            >
              {isLiked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
            </IconButton>
          </Tooltip>
          {likeCount > 0 && (
            <Typography variant="body2" color="text.secondary">
              {likeCount}
            </Typography>
          )}
        </Box>

        {/* Reply Count Badge */}
        {post.replyCount > 0 && (
          <Chip
            size="small"
            variant="outlined"
            label={`${post.replyCount} ${post.replyCount === 1 ? 'reply' : 'replies'}`}
            sx={{ ml: 1 }}
          />
        )}

        {/* Reply Button */}
        {canReply && onReply && (
          <Button
            startIcon={<ReplyIcon />}
            onClick={handleReply}
            size="small"
            aria-label="Reply to this post"
          >
            Reply
          </Button>
        )}

        {/* Edit Button (visible on larger screens) */}
        {effectiveCanEdit && onEdit && !isMobile && (
          <Button
            startIcon={<EditIcon />}
            onClick={handleEdit}
            size="small"
            aria-label="Edit this post"
          >
            Edit
          </Button>
        )}

        {/* Delete Button (visible on larger screens) */}
        {effectiveCanDelete && !isMobile && (
          <Button
            startIcon={<DeleteIcon />}
            onClick={handleDeleteClick}
            size="small"
            color="error"
            aria-label="Delete this post"
          >
            Delete
          </Button>
        )}

        {/* Quote Button */}
        {onQuote && (
          <Button
            startIcon={<QuoteIcon />}
            onClick={() => {
              try {
                onQuote(post.id);
              } catch (error) {
                console.error('Error in quote handler:', error);
              }
            }}
            size="small"
            aria-label="Quote this post"
          >
            Quote
          </Button>
        )}

        {/* Permalink Button */}
        <Button
          startIcon={<LinkIcon />}
          onClick={handleCopyPermalink}
          size="small"
          aria-label="Copy permalink"
        >
          Permalink
        </Button>

        {/* Report Button */}
        {onReport && (
          <Button
            startIcon={<ReportIcon />}
            onClick={() => {
              try {
                onReport(post.id);
              } catch (error) {
                console.error('Error in report handler:', error);
              }
            }}
            size="small"
            aria-label="Report this post"
          >
            Report
          </Button>
        )}

        {/* Moderator Controls - only shown for pending posts and users with moderator permissions */}
        {post.isPending && post.canSplit && (
          <>
            {onApprove && (
              <Button
                startIcon={<ApproveIcon />}
                onClick={() => {
                  try {
                    onApprove(post.id);
                  } catch (error) {
                    console.error('Error in approve handler:', error);
                  }
                }}
                size="small"
                color="success"
                aria-label="Approve this post"
              >
                Approve
              </Button>
            )}
            {onReject && (
              <Button
                startIcon={<RejectIcon />}
                onClick={() => {
                  try {
                    onReject(post.id);
                  } catch (error) {
                    console.error('Error in reject handler:', error);
                  }
                }}
                size="small"
                color="error"
                aria-label="Reject this post"
              >
                Reject
              </Button>
            )}
          </>
        )}

        {/* Split Button - for moderators */}
        {post.canSplit && onSplit && (
          <Button
            startIcon={<SplitIcon />}
            onClick={() => {
              try {
                onSplit(post.id);
              } catch (error) {
                console.error('Error in split handler:', error);
              }
            }}
            size="small"
            aria-label="Split this post"
          >
            Split
          </Button>
        )}

        {/* Move Button - for moderators */}
        {post.canSplit && onMove && (
          <Button
            startIcon={<MoveIcon />}
            onClick={() => {
              try {
                onMove(post.id);
              } catch (error) {
                console.error('Error in move handler:', error);
              }
            }}
            size="small"
            aria-label="Move this post"
          >
            Move
          </Button>
        )}
      </CardActions>

      {/* More Actions Menu */}
      <Menu
        id="post-actions-menu"
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        MenuListProps={{
          'aria-labelledby': 'post-actions-button',
        }}
      >
        {canReply && onReply && (
          <MenuItem onClick={handleReply}>
            <ListItemIcon>
              <ReplyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Reply</ListItemText>
          </MenuItem>
        )}

        {effectiveCanEdit && onEdit && (
          <MenuItem onClick={handleEdit}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
        )}

        {effectiveCanDelete && (
          <MenuItem onClick={handleDeleteClick}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete this post? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} autoFocus>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            disabled={deletePostMutation.isPending}
          >
            {deletePostMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

/**
 * Props for AttachmentsSection subcomponent
 */
interface AttachmentsSectionProps {
  /** Post ID for data attributes */
  postId: number;
  /** List of file attachments */
  attachments: PostAttachment[];
}

/**
 * AttachmentsSection Subcomponent
 *
 * Displays file attachments with download links, thumbnails for images,
 * file metadata, and "Download all as ZIP" option for multiple files
 */
function AttachmentsSection({
  postId,
  attachments,
}: AttachmentsSectionProps): React.ReactElement | null {
  if (attachments.length === 0) {
    // Placeholder for when attachments aren't loaded yet
    return (
      <Box mt={2}>
        <Divider sx={{ mb: 2 }} />
        <Box display="flex" alignItems="center" gap={1}>
          <AttachFile fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            This post has attachments
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box mt={2} data-testid={`attachments-${postId}`}>
      <Divider sx={{ mb: 2 }} />
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle2" color="text.secondary">
          Attachments ({attachments.length})
        </Typography>

        {/* Download all as ZIP option for multiple attachments */}
        {attachments.length > 1 && (
          <Button
            startIcon={<ZipIcon />}
            size="small"
            variant="outlined"
            aria-label="Download all as ZIP"
            onClick={() => {
              window.location.href = `/mod/forum/post.php?id=${postId}&download=all`;
            }}
          >
            Download all as ZIP
          </Button>
        )}
      </Box>

      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {attachments.map((attachment) => {
          const [icon, testId] = getFileIconWithTestId(attachment.mimetype);
          const isImage = isImageMimetype(attachment.mimetype);

          return (
            <Box
              component="li"
              key={attachment.id}
              display="flex"
              alignItems="center"
              gap={1}
              py={0.5}
            >
              {/* Thumbnail for images, icon for other file types */}
              {isImage ? (
                <Box data-testid={testId}>
                  <Box
                    component="img"
                    src={attachment.fileurl}
                    alt={attachment.filename}
                    sx={{
                      width: 48,
                      height: 48,
                      objectFit: 'cover',
                      borderRadius: 1,
                    }}
                  />
                </Box>
              ) : (
                <Box data-testid={testId}>
                  {icon}
                </Box>
              )}

              <Box flex={1} minWidth={0}>
                <Typography
                  variant="body2"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {attachment.filename}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(attachment.filesize)}
                </Typography>
              </Box>

              <Tooltip title={`Download ${attachment.filename}`}>
                <IconButton
                  component="a"
                  href={attachment.fileurl}
                  download={attachment.filename}
                  size="small"
                  aria-label={`Download ${attachment.filename}`}
                >
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default PostCard;
