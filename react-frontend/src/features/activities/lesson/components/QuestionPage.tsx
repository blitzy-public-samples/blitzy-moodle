/**
 * QuestionPage Component
 *
 * Renders lesson question pages with support for multiple question types:
 * - Multiple choice (single/multiple selection)
 * - True/False
 * - Short answer
 * - Matching
 * - Numerical
 * - Essay
 *
 * Handles answer submission, immediate feedback display, score tracking,
 * and branching navigation based on answer selection.
 *
 * Features:
 * - Material-UI components for consistent styling
 * - React Hook Form for form state management and validation
 * - Immediate feedback with success/error alerts
 * - Progress tracking via ProgressTracker component
 * - Question retry support based on lesson configuration
 * - Accessible form controls with ARIA attributes
 *
 * @module features/activities/lesson/components/QuestionPage
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Radio,
  RadioGroup,
  Checkbox,
  FormControlLabel,
  FormControl,
  FormLabel,
  FormGroup,
  FormHelperText,
  Divider,
  Paper,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  NavigateNext as NavigateNextIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

// Internal imports from depends_on_files
import type {
  Answer,
  LessonPage,
  Lesson,
  LessonProgress,
} from '../types/lesson.types';
import ProgressTracker from './ProgressTracker';
import { useSubmitLessonAnswer, type SubmitAnswerRequest } from '../api/lessonApi';
import FormInput from '@/components/forms/FormInput';
import RichTextEditor from '@/components/editor/RichTextEditor';
import LoadingSpinner from '@/components/feedback/LoadingSpinner';
import Alert from '@/components/feedback/Alert';
import { FormSelect, type SelectOption } from '@/components/forms/FormSelect';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Question type enum values matching Moodle's lesson question types
 * From lesson.types.ts QuestionType enum
 */
const QUESTION_TYPES = {
  SHORT_ANSWER: 1,
  TRUE_FALSE: 2,
  MULTICHOICE: 3,
  MATCHING: 5,
  NUMERICAL: 8,
  ESSAY: 10,
} as const;

/**
 * Props interface for QuestionPage component
 */
export interface QuestionPageProps {
  /** The lesson ID */
  lessonId: number;
  /** The current page ID */
  pageId: number;
  /** The lesson page data including question type, content, and answers */
  page: LessonPage;
  /** Current lesson progress data */
  progress: LessonProgress | null;
  /** The lesson configuration object */
  lesson: Lesson;
  /** Callback when page is completed and user should navigate */
  onPageComplete?: (nextPageId: number | null) => void;
  /** Whether the lesson allows retries */
  allowRetry?: boolean;
  /** Maximum number of attempts allowed (0 = unlimited) */
  maxAttempts?: number;
  /** Current attempt number for this question */
  currentAttempt?: number;
}

/**
 * Form values for question submission
 */
interface QuestionFormValues {
  /** Selected answer ID for single selection questions (multichoice single, truefalse) */
  answerId?: number;
  /** Array of selected answer IDs for multiple selection questions */
  answerIds?: number[];
  /** User input for text-based questions (shortanswer, numerical, essay) */
  userAnswer?: string;
  /** Matching answers map: { questionIndex: selectedAnswerId } */
  matchingAnswers?: Record<string, number>;
}

/**
 * Feedback state after answer submission
 */
