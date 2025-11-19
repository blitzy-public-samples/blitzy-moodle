/**
 * Quiz Page
 *
 * Main quiz information and landing page displaying quiz details,
 * attempt history, and controls to start new attempts.
 *
 * @module features/activities/quizzes/pages/QuizPage
 */

import type React from 'react';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Visibility as PreviewIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  Timer as TimerIcon,
  Grade as GradeIcon,
} from '@mui/icons-material';
import { useQuiz, useStartQuizAttempt } from '../api/quizApi';
import { GradeMethod, QuizAttemptState } from '../types/quiz.types';
import { format } from 'date-fns';

/**
 * Helper function to convert GradeMethod enum to display string
 * @param gradeMethod - The GradeMethod enum value
 * @returns Human-readable string for the grading method
 */
function getGradeMethodLabel(gradeMethod: GradeMethod): string {
  switch (gradeMethod) {
    case GradeMethod.HIGHEST:
      return 'Highest grade';
    case GradeMethod.AVERAGE:
      return 'Average grade';
    case GradeMethod.FIRST:
      return 'First attempt';
    case GradeMethod.LAST:
      return 'Last attempt';
    default:
      return 'Unknown';
  }
}

/**
 * QuizPage Component
 *
 * Displays quiz information including:
 * - Quiz name and description
 * - Time limits and attempt restrictions
 * - Grading method and passing grade
 * - User's attempt history
 * - Controls to start new attempts
 *
 * @returns Quiz information page
 */
