/**
 * CourseCard Component
 *
 * Displays a course in card format with thumbnail, title, instructor, category,
 * and enrollment information. Used in course catalog and course lists.
 *
 * @module features/courses/components/CourseCard
 */

import type React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Group as GroupIcon,
  Category as CategoryIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import type { CourseListItem } from '../api/courseApi';
import { formatDate } from '@/utils/date';

// ============================================================================
// Types
// ============================================================================

export interface CourseCardProps {
  /** Course data to display */
  course: CourseListItem;
  
  /** Click handler for card */
  onClick?: (courseId: number) => void;
  
  /** Optional className for custom styling */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * CourseCard component displays course information in a card layout
 *
 * Features:
 * - Course thumbnail image
 * - Course title and short name
 * - Course summary (truncated)
 * - Category information
 * - Enrollment count
 * - Progress bar (if enrolled)
 * - Clickable to navigate to course details
 *
 * @param props - Component props
 * @returns Rendered course card
 */
export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  onClick,
  className,
}) => {
  /**
   * Handle card click
   */
  const handleClick = () => {
    if (onClick) {
      onClick(course.id);
    }
  };

  /**
   * Strip HTML tags from summary for display
   */
  const getPlainTextSummary = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  /**
   * Truncate text to specified length
   */
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) {return text;}
    return `${text.substring(0, maxLength).trim()  }...`;
  };

  // Default placeholder image if none provided
  const imageUrl = course.imageurl || 'https://via.placeholder.com/400x200?text=Course+Image';
  
  // Plain text summary
  const plainSummary = course.summary ? getPlainTextSummary(course.summary) : 'No description available';
  const truncatedSummary = truncateText(plainSummary, 150);

  return (
    <Card
      data-testid="course-card"
      data-course-id={course.id}
      className={className}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': onClick ? {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        } : {},
      }}
      onClick={handleClick}
    >
      {/* Course Image */}
      <CardMedia
        component="img"
        height="180"
        image={imageUrl}
        alt={course.fullname}
        data-testid="course-image"
        sx={{ objectFit: 'cover' }}
      />

      {/* Course Content */}
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Course Title */}
        <Typography
          variant="h6"
          component="h3"
          gutterBottom
          data-testid="course-title"
          sx={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            minHeight: '3.6em',
          }}
        >
          {course.fullname}
        </Typography>

        {/* Course Short Name (ID display) */}
        <Typography
          variant="body2"
          color="text.secondary"
          gutterBottom
          data-testid="course-id"
          sx={{ mb: 1.5 }}
        >
          {course.shortname}
        </Typography>

        {/* Course Summary */}
        <Typography
          variant="body2"
          color="text.secondary"
          data-testid="course-description"
          sx={{
            mb: 2,
            flexGrow: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {truncatedSummary}
        </Typography>

        {/* Category */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            mb: 1,
            gap: 0.5,
          }}
        >
          <CategoryIcon fontSize="small" color="action" />
          <Typography
            variant="body2"
            color="text.secondary"
            data-testid="course-category"
          >
            {course.categoryname}
          </Typography>
        </Box>

        {/* Instructor - Using placeholder since not in API response */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            mb: 1,
            gap: 0.5,
          }}
        >
          <GroupIcon fontSize="small" color="action" />
          <Typography
            variant="body2"
            color="text.secondary"
            data-testid="course-instructor"
          >
            Instructor
          </Typography>
        </Box>

        {/* Course Start Date */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            mb: 1,
            gap: 0.5,
          }}
        >
          <CalendarIcon fontSize="small" color="action" />
          <Typography
            variant="body2"
            color="text.secondary"
            data-testid="course-start-date"
          >
            Starts: {formatDate(new Date(course.startdate * 1000))}
          </Typography>
        </Box>

        {/* Course End Date */}
        {course.enddate > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: 1.5,
              gap: 0.5,
            }}
          >
            <CalendarIcon fontSize="small" color="action" />
            <Typography
              variant="body2"
              color="text.secondary"
              data-testid="course-end-date"
            >
              Ends: {formatDate(new Date(course.enddate * 1000))}
            </Typography>
          </Box>
        )}

        {/* Enrollment Count */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Chip
            label={`${course.enrolledusers} students`}
            size="small"
            data-testid="course-enrollment"
            sx={{
              backgroundColor: (theme) => theme.palette.primary.main,
              color: (theme) => theme.palette.primary.contrastText,
            }}
          />
          
          {course.visible === 0 && (
            <Chip
              label="Hidden"
              size="small"
              color="warning"
            />
          )}
        </Box>

        {/* Progress Bar (if enrolled and has progress) */}
        {course.hasprogress && course.progress !== undefined && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Progress
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {course.progress}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={course.progress}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default CourseCard;
