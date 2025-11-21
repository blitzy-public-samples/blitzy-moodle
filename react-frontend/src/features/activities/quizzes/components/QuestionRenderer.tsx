/**
 * Question Renderer Component
 *
 * Renders quiz questions based on their type (multiple choice, true/false, etc.)
 * and handles answer selection/input.
 *
 * @module features/activities/quizzes/components/QuestionRenderer
 */

import type React from 'react';
import {
  Box,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  Checkbox,
  FormGroup,
  TextField,
  Paper,
} from '@mui/material';
import type { QuizQuestion } from '../api/quizApi';

/**
 * QuestionRenderer Props
 */
interface QuestionRendererProps {
  question: QuizQuestion;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
  disabled?: boolean;
}

/**
 * QuestionRenderer Component
 *
 * Renders different question types:
 * - multichoice: Single or multiple answer selection
 * - truefalse: Boolean choice
 * - shortanswer: Text input
 * - numerical: Number input
 * - essay: Long text input
 *
 * @param props - Component props
 * @returns Question renderer component
 */
export function QuestionRenderer({
  question,
  value,
  onChange,
  disabled = false,
}: QuestionRendererProps): React.ReactElement {
  /**
   * Handle single choice change
   */
  const handleSingleChoiceChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.value);
  };

  /**
   * Handle multiple choice change
   */
  const handleMultipleChoiceChange = (optionId: string, checked: boolean): void => {
    const currentValue = Array.isArray(value) ? value : [];
    
    if (checked) {
      onChange([...currentValue, optionId]);
    } else {
      onChange(currentValue.filter((v) => v !== optionId));
    }
  };

  /**
   * Handle text input change
   */
  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    onChange(event.target.value);
  };

  /**
   * Render multiple choice question (single answer)
   */
  const renderMultipleChoiceSingle = (): React.ReactElement => {
    return (
      <FormControl component="fieldset" fullWidth disabled={disabled}>
        <RadioGroup
          value={value ?? ''}
          onChange={handleSingleChoiceChange}
          data-testid="question-options"
        >
          {question.options.map((option) => (
            <Paper
              key={option.id}
              variant="outlined"
              sx={{
                p: 2,
                mb: 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
                '&:hover': disabled ? {} : {
                  bgcolor: 'action.hover',
                },
                bgcolor: value === option.id.toString() ? 'action.selected' : 'transparent',
              }}
            >
              <FormControlLabel
                value={option.id.toString()}
                control={<Radio data-testid={`option-${option.id}`} />}
                label={
                  <Typography
                    variant="body1"
                    dangerouslySetInnerHTML={{ __html: option.text }}
                  />
                }
                sx={{ width: '100%', m: 0 }}
              />
            </Paper>
          ))}
        </RadioGroup>
      </FormControl>
    );
  };

  /**
   * Render multiple choice question (multiple answers)
   */
  const renderMultipleChoiceMultiple = (): React.ReactElement => {
    const currentValue = Array.isArray(value) ? value : [];

    return (
      <FormControl component="fieldset" fullWidth disabled={disabled}>
        <FormGroup data-testid="question-options">
          {question.options.map((option) => {
            const optionId = option.id.toString();
            const isChecked = currentValue.includes(optionId);

            return (
              <Paper
                key={option.id}
                variant="outlined"
                sx={{
                  p: 2,
                  mb: 1,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  '&:hover': disabled ? {} : {
                    bgcolor: 'action.hover',
                  },
                  bgcolor: isChecked ? 'action.selected' : 'transparent',
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isChecked}
                      onChange={(e) => handleMultipleChoiceChange(optionId, e.target.checked)}
                      data-testid={`option-${option.id}`}
                    />
                  }
                  label={
                    <Typography
                      variant="body1"
                      dangerouslySetInnerHTML={{ __html: option.text }}
                    />
                  }
                  sx={{ width: '100%', m: 0 }}
                />
              </Paper>
            );
          })}
        </FormGroup>
      </FormControl>
    );
  };

  /**
   * Render true/false question
   */
  const renderTrueFalse = (): React.ReactElement => {
    return (
      <FormControl component="fieldset" fullWidth disabled={disabled}>
        <RadioGroup
          value={value ?? ''}
          onChange={handleSingleChoiceChange}
          data-testid="question-options"
        >
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              '&:hover': disabled ? {} : {
                bgcolor: 'action.hover',
              },
              bgcolor: value === 'true' ? 'action.selected' : 'transparent',
            }}
          >
            <FormControlLabel
              value="true"
              control={<Radio data-testid="option-true" />}
              label="True"
              sx={{ width: '100%', m: 0 }}
            />
          </Paper>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              cursor: disabled ? 'not-allowed' : 'pointer',
              '&:hover': disabled ? {} : {
                bgcolor: 'action.hover',
              },
              bgcolor: value === 'false' ? 'action.selected' : 'transparent',
            }}
          >
            <FormControlLabel
              value="false"
              control={<Radio data-testid="option-false" />}
              label="False"
              sx={{ width: '100%', m: 0 }}
            />
          </Paper>
        </RadioGroup>
      </FormControl>
    );
  };

  /**
   * Render short answer question
   */
  const renderShortAnswer = (): React.ReactElement => {
    return (
      <TextField
        fullWidth
        variant="outlined"
        value={typeof value === 'string' ? value : ''}
        onChange={handleTextChange}
        disabled={disabled}
        placeholder="Enter your answer"
        data-testid="short-answer-input"
      />
    );
  };

  /**
   * Render numerical question
   */
  const renderNumerical = (): React.ReactElement => {
    return (
      <TextField
        fullWidth
        variant="outlined"
        type="number"
        value={typeof value === 'string' ? value : ''}
        onChange={handleTextChange}
        disabled={disabled}
        placeholder="Enter a number"
        data-testid="numerical-input"
      />
    );
  };

  /**
   * Render essay question
   */
  const renderEssay = (): React.ReactElement => {
    return (
      <TextField
        fullWidth
        variant="outlined"
        multiline
        rows={10}
        value={typeof value === 'string' ? value : ''}
        onChange={handleTextChange}
        disabled={disabled}
        placeholder="Write your essay here"
        data-testid="essay-input"
      />
    );
  };

  /**
   * Render unknown question type
   */
  const renderUnknown = (): React.ReactElement => {
    return (
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'warning.light' }}>
        <Typography>
          Question type &quot;{question.type}&quot; is not supported yet.
        </Typography>
      </Paper>
    );
  };

  return (
    <Box data-testid="question-renderer">
      {/* Question Text */}
      <Typography
        variant="h6"
        gutterBottom
        dangerouslySetInnerHTML={{ __html: question.questiontext }}
        data-testid="question-text"
        sx={{ mb: 3 }}
      />

      {/* Question Marks */}
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
        Marks: {question.maxmark}
      </Typography>

      {/* Question Input */}
      <Box>
        {question.type === 'multichoice' && question.options.length > 0 && (
          renderMultipleChoiceSingle()
        )}
        {question.type === 'multichoicemulti' && question.options.length > 0 && (
          renderMultipleChoiceMultiple()
        )}
        {question.type === 'truefalse' && renderTrueFalse()}
        {question.type === 'shortanswer' && renderShortAnswer()}
        {question.type === 'numerical' && renderNumerical()}
        {question.type === 'essay' && renderEssay()}
        {!['multichoice', 'multichoicemulti', 'truefalse', 'shortanswer', 'numerical', 'essay'].includes(question.type) && (
          renderUnknown()
        )}
      </Box>
    </Box>
  );
}

export default QuestionRenderer;
