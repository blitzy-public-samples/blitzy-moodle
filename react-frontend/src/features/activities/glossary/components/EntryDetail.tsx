/**
 * EntryDetail Component
 *
 * React component for displaying individual glossary entry details including:
 * - Concept heading with approval status indicator
 * - Formatted definition content with rich text support
 * - Entry metadata (author, creation date, modification date)
 * - File attachments with download links
 * - Aliases list
 * - Category tags using MUI Chip components
 * - User ratings display (when enabled)
 * - Comment section for entry discussions
 *
 * Based on Moodle's glossary entry display logic from:
 * - public/mod/glossary/showentry.php (lines 22-67)
 * - public/mod/glossary/view.php
 * - public/mod/glossary/lib.php
 *
 * @module features/activities/glossary/components/EntryDetail
 */

import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Chip,
  Avatar,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Alert,
  Tooltip,
  Stack,
  Paper,
  Rating as MuiRating,
} from '@mui/material';
import { Divider } from '@mui/material';
import {
  AttachFile,
  Download,
  Category as CategoryIcon,
  Label as LabelIcon,
  CheckCircle as ApprovedIcon,
  Schedule as PendingIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Update as UpdateIcon,
  Star as StarIcon,
  Comment as CommentIcon,
} from '@mui/icons-material';

import type { GlossaryEntry, GlossaryAttachment, GlossaryTag } from '@/features/activities/glossary/types/glossary.types';
import { formatDate } from '@/utils/date';
import { useEntryComments } from '@/features/activities/glossary/hooks/useComment';
import { useEntryRatings } from '@/features/activities/glossary/hooks/useRating';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the EntryDetail component
 */
export interface EntryDetailProps {
  /**
   * The glossary entry to display.
   * Contains all entry data including concept, definition, attachments, etc.
   */
  entry: GlossaryEntry;

  /**
   * Whether the glossary has ratings enabled.
   * When true, displays the rating section.
   * @default false
   */
  showRatings?: boolean;

  /**
   * Whether the glossary allows comments.
   * When true, displays the comments section.
   * @default false
   */
  showComments?: boolean;

  /**
   * Aliases for the entry (synonyms/keywords).
   * Displayed as a comma-separated list below the definition.
   */
  aliases?: string[];

  /**
   * Display mode - either by entry ID or concept search.
   * Affects how the component is rendered.
   * @default 'entry'
   */
  displayMode?: 'entry' | 'search';

  /**
   * Callback fired when an attachment is clicked for download.
   * If not provided, uses the attachment fileurl directly.
   */
  onAttachmentClick?: (attachment: GlossaryAttachment) => void;

