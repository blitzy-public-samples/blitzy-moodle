/**
 * ForumView Component
 *
 * Container component for displaying a complete forum view including header,
 * metadata, subscription controls, and discussion list.
 *
 * Features:
 * - Forum header with title, description, and metadata
 * - Forum type indicators (single, standard, Q&A, blog)
 * - Subscription toggle button with loading state
 * - Create discussion button (permission-based visibility)
 * - Integrated discussion list with sorting and filtering
 * - Loading skeleton during data fetch
 * - Error state with retry functionality
 * - Empty state messaging
 * - Forum statistics display (discussions, posts, unread count)
 * - Subscription status indicator
 * - Moderator action support
 * - Accessibility features (ARIA labels, keyboard navigation)
 *
 * @module features/activities/forums/components/ForumView
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Stack,
  Skeleton,
  Alert,
  Divider,
  Tooltip,
  Paper,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Add as AddIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  Forum as ForumIcon,
  ChatBubbleOutline as ChatBubbleIcon,
  Visibility as VisibilityIcon,
  Lock as LockIcon,
  ArchiveOutlined as ArchiveIcon,
  QuestionAnswer as QuestionAnswerIcon,
  Article as ArticleIcon,
  Groups as GroupsIcon,
  Event as EventIcon,
} from '@mui/icons-material';

// Internal imports
import { useForum } from '../hooks/useForum';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { DiscussionList } from './DiscussionList';
import { PostForm } from './PostForm';
import type { DiscussionPost } from '../types/forum.types';
import { ForumType } from '../types/forum.types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for ForumView component
 */
export interface ForumViewComponentProps {
  /** Course ID that contains the forum */
  courseId: number;
  /** Forum ID to display */
  forumId: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get forum type display information
 */
const getForumTypeInfo = (
  type: ForumType
): {
  icon: React.ReactElement;
  label: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
} => {
  switch (type) {
    case ForumType.SINGLE:
      return {
        icon: <ArticleIcon fontSize="small" />,
        label: 'Single Discussion',
        color: 'primary',
      };
    case ForumType.QANDA:
      return {
        icon: <QuestionAnswerIcon fontSize="small" />,
        label: 'Q&A forum',
        color: 'secondary',
      };
    case ForumType.BLOG:
      return {
        icon: <ArticleIcon fontSize="small" />,
        label: 'Blog-style',
        color: 'info',
      };
    case ForumType.NEWS:
      return {
        icon: <ForumIcon fontSize="small" />,
        label: 'News Forum',
        color: 'warning',
      };
    case ForumType.SOCIAL:
      return {
        icon: <GroupsIcon fontSize="small" />,
        label: 'Social Forum',
        color: 'success',
      };
    case ForumType.GENERAL:
    case ForumType.EACHUSER:
    default:
      return {
        icon: <ForumIcon fontSize="small" />,
        label: 'Standard Forum',
        color: 'default',
      };
  }
};

/**
 * Format forum statistics for display
 */
const formatStatistics = (discussionCount: number, postCount: number, unreadCount?: number) => {
  return {
    discussions: (discussionCount ?? 0).toLocaleString(),
    posts: (postCount ?? 0).toLocaleString(),
    unread: (unreadCount ?? 0).toLocaleString(),
  };
};

/**
 * Format bytes to human-readable size
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ForumView component - Container for complete forum display
 */
// eslint-disable-next-line react/function-component-definition
export const ForumView: React.FC<ForumViewComponentProps> = ({ courseId, forumId }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Hooks
  const { user } = useAuth();
  const navigate = useNavigate();
  const { forum, isLoading, isError, error, isSubscribing, toggleSubscription, refetch } =
    useForum(forumId);

  // Menu state for moderator actions
  const [moderateMenuAnchor, setModerateMenuAnchor] = React.useState<null | HTMLElement>(null);
  const moderateMenuOpen = Boolean(moderateMenuAnchor);

  // Dialog state for creating new discussions
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);

  const handleModerateClick = (event: React.MouseEvent<HTMLElement>) => {
    setModerateMenuAnchor(event.currentTarget);
  };

  const handleModerateClose = () => {
    setModerateMenuAnchor(null);
  };

  const handleMoveDiscussions = () => {
    // TODO: Implement move discussions functionality
    // eslint-disable-next-line no-console
    console.log('Move discussions');
    handleModerateClose();
  };