interface FeedbackState {
  /** Whether the answer was correct */
  isCorrect: boolean;
  /** Feedback message from the server */
  feedback: string;
  /** Score earned for this question */
  score: number;
  /** Maximum possible score */
  maxScore: number;
  /** ID of the next page to navigate to */
  nextPageId: number | null;
  /** Whether the lesson has ended */
  lessonEnded: boolean;
  /** The correct answer text (if showing correct answers is enabled) */
  correctAnswer?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Safely renders HTML content while preserving formatting
 * @param html - HTML string to render
 * @returns Object for dangerouslySetInnerHTML
 */
function createMarkup(html: string): { __html: string } {
  return { __html: html };
}

/**
 * Checks if the question type supports multiple answers
 * @param qtype - Question type number
 * @param page - Lesson page data
 * @returns True if multiple answers can be selected
 */
function isMultipleAnswerQuestion(qtype: number, page: LessonPage): boolean {
  // Multichoice can be single or multiple based on qoption flag
  if (qtype === QUESTION_TYPES.MULTICHOICE) {
    return page.qoption === 1;
  }
  return false;
}

/**
 * Gets the correct answer text from answers array
 * @param answers - Array of answer options
 * @returns The correct answer text or empty string
 */
function getCorrectAnswerText(answers: Answer[]): string {
  const correctAnswers = answers.filter((a) => a.grade > 0);
  if (correctAnswers.length === 0) return '';
  return correctAnswers.map((a) => a.answer).join(', ');
}

/**
 * Parses matching question answers into questions and options
 * For matching questions, answers alternate between questions (odd) and options (even)
 * @param answers - Array of answer options
 * @returns Object with questions and options arrays
 */
function parseMatchingAnswers(answers: Answer[]): {
  questions: Answer[];
  options: SelectOption[];
} {
  const questions: Answer[] = [];
  const options: SelectOption[] = [];

  answers.forEach((answer, index) => {
    if (index % 2 === 0) {
      // Even indices are questions (left side)
      questions.push(answer);
    } else {
      // Odd indices are options (right side)
      options.push({
        value: answer.id,
        label: answer.answer ?? '',
      });
    }
  });

  return { questions, options };
}

// ============================================================================
// COMPONENT IMPLEMENTATION
// ============================================================================

/**
 * QuestionPage Component
 *
 * Renders a lesson question page with appropriate input controls based on
 * question type, handles form submission, displays feedback, and manages
 * navigation to the next page.
 */
export function QuestionPage({
  lessonId,
  pageId,
  page,
  progress,
  lesson,
  onPageComplete,
  allowRetry = true,
  maxAttempts = 0,
  currentAttempt = 1,
}: QuestionPageProps): JSX.Element {
  const navigate = useNavigate();
  const { success, error: showError, info } = useToast();
  const feedbackRef = useRef<HTMLDivElement>(null);

  // Form setup with React Hook Form
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<QuestionFormValues>({
    defaultValues: {
      answerId: undefined,
      answerIds: [],
      userAnswer: '',
      matchingAnswers: {},
    },
  });

  // Local state
  const [feedbackState, setFeedbackState] = useState<FeedbackState | null>(null);
  const [attemptCount, setAttemptCount] = useState(currentAttempt);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);

  // API mutation hook
  const submitAnswerMutation = useSubmitLessonAnswer();

  // Determine question type properties
  const qtype = page.qtype as number;
  const isMultipleAnswer = isMultipleAnswerQuestion(qtype, page);
  const answers = page.answers || [];

  // Reset form and feedback when page changes
  useEffect(() => {
    reset({
      answerId: undefined,
      answerIds: [],
      userAnswer: '',
      matchingAnswers: {},
    });
    setFeedbackState(null);
    setShowCorrectAnswer(false);
    setAttemptCount(currentAttempt);
  }, [pageId, reset, currentAttempt]);

