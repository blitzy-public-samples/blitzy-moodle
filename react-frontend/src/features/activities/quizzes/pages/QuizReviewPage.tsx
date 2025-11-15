/**
 * Quiz Review Page
 *
 * Page for reviewing completed quiz attempts with results, feedback,
 * and detailed question-by-question analysis.
 *
 * @module features/activities/quizzes/pages/QuizReviewPage
 */

import React, { useState } from 'react';
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
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ExpandMore as ExpandIcon,
  CheckCircle as CorrectIcon,
  Cancel as IncorrectIcon,
  Grade as GradeIcon,
  CalendarToday as DateIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useQuizReview } from '../api/quizApi';
import { format } from 'date-fns';

/**
 * QuizReviewPage Component
 *
 * Displays quiz review interface including:
 * - Overall score and grade
 * - Time taken and submission date
 * - Question-by-question results
 * - Correct/incorrect answers
 * - Feedback for each question
 * - Overall quiz feedback
 *
 * @returns Quiz review page
 */
export function QuizReviewPage(): React.ReactElement {
  const { quizId, attemptId } = useParams<{ quizId: string; attemptId: string }>();
  const navigate = useNavigate();
  const [expandedQuestion, setExpandedQuestion] = useState<number | false>(0);

  // Parse IDs
  const qid = parseInt(quizId || '0', 10);
  const aid = parseInt(attemptId || '0', 10);

  // Fetch review data
  const { data, isLoading, error } = useQuizReview(aid, aid > 0);

  /**
   * Handle question accordion expansion
   */
  const handleQuestionExpand = (questionIndex: number) => (
    _event: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    setExpandedQuestion(isExpanded ? questionIndex : false);
  };

  /**
   * Handle back to quiz
   */
  const handleBack = (): void => {
    navigate(`/quiz/${qid}`);
  };

  /**
   * Format time duration
   */
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  /**
   * Render answer text
   */
  const renderAnswer = (answer: string | string[] | undefined): React.ReactNode => {
    if (!answer) return <em>Not answered</em>;
    if (Array.isArray(answer)) {
      return (
        <ul>
          {answer.map((a, idx) => (
            <li key={idx}>{a}</li>
          ))}
        </ul>
      );
    }
    return answer;
  };

  /**
   * Get grade color
   */
  const getGradeColor = (percentage: number): 'success' | 'warning' | 'error' => {
    if (percentage >= 70) return 'success';
    if (percentage >= 50) return 'warning';
    return 'error';
  };

  // Render loading state
  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading review...</Typography>
      </Container>
    );
  }

  // Render error state
  if (error || !data) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          {error?.message || 'Failed to load quiz review. Please try again.'}
        </Alert>
        <Button startIcon={<BackIcon />} onClick={handleBack} sx={{ mt: 2 }}>
          Back to Quiz
        </Button>
      </Container>
    );
  }

  const { attempt, quiz, questions, grade, maxGrade, percentage, feedback } = data;
  const timeTaken = attempt.timefinish ? attempt.timefinish - attempt.timestart : 0;
  const correctCount = questions.filter((q) => q.isCorrect).length;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Back Button */}
      <Button startIcon={<BackIcon />} onClick={handleBack} sx={{ mb: 2 }}>
        Back to Quiz
      </Button>

      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }} data-testid="quiz-results">
        <Typography variant="h4" gutterBottom data-testid="quiz-review-title">
          {quiz.name} - Review
        </Typography>

        <Divider sx={{ my: 2 }} />

        {/* Summary Cards */}
        <Grid container spacing={3}>
          {/* Grade Card */}
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ height: '100%' }} data-testid="score-summary">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <GradeIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Grade</Typography>
                </Box>
                <Typography variant="h3" color={getGradeColor(percentage)} data-testid="quiz-grade">
                  {grade.toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  out of {maxGrade} ({percentage.toFixed(1)}%)
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={percentage}
                  color={getGradeColor(percentage)}
                  sx={{ mt: 2 }}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Questions Card */}
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <InfoIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Questions</Typography>
                </Box>
                <Typography variant="h3" data-testid="correct-count">
                  {correctCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  out of {questions.length} correct
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Chip
                    icon={<CorrectIcon />}
                    label={`${correctCount} Correct`}
                    color="success"
                    size="small"
                  />
                  <Chip
                    icon={<IncorrectIcon />}
                    label={`${questions.length - correctCount} Incorrect`}
                    color="error"
                    size="small"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Attempt Info Card */}
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <DateIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Attempt Info</Typography>
                </Box>
                <List dense>
                  <ListItem disablePadding>
                    <ListItemText
                      primary="Submitted"
                      secondary={
                        attempt.timefinish
                          ? format(new Date(attempt.timefinish * 1000), 'PPpp')
                          : 'Not finished'
                      }
                      data-testid="submission-time"
                    />
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemText
                      primary="Time taken"
                      secondary={formatDuration(timeTaken)}
                      data-testid="time-taken"
                    />
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemText primary="State" secondary={attempt.state} />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Overall Feedback */}
        {feedback && (
          <Alert severity="info" sx={{ mt: 3 }} data-testid="quiz-feedback">
            <Typography variant="subtitle2" gutterBottom>
              Feedback
            </Typography>
            <div dangerouslySetInnerHTML={{ __html: feedback }} />
          </Alert>
        )}
      </Paper>

      {/* Question-by-Question Review */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Question Review
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {questions.map((question, index) => (
          <Accordion
            key={question.id}
            expanded={expandedQuestion === index}
            onChange={handleQuestionExpand(index)}
            data-testid={`question-${index + 1}`}
          >
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  pr: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {question.isCorrect ? (
                    <CorrectIcon color="success" />
                  ) : (
                    <IncorrectIcon color="error" />
                  )}
                  <Typography>Question {index + 1}</Typography>
                </Box>
                <Chip
                  label={`${question.mark.toFixed(2)} / ${question.maxMark.toFixed(2)}`}
                  size="small"
                  color={question.isCorrect ? 'success' : 'error'}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box>
                {/* Question Text */}
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Question
                </Typography>
                <Typography
                  variant="body1"
                  paragraph
                  dangerouslySetInnerHTML={{ __html: question.questiontext }}
                  data-testid={`question-${index + 1}-text`}
                />

                {/* User Answer */}
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Your Answer
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: question.isCorrect ? 'success.50' : 'error.50',
                    borderRadius: 1,
                    mb: 2,
                  }}
                  data-testid={`question-${index + 1}-user-answer`}
                >
                  {renderAnswer(question.userAnswer)}
                </Box>

                {/* Correct Answer */}
                {!question.isCorrect && question.correctAnswer && (
                  <>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      Correct Answer
                    </Typography>
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: 'success.50',
                        borderRadius: 1,
                        mb: 2,
                      }}
                      data-testid={`question-${index + 1}-correct-answer`}
                    >
                      {renderAnswer(question.correctAnswer)}
                    </Box>
                  </>
                )}

                {/* Feedback */}
                {question.feedback && (
                  <>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      Feedback
                    </Typography>
                    <Alert severity="info" data-testid={`question-${index + 1}-feedback`}>
                      <div dangerouslySetInnerHTML={{ __html: question.feedback }} />
                    </Alert>
                  </>
                )}

                {/* Score */}
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Mark for this question
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {question.mark.toFixed(2)} / {question.maxMark.toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </Paper>

      {/* Action Buttons */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
        <Button variant="contained" onClick={handleBack} size="large">
          Back to Quiz
        </Button>
      </Box>
    </Container>
  );
}

export default QuizReviewPage;
