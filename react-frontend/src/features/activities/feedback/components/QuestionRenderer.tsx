/**
 * QuestionRenderer Component
 * 
 * Dynamically renders different Moodle feedback question types using Material-UI components.
 * Supports multichoice, multichoicerated, numeric, textarea, textfield, info, and label types
 * with full accessibility support (WCAG 2.1 AA compliance).
 * 
 * @module features/activities/feedback/components/QuestionRenderer
 * @see public/mod/feedback/item/feedback_item_class.php - Base feedback item class
 * @see public/mod/feedback/item/multichoice/lib.php - Multichoice implementation
 * @see public/mod/feedback/item/numeric/lib.php - Numeric implementation
 */

import type React from 'react';
import {
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  Typography,
  FormHelperText,
  FormControl,
  FormLabel,
  Rating,
  Box,
} from '@mui/material';
import type { FeedbackItemPresentation } from '../types';

/**
 * Props interface for QuestionRenderer component.
 * 
 * Based on Moodle's feedback_item structure from the database schema.
 */
export interface QuestionRendererProps {
  /** Unique identifier for the feedback item */
  id: number;
  
  /** Question type (multichoice, numeric, textarea, etc.) */
  type: string;
  
  /** Type-specific configuration parsed from presentation field */
  presentation: FeedbackItemPresentation;
  
  /** Whether response is required (0=optional, 1=required) */
  required: number;
  
  /** Display position/order in the feedback */
  position: number;
  
  /** Question text or label */
  label: string;
  
  /** Current value of the question response */
  value: string | number | string[];
  
  /** Callback fired when the value changes */
  onChange: (value: string | number | string[]) => void;
  
  /** Validation error message to display */
  error?: string;
  
  /** Whether the field has been touched/interacted with */
  touched?: boolean;
  
  /** Additional CSS class name for styling */
  className?: string;
  
  /** Whether the question is disabled */
  disabled?: boolean;
}

/**
 * QuestionRenderer Component
 * 
 * Renders different feedback question types with appropriate Material-UI components.
 * Implements validation, accessibility features, and responsive design.
 * 
 * @example
 * ```tsx
 * <QuestionRenderer
 *   id={1}
 *   type="multichoice"
 *   presentation={{
 *     type: FeedbackQuestionType.MULTICHOICE,
 *     multichoice: {
 *       subtype: 'r',
 *       randomize: false,
 *       hideNotSelected: false,
 *       ignoreEmpty: false,
 *       options: ['Option 1', 'Option 2', 'Option 3']
 *     }
 *   }}
 *   required={1}
 *   position={1}
 *   label="Select your preference"
 *   value=""
 *   onChange={(value) => console.log(value)}
 * />
 * ```
 */
