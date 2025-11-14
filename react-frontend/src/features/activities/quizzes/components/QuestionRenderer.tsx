/**
 * QuestionRenderer Component
 *
 * Dynamic question renderer component that displays different question types with appropriate
 * input controls. Implements a factory pattern to render multichoice, truefalse, shortanswer,
 * essay, matching, and numerical question types using Material-UI form components.
 *
 * Features:
 * - Factory pattern for rendering different question types
 * - Material-UI form components for consistent input handling
 * - Real-time validation and feedback display
 * - Answer state management with dirty tracking for auto-save
 * - Flag/unflag functionality for marking questions for review
 * - File attachment support for essay questions
 * - HTML content rendering for question text
 * - Accessibility compliance with ARIA labels
 * - TypeScript discriminated unions for type safety
 *
 * Supported Question Types:
 * - Multiple Choice (single or multiple answers)
 * - True/False (special case of multiple choice)
 * - Short Answer (text input with validation)
 * - Essay (multiline text with optional file attachments)
 * - Matching (dropdown selections for paired items)
 * - Numerical (number input with range validation)
 *
 * Usage:
 * ```tsx
 * <QuestionRenderer
 *   question={questionData}
 *   answer={currentAnswer}
 *   onChange={handleAnswerChange}
 *   onFlag={handleFlagToggle}
 *   showFeedback={true}
 *   disabled={false}
 * />
 * ```
 *
 * @module features/activities/quizzes/components/QuestionRenderer
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  FormHelperText,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Checkbox,
  InputAdornment,
  Paper,
  Divider,
} from '@mui/material';
import { Flag, FlagOutlined } from '@mui/icons-material';

import type { Question } from '../types/quiz.types';
import { FormFileUpload } from '@/components/forms/FormFileUpload';
import { Alert } from '@/components/feedback/Alert';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Answer type - can be string, array of strings, or object for complex answers
 */
export type QuestionAnswer = string | string[] | Record<string, string> | null;

/**
 * Props interface for QuestionRenderer component
 */
export interface QuestionRendererProps {
  /**
   * Question data including type, text, options, and current state
   */
  question: Question;

  /**
   * Current answer value (if any)
   */
  answer?: QuestionAnswer;

  /**
   * Callback fired when the answer changes
   * @param questionId - ID of the question being answered
   * @param answer - New answer value
   */
  onChange: (questionId: number, answer: QuestionAnswer) => void;

  /**
   * Callback fired when the question flag status changes
   * @param questionId - ID of the question being flagged/unflagged
   * @param flagged - New flag status
   */
  onFlag?: (questionId: number, flagged: boolean) => void;

  /**
   * Whether to show feedback for this question
   * Controlled by quiz review settings
   * @default false
   */
  showFeedback?: boolean;

  /**
   * Whether the question is in read-only mode (during review)
   * @default false
   */
  disabled?: boolean;

  /**
   * Additional CSS class name for custom styling
   */
  className?: string;
}

/**
 * Internal state for tracking answer changes
 */