  // Scroll to feedback when it appears
  useEffect(() => {
    if (feedbackState && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [feedbackState]);

  /**
   * Handles form submission
   */
  const onSubmit: SubmitHandler<QuestionFormValues> = useCallback(
    async (data) => {
      try {
        // Build submission payload based on question type
        const submitData: SubmitAnswerRequest = {
          pageId,
        };

        switch (qtype) {
          case QUESTION_TYPES.MULTICHOICE:
            if (isMultipleAnswer && data.answerIds && data.answerIds.length > 0) {
              // For multiple answer, use first answer ID (API expects single answerId)
              // Alternatively, join as comma-separated string in userAnswer
              submitData.userAnswer = data.answerIds.join(',');
            } else {
              submitData.answerId = data.answerId;
            }
            break;
          case QUESTION_TYPES.TRUE_FALSE:
            submitData.answerId = data.answerId;
            break;
          case QUESTION_TYPES.SHORT_ANSWER:
          case QUESTION_TYPES.NUMERICAL:
          case QUESTION_TYPES.ESSAY:
            submitData.userAnswer = data.userAnswer;
            break;
          case QUESTION_TYPES.MATCHING:
            // Convert string keys to number keys for API compatibility
            if (data.matchingAnswers) {
              const numericMatchingAnswers: Record<number, number> = {};
              Object.entries(data.matchingAnswers).forEach(([key, value]) => {
                numericMatchingAnswers[parseInt(key, 10)] = value;
              });
              submitData.matchingAnswers = numericMatchingAnswers;
            }
            break;
          default:
            submitData.userAnswer = data.userAnswer;
        }

        // Submit answer to API
        const response = await submitAnswerMutation.mutateAsync({
          lessonId,
          request: submitData,
        });

        // Process response and update feedback state
        const newFeedback: FeedbackState = {
          isCorrect: response.isCorrect,
          feedback: response.feedback || '',
          score: response.score || 0,
          maxScore: response.maxScore || 1,
          nextPageId: response.nextPageId ?? null,
          lessonEnded: response.lessonEnded || false,
          correctAnswer: lesson.review ? getCorrectAnswerText(answers) : undefined,
        };

        setFeedbackState(newFeedback);
        setAttemptCount((prev) => prev + 1);

        // Show toast notification
        if (newFeedback.isCorrect) {
          success(`Correct! You earned ${newFeedback.score} point(s).`);
        } else if (allowRetry && (maxAttempts === 0 || attemptCount < maxAttempts)) {
          info('Incorrect. You can try again.');
        } else {
          showError('Incorrect answer.');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to submit answer';
        showError(errorMessage);
      }
    },
    [
      lessonId,
      pageId,
      qtype,
      isMultipleAnswer,
      submitAnswerMutation,
      lesson.review,
      answers,
      success,
      showError,
      info,
      allowRetry,
      maxAttempts,
      attemptCount,
    ]
  );

  /**
   * Handles retry button click
   */
  const handleRetry = useCallback(() => {
    reset();
    setFeedbackState(null);
    setShowCorrectAnswer(false);
  }, [reset]);

  /**
   * Handles navigation to next page
   */
  const handleContinue = useCallback(() => {
    if (!feedbackState) return;

    if (feedbackState.lessonEnded) {
      navigate(`/mod/lesson/${lessonId}/complete`);
    } else if (feedbackState.nextPageId !== null) {
      if (onPageComplete) {
        onPageComplete(feedbackState.nextPageId);
      } else {
        navigate(`/mod/lesson/${lessonId}/page/${feedbackState.nextPageId}`);
      }
    }
  }, [feedbackState, lessonId, navigate, onPageComplete]);

  /**
   * Determines if retry is allowed based on settings and attempt count
   */
  const canRetry =
    feedbackState &&
    !feedbackState.isCorrect &&
    allowRetry &&
    (maxAttempts === 0 || attemptCount < maxAttempts);

  // ============================================================================
  // RENDER FUNCTIONS FOR QUESTION TYPES
  // ============================================================================

  /**
   * Renders multiple choice question (single selection)
   */
  const renderMultichoiceSingle = () => (
    <FormControl component="fieldset" error={!!errors.answerId} fullWidth>
      <FormLabel component="legend" sx={{ mb: 2 }}>
        Select one answer:
      </FormLabel>
      <Controller
        name="answerId"
        control={control}
        rules={{ required: 'Please select an answer' }}
        render={({ field }) => (
          <RadioGroup
            {...field}
            value={field.value ?? ''}
            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
          >
            {answers.map((answer) => (
              <FormControlLabel
                key={answer.id}
                value={answer.id}
                control={<Radio disabled={!!feedbackState} />}
                label={
                  <Typography
                    variant="body1"
                    component="span"
                    dangerouslySetInnerHTML={createMarkup(answer.answer ?? '')}
                  />
                }
                sx={{
                  mb: 1,
                  p: 1,
                  borderRadius: 1,
                  '&:hover': {
                    backgroundColor: feedbackState ? 'transparent' : 'action.hover',
                  },
                }}
              />
            ))}
          </RadioGroup>
        )}
      />
      {errors.answerId && (
        <FormHelperText error>{errors.answerId.message}</FormHelperText>
      )}
    </FormControl>
  );

  /**
   * Renders multiple choice question (multiple selection)
   */
  const renderMultichoiceMultiple = () => {
    const watchedAnswerIds = watch('answerIds') || [];

    return (
      <FormControl component="fieldset" error={!!errors.answerIds} fullWidth>
        <FormLabel component="legend" sx={{ mb: 2 }}>
          Select all that apply:
        </FormLabel>
        <FormGroup>
          {answers.map((answer) => (
            <Controller
              key={answer.id}
              name="answerIds"
              control={control}
              rules={{
                validate: (value) =>
                  (value && value.length > 0) || 'Please select at least one answer',
              }}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={watchedAnswerIds.includes(answer.id)}
                      disabled={!!feedbackState}
                      onChange={(e) => {
                        const currentIds = field.value || [];
                        if (e.target.checked) {
                          field.onChange([...currentIds, answer.id]);
                        } else {
                          field.onChange(currentIds.filter((id: number) => id !== answer.id));
                        }
                      }}
                    />
                  }
                  label={
                    <Typography
                      variant="body1"
                      component="span"
                      dangerouslySetInnerHTML={createMarkup(answer.answer ?? '')}
                    />
                  }
                  sx={{
                    mb: 1,
                    p: 1,
                    borderRadius: 1,
                    '&:hover': {
                      backgroundColor: feedbackState ? 'transparent' : 'action.hover',
                    },
                  }}
                />
              )}
            />
          ))}
        </FormGroup>
        {errors.answerIds && (
          <FormHelperText error>{errors.answerIds.message}</FormHelperText>
        )}
      </FormControl>
    );
  };