export function QuestionRenderer({
  id,
  type,
  presentation,
  required,
  position: _position, // Prop reserved for future use (e.g., display order)
  label,
  value,
  onChange,
  error,
  touched = false,
  className,
  disabled = false,
}: QuestionRendererProps): React.JSX.Element {
  // Generate unique IDs for accessibility
  const fieldId = `feedback-item-${id}`;
  const errorId = `${fieldId}-error`;
  const helperId = `${fieldId}-helper`;
  
  // Determine if error should be shown (only after field is touched)
  const showError = touched && !!error;
  
  /**
   * Renders a multichoice question as radio buttons or checkboxes.
   * Based on public/mod/feedback/item/multichoice/lib.php
   */
  const renderMultichoice = () => {
    if (!presentation.multichoice) {
      return <Typography color="error">Invalid multichoice configuration</Typography>;
    }
    
    const { subtype, options, hideNotSelected } = presentation.multichoice;
    const isCheckbox = subtype === 'c';
    
    // Handle checkbox (multiple selection) vs radio (single selection)
    if (isCheckbox) {
      const selectedValues = Array.isArray(value) ? value : [];
      
      return (
        <FormControl
          component="fieldset"
          error={showError}
          disabled={disabled}
          fullWidth
          className={className}
        >
          <FormLabel
            component="legend"
            id={fieldId}
            required={required === 1}
            sx={{ mb: 1 }}
          >
            {label}
          </FormLabel>
          
          <Box role="group" aria-labelledby={fieldId} aria-describedby={showError ? errorId : helperId}>
            {options.map((option, index) => {
              const optionValue = String(index + 1);
              const isChecked = selectedValues.includes(optionValue);
              
              return (
                <FormControlLabel
                  key={`${id}-option-${optionValue}-${option}`}
                  control={
                    <Checkbox
                      checked={isChecked}
                      onChange={(e) => {
                        let newValues: string[];
                        if (e.target.checked) {
                          newValues = [...selectedValues, optionValue];
                        } else {
                          newValues = selectedValues.filter(v => v !== optionValue);
                        }
                        onChange(newValues);
                      }}
                      disabled={disabled}
                      inputProps={{
                        'aria-label': option,
                      }}
                    />
                  }
                  label={option}
                  sx={{ display: 'block', mb: 0.5 }}
                />
              );
            })}
          </Box>
          
          {showError && (
            <FormHelperText id={errorId} error role="alert">
              {error}
            </FormHelperText>
          )}
        </FormControl>
      );
    }
    
    // Radio button (single selection)
    const selectedValue = typeof value === 'string' ? value : '';
    const allOptions = hideNotSelected ? options : ['', ...options];
    
    return (
      <FormControl
        component="fieldset"
        error={showError}
        disabled={disabled}
        fullWidth
        className={className}
      >
        <FormLabel
          component="legend"
          id={fieldId}
          required={required === 1}
          sx={{ mb: 1 }}
        >
          {label}
        </FormLabel>
        
        <RadioGroup
          aria-labelledby={fieldId}
          aria-describedby={showError ? errorId : helperId}
          value={selectedValue}
          onChange={(e) => onChange(e.target.value)}
        >
          {allOptions.map((option, index) => {
            const optionValue = option === '' ? '' : String(index);
            const optionLabel = option === '' ? 'Not selected' : option;
            
            return (
              <FormControlLabel
                key={`${id}-option-${optionValue}-${option}`}
                value={optionValue}
                control={
                  <Radio
                    inputProps={{
                      'aria-label': optionLabel,
                    }}
                  />
                }
                label={optionLabel}
                disabled={disabled}
              />
            );
          })}
        </RadioGroup>
        
        {showError && (
          <FormHelperText id={errorId} error role="alert">
            {error}
          </FormHelperText>
        )}
      </FormControl>
    );
  };
  
  /**
   * Renders a multichoicerated question with rating scale.
   * Based on public/mod/feedback/item/multichoice/lib.php (rated variant)
   */
  const renderMultichoicerated = () => {
    if (!presentation.multichoicerated) {
      return <Typography color="error">Invalid multichoicerated configuration</Typography>;
    }
    
    const { options } = presentation.multichoicerated;
    const selectedValue = typeof value === 'string' ? value : '';
    
    return (
      <FormControl
        component="fieldset"
        error={showError}
        disabled={disabled}
        fullWidth
        className={className}
      >
        <FormLabel
          component="legend"
          id={fieldId}
          required={required === 1}
          sx={{ mb: 1 }}
        >
          {label}
        </FormLabel>
        
        <RadioGroup
          aria-labelledby={fieldId}
          aria-describedby={showError ? errorId : helperId}
          value={selectedValue}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((option) => (
            <Box
              key={`${id}-rated-${option.value}-${option.text}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                mb: 1,
                gap: 2,
              }}
            >
              <FormControlLabel
                value={String(option.value)}
                control={
                  <Radio
                    inputProps={{
                      'aria-label': `${option.text} - ${option.value} points`,
                    }}
                  />
                }
                label={option.text}
                disabled={disabled}
              />
              
              <Rating
                value={option.value}
                max={Math.max(...options.map(o => o.value))}
                readOnly
                size="small"
                aria-hidden="true"
              />
              
              <Typography variant="body2" color="text.secondary">
                ({option.value})
              </Typography>
            </Box>
          ))}
        </RadioGroup>
        
        {showError && (
          <FormHelperText id={errorId} error role="alert">
            {error}
          </FormHelperText>
        )}
      </FormControl>
    );
  };
  
  /**
   * Renders a numeric input question with range validation.
   * Based on public/mod/feedback/item/numeric/lib.php
   */
  const renderNumeric = () => {
    if (!presentation.numeric) {
      return <Typography color="error">Invalid numeric configuration</Typography>;
    }
    
    const { rangeFrom, rangeTo } = presentation.numeric;
    const numericValue = typeof value === 'number' ? value : (value ? Number(value) : '');
    
    return (
      <TextField
        id={fieldId}
        type="number"
        label={label}
        value={numericValue}
        onChange={(e) => {
          const newValue = e.target.value === '' ? '' : Number(e.target.value);
          onChange(newValue);
        }}
        required={required === 1}
        error={showError}
        helperText={
          showError
            ? error
            : `Enter a number between ${rangeFrom} and ${rangeTo}`
        }
        disabled={disabled}
        fullWidth
        className={className}
        inputProps={{
          min: rangeFrom,
          max: rangeTo,
          step: 'any',
          'aria-describedby': showError ? errorId : helperId,
          'aria-invalid': showError,
          'aria-required': required === 1,
        }}
        FormHelperTextProps={{
          id: showError ? errorId : helperId,
          role: showError ? 'alert' : undefined,
        }}
        sx={{ mt: 1 }}
      />
    );
  };
  
  /**
   * Renders a multi-line textarea question.
   * Based on public/mod/feedback/item/textarea/lib.php
   */
  const renderTextarea = () => {
    const rows = presentation.text?.rows ?? 4;
    const maxLength = presentation.text?.maxLength;
    const textValue = typeof value === 'string' ? value : '';
    
    return (
      <TextField
        id={fieldId}
        label={label}
        value={textValue}
        onChange={(e) => onChange(e.target.value)}
        required={required === 1}
        error={showError}
        helperText={
          showError
            ? error
            : maxLength
            ? `${textValue.length}/${maxLength} characters`
            : undefined
        }
        disabled={disabled}
        fullWidth
        multiline
        rows={rows}
        className={className}
        inputProps={{
          maxLength,
          'aria-describedby': showError ? errorId : helperId,
          'aria-invalid': showError,
          'aria-required': required === 1,
        }}
        FormHelperTextProps={{
          id: showError ? errorId : helperId,
          role: showError ? 'alert' : undefined,
        }}
        sx={{ mt: 1 }}
      />
    );
  };
  
  /**
   * Renders a single-line textfield question.
   * Based on public/mod/feedback/item/textfield/lib.php
   */
  const renderTextfield = () => {
    const maxLength = presentation.text?.maxLength;
    const width = presentation.text?.width;
    const textValue = typeof value === 'string' ? value : '';
    
    return (
      <TextField
        id={fieldId}
        label={label}
        value={textValue}
        onChange={(e) => onChange(e.target.value)}
        required={required === 1}
        error={showError}
        helperText={
          showError
            ? error
            : maxLength
            ? `${textValue.length}/${maxLength} characters`
            : undefined
        }
        disabled={disabled}
        fullWidth={!width}
        className={className}
        inputProps={{
          maxLength,
          size: width,
          'aria-describedby': showError ? errorId : helperId,
          'aria-invalid': showError,
          'aria-required': required === 1,
        }}
        FormHelperTextProps={{
          id: showError ? errorId : helperId,
          role: showError ? 'alert' : undefined,
        }}
        sx={{
          mt: 1,
          ...(width && { maxWidth: `${width}ch` }),
        }}
      />
    );
  };
  
  /**
   * Renders informational text (non-question display item).
   * Based on public/mod/feedback/item/info/lib.php
   */
  const renderInfo = () => {
    const content = presentation.info?.content ?? label;
    
    return (
      <Box
        id={fieldId}
        role="note"
        aria-label="Information"
        className={className}
        sx={{
          p: 2,
          backgroundColor: 'info.lighter',
          borderRadius: 1,
          border: 1,
          borderColor: 'info.light',
          mt: 1,
          mb: 2,
        }}
      >
        <Typography
          variant="body1"
          component="div"
          dangerouslySetInnerHTML={{ __html: content }}
          sx={{ '& > *:first-of-type': { mt: 0 }, '& > *:last-child': { mb: 0 } }}
        />
      </Box>
    );
  };
  
  /**
   * Renders a label/heading for organizing questions.
   * Based on public/mod/feedback/item/label/lib.php
   */
  const renderLabel = () => {
    return (
      <Box
        id={fieldId}
        className={className}
        sx={{ mt: 3, mb: 2 }}
      >
        <Typography
          variant="h6"
          component="h3"
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            borderBottom: 2,
            borderColor: 'primary.main',
            pb: 1,
          }}
        >
          {label}
        </Typography>
      </Box>
    );
  };
  
  /**
   * Renders the appropriate component based on question type.
   */
  const renderQuestion = () => {
    switch (type.toLowerCase()) {
      case 'multichoice':
        return renderMultichoice();
      
      case 'multichoicerated':
        return renderMultichoicerated();
      
      case 'numeric':
        return renderNumeric();
      
      case 'textarea':
        return renderTextarea();
      
      case 'textfield':
        return renderTextfield();
      
      case 'info':
        return renderInfo();
      
      case 'label':
        return renderLabel();
      
      default:
        return (
          <Box
            id={fieldId}
            role="alert"
            className={className}
            sx={{ p: 2, backgroundColor: 'error.lighter', borderRadius: 1 }}
          >
            <Typography color="error">
              Unsupported question type: {type}
            </Typography>
          </Box>
        );
    }
  };
  
  return (
    <Box
      component="section"
      aria-labelledby={type === 'label' ? fieldId : undefined}
      sx={{ mb: 3 }}
    >
      {renderQuestion()}
    </Box>
  );
}
