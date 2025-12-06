/**
 * QuizReview Component
 *
 * Comprehensive quiz review component for viewing completed quiz attempts with questions,
 * submitted answers, correct answers, feedback, and grade breakdown. Supports both
 * student review mode for self-assessment and teacher review mode with additional
 * grading information and commenting capabilities.
 *
 * Features:
 * - Display attempt summary header with score, grade, time taken, submission time
 * - Render each question using QuestionRenderer in read-only review mode
 * - Show submitted answer highlighted with MUI styling
 * - Display correct answer when review settings allow
 * - Show question feedback with color-coded indicators (green/red/orange)
 * - Display marks awarded vs maximum marks for each question
 * - Show general quiz feedback based on grade achieved
 * - Navigate between questions using QuizNavigation component
 * - Toggle between "Show all questions" and paginated view
 * - Display teacher comments using MUI Accordion
 * - Show detailed grading breakdown for complex question types
 * - Print view option for offline review
 * - React Query integration for data fetching with caching
 * - Handle different review options (immediate, later, after quiz closes)
 * - Display grade calculation details for partial credit
 * - Support file attachment viewing for essay responses
 * - Show question history if multiple attempts allowed
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Chip,
  Divider,
  Button,
  IconButton,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
  Tooltip,
  Paper,
  Stack,
  Link,
  useTheme,
} from '@mui/material';
import {
  Print as PrintIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  RemoveCircle as PartialIcon,
  Download as DownloadIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  ArrowBack as ArrowBackIcon,
  HelpOutline as UnansweredIcon,
} from '@mui/icons-material';

// Internal imports from depends_on_files
import {
  QuizAttemptState,
  QuestionState,
  type QuestionNavigationState,
} from '../types/quiz.types';
import { QuizNavigation } from './QuizNavigation';
import {
  getAttemptReview,
  quizQueryKeys,
  type AttemptReviewResponse,
  type QuizReviewQuestion,
} from '../api/quizApi';
import Card from '../../../../components/data-display/Card';
import { Alert } from '../../../../components/feedback/Alert';
import { LoadingSpinner } from '../../../../components/feedback/LoadingSpinner';
import { formatNumber, formatGrade } from '../../../../utils/formatters';
import { formatDuration, formatDateTime } from '../../../../utils/date';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Props interface for the QuizReview component
 */
export interface QuizReviewProps {
  /**
   * Attempt ID to review. If not provided, extracted from URL params.
   */
  attemptId?: number;

  /**
   * Whether to enable teacher review mode with additional grading features
   * @default false
   */
  teacherMode?: boolean;

  /**
   * Callback fired when navigating back to quiz view
   */
  onBack?: () => void;

  /**
   * Optional custom className for styling
   */
  className?: string;
}

/**
 * Question status type for visual indicators
 */
type QuestionStatus = 'correct' | 'incorrect' | 'partial' | 'unanswered';

/**
 * Review display options configuration
 */
interface ReviewDisplayConfig {
  showCorrectAnswers: boolean;
  showFeedback: boolean;
  showMarks: boolean;
  showGeneralFeedback: boolean;
  showTeacherComments: boolean;
}

/**
 * File attachment interface for essay questions
 */
interface FileAttachment {
  filename: string;
  url: string;
  mimetype?: string;
  size?: number;
}

/**
 * Grading breakdown item for complex questions
 */
interface GradingBreakdownItem {
  criterion: string;
  marks: number;
  maxMarks: number;
  feedback?: string;
}

/**
 * Answer history entry for multiple attempts
 */
interface AnswerHistoryEntry {
  timestamp: number;
  answer: string | string[] | Record<string, string>;
  marks?: number;
}

/**
 * Extended review question with additional data
 */