  const handleLockDiscussions = () => {
    // TODO: Implement lock discussions functionality
    // eslint-disable-next-line no-console
    console.log('Lock discussions');
    handleModerateClose();
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (isLoading) {
    return (
      <Box
        sx={{ width: '100%', p: 2 }}
        role="status"
        aria-label="Loading forum"
        aria-live="polite"
        data-testid="forum-skeleton"
      >
        {/* Screen reader announcement */}
        <Typography
          component="div"
          sx={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            borderWidth: 0,
          }}
        >
          Loading forum
        </Typography>

        <Card>
          <CardContent>
            {/* Header Skeleton */}
            <Stack spacing={2}>
              <Skeleton variant="rectangular" height={40} width="60%" />
              <Skeleton variant="text" height={20} width="30%" />
              <Skeleton variant="rectangular" height={100} />
              <Divider />
              <Stack direction="row" spacing={2}>
                <Skeleton variant="rectangular" height={36} width={120} />
                <Skeleton variant="rectangular" height={36} width={120} />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Discussion List Skeleton */}
        <Box sx={{ mt: 2 }}>
          {[1, 2, 3].map((item) => (
            <Paper key={item} sx={{ p: 2, mb: 2 }}>
              <Stack spacing={1}>
                <Skeleton variant="text" height={24} width="80%" />
                <Skeleton variant="text" height={16} width="40%" />
              </Stack>
            </Paper>
          ))}
        </Box>
      </Box>
    );
  }

  // ============================================================================
  // ERROR STATE
  // ============================================================================

  if (isError || !forum) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load forum';

    return (
      <Box sx={{ width: '100%', p: 2 }}>
        <Alert
          severity="error"
          role="alert"
          aria-live="assertive"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
          sx={{ mb: 2 }}
        >
          {errorMessage}
        </Alert>
      </Box>
    );
  }

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const typeInfo = getForumTypeInfo(forum.type);
  const statistics = formatStatistics(forum.discussionCount, forum.postCount, forum.unreadCount);
  const isArchived = forum.cutoffdate > 0 && Date.now() / 1000 > forum.cutoffdate;
  const isReadOnly = isArchived || (forum.duedate > 0 && Date.now() / 1000 > forum.duedate);

  // Permission checks - Check if user can add discussions
  // Respects both the permission from the backend and the local read-only state
  const canAddDiscussion = forum.canAddDiscussion && !isReadOnly;

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleToggleSubscription = () => {
    if (!forum.canSubscribe) {
      return;
    }
    toggleSubscription();
  };

  const handleCreateDiscussion = () => {
    setIsCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
  };

  const handleSubmitSuccess = (post: DiscussionPost) => {
    setIsCreateDialogOpen(false);
    
    // Navigate to the newly created discussion
    navigate(`/courses/${courseId}/forums/${forumId}/discussions/${post.discussionId}`);
    // Refetch forum data to update discussion count
    void refetch();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Box component="main" sx={{ width: '100%', p: isMobile ? 1 : 2 }}>
      {/* Forum Header Card */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          {/* Title and Type */}
          <Stack
            direction={isMobile ? 'column' : 'row'}
            justifyContent="space-between"
            alignItems={isMobile ? 'flex-start' : 'center'}
            spacing={2}
            sx={{ mb: 2 }}
          >
            <Box>
              <Typography
                variant="h4"
                component="h1"
                gutterBottom
                aria-level={1}
                data-testid="forum-title"
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                {forum.name}
                {isArchived && (
                  <Tooltip title="This forum is archived">
                    <ArchiveIcon color="disabled" />
                  </Tooltip>
                )}
                {isReadOnly && !isArchived && (
                  <Tooltip title="This forum is read-only">
                    <LockIcon color="disabled" />
                  </Tooltip>
                )}
              </Typography>

              {/* Forum Type Chip */}
              <Chip
                icon={typeInfo.icon}
                label={typeInfo.label}
                size="small"
                color={typeInfo.color}
                variant="outlined"
                aria-label={`Forum type: ${typeInfo.label}`}
              />
            </Box>

            {/* Action Buttons */}
            <Stack direction="row" spacing={1}>
              {/* Subscription Button */}
              {forum.canSubscribe && (
                <Tooltip title={forum.subscribed ? 'Unsubscribe from forum' : 'Subscribe to forum'}>
                  <span>
                    <Button
                      variant={forum.subscribed ? 'contained' : 'outlined'}
                      startIcon={
                        forum.subscribed ? <NotificationsIcon /> : <NotificationsOffIcon />
                      }
                      onClick={handleToggleSubscription}
                      disabled={isSubscribing}
                      aria-label={
                        forum.subscribed ? 'Unsubscribe from forum' : 'Subscribe to forum'
                      }
                      aria-pressed={forum.subscribed}
                      data-testid="subscribe-button"
                    >
                      {forum.subscribed ? 'Unsubscribe' : 'Subscribe'}
                    </Button>
                  </span>
                </Tooltip>
              )}

              {/* Moderate Button */}
              {forum.canModerate && (
                <>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleModerateClick}
                    aria-label="Moderate forum"
                    aria-controls={moderateMenuOpen ? 'moderate-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={moderateMenuOpen ? 'true' : undefined}
                  >
                    Moderate
                  </Button>
                  <Menu
                    id="moderate-menu"
                    anchorEl={moderateMenuAnchor}
                    open={moderateMenuOpen}
                    onClose={handleModerateClose}
                    MenuListProps={{
                      'aria-labelledby': 'moderate-button',
                    }}
                  >
                    <MenuItem onClick={handleMoveDiscussions}>Move discussions</MenuItem>
                    <MenuItem onClick={handleLockDiscussions}>Lock discussions</MenuItem>
                  </Menu>
                </>
              )}

              {/* Create Discussion Button */}
              {canAddDiscussion && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCreateDiscussion}
                  aria-label="Add new discussion"
                  data-testid="add-discussion-button"
                >
                  {isMobile ? 'Add' : 'Add discussion'}
                </Button>
              )}
            </Stack>
          </Stack>

          {/* Description */}
          {forum.intro && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="body1"
                color="text.secondary"
                data-testid="forum-description"
                dangerouslySetInnerHTML={{ __html: forum.intro }}
                sx={{
                  '& p': { margin: 0 },
                  '& p:not(:last-child)': { mb: 1 },
                }}
              />
            </Box>
          )}

          {/* Archived Forum Alert */}
          {isArchived && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This forum is archived and no longer accepts new discussions or posts.
            </Alert>
          )}

          {/* Read-Only Forum Alert */}
          {isReadOnly && !isArchived && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This forum is read-only. You can view discussions but cannot create new posts.
            </Alert>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Statistics */}
          <Stack
            direction="row"
            spacing={3}
            aria-label="forum statistics"
            sx={{
              flexWrap: 'wrap',
              gap: isMobile ? 1 : 2,
            }}
          >
            {/* Discussions Count */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ForumIcon color="action" fontSize="small" />
              <Typography variant="body2" color="text.secondary">
                <strong>{statistics.discussions}</strong> Discussions
              </Typography>
            </Box>

            {/* Posts Count */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ChatBubbleIcon color="action" fontSize="small" />
              <Typography variant="body2" color="text.secondary">
                <strong>{statistics.posts}</strong> Posts
              </Typography>
            </Box>

            {/* Unread Count */}
            {forum.unreadCount > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VisibilityIcon color="primary" fontSize="small" />
                <Typography variant="body2" color="primary">
                  <strong>{statistics.unread}</strong> Unread
                </Typography>
              </Box>
            )}

            {/* Due Date */}
            {forum.duedate > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EventIcon color="action" fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  <strong>Due:</strong> {new Date(forum.duedate * 1000).toLocaleDateString()}
                </Typography>
              </Box>
            )}

            {/* Subscription Status Indicator */}
            {forum.subscribed && (
              <Chip
                icon={<NotificationsIcon />}
                label="You are subscribed"
                size="small"
                color="primary"
                variant="outlined"
                aria-label="Subscription status: subscribed"
              />
            )}
          </Stack>

          {/* Forum Metadata */}
          {(forum.maxbytes > 0 || forum.maxattachments > 0) && (
            <>
              <Divider sx={{ my: 2 }} />
              <Stack
                direction="row"
                spacing={3}
                sx={{
                  flexWrap: 'wrap',
                  gap: isMobile ? 1 : 2,
                }}
              >
                {forum.maxbytes > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Maximum attachment size
                    </Typography>
                    <Typography variant="body2" color="text.primary">
                      {formatBytes(forum.maxbytes)}
                    </Typography>
                  </Box>
                )}
                {forum.maxattachments > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Maximum attachments
                    </Typography>
                    <Typography variant="body2" color="text.primary">
                      {forum.maxattachments}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </>
          )}
        </CardContent>
      </Card>

      {/* Empty State - No discussions */}
      {forum.discussionCount === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            No discussions yet. {canAddDiscussion ? 'Be the first to start a discussion!' : ''}
          </Typography>
        </Alert>
      )}

      {/* Discussion List */}
      {forum.discussionCount > 0 && user && (
        <DiscussionList
          courseId={courseId}
          forumId={forumId}
          currentUser={{
            id: user.id,
            name: user.fullname || 'Unknown User',
          }}
          permissions={{
            canModerate: forum.canModerate,
            canPin: forum.canModerate,
            canLock: forum.canModerate,
            canDelete: forum.canModerate,
          }}
        />
      )}

      {/* Create Discussion Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={handleCloseCreateDialog}
        maxWidth="md"
        fullWidth
        aria-labelledby="create-discussion-dialog-title"
      >
        <DialogTitle id="create-discussion-dialog-title">Create New Discussion</DialogTitle>
        <DialogContent>
          <PostForm
            mode="create"
            forumId={forumId}
            discussionId={undefined}
            onSuccess={handleSubmitSuccess}
            onCancel={handleCloseCreateDialog}
            showSubject
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ForumView;
