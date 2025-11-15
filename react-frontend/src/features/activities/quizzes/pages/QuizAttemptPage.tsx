/**
 * Quiz Attempt Page
 *
 * Page for taking a quiz attempt with question display, navigation,
 * timer, and answer submission functionality.
 *
 * @module features/activities/quizzes/pages/QuizAttemptPage
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  Send as SubmitIcon,
  Timer as TimerIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useQuiz, useQuizQuestions, useSubmitQuizAttempt } from '../api/quizApi';
import { QuestionRenderer } from '../components/QuestionRenderer';
import { QuizNavigation } from '../components/QuizNavigation';
import type { QuizQuestion } from '../api/quizApi';

/**
 * QuizAttemptPage Component
 *
 * Displays quiz attempt interface including:
 * - Timer countdown (if time limit set)
 * - Current question(s)
 * - Navigation controls
 * - Question navigation sidebar
 * - Answer persistence
 * - Auto-submission on time expiry
 *
 * @returns Quiz attempt taking page
 */
export function QuizAttemptPage(): React.ReactElement {
  const { courseId, quizId, attemptId } = useParams<{ courseId: string; quizId: string; attemptId: string }>();
  const navigate = useNavigate();

  // Parse IDs
  const cid = parseInt(courseId || '0', 10);
  const qid = parseInt(quizId || '0', 10);
  const aid = parseInt(attemptId || '0', 10);

  // Fetch quiz and questions
  const { data: quizData, isLoading: isLoadingQuiz } = useQuiz(qid, qid > 0);
  const { data: questions, isLoading: isLoadingQuestions } = useQuizQuestions(qid, aid, qid > 0 && aid > 0);

  // Submit mutation
  const submitMutation = useSubmitQuizAttempt();

  // Local state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [autoSubmitting, setAutoSubmitting] = useState(false);

  // Ref to always get latest answers value without triggering effect re-runs
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Ref to always call the latest handleAutoSubmit without re-running timer effect
  const handleAutoSubmitRef = useRef<(() => Promise<void>) | null>(null);

  // Ref to track which attempt ID has had its timer initialized
  // This prevents multiple timers when quizData refetches
  const timerAttemptIdRef = useRef<number | null>(null);

  /**
   * Handle auto-submission when time expires
   */
  const handleAutoSubmit = useCallback(async (): Promise<void> => {
    setAutoSubmitting(true);

    try {
      await submitMutation.mutateAsync({
        quizId: qid,
        submission: {
          attemptId: aid,
          answers: answersRef.current,
          timeup: true,
          finalize: true, // Final submission due to time expiration
        },
      });

      // Navigate to review page
      navigate(`/courses/${cid}/quizzes/${qid}/review/${aid}`);
    } catch (err) {
      console.error('Failed to auto-submit quiz:', err);
      setAutoSubmitting(false);
    }
  }, [qid, aid, submitMutation, navigate, cid]);

  // Update ref to always point to latest handleAutoSubmit
  useEffect(() => {
    handleAutoSubmitRef.current = handleAutoSubmit;
  }, [handleAutoSubmit]);

  /**
   * Initialize timer if quiz has time limit
   * Depends on quizData to initialize when data loads, but only initializes once per attempt
   */
  useEffect(() => {
    // Only initialize timer once per attempt - check this FIRST
    if (timerAttemptIdRef.current === aid) {
      return; // Timer already initialized for this attempt
    }

    // Early return if no quiz data yet
    if (!quizData?.quiz.timelimit) {
      return;
    }

    // Calculate time remaining
    const attempt = quizData.attempts.find((a) => a.id === aid);
    if (!attempt) {
      return;
    }

    const elapsed = Date.now() / 1000 - attempt.timestart;
    const remaining = quizData.quiz.timelimit - elapsed;

    if (remaining <= 0) {
      // Time expired - auto submit
      handleAutoSubmitRef.current?.();
      return;
    }

    // Mark this attempt as having timer initialized BEFORE starting the timer
    timerAttemptIdRef.current = aid;
    setTimeRemaining(Math.floor(remaining));

    // Start countdown timer
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleAutoSubmitRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      // Do NOT reset timerAttemptIdRef here - we want it to stay set for this attempt
    };
  }, [quizData, aid]);

  /**
   * Format time remaining as MM:SS
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Handle answer change
   */
  const handleAnswerChange = useCallback((questionSlot: number, answer: string | string[]): void => {
    setAnswers((prev) => ({
      ...prev,
      [questionSlot]: answer,
    }));
  }, []);

  /**
   * Navigate to next question
   */
  const handleNext = (): void => {
    if (questions && currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  /**
   * Navigate to previous question
   */
  const handlePrevious = (): void => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  /**
   * Navigate to specific question
   */
  const handleNavigateToQuestion = (index: number): void => {
    if (questions && index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
    }
  };

  /**
   * Handle quiz submission
   */
  const handleSubmit = async (): Promise<void> => {
    try {
      await submitMutation.mutateAsync({
        quizId: qid,
        submission: {
          attemptId: aid,
          answers,
          timeup: false,
          finalize: true, // Final submission, not auto-save
        },
      });

      // Navigate to review page
      navigate(`/courses/${cid}/quizzes/${qid}/review/${aid}`);
    } catch (err) {
      console.error('Failed to submit quiz:', err);
    }
  };

  /**
   * Get answer status for question
   */
  const getQuestionStatus = (question: QuizQuestion): 'answered' | 'not-answered' => {
    return answers[question.slot] !== undefined ? 'answered' : 'not-answered';
  };

  /**
   * Calculate progress percentage
   */
  const calculateProgress = (): number => {
    if (!questions || questions.length === 0) return 0;
    const answeredCount = questions.filter((q) => answers[q.slot] !== undefined).length;
    return (answeredCount / questions.length) * 100;
  };

  // Render loading state
  if (isLoadingQuiz || isLoadingQuestions) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading quiz...</Typography>
      </Container>
    );
  }

  // Render error state
  if (!quizData || !questions) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">Failed to load quiz. Please try again.</Alert>
      </Container>
    );
  }

  const { quiz } = quizData;
  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = questions.filter((q) => answers[q.slot] !== undefined).length;

  // Auto-submitting state
  if (autoSubmitting) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h5" sx={{ mt: 3 }}>
          Time has expired. Submitting your answers...
        </Typography>
      </Container>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Main Content Area */}
      <Box sx={{ flex: 1, p: 3 }}>
        <Container maxWidth="lg">
          {/* Header */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h5" data-testid="quiz-attempt-title">
                {quiz.name}
              </Typography>
              {timeRemaining !== null && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimerIcon
                    color={timeRemaining < 300 ? 'error' : 'primary'}
                    data-testid="timer-icon"
                  />
                  <Typography
                    variant="h6"
                    color={timeRemaining < 300 ? 'error' : 'primary'}
                    data-testid="timer-display"
                  >
                    {formatTime(timeRemaining)}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Progress Bar */}
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Progress
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {answeredCount} / {questions.length} answered
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={calculateProgress()} />
            </Box>

            {/* Low time warning */}
            {timeRemaining !== null && timeRemaining < 300 && (
              <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 2 }}>
                Less than 5 minutes remaining!
              </Alert>
            )}
          </Paper>

          {/* Question Display */}
          {currentQuestion ? (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ mb: 2 }}>
                <Chip
                  label={`Question ${currentQuestionIndex + 1} of ${questions.length}`}
                  color="primary"
                  data-testid="question-number"
                />
                {answers[currentQuestion.slot] !== undefined && (
                  <Chip label="Answered" color="success" sx={{ ml: 1 }} />
                )}
              </Box>

              <QuestionRenderer
                question={currentQuestion}
                value={answers[currentQuestion.slot]}
                onChange={(value) => handleAnswerChange(currentQuestion.slot, value)}
                disabled={submitMutation.isPending}
              />
            </Paper>
          ) : (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Alert severity="warning">
                No question available at this index.
              </Alert>
            </Paper>
          )}

          {/* Navigation Controls */}
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                startIcon={<PrevIcon />}
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                data-testid="prev-button"
              >
                Previous
              </Button>

              <Typography variant="body2" color="text.secondary">
                Question {currentQuestionIndex + 1} / {questions.length}
              </Typography>

              {currentQuestionIndex < questions.length - 1 ? (
                <Button
                  endIcon={<NextIcon />}
                  onClick={handleNext}
                  variant="contained"
                  data-testid="next-button"
                >
                  Next
                </Button>
              ) : (
                <Button
                  endIcon={<SubmitIcon />}
                  onClick={() => setConfirmSubmitOpen(true)}
                  variant="contained"
                  color="success"
                  disabled={submitMutation.isPending}
                  data-testid="submit-button"
                >
                  {submitMutation.isPending ? 'Submitting...' : 'Submit all and finish'}
                </Button>
              )}
            </Box>

            {submitMutation.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                Failed to submit quiz. Please try again.
              </Alert>
            )}
          </Paper>
        </Container>
      </Box>

      {/* Question Navigation Sidebar */}
      <Box
        sx={{
          width: 280,
          borderLeft: 1,
          borderColor: 'divider',
          p: 2,
          bgcolor: 'background.paper',
          overflowY: 'auto',
        }}
        data-testid="question-navigation-sidebar"
      >
        <Typography variant="h6" gutterBottom>
          Question Navigation
        </Typography>
        <QuizNavigation
          questions={questions}
          currentQuestionIndex={currentQuestionIndex}
          onNavigate={handleNavigateToQuestion}
          getQuestionStatus={getQuestionStatus}
        />

        <Button
          fullWidth
          variant="outlined"
          color="success"
          startIcon={<SubmitIcon />}
          onClick={() => setConfirmSubmitOpen(true)}
          disabled={submitMutation.isPending}
          sx={{ mt: 2 }}
        >
          Finish Attempt
        </Button>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmSubmitOpen}
        onClose={() => setConfirmSubmitOpen(false)}
        data-testid="submit-confirmation-dialog"
      >
        <DialogTitle>Submit Quiz?</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to submit your quiz?
          </Typography>

          {answeredCount < questions.length && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              You have only answered {answeredCount} of {questions.length} questions.
              Unanswered questions will be marked as incorrect.
            </Alert>
          )}

          <Card variant="outlined" sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Summary
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Answered:
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">{answeredCount}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Not answered:
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">{questions.length - answeredCount}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmSubmitOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              setConfirmSubmitOpen(false);
              handleSubmit();
            }}
            variant="contained"
            color="success"
            data-testid="confirm-submit-button"
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default QuizAttemptPage;