interface ExtendedReviewQuestion extends QuizReviewQuestion {
  teacherComment?: string;
  attachments?: FileAttachment[];
  gradingBreakdown?: GradingBreakdownItem[];
  history?: AnswerHistoryEntry[];
  isAnswered?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines the status of a question based on marks and correct flag
 * @param question - The review question
 * @returns Question status indicator
 */
function getQuestionStatus(question: QuizReviewQuestion): QuestionStatus {
  // Check if the question was answered based on response
  const hasResponse = question.response !== undefined && 
    question.response !== null && 
    question.response !== '';
  
  if (!hasResponse) {
    return 'unanswered';
  }
  
  // If correct is explicitly set, use it
  if (question.correct === true) {
    return 'correct';
  }
  if (question.correct === false) {
    return 'incorrect';
  }
  
  // Use fraction to determine partial credit
  if (question.fraction !== null && question.fraction !== undefined) {
    if (question.fraction >= 1) {
      return 'correct';
    }
    if (question.fraction > 0) {
      return 'partial';
    }
    return 'incorrect';
  }
  
  // Fall back to mark comparison
  if (question.mark !== null && question.mark !== undefined) {
    if (question.mark >= question.maxmark) {
      return 'correct';
    }
    if (question.mark > 0) {
      return 'partial';
    }
  }
  
  return 'incorrect';
}

/**
 * Gets the color for a question status
 * @param status - Question status
 * @returns MUI color string
 */
function getStatusColor(status: QuestionStatus): 'success' | 'error' | 'warning' | 'default' {
  switch (status) {
    case 'correct':
      return 'success';
    case 'incorrect':
      return 'error';
    case 'partial':
      return 'warning';
    default:
      return 'default';
  }
}

/**
 * Gets the icon for a question status
 * @param status - Question status
 * @returns React icon element
 */
function getStatusIcon(status: QuestionStatus): React.ReactNode {
  switch (status) {
    case 'correct':
      return <CheckCircleIcon color="success" fontSize="small" />;
    case 'incorrect':
      return <CancelIcon color="error" fontSize="small" />;
    case 'partial':
      return <PartialIcon color="warning" fontSize="small" />;
    default:
      return <UnansweredIcon color="disabled" fontSize="small" />;
  }
}

/**
 * Gets the status label text
 * @param status - Question status
 * @returns Status label string
 */
function getStatusLabel(status: QuestionStatus): string {
  switch (status) {
    case 'correct':
      return 'Correct';
    case 'incorrect':
      return 'Incorrect';
    case 'partial':
      return 'Partially Correct';
    default:
      return 'Not Answered';
  }
}

/**
 * Formats the grade percentage for display
 * @param grade - Raw grade value
 * @param maxGrade - Maximum possible grade
 * @returns Formatted percentage string
 */
function formatGradePercentage(grade: number | null, maxGrade: number): string {
  if (grade === null || maxGrade <= 0) return '0.00%';
  const percentage = (grade / maxGrade) * 100;
  return `${formatNumber(percentage, 2)}%`;
}

/**
 * Gets the severity for the general feedback alert based on grade percentage
 * @param gradePercentage - Grade as a percentage (0-100)
 * @returns Alert severity
 */
function getFeedbackSeverity(gradePercentage: number): 'success' | 'warning' | 'error' | 'info' {
  if (gradePercentage >= 80) return 'success';
  if (gradePercentage >= 60) return 'info';
  if (gradePercentage >= 40) return 'warning';
  return 'error';
}

/**
 * Gets the grade label based on percentage
 * @param percentage - Grade percentage
 * @returns Grade label string
 */
function getGradeLabel(percentage: number): string {
  if (percentage >= 80) return 'Excellent';
  if (percentage >= 60) return 'Good';
  if (percentage >= 40) return 'Needs Improvement';
  return 'Below Average';
}

/**
 * Format response for display
 * @param response - The response value
 * @returns Formatted string
 */
function formatResponse(
  response: string | string[] | Record<string, string> | undefined
): string {
  if (response === undefined || response === null) {
    return 'Not answered';
  }
  if (Array.isArray(response)) {
    return response.join(', ');
  }
  if (typeof response === 'object') {
    return Object.values(response).join(', ');
  }
  return String(response);
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Question Review Card component for displaying a single question with feedback
 */
interface QuestionReviewCardProps {
  question: ExtendedReviewQuestion;
  questionNumber: number;
  displayConfig: ReviewDisplayConfig;
  isCurrentQuestion: boolean;
  teacherMode: boolean;
}

const QuestionReviewCard: React.FC<QuestionReviewCardProps> = ({
  question,
  questionNumber,
  displayConfig,
  isCurrentQuestion,
  teacherMode,
}) => {
  const theme = useTheme();
  const status = getQuestionStatus(question);
  const statusColor = getStatusColor(status);

  // Determine if this is an essay question with file attachments
  const hasFileAttachments = question.attachments && question.attachments.length > 0;

  // Get display number for the question
  const displayNumber = question.displaynumber || String(questionNumber);

  return (
    <Card
      elevation={isCurrentQuestion ? 3 : 1}
      sx={{
        mb: 3,
        border: isCurrentQuestion ? `2px solid ${theme.palette.primary.main}` : undefined,
        scrollMarginTop: '100px',
      }}
    >
      {/* Question Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          backgroundColor: theme.palette.grey[50],
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" component="h3">
            Question {displayNumber}
          </Typography>
          <Chip
            icon={getStatusIcon(status) as React.ReactElement}
            label={getStatusLabel(status)}
            color={statusColor}
            size="small"
            variant="outlined"
          />
        </Box>
        {displayConfig.showMarks && (
          <Typography variant="body2" color="text.secondary">
            <strong>{formatNumber(question.mark ?? 0, 2)}</strong> / {formatNumber(question.maxmark, 2)} marks
          </Typography>
        )}
      </Box>

      {/* Question Content */}
      <Box sx={{ p: 2 }}>
        {/* Question Text */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" component="div">
            <div dangerouslySetInnerHTML={{ __html: question.questiontext ?? '' }} />
          </Typography>
        </Box>

        {/* Submitted Answer Highlight */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mt: 2,
            backgroundColor: theme.palette.action.hover,
            borderLeft: `4px solid ${theme.palette.primary.main}`,
          }}
        >
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Your Answer:
          </Typography>
          <Typography variant="body1">
            {question.responseSummary || formatResponse(question.response)}
          </Typography>
        </Paper>

        {/* Correct Answer Display */}
        {displayConfig.showCorrectAnswers && question.rightAnswer && (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mt: 2,
              backgroundColor: `${theme.palette.success.light}20`,
              borderLeft: `4px solid ${theme.palette.success.main}`,
            }}
          >
            <Typography variant="subtitle2" color="success.dark" gutterBottom>
              Correct Answer:
            </Typography>
            <Typography variant="body1">
              {question.rightAnswer}
            </Typography>
          </Paper>
        )}

        {/* Question Specific Feedback */}
        {displayConfig.showFeedback && question.specificFeedback && (
          <Box sx={{ mt: 2 }}>
            <Alert
              severity={
                status === 'correct' ? 'success' : 
                status === 'partial' ? 'warning' : 
                status === 'incorrect' ? 'error' : 'info'
              }
              title="Feedback"
              message={
                <div dangerouslySetInnerHTML={{ __html: question.specificFeedback }} />
              }
            />
          </Box>
        )}

        {/* General Question Feedback */}
        {displayConfig.showGeneralFeedback && question.generalFeedback && (
          <Box sx={{ mt: 2 }}>
            <Alert
              severity="info"
              title="General Feedback"
              message={
                <div dangerouslySetInnerHTML={{ __html: question.generalFeedback }} />
              }
            />
          </Box>
        )}

        {/* Grading Breakdown for Complex Questions */}
        {teacherMode && question.gradingBreakdown && question.gradingBreakdown.length > 0 && (
          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Grading Breakdown</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                {question.gradingBreakdown.map((item, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      py: 0.5,
                      borderBottom: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Typography variant="body2">{item.criterion}</Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {formatNumber(item.marks, 2)} / {formatNumber(item.maxMarks, 2)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        )}

        {/* File Attachments for Essay Questions */}
        {hasFileAttachments && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              File Attachments:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {question.attachments?.map((file, index) => (
                <Chip
                  key={index}
                  icon={<DownloadIcon />}
                  label={file.filename}
                  variant="outlined"
                  clickable
                  component={Link}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ my: 0.5 }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Question History for Multiple Attempts */}
        {question.history && question.history.length > 0 && (
          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon fontSize="small" />
                <Typography variant="subtitle2">Answer History</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                {question.history.map((entry, index) => (
                  <Box
                    key={index}
                    sx={{
                      p: 1.5,
                      backgroundColor: theme.palette.grey[50],
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(new Date(entry.timestamp * 1000))}
                    </Typography>
                    <Typography variant="body2">
                      {formatResponse(entry.answer)}
                    </Typography>
                    {entry.marks !== undefined && (
                      <Typography variant="caption" color="text.secondary">
                        Marks: {formatNumber(entry.marks, 2)}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Teacher Comments */}
        {displayConfig.showTeacherComments && question.teacherComment && (
          <Accordion defaultExpanded sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" color="primary">
                Teacher Comment
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                <div dangerouslySetInnerHTML={{ __html: question.teacherComment }} />
              </Typography>
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
    </Card>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * QuizReview Component
 *
 * Main component for reviewing completed quiz attempts. Displays comprehensive
 * information about the attempt including all questions, answers, feedback,
 * and grade breakdown.
 */
function QuizReview({
  attemptId: propAttemptId,
  teacherMode = false,
  onBack,
  className,
}: QuizReviewProps): JSX.Element {
  const theme = useTheme();
  const params = useParams<{ attemptId: string }>();
  
  // Extract attempt ID from props or URL params
  const attemptId = propAttemptId ?? (params.attemptId ? parseInt(params.attemptId, 10) : 0);

  // State for view configuration
  const [showAllQuestions, setShowAllQuestions] = useState<boolean>(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);

  // Fetch review data using React Query
  const {
    data: reviewData,
    isLoading,
    error,
    isError,
  } = useQuery<AttemptReviewResponse>({
    queryKey: quizQueryKeys.review(attemptId),
    queryFn: () => getAttemptReview(attemptId),
    enabled: attemptId > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    retry: 2,
  });

  // Determine display configuration based on review settings
  const displayConfig: ReviewDisplayConfig = useMemo(() => {
    if (!reviewData?.displayOptions) {
      return {
        showCorrectAnswers: true,
        showFeedback: true,
        showMarks: true,
        showGeneralFeedback: true,
        showTeacherComments: teacherMode,
      };
    }
    
    const opts = reviewData.displayOptions;
    return {
      showCorrectAnswers: opts.rightanswer ?? true,
      showFeedback: opts.feedback ?? true,
      showMarks: (opts.marks !== undefined && opts.marks > 0) || true,
      showGeneralFeedback: opts.generalfeedback ?? true,
      showTeacherComments: teacherMode,
    };
  }, [reviewData?.displayOptions, teacherMode]);

  // Handle print functionality
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Handle question navigation
  const handleQuestionClick = useCallback((index: number) => {
    setCurrentQuestionIndex(index);
    if (!showAllQuestions) {
      // Scroll to question element if in paginated mode
      const questionElement = document.getElementById(`question-${index}`);
      questionElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showAllQuestions]);

  // Handle flag toggle (no-op for review mode but required by QuizNavigation)
  const handleFlagToggle = useCallback(() => {
    // No-op - flagging is disabled during review
  }, []);

  // Handle finish attempt (no-op for review mode but required by QuizNavigation)
  const handleFinishAttempt = useCallback(() => {
    // No-op - attempt is already finished
  }, []);

  // Prepare navigation state from questions
  const navigationState: QuestionNavigationState[] = useMemo(() => {
    if (!reviewData?.questions) return [];
    
    // Helper to map question state strings to QuestionState enum values
    const mapStateToQuestionState = (state: string | undefined): QuestionState | undefined => {
      if (!state) return undefined;
      const stateMap: Record<string, QuestionState> = {
        'todo': QuestionState.TODO,
        'complete': QuestionState.COMPLETE,
        'invalid': QuestionState.INVALID,
        'needsgrading': QuestionState.NEEDS_GRADING,
        'graded': QuestionState.GRADED,
        'gaveup': QuestionState.GAVE_UP,
        // Map graded variants to GRADED state
        'gradedright': QuestionState.GRADED,
        'gradedwrong': QuestionState.GRADED,
        'gradedpartial': QuestionState.GRADED,
      };
      return stateMap[state.toLowerCase()] || QuestionState.TODO;
    };
    
    return reviewData.questions.map((q, index) => {
      const hasResponse = q.response !== undefined && 
        q.response !== null && 
        q.response !== '';
      
      return {
        slot: q.slot,
        number: q.displaynumber || String(index + 1),
        answered: hasResponse,
        flagged: q.flagged,
        page: q.page,
        isCurrentQuestion: index === currentQuestionIndex,
        state: mapStateToQuestionState(q.state),
        canNavigate: true,
      };
    });
  }, [reviewData?.questions, currentQuestionIndex]);

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ py: 8 }}>
        <LoadingSpinner 
          size="large" 
          message="Loading quiz review..." 
          ariaLabel="Loading quiz review data"
        />
      </Box>
    );
  }

  // Error state
  if (isError || !reviewData) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert
          severity="error"
          title="Unable to Load Review"
          message={
            error instanceof Error 
              ? error.message 
              : 'Failed to load quiz review. Please try again later.'
          }
        />
        {onBack && (
          <Box sx={{ mt: 2 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={onBack}
              variant="outlined"
            >
              Back to Quiz
            </Button>
          </Box>
        )}
      </Box>
    );
  }

  const { attempt, quiz, questions, grade, maxGrade, overallFeedback } = reviewData;
  
  // Calculate grade percentage for feedback styling
  const gradePercentage = maxGrade > 0 && grade !== null
    ? (grade / maxGrade) * 100 
    : 0;

  // Calculate time taken from attempt timestamps
  const timeTaken = (attempt.timefinish ?? 0) > 0 && attempt.timestart > 0
    ? (attempt.timefinish ?? 0) - attempt.timestart
    : 0;

  // Determine which questions to display based on view mode
  const questionsToDisplay: QuizReviewQuestion[] = showAllQuestions 
    ? questions 
    : [questions[currentQuestionIndex]].filter((q): q is QuizReviewQuestion => q !== undefined);

  return (
    <Box className={className} sx={{ '@media print': { p: 2 } }}>
      {/* Header with navigation and actions */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
          '@media print': { display: 'none' },
        }}
      >
        {onBack && (
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            variant="outlined"
          >
            Back to Quiz
          </Button>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={showAllQuestions}
                onChange={(e) => setShowAllQuestions(e.target.checked)}
              />
            }
            label="Show all questions"
          />
          <Tooltip title="Print review">
            <IconButton onClick={handlePrint} aria-label="Print quiz review">
              <PrintIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Quiz Title */}
      <Typography variant="h4" component="h1" gutterBottom>
        {quiz.name} - Review
      </Typography>

      {/* Attempt Summary Card */}
      <Card elevation={2} sx={{ mb: 3 }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Attempt Summary
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Grid container spacing={3}>
            {/* Score */}
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Score
              </Typography>
              <Typography variant="h5" component="div">
                {formatGrade(grade ?? 0, maxGrade, 2)}
              </Typography>
            </Grid>

            {/* Grade Percentage */}
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Grade
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h5" component="div">
                  {formatGradePercentage(grade, maxGrade)}
                </Typography>
                <Chip
                  size="small"
                  label={getGradeLabel(gradePercentage)}
                  color={
                    gradePercentage >= 80 ? 'success' :
                    gradePercentage >= 60 ? 'info' :
                    gradePercentage >= 40 ? 'warning' : 'error'
                  }
                />
              </Box>
            </Grid>

            {/* Time Taken */}
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Time Taken
              </Typography>
              <Typography variant="h5" component="div">
                {timeTaken > 0 ? formatDuration(timeTaken) : 'N/A'}
              </Typography>
            </Grid>

            {/* Submission Time */}
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Submitted
              </Typography>
              <Typography variant="body1">
                {(attempt.timefinish ?? 0) > 0
                  ? formatDateTime(new Date((attempt.timefinish ?? 0) * 1000)) 
                  : 'Not submitted'}
              </Typography>
            </Grid>
          </Grid>

          {/* Attempt Status */}
          {attempt.state && (
            <Box sx={{ mt: 2 }}>
              <Chip
                label={`Status: ${attempt.state}`}
                color={
                  attempt.state === QuizAttemptState.FINISHED ? 'success' :
                  attempt.state === QuizAttemptState.ABANDONED ? 'error' : 'default'
                }
                variant="outlined"
              />
            </Box>
          )}

          {/* Teacher Mode Additional Info */}
          {teacherMode && (
            <Box sx={{ mt: 2, p: 2, backgroundColor: `${theme.palette.info.light}20`, borderRadius: 1 }}>
              <Typography variant="subtitle2" color="info.dark" gutterBottom>
                <InfoIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                Teacher Information
              </Typography>
              <Typography variant="body2">
                Attempt #{attempt.attempt} by User ID: {attempt.userid}
              </Typography>
              {attempt.currentpage !== undefined && (
                <Typography variant="body2">
                  Last page viewed: {attempt.currentpage + 1}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Card>

      {/* General Quiz Feedback */}
      {displayConfig.showGeneralFeedback && overallFeedback && (
        <Box sx={{ mb: 3 }}>
          <Alert
            severity={getFeedbackSeverity(gradePercentage)}
            title="Overall Feedback"
            message={
              <div dangerouslySetInnerHTML={{ __html: overallFeedback }} />
            }
          />
        </Box>
      )}

      {/* Main Content Area */}
      <Grid container spacing={3}>
        {/* Question Navigation Sidebar (when not showing all questions) */}
        {!showAllQuestions && navigationState.length > 0 && (
          <Grid item xs={12} md={3} sx={{ '@media print': { display: 'none' } }}>
            <Box sx={{ position: 'sticky', top: 16 }}>
              <QuizNavigation
                questions={navigationState}
                currentQuestionIndex={currentQuestionIndex}
                onQuestionClick={handleQuestionClick}
                onFlagToggle={handleFlagToggle}
                onFinishAttempt={handleFinishAttempt}
                navigationMode="free"
                isSequential={false}
              />
            </Box>
          </Grid>
        )}

        {/* Questions Display Area */}
        <Grid item xs={12} md={showAllQuestions ? 12 : 9}>
          {/* Questions */}
          {questionsToDisplay.map((question, index) => {
            const actualIndex = showAllQuestions ? index : currentQuestionIndex;
            return (
              <Box key={question.id} id={`question-${actualIndex}`}>
                <QuestionReviewCard
                  question={question as ExtendedReviewQuestion}
                  questionNumber={actualIndex + 1}
                  displayConfig={displayConfig}
                  isCurrentQuestion={!showAllQuestions}
                  teacherMode={teacherMode}
                />
              </Box>
            );
          })}

          {/* Pagination Controls for Single Question View */}
          {!showAllQuestions && questions.length > 1 && (
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                mt: 3,
                '@media print': { display: 'none' },
              }}
            >
              <Button
                variant="outlined"
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
              >
                Previous Question
              </Button>
              <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                Question {currentQuestionIndex + 1} of {questions.length}
              </Typography>
              <Button
                variant="outlined"
                disabled={currentQuestionIndex === questions.length - 1}
                onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              >
                Next Question
              </Button>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Print-only Footer */}
      <Box 
        sx={{ 
          display: 'none', 
          '@media print': { 
            display: 'block', 
            mt: 4, 
            pt: 2, 
            borderTop: '1px solid #ccc' 
          } 
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Quiz: {quiz.name} | Attempt: #{attempt.attempt} | 
          Printed: {new Date().toLocaleString()}
        </Typography>
      </Box>
    </Box>
  );
}

// Set display name for debugging
QuizReview.displayName = 'QuizReview';

export default QuizReview;