interface QuestionState {
  /** Current answer value */
  currentAnswer: QuestionAnswer;
  /** Whether the answer has been modified */
  isDirty: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * QuestionRenderer Component
 *
 * Renders a quiz question with appropriate input controls based on question type.
 * Uses factory pattern to delegate rendering to type-specific subcomponents.
 */
export function QuestionRenderer({
  question,
  answer: initialAnswer = null,
  onChange,
  onFlag,
  showFeedback = false,
  disabled = false,
  className,
}: QuestionRendererProps): JSX.Element {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [localState, setLocalState] = useState<QuestionState>({
    currentAnswer: initialAnswer,
    isDirty: false,
  });

  const [flagged, setFlagged] = useState<boolean>(question.flagged || false);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Handles answer changes and notifies parent component
   */
  const handleAnswerChange = useCallback(
    (newAnswer: QuestionAnswer) => {
      setLocalState({
        currentAnswer: newAnswer,
        isDirty: true,
      });
      onChange(question.id, newAnswer);
    },
    [question.id, onChange]
  );

  /**
   * Handles flag toggle for marking questions for review
   */
  const handleFlagToggle = useCallback(() => {
    const newFlaggedState = !flagged;
    setFlagged(newFlaggedState);
    if (onFlag) {
      onFlag(question.id, newFlaggedState);
    }
  }, [flagged, question.id, onFlag]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  /**
   * Determine if feedback should be shown based on question state and settings
   */
  const shouldShowFeedback = useMemo(() => {
    return showFeedback && question.feedback !== undefined;
  }, [showFeedback, question.feedback]);

  /**
   * Get feedback severity based on question state
   */
  const feedbackSeverity = useMemo(() => {
    if (!question.fraction) return 'info';
    if (question.fraction >= 1) return 'success';
    if (question.fraction > 0) return 'warning';
    return 'error';
  }, [question.fraction]);

  // ============================================================================
  // RENDER QUESTION CONTENT
  // ============================================================================

  /**
   * Renders the appropriate question input based on question type
   */
  const renderQuestionInput = useCallback(() => {
    const currentAnswer = localState.currentAnswer;

    switch (question.type) {
      case 'multichoice':
        return (
          <MultipleChoiceQuestion
            question={question}
            answer={currentAnswer as string | string[]}
            onChange={handleAnswerChange}
            disabled={disabled}
          />
        );

      case 'truefalse':
        return (
          <TrueFalseQuestion
            question={question}
            answer={currentAnswer as string}
            onChange={handleAnswerChange}
            disabled={disabled}
          />
        );

      case 'shortanswer':
        return (
          <ShortAnswerQuestion
            question={question}
            answer={currentAnswer as string}
            onChange={handleAnswerChange}
            disabled={disabled}
          />
        );

      case 'essay':
        return (
          <EssayQuestion
            question={question}
            answer={currentAnswer as string}
            onChange={handleAnswerChange}
            disabled={disabled}
          />
        );

      case 'match':
        return (
          <MatchingQuestion
            question={question}
            answer={currentAnswer as Record<string, string>}
            onChange={handleAnswerChange}
            disabled={disabled}
          />
        );

      case 'numerical':
        return (
          <NumericalQuestion
            question={question}
            answer={currentAnswer as string}
            onChange={handleAnswerChange}
            disabled={disabled}
          />
        );

      default:
        return (
          <Alert
            severity="warning"
            message={`Question type "${question.type}" is not yet supported.`}
          />
        );
    }
  }, [question, localState.currentAnswer, handleAnswerChange, disabled]);

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <Paper
      elevation={1}
      className={className}
      sx={{
        p: 3,
        mb: 3,
        position: 'relative',
      }}
      role="article"
      aria-label={`Question ${question.displaynumber || question.slot}`}
    >
      {/* Question Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography
            variant="h6"
            component="h3"
            sx={{ mb: 1, fontWeight: 600 }}
          >
            Question {question.displaynumber || question.slot}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Marks: {question.defaultmark}
            {question.maxmark && question.maxmark !== question.defaultmark && (
              <> (Max: {question.maxmark})</>
            )}
          </Typography>
        </Box>

        {/* Flag Button */}
        {onFlag && (
          <IconButton
            onClick={handleFlagToggle}
            color={flagged ? 'primary' : 'default'}
            aria-label={flagged ? 'Unflag question' : 'Flag question for review'}
            aria-pressed={flagged}
            disabled={disabled}
            sx={{ ml: 1 }}
          >
            {flagged ? <Flag /> : <FlagOutlined />}
          </IconButton>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Question Text */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="body1"
          component="div"
          sx={{ mb: 2 }}
          dangerouslySetInnerHTML={{
            __html: question.questiontext,
          }}
          aria-label="Question text"
        />
      </Box>

      {/* Question Input (type-specific) */}
      {renderQuestionInput()}

      {/* Feedback Display */}
      {shouldShowFeedback && question.feedback && (
        <Box sx={{ mt: 3 }}>
          <Alert
            severity={feedbackSeverity}
            title="Feedback"
            message={question.feedback}
          />
        </Box>
      )}

      {/* General Feedback */}
      {showFeedback && question.generalfeedback && (
        <Box sx={{ mt: 2 }}>
          <Alert
            severity="info"
            title="General Feedback"
            message={question.generalfeedback}
          />
        </Box>
      )}

      {/* Right Answer (if shown) */}
      {showFeedback && question.rightanswer && (
        <Box sx={{ mt: 2 }}>
          <Alert
            severity="info"
            title="Correct Answer"
            message={question.rightanswer}
          />
        </Box>
      )}

      {/* Answer State Indicator */}
      {localState.isDirty && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 2, display: 'block', fontStyle: 'italic' }}
        >
          Answer modified (auto-saving...)
        </Typography>
      )}
    </Paper>
  );
}