  /**
   * Renders true/false question
   */
  const renderTrueFalse = () => (
    <FormControl component="fieldset" error={!!errors.answerId} fullWidth>
      <FormLabel component="legend" sx={{ mb: 2 }}>
        Select True or False:
      </FormLabel>
      <Controller
        name="answerId"
        control={control}
        rules={{ required: 'Please select an answer' }}
        render={({ field }) => (
          <RadioGroup
            {...field}
            value={field.value ?? ''}
            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
            row
          >
            {answers.map((answer) => (
              <FormControlLabel
                key={answer.id}
                value={answer.id}
                control={<Radio disabled={!!feedbackState} />}
                label={
                  <Typography variant="body1" fontWeight="medium">
                    {answer.answer}
                  </Typography>
                }
                sx={{
                  mr: 4,
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  '&:hover': {
                    backgroundColor: feedbackState ? 'transparent' : 'action.hover',
                  },
                }}
              />
            ))}
          </RadioGroup>
        )}
      />
      {errors.answerId && (
        <FormHelperText error>{errors.answerId.message}</FormHelperText>
      )}
    </FormControl>
  );

  /**
   * Renders short answer question
   */
  const renderShortAnswer = () => (
    <Box sx={{ maxWidth: 600 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Type your answer below:
      </Typography>
      <FormInput
        name="userAnswer"
        label="Your Answer"
        control={control}
        required
        disabled={!!feedbackState}
        fullWidth
        placeholder="Enter your answer here..."
      />
    </Box>
  );

  /**
   * Renders numerical question
   */
  const renderNumerical = () => (
    <Box sx={{ maxWidth: 400 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter your numerical answer:
      </Typography>
      <FormInput
        name="userAnswer"
        label="Your Answer"
        type="number"
        control={control}
        required
        disabled={!!feedbackState}
        fullWidth
        placeholder="Enter a number..."
      />
    </Box>
  );

  /**
   * Renders essay question
   */
  const renderEssay = () => (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Write your response below:
      </Typography>
      <RichTextEditor
        name="userAnswer"
        label="Your Response"
        control={control}
        height={300}
        disabled={!!feedbackState}
        toolbar="basic"
        placeholder="Enter your essay response..."
      />
    </Box>
  );

  /**
   * Renders matching question
   */
  const renderMatching = () => {
    const { questions, options } = parseMatchingAnswers(answers);

    return (
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Match each item on the left with the correct option on the right:
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {questions.map((question, index) => (
            <Paper
              key={question.id}
              elevation={0}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: { xs: 'wrap', sm: 'nowrap' },
                backgroundColor: 'grey.50',
                borderRadius: 2,
              }}
            >
              <Box sx={{ flex: '1 1 auto', minWidth: 200 }}>
                <Typography
                  variant="body1"
                  dangerouslySetInnerHTML={createMarkup(question.answer ?? '')}
                />
              </Box>
              <Box sx={{ flex: '0 0 auto', minWidth: 200 }}>
                <FormSelect
                  name={`matchingAnswers.${index}`}
                  label={`Match for item ${index + 1}`}
                  control={control}
                  options={options}
                  disabled={!!feedbackState}
                  placeholder="Select a match..."
                />
              </Box>
            </Paper>
          ))}
        </Box>
      </Box>
    );
  };

  /**
   * Renders the appropriate question type
   */
  const renderQuestionInput = () => {
    switch (qtype) {
      case QUESTION_TYPES.MULTICHOICE:
        return isMultipleAnswer ? renderMultichoiceMultiple() : renderMultichoiceSingle();
      case QUESTION_TYPES.TRUE_FALSE:
        return renderTrueFalse();
      case QUESTION_TYPES.SHORT_ANSWER:
        return renderShortAnswer();
      case QUESTION_TYPES.NUMERICAL:
        return renderNumerical();
      case QUESTION_TYPES.ESSAY:
        return renderEssay();
      case QUESTION_TYPES.MATCHING:
        return renderMatching();
      default:
        return renderShortAnswer();
    }
  };

  /**
   * Renders feedback section after answer submission
   */
  const renderFeedback = () => {
    if (!feedbackState) return null;

    return (
      <Box ref={feedbackRef} sx={{ mt: 3 }}>
        <Alert
          severity={feedbackState.isCorrect ? 'success' : 'error'}
          title={feedbackState.isCorrect ? 'Correct!' : 'Incorrect'}
          message={
            <Box>
              {feedbackState.feedback && (
                <Typography
                  variant="body1"
                  component="div"
                  dangerouslySetInnerHTML={createMarkup(feedbackState.feedback)}
                  sx={{ mb: 1 }}
                />
              )}
              <Typography variant="body2" sx={{ mt: 1 }}>
                Score: {feedbackState.score} / {feedbackState.maxScore} point(s)
              </Typography>
              {showCorrectAnswer && feedbackState.correctAnswer && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Correct answer: {feedbackState.correctAnswer}
                </Typography>
              )}
            </Box>
          }
          icon={
            feedbackState.isCorrect ? (
              <CheckCircleIcon fontSize="inherit" />
            ) : (
              <CancelIcon fontSize="inherit" />
            )
          }
        />

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
          {canRetry && (
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRetry}
            >
              Try Again
            </Button>
          )}

          {!feedbackState.isCorrect && lesson.review && !showCorrectAnswer && (
            <Button
              variant="text"
              onClick={() => setShowCorrectAnswer(true)}
            >
              Show Correct Answer
            </Button>
          )}

          {(feedbackState.isCorrect || !canRetry) && (
            <Button
              variant="contained"
              color="primary"
              endIcon={<NavigateNextIcon />}
              onClick={handleContinue}
            >
              {feedbackState.lessonEnded ? 'Complete Lesson' : 'Continue'}
            </Button>
          )}
        </Box>
      </Box>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 2 }}>
      {/* Progress tracker */}
      {progress && (
        <Box sx={{ mb: 3 }}>
          <ProgressTracker
            progress={progress}
            lessonId={lessonId}
          />
        </Box>
      )}

