/**
 * LessonView Component
 *
 * Top-level lesson overview component that displays lesson introduction, settings,
 * attempt history, grading information, and navigation to start or continue lesson attempts.
 * Serves as the main entry point for the lesson activity interface.
 *
 * Features:
 * - Display lesson title, description, and introduction content
 * - Show lesson settings and requirements (time limit, password, dependencies)
 * - Render attempt history table with scores, dates, and review links
 * - Display grading information (grade method, passing threshold, current grade)
 * - Action buttons to start, continue, or retake lessons
 * - Handle lesson access restrictions (time, password, dependencies)
 * - Teacher-only information (reports, statistics) when applicable
 * - Offline attempt synchronization warnings
 * - Feature flag support for gradual rollout
 *
 * References:
 * - public/mod/lesson/view.php for main view logic
 * - public/mod/lesson/locallib.php for lesson constants and functions
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Divider,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Replay as RetakeIcon,
  Visibility as ReviewIcon,
  Lock as LockIcon,
  Timer as TimerIcon,
  Assessment as GradeIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  BarChart as StatsIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { format, intervalToDuration } from 'date-fns';
import { useForm, type Control, type FieldValues } from 'react-hook-form';

// Internal imports from depends_on_files
import type { LessonAttempt } from '../types/lesson.types';
import ProgressTracker from './ProgressTracker';
import { useStartLessonAttempt } from '../api/lessonApi';
import { useLesson, useLessonAttempts, useLessonProgress } from '../hooks/useLesson';
import { usePermissions } from '../../../auth/hooks/usePermissions';
import Alert from '../../../../components/feedback/Alert';
import LoadingSpinner from '../../../../components/feedback/LoadingSpinner';
import { Modal } from '../../../../components/feedback/Modal';
import { DataTable, type DataTableColumn } from '../../../../components/data-display/DataTable';
import Card from '../../../../components/data-display/Card';
import FormInput from '../../../../components/forms/FormInput';

/**
 * Password form interface for type-safe form handling
 */
interface PasswordFormData {
  password: string;
}

/**
 * Interface for lesson restriction status
 */
interface LessonRestriction {
  type: 'time' | 'password' | 'dependency' | 'attempts';
  message: string;
  accessible: boolean;
}

/**
 * Props interface for LessonView component
 */
export interface LessonViewProps {
  /** Optional lesson ID override (defaults to URL param) */
  lessonId?: number;
  /** Optional callback when lesson starts */
  onLessonStart?: (attemptId: number) => void;
  /** Optional callback when navigation occurs */
  onNavigate?: (path: string) => void;
}

/**
 * Format duration from seconds to human-readable string
 */
const formatTimeFromSeconds = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '—';
  
  const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
  const parts: string[] = [];
  
  if (duration.hours && duration.hours > 0) {
    parts.push(`${duration.hours}h`);
  }
  if (duration.minutes && duration.minutes > 0) {
    parts.push(`${duration.minutes}m`);
  }
  if (duration.seconds && duration.seconds > 0) {
    parts.push(`${duration.seconds}s`);
  }
  
  return parts.length > 0 ? parts.join(' ') : '< 1s';
};

/**
 * Get grade method display name
 */
const getGradeMethodLabel = (method: string): string => {
  const methods: Record<string, string> = {
    highest: 'Highest Score',
    average: 'Average Score',
    first: 'First Attempt',
    last: 'Last Attempt',
  };
  return methods[method] || method;
};

/**
 * LessonView Component
 *
 * Main lesson overview component providing the entry point for lesson activities.
 * Displays all relevant lesson information and handles access control, attempt
 * management, and navigation to lesson content.
 */