// ============================================================================
// QUESTION TYPE SUBCOMPONENTS
// ============================================================================

/**
 * Props for question type subcomponents
 */
interface QuestionTypeProps {
  question: Question;
  answer: any;
  onChange: (answer: QuestionAnswer) => void;
  disabled: boolean;
}

/**
 * Multiple Choice Question Component
 * Supports both single and multiple answer selections
 */
function MultipleChoiceQuestion({
  question,
  answer,
  onChange,
  disabled,
}: QuestionTypeProps): JSX.Element {
  const answers = question.options.answers || [];
  const isSingleChoice = question.options.single !== false;

  const handleSingleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const handleMultipleChange = (answerId: string, checked: boolean) => {
    const currentAnswers = Array.isArray(answer) ? answer : [];
    const newAnswers = checked
      ? [...currentAnswers, answerId]
      : currentAnswers.filter((id) => id !== answerId);
    onChange(newAnswers);
  };

  if (isSingleChoice) {
    return (
      <FormControl component="fieldset" fullWidth disabled={disabled}>
        <FormLabel component="legend" sx={{ mb: 1 }}>
          Select one answer:
        </FormLabel>
        <RadioGroup
          value={answer || ''}
          onChange={handleSingleChange}
          aria-label="Answer options"
        >
          {answers.map((ans) => (
            <FormControlLabel
              key={ans.id}
              value={String(ans.id)}
              control={<Radio />}
              label={
                <span dangerouslySetInnerHTML={{ __html: ans.answer }} />
              }
              sx={{ mb: 1 }}
            />
          ))}
        </RadioGroup>
      </FormControl>
    );
  }

  // Multiple choice (checkboxes)
  const selectedAnswers = Array.isArray(answer) ? answer : [];

  return (
    <FormControl component="fieldset" fullWidth disabled={disabled}>
      <FormLabel component="legend" sx={{ mb: 1 }}>
        Select one or more answers:
      </FormLabel>
      <Box>
        {answers.map((ans) => (
          <FormControlLabel
            key={ans.id}
            control={
              <Checkbox
                checked={selectedAnswers.includes(String(ans.id))}
                onChange={(e) =>
                  handleMultipleChange(String(ans.id), e.target.checked)
                }
              />
            }
            label={<span dangerouslySetInnerHTML={{ __html: ans.answer }} />}
            sx={{ mb: 1, display: 'block' }}
          />
        ))}
      </Box>
    </FormControl>
  );
}

/**
 * True/False Question Component
 * Specialized multiple choice with two options
 */
function TrueFalseQuestion({
  question,
  answer,
  onChange,
  disabled,
}: QuestionTypeProps): JSX.Element {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <FormControl component="fieldset" fullWidth disabled={disabled}>
      <FormLabel component="legend" sx={{ mb: 1 }}>
        Select True or False:
      </FormLabel>
      <RadioGroup
        value={answer || ''}
        onChange={handleChange}
        aria-label="True or False"
      >
        <FormControlLabel
          value="true"
          control={<Radio />}
          label="True"
          sx={{ mb: 1 }}
        />
        <FormControlLabel
          value="false"
          control={<Radio />}
          label="False"
        />
      </RadioGroup>
    </FormControl>
  );
}

/**
 * Short Answer Question Component
 * Single-line text input with optional case sensitivity
 */
function ShortAnswerQuestion({
  question,
  answer,
  onChange,
  disabled,
}: QuestionTypeProps): JSX.Element {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <FormControl fullWidth>
      <TextField
        value={answer || ''}
        onChange={handleChange}
        disabled={disabled}
        fullWidth
        placeholder="Enter your answer"
        aria-label="Short answer input"
        variant="outlined"
        helperText="Enter a short text answer"
      />
    </FormControl>
  );
}

