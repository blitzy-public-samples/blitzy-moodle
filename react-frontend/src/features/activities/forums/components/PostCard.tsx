import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardActions,
  Avatar,
  Typography,
  IconButton,
  Button,
  Chip,
  Box,
  Divider,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Badge,
  Rating,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Reply as ReplyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Flag as FlagIcon,
  Link as LinkIcon,
  ThumbUp as ThumbUpIcon,
  ThumbUpOutlined as ThumbUpOutlinedIcon,
  FormatQuote as FormatQuoteIcon,
  Download as DownloadIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Description as DocumentIcon,
  Archive as ArchiveIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  CallSplit as CallSplitIcon,
  DriveFileMove as DriveFileMoveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import DOMPurify from 'dompurify';
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';
import { debounce } from 'lodash-es';
import type { ForumPost, UserRole } from '../types/forum.types';

/**
 * Props for PostCard component
 */
export interface PostCardProps {
  /** Post to display */
  post: ForumPost;
  /** Current user's role (student, teacher, moderator) */
  currentUserRole?: string;
  /** Callback when replying to post */
  onReply?: (postId: number) => void;
  /** Callback when editing post */
  onEdit?: (postId: number) => void;
  /** Callback when deleting post */
  onDelete?: (postId: number) => void;
  /** Callback when reporting post */
  onReport?: (postId: number) => void;
  /** Callback when liking/unliking post */
  onLike?: (postId: number) => void;
  /** Callback when quoting post */
  onQuote?: (postId: number) => void;
  /** Callback when approving post (moderator) */
  onApprove?: (postId: number) => void;
  /** Callback when rejecting post (moderator) */
  onReject?: (postId: number) => void;
  /** Callback when splitting post (moderator) */
  onSplit?: (postId: number) => void;
  /** Callback when moving post (moderator) */
  onMove?: (postId: number) => void;
}

/**
 * Get file icon based on MIME type
 */
const getFileIcon = (mimetype: string): React.ReactElement => {
  if (mimetype.startsWith('image/')) {
    return <ImageIcon data-testid="attachment-icon-image" />;
  }
  if (mimetype === 'application/pdf') {
    return <PdfIcon data-testid="attachment-icon-pdf" />;
  }
  return <DocumentIcon data-testid="attachment-icon-document" />;
};

/**
 * Format timestamp for display
 * Shows relative time for recent posts (last 7 days), absolute date for older posts
 */