export function QuizPage(): React.ReactElement {
  const { courseId, quizId } = useParams<{ courseId: string; quizId: string }>();
  const navigate = useNavigate();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Parse IDs
  const id = parseInt(quizId || '0', 10);
  const cid = parseInt(courseId || '0', 10);

  // Fetch quiz data
  const { data, isLoading, error } = useQuiz(id, id > 0);

  // Start attempt mutation
  const startAttemptMutation = useStartQuizAttempt();

  /**
   * Handle start new attempt
   */
  const handleStartAttempt = async (): Promise<void> => {
    try {
      const result = await startAttemptMutation.mutateAsync(id);
      // Navigate to attempt page
      navigate(`/courses/${cid}/quizzes/${id}/attempt/${result.attempt.id}`);
    } catch (err) {
      console.error('Failed to start quiz attempt:', err);
    }
  };

  /**
   * Handle view attempt review
   */
  const handleViewAttempt = (attemptId: number): void => {
    navigate(`/courses/${cid}/quizzes/${id}/review/${attemptId}`);
  };

  /**
   * Format time duration in minutes
   */
  const formatDuration = (seconds: number): string => {
    if (seconds === 0) {return 'No time limit';}
    const minutes = Math.floor(seconds / 60);
    // For values <= 90 minutes, show in minutes for clarity
    if (minutes <= 90) {return `${minutes} minute${minutes === 1 ? '' : 's'}`;}
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  };

  /**
   * Format grade
   */
  const formatGrade = (grade: number | null): string => {
    if (grade === null) {return 'Not graded';}
    return grade.toFixed(2);
  };

  /**
   * Get attempt state color
   */
  const getAttemptStateColor = (
    state: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (state) {
      case 'finished':
        return 'success';
      case 'inprogress':
        return 'info';
      case 'abandoned':
        return 'warning';
      case 'overdue':
        return 'error';
      default:
        return 'default';
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading quiz...</Typography>
      </Container>
    );
  }

  // Render error state
  if (error || !data) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          {error?.message || 'Failed to load quiz. Please try again.'}
        </Alert>
      </Container>
    );
  }

  const { quiz, attempts, canAttempt, canPreview, attemptsUsed, attemptsRemaining } = data;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Quiz Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
          <InfoIcon color="primary" sx={{ mr: 2, mt: 0.5, fontSize: 32 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" component="h1" gutterBottom data-testid="quiz-name">
              {quiz.name}
            </Typography>
            {quiz.intro && (
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 2 }}
                dangerouslySetInnerHTML={{ __html: quiz.intro }}
                data-testid="quiz-intro"
              />
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Quiz Information */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <TimerIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Time and Attempts
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Time limit"
                      secondary={formatDuration(quiz.timelimit)}
                      data-testid="quiz-time-limit"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Attempts allowed"
                      secondary={quiz.attempts === 0 ? 'Unlimited' : quiz.attempts}
                      data-testid="quiz-attempts-allowed"
                    />
                  </ListItem>
                  {quiz.attempts > 0 && (
                    <>
                      <ListItem>
                        <ListItemText
                          primary="Attempts used"
                          secondary={attemptsUsed}
                          data-testid="quiz-attempts-used"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Attempts remaining"
                          secondary={attemptsRemaining === null ? 'Unlimited' : attemptsRemaining}
                          data-testid="quiz-attempts-remaining"
                        />
                      </ListItem>
                    </>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <GradeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Grading
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Grading method"
                      secondary={getGradeMethodLabel(quiz.grademethod)}
                      data-testid="quiz-grade-method"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Maximum grade"
                      secondary={quiz.grade}
                      data-testid="quiz-max-grade"
                    />
                  </ListItem>
                  {quiz.questionsperpage !== undefined && (
                    <ListItem>
                      <ListItemText
                        primary="Questions per page"
                        secondary={quiz.questionsperpage === 0 ? 'All on one page' : quiz.questionsperpage}
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Action Buttons */}
        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          {canAttempt && (
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<StartIcon />}
              onClick={() => setConfirmDialogOpen(true)}
              disabled={startAttemptMutation.isPending}
              data-testid="start-attempt-button"
            >
              {startAttemptMutation.isPending ? 'Starting...' : 'Attempt quiz'}
            </Button>
          )}
          {canPreview && (
            <Button
              variant="outlined"
              color="secondary"
              size="large"
              startIcon={<PreviewIcon />}
              data-testid="preview-button"
            >
              Preview
            </Button>
          )}
        </Box>

        {!canAttempt && attemptsRemaining === 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            You have used all your allowed attempts for this quiz.
          </Alert>
        )}

        {startAttemptMutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Failed to start quiz attempt. Please try again.
          </Alert>
        )}
      </Paper>

      {/* Attempt History */}
      {attempts.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Your Attempts
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            {attempts.map((attempt, index) => (
              <Grid item xs={12} key={attempt.id}>
                <Card variant="outlined" data-testid={`attempt-${attempt.id}`}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="h6">
                        Attempt {index + 1}
                      </Typography>
                      <Chip
                        label={attempt.state}
                        color={getAttemptStateColor(attempt.state)}
                        size="small"
                      />
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={4}>
                        <Typography variant="body2" color="text.secondary">
                          Started
                        </Typography>
                        <Typography variant="body1">
                          {attempt.timestart ? format(new Date(attempt.timestart * 1000), 'PPpp') : '-'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Typography variant="body2" color="text.secondary">
                          Completed
                        </Typography>
                        <Typography variant="body1">
                          {attempt.timefinish ? format(new Date(attempt.timefinish * 1000), 'PPpp') : 'In progress'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Typography variant="body2" color="text.secondary">
                          Grade
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {formatGrade(attempt.sumgrades)} / {quiz.grade}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                  {attempt.state === QuizAttemptState.FINISHED && (
                    <CardActions>
                      <Button
                        size="small"
                        startIcon={<PreviewIcon />}
                        onClick={() => handleViewAttempt(attempt.id)}
                        data-testid={`review-attempt-${attempt.id}`}
                      >
                        Review
                      </Button>
                    </CardActions>
                  )}
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Start Quiz Attempt?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to start a new attempt for this quiz?
          </Typography>
          {quiz.timelimit > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              This quiz has a time limit of {formatDuration(quiz.timelimit)}.
              The timer will start as soon as you begin.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              setConfirmDialogOpen(false);
              void handleStartAttempt();
            }}
            variant="contained"
            color="primary"
          >
            Start Attempt
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default QuizPage;