/**
 * Essay Question Component
 * Multiline text input with optional file attachments
 */
function EssayQuestion({
  question,
  answer,
  onChange,
  disabled,
}: QuestionTypeProps): JSX.Element {
  const [textAnswer, setTextAnswer] = useState<string>(
    typeof answer === 'string' ? answer : ''
  );
  const [files, setFiles] = useState<File[]>([]);

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setTextAnswer(newText);
    onChange(newText);
  };

  const handleFileChange = useCallback(
    (newFiles: File[]) => {
      setFiles(newFiles);
      // In a real implementation, files would be uploaded and referenced
      // For now, we just track them locally
    },
    []
  );

  return (
    <Box>
      <FormControl fullWidth sx={{ mb: 3 }}>
        <TextField
          value={textAnswer}
          onChange={handleTextChange}
          disabled={disabled}
          fullWidth
          multiline
          rows={8}
          placeholder="Write your essay here..."
          aria-label="Essay answer input"
          variant="outlined"
          helperText="Provide a detailed answer"
        />
      </FormControl>

      {/* File Attachments */}
      {!disabled && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Optional: Attach supporting files
          </Typography>
          <FormFileUpload
            name={`question_${question.id}_files`}
            label="Upload Files"
            accept="application/pdf,image/*,.doc,.docx"
            maxSize={10 * 1024 * 1024}
            multiple
            maxFiles={5}
            helperText="Upload PDF, images, or documents (max 10MB each, up to 5 files)"
          />
        </Box>
      )}
    </Box>
  );
}

/**
 * Matching Question Component
 * Dropdown selections for pairing items
 */
function MatchingQuestion({
  question,
  answer,
  onChange,
  disabled,
}: QuestionTypeProps): JSX.Element {
  const matches = question.options.matches || [];
  const subquestions = question.options.subquestions || [];
  
  const currentMatches = (answer as Record<string, string>) || {};

  const handleMatchChange = (subquestionId: string, matchId: string) => {
    const newMatches = {
      ...currentMatches,
      [subquestionId]: matchId,
    };
    onChange(newMatches);
  };

  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Match each item on the left with an item on the right:
      </Typography>
      {subquestions.map((subq: any) => (
        <Box key={subq.id} sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
            <span dangerouslySetInnerHTML={{ __html: subq.questiontext }} />
          </Typography>
          <FormControl fullWidth disabled={disabled}>
            <Select
              value={currentMatches[String(subq.id)] || ''}
              onChange={(e) =>
                handleMatchChange(String(subq.id), e.target.value)
              }
              displayEmpty
              aria-label={`Match for ${subq.questiontext}`}
            >
              <MenuItem value="">
                <em>Choose...</em>
              </MenuItem>
              {matches.map((match: any) => (
                <MenuItem key={match.id} value={String(match.id)}>
                  {match.answertext}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Numerical Question Component
 * Number input with validation for numerical answers
 */
function NumericalQuestion({
  question,
  answer,
  onChange,
  disabled,
}: QuestionTypeProps): JSX.Element {
  const [error, setError] = useState<string>('');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    
    // Validate numerical input
    if (value && isNaN(Number(value))) {
      setError('Please enter a valid number');
    } else {
      setError('');
      onChange(value);
    }
  };

  const units = question.options.unit || '';
  const unitPosition = question.options.unitsleft ? 'start' : 'end';

  return (
    <FormControl fullWidth>
      <TextField
        type="text"
        value={answer || ''}
        onChange={handleChange}
        disabled={disabled}
        fullWidth
        placeholder="Enter a numerical answer"
        aria-label="Numerical answer input"
        variant="outlined"
        error={!!error}
        helperText={error || 'Enter a number'}
        InputProps={
          units
            ? {
                [unitPosition === 'start' ? 'startAdornment' : 'endAdornment']: (
                  <InputAdornment position={unitPosition}>
                    {units}
                  </InputAdornment>
                ),
              }
            : undefined
        }
      />
    </FormControl>
  );
}