export default function LessonView({
  lessonId: propLessonId,
  onLessonStart,
  onNavigate,
}: LessonViewProps): JSX.Element {
  // Router hooks
  const navigate = useNavigate();
  const { id: urlLessonId } = useParams<{ id: string }>();
  
  // Determine lesson ID from props or URL
  const lessonId = propLessonId ?? parseInt(urlLessonId || '0', 10);
  
  // State management
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  
  // Permission hooks
  const { hasCapability } = usePermissions();
  
  // Data fetching hooks
  const {
    data: lessonData,
    isLoading: isLoadingLesson,
    error: lessonError,
    refetch: refetchLesson,
  } = useLesson(lessonId);
  
  const {
    data: attemptsData,
    isLoading: isLoadingAttempts,
    error: attemptsError,
    refetch: refetchAttempts,
  } = useLessonAttempts(lessonId);
  
  // Progress tracking hook
  const { data: progressData } = useLessonProgress(lessonId);
  
  // Mutation hooks
  const startLessonMutation = useStartLessonAttempt();
  
  // Form setup for password entry
  const { control, handleSubmit, reset: resetForm } = useForm<PasswordFormData>({
    defaultValues: {
      password: '',
    },
  });
  
  // Extract lesson and attempts from response data
  // Note: hooks already return unwrapped data (LessonDetailsResponse and LessonAttemptsResponse)
  const lesson = lessonData;
  const attempts: LessonAttempt[] = attemptsData?.attempts || [];
  
  // Extract progress data
  // progressData is LessonProgressResponse which extends LessonProgress
  const progress = progressData;
  
  // Calculate context ID for permission checks
  const contextId = lesson?.cmid || 0;
  
  // Permission checks
  const canManageLesson = useMemo(() => {
    return hasCapability('mod/lesson:manage', { type: 'module', contextId });
  }, [hasCapability, contextId]);
  
  const canEditLesson = useMemo(() => {
    return hasCapability('mod/lesson:edit', { type: 'module', contextId });
  }, [hasCapability, contextId]);
  
  const canViewReports = useMemo(() => {
    return hasCapability('mod/lesson:viewreports', { type: 'module', contextId });
  }, [hasCapability, contextId]);

  /**
   * Calculate lesson restrictions and accessibility status
   */
  const restrictions = useMemo((): LessonRestriction[] => {
    if (!lesson) return [];
    
    const restrictionsList: LessonRestriction[] = [];
    const now = Date.now() / 1000;
    
    // Time-based restrictions
    if (lesson.available && lesson.available > now) {
      restrictionsList.push({
        type: 'time',
        message: `This lesson will be available from ${format(new Date(lesson.available * 1000), 'MMM dd, yyyy HH:mm')}`,
        accessible: false,
      });
    }
    
    if (lesson.deadline && lesson.deadline < now) {
      restrictionsList.push({
        type: 'time',
        message: `This lesson closed on ${format(new Date(lesson.deadline * 1000), 'MMM dd, yyyy HH:mm')}`,
        accessible: false,
      });
    }
    
    // Password restriction
    if (lesson.usepassword && !lessonData?.passwordVerified) {
      restrictionsList.push({
        type: 'password',
        message: 'This lesson requires a password to access',
        accessible: false,
      });
    }
    
    // Dependency restrictions
    if (lesson.dependency && !lessonData?.dependencySatisfied) {
      restrictionsList.push({
        type: 'dependency',
        message: `You must complete "${lessonData?.dependencyName || 'the prerequisite lesson'}" first`,
        accessible: false,
      });
    }
    
    // Maximum attempts restriction
    if (lesson.maxattempts && lesson.maxattempts > 0) {
      const userAttempts = attempts.filter((a) => a.completed).length;
      if (userAttempts >= lesson.maxattempts && !lesson.retake) {
        restrictionsList.push({
          type: 'attempts',
          message: `You have reached the maximum number of attempts (${lesson.maxattempts})`,
          accessible: false,
        });
      }
    }
    
    return restrictionsList;
  }, [lesson, lessonData, attempts]);

  /**
   * Check if lesson is currently accessible
   */
  const isAccessible = useMemo(() => {
    if (canManageLesson) return true;
    return restrictions.every((r) => r.accessible !== false);
  }, [restrictions, canManageLesson]);

  /**
   * Get the current in-progress attempt if any
   */
  const inProgressAttempt = useMemo(() => {
    return attempts.find((a) => !a.completed);
  }, [attempts]);

  /**
   * Get completed attempts for display
   */
  const completedAttempts = useMemo(() => {
    return attempts.filter((a) => a.completed).sort((a, b) => (b.timecreated ?? 0) - (a.timecreated ?? 0));
  }, [attempts]);

  /**
   * Calculate best grade from completed attempts
   */
  const bestGrade = useMemo(() => {
    if (completedAttempts.length === 0) return null;
    return Math.max(...completedAttempts.map((a) => a.grade || 0));
  }, [completedAttempts]);

  /**
   * Calculate average grade from completed attempts
   */
  const averageGrade = useMemo(() => {
    if (completedAttempts.length === 0) return null;
    const sum = completedAttempts.reduce((acc, a) => acc + (a.grade || 0), 0);
    return sum / completedAttempts.length;
  }, [completedAttempts]);

  /**
   * Get the grade to display based on grade method
   */
  const displayGrade = useMemo(() => {
    if (completedAttempts.length === 0) return null;
    
    const gradeMethod = lesson?.usemaxgrade ? 'highest' : (lesson?.gradeMethod || 'highest');
    
    switch (gradeMethod) {
      case 'highest':
        return bestGrade;
      case 'average':
        return averageGrade;
      case 'first':
        return completedAttempts[completedAttempts.length - 1]?.grade || null;
      case 'last':
        return completedAttempts[0]?.grade || null;
      default:
        return bestGrade;
    }
  }, [lesson, completedAttempts, bestGrade, averageGrade]);

  /**
   * Handle starting a new lesson attempt
   */
  const handleStartLesson = useCallback(async () => {
    // Check for password requirement
    if (lesson?.usepassword && !lessonData?.passwordVerified) {
      setPasswordModalOpen(true);
      return;
    }
    
    try {
      const result = await startLessonMutation.mutateAsync({
        lessonId,
      });
      
      if (result?.firstPageId) {
        // Use retryNumber as attemptId for the callback
        onLessonStart?.(result.retryNumber);
        
        const path = `/mod/lesson/view/${lessonId}/page/${result.firstPageId}`;
        if (onNavigate) {
          onNavigate(path);
        } else {
          navigate(path);
        }
      }
    } catch (error) {
      console.error('Failed to start lesson:', error);
    }
  }, [lesson, lessonData, lessonId, startLessonMutation, onLessonStart, onNavigate, navigate]);

  /**
   * Handle continuing an in-progress attempt
   */
  const handleContinueLesson = useCallback(() => {
    if (!inProgressAttempt) return;
    
    const lastPageId = inProgressAttempt.pageid || lesson?.firstpageid;
    const path = `/mod/lesson/view/${lessonId}/page/${lastPageId}`;
    
    if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
  }, [inProgressAttempt, lesson, lessonId, onNavigate, navigate]);

  /**
   * Handle retaking the lesson
   */
  const handleRetakeLesson = useCallback(async () => {
    try {
      const result = await startLessonMutation.mutateAsync({
        lessonId,
      });
      
      if (result?.firstPageId) {
        // Use retryNumber as attemptId for the callback
        onLessonStart?.(result.retryNumber);
        
        const path = `/mod/lesson/view/${lessonId}/page/${result.firstPageId}`;
        if (onNavigate) {
          onNavigate(path);
        } else {
          navigate(path);
        }
      }
    } catch (error) {
      console.error('Failed to start lesson retake:', error);
    }
  }, [lessonId, startLessonMutation, onLessonStart, onNavigate, navigate]);

  /**
   * Handle viewing a previous attempt review
   */
  const handleReviewAttempt = useCallback((attemptId: number) => {
    const path = `/mod/lesson/review/${lessonId}/attempt/${attemptId}`;
    if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
  }, [lessonId, onNavigate, navigate]);

  /**
   * Handle password form submission
   */
  const handlePasswordSubmit = useCallback(async (data: PasswordFormData) => {
    setIsVerifyingPassword(true);
    setPasswordError(null);
    
    try {
      // Verify password with the API
      const response = await fetch(`/api/v1/lesson/${lessonId}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: data.password }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setPasswordModalOpen(false);
        resetForm();
        // Refetch lesson data with password verified
        await refetchLesson();
        // Now start the lesson
        handleStartLesson();
      } else {
        setPasswordError(result.error?.message || 'Incorrect password. Please try again.');
      }
    } catch (error) {
      setPasswordError('Failed to verify password. Please try again.');
    } finally {
      setIsVerifyingPassword(false);
    }
  }, [lessonId, resetForm, refetchLesson, handleStartLesson]);

  /**
   * Handle navigating to lesson reports
   */
  const handleViewReports = useCallback(() => {
    const path = `/mod/lesson/report/${lessonId}`;
    if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
  }, [lessonId, onNavigate, navigate]);

  /**
   * Handle navigating to lesson edit
   */
  const handleEditLesson = useCallback(() => {
    const path = `/mod/lesson/edit/${lessonId}`;
    if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
  }, [lessonId, onNavigate, navigate]);

  /**
   * Define columns for attempt history table
   */
  const attemptColumns: DataTableColumn<LessonAttempt>[] = useMemo(() => [
    {
      field: 'retry',
      headerName: 'Attempt',
      width: 100,
      sortable: true,
      renderCell: (params) => (
        <Typography variant="body2">
          #{(params.row.retry || 0) + 1}
        </Typography>
      ),
    },
    {
      field: 'grade',
      headerName: 'Score',
      width: 120,
      sortable: true,
      renderCell: (params) => {
        const grade = params.row.grade;
        const maxGrade = lesson?.grade || 100;
        const percentage = grade !== null && grade !== undefined 
          ? Math.round((grade / maxGrade) * 100) 
          : null;
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" fontWeight="medium">
              {grade !== null && grade !== undefined ? `${grade}/${maxGrade}` : '—'}
            </Typography>
            {percentage !== null && (
              <Chip
                size="small"
                label={`${percentage}%`}
                color={percentage >= (lesson?.passinggrade || 70) ? 'success' : 'default'}
              />
            )}
          </Box>
        );
      },
    },
    {
      field: 'timecreated',
      headerName: 'Date',
      width: 180,
      sortable: true,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.row.timecreated 
            ? format(new Date(params.row.timecreated * 1000), 'MMM dd, yyyy HH:mm')
            : '—'}
        </Typography>
      ),
    },
    {
      field: 'timetaken',
      headerName: 'Time Taken',
      width: 120,
      sortable: true,
      renderCell: (params) => {
        const timeTaken = params.row.timemodified && params.row.timecreated
          ? params.row.timemodified - params.row.timecreated
          : null;
        return (
          <Typography variant="body2">
            {timeTaken ? formatTimeFromSeconds(timeTaken) : '—'}
          </Typography>
        );
      },
    },
    {
      field: 'completed',
      headerName: 'Status',
      width: 120,
      sortable: true,
      renderCell: (params) => (
        <Chip
          size="small"
          icon={params.row.completed ? <CheckIcon /> : <TimerIcon />}
          label={params.row.completed ? 'Completed' : 'In Progress'}
          color={params.row.completed ? 'success' : 'warning'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Tooltip title="Review Attempt">
          <span>
            <IconButton
              size="small"
              onClick={() => handleReviewAttempt(params.row.id)}
              disabled={!params.row.completed}
              aria-label={`Review attempt ${(params.row.retry || 0) + 1}`}
            >
              <ReviewIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ),
    },
  ], [lesson, handleReviewAttempt]);

  // Loading state
  if (isLoadingLesson) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
        }}
      >
        <LoadingSpinner size="large" message="Loading lesson..." />
      </Box>
    );
  }

  // Error state
  if (lessonError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          title="Failed to Load Lesson"
          message={lessonError.message || 'An error occurred while loading the lesson. Please try again.'}
          action={
            <Button onClick={() => refetchLesson()} variant="outlined" size="small">
              Retry
            </Button>
          }
        />
      </Box>
    );
  }

  // No lesson found
  if (!lesson) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="warning"
          title="Lesson Not Found"
          message="The requested lesson could not be found. Please check the URL and try again."
        />
      </Box>
    );
  }

  // Check if retakes are allowed
  const canRetake = lesson.retake && 
    (!lesson.maxattempts || completedAttempts.length < lesson.maxattempts);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Offline sync warning */}
      {lessonData?.hasOfflineAttempts && (
        <Alert
          severity="warning"
          title="Offline Attempts Detected"
          message="You have offline attempts that need to be synchronized. Please ensure you have an internet connection."
          closeable
          sx={{ mb: 3 }}
        />
      )}

      {/* Teacher action bar */}
      {(canManageLesson || canEditLesson || canViewReports) && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
            mb: 2,
          }}
        >
          {canViewReports && (
            <Button
              variant="outlined"
              startIcon={<StatsIcon />}
              onClick={handleViewReports}
              size="small"
            >
              View Reports
            </Button>
          )}
          {canEditLesson && (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleEditLesson}
              size="small"
            >
              Edit Lesson
            </Button>
          )}
        </Box>
      )}

      {/* Lesson Introduction Card */}
      <Card
        title={lesson.name}
        subtitle={lesson.activityname || 'Lesson Activity'}
        elevation={2}
        sx={{ mb: 3 }}
      >
        {/* Introduction content */}
        {lesson.intro && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body1" component="div">
              <div dangerouslySetInnerHTML={{ __html: lesson.intro }} />
            </Typography>
          </Box>
        )}

        {/* Progress tracker for current attempt */}
        {progress && inProgressAttempt && (
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Current Progress
            </Typography>
            <ProgressTracker
              lessonId={lessonId}
              progress={progress}
              maxScore={lesson.grade || 100}
              showStatistics={false}
            />
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Action buttons */}
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {/* Start button - for first attempt */}
          {!inProgressAttempt && completedAttempts.length === 0 && isAccessible && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<StartIcon />}
              onClick={handleStartLesson}
              disabled={startLessonMutation.isPending}
              size="large"
            >
              {startLessonMutation.isPending ? 'Starting...' : 'Start Lesson'}
            </Button>
          )}

          {/* Continue button - for in-progress attempt */}
          {inProgressAttempt && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<StartIcon />}
              onClick={handleContinueLesson}
              size="large"
            >
              Continue Lesson
            </Button>
          )}

          {/* Retake button - for completed attempts when retakes allowed */}
          {!inProgressAttempt && completedAttempts.length > 0 && canRetake && isAccessible && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<RetakeIcon />}
              onClick={handleRetakeLesson}
              disabled={startLessonMutation.isPending}
              size="large"
            >
              {startLessonMutation.isPending ? 'Starting...' : 'Retake Lesson'}
            </Button>
          )}

          {/* Review last attempt button */}
          {completedAttempts[0] && (
            <Button
              variant="outlined"
              startIcon={<ReviewIcon />}
              onClick={() => {
                const lastAttempt = completedAttempts[0];
                if (lastAttempt) {
                  handleReviewAttempt(lastAttempt.id);
                }
              }}
              size="large"
            >
              Review Last Attempt
            </Button>
          )}
        </Stack>
      </Card>

      {/* Access Restrictions Card */}
      {restrictions.length > 0 && (
        <Card title="Access Restrictions" elevation={1} sx={{ mb: 3 }}>
          <Stack spacing={2}>
            {restrictions.map((restriction, index) => (
              <Alert
                key={`restriction-${index}`}
                severity={restriction.accessible ? 'success' : 'warning'}
                message={restriction.message}
                icon={
                  restriction.type === 'password' ? <LockIcon /> :
                  restriction.type === 'time' ? <TimerIcon /> :
                  restriction.type === 'dependency' ? <InfoIcon /> :
                  <WarningIcon />
                }
              />
            ))}
          </Stack>
        </Card>
      )}

      {/* Lesson Settings Card */}
      <Card title="Lesson Settings" elevation={1} sx={{ mb: 3 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 2,
          }}
        >
          {/* Time limit */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Time Limit
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <TimerIcon fontSize="small" color="action" />
              <Typography variant="body1">
                {lesson.timelimit 
                  ? formatTimeFromSeconds(lesson.timelimit)
                  : 'No time limit'}
              </Typography>
            </Box>
          </Box>

          {/* Maximum attempts */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Maximum Attempts
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              {lesson.maxattempts && lesson.maxattempts > 0
                ? `${lesson.maxattempts} attempt${lesson.maxattempts > 1 ? 's' : ''}`
                : 'Unlimited'}
            </Typography>
          </Box>

          {/* Retake policy */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Retakes Allowed
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              {lesson.retake ? (
                <>
                  <CheckIcon fontSize="small" color="success" />
                  <Typography variant="body1" color="success.main">Yes</Typography>
                </>
              ) : (
                <>
                  <CancelIcon fontSize="small" color="error" />
                  <Typography variant="body1" color="error.main">No</Typography>
                </>
              )}
            </Box>
          </Box>

          {/* Availability dates */}
          {lesson.available && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Available From
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5 }}>
                {format(new Date(lesson.available * 1000), 'MMM dd, yyyy HH:mm')}
              </Typography>
            </Box>
          )}

          {lesson.deadline && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Deadline
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5 }}>
                {format(new Date(lesson.deadline * 1000), 'MMM dd, yyyy HH:mm')}
              </Typography>
            </Box>
          )}

          {/* Password protected */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Password Protected
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              {lesson.usepassword ? (
                <>
                  <LockIcon fontSize="small" color="warning" />
                  <Typography variant="body1" color="warning.main">Yes</Typography>
                </>
              ) : (
                <>
                  <CheckIcon fontSize="small" color="success" />
                  <Typography variant="body1" color="text.secondary">No</Typography>
                </>
              )}
            </Box>
          </Box>

          {/* Dependencies */}
          {lesson.dependency && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Prerequisite Lesson
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5 }}>
                {lesson.dependencyName || `Lesson ID: ${lesson.dependency}`}
              </Typography>
            </Box>
          )}
        </Box>
      </Card>

      {/* Grading Information Card */}
      <Card title="Grading Information" elevation={1} sx={{ mb: 3 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
            gap: 3,
          }}
        >
          {/* Grade method */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Grade Method
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <GradeIcon fontSize="small" color="action" />
              <Typography variant="body1">
                {getGradeMethodLabel(lesson.usemaxgrade ? 'highest' : (lesson.gradeMethod || 'highest'))}
              </Typography>
            </Box>
          </Box>

          {/* Maximum grade */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Maximum Grade
            </Typography>
            <Typography variant="body1" fontWeight="medium" sx={{ mt: 0.5 }}>
              {lesson.grade || 100}
            </Typography>
          </Box>

          {/* Passing grade */}
          {lesson.passinggrade !== undefined && lesson.passinggrade > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Passing Grade
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5 }}>
                {lesson.passinggrade}%
              </Typography>
            </Box>
          )}

          {/* Current grade */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Your Grade
            </Typography>
            {displayGrade !== null ? (
              <Box sx={{ mt: 0.5 }}>
                <Typography variant="h6" color="primary.main" fontWeight="bold">
                  {displayGrade.toFixed(1)} / {lesson.grade || 100}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(displayGrade / (lesson.grade || 100)) * 100}
                  sx={{ mt: 1, height: 8, borderRadius: 4 }}
                  color={
                    (displayGrade / (lesson.grade || 100)) * 100 >= (lesson.passinggrade || 70)
                      ? 'success'
                      : 'warning'
                  }
                />
              </Box>
            ) : (
              <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                Not yet graded
              </Typography>
            )}
          </Box>
        </Box>

        {/* Grade summary for completed attempts */}
        {completedAttempts.length > 1 && (
          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" gutterBottom>
              Grade Summary
            </Typography>
            <Stack direction="row" spacing={4}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Best Score
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {bestGrade !== null ? bestGrade.toFixed(1) : '—'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Average Score
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {averageGrade !== null ? averageGrade.toFixed(1) : '—'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Attempts
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {completedAttempts.length}
                </Typography>
              </Box>
            </Stack>
          </Box>
        )}
      </Card>

      {/* Attempt History Card */}
      {attempts.length > 0 && (
        <Card title="Attempt History" elevation={1} sx={{ mb: 3 }}>
          <DataTable
            columns={attemptColumns}
            rows={attempts}
            loading={isLoadingAttempts}
            pageSize={5}
            mode="client"
            error={attemptsError?.message}
            onRetry={refetchAttempts}
          />
        </Card>
      )}

      {/* Teacher Statistics Section */}
      {canViewReports && lessonData?.statistics && (
        <Card title="Lesson Statistics" elevation={1} sx={{ mb: 3 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
              gap: 3,
            }}
          >
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Total Attempts
              </Typography>
              <Typography variant="h5" fontWeight="medium">
                {lessonData.statistics.totalAttempts || 0}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Completed Attempts
              </Typography>
              <Typography variant="h5" fontWeight="medium">
                {lessonData.statistics.completedAttempts || 0}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Average Score
              </Typography>
              <Typography variant="h5" fontWeight="medium">
                {lessonData.statistics.averageScore?.toFixed(1) || '—'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Average Time
              </Typography>
              <Typography variant="h5" fontWeight="medium">
                {lessonData.statistics.averageTime
                  ? formatTimeFromSeconds(lessonData.statistics.averageTime)
                  : '—'}
              </Typography>
            </Box>
          </Box>
        </Card>
      )}

      {/* Password Entry Modal */}
      <Modal
        open={passwordModalOpen}
        onClose={() => {
          setPasswordModalOpen(false);
          setPasswordError(null);
          resetForm();
        }}
        title="Enter Lesson Password"
        maxWidth="xs"
        loading={isVerifyingPassword}
        actions={[
          {
            label: 'Cancel',
            onClick: () => {
              setPasswordModalOpen(false);
              setPasswordError(null);
              resetForm();
            },
            disabled: isVerifyingPassword,
          },
          {
            label: 'Submit',
            onClick: handleSubmit(handlePasswordSubmit),
            color: 'primary',
            variant: 'contained',
            disabled: isVerifyingPassword,
            loading: isVerifyingPassword,
          },
        ]}
      >
        <Box sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This lesson is password protected. Please enter the password to continue.
          </Typography>
          
          {passwordError && (
            <Alert
              severity="error"
              message={passwordError}
              sx={{ mb: 2 }}
            />
          )}
          
          <form onSubmit={handleSubmit(handlePasswordSubmit)}>
            <FormInput
              name="password"
              label="Password"
              type="password"
              control={control as unknown as Control<FieldValues>}
              required
              autoFocus
              fullWidth
              autoComplete="off"
            />
          </form>
        </Box>
      </Modal>

      {/* Mutation error display */}
      {startLessonMutation.isError && (
        <Alert
          severity="error"
          title="Failed to Start Lesson"
          message={
            startLessonMutation.error instanceof Error
              ? startLessonMutation.error.message
              : 'An error occurred while starting the lesson. Please try again.'
          }
          closeable
          sx={{ mt: 2 }}
        />
      )}
    </Box>
  );
}