  /**
   * Optional CSS class name for custom styling.
   */
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Component for displaying the approval status badge
 */
interface ApprovalStatusProps {
  approved: boolean;
}

const ApprovalStatus: React.FC<ApprovalStatusProps> = ({ approved }) => {
  if (approved) {
    return (
      <Chip
        icon={<ApprovedIcon />}
        label="Approved"
        color="success"
        size="small"
        variant="outlined"
        sx={{ ml: 1 }}
      />
    );
  }

  return (
    <Chip
      icon={<PendingIcon />}
      label="Pending Approval"
      color="warning"
      size="small"
      variant="outlined"
      sx={{ ml: 1 }}
    />
  );
};

/**
 * Component for displaying a single file attachment
 */
interface AttachmentItemProps {
  attachment: GlossaryAttachment;
  onAttachmentClick?: (attachment: GlossaryAttachment) => void;
}

const AttachmentItem: React.FC<AttachmentItemProps> = ({
  attachment,
  onAttachmentClick,
}) => {
  /**
   * Format file size for human-readable display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleClick = (event: React.MouseEvent) => {
    if (onAttachmentClick) {
      event.preventDefault();
      onAttachmentClick(attachment);
    }
  };

  return (
    <ListItem
      component={Link}
      href={attachment.fileurl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      sx={{
        textDecoration: 'none',
        color: 'inherit',
        '&:hover': {
          backgroundColor: 'action.hover',
        },
        borderRadius: 1,
        py: 1,
        px: 2,
      }}
    >
      <ListItemIcon sx={{ minWidth: 40 }}>
        <Download color="primary" />
      </ListItemIcon>
      <ListItemText
        primary={attachment.filename}
        secondary={`${formatFileSize(attachment.filesize)} • ${attachment.mimetype}`}
        primaryTypographyProps={{
          variant: 'body2',
          fontWeight: 500,
        }}
        secondaryTypographyProps={{
          variant: 'caption',
        }}
      />
    </ListItem>
  );
};

/**
 * Component for displaying category badges
 */
interface CategoryBadgesProps {
  categoryId?: number;
  categoryName?: string;
  tags: GlossaryTag[];
}

const CategoryBadges: React.FC<CategoryBadgesProps> = ({
  categoryId,
  categoryName,
  tags,
}) => {
  const hasCategory = categoryId !== undefined && categoryId > 0 && categoryName;
  const hasTags = tags && tags.length > 0;

  if (!hasCategory && !hasTags) {
    return null;
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {hasCategory && (
          <Chip
            icon={<CategoryIcon />}
            label={categoryName}
            size="small"
            color="primary"
            variant="outlined"
          />
        )}
        {hasTags &&
          tags.map((tag) => (
            <Chip
              key={tag.id}
              icon={<LabelIcon />}
              label={tag.name}
              size="small"
              variant="outlined"
            />
          ))}
      </Stack>
    </Box>
  );
};

/**
 * Component for displaying entry ratings
 */
interface RatingDisplayProps {
  entryId: number;
  enabled: boolean;
}

const RatingDisplay: React.FC<RatingDisplayProps> = ({ entryId, enabled }) => {
  const { data: ratings, isLoading, error } = useEntryRatings(entryId, {
    enabled,
  });

  if (!enabled) {
    return null;
  }

  if (isLoading) {
    return (
      <Box sx={{ mt: 2 }}>
        <Skeleton variant="rectangular" width={200} height={32} />
      </Box>
    );
  }

  if (error || !ratings) {
    return null;
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <StarIcon color="primary" />
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <MuiRating
              value={ratings.average}
              precision={0.5}
              readOnly
              size="small"
            />
            <Typography variant="body2" color="text.secondary">
              ({ratings.average.toFixed(1)})
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {ratings.count} {ratings.count === 1 ? 'rating' : 'ratings'}
            {ratings.userRating !== undefined && (
              <> • Your rating: {ratings.userRating}</>
            )}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
};

/**
 * Component for displaying entry comments
 */
interface CommentsDisplayProps {
  entryId: number;
  enabled: boolean;
}

const CommentsDisplay: React.FC<CommentsDisplayProps> = ({ entryId, enabled }) => {
  const { data, isLoading, error } = useEntryComments(entryId, {
    enabled,
    perPage: 5,
    sortOrder: 'newest',
  });

  if (!enabled) {
    return null;
  }

  if (isLoading) {
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          <CommentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Comments
        </Typography>
        <Skeleton variant="rectangular" height={100} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="warning" variant="outlined">
          Unable to load comments
        </Alert>
      </Box>
    );
  }

  const comments = data?.comments || [];
  const totalComments = data?.pagination?.total || 0;

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        <CommentIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
        Comments ({totalComments})
      </Typography>

      {comments.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          No comments yet. Be the first to comment!
        </Typography>
      ) : (
        <List disablePadding>
          {comments.map((comment, index) => (
            <React.Fragment key={comment.id}>
              {index > 0 && <Divider component="li" />}
              <ListItem
                alignItems="flex-start"
                sx={{ px: 0, py: 1.5 }}
              >
                <Avatar
                  src={comment.userpictureurl}
                  alt={comment.userfullname}
                  sx={{ mr: 2, width: 32, height: 32 }}
                >
                  {comment.userfullname.charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                  >
                    <Typography variant="subtitle2">
                      {comment.userfullname}
                    </Typography>
                    <Tooltip title={formatDate(comment.timecreated * 1000, 'PPpp')}>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(comment.timecreated * 1000)}
                      </Typography>
                    </Tooltip>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {comment.content}
                  </Typography>
                </Box>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      )}

      {totalComments > 5 && (
        <Typography
          variant="body2"
          color="primary"
          sx={{ mt: 1, cursor: 'pointer' }}
        >
          View all {totalComments} comments
        </Typography>
      )}
    </Paper>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * EntryDetail - Displays complete glossary entry details
 *
 * This component renders a comprehensive view of a glossary entry including
 * the concept heading, rich text definition, metadata, attachments, categories,
 * ratings, and comments.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <EntryDetail entry={glossaryEntry} />
 *
 * // With ratings and comments enabled
 * <EntryDetail
 *   entry={glossaryEntry}
 *   showRatings={true}
 *   showComments={true}
 *   aliases={['synonym1', 'synonym2']}
 * />
 *
 * // With custom attachment handler
 * <EntryDetail
 *   entry={glossaryEntry}
 *   onAttachmentClick={(attachment) => handleDownload(attachment)}
 * />
 * ```
 */
export const EntryDetail: React.FC<EntryDetailProps> = ({
  entry,
  showRatings = false,
  showComments = false,
  aliases = [],
  displayMode = 'entry',
  onAttachmentClick,
  className,
}) => {
  /**
   * Format timestamps to display dates with human-readable format.
   * Moodle timestamps are in seconds, so we multiply by 1000 for JavaScript.
   */
  const formattedCreatedDate = useMemo(() => {
    if (!entry.timecreated) return null;
    return formatDate(entry.timecreated * 1000, 'PPP');
  }, [entry.timecreated]);

  const formattedModifiedDate = useMemo(() => {
    if (!entry.timemodified) return null;
    return formatDate(entry.timemodified * 1000, 'PPP');
  }, [entry.timemodified]);

  /**
   * Tooltip content for dates showing precise timestamp
   */
  const createdDateTooltip = useMemo(() => {
    if (!entry.timecreated) return '';
    return formatDate(entry.timecreated * 1000, 'PPPPpppp');
  }, [entry.timecreated]);

  const modifiedDateTooltip = useMemo(() => {
    if (!entry.timemodified) return '';
    return formatDate(entry.timemodified * 1000, 'PPPPpppp');
  }, [entry.timemodified]);

  /**
   * Check if entry has attachments
   */
  const hasAttachments =
    entry.attachment && entry.attachments && entry.attachments.length > 0;

  /**
   * Check if entry has aliases
   */
  const hasAliases = aliases && aliases.length > 0;

  /**
   * Render the card header with concept and author avatar
   */
  const renderCardHeader = () => (
    <CardHeader
      avatar={
        <Avatar
          src={entry.userpictureurl}
          alt={entry.userfullname}
          sx={{ width: 48, height: 48 }}
        >
          {entry.userfullname?.charAt(0) || 'U'}
        </Avatar>
      }
      title={
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography
            variant="h5"
            component="h1"
            sx={{ fontWeight: 600 }}
          >
            {entry.concept}
          </Typography>
          <ApprovalStatus approved={entry.approved} />
        </Box>
      }
      subheader={
        <Typography variant="body2" color="text.secondary">
          by {entry.userfullname}
        </Typography>
      }
      sx={{
        '& .MuiCardHeader-content': {
          overflow: 'hidden',
        },
      }}
    />
  );

  /**
   * Render the definition content with HTML support
   * Using dangerouslySetInnerHTML for rich text content from Moodle
   */
  const renderDefinition = () => (
    <Box sx={{ mt: 2 }}>
      <Typography
        component="div"
        variant="body1"
        sx={{
          '& p': { margin: '0.5em 0' },
          '& img': { maxWidth: '100%', height: 'auto' },
          '& a': { color: 'primary.main' },
          lineHeight: 1.7,
        }}
        dangerouslySetInnerHTML={{ __html: entry.definition }}
      />
    </Box>
  );

  /**
   * Render the metadata section (dates)
   */
  const renderMetadata = () => (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mt: 3,
        backgroundColor: 'grey.50',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={3}
        divider={<Divider orientation="vertical" flexItem />}
      >
        {/* Author */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <PersonIcon fontSize="small" color="action" />
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Author
            </Typography>
            <Typography variant="body2">{entry.userfullname}</Typography>
          </Box>
        </Stack>

        {/* Date Created */}
        {formattedCreatedDate && (
          <Tooltip title={createdDateTooltip} placement="top">
            <Stack direction="row" alignItems="center" spacing={1}>
              <CalendarIcon fontSize="small" color="action" />
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Created
                </Typography>
                <Typography variant="body2">{formattedCreatedDate}</Typography>
              </Box>
            </Stack>
          </Tooltip>
        )}

        {/* Date Modified */}
        {formattedModifiedDate && entry.timemodified !== entry.timecreated && (
          <Tooltip title={modifiedDateTooltip} placement="top">
            <Stack direction="row" alignItems="center" spacing={1}>
              <UpdateIcon fontSize="small" color="action" />
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Last Modified
                </Typography>
                <Typography variant="body2">{formattedModifiedDate}</Typography>
              </Box>
            </Stack>
          </Tooltip>
        )}
      </Stack>
    </Paper>
  );

  /**
   * Render the attachments section
   */
  const renderAttachments = () => {
    if (!hasAttachments) return null;

    return (
      <Box sx={{ mt: 3 }}>
        <Divider sx={{ mb: 2 }} />
        <Typography
          variant="subtitle2"
          sx={{ mb: 1, display: 'flex', alignItems: 'center' }}
        >
          <AttachFile sx={{ mr: 1, fontSize: 20 }} />
          Attachments ({entry.attachments.length})
        </Typography>
        <Paper variant="outlined">
          <List disablePadding>
            {entry.attachments.map((attachment, index) => (
              <React.Fragment key={`${attachment.filename}-${index}`}>
                {index > 0 && <Divider component="li" />}
                <AttachmentItem
                  attachment={attachment}
                  onAttachmentClick={onAttachmentClick}
                />
              </React.Fragment>
            ))}
          </List>
        </Paper>
      </Box>
    );
  };

  /**
   * Render the aliases section
   */
  const renderAliases = () => {
    if (!hasAliases) return null;

    return (
      <Box sx={{ mt: 3 }}>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Aliases / Keywords
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {aliases.join(', ')}
        </Typography>
      </Box>
    );
  };

  /**
   * Render category badges and tags
   */
  const renderCategories = () => (
    <CategoryBadges
      categoryId={entry.categoryid}
      categoryName={entry.categoryname}
      tags={entry.tags || []}
    />
  );

  return (
    <Card
      className={className}
      elevation={1}
      sx={{
        maxWidth: '100%',
        '& .MuiCardContent-root': {
          '&:last-child': {
            pb: 3,
          },
        },
      }}
    >
      {/* Card Header with Concept and Author */}
      {renderCardHeader()}

      <Divider />

      <CardContent>
        {/* Definition Content */}
        {renderDefinition()}

        {/* Category Badges and Tags */}
        {renderCategories()}

        {/* Metadata (Author, Dates) */}
        {renderMetadata()}

        {/* Attachments Section */}
        {renderAttachments()}

        {/* Aliases Section */}
        {renderAliases()}

        {/* Ratings Section */}
        <RatingDisplay entryId={entry.id} enabled={showRatings} />

        {/* Comments Section */}
        <CommentsDisplay entryId={entry.id} enabled={showComments} />
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Default Export
// ============================================================================

export default EntryDetail;