const formatTimestamp = (date: Date): string => {
  try {
    // Validate the date
    if (!date || isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    const daysSincePost = differenceInDays(new Date(), date);
    
    if (daysSincePost <= 7) {
      // Recent posts: show relative time
      return formatDistanceToNow(date, { addSuffix: true });
    } else {
      // Older posts: show absolute date
      return format(date, 'MMM d, yyyy');
    }
  } catch (error) {
    // Handle any date formatting errors gracefully
    return 'Invalid date';
  }
};

/**
 * Format file size for display
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  // For MB and GB, always show one decimal place
  if (i >= 2) {
    return size.toFixed(1) + ' ' + sizes[i];
  }
  return Math.round(size * 100) / 100 + ' ' + sizes[i];
};

/**
 * Get role badge color
 */
const getRoleBadgeColor = (role: UserRole): 'primary' | 'secondary' | 'success' => {
  switch (role) {
    case 'teacher':
      return 'primary';
    case 'moderator':
      return 'success';
    case 'student':
    default:
      return 'secondary';
  }
};

/**
 * Extract initials from full name for default avatar
 */
const getInitials = (fullName: string): string => {
  const names = fullName.trim().split(/\s+/).filter(n => n.length > 0);
  if (names.length === 0) return '?';
  if (names.length === 1) {
    const first = names[0];
    return first ? first.charAt(0).toUpperCase() : '?';
  }
  const first = names[0];
  const last = names[names.length - 1];
  return first && last ? (first.charAt(0) + last.charAt(0)).toUpperCase() : '?';
};

/**
 * PostCard component
 * Displays a single forum post with author info, content, attachments, and actions
 */
const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserRole,
  onReply,
  onEdit,
  onDelete,
  onReport,
  onLike,
  onQuote,
  onApprove,
  onReject,
  onSplit,
  onMove,
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [optimisticLikeCount, setOptimisticLikeCount] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Check if current user has moderator privileges
  const isModerator = currentUserRole === 'moderator' || currentUserRole === 'teacher';
  
  // Determine the actual liked state (optimistic or real)
  const isLiked = optimisticLiked !== null ? optimisticLiked : post.userHasLiked;
  const likeCount = optimisticLikeCount !== null ? optimisticLikeCount : post.likeCount;
  
  // Clear optimistic state after successful update
  useEffect(() => {
    if (optimisticLiked !== null && post.userHasLiked === optimisticLiked) {
      setOptimisticLiked(null);
    }
    if (optimisticLikeCount !== null && post.likeCount === optimisticLikeCount) {
      setOptimisticLikeCount(null);
    }
  }, [post.userHasLiked, post.likeCount, optimisticLiked, optimisticLikeCount]);



  /**
   * Handle reply action
   */
  const handleReply = useCallback(() => {
    if (onReply) {
      try {
        onReply(post.id);
      } catch (error) {
        console.error('Error in onReply handler:', error);
      }
    }
  }, [onReply, post.id]);

  /**
   * Handle edit action
   */
  const handleEdit = useCallback(() => {
    if (onEdit) {
      try {
        onEdit(post.id);
      } catch (error) {
        console.error('Error in onEdit handler:', error);
      }
    }
  }, [onEdit, post.id]);

  /**
   * Handle delete action
   */
  const handleDeleteClick = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  /**
   * Confirm delete action
   */
  const handleDeleteConfirm = useCallback(() => {
    if (onDelete) {
      try {
        onDelete(post.id);
      } catch (error) {
        console.error('Error in onDelete handler:', error);
      }
    }
    setDeleteDialogOpen(false);
  }, [onDelete, post.id]);

  /**
   * Cancel delete action
   */
  const handleDeleteCancel = useCallback(() => {
    setDeleteDialogOpen(false);
  }, []);

  /**
   * Handle report action
   */
  const handleReport = useCallback(() => {
    if (onReport) {
      try {
        onReport(post.id);
      } catch (error) {
        console.error('Error in onReport handler:', error);
      }
    }
  }, [onReport, post.id]);

  /**
   * Handle like/unlike action with debouncing and optimistic updates
   */
  const handleLike = useCallback(() => {
    if (!onLike) return;
    
    // Optimistic update
    const newLikedState = !isLiked;
    const newLikeCount = newLikedState ? likeCount + 1 : likeCount - 1;
    
    setOptimisticLiked(newLikedState);
    setOptimisticLikeCount(newLikeCount);
    
    // Set status message for screen readers
    setStatusMessage(newLikedState ? 'Post liked' : 'Post unliked');
    
    // Clear status message after announcement
    setTimeout(() => setStatusMessage(''), 1000);
    
    // Call handler immediately
    try {
      onLike(post.id);
    } catch (error) {
      console.error('Error in onLike handler:', error);
      // Revert optimistic update on error
      setOptimisticLiked(null);
      setOptimisticLikeCount(null);
    }
  }, [onLike, post.id, isLiked, likeCount]);

  /**
   * Handle quote action
   */
  const handleQuote = useCallback(() => {
    if (onQuote) {
      try {
        onQuote(post.id);
      } catch (error) {
        console.error('Error in onQuote handler:', error);
      }
    }
  }, [onQuote, post.id]);

  /**
   * Handle permalink copy to clipboard
   */
  const handlePermalink = useCallback(async () => {
    const permalink = `${window.location.origin}/mod/forum/discuss.php?d=${post.discussionId}#p${post.id}`;
    try {
      await navigator.clipboard.writeText(permalink);
      setCopySuccess(true);
      setCopyError(false);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy permalink:', err);
      setCopyError(true);
      setCopySuccess(false);
      setTimeout(() => setCopyError(false), 3000);
    }
  }, [post.id, post.discussionId]);

  /**
   * Handle approve action (moderator)
   */
  const handleApprove = useCallback(() => {
    if (onApprove) {
      try {
        onApprove(post.id);
      } catch (error) {
        console.error('Error in onApprove handler:', error);
      }
    }
  }, [onApprove, post.id]);

  /**
   * Handle reject action (moderator)
   */
  const handleReject = useCallback(() => {
    if (onReject) {
      try {
        onReject(post.id);
      } catch (error) {
        console.error('Error in onReject handler:', error);
      }
    }
  }, [onReject, post.id]);

  /**
   * Handle split action (moderator)
   */
  const handleSplit = useCallback(() => {
    if (onSplit) {
      try {
        onSplit(post.id);
      } catch (error) {
        console.error('Error in onSplit handler:', error);
      }
    }
  }, [onSplit, post.id]);

  /**
   * Handle move action (moderator)
   */
  const handleMove = useCallback(() => {
    if (onMove) {
      try {
        onMove(post.id);
      } catch (error) {
        console.error('Error in onMove handler:', error);
      }
    }
  }, [onMove, post.id]);

  /**
   * Toggle expanded view for long posts
   */
  const handleToggleExpanded = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);

  /**
   * Download all attachments as ZIP (placeholder)
   */
  const handleDownloadAll = useCallback(() => {
    // In a real implementation, this would trigger a server endpoint
    // that creates a ZIP of all attachments and returns it
    console.log('Download all attachments for post', post.id);
  }, [post.id]);

  /**
   * Debounced handlers to prevent duplicate actions from rapid clicks
   */
  const debouncedHandleReply = useMemo(
    () => debounce(handleReply, 300, { leading: true, trailing: false }),
    [handleReply]
  );

  const debouncedHandleEdit = useMemo(
    () => debounce(handleEdit, 300, { leading: true, trailing: false }),
    [handleEdit]
  );

  const debouncedHandleDeleteClick = useMemo(
    () => debounce(handleDeleteClick, 300, { leading: true, trailing: false }),
    [handleDeleteClick]
  );

  const debouncedHandleReport = useMemo(
    () => debounce(handleReport, 300, { leading: true, trailing: false }),
    [handleReport]
  );

  const debouncedHandleLike = useMemo(
    () => debounce(handleLike, 300, { leading: true, trailing: false }),
    [handleLike]
  );

  const debouncedHandleQuote = useMemo(
    () => debounce(handleQuote, 300, { leading: true, trailing: false }),
    [handleQuote]
  );

  const debouncedHandleApprove = useMemo(
    () => debounce(handleApprove, 300, { leading: true, trailing: false }),
    [handleApprove]
  );

  const debouncedHandleReject = useMemo(
    () => debounce(handleReject, 300, { leading: true, trailing: false }),
    [handleReject]
  );

  const debouncedHandleSplit = useMemo(
    () => debounce(handleSplit, 300, { leading: true, trailing: false }),
    [handleSplit]
  );

  const debouncedHandleMove = useMemo(
    () => debounce(handleMove, 300, { leading: true, trailing: false }),
    [handleMove]
  );

  const debouncedHandleDeleteConfirm = useMemo(
    () => debounce(handleDeleteConfirm, 300, { leading: true, trailing: false }),
    [handleDeleteConfirm]
  );

  // Sanitize HTML content to prevent XSS
  const sanitizedMessage = DOMPurify.sanitize(post.message, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
  });

  // Check if message is long and should be collapsible
  // Use the larger of charCount or sanitized message length to handle cases where
  // charCount might not be updated after message changes
  const effectiveCharCount = Math.max(post.charCount || 0, sanitizedMessage.length);
  const isLongMessage = effectiveCharCount > 500;
  const shouldShowExpandButton = isLongMessage && !expanded;

  // Render deleted post placeholder
  if (post.deleted) {
    return (
      <Card 
        sx={{ 
          mb: 2, 
          opacity: 0.6,
          backgroundColor: 'action.disabledBackground' 
        }}
        role="article"
        aria-label="Deleted post"
      >
        <CardContent>
          <Alert severity="info">
            This post has been deleted by {post.deletedBy?.fullName || 'Unknown User'}
            {post.deletedAt && ` on ${format(post.deletedAt, 'PPpp')}`}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Render pending approval state
  if (post.isPending && !post.moderatorApproved) {
    return (
      <Card 
        sx={{ 
          mb: 2,
          borderColor: 'warning.main',
          borderWidth: 2,
          borderStyle: 'solid'
        }}
        role="article"
        aria-label="Post pending approval"
      >
        <CardContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This post is pending approval
          </Alert>
          
          {/* Author Section */}
          <Box display="flex" alignItems="flex-start" gap={2} mb={2}>
            <Avatar
              src={post.author?.profileImageUrl || undefined}
              alt={post.author?.fullName || 'Deleted User'}
              sx={{ width: 48, height: 48 }}
              data-testid={!post.author?.profileImageUrl ? 'default-avatar' : undefined}
            >
              {!post.author?.profileImageUrl && getInitials(post.author?.fullName || 'Deleted User')}
            </Avatar>
            <Box flex={1}>
              <Box display="flex" alignItems="center" gap={1}>
                {post.author?.profileUrl ? (
                  <Link
                    to={post.author.profileUrl}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <Typography variant="subtitle1" component="span" fontWeight="bold">
                      {post.author.fullName}
                    </Typography>
                  </Link>
                ) : (
                  <Typography variant="subtitle1" component="span" fontWeight="bold" color="text.secondary">
                    {post.author?.fullName || 'Deleted User'}
                  </Typography>
                )}
                {post.author?.role && (
                  <Chip
                    label={post.author.role}
                    size="small"
                    color={getRoleBadgeColor(post.author.role)}
                  />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {formatTimestamp(post.created)}
              </Typography>
            </Box>
          </Box>

          {/* Content */}
          <Typography variant="h6" gutterBottom>
            {post.subject}
          </Typography>
          {post.message ? (
            <Box
              dangerouslySetInnerHTML={{ __html: sanitizedMessage }}
              sx={{ '& img': { maxWidth: '100%', height: 'auto' } }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary" fontStyle="italic">
              No content
            </Typography>
          )}
        </CardContent>

        {/* Moderator Actions */}
        {(onApprove || onReject) && (
          <CardActions>
            {onApprove && (
              <Button
                startIcon={<CheckIcon />}
                color="success"
                onClick={handleApprove}
                aria-label="Approve post"
              >
                Approve
              </Button>
            )}
            {onReject && (
              <Button
                startIcon={<CloseIcon />}
                color="error"
                onClick={handleReject}
                aria-label="Reject post"
              >
                Reject
              </Button>
            )}
          </CardActions>
        )}
      </Card>
    );
  }

  return (
    <Card 
      className={isMobile ? 'mobile-layout' : 'desktop-layout'}
      sx={{ mb: 2 }}
      role="article"
      aria-label={`Post by ${post.author?.fullName || 'Deleted User'}`}
    >
      {/* Unread Indicator */}
      {post.unread && (
        <Box
          data-testid="unread-indicator"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: 'primary.main',
          }}
          aria-label="Unread post"
        />
      )}

      <CardContent>
        {/* Author Section */}
        <Box display="flex" alignItems="flex-start" gap={2} mb={2}>
          <Avatar
            src={post.author?.profileImageUrl || undefined}
            alt={post.author?.fullName || 'Deleted User'}
            sx={{ width: 48, height: 48 }}
            data-testid={!post.author?.profileImageUrl ? 'default-avatar' : undefined}
          >
            {!post.author?.profileImageUrl && getInitials(post.author?.fullName || 'Deleted User')}
          </Avatar>
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              {post.author?.profileUrl ? (
                <Link
                  to={post.author.profileUrl}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <Typography variant="subtitle1" component="span" fontWeight="bold">
                    {post.author.fullName}
                  </Typography>
                </Link>
              ) : (
                <Typography variant="subtitle1" component="span" fontWeight="bold" color="text.secondary">
                  {post.author?.fullName || 'Deleted User'}
                </Typography>
              )}
              {post.author?.role && (
                <Chip
                  label={post.author.role}
                  size="small"
                  color={getRoleBadgeColor(post.author.role)}
                  data-testid="role-badge"
                />
              )}
              {post.replyCount > 0 && (
                <Chip
                  label={`${post.replyCount} ${post.replyCount === 1 ? 'reply' : 'replies'}`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {formatTimestamp(post.created)}
              {post.modified && post.editedBy && (
                <>
                  {' • '}
                  <span>
                    Edited by {post.editedBy.fullName} on {format(post.modified, 'PPpp')}
                    {' '}
                    <Link
                      to={`/mod/forum/discuss.php?d=${post.discussionId}#p${post.id}/history`}
                      style={{ textDecoration: 'underline' }}
                    >
                      (view edit history)
                    </Link>
                  </span>
                </>
              )}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Post Subject */}
        <Typography variant="h6" gutterBottom>
          {post.subject}
        </Typography>

        {/* Post Content */}
        {post.message ? (
          <Box
            sx={{
              position: 'relative',
              maxHeight: shouldShowExpandButton ? 300 : 'none',
              overflow: shouldShowExpandButton ? 'hidden' : 'visible',
              '& img': { maxWidth: '100%', height: 'auto' },
              '& pre': { 
                backgroundColor: 'action.hover',
                padding: 2,
                borderRadius: 1,
                overflowX: 'auto'
              },
              '& code': {
                backgroundColor: 'action.hover',
                padding: 0.5,
                borderRadius: 0.5,
                fontFamily: 'monospace'
              },
            }}
          >
            <Box
              dangerouslySetInnerHTML={{ __html: sanitizedMessage }}
            />
            {shouldShowExpandButton && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 100,
                  background: 'linear-gradient(transparent, white)',
                }}
              />
            )}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" fontStyle="italic">
            No content
          </Typography>
        )}

        {/* Expand/Collapse Button */}
        {isLongMessage && (
          <Button
            size="small"
            startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={handleToggleExpanded}
            sx={{ mt: 1 }}
            aria-label={expanded ? 'Show less' : 'Show more'}
          >
            {expanded ? 'Show less' : 'Show more'}
          </Button>
        )}

        {/* Attachments */}
        {post.attachments.length > 0 && (
          <Box mt={2}>
            <Divider sx={{ mb: 2 }} />
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Attachments ({post.attachments.length})
              </Typography>
              {post.attachments.length > 1 && (
                <Button
                  size="small"
                  startIcon={<ArchiveIcon />}
                  onClick={handleDownloadAll}
                  aria-label="Download all as ZIP"
                >
                  Download all as ZIP
                </Button>
              )}
            </Box>
            <Box>
              {post.attachments.map((attachment) => {
                const isImage = attachment.mimetype.startsWith('image/');
                
                return (
                  <Box 
                    key={attachment.id}
                    display="flex"
                    alignItems="center"
                    gap={1}
                    py={0.5}
                  >
                    {isImage ? (
                      <Box
                        component="img"
                        src={attachment.fileurl}
                        alt={attachment.filename}
                        data-testid="attachment-icon-image"
                        sx={{
                          width: 48,
                          height: 48,
                          objectFit: 'cover',
                          borderRadius: 1,
                        }}
                      />
                    ) : (
                      <Box sx={{ width: 24, height: 24 }}>
                        {getFileIcon(attachment.mimetype)}
                      </Box>
                    )}
                    <Box flex={1}>
                      <Typography variant="body2">
                        {attachment.filename}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(attachment.filesize)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      aria-label={`Download ${attachment.filename}`}
                      component="a"
                      href={attachment.fileurl}
                      download
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Rating Display */}
        {post.rating !== null && (
          <Box mt={2} data-testid="post-rating">
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" color="text.secondary">
                Average Rating:
              </Typography>
              <Rating 
                value={post.rating} 
                precision={0.5} 
                readOnly 
                size="small"
              />
              <Typography variant="body2" color="text.secondary">
                {post.rating.toFixed(1)}
              </Typography>
            </Box>
          </Box>
        )}

        {/* User Rating Display */}
        {post.userRating !== null && (
          <Box mt={1} data-testid="user-rating">
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" color="text.secondary">
                Your Rating:
              </Typography>
              <Rating 
                value={post.userRating} 
                readOnly 
                size="small"
              />
            </Box>
          </Box>
        )}
      </CardContent>

      <Divider />

      {/* Action Buttons */}
      <CardActions sx={{ justifyContent: 'space-between', px: 2, flexWrap: 'wrap' }}>
        <Box 
          display="flex" 
          gap={1} 
          flexWrap="wrap"
          data-testid="action-buttons"
          className={isMobile ? 'vertical' : 'horizontal'}
          sx={{
            flexDirection: isMobile ? 'column' : 'row',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          {/* Like Button */}
          {onLike && (
            <Tooltip title={isLiked ? 'Unlike' : 'Like'}>
              <IconButton
                onClick={debouncedHandleLike}
                color={isLiked ? 'primary' : undefined}
                aria-label={isLiked ? 'Liked post' : 'Like post'}
                aria-pressed={isLiked}
                className={isLiked ? 'liked' : ''}
              >
                <Badge badgeContent={likeCount || 0} color="primary">
                  {isLiked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
                </Badge>
              </IconButton>
            </Tooltip>
          )}

          {/* Reply Button */}
          {post.canReply && onReply && (
            <Tooltip title="Reply">
              <IconButton
                onClick={debouncedHandleReply}
                aria-label="Reply to post"
              >
                <Badge badgeContent={post.replyCount || 0} color="secondary">
                  <ReplyIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          )}

          {/* Edit Button */}
          {post.canEdit && onEdit && (
            <Tooltip title="Edit">
              <IconButton
                onClick={debouncedHandleEdit}
                aria-label="Edit post"
                data-testid="edit-button"
              >
                <EditIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* Quote Button */}
          {post.canReply && onQuote && (
            <Tooltip title="Quote">
              <IconButton
                onClick={debouncedHandleQuote}
                aria-label="Quote post"
              >
                <FormatQuoteIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* Delete Button */}
          {post.canDelete && onDelete && (
            <Tooltip title="Delete">
              <IconButton
                onClick={debouncedHandleDeleteClick}
                aria-label="Delete post"
                color="error"
                data-testid="delete-button"
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* Report Button */}
          {onReport && (
            <Tooltip title="Report">
              <IconButton
                onClick={debouncedHandleReport}
                aria-label="Report post"
              >
                <FlagIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* Permalink Button */}
          <Tooltip title={copySuccess ? 'Copied!' : 'Copy permalink'}>
            <IconButton
              onClick={handlePermalink}
              aria-label="Copy permalink to clipboard"
            >
              <LinkIcon color={copySuccess ? 'success' : undefined} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* More Actions Menu and Moderator Controls */}
        <Box display="flex" gap={1}>
          {/* Moderator Approve Button */}
          {isModerator && onApprove && (
            <Tooltip title="Approve">
              <IconButton
                onClick={debouncedHandleApprove}
                aria-label="Approve post"
                color="success"
              >
                <CheckIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* Moderator Reject Button */}
          {isModerator && onReject && (
            <Tooltip title="Reject">
              <IconButton
                onClick={debouncedHandleReject}
                aria-label="Reject post"
                color="error"
              >
                <CloseIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* Split Button */}
          {isModerator && post.canSplit && onSplit && (
            <Tooltip title="Split Discussion">
              <IconButton
                onClick={debouncedHandleSplit}
                aria-label="Split discussion"
              >
                <CallSplitIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* Move Button (Moderator) */}
          {isModerator && onMove && (
            <Tooltip title="Move Post">
              <IconButton
                onClick={debouncedHandleMove}
                aria-label="Move post"
              >
                <DriveFileMoveIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </CardActions>

      {/* Copy Error Message */}
      {copyError && (
        <Box sx={{ px: 2, pb: 2 }}>
          <Alert severity="error" onClose={() => setCopyError(false)}>
            Failed to copy permalink to clipboard
          </Alert>
        </Box>
      )}

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
          <Button onClick={debouncedHandleDeleteConfirm} color="error">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Screen Reader Status Announcements */}
      {statusMessage && (
        <Box
          role="status"
          aria-live="polite"
          sx={{
            position: 'absolute',
            left: '-10000px',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
        >
          {statusMessage}
        </Box>
      )}
    </Card>
  );
};

export default PostCard;
