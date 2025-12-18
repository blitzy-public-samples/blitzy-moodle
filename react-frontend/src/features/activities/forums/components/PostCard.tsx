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
} from '@mui/icons-material';
import { formatDistanceToNow, format } from 'date-fns';
import DOMPurify from 'dompurify';

import { useDeletePost } from '../hooks/useDiscussion';
import type { PostCardProps, Author, PostAttachment } from '../types/forum.types';
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
const getFileIcon = (mimetype: string): React.ReactNode => {
  if (mimetype.startsWith('image/')) {
    return <ImageIcon fontSize="small" color="primary" />;
  }
  if (mimetype === 'application/pdf') {
    return <PdfIcon fontSize="small" color="error" />;
  }
  if (
    mimetype.includes('document') ||
    mimetype.includes('word') ||
    mimetype.includes('text')
  ) {
    return <DocIcon fontSize="small" color="info" />;
  }
  return <FileIcon fontSize="small" color="action" />;
};

/**
 * Generate profile image URL from Author object
 */
const getAuthorImageUrl = (author: Author): string | undefined => {
  if (author.deleted) return undefined;
  if (author.pictureitemid > 0) {
    // Construct Moodle user picture URL
    return `/user/pix.php/${author.id}/f1.jpg`;
  }
  return undefined;
};

/**
 * Generate profile page URL from Author object
 */
const getAuthorProfileUrl = (author: Author): string => {
  return `/user/profile.php?id=${author.id}`;
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
  author,
  isFirstPost,
  userid,
  canEdit,
  canDelete,
  canReply,
  canRate,
  onReply,
  onEdit,
  onDelete,
  onRate,
}: PostCardProps): React.ReactElement {
  // Theme and responsive hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Permission checking hook
  const { hasCapability } = usePermissions();

  // Toast notification hook
  const toast = useToast();

  // Delete mutation hook - requires discussionId for cache invalidation
  const deletePostMutation = useDeletePost(post.discussionid);

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
  const [isLiked, setIsLiked] = useState<boolean>(false);

  /** Current rating value */
  const [currentRating, setCurrentRating] = useState<number | null>(null);

  /** Hover rating for preview */
  const [hoverRating, setHoverRating] = useState<number>(-1);

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
      return formatDistanceToNow(new Date(post.timecreated * 1000), { addSuffix: true });
    } catch {
      return 'Unknown date';
    }
  }, [post.timecreated]);

  /** Formatted modification timestamp */
  const formattedModifiedTimestamp = useMemo(() => {
    if (!post.timemodified || post.timemodified === post.timecreated) {
      return null;
    }
    try {
      return format(new Date(post.timemodified * 1000), 'PPpp');
    } catch {
      return null;
    }
  }, [post.timemodified, post.timecreated]);

  /** Whether current user is the author */
  const isOwnPost = useMemo(() => {
    return post.authorid === userid;
  }, [post.authorid, userid]);

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
    return post.privatereplyto > 0;
  }, [post.privatereplyto]);

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
      onReply(post.id);
    }
  }, [onReply, post.id, handleMenuClose]);

  /** Handle edit action */
  const handleEdit = useCallback(() => {
    handleMenuClose();
    if (onEdit) {
      onEdit(post);
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
    setIsLiked((prev) => !prev);
    // Optimistic update - in real implementation would call API
  }, []);

  /** Handle rating change */
  const handleRatingChange = useCallback(
    (_event: React.SyntheticEvent, newValue: number | null) => {
      if (!canRate || newValue === null) return;

      setCurrentRating(newValue);
      if (onRate) {
        onRate(post.id, newValue);
        toast.success(`Rated ${newValue} stars`);
      }
    },
    [canRate, onRate, post.id, toast]
  );

  // ============================================================================
  // RENDER: DELETED POST
  // ============================================================================

  if (post.deleted) {
    return (
      <Card
        sx={{
          mb: 2,
          opacity: 0.6,
          backgroundColor: 'action.disabledBackground',
        }}
        role="article"
        aria-label="Deleted post"
      >
        <CardContent>
          <Typography variant="body2" color="text.secondary" fontStyle="italic">
            This post has been deleted.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // RENDER: MAIN COMPONENT
  // ============================================================================

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
      role="article"
      aria-label={`Post by ${author.fullname}`}
      data-post-id={post.id}
      data-testid={`post-card-${post.id}`}
    >
      <CardContent>
        {/* Private Reply Indicator */}
        {isPrivateReply && (
          <Chip
            label="Private Reply"
            size="small"
            color="warning"
            sx={{ mb: 1 }}
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
            href={getAuthorProfileUrl(author)}
            sx={{ textDecoration: 'none' }}
            aria-label={`View ${author.fullname}'s profile`}
          >
            <Avatar
              src={getAuthorImageUrl(author)}
              alt={author.fullname}
              sx={{
                width: isMobile ? 40 : 48,
                height: isMobile ? 40 : 48,
              }}
            >
              {getInitials(author.fullname)}
            </Avatar>
          </MuiLink>

          {/* Author Info */}
          <Box flex={1} minWidth={0}>
            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              <MuiLink
                href={getAuthorProfileUrl(author)}
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
                  {author.fullname}
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
            </Box>

            {/* Timestamp */}
            <Typography variant="caption" color="text.secondary" component="div">
              {formattedTimestamp}
              {formattedModifiedTimestamp && (
                <span>
                  {' • '}
                  <Tooltip title={`Edited ${formattedModifiedTimestamp}`}>
                    <span style={{ cursor: 'help' }}>(edited)</span>
                  </Tooltip>
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
        {post.hasattachments && (
          <AttachmentsSection
            postId={post.id}
            attachments={[]}
            // Note: Actual attachments would be fetched or passed separately
          />
        )}

        {/* Rating Section */}
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
              aria-label="Post rating"
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
        sx={{
          justifyContent: 'flex-start',
          flexWrap: 'wrap',
          gap: 1,
          px: 2,
        }}
      >
        {/* Like Button */}
        <Tooltip title={isLiked ? 'Unlike' : 'Like'}>
          <IconButton
            onClick={handleLikeToggle}
            color={isLiked ? 'primary' : 'default'}
            aria-label={isLiked ? 'Unlike this post' : 'Like this post'}
            aria-pressed={isLiked}
            size="small"
          >
            {isLiked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
          </IconButton>
        </Tooltip>

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
 * Displays file attachments with download links and file metadata
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
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Attachments ({attachments.length})
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {attachments.map((attachment) => (
          <Box
            component="li"
            key={attachment.id}
            display="flex"
            alignItems="center"
            gap={1}
            py={0.5}
          >
            {getFileIcon(attachment.mimetype)}
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
        ))}
      </Box>
    </Box>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default PostCard;
