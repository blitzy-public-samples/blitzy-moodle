/**
 * ForumPage Component
 *
 * Page component for displaying a forum activity.
 * Extracts forum ID from URL parameters and renders the ForumView component.
 *
 * @module features/activities/forums/pages/ForumPage
 */

import type React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Container, Alert, Button } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { ForumView } from '../components/ForumView';

/**
 * ForumPage Component
 *
 * Renders a complete forum activity page with navigation and error handling.
 */
export const ForumPage: React.FC = () => {
  const { courseId, forumId } = useParams<{ courseId: string; forumId: string }>();
  const navigate = useNavigate();

  // Validate parameters
  if (!courseId || !forumId) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Alert severity="error">
            Invalid forum URL. Course ID and Forum ID are required.
          </Alert>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/courses')}
            sx={{ mt: 2 }}
          >
            Back to Courses
          </Button>
        </Box>
      </Container>
    );
  }

  const courseIdNum = parseInt(courseId, 10);
  const forumIdNum = parseInt(forumId, 10);

  if (isNaN(courseIdNum) || isNaN(forumIdNum)) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Alert severity="error">
            Invalid course ID or forum ID format.
          </Alert>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(`/courses/${courseId}`)}
            sx={{ mt: 2 }}
          >
            Back to Course
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 2, mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/courses/${courseId}`)}
          sx={{ mb: 2 }}
        >
          Back to Course
        </Button>
        <ForumView courseId={courseIdNum} forumId={forumIdNum} />
      </Box>
    </Container>
  );
};

export default ForumPage;