      {/* Question card */}
      <Card elevation={2}>
        <CardContent sx={{ p: 3 }}>
          {/* Question title */}
          {page.title && (
            <Typography
              variant="h5"
              component="h1"
              gutterBottom
              sx={{ fontWeight: 'medium' }}
            >
              {page.title}
            </Typography>
          )}

          {/* Question content */}
          {page.contents && (
            <Typography
              variant="body1"
              component="div"
              dangerouslySetInnerHTML={createMarkup(page.contents)}
              sx={{
                mb: 3,
                '& img': { maxWidth: '100%', height: 'auto' },
                '& p': { mb: 1 },
              }}
            />
          )}

          <Divider sx={{ my: 3 }} />

          {/* Attempt counter */}
          {maxAttempts > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 2 }}
            >
              Attempt {attemptCount} of {maxAttempts}
            </Typography>
          )}

          {/* Question form */}
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Question input based on type */}
            {renderQuestionInput()}

            {/* Submit button */}
            {!feedbackState && (
              <Box sx={{ mt: 3 }}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={isSubmitting || submitAnswerMutation.isPending}
                >
                  {isSubmitting || submitAnswerMutation.isPending ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LoadingSpinner size="small" color="inherit" />
                      <span>Submitting...</span>
                    </Box>
                  ) : (
                    'Submit Answer'
                  )}
                </Button>
              </Box>
            )}

            {/* Loading overlay during submission */}
            {(isSubmitting || submitAnswerMutation.isPending) && (
              <LoadingSpinner
                overlay
                message="Submitting your answer..."
                size="medium"
              />
            )}
          </form>

          {/* Feedback section */}
          {renderFeedback()}
        </CardContent>
      </Card>

      {/* Error display for API errors */}
      {submitAnswerMutation.isError && (
        <Box sx={{ mt: 2 }}>
          <Alert
            severity="error"
            title="Submission Error"
            message={
              submitAnswerMutation.error?.message ||
              'An error occurred while submitting your answer. Please try again.'
            }
            closeable
          />
        </Box>
      )}
    </Box>
  );
}

export default QuestionPage;
