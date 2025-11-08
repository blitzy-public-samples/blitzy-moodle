/**
 * Workshop Submission Display Component
 * 
 * Displays workshop submission content including title, text content, attachments,
 * author information, and submission metadata. Renders submission in read-only view
 * with proper formatting, file previews, and optional author anonymization.
 * 
 * @package    mod_workshop
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Avatar,
  Chip,
  Link,
  Divider,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Paper,
} from '@mui/material';
import {
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  VideoLibrary as VideoIcon,
  AudioFile as AudioIcon,
  Description as DocIcon,
  Download as DownloadIcon,
  Star as StarIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { formatDistanceToNow, format } from 'date-fns';

/**
 * File attachment interface
 */
interface FileAttachment {
  id: number;
  filename: string;
  filesize: number;
  mimetype: string;
  downloadurl: string;
  thumbnailurl?: string;
}

/**
 * User information interface
 */
interface UserInfo {
  id: number;
  fullname: string;
  profileimageurl?: string;
  profileurl: string;
}

/**
 * Workshop submission interface
 */
interface WorkshopSubmission {
  id: number;
  title: string;
  content: string;
  contentformat: number;
  timecreated: number;
  timemodified: number;
  grade?: number;
  gradeover?: number;
  published: boolean;
  late: boolean;
  feedbackauthor?: string;
  feedbackauthorformat?: number;
  attachments: FileAttachment[];
  author?: UserInfo;
}

/**
 * Workshop configuration interface
 */
interface Workshop {
  id: number;
  name: string;
  grade: number;
  anonymoussubmissions: boolean;
}

/**
 * Component props interface
 */
interface SubmissionDisplayProps {
  submission: WorkshopSubmission;
  showAuthor: boolean;
  isExample: boolean;
  workshop: Workshop;
}

/**
 * Get file icon based on MIME type
 */
const getFileIcon = (mimetype: string): React.ReactElement => {
  if (mimetype.startsWith('image/')) {
    return <ImageIcon />;
  } else if (mimetype.startsWith('video/')) {
    return <VideoIcon />;
  } else if (mimetype.startsWith('audio/')) {
    return <AudioIcon />;
  } else if (mimetype === 'application/pdf') {
    return <PdfIcon />;
  } else if (
    mimetype.includes('document') ||
    mimetype.includes('word') ||
    mimetype.includes('text')
  ) {
    return <DocIcon />;
  } else {
    return <FileIcon />;
  }
};

/**
 * Format file size in human-readable format
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * SubmissionDisplay Component
 * 
 * Renders a complete workshop submission with all metadata, content, and attachments.
 * Supports both regular and example submissions with appropriate styling and indicators.
 */
