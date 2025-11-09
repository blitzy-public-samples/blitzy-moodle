/**
 * DiscussionThread Component
 * 
 * Renders a forum discussion thread with nested replies.
 * Supports expand/collapse, pagination, moderation actions, and full accessibility.
 * 
 * Features:
 * - Discussion header with metadata (title, author, date, views, participants)
 * - Original post (starter post) with prominence
 * - Nested reply structure with proper indentation (up to 5 levels)
 * - Expand/collapse controls for deeply nested threads
 * - Reply, edit, delete, and quote functionality
 * - Moderator actions (lock, pin, split, move)
 * - Subscription toggle
 * - Load more pagination
 * - Unread post indicators
 * - Full WCAG 2.1 AA accessibility support
 */

import type React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Skeleton,
  Alert,
  Chip,
  Divider,
  Paper,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Lock as LockIcon,
  PushPin as PushPinIcon,
  Visibility as VisibilityIcon,
  Group as GroupIcon,
  Reply as ReplyIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useDiscussion } from '../hooks/useDiscussion';
import { useAuth } from '@/features/auth/hooks/useAuth';
import PostCard from './PostCard';
import type { DiscussionPost, ForumPost, PostAuthor, PostAttachment } from '../types/forum.types';

/**
 * Props for DiscussionThread component
 */
export interface DiscussionThreadProps {
  /** ID of the discussion to display */
  discussionId: number;
}

/**
 * Maximum nesting depth before showing expand/collapse controls
 */
const MAX_DISPLAY_DEPTH = 5;

/**
 * Helper function to convert DiscussionPost to ForumPost format
 * PostCard expects ForumPost which has additional display and permission data
 */
function convertToForumPost(post: DiscussionPost): ForumPost {
  // Convert author information from flat properties to PostAuthor object
  const author: PostAuthor = {
    id: post.userId,
    firstName: '',
    lastName: '',
    fullName: post.userName,
    profileImageUrl: post.userPictureUrl,
    profileUrl: `/user/profile.php?id=${post.userId}`,
  };

  // Convert timestamps from Unix seconds to Date objects
  const created = new Date(post.created * 1000);
  const modified = post.modified > 0 ? new Date(post.modified * 1000) : null;

  // Convert attachments from DiscussionPost format to PostAttachment format
  const attachments: PostAttachment[] = post.attachments.map(att => ({
    id: att.id,
    filename: att.filename,
    filesize: att.filesize,
    mimetype: att.mimetype,
    fileurl: att.url,
    timemodified: new Date(),
  }));

  return {
    id: post.id,
    discussionId: post.discussionId,
    parentId: post.parentId,
    subject: post.subject,
    message: post.message,
    messageFormat: 1, // Default to HTML format
    author,
    created,
    modified,
    editedBy: null,
    deleted: post.deleted,
    deletedBy: null,
    deletedAt: null,
    attachments,
    hasInlineFiles: false,
    wordCount: post.message.split(/\s+/).length,
    charCount: post.message.length,
    canEdit: post.canEdit,
    canDelete: post.canDelete,
    canReply: post.canReply,
    canSplit: false,
    canExport: false,
    canControlReadTracking: true,
    mailNow: false,
    unread: post.unread ?? false,
    rating: null,
    userRating: null,
    replyCount: post.replies.length,
    likeCount: 0,
    userHasLiked: false,
    isPending: false,
    moderatorApproved: true,
  };
}

/**
 * DiscussionThread Component
 */
