/**
 * DiscussionPage Component
 *
 * Page component for displaying a forum discussion thread.
 * Handles routing and parameter extraction for discussion view.
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Box, Button, Alert } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { DiscussionThread } from '../components/DiscussionThread';

/**
 * DiscussionPage component
 * Displays a single discussion thread within a forum
 */
export function DiscussionPage(): React.JSX.Element {
  const { courseId, forumId, discussionId } = useParams<{
    courseId: string;
    forumId: string;
    discussionId: string;
  }>();
  const navigate = useNavigate();

  // Validate route parameters
  const courseIdNum = parseInt(courseId ?? '', 10);
  const forumIdNum = parseInt(forumId ?? '', 10);
  const discussionIdNum = parseInt(discussionId ?? '', 10);

  if (isNaN(courseIdNum) || isNaN(forumIdNum) || isNaN(discussionIdNum)) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Alert severity="error">
            Invalid course ID, forum ID, or discussion ID format.
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
          onClick={() => navigate(`/courses/${courseId}/forums/${forumId}`)}
          sx={{ mb: 2 }}
        >
          Back to Forum
        </Button>
        <DiscussionThread discussionId={discussionIdNum} />
      </Box>
    </Container>
  );
}

export default DiscussionPage;