const SubmissionDisplay: React.FC<SubmissionDisplayProps> = ({
  submission,
  showAuthor,
  isExample,
  workshop,
}) => {
  // Determine if author information should be hidden
  const shouldHideAuthor = workshop.anonymoussubmissions || !showAuthor;
  
  // Check if submission has been modified after creation
  const isModified = submission.timemodified > submission.timecreated;

  /**
   * Render author information section
   */
  const renderAuthorInfo = () => {
    if (shouldHideAuthor || !submission.author) {
      return null;
    }

    const { author } = submission;

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 2,
        }}
        role="region"
        aria-label="Author information"
      >
        <Avatar
          src={author.profileimageurl}
          alt={author.fullname}
          sx={{ width: 64, height: 64 }}
        />
        <Box>
          <Link
            href={author.profileurl}
            underline="hover"
            sx={{ fontWeight: 500, fontSize: '1.1rem' }}
            aria-label={`View profile of ${author.fullname}`}
          >
            {author.fullname}
          </Link>
          <Typography variant="body2" color="text.secondary">
            Submitted {formatDistanceToNow(new Date(submission.timecreated * 1000), { addSuffix: true })}
          </Typography>
          {isModified && (
            <Typography variant="caption" color="text.secondary">
              Modified {formatDistanceToNow(new Date(submission.timemodified * 1000), { addSuffix: true })}
            </Typography>
          )}
        </Box>
      </Box>
    );
  };

  /**
   * Render submission status badges
   */
  const renderStatusBadges = () => {
    return (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {isExample && (
          <Chip
            icon={<StarIcon />}
            label="Example Submission"
            color="info"
            size="small"
            aria-label="This is an example submission"
          />
        )}
        {submission.published && (
          <Chip
            icon={<CheckCircleIcon />}
            label="Published"
            color="success"
            size="small"
            aria-label="This submission is published"
          />
        )}
        {submission.late && (
          <Chip
            icon={<WarningIcon />}
            label="Late Submission"
            color="warning"
            size="small"
            aria-label="This submission was submitted late"
          />
        )}
        {!submission.id && (
          <Chip
            icon={<ScheduleIcon />}
            label="Draft"
            color="default"
            size="small"
            aria-label="This submission is in draft status"
          />
        )}
      </Box>
    );
  };

  /**
   * Render submission content with HTML formatting
   */
  const renderContent = () => {
    if (!submission.content || submission.content.trim() === '') {
      return (
        <Typography variant="body2" color="text.secondary" fontStyle="italic">
          No content provided
        </Typography>
      );
    }

    // Content is sanitized server-side in Moodle
    return (
      <Box
        sx={{
          '& img': {
            maxWidth: '100%',
            height: 'auto',
          },
          '& a': {
            color: 'primary.main',
            textDecoration: 'underline',
          },
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
        }}
        dangerouslySetInnerHTML={{ __html: submission.content }}
        role="article"
        aria-label="Submission content"
      />
    );
  };

  /**
   * Render file attachments list
   */
  const renderAttachments = () => {
    if (!submission.attachments || submission.attachments.length === 0) {
      return null;
    }

    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Attachments
        </Typography>
        <List>
          {submission.attachments.map((file) => (
            <ListItem
              key={file.id}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
              secondaryAction={
                <IconButton
                  edge="end"
                  aria-label={`Download ${file.filename}`}
                  href={file.downloadurl}
                  component="a"
                  download
                >
                  <DownloadIcon />
                </IconButton>
              }
            >
              <ListItemIcon>{getFileIcon(file.mimetype)}</ListItemIcon>
              <ListItemText
                primary={file.filename}
                secondary={formatFileSize(file.filesize)}
                primaryTypographyProps={{
                  sx: { wordBreak: 'break-word' },
                }}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  };

  /**
   * Render inline images from attachments
   */
  const renderInlineImages = () => {
    const imageAttachments = submission.attachments?.filter((file) =>
      file.mimetype.startsWith('image/')
    );

    if (!imageAttachments || imageAttachments.length === 0) {
      return null;
    }

    return (
      <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {imageAttachments.map((image) => (
          <Box
            key={image.id}
            component="a"
            href={image.downloadurl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: 'block',
              maxWidth: 200,
              borderRadius: 1,
              overflow: 'hidden',
              '&:hover': {
                opacity: 0.8,
              },
            }}
            aria-label={`View full size image: ${image.filename}`}
          >
            <img
              src={image.thumbnailurl || image.downloadurl}
              alt={image.filename}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </Box>
        ))}
      </Box>
    );
  };

  /**
   * Render PDF preview if attachment is PDF
   */
  const renderPdfPreview = () => {
    const pdfAttachment = submission.attachments?.find(
      (file) => file.mimetype === 'application/pdf'
    );

    if (!pdfAttachment) {
      return null;
    }

    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          PDF Preview
        </Typography>
        <Paper
          elevation={2}
          sx={{
            width: '100%',
            height: 600,
            overflow: 'hidden',
          }}
        >
          <iframe
            src={pdfAttachment.downloadurl}
            width="100%"
            height="100%"
            title={`Preview of ${pdfAttachment.filename}`}
            style={{ border: 'none' }}
          />
        </Paper>
      </Box>
    );
  };

  /**
   * Render grade information if available
   */
  const renderGrade = () => {
    const displayGrade = submission.gradeover ?? submission.grade;

    if (displayGrade === null || displayGrade === undefined) {
      return null;
    }

    return (
      <Box sx={{ mt: 3 }}>
        <Alert severity="info" icon={<CheckCircleIcon />}>
          <Typography variant="body1" fontWeight={500}>
            Grade: {displayGrade} / {workshop.grade}
          </Typography>
          {submission.gradeover !== null && submission.gradeover !== undefined && (
            <Typography variant="caption" color="text.secondary">
              (Overridden by teacher)
            </Typography>
          )}
        </Alert>
      </Box>
    );
  };

  /**
   * Render feedback from teacher
   */
  const renderFeedback = () => {
    if (!submission.feedbackauthor) {
      return null;
    }

    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Feedback from Teacher
        </Typography>
        <Paper
          elevation={1}
          sx={{
            p: 2,
            backgroundColor: 'background.default',
          }}
        >
          <Box
            dangerouslySetInnerHTML={{ __html: submission.feedbackauthor }}
            sx={{
              '& img': {
                maxWidth: '100%',
                height: 'auto',
              },
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            }}
            role="article"
            aria-label="Teacher feedback"
          />
        </Paper>
      </Box>
    );
  };

  /**
   * Render timestamp information
   */
  const renderTimestamps = () => {
    return (
      <Box sx={{ mt: 2, mb: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          Created: {format(new Date(submission.timecreated * 1000), 'PPpp')}
        </Typography>
        {isModified && (
          <Typography variant="caption" color="text.secondary" display="block">
            Modified: {format(new Date(submission.timemodified * 1000), 'PPpp')}
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Card
      sx={{
        width: '100%',
        mb: 3,
        ...(isExample && {
          border: 2,
          borderColor: 'info.main',
        }),
        '@media print': {
          boxShadow: 'none',
          border: '1px solid #ccc',
        },
      }}
      role="article"
      aria-label={`Workshop submission: ${submission.title}`}
    >
      <CardContent>
        {/* Status Badges */}
        {renderStatusBadges()}

        {/* Submission Title */}
        <Typography
          variant="h5"
          component="h2"
          gutterBottom
          sx={{
            fontWeight: 600,
            mb: 2,
            '@media print': {
              fontSize: '1.5rem',
            },
          }}
        >
          {submission.title || 'Untitled Submission'}
        </Typography>

        {/* Author Information */}
        {renderAuthorInfo()}

        {/* Divider */}
        {!shouldHideAuthor && submission.author && <Divider sx={{ my: 2 }} />}

        {/* Timestamps */}
        {renderTimestamps()}

        {/* Submission Content */}
        <Box sx={{ mt: 2, mb: 2 }}>
          {renderContent()}
        </Box>

        {/* Inline Images */}
        {renderInlineImages()}

        {/* File Attachments */}
        {renderAttachments()}

        {/* PDF Preview */}
        {renderPdfPreview()}

        {/* Grade Information */}
        {renderGrade()}

        {/* Teacher Feedback */}
        {renderFeedback()}
      </CardContent>
    </Card>
  );
};

export default SubmissionDisplay;