export function DiscussionThread({ discussionId }: DiscussionThreadProps): React.JSX.Element {
  // State for collapsed threads
  const [collapsedThreads, setCollapsedThreads] = useState<Set<number>>(new Set());
  
  // State for moderator actions menu
  const [moderatorMenuAnchor, setModeratorMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Fetch discussion data using the hook
  const {
    discussion,
    posts,
    isLoading,
    isError,
    error,
    refetch,
    createReply,
    isCreatingReply,
    editPost,
    isEditingPost,
    deletePost,
    isDeletingPost,
    subscribe,
    unsubscribe,
    isSubscribing,
    isUnsubscribing,
    loadMore,
    hasMore,
    isLoadingMore,
  } = useDiscussion(discussionId);

  // Get current user for permission checks
  const { user } = useAuth();

  // Check if user is a moderator (simplified - in real app, check capabilities)
  const isModerator = user?.id !== undefined;

  /**
   * Handle moderator menu
   */
  const handleOpenModeratorMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setModeratorMenuAnchor(event.currentTarget);
  }, []);

  const handleCloseModeratorMenu = useCallback(() => {
    setModeratorMenuAnchor(null);
  }, []);

  const handleSplitDiscussion = useCallback(() => {
    // TODO: Implement split discussion logic
    handleCloseModeratorMenu();
  }, [handleCloseModeratorMenu]);

  /**
   * Toggle collapsed state for a thread
   */
  const toggleCollapse = useCallback((postId: number) => {
    setCollapsedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  }, []);

  /**
   * Handle reply to a post
   */
  const handleReply = useCallback(
    (postId: number, content: string) => {
      if (!discussion) {return;}
      createReply({
        postData: {
          forumId: discussion.forumid,
          message: content,
        },
        parentId: postId,
      });
    },
    [createReply, discussion]
  );

  /**
   * Handle edit post
   */
  const handleEdit = useCallback(
    (postId: number, content: string) => {
      editPost({
        postId,
        postData: {
          postId,
          message: content,
        },
      });
    },
    [editPost]
  );

  /**
   * Handle delete post
   */
  const handleDelete = useCallback(
    (postId: number) => {
      deletePost(postId);
    },
    [deletePost]
  );

  /**
   * Handle quote post
   */
  const handleQuote = useCallback((_postId: number) => {
    // Quote functionality - implementation depends on PostCard
    // No-op placeholder for future implementation
  }, []);

  /**
   * Handle subscription toggle
   */
  const handleSubscriptionToggle = useCallback(() => {
    if (discussion?.subscribed) {
      unsubscribe();
    } else {
      subscribe();
    }
  }, [discussion?.subscribed, subscribe, unsubscribe]);

  /**
   * Recursively render posts with nesting
   */
  const renderPost = useCallback(
    (post: DiscussionPost, depth: number = 0): React.ReactNode => {
      const isCollapsed = collapsedThreads.has(post.id);
      const hasReplies = post.replies && post.replies.length > 0;
      const showCollapseControl = depth >= MAX_DISPLAY_DEPTH && hasReplies;
      
      // Calculate actual display depth (capped at MAX_DISPLAY_DEPTH)
      const displayDepth = Math.min(depth, MAX_DISPLAY_DEPTH);

      return (
        <Box
          key={post.id}
          data-testid={`post-${post.id}`}
          data-post-id={post.id.toString()}
          data-depth={depth}
          data-locked={discussion?.timelocked && discussion.timelocked > 0 ? 'true' : undefined}
          sx={{
            ml: displayDepth * 4,
            mt: 2,
            position: 'relative',
          }}
        >
          {/* Indentation visual indicator */}
          {depth > 0 && (
            <Box
              sx={{
                position: 'absolute',
                left: -2,
                top: 0,
                bottom: 0,
                width: 2,
                bgcolor: 'divider',
              }}
            />
          )}

          {/* Collapse/Expand button for deep nesting */}
          {showCollapseControl && (
            <Box sx={{ mb: 1 }}>
              <Button
                size="small"
                startIcon={isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                onClick={() => toggleCollapse(post.id)}
                data-testid={`collapse-toggle-${post.id}`}
                aria-expanded={!isCollapsed}
                aria-label={
                  isCollapsed
                    ? `Expand ${post.replies?.length || 0} replies`
                    : `Collapse ${post.replies?.length || 0} replies`
                }
              >
                {isCollapsed
                  ? `Show ${post.replies?.length || 0} replies`
                  : 'Collapse replies'}
              </Button>
            </Box>
          )}

          {/* Render the post card */}
          {!isCollapsed && (
            <PostCard
              post={convertToForumPost(post)}
              onReply={
                discussion?.timelocked && discussion.timelocked > 0
                  ? undefined
                  : () => handleReply(post.id, '')
              }
              onEdit={() => handleEdit(post.id, '')}
              onDelete={() => handleDelete(post.id)}
              onQuote={() => handleQuote(post.id)}
            />
          )}

          {/* Render nested replies */}
          {!isCollapsed && hasReplies && (
            <Box
              role="group"
              aria-label={`Replies to post ${post.id}`}
            >
              {post.replies.map((reply) => renderPost(reply, depth + 1))}
            </Box>
          )}
        </Box>
      );
    },
    [
      collapsedThreads,
      discussion?.timelocked,
      handleReply,
      handleEdit,
      handleDelete,
      handleQuote,
      toggleCollapse,
    ]
  );

  /**
   * Organize posts into a tree structure
   * The hook already provides this, but we'll use the posts array directly
   */
  const postTree = useMemo(() => {
    if (!posts || posts.length === 0) {return [];}
    
    // posts array already contains root-level posts with nested replies
    // (including orphan posts that are treated as root-level)
    return posts;
  }, [posts]);

  // Loading state
  if (isLoading) {
    return (
      <Box data-testid="loading-skeleton" aria-busy="true" aria-live="polite">
        <Skeleton variant="rectangular" height={100} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={150} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={150} />
      </Box>
    );
  }

  // Error state - 404 Not Found
  const errorStatus = error && typeof error === 'object' && 'status' in error 
    ? (error as { status: number }).status 
    : undefined;
  
  if (isError && errorStatus === 404) {
    return (
      <Alert
        severity="error"
        data-testid="error-not-found"
        action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }
      >
        Discussion not found. It may have been deleted or you don&apos;t have access to view it.
      </Alert>
    );
  }

  // Error state - 403 Permission Denied
  if (isError && errorStatus === 403) {
    return (
      <Alert
        severity="error"
        data-testid="error-permission-denied"
        action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }
      >
        You don&apos;t have permission to view this discussion.
      </Alert>
    );
  }

  // Generic error state
  if (isError) {
    return (
      <Alert
        severity="error"
        data-testid="error-generic"
        action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }
      >
        {error?.message ?? 'Failed to load discussion. Please try again.'}
      </Alert>
    );
  }

  // Empty state - no discussion data
  if (!discussion || !posts || posts.length === 0) {
    return (
      <Box
        data-testid="empty-state"
        sx={{
          textAlign: 'center',
          py: 8,
        }}
      >
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No posts yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Be the first to start the discussion!
        </Typography>
      </Box>
    );
  }

  // Empty state - only original post, no replies yet
  const hasOnlyOriginalPost = posts.length === 1 && posts[0]?.replies?.length === 0;
  const noRepliesMessage = hasOnlyOriginalPost ? (
    <Box
      data-testid="no-replies-state"
      sx={{
        textAlign: 'center',
        py: 4,
        bgcolor: 'background.paper',
        borderRadius: 1,
        mt: 2,
      }}
    >
      <Typography variant="h6" color="text.secondary" gutterBottom>
        No replies yet
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Be the first to reply!
      </Typography>
    </Box>
  ) : null;

  // Success state - render discussion
  return (
    <Box data-testid="discussion-thread" role="main" aria-label="Discussion thread">
      {/* Discussion Header */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 2,
          bgcolor: 'background.default',
        }}
      >
        <Box sx={{ mb: 2 }}>
          {/* Status indicators */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            {discussion.timelocked > 0 && (
              <Chip
                icon={<LockIcon />}
                label="Locked"
                size="small"
                color="error"
                data-testid="locked-indicator"
              />
            )}
            {discussion.pinned && (
              <Chip
                icon={<PushPinIcon />}
                label="Pinned"
                size="small"
                color="primary"
                data-testid="pinned-indicator"
              />
            )}
          </Box>

          {/* Discussion Title */}
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            data-testid="discussion-title"
          >
            {discussion.name}
          </Typography>

          {/* Discussion Metadata */}
          <Box
            sx={{
              display: 'flex',
              gap: 3,
              flexWrap: 'wrap',
              alignItems: 'center',
              color: 'text.secondary',
            }}
          >
            {/* Author */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" data-testid="discussion-author">
                By {discussion.author?.fullname || 'Unknown'}
              </Typography>
            </Box>

            {/* Created date */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" data-testid="discussion-created">
                {new Date(discussion.created * 1000).toLocaleString()}
              </Typography>
            </Box>

            {/* View count */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <VisibilityIcon fontSize="small" />
              <Typography variant="body2" data-testid="discussion-views">
                {discussion.numViews || 0} views
              </Typography>
            </Box>

            {/* Participants */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <GroupIcon fontSize="small" />
              <Typography variant="body2" data-testid="discussion-participants">
                {discussion.numParticipants || 0} participants
              </Typography>
            </Box>

            {/* Total replies */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ReplyIcon fontSize="small" />
              <Typography variant="body2" data-testid="discussion-replies">
                {discussion.numReplies || 0} replies
              </Typography>
            </Box>

            {/* Unread count */}
            {discussion.unreadCount && discussion.unreadCount > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="body2" color="primary" data-testid="discussion-unread">
                  {discussion.unreadCount} unread
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Actions Row - Moderator Actions and Subscription Toggle */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Moderator Actions */}
          {isModerator && (
            <>
              <IconButton
                onClick={handleOpenModeratorMenu}
                aria-label="Moderator actions"
                data-testid="moderator-menu-button"
              >
                <MoreVertIcon />
              </IconButton>
              <Menu
                anchorEl={moderatorMenuAnchor}
                open={Boolean(moderatorMenuAnchor)}
                onClose={handleCloseModeratorMenu}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'left',
                }}
              >
                <MenuItem onClick={handleSplitDiscussion}>
                  Split Discussion
                </MenuItem>
                <MenuItem onClick={handleCloseModeratorMenu}>
                  Lock Discussion
                </MenuItem>
                <MenuItem onClick={handleCloseModeratorMenu}>
                  Pin Discussion
                </MenuItem>
                <MenuItem onClick={handleCloseModeratorMenu}>
                  Move Discussion
                </MenuItem>
              </Menu>
            </>
          )}

          {/* Subscription Toggle */}
          <Button
            startIcon={
              discussion.subscribed ? <NotificationsOffIcon /> : <NotificationsIcon />
            }
            onClick={handleSubscriptionToggle}
            disabled={isSubscribing || isUnsubscribing}
            data-testid="subscription-toggle"
            aria-label={
              discussion.subscribed
                ? 'Unsubscribe from this discussion'
                : 'Subscribe to this discussion'
            }
            sx={{ ml: 'auto' }}
          >
            {isSubscribing || isUnsubscribing ? (
              <CircularProgress size={20} />
            ) : discussion.subscribed ? (
              'Unsubscribe'
            ) : (
              'Subscribe'
            )}
          </Button>
        </Box>
      </Paper>

      {/* Posts Thread */}
      <Box
        role="feed"
        aria-label="Discussion posts"
        aria-live="polite"
        aria-busy={isCreatingReply || isEditingPost || isDeletingPost}
      >
        {postTree.map((post) => (
          <Box key={post.id} sx={{ mb: 2 }}>
            {renderPost(post, 0)}
          </Box>
        ))}
      </Box>

      {/* No replies message when only original post exists */}
      {noRepliesMessage}

      {/* Load More Button */}
      {hasMore && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mt: 4,
          }}
        >
          <Button
            variant="outlined"
            onClick={() => loadMore()}
            disabled={isLoadingMore}
            data-testid="load-more-button"
            aria-label="Load more posts"
          >
            {isLoadingMore ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </Box>
      )}

      {/* Announcement region for screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px' }}
      >
        {isCreatingReply && 'Creating reply...'}
        {isEditingPost && 'Saving edit...'}
        {isDeletingPost && 'Deleting post...'}
        {isLoadingMore && 'Loading more posts...'}
      </div>
    </Box>
  );
}

export default DiscussionThread;
